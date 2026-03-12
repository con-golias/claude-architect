# Database Performance Benchmarking

> **Domain:** Database > Query Optimization > Benchmarking
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Without benchmarks, database performance is guesswork. Benchmarking establishes baseline performance, validates hardware sizing, compares database configurations, and detects performance regressions. A properly benchmarked database gives the team confidence that it can handle expected load — and clear data on when scaling is needed. Every production database MUST be benchmarked before launch and re-benchmarked after significant configuration changes, hardware changes, or version upgrades.

---

## How It Works

### Benchmarking Tools

```
Database Benchmarking Tools:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  PostgreSQL                                                │
│  ├── pgbench       — Built-in, TPC-B like workload       │
│  ├── HammerDB      — TPC-C / TPC-H workloads            │
│  └── pgreplay      — Replay production query logs        │
│                                                            │
│  MySQL                                                     │
│  ├── sysbench      — Multi-threaded, OLTP workloads      │
│  ├── HammerDB      — TPC-C / TPC-H workloads            │
│  └── mysqlslap     — Built-in MySQL benchmark            │
│                                                            │
│  General                                                   │
│  ├── YCSB          — Yahoo Cloud Serving Benchmark       │
│  │                    (NoSQL, distributed DBs)            │
│  ├── TPC-C/TPC-H   — Industry standard OLTP/OLAP        │
│  └── k6             — Load testing with SQL extensions   │
│                                                            │
│  Application-Level                                        │
│  ├── Custom scripts — Realistic workload simulation      │
│  └── Load test tools— k6, Locust, Artillery with DB      │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### pgbench (PostgreSQL)

```bash
# pgbench — PostgreSQL built-in benchmark tool

# Step 1: Initialize benchmark tables (scale factor = data size)
pgbench -i -s 100 mydb
# -s 100 = 100 × 100,000 rows = 10,000,000 rows
# Creates: pgbench_accounts (10M rows), pgbench_branches, pgbench_tellers, pgbench_history

# Step 2: Run default TPC-B-like benchmark
pgbench -c 20 -j 4 -T 300 mydb
# -c 20  = 20 concurrent clients
# -j 4   = 4 worker threads
# -T 300 = run for 300 seconds (5 minutes)

# Output:
# transaction type: <builtin: TPC-B (sort of)>
# scaling factor: 100
# number of clients: 20
# number of threads: 4
# duration: 300 s
# number of transactions actually processed: 245678
# latency average = 24.4 ms
# latency stddev = 18.2 ms
# tps = 818.93 (including connections establishing)
# tps = 819.12 (excluding connections establishing)

# Step 3: Run with custom queries
pgbench -c 20 -j 4 -T 120 -f custom_query.sql mydb

# Step 4: Read-only benchmark (SELECT only)
pgbench -c 50 -j 8 -T 120 -S mydb
# -S = SELECT-only mode (no writes)

# Step 5: Benchmark with progress reporting
pgbench -c 20 -j 4 -T 300 -P 10 mydb
# -P 10 = report progress every 10 seconds

# Step 6: Compare configurations
# Test 1: Default config
pgbench -c 20 -j 4 -T 300 mydb > bench_default.txt

# Change config (e.g., increase shared_buffers)
# Restart PostgreSQL

# Test 2: Modified config
pgbench -c 20 -j 4 -T 300 mydb > bench_modified.txt

# Compare results
```

```sql
-- pgbench custom script — realistic workload
-- custom_workload.sql

-- 30% of transactions: read user by ID
\set user_id random(1, 1000000)
SELECT * FROM users WHERE id = :user_id;

-- 40% of transactions: read orders with items
\set order_id random(1, 5000000)
SELECT o.*, oi.* FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.id = :order_id;

-- 20% of transactions: insert order
\set user_id random(1, 1000000)
\set total random(10, 500)
INSERT INTO orders (user_id, total, status)
VALUES (:user_id, :total, 'pending');

-- 10% of transactions: update order status
\set order_id random(1, 5000000)
UPDATE orders SET status = 'shipped' WHERE id = :order_id;
```

### sysbench (MySQL)

```bash
# sysbench — MySQL benchmark tool

# Step 1: Prepare benchmark data
sysbench oltp_read_write \
  --db-driver=mysql \
  --mysql-host=localhost \
  --mysql-port=3306 \
  --mysql-user=benchmark \
  --mysql-password=password \
  --mysql-db=sbtest \
  --tables=10 \
  --table-size=1000000 \
  prepare

# Step 2: Run OLTP benchmark
sysbench oltp_read_write \
  --db-driver=mysql \
  --mysql-host=localhost \
  --mysql-user=benchmark \
  --mysql-password=password \
  --mysql-db=sbtest \
  --tables=10 \
  --table-size=1000000 \
  --threads=16 \
  --time=300 \
  --report-interval=10 \
  run

# Output:
# SQL statistics:
#     queries performed:
#         read:   2345678
#         write:  670194
#         other:  335097
#         total:  3350969
#     transactions:   167548 (558.49 per sec.)
#     queries:        3350969 (11169.90 per sec.)
#     ignored errors: 0 (0.00 per sec.)
# Latency (ms):
#     min:    2.45
#     avg:    28.64
#     max:    245.67
#     95th percentile: 51.94

# Step 3: Read-only benchmark
sysbench oltp_read_only \
  --threads=32 --time=300 \
  --mysql-host=localhost --mysql-db=sbtest \
  run

# Step 4: Write-heavy benchmark
sysbench oltp_write_only \
  --threads=16 --time=300 \
  --mysql-host=localhost --mysql-db=sbtest \
  run

# Step 5: Cleanup
sysbench oltp_read_write \
  --mysql-host=localhost --mysql-db=sbtest \
  cleanup
```

### Application-Level Benchmarking

```typescript
// TypeScript — Custom database benchmark
import { Pool } from 'pg';

interface BenchmarkResult {
  name: string;
  totalQueries: number;
  durationMs: number;
  qps: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errors: number;
}

async function benchmarkQuery(
  pool: Pool,
  name: string,
  query: string,
  params: () => any[],
  config: { concurrency: number; durationMs: number }
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let errors = 0;
  const startTime = Date.now();
  let running = true;

  setTimeout(() => { running = false; }, config.durationMs);

  const workers = Array.from({ length: config.concurrency }, async () => {
    while (running) {
      const queryStart = performance.now();
      try {
        await pool.query(query, params());
        latencies.push(performance.now() - queryStart);
      } catch {
        errors++;
      }
    }
  });

  await Promise.all(workers);

  latencies.sort((a, b) => a - b);
  const totalDuration = Date.now() - startTime;

  return {
    name,
    totalQueries: latencies.length,
    durationMs: totalDuration,
    qps: Math.round(latencies.length / (totalDuration / 1000)),
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length * 100) / 100,
    p50Ms: Math.round(latencies[Math.floor(latencies.length * 0.5)] * 100) / 100,
    p95Ms: Math.round(latencies[Math.floor(latencies.length * 0.95)] * 100) / 100,
    p99Ms: Math.round(latencies[Math.floor(latencies.length * 0.99)] * 100) / 100,
    errors,
  };
}

// Run benchmark suite
async function runBenchmarkSuite(pool: Pool) {
  const results: BenchmarkResult[] = [];

  results.push(await benchmarkQuery(
    pool, 'point-lookup-by-pk',
    'SELECT * FROM users WHERE id = $1',
    () => [Math.floor(Math.random() * 1000000) + 1],
    { concurrency: 20, durationMs: 60000 }
  ));

  results.push(await benchmarkQuery(
    pool, 'index-scan-by-email',
    'SELECT * FROM users WHERE email = $1',
    () => [`user${Math.floor(Math.random() * 1000000)}@example.com`],
    { concurrency: 20, durationMs: 60000 }
  ));

  results.push(await benchmarkQuery(
    pool, 'join-orders-items',
    `SELECT o.*, oi.* FROM orders o
     JOIN order_items oi ON o.id = oi.order_id
     WHERE o.user_id = $1 LIMIT 20`,
    () => [Math.floor(Math.random() * 100000) + 1],
    { concurrency: 20, durationMs: 60000 }
  ));

  // Print results
  console.table(results.map(r => ({
    Query: r.name,
    QPS: r.qps,
    'Avg (ms)': r.avgLatencyMs,
    'P50 (ms)': r.p50Ms,
    'P95 (ms)': r.p95Ms,
    'P99 (ms)': r.p99Ms,
    Errors: r.errors,
  })));
}
```

### Benchmarking Methodology

```
Benchmarking Best Practices:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  BEFORE Benchmarking:                                     │
│  1. Use production-like data volume (not empty DB)       │
│  2. Warm up the buffer pool (run queries for 5+ min)     │
│  3. Disable query result caching                          │
│  4. Match production hardware or note differences        │
│  5. Document exact configuration being tested            │
│                                                            │
│  DURING Benchmarking:                                     │
│  1. Run for at least 5 minutes (short runs are noisy)    │
│  2. Use realistic concurrency (match production clients) │
│  3. Mix read/write ratio matching production              │
│  4. Run 3+ iterations, report median                     │
│  5. Monitor system resources (CPU, RAM, disk I/O)        │
│                                                            │
│  AFTER Benchmarking:                                      │
│  1. Record: TPS, latency (avg, p50, p95, p99), errors   │
│  2. Record: CPU%, RAM%, IOPS, disk utilization           │
│  3. Compare against baseline (previous benchmark)        │
│  4. Document any anomalies                               │
│  5. Store results for historical comparison               │
│                                                            │
│  COMMON MISTAKES:                                         │
│  ❌ Benchmarking on cold database (empty cache)          │
│  ❌ Running for < 60 seconds (not representative)        │
│  ❌ Using empty tables (no realistic I/O)                │
│  ❌ Single-threaded test for multi-threaded workload     │
│  ❌ Comparing different hardware without noting it       │
│  ❌ Not running multiple iterations                      │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS benchmark before production launch** — establish baseline performance
2. **ALWAYS use production-like data volume** — performance on empty databases is meaningless
3. **ALWAYS warm up the database** before benchmarking — cold cache results are misleading
4. **ALWAYS run benchmarks for 5+ minutes** — short runs produce noisy results
5. **ALWAYS report percentiles** (p50, p95, p99) — averages hide tail latency
6. **ALWAYS run multiple iterations** — report median to account for variance
7. **ALWAYS benchmark after configuration changes** — verify improvements
8. **NEVER benchmark in production** — use staging with production-sized data
9. **NEVER compare benchmarks across different hardware** — apples to apples only
10. **NEVER optimize based on synthetic benchmarks alone** — profile actual production queries

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No baseline benchmark | Don't know if performance changed | Benchmark before launch |
| Benchmarking empty database | Unrealistic fast results | Use production-sized data |
| Cold cache benchmark | Results don't match production | Warm up with 5min pre-run |
| Short benchmark runs | Noisy, unreliable results | Run for 5+ minutes |
| Only reporting averages | Missing tail latency spikes | Report p50, p95, p99 |
| Benchmarking in production | Impacts real users | Use staging environment |
| Single iteration | Results may be outlier | Run 3+ iterations, use median |
| Ignoring system metrics | Don't know bottleneck | Monitor CPU, RAM, IOPS during bench |

---

## Enforcement Checklist

- [ ] Baseline benchmark established before production
- [ ] Benchmark uses production-sized data
- [ ] Benchmark runs for 5+ minutes minimum
- [ ] Multiple iterations run, median reported
- [ ] Percentile latencies recorded (p50, p95, p99)
- [ ] System resources monitored during benchmark
- [ ] Benchmark re-run after configuration changes
- [ ] Results documented and stored historically
- [ ] Application-level benchmark with realistic queries
