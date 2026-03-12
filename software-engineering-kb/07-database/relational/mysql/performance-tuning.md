# MySQL Performance Tuning

> **Domain:** Database > Relational > MySQL
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

MySQL's default configuration allocates 128 MB to the InnoDB buffer pool — on a server with 64 GB RAM, that is 0.2% utilization. Proper tuning of the buffer pool, query cache, thread pool, and InnoDB settings can improve throughput by 10-50x. Beyond configuration, understanding InnoDB's locking behavior, the optimizer's quirks, and connection management patterns is critical for applications handling thousands of transactions per second. MySQL tuning differs significantly from PostgreSQL — different MVCC model, different memory architecture, different index structures.

---

## How It Works

### Memory Configuration

```
┌──────────────────────────────────────────────────────────┐
│                    Server: 64 GB RAM                      │
│                                                           │
│  ┌──────────────────────────────┐  ┌───────────────────┐ │
│  │  innodb_buffer_pool_size     │  │  OS Page Cache     │ │
│  │  48 GB (75%)                 │  │  ~10 GB            │ │
│  │                              │  │                     │ │
│  │  Data pages + Index pages    │  │  OS file cache     │ │
│  │  Undo pages + Change buffer  │  │                     │ │
│  │  Adaptive hash index         │  │                     │ │
│  └──────────────────────────────┘  └───────────────────┘ │
│                                                           │
│  ┌──────────────────────────────┐  ┌───────────────────┐ │
│  │  Per-thread memory           │  │  InnoDB Log Buffer │ │
│  │  sort_buffer_size × threads  │  │  64 MB             │ │
│  │  join_buffer_size × threads  │  │                     │ │
│  │  read_buffer_size × threads  │  │  Redo log buffer   │ │
│  └──────────────────────────────┘  └───────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### Critical MySQL Parameters

| Parameter | Default | Production Setting | Notes |
|-----------|---------|-------------------|-------|
| `innodb_buffer_pool_size` | 128 MB | 70-80% of RAM | Single most important setting |
| `innodb_buffer_pool_instances` | 8 (or 1 if <1GB) | 8-16 | Reduces contention |
| `innodb_log_file_size` | 48 MB | 1-2 GB | Larger = less frequent checkpoints |
| `innodb_log_buffer_size` | 16 MB | 64 MB | Buffer for redo log writes |
| `innodb_flush_log_at_trx_commit` | 1 | 1 (safest) or 2 (faster) | Durability vs performance |
| `innodb_flush_method` | fsync | O_DIRECT | Avoid double buffering |
| `innodb_io_capacity` | 200 | 2000-20000 (SSD) | I/O operations per second |
| `innodb_io_capacity_max` | 2000 | 4000-40000 (SSD) | Max burst I/O |
| `sort_buffer_size` | 256 KB | 1-4 MB | Per-thread sort buffer |
| `join_buffer_size` | 256 KB | 1-4 MB | Per-join buffer |
| `max_connections` | 151 | 200-500 | With connection pooling |
| `thread_cache_size` | -1 (auto) | 100 | Cache threads for reuse |
| `table_open_cache` | 4000 | 4000-10000 | Cached open file descriptors |

```sql
-- Check current buffer pool utilization
SELECT
    POOL_ID,
    POOL_SIZE AS pages_total,
    FREE_BUFFERS AS pages_free,
    DATABASE_PAGES AS pages_data,
    ROUND(100 * DATABASE_PAGES / POOL_SIZE, 1) AS data_pct,
    ROUND(100 * OLD_DATABASE_PAGES / POOL_SIZE, 1) AS old_pct
FROM INFORMATION_SCHEMA.INNODB_BUFFER_POOL_STATS;

-- Buffer pool hit ratio (should be > 99%)
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
-- Hit ratio = 1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)

-- Apply settings
SET GLOBAL innodb_buffer_pool_size = 50 * 1024 * 1024 * 1024;  -- 50 GB (dynamic!)
SET GLOBAL sort_buffer_size = 4 * 1024 * 1024;                  -- 4 MB
```

---

### InnoDB Flush Settings

```sql
-- innodb_flush_log_at_trx_commit — THE durability knob
-- 1 = flush redo log to disk on EVERY commit (safest, default)
-- 2 = write to OS cache on commit, flush once per second
-- 0 = write to buffer only, flush once per second

-- For maximum durability (ACID compliant):
SET GLOBAL innodb_flush_log_at_trx_commit = 1;

-- For 2x write performance with slight durability risk:
SET GLOBAL innodb_flush_log_at_trx_commit = 2;
-- Risk: up to 1 second of transactions lost on OS crash
-- Server crash: no data loss (OS cache persists)

-- For non-critical data (logs, analytics):
SET GLOBAL innodb_flush_log_at_trx_commit = 0;
-- Risk: up to 1 second of transactions lost on ANY crash

-- Binary log sync (replication durability)
SET GLOBAL sync_binlog = 1;  -- sync binlog on every commit (safest)
-- sync_binlog = 0: OS decides when to flush (fastest, risk of binlog corruption)
```

---

### Connection Pooling with ProxySQL

```
┌─────────────┐
│ Application │ 1000 connections
│ Servers     │──────────┐
└─────────────┘          │
                         ▼
              ┌──────────────────┐
              │    ProxySQL       │
              │                   │
              │ • Query routing   │
              │ • R/W splitting   │
              │ • Connection pool │
              │ • Query caching   │
              │ • Query rewrite   │
              └────────┬──────────┘
                       │ 50 connections
            ┌──────────┴──────────┐
            ▼                     ▼
     ┌──────────┐          ┌──────────┐
     │  MySQL   │          │  MySQL   │
     │  Primary │          │  Replica │
     │  (R/W)   │          │  (R/O)   │
     └──────────┘          └──────────┘
```

```sql
-- ProxySQL: configure read/write splitting
-- Hostgroup 10 = primary (writes), Hostgroup 20 = replicas (reads)

-- Route SELECT to replicas, everything else to primary
INSERT INTO mysql_query_rules (rule_id, match_digest, destination_hostgroup, apply)
VALUES (1, '^SELECT.*FOR UPDATE', 10, 1),           -- SELECT FOR UPDATE → primary
       (2, '^SELECT', 20, 1),                        -- all other SELECT → replica
       (3, '.*', 10, 1);                             -- everything else → primary

-- Connection pool settings
UPDATE mysql_servers SET max_connections = 100, max_replication_lag = 5
WHERE hostgroup_id = 20;
```

---

### Query Optimization

```sql
-- EXPLAIN FORMAT=TREE (MySQL 8.0.16+) — most readable format
EXPLAIN FORMAT=TREE
SELECT o.id, o.total, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'active'
ORDER BY o.created_at DESC
LIMIT 10;

-- EXPLAIN ANALYZE (MySQL 8.0.18+) — actually executes the query
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 42;

-- Optimizer hints (MySQL 8.0+)
SELECT /*+ INDEX(orders idx_orders_user_status) */
    id, total
FROM orders
WHERE user_id = 42 AND status = 'active';

SELECT /*+ NO_INDEX(orders idx_orders_created) */
    COUNT(*)
FROM orders
WHERE created_at > '2024-01-01';

-- Force index (older syntax, still works)
SELECT * FROM orders FORCE INDEX (idx_orders_user_id)
WHERE user_id = 42;
```

**MySQL optimizer quirks:**

```sql
-- MySQL does NOT support partial indexes
-- Workaround: generated column + index
ALTER TABLE orders ADD COLUMN is_active TINYINT
    GENERATED ALWAYS AS (IF(status = 'active', 1, NULL)) STORED;
CREATE INDEX idx_orders_active ON orders(is_active, created_at);

-- MySQL does NOT support index-only scans for non-covering indexes easily
-- InnoDB secondary index lookup = 2 B+ tree traversals (secondary → PK → data)
-- Covering index avoids second lookup:
CREATE INDEX idx_orders_covering ON orders(user_id, status, total, created_at);
-- All needed columns in index → Index Only Scan

-- MySQL optimizer may choose wrong index
-- Check with:
EXPLAIN FORMAT=JSON SELECT ...;
-- Look for: "possible_keys" vs "key" (which index was chosen)
```

---

### Indexing Specifics

```sql
-- InnoDB index types (all B+ tree based)
-- Primary key = clustered index (data stored in PK order)
-- Secondary index = non-clustered (stores PK value, requires double lookup)

-- Multi-column index (leftmost prefix rule)
CREATE INDEX idx_orders_user_status_date ON orders(user_id, status, created_at);
-- Supports: WHERE user_id = 42
-- Supports: WHERE user_id = 42 AND status = 'active'
-- Supports: WHERE user_id = 42 AND status = 'active' AND created_at > '2024-01-01'
-- Does NOT support: WHERE status = 'active' (skips leftmost column)
-- Does NOT support: WHERE user_id = 42 AND created_at > '2024-01-01'
--   (status skipped — range on created_at not optimized)

-- Prefix index (for long strings — index first N characters only)
CREATE INDEX idx_users_email_prefix ON users(email(20));
-- Smaller index, but cannot be used for covering scans
-- Use for: long VARCHAR columns where first N chars are selective

-- Invisible index (MySQL 8.0+) — test dropping index without actually dropping
ALTER TABLE orders ALTER INDEX idx_orders_old INVISIBLE;
-- Query planner ignores this index
-- Verify no performance regression, then:
DROP INDEX idx_orders_old ON orders;

-- Descending index (MySQL 8.0+)
CREATE INDEX idx_orders_date_desc ON orders(user_id ASC, created_at DESC);
-- Efficient for: ORDER BY user_id ASC, created_at DESC

-- Functional index (MySQL 8.0.13+)
CREATE INDEX idx_users_email_lower ON users((LOWER(email)));
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';
```

---

### Online DDL

```sql
-- MySQL 8.0: most DDL operations are online (no table lock)
-- ALGORITHM=INPLACE: no table copy, allows concurrent DML
ALTER TABLE orders ADD INDEX idx_orders_total (total), ALGORITHM=INPLACE, LOCK=NONE;

-- ALGORITHM=INSTANT (MySQL 8.0.12+): metadata change only, instant
ALTER TABLE orders ADD COLUMN notes TEXT, ALGORITHM=INSTANT;
-- Only works for adding columns at end of table

-- For large tables: use pt-online-schema-change or gh-ost
-- These tools copy data in chunks and swap tables atomically

-- Check DDL progress
SELECT * FROM performance_schema.events_stages_current
WHERE EVENT_NAME LIKE '%alter%';
```

---

### Monitoring

```sql
-- InnoDB engine status (comprehensive)
SHOW ENGINE INNODB STATUS\G

-- Thread and connection statistics
SHOW GLOBAL STATUS LIKE 'Threads%';
-- Threads_connected: current connections
-- Threads_running: actively executing
-- Threads_created: total threads created (high = increase thread_cache_size)

-- Slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- log queries > 1 second
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- Performance Schema: top queries
SELECT
    DIGEST_TEXT,
    COUNT_STAR AS calls,
    ROUND(SUM_TIMER_WAIT / 1e12, 2) AS total_sec,
    ROUND(AVG_TIMER_WAIT / 1e12, 4) AS avg_sec,
    SUM_ROWS_EXAMINED AS rows_examined
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 20;

-- InnoDB metrics
SELECT
    (SELECT VARIABLE_VALUE FROM performance_schema.global_status
     WHERE VARIABLE_NAME = 'Innodb_buffer_pool_read_requests') AS read_requests,
    (SELECT VARIABLE_VALUE FROM performance_schema.global_status
     WHERE VARIABLE_NAME = 'Innodb_buffer_pool_reads') AS disk_reads;

-- Table sizes
SELECT
    table_schema AS db,
    table_name,
    ROUND(data_length / 1024 / 1024, 2) AS data_mb,
    ROUND(index_length / 1024 / 1024, 2) AS index_mb,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb,
    table_rows
FROM information_schema.tables
WHERE table_schema = 'mydb'
ORDER BY data_length + index_length DESC
LIMIT 20;

-- Lock waits
SELECT
    r.trx_id AS waiting_trx,
    r.trx_query AS waiting_query,
    b.trx_id AS blocking_trx,
    b.trx_query AS blocking_query
FROM performance_schema.data_lock_waits w
JOIN information_schema.innodb_trx r ON r.trx_id = w.REQUESTING_ENGINE_TRANSACTION_ID
JOIN information_schema.innodb_trx b ON b.trx_id = w.BLOCKING_ENGINE_TRANSACTION_ID;
```

---

### Performance Tuning Cheat Sheet

```
┌──────────────────────────────────────────────────────┐
│           Quick Tuning by Server RAM                  │
│                                                       │
│  Parameter                    │ 8 GB │ 32 GB │ 128 GB│
│  ────────────────────────────┼──────┼───────┼───────│
│  innodb_buffer_pool_size     │ 5 GB │ 24 GB │  96 GB│
│  innodb_buffer_pool_instances│   4  │    8  │    16 │
│  innodb_log_file_size        │256MB │  1 GB │   2 GB│
│  innodb_log_buffer_size      │ 32MB │ 64 MB │ 128 MB│
│  sort_buffer_size            │ 1 MB │  2 MB │   4 MB│
│  join_buffer_size            │ 1 MB │  2 MB │   4 MB│
│  max_connections             │ 150  │  300  │   500 │
│  table_open_cache            │ 4000 │ 8000  │ 16000 │
│  innodb_io_capacity (SSD)    │ 2000 │ 5000  │ 10000 │
└──────────────────────────────────────────────────────┘

innodb_flush_method = O_DIRECT (Linux, avoid double buffering)
innodb_flush_log_at_trx_commit = 1 (safe) or 2 (fast)
sync_binlog = 1 (safe replication)
```

---

## Best Practices

1. **ALWAYS set innodb_buffer_pool_size to 70-80% of RAM** — single biggest performance impact
2. **ALWAYS use innodb_flush_method = O_DIRECT** on Linux — prevents double buffering
3. **ALWAYS use connection pooling (ProxySQL)** — MySQL handles many connections better than PostgreSQL but still benefits
4. **ALWAYS enable Performance Schema** — essential for query analysis
5. **ALWAYS use covering indexes** for frequent queries — avoid secondary index double-lookup
6. **ALWAYS use invisible indexes** before dropping — test impact safely
7. **ALWAYS use EXPLAIN ANALYZE** (MySQL 8.0.18+) for query optimization
8. **ALWAYS use gh-ost or pt-online-schema-change** for large table DDL
9. **NEVER use MyISAM** — no transactions, no crash recovery, table-level locking
10. **NEVER set innodb_flush_log_at_trx_commit = 0** for financial data — unacceptable durability risk

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Default buffer pool (128 MB) | Low cache hit ratio, excessive disk I/O | Set to 70-80% of RAM |
| innodb_log_file_size too small | Frequent checkpoints, write stalls | Increase to 1-2 GB |
| No slow query log | Cannot identify slow queries | Enable slow_query_log |
| UUID primary key (random) | Page splits, slow inserts, fragmentation | Use AUTO_INCREMENT or ordered UUID |
| Not using covering indexes | Secondary index double-lookup overhead | Include needed columns in index |
| innodb_flush_log_at_trx_commit=0 | Data loss risk on crash | Set to 1 for production |
| No connection pooling | Connection overhead, max_connections hit | Use ProxySQL |
| Ignoring leftmost prefix rule | Composite index not used by optimizer | Reorder index columns |
| ALTER TABLE on large tables | Table locked, downtime | Use gh-ost or pt-osc |
| Not monitoring replication lag | Stale reads from replicas | Monitor Seconds_Behind_Source |

---

## Real-world Examples

### Facebook
- innodb_buffer_pool_size: majority of server RAM
- Custom MyRocks storage engine for write-heavy workloads (50% less storage)
- Online schema change with gh-ost (zero downtime, no triggers)
- ProxySQL for read/write splitting and connection management

### Shopify
- Vitess for horizontal sharding (thousands of MySQL shards)
- ProxySQL for connection pooling and routing
- gh-ost for online schema changes across all shards
- Custom monitoring dashboards for per-shard performance

### Uber
- MySQL Docstore (schemaless document store on MySQL)
- Custom replication monitoring and automated failover
- Careful buffer pool tuning per shard based on working set size

---

## Enforcement Checklist

- [ ] innodb_buffer_pool_size set to 70-80% of RAM
- [ ] innodb_flush_method = O_DIRECT (Linux)
- [ ] innodb_flush_log_at_trx_commit = 1 for critical data
- [ ] innodb_log_file_size >= 1 GB
- [ ] Connection pooling configured (ProxySQL or application)
- [ ] Slow query log enabled with long_query_time ≤ 1s
- [ ] Performance Schema enabled
- [ ] Buffer pool hit ratio monitored (> 99%)
- [ ] Replication lag monitored
- [ ] gh-ost or pt-online-schema-change used for DDL on large tables
- [ ] Covering indexes used for frequent queries
- [ ] InnoDB engine used for all tables
