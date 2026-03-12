# Type Systems

> **Domain:** Fundamentals > Programming Paradigms > Generic & Type-Level
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A type system is a set of rules that assigns a **type** to every expression in a program, preventing certain classes of errors. Type systems vary along several axes: static vs dynamic checking, strong vs weak enforcement, nominal vs structural equivalence, and manual vs inferred annotations.

## Classification

### Static vs Dynamic Typing

```typescript
// STATIC — types checked at compile time
let name: string = "Alice";
// name = 42;  // Compile error: Type 'number' is not assignable to type 'string'

function add(a: number, b: number): number {
  return a + b;
}
```

```python
# DYNAMIC — types checked at runtime
name = "Alice"
name = 42         # no error — Python doesn't check types until execution

def add(a, b):
    return a + b

add(1, 2)         # 3
add("a", "b")     # "ab" — works, different behavior
add(1, "hello")   # TypeError at RUNTIME, not compile time
```

### Strong vs Weak Typing

```javascript
// WEAK (JavaScript) — implicit type coercion
"5" + 3           // "53" (string concatenation)
"5" - 3           // 2    (numeric subtraction)
true + true       // 2    (boolean → number)
[] + {}           // "[object Object]"
```

```python
# STRONG (Python) — no implicit coercion
"5" + 3           # TypeError: can't add str and int
# Must be explicit: int("5") + 3 or "5" + str(3)
```

### Nominal vs Structural Typing

```typescript
// STRUCTURAL (TypeScript, Go) — types match by shape
interface Printable {
  toString(): string;
}

class User {
  constructor(public name: string) {}
  toString() { return this.name; }
}

// User satisfies Printable without "implements" — just has the right shape
function print(item: Printable) {
  console.log(item.toString());
}
print(new User("Alice"));  // OK — structural match
```

```java
// NOMINAL (Java, C#) — types match by name declaration
interface Printable {
    String toString();
}

class User {
    public String toString() { return name; }
}

// User does NOT satisfy Printable even though it has toString()
// Must explicitly declare: class User implements Printable
```

### Type Inference

```typescript
// TypeScript — bidirectional type inference
const x = 42;                      // inferred as number
const names = ["Alice", "Bob"];    // inferred as string[]
const doubled = names.map(n => n.toUpperCase());  // string[]

// Hindley-Milner inference (Haskell, ML, Rust)
// Types inferred from usage — no annotations needed
// let x = 5        → i32
// let y = x + 0.1  → error: can't add i32 and f64
```

### Gradual Typing

```python
# Python with type hints — gradual typing
def greet(name: str) -> str:   # typed
    return f"Hello, {name}"

def process(data):              # untyped — still valid Python
    return data.transform()

# mypy checks typed code, ignores untyped code
# Allows incremental adoption of type checking
```

### Duck Typing vs Protocol Typing

```python
# Duck typing — "if it quacks like a duck..."
def calculate_area(shape):
    return shape.area()  # just needs .area() method — any object works

# Protocol typing (Python 3.8+) — structural typing with type checking
from typing import Protocol

class HasArea(Protocol):
    def area(self) -> float: ...

def calculate_area(shape: HasArea) -> float:
    return shape.area()  # type-checked but still structural
```

### Type System Comparison

```
Language     Static/Dynamic  Strong/Weak  Nominal/Structural  Inference
──────────────────────────────────────────────────────────────────────
Haskell      Static          Strong       Structural(ish)     Full (H-M)
Rust         Static          Strong       Nominal + traits    Strong
TypeScript   Static          Strong       Structural          Good
Java         Static          Strong       Nominal             Limited
Go           Static          Strong       Structural          Limited
Python       Dynamic         Strong       Duck typing         Gradual
JavaScript   Dynamic         Weak         Duck typing         None
C            Static          Weak         Nominal             None
Ruby         Dynamic         Strong       Duck typing         None
```

## Sources

- Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press.
- Cardelli, L. (1996). "Type Systems." *ACM Computing Surveys*, 28(1).
- [TypeScript Handbook — Type System](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
