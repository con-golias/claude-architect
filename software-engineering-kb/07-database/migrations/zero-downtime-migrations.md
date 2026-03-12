# Zero-Downtime Migrations

> **Domain:** Database > Migrations > Zero-Downtime
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

In production systems serving users 24/7, database migrations that lock tables cause downtime. A simple `ALTER TABLE ADD COLUMN NOT NULL` on a table with 50 million rows can lock the table for minutes, blocking all reads and writes. Zero-downtime migrations use multi-step expansion/contraction patterns to make schema changes without locking tables or requiring application downtime. Every team running a production database with traffic MUST understand these patterns — the alternative is scheduled maintenance windows, which modern users do not accept.

---

## How It Works

### The Problem with Naive Migrations

```
Dangerous Operations and Their Lock Behavior:
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  Operation                        │ Lock Level │ Duration    │
│  ─────────────────────────────────┼────────────┼─────────── │
│  ADD COLUMN (nullable)            │ Brief      │ Instant     │
│  ADD COLUMN (with DEFAULT, PG 11+)│ Brief      │ Instant     │
│  ADD COLUMN NOT NULL (no default) │ EXCLUSIVE  │ Full scan   │
│  DROP COLUMN                      │ Brief      │ Instant     │
│  RENAME COLUMN                    │ EXCLUSIVE  │ Brief       │
│  CHANGE COLUMN TYPE               │ EXCLUSIVE  │ Full rewrite│
│  ADD INDEX                        │ SHARE      │ Full scan   │
│  ADD INDEX CONCURRENTLY           │ None       │ Longer, safe│
│  DROP TABLE                      │ EXCLUSIVE   │ Instant     │
│  ADD CONSTRAINT (FK)              │ SHARE ROW  │ Full scan   │
│  ADD CONSTRAINT NOT VALID         │ Brief      │ Instant     │
│  VALIDATE CONSTRAINT              │ SHARE UPD  │ Full scan   │
│                                                               │
│  EXCLUSIVE = blocks ALL reads and writes                     │
│  SHARE = blocks writes, allows reads                         │
│  Brief = milliseconds, safe                                  │
│  Full scan = proportional to table size, DANGEROUS           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Expand-Contract Pattern

```
The Expand-Contract Pattern (3-Phase Migration):
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Phase 1: EXPAND (Additive only — no locks)               │
│  ├── Add new column (nullable)                            │
│  ├── Add new table                                        │
│  ├── Add new index (CONCURRENTLY)                         │
│  └── Deploy app that writes to BOTH old and new          │
│                                                            │
│  Phase 2: MIGRATE (Backfill data — no locks)              │
│  ├── Backfill new column/table in batches                 │
│  ├── Verify data consistency                              │
│  └── Deploy app that reads from new, writes to both      │
│                                                            │
│  Phase 3: CONTRACT (Remove old — minimal locks)           │
│  ├── Deploy app using only new schema                     │
│  ├── Drop old column/table/index                         │
│  └── Add constraints (NOT NULL, etc.)                    │
│                                                            │
│  Key Rule: Application changes and schema changes         │
│  are deployed in SEPARATE releases                        │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Pattern 1: Add NOT NULL Column

```sql
-- WRONG: Locks table, blocks traffic
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NOT NULL DEFAULT '';

-- RIGHT: 4-step zero-downtime approach

-- Step 1: Add nullable column (instant, no lock)
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Step 2: Deploy app writing to phone column for new rows

-- Step 3: Backfill existing rows in batches
UPDATE users SET phone = ''
WHERE phone IS NULL
  AND id IN (
    SELECT id FROM users WHERE phone IS NULL LIMIT 1000 FOR UPDATE SKIP LOCKED
  );
-- Repeat until all rows updated

-- Step 4: Add NOT NULL constraint (after all rows have values)
-- PostgreSQL: use NOT VALID then VALIDATE (avoids full lock)
ALTER TABLE users ADD CONSTRAINT users_phone_not_null
  CHECK (phone IS NOT NULL) NOT VALID;
-- NOT VALID = only checks new rows, instant

ALTER TABLE users VALIDATE CONSTRAINT users_phone_not_null;
-- VALIDATE = checks existing rows, allows concurrent reads/writes
-- Acquires SHARE UPDATE EXCLUSIVE lock (allows reads AND writes)

-- Step 5: Optionally convert to actual NOT NULL (with constraint already validated)
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
-- Safe now because PostgreSQL knows all rows satisfy constraint
ALTER TABLE users DROP CONSTRAINT users_phone_not_null;
-- Clean up the CHECK constraint
```

### Pattern 2: Rename Column

```sql
-- WRONG: Breaks application immediately
ALTER TABLE users RENAME COLUMN email TO email_address;

-- RIGHT: 4-step zero-downtime approach

-- Step 1: Add new column
ALTER TABLE users ADD COLUMN email_address VARCHAR(255);

-- Step 2: Deploy app writing to BOTH columns
-- Application code:
-- INSERT INTO users (email, email_address, ...) VALUES ($1, $1, ...)
-- UPDATE users SET email = $1, email_address = $1 WHERE ...

-- Step 3: Backfill existing rows
UPDATE users SET email_address = email
WHERE email_address IS NULL
  AND id IN (
    SELECT id FROM users WHERE email_address IS NULL
    LIMIT 1000 FOR UPDATE SKIP LOCKED
  );
-- Repeat until complete

-- Step 4: Deploy app reading from email_address only

-- Step 5: Drop old column
ALTER TABLE users DROP COLUMN email;
```

### Pattern 3: Change Column Type

```sql
-- WRONG: Rewrites entire table with exclusive lock
ALTER TABLE orders ALTER COLUMN total TYPE DECIMAL(12,2);

-- RIGHT: 4-step zero-downtime approach

-- Step 1: Add new column with desired type
ALTER TABLE orders ADD COLUMN total_new DECIMAL(12,2);

-- Step 2: Create trigger to keep columns in sync
CREATE OR REPLACE FUNCTION sync_orders_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_new := NEW.total::DECIMAL(12,2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_orders_total
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_orders_total();

-- Step 3: Backfill existing rows
UPDATE orders SET total_new = total::DECIMAL(12,2)
WHERE total_new IS NULL
  AND id IN (
    SELECT id FROM orders WHERE total_new IS NULL
    LIMIT 1000 FOR UPDATE SKIP LOCKED
  );

-- Step 4: Deploy app reading total_new
-- Step 5: Drop trigger, drop old column, rename new column
DROP TRIGGER trg_sync_orders_total ON orders;
ALTER TABLE orders DROP COLUMN total;
ALTER TABLE orders RENAME COLUMN total_new TO total;
```

### Pattern 4: Add Index Without Downtime

```sql
-- WRONG: Locks table for writes during index build
CREATE INDEX idx_orders_created ON orders (created_at);

-- RIGHT: CONCURRENTLY (PostgreSQL)
CREATE INDEX CONCURRENTLY idx_orders_created ON orders (created_at);
-- Does NOT block reads or writes
-- Takes longer but is safe for production
-- ⚠ Cannot run inside a transaction
-- ⚠ If interrupted, leaves invalid index — must DROP and retry

-- Verify index is valid
SELECT indexrelid::regclass, indisvalid
FROM pg_index
WHERE indexrelid = 'idx_orders_created'::regclass;
-- indisvalid must be true

-- MySQL: ALGORITHM=INPLACE (InnoDB online DDL)
ALTER TABLE orders ADD INDEX idx_orders_created (created_at), ALGORITHM=INPLACE, LOCK=NONE;
-- LOCK=NONE allows concurrent reads and writes
```

### Pattern 5: Add Foreign Key

```sql
-- WRONG: Scans entire table with SHARE ROW EXCLUSIVE lock
ALTER TABLE orders ADD CONSTRAINT fk_orders_user
  FOREIGN KEY (user_id) REFERENCES users(id);

-- RIGHT: NOT VALID + VALIDATE (PostgreSQL)

-- Step 1: Add constraint with NOT VALID (instant, no scan)
ALTER TABLE orders ADD CONSTRAINT fk_orders_user
  FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
-- Only validates new rows from this point forward

-- Step 2: Validate existing rows (allows concurrent traffic)
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user;
-- Scans existing rows but allows concurrent reads AND writes
-- Acquires SHARE UPDATE EXCLUSIVE lock (compatible with normal operations)
```

### Pattern 6: Table Migration (Large Restructure)

```
Full Table Migration Pattern:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Step 1: Create new table with desired schema              │
│  ┌──────────┐           ┌──────────────┐                 │
│  │ users    │           │ users_v2      │                 │
│  │ (old)    │           │ (new schema)  │                 │
│  └──────────┘           └──────────────┘                 │
│                                                            │
│  Step 2: Create trigger to dual-write                     │
│  ┌──────────┐──trigger──>┌──────────────┐                │
│  │ users    │           │ users_v2      │                 │
│  └──────────┘           └──────────────┘                 │
│                                                            │
│  Step 3: Backfill existing data                           │
│  ┌──────────┐──batch───>┌──────────────┐                 │
│  │ users    │  copy     │ users_v2      │                 │
│  └──────────┘           └──────────────┘                 │
│                                                            │
│  Step 4: Deploy app reading from users_v2                 │
│  Step 5: Drop trigger, rename tables                      │
│                                                            │
│  ALTER TABLE users RENAME TO users_old;                   │
│  ALTER TABLE users_v2 RENAME TO users;                    │
│  DROP TABLE users_old;                                    │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

```python
# Python — Batch backfill script
import time
from sqlalchemy import text

def backfill_users_v2(engine, batch_size=1000):
    """Backfill users_v2 from users table in batches."""
    total_migrated = 0

    while True:
        with engine.begin() as conn:
            result = conn.execute(text("""
                INSERT INTO users_v2 (id, email, name, role, created_at)
                SELECT u.id, u.email, u.name,
                       COALESCE(u.role, 'user'),
                       u.created_at
                FROM users u
                LEFT JOIN users_v2 v2 ON u.id = v2.id
                WHERE v2.id IS NULL
                LIMIT :batch_size
            """), {"batch_size": batch_size})

            rows = result.rowcount
            total_migrated += rows

            if rows == 0:
                break

            print(f"Migrated {total_migrated} rows...")

        # Brief pause to reduce database load
        time.sleep(0.1)

    print(f"Backfill complete: {total_migrated} total rows")
```

### Lock Timeout Safety

```sql
-- ALWAYS set lock timeout for DDL operations
-- Prevents blocking traffic if lock cannot be acquired quickly

-- PostgreSQL: set lock timeout per session
SET lock_timeout = '5s';

-- If the lock cannot be acquired in 5 seconds, the DDL fails
-- instead of blocking traffic indefinitely

-- Example safe DDL wrapper
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE users ADD COLUMN avatar_url TEXT;
COMMIT;
-- If another transaction holds a conflicting lock,
-- this fails after 5 seconds instead of waiting
```

```go
// Go — Safe DDL with lock timeout and retry
func SafeDDL(ctx context.Context, pool *pgxpool.Pool, ddl string) error {
    maxRetries := 3
    for i := 0; i < maxRetries; i++ {
        err := func() error {
            tx, err := pool.Begin(ctx)
            if err != nil {
                return err
            }
            defer tx.Rollback(ctx)

            // Set lock timeout — fail fast if lock unavailable
            _, err = tx.Exec(ctx, "SET LOCAL lock_timeout = '5s'")
            if err != nil {
                return err
            }

            _, err = tx.Exec(ctx, ddl)
            if err != nil {
                return err
            }

            return tx.Commit(ctx)
        }()

        if err == nil {
            return nil
        }

        // Check if error is lock timeout
        if strings.Contains(err.Error(), "lock timeout") {
            log.Printf("Lock timeout on attempt %d/%d, retrying...", i+1, maxRetries)
            time.Sleep(time.Duration(i+1) * 5 * time.Second) // exponential backoff
            continue
        }

        return err // non-lock error, fail immediately
    }

    return fmt.Errorf("failed to acquire lock after %d attempts", maxRetries)
}
```

### Statement Timeout for Backfills

```sql
-- Set statement timeout for long-running backfills
-- Prevents a single batch from running too long

SET statement_timeout = '30s';

-- Batch backfill with timeout protection
DO $$
DECLARE
    rows_affected INT;
    total_rows INT := 0;
BEGIN
    LOOP
        UPDATE users
        SET normalized_email = LOWER(email)
        WHERE normalized_email IS NULL
          AND id IN (
            SELECT id FROM users
            WHERE normalized_email IS NULL
            LIMIT 5000
            FOR UPDATE SKIP LOCKED
          );

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        total_rows := total_rows + rows_affected;
        EXIT WHEN rows_affected = 0;

        RAISE NOTICE 'Backfilled % rows (total: %)', rows_affected, total_rows;
        PERFORM pg_sleep(0.2);  -- 200ms pause between batches
    END LOOP;
END $$;

RESET statement_timeout;
```

### PostgreSQL vs MySQL DDL Safety

```
PostgreSQL DDL Safety:
┌──────────────────────────────────────────────────────────┐
│  ✅ Transactional DDL — DDL can be rolled back           │
│  ✅ CREATE INDEX CONCURRENTLY — non-blocking             │
│  ✅ NOT VALID / VALIDATE — two-phase constraints        │
│  ✅ ADD COLUMN with DEFAULT — instant (since PG 11)     │
│  ⚠  ALTER TYPE — requires full table rewrite            │
│  ⚠  RENAME COLUMN — requires exclusive lock             │
└──────────────────────────────────────────────────────────┘

MySQL DDL Safety (InnoDB Online DDL):
┌──────────────────────────────────────────────────────────┐
│  ✅ ALGORITHM=INPLACE — many ALTERs without copy        │
│  ✅ LOCK=NONE — allows concurrent DML                   │
│  ✅ ADD COLUMN — usually instant (MySQL 8.0+)           │
│  ⚠  No transactional DDL — cannot rollback ALTER TABLE  │
│  ⚠  ADD INDEX — online but can be slow on large tables │
│  ⚠  CHANGE COLUMN TYPE — usually requires copy         │
│  Tool: pt-online-schema-change (Percona) for safe ALTERs│
│  Tool: gh-ost (GitHub) for online schema changes        │
└──────────────────────────────────────────────────────────┘
```

### gh-ost and pt-online-schema-change (MySQL)

```bash
# gh-ost — GitHub's Online Schema Migration Tool for MySQL
# Creates a ghost table, copies data, applies changes, then swaps

gh-ost \
  --host=primary.db.local \
  --database=myapp \
  --table=users \
  --alter="ADD COLUMN phone VARCHAR(20)" \
  --execute \
  --allow-on-master \
  --chunk-size=1000 \
  --max-load="Threads_running=25" \
  --critical-load="Threads_running=50" \
  --postpone-cut-over-flag-file=/tmp/ghost-postpone.flag

# How gh-ost works:
# 1. Creates _users_gho (ghost table) with new schema
# 2. Reads binary log to capture ongoing changes
# 3. Copies existing data in chunks
# 4. Applies binary log changes to ghost table
# 5. Atomic table swap when caught up
# 6. Drops old table

# pt-online-schema-change (Percona Toolkit)
pt-online-schema-change \
  --alter "ADD COLUMN phone VARCHAR(20)" \
  D=myapp,t=users \
  --execute \
  --chunk-size=1000 \
  --max-lag=1s \
  --check-interval=1
```

---

## Best Practices

1. **ALWAYS use CONCURRENTLY** for CREATE INDEX on production tables — non-blocking
2. **ALWAYS use NOT VALID + VALIDATE** for adding constraints — two-phase, no blocking
3. **ALWAYS set lock_timeout** before DDL operations — prevent indefinite blocking
4. **ALWAYS backfill in batches** with LIMIT and FOR UPDATE SKIP LOCKED
5. **ALWAYS add pause between batches** — pg_sleep(0.1-0.5) to reduce database load
6. **ALWAYS separate schema and application deploys** — expand-contract pattern
7. **ALWAYS add nullable columns first** — then backfill, then add NOT NULL
8. **NEVER rename columns directly** — use add/copy/drop pattern
9. **NEVER change column types directly** — use add/copy/drop pattern
10. **NEVER run DDL without lock_timeout** — one long transaction blocks everything

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| ALTER TABLE ADD NOT NULL without default | Table locked for full rewrite | Add nullable, backfill, add constraint |
| CREATE INDEX without CONCURRENTLY | Write lock during index build | Use CONCURRENTLY |
| No lock_timeout on DDL | Blocked traffic while waiting for lock | SET lock_timeout = '5s' |
| Backfill without batching | Table locked, massive transaction log | Batch with LIMIT + SKIP LOCKED |
| Rename column directly | Application breaks immediately | Add/copy/drop pattern |
| Change column type directly | Full table rewrite with lock | Add/copy/drop pattern |
| Schema and app deploy together | Rollback requires both | Separate into expand + contract deploys |
| Large migration without staging test | Unknown duration in production | Test on production-sized staging data |
| No monitoring during migration | Undetected lock contention | Monitor pg_stat_activity during DDL |
| Deploying app before schema expand | App references non-existent columns | Always expand schema FIRST |

---

## Enforcement Checklist

- [ ] All DDL operations tested for lock behavior
- [ ] CONCURRENTLY used for index creation on production
- [ ] NOT VALID + VALIDATE used for constraints
- [ ] lock_timeout set before DDL operations
- [ ] Backfills use batching with LIMIT and SKIP LOCKED
- [ ] Expand-contract pattern used for column changes
- [ ] Schema deploy separated from application deploy
- [ ] Migration duration measured on staging with production data
- [ ] gh-ost or pt-osc used for MySQL schema changes on large tables
- [ ] pg_stat_activity monitored during migrations
- [ ] Rollback plan documented for each migration
- [ ] On-call team notified before large migrations
