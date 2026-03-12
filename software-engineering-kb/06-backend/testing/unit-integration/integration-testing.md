# Integration Testing

> **Domain:** Backend > Testing
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Unit tests test components in isolation. But the real world is not isolated -- services talk to databases, APIs, queues, caches. Integration tests verify that these components work correctly TOGETHER. A unit test can pass while the SQL query is wrong, the ORM mapping is broken, or the HTTP client does not send the correct headers. Integration tests catch these bugs. The right balance: enough integration tests for confidence, but not so many that CI takes 30 minutes.

---

## How It Works

### Integration Test Scope

```
Unit Test          Integration Test          E2E Test
─────────────────────────────────────────────────────────
                   ┌─────────────────────┐
  ┌───────┐        │  ┌───────┐          │  ┌─────────┐
  │ Func  │        │  │Service│          │  │ Browser │
  │ only  │        │  │  +    │          │  │ + API   │
  └───────┘        │  │  DB   │          │  │ + DB    │
                   │  │  +    │          │  │ + Queue │
  No I/O           │  │ Cache │          │  │ + Auth  │
                   │  └───────┘          │  └─────────┘
                   └─────────────────────┘
                   Real DB, real cache       Full stack
                   Mocked external APIs      Real everything
```

### Database Integration Tests with Testcontainers

```typescript
// TypeScript — Testcontainers (PostgreSQL)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import { UserRepository } from "./user-repository";
import { migrate } from "./migrations";

describe("UserRepository (PostgreSQL)", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let repo: UserRepository;

  beforeAll(async () => {
    // Start real PostgreSQL in Docker
    container = await new PostgreSqlContainer("postgres:16")
      .withDatabase("testdb")
      .start();

    pool = new Pool({
      connectionString: container.getConnectionUri(),
    });

    // Run real migrations
    await migrate(pool);

    repo = new UserRepository(pool);
  }, 60_000); // 60s timeout for container startup

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  // Clean up between tests — not between ALL tests
  beforeEach(async () => {
    await pool.query("DELETE FROM users");
  });

  it("should insert and retrieve user", async () => {
    const user = {
      email: "john@example.com",
      name: "John Doe",
      role: "user",
    };

    const created = await repo.create(user);
    const found = await repo.findById(created.id);

    expect(found).toEqual(expect.objectContaining({
      id: created.id,
      email: "john@example.com",
      name: "John Doe",
      role: "user",
    }));
  });

  it("should enforce unique email constraint", async () => {
    await repo.create({ email: "john@example.com", name: "John", role: "user" });

    await expect(
      repo.create({ email: "john@example.com", name: "Jane", role: "user" })
    ).rejects.toThrow(/unique.*email/i);
  });

  it("should paginate results correctly", async () => {
    // Insert 25 users
    for (let i = 0; i < 25; i++) {
      await repo.create({
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: "user",
      });
    }

    const page1 = await repo.findAll({ page: 1, limit: 10 });
    const page2 = await repo.findAll({ page: 2, limit: 10 });
    const page3 = await repo.findAll({ page: 3, limit: 10 });

    expect(page1.data).toHaveLength(10);
    expect(page2.data).toHaveLength(10);
    expect(page3.data).toHaveLength(5);
    expect(page1.total).toBe(25);
  });

  it("should handle concurrent updates with optimistic locking", async () => {
    const user = await repo.create({
      email: "john@example.com",
      name: "John",
      role: "user",
    });

    // Two concurrent updates
    const update1 = repo.update(user.id, { name: "John Updated" }, user.version);
    const update2 = repo.update(user.id, { name: "John Changed" }, user.version);

    const results = await Promise.allSettled([update1, update2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1); // Optimistic lock failure
  });
});
```

```go
// Go — Testcontainers
package repository_test

import (
    "context"
    "testing"

    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/wait"
    "github.com/jackc/pgx/v5/pgxpool"

    "myapp/repository"
    "myapp/migrations"
)

func setupPostgres(t *testing.T) (*pgxpool.Pool, func()) {
    t.Helper()
    ctx := context.Background()

    container, err := postgres.Run(ctx,
        "postgres:16",
        postgres.WithDatabase("testdb"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("ready to accept connections").
                WithOccurrence(2),
        ),
    )
    if err != nil {
        t.Fatalf("start container: %v", err)
    }

    connStr, err := container.ConnectionString(ctx, "sslmode=disable")
    if err != nil {
        t.Fatalf("connection string: %v", err)
    }

    pool, err := pgxpool.New(ctx, connStr)
    if err != nil {
        t.Fatalf("create pool: %v", err)
    }

    // Run migrations
    if err := migrations.Run(pool); err != nil {
        t.Fatalf("migrate: %v", err)
    }

    cleanup := func() {
        pool.Close()
        container.Terminate(ctx)
    }

    return pool, cleanup
}

func TestUserRepository_Create(t *testing.T) {
    pool, cleanup := setupPostgres(t)
    defer cleanup()

    repo := repository.NewUserRepository(pool)
    ctx := context.Background()

    user, err := repo.Create(ctx, repository.CreateUserInput{
        Email: "john@example.com",
        Name:  "John Doe",
        Role:  "user",
    })
    if err != nil {
        t.Fatalf("create user: %v", err)
    }

    found, err := repo.FindByID(ctx, user.ID)
    if err != nil {
        t.Fatalf("find user: %v", err)
    }

    if found.Email != "john@example.com" {
        t.Errorf("email = %q, want john@example.com", found.Email)
    }
}

func TestUserRepository_UniqueEmail(t *testing.T) {
    pool, cleanup := setupPostgres(t)
    defer cleanup()

    repo := repository.NewUserRepository(pool)
    ctx := context.Background()

    _, err := repo.Create(ctx, repository.CreateUserInput{
        Email: "john@example.com", Name: "John", Role: "user",
    })
    if err != nil {
        t.Fatalf("first create: %v", err)
    }

    _, err = repo.Create(ctx, repository.CreateUserInput{
        Email: "john@example.com", Name: "Jane", Role: "user",
    })
    if err == nil {
        t.Fatal("expected unique constraint error")
    }
}
```

```python
# Python — Testcontainers
import pytest
from testcontainers.postgres import PostgresContainer
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.repositories import UserRepository

@pytest.fixture(scope="module")
def postgres_container():
    with PostgresContainer("postgres:16") as pg:
        yield pg

@pytest.fixture(scope="module")
async def engine(postgres_container):
    url = postgres_container.get_connection_url().replace(
        "psycopg2", "asyncpg"
    )
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def session(engine):
    async_session = sessionmaker(engine, class_=AsyncSession)
    async with async_session() as session:
        yield session
        await session.rollback()  # Clean state per test

@pytest.fixture
def repo(session):
    return UserRepository(session)

class TestUserRepository:
    async def test_create_and_find(self, repo):
        user = await repo.create(
            email="john@example.com", name="John Doe", role="user"
        )
        found = await repo.find_by_id(user.id)

        assert found is not None
        assert found.email == "john@example.com"
        assert found.name == "John Doe"

    async def test_unique_email_constraint(self, repo):
        await repo.create(
            email="john@example.com", name="John", role="user"
        )

        with pytest.raises(Exception, match="unique"):
            await repo.create(
                email="john@example.com", name="Jane", role="user"
            )
```

---

## Redis Integration Tests

```typescript
// TypeScript — Redis Integration
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import { CacheService } from "./cache-service";

describe("CacheService (Redis)", () => {
  let container: StartedRedisContainer;
  let redis: Redis;
  let cache: CacheService;

  beforeAll(async () => {
    container = await new RedisContainer("redis:7").start();
    redis = new Redis({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    });
    cache = new CacheService(redis);
  }, 30_000);

  afterAll(async () => {
    await redis.quit();
    await container.stop();
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  it("should cache and retrieve value with TTL", async () => {
    await cache.set("user:123", { name: "John" }, 300);

    const value = await cache.get("user:123");
    expect(value).toEqual({ name: "John" });

    const ttl = await redis.ttl("user:123");
    expect(ttl).toBeGreaterThan(290);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it("should return null for expired keys", async () => {
    await cache.set("temp", "value", 1); // 1 second TTL

    await new Promise((r) => setTimeout(r, 1500)); // Wait for expiry

    const value = await cache.get("temp");
    expect(value).toBeNull();
  });

  it("should handle cache stampede with locking", async () => {
    let fetchCount = 0;
    const expensiveFetch = async () => {
      fetchCount++;
      await new Promise((r) => setTimeout(r, 100)); // Simulate slow DB
      return { data: "expensive" };
    };

    // Concurrent requests for same key
    const results = await Promise.all([
      cache.getOrSet("key", expensiveFetch, 300),
      cache.getOrSet("key", expensiveFetch, 300),
      cache.getOrSet("key", expensiveFetch, 300),
    ]);

    // All should get same result
    results.forEach((r) => expect(r).toEqual({ data: "expensive" }));

    // But fetch should only be called once (lock prevents stampede)
    expect(fetchCount).toBe(1);
  });
});
```

---

## HTTP Client Integration Tests

```typescript
// TypeScript — External API Integration with MSW (Mock Service Worker)
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { PaymentGateway } from "./payment-gateway";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("PaymentGateway", () => {
  const gateway = new PaymentGateway({
    baseUrl: "https://api.payments.test",
    apiKey: "test-key",
  });

  it("should create charge successfully", async () => {
    server.use(
      http.post("https://api.payments.test/v1/charges", async ({ request }) => {
        const body = await request.json() as any;

        // Verify request structure
        expect(body.amount).toBe(1000);
        expect(body.currency).toBe("eur");
        expect(request.headers.get("Authorization")).toBe("Bearer test-key");

        return HttpResponse.json({
          id: "ch_123",
          amount: 1000,
          currency: "eur",
          status: "succeeded",
        });
      })
    );

    const charge = await gateway.createCharge({
      amount: 1000,
      currency: "eur",
      source: "tok_visa",
    });

    expect(charge.id).toBe("ch_123");
    expect(charge.status).toBe("succeeded");
  });

  it("should retry on 503 and succeed", async () => {
    let attemptCount = 0;

    server.use(
      http.post("https://api.payments.test/v1/charges", () => {
        attemptCount++;
        if (attemptCount < 3) {
          return new HttpResponse(null, { status: 503 });
        }
        return HttpResponse.json({
          id: "ch_123",
          status: "succeeded",
        });
      })
    );

    const charge = await gateway.createCharge({
      amount: 1000,
      currency: "eur",
      source: "tok_visa",
    });

    expect(charge.status).toBe("succeeded");
    expect(attemptCount).toBe(3); // 2 failures + 1 success
  });

  it("should throw after max retries exhausted", async () => {
    server.use(
      http.post("https://api.payments.test/v1/charges", () => {
        return new HttpResponse(null, { status: 503 });
      })
    );

    await expect(
      gateway.createCharge({ amount: 1000, currency: "eur", source: "tok_visa" })
    ).rejects.toThrow("Payment gateway unavailable");
  });

  it("should handle timeout gracefully", async () => {
    server.use(
      http.post("https://api.payments.test/v1/charges", async () => {
        await new Promise((r) => setTimeout(r, 10_000)); // Hang
        return HttpResponse.json({});
      })
    );

    await expect(
      gateway.createCharge({ amount: 1000, currency: "eur", source: "tok_visa" })
    ).rejects.toThrow(/timeout/i);
  });
});
```

```go
// Go — HTTP Integration with httptest
package gateway_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "sync/atomic"
    "testing"

    "myapp/gateway"
)

func TestPaymentGateway_CreateCharge(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Verify request
        if r.Method != http.MethodPost {
            t.Errorf("method = %s, want POST", r.Method)
        }
        if r.URL.Path != "/v1/charges" {
            t.Errorf("path = %s, want /v1/charges", r.URL.Path)
        }
        if r.Header.Get("Authorization") != "Bearer test-key" {
            t.Error("missing auth header")
        }

        var body map[string]interface{}
        json.NewDecoder(r.Body).Decode(&body)
        if body["amount"] != float64(1000) {
            t.Errorf("amount = %v, want 1000", body["amount"])
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]interface{}{
            "id":     "ch_123",
            "status": "succeeded",
        })
    }))
    defer server.Close()

    gw := gateway.New(server.URL, "test-key")
    charge, err := gw.CreateCharge(gateway.ChargeInput{
        Amount:   1000,
        Currency: "eur",
    })

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if charge.ID != "ch_123" {
        t.Errorf("id = %q, want ch_123", charge.ID)
    }
}

func TestPaymentGateway_RetryOn503(t *testing.T) {
    var attempts int32

    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        count := atomic.AddInt32(&attempts, 1)
        if count < 3 {
            w.WriteHeader(http.StatusServiceUnavailable)
            return
        }
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]interface{}{
            "id": "ch_123", "status": "succeeded",
        })
    }))
    defer server.Close()

    gw := gateway.New(server.URL, "test-key")
    charge, err := gw.CreateCharge(gateway.ChargeInput{Amount: 1000, Currency: "eur"})

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if charge.ID != "ch_123" {
        t.Errorf("id = %q, want ch_123", charge.ID)
    }
    if atomic.LoadInt32(&attempts) != 3 {
        t.Errorf("attempts = %d, want 3", attempts)
    }
}
```

---

## Message Queue Integration Tests

```typescript
// TypeScript — RabbitMQ Integration
import { RabbitMQContainer } from "@testcontainers/rabbitmq";
import amqplib from "amqplib";

describe("OrderEventPublisher (RabbitMQ)", () => {
  let container;
  let connection: amqplib.Connection;

  beforeAll(async () => {
    container = await new RabbitMQContainer("rabbitmq:3.13").start();
    connection = await amqplib.connect(container.getAmqpUrl());
  }, 60_000);

  afterAll(async () => {
    await connection.close();
    await container.stop();
  });

  it("should publish and consume order event", async () => {
    const channel = await connection.createChannel();
    const queue = "test-orders";

    await channel.assertQueue(queue, { durable: false });

    // Publish
    const event = { type: "order.created", data: { id: "ord_123" } };
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(event)));

    // Consume
    const received = await new Promise<any>((resolve) => {
      channel.consume(queue, (msg) => {
        if (msg) {
          channel.ack(msg);
          resolve(JSON.parse(msg.content.toString()));
        }
      });
    });

    expect(received.type).toBe("order.created");
    expect(received.data.id).toBe("ord_123");

    await channel.close();
  });
});
```

---

## Test Data Management

### Factories & Builders

```typescript
// TypeScript — Test Data Factory
class UserFactory {
  private static counter = 0;

  static build(overrides: Partial<User> = {}): User {
    UserFactory.counter++;
    return {
      id: `user_${UserFactory.counter}`,
      email: `user${UserFactory.counter}@test.com`,
      name: `Test User ${UserFactory.counter}`,
      role: "user",
      createdAt: new Date("2024-01-01"),
      ...overrides,
    };
  }

  static buildAdmin(overrides: Partial<User> = {}): User {
    return UserFactory.build({ role: "admin", ...overrides });
  }

  static buildMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => UserFactory.build(overrides));
  }
}

// Usage in tests
it("should list only admins", async () => {
  await repo.create(UserFactory.build({ role: "user" }));
  await repo.create(UserFactory.buildAdmin());
  await repo.create(UserFactory.buildAdmin());

  const admins = await repo.findByRole("admin");
  expect(admins).toHaveLength(2);
});
```

### Database Cleanup Strategies

| Strategy | Speed | Isolation | Usage |
|----------|----------|-----------|-------|
| **Transaction rollback** | Fastest | Perfect | Wrap each test in transaction, rollback |
| **TRUNCATE** | Fast | Good | `TRUNCATE table CASCADE` between tests |
| **DELETE** | Medium | Good | `DELETE FROM table` between tests |
| **Fresh database** | Slowest | Perfect | New container per test (Testcontainers) |

```typescript
// Transaction rollback pattern (fastest)
beforeEach(async () => {
  await pool.query("BEGIN");
});

afterEach(async () => {
  await pool.query("ROLLBACK");
});
```

---

## Best Practices

1. **ALWAYS use Testcontainers** — real database, not mocks, for repository tests
2. **ALWAYS clean data between tests** — transaction rollback or TRUNCATE
3. **ALWAYS run migrations in test setup** — test against real schema
4. **ALWAYS use factories for test data** — consistent, readable, DRY
5. **ALWAYS test error paths** — constraint violations, timeouts, connection failures
6. **ALWAYS mock ONLY external APIs** — use MSW/httptest, not database mocks
7. **NEVER use production databases for tests** — always isolated containers
8. **NEVER test internal ORM/framework methods** — test YOUR code, not the library
9. **NEVER hardcode test data** — use factories with overrides
10. **NEVER skip cleanup** — leaking data = flaky tests

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Mocking the database | Tests pass, queries fail in prod | Testcontainers with real DB |
| Shared test database | Tests interfere with each other | Isolated container per test suite |
| No data cleanup | Flaky tests, order-dependent | Transaction rollback or TRUNCATE |
| Testing against SQLite instead of PostgreSQL | Dialect differences cause prod bugs | Use same DB engine as production |
| Hardcoded test data | Fragile, hard to maintain | Factory pattern with defaults |
| Too many integration tests | Slow CI (>10 min) | Integration for I/O, unit for logic |
| No timeout on containers | CI hangs forever | Set container startup timeouts |
| Ignoring connection pooling | Tests pass, prod fails under load | Test with production-like pool config |

---

## Real-world Examples

### Shopify
- Testcontainers for MySQL and Redis
- Transaction rollback for speed
- ~50,000 integration tests, <10 minutes with parallelism
- Factory Bot (Ruby) for test data

### GitHub
- Separate test databases per CI worker
- Schema migrations tested in CI
- Integration tests for every DB query
- Fixtures + factories hybrid approach

### Uber
- Integration tests for every microservice boundary
- Contract tests between services
- Testcontainers-based local development
- <5 minute integration test suite target
