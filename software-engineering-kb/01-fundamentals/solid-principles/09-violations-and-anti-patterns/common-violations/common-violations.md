# SOLID Violations and Anti-Patterns

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Domain         | Fundamentals > SOLID Principles > Violations               |
| Difficulty     | Intermediate                                               |
| Prerequisites  | SOLID Principles (all five), Refactoring fundamentals      |
| Last Updated   | 2026-03-07                                                 |

---

## What It Is

A catalog of common SOLID violations with detection strategies and refactoring solutions. These anti-patterns appear frequently in production codebases and are responsible for much of the technical debt that slows teams down over time.

Recognizing violations is a skill that improves with experience. This document provides concrete code examples of each violation, explains why it is problematic, shows how to detect it, and demonstrates the refactored solution. Each example is drawn from patterns commonly seen in real-world enterprise systems.

---

## SRP Violations

### God Class / God Object

The God Class is the most common and most damaging SRP violation. It occurs when a single class accumulates responsibility after responsibility until it becomes the center of the application -- everything depends on it, and every change risks breaking something.

**The Violation:**

```java
// VIOLATION: UserManager does everything related to users AND more.
// This class has at least 6 reasons to change:
// 1. User creation rules change
// 2. Email format or provider changes
// 3. Report format changes
// 4. Notification channel changes
// 5. Password hashing algorithm changes
// 6. Backup strategy changes

public class UserManager {
    private Database db;
    private SmtpClient smtp;
    private SmsGateway sms;
    private S3Client s3;

    public User createUser(String name, String email, String password) {
        // Validates input
        if (name == null || name.isEmpty()) throw new ValidationException("Name required");
        if (!email.matches("^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$")) throw new ValidationException("Invalid email");

        // Hashes password
        String hashed = BCrypt.hashpw(password, BCrypt.gensalt(12));

        // Saves to database
        User user = new User(name, email, hashed);
        db.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                   name, email, hashed);

        // Sends welcome email
        MimeMessage msg = new MimeMessage();
        msg.setFrom("noreply@example.com");
        msg.setTo(email);
        msg.setSubject("Welcome!");
        msg.setBody("Hello " + name + ", welcome to our platform!");
        smtp.send(msg);

        // Logs to audit trail
        db.execute("INSERT INTO audit_log (action, entity, timestamp) VALUES (?, ?, ?)",
                   "USER_CREATED", user.getId(), Instant.now());

        return user;
    }

    public byte[] generateUserReport(String format) {
        List<User> users = db.query("SELECT * FROM users");
        if ("csv".equals(format)) {
            // 50 lines of CSV generation logic
        } else if ("pdf".equals(format)) {
            // 80 lines of PDF generation logic
        } else if ("excel".equals(format)) {
            // 60 lines of Excel generation logic
        }
        return null;
    }

    public void sendNotification(User user, String message) {
        // Send email
        smtp.send(createEmailMessage(user.getEmail(), message));
        // Send SMS
        sms.send(user.getPhone(), message);
        // Send push notification
        pushService.send(user.getDeviceToken(), message);
    }

    public void backupUserData() {
        List<User> users = db.query("SELECT * FROM users");
        byte[] compressed = GzipUtil.compress(JsonUtil.serialize(users));
        s3.upload("backups/users/" + LocalDate.now() + ".gz", compressed);
    }

    // ... 30 more methods covering authentication, authorization,
    // profile updates, avatar management, session handling...
}
```

**The Fix: Extract focused classes.**

```java
// REFACTORED: Each class has one reason to change.

public class UserValidator {
    public void validate(CreateUserRequest request) {
        if (request.getName() == null || request.getName().isEmpty())
            throw new ValidationException("Name required");
        if (!EmailValidator.isValid(request.getEmail()))
            throw new ValidationException("Invalid email");
    }
}

public class UserService {
    private final UserValidator validator;
    private final UserRepository repository;
    private final PasswordHasher hasher;
    private final EventPublisher events;

    public UserService(UserValidator validator, UserRepository repository,
                       PasswordHasher hasher, EventPublisher events) {
        this.validator = validator;
        this.repository = repository;
        this.hasher = hasher;
        this.events = events;
    }

    public User createUser(CreateUserRequest request) {
        validator.validate(request);
        String hashedPassword = hasher.hash(request.getPassword());
        User user = new User(request.getName(), request.getEmail(), hashedPassword);
        repository.save(user);
        events.publish(new UserCreatedEvent(user));  // Listeners handle email, audit, etc.
        return user;
    }
}

public class UserReportGenerator {
    private final UserRepository repository;
    private final Map<String, ReportFormatter> formatters;

    public byte[] generate(String format) {
        List<User> users = repository.findAll();
        ReportFormatter formatter = formatters.get(format);
        if (formatter == null) throw new UnsupportedFormatException(format);
        return formatter.format(users);
    }
}

public class NotificationService {
    private final List<NotificationChannel> channels;

    public void notify(User user, String message) {
        channels.forEach(channel -> channel.send(user, message));
    }
}
```

**Detection Signals:**
- Class has more than 200-300 lines of code
- Class has more than 5-7 public methods
- Class has dependencies on more than 4-5 other services
- Class name contains "Manager", "Handler", "Processor", "Utils" (broad nouns)
- Multiple developers frequently have merge conflicts in the same file

### Divergent Change

When a single class must be modified for many unrelated reasons.

```python
# VIOLATION: This class changes when tax rules change, when discount rules change,
# when shipping rules change, and when formatting rules change.

class OrderProcessor:
    def calculate_tax(self, order):
        if order.country == "US":
            if order.state == "CA":
                return order.subtotal * 0.0725
            elif order.state == "NY":
                return order.subtotal * 0.08
            # ... 50 states
        elif order.country == "UK":
            return order.subtotal * 0.20
        # ... many countries

    def apply_discount(self, order):
        if order.coupon_code == "SUMMER20":
            return order.subtotal * 0.20
        elif order.customer.is_premium:
            return order.subtotal * 0.10
        # ... many discount rules

    def calculate_shipping(self, order):
        weight = sum(item.weight for item in order.items)
        if order.shipping_method == "express":
            return weight * 2.50
        elif order.shipping_method == "standard":
            return weight * 1.00
        # ... many shipping methods

    def format_invoice(self, order):
        # ... 100 lines of HTML/PDF generation
```

**The Fix:** Extract each concern into its own class: `TaxCalculator`, `DiscountEngine`, `ShippingCalculator`, `InvoiceFormatter`.

---

## OCP Violations

### Shotgun Surgery

When adding a feature requires making small changes in many different classes.

```typescript
// VIOLATION: Adding a new user role requires changes in FIVE different files.

// File 1: user.model.ts
type UserRole = 'admin' | 'editor' | 'viewer';  // Must add new role here

// File 2: permissions.ts
function getPermissions(role: UserRole): string[] {
  switch (role) {
    case 'admin': return ['read', 'write', 'delete', 'manage'];
    case 'editor': return ['read', 'write'];
    case 'viewer': return ['read'];
    // Must add case for new role
  }
}

// File 3: dashboard.component.ts
function getDashboardLayout(role: UserRole): Layout {
  switch (role) {
    case 'admin': return AdminLayout;
    case 'editor': return EditorLayout;
    case 'viewer': return ViewerLayout;
    // Must add case for new role
  }
}

// File 4: navigation.ts
function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'admin': return [...allNavItems];
    case 'editor': return allNavItems.filter(i => !i.adminOnly);
    case 'viewer': return allNavItems.filter(i => i.public);
    // Must add case for new role
  }
}

// File 5: api-middleware.ts
function authorizeRequest(role: UserRole, endpoint: string): boolean {
  // Yet another switch on role...
}
```

**The Fix: Encapsulate role behavior in a single place.**

```typescript
// REFACTORED: Role is a self-describing object. Adding a new role = adding one object.

interface RoleDefinition {
  name: string;
  permissions: string[];
  dashboardLayout: Layout;
  navFilter: (items: NavItem[]) => NavItem[];
  canAccess: (endpoint: string) => boolean;
}

const ROLES: Record<string, RoleDefinition> = {
  admin: {
    name: 'admin',
    permissions: ['read', 'write', 'delete', 'manage'],
    dashboardLayout: AdminLayout,
    navFilter: (items) => items,
    canAccess: () => true,
  },
  editor: {
    name: 'editor',
    permissions: ['read', 'write'],
    dashboardLayout: EditorLayout,
    navFilter: (items) => items.filter(i => !i.adminOnly),
    canAccess: (endpoint) => !endpoint.startsWith('/admin'),
  },
  viewer: {
    name: 'viewer',
    permissions: ['read'],
    dashboardLayout: ViewerLayout,
    navFilter: (items) => items.filter(i => i.public),
    canAccess: (endpoint) => endpoint.startsWith('/public'),
  },
  // Adding a new role: just add one object here. Zero changes elsewhere.
};
```

### Type Checking with switch/if-else

The most common OCP violation. Every new type requires modifying existing code.

```typescript
// VIOLATION: switch on type -- every new discount type requires modifying this function.
function calculateDiscount(customer: Customer): number {
  switch (customer.type) {
    case 'regular':
      return 0;
    case 'premium':
      return 0.1;
    case 'vip':
      return 0.2;
    case 'employee':
      return 0.3;
    // Every new customer type requires adding a case here.
    // This function is NEVER closed for modification.
  }
}
```

**The Fix: Replace conditional with polymorphism.**

```typescript
// REFACTORED: Each discount strategy is self-contained.
interface DiscountStrategy {
  calculate(order: Order): number;
}

class RegularDiscount implements DiscountStrategy {
  calculate(order: Order): number { return 0; }
}

class PremiumDiscount implements DiscountStrategy {
  calculate(order: Order): number { return order.subtotal * 0.1; }
}

class VipDiscount implements DiscountStrategy {
  calculate(order: Order): number {
    const base = order.subtotal * 0.2;
    const loyalty = order.customer.yearsActive > 5 ? order.subtotal * 0.05 : 0;
    return base + loyalty;
  }
}

// The discount calculation function is now closed for modification.
function applyDiscount(order: Order, strategy: DiscountStrategy): number {
  return strategy.calculate(order);
}

// New discount types are added by creating new classes, not modifying existing ones.
```

---

## LSP Violations

### The Square-Rectangle Problem

The classic LSP violation. Mathematically, a square is a rectangle, but in code, making Square extend Rectangle breaks substitutability.

```java
// VIOLATION: Square changes the semantics of Rectangle's setWidth/setHeight.

class Rectangle {
    protected int width;
    protected int height;

    public void setWidth(int width) { this.width = width; }
    public void setHeight(int height) { this.height = height; }
    public int getArea() { return width * height; }
}

class Square extends Rectangle {
    // LSP VIOLATION: setWidth changes height too!
    // This breaks the contract that setWidth only affects width.
    @Override
    public void setWidth(int width) {
        this.width = width;
        this.height = width;  // Unexpected side effect!
    }

    @Override
    public void setHeight(int height) {
        this.width = height;  // Unexpected side effect!
        this.height = height;
    }
}

// This test passes for Rectangle but FAILS for Square:
void testArea(Rectangle rect) {
    rect.setWidth(5);
    rect.setHeight(4);
    assert rect.getArea() == 20;  // FAILS for Square: area is 16 (4*4)
}
```

**The Fix: Use composition or separate types.**

```java
// REFACTORED: Shape interface with immutable implementations.

interface Shape {
    int getArea();
}

class Rectangle implements Shape {
    private final int width;
    private final int height;

    public Rectangle(int width, int height) {
        this.width = width;
        this.height = height;
    }

    public int getArea() { return width * height; }

    public Rectangle withWidth(int newWidth) {
        return new Rectangle(newWidth, height);
    }

    public Rectangle withHeight(int newHeight) {
        return new Rectangle(width, newHeight);
    }
}

class Square implements Shape {
    private final int side;

    public Square(int side) { this.side = side; }
    public int getArea() { return side * side; }

    public Square withSide(int newSide) {
        return new Square(newSide);
    }
}
// Square and Rectangle are siblings, not parent-child. No LSP violation.
```

### Throwing NotImplementedException

A clear LSP violation: the subclass pretends to implement the interface but throws an exception for some methods.

```csharp
// VIOLATION: ReadOnlyRepository claims to be a Repository but throws on write operations.

public interface IRepository<T>
{
    T GetById(int id);
    IEnumerable<T> GetAll();
    void Save(T entity);
    void Delete(int id);
}

public class ReadOnlyRepository<T> : IRepository<T>
{
    public T GetById(int id) { /* works fine */ }
    public IEnumerable<T> GetAll() { /* works fine */ }

    public void Save(T entity)
    {
        throw new NotImplementedException("This repository is read-only!");
        // LSP VIOLATION: Any code expecting IRepository will break here.
    }

    public void Delete(int id)
    {
        throw new NotImplementedException("This repository is read-only!");
    }
}
```

**The Fix: Segregate the interface (ISP fixes LSP).**

```csharp
// REFACTORED: Separate read and write interfaces.

public interface IReadRepository<T>
{
    T GetById(int id);
    IEnumerable<T> GetAll();
}

public interface IWriteRepository<T>
{
    void Save(T entity);
    void Delete(int id);
}

public interface IRepository<T> : IReadRepository<T>, IWriteRepository<T> { }

// ReadOnlyRepository only implements IReadRepository -- no fake methods.
public class ReadOnlyRepository<T> : IReadRepository<T>
{
    public T GetById(int id) { /* works fine */ }
    public IEnumerable<T> GetAll() { /* works fine */ }
    // No Save or Delete to violate. Honest interface.
}
```

### Strengthening Preconditions

A subclass that demands stricter input than the base class violates LSP.

```python
# VIOLATION: PremiumShippingService requires order > $100, but base class accepts any order.

class ShippingService:
    def calculate_shipping(self, order: Order) -> float:
        """Calculate shipping for any order."""
        return order.weight * 0.5

class PremiumShippingService(ShippingService):
    def calculate_shipping(self, order: Order) -> float:
        """LSP VIOLATION: Strengthened precondition -- rejects small orders."""
        if order.total < 100:
            raise ValueError("Premium shipping requires orders over $100")
        return 0  # Free shipping for premium

# Code using ShippingService will break when given a PremiumShippingService
# with an order under $100.
```

**The Fix:** The subclass should accept everything the base class accepts. If premium shipping has different eligibility, make it a separate service, not a subtype.

### Violating the History Constraint

A subclass that allows state transitions the base class does not support.

```java
// VIOLATION: The subclass allows re-opening a closed account,
// which the base class's lifecycle does not permit.

class Account {
    private boolean closed = false;

    public void close() { this.closed = true; }
    public boolean isClosed() { return closed; }
    // Invariant: once closed, an account stays closed.
}

class ReopenableAccount extends Account {
    // VIOLATION: breaks the invariant that closed accounts stay closed.
    public void reopen() {
        // This violates the history constraint of the base class.
        // Any code that assumes "once closed, always closed" will break.
    }
}
```

**The Fix:** If accounts can be reopened, this should be part of the base class design. If not, `ReopenableAccount` should not extend `Account`.

---

## ISP Violations

### The Fat Interface

One massive interface forces all implementors to provide methods they do not need.

```java
// VIOLATION: Every worker must implement all methods, even if irrelevant.
public interface Worker {
    void work();
    void eat();
    void sleep();
    void attendMeeting();
    void writeReport();
    void reviewCode();
}

// A robot worker does not eat or sleep.
public class RobotWorker implements Worker {
    public void work() { /* works 24/7 */ }
    public void eat() { /* ISP VIOLATION: robots don't eat */ }
    public void sleep() { /* ISP VIOLATION: robots don't sleep */ }
    public void attendMeeting() { /* ... */ }
    public void writeReport() { /* ... */ }
    public void reviewCode() { /* ISP VIOLATION: robots don't review code */ }
}
```

**The Fix: Segregated interfaces.**

```java
public interface Workable {
    void work();
}

public interface Feedable {
    void eat();
    void sleep();
}

public interface Collaborator {
    void attendMeeting();
    void writeReport();
}

public interface CodeReviewer {
    void reviewCode();
}

// Each class implements only what it actually does.
public class HumanWorker implements Workable, Feedable, Collaborator, CodeReviewer {
    // Implements all -- a human does all of these.
}

public class RobotWorker implements Workable {
    // Only implements what a robot actually does.
    public void work() { /* works 24/7 */ }
}
```

### The "Header Interface" Anti-Pattern

Creating an interface that mirrors a class 1:1, adding no abstraction value.

```typescript
// VIOLATION: The interface is just a duplicate of the class signature.
// It adds indirection without abstraction.

interface IUserService {
  createUser(data: CreateUserDto): Promise<User>;
  updateUser(id: string, data: UpdateUserDto): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUserById(id: string): Promise<User>;
  getUsersByRole(role: string): Promise<User[]>;
  getUsersByDepartment(dept: string): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
  exportUsers(format: string): Promise<Buffer>;
  importUsers(file: Buffer): Promise<ImportResult>;
  // 15 more methods...
}

// Only ONE implementation ever exists. The interface is ceremonial.
class UserService implements IUserService {
  // Exact same methods...
}
```

**The Fix:** Only create interfaces when you have (or anticipate) multiple implementations, or when you need to decouple modules. If the interface exists purely for "good practice," it is cargo cult programming.

### Unused Dependencies

A class receives dependencies it never uses, often because the constructor matches a large interface.

```python
# VIOLATION: ReportGenerator receives an email_service it never uses.

class ReportGenerator:
    def __init__(
        self,
        db: Database,
        cache: Cache,
        email_service: EmailService,    # NEVER USED by this class
        sms_service: SmsService,        # NEVER USED by this class
        analytics: AnalyticsService,    # NEVER USED by this class
    ):
        self.db = db
        self.cache = cache
        self.email_service = email_service
        self.sms_service = sms_service
        self.analytics = analytics

    def generate(self, report_type: str) -> Report:
        data = self.cache.get(report_type) or self.db.query(report_type)
        return Report(data)
        # Only db and cache are used. Three dependencies are wasted.
```

**The Fix:** Only inject what the class actually uses. If the class needs a subset, either pass only that subset or create a focused interface for the needed behavior.

---

## DIP Violations

### Direct Instantiation (new keyword in business logic)

Business logic directly creates its dependencies instead of receiving them.

```java
// VIOLATION: OrderService directly instantiates its dependencies.
// Cannot be tested without a real database and real Stripe.

public class OrderService {
    public Order createOrder(OrderRequest request) {
        // DIP VIOLATION: hardcoded concrete dependency
        MySqlOrderRepository repo = new MySqlOrderRepository(
            "jdbc:mysql://prod-db:3306/orders"
        );

        // DIP VIOLATION: hardcoded concrete dependency
        StripePaymentGateway gateway = new StripePaymentGateway("sk_live_xxx");

        // DIP VIOLATION: hardcoded concrete dependency
        SmtpEmailSender emailer = new SmtpEmailSender("smtp.gmail.com", 587);

        Order order = new Order(request);
        repo.save(order);
        gateway.charge(order.getTotal());
        emailer.send(order.getCustomerEmail(), "Order confirmed!");
        return order;
    }
}
```

**The Fix: Constructor injection.**

```java
// REFACTORED: Dependencies are injected as interfaces.

public class OrderService {
    private final OrderRepository repo;
    private final PaymentGateway gateway;
    private final EmailSender emailer;

    // DIP: Depends on abstractions, injected from outside.
    public OrderService(OrderRepository repo, PaymentGateway gateway, EmailSender emailer) {
        this.repo = repo;
        this.gateway = gateway;
        this.emailer = emailer;
    }

    public Order createOrder(OrderRequest request) {
        Order order = new Order(request);
        repo.save(order);
        gateway.charge(order.getTotal());
        emailer.send(order.getCustomerEmail(), "Order confirmed!");
        return order;
    }
}

// Now testable with mocks:
@Test
void testCreateOrder() {
    OrderRepository mockRepo = mock(OrderRepository.class);
    PaymentGateway mockGateway = mock(PaymentGateway.class);
    EmailSender mockEmailer = mock(EmailSender.class);

    OrderService service = new OrderService(mockRepo, mockGateway, mockEmailer);
    Order result = service.createOrder(testRequest);

    verify(mockRepo).save(any(Order.class));
    verify(mockGateway).charge(eq(99.99));
}
```

### Service Locator Anti-Pattern

Using a global registry to look up dependencies at runtime hides dependencies and makes code harder to test.

```csharp
// VIOLATION: Service Locator hides dependencies.
// Looking at the constructor, you cannot tell what this class depends on.

public class OrderService
{
    public Order CreateOrder(OrderRequest request)
    {
        // Dependencies are hidden -- they are NOT in the constructor.
        var repo = ServiceLocator.Get<IOrderRepository>();
        var gateway = ServiceLocator.Get<IPaymentGateway>();
        var emailer = ServiceLocator.Get<IEmailSender>();

        var order = new Order(request);
        repo.Save(order);
        gateway.Charge(order.Total);
        emailer.Send(order.CustomerEmail, "Confirmed!");
        return order;
    }
}
```

**Problems:**
1. Dependencies are invisible -- you must read every method to discover them.
2. Testing requires configuring a global registry.
3. Missing registrations cause runtime errors, not compile-time errors.

**The Fix:** Constructor injection makes dependencies explicit and enforced at compile time.

### Static Method Dependencies

Calling static methods creates hidden, untestable dependencies.

```typescript
// VIOLATION: Static calls are hidden dependencies.

class ReportService {
  generateReport(data: ReportData): string {
    // DIP VIOLATION: static call -- cannot mock for testing
    const formatted = DateUtils.formatDate(data.startDate);
    // DIP VIOLATION: static call -- cannot swap implementations
    const cached = CacheManager.get(`report:${data.id}`);
    // DIP VIOLATION: static call -- cannot test without real logger
    Logger.info(`Generating report ${data.id}`);

    if (cached) return cached;
    const report = this.buildReport(data, formatted);
    CacheManager.set(`report:${data.id}`, report);
    return report;
  }
}
```

**The Fix:** Inject these utilities as dependencies or use instance methods.

```typescript
// REFACTORED: All dependencies are injected and mockable.

class ReportService {
  constructor(
    private dateFormatter: DateFormatter,
    private cache: Cache,
    private logger: Logger,
  ) {}

  generateReport(data: ReportData): string {
    const formatted = this.dateFormatter.format(data.startDate);
    const cached = this.cache.get(`report:${data.id}`);
    this.logger.info(`Generating report ${data.id}`);

    if (cached) return cached;
    const report = this.buildReport(data, formatted);
    this.cache.set(`report:${data.id}`, report);
    return report;
  }
}
```

### Concrete Dependencies in Constructors

When a class depends on a concrete class instead of an interface, swapping implementations requires modifying the dependent class.

```go
// VIOLATION: Directly depends on concrete PostgresDB, not an interface.

type UserService struct {
    db *PostgresDB  // Concrete type -- cannot swap for testing or migration
}

func NewUserService() *UserService {
    return &UserService{
        db: NewPostgresDB("postgres://localhost:5432/mydb"),  // Hardcoded!
    }
}
```

**The Fix:**

```go
// REFACTORED: Depends on interface, injected from outside.

type UserStore interface {
    Save(ctx context.Context, user *User) error
    FindByID(ctx context.Context, id string) (*User, error)
}

type UserService struct {
    store UserStore  // Interface -- can be Postgres, MySQL, in-memory, mock
}

func NewUserService(store UserStore) *UserService {
    return &UserService{store: store}
}
```

---

## Detection Tools

### Static Analysis

| Tool | Language | SOLID Checks |
|------|----------|-------------|
| **SonarQube** | Multi | God class detection, cognitive complexity, coupling metrics |
| **ESLint (typescript-eslint)** | TypeScript/JS | Max class lines, max function params, no-unused-vars |
| **Pylint** | Python | Too many instance attributes, too many arguments, too many methods |
| **Checkstyle** | Java | Class fan-out complexity, method count, parameter count |
| **golangci-lint** | Go | Function length, parameter count, cyclomatic complexity |
| **Clippy** | Rust | Complex types, too many arguments, cognitive complexity |

### Architecture Fitness Functions

```typescript
// ArchUnit (Java) or ts-arch (TypeScript): enforce architectural rules.

// Rule: Controllers must not depend on repositories directly (DIP).
rule('Controllers must not import repositories')
  .classes().inFolder('controllers')
  .shouldNot().dependOnFiles().inFolder('repositories');

// Rule: No class should have more than 300 lines (SRP signal).
rule('Classes should be small')
  .classes().should().haveLineCountLessThan(300);

// Rule: Services must depend on interfaces, not concrete implementations.
rule('Services depend on abstractions')
  .classes().inFolder('services')
  .shouldNot().dependOnFiles().matching('*Impl*');
```

### Dependency Analysis

- **JDepend** (Java): measures package coupling and identifies dependency cycles.
- **Madge** (JavaScript/TypeScript): generates dependency graphs and detects circular dependencies.
- **Go dependency graph**: `go mod graph` shows module dependencies.
- **cargo-depgraph** (Rust): visualizes crate dependency trees.

---

## Refactoring Strategies

### Extract Class (fixes SRP violations)
When a class has too many responsibilities, extract groups of related fields and methods into new classes.

### Extract Interface (fixes DIP and ISP violations)
When code depends on a concrete class, extract an interface containing only the methods used by the client.

### Introduce Parameter Object (fixes ISP violations)
When a function has too many parameters, group related parameters into a focused object.

### Replace Conditional with Polymorphism (fixes OCP violations)
When switch/if-else chains test types, replace with a polymorphic hierarchy where each type knows its own behavior.

### Move Method (fixes SRP violations)
When a method uses more data from another class than from its own, move it to the class it is more closely associated with.

### Compose Method (fixes SRP at the method level)
When a method does too much, extract steps into named private methods that each do one thing.

---

## Sources

- Fowler, M. (1999). *Refactoring: Improving the Design of Existing Code*. Addison-Wesley.
- Fowler, M. (2018). *Refactoring: Improving the Design of Existing Code*, 2nd Edition. Addison-Wesley.
- Martin, R.C. (2008). *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall.
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall.
- Feathers, M. (2004). *Working Effectively with Legacy Code*. Prentice Hall.
- SonarQube Documentation: https://docs.sonarqube.org/latest/
- Seemann, M. (2019). *Dependency Injection: Principles, Practices, and Patterns*. Manning.
- ArchUnit Documentation: https://www.archunit.org/
