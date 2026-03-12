# Testcontainers

| Attribute      | Value                                                    |
|----------------|----------------------------------------------------------|
| Domain         | Testing > Integration Testing                            |
| Importance     | High                                                     |
| Last Updated   | 2026-03-10                                               |
| Cross-ref      | `06-backend/testing/api-testing/endpoint-testing.md`     |

---

## Core Concepts

### What Testcontainers Solves

Testcontainers provides programmatic control over Docker containers within test code. Instead of
requiring developers to manually start databases, caches, and message brokers before running tests,
the test suite provisions its own ephemeral infrastructure, runs assertions against it, and tears
it down automatically. This eliminates "works on my machine" failures and ensures every test run
starts from a clean state.

### Architecture

```
Test Code
  |
  +---> Testcontainers Library
          |
          +---> Docker API (local Docker daemon or remote)
                  |
                  +---> Container: PostgreSQL 16
                  +---> Container: Redis 7
                  +---> Container: Kafka 3.6
                  +---> Container: Custom App Image
```

The library communicates with the Docker daemon via the Docker API, creates containers with
specified images and configuration, waits for readiness, and provides connection details (host,
port, credentials) back to the test code.

### Ecosystem Maturity by Language

| Language    | Package                          | Maturity   | Notes                                |
|-------------|----------------------------------|------------|--------------------------------------|
| Java/Kotlin | `org.testcontainers`            | Most mature | Original implementation, richest module library |
| Go          | `testcontainers-go`             | Mature     | First-class support, good module coverage |
| Python      | `testcontainers-python`         | Mature     | Covers databases, caches, message brokers |
| TypeScript  | `@testcontainers/*`             | Growing    | Modular packages per infrastructure type |
| .NET        | `Testcontainers.NET`            | Mature     | Strong SQL Server and Azure integration |
| Rust        | `testcontainers`                | Early      | Community-driven, fewer modules      |

### Container Reuse Strategies

Starting containers is the slowest part of Testcontainers-based tests. Apply these strategies to
reduce overhead:

| Strategy                  | Mechanism                                             | Speed Gain | Trade-off                          |
|---------------------------|-------------------------------------------------------|------------|------------------------------------|
| Suite-scoped containers   | Start once in `beforeAll`/`TestMain`, share across tests | High    | Requires data cleanup between tests |
| Reusable containers       | `withReuse(true)` keeps container alive between runs  | Very high  | Stale state risk; use only locally |
| Parallel container startup | Start independent containers concurrently            | Medium     | Higher peak memory/CPU usage       |
| Singleton pattern         | Module-level container shared across test files       | High       | Requires cleanup discipline        |

### When to Use Testcontainers vs In-Memory Alternatives

| Scenario                                      | Use Testcontainers           | Use In-Memory Alternative        |
|-----------------------------------------------|------------------------------|----------------------------------|
| SQL database (PostgreSQL, MySQL)              | Always -- dialect matters    | Never -- SQLite differs too much |
| Redis                                         | Prefer -- Lua scripts, modules | Acceptable for basic get/set   |
| Kafka / RabbitMQ                              | Always -- protocol complexity | Acceptable for unit-level tests |
| Elasticsearch / OpenSearch                    | Always -- query DSL fidelity | Never                            |
| S3-compatible storage                         | Prefer (MinIO container)     | Acceptable with mock client      |
| Simple key-value cache                        | Optional                     | In-memory map is sufficient      |

### CI/CD Integration

Running Testcontainers in CI requires Docker access. Common approaches:

- **GitHub Actions** -- Docker is available by default on `ubuntu-latest` runners.
- **GitLab CI** -- Use Docker-in-Docker (`dind`) service or mount the Docker socket.
- **Jenkins** -- Use agents with Docker installed, or Kubernetes pods with Docker sidecar.
- **Kubernetes-based CI** -- Use Testcontainers Cloud or a privileged DinD sidecar container.

---

## Code Examples

### TypeScript: @testcontainers/postgresql

```typescript
// tests/integration/user-repo-tc.test.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from
  "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { UserRepository } from "../../src/repositories/user-repository";

describe("UserRepository with Testcontainers", () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repo: UserRepository;

  beforeAll(async () => {
    // Start PostgreSQL container -- typically takes 3-8 seconds
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("testdb")
      .withUsername("test")
      .withPassword("test")
      .withExposedPorts(5432)
      .start();

    const connectionUri = container.getConnectionUri();

    // Run Prisma migrations against the container
    execSync(`DATABASE_URL="${connectionUri}" npx prisma migrate deploy`, {
      stdio: "inherit",
    });

    prisma = new PrismaClient({
      datasources: { db: { url: connectionUri } },
    });

    repo = new UserRepository(prisma);
  }, 60_000); // Extended timeout for container startup

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe("TRUNCATE TABLE users CASCADE");
  });

  it("creates and retrieves a user", async () => {
    const user = await repo.create({
      email: "tc@test.com",
      name: "Testcontainer User",
    });

    const found = await repo.findByEmail("tc@test.com");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
  });

  it("enforces unique email constraint", async () => {
    await repo.create({ email: "unique@test.com", name: "First" });

    await expect(
      repo.create({ email: "unique@test.com", name: "Second" }),
    ).rejects.toThrow();
  });

  it("handles concurrent inserts correctly", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      repo.create({ email: `concurrent${i}@test.com`, name: `User ${i}` }),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);

    const uniqueIds = new Set(results.map((r) => r.id));
    expect(uniqueIds.size).toBe(10);
  });
});
```

### Go: testcontainers-go for PostgreSQL, Redis, and Kafka

```go
// integration_test.go
package integration_test

import (
    "context"
    "fmt"
    "testing"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/redis/go-redis/v9"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/modules/redis"
    tcRedis "github.com/testcontainers/testcontainers-go/modules/redis"
    "github.com/testcontainers/testcontainers-go/wait"
    "myapp/repository"
    "myapp/cache"
)

func setupPostgres(t *testing.T, ctx context.Context) *pgxpool.Pool {
    t.Helper()

    pgContainer, err := postgres.Run(ctx,
        "postgres:16-alpine",
        postgres.WithDatabase("testdb"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("database system is ready to accept connections").
                WithOccurrence(2).
                WithStartupTimeout(30*time.Second),
        ),
    )
    require.NoError(t, err)

    t.Cleanup(func() {
        require.NoError(t, pgContainer.Terminate(ctx))
    })

    connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
    require.NoError(t, err)

    pool, err := pgxpool.New(ctx, connStr)
    require.NoError(t, err)
    t.Cleanup(func() { pool.Close() })

    // Run migrations
    _, err = pool.Exec(ctx, `
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `)
    require.NoError(t, err)

    return pool
}

func setupRedis(t *testing.T, ctx context.Context) *redis.Client {
    t.Helper()

    redisContainer, err := tcRedis.Run(ctx, "redis:7-alpine")
    require.NoError(t, err)

    t.Cleanup(func() {
        require.NoError(t, redisContainer.Terminate(ctx))
    })

    endpoint, err := redisContainer.Endpoint(ctx, "")
    require.NoError(t, err)

    client := redis.NewClient(&redis.Options{Addr: endpoint})
    t.Cleanup(func() { client.Close() })

    return client
}

func TestUserRepository_WithTestcontainers(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test in short mode")
    }

    ctx := context.Background()
    pool := setupPostgres(t, ctx)
    repo := repository.NewUserRepo(pool)

    t.Run("create and find user", func(t *testing.T) {
        _, err := pool.Exec(ctx, "TRUNCATE TABLE users CASCADE")
        require.NoError(t, err)

        user, err := repo.Create(ctx, repository.CreateUserParams{
            Email: "tc-go@test.com",
            Name:  "TC Go User",
        })
        require.NoError(t, err)
        assert.NotEmpty(t, user.ID)

        found, err := repo.FindByEmail(ctx, "tc-go@test.com")
        require.NoError(t, err)
        assert.Equal(t, user.ID, found.ID)
    })
}

func TestCachedUserRepository(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test in short mode")
    }

    ctx := context.Background()
    pool := setupPostgres(t, ctx)
    redisClient := setupRedis(t, ctx)

    cachedRepo := cache.NewCachedUserRepo(
        repository.NewUserRepo(pool),
        redisClient,
        5*time.Minute,
    )

    t.Run("caches user after first read", func(t *testing.T) {
        _, err := pool.Exec(ctx, "TRUNCATE TABLE users CASCADE")
        require.NoError(t, err)
        redisClient.FlushAll(ctx)

        user, _ := cachedRepo.Create(ctx, repository.CreateUserParams{
            Email: "cached@test.com", Name: "Cached",
        })

        // First read: cache miss, hits DB
        found1, err := cachedRepo.FindByID(ctx, user.ID)
        require.NoError(t, err)
        assert.Equal(t, "Cached", found1.Name)

        // Verify cache entry exists in Redis
        cached, err := redisClient.Get(ctx, fmt.Sprintf("user:%s", user.ID)).Result()
        require.NoError(t, err)
        assert.Contains(t, cached, "cached@test.com")
    })
}
```

### Python: testcontainers-python for Database and Cache Testing

```python
# tests/integration/test_with_testcontainers.py
import pytest
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.repositories.user_repository import UserRepository


@pytest.fixture(scope="module")
def postgres_container():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest.fixture(scope="module")
def db_engine(postgres_container):
    engine = create_engine(postgres_container.get_connection_url())
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


@pytest.fixture(autouse=True)
def clean_tables(db_engine):
    with db_engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE users CASCADE"))
    yield


@pytest.fixture
def repo(session):
    return UserRepository(session)


@pytest.fixture(scope="module")
def redis_container():
    with RedisContainer("redis:7-alpine") as r:
        yield r


@pytest.fixture
def redis_client(redis_container):
    import redis
    client = redis.Redis(
        host=redis_container.get_container_host_ip(),
        port=redis_container.get_exposed_port(6379),
        decode_responses=True,
    )
    client.flushall()
    yield client
    client.close()


class TestUserRepositoryWithTestcontainers:
    def test_create_and_find(self, repo):
        user = repo.create(email="tc-py@test.com", name="TC Python User")
        assert user.id is not None

        found = repo.find_by_email("tc-py@test.com")
        assert found is not None
        assert found.id == user.id

    def test_unique_constraint(self, repo):
        repo.create(email="dup@test.com", name="First")
        with pytest.raises(Exception):
            repo.create(email="dup@test.com", name="Second")


class TestCachedRepository:
    def test_caches_after_first_read(self, repo, redis_client):
        from app.cache import CachedUserRepository

        cached_repo = CachedUserRepository(repo, redis_client, ttl=300)
        user = cached_repo.create(email="cache@test.com", name="Cached")

        # First read populates cache
        found = cached_repo.find_by_id(user.id)
        assert found.name == "Cached"

        # Verify Redis has the entry
        assert redis_client.exists(f"user:{user.id}") == 1

    def test_cache_invalidation_on_update(self, repo, redis_client):
        from app.cache import CachedUserRepository

        cached_repo = CachedUserRepository(repo, redis_client, ttl=300)
        user = cached_repo.create(email="inv@test.com", name="Original")

        # Populate cache
        cached_repo.find_by_id(user.id)
        assert redis_client.exists(f"user:{user.id}") == 1

        # Update should invalidate cache
        cached_repo.update(user.id, name="Updated")
        assert redis_client.exists(f"user:{user.id}") == 0
```

---

## 10 Best Practices

1. **Scope containers to the test suite, not individual tests** -- Start containers in `beforeAll`/`TestMain` and clean data between tests with truncation or rollback. Container startup is the bottleneck.
2. **Use official Testcontainers modules** -- Prefer `@testcontainers/postgresql`, `testcontainers-go/modules/postgres`, and similar typed modules over generic container requests. They handle wait strategies and configuration correctly.
3. **Set explicit startup timeouts** -- Container pulls and health checks can be slow on first run. Set generous timeouts (30-60 seconds) in `beforeAll` and configure CI image caching.
4. **Pin container image tags** -- Use `postgres:16-alpine`, not `postgres:latest`. Unpinned tags cause non-deterministic test failures when upstream images change.
5. **Run Testcontainer tests separately from unit tests** -- Tag integration tests (`-tags=integration`, `@pytest.mark.integration`) and exclude them from the default fast test suite.
6. **Cache Docker images in CI** -- Use Docker layer caching or a registry mirror to avoid pulling images on every CI run. This can save 30-60 seconds per pipeline.
7. **Use `testing.Short()` / skip markers for local development** -- Allow developers to skip slow container tests during rapid iteration with `go test -short` or `pytest -m "not integration"`.
8. **Start independent containers in parallel** -- When tests need both PostgreSQL and Redis, start both containers concurrently using `Promise.all`, goroutines, or threads.
9. **Verify container health before running tests** -- Use wait strategies (log-based, HTTP health check, or port-based) instead of arbitrary sleep delays.
10. **Clean up containers even on test failure** -- Use `t.Cleanup()`, `afterAll`, or context managers to guarantee container termination. Leaked containers waste resources and block ports.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Starting a new container per test case | Test suite takes minutes instead of seconds | Share containers across the suite, isolate with data cleanup |
| Using `latest` tag for container images | Tests break unpredictably when upstream images update | Pin specific image versions in all container configurations |
| Hardcoding container ports | Port collisions in CI, parallel execution failures | Use dynamic port mapping and read assigned ports from the container |
| Not waiting for container readiness | Connection refused errors on startup | Use wait strategies (log, HTTP, port) provided by the library |
| Skipping container cleanup on failure | Orphaned containers consume memory, CPU, and ports | Use language-idiomatic cleanup (t.Cleanup, afterAll, context managers) |
| Running Testcontainers tests in the unit test suite | Slow feedback loop, developers skip all tests | Separate integration tests with tags or directory structure |
| Pulling images during every CI run | Adds 30-60 seconds per image per pipeline | Cache Docker images or use a registry mirror in CI |
| Using Testcontainers when an in-memory alternative suffices | Unnecessary Docker dependency for simple scenarios | Evaluate whether a simple in-memory stub meets test requirements |

---

## Enforcement Checklist

- [ ] All container images use pinned version tags (no `latest`)
- [ ] Containers are scoped to the test suite, not individual test cases
- [ ] Wait strategies are configured for every container (no `sleep`)
- [ ] Container cleanup runs even on test failure (t.Cleanup, afterAll, context manager)
- [ ] Integration tests are tagged and excluded from the default fast test suite
- [ ] CI pipeline caches Docker images to reduce pull times
- [ ] Independent containers start in parallel where possible
- [ ] Dynamic port mapping is used instead of hardcoded ports
- [ ] Startup timeouts are set to at least 30 seconds for container initialization
- [ ] Test data is cleaned between test cases (truncation or rollback)
- [ ] The same database engine version runs in containers and production
- [ ] Testcontainers are not used where a simple in-memory alternative suffices
