# Testing Pyramid and Models

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | Testing > Philosophy                                         |
| Importance    | Critical                                                     |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [TDD](tdd.md), [What to Test](what-to-test.md), [Shift-Left/Right](shift-left-right.md) |

---

## Core Concepts

### The Classic Testing Pyramid

The testing pyramid, introduced by Mike Cohn, prescribes a distribution of test types
that optimizes for speed, cost, and confidence.

```
        /  E2E  \          ~10%   Slow, expensive, high confidence
       /----------\
      / Integration \       ~20%   Moderate speed and cost
     /----------------\
    /    Unit Tests     \   ~70%   Fast, cheap, isolated
   /____________________\
```

**Rationale:** Unit tests run in milliseconds, catch logic errors early, and cost
almost nothing to maintain. Integration tests validate component collaboration.
E2E tests confirm real user flows but are brittle and slow.

### The Testing Trophy (Kent C. Dodds)

Optimized for frontend and full-stack JavaScript/TypeScript applications.
Emphasizes integration tests as the highest-value layer.

```
         /  E2E  \            Small
        /----------\
       /             \
      /  Integration  \      LARGEST — primary investment
     /                  \
    /--------------------\
   /    Unit    /  Static  \  Static analysis (types, lint)
  /____________/____________\
```

**When to apply:** Frontend-heavy applications, React/Vue/Angular SPAs, or
full-stack apps where component integration is the primary failure mode.

### The Testing Honeycomb (Spotify)

Designed for microservices architectures. Minimizes unit tests, maximizes
integration testing at service boundaries.

```
       ___________
      /           \
     |  Integrated |       Few — expensive cross-service tests
     |   Tests     |
      \___________/
      /           \
     /             \
    | Integration   |     LARGEST — test service boundaries
    |   Tests       |
     \             /
      \___________/
        |  Unit  |        Few — only for complex algorithms
        |________|
```

**When to apply:** Microservices where inter-service contracts matter more
than internal logic. Pair with contract testing.

### The Testing Diamond

A balanced model for monolithic applications with complex domain logic.

```
         /  E2E  \          ~5%
        /----------\
       / Integration \      ~40%   LARGEST
      /----------------\
     /   Unit Tests     \   ~40%   Equal to integration
    /____________________\
   /  Static Analysis     \  ~15%
  /________________________\
```

**When to apply:** Monoliths with rich domain models, where both isolated
logic and component integration carry significant risk.

---

## Architecture-to-Model Decision Matrix

| Architecture          | Recommended Model   | Rationale                                    |
|-----------------------|--------------------|--------------------------------------------- |
| Monolith              | Classic Pyramid    | Stable boundaries, deep logic trees          |
| Microservices         | Honeycomb          | Contracts and boundaries are primary risk     |
| Frontend SPA          | Trophy             | Integration of components is highest value    |
| Monolith + Rich Domain| Diamond            | Both logic and integration carry risk         |
| Serverless / FaaS     | Honeycomb variant  | Focus on integration with cloud services      |

---

## Cost / Speed / Confidence Trade-Offs

| Layer       | Execution Speed | Maintenance Cost | Confidence | Failure Diagnosis |
|-------------|----------------|-----------------|------------|-------------------|
| Unit        | ~1-10 ms       | Low             | Low-Medium | Precise           |
| Integration | ~100-500 ms    | Medium          | Medium-High| Moderate          |
| E2E         | ~5-30 s        | High            | High       | Vague             |
| Static      | ~0 ms (build)  | Very Low        | Low        | Precise           |

---

## Code Examples

### TypeScript: Test Distribution with Jest Configuration

```typescript
// jest.config.ts — Organize tests by pyramid layer
import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.unit.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
      // Unit tests: no external dependencies, fast
      testTimeout: 5_000,
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/**/*.integration.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
      // Integration: may need DB or external services
      testTimeout: 30_000,
      globalSetup: '<rootDir>/test/setup-integration.ts',
      globalTeardown: '<rootDir>/test/teardown-integration.ts',
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/e2e/**/*.e2e.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
      testTimeout: 60_000,
      globalSetup: '<rootDir>/e2e/setup.ts',
      globalTeardown: '<rootDir>/e2e/teardown.ts',
    },
  ],
};

export default config;

// package.json scripts for selective execution
// "test:unit":        "jest --selectProjects unit",
// "test:integration": "jest --selectProjects integration",
// "test:e2e":         "jest --selectProjects e2e",
// "test:ci":          "jest --selectProjects unit integration"
```

```typescript
// src/services/pricing.unit.test.ts — Fast, isolated unit test
import { calculateDiscount } from './pricing';

describe('calculateDiscount', () => {
  it('applies 10% discount for orders over $100', () => {
    const result = calculateDiscount({ subtotal: 150, customerTier: 'standard' });
    expect(result).toBe(15);
  });

  it('applies 20% discount for premium customers over $100', () => {
    const result = calculateDiscount({ subtotal: 150, customerTier: 'premium' });
    expect(result).toBe(30);
  });

  it('returns zero discount for orders under $100', () => {
    const result = calculateDiscount({ subtotal: 50, customerTier: 'premium' });
    expect(result).toBe(0);
  });
});
```

```typescript
// src/services/order.integration.test.ts — Tests real DB interaction
import { OrderService } from './order-service';
import { createTestDatabase, destroyTestDatabase } from '../../test/db-helpers';

describe('OrderService', () => {
  let service: OrderService;
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
    service = new OrderService(db);
  });

  afterAll(async () => {
    await destroyTestDatabase(db);
  });

  it('persists an order and retrieves it with computed totals', async () => {
    const order = await service.createOrder({
      customerId: 'cust-1',
      items: [{ sku: 'WIDGET-A', quantity: 2, unitPrice: 25.00 }],
    });

    const retrieved = await service.getOrder(order.id);
    expect(retrieved.total).toBe(50.00);
    expect(retrieved.status).toBe('pending');
  });
});
```

### Go: Test Organization with Build Tags

```go
// pricing_test.go — Unit tests (no build tag, always run)
package pricing_test

import (
    "testing"
    "myapp/pricing"
)

func TestCalculateDiscount_StandardCustomer(t *testing.T) {
    discount := pricing.CalculateDiscount(150.0, "standard")
    if discount != 15.0 {
        t.Errorf("expected 15.0, got %f", discount)
    }
}

func TestCalculateDiscount_BelowThreshold(t *testing.T) {
    discount := pricing.CalculateDiscount(50.0, "premium")
    if discount != 0.0 {
        t.Errorf("expected 0.0, got %f", discount)
    }
}
```

```go
//go:build integration

// order_integration_test.go — Requires database, run with: go test -tags=integration
package order_test

import (
    "context"
    "testing"
    "myapp/order"
    "myapp/testutil"
)

func TestOrderService_CreateAndRetrieve(t *testing.T) {
    db := testutil.SetupTestDB(t)
    defer testutil.TeardownTestDB(t, db)

    svc := order.NewService(db)
    ctx := context.Background()

    created, err := svc.Create(ctx, order.CreateRequest{
        CustomerID: "cust-1",
        Items: []order.Item{{SKU: "WIDGET-A", Qty: 2, UnitPrice: 25.0}},
    })
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }

    retrieved, err := svc.Get(ctx, created.ID)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if retrieved.Total != 50.0 {
        t.Errorf("expected total 50.0, got %f", retrieved.Total)
    }
}
```

```go
//go:build e2e

// checkout_e2e_test.go — Full stack test, run with: go test -tags=e2e
package e2e_test

import (
    "net/http"
    "testing"
    "myapp/testutil"
)

func TestCheckoutFlow(t *testing.T) {
    baseURL := testutil.StartFullStack(t)
    client := &http.Client{}

    // Add item to cart
    resp, err := client.Post(baseURL+"/api/cart/items", "application/json",
        strings.NewReader(`{"sku":"WIDGET-A","qty":1}`))
    if err != nil {
        t.Fatalf("add to cart failed: %v", err)
    }
    if resp.StatusCode != http.StatusCreated {
        t.Fatalf("expected 201, got %d", resp.StatusCode)
    }
}
```

### Makefile for Layer Execution

```makefile
# Makefile — Run test layers independently
.PHONY: test-unit test-integration test-e2e test-all

test-unit:
	go test ./... -count=1 -short -timeout 30s

test-integration:
	go test ./... -tags=integration -count=1 -timeout 2m

test-e2e:
	go test ./... -tags=e2e -count=1 -timeout 10m

test-all: test-unit test-integration test-e2e
```

---

## 10 Best Practices

1. **Define your test distribution explicitly.** Document the target ratio for your
   project and review it quarterly.
2. **Separate test layers by convention.** Use file suffixes (`.unit.test.ts`),
   build tags, or directory structure — never mix layers in one file.
3. **Run unit tests on every save.** Integrate watch mode into the dev workflow.
4. **Run integration tests pre-push.** Gate merges on integration test passage.
5. **Keep E2E tests focused on critical paths.** Cover the top 5-10 user journeys,
   not every permutation.
6. **Measure and monitor test execution time per layer.** Set budgets: unit < 2 min,
   integration < 10 min, E2E < 30 min.
7. **Re-evaluate the model when architecture changes.** A monolith-to-microservices
   migration demands a shift from pyramid to honeycomb.
8. **Invest in test infrastructure.** Fast, reliable test databases, containers, and
   fixtures pay for themselves within weeks.
9. **Delete flaky tests immediately.** A flaky test is worse than no test — it erodes
   trust and wastes CI time.
10. **Use static analysis as a zero-cost foundation.** TypeScript strict mode, Go vet,
    Python mypy — these catch entire bug categories before any test runs.

---

## Anti-Patterns

| Anti-Pattern                        | Impact                                                  | Fix                                                        |
|-------------------------------------|---------------------------------------------------------|------------------------------------------------------------|
| Ice cream cone (mostly E2E)         | Slow CI, flaky builds, long feedback loops              | Invert: push logic tests to unit layer                     |
| Hourglass (units + E2E, no integration) | Gaps in component interaction coverage                  | Add integration tests for service boundaries               |
| 100% unit coverage obsession        | False confidence; integration bugs slip through         | Set differentiated coverage targets per layer              |
| No static analysis layer            | Type errors and lint issues caught late                  | Add TypeScript strict, ESLint, go vet to pre-commit        |
| Monolithic test suite (no layers)   | Cannot run fast tests independently; slow feedback      | Split into projects/tags per layer                         |
| Copy-paste test distribution        | Wrong model for the architecture                        | Evaluate architecture first, choose model deliberately     |
| E2E for business logic              | Slow, expensive validation of pure functions             | Push pure logic to unit tests                              |
| Ignoring test execution metrics     | Creeping slowness goes unnoticed                        | Dashboard test times; alert on regressions > 10%           |

---

## Enforcement Checklist

- [ ] Test distribution targets are documented in the project README or ADR
- [ ] CI pipeline runs layers independently (unit -> integration -> E2E)
- [ ] Unit tests complete in under 2 minutes
- [ ] Integration tests complete in under 10 minutes
- [ ] E2E suite covers only critical user journeys (< 20 scenarios)
- [ ] Build tags or file naming conventions enforce layer separation
- [ ] Flaky test detection is automated (quarantine after 2 flakes in 7 days)
- [ ] Static analysis runs as the first CI step (fail-fast)
- [ ] Test time budgets are enforced with CI timeout settings
- [ ] Architecture-to-model alignment is reviewed on major architectural changes
- [ ] New developers receive onboarding on the project's test model and rationale
- [ ] Test metrics dashboard is accessible to the entire team
