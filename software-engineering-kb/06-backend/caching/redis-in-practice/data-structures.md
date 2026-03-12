# Redis Data Structures

> **AI Plugin Directive — Redis Data Structures & Use Cases**
> You are an AI coding assistant. When generating, reviewing, or refactoring Redis data structure
> usage, follow EVERY rule in this document. Choosing the wrong Redis data structure causes
> memory waste, poor performance, and incorrect behavior. Treat each section as non-negotiable.

**Core Rule: ALWAYS choose the Redis data structure that matches the access pattern — NEVER store everything as serialized JSON strings. ALWAYS use the most specific structure (Hash for objects, Sorted Set for rankings, Stream for event logs). ALWAYS set memory limits and TTL on every key.**

---

## 1. Data Structure Selection

```
┌──────────────────────────────────────────────────────────────┐
│              Redis Data Structure Decision Tree                │
│                                                               │
│  What are you storing?                                       │
│  ├── Simple value (token, flag, counter)  → STRING           │
│  ├── Object with fields (user profile)    → HASH             │
│  ├── Ordered collection (queue, stack)    → LIST             │
│  ├── Unique items (tags, permissions)     → SET              │
│  ├── Ranked items (leaderboard, feed)     → SORTED SET       │
│  ├── Event log / message stream           → STREAM           │
│  ├── Approximate count (unique visitors)  → HYPERLOGLOG      │
│  ├── Membership test (spam filter)        → BLOOM FILTER     │
│  └── Geospatial queries (nearby stores)   → GEO              │
│                                                               │
│  Rule: Use the MOST SPECIFIC structure.                      │
│  JSON string in STRING = anti-pattern for structured data.   │
└──────────────────────────────────────────────────────────────┘
```

| Structure | Time Complexity | Memory | Best For |
|-----------|----------------|--------|----------|
| **STRING** | O(1) get/set | 56 bytes overhead + value | Tokens, counters, flags, simple cache |
| **HASH** | O(1) per field | Compact for < 128 fields | Objects, profiles, configs |
| **LIST** | O(1) push/pop, O(N) index | 64 bytes + entries | Queues, recent items, activity feeds |
| **SET** | O(1) add/remove/check | 64 bytes + members | Tags, permissions, unique tracking |
| **SORTED SET** | O(log N) add/rank | 80 bytes + members | Leaderboards, rate limiters, scheduling |
| **STREAM** | O(1) append, O(N) read | Radix tree, compact | Event sourcing, message queues, audit logs |
| **HYPERLOGLOG** | O(1) | Fixed 12 KB | Cardinality estimation (unique counts) |

---

## 2. Strings

The simplest type. Use for single values, counters, and serialized cache entries.

```typescript
// Counter (atomic increment)
await redis.incr("stats:page_views");
await redis.incrby("stats:api_calls", 5);

// Distributed lock (SET NX PX)
const acquired = await redis.set("lock:order:123", instanceId, "PX", 5000, "NX");
if (acquired) {
  try { /* critical section */ }
  finally { await redis.del("lock:order:123"); }
}

// Cache with TTL
await redis.setex("session:abc123", 1800, JSON.stringify(sessionData));

// Bit operations (feature flags per user)
await redis.setbit("feature:dark_mode", userId, 1);  // Enable
const enabled = await redis.getbit("feature:dark_mode", userId);
```

```go
// Atomic counter
rdb.Incr(ctx, "stats:page_views")
rdb.IncrBy(ctx, "stats:api_calls", 5)

// Distributed lock
ok, _ := rdb.SetNX(ctx, "lock:order:123", instanceID, 5*time.Second).Result()
if ok {
    defer rdb.Del(ctx, "lock:order:123")
    // critical section
}

// Cache with TTL
rdb.SetEx(ctx, "session:abc123", 30*time.Minute, serializedData)
```

```python
# Atomic counter
await redis.incr("stats:page_views")
await redis.incrby("stats:api_calls", 5)

# Distributed lock
acquired = await redis.set("lock:order:123", instance_id, px=5000, nx=True)
if acquired:
    try:
        pass  # critical section
    finally:
        await redis.delete("lock:order:123")
```

- ALWAYS use `INCR`/`INCRBY` for counters — NEVER `GET` + `SET` (race condition)
- ALWAYS use `SET key value PX ttl NX` for locks — NEVER separate `SETNX` + `EXPIRE`
- ALWAYS set TTL on cache strings — unbounded strings exhaust memory

---

## 3. Hashes

Use for objects with multiple fields. More memory-efficient than separate STRING keys.

```typescript
// Store user profile as Hash
await redis.hset("user:123", {
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
  lastLogin: Date.now().toString(),
});

// Read single field (no need to deserialize entire object)
const role = await redis.hget("user:123", "role");

// Read multiple fields
const [name, email] = await redis.hmget("user:123", "name", "email");

// Read all fields
const profile = await redis.hgetall("user:123");

// Atomic field increment (e.g., shopping cart quantity)
await redis.hincrby("cart:456", "item:sku-789", 2);

// Set TTL on the hash (TTL is per-key, not per-field)
await redis.expire("user:123", 900); // 15 min
```

```go
rdb.HSet(ctx, "user:123", map[string]interface{}{
    "name":      "Alice",
    "email":     "alice@example.com",
    "role":      "admin",
    "lastLogin": time.Now().Unix(),
})

role, _ := rdb.HGet(ctx, "user:123", "role").Result()
profile, _ := rdb.HGetAll(ctx, "user:123").Result()
rdb.HIncrBy(ctx, "cart:456", "item:sku-789", 2)
rdb.Expire(ctx, "user:123", 15*time.Minute)
```

```python
await redis.hset("user:123", mapping={
    "name": "Alice",
    "email": "alice@example.com",
    "role": "admin",
    "lastLogin": str(int(time.time())),
})

role = await redis.hget("user:123", "role")
profile = await redis.hgetall("user:123")
await redis.hincrby("cart:456", "item:sku-789", 2)
await redis.expire("user:123", 900)
```

- ALWAYS use HASH for objects instead of serialized JSON STRING — allows partial reads/writes
- ALWAYS use `HINCRBY` for field-level counters — atomic, no read-modify-write
- NEVER store more than 128 fields per hash in performance-critical paths (ziplist threshold)
- ALWAYS set TTL on the hash key — Redis TTL is per-key, NOT per-field

---

## 4. Lists

Ordered collection. Use as queues (FIFO), stacks (LIFO), or bounded recent-item lists.

```typescript
// Job queue (FIFO: push right, pop left)
await redis.rpush("queue:emails", JSON.stringify(job));
const job = await redis.blpop("queue:emails", 30); // Block 30s

// Recent activity feed (bounded)
await redis.lpush("feed:user:123", JSON.stringify(activity));
await redis.ltrim("feed:user:123", 0, 99); // Keep last 100
const recent = await redis.lrange("feed:user:123", 0, 9); // Latest 10

// Stack (LIFO: push left, pop left)
await redis.lpush("undo:doc:456", JSON.stringify(action));
const lastAction = await redis.lpop("undo:doc:456");
```

```go
// Job queue
rdb.RPush(ctx, "queue:emails", serializedJob)
result, _ := rdb.BLPop(ctx, 30*time.Second, "queue:emails").Result()

// Bounded feed
rdb.LPush(ctx, "feed:user:123", serializedActivity)
rdb.LTrim(ctx, "feed:user:123", 0, 99)
items, _ := rdb.LRange(ctx, "feed:user:123", 0, 9).Result()
```

- ALWAYS use `LTRIM` after `LPUSH` to bound list size — unbounded lists exhaust memory
- ALWAYS use `BLPOP`/`BRPOP` for queue consumers — avoids polling
- NEVER use `LINDEX` or `LINSERT` on large lists — O(N) operations
- ALWAYS prefer Redis Streams over Lists for production message queues

---

## 5. Sets

Unordered unique collection. Use for tags, permissions, and set operations.

```typescript
// User permissions
await redis.sadd("perms:user:123", "read", "write", "admin");
const hasAdmin = await redis.sismember("perms:user:123", "admin"); // O(1)
const allPerms = await redis.smembers("perms:user:123");

// Tag system
await redis.sadd("tags:article:456", "javascript", "backend", "cache");

// Set operations — find common interests
const commonTags = await redis.sinter("tags:user:1", "tags:user:2");
const allTags = await redis.sunion("tags:user:1", "tags:user:2");
const uniqueToUser1 = await redis.sdiff("tags:user:1", "tags:user:2");

// Online users tracking
await redis.sadd("online:users", userId);
await redis.srem("online:users", userId);
const onlineCount = await redis.scard("online:users");
```

```go
rdb.SAdd(ctx, "perms:user:123", "read", "write", "admin")
hasAdmin, _ := rdb.SIsMember(ctx, "perms:user:123", "admin").Result()
common, _ := rdb.SInter(ctx, "tags:user:1", "tags:user:2").Result()
count, _ := rdb.SCard(ctx, "online:users").Result()
```

- ALWAYS use `SISMEMBER` for membership checks — O(1), not O(N)
- ALWAYS use `SINTER`/`SUNION`/`SDIFF` for set algebra — computed server-side
- NEVER use `SMEMBERS` on large sets in production — returns ALL members, blocks Redis
- ALWAYS use `SSCAN` for iterating large sets

---

## 6. Sorted Sets

Ordered by score. Use for rankings, rate limiting, time-series, and scheduling.

```typescript
// Leaderboard
await redis.zadd("leaderboard:game1", { score: 1500, member: "player:alice" });
await redis.zadd("leaderboard:game1", { score: 2300, member: "player:bob" });

// Top 10 players (highest scores)
const top10 = await redis.zrevrange("leaderboard:game1", 0, 9, "WITHSCORES");

// Player rank (0-based, highest first)
const rank = await redis.zrevrank("leaderboard:game1", "player:alice");

// Sliding window rate limiter
async function isRateLimited(userId: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `rate:${userId}`;
  const now = Date.now();
  const windowStart = now - windowSec * 1000;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart); // Remove old entries
  pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` });
  pipeline.zcard(key);                            // Count in window
  pipeline.expire(key, windowSec);

  const results = await pipeline.exec();
  const count = results[2][1] as number;
  return count > limit;
}

// Delayed job scheduling
await redis.zadd("delayed:jobs", { score: Date.now() + 60000, member: jobId });
// Worker polls for ready jobs
const readyJobs = await redis.zrangebyscore("delayed:jobs", 0, Date.now(), "LIMIT", 0, 10);
```

```go
rdb.ZAdd(ctx, "leaderboard:game1", redis.Z{Score: 1500, Member: "player:alice"})
top10, _ := rdb.ZRevRangeWithScores(ctx, "leaderboard:game1", 0, 9).Result()
rank, _ := rdb.ZRevRank(ctx, "leaderboard:game1", "player:alice").Result()
```

- ALWAYS use Sorted Sets for rate limiters — sliding window with `ZREMRANGEBYSCORE`
- ALWAYS use `ZREVRANGE` for "top N" queries — O(log N + M) where M = result size
- ALWAYS use Sorted Sets for delayed job scheduling — score = execution timestamp
- NEVER store more than 100K members without pagination — use `ZSCAN` or `ZRANGEBYSCORE` with LIMIT

---

## 7. Streams

Append-only log with consumer groups. Use for event sourcing, message queues, and audit trails.

```typescript
// Produce event
await redis.xadd("events:orders", "*", {
  type: "order_created",
  orderId: "order-789",
  userId: "user-123",
  total: "99.99",
});

// Create consumer group
await redis.xgroup("CREATE", "events:orders", "order-processors", "0", "MKSTREAM");

// Consume with consumer group (at-least-once delivery)
const messages = await redis.xreadgroup(
  "GROUP", "order-processors", "worker-1",
  "COUNT", 10, "BLOCK", 5000,
  "STREAMS", "events:orders", ">"
);

// Acknowledge processed messages
for (const [stream, entries] of messages) {
  for (const [id, fields] of entries) {
    await processOrder(fields);
    await redis.xack("events:orders", "order-processors", id);
  }
}

// Trim stream to bounded size
await redis.xtrim("events:orders", "MAXLEN", "~", 100000);
```

```go
rdb.XAdd(ctx, &redis.XAddArgs{
    Stream: "events:orders",
    Values: map[string]interface{}{
        "type": "order_created", "orderId": "order-789",
    },
})

rdb.XGroupCreate(ctx, "events:orders", "order-processors", "0")

messages, _ := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
    Group:    "order-processors",
    Consumer: "worker-1",
    Streams:  []string{"events:orders", ">"},
    Count:    10,
    Block:    5 * time.Second,
}).Result()
```

```python
await redis.xadd("events:orders", {"type": "order_created", "orderId": "order-789"})
await redis.xgroup_create("events:orders", "order-processors", "0", mkstream=True)

messages = await redis.xreadgroup(
    "order-processors", "worker-1",
    streams={"events:orders": ">"},
    count=10, block=5000,
)
```

- ALWAYS use consumer groups for multi-consumer message processing
- ALWAYS acknowledge messages with `XACK` after processing — prevents redelivery
- ALWAYS trim streams with `XTRIM MAXLEN ~N` — the `~` allows efficient approximate trimming
- ALWAYS handle pending messages (failed consumers) with `XPENDING` + `XCLAIM`
- NEVER use Streams as a database — they are append-only logs, not queryable storage

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| JSON STRING for objects | Cannot read/update single fields | Use HASH for structured data |
| LIST as message queue | No consumer groups, lost messages | Use STREAM with consumer groups |
| Unbounded LIST/SET | Memory grows without limit | LTRIM after push, TTL, or MAXLEN |
| SMEMBERS on large sets | Redis blocks, slow response | Use SSCAN for iteration |
| KEYS command in production | Blocks Redis for seconds | Use SCAN for pattern matching |
| No TTL on temporary data | Keys accumulate, memory exhausted | ALWAYS set TTL |
| GET + SET for counters | Race condition under concurrency | Use INCR/INCRBY (atomic) |
| Sorted Set without cleanup | Old entries accumulate | ZREMRANGEBYSCORE periodically |
| Large values (> 1 MB) | Network saturation, slow ops | Compress or split into chunks |
| Wrong structure for access pattern | Poor performance, wasted memory | Match structure to access pattern |

---

## 9. Enforcement Checklist

- [ ] Data structure chosen based on access pattern, NOT defaulting to STRING
- [ ] HASH used for objects (NOT serialized JSON in STRING)
- [ ] STREAM used for message queues (NOT LIST)
- [ ] Sorted Set used for rankings and rate limiting
- [ ] TTL set on EVERY temporary key
- [ ] Lists bounded with LTRIM after every push
- [ ] Streams bounded with XTRIM MAXLEN
- [ ] SCAN used instead of KEYS for pattern operations
- [ ] INCR/HINCRBY used for atomic counters
- [ ] Consumer groups used for Stream consumers with XACK
- [ ] Large sets iterated with SSCAN, not SMEMBERS
- [ ] No values larger than 1 MB stored in Redis
