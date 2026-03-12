# Application-Level Caching Performance

> Domain: Performance Engineering > Application Caching
> Importance: CRITICAL
> Complements: 06-backend/caching/caching-strategies/core-patterns.md (implementation) — this doc covers performance measurement, sizing, warming, and architecture decisions

**Core Rule: ALWAYS use in-process caching for hot-path data before reaching for distributed caching. ALWAYS measure the latency difference between L1 (process) and L2 (distributed) tiers. NEVER let cache memory grow unbounded — set explicit limits and monitor utilization.**

---

## 1. In-Memory Process-Level Caching

```
┌────────────────────────────────────────────────────────────────┐
│  In-Process Cache Performance Profile                          │
│                                                                │
│  Access latency:  ~0.1-0.5 ms (vs 1-5ms for Redis)           │
│  Throughput:      millions ops/sec (no network, no serialization)
│  Memory:          shares heap with application                 │
│  Scope:           single process only — no sharing             │
│  Invalidation:    immediate within process, requires pub/sub   │
│                   across instances                             │
│                                                                │
│  Use when:                                                     │
│  ├── Data is read > 100x per second per instance              │
│  ├── Staleness of 30-60s is acceptable                        │
│  ├── Working set < 100MB per instance                         │
│  └── Data changes propagate via pub/sub within 1-2s           │
└────────────────────────────────────────────────────────────────┘
```

```typescript
import { LRUCache } from "lru-cache";

// Performance-tuned in-process cache
const processCache = new LRUCache<string, unknown>({
  max: 5000,                          // Max entries (prevents unbounded growth)
  maxSize: 50 * 1024 * 1024,         // 50MB max memory
  sizeCalculation: (value) => {
    // Estimate object size — critical for memory management
    const json = JSON.stringify(value);
    return json ? json.length * 2 : 100; // UTF-16 ~2 bytes per char
  },
  ttl: 60_000,                        // 60s — short for in-process (staleness risk)
  updateAgeOnGet: true,               // Refresh TTL on access (keeps hot data alive)
  allowStale: false,                  // Never serve expired entries
  disposeAfter: (value, key, reason) => {
    metrics.increment("process_cache.eviction", { reason });
  },
});

// Track performance
let hits = 0, misses = 0;
setInterval(() => {
  const total = hits + misses;
  if (total > 0) metrics.gauge("process_cache.hit_ratio", hits / total);
  hits = 0; misses = 0;
}, 10_000);

function getFromProcessCache<T>(key: string): T | undefined {
  const value = processCache.get(key) as T | undefined;
  value !== undefined ? hits++ : misses++;
  return value;
}
```

```go
import (
    lru "github.com/hashicorp/golang-lru/v2/expirable"
    "sync/atomic"
)

type ProcessCache[T any] struct {
    cache  *lru.LRU[string, T]
    hits   atomic.Int64
    misses atomic.Int64
}

func NewProcessCache[T any](size int, ttl time.Duration) *ProcessCache[T] {
    c := &ProcessCache[T]{}
    c.cache = lru.NewLRU[string, T](size, func(key string, value T) {
        // eviction callback
    }, ttl)
    return c
}

func (c *ProcessCache[T]) Get(key string) (T, bool) {
    val, ok := c.cache.Get(key)
    if ok {
        c.hits.Add(1)
    } else {
        c.misses.Add(1)
    }
    return val, ok
}

func (c *ProcessCache[T]) HitRatio() float64 {
    h, m := c.hits.Load(), c.misses.Load()
    if h+m == 0 { return 0 }
    return float64(h) / float64(h + m)
}
```

## 2. Distributed Caching Architecture Decisions

```
Decision: In-Process vs Distributed vs Both

┌────────────────────┬──────────────┬──────────────────┬─────────────────┐
│ Factor             │ In-Process   │ Distributed      │ Both (L1+L2)    │
├────────────────────┼──────────────┼──────────────────┼─────────────────┤
│ Latency            │ ~0.2ms       │ ~1-5ms           │ ~0.2ms (L1 hit) │
│ Consistency        │ Per-process  │ Cluster-wide     │ Eventual (L1)   │
│ Memory cost        │ N * size     │ 1 * size         │ (N * L1) + L2   │
│ Invalidation       │ Immediate    │ Immediate        │ L1 delayed      │
│ Sharing            │ None         │ All instances    │ L2 shared       │
│ Failure mode       │ Process dies │ Network/Redis    │ L1 survives     │
│ Serialization      │ None         │ Required         │ L2 only         │
│ Complexity         │ Low          │ Medium           │ High            │
└────────────────────┴──────────────┴──────────────────┴─────────────────┘

ALWAYS use L1+L2 for data accessed > 50 times/sec/instance.
Use L2-only for data accessed 1-50 times/sec/instance.
Use L1-only for process-specific data (parsed configs, compiled templates).
```

## 3. Request-Scoped Caching

```typescript
// Request-scoped cache: deduplicate within a single HTTP request
// Zero staleness risk — cache lives only for the request duration

class RequestContext {
  private cache = new Map<string, unknown>();

  async getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    const value = await fetcher();
    this.cache.set(key, value);
    return value;
  }
}

// Express middleware: attach per-request cache
app.use((req, res, next) => {
  req.context = new RequestContext();
  next();
});

// Usage: same user fetched 5 times in one request → 1 DB call
async function handler(req: Request) {
  const user = await req.context.getOrFetch(`user:${req.userId}`,
    () => db.users.findById(req.userId));
  const orders = await req.context.getOrFetch(`orders:${req.userId}`,
    () => db.orders.findByUser(req.userId));
  // Both deduped within this request
}
```

```python
# Python — request-scoped cache with contextvars
import contextvars
from typing import TypeVar, Callable, Awaitable

T = TypeVar("T")
_request_cache: contextvars.ContextVar[dict] = contextvars.ContextVar("request_cache")

async def get_or_fetch(key: str, fetcher: Callable[[], Awaitable[T]]) -> T:
    cache = _request_cache.get({})
    if key in cache:
        return cache[key]
    value = await fetcher()
    cache[key] = value
    _request_cache.set(cache)
    return value

# Middleware: initialize per-request
async def request_cache_middleware(request, call_next):
    _request_cache.set({})
    response = await call_next(request)
    return response
```

## 4. Memoization for Computational Caching

```typescript
// Memoize expensive computations — pure functions only
function memoize<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  opts: { maxSize?: number; ttlMs?: number; keyFn?: (...args: Args) => string } = {}
): (...args: Args) => R {
  const cache = new LRUCache<string, R>({
    max: opts.maxSize ?? 1000,
    ttl: opts.ttlMs ?? 300_000, // 5 min default
  });

  const keyFn = opts.keyFn ?? ((...args) => JSON.stringify(args));

  return (...args: Args): R => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// Usage: memoize expensive parsing
const parseConfig = memoize(
  (raw: string) => expensiveParse(raw),
  { maxSize: 100, ttlMs: 60_000 }
);

// ASYNC memoization — prevents thundering herd on concurrent calls
function memoizeAsync<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  opts: { maxSize?: number; ttlMs?: number; keyFn?: (...args: Args) => string } = {}
): (...args: Args) => Promise<R> {
  const cache = new LRUCache<string, Promise<R>>({ max: opts.maxSize ?? 1000, ttl: opts.ttlMs });
  const keyFn = opts.keyFn ?? ((...args) => JSON.stringify(args));

  return (...args: Args): Promise<R> => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    if (cached) return cached;
    // Store the PROMISE — concurrent callers share the same in-flight request
    const promise = fn(...args).catch((err) => {
      cache.delete(key); // Remove failed promises
      throw err;
    });
    cache.set(key, promise);
    return promise;
  };
}
```

## 5. Cache Warming Strategies

```typescript
// Warming: pre-populate cache to avoid cold-start miss storms
// CRITICAL after deployment, scaling event, or cache flush

async function warmApplicationCache(redis: Redis, db: Database): Promise<void> {
  const start = performance.now();

  // Strategy 1: warm from access logs (most effective)
  const hotKeys = await db.query(`
    SELECT cache_key, access_count FROM cache_access_log
    WHERE timestamp > NOW() - INTERVAL '1 hour'
    ORDER BY access_count DESC LIMIT 5000
  `);

  // Strategy 2: warm from known hot data
  const [topProducts, activeUsers, featureFlags] = await Promise.all([
    db.query("SELECT * FROM products ORDER BY view_count DESC LIMIT 1000"),
    db.query("SELECT * FROM users WHERE last_active > NOW() - INTERVAL '1 hour' LIMIT 2000"),
    db.query("SELECT * FROM feature_flags WHERE active = true"),
  ]);

  // Batch write with pipeline — 100x faster than individual SET calls
  const pipeline = redis.pipeline();
  for (const p of topProducts) {
    pipeline.setex(`product:${p.id}`, jitteredTTL(600), JSON.stringify(p));
  }
  for (const u of activeUsers) {
    pipeline.setex(`user:${u.id}`, jitteredTTL(300), JSON.stringify(u));
  }
  for (const f of featureFlags) {
    pipeline.setex(`flag:${f.key}`, 60, JSON.stringify(f));
  }
  await pipeline.exec();

  const elapsed = performance.now() - start;
  logger.info(`Cache warmed in ${elapsed.toFixed(0)}ms`, {
    products: topProducts.length,
    users: activeUsers.length,
    flags: featureFlags.length,
  });
}

function jitteredTTL(base: number): number {
  return Math.floor(base * (0.9 + Math.random() * 0.2)); // +-10% jitter
}
```

```go
func WarmCache(ctx context.Context, rdb *redis.Client, db *sql.DB) error {
    products, _ := db.QueryContext(ctx,
        "SELECT id, data FROM products ORDER BY views DESC LIMIT 1000")
    defer products.Close()

    pipe := rdb.Pipeline()
    count := 0
    for products.Next() {
        var id string; var data []byte
        products.Scan(&id, &data)
        ttl := time.Duration(540+rand.Intn(120)) * time.Second // 9-11 min
        pipe.SetEx(ctx, "product:"+id, string(data), ttl)
        count++
    }
    _, err := pipe.Exec(ctx)
    log.Printf("Warmed %d products", count)
    return err
}
```

## 6. Cache-Aside vs Read-Through vs Write-Through — Performance Comparison

```
Performance characteristics comparison:
┌──────────────────┬──────────────┬──────────────┬──────────────┐
│                  │ Cache-Aside  │ Read-Through │ Write-Through│
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ Read latency     │ Cache: 1ms   │ Cache: 1ms   │ Cache: 1ms   │
│ (cache hit)      │              │              │              │
│ Read latency     │ DB: 20ms     │ DB: 20ms     │ DB: 20ms     │
│ (cache miss)     │ + cache SET  │ (transparent)│ (always hit) │
│ Write latency    │ DB: 20ms     │ DB: 20ms     │ DB+cache:25ms│
│                  │ + cache DEL  │ + cache DEL  │ (synchronous)│
│ Consistency      │ Eventual     │ Eventual     │ Strong       │
│ Complexity       │ Low          │ Medium       │ Medium       │
│ Best for         │ General use  │ ORM layer    │ Financial    │
│ Hit ratio impact │ Proportional │ Same         │ 100% (warm)  │
│                  │ to read:write│              │              │
└──────────────────┴──────────────┴──────────────┴──────────────┘

Choose based on: read/write ratio, consistency requirement, write latency budget.
```

---

## 7. Best Practices

1. **Always bound in-process caches** — set both `max` entries and `maxSize` bytes to prevent heap exhaustion.
2. **Use request-scoped caching** — eliminates duplicate DB calls within a single request at zero staleness risk.
3. **Memoize async functions with promise caching** — store the Promise itself to coalesce concurrent calls.
4. **Warm caches on deploy** — pre-populate hot data to avoid post-deploy latency spike from cold cache.
5. **Use jittered TTLs during warming** — prevents mass expiry creating a thundering herd.
6. **Measure L1 vs L2 hit ratios separately** — L1 should be > 90% for data it caches; L2 > 80%.
7. **Size process cache conservatively** — it shares heap with the application; GC pressure increases with size.
8. **Profile serialization cost** — JSON.parse/stringify on large objects can dominate cache miss latency.
9. **Use typed caches with generics** — prevents runtime type errors from cache corruption.
10. **Implement cache bypass for debugging** — `?_nocache=1` or header-based bypass for troubleshooting.

## 8. Anti-Patterns

1. **Unbounded in-process cache** — no max entries or maxSize; grows until OOM crash.
2. **Memoizing impure functions** — functions with side effects or time-dependent results return stale data.
3. **No warming after deployment** — cold cache causes latency spike; all requests hit origin simultaneously.
4. **L1 cache with no cross-instance invalidation** — process A updates data, process B serves stale from L1.
5. **Long L1 TTL without pub/sub invalidation** — staleness window grows with TTL; use 30-60s max.
6. **Caching large objects in process memory** — 1MB object * 10K entries = 10GB heap; use Redis instead.
7. **Request-scoped cache across async boundaries** — context lost in fire-and-forget operations.
8. **No eviction callbacks** — cannot debug why hit ratio drops; always log or count evictions.

## 9. Enforcement Checklist

- [ ] In-process cache has `max` and `maxSize` configured
- [ ] In-process cache TTL <= 60s unless pub/sub invalidation is active
- [ ] Request-scoped caching used for repeated data access within a request
- [ ] Async memoization stores Promises (not resolved values) for coalescing
- [ ] Cache warming runs on application startup for top-N hot data
- [ ] Jittered TTLs used during warming (+-10%)
- [ ] L1 and L2 hit ratios measured and reported separately
- [ ] Process cache size monitored against heap budget (< 15% of total heap)
- [ ] Cache bypass mechanism available for debugging
- [ ] Eviction rate monitored — alert if > 5% of gets cause eviction
