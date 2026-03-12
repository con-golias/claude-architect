# SOLID Beyond OOP -- Functional and Modern Paradigms

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Domain         | Fundamentals > SOLID Principles > Beyond OOP               |
| Difficulty     | Advanced                                                   |
| Prerequisites  | SOLID Principles, Functional Programming, Go, Rust, TypeScript |
| Last Updated   | 2026-03-07                                                 |

---

## What It Is

SOLID principles are often taught as object-oriented programming concepts: classes implementing interfaces, inheritance hierarchies, and dependency injection containers. But the underlying ideas -- separation of concerns, extensibility without modification, substitutability, minimal coupling, and depending on abstractions -- are universal to all software paradigms.

Functional programming achieves many SOLID goals through different mechanisms. Pure functions naturally satisfy SRP. Higher-order functions provide OCP without inheritance. Parametric polymorphism guarantees LSP. Small type classes fulfill ISP. And function parameters serve as dependency injection.

This document maps each SOLID principle to its functional, procedural, and multi-paradigm equivalents, demonstrating that the principles transcend any single paradigm.

---

## SOLID in Functional Programming

### SRP in Functional Programming

In OOP, SRP means "a class should have only one reason to change." In FP, this translates to: **a function should do exactly one thing, and a module should group functions that change for the same reason.**

Pure functions are the ultimate expression of SRP. They take input, produce output, and do nothing else -- no side effects, no hidden state mutations, no I/O.

```haskell
-- Haskell: Each function has exactly one responsibility.
-- Validation is separate from transformation is separate from persistence.

module User.Validation (validateUser) where

validateAge :: Int -> Either String Int
validateAge n
  | n < 0     = Left "Age cannot be negative"
  | n > 150   = Left "Unrealistic age"
  | otherwise = Right n

validateName :: String -> Either String String
validateName name
  | null name        = Left "Name cannot be empty"
  | length name > 100 = Left "Name too long"
  | otherwise        = Right name

validateUser :: UserInput -> Either String ValidatedUser
validateUser input = do
  name <- validateName (inputName input)
  age  <- validateAge (inputAge input)
  pure (ValidatedUser name age)
```

```typescript
// TypeScript FP style: Each function in the pipeline has one job.
// The pipeline itself is the composition of single-responsibility functions.

const validateUser = (input: RawUser): Either<ValidationError[], User> =>
  pipe(
    input,
    applyValidations([
      validateName,
      validateEmail,
      validateAge,
    ]),
    map(toUser)
  );

const transformForDisplay = (user: User): UserDTO => ({
  displayName: `${user.firstName} ${user.lastName}`,
  avatarUrl: generateGravatar(user.email),
  memberSince: formatDate(user.createdAt),
});

const persistUser = (repo: UserRepository) => (user: User): Task<void> =>
  repo.save(user);

// Pipeline: validate >> transform >> persist
// Each step has exactly one reason to change.
```

```elixir
# Elixir: Module-level SRP. Each module groups related functions.

defmodule MyApp.Users.Validator do
  def validate_user(params) do
    params
    |> validate_required([:name, :email, :age])
    |> validate_format(:email, ~r/@/)
    |> validate_number(:age, greater_than: 0, less_than: 150)
  end
end

defmodule MyApp.Users.Formatter do
  def to_display(user) do
    %{
      display_name: "#{user.first_name} #{user.last_name}",
      avatar_url: Gravatar.url(user.email),
      member_since: Calendar.strftime(user.inserted_at, "%B %Y")
    }
  end
end

defmodule MyApp.Users.Repository do
  def create(changeset), do: Repo.insert(changeset)
  def find(id), do: Repo.get(User, id)
end
```

### OCP in Functional Programming

In OOP, OCP means "open for extension, closed for modification" -- typically achieved through inheritance or strategy pattern. In FP, this is achieved through **higher-order functions and function composition**. You extend behavior by composing new functions, not modifying existing ones.

```python
# Python: Higher-order functions provide OCP without inheritance.
# The base function never changes. New behavior is added by wrapping it.

from functools import wraps
from typing import Callable, TypeVar, ParamSpec

P = ParamSpec('P')
T = TypeVar('T')

def with_logging(fn: Callable[P, T]) -> Callable[P, T]:
    """Add logging without modifying the original function."""
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        print(f"Calling {fn.__name__} with {args}, {kwargs}")
        result = fn(*args, **kwargs)
        print(f"{fn.__name__} returned {result}")
        return result
    return wrapper

def with_retry(max_attempts: int = 3, delay: float = 1.0):
    """Add retry logic without modifying the original function."""
    def decorator(fn: Callable[P, T]) -> Callable[P, T]:
        @wraps(fn)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            last_error = None
            for attempt in range(max_attempts):
                try:
                    return fn(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    time.sleep(delay * (2 ** attempt))
            raise last_error
        return wrapper
    return decorator

def with_cache(ttl_seconds: int = 300):
    """Add caching without modifying the original function."""
    cache: dict = {}
    def decorator(fn: Callable[P, T]) -> Callable[P, T]:
        @wraps(fn)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            key = (args, tuple(sorted(kwargs.items())))
            if key in cache and time.time() - cache[key][1] < ttl_seconds:
                return cache[key][0]
            result = fn(*args, **kwargs)
            cache[key] = (result, time.time())
            return result
        return wrapper
    return decorator

# OCP in action: extend fetch_user_data without modifying it.
@with_logging
@with_retry(max_attempts=3)
@with_cache(ttl_seconds=60)
def fetch_user_data(user_id: str) -> dict:
    return http_client.get(f"/users/{user_id}").json()
```

```haskell
-- Haskell: Function composition is OCP at the language level.
-- New pipeline stages extend behavior without modifying existing functions.

processOrder :: Order -> IO Receipt
processOrder =
    validateOrder
    >=> calculateTotal
    >=> applyDiscount
    >=> chargePayment
    >=> generateReceipt

-- Extending the pipeline: add fraud check without modifying any existing function.
processOrderWithFraudCheck :: Order -> IO Receipt
processOrderWithFraudCheck =
    validateOrder
    >=> checkFraud          -- NEW: added without modifying anything above
    >=> calculateTotal
    >=> applyDiscount
    >=> chargePayment
    >=> generateReceipt
```

```typescript
// TypeScript: Middleware pattern as OCP.
type Middleware<T> = (value: T, next: (value: T) => T) => T;

const withValidation: Middleware<Order> = (order, next) => {
  if (!order.items.length) throw new Error('Empty order');
  return next(order);
};

const withDiscount: Middleware<Order> = (order, next) => {
  const discounted = applyBestDiscount(order);
  return next(discounted);
};

const withTax: Middleware<Order> = (order, next) => {
  const taxed = { ...order, total: order.total * 1.08 };
  return next(taxed);
};

// Compose middlewares -- adding new ones never modifies existing ones.
const processOrder = compose(withValidation, withDiscount, withTax);
```

### LSP in Functional Programming

In OOP, LSP means "subtypes must be substitutable for their base types." In FP, this is achieved through **parametric polymorphism** (generics) and **algebraic data types (ADTs) with exhaustive pattern matching**. The type system guarantees substitutability.

```rust
// Rust: Algebraic data types guarantee LSP through exhaustive matching.
// Every variant MUST be handled -- the compiler enforces it.

enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
    Triangle { base: f64, height: f64 },
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
        Shape::Rectangle { width, height } => width * height,
        Shape::Triangle { base, height } => 0.5 * base * height,
        // Compiler ERROR if a variant is missing. LSP is enforced by the type system.
    }
}

// Adding a new variant forces all match expressions to be updated.
// This is compile-time LSP enforcement -- no runtime surprises.
```

```haskell
-- Haskell: Parametric polymorphism guarantees substitutability.
-- A function that works for all types `a` cannot violate LSP
-- because it cannot inspect or discriminate on `a`.

-- This function works for ANY list. It cannot violate LSP.
safeHead :: [a] -> Maybe a
safeHead []    = Nothing
safeHead (x:_) = Just x

-- Type class instances guarantee contract compliance.
-- If you implement Ord, all ordering laws must hold.
class (Eq a) => Ord a where
    compare :: a -> a -> Ordering
    -- Laws:
    -- Transitivity: if a <= b and b <= c then a <= c
    -- Antisymmetry: if a <= b and b <= a then a == b
    -- Totality: either a <= b or b <= a
```

```typescript
// TypeScript: Discriminated unions with exhaustive checks.
type Result<T, E> =
  | { tag: 'ok'; value: T }
  | { tag: 'error'; error: E };

function processResult<T, E>(result: Result<T, E>): string {
  switch (result.tag) {
    case 'ok': return `Success: ${result.value}`;
    case 'error': return `Failed: ${result.error}`;
    // TypeScript's exhaustive check ensures all variants are handled.
  }
}

// The never type acts as a compile-time LSP guard:
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
```

### ISP in Functional Programming

In OOP, ISP means "clients should not be forced to depend on methods they don't use." In FP, this translates to **small function signatures** and **minimal type class constraints**. Functions declare exactly what they need, nothing more.

```haskell
-- Haskell: Type classes are naturally segregated.
-- Each type class defines a minimal, focused interface.

class Printable a where
    prettyPrint :: a -> String

class Serializable a where
    serialize :: a -> ByteString
    deserialize :: ByteString -> Either String a

class Validatable a where
    validate :: a -> Either [ValidationError] a

-- Types implement only what they need.
-- A log entry needs printing but not serialization.
instance Printable LogEntry where
    prettyPrint entry = "[" ++ show (timestamp entry) ++ "] " ++ message entry

-- A data transfer object needs serialization but not pretty printing.
instance Serializable UserDTO where
    serialize = Aeson.encode
    deserialize = Aeson.eitherDecode

-- Functions declare minimal constraints (ISP at the type level):
logItem :: (Printable a) => a -> IO ()
logItem x = putStrLn (prettyPrint x)
-- This function does NOT require Serializable. ISP is satisfied.
```

```rust
// Rust: Traits are naturally segregated.
// Functions require only the traits they actually use.

trait Readable {
    fn read(&self) -> String;
}

trait Writable {
    fn write(&mut self, data: &str) -> Result<(), IoError>;
}

trait Seekable {
    fn seek(&mut self, position: u64) -> Result<(), IoError>;
}

// A logging function only needs Writable -- not Readable or Seekable.
fn write_log(output: &mut dyn Writable, message: &str) -> Result<(), IoError> {
    output.write(&format!("[{}] {}\n", chrono::Utc::now(), message))
}

// A search function only needs Readable.
fn search(source: &dyn Readable, pattern: &str) -> Vec<String> {
    source.read()
        .lines()
        .filter(|line| line.contains(pattern))
        .map(String::from)
        .collect()
}
```

### DIP in Functional Programming

In OOP, DIP means "depend on abstractions, not concretions" -- usually achieved with interfaces and DI containers. In FP, this is achieved through **higher-order functions** (passing behavior as parameters) and **the Reader monad** for environment-based dependency injection.

```typescript
// TypeScript: Functions as dependency injection.
// Dependencies are function parameters, not constructor arguments.

type Logger = (msg: string) => void;
type UserRepository = {
  findById: (id: string) => Promise<User | null>;
  save: (user: User) => Promise<void>;
};
type EmailSender = {
  send: (to: string, subject: string, body: string) => Promise<void>;
};

// DIP: createUserService depends on abstractions (function types), not concretions.
const createUserService = (
  logger: Logger,
  repo: UserRepository,
  emailer: EmailSender
) => ({
  register: async (data: RegistrationData): Promise<User> => {
    logger(`Registering user: ${data.email}`);
    const user = User.create(data);
    await repo.save(user);
    await emailer.send(data.email, 'Welcome!', 'Thanks for signing up.');
    logger(`User registered: ${user.id}`);
    return user;
  },

  findUser: async (id: string): Promise<User | null> => {
    return repo.findById(id);
  },
});

// Wiring: inject concrete implementations.
const userService = createUserService(
  console.log,                    // concrete logger
  new PostgresUserRepository(),   // concrete repo
  new SendGridEmailSender(),      // concrete emailer
);

// Testing: inject test doubles.
const testService = createUserService(
  () => {},                       // silent logger
  inMemoryUserRepo(),             // in-memory repo
  mockEmailSender(),              // mock emailer
);
```

```haskell
-- Haskell: Reader monad for environment-based DI.
-- The environment contains all dependencies as functions.

data AppEnv = AppEnv
  { envLogger     :: String -> IO ()
  , envUserRepo   :: UserRepository
  , envMailer     :: Mailer
  }

type App a = ReaderT AppEnv IO a

registerUser :: RegistrationData -> App User
registerUser regData = do
  env <- ask
  liftIO $ envLogger env ("Registering: " ++ email regData)
  let user = createUser regData
  liftIO $ saveUser (envUserRepo env) user
  liftIO $ sendMail (envMailer env) (email regData) "Welcome!" "Thanks!"
  pure user

-- Production wiring:
prodEnv :: AppEnv
prodEnv = AppEnv
  { envLogger   = putStrLn
  , envUserRepo = postgresRepo connectionString
  , envMailer   = sendGridMailer apiKey
  }

-- Test wiring:
testEnv :: AppEnv
testEnv = AppEnv
  { envLogger   = const (pure ())
  , envUserRepo = inMemoryRepo
  , envMailer   = noOpMailer
  }

-- Run with either environment:
main :: IO ()
main = runReaderT (registerUser someData) prodEnv
```

```scala
// Scala (ZIO): Effect system as DI framework.
// Dependencies are declared in the type signature, resolved at the edge.

trait UserRepository:
  def findById(id: UserId): Task[Option[User]]
  def save(user: User): Task[Unit]

trait EmailService:
  def sendWelcome(user: User): Task[Unit]

// DIP: The service declares dependencies in its type signature.
// ZLayer resolves them at application startup.
def registerUser(data: RegistrationData): ZIO[UserRepository & EmailService, AppError, User] =
  for
    user  <- ZIO.succeed(User.create(data))
    _     <- ZIO.serviceWithZIO[UserRepository](_.save(user))
    _     <- ZIO.serviceWithZIO[EmailService](_.sendWelcome(user))
  yield user
```

---

## SOLID in Go

Go's design philosophy -- simplicity, composition, and small interfaces -- aligns naturally with SOLID principles, even though Go is not a traditional OOP language.

### Go's Approach to Each Principle

**SRP: Package organization.** Go uses packages as the primary unit of organization. Each package has a single, clearly defined purpose. The standard library exemplifies this: `net/http` for HTTP, `encoding/json` for JSON, `database/sql` for SQL.

```go
// Good SRP: focused packages
// /internal/auth/       -- authentication logic
// /internal/billing/    -- billing and payment logic
// /internal/email/      -- email sending logic

// Bad SRP: kitchen-sink package
// /internal/utils/      -- random collection of unrelated functions
```

**OCP: Interfaces defined by consumers.** In Go, interfaces are defined where they are used, not where they are implemented. This means new implementations can be created without modifying existing code.

```go
// The consumer defines what it needs (OCP + ISP combined):
package orderservice

// Only the methods this package actually calls.
type PaymentCharger interface {
    Charge(ctx context.Context, amount Money) (ChargeID, error)
}

// Any type with a Charge method satisfies this interface.
// Adding new payment providers requires zero changes here.
```

**LSP: Implicit interface satisfaction.** Go's implicit interface satisfaction means any type that has the right methods automatically satisfies an interface. The compiler guarantees that all interface methods are implemented.

**ISP: Small interfaces by convention.** Go's proverb "The bigger the interface, the weaker the abstraction" directly expresses ISP. The standard library's `io.Reader` (one method) and `io.Writer` (one method) are the canonical examples.

**DIP: Constructor injection with interfaces.** Go uses constructor functions that accept interface parameters, making dependencies explicit and testable.

```go
// DIP: Constructor accepts interfaces.
func NewOrderService(
    repo OrderRepository,   // interface
    payment PaymentCharger, // interface
    logger Logger,          // interface
) *OrderService {
    return &OrderService{
        repo:    repo,
        payment: payment,
        logger:  logger,
    }
}
```

---

## SOLID in Rust

Rust's type system, with its traits, enums, modules, and ownership model, provides compile-time enforcement of many SOLID principles.

### Rust's Approach to Each Principle

**SRP: Modules and crates.** Rust's module system provides SRP at multiple granularities. Modules group related functionality, and crates serve as the unit of compilation and distribution.

```rust
// Module-level SRP:
mod validation {
    pub fn validate_email(email: &str) -> Result<(), ValidationError> { /* ... */ }
    pub fn validate_age(age: u32) -> Result<(), ValidationError> { /* ... */ }
}

mod persistence {
    pub fn save_user(user: &User) -> Result<(), DbError> { /* ... */ }
    pub fn find_user(id: UserId) -> Result<Option<User>, DbError> { /* ... */ }
}

mod notification {
    pub fn send_welcome_email(user: &User) -> Result<(), EmailError> { /* ... */ }
}
```

**OCP: Traits and blanket implementations.** New behavior is added by implementing traits for existing types, without modifying those types.

```rust
// OCP: Add serialization to any type without modifying it.
trait Exportable {
    fn to_csv(&self) -> String;
    fn to_json(&self) -> String;
}

// Implement for an existing type -- no modification needed.
impl Exportable for Order {
    fn to_csv(&self) -> String {
        format!("{},{},{}", self.id, self.customer, self.total)
    }
    fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap()
    }
}

// Blanket implementation: automatically implement for all collections.
impl<T: Exportable> Exportable for Vec<T> {
    fn to_csv(&self) -> String {
        self.iter().map(|item| item.to_csv()).collect::<Vec<_>>().join("\n")
    }
    fn to_json(&self) -> String {
        let items: Vec<String> = self.iter().map(|item| item.to_json()).collect();
        format!("[{}]", items.join(","))
    }
}
```

**LSP: Enum exhaustiveness and trait object safety.** The compiler ensures all variants are handled and all trait methods are implemented.

**ISP: Trait composition.** Traits in Rust are typically small and focused. Complex behaviors are built by composing multiple traits with `+` bounds.

```rust
// ISP: Small, focused traits composed where needed.
trait Identifiable {
    fn id(&self) -> &str;
}

trait Timestamped {
    fn created_at(&self) -> DateTime<Utc>;
    fn updated_at(&self) -> DateTime<Utc>;
}

trait SoftDeletable {
    fn is_deleted(&self) -> bool;
    fn delete(&mut self);
}

// Functions require only what they need:
fn log_creation(item: &(impl Identifiable + Timestamped)) {
    println!("Created {} at {}", item.id(), item.created_at());
}

fn archive(item: &mut (impl Identifiable + SoftDeletable)) {
    println!("Archiving {}", item.id());
    item.delete();
}
```

**DIP: Trait objects and generics.** Dependencies are expressed as trait bounds, not concrete types.

```rust
// DIP: The service depends on traits, not concrete types.
struct OrderService<R, P, N>
where
    R: OrderRepository,
    P: PaymentProcessor,
    N: Notifier,
{
    repo: R,
    payment: P,
    notifier: N,
}

impl<R, P, N> OrderService<R, P, N>
where
    R: OrderRepository,
    P: PaymentProcessor,
    N: Notifier,
{
    pub fn new(repo: R, payment: P, notifier: N) -> Self {
        Self { repo, payment, notifier }
    }

    pub fn create_order(&self, order: Order) -> Result<OrderId, AppError> {
        self.repo.save(&order)?;
        self.payment.charge(order.total())?;
        self.notifier.notify(&format!("Order {} created", order.id()))?;
        Ok(order.id().clone())
    }
}
```

---

## Comparison Table

| Principle | OOP Approach | FP Approach | Go Approach | Rust Approach |
|-----------|-------------|-------------|-------------|---------------|
| **SRP** | One class = one responsibility | One function = one computation; modules group related functions | Packages with focused purpose | Modules and crates with clear boundaries |
| **OCP** | Inheritance, Strategy pattern, polymorphism | Higher-order functions, function composition, decorators | Interfaces defined by consumers; middleware chains | Traits and blanket implementations |
| **LSP** | Subtype must honor base type contract | Parametric polymorphism; ADTs with exhaustive pattern matching | Implicit interface satisfaction (compiler-checked) | Enum exhaustiveness; trait object safety |
| **ISP** | Many small interfaces instead of one large | Small function signatures; minimal type class constraints | 1-3 method interfaces (io.Reader, http.Handler) | Small traits composed with `+` bounds |
| **DIP** | DI containers, constructor injection | Higher-order functions; Reader monad; effect systems | Constructor functions accepting interfaces | Generic type parameters with trait bounds |

### Key Insight

The paradigm changes, but the principles remain. OOP uses classes and interfaces. FP uses functions and type classes. Go uses packages and implicit interfaces. Rust uses modules and traits. The mechanisms differ, but the goals are identical:

- **Separate concerns** so changes are localized.
- **Design extension points** so new features don't break old code.
- **Honor contracts** so components are interchangeable.
- **Minimize dependencies** so clients aren't burdened by what they don't use.
- **Depend on abstractions** so implementations can be swapped.

---

## Sources

- Martin, R.C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall.
- Martin, R.C. (2002). "Design Principles and Design Patterns." objectmentor.com.
- Milewski, B. (2018). *Category Theory for Programmers*. Bartosz Milewski.
- "SOLID Principles in Functional Programming" -- DEV.to community articles.
- The Rust Programming Language: https://doc.rust-lang.org/book/
- Go Proverbs: https://go-proverbs.github.io/
- Pike, R. (2012). "Go Proverbs." Talk at Gopherfest.
- Lipovaca, M. (2011). *Learn You a Haskell for Great Good!*. No Starch Press.
- De Goes, J. (2019). "ZIO: Next-Generation Effects for Scala." Functional Scala Conference.
- Wlaschin, S. (2018). *Domain Modeling Made Functional*. Pragmatic Bookshelf.
