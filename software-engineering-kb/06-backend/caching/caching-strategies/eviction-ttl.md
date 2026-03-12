# Eviction Policies & TTL Management

> **AI Plugin Directive — Cache Eviction, TTL, and Capacity Management**
> You are an AI coding assistant. When generating, reviewing, or refactoring cache configuration
> and eviction logic, follow EVERY rule in this document. Poor eviction policy causes cache thrashing,
> memory exhaustion, and serving stale data. Treat each section as non-negotiable.

**Core Rule: ALWAYS configure a memory limit and eviction policy for every cache. NEVER allow unbounded cache growth — it WILL exhaust memory. ALWAYS set TTL per data type based on volatility, not a single global TTL.**

---

## 1. Eviction Policies

```
┌──────────────────────────────────────────────────────────────┐
│                 Eviction Policies                             │
│                                                               │
│  When cache is full and a new entry arrives:                 │
│                                                               │
│  ┌──────────────┐  Evict the entry that was                 │
│  │ LRU          │  LEAST RECENTLY USED (accessed)           │
│  │ (Recommended)│  Best general-purpose policy.              │
│  └──────────────┘                                            │
│                                                               │
│  ┌──────────────┐  Evict the entry that was                 │
│  │ LFU          │  LEAST FREQUENTLY USED (count)            │
│  │              │  Good for popularity-based workloads.       │
│  └──────────────┘                                            │
│                                                               │
│  ┌──────────────┐  Evict a RANDOM entry.                    │
│  │ Random       │  Surprisingly effective for uniform        │
│  │              │  access patterns.                          │
│  └──────────────┘                                            │
│                                                               │
│  ┌──────────────┐  Evict the OLDEST entry by creation       │
│  │ FIFO         │  time. Simple but often suboptimal.        │
│  │              │                                            │
│  └──────────────┘                                            │
│                                                               │
│  ┌──────────────┐  NO eviction — reject new writes          │
│  │ noeviction   │  when memory is full. Use when data       │
│  │              │  loss is unacceptable.                     │
│  └──────────────┘                                            │
└──────────────────────────────────────────────────────────────┘
```

| Policy | Redis Name | Best For | Trade-off |
|--------|-----------|----------|-----------|
| **LRU** | `allkeys-lru` | General purpose | May evict hot infrequent data |
| **LFU** | `allkeys-lfu` | Popularity-based (CDN, API) | Cold start problem for new entries |
| **Volatile LRU** | `volatile-lru` | Mixed data (TTL + permanent) | Only evicts keys with TTL set |
| **Volatile LFU** | `volatile-lfu` | Mixed data, popularity-based | Only evicts keys with TTL set |
| **Volatile TTL** | `volatile-ttl` | Evict soonest-expiring first | Requires TTL on all evictable keys |
| **Random** | `allkeys-random` | Uniform access patterns | Unpredictable, simple |
| **No Eviction** | `noeviction` | Queues, sessions (data loss = bad) | Writes fail when full |

### 1.1 Redis Configuration

```
# redis.conf — Production settings
maxmemory 4gb
maxmemory-policy allkeys-lru
maxmemory-samples 10          # Higher = more accurate LRU, more CPU

# For mixed workloads (some keys with TTL, some without):
# maxmemory-policy volatile-lru

# For popularity-based workloads (CDN, hot content):
# maxmemory-policy allkeys-lfu
# lfu-log-factor 10
# lfu-decay-time 1
```

ALWAYS use `allkeys-lru` as the default policy. Switch to `allkeys-lfu` for CDN/content-heavy workloads. Use `volatile-*` variants ONLY when some keys must NEVER be evicted.

### 1.2 In-Process LRU (Node.js/Go)

**TypeScript (lru-cache)**
```typescript
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, any>({
  max: 10_000,              // Maximum entries
  maxSize: 100 * 1024 * 1024, // 100 MB max memory
  sizeCalculation: (value) => JSON.stringify(value).length,
  ttl: 5 * 60 * 1000,       // 5 min default TTL
  allowStale: false,         // Don't serve expired entries
  updateAgeOnGet: true,      // Refresh TTL on access
  updateAgeOnHas: false,
});
```

**Go (hashicorp/golang-lru)**
```go
import lru "github.com/hashicorp/golang-lru/v2"

cache, _ := lru.NewWithEvict[string, any](10_000, func(key string, value any) {
    // Eviction callback — log or cleanup
    metrics.Increment("cache.eviction", map[string]string{"key_prefix": extractPrefix(key)})
})
```

---

## 2. TTL Strategy

ALWAYS set TTL based on data volatility — NOT a single global value:

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Static config | 24 hours | Rarely changes |
| User profile | 5-15 min | Changes occasionally |
| Product catalog | 1-5 min | Updated by admin, moderate volatility |
| Search results | 30-60 sec | User-specific, frequent changes |
| Session data | 30 min | Security requirement |
| Real-time data (prices) | 5-10 sec | Must be fresh |
| Feature flags | 30-60 sec | Must propagate quickly |
| Auth tokens | Match token expiry | Security — NEVER cache longer than valid |
| API rate limits | 1-60 sec | Must be accurate |
| Computed aggregations | 5-15 min | Expensive to compute, acceptable staleness |

### 2.1 Dynamic TTL

```typescript
// Adjust TTL based on data characteristics
function calculateTTL(data: CachedItem): number {
  // Recently updated data gets shorter TTL (more volatile)
  const ageMs = Date.now() - new Date(data.updatedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 1) return 60;        // Updated < 1h ago: 1 min TTL
  if (ageHours < 24) return 300;      // Updated < 24h ago: 5 min TTL
  if (ageHours < 168) return 1800;    // Updated < 1 week ago: 30 min TTL
  return 3600;                         // Older: 1 hour TTL
}

// Jittered TTL — prevent thundering herd on mass expiry
function jitteredTTL(baseTTL: number): number {
  const jitter = Math.random() * 0.2 * baseTTL; // ±20% jitter
  return Math.floor(baseTTL + jitter - 0.1 * baseTTL);
}

// Usage
const ttl = jitteredTTL(calculateTTL(userData));
await redis.setex(`user:${userId}`, ttl, JSON.stringify(userData));
```

- ALWAYS add jitter to TTLs to prevent thundering herd on mass expiry
- ALWAYS use shorter TTLs for volatile data, longer for stable data
- NEVER cache authentication/authorization data longer than the token's expiry
- ALWAYS document the TTL rationale for each data type

---

## 3. Cache Sizing

### 3.1 Memory Budget Calculation

```
Cache Size Formula:
  total_memory = num_entries × avg_entry_size × overhead_factor

Example:
  Cache 100K user profiles:
  ├── avg_entry_size = 2 KB (JSON)
  ├── Redis overhead = 1.5x (pointers, metadata, fragmentation)
  ├── total = 100,000 × 2 KB × 1.5 = 300 MB
  └── Set maxmemory = 512 MB (with buffer)

Monitoring:
  ├── Track memory usage: INFO memory (Redis)
  ├── Alert at 80% capacity
  └── Scale or tune before hitting 100%
```

```typescript
// Monitor cache health
async function getCacheStats(redis: Redis): Promise<CacheStats> {
  const info = await redis.info("memory");
  const keyspace = await redis.info("keyspace");
  const stats = await redis.info("stats");

  return {
    usedMemory: parseInfoField(info, "used_memory_human"),
    maxMemory: parseInfoField(info, "maxmemory_human"),
    hitRate: calculateHitRate(stats),
    totalKeys: parseTotalKeys(keyspace),
    evictedKeys: parseInfoField(stats, "evicted_keys"),
  };
}

function calculateHitRate(stats: string): number {
  const hits = parseInt(parseInfoField(stats, "keyspace_hits"));
  const misses = parseInt(parseInfoField(stats, "keyspace_misses"));
  return hits / (hits + misses) * 100;
}
```

### 3.2 Cache Effectiveness Metrics

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Hit rate | > 80% | Increase TTL, cache more data |
| Miss rate | < 20% | Check if caching wrong data |
| Eviction rate | < 1% of reads | Increase memory or reduce cached data |
| Latency (p99) | < 5ms | Check network, connection pool |
| Memory usage | < 80% of max | Increase max or reduce entries |

---

## 4. Cache Warming

Pre-populate cache on startup to avoid cold-start miss storms:

```typescript
async function warmCache(): Promise<void> {
  logger.info("Cache warming started...");

  // Warm top 1000 most accessed products
  const hotProducts = await db.query(`
    SELECT * FROM products
    ORDER BY access_count DESC
    LIMIT 1000
  `);

  const pipeline = redis.pipeline();
  for (const product of hotProducts) {
    pipeline.setex(
      `product:${product.id}`,
      jitteredTTL(600), // Jittered 10 min
      JSON.stringify(product)
    );
  }
  await pipeline.exec();

  // Warm feature flags
  const flags = await db.query(`SELECT * FROM feature_flags WHERE active = true`);
  for (const flag of flags) {
    pipeline.setex(`flag:${flag.key}`, 60, JSON.stringify(flag));
  }
  await pipeline.exec();

  logger.info(`Cache warmed: ${hotProducts.length} products, ${flags.length} flags`);
}
```

- ALWAYS warm cache on application startup for critical hot data
- ALWAYS use jittered TTLs during warming to prevent synchronized expiry
- ALWAYS use pipeline/batch operations for warming (not individual SET calls)
- NEVER warm the entire dataset — only the hot subset (top N by access frequency)

---

## 5. Cache Key Design

ALWAYS follow a consistent key naming convention:

```
Format: prefix:entity:identifier[:field]

Examples:
  user:123                    → Full user object
  user:123:profile            → User profile subset
  user:123:permissions        → User permissions
  product:456                 → Product details
  product:456:price           → Product price only
  search:q=shoes&page=1       → Search results
  rate:ip:192.168.1.1         → Rate limit counter
  session:abc123              → Session data
  lock:order:789              → Distributed lock

Rules:
  ├── Use colons (:) as separators
  ├── Keep keys short (< 100 bytes) — keys consume memory
  ├── Use deterministic key generation (same input = same key)
  ├── NEVER include sensitive data in keys (visible in MONITOR)
  └── Prefix with application name in shared Redis: myapp:user:123
```

```typescript
// Key builder — ensures consistent naming
class CacheKeyBuilder {
  constructor(private appPrefix: string = "") {}

  user(userId: string): string {
    return `${this.appPrefix}user:${userId}`;
  }

  userField(userId: string, field: string): string {
    return `${this.appPrefix}user:${userId}:${field}`;
  }

  search(params: Record<string, string>): string {
    const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
    const normalized = sorted.map(([k, v]) => `${k}=${v}`).join("&");
    return `${this.appPrefix}search:${createHash("sha256").update(normalized).digest("hex").slice(0, 16)}`;
  }

  rateLimit(identifier: string): string {
    return `${this.appPrefix}rate:${identifier}`;
  }
}
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No memory limit | Redis OOM, crashes | Set `maxmemory` with eviction policy |
| Single TTL for all data | Hot data evicted, stale data served | Per-type TTL based on volatility |
| No TTL jitter | Mass expiry → thundering herd | Add ±10-20% random jitter |
| No cache warming | Cold-start miss storm, slow startup | Pre-load hot data on boot |
| Random key naming | Inconsistent, hard to invalidate | Convention: `prefix:entity:id` |
| Long keys | Wasted memory | Keep keys < 100 bytes |
| No monitoring | Cannot detect low hit rate | Track hit rate, memory, evictions |
| Caching cold data | Low hit rate, wasted memory | Cache only hot data (80/20 rule) |
| No eviction policy | Redis rejects writes when full | Configure `allkeys-lru` |

---

## 7. Enforcement Checklist

- [ ] Memory limit (`maxmemory`) configured on every Redis instance
- [ ] Eviction policy set (`allkeys-lru` default, `allkeys-lfu` for content)
- [ ] TTL set on EVERY cache entry — no infinite caching
- [ ] TTL values documented per data type with rationale
- [ ] TTL jitter applied to prevent synchronized mass expiry
- [ ] Cache warming implemented for hot data on startup
- [ ] Key naming convention documented and enforced
- [ ] Cache hit rate monitored (target > 80%)
- [ ] Memory usage monitored (alert at 80%)
- [ ] Eviction rate monitored (alert if > 1% of reads)
- [ ] Cache sized based on entry count × avg size × 1.5x overhead
