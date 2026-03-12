# Open/Closed Principle (OCP)

| **Domain**       | Fundamentals > SOLID Principles > Open/Closed |
|------------------|------------------------------------------------|
| **Difficulty**   | Intermediate-Advanced                          |
| **Last Updated** | 2026-03-07                                     |

---

## What It Is

The Open/Closed Principle (OCP) is the **O** in SOLID. It has two historically significant formulations:

### Meyer's Original Formulation (1988)

> *"Software entities (classes, modules, functions, etc.) should be open for extension, but closed for modification."*
> — Bertrand Meyer, *Object-Oriented Software Construction* (1988)

Meyer's version achieved "openness" through **implementation inheritance**. A class was "closed" once published, but could be "opened" by creating a subclass that inherited its implementation and added or overrode behavior. The original class's source code was never modified.

### Martin's Polymorphic Reinterpretation (1996)

> *"Software entities should be open for extension but closed for modification. The key is abstraction."*
> — Robert C. Martin, *"The Open-Closed Principle,"* The C++ Report (1996)

Martin reinterpreted OCP using **abstract interfaces and polymorphism** instead of implementation inheritance. Rather than extending a concrete class through inheritance, you define an abstract interface that captures the variable behavior. New behaviors are added by creating new implementations of that interface. The code that depends on the interface never changes.

### Why the Polymorphic Version Is Preferred Today

Meyer's implementation inheritance approach has significant drawbacks:

| Concern | Meyer's Approach (Inheritance) | Martin's Approach (Abstraction) |
|---------|-------------------------------|--------------------------------|
| **Coupling** | Subclass is tightly coupled to parent's implementation details | Implementations are coupled only to the abstract interface |
| **Fragile Base Class** | Changes to the parent class can break all subclasses | Interface changes are deliberate and explicit |
| **Flexibility** | Limited to single inheritance in most languages | A class can implement multiple interfaces |
| **Testability** | Hard to test in isolation; parent behavior leaks into tests | Easy to substitute mock implementations |
| **Composition** | Inheritance hierarchies become deep and rigid | Favor composition of small, independent abstractions |

Modern OOP strongly favors **composition over inheritance** (as advocated by the Gang of Four in *Design Patterns*, 1994). Martin's polymorphic OCP aligns with this philosophy. Today, when engineers say "Open/Closed Principle," they almost always mean the polymorphic version.

---

## Why It Matters

| Benefit | Explanation |
|---------|-------------|
| **Stability of Tested Code** | Once a module is written, tested, and deployed, OCP means it should not need to be modified to accommodate new features. The existing tests remain valid. |
| **Reduced Regression Risk** | Modifying existing code introduces the risk of breaking behavior that already works. OCP minimizes this by adding new code instead of changing old code. |
| **New Features Without Modification** | Adding a new payment method, discount type, or file format means creating a new class, not editing an existing one. |
| **Parallel Team Development** | Different developers can work on different implementations of the same interface simultaneously without merge conflicts. |
| **Plugin Architectures** | OCP is the foundation of plugin and extension systems where third-party code extends a system without modifying its core. |

---

## How It Works

### Example 1: Shape Area Calculator (TypeScript)

**BEFORE (OCP Violation):** A function uses a type discriminator and an `if/else` chain. Adding a new shape requires modifying this function.

```typescript
// VIOLATION: Every new shape requires modifying this function.
// This is "closed for extension, open for modification" — the opposite of OCP.

type ShapeData =
  | { type: "circle"; radius: number }
  | { type: "rectangle"; width: number; height: number };

function calculateArea(shape: ShapeData): number {
  if (shape.type === "circle") {
    return Math.PI * shape.radius ** 2;
  } else if (shape.type === "rectangle") {
    return shape.width * shape.height;
  }
  // Adding triangle? Must modify this function!
  // Adding hexagon? Must modify this function again!
  throw new Error(`Unknown shape type: ${(shape as any).type}`);
}

function calculateTotalArea(shapes: ShapeData[]): number {
  return shapes.reduce((sum, s) => sum + calculateArea(s), 0);
}
```

**AFTER (OCP Applied via Polymorphism):**

```typescript
// Abstract interface — the stable abstraction that is CLOSED for modification
interface Shape {
  area(): number;
}

// Each shape is OPEN for extension — add new shapes without touching existing code
class Circle implements Shape {
  constructor(private readonly radius: number) {}
  area(): number {
    return Math.PI * this.radius ** 2;
  }
}

class Rectangle implements Shape {
  constructor(
    private readonly width: number,
    private readonly height: number
  ) {}
  area(): number {
    return this.width * this.height;
  }
}

// Adding a new shape: no modification to Circle, Rectangle, or calculateTotalArea!
class Triangle implements Shape {
  constructor(
    private readonly base: number,
    private readonly height: number
  ) {}
  area(): number {
    return 0.5 * this.base * this.height;
  }
}

class Hexagon implements Shape {
  constructor(private readonly side: number) {}
  area(): number {
    return (3 * Math.sqrt(3) / 2) * this.side ** 2;
  }
}

// This function is CLOSED for modification — it works with any Shape implementation.
function calculateTotalArea(shapes: Shape[]): number {
  return shapes.reduce((sum, shape) => sum + shape.area(), 0);
}
```

---

### Example 2: Payment Processing (Python)

**BEFORE (OCP Violation):** A payment processor with an `if/elif` chain for each payment method.

```python
# VIOLATION: Adding a new payment method requires modifying process_payment().

class PaymentProcessor:
    def process_payment(self, amount: float, method: str, details: dict) -> bool:
        if method == "credit_card":
            card_number = details["card_number"]
            expiry = details["expiry"]
            cvv = details["cvv"]
            # ... call credit card gateway ...
            print(f"Charging ${amount} to card ending in {card_number[-4:]}")
            return True
        elif method == "paypal":
            email = details["email"]
            # ... call PayPal API ...
            print(f"Charging ${amount} via PayPal ({email})")
            return True
        elif method == "crypto":
            wallet = details["wallet_address"]
            # ... interact with blockchain ...
            print(f"Sending ${amount} to wallet {wallet[:8]}...")
            return True
        else:
            raise ValueError(f"Unsupported payment method: {method}")
```

**AFTER (OCP Applied via Strategy Pattern):**

```python
from abc import ABC, abstractmethod


# Abstract strategy — closed for modification
class PaymentStrategy(ABC):
    @abstractmethod
    def pay(self, amount: float) -> bool:
        """Process a payment of the given amount. Returns True on success."""
        ...

    @abstractmethod
    def name(self) -> str:
        """Human-readable name for logging."""
        ...


# Concrete strategies — open for extension
class CreditCardPayment(PaymentStrategy):
    def __init__(self, card_number: str, expiry: str, cvv: str):
        self._card_number = card_number
        self._expiry = expiry
        self._cvv = cvv

    def pay(self, amount: float) -> bool:
        # ... call credit card gateway ...
        print(f"Charging ${amount:.2f} to card ending in {self._card_number[-4:]}")
        return True

    def name(self) -> str:
        return f"CreditCard(****{self._card_number[-4:]})"


class PayPalPayment(PaymentStrategy):
    def __init__(self, email: str):
        self._email = email

    def pay(self, amount: float) -> bool:
        # ... call PayPal API ...
        print(f"Charging ${amount:.2f} via PayPal ({self._email})")
        return True

    def name(self) -> str:
        return f"PayPal({self._email})"


class CryptoPayment(PaymentStrategy):
    def __init__(self, wallet_address: str, currency: str = "BTC"):
        self._wallet = wallet_address
        self._currency = currency

    def pay(self, amount: float) -> bool:
        # ... interact with blockchain ...
        print(f"Sending ${amount:.2f} in {self._currency} to {self._wallet[:8]}...")
        return True

    def name(self) -> str:
        return f"Crypto({self._currency}:{self._wallet[:8]})"


# Adding ApplePay? Just create a new class — no modifications to anything above.
class ApplePayPayment(PaymentStrategy):
    def __init__(self, device_token: str):
        self._token = device_token

    def pay(self, amount: float) -> bool:
        print(f"Charging ${amount:.2f} via Apple Pay")
        return True

    def name(self) -> str:
        return "ApplePay"


# Processor is CLOSED — works with any PaymentStrategy, present or future.
class PaymentProcessor:
    def process_payment(self, amount: float, strategy: PaymentStrategy) -> bool:
        print(f"Processing payment of ${amount:.2f} via {strategy.name()}")
        return strategy.pay(amount)
```

---

### Example 3: Discount System (Java)

**BEFORE (OCP Violation):**

```java
// VIOLATION: switch on customer type — adding VIP requires modification.

public class DiscountCalculator {
    public double calculateDiscount(String customerType, double orderTotal) {
        switch (customerType) {
            case "regular":
                return orderTotal * 0.05;   // 5% discount
            case "premium":
                return orderTotal * 0.10;   // 10% discount
            // Adding "vip"? Must modify this method!
            default:
                return 0.0;
        }
    }
}
```

**AFTER (OCP Applied):**

```java
// Abstract strategy — stable abstraction
public interface DiscountStrategy {
    double calculateDiscount(double orderTotal);
    String customerType();
}

// Concrete implementations — each in its own file, independently testable
public class RegularDiscount implements DiscountStrategy {
    @Override
    public double calculateDiscount(double orderTotal) {
        return orderTotal * 0.05;
    }

    @Override
    public String customerType() { return "regular"; }
}

public class PremiumDiscount implements DiscountStrategy {
    @Override
    public double calculateDiscount(double orderTotal) {
        return orderTotal * 0.10;
    }

    @Override
    public String customerType() { return "premium"; }
}

// Adding VIP: new class, no modification to existing code!
public class VIPDiscount implements DiscountStrategy {
    @Override
    public double calculateDiscount(double orderTotal) {
        if (orderTotal > 500) {
            return orderTotal * 0.20;  // 20% for orders over $500
        }
        return orderTotal * 0.15;      // 15% otherwise
    }

    @Override
    public String customerType() { return "vip"; }
}

// Registry allows runtime lookup without if/else chains
public class DiscountRegistry {
    private final Map<String, DiscountStrategy> strategies = new HashMap<>();

    public void register(DiscountStrategy strategy) {
        strategies.put(strategy.customerType(), strategy);
    }

    public double calculateDiscount(String customerType, double orderTotal) {
        DiscountStrategy strategy = strategies.get(customerType);
        if (strategy == null) {
            return 0.0;
        }
        return strategy.calculateDiscount(orderTotal);
    }
}

// Usage:
// DiscountRegistry registry = new DiscountRegistry();
// registry.register(new RegularDiscount());
// registry.register(new PremiumDiscount());
// registry.register(new VIPDiscount());
// double discount = registry.calculateDiscount("vip", 600.0);
```

---

### Example 4: Middleware Pipeline (Go)

Go's idiomatic middleware pattern is inherently OCP-compliant. Each middleware is an independent function that wraps an `http.Handler`. Adding new middleware does not modify existing middleware or the pipeline infrastructure.

```go
package middleware

import (
    "log"
    "net/http"
    "time"
)

// Middleware type — the stable abstraction
type Middleware func(http.Handler) http.Handler

// Logging middleware — independent, self-contained
func Logging(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
    })
}

// Authentication middleware — independent, self-contained
func Authentication(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if token == "" {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        // ... validate token ...
        next.ServeHTTP(w, r)
    })
}

// Rate limiting middleware — added later without modifying Logging or Auth!
func RateLimiting(requestsPerSecond int) Middleware {
    limiter := rate.NewLimiter(rate.Limit(requestsPerSecond), requestsPerSecond)
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !limiter.Allow() {
                http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// Pipeline composition — the pipeline itself is closed for modification.
// Adding CORS support? Create a new middleware function. No changes here.
func BuildPipeline(handler http.Handler, middlewares ...Middleware) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        handler = middlewares[i](handler)
    }
    return handler
}

// Usage:
// pipeline := BuildPipeline(myHandler, Logging, Authentication, RateLimiting(100))
// http.ListenAndServe(":8080", pipeline)
```

---

### Example 5: Event Handlers (C#)

A plugin architecture where new event handlers can be registered without modifying the event system.

```csharp
// The stable abstraction — closed for modification
public interface IEventHandler<TEvent> where TEvent : class
{
    Task HandleAsync(TEvent eventData, CancellationToken ct = default);
}

// Base event type
public record OrderPlacedEvent(
    Guid OrderId,
    string CustomerEmail,
    decimal Total,
    DateTime PlacedAt
);

// Handler 1: Send confirmation email
public class OrderConfirmationHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly IEmailService _email;

    public OrderConfirmationHandler(IEmailService email) => _email = email;

    public async Task HandleAsync(OrderPlacedEvent e, CancellationToken ct)
    {
        await _email.SendAsync(
            e.CustomerEmail,
            "Order Confirmed",
            $"Your order {e.OrderId} for ${e.Total} has been placed."
        );
    }
}

// Handler 2: Update inventory
public class InventoryUpdateHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly IInventoryService _inventory;

    public InventoryUpdateHandler(IInventoryService inventory) => _inventory = inventory;

    public async Task HandleAsync(OrderPlacedEvent e, CancellationToken ct)
    {
        await _inventory.ReserveStockAsync(e.OrderId, ct);
    }
}

// Handler 3: Added LATER — no modification to any existing handler or the dispatcher!
public class LoyaltyPointsHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly ILoyaltyService _loyalty;

    public LoyaltyPointsHandler(ILoyaltyService loyalty) => _loyalty = loyalty;

    public async Task HandleAsync(OrderPlacedEvent e, CancellationToken ct)
    {
        int points = (int)(e.Total * 10); // 10 points per dollar
        await _loyalty.AwardPointsAsync(e.CustomerEmail, points, ct);
    }
}

// Event dispatcher — CLOSED for modification. Works with any number of handlers.
public class EventDispatcher
{
    private readonly IServiceProvider _provider;

    public EventDispatcher(IServiceProvider provider) => _provider = provider;

    public async Task DispatchAsync<TEvent>(TEvent eventData, CancellationToken ct = default)
        where TEvent : class
    {
        var handlers = _provider.GetServices<IEventHandler<TEvent>>();
        foreach (var handler in handlers)
        {
            await handler.HandleAsync(eventData, ct);
        }
    }
}

// Registration via DI container (ASP.NET Core):
// services.AddTransient<IEventHandler<OrderPlacedEvent>, OrderConfirmationHandler>();
// services.AddTransient<IEventHandler<OrderPlacedEvent>, InventoryUpdateHandler>();
// services.AddTransient<IEventHandler<OrderPlacedEvent>, LoyaltyPointsHandler>();
```

---

## Techniques to Achieve OCP

| # | Technique | How It Achieves OCP | Best For |
|---|-----------|--------------------|---------|
| 1 | **Strategy Pattern** | Encapsulate a family of algorithms behind an interface. New algorithms are added as new implementations without modifying clients. | Interchangeable behaviors (sorting, payment, validation) |
| 2 | **Template Method Pattern** | Define the skeleton of an algorithm in a base class; let subclasses override specific steps without changing the overall structure. | Algorithms with fixed structure but variable steps |
| 3 | **Decorator Pattern** | Wrap an object to add behavior dynamically. Each decorator is independent and composable. Adding a new decorator does not modify existing ones. | Cross-cutting concerns (logging, caching, retry) |
| 4 | **Plugin Architecture** | Define extension points (interfaces or hooks). Plugins implement these extension points and are loaded/registered at runtime. | Extensible applications (IDEs, CMS, build tools) |
| 5 | **Higher-Order Functions (FP)** | Pass behavior as function parameters. The receiving function is closed; the passed function provides the extension. | Functional languages, data transformation pipelines |
| 6 | **Generics / Templates** | Parameterize types so that algorithms work with any type that satisfies constraints, without modifying the algorithm when new types appear. | Type-safe collections, serialization, generic algorithms |

### Higher-Order Functions Example (TypeScript)

```typescript
// The filter function is CLOSED — it never changes.
// The predicate parameter makes it OPEN for extension.
function filterItems<T>(items: T[], predicate: (item: T) => boolean): T[] {
  return items.filter(predicate);
}

// Extension via new predicates — no modification to filterItems:
const expensiveItems = filterItems(products, (p) => p.price > 100);
const inStockItems = filterItems(products, (p) => p.stock > 0);
const discountedItems = filterItems(products, (p) => p.discount > 0);
```

### Decorator Example (Python)

```python
from abc import ABC, abstractmethod


class DataSource(ABC):
    @abstractmethod
    def write(self, data: bytes) -> None: ...

    @abstractmethod
    def read(self) -> bytes: ...


class FileDataSource(DataSource):
    def __init__(self, path: str):
        self._path = path

    def write(self, data: bytes) -> None:
        with open(self._path, "wb") as f:
            f.write(data)

    def read(self) -> bytes:
        with open(self._path, "rb") as f:
            return f.read()


# Decorator base — wraps any DataSource
class DataSourceDecorator(DataSource):
    def __init__(self, wrapped: DataSource):
        self._wrapped = wrapped

    def write(self, data: bytes) -> None:
        self._wrapped.write(data)

    def read(self) -> bytes:
        return self._wrapped.read()


# Adding encryption — no modification to FileDataSource!
class EncryptionDecorator(DataSourceDecorator):
    def write(self, data: bytes) -> None:
        encrypted = self._encrypt(data)
        super().write(encrypted)

    def read(self) -> bytes:
        return self._decrypt(super().read())

    def _encrypt(self, data: bytes) -> bytes: ...
    def _decrypt(self, data: bytes) -> bytes: ...


# Adding compression — no modification to FileDataSource or EncryptionDecorator!
class CompressionDecorator(DataSourceDecorator):
    def write(self, data: bytes) -> None:
        compressed = zlib.compress(data)
        super().write(compressed)

    def read(self) -> bytes:
        return zlib.decompress(super().read())


# Compose decorators:
# source = CompressionDecorator(EncryptionDecorator(FileDataSource("data.bin")))
# source.write(b"Hello, world!")
```

---

## Meyer's OCP vs Martin's OCP

| Aspect | Meyer (1988) | Martin (1996) |
|--------|-------------|---------------|
| **Mechanism** | Implementation inheritance | Abstract interfaces + polymorphism |
| **"Open" means** | Subclass and add/override behavior | Implement new concrete class behind an interface |
| **"Closed" means** | Published class is never modified | Client code that depends on the interface is never modified |
| **Coupling** | Subclass tightly coupled to parent internals | Implementation coupled only to interface contract |
| **Fragile Base Class** | High risk — parent changes cascade to all subclasses | Low risk — interface is a thin, stable contract |
| **Recommended today?** | Rarely — deep inheritance is generally discouraged | Yes — this is the standard modern interpretation |
| **Language support** | Requires inheritance (class-based OOP) | Works with interfaces, traits, protocols, typeclasses, function signatures |

---

## When OCP Is Overkill

OCP introduces abstraction, and abstraction has a cost: indirection, additional files, more complex dependency graphs. It is not always worth paying that cost.

**OCP is overkill when:**

| Scenario | Why OCP Is Unnecessary |
|----------|----------------------|
| **Simple CRUD applications** | If the entity types are stable and the business logic is trivial, adding interfaces for every operation adds complexity without benefit. |
| **One-off scripts and prototypes** | Code that will be run once or discarded does not need to be designed for future extension. |
| **Stable, well-understood domains** | If the requirements are known and unlikely to change (e.g., a mathematical library computing trigonometric functions), OCP adds unnecessary indirection. |
| **Performance-critical inner loops** | Virtual dispatch and interface indirection have a (small) runtime cost. In tight loops where nanoseconds matter, concrete types may be preferred. |
| **Very early in a project** | Before the axes of change are clear, introducing abstractions is a form of **premature generalization**. It is often better to write concrete code first, then refactor to abstractions when the second or third variation appears. |

---

## The Strategic Closure

A key insight from Robert Martin is that **you cannot close a module against all possible kinds of change**. Every abstraction protects against some axes of change while leaving others open.

> *"No significant program can be 100% closed. [...] Since closure cannot be complete, it must be strategic. That is, the designer must choose the kinds of changes against which to close the design, must guess at the kinds of changes that are most likely, and then construct abstractions to protect against those changes."*
> — Robert C. Martin, *"The Open-Closed Principle"* (1996)

### Practical Guidance

1. **Identify the most likely axes of change** based on business requirements, historical change patterns, and domain knowledge.
2. **Create abstractions along those axes.** If new payment methods are likely, abstract the payment strategy. If new output formats are likely, abstract the formatter.
3. **Leave stable axes concrete.** If the tax calculation rules are mandated by law and change once a year, a simple implementation may be sufficient.
4. **Refactor toward OCP when a second variation appears.** The first `if/else` is acceptable. When the second appears, refactor to a strategy. This follows the **Rule of Three**: wait for the pattern to emerge before abstracting.

```
First variation:     Write concrete code
Second variation:    Notice the pattern, consider abstracting
Third variation:     Refactor — the axis of change is now clear
```

---

## OCP and the Expression Problem

The Expression Problem (coined by Philip Wadler, 1998) highlights a fundamental tension in programming language design:

- **OOP (OCP via subtypes)** makes it easy to add new data types (new class implementing the interface) but hard to add new operations (must modify every class).
- **FP (pattern matching)** makes it easy to add new operations (new function) but hard to add new data types (must modify every function's pattern match).

OCP addresses only one axis of this problem. Being aware of the Expression Problem helps you choose the right axis to keep open based on what is more likely to change in your domain:

| If new **types** are more likely... | If new **operations** are more likely... |
|-------------------------------------|------------------------------------------|
| Use OOP polymorphism (OCP via interfaces) | Use FP with pattern matching or visitor pattern |
| Example: new payment methods, new shapes | Example: new report formats, new analysis algorithms |

---

## Relationship to Other Principles

| Related Principle | Relationship |
|-------------------|-------------|
| **SRP** | SRP makes OCP easier. A class with a single responsibility has fewer reasons to change, making it simpler to identify the right abstraction to close it against. |
| **LSP** | LSP is a prerequisite for OCP. If subtypes cannot be substituted for their base types, polymorphic extension breaks. The OCP mechanism depends on LSP correctness. |
| **ISP** | ISP ensures that the abstractions used for OCP are lean and focused. A fat interface makes OCP harder because new implementations must satisfy irrelevant methods. |
| **DIP** | DIP and OCP are two sides of the same coin. DIP says "depend on abstractions"; OCP says "extend through abstractions." You typically need both together. |

---

## Sources

1. **Meyer, B.** (1988). *Object-Oriented Software Construction.* Prentice Hall. — Original formulation of the Open/Closed Principle using implementation inheritance.
2. **Meyer, B.** (1997). *Object-Oriented Software Construction,* 2nd Edition. Prentice Hall. — Expanded treatment including design by contract.
3. **Martin, R.C.** (1996). *"The Open-Closed Principle."* The C++ Report. Also available at butunclebob.com. — Polymorphic reinterpretation of OCP using abstract interfaces.
4. **Martin, R.C.** (2002). *Agile Software Development: Principles, Patterns, and Practices.* Prentice Hall. — Comprehensive treatment of OCP with examples in Java and C++.
5. **Martin, R.C.** (2017). *Clean Architecture.* Prentice Hall, Chapter 8. — OCP elevated to the architectural level.
6. **Gamma, E., Helm, R., Johnson, R., & Vlissides, J.** (1994). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — Strategy, Template Method, and Decorator patterns that implement OCP.
7. **Wadler, P.** (1998). *"The Expression Problem."* Email to the Java Genericity mailing list. — Articulation of the fundamental tension between adding new types vs. new operations.
8. **Fowler, M.** (1999, 2018). *Refactoring.* Addison-Wesley. — Refactoring techniques such as "Replace Conditional with Polymorphism" that move code toward OCP compliance.
9. **Stackify.** *"SOLID Design Principles Explained: The Open/Closed Principle with Code Examples."* https://stackify.com/solid-design-open-closed-principle/ — Practical tutorial with Java examples.
10. **Wikipedia.** *"Open-closed principle."* https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle — Community overview with references to Meyer and Martin formulations.
