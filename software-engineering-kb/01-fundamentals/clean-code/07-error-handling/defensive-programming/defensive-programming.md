# Defensive Programming

> **Domain:** Fundamentals > Clean Code > Error Handling
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Defensive programming is the practice of writing code that anticipates and handles unexpected conditions, invalid inputs, and misuse — even when "it shouldn't happen." The core philosophy:

> "Program as if the person who will maintain your code is a violent psychopath who knows where you live." — attributed to John Woods

Key techniques include: input validation, guard clauses, assertions, Design by Contract, and null safety patterns.

### Design by Contract (Bertrand Meyer, 1986)

Every function has a **contract** with three parts:
- **Preconditions:** What must be true before the function runs.
- **Postconditions:** What must be true after the function runs.
- **Invariants:** What must always be true for the object's state.

## Why It Matters

Defensive programming catches errors **close to their source**, making debugging much easier. An unvalidated input that causes a crash 10 function calls deeper is far harder to diagnose than one caught at the boundary.

## How It Works

### Guard Clauses

```typescript
// BAD: Deep nesting
function processPayment(order: Order, gateway: PaymentGateway) {
  if (order) {
    if (order.total > 0) {
      if (gateway) {
        return gateway.charge(order.total);
      }
    }
  }
  return null;
}

// GOOD: Guard clauses — validate and exit early
function processPayment(order: Order, gateway: PaymentGateway): PaymentResult {
  if (!order) throw new ArgumentError('Order is required');
  if (order.total <= 0) throw new ArgumentError('Order total must be positive');
  if (!gateway) throw new ArgumentError('Payment gateway is required');

  return gateway.charge(order.total);
}
```

### Null Safety Patterns

```kotlin
// Kotlin: Null safety built into the type system
fun findUser(id: String): User? {  // Nullable return type
    return userRepository.findById(id)
}

val user = findUser("123")
val name = user?.name ?: "Unknown"  // Safe call + Elvis operator
```

```typescript
// TypeScript: Optional chaining and nullish coalescing
const city = user?.address?.city ?? 'Unknown';

// Java: Optional
Optional<User> user = repository.findById(id);
String name = user.map(User::getName).orElse("Unknown");
```

### Assertions (Development-Time Checks)

```python
def calculate_discount(price: float, rate: float) -> float:
    assert price >= 0, f"Price must be non-negative, got {price}"
    assert 0 <= rate <= 1, f"Rate must be between 0 and 1, got {rate}"

    discount = price * rate
    result = price - discount

    assert result >= 0, "Discount cannot exceed price"
    return result
```

## Best Practices

1. **Validate at system boundaries** — user input, API requests, file reads, environment variables. Trust internal code more.
2. **Use guard clauses** to handle edge cases at the top of functions.
3. **Prefer type systems over runtime checks.** TypeScript, Kotlin, Rust make many errors impossible at compile time.
4. **Don't use exceptions for expected cases.** A missing optional query parameter isn't exceptional.
5. **Make illegal states unrepresentable.** Design types so invalid states can't be constructed.

## Anti-patterns / Common Mistakes

- **Paranoid programming:** Checking every single internal call for null. Trust your own code; validate at boundaries.
- **Silently swallowing errors:** Converting failures to default values without logging or alerting.
- **Guard clause hell:** 20 guard clauses at the top of every function — often indicates the function does too much.

## Sources

- Meyer, B. (1988). *Object-Oriented Software Construction*. Design by Contract.
- McConnell, S. (2004). *Code Complete* (2nd ed.). Chapter 8: Defensive Programming.
- [Clean Code — Guard Clauses (Medium)](https://medium.com/@BasuraRatnayake/clean-code-guard-clauses-796225c83c3e)
