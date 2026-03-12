# Retry Strategies

> **AI Plugin Directive — Retry Strategies & Failure Recovery**
> You are an AI coding assistant. When generating, reviewing, or refactoring retry logic,
> follow EVERY rule in this document. Improper retry strategies cause cascading failures,
> thundering herds, and resource exhaustion. Treat each section as non-negotiable.

**Core Rule: ALWAYS use exponential backoff with jitter — NEVER use fixed-interval retries. ALWAYS set a maximum retry count. ALWAYS use a circuit breaker for external service calls. A retry without backoff is a DDoS attack on your own infrastructure.**

---

## 1. Retry Strategy Selection

```
┌──────────────────────────────────────────────────────────────┐
│                 Retry Strategy Decision                        │
│                                                               │
│  Is the failure transient?                                    │
│    │         │                                                │
│   YES        NO (permanent error)                             │
│    │         │                                                │
│    │       DO NOT RETRY                                       │
│    │       ├── 400 Bad Request                                │
│    │       ├── 401 Unauthorized                               │
│    │       ├── 403 Forbidden                                  │
│    │       ├── 404 Not Found                                  │
│    │       └── 422 Validation Error                           │
│    │                                                          │
│    ▼                                                          │
│  RETRY with exponential backoff + jitter                      │
│  ├── 429 Too Many Requests (respect Retry-After header)      │
│  ├── 500 Internal Server Error                                │
│  ├── 502 Bad Gateway                                          │
│  ├── 503 Service Unavailable                                  │
│  ├── 504 Gateway Timeout                                      │
│  ├── Connection refused / timeout                             │
│  └── DNS resolution failure                                   │
└──────────────────────────────────────────────────────────────┘
```

| Error Type | Retryable | Strategy | Max Retries |
|-----------|-----------|----------|-------------|
| Network timeout | YES | Exponential + jitter | 3-5 |
| Connection refused | YES | Exponential + jitter | 3-5 |
| 429 Rate limited | YES | Respect `Retry-After` | 3 |
| 500 Server error | YES | Exponential + jitter | 3-5 |
| 502/503/504 | YES | Exponential + jitter | 3-5 |
| 400 Bad request | NO | Fail immediately | 0 |
| 401/403 Auth | NO | Fail immediately | 0 |
| 404 Not found | NO | Fail immediately | 0 |
| 409 Conflict | MAYBE | Re-fetch + retry | 2-3 |
| Data validation | NO | Fail immediately | 0 |

ALWAYS classify errors into retryable and non-retryable before retrying. NEVER retry non-retryable errors — they will never succeed and waste resources.

---

## 2. Exponential Backoff with Jitter

### 2.1 Algorithm

```
Backoff Formula:
  delay = min(base_delay × 2^attempt + random_jitter, max_delay)

Example (base=1s, max=30s):
  Attempt 0: 1s  + jitter → ~1.2s
  Attempt 1: 2s  + jitter → ~2.7s
  Attempt 2: 4s  + jitter → ~4.1s
  Attempt 3: 8s  + jitter → ~9.3s
  Attempt 4: 16s + jitter → ~17.8s
  Attempt 5: 30s (capped) + jitter → ~30s

Jitter Types:
  Full Jitter:    random(0, base × 2^attempt)     ← PREFERRED
  Equal Jitter:   base × 2^attempt / 2 + random(0, base × 2^attempt / 2)
  Decorrelated:   random(base, previous_delay × 3)
```

ALWAYS use **Full Jitter** — it provides the best distribution and prevents thundering herd.

### 2.2 Implementation

**TypeScript**
```typescript
interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;      // milliseconds
  maxDelay: number;       // milliseconds
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_OPTIONS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (options.isRetryable && !options.isRetryable(error)) {
        throw error; // Non-retryable — fail immediately
      }

      // Last attempt — don't delay, just throw
      if (attempt === options.maxAttempts - 1) break;

      // Calculate delay with full jitter
      const exponentialDelay = options.baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * exponentialDelay;
      const delay = Math.min(jitter, options.maxDelay);

      options.onRetry?.(attempt + 1, error, delay);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Retryable error classifier
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors
    if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(
      (error as any).code)) {
      return true;
    }
  }

  // HTTP errors
  if (error instanceof HTTPError) {
    return [429, 500, 502, 503, 504].includes(error.statusCode);
  }

  return false;
}

// Usage
const result = await withRetry(
  () => fetch("https://api.example.com/data"),
  {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10_000,
    isRetryable: isRetryableError,
    onRetry: (attempt, error, delay) => {
      logger.warn(`Retry attempt ${attempt}, waiting ${delay}ms`, { error });
    },
  }
);
```

**Go**
```go
package retry

import (
    "context"
    "math"
    "math/rand"
    "time"
)

type Options struct {
    MaxAttempts int
    BaseDelay   time.Duration
    MaxDelay    time.Duration
    IsRetryable func(error) bool
    OnRetry     func(attempt int, err error, delay time.Duration)
}

var DefaultOptions = Options{
    MaxAttempts: 3,
    BaseDelay:   1 * time.Second,
    MaxDelay:    30 * time.Second,
}

func Do(ctx context.Context, fn func() error, opts Options) error {
    var lastErr error

    for attempt := 0; attempt < opts.MaxAttempts; attempt++ {
        lastErr = fn()
        if lastErr == nil {
            return nil
        }

        // Check if retryable
        if opts.IsRetryable != nil && !opts.IsRetryable(lastErr) {
            return lastErr
        }

        // Last attempt — don't delay
        if attempt == opts.MaxAttempts-1 {
            break
        }

        // Full jitter backoff
        exponential := float64(opts.BaseDelay) * math.Pow(2, float64(attempt))
        jitter := time.Duration(rand.Float64() * exponential)
        delay := min(jitter, opts.MaxDelay)

        if opts.OnRetry != nil {
            opts.OnRetry(attempt+1, lastErr, delay)
        }

        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(delay):
        }
    }

    return lastErr
}
```

**Python**
```python
import asyncio
import random
from typing import Callable, TypeVar

T = TypeVar("T")

async def with_retry(
    fn: Callable[[], T],
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    is_retryable: Callable[[Exception], bool] | None = None,
) -> T:
    last_error = None

    for attempt in range(max_attempts):
        try:
            return await fn()
        except Exception as e:
            last_error = e

            if is_retryable and not is_retryable(e):
                raise  # Non-retryable

            if attempt == max_attempts - 1:
                break

            # Full jitter
            exponential = base_delay * (2 ** attempt)
            delay = min(random.uniform(0, exponential), max_delay)
            await asyncio.sleep(delay)

    raise last_error
```

---

## 3. Circuit Breaker

ALWAYS use a circuit breaker for external service calls to prevent cascading failures:

```
┌──────────────────────────────────────────────────────────────┐
│                 Circuit Breaker States                         │
│                                                               │
│  ┌────────┐    failures ≥ threshold    ┌──────┐              │
│  │ CLOSED │ ─────────────────────────► │ OPEN │              │
│  │        │                            │      │              │
│  │ Normal │                            │ Fail │              │
│  │ traffic│    success rate recovered  │ fast │              │
│  │        │ ◄───────────────────────── │      │              │
│  └────────┘          ▲                 └──┬───┘              │
│                      │                    │                   │
│                      │         timeout    │                   │
│                      │         expires    │                   │
│                      │                    ▼                   │
│                      │              ┌───────────┐            │
│                      └───success────│ HALF-OPEN │            │
│                                     │           │            │
│                         failure ──► │ Test with │            │
│                         → OPEN      │ limited   │            │
│                                     │ traffic   │            │
│                                     └───────────┘            │
│                                                               │
│  CLOSED:    All requests pass through (normal operation)     │
│  OPEN:      All requests fail immediately (no external call) │
│  HALF-OPEN: Limited requests pass to test recovery           │
└──────────────────────────────────────────────────────────────┘
```

**TypeScript**
```typescript
interface CircuitBreakerOptions {
  failureThreshold: number;    // Failures before opening (default: 5)
  resetTimeout: number;        // Time in OPEN before half-open (default: 30s)
  halfOpenRequests: number;    // Test requests in half-open (default: 3)
  monitorWindow: number;       // Sliding window for failure count (default: 60s)
}

class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  constructor(private options: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 30_000,
    halfOpenRequests: 3,
    monitorWindow: 60_000,
  }) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = "half-open";
        this.halfOpenAttempts = 0;
      } else {
        throw new CircuitOpenError("Circuit breaker is OPEN");
      }
    }

    if (this.state === "half-open" &&
        this.halfOpenAttempts >= this.options.halfOpenRequests) {
      throw new CircuitOpenError("Circuit breaker is HALF-OPEN (limit reached)");
    }

    try {
      if (this.state === "half-open") this.halfOpenAttempts++;
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.options.halfOpenRequests) {
        this.state = "closed";
        this.successes = 0;
      }
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.options.failureThreshold) {
      this.state = "open";
    }
  }
}

// Usage with retry
const paymentCircuit = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 60_000 });

const result = await withRetry(
  () => paymentCircuit.execute(() => paymentService.charge(orderId)),
  { maxAttempts: 3, baseDelay: 1000, maxDelay: 10_000 }
);
```

---

## 4. Retry Budget

ALWAYS implement a retry budget to prevent retry amplification in distributed systems:

```
Retry Budget:
├── Allow retries for only X% of total requests
├── Example: 10% retry budget → max 10 retries per 100 requests
├── Prevents: cascading retries across service layers
└── When budget exhausted: fail immediately (no retry)

Without budget (retry amplification):
  Service A retries 3x → Service B retries 3x → Service C retries 3x
  Result: 1 user request → 27 calls to Service C (3³)

With budget (10%):
  Service A retries within budget → excess retries fail fast
  Result: Controlled retry volume, no amplification
```

```typescript
class RetryBudget {
  private requests = 0;
  private retries = 0;
  private windowStart = Date.now();

  constructor(
    private maxRetryRatio: number = 0.1,  // 10% budget
    private windowMs: number = 60_000      // 1 minute window
  ) {}

  canRetry(): boolean {
    this.resetWindowIfNeeded();
    if (this.requests === 0) return true;
    return this.retries / this.requests < this.maxRetryRatio;
  }

  recordRequest(): void {
    this.resetWindowIfNeeded();
    this.requests++;
  }

  recordRetry(): void {
    this.retries++;
  }

  private resetWindowIfNeeded(): void {
    if (Date.now() - this.windowStart > this.windowMs) {
      this.requests = 0;
      this.retries = 0;
      this.windowStart = Date.now();
    }
  }
}
```

---

## 5. Job Queue Retry Configuration

### 5.1 BullMQ

```typescript
const queue = new Queue("payments", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000, // Base delay: 2s → 4s → 8s → 16s → 32s
    },
  },
});

// Custom backoff per job
await queue.add("charge", { orderId: "123" }, {
  attempts: 3,
  backoff: {
    type: "custom",
  },
});

// Custom backoff strategy
const worker = new Worker("payments", handler, {
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Exponential with full jitter, capped at 60s
      const exponential = 2000 * Math.pow(2, attemptsMade);
      return Math.min(Math.random() * exponential, 60_000);
    },
  },
});
```

### 5.2 Per-Job Type Retry Config

| Job Type | Max Retries | Base Delay | Max Delay | Rationale |
|----------|------------|------------|-----------|-----------|
| Email send | 3 | 5s | 60s | Transient SMTP failures |
| Payment charge | 5 | 10s | 5 min | Payment gateway throttling |
| Webhook delivery | 8 | 30s | 1 hour | External endpoint downtime |
| Image processing | 2 | 5s | 30s | CPU/memory — likely OOM |
| Report generation | 2 | 60s | 5 min | Long-running, expensive |
| Analytics event | 1 | 1s | 5s | Non-critical, fire-and-forget |

---

## 6. Handling `Retry-After` Headers

ALWAYS respect the `Retry-After` header when the server tells you to back off:

```typescript
async function fetchWithRetryAfter(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url);

    if (response.status === 429 || response.status === 503) {
      const retryAfter = response.headers.get("Retry-After");
      let delay: number;

      if (retryAfter) {
        // Retry-After can be seconds or HTTP-date
        const parsed = parseInt(retryAfter, 10);
        if (!isNaN(parsed)) {
          delay = parsed * 1000; // seconds → ms
        } else {
          delay = new Date(retryAfter).getTime() - Date.now();
        }
      } else {
        delay = 1000 * Math.pow(2, attempt); // Fallback exponential
      }

      await new Promise((r) => setTimeout(r, Math.max(delay, 0)));
      continue;
    }

    return response;
  }

  throw new Error("Max retries exceeded");
}
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Fixed-interval retry | Thundering herd after outage | Exponential backoff with full jitter |
| No max retry limit | Infinite retry loops | ALWAYS set `maxAttempts` |
| Retrying non-retryable errors | Wasting resources on 400/404 | Classify errors, only retry transient |
| No circuit breaker | Cascading failures, blocked threads | Circuit breaker on external calls |
| Retry without jitter | All clients retry at same instant | ALWAYS add full jitter |
| Retrying at every layer | Retry amplification (3³ = 27 calls) | Retry budgets, retry only at edges |
| Ignoring Retry-After | Rate limited harder, banned | ALWAYS respect Retry-After header |
| Retrying synchronously in request | User waits for retry delays | Retry in background job, respond 202 |
| No retry metrics | Cannot detect retry storms | Track retry count, success rate |
| Same backoff for all jobs | Email and payment treated equally | Per-job-type retry configuration |

---

## 8. Enforcement Checklist

- [ ] Exponential backoff with full jitter used for ALL retries
- [ ] Maximum retry count configured per job type
- [ ] Errors classified as retryable vs non-retryable
- [ ] Non-retryable errors (400, 401, 403, 404, 422) fail immediately
- [ ] Circuit breaker wraps ALL external service calls
- [ ] Retry budget implemented to prevent retry amplification
- [ ] `Retry-After` header respected on 429/503 responses
- [ ] DLQ configured for jobs that exhaust all retries
- [ ] Retry metrics tracked (count, success rate, delays)
- [ ] Per-job-type retry configuration (not one-size-fits-all)
- [ ] Retries happen in background — NEVER block the request path
- [ ] Backoff delay capped at maximum (30s-60s typical)
