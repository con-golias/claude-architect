---
paths:
  - "src/**/*.ts"
  - "src/**/*.js"
  - "src/**/*.py"
  - "src/**/*.java"
  - "src/**/*.go"
---
## Concurrency & Async Patterns

### Race Condition Prevention
- Identify all shared mutable state — every piece MUST have a documented synchronization strategy
- Use atomic operations for simple counters and flags — avoid locks when atomics suffice
- Apply the principle of least sharing: prefer isolated state per request/task over shared state
- Test concurrent scenarios explicitly — race conditions do not surface in sequential tests
- Use race-condition detection tools in CI (ThreadSanitizer, --race flag in Go, concurrency stress tests)

### Deadlock Avoidance
- ALWAYS acquire multiple locks in a globally consistent order — document the ordering convention
- Set timeouts on lock acquisition — never wait indefinitely for a lock
- Prefer lock-free data structures and patterns (CAS, immutable snapshots) when performance-critical
- NEVER hold a lock while performing I/O (network, disk, database) — acquire after I/O completes
- Log and alert on lock acquisition timeouts — they indicate a design problem

### Shared State Management
- Prefer message passing (channels, queues, events) over shared memory for inter-task communication
- Encapsulate shared state behind a single owner (actor, service, mutex-protected module)
- Mark shared state explicitly in code — use naming conventions or type annotations (e.g., `Mutex<T>`, `Atomic`)
- NEVER rely on execution order between async tasks — if order matters, use explicit synchronization

### Async/Await Best Practices
- NEVER block the event loop / main thread with synchronous I/O or CPU-heavy computation
- Always handle promise rejections — unhandled rejections crash Node.js and hide bugs
- Use `Promise.allSettled` when multiple independent operations should all complete regardless of individual failures
- Use `Promise.all` only when ALL results are required — one failure should abort the batch
- Avoid creating promises inside loops without concurrency control — use a semaphore or `p-limit` pattern
- Set timeouts on all async operations — wrap with `Promise.race([operation, timeout])` if the API lacks native timeout support
- NEVER use `async void` (TypeScript) or fire-and-forget async calls — always await or explicitly handle the result

### Worker Threads & Background Processing
- Offload CPU-intensive work (image processing, encryption, compression) to worker threads or separate processes
- Communicate with workers via structured messages — never share raw memory without synchronization primitives
- Implement graceful shutdown: signal workers to finish current task, set a deadline, then force-terminate
- Monitor worker health — restart workers that crash or stop responding to heartbeats

### Queue-Based Processing
- Use persistent queues (Redis, RabbitMQ, SQS) for work that MUST survive process restarts
- Make all queue consumers idempotent — messages may be delivered more than once
- Implement dead-letter queues for messages that fail processing after max retries
- Set visibility timeouts longer than expected processing time to prevent duplicate processing
- Monitor queue depth and processing latency — alert on growing backlogs

### Optimistic Locking
- Use a version column or ETag for concurrent-update scenarios (CMS, collaborative editing, inventory)
- Read entity with current version, submit update with expected version, reject if version has changed
- Return 409 Conflict with the current state so the client can merge and retry
- NEVER use optimistic locking for append-only operations — it adds unnecessary contention

### Database Concurrency
- Use appropriate isolation levels: READ COMMITTED as default, SERIALIZABLE only when required
- Keep transactions as short as possible — never hold transactions open during user interaction
- Use advisory locks or SELECT FOR UPDATE for critical sections requiring database coordination
- Design schemas to minimize lock contention: narrow row locks over table locks, partition hot tables
