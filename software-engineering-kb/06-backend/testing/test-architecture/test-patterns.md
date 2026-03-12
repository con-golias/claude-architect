# Advanced Testing Patterns

> **Domain:** Backend > Testing
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Beyond basic unit/integration tests, there are testing patterns that catch entire categories of bugs: property-based testing finds edge cases you never thought of, snapshot testing catches regressions in complex outputs, load testing reveals performance degradation before it reaches production, and mutation testing measures whether your tests actually catch bugs. These patterns make the difference between "a test suite that passes" and "a test suite you actually trust".

---

## How It Works

### Property-Based Testing

Instead of writing specific test cases, you define PROPERTIES that must hold for ALL possible inputs. The framework generates hundreds of random inputs and finds counterexamples.

```typescript
// TypeScript — fast-check (Property-Based Testing)
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { sortOrders, parseAmount, encodeDecodeJSON } from "./utils";

describe("Property-based tests", () => {
  // Property: sorting should be idempotent
  it("sorting twice produces same result as sorting once", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            total: fc.integer({ min: 0, max: 1_000_000 }),
            createdAt: fc.date(),
          })
        ),
        (orders) => {
          const sorted1 = sortOrders(orders, "total");
          const sorted2 = sortOrders(sorted1, "total");
          expect(sorted2).toEqual(sorted1);
        }
      )
    );
  });

  // Property: parsed amount × 100 should equal cents
  it("parseAmount round-trips correctly", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999_999_99 }), // Cents
        (cents) => {
          const dollars = cents / 100;
          const parsed = parseAmount(dollars.toFixed(2));
          expect(parsed).toBe(cents);
        }
      )
    );
  });

  // Property: encode → decode is identity
  it("JSON encode/decode is lossless for valid data", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          age: fc.integer({ min: 0, max: 150 }),
          tags: fc.array(fc.string()),
          active: fc.boolean(),
        }),
        (data) => {
          const encoded = JSON.stringify(data);
          const decoded = JSON.parse(encoded);
          expect(decoded).toEqual(data);
        }
      )
    );
  });

  // Property: pagination covers all items without overlap
  it("pagination should cover all items exactly once", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 200 }),
        fc.integer({ min: 1, max: 50 }),
        (items, pageSize) => {
          const pages: number[][] = [];
          const totalPages = Math.ceil(items.length / pageSize);

          for (let i = 0; i < totalPages; i++) {
            const page = paginate(items, i + 1, pageSize);
            pages.push(page);
          }

          // All items covered
          const allItems = pages.flat();
          expect(allItems).toEqual(items);

          // Each page (except last) has exactly pageSize items
          pages.slice(0, -1).forEach((page) => {
            expect(page).toHaveLength(pageSize);
          });
        }
      )
    );
  });
});
```

```go
// Go — rapid (Property-Based Testing)
package utils_test

import (
    "sort"
    "testing"

    "pgregory.net/rapid"

    "myapp/utils"
)

func TestSortIdempotent(t *testing.T) {
    rapid.Check(t, func(t *rapid.T) {
        // Generate random slice of integers
        items := rapid.SliceOf(rapid.Int()).Draw(t, "items")

        sorted1 := utils.SortInts(append([]int{}, items...))
        sorted2 := utils.SortInts(append([]int{}, sorted1...))

        if !equal(sorted1, sorted2) {
            t.Fatalf("sorting not idempotent: %v vs %v", sorted1, sorted2)
        }
    })
}

func TestPaginationCoversAll(t *testing.T) {
    rapid.Check(t, func(t *rapid.T) {
        items := rapid.SliceOf(rapid.String()).Draw(t, "items")
        pageSize := rapid.IntRange(1, 50).Draw(t, "pageSize")

        var all []string
        totalPages := (len(items) + pageSize - 1) / pageSize

        for page := 1; page <= totalPages; page++ {
            result := utils.Paginate(items, page, pageSize)
            all = append(all, result...)
        }

        if len(all) != len(items) {
            t.Fatalf("pagination lost items: got %d, want %d", len(all), len(items))
        }
    })
}
```

```python
# Python — Hypothesis (Property-Based Testing)
from hypothesis import given, strategies as st, settings
from hypothesis.strategies import composite
import pytest
from utils import sort_orders, paginate, parse_amount

class TestPropertyBased:
    @given(
        items=st.lists(st.integers(min_value=0, max_value=1_000_000)),
    )
    def test_sort_is_idempotent(self, items):
        sorted1 = sorted(items)
        sorted2 = sorted(sorted1)
        assert sorted1 == sorted2

    @given(
        items=st.lists(st.text(), min_size=0, max_size=200),
        page_size=st.integers(min_value=1, max_value=50),
    )
    def test_pagination_covers_all_items(self, items, page_size):
        total_pages = (len(items) + page_size - 1) // page_size or 1
        all_items = []
        for page in range(1, total_pages + 1):
            result = paginate(items, page, page_size)
            all_items.extend(result)
        assert all_items == items

    @given(cents=st.integers(min_value=0, max_value=99_999_999))
    def test_amount_parsing_roundtrip(self, cents):
        dollars_str = f"{cents / 100:.2f}"
        parsed = parse_amount(dollars_str)
        assert parsed == cents

    @given(
        data=st.dictionaries(
            keys=st.text(min_size=1, max_size=20),
            values=st.one_of(st.text(), st.integers(), st.booleans()),
            min_size=1,
            max_size=10,
        )
    )
    @settings(max_examples=500)
    def test_json_roundtrip(self, data):
        import json
        encoded = json.dumps(data)
        decoded = json.loads(encoded)
        assert decoded == data
```

---

## Snapshot Testing

```typescript
// TypeScript — Vitest Snapshot Testing
describe("Error response format", () => {
  it("validation error response structure", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [] });

    // Snapshot captures full structure — any change is detected
    expect(response.body).toMatchInlineSnapshot(`
      {
        "error": {
          "code": "VALIDATION_ERROR",
          "message": "Validation failed",
          "details": [
            {
              "field": "items",
              "message": "Array must have at least 1 item",
              "code": "too_small"
            }
          ]
        }
      }
    `);
  });

  // Snapshot for API contract stability
  it("order response shape should not change", async () => {
    const response = await request(app)
      .get("/api/v1/orders/ord_123")
      .set("Authorization", `Bearer ${token}`);

    // Only snapshot the KEYS, not values (values change)
    const shape = extractShape(response.body);
    expect(shape).toMatchSnapshot();
  });
});

// Helper: extract object shape (keys + types)
function extractShape(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.length > 0 ? [extractShape(obj[0])] : [];
  }
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, extractShape(v)])
    );
  }
  return typeof obj;
}
```

---

## Load & Performance Testing

```typescript
// TypeScript — k6 Load Test
// k6 uses JavaScript but runs in Go runtime
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const orderCreationTime = new Trend("order_creation_time");

export const options = {
  // Stages define load ramp-up
  stages: [
    { duration: "30s", target: 10 },   // Ramp up to 10 users
    { duration: "1m", target: 50 },    // Ramp up to 50 users
    { duration: "2m", target: 50 },    // Stay at 50 users
    { duration: "30s", target: 100 },  // Spike to 100 users
    { duration: "1m", target: 100 },   // Stay at 100
    { duration: "30s", target: 0 },    // Ramp down
  ],

  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"], // P95 < 500ms
    errors: ["rate<0.01"],                           // Error rate < 1%
    order_creation_time: ["p(95)<800"],              // Custom metric
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  // GET /orders — list
  const listResponse = http.get(`${BASE_URL}/api/v1/orders?page=1&limit=10`, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  check(listResponse, {
    "list orders status 200": (r) => r.status === 200,
    "list orders has data": (r) => JSON.parse(r.body).data.length > 0,
  });
  errorRate.add(listResponse.status !== 200);

  sleep(1); // Think time

  // POST /orders — create
  const createStart = Date.now();
  const createResponse = http.post(
    `${BASE_URL}/api/v1/orders`,
    JSON.stringify({
      items: [
        { product_id: "prod_1", quantity: 1 },
      ],
    }),
    {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  orderCreationTime.add(Date.now() - createStart);

  check(createResponse, {
    "create order status 201": (r) => r.status === 201,
    "create order has id": (r) => JSON.parse(r.body).id !== undefined,
  });
  errorRate.add(createResponse.status !== 201);

  sleep(2);
}
```

```go
// Go — vegeta (HTTP Load Testing)
package loadtest

import (
    "fmt"
    "net/http"
    "time"

    vegeta "github.com/tsenart/vegeta/v12/lib"
)

func RunLoadTest() {
    rate := vegeta.Rate{Freq: 100, Per: time.Second}  // 100 RPS
    duration := 30 * time.Second

    targeter := vegeta.NewStaticTargeter(vegeta.Target{
        Method: "GET",
        URL:    "http://localhost:3000/api/v1/orders",
        Header: http.Header{
            "Authorization": []string{"Bearer test-token"},
        },
    })

    attacker := vegeta.NewAttacker()
    var metrics vegeta.Metrics

    for res := range attacker.Attack(targeter, rate, duration, "GET orders") {
        metrics.Add(res)
    }
    metrics.Close()

    fmt.Printf("Latency P50: %s\n", metrics.Latencies.P50)
    fmt.Printf("Latency P95: %s\n", metrics.Latencies.P95)
    fmt.Printf("Latency P99: %s\n", metrics.Latencies.P99)
    fmt.Printf("Success Rate: %.2f%%\n", metrics.Success*100)
    fmt.Printf("Throughput: %.2f req/s\n", metrics.Throughput)

    // Assertions
    if metrics.Latencies.P95 > 500*time.Millisecond {
        fmt.Println("FAIL: P95 latency exceeds 500ms")
    }
    if metrics.Success < 0.99 {
        fmt.Println("FAIL: Success rate below 99%")
    }
}
```

---

## Mutation Testing

Mutation testing measures whether your tests actually catch bugs. It introduces small changes (mutations) into the code and checks whether the tests fail. If a mutation passes the tests, then the tests do not catch that bug.

```
Original code:         if (total > 100) applyDiscount();
Mutation 1 (boundary): if (total >= 100) applyDiscount();  ← Caught?
Mutation 2 (negate):   if (total <= 100) applyDiscount();  ← Caught?
Mutation 3 (remove):   /* removed */                       ← Caught?
```

```typescript
// TypeScript — Stryker Mutation Testing
// stryker.config.mts
import { defineConfig } from "@stryker-mutator/core";

export default defineConfig({
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
  },
  coverageAnalysis: "perTest",
  mutate: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.d.ts",
    "!src/**/types/**",
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,  // CI fails below 50% mutation score
  },
});
```

```python
# Python — mutmut
# pyproject.toml
[tool.mutmut]
paths_to_mutate = "app/"
tests_dir = "tests/"
runner = "python -m pytest"

# Run: mutmut run
# Results: mutmut results
# Show surviving mutants: mutmut show <id>
```

### Mutation Score

```
Mutation Score = Killed Mutants / Total Mutants × 100

Killed:    Test failed (good! — test detected the bug)
Survived:  Test passed (bad! — test missed the bug)
Timeout:   Test hung (usually killed, counts as detected)
No Coverage: Mutant in untested code
```

| Score | Quality |
|-------|---------|
| > 80% | Excellent — tests catch most bugs |
| 60-80% | Good — room for improvement |
| 40-60% | Weak — many bugs would go undetected |
| < 40% | Poor — tests provide false confidence |

---

## Test Fixtures & Seed Data

```typescript
// TypeScript — Seed Data Management
class TestSeeder {
  constructor(private db: Database) {}

  async seedStandard(): Promise<TestData> {
    // Users
    const admin = await this.db.users.insert({
      email: "admin@test.com",
      role: "admin",
      name: "Test Admin",
    });
    const customer = await this.db.users.insert({
      email: "customer@test.com",
      role: "customer",
      name: "Test Customer",
    });

    // Products
    const products = await this.db.products.insertMany([
      { id: "prod_1", name: "Widget", price: 1000, stock: 100 },
      { id: "prod_2", name: "Gadget", price: 2500, stock: 50 },
      { id: "prod_3", name: "Gizmo", price: 500, stock: 0 }, // Out of stock
    ]);

    // Orders
    const pendingOrder = await this.db.orders.insert({
      id: "ord_pending",
      userId: customer.id,
      status: "pending",
      items: [{ productId: "prod_1", quantity: 2, price: 1000 }],
      total: 2000,
    });

    const completedOrder = await this.db.orders.insert({
      id: "ord_completed",
      userId: customer.id,
      status: "completed",
      items: [{ productId: "prod_2", quantity: 1, price: 2500 }],
      total: 2500,
      paymentId: "ch_test_123",
    });

    return { admin, customer, products, pendingOrder, completedOrder };
  }

  async clean(): Promise<void> {
    await this.db.query("TRUNCATE orders, products, users CASCADE");
  }
}
```

---

## E2E Testing Patterns

```typescript
// TypeScript — E2E Test: Full Order Flow
describe("E2E: Order Checkout Flow", () => {
  it("should complete full order lifecycle", async () => {
    // 1. Register user
    const registerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "e2e@test.com",
        password: "SecureP@ss123",
        name: "E2E User",
      });
    expect(registerRes.status).toBe(201);
    const { token } = registerRes.body;

    // 2. Browse products
    const productsRes = await request(app)
      .get("/api/v1/products")
      .set("Authorization", `Bearer ${token}`);
    expect(productsRes.body.data.length).toBeGreaterThan(0);
    const productId = productsRes.body.data[0].id;

    // 3. Create order
    const orderRes = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId, quantity: 1 }],
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.id;

    // 4. Pay for order
    const payRes = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentMethod: "card_test" });
    expect(payRes.status).toBe(200);
    expect(payRes.body.status).toBe("completed");

    // 5. Verify order status
    const getRes = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.body.status).toBe("completed");
    expect(getRes.body.paymentId).toBeDefined();

    // 6. Verify stock updated
    const productRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set("Authorization", `Bearer ${token}`);
    const originalStock = productsRes.body.data[0].stock;
    expect(productRes.body.stock).toBe(originalStock - 1);
  }, 30_000); // 30s timeout for E2E
});
```

---

## Best Practices

1. **ALWAYS use property-based testing for pure functions** — catches edge cases you miss
2. **ALWAYS run mutation testing periodically** — measures real test quality
3. **ALWAYS load test before major releases** — prevents production surprises
4. **ALWAYS use snapshot testing for complex outputs** — regression detection
5. **ALWAYS define performance thresholds** — P95 < 500ms, error rate < 1%
6. **ALWAYS seed deterministic test data** — reproducible tests
7. **NEVER rely only on example-based tests** — property tests find hidden bugs
8. **NEVER ignore mutation test survivors** — they reveal missing assertions
9. **NEVER skip E2E for critical flows** — checkout, payment, registration
10. **NEVER run load tests against production** — use staging/dedicated environment

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Only example-based tests | Edge cases missed | Add property-based tests |
| No performance testing | Prod latency surprises | k6/vegeta before releases |
| Snapshot test sprawl | Tests pass anything | Review snapshots, use inline |
| 100% line coverage pride | Mutations survive | Measure mutation score |
| E2E tests for everything | Slow, flaky CI | E2E only for critical journeys |
| No seed data management | Tests create ad-hoc data | Centralized seeder/factories |
| Random data without seed | Non-reproducible failures | Fixed faker seed in CI |
| Performance tests on CI | Resource contention | Dedicated perf environment |

---

## Real-world Examples

### Netflix — Chaos Testing
- Property-based testing for encoding/decoding
- Load testing with simulated traffic patterns
- Chaos Monkey: random instance termination during tests
- Performance regression detection in CI

### Stripe — Mutation Testing
- Stryker for TypeScript codebase
- 85%+ mutation score target
- Surviving mutants reviewed weekly
- Property-based tests for payment calculations

### Spotify — Property-Based Testing
- Hypothesis (Python) for data pipeline testing
- Discovered 30+ edge case bugs in first quarter
- Property tests for playlist shuffling algorithm
- Integrated into CI with limited example count (fast)
