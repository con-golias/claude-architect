# Encapsulation

> **Domain:** Fundamentals > Programming Paradigms > Object-Oriented
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

Encapsulation is the practice of **bundling data and the methods that operate on that data into a single unit (class/object)**, while restricting direct access to internal state. External code interacts only through a controlled public interface. This protects invariants, reduces coupling, and allows internal implementation to change without breaking consumers.

## How It Works

```typescript
// TypeScript — access modifiers
class Temperature {
  private celsius: number;  // only accessible inside this class

  constructor(celsius: number) {
    this.setCelsius(celsius);
  }

  // Public interface — controlled access
  getCelsius(): number { return this.celsius; }
  getFahrenheit(): number { return this.celsius * 9/5 + 32; }

  setCelsius(value: number): void {
    if (value < -273.15) throw new Error("Below absolute zero");
    this.celsius = value;
  }

  setFahrenheit(value: number): void {
    this.setCelsius((value - 32) * 5/9);  // validates via setCelsius
  }
}

// External code cannot break invariants
const temp = new Temperature(100);
temp.getFahrenheit();    // 212
// temp.celsius = -500;  // Compile error: 'celsius' is private
temp.setCelsius(-500);   // Runtime error: "Below absolute zero"
```

```java
// Java — classic encapsulation with access modifiers
public class UserAccount {
    private String email;           // private — class only
    private String passwordHash;    // private — never exposed
    protected int loginAttempts;    // protected — subclasses only
    public final String id;         // public — everyone

    public UserAccount(String id, String email, String password) {
        this.id = id;
        setEmail(email);
        this.passwordHash = hashPassword(password);
    }

    public String getEmail() { return email; }

    public void setEmail(String email) {
        if (!email.contains("@")) throw new IllegalArgumentException("Invalid email");
        this.email = email.toLowerCase();
    }

    public boolean authenticate(String password) {
        if (loginAttempts >= 5) throw new AccountLockedException();
        boolean valid = hashPassword(password).equals(passwordHash);
        loginAttempts = valid ? 0 : loginAttempts + 1;
        return valid;
    }

    // Private helper — implementation detail
    private String hashPassword(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt());
    }
}
```

```python
# Python — convention-based encapsulation
class Inventory:
    def __init__(self):
        self._items: dict[str, int] = {}   # protected by convention (_)
        self.__audit_log: list = []         # name-mangled (__)

    def add_item(self, sku: str, quantity: int) -> None:
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        self._items[sku] = self._items.get(sku, 0) + quantity
        self.__audit_log.append(("add", sku, quantity))

    def remove_item(self, sku: str, quantity: int) -> None:
        current = self._items.get(sku, 0)
        if quantity > current:
            raise ValueError(f"Only {current} units of {sku} available")
        self._items[sku] = current - quantity
        self.__audit_log.append(("remove", sku, quantity))

    @property
    def total_items(self) -> int:
        return sum(self._items.values())

    def get_stock(self, sku: str) -> int:
        return self._items.get(sku, 0)

# Python access modifiers are conventions, not enforced:
# _name     → protected (don't touch from outside)
# __name    → name-mangled to _ClassName__name (harder to access)
# name      → public
```

### Access Modifier Comparison

```
Modifier     | Java       | TypeScript  | Python        | C++
─────────────────────────────────────────────────────────────────
public       | public     | public      | name          | public:
protected    | protected  | protected   | _name         | protected:
package      | (default)  | —           | —             | —
private      | private    | private     | __name        | private:
Enforcement  | Compiler   | Compiler    | Convention    | Compiler
```

## Anti-patterns

```
Anemic Domain Model:     All data public, all logic in separate "service" classes
                         → Objects are just data bags, not true encapsulation

Excessive Getters:       Every field has get/set → effectively public
                         → Ask "does the caller really need this data?"

Leaking References:      getItems() returns internal mutable collection
                         → Return copies or unmodifiable views instead
```

## Sources

- Meyer, B. (1997). *Object-Oriented Software Construction*. 2nd ed. Prentice Hall. Chapter 3.
- Bloch, J. (2018). *Effective Java*. 3rd ed. Addison-Wesley. Items 15-16.
