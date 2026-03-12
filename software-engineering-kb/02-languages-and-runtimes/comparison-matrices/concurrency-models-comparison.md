# Concurrency Models Comparison Across Languages

> **Domain:** Languages & Runtimes > Comparison Matrices
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-07

---

## What It Is

A comprehensive comparison of the fundamental concurrency models used across programming languages: OS threads, green threads/goroutines, event loops, actors, CSP, coroutines, structured concurrency, and work stealing. Understanding these models is critical for building systems that handle thousands to millions of simultaneous operations.

---

## Why It Matters

Modern applications must handle concurrency at every level:
- **Web servers**: Thousands of simultaneous HTTP connections
- **Databases**: Thousands of concurrent queries
- **Mobile apps**: UI thread + background work
- **Real-time systems**: Chat, gaming, collaboration
- **Microservices**: Service-to-service communication

Choosing the wrong concurrency model leads to:
- **Deadlocks** that halt systems
- **Race conditions** that corrupt data
- **Resource exhaustion** (thread leaks, connection leaks)
- **Latency spikes** from contention or GC pauses
- **Complexity** that makes code unmaintainable

---

## The Models

### 1. OS Threads (Preemptive Multithreading)

**Languages:** Java (traditional), C++, C#, Python (threading module), Ruby (Thread class)

**How it works:**
- Each concurrent unit is an OS-level thread managed by the kernel
- Preemptive scheduling: the OS can interrupt any thread at any time
- Threads share memory space within a process
- Context switches involve saving/restoring CPU registers, cache invalidation

**Characteristics:**

| Metric | Value |
|---|---|
| Memory per thread | ~1 MB (default stack size) |
| Context switch cost | ~1-10 microseconds |
| Max practical threads | ~10,000 per process (OS limit) |
| Scheduling | OS kernel (preemptive) |
| Shared memory | Yes (requires synchronization) |
| Deadlock risk | High (mutex ordering, resource contention) |
| Race condition risk | High (shared mutable state) |

**Synchronization primitives:** Mutex, RwLock, Semaphore, Condition Variable, Atomic operations

**When to use:** CPU-bound work that needs true parallelism; legacy systems; when libraries require thread-per-connection

**Real-world limitation:** At 1 MB per thread, 10,000 threads = 10 GB of memory just for thread stacks. This is why the C10K problem (handling 10,000 concurrent connections) was hard in the thread-per-connection era.

---

### 2. Green Threads / Goroutines (M:N Threading)

**Languages:** Go (goroutines), Java 21+ (virtual threads / Project Loom), Erlang/Elixir (BEAM processes)

**How it works:**
- Lightweight threads managed by the language runtime, not the OS
- M green threads multiplexed onto N OS threads (M >> N)
- The runtime scheduler handles context switching in userspace
- Much smaller stack size (2-8 KB initial for goroutines; 1-5 KB for virtual threads)

**Go goroutines:**

| Metric | Value |
|---|---|
| Memory per goroutine | ~2-8 KB initial (grows as needed) |
| Context switch cost | ~100-200 nanoseconds (userspace) |
| Max goroutines | Millions (limited by memory) |
| Scheduling | Go runtime (cooperative + preemptive since Go 1.14) |
| Communication | Channels (CSP model) |

**Java virtual threads (Project Loom, JDK 21+):**

| Metric | Value |
|---|---|
| Memory per virtual thread | ~1-5 KB |
| Context switch cost | ~100-300 nanoseconds |
| Max virtual threads | Millions |
| Scheduling | JDK scheduler on carrier threads |
| Communication | Standard Java concurrency (synchronized, j.u.c.) |

**The transformation:** Java's virtual threads make the traditional thread-per-request model viable again at scale. Spring Boot with virtual threads can handle millions of concurrent connections without reactive programming complexity.

---

### 3. Event Loop + Async/Await

**Languages:** Node.js, Python (asyncio), Rust (tokio), Dart, C# (Task-based async)

**How it works:**
- Single-threaded event loop processes events from a queue
- I/O operations are non-blocking: they register callbacks and return immediately
- `async/await` syntax makes callback-based code look sequential
- Only one piece of code runs at a time (no parallelism on single thread)
- CPU-bound work blocks the event loop

**Node.js event loop:**
```
┌───────────────────────────┐
│         timers             │ ← setTimeout, setInterval
├───────────────────────────┤
│    pending callbacks       │ ← I/O callbacks deferred
├───────────────────────────┤
│       idle, prepare        │ ← internal
├───────────────────────────┤
│          poll              │ ← retrieve new I/O events
├───────────────────────────┤
│         check              │ ← setImmediate
├───────────────────────────┤
│    close callbacks         │ ← socket.on('close')
└───────────────────────────┘
Each iteration is a "tick" — process all ready events, then wait for I/O
```

| Metric | Node.js | Python asyncio | Rust tokio |
|---|---|---|---|
| Threads | 1 (+ worker pool) | 1 per event loop | Multi-threaded work-stealing |
| Memory per task | ~10-30 KB | ~20-50 KB | ~1-5 KB (future) |
| Parallelism | No (except worker_threads) | No (GIL) | Yes (multi-thread scheduler) |
| CPU-bound handling | Offload to worker_threads | Offload to ProcessPoolExecutor | Spawn blocking tasks |

**The Colored Function Problem** (Bob Nystrom, "What Color is Your Function?"):
- Async functions can call sync functions, but sync functions cannot call async functions
- This creates two "colors" of functions that don't compose freely
- Go, Java (Loom), and Elixir avoid this problem entirely — all functions are the same "color"

---

### 4. Actor Model

**Languages:** Erlang/Elixir (OTP), Akka (Java/Scala), Swift (actors), Microsoft Orleans (C#)

**How it works:**
- Each actor is an isolated unit with its own state
- Actors communicate exclusively through asynchronous message passing
- No shared mutable state between actors
- Each actor processes one message at a time (sequential within actor)
- Actors can create child actors, forming supervision trees

**Erlang/Elixir BEAM processes:**

| Metric | Value |
|---|---|
| Memory per process | ~2 KB (initial) |
| Processes per node | Millions |
| Scheduling | Preemptive (reduction-based); fair scheduling |
| GC | Per-process (no global stop-the-world) |
| Fault tolerance | Supervisor trees automatically restart crashed processes |
| Message passing | Async, copy-based (no shared memory) |
| Hot code upgrade | Yes (change code without stopping) |

**Key differentiator — "Let it crash" philosophy:**
Instead of defensive programming with error handling everywhere, Erlang/Elixir encourages writing actors that crash on unexpected errors. Supervisor trees automatically restart crashed processes, often within milliseconds. This creates systems that are inherently fault-tolerant.

**Real-world proof:**
- **WhatsApp**: 2 million concurrent connections per server (~50 engineers, 900M+ users at acquisition)
- **Discord**: Originally built on Elixir; handled millions of concurrent users
- **Ericsson**: Erlang was created for telecom; AXD301 switch achieved **99.9999999% uptime** (nine nines — 31ms downtime per year)

---

### 5. CSP (Communicating Sequential Processes)

**Languages:** Go (channels), Clojure (core.async), Kotlin (channels)

**How it works:**
- Based on Tony Hoare's 1978 paper
- Independent processes communicate through typed channels
- Channels can be buffered or unbuffered
- The key principle: **"Don't communicate by sharing memory; share memory by communicating"** (Go proverb)

```go
// Go CSP example
ch := make(chan int, 10)  // buffered channel

go func() {              // producer goroutine
    for i := 0; i < 100; i++ {
        ch <- i           // send to channel
    }
    close(ch)
}()

for val := range ch {    // consumer reads from channel
    process(val)
}
```

**CSP vs Actor model:**

| Aspect | CSP (Go channels) | Actor (Erlang/Elixir) |
|---|---|---|
| Communication | Through channels (anonymous) | Through mailboxes (addressed to specific actor) |
| Identity | Processes are anonymous | Actors have identity (PID) |
| Coupling | Loosely coupled via channels | Actors know each other's addresses |
| Backpressure | Buffered channels provide natural backpressure | Mailbox can grow unbounded (needs monitoring) |
| Pattern | Pipeline / fan-out / fan-in | Supervision tree / request-response |

---

### 6. Coroutines (Cooperative Scheduling)

**Languages:** Kotlin (coroutines), Python (generators, asyncio), Lua (coroutines), C++20 (coroutines)

**How it works:**
- Coroutines voluntarily yield execution at specific points
- No preemption — a coroutine runs until it yields
- Much lighter than threads (no OS involvement in scheduling)
- Coroutines can be stackful (full call stack preserved) or stackless (only top frame)

**Kotlin coroutines:**
```kotlin
// Looks sequential but is non-blocking
suspend fun fetchUserData(userId: String): UserData {
    val profile = async { api.getProfile(userId) }    // concurrent
    val orders = async { api.getOrders(userId) }       // concurrent
    return UserData(profile.await(), orders.await())    // join
}
```

| Type | Stackful | Stackless |
|---|---|---|
| **Memory** | KBs (full stack) | Bytes (single frame) |
| **Languages** | Go goroutines, Lua, Java Loom | Kotlin, Python asyncio, Rust, C++20 |
| **Can yield from** | Any depth | Only top-level suspend point |
| **Flexibility** | Higher | Lower but sufficient for most I/O |

---

### 7. Structured Concurrency

**Languages:** Kotlin (coroutineScope), Java 21+ (StructuredTaskScope), Swift (TaskGroup), Python (trio, anyio)

**How it works:**
- Concurrent tasks are scoped to a block — they cannot outlive their parent
- When a scope exits, all child tasks are guaranteed to be complete or cancelled
- Errors propagate predictably from child to parent
- Eliminates "fire and forget" tasks that leak resources

```kotlin
// Kotlin structured concurrency
coroutineScope {
    val user = async { fetchUser(id) }
    val orders = async { fetchOrders(id) }
    // Both MUST complete (or fail) before coroutineScope returns
    // If either fails, the other is automatically cancelled
    UserWithOrders(user.await(), orders.await())
}
// At this point, ALL concurrent work is guaranteed done
```

**The problem structured concurrency solves:**
Traditional concurrency (spawning threads/tasks freely) creates "dangling" tasks that:
- Leak resources when their parent is no longer interested
- Cause hard-to-debug errors when they fail silently
- Make it impossible to reason about program state

**Nathaniel J. Smith's manifesto** ("Notes on structured concurrency, or: Go statement considered harmful", 2018) argues that unstructured `go`/`spawn` statements are as harmful as `goto` was for control flow.

---

### 8. Work Stealing

**Languages/Runtimes:** Tokio (Rust), Rayon (Rust), Java ForkJoinPool, Go runtime, .NET ThreadPool

**How it works:**
- Multiple worker threads each have their own task queue
- When a worker's queue is empty, it "steals" tasks from other workers' queues
- This provides automatic load balancing without central coordination
- Optimal for irregular/unpredictable workloads

```
Thread 1 queue: [Task A, Task B, Task C]  ← busy
Thread 2 queue: [Task D]                  ← busy
Thread 3 queue: []                        ← idle, steals from Thread 1
Thread 4 queue: []                        ← idle, steals from Thread 1
```

**Tokio (Rust):** Uses work-stealing multi-threaded scheduler. Each task is a zero-cost future (~1-5 KB). The scheduler automatically distributes work across OS threads.

**Rayon (Rust):** Data parallelism via work stealing. `vec.par_iter().map(|x| x * 2)` automatically parallelizes across all CPU cores.

---

### 9. Data Parallelism (SIMD, GPU, Parallel Streams)

**Languages:** All (via libraries/intrinsics), CUDA (C/C++), OpenCL, Java parallel streams

**How it works:**
- Same operation applied to multiple data elements simultaneously
- SIMD: Single instruction processes 4-16 values at once (CPU vector units)
- GPU: Thousands of simple cores process data in parallel
- Higher-level: parallel streams, parallel iterators

| Approach | Parallelism | Latency | Best For |
|---|---|---|---|
| **SIMD (CPU)** | 4-16x per instruction | Nanoseconds | Numeric computation, image processing |
| **GPU (CUDA/OpenCL)** | 1000-10000x | Microseconds (launch overhead) | ML training, scientific computing |
| **Parallel streams** | Core count (4-64x) | Microseconds | Collection processing, map-reduce |

---

## The C10K, C10M, and C100M Problems

### C10K (1999 — Dan Kegel)
**Problem:** Handle 10,000 concurrent connections on one server.
**Solution:** Event-driven I/O (epoll, kqueue) instead of thread-per-connection.
**Languages that solved it:** C (libevent), Java (NIO), Node.js (event loop)

### C10M (~2013)
**Problem:** Handle 10 million concurrent connections on one server.
**Solution:** Kernel bypass (DPDK, io_uring), zero-copy networking, userspace TCP stacks.
**Languages best suited:** C, Rust (with io_uring)

### C100M (theoretical)
**Problem:** Handle 100 million concurrent connections.
**Solution:** Requires fundamental OS/networking architecture changes.
**Research area:** eBPF, kernel bypass, custom network stacks

### How Different Models Scale

| Connections | OS Threads | Green Threads (Go) | Event Loop (Node.js) | Actors (BEAM) | Async (Rust/Tokio) |
|---|---|---|---|---|---|
| 100 | Trivial | Trivial | Trivial | Trivial | Trivial |
| 1,000 | Easy (~1 GB RAM) | Easy (~8 MB) | Easy (~30 MB) | Easy (~3 MB) | Easy (~5 MB) |
| 10,000 | Hard (~10 GB RAM) | Easy (~80 MB) | Easy (~300 MB) | Easy (~30 MB) | Easy (~50 MB) |
| 100,000 | Impractical | Easy (~800 MB) | Hard (~3 GB) | Easy (~300 MB) | Easy (~500 MB) |
| 1,000,000 | Impossible | Possible (~8 GB) | Impractical | Possible (~3 GB) | Possible (~5 GB) |
| 10,000,000 | Impossible | Challenging | Impossible | Possible (~30 GB) | Possible (~50 GB) |

---

## Real-World Concurrency Stories

### WhatsApp: 2M Connections Per Server (Erlang/BEAM)
- ~50 engineers supporting 900M+ users at time of Facebook acquisition
- Each server handles 2 million concurrent TCP connections
- Erlang's BEAM VM with millions of lightweight processes
- Per-process GC means no global stop-the-world pauses
- Result: Extreme efficiency with tiny team

### Discord: Go → Rust (Concurrency Under GC Pressure)
- Read States service: tracking which messages users have read
- Go's GC caused latency spikes every ~2 minutes under heavy load
- Rust's zero-GC model eliminated spikes entirely
- Flat, predictable latency profile in production

### Go: Millions of Goroutines in Production
- Kubernetes, Docker, Terraform all built on goroutines
- Typical Go services run 10K-100K goroutines simultaneously
- CockroachDB: distributed SQL database handling millions of concurrent operations
- The goroutine model makes concurrent code look sequential — massive DX advantage

### Node.js: Single Thread Handling High Concurrency
- Netflix: Node.js BFF layer handles millions of requests (aggregating Java backend calls)
- PayPal: 35% faster response time after migrating from Java to Node.js for their web layer
- Limitation: CPU-bound operations block the event loop; mitigated by worker_threads

### Java Loom: Virtualizing the Thread Model
- Spring Boot with virtual threads: thread-per-request model works at scale again
- Each virtual thread: ~1-5 KB vs ~1 MB for platform threads
- Existing Java code works unchanged — virtual threads are drop-in compatible
- Helidon Nima: first web framework designed specifically for virtual threads

---

## Concurrency Safety Comparison

| Language | Data Race Prevention | Deadlock Prevention | Resource Leak Prevention |
|---|---|---|---|
| **Rust** | Compile-time (Send/Sync traits, ownership) | Not prevented (but Mutex API helps) | RAII + Drop trait |
| **Erlang/Elixir** | Impossible (no shared state, immutable data) | Very rare (message passing) | Supervisor trees + process links |
| **Go** | Race detector (runtime, -race flag) | Not prevented (channel + mutex) | defer statement; no guarantee |
| **Java** | Optional (@GuardedBy annotations, synchronized) | Not prevented (lock ordering discipline) | try-with-resources; structured concurrency |
| **C#** | Optional (lock, concurrent collections) | Not prevented | using statement; IAsyncDisposable |
| **Kotlin** | Structured concurrency helps | Structured concurrency helps | coroutineScope guarantees |
| **Swift** | Actor isolation (compile-time, Swift 5.5+) | Not fully prevented | Structured concurrency (TaskGroup) |
| **Node.js** | N/A (single-threaded) | N/A | Event loop; callback/promise cleanup |
| **Python** | GIL prevents most data races (ironic benefit) | Not prevented | async with, context managers |

**Rust is unique**: It is the only mainstream language that prevents data races at **compile time**. If your Rust code compiles, it is free of data races. This is guaranteed by the ownership system and the `Send`/`Sync` marker traits.

---

## Backpressure Mechanisms

Backpressure is how a system handles being overwhelmed — when producers create work faster than consumers can process it.

| Model | Natural Backpressure | Mechanism |
|---|---|---|
| **Go channels (buffered)** | Yes | Sender blocks when buffer is full |
| **Go channels (unbuffered)** | Yes | Sender blocks until receiver is ready |
| **Erlang mailboxes** | No (grows unbounded) | Must monitor queue size manually |
| **Tokio (Rust) channels** | Yes (bounded channels) | Sender awaits when full |
| **Node.js streams** | Yes | `highWaterMark`, `pause()`/`resume()` |
| **Reactive Streams (Java)** | Yes | Subscriber requests N items |
| **Actor mailboxes** | Configurable | Bounded mailboxes drop or block |

---

## Cancellation Support

How each model handles cancelling in-progress concurrent work:

| Model | Cancellation | Mechanism | Cleanup |
|---|---|---|---|
| **OS Threads** | Dangerous (pthread_cancel) | Signal-based, interrupts | Unpredictable; resources may leak |
| **Go goroutines** | Context-based (context.Context) | Cooperative; goroutine must check ctx.Done() | defer statements for cleanup |
| **Rust (Tokio)** | Drop-based | Dropping a future cancels it; JoinHandle::abort() | Drop trait runs cleanup |
| **Kotlin coroutines** | CancellationException | Cooperative; check isActive or use suspending functions | Structured concurrency auto-cancels children |
| **Swift TaskGroup** | Task.cancel() | Cooperative; check Task.isCancelled | Structured concurrency |
| **Erlang processes** | Process.exit/2 | Reliable; linked processes notified | OTP handles cleanup via terminate callback |
| **Node.js** | AbortController | Cooperative; signal-based | Manual cleanup |
| **Python asyncio** | task.cancel() | CancelledError raised at await point | try/except for cleanup |

---

## Decision Guide: Choosing a Concurrency Model

| Requirement | Best Model | Language Example |
|---|---|---|
| Maximum connections (1M+) | Actors or Async | Elixir, Rust |
| Simplest concurrent code | Green threads | Go, Java (Loom) |
| Zero-latency-spike | Ownership (no GC) | Rust |
| Fault tolerance | Actors + supervisors | Elixir/Erlang |
| CPU-bound parallelism | Work stealing + threads | Rust (Rayon), Java (ForkJoin) |
| I/O-bound with JS ecosystem | Event loop | Node.js |
| Enterprise + existing Java | Virtual threads | Java 21+ |
| Data parallelism | SIMD + GPU | C++, Rust, CUDA |
| Minimal complexity | Single-threaded async | Node.js, Python asyncio |

---

## Summary: Concurrency Model Comparison

| Model | Memory/Unit | Max Scale | Complexity | Safety | Best For |
|---|---|---|---|---|---|
| **OS Threads** | ~1 MB | ~10K | Medium | Low | CPU-bound, legacy |
| **Goroutines** | ~2-8 KB | Millions | Low | Medium | General purpose, services |
| **Virtual Threads** | ~1-5 KB | Millions | Low | Medium | Java ecosystem, enterprise |
| **Event Loop** | ~10-30 KB | ~100K | Medium | High (single-thread) | I/O-bound, web APIs |
| **Actors (BEAM)** | ~2 KB | Millions | Medium | Very High | Real-time, fault-tolerant |
| **Async/Await (Rust)** | ~1-5 KB | Millions | High | Very High | Max performance + safety |
| **Structured Concurrency** | Varies | Varies | Low | High | Any (pattern, not model) |
| **Work Stealing** | Per-task | Core count | Low (transparent) | Medium | CPU parallelism |

---

## Sources

1. **Tony Hoare:** "Communicating Sequential Processes" (1978 paper)
2. **Bob Nystrom:** "What Color is Your Function?" (2015 blog post)
3. **Nathaniel J. Smith:** "Notes on structured concurrency, or: Go statement considered harmful" (2018)
4. **WhatsApp Engineering:** Erlang/BEAM scalability documentation
5. **Discord Engineering Blog:** Go to Rust migration (2020)
6. **Go blog:** "Concurrency is not parallelism" (Rob Pike, 2012)
7. **Java JEP 444:** Virtual Threads (Project Loom)
8. **Tokio documentation:** tokio.rs — work-stealing scheduler
9. **Kotlin coroutines documentation:** Structured concurrency
10. **Dan Kegel:** "The C10K Problem" (1999)
11. **Joe Armstrong:** "Making reliable distributed systems in the presence of software errors" (2003, PhD thesis — Erlang/OTP)
12. **Rust Nomicon:** Send and Sync traits — fearless concurrency
