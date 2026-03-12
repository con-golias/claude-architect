# Redis as a Database

> **Domain:** Database > NoSQL > Key-Value
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Redis is often classified as "just a cache," but it is a full-featured in-memory data structure server that can serve as a primary database for specific workloads. With persistence (RDB + AOF), replication, Lua scripting, pub/sub, streams, and cluster mode, Redis handles use cases far beyond caching: session storage, real-time leaderboards, rate limiting, message queues, geospatial queries, and time-series data. This document covers Redis as a database — persistence, durability, clustering, and data modeling. For Redis caching patterns (TTL, eviction, invalidation), see `06-backend/caching/redis-in-practice/`.

---

## How It Works

### Persistence Modes

```
┌─────────────────────────────────────────────────┐
│              Redis Persistence                   │
│                                                  │
│  RDB (Snapshotting)         AOF (Append-Only)   │
│  ┌──────────────────┐      ┌──────────────────┐ │
│  │ Periodic snapshot │      │ Log every write  │ │
│  │ of entire dataset │      │ operation         │ │
│  │                    │      │                    │ │
│  │ Binary dump.rdb    │      │ Text appendonly.aof│ │
│  │ Compact, fast load │      │ Larger, slower load│ │
│  │ Data loss possible │      │ Minimal data loss  │ │
│  │ (since last snap)  │      │ (configurable sync)│ │
│  └──────────────────┘      └──────────────────┘ │
│                                                  │
│  Recommended: BOTH RDB + AOF                    │
│  RDB for fast restarts, AOF for durability      │
└─────────────────────────────────────────────────┘
```

```
# redis.conf — persistence configuration

# RDB: save snapshot every N seconds if M keys changed
save 900 1        # save after 900s if at least 1 key changed
save 300 10       # save after 300s if at least 10 keys changed
save 60 10000     # save after 60s if at least 10000 keys changed

# AOF: append every write to log
appendonly yes
appendfsync everysec    # fsync once per second (recommended)
# appendfsync always    # fsync every write (safest, slowest)
# appendfsync no        # let OS decide when to fsync (fastest, risk)

# AOF rewrite (compact AOF file periodically)
auto-aof-rewrite-percentage 100   # rewrite when AOF doubles in size
auto-aof-rewrite-min-size 64mb    # minimum AOF size before rewrite
```

**AOF sync modes:**

| Mode | Durability | Performance | Data Loss Risk |
|------|-----------|-------------|----------------|
| `always` | Every write | Slowest | None |
| `everysec` | Per second | Good | Up to 1 second |
| `no` | OS decides | Fastest | Up to 30 seconds |

---

### Redis Cluster

```
┌──────────────────────────────────────────────┐
│              Redis Cluster                    │
│                                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │Master 1 │  │Master 2 │  │Master 3 │     │
│  │Slots    │  │Slots    │  │Slots    │     │
│  │0-5460   │  │5461-10922│ │10923-16383│   │
│  └────┬────┘  └────┬────┘  └────┬────┘     │
│       │             │             │           │
│  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐     │
│  │Replica 1│  │Replica 2│  │Replica 3│     │
│  └─────────┘  └─────────┘  └─────────┘     │
│                                               │
│  16384 hash slots distributed across masters │
│  Each key hashed to a slot: CRC16(key) % 16384│
│  Automatic failover if master goes down       │
└──────────────────────────────────────────────┘
```

```bash
# Create cluster
redis-cli --cluster create \
  node1:6379 node2:6379 node3:6379 \
  node4:6379 node5:6379 node6:6379 \
  --cluster-replicas 1

# Check cluster status
redis-cli cluster info
redis-cli cluster nodes
```

---

### Data Modeling for Database Use

```bash
# Session storage (primary use case)
HSET session:abc123 userId 42 role admin expiresAt 1719849600
EXPIRE session:abc123 3600  # 1 hour TTL

# Leaderboard (Sorted Set)
ZADD leaderboard 1500 "player:alice"
ZADD leaderboard 2200 "player:bob"
ZADD leaderboard 1800 "player:carol"
ZREVRANGE leaderboard 0 9 WITHSCORES  # top 10
ZRANK leaderboard "player:alice"       # alice's rank

# Rate limiting (sliding window)
# Using sorted set with timestamps
ZADD rate:user:42 1719849600.123 "req:uuid1"
ZADD rate:user:42 1719849600.456 "req:uuid2"
ZREMRANGEBYSCORE rate:user:42 0 1719849540  # remove entries > 60s old
ZCARD rate:user:42  # count requests in window

# Geospatial (restaurants near a location)
GEOADD restaurants -73.9857 40.7484 "Times Square Diner"
GEOADD restaurants -73.9654 40.7829 "Central Park Cafe"
GEORADIUS restaurants -73.98 40.75 2 km ASC COUNT 10  # nearest 10 within 2km

# Time-series (Redis TimeSeries module)
TS.CREATE temperature:sensor1 RETENTION 86400000 LABELS location "NYC"
TS.ADD temperature:sensor1 * 72.5
TS.RANGE temperature:sensor1 - + AGGREGATION avg 3600000  # hourly averages

# Pub/Sub for real-time events
SUBSCRIBE order_updates
PUBLISH order_updates '{"orderId": 42, "status": "shipped"}'

# Streams (persistent pub/sub with consumer groups)
XADD orders * orderId 42 status shipped total 99.99
XREADGROUP GROUP processors worker1 COUNT 10 BLOCK 5000 STREAMS orders >
XACK orders processors 1719849600123-0  # acknowledge processed
```

---

### Lua Scripting (Atomic Operations)

```lua
-- Atomic rate limiter (no race conditions)
-- KEYS[1] = rate limit key, ARGV[1] = window (seconds), ARGV[2] = max requests
local key = KEYS[1]
local window = tonumber(ARGV[1])
local maxRequests = tonumber(ARGV[2])
local now = tonumber(redis.call('TIME')[1])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count < maxRequests then
    redis.call('ZADD', key, now, now .. ':' .. math.random())
    redis.call('EXPIRE', key, window)
    return 1  -- allowed
else
    return 0  -- rate limited
end
```

```go
// Go — execute Lua script
script := redis.NewScript(`
    local key = KEYS[1]
    local window = tonumber(ARGV[1])
    local max = tonumber(ARGV[2])
    local now = tonumber(redis.call('TIME')[1])
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
    if redis.call('ZCARD', key) < max then
        redis.call('ZADD', key, now, now..':'..math.random())
        redis.call('EXPIRE', key, window)
        return 1
    end
    return 0
`)

allowed, err := script.Run(ctx, rdb, []string{"rate:user:42"}, 60, 100).Int()
```

---

### Redis vs Dedicated Databases

| Use Case | Redis | Better Alternative | When to Switch |
|----------|-------|-------------------|----------------|
| Session storage | Excellent | — | Never (Redis is ideal) |
| Caching | Excellent | — | Never |
| Leaderboards | Excellent | — | Never |
| Rate limiting | Excellent | — | Never |
| Message queue | Good (Streams) | Kafka, RabbitMQ | High throughput, persistence critical |
| Time-series | Good (TS module) | TimescaleDB, InfluxDB | Complex queries, long retention |
| Full-text search | Limited (RediSearch) | Elasticsearch, PostgreSQL FTS | Complex search requirements |
| Primary database | Limited | PostgreSQL, MongoDB | Complex queries, relations needed |
| Geospatial | Good | PostGIS | Complex geospatial operations |

---

## Best Practices

1. **ALWAYS enable both RDB + AOF persistence** when using Redis as database
2. **ALWAYS use appendfsync everysec** as minimum durability — never `no` for database use
3. **ALWAYS use Redis Cluster** for data larger than single-node memory
4. **ALWAYS use Lua scripts** for multi-step atomic operations — prevents race conditions
5. **ALWAYS set memory limits** (maxmemory) — prevent OOM kills
6. **ALWAYS use key expiration (TTL)** for temporary data — prevent memory leaks
7. **ALWAYS use hash tags** in cluster mode for multi-key operations — {user:42}:profile, {user:42}:orders
8. **NEVER use Redis as sole database** for complex relational data — no JOINs, no schema
9. **NEVER store large values** (> 100 KB) — Redis is optimized for small values
10. **NEVER use KEYS command** in production — blocks server, use SCAN instead

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No persistence configured | Complete data loss on restart | Enable AOF + RDB |
| appendfsync = no | Data loss on crash | Use everysec minimum |
| KEYS * in production | Server blocks for seconds | Use SCAN with cursor |
| Large values (> 1 MB) | High latency, memory fragmentation | Split into smaller keys or use S3 |
| No maxmemory limit | OOM kill, server crash | Set maxmemory with eviction policy |
| Using Redis as primary DB for everything | No relations, no complex queries | Use PostgreSQL for relational data |
| No cluster for large datasets | Single point of failure, memory limit | Deploy Redis Cluster |
| Missing hash tags in cluster | CROSSSLOT errors on multi-key ops | Use {tag} prefix for related keys |
| Blocking commands (BLPOP) on shared connection | Blocks other operations | Use dedicated connection for blocking |
| No monitoring | Memory issues undetected | Monitor with redis-cli INFO, Redis Exporter |

---

## Real-world Examples

### Twitter
- Redis for timeline caching and real-time feed delivery
- Sorted Sets for trending topics ranking
- Pub/Sub for real-time notifications

### GitHub
- Redis for background job queues (Resque/Sidekiq)
- Session storage for web application
- Rate limiting for API endpoints

### Discord
- Redis for presence (online status) tracking
- Pub/Sub for real-time message delivery
- Rate limiting for API and WebSocket connections

---

## Enforcement Checklist

- [ ] Persistence configured (AOF + RDB for database use)
- [ ] appendfsync set to everysec minimum
- [ ] maxmemory configured with appropriate eviction policy
- [ ] Redis Cluster deployed for datasets > single-node memory
- [ ] Lua scripts used for multi-step atomic operations
- [ ] SCAN used instead of KEYS in all code
- [ ] Key expiration set for all temporary data
- [ ] Hash tags used for related keys in cluster mode
- [ ] Monitoring configured (memory, connections, latency)
- [ ] Backup strategy in place (RDB snapshots to external storage)
