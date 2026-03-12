# Algebraic Data Types

> **Domain:** Fundamentals > Programming Paradigms > Generic & Type-Level
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Algebraic Data Types (ADTs) are composite types formed by combining other types using two fundamental operations: **sum types** (OR — a value is one of several variants) and **product types** (AND — a value contains all listed fields). Combined with **pattern matching**, ADTs provide exhaustive, type-safe handling of all possible states, eliminating entire classes of bugs including null pointer exceptions.

## How It Works

### Sum Types (Tagged Unions / Enums)

```rust
// Rust — enum as sum type (most ergonomic ADT implementation)
enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
    Triangle { base: f64, height: f64 },
}

// Pattern matching — compiler ensures ALL variants are handled
fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
        Shape::Rectangle { width, height } => width * height,
        Shape::Triangle { base, height } => 0.5 * base * height,
        // If you add a new variant, compiler error until you handle it here
    }
}

// Option<T> — eliminates null
enum Option<T> {
    Some(T),
    None,
}

// Result<T, E> — eliminates exceptions
enum Result<T, E> {
    Ok(T),
    Err(E),
}

fn parse_age(input: &str) -> Result<u32, String> {
    match input.parse::<u32>() {
        Ok(age) if age <= 150 => Ok(age),
        Ok(age) => Err(format!("Unrealistic age: {}", age)),
        Err(_) => Err(format!("Not a number: {}", input)),
    }
}
```

```typescript
// TypeScript — discriminated unions (sum types)
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":    return Math.PI * shape.radius ** 2;
    case "rectangle": return shape.width * shape.height;
    case "triangle":  return 0.5 * shape.base * shape.height;
    // TypeScript: if you miss a case, the type of `shape` won't be `never`
  }
}

// Exhaustiveness checking
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
```

```haskell
-- Haskell — the canonical ADT language
data Shape = Circle Double
           | Rectangle Double Double
           | Triangle Double Double
           deriving (Show, Eq)

area :: Shape -> Double
area (Circle r)      = pi * r * r
area (Rectangle w h) = w * h
area (Triangle b h)  = 0.5 * b * h

-- Maybe — Haskell's null-safe type
data Maybe a = Nothing | Just a

safeDivide :: Double -> Double -> Maybe Double
safeDivide _ 0 = Nothing
safeDivide a b = Just (a / b)

-- Either — error handling
data Either a b = Left a | Right b

parseAge :: String -> Either String Int
parseAge s = case reads s of
    [(n, "")] | n > 0 && n < 150 -> Right n
    _ -> Left ("Invalid age: " ++ s)
```

### Product Types (Records / Tuples / Structs)

```rust
// Product type — all fields present simultaneously
struct User {
    name: String,       // AND
    age: u32,           // AND
    email: String,      // AND
    active: bool,       // all four fields must be present
}

// Tuple — anonymous product type
let point: (f64, f64, f64) = (1.0, 2.0, 3.0);
```

### Why ADTs Eliminate Null

```typescript
// WITHOUT ADTs — null can appear anywhere
function findUser(id: string): User | null {
  // ...
}
const user = findUser("123");
user.name;  // RUNTIME ERROR if user is null!

// WITH ADTs — absence is explicit and must be handled
type MaybeUser = { found: true; user: User } | { found: false };

function findUser(id: string): MaybeUser { /* ... */ }

const result = findUser("123");
if (result.found) {
  result.user.name;  // type-safe — compiler knows user exists
} else {
  // handle absence — compiler forces you
}

// Rust: Option<T> makes this the default
// There is no null in Rust — Option::None is the only way to express absence
```

### Algebraic Laws

```
Sum type:   |A + B| = |A| + |B|    (number of possible values)
Product:    |A × B| = |A| × |B|

Examples:
  bool = True | False                → 2 values
  (bool, bool) = bool × bool        → 2 × 2 = 4 values
  Maybe bool = Nothing | Just bool   → 1 + 2 = 3 values
  Result<bool, string> = Ok(bool) | Err(string)  → 2 + ∞ values

void ≡ 0 (no values — empty type)
unit ≡ 1 (one value — () in Rust/Haskell)
bool ≡ 2 (True or False)
```

## Real-world Examples

- **Rust `Option<T>` / `Result<T,E>`** — standard library error handling.
- **TypeScript discriminated unions** — Redux actions, API responses, state machines.
- **Haskell `Maybe` / `Either`** — pure functional error handling.
- **Kotlin sealed classes** — restricted class hierarchies.
- **Swift enums with associated values** — powerful pattern matching.
- **Java sealed classes** (17+) — `sealed interface Shape permits Circle, Rectangle`.

## Sources

- Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press. Chapter 11.
- [Rust Book — Enums and Pattern Matching](https://doc.rust-lang.org/book/ch06-00-enums.html)
- [Wikipedia — Algebraic Data Type](https://en.wikipedia.org/wiki/Algebraic_data_type)
