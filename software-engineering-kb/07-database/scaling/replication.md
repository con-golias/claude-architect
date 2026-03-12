# Database Replication

> **Domain:** Database > Scaling > Replication
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Database replication copies data from one database server to one or more replicas. It serves two critical purposes: high availability (if the primary fails, a replica takes over) and read scaling (distribute read queries across multiple servers). Without replication, a single database server is a single point of failure — one disk failure, one crash, one maintenance window, and your entire application goes down. Every production database must have replication configured. The choice between synchronous and asynchronous replication, the topology (single-leader, multi-leader, leaderless), and the failover mechanism determines your RPO (data loss tolerance) and RTO (downtime tolerance).

---

## How It Works

### Replication Topologies

```
1. Single-Leader (Primary-Replica):
┌──────────┐         ┌──────────┐
│ Primary  │──repl──►│ Replica  │
│ (writes) │         │ (reads)  │
└──────────┘         └──────────┘
                     ┌──────────┐
              ──────►│ Replica  │
                     │ (reads)  │
                     └──────────┘

Writes → primary only
Reads → primary + replicas
Simplest, most common, PostgreSQL/MySQL default

2. Multi-Leader (Active-Active):
┌──────────┐◄──repl──►┌──────────┐
│ Leader A │          │ Leader B │
│ (r/w)    │          │ (r/w)    │
└──────────┘          └──────────┘

Both accept writes → conflict resolution needed
Used for: multi-region, multi-datacenter
Complex: conflict detection + resolution required

3. Leaderless (Peer-to-Peer):
┌──────┐   ┌──────┐   ┌──────┐
│Node A│◄─►│Node B│◄─►│Node C│
│(r/w) │   │(r/w) │   │(r/w) │
└──────┘   └──────┘   └──────┘

Any node accepts reads and writes
Quorum-based: R + W > N
Used by: Cassandra, DynamoDB, Riak
```

---

### PostgreSQL Replication

```
PostgreSQL Replication Types:

1. Streaming Replication (physical):
   • Byte-for-byte WAL stream to replicas
   • Replica is exact copy (same PostgreSQL version)
   • Cannot select tables — entire database cluster
   • Synchronous or asynchronous

2. Logical Replication (logical):
   • Decode WAL into logical changes (INSERT, UPDATE, DELETE)
   • Can select specific tables
   • Can replicate across PostgreSQL versions
   • Can replicate to different schemas
   • Supports bi-directional (with care)
```

```sql
-- PostgreSQL: Configure streaming replication

-- Primary: postgresql.conf
-- wal_level = replica
-- max_wal_senders = 5
-- wal_keep_size = '1GB'        -- retain WAL for slow replicas
-- hot_standby = on               -- allow queries on replicas

-- Primary: create replication user
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'secure-pass';

-- Primary: pg_hba.conf
-- host replication replicator replica-ip/32 scram-sha-256

-- Replica: take base backup and start
-- pg_basebackup -h primary-host -D /data/pg -U replicator -P -R
-- The -R flag creates standby.signal + primary_conninfo

-- Monitor replication status (on primary)
SELECT
    client_addr,
    state,
    sync_state,
    pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS sent_lag_bytes,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;

-- Monitor replication lag (on replica)
SELECT
    CASE WHEN pg_is_in_recovery() THEN
        pg_last_wal_receive_lsn() - pg_last_wal_replay_lsn()
    END AS replication_lag_bytes,
    CASE WHEN pg_is_in_recovery() AND pg_last_xact_replay_timestamp() IS NOT NULL THEN
        EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
    END AS replication_lag_seconds;
```

```sql
-- PostgreSQL: Logical replication

-- Primary: create publication
CREATE PUBLICATION my_pub FOR TABLE users, orders;
-- Or: CREATE PUBLICATION my_pub FOR ALL TABLES;

-- Replica: create subscription
CREATE SUBSCRIPTION my_sub
    CONNECTION 'host=primary-host port=5432 dbname=mydb user=replicator'
    PUBLICATION my_pub;

-- Monitor logical replication
SELECT * FROM pg_stat_subscription;
SELECT * FROM pg_subscription_rel;

-- Advantages of logical over physical:
-- • Select specific tables
-- • Different indexes on replica
-- • Cross-version replication
-- • Trigger execution on replica
-- • Different schemas (add computed columns)
```

---

### MySQL Replication

```sql
-- MySQL: GTID-based replication (recommended)

-- Source (primary): my.cnf
-- server-id = 1
-- log-bin = mysql-bin
-- gtid_mode = ON
-- enforce_gtid_consistency = ON
-- binlog_format = ROW

-- Replica: configure
CHANGE REPLICATION SOURCE TO
    SOURCE_HOST = 'primary-host',
    SOURCE_USER = 'replicator',
    SOURCE_PASSWORD = 'secure-pass',
    SOURCE_AUTO_POSITION = 1,
    SOURCE_SSL = 1;

START REPLICA;

-- Monitor replication
SHOW REPLICA STATUS\G
-- Key fields:
--   Replica_IO_Running: Yes
--   Replica_SQL_Running: Yes
--   Seconds_Behind_Source: 0
--   Retrieved_Gtid_Set: source UUIDs
--   Executed_Gtid_Set: applied GTIDs

-- Semi-synchronous replication (wait for at least 1 replica ACK)
-- Source:
INSTALL PLUGIN rpl_semi_sync_source SONAME 'semisync_source.so';
SET GLOBAL rpl_semi_sync_source_enabled = 1;
SET GLOBAL rpl_semi_sync_source_wait_for_replica_count = 1;
SET GLOBAL rpl_semi_sync_source_timeout = 1000;  -- ms

-- Replica:
INSTALL PLUGIN rpl_semi_sync_replica SONAME 'semisync_replica.so';
SET GLOBAL rpl_semi_sync_replica_enabled = 1;
```

---

### Synchronous vs Asynchronous

```
Asynchronous Replication (default):
┌────────┐  1.write  ┌────────┐  3.replicate  ┌─────────┐
│ Client │─────────►│Primary │──────────────►│ Replica │
│        │◄─────────│        │               │         │
└────────┘  2.ACK    └────────┘               └─────────┘
                     (immediate)

Client gets ACK before replica receives data
✅ Low latency (no network wait)
❌ Data loss on primary failure (RPO > 0)

Synchronous Replication:
┌────────┐  1.write  ┌────────┐  2.replicate  ┌─────────┐
│ Client │─────────►│Primary │──────────────►│ Replica │
│        │          │        │◄──────────────│  ACK    │
│        │◄─────────│  ACK   │  3.replica    └─────────┘
└────────┘  4.ACK    └────────┘   confirms
                     (after replica confirms)

Client gets ACK only after replica confirms
✅ Zero data loss (RPO = 0)
❌ Higher latency (+network round-trip)
❌ Writes blocked if replica is down

Semi-Synchronous:
  Wait for at least 1 of N replicas to ACK
  Balance between durability and availability
  PostgreSQL: synchronous_standby_names = 'FIRST 1 (...)'
  MySQL: rpl_semi_sync_source_wait_for_replica_count = 1
```

---

### Replication Lag

```
Replication Lag: time between write on primary and
                 application on replica

Causes:
  • High write volume (replica can't keep up)
  • Long-running queries on replica (blocks WAL apply)
  • Network latency (cross-region)
  • Large transactions (single huge UPDATE/DELETE)
  • Resource contention on replica (CPU, disk)

Impact:
  • Stale reads from replica
  • Read-after-write inconsistency
  • Monitoring/alerting delay

Mitigation:
┌──────────────────────────────────────────────────┐
│                                                    │
│  1. Read-after-write consistency                  │
│     After write: read from PRIMARY for N seconds  │
│     After delay: route back to replica            │
│                                                    │
│  2. Causal consistency                            │
│     Track LSN of last write per session           │
│     Read from replica only if replica_lsn >= lsn  │
│                                                    │
│  3. Synchronous replication                       │
│     Eliminate lag entirely (at cost of latency)   │
│                                                    │
│  4. Parallel replication                          │
│     MySQL: replica_parallel_workers = 16          │
│     PostgreSQL: max_parallel_workers = 8          │
│     Apply WAL entries in parallel                 │
└──────────────────────────────────────────────────┘
```

```go
// Go — Read-after-write consistency
type ReplicaRouter struct {
    primary  *sql.DB
    replicas []*sql.DB
    // Track per-session write timestamps
    lastWrite sync.Map // sessionID → time.Time
}

func (r *ReplicaRouter) ReadDB(sessionID string) *sql.DB {
    if lastWrite, ok := r.lastWrite.Load(sessionID); ok {
        writeTime := lastWrite.(time.Time)
        // Read from primary if write was within last 2 seconds
        if time.Since(writeTime) < 2*time.Second {
            return r.primary
        }
    }
    // Round-robin across replicas
    return r.replicas[rand.Intn(len(r.replicas))]
}

func (r *ReplicaRouter) WriteDB(sessionID string) *sql.DB {
    r.lastWrite.Store(sessionID, time.Now())
    return r.primary
}
```

```typescript
// TypeScript — LSN-based causal consistency
class CausalConsistencyRouter {
  private primary: Pool;
  private replica: Pool;

  // Track last write LSN per session
  private sessionLSN = new Map<string, string>();

  async write(sessionId: string, query: string, params: unknown[]) {
    const result = await this.primary.query(query, params);

    // Capture current WAL position after write
    const lsnResult = await this.primary.query(
      'SELECT pg_current_wal_lsn() AS lsn'
    );
    this.sessionLSN.set(sessionId, lsnResult.rows[0].lsn);

    return result;
  }

  async read(sessionId: string, query: string, params: unknown[]) {
    const requiredLSN = this.sessionLSN.get(sessionId);

    if (requiredLSN) {
      // Check if replica has caught up
      const replicaLSN = await this.replica.query(
        'SELECT pg_last_wal_replay_lsn() AS lsn'
      );

      if (replicaLSN.rows[0].lsn < requiredLSN) {
        // Replica behind — read from primary
        return this.primary.query(query, params);
      }
    }

    return this.replica.query(query, params);
  }
}
```

---

### Failover & Promotion

```
Failover Process:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  1. Detection: primary is unreachable                 │
│     • Health check failure (TCP, query timeout)       │
│     • Multiple consecutive failures (avoid flapping)  │
│     • Consensus among monitors (avoid split-brain)    │
│                                                        │
│  2. Promotion: select best replica                    │
│     • Least replication lag                           │
│     • Most WAL received                               │
│     • Priority-based selection                        │
│                                                        │
│  3. Reconfiguration:                                  │
│     • Promote replica to primary                      │
│     • Redirect other replicas to new primary          │
│     • Update DNS / proxy / connection strings         │
│                                                        │
│  4. Recovery:                                         │
│     • Rejoin old primary as replica (after repair)    │
│     • Resync data if needed (pg_rewind)              │
│                                                        │
│  Tools:                                                │
│  PostgreSQL: Patroni, pg_auto_failover, repmgr        │
│  MySQL: Orchestrator, MHA, Group Replication           │
│  Managed: RDS Multi-AZ, Aurora, Cloud SQL HA           │
└──────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS configure at least one replica** for production databases — single server = single point of failure
2. **ALWAYS use streaming/physical replication** for HA — simplest, most reliable
3. **ALWAYS monitor replication lag** with alerting — lag > RPO means data loss risk
4. **ALWAYS use automated failover** tools (Patroni, Orchestrator) — manual failover is too slow
5. **ALWAYS implement read-after-write consistency** — prevent stale reads after user writes
6. **ALWAYS use GTID-based replication** for MySQL — simplifies failover and replica management
7. **NEVER write to replicas** — replicas are read-only (except multi-leader)
8. **NEVER rely on async replication for zero RPO** — use synchronous for critical data
9. **NEVER skip failover testing** — untested failover = broken failover
10. **NEVER ignore replication lag trends** — increasing lag indicates capacity problem

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No replication | Single point of failure, downtime on crash | Configure at least 1 replica |
| No replication lag monitoring | Undetected stale reads, data loss risk | Alert on lag > threshold |
| No automated failover | Minutes of downtime on primary failure | Deploy Patroni/Orchestrator |
| Async assumed as zero RPO | Data loss on primary failure | Use sync replication for critical data |
| Reading from replica after write | Stale data shown to user | Read-after-write from primary |
| Not testing failover | Failover fails when needed | Monthly failover drills |
| Replica overloaded with queries | Replication lag increases | Add more replicas, balance load |
| Statement-based replication (MySQL) | Non-deterministic results | Use ROW-based binlog format |
| No fencing during failover | Split-brain, two primaries | Use STONITH or consensus-based failover |

---

## Real-world Examples

### GitHub (MySQL)
- Orchestrator for automated MySQL failover
- Multiple read replicas per primary
- Vitess for sharding + replication management

### Shopify (MySQL)
- ProxySQL for read/write splitting
- Semi-synchronous replication for durability
- Automated failover with custom tooling

### GitLab (PostgreSQL)
- Patroni for PostgreSQL HA
- Multiple replicas for read scaling
- PgBouncer for connection pooling

---

## Enforcement Checklist

- [ ] At least 1 replica configured for every production database
- [ ] Replication lag monitored with alerting (threshold defined)
- [ ] Automated failover tool deployed (Patroni/Orchestrator)
- [ ] Synchronous replication for zero-RPO requirements
- [ ] Read-after-write consistency implemented in application
- [ ] GTID enabled (MySQL) for reliable failover
- [ ] Failover tested monthly
- [ ] Replica capacity sufficient for read workload
- [ ] Split-brain prevention mechanism in place
- [ ] Old primary rejoining process documented
