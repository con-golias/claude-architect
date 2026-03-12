# Liskov Substitution Principle (LSP)

> **Domain:** Fundamentals > Clean Code > Principles > SOLID
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

The Liskov Substitution Principle (LSP) is the third SOLID principle, introduced by Barbara Liskov and Jeannette Wing in 1994 (building on Liskov's 1987 keynote):

> "If S is a subtype of T, then objects of type T may be replaced with objects of type S without altering any of the desirable properties of the program."

In simpler terms: **subtypes must be substitutable for their base types.** If code works with a base class, it must also work correctly with any derived class — without knowing which subclass it's dealing with.

LSP is about **behavioral compatibility**, not just structural compatibility. A subclass can add new behavior but must not violate the expectations (the *contract*) of the base class.

### Formal Conditions

For LSP to hold, subclasses must satisfy:
- **Preconditions cannot be strengthened** — a subclass can't require more than the base class.
- **Postconditions cannot be weakened** — a subclass must deliver at least as much as the base class promises.
- **Invariants must be preserved** — properties that are always true for the base class must also be true for subclasses.
- **History constraint** — subclasses cannot introduce state changes that the base class wouldn't allow.

## Why It Matters

### Type Safety Beyond the Compiler
The compiler can check structural compatibility (method signatures match), but LSP is about **semantic compatibility** (behavior matches expectations). Violating LSP causes runtime surprises.

### Polymorphism Relies on LSP
The entire point of polymorphism is that you can write code against a base type and trust that any subtype works correctly. If LSP is violated, polymorphism becomes dangerous.

### Framework and Library Design
Libraries that expose base classes or interfaces must trust that user-provided subclasses behave correctly. LSP violations break frameworks in subtle ways.

## How It Works

### The Classic Violation: Rectangle / Square

This is the most famous LSP example. Mathematically, a square IS a rectangle. But in OOP:

```typescript
// BAD: Square violates LSP when substituted for Rectangle
class Rectangle {
  constructor(protected width: number, protected height: number) {}

  setWidth(w: number): void { this.width = w; }
  setHeight(h: number): void { this.height = h; }
  area(): number { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number): void {
    this.width = w;
    this.height = w; // Surprise! Setting width also changes height
  }

  setHeight(h: number): void {
    this.width = h;
    this.height = h; // Surprise! Setting height also changes width
  }
}

// This function assumes Rectangle behavior
function resizeAndCheck(rect: Rectangle): void {
  rect.setWidth(5);
  rect.setHeight(4);
  // Expects area to be 20, but Square gives 16!
  console.assert(rect.area() === 20, `Expected 20, got ${rect.area()}`);
}

resizeAndCheck(new Rectangle(0, 0)); // PASS: area = 20
resizeAndCheck(new Square(0, 0));    // FAIL: area = 16
```

### The Fix: Use Composition or Separate Interfaces

```typescript
// GOOD: Separate types, no inheritance
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(readonly width: number, readonly height: number) {}
  area(): number { return this.width * this.height; }
}

class Square implements Shape {
  constructor(readonly side: number) {}
  area(): number { return this.side * this.side; }
}
```

### Python Example: Violated Contract

```python
class Bird:
    def fly(self) -> str:
        return "Flying high!"

class Penguin(Bird):
    def fly(self) -> str:
        raise NotImplementedError("Penguins can't fly!")  # LSP violation!

# Client code breaks:
def make_bird_fly(bird: Bird) -> str:
    return bird.fly()  # Raises exception for Penguin

# FIX: Restructure the hierarchy
class Bird:
    def move(self) -> str:
        raise NotImplementedError

class FlyingBird(Bird):
    def move(self) -> str:
        return "Flying!"

class SwimmingBird(Bird):
    def move(self) -> str:
        return "Swimming!"

class Eagle(FlyingBird):
    pass

class Penguin(SwimmingBird):
    pass
```

### Java Example: Collections

```java
// GOOD LSP: ArrayList and LinkedList both properly implement List
List<String> list1 = new ArrayList<>();
List<String> list2 = new LinkedList<>();

// Both work correctly — LSP is preserved
list1.add("hello");
list2.add("hello");
assert list1.size() == list2.size();

// BAD LSP: Imagine a "ReadOnlyList" extending List
public class ReadOnlyList<T> extends ArrayList<T> {
    @Override
    public boolean add(T element) {
        throw new UnsupportedOperationException(); // Violates LSP!
    }
}
```

## Best Practices

1. **Design by Contract.** Clearly define preconditions, postconditions, and invariants. Subclasses must honor them.

2. **Favor composition over inheritance** when in doubt. If a subclass needs to restrict or change base class behavior, it probably shouldn't be a subclass.

3. **Use interfaces for polymorphism.** Interfaces define capabilities (what an object can do) rather than hierarchies (what an object is).

4. **Don't inherit just for code reuse.** Inheritance should model an "is-a" relationship where the subclass truly behaves like the base class in all contexts.

5. **Write tests against the base type.** If your tests pass with the base class, they should also pass with any subclass. If they don't, you have an LSP violation.

6. **Avoid throwing unexpected exceptions** in overridden methods. If the base class method doesn't throw, the subclass shouldn't either.

7. **Don't strengthen preconditions.** If the base class accepts any positive number, the subclass can't restrict it to only even numbers.

## Anti-patterns / Common Mistakes

### Empty Method Overrides
```java
// BAD: Overriding to do nothing violates the contract
class BaseLogger {
    public void log(String message) { System.out.println(message); }
}

class SilentLogger extends BaseLogger {
    @Override
    public void log(String message) { /* does nothing */ }
}
// If callers depend on logging actually happening, this breaks LSP
```

### Type Checking in Client Code
If you find yourself checking the type of a base class reference, LSP is likely violated:
```typescript
// BAD: This is a code smell indicating LSP violation
function processShape(shape: Shape) {
  if (shape instanceof Circle) {
    // special circle handling
  } else if (shape instanceof Square) {
    // special square handling
  }
}
```

### Inheriting for Convenience
Extending `HashMap` to create a `Config` class just because config uses key-value pairs, even though `Config` shouldn't support all `Map` operations.

## Real-world Examples

### Java Collections Framework
`java.util.List`, `Set`, and `Map` are well-designed interfaces that obey LSP. Any implementation (`ArrayList`, `HashSet`, `TreeMap`) can be substituted wherever the interface is expected.

### React Component Props
In React, any component that accepts `ButtonProps` should work anywhere a button is expected, maintaining the same contract for `onClick`, `disabled`, etc.

### Database Drivers
JDBC drivers in Java follow LSP — any `java.sql.Connection` implementation (MySQL, PostgreSQL, Oracle) can be substituted in code that uses the `Connection` interface.

## Sources

- Liskov, B. & Wing, J. (1994). *A Behavioral Notion of Subtyping*. ACM Transactions on Programming Languages and Systems.
- Liskov, B. (1987). *Data Abstraction and Hierarchy*. OOPSLA '87 Keynote.
- Martin, R.C. (2003). *Agile Software Development: Principles, Patterns, and Practices*. Prentice Hall.
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall.
- [SOLID Principles Guide (Medium)](https://medium.com/@hlfdev/kiss-dry-solid-yagni-a-simple-guide-to-some-principles-of-software-engineering-and-clean-code-05e60233c79f)
