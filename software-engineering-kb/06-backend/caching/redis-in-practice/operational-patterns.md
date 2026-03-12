# Redis Operational Patterns

> **AI Plugin Directive — Redis Operations, Performance & Production**
> You are an AI coding assistant. When generating, reviewing, or refactoring Redis operational
> code, follow EVERY rule in this document. Redis misconfigurations cause data loss, connection
> exhaustion, and cascading failures. Treat each section as non-negotiable.

**Core Rule: ALWAYS use connection pooling with configured limits. ALWAYS use pipelining for batch operations. ALWAYS enable persistence (RDB + AOF) for data that cannot be regenerated. NEVER use blocking commands on the main connection — use dedicated connections for BLPOP/SUBSCRIBE.**

---

## 1. Connection Pooling

```
┌──────────────────────────────────────────────────────────────┐
│              Connection Pool Architecture                      │
│                                                               │
│  Application                                                  │
│  ┌─────────────────────────────────────────┐                 │
│  │  Connection Pool                         │                 │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │                 │
│  │  │Conn1│ │Conn2│ │Conn3│ │ConnN│      │                 │
│  │  │ Idle│ │Active│ │Active│ │ Idle│      │                 │
│  │  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘      │                 │
│  └─────┼───────┼───────┼───────┼──────────┘                 │
│         └───────┴───────┴───────┘                             │
│                    │                                           │
│                    ▼                                           │
│         ┌──────────────────┐                                  │
│         │   Redis Server    │                                  │
│         │   maxclients=10K  │                                  │
│         └──────────────────┘                                  │
│                                                               │
│  Pool sizing:                                                 │
│  ├── min_idle = 5       (pre-warmed connections)             │
│  ├── max_active = 20    (per application instance)           │
│  ├── max_idle = 10      (keep warm for burst)                │
│  └── Total across fleet: instances × max_active < maxclients│
└──────────────────────────────────────────────────────────────┘
```

**TypeScript (ioredis)**
```typescript
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === "production" ? {} : undefined,

  // Connection
  connectTimeout: 5000,
  commandTimeout: 3000,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 2000),

  // Pool (ioredis uses single multiplexed connection by default)
  // For connection pooling, use Generic-Pool or multiple instances:
  lazyConnect: true,
  enableReadyCheck: true,
  enableAutoPipelining: true, // Auto-batch commands in same tick
});

// Health check
redis.on("error", (err) => {
  logger.error("Redis connection error", { error: err.message });
  metrics.increment("redis.connection.error");
});

redis.on("connect", () => {
  logger.info("Redis connected");
  metrics.increment("redis.connection.established");
});
```

**Go (go-redis)**
```go
rdb := redis.NewClient(&redis.Options{
    Addr:     os.Getenv("REDIS_ADDR"),
    Password: os.Getenv("REDIS_PASSWORD"),
    DB:       0,

    // Pool configuration
    PoolSize:     20,              // Max connections
    MinIdleConns: 5,               // Pre-warmed connections
    MaxIdleConns: 10,              // Max idle connections kept open
    PoolTimeout:  4 * time.Second, // Wait for pool connection

    // Timeouts
    DialTimeout:  5 * time.Second,
    ReadTimeout:  3 * time.Second,
    WriteTimeout: 3 * time.Second,

    // TLS
    TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12},

    // Retry
    MaxRetries:      3,
    MinRetryBackoff: 200 * time.Millisecond,
    MaxRetryBackoff: 2 * time.Second,
})

// Verify connectivity
if err := rdb.Ping(ctx).Err(); err != nil {
    log.Fatalf("Redis connection failed: %v", err)
}
```

**Python (redis-py)**
```python
import redis.asyncio as aioredis

pool = aioredis.ConnectionPool.from_url(
    os.environ["REDIS_URL"],
    max_connections=20,
    decode_responses=True,
    socket_timeout=3.0,
    socket_connect_timeout=5.0,
    retry_on_timeout=True,
    health_check_interval=30,
)
r = aioredis.Redis(connection_pool=pool)
```

- ALWAYS configure pool size based on: `instances × pool_size < Redis maxclients`
- ALWAYS set connect, read, and write timeouts — NEVER use unbounded timeouts
- ALWAYS enable TLS in production — Redis traffic is plaintext by default
- ALWAYS implement reconnection with exponential backoff
- NEVER create a new connection per request — use connection pooling

---

## 2. Pipelining

Send multiple commands in a single round-trip. Reduces network latency dramatically.

```
┌──────────────────────────────────────────────────────────────┐
│              Without Pipeline vs With Pipeline                 │
│                                                               │
│  Without Pipeline (3 round-trips):                           │
│  Client ──GET──► Redis ──reply──► Client     RTT × 3        │
│  Client ──GET──► Redis ──reply──► Client                     │
│  Client ──GET──► Redis ──reply──► Client                     │
│                                                               │
│  With Pipeline (1 round-trip):                               │
│  Client ──GET,GET,GET──► Redis ──reply,reply,reply──► Client │
│                                          RTT × 1             │
│                                                               │
│  Performance: 5-10x throughput improvement for batch ops     │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// Pipeline — batch multiple commands
const pipeline = redis.pipeline();
pipeline.get("user:1:name");
pipeline.get("user:1:email");
pipeline.hgetall("user:1:settings");
pipeline.ttl("session:abc123");

const results = await pipeline.exec();
// results = [[null, "Alice"], [null, "alice@ex.com"], [null, {...}], [null, 1800]]

// Pipeline for batch writes
async function cacheProducts(products: Product[]): Promise<void> {
  const pipeline = redis.pipeline();
  for (const product of products) {
    pipeline.setex(
      `product:${product.id}`,
      jitteredTTL(600),
      JSON.stringify(product)
    );
  }
  await pipeline.exec();
}
```

```go
pipe := rdb.Pipeline()
nameCmd := pipe.Get(ctx, "user:1:name")
emailCmd := pipe.Get(ctx, "user:1:email")
settingsCmd := pipe.HGetAll(ctx, "user:1:settings")

_, err := pipe.Exec(ctx)
name := nameCmd.Val()
email := emailCmd.Val()
settings := settingsCmd.Val()
```

```python
async with r.pipeline(transaction=False) as pipe:
    pipe.get("user:1:name")
    pipe.get("user:1:email")
    pipe.hgetall("user:1:settings")
    results = await pipe.execute()
```

- ALWAYS use pipelines for 3+ commands to the same Redis instance
- ALWAYS use `transaction=False` in pipelines unless atomicity is required
- NEVER pipeline more than 10,000 commands at once — chunk into batches
- ALWAYS use pipelines for cache warming and bulk invalidation

---

## 3. Transactions (MULTI/EXEC)

Atomic execution of multiple commands. All-or-nothing within a single slot.

```typescript
// Transfer credits between users (atomic)
async function transferCredits(from: string, to: string, amount: number): Promise<boolean> {
  const fromKey = `credits:${from}`;
  const toKey = `credits:${to}`;

  // Watch for changes (optimistic locking)
  await redis.watch(fromKey);

  const balance = parseInt(await redis.get(fromKey) ?? "0");
  if (balance < amount) {
    await redis.unwatch();
    return false;
  }

  const multi = redis.multi();
  multi.decrby(fromKey, amount);
  multi.incrby(toKey, amount);

  const results = await multi.exec();
  return results !== null; // null = WATCH detected change, retry
}
```

```go
// Optimistic locking with WATCH
err := rdb.Watch(ctx, func(tx *redis.Tx) error {
    balance, _ := tx.Get(ctx, fromKey).Int()
    if balance < amount {
        return errors.New("insufficient balance")
    }

    _, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
        pipe.DecrBy(ctx, fromKey, int64(amount))
        pipe.IncrBy(ctx, toKey, int64(amount))
        return nil
    })
    return err
}, fromKey)
```

- ALWAYS use `WATCH` + `MULTI/EXEC` for optimistic locking patterns
- ALWAYS retry on `nil` result (WATCH detected concurrent modification)
- NEVER use transactions across different hash slots in Redis Cluster
- ALWAYS prefer Lua scripts over transactions for complex atomic operations

---

## 4. Lua Scripting

Atomic server-side execution. Use for complex operations that need atomicity.

```typescript
// Rate limiter — atomic sliding window
const rateLimitScript = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  -- Remove expired entries
  redis.call('ZREMRANGEBYSCORE', key, 0, now - window * 1000)

  -- Count current window
  local count = redis.call('ZCARD', key)

  if count < limit then
    -- Add new entry
    redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
    redis.call('PEXPIRE', key, window * 1000)
    return 1  -- Allowed
  else
    return 0  -- Rate limited
  end
`;

async function checkRateLimit(userId: string, limit: number, windowSec: number): Promise<boolean> {
  const result = await redis.eval(
    rateLimitScript, 1,
    `rate:${userId}`, limit, windowSec, Date.now()
  );
  return result === 1;
}
```

```go
var rateLimitScript = redis.NewScript(`
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window * 1000)
    local count = redis.call('ZCARD', key)
    if count < limit then
        redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
        redis.call('PEXPIRE', key, window * 1000)
        return 1
    end
    return 0
`)

allowed, _ := rateLimitScript.Run(ctx, rdb,
    []string{"rate:" + userID},
    limit, windowSec, time.Now().UnixMilli(),
).Int()
```

- ALWAYS use Lua for operations requiring atomicity across multiple keys (same slot)
- ALWAYS keep Lua scripts short — long scripts block Redis (single-threaded)
- ALWAYS use `EVALSHA` with script caching in production — avoids sending script body every time
- NEVER perform I/O or long-running operations in Lua scripts

---

## 5. Pub/Sub

Real-time message broadcasting. Fire-and-forget — no persistence, no delivery guarantees.

```typescript
// Publisher
await redis.publish("events:user_updated", JSON.stringify({
  userId: "123",
  fields: ["name", "avatar"],
  timestamp: Date.now(),
}));

// Subscriber (MUST use separate connection)
const subscriber = redis.duplicate();
await subscriber.subscribe("events:user_updated", "events:cache_invalidate");

subscriber.on("message", (channel, message) => {
  const data = JSON.parse(message);
  switch (channel) {
    case "events:user_updated":
      localCache.delete(`user:${data.userId}`);
      break;
    case "events:cache_invalidate":
      localCache.delete(data.key);
      break;
  }
});

// Pattern subscribe
await subscriber.psubscribe("events:*");
subscriber.on("pmessage", (pattern, channel, message) => {
  logger.debug("Event received", { pattern, channel });
});
```

```go
pubsub := rdb.Subscribe(ctx, "events:user_updated", "events:cache_invalidate")
defer pubsub.Close()

ch := pubsub.Channel()
for msg := range ch {
    switch msg.Channel {
    case "events:user_updated":
        var data UserEvent
        json.Unmarshal([]byte(msg.Payload), &data)
        localCache.Delete("user:" + data.UserID)
    }
}
```

- ALWAYS use a DEDICATED connection for subscribers — subscribing blocks the connection
- NEVER rely on Pub/Sub for guaranteed delivery — messages are lost if no subscriber is listening
- ALWAYS use Redis Streams for durable messaging — Pub/Sub is fire-and-forget only
- ALWAYS use pattern subscriptions (`PSUBSCRIBE`) sparingly — they scan all channels

---

## 6. Persistence Configuration

```
┌──────────────────────────────────────────────────────────────┐
│              Redis Persistence Options                         │
│                                                               │
│  ┌──────────────┐                                            │
│  │ RDB Snapshot │  Point-in-time snapshot to disk            │
│  │              │  ✅ Compact, fast recovery                 │
│  │              │  ❌ Data loss between snapshots            │
│  └──────────────┘                                            │
│                                                               │
│  ┌──────────────┐                                            │
│  │ AOF Log      │  Append every write to log file            │
│  │              │  ✅ Minimal data loss (1 sec with fsync)   │
│  │              │  ❌ Larger files, slower recovery          │
│  └──────────────┘                                            │
│                                                               │
│  Production recommendation: RDB + AOF                        │
│  ├── AOF for durability (appendfsync everysec)              │
│  ├── RDB for fast recovery and backups                      │
│  └── Redis 7+: use Multi-Part AOF (auto-managed)           │
└──────────────────────────────────────────────────────────────┘
```

```
# redis.conf — Production persistence

# RDB snapshots
save 900 1        # Snapshot if 1 key changed in 900 sec
save 300 100      # Snapshot if 100 keys changed in 300 sec
save 60 10000     # Snapshot if 10000 keys changed in 60 sec
rdbcompression yes
rdbchecksum yes

# AOF
appendonly yes
appendfsync everysec      # Fsync every second (1 sec data loss max)
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-use-rdb-preamble yes  # Hybrid AOF (faster recovery)
```

| Persistence | Data Loss Risk | Recovery Speed | Disk Usage |
|-------------|---------------|----------------|------------|
| **None** | All data on restart | Instant (empty) | None |
| **RDB only** | Minutes of data | Fast (load snapshot) | Compact |
| **AOF only** | ~1 second (everysec) | Slow (replay log) | Large |
| **RDB + AOF** | ~1 second | Fast (RDB) + complete (AOF) | Both |

- ALWAYS enable RDB + AOF for production Redis instances storing important data
- ALWAYS use `appendfsync everysec` — `always` is too slow, `no` risks data loss
- ALWAYS enable `aof-use-rdb-preamble` for faster AOF recovery
- NEVER use persistence for pure cache (ephemeral data) — it adds I/O overhead
- ALWAYS test recovery by restoring from backups regularly

---

## 7. Monitoring & Observability

```typescript
// Comprehensive Redis health check
async function getRedisHealth(redis: Redis): Promise<RedisHealth> {
  const info = await redis.info();

  return {
    // Memory
    usedMemory: parseField(info, "used_memory_human"),
    maxMemory: parseField(info, "maxmemory_human"),
    memoryUsagePercent: calculatePercent(
      parseField(info, "used_memory"),
      parseField(info, "maxmemory")
    ),
    fragmentationRatio: parseFloat(parseField(info, "mem_fragmentation_ratio")),

    // Performance
    hitRate: calculateHitRate(
      parseInt(parseField(info, "keyspace_hits")),
      parseInt(parseField(info, "keyspace_misses"))
    ),
    opsPerSecond: parseInt(parseField(info, "instantaneous_ops_per_sec")),
    connectedClients: parseInt(parseField(info, "connected_clients")),

    // Persistence
    lastRdbSaveStatus: parseField(info, "rdb_last_bgsave_status"),
    lastAofRewriteStatus: parseField(info, "aof_last_bgrewrite_status"),

    // Replication
    role: parseField(info, "role"),
    connectedSlaves: parseInt(parseField(info, "connected_slaves")),
    replicationLag: parseReplicationLag(info),

    // Alerts
    evictedKeys: parseInt(parseField(info, "evicted_keys")),
    rejectedConnections: parseInt(parseField(info, "rejected_connections")),
  };
}
```

| Metric | Target | Alert Threshold | Action |
|--------|--------|-----------------|--------|
| Memory usage | < 80% | > 85% | Scale up or tune eviction |
| Hit rate | > 85% | < 70% | Review cached data, increase TTL |
| Ops/sec | Baseline ± 30% | Spike or drop > 50% | Investigate traffic or bottleneck |
| Connected clients | < 80% of maxclients | > 90% | Increase maxclients or pool tuning |
| Fragmentation ratio | 1.0 - 1.5 | > 2.0 | Restart Redis or enable active defrag |
| Evicted keys | 0 (ideally) | > 100/sec sustained | Increase memory or reduce cached data |
| Replication lag | < 1 sec | > 5 sec | Check network, replica capacity |
| Blocked clients | 0 | > 0 sustained | Check BLPOP/BRPOP/WAIT usage |
| Rejected connections | 0 | Any | Increase maxclients |

- ALWAYS monitor: memory, hit rate, ops/sec, connections, evictions, replication lag
- ALWAYS set up alerts for memory > 85%, hit rate < 70%, and any rejected connections
- ALWAYS use `INFO` command for metrics — NEVER use `MONITOR` in production (performance killer)
- ALWAYS track `slowlog` for queries exceeding threshold — `SLOWLOG GET 10`

---

## 8. Production Hardening

```
# redis.conf — Security & hardening

# Network
bind 10.0.0.0/8              # Bind to private network only
protected-mode yes
requirepass ${REDIS_PASSWORD}  # Strong password

# Security
rename-command FLUSHALL ""    # Disable dangerous commands
rename-command FLUSHDB ""
rename-command KEYS ""        # Force SCAN usage
rename-command DEBUG ""
rename-command CONFIG ""      # Disable runtime config changes

# Limits
maxclients 10000
maxmemory 4gb
maxmemory-policy allkeys-lru
timeout 300                    # Close idle connections after 5 min

# Slow log
slowlog-log-slower-than 10000  # Log commands > 10ms
slowlog-max-len 128

# Latency monitoring
latency-monitor-threshold 100  # Track events > 100ms
```

- ALWAYS disable dangerous commands (FLUSHALL, KEYS, DEBUG) via `rename-command`
- ALWAYS bind to private network interfaces — NEVER expose Redis to public internet
- ALWAYS set `maxclients` based on expected connection count across fleet
- ALWAYS configure `slowlog` to catch slow queries (> 10ms threshold)
- ALWAYS set client idle timeout to reclaim abandoned connections
- ALWAYS use ACLs (Redis 6+) for fine-grained access control instead of single password

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| New connection per request | Connection exhaustion, high latency | Use connection pooling |
| No pipelining for batch ops | High latency on multi-command flows | Pipeline 3+ related commands |
| MONITOR in production | 50%+ performance degradation | Use INFO + slowlog for monitoring |
| KEYS in production | Redis blocks for seconds on large DBs | Use SCAN with COUNT |
| No persistence for important data | Data loss on restart | Enable RDB + AOF |
| Persistence for pure cache | Unnecessary I/O overhead | Disable persistence for ephemeral data |
| Blocking commands on shared connection | Connection unavailable for other ops | Dedicated connection for BLPOP/SUBSCRIBE |
| No memory limit | Redis uses all system memory, OOM kill | Set maxmemory with eviction policy |
| Redis on public internet | Unauthorized access, data breach | Bind to private network, use TLS + auth |
| No slowlog monitoring | Slow queries go undetected | Configure slowlog threshold |
| Single Redis password for all apps | No access isolation | Use Redis 6+ ACLs |
| Long Lua scripts | Redis blocks all other clients | Keep scripts < 5ms, use async patterns |

---

## 10. Enforcement Checklist

- [ ] Connection pool configured (pool size, min idle, timeouts)
- [ ] TLS enabled for all production Redis connections
- [ ] Pipeline used for batch operations (3+ commands)
- [ ] Lua scripts used for complex atomic operations
- [ ] Pub/Sub uses dedicated subscriber connections
- [ ] RDB + AOF enabled for non-ephemeral data
- [ ] `appendfsync everysec` configured (NOT `always` or `no`)
- [ ] Memory monitoring with alerts at 85% usage
- [ ] Hit rate monitored (target > 85%)
- [ ] Slowlog configured and monitored (threshold 10ms)
- [ ] Dangerous commands disabled (FLUSHALL, KEYS, DEBUG)
- [ ] Redis bound to private network, not public internet
- [ ] `maxmemory` and `maxmemory-policy` configured
- [ ] Client idle timeout set to reclaim connections
- [ ] Backup and recovery tested from RDB/AOF
