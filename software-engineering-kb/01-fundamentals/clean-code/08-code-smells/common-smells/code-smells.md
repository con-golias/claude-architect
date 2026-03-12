# Code Smells

> **Domain:** Fundamentals > Clean Code > Code Smells
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A code smell is a **surface indication that usually corresponds to a deeper problem in the system**. The term was coined by Kent Beck while helping Martin Fowler write *Refactoring* (1999).

> "A code smell is a hint that something has gone wrong somewhere in your code." — Martin Fowler

Code smells are **not bugs** — the code works. But they indicate design weaknesses that increase the risk of bugs, slow development, and make the codebase harder to maintain.

## Why It Matters

Code smells compound over time. One long method is manageable. A system full of long methods, god classes, and duplicated code becomes unmaintainable. Studies show that files with code smells have **50-100% more bugs** than clean files.

## How It Works

### Category 1: Bloaters

**Long Method (>20 lines):** The most common smell. A function that does too many things.

**Large Class (>200 lines):** A class with too many responsibilities.

**Primitive Obsession:** Using primitives instead of small objects: `string` for email, `number` for money, `string` for phone number.

```typescript
// BAD: Primitive obsession
function createOrder(customerEmail: string, totalCents: number, currency: string) {}

// GOOD: Value objects
function createOrder(customer: Email, total: Money) {}
```

**Long Parameter List (>3 params):** Too many parameters indicate a function does too much or needs an object.

**Data Clumps:** Groups of data that always appear together should be a class.
```python
# BAD: Data clump — these three always travel together
def create_address(street, city, zip_code): pass
def validate_address(street, city, zip_code): pass

# GOOD: Group into a class
class Address:
    def __init__(self, street: str, city: str, zip_code: str): ...
```

### Category 2: Object-Orientation Abusers

**Switch Statements:** Often indicate missing polymorphism (OCP violation).

**Refused Bequest:** A subclass inherits methods it doesn't want or use.

**Temporary Field:** Fields that are only set in certain circumstances.

### Category 3: Change Preventers

**Divergent Change:** One class is changed for many different reasons (SRP violation).

**Shotgun Surgery:** One change requires modifications to many classes.

**Parallel Inheritance Hierarchies:** Every time you add a subclass to one hierarchy, you must add one to another.

### Category 4: Dispensables

**Duplicate Code:** The #1 smell. Same structure in multiple places.

**Dead Code:** Code that's never executed. Delete it — Git remembers.

**Lazy Class:** A class that doesn't do enough to justify its existence.

**Speculative Generality:** Abstractions created "just in case" that serve no current purpose.

**Data Class:** A class with only fields and getters/setters — no behavior.

### Category 5: Couplers

**Feature Envy:** A method uses more features of another class than its own.

**Inappropriate Intimacy:** Two classes are too intertwined, accessing each other's private details.

**Message Chains:** `a.getB().getC().getD().getE()` — Law of Demeter violation.

**Middle Man:** A class that does nothing but delegate to another class.

## Best Practices

1. **Learn to recognize smells.** Read the catalog, practice identifying them in code reviews.
2. **Smell → Refactor.** Each smell has corresponding refactoring techniques.
3. **Use tools.** SonarQube, CodeClimate, and ESLint can detect many smells automatically.
4. **Address smells incrementally** (Boy Scout Rule), not in massive refactoring sprints.
5. **Focus on the worst smells first.** Duplicate code and god classes have the highest impact.

## Sources

- Fowler, M. (2018). *Refactoring* (2nd ed.). Chapter 3: Bad Smells in Code.
- Martin, R.C. (2008). *Clean Code*. Chapter 17: Smells and Heuristics.
- [Code Smells Catalog (luzkan.github.io)](https://luzkan.github.io/smells/)
- [Refactoring Guru — Code Smells](https://refactoring.guru/refactoring/smells)
