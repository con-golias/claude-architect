# Cohesion

> **Domain:** Fundamentals > Clean Code > Classes and Objects
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Cohesion measures how closely related and focused the responsibilities of a single module (class/function/component) are. Coined by Larry Constantine in the 1960s and formalized in *Structured Design* (1979).

> "A module has high cohesion when all its elements work together toward a single, well-defined purpose."

High cohesion = good. Low cohesion = the class is doing too many unrelated things.

### Types of Cohesion (Best to Worst)

| Type | Description | Quality |
|------|-------------|---------|
| **Functional** | All elements contribute to a single task | Best |
| **Sequential** | Output of one element is input to the next | Good |
| **Communicational** | Elements operate on the same data | Acceptable |
| **Procedural** | Elements follow a specific execution order | Weak |
| **Temporal** | Elements are grouped by when they execute | Weak |
| **Logical** | Elements are grouped by category, not function | Bad |
| **Coincidental** | Elements are grouped arbitrarily | Worst |

## Why It Matters

High cohesion leads to: easier understanding (the class does one clear thing), better testability (focused behavior = focused tests), higher reusability, and lower coupling (naturally reduces unnecessary dependencies).

Low cohesion signals: the class should be split, methods belong elsewhere, or the design is poorly organized.

## How It Works

### LCOM Metric (Lack of Cohesion of Methods)

LCOM counts the number of method pairs that don't share instance variables minus those that do. A high LCOM value indicates low cohesion.

```typescript
// LOW COHESION (High LCOM) — methods use different subsets of data
class Employee {
  private name: string;
  private salary: number;
  private department: string;
  private reportsTo: string;

  formatName() { return this.name.toUpperCase(); }   // uses: name
  calculateTax() { return this.salary * 0.3; }       // uses: salary
  getDeptInfo() { return this.department; }           // uses: department
  getManager() { return this.reportsTo; }             // uses: reportsTo
  // No method uses more than 1 field — very low cohesion!
}

// HIGH COHESION — all methods work with the same data
class Money {
  constructor(private amount: number, private currency: string) {}

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  format(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency)
      throw new Error('Currency mismatch');
  }
  // Every method uses both amount AND currency — high cohesion
}
```

### Python Example

```python
# LOW COHESION: "Utils" classes are always low cohesion
class UserUtils:
    @staticmethod
    def validate_email(email): pass      # Validation concern
    @staticmethod
    def format_name(name): pass          # Formatting concern
    @staticmethod
    def calculate_age(birthdate): pass   # Calculation concern
    @staticmethod
    def send_notification(user): pass    # Notification concern

# HIGH COHESION: Each class has a focused purpose
class EmailValidator:
    def validate(self, email: str) -> bool: pass
    def normalize(self, email: str) -> str: pass
    def extract_domain(self, email: str) -> str: pass
```

## Best Practices

1. **Maximize cohesion** — every method should use most of the class's instance variables.
2. **When cohesion drops, split the class.** If a group of methods uses subset A of variables and another uses subset B, split into two classes.
3. **Avoid "Util" and "Helper" classes** — they're almost always coincidental cohesion.
4. **SRP enforces cohesion** — a single responsibility naturally leads to high cohesion.
5. **Measure with LCOM** tools — SonarQube and similar tools report LCOM metrics.

## Anti-patterns / Common Mistakes

- **God Class:** The ultimate low-cohesion class — everything in one place.
- **Utility Dumping Ground:** `StringUtils`, `MathHelper`, `CommonUtils` — grab bags of unrelated methods.
- **Mixed Abstraction Levels:** High-level business logic and low-level I/O in the same class.

## Sources

- Constantine, L. & Yourdon, E. (1979). *Structured Design*. Prentice-Hall.
- Martin, R.C. (2008). *Clean Code*. Chapter 10: Classes.
- Chidamber, S.R. & Kemerer, C.F. (1994). "A Metrics Suite for Object Oriented Design." IEEE TSE.
