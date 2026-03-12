# Retry with Exponential Backoff

| Field          | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Domain         | Scalability > Patterns                                                |
| Importance     | High                                                                  |
| Last Updated   | 2026-03-10                                                            |
| Cross-ref      | `06-backend/health-resilience/resilience-patterns/circuit-breaker.md` |

> **Scalability Focus**: This document covers retry strategies as a **load amplification risk**
> and shows how to implement retries that scale safely. For basic retry and circuit breaker
> concepts, see the cross-referenced file.

---

## 1. Core Concepts

### 1.1 Backoff Strategies

| Strategy              | Formula                                    | Use Case                         |
|-----------------------|--------------------------------------------|----------------------------------|
| Fixed delay           | `delay = constant`                         | Simple, predictable timing       |
| Linear backoff        | `delay = attempt * base`                   | Gradual increase                 |
| Exponential backoff   | `delay = base * 2^attempt`                 | Standard distributed systems     |
| Full jitter           | `delay = random(0, base * 2^attempt)`      | Spread retry storms              |
| Decorrelated jitter   | `delay = random(base, prev_delay * 3)`     | Best thundering herd prevention  |

### 1.2 Decorrelated Jitter Algorithm

Decorrelated jitter produces the best spread across time compared to full or equal jitter.
Each retry delay is derived from the previous delay, not just the attempt number:

```
sleep = min(cap, random_between(base, prev_sleep * 3))
```

### 1.3 Retry Amplification Problem

In a chain of N services each retrying M times, the worst-case load on the
leaf service is `M^N`. Three services each retrying 3 times produce up to 27x
load on the downstream service. Retry budgets prevent this amplification.

### 1.4 Retry Budget

A retry budget limits the **percentage of total requests** that can be retries.
Set a cluster-wide budget (e.g., 10% of traffic can be retries). When the budget is
exhausted, no more retries are attempted regardless of individual retry policies.

### 1.5 Idempotency Requirements

Retries are only safe when the operation is **idempotent**. Use idempotency keys
for non-idempotent operations (POST requests, payment charges). Store the key
server-side and return the cached result for duplicate requests.

---

## 2. Code Examples

### 2.1 TypeScript -- Configurable Retry with Backoff Strategies

```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  strategy: "exponential" | "decorrelated" | "linear";
  retryableErrors?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

class RetryExecutor {
  private prevDelay: number;

  constructor(private readonly config: RetryConfig) {
    this.prevDelay = config.baseDelayMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (
          this.config.retryableErrors &&
          !this.config.retryableErrors(lastError)
        ) {
          throw lastError;
        }

        if (attempt === this.config.maxAttempts - 1) break;

        const delay = this.calculateDelay(attempt);
        this.config.onRetry?.(attempt + 1, lastError, delay);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.strategy) {
      case "exponential":
        // Full jitter: random between 0 and exponential cap
        delay = Math.random() * this.config.baseDelayMs * Math.pow(2, attempt);
        break;

      case "decorrelated":
        // Decorrelated jitter: random between base and 3x previous delay
        delay =
          this.config.baseDelayMs +
          Math.random() * (this.prevDelay * 3 - this.config.baseDelayMs);
        this.prevDelay = delay;
        break;

      case "linear":
        delay = this.config.baseDelayMs * (attempt + 1);
        break;
    }

    return Math.min(delay, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Retry budget: limit total retry percentage across all callers
class RetryBudget {
  private requests = 0;
  private retries = 0;
  private lastReset = Date.now();

  constructor(
    private readonly maxRetryRatio: number, // e.g., 0.1 for 10%
    private readonly windowMs: number = 60_000
  ) {}

  recordRequest(): void {
    this.maybeReset();
    this.requests++;
  }

  canRetry(): boolean {
    this.maybeReset();
    if (this.requests === 0) return true;
    return this.retries / this.requests < this.maxRetryRatio;
  }

  recordRetry(): void {
    this.retries++;
  }

  private maybeReset(): void {
    if (Date.now() - this.lastReset > this.windowMs) {
      this.requests = 0;
      this.retries = 0;
      this.lastReset = Date.now();
    }
  }
}

// Usage with retry budget
const budget = new RetryBudget(0.1); // Max 10% retries

async function callWithBudgetedRetry<T>(fn: () => Promise<T>): Promise<T> {
  budget.recordRequest();

  const executor = new RetryExecutor({
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    strategy: "decorrelated",
    retryableErrors: (err) => {
      if (!budget.canRetry()) return false; // Budget exhausted
      budget.recordRetry();
      return isTransientError(err);
    },
  });

  return executor.execute(fn);
}

function isTransientError(err: Error): boolean {
  const status = (err as any).statusCode;
  return status === 429 || status === 503 || status >= 500;
}
```

### 2.2 Go -- Retry with Context Cancellation and Deadline Propagation

```go
package retry

import (
    "context"
    "errors"
    "math"
    "math/rand"
    "time"
)

type Strategy int

const (
    Exponential Strategy = iota
    Decorrelated
)

type Config struct {
    MaxAttempts int
    BaseDelay   time.Duration
    MaxDelay    time.Duration
    Strategy    Strategy
}

type RetryableFunc func(ctx context.Context) error

func Do(ctx context.Context, cfg Config, fn RetryableFunc) error {
    prevDelay := cfg.BaseDelay

    for attempt := 0; attempt < cfg.MaxAttempts; attempt++ {
        err := fn(ctx)
        if err == nil {
            return nil
        }
        if !isRetryable(err) {
            return err
        }
        if attempt == cfg.MaxAttempts-1 {
            return err
        }

        delay := calculateDelay(cfg, attempt, prevDelay)
        prevDelay = delay

        // Respect context deadline: do not retry if deadline is closer
        // than the next delay
        deadline, hasDeadline := ctx.Deadline()
        if hasDeadline && time.Until(deadline) < delay {
            return fmt.Errorf("retry aborted: context deadline too close: %w", err)
        }

        select {
        case <-time.After(delay):
            continue
        case <-ctx.Done():
            return ctx.Err()
        }
    }
    return errors.New("retry: max attempts exceeded")
}

func calculateDelay(cfg Config, attempt int, prevDelay time.Duration) time.Duration {
    var delay time.Duration

    switch cfg.Strategy {
    case Exponential:
        exp := math.Pow(2, float64(attempt))
        jitter := rand.Float64() * float64(cfg.BaseDelay) * exp
        delay = time.Duration(jitter)

    case Decorrelated:
        low := float64(cfg.BaseDelay)
        high := float64(prevDelay) * 3
        delay = time.Duration(low + rand.Float64()*(high-low))
    }

    if delay > cfg.MaxDelay {
        delay = cfg.MaxDelay
    }
    return delay
}

// isRetryable determines if an error should be retried.
// Implement domain-specific logic here.
func isRetryable(err error) bool {
    var retryErr interface{ IsRetryable() bool }
    if errors.As(err, &retryErr) {
        return retryErr.IsRetryable()
    }
    return false
}
```

### 2.3 Idempotency Key Pattern

```typescript
// Server-side idempotency for safe retries of non-idempotent operations
interface IdempotencyStore {
  get(key: string): Promise<StoredResult | null>;
  set(key: string, result: StoredResult, ttlMs: number): Promise<void>;
  lock(key: string, ttlMs: number): Promise<boolean>;
  unlock(key: string): Promise<void>;
}

interface StoredResult {
  statusCode: number;
  body: unknown;
  completedAt: number;
}

async function withIdempotency<T>(
  idempotencyKey: string,
  store: IdempotencyStore,
  operation: () => Promise<{ statusCode: number; body: T }>
): Promise<{ statusCode: number; body: T }> {
  // Return cached result if already processed
  const existing = await store.get(idempotencyKey);
  if (existing) return existing as { statusCode: number; body: T };

  // Acquire lock to prevent concurrent duplicate execution
  const locked = await store.lock(idempotencyKey, 30_000);
  if (!locked) {
    throw new ConflictError("Request already in progress");
  }

  try {
    const result = await operation();
    await store.set(idempotencyKey, {
      statusCode: result.statusCode,
      body: result.body,
      completedAt: Date.now(),
    }, 24 * 60 * 60 * 1000); // 24h TTL
    return result;
  } finally {
    await store.unlock(idempotencyKey);
  }
}
```

---

## 3. Best Practices

1. **Use decorrelated jitter by default** -- it provides the best thundering herd prevention.
2. **Implement retry budgets at the service level** -- cap total retries to 10-20% of traffic.
3. **Respect context deadlines** -- do not retry if the remaining deadline is shorter than the backoff delay.
4. **Only retry transient errors** -- 400 Bad Request should never be retried; 429 and 503 should.
5. **Require idempotency keys for non-idempotent operations** -- POST/PUT requests must be safe to replay.
6. **Log every retry with attempt number and delay** -- enable debugging of retry storms in production.
7. **Set maxDelay caps** -- prevent exponential backoff from producing minute-long delays.
8. **Combine retries with circuit breakers** -- place the circuit breaker outside the retry loop.
9. **Propagate retry metadata in headers** -- include `X-Retry-Attempt` so downstream services can detect retries.
10. **Monitor retry ratio as a system health signal** -- a rising retry ratio is an early warning of degradation.

---

## 4. Anti-Patterns

| #  | Anti-Pattern                           | Problem                                                    | Correction                                                |
|----|----------------------------------------|------------------------------------------------------------|-----------------------------------------------------------|
| 1  | Retrying without jitter                | All clients retry at the same time, creating thundering herd | Add randomized jitter to every backoff calculation        |
| 2  | Unlimited retries                      | Infinite retry loops consume resources forever              | Set maxAttempts and maxDelay caps                         |
| 3  | Retrying non-idempotent operations     | Duplicate charges, duplicate database inserts               | Require idempotency keys for non-idempotent calls         |
| 4  | Retrying 4xx client errors             | Client errors will never succeed on retry                   | Only retry 429, 503, 5xx, and network timeouts            |
| 5  | No retry budget                        | Each service retries independently, causing M^N amplification | Implement per-service retry budgets (10-20% of traffic)  |
| 6  | Retrying inside circuit breaker        | Retries prevent circuit breaker from detecting failure rate | Place circuit breaker outside the retry wrapper           |
| 7  | Ignoring Retry-After headers           | Client retries before the server is ready                   | Parse and respect Retry-After in retry delay calculation  |
| 8  | Same retry config for all dependencies | Fast cache gets same retry policy as slow database queries  | Tune retry config per dependency SLA                      |

---

## 5. Enforcement Checklist

- [ ] All retry implementations use jitter (decorrelated or full jitter).
- [ ] Maximum attempt count is capped at 3-5 for synchronous calls.
- [ ] Maximum delay is capped to prevent unreasonable wait times.
- [ ] Retry budgets are configured at the service level (10-20% max).
- [ ] Context deadlines are checked before each retry attempt.
- [ ] Non-idempotent operations require idempotency keys.
- [ ] Only transient errors (429, 503, 5xx, timeouts) trigger retries.
- [ ] Retry-After headers from servers are respected.
- [ ] Retry attempt count is logged and metered per dependency.
- [ ] Circuit breakers wrap retry logic, not the other way around.
