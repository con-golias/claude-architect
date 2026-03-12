# Concurrency Security

> **Domain:** Security > Secure Coding > Concurrency Security
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

Concurrency vulnerabilities are among the most dangerous and most underestimated security flaws in modern software. Unlike injection or XSS, race conditions do not appear in static analysis scans, do not produce consistent error messages, and often pass unit tests. They manifest only under specific timing conditions -- making them extraordinarily difficult to detect and reproduce, yet trivially exploitable at scale.

A race condition is not merely a reliability bug. It is a security vulnerability. When an attacker can influence the timing of concurrent operations, they can bypass authorization checks, double-spend monetary balances, reuse single-use tokens, escalate privileges, and corrupt critical state. The consequences are identical to those of any other access control bypass: data theft, financial loss, unauthorized access, and system compromise.

The root cause is universal: **shared mutable state accessed without proper synchronization**. Whether the shared state is a file on disk, a row in a database, a variable in memory, or a distributed cache entry, the same principles apply. Every system that handles concurrent requests -- which includes every web application, every API, every microservice -- must treat concurrency safety as a security requirement, not an optimization concern.

This guide covers every major class of concurrency vulnerability, with vulnerable and secure code examples, CWE mappings, and defense strategies across languages and architectures.

---

## Table of Contents

1. [Race Conditions (CWE-362)](#1-race-conditions-cwe-362)
2. [TOCTOU Vulnerabilities (CWE-367)](#2-toctou-vulnerabilities-cwe-367)
3. [Database-Level Race Conditions](#3-database-level-race-conditions)
4. [Distributed Race Conditions](#4-distributed-race-conditions)
5. [Thread-Safe Coding Patterns](#5-thread-safe-coding-patterns)
6. [Deadlock Prevention](#6-deadlock-prevention)
7. [Double-Submit and Replay Attacks](#7-double-submit-and-replay-attacks)
8. [Session Race Conditions](#8-session-race-conditions)
9. [File Locking](#9-file-locking)
10. [Atomic Operations in Financial and Critical Systems](#10-atomic-operations-in-financial-and-critical-systems)
11. [Secure Concurrency in Web Applications](#11-secure-concurrency-in-web-applications)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Enforcement Checklist](#enforcement-checklist)

---

## 1. Race Conditions (CWE-362)

**What it is:** A race condition occurs when the behavior of a system depends on the relative timing or ordering of events, and the correct outcome requires events to occur in a specific sequence that is not enforced. When two or more operations access shared state concurrently, and at least one operation modifies that state, the result depends on which operation "wins the race."

**Why it is a security vulnerability, not just a bug:** An attacker does not need to win the race every time. They need to win it once. By sending thousands of concurrent requests, an attacker can reliably exploit timing windows that appear to be microseconds wide. Automated tools (Turbo Intruder, race-the-web, custom scripts with asyncio or goroutines) make this trivial. A race condition that "almost never happens" in normal usage can be triggered with 100% reliability by an attacker.

**CWE-362** covers the general class. Sub-categories include CWE-367 (TOCTOU), CWE-364 (signal handler race), CWE-366 (race in thread), CWE-368 (context switching race).

### File Access Race Condition

An application checks whether a file exists, then opens it. Between the check and the open, an attacker replaces the file with a symlink to a sensitive resource.

```
Timeline of attack:

Thread 1 (application):          Thread 2 (attacker):
--------------------------        --------------------------
1. stat("/tmp/upload.txt")
   -> file exists, is regular
                                  2. rm /tmp/upload.txt
                                  3. ln -s /etc/shadow /tmp/upload.txt
4. open("/tmp/upload.txt")
   -> actually opens /etc/shadow
5. read() -> reads password hashes
```

### Database Race Condition -- Double-Spending

The most financially damaging race condition. A user has a balance of $100. They send two simultaneous requests to spend $100. Both requests read the balance as $100, both verify sufficient funds, both deduct $100. Result: the user spends $200 from a $100 balance.

**Vulnerable code (TypeScript/Node.js):**

```typescript
// VULNERABLE: Read-check-write without atomicity
async function processPayment(userId: string, amount: number): Promise<boolean> {
  // Step 1: Read balance
  const user = await db.query("SELECT balance FROM accounts WHERE id = $1", [userId]);
  const balance = user.rows[0].balance;

  // Step 2: Check (window of vulnerability starts here)
  if (balance < amount) {
    return false; // Insufficient funds
  }

  // Step 3: Write (another request may have already deducted between read and write)
  await db.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [amount, userId]);
  return true;
}

// Attacker sends 10 concurrent requests. All 10 read balance = $100.
// All 10 pass the check. All 10 deduct. Final balance: -$900.
```

**Secure code (TypeScript/Node.js):**

```typescript
// SECURE: Atomic conditional update in a single SQL statement
async function processPayment(userId: string, amount: number): Promise<boolean> {
  const result = await db.query(
    "UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance",
    [amount, userId]
  );

  // If no rows were updated, balance was insufficient
  return result.rowCount > 0;
}
```

### Payment Race Condition -- Coupon/Voucher Reuse

A single-use coupon is applied twice because the "check if used" and "mark as used" operations are not atomic.

**Vulnerable code (Python):**

```python
# VULNERABLE: Non-atomic check-then-mark
async def apply_coupon(coupon_code: str, order_id: str) -> bool:
    coupon = await db.fetch_one(
        "SELECT id, discount, used FROM coupons WHERE code = $1", coupon_code
    )

    if coupon is None:
        raise ValueError("Invalid coupon")

    if coupon["used"]:
        raise ValueError("Coupon already used")  # Race: two requests both see used=False

    # Window: another request is also between the check and this update
    await db.execute(
        "UPDATE coupons SET used = TRUE, order_id = $1 WHERE id = $2",
        order_id, coupon["id"]
    )
    await db.execute(
        "UPDATE orders SET discount = $1 WHERE id = $2",
        coupon["discount"], order_id
    )
    return True
```

**Secure code (Python):**

```python
# SECURE: Atomic update with WHERE clause that enforces the precondition
async def apply_coupon(coupon_code: str, order_id: str) -> bool:
    result = await db.execute(
        """
        UPDATE coupons
        SET used = TRUE, order_id = $1, used_at = NOW()
        WHERE code = $2 AND used = FALSE
        RETURNING id, discount
        """,
        order_id, coupon_code
    )

    if result is None:
        raise ValueError("Coupon is invalid or already used")

    await db.execute(
        "UPDATE orders SET discount = $1 WHERE id = $2",
        result["discount"], order_id
    )
    return True
```

---

## 2. TOCTOU Vulnerabilities (CWE-367)

**What it is:** Time-of-check to time-of-use (TOCTOU) is a specific subclass of race condition where a security check is performed (time-of-check), and then the result of that check is relied upon in a subsequent operation (time-of-use). Between the check and the use, the condition may have changed -- either due to natural concurrency or due to deliberate attacker manipulation.

TOCTOU is the most common concurrency vulnerability in security-sensitive code because developers naturally write sequential logic: "first check permission, then perform action." This pattern is fundamentally broken when the state can change between the two steps.

### File System TOCTOU

**The classic TOCTOU attack:** An application checks file permissions, then opens the file. The attacker exploits the window by swapping the file with a symlink to a privileged resource.

**Vulnerable code (Python):**

```python
import os

# VULNERABLE: TOCTOU -- check then use with a gap
def read_user_file(filepath: str) -> bytes:
    # Time-of-check: verify the file is owned by the requesting user
    stat_result = os.stat(filepath)
    if stat_result.st_uid != os.getuid():
        raise PermissionError("Not your file")

    # Time-of-use: attacker has replaced filepath with a symlink to /etc/shadow
    with open(filepath, "rb") as f:
        return f.read()
```

**Secure code (Python):**

```python
import os

# SECURE: Open first, then check on the file descriptor (no TOCTOU window)
def read_user_file(filepath: str) -> bytes:
    # Open with O_NOFOLLOW to reject symlinks at the OS level
    fd = os.open(filepath, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        # Check on the actual opened file descriptor -- no race window
        stat_result = os.fstat(fd)
        if stat_result.st_uid != os.getuid():
            raise PermissionError("Not your file")
        # Read from the same file descriptor we checked
        with os.fdopen(fd, "rb") as f:
            return f.read()
    except:
        os.close(fd)
        raise
```

### File System TOCTOU (Go)

**Vulnerable code (Go):**

```go
// VULNERABLE: Check then open with a race window
func ReadUserFile(path string) ([]byte, error) {
    info, err := os.Stat(path)
    if err != nil {
        return nil, err
    }
    // Time-of-check
    if info.Mode()&os.ModeSymlink != 0 {
        return nil, fmt.Errorf("symlinks not allowed")
    }
    // Time-of-use -- attacker replaced the file between Stat and Open
    return os.ReadFile(path)
}
```

**Secure code (Go):**

```go
// SECURE: Open first, then validate on the already-opened descriptor
func ReadUserFile(path string) ([]byte, error) {
    // Use Lstat + open with checks on the same fd
    f, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
    if err != nil {
        return nil, fmt.Errorf("failed to open file: %w", err)
    }
    defer f.Close()

    info, err := f.Stat()
    if err != nil {
        return nil, err
    }
    if info.Mode()&os.ModeSymlink != 0 {
        return nil, fmt.Errorf("symlinks not allowed")
    }
    return io.ReadAll(f)
}
```

### Database TOCTOU

**Vulnerable code (TypeScript):**

```typescript
// VULNERABLE: Check balance, then deduct in separate operations
async function withdraw(accountId: string, amount: number): Promise<void> {
  // Time-of-check
  const { rows } = await db.query(
    "SELECT balance FROM accounts WHERE id = $1",
    [accountId]
  );
  if (rows[0].balance < amount) {
    throw new Error("Insufficient funds");
  }

  // Time-of-use -- balance may have changed
  await db.query(
    "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
    [amount, accountId]
  );
}
```

**Secure code (TypeScript) -- Atomic conditional update:**

```typescript
// SECURE: Combine check and update into a single atomic operation
async function withdraw(accountId: string, amount: number): Promise<void> {
  const result = await db.query(
    "UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance",
    [amount, accountId]
  );
  if (result.rowCount === 0) {
    throw new Error("Insufficient funds");
  }
}
```

**Secure code (TypeScript) -- Transaction with row-level lock:**

```typescript
// SECURE: SELECT FOR UPDATE locks the row for the duration of the transaction
async function withdraw(accountId: string, amount: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE",
      [accountId]
    );
    if (rows[0].balance < amount) {
      await client.query("ROLLBACK");
      throw new Error("Insufficient funds");
    }

    await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [amount, accountId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

---

## 3. Database-Level Race Conditions

### Anomaly Types

```
Database Concurrency Anomalies:
+-------------------+----------------------------------------------------------+---------------------+
| Anomaly           | Description                                              | Minimum Isolation   |
+-------------------+----------------------------------------------------------+---------------------+
| Dirty Read        | Reading uncommitted data from another transaction        | Read Committed      |
| Non-Repeatable    | Same query returns different data within one transaction | Repeatable Read     |
|   Read            |   because another transaction committed a modification   |                     |
| Phantom Read      | Same query returns different rows because another        | Serializable        |
|                   |   transaction inserted/deleted matching rows             |                     |
| Lost Update       | Two transactions read the same row, both modify it,     | Repeatable Read     |
|                   |   the second commit overwrites the first                 | or SELECT FOR UPDATE|
| Write Skew        | Two transactions read overlapping data, make decisions   | Serializable        |
|                   |   based on it, and write non-overlapping data that       |                     |
|                   |   together violate an invariant                          |                     |
+-------------------+----------------------------------------------------------+---------------------+
```

### SELECT FOR UPDATE (Pessimistic Locking)

Lock the row at read time. No other transaction can read-for-update or modify the row until the lock is released (at COMMIT or ROLLBACK).

```sql
-- PostgreSQL: Transfer between accounts with row-level locking
BEGIN;

-- Lock both rows. ORDER BY ensures consistent lock ordering to prevent deadlocks.
SELECT id, balance FROM accounts
WHERE id IN ($1, $2)
ORDER BY id
FOR UPDATE;

-- Now safe to read balances and update
UPDATE accounts SET balance = balance - $amount WHERE id = $1;
UPDATE accounts SET balance = balance + $amount WHERE id = $2;

COMMIT;
```

### Optimistic Locking (Version Column)

Do not lock at read time. Instead, include a version number in the WHERE clause of the update. If another transaction modified the row, the version will have changed and the update will affect zero rows.

**Schema:**

```sql
CREATE TABLE products (
    id         UUID PRIMARY KEY,
    name       TEXT NOT NULL,
    price      NUMERIC(10,2) NOT NULL,
    stock      INTEGER NOT NULL CHECK (stock >= 0),
    version    INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Implementation (TypeScript):**

```typescript
// SECURE: Optimistic locking with version column
async function decrementStock(productId: string, quantity: number): Promise<void> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { rows } = await db.query(
      "SELECT stock, version FROM products WHERE id = $1",
      [productId]
    );
    const { stock, version } = rows[0];

    if (stock < quantity) {
      throw new Error("Insufficient stock");
    }

    const result = await db.query(
      `UPDATE products
       SET stock = stock - $1, version = version + 1, updated_at = NOW()
       WHERE id = $2 AND version = $3
       RETURNING version`,
      [quantity, productId, version]
    );

    if (result.rowCount > 0) {
      return; // Success -- version matched, update applied
    }

    // Version mismatch -- another transaction modified the row. Retry.
    if (attempt === maxRetries - 1) {
      throw new Error("Concurrent modification detected after max retries");
    }
  }
}
```

### Serializable Isolation

The strongest isolation level. The database guarantees that the result of concurrent transactions is equivalent to some serial execution order. If a serialization conflict is detected, one transaction is aborted.

```typescript
// SECURE: Serializable isolation for write-skew prevention
async function bookSeat(flightId: string, seatId: string, userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

    const { rows } = await client.query(
      "SELECT booked_by FROM seats WHERE flight_id = $1 AND seat_id = $2",
      [flightId, seatId]
    );

    if (rows[0].booked_by !== null) {
      await client.query("ROLLBACK");
      throw new Error("Seat already booked");
    }

    await client.query(
      "UPDATE seats SET booked_by = $1 WHERE flight_id = $2 AND seat_id = $3",
      [userId, flightId, seatId]
    );
    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK");
    // Serialization failure -- safe to retry
    if (err.code === "40001") {
      throw new Error("Serialization conflict -- retry the transaction");
    }
    throw err;
  } finally {
    client.release();
  }
}
```

### Advisory Locks

Application-level named locks managed by the database. Useful when you need to serialize access to a logical resource that does not correspond to a single row.

```sql
-- PostgreSQL advisory locks
-- Lock by a numeric key (e.g., hash of resource identifier)
SELECT pg_advisory_lock(hashtext('process-daily-report'));

-- ... perform exclusive work ...

SELECT pg_advisory_unlock(hashtext('process-daily-report'));

-- Try-lock variant (non-blocking, returns true/false)
SELECT pg_try_advisory_lock(hashtext('process-daily-report'));
```

```typescript
// SECURE: Advisory lock wrapper in TypeScript
async function withAdvisoryLock<T>(
  pool: Pool,
  lockKey: string,
  timeoutMs: number,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // Try to acquire the advisory lock with a timeout
    const lockId = hashStringToInt(lockKey);
    const acquired = await client.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [lockId]
    );

    if (!acquired.rows[0].locked) {
      throw new Error(`Could not acquire lock for ${lockKey}`);
    }

    try {
      return await fn(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
    }
  } finally {
    client.release();
  }
}
```

---

## 4. Distributed Race Conditions

In distributed systems, database-level locks are insufficient because operations span multiple services, databases, and caches. Distributed coordination requires purpose-built mechanisms.

### Distributed Locks with Redis

**Basic SETNX lock (single-node Redis):**

```typescript
// Distributed lock using Redis SET NX EX (atomic set-if-not-exists with expiry)
async function acquireLock(
  redis: Redis,
  lockKey: string,
  lockValue: string,  // Unique value to identify the lock holder
  ttlSeconds: number
): Promise<boolean> {
  // SET key value NX EX ttl -- atomic operation
  const result = await redis.set(lockKey, lockValue, "EX", ttlSeconds, "NX");
  return result === "OK";
}

// Release only if we still hold the lock (compare-and-delete via Lua script)
async function releaseLock(redis: Redis, lockKey: string, lockValue: string): Promise<boolean> {
  const luaScript = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(luaScript, 1, lockKey, lockValue);
  return result === 1;
}
```

**Redlock algorithm (multi-node Redis):** For production distributed systems, a single Redis node is a single point of failure. The Redlock algorithm acquires the lock on a majority (N/2+1) of N independent Redis nodes.

```
Redlock Algorithm Steps:
1. Get current time in milliseconds.
2. Sequentially try to acquire the lock on all N Redis nodes with the SAME
   key, value, and a small per-node timeout.
3. Calculate elapsed time. If the lock was acquired on a majority of nodes
   (>= N/2+1) AND the total elapsed time is less than the lock TTL, the
   lock is considered acquired.
4. If the lock was not acquired, release it on ALL nodes (even the ones
   where it was acquired).
5. Use a randomized retry delay before retrying.

Properties:
  - Safety: At most one client holds the lock at any time.
  - Liveness: The lock eventually expires (TTL), so deadlocks are impossible.
  - Fault tolerance: The algorithm tolerates up to (N-1)/2 node failures.
```

### Idempotency Keys

Ensure that retrying an operation produces the same result as the original execution. Critical for payment processing, order creation, and any non-idempotent operation exposed over an unreliable network.

```typescript
// SECURE: Idempotency key implementation
async function processPaymentIdempotent(
  idempotencyKey: string,
  paymentRequest: PaymentRequest
): Promise<PaymentResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if this idempotency key has already been processed
    const existing = await client.query(
      `SELECT response_body, status_code
       FROM idempotency_keys
       WHERE key = $1
       FOR UPDATE`,  // Lock to prevent concurrent processing of same key
      [idempotencyKey]
    );

    if (existing.rowCount > 0) {
      await client.query("COMMIT");
      // Return the stored response -- identical to original
      return JSON.parse(existing.rows[0].response_body);
    }

    // Insert a placeholder to claim this key (prevents concurrent processing)
    await client.query(
      `INSERT INTO idempotency_keys (key, status, created_at)
       VALUES ($1, 'processing', NOW())`,
      [idempotencyKey]
    );

    // Process the payment
    const result = await executePayment(client, paymentRequest);

    // Store the result keyed by idempotency key
    await client.query(
      `UPDATE idempotency_keys
       SET status = 'completed', response_body = $1, completed_at = NOW()
       WHERE key = $2`,
      [JSON.stringify(result), idempotencyKey]
    );

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

### Optimistic Concurrency Control Across Services

When operations span multiple services and cannot share a database transaction, use version vectors or conditional writes.

```typescript
// SECURE: Optimistic concurrency with ETag-style versioning across services
async function updateInventoryAcrossServices(
  productId: string,
  quantityChange: number
): Promise<void> {
  // Read current state with version
  const current = await inventoryService.get(productId);
  const expectedVersion = current.version;

  // Compute new state
  const newStock = current.stock + quantityChange;
  if (newStock < 0) {
    throw new Error("Insufficient stock");
  }

  // Conditional write -- fails if version has changed
  const updated = await inventoryService.update(productId, {
    stock: newStock,
    version: expectedVersion  // Server rejects if version mismatch
  });

  if (!updated) {
    throw new ConflictError("Inventory was modified by another operation");
  }
}
```

---

## 5. Thread-Safe Coding Patterns

### Go -- Mutexes, Atomics, and Channels

```go
package safecache

import (
    "sync"
    "sync/atomic"
)

// --- Pattern 1: sync.Mutex for protecting shared state ---
type SafeCache struct {
    mu    sync.RWMutex
    items map[string]string
}

func NewSafeCache() *SafeCache {
    return &SafeCache{items: make(map[string]string)}
}

func (c *SafeCache) Get(key string) (string, bool) {
    c.mu.RLock()         // Multiple readers allowed concurrently
    defer c.mu.RUnlock()
    val, ok := c.items[key]
    return val, ok
}

func (c *SafeCache) Set(key, value string) {
    c.mu.Lock()          // Exclusive write lock
    defer c.mu.Unlock()
    c.items[key] = value
}

// --- Pattern 2: sync/atomic for simple counters ---
type RequestCounter struct {
    count atomic.Int64
}

func (rc *RequestCounter) Increment() {
    rc.count.Add(1)
}

func (rc *RequestCounter) Value() int64 {
    return rc.count.Load()
}

// --- Pattern 3: Channels for ownership transfer ---
// Instead of sharing memory, pass ownership through channels.
type Job struct {
    ID   string
    Data []byte
}

func ProcessJobs(jobs <-chan Job, results chan<- string) {
    for job := range jobs {
        // Each job is owned by this goroutine -- no shared state
        result := process(job)
        results <- result
    }
}
```

### Java -- Synchronized, Locks, Atomics, Concurrent Collections

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

// --- Pattern 1: synchronized keyword ---
public class BankAccount {
    private double balance;

    // SECURE: synchronized ensures mutual exclusion
    public synchronized void withdraw(double amount) {
        if (balance >= amount) {
            balance -= amount;
        } else {
            throw new IllegalStateException("Insufficient funds");
        }
    }

    public synchronized double getBalance() {
        return balance;
    }
}

// --- Pattern 2: ReentrantLock with try-lock and timeout ---
public class TimedLockExample {
    private final ReentrantLock lock = new ReentrantLock();
    private double balance;

    public boolean tryWithdraw(double amount, long timeoutMs) throws InterruptedException {
        // Try to acquire lock with timeout -- prevents deadlock
        if (lock.tryLock(timeoutMs, TimeUnit.MILLISECONDS)) {
            try {
                if (balance >= amount) {
                    balance -= amount;
                    return true;
                }
                return false;
            } finally {
                lock.unlock(); // ALWAYS unlock in finally
            }
        }
        throw new TimeoutException("Could not acquire lock");
    }
}

// --- Pattern 3: AtomicInteger for lock-free counters ---
public class HitCounter {
    private final AtomicInteger count = new AtomicInteger(0);

    public void increment() {
        count.incrementAndGet(); // Atomic compare-and-swap internally
    }

    public int get() {
        return count.get();
    }
}

// --- Pattern 4: ConcurrentHashMap for thread-safe maps ---
public class SessionStore {
    private final ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();

    public Session getOrCreate(String sessionId) {
        // computeIfAbsent is atomic -- no race between check and insert
        return sessions.computeIfAbsent(sessionId, id -> new Session(id));
    }
}
```

### Python -- threading.Lock and asyncio.Lock

```python
import threading
import asyncio
from contextlib import contextmanager

# --- Pattern 1: threading.Lock for synchronous code ---
class ThreadSafeCounter:
    def __init__(self):
        self._lock = threading.Lock()
        self._count = 0

    def increment(self):
        with self._lock:  # Automatically acquires and releases
            self._count += 1

    def value(self) -> int:
        with self._lock:
            return self._count


# --- Pattern 2: asyncio.Lock for async code ---
class AsyncRateLimiter:
    def __init__(self, max_requests: int, window_seconds: float):
        self._lock = asyncio.Lock()
        self._requests: list[float] = []
        self._max = max_requests
        self._window = window_seconds

    async def acquire(self) -> bool:
        async with self._lock:  # Only one coroutine enters this block at a time
            now = asyncio.get_event_loop().time()
            # Remove expired entries
            self._requests = [t for t in self._requests if now - t < self._window]
            if len(self._requests) >= self._max:
                return False
            self._requests.append(now)
            return True


# --- Pattern 3: RLock for reentrant locking ---
class TreeNode:
    def __init__(self, value):
        self._lock = threading.RLock()  # Reentrant: same thread can acquire multiple times
        self.value = value
        self.children = []

    def add_child(self, child):
        with self._lock:
            self.children.append(child)

    def deep_copy(self):
        with self._lock:  # Acquires lock
            copy = TreeNode(self.value)
            for child in self.children:
                copy.add_child(child.deep_copy())  # Recursive -- RLock allows re-entry
            return copy
```

### Rust -- Mutex, RwLock, Arc

```rust
use std::sync::{Arc, Mutex, RwLock};
use std::thread;

// --- Pattern 1: Arc<Mutex<T>> for shared mutable state across threads ---
fn concurrent_counter() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter_clone = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            // lock() returns a MutexGuard; lock is released when guard is dropped
            let mut num = counter_clone.lock().unwrap();
            *num += 1;
            // Guard dropped here -- lock released automatically
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }
    println!("Final count: {}", *counter.lock().unwrap()); // Always 10
}

// --- Pattern 2: RwLock for multiple readers / single writer ---
struct Config {
    settings: RwLock<HashMap<String, String>>,
}

impl Config {
    fn get(&self, key: &str) -> Option<String> {
        let settings = self.settings.read().unwrap(); // Multiple readers allowed
        settings.get(key).cloned()
    }

    fn set(&self, key: String, value: String) {
        let mut settings = self.settings.write().unwrap(); // Exclusive write access
        settings.insert(key, value);
    }
}

// Rust's type system prevents data races at compile time:
// - Cannot share &mut T across threads without synchronization
// - Send + Sync traits enforced by the compiler
// - Mutex<T> requires lock acquisition to access T
// - Lifetimes prevent use-after-free of lock guards
```

### Immutable Objects

The safest concurrency pattern: if data never changes, no synchronization is needed.

```typescript
// SECURE: Immutable configuration object
interface AppConfig {
  readonly databaseUrl: string;
  readonly maxConnections: number;
  readonly featureFlags: ReadonlyMap<string, boolean>;
}

// Create once, share freely across all threads/async operations
const config: AppConfig = Object.freeze({
  databaseUrl: process.env.DATABASE_URL!,
  maxConnections: 20,
  featureFlags: new Map([["newUI", true], ["betaFeature", false]]),
});
```

---

## 6. Deadlock Prevention

A deadlock occurs when two or more operations each hold a resource and wait for a resource held by the other, creating a circular dependency. None can proceed.

```
Deadlock Example:

Transaction A:                    Transaction B:
1. LOCK row 1                     1. LOCK row 2
2. Wait for LOCK on row 2...      2. Wait for LOCK on row 1...
   (held by B)                       (held by A)
-- Both wait forever --
```

### Prevention Strategies

**Strategy 1: Lock Ordering -- Always acquire locks in a deterministic order.**

```go
// SECURE: Always lock accounts in ascending ID order to prevent deadlocks
func Transfer(from, to *Account, amount float64) error {
    // Determine lock order by account ID (deterministic, consistent)
    first, second := from, to
    if from.ID > to.ID {
        first, second = to, from
    }

    first.mu.Lock()
    defer first.mu.Unlock()
    second.mu.Lock()
    defer second.mu.Unlock()

    if from.Balance < amount {
        return errors.New("insufficient funds")
    }
    from.Balance -= amount
    to.Balance += amount
    return nil
}
```

**Strategy 2: Lock Timeout -- Never wait indefinitely.**

```java
// SECURE: Try-lock with timeout prevents indefinite blocking
public boolean transferWithTimeout(Account from, Account to, double amount)
        throws InterruptedException {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);

    while (true) {
        if (from.getLock().tryLock()) {
            try {
                if (to.getLock().tryLock()) {
                    try {
                        if (from.getBalance() >= amount) {
                            from.debit(amount);
                            to.credit(amount);
                            return true;
                        }
                        return false;
                    } finally {
                        to.getLock().unlock();
                    }
                }
            } finally {
                from.getLock().unlock();
            }
        }

        if (System.nanoTime() >= deadline) {
            throw new TimeoutException("Could not acquire both locks within timeout");
        }
        // Back off with randomized delay to break live-lock
        Thread.sleep(ThreadLocalRandom.current().nextInt(10, 100));
    }
}
```

**Strategy 3: Database-level deadlock prevention.**

```sql
-- PostgreSQL: Lock rows in consistent order within a transaction
BEGIN;

-- Always lock by ascending ID to match other transactions' lock order
SELECT * FROM accounts
WHERE id IN (account_a_id, account_b_id)
ORDER BY id ASFOR UPDATE;

-- Perform modifications...
COMMIT;

-- PostgreSQL detects deadlocks automatically and aborts one transaction
-- with error code 40P01. Applications MUST handle this and retry.
```

**Strategy 4: Reduce lock scope -- Hold locks for the minimum time necessary.**

```go
// BAD: Holding lock during slow I/O
func (s *Service) ProcessBad(id string) {
    s.mu.Lock()
    defer s.mu.Unlock()
    data := s.cache[id]
    result := s.callExternalAPI(data) // Holds lock during network call!
    s.cache[id] = result
}

// GOOD: Minimize lock scope
func (s *Service) ProcessGood(id string) {
    s.mu.RLock()
    data := s.cache[id]
    s.mu.RUnlock()

    result := s.callExternalAPI(data) // No lock held during I/O

    s.mu.Lock()
    s.cache[id] = result
    s.mu.Unlock()
}
```

---

## 7. Double-Submit and Replay Attacks

A double-submit attack occurs when a client (malicious or accidental) submits the same request multiple times. Without protection, each submission is processed independently, leading to duplicate charges, duplicate account creation, or duplicate resource allocation.

### Idempotency Token Middleware

```typescript
// SECURE: Express middleware for idempotency key enforcement
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

interface IdempotencyRecord {
  statusCode: number;
  body: any;
  createdAt: Date;
}

const idempotencyStore = new Map<string, IdempotencyRecord>();

export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only enforce on state-changing methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers["idempotency-key"] as string;
  if (!idempotencyKey) {
    res.status(400).json({ error: "Idempotency-Key header is required for mutating requests" });
    return;
  }

  // Validate format (must be a UUID to prevent injection)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idempotencyKey)) {
    res.status(400).json({ error: "Idempotency-Key must be a valid UUID v4" });
    return;
  }

  // Scope the key to the authenticated user to prevent cross-user replay
  const scopedKey = `${req.user!.id}:${idempotencyKey}`;

  // Check for existing result
  const existing = idempotencyStore.get(scopedKey);
  if (existing) {
    res.status(existing.statusCode).json(existing.body);
    return;
  }

  // Intercept the response to capture and store the result
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    idempotencyStore.set(scopedKey, {
      statusCode: res.statusCode,
      body,
      createdAt: new Date(),
    });
    return originalJson(body);
  };

  next();
}
```

### Nonce-Based Protection

```typescript
// SECURE: Server-generated nonce for form submission deduplication
async function generateFormNonce(sessionId: string): Promise<string> {
  const nonce = crypto.randomUUID();
  // Store with TTL -- each nonce is valid for one submission only
  await redis.set(`form-nonce:${sessionId}:${nonce}`, "1", "EX", 3600);
  return nonce;
}

async function validateAndConsumeNonce(sessionId: string, nonce: string): Promise<boolean> {
  // Atomic check-and-delete: returns 1 if deleted, 0 if not found
  const result = await redis.del(`form-nonce:${sessionId}:${nonce}`);
  return result === 1;  // True only on first use; false on replay
}
```

---

## 8. Session Race Conditions

When multiple concurrent requests arrive with the same session ID, they may read, modify, and write session data simultaneously, causing corruption.

```
Session Race Condition:

Request A (adds item to cart):     Request B (changes address):
1. Read session: {cart: [X]}       1. Read session: {cart: [X]}
2. Modify: {cart: [X, Y]}         2. Modify: {cart: [X], addr: "123 St"}
3. Write session                   3. Write session
                                   -- Cart item Y is lost! B's write
                                      overwrote A's write --
```

### Prevention: Session-Level Locking

```typescript
// SECURE: Per-session lock to serialize concurrent requests
const sessionLocks = new Map<string, Promise<void>>();

async function withSessionLock<T>(
  sessionId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Wait for any existing lock on this session to complete
  while (sessionLocks.has(sessionId)) {
    await sessionLocks.get(sessionId);
  }

  let resolve: () => void;
  const lockPromise = new Promise<void>((r) => { resolve = r; });
  sessionLocks.set(sessionId, lockPromise);

  try {
    return await fn();
  } finally {
    sessionLocks.delete(sessionId);
    resolve!();
  }
}

// Usage in middleware
app.use(async (req, res, next) => {
  const sessionId = req.sessionID;
  if (sessionId) {
    await withSessionLock(sessionId, async () => {
      // Only one request per session is processed at a time
      return new Promise<void>((resolve) => {
        res.on("finish", resolve);
        next();
      });
    });
  } else {
    next();
  }
});
```

### Prevention: Atomic Session Operations

Instead of read-modify-write, use atomic operations on the session store.

```typescript
// SECURE: Redis-backed atomic session field updates
async function addToCart(sessionId: string, item: CartItem): Promise<void> {
  // RPUSH is atomic -- no read-modify-write needed
  await redis.rpush(`session:${sessionId}:cart`, JSON.stringify(item));
}

async function updateSessionField(
  sessionId: string,
  field: string,
  value: string
): Promise<void> {
  // HSET is atomic on a single field
  await redis.hset(`session:${sessionId}`, field, value);
}
```

---

## 9. File Locking

### Advisory vs Mandatory Locks

```
File Lock Types:
+------------------+-------------------------------------------------------------+
| Type             | Behavior                                                    |
+------------------+-------------------------------------------------------------+
| Advisory Lock    | Cooperative: only processes that check the lock honor it.   |
|                  | Other processes can still read/write the file.              |
|                  | Used on Linux/macOS (flock, fcntl). Most common.            |
+------------------+-------------------------------------------------------------+
| Mandatory Lock   | Enforced by the kernel: any process attempting access is    |
|                  | blocked or gets an error. Rare, OS-dependent, often         |
|                  | deprecated. Windows uses mandatory locks by default.        |
+------------------+-------------------------------------------------------------+
| Lock File        | A separate file (e.g., app.lock) whose existence indicates  |
|                  | the resource is locked. Portable but fragile -- stale locks |
|                  | from crashed processes require manual cleanup.              |
+------------------+-------------------------------------------------------------+
```

### File Locking in Python

```python
import fcntl
import os
import contextlib
from pathlib import Path

@contextlib.contextmanager
def file_lock(lock_path: str, exclusive: bool = True, timeout: float = 10.0):
    """
    Acquire a file lock. Use exclusive=True for writes, exclusive=False for reads.
    """
    lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR)
    try:
        lock_type = fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH
        fcntl.flock(lock_fd, lock_type)  # Blocks until acquired
        yield
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        os.close(lock_fd)


# Usage
def write_config(data: dict):
    with file_lock("/var/run/myapp.lock", exclusive=True):
        with open("/etc/myapp/config.json", "w") as f:
            json.dump(data, f)

def read_config() -> dict:
    with file_lock("/var/run/myapp.lock", exclusive=False):
        with open("/etc/myapp/config.json", "r") as f:
            return json.load(f)
```

### File Locking in Go

```go
package filelock

import (
    "os"
    "syscall"
)

// Flock acquires an exclusive lock on the given file.
// The lock is released when the returned file is closed.
func Flock(path string) (*os.File, error) {
    f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
    if err != nil {
        return nil, err
    }

    err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX)
    if err != nil {
        f.Close()
        return nil, err
    }
    return f, nil
}

// FlockNonBlocking tries to acquire a lock without blocking.
// Returns (file, true) if acquired, (nil, false) if lock is held by another process.
func FlockNonBlocking(path string) (*os.File, bool, error) {
    f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
    if err != nil {
        return nil, false, err
    }

    err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
    if err != nil {
        f.Close()
        if err == syscall.EWOULDBLOCK {
            return nil, false, nil
        }
        return nil, false, err
    }
    return f, true, nil
}
```

### Cross-Platform Lock File Pattern

```python
import os
import time

class LockFile:
    """
    Cross-platform lock file implementation using atomic file creation.
    Works on Linux, macOS, and Windows.
    """
    def __init__(self, path: str, timeout: float = 30.0, stale_timeout: float = 300.0):
        self.path = path
        self.timeout = timeout
        self.stale_timeout = stale_timeout

    def acquire(self) -> bool:
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            try:
                # O_CREAT | O_EXCL is atomic: fails if file already exists
                fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
                # Write PID for stale lock detection
                os.write(fd, str(os.getpid()).encode())
                os.close(fd)
                return True
            except FileExistsError:
                # Check for stale lock (crashed process)
                self._check_stale()
                time.sleep(0.1)
        return False

    def release(self):
        try:
            os.unlink(self.path)
        except FileNotFoundError:
            pass

    def _check_stale(self):
        try:
            stat = os.stat(self.path)
            age = time.time() - stat.st_mtime
            if age > self.stale_timeout:
                os.unlink(self.path)  # Remove stale lock
        except FileNotFoundError:
            pass

    def __enter__(self):
        if not self.acquire():
            raise TimeoutError(f"Could not acquire lock: {self.path}")
        return self

    def __exit__(self, *args):
        self.release()
```

---

## 10. Atomic Operations in Financial and Critical Systems

Financial operations demand the strongest concurrency guarantees. Every monetary operation must be atomic, consistent, isolated, and durable (ACID). Partial execution, double-charging, or lost updates are not acceptable.

### Compare-and-Swap (CAS) for In-Memory State

```go
package balance

import "sync/atomic"

// AtomicBalance uses compare-and-swap for lock-free balance updates.
// Stores balance in cents as int64 to avoid floating-point issues.
type AtomicBalance struct {
    cents atomic.Int64
}

func (b *AtomicBalance) Debit(amountCents int64) bool {
    for {
        current := b.cents.Load()
        if current < amountCents {
            return false // Insufficient funds
        }
        newBalance := current - amountCents
        // CompareAndSwap: only succeeds if value is still 'current'
        if b.cents.CompareAndSwap(current, newBalance) {
            return true // Successfully debited
        }
        // Another goroutine modified the balance -- retry
    }
}

func (b *AtomicBalance) Credit(amountCents int64) {
    b.cents.Add(amountCents) // Add is inherently atomic
}

func (b *AtomicBalance) Balance() int64 {
    return b.cents.Load()
}
```

### Database Transactions for Monetary Operations

```typescript
// SECURE: Double-entry bookkeeping with database transaction
async function transfer(
  fromAccountId: string,
  toAccountId: string,
  amountCents: number,
  description: string,
  idempotencyKey: string
): Promise<TransferResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Idempotency check
    const existing = await client.query(
      "SELECT id FROM transfers WHERE idempotency_key = $1",
      [idempotencyKey]
    );
    if (existing.rowCount > 0) {
      await client.query("COMMIT");
      return { status: "already_processed", transferId: existing.rows[0].id };
    }

    // Lock both accounts in consistent order (ascending ID)
    const accounts = await client.query(
      `SELECT id, balance_cents FROM accounts
       WHERE id = ANY($1)
       ORDER BY id
       FOR UPDATE`,
      [[fromAccountId, toAccountId].sort()]
    );

    const fromAccount = accounts.rows.find((a: any) => a.id === fromAccountId);
    const toAccount = accounts.rows.find((a: any) => a.id === toAccountId);

    if (!fromAccount || !toAccount) {
      throw new Error("Account not found");
    }
    if (fromAccount.balance_cents < amountCents) {
      throw new Error("Insufficient funds");
    }

    // Create the transfer record
    const { rows: [transfer] } = await client.query(
      `INSERT INTO transfers (from_account, to_account, amount_cents, description, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [fromAccountId, toAccountId, amountCents, description, idempotencyKey]
    );

    // Double-entry ledger entries
    await client.query(
      `INSERT INTO ledger_entries (account_id, transfer_id, amount_cents, direction)
       VALUES ($1, $2, $3, 'debit'), ($4, $2, $3, 'credit')`,
      [fromAccountId, transfer.id, amountCents, toAccountId]
    );

    // Update balances
    await client.query(
      "UPDATE accounts SET balance_cents = balance_cents - $1 WHERE id = $2",
      [amountCents, fromAccountId]
    );
    await client.query(
      "UPDATE accounts SET balance_cents = balance_cents + $1 WHERE id = $2",
      [amountCents, toAccountId]
    );

    await client.query("COMMIT");
    return { status: "completed", transferId: transfer.id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

### Event Sourcing for Consistency

Event sourcing stores every state change as an immutable event. The current state is derived by replaying events. This eliminates update anomalies because state is never mutated -- only new events are appended.

```typescript
// SECURE: Event-sourced account with concurrency control
interface AccountEvent {
  eventId: string;
  accountId: string;
  type: "credited" | "debited";
  amountCents: number;
  timestamp: Date;
  expectedVersion: number; // Optimistic concurrency check
}

async function appendAccountEvent(event: AccountEvent): Promise<void> {
  // The UNIQUE constraint on (account_id, version) prevents concurrent
  // appends with the same version number. One will fail with a conflict.
  try {
    await db.query(
      `INSERT INTO account_events (event_id, account_id, type, amount_cents, version, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event.eventId, event.accountId, event.type, event.amountCents,
       event.expectedVersion, event.timestamp]
    );
  } catch (err: any) {
    if (err.code === "23505") { // Unique violation
      throw new ConcurrencyConflictError(
        "Another operation modified this account concurrently. Retry with current version."
      );
    }
    throw err;
  }
}

async function getAccountBalance(accountId: string): Promise<{ balance: number; version: number }> {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(
       CASE WHEN type = 'credited' THEN amount_cents
            WHEN type = 'debited' THEN -amount_cents
       END), 0) AS balance_cents,
       COALESCE(MAX(version), 0) AS version
     FROM account_events
     WHERE account_id = $1`,
    [accountId]
  );
  return { balance: rows[0].balance_cents, version: rows[0].version };
}
```

---

## 11. Secure Concurrency in Web Applications

### Request-Level Isolation

Every HTTP request must be treated as an isolated unit of work. Shared mutable state between requests is the single greatest source of concurrency bugs in web applications.

```
Concurrency Models and Their Security Properties:
+-------------------+---------------------+--------------------------------------+
| Model             | Shared State Risk   | Guidance                             |
+-------------------+---------------------+--------------------------------------+
| Process-per-      | Low                 | Each request in its own process.     |
|   request         |                     | Memory is isolated by the OS.        |
|   (PHP, CGI)      |                     | Safest but highest overhead.         |
+-------------------+---------------------+--------------------------------------+
| Thread-per-       | High                | Threads share heap memory.           |
|   request         |                     | All mutable static/global vars are   |
|   (Java Servlets, |                     | shared. Requires explicit sync.      |
|   .NET)           |                     |                                      |
+-------------------+---------------------+--------------------------------------+
| Async event loop  | Medium              | Single thread, but shared state      |
|   (Node.js,       |                     | between async operations. Race       |
|   Python asyncio) |                     | conditions at await points.          |
+-------------------+---------------------+--------------------------------------+
| Actor model       | Low                 | State is encapsulated in actors.     |
|   (Erlang, Akka)  |                     | Communication by message passing.    |
|                   |                     | No shared mutable state by design.   |
+-------------------+---------------------+--------------------------------------+
```

### Shared State Dangers in Node.js

Node.js is single-threaded but NOT immune to race conditions. Any time an `await` yields control, other request handlers can run and modify shared state.

```typescript
// VULNERABLE: Global mutable state shared across all requests
let requestCount = 0;
const rateLimitMap: Record<string, number> = {};

app.use(async (req, res, next) => {
  requestCount++;

  const ip = req.ip;
  rateLimitMap[ip] = (rateLimitMap[ip] || 0) + 1;

  // This await yields control to the event loop.
  // Another request may have modified rateLimitMap[ip] between the line above
  // and the check below.
  await someAsyncOperation();

  if (rateLimitMap[ip] > 100) {
    res.status(429).send("Too many requests");
    return;
  }

  next();
});

// SECURE: Use atomic operations in an external store (Redis)
app.use(async (req, res, next) => {
  const ip = req.ip;
  const key = `ratelimit:${ip}:${Math.floor(Date.now() / 60000)}`;

  // INCR is atomic in Redis -- no race condition
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }

  if (count > 100) {
    res.status(429).send("Too many requests");
    return;
  }

  next();
});
```

### Connection Pool Thread Safety

Database connection pools must be thread-safe. Never share a single connection across concurrent requests.

```typescript
// VULNERABLE: Sharing a single database connection across requests
const sharedConnection = await pg.connect(); // Single connection

app.get("/users/:id", async (req, res) => {
  // Multiple requests use the same connection concurrently.
  // Interleaved queries produce unpredictable results.
  // One request's BEGIN/COMMIT affects another request's transaction.
  const result = await sharedConnection.query(
    "SELECT * FROM users WHERE id = $1",
    [req.params.id]
  );
  res.json(result.rows[0]);
});

// SECURE: Use a connection pool; each request gets its own connection
const pool = new Pool({
  max: 20,                   // Maximum concurrent connections
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if no connection available within 5s
});

app.get("/users/:id", async (req, res) => {
  // pool.query automatically checks out a connection, runs the query,
  // and returns the connection to the pool
  const result = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [req.params.id]
  );
  res.json(result.rows[0]);
});
```

### Process-Level Isolation for Critical Operations

```python
# SECURE: Use separate worker processes for critical operations
# to ensure memory isolation (no shared mutable state)
from multiprocessing import Process, Queue

def process_payment(payment_data: dict, result_queue: Queue):
    """Runs in a separate process -- fully isolated memory space."""
    try:
        result = execute_payment(payment_data)
        result_queue.put({"status": "success", "data": result})
    except Exception as e:
        result_queue.put({"status": "error", "message": str(e)})

def handle_payment_request(payment_data: dict) -> dict:
    result_queue = Queue()
    proc = Process(target=process_payment, args=(payment_data, result_queue))
    proc.start()
    proc.join(timeout=30)

    if proc.is_alive():
        proc.terminate()
        raise TimeoutError("Payment processing timed out")

    return result_queue.get()
```

---

## Best Practices

### 1. Treat All Shared Mutable State as a Security Boundary

Every variable, database row, file, or cache entry that is accessed by more than one concurrent operation is a potential security vulnerability. Map all shared mutable state in your system. For each piece, document the synchronization mechanism that protects it. If there is no synchronization mechanism, there is a vulnerability.

### 2. Prefer Atomic Operations Over Check-Then-Act Patterns

Never separate the check from the action. Use `UPDATE ... WHERE condition RETURNING`, `INSERT ... ON CONFLICT`, Redis `SETNX`, `INCR`, or compare-and-swap instructions. Atomic operations eliminate the race window entirely. If an operation cannot be expressed atomically, use an explicit lock.

### 3. Use Database-Level Concurrency Controls for Database State

Application-level locks (mutexes, semaphores) do not protect against concurrent access from other application instances, cron jobs, admin scripts, or database migrations. Use `SELECT FOR UPDATE`, optimistic locking with version columns, unique constraints, serializable isolation, or advisory locks. The database is the single source of truth and the single enforcer of invariants.

### 4. Implement Idempotency for All State-Changing API Endpoints

Every POST, PUT, PATCH, and DELETE endpoint must accept an idempotency key. Store the key and the response. On duplicate requests, return the stored response without re-executing the operation. This protects against double-submit, network retries, and replay attacks simultaneously.

### 5. Always Acquire Locks in a Consistent, Deterministic Order

When multiple locks must be held simultaneously, always acquire them in the same global order (e.g., ascending resource ID). This eliminates the circular dependency that causes deadlocks. Document the lock ordering convention in your codebase.

### 6. Set Timeouts on Every Lock Acquisition

Never use blocking lock acquisition without a timeout. Use `tryLock(timeout)` in Java, `LOCK_NB` flags in file locking, `SET ... NX EX ttl` in Redis, and `lock_timeout` in PostgreSQL. A lock that cannot be acquired within a reasonable time indicates a bug or a deadlock -- fail fast and let the caller retry.

### 7. Minimize Lock Scope and Duration

Hold locks for the absolute minimum time required. Never hold a lock across I/O operations (network calls, disk reads, external API calls). Read the data under the lock, release the lock, perform the slow operation, then re-acquire the lock to write the result (re-validating the precondition after re-acquisition).

### 8. Use Immutable Data Structures by Default

Immutable objects are inherently thread-safe -- they require no synchronization. Use `Object.freeze()` in JavaScript, `final` fields in Java, `Readonly<T>` in TypeScript, frozen dataclasses in Python, and ownership semantics in Rust. Only make data mutable when mutation is a genuine requirement, and then protect it with explicit synchronization.

### 9. Test for Concurrency Vulnerabilities Explicitly

Race conditions do not appear in sequential unit tests. Write concurrency tests that launch multiple goroutines/threads/async tasks and attempt to exploit race windows. Use Go's `-race` flag, Java's `Thread.sleep()` injection, or tools like Turbo Intruder for HTTP-level race testing. Test with the same concurrency level an attacker would use (hundreds or thousands of simultaneous requests).

### 10. Monitor and Alert on Concurrency Anomalies

Log and alert on: deadlock detection events, serialization failures (PostgreSQL error 40001), optimistic lock retries exceeding a threshold, lock acquisition timeouts, idempotency key collisions, and balance invariant violations. These are early indicators of either bugs or active exploitation attempts.

---

## Anti-Patterns

### Anti-Pattern 1: Read-Check-Write Without Atomicity

```typescript
// WRONG: Three separate operations with race windows between each
const balance = await getBalance(userId);    // Read
if (balance >= amount) {                      // Check
  await deductBalance(userId, amount);        // Write -- balance may have changed
}

// CORRECT: Single atomic operation
await db.query(
  "UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1",
  [amount, userId]
);
```

This is the most common and most exploitable concurrency anti-pattern. Every read-check-write without atomicity is a potential double-spend, double-use, or privilege escalation vulnerability.

### Anti-Pattern 2: Using Application-Level Locks for Database State

```typescript
// WRONG: Mutex only protects this process -- other instances are unprotected
const mutex = new Mutex();
await mutex.acquire();
try {
  const stock = await getStock(productId);
  if (stock > 0) {
    await setStock(productId, stock - 1);
  }
} finally {
  mutex.release();
}

// CORRECT: Use database-level locking
await db.query(
  "UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0",
  [productId]
);
```

In-memory locks protect only the single process instance. In any deployment with multiple replicas, workers, or serverless instances, application-level locks provide zero concurrency protection for database state.

### Anti-Pattern 3: Ignoring Return Values of Conditional Updates

```typescript
// WRONG: Does not check if the update actually matched any rows
await db.query(
  "UPDATE vouchers SET used = TRUE WHERE code = $1 AND used = FALSE",
  [code]
);
// Proceeds as if the voucher was valid and unused -- even if it was already used
await applyDiscount(orderId, discountAmount);

// CORRECT: Check rowCount before proceeding
const result = await db.query(
  "UPDATE vouchers SET used = TRUE WHERE code = $1 AND used = FALSE RETURNING id, discount",
  [code]
);
if (result.rowCount === 0) {
  throw new Error("Voucher is invalid or already used");
}
await applyDiscount(orderId, result.rows[0].discount);
```

### Anti-Pattern 4: Holding Locks During I/O Operations

```go
// WRONG: Lock held during network call -- blocks all other goroutines
mu.Lock()
response, err := http.Get("https://api.example.com/slow-endpoint")
processResponse(response)
mu.Unlock()

// CORRECT: Minimize lock scope; never hold locks during I/O
mu.Lock()
dataToSend := cache[key] // Quick read under lock
mu.Unlock()

response, err := http.Get("https://api.example.com/slow-endpoint") // No lock held

mu.Lock()
cache[key] = processResponse(response) // Quick write under lock
mu.Unlock()
```

Holding locks during I/O causes extreme contention, performance degradation, and increases the probability of deadlocks and timeouts.

### Anti-Pattern 5: Using Non-Thread-Safe Data Structures Concurrently

```go
// WRONG: map is not goroutine-safe in Go
var cache = make(map[string]string) // Shared across goroutines

func handler(w http.ResponseWriter, r *http.Request) {
    cache[r.URL.Path] = "visited" // DATA RACE -- concurrent map writes
    // Causes panic: "concurrent map writes"
}

// CORRECT: Use sync.Map or protect with a mutex
var cache sync.Map

func handler(w http.ResponseWriter, r *http.Request) {
    cache.Store(r.URL.Path, "visited") // Thread-safe
}
```

```java
// WRONG: HashMap is not thread-safe
Map<String, Session> sessions = new HashMap<>(); // Shared across threads

// CORRECT: Use ConcurrentHashMap
Map<String, Session> sessions = new ConcurrentHashMap<>();
```

### Anti-Pattern 6: Lock-and-Forget (Missing Unlock in Error Paths)

```go
// WRONG: If processData panics, the lock is never released -- deadlock
mu.Lock()
result := processData(data) // What if this panics?
mu.Unlock()

// CORRECT: Always use defer for unlock
mu.Lock()
defer mu.Unlock()
result := processData(data) // Even if this panics, defer runs
```

```java
// WRONG: Exception before unlock
lock.lock();
riskyOperation(); // Throws exception -- lock never released!
lock.unlock();

// CORRECT: Always unlock in finally
lock.lock();
try {
    riskyOperation();
} finally {
    lock.unlock();
}
```

### Anti-Pattern 7: Trusting Client-Side Deduplication

```typescript
// WRONG: Relying on the client to not double-submit
app.post("/api/orders", async (req, res) => {
  // No server-side deduplication
  // A user refreshing the page or a network retry creates duplicate orders
  const order = await createOrder(req.body);
  res.json(order);
});

// CORRECT: Server-side idempotency enforcement
app.post("/api/orders", async (req, res) => {
  const idempotencyKey = req.headers["idempotency-key"];
  if (!idempotencyKey) {
    return res.status(400).json({ error: "Idempotency-Key header required" });
  }
  const order = await createOrderIdempotent(idempotencyKey, req.body);
  res.json(order);
});
```

Client-side deduplication (disabling the submit button, JavaScript throttling) is a UX convenience, not a security control. Attackers bypass the client entirely.

### Anti-Pattern 8: Using setTimeout/sleep as a Synchronization Mechanism

```typescript
// WRONG: Using delay to "avoid" race conditions
async function processOrder(orderId: string): Promise<void> {
  await createOrder(orderId);
  await new Promise(resolve => setTimeout(resolve, 500)); // "Wait for other ops"
  await chargePayment(orderId); // Hopes the race window has passed
}

// CORRECT: Use proper synchronization -- transactions, locks, or atomic operations
async function processOrder(orderId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO orders (id, status) VALUES ($1, 'created')",
      [orderId]
    );
    await client.query(
      "INSERT INTO payments (order_id, status) VALUES ($1, 'charged')",
      [orderId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

Sleeps and delays are timing-dependent, non-deterministic, and provide zero guarantee of correct ordering. They mask race conditions in development and fail catastrophically under load.

---

## Enforcement Checklist

Use this checklist during code review and security assessment. Every item must be verified for any code that handles concurrent access to shared state.

### Race Condition Prevention

- [ ] All monetary/financial operations use atomic database operations or transactions with appropriate locking.
- [ ] No read-check-write pattern exists without atomicity (either single atomic statement, `SELECT FOR UPDATE`, or optimistic locking).
- [ ] All single-use resources (coupons, vouchers, invitations, tokens) use atomic claim operations (`UPDATE ... WHERE used = FALSE RETURNING ...`).
- [ ] Balance checks and deductions happen in a single atomic operation, not in separate queries.
- [ ] All `UPDATE` and `DELETE` statements that depend on a precondition include the precondition in the `WHERE` clause.
- [ ] Return values (`rowCount`, `RETURNING`) of conditional updates are always checked before proceeding.

### TOCTOU Prevention

- [ ] File operations use `O_NOFOLLOW` to reject symlinks where appropriate.
- [ ] File permission checks use `fstat()` on an open file descriptor, not `stat()` on a path.
- [ ] No filesystem check-then-act pattern exists where an attacker could modify the file between check and use.
- [ ] Temporary files are created in secure directories with restrictive permissions (`0600`, `0700`).
- [ ] Temporary files are created using secure functions (`mkstemp`, `tempfile.NamedTemporaryFile`) that open the file atomically.

### Database Concurrency

- [ ] The appropriate isolation level is set for each transaction based on its consistency requirements.
- [ ] `SELECT FOR UPDATE` is used when a row must be read and then updated within a transaction.
- [ ] Optimistic locking (version column) is used where appropriate, with retry logic for version conflicts.
- [ ] Lock ordering is consistent: when locking multiple rows, always lock in ascending primary key order.
- [ ] Serialization failures (error code `40001` in PostgreSQL) are caught and retried.
- [ ] Database connection pools are used; connections are never shared across concurrent requests.

### Distributed Concurrency

- [ ] Distributed locks (Redis SETNX, Redlock, ZooKeeper) have TTLs to prevent indefinite lock holding.
- [ ] Lock release uses compare-and-delete (Lua script) to prevent releasing another holder's lock.
- [ ] Idempotency keys are required on all state-changing API endpoints.
- [ ] Idempotency keys are scoped to the authenticated user to prevent cross-user replay.
- [ ] Idempotency key format is validated (UUID v4) to prevent injection.
- [ ] Stored idempotency responses have a TTL and are cleaned up.

### Thread Safety

- [ ] All mutable global/static variables are protected by locks or replaced with thread-safe alternatives.
- [ ] Lock acquisition always uses `defer` (Go), `finally` (Java), `with` (Python), or RAII (Rust, C++) to guarantee release.
- [ ] No lock is held during I/O, network calls, or other blocking operations unless absolutely necessary.
- [ ] Locks have timeouts; no lock acquisition blocks indefinitely.
- [ ] Lock ordering is documented and enforced to prevent deadlocks.
- [ ] Thread-safe data structures (`ConcurrentHashMap`, `sync.Map`, `Arc<Mutex<T>>`) are used for shared state.

### Web Application Concurrency

- [ ] No mutable module-level or global state is shared across HTTP requests without synchronization.
- [ ] Session operations use atomic store operations or session-level locking to prevent data corruption.
- [ ] Rate limiting uses atomic counters in an external store (Redis `INCR`), not in-memory variables.
- [ ] Form submissions use server-generated nonces to prevent double-submit.
- [ ] File upload handlers do not write to predictable paths without proper locking and permission checks.

### Testing and Monitoring

- [ ] Concurrency tests exist that launch concurrent operations against race-prone endpoints.
- [ ] Go code is tested with the `-race` flag in CI/CD.
- [ ] Deadlock detection events, lock timeouts, and serialization failures are logged and alerted on.
- [ ] Financial invariants (sum of all debits equals sum of all credits) are verified by periodic reconciliation jobs.
- [ ] Load tests include concurrent access to the same resource (same user, same account, same voucher) to expose race conditions.
