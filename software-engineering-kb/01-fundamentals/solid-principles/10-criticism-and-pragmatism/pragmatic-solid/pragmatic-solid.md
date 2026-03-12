# SOLID Criticism and Pragmatism

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Domain         | Fundamentals > SOLID Principles > Criticism & Pragmatism   |
| Difficulty     | Advanced                                                   |
| Prerequisites  | SOLID Principles (all five), Production experience         |
| Last Updated   | 2026-03-07                                                 |

---

## What It Is

An honest assessment of SOLID's strengths, weaknesses, and proper application. SOLID is valuable but not dogma -- understanding when and how to apply it pragmatically is a senior engineering skill.

The SOLID principles have become a de facto standard in software engineering education and interviews. But their widespread adoption has also led to widespread misapplication. Teams apply SOLID mechanically without considering context, creating over-engineered systems that are harder to understand than the problems they were meant to solve.

This document examines the legitimate criticisms of SOLID, identifies the situations where SOLID helps and where it hurts, and presents a pragmatic middle ground that seasoned engineers use in practice.

---

## Common Criticisms

### "SOLID leads to over-engineering"

This is the most common and most valid criticism. When applied dogmatically, SOLID can transform simple code into an incomprehensible maze of abstractions.

**The archetypal example: A simple CRUD feature that became 47 classes.**

A team was asked to build a simple feature: users can create, read, update, and delete todo items. Applying every SOLID principle to the maximum, they produced this:

```
// Over-engineered: 47 files for a simple todo CRUD
src/
  todo/
    interfaces/
      ITodoRepository.ts
      ITodoService.ts
      ITodoValidator.ts
      ITodoMapper.ts
      ITodoFactory.ts
      ITodoNotifier.ts
      ITodoCacheService.ts
    implementations/
      TodoRepository.ts
      TodoService.ts
      TodoValidator.ts
      TodoMapper.ts
      TodoFactory.ts
      TodoNotifier.ts
      TodoCacheService.ts
    models/
      Todo.ts
      TodoDTO.ts
      CreateTodoRequest.ts
      UpdateTodoRequest.ts
      TodoResponse.ts
      TodoListResponse.ts
      TodoFilter.ts
    validators/
      CreateTodoValidator.ts
      UpdateTodoValidator.ts
      TodoIdValidator.ts
    mappers/
      TodoToResponseMapper.ts
      RequestToTodoMapper.ts
      TodoToDTOMapper.ts
    factories/
      TodoFactory.ts
      TodoResponseFactory.ts
    events/
      TodoCreatedEvent.ts
      TodoUpdatedEvent.ts
      TodoDeletedEvent.ts
    handlers/
      TodoCreatedHandler.ts
      TodoUpdatedHandler.ts
      TodoDeletedHandler.ts
    controllers/
      TodoController.ts
    middleware/
      TodoAuthMiddleware.ts
    config/
      TodoModule.ts
      TodoDIConfig.ts
```

**The pragmatic version: 2-3 files that do the same thing.**

```
// Pragmatic: 3 files for a simple todo CRUD
src/
  todo/
    todo.model.ts      // Entity, DTOs, validation
    todo.service.ts    // Business logic + repository calls
    todo.controller.ts // HTTP handling
```

```typescript
// todo.model.ts -- combines model, DTO, and basic validation
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface CreateTodoInput {
  title: string;
}

export function validateCreateTodo(input: CreateTodoInput): string[] {
  const errors: string[] = [];
  if (!input.title?.trim()) errors.push('Title is required');
  if (input.title?.length > 200) errors.push('Title too long');
  return errors;
}

// todo.service.ts -- handles business logic and data access
export class TodoService {
  constructor(private db: Database) {}

  async create(input: CreateTodoInput): Promise<Todo> {
    const errors = validateCreateTodo(input);
    if (errors.length) throw new ValidationError(errors);
    return this.db.todos.create({
      id: uuid(),
      title: input.title.trim(),
      completed: false,
      createdAt: new Date(),
    });
  }

  async getAll(): Promise<Todo[]> {
    return this.db.todos.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async update(id: string, data: Partial<Todo>): Promise<Todo> {
    return this.db.todos.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.db.todos.delete({ where: { id } });
  }
}

// todo.controller.ts -- HTTP layer
export function todoRoutes(app: Express, service: TodoService) {
  app.post('/todos', async (req, res) => {
    const todo = await service.create(req.body);
    res.status(201).json(todo);
  });
  app.get('/todos', async (req, res) => {
    const todos = await service.getAll();
    res.json(todos);
  });
  // ... update, delete routes
}
```

This pragmatic version is easier to understand, faster to modify, and sufficient until the todo feature grows in complexity.

**The lesson:** SOLID is a tool, not a goal. If applying a principle makes the code harder to work with, you have applied it wrong -- or applied it prematurely.

### "SOLID is vague and subjective"

The Single Responsibility Principle states that a class should have "one reason to change." But what constitutes "one reason"? Different developers will give different answers:

- Is user registration one responsibility, or is it three (validation, persistence, notification)?
- Is an API controller one responsibility (handle HTTP) or multiple (routing, parsing, validation, error handling)?
- Does "user management" constitute one reason to change, or is it actually five (authentication, authorization, profile management, notification preferences, data export)?

Robert C. Martin himself has acknowledged this ambiguity. In *Clean Architecture* (2017), he refined SRP to mean: "A module should be responsible to one, and only one, actor." An actor is a group of users or stakeholders who would request changes. This is more precise but still requires judgment.

**The reality:** SRP is a heuristic, not a metric. There is no SRP-o-meter. Experienced developers develop an intuition for when a class has too many responsibilities, and that intuition is informed by experience seeing what happens when responsibilities are mixed (fragile changes, merge conflicts, testing difficulty).

### "SOLID is OOP-centric"

SOLID was formulated in the context of object-oriented programming. The original papers discuss classes, interfaces, inheritance hierarchies, and virtual dispatch. But not all code is OOP:

- **Scripting code** (bash, Python scripts) is procedural and often short-lived.
- **Functional code** (Haskell, Elixir, Clojure) has no classes or inheritance.
- **Systems code** (C, Rust) prioritizes performance over abstraction.
- **Data pipelines** (SQL, dbt, Spark) are declarative, not imperative.

Applying class-level SOLID to a 50-line Python script that processes a CSV file is a category error. The script is better served by being simple, readable, and correct.

That said, the *underlying ideas* of SOLID (separation of concerns, extensibility, substitutability, minimal coupling, abstraction) apply to every paradigm. They just manifest differently -- see the companion document "SOLID Beyond OOP."

### "SOLID can hurt readability"

One of the most insidious costs of over-applied SOLID is the "Where does this actually happen?" problem. When behavior is distributed across many small classes, following the execution path requires jumping between many files:

```
// To understand what happens when a user registers:
// 1. UserController.register() --> calls UserService.register()
// 2. UserService.register() --> calls UserValidator.validate()
// 3. UserValidator.validate() --> calls EmailValidator.validate(), PasswordValidator.validate()
// 4. UserService.register() --> calls UserRepository.save()
// 5. UserRepository.save() --> calls DatabaseAdapter.execute()
// 6. UserService.register() --> calls EventPublisher.publish(UserCreatedEvent)
// 7. UserCreatedEventHandler.handle() --> calls WelcomeEmailSender.send()
// 8. WelcomeEmailSender.send() --> calls EmailTemplateRenderer.render()
// 9. EmailTemplateRenderer.render() --> calls TemplateEngine.compile()
// 10. WelcomeEmailSender.send() --> calls SmtpAdapter.send()
```

A developer new to this codebase must navigate 10 files to understand user registration. In a less SOLID codebase, this might be one file with 60 lines of code that is immediately understandable.

**The counterargument:** In a system with 200 features, those 10 files are each small, focused, testable, and independently modifiable. The up-front navigation cost is paid back in reduced maintenance cost. But in a system with 5 features, the navigation cost dominates.

---

## When NOT to Apply SOLID

### 1. Prototypes and MVPs

When you are validating a business idea, speed trumps architecture. The prototype will likely be thrown away. Spending time on abstractions that may never be used is waste.

```python
# Prototype: just make it work. Validate the idea first.
# Refactor toward SOLID only if the idea survives.

@app.post("/predict")
async def predict(image: UploadFile):
    img = Image.open(image.file)
    tensor = transform(img).unsqueeze(0)
    with torch.no_grad():
        output = model(tensor)
    prediction = labels[output.argmax().item()]
    # Save to DB right here -- no repository pattern needed for a prototype
    db.execute("INSERT INTO predictions (result, timestamp) VALUES (?, ?)",
               prediction, datetime.now())
    return {"prediction": prediction}
```

### 2. Small Scripts and Utilities

A 100-line script that runs once a week to generate a report does not need dependency injection, strategy patterns, or interface segregation.

### 3. Performance-Critical Inner Loops

Every abstraction -- interface dispatch, virtual method calls, heap allocation for closures -- has a cost. In tight inner loops processing millions of items per second, these costs matter.

```go
// In a hot loop processing 10M records, avoid interface dispatch.
// Use concrete types and inlining.

// Slow: interface dispatch prevents inlining
func processAll(items []Item, processor Processor) {
    for _, item := range items {
        processor.Process(item)  // virtual dispatch on every iteration
    }
}

// Fast: concrete type allows compiler optimization
func processAll(items []Item) {
    for i := range items {
        items[i].value = items[i].value * 2 + 1  // inlined, vectorizable
    }
}
```

### 4. One-Off Data Migrations

A migration script that runs once and is then deleted does not benefit from SOLID. Write it clearly, run it, verify it, archive it.

### 5. Very Small Teams (1-3 developers)

Many SOLID benefits are about enabling parallel development, reducing merge conflicts, and making code comprehensible to newcomers. In a team of two where both developers understand the entire codebase, the coordination overhead of SOLID may exceed its benefits.

---

## When to Apply SOLID

### 1. Long-Lived Production Systems

If your code will be in production for years and maintained by multiple generations of developers, SOLID pays enormous dividends. The cost of poor architecture compounds over time.

### 2. Large Teams (10+ developers)

SOLID enables parallel development. When interfaces are well-defined, teams can work on different implementations simultaneously without stepping on each other.

### 3. Complex Business Domains

When the business logic is inherently complex (financial calculations, healthcare workflows, logistics optimization), SOLID helps manage that complexity by ensuring each piece is isolated and testable.

### 4. Systems with Frequently Changing Requirements

If requirements change often (which they usually do), OCP and DIP help you add new features without breaking existing ones.

### 5. Code That Needs Thorough Testing

SOLID, especially DIP, is almost a prerequisite for unit testing. If you cannot inject mock dependencies, you cannot test in isolation.

```java
// Without DIP: impossible to test without a real database and real Stripe.
class OrderService {
    void createOrder(Request r) {
        new PostgresDB().save(new Order(r));      // Cannot mock
        new StripeGateway().charge(r.getTotal());  // Cannot mock
    }
}

// With DIP: fully testable with mocks.
class OrderService {
    private final OrderRepository repo;
    private final PaymentGateway gateway;

    OrderService(OrderRepository repo, PaymentGateway gateway) {
        this.repo = repo;
        this.gateway = gateway;
    }

    void createOrder(Request r) {
        repo.save(new Order(r));       // Mockable
        gateway.charge(r.getTotal());  // Mockable
    }
}
```

---

## The Pragmatic Middle Ground

Experienced engineers do not ask "Should I apply SOLID?" They ask "Which principles, applied to which parts of the code, will give the most benefit for the least cost?"

### Start Simple, Refactor Toward SOLID When Complexity Warrants It

Do not design your system for hypothetical future requirements. Start with the simplest implementation that works. When you feel pain (tests are hard to write, changes cause unexpected breakages, the class is growing unwieldy), refactor toward SOLID to address that specific pain.

```
// Day 1: Simple function. No abstractions.
function processPayment(order) {
  stripe.charge(order.total);
  db.save(order);
  sendEmail(order.customerEmail, 'Confirmed!');
}

// Month 3: Now we need PayPal too. Refactor toward OCP.
function processPayment(order, gateway) {
  gateway.charge(order.total);
  db.save(order);
  sendEmail(order.customerEmail, 'Confirmed!');
}

// Month 6: Now we need SMS notifications too. Refactor toward SRP.
function processPayment(order, gateway, notifier) {
  gateway.charge(order.total);
  db.save(order);
  notifier.notify(order, 'confirmed');
}
```

### Apply Principles at Boundaries

SOLID is most valuable at module boundaries, API surfaces, and integration points -- places where changes on one side should not cascade to the other.

```
// SOLID at the boundary between your code and external services:
interface PaymentGateway {           // Abstraction at boundary
  charge(amount: number): Promise<ChargeResult>;
}

// Inside the module, keep things simple:
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
// No interface needed for a pure calculation function.
```

### Use the "Rule of Three"

Do not abstract until you have three concrete examples. The first time you write something, just write it. The second time, notice the duplication but tolerate it. The third time, you have enough examples to create a meaningful abstraction.

```typescript
// First payment gateway: just write the code.
function chargeStripe(amount: number) { /* ... */ }

// Second payment gateway: notice the pattern, but don't abstract yet.
function chargePayPal(amount: number) { /* ... */ }

// Third payment gateway: NOW create the abstraction.
interface PaymentGateway {
  charge(amount: number): Promise<ChargeResult>;
}
// You have three concrete examples to guide the interface design.
```

### Let Code Smells Guide You

Apply SOLID to fix actual problems, not hypothetical ones. Code smells are your signal:

| Code Smell | SOLID Fix |
|-----------|-----------|
| Class has too many methods | SRP: Extract class |
| Adding a feature requires changing many files | OCP: Introduce extension point |
| Subclass throws NotImplementedException | LSP: Fix hierarchy or use ISP |
| Class depends on methods it does not call | ISP: Segregate interface |
| Tests require complex setup with real services | DIP: Inject dependencies |
| switch/if-else on type | OCP: Replace with polymorphism |
| Merge conflicts in the same file | SRP: Split into focused files |

---

## Alternative Principles and Frameworks

### CUPID (by Dan North, 2022)

Dan North, the creator of BDD (Behavior-Driven Development), proposed CUPID as an alternative to SOLID that he considers more actionable:

- **Composable** -- Code should be easy to use with other code. Small, focused components that plug together naturally.
- **Unix philosophy** -- Each component does one thing well. Communicate through simple, standard interfaces.
- **Predictable** -- Code does what it looks like it does. No hidden side effects, no surprises. Deterministic behavior.
- **Idiomatic** -- Code follows the conventions of its language and ecosystem. Go code should look like Go. Python code should look like Python.
- **Domain-based** -- Code reflects the business domain it serves. Names, structures, and boundaries mirror the real-world domain.

North argues that CUPID is more practical than SOLID because each property can be assessed independently and is less prone to dogmatic over-application.

### KISS, YAGNI, DRY

These complementary principles serve as a counterbalance to SOLID's tendency toward abstraction:

- **KISS** (Keep It Simple, Stupid) -- The simplest solution that works is usually the best. Complexity is a cost that must be justified.
- **YAGNI** (You Ain't Gonna Need It) -- Do not build features or abstractions for hypothetical future requirements. Build for today's needs.
- **DRY** (Don't Repeat Yourself) -- But applied wisely. Some duplication is preferable to the wrong abstraction.

```python
# YAGNI in action: Don't build what you don't need yet.

# BAD: Building a plugin system before anyone has requested plugins.
class PaymentProcessorFactory:
    _registry = {}
    @classmethod
    def register(cls, name, processor_cls):
        cls._registry[name] = processor_cls
    @classmethod
    def create(cls, name, **kwargs):
        return cls._registry[name](**kwargs)

# GOOD: Just use the one payment processor you actually need.
def process_payment(order):
    stripe.charge(order.total, order.currency)
```

### The Zen of Python

Python's design philosophy, articulated in PEP 20, offers wisdom applicable to any language:

> "Simple is better than complex."
> "Complex is better than complicated."
> "Flat is better than nested."
> "Readability counts."
> "If the implementation is hard to explain, it's a bad idea."

### Go Proverbs

Go's design philosophy, as articulated by Rob Pike, offers a different perspective:

> "A little copying is better than a little dependency."
> "Clear is better than clever."
> "Don't panic."
> "The bigger the interface, the weaker the abstraction."
> "Interface pollution is a design smell."

The Go proverb "A little copying is better than a little dependency" directly challenges DRY and can sometimes contradict DIP. When the cost of an abstraction (indirection, cognitive load, coupling to a shared library) exceeds the cost of duplicating a small piece of code, duplication is the pragmatic choice.

---

## The Evolution of SOLID

### 2000-2002: Original Formulation

Robert C. Martin published his original papers on design principles in the early 2000s, drawing on ideas from Bertrand Meyer (OCP, 1988), Barbara Liskov (LSP, 1987), and his own teaching experience. The principles were formulated specifically for object-oriented class design.

The original context was C++ and Java enterprise applications, where deep inheritance hierarchies and tight coupling were common problems. SOLID was a corrective to those specific problems of that era.

### 2004-2010: Mainstream Adoption

The acronym "SOLID" was coined by Michael Feathers. It gained widespread adoption through Martin's books (*Agile Software Development*, 2002; *Clean Code*, 2008) and became a standard part of software engineering education and interviews.

### 2010s: Extension to Modules and Microservices

As software architecture evolved from monoliths to microservices, engineers began applying SOLID at higher levels of abstraction:

- SRP became "a microservice should have one bounded context"
- OCP became "APIs should be backward-compatible and extensible"
- LSP became "service contract testing"
- ISP became "focused API endpoints" and "BFF pattern"
- DIP became "service mesh" and "message queues as abstractions"

### 2017: Martin's Own Refinement

In *Clean Architecture* (2017), Martin refined his understanding of the principles:

- **SRP** was clarified to mean "a module should be responsible to one, and only one, actor" (not "do one thing").
- **OCP** was clarified to be about protecting high-level policies from changes in low-level details.
- **DIP** was elevated as the most important principle, with Martin noting that the Dependency Rule (dependencies point inward toward high-level policy) is the foundation of clean architecture.

### 2020s: Functional Programming and Cloud-Native

Modern application of SOLID recognizes that:

- The principles apply to any paradigm, not just OOP.
- The mechanisms differ (higher-order functions vs. interfaces, algebraic data types vs. inheritance), but the goals are the same.
- Cloud-native patterns (serverless, event-driven, infrastructure-as-code) introduce new contexts where SOLID must be interpreted, not mechanically applied.
- The industry has matured past "always apply SOLID" to "apply SOLID where it reduces the total cost of ownership."

---

## Summary: The Pragmatic Engineer's Approach

1. **Learn the principles deeply** so you understand the problems they solve.
2. **Start simple** -- do not over-engineer from day one.
3. **Apply SOLID when you feel pain** -- difficult tests, fragile changes, growing complexity.
4. **Apply SOLID at boundaries** -- module edges, API surfaces, integration points.
5. **Let the Rule of Three guide abstraction** -- do not abstract prematurely.
6. **Balance SOLID with KISS and YAGNI** -- abstraction has a cost.
7. **Adapt to your context** -- team size, system lifespan, domain complexity, language idioms.
8. **Revisit your decisions** -- what was right six months ago may not be right today.

The best engineers do not follow SOLID religiously. They understand the principles deeply enough to know when applying them creates value and when it creates waste. That judgment, developed through experience, is the real skill.

---

## Sources

- Martin, R.C. (2002). *Agile Software Development, Principles, Patterns, and Practices*. Prentice Hall.
- Martin, R.C. (2008). *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall.
- Martin, R.C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall.
- North, D. (2022). "CUPID -- for joyful coding." dannorth.net. https://dannorth.net/2022/02/10/cupid-for-joyful-coding/
- Kaminski, T. (2014). "Deconstructing SOLID Design Principles." tedkaminski.com.
- Baeldung. "When to Avoid SOLID Principles." https://www.baeldung.com/solid-principles
- Pike, R. (2012). "Go Proverbs." https://go-proverbs.github.io/
- Peters, T. (2004). "PEP 20 -- The Zen of Python." python.org.
- Meyer, B. (1988). *Object-Oriented Software Construction*. Prentice Hall.
- Liskov, B. & Wing, J. (1994). "A Behavioral Notion of Subtyping." ACM TOPLAS.
- Feathers, M. (2004). *Working Effectively with Legacy Code*. Prentice Hall.
- Hacker News. Various discussions on SOLID criticism (2019-2025).
- Martin, R.C. (2018). "The Single Responsibility Principle." blog.cleancoder.com.
