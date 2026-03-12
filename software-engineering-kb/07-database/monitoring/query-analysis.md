# Slow Query Analysis & Profiling

> **Domain:** Database > Monitoring > Query Analysis
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Slow queries are the #1 cause of application performance degradation. A single unoptimized query running 1,000 times per minute can consume 50% of database CPU. Identifying, analyzing, and optimizing slow queries requires systematic profiling — not guesswork. PostgreSQL's pg_stat_statements and MySQL's slow query log provide the data; EXPLAIN ANALYZE provides the diagnosis. Every production database MUST have slow query identification, and every team MUST have a workflow for analyzing and fixing them.

---

## How It Works

### pg_stat_statements (PostgreSQL)

```sql
-- Enable pg_stat_statements (postgresql.conf)
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = top

-- Create extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 20 queries by total execution time
SELECT
    queryid,
    LEFT(query, 120) AS query_preview,
    calls,
    ROUND(total_exec_time::numeric, 0) AS total_ms,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms,
    ROUND(min_exec_time::numeric, 2) AS min_ms,
    ROUND(max_exec_time::numeric, 2) AS max_ms,
    ROUND(stddev_exec_time::numeric, 2) AS stddev_ms,
    rows,
    ROUND(rows::numeric / NULLIF(calls, 0), 0) AS avg_rows,
    shared_blks_hit,
    shared_blks_read,
    ROUND(shared_blks_hit * 100.0 /
        NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct
FROM pg_stat_statements
WHERE queryid IS NOT NULL
ORDER BY total_exec_time DESC
LIMIT 20;

-- Top queries by average execution time (find individual slow queries)
SELECT
    queryid,
    LEFT(query, 120) AS query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms,
    ROUND(max_exec_time::numeric, 2) AS max_ms,
    rows
FROM pg_stat_statements
WHERE calls > 10  -- filter out rarely-called queries
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Queries with worst cache hit ratio (need index or more memory)
SELECT
    queryid,
    LEFT(query, 120) AS query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms,
    shared_blks_read,
    ROUND(shared_blks_hit * 100.0 /
        NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct
FROM pg_stat_statements
WHERE shared_blks_read > 1000
ORDER BY shared_blks_read DESC
LIMIT 20;

-- Queries with high row scan to return ratio (missing index)
SELECT
    queryid,
    LEFT(query, 120) AS query_preview,
    calls,
    rows AS rows_returned,
    shared_blks_read + shared_blks_hit AS blocks_accessed,
    ROUND((shared_blks_read + shared_blks_hit)::numeric / NULLIF(rows, 0), 0) AS blocks_per_row
FROM pg_stat_statements
WHERE rows > 0 AND calls > 100
ORDER BY blocks_per_row DESC
LIMIT 20;

-- Reset statistics (do periodically to track recent trends)
SELECT pg_stat_statements_reset();
```

### MySQL Slow Query Log

```ini
# MySQL slow query log configuration (my.cnf)
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 0.5          # Log queries taking > 500ms
log_queries_not_using_indexes = 1
min_examined_row_limit = 1000  # Only log if scanning > 1000 rows
log_slow_admin_statements = 1  # Include DDL statements
```

```sql
-- MySQL: Enable Performance Schema for query analysis
-- (enabled by default in MySQL 8.0+)

-- Top queries by total execution time
SELECT
    DIGEST_TEXT AS query_pattern,
    COUNT_STAR AS calls,
    ROUND(SUM_TIMER_WAIT / 1e12, 2) AS total_sec,
    ROUND(AVG_TIMER_WAIT / 1e12, 4) AS avg_sec,
    SUM_ROWS_EXAMINED AS rows_examined,
    SUM_ROWS_SENT AS rows_returned,
    ROUND(SUM_ROWS_EXAMINED / NULLIF(SUM_ROWS_SENT, 0), 0) AS examine_ratio
FROM performance_schema.events_statements_summary_by_digest
WHERE SCHEMA_NAME = 'myapp'
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 20;

-- MySQL: Slow query analysis with pt-query-digest (Percona)
-- pt-query-digest /var/log/mysql/slow.log --limit=20
```

### Real-Time Query Monitoring

```sql
-- PostgreSQL: Currently running queries
SELECT
    pid,
    now() - query_start AS duration,
    state,
    wait_event_type,
    wait_event,
    LEFT(query, 100) AS query_preview
FROM pg_stat_activity
WHERE state = 'active'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- PostgreSQL: Queries running longer than 30 seconds
SELECT
    pid,
    now() - query_start AS duration,
    usename,
    LEFT(query, 200) AS query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '30 seconds'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- PostgreSQL: Active locks and blockers
SELECT
    a.pid,
    a.usename,
    a.state,
    l.locktype,
    l.mode,
    l.granted,
    now() - a.query_start AS duration,
    LEFT(a.query, 100) AS query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT l.granted
ORDER BY a.query_start;
```

### Automated Slow Query Detection

```typescript
// TypeScript — Automated slow query detector and alerter
import { Pool } from 'pg';

interface SlowQuery {
  queryid: string;
  query: string;
  avgMs: number;
  maxMs: number;
  calls: number;
  totalMs: number;
  cacheHitPct: number;
}

async function detectSlowQueries(pool: Pool): Promise<SlowQuery[]> {
  const result = await pool.query(`
    SELECT
      queryid::text,
      LEFT(query, 500) AS query,
      ROUND(mean_exec_time::numeric, 2) AS avg_ms,
      ROUND(max_exec_time::numeric, 2) AS max_ms,
      calls,
      ROUND(total_exec_time::numeric, 0) AS total_ms,
      ROUND(shared_blks_hit * 100.0 /
        NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct
    FROM pg_stat_statements
    WHERE mean_exec_time > $1
      AND calls > $2
    ORDER BY total_exec_time DESC
    LIMIT 50
  `, [100, 10]); // avg > 100ms, called > 10 times

  return result.rows;
}

// Run periodically (every 5 minutes)
async function monitorSlowQueries(pool: Pool) {
  const slowQueries = await detectSlowQueries(pool);

  for (const q of slowQueries) {
    if (q.avgMs > 1000) {
      console.error(`CRITICAL slow query: avg=${q.avgMs}ms calls=${q.calls}`, q.query);
      // Send alert to PagerDuty/Slack
    } else if (q.avgMs > 100) {
      console.warn(`WARNING slow query: avg=${q.avgMs}ms calls=${q.calls}`, q.query);
    }

    if (q.cacheHitPct < 90) {
      console.warn(`Low cache hit ratio: ${q.cacheHitPct}% — possible missing index`, q.query);
    }
  }
}
```

```go
// Go — Query performance tracker middleware
package db

import (
    "context"
    "log"
    "time"

    "github.com/jackc/pgx/v5"
    "github.com/prometheus/client_golang/prometheus"
)

var queryDuration = prometheus.NewHistogramVec(
    prometheus.HistogramOpts{
        Name:    "db_query_duration_seconds",
        Help:    "Database query execution time",
        Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10},
    },
    []string{"query_name"},
)

type TrackedQuery struct {
    Name string
    SQL  string
}

func (q TrackedQuery) Execute(ctx context.Context, pool *pgxpool.Pool, args ...any) (pgx.Rows, error) {
    start := time.Now()
    rows, err := pool.Query(ctx, q.SQL, args...)
    duration := time.Since(start)

    queryDuration.WithLabelValues(q.Name).Observe(duration.Seconds())

    if duration > 500*time.Millisecond {
        log.Printf("SLOW QUERY [%s]: %s (%.2fms)", q.Name, q.SQL, float64(duration.Microseconds())/1000)
    }

    return rows, err
}
```

### Query Optimization Workflow

```
Systematic Slow Query Resolution:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Step 1: IDENTIFY — Find slow queries                    │
│  ├── pg_stat_statements: top by total time               │
│  ├── pg_stat_statements: top by avg time                 │
│  ├── Application APM: slow endpoints                     │
│  └── Slow query log: recent slow queries                 │
│                                                            │
│  Step 2: ANALYZE — Understand WHY it's slow              │
│  ├── EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)              │
│  ├── Check scan type (Seq Scan on large table?)          │
│  ├── Check estimated vs actual rows (stale stats?)       │
│  ├── Check buffer hits vs reads (cache miss?)            │
│  └── Check locks and contention                          │
│                                                            │
│  Step 3: FIX — Apply the right optimization              │
│  ├── Add missing index → re-EXPLAIN                      │
│  ├── Rewrite query (subquery → JOIN, etc.)               │
│  ├── ANALYZE table (update statistics)                   │
│  ├── Increase work_mem for sort/hash operations          │
│  └── Add covering index to avoid table lookups           │
│                                                            │
│  Step 4: VERIFY — Confirm improvement                    │
│  ├── EXPLAIN ANALYZE before vs after                     │
│  ├── pg_stat_statements: compare avg time                │
│  ├── Application latency metrics                         │
│  └── Monitor for regression over following days          │
│                                                            │
│  Step 5: PREVENT — Avoid future regressions              │
│  ├── Add query to performance test suite                 │
│  ├── Set up alerting for this query pattern              │
│  ├── Document the optimization for team                  │
│  └── Review similar queries for same issue               │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS enable pg_stat_statements** — the single most important PostgreSQL monitoring extension
2. **ALWAYS review top queries weekly** — proactively find slow queries before they impact users
3. **ALWAYS use EXPLAIN ANALYZE** for diagnosis — never guess at query performance
4. **ALWAYS track query performance over time** — detect regressions early
5. **ALWAYS monitor both total time and average time** — high-frequency slow queries are worse
6. **ALWAYS check cache hit ratio per query** — low ratio indicates missing index
7. **ALWAYS reset pg_stat_statements periodically** — track recent trends, not all-time
8. **NEVER optimize without EXPLAIN** — intuition about query performance is often wrong
9. **NEVER ignore queries with high examine-to-return ratio** — scanning many rows to return few
10. **NEVER kill long queries without investigation** — understand why they're slow first

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No pg_stat_statements | Cannot identify slow queries | Enable the extension |
| No regular query review | Slow queries accumulate silently | Weekly top-queries review |
| Guessing at optimization | Wrong fix applied, wasted time | EXPLAIN ANALYZE first |
| No before/after comparison | Cannot verify fix worked | Compare EXPLAIN output |
| Ignoring high-frequency queries | Moderate queries cause cumulative damage | Sort by total_exec_time |
| No cache hit monitoring | Missing indexes undetected | Track shared_blks_hit ratio |
| Not resetting stats | All-time stats mask recent regressions | Reset monthly |
| No automated alerting | Slow queries detected manually | Alert on p95/p99 thresholds |

---

## Enforcement Checklist

- [ ] pg_stat_statements enabled in production
- [ ] Weekly slow query review process established
- [ ] Automated alerting on query latency thresholds
- [ ] EXPLAIN ANALYZE used for all query optimizations
- [ ] Query performance tracked over time (Grafana)
- [ ] Cache hit ratio monitored per query
- [ ] Real-time long-running query monitoring active
- [ ] Performance regression detection in CI (query benchmarks)
