# Migration Strategies

> **Domain:** Database > Migrations > Strategies
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Database migrations are the version control system for your schema. Every schema change — adding a column, creating a table, modifying a constraint — MUST go through a migration. Without structured migrations, teams deploy schema changes manually, leading to drift between environments, data loss, and production incidents. A migration strategy defines how schema changes are authored, tested, reviewed, and applied — from development through staging to production. The wrong strategy leads to outages; the right one makes schema changes routine and safe.

---

## How It Works

### Migration Fundamentals

```
Migration Lifecycle:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Author   │────>│  Review   │────>│  Test     │────>│  Apply   │
│           │     │           │     │           │     │           │
│ Write SQL │     │ Code      │     │ Staging   │     │ Production│
│ or schema │     │ review +  │     │ with prod │     │ deploy    │
│ change    │     │ DBA check │     │ -like data│     │ pipeline  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### State-Based vs Migration-Based

```
Two Approaches to Schema Management:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  MIGRATION-BASED (Imperative)                             │
│  "Apply these changes in order"                           │
│                                                            │
│  migrations/                                               │
│  ├── 001_create_users.sql        -- UP: CREATE TABLE      │
│  ├── 002_add_email_index.sql     -- UP: CREATE INDEX      │
│  ├── 003_add_orders_table.sql    -- UP: CREATE TABLE      │
│  └── 004_add_user_role.sql       -- UP: ALTER TABLE ADD   │
│                                                            │
│  ✅ Explicit control over every change                    │
│  ✅ Supports data migrations (UPDATE, INSERT)             │
│  ✅ Deterministic — same result every time                │
│  ❌ Must write UP and DOWN for each migration             │
│  ❌ Merge conflicts on migration files                    │
│                                                            │
│  Tools: golang-migrate, Flyway, Alembic, Knex            │
│                                                            │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  STATE-BASED (Declarative)                                │
│  "Make the database match this desired state"             │
│                                                            │
│  schema/                                                   │
│  └── schema.prisma    -- Desired state definition         │
│  or                                                        │
│  └── schema.sql       -- Desired DDL                      │
│                                                            │
│  Tool compares current state → desired state → generates  │
│  migration automatically                                  │
│                                                            │
│  ✅ No manual migration writing                           │
│  ✅ Single source of truth for schema                     │
│  ✅ Less error-prone for simple changes                   │
│  ❌ Cannot handle data migrations automatically           │
│  ❌ May generate unsafe operations (DROP + CREATE)        │
│  ❌ Less control over execution order                     │
│                                                            │
│  Tools: Prisma Migrate, Atlas, Sqitch, Liquibase (partial)│
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Migration File Structure

```sql
-- Migration-based: explicit UP and DOWN

-- 001_create_users.up.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_created_at ON users (created_at);

-- 001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

```sql
-- 002_create_orders.up.sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    total DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);

-- 002_create_orders.down.sql
DROP TABLE IF EXISTS orders;
```

```sql
-- 003_add_user_phone.up.sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
-- No NOT NULL — would fail on existing rows
-- Add NOT NULL later after backfilling

-- 003_add_user_phone.down.sql
ALTER TABLE users DROP COLUMN phone;
```

### Data Migrations

```sql
-- Data migration — separate from schema migration
-- 004_backfill_user_roles.up.sql

-- Step 1: Add column (already done in previous migration)
-- Step 2: Backfill data in batches
DO $$
DECLARE
    batch_size INT := 1000;
    rows_updated INT;
BEGIN
    LOOP
        UPDATE users
        SET role = 'user'
        WHERE role IS NULL
          AND id IN (
            SELECT id FROM users
            WHERE role IS NULL
            LIMIT batch_size
            FOR UPDATE SKIP LOCKED
          );

        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        EXIT WHEN rows_updated = 0;

        RAISE NOTICE 'Updated % rows', rows_updated;
        PERFORM pg_sleep(0.1);  -- Brief pause to reduce load
    END LOOP;
END $$;

-- 004_backfill_user_roles.down.sql
-- Data backfills are typically not reversible
-- Document: "No rollback — data already existed"
```

### Migration Versioning Strategies

```
Version Naming Conventions:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  1. Sequential Numbering                                  │
│     001_create_users.sql                                  │
│     002_add_orders.sql                                    │
│     003_add_index.sql                                     │
│     ✅ Simple, ordered                                    │
│     ❌ Merge conflicts (two devs get same number)        │
│                                                            │
│  2. Timestamp-Based                                       │
│     20260310120000_create_users.sql                       │
│     20260310120100_add_orders.sql                         │
│     ✅ No merge conflicts                                │
│     ❌ Less readable ordering                            │
│                                                            │
│  3. Hybrid (Recommended)                                  │
│     V001__create_users.sql         (Flyway)              │
│     20260310_01_create_users.sql   (date + sequence)     │
│     ✅ Date for context, sequence for ordering           │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Migration Tracking

```sql
-- How migration tools track applied migrations
-- Schema migrations table (auto-created by tools)

CREATE TABLE schema_migrations (
    version    VARCHAR(255) PRIMARY KEY,  -- migration identifier
    applied_at TIMESTAMPTZ DEFAULT NOW(), -- when it was applied
    checksum   VARCHAR(64),               -- file hash for tamper detection
    dirty      BOOLEAN DEFAULT FALSE      -- failed mid-migration flag
);

-- Example state after applying 3 migrations:
-- | version            | applied_at           | dirty |
-- |--------------------|----------------------|-------|
-- | 001_create_users   | 2026-01-15 10:00:00  | false |
-- | 002_add_orders     | 2026-01-20 14:30:00  | false |
-- | 003_add_phone      | 2026-02-01 09:15:00  | false |
```

### Environment-Specific Strategies

```
Development → Staging → Production Pipeline:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  DEVELOPMENT                                               │
│  - Apply migrations immediately (migrate up)              │
│  - Reset database freely (migrate down, migrate up)      │
│  - Seed with test data                                    │
│  - Fast iteration                                         │
│                                                            │
│  STAGING                                                   │
│  - Apply same migrations as production                    │
│  - Use production-like data volume (anonymized)           │
│  - Measure migration execution time                       │
│  - Test rollback procedures                               │
│  - Validate application compatibility                     │
│                                                            │
│  PRODUCTION                                                │
│  - Apply during deployment (CI/CD pipeline)               │
│  - NEVER apply manually                                   │
│  - Lock mechanism prevents concurrent migrations          │
│  - Monitor migration duration                             │
│  - Have rollback plan ready                               │
│  - Notify on-call before large migrations                 │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

```typescript
// TypeScript — Migration CI/CD pipeline
// deploy.ts

async function runMigrations(): Promise<void> {
  const startTime = Date.now();

  console.log('Starting database migration...');

  // Step 1: Acquire advisory lock (prevent concurrent migrations)
  const lockAcquired = await db.query(
    'SELECT pg_try_advisory_lock(12345) AS locked'
  );
  if (!lockAcquired.rows[0].locked) {
    throw new Error('Another migration is running — aborting');
  }

  try {
    // Step 2: Check pending migrations
    const pending = await migrator.getPendingMigrations();
    console.log(`Pending migrations: ${pending.length}`);

    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    // Step 3: Apply migrations
    for (const migration of pending) {
      console.log(`Applying: ${migration.name}`);
      await migrator.up(migration);
      console.log(`Applied: ${migration.name} (${Date.now() - startTime}ms)`);
    }

    // Step 4: Verify schema
    await migrator.validate();

  } catch (error) {
    console.error('Migration failed:', error);
    // Alert on-call team
    await alertOncall(`Migration failed: ${error.message}`);
    throw error;
  } finally {
    // Step 5: Release lock
    await db.query('SELECT pg_advisory_unlock(12345)');
  }

  const duration = Date.now() - startTime;
  console.log(`Migrations complete in ${duration}ms`);
}
```

```go
// Go — Migration runner with locking
package migrations

import (
    "context"
    "fmt"
    "time"

    "github.com/golang-migrate/migrate/v4"
    _ "github.com/golang-migrate/migrate/v4/database/postgres"
    _ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigrations(ctx context.Context, dbURL string) error {
    m, err := migrate.New(
        "file://migrations",
        dbURL,
    )
    if err != nil {
        return fmt.Errorf("failed to create migrator: %w", err)
    }
    defer m.Close()

    // Check current version
    version, dirty, err := m.Version()
    if err != nil && err != migrate.ErrNilVersion {
        return fmt.Errorf("failed to get version: %w", err)
    }

    if dirty {
        // Fix dirty state — force to last known good version
        return fmt.Errorf("database is in dirty state at version %d — manual intervention required", version)
    }

    // Apply all pending migrations
    start := time.Now()
    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return fmt.Errorf("migration failed: %w", err)
    }

    newVersion, _, _ := m.Version()
    fmt.Printf("Migrated from v%d to v%d in %s\n", version, newVersion, time.Since(start))

    return nil
}
```

### Rollback Strategies

```
Rollback Approaches:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  1. DOWN Migration (Traditional Rollback)                │
│     - Apply the DOWN script for the failed migration     │
│     - Works for DDL changes (DROP COLUMN, DROP TABLE)    │
│     - Cannot undo data loss (if column was dropped)      │
│     - Must be tested before production use               │
│                                                            │
│  2. Forward Fix (Preferred)                               │
│     - Create a NEW migration to fix the problem          │
│     - Never modifies migration history                   │
│     - Safer — no risk of data loss from rollback         │
│     - Apply a corrective migration instead of reverting  │
│                                                            │
│  3. Point-in-Time Recovery (Nuclear Option)              │
│     - Restore database from backup to before migration   │
│     - Loses ALL changes since backup                     │
│     - Last resort for catastrophic migration failures    │
│     - Requires tested backup/restore procedures          │
│                                                            │
│  Recommendation: Prefer forward fixes over rollbacks     │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS version control all migrations** — migrations are code, treat them as such
2. **ALWAYS make migrations idempotent** — use IF NOT EXISTS, IF EXISTS for safety
3. **ALWAYS test migrations on production-like data** — small datasets hide performance issues
4. **ALWAYS separate schema migrations from data migrations** — different risk profiles
5. **ALWAYS include DOWN migrations** — even if you prefer forward fixes, have a rollback option
6. **ALWAYS use advisory locks** — prevent concurrent migration execution
7. **ALWAYS measure migration execution time** in staging with production data volume
8. **NEVER modify an already-applied migration** — create a new one instead
9. **NEVER run migrations manually** in production — always through CI/CD pipeline
10. **NEVER combine destructive and additive changes** in one migration — separate for safer rollback

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No migration system | Schema drift between environments | Adopt migration tool (golang-migrate, Alembic) |
| Manual production migrations | Human error, no audit trail | CI/CD pipeline with automated migrations |
| Modifying applied migrations | Checksum mismatch errors | Create new migration for changes |
| No DOWN migration | Cannot rollback when needed | Write DOWN for every UP migration |
| Untested migrations | Failures in production | Test on staging with production data |
| Mixing schema + data changes | Long lock times, complex rollback | Separate schema and data migrations |
| No migration locking | Concurrent execution corruption | Use advisory locks |
| Large single migration | Long downtime, hard to debug | Break into smaller atomic migrations |
| No idempotent checks | Fails on re-run after partial apply | Use IF NOT EXISTS / IF EXISTS |
| Ignoring dirty state | Inconsistent schema | Fix dirty state before applying new migrations |

---

## Enforcement Checklist

- [ ] Migration tool selected and configured
- [ ] All schema changes go through migrations (no manual DDL)
- [ ] Migrations version-controlled alongside application code
- [ ] UP and DOWN migrations provided for every change
- [ ] Migrations tested on production-sized data in staging
- [ ] CI/CD pipeline runs migrations automatically
- [ ] Advisory locks prevent concurrent migration execution
- [ ] Migration execution time measured and monitored
- [ ] Rollback procedures documented and tested
- [ ] Schema migrations separated from data migrations
- [ ] Migration naming convention established (timestamp or sequential)
- [ ] Code review required for all migrations (including DBA review for large changes)
