# Database Configuration Tuning

> **Domain:** Performance > Database Performance > Configuration Tuning
> **Importance:** CRITICAL
> **Perspective:** Parameter sizing, measurement, workload-specific optimization
> **Cross-ref:** 07-database/relational/postgresql/performance-tuning.md, 07-database/relational/mysql/performance-tuning.md

## PostgreSQL Memory Configuration

### Core Parameters

```
┌──────────────────────────────────────────────────────────────┐
│ Parameter             │ Formula              │ Why           │
├───────────────────────┼──────────────────────┼───────────────┤
│ shared_buffers        │ 25% of RAM           │ PG buffer     │
│                       │ (max ~32GB useful)   │ cache for     │
│                       │                      │ table/index   │
│                       │                      │ pages         │
├───────────────────────┼──────────────────────┼───────────────┤
│ effective_cache_size  │ 75% of RAM           │ Planner hint  │
│                       │                      │ (not alloc)   │
│                       │                      │ tells planner │
│                       │                      │ about OS cache│
├───────────────────────┼──────────────────────┼───────────────┤
│ work_mem              │ RAM / (conns * sorts) │ Per sort/hash │
│                       │ typically 32-256MB   │ operation     │
│                       │                      │ NOT per conn  │
├───────────────────────┼──────────────────────┼───────────────┤
│ maintenance_work_mem  │ 1-2GB                │ VACUUM, INDEX │
│                       │                      │ CREATE, ALTER │
├───────────────────────┼──────────────────────┼───────────────┤
│ wal_buffers           │ 64MB (or auto)       │ WAL write     │
│                       │                      │ buffer size   │
└───────────────────────┴──────────────────────┴───────────────┘
```

### Sizing by Server RAM

```sql
-- 16 GB Server (small production)
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET wal_buffers = '64MB';

-- 64 GB Server (standard production)
ALTER SYSTEM SET shared_buffers = '16GB';
ALTER SYSTEM SET effective_cache_size = '48GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';
ALTER SYSTEM SET wal_buffers = '64MB';

-- 256 GB Server (large production)
ALTER SYSTEM SET shared_buffers = '32GB';  -- cap at 32GB (diminishing returns)
ALTER SYSTEM SET effective_cache_size = '192GB';
ALTER SYSTEM SET work_mem = '128MB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';
ALTER SYSTEM SET wal_buffers = '64MB';

-- After changes: restart for shared_buffers, reload for others
-- SELECT pg_reload_conf(); -- for non-restart params
```

### work_mem Deep Dive

```sql
-- work_mem is per-SORT-OPERATION, not per-connection
-- A single query with 5 hash joins can use 5 * work_mem

-- Safe calculation:
-- Available = RAM - shared_buffers - OS_reserved
-- work_mem = Available / (max_connections * avg_sorts_per_query)
-- Example: (64GB - 16GB - 16GB) / (200 * 4) = 40MB

-- Monitor if work_mem is too low (disk sorts)
SELECT query, temp_blks_read, temp_blks_written
FROM pg_stat_statements
WHERE temp_blks_written > 0
ORDER BY temp_blks_written DESC LIMIT 10;
-- temp_blks > 0 means sort spilled to disk → increase work_mem

-- Per-session override for complex queries
SET LOCAL work_mem = '256MB';  -- only for current transaction
EXPLAIN ANALYZE SELECT ... GROUP BY ... ORDER BY ...;
RESET work_mem;

-- Log when sorts spill to disk
ALTER SYSTEM SET log_temp_files = 0;  -- log ALL temp file usage
SELECT pg_reload_conf();
```

### SSD-Specific Parameters

```sql
-- CRITICAL: default values assume spinning disks
ALTER SYSTEM SET random_page_cost = 1.1;          -- default 4.0 (HDD)
ALTER SYSTEM SET effective_io_concurrency = 200;   -- default 1 (HDD)
ALTER SYSTEM SET seq_page_cost = 1.0;              -- keep at 1.0

-- Impact: planner correctly prefers index scans on SSD
-- Without this: planner overestimates random I/O cost, avoids indexes
```

## MySQL InnoDB Configuration

### Core Parameters

```sql
-- innodb_buffer_pool_size: THE most important MySQL parameter
-- Set to 70-80% of RAM (MySQL manages its own cache, unlike PG)
SET GLOBAL innodb_buffer_pool_size = 50 * 1024 * 1024 * 1024; -- 50GB (dynamic!)

-- Buffer pool instances (reduce contention on multi-core)
-- my.cnf: innodb_buffer_pool_instances = 8  (requires restart)
-- Rule: 1 instance per 1-2GB of buffer pool, max 16

-- innodb_log_file_size: redo log size
-- Larger = fewer checkpoints = better write performance
-- my.cnf: innodb_log_file_size = 2G  (requires restart)
-- Trade-off: larger log = longer crash recovery

-- innodb_log_buffer_size: buffer before writing redo log to disk
SET GLOBAL innodb_log_buffer_size = 64 * 1024 * 1024; -- 64MB

-- Flush behavior
SET GLOBAL innodb_flush_log_at_trx_commit = 1; -- safest (ACID)
-- 1 = flush on every commit (safest, slowest)
-- 2 = write to OS cache on commit, flush every 1s (2x faster)
-- 0 = buffer only, flush every 1s (fastest, risk 1s data loss)

SET GLOBAL innodb_flush_method = 'O_DIRECT'; -- avoid double buffering on Linux
```

### MySQL SSD Tuning

```sql
-- I/O capacity: tell InnoDB about SSD throughput
SET GLOBAL innodb_io_capacity = 5000;       -- background I/O ops/sec
SET GLOBAL innodb_io_capacity_max = 10000;  -- burst I/O ops/sec
-- Default 200/2000 is for spinning disks; SSD can handle 5000-20000

-- Read-ahead: prefetch for sequential scans
SET GLOBAL innodb_read_ahead_threshold = 56; -- default 56 (pages)

-- Per-thread buffers (multiply by max_connections for total)
SET GLOBAL sort_buffer_size = 2 * 1024 * 1024;   -- 2MB per sort
SET GLOBAL join_buffer_size = 2 * 1024 * 1024;    -- 2MB per join
SET GLOBAL read_buffer_size = 1 * 1024 * 1024;    -- 1MB seq reads
-- Keep these small: total = value * max_connections * operations_per_query
```

### MySQL Query Cache (Deprecated in 8.0)

```sql
-- MySQL 5.7: query cache (REMOVED in MySQL 8.0)
-- If still on 5.7: disable it for write-heavy workloads
SET GLOBAL query_cache_type = 0;
SET GLOBAL query_cache_size = 0;
-- Query cache serializes all queries, becomes bottleneck at >100 QPS
-- Use application-level caching (Redis) instead
```

## Autovacuum Tuning (PostgreSQL)

```sql
-- Default autovacuum is too conservative for high-churn tables
-- Global defaults
ALTER SYSTEM SET autovacuum_max_workers = 6;          -- default 3
ALTER SYSTEM SET autovacuum_naptime = '15s';           -- default 1min
ALTER SYSTEM SET autovacuum_vacuum_cost_delay = '2ms'; -- default 2ms (keep)

-- Per-table tuning for high-update tables
ALTER TABLE user_sessions SET (
    autovacuum_vacuum_scale_factor = 0.01,     -- vacuum at 1% dead rows (default 20%)
    autovacuum_vacuum_threshold = 50,          -- minimum 50 dead rows
    autovacuum_analyze_scale_factor = 0.005,   -- analyze at 0.5% changes
    autovacuum_vacuum_cost_delay = 0           -- no throttling for this table
);

-- Per-table for append-only (INSERT-only) tables
ALTER TABLE audit_logs SET (
    autovacuum_vacuum_scale_factor = 0.2,      -- default is fine
    autovacuum_freeze_max_age = 500000000,     -- freeze earlier to prevent wraparound
    autovacuum_analyze_scale_factor = 0.1
);

-- Monitor autovacuum activity
SELECT relname, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
  n_dead_tup, n_live_tup,
  ROUND(100.0 * n_dead_tup / GREATEST(n_live_tup, 1), 1) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

-- Find tables that need more aggressive autovacuum
SELECT relname, n_dead_tup, n_live_tup,
  ROUND(100.0 * n_dead_tup / GREATEST(n_live_tup + n_dead_tup, 1), 1) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
  AND 100.0 * n_dead_tup / GREATEST(n_live_tup + n_dead_tup, 1) > 10
ORDER BY dead_pct DESC;
-- Tables with >10% dead tuples need tighter autovacuum settings
```

### Transaction ID Wraparound Prevention

```sql
-- Monitor XID age (critical: wraparound = forced shutdown)
SELECT datname, age(datfrozenxid) AS xid_age,
  current_setting('autovacuum_freeze_max_age')::bigint AS freeze_max,
  ROUND(100.0 * age(datfrozenxid) /
    current_setting('autovacuum_freeze_max_age')::bigint, 1) AS pct_to_wrap
FROM pg_database ORDER BY xid_age DESC;
-- Alert when pct_to_wrap > 50%
-- Emergency action at > 75%: manual VACUUM FREEZE

-- Per-table XID age
SELECT relname, age(relfrozenxid) AS xid_age
FROM pg_class WHERE relkind = 'r'
ORDER BY age(relfrozenxid) DESC LIMIT 10;
```

## Statistics Collection

```sql
-- PostgreSQL: statistics accuracy
-- default_statistics_target controls histogram bucket count
ALTER SYSTEM SET default_statistics_target = 200; -- default 100, max 10000
-- Higher = more accurate estimates but slower ANALYZE

-- Per-column statistics for skewed data
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;
-- Increase for columns with non-uniform distribution

-- Force statistics refresh
ANALYZE orders;          -- single table
ANALYZE;                 -- all tables

-- Verify statistics accuracy via EXPLAIN
-- If estimated_rows is 10x+ off from actual_rows → run ANALYZE
-- If still inaccurate after ANALYZE → increase statistics target

-- MySQL: histogram statistics (8.0+)
ANALYZE TABLE orders UPDATE HISTOGRAM ON status, region WITH 100 BUCKETS;
-- Helps optimizer with non-uniform distributions
```

## WAL Configuration (PostgreSQL)

```sql
-- WAL sizing (controls checkpoint frequency)
ALTER SYSTEM SET max_wal_size = '4GB';             -- default 1GB
ALTER SYSTEM SET min_wal_size = '1GB';             -- minimum retention
ALTER SYSTEM SET checkpoint_timeout = '15min';      -- default 5min
ALTER SYSTEM SET checkpoint_completion_target = 0.9; -- spread I/O over 90% of interval

-- Write-heavy optimization
ALTER SYSTEM SET wal_compression = 'on';           -- reduce WAL volume 30-50%
ALTER SYSTEM SET wal_level = 'replica';            -- 'logical' if using CDC

-- Commit durability trade-offs
ALTER SYSTEM SET synchronous_commit = 'on';        -- default: full ACID
-- Per-transaction override for non-critical writes:
-- SET LOCAL synchronous_commit = 'off';
-- INSERT INTO analytics_events ...;  -- OK to lose on crash

-- WAL monitoring
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')) AS wal_position;

-- Checkpoint monitoring
SELECT checkpoints_timed, checkpoints_req,
  checkpoint_write_time / 1000 AS write_sec,
  checkpoint_sync_time / 1000 AS sync_sec
FROM pg_stat_bgwriter;
-- checkpoints_req >> checkpoints_timed means max_wal_size is too small
```

## I/O Scheduling (Linux)

```bash
# SSD: use 'none' (noop) or 'mq-deadline' scheduler
echo 'none' > /sys/block/nvme0n1/queue/scheduler

# Kernel tuning for database servers
# /etc/sysctl.conf
vm.swappiness = 1                    # almost never swap
vm.dirty_ratio = 10                  # start writeback at 10% dirty pages
vm.dirty_background_ratio = 3        # background writeback at 3%
vm.overcommit_memory = 2             # prevent OOM killer targeting PG
vm.overcommit_ratio = 90             # allow 90% of RAM allocation

# Huge pages (reduce TLB misses for large shared_buffers)
# Calculate: shared_buffers_bytes / 2MB hugepage_size + margin
# 16GB shared_buffers: 16384 / 2 = 8192 + buffer = 8400
vm.nr_hugepages = 8400

# PostgreSQL: enable huge pages
# ALTER SYSTEM SET huge_pages = 'on';
```

## Memory Allocation Strategy

```
PostgreSQL Memory Budget (64GB server):
┌─────────────────────────────────────────────┐
│ Component              │ Size  │ % of RAM   │
├────────────────────────┼───────┼────────────┤
│ shared_buffers         │ 16 GB │ 25%        │
│ OS page cache          │ 32 GB │ 50%        │
│ work_mem budget        │  8 GB │ 12.5%      │
│ maintenance_work_mem   │  2 GB │ 3%         │
│ OS + PG overhead       │  6 GB │ 9.5%       │
└────────────────────────┴───────┴────────────┘

MySQL Memory Budget (64GB server):
┌─────────────────────────────────────────────┐
│ Component              │ Size  │ % of RAM   │
├────────────────────────┼───────┼────────────┤
│ innodb_buffer_pool     │ 48 GB │ 75%        │
│ OS page cache          │  8 GB │ 12.5%      │
│ Per-thread buffers     │  4 GB │ 6.25%      │
│ InnoDB log buffer      │ 64 MB │ <1%        │
│ OS + MySQL overhead    │  4 GB │ 6.25%      │
└────────────────────────┴───────┴────────────┘

Key difference: MySQL manages most caching itself (buffer_pool = 75%),
PostgreSQL relies heavily on OS page cache (shared_buffers = 25%).
```

## Validation Queries

```sql
-- PostgreSQL: verify configuration is effective
-- Cache hit ratio (must be > 99%)
SELECT ROUND(100.0 * sum(heap_blks_hit) /
  NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_pct
FROM pg_statio_user_tables;

-- Index hit ratio per table
SELECT relname,
  ROUND(100.0 * idx_scan / NULLIF(idx_scan + seq_scan, 0), 1) AS idx_pct
FROM pg_stat_user_tables WHERE n_live_tup > 10000
ORDER BY idx_pct ASC LIMIT 10;

-- Temp file usage (work_mem too low?)
SELECT datname, temp_files, pg_size_pretty(temp_bytes) AS temp_size
FROM pg_stat_database WHERE temp_files > 0;

-- MySQL: validate buffer pool effectiveness
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
-- Hit ratio = 1 - (reads / read_requests) → must be > 0.99
```

---

## 10 Best Practices

1. **Set shared_buffers to 25% of RAM** (PostgreSQL) — never leave at default 128MB.
2. **Set innodb_buffer_pool_size to 75% of RAM** (MySQL) — single biggest tuning lever.
3. **Set random_page_cost = 1.1 on SSD** — default 4.0 penalizes index scans.
4. **Monitor cache hit ratio weekly** — must stay above 99%.
5. **Tune autovacuum per-table** for high-churn tables — default 20% threshold is too high.
6. **Set max_wal_size to 4GB+** for write-heavy workloads — reduces checkpoint frequency.
7. **Enable wal_compression** — reduces WAL volume 30-50% with minimal CPU cost.
8. **Use huge_pages on Linux** — eliminates TLB misses for large shared_buffers.
9. **Monitor temp_files usage** — non-zero means work_mem needs increase.
10. **Set innodb_flush_method = O_DIRECT** on Linux — prevents double buffering.

---

## 8 Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Default memory settings in production | Using <1% of available RAM | Apply sizing formulas per server RAM |
| work_mem too high globally | OOM under concurrent load | Set conservatively, override per-query |
| random_page_cost = 4.0 on SSD | Planner avoids efficient index scans | Set to 1.1 for SSD storage |
| Default autovacuum on high-churn tables | Table bloat, degraded performance | Lower scale_factor to 0.01-0.05 |
| Ignoring XID wraparound age | Forced database shutdown at 2B XIDs | Monitor and alert at 50% of freeze_max |
| innodb_flush_log_at_trx_commit = 0 | Data loss on crash | Use 1 (safe) or 2 (balanced) |
| No temp_files monitoring | Disk sorts silently degrading perf | Log temp_files, increase work_mem |
| Skipping ANALYZE after bulk loads | Stale statistics, bad query plans | Run ANALYZE after every bulk operation |

---

## Enforcement Checklist

- [ ] Memory parameters sized per server RAM (not defaults)
- [ ] SSD parameters configured (random_page_cost, effective_io_concurrency, innodb_io_capacity)
- [ ] Cache hit ratio monitored (>99% PostgreSQL, >99% MySQL buffer pool)
- [ ] Autovacuum tuned per-table for tables with >1000 updates/day
- [ ] XID wraparound age monitored with alerting at 50%
- [ ] WAL/redo log sized for workload (max_wal_size 4GB+, innodb_log_file_size 1-2GB)
- [ ] temp_files/disk sort usage monitored
- [ ] Statistics freshness maintained (ANALYZE after bulk operations)
- [ ] Huge pages enabled on Linux for large shared_buffers
- [ ] All configuration changes documented with justification
