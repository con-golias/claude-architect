# Open/Closed Principle (OCP)

> **Domain:** Fundamentals > Clean Code > Principles > SOLID
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Open/Closed Principle (OCP) is the second SOLID principle, originally formulated by Bertrand Meyer in 1988:

> "Software entities (classes, modules, functions) should be **open for extension** but **closed for modification**."

This means you should be able to add new behavior to a system **without changing existing, tested code**. New requirements are met by writing new code, not by altering old code.

Robert C. Martin popularized OCP in the context of object-oriented design, emphasizing the use of **abstractions** (interfaces, abstract classes) and **polymorphism** to achieve it.

### Two Interpretations

- **Meyer's OCP (1988):** Achieve extension through inheritance. A class is "closed" once it has well-defined interfaces, and "open" because subclasses can override behavior.
- **Polymorphic OCP (Martin, 1996):** Achieve extension through abstractions and dependency inversion. Prefer interfaces and composition over inheritance.

The modern consensus favors the polymorphic interpretation.

## Why It Matters

### Stability
Existing code that works and is tested remains untouched. This eliminates the risk of introducing regressions when adding features.

### Scalability
New features are added by creating new classes/modules, not by editing existing ones. This makes large codebases manageable.

### Parallel Development
Teams can work on new features independently without conflicting on the same files.

### Plugin Architectures
OCP is the foundation of plugin-based systems (VS Code extensions, WordPress plugins, middleware pipelines).

## How It Works

### The Core Mechanism
Instead of using conditionals (`if/else`, `switch`) to handle variations, use **polymorphism**:

### Example: Violation

```typescript
// BAD: Adding a new shape requires modifying this function
class AreaCalculator {
  calculateArea(shape: Shape): number {
    if (shape.type === 'circle') {
      return Math.PI * shape.radius ** 2;
    } else if (shape.type === 'rectangle') {
      return shape.width * shape.height;
    } else if (shape.type === 'triangle') {
      // Every new shape = modification here
      return (shape.base * shape.height) / 2;
    }
    throw new Error('Unknown shape');
  }
}
```

### Example: Fixed with OCP

```typescript
// GOOD: New shapes extend the system without modifying existing code
interface Shape {
  area(): number;
}

class Circle implements Shape {
  constructor(private radius: number) {}
  area(): number {
    return Math.PI * this.radius ** 2;
  }
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area(): number {
    return this.width * this.height;
  }
}

// Adding a new shape = new class, ZERO changes to existing code
class Triangle implements Shape {
  constructor(private base: number, private height: number) {}
  area(): number {
    return (this.base * this.height) / 2;
  }
}

class AreaCalculator {
  calculateArea(shape: Shape): number {
    return shape.area(); // Works for any shape, past or future
  }
}
```

### Python Example: Strategy Pattern

```python
from abc import ABC, abstractmethod

# Open for extension via new discount strategies
class DiscountStrategy(ABC):
    @abstractmethod
    def calculate(self, price: float) -> float:
        pass

class NoDiscount(DiscountStrategy):
    def calculate(self, price: float) -> float:
        return price

class PercentageDiscount(DiscountStrategy):
    def __init__(self, percentage: float):
        self.percentage = percentage

    def calculate(self, price: float) -> float:
        return price * (1 - self.percentage / 100)

class BuyOneGetOneFree(DiscountStrategy):
    def calculate(self, price: float) -> float:
        return price / 2

# This class is CLOSED for modification
class PriceCalculator:
    def __init__(self, strategy: DiscountStrategy):
        self.strategy = strategy

    def final_price(self, price: float) -> float:
        return self.strategy.calculate(price)
```

### Java Example: Middleware/Filter Chain

```java
// Open for extension: add new filters without changing existing ones
public interface RequestFilter {
    void filter(HttpRequest request);
}

public class AuthenticationFilter implements RequestFilter {
    public void filter(HttpRequest request) {
        // Verify authentication token
    }
}

public class RateLimitFilter implements RequestFilter {
    public void filter(HttpRequest request) {
        // Check rate limits
    }
}

// Closed for modification: the pipeline doesn't change
public class FilterPipeline {
    private final List<RequestFilter> filters;

    public FilterPipeline(List<RequestFilter> filters) {
        this.filters = filters;
    }

    public void process(HttpRequest request) {
        for (RequestFilter filter : filters) {
            filter.filter(request);
        }
    }
}
```

## Best Practices

1. **Use interfaces and abstract classes** to define extension points. Concrete classes implement the behavior.

2. **Prefer composition over inheritance** for extension. Composition (Strategy, Decorator patterns) is more flexible than class hierarchies.

3. **Identify axes of change.** Determine what is likely to change and abstract it behind an interface. Don't abstract things that won't change.

4. **Use the Strategy pattern** when behavior varies by context. Inject different strategies for different behavior.

5. **Use the Decorator pattern** when you need to add behavior to existing objects without modifying them.

6. **Don't abstract prematurely.** Apply OCP when you see a pattern of change, not speculatively. The first time you need a variation, refactor to support OCP.

7. **Configuration over code changes.** Use dependency injection, configuration files, or environment variables to select behavior at runtime.

## Anti-patterns / Common Mistakes

### Premature Abstraction
Creating interfaces and abstractions before you have any variation. If there's only one implementation, you probably don't need the abstraction yet. Wait for the second or third case.

### Switch Statement Proliferation
A classic OCP violation. Every `switch` on a type discriminator is a place that needs modification when a new type is added.

```typescript
// BAD: OCP violation — switch must be updated for every new payment method
function processPayment(method: string, amount: number) {
  switch (method) {
    case 'credit_card': return chargeCreditCard(amount);
    case 'paypal': return chargePayPal(amount);
    case 'crypto': return chargeCrypto(amount); // New addition = modification
  }
}
```

### Modification Through Flags
Adding boolean parameters to toggle new behavior inside existing methods instead of creating new implementations.

```python
# BAD: Flag argument violates OCP
def send_notification(user, message, use_sms=False, use_push=False):
    if use_sms:
        send_sms(user.phone, message)
    elif use_push:
        send_push(user.device_token, message)
    else:
        send_email(user.email, message)
```

## Real-world Examples

### VS Code Extensions
VS Code is a masterclass in OCP. The core editor is closed for modification, but open for extension through thousands of plugins that add languages, themes, debuggers, and tools.

### Express.js / Koa Middleware
Web frameworks use middleware pipelines: each middleware is an extension, and the core framework remains unchanged.

```typescript
app.use(cors());           // Extension: CORS handling
app.use(helmet());         // Extension: Security headers
app.use(rateLimiter());    // Extension: Rate limiting
app.use(authMiddleware()); // Extension: Authentication
```

### React Component Composition
React's composition model embodies OCP — components accept children and props to extend behavior without modifying the component itself.

## Sources

- Meyer, B. (1988). *Object-Oriented Software Construction*. Prentice Hall.
- Martin, R.C. (2003). *Agile Software Development: Principles, Patterns, and Practices*. Prentice Hall.
- Martin, R.C. (2008). *Clean Code*. Prentice Hall.
- Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
- [Refactoring Guru — Replace Conditional with Polymorphism](https://refactoring.guru/replace-conditional-with-polymorphism)
