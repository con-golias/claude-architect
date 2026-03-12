# API Rate Limiting

Category: Application Security / API Security
Severity: Critical
Last Updated: 2025-12
Tags: rate-limiting, throttling, redis, api-gateway, quota

---

## Overview

Rate limiting is the primary defense against API abuse, denial-of-service attacks, credential stuffing, data scraping, and resource exhaustion. Effective rate limiting operates at multiple layers: per user, per API key, per endpoint, and per tier. This guide covers all dimensions of API rate limiting, including distributed implementations, gateway configurations, GraphQL complexity-based limiting, and quota management.

---

## Per-User Rate Limits

Rate limit authenticated users by their user ID. This prevents a single user from monopolizing API resources regardless of how many clients or IP addresses they use.

**TypeScript (Express middleware with Redis sliding window)**:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

interface RateLimitConfig {
  windowMs: number;    // Window size in milliseconds
  maxRequests: number; // Max requests per window
}

async function slidingWindowRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const pipe = redis.pipeline();
  // Remove expired entries
  pipe.zremrangebyscore(key, 0, windowStart);
  // Add current request
  pipe.zadd(key, now.toString(), `${now}:${Math.random()}`);
  // Count requests in window
  pipe.zcard(key);
  // Set expiry on the key
  pipe.pexpire(key, config.windowMs);

  const results = await pipe.exec();
  const requestCount = results![2][1] as number;

  const remaining = Math.max(0, config.maxRequests - requestCount);
  const resetAt = now + config.windowMs;

  if (requestCount > config.maxRequests) {
    // Remove the request we just added (it was over limit)
    await redis.zremrangebyscore(key, now.toString(), now.toString());
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining, resetAt };
}

function rateLimitMiddleware(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return next(); // Unauthenticated requests handled separately

    const key = `ratelimit:user:${userId}`;
    const result = await slidingWindowRateLimit(key, config);

    // Set standard rate limit headers (IETF draft)
    res.setHeader('RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('RateLimit-Remaining', result.remaining.toString());
    res.setHeader('RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter,
      });
    }

    next();
  };
}

// Apply: 100 requests per minute per user
app.use('/api', rateLimitMiddleware({ windowMs: 60000, maxRequests: 100 }));
```

**Go (per-user rate limiter)**:

```go
import (
    "context"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "github.com/redis/go-redis/v9"
)

type RateLimitResult struct {
    Allowed   bool
    Remaining int
    ResetAt   time.Time
}

func slidingWindowRateLimit(
    ctx context.Context,
    rdb *redis.Client,
    key string,
    maxRequests int,
    window time.Duration,
) (*RateLimitResult, error) {
    now := time.Now()
    windowStart := now.Add(-window)

    pipe := rdb.Pipeline()
    pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart.UnixMilli()))
    pipe.ZAdd(ctx, key, redis.Z{
        Score:  float64(now.UnixMilli()),
        Member: fmt.Sprintf("%d:%d", now.UnixNano(), time.Now().UnixNano()),
    })
    countCmd := pipe.ZCard(ctx, key)
    pipe.PExpire(ctx, key, window)

    _, err := pipe.Exec(ctx)
    if err != nil {
        return nil, err
    }

    count := int(countCmd.Val())
    remaining := maxRequests - count
    if remaining < 0 {
        remaining = 0
    }

    return &RateLimitResult{
        Allowed:   count <= maxRequests,
        Remaining: remaining,
        ResetAt:   now.Add(window),
    }, nil
}

func rateLimitMiddleware(rdb *redis.Client, maxRequests int, window time.Duration) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID := getUserIDFromContext(r.Context())
            key := fmt.Sprintf("ratelimit:user:%s", userID)

            result, err := slidingWindowRateLimit(r.Context(), rdb, key, maxRequests, window)
            if err != nil {
                // On Redis failure, allow the request (fail open) but log
                log.Printf("rate limit check failed: %v", err)
                next.ServeHTTP(w, r)
                return
            }

            w.Header().Set("RateLimit-Limit", strconv.Itoa(maxRequests))
            w.Header().Set("RateLimit-Remaining", strconv.Itoa(result.Remaining))
            w.Header().Set("RateLimit-Reset", strconv.FormatInt(result.ResetAt.Unix(), 10))

            if !result.Allowed {
                retryAfter := int(time.Until(result.ResetAt).Seconds()) + 1
                w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
                http.Error(w, `{"error":"Too many requests"}`, http.StatusTooManyRequests)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

**Python (FastAPI with Redis)**:

```python
import time
import redis.asyncio as redis
from fastapi import Request, Response

redis_client = redis.from_url("redis://localhost:6379")

async def sliding_window_rate_limit(
    key: str, max_requests: int, window_seconds: int
) -> dict:
    now = time.time()
    window_start = now - window_seconds

    pipe = redis_client.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zadd(key, {f"{now}:{id(key)}": now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds)

    results = await pipe.execute()
    count = results[2]

    remaining = max(0, max_requests - count)
    reset_at = now + window_seconds

    return {
        "allowed": count <= max_requests,
        "remaining": remaining,
        "reset_at": int(reset_at),
    }

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    user = getattr(request.state, "user", None)
    if not user:
        return await call_next(request)

    key = f"ratelimit:user:{user.id}"
    result = await sliding_window_rate_limit(key, max_requests=100, window_seconds=60)

    response = Response() if not result["allowed"] else await call_next(request)

    response.headers["RateLimit-Limit"] = "100"
    response.headers["RateLimit-Remaining"] = str(result["remaining"])
    response.headers["RateLimit-Reset"] = str(result["reset_at"])

    if not result["allowed"]:
        retry_after = result["reset_at"] - int(time.time())
        response.headers["Retry-After"] = str(max(1, retry_after))
        response.status_code = 429
        response.body = b'{"error": "Too many requests"}'
        response.media_type = "application/json"

    return response
```

---

## Per-API-Key Rate Limits

API keys often have different rate limits based on the key's tier or plan.

```typescript
interface APIKeyLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
}

const TIER_LIMITS: Record<string, APIKeyLimits> = {
  free:       { requestsPerMinute: 10,  requestsPerDay: 1000 },
  starter:    { requestsPerMinute: 60,  requestsPerDay: 10000 },
  pro:        { requestsPerMinute: 300, requestsPerDay: 100000 },
  enterprise: { requestsPerMinute: 1000, requestsPerDay: 1000000 },
};

async function apiKeyRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.apiKey; // Set by API key auth middleware
  if (!apiKey) return next();

  const limits = TIER_LIMITS[apiKey.tier] || TIER_LIMITS.free;

  // Check per-minute limit
  const minuteKey = `ratelimit:apikey:${apiKey.id}:minute`;
  const minuteResult = await slidingWindowRateLimit(minuteKey, {
    windowMs: 60000,
    maxRequests: limits.requestsPerMinute,
  });

  // Check per-day limit
  const dayKey = `ratelimit:apikey:${apiKey.id}:day`;
  const dayResult = await slidingWindowRateLimit(dayKey, {
    windowMs: 86400000,
    maxRequests: limits.requestsPerDay,
  });

  // Use the more restrictive limit
  const allowed = minuteResult.allowed && dayResult.allowed;
  const remaining = Math.min(minuteResult.remaining, dayResult.remaining);

  res.setHeader('RateLimit-Limit', `${limits.requestsPerMinute}/min, ${limits.requestsPerDay}/day`);
  res.setHeader('RateLimit-Remaining', remaining.toString());

  if (!allowed) {
    const retryAfter = !minuteResult.allowed
      ? Math.ceil((minuteResult.resetAt - Date.now()) / 1000)
      : Math.ceil((dayResult.resetAt - Date.now()) / 1000);

    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({
      error: 'Rate limit exceeded',
      limit: !minuteResult.allowed ? 'per-minute' : 'per-day',
      retryAfter,
    });
  }

  next();
}
```

---

## Per-Endpoint Rate Limits

Different endpoints have different risk profiles. Authentication endpoints need much stricter limits than read-only endpoints.

```typescript
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  'POST /api/auth/login':           { windowMs: 60000, maxRequests: 5 },
  'POST /api/auth/register':        { windowMs: 3600000, maxRequests: 3 },
  'POST /api/auth/forgot-password': { windowMs: 3600000, maxRequests: 3 },
  'POST /api/auth/verify-otp':      { windowMs: 60000, maxRequests: 5 },
  'GET /api/users':                 { windowMs: 60000, maxRequests: 60 },
  'POST /api/orders':               { windowMs: 60000, maxRequests: 10 },
  'POST /api/payments':             { windowMs: 60000, maxRequests: 5 },
  'GET /api/search':                { windowMs: 60000, maxRequests: 30 },
};

const DEFAULT_LIMIT: RateLimitConfig = { windowMs: 60000, maxRequests: 100 };

function perEndpointRateLimitMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const endpointKey = `${req.method} ${req.route?.path || req.path}`;
    const config = ENDPOINT_LIMITS[endpointKey] || DEFAULT_LIMIT;

    // Use IP for unauthenticated endpoints, user ID for authenticated
    const identifier = req.user?.id || req.ip;
    const key = `ratelimit:endpoint:${endpointKey}:${identifier}`;

    const result = await slidingWindowRateLimit(key, config);

    res.setHeader('RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('RateLimit-Remaining', result.remaining.toString());
    res.setHeader('RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({ error: 'Too many requests', retryAfter });
    }

    next();
  };
}
```

---

## Tiered Rate Limits

```go
type RateTier struct {
    Name              string
    RequestsPerMinute int
    RequestsPerHour   int
    RequestsPerDay    int
    BurstSize         int
}

var tiers = map[string]*RateTier{
    "free": {
        Name:              "free",
        RequestsPerMinute: 10,
        RequestsPerHour:   200,
        RequestsPerDay:    1000,
        BurstSize:         5,
    },
    "starter": {
        Name:              "starter",
        RequestsPerMinute: 60,
        RequestsPerHour:   2000,
        RequestsPerDay:    20000,
        BurstSize:         20,
    },
    "pro": {
        Name:              "pro",
        RequestsPerMinute: 300,
        RequestsPerHour:   10000,
        RequestsPerDay:    100000,
        BurstSize:         50,
    },
    "enterprise": {
        Name:              "enterprise",
        RequestsPerMinute: 2000,
        RequestsPerHour:   60000,
        RequestsPerDay:    1000000,
        BurstSize:         200,
    },
}

func tieredRateLimitMiddleware(rdb *redis.Client) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            apiKey := getAPIKeyFromContext(r.Context())
            tier := tiers[apiKey.Tier]
            if tier == nil {
                tier = tiers["free"]
            }

            // Check all three windows
            checks := []struct {
                window time.Duration
                limit  int
                suffix string
            }{
                {time.Minute, tier.RequestsPerMinute, "min"},
                {time.Hour, tier.RequestsPerHour, "hour"},
                {24 * time.Hour, tier.RequestsPerDay, "day"},
            }

            for _, check := range checks {
                key := fmt.Sprintf("ratelimit:%s:%s:%s", apiKey.ID, check.suffix,
                    time.Now().Truncate(check.window).Unix())
                result, _ := slidingWindowRateLimit(r.Context(), rdb, key, check.limit, check.window)
                if !result.Allowed {
                    w.Header().Set("Retry-After",
                        strconv.Itoa(int(time.Until(result.ResetAt).Seconds())+1))
                    w.Header().Set("X-RateLimit-Tier", tier.Name)
                    http.Error(w, `{"error":"Rate limit exceeded","tier":"`+tier.Name+`"}`,
                        http.StatusTooManyRequests)
                    return
                }
            }

            w.Header().Set("X-RateLimit-Tier", tier.Name)
            next.ServeHTTP(w, r)
        })
    }
}
```

---

## Rate Limit Headers (IETF Draft Standard)

Follow the IETF draft `RateLimit` header fields specification for consistent client behavior.

```typescript
// Standard rate limit headers per IETF draft-ietf-httpapi-ratelimit-headers
function setRateLimitHeaders(
  res: Response,
  limit: number,
  remaining: number,
  resetEpochSeconds: number,
  policy?: string,
) {
  // RateLimit-Limit: Maximum requests allowed in the window
  res.setHeader('RateLimit-Limit', limit.toString());

  // RateLimit-Remaining: Requests remaining in the current window
  res.setHeader('RateLimit-Remaining', remaining.toString());

  // RateLimit-Reset: Seconds until the window resets (delta seconds)
  const resetDelta = Math.max(0, resetEpochSeconds - Math.floor(Date.now() / 1000));
  res.setHeader('RateLimit-Reset', resetDelta.toString());

  // Optional: RateLimit-Policy for compound limits
  if (policy) {
    res.setHeader('RateLimit-Policy', policy);
    // Example: "100;w=60" means 100 requests per 60-second window
    // Example: "100;w=60, 1000;w=3600" for multiple windows
  }
}

// Example usage
setRateLimitHeaders(res, 100, 87, resetAt, '100;w=60, 1000;w=3600');
```

---

## 429 Response with Retry-After

Always include `Retry-After` in 429 responses. This tells well-behaved clients exactly when they can retry.

```typescript
function send429(res: Response, retryAfterSeconds: number, context?: string) {
  res.setHeader('Retry-After', retryAfterSeconds.toString());
  res.setHeader('Content-Type', 'application/json');
  res.status(429).json({
    error: 'Too Many Requests',
    message: context || 'Rate limit exceeded. Please slow down.',
    retryAfter: retryAfterSeconds,
    // Do NOT include user-specific info that could aid enumeration
  });
}
```

```go
func send429(w http.ResponseWriter, retryAfter int, context string) {
    w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusTooManyRequests)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error":      "Too Many Requests",
        "message":    context,
        "retryAfter": retryAfter,
    })
}
```

```python
from fastapi.responses import JSONResponse

def rate_limit_response(retry_after: int, context: str = "") -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": "Too Many Requests",
            "message": context or "Rate limit exceeded.",
            "retryAfter": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )
```

---

## Distributed Rate Limiting with Redis

### Fixed Window Counter

Simple but can allow 2x burst at window boundaries.

```typescript
async function fixedWindowRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowKey = `${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, windowSeconds);
  }
  return count <= limit;
}
```

### Sliding Window Log (Precise)

Stores each request timestamp. Precise but uses more memory.

```typescript
async function slidingWindowLog(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const pipe = redis.pipeline();
  pipe.zremrangebyscore(key, 0, now - windowMs);
  pipe.zadd(key, now.toString(), `${now}:${crypto.randomUUID()}`);
  pipe.zcard(key);
  pipe.pexpire(key, windowMs);
  const results = await pipe.exec();
  return (results![2][1] as number) <= limit;
}
```

### Sliding Window Counter (Balanced)

Approximation that is memory-efficient and avoids boundary bursts.

```typescript
async function slidingWindowCounter(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Date.now();
  const currentWindow = Math.floor(now / (windowSeconds * 1000));
  const previousWindow = currentWindow - 1;
  const windowProgress = (now % (windowSeconds * 1000)) / (windowSeconds * 1000);

  const currentKey = `${key}:${currentWindow}`;
  const previousKey = `${key}:${previousWindow}`;

  const pipe = redis.pipeline();
  pipe.get(previousKey);
  pipe.incr(currentKey);
  pipe.expire(currentKey, windowSeconds * 2);

  const results = await pipe.exec();
  const previousCount = parseInt(results![0][1] as string || '0');
  const currentCount = results![1][1] as number;

  // Weighted sum: previous window's count proportional to time remaining
  const estimatedCount = previousCount * (1 - windowProgress) + currentCount;

  return estimatedCount <= limit;
}
```

### Token Bucket (Burst-Friendly)

Allows bursts up to the bucket size while maintaining a sustained rate.

```python
import time

async def token_bucket_rate_limit(
    key: str,
    max_tokens: int,
    refill_rate: float,  # tokens per second
) -> tuple[bool, int]:
    """
    Token bucket using Redis.
    Returns (allowed, remaining_tokens).
    """
    now = time.time()
    pipe = redis_client.pipeline()

    # Atomic Lua script for token bucket
    lua_script = """
    local key = KEYS[1]
    local max_tokens = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    local data = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(data[1]) or max_tokens
    local last_refill = tonumber(data[2]) or now

    -- Refill tokens
    local elapsed = now - last_refill
    tokens = math.min(max_tokens, tokens + elapsed * refill_rate)

    -- Try to consume a token
    local allowed = 0
    if tokens >= 1 then
        tokens = tokens - 1
        allowed = 1
    end

    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(max_tokens / refill_rate) + 1)

    return {allowed, math.floor(tokens)}
    """

    result = await redis_client.eval(lua_script, 1, key, max_tokens, refill_rate, now)
    return bool(result[0]), int(result[1])
```

---

## Rate Limiting in API Gateways

### Kong

```yaml
# kong.yml -- Rate Limiting plugin configuration
plugins:
  - name: rate-limiting
    config:
      minute: 100
      hour: 5000
      day: 100000
      policy: redis           # Use Redis for distributed limiting
      redis_host: redis.internal
      redis_port: 6379
      redis_database: 0
      redis_timeout: 2000
      fault_tolerant: true    # Allow requests on Redis failure
      hide_client_headers: false
      limit_by: consumer      # Per consumer (user/API key)

  # Advanced: Different limits per route
  - name: rate-limiting
    route: auth-login
    config:
      minute: 5
      policy: redis
      redis_host: redis.internal
      limit_by: ip            # By IP for login attempts

  - name: rate-limiting
    route: api-read
    config:
      minute: 300
      policy: redis
      redis_host: redis.internal
      limit_by: consumer
```

### AWS API Gateway

```yaml
# AWS SAM template for API Gateway rate limiting
Resources:
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowMethods: "'GET,POST,PUT,DELETE'"
        AllowOrigin: "'https://app.example.com'"

  # Usage plan with throttling
  UsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: StandardPlan
      Throttle:
        BurstLimit: 50       # Max concurrent requests
        RateLimit: 100       # Requests per second
      Quota:
        Limit: 100000        # Requests per period
        Period: DAY
      ApiStages:
        - ApiId: !Ref ApiGateway
          Stage: prod

  # Premium plan with higher limits
  PremiumUsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: PremiumPlan
      Throttle:
        BurstLimit: 200
        RateLimit: 500
      Quota:
        Limit: 1000000
        Period: DAY
      ApiStages:
        - ApiId: !Ref ApiGateway
          Stage: prod
```

### Envoy Proxy

```yaml
# Envoy rate limit configuration
http_filters:
  - name: envoy.filters.http.ratelimit
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.ratelimit.v3.RateLimit
      domain: api_gateway
      failure_mode_deny: false    # Fail open on rate limit service failure
      rate_limit_service:
        grpc_service:
          envoy_grpc:
            cluster_name: rate_limit_service
        transport_api_version: V3

# Rate limit service configuration (ratelimit.yaml)
domain: api_gateway
descriptors:
  # Per-user limits
  - key: user_id
    rate_limit:
      unit: minute
      requests_per_unit: 100

  # Per-endpoint limits for auth
  - key: path
    value: "/api/auth/login"
    rate_limit:
      unit: minute
      requests_per_unit: 5

  # Per-IP limits for unauthenticated
  - key: remote_address
    rate_limit:
      unit: minute
      requests_per_unit: 30

  # Tiered limits
  - key: user_tier
    descriptors:
      - key: tier
        value: "free"
        rate_limit:
          unit: minute
          requests_per_unit: 10
      - key: tier
        value: "pro"
        rate_limit:
          unit: minute
          requests_per_unit: 300
```

---

## GraphQL Complexity-Based Rate Limiting

Standard request-count rate limiting is inadequate for GraphQL because query complexity varies enormously.

```typescript
import { getComplexity, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';

interface ComplexityBucket {
  points: number;
  lastRefill: number;
}

const MAX_COMPLEXITY_POINTS = 10000;  // Points per minute
const REFILL_RATE = 167;               // ~10000 / 60 seconds

const complexityBuckets = new Map<string, ComplexityBucket>();

function consumeComplexityBudget(userId: string, cost: number): boolean {
  const now = Date.now();
  let bucket = complexityBuckets.get(userId);

  if (!bucket) {
    bucket = { points: MAX_COMPLEXITY_POINTS, lastRefill: now };
    complexityBuckets.set(userId, bucket);
  }

  // Refill
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.points = Math.min(MAX_COMPLEXITY_POINTS, bucket.points + elapsed * REFILL_RATE);
  bucket.lastRefill = now;

  if (bucket.points >= cost) {
    bucket.points -= cost;
    return true;
  }

  return false;
}

const complexityRateLimitPlugin = {
  async requestDidStart({ context }) {
    return {
      async didResolveOperation({ request, document, schema }) {
        const complexity = getComplexity({
          schema,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });

        if (!consumeComplexityBudget(context.user.id, complexity)) {
          throw new GraphQLError('Complexity budget exceeded', {
            extensions: {
              code: 'RATE_LIMITED',
              queryCost: complexity,
              message: 'Your query is too complex. Try requesting fewer fields or simplifying nested queries.',
            },
          });
        }

        // Add complexity info to response extensions
        context.queryCost = complexity;
      },
      async willSendResponse({ context, response }) {
        if (response.extensions) {
          response.extensions.queryCost = context.queryCost;
        }
      },
    };
  },
};
```

---

## Cost-Based Rate Limiting

Assign different costs to different operations. A read costs 1 point, a write costs 5, a search costs 10.

```typescript
const OPERATION_COSTS: Record<string, number> = {
  'GET /api/users/:id':    1,
  'GET /api/users':        5,    // List operations are more expensive
  'POST /api/users':       10,   // Write operations
  'PUT /api/users/:id':    5,
  'DELETE /api/users/:id':  5,
  'GET /api/search':       10,   // Search is expensive
  'POST /api/exports':     50,   // Data exports are very expensive
  'POST /api/bulk':        100,  // Bulk operations
};

async function costBasedRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const route = `${req.method} ${req.route?.path || req.path}`;
  const cost = OPERATION_COSTS[route] || 1;

  const userId = req.user?.id || req.ip;
  const key = `ratelimit:cost:${userId}`;

  // Lua script for atomic cost-based token bucket
  const result = await redis.eval(`
    local key = KEYS[1]
    local cost = tonumber(ARGV[1])
    local max_points = tonumber(ARGV[2])
    local refill_rate = tonumber(ARGV[3])
    local now = tonumber(ARGV[4])

    local data = redis.call('HMGET', key, 'points', 'last_refill')
    local points = tonumber(data[1]) or max_points
    local last_refill = tonumber(data[2]) or now

    local elapsed = now - last_refill
    points = math.min(max_points, points + elapsed * refill_rate)

    if points >= cost then
      points = points - cost
      redis.call('HMSET', key, 'points', points, 'last_refill', now)
      redis.call('EXPIRE', key, 120)
      return {1, math.floor(points)}
    else
      redis.call('HMSET', key, 'points', points, 'last_refill', now)
      redis.call('EXPIRE', key, 120)
      return {0, math.floor(points)}
    end
  `, 1, key, cost, 1000, 17, Math.floor(Date.now() / 1000));
  // 1000 max points, refill 17/second (~1000/minute)

  const [allowed, remaining] = result as [number, number];

  res.setHeader('RateLimit-Remaining', remaining.toString());
  res.setHeader('X-Request-Cost', cost.toString());

  if (!allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      requestCost: cost,
      remainingBudget: remaining,
    });
  }

  next();
}
```

---

## Spike Arrest

Spike arrest smooths traffic by enforcing a maximum rate of requests per second, preventing bursts even within a rate limit window.

```go
type SpikeArrest struct {
    interval    time.Duration // Minimum time between requests
    lastRequest sync.Map
}

func NewSpikeArrest(requestsPerSecond float64) *SpikeArrest {
    interval := time.Duration(float64(time.Second) / requestsPerSecond)
    return &SpikeArrest{interval: interval}
}

func (sa *SpikeArrest) Allow(key string) bool {
    now := time.Now()

    if lastVal, ok := sa.lastRequest.Load(key); ok {
        last := lastVal.(time.Time)
        if now.Sub(last) < sa.interval {
            return false
        }
    }

    sa.lastRequest.Store(key, now)
    return true
}

// Usage: Allow 10 requests per second (100ms between requests)
spikeArrest := NewSpikeArrest(10)

func spikeArrestMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        key := getUserIDFromContext(r.Context())
        if !spikeArrest.Allow(key) {
            send429(w, 1, "Too many requests per second")
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

---

## Concurrent Request Limiting

Limit the number of requests a user can have in-flight simultaneously. This prevents a single user from consuming all server worker threads.

```typescript
const MAX_CONCURRENT = 10;
const concurrentRequests = new Map<string, number>();

async function concurrentLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) return next();

  const current = concurrentRequests.get(userId) || 0;
  if (current >= MAX_CONCURRENT) {
    return res.status(429).json({
      error: 'Too many concurrent requests',
      maxConcurrent: MAX_CONCURRENT,
    });
  }

  concurrentRequests.set(userId, current + 1);

  // Decrement when response finishes
  res.on('finish', () => {
    const count = concurrentRequests.get(userId) || 1;
    if (count <= 1) {
      concurrentRequests.delete(userId);
    } else {
      concurrentRequests.set(userId, count - 1);
    }
  });

  next();
}
```

**Distributed concurrent limiting with Redis**:

```python
async def concurrent_limit(user_id: str, max_concurrent: int) -> bool:
    """
    Use a Redis sorted set to track in-flight requests.
    Score = request start time, member = unique request ID.
    """
    key = f"concurrent:{user_id}"
    request_id = str(uuid4())
    now = time.time()

    # Clean up stale requests (older than 5 minutes)
    await redis_client.zremrangebyscore(key, 0, now - 300)

    # Check current count
    count = await redis_client.zcard(key)
    if count >= max_concurrent:
        return False

    # Add this request
    await redis_client.zadd(key, {request_id: now})
    await redis_client.expire(key, 300)

    return True

async def release_concurrent(user_id: str, request_id: str):
    key = f"concurrent:{user_id}"
    await redis_client.zrem(key, request_id)
```

---

## Quota Management

Long-term usage quotas (monthly, billing-period) differ from short-term rate limits. Quotas control total usage, while rate limits control usage velocity.

```typescript
interface QuotaConfig {
  monthlyRequests: number;
  monthlyBandwidthBytes: number;
  monthlyComputeUnits: number;
}

const PLAN_QUOTAS: Record<string, QuotaConfig> = {
  free:       { monthlyRequests: 10000,   monthlyBandwidthBytes: 1e9,   monthlyComputeUnits: 1000 },
  starter:    { monthlyRequests: 100000,  monthlyBandwidthBytes: 10e9,  monthlyComputeUnits: 10000 },
  pro:        { monthlyRequests: 1000000, monthlyBandwidthBytes: 100e9, monthlyComputeUnits: 100000 },
  enterprise: { monthlyRequests: -1,      monthlyBandwidthBytes: -1,    monthlyComputeUnits: -1 }, // unlimited
};

async function quotaMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  const quota = PLAN_QUOTAS[user.plan] || PLAN_QUOTAS.free;

  // Skip for unlimited plans
  if (quota.monthlyRequests === -1) return next();

  const monthKey = new Date().toISOString().slice(0, 7); // "2025-01"
  const usageKey = `quota:${user.id}:${monthKey}`;

  const usage = await redis.hincrby(usageKey, 'requests', 1);
  await redis.expire(usageKey, 40 * 86400); // Expire after 40 days

  // Set quota headers
  res.setHeader('X-Quota-Limit', quota.monthlyRequests.toString());
  res.setHeader('X-Quota-Used', usage.toString());
  res.setHeader('X-Quota-Remaining', Math.max(0, quota.monthlyRequests - usage).toString());

  if (usage > quota.monthlyRequests) {
    return res.status(429).json({
      error: 'Monthly quota exceeded',
      plan: user.plan,
      used: usage,
      limit: quota.monthlyRequests,
      resetsAt: getNextMonthStart().toISOString(),
      upgradeUrl: 'https://example.com/pricing',
    });
  }

  next();
}

function getNextMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}
```

---

## Rate Limiting for Unauthenticated Requests

Unauthenticated endpoints (login, registration, public APIs) must be rate limited by IP address. Be aware of proxy and load balancer configurations that can mask the real client IP.

```typescript
function getClientIP(req: Request): string {
  // Trust X-Forwarded-For only if behind a trusted proxy
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // Take the leftmost IP (original client)
      const ip = (forwarded as string).split(',')[0].trim();
      if (ip) return ip;
    }
  }
  return req.socket.remoteAddress || 'unknown';
}

// Stricter limits for unauthenticated endpoints
app.use('/api/auth',
  rateLimitMiddleware({
    keyFn: (req) => `ip:${getClientIP(req)}`,
    windowMs: 60000,
    maxRequests: 10,
  }),
);

// Even stricter for login
app.post('/api/auth/login',
  rateLimitMiddleware({
    keyFn: (req) => `ip:login:${getClientIP(req)}`,
    windowMs: 60000,
    maxRequests: 5,
  }),
  loginHandler,
);
```

---

## Best Practices

1. **Layer rate limits at multiple levels** -- Apply per-user, per-API-key, per-endpoint, and per-IP limits. Each layer catches different abuse patterns.

2. **Return standard rate limit headers** -- Use `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` per the IETF draft specification.

3. **Use Redis sliding window for distributed rate limiting** -- Sliding window counters provide a good balance between precision and memory usage across multiple server instances.

4. **Apply stricter limits to authentication endpoints** -- Login, registration, and password reset endpoints should have much lower limits (5-10 per minute) than read endpoints.

5. **Fail open on rate limiter failure** -- If Redis is down, allow requests through rather than blocking all traffic. Log the failure for investigation.

6. **Separate rate limits from quotas** -- Rate limits control requests per time unit (velocity). Quotas control total usage per billing period (volume). Both are needed.

7. **Assign costs to operations** -- Not all requests are equal. A search query costs more than a simple read. Weight your rate limiting accordingly.

8. **Implement spike arrest for bursty traffic** -- Token bucket or leaky bucket algorithms smooth traffic better than fixed windows.

9. **Track and expose quota usage** -- Return `X-Quota-Used`, `X-Quota-Remaining`, and `X-Quota-Limit` headers so clients can self-regulate.

10. **Rate limit WebSocket messages separately** -- WebSocket connections bypass HTTP rate limiters. Implement message-level rate limiting on the persistent connection.

---

## Anti-Patterns

1. **Rate limiting only by IP address** -- Shared IPs (corporate networks, NAT, VPNs) punish innocent users. Combine IP limits with user/API-key limits.

2. **Using the same rate limit for all endpoints** -- Login endpoints and read endpoints have vastly different abuse profiles. One size does not fit all.

3. **Fixed window counters without sliding window** -- Fixed windows allow 2x burst at window boundaries (e.g., 100 requests at 0:59 and 100 at 1:00).

4. **Failing closed on rate limiter failure** -- If Redis is down and you block all requests, a rate limiter outage becomes a full API outage.

5. **Not returning Retry-After headers** -- Without `Retry-After`, clients retry immediately, creating a thundering herd that worsens the overload.

6. **Client-side rate limiting as the only control** -- Client-side limits are trivially bypassed. Rate limiting must be server-side.

7. **Applying rate limits after expensive operations** -- Check rate limits before processing the request, not after the database query has already run.

8. **Ignoring GraphQL query complexity in rate limits** -- A single GraphQL request can be equivalent to hundreds of REST requests. Count complexity, not just requests.

---

## Enforcement Checklist

- [ ] Per-user rate limits are enforced for all authenticated endpoints
- [ ] Per-IP rate limits are enforced for unauthenticated endpoints
- [ ] Per-endpoint rate limits are configured (stricter for auth, looser for reads)
- [ ] API key rate limits are tiered by plan (free, starter, pro, enterprise)
- [ ] Standard rate limit headers are returned (RateLimit-Limit, Remaining, Reset)
- [ ] 429 responses include Retry-After header
- [ ] Distributed rate limiting uses Redis sliding window or token bucket
- [ ] Rate limiter fails open on Redis failure (with logging and alerting)
- [ ] GraphQL endpoints use complexity-based rate limiting
- [ ] Cost-based rate limiting assigns different weights to different operations
- [ ] Spike arrest prevents burst abuse within rate limit windows
- [ ] Concurrent request limits prevent resource monopolization
- [ ] Monthly/billing quotas are tracked and enforced separately from rate limits
- [ ] API gateway rate limiting is configured as the first layer of defense
- [ ] Rate limit bypass is tested (multiple IPs, multiple keys, batch requests)
