# Dependency Inversion Principle (DIP)

> **Domain:** Fundamentals > Clean Code > Principles > SOLID
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

The Dependency Inversion Principle (DIP) is the fifth and final SOLID principle, formulated by Robert C. Martin:

> "A. High-level modules should not depend on low-level modules. Both should depend on abstractions."
> "B. Abstractions should not depend on details. Details should depend on abstractions."

In traditional layered architecture, high-level business logic depends directly on low-level infrastructure (databases, APIs, file systems). DIP **inverts** this relationship: both layers depend on abstractions (interfaces), and the high-level module **owns** the abstraction.

### Key Distinction: DIP vs. DI vs. IoC

| Concept | What It Is |
|---------|-----------|
| **DIP** (Dependency Inversion Principle) | A design principle — depend on abstractions |
| **DI** (Dependency Injection) | A technique — pass dependencies from outside |
| **IoC** (Inversion of Control) | A pattern — framework calls your code, not the other way around |

DIP is the *why*, DI is the *how*, and IoC is the broader pattern.

## Why It Matters

### Decoupling
High-level business logic is completely independent of infrastructure details. You can swap databases, APIs, or file systems without touching business code.

### Testability
By depending on abstractions, you can inject mock implementations in tests without complex setup.

### Architectural Flexibility
DIP is the foundation of Clean Architecture, Hexagonal Architecture (Ports & Adapters), and Onion Architecture. The dependency rule always points inward — toward the domain.

### Plugin Architecture
DIP enables plugin-based systems where new implementations can be plugged in without modifying the core.

## How It Works

### Example: Violation

```typescript
// BAD: High-level OrderService depends directly on low-level MySQLDatabase
class MySQLDatabase {
  save(data: any): void {
    // MySQL-specific implementation
  }
}

class OrderService {
  private db = new MySQLDatabase(); // Direct dependency on concrete class!

  createOrder(order: Order): void {
    this.db.save(order); // Tightly coupled to MySQL
  }
}
// Problem: To switch to PostgreSQL, you must modify OrderService
```

### Example: Fixed with DIP

```typescript
// GOOD: Both depend on the abstraction
interface OrderRepository {
  save(order: Order): void;
  findById(id: string): Order | null;
}

// High-level: depends on abstraction
class OrderService {
  constructor(private repository: OrderRepository) {}

  createOrder(order: Order): void {
    this.repository.save(order);
  }
}

// Low-level: implements abstraction
class MySQLOrderRepository implements OrderRepository {
  save(order: Order): void { /* MySQL implementation */ }
  findById(id: string): Order | null { /* MySQL query */ }
}

class MongoOrderRepository implements OrderRepository {
  save(order: Order): void { /* MongoDB implementation */ }
  findById(id: string): Order | null { /* MongoDB query */ }
}

// Wiring (composition root)
const repository = new MySQLOrderRepository();
const service = new OrderService(repository);
```

### Python Example

```python
from abc import ABC, abstractmethod

# Abstraction owned by the high-level module
class NotificationSender(ABC):
    @abstractmethod
    def send(self, recipient: str, message: str) -> None:
        pass

# High-level module depends on abstraction
class UserRegistrationService:
    def __init__(self, notifier: NotificationSender):
        self.notifier = notifier

    def register(self, user: User) -> None:
        # Business logic
        save_user(user)
        self.notifier.send(user.email, "Welcome!")

# Low-level implementations
class EmailNotifier(NotificationSender):
    def send(self, recipient: str, message: str) -> None:
        smtp_client.send_email(recipient, message)

class SMSNotifier(NotificationSender):
    def send(self, recipient: str, message: str) -> None:
        twilio_client.send_sms(recipient, message)

class SlackNotifier(NotificationSender):
    def send(self, recipient: str, message: str) -> None:
        slack_api.post_message(recipient, message)

# Easy to test:
class FakeNotifier(NotificationSender):
    def __init__(self):
        self.sent_messages = []

    def send(self, recipient: str, message: str) -> None:
        self.sent_messages.append((recipient, message))
```

### Java Example: Spring DI

```java
// Abstraction
public interface PaymentGateway {
    PaymentResult charge(Money amount, PaymentMethod method);
}

// High-level service
@Service
public class CheckoutService {
    private final PaymentGateway gateway;

    @Autowired  // Spring injects the implementation
    public CheckoutService(PaymentGateway gateway) {
        this.gateway = gateway;
    }

    public OrderConfirmation checkout(Cart cart) {
        Money total = cart.calculateTotal();
        PaymentResult result = gateway.charge(total, cart.getPaymentMethod());
        return new OrderConfirmation(result);
    }
}

// Low-level implementation
@Component
public class StripePaymentGateway implements PaymentGateway {
    @Override
    public PaymentResult charge(Money amount, PaymentMethod method) {
        // Stripe API call
    }
}
```

## Best Practices

1. **The abstraction belongs to the high-level module.** The business layer defines the interface; the infrastructure layer implements it. This is what makes it an "inversion."

2. **Use constructor injection.** It makes dependencies explicit, required, and immutable.

3. **Wire dependencies at the composition root.** The entry point of the application (main function, DI container configuration) is where you connect abstractions to implementations.

4. **Don't depend on concrete classes for cross-cutting concerns** — logging, caching, and metrics should all go through abstractions.

5. **Apply DIP at architectural boundaries.** Between layers (domain ↔ infrastructure), between modules, and between services.

6. **Avoid the Service Locator anti-pattern.** Don't have classes pull their dependencies from a global registry. Instead, inject dependencies explicitly.

7. **Keep interfaces stable.** The abstraction is a contract. Changing it forces changes in all implementations. Design it carefully.

## Anti-patterns / Common Mistakes

### Service Locator
```typescript
// BAD: Hidden dependency — hard to test, hard to reason about
class OrderService {
  createOrder(order: Order): void {
    const db = ServiceLocator.get<Database>('database'); // Hidden!
    db.save(order);
  }
}

// GOOD: Explicit dependency
class OrderService {
  constructor(private db: Database) {}
  createOrder(order: Order): void {
    this.db.save(order);
  }
}
```

### Leaking Infrastructure into Domain
```python
# BAD: Domain model knows about SQLAlchemy
class User(db.Model):  # Inherits from ORM base class
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)

# GOOD: Pure domain model
class User:
    def __init__(self, id: str, name: str, email: str):
        self.id = id
        self.name = name
        self.email = email
```

### Over-Abstracting Simple Cases
Not everything needs an interface. If a class has no foreseeable alternative implementations and isn't a boundary concern, direct dependency is fine.

## Real-world Examples

### Clean Architecture
Robert C. Martin's Clean Architecture is built on DIP. The inner circle (entities, use cases) defines interfaces, and the outer circle (frameworks, databases) implements them. Dependencies always point inward.

### Spring Framework (Java)
Spring's entire DI container is built around DIP. Beans declare their dependencies through interfaces, and Spring wires the implementations at startup.

### ASP.NET Core
Microsoft's ASP.NET Core has a built-in DI container. Services are registered in `Startup.cs` and injected into controllers and services through constructor injection.

### Hexagonal Architecture
Ports (interfaces defined by the domain) and Adapters (implementations for specific technologies) are a direct application of DIP.

## Sources

- Martin, R.C. (1996). *The Dependency Inversion Principle*. C++ Report.
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall.
- Seemann, M. (2019). *Dependency Injection: Principles, Practices, and Patterns*. Manning.
- [Google Testing Blog — Dependency Injection](https://testing.googleblog.com/2008/11/clean-code-talks-dependency-injection.html)
- [Dependency Injection in ASP.NET Core](https://codewithmukesh.com/blog/dependency-injection-in-aspnet-core-explained/)
