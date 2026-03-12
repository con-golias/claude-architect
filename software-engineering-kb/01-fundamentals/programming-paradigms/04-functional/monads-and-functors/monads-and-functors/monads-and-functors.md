# Monads and Functors

> **Domain:** Fundamentals > Programming Paradigms > Functional
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

**Functors** and **Monads** are abstractions from category theory that provide a structured way to handle values in a context — optional values, errors, async operations, collections, or side effects. A **Functor** lets you map over a wrapped value. A **Monad** additionally lets you chain operations that themselves return wrapped values, avoiding nested wrapping.

## Functor — Mappable Containers

```typescript
// A Functor is anything with a map() method:  F<A>.map(A → B) → F<B>

// Array is a Functor
[1, 2, 3].map(x => x * 2);  // [2, 4, 6]

// Promise is a Functor (via .then)
Promise.resolve(5).then(x => x * 2);  // Promise<10>

// Custom Functor: Maybe (handles null safely)
class Maybe<T> {
  private constructor(private value: T | null) {}

  static of<T>(value: T | null): Maybe<T> { return new Maybe(value); }
  static none<T>(): Maybe<T> { return new Maybe<T>(null); }

  map<U>(fn: (value: T) => U): Maybe<U> {
    return this.value === null ? Maybe.none<U>() : Maybe.of(fn(this.value));
  }

  getOrElse(defaultValue: T): T {
    return this.value ?? defaultValue;
  }
}

// Safe chaining — no null checks needed
Maybe.of({ name: "Alice", address: { city: "NYC" } })
  .map(user => user.address)
  .map(addr => addr.city)
  .map(city => city.toUpperCase())
  .getOrElse("UNKNOWN");  // "NYC"

Maybe.of(null)
  .map((x: any) => x.name)   // skipped — still Maybe.none
  .getOrElse("UNKNOWN");      // "UNKNOWN"
```

## Monad — Chainable Containers

```typescript
// A Monad adds flatMap (bind): M<A>.flatMap(A → M<B>) → M<B>
// flatMap prevents nesting: M<M<B>> → M<B>

class Maybe<T> {
  // ... (Functor methods from above)

  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    return this.value === null ? Maybe.none<U>() : fn(this.value);
  }
}

// Without flatMap: nested Maybes
Maybe.of("42").map(s => Maybe.of(parseInt(s)));  // Maybe<Maybe<number>> ← bad!

// With flatMap: flat chain
Maybe.of("42").flatMap(s => {
  const n = parseInt(s);
  return isNaN(n) ? Maybe.none<number>() : Maybe.of(n);
});  // Maybe<number> ← good!

// Result/Either Monad — error handling without exceptions
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function parseJSON<T>(json: string): Result<T, string> {
  try { return { ok: true, value: JSON.parse(json) }; }
  catch { return { ok: false, error: "Invalid JSON" }; }
}

function getField<T>(obj: any, field: string): Result<T, string> {
  return field in obj
    ? { ok: true, value: obj[field] }
    : { ok: false, error: `Missing field: ${field}` };
}

// Chain Result computations — first error short-circuits
function getUserAge(json: string): Result<number, string> {
  const parsed = parseJSON(json);
  if (!parsed.ok) return parsed;
  const age = getField<number>(parsed.value, "age");
  if (!age.ok) return age;
  if (age.value < 0) return { ok: false, error: "Negative age" };
  return age;
}
```

```rust
// Rust — Option and Result are monads (with ? operator for chaining)
fn parse_config(path: &str) -> Result<Config, Box<dyn Error>> {
    let content = fs::read_to_string(path)?;    // ? = flatMap for Result
    let parsed: Value = serde_json::from_str(&content)?;
    let port = parsed["port"].as_u64().ok_or("missing port")?;
    Ok(Config { port: port as u16 })
}
// Each ? unwraps Ok or returns Err early — monadic chaining

// Option monad
fn find_user_city(users: &HashMap<u32, User>, id: u32) -> Option<String> {
    users.get(&id)                // Option<&User>
        .and_then(|u| u.address.as_ref())  // flatMap: Option<&Address>
        .map(|a| a.city.clone())           // map: Option<String>
}
```

```haskell
-- Haskell — the canonical monad language
-- Maybe monad
safeDivide :: Double -> Double -> Maybe Double
safeDivide _ 0 = Nothing
safeDivide a b = Just (a / b)

-- do-notation: syntactic sugar for flatMap chains
calculate :: Double -> Double -> Double -> Maybe Double
calculate a b c = do
    x <- safeDivide a b     -- flatMap
    y <- safeDivide x c     -- flatMap
    return (x + y)          -- wrap in Maybe

-- IO Monad — all side effects are monadic
main :: IO ()
main = do
    name <- getLine          -- IO action (impure, but tracked by type system)
    putStrLn ("Hello, " ++ name)  -- IO action
```

### Monad Laws

```
1. Left Identity:   return a >>= f     ≡  f a
2. Right Identity:  m >>= return       ≡  m
3. Associativity:   (m >>= f) >>= g   ≡  m >>= (\x -> f x >>= g)

These ensure flatMap chains behave predictably,
regardless of how you group them.
```

### The Monad Family

```
Monad          Context              Real-world Use
────────────────────────────────────────────────────
Maybe/Option   Possible absence     Null-safe chaining
Result/Either  Possible failure     Error handling without exceptions
List/Array     Multiple values      Non-deterministic computation
Promise/Task   Async computation    .then() chains / async-await
IO             Side effects         Haskell I/O isolation
State          Stateful computation  Parsing, random generation
Reader         Shared environment   Dependency injection
Writer         Accumulated output   Logging
```

## Sources

- Wadler, P. (1995). "Monads for Functional Programming." *Advanced Functional Programming*. Springer.
- [Haskell Wiki — Monad](https://wiki.haskell.org/Monad)
- Milewski, B. (2018). *Category Theory for Programmers*. Chapter 20.
