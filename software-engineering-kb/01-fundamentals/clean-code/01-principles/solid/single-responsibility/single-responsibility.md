# Single Responsibility Principle (SRP)

> **Domain:** Fundamentals > Clean Code > Principles > SOLID
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Single Responsibility Principle (SRP) is the first of the five SOLID principles, formulated by Robert C. Martin (Uncle Bob). It states:

> "A class should have only one reason to change."

More precisely, SRP means that every module, class, or function should have **one and only one responsibility** — one job, one purpose, one axis of change. A "reason to change" corresponds to a stakeholder or actor whose requirements might evolve. If a class serves two different actors, changes for one actor risk breaking functionality for the other.

Robert C. Martin later refined the definition in his book *Clean Architecture* (2017):

> "A module should be responsible to one, and only one, actor."

SRP is not just about classes — it applies at every level: functions, modules, packages, and even microservices.

### Historical Context

- **1972:** David Parnas introduced the concept of "information hiding" and modular decomposition.
- **1988:** Robert C. Martin began formalizing object-oriented design principles.
- **2003:** SRP was formally named in *Agile Software Development: Principles, Patterns, and Practices*.
- The acronym SOLID was coined by Michael Feathers to describe the five principles collectively.

## Why It Matters

### Maintainability
When a class has a single responsibility, changes to one area of the system don't cascade into unrelated areas. This dramatically reduces the cost and risk of modification.

### Testability
Classes with a single focus are far easier to unit test. You don't need complex setup or mocking of unrelated dependencies.

### Readability
Smaller, focused classes are easier to understand. A developer can grasp the purpose of a class by reading its name alone.

### Reduced Merge Conflicts
In team environments, SRP reduces the chance that two developers modify the same file for different reasons.

### Real Statistics
- Studies at IBM found that modules with a single responsibility had **40-50% fewer defects** than those with mixed responsibilities.
- Google's internal studies show that smaller, focused classes lead to **faster code review cycles** and **fewer regression bugs**.

## How It Works

### The Core Rule
Ask yourself: **"What is the one thing this class/function does?"** If you can't answer in a single, short sentence without using "and" or "or," it likely has too many responsibilities.

### Identifying Violations

A class violates SRP when it:
- Has methods that serve different actors (e.g., UI logic and database logic)
- Changes for multiple reasons
- Has a name with "And," "Or," or "Manager" (often a red flag)
- Is growing continuously as new features are added

### Example: Violation

```typescript
// BAD: This class has THREE responsibilities
class Employee {
  calculatePay(): number {
    // Payroll calculation logic — serves the CFO
    return this.hoursWorked * this.hourlyRate;
  }

  saveToDatabase(): void {
    // Persistence logic — serves the DBA
    db.query(`INSERT INTO employees ...`);
  }

  generateReport(): string {
    // Reporting logic — serves the COO
    return `Employee: ${this.name}, Pay: ${this.calculatePay()}`;
  }
}
```

### Example: Fixed

```typescript
// GOOD: Each class has ONE responsibility
class PayCalculator {
  calculate(employee: Employee): number {
    return employee.hoursWorked * employee.hourlyRate;
  }
}

class EmployeeRepository {
  save(employee: Employee): void {
    db.query(`INSERT INTO employees ...`);
  }
}

class EmployeeReportGenerator {
  generate(employee: Employee): string {
    return `Employee: ${employee.name}`;
  }
}
```

### Python Example

```python
# BAD: Mixed responsibilities
class UserService:
    def authenticate(self, username, password):
        # Authentication logic
        user = self.db.find_user(username)
        return bcrypt.check(password, user.password_hash)

    def send_welcome_email(self, user):
        # Email logic
        smtp.send(to=user.email, subject="Welcome!")

    def generate_monthly_report(self):
        # Reporting logic
        users = self.db.get_all_users()
        return create_pdf(users)


# GOOD: Separated responsibilities
class AuthenticationService:
    def authenticate(self, username: str, password: str) -> bool:
        user = self.user_repository.find_by_username(username)
        return self.password_hasher.verify(password, user.password_hash)

class EmailService:
    def send_welcome_email(self, user: User) -> None:
        self.mailer.send(to=user.email, subject="Welcome!")

class UserReportService:
    def generate_monthly_report(self) -> Report:
        users = self.user_repository.get_all()
        return self.report_builder.build(users)
```

### Java Example

```java
// BAD: God class
public class OrderProcessor {
    public void validateOrder(Order order) { /* validation */ }
    public double calculateTotal(Order order) { /* pricing */ }
    public void saveOrder(Order order) { /* database */ }
    public void sendConfirmationEmail(Order order) { /* email */ }
    public String generateInvoicePdf(Order order) { /* PDF */ }
}

// GOOD: Separated
public class OrderValidator {
    public ValidationResult validate(Order order) { /* ... */ }
}

public class PricingService {
    public Money calculateTotal(Order order) { /* ... */ }
}

public class OrderRepository {
    public void save(Order order) { /* ... */ }
}

public class OrderNotificationService {
    public void sendConfirmation(Order order) { /* ... */ }
}
```

## Best Practices

1. **Name classes after their single responsibility.** If you struggle to name it without "Manager," "Handler," or "Processor," it probably does too much.

2. **Use the "newspaper metaphor."** A class should read like a newspaper article — the name is the headline, and the details follow logically.

3. **Apply SRP at the function level too.** Every function should do exactly one thing. If a function has sections separated by comments, each section is a candidate for extraction.

4. **Group by actor.** Organize code so that all changes requested by one stakeholder/actor are in the same module.

5. **Favor many small classes over few large ones.** A system with 100 small, focused classes is easier to navigate than one with 10 "god classes." Use good naming and package organization.

6. **Use facades for convenience.** If clients need a simplified interface to multiple classes, create a Facade rather than merging responsibilities back into one class.

7. **Watch for "reason to change" signals.** If a code review comment says "this also needs to change because of X," that's a sign of mixed responsibilities.

## Anti-patterns / Common Mistakes

### The God Class
A class that does everything — authentication, validation, persistence, notification, reporting. Often named `UserManager`, `AppController`, or `Utils`.

### Over-Splitting (Nano-classes)
Taking SRP to the extreme where every method becomes its own class, resulting in dozens of tiny classes with no cohesion. SRP doesn't mean "one method per class" — it means one **responsibility** (which may involve several related methods).

```typescript
// TOO FAR: This is over-engineering
class NameGetter {
  getName(user: User): string { return user.name; }
}
class NameSetter {
  setName(user: User, name: string): void { user.name = name; }
}
```

### Confusing SRP with SoC
Separation of Concerns is about separating different *concerns* (UI, business, data). SRP is about separating by *actors* (who requests the change). They're related but distinct.

### Ignoring SRP for "Simplicity"
"It's easier to have everything in one class" — this is only true for trivial applications. As complexity grows, violations become increasingly painful.

## Real-world Examples

### React Components
In modern React, SRP manifests as the "presentational vs. container" pattern (or custom hooks):
```tsx
// Responsibility: data fetching
function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => { fetchUsers().then(setUsers); }, []);
  return users;
}

// Responsibility: presentation
function UserList() {
  const users = useUsers();
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### Microservices Architecture
SRP at the system level is a driving principle behind microservices — each service owns one business capability (User Service, Payment Service, Notification Service).

### Linux Kernel
The Linux kernel follows SRP at the module level — device drivers, file systems, and networking are separate subsystems with clear boundaries.

## Sources

- Martin, R.C. (2003). *Agile Software Development: Principles, Patterns, and Practices*. Prentice Hall.
- Martin, R.C. (2008). *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall.
- Martin, R.C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall.
- [Summary of Clean Code by Robert C. Martin (GitHub Gist)](https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29)
- [Clean Code Book Summary (Bookey)](https://www.bookey.app/book/clean-code)
