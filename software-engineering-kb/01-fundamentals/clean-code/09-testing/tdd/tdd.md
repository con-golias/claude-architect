# Test-Driven Development (TDD)

> **Domain:** Fundamentals > Clean Code > Testing
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Test-Driven Development is a software development practice where you **write tests before writing production code**. Created by Kent Beck as part of Extreme Programming (XP), later popularized through his book *TDD By Example* (2002).

### The Red-Green-Refactor Cycle

1. **RED:** Write a failing test for the next small piece of functionality.
2. **GREEN:** Write the minimum code to make the test pass.
3. **REFACTOR:** Clean up the code while keeping tests green.

### Robert C. Martin's Three Laws of TDD

1. You may not write production code until you have written a failing unit test.
2. You may not write more of a unit test than is sufficient to fail (and not compiling counts as failing).
3. You may not write more production code than is sufficient to pass the currently failing test.

## Why It Matters

- **Better Design:** Writing tests first forces you to think about the interface before implementation, leading to more modular, loosely coupled code.
- **Living Documentation:** Tests describe exactly what the system does.
- **Confidence:** A comprehensive test suite enables fearless refactoring.
- **Fewer Bugs:** Studies show TDD reduces defect rates by **40-80%** (IBM, Microsoft research).

## How It Works

### TDD Example: Building a Stack

```typescript
// Step 1 (RED): Write a failing test
test('newly created stack is empty', () => {
  const stack = new Stack();
  expect(stack.isEmpty()).toBe(true);
});

// Step 2 (GREEN): Minimum code to pass
class Stack {
  isEmpty(): boolean { return true; }
}

// Step 3 (RED): Next test
test('stack is not empty after push', () => {
  const stack = new Stack();
  stack.push(1);
  expect(stack.isEmpty()).toBe(false);
});

// Step 4 (GREEN): Add just enough code
class Stack {
  private items: number[] = [];
  isEmpty(): boolean { return this.items.length === 0; }
  push(item: number): void { this.items.push(item); }
}

// Continue the cycle for pop(), peek(), etc.
```

### Outside-In vs. Inside-Out TDD

**Inside-Out (Classic/Detroit):** Start with the innermost units and build outward. Good for algorithms and domain logic.

**Outside-In (London/Mockist):** Start with the outermost acceptance test and drive inward using mocks. Good for UI and integration flows.

## Best Practices

1. **Take baby steps.** Each cycle should take 1-5 minutes. If you're stuck for longer, your step is too big.
2. **Refactor on green.** Only refactor when all tests pass. The refactoring step is not optional.
3. **One test at a time.** Don't write multiple failing tests at once.
4. **Test the interface, not implementation.** Tests should survive refactoring.
5. **Start with the simplest cases** and progress to more complex ones.

## Anti-patterns / Common Mistakes

- **Skipping refactoring:** Red → Green → Red → Green without ever refactoring leads to messy code with tests.
- **Testing too much at once:** Writing a complex test that requires 50 lines of setup before any production code.
- **Abandoning TDD when it's "too slow."** The investment pays off in reduced debugging time.

## Real-world Examples

The DHH "TDD is dead" debate (2014) sparked widespread discussion. Ian Cooper's response clarified that TDD works best when testing behaviors, not implementations. Modern consensus: TDD is valuable but not dogmatic — use it where it adds value.

## Sources

- Beck, K. (2002). *TDD By Example*. Addison-Wesley.
- Martin, R.C. (2008). *Clean Code*. Chapter 9.
- [TDD Practical Guide 2025 (monday.com)](https://monday.com/blog/rnd/what-is-tdd/)
- [TDD Quick Guide (brainhub.eu)](https://brainhub.eu/library/test-driven-development-tdd)
