# Load Management & Backpressure

> **AI Plugin Directive — Load Shedding, Backpressure & Overload Protection**
> You are an AI coding assistant. When generating, reviewing, or refactoring load management
> code, follow EVERY rule in this document. Without load management, traffic spikes cause
> cascading failures and total system collapse. Treat each section as non-negotiable.

**Core Rule: ALWAYS implement load shedding to reject excess traffic early. ALWAYS apply backpressure when downstream services are slow. ALWAYS prioritize critical requests over non-critical during overload. NEVER process requests you cannot complete within the deadline.**

---

## 1. Load Management Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Load Management Layers                           │
│                                                               │
│  Traffic spike arrives                                       │
│  ├── 1. LOAD SHEDDING — reject excess at edge              │
│  │   └── Return 503 before wasting resources                │
│  │                                                           │
│  ├── 2. ADMISSION CONTROL — limit concurrent processing    │
│  │   └── Queue overflow → reject with 429/503              │
│  │                                                           │
│  ├── 3. PRIORITY QUEUING — process critical first          │
│  │   └── Health checks > payments > recommendations        │
│  │                                                           │
│  ├── 4. BACKPRESSURE — slow down producers                 │
│  │   └── Consumer signals "slow down" to producer          │
│  │                                                           │
│  └── 5. ADAPTIVE CONCURRENCY — auto-tune limits            │
│      └── Increase limit when healthy, decrease when slow    │
│                                                               │
│  Principle: It is BETTER to serve some requests well        │
│  than all requests poorly                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Load Shedding

```typescript
// Reject requests when server is overloaded
class LoadShedder {
  private activeRequests = 0;

  constructor(
    private maxConcurrent: number,
    private maxQueueDepth: number,
  ) {}

  middleware(): RequestHandler {
    return (req, res, next) => {
      if (this.activeRequests >= this.maxConcurrent) {
        metrics.increment("load_shedding.rejected");
        res.status(503).json({
          error: {
            type: "SERVICE_OVERLOADED",
            message: "Server is overloaded. Please retry later.",
            retryAfter: 5,
          },
        });
        return;
      }

      this.activeRequests++;
      res.on("finish", () => { this.activeRequests--; });
      next();
    };
  }
}

// Priority-based load shedding
class PriorityLoadShedder {
  middleware(): RequestHandler {
    return (req, res, next) => {
      const priority = this.getRequestPriority(req);
      const load = this.getCurrentLoad();

      // Shed low-priority requests first
      if (load > 0.8 && priority === "low") {
        return res.status(503).json({ error: { type: "SERVICE_OVERLOADED" } });
      }
      if (load > 0.95 && priority !== "critical") {
        return res.status(503).json({ error: { type: "SERVICE_OVERLOADED" } });
      }

      next();
    };
  }

  private getRequestPriority(req: Request): "critical" | "normal" | "low" {
    if (req.path.startsWith("/health")) return "critical";
    if (req.path.startsWith("/api/payments")) return "critical";
    if (req.path.startsWith("/api/recommendations")) return "low";
    return "normal";
  }
}
```

```go
func LoadSheddingMiddleware(maxConcurrent int64) func(http.Handler) http.Handler {
    sem := semaphore.NewWeighted(maxConcurrent)

    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !sem.TryAcquire(1) {
                metrics.Increment("load_shedding.rejected")
                w.Header().Set("Retry-After", "5")
                writeJSON(w, 503, map[string]string{
                    "error": "Server overloaded",
                })
                return
            }
            defer sem.Release(1)
            next.ServeHTTP(w, r)
        })
    }
}
```

---

## 3. Backpressure

```typescript
// Backpressure: slow down producers when consumer is overwhelmed

class BackpressureQueue<T> {
  private queue: T[] = [];
  private processing = 0;

  constructor(
    private maxQueueSize: number,
    private maxConcurrency: number,
    private processor: (item: T) => Promise<void>,
  ) {}

  async enqueue(item: T): Promise<void> {
    if (this.queue.length >= this.maxQueueSize) {
      metrics.increment("backpressure.rejected");
      throw new Error("Queue full — apply backpressure");
    }

    this.queue.push(item);
    metrics.gauge("backpressure.queue_size", this.queue.length);
    this.drain();
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0 && this.processing < this.maxConcurrency) {
      const item = this.queue.shift()!;
      this.processing++;
      this.processor(item)
        .catch((err) => logger.error("Processing failed", { error: err.message }))
        .finally(() => { this.processing--; this.drain(); });
    }
  }
}
```

```python
import asyncio

class BackpressureQueue:
    def __init__(self, max_size: int, max_concurrency: int, processor):
        self._queue = asyncio.Queue(maxsize=max_size)
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._processor = processor
        self._running = True

    async def enqueue(self, item):
        try:
            self._queue.put_nowait(item)
        except asyncio.QueueFull:
            metrics.increment("backpressure.rejected")
            raise OverloadError("Queue full")

    async def worker(self):
        while self._running:
            item = await self._queue.get()
            async with self._semaphore:
                try:
                    await self._processor(item)
                except Exception as e:
                    logger.error("Processing failed", extra={"error": str(e)})
                finally:
                    self._queue.task_done()
```

---

## 4. Adaptive Concurrency Limits

```typescript
// Auto-tune concurrency limit based on response times
// Increase when healthy, decrease when latency increases

class AdaptiveLimiter {
  private limit: number;
  private inFlight = 0;
  private minRtt = Infinity;

  constructor(
    private initialLimit: number = 20,
    private minLimit: number = 5,
    private maxLimit: number = 200,
  ) {
    this.limit = initialLimit;
  }

  tryAcquire(): boolean {
    if (this.inFlight >= this.limit) return false;
    this.inFlight++;
    return true;
  }

  release(latencyMs: number, success: boolean): void {
    this.inFlight--;

    if (success) {
      this.minRtt = Math.min(this.minRtt, latencyMs);
      // Gradient-based: increase when latency close to minRtt
      const gradient = this.minRtt / latencyMs;
      this.limit = Math.min(
        this.maxLimit,
        Math.max(this.minLimit, this.limit * gradient + 1),
      );
    } else {
      // Decrease on failure
      this.limit = Math.max(this.minLimit, this.limit * 0.9);
    }

    metrics.gauge("adaptive_limiter.limit", this.limit);
    metrics.gauge("adaptive_limiter.in_flight", this.inFlight);
  }
}
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No load shedding | System collapses under spike | Reject excess traffic at edge |
| Equal priority for all requests | Critical requests fail with low-priority | Priority-based shedding |
| Unbounded queues | Memory exhaustion, latency explosion | Max queue size + backpressure |
| Fixed concurrency limits | Under/over-utilized | Adaptive concurrency |
| Processing expired requests | Wasted work | Check deadline before processing |
| No backpressure signal | Producer overwhelms consumer | Queue full → reject/slow down |

---

## 6. Enforcement Checklist

- [ ] Load shedding returns 503 when server exceeds capacity
- [ ] Priority-based shedding protects critical paths during overload
- [ ] Backpressure applied when queues reach capacity
- [ ] Adaptive concurrency limits auto-tune based on latency
- [ ] Retry-After header included in 503 responses
- [ ] Request deadlines checked before processing
- [ ] Load shedding metrics tracked (rejection rate)
- [ ] Queue depth metrics tracked with alerting
