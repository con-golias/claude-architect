# Database Integration Testing

| Attribute      | Value                                                    |
|----------------|----------------------------------------------------------|
| Domain         | Testing > Integration Testing                            |
| Importance     | High                                                     |
| Last Updated   | 2026-03-10                                               |
| Cross-ref      | `06-backend/testing/api-testing/endpoint-testing.md`     |

---

## Core Concepts

### Why Test Against a Real Database

Unit tests with mocked repositories verify application logic but miss an entire class of bugs:
incorrect SQL, ORM misconfiguration, constraint violations, migration drift, and query performance
regressions. Database integration tests execute real SQL against a real database engine to catch
these issues before they reach production.

### Isolation Strategies

Choose a strategy based on speed, isolation, and infrastructure requirements:

| Strategy              | Mechanism                                            | Speed   | Isolation | Trade-off                        |
|-----------------------|------------------------------------------------------|---------|-----------|----------------------------------|
| Transaction rollback  | Wrap each test in a transaction, rollback at the end | Fast    | High      | Cannot test commit-dependent behavior |
| Truncation            | `TRUNCATE TABLE ... CASCADE` between tests           | Medium  | High      | Slower than rollback on large schemas |
| Ephemeral containers  | Spin up a fresh DB container per suite               | Slow    | Complete  | Requires Docker; best for CI     |
| Template databases    | `CREATE DATABASE ... TEMPLATE test_template`         | Fast    | Complete  | PostgreSQL-specific              |

### Seeding Reproducible Test Data

Build seed data using deterministic factories rather than production dumps:

- **Factory functions** -- Generate entities with sensible defaults and optional overrides.
- **Seed scripts** -- Idempotent scripts that create a baseline dataset for scenario tests.
- **Fixture files** -- JSON or YAML datasets loaded before test suites.

Avoid randomized data in seeds unless explicitly testing boundary conditions. Randomized seeds produce non-deterministic failures that are difficult to reproduce.

### Testing Migrations

Verify migrations in both directions:

1. **Forward migration** -- Apply all pending migrations to a blank database. Verify that the schema matches expectations.
2. **Rollback migration** -- Roll back the latest migration and confirm the schema returns to the prior state.
3. **Data migration** -- When migrations transform data, seed representative rows before migrating and assert correct transformation afterward.
4. **Migration idempotency** -- Run migrations twice and confirm no errors on the second pass.

### Testing Stored Procedures and Complex Queries

Stored procedures and raw SQL queries deserve dedicated test cases:

- Test with representative data volumes (not just single-row inserts).
- Verify edge cases: NULL values, empty sets, maximum field lengths.
- Assert on exact result sets, not just row counts.
- Test concurrent access patterns when procedures use locking.

---

## Code Examples

### TypeScript: Prisma Test Setup with Transaction Rollback

```typescript
// tests/integration/database/user-repository.test.ts
import { PrismaClient } from "@prisma/client";
import { UserRepository } from "../../../src/repositories/user-repository";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

describe("UserRepository", () => {
  beforeAll(async () => {
    // Run migrations on test database
    await prisma.$executeRawUnsafe("SELECT 1"); // connection check
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe("TRUNCATE TABLE users CASCADE");
  });

  const repo = new UserRepository(prisma);

  describe("create", () => {
    it("persists a user and returns it with generated ID", async () => {
      const user = await repo.create({
        email: "prisma@test.com",
        name: "Prisma User",
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe("prisma@test.com");

      const found = await prisma.user.findUnique({ where: { id: user.id } });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Prisma User");
    });

    it("throws on duplicate email due to unique constraint", async () => {
      await repo.create({ email: "dup@test.com", name: "First" });

      await expect(
        repo.create({ email: "dup@test.com", name: "Second" }),
      ).rejects.toThrow(/Unique constraint/);
    });
  });

  describe("findByEmail", () => {
    it("returns null for non-existent email", async () => {
      const result = await repo.findByEmail("ghost@test.com");
      expect(result).toBeNull();
    });

    it("returns user with matching email", async () => {
      await repo.create({ email: "find@test.com", name: "Findable" });
      const result = await repo.findByEmail("find@test.com");
      expect(result?.name).toBe("Findable");
    });
  });

  describe("complex queries", () => {
    it("paginates results correctly", async () => {
      for (let i = 0; i < 25; i++) {
        await repo.create({ email: `page${i}@test.com`, name: `User ${i}` });
      }

      const page1 = await repo.findAll({ page: 1, pageSize: 10 });
      const page3 = await repo.findAll({ page: 3, pageSize: 10 });

      expect(page1.data).toHaveLength(10);
      expect(page3.data).toHaveLength(5);
      expect(page1.meta.total).toBe(25);
    });
  });
});
```

### Go: pgx Testing with Transaction Rollback Pattern

```go
// repository/user_repo_test.go
package repository_test

import (
    "context"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "myapp/repository"
    "myapp/testutil"
)

func TestUserRepository(t *testing.T) {
    pool := testutil.SetupTestPool(t)
    defer pool.Close()

    t.Run("Create persists user to database", func(t *testing.T) {
        // Begin a transaction and defer rollback for isolation
        tx := testutil.BeginTx(t, pool)
        defer tx.Rollback(context.Background())

        repo := repository.NewUserRepo(tx)

        user, err := repo.Create(context.Background(), repository.CreateUserParams{
            Email: "go@test.com",
            Name:  "Go User",
        })
        require.NoError(t, err)
        assert.NotEmpty(t, user.ID)
        assert.Equal(t, "go@test.com", user.Email)

        // Verify row exists within transaction
        found, err := repo.FindByID(context.Background(), user.ID)
        require.NoError(t, err)
        assert.Equal(t, "Go User", found.Name)
    })

    t.Run("Create fails on duplicate email", func(t *testing.T) {
        tx := testutil.BeginTx(t, pool)
        defer tx.Rollback(context.Background())

        repo := repository.NewUserRepo(tx)

        _, err := repo.Create(context.Background(), repository.CreateUserParams{
            Email: "dup@test.com", Name: "First",
        })
        require.NoError(t, err)

        _, err = repo.Create(context.Background(), repository.CreateUserParams{
            Email: "dup@test.com", Name: "Second",
        })
        assert.Error(t, err)
        assert.Contains(t, err.Error(), "duplicate key")
    })

    t.Run("FindByEmail returns nil for missing user", func(t *testing.T) {
        tx := testutil.BeginTx(t, pool)
        defer tx.Rollback(context.Background())

        repo := repository.NewUserRepo(tx)

        found, err := repo.FindByEmail(context.Background(), "nobody@test.com")
        require.NoError(t, err)
        assert.Nil(t, found)
    })
}

// testutil/db.go -- helper for test setup
package testutil

import (
    "context"
    "os"
    "testing"

    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgxpool"
)

func SetupTestPool(t *testing.T) *pgxpool.Pool {
    t.Helper()
    url := os.Getenv("TEST_DATABASE_URL")
    if url == "" {
        t.Skip("TEST_DATABASE_URL not set")
    }
    pool, err := pgxpool.New(context.Background(), url)
    if err != nil {
        t.Fatalf("failed to connect to test DB: %v", err)
    }
    return pool
}

func BeginTx(t *testing.T, pool *pgxpool.Pool) pgx.Tx {
    t.Helper()
    tx, err := pool.Begin(context.Background())
    if err != nil {
        t.Fatalf("failed to begin transaction: %v", err)
    }
    return tx
}
```

### Python: pytest with SQLAlchemy and Database Fixtures

```python
# tests/integration/test_user_repository.py
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.models import Base
from app.repositories.user_repository import UserRepository


@pytest.fixture(scope="session")
async def engine():
    eng = create_async_engine(settings.TEST_DATABASE_URL, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest.fixture
async def session(engine):
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        async with session.begin():
            # Truncate all tables before each test
            await session.execute(text("TRUNCATE TABLE users CASCADE"))
        yield session
        await session.rollback()


@pytest.fixture
def repo(session):
    return UserRepository(session)


@pytest.mark.asyncio
class TestUserRepository:
    async def test_create_persists_user(self, repo, session):
        user = await repo.create(email="py@test.com", name="Pythonista")
        assert user.id is not None

        found = await repo.find_by_id(user.id)
        assert found is not None
        assert found.email == "py@test.com"

    async def test_create_duplicate_email_raises(self, repo):
        await repo.create(email="dup@test.com", name="First")
        with pytest.raises(Exception, match="unique"):
            await repo.create(email="dup@test.com", name="Second")

    async def test_find_by_email_returns_none_for_missing(self, repo):
        result = await repo.find_by_email("ghost@test.com")
        assert result is None

    async def test_bulk_insert_and_paginate(self, repo):
        for i in range(25):
            await repo.create(email=f"bulk{i}@test.com", name=f"User {i}")

        page = await repo.find_all(page=1, page_size=10)
        assert len(page.items) == 10
        assert page.total == 25

    async def test_soft_delete_excludes_from_queries(self, repo):
        user = await repo.create(email="soft@test.com", name="Soft")
        await repo.soft_delete(user.id)

        result = await repo.find_by_id(user.id)
        assert result is None

        # Verify still in DB with include_deleted flag
        result = await repo.find_by_id(user.id, include_deleted=True)
        assert result is not None
        assert result.deleted_at is not None
```

### Testing Migrations (TypeScript with Knex)

```typescript
// tests/integration/migrations.test.ts
import knex, { Knex } from "knex";

describe("Database Migrations", () => {
  let db: Knex;

  beforeAll(() => {
    db = knex({
      client: "pg",
      connection: process.env.TEST_DATABASE_URL,
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it("applies all migrations forward without error", async () => {
    await db.migrate.rollback(undefined, true); // rollback all
    const [batch, log] = await db.migrate.latest();
    expect(log.length).toBeGreaterThan(0);
    expect(batch).toBeGreaterThan(0);
  });

  it("rolls back the latest migration without error", async () => {
    await db.migrate.latest();
    const [batch, log] = await db.migrate.rollback();
    expect(log.length).toBeGreaterThan(0);
  });

  it("creates the expected tables after full migration", async () => {
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();

    const tables = await db.raw(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tableNames = tables.rows.map((r: any) => r.table_name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("orders");
    expect(tableNames).toContain("knex_migrations");
  });
});
```

---

## 10 Best Practices

1. **Use a dedicated test database** -- Never run integration tests against development or staging databases. Use a separate instance or ephemeral container with a distinct connection string.
2. **Prefer transaction rollback for speed** -- Wrap each test in a transaction and roll back after assertions. This is the fastest isolation method and avoids inter-test contamination.
3. **Run migrations as part of test setup** -- Apply all migrations before the test suite starts. Never assume the test database schema is up to date.
4. **Use factory functions for test data** -- Create deterministic, minimal test entities with defaults. Avoid importing production seed data.
5. **Test constraint violations explicitly** -- Write tests that trigger unique constraints, foreign key violations, NOT NULL errors, and check constraints.
6. **Verify query behavior with representative data volumes** -- Single-row tests miss pagination bugs, index issues, and ORDER BY problems. Seed enough rows to exercise these paths.
7. **Test soft deletes separately from hard deletes** -- Soft-deleted records must be excluded from standard queries but accessible through admin or audit interfaces.
8. **Clean up connections after test suites** -- Close connection pools in `afterAll`/`TestMain` to prevent leaked connections from blocking CI runners.
9. **Keep database tests in a separate test suite** -- Tag or organize DB tests so they can run independently from unit tests. This allows faster feedback loops during development.
10. **Test concurrent access patterns** -- Use goroutines, async tasks, or threads to simulate concurrent writes and verify that locking and isolation levels behave correctly.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Sharing a database across parallel test suites | Data collisions, flaky failures | Use per-suite ephemeral databases or strict schema isolation |
| Relying on auto-increment IDs in assertions | Tests break when execution order changes | Assert on business fields, not surrogate keys |
| Seeding with production data dumps | Slow, non-deterministic, potential PII exposure | Use factories that generate minimal synthetic data |
| Skipping migration tests | Broken migrations discovered only in deployment | Test forward and rollback migrations in CI |
| Not truncating between tests | Prior test data leaks into subsequent assertions | Add truncation or rollback in `beforeEach`/test setup |
| Using ORM-only assertions without raw SQL verification | Misses ORM caching, lazy loading, and mapping bugs | Verify critical data with raw SQL queries |
| Testing against SQLite when production uses PostgreSQL | Misses dialect-specific behavior (JSON, arrays, CTEs) | Use the same database engine in tests and production |
| Leaving connections open after test suite | Exhausts connection pool, blocks CI | Explicitly close pools and connections in teardown |

---

## Enforcement Checklist

- [ ] A dedicated test database is configured and documented in the project setup guide
- [ ] All tests use transaction rollback or truncation for data isolation
- [ ] Factory functions exist for every entity used in database tests
- [ ] Migration tests (forward + rollback) run in CI on every pull request
- [ ] Unique constraint, foreign key, and NOT NULL violations have dedicated test cases
- [ ] Connection pools are explicitly closed in test teardown
- [ ] Database tests are tagged and can run independently from unit tests
- [ ] The same database engine is used in tests and production (no SQLite substitution)
- [ ] Test data volumes are sufficient to exercise pagination and ordering
- [ ] CI pipeline provisions ephemeral databases (Testcontainers or CI service containers)
- [ ] No production data or PII is used in test fixtures
- [ ] Concurrent access tests exist for critical write paths
