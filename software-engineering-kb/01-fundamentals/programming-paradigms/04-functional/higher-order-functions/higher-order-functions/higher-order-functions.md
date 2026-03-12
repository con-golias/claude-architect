# Higher-Order Functions

> **Domain:** Fundamentals > Programming Paradigms > Functional
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A higher-order function (HOF) is a function that **takes other functions as arguments** and/or **returns a function** as its result. HOFs are the building blocks of functional programming, enabling code reuse, abstraction, and composition. Languages with first-class functions (functions are values) naturally support HOFs.

## How It Works

### Functions as Arguments

```typescript
// map, filter, reduce — the holy trinity of FP
const users = [
  { name: "Alice", age: 28 },
  { name: "Bob", age: 35 },
  { name: "Carol", age: 22 },
];

// map: transform each element
const names = users.map(u => u.name);  // ["Alice", "Bob", "Carol"]

// filter: select elements matching a predicate
const seniors = users.filter(u => u.age >= 30);  // [Bob]

// reduce: aggregate into a single value
const totalAge = users.reduce((sum, u) => sum + u.age, 0);  // 85

// flatMap: map + flatten
const tags = [["js", "ts"], ["py"], ["go", "rust"]];
const allTags = tags.flatMap(t => t);  // ["js", "ts", "py", "go", "rust"]

// sort with comparator (HOF)
const byAge = [...users].sort((a, b) => a.age - b.age);
```

### Functions that Return Functions

```typescript
// Factory function — returns a configured function
function createMultiplier(factor: number): (n: number) => number {
  return (n: number) => n * factor;
}

const double = createMultiplier(2);
const triple = createMultiplier(3);
double(5);   // 10
triple(5);   // 15

// Middleware factory — Express.js pattern
function rateLimit(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number>();
  return (req: Request, res: Response, next: NextFunction) => {
    const count = (hits.get(req.ip) ?? 0) + 1;
    hits.set(req.ip, count);
    if (count > maxRequests) return res.status(429).send("Too many requests");
    next();
  };
}

app.use(rateLimit(100, 60_000));  // returns configured middleware function
```

### Function Composition

```typescript
// compose: right-to-left
const compose = <T>(...fns: ((x: T) => T)[]) =>
  (x: T): T => fns.reduceRight((acc, fn) => fn(acc), x);

// pipe: left-to-right (more readable)
const pipe = <T>(...fns: ((x: T) => T)[]) =>
  (x: T): T => fns.reduce((acc, fn) => fn(acc), x);

const processUsername = pipe(
  (s: string) => s.trim(),
  (s: string) => s.toLowerCase(),
  (s: string) => s.replace(/[^a-z0-9]/g, ""),
  (s: string) => s.slice(0, 20),
);

processUsername("  John_Doe!! ");  // "johndoe"
```

```python
# Python — higher-order functions
from functools import reduce, partial
from typing import Callable, TypeVar

T = TypeVar("T")

# Custom HOF — retry logic
def with_retry(fn: Callable, max_attempts: int = 3) -> Callable:
    def wrapper(*args, **kwargs):
        for attempt in range(max_attempts):
            try:
                return fn(*args, **kwargs)
            except Exception as e:
                if attempt == max_attempts - 1:
                    raise
    return wrapper

@with_retry
def fetch_data(url: str):
    return requests.get(url).json()

# partial application — fix some arguments
def power(base: int, exponent: int) -> int:
    return base ** exponent

square = partial(power, exponent=2)
cube = partial(power, exponent=3)
square(5)  # 25
cube(3)    # 27
```

### Common Higher-Order Functions

```
Function      Takes             Returns         Purpose
──────────────────────────────────────────────────────
map           (T → U)           U[]             Transform each element
filter        (T → bool)        T[]             Select matching elements
reduce        (Acc, T → Acc)    Acc             Aggregate to single value
flatMap       (T → U[])         U[]             Map + flatten
sort          (T, T → number)   T[]             Order with comparator
forEach       (T → void)        void            Side effect per element
find          (T → bool)        T | undefined   First match
every         (T → bool)        boolean         All match?
some          (T → bool)        boolean         Any match?
```

## Sources

- Abelson, H. & Sussman, G. (1996). *Structure and Interpretation of Computer Programs*. MIT Press. Chapter 1.
- Hutton, G. (2016). *Programming in Haskell*. 2nd ed. Cambridge University Press.
