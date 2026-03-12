# What to Test (Test Strategy)

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | Testing > Philosophy                                         |
| Importance    | Critical                                                     |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [Testing Pyramid](testing-pyramid.md), [TDD](tdd.md), [Shift-Left/Right](shift-left-right.md) |

---

## Core Concepts

### Risk-Based Testing: Test What Matters Most

Not all code carries the same risk. Allocate testing effort proportionally to
the business impact and likelihood of failure.

```
  Risk = Probability of Failure  x  Business Impact of Failure

  High Risk   → Comprehensive testing (unit + integration + E2E)
  Medium Risk → Targeted testing (unit + integration)
  Low Risk    → Minimal testing (unit or none)
```

### Business-Critical Path Identification

Map your system's critical paths and prioritize testing accordingly:

1. **Revenue paths** — Checkout, payment processing, subscription management
2. **Data integrity paths** — Write operations, migrations, calculations
3. **Security paths** — Authentication, authorization, input validation
4. **Compliance paths** — Audit trails, data retention, privacy controls
5. **User-facing paths** — Registration, core workflows, error recovery

### Coverage Strategy: Not All Code Is Equal

Abandon the idea of uniform coverage. Apply differentiated targets:

| Code Category           | Target Coverage | Rationale                             |
|------------------------|----------------|---------------------------------------|
| Domain logic / business rules | 90-100%        | Highest risk, highest value           |
| API handlers / controllers    | 70-80%         | Integration tests cover most paths    |
| Data access layer             | 60-70%         | Integration tests with real DB        |
| Configuration / wiring        | 30-50%         | Smoke tests suffice                   |
| Generated code / DTOs         | 0-20%          | Low logic, low risk                   |
| Third-party wrappers          | 40-60%         | Test the wrapper, not the library     |

### Decision Matrix: Which Test Type for Which Scenario

| Scenario                          | Unit | Integration | E2E  | Contract | Visual |
|----------------------------------|------|-------------|------|----------|--------|
| Pure calculation / algorithm      | YES  | no          | no   | no       | no     |
| Database query correctness        | no   | YES         | no   | no       | no     |
| API request/response shape        | no   | YES         | no   | YES      | no     |
| Multi-service workflow            | no   | no          | YES  | YES      | no     |
| UI component rendering            | YES  | YES         | no   | no       | YES    |
| Authentication flow               | no   | YES         | YES  | no       | no     |
| Error handling / resilience       | YES  | YES         | no   | no       | no     |
| CSS layout correctness            | no   | no          | no   | no       | YES    |
| Event-driven async processing     | no   | YES         | YES  | YES      | no     |
| Performance under load            | no   | no          | no   | no       | no*    |

*Performance requires dedicated load testing tools, not covered by these categories.

### The Four Paths to Cover

For every feature, identify and test these four categories:

```
1. HAPPY PATH        — The expected, successful flow
2. EDGE CASES        — Boundary values, empty inputs, max limits
3. ERROR PATHS       — Invalid input, service failures, timeouts
4. BOUNDARY VALUES   — Off-by-one, type limits, null/undefined
```

### Cost of Not Testing vs. Over-Testing

```
Cost of Under-Testing:             Cost of Over-Testing:
- Production incidents              - Slow CI pipelines
- Customer trust erosion            - Maintenance burden
- Revenue loss                      - Developer friction
- Emergency hotfixes                - False sense of security
- Compliance violations             - Delayed feature delivery

             Sweet Spot:
  Test the right things at the right layer
  with the right level of detail.
```

### Testing Boundaries: Where Tests Provide the Most Value

Focus test effort at the boundaries between components:

```
  +----------+     +----------+     +----------+
  |  Client  | --> |   API    | --> | Database |
  +----------+     +----------+     +----------+
        ^               ^               ^
   Integration     Unit + Integ     Integration
   (contract)     (handlers,       (queries,
                   validation)      migrations)
```

The highest-value tests live at the interfaces: API contracts, database queries,
message formats, and external service integrations.

### Regression Test Selection: What to Add After a Bug

Every production bug earns a new test. Follow this protocol:

1. Write a test that reproduces the exact bug (must fail on the buggy code)
2. Place the test at the lowest possible layer that catches it
3. Fix the bug and verify the test passes
4. Ask: "What class of bugs does this represent?" Add tests for siblings
5. Tag the test with the bug ticket ID for traceability

---

## Code Examples

### TypeScript: Test Strategy for an E-Commerce Application

```typescript
// Domain logic: 90%+ coverage — pure functions, easy to test
// src/domain/pricing.test.ts
import { calculateOrderTotal, applyPromoCode } from './pricing';

describe('calculateOrderTotal', () => {
  // Happy path
  it('sums line items with quantities', () => {
    const items = [
      { sku: 'A', unitPrice: 10, quantity: 3 },
      { sku: 'B', unitPrice: 25, quantity: 1 },
    ];
    expect(calculateOrderTotal(items)).toBe(55);
  });

  // Edge case: empty cart
  it('returns 0 for empty cart', () => {
    expect(calculateOrderTotal([])).toBe(0);
  });

  // Boundary value: single item, quantity 1
  it('handles single item with quantity 1', () => {
    expect(calculateOrderTotal([{ sku: 'A', unitPrice: 10, quantity: 1 }])).toBe(10);
  });

  // Error path: negative quantity
  it('throws on negative quantity', () => {
    expect(() =>
      calculateOrderTotal([{ sku: 'A', unitPrice: 10, quantity: -1 }]),
    ).toThrow('Quantity must be positive');
  });
});

describe('applyPromoCode', () => {
  it('applies percentage discount', () => {
    expect(applyPromoCode(100, { type: 'percent', value: 15 })).toBe(85);
  });

  it('applies fixed discount without going below zero', () => {
    expect(applyPromoCode(10, { type: 'fixed', value: 25 })).toBe(0);
  });

  it('rejects expired promo codes', () => {
    const expired = { type: 'percent' as const, value: 10, expiresAt: new Date('2020-01-01') };
    expect(() => applyPromoCode(100, expired)).toThrow('Promo code expired');
  });
});
```

```typescript
// API handler: 70-80% coverage — integration test with real middleware
// src/api/orders.integration.test.ts
import request from 'supertest';
import { createApp } from '../app';
import { seedTestDatabase, cleanTestDatabase } from '../../test/db-helpers';

describe('POST /api/orders', () => {
  let app: Express.Application;

  beforeAll(async () => {
    app = await createApp({ database: 'test' });
    await seedTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
  });

  it('creates an order and returns 201', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({
        customerId: 'cust-1',
        items: [{ sku: 'WIDGET-A', quantity: 2 }],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      status: 'pending',
      total: expect.any(Number),
    });
  });

  it('returns 400 for missing customer ID', async () => {
    await request(app)
      .post('/api/orders')
      .send({ items: [{ sku: 'WIDGET-A', quantity: 1 }] })
      .expect(400);
  });

  it('returns 422 for out-of-stock items', async () => {
    await request(app)
      .post('/api/orders')
      .send({
        customerId: 'cust-1',
        items: [{ sku: 'RARE-ITEM', quantity: 9999 }],
      })
      .expect(422);
  });
});
```

### Go: Risk-Based Test Organization

```go
// domain/pricing_test.go — High coverage: domain logic
package domain_test

import (
    "testing"
    "myapp/domain"
)

func TestCalculateOrderTotal(t *testing.T) {
    tests := []struct {
        name     string
        items    []domain.LineItem
        expected float64
        wantErr  bool
    }{
        {
            name: "happy path: multiple items",
            items: []domain.LineItem{
                {SKU: "A", UnitPrice: 10, Quantity: 3},
                {SKU: "B", UnitPrice: 25, Quantity: 1},
            },
            expected: 55,
        },
        {
            name:     "edge case: empty cart",
            items:    []domain.LineItem{},
            expected: 0,
        },
        {
            name:    "error path: negative quantity",
            items:   []domain.LineItem{{SKU: "A", UnitPrice: 10, Quantity: -1}},
            wantErr: true,
        },
        {
            name: "boundary: max int quantity",
            items: []domain.LineItem{
                {SKU: "A", UnitPrice: 0.01, Quantity: 1},
            },
            expected: 0.01,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            total, err := domain.CalculateOrderTotal(tt.items)
            if tt.wantErr {
                if err == nil {
                    t.Fatal("expected error, got nil")
                }
                return
            }
            if err != nil {
                t.Fatalf("unexpected error: %v", err)
            }
            if total != tt.expected {
                t.Errorf("expected %f, got %f", tt.expected, total)
            }
        })
    }
}
```

```go
// api/order_handler_test.go — Integration: tests HTTP layer with real dependencies
//go:build integration

package api_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    "myapp/api"
    "myapp/testutil"
)

func TestCreateOrder_Integration(t *testing.T) {
    db := testutil.SetupTestDB(t)
    defer testutil.TeardownTestDB(t, db)
    handler := api.NewOrderHandler(db)

    t.Run("success", func(t *testing.T) {
        body, _ := json.Marshal(map[string]interface{}{
            "customer_id": "cust-1",
            "items":       []map[string]interface{}{{"sku": "WIDGET-A", "quantity": 2}},
        })
        req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewReader(body))
        rec := httptest.NewRecorder()
        handler.ServeHTTP(rec, req)

        if rec.Code != http.StatusCreated {
            t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
        }
    })

    t.Run("missing customer ID returns 400", func(t *testing.T) {
        body, _ := json.Marshal(map[string]interface{}{
            "items": []map[string]interface{}{{"sku": "WIDGET-A", "quantity": 1}},
        })
        req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewReader(body))
        rec := httptest.NewRecorder()
        handler.ServeHTTP(rec, req)

        if rec.Code != http.StatusBadRequest {
            t.Fatalf("expected 400, got %d", rec.Code)
        }
    })
}
```

### Python: Regression Test After a Bug Fix

```python
# test_invoice_rounding.py — Regression test for BUG-4521
# Bug: invoice total was off by $0.01 due to floating-point rounding
# Root cause: using float instead of Decimal for tax calculation
import pytest
from decimal import Decimal
from invoice_service import InvoiceService, InvoiceItem


class TestInvoiceRoundingRegression:
    """Regression tests for BUG-4521: floating-point rounding in invoices."""

    def test_tax_rounding_matches_expected_total(self):
        """The exact scenario that caused the production bug."""
        service = InvoiceService(tax_rate=Decimal("0.0825"))
        invoice = service.create(
            customer_id="cust-affected",
            items=[
                InvoiceItem(description="Service A", quantity=1, unit_price=Decimal("33.33")),
                InvoiceItem(description="Service B", quantity=3, unit_price=Decimal("16.67")),
            ],
        )
        # Pre-fix, this returned 90.83 instead of 90.84
        assert invoice.total == Decimal("90.84")

    def test_sibling_rounding_scenario(self):
        """Same class of bug: many small items amplify rounding error."""
        service = InvoiceService(tax_rate=Decimal("0.0725"))
        invoice = service.create(
            customer_id="cust-2",
            items=[
                InvoiceItem(description=f"Item {i}", quantity=1, unit_price=Decimal("0.99"))
                for i in range(100)
            ],
        )
        expected_subtotal = Decimal("99.00")
        expected_tax = (expected_subtotal * Decimal("0.0725")).quantize(Decimal("0.01"))
        assert invoice.subtotal == expected_subtotal
        assert invoice.tax == expected_tax
        assert invoice.total == expected_subtotal + expected_tax
```

---

## 10 Best Practices

1. **Start with a risk assessment, not a coverage target.** Identify the top 10
   business-critical paths and ensure they have comprehensive tests first.
2. **Apply the four-path rule to every feature.** Happy path, edge cases, error
   paths, and boundary values — each gets at least one test.
3. **Set differentiated coverage targets by code category.** Domain logic at 90%+,
   handlers at 70%+, glue code at 30%+.
4. **Test at the lowest cost layer that provides confidence.** Prefer unit tests
   for logic, integration tests for I/O, E2E only for critical workflows.
5. **Make regression tests mandatory for every bug fix.** No bug fix PR merges
   without a test that would have caught the bug.
6. **Review test strategy during architecture reviews.** When the system changes,
   the test strategy must evolve.
7. **Track test effectiveness metrics.** Measure bug escape rate (bugs found in
   production that tests should have caught).
8. **Prune tests that never fail.** A test that has not failed in 12 months may
   be testing the obvious — evaluate whether it still adds value.
9. **Use mutation testing to validate test quality.** Coverage alone does not
   indicate test effectiveness; mutation testing reveals weak assertions.
10. **Document the test strategy in an ADR.** Make the rationale for what-to-test
    decisions explicit, reviewable, and version-controlled.

---

## Anti-Patterns

| Anti-Pattern                          | Impact                                           | Fix                                                       |
|---------------------------------------|--------------------------------------------------|-----------------------------------------------------------|
| Uniform 80% coverage mandate          | Wastes effort on low-risk code, under-tests high-risk | Differentiated targets by code category                  |
| Testing only happy paths              | Edge cases and error conditions cause production bugs  | Enforce four-path rule in code reviews                   |
| Testing implementation details        | Tests break on refactor; no confidence gain        | Assert on behavior and outputs, not internal state        |
| No regression tests after bugs        | Same bug recurs after unrelated changes            | Mandatory regression test in every bug-fix PR             |
| Testing third-party library internals | Maintains someone else's tests; brittle coupling   | Test the wrapper/adapter, not the library                 |
| Coverage as a vanity metric           | High coverage with weak assertions proves nothing  | Combine coverage with mutation testing scores             |
| Gold-plating test suites              | 100% coverage in low-risk areas delays delivery    | Apply risk-based prioritization to testing effort         |
| Skipping negative test cases          | Input validation and error handling are untested    | Require error-path tests for every public API endpoint    |

---

## Enforcement Checklist

- [ ] Risk assessment document exists for the project's test strategy
- [ ] Top 10 business-critical paths are identified and fully tested
- [ ] Differentiated coverage targets are defined per code category
- [ ] Code review checklist includes "four-path coverage" verification
- [ ] Bug fix PRs require a regression test tagged with the bug ticket ID
- [ ] Mutation testing runs at least monthly on domain logic modules
- [ ] Test effectiveness metrics (bug escape rate) are tracked per quarter
- [ ] Test strategy is documented in an Architecture Decision Record (ADR)
- [ ] Dead tests (never failing in 12 months) are reviewed and pruned annually
- [ ] New features include a test plan section in the design document
- [ ] API endpoints have both positive and negative test cases
- [ ] Test coverage reports distinguish between code categories
