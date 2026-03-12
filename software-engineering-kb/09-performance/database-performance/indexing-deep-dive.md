# Index Performance Engineering

> **Domain:** Performance > Database Performance > Indexing Deep Dive
> **Importance:** CRITICAL
> **Perspective:** Index type selection, performance impact quantification, maintenance overhead
> **Cross-ref:** 07-database/query-optimization/indexing-strategies.md, 07-database/relational/postgresql/indexing.md

## Index Type Selection Matrix

Choose index type based on data type, query pattern, and table size.

```
┌──────────────┬─────────────────┬──────────────────┬─────────────────┐
│ Index Type   │ Best For        │ Operators        │ Overhead        │
├──────────────┼─────────────────┼──────────────────┼─────────────────┤
│ B-Tree       │ Scalar equality │ = < > <= >= LIKE │ Low write cost  │
│              │ and range       │ BETWEEN, IS NULL │ Medium size     │
├──────────────┼─────────────────┼──────────────────┼─────────────────┤
│ Hash         │ Equality only   │ = only           │ Lowest write    │
│              │ (PG 10+)        │ No range support │ Smallest size   │
├──────────────┼─────────────────┼──────────────────┼─────────────────┤
│ GIN          │ Multi-value     │ @> <@ ? ?| ?&    │ HIGH write cost │
│              │ JSONB, arrays   │ Full-text @@     │ Large size      │
│              │ trgm similarity │ ILIKE, similarity│                 │
├──────────────┼─────────────────┼──────────────────┼─────────────────┤
│ GiST         │ Spatial, ranges │ && <-> @> <<     │ Medium write    │
│              │ geometric types │ Nearest-neighbor │ Medium size     │
│              │ ltree, inet     │ KNN search       │                 │
├──────────────┼─────────────────┼──────────────────┼─────────────────┤
│ BRIN         │ Physically      │ = < > <= >=      │ Minimal write   │
│              │ sorted data     │ (block ranges)   │ Tiny size       │
│              │ time-series,    │                  │ 1000x smaller   │
│              │ append-only     │                  │ than B-Tree     │
└──────────────┴─────────────────┴──────────────────┴─────────────────┘
```

### When to Use Each Type

```sql
-- B-Tree (95% of cases): equality + range on scalar columns
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_orders_date ON orders (created_at);

-- Hash: pure equality lookups, smaller than B-Tree
CREATE INDEX idx_sessions_token ON sessions USING hash (session_token);
-- Only useful when you NEVER do range queries on this column

-- GIN: JSONB containment, array operations, full-text search
CREATE INDEX idx_products_attrs ON products USING gin (attributes jsonb_path_ops);
CREATE INDEX idx_posts_search ON posts USING gin (to_tsvector('english', body));
CREATE INDEX idx_tags_arr ON articles USING gin (tags);
-- GIN is 3-10x slower on writes than B-Tree. Use pending_list_cleanup_size

-- GiST: spatial queries, range overlaps, nearest-neighbor
CREATE INDEX idx_locations_geo ON locations USING gist (coordinates);
CREATE INDEX idx_reservations_period ON reservations USING gist (
  tstzrange(start_time, end_time)
);

-- BRIN: time-series data with physical correlation to insertion order
CREATE INDEX idx_logs_ts ON access_logs USING brin (created_at)
  WITH (pages_per_range = 32);
-- 1000x smaller than B-Tree, effective when data is physically ordered
-- Check correlation: SELECT correlation FROM pg_stats WHERE tablename='access_logs'
--   correlation > 0.9 → BRIN is effective
--   correlation < 0.5 → BRIN is useless, use B-Tree
```

## Composite Index Column Ordering

The leftmost prefix rule determines whether an index serves a query.

```sql
-- Index: (tenant_id, status, created_at)
-- Serves these queries:
--   WHERE tenant_id = 1                                    ✓ (prefix match)
--   WHERE tenant_id = 1 AND status = 'active'              ✓ (prefix match)
--   WHERE tenant_id = 1 AND status = 'active'
--     AND created_at > '2025-01-01'                         ✓ (full match)
--   WHERE tenant_id = 1 ORDER BY created_at                 ✓ (skip scan PG17+)
-- Does NOT serve:
--   WHERE status = 'active'                                 ✗ (no leading col)
--   WHERE created_at > '2025-01-01'                         ✗ (no leading col)

-- ORDERING RULE: equality → range → sort
-- Given query:
SELECT * FROM orders
WHERE tenant_id = $1 AND total > 100
ORDER BY created_at DESC LIMIT 20;

-- Optimal composite: equality columns first, then range, then sort
CREATE INDEX idx_orders_opt ON orders (tenant_id, created_at DESC)
  WHERE total > 100;  -- partial index handles the range filter
```

## Covering Indexes (Index-Only Scans)

```sql
-- Covering index: all columns needed by query stored in the index
-- PostgreSQL INCLUDE syntax (columns stored but not searchable)
CREATE INDEX idx_orders_covering ON orders (user_id, status)
  INCLUDE (total, created_at);

-- Query answered entirely from index (no heap access)
SELECT total, created_at FROM orders
WHERE user_id = 42 AND status = 'shipped';
-- EXPLAIN shows: Index Only Scan

-- Verify index-only scan effectiveness
SELECT relname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes WHERE relname = 'idx_orders_covering';
-- idx_tup_fetch = 0 means pure index-only scans (ideal)

-- MySQL: all-column covering index (no INCLUDE keyword)
CREATE INDEX idx_orders_cov ON orders (user_id, status, total, created_at);
-- Must include ALL selected columns in the index key
```

## Partial (Filtered) Indexes

```sql
-- Partial index: index only rows matching a condition
-- Dramatically smaller when filtering eliminates >80% of rows

-- Only 5% of orders are 'pending'
CREATE INDEX idx_orders_pending ON orders (created_at)
  WHERE status = 'pending';
-- Index is 20x smaller than full index
-- Faster writes: only pending orders update this index

-- Active users only (90% are inactive)
CREATE INDEX idx_users_active ON users (email)
  WHERE is_active = true;

-- Partial unique: enforce uniqueness with exceptions
CREATE UNIQUE INDEX idx_email_uniq ON users (email)
  WHERE deleted_at IS NULL;

-- Measure size savings
SELECT pg_size_pretty(pg_relation_size('idx_orders_pending')) AS partial_size;
SELECT pg_size_pretty(pg_relation_size('idx_orders_date')) AS full_size;
```

## Expression Indexes

```sql
-- Index on computed expressions
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
-- Query MUST match expression exactly:
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com'; -- uses index
SELECT * FROM users WHERE email = 'Alice@example.com';         -- does NOT

-- Date truncation for time-bucketed queries
CREATE INDEX idx_events_day ON events (date_trunc('day', created_at));
SELECT date_trunc('day', created_at) AS day, COUNT(*)
FROM events GROUP BY 1; -- uses index

-- MySQL 8.0 functional index
CREATE INDEX idx_users_email_lower ON users ((LOWER(email)));
```

## Index Maintenance and Overhead

```sql
-- Measure write overhead per index (PostgreSQL)
-- Each index adds ~30-50% overhead per INSERT on that table
-- Rule of thumb: 5 indexes → writes are ~2.5x slower than unindexed

-- Monitor index size vs table size
SELECT t.relname AS table_name,
  pg_size_pretty(pg_relation_size(t.oid)) AS table_size,
  pg_size_pretty(pg_indexes_size(t.oid)) AS total_index_size,
  ROUND(100.0 * pg_indexes_size(t.oid) / pg_relation_size(t.oid), 1) AS idx_pct
FROM pg_class t
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public' AND t.relkind = 'r'
ORDER BY pg_indexes_size(t.oid) DESC;
-- Alert when idx_pct > 200% (indexes larger than table)

-- Index bloat estimation
SELECT schemaname, tablename, indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC LIMIT 20;
-- Rebuild bloated indexes: REINDEX CONCURRENTLY idx_name;
```

## Over-Indexing Detection

```sql
-- Find unused indexes (PostgreSQL)
SELECT s.schemaname, s.relname AS table, s.indexrelname AS index,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
  s.idx_scan AS scans
FROM pg_stat_user_indexes s
JOIN pg_index i ON s.indexrelid = i.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
  AND s.schemaname = 'public'
ORDER BY pg_relation_size(s.indexrelid) DESC;
-- Review after 30 days of production traffic, then DROP unused

-- Find duplicate/redundant indexes
SELECT a.indexrelid::regclass AS idx_a, b.indexrelid::regclass AS idx_b,
  pg_size_pretty(pg_relation_size(a.indexrelid)) AS size_a
FROM pg_index a, pg_index b
WHERE a.indrelid = b.indrelid AND a.indexrelid <> b.indexrelid
  AND a.indkey::text LIKE b.indkey::text || '%'
  AND a.indrelid::regclass::text NOT LIKE 'pg_%';
-- (a, b) makes (a) redundant — drop the shorter one

-- MySQL: invisible index before dropping
ALTER TABLE orders ALTER INDEX idx_orders_old INVISIBLE;
-- Wait 7 days, verify no performance regression, then DROP
```

## Monitoring Index Effectiveness

```sql
-- Index hit rate per table (should be > 95% for tables > 10K rows)
SELECT relname,
  CASE WHEN idx_scan + seq_scan = 0 THEN 0
    ELSE ROUND(100.0 * idx_scan / (idx_scan + seq_scan), 1)
  END AS idx_hit_pct,
  seq_scan, idx_scan, n_live_tup
FROM pg_stat_user_tables
WHERE n_live_tup > 10000
ORDER BY idx_hit_pct ASC;

-- Tables with high sequential scan count (candidates for new indexes)
SELECT relname, seq_scan, seq_tup_read,
  seq_tup_read / GREATEST(seq_scan, 1) AS avg_rows_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 50 AND n_live_tup > 10000
ORDER BY seq_tup_read DESC LIMIT 10;
```

```typescript
// TypeScript: index usage monitoring dashboard export
async function getIndexHealth(pool: Pool) {
  const { rows: unused } = await pool.query(`
    SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0 AND schemaname = 'public'
    ORDER BY pg_relation_size(indexrelid) DESC LIMIT 10
  `);
  const { rows: bloated } = await pool.query(`
    SELECT relname, idx_pct FROM (
      SELECT t.relname,
        ROUND(100.0 * pg_indexes_size(t.oid) / GREATEST(pg_relation_size(t.oid),1), 1) AS idx_pct
      FROM pg_class t JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public' AND t.relkind = 'r'
    ) sub WHERE idx_pct > 200 ORDER BY idx_pct DESC
  `);
  return { unused, bloated };
}
```

---

## 10 Best Practices

1. **Check correlation before choosing BRIN** — `pg_stats.correlation > 0.9` required for effectiveness.
2. **Use GIN with `jsonb_path_ops`** for JSONB containment — 60% smaller than default GIN.
3. **Use partial indexes** when filter eliminates >80% of rows — dramatically smaller and faster.
4. **Order composite index columns** as equality, then range, then sort.
5. **Add INCLUDE columns** for covering indexes instead of widening the key.
6. **Audit unused indexes monthly** — each wastes write throughput and storage.
7. **Monitor index-to-table size ratio** — alert when indexes exceed 200% of table size.
8. **REINDEX CONCURRENTLY** to fix bloated indexes without locking.
9. **Use MySQL invisible indexes** to test dropping safely before committing.
10. **Verify index-only scans** with `idx_tup_fetch = 0` in pg_stat_user_indexes.

---

## 8 Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| B-Tree on JSONB containment queries | Index not used, seq scan | Use GIN with jsonb_path_ops |
| BRIN on randomly ordered data | Scans all block ranges | Check correlation; use B-Tree instead |
| Composite index wrong column order | Index ignored by planner | Equality first, range last |
| Indexing every column individually | 5x write slowdown, storage waste | Composite indexes for query patterns |
| Never removing unused indexes | Write overhead on dead indexes | Audit and drop after 30 days unused |
| Expression mismatch with expression index | Index not selected | Query must match exact expression |
| Covering index with too many INCLUDE cols | Bloated index, slow maintenance | Include only columns needed by hot queries |
| Full index when partial would suffice | 20x larger than necessary | Add WHERE clause to index definition |

---

## Enforcement Checklist

- [ ] Index type selection justified per data type and query pattern
- [ ] BRIN used only on columns with correlation > 0.9
- [ ] GIN indexes have fastupdate and pending_list_cleanup_size tuned
- [ ] Composite index column order matches equality-range-sort pattern
- [ ] Covering indexes verified with EXPLAIN showing Index Only Scan
- [ ] Partial indexes used for selective predicates (>80% filter rate)
- [ ] Unused index audit runs monthly with results actioned
- [ ] Index-to-table size ratio monitored (alert at >200%)
- [ ] Redundant/duplicate indexes identified and removed
- [ ] Expression indexes match query expressions exactly
