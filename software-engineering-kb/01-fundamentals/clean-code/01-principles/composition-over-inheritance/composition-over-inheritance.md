# Composition Over Inheritance

> **Domain:** Fundamentals > Clean Code > Principles
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

"Composition Over Inheritance" is a fundamental object-oriented design principle popularized by the Gang of Four (GoF) in *Design Patterns* (1994):

> "Favor object composition over class inheritance."

**Inheritance** creates an "is-a" relationship: a `Dog` is an `Animal`. **Composition** creates a "has-a" relationship: a `Car` has an `Engine`. The principle advises that in most cases, you should build complex behavior by **combining simple objects** (composition) rather than by **building class hierarchies** (inheritance).

### Why GoF Recommended This

The GoF observed that inheritance introduces tight coupling between parent and child classes. Changes to the parent class ripple through all children. Composition, on the other hand, allows you to change behavior at runtime by swapping components, and avoids the rigidity of deep hierarchies.

## Why It Matters

### Flexibility
Composition lets you mix and match behaviors at runtime. Inheritance locks you into a compile-time hierarchy.

### Avoids the Diamond Problem
Multiple inheritance (supported in C++, Python) can lead to ambiguous method resolution. Composition avoids this entirely.

### Prevents Fragile Base Class Problem
When a parent class changes, all child classes may break. With composition, changing one component doesn't affect others.

### Better Encapsulation
Composed objects can hide their internals. Inherited classes often expose parent implementation details.

## How It Works

### Example: Inheritance Problem

```typescript
// BAD: Deep inheritance hierarchy — rigid and fragile
class Animal {
  eat(): void { console.log('eating'); }
}

class FlyingAnimal extends Animal {
  fly(): void { console.log('flying'); }
}

class SwimmingAnimal extends Animal {
  swim(): void { console.log('swimming'); }
}

// Problem: Duck can fly AND swim — which do we extend?
class Duck extends FlyingAnimal {
  // Can't also extend SwimmingAnimal!
  swim(): void { console.log('swimming'); } // Forced to duplicate
}
```

### Example: Composition Solution

```typescript
// GOOD: Compose behaviors
interface CanEat {
  eat(): void;
}

interface CanFly {
  fly(): void;
}

interface CanSwim {
  swim(): void;
}

const eating = (): CanEat => ({
  eat: () => console.log('eating'),
});

const flying = (): CanFly => ({
  fly: () => console.log('flying'),
});

const swimming = (): CanSwim => ({
  swim: () => console.log('swimming'),
});

// Duck gets exactly the behaviors it needs
function createDuck() {
  return {
    ...eating(),
    ...flying(),
    ...swimming(),
    quack: () => console.log('quack!'),
  };
}
```

### Python Example: Strategy via Composition

```python
class Logger:
    def log(self, message: str) -> None:
        raise NotImplementedError

class ConsoleLogger(Logger):
    def log(self, message: str) -> None:
        print(f"[CONSOLE] {message}")

class FileLogger(Logger):
    def log(self, message: str) -> None:
        with open("app.log", "a") as f:
            f.write(f"{message}\n")

# Composition: inject the logger
class OrderService:
    def __init__(self, logger: Logger, repository: OrderRepository):
        self.logger = logger        # Has-a Logger
        self.repository = repository # Has-a Repository

    def create_order(self, order: Order) -> None:
        self.repository.save(order)
        self.logger.log(f"Order {order.id} created")

# Easily swap behavior:
service_dev = OrderService(ConsoleLogger(), InMemoryRepo())
service_prod = OrderService(FileLogger(), PostgresRepo())
```

### Java Example: Decorator Pattern

```java
// Composition via Decorator — add behavior without inheritance
public interface DataSource {
    void writeData(String data);
    String readData();
}

public class FileDataSource implements DataSource {
    public void writeData(String data) { /* write to file */ }
    public String readData() { return /* read from file */; }
}

// Decorator adds encryption via composition
public class EncryptionDecorator implements DataSource {
    private final DataSource wrappee; // Composition!

    public EncryptionDecorator(DataSource source) {
        this.wrappee = source;
    }

    public void writeData(String data) {
        wrappee.writeData(encrypt(data));
    }

    public String readData() {
        return decrypt(wrappee.readData());
    }
}

// Stack decorators freely:
DataSource source = new EncryptionDecorator(
    new CompressionDecorator(
        new FileDataSource("data.txt")
    )
);
```

## Best Practices

1. **Use inheritance for true "is-a" relationships** that are stable and unlikely to change. `ArrayList is a List` — correct. `AdminUser is a User` — often problematic.

2. **Use composition for "has-a" and "can-do" relationships.** A `Car` has an `Engine`. A `Logger` can be `ConsoleLogger` or `FileLogger`.

3. **Prefer interfaces + composition** over abstract classes + inheritance. Interfaces define what an object can do; composition defines how.

4. **Keep inheritance hierarchies shallow** — one or two levels max. Deep hierarchies (5+ levels) are almost always wrong.

5. **Use the Strategy pattern** to swap algorithms at runtime instead of creating subclass variants.

6. **Use mixins/traits** in languages that support them (Python, Scala, Ruby, Rust) as a middle ground.

## Anti-patterns / Common Mistakes

### Deep Inheritance Hierarchies
```
BaseEntity → Auditable → SoftDeletable → User → AdminUser → SuperAdminUser
```
This is a maintenance nightmare. Prefer flat hierarchies with composed behaviors.

### Inheriting for Code Reuse Only
If you're inheriting just to reuse some methods (not because of an "is-a" relationship), use composition instead.

### The Yo-Yo Problem
When understanding a class requires bouncing up and down the inheritance tree to see which method is defined where.

## Real-world Examples

### React: Composition Over Inheritance
The React documentation explicitly states: "At Facebook, we use React in thousands of components, and we haven't found any use cases where we would recommend creating component inheritance hierarchies." React uses composition (props, children, hooks) exclusively.

### Go Language
Go has no inheritance at all — only composition through struct embedding and interface implementation. This was a deliberate design choice.

### Entity Component System (ECS)
Game engines (Unity, Bevy) use ECS architecture: entities are composed of components (Position, Velocity, Health, Renderable) rather than inheriting from a base `GameObject`.

## Sources

- Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
- Martin, R.C. (2008). *Clean Code*. Prentice Hall.
- [React Documentation — Composition vs Inheritance](https://react.dev/learn/thinking-in-react)
- [Essential Software Design Principles (design-gurus.io)](https://www.designgurus.io/blog/essential-software-design-principles-you-should-know-before-the-interview)
