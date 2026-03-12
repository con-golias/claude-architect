# Cache Invalidation

> **AI Plugin Directive — Cache Invalidation Strategies**
> You are an AI coding assistant. When generating, reviewing, or refactoring cache invalidation
> code, follow EVERY rule in this document. Cache invalidation is one of the two hard problems
> in computer science. Incorrect invalidation causes stale data, inconsistency, and data corruption.
> Treat each section as non-negotiable.

**Core Rule: ALWAYS invalidate cache entries on data mutation — NEVER update cache entries in place (delete-on-write). ALWAYS have a TTL as a safety net even with active invalidation. ALWAYS handle the cache stampede problem on invalidation.**

---

## 1. Invalidation Strategies

```
┌──────────────────────────────────────────────────────────────┐
│              Invalidation Strategy Selection                  │
│                                                               │
│  ┌────────────────┐                                          │
│  │ TTL-Based      │  Set expiry, data auto-expires          │
│  │ (Passive)      │  Simplest, eventual consistency          │
│  │                │  Use when: slight staleness is OK        │
│  └────────────────┘                                          │
│                                                               │
│  ┌────────────────┐                                          │
│  │ Event-Driven   │  Invalidate on write events              │
│  │ (Active)       │  Pub/sub, CDC, webhooks                  │
│  │                │  Use when: freshness is important         │
│  └────────────────┘                                          │
│                                                               │
│  ┌────────────────┐                                          │
│  │ Version-Based  │  Increment version on change             │
│  │ (Hybrid)       │  Cache key includes version              │
│  │                │  Use when: need instant invalidation      │
│  └────────────────┘                                          │
│                                                               │
│  ALWAYS combine: Event-Driven + TTL (safety net)             │
└──────────────────────────────────────────────────────────────┘
```

| Strategy | Freshness | Complexity | Best For |
|----------|-----------|------------|----------|
| **TTL-only** | Eventual (TTL window) | LOW | Read-heavy, staleness OK |
| **Event-driven** | Near-instant | MEDIUM | User-facing data, profiles |
| **Version-based** | Instant | MEDIUM | Config, feature flags |
| **Write-through delete** | Instant (single service) | LOW | Single-service apps |
| **CDC (Change Data Capture)** | Near-instant | HIGH | Microservices, cross-service |

---

## 2. Delete-on-Write Pattern

ALWAYS delete the cache entry when the source data changes. NEVER update the cache:

```typescript
// CORRECT — Delete on write ✅
async function updateUserProfile(userId: string, data: UpdateData): Promise<User> {
  // 1. Write to database (source of truth)
  const user = await db.users.update(userId, data);

  // 2. DELETE cache entry (not update)
  await redis.del(`user:${userId}`);
  await redis.del(`user:${userId}:profile`);

  // 3. Next read will populate cache from DB (cache-aside)
  return user;
}

// WRONG — Update cache directly ❌
async function updateUserProfile(userId: string, data: UpdateData): Promise<User> {
  const user = await db.users.update(userId, data);
  // Race condition: another request may read stale data between DB write and cache update
  // Or worse: DB write succeeds but cache update fails → inconsistent
  await redis.set(`user:${userId}`, JSON.stringify(user)); // ❌ DON'T DO THIS
  return user;
}
```

Why delete, not update:
- **Race condition prevention:** Two concurrent writes may update cache in wrong order
- **Simplicity:** Delete is idempotent — deleting twice is safe
- **Consistency:** Next read always fetches fresh data from DB

---

## 3. Event-Driven Invalidation

### 3.1 Pub/Sub Invalidation

```typescript
// Publisher (on data change)
async function onUserUpdated(userId: string): Promise<void> {
  // Delete local cache
  await redis.del(`user:${userId}`);

  // Notify all instances to invalidate their L1 cache
  await redis.publish("cache:invalidate", JSON.stringify({
    entity: "user",
    id: userId,
    timestamp: Date.now(),
  }));
}

// Subscriber (all application instances)
const subscriber = redis.duplicate();
await subscriber.subscribe("cache:invalidate");

subscriber.on("message", (channel, message) => {
  const { entity, id } = JSON.parse(message);
  const key = `${entity}:${id}`;

  // Invalidate in-process cache (L1)
  localCache.delete(key);

  logger.debug("Cache invalidated via pub/sub", { entity, id });
});
```

### 3.2 Database CDC (Change Data Capture)

```
┌──────────────────────────────────────────────────────────────┐
│           CDC-Based Cache Invalidation                        │
│                                                               │
│  ┌────────┐    ┌──────────┐    ┌───────────┐    ┌────────┐ │
│  │ Service│───►│ Database │───►│ CDC Stream│───►│ Cache  │ │
│  │ A      │    │ (Postgres│    │ (Debezium/│    │Invalidator│
│  └────────┘    │  WAL)    │    │  Kafka)   │    └────────┘ │
│  ┌────────┐    └──────────┘    └───────────┘               │
│  │ Service│───►     │                                       │
│  │ B      │         │                                       │
│  └────────┘         │                                       │
│                                                               │
│  Benefits:                                                    │
│  ├── Works across all services writing to same DB            │
│  ├── No code changes needed in writers                       │
│  ├── Captures direct DB modifications                        │
│  └── Reliable (WAL-based, no missed events)                  │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// Kafka consumer for CDC events
async function handleCDCEvent(event: CDCEvent): Promise<void> {
  const { table, operation, key } = event;

  const invalidationMap: Record<string, (key: any) => string[]> = {
    users: (k) => [`user:${k.id}`, `user:${k.id}:profile`, `user:${k.id}:permissions`],
    products: (k) => [`product:${k.id}`, `product:${k.id}:price`],
    orders: (k) => [`order:${k.id}`, `user:${k.user_id}:orders`],
  };

  const keysToInvalidate = invalidationMap[table]?.(key) ?? [];
  if (keysToInvalidate.length > 0) {
    await redis.del(...keysToInvalidate);
  }
}
```

---

## 4. Version-Based Invalidation

Embed a version in the cache key — increment on change:

```typescript
// Store version per entity type or per record
async function getCachedWithVersion<T>(
  entity: string,
  id: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Get current version
  const version = await redis.get(`version:${entity}:${id}`) ?? "0";
  const cacheKey = `${entity}:${id}:v${version}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const data = await fetcher();
  await redis.setex(cacheKey, ttl, JSON.stringify(data));
  return data;
}

// On write: increment version (old cache entries become orphaned, expire via TTL)
async function invalidateByVersion(entity: string, id: string): Promise<void> {
  await redis.incr(`version:${entity}:${id}`);
  // Old cache key (v1) is never accessed again → expires naturally via TTL
  // New reads create new key (v2) → always fresh data
}
```

Advantages: no need to find and delete old keys. Disadvantage: old versions consume memory until TTL expires.

---

## 5. Cache Stampede Prevention

A cache stampede (thundering herd) occurs when a popular cache entry expires and many concurrent requests hit the database simultaneously.

```
┌──────────────────────────────────────────────────────────────┐
│              Cache Stampede Problem                            │
│                                                               │
│  Cache entry for "product:hot-item" expires                  │
│                                                               │
│  Request 1 ──► Cache MISS ──► DB query ──┐                  │
│  Request 2 ──► Cache MISS ──► DB query ──┤                  │
│  Request 3 ──► Cache MISS ──► DB query ──┤  ALL hit DB      │
│  ...                                      │  simultaneously  │
│  Request N ──► Cache MISS ──► DB query ──┘                  │
│                                                               │
│  Solutions:                                                   │
│  1. Mutex/Lock — only one request rebuilds cache             │
│  2. Stale-While-Revalidate — serve stale, refresh async     │
│  3. Probabilistic early expiry — refresh before TTL          │
└──────────────────────────────────────────────────────────────┘
```

### 5.1 Mutex Lock (Recommended)

```typescript
async function getWithMutex<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  lockTTL: number = 5000
): Promise<T> {
  // 1. Check cache
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // 2. Try to acquire lock
  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, "1", "PX", lockTTL, "NX");

  if (acquired) {
    // 3. Winner: fetch from DB and populate cache
    try {
      const data = await fetcher();
      await redis.setex(key, ttl, JSON.stringify(data));
      return data;
    } finally {
      await redis.del(lockKey);
    }
  } else {
    // 4. Losers: wait and retry from cache
    await new Promise((r) => setTimeout(r, 100));
    const retryResult = await redis.get(key);
    if (retryResult) return JSON.parse(retryResult);

    // Fallback: fetch from DB (lock holder may have failed)
    return fetcher();
  }
}
```

### 5.2 Stale-While-Revalidate

```typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: number;    // Hard expiry
  staleAt: number;      // Soft expiry (serve stale, refresh async)
}

async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  freshTTL: number,    // Serve fresh for this long
  staleTTL: number     // Allow stale for this long after fresh expires
): Promise<T> {
  const raw = await redis.get(key);

  if (raw) {
    const entry: CacheEntry<T> = JSON.parse(raw);
    const now = Date.now();

    if (now < entry.staleAt) {
      // Still fresh — return immediately
      return entry.data;
    }

    if (now < entry.expiresAt) {
      // Stale but not expired — return stale, refresh in background
      refreshInBackground(key, fetcher, freshTTL, staleTTL);
      return entry.data; // Serve stale data
    }
  }

  // Cache miss or fully expired — synchronous fetch
  return fetchAndCache(key, fetcher, freshTTL, staleTTL);
}

async function refreshInBackground<T>(
  key: string,
  fetcher: () => Promise<T>,
  freshTTL: number,
  staleTTL: number
): Promise<void> {
  const lockKey = `refresh:${key}`;
  const acquired = await redis.set(lockKey, "1", "PX", 10_000, "NX");
  if (!acquired) return; // Another instance is refreshing

  try {
    await fetchAndCache(key, fetcher, freshTTL, staleTTL);
  } finally {
    await redis.del(lockKey);
  }
}
```

- ALWAYS use mutex lock OR stale-while-revalidate for hot keys
- ALWAYS set a short lock TTL (5-10s) to prevent deadlocks
- ALWAYS provide fallback if lock holder fails
- ALWAYS add TTL jitter to prevent synchronized mass expiry

---

## 6. Bulk Invalidation

```typescript
// Invalidate all cache entries for a user (after permission change, etc.)
async function invalidateUserCache(userId: string): Promise<void> {
  const keys = [
    `user:${userId}`,
    `user:${userId}:profile`,
    `user:${userId}:permissions`,
    `user:${userId}:orders`,
    `user:${userId}:settings`,
  ];

  // Delete all in one round-trip
  await redis.del(...keys);

  // Notify L1 caches
  await redis.publish("cache:invalidate:bulk", JSON.stringify({
    pattern: `user:${userId}:*`,
    keys,
  }));
}

// Tag-based invalidation (for related entities)
// Store tags: tag:category:electronics → [product:1, product:2, product:3]
async function invalidateByTag(tag: string): Promise<void> {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length > 0) {
    await redis.del(...keys);
    await redis.del(`tag:${tag}`);
  }
}
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Update cache on write | Race conditions, stale data | Delete-on-write (invalidate) |
| No TTL safety net | Active invalidation misses → stale forever | ALWAYS set TTL even with active invalidation |
| No stampede protection | DB overwhelmed on popular key expiry | Mutex lock or stale-while-revalidate |
| Invalidating by pattern (KEYS) | Redis blocks under load | Use explicit key lists or tag-based |
| No L1 invalidation on pub/sub | In-process cache serves stale data | Subscribe to invalidation channel |
| Forgetting related cache keys | User profile updated but permissions cached stale | Maintain key dependency map |
| Invalidating too aggressively | Low hit rate, cache is useless | Only invalidate affected entries |
| No invalidation on delete | Deleted resources still served from cache | Invalidate on DELETE operations too |
| Synchronous invalidation in write path | Write latency includes all cache ops | Async invalidation for non-critical keys |

---

## 8. Enforcement Checklist

- [ ] Delete-on-write used for ALL cache invalidation (NEVER update-in-place)
- [ ] TTL set as safety net even when using active invalidation
- [ ] Cache stampede prevention implemented (mutex or SWR)
- [ ] Pub/sub used for L1 (in-process) cache invalidation across instances
- [ ] Related cache keys identified and invalidated together
- [ ] SCAN used instead of KEYS for pattern-based operations
- [ ] Invalidation events logged for debugging
- [ ] CDC or event-driven invalidation for cross-service caching
- [ ] Bulk invalidation uses pipeline/multi-key DEL
- [ ] Lock TTL prevents deadlocks in mutex-based stampede prevention
