# Dependency Injection (DI)

> **Domain:** Fundamentals > Design Patterns > Architectural
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Dependency Injection is a technique where an object **receives its dependencies from the outside** rather than creating them internally. Instead of a class instantiating the services it needs, those services are "injected" — typically via constructor parameters, setters, or a DI container. This inverts the control of dependency creation (Inversion of Control), making code more testable, modular, and loosely coupled.

**Origin:** Coined by Martin Fowler in 2004 in his article *Inversion of Control Containers and the Dependency Injection Pattern*. The concept of IoC predates it, but DI gave it a concrete, practical form.

## How It Works

### Three Injection Styles

```typescript
// 1. Constructor Injection (preferred — dependencies are explicit and required)
class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly emailService: EmailService
  ) {}

  async placeOrder(cart: Cart): Promise<Order> {
    const order = Order.fromCart(cart);
    await this.orderRepo.save(order);
    await this.paymentGateway.charge(order.total, cart.paymentMethod);
    await this.emailService.sendConfirmation(order);
    return order;
  }
}

// 2. Setter Injection (optional dependencies)
class ReportGenerator {
  private logger: Logger = new NullLogger();  // default

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  generate(data: Data[]): Report {
    this.logger.info("Generating report...");
    // ...
  }
}

// 3. Interface Injection (less common — interface defines the injection method)
interface LoggerAware {
  setLogger(logger: Logger): void;
}
```

### Manual DI (No Framework)

```typescript
// Without DI — tightly coupled, untestable
class UserService {
  private repo = new PostgresUserRepository();   // hardcoded
  private mailer = new SendGridMailer();          // hardcoded

  async register(email: string): Promise<void> {
    await this.repo.save({ email });
    await this.mailer.send(email, "Welcome!");
  }
}

// With DI — loosely coupled, testable
class UserService {
  constructor(
    private repo: UserRepository,    // interface, not implementation
    private mailer: Mailer           // interface, not implementation
  ) {}

  async register(email: string): Promise<void> {
    await this.repo.save({ email });
    await this.mailer.send(email, "Welcome!");
  }
}

// Composition root — wire dependencies in one place
function createApp(): App {
  const db = new PostgresPool(config.dbUrl);
  const repo = new PostgresUserRepository(db);
  const mailer = new SendGridMailer(config.sendgridKey);
  const userService = new UserService(repo, mailer);
  const userController = new UserController(userService);
  return new App(userController);
}

// Testing — inject fakes
const service = new UserService(
  new InMemoryUserRepository(),
  new FakeMailer()
);
```

```python
# Python — DI with protocols and manual wiring
from typing import Protocol

class NotificationSender(Protocol):
    def send(self, to: str, message: str) -> None: ...

class EmailSender:
    def __init__(self, smtp_host: str):
        self.smtp_host = smtp_host

    def send(self, to: str, message: str) -> None:
        # send via SMTP
        pass

class SMSSender:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def send(self, to: str, message: str) -> None:
        # send via SMS API
        pass

class AlertService:
    def __init__(self, sender: NotificationSender):  # depends on protocol
        self.sender = sender

    def alert(self, user: str, message: str):
        self.sender.send(user, f"ALERT: {message}")

# Wire up
email_sender = EmailSender("smtp.example.com")
alert_service = AlertService(email_sender)

# Test
class FakeSender:
    def __init__(self):
        self.sent: list[tuple[str, str]] = []

    def send(self, to: str, message: str) -> None:
        self.sent.append((to, message))

fake = FakeSender()
service = AlertService(fake)
service.alert("user@test.com", "Server down")
assert len(fake.sent) == 1
```

### DI Containers (Framework-Managed)

```java
// Spring Framework — annotation-based DI
@Service
public class PaymentService {
    private final PaymentGateway gateway;
    private final TransactionRepository txRepo;

    @Autowired  // Spring injects these automatically
    public PaymentService(PaymentGateway gateway, TransactionRepository txRepo) {
        this.gateway = gateway;
        this.txRepo = txRepo;
    }

    public Receipt processPayment(Order order) {
        Receipt receipt = gateway.charge(order.getTotal());
        txRepo.save(new Transaction(order.getId(), receipt));
        return receipt;
    }
}

// Configuration — tell Spring which implementation to use
@Configuration
public class PaymentConfig {
    @Bean
    @Profile("production")
    public PaymentGateway stripeGateway() {
        return new StripeGateway(System.getenv("STRIPE_KEY"));
    }

    @Bean
    @Profile("test")
    public PaymentGateway mockGateway() {
        return new MockPaymentGateway();
    }
}
```

```typescript
// NestJS — TypeScript DI container
@Injectable()
class CacheService {
  private store = new Map<string, any>();

  get(key: string): any { return this.store.get(key); }
  set(key: string, value: any): void { this.store.set(key, value); }
}

@Injectable()
class ProductService {
  constructor(
    private readonly repo: ProductRepository,
    private readonly cache: CacheService
  ) {}

  async findById(id: string): Promise<Product> {
    const cached = this.cache.get(`product:${id}`);
    if (cached) return cached;

    const product = await this.repo.findById(id);
    this.cache.set(`product:${id}`, product);
    return product;
  }
}

@Module({
  providers: [ProductService, CacheService, ProductRepository],
  controllers: [ProductController],
})
class ProductModule {}
```

### DI Anti-patterns

```
Service Locator:       ServiceLocator.get(UserRepo)  — hides dependencies
                       Use constructor injection instead

God Container:         Container resolves everything everywhere
                       Wire at composition root only

Over-injection:        Constructor with 10+ dependencies
                       Class is doing too much — split it

Injecting runtime data: new Service(userId)  — DI is for services, not data
                        Pass data as method parameters
```

## Real-world Examples

- **Spring Framework** — `@Autowired`, `@Component`, `@Bean` — the most mature DI container.
- **Angular** — built-in hierarchical DI with `@Injectable()` and providers.
- **NestJS** — Spring-inspired DI for Node.js with decorators.
- **ASP.NET Core** — `IServiceCollection` with `AddScoped`, `AddSingleton`, `AddTransient`.
- **Dagger (Android)** — compile-time DI with code generation for performance.
- **Python `dependency-injector`** — container-based DI for Python applications.
- **Go `wire`** — compile-time DI code generation by Google.

## Sources

- Fowler, M. (2004). [Inversion of Control Containers and the Dependency Injection Pattern](https://martinfowler.com/articles/injection.html).
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall. Chapter 11.
- Seemann, M. (2019). *Dependency Injection: Principles, Practices, and Patterns*. Manning. 2nd ed.
