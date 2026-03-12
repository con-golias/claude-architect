# Database Testing

> **Domain:** Database > Testing > Database Testing
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Database interactions are the most common source of bugs in production applications — incorrect queries, constraint violations, race conditions, and data corruption. Yet most developers test only application logic with mocked database layers, missing entire categories of bugs that only surface against a real database. Integration testing with real databases using containers catches query errors, constraint violations, and ORM behavior differences that unit tests with mocks cannot. Every production application MUST have database integration tests running against a real database engine.

---

## How It Works

### Testing Pyramid for Database Code

```
Database Testing Strategy:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Layer 1: Unit Tests (Mock DB)                            │
│  ├── Business logic with mocked repositories              │
│  ├── Input validation and transformation                  │
│  ├── Fast, no database required                          │
│  └── ⚠ Cannot catch query bugs or constraint violations  │
│                                                            │
│  Layer 2: Integration Tests (Real DB in Container)       │
│  ├── Repository/DAO layer against real database           │
│  ├── Test queries, constraints, indexes                  │
│  ├── Test ORM behavior (eager loading, cascades)         │
│  ├── Test transactions and rollback behavior             │
│  └── ✅ Catches 90% of database bugs                    │
│                                                            │
│  Layer 3: End-to-End Tests (Full Stack)                   │
│  ├── API endpoints with real database                     │
│  ├── Test complete request/response cycle                │
│  ├── Test data consistency across operations             │
│  └── Slower, fewer tests                                 │
│                                                            │
│  Ratio: 70% Unit / 25% Integration / 5% E2E             │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Testcontainers

```typescript
// TypeScript — Testcontainers with PostgreSQL
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { migrate } from './migrations';

let container: StartedPostgreSqlContainer;
let pool: Pool;

// Start container before all tests (once per test suite)
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('testdb')
    .withUsername('test')
    .withPassword('test')
    .start();

  pool = new Pool({
    connectionString: container.getConnectionUri(),
  });

  // Run migrations to create schema
  await migrate(pool);
}, 60000); // 60s timeout for container startup

afterAll(async () => {
  await pool.end();
  await container.stop();
});

// Clean data between tests (transaction rollback OR truncate)
afterEach(async () => {
  await pool.query(`
    TRUNCATE TABLE order_items, orders, users RESTART IDENTITY CASCADE
  `);
});

describe('UserRepository', () => {
  it('should create and retrieve a user', async () => {
    // Arrange
    const repo = new UserRepository(pool);

    // Act
    const user = await repo.create({
      email: 'alice@example.com',
      name: 'Alice',
    });

    // Assert
    expect(user.id).toBeDefined();
    expect(user.email).toBe('alice@example.com');

    const found = await repo.findById(user.id);
    expect(found).toEqual(user);
  });

  it('should enforce unique email constraint', async () => {
    const repo = new UserRepository(pool);
    await repo.create({ email: 'alice@example.com', name: 'Alice' });

    await expect(
      repo.create({ email: 'alice@example.com', name: 'Bob' })
    ).rejects.toThrow(/unique/i);
  });

  it('should handle concurrent updates with optimistic locking', async () => {
    const repo = new UserRepository(pool);
    const user = await repo.create({ email: 'alice@example.com', name: 'Alice' });

    // Simulate two concurrent updates
    const [result1, result2] = await Promise.allSettled([
      repo.updateWithVersion(user.id, { name: 'Alice A' }, user.version),
      repo.updateWithVersion(user.id, { name: 'Alice B' }, user.version),
    ]);

    // One should succeed, one should fail
    const successes = [result1, result2].filter(r => r.status === 'fulfilled');
    const failures = [result1, result2].filter(r => r.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});
```

```python
# Python — Testcontainers with PostgreSQL
import pytest
from testcontainers.postgres import PostgresContainer
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, User, Order
from app.repositories import UserRepository


@pytest.fixture(scope="session")
def postgres_container():
    """Start PostgreSQL container once for entire test session."""
    with PostgresContainer("postgres:16") as postgres:
        yield postgres


@pytest.fixture(scope="session")
def engine(postgres_container):
    """Create engine and schema once."""
    engine = create_engine(postgres_container.get_connection_url())
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def session(engine):
    """Create a new session for each test with rollback."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    # Rollback after each test — clean isolation
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def user_repo(session):
    return UserRepository(session)


class TestUserRepository:
    def test_create_user(self, user_repo, session):
        user = user_repo.create(email="alice@example.com", name="Alice")

        assert user.id is not None
        assert user.email == "alice@example.com"

        # Verify persisted
        found = user_repo.find_by_id(user.id)
        assert found.name == "Alice"

    def test_unique_email_constraint(self, user_repo):
        user_repo.create(email="alice@example.com", name="Alice")

        with pytest.raises(Exception, match="unique"):
            user_repo.create(email="alice@example.com", name="Bob")

    def test_cascade_delete(self, user_repo, session):
        user = user_repo.create(email="alice@example.com", name="Alice")
        order = Order(user_id=user.id, total=99.99)
        session.add(order)
        session.flush()

        user_repo.delete(user.id)

        # Order should be cascade deleted
        assert session.get(Order, order.id) is None
```

```go
// Go — Testcontainers with PostgreSQL
package repository_test

import (
    "context"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/wait"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
    ctx := context.Background()

    // Start PostgreSQL container
    container, err := postgres.Run(ctx,
        "postgres:16",
        postgres.WithDatabase("testdb"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("database system is ready to accept connections").
                WithOccurrence(2),
        ),
    )
    if err != nil {
        panic(err)
    }
    defer container.Terminate(ctx)

    connStr, err := container.ConnectionString(ctx, "sslmode=disable")
    if err != nil {
        panic(err)
    }

    testPool, err = pgxpool.New(ctx, connStr)
    if err != nil {
        panic(err)
    }
    defer testPool.Close()

    // Run migrations
    if err := RunMigrations(connStr); err != nil {
        panic(err)
    }

    m.Run()
}

func cleanupTables(t *testing.T) {
    t.Helper()
    _, err := testPool.Exec(context.Background(),
        "TRUNCATE TABLE order_items, orders, users RESTART IDENTITY CASCADE")
    require.NoError(t, err)
}

func TestUserRepository_Create(t *testing.T) {
    cleanupTables(t)
    repo := NewUserRepository(testPool)

    user, err := repo.Create(context.Background(), CreateUserInput{
        Email: "alice@example.com",
        Name:  "Alice",
    })

    require.NoError(t, err)
    assert.NotEmpty(t, user.ID)
    assert.Equal(t, "alice@example.com", user.Email)

    // Verify retrieval
    found, err := repo.FindByID(context.Background(), user.ID)
    require.NoError(t, err)
    assert.Equal(t, user.Email, found.Email)
}

func TestUserRepository_UniqueConstraint(t *testing.T) {
    cleanupTables(t)
    repo := NewUserRepository(testPool)

    _, err := repo.Create(context.Background(), CreateUserInput{
        Email: "alice@example.com", Name: "Alice",
    })
    require.NoError(t, err)

    _, err = repo.Create(context.Background(), CreateUserInput{
        Email: "alice@example.com", Name: "Bob",
    })
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "unique")
}
```

### Test Data Management

```typescript
// TypeScript — Factory pattern for test data
import { faker } from '@faker-js/faker';

// Factory functions — generate realistic test data
function createUserInput(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  return {
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'user',
    ...overrides,
  };
}

function createOrderInput(
  userId: string,
  overrides: Partial<CreateOrderInput> = {}
): CreateOrderInput {
  return {
    userId,
    total: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
    status: 'pending',
    items: [
      {
        productId: faker.string.uuid(),
        quantity: faker.number.int({ min: 1, max: 5 }),
        price: parseFloat(faker.commerce.price({ min: 5, max: 100 })),
      },
    ],
    ...overrides,
  };
}

// Seeder — create complex test scenarios
async function seedOrderScenario(repo: Repositories) {
  const user = await repo.users.create(createUserInput());

  const pendingOrder = await repo.orders.create(
    createOrderInput(user.id, { status: 'pending' })
  );
  const shippedOrder = await repo.orders.create(
    createOrderInput(user.id, { status: 'shipped' })
  );
  const deliveredOrder = await repo.orders.create(
    createOrderInput(user.id, { status: 'delivered' })
  );

  return { user, pendingOrder, shippedOrder, deliveredOrder };
}
```

```python
# Python — Factory Boy for test data
import factory
from factory.alchemy import SQLAlchemyModelFactory
from app.models import User, Order

class UserFactory(SQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session_persistence = "commit"

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    name = factory.Faker("name")
    role = "user"

class OrderFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Order
        sqlalchemy_session_persistence = "commit"

    user = factory.SubFactory(UserFactory)
    total = factory.Faker("pydecimal", left_digits=3, right_digits=2, positive=True)
    status = "pending"

# Usage in tests
def test_user_with_orders(session):
    user = UserFactory(session=session, name="Alice")
    orders = OrderFactory.create_batch(5, session=session, user=user)

    assert len(user.orders) == 5
```

### Test Isolation Strategies

```
Test Isolation Approaches:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  1. Transaction Rollback (Fastest)                        │
│     - Wrap each test in a transaction                    │
│     - Rollback after test completes                      │
│     - ✅ Very fast, no cleanup needed                    │
│     - ❌ Cannot test COMMIT behavior                     │
│     - ❌ Cannot test concurrent transactions             │
│     - Best for: Most integration tests                   │
│                                                            │
│  2. TRUNCATE Tables (Fast)                                │
│     - TRUNCATE all tables between tests                  │
│     - RESTART IDENTITY CASCADE                           │
│     - ✅ Clean state, tests can commit                   │
│     - ❌ Slower than rollback                            │
│     - Best for: Tests requiring committed data           │
│                                                            │
│  3. DROP + CREATE Schema (Clean but Slow)                │
│     - Drop and recreate entire schema between tests      │
│     - Re-run migrations                                  │
│     - ✅ Guaranteed clean state                          │
│     - ❌ Very slow for large schemas                     │
│     - Best for: Schema migration tests only              │
│                                                            │
│  4. Separate Database per Test (Slowest)                 │
│     - Create new database for each test                  │
│     - ✅ Complete isolation                              │
│     - ❌ Very slow, resource intensive                   │
│     - Best for: Tests that modify schema                 │
│                                                            │
│  Recommendation: Transaction rollback by default,        │
│  TRUNCATE when transactions interfere with test logic    │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Testing Specific Database Features

```typescript
// Testing constraints
describe('Database Constraints', () => {
  it('should enforce NOT NULL on required fields', async () => {
    await expect(
      pool.query("INSERT INTO users (email) VALUES ('test@example.com')")
    ).rejects.toThrow(/not-null/i); // name is required
  });

  it('should enforce CHECK constraint on order total', async () => {
    const user = await createTestUser(pool);
    await expect(
      pool.query('INSERT INTO orders (user_id, total) VALUES ($1, $2)', [user.id, -10])
    ).rejects.toThrow(/check/i); // total must be positive
  });

  it('should enforce foreign key constraint', async () => {
    await expect(
      pool.query("INSERT INTO orders (user_id, total) VALUES ('nonexistent-id', 99.99)")
    ).rejects.toThrow(/foreign key/i);
  });
});

// Testing transactions
describe('Transaction Behavior', () => {
  it('should rollback on error', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await createTestUser(client);
      await client.query('ROLLBACK');

      // User should not exist after rollback
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
      expect(result.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('should handle deadlock gracefully', async () => {
    const user1 = await createTestUser(pool);
    const user2 = await createTestUser(pool);

    // Simulate deadlock with concurrent updates in opposite order
    const tx1 = pool.connect().then(async (client) => {
      await client.query('BEGIN');
      await client.query('UPDATE users SET name = $1 WHERE id = $2', ['A', user1.id]);
      await new Promise(r => setTimeout(r, 100));
      await client.query('UPDATE users SET name = $1 WHERE id = $2', ['A', user2.id]);
      await client.query('COMMIT');
      client.release();
    });

    const tx2 = pool.connect().then(async (client) => {
      await client.query('BEGIN');
      await client.query('UPDATE users SET name = $1 WHERE id = $2', ['B', user2.id]);
      await new Promise(r => setTimeout(r, 100));
      await client.query('UPDATE users SET name = $1 WHERE id = $2', ['B', user1.id]);
      await client.query('COMMIT');
      client.release();
    });

    // One transaction should succeed, one should fail with deadlock
    const results = await Promise.allSettled([tx1, tx2]);
    const failures = results.filter(r => r.status === 'rejected');
    expect(failures.length).toBeGreaterThanOrEqual(1);
  });
});

// Testing indexes (performance)
describe('Index Performance', () => {
  it('should use index for email lookup', async () => {
    // Seed enough data to trigger index usage
    for (let i = 0; i < 1000; i++) {
      await pool.query(
        "INSERT INTO users (email, name) VALUES ($1, $2)",
        [`user${i}@example.com`, `User ${i}`]
      );
    }

    const explain = await pool.query(
      'EXPLAIN (FORMAT JSON) SELECT * FROM users WHERE email = $1',
      ['user500@example.com']
    );

    const plan = explain.rows[0]['QUERY PLAN'][0]['Plan'];
    expect(plan['Node Type']).toContain('Index');
  });
});
```

### CI/CD Configuration

```yaml
# GitHub Actions — Database integration tests
name: Database Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run migrate -- --database-url postgresql://test:test@localhost:5432/testdb
      - run: npm test -- --testPathPattern='.*\.integration\.test\.ts$'
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb

  # Alternative: Testcontainers (no service container needed)
  test-containers:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test -- --testPathPattern='.*\.integration\.test\.ts$'
        env:
          TESTCONTAINERS_RYUK_DISABLED: true
```

---

## Best Practices

1. **ALWAYS test against a real database** — mocks miss query bugs, constraint violations, and ORM behavior
2. **ALWAYS use Testcontainers** — spin up real database in container, identical to production
3. **ALWAYS use transaction rollback** for test isolation — fastest approach for most tests
4. **ALWAYS use factory functions** for test data — avoid brittle hardcoded fixtures
5. **ALWAYS test constraints** (NOT NULL, UNIQUE, FK, CHECK) — they are part of your data contract
6. **ALWAYS test concurrent access** — race conditions only appear under concurrency
7. **ALWAYS match database version** in tests to production — behavior differs across versions
8. **NEVER mock the database layer** for integration tests — defeats the purpose entirely
9. **NEVER share mutable state between tests** — each test must start with clean data
10. **NEVER skip database tests in CI** — they catch bugs that nothing else can

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Only mocking database | Bugs in queries reach production | Add integration tests with real DB |
| Shared test data | Tests fail when run in different order | Transaction rollback or TRUNCATE per test |
| Testing against SQLite instead of PostgreSQL | Syntax/behavior differences cause false passes | Use same DB engine as production (Testcontainers) |
| No constraint testing | Constraint violations in production | Explicitly test NOT NULL, UNIQUE, FK |
| Hardcoded test data | Brittle, hard to maintain | Use factories (faker, Factory Boy) |
| No CI database tests | Database bugs reach staging/production | Add DB service to CI pipeline |
| Testing ORM methods only | Missing raw query bugs | Test both ORM and raw SQL paths |
| No performance regression tests | Slow queries not detected until production | Test EXPLAIN plans for critical queries |

---

## Enforcement Checklist

- [ ] Integration tests run against real database (Testcontainers or CI service)
- [ ] Database version in tests matches production
- [ ] Test isolation via transaction rollback or TRUNCATE
- [ ] Factory functions used for test data generation
- [ ] Constraint tests (NOT NULL, UNIQUE, FK, CHECK) in place
- [ ] Transaction behavior tested (commit, rollback, deadlock)
- [ ] Concurrent access tests for critical operations
- [ ] Database tests included in CI pipeline
- [ ] Critical query performance validated with EXPLAIN
