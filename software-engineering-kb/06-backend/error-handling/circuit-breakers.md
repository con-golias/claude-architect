# Circuit Breakers

> **AI Plugin Directive — Circuit Breaker Pattern for External Dependencies**
> You are an AI coding assistant. When generating, reviewing, or refactoring circuit breaker
> code, follow EVERY rule in this document. Without circuit breakers, a single failing dependency
> cascades into system-wide outages. Treat each section as non-negotiable.

**Core Rule: ALWAYS wrap calls to external dependencies (APIs, databases, caches) with a circuit breaker. ALWAYS configure separate circuit breakers per dependency. ALWAYS provide a fallback when the circuit is open.**

---

## 1. Circuit Breaker States

```
┌──────────────────────────────────────────────────────────────┐
│              Circuit Breaker State Machine                     │
│                                                               │
│   ┌────────┐    failure threshold    ┌────────┐              │
│   │ CLOSED │ ──────────────────────► │  OPEN  │              │
│   │(normal)│                          │(reject)│              │
│   └───┬────┘ ◄──────────────────── └───┬────┘              │
│       │         success in half-open     │                    │
│       │                                   │ reset timeout     │
│       │                                   │ expires           │
│       │         ┌───────────┐            │                    │
│       │         │HALF-OPEN  │ ◄──────────┘                   │
│       │         │(test one) │                                 │
│       │         └─────┬─────┘                                 │
│       │               │                                       │
│       │     success → CLOSED                                 │
│       │     failure → OPEN                                   │
│                                                               │
│  CLOSED:    Requests pass through normally                   │
│  OPEN:      Requests immediately fail (no network call)      │
│  HALF-OPEN: ONE test request allowed — success closes,       │
│             failure reopens                                   │
└──────────────────────────────────────────────────────────────┘
```

| Parameter | Recommended | Purpose |
|-----------|-------------|---------|
| Failure threshold | 5 failures | Trips circuit to OPEN |
| Failure window | 60 seconds | Time window for counting failures |
| Reset timeout | 30 seconds | Time before HALF-OPEN test |
| Success threshold | 2 successes | Consecutive successes to close |
| Timeout per request | 3-5 seconds | Individual request timeout |

---

## 2. TypeScript Implementation

```typescript
enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface CircuitBreakerOptions {
  failureThreshold: number;   // Failures before opening
  resetTimeoutMs: number;     // Time before half-open
  successThreshold: number;   // Successes to close from half-open
  timeoutMs: number;          // Per-request timeout
  name: string;               // For logging/metrics
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  constructor(private opts: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.opts.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.info("Circuit half-open", { name: this.opts.name });
      } else {
        metrics.increment("circuit_breaker.rejected", { name: this.opts.name });
        if (fallback) return fallback();
        throw new Error(`Circuit breaker OPEN: ${this.opts.name}`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), this.opts.timeoutMs)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.opts.successThreshold) {
        this.state = CircuitState.CLOSED;
        logger.info("Circuit closed", { name: this.opts.name });
        metrics.increment("circuit_breaker.closed", { name: this.opts.name });
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      logger.warn("Circuit reopened from half-open", { name: this.opts.name });
    } else if (this.failureCount >= this.opts.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.warn("Circuit opened", {
        name: this.opts.name,
        failures: this.failureCount,
      });
      metrics.increment("circuit_breaker.opened", { name: this.opts.name });
    }
  }

  getState(): CircuitState { return this.state; }
}

// Usage — separate breaker per dependency
const paymentBreaker = new CircuitBreaker({
  name: "payment-service",
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
  timeoutMs: 5000,
});

async function chargePayment(orderId: string, amount: number): Promise<PaymentResult> {
  return paymentBreaker.execute(
    () => paymentService.charge(orderId, amount),
    () => ({ status: "pending", message: "Payment queued for retry" }), // Fallback
  );
}
```

---

## 3. Go Implementation

```go
import "github.com/sony/gobreaker/v2"

// Configure per-dependency circuit breaker
var paymentBreaker = gobreaker.NewCircuitBreaker[*PaymentResult](gobreaker.Settings{
    Name:        "payment-service",
    MaxRequests: 2,                          // Allowed in half-open
    Interval:    60 * time.Second,           // Failure count reset interval
    Timeout:     30 * time.Second,           // Time before half-open
    ReadyToTrip: func(counts gobreaker.Counts) bool {
        return counts.ConsecutiveFailures >= 5
    },
    OnStateChange: func(name string, from, to gobreaker.State) {
        slog.Warn("circuit breaker state change",
            "name", name, "from", from, "to", to)
        metrics.Set("circuit_breaker.state", float64(to),
            map[string]string{"name": name})
    },
})

func ChargePayment(ctx context.Context, orderID string, amount int64) (*PaymentResult, error) {
    result, err := paymentBreaker.Execute(func() (*PaymentResult, error) {
        ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
        defer cancel()
        return paymentClient.Charge(ctx, orderID, amount)
    })

    if errors.Is(err, gobreaker.ErrOpenState) {
        // Circuit is open — use fallback
        slog.Warn("payment circuit open, using fallback", "orderId", orderID)
        return &PaymentResult{Status: "pending"}, nil
    }
    return result, err
}
```

---

## 4. Python Implementation

```python
import pybreaker

payment_breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=30,
    name="payment-service",
    listeners=[CircuitBreakerMetricsListener()],
)

@payment_breaker
async def charge_payment(order_id: str, amount: int) -> PaymentResult:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(f"{PAYMENT_URL}/charge", json={
            "orderId": order_id, "amount": amount,
        })
        response.raise_for_status()
        return PaymentResult(**response.json())

# Usage with fallback
async def process_payment(order_id: str, amount: int) -> PaymentResult:
    try:
        return await charge_payment(order_id, amount)
    except pybreaker.CircuitBreakerError:
        logger.warning("Payment circuit open", extra={"orderId": order_id})
        return PaymentResult(status="pending")
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No circuit breaker on external calls | Cascading failures | Wrap every external dependency |
| Single breaker for all dependencies | One failure breaks everything | Separate breaker per dependency |
| No fallback on open circuit | Error returned to user | Provide degraded fallback |
| Too low failure threshold | Circuit trips on transient errors | Threshold 5+, consider error types |
| Too long reset timeout | Service stays degraded after recovery | 30s reset, not 5 minutes |
| No monitoring of circuit state | Unaware of open circuits | Track state changes as metrics |

---

## 6. Enforcement Checklist

- [ ] Circuit breaker wraps every external dependency call
- [ ] Separate circuit breaker instance per dependency
- [ ] Fallback provided when circuit is open
- [ ] Failure threshold: 5+ failures to open
- [ ] Reset timeout: 30 seconds to half-open
- [ ] Per-request timeout configured (3-5 seconds)
- [ ] Circuit state changes logged and tracked as metrics
- [ ] Health check endpoint reports circuit breaker states
