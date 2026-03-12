# Error Handling

> **Domain:** Fundamentals > Clean Code > Error Handling
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Error handling is how software responds to unexpected conditions — invalid input, network failures, resource exhaustion, and logic errors. Robert C. Martin dedicates Chapter 7 of *Clean Code* to error handling with one core message:

> "Error handling is important, but if it obscures logic, it's wrong."

Clean error handling means: use exceptions (not error codes), don't return null, don't pass null, and keep error handling separate from business logic.

## Why It Matters

Poor error handling causes crashes, data corruption, security vulnerabilities, and terrible user experiences. Studies show **30-50% of production incidents** are caused by inadequate error handling, not the original error.

## How It Works

### Exceptions vs. Error Codes

```java
// BAD: Error codes — caller must check every return
int result = device.open();
if (result == E_OK) {
    result = device.sendData(data);
    if (result == E_OK) {
        result = device.close();
    } else {
        logger.error("Send failed");
    }
} else {
    logger.error("Open failed");
}

// GOOD: Exceptions — clean separation of happy path and error handling
try {
    device.open();
    device.sendData(data);
    device.close();
} catch (DeviceException e) {
    logger.error("Device operation failed", e);
    reportError(e);
}
```

### Don't Return Null

```typescript
// BAD: Caller must check for null everywhere
function findUser(id: string): User | null {
  return db.users.find(u => u.id === id) || null;
}
const user = findUser('123');
if (user !== null) { // Null check everywhere!
  console.log(user.name);
}

// GOOD: Throw an exception or use a special case
function findUser(id: string): User {
  const user = db.users.find(u => u.id === id);
  if (!user) throw new UserNotFoundError(id);
  return user;
}

// OR: Return an Optional/Maybe
function findUser(id: string): User | undefined {
  return db.users.find(u => u.id === id);
}
```

### Custom Exception Hierarchies

```python
# Define a domain-specific exception hierarchy
class AppError(Exception):
    """Base error for the application."""
    def __init__(self, message: str, code: str = "UNKNOWN"):
        self.message = message
        self.code = code

class NotFoundError(AppError):
    def __init__(self, entity: str, entity_id: str):
        super().__init__(f"{entity} '{entity_id}' not found", "NOT_FOUND")

class ValidationError(AppError):
    def __init__(self, field: str, reason: str):
        super().__init__(f"Validation failed for '{field}': {reason}", "VALIDATION")

class AuthorizationError(AppError):
    def __init__(self, action: str):
        super().__init__(f"Not authorized to {action}", "FORBIDDEN")
```

### Functional Error Handling (Result/Either Pattern)

```typescript
// Result type — explicit error handling without exceptions
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function parseAge(input: string): Result<number, string> {
  const age = parseInt(input, 10);
  if (isNaN(age)) return { ok: false, error: 'Not a number' };
  if (age < 0 || age > 150) return { ok: false, error: 'Age out of range' };
  return { ok: true, value: age };
}

const result = parseAge(userInput);
if (result.ok) {
  console.log(`Age: ${result.value}`);
} else {
  console.error(`Error: ${result.error}`);
}
```

### Fail Fast Principle

```java
// GOOD: Validate at the boundary and fail immediately
public class Order {
    public Order(List<LineItem> items, Customer customer) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Order must have at least one item");
        }
        if (customer == null) {
            throw new IllegalArgumentException("Customer is required");
        }
        this.items = List.copyOf(items);
        this.customer = customer;
    }
}
```

## Best Practices

1. **Use exceptions for exceptional conditions.** Don't use exceptions for normal flow control.
2. **Write try-catch-finally first** (TDD style) — decide on error behavior before happy-path logic.
3. **Don't catch generic exceptions.** Catch specific exceptions you can handle. Let others propagate.
4. **Provide context with exceptions.** Include what operation failed and why: `Failed to save order ORD-123: database connection timeout`.
5. **Don't return null.** Use exceptions, Optional types, or empty collections.
6. **Don't pass null.** Forbid null arguments in public APIs.
7. **Separate error handling from business logic.** Extract try/catch bodies into separate functions.
8. **Use error boundaries.** In React, error boundaries catch rendering errors. In APIs, global error handlers catch and format errors.

## Anti-patterns / Common Mistakes

- **Pokemon exception handling:** `catch (Exception e) {}` — catches everything, handles nothing.
- **Swallowing exceptions:** Empty catch blocks that silently ignore errors.
- **Returning null instead of throwing:** Forces null checks throughout the codebase.
- **Using exceptions for control flow:** `try { array[i] } catch (IndexOutOfBounds)` instead of bounds checking.

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapter 7: Error Handling.
- Bloch, J. (2018). *Effective Java* (3rd ed.). Items 69-77 on exceptions.
- [Clean Code Key Dos and Don'ts (testRigor)](https://testrigor.com/blog/clean-code-key-dos-and-donts/)
