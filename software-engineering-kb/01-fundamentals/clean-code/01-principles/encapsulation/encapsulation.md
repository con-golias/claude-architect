# Encapsulation

> **Domain:** Fundamentals > Clean Code > Principles
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Encapsulation is one of the four pillars of Object-Oriented Programming (along with Abstraction, Inheritance, and Polymorphism). It was formalized by David Parnas in his 1972 paper "On the Criteria to be Used in Decomposing Systems into Modules."

> "Hide internal implementation details and expose only what is necessary through a well-defined interface."

Encapsulation has two aspects:
1. **Bundling:** Grouping data and the methods that operate on it into a single unit (class/module).
2. **Information Hiding:** Restricting direct access to internal state, forcing interaction through controlled methods.

The goal: protect the **invariants** of an object. If an object's internal state can be modified freely from outside, it's impossible to guarantee consistency.

## Why It Matters

### Data Integrity
Encapsulation ensures that objects are always in a valid state. External code cannot put an object into an inconsistent state.

### Reduced Coupling
When internals are hidden, other code depends only on the public interface. You can change the implementation without breaking clients.

### Easier Debugging
If a value is wrong, you know it was set through one of the controlled methods — not randomly mutated from anywhere in the codebase.

### API Stability
Public interfaces are contracts. By keeping internals private, you can refactor freely without breaking external consumers.

## How It Works

### Example: Poor Encapsulation

```typescript
// BAD: Public fields — anyone can set invalid state
class BankAccount {
  public balance: number = 0;
  public owner: string;
}

const account = new BankAccount();
account.balance = -1000; // Invalid state! No validation!
account.owner = '';       // Empty owner — who allows this?
```

### Example: Proper Encapsulation

```typescript
// GOOD: Private state with controlled access
class BankAccount {
  private _balance: number;
  private readonly _owner: string;

  constructor(owner: string, initialBalance: number = 0) {
    if (!owner) throw new Error('Owner is required');
    if (initialBalance < 0) throw new Error('Initial balance cannot be negative');
    this._owner = owner;
    this._balance = initialBalance;
  }

  get balance(): number {
    return this._balance;
  }

  get owner(): string {
    return this._owner;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('Deposit amount must be positive');
    this._balance += amount;
  }

  withdraw(amount: number): void {
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    if (amount > this._balance) throw new Error('Insufficient funds');
    this._balance -= amount;
  }
}
```

### Python Example

```python
class Temperature:
    """Encapsulates temperature with conversion and validation."""

    def __init__(self, celsius: float):
        self.celsius = celsius  # Uses the setter

    @property
    def celsius(self) -> float:
        return self._celsius

    @celsius.setter
    def celsius(self, value: float):
        if value < -273.15:
            raise ValueError("Temperature below absolute zero is impossible")
        self._celsius = value

    @property
    def fahrenheit(self) -> float:
        return self._celsius * 9 / 5 + 32

    @property
    def kelvin(self) -> float:
        return self._celsius + 273.15


temp = Temperature(100)
print(temp.fahrenheit)  # 212.0
# temp.celsius = -300   # Raises ValueError!
```

### Java Example

```java
// GOOD: Immutable, encapsulated value object
public final class Money {
    private final BigDecimal amount;
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency) {
        if (amount == null) throw new IllegalArgumentException("Amount required");
        if (currency == null) throw new IllegalArgumentException("Currency required");
        this.amount = amount;
        this.currency = currency;
    }

    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("Cannot add different currencies");
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }

    public BigDecimal getAmount() { return amount; }
    public Currency getCurrency() { return currency; }
}
```

## Best Practices

1. **Make fields private by default.** Only expose what's truly needed. Start with the most restrictive access and open up as needed.

2. **Expose behavior, not data.** Instead of `getX()` + `getY()` + external calculation, provide `calculateDistance()` directly.

3. **Use immutable objects when possible.** Immutable objects are inherently encapsulated — their state can't change after creation.

4. **Validate in setters and constructors.** Every entry point to internal state should enforce invariants.

5. **Don't expose mutable collections.**
   ```java
   // BAD
   public List<Item> getItems() { return items; }
   // GOOD
   public List<Item> getItems() { return Collections.unmodifiableList(items); }
   ```

6. **Prefer "tell, don't ask."** Instead of getting data out and making decisions externally, tell the object to perform the action.

## Anti-patterns / Common Mistakes

### Anemic Domain Model
Classes with only getters and setters and no behavior. All logic lives in external "service" classes that reach into the object's state.

```java
// BAD: Anemic — just a data bag
class Order {
    private List<Item> items;
    public List<Item> getItems() { return items; }
    public void setItems(List<Item> items) { this.items = items; }
}

// All logic external:
class OrderService {
    double calculateTotal(Order order) {
        return order.getItems().stream().mapToDouble(Item::getPrice).sum();
    }
}

// GOOD: Rich domain model
class Order {
    private final List<Item> items = new ArrayList<>();

    public void addItem(Item item) {
        items.add(item);
    }

    public Money total() {
        return items.stream().map(Item::price).reduce(Money.ZERO, Money::add);
    }
}
```

### Getter/Setter for Everything
Automatically generating getters and setters (e.g., Lombok's `@Data`) defeats the purpose of encapsulation. Only add accessors that are genuinely needed.

### Public Fields in TypeScript/JavaScript
Using public class fields without access control because "it's just JavaScript." TypeScript's `private` and `readonly` exist for a reason.

## Real-world Examples

### Java's `String` Class
`java.lang.String` is immutable and fully encapsulated. You cannot modify the internal char array. All operations return new strings.

### React's `useState`
React's state hook encapsulates component state. You can't modify state directly — you must use the setter function, which triggers re-renders properly.

### Rust's Ownership System
Rust enforces encapsulation at the language level through ownership, borrowing, and visibility (`pub`). Fields are private by default with no getter/setter convention.

## Sources

- Parnas, D. (1972). "On the Criteria to be Used in Decomposing Systems into Modules." Communications of the ACM.
- Martin, R.C. (2008). *Clean Code*. Chapter 6: Objects and Data Structures.
- Evans, E. (2003). *Domain-Driven Design*. Addison-Wesley.
- [Essential Software Design Principles (design-gurus.io)](https://www.designgurus.io/blog/essential-software-design-principles-you-should-know-before-the-interview)
