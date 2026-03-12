# Database Memory Management

> **Domain:** Database > Internals > Memory Management
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Database performance is dominated by memory management. A well-tuned database serves 99%+ of requests from memory; a poorly tuned one hits disk constantly and runs 100x slower. Every database allocates memory across competing needs: buffer pool (cache data pages), sort buffers (ORDER BY, GROUP BY), hash tables (JOINs, aggregations), WAL buffers, connection memory, and internal structures. Understanding how these memory areas interact, how to size them, and how to diagnose memory issues is the single most impactful skill for database performance tuning.

---

## How It Works

### Memory Architecture Overview

```
Database Memory Layout:
┌──────────────────────────────────────────────────────┐
│  Total Server RAM: 64 GB                              │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │ OS + Other Processes: ~4 GB              │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │ Shared Memory (all connections share)     │         │
│  │                                           │         │
│  │  ┌────────────────────────┐              │         │
│  │  │ Buffer Pool / Cache    │ 16 GB        │         │
│  │  │ (data + index pages)   │ (25% RAM)    │         │
│  │  └────────────────────────┘              │         │
│  │  ┌────────────────────────┐              │         │
│  │  │ WAL Buffers            │ 64 MB        │         │
│  │  └────────────────────────┘              │         │
│  │  ┌────────────────────────┐              │         │
│  │  │ Lock Table             │ ~128 MB      │         │
│  │  └────────────────────────┘              │         │
│  │  ┌────────────────────────┐              │         │
│  │  │ Catalog Cache          │ varies       │         │
│  │  └────────────────────────┘              │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │ Per-Connection Memory (per session)       │         │
│  │                                           │         │
│  │  ┌────────────────────────┐              │         │
│  │  │ work_mem per sort/hash │ 64 MB each   │         │
│  │  └────────────────────────┘              │         │
│  │  ┌────────────────────────┐              │         │
│  │  │ temp_buffers (temp tbl)│ 8 MB         │         │
│  │  └────────────────────────┘              │         │
│  │  ┌────────────────────────┐              │         │
│  │  │ Stack + overhead       │ ~1-5 MB      │         │
│  │  └────────────────────────┘              │         │
│  │                                           │         │
│  │  × 200 connections = ~4 GB peak          │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │ OS Page Cache: ~40 GB (remaining RAM)     │         │
│  │ PostgreSQL: double-caching with OS cache  │         │
│  │ (shared_buffers stores subset, OS caches  │         │
│  │  the rest of the data files)              │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  DANGER: if shared_mem + (connections × work_mem)     │
│  > available RAM → OOM kill or heavy swapping         │
└──────────────────────────────────────────────────────┘
```

---

### PostgreSQL Memory Configuration

```sql
-- PostgreSQL memory settings
-- postgresql.conf

-- Shared buffer pool (all connections share)
-- shared_buffers = '16GB'  -- 25% of RAM for dedicated DB server
-- PostgreSQL also relies on OS page cache for the rest

-- Per-operation sort/hash memory
-- work_mem = '64MB'  -- per sort/hash operation, NOT per connection
-- DANGER: a single query with 5 sorts uses 5 × work_mem
-- 200 connections × 3 operations × 64MB = 38 GB (potential!)
-- Formula: work_mem = RAM / (max_connections × 3) × 0.5

-- Maintenance operations (VACUUM, CREATE INDEX, ALTER TABLE)
-- maintenance_work_mem = '2GB'  -- can be large (one at a time)

-- WAL buffers
-- wal_buffers = '64MB'  -- default auto (~3% of shared_buffers)

-- Temp table memory
-- temp_buffers = '32MB'  -- per-session temp table cache

-- Effective cache size (tells planner about OS cache)
-- effective_cache_size = '48GB'  -- 75% of RAM (shared_buffers + OS cache)
-- Does NOT allocate memory — only influences query planner decisions
```

```
Memory Sizing Cheat Sheet (PostgreSQL):
┌───────────────────────────────────────────────────┐
│  Server RAM  │ shared_buffers │ work_mem │ eff_cs │
├──────────────┼────────────────┼──────────┼────────┤
│  8 GB        │ 2 GB           │ 16 MB    │ 6 GB   │
│  16 GB       │ 4 GB           │ 32 MB    │ 12 GB  │
│  32 GB       │ 8 GB           │ 64 MB    │ 24 GB  │
│  64 GB       │ 16 GB          │ 128 MB   │ 48 GB  │
│  128 GB      │ 32 GB          │ 256 MB   │ 96 GB  │
│  256 GB      │ 64 GB          │ 256 MB   │ 192 GB │
└───────────────────────────────────────────────────┘
Note: work_mem depends on max_connections × concurrent ops
```

---

### MySQL InnoDB Memory Configuration

```
InnoDB Memory Architecture:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  ┌────────────────────────────────────┐               │
│  │ InnoDB Buffer Pool                 │               │
│  │ (innodb_buffer_pool_size)          │               │
│  │                                     │               │
│  │ Contains:                           │               │
│  │ • Data pages (clustered index)     │               │
│  │ • Index pages (secondary indexes)  │               │
│  │ • Insert buffer (change buffer)    │               │
│  │ • Adaptive hash index             │               │
│  │ • Lock information                │               │
│  │                                     │               │
│  │ Size: 70-80% of server RAM        │               │
│  │ (InnoDB doesn't use OS page cache │               │
│  │  with O_DIRECT, unlike PostgreSQL) │               │
│  └────────────────────────────────────┘               │
│                                                        │
│  ┌────────────────────────────────────┐               │
│  │ InnoDB Log Buffer                  │               │
│  │ (innodb_log_buffer_size): 64-256MB│               │
│  │ Buffers redo log before flush     │               │
│  └────────────────────────────────────┘               │
│                                                        │
│  ┌────────────────────────────────────┐               │
│  │ Per-Connection Memory              │               │
│  │ sort_buffer_size: 256KB-2MB       │               │
│  │ join_buffer_size: 256KB-2MB       │               │
│  │ read_buffer_size: 128KB-1MB       │               │
│  │ × connections                      │               │
│  └────────────────────────────────────┘               │
│                                                        │
│  Key difference from PostgreSQL:                      │
│  • InnoDB uses O_DIRECT → bypasses OS page cache     │
│  • Therefore buffer_pool_size should be 70-80% RAM   │
│  • PostgreSQL uses 25% + OS page cache               │
└──────────────────────────────────────────────────────┘
```

```sql
-- MySQL InnoDB memory configuration
-- my.cnf [mysqld]

-- Buffer pool: 70-80% of RAM for dedicated MySQL server
-- innodb_buffer_pool_size = 48G  (on 64GB server)

-- Multiple buffer pool instances (reduce contention)
-- innodb_buffer_pool_instances = 8  (1 per GB, up to 64)

-- Buffer pool dump/load on restart (warm cache)
-- innodb_buffer_pool_dump_at_shutdown = ON
-- innodb_buffer_pool_load_at_startup = ON

-- Log buffer
-- innodb_log_buffer_size = 64M

-- Per-connection buffers (keep small — multiply by connections)
-- sort_buffer_size = 2M
-- join_buffer_size = 2M
-- read_buffer_size = 1M
-- read_rnd_buffer_size = 1M

-- Monitor buffer pool
SHOW ENGINE INNODB STATUS\G
-- Look for: Buffer pool hit rate
-- Target: > 99.9%

SELECT
    (1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)) * 100
    AS hit_rate_percent
FROM (
    SELECT
        VARIABLE_VALUE AS Innodb_buffer_pool_reads
    FROM performance_schema.global_status
    WHERE VARIABLE_NAME = 'Innodb_buffer_pool_reads'
) a, (
    SELECT
        VARIABLE_VALUE AS Innodb_buffer_pool_read_requests
    FROM performance_schema.global_status
    WHERE VARIABLE_NAME = 'Innodb_buffer_pool_read_requests'
) b;
```

---

### Connection Memory & Pooling

```
Connection Memory Problem:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Each database connection consumes:                   │
│  • PostgreSQL: ~5-10 MB base + work_mem per operation │
│  • MySQL: ~1-5 MB base + sort/join buffers            │
│                                                        │
│  500 idle connections × 10 MB = 5 GB wasted           │
│  500 active connections × 64 MB work_mem = 32 GB!     │
│                                                        │
│  Solution: Connection Pooling                          │
│                                                        │
│  ┌────────────────┐    ┌──────────────┐    ┌─────┐   │
│  │ 500 App        │    │ PgBouncer    │    │ PG  │   │
│  │ Connections    │───►│ 20 Pool      │───►│ 20  │   │
│  │ (lightweight)  │    │ Connections  │    │Conns│   │
│  └────────────────┘    └──────────────┘    └─────┘   │
│                                                        │
│  Pool modes:                                           │
│  • Session: conn held for entire session (least saving)│
│  • Transaction: conn returned after COMMIT (best)    │
│  • Statement: conn returned after each SQL (limited) │
└──────────────────────────────────────────────────────┘
```

```python
# Python — SQLAlchemy connection pool tuning
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql://user:pass@localhost/db",
    pool_size=20,          # max persistent connections
    max_overflow=10,       # additional temporary connections
    pool_timeout=30,       # seconds to wait for connection
    pool_recycle=3600,     # recycle connections after 1 hour
    pool_pre_ping=True,    # check connection health before use
)

# Connection pool monitoring
from sqlalchemy import event

@event.listens_for(engine, "checkout")
def on_checkout(dbapi_conn, connection_record, connection_proxy):
    # Log when connection is checked out from pool
    pass

@event.listens_for(engine, "checkin")
def on_checkin(dbapi_conn, connection_record):
    # Log when connection is returned to pool
    pass
```

---

### Memory Diagnostics

```sql
-- PostgreSQL: memory diagnostics

-- Check shared buffer usage
SELECT
    c.relname,
    pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
    count(*) AS buffers,
    pg_size_pretty(count(*) * 8192) AS buffer_size,
    round(100.0 * count(*) / (
        SELECT setting::integer FROM pg_settings WHERE name = 'shared_buffers'
    ), 2) AS pct_of_buffers
FROM pg_buffercache b
JOIN pg_class c ON b.relfilenode = pg_relation_filenode(c.oid)
WHERE b.reldatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
GROUP BY c.relname, c.oid
ORDER BY buffers DESC
LIMIT 20;

-- Check for queries that spill to disk (work_mem too small)
SELECT query, temp_blks_read, temp_blks_written
FROM pg_stat_statements
WHERE temp_blks_written > 0
ORDER BY temp_blks_written DESC
LIMIT 10;
-- If many queries spill to temp: increase work_mem

-- Check per-backend memory usage (PG 14+)
SELECT pid, backend_type,
       pg_size_pretty(allocated_bytes) AS allocated,
       pg_size_pretty(used_bytes) AS used
FROM pg_backend_memory_contexts
WHERE backend_type = 'client backend'
ORDER BY allocated_bytes DESC;

-- Monitor memory with OS tools
-- pg_top or htop: check RSS per backend process
-- PostgreSQL process-per-connection: each backend is a process
```

```sql
-- MySQL: memory diagnostics

-- Total memory usage estimate
SELECT
    (@@innodb_buffer_pool_size +
     @@innodb_log_buffer_size +
     @@key_buffer_size +
     @@max_connections * (
       @@sort_buffer_size +
       @@join_buffer_size +
       @@read_buffer_size +
       @@read_rnd_buffer_size +
       @@thread_stack
     )) / 1024 / 1024 / 1024 AS estimated_max_memory_gb;

-- Buffer pool usage
SELECT
    pool_size * 16384 / 1024 / 1024 / 1024 AS pool_size_gb,
    free_buffers * 16384 / 1024 / 1024 AS free_mb,
    database_pages * 16384 / 1024 / 1024 / 1024 AS data_gb
FROM information_schema.innodb_buffer_pool_stats;

-- Memory by event (Performance Schema)
SELECT event_name,
       current_alloc / 1024 / 1024 AS current_mb,
       high_alloc / 1024 / 1024 AS high_mb
FROM sys.memory_global_by_current_bytes
LIMIT 20;
```

---

### OS-Level Memory Tuning

```bash
# Linux kernel settings for databases

# Disable transparent huge pages (THP) — causes latency spikes
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag

# Disable swap (or set swappiness very low)
# Swapping database memory = catastrophic performance
sysctl vm.swappiness=1  # prefer OOM kill over swapping

# Huge pages (explicit, not transparent)
# PostgreSQL: huge_pages = try
# Calculate: shared_buffers / 2MB hugepage size + overhead
sysctl vm.nr_hugepages=8192  # for 16GB shared_buffers

# Dirty page writeback tuning
sysctl vm.dirty_ratio=10           # % of RAM for dirty pages
sysctl vm.dirty_background_ratio=3  # start flushing at 3%

# OOM score for database process
# Lower = less likely to be killed
echo -1000 > /proc/$(pidof postgres)/oom_score_adj
```

---

### Memory vs Performance Matrix

| Scenario | Symptom | Fix |
|----------|---------|-----|
| Buffer pool too small | High disk I/O, cache hit < 95% | Increase shared_buffers / buffer_pool_size |
| work_mem too small | Queries spill to temp disk | Increase work_mem (carefully) |
| work_mem too large | OOM under concurrent load | Reduce work_mem, add connection pooling |
| Too many connections | Memory exhaustion, OOM | Use PgBouncer/ProxySQL, reduce max_connections |
| No connection pooling | 1000 connections × 10MB = 10GB waste | Deploy PgBouncer in transaction mode |
| THP enabled | Latency spikes during compaction | Disable transparent huge pages |
| Swap enabled | Database pages swapped to disk | Disable swap or set swappiness=1 |
| OS cache underutilized (PG) | effective_cache_size too low | Set to 75% of RAM |
| InnoDB buffer pool too small | Constant disk reads | Increase to 70-80% RAM |

---

## Best Practices

1. **ALWAYS size buffer pool as percentage of RAM** — PostgreSQL 25%, MySQL InnoDB 70-80%
2. **ALWAYS use connection pooling** — PgBouncer for PostgreSQL, ProxySQL for MySQL
3. **ALWAYS calculate worst-case memory** — max_connections × work_mem × operations_per_query
4. **ALWAYS monitor buffer pool hit ratio** — must be > 99% for production
5. **ALWAYS disable transparent huge pages** — causes unpredictable latency
6. **ALWAYS disable swap for database servers** — swapping = downtime
7. **NEVER set work_mem too high globally** — scales with connections, causes OOM
8. **NEVER allow unlimited connections** — each consumes memory, use pooling instead
9. **NEVER ignore temp file warnings** — indicates work_mem insufficient for query
10. **NEVER run other applications on dedicated database server** — all RAM for the database

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| shared_buffers too small | Cache hit ratio < 95%, slow queries | Increase to 25% of RAM |
| InnoDB buffer pool too small | Constant disk reads, slow queries | Increase to 70-80% of RAM |
| work_mem too large globally | OOM under load (connections × work_mem) | Calculate safe maximum, set per-query |
| No connection pooling | 1000+ connections, memory exhaustion | PgBouncer/ProxySQL |
| THP enabled | Periodic latency spikes | Disable THP |
| Swap not disabled | Database pages evicted to disk | Set vm.swappiness=1 |
| effective_cache_size wrong | Bad query plans (seq scan instead of index) | Set to 75% of RAM |
| Not monitoring memory | OOM kills without warning | Monitor RSS, buffer pool, temp files |
| Running other apps on DB server | Memory contention | Dedicated server for database |
| Not warm-starting buffer pool | Slow after restart | innodb_buffer_pool_dump_at_shutdown=ON |

---

## Real-world Examples

### Instagram (PostgreSQL)
- Heavily tuned shared_buffers and work_mem
- PgBouncer for connection management (thousands of Django workers)
- Careful work_mem budgeting per query type

### Uber (MySQL)
- InnoDB buffer pool sized to 70% of 256GB servers
- ProxySQL for connection multiplexing
- Custom monitoring for buffer pool efficiency

### Discord (ScyllaDB)
- Shard-per-core memory isolation (no shared buffer pool)
- Each CPU core manages its own memory allocation
- Eliminates cross-core memory contention

---

## Enforcement Checklist

- [ ] Buffer pool sized appropriately (PG: 25% RAM, MySQL: 70-80% RAM)
- [ ] work_mem / sort_buffer_size calculated for concurrent load
- [ ] Connection pooling deployed (PgBouncer / ProxySQL)
- [ ] max_connections set conservatively (use pooling for scale)
- [ ] Buffer pool hit ratio monitored (> 99%)
- [ ] Transparent huge pages disabled
- [ ] Swap disabled or swappiness = 1
- [ ] effective_cache_size set to 75% RAM (PostgreSQL)
- [ ] Temp file usage monitored (work_mem insufficiency)
- [ ] OS-level memory tuning applied (dirty ratios, huge pages)
- [ ] Memory budget documented: shared + (connections × per-connection)
