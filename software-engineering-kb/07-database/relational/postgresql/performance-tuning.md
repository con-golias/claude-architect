# PostgreSQL Performance Tuning

> **Domain:** Database > Relational > PostgreSQL
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

PostgreSQL's default configuration is designed to run on a laptop — not a production server. Out of the box, shared_buffers is 128MB, work_mem is 4MB, and effective_cache_size is 4GB. On a server with 64GB RAM, PostgreSQL is using less than 1% of available memory. Proper tuning can improve query performance by 10-100x without changing a single line of application code. Beyond memory configuration, understanding connection pooling, query optimization, table maintenance, and monitoring separates databases that serve 1000 req/s from those that serve 100,000 req/s.

---

## How It Works

### Memory Configuration

```
┌─────────────────────────────────────────────────────────┐
│                    Server: 64 GB RAM                     │
│                                                          │
│  ┌────────────────────────┐  ┌────────────────────┐     │
│  │   shared_buffers       │  │  OS Page Cache      │     │
│  │   16 GB (25%)          │  │  ~32 GB (50%)       │     │
│  │                        │  │                      │     │
│  │  PostgreSQL buffer     │  │  OS caches disk      │     │
│  │  pool — caches pages   │  │  reads automatically │     │
│  │  read from disk        │  │  (double buffering)  │     │
│  └────────────────────────┘  └────────────────────┘     │
│                                                          │
│  ┌────────────────────────┐  ┌────────────────────┐     │
│  │  Per-connection memory │  │  maintenance_       │     │
│  │  work_mem × sorts ×   │  │  work_mem           │     │
│  │  connections           │  │  1 GB               │     │
│  │  64MB × 4 × 100       │  │                      │     │
│  │  = up to 25 GB!       │  │  VACUUM, CREATE      │     │
│  │  (worst case)          │  │  INDEX operations    │     │
│  └────────────────────────┘  └────────────────────┘     │
│                                                          │
│  effective_cache_size = 48 GB (75%)                     │
│  (tells planner how much total cache is available)       │
└─────────────────────────────────────────────────────────┘
```

#### Critical Memory Parameters

| Parameter | Default | Production Setting | Notes |
|-----------|---------|-------------------|-------|
| `shared_buffers` | 128 MB | 25% of RAM (16 GB for 64 GB) | PostgreSQL buffer cache |
| `effective_cache_size` | 4 GB | 75% of RAM (48 GB for 64 GB) | Planner hint (not allocation) |
| `work_mem` | 4 MB | 32-256 MB | Per sort/hash operation |
| `maintenance_work_mem` | 64 MB | 1-2 GB | VACUUM, CREATE INDEX |
| `wal_buffers` | -1 (auto) | 64 MB | WAL write buffer |
| `huge_pages` | try | on (Linux) | 2 MB pages reduce TLB misses |
| `temp_buffers` | 8 MB | 32-64 MB | Per-session temp table cache |

```sql
-- Check current settings
SHOW shared_buffers;
SHOW work_mem;
SHOW effective_cache_size;

-- Set per-session (for complex queries)
SET work_mem = '256MB';

-- Set per-transaction
SET LOCAL work_mem = '256MB';

-- Apply changes in postgresql.conf
ALTER SYSTEM SET shared_buffers = '16GB';
ALTER SYSTEM SET effective_cache_size = '48GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';
-- Requires restart for shared_buffers; reload for others:
SELECT pg_reload_conf();
```

**work_mem sizing rule:**

```
Total work_mem budget = Available RAM - shared_buffers - OS needs
Per-connection work_mem = budget / (max_connections × avg_sorts_per_query)

Example: 64 GB server, 16 GB shared_buffers, 16 GB OS = 32 GB available
         32 GB / (200 connections × 4 sorts) = 40 MB per sort
         Set work_mem = 32MB-64MB
```

**Warning:** work_mem is allocated PER SORT OPERATION, not per connection. A single query with 5 JOINs using hash joins can allocate 5 × work_mem.

---

### Connection Pooling with PgBouncer

```
Without pooling:                    With PgBouncer:
┌────────┐                         ┌────────┐
│ App ×  │ 1000 connections        │ App ×  │ 1000 connections
│ 1000   │─────────────────┐       │ 1000   │──────┐
└────────┘                 │       └────────┘      │
                           ▼                        ▼
                    ┌──────────┐            ┌──────────┐
                    │PostgreSQL│            │PgBouncer │ 1000 → 50
                    │ 1000     │            │          │ connections
                    │ backends │            └────┬─────┘
                    │ × 10 MB  │                 │ 50 connections
                    │ = 10 GB! │                 ▼
                    └──────────┘           ┌──────────┐
                                           │PostgreSQL│
                                           │ 50       │
                                           │ backends │
                                           │ × 10 MB  │
                                           │ = 500 MB │
                                           └──────────┘
```

```ini
;; pgbouncer.ini
[databases]
myapp = host=localhost port=5432 dbname=myapp

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

; Pool mode: transaction (recommended for most apps)
pool_mode = transaction

; Pool sizing
default_pool_size = 25        ; connections per user/db pair
max_client_conn = 1000        ; max client connections to PgBouncer
min_pool_size = 5             ; keep this many connections open
reserve_pool_size = 5         ; extra connections for bursts
reserve_pool_timeout = 3      ; seconds before using reserve pool

; Timeouts
server_idle_timeout = 600     ; close idle server connection after 10min
client_idle_timeout = 0       ; no client idle timeout
query_timeout = 30            ; kill queries after 30s
client_login_timeout = 60     ; connection setup timeout

; Limits
max_db_connections = 50       ; max connections to PostgreSQL
```

**Pool modes:**

| Mode | How It Works | Use Case | Limitations |
|------|-------------|----------|-------------|
| **session** | 1:1 client:server for session duration | LISTEN/NOTIFY, prepared statements | Least connection saving |
| **transaction** | Server returned to pool after each TX | Most web applications | No session-level features |
| **statement** | Server returned after each statement | Simple single-query workloads | No multi-statement transactions |

---

### Query Optimization Workflow

```
Step 1: Identify slow queries
    ↓
Step 2: EXPLAIN ANALYZE the query
    ↓
Step 3: Identify bottleneck (seq scan? sort? hash join?)
    ↓
Step 4: Create or modify index
    ↓
Step 5: Verify improvement with EXPLAIN ANALYZE
    ↓
Step 6: Monitor in production
```

#### Step 1: Find Slow Queries

```sql
-- pg_stat_statements: top queries by total time
SELECT
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 2) AS mean_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct,
    LEFT(query, 100) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Queries by mean execution time (individually slow)
SELECT
    calls,
    round(mean_exec_time::numeric, 2) AS mean_ms,
    round(max_exec_time::numeric, 2) AS max_ms,
    LEFT(query, 100) AS query
FROM pg_stat_statements
WHERE calls > 10  -- ignore rarely-run queries
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();

-- Currently running long queries
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > INTERVAL '5 seconds'
ORDER BY duration DESC;
```

#### Step 2-5: Analyze and Optimize

```sql
-- Full analysis with buffers and timing
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT p.name, c.name AS category, p.price
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.status = 'active'
  AND p.price > 100
ORDER BY p.price DESC
LIMIT 20;
```

**EXPLAIN red flags:**

| Red Flag | Meaning | Fix |
|----------|---------|-----|
| `Seq Scan` on large table | No usable index | Create appropriate index |
| `Sort` with high cost | Sorting not covered by index | Add index matching ORDER BY |
| `Hash Join` on large result | Large hash table in memory | Ensure join columns indexed |
| `Rows Removed by Filter: 99999` | Index not selective enough | Better index or partial index |
| `Buffers: shared read` (high) | Many disk reads | Increase shared_buffers or add index |
| `actual rows` ≫ `estimated rows` | Stale statistics | Run ANALYZE on table |
| `Nested Loop` with high loops | N+1 at database level | Rewrite query, add index |

```sql
-- Force planner to show different plans (debugging only)
SET enable_seqscan = off;   -- force index usage
SET enable_nestloop = off;  -- force hash/merge join

-- Remember to reset after testing
RESET enable_seqscan;
RESET enable_nestloop;

-- Update statistics for accurate planning
ANALYZE products;           -- single table
ANALYZE;                    -- all tables
```

---

### Parallelism Configuration

```sql
-- Parallel query settings
SHOW max_parallel_workers_per_gather;  -- default 2
SHOW max_parallel_workers;             -- default 8
SHOW max_worker_processes;             -- default 8
SHOW parallel_tuple_cost;              -- default 0.1
SHOW min_parallel_table_scan_size;     -- default 8MB

-- Increase parallelism for reporting workloads
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 16;
ALTER SYSTEM SET max_worker_processes = 16;

-- Per-query parallelism
SET max_parallel_workers_per_gather = 8;
-- Useful for complex reports/aggregations

-- Parallel-safe operations:
-- ✅ Seq Scan, Index Scan, Bitmap Heap Scan
-- ✅ Hash Join, Merge Join, Nested Loop
-- ✅ Aggregation (Partial → Finalize)
-- ❌ Common Table Expressions (CTEs before PG 12)
-- ❌ Functions marked PARALLEL UNSAFE
```

---

### WAL & Checkpoint Tuning

```sql
-- WAL settings for write-heavy workloads
ALTER SYSTEM SET wal_level = 'replica';           -- or 'logical' for CDC
ALTER SYSTEM SET max_wal_size = '4GB';            -- before forced checkpoint (default 1GB)
ALTER SYSTEM SET min_wal_size = '1GB';            -- minimum WAL retention
ALTER SYSTEM SET checkpoint_timeout = '15min';     -- max time between checkpoints
ALTER SYSTEM SET checkpoint_completion_target = 0.9; -- spread checkpoint over 90% of interval

-- Synchronous commit options
ALTER SYSTEM SET synchronous_commit = 'on';       -- default: safest
-- 'on'             Full durability (WAL flushed to disk on commit)
-- 'remote_apply'   WAL applied on standby before commit returns
-- 'remote_write'   WAL written (not flushed) on standby
-- 'local'          Local disk flush only (async replication)
-- 'off'            No flush guarantee (fastest, risk of recent TX loss on crash)

-- Per-transaction commit mode (for non-critical writes)
SET LOCAL synchronous_commit = 'off';
INSERT INTO page_views (url, viewed_at) VALUES ('/home', NOW());
-- Acceptable to lose last few page views on crash
```

---

### Table Maintenance

```sql
-- Autovacuum tuning for different table types

-- High-churn tables (many UPDATE/DELETE)
ALTER TABLE sessions SET (
    autovacuum_vacuum_scale_factor = 0.01,     -- vacuum at 1% dead tuples
    autovacuum_vacuum_threshold = 100,
    autovacuum_analyze_scale_factor = 0.01,
    autovacuum_vacuum_cost_delay = 2           -- be aggressive
);

-- Append-only tables (INSERT only)
ALTER TABLE audit_logs SET (
    autovacuum_vacuum_scale_factor = 0.2,      -- default is fine
    autovacuum_analyze_scale_factor = 0.1,     -- analyze more often for planner
    autovacuum_freeze_max_age = 500000000      -- prevent wraparound earlier
);

-- Transaction ID wraparound prevention
SELECT datname,
       age(datfrozenxid) AS xid_age,
       current_setting('autovacuum_freeze_max_age')::int AS freeze_max,
       ROUND(100.0 * age(datfrozenxid) /
             current_setting('autovacuum_freeze_max_age')::int, 1) AS pct
FROM pg_database
ORDER BY age(datfrozenxid) DESC;
-- Alert when pct > 50%

-- Table bloat check
WITH constants AS (
    SELECT current_setting('block_size')::numeric AS bs
),
table_stats AS (
    SELECT
        schemaname || '.' || relname AS table_name,
        pg_relation_size(relid) AS table_bytes,
        n_live_tup,
        n_dead_tup,
        COALESCE(n_dead_tup, 0)::float /
            NULLIF(n_live_tup + n_dead_tup, 0) AS dead_ratio
    FROM pg_stat_user_tables
)
SELECT table_name,
       pg_size_pretty(table_bytes) AS size,
       n_live_tup, n_dead_tup,
       ROUND(dead_ratio * 100, 1) AS dead_pct
FROM table_stats
WHERE dead_ratio > 0.1  -- more than 10% dead tuples
ORDER BY dead_ratio DESC;
```

---

### OS & Hardware Tuning (Linux)

```bash
# /etc/sysctl.conf — kernel parameters for PostgreSQL

# Shared memory (for shared_buffers)
kernel.shmmax = 17179869184        # 16 GB (match shared_buffers)
kernel.shmall = 4194304            # shmmax / PAGE_SIZE

# Huge pages (2 MB pages reduce TLB misses)
vm.nr_hugepages = 8192            # 8192 × 2 MB = 16 GB

# I/O scheduler (for SSDs)
# echo 'none' > /sys/block/sda/queue/scheduler

# Swappiness (prevent swapping PostgreSQL)
vm.swappiness = 1                 # almost never swap

# Dirty page writeback
vm.dirty_ratio = 10               # start writeback at 10% dirty
vm.dirty_background_ratio = 3     # background writeback at 3%

# Network buffers (for many connections)
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
```

```sql
-- Filesystem recommendations:
-- ext4 or XFS (XFS preferred for large databases)
-- Mount with: noatime,nodiratime,nobarrier (if UPS/battery-backed cache)

-- Disk layout:
-- SSD for WAL (pg_wal/) — sequential writes, low latency critical
-- SSD for data (base/) — random reads
-- Separate disk for pg_wal and base if possible
```

---

### Monitoring Queries

```sql
-- Cache hit ratio (should be > 99%)
SELECT
    sum(heap_blks_read) AS heap_read,
    sum(heap_blks_hit) AS heap_hit,
    ROUND(sum(heap_blks_hit)::numeric /
          NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2) AS hit_ratio
FROM pg_statio_user_tables;

-- Index usage ratio per table
SELECT
    schemaname || '.' || relname AS table,
    seq_scan, idx_scan,
    ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS idx_pct,
    n_live_tup AS rows
FROM pg_stat_user_tables
WHERE n_live_tup > 10000  -- ignore tiny tables
ORDER BY idx_pct ASC NULLS FIRST;
-- Tables with low idx_pct may need indexes

-- Lock waits
SELECT
    blocked.pid AS blocked_pid,
    blocked.query AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.query AS blocking_query,
    NOW() - blocked.query_start AS wait_duration
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid
JOIN pg_locks blk ON blk.locktype = bl.locktype
    AND blk.database IS NOT DISTINCT FROM bl.database
    AND blk.relation IS NOT DISTINCT FROM bl.relation
    AND blk.page IS NOT DISTINCT FROM bl.page
    AND blk.tuple IS NOT DISTINCT FROM bl.tuple
    AND blk.transactionid IS NOT DISTINCT FROM bl.transactionid
    AND blk.pid <> bl.pid
JOIN pg_stat_activity blocking ON blocking.pid = blk.pid
WHERE NOT bl.granted;

-- Connection state distribution
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- Database size growth
SELECT datname,
       pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
ORDER BY pg_database_size(datname) DESC;

-- Replication lag (on primary)
SELECT client_addr,
       state,
       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_lag
FROM pg_stat_replication;
```

---

### Performance Tuning Cheat Sheet

```
┌─────────────────────────────────────────────────────┐
│            Quick Tuning by Server RAM                │
│                                                      │
│  Parameter              │ 4 GB │ 16 GB │  64 GB    │
│  ───────────────────────┼──────┼───────┼───────────│
│  shared_buffers         │ 1 GB │  4 GB │   16 GB   │
│  effective_cache_size   │ 3 GB │ 12 GB │   48 GB   │
│  work_mem               │ 8 MB │ 32 MB │   64 MB   │
│  maintenance_work_mem   │256MB │  1 GB │    2 GB   │
│  max_connections        │ 100  │  200  │    300    │
│  max_parallel_workers   │  4   │   8   │    16     │
│  max_wal_size           │ 1 GB │  2 GB │    4 GB   │
│  random_page_cost       │ 1.1  │  1.1  │    1.1    │
│  (SSD)                  │      │       │           │
└─────────────────────────────────────────────────────┘

For SSDs: set random_page_cost = 1.1 (default 4.0 is for spinning disks)
For SSDs: set effective_io_concurrency = 200 (default 1)
```

---

## Best Practices

1. **ALWAYS use PgBouncer in transaction mode** for web applications — reduce connection overhead
2. **ALWAYS set shared_buffers to 25% of RAM** — never leave at default 128 MB
3. **ALWAYS set random_page_cost = 1.1 for SSDs** — default 4.0 penalizes index scans unfairly
4. **ALWAYS enable pg_stat_statements** — the most important extension for performance
5. **ALWAYS tune autovacuum per-table** for high-churn tables — default is too conservative
6. **ALWAYS run ANALYZE after bulk operations** — stale statistics cause bad query plans
7. **ALWAYS monitor cache hit ratio** — should be > 99%, investigate if lower
8. **ALWAYS set statement_timeout** per role — prevent runaway queries
9. **NEVER increase max_connections beyond 300** without connection pooling — use PgBouncer
10. **NEVER set work_mem too high globally** — it is per-sort, not per-connection

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Default shared_buffers (128 MB) | Low cache hit ratio, excessive disk reads | Set to 25% of RAM |
| random_page_cost = 4.0 on SSD | Planner avoids index scans | Set to 1.1 for SSD |
| No connection pooling | "too many connections", OOM | Use PgBouncer |
| work_mem too high globally | OOM under concurrent load | Set conservatively, override per-query |
| No pg_stat_statements | Cannot find slow queries | Install and query regularly |
| Stale statistics | Bad query plans (wrong row estimates) | Run ANALYZE, tune autovacuum |
| No statement_timeout | Runaway queries consume resources | Set per-role timeout |
| VACUUM FULL on production table | Exclusive lock blocks all access | Use pg_repack instead |
| Ignoring checkpoint warnings | WAL segments accumulate, disk full | Tune max_wal_size and checkpoint_timeout |
| No monitoring | Problems discovered by users, not alerts | Monitor hit ratio, locks, replication |

---

## Real-world Examples

### Instagram
- PgBouncer with 5000+ client connections → 100 PostgreSQL connections
- shared_buffers tuned per shard (hundreds of PostgreSQL instances)
- Custom pg_stat_statements analysis for query optimization
- Per-table autovacuum tuning for user activity tables

### GitLab
- Detailed PostgreSQL tuning documentation for self-hosted instances
- Connection pooling via PgBouncer in transaction mode
- Query optimization program tracking pg_stat_statements weekly
- Partitioned CI/CD tables with aggressive autovacuum

### Render / Neon / Supabase (Managed PostgreSQL)
- Auto-tuning based on instance size (shared_buffers, work_mem)
- Built-in connection pooling (PgBouncer or custom)
- Automatic autovacuum monitoring and alerting
- Query performance insights from pg_stat_statements

---

## Enforcement Checklist

- [ ] shared_buffers set to 25% of RAM
- [ ] effective_cache_size set to 75% of RAM
- [ ] work_mem sized based on connections × sorts calculation
- [ ] maintenance_work_mem set to 1-2 GB
- [ ] random_page_cost = 1.1 for SSD storage
- [ ] effective_io_concurrency = 200 for SSD
- [ ] PgBouncer configured in transaction mode
- [ ] pg_stat_statements installed and monitored
- [ ] statement_timeout set per role
- [ ] Autovacuum tuned for high-churn tables
- [ ] Cache hit ratio monitored (> 99%)
- [ ] Connection count monitored with alerting
- [ ] Lock waits monitored
- [ ] Replication lag monitored
- [ ] Checkpoint frequency tuned (max_wal_size, checkpoint_timeout)
- [ ] huge_pages enabled on Linux
