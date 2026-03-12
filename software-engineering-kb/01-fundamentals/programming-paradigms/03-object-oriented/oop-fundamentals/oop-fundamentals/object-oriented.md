# Object-Oriented Programming

> **Domain:** Fundamentals > Programming Paradigms > Object-Oriented
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

Object-Oriented Programming (OOP) organizes software around **objects** — entities that bundle data (state) and behavior (methods) together. Objects interact by sending messages to each other. OOP aims to model real-world concepts, promote code reuse through inheritance, and protect data through encapsulation.

**The Four Pillars:**
1. **Encapsulation** — bundling data and methods, hiding internal state
2. **Abstraction** — exposing only essential features, hiding complexity
3. **Inheritance** — creating new classes from existing ones
4. **Polymorphism** — same interface, different implementations

**Origin:** Simula (1967) introduced classes and objects. Smalltalk-80 (Alan Kay) refined the concept with message passing. C++ (1983), Java (1995), and C# (2000) brought OOP to mainstream industry.

## How It Works

```typescript
// TypeScript — class-based OOP
abstract class Shape {
  abstract area(): number;
  abstract perimeter(): number;

  describe(): string {
    return `${this.constructor.name}: area=${this.area().toFixed(2)}, perimeter=${this.perimeter().toFixed(2)}`;
  }
}

class Circle extends Shape {
  constructor(private radius: number) { super(); }

  area(): number { return Math.PI * this.radius ** 2; }
  perimeter(): number { return 2 * Math.PI * this.radius; }
}

class Rectangle extends Shape {
  constructor(private width: number, private height: number) { super(); }

  area(): number { return this.width * this.height; }
  perimeter(): number { return 2 * (this.width + this.height); }
}

// Polymorphism — same interface, different behavior
const shapes: Shape[] = [new Circle(5), new Rectangle(4, 6)];
shapes.forEach(s => console.log(s.describe()));
// Circle: area=78.54, perimeter=31.42
// Rectangle: area=24.00, perimeter=20.00
```

```python
# Python — OOP with dunder methods
class BankAccount:
    def __init__(self, owner: str, balance: float = 0):
        self._owner = owner
        self._balance = balance
        self._transactions: list[float] = []

    @property
    def balance(self) -> float:
        return self._balance

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("Deposit must be positive")
        self._balance += amount
        self._transactions.append(amount)

    def withdraw(self, amount: float) -> None:
        if amount > self._balance:
            raise ValueError("Insufficient funds")
        self._balance -= amount
        self._transactions.append(-amount)

    def __repr__(self) -> str:
        return f"BankAccount({self._owner!r}, balance={self._balance:.2f})"

    def __eq__(self, other) -> bool:
        return isinstance(other, BankAccount) and self._owner == other._owner
```

```java
// Java — interface-based OOP
public interface Sortable<T extends Comparable<T>> {
    List<T> sort(List<T> items);
}

public class QuickSort<T extends Comparable<T>> implements Sortable<T> {
    @Override
    public List<T> sort(List<T> items) {
        if (items.size() <= 1) return items;
        T pivot = items.get(0);
        List<T> less = items.stream().skip(1).filter(x -> x.compareTo(pivot) < 0).toList();
        List<T> greater = items.stream().skip(1).filter(x -> x.compareTo(pivot) >= 0).toList();
        List<T> result = new ArrayList<>(sort(less));
        result.add(pivot);
        result.addAll(sort(greater));
        return result;
    }
}
```

### Class-Based vs Prototype-Based

```javascript
// JavaScript — prototype-based OOP
const animal = {
  speak() { return `${this.name} makes a sound`; }
};

const dog = Object.create(animal);
dog.name = "Rex";
dog.speak = function() { return `${this.name} barks`; };

dog.speak();  // "Rex barks"

// Prototype chain: dog → animal → Object.prototype → null
// No classes needed — objects inherit directly from other objects
```

```
Class-based (Java, C#, Python):    Prototype-based (JS, Lua, Self):
──────────────────────────────────────────────────────────────────
Blueprint → Instance               Object → Clone/Delegate
class Dog extends Animal            const dog = Object.create(animal)
Static structure at compile time    Dynamic structure at runtime
Type checking via class hierarchy   Duck typing / structural checks
```

### Alan Kay's Original Vision

```
Alan Kay's Smalltalk OOP was about MESSAGE PASSING between objects,
not classes, inheritance, or encapsulation:

"I thought of objects being like biological cells... able to communicate
 with messages." — Alan Kay

Kay later said: "I'm sorry that I coined the term 'objects' for this
topic because it gets many people to focus on the lesser idea. The big
idea is messaging."

Modern OOP often emphasizes class hierarchies over message passing.
Actor model languages (Erlang) are arguably closer to Kay's vision.
```

## Real-world Examples

- **Java Enterprise** — Spring, Hibernate, entire JEE ecosystem built on OOP.
- **Unity/Unreal** — game engines with class hierarchies for entities and components.
- **GUI frameworks** — Qt, Swing, WPF — widget hierarchies via inheritance.
- **Django/Rails** — model classes map to database tables (Active Record).
- **Design Patterns** — GoF patterns are primarily OOP patterns.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley.
- Meyer, B. (1997). *Object-Oriented Software Construction*. 2nd ed. Prentice Hall.
- Kay, A. (1993). "The Early History of Smalltalk." *ACM SIGPLAN Notices*, 28(3).
