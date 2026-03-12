# Test Patterns and Data Management

| Attribute      | Value                                        |
|----------------|----------------------------------------------|
| Domain         | Testing > Unit Testing                       |
| Importance     | High                                         |
| Last Updated   | 2026-03-10                                   |
| Cross-ref      | [Fundamentals](fundamentals.md), [Mocking Strategies](mocking-strategies.md), [Tools](tools-jest-vitest-pytest.md) |

---

## Core Concepts

### The Problem: Test Data Complexity

As the domain model grows, constructing valid test objects by hand becomes error-prone and verbose.
Patterns such as Fixtures, Factories, Builders, and Object Mothers exist to keep test data creation
concise, readable, and maintainable.

### Fixtures

Static, pre-configured data loaded before tests execute.

- **Inline fixtures** -- declared directly inside the test. Best for small, test-specific data.
- **Shared fixtures** -- declared once and reused across many tests (e.g., `conftest.py`, `beforeAll`).
  Use shared fixtures only for immutable reference data; never share mutable state.
- **External fixtures** -- loaded from JSON/YAML files. Useful for snapshot-like data but hard to
  maintain when the schema changes.

### Factories

Functions or classes that produce valid test objects with sensible defaults. Override only the
fields that matter for the test at hand.

### Builders

A fluent API for constructing objects step by step. Builders are ideal when the object has many
optional fields and the test needs to communicate intent through the chain of method calls.

### Object Mother

A static helper class that exposes named factory methods for common domain-object states:
`OrderMother.paid()`, `OrderMother.cancelled()`. Object Mothers work well for small domains
but become unwieldy as the number of variations grows -- at that point, switch to Builders.

---

## Code Examples

### TypeScript -- Factory Pattern with Fishery and faker

```typescript
// tests/factories/user.factory.ts
import { Factory } from "fishery";
import { faker } from "@faker-js/faker";

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  createdAt: Date;
}

export const userFactory = Factory.define<User>(({ sequence }) => ({
  id: `user-${sequence}`,
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: "member",
  createdAt: new Date("2025-01-01T00:00:00Z"),
}));

// Usage in tests
import { describe, it, expect } from "vitest";
import { userFactory } from "../factories/user.factory";
import { canAccessAdmin } from "../../src/auth/permissions";

describe("canAccessAdmin", () => {
  it("should grant access to admin users", () => {
    const admin = userFactory.build({ role: "admin" });
    expect(canAccessAdmin(admin)).toBe(true);
  });

  it("should deny access to member users", () => {
    const member = userFactory.build(); // default role is "member"
    expect(canAccessAdmin(member)).toBe(false);
  });

  it("should handle batch creation for list tests", () => {
    const users = userFactory.buildList(5, { role: "member" });
    expect(users).toHaveLength(5);
    expect(users.every((u) => u.role === "member")).toBe(true);
  });
});
```

### TypeScript -- Builder Pattern

```typescript
// tests/builders/order.builder.ts
interface OrderLine { productId: string; quantity: number; unitPriceCents: number }
interface Order { id: string; customerId: string; lines: OrderLine[]; status: string }

export class OrderBuilder {
  private order: Order = {
    id: "ord-default",
    customerId: "cust-1",
    lines: [],
    status: "pending",
  };

  withId(id: string): this { this.order.id = id; return this; }
  withCustomer(id: string): this { this.order.customerId = id; return this; }
  withLine(line: OrderLine): this { this.order.lines.push(line); return this; }
  withStatus(s: string): this { this.order.status = s; return this; }

  build(): Order { return { ...this.order, lines: [...this.order.lines] }; }
}

// Usage
const order = new OrderBuilder()
  .withCustomer("cust-42")
  .withLine({ productId: "sku-1", quantity: 2, unitPriceCents: 999 })
  .withStatus("paid")
  .build();
```

### Go -- Test Helpers with `t.Helper()` and Table-Driven Patterns

```go
// order/testhelper_test.go
package order_test

import "testing"

// newTestOrder is a helper that creates a valid Order with sensible defaults.
// Override fields via functional options.
type OrderOption func(*Order)

func WithStatus(s string) OrderOption {
	return func(o *Order) { o.Status = s }
}

func WithCustomer(id string) OrderOption {
	return func(o *Order) { o.CustomerID = id }
}

func newTestOrder(t *testing.T, opts ...OrderOption) *Order {
	t.Helper() // marks this function so failures point to the caller
	o := &Order{
		ID:         "ord-default",
		CustomerID: "cust-1",
		Status:     "pending",
		Lines:      nil,
	}
	for _, opt := range opts {
		opt(o)
	}
	return o
}

// order/service_test.go
func TestCancelOrder(t *testing.T) {
	tests := []struct {
		name    string
		order   *Order
		wantErr bool
	}{
		{
			name:  "cancels a pending order",
			order: newTestOrder(t, WithStatus("pending")),
		},
		{
			name:    "rejects cancellation of shipped order",
			order:   newTestOrder(t, WithStatus("shipped")),
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CancelOrder(tt.order)
			if (err != nil) != tt.wantErr {
				t.Errorf("CancelOrder() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
```

### Go -- Custom Assertion Helpers

```go
func assertEqual[T comparable](t *testing.T, got, want T) {
	t.Helper()
	if got != want {
		t.Errorf("got %v, want %v", got, want)
	}
}
```

### Python -- pytest Fixtures with Scope

```python
# tests/conftest.py
import pytest
from decimal import Decimal

@pytest.fixture(scope="session")
def db_schema():
    """Expensive setup run once per test session."""
    schema = create_schema()
    yield schema
    schema.drop()

@pytest.fixture(scope="function")
def order_factory():
    """Return a factory callable; each test gets a fresh closure."""
    _counter = 0

    def _create(**overrides):
        nonlocal _counter
        _counter += 1
        defaults = {
            "id": f"ord-{_counter}",
            "customer_id": "cust-1",
            "total_cents": 10_000,
            "status": "pending",
        }
        defaults.update(overrides)
        return Order(**defaults)

    return _create
```

### Python -- factory_boy

```python
# tests/factories.py
import factory
from order.models import Order, OrderLine

class OrderLineFactory(factory.Factory):
    class Meta:
        model = OrderLine

    product_id = factory.Sequence(lambda n: f"sku-{n}")
    quantity = 1
    unit_price_cents = 999

class OrderFactory(factory.Factory):
    class Meta:
        model = Order

    id = factory.Sequence(lambda n: f"ord-{n}")
    customer_id = "cust-1"
    status = "pending"
    lines = factory.LazyFunction(list)

    @factory.post_generation
    def with_lines(obj, create, extracted, **kwargs):
        if extracted:
            obj.lines.extend(extracted)

# Usage
def test_order_total():
    line = OrderLineFactory(quantity=3, unit_price_cents=500)
    order = OrderFactory(with_lines=[line])
    assert order.calculate_total() == 1500
```

---

## Test Data Isolation

### Preventing Test Pollution

- Never share mutable data across tests. Copy or recreate in each test.
- Reset global state (singletons, module-level caches) in setup/teardown hooks.
- Use unique identifiers (UUIDs, sequence counters) to avoid collisions when tests run in parallel.
- In pytest, prefer `scope="function"` unless the fixture is genuinely read-only and expensive.

### Parallel-Safe Data

When tests run concurrently (`pytest-xdist`, `go test -parallel`, Vitest threads):

- Avoid shared files or ports.
- Generate unique keys per worker (use `worker_id` fixture in pytest-xdist).
- Design factories to produce non-colliding identifiers by default.

---

## Parameterized Tests

### TypeScript -- `it.each`

```typescript
it.each([
  { input: 0, expected: "zero" },
  { input: 1, expected: "one" },
  { input: -1, expected: "negative" },
])("classifyNumber($input) returns $expected", ({ input, expected }) => {
  expect(classifyNumber(input)).toBe(expected);
});
```

### Go -- Table-Driven (Standard Pattern)

Refer to the Go example in [Fundamentals](fundamentals.md). Table-driven tests *are* Go's
parameterized test pattern.

### Python -- `@pytest.mark.parametrize`

```python
@pytest.mark.parametrize(
    "input_val, expected",
    [(0, "zero"), (1, "one"), (-1, "negative")],
    ids=["zero", "positive", "negative"],
)
def test_classify_number(input_val: int, expected: str):
    assert classify_number(input_val) == expected
```

---

## Best Practices

1. **Use factories with sensible defaults.** Specify only the fields relevant to the test under consideration.
2. **Isolate every test's data.** Never rely on leftover state from a prior test.
3. **Prefer `scope="function"` fixtures.** Widen scope only for expensive, immutable resources.
4. **Keep builder chains short.** More than five chained calls indicates the object is too complex for a unit test.
5. **Name factory methods after domain states.** `OrderFactory.paid()` is clearer than `OrderFactory(status="paid")`.
6. **Co-locate factories with tests.** Place them in `tests/factories/` so they are easy to discover.
7. **Avoid loading fixtures from files.** Inline data or factory calls are more refactor-resistant.
8. **Generate unique IDs by default.** Sequence counters or UUIDs prevent collisions in parallel runs.
9. **Validate factory output in one dedicated test.** Ensure the factory itself produces valid domain objects.
10. **Delete unused factories.** Unused test infrastructure is as harmful as unused production code.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **God fixture** (single fixture used by every test) | Changes to the fixture cascade across hundreds of tests. | Split into small, purpose-specific fixtures or factories. |
| **Mutable shared state** | Order-dependent failures that vanish when run in isolation. | Create fresh state per test; use `scope="function"`. |
| **Brittle external fixture files** | Schema changes silently invalidate JSON/YAML test data. | Use factories with defaults; generate data in code. |
| **Over-specified factories** | Every field is set explicitly, obscuring the field that matters. | Set only the field under test; rely on defaults for the rest. |
| **Copy-pasting setup across tests** | Duplication leads to inconsistent test data and maintenance burden. | Extract shared setup into helpers, fixtures, or builders. |
| **Randomized data without seed control** | Non-reproducible failures on CI. | Pin the faker seed per test run; log it for replay. |
| **Tests that depend on insertion order** | Fragile when parallelism or DB ordering changes. | Assert on sets or sorted collections, not raw order. |
| **Factory that hides important logic** | Test reader cannot understand preconditions without reading the factory. | Keep factories transparent; document any non-obvious defaults. |

---

## Enforcement Checklist

- [ ] A `tests/factories/` (or `testdata/`) directory exists with shared factory definitions.
- [ ] Factories produce valid domain objects by default (verified by a dedicated test).
- [ ] Each factory uses sequence counters or UUIDs for identity fields.
- [ ] No test file imports mutable data from another test file.
- [ ] Parameterized tests cover at least all equivalence partitions.
- [ ] Fixtures wider than `function` scope are documented and justified.
- [ ] CI runs tests in randomized order (pytest `--randomly-seed`, Go `-shuffle`).
- [ ] Faker seeds are logged in CI output for failure reproduction.
- [ ] Builder chains in tests do not exceed five method calls.
- [ ] Unused factories and fixtures are removed during quarterly test-hygiene reviews.
