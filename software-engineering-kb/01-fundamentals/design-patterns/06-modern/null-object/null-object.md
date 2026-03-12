# Null Object Pattern

> **Domain:** Fundamentals > Design Patterns > Modern
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

The Null Object pattern replaces `null`/`undefined` checks with a **special object that implements the expected interface but does nothing**. Instead of checking for null before every method call, you use a "null" implementation that provides default, harmless behavior. This eliminates `NullPointerException`/`TypeError` risks and removes conditional null-checking logic throughout the code.

**Origin:** Described by Bobby Woolf in the *Pattern Languages of Program Design 3* (1997). Later recognized as a standard refactoring technique by Martin Fowler and as a behavioral pattern complementary to the GoF patterns.

## How It Works

```typescript
// Without Null Object — null checks everywhere
class OrderService {
  getDiscount(customer: Customer | null): number {
    if (customer === null) return 0;
    if (customer.loyaltyProgram === null) return 0;
    return customer.loyaltyProgram.getDiscount();
  }

  getGreeting(customer: Customer | null): string {
    if (customer === null) return "Welcome, guest";
    return `Welcome, ${customer.name}`;
  }

  sendReceipt(customer: Customer | null, order: Order): void {
    if (customer !== null && customer.email !== null) {
      emailService.send(customer.email, formatReceipt(order));
    }
  }
}

// With Null Object — no null checks needed
interface Customer {
  name: string;
  email: string;
  loyaltyProgram: LoyaltyProgram;
  isGuest(): boolean;
}

interface LoyaltyProgram {
  getDiscount(): number;
  addPoints(amount: number): void;
}

// Null implementations
class GuestCustomer implements Customer {
  name = "Guest";
  email = "";
  loyaltyProgram: LoyaltyProgram = new NoLoyaltyProgram();
  isGuest() { return true; }
}

class NoLoyaltyProgram implements LoyaltyProgram {
  getDiscount() { return 0; }        // safe default
  addPoints(_amount: number) {}       // no-op
}

// Clean service — no null checks
class OrderService {
  getDiscount(customer: Customer): number {
    return customer.loyaltyProgram.getDiscount();  // always safe
  }

  getGreeting(customer: Customer): string {
    return `Welcome, ${customer.name}`;  // "Welcome, Guest" for null object
  }

  sendReceipt(customer: Customer, order: Order): void {
    if (!customer.isGuest()) {
      emailService.send(customer.email, formatReceipt(order));
    }
  }
}

// Factory method returns null object instead of null
function findCustomer(id: string): Customer {
  const found = database.findById(id);
  return found ?? new GuestCustomer();  // never returns null
}
```

### Common Null Object Implementations

```typescript
// Null Logger — silently discards log messages
interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  error(msg: string, err?: Error): void;
}

class ConsoleLogger implements Logger {
  debug(msg: string) { console.debug(msg); }
  info(msg: string) { console.info(msg); }
  error(msg: string, err?: Error) { console.error(msg, err); }
}

class NullLogger implements Logger {
  debug(_msg: string) {}   // no-op
  info(_msg: string) {}    // no-op
  error(_msg: string) {}   // no-op
}

// Use NullLogger as default — no need to check if logger exists
class PaymentProcessor {
  constructor(private logger: Logger = new NullLogger()) {}

  process(payment: Payment): void {
    this.logger.info(`Processing payment: ${payment.id}`);
    // ... process
    this.logger.info(`Payment complete: ${payment.id}`);
  }
}

// Works with or without a real logger
new PaymentProcessor();                      // silent
new PaymentProcessor(new ConsoleLogger());   // logs to console
```

```python
# Python — Null Object with default behavior
from abc import ABC, abstractmethod

class Cache(ABC):
    @abstractmethod
    def get(self, key: str) -> any: ...

    @abstractmethod
    def set(self, key: str, value: any, ttl: int = 300) -> None: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

class RedisCache(Cache):
    def __init__(self, client):
        self.client = client

    def get(self, key: str):
        return self.client.get(key)

    def set(self, key: str, value, ttl: int = 300):
        self.client.setex(key, ttl, value)

    def delete(self, key: str):
        self.client.delete(key)

class NullCache(Cache):
    """Cache that caches nothing — every get() is a miss."""
    def get(self, key: str):
        return None             # always miss

    def set(self, key: str, value, ttl: int = 300):
        pass                    # discard

    def delete(self, key: str):
        pass                    # no-op

# Service works identically regardless of cache implementation
class ProductService:
    def __init__(self, repo, cache: Cache = NullCache()):
        self.repo = repo
        self.cache = cache      # never None

    def get_product(self, id: str):
        cached = self.cache.get(f"product:{id}")
        if cached:
            return cached

        product = self.repo.find_by_id(id)
        self.cache.set(f"product:{id}", product)
        return product
```

### Null Object vs Alternatives

```
Null checks:        if (x !== null) x.method()   — clutters every call site
Optional chaining:  x?.method()                  — returns undefined, may need checks later
Null Object:        x.method()                   — always safe, provides default behavior
Optional/Maybe:     x.map(v => v.method())       — forces explicit handling (Rust, Haskell)

Null Object works best when:
  - A sensible default "do nothing" behavior exists
  - The interface is called in many places
  - You want to avoid spreading null checks

Use Optional/Maybe when:
  - Absence is meaningful and must be handled explicitly
  - There is no sensible default
  - Type system supports it (Rust Option<T>, Java Optional<T>)
```

## Real-world Examples

- **`/dev/null`** — Unix null device; writes succeed, reads return nothing.
- **`java.util.Collections.emptyList()`** — an immutable empty list, not null.
- **`NullOutputStream`** — Apache Commons IO; writes go nowhere.
- **Logback `NOPLogger`** — logger that discards all messages.
- **React default props** — `onClick = () => {}` instead of null check in handler.
- **`Object.freeze({})`** — immutable empty object as safe default in JavaScript.
- **Python `logging.NullHandler`** — standard library null handler for libraries.

## Sources

- Woolf, B. (1997). "Null Object." *Pattern Languages of Program Design 3*. Addison-Wesley.
- Fowler, M. (1999). *Refactoring*. Addison-Wesley. pp. 260-261. "Introduce Null Object."
- [Refactoring.Guru — Null Object](https://refactoring.guru/introduce-null-object)
