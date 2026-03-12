# Write-Ahead Logging & Durability

> **Domain:** Database > Internals > WAL & Durability
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

The Write-Ahead Log (WAL) is the mechanism that guarantees database durability — the "D" in ACID. Without WAL, a power failure or crash can corrupt data mid-write, leaving the database in an inconsistent state. WAL ensures that every change is recorded in a sequential log before being applied to data files. On recovery, the database replays the WAL to restore consistency. Understanding WAL is critical for tuning database performance (fsync settings, checkpoint frequency), configuring replication (streaming replication uses WAL), and implementing point-in-time recovery (PITR). Every production database decision around durability, replication, and backup depends on WAL configuration.

---

## How It Works

### WAL Fundamentals

```
Write-Ahead Logging Protocol:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Rule: NEVER write data pages to disk before the      │
│  corresponding WAL record is flushed to disk          │
│                                                        │
│  Transaction: UPDATE accounts SET balance = 500       │
│               WHERE id = 1                             │
│                                                        │
│  Step 1: Write WAL record                              │
│  ┌─────────────────────────────────────────┐          │
│  │ WAL Record:                              │          │
│  │ LSN: 000000010000000A                    │          │
│  │ Transaction: T42                         │          │
│  │ Table: accounts                          │          │
│  │ Page: 7, Offset: 3                       │          │
│  │ Old value: balance = 1000                │          │
│  │ New value: balance = 500                 │          │
│  └─────────────────────────────────────────┘          │
│       │                                                │
│       ▼ fsync (flush to disk)                         │
│  ┌─────────────────────────────────────┐              │
│  │ WAL file on disk (sequential write) │              │
│  └─────────────────────────────────────┘              │
│                                                        │
│  Step 2: Modify page in buffer pool (memory)          │
│  ┌─────────────────────────────┐                      │
│  │ Buffer Pool: Page 7 (dirty) │                      │
│  │ balance = 500 (modified)    │                      │
│  └─────────────────────────────┘                      │
│                                                        │
│  Step 3: Eventually flush dirty page to disk          │
│  (checkpoint — happens asynchronously, later)         │
│                                                        │
│  If crash between Step 1 and Step 3:                  │
│  → Replay WAL from last checkpoint                    │
│  → Apply all committed changes to data pages          │
│  → Undo all uncommitted changes                       │
│  → Database is consistent                             │
└──────────────────────────────────────────────────────┘
```

### WAL Record Structure

```
WAL Record Format (PostgreSQL):
┌──────────────────────────────────────────┐
│ Header                                    │
│ ├── LSN (Log Sequence Number) — 8 bytes  │
│ ├── Transaction ID — 4 bytes             │
│ ├── Resource Manager ID — 1 byte         │
│ ├── Record Length — 4 bytes              │
│ └── CRC32 Checksum — 4 bytes            │
│                                           │
│ Body (varies by record type)             │
│ ├── Heap Insert: table OID, tuple data   │
│ ├── Heap Update: old tuple, new tuple    │
│ ├── Heap Delete: tuple TID              │
│ ├── B-tree Insert: index entry           │
│ ├── Commit: transaction ID, timestamp    │
│ └── Checkpoint: redo point, timeline     │
└──────────────────────────────────────────┘

LSN (Log Sequence Number):
  • Monotonically increasing identifier
  • Uniquely identifies position in WAL stream
  • Format: segment/offset (e.g., 0/15A3B400)
  • Used for: recovery point, replication position,
    buffer pool dirty page tracking
```

---

### Checkpoints

```
Checkpoint: flush all dirty pages to disk + record WAL position

Without checkpoints:
  Recovery must replay ALL WAL from beginning → hours

With checkpoints:
  Recovery starts from last checkpoint → seconds/minutes

Checkpoint Process:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  1. Record checkpoint start LSN in WAL                │
│  2. Flush all dirty buffer pool pages to disk         │
│  3. Sync all data files (fsync)                       │
│  4. Write checkpoint completion record to WAL         │
│  5. Advance recovery start point                      │
│  6. Remove old WAL files (before checkpoint)          │
│                                                        │
│  Timeline:                                             │
│  ──WAL──WAL──WAL──[CKPT]──WAL──WAL──[CKPT]──WAL──   │
│                     ▲                   ▲              │
│                     │                   │              │
│              recovery starts     latest checkpoint    │
│              from here if crash                       │
│              happens between                          │
│              checkpoints                               │
│                                                        │
│  PostgreSQL defaults:                                  │
│  checkpoint_timeout = 5min (max time between)         │
│  max_wal_size = 1GB (checkpoint when WAL reaches)     │
│  checkpoint_completion_target = 0.9 (spread I/O)      │
└──────────────────────────────────────────────────────┘
```

```sql
-- PostgreSQL: checkpoint configuration
-- postgresql.conf

-- Trigger checkpoint when WAL reaches this size
-- max_wal_size = '2GB'  (default 1GB)

-- Maximum time between checkpoints
-- checkpoint_timeout = '10min'  (default 5min)

-- Spread checkpoint I/O over this fraction of interval
-- checkpoint_completion_target = 0.9  (default 0.9)
-- 0.9 = spread over 90% of interval (reduces I/O spikes)

-- Monitor checkpoint activity
SELECT * FROM pg_stat_bgwriter;
-- checkpoints_timed: checkpoints triggered by timeout
-- checkpoints_req: checkpoints triggered by WAL size
-- buffers_checkpoint: pages written during checkpoint
-- checkpoint_write_time: total checkpoint write time (ms)
-- checkpoint_sync_time: total checkpoint sync time (ms)

-- If checkpoints_req >> checkpoints_timed:
-- increase max_wal_size (too many WAL-triggered checkpoints)
```

---

### Durability Levels

```
Durability Configuration Spectrum:
┌────────────────────────────────────────────────────────┐
│                                                          │
│  Most Durable ◄──────────────────────► Fastest          │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │ Level 5: synchronous_commit = remote_apply   │      │
│  │ WAL flushed locally + applied on standby     │      │
│  │ Zero data loss + readable standby            │      │
│  │ Latency: local fsync + network RTT + apply   │      │
│  └──────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────┐      │
│  │ Level 4: synchronous_commit = on (default)   │      │
│  │ WAL flushed locally + flushed on standby     │      │
│  │ Zero data loss with sync standby             │      │
│  │ Latency: local fsync + network RTT + fsync   │      │
│  └──────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────┐      │
│  │ Level 3: synchronous_commit = local          │      │
│  │ WAL flushed to local disk only               │      │
│  │ Data safe on local node, may lose on standby │      │
│  │ Latency: local fsync (~0.1-1ms SSD)          │      │
│  └──────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────┐      │
│  │ Level 2: synchronous_commit = off            │      │
│  │ WAL written to OS buffer, not flushed        │      │
│  │ May lose last ~600ms of data on crash        │      │
│  │ Latency: OS write (~0.01ms)                  │      │
│  └──────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────┐      │
│  │ Level 1: fsync = off (NEVER in production!)  │      │
│  │ No disk flush guarantee                       │      │
│  │ Data corruption possible on crash            │      │
│  │ Latency: memory write only                   │      │
│  └──────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────┘
```

```sql
-- PostgreSQL: per-transaction durability control
-- Critical financial transaction: full durability
SET LOCAL synchronous_commit = 'on';
BEGIN;
INSERT INTO payments (amount, status) VALUES (10000, 'completed');
COMMIT;  -- waits for WAL fsync

-- Analytics event: speed over durability
SET LOCAL synchronous_commit = 'off';
BEGIN;
INSERT INTO analytics_events (event_type, data) VALUES ('page_view', '{}');
COMMIT;  -- returns immediately, WAL flushed eventually (~600ms)
```

```go
// Go — Per-transaction durability with pgx
func InsertPayment(ctx context.Context, pool *pgxpool.Pool, amount float64) error {
    tx, err := pool.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

    // Full durability for financial data
    _, err = tx.Exec(ctx, "SET LOCAL synchronous_commit = 'on'")
    if err != nil {
        return err
    }

    _, err = tx.Exec(ctx,
        "INSERT INTO payments (amount, status) VALUES ($1, 'completed')",
        amount,
    )
    if err != nil {
        return err
    }

    return tx.Commit(ctx) // waits for WAL fsync
}

func InsertAnalyticsEvent(ctx context.Context, pool *pgxpool.Pool, event string) error {
    tx, err := pool.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

    // Relaxed durability for non-critical data
    _, err = tx.Exec(ctx, "SET LOCAL synchronous_commit = 'off'")
    if err != nil {
        return err
    }

    _, err = tx.Exec(ctx,
        "INSERT INTO analytics_events (event_type) VALUES ($1)",
        event,
    )
    if err != nil {
        return err
    }

    return tx.Commit(ctx) // returns immediately
}
```

---

### Crash Recovery

```
Recovery Process (ARIES algorithm):
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Phase 1: Analysis                                     │
│  • Scan WAL from last checkpoint forward               │
│  • Build list of: dirty pages, active transactions    │
│  • Determine redo start point (oldest dirty page LSN) │
│                                                        │
│  Phase 2: Redo (replay committed changes)              │
│  • Replay WAL from redo point forward                  │
│  • Apply all changes (committed + uncommitted)         │
│  • Restore database to crash-time state               │
│                                                        │
│  Phase 3: Undo (rollback uncommitted transactions)     │
│  • For each uncommitted transaction at crash time      │
│  • Walk backward through WAL, undo changes             │
│  • Write compensation log records (CLRs)              │
│                                                        │
│  Result: Database consistent, as if crash never        │
│          happened (committed = applied, uncommitted     │
│          = rolled back)                                 │
│                                                        │
│  ──[CKPT]──T1:begin──T2:begin──T1:commit──[CRASH]──  │
│                                                        │
│  Redo: replay T1 commit + T2 changes                  │
│  Undo: rollback T2 (never committed)                  │
└──────────────────────────────────────────────────────┘
```

---

### WAL-Based Replication

```
Streaming Replication (PostgreSQL):
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Primary                     Standby                  │
│  ┌───────────────┐          ┌───────────────┐        │
│  │ Application   │          │               │        │
│  │ writes data   │          │ WAL Receiver  │        │
│  │       │       │          │       │       │        │
│  │       ▼       │          │       ▼       │        │
│  │ WAL Writer    │──stream─►│ Write WAL    │        │
│  │       │       │  (TCP)   │       │       │        │
│  │       ▼       │          │       ▼       │        │
│  │ WAL on disk   │          │ WAL on disk  │        │
│  │       │       │          │       │       │        │
│  │       ▼       │          │       ▼       │        │
│  │ Data files    │          │ Apply to data │        │
│  │ (via ckpt)    │          │ files         │        │
│  └───────────────┘          └───────────────┘        │
│                                                        │
│  WAL stream = continuous byte stream of WAL records   │
│  Standby replays WAL to maintain identical copy       │
│  Replication lag = time between WAL write on primary  │
│  and WAL apply on standby                             │
│                                                        │
│  Types:                                                │
│  • Physical: byte-for-byte WAL replay (same PG ver)  │
│  • Logical: decode WAL into logical changes (cross-ver)│
└──────────────────────────────────────────────────────┘
```

---

### Point-in-Time Recovery (PITR)

```
PITR: Restore database to any point in time
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Continuous archiving:                                 │
│  1. Take base backup (pg_basebackup)                  │
│  2. Archive WAL files continuously to S3/GCS/NFS      │
│  3. On disaster: restore base + replay WAL to target  │
│                                                        │
│  ──[Base]──WAL1──WAL2──WAL3──WAL4──WAL5──[now]──     │
│     Backup                        ▲                    │
│                                   │                    │
│                             restore to here           │
│                             (before bad DELETE)        │
│                                                        │
│  Recovery Target Options:                              │
│  • Timestamp: RECOVERY_TARGET_TIME = '2024-06-15 14:30'│
│  • Transaction ID: RECOVERY_TARGET_XID = '12345'      │
│  • LSN: RECOVERY_TARGET_LSN = '0/15A3B400'            │
│  • Named restore point: RECOVERY_TARGET_NAME = 'v2.1' │
└──────────────────────────────────────────────────────┘
```

```bash
# PostgreSQL: configure WAL archiving
# postgresql.conf
# archive_mode = on
# archive_command = 'aws s3 cp %p s3://my-wal-archive/%f'
# wal_level = replica

# Take base backup
pg_basebackup -D /backup/base -Ft -z -P -U replicator

# PITR restore
# 1. Stop PostgreSQL
# 2. Replace data directory with base backup
# 3. Create recovery signal file

# recovery.conf (or postgresql.conf in PG 12+)
# restore_command = 'aws s3 cp s3://my-wal-archive/%f %p'
# recovery_target_time = '2024-06-15 14:30:00 UTC'
# recovery_target_action = 'promote'

# 4. Start PostgreSQL — it replays WAL to target time
```

---

### MySQL InnoDB WAL (Redo Log)

```
InnoDB Redo Log:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Circular redo log files (fixed size):                │
│  ┌──────────┐  ┌──────────┐                          │
│  │ib_logfile│  │ib_logfile│                          │
│  │   0      │  │   1      │  (write wraps around)    │
│  └──────────┘  └──────────┘                          │
│                                                        │
│  Write path:                                           │
│  1. Write redo log entry (sequential)                 │
│  2. Modify page in buffer pool                        │
│  3. Flush redo log (controlled by                     │
│     innodb_flush_log_at_trx_commit)                   │
│                                                        │
│  innodb_flush_log_at_trx_commit:                      │
│  = 1 (default): flush + fsync on every commit         │
│       → safest, ~50% slower                            │
│  = 2: flush to OS buffer on every commit               │
│       → lose ~1s on OS crash, not MySQL crash          │
│  = 0: flush every second (not per commit)              │
│       → lose ~1s of data on any crash                  │
│                                                        │
│  Doublewrite Buffer (InnoDB-specific):                │
│  Problem: 16KB InnoDB page vs 4KB filesystem block    │
│  → partial page write (torn page) on crash            │
│  Solution: write page to doublewrite buffer first     │
│  → if torn page detected, restore from doublewrite    │
└──────────────────────────────────────────────────────┘
```

---

### WAL Performance Tuning

| Setting | Default | Tuned | Impact |
|---------|---------|-------|--------|
| **PG: wal_buffers** | -1 (auto) | 64MB | Larger = fewer WAL flushes |
| **PG: max_wal_size** | 1GB | 4-16GB | Larger = fewer checkpoints, longer recovery |
| **PG: min_wal_size** | 80MB | 1GB | Keep WAL files pre-allocated |
| **PG: checkpoint_timeout** | 5min | 10-15min | Longer = fewer checkpoints |
| **PG: wal_compression** | off | on | 30-50% WAL size reduction, CPU cost |
| **PG: full_page_writes** | on | on | NEVER disable (torn page protection) |
| **MySQL: innodb_log_file_size** | 48MB | 1-4GB | Larger = fewer checkpoints |
| **MySQL: innodb_flush_log_at_trx_commit** | 1 | 1 or 2 | 2 = faster, slight durability tradeoff |
| **MySQL: innodb_log_buffer_size** | 16MB | 64-256MB | Larger for large transactions |

---

## Best Practices

1. **NEVER set fsync = off** in production — data corruption guaranteed on crash
2. **ALWAYS keep full_page_writes = on** (PostgreSQL) — prevents torn page corruption
3. **ALWAYS configure WAL archiving** for production — enables PITR and disaster recovery
4. **ALWAYS monitor checkpoint frequency** — too frequent = I/O spikes, too rare = long recovery
5. **ALWAYS use synchronous_commit = on** for financial/critical data — zero data loss
6. **ALWAYS size redo log files appropriately** — too small causes excessive checkpoints
7. **ALWAYS test recovery procedures** — untested backups are not backups
8. **NEVER use synchronous_commit = off globally** — only per-transaction for non-critical data
9. **NEVER ignore WAL disk I/O** — WAL on dedicated SSD improves write throughput
10. **NEVER disable doublewrite buffer** (InnoDB) — protects against torn pages

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| fsync = off in production | Data corruption after crash | Always fsync = on |
| No WAL archiving | Cannot do PITR after disaster | Configure archive_command to S3/GCS |
| Small max_wal_size | Frequent checkpoints, I/O spikes | Increase to 4-16 GB |
| Synchronous_commit off globally | Data loss on crash | Only off per-transaction for non-critical |
| WAL on same disk as data | WAL I/O competes with data I/O | Separate WAL to dedicated SSD |
| No PITR testing | Recovery fails when needed | Monthly PITR drill |
| InnoDB log file too small | Constant flushing, slow writes | Increase innodb_log_file_size |
| full_page_writes = off | Torn pages after crash | Never disable |
| Not monitoring replication lag | Undetected data divergence | Alert on lag > acceptable RPO |
| No base backup schedule | PITR impossible | Weekly base backups + continuous WAL |

---

## Real-world Examples

### PostgreSQL WAL
- pg_wal directory stores WAL segments (16MB each)
- Streaming replication via WAL for read replicas
- pgBackRest for enterprise WAL archiving and PITR

### MySQL InnoDB Redo Log
- Circular redo log with configurable size
- Doublewrite buffer for torn page protection
- binlog (separate from redo log) for replication

### SQLite WAL Mode
- WAL mode enables concurrent readers during writes
- Checkpoint merges WAL into main database file
- Single-file WAL for embedded database

---

## Enforcement Checklist

- [ ] fsync = on (NEVER disabled in production)
- [ ] full_page_writes = on (PostgreSQL) / doublewrite enabled (InnoDB)
- [ ] WAL archiving configured for disaster recovery
- [ ] PITR tested and recovery time validated
- [ ] Checkpoint interval tuned for workload
- [ ] WAL size limits configured (max_wal_size / innodb_log_file_size)
- [ ] Synchronous_commit appropriate per data criticality
- [ ] Replication lag monitored with alerting
- [ ] WAL disk I/O separated from data disk (if possible)
- [ ] Recovery procedure documented and tested quarterly
