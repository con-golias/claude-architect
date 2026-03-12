# Inheritance

> **Domain:** Fundamentals > Programming Paradigms > Object-Oriented
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Inheritance allows a class to **derive from another class**, inheriting its fields and methods while adding or overriding behavior. It establishes an "is-a" relationship and enables code reuse and polymorphism. However, deep inheritance hierarchies create tight coupling — modern practice favors composition.

## How It Works

```typescript
// TypeScript — single inheritance with abstract classes
abstract class Vehicle {
  constructor(
    protected make: string,
    protected year: number,
    protected fuelLevel: number = 100
  ) {}

  abstract fuelEfficiency(): number;  // subclasses must implement

  drive(km: number): void {
    const fuelNeeded = km / this.fuelEfficiency();
    if (fuelNeeded > this.fuelLevel) throw new Error("Not enough fuel");
    this.fuelLevel -= fuelNeeded;
  }

  toString(): string {
    return `${this.year} ${this.make} (${this.fuelLevel.toFixed(0)}% fuel)`;
  }
}

class Car extends Vehicle {
  fuelEfficiency() { return 15; }  // 15 km per unit of fuel
}

class Truck extends Vehicle {
  constructor(make: string, year: number, private payload: number) {
    super(make, year);  // must call parent constructor
  }
  fuelEfficiency() { return 8 - this.payload * 0.001; }  // less efficient with load
}

class ElectricCar extends Car {
  fuelEfficiency() { return 50; }  // override parent

  drive(km: number): void {
    if (km > 500) throw new Error("Range exceeded — charge needed");
    super.drive(km);  // call parent implementation
  }
}
```

```python
# Python — multiple inheritance and MRO
class Flyable:
    def fly(self):
        return f"{type(self).__name__} is flying"

class Swimmable:
    def swim(self):
        return f"{type(self).__name__} is swimming"

class Duck(Flyable, Swimmable):   # multiple inheritance
    def quack(self):
        return "Quack!"

duck = Duck()
duck.fly()    # "Duck is flying"
duck.swim()   # "Duck is swimming"

# Method Resolution Order (MRO) — C3 linearization
print(Duck.__mro__)
# (<class 'Duck'>, <class 'Flyable'>, <class 'Swimmable'>, <class 'object'>)
```

### The Diamond Problem

```python
class A:
    def method(self): return "A"

class B(A):
    def method(self): return "B"

class C(A):
    def method(self): return "C"

class D(B, C):   # diamond: D inherits B and C, both inherit A
    pass

D().method()     # "B" — Python uses MRO (left-to-right, depth-first)

# Java/C#/TypeScript avoid this: single class inheritance + multiple interfaces
```

### Interfaces vs Abstract Classes

```typescript
// Interface — pure contract, no implementation
interface Serializable {
  serialize(): string;
  deserialize(data: string): void;
}

// Abstract class — partial implementation
abstract class Repository<T> {
  abstract findById(id: string): Promise<T>;
  abstract save(entity: T): Promise<void>;

  // Concrete method shared by all subclasses
  async findOrThrow(id: string): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) throw new Error(`Not found: ${id}`);
    return entity;
  }
}

// Class can implement multiple interfaces, extend only one class
class UserRepo extends Repository<User> implements Serializable {
  findById(id: string) { /* ... */ }
  save(entity: User) { /* ... */ }
  serialize() { /* ... */ }
  deserialize(data: string) { /* ... */ }
}
```

### Liskov Substitution Principle (LSP)

```
A subclass should be usable anywhere its parent is expected
without breaking correctness.

Classic violation:
  class Rectangle { setWidth(w); setHeight(h); }
  class Square extends Rectangle { ... }
  // Square breaks if someone sets width and height independently

Rule: If S is a subtype of T, then objects of type T may be
replaced with objects of type S without altering correctness.
```

## When to Use Inheritance

```
Use inheritance when:
  ✓ True "is-a" relationship (Dog is-a Animal)
  ✓ Sharing implementation across related types
  ✓ Framework requires it (Android Activity, JUnit TestCase)

Avoid when:
  ✗ "has-a" relationship (Car has-a Engine → use composition)
  ✗ Only reusing a few methods (→ delegation)
  ✗ Hierarchy deeper than 2-3 levels
  ✗ Subclass only overrides to disable parent behavior
```

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. "Favor composition over inheritance."
- Liskov, B. & Wing, J. (1994). "A Behavioral Notion of Subtyping." *ACM TOPLAS*, 16(6).
- Bloch, J. (2018). *Effective Java*. 3rd ed. Items 18-19.
