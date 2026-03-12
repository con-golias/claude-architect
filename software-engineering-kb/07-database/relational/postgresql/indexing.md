# PostgreSQL Indexing

> **Domain:** Database > Relational > PostgreSQL
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Indexes are the difference between a query that takes 50ms and one that takes 50 seconds. Without appropriate indexes, PostgreSQL must scan every row in a table (sequential scan) to find matching data. A well-chosen index allows PostgreSQL to locate rows in O(log n) time instead of O(n). But indexes are not free — each index adds storage overhead, slows down writes (INSERT/UPDATE/DELETE must update every index), and requires VACUUM maintenance. Understanding which index type to use (B-tree, GIN, GiST, BRIN), when to create partial or covering indexes, and how to read EXPLAIN output is the most impactful PostgreSQL skill for production performance.

---

## How It Works

### Index Types Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Index Types                         │
│                                                                   │
│  B-tree (default)    GIN                GiST              BRIN   │
│  ┌───────┐          ┌───────┐          ┌───────┐       ┌──────┐ │
│  │ =  <  │          │ Array │          │ Geo   │       │Range │ │
│  │ >  <= │          │ JSONB │          │ Range │       │ of   │ │
│  │ >= <> │          │ FTS   │          │ ltree │       │blocks│ │
│  │ LIKE  │          │ trgm  │          │ Excl. │       │      │ │
│  │ IS NULL│         │       │          │       │       │      │ │
│  └───────┘          └───────┘          └───────┘       └──────┘ │
│  Most queries       Containment        Spatial/Overlap  Huge     │
│  95% of cases       Multi-value        Proximity        tables   │
└──────────────────────────────────────────────────────────────────┘
```

---

### B-tree Index (Default)

The workhorse index — supports equality and range queries on scalar values.

```sql
-- Basic B-tree (created automatically for PRIMARY KEY and UNIQUE)
CREATE INDEX idx_users_email ON users(email);

-- Composite index (column order matters!)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
-- Supports: WHERE user_id = 5
-- Supports: WHERE user_id = 5 AND status = 'active'
-- Does NOT support: WHERE status = 'active' (skips first column)

-- Descending index (for ORDER BY DESC optimization)
CREATE INDEX idx_orders_date_desc ON orders(created_at DESC);

-- Unique index
CREATE UNIQUE INDEX idx_users_email_unique ON users(email);

-- Nulls ordering
CREATE INDEX idx_items_priority ON items(priority NULLS LAST);
```

**B-tree structure:**

```
                    ┌──────────────┐
                    │ Root: [50]   │
                    └──────┬───────┘
                 ┌─────────┴──────────┐
          ┌──────▼──────┐      ┌──────▼──────┐
          │ [10, 25, 40]│      │ [60, 75, 90]│
          └──────┬──────┘      └──────┬──────┘
         ┌───┬───┴───┬───┐    ┌───┬───┴───┬───┐
         ▼   ▼       ▼   ▼    ▼   ▼       ▼   ▼
       Leaf pages with actual row pointers (TIDs)

Lookup: O(log n) — 3-4 levels for millions of rows
Range scan: navigate to start, scan leaves sequentially
```

**Composite index column ordering rules:**

| Rule | Explanation |
|------|-------------|
| Equality columns first | Columns with `=` conditions go first |
| Range column last | Column with `<`, `>`, `BETWEEN` goes last |
| Most selective first | Among equality columns, most selective first |
| Match ORDER BY | Index order should match query ORDER BY |

```sql
-- Query: WHERE status = 'active' AND created_at > '2024-01-01' ORDER BY created_at
-- Best index:
CREATE INDEX idx_orders_status_date ON orders(status, created_at);
-- status = equality (first), created_at = range + ORDER BY (last)

-- Multicolumn index for ORDER BY
-- Query: ORDER BY last_name, first_name
CREATE INDEX idx_users_name ON users(last_name, first_name);
-- Index scan returns rows already sorted — no additional sort needed
```

---

### Partial Index

Index only a subset of rows — smaller, faster, more targeted.

```sql
-- Index only active orders (90% of queries target active orders)
CREATE INDEX idx_orders_active ON orders(created_at)
    WHERE status = 'active';
-- 5% of rows indexed instead of 100% — 20x smaller index

-- Unique constraint for active records only (soft deletes)
CREATE UNIQUE INDEX idx_users_email_active ON users(email)
    WHERE deleted_at IS NULL;

-- Index for unprocessed jobs
CREATE INDEX idx_jobs_pending ON jobs(priority, created_at)
    WHERE status = 'pending';

-- Index for non-null values (skip nulls)
CREATE INDEX idx_users_phone ON users(phone)
    WHERE phone IS NOT NULL;
```

**When to use partial indexes:**
- When queries always filter on a specific condition
- Soft delete patterns (WHERE deleted_at IS NULL)
- Status-based filtering (WHERE status = 'active')
- Sparse data (column is NULL for 90% of rows)

---

### Covering Index (INCLUDE)

Include extra columns in the index to enable index-only scans — query satisfied entirely from the index without reading the heap.

```sql
-- Query: SELECT email, name FROM users WHERE email = 'alice@example.com'
-- Without INCLUDE: index lookup → heap fetch (2 I/O operations)
CREATE INDEX idx_users_email ON users(email);

-- With INCLUDE: index-only scan (1 I/O operation)
CREATE INDEX idx_users_email_covering ON users(email) INCLUDE (name, created_at);
-- email is searchable, name + created_at are stored but not searchable

-- Check if index-only scan is being used
EXPLAIN (ANALYZE, BUFFERS) SELECT email, name FROM users WHERE email = 'alice@example.com';
-- Look for: "Index Only Scan using idx_users_email_covering"
```

**INCLUDE vs composite index:**
- `CREATE INDEX ON t(a, b)` — both a and b are searchable and orderable
- `CREATE INDEX ON t(a) INCLUDE (b)` — only a is searchable, b is just stored data
- INCLUDE columns do not affect index ordering or lookup — just avoid heap reads

---

### GIN Index (Generalized Inverted Index)

For multi-valued data: arrays, JSONB, full-text search, trigram similarity.

```sql
-- JSONB containment queries
CREATE INDEX idx_events_payload ON events USING GIN (payload);
SELECT * FROM events WHERE payload @> '{"type": "purchase"}';

-- JSONB specific path (jsonb_path_ops — smaller, faster for @>)
CREATE INDEX idx_events_payload_pathops ON events USING GIN (payload jsonb_path_ops);
-- Supports only @> operator (not ?, ?|, ?&)
-- 2-3x smaller than default GIN on JSONB

-- Array containment
CREATE INDEX idx_posts_tags ON posts USING GIN (tags);
SELECT * FROM posts WHERE tags @> ARRAY['javascript', 'react'];

-- Full-text search
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);
SELECT * FROM articles WHERE search_vector @@ to_tsquery('database & optimization');

-- Trigram similarity (fuzzy matching)
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
SELECT * FROM products WHERE name % 'postgreSQl';  -- typo-tolerant
SELECT * FROM products WHERE name ILIKE '%postgres%';  -- substring search
```

**GIN characteristics:**
- Excellent read performance for containment queries
- Slower writes (must update inverted index)
- Larger than B-tree for scalar data
- Use `fastupdate = off` for write-heavy workloads to prevent long insert pauses

---

### GiST Index (Generalized Search Tree)

For spatial data, range types, nearest-neighbor, exclusion constraints.

```sql
-- Range overlap (booking systems)
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX idx_reservations_range ON reservations
    USING GiST (room_id, tstzrange(start_time, end_time));

-- EXCLUSION constraint uses GiST internally
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
);

-- PostGIS geospatial
CREATE INDEX idx_locations_geom ON locations USING GiST (geom);
SELECT * FROM locations
WHERE ST_DWithin(geom, ST_MakePoint(-73.99, 40.73)::geography, 1000);
-- Find locations within 1km of a point

-- ltree hierarchical queries
CREATE INDEX idx_categories_path ON categories USING GiST (path);
SELECT * FROM categories WHERE path <@ 'electronics.phones';

-- Nearest-neighbor search (KNN)
SELECT * FROM locations
ORDER BY geom <-> ST_MakePoint(-73.99, 40.73)::geometry
LIMIT 10;
-- Uses GiST index for efficient KNN (no full table scan)
```

---

### BRIN Index (Block Range Index)

Tiny index for large tables with naturally ordered data (timestamps, sequences).

```sql
-- Time-series data: created_at is naturally ordered (new rows at end)
CREATE INDEX idx_events_created_brin ON events USING BRIN (created_at)
    WITH (pages_per_range = 128);

-- BRIN stores min/max per block range, not individual rows
-- 1000x smaller than B-tree for timestamp columns on large tables
-- Effective when data is physically sorted by the indexed column
```

```
B-tree on 100M rows:     ~2 GB
BRIN on 100M rows:       ~50 KB (40,000x smaller)

BRIN structure:
┌────────────────────────────────────────────┐
│ Block Range  │  Min Value    │  Max Value  │
├──────────────┼───────────────┼─────────────┤
│ Pages 0-127  │  2024-01-01   │  2024-01-15 │
│ Pages 128-255│  2024-01-15   │  2024-02-01 │
│ Pages 256-383│  2024-02-01   │  2024-02-15 │
└────────────────────────────────────────────┘

Query: WHERE created_at = '2024-01-20'
→ Skip pages 0-127 (max < target)
→ Scan pages 128-255 (range contains target)
→ Skip pages 256+ (min > target)
```

**When to use BRIN:**
- Tables with 10M+ rows
- Data physically sorted by indexed column (append-only, time-series)
- Minimal storage budget for indexes
- Not for randomly inserted data (BRIN effectiveness drops)

---

### Hash Index

Equality-only lookups — no range queries, no sorting.

```sql
CREATE INDEX idx_sessions_token ON sessions USING HASH (token);
-- Only supports: WHERE token = 'abc123'
-- Does NOT support: WHERE token > 'abc' or ORDER BY token

-- Since PostgreSQL 10: hash indexes are WAL-logged and crash-safe
-- Use when: equality-only queries on high-cardinality columns
-- B-tree is usually preferred unless storage is critical
```

---

### Expression & Function Indexes

Index computed values, not raw columns.

```sql
-- Case-insensitive email lookup
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';

-- Date extraction from timestamp
CREATE INDEX idx_orders_month ON orders(date_trunc('month', created_at));
SELECT * FROM orders WHERE date_trunc('month', created_at) = '2024-06-01';

-- JSON field extraction
CREATE INDEX idx_events_type ON events((payload->>'event_type'));
SELECT * FROM events WHERE payload->>'event_type' = 'page_view';

-- Computed column index
CREATE INDEX idx_products_price_with_tax ON products((price * 1.2));
```

**Rule:** If a function or expression appears in WHERE clause, the index must use the same expression exactly.

---

### Index Maintenance & Monitoring

```sql
-- Index size and usage statistics
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;  -- least used indexes first

-- Find unused indexes (candidates for removal)
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    idx_scan AS scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'  -- keep primary keys
  AND indexrelname NOT LIKE '%unique%'  -- keep unique constraints
ORDER BY pg_relation_size(indexrelid) DESC;

-- Index bloat estimation
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    CASE WHEN idx_scan = 0 THEN 'NEVER USED'
         ELSE idx_scan::text || ' scans'
    END AS usage
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Reindex (rebuild bloated index)
REINDEX INDEX CONCURRENTLY idx_orders_user_id;  -- no lock (PostgreSQL 12+)
REINDEX TABLE CONCURRENTLY orders;               -- reindex all indexes on table

-- Create index concurrently (no lock on table during build)
CREATE INDEX CONCURRENTLY idx_orders_total ON orders(total);
-- Takes longer but does not block reads or writes
```

---

### EXPLAIN & Query Plan Analysis

```sql
-- Basic explain
EXPLAIN SELECT * FROM orders WHERE user_id = 42;
-- Shows query plan without executing

-- EXPLAIN ANALYZE (executes the query)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, o.total, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'active'
  AND o.created_at > '2024-01-01'
ORDER BY o.created_at DESC
LIMIT 10;
```

**Reading EXPLAIN output:**

```
Limit  (cost=0.71..45.23 rows=10 width=48) (actual time=0.05..0.12 rows=10 loops=1)
  ->  Nested Loop  (cost=0.71..4523.45 rows=1015 width=48) (actual time=0.05..0.11 rows=10)
        ->  Index Scan Backward using idx_orders_status_date on orders o
              (cost=0.42..2134.56 rows=1015 width=24) (actual time=0.03..0.05 rows=10)
              Index Cond: ((status = 'active') AND (created_at > '2024-01-01'))
        ->  Index Scan using users_pkey on users u
              (cost=0.29..2.35 rows=1 width=28) (actual time=0.01..0.01 rows=1 loops=10)
              Index Cond: (id = o.user_id)
Planning Time: 0.25 ms
Execution Time: 0.15 ms
Buffers: shared hit=35

Key terms:
  cost=start..total    Estimated cost (arbitrary units)
  rows=N               Estimated row count
  actual time=X..Y     Real start..total time in ms
  loops=N              How many times this node was executed
  Buffers: shared hit  Pages read from cache (good)
  Buffers: shared read Pages read from disk (potentially slow)
```

**Scan types (best to worst):**

| Scan Type | When Used | Performance |
|-----------|-----------|-------------|
| Index Only Scan | Index has all needed columns | Best |
| Index Scan | Index lookup → heap fetch | Good |
| Bitmap Index Scan | Multiple index conditions combined | Good |
| Index Scan Backward | ORDER BY DESC with matching index | Good |
| Seq Scan | No usable index or small table | Worst (for large tables) |

**Join types:**

| Join Type | When Used | Performance |
|-----------|-----------|-------------|
| Nested Loop | Small result sets, indexed inner | Best for small joins |
| Hash Join | Large, unsorted inputs | Good for medium joins |
| Merge Join | Both inputs sorted | Good for large sorted data |

---

## Best Practices

1. **ALWAYS create indexes on foreign key columns** — PostgreSQL does not auto-index FKs
2. **ALWAYS use partial indexes** for queries that always filter on a condition
3. **ALWAYS use INCLUDE** for covering indexes when query needs extra columns
4. **ALWAYS use GIN for JSONB, arrays, and full-text search** — not B-tree
5. **ALWAYS use BRIN for time-series data** on large append-only tables
6. **ALWAYS create indexes CONCURRENTLY** in production — prevents table lock
7. **ALWAYS check EXPLAIN ANALYZE** before adding indexes — verify the index is used
8. **ALWAYS use expression indexes** when WHERE clause uses functions (LOWER, date_trunc)
9. **NEVER create indexes on every column** — each index slows writes and consumes storage
10. **NEVER ignore unused indexes** — monitor pg_stat_user_indexes and drop unused ones

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No index on FK column | Slow JOINs, slow cascading DELETE | CREATE INDEX on every FK |
| B-tree on JSONB column | Index not used for @> queries | Use GIN index |
| Too many indexes | Slow INSERTs/UPDATEs, high disk usage | Remove unused indexes |
| Index not matching query expression | Seq scan despite index existing | Match index expression to WHERE exactly |
| CREATE INDEX (not CONCURRENTLY) in production | Table locked, queries blocked | Always use CONCURRENTLY |
| Composite index with wrong column order | Index not used for queries | Equality first, range last |
| Missing VACUUM on indexed tables | Index bloat, slow lookups | Monitor and tune autovacuum |
| BRIN on randomly inserted data | BRIN ineffective, still sequential scan | BRIN only for naturally sorted columns |
| Index on low-cardinality column alone | Planner ignores index (seq scan faster) | Combine with high-cardinality column |
| Not monitoring index sizes | Index exceeds table size | Periodic REINDEX CONCURRENTLY |

---

## Real-world Examples

### Shopify
- Partial indexes for active products per merchant (tenant_id + active filter)
- GIN indexes on JSONB metafields for custom product attribute queries
- BRIN indexes on massive order event tables (time-ordered, append-only)
- Composite indexes matching exact query patterns from pg_stat_statements

### GitHub
- Expression indexes on LOWER() for case-insensitive repository search
- GiST indexes for contribution heatmap range queries
- Covering indexes (INCLUDE) for dashboard queries avoiding heap reads
- Periodic unused index cleanup saving terabytes of storage

### Discord
- GIN trigram indexes for fuzzy server/channel name search
- Composite indexes with careful column ordering for message queries
- BRIN indexes on message tables (billions of rows, time-ordered)
- Partial indexes for unread messages per user

---

## Enforcement Checklist

- [ ] Every FK column has a B-tree index
- [ ] JSONB columns queried with @> have GIN indexes
- [ ] Full-text search columns use GIN on tsvector
- [ ] Time-series tables use BRIN instead of B-tree where applicable
- [ ] Partial indexes used for common filter conditions (status, deleted_at)
- [ ] Covering indexes (INCLUDE) used for frequent queries needing extra columns
- [ ] All production indexes created with CONCURRENTLY
- [ ] EXPLAIN ANALYZE verified for critical queries
- [ ] Composite index column order matches query patterns
- [ ] Unused indexes identified and scheduled for removal
- [ ] Index bloat monitored and REINDEX scheduled when needed
- [ ] Expression indexes match WHERE clause expressions exactly
