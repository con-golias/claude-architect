# Coupling

> **Domain:** Fundamentals > Clean Code > Classes and Objects
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Coupling measures the **degree of interdependence between software modules**. It was first formally described by Larry Constantine and Edward Yourdon in *Structured Design* (1979).

Low coupling (loose) means modules can change independently. High coupling (tight) means a change in one module forces changes in others. Clean code strives for **loose coupling**.

### Types of Coupling (Worst to Best)

| Type | Description | Severity |
|------|-------------|----------|
| **Content Coupling** | Module directly accesses internals of another | Worst |
| **Common Coupling** | Modules share global data | Very Bad |
| **Control Coupling** | One module controls flow of another via flags | Bad |
| **Stamp Coupling** | Modules share a data structure but use only parts | Moderate |
| **Data Coupling** | Modules share only necessary data via parameters | Good |
| **Message Coupling** | Modules communicate via messages/events | Best |

## Why It Matters

Tight coupling causes: cascade failures (one change breaks many modules), difficult testing (can't test in isolation), reduced reuse (can't use module without its dependencies), and merge conflicts (teams stepping on each other).

## How It Works

### Tight Coupling Example

```typescript
// BAD: OrderService is tightly coupled to specific implementations
class OrderService {
  private db = new PostgresDatabase();     // Concrete dependency
  private mailer = new SendGridMailer();   // Concrete dependency
  private logger = new WinstonLogger();    // Concrete dependency

  async createOrder(data: OrderData): Promise<Order> {
    this.logger.info('Creating order');
    const order = new Order(data);
    await this.db.query('INSERT INTO orders...', order); // SQL knowledge leaked
    await this.mailer.send(data.email, 'Order Confirmed');
    return order;
  }
}
```

### Loose Coupling via Dependency Injection

```typescript
// GOOD: Depends on abstractions, injected from outside
class OrderService {
  constructor(
    private repository: OrderRepository,
    private notifier: OrderNotifier,
    private logger: Logger
  ) {}

  async createOrder(data: OrderData): Promise<Order> {
    this.logger.info('Creating order');
    const order = Order.create(data);
    await this.repository.save(order);
    await this.notifier.orderCreated(order);
    return order;
  }
}
```

### Python Example: Event-Based Decoupling

```python
# TIGHT: Direct dependency chain
class UserService:
    def register(self, user_data):
        user = self.repo.save(user_data)
        self.email_service.send_welcome(user)     # Direct coupling
        self.analytics.track_signup(user)          # Direct coupling
        self.notification.notify_admins(user)      # Direct coupling

# LOOSE: Event-based decoupling
class UserService:
    def __init__(self, repo, event_bus):
        self.repo = repo
        self.event_bus = event_bus

    def register(self, user_data):
        user = self.repo.save(user_data)
        self.event_bus.publish(UserRegistered(user))  # Fire and forget
```

### Metrics

- **CBO (Coupling Between Objects):** Count of classes a class depends on. Target: < 10.
- **Afferent Coupling (Ca):** Number of classes that depend on this class (incoming).
- **Efferent Coupling (Ce):** Number of classes this class depends on (outgoing).
- **Instability = Ce / (Ca + Ce):** 0 = maximally stable, 1 = maximally unstable.

## Best Practices

1. **Depend on abstractions** (interfaces), not concrete implementations.
2. **Use dependency injection** to provide dependencies from outside.
3. **Prefer events/messages** for cross-module communication.
4. **Apply the Interface Segregation Principle** to keep dependencies minimal.
5. **Follow the Dependency Rule** (Clean Architecture) — dependencies point inward.

## Anti-patterns / Common Mistakes

- **Temporal Coupling:** Functions that must be called in a specific order with no enforcement.
- **Hidden Coupling:** Global state, singletons, service locators that hide dependencies.
- **Inappropriate Intimacy:** Classes that access each other's private internals.

## Sources

- Constantine, L. & Yourdon, E. (1979). *Structured Design*. Prentice-Hall.
- Martin, R.C. (2008). *Clean Code*. Prentice Hall.
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall.
