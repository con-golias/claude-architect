# Stability Patterns

> **AI Plugin Directive — Bulkhead, Fallback, Hedged Requests & Isolation Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring resilience
> patterns, follow EVERY rule in this document. Without stability patterns, a single failing
> component cascades into system-wide outages. Treat each section as non-negotiable.

**Core Rule: ALWAYS isolate failures to the failing component. ALWAYS provide fallback behavior. ALWAYS limit the blast radius of any single failure. ALWAYS combine multiple resilience patterns — no single pattern is sufficient alone.**

---

## 1. Resilience Pattern Stack

```
┌──────────────────────────────────────────────────────────────┐
│              Resilience Pattern Stack (Apply All)             │
│                                                               │
│  Request arrives                                             │
│  ├── 1. TIMEOUT — prevent indefinite waiting                │
│  ├── 2. RETRY — recover from transient failures             │
│  ├── 3. CIRCUIT BREAKER — stop calling failing services     │
│  ├── 4. BULKHEAD — isolate resource pools                   │
│  ├── 5. FALLBACK — provide degraded response                │
│  └── 6. HEDGED REQUEST — race redundant calls               │
│                                                               │
│  Order matters:                                              │
│  Bulkhead → Circuit Breaker → Retry → Timeout → Fallback   │
│                                                               │
│  Each layer protects against a different failure mode        │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Bulkhead Pattern

```typescript
class Bulkhead {
  private active = 0;
  private queue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  constructor(
    private name: string,
    private maxConcurrent: number,
    private maxQueue: number,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        metrics.increment("bulkhead.rejected", { name: this.name });
        throw new Error(`Bulkhead ${this.name}: queue full`);
      }
      await new Promise<void>((resolve, reject) => {
        this.queue.push({ resolve, reject });
      });
    }

    this.active++;
    metrics.gauge("bulkhead.active", this.active, { name: this.name });
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) this.queue.shift()!.resolve();
    }
  }
}

// Separate bulkhead per dependency
const bulkheads = {
  payment: new Bulkhead("payment", 10, 5),
  inventory: new Bulkhead("inventory", 20, 10),
  recommendation: new Bulkhead("recommendation", 5, 20),
};
```

```go
type Bulkhead struct {
    name string
    sem  *semaphore.Weighted
}

func NewBulkhead(name string, max int64) *Bulkhead {
    return &Bulkhead{name: name, sem: semaphore.NewWeighted(max)}
}

func (b *Bulkhead) Execute(ctx context.Context, fn func() error) error {
    if !b.sem.TryAcquire(1) {
        metrics.Increment("bulkhead.rejected", map[string]string{"name": b.name})
        return fmt.Errorf("bulkhead %s: at capacity", b.name)
    }
    defer b.sem.Release(1)
    return fn()
}
```

---

## 3. Hedged Requests

```typescript
// Send duplicate request after a delay — use first response
// ONLY for idempotent reads — NEVER for writes
async function hedgedRequest<T>(
  fn: () => Promise<T>,
  hedgeDelayMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let failures = 0;

    function attempt() {
      fn().then(
        (result) => {
          if (!settled) { settled = true; resolve(result); }
        },
        (err) => {
          failures++;
          if (failures >= 2 && !settled) { settled = true; reject(err); }
        },
      );
    }

    attempt(); // Primary
    setTimeout(() => {
      if (!settled) {
        metrics.increment("hedged_request.triggered");
        attempt(); // Hedge
      }
    }, hedgeDelayMs);
  });
}
```

```go
func HedgedRequest[T any](ctx context.Context, fn func(context.Context) (T, error), delay time.Duration) (T, error) {
    ctx, cancel := context.WithCancel(ctx)
    defer cancel()

    type result struct { val T; err error }
    ch := make(chan result, 2)

    go func() {
        val, err := fn(ctx)
        ch <- result{val, err}
    }()

    select {
    case r := <-ch:
        return r.val, r.err
    case <-time.After(delay):
        go func() { val, err := fn(ctx); ch <- result{val, err} }()
    }

    r := <-ch
    return r.val, r.err
}
```

- ALWAYS set hedge delay to p50 or p75 latency
- NEVER hedge write operations (idempotent reads only)

---

## 4. Combined Resilience Wrapper

```typescript
class ResilientClient {
  constructor(
    private circuitBreaker: CircuitBreaker,
    private bulkhead: Bulkhead,
    private retryOpts: RetryOptions,
    private timeoutMs: number,
  ) {}

  async call<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    return this.bulkhead.execute(async () => {
      return this.circuitBreaker.execute(
        async () => withRetry(
          async () => withTimeout(fn, this.timeoutMs),
          this.retryOpts,
        ),
        fallback,
      );
    });
  }
}

const paymentClient = new ResilientClient(
  paymentBreaker, paymentBulkhead,
  { maxAttempts: 3, baseDelay: 1000, maxDelay: 10000 },
  5000,
);
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Single resilience pattern | Fails under specific conditions | Combine all patterns |
| No bulkhead isolation | One slow service exhausts all connections | Separate pools per dependency |
| Hedging writes | Duplicate data, corruption | Only hedge idempotent reads |
| Same config for all services | Under/over-protection | Tune per dependency SLA |
| No fallback | Error when everything fails | Always return degraded response |
| Retry inside open circuit | Wasted retries | Circuit breaker wraps retry |

---

## 6. Enforcement Checklist

- [ ] Every external call wrapped with timeout + retry + circuit breaker
- [ ] Bulkhead isolates resource pools per dependency
- [ ] Fallback returns degraded response when all retries fail
- [ ] Hedged requests used for latency-sensitive reads only
- [ ] Pattern order: Bulkhead → Circuit Breaker → Retry → Timeout
- [ ] Each pattern configured per dependency (not global)
- [ ] Resilience metrics tracked per pattern per dependency
- [ ] Hedged requests only for idempotent operations
