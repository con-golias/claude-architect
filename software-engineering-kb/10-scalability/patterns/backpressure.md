# Backpressure Mechanisms

| Field          | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | Scalability > Patterns                                               |
| Importance     | Critical                                                             |
| Last Updated   | 2026-03-10                                                           |
| Cross-ref      | `06-backend/health-resilience/resilience-patterns/load-management.md`|

> **Scalability Focus**: This document covers backpressure as a **flow control mechanism**
> that enables systems to scale without overwhelming downstream components.
> For general load management, see the cross-referenced file.

---

## 1. Core Concepts

### 1.1 Pull-Based vs Push-Based Flow Control

| Model       | Mechanism                                  | Scalability Behavior                     |
|-------------|--------------------------------------------|------------------------------------------|
| Push-based  | Producer sends at its own rate             | Consumer overwhelmed under load spikes   |
| Pull-based  | Consumer requests items when ready         | Natural rate limiting, no overflow       |
| Hybrid      | Push with credits/tokens granted by consumer | Balance between throughput and safety  |

### 1.2 Backpressure Signals

- **TCP receive window**: OS-level flow control reducing sender rate.
- **HTTP 429 Too Many Requests**: Application-level rejection with `Retry-After`.
- **Queue depth threshold**: Reject or slow producers when queue exceeds a depth limit.
- **gRPC flow control**: HTTP/2 `WINDOW_UPDATE` frames manage stream-level pressure.
- **Reactive Streams `request(n)`**: Consumer explicitly requests N items from the producer.

### 1.3 Backpressure Propagation

In distributed systems, backpressure must propagate **upstream through every hop**.
If service C is slow, service B must signal to service A. If only B absorbs the
pressure (via unbounded queues), B will eventually OOM. Design every layer to
propagate pressure signals to its callers.

```
[Client] ◄─429─ [API Gateway] ◄─queue full─ [Service B] ◄─slow response─ [Service C]
```

---

## 2. Code Examples

### 2.1 TypeScript -- Node.js Streams with Backpressure

```typescript
import { Transform, pipeline } from "node:stream";
import { promisify } from "node:util";

const pipelineAsync = promisify(pipeline);

class RateLimitedTransform extends Transform {
  private processed = 0;

  constructor(
    private readonly maxPerSecond: number,
    private readonly processFn: (chunk: Buffer) => Promise<Buffer>
  ) {
    super({ highWaterMark: maxPerSecond * 2 }); // Buffer 2 seconds of work
  }

  async _transform(
    chunk: Buffer,
    _encoding: string,
    callback: (err?: Error | null, data?: Buffer) => void
  ): Promise<void> {
    try {
      const result = await this.processFn(chunk);
      this.processed++;

      // Backpressure: if push() returns false, Node pauses the readable
      const canContinue = this.push(result);
      if (!canContinue) {
        // Writable consumer is full; Node will pause upstream automatically
      }
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
}

// RxJS-style backpressure with explicit concurrency control
import { from, mergeMap, bufferCount } from "rxjs";

function processWithBackpressure<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  batchSize: number
) {
  return from(items).pipe(
    bufferCount(batchSize),
    mergeMap(async (batch) => {
      return Promise.all(batch.map(processor));
    }, concurrency) // Limit concurrent batches -- natural backpressure
  );
}
```

### 2.2 Go -- Channel-Based Backpressure

```go
package backpressure

import (
    "context"
    "log"
    "sync"
    "time"
)

// Pipeline implements backpressure through bounded channels.
// When a downstream channel is full, upstream goroutines block
// automatically -- Go channels provide built-in backpressure.

type Pipeline[T any] struct {
    stages []stage[T]
    buffer int
}

type stage[T any] struct {
    name    string
    workers int
    fn      func(context.Context, T) (T, error)
}

func NewPipeline[T any](buffer int) *Pipeline[T] {
    return &Pipeline[T]{buffer: buffer}
}

func (p *Pipeline[T]) AddStage(name string, workers int, fn func(context.Context, T) (T, error)) {
    p.stages = append(p.stages, stage[T]{name: name, workers: workers, fn: fn})
}

func (p *Pipeline[T]) Run(ctx context.Context, input <-chan T) <-chan T {
    current := input
    for _, s := range p.stages {
        current = p.runStage(ctx, s, current)
    }
    return current
}

func (p *Pipeline[T]) runStage(ctx context.Context, s stage[T], in <-chan T) <-chan T {
    out := make(chan T, p.buffer) // Bounded channel = backpressure boundary

    var wg sync.WaitGroup
    for i := 0; i < s.workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for item := range in {
                result, err := s.fn(ctx, item)
                if err != nil {
                    log.Printf("stage %s error: %v", s.name, err)
                    continue
                }
                select {
                case out <- result:
                    // Sent downstream. If out is full, this blocks --
                    // which stops reading from `in`, propagating pressure upstream.
                case <-ctx.Done():
                    return
                }
            }
        }()
    }

    go func() {
        wg.Wait()
        close(out)
    }()

    return out
}

// Load shedder: drop requests when queue depth exceeds threshold
type LoadShedder struct {
    queue     chan func()
    queueMax  int
    dropped   int64
    mu        sync.Mutex
}

func NewLoadShedder(workers, queueMax int) *LoadShedder {
    ls := &LoadShedder{
        queue:    make(chan func(), queueMax),
        queueMax: queueMax,
    }
    for i := 0; i < workers; i++ {
        go func() {
            for fn := range ls.queue {
                fn()
            }
        }()
    }
    return ls
}

func (ls *LoadShedder) Submit(fn func()) bool {
    select {
    case ls.queue <- fn:
        return true
    default:
        ls.mu.Lock()
        ls.dropped++
        ls.mu.Unlock()
        return false // Backpressure signal: caller must handle rejection
    }
}
```

### 2.3 HTTP 429 -- Application-Level Backpressure

```typescript
import { Request, Response, NextFunction } from "express";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  queueDepthThreshold: number;
}

function backpressureMiddleware(
  config: RateLimitConfig,
  getQueueDepth: () => number
) {
  const windowCounts = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Layer 1: Queue depth backpressure (system-level)
    const queueDepth = getQueueDepth();
    if (queueDepth > config.queueDepthThreshold) {
      res.status(503).set("Retry-After", "5").json({
        error: "service_overloaded",
        retryAfter: 5,
        queueDepth,
      });
      return;
    }

    // Layer 2: Per-client rate limiting
    const clientId = req.ip ?? "unknown";
    const now = Date.now();
    let entry = windowCounts.get(clientId);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + config.windowMs };
      windowCounts.set(clientId, entry);
    }

    entry.count++;
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    res.set("X-RateLimit-Limit", String(config.maxRequests));
    res.set("X-RateLimit-Remaining", String(remaining));
    res.set("X-RateLimit-Reset", String(entry.resetAt));

    if (entry.count > config.maxRequests) {
      res.status(429).set("Retry-After", String(retryAfter)).json({
        error: "rate_limit_exceeded",
        retryAfter,
      });
      return;
    }

    next();
  };
}
```

---

## 3. Load Shedding Strategies

| Strategy                   | When to Use                              | Trade-off                        |
|----------------------------|------------------------------------------|----------------------------------|
| LIFO queue + drop oldest   | Real-time systems (newest data matters)  | Older requests are lost          |
| Priority-based shedding    | Multi-tenant with SLA tiers              | Lower-tier users experience more drops |
| Random early detection     | Prevent queue saturation proactively     | Some good requests are dropped early  |
| CoDel (controlled delay)   | Network queues, message brokers          | Requires tuning target delay     |

---

## 4. Best Practices

1. **Use bounded queues everywhere** -- unbounded queues are memory leaks waiting to happen under load.
2. **Return HTTP 429 with Retry-After headers** -- give clients explicit backpressure signals, not just errors.
3. **Propagate pressure upstream** -- every layer in the call chain must either reject or slow down, never silently buffer.
4. **Prefer pull-based consumption** -- design consumers to request work when ready, not producers to push at will.
5. **Implement load shedding as the last resort** -- drop lowest-priority work gracefully rather than crashing.
6. **Monitor queue depth as a leading indicator** -- queue depth growing faster than drain rate predicts imminent failure.
7. **Set highWaterMark on Node.js streams** -- control the internal buffer size to enable meaningful backpressure.
8. **Use bounded Go channels for pipeline stages** -- channel capacity is the backpressure boundary between stages.
9. **Differentiate backpressure by client priority** -- shed free-tier traffic before premium-tier traffic.
10. **Test backpressure under sustained overload** -- verify the system stabilizes rather than degrades progressively.

---

## 5. Anti-Patterns

| #  | Anti-Pattern                            | Problem                                                   | Correction                                                |
|----|-----------------------------------------|-----------------------------------------------------------|-----------------------------------------------------------|
| 1  | Unbounded in-memory queues              | Memory grows until OOM under sustained load               | Set maximum queue depth; reject when full                 |
| 2  | Swallowing backpressure signals         | Intermediate service absorbs pressure instead of propagating | Forward 429/503 responses upstream to callers            |
| 3  | Retry on 429 without respecting Retry-After | Client retries immediately, amplifying load            | Parse and obey the Retry-After header value               |
| 4  | Dropping messages silently              | Data loss with no visibility or alerting                  | Log and meter every dropped message; alert on thresholds  |
| 5  | Using sleep() as backpressure           | Threads blocked sleeping waste resources                  | Use event-driven waits (channels, promises, condition vars)|
| 6  | Backpressure only at the edge           | Internal services still overwhelm each other              | Implement backpressure at every service boundary          |
| 7  | Fixed rate limits ignoring system load  | Rate limit is fine at normal load but too generous when degraded | Use adaptive rate limits tied to queue depth or latency |
| 8  | No priority differentiation             | All traffic is shed equally during overload               | Implement priority tiers so critical traffic is preserved |

---

## 6. Enforcement Checklist

- [ ] All internal queues have explicit maximum depth limits.
- [ ] HTTP APIs return 429 with `Retry-After` headers when rate-limited.
- [ ] 503 responses include `Retry-After` when the service is overloaded.
- [ ] Queue depth metrics are exported and dashboarded per service.
- [ ] Alerts fire when queue depth exceeds 80% of maximum for 2+ minutes.
- [ ] Go channels used in pipelines are bounded (non-zero capacity).
- [ ] Node.js streams set `highWaterMark` appropriate to processing speed.
- [ ] Load shedding is implemented with priority-based rejection policies.
- [ ] Backpressure propagation is validated end-to-end in integration tests.
- [ ] Client SDKs respect `Retry-After` headers and implement backoff.
