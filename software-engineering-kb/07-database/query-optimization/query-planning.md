# Query Planning & EXPLAIN

> **Domain:** Database > Query Optimization > Query Planning
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

The query planner is the database component that decides how to execute your SQL query — which indexes to use, which join algorithm (nested loop, hash, merge), and in what order to access tables. A poorly planned query can be 1000x slower than a well-planned one on the same data. Understanding how to read EXPLAIN output, identify bottlenecks, and guide the planner is the most practical database optimization skill. Every slow query investigation starts with EXPLAIN ANALYZE.

---

## How It Works

### EXPLAIN Fundamentals

```sql
-- PostgreSQL: EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status = 'pending'
GROUP BY u.id, u.name
ORDER BY order_count DESC
LIMIT 10;

-- Output (annotated):
Limit (cost=1234.56..1234.59 rows=10 width=40)
        (actual time=12.345..12.350 rows=10 loops=1)
  -> Sort (cost=1234.56..1240.00 rows=500 width=40)
          (actual time=12.340..12.345 rows=10 loops=1)
        Sort Key: (count(o.id)) DESC
        Sort Method: top-N heapsort  Memory: 25kB
        -> HashAggregate (cost=1200.00..1210.00 rows=500 width=40)
                          (actual time=11.000..11.200 rows=500 loops=1)
              -> Hash Join (cost=100.00..1100.00 rows=5000 width=36)
                            (actual time=1.000..8.000 rows=5000 loops=1)
                    Hash Cond: (o.user_id = u.id)
                    -> Seq Scan on orders o (cost=0.00..800.00 rows=5000 width=16)
                                             (actual time=0.010..5.000 rows=5000 loops=1)
                          Filter: (status = 'pending')
                          Rows Removed by Filter: 95000
                    -> Hash (cost=80.00..80.00 rows=1000 width=24)
                             (actual time=0.800..0.800 rows=1000 loops=1)
                          -> Seq Scan on users u (cost=0.00..80.00 rows=1000 width=24)
Planning Time: 0.200 ms
Execution Time: 12.500 ms
Buffers: shared hit=500 read=200
```

### Reading EXPLAIN Output

```
Key Metrics:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  cost=start..total                                     │
│    Estimated cost (arbitrary units, not milliseconds) │
│    Used by planner to choose between strategies       │
│                                                        │
│  actual time=start..total                              │
│    Real execution time in milliseconds                │
│    Only available with ANALYZE (actually runs query)  │
│                                                        │
│  rows=N                                                │
│    Estimated vs actual row count                      │
│    Large discrepancy = bad statistics → ANALYZE table │
│                                                        │
│  loops=N                                               │
│    Number of times this node executed                  │
│    Multiply actual time × loops for total              │
│                                                        │
│  Buffers: shared hit=N read=N                          │
│    hit = pages served from cache (fast)               │
│    read = pages read from disk (slow)                 │
│    High read count = data not fitting in memory       │
└──────────────────────────────────────────────────────┘
```

### Scan Types

| Scan Type | Description | When Used | Speed |
|-----------|-------------|-----------|-------|
| **Seq Scan** | Read every row in table | No useful index, small table | Slow (large tables) |
| **Index Scan** | Look up rows via index, then fetch from table | Index exists, selective | Fast |
| **Index Only Scan** | Answer query from index alone (covering) | All needed columns in index | Fastest |
| **Bitmap Index Scan** | Build bitmap from index, then scan table | Multiple conditions, medium selectivity | Medium-Fast |
| **Parallel Seq Scan** | Sequential scan across multiple workers | Large table, no useful index | Faster than seq |

### Join Algorithms

| Algorithm | When Used | Memory | Best For |
|-----------|-----------|--------|----------|
| **Nested Loop** | Small inner table or indexed inner | Low | Small tables, indexed lookups |
| **Hash Join** | Medium-large tables, equality join | work_mem | Equality JOINs, no index |
| **Merge Join** | Pre-sorted data or sorted index | Low | Already sorted, large tables |

### Red Flags in EXPLAIN

```
Red Flags to Watch For:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  ❌ Seq Scan on large table                           │
│     Fix: add index on WHERE/JOIN columns              │
│                                                        │
│  ❌ estimated rows ≠ actual rows (off by 10x+)       │
│     Fix: ANALYZE table (update statistics)            │
│                                                        │
│  ❌ Nested Loop with large inner table                │
│     Fix: add index or restructure query               │
│                                                        │
│  ❌ Sort with disk sort (external merge)              │
│     Fix: increase work_mem or add sorted index        │
│                                                        │
│  ❌ High Buffers read (vs hit)                        │
│     Fix: increase shared_buffers or optimize query    │
│                                                        │
│  ❌ Rows Removed by Filter: very high                 │
│     Fix: more selective index or partial index        │
│                                                        │
│  ❌ loops=10000+ on inner node                        │
│     Fix: consider hash join, add index                │
└──────────────────────────────────────────────────────┘
```

### Query Optimization Workflow

```
Optimization Steps:
1. EXPLAIN ANALYZE the slow query
2. Identify bottleneck (scan type, join type, sort)
3. Check if index exists for WHERE/JOIN columns
4. Check statistics (estimated vs actual rows)
5. Add index → re-run EXPLAIN ANALYZE
6. If still slow: rewrite query (subquery → JOIN, etc.)
7. If still slow: tune PostgreSQL settings (work_mem)
```

```sql
-- Step 1: Find slow queries (pg_stat_statements)
SELECT
    query,
    calls,
    mean_exec_time AS avg_ms,
    total_exec_time / 1000 AS total_seconds,
    rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Step 2: EXPLAIN the worst one
EXPLAIN (ANALYZE, BUFFERS) [paste query here];

-- Step 3: Update statistics if estimates are wrong
ANALYZE orders;  -- update statistics for specific table
ANALYZE;         -- update all tables

-- Step 4: After adding index, verify improvement
EXPLAIN (ANALYZE, BUFFERS) [same query];
-- Compare execution time before/after
```

---

## Best Practices

1. **ALWAYS use EXPLAIN ANALYZE** (not just EXPLAIN) — estimated costs can be misleading
2. **ALWAYS include BUFFERS** — reveals cache hits vs disk reads
3. **ALWAYS check estimated vs actual rows** — mismatches indicate stale statistics
4. **ALWAYS run ANALYZE after bulk data changes** — keeps planner statistics current
5. **ALWAYS start optimization with the slowest queries** — pg_stat_statements identifies them
6. **NEVER optimize queries without EXPLAIN** — intuition is often wrong
7. **NEVER ignore planner statistics** — stale stats cause bad plans
8. **NEVER assume index = faster** — small tables may be faster with seq scan

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No EXPLAIN before optimizing | Guessing, wrong fix applied | Always EXPLAIN ANALYZE first |
| Stale statistics | Planner chooses wrong plan | ANALYZE after bulk changes |
| Ignoring loops count | Underestimating total time | Multiply time × loops |
| Force-hinting indexes | Planner knows better usually | Fix statistics instead |
| Not monitoring slow queries | Don't know what to optimize | Enable pg_stat_statements |

---

## Enforcement Checklist

- [ ] EXPLAIN ANALYZE run on all critical query paths
- [ ] pg_stat_statements enabled and monitored
- [ ] ANALYZE run after bulk data loads
- [ ] No sequential scans on large tables without justification
- [ ] Estimated vs actual row counts within 10x
- [ ] Query optimization workflow documented for team
