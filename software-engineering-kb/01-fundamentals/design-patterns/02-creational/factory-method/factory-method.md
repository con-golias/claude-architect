# Factory Method Pattern

> **Domain:** Fundamentals > Design Patterns > Creational
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Factory Method pattern defines an interface for creating objects, but lets **subclasses decide which class to instantiate**. It delegates the responsibility of object creation to subclasses, promoting loose coupling between the creator and the concrete products.

**GoF Intent:** "Define an interface for creating an object, but let subclasses decide which class to instantiate. Factory Method lets a class defer instantiation to subclasses."

## Why It Matters

- **Decouples creation from usage** — client code works with the interface, not concrete classes.
- **Open/Closed Principle** — add new product types without modifying existing code.
- **Centralizes creation logic** — makes it easy to change how objects are created.
- **One of the most commonly used patterns** — appears in virtually every framework.

## How It Works

### Structure

```
Creator (abstract)               Product (interface)
├── factoryMethod(): Product     ├── operation()
├── someOperation()              │
│   └── uses factoryMethod()     │
│                                │
ConcreteCreatorA                 ConcreteProductA
├── factoryMethod()              ├── operation()
│   └── return new ProductA()    │
│                                │
ConcreteCreatorB                 ConcreteProductB
├── factoryMethod()              ├── operation()
│   └── return new ProductB()    │
```

### Implementation

```typescript
// Product interface
interface Notification {
  send(message: string): void;
}

// Concrete products
class EmailNotification implements Notification {
  send(message: string): void {
    console.log(`Email: ${message}`);
  }
}

class SMSNotification implements Notification {
  send(message: string): void {
    console.log(`SMS: ${message}`);
  }
}

class PushNotification implements Notification {
  send(message: string): void {
    console.log(`Push: ${message}`);
  }
}

// Factory Method
class NotificationFactory {
  static create(type: "email" | "sms" | "push"): Notification {
    switch (type) {
      case "email": return new EmailNotification();
      case "sms":   return new SMSNotification();
      case "push":  return new PushNotification();
      default:      throw new Error(`Unknown type: ${type}`);
    }
  }
}

// Client code — doesn't know about concrete classes
const notification = NotificationFactory.create("email");
notification.send("Hello!");
```

```python
from abc import ABC, abstractmethod

class Document(ABC):
    @abstractmethod
    def render(self) -> str:
        pass

class PDFDocument(Document):
    def render(self) -> str:
        return "Rendering PDF..."

class HTMLDocument(Document):
    def render(self) -> str:
        return "Rendering HTML..."

# Factory Method via subclassing
class DocumentCreator(ABC):
    @abstractmethod
    def create_document(self) -> Document:
        pass

    def open(self) -> str:
        doc = self.create_document()  # factory method
        return doc.render()

class PDFCreator(DocumentCreator):
    def create_document(self) -> Document:
        return PDFDocument()

class HTMLCreator(DocumentCreator):
    def create_document(self) -> Document:
        return HTMLDocument()
```

```java
// Java with generics
public interface PaymentProcessor {
    void process(BigDecimal amount);
}

public class PaymentProcessorFactory {
    private static final Map<String, Supplier<PaymentProcessor>> registry = Map.of(
        "stripe", StripeProcessor::new,
        "paypal", PayPalProcessor::new,
        "square", SquareProcessor::new
    );

    public static PaymentProcessor create(String provider) {
        Supplier<PaymentProcessor> supplier = registry.get(provider);
        if (supplier == null) throw new IllegalArgumentException("Unknown: " + provider);
        return supplier.get();
    }
}
```

### Simple Factory vs Factory Method vs Abstract Factory

| Pattern | Creates | Decision by | Use when |
|---------|---------|------------|----------|
| **Simple Factory** | One product | A static method | Basic conditional creation |
| **Factory Method** | One product | Subclasses | Subclass-driven creation |
| **Abstract Factory** | Family of products | Factory object | Platform/theme families |

## Best Practices

1. **Use when the exact class varies at runtime** — configuration-driven or user-driven choices.
2. **Return interfaces, not concrete types** — keeps client code decoupled.
3. **Consider a registry** — use a `Map<String, Supplier<T>>` for open/extensible factories.
4. **Combine with DI** — Spring and Angular use factories internally for dependency injection.

## Anti-patterns / Common Mistakes

- **Overusing factories** — if there's only one concrete type, a factory adds unnecessary complexity.
- **Giant switch statements** — consider a registry or plugin system instead.
- **Returning concrete types** — defeats the purpose of decoupling.
- **Confusing with Abstract Factory** — Factory Method creates one product; Abstract Factory creates families.

## Real-world Examples

- **`document.createElement("div")`** — browser DOM factory method.
- **`java.util.Calendar.getInstance()`** — returns locale-appropriate calendar.
- **Spring `BeanFactory`** — creates beans based on configuration.
- **React `createElement()`** — factory for creating React elements.
- **`LoggerFactory.getLogger()`** (SLF4J) — creates appropriate logger implementation.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 107-116.
- [Refactoring.Guru — Factory Method](https://refactoring.guru/design-patterns/factory-method)
- [Baeldung — Design Patterns in Spring](https://www.baeldung.com/spring-framework-design-patterns)
