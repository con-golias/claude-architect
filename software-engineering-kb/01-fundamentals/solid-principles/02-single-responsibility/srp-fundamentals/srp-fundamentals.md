# Single Responsibility Principle (SRP)

| **Domain**       | Fundamentals > SOLID Principles > Single Responsibility |
|------------------|---------------------------------------------------------|
| **Difficulty**   | Intermediate                                            |
| **Last Updated** | 2026-03-07                                              |

---

## What It Is

The Single Responsibility Principle (SRP) is the **S** in SOLID. Robert C. Martin originally defined it as:

> *"A class should have only one reason to change."*
> — Robert C. Martin, *Agile Software Development* (2002)

In his later work *Clean Architecture* (2017), Martin refined the definition to be more precise:

> *"A module should be responsible to one, and only one, actor."*
> — Robert C. Martin, *Clean Architecture* (2017)

### Why Two Formulations?

The original "one reason to change" formulation was frequently misinterpreted. Developers would ask: "What counts as a reason to change?" and arrive at different answers. Some took it to mean "a class should do only one thing," which led to an explosion of trivially small classes.

The refined formulation clarifies the intent. An **actor** is a stakeholder or a group of stakeholders (users, departments, roles) who would request changes to the module. The principle says that a given module should serve **exactly one such actor**. If two different actors (e.g., the CFO and the CTO) both have reasons to request changes to the same class, that class violates SRP because a change requested by one actor might inadvertently break functionality relied upon by the other.

**"Reason to change" = a single stakeholder/actor who would request changes.**

This is a critical distinction: SRP is not about the number of methods a class has, nor about the class doing "one thing." It is about **who** the class serves. A class with twenty methods can satisfy SRP if all twenty methods serve the same actor and change for the same reason.

---

## Why It Matters

| Benefit | Explanation |
|---------|-------------|
| **Reduced Merge Conflicts** | When different teams work on different features, SRP-compliant code ensures their changes land in different files. Two developers changing the same file for unrelated reasons is a symptom of SRP violation. |
| **Easier Testing** | A class with a single responsibility has a focused, predictable API. Tests are simpler to write and maintain. |
| **Simpler Debugging** | When a bug occurs in a narrowly-scoped module, the search space for the root cause is small. |
| **Better Team Organization** | SRP aligns code boundaries with organizational boundaries. The accounting team owns accounting logic; the shipping team owns shipping logic. This mirrors Conway's Law. |
| **Lower Cognitive Load** | Developers can understand a focused class faster than one that mixes concerns. This reduces onboarding time and speeds up code reviews. |
| **Independent Deployability** | When responsibilities are separated, modules can be versioned and deployed independently, a prerequisite for microservice architectures. |

---

## How It Works

### Example 1: User Management (TypeScript)

**BEFORE (SRP Violation):** A single class handles validation, persistence, and email notification.

```typescript
// VIOLATION: UserService is responsible to three different actors:
// - Product team (validation rules)
// - Database/infra team (persistence)
// - Marketing team (email templates and delivery)

class UserService {
  validate(user: User): boolean {
    if (!user.email.includes("@")) return false;
    if (user.name.length < 2) return false;
    if (user.password.length < 8) return false;
    return true;
  }

  save(user: User): void {
    const db = new DatabaseConnection("postgres://localhost:5432/app");
    db.query("INSERT INTO users (name, email, password) VALUES ($1, $2, $3)", [
      user.name,
      user.email,
      hashPassword(user.password),
    ]);
  }

  sendWelcomeEmail(user: User): void {
    const smtp = new SmtpClient("smtp.example.com", 587);
    smtp.send({
      to: user.email,
      subject: "Welcome!",
      body: `Hello ${user.name}, welcome to our platform!`,
    });
  }
}
```

**AFTER (SRP Applied):** Each class has one responsibility and serves one actor.

```typescript
// Responsible to: Product team (validation rules)
class UserValidator {
  validate(user: User): ValidationResult {
    const errors: string[] = [];
    if (!user.email.includes("@")) errors.push("Invalid email format");
    if (user.name.length < 2) errors.push("Name too short");
    if (user.password.length < 8) errors.push("Password too short");
    return { isValid: errors.length === 0, errors };
  }
}

// Responsible to: Infrastructure/DBA team (persistence strategy)
class UserRepository {
  constructor(private readonly db: Database) {}

  save(user: User): Promise<void> {
    return this.db.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
      [user.name, user.email, hashPassword(user.password)]
    );
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.query("SELECT * FROM users WHERE email = $1", [email]);
  }
}

// Responsible to: Marketing team (email content and delivery)
class EmailService {
  constructor(private readonly smtp: SmtpClient) {}

  sendWelcomeEmail(user: User): Promise<void> {
    return this.smtp.send({
      to: user.email,
      subject: "Welcome!",
      body: `Hello ${user.name}, welcome to our platform!`,
    });
  }
}

// Orchestrator — coordinates the workflow; its own single responsibility
// is the registration use case
class UserRegistrationUseCase {
  constructor(
    private validator: UserValidator,
    private repository: UserRepository,
    private emailService: EmailService
  ) {}

  async register(user: User): Promise<RegistrationResult> {
    const validation = this.validator.validate(user);
    if (!validation.isValid) return { success: false, errors: validation.errors };

    await this.repository.save(user);
    await this.emailService.sendWelcomeEmail(user);

    return { success: true, errors: [] };
  }
}
```

---

### Example 2: Report Generation (Python)

**BEFORE (SRP Violation):** A single class gathers data, formats it, and exports to multiple formats.

```python
# VIOLATION: ReportManager serves the data analyst (queries),
# the UI team (formatting), and the operations team (export/delivery).

class ReportManager:
    def gather_data(self, query: str) -> list[dict]:
        connection = psycopg2.connect("dbname=analytics")
        cursor = connection.cursor()
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def format_report(self, data: list[dict], title: str) -> str:
        header = f"=== {title} ===\n"
        rows = "\n".join(
            " | ".join(str(v) for v in row.values()) for row in data
        )
        return header + rows

    def export_to_pdf(self, formatted: str, path: str) -> None:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        for line in formatted.split("\n"):
            pdf.cell(200, 10, txt=line, ln=True)
        pdf.output(path)

    def export_to_csv(self, data: list[dict], path: str) -> None:
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
```

**AFTER (SRP Applied):**

```python
# Responsible to: Data analysts (query logic, data sourcing)
class DataGatherer:
    def __init__(self, connection: Connection):
        self._connection = connection

    def execute_query(self, query: str) -> list[dict]:
        cursor = self._connection.cursor()
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]


# Responsible to: UI/presentation team (formatting rules)
class ReportFormatter:
    def format_table(self, data: list[dict], title: str) -> str:
        header = f"=== {title} ===\n"
        if not data:
            return header + "(no data)"
        col_names = list(data[0].keys())
        rows = "\n".join(
            " | ".join(str(row.get(c, "")) for c in col_names)
            for row in data
        )
        return header + " | ".join(col_names) + "\n" + rows


# Responsible to: Operations team (delivery format and destination)
class ReportExporter:
    def to_pdf(self, formatted_text: str, path: str) -> None:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        for line in formatted_text.split("\n"):
            pdf.cell(200, 10, txt=line, ln=True)
        pdf.output(path)

    def to_csv(self, data: list[dict], path: str) -> None:
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
```

---

### Example 3: Employee Class (Java)

This is Robert Martin's canonical example from *Clean Architecture* (2017, Chapter 7).

**BEFORE (SRP Violation):** The `Employee` class serves three different actors.

```java
// VIOLATION: Three actors depend on this single class:
// - CFO (Chief Financial Officer) → calculatePay()
// - COO (Chief Operating Officer) → reportHours()
// - CTO (Chief Technology Officer) → save()

public class Employee {
    private String name;
    private double hourlyRate;
    private int hoursWorked;

    // Used by the CFO's team — payroll accounting
    public double calculatePay() {
        return hourlyRate * getRegularHours();
    }

    // Used by the COO's team — workforce management
    public int reportHours() {
        return getRegularHours();
    }

    // Used by the CTO's team — database infrastructure
    public void save() {
        Database db = Database.getInstance();
        db.save(this);
    }

    // Shared private method — if the CFO's team changes the definition
    // of "regular hours," it silently breaks the COO's reports!
    private int getRegularHours() {
        return Math.min(hoursWorked, 40);
    }
}
```

The danger: `calculatePay()` and `reportHours()` both call `getRegularHours()`. If the CFO's team requests a change to how regular hours are calculated for payroll purposes, that same change affects the COO's hour reports — a silent, unexpected side effect.

**AFTER (SRP Applied):**

```java
// Responsible to: CFO — payroll calculation
public class PayCalculator {
    public double calculatePay(Employee employee) {
        int regularHours = Math.min(employee.getHoursWorked(), 40);
        int overtimeHours = Math.max(employee.getHoursWorked() - 40, 0);
        return (regularHours * employee.getHourlyRate())
             + (overtimeHours * employee.getHourlyRate() * 1.5);
    }
}

// Responsible to: COO — workforce hour reporting
public class HourReporter {
    public HourReport reportHours(Employee employee) {
        int regularHours = Math.min(employee.getHoursWorked(), 40);
        int overtimeHours = Math.max(employee.getHoursWorked() - 40, 0);
        return new HourReport(employee.getName(), regularHours, overtimeHours);
    }
}

// Responsible to: CTO — persistence infrastructure
public class EmployeeRepository {
    private final Database database;

    public EmployeeRepository(Database database) {
        this.database = database;
    }

    public void save(Employee employee) {
        database.save(employee);
    }

    public Employee findById(long id) {
        return database.findById(Employee.class, id);
    }
}

// Employee is now a simple data structure (no business logic)
public class Employee {
    private final String name;
    private final double hourlyRate;
    private final int hoursWorked;

    public Employee(String name, double hourlyRate, int hoursWorked) {
        this.name = name;
        this.hourlyRate = hourlyRate;
        this.hoursWorked = hoursWorked;
    }

    public String getName() { return name; }
    public double getHourlyRate() { return hourlyRate; }
    public int getHoursWorked() { return hoursWorked; }
}
```

Now, a change requested by the CFO to payroll calculation affects only `PayCalculator`, and the COO's `HourReporter` remains untouched.

---

### Example 4: Go Module-Level SRP

In Go, SRP is idiomatically applied at the **package** level. Each package has a single, clear purpose.

```go
// package http — responsible for HTTP transport concerns
// file: internal/http/user_handler.go
package http

import "myapp/internal/domain"

type UserHandler struct {
    service domain.UserService
}

func (h *UserHandler) HandleCreateUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }
    user, err := h.service.CreateUser(r.Context(), req.Name, req.Email)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    json.NewEncoder(w).Encode(user)
}
```

```go
// package storage — responsible for persistence
// file: internal/storage/user_repo.go
package storage

import "myapp/internal/domain"

type PostgresUserRepo struct {
    db *sql.DB
}

func (r *PostgresUserRepo) Save(ctx context.Context, user domain.User) error {
    _, err := r.db.ExecContext(ctx,
        "INSERT INTO users (id, name, email) VALUES ($1, $2, $3)",
        user.ID, user.Name, user.Email,
    )
    return err
}
```

```go
// package notification — responsible for external notifications
// file: internal/notification/email.go
package notification

type EmailNotifier struct {
    smtpClient SmtpClient
}

func (n *EmailNotifier) SendWelcome(ctx context.Context, email, name string) error {
    return n.smtpClient.Send(email, "Welcome!", "Hello "+name)
}
```

Each package changes for a different reason: `http` changes when API contracts change, `storage` changes when the database schema changes, `notification` changes when email templates or delivery providers change.

---

### Example 5: React Component SRP

**BEFORE (SRP Violation):** A single component fetches data, manages complex form state, validates input, and renders UI.

```tsx
// VIOLATION: This component is responsible for data fetching, validation,
// state management, and presentation — four distinct concerns.

function UserProfilePage({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
        setFormData({ name: data.name, email: data.email });
        setLoading(false);
      });
  }, [userId]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (formData.name.length < 2) newErrors.name = "Name too short";
    if (!formData.email.includes("@")) newErrors.email = "Invalid email";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
  };

  if (loading) return <Spinner />;

  return (
    <form onSubmit={handleSubmit}>
      <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
      {errors.name && <span className="error">{errors.name}</span>}
      <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
      {errors.email && <span className="error">{errors.email}</span>}
      <button type="submit">Save</button>
    </form>
  );
}
```

**AFTER (SRP Applied):**

```tsx
// Custom hook — responsible for data fetching (infrastructure concern)
function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => { setUser(data); setLoading(false); });
  }, [userId]);

  const updateUser = async (data: Partial<User>) => {
    await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  return { user, loading, updateUser };
}

// Validation utility — responsible for business rules (domain concern)
function validateUserProfile(data: { name: string; email: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.name.length < 2) errors.name = "Name must be at least 2 characters";
  if (!data.email.includes("@")) errors.email = "Please enter a valid email";
  return errors;
}

// Presentational component — responsible only for rendering
function UserProfileForm({
  formData,
  errors,
  onChange,
  onSubmit,
}: UserProfileFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <FormField label="Name" value={formData.name} error={errors.name}
        onChange={(val) => onChange({ ...formData, name: val })} />
      <FormField label="Email" value={formData.email} error={errors.email}
        onChange={(val) => onChange({ ...formData, email: val })} />
      <button type="submit">Save</button>
    </form>
  );
}

// Container component — orchestrates the use case
function UserProfilePage({ userId }: { userId: string }) {
  const { user, loading, updateUser } = useUser(userId);
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) setFormData({ name: user.name, email: user.email });
  }, [user]);

  const handleSubmit = () => {
    const validationErrors = validateUserProfile(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) updateUser(formData);
  };

  if (loading) return <Spinner />;
  return <UserProfileForm formData={formData} errors={errors} onChange={setFormData} onSubmit={handleSubmit} />;
}
```

---

## Identifying SRP Violations

Use this checklist to detect SRP violations during code reviews or refactoring:

| # | Indicator | Why It Suggests a Violation |
|---|-----------|----------------------------|
| 1 | **Class has more than 10-15 public methods** | Large public APIs often mean the class serves multiple actors. |
| 2 | **Methods that do not use the same instance variables** | If half the methods use `this.db` and the other half use `this.smtpClient`, the class has at least two responsibilities. |
| 3 | **"And" in the class description** | "This class validates AND saves AND notifies" — each "and" suggests a separate responsibility. |
| 4 | **Different stakeholders would change different parts** | If the DBA wants to change `save()` and the marketing team wants to change `sendEmail()`, the class serves two actors. |
| 5 | **High coupling between unrelated concerns** | If changing the email template requires recompiling the database access code, responsibilities are improperly coupled. |
| 6 | **Tests require mocking many unrelated dependencies** | A test for validation logic should not need to mock a database connection. If it does, responsibilities are mixed. |
| 7 | **The class is frequently involved in merge conflicts** | Multiple team members editing the same file for unrelated features is a classic SRP smell. |
| 8 | **Importing many unrelated modules** | A single class importing database, email, PDF, HTTP, and caching libraries is a strong SRP violation signal. |

---

## The Axis of Change

A common misunderstanding of SRP is that it means "a class should do only one thing" or "a class should have only one method." This is incorrect.

Martin's concept of the **axis of change** clarifies: SRP is about grouping together the things that change for the same reason (i.e., at the request of the same actor) and separating the things that change for different reasons.

A `UserRepository` class might have ten methods — `save()`, `findById()`, `findByEmail()`, `delete()`, `update()`, `findAll()`, `count()`, `exists()`, `findByRole()`, `search()` — and still perfectly satisfy SRP. All ten methods exist to serve a single responsibility: persisting and retrieving users from a data store. They all change when the persistence strategy changes, and they all serve the same actor (the infrastructure/DBA team).

Conversely, a class with only two methods can violate SRP if those two methods serve different actors:

```java
// VIOLATION despite having only two methods!
class Employee {
    // Serves the CFO's team
    public double calculatePay() { ... }
    // Serves the CTO's team
    public void save() { ... }
}
```

**The axis of change is about who requests the change, not how many things the class does.**

---

## Common Mistakes

### 1. Over-Applying SRP (Fragmentation)

Creating hundreds of tiny classes, each with a single method, makes the codebase harder to navigate and understand. This is sometimes called "ravioli code" (the opposite of "spaghetti code"). Every class introduces a level of indirection, and too much indirection obscures the system's behavior.

**Rule of thumb:** If you cannot describe the class's responsibility in a single sentence without using "and" or "or," it may need splitting. But if you can, do not split it further.

### 2. Confusing SRP with "Single Method"

A class can have many methods and still adhere to SRP. What matters is that all methods serve the same actor and change for the same reason.

### 3. Ignoring Cohesion

SRP is ultimately about **cohesion** — keeping related things together. Over-splitting can *reduce* cohesion by scattering related logic across too many files. Related methods that always change together should stay together.

### 4. Applying SRP Prematurely

Before the axes of change are clear, splitting classes preemptively can lead to wrong abstractions. It is often better to wait until a second reason to change actually appears, then refactor. Martin Fowler's advice: *"The first time you do something, just do it. The second time you do something similar, wince at the duplication but do it anyway. The third time, refactor."* (Rule of Three)

---

## Relationship to Other Principles

| Related Principle | Relationship to SRP |
|-------------------|---------------------|
| **ISP (Interface Segregation)** | ISP is essentially SRP applied to interfaces. Just as SRP says a class should serve one actor, ISP says an interface should serve one client. Both are about **cohesion**. |
| **OCP (Open/Closed)** | SRP enables OCP. Smaller, focused classes are easier to extend without modification. A class with many responsibilities is hard to close against all axes of change because any change is a potential modification. |
| **DIP (Dependency Inversion)** | SRP produces focused modules that are natural candidates for abstraction behind interfaces, which DIP then inverts. SRP gives you the right granularity for DIP. |
| **LSP (Liskov Substitution)** | When SRP is followed, class hierarchies tend to be simpler and more focused, reducing the likelihood of LSP violations caused by a subclass inheriting responsibilities it cannot fulfill. |

---

## SRP at Different Scales

SRP applies not just at the class level but at every level of software architecture:

| Scale | Application |
|-------|------------|
| **Function/Method** | A function should do one thing. If a function's body naturally divides into sections (e.g., validate, process, format), each section is a candidate for extraction. |
| **Class/Module** | A class should serve one actor. This is the canonical formulation of SRP. |
| **Package/Namespace** | A package should group classes that change for the same reason. Go's standard library is an excellent example: `net/http`, `encoding/json`, `database/sql`. |
| **Service/Microservice** | A microservice should own one bounded context. The Single Responsibility Principle at the service level aligns with Domain-Driven Design's bounded contexts. |
| **Team** | Conway's Law states that system structure mirrors organizational structure. SRP at the team level means each team owns a coherent set of responsibilities. |

---

## Sources

1. **Martin, R.C.** (2002). *Agile Software Development: Principles, Patterns, and Practices.* Prentice Hall. — Original book-length treatment of SRP with the "one reason to change" definition.
2. **Martin, R.C.** (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design.* Prentice Hall, Chapter 7. — Refined SRP definition using "actors" and the Employee canonical example.
3. **Martin, R.C.** (2008). *Clean Code: A Handbook of Agile Software Craftsmanship.* Prentice Hall. — Practical application of SRP at the function and class level.
4. **Martin, R.C.** (2000). *"Design Principles and Design Patterns."* objectmentor.com. — Original paper positioning SRP within the broader SOLID framework.
5. **Fowler, M.** (1999, 2018). *Refactoring: Improving the Design of Existing Code.* Addison-Wesley. — Refactoring techniques (Extract Class, Move Method) that enforce SRP.
6. **DigitalOcean.** *"SOLID: The First 5 Principles of Object Oriented Design."* https://www.digitalocean.com/community/conceptual-articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design — Accessible tutorial with practical examples.
7. **Wikipedia.** *"Single-responsibility principle."* https://en.wikipedia.org/wiki/Single-responsibility_principle — Community overview with references to original sources.
8. **Conway, M.E.** (1968). *"How Do Committees Invent?"* Datamation. — The foundational paper on Conway's Law, which relates organizational structure to system architecture.
