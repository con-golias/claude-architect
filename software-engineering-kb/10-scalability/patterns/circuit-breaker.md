# Circuit Breaker Pattern

| Field          | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Domain         | Scalability > Patterns                                                |
| Importance     | Critical                                                              |
| Last Updated   | 2026-03-10                                                            |
| Cross-ref      | `06-backend/health-resilience/resilience-patterns/circuit-breaker.md` |

> **Scalability Focus**: This document covers circuit breakers as a **scaling enabler** --
> preventing cascading failures that collapse entire clusters under load.
> For basic resilience concepts, see the cross-referenced file.

---

## 1. Core Concepts

### 1.1 State Machine

```
CLOSED ──(failure threshold exceeded)──► OPEN
   ▲                                       │
   │                                  (timeout expires)
   │                                       │
   └──(success threshold met)──◄ HALF-OPEN ◄┘
```

- **Closed**: Requests flow normally. Failures are counted in a sliding window.
- **Open**: All requests are rejected immediately. No load reaches the downstream service.
- **Half-Open**: A limited number of probe requests are allowed to test recovery.

### 1.2 Sliding Window Failure Detection

Use a **time-based sliding window** rather than a simple counter.
Track the failure rate over the last N seconds, not the last N requests.
This prevents a single burst of errors from triggering the breaker when overall
throughput is high and error rate is actually low.

### 1.3 Scalability Impact

- Prevent one failing dependency from consuming all connection pool threads.
- Stop retry storms that amplify load on degraded services by 10-100x.
- Enable fast-fail semantics so callers reclaim resources immediately.
- Protect shared infrastructure (databases, message brokers) from overload propagation.

---

## 2. Code Examples

### 2.1 TypeScript -- Sliding Window Circuit Breaker

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;      // e.g., 0.5 = 50% failure rate
  windowSizeMs: number;          // e.g., 60_000 = 60s sliding window
  openDurationMs: number;        // e.g., 30_000 = 30s open state
  halfOpenMaxRequests: number;   // e.g., 3 probe requests
  minimumRequests: number;       // minimum requests before evaluation
}

type CircuitState = "closed" | "open" | "half-open";

interface RequestOutcome {
  timestamp: number;
  success: boolean;
}

class SlidingWindowCircuitBreaker {
  private state: CircuitState = "closed";
  private outcomes: RequestOutcome[] = [];
  private openedAt = 0;
  private halfOpenSuccesses = 0;
  private halfOpenAttempts = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.name, this.remainingOpenTime());
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private canExecute(): boolean {
    switch (this.state) {
      case "closed":
        return true;
      case "open":
        if (Date.now() - this.openedAt >= this.config.openDurationMs) {
          this.transitionTo("half-open");
          return true;
        }
        return false;
      case "half-open":
        return this.halfOpenAttempts < this.config.halfOpenMaxRequests;
    }
  }

  private recordSuccess(): void {
    this.outcomes.push({ timestamp: Date.now(), success: true });
    if (this.state === "half-open") {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenMaxRequests) {
        this.transitionTo("closed");
      }
    }
    this.pruneWindow();
    this.evaluate();
  }

  private recordFailure(): void {
    this.outcomes.push({ timestamp: Date.now(), success: false });
    if (this.state === "half-open") {
      this.transitionTo("open");
      return;
    }
    this.pruneWindow();
    this.evaluate();
  }

  private evaluate(): void {
    if (this.state !== "closed") return;
    if (this.outcomes.length < this.config.minimumRequests) return;
    const failures = this.outcomes.filter((o) => !o.success).length;
    const rate = failures / this.outcomes.length;
    if (rate >= this.config.failureThreshold) {
      this.transitionTo("open");
    }
  }

  private pruneWindow(): void {
    const cutoff = Date.now() - this.config.windowSizeMs;
    this.outcomes = this.outcomes.filter((o) => o.timestamp > cutoff);
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    if (newState === "open") {
      this.openedAt = Date.now();
      this.halfOpenSuccesses = 0;
      this.halfOpenAttempts = 0;
    }
  }

  private remainingOpenTime(): number {
    return Math.max(0, this.config.openDurationMs - (Date.now() - this.openedAt));
  }
}
```

### 2.2 Go -- gRPC Circuit Breaker Middleware

```go
package circuitbreaker

import (
    "context"
    "sync"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
)

type State int

const (
    Closed   State = iota
    Open
    HalfOpen
)

type Breaker struct {
    mu               sync.Mutex
    state            State
    failures         int
    successes        int
    failureThreshold int
    successThreshold int
    openDuration     time.Duration
    openedAt         time.Time
}

func NewBreaker(failThresh, successThresh int, openDur time.Duration) *Breaker {
    return &Breaker{
        failureThreshold: failThresh,
        successThreshold: successThresh,
        openDuration:     openDur,
    }
}

func (b *Breaker) UnaryClientInterceptor() grpc.UnaryClientInterceptor {
    return func(
        ctx context.Context,
        method string,
        req, reply interface{},
        cc *grpc.ClientConn,
        invoker grpc.UnaryInvoker,
        opts ...grpc.CallOption,
    ) error {
        if !b.allow() {
            return status.Errorf(codes.Unavailable,
                "circuit breaker open for %s", method)
        }
        err := invoker(ctx, method, req, reply, cc, opts...)
        b.record(err == nil)
        return err
    }
}

func (b *Breaker) allow() bool {
    b.mu.Lock()
    defer b.mu.Unlock()
    switch b.state {
    case Closed:
        return true
    case Open:
        if time.Since(b.openedAt) >= b.openDuration {
            b.state = HalfOpen
            b.successes = 0
            return true
        }
        return false
    case HalfOpen:
        return true
    }
    return false
}

func (b *Breaker) record(success bool) {
    b.mu.Lock()
    defer b.mu.Unlock()
    if success {
        b.successes++
        if b.state == HalfOpen && b.successes >= b.successThreshold {
            b.state = Closed
            b.failures = 0
        }
        return
    }
    b.failures++
    if b.state == HalfOpen || b.failures >= b.failureThreshold {
        b.state = Open
        b.openedAt = time.Now()
        b.failures = 0
    }
}
```

### 2.3 Service Mesh -- Istio Circuit Breaking

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: payment-service-cb
spec:
  host: payment-service.prod.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 50
        http2MaxRequests: 200
        maxRequestsPerConnection: 10
        maxRetries: 3
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 30
```

---

## 3. Metrics and Alerting

Track these metrics per circuit breaker instance:

| Metric                          | Purpose                                      |
|---------------------------------|----------------------------------------------|
| `circuit_breaker_state`         | Current state gauge (0=closed, 1=open, 2=half-open) |
| `circuit_breaker_transitions`   | Counter of state transitions by type          |
| `circuit_breaker_rejected`      | Counter of rejected requests while open       |
| `circuit_breaker_failure_rate`  | Gauge of current sliding window failure rate  |
| `circuit_breaker_probe_result`  | Half-open probe success/failure counter       |

Alert when a breaker stays open for longer than 2x the `openDuration`.

---

## 4. Best Practices

1. **Set thresholds from SLO data** -- derive failure thresholds from actual service SLOs, not arbitrary percentages.
2. **Use sliding time windows** -- count-based windows are misleading under variable throughput.
3. **Require minimum request volume** -- do not trip the breaker on 2 out of 3 failures during low traffic.
4. **Emit state-change events** -- publish breaker transitions to observability pipelines for correlation.
5. **Scope breakers per dependency endpoint** -- a single breaker for an entire service hides per-endpoint failures.
6. **Configure at the service mesh layer first** -- use Istio/Envoy outlier detection before adding application-level breakers.
7. **Propagate circuit state across instances** -- share breaker state in Redis or a gossip protocol for cluster-wide coordination.
8. **Return structured errors** -- include retry-after headers and the breaker name in rejection responses.
9. **Test breaker behavior under load** -- use chaos engineering to verify breakers trip correctly during saturation.
10. **Integrate with load balancers** -- remove tripped endpoints from load balancer pools to stop routing to known-bad instances.

---

## 5. Anti-Patterns

| #  | Anti-Pattern                        | Problem                                                   | Correction                                                |
|----|-------------------------------------|-----------------------------------------------------------|-----------------------------------------------------------|
| 1  | Single global breaker               | One failing dependency opens the breaker for all calls     | Use per-dependency or per-endpoint breakers               |
| 2  | No minimum request threshold        | Low-traffic services trip on 1-2 errors                    | Require N minimum requests before evaluating failure rate |
| 3  | Fixed retry after open              | Thundering herd when breaker closes                        | Add jitter to the open-to-half-open transition            |
| 4  | Ignoring timeout errors             | Timeouts are not counted as failures                       | Count timeouts as failures in the sliding window          |
| 5  | No fallback on open                 | Callers receive raw errors with no alternative             | Provide cached or default responses when breaker is open  |
| 6  | Breaker inside retry loop           | Each retry attempt triggers a separate breaker evaluation  | Place breaker outside the retry wrapper                   |
| 7  | Same settings for all environments  | Production thresholds are too aggressive for staging        | Parameterize thresholds per environment                   |
| 8  | Never resetting failure counts      | Old failures from hours ago keep the breaker sensitive     | Use time-windowed counters that expire old data           |

---

## 6. Enforcement Checklist

- [ ] Every external dependency call is wrapped in a circuit breaker.
- [ ] Sliding window duration is configured per dependency based on its SLO.
- [ ] Minimum request volume is set to prevent low-traffic false positives.
- [ ] Circuit breaker state metrics are exported to Prometheus/Datadog.
- [ ] Alerts fire when any breaker remains open beyond 2x open duration.
- [ ] Half-open probe count is limited to prevent hammering a recovering service.
- [ ] Fallback responses are defined for every breaker-protected call.
- [ ] Chaos tests validate breaker trips under simulated failure conditions.
- [ ] Service mesh outlier detection is configured for all inter-service traffic.
- [ ] Circuit breaker configurations are version-controlled and reviewed in PRs.
