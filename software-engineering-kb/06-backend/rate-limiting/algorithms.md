# Rate Limiting Algorithms

> **AI Plugin Directive — Rate Limiting Algorithms & Implementation**
> You are an AI coding assistant. When generating, reviewing, or refactoring rate limiting
> code, follow EVERY rule in this document. Without rate limiting, APIs are vulnerable to
> abuse, resource exhaustion, and denial of service. Treat each section as non-negotiable.

**Core Rule: ALWAYS implement rate limiting on all public API endpoints. ALWAYS use sliding window or token bucket algorithm (NOT fixed window). ALWAYS return 429 status with Retry-After header. ALWAYS rate limit by authenticated user ID, falling back to IP. NEVER rely solely on IP-based rate limiting.**

---

## 1. Algorithm Comparison

```
┌──────────────────────────────────────────────────────────────┐
│              Rate Limiting Algorithms                          │
│                                                               │
│  FIXED WINDOW: count requests per calendar window           │
│  ├── Simple but allows burst at window boundary             │
│  └── 100 req at 11:59:59 + 100 req at 12:00:00 = 200/min  │
│                                                               │
│  SLIDING WINDOW LOG: exact count using timestamp log        │
│  ├── Accurate but memory-intensive (stores every timestamp) │
│  └── O(n) memory per user                                   │
│                                                               │
│  SLIDING WINDOW COUNTER: weighted blend of windows          │
│  ├── Approximation with low memory                          │
│  └── RECOMMENDED for most use cases                         │
│                                                               │
│  TOKEN BUCKET: tokens refill at fixed rate                  │
│  ├── Allows bursts up to bucket size                        │
│  ├── Smooth rate over time                                  │
│  └── RECOMMENDED for API rate limiting                      │
│                                                               │
│  LEAKY BUCKET: fixed rate output regardless of input        │
│  ├── Smoothest output rate                                  │
│  └── Best for traffic shaping                               │
└──────────────────────────────────────────────────────────────┘
```

| Algorithm | Accuracy | Memory | Burst | Complexity | Use Case |
|-----------|----------|--------|-------|------------|----------|
| Fixed window | Low | O(1) | Yes (boundary) | Simple | Internal/low-stakes |
| Sliding window log | Exact | O(n) | No | Medium | High accuracy needed |
| **Sliding window counter** | High | O(1) | Minimal | Medium | **General API** |
| **Token bucket** | High | O(1) | Controlled | Medium | **API + burst support** |
| Leaky bucket | High | O(1) | No | Medium | Traffic shaping |

---

## 2. TypeScript — Sliding Window Counter

```typescript
class SlidingWindowRateLimiter {
  constructor(
    private redis: Redis,
    private windowMs: number,   // e.g., 60000 (1 minute)
    private maxRequests: number, // e.g., 100
  ) {}

  async isAllowed(key: string): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowMs);
    const previousWindow = currentWindow - 1;
    const elapsed = (now % this.windowMs) / this.windowMs; // 0.0 - 1.0

    const [currentCount, previousCount] = await Promise.all([
      this.redis.get(`rl:${key}:${currentWindow}`),
      this.redis.get(`rl:${key}:${previousWindow}`),
    ]);

    // Weighted count: previous window's contribution decreases over time
    const weighted = (Number(previousCount) || 0) * (1 - elapsed)
                   + (Number(currentCount) || 0);

    if (weighted >= this.maxRequests) {
      const retryAfter = Math.ceil((1 - elapsed) * this.windowMs / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    // Increment current window
    const pipe = this.redis.multi();
    pipe.incr(`rl:${key}:${currentWindow}`);
    pipe.expire(`rl:${key}:${currentWindow}`, Math.ceil(this.windowMs / 1000) * 2);
    await pipe.exec();

    return {
      allowed: true,
      remaining: Math.max(0, Math.floor(this.maxRequests - weighted - 1)),
    };
  }
}

// Middleware
function rateLimitMiddleware(limiter: SlidingWindowRateLimiter): RequestHandler {
  return async (req, res, next) => {
    const key = req.user?.id ?? req.ip; // User ID first, fallback to IP

    const result = await limiter.isAllowed(key);
    res.set("X-RateLimit-Limit", String(limiter.maxRequests));
    res.set("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      res.set("Retry-After", String(result.retryAfter));
      return res.status(429).json({
        error: {
          type: "RATE_LIMITED",
          message: "Too many requests",
          retryAfter: result.retryAfter,
        },
      });
    }

    next();
  };
}
```

---

## 3. Go — Token Bucket

```go
import "golang.org/x/time/rate"

// In-memory token bucket (single instance)
type RateLimiter struct {
    limiters sync.Map
    rate     rate.Limit
    burst    int
}

func NewRateLimiter(rps float64, burst int) *RateLimiter {
    return &RateLimiter{rate: rate.Limit(rps), burst: burst}
}

func (rl *RateLimiter) getLimiter(key string) *rate.Limiter {
    limiter, loaded := rl.limiters.LoadOrStore(key, rate.NewLimiter(rl.rate, rl.burst))
    if !loaded {
        // Cleanup stale limiters (run as goroutine)
    }
    return limiter.(*rate.Limiter)
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        key := auth.GetUserID(r.Context())
        if key == "" {
            key = r.RemoteAddr
        }

        limiter := rl.getLimiter(key)
        if !limiter.Allow() {
            w.Header().Set("Retry-After", "60")
            writeJSON(w, 429, map[string]string{"error": "Too many requests"})
            return
        }

        next.ServeHTTP(w, r)
    })
}

// Redis-based sliding window (for distributed)
func IsAllowed(ctx context.Context, rdb *redis.Client, key string, limit int, windowSec int) (bool, error) {
    now := time.Now().UnixMilli()
    windowStart := now - int64(windowSec*1000)

    pipe := rdb.Pipeline()
    pipe.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(windowStart, 10))
    pipe.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: now})
    pipe.ZCard(ctx, key)
    pipe.Expire(ctx, key, time.Duration(windowSec)*time.Second)

    cmds, err := pipe.Exec(ctx)
    if err != nil {
        return true, err // Fail open
    }

    count := cmds[2].(*redis.IntCmd).Val()
    return count <= int64(limit), nil
}
```

---

## 4. Python Implementation

```python
import time
from redis.asyncio import Redis

class SlidingWindowLimiter:
    def __init__(self, redis: Redis, max_requests: int, window_seconds: int):
        self.redis = redis
        self.max_requests = max_requests
        self.window = window_seconds

    async def is_allowed(self, key: str) -> tuple[bool, int]:
        now = time.time()
        window_start = now - self.window
        pipe_key = f"rl:{key}"

        async with self.redis.pipeline() as pipe:
            pipe.zremrangebyscore(pipe_key, 0, window_start)
            pipe.zadd(pipe_key, {str(now): now})
            pipe.zcard(pipe_key)
            pipe.expire(pipe_key, self.window)
            results = await pipe.execute()

        count = results[2]
        remaining = max(0, self.max_requests - count)
        return count <= self.max_requests, remaining

# FastAPI middleware
@app.middleware("http")
async def rate_limit(request: Request, call_next):
    key = getattr(request.state, "user_id", request.client.host)
    allowed, remaining = await limiter.is_allowed(key)

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": {"type": "RATE_LIMITED", "message": "Too many requests"}},
            headers={"Retry-After": "60"},
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    return response
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Fixed window only | Burst at boundary (2x rate) | Sliding window or token bucket |
| IP-only rate limit | Shared IPs (NAT, corporate) rate limited unfairly | Rate limit by user ID first |
| No Retry-After header | Client retries immediately | Include Retry-After in 429 |
| No rate limit headers | Client cannot track usage | X-RateLimit-Limit/Remaining |
| Same limit for all endpoints | Login brute-forced at high rate | Per-endpoint limits |
| Fail closed on Redis error | All requests blocked | Fail open (allow) on error |

---

## 6. Enforcement Checklist

- [ ] Sliding window counter or token bucket algorithm used
- [ ] Rate limit key: user ID first, IP fallback
- [ ] 429 response with Retry-After header
- [ ] X-RateLimit-Limit and X-RateLimit-Remaining headers set
- [ ] Separate limits for auth endpoints (stricter: 5/min)
- [ ] Redis-based for distributed rate limiting
- [ ] Fail-open behavior when rate limiter is unavailable
- [ ] Rate limit bypass for internal/health check traffic
