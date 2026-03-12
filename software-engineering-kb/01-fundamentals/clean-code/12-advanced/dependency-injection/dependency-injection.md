# Dependency Injection

> **Domain:** Fundamentals > Clean Code > Advanced
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Dependency Injection (DI) is a technique where an object's dependencies are provided from the outside rather than created internally. It's the practical implementation of the Dependency Inversion Principle (DIP).

### Three Forms of DI

| Form | Description | Recommendation |
|------|-------------|---------------|
| **Constructor Injection** | Dependencies passed via constructor | Preferred — explicit, immutable |
| **Property/Setter Injection** | Dependencies set via properties | For optional dependencies only |
| **Method Injection** | Dependencies passed per method call | For per-operation dependencies |

## Why It Matters

- **Testability:** Inject mocks/stubs for unit testing without real databases or APIs.
- **Flexibility:** Swap implementations (PostgreSQL → MongoDB) without changing business logic.
- **Explicit dependencies:** Constructor injection makes all dependencies visible.

## How It Works

### Constructor Injection (Preferred)

```typescript
// Dependencies are explicit and required
class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly notifier: Notifier
  ) {}

  async placeOrder(dto: CreateOrderDto): Promise<Order> {
    const order = Order.create(dto);
    await this.repository.save(order);
    await this.paymentGateway.charge(order.total);
    await this.notifier.orderPlaced(order);
    return order;
  }
}

// Composition Root — where everything is wired together
const repository = new PostgresOrderRepository(pool);
const gateway = new StripePaymentGateway(stripeClient);
const notifier = new EmailNotifier(mailer);
const service = new OrderService(repository, gateway, notifier);
```

### DI Containers

**Spring (Java):**
```java
@Service
public class OrderService {
    private final OrderRepository repository;

    @Autowired
    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }
}
```

**ASP.NET Core:**
```csharp
builder.Services.AddScoped<IOrderRepository, PostgresOrderRepository>();
builder.Services.AddScoped<OrderService>();
```

### Pure DI vs. Container-Based DI

Mark Seemann (*Dependency Injection: Principles, Practices, and Patterns*) advocates **Pure DI** — wiring dependencies manually at the composition root without a container. Containers add complexity and magic; Pure DI is explicit and debuggable.

### Service Locator (Anti-pattern)

```typescript
// BAD: Service Locator — hidden dependencies, hard to test
class OrderService {
  placeOrder(dto: CreateOrderDto) {
    const repo = ServiceLocator.get<OrderRepository>(); // Hidden!
    const gateway = ServiceLocator.get<PaymentGateway>(); // Hidden!
  }
}

// GOOD: Constructor injection — explicit dependencies
class OrderService {
  constructor(
    private repo: OrderRepository,
    private gateway: PaymentGateway
  ) {}
}
```

## Best Practices

1. **Prefer constructor injection.** It makes dependencies explicit and objects immutable.
2. **Wire at the Composition Root** — the entry point of the application (main function, startup class).
3. **Avoid Service Locator.** It hides dependencies and makes testing harder.
4. **Manage lifetimes explicitly** — transient (new every time), scoped (per request), singleton (shared).
5. **Don't over-inject.** If a class needs 7+ dependencies, it probably has too many responsibilities.

## Sources

- Seemann, M. (2019). *Dependency Injection: Principles, Practices, and Patterns*. Manning.
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall.
- [Google Testing Blog — Dependency Injection](https://testing.googleblog.com/2008/11/clean-code-talks-dependency-injection.html)
