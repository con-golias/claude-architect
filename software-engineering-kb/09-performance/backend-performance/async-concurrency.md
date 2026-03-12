# Async & Concurrency Performance

> **Domain:** Performance > Backend Performance > Async & Concurrency
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Core Concepts

Concurrency is about structuring programs to handle multiple tasks; parallelism is about executing them simultaneously. The performance impact of choosing the right concurrency model is 10-100x throughput difference.

```
Concurrency Models Comparison:
+--------------------+------------+----------+-----------+----------------+
| Model              | Overhead   | Scaling  | Use Case  | Example        |
+--------------------+------------+----------+-----------+----------------+
| OS Threads         | ~1MB stack | 1K-10K   | CPU-bound | Java, C#       |
| Green Threads      | ~4KB stack | 100K-1M  | Mixed     | Go goroutines  |
| Event Loop         | 1 thread   | 10K-100K | I/O-bound | Node.js, uvloop|
| Virtual Threads    | ~1KB stack | 1M+      | Mixed     | Java 21+ Loom  |
| Actor Model        | Per-actor  | 1M+      | Stateful  | Akka, Erlang   |
+--------------------+------------+----------+-----------+----------------+
```

---

## Event Loop Architecture

### Node.js Event Loop

```
Node.js Event Loop Phases:
   ┌──────────────────────────┐
   │        timers             │ ← setTimeout, setInterval callbacks
   │  (min-heap by expiry)     │
   └──────────┬───────────────┘
              │
   ┌──────────▼───────────────┐
   │     pending callbacks     │ ← deferred I/O callbacks
   └──────────┬───────────────┘
              │
   ┌──────────▼───────────────┐
   │     poll                  │ ← retrieve I/O events, execute callbacks
   │  (blocks here if idle)    │   this is where most work happens
   └──────────┬───────────────┘
              │
   ┌──────────▼───────────────┐
   │     check                 │ ← setImmediate callbacks
   └──────────┬───────────────┘
              │
   ┌──────────▼───────────────┐
   │     close callbacks       │ ← socket.on('close')
   └──────────┘
   Between each phase: process microtask queue (Promises, queueMicrotask)
```

```typescript
// BAD: blocking the event loop — kills throughput for ALL requests
app.get('/hash', (req, res) => {
  const hash = crypto.pbkdf2Sync(req.body.password, salt, 100000, 64, 'sha512');
  res.json({ hash: hash.toString('hex') });
});

// GOOD: offload CPU work to worker thread pool
import { Worker } from 'worker_threads';

app.get('/hash', async (req, res) => {
  const hash = await runInWorker('hash', { password: req.body.password, salt });
  res.json({ hash });
});

function runInWorker(task: string, data: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./workers/cpu-tasks.js', { workerData: { task, data } });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}

// Detect event loop lag — alert if > 100ms
import { monitorEventLoopDelay } from 'perf_hooks';
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => {
  const p99 = h.percentile(99) / 1e6; // nanoseconds → milliseconds
  if (p99 > 100) console.warn(`Event loop lag p99: ${p99.toFixed(1)}ms`);
  h.reset();
}, 5000);
```

### Python asyncio

```python
import asyncio
import uvloop  # 2-4x faster than default event loop

asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

# BAD: blocking call in async context — blocks entire event loop
async def get_user_bad(user_id: str):
    result = requests.get(f"http://api/users/{user_id}")  # BLOCKS!
    return result.json()

# GOOD: proper async I/O
import httpx

async def get_user(user_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"http://api/users/{user_id}")
        return response.json()

# GOOD: gather for concurrent I/O (not sequential await)
async def get_dashboard(user_id: str):
    profile, orders, notifications = await asyncio.gather(
        get_user(user_id),
        get_orders(user_id),
        get_notifications(user_id),
    )  # 3 requests concurrently, total time = max(individual times)
    return {"profile": profile, "orders": orders, "notifications": notifications}

# CPU-bound work: use ProcessPoolExecutor
from concurrent.futures import ProcessPoolExecutor
executor = ProcessPoolExecutor(max_workers=4)

async def compute_heavy(data: bytes):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, cpu_intensive_function, data)
```

---

## Goroutines and CSP (Go)

```go
// Goroutines: ~4KB initial stack, dynamically grows. Can run millions concurrently.
// CSP model: communicate via channels, don't share memory.

// Fan-out/fan-in pattern for concurrent processing
func ProcessBatch(ctx context.Context, items []Item) ([]Result, error) {
    const maxWorkers = 10
    sem := make(chan struct{}, maxWorkers) // semaphore limits concurrency

    type indexedResult struct {
        index  int
        result Result
        err    error
    }
    resultCh := make(chan indexedResult, len(items))

    for i, item := range items {
        sem <- struct{}{} // acquire semaphore slot
        go func(idx int, it Item) {
            defer func() { <-sem }() // release slot
            r, err := processItem(ctx, it)
            resultCh <- indexedResult{idx, r, err}
        }(i, item)
    }

    results := make([]Result, len(items))
    for range items {
        ir := <-resultCh
        if ir.err != nil {
            return nil, ir.err
        }
        results[ir.index] = ir.result
    }
    return results, nil
}

// errgroup: structured concurrency with error propagation
import "golang.org/x/sync/errgroup"

func FetchAll(ctx context.Context, urls []string) ([]Response, error) {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(20) // max 20 concurrent goroutines
    responses := make([]Response, len(urls))

    for i, url := range urls {
        g.Go(func() error {
            resp, err := httpClient.Get(url)
            if err != nil { return err }
            responses[i] = resp
            return nil
        })
    }
    return responses, g.Wait()
}
```

---

## Java Virtual Threads (Project Loom)

```java
// Java 21+: Virtual threads — lightweight, 1M+ concurrent threads
// Old way: platform thread per request (~1MB stack each)
// New way: virtual thread per request (~1KB, scheduled on carrier threads)

// Create virtual threads
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<Response>> futures = urls.stream()
        .map(url -> executor.submit(() -> httpClient.send(
            HttpRequest.newBuilder().uri(URI.create(url)).build(),
            HttpResponse.BodyHandlers.ofString()
        )))
        .toList();

    List<Response> responses = futures.stream()
        .map(f -> { try { return f.get(); } catch (Exception e) { throw new RuntimeException(e); } })
        .toList();
}

// Spring Boot 3.2+ with virtual threads
// application.properties:
// spring.threads.virtual.enabled=true
// That's it — all request handling uses virtual threads automatically.

// Structured concurrency (preview in Java 21+)
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<User> user = scope.fork(() -> fetchUser(userId));
    Subtask<List<Order>> orders = scope.fork(() -> fetchOrders(userId));
    scope.join().throwIfFailed();
    return new Dashboard(user.get(), orders.get());
}
```

---

## Backpressure Handling

```typescript
// Node.js readable stream with backpressure
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

const rateLimiter = new Transform({
  highWaterMark: 16,  // buffer only 16 chunks before pausing upstream
  transform(chunk, encoding, callback) {
    processChunk(chunk)
      .then(result => callback(null, result))
      .catch(callback);
  }
});

await pipeline(sourceStream, rateLimiter, destinationStream);

// Bounded async queue with backpressure
class BoundedQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: T) => void)[] = [];
  private waiters: (() => void)[] = [];

  constructor(private maxSize: number) {}

  async enqueue(item: T): Promise<void> {
    while (this.queue.length >= this.maxSize) {
      await new Promise<void>(r => this.waiters.push(r)); // backpressure: wait
    }
    if (this.resolvers.length > 0) {
      this.resolvers.shift()!(item);
    } else {
      this.queue.push(item);
    }
  }

  async dequeue(): Promise<T> {
    if (this.queue.length > 0) {
      const item = this.queue.shift()!;
      if (this.waiters.length > 0) this.waiters.shift()!();
      return item;
    }
    return new Promise(r => this.resolvers.push(r));
  }
}
```

```go
// Go: channel-based backpressure — bounded channel blocks producers
func Pipeline(ctx context.Context, input <-chan Event) <-chan Result {
    // Buffered channel creates natural backpressure
    out := make(chan Result, 100) // producer blocks when 100 items buffered

    go func() {
        defer close(out)
        for event := range input {
            result := process(event)
            select {
            case out <- result: // blocks if buffer full (backpressure)
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}
```

---

## Context Switching Overhead

```
Context Switch Costs:
┌─────────────────────────────────────────────────┐
│ Type                    │ Cost         │ Impact  │
├─────────────────────────┼──────────────┼─────────┤
│ OS thread switch        │ 1-10 us     │ High    │
│ Goroutine switch        │ ~200 ns     │ Low     │
│ Virtual thread switch   │ ~100-500 ns │ Low     │
│ async/await resume      │ ~50-100 ns  │ Minimal │
│ Actor message dispatch  │ ~100-300 ns │ Low     │
└─────────────────────────┴──────────────┴─────────┘

OS thread context switch includes:
- Save/restore CPU registers
- Flush/reload TLB (translation lookaside buffer)
- Switch kernel stack
- Cache invalidation (L1/L2 cold misses)

Rule: If creating >10K concurrent tasks, avoid OS threads.
Use goroutines, virtual threads, or async/await instead.
```

---

## Actor Model vs CSP

```
Actor Model (Akka, Erlang, Orleans):
- Each actor has private state + mailbox
- Communication via async messages
- No shared state → no locks
- Supervision trees for fault tolerance
- Best for: stateful distributed systems, IoT

CSP - Communicating Sequential Processes (Go):
- Goroutines communicate via typed channels
- Channels can be buffered or unbuffered
- select statement for multiplexing
- Best for: pipeline processing, fan-out/fan-in

Key Difference:
  Actor: "send message TO actor"     → identity-based
  CSP:   "send value INTO channel"   → channel-based
```

---

## Best Practices

1. **NEVER block the event loop** with CPU-intensive work — offload to worker threads or process pools
2. **ALWAYS use `asyncio.gather`/`Promise.all`** for concurrent independent I/O operations instead of sequential awaits
3. **ALWAYS set concurrency limits** — use semaphores, worker pools, or bounded channels to prevent resource exhaustion
4. **ALWAYS use structured concurrency** (errgroup, StructuredTaskScope) — prevents goroutine/thread leaks
5. **ALWAYS implement backpressure** — bounded queues/channels prevent OOM under load spikes
6. **ALWAYS monitor event loop lag** (Node.js) or goroutine count (Go) — detect blocking operations early
7. **Use virtual threads (Java 21+)** for I/O-heavy workloads instead of reactive frameworks — simpler code, same performance
8. **Use uvloop for Python asyncio** — 2-4x throughput improvement with zero code changes
9. **NEVER use sync I/O libraries in async code** — one blocking call stalls all concurrent tasks
10. **Profile before choosing concurrency model** — measure whether workload is I/O-bound, CPU-bound, or mixed

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Blocking event loop | p99 latency spikes, all requests slow | Offload to worker threads/process pool |
| Sequential awaits for independent calls | 3 API calls take sum of times, not max | Use `Promise.all` / `asyncio.gather` |
| Unbounded goroutine/task creation | OOM, thundering herd | Semaphore or worker pool with limit |
| Sync library in async context | Event loop blocked, zero concurrency | Use async-native libraries (httpx, aiohttp) |
| No backpressure on producers | Memory grows unbounded, then OOM crash | Bounded channels/queues, stream highWaterMark |
| Thread pool too large | Excessive context switching, throughput drops | Size pool to CPU cores for CPU work, larger for I/O |
| Fire-and-forget goroutines | Leaked goroutines, no error handling | errgroup or context cancellation |
| Shared mutable state without sync | Race conditions, data corruption | Channels (CSP), message passing (actors), or sync primitives |

---

## Enforcement Checklist

- [ ] Event loop lag monitored with alerting threshold (<100ms p99)
- [ ] CPU-intensive operations offloaded from event loop / async context
- [ ] Concurrent I/O uses gather/all pattern, not sequential awaits
- [ ] Concurrency limits set (semaphore, bounded pool, channel buffer)
- [ ] Backpressure implemented for all producer-consumer flows
- [ ] Structured concurrency used (errgroup, TaskGroup, StructuredTaskScope)
- [ ] No sync I/O libraries used in async code paths
- [ ] Goroutine/thread count monitored in production metrics
- [ ] Worker pool sizes benchmarked and tuned for workload type
- [ ] Context cancellation propagated to prevent leaked work
