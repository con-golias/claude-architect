# Caching Core Patterns

> **AI Plugin Directive — Caching Strategies & Access Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring caching code,
> follow EVERY rule in this document. Incorrect caching causes stale data, inconsistency,
> and performance degradation worse than no cache. Treat each section as non-negotiable.

**Core Rule: ALWAYS choose the caching strategy based on the read/write ratio and consistency requirements. NEVER cache without a defined invalidation strategy. EVERY cache entry MUST have a TTL — infinite caching is a data consistency bug waiting to happen.**

---

## 1. Caching Strategy Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                  Caching Strategies                                │
│                                                                    │
│  Read-Heavy Workloads:                                            │
│  ├── Cache-Aside (Lazy Loading)    ← MOST COMMON                 │
│  └── Read-Through                  ← Cache manages reads         │
│                                                                    │
│  Write-Heavy Workloads:                                           │
│  ├── Write-Through                 ← Consistent, slower writes   │
│  ├── Write-Back (Write-Behind)     ← Fast writes, eventual       │
│  └── Write-Around                  ← Skip cache on writes        │
│                                                                    │
│  Selection Guide:                                                  │
│  ┌──────────────────────────────────────────────────┐             │
│  │ Read-heavy + tolerance for stale? → Cache-Aside  │             │
│  │ Read-heavy + strict consistency?  → Read-Through  │             │
│  │ Write-heavy + must be consistent? → Write-Through │             │
│  │ Write-heavy + speed priority?     → Write-Back    │             │
│  │ Write-heavy + rarely read after?  → Write-Around  │             │
│  └──────────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

| Strategy | Read Perf | Write Perf | Consistency | Complexity | Best For |
|----------|-----------|------------|-------------|------------|----------|
| **Cache-Aside** | HIGH | N/A | Eventual | LOW | General purpose, read-heavy |
| **Read-Through** | HIGH | N/A | Strong | MEDIUM | ORM integration, transparent |
| **Write-Through** | HIGH | SLOW | Strong | MEDIUM | Financial data, audit trails |
| **Write-Back** | HIGH | FAST | Eventual | HIGH | Analytics, counters, logs |
| **Write-Around** | Moderate | FAST | Moderate | LOW | Write-heavy, rarely re-read |

---

## 2. Cache-Aside (Lazy Loading)

The application manages the cache directly. MOST COMMON pattern.

```
┌──────────────────────────────────────────────────────┐
│              Cache-Aside Flow                         │
│                                                       │
│  READ:                                                │
│  App ──► Cache hit? ──YES──► Return cached data      │
│              │                                        │
│              NO                                       │
│              │                                        │
│              ▼                                        │
│         Read from DB ──► Store in cache ──► Return   │
│                                                       │
│  WRITE:                                               │
│  App ──► Write to DB ──► Invalidate cache entry      │
│          (source of truth)  (NOT update cache)        │
└──────────────────────────────────────────────────────┘
```

**TypeScript**
```typescript
class CacheAside<T> {
  constructor(
    private cache: Redis,
    private prefix: string,
    private ttl: number // seconds
  ) {}

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cacheKey = `${this.prefix}:${key}`;

    // 1. Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Cache miss — fetch from source
    const data = await fetcher();

    // 3. Store in cache (non-blocking — don't wait)
    this.cache.setex(cacheKey, this.ttl, JSON.stringify(data)).catch((err) =>
      logger.warn("Cache write failed", { key: cacheKey, error: err.message })
    );

    return data;
  }

  async invalidate(key: string): Promise<void> {
    await this.cache.del(`${this.prefix}:${key}`);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Use SCAN, NEVER KEYS in production
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.cache.scan(
        cursor, "MATCH", `${this.prefix}:${pattern}`, "COUNT", 100
      );
      cursor = nextCursor;
      if (keys.length > 0) await this.cache.del(...keys);
    } while (cursor !== "0");
  }
}

// Usage
const userCache = new CacheAside<User>(redis, "user", 300); // 5 min TTL

async function getUser(userId: string): Promise<User> {
  return userCache.get(userId, () => db.users.findById(userId));
}

async function updateUser(userId: string, data: UpdateData): Promise<User> {
  const user = await db.users.update(userId, data);
  await userCache.invalidate(userId); // Invalidate, NOT update
  return user;
}
```

**Go**
```go
type CacheAside[T any] struct {
    rdb    *redis.Client
    prefix string
    ttl    time.Duration
}

func (c *CacheAside[T]) Get(ctx context.Context, key string, fetcher func() (T, error)) (T, error) {
    cacheKey := c.prefix + ":" + key

    // Check cache
    raw, err := c.rdb.Get(ctx, cacheKey).Result()
    if err == nil {
        var result T
        if err := json.Unmarshal([]byte(raw), &result); err == nil {
            return result, nil
        }
    }

    // Cache miss — fetch from source
    data, err := fetcher()
    if err != nil {
        return data, err
    }

    // Store in cache (async, non-blocking)
    encoded, _ := json.Marshal(data)
    go c.rdb.SetEx(context.Background(), cacheKey, string(encoded), c.ttl)

    return data, nil
}

func (c *CacheAside[T]) Invalidate(ctx context.Context, key string) error {
    return c.rdb.Del(ctx, c.prefix+":"+key).Err()
}
```

### 2.1 Cache-Aside Rules

- ALWAYS invalidate on write — NEVER update the cache directly (delete-on-write)
- ALWAYS set a TTL — prevents stale data if invalidation fails
- ALWAYS handle cache failures gracefully — fall back to database
- NEVER let cache failure break the application — cache is an optimization, not a dependency
- ALWAYS use `SCAN` for pattern-based invalidation — NEVER `KEYS` (blocks Redis)

---

## 3. Read-Through

The cache layer manages data loading transparently. Application reads from cache only.

```
┌──────────────────────────────────────────────────────┐
│              Read-Through Flow                        │
│                                                       │
│  App ──► Cache ──► hit? ──YES──► Return              │
│                     │                                 │
│                     NO                                │
│                     │                                 │
│                     ▼                                 │
│              Cache fetches from DB                    │
│              Cache stores result                      │
│              Cache returns to App                     │
│                                                       │
│  Difference from Cache-Aside:                         │
│  The CACHE manages the DB read, not the application. │
└──────────────────────────────────────────────────────┘
```

```typescript
class ReadThroughCache<T> {
  constructor(
    private cache: Redis,
    private loader: (key: string) => Promise<T>,
    private prefix: string,
    private ttl: number
  ) {}

  async get(key: string): Promise<T> {
    const cacheKey = `${this.prefix}:${key}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) return JSON.parse(cached);

    // Cache manages the load
    const data = await this.loader(key);
    await this.cache.setex(cacheKey, this.ttl, JSON.stringify(data));
    return data;
  }
}

// The application ONLY interacts with the cache
const productCache = new ReadThroughCache<Product>(
  redis,
  (id) => db.products.findById(id), // Loader function
  "product",
  600
);

const product = await productCache.get("prod-123");
```

---

## 4. Write-Through

Writes go to cache AND database synchronously. Guarantees consistency.

```
┌──────────────────────────────────────────────────────┐
│              Write-Through Flow                       │
│                                                       │
│  App ──► Cache ──► Write to cache                    │
│                     │                                 │
│                     ▼                                 │
│              Write to DB (synchronous)               │
│                     │                                 │
│                     ▼                                 │
│              Return success to App                    │
│                                                       │
│  ✅ Cache and DB always consistent                   │
│  ❌ Write latency = cache write + DB write           │
└──────────────────────────────────────────────────────┘
```

```typescript
class WriteThroughCache<T> {
  async write(key: string, data: T): Promise<void> {
    // Write to BOTH atomically (as possible)
    await Promise.all([
      this.cache.setex(`${this.prefix}:${key}`, this.ttl, JSON.stringify(data)),
      this.db.upsert(key, data),
    ]);
  }
}
```

Use Write-Through when: consistency is critical (financial data, inventory counts), and you can tolerate slower writes.

---

## 5. Write-Back (Write-Behind)

Writes go to cache immediately, then asynchronously flush to database.

```
┌──────────────────────────────────────────────────────┐
│              Write-Back Flow                          │
│                                                       │
│  App ──► Cache ──► Write to cache ──► Return (fast!) │
│                     │                                 │
│                     ▼ (async, batched)                │
│              Flush to DB periodically                 │
│              or on threshold                          │
│                                                       │
│  ✅ Fastest write performance                        │
│  ❌ Data loss risk if cache crashes before flush     │
│  ❌ Eventual consistency only                        │
└──────────────────────────────────────────────────────┘
```

```typescript
class WriteBackCache {
  private buffer: Map<string, any> = new Map();
  private flushInterval: NodeJS.Timeout;

  constructor(private db: Database, private flushMs: number = 5000) {
    this.flushInterval = setInterval(() => this.flush(), flushMs);
  }

  async write(key: string, data: any): Promise<void> {
    await this.cache.setex(key, this.ttl, JSON.stringify(data));
    this.buffer.set(key, data); // Buffer for async flush
  }

  private async flush(): Promise<void> {
    if (this.buffer.size === 0) return;

    const batch = new Map(this.buffer);
    this.buffer.clear();

    // Batch write to DB
    await this.db.batchUpsert(Array.from(batch.entries()));
  }
}
```

Use Write-Back when: write performance is critical (analytics counters, view counts, rate limiting), and you can tolerate potential data loss on crash.

---

## 6. Write-Around

Writes bypass the cache entirely, going directly to the database.

```
┌──────────────────────────────────────────────────────┐
│              Write-Around Flow                        │
│                                                       │
│  WRITE: App ──► DB only (skip cache)                 │
│                                                       │
│  READ:  App ──► Cache (miss) ──► DB ──► Cache        │
│                                                       │
│  ✅ No cache pollution from write-heavy data         │
│  ✅ Fast writes (no cache overhead)                  │
│  ❌ First read after write is always a cache miss    │
└──────────────────────────────────────────────────────┘
```

Use Write-Around when: data is written frequently but rarely read afterward (log entries, audit records, event streams).

---

## 7. Multi-Layer Caching

```
┌──────────────────────────────────────────────────────────────┐
│              Multi-Layer Cache Architecture                    │
│                                                               │
│  Request ──► L1 (In-Process) ──► L2 (Redis) ──► DB          │
│              │                    │                │           │
│              LRU Map             Distributed      Source      │
│              ~1ms                ~1-5ms            ~10-50ms   │
│              Per-process         Shared            Persistent │
│              100MB               16GB+             Unlimited  │
│                                                               │
│  L1 hit:  ~1ms   (80% of reads)                             │
│  L2 hit:  ~3ms   (15% of reads)                             │
│  DB hit:  ~30ms  (5% of reads)                              │
│                                                               │
│  Invalidation: Pub/Sub from L2 to all L1 instances           │
└──────────────────────────────────────────────────────────────┘
```

```typescript
class MultiLayerCache<T> {
  private l1: LRUCache<string, T>; // In-process
  private l2: Redis;                // Distributed

  constructor(l1MaxSize: number, l2: Redis, private ttl: number) {
    this.l1 = new LRUCache({ max: l1MaxSize, ttl: 60_000 }); // 1 min L1
    this.l2 = l2;
  }

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    // L1 check (in-process, microseconds)
    const l1Hit = this.l1.get(key);
    if (l1Hit !== undefined) return l1Hit;

    // L2 check (Redis, milliseconds)
    const l2Hit = await this.l2.get(`cache:${key}`);
    if (l2Hit) {
      const data = JSON.parse(l2Hit);
      this.l1.set(key, data); // Populate L1
      return data;
    }

    // DB fetch
    const data = await fetcher();
    this.l1.set(key, data);
    await this.l2.setex(`cache:${key}`, this.ttl, JSON.stringify(data));
    return data;
  }

  async invalidate(key: string): Promise<void> {
    this.l1.delete(key);
    await this.l2.del(`cache:${key}`);
    // Notify other instances to invalidate L1
    await this.l2.publish("cache:invalidate", key);
  }
}
```

- ALWAYS use L1 (in-process) with short TTL (30-60s) to avoid stale data
- ALWAYS use pub/sub to synchronize L1 invalidation across instances
- ALWAYS size L1 conservatively — it consumes application memory

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No TTL on cache entries | Stale data served forever | ALWAYS set TTL on every entry |
| Updating cache on write | Race conditions, stale data | Delete-on-write (invalidate, not update) |
| Cache as source of truth | Data loss on cache failure | Database is ALWAYS source of truth |
| Caching everything | Memory exhaustion, low hit rate | Cache only hot data (80/20 rule) |
| No fallback on cache failure | Application crashes if Redis down | Gracefully degrade to DB |
| Using KEYS command | Redis blocks on large datasets | Use SCAN for pattern matching |
| Same TTL for all data | Hot data evicted, cold data cached | TTL based on data volatility |
| No metrics | Cannot measure cache effectiveness | Track hit rate, miss rate, latency |

---

## 9. Enforcement Checklist

- [ ] Caching strategy explicitly chosen and documented per data type
- [ ] Every cache entry has a defined TTL
- [ ] Cache-aside uses delete-on-write (invalidate, NEVER update)
- [ ] Cache failures handled gracefully (fallback to database)
- [ ] Multi-layer cache uses pub/sub for L1 invalidation
- [ ] SCAN used instead of KEYS for pattern operations
- [ ] Cache hit/miss rate monitored (target: > 80% hit rate)
- [ ] Hot data identified and cached (80/20 rule applied)
- [ ] Write-back data loss risk documented and accepted
- [ ] Cache key naming convention established (`prefix:entity:id`)
