# Retry Patterns

> **AI Plugin Directive — Retry Strategies for Transient Failures**
> You are an AI coding assistant. When generating, reviewing, or refactoring retry logic,
> follow EVERY rule in this document. Incorrect retry behavior amplifies failures, creates
> retry storms, and overwhelms recovering services. Treat each section as non-negotiable.

**Core Rule: ALWAYS use exponential backoff with full jitter for retries. ALWAYS set a maximum retry count. ALWAYS classify errors before retrying — NEVER retry non-transient errors (4xx client errors). ALWAYS respect Retry-After headers.**

---

## 1. Retry Strategy Selection

```
┌──────────────────────────────────────────────────────────────┐
│              Retry Decision Tree                               │
│                                                               │
│  Error occurred                                              │
│  ├── Is it retryable?                                        │
│  │   ├── 429 Too Many Requests → YES (respect Retry-After)  │
│  │   ├── 500 Internal Server Error → YES                     │
│  │   ├── 502 Bad Gateway → YES                               │
│  │   ├── 503 Service Unavailable → YES                       │
│  │   ├── 504 Gateway Timeout → YES                           │
│  │   ├── Network timeout → YES                               │
│  │   ├── Connection refused → YES                            │
│  │   ├── 400 Bad Request → NO (fix input)                   │
│  │   ├── 401 Unauthorized → NO (fix auth)                   │
│  │   ├── 403 Forbidden → NO (permission issue)              │
│  │   ├── 404 Not Found → NO (resource doesn't exist)        │
│  │   └── 409 Conflict → NO (resolve conflict)               │
│  │                                                           │
│  ├── Have retries remaining?                                 │
│  │   ├── YES → Wait (exp backoff + jitter) → Retry          │
│  │   └── NO → Return error                                  │
│  │                                                           │
│  └── Is circuit breaker open?                                │
│      ├── YES → Return fallback immediately                   │
│      └── NO → Proceed with retry                            │
└──────────────────────────────────────────────────────────────┘
```

| Strategy | Formula | Use Case |
|----------|---------|----------|
| **Exponential + Full Jitter** | `random(0, base * 2^attempt)` | General purpose (RECOMMENDED) |
| **Exponential + Equal Jitter** | `base * 2^attempt / 2 + random(0, base * 2^attempt / 2)` | When minimum delay needed |
| **Fixed delay** | `constant_delay` | Polling patterns only |
| **Linear backoff** | `base * attempt` | Gentle increase |

---

## 2. TypeScript Implementation

```typescript
interface RetryOptions {
  maxAttempts: number;       // Total attempts (including first try)
  baseDelay: number;         // Base delay in ms
  maxDelay: number;          // Maximum delay cap in ms
  retryableErrors?: (error: any) => boolean; // Custom retryable check
}

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!isRetryable(error, options.retryableErrors)) {
        throw error; // Non-retryable — fail immediately
      }

      // Last attempt — don't delay, just throw
      if (attempt === options.maxAttempts - 1) break;

      // Calculate delay with exponential backoff + full jitter
      const expDelay = options.baseDelay * Math.pow(2, attempt);
      const jitteredDelay = Math.random() * Math.min(expDelay, options.maxDelay);

      // Respect Retry-After header if present
      const retryAfter = getRetryAfter(error);
      const delay = retryAfter ? Math.max(jitteredDelay, retryAfter) : jitteredDelay;

      logger.warn("Retrying operation", {
        attempt: attempt + 1,
        maxAttempts: options.maxAttempts,
        delay: Math.round(delay),
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError!;
}

function isRetryable(error: any, customCheck?: (e: any) => boolean): boolean {
  if (customCheck) return customCheck(error);

  // HTTP errors
  if (error.status) {
    return [429, 500, 502, 503, 504].includes(error.status);
  }

  // Network errors
  if (error.code) {
    return ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(error.code);
  }

  return false;
}

function getRetryAfter(error: any): number | null {
  const header = error.headers?.["retry-after"];
  if (!header) return null;
  const seconds = parseInt(header);
  return isNaN(seconds) ? null : seconds * 1000;
}

// Usage
const result = await withRetry(
  () => paymentService.charge(orderId, amount),
  { maxAttempts: 3, baseDelay: 2000, maxDelay: 15000 }
);
```

---

## 3. Go Implementation

```go
type RetryOptions struct {
    MaxAttempts int
    BaseDelay  time.Duration
    MaxDelay   time.Duration
    Retryable  func(error) bool
}

var DefaultRetry = RetryOptions{
    MaxAttempts: 3,
    BaseDelay:   1 * time.Second,
    MaxDelay:    30 * time.Second,
}

func WithRetry[T any](ctx context.Context, opts RetryOptions, fn func() (T, error)) (T, error) {
    var lastErr error
    var zero T

    for attempt := 0; attempt < opts.MaxAttempts; attempt++ {
        result, err := fn()
        if err == nil {
            return result, nil
        }
        lastErr = err

        if !isRetryable(err, opts.Retryable) {
            return zero, err
        }

        if attempt == opts.MaxAttempts-1 {
            break
        }

        delay := calculateDelay(attempt, opts.BaseDelay, opts.MaxDelay)
        slog.Warn("retrying operation",
            "attempt", attempt+1,
            "maxAttempts", opts.MaxAttempts,
            "delay", delay,
            "error", err,
        )

        select {
        case <-ctx.Done():
            return zero, ctx.Err()
        case <-time.After(delay):
        }
    }
    return zero, fmt.Errorf("max retries exceeded: %w", lastErr)
}

func calculateDelay(attempt int, base, max time.Duration) time.Duration {
    expDelay := base * time.Duration(1<<uint(attempt))
    if expDelay > max {
        expDelay = max
    }
    // Full jitter
    return time.Duration(rand.Int63n(int64(expDelay)))
}
```

---

## 4. Python Implementation

```python
import asyncio, random
from typing import TypeVar, Callable, Awaitable

T = TypeVar("T")

async def with_retry(
    fn: Callable[[], Awaitable[T]],
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    retryable: Callable[[Exception], bool] | None = None,
) -> T:
    last_error: Exception | None = None

    for attempt in range(max_attempts):
        try:
            return await fn()
        except Exception as e:
            last_error = e

            if not _is_retryable(e, retryable):
                raise

            if attempt == max_attempts - 1:
                break

            exp_delay = base_delay * (2 ** attempt)
            delay = random.uniform(0, min(exp_delay, max_delay))
            logger.warning("Retrying", extra={
                "attempt": attempt + 1, "delay": f"{delay:.1f}s",
            })
            await asyncio.sleep(delay)

    raise last_error
```

---

## 5. Retry Budget

```typescript
// Prevent retry storms — limit total retry rate across the service
class RetryBudget {
  private requests = 0;
  private retries = 0;
  private windowStart = Date.now();
  private windowMs = 10_000; // 10-second window

  canRetry(): boolean {
    this.resetWindowIfNeeded();

    // Allow retries up to 20% of total request volume
    const retryRatio = this.requests > 0 ? this.retries / this.requests : 0;
    return retryRatio < 0.2; // Max 20% of traffic can be retries
  }

  recordRequest(): void { this.requests++; }
  recordRetry(): void { this.retries++; }

  private resetWindowIfNeeded(): void {
    if (Date.now() - this.windowStart > this.windowMs) {
      this.requests = 0;
      this.retries = 0;
      this.windowStart = Date.now();
    }
  }
}
```

- ALWAYS use retry budgets to prevent retry storms
- ALWAYS limit retries to 20% of total request volume
- ALWAYS use circuit breakers alongside retries (circuit opens before retry storm)

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Retry without backoff | Overwhelm recovering service | Exponential backoff + jitter |
| No jitter | All clients retry simultaneously (thundering herd) | Full jitter randomization |
| Retry non-retryable errors | Wasted requests, no resolution | Classify errors before retry |
| No max retry count | Infinite retry loop | Cap at 3-5 attempts |
| Ignore Retry-After header | Continue hammering rate-limited API | Respect Retry-After |
| Retry at every layer | Multiplicative retries (3 × 3 = 9) | Retry only at outermost layer |
| No retry budget | 100% retry traffic during outage | Limit retries to 20% of volume |
| No timeout per attempt | Stuck waiting forever | Timeout per individual attempt |

---

## 7. Enforcement Checklist

- [ ] Exponential backoff with full jitter used for all retries
- [ ] Maximum retry count set (3-5 attempts)
- [ ] Maximum delay cap set (30 seconds)
- [ ] Errors classified as retryable/non-retryable before retry
- [ ] Retry-After headers respected
- [ ] Retry budget prevents retry storms (max 20% retry traffic)
- [ ] Retries happen at outermost layer only (not multiplicative)
- [ ] Per-attempt timeout configured
- [ ] Retry attempts logged with attempt number and delay
