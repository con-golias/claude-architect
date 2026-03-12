# PostgreSQL Overview & Architecture

> **Domain:** Database > Relational > PostgreSQL
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

PostgreSQL is the most advanced open-source relational database — the default choice for new production systems. It combines SQL standards compliance with extensibility that no other database matches: JSONB for document-like flexibility, full-text search that eliminates Elasticsearch for most use cases, PostGIS for geospatial queries, ltree for hierarchies, pgvector for AI embeddings, and row-level security for multi-tenant isolation. PostgreSQL handles OLTP workloads rivaling Oracle and SQL Server at zero licensing cost. Understanding PostgreSQL's architecture — its process model, MVCC implementation, WAL mechanism, and buffer management — is essential for operating it in production.

---

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Server                             │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Client   │  │ Client   │  │ Client   │  │  Background      │   │
│  │ Backend  │  │ Backend  │  │ Backend  │  │  Processes        │   │
│  │ Process  │  │ Process  │  │ Process  │  │                   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │ • WAL Writer     │   │
│       │              │              │        │ • Checkpointer   │   │
│       │              │              │        │ • Background     │   │
│       ▼              ▼              ▼        │   Writer         │   │
│  ┌──────────────────────────────────────┐   │ • Autovacuum     │   │
│  │         Shared Memory                │   │ • Stats          │   │
│  │                                      │   │   Collector      │   │
│  │  ┌─────────────┐  ┌──────────────┐  │   │ • Archiver       │   │
│  │  │ Shared      │  │ WAL Buffers  │  │   │ • Logical        │   │
│  │  │ Buffers     │  │              │  │   │   Replication    │   │
│  │  │ (8KB pages) │  │              │  │   └──────────────────┘   │
│  │  └─────────────┘  └──────────────┘  │                          │
│  │  ┌─────────────┐  ┌──────────────┐  │                          │
│  │  │ Lock        │  │ CLOG         │  │                          │
│  │  │ Manager     │  │ (Commit Log) │  │                          │
│  │  └─────────────┘  └──────────────┘  │                          │
│  └──────────────────────────────────────┘                          │
│                          │                                          │
│                          ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                      Disk Storage                         │      │
│  │  ┌──────────┐  ┌───────────┐  ┌───────┐  ┌───────────┐  │      │
│  │  │ Data     │  │ WAL       │  │ CLOG  │  │ pg_stat   │  │      │
│  │  │ Files    │  │ Segments  │  │       │  │ temp      │  │      │
│  │  │ (base/) │  │ (pg_wal/) │  │       │  │           │  │      │
│  │  └──────────┘  └───────────┘  └───────┘  └───────────┘  │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### Process Architecture

PostgreSQL uses a **process-per-connection** model (not threads like MySQL).

```
                    ┌──────────────┐
                    │  Postmaster  │  ← Main process (PID 1)
                    │  (Listener)  │    Listens on port 5432
                    └──────┬───────┘    Forks backends
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │  Backend 1  │ │ Backend 2│ │  Backend N  │
     │  (Client A) │ │(Client B)│ │ (Client N)  │
     └─────────────┘ └──────────┘ └─────────────┘
     Each backend: ~5-10 MB RAM
     Max connections: max_connections (default 100)
```

**Why process-per-connection matters:**
- Each client gets a dedicated OS process (fork)
- Process crash does not affect other connections
- Higher per-connection memory overhead (~5-10 MB)
- Connection pooling (PgBouncer) is essential in production

### Connection Lifecycle

```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Connection settings
SHOW max_connections;         -- default 100
SHOW superuser_reserved_connections;  -- default 3

-- View active connections
SELECT pid, usename, application_name, client_addr,
       state, query_start, query
FROM pg_stat_activity
WHERE state = 'active';

-- Terminate idle connections older than 1 hour
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND usename = 'app_user'
  AND state = 'idle'
  AND query_start < NOW() - INTERVAL '1 hour';
```

---

### MVCC (Multi-Version Concurrency Control)

PostgreSQL's MVCC stores multiple versions of each row. Readers never block writers; writers never block readers.

```
┌──────────────────────────────────────────┐
│  Heap Page (8 KB)                         │
│                                           │
│  Tuple v1: xmin=100, xmax=105            │  ← Old version (deleted by TX 105)
│  Tuple v2: xmin=105, xmax=0             │  ← Current version (created by TX 105)
│  Tuple v3: xmin=110, xmax=0             │  ← Another row
│                                           │
│  Free space for new tuples               │
└──────────────────────────────────────────┘

xmin = Transaction ID that created this tuple
xmax = Transaction ID that deleted/updated this tuple (0 = still visible)

Visibility check for transaction TX_ID:
  Visible IF xmin committed AND xmin < snapshot
            AND (xmax = 0 OR xmax not committed OR xmax > snapshot)
```

**MVCC consequences:**
- UPDATE creates a new tuple version (old version remains until VACUUM)
- DELETE marks xmax but does not remove the tuple
- Table bloat occurs without regular VACUUM
- HOT (Heap-Only Tuples) optimization: updates that do not change indexed columns can reuse the same page

---

### WAL (Write-Ahead Logging)

All changes are written to WAL before data files — guarantees crash recovery.

```
Transaction flow:
1. Modify data in shared_buffers (memory)
2. Write change record to WAL buffer
3. On COMMIT: flush WAL buffer to WAL segment on disk (fsync)
4. Data files written later by background writer/checkpointer

                    ┌─────────┐
                    │ Client  │
                    └────┬────┘
                         │ COMMIT
                         ▼
              ┌──────────────────┐
              │  WAL Buffer      │ ← Written first (fast, sequential)
              │  (wal_buffers)   │
              └────────┬─────────┘
                       │ fsync on COMMIT
                       ▼
              ┌──────────────────┐
              │  WAL Segments    │ ← On disk (pg_wal/)
              │  (16 MB each)   │   Sequential writes = fast
              └──────────────────┘
                       │
                       │ Asynchronous (checkpoint)
                       ▼
              ┌──────────────────┐
              │  Data Files      │ ← Updated eventually
              │  (base/)         │   Random writes = slow
              └──────────────────┘

WAL enables:
  • Crash recovery (replay WAL from last checkpoint)
  • Point-in-time recovery (PITR)
  • Streaming replication (ship WAL to standby)
  • Logical replication (decode WAL for CDC)
```

```sql
-- WAL configuration
SHOW wal_level;           -- minimal, replica, logical
SHOW max_wal_size;        -- checkpoint target (default 1GB)
SHOW min_wal_size;        -- minimum WAL retention (default 80MB)
SHOW checkpoint_timeout;  -- max time between checkpoints (default 5min)
SHOW archive_mode;        -- enable WAL archiving for PITR

-- Monitor WAL
SELECT pg_current_wal_lsn();          -- current write position
SELECT pg_wal_lsn_diff(
    pg_current_wal_lsn(),
    '0/0'
) / (1024*1024*1024) AS total_wal_gb; -- total WAL generated
```

---

### VACUUM & Autovacuum

VACUUM reclaims space from dead tuples (created by UPDATE/DELETE).

```
Before VACUUM:                    After VACUUM:
┌─────────────────────┐          ┌─────────────────────┐
│ Live tuple  (v3)    │          │ Live tuple  (v3)    │
│ Dead tuple  (v1) ██ │          │ [Free space]        │
│ Dead tuple  (v2) ██ │          │ [Free space]        │
│ Live tuple  (v4)    │          │ Live tuple  (v4)    │
│ Dead tuple  (v5) ██ │          │ [Free space]        │
└─────────────────────┘          └─────────────────────┘
                                  Space reusable (not returned to OS)

VACUUM FULL:
┌─────────────────────┐
│ Live tuple  (v3)    │
│ Live tuple  (v4)    │
└─────────────────────┘  ← File shrunk (returned to OS)
                          Requires exclusive lock!
```

```sql
-- Manual vacuum
VACUUM products;                       -- reclaim space, no lock
VACUUM (VERBOSE) products;             -- with statistics output
VACUUM (ANALYZE) products;             -- vacuum + update statistics
VACUUM FULL products;                  -- compact table (exclusive lock!)

-- Autovacuum configuration (per-table)
ALTER TABLE high_churn_table SET (
    autovacuum_vacuum_threshold = 50,
    autovacuum_vacuum_scale_factor = 0.05,      -- default 0.2
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.05
);

-- Formula: vacuum triggers when dead_tuples > threshold + scale_factor * live_tuples
-- Default: 50 + 0.2 * 1,000,000 = 200,050 dead tuples for 1M row table
-- Tuned:   50 + 0.05 * 1,000,000 = 50,050 dead tuples (vacuums 4x more often)

-- Monitor autovacuum
SELECT schemaname, relname,
       n_live_tup, n_dead_tup,
       n_dead_tup::float / NULLIF(n_live_tup, 0) AS dead_ratio,
       last_vacuum, last_autovacuum,
       last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;
```

---

### Extensions Ecosystem

| Extension | Purpose | Use Case |
|-----------|---------|----------|
| **pgcrypto** | Cryptographic functions | gen_random_uuid(), password hashing |
| **pg_trgm** | Trigram similarity | Fuzzy text search, typo tolerance |
| **PostGIS** | Geospatial data | Location queries, distance calculations |
| **pgvector** | Vector similarity search | AI embeddings, semantic search |
| **ltree** | Hierarchical data | Category trees, org charts |
| **btree_gist** | GiST for B-tree types | EXCLUSION constraints, range overlaps |
| **pg_stat_statements** | Query statistics | Performance monitoring, slow query analysis |
| **pg_cron** | Job scheduling | Materialized view refresh, cleanup |
| **timescaledb** | Time-series optimization | IoT, monitoring, financial data |
| **citus** | Distributed PostgreSQL | Multi-node horizontal scaling |
| **pg_partman** | Partition management | Automatic partition creation |
| **pgaudit** | Audit logging | Compliance, security audit trails |
| **pg_repack** | Online table compaction | VACUUM FULL without exclusive lock |

```sql
-- List available extensions
SELECT * FROM pg_available_extensions ORDER BY name;

-- Install extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Check installed extensions
SELECT extname, extversion FROM pg_extension;
```

---

### Storage Layout

```
$PGDATA/
├── postgresql.conf          ← Main configuration
├── pg_hba.conf              ← Client authentication
├── pg_ident.conf            ← OS user mapping
├── PG_VERSION               ← PostgreSQL version
├── base/                    ← Database files
│   ├── 1/                   ← template1 database
│   ├── 12345/               ← user database (OID)
│   │   ├── 16384            ← Table file (relfilenode)
│   │   ├── 16384_fsm        ← Free space map
│   │   └── 16384_vm         ← Visibility map
│   └── ...
├── global/                  ← Cluster-wide tables
├── pg_wal/                  ← WAL segments (16 MB each)
├── pg_xact/                 ← Transaction commit status (CLOG)
├── pg_stat_tmp/             ← Statistics collector temp files
├── pg_tblspc/               ← Tablespace symlinks
└── pg_logical/              ← Logical replication data
```

```sql
-- Check database sizes
SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database ORDER BY pg_database_size(datname) DESC;

-- Check table sizes with indexes
SELECT
    schemaname || '.' || relname AS table,
    pg_size_pretty(pg_total_relation_size(relid)) AS total,
    pg_size_pretty(pg_relation_size(relid)) AS data,
    pg_size_pretty(pg_indexes_size(relid)) AS indexes
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
```

---

### Roles & Authentication

```sql
-- Create roles with minimal privileges
CREATE ROLE app_readonly LOGIN PASSWORD 'secure_password';
CREATE ROLE app_readwrite LOGIN PASSWORD 'secure_password';
CREATE ROLE app_admin LOGIN PASSWORD 'secure_password' CREATEDB;

-- Grant privileges
GRANT CONNECT ON DATABASE myapp TO app_readonly;
GRANT USAGE ON SCHEMA public TO app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_readonly;

GRANT CONNECT ON DATABASE myapp TO app_readwrite;
GRANT USAGE ON SCHEMA public TO app_readwrite;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_readwrite;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_readwrite;

-- Row-Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

SET app.tenant_id = 'uuid-of-tenant';
SELECT * FROM orders;  -- automatically filtered by policy
```

### pg_hba.conf — Client Authentication

```
# TYPE  DATABASE  USER         ADDRESS         METHOD
local   all       postgres                     peer
host    all       all          127.0.0.1/32    scram-sha-256
host    myapp     app_readonly 10.0.0.0/8      scram-sha-256
host    all       all          0.0.0.0/0       reject
hostssl replication replicator  10.0.1.0/24    scram-sha-256
```

---

### Replication

```
                   Streaming Replication
┌──────────┐    WAL stream    ┌──────────┐
│ Primary  │─────────────────►│ Standby  │  ← Read-only replica
│ (R/W)    │                  │ (R/O)    │
└──────────┘                  └──────────┘

                   Logical Replication
┌──────────┐   Decoded changes  ┌──────────┐
│ Publisher│─────────────────────►│Subscriber│  ← Selective table replication
│ (source) │                     │ (target) │     Different schema possible
└──────────┘                     └──────────┘
```

```sql
-- Check replication status (on primary)
SELECT client_addr, state, sent_lsn, replay_lsn,
       pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;

-- Check replication lag (on standby)
SELECT CASE WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn()
            THEN 0
            ELSE EXTRACT(EPOCH FROM NOW() - pg_last_xact_replay_timestamp())
       END AS replication_lag_seconds;

-- Logical replication
-- Publisher:
CREATE PUBLICATION my_pub FOR TABLE users, orders;
-- Subscriber:
CREATE SUBSCRIPTION my_sub
    CONNECTION 'host=primary dbname=myapp'
    PUBLICATION my_pub;
```

---

## Best Practices

1. **ALWAYS use connection pooling (PgBouncer)** — PostgreSQL forks a process per connection
2. **ALWAYS tune autovacuum for high-churn tables** — default settings too conservative for production
3. **ALWAYS enable pg_stat_statements** — essential for identifying slow queries
4. **ALWAYS use SCRAM-SHA-256** authentication — never trust or md5
5. **ALWAYS configure WAL archiving** for production — enables PITR recovery
6. **ALWAYS use TIMESTAMPTZ** — never TIMESTAMP WITHOUT TIME ZONE
7. **ALWAYS create roles with minimal privileges** — never use postgres superuser for apps
8. **ALWAYS monitor dead tuple ratio** — alert if dead/live exceeds 20%
9. **NEVER run VACUUM FULL without maintenance window** — acquires exclusive lock
10. **NEVER set max_connections above 200** without connection pooling

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No connection pooling | "too many connections", high memory | Use PgBouncer (transaction mode) |
| Default autovacuum on high-churn tables | Table bloat, slow queries | Tune autovacuum_vacuum_scale_factor |
| Using postgres superuser for app | Security risk, no audit trail | Create application-specific roles |
| No pg_stat_statements | Cannot identify slow queries | CREATE EXTENSION pg_stat_statements |
| VACUUM FULL as regular maintenance | Exclusive lock blocks all queries | Use pg_repack or regular VACUUM |
| Trust authentication in pg_hba.conf | No password required | Use scram-sha-256 |
| No WAL archiving | Cannot recover beyond last backup | Configure archive_mode |
| max_connections = 1000 | OOM, context switching | PgBouncer, keep max_connections ≤ 200 |
| Not monitoring replication lag | Stale reads undetected | Alert on pg_stat_replication |
| Ignoring table bloat | Disk grows, queries slow | Monitor n_dead_tup ratio |

---

## Real-world Examples

### Instagram
- PostgreSQL as primary store for user data, photos, likes (billions of rows)
- Custom sharding layer on top of PostgreSQL
- Extensive use of partial indexes and GIN indexes
- PgBouncer with thousands of pooled connections

### GitLab
- PostgreSQL for all persistent data (repos metadata, CI/CD, issues)
- Extensive use of JSONB, CTEs, window functions
- Custom autovacuum tuning for high-write tables
- Database partitioning for CI pipeline data

### Supabase
- PostgreSQL as entire backend (PostgREST for API, RLS for auth)
- Row-Level Security for multi-tenant isolation
- Realtime via PostgreSQL LISTEN/NOTIFY
- pg_graphql extension for automatic GraphQL API

---

## Enforcement Checklist

- [ ] Connection pooling configured (PgBouncer or application-level)
- [ ] pg_stat_statements extension enabled
- [ ] Autovacuum tuned for high-churn tables (scale_factor < 0.1)
- [ ] WAL archiving configured for production
- [ ] Application roles created with minimal privileges
- [ ] pg_hba.conf uses scram-sha-256
- [ ] Row-Level Security enabled for multi-tenant tables
- [ ] Table bloat monitored (dead tuple ratio alerts)
- [ ] Replication lag monitored with alerting
- [ ] Database and table sizes monitored
- [ ] Extensions installed: pgcrypto, pg_trgm, pg_stat_statements
