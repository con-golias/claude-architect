# System Design: Rate Limiting — Complete Specification

> **AI Plugin Directive:** Rate limiting is a MANDATORY defense mechanism for every API and service. It protects against abuse, prevents resource exhaustion, ensures fair usage, and maintains system stability under load. EVERY public-facing API must have rate limiting. EVERY internal service-to-service call should have rate limiting. No exceptions. Without rate limiting, a single bad actor or buggy client can take down your entire system.

---

## 1. Why Rate Limiting is Mandatory

```
WITHOUT RATE LIMITING:
  - One user sends 10,000 requests/second → database overwhelmed → ALL users affected
  - Buggy client retry loop → amplifies failure → cascading outage
  - Scraper/bot → steals all your data → competitive disadvantage
  - DDoS attack → resources exhausted → complete downtime
  - Noisy neighbor → one tenant uses all capacity → other tenants degraded

WITH RATE LIMITING:
  - Abusive traffic rejected at the edge → backend protected
  - Buggy clients get 429 → forced to back off
  - Fair distribution of capacity across all users
  - Graceful degradation under load (reject excess, serve within capacity)

RULE: Rate limiting is NOT optional. It is infrastructure, like authentication.
```

---

## 2. Rate Limiting Algorithms

### 2.1 Token Bucket

```
HOW IT WORKS:
  - Bucket holds tokens (max = bucket_size)
  - Tokens are added at a fixed rate (refill_rate)
  - Each request consumes 1 token (or more for expensive operations)
  - If bucket is empty → request rejected (429)
  - Bucket never exceeds bucket_size

  Parameters:
    bucket_size = maximum burst capacity
    refill_rate = sustained requests per second

  Example: bucket_size=10, refill_rate=2/sec
    → Can burst 10 requests instantly
    → Then limited to 2 requests/sec sustained
    → Bucket refills gradually (1 token every 500ms)

BEST FOR:
  ✅ Most API rate limiting (allows bursts, smooth sustained rate)
  ✅ Both per-user and global rate limiting
  ✅ Easy to understand and configure

USED BY: AWS API Gateway, Stripe, most commercial APIs
```

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly bucketSize: number,   // Max burst
    private readonly refillRate: number,    // Tokens per second
  ) {
    this.tokens = bucketSize; // Start full
    this.lastRefill = Date.now();
  }

  tryConsume(tokensNeeded: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return true; // Request allowed
    }

    return false; // Rate limited — reject with 429
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.bucketSize, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  // For rate limit headers
  getRemainingTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
```

### 2.2 Sliding Window Log

```
HOW IT WORKS:
  - Store timestamp of EVERY request in a sorted set
  - On new request, count requests in the last N seconds
  - If count >= limit → reject
  - Remove expired timestamps periodically

  Parameters:
    window_size = time window (e.g., 60 seconds)
    max_requests = maximum requests in that window

  Example: window_size=60s, max_requests=100
    → At most 100 requests in any rolling 60-second window
    → No burst beyond the limit

BEST FOR:
  ✅ Precise rate limiting (no boundary issues)
  ✅ Regulatory/compliance requirements (exact counts)

DOWNSIDES:
  ❌ Memory-intensive (stores every timestamp)
  ❌ Slower (count operation on every request)
```

```typescript
// Sliding Window Log with Redis
class SlidingWindowLog {
  constructor(
    private readonly redis: Redis,
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {}

  async tryConsume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const redisKey = `ratelimit:${key}`;

    // Atomic operation: remove old entries + count + add new
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart); // Remove expired
    pipeline.zcard(redisKey);                             // Count current
    pipeline.zadd(redisKey, now, `${now}:${uuid()}`);     // Add this request
    pipeline.expire(redisKey, Math.ceil(this.windowMs / 1000)); // TTL cleanup

    const results = await pipeline.exec();
    const currentCount = results[1][1] as number;

    if (currentCount >= this.maxRequests) {
      // Over limit — remove the entry we just added
      await this.redis.zremrangebyscore(redisKey, now, now);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: this.calculateRetryAfter(redisKey),
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - currentCount - 1,
      retryAfterMs: 0,
    };
  }

  private async calculateRetryAfter(redisKey: string): Promise<number> {
    // Find the oldest entry in the window — that's when the next slot opens
    const oldest = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    if (oldest.length >= 2) {
      const oldestTimestamp = parseInt(oldest[1]);
      return oldestTimestamp + this.windowMs - Date.now();
    }
    return this.windowMs;
  }
}
```

### 2.3 Sliding Window Counter

```
HOW IT WORKS:
  - Combines fixed window efficiency with sliding window accuracy
  - Maintain counters for current window AND previous window
  - Weighted count = previous_count × overlap_percentage + current_count

  Example: window=60s, limit=100
    Previous window (0:00-1:00): 84 requests
    Current window (1:00-2:00): 36 requests so far
    Current time: 1:15 (25% into current window)

    Weighted count = 84 × 0.75 + 36 = 63 + 36 = 99
    → Under limit (100). Allow request.

BEST FOR:
  ✅ Best balance of accuracy and memory efficiency
  ✅ Suitable for most production rate limiting
  ✅ Only stores 2 counters per key (not per request)

USED BY: Cloudflare, many production systems
```

```typescript
// Sliding Window Counter with Redis
class SlidingWindowCounter {
  constructor(
    private readonly redis: Redis,
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {}

  async tryConsume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowMs);
    const previousWindow = currentWindow - 1;
    const elapsedInCurrentWindow = (now % this.windowMs) / this.windowMs;

    const currentKey = `ratelimit:${key}:${currentWindow}`;
    const previousKey = `ratelimit:${key}:${previousWindow}`;

    // Get both window counts atomically
    const pipeline = this.redis.pipeline();
    pipeline.get(previousKey);
    pipeline.get(currentKey);
    const results = await pipeline.exec();

    const previousCount = parseInt(results[0][1] as string || '0');
    const currentCount = parseInt(results[1][1] as string || '0');

    // Weighted count: previous window's remaining portion + current window
    const weightedCount = previousCount * (1 - elapsedInCurrentWindow) + currentCount;

    if (weightedCount >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: this.windowMs - (now % this.windowMs),
        limit: this.maxRequests,
      };
    }

    // Increment current window counter
    const ttlSeconds = Math.ceil(this.windowMs * 2 / 1000); // Keep for 2 windows
    await this.redis.pipeline()
      .incr(currentKey)
      .expire(currentKey, ttlSeconds)
      .exec();

    return {
      allowed: true,
      remaining: Math.floor(this.maxRequests - weightedCount - 1),
      retryAfterMs: 0,
      limit: this.maxRequests,
    };
  }
}
```

### 2.4 Fixed Window Counter

```
HOW IT WORKS:
  - Divide time into fixed windows (e.g., each minute)
  - Count requests in current window
  - If count >= limit → reject
  - Counter resets at window boundary

  PROBLEM: Boundary burst
    Window 1 (0:00-1:00): 100 requests at 0:59
    Window 2 (1:00-2:00): 100 requests at 1:01
    → 200 requests in 2 seconds, but each window sees only 100

BEST FOR:
  ✅ Simplest implementation
  ✅ Lowest memory usage (single counter per key)

DOWNSIDES:
  ❌ Boundary burst problem (2x burst at window edges)
  ❌ Not suitable when precise limiting is required

USED BY: Simple APIs, internal services where boundary burst is acceptable
```

### 2.5 Leaky Bucket

```
HOW IT WORKS:
  - Requests enter a queue (bucket)
  - Requests are processed at a FIXED rate (leak rate)
  - If queue is full → reject
  - Smooths out burst traffic into constant rate

  Parameters:
    queue_size = maximum queue depth
    leak_rate = requests processed per second

BEST FOR:
  ✅ Traffic shaping (smooth output rate)
  ✅ Network traffic management
  ✅ When downstream systems need constant input rate

DOWNSIDES:
  ❌ Bursts are queued, not served immediately
  ❌ Added latency from queuing
  ❌ Stale requests may sit in queue

USED BY: Network traffic shapers, some API gateways
```

### Algorithm Selection Guide

```
┌────────────────────────┬─────────────┬────────┬───────────┬────────────┐
│ Algorithm              │ Burst       │ Memory │ Precision │ Best For   │
│                        │ Handling    │        │           │            │
├────────────────────────┼─────────────┼────────┼───────────┼────────────┤
│ Token Bucket           │ Allows      │ Low    │ Good      │ APIs       │
│                        │ controlled  │        │           │ (default)  │
│                        │ bursts      │        │           │            │
├────────────────────────┼─────────────┼────────┼───────────┼────────────┤
│ Sliding Window Log     │ Strict      │ High   │ Exact     │ Compliance │
│                        │ no bursts   │        │           │ APIs       │
├────────────────────────┼─────────────┼────────┼───────────┼────────────┤
│ Sliding Window Counter │ Approximate │ Low    │ Good      │ Production │
│                        │ burst limit │        │           │ (best      │
│                        │             │        │           │  balance)  │
├────────────────────────┼─────────────┼────────┼───────────┼────────────┤
│ Fixed Window Counter   │ 2x burst    │ Lowest │ Rough     │ Internal   │
│                        │ at boundary │        │           │ services   │
├────────────────────────┼─────────────┼────────┼───────────┼────────────┤
│ Leaky Bucket           │ No burst    │ Medium │ Exact     │ Traffic    │
│                        │ (smoothed)  │        │ rate      │ shaping    │
└────────────────────────┴─────────────┴────────┴───────────┴────────────┘

DEFAULT CHOICE: Token Bucket for APIs, Sliding Window Counter for distributed.
```

---

## 3. Rate Limiting Architecture

### 3.1 Where to Apply Rate Limiting

```
LAYER 1 — EDGE / CDN (First line of defense):
  Cloudflare, AWS WAF, AWS Shield
  Blocks DDoS, bot traffic, geographic filtering
  Operates at IP level, very high throughput
  MUST HAVE for public-facing services.

LAYER 2 — API GATEWAY (Per-client limiting):
  Kong, AWS API Gateway, Nginx, Envoy
  Rate limit per API key, per user, per endpoint
  Enforces business-tier limits (free: 100/hr, pro: 10,000/hr)
  MUST HAVE for all API traffic.

LAYER 3 — APPLICATION (Business logic limiting):
  Custom middleware in your application
  Rate limit specific operations (password attempts, email sends)
  Context-aware (different limits for different operations)
  ADD when business rules require per-operation limits.

LAYER 4 — SERVICE-TO-SERVICE (Internal protection):
  Envoy sidecar, custom middleware
  Prevents one service from overwhelming another
  Circuit breaker + rate limit combination
  ADD for internal services with shared resources.

RULE: Layer rate limiting. Each layer catches different threats.
  Edge catches volumetric attacks.
  Gateway catches per-client abuse.
  Application catches business logic abuse.
  Service-to-service catches internal cascading failures.
```

### 3.2 Distributed Rate Limiting

```
PROBLEM:
  Multiple API servers behind a load balancer.
  Each server has its own rate limit counter.
  User gets N × limit (where N = number of servers).

SOLUTIONS:

1. CENTRALIZED COUNTER (Redis):
   All servers check/increment a single Redis counter.
   Pro: Accurate, simple to reason about.
   Con: Redis is a single point of failure. Added latency per request.
   Use: Default choice for most systems.

2. STICKY SESSIONS:
   Route same client to same server (by IP or token).
   Pro: No distributed counter needed.
   Con: Uneven load distribution. Fails on server restart.
   Use: When you can't add Redis.

3. LOCAL COUNTERS + SYNC:
   Each server counts locally, periodically syncs to central store.
   Pro: No per-request Redis call. Tolerates Redis downtime.
   Con: Less accurate (window of drift between syncs).
   Use: When per-request Redis latency is unacceptable.

4. GOSSIP PROTOCOL:
   Servers share rate limit state with each other.
   Pro: No central store needed.
   Con: Complex, eventual consistency on limits.
   Use: Very large-scale systems (rare).

DEFAULT: Use Redis for centralized counters.
  Redis INCR is atomic and fast (<1ms).
  Redis Cluster for high availability.
  Fallback: Allow traffic if Redis is unreachable (fail open).
```

```typescript
// Distributed rate limiter with Redis — production-ready
class DistributedRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly config: RateLimitConfig,
  ) {}

  async checkLimit(
    identifier: string,  // userId, apiKey, IP
    endpoint?: string,   // optional per-endpoint limit
  ): Promise<RateLimitResult> {
    const key = endpoint
      ? `rl:${identifier}:${endpoint}`
      : `rl:${identifier}`;

    const limit = this.config.getLimit(identifier, endpoint);
    const windowMs = this.config.getWindowMs(endpoint);

    try {
      return await this.slidingWindowCheck(key, limit, windowMs);
    } catch (error) {
      // Redis unavailable — FAIL OPEN (allow traffic)
      // Log the failure for alerting
      console.error('Rate limiter Redis unavailable, failing open', error);
      return { allowed: true, remaining: -1, retryAfterMs: 0, limit };
    }
  }

  private async slidingWindowCheck(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Lua script for atomic operation (no race conditions)
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local ttl = tonumber(ARGV[4])

      -- Remove expired entries
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

      -- Count current entries
      local count = redis.call('ZCARD', key)

      if count < limit then
        -- Under limit: add this request
        redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
        redis.call('EXPIRE', key, ttl)
        return {1, limit - count - 1, 0}  -- allowed, remaining, retryAfter
      else
        -- Over limit: find when next slot opens
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local retry_after = 0
        if #oldest >= 2 then
          retry_after = tonumber(oldest[2]) + (ttl * 1000) - now
        end
        return {0, 0, retry_after}  -- blocked, 0 remaining, retryAfter
      end
    `;

    const ttlSeconds = Math.ceil(windowMs / 1000);
    const result = await this.redis.eval(
      luaScript, 1, key,
      now, windowStart, limit, ttlSeconds,
    ) as number[];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfterMs: result[2],
      limit,
    };
  }
}
```

---

## 4. Rate Limit Tiers and Policies

```
TIER-BASED RATE LIMITING:
  Different limits for different customer tiers.

  ┌───────────┬────────────┬─────────────┬──────────────────────────┐
  │ Tier      │ Rate Limit │ Burst       │ Example                  │
  ├───────────┼────────────┼─────────────┼──────────────────────────┤
  │ Free      │ 100/hour   │ 10/minute   │ Hobbyist developers      │
  │ Starter   │ 1,000/hour │ 50/minute   │ Small apps               │
  │ Pro       │ 10,000/hour│ 200/minute  │ Production apps          │
  │ Enterprise│ 100,000/hr │ 2,000/min   │ High-volume customers    │
  │ Internal  │ No limit   │ No limit    │ Your own services        │
  └───────────┴────────────┴─────────────┴──────────────────────────┘

PER-ENDPOINT RATE LIMITING:
  Different endpoints have different costs. Limit accordingly.

  ┌──────────────────────┬──────────┬─────────────────────────────┐
  │ Endpoint             │ Limit    │ Reason                      │
  ├──────────────────────┼──────────┼─────────────────────────────┤
  │ GET /products        │ 100/min  │ Cheap read, cacheable       │
  │ POST /orders         │ 10/min   │ Expensive write operation   │
  │ POST /auth/login     │ 5/min    │ Brute force protection      │
  │ POST /auth/reset     │ 3/hour   │ Abuse prevention            │
  │ POST /upload         │ 5/min    │ Resource-intensive          │
  │ GET /search          │ 30/min   │ Moderate computation        │
  │ GET /export          │ 2/hour   │ Very expensive operation    │
  └──────────────────────┴──────────┴─────────────────────────────┘

DYNAMIC RATE LIMITING:
  Adjust limits based on system load.
  When system is overloaded → reduce limits for non-critical endpoints.
  When system is healthy → use normal limits.
```

```typescript
// Rate limit configuration with tiers and per-endpoint limits
interface RateLimitConfig {
  tiers: Record<string, TierConfig>;
  endpoints: Record<string, EndpointConfig>;
  defaultLimit: number;
  defaultWindowMs: number;
}

const rateLimitConfig: RateLimitConfig = {
  tiers: {
    free:       { requestsPerHour: 100,    burstPerMinute: 10 },
    starter:    { requestsPerHour: 1_000,  burstPerMinute: 50 },
    pro:        { requestsPerHour: 10_000, burstPerMinute: 200 },
    enterprise: { requestsPerHour: 100_000, burstPerMinute: 2_000 },
  },
  endpoints: {
    'POST /auth/login':    { maxPerMinute: 5,  overrideTier: true },
    'POST /auth/reset':    { maxPerHour: 3,    overrideTier: true },
    'POST /orders':        { maxPerMinute: 10, overrideTier: false },
    'POST /upload':        { maxPerMinute: 5,  overrideTier: false },
    'GET /export':         { maxPerHour: 2,    overrideTier: false },
  },
  defaultLimit: 100,
  defaultWindowMs: 3600_000, // 1 hour
};

// Rate limiting middleware (Express/Koa/Fastify)
function rateLimitMiddleware(config: RateLimitConfig, limiter: DistributedRateLimiter) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.user?.id || req.ip; // Authenticated user or IP
    const endpoint = `${req.method} ${req.route?.path || req.path}`;

    const result = await limiter.checkLimit(identifier, endpoint);

    // ALWAYS include rate limit headers — even on success
    res.set({
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
      'X-RateLimit-Reset': String(
        Math.ceil((Date.now() + result.retryAfterMs) / 1000),
      ),
    });

    if (!result.allowed) {
      res.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please retry after the specified time.',
        retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000),
      });
      return;
    }

    next();
  };
}
```

---

## 5. Rate Limit Response Standards

```
HTTP 429 — Too Many Requests

MANDATORY RESPONSE HEADERS:
  X-RateLimit-Limit:     Maximum requests allowed in the window
  X-RateLimit-Remaining: Requests remaining in current window
  X-RateLimit-Reset:     Unix timestamp when window resets
  Retry-After:           Seconds until client should retry

INCLUDE HEADERS ON ALL RESPONSES (not just 429):
  This lets clients self-throttle BEFORE hitting the limit.

RESPONSE BODY (JSON):
  {
    "error": "Too Many Requests",
    "message": "Rate limit exceeded. Retry in 30 seconds.",
    "retryAfterSeconds": 30,
    "limit": 100,
    "remaining": 0,
    "resetAt": "2024-01-15T10:30:00Z"
  }

CLIENT-SIDE HANDLING:
  1. Check X-RateLimit-Remaining before each request
  2. If Remaining < 10% of Limit → slow down proactively
  3. On 429 → wait Retry-After seconds, then retry
  4. Use exponential backoff if repeated 429s
  5. NEVER retry immediately on 429

DOCUMENTATION:
  ALWAYS document rate limits in API docs.
  Include: limits per tier, per endpoint, and headers returned.
```

---

## 6. Specialized Rate Limiting

### 6.1 Login / Authentication Rate Limiting

```typescript
// Login rate limiting — protect against brute force
class LoginRateLimiter {
  constructor(private readonly redis: Redis) {}

  async checkLoginAttempt(
    username: string,
    ip: string,
  ): Promise<LoginLimitResult> {
    // THREE layers of protection:

    // 1. Per-IP limit (prevents distributed brute force on any account)
    const ipResult = await this.checkLimit(
      `login:ip:${ip}`,
      { maxAttempts: 20, windowSeconds: 900 }, // 20 attempts per 15 min per IP
    );
    if (!ipResult.allowed) {
      return { allowed: false, reason: 'IP_RATE_LIMITED', lockoutSeconds: ipResult.retryAfter };
    }

    // 2. Per-username limit (prevents targeted brute force)
    const userResult = await this.checkLimit(
      `login:user:${username}`,
      { maxAttempts: 5, windowSeconds: 900 }, // 5 attempts per 15 min per user
    );
    if (!userResult.allowed) {
      return { allowed: false, reason: 'ACCOUNT_RATE_LIMITED', lockoutSeconds: userResult.retryAfter };
    }

    // 3. Global login limit (prevents credential stuffing at scale)
    const globalResult = await this.checkLimit(
      'login:global',
      { maxAttempts: 1000, windowSeconds: 60 }, // 1000 logins/min globally
    );
    if (!globalResult.allowed) {
      return { allowed: false, reason: 'SYSTEM_RATE_LIMITED', lockoutSeconds: globalResult.retryAfter };
    }

    return { allowed: true, reason: null, lockoutSeconds: 0 };
  }

  async recordFailedLogin(username: string, ip: string): Promise<void> {
    // Record failure for progressive lockout
    const failKey = `login:fails:${username}`;
    const failures = await this.redis.incr(failKey);
    await this.redis.expire(failKey, 3600); // Track for 1 hour

    // Progressive lockout:
    // 3 failures → 30 second lockout
    // 5 failures → 5 minute lockout
    // 10 failures → 30 minute lockout
    // 20 failures → 24 hour lockout + alert security team
    if (failures >= 20) {
      await this.lockAccount(username, 86400);
      await this.alertSecurityTeam(username, ip, failures);
    } else if (failures >= 10) {
      await this.lockAccount(username, 1800);
    } else if (failures >= 5) {
      await this.lockAccount(username, 300);
    } else if (failures >= 3) {
      await this.lockAccount(username, 30);
    }
  }

  async recordSuccessfulLogin(username: string): Promise<void> {
    // Reset failure counter on successful login
    await this.redis.del(`login:fails:${username}`);
  }

  private async checkLimit(
    key: string,
    config: { maxAttempts: number; windowSeconds: number },
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, config.windowSeconds);
    }
    return {
      allowed: count <= config.maxAttempts,
      retryAfter: count > config.maxAttempts
        ? await this.redis.ttl(key)
        : 0,
    };
  }

  private async lockAccount(username: string, seconds: number): Promise<void> {
    await this.redis.setex(`login:locked:${username}`, seconds, '1');
  }

  private async alertSecurityTeam(
    username: string, ip: string, failures: number,
  ): Promise<void> {
    // Send alert to security monitoring
  }
}
```

### 6.2 API Cost-Based Rate Limiting

```typescript
// Not all API calls are equal — weight by cost
class CostBasedRateLimiter {
  private readonly endpointCosts: Record<string, number> = {
    'GET /products':        1,   // Cheap read
    'GET /products/:id':    1,   // Cheap read
    'POST /search':         5,   // Moderate compute
    'POST /orders':         10,  // Expensive write
    'POST /upload':         20,  // Resource-intensive
    'GET /reports/generate': 50, // Very expensive
    'POST /bulk-import':    100, // Extremely expensive
  };

  constructor(
    private readonly redis: Redis,
    private readonly costBudgetPerMinute: number, // Total cost units per minute
  ) {}

  async checkLimit(userId: string, endpoint: string): Promise<RateLimitResult> {
    const cost = this.endpointCosts[endpoint] || 1;
    const key = `cost:${userId}`;
    const now = Date.now();
    const windowStart = now - 60_000; // 1 minute window

    // Lua script: check current cost, add if under budget
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local cost = tonumber(ARGV[3])
      local budget = tonumber(ARGV[4])

      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

      -- Sum all costs in current window
      local entries = redis.call('ZRANGEBYSCORE', key, window_start, now)
      local total_cost = 0
      for i, entry in ipairs(entries) do
        local entry_cost = tonumber(string.match(entry, ':(%d+)$'))
        total_cost = total_cost + (entry_cost or 1)
      end

      if total_cost + cost <= budget then
        redis.call('ZADD', key, now, now .. ':' .. cost)
        redis.call('EXPIRE', key, 120)
        return {1, budget - total_cost - cost}
      else
        return {0, budget - total_cost}
      end
    `;

    const result = await this.redis.eval(
      script, 1, key, now, windowStart, cost, this.costBudgetPerMinute,
    ) as number[];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfterMs: result[0] === 0 ? 60_000 : 0,
      limit: this.costBudgetPerMinute,
      cost,
    };
  }
}
```

---

## 7. Client-Side Rate Limit Handling

```typescript
// Client-side rate limit handler with backoff
class RateLimitAwareClient {
  private remainingRequests: number = Infinity;
  private resetTimestamp: number = 0;

  constructor(private readonly httpClient: HttpClient) {}

  async request<T>(config: RequestConfig): Promise<T> {
    // Proactive throttling: if we know we're near the limit, wait
    if (this.remainingRequests <= 1 && Date.now() < this.resetTimestamp) {
      const waitMs = this.resetTimestamp - Date.now();
      await this.sleep(waitMs);
    }

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.httpClient.request(config);

        // Update rate limit tracking from response headers
        this.updateRateLimitState(response.headers);

        return response.data;
      } catch (error) {
        if (error.status === 429) {
          lastError = error;
          const retryAfter = this.parseRetryAfter(error.headers);
          const backoff = retryAfter || Math.pow(2, attempt) * 1000;

          console.warn(
            `Rate limited. Waiting ${backoff}ms before retry ${attempt + 1}/${maxRetries}`,
          );
          await this.sleep(backoff);
          continue;
        }
        throw error; // Non-rate-limit errors: throw immediately
      }
    }

    throw lastError!;
  }

  private updateRateLimitState(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (remaining) this.remainingRequests = parseInt(remaining);
    if (reset) this.resetTimestamp = parseInt(reset) * 1000;
  }

  private parseRetryAfter(headers: Headers): number | null {
    const retryAfter = headers.get('Retry-After');
    if (!retryAfter) return null;
    return parseInt(retryAfter) * 1000; // Convert seconds to ms
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **No Rate Limiting** | API has no limits at all | Add rate limiting at gateway + application |
| **Client-Side Only** | Rate limiting only in frontend JavaScript | Server-side enforcement is mandatory |
| **Same Limit Everywhere** | Same limit for GET and POST, login and search | Different limits per endpoint and operation |
| **No Response Headers** | 429 without Retry-After or remaining count | Always include X-RateLimit-* headers |
| **Hard Fail on Redis Down** | Rate limiter Redis dies → all traffic blocked | Fail open with alerting when Redis unreachable |
| **No Burst Allowance** | Strict requests/second with no burst room | Token bucket allows controlled bursts |
| **Rate Limit by IP Only** | Shared IPs (corporate, VPN) hit limit for all users | Rate limit by authenticated user ID + IP |
| **Immediate Retry on 429** | Client retries instantly on rate limit | Exponential backoff with Retry-After header |
| **No Per-User Limiting** | Global limit only, no per-user fairness | Per-user limits prevent one user hogging capacity |
| **Ignoring Cost Differences** | Expensive export costs same as cheap GET | Cost-based limiting or per-endpoint limits |

---

## 9. Enforcement Checklist

- [ ] **Every public API has rate limiting** — no exceptions
- [ ] **Rate limiting at multiple layers** — edge, gateway, and application
- [ ] **Per-user rate limits** — prevent single user from consuming all capacity
- [ ] **Per-endpoint limits** — expensive operations have lower limits
- [ ] **Authentication endpoints protected** — login, password reset have strict limits
- [ ] **Rate limit headers on ALL responses** — X-RateLimit-Limit, Remaining, Reset
- [ ] **429 responses include Retry-After** — tell clients when to retry
- [ ] **Distributed rate limiting** — centralized counter (Redis) if multiple servers
- [ ] **Fail-open policy** — if rate limiter is down, allow traffic (don't block everyone)
- [ ] **Rate limits documented** — API docs clearly state limits per tier and endpoint
- [ ] **Client-side backoff** — clients implement exponential backoff on 429
- [ ] **Monitoring and alerting** — track rate limit hits, alert on anomalies
