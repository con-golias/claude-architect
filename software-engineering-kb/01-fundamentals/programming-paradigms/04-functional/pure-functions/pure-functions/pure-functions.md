# Pure Functions

> **Domain:** Fundamentals > Programming Paradigms > Functional
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A pure function has two properties: (1) **deterministic** — given the same input, it always returns the same output, and (2) **no side effects** — it doesn't modify external state, perform I/O, or depend on anything other than its arguments. Pure functions are the foundation of functional programming and enable powerful optimizations like memoization, parallelization, and referential transparency.

## How It Works

```typescript
// PURE — same input always gives same output, no side effects
function add(a: number, b: number): number {
  return a + b;
}

function sortArray(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);  // returns new array, doesn't mutate input
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency}${amount.toFixed(2)}`;
}

// IMPURE — depends on external state or produces side effects
let taxRate = 0.1;  // external state
function calculateTax(amount: number): number {
  return amount * taxRate;  // IMPURE: depends on external variable
}

function logAndReturn(value: number): number {
  console.log(value);  // IMPURE: side effect (I/O)
  return value;
}

function addToArray(arr: number[], item: number): number[] {
  arr.push(item);  // IMPURE: mutates input
  return arr;
}

let counter = 0;
function increment(): number {
  return ++counter;  // IMPURE: modifies external state, different each call
}
```

### Referential Transparency

```typescript
// A pure expression can be replaced with its value without changing behavior
const x = add(3, 4);  // x = 7

// Everywhere add(3, 4) appears, we can substitute 7
const result = add(3, 4) * add(3, 4);   // = 7 * 7 = 49
const result2 = x * x;                   // identical — referentially transparent

// This FAILS with impure functions:
const y = Math.random();    // y = 0.42 (maybe)
// Math.random() * Math.random() ≠ y * y  (different random values each call)
```

### Managing Side Effects

```typescript
// Strategy: push side effects to the boundary, keep core logic pure

// Pure core — all business logic
function calculateDiscount(price: number, membership: string): number {
  switch (membership) {
    case "gold":     return price * 0.2;
    case "silver":   return price * 0.1;
    default:         return 0;
  }
}

function buildInvoice(items: Item[], membership: string): Invoice {
  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
  const discount = calculateDiscount(subtotal, membership);
  const tax = (subtotal - discount) * 0.08;
  return { items, subtotal, discount, tax, total: subtotal - discount + tax };
}

// Impure boundary — I/O happens here only
async function processOrder(orderId: string): Promise<void> {
  const order = await db.getOrder(orderId);       // impure: I/O
  const invoice = buildInvoice(order.items, order.membership);  // PURE
  await db.saveInvoice(invoice);                  // impure: I/O
  await emailService.send(order.email, invoice);  // impure: I/O
}
```

```python
# Python — pure functions enable easy testing and memoization
from functools import lru_cache

# Pure — trivially testable, cacheable
def levenshtein(s: str, t: str) -> int:
    if not s: return len(t)
    if not t: return len(s)
    if s[0] == t[0]:
        return levenshtein(s[1:], t[1:])
    return 1 + min(
        levenshtein(s[1:], t),      # delete
        levenshtein(s, t[1:]),      # insert
        levenshtein(s[1:], t[1:]),  # replace
    )

# With memoization — pure functions cache safely
@lru_cache(maxsize=None)
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

### Benefits of Pure Functions

```
Benefit              Why It Works
──────────────────────────────────────────────────
Testability          No setup/teardown, just assert(f(input) === output)
Memoization          Safe to cache — same input always gives same output
Parallelization      No shared state — safe to run on multiple threads
Debugging            Output depends only on input — easy to reproduce bugs
Refactoring          Can extract, inline, or reorder freely
Composition          Pure functions compose cleanly: f(g(x))
```

## Sources

- Hughes, J. (1989). "Why Functional Programming Matters." *The Computer Journal*.
- Elliott, C. (2009). "The Essence of Functional Programming." *Lambda the Ultimate*.
