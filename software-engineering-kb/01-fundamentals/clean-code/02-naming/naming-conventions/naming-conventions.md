# Naming Conventions

> **Domain:** Fundamentals > Clean Code > Naming
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

Naming conventions are systematic rules for choosing identifiers (variables, functions, classes, files, directories) in source code. Good naming is universally considered the **single most important factor** in code readability.

Robert C. Martin dedicates Chapter 2 of *Clean Code* entirely to naming:

> "The name of a variable, function, or class should answer all the big questions: why it exists, what it does, and how it is used."

### Naming Styles

| Style | Example | Typical Use |
|-------|---------|------------|
| **camelCase** | `getUserName` | JS/TS variables and functions, Java methods |
| **PascalCase** | `UserProfile` | Classes, components, types, interfaces |
| **snake_case** | `user_name` | Python variables/functions, Ruby, Rust, DB columns |
| **SCREAMING_SNAKE_CASE** | `MAX_RETRY_COUNT` | Constants, environment variables |
| **kebab-case** | `user-profile` | CSS classes, URLs, file names |

## Why It Matters

Developers spend **10x more time reading code than writing it**. Good names make code self-documenting. When `accountList` is actually a `Set`, bugs happen. Well-named identifiers are also easy to find with search tools — `d` is impossible to grep for; `elapsedDays` is trivial.

## How It Works

### Variables

```typescript
// BAD                    // GOOD
let d;                    let elapsedDays;
let list1;                let activeUsers;
let hp;                   let hitPoints;
let theData;              let paymentTransactions;
```

**Rules:** Use nouns/noun phrases. Be specific. Include units when relevant (`timeoutMs`, `distanceKm`). Plurals for collections, singular for items.

### Booleans

```typescript
// BAD         // GOOD — use is/has/can/should prefixes
let flag;      let isActive;
let status;    let hasPermission;
let check;     let canEdit;
```

### Functions

```typescript
// BAD                    // GOOD — verb + noun
function data() {}        function fetchUserProfile(userId: string) {}
function process() {}     function calculateTotalPrice(items: CartItem[]) {}
function handle(x) {}     function validateEmailAddress(email: string) {}
```

Start with a verb: `get`, `set`, `create`, `delete`, `calculate`, `validate`, `send`, `parse`, `format`. Use consistent pairs: `open/close`, `start/stop`, `begin/end`.

### Classes

```typescript
// BAD                    // GOOD — specific nouns
class Data {}             class UserAccount {}
class Manager {}          class PaymentGateway {}
class Helper {}           class PricingEngine {}
```

Avoid suffixes like `Manager`, `Handler`, `Processor`, `Helper`, `Utils` — they indicate a class does too many things.

### Language-Specific Conventions

**Python (PEP 8):**
```python
user_name = "Alice"                    # snake_case variables
def calculate_total_price(items): pass # snake_case functions
class UserProfile: pass                # PascalCase classes
MAX_RETRY_COUNT = 3                    # SCREAMING_SNAKE constants
self._balance = 0                      # Leading underscore = protected
```

**Java:**
```java
public class OrderService {                    // PascalCase class
    private static final int MAX_RETRIES = 3;  // SCREAMING_SNAKE constants
    private final String customerName;          // camelCase fields
    public List<Order> findActiveOrders() {}    // camelCase methods
}
```

**C#:**
```csharp
public class OrderService
{
    private const int MaxRetries = 3;           // PascalCase constants
    private readonly string _customerName;      // _camelCase private fields
    public List<Order> FindActiveOrders() {}    // PascalCase methods
}
```

## Best Practices

1. **Use intention-revealing names** that answer why, what, and how without needing comments.
2. **Avoid abbreviations.** `generateReport()` > `genRpt()`. Modern IDEs have autocomplete.
3. **Make names pronounceable.** `ymdhms` → `timestamp`.
4. **Make names searchable.** Avoid single-letter names except in tiny loop scopes.
5. **Use consistent vocabulary.** Don't mix `fetch`, `retrieve`, `get`, `obtain` — pick one.
6. **Don't encode types.** Hungarian notation (`strName`, `iCount`) is obsolete.
7. **Avoid noise words.** `ProductData` vs `ProductInfo` vs `Product` — just use `Product`.
8. **Use domain language (DDD).** If the business says "invoice," don't call it `bill` in code.
9. **Length matches scope.** Short names for tiny scopes; descriptive names for large scopes.
10. **Rename fearlessly.** If you find a better name, refactor. IDEs make it safe.

## Anti-patterns / Common Mistakes

### Misleading Names
```typescript
const accountList = new Set<Account>();  // It's a Set, not a List!
```

### Name/Behavior Mismatch
`saveUser()` that also sends an email. `isValid()` that modifies state. The worst kind of naming bug.

### Meaningless Distinctions
```typescript
function getActiveAccount() {}
function getActiveAccountData() {}    // What's the difference?
function getActiveAccountInfo() {}
```

## Real-world Examples

- **Google Style Guides** enforce strict naming across languages.
- **Airbnb JS Guide:** camelCase variables, PascalCase classes, SCREAMING_SNAKE constants.
- **React:** PascalCase components required by JSX: `<UserProfile />` not `<userProfile />`.

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapter 2: Meaningful Names.
- [Naming Conventions from Uncle Bob's Clean Code (DZone)](https://dzone.com/articles/naming-conventions-from-uncle-bobs-clean-code-phil)
- [Clean Code: Naming (Baeldung)](https://www.baeldung.com/cs/clean-coding-naming)
- [Google Style Guides](https://google.github.io/styleguide/)
- Python PEP 8 — Style Guide for Python Code.
