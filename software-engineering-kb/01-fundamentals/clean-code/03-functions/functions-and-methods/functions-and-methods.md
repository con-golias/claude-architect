# Functions and Methods

> **Domain:** Fundamentals > Clean Code > Functions
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Functions are the fundamental building blocks of any program. Robert C. Martin's first rule in *Clean Code* Chapter 3:

> "Functions should be small. The second rule is: they should be smaller than that."

A clean function does **one thing**, does it **well**, and does it **at one level of abstraction**.

## Why It Matters

Well-written functions are readable, testable, reusable, and debuggable. A function that does 10 things requires complex setup and many test cases. When a small function fails, the bug is confined to a few lines.

## How It Works

### Rule 1: Small (5-20 Lines)

```typescript
// BAD: 80-line function doing everything
async function processOrder(req, res) {
  // 20 lines validation... 15 lines pricing... 10 lines inventory...
}

// GOOD: Orchestrating function calls
async function processOrder(req: Request, res: Response) {
  const dto = validateOrderRequest(req.body);
  const pricing = calculatePricing(dto.items);
  await reserveInventory(dto.items);
  const payment = await processPayment(dto.customerId, pricing.total);
  const order = await saveOrder(dto, pricing, payment);
  await notifyCustomer(order);
  res.status(201).json(order);
}
```

### Rule 2: Do One Thing

```python
# BAD: Three things in one function
def process_user(user_data):
    # Validate, transform, AND save
    if not user_data.get('email'): raise ValueError("Email required")
    user_data['email'] = user_data['email'].lower()
    db.users.insert_one(user_data)

# GOOD: Separated
def validate_user(data: dict) -> None: ...
def normalize_user(data: dict) -> dict: ...
def save_user(data: dict) -> str: ...
```

### Rule 3: Few Arguments (0-2 Ideal)

```typescript
// BAD: Too many arguments
function createUser(name: string, email: string, age: number,
  role: string, department: string, isActive: boolean) {}

// GOOD: Object parameter
function createUser(params: CreateUserParams): User {}
```

### Rule 4: No Side Effects

```java
// BAD: Name says "check" but also modifies state
public boolean checkPassword(String user, String pass) {
    if (passwordValid(user, pass)) {
        Session.initialize();  // Hidden side effect!
        return true;
    }
    return false;
}

// GOOD: Separate query from command
public boolean isPasswordValid(String user, String pass) { ... }
public void initializeSession(User user) { ... }
```

### Rule 5: Command-Query Separation

```typescript
// BAD: Both queries and commands
function set(attr: string, value: string): boolean { ... }

// GOOD: Separated
function attributeExists(attr: string): boolean { ... }  // Query
function setAttribute(attr: string, value: string): void { ... } // Command
```

### Rule 6: No Flag Arguments

```python
# BAD: Boolean flag = two functions in one
def render(data, is_test_mode=False):
    if is_test_mode: return render_test(data)
    else: return render_production(data)

# GOOD: Two explicit functions
def render_production(data): ...
def render_test(data): ...
```

### Rule 7: Guard Clauses (Return Early)

```typescript
// BAD: Deep nesting
function getDiscount(customer: Customer): number {
  if (customer) {
    if (customer.isActive) {
      if (customer.isPremium) {
        return calculatePremiumDiscount(customer);
      }
    }
  }
  return 0;
}

// GOOD: Guard clauses
function getDiscount(customer: Customer): number {
  if (!customer) return 0;
  if (!customer.isActive) return 0;
  if (!customer.isPremium) return 0;
  return calculatePremiumDiscount(customer);
}
```

## Best Practices

1. **Extract till you drop.** If you can extract a meaningful sub-function, do it.
2. **One level of abstraction per function.** Don't mix orchestration with string manipulation.
3. **Long descriptive names > short enigmatic ones.** `includeSetupAndTeardownPages` > `incSAndTDPgs`.
4. **Avoid output arguments.** Return values instead.
5. **Keep indentation to 1-2 levels.**
6. **Make temporal coupling explicit** through return values or method chaining.
7. **Error handling is one thing.** Extract try/catch bodies into their own functions.

## Anti-patterns / Common Mistakes

- **God Function:** 200+ lines doing validation, business logic, DB calls, logging, notifications.
- **Hidden Dependencies:** Functions relying on global state or implicit initialization order.
- **Inconsistent Return Types:** Sometimes a value, sometimes null, sometimes throws.

## Real-world Examples

- **Express.js Middleware:** Small, focused functions composed into a pipeline.
- **Unix Philosophy:** `grep`, `sort`, `wc`, `cut` — single-purpose, composable via pipes.
- **React Hooks:** `useAuth`, `useFetch`, `useDebounce` — composable one-concern functions.

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapter 3: Functions.
- Fowler, M. (2018). *Refactoring* (2nd ed.). Extract Function, Inline Function.
- Meyer, B. (1988). *Object-Oriented Software Construction*. Command-Query Separation.
