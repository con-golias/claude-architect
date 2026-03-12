# Clean Code and Concurrency

> **Domain:** Fundamentals > Clean Code > Advanced
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Concurrency — executing multiple tasks simultaneously — is one of the hardest aspects of software development. Robert C. Martin dedicates Chapter 13 of *Clean Code* to concurrency with this warning:

> "Concurrency is hard. Very hard. If you aren't very careful, you can create some very nasty situations."

Clean concurrency means: separating concurrency logic from business logic, minimizing shared state, using immutable data, and designing for thread safety from the start.

## Why It Matters

Concurrency bugs (race conditions, deadlocks, data corruption) are among the hardest to reproduce and debug. They may appear once in a million executions, making them nearly invisible in testing but devastating in production.

## How It Works

### The Core Problem: Shared Mutable State

```typescript
// BAD: Race condition — two threads modifying shared state
let counter = 0;
async function incrementCounter() {
  const current = counter;    // Thread 1 reads 0
  // Thread 2 reads 0 here too!
  counter = current + 1;      // Both threads write 1
  // Expected: 2, Got: 1
}
```

### Solution 1: Immutability

```typescript
// GOOD: Immutable data eliminates race conditions
function addItem(cart: ReadonlyArray<Item>, item: Item): ReadonlyArray<Item> {
  return [...cart, item]; // New array, original untouched
}
```

### Solution 2: async/await (Modern JavaScript/Python)

```typescript
// GOOD: Sequential async operations — no shared state issues
async function processOrders(orderIds: string[]): Promise<Result[]> {
  const results: Result[] = [];
  for (const id of orderIds) {
    const result = await processOrder(id); // Sequential, safe
    results.push(result);
  }
  return results;
}

// Or parallel with Promise.all (safe because each is independent):
async function processOrders(orderIds: string[]): Promise<Result[]> {
  return Promise.all(orderIds.map(id => processOrder(id)));
}
```

### Solution 3: Separate Concurrency from Business Logic

```python
# GOOD: Business logic is pure and synchronous
class PricingEngine:
    def calculate(self, items: list[Item]) -> Money:
        return sum(item.price * item.quantity for item in items)

# Concurrency wrapper handles the async concerns
async def process_orders_concurrently(orders: list[Order]) -> list[Result]:
    pricing = PricingEngine()  # Stateless, safe to share
    tasks = [process_single(order, pricing) for order in orders]
    return await asyncio.gather(*tasks)
```

### Key Concurrency Patterns

- **Producer-Consumer:** Decouples data production from consumption via a queue.
- **Reader-Writer Lock:** Multiple readers OR one writer — not both.
- **Actor Model (Akka, Erlang):** Each actor processes messages sequentially — no shared state.
- **CSP (Go channels):** "Don't communicate by sharing memory; share memory by communicating."

## Best Practices

1. **Keep concurrency code separate** from business logic. SRP applies.
2. **Prefer immutable data.** If data can't change, it can't have race conditions.
3. **Minimize shared state.** Each thread/task should own its data.
4. **Use language-level concurrency primitives** — `async/await`, Go channels, Rust's ownership system.
5. **Test concurrency code** with stress tests and race condition detectors (Go's `-race` flag, Java's Thread Sanitizer).

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapter 13: Concurrency.
- Goetz, B. (2006). *Java Concurrency in Practice*. Addison-Wesley.
- [Concurrency and Immutability (InfoQ)](https://www.infoq.com/articles/dhanji-prasanna-concurrency/)
