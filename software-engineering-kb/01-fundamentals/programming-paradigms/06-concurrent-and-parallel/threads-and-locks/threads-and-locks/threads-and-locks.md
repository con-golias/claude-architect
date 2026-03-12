# Threads and Locks

> **Domain:** Fundamentals > Programming Paradigms > Concurrent & Parallel
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Threads are the fundamental unit of concurrent execution — lightweight processes that share memory within a single program. **Locks** (mutexes, semaphores) protect shared data from concurrent access. This is the oldest and most widely used concurrency model, but also the most error-prone due to race conditions, deadlocks, and complexity.

## How It Works

```java
// Java — threads and synchronization
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

// Basic thread creation
Thread thread = new Thread(() -> {
    System.out.println("Running in: " + Thread.currentThread().getName());
});
thread.start();
thread.join();  // wait for completion

// Shared mutable state — needs protection
class BankAccount {
    private final Lock lock = new ReentrantLock();
    private double balance;

    public BankAccount(double balance) { this.balance = balance; }

    public void transfer(BankAccount to, double amount) {
        // Lock ordering prevents deadlock
        Lock first = System.identityHashCode(this) < System.identityHashCode(to) ? this.lock : to.lock;
        Lock second = first == this.lock ? to.lock : this.lock;

        first.lock();
        try {
            second.lock();
            try {
                if (this.balance >= amount) {
                    this.balance -= amount;
                    to.balance += amount;
                }
            } finally { second.unlock(); }
        } finally { first.unlock(); }
    }
}

// Atomic operations — lock-free for simple cases
AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet();  // thread-safe without explicit locks

// Thread pool — reuse threads
ExecutorService pool = Executors.newFixedThreadPool(4);
Future<String> future = pool.submit(() -> {
    return fetchDataFromAPI();  // runs in pool thread
});
String result = future.get();  // blocks until complete
pool.shutdown();
```

```python
# Python — threading (limited by GIL for CPU-bound work)
import threading
from concurrent.futures import ThreadPoolExecutor

# Thread-safe counter with Lock
class SafeCounter:
    def __init__(self):
        self._count = 0
        self._lock = threading.Lock()

    def increment(self):
        with self._lock:  # context manager for safe locking
            self._count += 1

    @property
    def count(self):
        with self._lock:
            return self._count

# Thread pool for I/O-bound work
def fetch_url(url: str) -> str:
    return requests.get(url).text

with ThreadPoolExecutor(max_workers=10) as pool:
    urls = ["https://api.example.com/1", "https://api.example.com/2"]
    results = list(pool.map(fetch_url, urls))  # parallel I/O

# Python's GIL (Global Interpreter Lock):
# Only one thread executes Python bytecode at a time
# Threads work for I/O-bound tasks but NOT for CPU-bound
# For CPU-bound: use multiprocessing or C extensions
```

### Lock Types

```
Lock Type           Purpose                     Use Case
──────────────────────────────────────────────────────────
Mutex               Mutual exclusion (1 thread)  Protecting critical section
Read-Write Lock     Many readers, 1 writer       Read-heavy caches
Semaphore           N concurrent accesses         Connection pools
Condition Variable  Wait for a condition          Producer-consumer
Spin Lock           Busy-wait for short locks     Low-level kernel code
```

### Deadlock Prevention

```
Four conditions for deadlock (all must hold):
1. Mutual exclusion — resource held exclusively
2. Hold and wait — holding one resource, waiting for another
3. No preemption — resource can't be forcibly taken
4. Circular wait — A waits for B, B waits for A

Prevention strategies:
- Lock ordering: always acquire locks in the same global order
- Lock timeout: give up after a deadline
- Try-lock: non-blocking attempt, back off on failure
- Single lock: use one coarse-grained lock (simple but limits concurrency)
```

## Sources

- Goetz, B. et al. (2006). *Java Concurrency in Practice*. Addison-Wesley.
- Herlihy, M. & Shavit, N. (2012). *The Art of Multiprocessor Programming*. Morgan Kaufmann.
