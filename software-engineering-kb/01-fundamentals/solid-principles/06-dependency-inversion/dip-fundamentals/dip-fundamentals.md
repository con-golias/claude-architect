# Dependency Inversion Principle (DIP) -- Fundamentals

| Field          | Value                                                       |
|----------------|-------------------------------------------------------------|
| Domain         | Fundamentals > SOLID Principles > Dependency Inversion      |
| Difficulty     | Advanced                                                    |
| Prerequisites  | OOP fundamentals, Interfaces, LSP, ISP                      |
| Last Updated   | 2026-03-07                                                  |

---

## What It Is

The Dependency Inversion Principle was formulated by **Robert C. Martin** in his 1996 C++ Report column, "The Dependency Inversion Principle." It consists of two complementary parts:

> **A) High-level modules should not depend on low-level modules. Both should depend on abstractions.**
>
> **B) Abstractions should not depend on details. Details should depend on abstractions.**

The word **"inversion"** is key. In traditional layered architecture, dependencies flow top-down: the business logic layer depends directly on the data access layer, which depends on the database driver. DIP inverts this by introducing an abstraction (interface) that both layers depend on. The high-level policy defines the interface it needs; the low-level detail implements that interface. The dependency arrow on the low-level module now points **upward** toward the abstraction, inverting the traditional direction.

This is not about merely "using interfaces." DIP requires that **the abstraction is owned by the higher-level module** (or a shared abstraction layer), not by the lower-level module. The high-level module defines what it needs; the low-level module conforms to that definition.

---

## Why It Matters

1. **Decouples policy from mechanism.** High-level business rules do not change when you swap a MySQL database for PostgreSQL, or replace SendGrid with Amazon SES. The abstraction boundary isolates the change.

2. **Enables testability.** When high-level modules depend on abstractions, you can inject test doubles (mocks, stubs, fakes) in place of real infrastructure. Unit tests run fast without databases, networks, or file systems.

3. **Supports parallel development.** Teams can work on the high-level module and the low-level module simultaneously, as long as they agree on the interface. The interface is the contract.

4. **Enables the Open/Closed Principle.** New implementations can be added without modifying existing high-level code. The system is open for extension (new adapters) and closed for modification (existing business logic).

5. **Foundation of Clean Architecture.** DIP is the architectural principle that enables hexagonal architecture (ports and adapters), onion architecture, and Clean Architecture. All of these patterns use DIP to point dependencies inward toward the domain.

---

## DIP vs DI vs IoC

These three concepts are related but distinct. Conflating them is a common source of confusion.

| Concept                         | What It Is                                                   | Level        |
|---------------------------------|--------------------------------------------------------------|--------------|
| **DIP** (Dependency Inversion)  | A *principle*: depend on abstractions, not concretions       | Design       |
| **DI** (Dependency Injection)   | A *technique*: supply dependencies from outside              | Implementation |
| **IoC** (Inversion of Control)  | A *pattern*: framework controls object lifecycle ("Hollywood principle") | Architecture |

- **DIP** tells you *what* to do: make both high-level and low-level modules depend on abstractions.
- **DI** tells you *how* to do it: pass (inject) the concrete implementation into the class that needs it, rather than having the class create it internally.
- **IoC** is the broadest concept: the framework calls your code (not the other way around). DI is one form of IoC. Event systems, template methods, and plugin architectures are other forms.

You can apply DIP without a DI container (manual injection). You can use a DI container without truly following DIP (if your abstractions are poorly designed). And IoC encompasses many patterns beyond dependency management.

---

## How It Works

### Example 1: Order Processing (TypeScript)

**BEFORE -- DIP Violation (high-level depends on low-level):**

```typescript
import { MySQLDatabase } from "./infrastructure/mysql";
import { SendGridMailer } from "./infrastructure/sendgrid";
import { StripePayment } from "./infrastructure/stripe";

class OrderService {
  // Direct dependencies on concrete implementations!
  private db = new MySQLDatabase();
  private mailer = new SendGridMailer();
  private payment = new StripePayment();

  async placeOrder(order: Order): Promise<void> {
    await this.payment.charge(order.total, order.paymentMethod);
    await this.db.insert("orders", order);
    await this.mailer.sendEmail(order.userEmail, "Order confirmed", "...");
  }
}

// Problems:
// 1. Cannot test without real MySQL, SendGrid, and Stripe
// 2. Switching to PostgreSQL requires modifying OrderService
// 3. OrderService knows about infrastructure details
```

**AFTER -- DIP-Compliant (depends on abstractions):**

```typescript
// Abstractions defined by the high-level module (domain layer)
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}

interface NotificationService {
  notify(recipient: string, subject: string, body: string): Promise<void>;
}

interface PaymentGateway {
  charge(amount: number, method: PaymentMethod): Promise<PaymentResult>;
  refund(transactionId: string): Promise<void>;
}

// High-level module depends ONLY on abstractions
class OrderService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly notifier: NotificationService,
    private readonly payments: PaymentGateway
  ) {}

  async placeOrder(order: Order): Promise<void> {
    const paymentResult = await this.payments.charge(order.total, order.paymentMethod);
    order.transactionId = paymentResult.transactionId;
    await this.repo.save(order);
    await this.notifier.notify(order.userEmail, "Order confirmed", `Order #${order.id}`);
  }
}

// Low-level modules implement the abstractions
class MySQLOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> { /* MySQL-specific code */ }
  async findById(id: string): Promise<Order | null> { /* MySQL query */ }
}

class SendGridNotifier implements NotificationService {
  async notify(recipient: string, subject: string, body: string): Promise<void> {
    /* SendGrid API call */
  }
}

class StripeGateway implements PaymentGateway {
  async charge(amount: number, method: PaymentMethod): Promise<PaymentResult> {
    /* Stripe API call */
  }
  async refund(transactionId: string): Promise<void> { /* Stripe refund */ }
}

// Composition root -- where concrete types are chosen and wired together
const orderService = new OrderService(
  new MySQLOrderRepository(),
  new SendGridNotifier(),
  new StripeGateway()
);
```

### Example 2: Spring Boot DI (Java)

Spring's IoC container manages object creation and dependency injection using annotations.

```java
// Abstraction -- defined in the domain layer
public interface UserRepository {
    User findById(Long id);
    User save(User user);
    List<User> findByRole(String role);
}

// Low-level implementation -- infrastructure layer
@Repository
public class JpaUserRepository implements UserRepository {
    @PersistenceContext
    private EntityManager em;

    @Override
    public User findById(Long id) {
        return em.find(User.class, id);
    }

    @Override
    public User save(User user) {
        return em.merge(user);
    }

    @Override
    public List<User> findByRole(String role) {
        return em.createQuery("SELECT u FROM User u WHERE u.role = :role", User.class)
                 .setParameter("role", role)
                 .getResultList();
    }
}

// High-level service -- depends on abstraction, not JPA details
@Service
public class UserService {
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    // Constructor injection -- Spring autowires by type
    @Autowired
    public UserService(UserRepository userRepository,
                       NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public User registerUser(UserRegistrationDto dto) {
        User user = new User(dto.getName(), dto.getEmail());
        User saved = userRepository.save(user);
        notificationService.sendWelcome(saved);
        return saved;
    }
}

// Spring's IoC container:
// 1. Scans for @Repository, @Service, @Component
// 2. Creates instances (beans)
// 3. Resolves dependencies by type
// 4. Injects via constructor (or setter/@Autowired fields)
```

### Example 3: Python with Protocols (PEP 544)

Python's `Protocol` class enables structural typing -- a class satisfies a protocol if it has the right methods, without explicit inheritance.

```python
from typing import Protocol, runtime_checkable
from dataclasses import dataclass


# Abstractions using Protocol (structural typing)
@runtime_checkable
class MessageSender(Protocol):
    def send(self, recipient: str, subject: str, body: str) -> None: ...


@runtime_checkable
class UserStore(Protocol):
    def save(self, user: "User") -> "User": ...
    def find_by_email(self, email: str) -> "User | None": ...


@dataclass
class User:
    name: str
    email: str
    id: str = ""


# High-level module depends on protocols
class RegistrationService:
    def __init__(self, store: UserStore, sender: MessageSender) -> None:
        self._store = store
        self._sender = sender

    def register(self, name: str, email: str) -> User:
        existing = self._store.find_by_email(email)
        if existing:
            raise ValueError(f"Email {email} already registered")

        user = self._store.save(User(name=name, email=email))
        self._sender.send(email, "Welcome!", f"Hello {name}, welcome aboard!")
        return user


# Concrete implementations -- no need to explicitly inherit from Protocol
class PostgresUserStore:
    def save(self, user: User) -> User:
        # PostgreSQL-specific save logic
        user.id = "pg-123"
        return user

    def find_by_email(self, email: str) -> User | None:
        # PostgreSQL query
        return None


class SmtpSender:
    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = port

    def send(self, recipient: str, subject: str, body: str) -> None:
        print(f"SMTP({self.host}): Sending '{subject}' to {recipient}")


# Composition
service = RegistrationService(
    store=PostgresUserStore(),
    sender=SmtpSender("smtp.example.com", 587)
)
```

### Example 4: Clean Architecture Layers (TypeScript)

DIP is the architectural principle that makes Clean Architecture work. The domain layer defines interfaces (ports); the infrastructure layer implements them (adapters). Dependencies always point inward.

```
┌─────────────────────────────────────────┐
│           Infrastructure Layer          │  (Frameworks, DB, HTTP)
│  MySQLRepo, ExpressController, ...      │
│         implements interfaces           │
│              │  depends on  │            │
│              ▼              ▼            │
│  ┌─────────────────────────────────┐    │
│  │       Application Layer         │    │  (Use cases, services)
│  │  PlaceOrderUseCase, ...         │    │
│  │         depends on              │    │
│  │              │                   │    │
│  │              ▼                   │    │
│  │  ┌─────────────────────────┐    │    │
│  │  │     Domain Layer        │    │    │  (Entities, interfaces)
│  │  │  Order, OrderRepository │    │    │
│  │  │  (interface only)       │    │    │
│  │  └─────────────────────────┘    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

```typescript
// === DOMAIN LAYER (innermost -- no external dependencies) ===

// Entity
class Order {
  constructor(
    public readonly id: string,
    public readonly items: OrderItem[],
    public status: OrderStatus = "pending"
  ) {}

  get total(): number {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

// Port (interface) -- defined by the domain, implemented by infrastructure
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}

interface PaymentGateway {
  charge(amount: number): Promise<{ transactionId: string }>;
}

interface EventBus {
  publish(event: DomainEvent): Promise<void>;
}

// === APPLICATION LAYER (depends only on domain) ===

class PlaceOrderUseCase {
  constructor(
    private readonly orders: OrderRepository,    // port
    private readonly payments: PaymentGateway,    // port
    private readonly events: EventBus             // port
  ) {}

  async execute(input: PlaceOrderInput): Promise<Order> {
    const order = new Order(input.id, input.items);
    const { transactionId } = await this.payments.charge(order.total);
    order.status = "confirmed";
    await this.orders.save(order);
    await this.events.publish(new OrderPlacedEvent(order.id, transactionId));
    return order;
  }
}

// === INFRASTRUCTURE LAYER (depends on domain interfaces -- adapters) ===

class MongoOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> {
    // MongoDB-specific persistence
  }
  async findById(id: string): Promise<Order | null> {
    // MongoDB query
    return null;
  }
}

class StripePaymentGateway implements PaymentGateway {
  async charge(amount: number): Promise<{ transactionId: string }> {
    // Stripe API call
    return { transactionId: "txn_abc123" };
  }
}

class RabbitMQEventBus implements EventBus {
  async publish(event: DomainEvent): Promise<void> {
    // RabbitMQ publish
  }
}

// === COMPOSITION ROOT (wires everything together) ===
const useCase = new PlaceOrderUseCase(
  new MongoOrderRepository(),
  new StripePaymentGateway(),
  new RabbitMQEventBus()
);
```

### Example 5: Go DI -- Manual Injection

Go does not use (or need) a DI container. Interfaces are small, structural, and composed at the call site.

```go
package main

import "fmt"

// Abstractions (interfaces defined by consumers)
type UserRepository interface {
    FindByID(id string) (*User, error)
    Save(user *User) error
}

type Emailer interface {
    Send(to, subject, body string) error
}

type Logger interface {
    Info(msg string, args ...interface{})
    Error(msg string, args ...interface{})
}

type User struct {
    ID    string
    Name  string
    Email string
}

// High-level service -- depends on interfaces
type UserService struct {
    repo   UserRepository
    email  Emailer
    logger Logger
}

// Constructor function -- manual dependency injection
func NewUserService(repo UserRepository, email Emailer, logger Logger) *UserService {
    return &UserService{repo: repo, email: email, logger: logger}
}

func (s *UserService) Register(name, emailAddr string) (*User, error) {
    user := &User{ID: generateID(), Name: name, Email: emailAddr}

    if err := s.repo.Save(user); err != nil {
        s.logger.Error("failed to save user", "error", err)
        return nil, err
    }

    if err := s.email.Send(emailAddr, "Welcome!", "Hello "+name); err != nil {
        s.logger.Error("failed to send welcome email", "error", err)
        // non-critical -- don't fail registration
    }

    s.logger.Info("user registered", "id", user.ID)
    return user, nil
}

// Concrete implementations
type PostgresRepo struct{ connStr string }

func (r *PostgresRepo) FindByID(id string) (*User, error) {
    fmt.Println("Postgres: finding user", id)
    return &User{ID: id}, nil
}

func (r *PostgresRepo) Save(user *User) error {
    fmt.Println("Postgres: saving user", user.ID)
    return nil
}

type SMTPEmailer struct{ host string }

func (e *SMTPEmailer) Send(to, subject, body string) error {
    fmt.Printf("SMTP(%s): sending '%s' to %s\n", e.host, subject, to)
    return nil
}

type StdLogger struct{}

func (l *StdLogger) Info(msg string, args ...interface{})  { fmt.Println("INFO:", msg, args) }
func (l *StdLogger) Error(msg string, args ...interface{}) { fmt.Println("ERROR:", msg, args) }

func generateID() string { return "usr-001" }

// Composition in main()
func main() {
    svc := NewUserService(
        &PostgresRepo{connStr: "postgres://localhost/mydb"},
        &SMTPEmailer{host: "smtp.example.com"},
        &StdLogger{},
    )
    svc.Register("Alice", "alice@example.com")
}
```

### Example 6: Rust Traits for DIP

Rust uses traits and generics (or trait objects) to achieve dependency inversion without runtime overhead (when using generics) or with dynamic dispatch (when using `dyn Trait`).

```rust
use std::error::Error;

// Abstractions as traits
trait UserRepository {
    fn save(&self, user: &User) -> Result<(), Box<dyn Error>>;
    fn find_by_id(&self, id: &str) -> Result<Option<User>, Box<dyn Error>>;
}

trait Notifier {
    fn notify(&self, recipient: &str, message: &str) -> Result<(), Box<dyn Error>>;
}

#[derive(Debug, Clone)]
struct User {
    id: String,
    name: String,
    email: String,
}

// High-level service using generics (static dispatch -- zero-cost abstraction)
struct UserService<R: UserRepository, N: Notifier> {
    repo: R,
    notifier: N,
}

impl<R: UserRepository, N: Notifier> UserService<R, N> {
    fn new(repo: R, notifier: N) -> Self {
        Self { repo, notifier }
    }

    fn register(&self, name: &str, email: &str) -> Result<User, Box<dyn Error>> {
        let user = User {
            id: "usr-001".to_string(),
            name: name.to_string(),
            email: email.to_string(),
        };

        self.repo.save(&user)?;
        self.notifier.notify(email, &format!("Welcome, {}!", name))?;
        Ok(user)
    }
}

// Alternative: trait objects for runtime polymorphism
struct DynamicUserService {
    repo: Box<dyn UserRepository>,
    notifier: Box<dyn Notifier>,
}

impl DynamicUserService {
    fn new(repo: Box<dyn UserRepository>, notifier: Box<dyn Notifier>) -> Self {
        Self { repo, notifier }
    }
}

// Concrete implementations
struct PostgresRepo;

impl UserRepository for PostgresRepo {
    fn save(&self, user: &User) -> Result<(), Box<dyn Error>> {
        println!("Postgres: saving {:?}", user);
        Ok(())
    }

    fn find_by_id(&self, id: &str) -> Result<Option<User>, Box<dyn Error>> {
        println!("Postgres: finding {}", id);
        Ok(None)
    }
}

struct EmailNotifier {
    smtp_host: String,
}

impl Notifier for EmailNotifier {
    fn notify(&self, recipient: &str, message: &str) -> Result<(), Box<dyn Error>> {
        println!("Email({}): {} -> {}", self.smtp_host, recipient, message);
        Ok(())
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    // Static dispatch (monomorphized at compile time)
    let service = UserService::new(
        PostgresRepo,
        EmailNotifier { smtp_host: "smtp.example.com".into() },
    );
    service.register("Alice", "alice@example.com")?;

    // Dynamic dispatch (trait objects)
    let dynamic_service = DynamicUserService::new(
        Box::new(PostgresRepo),
        Box::new(EmailNotifier { smtp_host: "smtp.example.com".into() }),
    );

    Ok(())
}
```

---

## Dependency Injection Patterns

### 1. Constructor Injection (Preferred)

Dependencies are provided through the constructor. They are explicit, immutable after construction, and required.

```typescript
class OrderService {
  constructor(
    private readonly repo: OrderRepository,       // required
    private readonly notifier: NotificationService // required
  ) {}
}

// All dependencies visible at construction time
const service = new OrderService(new PgOrderRepo(), new EmailNotifier());
```

### 2. Setter Injection

Dependencies can be changed after construction. Use for optional or reconfigurable dependencies.

```java
public class ReportGenerator {
    private Formatter formatter;

    // Optional -- can be changed later
    public void setFormatter(Formatter formatter) {
        this.formatter = formatter;
    }

    public String generate(Data data) {
        Formatter f = (formatter != null) ? formatter : new DefaultFormatter();
        return f.format(data);
    }
}
```

### 3. Method Injection

Dependency is provided per-call. Use when different calls need different implementations.

```python
class DataProcessor:
    def process(self, data: list[int], strategy: SortStrategy) -> list[int]:
        # strategy is injected per call -- different calls can use different strategies
        return strategy.sort(data)

processor = DataProcessor()
processor.process(data, QuickSort())
processor.process(data, MergeSort())
```

### 4. Service Locator (Generally an Anti-Pattern)

A central registry that classes query for their dependencies. Hides dependencies and makes testing harder.

```typescript
// Anti-pattern -- avoid this
class OrderService {
  placeOrder(order: Order): void {
    // Dependencies are hidden -- not visible in constructor
    const repo = ServiceLocator.get<OrderRepository>("OrderRepository");
    const mailer = ServiceLocator.get<NotificationService>("NotificationService");
    repo.save(order);
    mailer.notify(order.userEmail, "Order placed");
  }
}

// Problems:
// 1. Dependencies are hidden -- you must read the method body to find them
// 2. Runtime errors if a dependency is not registered
// 3. Hard to test -- must configure the global ServiceLocator
// 4. Violates the principle of explicit dependencies
```

---

## IoC Containers

IoC containers automate dependency resolution, object lifecycle management, and wiring.

| Container              | Language/Platform   | Key Features                                              |
|------------------------|---------------------|-----------------------------------------------------------|
| **Spring**             | Java                | Annotation-based, XML config, AOP, scopes (singleton, prototype, request) |
| **NestJS**             | TypeScript/Node.js  | Decorator-based (`@Injectable`, `@Inject`), module system  |
| **ASP.NET Core DI**    | C#                  | Built-in, supports transient/scoped/singleton lifetimes    |
| **Dagger**             | Kotlin/Java/Android | Compile-time DI, zero reflection, generated code           |
| **Autofac**            | C#                  | Rich lifetime scopes, module system, property injection    |

```csharp
// ASP.NET Core built-in DI
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        // Register abstractions with their implementations
        services.AddScoped<IOrderRepository, SqlOrderRepository>();
        services.AddTransient<INotificationService, EmailNotificationService>();
        services.AddSingleton<ICacheService, RedisCacheService>();
    }
}

// Controller receives dependencies automatically
[ApiController]
[Route("api/orders")]
public class OrderController : ControllerBase
{
    private readonly IOrderRepository _repo;
    private readonly INotificationService _notifier;

    // ASP.NET Core resolves and injects these automatically
    public OrderController(IOrderRepository repo, INotificationService notifier)
    {
        _repo = repo;
        _notifier = notifier;
    }

    [HttpPost]
    public async Task<IActionResult> PlaceOrder(OrderDto dto)
    {
        var order = dto.ToOrder();
        await _repo.Save(order);
        await _notifier.Notify(order.UserEmail, "Order placed");
        return Ok(order);
    }
}
```

---

## Testing Benefits

DIP's greatest practical benefit is testability. When high-level modules depend on abstractions, you can inject test doubles.

```typescript
// Production implementation
class PostgresOrderRepo implements OrderRepository {
  async save(order: Order): Promise<void> {
    // Real database call -- slow, requires running PostgreSQL
  }
  async findById(id: string): Promise<Order | null> {
    // Real database query
  }
}

// Test double -- in-memory fake
class InMemoryOrderRepo implements OrderRepository {
  private orders: Map<string, Order> = new Map();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  // Test helper methods
  getAll(): Order[] { return [...this.orders.values()]; }
  clear(): void { this.orders.clear(); }
}

// Mock notification service
class MockNotifier implements NotificationService {
  public calls: Array<{ recipient: string; subject: string; body: string }> = [];

  async notify(recipient: string, subject: string, body: string): Promise<void> {
    this.calls.push({ recipient, subject, body });
  }
}

// Mock payment gateway
class MockPaymentGateway implements PaymentGateway {
  public shouldFail = false;

  async charge(amount: number, method: PaymentMethod): Promise<PaymentResult> {
    if (this.shouldFail) throw new Error("Payment declined");
    return { transactionId: "mock-txn-001", amount };
  }

  async refund(transactionId: string): Promise<void> {}
}

// Tests -- fast, isolated, no infrastructure needed
describe("OrderService", () => {
  let repo: InMemoryOrderRepo;
  let notifier: MockNotifier;
  let payments: MockPaymentGateway;
  let service: OrderService;

  beforeEach(() => {
    repo = new InMemoryOrderRepo();
    notifier = new MockNotifier();
    payments = new MockPaymentGateway();
    service = new OrderService(repo, notifier, payments);
  });

  it("saves order and sends notification on success", async () => {
    const order = new Order("ord-1", [{ name: "Widget", price: 10, quantity: 2 }]);

    await service.placeOrder(order);

    // Verify order was saved
    const saved = await repo.findById("ord-1");
    expect(saved).toBeDefined();
    expect(saved!.status).toBe("confirmed");

    // Verify notification was sent
    expect(notifier.calls).toHaveLength(1);
    expect(notifier.calls[0].recipient).toBe(order.userEmail);
  });

  it("does not save order when payment fails", async () => {
    payments.shouldFail = true;
    const order = new Order("ord-2", [{ name: "Gadget", price: 50, quantity: 1 }]);

    await expect(service.placeOrder(order)).rejects.toThrow("Payment declined");

    // Order was NOT saved
    expect(repo.getAll()).toHaveLength(0);
    // Notification was NOT sent
    expect(notifier.calls).toHaveLength(0);
  });
});
```

---

## Common Mistakes

### 1. Creating Interfaces for Everything (Over-Abstraction)

Not every dependency needs an interface. If a class has exactly one implementation and you have no plans to swap or mock it, an interface adds indirection without value.

```typescript
// Over-abstraction -- unnecessary interface
interface IStringUtils {
  capitalize(s: string): string;
  trim(s: string): string;
}

class StringUtils implements IStringUtils {
  capitalize(s: string): string { return s[0].toUpperCase() + s.slice(1); }
  trim(s: string): string { return s.trim(); }
}

// Just use the class directly -- it's a pure utility with no side effects
```

**Rule of thumb:** Create an abstraction when you need to cross an architectural boundary (I/O, network, database, external service) or when you genuinely need polymorphism.

### 2. Abstractions Owned by the Wrong Layer

If the low-level module defines the interface and the high-level module imports it, you have not truly inverted the dependency. The high-level module still depends on the low-level module's package.

```
WRONG:
  domain/ -> imports -> infrastructure/IDatabase.ts  (interface defined in infra)

RIGHT:
  domain/OrderRepository.ts (interface)  <- implemented by <- infrastructure/MySQLOrderRepo.ts
  domain/ does NOT import anything from infrastructure/
```

### 3. Depending on Abstractions You Don't Own

When wrapping a third-party library, define your own interface rather than depending on the library's types throughout your codebase.

```typescript
// BAD -- your domain depends on Stripe's types
import Stripe from "stripe";

class OrderService {
  constructor(private stripe: Stripe) {}
  // Now your domain is coupled to Stripe's API surface
}

// GOOD -- define your own abstraction
interface PaymentGateway {
  charge(amount: number, currency: string): Promise<PaymentResult>;
}

class StripeAdapter implements PaymentGateway {
  constructor(private stripe: Stripe) {}

  async charge(amount: number, currency: string): Promise<PaymentResult> {
    const result = await this.stripe.charges.create({ amount, currency });
    return { transactionId: result.id, amount: result.amount };
  }
}
```

### 4. Service Locator Disguised as DI

Using a container to resolve dependencies inside methods (rather than injecting them through the constructor) is a Service Locator anti-pattern wearing a DI container costume.

```typescript
// Anti-pattern: resolving inside method bodies
class OrderService {
  async placeOrder(order: Order): Promise<void> {
    const repo = container.resolve<OrderRepository>("OrderRepository"); // hidden dependency!
    await repo.save(order);
  }
}

// Correct: inject through constructor
class OrderService {
  constructor(private readonly repo: OrderRepository) {} // explicit dependency

  async placeOrder(order: Order): Promise<void> {
    await this.repo.save(order);
  }
}
```

---

## Relationship to Other SOLID Principles

| Principle | Relationship to DIP                                                                |
|-----------|------------------------------------------------------------------------------------|
| SRP       | Classes with one responsibility tend to have focused dependencies                  |
| OCP       | DIP enables OCP -- new implementations can be injected without modifying consumers |
| LSP       | All implementations of an abstraction must be substitutable (LSP must hold)        |
| ISP       | Small interfaces make DIP easier -- fewer methods to implement in each adapter     |

DIP is often considered the most architecturally significant of the SOLID principles because it governs the direction of dependencies across module and layer boundaries. It is the principle that enables the separation of concerns at the architectural level.

---

## Sources

- Martin, R.C. (1996). "The Dependency Inversion Principle." C++ Report, Vol. 8.
- Martin, R.C. (2002). *Agile Software Development: Principles, Patterns, and Practices.* Prentice Hall. Chapter 11: The Dependency Inversion Principle.
- Martin, R.C. (2017). *Clean Architecture.* Prentice Hall. Chapters 11, 22.
- Fowler, M. (2004). "Inversion of Control Containers and the Dependency Injection Pattern." https://martinfowler.com/articles/injection.html
- Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. (Strategy, Abstract Factory, and other patterns that embody DIP)
- Seemann, M. (2019). *Dependency Injection: Principles, Practices, and Patterns.* 2nd Edition. Manning.
- Wikipedia. "Dependency inversion principle." https://en.wikipedia.org/wiki/Dependency_inversion_principle
- Baeldung. "The Dependency Inversion Principle." https://www.baeldung.com/cs/dip
