# Indexing Strategies

> **Domain:** Database > Query Optimization > Indexing
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Indexes are the single most impactful database optimization. A missing index turns a 5ms query into a 5-second full table scan. An unnecessary index wastes storage, slows writes, and increases VACUUM time. Understanding which columns to index, which index type to use, and when indexes hurt performance is essential for every developer who writes SQL queries. This document covers cross-database indexing strategy — for database-specific index types (GIN, GiST, BRIN), see the PostgreSQL indexing document.

---

## How It Works

### Index Fundamentals

```
Without Index (Sequential Scan):
  Scan ALL 10,000,000 rows to find matches
  O(n) — time grows linearly with data

  SELECT * FROM users WHERE email = 'alice@example.com';
  → Scan 10M rows → find 1 match → 2-5 seconds

With Index (B-Tree Lookup):
  Navigate tree to find matching rows directly
  O(log n) — time grows logarithmically

  SELECT * FROM users WHERE email = 'alice@example.com';
  → Navigate B-tree (3-4 levels) → find 1 match → < 1ms
```

### What to Index

```
Index These (High Impact):
┌──────────────────────────────────────────────────────┐
│                                                        │
│  1. Primary key columns (automatic)                   │
│  2. Foreign key columns (JOIN performance)            │
│  3. Columns in WHERE clauses (filter performance)    │
│  4. Columns in ORDER BY (avoid sort)                 │
│  5. Columns in GROUP BY (aggregation performance)    │
│  6. Columns used in UNIQUE constraints               │
│                                                        │
│  DO NOT Index These:                                   │
│  1. Low-cardinality columns (boolean, status)         │
│     → Exception: partial index WHERE status = 'active'│
│  2. Columns rarely used in WHERE                      │
│  3. Small tables (< 1000 rows, scan is fine)         │
│  4. Frequently updated columns (index maintenance)   │
│  5. Wide columns (long text, JSON as B-tree)         │
└──────────────────────────────────────────────────────┘
```

### Composite Index Strategy

```sql
-- Composite (multi-column) index
CREATE INDEX idx_orders_user_status ON orders (user_id, status, created_at);

-- Leftmost prefix rule:
-- This index serves queries on:
-- ✅ WHERE user_id = ?
-- ✅ WHERE user_id = ? AND status = ?
-- ✅ WHERE user_id = ? AND status = ? AND created_at > ?
-- ❌ WHERE status = ? (user_id not included → index not used)
-- ❌ WHERE created_at > ? (skips user_id and status)

-- Column order matters! Put these first:
-- 1. Equality conditions (user_id = ?)
-- 2. Range conditions (created_at > ?)
-- 3. Sort columns (ORDER BY created_at)

-- Example: optimize this query
SELECT * FROM orders
WHERE user_id = 123 AND status = 'pending'
ORDER BY created_at DESC
LIMIT 10;

-- Optimal index:
CREATE INDEX idx_orders_lookup ON orders (user_id, status, created_at DESC);
-- Equality first (user_id, status), then sort (created_at DESC)
```

### Covering Index

```sql
-- Covering index: includes all columns needed by query
-- The database can answer the query from the index alone
-- (no need to read the table — "index-only scan")

-- Query:
SELECT user_id, status, created_at FROM orders
WHERE user_id = 123 AND status = 'pending';

-- Covering index (PostgreSQL INCLUDE):
CREATE INDEX idx_orders_covering ON orders (user_id, status)
INCLUDE (created_at);
-- created_at is stored in index but not used for lookup

-- Without covering index: index scan → table lookup (random I/O)
-- With covering index: index-only scan (no table access)
```

### Partial Index

```sql
-- Partial index: index only rows matching a condition
-- Smaller, faster, less maintenance

-- Only index active users (90% are inactive)
CREATE INDEX idx_users_active_email ON users (email)
WHERE active = true;
-- Index is 90% smaller than full index

-- Only index pending orders
CREATE INDEX idx_orders_pending ON orders (created_at)
WHERE status = 'pending';
-- Query: SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at

-- Partial unique index
CREATE UNIQUE INDEX idx_users_active_email_unique ON users (email)
WHERE deleted_at IS NULL;
-- Allows duplicate emails for soft-deleted users
```

### Index Monitoring

```sql
-- PostgreSQL: find unused indexes
SELECT
    schemaname, relname AS table_name, indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
    idx_scan AS times_used
FROM pg_stat_user_indexes i
JOIN pg_index USING (indexrelid)
WHERE idx_scan = 0
  AND NOT indisunique  -- keep unique constraints
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- PostgreSQL: find missing indexes (sequential scans)
SELECT
    relname AS table_name,
    seq_scan, idx_scan,
    seq_tup_read,
    CASE WHEN seq_scan > 0
         THEN seq_tup_read / seq_scan
         ELSE 0
    END AS avg_rows_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100  -- tables with many sequential scans
ORDER BY seq_tup_read DESC;

-- MySQL: find unused indexes
SELECT
    object_schema, object_name, index_name,
    count_star AS times_used
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE index_name IS NOT NULL AND count_star = 0
ORDER BY object_schema, object_name;
```

---

## Best Practices

1. **ALWAYS index foreign key columns** — JOINs without FK indexes cause sequential scans
2. **ALWAYS use composite indexes** for multi-column WHERE clauses — single-column indexes are less effective
3. **ALWAYS put equality columns first** in composite indexes, range columns last
4. **ALWAYS use partial indexes** for selective queries — smaller, faster
5. **ALWAYS monitor unused indexes** — remove them (waste storage, slow writes)
6. **ALWAYS use EXPLAIN** to verify index usage before and after adding indexes
7. **NEVER index everything** — each index slows INSERT/UPDATE/DELETE
8. **NEVER use B-tree index on low-cardinality boolean** — partial index instead
9. **NEVER add duplicate indexes** — composite (a, b) already covers queries on (a)
10. **NEVER index columns that change frequently** — high update overhead

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No FK indexes | Slow JOINs, sequential scans | Index all foreign key columns |
| Wrong column order in composite | Index not used for query | Equality first, range last |
| Duplicate indexes | Wasted storage, slow writes | Drop redundant indexes |
| Index on boolean column | Index scan slower than seq scan | Partial index WHERE bool = true |
| Too many indexes on write-heavy table | Slow inserts/updates | Remove unused indexes |
| Never checking EXPLAIN | Don't know if indexes are used | EXPLAIN ANALYZE critical queries |
| Indexing for SELECT * | Covering index impossible | Select only needed columns |

---

## Enforcement Checklist

- [ ] All foreign key columns indexed
- [ ] Composite indexes ordered correctly (equality → range → sort)
- [ ] Covering indexes used for critical query paths
- [ ] Partial indexes used for selective predicates
- [ ] Unused indexes identified and removed quarterly
- [ ] EXPLAIN ANALYZE run on critical queries
- [ ] Index sizes monitored (not exceeding table size)
