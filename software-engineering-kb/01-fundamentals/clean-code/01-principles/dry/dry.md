# DRY — Don't Repeat Yourself

> **Domain:** Fundamentals > Clean Code > Principles
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

The DRY principle was coined by Andy Hunt and Dave Thomas in *The Pragmatic Programmer* (1999):

> "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."

DRY is commonly misunderstood as "don't copy-paste code," but it's deeper than that. It's about **knowledge duplication** — the same business rule, algorithm, or decision should not be expressed in two places. If a rule changes, you should only need to update it in one location.

### Types of Duplication

| Type | Description | Example |
|------|-------------|---------|
| **Code duplication** | Identical or near-identical code blocks | Two functions that validate emails the same way |
| **Knowledge duplication** | Same business rule in multiple places | Discount logic in both frontend and backend |
| **Data duplication** | Same data stored in multiple places | User age stored AND calculated from birth date |
| **Documentation duplication** | Comments that merely restate the code | `// increment counter` before `counter++` |

## Why It Matters

### Single Source of Truth
When a business rule is expressed in one place, changing it requires one edit. When duplicated across five files, you risk updating four and missing one — creating inconsistencies and bugs.

### Reduced Maintenance Cost
Studies show that duplicated code increases maintenance effort by **30-50%**. Every duplicate is a liability that must be kept in sync.

### Fewer Bugs
Bugs caused by inconsistent duplicates are among the hardest to diagnose because each copy may behave slightly differently.

## How It Works

### Example: Code Duplication

```typescript
// BAD: Same validation logic duplicated
function validateRegistrationEmail(email: string): boolean {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

function validateContactFormEmail(email: string): boolean {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

// GOOD: Single source of truth
function isValidEmail(email: string): boolean {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}
```

### Example: Knowledge Duplication

```python
# BAD: Discount logic in two places
class OrderService:
    def calculate_total(self, order):
        if order.customer.is_premium:
            return order.subtotal * 0.85  # 15% discount

class InvoiceService:
    def generate_invoice(self, order):
        if order.customer.is_premium:
            discount = order.subtotal * 0.15  # Same rule, different place!
            return order.subtotal - discount

# GOOD: Centralized business rule
class DiscountPolicy:
    PREMIUM_DISCOUNT = 0.15

    @staticmethod
    def apply(subtotal: float, customer: Customer) -> float:
        if customer.is_premium:
            return subtotal * (1 - DiscountPolicy.PREMIUM_DISCOUNT)
        return subtotal
```

### Example: Data Duplication

```java
// BAD: Age stored AND calculated
public class User {
    private LocalDate birthDate;
    private int age;  // Duplicated knowledge — will go stale!

    public void setAge(int age) { this.age = age; }
}

// GOOD: Derive from single source
public class User {
    private final LocalDate birthDate;

    public int getAge() {
        return Period.between(birthDate, LocalDate.now()).getYears();
    }
}
```

## Best Practices

1. **Extract shared logic into functions/methods.** The most basic DRY technique — identify repeated code blocks and extract them.

2. **Use constants for magic numbers and strings.** Don't repeat `0.15` for a discount rate — define `const PREMIUM_DISCOUNT_RATE = 0.15`.

3. **Centralize business rules.** Validation rules, pricing logic, and permission checks should each live in one authoritative module.

4. **Use configuration over duplication.** Instead of duplicating environment-specific code, use configuration files or environment variables.

5. **Apply DRY to schemas.** Database schema, API schema, and TypeScript types for the same entity should ideally be generated from a single source (e.g., OpenAPI spec generates both server types and client types).

6. **DRY across the stack.** If the frontend and backend both validate the same rules, consider sharing validation schemas (e.g., Zod schemas shared between Next.js frontend and API).

## Anti-patterns / Common Mistakes

### Wrong Abstraction (DRY Overuse)
The most dangerous DRY mistake: **premature abstraction**. When two pieces of code look similar but represent different business concepts, forcing them into a shared abstraction creates coupling that's worse than duplication.

```typescript
// Two functions that look similar but serve DIFFERENT purposes:
function formatUserAddress(user: User): string { ... }
function formatWarehouseAddress(warehouse: Warehouse): string { ... }

// BAD: Forcing DRY creates wrong coupling
function formatAddress(entity: User | Warehouse): string {
  // Now changes to user addresses affect warehouse display!
}

// GOOD: Keep them separate — they'll diverge over time
```

Sandi Metz famously said:
> "Duplication is far cheaper than the wrong abstraction."

### WET and AHA Alternatives

- **WET (Write Everything Twice):** Intentionally duplicate until you see patterns. Only abstract on the third occurrence.
- **AHA (Avoid Hasty Abstractions):** Dan Abramov's principle — prefer duplication over the wrong abstraction. Wait until you truly understand the pattern before abstracting.

### DRY Across Service Boundaries
In microservices, forcing DRY across services creates tight coupling. Each service should own its own models and logic, even if some duplication exists. Inter-service DRY is an anti-pattern.

## Real-world Examples

### Django's ORM
Django defines the data model once in Python, and generates database migrations, admin interfaces, and form validation from that single definition — a masterclass in DRY.

### GraphQL Code Generation
Tools like `graphql-codegen` generate TypeScript types from a GraphQL schema, eliminating the need to manually duplicate type definitions between server and client.

### Terraform Modules
Infrastructure as Code uses modules to define reusable infrastructure components. Instead of duplicating AWS resource definitions, you create a module and parameterize it.

## Sources

- Hunt, A. & Thomas, D. (1999). *The Pragmatic Programmer*. Addison-Wesley.
- Martin, R.C. (2008). *Clean Code*. Prentice Hall.
- Metz, S. (2016). "The Wrong Abstraction." (Blog post)
- Abramov, D. (2020). "AHA Programming." (Blog post)
- [KISS, DRY, SOLID, YAGNI Guide (Medium)](https://medium.com/@hlfdev/kiss-dry-solid-yagni-a-simple-guide-to-some-principles-of-software-engineering-and-clean-code-05e60233c79f)
