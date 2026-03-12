# Bulkhead Pattern

| Field          | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | Scalability > Patterns                                               |
| Importance     | High                                                                 |
| Last Updated   | 2026-03-10                                                           |
| Cross-ref      | `06-backend/health-resilience/resilience-patterns/load-management.md`|

> **Scalability Focus**: This document covers bulkheads as **resource isolation boundaries**
> that prevent a single saturated dependency from consuming all system capacity.
> For general load management concepts, see the cross-referenced file.

---

## 1. Core Concepts

### 1.1 Isolation Strategies

| Strategy              | Mechanism                        | Overhead   | Isolation Strength |
|-----------------------|----------------------------------|------------|--------------------|
| Thread pool isolation | Dedicated thread pools per dep   | High       | Strong             |
| Semaphore isolation   | Counting semaphore per dep       | Low        | Moderate           |
| Process isolation     | Separate OS processes per dep    | Very high  | Very strong        |
| Container isolation   | Separate pods/containers per dep | High       | Strong             |

### 1.2 Thread Pool vs Semaphore Isolation

**Thread pool isolation**: Assign a fixed-size thread pool to each dependency. When the pool
is exhausted, new requests to that dependency are rejected immediately. Other dependencies
remain unaffected because they use separate pools.

**Semaphore isolation**: Use a counting semaphore to limit concurrent requests to a dependency.
The request runs on the caller's thread, reducing context-switch overhead. Use this when
latency overhead from thread handoff is unacceptable.

### 1.3 Scalability Impact

- Contain blast radius: a slow database query cannot starve the HTTP handler pool.
- Enable independent scaling: monitor each bulkhead's utilization to scale specific dependencies.
- Provide capacity visibility: bulkhead saturation metrics reveal bottlenecks before they cascade.
- Support multi-tenant isolation: allocate separate bulkheads per tenant tier.

---

## 2. Code Examples

### 2.1 TypeScript -- Bulkhead with Separate Pools

```typescript
interface BulkheadConfig {
  maxConcurrent: number;
  maxQueue: number;
  queueTimeoutMs: number;
}

class Bulkhead {
  private active = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(
    private readonly name: string,
    private readonly config: BulkheadConfig
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.config.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }

    if (this.queue.length >= this.config.maxQueue) {
      return Promise.reject(
        new BulkheadFullError(this.name, this.active, this.queue.length)
      );
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((e) => e.resolve === resolve);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new BulkheadTimeoutError(this.name, this.config.queueTimeoutMs));
      }, this.config.queueTimeoutMs);

      this.queue.push({ resolve, reject, timer });
    });
  }

  private release(): void {
    this.active--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      clearTimeout(next.timer);
      this.active++;
      next.resolve();
    }
  }

  getMetrics(): { active: number; queued: number; name: string } {
    return { active: this.active, queued: this.queue.length, name: this.name };
  }
}

// Usage: one bulkhead per dependency
const bulkheads = {
  database: new Bulkhead("database", { maxConcurrent: 20, maxQueue: 50, queueTimeoutMs: 5000 }),
  paymentApi: new Bulkhead("payment-api", { maxConcurrent: 10, maxQueue: 20, queueTimeoutMs: 3000 }),
  cacheLayer: new Bulkhead("cache", { maxConcurrent: 50, maxQueue: 100, queueTimeoutMs: 1000 }),
};

async function processOrder(orderId: string): Promise<Order> {
  const [inventory, price] = await Promise.all([
    bulkheads.database.execute(() => db.getInventory(orderId)),
    bulkheads.cacheLayer.execute(() => cache.getPrice(orderId)),
  ]);
  return bulkheads.paymentApi.execute(() => payment.charge(inventory, price));
}
```

### 2.2 Go -- Goroutine Pool with Channel Semaphore

```go
package bulkhead

import (
    "context"
    "errors"
    "fmt"
    "sync/atomic"
)

var (
    ErrBulkheadFull    = errors.New("bulkhead: max concurrency reached")
    ErrBulkheadTimeout = errors.New("bulkhead: queue timeout exceeded")
)

type Bulkhead struct {
    name      string
    semaphore chan struct{}
    active    atomic.Int64
    rejected  atomic.Int64
}

func New(name string, maxConcurrent int) *Bulkhead {
    return &Bulkhead{
        name:      name,
        semaphore: make(chan struct{}, maxConcurrent),
    }
}

func (b *Bulkhead) Execute(ctx context.Context, fn func(context.Context) error) error {
    select {
    case b.semaphore <- struct{}{}:
        b.active.Add(1)
        defer func() {
            <-b.semaphore
            b.active.Add(-1)
        }()
        return fn(ctx)
    case <-ctx.Done():
        b.rejected.Add(1)
        return fmt.Errorf("%w: %s (%v)", ErrBulkheadTimeout, b.name, ctx.Err())
    default:
        b.rejected.Add(1)
        return fmt.Errorf("%w: %s (active=%d)", ErrBulkheadFull, b.name, b.active.Load())
    }
}

func (b *Bulkhead) Stats() (active, rejected int64) {
    return b.active.Load(), b.rejected.Load()
}
```

### 2.3 Kubernetes -- Resource Quotas as Infrastructure Bulkheads

```yaml
# Namespace-level bulkhead: isolate payment workloads
apiVersion: v1
kind: ResourceQuota
metadata:
  name: payment-service-quota
  namespace: payment
spec:
  hard:
    requests.cpu: "8"
    requests.memory: "16Gi"
    limits.cpu: "16"
    limits.memory: "32Gi"
    pods: "40"
    services: "10"
---
# LimitRange: per-pod guardrails within the bulkhead
apiVersion: v1
kind: LimitRange
metadata:
  name: payment-pod-limits
  namespace: payment
spec:
  limits:
    - type: Container
      default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "250m"
        memory: "256Mi"
      max:
        cpu: "2"
        memory: "2Gi"
```

### 2.4 Istio -- Service Mesh Bulkhead Configuration

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: inventory-bulkhead
spec:
  host: inventory-service.prod.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 50          # Max TCP connections (bulkhead boundary)
        connectTimeout: 2s
      http:
        http1MaxPendingRequests: 25  # Queue size before rejection
        http2MaxRequests: 100        # Max concurrent HTTP/2 requests
        maxRequestsPerConnection: 20
```

---

## 3. Sizing Bulkheads

Calculate bulkhead capacity from dependency SLOs:

```
maxConcurrent = (target_throughput_rps * p99_latency_seconds) * safety_factor
```

Example: dependency handles 200 RPS with p99 of 100ms, safety factor 1.5:

```
maxConcurrent = (200 * 0.1) * 1.5 = 30
```

Set the queue size to 1-2x `maxConcurrent` for burst absorption. Set queue timeout to
the caller's SLO minus the dependency's expected latency.

---

## 4. Best Practices

1. **Create one bulkhead per external dependency** -- never share a concurrency limiter across unrelated services.
2. **Size from measured latency percentiles** -- use p99, not average latency, to calculate pool sizes.
3. **Expose saturation metrics** -- emit `bulkhead_active`, `bulkhead_queued`, and `bulkhead_rejected` counters.
4. **Set queue timeouts shorter than caller SLOs** -- waiting in a bulkhead queue must not violate upstream deadlines.
5. **Use semaphore isolation for latency-sensitive paths** -- avoid the thread handoff overhead of pool isolation.
6. **Layer infrastructure and application bulkheads** -- combine Kubernetes resource quotas with in-process semaphores.
7. **Alert on sustained high utilization** -- fire alerts when bulkhead utilization exceeds 80% for 5+ minutes.
8. **Test with dependency slowdowns** -- inject latency into a dependency and verify the bulkhead contains the impact.
9. **Implement per-tenant bulkheads for multi-tenant systems** -- prevent noisy-neighbor effects across tenant boundaries.
10. **Review and resize bulkheads quarterly** -- traffic patterns shift; bulkhead sizes must follow.

---

## 5. Anti-Patterns

| #  | Anti-Pattern                           | Problem                                                    | Correction                                                 |
|----|----------------------------------------|------------------------------------------------------------|------------------------------------------------------------|
| 1  | Single shared connection pool          | One slow dependency exhausts connections for all callers    | Allocate separate pools per dependency                     |
| 2  | Unbounded queue behind the bulkhead    | Queue grows without limit, consuming memory                | Set a max queue depth and reject when full                 |
| 3  | Oversized bulkheads                    | Pool is so large it provides no isolation                   | Size from p99 latency and target throughput                |
| 4  | No timeout on queued requests          | Requests wait indefinitely in the queue                     | Set queue timeout shorter than caller's SLO                |
| 5  | Using bulkheads without circuit breakers | Bulkhead fills up but keeps sending to a broken dependency | Combine bulkhead with circuit breaker per dependency       |
| 6  | Same bulkhead size for all environments | Dev/staging sizes match production                         | Scale bulkhead sizes proportionally to environment capacity|
| 7  | Ignoring bulkhead rejection metrics    | Rejections happen silently with no alerting                 | Alert on rejection rate exceeding baseline                 |
| 8  | Static bulkhead sizes with auto-scaling | Pod count scales but bulkhead size stays fixed per pod     | Recalculate per-pod bulkhead size based on total replicas  |

---

## 6. Enforcement Checklist

- [ ] Every external dependency has a dedicated bulkhead (connection pool or semaphore).
- [ ] Bulkhead `maxConcurrent` is calculated from the dependency's p99 latency and target RPS.
- [ ] Queue depth limits are set and queue timeout is shorter than the caller's SLO.
- [ ] Bulkhead metrics (`active`, `queued`, `rejected`) are exported to the observability stack.
- [ ] Alerts fire when any bulkhead utilization exceeds 80% for more than 5 minutes.
- [ ] Kubernetes resource quotas enforce namespace-level isolation for critical workloads.
- [ ] Service mesh connection pool limits are configured for inter-service traffic.
- [ ] Load tests validate that a saturated bulkhead does not affect other dependencies.
- [ ] Multi-tenant systems use per-tenant bulkheads with separate capacity limits.
- [ ] Bulkhead configurations are documented and reviewed during capacity planning cycles.
