# Closures and Currying

> **Domain:** Fundamentals > Programming Paradigms > Functional
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A **closure** is a function that "remembers" the variables from the scope where it was created, even after that scope has exited. **Currying** transforms a function with multiple arguments into a chain of single-argument functions. Together, they enable powerful patterns like data privacy, configuration, partial application, and function composition.

## Closures

```typescript
// Closure — inner function captures `count` from outer scope
function createCounter(initial: number = 0) {
  let count = initial;  // captured by closure — private state

  return {
    increment: () => ++count,
    decrement: () => --count,
    getCount: () => count,
  };
}

const counter = createCounter(10);
counter.increment();  // 11
counter.increment();  // 12
counter.getCount();   // 12
// `count` is inaccessible directly — true encapsulation without classes

// Practical closure: memoization
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();  // captured by closure

  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) {
      cache.set(key, fn(...args));
    }
    return cache.get(key);
  }) as T;
}

const expensiveCalc = memoize((n: number) => {
  console.log("computing...");
  return n * n;
});
expensiveCalc(5);  // "computing..." → 25
expensiveCalc(5);  // 25 (cached — no "computing..." log)
```

```python
# Python — closures
def make_validator(min_length: int, max_length: int):
    """Returns a validation function with captured bounds."""
    def validate(value: str) -> bool:
        return min_length <= len(value) <= max_length
    return validate

validate_username = make_validator(3, 20)
validate_password = make_validator(8, 128)

validate_username("Al")      # False (too short)
validate_username("Alice")   # True
validate_password("short")   # False

# Common closure pitfall: late binding in loops
functions = []
for i in range(5):
    functions.append(lambda: i)  # all capture the SAME `i`

[f() for f in functions]  # [4, 4, 4, 4, 4] — not [0, 1, 2, 3, 4]!

# Fix: default argument captures current value
functions = [lambda x=i: x for i in range(5)]
[f() for f in functions]  # [0, 1, 2, 3, 4]
```

## Currying

```typescript
// Currying: f(a, b, c) → f(a)(b)(c)
// Normal function
function add(a: number, b: number, c: number): number {
  return a + b + c;
}
add(1, 2, 3);  // 6

// Curried version
function curriedAdd(a: number) {
  return (b: number) => {
    return (c: number) => a + b + c;
  };
}
curriedAdd(1)(2)(3);  // 6

// Partial application — fix some arguments, get a new function
const add10 = curriedAdd(10);
const add10and20 = add10(20);
add10and20(5);  // 35

// Practical currying: API endpoint builder
const apiUrl = (base: string) => (version: string) => (resource: string) =>
  `${base}/api/${version}/${resource}`;

const myApi = apiUrl("https://example.com")("v2");
myApi("users");     // "https://example.com/api/v2/users"
myApi("products");  // "https://example.com/api/v2/products"

// Generic curry utility
function curry<A, B, C>(fn: (a: A, b: B) => C): (a: A) => (b: B) => C {
  return (a: A) => (b: B) => fn(a, b);
}

const curriedMap = curry(<T, U>(fn: (x: T) => U, arr: T[]): U[] => arr.map(fn));
const doubleAll = curriedMap((x: number) => x * 2);
doubleAll([1, 2, 3]);  // [2, 4, 6]
```

```haskell
-- Haskell — all functions are curried by default
add :: Int -> Int -> Int    -- this IS curried: Int → (Int → Int)
add a b = a + b

add5 = add 5               -- partial application: returns (Int → Int)
add5 3                      -- 8

map (add 5) [1, 2, 3]      -- [6, 7, 8]

-- Currying enables point-free style
sumList = foldr (+) 0       -- no explicit argument — "point-free"
sumList [1, 2, 3]           -- 6
```

### Currying vs Partial Application

```
Currying:             Transforms f(a, b, c) into f(a)(b)(c)
                      Always produces unary functions
                      Structural transformation

Partial Application:  Fixes some arguments: g = f(1, _, 3) → g(b)
                      Can fix any number of arguments
                      Produces a function with fewer parameters

In practice, they're often used together.
```

## Real-world Uses

- **React hooks** — `useState`, `useEffect` are closures over component state.
- **Event handlers** — `onClick={() => handleClick(id)}` captures `id` via closure.
- **Express middleware** — `rateLimit(100)` returns a closure with the limit captured.
- **Lodash `_.curry`** — generic currying for any function.
- **Redux selectors** — `createSelector` uses closures for memoized derivations.

## Sources

- Abelson, H. & Sussman, G. (1996). *SICP*. MIT Press. Section 3.2.
- [MDN — Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
