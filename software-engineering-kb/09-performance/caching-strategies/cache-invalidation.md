# Cache Invalidation Performance Engineering

> Domain: Performance Engineering > Cache Invalidation
> Importance: CRITICAL
> Complements: 06-backend/caching/cache-invalidation.md (strategies/implementation) — this doc covers performance impact of invalidation, stampede prevention benchmarking, consistency-latency tradeoffs

**Core Rule: EVERY invalidation strategy has a performance cost. ALWAYS measure invalidation latency, stampede risk, and consistency window. ALWAYS implement stampede prevention for keys with > 10 reads/second. TTL jitter is NON-NEGOTIABLE for any cache with > 1000 keys.**

---

## 1. TTL-Based Expiration Performance

```
┌────────────────────────────────────────────────────────────────┐
│  TTL Performance Characteristics                               │
│                                                                │
│  Redis lazy expiry: key checked on access. O(1). Zero overhead│
│  Redis active expiry: 20 random keys/100ms scanned. Background│
│                                                                │
│  Performance impact of TTL choice:                             │
│  TTL = 1s:   hit ratio ~50% (frequent misses = high DB load)  │
│  TTL = 10s:  hit ratio ~90% (good for fast-changing data)     │
│  TTL = 60s:  hit ratio ~98% (good for moderate-change data)   │
│  TTL = 300s: hit ratio ~99.6% (good for stable data)          │
│                                                                │
│  Formula: approximate hit ratio = 1 - (1 / (TTL * reads/sec))│
│  Example: TTL=60s, 10 reads/sec → 1 - 1/600 = 99.8% hit ratio│
│                                                                │
│  Consistency window = max staleness = TTL duration             │
│  Trade-off: longer TTL = higher hit ratio = more staleness    │
└────────────────────────────────────────────────────────────────┘
```

```typescript
// Dynamic TTL: balance hit ratio vs staleness based on data volatility
function calculateOptimalTTL(metrics: DataMetrics): number {
  const { readsPerSecond, writesPerHour, acceptableStalenessMs } = metrics;

  // TTL should not exceed acceptable staleness
  const maxTTL = acceptableStalenessMs / 1000;

  // TTL should be long enough for useful hit ratio (target > 90%)
  // hit_ratio = 1 - 1/(TTL * readsPerSecond) > 0.9
  // TTL > 10 / readsPerSecond
  const minTTLForHitRatio = Math.ceil(10 / readsPerSecond);

  // If data changes frequently, cap TTL at write interval
  const writeIntervalSec = 3600 / Math.max(writesPerHour, 1);

  const ttl = Math.min(maxTTL, writeIntervalSec, 3600); // Cap at 1 hour
  const effectiveTTL = Math.max(ttl, minTTLForHitRatio, 1); // At least 1 second

  return effectiveTTL;
}

// TTL jitter: MANDATORY for caches with > 1000 keys
function jitteredTTL(baseTTL: number, jitterPercent: number = 0.15): number {
  // +-15% jitter prevents synchronized mass expiry
  const jitter = baseTTL * jitterPercent;
  return Math.floor(baseTTL - jitter + Math.random() * 2 * jitter);
}

// Performance impact of NO jitter:
// 10,000 keys, all TTL=300s, cached at similar time
// At t=300s: ~10,000 simultaneous cache misses → DB receives 10K queries in 1 second
// With jitter: misses spread over 300s ± 45s window → ~110 misses/sec (smooth)
```

## 2. Event-Driven Invalidation — Performance Measurement

```typescript
// Measure invalidation latency: time from data change to cache update
class InstrumentedInvalidator {
  async invalidate(key: string, changeTimestamp: number): Promise<void> {
    const start = performance.now();

    await redis.del(key);
    // Notify L1 caches via pub/sub
    await redis.publish("cache:invalidate", JSON.stringify({ key, ts: changeTimestamp }));

    const invalidationLatency = performance.now() - start;
    const propagationDelay = Date.now() - changeTimestamp;

    metrics.histogram("invalidation.latency_ms", invalidationLatency);
    metrics.histogram("invalidation.propagation_delay_ms", propagationDelay);

    // Alert if invalidation takes > 100ms (consistency window growing)
    if (propagationDelay > 100) {
      logger.warn("Slow cache invalidation", { key, delayMs: propagationDelay });
    }
  }
}

// CDC-based invalidation performance tracking
async function handleCDCEvent(event: CDCEvent): Promise<void> {
  const cdcLag = Date.now() - event.timestamp; // Time from DB write to CDC event
  metrics.histogram("cdc.lag_ms", cdcLag);

  const keysToInvalidate = resolveKeysForTable(event.table, event.key);
  const start = performance.now();
  if (keysToInvalidate.length > 0) {
    await redis.del(...keysToInvalidate);
  }
  metrics.histogram("cdc.invalidation_ms", performance.now() - start);

  // Total consistency window = CDC lag + invalidation time + L1 TTL
  // Typical: 50ms CDC + 1ms Redis DEL + 30s L1 TTL = ~30 seconds max staleness
}
```

```go
// Go — measure invalidation propagation time
func (inv *Invalidator) Invalidate(ctx context.Context, key string, changeTime time.Time) error {
    start := time.Now()

    if err := inv.rdb.Del(ctx, key).Err(); err != nil {
        return err
    }
    inv.rdb.Publish(ctx, "cache:invalidate", key)

    latency := time.Since(start)
    propagation := time.Since(changeTime)

    inv.metrics.ObserveHistogram("invalidation_latency", latency.Seconds())
    inv.metrics.ObserveHistogram("invalidation_propagation", propagation.Seconds())
    return nil
}
```

## 3. Tag-Based Invalidation Performance

```typescript
// Tag-based: O(M) where M = keys per tag vs O(N) for pattern scan
// Tags: maintain a SET of cache keys per tag for instant lookup

class TaggedCache {
  async set(key: string, value: unknown, ttl: number, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.setex(key, ttl, JSON.stringify(value));
    // Register key in each tag set
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);
      pipeline.expire(`tag:${tag}`, ttl + 60); // Tag TTL slightly longer than data
    }
    await pipeline.exec();
  }

  async invalidateByTag(tag: string): Promise<{ keysDeleted: number; latencyMs: number }> {
    const start = performance.now();
    const keys = await this.redis.smembers(`tag:${tag}`);

    if (keys.length > 0) {
      const pipeline = this.redis.pipeline();
      // Delete all tagged keys + the tag set itself
      for (const key of keys) pipeline.del(key);
      pipeline.del(`tag:${tag}`);
      await pipeline.exec();
    }

    const latency = performance.now() - start;
    metrics.histogram("tag_invalidation.latency_ms", latency);
    metrics.histogram("tag_invalidation.keys_count", keys.length);
    return { keysDeleted: keys.length, latencyMs: latency };
  }
}

// Performance: tag-based vs pattern scan
// Tag-based: SMEMBERS (O(M)) + DEL M keys → ~1ms for 100 keys
// SCAN pattern: O(N) where N = ALL keys in Redis → 100-1000ms for 1M total keys
// Tag-based is 100-1000x faster for targeted invalidation
```

## 4. Versioned Cache Keys — Performance Profile

```typescript
// Version-based invalidation: no delete needed, instant, zero-cost invalidation
// Trade-off: orphaned keys consume memory until TTL expiry

class VersionedCache {
  async get<T>(entity: string, id: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
    const version = await this.redis.get(`ver:${entity}:${id}`) || "0";
    const key = `${entity}:${id}:v${version}`;

    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await fetcher();
    await this.redis.setex(key, ttl, JSON.stringify(data));
    return data;
  }

  async invalidate(entity: string, id: string): Promise<void> {
    // O(1) — just increment version counter. Old key is orphaned.
    await this.redis.incr(`ver:${entity}:${id}`);
    // Orphaned memory = old_value_size * TTL_remaining / TTL_total (amortized)
    // For 2KB value with 300s TTL: ~1KB average orphaned memory per invalidation
  }
}

// Performance comparison:
// Delete-based: 1 DEL command, immediate memory reclaim, 0.1ms
// Version-based: 1 INCR command, deferred memory reclaim, 0.1ms
// Version-based advantage: no need to know/find old cache key
// Version-based cost: ~50% extra memory during high-churn periods
```

## 5. Cache Stampede Prevention — Benchmarked Approaches

```
┌────────────────────────────────────────────────────────────────┐
│  Stampede Prevention Performance Comparison                    │
│  (1000 concurrent requests, single hot key, 50ms DB query)    │
│                                                                │
│  No protection:       1000 DB queries, ~50s total DB time     │
│  Mutex lock:          1 DB query, 999 wait ~150ms, total 0.2s │
│  XFetch (prob early): 1 DB query (pre-emptive), 0 wait, 0.05s│
│  SWR (stale-serve):   0 DB queries sync, 1 async, instant    │
│                                                                │
│  Winner: SWR for user-facing latency                          │
│  Winner: XFetch for consistency + performance balance         │
│  Winner: Mutex for simplicity                                 │
└────────────────────────────────────────────────────────────────┘
```

```typescript
// XFetch: probabilistic early expiry — prevents stampede without locks
// Paper: "Optimal Probabilistic Cache Stampede Prevention" (Vattani et al.)
async function xfetch<T>(
  key: string, fetcher: () => Promise<T>, ttl: number, beta: number = 1.0
): Promise<T> {
  const raw = await redis.get(key);
  if (raw) {
    const entry: { data: T; delta: number; expiry: number } = JSON.parse(raw);
    const now = Date.now() / 1000;

    // Probabilistic early recompute:
    // As expiry approaches, probability of recompute increases
    // delta = time to compute, beta = aggressiveness (1.0 = standard)
    const shouldRecompute = (now - entry.delta * beta * Math.log(Math.random())) >= entry.expiry;

    if (!shouldRecompute) return entry.data;
    // Fall through to recompute
  }

  const start = Date.now();
  const data = await fetcher();
  const delta = (Date.now() - start) / 1000; // Computation time in seconds

  const entry = {
    data,
    delta,
    expiry: Date.now() / 1000 + ttl,
  };
  await redis.setex(key, ttl + 60, JSON.stringify(entry)); // Extra 60s for early recompute window
  return data;
}
```

```go
// Go — mutex-based stampede prevention with singleflight
import "golang.org/x/sync/singleflight"

var group singleflight.Group

func GetWithStampedePrevention(ctx context.Context, rdb *redis.Client, key string,
    fetcher func() (interface{}, error), ttl time.Duration) (interface{}, error) {

    // Check cache
    raw, err := rdb.Get(ctx, key).Result()
    if err == nil {
        var result interface{}
        json.Unmarshal([]byte(raw), &result)
        return result, nil
    }

    // singleflight: only ONE goroutine fetches; others wait and share result
    result, err, shared := group.Do(key, func() (interface{}, error) {
        // Double-check cache (another goroutine may have populated)
        raw, err := rdb.Get(ctx, key).Result()
        if err == nil {
            var r interface{}
            json.Unmarshal([]byte(raw), &r)
            return r, nil
        }
        data, err := fetcher()
        if err != nil { return nil, err }
        encoded, _ := json.Marshal(data)
        rdb.SetEx(ctx, key, string(encoded), ttl)
        return data, nil
    })

    if shared {
        metrics.Increment("cache.stampede_prevented")
    }
    return result, err
}
```

## 6. Write-Through Invalidation — Performance Impact

```typescript
// Write-through invalidation: synchronous in write path
// Performance cost: adds cache operation latency to every write

async function writeThrough(key: string, data: unknown, ttl: number): Promise<void> {
  const start = performance.now();

  // Write to DB + invalidate cache atomically (as possible)
  await db.update(key, data);                    // ~20ms
  await redis.setex(`cache:${key}`, ttl, JSON.stringify(data)); // ~1ms

  const writeLatency = performance.now() - start;
  metrics.histogram("write_through.latency_ms", writeLatency);
  // Total: ~21ms vs ~20ms without cache → 5% write overhead
  // Benefit: next read is guaranteed cache hit (100% hit after write)
}

// Async invalidation: removes latency from write path
async function asyncInvalidation(key: string, data: unknown): Promise<void> {
  await db.update(key, data);                    // ~20ms — user waits only for this
  // Fire-and-forget cache invalidation
  redis.del(`cache:${key}`).catch((err) =>
    logger.warn("Async invalidation failed", { key, error: err.message })
  );
  // Total: ~20ms write latency (cache invalidated async)
  // Risk: brief window where cache has stale data (< 10ms typical)
}
```

## 7. Consistency Guarantees and Performance Cost

| Guarantee | Mechanism | Write Overhead | Read Consistency | Complexity |
|-----------|-----------|---------------|------------------|------------|
| **Eventual (TTL)** | TTL expiry only | 0ms | Stale for up to TTL | Lowest |
| **Eventual (active)** | Delete-on-write async | ~1ms | Stale for < 100ms | Low |
| **Near-strong** | Write-through sync | ~2ms | Stale for 0-1ms | Medium |
| **Strong** | Read-through + lock | ~5ms per read | Always fresh | High |
| **Linearizable** | Distributed lock on read+write | ~10ms per op | Always fresh | Very high |

---

## 8. Best Practices

1. **Add TTL jitter of +-15%** — prevents mass expiry thundering herd on any cache with > 100 keys.
2. **Use singleflight/mutex for hot keys** — stampede on popular key can 1000x DB load in 1 second.
3. **Implement XFetch for latency-sensitive paths** — probabilistic early expiry prevents stampede with zero waiting.
4. **Measure invalidation propagation delay** — end-to-end from write to all cache tiers updated.
5. **Use tag-based invalidation over SCAN** — O(M tagged keys) vs O(N total keys); 100-1000x faster.
6. **Version-based invalidation for immutable cache keys** — O(1) invalidation, no key discovery needed.
7. **Prefer async invalidation for non-critical cache** — removes 1-5ms from write path.
8. **Track consistency window** — CDC lag + invalidation time + L1 TTL = actual staleness.
9. **Set invalidation latency SLO** — alert if propagation delay exceeds acceptable staleness window.
10. **Double-check cache after acquiring stampede lock** — avoids redundant DB queries.

## 9. Anti-Patterns

1. **No TTL jitter** — synchronized expiry of 10K keys causes DB query storm.
2. **No stampede prevention on hot keys** — cache expiry causes DB connection exhaustion.
3. **SCAN-based invalidation in write path** — blocks write for 100-1000ms scanning Redis keyspace.
4. **Synchronous invalidation across multiple cache tiers** — write latency includes all tier invalidations.
5. **No measurement of consistency window** — actual staleness unknown; could be minutes.
6. **Invalidating on every field change** — partial updates trigger full cache rebuild; use field-level cache.
7. **No fallback when invalidation fails** — stale data served indefinitely; TTL is the safety net.
8. **Lock without timeout for stampede prevention** — lock holder crashes, all requests block forever.

## 10. Enforcement Checklist

- [ ] TTL jitter of +-10-20% applied on all caches with > 100 entries
- [ ] Stampede prevention implemented for keys with > 10 reads/second
- [ ] Invalidation propagation delay measured and alerted (SLO defined)
- [ ] Tag-based invalidation used instead of SCAN pattern matching
- [ ] Consistency window documented per data type (TTL + propagation)
- [ ] Async invalidation used for non-critical data (reduce write latency)
- [ ] Stampede lock has timeout (max 5-10 seconds)
- [ ] Double-check pattern after acquiring stampede lock
- [ ] CDC lag monitored if using CDC-based invalidation
- [ ] Version counter TTL set to prevent orphan accumulation
