# Sharding & Partitioning

> **Domain:** Database > Scaling > Sharding & Partitioning
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

When a single database server cannot handle the workload — whether due to data volume (terabytes), write throughput (tens of thousands of TPS), or both — you must split data across multiple servers. Partitioning splits data within a single database instance (PostgreSQL table partitioning). Sharding splits data across multiple database instances. Both reduce per-node data size, but sharding adds enormous complexity: cross-shard queries, distributed transactions, rebalancing, and operational overhead. Sharding should be the last resort after exhausting vertical scaling, read replicas, caching, and query optimization. But when you need it, understanding the patterns and pitfalls prevents catastrophic architectural mistakes.

---

## How It Works

### Partitioning vs Sharding

```
Partitioning (single database):
┌──────────────────────────────────────────────────┐
│  Single PostgreSQL Instance                       │
│                                                    │
│  orders (partitioned table)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│  │ orders_2024  │ │ orders_2025  │ │orders_26 │ │
│  │ (partition)  │ │ (partition)  │ │(partition)│ │
│  │ 10M rows     │ │ 15M rows     │ │ 3M rows  │ │
│  └──────────────┘ └──────────────┘ └──────────┘ │
│                                                    │
│  Same server, same queries, transparent to app    │
│  Query planner prunes partitions automatically    │
└──────────────────────────────────────────────────┘

Sharding (multiple databases):
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Shard 1 (PG) │  │ Shard 2 (PG) │  │ Shard 3 (PG) │
│ users A-H    │  │ users I-P    │  │ users Q-Z    │
│ + their data │  │ + their data │  │ + their data │
└──────────────┘  └──────────────┘  └──────────────┘
       ▲                 ▲                 ▲
       └────────┬────────┘                 │
                │                          │
         ┌──────▼──────┐                   │
         │ Application │───────────────────┘
         │ (routing    │
         │  logic)     │
         └─────────────┘

Different servers, app must route queries
Cross-shard queries are expensive/impossible
```

---

### Table Partitioning (PostgreSQL)

```sql
-- Range partitioning by date (most common)
CREATE TABLE orders (
    id BIGSERIAL,
    customer_id BIGINT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)  -- partition key must be in PK
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE orders_2024_q1 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE orders_2024_q2 PARTITION OF orders
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
CREATE TABLE orders_2024_q3 PARTITION OF orders
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');
CREATE TABLE orders_2024_q4 PARTITION OF orders
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

-- Default partition (catch-all)
CREATE TABLE orders_default PARTITION OF orders DEFAULT;

-- Auto-create future partitions (pg_partman extension)
CREATE EXTENSION pg_partman;
SELECT partman.create_parent(
    p_parent_table := 'public.orders',
    p_control := 'created_at',
    p_type := 'native',
    p_interval := 'monthly',
    p_premake := 3  -- create 3 months ahead
);

-- List partitioning (by category)
CREATE TABLE events (
    id BIGSERIAL,
    event_type TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, event_type)
) PARTITION BY LIST (event_type);

CREATE TABLE events_click PARTITION OF events
    FOR VALUES IN ('click', 'impression', 'scroll');
CREATE TABLE events_purchase PARTITION OF events
    FOR VALUES IN ('purchase', 'refund', 'subscription');
CREATE TABLE events_system PARTITION OF events
    FOR VALUES IN ('error', 'warning', 'info');

-- Hash partitioning (even distribution)
CREATE TABLE sessions (
    id UUID DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    data JSONB,
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE sessions_0 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sessions_1 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sessions_2 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sessions_3 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Partition pruning (query touches only relevant partition)
EXPLAIN SELECT * FROM orders WHERE created_at = '2024-06-15';
-- Scan only orders_2024_q2 (others pruned)

-- Drop old data efficiently (instant, no DELETE)
DROP TABLE orders_2023_q1;
-- vs DELETE FROM orders WHERE created_at < '2023-04-01'
-- (DELETE: slow, generates WAL, needs VACUUM)
```

---

### Sharding Strategies

```
1. Hash-Based Sharding:
   shard = hash(shard_key) % num_shards

   ┌──────────────────────────────────────────┐
   │ hash(user_id) % 4 → shard number        │
   │                                           │
   │ User 101 → hash → 2 → Shard 2           │
   │ User 102 → hash → 0 → Shard 0           │
   │ User 103 → hash → 3 → Shard 3           │
   │                                           │
   │ ✅ Even distribution                      │
   │ ❌ Adding shards requires resharding      │
   │ ❌ Range queries across all shards        │
   └──────────────────────────────────────────┘

2. Range-Based Sharding:
   shard = range(shard_key)

   ┌──────────────────────────────────────────┐
   │ Shard 0: user_id 1 - 1,000,000          │
   │ Shard 1: user_id 1,000,001 - 2,000,000  │
   │ Shard 2: user_id 2,000,001 - 3,000,000  │
   │                                           │
   │ ✅ Range queries on shard key efficient   │
   │ ✅ Easy to add shards (new range)         │
   │ ❌ Hot spots (recent data on one shard)   │
   │ ❌ Uneven distribution over time          │
   └──────────────────────────────────────────┘

3. Directory-Based Sharding:
   shard = lookup_table[shard_key]

   ┌──────────────────────────────────────────┐
   │ Lookup table:                             │
   │ tenant_a → Shard 0                       │
   │ tenant_b → Shard 1                       │
   │ tenant_c → Shard 0                       │
   │                                           │
   │ ✅ Flexible placement                     │
   │ ✅ Easy rebalancing (update lookup)       │
   │ ❌ Lookup table = single point of failure │
   │ ❌ Additional latency for lookup          │
   └──────────────────────────────────────────┘

4. Geographic Sharding:
   shard = region(user)

   ┌──────────────────────────────────────────┐
   │ US users → US shard                      │
   │ EU users → EU shard                      │
   │ AP users → AP shard                      │
   │                                           │
   │ ✅ Data locality (low latency)            │
   │ ✅ Data sovereignty compliance            │
   │ ❌ Cross-region queries expensive         │
   │ ❌ Uneven distribution by region          │
   └──────────────────────────────────────────┘
```

### Shard Key Selection

```
Choosing the Shard Key — MOST CRITICAL DECISION:

Good Shard Keys:
  • user_id (for user-scoped data)
  • tenant_id (for multi-tenant SaaS)
  • order_id (for order-scoped data)

Requirements for a good shard key:
  1. High cardinality (many unique values)
  2. Even distribution (no hot shards)
  3. Query locality (most queries include it)
  4. Immutable (never changes after creation)

Bad Shard Keys:
  ❌ created_at → all writes to latest shard (hot spot)
  ❌ country → uneven distribution (90% US?)
  ❌ status → low cardinality (3 values = 3 shards max)
  ❌ email → changes over time, no locality
```

---

### Application-Level Sharding

```typescript
// TypeScript — Application-level shard routing
import { Pool } from 'pg';

class ShardRouter {
  private shards: Map<number, Pool>;
  private numShards: number;

  constructor(shardConfigs: { id: number; connectionString: string }[]) {
    this.shards = new Map();
    this.numShards = shardConfigs.length;
    for (const config of shardConfigs) {
      this.shards.set(config.id, new Pool({ connectionString: config.connectionString }));
    }
  }

  private getShardId(userId: string): number {
    // Consistent hashing (simplified)
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % this.numShards;
  }

  getPool(userId: string): Pool {
    const shardId = this.getShardId(userId);
    return this.shards.get(shardId)!;
  }

  // Query single shard (fast)
  async queryUser(userId: string, query: string, params: unknown[]) {
    const pool = this.getPool(userId);
    return pool.query(query, params);
  }

  // Fan-out query across all shards (slow, avoid)
  async queryAllShards(query: string, params: unknown[]) {
    const promises = Array.from(this.shards.values()).map(
      pool => pool.query(query, params)
    );
    const results = await Promise.all(promises);
    return results.flatMap(r => r.rows);
  }
}

// Usage
const router = new ShardRouter([
  { id: 0, connectionString: 'postgresql://shard0/db' },
  { id: 1, connectionString: 'postgresql://shard1/db' },
  { id: 2, connectionString: 'postgresql://shard2/db' },
  { id: 3, connectionString: 'postgresql://shard3/db' },
]);

// Single-shard query (fast)
const orders = await router.queryUser(
  userId,
  'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
  [userId]
);

// Cross-shard query (fan-out, slow — avoid in hot paths)
const allOrders = await router.queryAllShards(
  'SELECT COUNT(*) AS cnt FROM orders WHERE status = $1',
  ['pending']
);
```

---

### Sharding Middleware

```
Middleware/Proxy Solutions (avoid custom sharding):

┌────────────────────────┬──────────────────────────┐
│ Tool                    │ Database                  │
├────────────────────────┼──────────────────────────┤
│ Vitess                 │ MySQL (used by YouTube)   │
│ Citus                  │ PostgreSQL (extension)    │
│ ProxySQL               │ MySQL (routing, pooling)  │
│ ShardingSphere          │ MySQL, PostgreSQL         │
│ pg_shard (deprecated)  │ PostgreSQL                │
└────────────────────────┴──────────────────────────┘
```

```sql
-- Citus: PostgreSQL sharding extension
-- Distributed tables: sharded across worker nodes
-- Reference tables: replicated to all nodes

-- Create distributed table
SELECT create_distributed_table('orders', 'customer_id');
-- Automatically shards by customer_id across workers

-- Create reference table (small, replicated everywhere)
SELECT create_reference_table('countries');
-- JOINs with distributed tables are local (fast)

-- Query (transparent — looks like regular SQL)
SELECT c.name, SUM(o.total) AS revenue
FROM orders o
JOIN countries c ON o.country_code = c.code
WHERE o.created_at > '2024-01-01'
GROUP BY c.name
ORDER BY revenue DESC;
-- Citus pushes down to shards, aggregates results
```

---

### When to Shard

```
Scaling Ladder (ALWAYS exhaust before sharding):

1. Optimize queries (indexes, EXPLAIN, fix N+1)
2. Vertical scaling (bigger server, more RAM, NVMe SSD)
3. Read replicas (distribute read load)
4. Caching (Redis, application-level cache)
5. Table partitioning (within single database)
6. Archiving old data (move to cold storage)
7. ─── LAST RESORT ──────────────────────────
8. Sharding (distributed across multiple servers)

Signs you need sharding:
  • Largest available server can't hold working set
  • Write throughput exceeds single-node capacity
  • Disk I/O saturated even with SSDs
  • Single table > 1 TB and growing
  • Write TPS > 10,000-50,000 sustained

Consider distributed SQL first:
  CockroachDB, TiDB, YugabyteDB handle sharding
  automatically with full SQL support
```

---

## Best Practices

1. **ALWAYS exhaust partitioning before sharding** — partitioning is simpler, no distributed complexity
2. **ALWAYS choose shard key based on query patterns** — most queries must include shard key
3. **ALWAYS use tenant_id as shard key** for multi-tenant SaaS — natural isolation boundary
4. **ALWAYS keep related data on the same shard** — co-locate user + orders + payments
5. **ALWAYS use pg_partman** for automatic partition management — manual is error-prone
6. **ALWAYS consider Citus or Vitess** before custom sharding — battle-tested solutions
7. **NEVER shard before exhausting vertical scaling** — complexity cost is enormous
8. **NEVER use created_at as shard key** — creates write hot-spot on latest shard
9. **NEVER require cross-shard JOINs** in hot paths — fan-out queries are slow
10. **NEVER change shard key after launch** — resharding is extremely painful

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Premature sharding | Massive complexity, no benefit | Vertical scale + replicas + cache first |
| created_at as shard key | Hot-spot on latest shard | Use entity ID (user_id, tenant_id) |
| Cross-shard JOINs in hot path | Slow queries, fan-out latency | Co-locate related data, denormalize |
| No partition pruning | Queries scan all partitions | Include partition key in WHERE clause |
| Manual partition management | Missing partitions, inserts fail | Use pg_partman with premake |
| Low-cardinality shard key | Uneven distribution | High-cardinality key (user_id, order_id) |
| Custom sharding when tools exist | Reinventing Vitess/Citus poorly | Use existing sharding middleware |
| No default partition | Inserts fail for unexpected values | CREATE TABLE ... DEFAULT |
| Resharding without plan | Data migration nightmare | Plan shard key carefully upfront |
| Forgetting global unique IDs | ID collisions across shards | UUID, Snowflake ID, or sequence with shard prefix |

---

## Real-world Examples

### Instagram (PostgreSQL + custom sharding)
- Sharded by user_id (hash-based)
- Co-located: user + photos + likes + comments
- Custom Django middleware for shard routing

### Slack (Vitess + MySQL)
- Vitess for MySQL sharding
- Sharded by workspace_id (tenant isolation)
- Migration from single MySQL to sharded Vitess

### Notion (PostgreSQL + Citus)
- Citus extension for distributed PostgreSQL
- Sharded by workspace_id
- Transparent SQL queries across shards

---

## Enforcement Checklist

- [ ] Vertical scaling exhausted before sharding considered
- [ ] Table partitioning implemented for large tables (range by date)
- [ ] Shard key selected based on query analysis (high cardinality, even distribution)
- [ ] Related data co-located on same shard
- [ ] Cross-shard queries minimized (hot paths use single shard)
- [ ] Partition management automated (pg_partman or equivalent)
- [ ] Global unique ID strategy defined (UUID, Snowflake)
- [ ] Sharding middleware evaluated (Citus, Vitess) before custom
- [ ] Rebalancing strategy documented
- [ ] Monitoring configured per shard (size, query load, lag)
