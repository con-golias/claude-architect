# Unit Testing

> **Domain:** Backend > Testing
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Unit tests form the foundation of the testing pyramid. They run in milliseconds, detect bugs the moment code is written, and serve as living documentation. Without unit tests, every refactor is Russian roulette -- you do not know what breaks until it reaches production. Google reports that >80% of their bugs are caught at the unit test level. Proper unit test structure (arrange-act-assert, proper mocking, clear naming) makes the difference between a test suite that helps and a test suite that hinders.

---

## How It Works

### Testing Pyramid

```
            ┌──────────┐
            │   E2E    │  Slow, expensive, few
            │  Tests   │  (Browser, full stack)
            ├──────────┤
            │          │
        ┌───┤Integration├───┐  Medium speed, moderate count
        │   │  Tests   │   │  (DB, API, multi-component)
        │   ├──────────┤   │
        │   │          │   │
    ┌───┤   │  Unit    │   ├───┐  Fast, cheap, many
    │   │   │  Tests   │   │   │  (Single function/class)
    │   │   │          │   │   │
    └───┴───┴──────────┴───┴───┘
```

**Unit tests** = 70-80% of all tests. Each tests ONE unit in isolation.

### Arrange-Act-Assert Pattern

```typescript
// TypeScript — AAA Pattern with Jest/Vitest
import { describe, it, expect } from "vitest";
import { PriceCalculator } from "./price-calculator";

describe("PriceCalculator", () => {
  describe("calculateTotal", () => {
    it("should apply percentage discount to subtotal", () => {
      // Arrange
      const calculator = new PriceCalculator();
      const items = [
        { name: "Widget", price: 1000, quantity: 2 },
        { name: "Gadget", price: 2500, quantity: 1 },
      ];
      const discount = { type: "percentage" as const, value: 10 };

      // Act
      const result = calculator.calculateTotal(items, discount);

      // Assert
      expect(result).toEqual({
        subtotal: 4500,   // (1000*2) + (2500*1)
        discount: 450,    // 10% of 4500
        total: 4050,
        currency: "EUR",
      });
    });

    it("should not allow negative totals", () => {
      const calculator = new PriceCalculator();
      const items = [{ name: "Widget", price: 100, quantity: 1 }];
      const discount = { type: "fixed" as const, value: 500 };

      const result = calculator.calculateTotal(items, discount);

      expect(result.total).toBe(0); // Never negative
    });

    it("should throw for empty items array", () => {
      const calculator = new PriceCalculator();

      expect(() => calculator.calculateTotal([], null)).toThrow(
        "Items array cannot be empty"
      );
    });
  });
});
```

```go
// Go — Table-Driven Tests
package pricing_test

import (
    "testing"

    "myapp/pricing"
)

func TestCalculateTotal(t *testing.T) {
    tests := []struct {
        name     string
        items    []pricing.Item
        discount *pricing.Discount
        want     pricing.Total
        wantErr  bool
    }{
        {
            name: "percentage discount applied to subtotal",
            items: []pricing.Item{
                {Name: "Widget", Price: 1000, Quantity: 2},
                {Name: "Gadget", Price: 2500, Quantity: 1},
            },
            discount: &pricing.Discount{Type: "percentage", Value: 10},
            want: pricing.Total{
                Subtotal: 4500,
                Discount: 450,
                Total:    4050,
                Currency: "EUR",
            },
        },
        {
            name: "negative total clamped to zero",
            items: []pricing.Item{
                {Name: "Widget", Price: 100, Quantity: 1},
            },
            discount: &pricing.Discount{Type: "fixed", Value: 500},
            want: pricing.Total{
                Subtotal: 100,
                Discount: 100,
                Total:    0,
                Currency: "EUR",
            },
        },
        {
            name:    "empty items returns error",
            items:   []pricing.Item{},
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            calc := pricing.NewCalculator()

            got, err := calc.CalculateTotal(tt.items, tt.discount)

            if tt.wantErr {
                if err == nil {
                    t.Fatal("expected error, got nil")
                }
                return
            }

            if err != nil {
                t.Fatalf("unexpected error: %v", err)
            }

            if got != tt.want {
                t.Errorf("got %+v, want %+v", got, tt.want)
            }
        })
    }
}
```

```python
# Python — pytest with Parametrize
import pytest
from pricing import PriceCalculator, Item, Discount

class TestCalculateTotal:
    def test_percentage_discount(self):
        # Arrange
        calc = PriceCalculator()
        items = [
            Item(name="Widget", price=1000, quantity=2),
            Item(name="Gadget", price=2500, quantity=1),
        ]
        discount = Discount(type="percentage", value=10)

        # Act
        result = calc.calculate_total(items, discount)

        # Assert
        assert result.subtotal == 4500
        assert result.discount == 450
        assert result.total == 4050

    def test_negative_total_clamped_to_zero(self):
        calc = PriceCalculator()
        items = [Item(name="Widget", price=100, quantity=1)]
        discount = Discount(type="fixed", value=500)

        result = calc.calculate_total(items, discount)

        assert result.total == 0

    def test_empty_items_raises(self):
        calc = PriceCalculator()

        with pytest.raises(ValueError, match="Items.*cannot be empty"):
            calc.calculate_total([], None)

    @pytest.mark.parametrize(
        "discount_type,discount_value,expected_total",
        [
            ("percentage", 0, 4500),
            ("percentage", 50, 2250),
            ("percentage", 100, 0),
            ("fixed", 500, 4000),
            ("fixed", 10000, 0),
        ],
    )
    def test_discount_variations(
        self, discount_type, discount_value, expected_total
    ):
        calc = PriceCalculator()
        items = [
            Item(name="Widget", price=1000, quantity=2),
            Item(name="Gadget", price=2500, quantity=1),
        ]
        discount = Discount(type=discount_type, value=discount_value)

        result = calc.calculate_total(items, discount)

        assert result.total == expected_total
```

---

## Mocking & Test Doubles

### Types of Test Doubles

| Type | What It Does | When |
|------|----------|------|
| **Stub** | Returns fixed values | Replacing external calls |
| **Mock** | Verifies it was called correctly | Verify interaction (email sent, event published) |
| **Spy** | Real implementation + recording | Observe without changing behavior |
| **Fake** | Working alternative (in-memory DB) | Fast integration-like test |
| **Dummy** | Placeholder, never used | Filling required parameters |

### Dependency Injection for Testability

```typescript
// TypeScript — Interface-based DI
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

interface EmailService {
  sendWelcome(email: string, name: string): Promise<void>;
}

class UserService {
  constructor(
    private userRepo: UserRepository,
    private emailService: EmailService
  ) {}

  async register(email: string, name: string): Promise<User> {
    const existing = await this.userRepo.findById(email);
    if (existing) {
      throw new Error("User already exists");
    }

    const user: User = {
      id: generateId(),
      email,
      name,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);
    await this.emailService.sendWelcome(email, name);

    return user;
  }
}

// Test with mocks
describe("UserService.register", () => {
  it("should save user and send welcome email", async () => {
    // Stubs
    const userRepo: UserRepository = {
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const emailService: EmailService = {
      sendWelcome: vi.fn().mockResolvedValue(undefined),
    };

    const service = new UserService(userRepo, emailService);

    const user = await service.register("john@example.com", "John");

    // Verify user saved
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "john@example.com",
        name: "John",
      })
    );

    // Verify email sent
    expect(emailService.sendWelcome).toHaveBeenCalledWith(
      "john@example.com",
      "John"
    );

    expect(user.email).toBe("john@example.com");
  });

  it("should throw if user already exists", async () => {
    const userRepo: UserRepository = {
      findById: vi.fn().mockResolvedValue({ id: "existing" }),
      save: vi.fn(),
    };
    const emailService: EmailService = {
      sendWelcome: vi.fn(),
    };

    const service = new UserService(userRepo, emailService);

    await expect(
      service.register("john@example.com", "John")
    ).rejects.toThrow("User already exists");

    // Verify save was NOT called
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(emailService.sendWelcome).not.toHaveBeenCalled();
  });
});
```

```go
// Go — Interface-based DI
package user

import (
    "context"
    "errors"
)

type UserRepository interface {
    FindByEmail(ctx context.Context, email string) (*User, error)
    Save(ctx context.Context, user *User) error
}

type EmailService interface {
    SendWelcome(ctx context.Context, email, name string) error
}

type Service struct {
    repo  UserRepository
    email EmailService
}

func NewService(repo UserRepository, email EmailService) *Service {
    return &Service{repo: repo, email: email}
}

func (s *Service) Register(ctx context.Context, email, name string) (*User, error) {
    existing, err := s.repo.FindByEmail(ctx, email)
    if err != nil {
        return nil, err
    }
    if existing != nil {
        return nil, errors.New("user already exists")
    }

    user := &User{ID: generateID(), Email: email, Name: name}
    if err := s.repo.Save(ctx, user); err != nil {
        return nil, err
    }
    if err := s.email.SendWelcome(ctx, email, name); err != nil {
        return nil, err
    }
    return user, nil
}

// Test file
package user_test

import (
    "context"
    "testing"

    "myapp/user"
)

// Mock implementations
type mockRepo struct {
    findResult *user.User
    findErr    error
    saveCalled bool
    savedUser  *user.User
}

func (m *mockRepo) FindByEmail(_ context.Context, _ string) (*user.User, error) {
    return m.findResult, m.findErr
}

func (m *mockRepo) Save(_ context.Context, u *user.User) error {
    m.saveCalled = true
    m.savedUser = u
    return nil
}

type mockEmail struct {
    sendCalled bool
    sentTo     string
}

func (m *mockEmail) SendWelcome(_ context.Context, email, _ string) error {
    m.sendCalled = true
    m.sentTo = email
    return nil
}

func TestRegister_Success(t *testing.T) {
    repo := &mockRepo{findResult: nil}
    email := &mockEmail{}
    svc := user.NewService(repo, email)

    u, err := svc.Register(context.Background(), "john@example.com", "John")

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if u.Email != "john@example.com" {
        t.Errorf("email = %q, want john@example.com", u.Email)
    }
    if !repo.saveCalled {
        t.Error("Save not called")
    }
    if !email.sendCalled {
        t.Error("SendWelcome not called")
    }
}

func TestRegister_AlreadyExists(t *testing.T) {
    repo := &mockRepo{findResult: &user.User{ID: "existing"}}
    emailSvc := &mockEmail{}
    svc := user.NewService(repo, emailSvc)

    _, err := svc.Register(context.Background(), "john@example.com", "John")

    if err == nil {
        t.Fatal("expected error")
    }
    if repo.saveCalled {
        t.Error("Save should not be called")
    }
    if emailSvc.sendCalled {
        t.Error("SendWelcome should not be called")
    }
}
```

```python
# Python — pytest with unittest.mock
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from user_service import UserService

@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    repo.find_by_email = AsyncMock(return_value=None)
    repo.save = AsyncMock()
    return repo

@pytest.fixture
def mock_email():
    return AsyncMock()

@pytest.fixture
def service(mock_repo, mock_email):
    return UserService(repo=mock_repo, email_service=mock_email)

class TestRegister:
    async def test_saves_user_and_sends_email(
        self, service, mock_repo, mock_email
    ):
        user = await service.register("john@example.com", "John")

        assert user.email == "john@example.com"
        mock_repo.save.assert_called_once()
        mock_email.send_welcome.assert_called_once_with(
            "john@example.com", "John"
        )

    async def test_rejects_existing_user(
        self, service, mock_repo, mock_email
    ):
        mock_repo.find_by_email.return_value = MagicMock(id="existing")

        with pytest.raises(ValueError, match="already exists"):
            await service.register("john@example.com", "John")

        mock_repo.save.assert_not_called()
        mock_email.send_welcome.assert_not_called()
```

---

## Test Naming Conventions

| Framework | Convention | Example |
|-----------|-----------|------------|
| **Jest/Vitest** | `describe("Class")` → `it("should verb when condition")` | `it("should reject negative amounts")` |
| **Go** | `TestMethodName_Scenario` | `TestCalculateTotal_EmptyItems` |
| **pytest** | `test_method_scenario_expected` | `test_register_existing_email_raises` |
| **JUnit** | `methodName_scenario_expectedResult` | `calculateTotal_emptyItems_throwsException` |

**Rule:** Test name MUST describe: what is being tested, what condition, what is expected.

---

## Edge Cases & Boundary Testing

```typescript
// TypeScript — Boundary Tests
describe("validateAge", () => {
  // Boundary values
  it("should reject age -1 (below minimum)", () => {
    expect(validateAge(-1)).toBe(false);
  });

  it("should reject age 0 (boundary)", () => {
    expect(validateAge(0)).toBe(false);
  });

  it("should accept age 1 (minimum valid)", () => {
    expect(validateAge(1)).toBe(true);
  });

  it("should accept age 150 (maximum valid)", () => {
    expect(validateAge(150)).toBe(true);
  });

  it("should reject age 151 (above maximum)", () => {
    expect(validateAge(151)).toBe(false);
  });

  // Special values
  it("should reject NaN", () => {
    expect(validateAge(NaN)).toBe(false);
  });

  it("should reject Infinity", () => {
    expect(validateAge(Infinity)).toBe(false);
  });

  it("should reject floating point", () => {
    expect(validateAge(25.5)).toBe(false);
  });
});
```

---

## Test Isolation

### NEVER share state between tests

```typescript
// ❌ BAD — Shared mutable state
let counter = 0;

describe("Counter", () => {
  it("increments", () => {
    counter++;
    expect(counter).toBe(1);
  });

  it("also increments", () => {
    counter++;
    expect(counter).toBe(1); // FAILS — counter is 2
  });
});

// ✅ GOOD — Fresh state per test
describe("Counter", () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter(); // Fresh instance
  });

  it("increments from zero", () => {
    counter.increment();
    expect(counter.value).toBe(1);
  });

  it("also increments from zero", () => {
    counter.increment();
    expect(counter.value).toBe(1); // ✓ Works
  });
});
```

---

## Best Practices

1. **ALWAYS follow AAA pattern** -- Arrange, Act, Assert in every test
2. **ALWAYS test ONE thing per test** -- one assert concept (can have multiple expects)
3. **ALWAYS use descriptive test names** — should + verb + condition
4. **ALWAYS test edge cases** — null, empty, boundary values, special characters
5. **ALWAYS use dependency injection** -- interfaces for testability
6. **ALWAYS keep tests fast** — unit test suite < 30 seconds
7. **NEVER test implementation details** — test behavior, not private methods
8. **NEVER share mutable state** — fresh setup per test (beforeEach)
9. **NEVER mock what you don't own** — wrap third-party libs in interfaces, mock the wrapper
10. **NEVER write tests that always pass** — verify test fails when expected

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Testing implementation | Tests break on refactor | Test public behavior, not internals |
| Shared test state | Flaky tests, order-dependent | beforeEach with fresh state |
| Too many mocks | Test tests mocks, not code | Mock only external dependencies |
| Giant test methods | Hard to understand failures | One concept per test, clear naming |
| No edge case tests | Bugs in boundary conditions | Parametrize with edge values |
| Testing trivial code | Low ROI, maintenance cost | Test logic, not getters/setters |
| Copy-paste tests | DRY violation, maintenance | Extract test helpers, parametrize |
| Flaky assertions | Random failures | Deterministic data, fixed seeds |
| No test for error paths | Error handling untested | Test throws, rejects, error returns |
| Asserting on `console.log` | Fragile, impl-coupled | Return values, not side effects |

---

## Real-world Examples

### Google Testing Practices
- 80% unit tests, 15% integration, 5% E2E
- Tests run on every commit (TAP system)
- "Test Certified" levels (1-5) for team maturity
- Mandatory for code review approval

### Stripe Testing
- Every API endpoint has >50 unit tests
- Edge case matrix for payment calculations
- Property-based testing for monetary arithmetic
- Tests run in <2 minutes for full suite

### Netflix
- Chaos engineering starts with solid unit tests
- Tests as documentation — business rules encoded
- Focus on testing error paths and resilience
