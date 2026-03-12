# Query Performance Engineering

> **Domain:** Performance > Database Performance > Query Optimization
> **Importance:** CRITICAL
> **Perspective:** Measurement, diagnosis, and systematic optimization
> **Cross-ref:** 07-database/query-optimization/query-planning.md, 07-database/query-optimization/n-plus-one-problem.md

## Core Methodology

Performance engineering treats queries as measurable units. Every optimization must be quantified with before/after metrics: execution time, rows scanned, buffer hits/reads, I/O wait.

### EXPLAIN ANALYZE Interpretation Framework

```sql
-- PostgreSQL: full diagnostic output
EXPLAIN (ANALYZE, BUFFERS, TIMING, FORMAT TEXT)
SELECT o.id, o.total, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'shipped' AND o.created_at > '2025-01-01'
ORDER BY o.created_at DESC LIMIT 20;

-- Key metrics to extract:
-- 1. Total execution time (bottom line)
-- 2. Costliest node (highest actual time * loops)
-- 3. Row estimate accuracy (estimated vs actual)
-- 4. Buffer efficiency (shared hit vs read ratio)
-- 5. Sort method (in-memory vs disk)
```

```
Diagnostic Decision Tree:
┌─────────────────────────────────────────────────────┐
│ actual_rows >> estimated_rows (10x+)?               │
│   YES → Run ANALYZE on table, check statistics      │
│                                                      │
│ Seq Scan on table > 10K rows?                       │
│   YES → Missing index on WHERE/JOIN columns         │
│                                                      │
│ Nested Loop with loops > 1000?                      │
│   YES → Missing index on inner table, or rewrite    │
│                                                      │
│ Sort Method: external merge (disk)?                 │
│   YES → Increase work_mem or add index on ORDER BY  │
│                                                      │
│ Buffers: shared read >> shared hit?                 │
│   YES → Working set exceeds shared_buffers          │
│                                                      │
│ Planning Time > Execution Time?                     │
│   YES → Too many partitions or JOINs for planner    │
└─────────────────────────────────────────────────────┘
```

### MySQL EXPLAIN ANALYZE

```sql
-- MySQL 8.0.18+: tree format with actual timing
EXPLAIN ANALYZE
SELECT o.id, o.total, u.name
FROM orders o JOIN users u ON u.id = o.user_id
WHERE o.status = 'shipped' LIMIT 20;

-- MySQL EXPLAIN FORMAT=JSON for cost breakdown
EXPLAIN FORMAT=JSON SELECT ...;
-- Check: "query_cost", "rows_examined_per_scan", "access_type"
-- access_type priority: system > const > eq_ref > ref > range > index > ALL
```

### Slow Query Logging and Analysis

```sql
-- PostgreSQL: enable pg_stat_statements (MUST-HAVE)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top queries by total time (find biggest aggregate impact)
SELECT query, calls, mean_exec_time AS avg_ms,
  total_exec_time / 1000 AS total_sec,
  stddev_exec_time AS stddev_ms,
  rows, shared_blks_hit, shared_blks_read
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;

-- Queries with worst hit ratio (I/O bound)
SELECT query, calls,
  shared_blks_hit + shared_blks_read AS total_blks,
  ROUND(100.0 * shared_blks_hit /
    NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS hit_pct
FROM pg_stat_statements
WHERE calls > 100
ORDER BY hit_pct ASC LIMIT 10;

-- MySQL: slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;  -- 500ms threshold
SET GLOBAL log_queries_not_using_indexes = 'ON';
-- Analyze with: pt-query-digest /var/log/mysql/slow.log
```

### Query Timeout Configuration

```sql
-- PostgreSQL: per-role statement timeout
ALTER ROLE web_app SET statement_timeout = '5s';
ALTER ROLE reporting SET statement_timeout = '120s';
-- Per-transaction override
SET LOCAL statement_timeout = '30s';

-- MySQL: per-session max execution time
SET SESSION MAX_EXECUTION_TIME = 5000; -- 5 seconds
-- Per-query hint
SELECT /*+ MAX_EXECUTION_TIME(5000) */ * FROM orders WHERE ...;
```

### Query Rewriting Techniques

```sql
-- 1. Subquery to JOIN (planner often does this, but not always)
-- SLOW: correlated subquery executes per row
SELECT * FROM orders o
WHERE o.total > (SELECT AVG(total) FROM orders WHERE user_id = o.user_id);
-- FAST: single aggregation pass
SELECT o.* FROM orders o
JOIN (SELECT user_id, AVG(total) AS avg_total FROM orders GROUP BY user_id) a
  ON o.user_id = a.user_id WHERE o.total > a.avg_total;

-- 2. EXISTS vs IN (EXISTS short-circuits)
-- Prefer EXISTS for large subquery result sets
SELECT * FROM users u WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status = 'pending'
);

-- 3. UNION ALL vs UNION (skip dedup when not needed)
SELECT id FROM orders WHERE status = 'pending'
UNION ALL  -- 2x faster than UNION, no sort/dedup
SELECT id FROM orders WHERE status = 'processing';

-- 4. Pagination: keyset over OFFSET
-- SLOW: OFFSET scans and discards rows
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 10000;
-- FAST: keyset pagination seeks directly
SELECT * FROM orders WHERE id > $last_seen_id ORDER BY id LIMIT 20;
```

### Batch Operations

```sql
-- Bulk INSERT (PostgreSQL)
INSERT INTO events (user_id, event_type, created_at)
VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9) -- batch 1000 rows
ON CONFLICT (user_id, event_type, created_at) DO NOTHING;

-- Bulk UPSERT
INSERT INTO product_inventory (sku, quantity, updated_at)
VALUES ($1, $2, NOW()), ($3, $4, NOW())
ON CONFLICT (sku) DO UPDATE SET
  quantity = EXCLUDED.quantity, updated_at = NOW();

-- MySQL bulk insert
INSERT INTO events (user_id, event_type, created_at)
VALUES (1, 'click', NOW()), (2, 'view', NOW())
ON DUPLICATE KEY UPDATE event_type = VALUES(event_type);
```

```typescript
// TypeScript: batched inserts with parameterized chunks
async function batchInsert(pool: Pool, rows: EventRow[]): Promise<void> {
  const BATCH_SIZE = 1000;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const placeholders = chunk.map((row, idx) => {
      const offset = idx * 3;
      values.push(row.userId, row.eventType, row.createdAt);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    });
    await pool.query(
      `INSERT INTO events (user_id, event_type, created_at) VALUES ${placeholders.join(',')}`,
      values
    );
  }
}
```

```go
// Go: pgx CopyFrom for maximum throughput (PostgreSQL)
func bulkInsert(ctx context.Context, pool *pgxpool.Pool, events []Event) error {
    rows := make([][]interface{}, len(events))
    for i, e := range events {
        rows[i] = []interface{}{e.UserID, e.EventType, e.CreatedAt}
    }
    _, err := pool.CopyFrom(ctx,
        pgx.Identifier{"events"},
        []string{"user_id", "event_type", "created_at"},
        pgx.CopyFromRows(rows),
    )
    return err // COPY is 5-10x faster than multi-row INSERT
}
```

### Prepared Statements

```sql
-- PostgreSQL: server-side prepared statements
PREPARE get_orders (int, text) AS
  SELECT * FROM orders WHERE user_id = $1 AND status = $2;
EXECUTE get_orders(42, 'pending');
-- Benefits: parse once, plan once (or generic plan after 5 executions)
-- Caveat: PgBouncer transaction mode requires protocol-level prepared stmts
```

```python
# Python: psycopg prepared statement reuse
import psycopg
conn = psycopg.connect(dsn)
conn.execute("PREPARE user_orders AS SELECT * FROM orders WHERE user_id = $1")
# Subsequent calls skip parse+plan
for uid in user_ids:
    conn.execute("EXECUTE user_orders(%s)", (uid,))
```

### N+1 Detection (Performance Engineering Perspective)

```typescript
// Middleware: count queries per request and alert
function n1Detector(pool: Pool, threshold = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    let count = 0;
    const queries: string[] = [];
    const origQuery = pool.query.bind(pool);
    pool.query = ((...args: any[]) => {
      count++;
      queries.push(String(args[0]).substring(0, 80));
      return origQuery(...args);
    }) as any;

    res.on('finish', () => {
      if (count > threshold) {
        console.warn(`N+1 DETECTED: ${req.method} ${req.path} — ${count} queries`);
        // Group by query template to find repeated patterns
        const freq = queries.reduce((m, q) => m.set(q, (m.get(q) || 0) + 1), new Map());
        for (const [q, n] of freq) { if (n > 2) console.warn(`  ${n}x: ${q}`); }
      }
    });
    next();
  };
}
```

```python
# Django: auto-detect N+1 with nplusone library
# pip install nplusone
INSTALLED_APPS = ['nplusone.ext.django']
MIDDLEWARE = ['nplusone.ext.django.NPlusOneMiddleware']
NPLUSONE_RAISE = True  # raise exception on N+1 in dev
```

---

## 10 Best Practices

1. **Run EXPLAIN ANALYZE on every query taking >100ms** — measure before optimizing.
2. **Use pg_stat_statements or Performance Schema** as the single source of truth for slow queries.
3. **Set statement_timeout per role** — web: 5s, API: 10s, reports: 120s.
4. **Batch inserts in groups of 500-1000 rows** — use COPY for >10K rows.
5. **Use keyset pagination instead of OFFSET** — OFFSET degrades linearly with page depth.
6. **Prefer EXISTS over IN for large subqueries** — EXISTS short-circuits on first match.
7. **Deploy N+1 detection middleware in development** — catch problems before production.
8. **Use prepared statements for repeated queries** — eliminates parse/plan overhead.
9. **Log and alert on queries exceeding P99 latency** — track regression over time.
10. **Compare estimated vs actual rows in EXPLAIN** — >10x mismatch means stale statistics.

---

## 8 Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Optimizing without EXPLAIN | Wrong fix, wasted effort | Always EXPLAIN ANALYZE first |
| No query timeout | Runaway queries consume all connections | Set statement_timeout per role |
| Row-by-row inserts in a loop | 100x slower than batch | Batch 500-1000 rows per INSERT |
| OFFSET pagination at depth | Scans all skipped rows | Keyset (WHERE id > last) pagination |
| SELECT * in production queries | Prevents covering index scans | Select only needed columns |
| Ignoring planning time in EXPLAIN | Hidden cost with many partitions | Reduce partition count or use constraint exclusion |
| No N+1 detection | Silent 100x query multiplication | Add detection middleware + alerting |
| UNION instead of UNION ALL | Unnecessary sort and dedup | Use UNION ALL when duplicates acceptable |

---

## Enforcement Checklist

- [ ] pg_stat_statements or Performance Schema enabled and reviewed weekly
- [ ] statement_timeout configured per database role
- [ ] EXPLAIN ANALYZE documented for all critical query paths
- [ ] Batch insert used for bulk operations (>10 rows)
- [ ] Keyset pagination used for all paginated endpoints
- [ ] N+1 detection middleware active in development
- [ ] Slow query log enabled with threshold <= 1s
- [ ] Prepared statements used for high-frequency queries
- [ ] Query latency P50/P95/P99 tracked in monitoring dashboard
- [ ] Statistics freshness verified (ANALYZE runs after bulk loads)
