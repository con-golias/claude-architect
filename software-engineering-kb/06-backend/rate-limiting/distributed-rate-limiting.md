# Distributed Rate Limiting

> **AI Plugin Directive — Distributed Rate Limiting with Redis & Lua Scripts**
> You are an AI coding assistant. When generating, reviewing, or refactoring distributed
> rate limiting code, follow EVERY rule in this document. In-memory rate limiters fail in
> multi-instance deployments. Treat each section as non-negotiable.

**Core Rule: ALWAYS use a shared store (Redis) for rate limiting in multi-instance deployments. ALWAYS use atomic Lua scripts for check-and-increment operations. ALWAYS fail open when the rate limiter store is unavailable. ALWAYS handle clock drift between instances.**

---

## 1. Distributed Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Distributed Rate Limiting                        │
│                                                               │
│  Instance A ──┐                                              │
│  Instance B ──┼── Redis (shared counter) ──► Decision       │
│  Instance C ──┘                                              │
│                                                               │
│  Without shared store:                                       │
│  ├── Each instance tracks independently                     │
│  ├── 3 instances × 100/min = 300/min actual (3x target)    │
│  └── Load balancer redistribution breaks limits             │
│                                                               │
│  With Redis:                                                 │
│  ├── Single counter for all instances                       │
│  ├── Atomic Lua script: check + increment in one call       │
│  └── Exact rate enforcement regardless of instance count    │
│                                                               │
│  Requirement: Lua script for atomicity                      │
│  (GET + compare + INCR must be a single operation)          │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Redis Lua Script — Sliding Window

```typescript
// Atomic sliding window using Redis sorted set + Lua
const SLIDING_WINDOW_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local window_start = now - window

  -- Remove expired entries
  redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

  -- Count current entries
  local count = redis.call('ZCARD', key)

  if count < limit then
    -- Add new entry
    redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
    redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
    return {1, limit - count - 1}  -- allowed, remaining
  else
    return {0, 0}  -- denied, 0 remaining
  end
`;

class DistributedRateLimiter {
  constructor(private redis: Redis, private script: string) {}

  async isAllowed(key: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    remaining: number;
  }> {
    try {
      const result = await this.redis.eval(
        this.script, 1,
        `rl:${key}`,
        Date.now(),
        windowMs,
        limit,
      ) as [number, number];

      return { allowed: result[0] === 1, remaining: result[1] };
    } catch (error) {
      // ALWAYS fail open — allow request if Redis is down
      logger.error("Rate limiter unavailable", { error: (error as Error).message });
      metrics.increment("rate_limiter.fallback");
      return { allowed: true, remaining: limit };
    }
  }
}
```

---

## 3. Redis Lua Script — Token Bucket

```typescript
const TOKEN_BUCKET_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local rate = tonumber(ARGV[2])      -- tokens per second
  local capacity = tonumber(ARGV[3])  -- max bucket size
  local requested = tonumber(ARGV[4]) -- tokens to consume

  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1]) or capacity
  local last_refill = tonumber(bucket[2]) or now

  -- Refill tokens based on elapsed time
  local elapsed = (now - last_refill) / 1000
  tokens = math.min(capacity, tokens + elapsed * rate)

  if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / rate) + 1)
    return {1, math.floor(tokens)}  -- allowed, remaining
  else
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / rate) + 1)
    local wait = math.ceil((requested - tokens) / rate)
    return {0, 0, wait}  -- denied, 0 remaining, retry after
  end
`;
```

---

## 4. Go Implementation

```go
var slidingWindowScript = redis.NewScript(`
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
  local count = redis.call('ZCARD', key)
  if count < limit then
    redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
    redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
    return {1, limit - count - 1}
  end
  return {0, 0}
`)

func IsAllowed(ctx context.Context, rdb *redis.Client, key string, limit int, windowMs int) (bool, int, error) {
    result, err := slidingWindowScript.Run(ctx, rdb,
        []string{"rl:" + key},
        time.Now().UnixMilli(), windowMs, limit,
    ).Int64Slice()

    if err != nil {
        slog.Error("rate limiter error", "error", err)
        return true, limit, nil // Fail open
    }

    return result[0] == 1, int(result[1]), nil
}
```

---

## 5. Python Implementation

```python
SLIDING_WINDOW_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
    redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
    redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
    return {1, limit - count - 1}
end
return {0, 0}
"""

class DistributedLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.script = self.redis.register_script(SLIDING_WINDOW_LUA)

    async def is_allowed(self, key: str, limit: int, window_ms: int) -> tuple[bool, int]:
        try:
            result = await self.script(
                keys=[f"rl:{key}"],
                args=[int(time.time() * 1000), window_ms, limit],
            )
            return result[0] == 1, result[1]
        except Exception:
            return True, limit  # Fail open
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| In-memory limiter in multi-instance | N× actual rate (N instances) | Shared Redis store |
| Non-atomic check + increment | Race condition, exceeds limit | Lua script for atomicity |
| Fail closed on Redis error | All traffic blocked | Fail open (allow) on error |
| No clock synchronization | Inconsistent windows | Use Redis server time (`TIME`) |
| Large sorted sets | Memory pressure | TTL + ZREMRANGEBYSCORE cleanup |
| One Redis for rate limiting + app | Rate limiter affected by app load | Dedicated Redis instance |

---

## 7. Enforcement Checklist

- [ ] Shared Redis store used for all rate limiting
- [ ] Atomic Lua scripts for check-and-increment
- [ ] Fail-open behavior when Redis is unavailable
- [ ] Redis key TTL set to prevent memory leaks
- [ ] Dedicated Redis instance (not shared with cache)
- [ ] Lua script handles clock drift gracefully
- [ ] Rate limit metrics tracked (allowed, denied counts)
