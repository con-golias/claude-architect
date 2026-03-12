# Caching Patterns — Performance Engineering

> Domain: Performance Engineering > Caching Patterns
> Importance: CRITICAL
> Complements: 06-backend/caching/caching-strategies/core-patterns.md (implementation) — this doc covers performance profiling, pattern selection criteria, multi-tier architecture, request coalescing, and negative caching

**Core Rule: ALWAYS select caching pattern based on measured read/write ratio, latency requirements, and consistency needs. NEVER default to cache-aside without evaluating alternatives. Multi-tier caching is MANDATORY for latency-critical paths with > 100 reads/second.**

---

## 1. Cache-Aside (Lazy Loading) — Performance Profile

```
┌────────────────────────────────────────────────────────────────┐
│  Cache-Aside Performance Characteristics                       │
│                                                                │
│  Cache hit:   ~1ms  (Redis GET + deserialize)                 │
│  Cache miss:  ~25ms (Redis GET miss + DB query + Redis SET)   │
│  Miss penalty: ~5ms overhead vs direct DB query (~20ms)       │
│                                                                │
│  Hit ratio:   depends on TTL and read/write ratio             │
│  Best for:    read-heavy (> 10:1), tolerance for staleness    │
│  Worst case:  cold start — ALL requests hit DB simultaneously │
│                                                                │
│  Cost model:                                                   │
│  avg_latency = (hit_ratio * hit_latency) +                    │
│                ((1 - hit_ratio) * miss_latency)               │
│  Example: 90% hit ratio → 0.9 * 1ms + 0.1 * 25ms = 3.4ms   │
│           vs direct DB: 20ms → 5.9x improvement              │
└────────────────────────────────────────────────────────────────┘
```

```typescript
// Performance-instrumented cache-aside
class CacheAside<T> {
  private hitLatency = new Histogram({ name: "cache_hit_ms", buckets: [0.1, 0.5, 1, 2, 5] });
  private missLatency = new Histogram({ name: "cache_miss_ms", buckets: [1, 5, 10, 25, 50, 100] });

  async get(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
    const start = performance.now();
    const cached = await this.redis.get(key);

    if (cached) {
      this.hitLatency.observe(performance.now() - start);
      return JSON.parse(cached);
    }

    const data = await fetcher();
    // Non-blocking cache write — don't add to user-facing latency
    this.redis.setex(key, ttl, JSON.stringify(data)).catch(() => {});
    this.missLatency.observe(performance.now() - start);
    return data;
  }
}
```

## 2. Read-Through and Write-Through — Performance Profiles

```
Read-through: cache layer manages DB reads transparently.
Same latency as cache-aside. Advantage: encapsulates logic centrally.
Use when: ORM integration, shared cache library across services.

Write-through: writes go to cache AND DB synchronously.
Write latency: DB write + cache SET = 21-25ms vs 20ms without cache.
100% hit ratio for recently written data. Use for consistency-critical data.

Write-behind: write to cache only, flush to DB async.
Write latency: ~1ms (cache only). 10x throughput via batched DB writes.
Risk: data loss on cache crash. Use for counters, analytics, activity logs.
```

```typescript
// Write-through: parallel DB+cache write minimizes overhead
class WriteThroughCache<T> {
  async write(key: string, data: T, ttl: number): Promise<void> {
    await Promise.all([
      this.db.upsert(key, data),
      this.redis.setex(`cache:${key}`, ttl, JSON.stringify(data)),
    ]);
  }
  async read(key: string): Promise<T> {
    const cached = await this.redis.get(`cache:${key}`);
    if (cached) return JSON.parse(cached);
    const data = await this.db.findById(key);
    if (data) await this.redis.setex(`cache:${key}`, this.ttl, JSON.stringify(data));
    return data;
  }
}
```

## 3. Write-Behind (Write-Back) — Performance Profile

```typescript
class WriteBehindCache<T> {
  private buffer = new Map<string, { data: T; timestamp: number }>();

  constructor(private redis: Redis, private db: Database,
    private opts: { flushIntervalMs: number; maxBufferSize: number; ttl: number }) {
    setInterval(() => this.flush(), opts.flushIntervalMs);
  }

  async write(key: string, data: T): Promise<void> {
    await this.redis.setex(`cache:${key}`, this.opts.ttl, JSON.stringify(data));
    this.buffer.set(key, { data, timestamp: Date.now() });
    if (this.buffer.size >= this.opts.maxBufferSize) await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.buffer.size === 0) return;
    const batch = new Map(this.buffer);
    this.buffer.clear();
    try {
      await this.db.batchUpsert(Array.from(batch.entries()).map(([k, v]) => ({ key: k, ...v })));
    } catch (err) {
      for (const [k, v] of batch) this.buffer.set(k, v); // Re-queue on failure
      logger.error("Write-behind flush failed", { size: batch.size });
    }
  }
}
```

## 4. Refresh-Ahead — Performance Profile

```
Refresh-ahead: proactively refresh cache BEFORE expiry.
Zero miss latency — cache is always warm for hot keys.
CPU/network cost: background fetches consume resources.

Implementation: refresh when TTL remaining < threshold (e.g., 20% of TTL)
```

```typescript
class RefreshAheadCache<T> {
  private refreshing = new Set<string>();

  async get(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
    const cacheKey = `cache:${key}`;
    const [value, remainingTTL] = await Promise.all([
      this.redis.get(cacheKey),
      this.redis.ttl(cacheKey),
    ]);

    if (value) {
      // Refresh ahead: if < 20% TTL remaining, refresh in background
      if (remainingTTL > 0 && remainingTTL < ttl * 0.2 && !this.refreshing.has(key)) {
        this.refreshInBackground(key, cacheKey, fetcher, ttl);
      }
      return JSON.parse(value);
    }

    // Cache miss: synchronous fetch
    const data = await fetcher();
    await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
    return data;
  }

  private async refreshInBackground(key: string, cacheKey: string,
    fetcher: () => Promise<T>, ttl: number): Promise<void> {
    this.refreshing.add(key);
    try {
      const data = await fetcher();
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
      metrics.increment("refresh_ahead.refreshed");
    } catch (err) {
      metrics.increment("refresh_ahead.refresh_failed");
    } finally {
      this.refreshing.delete(key);
    }
  }
}
```

## 5. Multi-Tier Caching (L1 Local + L2 Distributed)

```
┌────────────────────────────────────────────────────────────────┐
│  Multi-Tier Performance Model                                  │
│                                                                │
│  L1 (process LRU):  0.1-0.5ms, 80-95% hit rate for hot data  │
│  L2 (Redis):        1-5ms, 80-95% hit rate for warm data     │
│  Origin (DB):       10-50ms, 100% "hit rate" (source of truth)│
│                                                                │
│  Effective latency with L1=90% hit, L2=90% hit:              │
│  0.9 * 0.2ms + 0.09 * 2ms + 0.01 * 30ms = 0.66ms            │
│  vs Redis only: 0.9 * 2ms + 0.1 * 30ms = 4.8ms              │
│  → Multi-tier is 7.3x faster for hot-path data               │
└────────────────────────────────────────────────────────────────┘
```

```typescript
class MultiTierCache<T> {
  private l1: LRUCache<string, T>;
  private l1Hits = 0; private l2Hits = 0; private misses = 0;

  constructor(private redis: Redis, l1MaxEntries: number, private l1TtlMs: number) {
    this.l1 = new LRUCache<string, T>({ max: l1MaxEntries, ttl: l1TtlMs });

    // Subscribe to invalidation events for L1 consistency
    const sub = redis.duplicate();
    sub.subscribe("cache:invalidate");
    sub.on("message", (_, key) => this.l1.delete(key));
  }

  async get(key: string, fetcher: () => Promise<T>, l2Ttl: number): Promise<T> {
    // L1: process-local, microseconds
    const l1Hit = this.l1.get(key);
    if (l1Hit !== undefined) { this.l1Hits++; return l1Hit; }

    // L2: Redis, milliseconds
    const l2Hit = await this.redis.get(`c:${key}`);
    if (l2Hit) {
      this.l2Hits++;
      const data = JSON.parse(l2Hit) as T;
      this.l1.set(key, data);
      return data;
    }

    // Origin: database, tens of milliseconds
    this.misses++;
    const data = await fetcher();
    this.l1.set(key, data);
    await this.redis.setex(`c:${key}`, l2Ttl, JSON.stringify(data));
    return data;
  }

  async invalidate(key: string): Promise<void> {
    this.l1.delete(key);
    await this.redis.del(`c:${key}`);
    await this.redis.publish("cache:invalidate", key);
  }

  getMetrics() {
    const total = this.l1Hits + this.l2Hits + this.misses;
    return {
      l1HitRatio: total ? this.l1Hits / total : 0,
      l2HitRatio: total ? this.l2Hits / total : 0,
      missRatio: total ? this.misses / total : 0,
    };
  }
}
```

```go
type MultiTierCache[T any] struct {
    l1     *lru.Cache[string, T]
    l2     *redis.Client
    l1Hits atomic.Int64
    l2Hits atomic.Int64
    misses atomic.Int64
}

func (c *MultiTierCache[T]) Get(ctx context.Context, key string,
    fetcher func() (T, error), l2TTL time.Duration) (T, error) {

    // L1
    if val, ok := c.l1.Get(key); ok {
        c.l1Hits.Add(1)
        return val, nil
    }
    // L2
    raw, err := c.l2.Get(ctx, "c:"+key).Result()
    if err == nil {
        c.l2Hits.Add(1)
        var val T
        json.Unmarshal([]byte(raw), &val)
        c.l1.Add(key, val)
        return val, nil
    }
    // Origin
    c.misses.Add(1)
    val, err := fetcher()
    if err != nil { return val, err }
    c.l1.Add(key, val)
    encoded, _ := json.Marshal(val)
    c.l2.SetEx(ctx, "c:"+key, string(encoded), l2TTL)
    return val, nil
}
```

## 6. Request Coalescing (Deduplication)

```typescript
// Request coalescing: N concurrent requests for same key → 1 origin fetch
// Critical for cache miss storms and thundering herd scenarios

class RequestCoalescer<T> {
  private inFlight = new Map<string, Promise<T>>();

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      metrics.increment("coalescer.coalesced");
      return existing; // Share the in-flight promise
    }

    const promise = fetcher().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    metrics.increment("coalescer.originated");
    return promise;
  }
}

// Usage: wrap fetcher to coalesce concurrent cache misses
const coalescer = new RequestCoalescer<Product>();

async function getProduct(id: string): Promise<Product> {
  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);

  return coalescer.get(id, async () => {
    const product = await db.products.findById(id);
    await redis.setex(`product:${id}`, 300, JSON.stringify(product));
    return product;
  });
}
// 100 concurrent requests for same product → 1 DB query, 100 served
```

## 7. Negative Caching (Caching Misses)

```typescript
// Cache NOT-FOUND results to prevent repeated DB queries for nonexistent data
// Without: each request for missing data hits DB (0% hit ratio for these keys)
// With: one DB miss, then serve "not found" from cache

const NOT_FOUND = Symbol("NOT_FOUND");

async function getWithNegativeCache<T>(
  key: string, fetcher: () => Promise<T | null>, ttl: number
): Promise<T | null> {
  const cached = await redis.get(`cache:${key}`);
  if (cached === "__NULL__") {
    metrics.increment("negative_cache.hit");
    return null; // Known not-found, served from cache
  }
  if (cached) return JSON.parse(cached);

  const data = await fetcher();
  if (data === null) {
    // Cache the miss with SHORT TTL (prevent probing attacks from caching forever)
    await redis.setex(`cache:${key}`, Math.min(ttl, 60), "__NULL__");
    metrics.increment("negative_cache.stored");
    return null;
  }
  await redis.setex(`cache:${key}`, ttl, JSON.stringify(data));
  return data;
}

// Performance impact:
// API receiving 1000 req/sec for nonexistent user IDs (enumeration attack)
// Without negative cache: 1000 DB queries/sec (DB overwhelmed)
// With negative cache (60s TTL): 1 DB query/60s per unique ID
```

---

## 8. Best Practices

1. **Calculate cache latency model** — avg = (hit_ratio * hit_cost) + (miss_ratio * miss_cost); verify improvement.
2. **Use multi-tier for hot paths** — L1+L2 is 5-10x faster than L2-only for frequently accessed data.
3. **Implement request coalescing** — prevents N concurrent misses from hitting origin N times.
4. **Cache negative results** — missing data queries are often 30-50% of traffic; cache with short TTL.
5. **Use refresh-ahead for zero-downtime** — proactively refresh before expiry eliminates miss latency.
6. **Use write-behind for counters** — batched DB writes are 10x more efficient than individual writes.
7. **Monitor per-tier hit ratios** — L1 and L2 should each be > 80%; diagnose which tier is underperforming.
8. **Subscribe to invalidation for L1** — pub/sub cross-instance invalidation keeps L1 fresh without short TTL.
9. **Use short negative cache TTL** — 30-60s prevents DB flood without caching stale "not found" long.
10. **Profile serialization cost** — JSON parse/stringify can dominate miss latency; consider MessagePack for large objects.

## 9. Anti-Patterns

1. **Cache-aside without coalescing** — 1000 concurrent misses = 1000 DB queries; coalesce to 1.
2. **No negative caching** — repeated lookups for nonexistent data waste DB resources.
3. **Single-tier for hot paths** — Redis-only adds 1-5ms per request; L1 reduces to 0.1ms.
4. **Write-behind for critical data** — cache crash loses unbacked writes; use write-through instead.
5. **Refresh-ahead for all keys** — wastes CPU/network refreshing cold data; only refresh hot keys.
6. **L1 without invalidation subscription** — process serves stale data for full L1 TTL after update.
7. **Long negative cache TTL** — user creates account, gets "not found" for 5 minutes from negative cache.
8. **No metrics per caching pattern** — cannot compare effectiveness of different strategies in the system.

## 10. Enforcement Checklist

- [ ] Caching pattern explicitly chosen based on read/write ratio and consistency needs
- [ ] Cache latency model calculated and validated against measurements
- [ ] Multi-tier (L1+L2) implemented for paths with > 100 reads/sec
- [ ] Request coalescing active for cache miss path
- [ ] Negative caching enabled with short TTL (30-60s)
- [ ] L1 invalidation via pub/sub subscription active
- [ ] Per-tier hit ratios monitored (L1, L2, overall)
- [ ] Write-behind used only for non-critical data with explicit data-loss acceptance
- [ ] Refresh-ahead limited to hot keys (not all cached data)
- [ ] Serialization format evaluated (JSON vs binary) for large cached objects
