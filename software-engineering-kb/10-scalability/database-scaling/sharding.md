# Sharding

> **Domain:** Scalability > Database Scaling
> **Importance:** Critical
> **Last Updated:** 2025
> **Cross-ref:** 07-database/scaling/sharding-partitioning.md

## Sharding is a Last Resort

```
Scaling ladder (exhaust in order):
1. Query optimization → free
2. Indexing → free
3. Connection pooling → low complexity
4. Caching → moderate complexity
5. Read replicas → moderate complexity
6. Vertical scaling → zero code changes
7. Table partitioning → moderate complexity
8. Sharding → HIGH complexity (you are here)
```

Sharding distributes data across multiple database instances. Each shard holds a subset of data. Once sharded, almost every operation becomes harder.

## Sharding Strategies

| Strategy | Distribution | Range Queries | Hotspot Risk | Resharding |
|----------|-------------|---------------|-------------|------------|
| Range | By value range | Excellent | High | Easy |
| Hash | By hash(key) | Poor | Low | Hard |
| Directory | Lookup table | Depends | Low | Easy |
| Geographic | By region | Within region | Moderate | Moderate |

### Hash-Based Sharding

```typescript
// Consistent hashing for shard routing
import { createHash } from 'crypto';

class ConsistentHashRouter {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];
  private virtualNodes = 150; // Per physical shard

  addShard(shardId: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`${shardId}:${i}`);
      this.ring.set(hash, shardId);
      this.sortedKeys.push(hash);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  getShard(key: string): string {
    const hash = this.hash(key);
    // Find first node clockwise from hash
    const idx = this.sortedKeys.findIndex(k => k >= hash);
    const nodeHash = this.sortedKeys[idx >= 0 ? idx : 0];
    return this.ring.get(nodeHash)!;
  }

  private hash(key: string): number {
    return parseInt(createHash('md5').update(key).digest('hex').slice(0, 8), 16);
  }
}

// Usage
const router = new ConsistentHashRouter();
router.addShard('shard-1');
router.addShard('shard-2');
router.addShard('shard-3');

const shard = router.getShard(`user:${userId}`);
const db = getConnection(shard);
```

```go
// Go: Application-level shard routing
type ShardRouter struct {
    shards []*sql.DB
    count  int
}

func NewShardRouter(dsns []string) *ShardRouter {
    router := &ShardRouter{count: len(dsns)}
    for _, dsn := range dsns {
        db, _ := sql.Open("postgres", dsn)
        router.shards = append(router.shards, db)
    }
    return router
}

func (r *ShardRouter) GetShard(userID int64) *sql.DB {
    // Hash-based routing
    shardIdx := userID % int64(r.count)
    return r.shards[shardIdx]
}

func (r *ShardRouter) Query(userID int64, query string, args ...any) (*sql.Rows, error) {
    shard := r.GetShard(userID)
    return shard.QueryContext(context.Background(), query, args...)
}
```

### Range-Based Sharding

```sql
-- Shard 1: users 1-1,000,000
-- Shard 2: users 1,000,001-2,000,000
-- Shard 3: users 2,000,001+

-- Range queries are efficient (single shard)
-- BUT: new users concentrate on latest shard (hotspot)
```

### Geographic Sharding

```python
# Route by user region for data sovereignty + latency
SHARD_MAP = {
    "EU": "postgres://db-eu.example.com/users",
    "US": "postgres://db-us.example.com/users",
    "APAC": "postgres://db-apac.example.com/users",
}

def get_shard(user_region: str) -> str:
    return SHARD_MAP.get(user_region, SHARD_MAP["US"])
```

## Shard Key Selection

**Good shard keys:** High cardinality, even distribution, used in most queries, immutable.

| Shard Key | Cardinality | Distribution | Query Pattern |
|-----------|------------|-------------|---------------|
| user_id | High | Even (hash) | Most queries by user |
| tenant_id | Medium | Variable | Multi-tenant SaaS |
| created_date | Continuous | Sequential (hotspot!) | Time-series |
| country_code | Low (~200) | Skewed | Geographic queries |

**Rule:** The shard key must appear in every query. Queries without the shard key require scatter-gather across all shards.

## Cross-Shard Queries

```typescript
// Scatter-gather: query all shards, merge results
async function searchAllShards(query: string): Promise<Result[]> {
  const shards = getAllShardConnections();

  // Query all shards in parallel
  const results = await Promise.all(
    shards.map(shard => shard.query(query))
  );

  // Merge and sort results
  return results.flat().sort((a, b) => b.score - a.score).slice(0, 100);
}
// Performance: O(N) where N = number of shards
// Avoid for high-frequency queries
```

## Resharding

Adding/removing shards. Consistent hashing minimizes data movement.

```
Without consistent hashing: Adding 1 shard moves ~75% of data (N/(N+1))
With consistent hashing:    Adding 1 shard moves ~25% of data (1/(N+1))
```

## Proxy-Based Sharding (Vitess, Citus)

```yaml
# Vitess: transparent sharding for MySQL
# Application connects to vtgate (proxy), unaware of shards
vtgate:
  target: "commerce.users"
  vschema:
    sharded: true
    vindexes:
      hash:
        type: hash
    tables:
      users:
        column_vindexes:
          - column: id
            name: hash
```

## Best Practices

1. **Exhaust all alternatives before sharding** — optimize, cache, replicas, vertical scale first
2. **Choose shard key based on query patterns** — must appear in 90%+ of queries
3. **Use consistent hashing** — minimizes data movement during resharding
4. **Avoid cross-shard joins** — denormalize or use reference tables for shared data
5. **Plan resharding from day one** — design for 2x-4x growth without resharding
6. **Monitor shard balance** — alert when any shard has >20% more data than average
7. **Use proxy-based sharding when possible** — Vitess, Citus reduce application complexity
8. **Keep shard keys immutable** — changing a shard key requires full data migration
9. **Implement shard-aware connection pooling** — one pool per shard, not one global pool
10. **Test with production-like data distribution** — synthetic data hides hotspots

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Sharding before optimizing | Unnecessary complexity | Exhaust scaling ladder first |
| Low-cardinality shard key | Unbalanced shards | Use high-cardinality key (user_id) |
| Sequential shard key (timestamp) | Hotspot on latest shard | Hash the key |
| Cross-shard transactions | Performance cliff, complexity | Design for single-shard operations |
| Queries without shard key | Scatter-gather on every query | Include shard key in all queries |
| Hard-coded shard count | Cannot add shards | Use consistent hashing |
| No shard monitoring | Silent data skew | Dashboard for per-shard metrics |
| Sharding application state | Session loss | Externalize state before sharding |

## Enforcement Checklist

- [ ] All alternatives exhausted before sharding (optimization, caching, replicas, vertical)
- [ ] Shard key chosen based on query pattern analysis
- [ ] Consistent hashing implemented for shard routing
- [ ] Cross-shard query patterns identified and minimized
- [ ] Resharding plan documented and tested
- [ ] Per-shard monitoring (size, QPS, latency) in dashboard
- [ ] Shard-aware connection pooling configured
- [ ] Data sovereignty requirements mapped to shard placement
