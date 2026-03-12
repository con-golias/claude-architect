# Test-Driven Development

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | Testing > Philosophy                                         |
| Importance    | High                                                         |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [BDD](bdd.md), [Testing Pyramid](testing-pyramid.md), [What to Test](what-to-test.md) |

---

## Core Concepts

### The Red-Green-Refactor Cycle

TDD is a discipline, not a testing technique. Write the test first, watch it fail,
write the minimum code to pass, then improve the design.

```
  +---------+       +---------+       +-----------+
  |   RED   | ----> |  GREEN  | ----> |  REFACTOR |
  | Write a |       | Write   |       | Improve   |
  | failing |       | minimal |       | design,   |
  | test    |       | code to |       | keep tests|
  |         |       | pass    |       | green     |
  +---------+       +---------+       +-----------+
       ^                                    |
       +------------------------------------+
```

**Rules of TDD (Robert C. Martin):**

1. Write no production code except to make a failing test pass.
2. Write only enough of a test to demonstrate a failure.
3. Write only enough production code to make the test pass.

### London School (Mockist / Outside-In)

Start from the outermost layer (controller/handler) and work inward. Use mocks
and stubs for all collaborators. Design emerges from interactions.

**Characteristics:**
- Top-down development flow
- Heavy use of mocks and stubs
- Tests specify interaction protocols between objects
- Good for discovering interfaces and APIs
- Risk: tests coupled to implementation details

### Detroit School (Classicist / Inside-Out)

Start from the domain core and build outward. Use real objects wherever possible.
Design emerges from data and behavior.

**Characteristics:**
- Bottom-up development flow
- Minimal mocking (only for external I/O)
- Tests specify inputs and outputs
- Good for rich domain models
- Risk: may delay API design decisions

### Decision Framework: When TDD Helps vs. Hinders

| Scenario                          | TDD Value | Recommendation                          |
|-----------------------------------|-----------|----------------------------------------|
| New feature with clear requirements | High      | Full red-green-refactor                 |
| Exploratory / spike work           | Low       | Skip TDD; write tests after spike       |
| Bug fix                            | High      | Write failing test that reproduces bug  |
| Legacy code with no tests          | Medium    | Characterization tests first            |
| UI layout / visual design          | Low       | Visual regression tools instead         |
| Complex algorithm                  | High      | TDD with triangulation                  |
| Glue code / wiring                 | Low       | Integration test after the fact         |
| Performance-critical code          | Medium    | TDD for correctness, benchmark separately|

---

## Code Examples

### TypeScript: TDD Walkthrough — Shopping Cart

Step-by-step red-green-refactor building a shopping cart.

**Step 1: RED — Write the first failing test.**

```typescript
// src/cart.test.ts
import { Cart } from './cart';

describe('Cart', () => {
  it('starts empty with zero total', () => {
    const cart = new Cart();
    expect(cart.items).toEqual([]);
    expect(cart.total).toBe(0);
  });
});

// Running this fails: Cart does not exist yet.
```

**Step 2: GREEN — Minimum code to pass.**

```typescript
// src/cart.ts
export interface CartItem {
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export class Cart {
  readonly items: CartItem[] = [];

  get total(): number {
    return 0;
  }
}
```

**Step 3: RED — Next behavior: add an item.**

```typescript
// src/cart.test.ts (add to describe block)
it('adds an item and computes total', () => {
  const cart = new Cart();
  cart.addItem({ sku: 'WIDGET', name: 'Widget', unitPrice: 10, quantity: 2 });

  expect(cart.items).toHaveLength(1);
  expect(cart.total).toBe(20);
});
```

**Step 4: GREEN — Implement addItem and fix total.**

```typescript
// src/cart.ts
export class Cart {
  private _items: CartItem[] = [];

  get items(): ReadonlyArray<CartItem> {
    return [...this._items];
  }

  get total(): number {
    return this._items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  addItem(item: CartItem): void {
    const existing = this._items.find((i) => i.sku === item.sku);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      this._items.push({ ...item });
    }
  }
}
```

**Step 5: RED — Discount rule.**

```typescript
it('applies 10% discount when total exceeds 100', () => {
  const cart = new Cart();
  cart.addItem({ sku: 'EXPENSIVE', name: 'Gadget', unitPrice: 60, quantity: 2 });

  expect(cart.total).toBe(120);
  expect(cart.discountedTotal).toBe(108); // 10% off
});
```

**Step 6: GREEN — Add discountedTotal.**

```typescript
get discountedTotal(): number {
  const raw = this.total;
  return raw > 100 ? raw * 0.9 : raw;
}
```

**Step 7: REFACTOR — Extract discount strategy.**

```typescript
// src/discount.ts
export interface DiscountStrategy {
  apply(subtotal: number): number;
}

export class ThresholdDiscount implements DiscountStrategy {
  constructor(
    private readonly threshold: number,
    private readonly rate: number,
  ) {}

  apply(subtotal: number): number {
    return subtotal > this.threshold ? subtotal * (1 - this.rate) : subtotal;
  }
}

// src/cart.ts — inject discount strategy
export class Cart {
  constructor(private readonly discount: DiscountStrategy = new ThresholdDiscount(100, 0.1)) {}
  // ... rest unchanged

  get discountedTotal(): number {
    return this.discount.apply(this.total);
  }
}
```

All existing tests remain green after refactor.

### Go: TDD for a REST Endpoint Handler

```go
// handler_test.go — RED: test for a user creation handler
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

func TestCreateUser_Success(t *testing.T) {
    store := testutil.NewInMemoryUserStore()
    handler := api.NewCreateUserHandler(store)

    body, _ := json.Marshal(map[string]string{
        "email": "alice@example.com",
        "name":  "Alice",
    })
    req := httptest.NewRequest(http.MethodPost, "/users", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()

    handler.ServeHTTP(rec, req)

    if rec.Code != http.StatusCreated {
        t.Fatalf("expected 201, got %d", rec.Code)
    }

    var resp map[string]string
    json.NewDecoder(rec.Body).Decode(&resp)
    if resp["email"] != "alice@example.com" {
        t.Errorf("expected email alice@example.com, got %s", resp["email"])
    }
}

func TestCreateUser_InvalidEmail(t *testing.T) {
    store := testutil.NewInMemoryUserStore()
    handler := api.NewCreateUserHandler(store)

    body, _ := json.Marshal(map[string]string{
        "email": "not-an-email",
        "name":  "Bob",
    })
    req := httptest.NewRequest(http.MethodPost, "/users", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()

    handler.ServeHTTP(rec, req)

    if rec.Code != http.StatusBadRequest {
        t.Fatalf("expected 400, got %d", rec.Code)
    }
}
```

```go
// handler.go — GREEN: minimal implementation
package api

import (
    "encoding/json"
    "net/http"
    "regexp"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

type UserStore interface {
    Create(email, name string) (string, error)
}

type CreateUserHandler struct {
    store UserStore
}

func NewCreateUserHandler(store UserStore) *CreateUserHandler {
    return &CreateUserHandler{store: store}
}

func (h *CreateUserHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Email string `json:"email"`
        Name  string `json:"name"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid body", http.StatusBadRequest)
        return
    }
    if !emailRegex.MatchString(req.Email) {
        http.Error(w, "invalid email", http.StatusBadRequest)
        return
    }

    id, err := h.store.Create(req.Email, req.Name)
    if err != nil {
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{
        "id":    id,
        "email": req.Email,
        "name":  req.Name,
    })
}
```

### Python: TDD for a Domain Service

```python
# test_invoice_service.py — RED: write tests first
import pytest
from decimal import Decimal
from invoice_service import InvoiceService, InvoiceItem

class TestInvoiceService:
    def test_creates_invoice_with_line_totals(self):
        service = InvoiceService()
        invoice = service.create(
            customer_id="cust-1",
            items=[
                InvoiceItem(description="Consulting", quantity=10, unit_price=Decimal("150.00")),
                InvoiceItem(description="Travel", quantity=1, unit_price=Decimal("500.00")),
            ],
        )
        assert invoice.subtotal == Decimal("2000.00")
        assert len(invoice.lines) == 2

    def test_applies_tax_rate(self):
        service = InvoiceService(tax_rate=Decimal("0.20"))
        invoice = service.create(
            customer_id="cust-1",
            items=[InvoiceItem(description="Service", quantity=1, unit_price=Decimal("100.00"))],
        )
        assert invoice.tax == Decimal("20.00")
        assert invoice.total == Decimal("120.00")

    def test_rejects_empty_items(self):
        service = InvoiceService()
        with pytest.raises(ValueError, match="at least one item"):
            service.create(customer_id="cust-1", items=[])
```

```python
# invoice_service.py — GREEN: implement to pass tests
from dataclasses import dataclass, field
from decimal import Decimal
from typing import List
import uuid

@dataclass(frozen=True)
class InvoiceItem:
    description: str
    quantity: int
    unit_price: Decimal

@dataclass(frozen=True)
class InvoiceLine:
    description: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal

@dataclass(frozen=True)
class Invoice:
    id: str
    customer_id: str
    lines: List[InvoiceLine]
    subtotal: Decimal
    tax: Decimal
    total: Decimal

class InvoiceService:
    def __init__(self, tax_rate: Decimal = Decimal("0.0")):
        self._tax_rate = tax_rate

    def create(self, customer_id: str, items: List[InvoiceItem]) -> Invoice:
        if not items:
            raise ValueError("Invoice must contain at least one item")

        lines = [
            InvoiceLine(
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.unit_price * item.quantity,
            )
            for item in items
        ]
        subtotal = sum(line.line_total for line in lines)
        tax = subtotal * self._tax_rate
        return Invoice(
            id=str(uuid.uuid4()),
            customer_id=customer_id,
            lines=lines,
            subtotal=subtotal,
            tax=tax,
            total=subtotal + tax,
        )
```

### TDD for Legacy Code: Characterization Tests

When facing legacy code with no tests, write characterization tests first to
capture existing behavior before refactoring.

```typescript
// characterization.test.ts — Capture existing behavior, warts and all
import { legacyCalculateTax } from './legacy-tax';

describe('legacyCalculateTax — characterization', () => {
  // Document actual behavior, even if it seems wrong
  it('returns 0 for negative amounts (possible bug)', () => {
    expect(legacyCalculateTax(-100)).toBe(0);
  });

  it('applies 7% for amounts under 1000', () => {
    expect(legacyCalculateTax(500)).toBeCloseTo(35);
  });

  it('applies 5% for amounts 1000 and above', () => {
    expect(legacyCalculateTax(1000)).toBeCloseTo(50);
  });
});
// Now refactor with confidence — any behavioral change breaks a test.
```

---

## 10 Best Practices

1. **Write the test name before the test body.** The name is the specification;
   clarify intent before writing assertions.
2. **Keep the red phase short.** One failing test at a time. Resist the urge to
   write multiple tests before going green.
3. **Make the green phase trivially obvious.** Write the dumbest possible code
   that passes. Refactoring comes next.
4. **Refactor only when green.** Never change production code and test code
   simultaneously.
5. **Use triangulation to drive generalization.** Add a second example to force
   the removal of hardcoded values.
6. **Choose London or Detroit deliberately.** London for discovering APIs, Detroit
   for building domain logic. Do not mix unconsciously.
7. **Start TDD from the failing bug report.** For every bug, write a test that
   fails before fixing — this is the highest-value TDD application.
8. **Time-box spikes outside TDD.** When exploring unknowns, spike without tests,
   then throw away the spike and TDD the solution.
9. **Keep test setup under 5 lines.** If setup grows, extract builders or fixtures.
   Complex setup signals a design problem.
10. **Run the full unit suite in under 2 minutes.** If TDD feels slow, the suite
    is too slow. Optimize or split.

---

## Anti-Patterns

| Anti-Pattern                         | Impact                                            | Fix                                                      |
|--------------------------------------|---------------------------------------------------|----------------------------------------------------------|
| Test-after labelled as TDD           | Loses design benefit; tests mirror implementation | Commit to red-first; code review the commit sequence     |
| Testing implementation, not behavior | Brittle tests break on every refactor             | Assert on outputs and side effects, not method calls     |
| Skipping the refactor step           | Code rots despite green tests                     | Treat refactor as mandatory; timebox 2-5 min per cycle   |
| Giant red phase (many failing tests) | Overwhelming; hard to go green incrementally       | One test at a time; use TODO comments for future tests   |
| Mocking everything (London excess)   | Tests pass but system fails at integration         | Mock only I/O boundaries; use fakes for domain logic     |
| Over-specifying mock interactions    | Tests coupled to call order and argument shape     | Verify outcomes, not the number of calls                 |
| TDD on throwaway prototypes          | Wasted effort on code that will be deleted          | Spike freely; TDD the production implementation          |
| Ignoring characterization tests      | Refactoring legacy code breaks unknown behavior    | Write characterization tests before any refactor          |

---

## Enforcement Checklist

- [ ] Team has agreed on London vs Detroit school (or when to use each)
- [ ] CI rejects PRs where test files have a later timestamp than implementation
      (optional: commit-order analysis via git log)
- [ ] Code reviews verify red-green-refactor commit rhythm
- [ ] Bug fix PRs always include a failing regression test
- [ ] Test names describe behavior, not implementation (no `testMethod1`)
- [ ] Mock usage is limited to I/O boundaries (DB, HTTP, filesystem)
- [ ] Spike/prototype code is clearly marked and excluded from coverage
- [ ] Characterization tests exist for all legacy modules under active development
- [ ] TDD katas or mob sessions are scheduled at least monthly for practice
- [ ] Refactoring step is tracked — at least one refactor commit per feature branch
