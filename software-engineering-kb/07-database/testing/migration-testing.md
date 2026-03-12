# Migration Testing

> **Domain:** Database > Testing > Migration Testing
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Untested migrations are the leading cause of production database incidents. A migration that works on an empty development database may lock a 100-million-row production table for hours, corrupt data during backfill, or fail halfway leaving the schema in a dirty state. Testing migrations requires verifying correctness (schema matches expectations), safety (no dangerous locks), reversibility (rollback works), and performance (executes within acceptable time on production-sized data). Every migration MUST be tested before reaching production.

---

## How It Works

### Migration Testing Categories

```
Migration Test Categories:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  1. Schema Correctness Tests                              │
│     Does the migration produce the expected schema?       │
│     - Tables, columns, types, defaults                   │
│     - Indexes, constraints, triggers                     │
│     - Verify with information_schema queries              │
│                                                            │
│  2. UP/DOWN Reversibility Tests                           │
│     Can migrations be applied and rolled back cleanly?   │
│     - Apply UP → verify schema                           │
│     - Apply DOWN → verify reverted to previous state     │
│     - Apply UP again → verify same result                │
│                                                            │
│  3. Data Integrity Tests                                  │
│     Does the migration preserve existing data?            │
│     - Seed data → apply migration → verify data intact   │
│     - Test backfill logic for correctness                 │
│     - Verify no data loss or corruption                  │
│                                                            │
│  4. Safety Tests (Lint)                                   │
│     Does the migration use safe DDL operations?           │
│     - No exclusive locks on large tables                 │
│     - CREATE INDEX CONCURRENTLY used                     │
│     - NOT VALID + VALIDATE for constraints               │
│     - No column renames (use add/copy/drop)              │
│                                                            │
│  5. Performance Tests                                     │
│     How long does the migration take on production data?  │
│     - Test on staging with production-sized dataset       │
│     - Measure lock duration                               │
│     - Measure total execution time                       │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Schema Correctness Testing

```typescript
// TypeScript — Verify migration produces expected schema
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { migrate } from '../migrations';

describe('Migration Schema Tests', () => {
  let pool: Pool;

  beforeAll(async () => {
    const container = await new PostgreSqlContainer('postgres:16').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    await migrate(pool, 'up'); // Apply all migrations
  });

  it('should create users table with correct columns', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    const columns = result.rows;
    expect(columns).toContainEqual(expect.objectContaining({
      column_name: 'id',
      data_type: 'uuid',
      is_nullable: 'NO',
    }));
    expect(columns).toContainEqual(expect.objectContaining({
      column_name: 'email',
      data_type: 'character varying',
      is_nullable: 'NO',
    }));
    expect(columns).toContainEqual(expect.objectContaining({
      column_name: 'created_at',
      is_nullable: 'NO',
    }));
  });

  it('should have unique index on users.email', async () => {
    const result = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'users' AND indexdef LIKE '%UNIQUE%'
    `);

    const emailIndex = result.rows.find(r =>
      r.indexdef.includes('email')
    );
    expect(emailIndex).toBeDefined();
  });

  it('should have foreign key from orders to users', async () => {
    const result = await pool.query(`
      SELECT
        tc.constraint_name, tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'orders'
    `);

    expect(result.rows).toContainEqual(expect.objectContaining({
      table_name: 'orders',
      column_name: 'user_id',
      foreign_table: 'users',
      foreign_column: 'id',
    }));
  });
});
```

### UP/DOWN Reversibility Testing

```go
// Go — Test migration reversibility
func TestMigrationReversibility(t *testing.T) {
    ctx := context.Background()
    container := startPostgres(t)
    connStr := container.GetConnectionString()

    m, err := migrate.New("file://../../migrations", connStr)
    require.NoError(t, err)

    // Apply all migrations UP
    err = m.Up()
    require.NoError(t, err)

    // Get final version
    version, dirty, err := m.Version()
    require.NoError(t, err)
    require.False(t, dirty)

    // Roll back ALL migrations
    err = m.Down()
    require.NoError(t, err)

    // Re-apply ALL migrations
    err = m.Up()
    require.NoError(t, err)

    // Should be at same version
    newVersion, dirty, err := m.Version()
    require.NoError(t, err)
    require.False(t, dirty)
    assert.Equal(t, version, newVersion)
}

func TestEachMigrationRoundTrip(t *testing.T) {
    ctx := context.Background()
    container := startPostgres(t)
    connStr := container.GetConnectionString()

    m, err := migrate.New("file://../../migrations", connStr)
    require.NoError(t, err)

    // Step through each migration: UP then DOWN
    for {
        err := m.Steps(1) // UP one
        if err != nil {
            if errors.Is(err, migrate.ErrNoChange) {
                break
            }
            require.NoError(t, err)
        }

        version, _, _ := m.Version()
        t.Logf("Applied migration v%d", version)

        err = m.Steps(-1) // DOWN one
        require.NoError(t, err, "DOWN migration failed for v%d", version)

        err = m.Steps(1) // UP again
        require.NoError(t, err, "Re-UP failed for v%d", version)
    }
}
```

### Data Integrity Testing

```python
# Python — Test data preservation during migration
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

def test_migration_preserves_data(postgres_container):
    """Verify migration doesn't corrupt existing data."""
    engine = create_engine(postgres_container.get_connection_url())
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", postgres_container.get_connection_url())

    # Apply migrations up to N-1
    command.upgrade(alembic_cfg, "abc123")  # previous migration

    # Seed test data
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO users (id, email, name) VALUES
            (1, 'alice@example.com', 'Alice'),
            (2, 'bob@example.com', 'Bob'),
            (3, 'carol@example.com', 'Carol')
        """))
        conn.commit()

    # Apply the migration under test
    command.upgrade(alembic_cfg, "def456")  # migration being tested

    # Verify data is preserved
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        assert result.scalar() == 3

        result = conn.execute(text(
            "SELECT email FROM users ORDER BY id"
        ))
        emails = [row[0] for row in result]
        assert emails == [
            "alice@example.com",
            "bob@example.com",
            "carol@example.com",
        ]

def test_backfill_migration_correctness(postgres_container):
    """Verify data backfill produces correct results."""
    engine = create_engine(postgres_container.get_connection_url())
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", postgres_container.get_connection_url())

    # Apply migrations before backfill
    command.upgrade(alembic_cfg, "before_backfill_rev")

    # Seed data with known patterns
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO users (email, name) VALUES
            ('ALICE@EXAMPLE.COM', 'Alice'),
            ('Bob@Example.COM', 'Bob')
        """))
        conn.commit()

    # Apply backfill migration
    command.upgrade(alembic_cfg, "backfill_normalized_email_rev")

    # Verify backfill correctness
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT email, normalized_email FROM users ORDER BY name"
        ))
        rows = result.fetchall()
        assert rows[0] == ("ALICE@EXAMPLE.COM", "alice@example.com")
        assert rows[1] == ("Bob@Example.COM", "bob@example.com")
```

### Migration Safety Linting

```typescript
// TypeScript — Custom migration linter
interface MigrationLintRule {
  name: string;
  check: (sql: string) => string | null; // returns error message or null
}

const lintRules: MigrationLintRule[] = [
  {
    name: 'no-add-column-not-null-without-default',
    check: (sql) => {
      const pattern = /ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\s+\w+\s+\w+\s+NOT\s+NULL(?!\s+DEFAULT)/gi;
      return pattern.test(sql)
        ? 'ADD COLUMN NOT NULL without DEFAULT locks the table. Add nullable column first, then backfill.'
        : null;
    },
  },
  {
    name: 'no-create-index-without-concurrently',
    check: (sql) => {
      const hasCreateIndex = /CREATE\s+INDEX\s+(?!CONCURRENTLY)/gi.test(sql);
      const hasConcurrently = /CREATE\s+INDEX\s+CONCURRENTLY/gi.test(sql);
      return hasCreateIndex && !hasConcurrently
        ? 'CREATE INDEX without CONCURRENTLY locks writes. Use CREATE INDEX CONCURRENTLY.'
        : null;
    },
  },
  {
    name: 'no-column-rename',
    check: (sql) => {
      return /RENAME\s+COLUMN/gi.test(sql)
        ? 'RENAME COLUMN acquires exclusive lock. Use add/copy/drop pattern instead.'
        : null;
    },
  },
  {
    name: 'no-column-type-change',
    check: (sql) => {
      return /ALTER\s+COLUMN\s+\w+\s+(SET\s+DATA\s+)?TYPE/gi.test(sql)
        ? 'ALTER COLUMN TYPE rewrites entire table. Use add/copy/drop pattern instead.'
        : null;
    },
  },
  {
    name: 'no-drop-column-in-production',
    check: (sql) => {
      return /DROP\s+COLUMN/gi.test(sql)
        ? 'DROP COLUMN is destructive and irreversible. Ensure this is in a contract phase.'
        : null;
    },
  },
  {
    name: 'use-not-valid-for-constraints',
    check: (sql) => {
      const hasAddConstraint = /ADD\s+CONSTRAINT.*(?:FOREIGN\s+KEY|CHECK)/gi.test(sql);
      const hasNotValid = /NOT\s+VALID/gi.test(sql);
      return hasAddConstraint && !hasNotValid
        ? 'ADD CONSTRAINT without NOT VALID scans entire table. Use NOT VALID + VALIDATE.'
        : null;
    },
  },
  {
    name: 'require-lock-timeout',
    check: (sql) => {
      const hasDDL = /ALTER\s+TABLE|CREATE\s+INDEX(?!\s+CONCURRENTLY)|DROP/gi.test(sql);
      const hasLockTimeout = /lock_timeout/gi.test(sql);
      return hasDDL && !hasLockTimeout
        ? 'DDL operations should SET lock_timeout to prevent blocking traffic.'
        : null;
    },
  },
];

function lintMigration(filename: string, sql: string): string[] {
  const errors: string[] = [];
  for (const rule of lintRules) {
    const error = rule.check(sql);
    if (error) {
      errors.push(`[${rule.name}] ${filename}: ${error}`);
    }
  }
  return errors;
}
```

```bash
# Atlas — Built-in migration linting
atlas migrate lint \
  --dir "file://migrations" \
  --dev-url "postgresql://localhost/dev?sslmode=disable" \
  --latest 1

# squawk — PostgreSQL migration linter
# Catches unsafe DDL operations
npm install -g squawk-cli

squawk migrations/003_add_user_phone.sql
# Output:
# migrations/003_add_user_phone.sql:1:1 warning adding-not-nullable-field
#   Adding a NOT NULL column without a DEFAULT will fail for existing rows.
#   Instead, add the column as nullable, backfill, then set NOT NULL.

# CI integration
npx squawk migrations/*.sql --reporter json
```

### Performance Testing Migrations

```bash
#!/bin/bash
# test-migration-performance.sh
# Test migration execution time on production-sized data

set -euo pipefail

DB_URL="postgresql://test:test@staging-db:5432/staging"
MIGRATION_FILE="$1"
MAX_DURATION_SECONDS="${2:-300}"  # Default 5 minute max

echo "Testing migration: $MIGRATION_FILE"
echo "Max allowed duration: ${MAX_DURATION_SECONDS}s"

# Capture migration duration
START=$(date +%s%N)
psql "$DB_URL" -f "$MIGRATION_FILE" 2>&1
END=$(date +%s%N)

DURATION_MS=$(( (END - START) / 1000000 ))
DURATION_S=$(( DURATION_MS / 1000 ))

echo "Migration completed in ${DURATION_S}s (${DURATION_MS}ms)"

if [ "$DURATION_S" -gt "$MAX_DURATION_SECONDS" ]; then
  echo "FAIL: Migration exceeded ${MAX_DURATION_SECONDS}s limit"
  exit 1
fi

# Check for lock contention during migration
psql "$DB_URL" -c "
  SELECT pid, query, state, wait_event_type
  FROM pg_stat_activity
  WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%'
"

echo "PASS: Migration completed within time limit"
```

```yaml
# CI — Migration performance gate
name: Migration Performance Check
on: pull_request

jobs:
  migration-perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Find new migration files
        id: migrations
        run: |
          NEW_MIGRATIONS=$(git diff --name-only origin/main -- 'migrations/*.sql')
          echo "files=$NEW_MIGRATIONS" >> $GITHUB_OUTPUT

      - name: Test migration on staging-sized data
        if: steps.migrations.outputs.files != ''
        run: |
          # Restore staging database snapshot
          pg_restore -d testdb staging-snapshot.dump

          # Apply new migrations with timing
          for migration in ${{ steps.migrations.outputs.files }}; do
            echo "Testing: $migration"
            time psql -d testdb -f "$migration"
          done

      - name: Lint migrations for safety
        if: steps.migrations.outputs.files != ''
        run: |
          for migration in ${{ steps.migrations.outputs.files }}; do
            npx squawk "$migration"
          done
```

---

## Best Practices

1. **ALWAYS test every migration** before deploying to production — UP, DOWN, data integrity
2. **ALWAYS lint migrations** for unsafe DDL operations — use squawk or Atlas lint
3. **ALWAYS test on production-sized data** — a migration fast on 100 rows may be slow on 100M rows
4. **ALWAYS test reversibility** — apply UP then DOWN then UP again for each migration
5. **ALWAYS verify schema after migration** — query information_schema to confirm expected state
6. **ALWAYS test data backfills** — verify correctness with known test data
7. **ALWAYS set performance gates** in CI — reject migrations exceeding time limits
8. **NEVER deploy untested migrations** — the cost of testing is tiny vs cost of production incident
9. **NEVER skip DOWN migration testing** — you need rollback to work when production fails
10. **NEVER test migrations against empty databases only** — seeded data reveals bugs

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No migration testing | Production failures, schema corruption | Test every migration in CI |
| Testing on empty database | Migration works in dev, fails in prod | Seed production-sized test data |
| No safety linting | Unsafe DDL reaches production | Use squawk or Atlas lint in CI |
| No performance testing | Migration takes hours in production | Test on staging with real data volume |
| No reversibility testing | Rollback fails when needed | Test UP → DOWN → UP for each migration |
| No data integrity verification | Data corruption after migration | Assert data preservation in tests |
| Testing wrong database version | Behavior differences cause failures | Match production database version exactly |
| No CI gate for migrations | Bad migrations merge unchecked | Add migration lint + test to PR checks |

---

## Enforcement Checklist

- [ ] Every migration tested in CI (UP + DOWN)
- [ ] Migration linting (squawk/Atlas) in CI pipeline
- [ ] Schema correctness verified via information_schema
- [ ] Data integrity tests for data migrations
- [ ] Performance tested on production-sized dataset
- [ ] Reversibility tested (UP → DOWN → UP)
- [ ] Lock safety verified (no exclusive locks on large tables)
- [ ] Maximum migration duration enforced as CI gate
