# Functional Programming

> **Domain:** Fundamentals > Programming Paradigms > Functional
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Functional Programming (FP) treats computation as the **evaluation of mathematical functions**, avoiding mutable state and side effects. Programs are built by composing pure functions — given the same input, they always produce the same output without observable side effects. FP emphasizes **what** to compute rather than **how** to compute it step by step.

**Origin:** Based on Alonzo Church's lambda calculus (1930s). Lisp (1958) was the first FP language. ML (1973), Haskell (1990), and Erlang (1986) are pure or predominantly functional. Modern languages (JavaScript, Python, Rust, Kotlin) adopt FP features extensively.

## How It Works

```haskell
-- Haskell — pure functional language
-- Functions are first-class, data is immutable by default

-- Pure function: same input → same output, no side effects
double :: Int -> Int
double x = x * 2

-- Function composition with (.)
processName :: String -> String
processName = map toUpper . filter (/= ' ') . trim

-- Pattern matching
fibonacci :: Int -> Int
fibonacci 0 = 0
fibonacci 1 = 1
fibonacci n = fibonacci (n - 1) + fibonacci (n - 2)

-- List comprehension
pythagorean :: Int -> [(Int, Int, Int)]
pythagorean n = [(a, b, c) | c <- [1..n], b <- [1..c], a <- [1..b],
                              a*a + b*b == c*c]
```

```typescript
// TypeScript — functional style in a multi-paradigm language

// Data transformation pipeline
const processOrders = (orders: Order[]): Summary => {
  return orders
    .filter(o => o.status === "completed")          // select
    .map(o => ({ ...o, total: o.items.reduce(     // transform
      (sum, item) => sum + item.price * item.qty, 0
    )}))
    .sort((a, b) => b.total - a.total)              // order
    .reduce((summary, order) => ({                  // aggregate
      count: summary.count + 1,
      revenue: summary.revenue + order.total,
      avgOrder: 0,
    }), { count: 0, revenue: 0, avgOrder: 0 });
};

// Function composition
const pipe = <T>(...fns: ((arg: T) => T)[]) =>
  (value: T): T => fns.reduce((acc, fn) => fn(acc), value);

const processText = pipe(
  (s: string) => s.trim(),
  (s: string) => s.toLowerCase(),
  (s: string) => s.replace(/\s+/g, "-"),
);

processText("  Hello World  ");  // "hello-world"
```

```python
# Python — functional features
from functools import reduce, lru_cache
from itertools import groupby
from operator import itemgetter

# Map, filter, reduce
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
evens = list(filter(lambda x: x % 2 == 0, numbers))         # [2,4,6,8,10]
doubled = list(map(lambda x: x * 2, evens))                  # [4,8,12,16,20]
total = reduce(lambda acc, x: acc + x, doubled, 0)           # 60

# Memoization (caching pure function results)
@lru_cache(maxsize=None)
def fibonacci(n: int) -> int:
    if n < 2: return n
    return fibonacci(n - 1) + fibonacci(n - 2)

fibonacci(100)  # instant — cached intermediate results
```

### FP vs OOP

```
                    Functional              Object-Oriented
──────────────────────────────────────────────────────────────
Primary unit        Function                Object (class)
State               Immutable               Mutable (encapsulated)
Data flow           Data transformation     Message passing
Reuse               Function composition    Inheritance / composition
Side effects        Minimized / isolated    Encapsulated
Concurrency         Easy (no shared state)  Requires synchronization
Best for            Data pipelines          Domain modeling
```

## Real-world Examples

- **React** — functional components, hooks, immutable state updates.
- **Redux** — pure reducers, immutable state, action→state transformations.
- **Apache Spark** — distributed data processing with map/filter/reduce.
- **Erlang/Elixir** — WhatsApp, Discord backend built on functional concurrency.
- **Unix pipes** — `cat file | grep "error" | sort | uniq -c` — function composition.
- **Lodash/Ramda** — functional utility libraries for JavaScript.

## Sources

- Hughes, J. (1989). "Why Functional Programming Matters." *The Computer Journal*, 32(2).
- Church, A. (1936). "An Unsolvable Problem of Elementary Number Theory." *American Journal of Mathematics*, 58(2).
- [Haskell Wiki — Functional Programming](https://wiki.haskell.org/Functional_programming)
