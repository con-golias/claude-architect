# Locking Strategies & Concurrency Control

> **Domain:** Database > Transactions
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

When two users update the same row simultaneously, one of their changes will be lost — unless you have a locking strategy. Databases provide multiple locking mechanisms: row-level locks, table locks, advisory locks, and application-level optimistic locking. Choosing the wrong strategy leads to either data corruption (too little locking) or deadlocks and performance bottlenecks (too much locking). In high-concurrency systems — e-commerce checkouts, booking systems, inventory management — correct locking is the difference between a working product and a broken one.

---

## How It Works

### Pessimistic vs Optimistic Locking

```
PESSIMISTIC LOCKING (Lock First, Then Work)
──────────────────────────────────────────
Tx A: SELECT ... FOR UPDATE;     ← acquires row lock
Tx B: SELECT ... FOR UPDATE;     ← BLOCKS (waits for Tx A)
Tx A: UPDATE ... ; COMMIT;       ← releases lock
Tx B: (now proceeds)             ← gets lock, reads current data


OPTIMISTIC LOCKING (Work First, Check at Write)
──────────────────────────────────────────
Tx A: SELECT id, balance, version FROM accounts WHERE id = 1;
      → balance=500, version=3
Tx B: SELECT id, balance, version FROM accounts WHERE id = 1;
      → balance=500, version=3

Tx A: UPDATE accounts SET balance=400, version=4
      WHERE id=1 AND version=3;    → 1 row updated ✓

Tx B: UPDATE accounts SET balance=300, version=4
      WHERE id=1 AND version=3;    → 0 rows updated ✗ (version changed!)
      → Application retries with fresh data
```

**When to use which:**

| Strategy | Best For | Tradeoff |
|----------|----------|----------|
| **Pessimistic** | High contention, short transactions | Blocks other transactions, risk of deadlocks |
| **Optimistic** | Low contention, long operations | Retry overhead, wasted work on conflict |

---

### PostgreSQL Row-Level Locks

#### SELECT ... FOR UPDATE

```sql
-- Exclusive row lock — blocks other FOR UPDATE and writes
BEGIN;
SELECT * FROM inventory
WHERE product_id = 42
FOR UPDATE;
-- Row is now locked — no other transaction can modify it

UPDATE inventory SET stock = stock - 1
WHERE product_id = 42;
COMMIT;
```

#### SELECT ... FOR SHARE

```sql
-- Shared row lock — blocks writes but allows other FOR SHARE
BEGIN;
SELECT * FROM products
WHERE id = 42
FOR SHARE;
-- Other transactions CAN read (even FOR SHARE)
-- Other transactions CANNOT write or FOR UPDATE

-- Useful when you need to ensure row is not modified
-- while you read related data
SELECT * FROM reviews WHERE product_id = 42;
COMMIT;
```

#### Lock Modes Summary

| Lock Mode | Blocks FOR UPDATE | Blocks FOR SHARE | Blocks UPDATE/DELETE |
|-----------|:-----------------:|:-----------------:|:-------------------:|
| `FOR UPDATE` | Yes | Yes | Yes |
| `FOR NO KEY UPDATE` | Yes | No | Yes |
| `FOR SHARE` | Yes | No | Yes |
| `FOR KEY SHARE` | No | No | No (except key changes) |

#### SKIP LOCKED — Non-blocking Queue Pattern

```sql
-- Worker picks up next unprocessed job WITHOUT blocking
BEGIN;
SELECT * FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;  -- skip rows locked by other workers

-- Process the job
UPDATE jobs SET status = 'processing', worker_id = 'worker-1'
WHERE id = <selected_id>;
COMMIT;
```

```
Worker 1                       Worker 2                     Worker 3
SELECT FOR UPDATE SKIP LOCKED  SELECT FOR UPDATE SKIP LOCKED SELECT FOR UPDATE SKIP LOCKED
→ gets Job A (locks it)        → skips A, gets Job B         → skips A,B, gets Job C

No blocking! Each worker gets a different job immediately.
```

#### NOWAIT — Fail Instead of Wait

```sql
-- Immediately fail if row is locked (do not wait)
BEGIN;
SELECT * FROM inventory
WHERE product_id = 42
FOR UPDATE NOWAIT;
-- If row is locked: ERROR: could not obtain lock on row
-- Application can retry or return "try again" to user
```

---

### Optimistic Locking Implementation

#### Version Column Pattern

```sql
-- Schema
CREATE TABLE products (
    id         BIGINT PRIMARY KEY,
    name       TEXT NOT NULL,
    price      DECIMAL(10,2) NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1
);
```

```go
// Go — optimistic locking with version column
func updateProductPrice(ctx context.Context, db *sql.DB, id int64, newPrice float64) error {
    for retries := 0; retries < 3; retries++ {
        // 1. Read current version
        var currentVersion int
        var currentPrice float64
        err := db.QueryRowContext(ctx,
            "SELECT price, version FROM products WHERE id = $1", id,
        ).Scan(&currentPrice, &currentVersion)
        if err != nil {
            return err
        }

        // 2. Business logic (could be complex, take time)
        if newPrice < 0 {
            return fmt.Errorf("price cannot be negative")
        }

        // 3. Update with version check
        result, err := db.ExecContext(ctx,
            `UPDATE products
             SET price = $1, version = version + 1
             WHERE id = $2 AND version = $3`,
            newPrice, id, currentVersion,
        )
        if err != nil {
            return err
        }

        rowsAffected, _ := result.RowsAffected()
        if rowsAffected == 0 {
            // Version changed — someone else modified the row
            continue // retry
        }
        return nil // success
    }
    return fmt.Errorf("optimistic lock failed after 3 retries")
}
```

```typescript
// TypeScript — Prisma optimistic locking
async function updateProductPrice(id: number, newPrice: number): Promise<void> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id },
    });

    try {
      await prisma.product.update({
        where: {
          id,
          version: product.version, // optimistic lock check
        },
        data: {
          price: newPrice,
          version: { increment: 1 },
        },
      });
      return; // success
    } catch (error) {
      if (error.code === 'P2025') {
        // Record not found (version mismatch)
        continue; // retry
      }
      throw error;
    }
  }
  throw new Error('Optimistic lock failed after max retries');
}
```

```python
# Python — SQLAlchemy optimistic locking
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    price: Mapped[float]
    version: Mapped[int] = mapped_column(default=1)

    __mapper_args__ = {
        "version_id_col": version,  # SQLAlchemy built-in optimistic locking
    }

# Usage — SQLAlchemy automatically checks version on update
try:
    product = session.get(Product, 42)
    product.price = 29.99
    session.commit()  # includes WHERE version = <original_version>
except StaleDataError:
    session.rollback()
    # Retry with fresh data
```

#### updated_at Timestamp Pattern

```sql
-- Alternative: use timestamp instead of version number
UPDATE products
SET price = 29.99, updated_at = NOW()
WHERE id = 42 AND updated_at = '2024-01-15 10:30:00';
-- 0 rows affected = conflict detected

-- WARNING: timestamp precision issues possible
-- Version integer is safer and more portable
```

---

### Advisory Locks

Application-level locks managed by the database — not tied to rows or tables:

```sql
-- PostgreSQL advisory locks
-- Use case: ensure only one instance processes a specific resource

-- Session-level lock (held until session ends or explicit unlock)
SELECT pg_advisory_lock(12345);        -- blocks if already held
-- ... do work ...
SELECT pg_advisory_unlock(12345);

-- Transaction-level lock (released at COMMIT/ROLLBACK)
SELECT pg_advisory_xact_lock(12345);   -- released automatically
-- ... do work ...
COMMIT;

-- Try lock (non-blocking — returns true/false)
SELECT pg_try_advisory_lock(12345);    -- returns false if already held

-- Two-key lock (for resource-type + resource-id pattern)
SELECT pg_advisory_lock(1, 42);        -- lock type=1 (orders), id=42
SELECT pg_advisory_lock(2, 42);        -- lock type=2 (products), id=42
```

```go
// Go — advisory lock for singleton job processing
func processMonthlyBilling(ctx context.Context, db *sql.DB) error {
    // Try to acquire advisory lock (non-blocking)
    var acquired bool
    err := db.QueryRowContext(ctx,
        "SELECT pg_try_advisory_lock($1)", hashCode("monthly-billing"),
    ).Scan(&acquired)
    if err != nil {
        return err
    }
    if !acquired {
        return nil // another instance is already processing
    }
    defer db.ExecContext(ctx,
        "SELECT pg_advisory_unlock($1)", hashCode("monthly-billing"))

    // Only one instance reaches here
    return runBillingProcess(ctx, db)
}
```

**Advisory lock use cases:**
- Singleton job processing (only one worker runs a specific job)
- Rate limiting at the database level
- Distributed locking without external tools (Redis, etcd)
- Preventing concurrent schema migrations

---

### Deadlocks

```
DEADLOCK SCENARIO:
Tx A: locks Row 1, wants Row 2
Tx B: locks Row 2, wants Row 1

Tx A: BEGIN; UPDATE accounts SET balance=100 WHERE id=1; -- locks row 1
Tx B: BEGIN; UPDATE accounts SET balance=200 WHERE id=2; -- locks row 2
Tx A: UPDATE accounts SET balance=300 WHERE id=2;        -- WAITS for Tx B
Tx B: UPDATE accounts SET balance=400 WHERE id=1;        -- WAITS for Tx A

  ┌────────┐         ┌────────┐
  │  Tx A  │──waits──►  Tx B  │
  │        │◄──waits──│        │
  └────────┘         └────────┘
       DEADLOCK DETECTED!

PostgreSQL: detects deadlock, aborts one transaction with:
  ERROR: deadlock detected
  DETAIL: Process 1234 waits for ShareLock on transaction 5678
```

**Deadlock prevention strategies:**

```sql
-- Strategy 1: Always lock in the same order
-- Instead of random order, always lock lower ID first
BEGIN;
UPDATE accounts SET balance = balance - 100
WHERE id = LEAST(from_id, to_id);  -- lower ID first
UPDATE accounts SET balance = balance + 100
WHERE id = GREATEST(from_id, to_id);  -- higher ID second
COMMIT;

-- Strategy 2: Use lock timeout
SET lock_timeout = '5s';  -- give up after 5 seconds instead of waiting forever

-- Strategy 3: Use NOWAIT
SELECT * FROM accounts WHERE id = 1 FOR UPDATE NOWAIT;
-- fails immediately if locked instead of waiting
```

**Deadlock monitoring (PostgreSQL):**

```sql
-- Find current locks and blocked queries
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_query,
    blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity
    ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity
    ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

---

### MySQL InnoDB Locking

MySQL uses different locking mechanisms than PostgreSQL:

```
InnoDB Lock Types:
┌────────────────────────────────────────────────────┐
│  Record Lock   — locks a single index record       │
│  Gap Lock      — locks gap between index records   │
│  Next-Key Lock — record lock + gap lock combined   │
│  Insert Intention Lock — for INSERT into gaps      │
└────────────────────────────────────────────────────┘

Example with REPEATABLE READ:
Table: users (id INT PRIMARY KEY, name VARCHAR)
Data: id = 1, 5, 10

SELECT * FROM users WHERE id BETWEEN 3 AND 7 FOR UPDATE;

Locks acquired (Next-Key):
  Gap lock: (1, 5)      — prevents INSERT of id=2,3,4
  Record lock: 5        — prevents UPDATE/DELETE of id=5
  Gap lock: (5, 10)     — prevents INSERT of id=6,7,8,9
  → This is how InnoDB prevents phantom reads
```

---

## Best Practices

1. **ALWAYS lock rows in a consistent order** to prevent deadlocks (e.g., by primary key ASC)
2. **ALWAYS use optimistic locking for web forms** — user thinks for minutes between read and submit
3. **ALWAYS use pessimistic locking for high-contention hot rows** — inventory, counters, booking slots
4. **ALWAYS set lock_timeout** — never wait forever for a lock
5. **ALWAYS use SKIP LOCKED for queue patterns** — much faster than blocking
6. **NEVER hold locks while doing I/O** (HTTP calls, file reads) — keep lock duration minimal
7. **NEVER use table-level locks** unless explicitly needed (DDL, bulk operations)
8. **ALWAYS handle deadlock errors with retry logic** — deadlocks are expected under concurrency
9. **ALWAYS monitor lock wait times** — increasing wait times indicate contention problems
10. **ALWAYS prefer advisory locks over external locking** when the database is the coordination point

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No locking on concurrent writes | Lost updates, data corruption | Add optimistic or pessimistic locking |
| FOR UPDATE on every SELECT | Massive contention, slow queries | Use FOR UPDATE only when needed |
| Holding locks during HTTP calls | Lock held for seconds, blocks others | Move external calls outside transaction |
| Random lock ordering | Frequent deadlocks | Always lock in consistent order (by PK) |
| No lock timeout | Queries hang indefinitely | Set lock_timeout = '5s' |
| Optimistic locking without retry | "Someone else modified" error shown to user | Implement automatic retry (3 attempts) |
| Using pg_advisory_lock without unlock | Locks held until session disconnect | Use pg_advisory_xact_lock (auto-release) |
| SELECT ... FOR UPDATE on large result sets | Locking thousands of rows unnecessarily | Narrow your WHERE clause, use LIMIT |

---

## Real-world Examples

### Shopify (Inventory Management)
- Pessimistic locking (SELECT FOR UPDATE) for checkout inventory reservation
- Short transaction duration (<50ms) to minimize lock contention
- SKIP LOCKED for background job processing

### Ticketmaster (Seat Booking)
- Optimistic locking with version check for seat selection
- Advisory locks for preventing double-booking of specific seats
- Timeout-based reservation expiry (hold seat for 10 minutes)

### GitHub (Pull Request Merges)
- Advisory locks to prevent concurrent merges to same branch
- Optimistic locking on repository state (SHA-based)
- Retry logic for merge conflicts

---

## Enforcement Checklist

- [ ] Locking strategy documented for each concurrent write scenario
- [ ] Optimistic locking (version column) implemented for user-facing forms
- [ ] Pessimistic locking (FOR UPDATE) used only for high-contention, short transactions
- [ ] Lock ordering convention established (always ascending PK)
- [ ] lock_timeout configured (not waiting forever)
- [ ] Deadlock handling implemented with retry logic
- [ ] SKIP LOCKED used for queue/job processing patterns
- [ ] Advisory locks preferred over external locking tools when possible
- [ ] Lock contention monitored (pg_stat_activity, slow query log)
- [ ] No locks held during external I/O operations
