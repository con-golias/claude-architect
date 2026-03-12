# Unit Testing

> **Domain:** Fundamentals > Clean Code > Testing
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Unit testing is the practice of testing individual units of code (functions, methods, classes) in isolation. Robert C. Martin's Chapter 9 of *Clean Code* — "Unit Tests" — establishes that **test code is as important as production code**.

### FIRST Principles (Robert C. Martin)

| Principle | Meaning |
|-----------|---------|
| **Fast** | Tests should run in milliseconds. Slow tests don't get run. |
| **Independent** | Tests should not depend on each other or on execution order. |
| **Repeatable** | Tests should produce the same result in any environment. |
| **Self-validating** | Tests should have a boolean output — pass or fail. No manual inspection. |
| **Timely** | Tests should be written just before the production code (TDD). |

### Test Structure: Arrange-Act-Assert (AAA)

```typescript
describe('PricingEngine', () => {
  it('should apply 15% discount for premium customers', () => {
    // Arrange
    const engine = new PricingEngine();
    const customer = new Customer({ tier: 'premium' });
    const items = [new Item({ price: 100 })];

    // Act
    const total = engine.calculate(items, customer);

    // Assert
    expect(total).toBe(85);
  });
});
```

## Why It Matters

- A bug caught by a unit test costs **$1** to fix. In integration testing: **$10**. In production: **$1000+**.
- Tests are **living documentation** — they show exactly how code is meant to be used.
- Tests enable **fearless refactoring** — change code with confidence that behavior is preserved.

## How It Works

### What Makes a Good Unit Test

```python
# GOOD: Clear name, focused assertion, no external dependencies
def test_calculate_shipping_returns_zero_for_digital_products():
    product = Product(type=ProductType.DIGITAL, price=29.99)
    shipping = calculate_shipping(product)
    assert shipping == 0.0

# BAD: Vague name, multiple assertions, tests implementation details
def test_order():
    order = Order()
    order.add(Product("book", 10))
    order.add(Product("pen", 5))
    assert len(order.items) == 2           # Testing internals
    assert order.items[0].name == "book"   # Testing internals
    assert order.total == 15               # Actual behavior
    assert order.tax == 3                  # Unrelated concern
```

### Test Naming Conventions

```typescript
// Pattern: methodName_scenario_expectedBehavior
it('calculateDiscount_premiumCustomerOver100_returns15Percent')
it('calculateDiscount_regularCustomer_returnsZero')

// BDD style: should_X_when_Y
it('should return 15% discount when customer is premium and total exceeds $100')
it('should return zero discount when customer is regular')
```

### Mocking vs. Stubbing

```typescript
// Stub: Provides canned answers (no verification)
const userRepo = { findById: jest.fn().mockReturnValue(mockUser) };

// Mock: Also verifies interactions
const emailService = { sendWelcome: jest.fn() };
registerUser(userData);
expect(emailService.sendWelcome).toHaveBeenCalledWith(mockUser.email);
```

### Test Coverage

Coverage measures how much code is exercised by tests. **Line coverage** is common but insufficient. **Branch coverage** catches missed conditions. **Mutation testing** (Stryker, PIT) is the gold standard — it introduces bugs and checks if tests catch them.

Target: **80% line coverage** is a reasonable minimum. 100% is often not worth the effort.

## Best Practices

1. **One concept per test.** Each test should verify one behavior.
2. **Test behavior, not implementation.** Don't test private methods or internal state.
3. **Use descriptive test names** that explain the scenario and expected outcome.
4. **Keep tests independent.** No shared mutable state between tests.
5. **Make tests readable.** Test code should be clean code too.
6. **Don't test trivial code.** Getters, setters, and framework-generated code don't need tests.

## Anti-patterns / Common Mistakes

- **Assertion Roulette:** A test with many assertions where it's unclear which one failed.
- **Flaky Tests:** Tests that pass sometimes and fail sometimes. Always investigate the root cause.
- **Testing Implementation:** Tests that break when you refactor without changing behavior.
- **Ice Cream Cone:** More E2E tests than unit tests (inverted pyramid).

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapter 9: Unit Tests.
- Beck, K. (2002). *Test-Driven Development: By Example*. Addison-Wesley.
- [The Practical Test Pyramid (martinfowler.com)](https://martinfowler.com/articles/practical-test-pyramid.html)
