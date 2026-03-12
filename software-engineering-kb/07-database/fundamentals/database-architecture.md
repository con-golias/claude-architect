# Database Architecture & Query Processing

> **Domain:** Database > Fundamentals
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Every query you write — every SELECT, INSERT, UPDATE — passes through a complex pipeline of parsing, planning, optimization, and execution before touching disk or memory. Understanding this pipeline is the difference between writing queries that execute in milliseconds and queries that time out. When you understand how a database processes queries, stores data on disk, and manages memory, you stop writing blind SQL and start writing queries that work WITH the engine instead of against it.

---

## How It Works

### Client-Server Architecture

```
┌──────────┐     ┌──────────────────────────────────────────────────┐
│  Client   │     │              DATABASE SERVER                     │
│ (app/CLI) │     │                                                  │
│           │ TCP │  ┌─────────────┐                                 │
│  Driver   │────►│  │ Connection  │  ┌──────────┐                  │
│  (pg,     │     │  │   Manager   │  │  Auth &  │                  │
│  mysql2,  │◄────│  │  (pooling)  │──│  ACL     │                  │
│  mongo)   │     │  └──────┬──────┘  └──────────┘                  │
└──────────┘     │         │                                        │
                  │  ┌──────▼──────┐                                 │
                  │  │   Parser    │  SQL text → Parse Tree          │
                  │  └──────┬──────┘                                 │
                  │  ┌──────▼──────┐                                 │
                  │  │  Analyzer   │  Validate tables, columns,types │
                  │  └──────┬──────┘                                 │
                  │  ┌──────▼──────┐                                 │
                  │  │  Optimizer  │  Choose best execution plan     │
                  │  └──────┬──────┘                                 │
                  │  ┌──────▼──────┐                                 │
                  │  │  Executor   │  Run the plan, return results   │
                  │  └──────┬──────┘                                 │
                  │         │                                        │
                  │  ┌──────▼──────────────────────────────────┐     │
                  │  │          STORAGE ENGINE                  │     │
                  │  │  ┌─────────┐  ┌──────┐  ┌───────────┐  │     │
                  │  │  │ Buffer  │  │ WAL  │  │   Disk    │  │     │
                  │  │  │  Pool   │  │(Log) │  │  (Pages)  │  │     │
                  │  │  └─────────┘  └──────┘  └───────────┘  │     │
                  │  └─────────────────────────────────────────┘     │
                  └──────────────────────────────────────────────────┘
```

---

### Query Processing Pipeline

#### Stage 1: Connection Management

```
Client                    Connection Pool                Database
  │                            │                           │
  │── Request connection ─────►│                           │
  │                            │── Reuse idle connection ─►│
  │                            │   (or create new one)     │
  │◄── Connection handle ─────│                           │
  │                            │                           │
  │── Execute query ──────────►│──── Forward query ──────►│
  │                            │                           │
  │◄── Results ────────────────│◄─── Results ─────────────│
  │                            │                           │
  │── Release connection ─────►│── Return to pool ────────►│
```

**Key concepts:**
- Each connection consumes memory (typically 5-10MB per connection in PostgreSQL)
- Connection pooling (PgBouncer, pgpool) reduces overhead
- Most applications need 20-100 connections, not thousands
- Formula: `connections = (core_count * 2) + effective_spindle_count`

#### Stage 2: Parsing

The parser converts SQL text into an Abstract Syntax Tree (AST):

```sql
-- Input SQL
SELECT u.name, COUNT(o.id) as order_count
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2024-01-01'
GROUP BY u.name
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC;
```

```
Parse Tree:
SelectStmt
├── targetList: [u.name, COUNT(o.id)]
├── fromClause:
│   └── JoinExpr
│       ├── larg: RangeVar(users, alias=u)
│       ├── rarg: RangeVar(orders, alias=o)
│       └── quals: o.user_id = u.id
├── whereClause: u.created_at > '2024-01-01'
├── groupClause: [u.name]
├── havingClause: COUNT(o.id) > 5
└── sortClause: [order_count DESC]
```

**What happens here:**
- Lexical analysis: SQL text → tokens
- Syntax validation: tokens → parse tree (fails on syntax errors)
- No table/column validation yet — that comes in the analyzer

#### Stage 3: Analysis & Rewriting

The analyzer resolves names and validates semantics:

- Verify tables and columns exist
- Resolve aliases and implicit type casts
- Check permissions (does user have SELECT on this table?)
- Apply rewrite rules (views are expanded here)
- Type checking (can you compare timestamp with string?)

#### Stage 4: Query Optimization

The optimizer transforms the logical plan into the most efficient physical execution plan. This is the most complex and important stage.

```
┌────────────────────────────────────────────────────────┐
│                    QUERY OPTIMIZER                       │
│                                                         │
│  Logical Plan                Physical Plan              │
│  ─────────                  ─────────────               │
│  "Get matching rows"   →    "Seq Scan on users          │
│                              then Hash Join with orders  │
│                              using index idx_orders_user"│
│                                                         │
│  Considers:                                             │
│  • Table statistics (row count, distinct values)        │
│  • Available indexes                                    │
│  • Join strategies (nested loop, hash join, merge join) │
│  • Scan strategies (sequential, index, bitmap)          │
│  • Sort strategies (in-memory, disk-based)              │
│  • Estimated cost of each plan                          │
└────────────────────────────────────────────────────────┘
```

**Join Strategies:**

| Strategy | How It Works | Best When |
|----------|-------------|-----------|
| **Nested Loop** | For each row in A, scan B | Small tables, indexed lookups |
| **Hash Join** | Build hash table from smaller set, probe with larger | Medium-large tables, equality joins |
| **Merge Join** | Sort both inputs, merge | Both inputs already sorted or can use index |

**Scan Strategies:**

| Strategy | How It Works | Best When |
|----------|-------------|-----------|
| **Sequential Scan** | Read every page of table | Need >5-10% of rows, small table |
| **Index Scan** | Traverse B-tree, fetch heap rows | Need <5% of rows, selective WHERE |
| **Index Only Scan** | Read only from index (covering) | All needed columns are in the index |
| **Bitmap Index Scan** | Build bitmap from index, then heap scan | Multiple index conditions, medium selectivity |

#### Stage 5: Execution

The executor runs the physical plan, processing tuples through a tree of operators:

```
                    RESULT (Limit 10)
                         │
                    Sort (order_count DESC)
                         │
                    Filter (count > 5)
                         │
                    HashAggregate (group by u.name)
                         │
                    Hash Join (o.user_id = u.id)
                    ┌────┴────┐
            Seq Scan(users)  Index Scan(orders)
            WHERE created_at  idx_orders_user_id
            > '2024-01-01'
```

**Execution models:**
- **Volcano (Iterator)**: Each operator pulls one row at a time from child operators (PostgreSQL)
- **Vectorized**: Operators process batches of rows (ClickHouse, DuckDB)
- **Compiled**: Query compiled to native code at runtime (some analytics engines)

---

### Storage Architecture

#### Page-Based Storage

Databases store data in fixed-size pages (typically 8KB in PostgreSQL, 16KB in MySQL InnoDB):

```
┌──────────────────────────────────────────┐
│              DATA FILE                    │
│                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ Page 0 │ │ Page 1 │ │ Page 2 │ ...  │
│  │ (8 KB) │ │ (8 KB) │ │ (8 KB) │      │
│  └────────┘ └────────┘ └────────┘      │
│                                          │
│  Each page contains:                     │
│  ┌──────────────────────────────────┐   │
│  │ Page Header (24 bytes)           │   │
│  │ Item Pointers (array)            │   │
│  │   [offset1, offset2, offset3...] │   │
│  │                                  │   │
│  │ ─── Free Space ────────────────  │   │
│  │                                  │   │
│  │ Tuple 3 (row data)              │   │
│  │ Tuple 2 (row data)              │   │
│  │ Tuple 1 (row data)              │   │
│  └──────────────────────────────────┘   │
│  Items grow down ↓  Tuples grow up ↑    │
└──────────────────────────────────────────┘
```

#### Heap vs Index Storage

```
HEAP (Table Data)                    B-TREE INDEX
┌────────────────────┐               ┌──────────┐
│ Page 0             │               │   Root   │
│  Row: id=5, ...    │               │ [30, 60] │
│  Row: id=12, ...   │               └─┬──┬──┬──┘
│  Row: id=3, ...    │                 │  │  │
│ Page 1             │        ┌────────┘  │  └────────┐
│  Row: id=47, ...   │        ▼           ▼           ▼
│  Row: id=8, ...    │    ┌───────┐  ┌───────┐  ┌───────┐
│ ...                │    │ <30   │  │ 30-60 │  │ >60   │
└────────────────────┘    │[5,12] │  │[30,47]│  │[61,89]│
                          └───┬───┘  └───┬───┘  └───┬───┘
  Heap: rows in INSERT       │          │          │
  order (unordered)     ┌────┘     ┌────┘     ┌────┘
                        ▼          ▼          ▼
                   Leaf pages point to heap tuple locations
```

**Key points:**
- Heap stores rows in insertion order — no guarantee of physical ordering
- Indexes maintain sorted pointers to heap locations
- Index-only scans avoid heap access entirely (covering indexes)
- CLUSTER command physically reorders heap by an index (one-time, not maintained)

---

### Memory Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   DATABASE MEMORY                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │             SHARED MEMORY                         │   │
│  │  ┌────────────────────┐  ┌────────────────────┐  │   │
│  │  │    Buffer Pool      │  │     WAL Buffers    │  │   │
│  │  │  (shared_buffers)   │  │  (wal_buffers)     │  │   │
│  │  │  Cached data pages  │  │  Write-ahead log   │  │   │
│  │  │  25% of RAM typical │  │  before flush       │  │   │
│  │  └────────────────────┘  └────────────────────┘  │   │
│  │  ┌────────────────────┐  ┌────────────────────┐  │   │
│  │  │  Lock Manager       │  │  CLOG (Commit Log) │  │   │
│  │  │  Row/table locks    │  │  Transaction status│  │   │
│  │  └────────────────────┘  └────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         PER-CONNECTION MEMORY                     │   │
│  │  ┌─────────────┐  ┌──────────────┐               │   │
│  │  │  work_mem    │  │ temp_buffers │               │   │
│  │  │  Sorting,    │  │ Temp tables  │               │   │
│  │  │  hash tables │  │              │               │   │
│  │  │  4MB default │  │  8MB default │               │   │
│  │  └─────────────┘  └──────────────┘               │   │
│  │  ┌───────────────────────────┐                    │   │
│  │  │  maintenance_work_mem     │                    │   │
│  │  │  VACUUM, CREATE INDEX     │                    │   │
│  │  │  64MB-1GB typical         │                    │   │
│  │  └───────────────────────────┘                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              OS PAGE CACHE                        │   │
│  │  Remaining RAM — caches file system reads         │   │
│  │  Database relies on OS to cache pages not in      │   │
│  │  buffer pool. Effective memory = buffer pool      │   │
│  │  + OS page cache.                                 │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Memory sizing guidelines (PostgreSQL):**

| Parameter | Recommended | Purpose |
|-----------|-------------|---------|
| `shared_buffers` | 25% of RAM | Data page cache |
| `effective_cache_size` | 75% of RAM | Tells planner about OS cache |
| `work_mem` | 4MB-64MB | Sort/hash per operation (careful — multiplied by connections) |
| `maintenance_work_mem` | 256MB-1GB | VACUUM, CREATE INDEX |
| `wal_buffers` | 64MB | WAL write buffer |

> **Cross-reference:** For storage engine deep dive → `07-database/database-internals/storage-engines.md`

---

### Process Architecture

Different databases use different process models:

```
PostgreSQL (Process-per-connection):
┌──────────────────────────────────────────┐
│  Postmaster (main process)               │
│    │                                     │
│    ├── Backend Process (client 1)        │
│    ├── Backend Process (client 2)        │
│    ├── Backend Process (client 3)        │
│    │                                     │
│    ├── Background Writer                 │
│    ├── WAL Writer                        │
│    ├── Autovacuum Launcher               │
│    ├── Stats Collector                   │
│    └── Checkpointer                      │
└──────────────────────────────────────────┘

MySQL (Thread-per-connection):
┌──────────────────────────────────────────┐
│  mysqld (single process)                 │
│    │                                     │
│    ├── Connection Thread (client 1)      │
│    ├── Connection Thread (client 2)      │
│    ├── Connection Thread (client 3)      │
│    │                                     │
│    ├── InnoDB Background Threads         │
│    ├── Replication Thread                │
│    └── Event Scheduler Thread            │
└──────────────────────────────────────────┘
```

**Implications:**
- PostgreSQL: Process isolation (one crash does not kill others), higher memory per connection
- MySQL: Lower overhead per connection, but shared memory space (one bug can affect all)
- Both benefit from connection pooling to limit concurrent connections

---

## Best Practices

1. **ALWAYS use connection pooling** — never connect directly from application to database in production
2. **ALWAYS monitor buffer pool hit ratio** — should be >99% for OLTP workloads
3. **ALWAYS size shared_buffers appropriately** — 25% of RAM is the starting point
4. **ALWAYS use EXPLAIN ANALYZE** to understand query execution plans
5. **NEVER set work_mem too high** — it is per-operation, not per-connection
6. **NEVER ignore the OS page cache** — it is part of your effective cache
7. **ALWAYS keep statistics up to date** — run ANALYZE after large data changes
8. **ALWAYS monitor connection count** — connection exhaustion causes outages

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No connection pooling | "too many connections" errors | Use PgBouncer/pgpool |
| shared_buffers = 50% of RAM | OS page cache starved, swapping | Set to 25%, leave room for OS |
| work_mem = 1GB | OOM with concurrent queries | Keep 4-64MB, multiply by max connections |
| Ignoring EXPLAIN output | Slow queries, sequential scans on large tables | Read and optimize execution plans |
| Opening connection per request | 100ms+ overhead per query | Pool connections, reuse |
| Not running ANALYZE | Optimizer chooses bad plans | Autovacuum or scheduled ANALYZE |
| Running OLTP and OLAP on same instance | Analytical queries block transactions | Separate read replica for analytics |
| Disk-based sorting on every query | High I/O, slow response | Increase work_mem or add indexes |

---

## Real-world Examples

### PostgreSQL at Instagram
- Process-per-connection model with PgBouncer in front
- Shared buffers tuned for their working set size
- Extensive use of EXPLAIN ANALYZE for query optimization
- Custom connection pooling layer for Django

### MySQL at GitHub
- Thread-per-connection with ProxySQL as connection pooler
- InnoDB buffer pool sized to hold entire working set
- Vitess for horizontal sharding (adds query routing layer)
- Online schema changes with gh-ost (avoids table locks)

### MongoDB at Coinbase
- WiredTiger storage engine with document-level locking
- Internal cache (50% RAM) + OS file system cache
- Mongos query router distributes across shards
- Read preference configured per query type

---

## Enforcement Checklist

- [ ] Connection pooling configured (PgBouncer, pgpool, ProxySQL, or application-level)
- [ ] Buffer pool / shared_buffers sized appropriately for available RAM
- [ ] work_mem set conservatively with connection count considered
- [ ] EXPLAIN ANALYZE used before deploying new queries
- [ ] Query execution plans reviewed for sequential scans on large tables
- [ ] Autovacuum enabled and monitored (PostgreSQL)
- [ ] Connection limits set to prevent resource exhaustion
- [ ] Monitoring in place for buffer hit ratio, connection count, query latency
- [ ] OS page cache accounted for in memory planning
- [ ] Separate instances for OLTP vs OLAP workloads if needed
