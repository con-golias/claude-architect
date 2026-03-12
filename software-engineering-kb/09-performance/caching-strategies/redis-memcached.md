# Redis and Memcached Performance Engineering

> Domain: Performance Engineering > Distributed Cache Systems
> Importance: CRITICAL
> Complements: 06-backend/caching/redis-in-practice/ (data structures, operations) — this doc covers performance tuning, sizing, eviction optimization, and Redis vs Memcached decisions

**Core Rule: ALWAYS select Redis data structure by access pattern — wrong structure causes 10-100x performance degradation. ALWAYS configure maxmemory and eviction policy before production. ALWAYS benchmark with production-like data to validate performance assumptions.**

---

## 1. Redis Data Structures for Performance-Optimized Caching

```
┌────────────────────────────────────────────────────────────────┐
│  Structure Selection by Performance Requirement                │
│                                                                │
│  Need single value + fast TTL?        → STRING with SETEX     │
│  Need partial field access?           → HASH (save bandwidth) │
│  Need sorted retrieval + scoring?     → SORTED SET            │
│  Need approximate unique counting?    → HYPERLOGLOG (12KB!)   │
│  Need membership test (bloom)?        → RedisBloom module     │
│                                                                │
│  Performance comparison (100K entries):                        │
│  STRING (JSON blob):  GET 0.1ms, full deserialize required    │
│  HASH (fields):       HGET 0.1ms, single field only          │
│  SORTED SET:          ZRANGEBYSCORE 0.2ms, range queries      │
│  HYPERLOGLOG:         PFADD 0.1ms, PFCOUNT 0.2ms, 0.81% err │
└────────────────────────────────────────────────────────────────┘
```

```typescript
// Performance comparison: STRING vs HASH for user profiles
// STRING approach: must serialize/deserialize entire object
const userJson = await redis.get(`user:${id}`);           // ~2KB transfer
const user = JSON.parse(userJson);                         // CPU: parse all
const name = user.name;                                    // Need only 1 field

// HASH approach: fetch only needed fields
const name = await redis.hget(`user:${id}`, "name");      // ~20 bytes transfer
// 100x less bandwidth, no parse overhead

// When to use STRING: small values (< 200 bytes), entire object always needed
// When to use HASH: objects with > 3 fields, partial access pattern common

// SORTED SET for caching with ranking
await redis.zadd("cache:popular_products", Date.now(), `product:${id}`);
// Retrieve most recently cached products
const recent = await redis.zrevrangebyscore("cache:popular_products",
  "+inf", Date.now() - 3600_000, "LIMIT", 0, 100);

// HYPERLOGLOG for unique visitor counting (12KB per counter)
await redis.pfadd(`unique:page:${pageId}:${today}`, visitorId);
const uniqueCount = await redis.pfcount(`unique:page:${pageId}:${today}`);
// Accuracy: 0.81% standard error. For 1M visitors, error ±8,100
// Memory: 12KB total vs 1M entries in SET (~50MB). 4000x savings.
```

```go
// Go — HASH for partial field access (bandwidth optimization)
func GetUserName(ctx context.Context, rdb *redis.Client, id string) (string, error) {
    return rdb.HGet(ctx, "user:"+id, "name").Result() // Single field
}

// HyperLogLog for unique counting
func TrackUniqueVisitor(ctx context.Context, rdb *redis.Client, page, visitor string) {
    rdb.PFAdd(ctx, "unique:"+page+":"+time.Now().Format("2006-01-02"), visitor)
}
```

## 2. Redis Cluster Performance Tuning

```
┌────────────────────────────────────────────────────────────────┐
│  Redis Cluster Performance Considerations                      │
│                                                                │
│  Throughput per shard: ~100K ops/sec (single-threaded)         │
│  Need 500K ops/sec? → 5+ master shards                       │
│                                                                │
│  Cross-slot penalty: MOVED redirect adds 1 extra RTT          │
│  Hash tags: {entity:id} collocates related keys on same shard │
│  Pipeline in cluster: commands MUST target same slot           │
│                                                                │
│  Read scaling: route reads to replicas (scaleReads: "slave")  │
│  Write scaling: add more master shards (horizontal)           │
│                                                                │
│  CRITICAL: io-threads (Redis 6+) for multi-threaded I/O       │
│  io-threads 4          # 2-4x throughput for large payloads   │
│  io-threads-do-reads yes                                      │
└────────────────────────────────────────────────────────────────┘
```

```typescript
// ioredis cluster — performance-optimized configuration
const cluster = new Redis.Cluster(nodes, {
  scaleReads: "slave",              // Read from replicas: 2-3x read throughput
  enableAutoPipelining: true,       // Auto-batch commands in same event loop tick
  maxRedirections: 16,
  retryDelayOnFailover: 300,
  slotsRefreshTimeout: 2000,
  redisOptions: {
    connectTimeout: 5000,
    commandTimeout: 3000,
    enableAutoPipelining: true,
  },
});

// Pipeline within same hash slot for max throughput
async function getUserProfile(userId: string) {
  const pipeline = cluster.pipeline();
  // All keys use same hash tag {user:ID} → same slot → pipeline works
  pipeline.hgetall(`{user:${userId}}:profile`);
  pipeline.smembers(`{user:${userId}}:roles`);
  pipeline.get(`{user:${userId}}:settings`);
  const [profile, roles, settings] = await pipeline.exec();
  return { profile: profile[1], roles: roles[1], settings: settings[1] };
}
```

## 3. Redis Sentinel for HA

```
Sentinel: automatic failover for master-replica setups
Performance impact: failover completes in 5-30 seconds
During failover: writes fail, reads may serve stale from replica

┌──────────────────────────────────────────────────────┐
│  Sentinel 1 ←──────────→ Sentinel 2 ←──→ Sentinel 3 │
│      │                       │                │       │
│      ▼                       ▼                ▼       │
│  ┌────────┐           ┌────────┐        ┌────────┐   │
│  │ Master │──────────►│Replica1│        │Replica2│   │
│  │        │           │        │        │        │   │
│  └────────┘           └────────┘        └────────┘   │
│                                                       │
│  On master failure: Sentinel promotes a replica       │
│  Application reconnects automatically via Sentinel    │
└──────────────────────────────────────────────────────┘
```

```go
// Go — connect via Sentinel for automatic failover
rdb := redis.NewFailoverClient(&redis.FailoverOptions{
    MasterName:    "mymaster",
    SentinelAddrs: []string{"sentinel-1:26379", "sentinel-2:26379", "sentinel-3:26379"},
    Password:      os.Getenv("REDIS_PASSWORD"),
    PoolSize:      20,
    MinIdleConns:  5,
    ReadTimeout:   3 * time.Second,
    WriteTimeout:  3 * time.Second,
    // Route reads to replicas for read scaling
    SlaveOnly: false, // false = writes to master, reads to master
})
```

## 4. Redis vs Memcached Decision Matrix

| Criterion | Redis | Memcached | Winner |
|-----------|-------|-----------|--------|
| **Simple KV caching** | Full-featured | Purpose-built, slightly faster | Memcached |
| **Data structures** | Hash, Set, ZSet, Stream, etc. | Strings only | Redis |
| **Persistence** | RDB + AOF | None (pure cache) | Redis |
| **Clustering** | Redis Cluster (automatic) | Client-side sharding | Redis |
| **Memory efficiency** | Good (overhead per key) | Better (slab allocator) | Memcached |
| **Multi-threaded** | I/O threads (Redis 6+) | Fully multi-threaded | Memcached |
| **Max value size** | 512 MB | 1 MB (default) | Redis |
| **Pub/sub** | Built-in | Not available | Redis |
| **Lua scripting** | Built-in | Not available | Redis |
| **Operational complexity** | Higher | Lower | Memcached |

```
Decision guide:
├── Need ONLY simple KV caching?                → Memcached (simpler, multi-threaded)
├── Need data structures, pub/sub, persistence?  → Redis (always)
├── Need > 100K ops/sec single-node?            → Memcached (multi-threaded)
├── Need atomic operations across keys?          → Redis (Lua, transactions)
└── Default choice for new projects?             → Redis (more versatile)
```

```python
# Python — Memcached for simple high-throughput KV cache
from pymemcache.client.hash import HashClient

mc = HashClient(
    [("mc-1", 11211), ("mc-2", 11211), ("mc-3", 11211)],
    connect_timeout=2.0,
    timeout=1.0,
    use_pooling=True,
    max_pool_size=20,
    serializer=lambda key, value: (json.dumps(value).encode(), 1),
    deserializer=lambda key, value, flags: json.loads(value.decode()),
)

# Simple get/set — Memcached's sweet spot
mc.set("session:abc123", {"user_id": "u1", "role": "admin"}, expire=1800)
session = mc.get("session:abc123")

# Multi-get: single round-trip for multiple keys
results = mc.get_many(["user:1", "user:2", "user:3"])
```

## 5. Memory Eviction Policy Performance Impact

```
┌────────────────────────────────────────────────────────────────┐
│  Eviction Policy Performance Characteristics                   │
│                                                                │
│  allkeys-lru:    Best general-purpose. Evicts least recently  │
│                  accessed key. O(1) approximate. DEFAULT.      │
│                                                                │
│  allkeys-lfu:    Evicts least FREQUENTLY used. Better for     │
│                  workloads with clear popularity distribution. │
│                  Redis tracks access frequency per key.        │
│                  10-15% higher hit ratio than LRU for skewed. │
│                                                                │
│  volatile-ttl:   Evicts key with shortest remaining TTL.      │
│                  Good when TTL correlates with importance.     │
│                                                                │
│  noeviction:     Returns error on write when full.            │
│                  Use for session stores, queues (data matters).│
│                                                                │
│  LRU vs LFU benchmark (Zipfian distribution, 80/20 workload):│
│  LRU hit ratio: ~82%                                          │
│  LFU hit ratio: ~91%   ← 11% improvement for skewed access  │
│  For uniform access: LRU ≈ LFU (no benefit to LFU)          │
└────────────────────────────────────────────────────────────────┘
```

```
# redis.conf — LFU tuning for high-performance caching
maxmemory 8gb
maxmemory-policy allkeys-lfu

# LFU parameters
lfu-log-factor 10      # Higher = slower frequency counter growth
                       # 10 = counter reaches max at ~1M accesses
lfu-decay-time 1       # Minutes between frequency counter decay
                       # 1 = counter halves every minute of inactivity
                       # Prevents old popular keys from never being evicted

# LRU accuracy (also applies to LFU)
maxmemory-samples 10   # Check 10 keys per eviction (default 5)
                       # Higher = more accurate, slightly more CPU
                       # 10 is recommended for production
```

```typescript
// Monitor eviction behavior to tune policy
async function getEvictionMetrics(redis: Redis) {
  const info = await redis.info("stats");
  const memInfo = await redis.info("memory");

  return {
    evictedKeys: parseInt(parseField(info, "evicted_keys")),
    hitRate: calculateHitRate(info),
    usedMemory: parseField(memInfo, "used_memory_human"),
    maxMemory: parseField(memInfo, "maxmemory_human"),
    memoryUsagePercent: (
      parseInt(parseField(memInfo, "used_memory")) /
      parseInt(parseField(memInfo, "maxmemory")) * 100
    ).toFixed(1),
    // If eviction rate is high AND hit ratio is low → cache is undersized
    // If eviction rate is high AND hit ratio is high → cache is right-sized, eviction is healthy
  };
}
```

## 6. Persistence Performance Trade-offs

```
┌────────────────────────────────────────────────────────────────┐
│  Persistence vs Performance                                    │
│                                                                │
│  No persistence:     Best throughput. Use for PURE CACHE.     │
│  RDB snapshots:      Fork + write. Brief latency spike during │
│                      BGSAVE. Minimal steady-state impact.     │
│  AOF everysec:       1 fsync/sec. ~5% write throughput cost.  │
│  AOF always:         fsync every write. 50-80% throughput hit.│
│                      NEVER use for caching.                   │
│                                                                │
│  For pure caching (can rebuild from source):                  │
│    appendonly no                                              │
│    save ""             # Disable RDB snapshots                │
│    → Maximum throughput                                       │
│                                                                │
│  For cache + session store (need durability):                 │
│    appendonly yes                                             │
│    appendfsync everysec                                       │
│    save 900 1                                                 │
│    → Acceptable throughput with data safety                   │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Best Practices

1. **Use HASH for objects with partial access patterns** — HGET one field uses 100x less bandwidth than GET+parse entire JSON.
2. **Use allkeys-lfu for skewed workloads** — 10-15% higher hit ratio than LRU when access follows Zipfian distribution.
3. **Set maxmemory-samples to 10** — improves eviction accuracy with minimal CPU overhead.
4. **Enable io-threads for large payloads** — Redis 6+ multi-threaded I/O gives 2-4x throughput.
5. **Disable persistence for pure cache** — removes fsync overhead and BGSAVE fork latency spikes.
6. **Use HyperLogLog for unique counting** — 12KB fixed vs megabytes for SET; 0.81% error is acceptable.
7. **Pipeline commands to same slot** — eliminates per-command RTT; 5-10x throughput improvement.
8. **Route reads to replicas in Cluster** — doubles or triples read throughput with `scaleReads: "slave"`.
9. **Benchmark with realistic data** — use `redis-benchmark` with production-like key/value sizes and patterns.
10. **Monitor memory fragmentation ratio** — if > 1.5, enable `activedefrag` or schedule restart.

## 8. Anti-Patterns

1. **JSON STRING for all data** — ignores HASH, ZSET, HLL; misses partial-read optimization.
2. **allkeys-lru for popularity-skewed workloads** — LFU gives significantly better hit ratios.
3. **No maxmemory on cache instances** — Redis grows until OOM kill; always set explicit limit.
4. **AOF always on cache-only instance** — 50-80% throughput penalty for data that can be rebuilt.
5. **Single Redis for cache + queues** — eviction policy conflicts; cache eviction deletes queue jobs.
6. **Memcached for complex access patterns** — no data structures, no scripting; use Redis.
7. **Cross-slot pipelines in Cluster** — pipeline fails with CROSSSLOT error; use hash tags.
8. **Not monitoring eviction rate** — high eviction + low hit ratio = undersized cache; money wasted.

## 9. Enforcement Checklist

- [ ] Redis data structure matches access pattern (not defaulting to STRING)
- [ ] maxmemory configured on every cache instance
- [ ] Eviction policy set (allkeys-lfu for skewed, allkeys-lru for uniform)
- [ ] maxmemory-samples >= 10 for production
- [ ] Persistence disabled for pure cache workloads
- [ ] io-threads configured for Redis 6+ (2-4 threads)
- [ ] Reads routed to replicas for read-heavy workloads
- [ ] Pipelines used for batch operations within same hash slot
- [ ] Memory fragmentation ratio monitored (alert if > 1.5)
- [ ] Eviction rate vs hit ratio tracked together
