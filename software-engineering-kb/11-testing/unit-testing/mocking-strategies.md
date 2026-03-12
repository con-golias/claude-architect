# Mocking Strategies

| Attribute      | Value                                        |
|----------------|----------------------------------------------|
| Domain         | Testing > Unit Testing                       |
| Importance     | High                                         |
| Last Updated   | 2026-03-10                                   |
| Cross-ref      | [Fundamentals](fundamentals.md), [Test Patterns](test-patterns.md), [Tools](tools-jest-vitest-pytest.md) |

---

## Core Concepts

### Test Doubles Taxonomy (Gerard Meszaros)

| Double   | Purpose                                                          | Verifies          |
|----------|------------------------------------------------------------------|--------------------|
| **Dummy**  | Passed to satisfy a parameter list; never actually used.        | Nothing            |
| **Stub**   | Returns canned responses to calls made during the test.         | State (indirect input) |
| **Spy**    | Records information about how it was called for later assertion. | Interaction        |
| **Mock**   | Pre-programmed with expectations; fails the test if expectations are violated. | Interaction |
| **Fake**   | Working implementation with shortcuts (in-memory DB, local queue). | State via real logic |

Use the lightest double that satisfies the test's needs. Prefer stubs over mocks when you only care
about the returned value, not the call itself.

### When to Mock vs. When to Use Real Implementations

**Mock when:**

- The dependency is slow (network, disk, database).
- The dependency is non-deterministic (clock, random, external API).
- The dependency has side effects that are hard to observe or undo.
- You need to simulate error conditions that are difficult to trigger naturally.

**Use the real implementation when:**

- The collaborator is a pure function or value object with no side effects.
- The real implementation is faster than setting up the mock.
- The integration boundary is the explicit subject of the test (integration test, not unit test).

### Dependency Injection for Testability

Design production code so that collaborators are injected, not constructed internally.
Constructor injection is the simplest and most explicit form. Avoid service locators in
test-heavy codebases -- they obscure dependencies and complicate stubbing.

---

## Code Examples

### TypeScript -- Jest / Vitest Mocks, Spies, Module Mocking

```typescript
// src/services/order.service.ts
import { PaymentGateway } from "../gateways/payment.gateway";
import { OrderRepository } from "../repositories/order.repository";

export class OrderService {
  constructor(
    private readonly payments: PaymentGateway,
    private readonly orders: OrderRepository,
  ) {}

  async placeOrder(orderId: string, amountCents: number): Promise<void> {
    const result = await this.payments.charge(orderId, amountCents);
    if (!result.success) throw new Error("Payment failed");
    await this.orders.markPaid(orderId);
  }
}

// src/services/__tests__/order.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "../order.service";
import type { PaymentGateway } from "../../gateways/payment.gateway";
import type { OrderRepository } from "../../repositories/order.repository";

describe("OrderService.placeOrder", () => {
  // --- Stubs / Mocks via vi.fn() ---
  const paymentGateway: PaymentGateway = {
    charge: vi.fn(),
  };
  const orderRepo: OrderRepository = {
    markPaid: vi.fn(),
  };

  let sut: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    sut = new OrderService(paymentGateway, orderRepo);
  });

  it("should charge the payment gateway and mark the order paid", async () => {
    // Arrange -- stub the gateway to return success
    vi.mocked(paymentGateway.charge).mockResolvedValue({ success: true });

    // Act
    await sut.placeOrder("ord-1", 5000);

    // Assert -- interaction verification (spy behavior)
    expect(paymentGateway.charge).toHaveBeenCalledWith("ord-1", 5000);
    expect(orderRepo.markPaid).toHaveBeenCalledWith("ord-1");
  });

  it("should throw and not mark paid when charge fails", async () => {
    vi.mocked(paymentGateway.charge).mockResolvedValue({ success: false });

    await expect(sut.placeOrder("ord-2", 3000)).rejects.toThrow("Payment failed");
    expect(orderRepo.markPaid).not.toHaveBeenCalled();
  });
});
```

#### Module Mocking (Vitest / Jest)

```typescript
// Mock an entire module when you cannot inject the dependency.
// Use sparingly -- prefer constructor injection.
vi.mock("../../gateways/payment.gateway", () => ({
  PaymentGateway: vi.fn().mockImplementation(() => ({
    charge: vi.fn().mockResolvedValue({ success: true }),
  })),
}));
```

### Go -- Interface-Based Mocking

```go
// order/gateway.go
package order

type ChargeResult struct{ Success bool }

type PaymentGateway interface {
	Charge(orderID string, amountCents int) (ChargeResult, error)
}

type OrderRepository interface {
	MarkPaid(orderID string) error
}

// order/service.go
package order

import "errors"

type Service struct {
	payments PaymentGateway
	orders   OrderRepository
}

func NewService(pg PaymentGateway, repo OrderRepository) *Service {
	return &Service{payments: pg, orders: repo}
}

func (s *Service) PlaceOrder(orderID string, amountCents int) error {
	res, err := s.payments.Charge(orderID, amountCents)
	if err != nil {
		return err
	}
	if !res.Success {
		return errors.New("payment failed")
	}
	return s.orders.MarkPaid(orderID)
}

// order/service_test.go
package order_test

import (
	"errors"
	"testing"

	"example.com/order"
)

// --- Manual stub implementing the interface ---
type stubGateway struct {
	result order.ChargeResult
	err    error
}

func (s *stubGateway) Charge(_ string, _ int) (order.ChargeResult, error) {
	return s.result, s.err
}

type spyRepo struct {
	calledWith string
}

func (s *spyRepo) MarkPaid(orderID string) error {
	s.calledWith = orderID
	return nil
}

func TestPlaceOrder_Success(t *testing.T) {
	gw := &stubGateway{result: order.ChargeResult{Success: true}}
	repo := &spyRepo{}
	svc := order.NewService(gw, repo)

	if err := svc.PlaceOrder("ord-1", 5000); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.calledWith != "ord-1" {
		t.Errorf("expected MarkPaid called with ord-1, got %q", repo.calledWith)
	}
}

func TestPlaceOrder_PaymentFails(t *testing.T) {
	gw := &stubGateway{result: order.ChargeResult{Success: false}}
	repo := &spyRepo{}
	svc := order.NewService(gw, repo)

	err := svc.PlaceOrder("ord-2", 3000)
	if err == nil || err.Error() != "payment failed" {
		t.Fatalf("expected 'payment failed', got %v", err)
	}
	if repo.calledWith != "" {
		t.Error("MarkPaid should not have been called")
	}
}
```

### Python -- unittest.mock and monkeypatch

```python
# order/service.py
from order.gateway import PaymentGateway
from order.repository import OrderRepository

class OrderService:
    def __init__(self, payments: PaymentGateway, orders: OrderRepository) -> None:
        self._payments = payments
        self._orders = orders

    def place_order(self, order_id: str, amount_cents: int) -> None:
        result = self._payments.charge(order_id, amount_cents)
        if not result.success:
            raise RuntimeError("Payment failed")
        self._orders.mark_paid(order_id)

# tests/test_order_service.py
from unittest.mock import MagicMock, create_autospec
import pytest
from order.service import OrderService
from order.gateway import PaymentGateway
from order.repository import OrderRepository

@pytest.fixture
def gateway() -> MagicMock:
    return create_autospec(PaymentGateway, instance=True)

@pytest.fixture
def repo() -> MagicMock:
    return create_autospec(OrderRepository, instance=True)

@pytest.fixture
def sut(gateway: MagicMock, repo: MagicMock) -> OrderService:
    return OrderService(payments=gateway, orders=repo)

class TestPlaceOrder:
    def test_charges_and_marks_paid(self, sut, gateway, repo):
        gateway.charge.return_value = MagicMock(success=True)

        sut.place_order("ord-1", 5000)

        gateway.charge.assert_called_once_with("ord-1", 5000)
        repo.mark_paid.assert_called_once_with("ord-1")

    def test_raises_on_failed_charge(self, sut, gateway, repo):
        gateway.charge.return_value = MagicMock(success=False)

        with pytest.raises(RuntimeError, match="Payment failed"):
            sut.place_order("ord-2", 3000)

        repo.mark_paid.assert_not_called()
```

#### Patching Module-Level Dependencies

```python
from unittest.mock import patch

def test_with_patched_clock():
    with patch("order.service.time.time", return_value=1_700_000_000.0):
        # Code inside order.service that calls time.time() sees the stub value.
        ...
```

---

## Mocking External Systems

### External APIs

Stub the HTTP client, not the network. Inject an HTTP adapter and return canned responses.
For contract verification, pair unit stubs with a separate contract test suite (Pact, Schemathesis).

### Databases

Use a Fake (in-memory implementation of the repository interface) for unit tests.
Reserve real database connections for integration tests.

### File Systems

Inject a file-system abstraction. In tests, provide an in-memory implementation.
Avoid `tmpdir`-based tests in unit suites -- they are slower and non-deterministic on CI runners.

---

## Over-Mocking: Symptoms and Remedies

**Symptoms:**

- Tests break on every refactor even though behavior has not changed.
- Setup code is longer than the test body.
- Every collaborator is mocked, leaving nothing "real" to test.
- Tests verify exact call sequences rather than outcomes.

**Remedies:**

- Mock at architectural boundaries (ports), not between every internal class.
- Replace interaction assertions with state assertions where possible.
- Introduce Fakes for rich collaborators instead of fragile mocks.
- Apply the "London school vs. Detroit school" decision consciously per module.

---

## Best Practices

1. **Inject dependencies; do not construct them inside the unit.** Constructor injection makes test doubles trivial.
2. **Use `create_autospec` (Python) or typed mocks (TS).** Catch interface drift at test time.
3. **Prefer stubs over mocks.** Verify state when you can; verify interaction only when state is unobservable.
4. **Reset mocks between tests.** Use `beforeEach`/`vi.clearAllMocks()` or fresh fixture instantiation.
5. **Mock at the boundary, not in the middle.** One layer of mocks per test. Two is a code smell; three is a design flaw.
6. **Name your test doubles clearly.** `stubGateway`, `spyRepo` -- the type of double should be obvious.
7. **Verify only the interactions you care about.** Asserting on irrelevant calls makes tests brittle.
8. **Use Fakes for complex collaborators.** An in-memory repository Fake is more robust than a mock with 20 stubs.
9. **Never mock what you do not own.** Wrap third-party libraries behind your own interface; mock that interface.
10. **Keep mock setup under 10 lines.** If more is needed, extract a helper or reconsider the design.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Mocking everything** | Tests verify wiring, not behavior; refactors break all tests. | Mock only at architectural boundaries. |
| **Asserting exact call order** | Brittle tests fail on harmless reordering. | Assert on outcomes; ignore call order unless it matters semantically. |
| **Leaking mocks across tests** | Shared mock state causes phantom failures. | Recreate or reset mocks in setup. |
| **Mocking value objects** | Unnecessary complexity; value objects are trivially constructible. | Use the real value object. |
| **Using `any()` matchers everywhere** | Assertions prove nothing about the arguments passed. | Match on meaningful arguments; use `any()` only for genuinely irrelevant params. |
| **Mocking the system under test** | Test verifies its own stubs, not real code. | Never mock the class/function you are testing. |
| **No `autospec` / typed mocks** | Mock accepts calls that the real object would reject. | Use `create_autospec` (Python) or typed objects (TS/Go interfaces). |
| **Deep mock chains** (`mock.a.b.c.return_value`) | Extremely fragile; reveals Law of Demeter violations. | Refactor production code to reduce chaining; mock the direct collaborator only. |

---

## Enforcement Checklist

- [ ] All external dependencies are injected, not instantiated inside the unit.
- [ ] Mocks/stubs use typed interfaces (`create_autospec`, Go interfaces, TS types).
- [ ] Each test resets or recreates its mocks in `beforeEach` / setup.
- [ ] No test mocks the system under test itself.
- [ ] Interaction assertions are used only when state verification is not possible.
- [ ] Third-party libraries are wrapped behind owned interfaces before mocking.
- [ ] Mock setup for any single test is under 10 lines; helpers used for longer setups.
- [ ] CI lint rule or code review checklist flags tests with more than two layers of mocks.
- [ ] Fakes exist for core infrastructure interfaces (repository, queue, cache).
- [ ] Contract tests supplement stubs for every external API integration.
