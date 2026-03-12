# Test Patterns and Strategies

> **Domain:** Fundamentals > Clean Code > Testing
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Test patterns are established approaches for organizing and structuring tests. They address questions like: how many of each type of test? How to create test data? How to structure test code?

### The Test Pyramid (Mike Cohn, 2009)

```
        /  E2E   \        ← Few: slow, expensive, brittle
       / Integration\     ← Moderate: cross-module verification
      /  Unit Tests   \   ← Many: fast, cheap, focused
```

**Unit tests** form the base: fast, numerous, testing individual functions. **Integration tests** verify modules work together. **E2E tests** verify the whole system from the user's perspective.

### The Testing Trophy (Kent C. Dodds)

An alternative emphasizing **integration tests** over unit tests for frontend:
```
        /  E2E   \
       / Integration\     ← Most tests here (for UI)
      /    Unit      \
     /  Static Types  \   ← TypeScript catches many bugs for free
```

## How It Works

### Test Doubles

| Type | Purpose | Example |
|------|---------|---------|
| **Dummy** | Fill a required parameter | Empty object passed but never used |
| **Stub** | Return canned answers | `getUser()` always returns `{ name: 'Test' }` |
| **Spy** | Record calls for verification | Track that `sendEmail()` was called |
| **Mock** | Verify behavior and interactions | Assert `save()` called with correct data |
| **Fake** | Working simplified implementation | In-memory database instead of PostgreSQL |

### Test Data Patterns

**Object Mother:** A factory that creates common test objects.
```typescript
class TestUsers {
  static premiumCustomer(): User {
    return new User({ name: 'Alice', tier: 'premium', active: true });
  }
  static newUser(): User {
    return new User({ name: 'Bob', tier: 'free', active: true });
  }
}
```

**Test Data Builder:** Fluent API for creating test data with overrides.
```typescript
const order = new OrderBuilder()
  .withCustomer(TestUsers.premiumCustomer())
  .withItem({ product: 'Widget', qty: 3 })
  .withShipping('express')
  .build();
```

### Property-Based Testing

Instead of testing specific cases, test that properties hold for random inputs:
```typescript
// Hypothesis: sorting is idempotent
fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
  const sorted = [...arr].sort();
  const doubleSorted = [...sorted].sort();
  expect(sorted).toEqual(doubleSorted);
}));
```

## Best Practices

1. **Follow the test pyramid.** Many unit tests, fewer integration, fewest E2E.
2. **Use the right test double.** Stubs for isolating, mocks for verifying interactions, fakes for complex dependencies.
3. **Use builders for complex test data.** Avoid magic numbers and unclear object construction.
4. **Name tests descriptively** so failures are self-explanatory.
5. **Keep tests independent.** No shared state, no execution order dependencies.

## Anti-patterns / Common Mistakes

- **Ice Cream Cone:** Inverted pyramid — mostly E2E tests that are slow and brittle.
- **Testing implementation details:** Tests that break when refactoring without behavior change.
- **Mystery Guest:** Test depends on external data (file, DB row) that isn't visible in the test code.
- **Slow Tests:** Tests that take minutes instead of seconds — developers stop running them.

## Sources

- Cohn, M. (2009). *Succeeding with Agile*. Test Pyramid.
- Meszaros, G. (2007). *xUnit Test Patterns*. Addison-Wesley.
- [The Practical Test Pyramid (martinfowler.com)](https://martinfowler.com/articles/practical-test-pyramid.html)
