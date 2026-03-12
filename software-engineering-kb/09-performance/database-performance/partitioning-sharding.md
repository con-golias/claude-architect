# Partitioning & Sharding Performance Engineering

> **Domain:** Performance > Database Performance > Partitioning & Sharding
> **Importance:** HIGH
> **Perspective:** Performance measurement, partition pruning verification, shard sizing
> **Cross-ref:** 07-database/scaling/sharding-partitioning.md

## Partitioning: When and How

### Partition Strategy Selection

```
Decision Matrix:
┌────────────────┬──────────────┬──────────────┬──────────────────────┐
│ Strategy       │ Best For     │ Pruning      │ Data Distribution    │
├────────────────┼──────────────┼──────────────┼──────────────────────┤
│ Range          │ Time-series  │ WHERE date   │ Uneven (recent hot)  │
│                │ Append-only  │ BETWEEN x, y │ Old partitions cold  │
├────────────────┼──────────────┼──────────────┼──────────────────────┤
│ List           │ Category     │ WHERE type   │ Varies by category   │
│                │ Region/tenant│ IN (a, b, c) │ May be uneven        │
├────────────────┼──────────────┼──────────────┼──────────────────────┤
│ Hash           │ Even spread  │ WHERE key =  │ Even across parts    │
│                │ No natural   │ (exact match)│ No range pruning     │
│                │ range key    │              │                      │
└────────────────┴──────────────┴──────────────┴──────────────────────┘

Size threshold: partition when table > 50GB or > 100M rows.
```

### Range Partitioning (Most Common)

```sql
-- PostgreSQL: monthly time-range partitioning
CREATE TABLE events (
    id BIGSERIAL,
    tenant_id INT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE events_2025_01 PARTITION OF events
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE events_2025_02 PARTITION OF events
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ...
CREATE TABLE events_default PARTITION OF events DEFAULT;

-- Automate with pg_partman
SELECT partman.create_parent(
    p_parent_table := 'public.events',
    p_control := 'created_at',
    p_type := 'native',
    p_interval := 'monthly',
    p_premake := 3
);
-- pg_partman auto-creates future partitions and optionally drops old ones
```

### Verify Partition Pruning

```sql
-- EXPLAIN must show "Partitions removed" or scan only relevant partitions
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM events
WHERE created_at >= '2025-06-01' AND created_at < '2025-07-01';

-- Expected output:
-- Append (actual time=...)
--   -> Seq Scan on events_2025_06 (actual time=...)
--         Filter: (created_at >= ... AND created_at < ...)
-- Subplans Removed: 11  ← pruning confirmed

-- If ALL partitions are scanned, partition key is missing from WHERE clause.
-- Common mistake: function wrapping prevents pruning
-- BAD: WHERE date_trunc('month', created_at) = '2025-06-01' ← no pruning
-- GOOD: WHERE created_at >= '2025-06-01' AND created_at < '2025-07-01' ← pruning
```

### List Partitioning

```sql
-- Multi-tenant partitioning by region
CREATE TABLE orders (
    id BIGSERIAL,
    region TEXT NOT NULL,
    customer_id BIGINT NOT NULL,
    total DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, region)
) PARTITION BY LIST (region);

CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('us-east', 'us-west');
CREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('eu-west', 'eu-central');
CREATE TABLE orders_ap PARTITION OF orders FOR VALUES IN ('ap-south', 'ap-east');
CREATE TABLE orders_default PARTITION OF orders DEFAULT;

-- Prune verification
EXPLAIN SELECT * FROM orders WHERE region = 'us-east';
-- Should scan only orders_us partition
```

### Hash Partitioning

```sql
-- Even distribution when no natural range exists
CREATE TABLE sessions (
    id UUID DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    data JSONB,
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE sessions_0 PARTITION OF sessions FOR VALUES WITH (MODULUS 8, REMAINDER 0);
CREATE TABLE sessions_1 PARTITION OF sessions FOR VALUES WITH (MODULUS 8, REMAINDER 1);
-- ... through sessions_7

-- Hash pruning only works with equality: WHERE user_id = 42
-- Range queries scan ALL hash partitions
```

### Partition Maintenance

```sql
-- Drop old data instantly (vs slow DELETE + VACUUM)
ALTER TABLE events DETACH PARTITION events_2023_01 CONCURRENTLY;
DROP TABLE events_2023_01;
-- Instant vs hours-long DELETE on millions of rows

-- Monitor partition sizes for skew
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size,
  (SELECT reltuples FROM pg_class WHERE oid = (schemaname || '.' || tablename)::regclass) AS est_rows
FROM pg_tables
WHERE tablename LIKE 'events_%'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- Index each partition independently for optimal performance
CREATE INDEX ON events_2025_06 (tenant_id, event_type);
-- Partition-level indexes are smaller and faster to maintain
```

## Sharding: The Last Resort

### When to Shard

```
Exhaust these first (in order):
1. Query optimization (indexes, EXPLAIN, rewrite)      → 10-100x improvement
2. Configuration tuning (memory, I/O, parallelism)     → 2-10x improvement
3. Read replicas (distribute read load)                 → Nx read capacity
4. Caching (Redis, application-level)                   → 10-100x for hot data
5. Table partitioning (within single database)          → Better maintenance
6. Vertical scaling (bigger server)                     → 2-4x capacity
7. Archive old data (move to cold storage)              → Reduce working set
────────────────────────────────────────────────────────────────
8. SHARD (last resort)                                  → Nx write + read capacity

Shard when:
  - Write TPS > 20K sustained on largest available hardware
  - Working set > available RAM on largest instance
  - Single table > 1TB and growing
  - Regulatory requirement for data isolation
```

### Shard Key Selection

```
Requirements (ALL must be met):
  1. High cardinality      → many unique values for even distribution
  2. Uniform distribution  → no single shard gets disproportionate load
  3. Query co-location     → 90%+ queries include shard key in WHERE
  4. Immutable             → never changes after row creation

Optimal shard keys:
  tenant_id  → SaaS multi-tenant (natural isolation)
  user_id    → user-scoped applications
  order_id   → order-centric systems

Bad shard keys:
  created_at → all writes to one shard (hot spot)
  country    → uneven distribution (90% might be US)
  status     → low cardinality (3-5 values)
```

### Application-Level Sharding

```typescript
// Consistent hashing shard router
import { createHash } from 'crypto';
import { Pool } from 'pg';

class ShardRouter {
  private shards: Map<number, Pool>;
  private numShards: number;

  constructor(configs: { id: number; dsn: string }[]) {
    this.shards = new Map();
    this.numShards = configs.length;
    for (const c of configs) {
      this.shards.set(c.id, new Pool({ connectionString: c.dsn, max: 20 }));
    }
  }

  private shardFor(key: string): number {
    const hash = createHash('md5').update(key).digest();
    return hash.readUInt32BE(0) % this.numShards;
  }

  pool(shardKey: string): Pool {
    return this.shards.get(this.shardFor(shardKey))!;
  }

  // Single-shard query (fast, preferred)
  async query(shardKey: string, sql: string, params: any[]) {
    return this.pool(shardKey).query(sql, params);
  }

  // Fan-out query (slow, avoid on hot paths)
  async fanOut(sql: string, params: any[]) {
    const results = await Promise.all(
      Array.from(this.shards.values()).map(p => p.query(sql, params))
    );
    return results.flatMap(r => r.rows);
  }
}
```

```go
// Go: shard-aware repository
type ShardedRepo struct {
    shards []*pgxpool.Pool
}

func (r *ShardedRepo) shardIndex(tenantID string) int {
    h := fnv.New32a()
    h.Write([]byte(tenantID))
    return int(h.Sum32()) % len(r.shards)
}

func (r *ShardedRepo) GetOrders(ctx context.Context, tenantID string) ([]Order, error) {
    pool := r.shards[r.shardIndex(tenantID)]
    rows, err := pool.Query(ctx,
        "SELECT id, total, status FROM orders WHERE tenant_id = $1", tenantID)
    if err != nil { return nil, err }
    defer rows.Close()
    // ... scan rows
    return orders, nil
}

// Cross-shard aggregation (avoid in hot paths)
func (r *ShardedRepo) GlobalOrderCount(ctx context.Context) (int64, error) {
    var total int64
    g, ctx := errgroup.WithContext(ctx)
    var mu sync.Mutex
    for _, pool := range r.shards {
        pool := pool
        g.Go(func() error {
            var count int64
            err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM orders").Scan(&count)
            mu.Lock(); total += count; mu.Unlock()
            return err
        })
    }
    return total, g.Wait()
}
```

### Cross-Shard Query Strategies

```
Strategy 1: Scatter-Gather (fan-out)
  Query ALL shards in parallel, merge results.
  Latency = max(shard latencies). Acceptable for internal tools.

Strategy 2: Denormalization
  Store redundant data to keep queries single-shard.
  Example: store user_name in orders table (avoid cross-shard JOIN).

Strategy 3: Reference Tables
  Small lookup tables (countries, categories) replicated to ALL shards.
  JOINs remain local. Use Citus reference tables for automation.

Strategy 4: Global Secondary Index
  Maintain a separate index mapping (email → shard_id) in Redis/DB.
  Adds write overhead but enables lookups by non-shard-key columns.
```

### Resharding

```
Resharding is extremely expensive. Minimize the need:

  1. Start with enough shards (32-64 virtual shards mapped to fewer physical)
  2. Use consistent hashing to minimize data movement
  3. Plan for 10x growth at design time

Resharding process:
  1. Add new shards
  2. Begin dual-writing (old + new shard)
  3. Backfill historical data to new shards
  4. Verify data consistency
  5. Switch reads to new shard mapping
  6. Stop writes to old mapping
  7. Clean up old shards

Alternative: use Vitess (MySQL) or Citus (PostgreSQL) for managed resharding.
```

### Monitoring Shard Health

```sql
-- Per-shard size monitoring (run on each shard)
SELECT pg_size_pretty(pg_database_size(current_database())) AS shard_size,
  (SELECT count(*) FROM orders) AS row_count;

-- Detect shard skew: compare sizes across shards
-- Alert if any shard is >2x the median shard size
```

```typescript
// Shard health dashboard
async function shardHealth(router: ShardRouter): Promise<ShardStats[]> {
  const stats: ShardStats[] = [];
  for (const [id, pool] of router.shards) {
    const { rows } = await pool.query(`
      SELECT pg_database_size(current_database()) AS bytes,
        (SELECT count(*) FROM orders) AS rows
    `);
    stats.push({ shardId: id, bytes: rows[0].bytes, rows: rows[0].rows });
  }
  // Flag skew
  const median = stats.map(s => s.bytes).sort()[Math.floor(stats.length / 2)];
  for (const s of stats) {
    if (s.bytes > median * 2) console.warn(`Shard ${s.shardId} is skewed: ${s.bytes / median}x median`);
  }
  return stats;
}
```

---

## 10 Best Practices

1. **Partition tables exceeding 50GB or 100M rows** — improves maintenance and query speed.
2. **Use range partitioning for time-series data** — enables efficient data lifecycle (DROP vs DELETE).
3. **Verify partition pruning with EXPLAIN** — every partitioned query must show "Subplans Removed".
4. **Automate partition creation with pg_partman** — manual management leads to insert failures.
5. **Always include a DEFAULT partition** — catches unexpected values without errors.
6. **Exhaust all alternatives before sharding** — sharding adds 10x operational complexity.
7. **Choose shard key for query co-location** — 90%+ of queries must be single-shard.
8. **Start with 32+ virtual shards** mapped to fewer physical — simplifies future resharding.
9. **Use Citus or Vitess** before building custom sharding — battle-tested, handle resharding.
10. **Monitor per-shard size and row count** — detect skew before it causes hot spots.

---

## 8 Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Wrapping partition key in function | Pruning disabled, scans all partitions | Use raw column comparisons in WHERE |
| No DEFAULT partition | Insert fails for unexpected values | Always create DEFAULT partition |
| Too many partitions (>1000) | Slow planning time, high memory use | Use larger intervals (monthly vs daily) |
| Sharding before exhausting alternatives | 10x complexity for marginal gain | Follow the scaling ladder |
| created_at as shard key | Write hot-spot on latest shard | Use entity ID (tenant_id, user_id) |
| Cross-shard JOINs on hot paths | Fan-out latency, poor UX | Denormalize or use reference tables |
| Manual partition management | Missing partitions, insert failures | Automate with pg_partman |
| Fixed shard count with no virtual layer | Resharding requires full migration | Use virtual-to-physical shard mapping |

---

## Enforcement Checklist

- [ ] Tables >50GB or >100M rows are partitioned
- [ ] Partition pruning verified with EXPLAIN for all queries on partitioned tables
- [ ] pg_partman or equivalent automates partition lifecycle
- [ ] DEFAULT partition exists for all partitioned tables
- [ ] Partition size monitored for skew (alert at >3x median)
- [ ] Scaling ladder exhausted before sharding decision
- [ ] Shard key documented with justification (cardinality, distribution, query locality)
- [ ] Cross-shard query percentage tracked (<10% of total queries)
- [ ] Per-shard metrics: size, row count, QPS, latency
- [ ] Resharding plan documented (even if not yet needed)
