# ACID Properties & Isolation Levels

> **Domain:** Database > Transactions
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

ACID guarantees are what separate databases from file systems. Without Atomicity, a failed bank transfer debits your account but never credits the recipient. Without Isolation, two concurrent inventory checks both see 1 item in stock and both sell it — overselling. Without Durability, a power failure loses your last hour of orders. Every production system depends on transactions, yet most developers cannot name the four isolation levels or explain what anomalies each prevents. This knowledge is the difference between "it works in testing" and "it works under load."

---

## How It Works

### ACID Properties

```
┌──────────────────────────────────────────────────────────────────┐
│                        ACID GUARANTEES                            │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  ATOMICITY   │  │ CONSISTENCY  │  │  ISOLATION   │           │
│  │              │  │              │  │              │           │
│  │ All or       │  │ DB moves     │  │ Concurrent   │           │
│  │ nothing.     │  │ from one     │  │ transactions │           │
│  │ If any part  │  │ valid state  │  │ behave as if │           │
│  │ fails, ALL   │  │ to another.  │  │ they run     │           │
│  │ changes      │  │ Constraints  │  │ serially.    │           │
│  │ roll back.   │  │ are always   │  │ No dirty     │           │
│  │              │  │ satisfied.   │  │ reads.       │           │
│  └──────────────┘  └──────────────┘  └──────┬───────┘           │
│                                              │                   │
│                    ┌──────────────┐          │                   │
│                    │  DURABILITY  │   Isolation has 4 LEVELS     │
│                    │              │   with different guarantees  │
│                    │ Once commit  │   and performance tradeoffs. │
│                    │ returns OK,  │                              │
│                    │ data survives│                              │
│                    │ crashes,     │                              │
│                    │ power loss.  │                              │
│                    └──────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
```

**Atomicity — All or Nothing**

```sql
-- Transfer $100 from Alice to Bob
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE user_id = 'alice';
  -- If this next statement fails (e.g., Bob's account is frozen):
  UPDATE accounts SET balance = balance + 100 WHERE user_id = 'bob';
COMMIT;
-- If ANY statement fails → entire transaction rolls back
-- Alice's balance is restored to original value
```

**Consistency — Valid State to Valid State**

```sql
-- Constraint: balance >= 0
ALTER TABLE accounts ADD CONSTRAINT positive_balance CHECK (balance >= 0);

BEGIN;
  UPDATE accounts SET balance = balance - 1000 WHERE user_id = 'alice';
  -- If Alice only has $500 → CHECK constraint violated
  -- Transaction aborted → balance stays at $500
COMMIT;
```

**Durability — Survives Crashes**

```
Transaction lifecycle:
1. BEGIN
2. Execute statements (changes in memory + WAL)
3. COMMIT
   → WAL (Write-Ahead Log) flushed to disk (fsync)
   → COMMIT acknowledged to client
4. Power failure 0.001 seconds later
   → Data pages may NOT be on disk yet
   → WAL IS on disk
   → On restart: replay WAL → data recovered
```

---

### Transaction Lifecycle

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│  BEGIN   │────►│ ACTIVE  │────►│  COMMIT  │────►│ COMMITTED│
│          │     │(execute │     │ (write   │     │ (done)   │
│          │     │ stmts)  │     │  WAL,    │     │          │
│          │     │         │     │  flush)  │     │          │
│          │     └────┬────┘     └──────────┘     └──────────┘
│          │          │
│          │     ┌────▼────┐     ┌──────────┐
│          │     │  ERROR  │────►│ ROLLED   │
│          │     │(constraint│    │  BACK    │
│          │     │ or app   │    │ (undone) │
│          │     │ abort)   │    │          │
│          │     └─────────┘    └──────────┘
└──────────┘

Savepoints allow partial rollback:
BEGIN;
  INSERT INTO orders ...;
  SAVEPOINT sp1;
  INSERT INTO order_items ...;  -- fails
  ROLLBACK TO sp1;              -- undo only order_items
  INSERT INTO order_items ...;  -- retry with corrected data
COMMIT;                         -- order + corrected items committed
```

---

### Isolation Levels & Anomalies

#### The Four Anomalies

**1. Dirty Read** — reading uncommitted data

```
Tx A: UPDATE accounts SET balance = 0 WHERE id = 1;   (not committed yet)
Tx B: SELECT balance FROM accounts WHERE id = 1;       → reads 0 (DIRTY!)
Tx A: ROLLBACK;                                         → balance back to 500
Tx B: used balance=0 for calculation → WRONG!
```

**2. Non-Repeatable Read** — same query, different result

```
Tx A: SELECT balance FROM accounts WHERE id = 1;       → 500
Tx B: UPDATE accounts SET balance = 300 WHERE id = 1; COMMIT;
Tx A: SELECT balance FROM accounts WHERE id = 1;       → 300 (DIFFERENT!)
```

**3. Phantom Read** — new rows appear mid-transaction

```
Tx A: SELECT COUNT(*) FROM orders WHERE status = 'pending';  → 5
Tx B: INSERT INTO orders (status) VALUES ('pending'); COMMIT;
Tx A: SELECT COUNT(*) FROM orders WHERE status = 'pending';  → 6 (PHANTOM!)
```

**4. Write Skew** — constraint violated by concurrent writes

```
-- Rule: at least 1 doctor must be on call
-- Currently: Alice=on_call, Bob=on_call

Tx A: SELECT COUNT(*) FROM doctors WHERE on_call = true;  → 2
      UPDATE doctors SET on_call = false WHERE name = 'Alice';  -- OK, Bob still on call

Tx B: SELECT COUNT(*) FROM doctors WHERE on_call = true;  → 2
      UPDATE doctors SET on_call = false WHERE name = 'Bob';   -- OK, Alice still on call

Both commit → NO doctors on call! Constraint violated.
```

---

#### The Four Isolation Levels

```
Isolation Level        Dirty Read   Non-Repeatable   Phantom   Write Skew
──────────────────────────────────────────────────────────────────────────
READ UNCOMMITTED       Possible     Possible          Possible  Possible
READ COMMITTED         Prevented    Possible          Possible  Possible
REPEATABLE READ        Prevented    Prevented         Possible* Possible*
SERIALIZABLE           Prevented    Prevented         Prevented Prevented

* PostgreSQL's REPEATABLE READ also prevents phantoms (uses SSI)
```

**READ UNCOMMITTED** — almost never used, offers no useful guarantees

**READ COMMITTED** (PostgreSQL default, Oracle default):

```sql
-- Each statement sees only data committed BEFORE that statement started
-- Different statements in same transaction can see different snapshots

SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN;
  SELECT balance FROM accounts WHERE id = 1;  -- snapshot at time T1
  -- another transaction commits here
  SELECT balance FROM accounts WHERE id = 1;  -- snapshot at time T2 (may differ!)
COMMIT;
```

**REPEATABLE READ** (MySQL InnoDB default):

```sql
-- Transaction sees a snapshot from the START of the transaction
-- All reads within the transaction see the same data

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN;
  SELECT balance FROM accounts WHERE id = 1;  -- snapshot at BEGIN time
  -- another transaction commits here
  SELECT balance FROM accounts WHERE id = 1;  -- SAME result as first read
COMMIT;
```

**SERIALIZABLE** (strongest, CockroachDB default):

```sql
-- Transactions behave as if they executed one after another
-- Prevents ALL anomalies including write skew

SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;
  -- If write skew detected → transaction aborted with serialization error
  -- Application MUST retry
COMMIT;
```

---

### MVCC (Multi-Version Concurrency Control)

PostgreSQL and most modern databases use MVCC to implement isolation levels without heavy locking:

```
┌────────────────────────────────────────────────────────┐
│                PostgreSQL MVCC                          │
│                                                         │
│  Each row has hidden columns:                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ xmin │ xmax │  id  │  name   │  balance       │    │
│  ├────────────────────────────────────────────────┤    │
│  │ 100  │ 105  │   1  │  Alice  │  500           │    │
│  │ 105  │  -   │   1  │  Alice  │  300           │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  xmin = transaction that CREATED this row version      │
│  xmax = transaction that DELETED/UPDATED this version  │
│                                                         │
│  Transaction 100: INSERT Alice with balance 500        │
│  Transaction 105: UPDATE balance to 300                │
│    → old row gets xmax=105                             │
│    → new row created with xmin=105                     │
│                                                         │
│  Transaction 103 (started before 105):                 │
│    → sees row with xmin=100 (balance=500)              │
│    → does NOT see row with xmin=105 (not yet visible)  │
│                                                         │
│  Transaction 110 (started after 105 committed):        │
│    → skips row with xmax=105 (deleted version)         │
│    → sees row with xmin=105 (balance=300)              │
└────────────────────────────────────────────────────────┘
```

**MVCC advantages:**
- Readers never block writers (no read locks needed)
- Writers never block readers
- Each transaction sees a consistent snapshot
- Deadlocks only between write-write conflicts

**MVCC cost:**
- Dead tuples accumulate (old row versions)
- VACUUM process must clean up dead tuples
- Table bloat if VACUUM falls behind
- More storage used than lock-based systems

---

### PostgreSQL SSI (Serializable Snapshot Isolation)

PostgreSQL implements SERIALIZABLE using SSI — not locking:

```
How SSI works:
1. Each transaction runs on a snapshot (like REPEATABLE READ)
2. PostgreSQL tracks read/write dependencies between transactions
3. If a dependency cycle is detected → abort one transaction

Example:
Tx A reads rows that Tx B writes (rw-dependency A→B)
Tx B reads rows that Tx A writes (rw-dependency B→A)
Cycle detected! → PostgreSQL aborts one with:
  ERROR: could not serialize access due to read/write dependencies

Application MUST retry the aborted transaction.
```

```go
// Go — retry loop for serializable transactions
func transferFunds(ctx context.Context, db *sql.DB, from, to string, amount int) error {
    for retries := 0; retries < 3; retries++ {
        tx, err := db.BeginTx(ctx, &sql.TxOptions{
            Isolation: sql.LevelSerializable,
        })
        if err != nil {
            return err
        }

        _, err = tx.ExecContext(ctx,
            "UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from)
        if err != nil {
            tx.Rollback()
            if isSerializationError(err) {
                continue // retry
            }
            return err
        }

        _, err = tx.ExecContext(ctx,
            "UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to)
        if err != nil {
            tx.Rollback()
            if isSerializationError(err) {
                continue // retry
            }
            return err
        }

        err = tx.Commit()
        if err != nil {
            if isSerializationError(err) {
                continue // retry
            }
            return err
        }
        return nil // success
    }
    return fmt.Errorf("transaction failed after 3 retries")
}

func isSerializationError(err error) bool {
    var pgErr *pgconn.PgError
    if errors.As(err, &pgErr) {
        return pgErr.Code == "40001" // serialization_failure
    }
    return false
}
```

```typescript
// TypeScript — retry pattern with Prisma
async function transferFunds(from: string, to: string, amount: number) {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.account.update({
          where: { id: from },
          data: { balance: { decrement: amount } },
        });

        await tx.account.update({
          where: { id: to },
          data: { balance: { increment: amount } },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      return; // success
    } catch (error) {
      if (error.code === 'P2034') { // serialization error
        continue; // retry
      }
      throw error;
    }
  }
  throw new Error('Transaction failed after max retries');
}
```

---

### MySQL InnoDB MVCC

MySQL InnoDB uses a different MVCC approach with undo logs:

```
┌─────────────────────────────────────────────────────┐
│              InnoDB MVCC Architecture                 │
│                                                      │
│  Clustered Index (Primary Key):                     │
│  ┌──────┬────────┬──────┬──────────────────┐       │
│  │ PK   │ TRX_ID │ ROLL │ columns...       │       │
│  │      │        │ _PTR │                  │       │
│  └──────┴────────┴──┬───┴──────────────────┘       │
│                      │                              │
│                      ▼                              │
│  Undo Log (rollback segment):                      │
│  ┌─────────────────────────────────────┐           │
│  │ Previous version of the row        │           │
│  │ TRX_ID=100, balance=500            │           │
│  │ ROLL_PTR → even older version      │           │
│  └─────────────────────────────────────┘           │
│                                                      │
│  Read View (created at transaction start):          │
│  - List of active transaction IDs                   │
│  - min_trx_id, max_trx_id                         │
│  - Used to determine which row version is visible  │
└─────────────────────────────────────────────────────┘
```

**MySQL vs PostgreSQL MVCC:**

| Aspect | PostgreSQL | MySQL InnoDB |
|--------|-----------|-------------|
| Old versions stored in | Heap (same table) | Undo log (separate) |
| Cleanup mechanism | VACUUM (async) | Purge thread (async) |
| Read performance | Dead tuples can slow scans | Old versions in undo log, cleaner heap |
| Write performance | New tuple in heap | Update-in-place + undo log entry |
| REPEATABLE READ | Prevents phantoms (SSI) | Allows phantoms (gap locks needed) |
| SERIALIZABLE | SSI (no locking) | Lock-based (gap locks, next-key locks) |

---

## Best Practices

1. **ALWAYS use the weakest isolation level that meets your requirements** — stronger isolation = more contention
2. **ALWAYS use READ COMMITTED as the default** — it is the safest general-purpose level
3. **ALWAYS use SERIALIZABLE for financial transactions** — with retry logic
4. **ALWAYS implement retry logic for serializable transactions** — serialization errors are expected
5. **ALWAYS keep transactions short** — long transactions hold locks and block VACUUM
6. **NEVER use READ UNCOMMITTED** — there is no valid use case in production
7. **ALWAYS use explicit transactions for multi-statement operations** — auto-commit loses atomicity
8. **ALWAYS use SAVEPOINT for partial rollback scenarios** — avoid rolling back entire transaction

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| SERIALIZABLE without retry | Random transaction failures in production | Implement retry loop (3-5 attempts) |
| Long-running transactions | Lock contention, bloated tables, slow VACUUM | Keep transactions under 1 second |
| Using READ UNCOMMITTED | Dirty reads cause data corruption | Use READ COMMITTED minimum |
| Ignoring isolation level defaults | PostgreSQL = READ COMMITTED, MySQL = REPEATABLE READ | Explicitly set isolation level |
| No transaction for multi-statement writes | Partial writes on failure (debit without credit) | Always use BEGIN/COMMIT |
| Holding transactions open during external calls | Lock held while waiting for HTTP response | Move external calls outside transaction |
| Not understanding MVCC bloat | Table grows indefinitely, queries slow down | Monitor and tune autovacuum |
| Using table locks instead of row locks | Entire table blocked for one update | Use row-level locking (default in modern DBs) |

---

## Real-world Examples

### Stripe
- SERIALIZABLE isolation for payment transactions
- Retry logic with idempotency keys
- PostgreSQL with carefully tuned VACUUM settings
- Read replicas for analytics (eventual consistency acceptable)

### CockroachDB
- SERIALIZABLE isolation by default (no weaker levels available)
- Automatic retry at the SQL layer for many serialization errors
- Clock skew tolerance via hybrid-logical clocks
- Used by companies needing global ACID transactions

### Amazon Aurora
- MySQL-compatible with enhanced MVCC (no undo log purge lag)
- Read replicas share storage layer (sub-100ms replication lag)
- Parallel query for analytics workloads
- Serverless v2 scales to zero during idle periods

---

## Enforcement Checklist

- [ ] Isolation level explicitly configured for each transaction type
- [ ] SERIALIZABLE used for financial/critical transactions with retry logic
- [ ] Transactions kept under 1 second duration
- [ ] No external calls (HTTP, RPC) inside transactions
- [ ] SAVEPOINT used for complex multi-step transactions
- [ ] Autovacuum configured and monitored (PostgreSQL)
- [ ] Transaction error handling includes serialization retry
- [ ] READ UNCOMMITTED banned from codebase
- [ ] Monitoring in place for long-running transactions
- [ ] Dead tuple ratio monitored for MVCC bloat
