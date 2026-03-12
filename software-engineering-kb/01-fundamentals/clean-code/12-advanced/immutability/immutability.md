# Immutability

> **Domain:** Fundamentals > Clean Code > Advanced
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Immutability means that once an object is created, its state **cannot be changed**. Instead of modifying existing data, you create new data with the desired changes. Immutability is a core concept in functional programming that has been widely adopted in modern OOP.

## Why It Matters

- **Thread safety:** Immutable data can be safely shared between threads — no race conditions.
- **Predictability:** If data can't change, there are no surprises. Easier to reason about.
- **Debugging:** When a value is wrong, it was wrong from creation — no need to trace all modification points.
- **Cache-friendly:** Immutable objects can be freely cached, memoized, and shared.

## How It Works

### JavaScript/TypeScript

```typescript
// Immutable object creation
const user = Object.freeze({ name: 'Alice', age: 30 });
// user.age = 31;  // TypeError in strict mode!

// Updating immutably — spread operator
const updatedUser = { ...user, age: 31 };

// Immutable arrays
const original = [1, 2, 3];
const added = [...original, 4];       // [1, 2, 3, 4]
const removed = original.filter(x => x !== 2); // [1, 3]

// TypeScript: Readonly types
interface User {
  readonly name: string;
  readonly email: string;
}
```

### Python

```python
from dataclasses import dataclass
from typing import NamedTuple

# Frozen dataclass — immutable
@dataclass(frozen=True)
class Point:
    x: float
    y: float

p = Point(1.0, 2.0)
# p.x = 3.0  # FrozenInstanceError!

# Create modified copy
from dataclasses import replace
p2 = replace(p, x=3.0)  # Point(x=3.0, y=2.0)

# Tuples are immutable (lists are mutable)
coordinates = (1.0, 2.0)  # Immutable
```

### Java

```java
// Java Record — immutable by default (Java 16+)
public record User(String name, String email, int age) {}

User user = new User("Alice", "alice@example.com", 30);
// user.name = "Bob";  // Compile error — no setters!

// Unmodifiable collections
List<String> names = List.of("Alice", "Bob", "Charlie");
// names.add("Dave");  // UnsupportedOperationException!
```

### When Mutability Is Acceptable

- **Local scope:** Mutable variables inside a function that don't escape.
- **Performance-critical paths:** When profiling shows immutability is a bottleneck.
- **Builders:** The Builder pattern is mutable during construction, immutable after `.build()`.

## Best Practices

1. **Default to immutable.** Use `const`, `readonly`, `final`, `frozen=True`. Only use mutable when needed.
2. **Use immutable data for value objects** — Money, Address, DateRange.
3. **Return new collections** instead of modifying existing ones.
4. **Use persistent data structures** (Immer for JS, pyrsistent for Python) for efficient immutable updates.
5. **Make classes immutable** unless there's a strong reason for mutability.

## Sources

- Bloch, J. (2018). *Effective Java* (3rd ed.). Item 17: Minimize mutability.
- Martin, R.C. (2008). *Clean Code*. Functional programming influence.
- [Concurrency and Immutability (InfoQ)](https://www.infoq.com/articles/dhanji-prasanna-concurrency/)
