# Mocking Strategies & Test Doubles

> **Domain:** Backend > Testing
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Mocking is fundamental to unit testing -- without it, you cannot test code that depends on databases, APIs, file systems, or clocks. But bad mocking is worse than no mocking: tests that test the mocks instead of the code, brittle tests that break on every refactor, and false confidence that the code works when it does not. The right mocking strategy -- what to mock, what not to, and how -- is a critical skill.

---

## How It Works

### Test Double Taxonomy

```
                        Test Doubles
                            │
            ┌───────────────┼───────────────┐
            │               │               │
         Dummy          Stub/Fake        Mock/Spy
     (placeholder)   (return values)   (verify calls)
            │               │               │
    Required param    Simplify deps    Assert behavior
    never used        predictable      interactions
                      responses        matter
```

### When to Use What

| Test Double | Purpose | Example |
|-------------|--------|------------|
| **Dummy** | Fill required params, never used | `new Service(dummyLogger)` |
| **Stub** | Return canned responses | `repo.findById → returns user` |
| **Fake** | Working lightweight implementation | In-memory database, fake SMTP |
| **Mock** | Verify interactions | `emailService.send was called with...` |
| **Spy** | Real impl + recording | Real service, but track calls |

---

## Mocking Frameworks

### TypeScript — Vitest Mocks

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

// vi.fn() — Manual mock function
const mockFetch = vi.fn();

// vi.spyOn() — Spy on existing method
const spy = vi.spyOn(console, "log");

// vi.mock() — Module-level mock
vi.mock("./email-service", () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ id: "msg_123" }),
  })),
}));

describe("OrderService", () => {
  // Type-safe mock with implementation
  const mockOrderRepo = {
    findById: vi.fn<[string], Promise<Order | null>>(),
    save: vi.fn<[Order], Promise<Order>>(),
    delete: vi.fn<[string], Promise<void>>(),
  };

  const mockPaymentGateway = {
    charge: vi.fn<[ChargeInput], Promise<ChargeResult>>(),
    refund: vi.fn<[string], Promise<RefundResult>>(),
  };

  const mockEventBus = {
    publish: vi.fn<[DomainEvent], Promise<void>>(),
  };

  let service: OrderService;

  beforeEach(() => {
    vi.clearAllMocks(); // Reset call history, keep implementations
    service = new OrderService(mockOrderRepo, mockPaymentGateway, mockEventBus);
  });

  describe("completeOrder", () => {
    it("should charge payment and publish event", async () => {
      // Arrange — configure stubs
      const order: Order = {
        id: "ord_123",
        status: "pending",
        total: 5000,
        currency: "EUR",
        items: [{ productId: "prod_1", quantity: 2, price: 2500 }],
      };
      mockOrderRepo.findById.mockResolvedValue(order);
      mockPaymentGateway.charge.mockResolvedValue({
        id: "ch_456",
        status: "succeeded",
      });
      mockOrderRepo.save.mockImplementation(async (o) => o);

      // Act
      const result = await service.completeOrder("ord_123");

      // Assert — verify behavior
      expect(result.status).toBe("completed");

      // Verify payment was charged correctly
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith({
        amount: 5000,
        currency: "EUR",
        orderId: "ord_123",
      });

      // Verify order was saved with updated status
      expect(mockOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ord_123",
          status: "completed",
          paymentId: "ch_456",
        })
      );

      // Verify domain event was published
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "order.completed",
          data: expect.objectContaining({ orderId: "ord_123" }),
        })
      );
    });

    it("should NOT save order if payment fails", async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: "ord_123",
        status: "pending",
        total: 5000,
      } as Order);
      mockPaymentGateway.charge.mockRejectedValue(
        new Error("Card declined")
      );

      await expect(service.completeOrder("ord_123")).rejects.toThrow(
        "Card declined"
      );

      // Order should NOT be saved as completed
      expect(mockOrderRepo.save).not.toHaveBeenCalled();
      // Event should NOT be published
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe("cancelOrder", () => {
    it("should refund payment when cancelling completed order", async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: "ord_123",
        status: "completed",
        paymentId: "ch_456",
        total: 5000,
      } as Order);
      mockPaymentGateway.refund.mockResolvedValue({
        id: "ref_789",
        status: "succeeded",
      });
      mockOrderRepo.save.mockImplementation(async (o) => o);

      await service.cancelOrder("ord_123");

      expect(mockPaymentGateway.refund).toHaveBeenCalledWith("ch_456");
      expect(mockOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled" })
      );
    });
  });
});
```

### Go — Interface Mocks (Manual + Mockgen)

```go
// Go — Manual mocks (preferred for simplicity)
package order_test

import (
    "context"
    "errors"
    "testing"

    "myapp/order"
)

// Manual mock — implements the interface
type mockOrderRepo struct {
    findByIDFn func(ctx context.Context, id string) (*order.Order, error)
    saveFn     func(ctx context.Context, o *order.Order) error

    // Call tracking
    saveCalledWith []*order.Order
}

func (m *mockOrderRepo) FindByID(ctx context.Context, id string) (*order.Order, error) {
    if m.findByIDFn != nil {
        return m.findByIDFn(ctx, id)
    }
    return nil, errors.New("not configured")
}

func (m *mockOrderRepo) Save(ctx context.Context, o *order.Order) error {
    m.saveCalledWith = append(m.saveCalledWith, o)
    if m.saveFn != nil {
        return m.saveFn(ctx, o)
    }
    return nil
}

type mockPaymentGW struct {
    chargeFn      func(ctx context.Context, input order.ChargeInput) (*order.ChargeResult, error)
    chargeCalledN int
}

func (m *mockPaymentGW) Charge(ctx context.Context, input order.ChargeInput) (*order.ChargeResult, error) {
    m.chargeCalledN++
    if m.chargeFn != nil {
        return m.chargeFn(ctx, input)
    }
    return &order.ChargeResult{ID: "ch_test", Status: "succeeded"}, nil
}

type mockEventBus struct {
    publishedEvents []order.DomainEvent
}

func (m *mockEventBus) Publish(ctx context.Context, event order.DomainEvent) error {
    m.publishedEvents = append(m.publishedEvents, event)
    return nil
}

func TestCompleteOrder_Success(t *testing.T) {
    repo := &mockOrderRepo{
        findByIDFn: func(_ context.Context, _ string) (*order.Order, error) {
            return &order.Order{ID: "ord_123", Status: "pending", Total: 5000}, nil
        },
    }
    payment := &mockPaymentGW{}
    events := &mockEventBus{}

    svc := order.NewService(repo, payment, events)
    result, err := svc.CompleteOrder(context.Background(), "ord_123")

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if result.Status != "completed" {
        t.Errorf("status = %q, want completed", result.Status)
    }
    if payment.chargeCalledN != 1 {
        t.Errorf("charge called %d times, want 1", payment.chargeCalledN)
    }
    if len(events.publishedEvents) != 1 {
        t.Errorf("published %d events, want 1", len(events.publishedEvents))
    }
    if events.publishedEvents[0].Type != "order.completed" {
        t.Errorf("event type = %q, want order.completed", events.publishedEvents[0].Type)
    }
}

func TestCompleteOrder_PaymentFails(t *testing.T) {
    repo := &mockOrderRepo{
        findByIDFn: func(_ context.Context, _ string) (*order.Order, error) {
            return &order.Order{ID: "ord_123", Status: "pending", Total: 5000}, nil
        },
    }
    payment := &mockPaymentGW{
        chargeFn: func(_ context.Context, _ order.ChargeInput) (*order.ChargeResult, error) {
            return nil, errors.New("card declined")
        },
    }
    events := &mockEventBus{}

    svc := order.NewService(repo, payment, events)
    _, err := svc.CompleteOrder(context.Background(), "ord_123")

    if err == nil {
        t.Fatal("expected error")
    }
    if len(repo.saveCalledWith) != 0 {
        t.Error("order should NOT be saved on payment failure")
    }
    if len(events.publishedEvents) != 0 {
        t.Error("event should NOT be published on payment failure")
    }
}
```

### Python — unittest.mock & pytest-mock

```python
# Python — pytest-mock
import pytest
from unittest.mock import AsyncMock, MagicMock, call, patch
from order_service import OrderService, Order, ChargeInput

@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    repo.find_by_id = AsyncMock()
    repo.save = AsyncMock()
    return repo

@pytest.fixture
def mock_payment():
    gw = AsyncMock()
    gw.charge = AsyncMock(
        return_value={"id": "ch_456", "status": "succeeded"}
    )
    gw.refund = AsyncMock(
        return_value={"id": "ref_789", "status": "succeeded"}
    )
    return gw

@pytest.fixture
def mock_events():
    return AsyncMock()

@pytest.fixture
def service(mock_repo, mock_payment, mock_events):
    return OrderService(mock_repo, mock_payment, mock_events)

class TestCompleteOrder:
    async def test_charges_payment_and_publishes_event(
        self, service, mock_repo, mock_payment, mock_events
    ):
        mock_repo.find_by_id.return_value = Order(
            id="ord_123", status="pending", total=5000, currency="EUR"
        )

        result = await service.complete_order("ord_123")

        assert result.status == "completed"
        mock_payment.charge.assert_called_once_with(
            ChargeInput(amount=5000, currency="EUR", order_id="ord_123")
        )
        mock_repo.save.assert_called_once()
        saved_order = mock_repo.save.call_args[0][0]
        assert saved_order.status == "completed"
        assert saved_order.payment_id == "ch_456"

        mock_events.publish.assert_called_once()

    async def test_does_not_save_on_payment_failure(
        self, service, mock_repo, mock_payment, mock_events
    ):
        mock_repo.find_by_id.return_value = Order(
            id="ord_123", status="pending", total=5000
        )
        mock_payment.charge.side_effect = Exception("Card declined")

        with pytest.raises(Exception, match="Card declined"):
            await service.complete_order("ord_123")

        mock_repo.save.assert_not_called()
        mock_events.publish.assert_not_called()
```

---

## Fake Implementations

### In-Memory Repository Fake

```typescript
// TypeScript — In-Memory Repository Fake
class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private counter = 0;

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find(
      (u) => u.email === email
    ) ?? null;
  }

  async save(user: User): Promise<User> {
    // Simulate unique constraint
    const existing = await this.findByEmail(user.email);
    if (existing && existing.id !== user.id) {
      throw new Error(`Unique constraint: email ${user.email} already exists`);
    }

    if (!user.id) {
      user.id = `user_${++this.counter}`;
    }
    this.users.set(user.id, { ...user });
    return { ...user };
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  async findAll(opts: { page: number; limit: number }): Promise<{
    data: User[];
    total: number;
  }> {
    const all = Array.from(this.users.values());
    const start = (opts.page - 1) * opts.limit;
    return {
      data: all.slice(start, start + opts.limit),
      total: all.length,
    };
  }

  // Test helper — not part of interface
  clear(): void {
    this.users.clear();
    this.counter = 0;
  }
}
```

```go
// Go — In-Memory Repository Fake
package repository

import (
    "context"
    "fmt"
    "sync"
)

type InMemoryUserRepo struct {
    mu      sync.RWMutex
    users   map[string]*User
    counter int
}

func NewInMemoryUserRepo() *InMemoryUserRepo {
    return &InMemoryUserRepo{
        users: make(map[string]*User),
    }
}

func (r *InMemoryUserRepo) FindByID(_ context.Context, id string) (*User, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    u, ok := r.users[id]
    if !ok {
        return nil, nil
    }
    clone := *u
    return &clone, nil
}

func (r *InMemoryUserRepo) Save(_ context.Context, user *User) error {
    r.mu.Lock()
    defer r.mu.Unlock()

    // Check unique email
    for _, u := range r.users {
        if u.Email == user.Email && u.ID != user.ID {
            return fmt.Errorf("unique constraint: email %s", user.Email)
        }
    }

    if user.ID == "" {
        r.counter++
        user.ID = fmt.Sprintf("user_%d", r.counter)
    }

    clone := *user
    r.users[user.ID] = &clone
    return nil
}

func (r *InMemoryUserRepo) Clear() {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.users = make(map[string]*User)
    r.counter = 0
}
```

---

## Time Mocking

```typescript
// TypeScript — Mocking time
import { vi, afterEach } from "vitest";

describe("TokenService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should expire token after TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const token = tokenService.create("user_123", { ttlSeconds: 3600 });

    // Still valid
    expect(tokenService.isValid(token)).toBe(true);

    // Advance 59 minutes — still valid
    vi.advanceTimersByTime(59 * 60 * 1000);
    expect(tokenService.isValid(token)).toBe(true);

    // Advance to 61 minutes — expired
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(tokenService.isValid(token)).toBe(false);
  });
});
```

```go
// Go — Clock interface for time mocking
package service

import "time"

type Clock interface {
    Now() time.Time
}

type RealClock struct{}
func (RealClock) Now() time.Time { return time.Now() }

type MockClock struct {
    CurrentTime time.Time
}
func (m *MockClock) Now() time.Time { return m.CurrentTime }
func (m *MockClock) Advance(d time.Duration) { m.CurrentTime = m.CurrentTime.Add(d) }

// Usage
type TokenService struct {
    clock Clock
}

func (s *TokenService) IsExpired(token Token) bool {
    return s.clock.Now().After(token.ExpiresAt)
}

// Test
func TestTokenExpiry(t *testing.T) {
    clock := &MockClock{CurrentTime: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)}
    svc := &TokenService{clock: clock}

    token := Token{ExpiresAt: clock.Now().Add(time.Hour)}

    if svc.IsExpired(token) {
        t.Error("token should not be expired yet")
    }

    clock.Advance(2 * time.Hour)

    if !svc.IsExpired(token) {
        t.Error("token should be expired")
    }
}
```

---

## What to Mock vs What NOT to Mock

### MOCK These (External Dependencies)

| Dependency | Why Mock | Tool |
|-----------|-----------|------|
| Database (unit tests) | Speed, isolation | Manual stubs, fakes |
| External HTTP APIs | Unreliable, slow, costly | MSW, httptest, responses |
| Message queues | Complex setup | In-memory fake |
| Email/SMS services | Side effects | Mock, verify call args |
| File system | State pollution | Virtual FS, temp dirs |
| Clock/Time | Non-deterministic | Fake clock |
| Random generators | Non-deterministic | Fixed seed / mock |

### NEVER Mock These

| Component | Why NOT Mock | What to Do |
|-----------|----------------|-----------|
| Your own code | Tests your mocks, not code | Test real implementation |
| Data structures | No I/O, deterministic | Use directly |
| Pure functions | No side effects | Call directly |
| Value objects | Immutable, testable | Use real instances |
| Database (integration tests) | Need to verify SQL/queries | Testcontainers |
| Third-party library internals | Coupling to implementation | Wrap in interface, mock wrapper |

---

## Best Practices

1. **ALWAYS mock at boundaries** — interfaces, not concrete classes
2. **ALWAYS verify interactions that MATTER** — email sent, event published
3. **ALWAYS use type-safe mocks** — catch errors at compile/type-check time
4. **ALWAYS reset mocks between tests** — `vi.clearAllMocks()`, fresh instances
5. **ALWAYS prefer stubs over mocks** — return values > interaction verification
6. **ALWAYS prefer fakes for complex dependencies** — in-memory repo > stub with many methods
7. **NEVER mock what you don't own** — wrap third-party code in adapter, mock adapter
8. **NEVER mock data structures** — use real objects
9. **NEVER assert on mock implementation details** — call count is OK, internal state is not
10. **NEVER create mock chains** — `mock.getA().getB().getC()` = coupling hell

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Mocking everything | Tests pass but code breaks | Mock only external boundaries |
| Testing mock behavior | `expect(mock).toHaveBeenCalled()` without behavior check | Assert on result + key interactions |
| Mock return mock | `mock.getService().getRepo().find()` | Inject flat dependencies |
| Brittle verification | Tests break on innocent refactors | Verify results, not every call |
| Shared mock instances | State leaks between tests | Fresh mocks in beforeEach |
| Mocking concrete classes | Coupling to implementation | Define and mock interfaces |
| No error path mocks | Happy path tested, errors untested | Mock exceptions/rejections |
| Complex mock setup | 30 lines of setup per test | Extract factories/builders |
| Forgetting async in mocks | `mockResolvedValue` vs `mockReturnValue` | Match sync/async correctly |
| Not resetting mocks | Previous test affects next | `clearAllMocks()` in beforeEach |

---

## Real-world Examples

### Stripe SDK Testing
- Provides official mock server (`stripe-mock`)
- OpenAPI spec-driven response generation
- No need to hit real API during development
- Community: MSW handlers for Stripe endpoints

### AWS SDK Mocking
- `aws-sdk-client-mock` for AWS SDK v3
- Mock individual service operations
- Verify request parameters
- Simulate errors (throttling, permissions)

### Google Cloud Client Libraries
- Emulators for Pub/Sub, Datastore, Firestore, Bigtable
- `PUBSUB_EMULATOR_HOST` environment variable
- Real API behavior without cloud costs
- Used in CI/CD pipelines
