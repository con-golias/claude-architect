# Distributed Caching

> **AI Plugin Directive — Distributed Caching Architecture**
> You are an AI coding assistant. When generating, reviewing, or refactoring distributed caching
> infrastructure code, follow EVERY rule in this document. Distributed cache failures cascade
> to databases and downstream services. Treat each section as non-negotiable.

**Core Rule: ALWAYS treat the cache as ephemeral — it can lose ALL data at any time. The application MUST function without the cache (degraded, not broken). ALWAYS use consistent hashing for cache partitioning. ALWAYS separate cache instances from application data stores.**

---

## 1. Distributed Cache Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│            Distributed Cache Architecture                         │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ App Pod 1│  │ App Pod 2│  │ App Pod 3│                       │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │                       │
│  │ │ L1   │ │  │ │ L1   │ │  │ │ L1   │ │  (In-Process LRU)    │
│  │ └──┬───┘ │  │ └──┬───┘ │  │ └──┬───┘ │                       │
│  └────┼─────┘  └────┼─────┘  └────┼─────┘                       │
│       │              │              │                              │
│  ┌────▼──────────────▼──────────────▼────────┐                   │
│  │          Redis Cluster (L2)                │                   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐      │                   │
│  │  │ Shard 0│  │ Shard 1│  │ Shard 2│      │                   │
│  │  │ 0-5461 │  │5462-   │  │10923-  │      │                   │
│  │  │        │  │10922   │  │16383   │      │                   │
│  │  │ Master │  │ Master │  │ Master │      │                   │
│  │  │  ┌───┐ │  │  ┌───┐ │  │  ┌───┐ │      │                   │
│  │  │  │Rep│ │  │  │Rep│ │  │  │Rep│ │      │                   │
│  │  │  └───┘ │  │  └───┘ │  │  └───┘ │      │                   │
│  │  └────────┘  └────────┘  └────────┘      │                   │
│  └───────────────────────────────────────────┘                   │
│                         │                                         │
│  ┌──────────────────────▼─────────────────────┐                  │
│  │              Database (Source of Truth)      │                  │
│  └─────────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Consistent Hashing

ALWAYS use consistent hashing for distributing cache keys across nodes:

```
┌──────────────────────────────────────────────────────────────┐
│              Consistent Hashing Ring                           │
│                                                               │
│              Node A                                           │
│            ╱        ╲                                         │
│         ╱              ╲                                      │
│       ╱     Keys 0-90    ╲                                    │
│     ╱                      ╲                                  │
│   Node D              Node B                                 │
│     ╲     Keys 270-360  ╱    Keys 91-180                    │
│       ╲              ╱                                       │
│         ╲          ╱                                         │
│            ╲    ╱                                            │
│              Node C                                           │
│           Keys 181-270                                        │
│                                                               │
│  When Node B is removed:                                     │
│  ├── Only keys 91-180 are redistributed                      │
│  ├── Keys on other nodes are NOT affected                    │
│  └── Minimal cache invalidation                              │
│                                                               │
│  With virtual nodes (vnodes):                                │
│  ├── Each physical node has 100-200 virtual positions        │
│  └── Ensures even distribution of keys                       │
└──────────────────────────────────────────────────────────────┘
```

```typescript
import { createHash } from "crypto";

class ConsistentHash {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];

  constructor(
    private nodes: string[],
    private virtualNodes: number = 150
  ) {
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  addNode(node: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`${node}:${i}`);
      this.ring.set(hash, node);
      this.sortedKeys.push(hash);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  removeNode(node: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`${node}:${i}`);
      this.ring.delete(hash);
      this.sortedKeys = this.sortedKeys.filter((k) => k !== hash);
    }
  }

  getNode(key: string): string {
    const hash = this.hash(key);
    // Find first node clockwise from the key's position
    for (const nodeHash of this.sortedKeys) {
      if (nodeHash >= hash) {
        return this.ring.get(nodeHash)!;
      }
    }
    // Wrap around to first node
    return this.ring.get(this.sortedKeys[0])!;
  }

  private hash(key: string): number {
    return parseInt(
      createHash("md5").update(key).digest("hex").slice(0, 8),
      16
    );
  }
}
```

- ALWAYS use 100-200 virtual nodes per physical node for even distribution
- ALWAYS use consistent hashing when manually sharding (non-Redis Cluster)
- Redis Cluster handles this automatically with 16384 hash slots

---

## 3. Redis Cluster Configuration

```
# Minimum Redis Cluster: 3 masters + 3 replicas (6 nodes)
#
# Production topology:
# ┌────────────┬────────────┬────────────┐
# │  Master 1  │  Master 2  │  Master 3  │
# │  Slots     │  Slots     │  Slots     │
# │  0-5461    │  5462-     │  10923-    │
# │            │  10922     │  16383     │
# │  ┌──────┐  │  ┌──────┐  │  ┌──────┐  │
# │  │Repl 1│  │  │Repl 2│  │  │Repl 3│  │
# │  └──────┘  │  └──────┘  │  └──────┘  │
# └────────────┴────────────┴────────────┘
```

**TypeScript (ioredis cluster)**
```typescript
import Redis from "ioredis";

const cluster = new Redis.Cluster([
  { host: "redis-1.example.com", port: 6379 },
  { host: "redis-2.example.com", port: 6379 },
  { host: "redis-3.example.com", port: 6379 },
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    tls: {},
    connectTimeout: 5000,
    commandTimeout: 3000,
  },
  scaleReads: "slave",     // Read from replicas for read-heavy workloads
  maxRedirections: 16,      // Follow MOVED/ASK redirections
  retryDelayOnFailover: 300,
  retryDelayOnClusterDown: 1000,
  clusterRetryStrategy: (times) => Math.min(times * 200, 2000),

  // CRITICAL: handle CROSSSLOT errors for multi-key operations
  // Use hash tags {user:123} to colocate related keys on same slot
});
```

**Go (go-redis cluster)**
```go
import "github.com/redis/go-redis/v9"

rdb := redis.NewClusterClient(&redis.ClusterOptions{
    Addrs: []string{
        "redis-1.example.com:6379",
        "redis-2.example.com:6379",
        "redis-3.example.com:6379",
    },
    Password:     os.Getenv("REDIS_PASSWORD"),
    ReadOnly:     true,           // Read from replicas
    RouteByLatency: true,         // Route reads to lowest-latency node
    MaxRetries:   3,
    PoolSize:     20,
    MinIdleConns: 5,
    DialTimeout:  5 * time.Second,
    ReadTimeout:  3 * time.Second,
    WriteTimeout: 3 * time.Second,
})
```

---

## 4. Hash Tags (Key Colocation)

ALWAYS use hash tags to colocate related keys on the same Redis Cluster slot:

```
Hash Tag Rules:
├── Redis hashes ONLY the content between { }
├── {user:123}:profile → slot = hash("user:123")
├── {user:123}:orders  → slot = hash("user:123")  ← SAME SLOT
├── {user:123}:perms   → slot = hash("user:123")  ← SAME SLOT
└── This enables multi-key operations (MGET, pipeline, Lua) on related keys

Without hash tags:
├── user:123:profile → slot A
├── user:123:orders  → slot B  ← DIFFERENT SLOT = CROSSSLOT error
└── MGET user:123:profile user:123:orders → FAILS in cluster
```

```typescript
// GOOD — hash tags for related keys ✅
const keys = {
  profile: `{user:${userId}}:profile`,
  orders: `{user:${userId}}:orders`,
  permissions: `{user:${userId}}:permissions`,
};

// All keys on same slot — multi-key operations work
const [profile, orders, permissions] = await redis.mget(
  keys.profile, keys.orders, keys.permissions
);

// BAD — no hash tags ❌
const profile = `user:${userId}:profile`;     // slot X
const orders = `user:${userId}:orders`;       // slot Y (different!)
await redis.mget(profile, orders); // CROSSSLOT ERROR in cluster
```

- ALWAYS use hash tags when keys need multi-key operations (MGET, transactions, Lua)
- NEVER overuse hash tags — too many keys on one slot creates hotspots
- ALWAYS document which keys are colocated and why

---

## 5. Cache Failover & Resilience

### 5.1 Circuit Breaker for Cache

```typescript
class ResilientCache {
  private circuitBreaker: CircuitBreaker;

  constructor(private redis: Redis, private fallbackTTL: number = 5000) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30_000,
    });
  }

  async get<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const cached = await this.redis.get(key);
        if (cached) return JSON.parse(cached);

        const data = await fetcher();
        await this.redis.setex(key, ttl, JSON.stringify(data));
        return data;
      });
    } catch {
      // Cache unavailable — go directly to source
      logger.warn("Cache unavailable, falling back to DB", { key });
      metrics.increment("cache.circuit_open");
      return fetcher();
    }
  }
}
```

### 5.2 Local Fallback Cache

```typescript
// When Redis is down, use in-process LRU as temporary fallback
class FallbackCache<T> {
  private localFallback = new LRUCache<string, T>({ max: 10_000, ttl: 60_000 });
  private redisAvailable = true;

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.redisAvailable) {
      try {
        const cached = await this.redis.get(key);
        if (cached) return JSON.parse(cached);
      } catch {
        this.redisAvailable = false;
        setTimeout(() => { this.redisAvailable = true; }, 30_000);
      }
    }

    // Check local fallback
    const local = this.localFallback.get(key);
    if (local) return local;

    // Fetch from source
    const data = await fetcher();
    this.localFallback.set(key, data);
    return data;
  }
}
```

- ALWAYS implement circuit breaker on cache connections
- ALWAYS gracefully degrade to database when cache is unavailable
- NEVER let cache failure crash the application
- ALWAYS monitor cache availability and alert on circuit open

---

## 6. Cache Topology Patterns

| Pattern | Nodes | Use Case | Trade-off |
|---------|-------|----------|-----------|
| **Single instance** | 1 | Dev, low traffic | No HA, single point of failure |
| **Master-Replica** | 1 master + N replicas | Read-heavy, HA | Replication lag, no write scaling |
| **Sentinel** | 3 sentinels + master + replicas | Auto-failover | Complex setup, no write scaling |
| **Cluster** | 3+ masters + replicas | Write scaling, HA | Hash slots, multi-key limitations |
| **Client-side sharding** | N independent instances | Legacy, pre-Cluster | No auto-failover, manual rebalancing |

ALWAYS use Redis Cluster for production workloads requiring both high availability and write scaling. Use Sentinel for simpler HA setups where write scaling is not needed.

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Cache as source of truth | Data loss on cache restart | Database is ALWAYS source of truth |
| No failover handling | App crashes when cache is down | Circuit breaker + DB fallback |
| Shared Redis for cache + queues | Cache eviction deletes jobs | Separate Redis instances |
| No hash tags in cluster | CROSSSLOT errors on multi-key ops | Use `{entity:id}` hash tags |
| Single Redis (no HA) in prod | Cache unavailable on node failure | Redis Cluster or Sentinel |
| No connection pooling | Connection storms under load | Configure pool size + min idle |
| No TLS for Redis | Data in transit is readable | ALWAYS use TLS in production |
| Oversized cluster | Unnecessary complexity and cost | Start small, scale when needed |
| No read replicas | Master overloaded with reads | Route reads to replicas |
| No monitoring | Cannot detect degradation | Track latency, hit rate, memory |

---

## 8. Enforcement Checklist

- [ ] Cache treated as ephemeral — application works without it (degraded)
- [ ] Circuit breaker wraps all cache operations
- [ ] Redis Cluster or Sentinel used for production HA
- [ ] TLS enabled for all Redis connections in production
- [ ] Connection pool configured (pool size, min idle, timeouts)
- [ ] Hash tags used for multi-key operations in cluster mode
- [ ] Separate Redis instances for cache vs queues/sessions
- [ ] Read replicas used for read-heavy workloads
- [ ] Consistent hashing used for manual sharding (if not Cluster)
- [ ] Cache failover tested and documented
- [ ] Monitoring: latency, hit rate, memory, connections, replication lag
