# Concurrency Fundamentals

> **Domain:** Fundamentals > Programming Paradigms > Concurrent & Parallel
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

**Concurrency** is dealing with multiple tasks that can make progress within overlapping time periods. **Parallelism** is executing multiple tasks simultaneously on multiple processors. Concurrency is about *structure* (composing independent tasks); parallelism is about *execution* (running things at the same time).

**Rob Pike:** *"Concurrency is not parallelism. Concurrency is about dealing with lots of things at once. Parallelism is about doing lots of things at once."*

## How It Works

```
Concurrency (1 core, interleaved):
Thread A: ████░░░░████░░░░████
Thread B: ░░░░████░░░░████░░░░
                  (time-sliced on 1 CPU)

Parallelism (2 cores, simultaneous):
Core 1:   ████████████████████  Thread A
Core 2:   ████████████████████  Thread B
                  (truly simultaneous)

Concurrent but not parallel:  Node.js event loop (1 thread, many tasks)
Parallel but not concurrent:  SIMD instruction (1 task on many data points)
Both:                         Go goroutines on multi-core
Neither:                      Single-threaded sequential program
```

### Concurrency Hazards

```typescript
// Race condition — outcome depends on timing
let balance = 1000;

// Thread A                    Thread B
// read: 1000                  read: 1000
// compute: 1000 - 200 = 800   compute: 1000 - 300 = 700
// write: 800                  write: 700
// Expected: 500, Got: 700 or 800 (last write wins)

// Deadlock — two threads waiting for each other forever
// Thread A: lock(resource1) → waiting for resource2
// Thread B: lock(resource2) → waiting for resource1
// Both blocked forever!

// Starvation — a thread never gets to execute
// High-priority threads keep preempting a low-priority thread
```

### Concurrency Models Comparison

```
Model               Mechanism            Languages           Trade-offs
──────────────────────────────────────────────────────────────────────────
Threads + Locks     OS threads, mutexes  Java, C++, Python   Flexible but error-prone
Actor Model         Message passing      Erlang, Akka        Safe but async complexity
CSP / Channels      Channel-based comm   Go, Clojure         Structured but synchronous
Async/Await         Event loop + futures JS, Python, Rust     Simple API but not parallel
STM                 Transactional memory Haskell, Clojure     Composable but overhead
Fork/Join           Work-stealing pool   Java ForkJoinPool    Good for divide-and-conquer
```

### Amdahl's Law

```
Speedup = 1 / ((1 - P) + P/N)

P = fraction of work that can be parallelized
N = number of processors

Example: 90% parallelizable, 8 cores
Speedup = 1 / (0.1 + 0.9/8) = 1 / 0.2125 = 4.7x

Even with infinite cores: max speedup = 1/(1-P) = 10x
The sequential portion is the bottleneck.
```

## Real-world Examples

- **Web servers** — handle thousands of concurrent requests (Nginx, Node.js).
- **Databases** — concurrent transactions with ACID guarantees.
- **Operating systems** — process scheduling, I/O multiplexing.
- **GUI applications** — UI thread + background workers.
- **MapReduce / Spark** — parallel data processing across clusters.
- **Game engines** — physics, rendering, AI running concurrently.

## Sources

- Pike, R. (2012). [Concurrency Is Not Parallelism](https://go.dev/blog/waza-talk). Go Blog.
- Herlihy, M. & Shavit, N. (2012). *The Art of Multiprocessor Programming*. Morgan Kaufmann.
- Goetz, B. et al. (2006). *Java Concurrency in Practice*. Addison-Wesley.
