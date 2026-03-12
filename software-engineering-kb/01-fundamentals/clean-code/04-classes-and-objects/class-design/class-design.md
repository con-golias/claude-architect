# Class Design

> **Domain:** Fundamentals > Clean Code > Classes and Objects
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Clean class design is about creating classes that are small, focused, and well-organized. Robert C. Martin's *Clean Code* Chapter 10 establishes the rules:

> "The first rule of classes is that they should be small. The second rule is that they should be smaller than that."

But unlike functions (measured in lines), class size is measured in **responsibilities**. A class should have one and only one reason to change (SRP).

### Data Structures vs. Objects

Martin draws a critical distinction in Chapter 6:
- **Objects** hide their data and expose behavior through methods. They protect invariants.
- **Data Structures** expose their data and have no significant behavior. They're transparent containers.

These are fundamentally different and should not be mixed. An object with public fields and getters/setters for everything is an anemic domain model — the worst of both worlds.

## Why It Matters

Well-designed classes are the building blocks of maintainable systems. They enable SOLID principles, make testing straightforward, reduce cognitive load, and allow independent development by team members.

## How It Works

### Class Organization (Convention)

```java
// Standard class organization (Java/C#/TypeScript)
public class Order {
    // 1. Constants
    private static final int MAX_ITEMS = 100;

    // 2. Static fields
    private static int orderCount = 0;

    // 3. Instance fields (private)
    private final String id;
    private final Customer customer;
    private final List<LineItem> items;
    private OrderStatus status;

    // 4. Constructors
    public Order(Customer customer) {
        this.id = generateId();
        this.customer = customer;
        this.items = new ArrayList<>();
        this.status = OrderStatus.DRAFT;
    }

    // 5. Public methods (behavior)
    public void addItem(Product product, int quantity) {
        if (items.size() >= MAX_ITEMS) throw new OrderLimitException();
        items.add(new LineItem(product, quantity));
    }

    public Money total() {
        return items.stream().map(LineItem::subtotal).reduce(Money.ZERO, Money::add);
    }

    // 6. Private methods (implementation details)
    private String generateId() {
        return "ORD-" + (++orderCount);
    }
}
```

### Tell, Don't Ask

```typescript
// BAD: Asking for data and making external decisions
if (account.getBalance() > amount && account.getStatus() === 'active') {
  account.setBalance(account.getBalance() - amount);
}

// GOOD: Tell the object what to do
account.withdraw(amount);
// The Account class internally validates and updates
```

### Cohesion

A class has **high cohesion** when its methods and fields work together toward a single purpose. Every method should use most of the class's instance variables.

```typescript
// LOW COHESION: Methods use different subsets of fields
class Employee {
  name: string;
  email: string;
  salary: number;
  department: string;

  getContactInfo() { return `${this.name}: ${this.email}`; } // uses name, email
  calculateBonus() { return this.salary * 0.1; }              // uses salary only
  getDepartmentReport() { return `${this.department} report`; } // uses department only
}

// HIGH COHESION: Split into focused classes
class EmployeeContact {
  constructor(private name: string, private email: string) {}
  getContactInfo() { return `${this.name}: ${this.email}`; }
}

class EmployeeCompensation {
  constructor(private salary: number) {}
  calculateBonus() { return this.salary * 0.1; }
}
```

## Best Practices

1. **Classes should be small** — measured by responsibilities, not lines.
2. **High cohesion** — all methods should be closely related and use most instance variables.
3. **Organize by convention** — constants → fields → constructors → public methods → private methods.
4. **Prefer rich domain models** over anemic data bags with external service classes.
5. **Use immutable classes** when possible — especially value objects.
6. **Hide implementation details** — expose behavior, not internal state.

## Anti-patterns / Common Mistakes

- **God Class:** Does everything — authentication, validation, persistence, notification.
- **Anemic Domain Model:** Classes with only getters/setters and no behavior.
- **Feature Envy:** A method that uses more fields from another class than its own.
- **Data Class:** A class that is nothing but fields and accessors.

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapters 6 and 10.
- Evans, E. (2003). *Domain-Driven Design*. Rich domain models.
- Fowler, M. (2003). "AnemicDomainModel." (Blog post)
