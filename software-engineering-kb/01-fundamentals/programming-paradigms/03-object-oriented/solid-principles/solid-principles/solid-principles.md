# SOLID Principles

> **Domain:** Fundamentals > Programming Paradigms > Object-Oriented
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

SOLID is a set of five design principles for writing **maintainable, extensible, and robust** object-oriented software. Coined by Robert C. Martin (Uncle Bob) and named by Michael Feathers, these principles guide developers toward code that is easy to understand, change, and test.

## The Five Principles

### S — Single Responsibility Principle (SRP)

**"A class should have only one reason to change."**

```typescript
// BAD — UserService does too many things
class UserService {
  createUser(data: UserData): User { /* ... */ }
  sendWelcomeEmail(user: User): void { /* ... */ }
  generatePDFReport(users: User[]): Buffer { /* ... */ }
  logActivity(action: string): void { /* ... */ }
}

// GOOD — each class has one responsibility
class UserService {
  constructor(private repo: UserRepository) {}
  createUser(data: UserData): User { return this.repo.save(data); }
}

class EmailService {
  sendWelcomeEmail(user: User): void { /* ... */ }
}

class ReportGenerator {
  generatePDF(users: User[]): Buffer { /* ... */ }
}
```

### O — Open/Closed Principle (OCP)

**"Open for extension, closed for modification."**

```typescript
// BAD — must modify this function for every new shape
function calculateArea(shape: any): number {
  if (shape.type === "circle") return Math.PI * shape.radius ** 2;
  if (shape.type === "rectangle") return shape.width * shape.height;
  // Adding triangle requires modifying this function
}

// GOOD — extend via new classes, never modify existing code
interface Shape {
  area(): number;
}

class Circle implements Shape {
  constructor(private radius: number) {}
  area() { return Math.PI * this.radius ** 2; }
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area() { return this.width * this.height; }
}

// Adding Triangle — just add a new class, no existing code changes
class Triangle implements Shape {
  constructor(private base: number, private height: number) {}
  area() { return 0.5 * this.base * this.height; }
}

function totalArea(shapes: Shape[]): number {
  return shapes.reduce((sum, s) => sum + s.area(), 0);
}
```

### L — Liskov Substitution Principle (LSP)

**"Subtypes must be substitutable for their base types."**

```typescript
// BAD — Square breaks Rectangle's contract
class Rectangle {
  constructor(protected width: number, protected height: number) {}
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  area() { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number) { this.width = w; this.height = w; }   // surprise!
  setHeight(h: number) { this.width = h; this.height = h; }  // surprise!
}

// This test FAILS with Square:
function testRectangle(r: Rectangle) {
  r.setWidth(5);
  r.setHeight(4);
  assert(r.area() === 20);  // Square gives 16!
}

// GOOD — separate types, no misleading inheritance
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(readonly width: number, readonly height: number) {}
  area() { return this.width * this.height; }
}

class Square implements Shape {
  constructor(readonly side: number) {}
  area() { return this.side ** 2; }
}
```

### I — Interface Segregation Principle (ISP)

**"No client should be forced to depend on methods it doesn't use."**

```typescript
// BAD — fat interface forces unnecessary implementations
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  attendMeeting(): void;
}

class Robot implements Worker {
  work() { /* ... */ }
  eat() { throw new Error("Robots don't eat"); }       // forced stub
  sleep() { throw new Error("Robots don't sleep"); }    // forced stub
  attendMeeting() { throw new Error("No meetings"); }   // forced stub
}

// GOOD — small, focused interfaces
interface Workable   { work(): void; }
interface Feedable   { eat(): void; }
interface Sleepable  { sleep(): void; }
interface Meetable   { attendMeeting(): void; }

class Human implements Workable, Feedable, Sleepable, Meetable {
  work() { /* ... */ }
  eat() { /* ... */ }
  sleep() { /* ... */ }
  attendMeeting() { /* ... */ }
}

class Robot implements Workable {
  work() { /* ... */ }
  // No need to implement eat, sleep, or attendMeeting
}
```

### D — Dependency Inversion Principle (DIP)

**"Depend on abstractions, not concretions."**

```typescript
// BAD — high-level module depends on low-level detail
class OrderService {
  private db = new MySQLDatabase();     // concrete dependency
  private mailer = new SendGrid();      // concrete dependency

  createOrder(data: OrderData) {
    this.db.insert("orders", data);
    this.mailer.send(data.email, "Order confirmed");
  }
}

// GOOD — depend on abstractions (interfaces)
interface Database {
  insert(table: string, data: any): Promise<void>;
}

interface Mailer {
  send(to: string, message: string): Promise<void>;
}

class OrderService {
  constructor(
    private db: Database,     // depends on interface
    private mailer: Mailer    // depends on interface
  ) {}

  async createOrder(data: OrderData) {
    await this.db.insert("orders", data);
    await this.mailer.send(data.email, "Order confirmed");
  }
}

// Inject any implementation — MySQL, Postgres, InMemory for tests
const service = new OrderService(new PostgresDB(), new SendGrid());
const testService = new OrderService(new InMemoryDB(), new FakeMailer());
```

## SOLID Summary

```
Principle        One-liner                           Key Benefit
──────────────────────────────────────────────────────────────────
SRP              One reason to change                Maintainability
OCP              Extend, don't modify                Extensibility
LSP              Subtypes are substitutable          Correctness
ISP              Small, focused interfaces           Decoupling
DIP              Depend on abstractions              Testability
```

## Sources

- Martin, R.C. (2003). *Agile Software Development: Principles, Patterns, and Practices*. Prentice Hall.
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall. Chapters 7-11.
- [Wikipedia — SOLID](https://en.wikipedia.org/wiki/SOLID)
