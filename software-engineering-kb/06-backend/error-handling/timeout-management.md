# Timeout Management

> **AI Plugin Directive — Timeout Configuration, Propagation & Budget Management**
> You are an AI coding assistant. When generating, reviewing, or refactoring timeout logic,
> follow EVERY rule in this document. Missing or incorrect timeouts cause cascading failures,
> resource exhaustion, and system-wide outages. Treat each section as non-negotiable.

**Core Rule: ALWAYS set explicit timeouts on every external call (HTTP, database, cache, gRPC). ALWAYS propagate deadline context across service boundaries. ALWAYS use timeout budgets to prevent cascading delays. NEVER use infinite or excessively long default timeouts.**

---

## 1. Timeout Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Timeout Layers                                    │
│                                                               │
│  Client request (30s total budget)                           │
│  ├── Load balancer timeout: 60s                              │
│  ├── API gateway timeout: 30s                                │
│  ├── Application handler timeout: 25s                        │
│  │   ├── Database query: 5s                                  │
│  │   ├── Cache lookup: 1s                                    │
│  │   ├── External API call: 10s                              │
│  │   └── Message publish: 2s                                 │
│  │                                                           │
│  Rule: Inner timeout < Outer timeout                         │
│  Rule: Sum of inner ≤ Outer (for sequential calls)          │
│  Rule: Budget = remaining time from parent context           │
│                                                               │
│  NEVER: Inner timeout > Outer timeout                        │
│  Result: Wasted work — parent already timed out              │
└──────────────────────────────────────────────────────────────┘
```

| Component | Recommended Timeout | Rationale |
|-----------|-------------------|-----------|
| **HTTP client call** | 5-15s | External APIs vary in latency |
| **Database query** | 3-5s | Slow query = problem to investigate |
| **Cache (Redis)** | 500ms-1s | Cache MUST be fast or skip |
| **gRPC call** | 5-10s | Deadline propagated via context |
| **Message publish** | 2-3s | Broker should accept fast |
| **DNS resolution** | 2s | Should resolve quickly |
| **TLS handshake** | 5s | Initial connection setup |
| **Connection pool acquire** | 1-3s | Pool exhaustion signal |
| **Total request** | 25-30s | User-facing request budget |

---

## 2. TypeScript Implementation

```typescript
// Per-request timeout budget
class TimeoutBudget {
  private readonly deadline: number;

  constructor(totalMs: number) {
    this.deadline = Date.now() + totalMs;
  }

  remaining(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  hasExpired(): boolean {
    return this.remaining() <= 0;
  }

  // Get timeout for a sub-operation (never exceeds remaining budget)
  forOperation(maxMs: number): number {
    return Math.min(maxMs, this.remaining());
  }
}

// Usage in request handler
async function processOrder(req: Request, res: Response) {
  const budget = new TimeoutBudget(25_000); // 25s total

  // Each operation gets the minimum of its own timeout and remaining budget
  const user = await withTimeout(
    () => userService.getById(req.userId),
    budget.forOperation(5_000),
  );

  if (budget.hasExpired()) throw new GatewayTimeoutError("Budget exhausted after user fetch");

  const inventory = await withTimeout(
    () => inventoryService.check(req.body.items),
    budget.forOperation(5_000),
  );

  if (budget.hasExpired()) throw new GatewayTimeoutError("Budget exhausted after inventory check");

  const payment = await withTimeout(
    () => paymentService.charge(user, req.body.amount),
    budget.forOperation(10_000),
  );

  res.json({ orderId: payment.orderId });
}

// Generic timeout wrapper
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) throw new GatewayTimeoutError("No time remaining");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fn();
  } finally {
    clearTimeout(timer);
  }
}
```

---

## 3. Go Implementation

```go
// Go: context.WithTimeout propagates deadlines automatically

func ProcessOrder(w http.ResponseWriter, r *http.Request) {
    // Set total request budget
    ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
    defer cancel()

    // Each sub-call inherits the parent deadline
    user, err := getUserWithTimeout(ctx, userID, 5*time.Second)
    if err != nil {
        handleError(w, r, err)
        return
    }

    inventory, err := checkInventoryWithTimeout(ctx, items, 5*time.Second)
    if err != nil {
        handleError(w, r, err)
        return
    }

    payment, err := chargePaymentWithTimeout(ctx, user, amount, 10*time.Second)
    if err != nil {
        handleError(w, r, err)
        return
    }

    writeJSON(w, http.StatusOK, payment)
}

// Sub-operation with minimum of own timeout and remaining budget
func getUserWithTimeout(parent context.Context, id string, max time.Duration) (*User, error) {
    timeout := minDuration(max, remainingBudget(parent))
    if timeout <= 0 {
        return nil, fmt.Errorf("timeout budget exhausted")
    }

    ctx, cancel := context.WithTimeout(parent, timeout)
    defer cancel()

    user, err := userClient.GetByID(ctx, id)
    if err != nil {
        if errors.Is(err, context.DeadlineExceeded) {
            return nil, fmt.Errorf("user service timeout after %v: %w", timeout, err)
        }
        return nil, fmt.Errorf("get user: %w", err)
    }
    return user, nil
}

func remainingBudget(ctx context.Context) time.Duration {
    deadline, ok := ctx.Deadline()
    if !ok {
        return time.Duration(math.MaxInt64) // no deadline set
    }
    return time.Until(deadline)
}

func minDuration(a, b time.Duration) time.Duration {
    if a < b {
        return a
    }
    return b
}
```

---

## 4. Python Implementation

```python
import asyncio
from contextlib import asynccontextmanager

class TimeoutBudget:
    def __init__(self, total_seconds: float):
        self.deadline = asyncio.get_event_loop().time() + total_seconds

    def remaining(self) -> float:
        return max(0, self.deadline - asyncio.get_event_loop().time())

    def for_operation(self, max_seconds: float) -> float:
        return min(max_seconds, self.remaining())

    @property
    def expired(self) -> bool:
        return self.remaining() <= 0

async def with_timeout(coro, timeout_seconds: float):
    """Execute coroutine with timeout."""
    if timeout_seconds <= 0:
        raise GatewayTimeoutError("No time remaining")
    return await asyncio.wait_for(coro, timeout=timeout_seconds)

async def process_order(request: Request) -> OrderResponse:
    budget = TimeoutBudget(25.0)

    user = await with_timeout(
        user_service.get_by_id(request.user_id),
        budget.for_operation(5.0),
    )

    if budget.expired:
        raise GatewayTimeoutError("Budget exhausted")

    inventory = await with_timeout(
        inventory_service.check(request.items),
        budget.for_operation(5.0),
    )

    payment = await with_timeout(
        payment_service.charge(user, request.amount),
        budget.for_operation(10.0),
    )

    return OrderResponse(order_id=payment.order_id)
```

---

## 5. HTTP Client Timeout Configuration

```typescript
// ALWAYS configure ALL timeout dimensions
import axios from "axios";

const httpClient = axios.create({
  timeout: 10_000,              // Total request timeout
  // For granular control use AbortController
});

// Node.js http.Agent — connection-level timeouts
import { Agent } from "http";
const agent = new Agent({
  keepAlive: true,
  timeout: 5_000,                // Socket idle timeout
  maxSockets: 50,                // Connection pool limit
  maxFreeSockets: 10,
});

// fetch with AbortController
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
```

```go
// Go: configure every timeout dimension
client := &http.Client{
    Timeout: 10 * time.Second, // Total request timeout
    Transport: &http.Transport{
        DialContext: (&net.Dialer{
            Timeout:   5 * time.Second,  // TCP connection timeout
            KeepAlive: 30 * time.Second, // Keep-alive probe interval
        }).DialContext,
        TLSHandshakeTimeout:   5 * time.Second,
        ResponseHeaderTimeout: 5 * time.Second,   // Time to receive headers
        IdleConnTimeout:       90 * time.Second,   // Idle connection reap
        MaxIdleConns:          100,
        MaxIdleConnsPerHost:   10,
    },
}
```

---

## 6. Database & Cache Timeouts

```typescript
// Database — ALWAYS set query and connection timeouts
import { Pool } from "pg";

const pool = new Pool({
  connectionTimeoutMillis: 3_000,  // Wait for connection from pool
  query_timeout: 5_000,            // Per-query timeout
  statement_timeout: 5_000,        // PostgreSQL statement timeout
  idle_timeout: 10_000,            // Idle connection reap
  max: 20,                         // Pool size
});

// Redis — ALWAYS set connect and command timeouts
import Redis from "ioredis";

const redis = new Redis({
  connectTimeout: 2_000,
  commandTimeout: 1_000,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});
```

```go
// Go database timeouts
db, _ := sql.Open("postgres", dsn)
db.SetMaxOpenConns(20)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(30 * time.Minute)
db.SetConnMaxIdleTime(5 * time.Minute)

// Per-query timeout via context
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
rows, err := db.QueryContext(ctx, "SELECT ...")
```

```python
# Python database timeouts
import asyncpg

pool = await asyncpg.create_pool(
    dsn,
    min_size=5,
    max_size=20,
    command_timeout=5.0,      # Per-query timeout
    timeout=3.0,              # Connection acquire timeout
)

# Redis timeouts
import redis.asyncio as redis

r = redis.Redis(
    socket_connect_timeout=2.0,
    socket_timeout=1.0,
    retry_on_timeout=False,
)
```

---

## 7. Cascading Timeout Prevention

```
┌──────────────────────────────────────────────────────────────┐
│              Cascading Timeout Problem                         │
│                                                               │
│  Service A (30s timeout)                                     │
│  └── calls Service B (30s timeout)                           │
│      └── calls Service C (30s timeout)                       │
│          └── calls Database (30s timeout)                    │
│                                                               │
│  If DB is slow: C waits 30s, B waits 30s, A waits 30s       │
│  Total: 30s of wasted resources on EVERY layer               │
│                                                               │
│  FIX: Propagate deadline, shrink at each layer               │
│                                                               │
│  Service A (30s budget)                                      │
│  └── calls Service B (remaining: 28s, max: 15s)            │
│      └── calls Service C (remaining: 12s, max: 8s)         │
│          └── calls Database (remaining: 5s, max: 3s)       │
│                                                               │
│  Rule: ALWAYS pass deadline, not timeout duration            │
│  Rule: Each layer subtracts processing overhead              │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// Propagate deadline as header
async function callDownstreamService(url: string, budget: TimeoutBudget): Promise<Response> {
  const remaining = budget.remaining();
  if (remaining <= 0) throw new GatewayTimeoutError("Budget exhausted");

  return fetch(url, {
    headers: {
      "X-Request-Deadline": new Date(Date.now() + remaining).toISOString(),
      "X-Request-Timeout-Ms": String(Math.round(remaining)),
    },
    signal: AbortSignal.timeout(remaining),
  });
}

// Receiving service reads deadline
function extractBudget(req: Request): TimeoutBudget {
  const deadlineHeader = req.headers["x-request-deadline"];
  if (deadlineHeader) {
    const deadline = new Date(deadlineHeader as string).getTime();
    const remaining = deadline - Date.now();
    return new TimeoutBudget(Math.max(0, remaining));
  }
  return new TimeoutBudget(25_000); // default
}
```

```go
// Go: gRPC propagates deadlines automatically via context
// For HTTP: use headers
func PropagateDeadline(ctx context.Context, req *http.Request) {
    deadline, ok := ctx.Deadline()
    if ok {
        req.Header.Set("X-Request-Deadline", deadline.Format(time.RFC3339Nano))
        remaining := time.Until(deadline)
        req.Header.Set("X-Request-Timeout-Ms", strconv.FormatInt(remaining.Milliseconds(), 10))
    }
}

func ExtractDeadline(r *http.Request) (context.Context, context.CancelFunc) {
    if dl := r.Header.Get("X-Request-Deadline"); dl != "" {
        deadline, err := time.Parse(time.RFC3339Nano, dl)
        if err == nil {
            return context.WithDeadline(r.Context(), deadline)
        }
    }
    return context.WithTimeout(r.Context(), 25*time.Second)
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No timeout on external call | Thread/goroutine hangs forever | Explicit timeout on every call |
| Same timeout at every layer | Wasted work on timed-out requests | Deadline propagation, shrink per layer |
| Timeout > parent timeout | Child works after parent gave up | `min(own_timeout, remaining_budget)` |
| Default infinite timeout | Resource exhaustion under load | Always configure explicit timeout |
| Timeout without cancel | Resources leaked on timeout | Cancel/cleanup on timeout |
| No connection timeout | Stuck waiting for TCP connect | Separate connect vs request timeout |
| Retry without budget check | Retrying after budget expired | Check remaining budget before retry |
| No query timeout | Slow query blocks connection pool | Per-query timeout (3-5s) |

---

## 9. Enforcement Checklist

- [ ] Explicit timeout set on every HTTP client call
- [ ] Database query timeout configured (3-5s)
- [ ] Cache operations timeout configured (500ms-1s)
- [ ] Connection pool acquire timeout configured
- [ ] Timeout budget propagated across service boundaries
- [ ] Inner timeouts always less than outer timeouts
- [ ] Deadline headers propagated in HTTP calls
- [ ] gRPC context deadlines propagated automatically
- [ ] Timeout exceeded logged with operation name and duration
- [ ] Resources cleaned up (cancelled) on timeout
- [ ] Retry logic checks remaining budget before retrying
- [ ] Total request timeout configured at API gateway level
