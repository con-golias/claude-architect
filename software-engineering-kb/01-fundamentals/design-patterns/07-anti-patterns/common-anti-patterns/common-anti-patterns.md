# Common Anti-Patterns

> **Domain:** Fundamentals > Design Patterns > Anti-Patterns
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What They Are

Anti-patterns are **commonly occurring solutions that appear to be beneficial but ultimately produce more problems than they solve**. Recognizing anti-patterns is as important as knowing design patterns — they help you identify problematic code and understand why certain designs fail at scale.

**Origin:** The term was coined by Andrew Koenig in 1995 and expanded by William Brown et al. in *AntiPatterns: Refactoring Software, Architectures, and Projects in Crisis* (1998).

## Catalog of Anti-Patterns

### 1. God Object / God Class

An object that **knows too much or does too much** — it centralizes most of the application's logic, making it a single point of failure and impossible to test or modify safely.

```typescript
// Anti-pattern — God class handles everything
class Application {
  private db: Database;
  private cache: Redis;
  private mailer: SMTP;

  // User logic
  createUser(data: UserData): User { /* ... */ }
  deleteUser(id: string): void { /* ... */ }
  authenticateUser(email: string, password: string): Token { /* ... */ }
  resetPassword(email: string): void { /* ... */ }

  // Order logic
  createOrder(userId: string, items: Item[]): Order { /* ... */ }
  cancelOrder(orderId: string): void { /* ... */ }
  calculateShipping(order: Order): number { /* ... */ }

  // Payment logic
  processPayment(orderId: string, card: Card): Receipt { /* ... */ }
  refundPayment(receiptId: string): void { /* ... */ }

  // Report logic
  generateDailyReport(): Report { /* ... */ }
  exportToCSV(report: Report): string { /* ... */ }

  // 50+ more methods...
}

// Fix — split into focused classes (Single Responsibility Principle)
class UserService { /* user logic only */ }
class OrderService { /* order logic only */ }
class PaymentService { /* payment logic only */ }
class ReportService { /* report logic only */ }
```

**Symptoms:** Class with 1000+ lines, 20+ dependencies, methods spanning unrelated domains.

### 2. Spaghetti Code

Code with **no clear structure** — tangled control flow, deeply nested conditionals, and logic scattered across files with unclear relationships. The code path is nearly impossible to follow.

```javascript
// Anti-pattern — tangled, unpredictable flow
function processOrder(order) {
  if (order.items.length > 0) {
    let total = 0;
    for (let i = 0; i < order.items.length; i++) {
      if (order.items[i].inStock) {
        if (order.coupon && order.coupon.applies(order.items[i])) {
          if (order.coupon.type === "percent") {
            total += order.items[i].price * (1 - order.coupon.value / 100);
          } else if (order.coupon.type === "fixed") {
            total += Math.max(0, order.items[i].price - order.coupon.value);
          } else {
            total += order.items[i].price;
          }
        } else {
          total += order.items[i].price;
        }
        // update inventory inline
        db.query(`UPDATE inventory SET qty = qty - 1 WHERE sku = '${order.items[i].sku}'`);
      } else {
        // partially handle backorder... sometimes
        if (order.allowBackorder) {
          total += order.items[i].price;
          // TODO: notify warehouse
        }
      }
    }
    // more tangled logic for tax, shipping, discounts...
  }
}

// Fix — extract into clear functions with single responsibility
function calculateTotal(items: Item[], coupon?: Coupon): number {
  return items
    .filter(item => item.inStock)
    .reduce((sum, item) => sum + applyDiscount(item.price, coupon), 0);
}

function applyDiscount(price: number, coupon?: Coupon): number {
  if (!coupon) return price;
  switch (coupon.type) {
    case "percent": return price * (1 - coupon.value / 100);
    case "fixed":   return Math.max(0, price - coupon.value);
    default:        return price;
  }
}
```

### 3. Golden Hammer

**Using a familiar technology or pattern for every problem**, regardless of whether it fits. "When all you have is a hammer, everything looks like a nail."

```
Examples:
- Using a relational database for everything (including graph data, key-value lookups)
- Applying microservices to a 2-person startup project
- Using Redux for simple component-local state
- Writing everything in one language when another is clearly better suited
- Forcing every problem into OOP when a functional approach is simpler

Cure: Choose tools based on the problem, not on familiarity.
```

### 4. Premature Optimization

**Optimizing code before knowing whether it's a bottleneck.** Results in complex, unreadable code that solves problems that don't exist.

```typescript
// Anti-pattern — "optimized" but unreadable, and the optimization doesn't matter
function findUser(users: User[], id: string): User | undefined {
  // Binary search with manual memory management
  let lo = 0, hi = users.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = users[mid].id.localeCompare(id);
    if (cmp === 0) return users[mid];
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

// Reality — this is called once per request with 50 users
// A simple find() is clear and fast enough
function findUser(users: User[], id: string): User | undefined {
  return users.find(u => u.id === id);
}
```

**Rule:** "Make it work, make it right, make it fast" — Kent Beck. Profile before optimizing.

### 5. Lava Flow

**Dead code, unused variables, and obsolete modules that nobody dares to remove** because nobody knows if something still depends on them. The code solidifies like cooled lava — untouchable and growing.

```typescript
// Anti-pattern — accumulated dead code
export function processPayment_v2(order: Order): Receipt { /* current version */ }
export function processPayment(order: Order): Receipt { /* old version — still here "just in case" */ }
export function processPaymentOld(order: Order): Receipt { /* even older — afraid to delete */ }
// export function processPaymentExperimental(order: Order): Receipt { /* commented out 2 years ago */ }

const LEGACY_TAX_RATE = 0.08;    // unused since 2023
const OLD_API_ENDPOINT = "...";  // nobody knows if this is used

// Fix: delete dead code. That's what version control is for.
// If you need it back, git log will have it.
```

### 6. Copy-Paste Programming

**Duplicating code instead of abstracting** common functionality. Leads to bugs being fixed in one copy but not others, and changes needing to be replicated across all copies.

```typescript
// Anti-pattern — same validation logic in 4 places
// user-controller.ts
if (!email || !email.includes("@") || email.length > 255) {
  throw new Error("Invalid email");
}

// admin-controller.ts (slightly different — bug!)
if (!email || !email.includes("@")) {
  throw new Error("Invalid email");  // missing length check
}

// registration-service.ts
if (!email || !email.includes("@") || email.length > 255) {
  throw new Error("Invalid email");
}

// Fix — extract into single source of truth
function validateEmail(email: string): void {
  if (!email || !email.includes("@") || email.length > 255) {
    throw new ValidationError("Invalid email");
  }
}
```

### 7. Cargo Cult Programming

**Copying patterns, code, or practices without understanding why they work.** The code includes unnecessary ritual steps because "that's how the tutorial did it."

```typescript
// Anti-pattern — unnecessary complexity copied from a "best practices" article
class UserRepositoryFactoryProviderSingleton {
  private static instance: UserRepositoryFactoryProviderSingleton;

  static getInstance(): UserRepositoryFactoryProviderSingleton {
    if (!this.instance) {
      this.instance = new UserRepositoryFactoryProviderSingleton();
    }
    return this.instance;
  }

  createRepositoryFactory(): UserRepositoryFactory {
    return new UserRepositoryFactory();
  }
}

// Reality — this is a simple CRUD app with one database
// All you need:
const userRepo = new UserRepository(db);
```

### 8. Boat Anchor

**Keeping code, frameworks, or infrastructure "in case we need it later"** — but the need never comes. The anchor adds weight (complexity, maintenance, dependencies) with no benefit.

```
Examples:
- Unused database tables kept "just in case"
- Imported libraries used for 1 utility function
- Abstract factory for a class that will only ever have one implementation
- Microservice skeleton with no actual service logic
- Feature flags for features that launched 2 years ago

YAGNI (You Aren't Gonna Need It): Delete it. Build it when you need it.
```

### 9. Circular Dependencies

**Modules that depend on each other**, creating a cycle that makes the code fragile, hard to test, and prone to initialization order bugs.

```typescript
// Anti-pattern — circular dependency
// user.service.ts
import { OrderService } from "./order.service";
class UserService {
  constructor(private orderService: OrderService) {}
  deleteUser(id: string) {
    this.orderService.cancelAllOrders(id);
  }
}

// order.service.ts
import { UserService } from "./user.service";
class OrderService {
  constructor(private userService: UserService) {}
  getOrderOwner(orderId: string) {
    return this.userService.findById(this.getOrder(orderId).userId);
  }
}

// Fix — break the cycle with events or an intermediate module
// user.service.ts
class UserService {
  deleteUser(id: string) {
    eventBus.publish("user:deleted", { userId: id });
  }
}

// order.service.ts — listens, no import needed
eventBus.subscribe("user:deleted", ({ userId }) => {
  orderService.cancelAllOrders(userId);
});
```

### 10. Shotgun Surgery

**A single change requires modifying many different files** scattered across the codebase. The opposite of high cohesion — related logic is spread too thin.

```
Symptom: Adding a new field to "User" requires changes in:
  - user.model.ts
  - user.controller.ts
  - user.service.ts
  - user.repository.ts
  - user.mapper.ts
  - user.validator.ts
  - user.serializer.ts
  - user.test.ts
  - user.factory.ts (test)
  - migration file

Cure: Reduce indirection. Not every layer needs its own model.
      Use shared types. Colocate related logic.
```

### Anti-Pattern Detection Summary

```
Anti-Pattern              Key Symptom                    Primary Fix
──────────────────────────────────────────────────────────────────────
God Object                One class does everything       SRP — split
Spaghetti Code            Untraceable control flow        Extract functions
Golden Hammer             Same tool for every problem     Evaluate alternatives
Premature Optimization    Complex code, no benchmark      Profile first
Lava Flow                 Dead code nobody removes        Delete + trust VCS
Copy-Paste                Duplicate logic                 Extract + share
Cargo Cult                Patterns without understanding  Understand why
Boat Anchor               Code "just in case"             YAGNI — delete
Circular Dependencies     A → B → A                      Events or interfaces
Shotgun Surgery           1 change → many files           Increase cohesion
```

## Sources

- Brown, W. et al. (1998). *AntiPatterns: Refactoring Software, Architectures, and Projects in Crisis*. Wiley.
- Fowler, M. (1999). *Refactoring*. Addison-Wesley. (Code smells as anti-pattern indicators)
- Martin, R.C. (2008). *Clean Code*. Prentice Hall. Chapters 3, 17.
- [Sourcemaking — AntiPatterns](https://sourcemaking.com/antipatterns)
