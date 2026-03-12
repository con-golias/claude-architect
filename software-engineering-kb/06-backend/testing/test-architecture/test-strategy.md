# Test Strategy & Organization

> **Domain:** Backend > Testing
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Without a clear test strategy, testing effort becomes chaotic: some features have 500 tests, others have none. Slow tests block CI, flaky tests undermine confidence, and nobody knows what is actually being tested. A good test strategy defines what is tested at each level, how tests are organized, how they run in CI, and when they are sufficient. Google, Netflix, and Spotify have formal testing strategies -- not by accident.

---

## How It Works

### Testing Pyramid in Practice

```
                    ┌──────────┐
                    │   E2E    │  5-10% of tests
                    │  ~5 min  │  Critical user journeys only
                    ├──────────┤
                    │          │
                ┌───┤Integratio├───┐  15-25% of tests
                │   │n ~2 min  │   │  DB, API, queue boundaries
                │   ├──────────┤   │
                │   │          │   │
            ┌───┤   │  Unit    │   ├───┐  70-80% of tests
            │   │   │  ~30sec  │   │   │  Business logic, pure functions
            └───┴───┴──────────┴───┴───┘
```

### Test Distribution Strategy

| Test Type | % of Tests | Speed Target | What It Tests | Who Writes |
|-----------|-----------|-------------|---------------|------------|
| **Unit** | 70-80% | < 30s total | Business logic, calculations, transformations | Developer during coding |
| **Integration** | 15-20% | < 2min total | DB queries, cache, external API clients | Developer after feature |
| **API/Endpoint** | 5-10% | < 1min total | Full request/response, middleware, auth | Developer + QA |
| **E2E** | 2-5% | < 5min total | Critical user journeys | QA + Developer |
| **Contract** | Per service | < 30s per | API compatibility between services | Developer |
| **Performance** | Nightly | 10-30min | Latency, throughput under load | Platform team |

---

## Project Structure

### TypeScript/Node.js

```
src/
├── modules/
│   ├── orders/
│   │   ├── order.service.ts
│   │   ├── order.service.test.ts        ← Unit test (colocated)
│   │   ├── order.repository.ts
│   │   ├── order.repository.test.ts     ← Integration test
│   │   ├── order.controller.ts
│   │   └── order.controller.test.ts     ← Endpoint test
│   └── payments/
│       ├── payment.service.ts
│       └── payment.service.test.ts
├── __tests__/                           ← Cross-module tests
│   ├── contracts/
│   │   └── order-payment.contract.test.ts
│   └── e2e/
│       └── checkout-flow.e2e.test.ts
├── test/
│   ├── setup.ts                         ← Global test setup
│   ├── factories/                       ← Test data factories
│   │   ├── order.factory.ts
│   │   └── user.factory.ts
│   ├── fixtures/                        ← Static test data
│   │   └── stripe-webhook.json
│   └── helpers/                         ← Test utilities
│       ├── auth.ts
│       ├── database.ts
│       └── containers.ts
└── vitest.config.ts
```

```typescript
// vitest.config.ts — Multi-project configuration
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests — fast, no I/O
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts", "src/**/*.e2e.test.ts"],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      exclude: [
        "node_modules/",
        "test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/types/*",
      ],
    },
  },
});
```

```json
// package.json — Test scripts
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run --exclude '**/*.integration.*' --exclude '**/*.e2e.*'",
    "test:integration": "vitest run --include '**/*.integration.test.ts'",
    "test:e2e": "vitest run --include '**/*.e2e.test.ts'",
    "test:contract": "vitest run --include '**/*.contract.test.ts'",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --reporter=junit --outputFile=test-results.xml"
  }
}
```

### Go

```
myapp/
├── internal/
│   ├── order/
│   │   ├── service.go
│   │   ├── service_test.go              ← Unit tests (same package)
│   │   ├── repository.go
│   │   ├── repository_integration_test.go ← Build tag: integration
│   │   ├── handler.go
│   │   └── handler_test.go              ← httptest endpoint tests
│   └── payment/
│       ├── service.go
│       └── service_test.go
├── test/
│   ├── testutil/                        ← Shared test helpers
│   │   ├── containers.go               ← Testcontainers setup
│   │   ├── factories.go                ← Test data factories
│   │   └── auth.go                     ← Auth token generation
│   ├── contract/
│   │   └── order_payment_test.go
│   └── e2e/
│       └── checkout_test.go
├── Makefile
└── go.test.env
```

```makefile
# Makefile — Test targets
.PHONY: test test-unit test-integration test-e2e test-coverage

test: test-unit

test-unit:
	go test ./internal/... -short -count=1 -race

test-integration:
	go test ./internal/... -run Integration -count=1 -race -timeout 5m

test-e2e:
	go test ./test/e2e/... -count=1 -timeout 10m

test-all: test-unit test-integration test-e2e

test-coverage:
	go test ./internal/... -coverprofile=coverage.out -covermode=atomic
	go tool cover -html=coverage.out -o coverage.html

test-ci:
	go test ./... -count=1 -race -coverprofile=coverage.out \
		-covermode=atomic -json | tee test-results.json
```

```go
// Build tags for integration tests
//go:build integration

package repository_test

import (
    "testing"
)

func TestUserRepository_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test in short mode")
    }
    // ... test with real database
}
```

### Python

```
myapp/
├── app/
│   ├── modules/
│   │   ├── orders/
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   └── router.py
│   │   └── payments/
│   └── main.py
├── tests/
│   ├── conftest.py                      ← Shared fixtures
│   ├── unit/
│   │   ├── test_order_service.py
│   │   └── test_payment_service.py
│   ├── integration/
│   │   ├── conftest.py                  ← DB fixtures
│   │   ├── test_order_repository.py
│   │   └── test_payment_gateway.py
│   ├── api/
│   │   ├── test_order_endpoints.py
│   │   └── test_payment_endpoints.py
│   ├── contract/
│   │   └── test_order_contract.py
│   ├── e2e/
│   │   └── test_checkout_flow.py
│   └── factories/
│       ├── order_factory.py
│       └── user_factory.py
├── pyproject.toml
└── pytest.ini
```

```ini
# pytest.ini
[pytest]
testpaths = tests
markers =
    unit: Unit tests (fast, no I/O)
    integration: Integration tests (database, cache)
    api: API endpoint tests
    contract: Contract tests
    e2e: End-to-end tests
    slow: Tests that take > 5 seconds

addopts =
    --strict-markers
    -v
    --tb=short
```

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.coverage.run]
source = ["app"]
omit = ["tests/*", "*/migrations/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

---

## CI/CD Pipeline Configuration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test:unit -- --reporter=junit --outputFile=unit-results.xml
      - uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Unit Tests
          path: unit-results.xml
          reporter: java-junit

  integration-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: testpass
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:testpass@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

  coverage:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: true
          minimum_coverage: 80
```

---

## Code Coverage Strategy

### Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| Business logic (services) | 90%+ | Core value, most bugs live here |
| Data access (repositories) | 80%+ | SQL bugs are common |
| API handlers (controllers) | 80%+ | Validation + error handling |
| Utility functions | 95%+ | Small, easy to test completely |
| Configuration / startup | 0% | Low value, hard to test |
| Generated code | 0% | Not your code |
| DTOs / types | 0% | No logic to test |

### What Coverage Doesn't Tell You

```
✅ High coverage = all code paths executed
❌ High coverage ≠ all edge cases tested
❌ High coverage ≠ correct behavior verified
❌ High coverage ≠ meaningful assertions
```

```typescript
// 100% coverage, 0% value
it("covers everything", () => {
  const result = calculateTotal(items, discount);
  expect(result).toBeDefined(); // ← Useless assertion!
});

// Lower coverage, much higher value
it("calculates correct total with percentage discount", () => {
  const result = calculateTotal(
    [{ price: 1000, quantity: 2 }],
    { type: "percentage", value: 10 }
  );
  expect(result.total).toBe(1800); // ← Actually verifies correctness
  expect(result.discount).toBe(200);
});
```

---

## Flaky Test Management

### Common Causes & Fixes

| Cause | Symptom | Fix |
|-------|----------|-----|
| Time dependency | Fails around midnight/DST | Mock clock, use relative times |
| Race conditions | Passes solo, fails in parallel | Proper async/await, test isolation |
| Network dependency | Fails on slow CI | Mock external calls, retry logic |
| Shared state | Order-dependent failures | beforeEach cleanup, isolated data |
| Non-deterministic data | Random UUIDs in assertions | Use factories with fixed seeds |
| Port conflicts | "Address in use" | Random ports, container isolation |

### Quarantine Strategy

```typescript
// Mark flaky tests — tracked, not blocking CI
describe.skip.todo("FLAKY: race condition in WebSocket test", () => {
  // Ticket: JIRA-1234
  // Quarantined: 2024-03-01
  // Root cause: shared Redis state between parallel tests
});

// Better: Use test tags
it.skipIf(process.env.CI === "true")("should handle concurrent WebSocket connections", () => {
  // Known flaky in CI, investigating JIRA-1234
});
```

---

## Test Data Factories

```typescript
// TypeScript — Factory Pattern
import { faker } from "@faker-js/faker";

// Set seed for deterministic data in CI
faker.seed(12345);

class OrderFactory {
  private static sequence = 0;

  static build(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
    OrderFactory.sequence++;
    return {
      items: [
        {
          productId: `prod_${OrderFactory.sequence}`,
          quantity: faker.number.int({ min: 1, max: 10 }),
          price: faker.number.int({ min: 100, max: 10000 }),
        },
      ],
      shippingAddress: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        country: faker.location.countryCode(),
        postalCode: faker.location.zipCode(),
      },
      ...overrides,
    };
  }

  static buildResult(overrides: Partial<Order> = {}): Order {
    OrderFactory.sequence++;
    return {
      id: `ord_${faker.string.alphanumeric(12)}`,
      status: "pending",
      total: 5000,
      currency: "EUR",
      items: [
        {
          productId: `prod_${OrderFactory.sequence}`,
          quantity: 2,
          price: 2500,
        },
      ],
      createdAt: new Date("2024-01-15T10:00:00Z"),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
      ...overrides,
    };
  }

  // Traits — common variations
  static buildCompleted(overrides: Partial<Order> = {}): Order {
    return OrderFactory.buildResult({
      status: "completed",
      paymentId: `ch_${faker.string.alphanumeric(12)}`,
      completedAt: new Date("2024-01-15T11:00:00Z"),
      ...overrides,
    });
  }

  static buildCancelled(overrides: Partial<Order> = {}): Order {
    return OrderFactory.buildResult({
      status: "cancelled",
      cancelledAt: new Date("2024-01-15T12:00:00Z"),
      cancelReason: "Customer request",
      ...overrides,
    });
  }
}
```

---

## Test Performance Optimization

| Technique | Speedup | When |
|-----------|---------|------|
| **Run unit tests only on PR** | 3-5x faster CI | Feature branches |
| **Parallelization** | 2-4x | Independent test suites |
| **Testcontainers reuse** | 2-3x | Same container across suites |
| **Transaction rollback** | 5-10x vs TRUNCATE | DB cleanup between tests |
| **Shared fixture setup** | 2x | `beforeAll` vs `beforeEach` for read-only data |
| **Test sharding** | Linear scaling | Split across CI runners |
| **Affected test detection** | 10-50x | Only run tests for changed files |

```yaml
# GitHub Actions — Parallel test sharding
jobs:
  test:
    strategy:
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]
    steps:
      - run: npx vitest run --shard=${{ matrix.shard }}
```

---

## Best Practices

1. **ALWAYS define test distribution** — 70-80% unit, 15-20% integration, 5-10% E2E
2. **ALWAYS run tests in CI** — every PR, every merge to main
3. **ALWAYS set coverage thresholds** — 80% minimum, enforce in CI
4. **ALWAYS colocate unit tests** — `service.test.ts` next to `service.ts`
5. **ALWAYS separate test types** — different directories or naming conventions
6. **ALWAYS use factories** — not raw object literals for test data
7. **ALWAYS quarantine flaky tests** — tag, track, fix, don't ignore
8. **NEVER skip tests permanently** — fix or delete within 2 weeks
9. **NEVER test implementation details** — test outcomes, not how they happen
10. **NEVER let CI exceed 10 minutes** — parallelize, shard, or split

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Ice cream cone (inverted pyramid) | More E2E than unit tests | Shift testing left to unit/integration |
| No test organization | Tests scattered randomly | Structured directories + naming |
| No CI integration | Manual test runs, forgotten | Automate in pipeline |
| Slow test suite (>10min) | Developers skip tests | Parallelize, shard, optimize |
| 100% coverage obsession | Useless assertions, slow | Focus on meaningful coverage |
| No flaky test tracking | Random CI failures erode trust | Quarantine + ticket + deadline |
| Shared test state | Tests depend on execution order | Isolated setup per test |
| No test for new features | Technical debt grows | Mandatory tests in PR |

---

## Real-world Examples

### Google
- Testing Pyramid strictly enforced
- "Test Certified" program (levels 1-5)
- Tests required for code review approval
- Automated test selection (only affected tests)

### Netflix
- Focused on integration + chaos tests
- Unit tests for business logic
- Canary deployments as final testing
- <5 minute CI target for test suites

### Shopify
- ~500,000 tests across monolith
- Parallel CI with 2000+ workers
- Flaky test dashboard with auto-quarantine
- Tests must pass before merge
