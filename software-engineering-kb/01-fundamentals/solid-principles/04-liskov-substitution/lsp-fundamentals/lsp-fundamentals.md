# Liskov Substitution Principle (LSP) -- Fundamentals

| Field          | Value                                                    |
|----------------|----------------------------------------------------------|
| Domain         | Fundamentals > SOLID Principles > Liskov Substitution    |
| Difficulty     | Advanced                                                 |
| Prerequisites  | OOP fundamentals, Inheritance, Polymorphism, Open/Closed |
| Last Updated   | 2026-03-07                                               |

---

## What It Is

The Liskov Substitution Principle was introduced by **Barbara Liskov** in her 1987 OOPSLA keynote address, "Data Abstraction and Hierarchy," and later formalized rigorously in a 1994 paper co-authored with **Jeannette Wing**. The formal definition states:

> **If S is a subtype of T, then objects of type T may be replaced with objects of type S without altering any of the desirable properties of the program (correctness, task performed, etc.).**

This is not merely about structural compatibility (matching method signatures). LSP is about **behavioral subtyping** -- a subtype must honor the behavioral contract established by its supertype. The principle is mathematically grounded in **Hoare logic**, where preconditions, postconditions, and invariants define a type's contract. A subtype must be substitutable in every context where the supertype is expected, preserving all guarantees the supertype provides.

In simpler terms: code that works correctly with a base type must continue to work correctly when given any subtype, without the calling code needing to know about or accommodate the subtype.

---

## Why It Matters

1. **Prevents subtle polymorphism bugs.** When subclasses violate the behavioral contract of their parent, client code that relies on polymorphism will behave unpredictably. These bugs are especially insidious because the code compiles and may pass superficial testing.

2. **Enables reliable polymorphism.** The entire value of polymorphism rests on the guarantee that subtypes are substitutable. Without LSP, every use of a base type reference requires defensive checks against specific subtypes, collapsing polymorphism into a series of `instanceof` conditionals.

3. **Honors Design by Contract.** LSP formalizes the relationship between a supertype's contract (preconditions, postconditions, invariants) and what a subtype may or may not change. Violating these contracts breaks every piece of code that depends on them.

4. **Supports the Open/Closed Principle.** OCP says systems should be open for extension but closed for modification. LSP ensures that extensions (subtypes) do not force modifications to existing client code.

5. **Improves maintainability.** When LSP holds, developers can confidently add new subtypes knowing existing code will continue to function correctly.

---

## How It Works

### Example 1: The Classic Rectangle-Square Problem (TypeScript)

This is the most famous LSP violation. Mathematically, a square "is a" rectangle. But in OOP with mutable state, making `Square` a subtype of `Rectangle` breaks substitutability.

**BEFORE -- LSP Violation:**

```typescript
class Rectangle {
  constructor(protected width: number, protected height: number) {}

  setWidth(w: number): void {
    this.width = w;
  }

  setHeight(h: number): void {
    this.height = h;
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }

  area(): number {
    return this.width * this.height;
  }
}

class Square extends Rectangle {
  constructor(side: number) {
    super(side, side);
  }

  // Violates LSP! Clients expect setWidth to change ONLY width.
  setWidth(w: number): void {
    this.width = w;
    this.height = w; // side effect not expected by Rectangle's contract
  }

  // Violates LSP! Clients expect setHeight to change ONLY height.
  setHeight(h: number): void {
    this.width = h;
    this.height = h; // side effect not expected by Rectangle's contract
  }
}

// Client code that works for Rectangle but BREAKS for Square:
function assertAreaAfterResize(rect: Rectangle): void {
  rect.setWidth(5);
  rect.setHeight(4);
  // Rectangle contract: area = width * height = 5 * 4 = 20
  console.assert(rect.area() === 20, `Expected 20, got ${rect.area()}`);
  // For Square: setHeight(4) also sets width to 4, so area = 16. FAILS!
}

assertAreaAfterResize(new Rectangle(10, 10)); // passes
assertAreaAfterResize(new Square(10));        // FAILS -- area is 16, not 20
```

**AFTER -- LSP-Compliant Design:**

```typescript
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(
    private width: number,
    private height: number
  ) {}

  setWidth(w: number): void { this.width = w; }
  setHeight(h: number): void { this.height = h; }
  area(): number { return this.width * this.height; }
}

class Square implements Shape {
  constructor(private side: number) {}

  setSide(s: number): void { this.side = s; }
  area(): number { return this.side * this.side; }
}

// Both are Shapes, but neither pretends to be the other.
// Client code using Shape only relies on area(), which both fulfill correctly.
function printArea(shape: Shape): void {
  console.log(`Area: ${shape.area()}`);
}
```

### Example 2: Bird Hierarchy (Python)

**BEFORE -- LSP Violation:**

```python
class Bird:
    def fly(self) -> str:
        return "Flying high!"

    def make_sound(self) -> str:
        return "Tweet!"


class Penguin(Bird):
    def fly(self) -> str:
        # Violates LSP! Clients of Bird expect fly() to succeed.
        raise NotImplementedError("Penguins can't fly!")

    def make_sound(self) -> str:
        return "Squawk!"


def migrate(birds: list[Bird]) -> None:
    for bird in birds:
        # This CRASHES when a Penguin is in the list
        print(bird.fly())


migrate([Bird(), Penguin()])  # RuntimeError!
```

**AFTER -- LSP-Compliant Design Using Protocols:**

```python
from typing import Protocol


class Bird(Protocol):
    def make_sound(self) -> str: ...


class FlyingBird(Protocol):
    def fly(self) -> str: ...
    def make_sound(self) -> str: ...


class Sparrow:
    def fly(self) -> str:
        return "Flying high!"

    def make_sound(self) -> str:
        return "Tweet!"


class Penguin:
    def swim(self) -> str:
        return "Swimming fast!"

    def make_sound(self) -> str:
        return "Squawk!"


def migrate(birds: list[FlyingBird]) -> None:
    for bird in birds:
        print(bird.fly())  # safe -- only FlyingBird types accepted


def chorus(birds: list[Bird]) -> None:
    for bird in birds:
        print(bird.make_sound())  # safe -- all birds can make sounds


migrate([Sparrow()])              # works
chorus([Sparrow(), Penguin()])    # works
# migrate([Penguin()])            # type error -- caught at static analysis time
```

### Example 3: Collection Types (Java)

Java's `Collections.unmodifiableList()` returns a `List` that throws `UnsupportedOperationException` on mutation methods. This is a well-known LSP violation in the standard library.

```java
import java.util.*;

public class CollectionLspViolation {
    // Client code expects List to support add()
    public static void addDefaults(List<String> items) {
        items.add("default-1");  // throws UnsupportedOperationException!
        items.add("default-2");
    }

    public static void main(String[] args) {
        List<String> mutable = new ArrayList<>(List.of("a", "b"));
        addDefaults(mutable); // works fine

        List<String> immutable = Collections.unmodifiableList(mutable);
        addDefaults(immutable); // CRASHES at runtime!
    }
}
```

**LSP-Compliant Alternative:** Use distinct types that communicate intent.

```java
// Java's type system doesn't have a built-in ReadOnlyList,
// but you can model it explicitly:
public interface ReadableList<T> {
    T get(int index);
    int size();
    boolean contains(T item);
}

public interface WritableList<T> extends ReadableList<T> {
    void add(T item);
    void remove(int index);
}

// Now clients declare what they actually need:
public static void addDefaults(WritableList<String> items) {
    items.add("default-1"); // guaranteed to work
}

public static void printAll(ReadableList<String> items) {
    for (int i = 0; i < items.size(); i++) {
        System.out.println(items.get(i));
    }
}
```

### Example 4: File System (C#)

```csharp
// BEFORE -- LSP Violation
public class File
{
    public virtual string Read() => "file contents";
    public virtual void Write(string content) { /* writes to disk */ }
}

public class ReadOnlyFile : File
{
    public override void Write(string content)
    {
        // Violates LSP! Clients of File expect Write to succeed.
        throw new InvalidOperationException("Cannot write to a read-only file.");
    }
}

// Client code that breaks:
void SaveReport(File file, string report)
{
    file.Write(report); // crashes if file is ReadOnlyFile
}
```

```csharp
// AFTER -- LSP-Compliant
public interface IReadableFile
{
    string Read();
}

public interface IWritableFile : IReadableFile
{
    void Write(string content);
}

public class RegularFile : IWritableFile
{
    public string Read() => "file contents";
    public void Write(string content) { /* writes to disk */ }
}

public class ReadOnlyFile : IReadableFile
{
    public string Read() => "file contents";
    // No Write method -- no violation possible
}

void SaveReport(IWritableFile file, string report)
{
    file.Write(report); // type-safe, always works
}
```

### Example 5: Database Connections (Go)

Go's structural typing and small interfaces naturally discourage LSP violations.

```go
package main

import "fmt"

// Small, focused interfaces -- Go idiom
type Reader interface {
    Query(sql string) ([]Row, error)
}

type Writer interface {
    Execute(sql string, args ...interface{}) error
}

type ReadWriter interface {
    Reader
    Writer
}

type Row struct {
    Data map[string]interface{}
}

// PostgreSQL implements both
type PostgresDB struct{ connStr string }

func (db *PostgresDB) Query(sql string) ([]Row, error) {
    fmt.Println("Postgres query:", sql)
    return []Row{}, nil
}

func (db *PostgresDB) Execute(sql string, args ...interface{}) error {
    fmt.Println("Postgres execute:", sql)
    return nil
}

// ReadReplica only implements Reader -- no LSP violation possible
type ReadReplica struct{ host string }

func (r *ReadReplica) Query(sql string) ([]Row, error) {
    fmt.Println("Replica query:", sql)
    return []Row{}, nil
}

// Functions declare exactly what they need
func generateReport(db Reader) {
    db.Query("SELECT * FROM reports") // works for both
}

func saveOrder(db Writer) {
    db.Execute("INSERT INTO orders ...") // only accepts writers
}
```

---

## Design by Contract Rules

Barbara Liskov and Jeannette Wing formalized substitutability using contract rules derived from Bertrand Meyer's Design by Contract. A subtype `S` of type `T` must satisfy all four:

### Rule 1: Preconditions Cannot Be Strengthened

The subtype may accept the same or broader range of inputs, never narrower.

```typescript
class Base {
  // Accepts any positive number
  withdraw(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive");
    // process withdrawal
  }
}

class StricterSubtype extends Base {
  // VIOLATION: Strengthens precondition (narrows accepted inputs)
  withdraw(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive");
    if (amount > 1000) throw new Error("Max withdrawal is 1000"); // new restriction!
    // process withdrawal
  }
}

class RelaxedSubtype extends Base {
  // VALID: Weakens precondition (accepts broader inputs)
  withdraw(amount: number): void {
    if (amount === 0) return; // accepts zero -- more permissive
    if (amount < 0) throw new Error("Amount must be non-negative");
    // process withdrawal
  }
}
```

### Rule 2: Postconditions Cannot Be Weakened

The subtype must guarantee at least as much as the supertype promises.

```python
class Sorter:
    def sort(self, items: list[int]) -> list[int]:
        """Postcondition: returns items in ascending order, same length."""
        return sorted(items)


class BrokenSorter(Sorter):
    def sort(self, items: list[int]) -> list[int]:
        # VIOLATION: weakens postcondition -- may not be fully sorted
        return items  # just returns input unsorted!


class StableSorter(Sorter):
    def sort(self, items: list[int]) -> list[int]:
        # VALID: strengthens postcondition (stable sort preserves equal-element order)
        return sorted(items, key=lambda x: x)
```

### Rule 3: Invariants Must Be Preserved

Properties that are always true for the supertype must remain true in the subtype.

```java
// Invariant: balance >= 0
public class BankAccount {
    protected double balance;

    public BankAccount(double initialBalance) {
        if (initialBalance < 0) throw new IllegalArgumentException();
        this.balance = initialBalance;
    }

    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException();
        this.balance += amount;
    }

    public double getBalance() { return balance; }
}

// VIOLATION: Allows negative balance, breaking the invariant
public class OverdraftAccount extends BankAccount {
    public OverdraftAccount(double initialBalance) {
        super(initialBalance);
    }

    public void withdraw(double amount) {
        this.balance -= amount; // can go negative -- invariant broken!
    }
}
```

### Rule 4: The History Constraint (History Rule)

The subtype must not permit state transitions that are impossible in the supertype. If the supertype's state can only increase (like an immutable log), the subtype must not allow deletion.

```typescript
class AppendOnlyLog {
  protected entries: string[] = [];

  append(entry: string): void {
    this.entries.push(entry);
  }

  getEntries(): readonly string[] {
    return this.entries;
  }

  get length(): number {
    return this.entries.length;
  }
  // History constraint: length can only increase or stay the same
}

class MutableLog extends AppendOnlyLog {
  // VIOLATION: Allows state change (deletion) that supertype doesn't permit
  clear(): void {
    this.entries = []; // length decreases -- violates history constraint
  }

  removeEntry(index: number): void {
    this.entries.splice(index, 1); // length decreases
  }
}
```

---

## Detecting LSP Violations -- Checklist

Use these warning signs to identify LSP violations during code review:

| # | Warning Sign                                     | Example                                           |
|---|--------------------------------------------------|---------------------------------------------------|
| 1 | Subclass throws exceptions the parent does not   | `Penguin.fly()` throws `NotImplementedError`      |
| 2 | Subclass ignores or nullifies parent methods     | `NullOutputStream.write()` silently does nothing  |
| 3 | Client code uses `instanceof` / `typeof` checks  | `if (shape instanceof Square) { ... }`            |
| 4 | Empty method overrides                           | `scan() {}` in `SimplePrinter`                    |
| 5 | Preconditions are more restrictive in subclass   | Subclass rejects inputs the parent accepts        |
| 6 | Postconditions are weaker in subclass            | Subclass returns less precise results             |
| 7 | Invariants are broken by subclass state changes  | Mutable subclass of an immutable parent           |
| 8 | Documentation says "do not use X with Y"         | "This method is not supported for type Z"         |

**The `instanceof` / type-check smell:** If you find code like this, LSP is likely violated somewhere:

```typescript
function processShape(shape: Shape): void {
  if (shape instanceof Square) {
    // special handling for Square
  } else if (shape instanceof Circle) {
    // special handling for Circle
  } else {
    // default handling
  }
}
// This should just be: shape.process() with polymorphism
```

---

## LSP and Variance

Variance describes how subtyping of composite types relates to subtyping of their components. LSP constrains variance in method signatures:

- **Covariance of return types:** A subtype's method may return a *more specific* type (narrower). If `Base.create()` returns `Animal`, `Sub.create()` may return `Dog`.
- **Contravariance of parameter types:** A subtype's method may accept a *more general* type (broader). If `Base.feed(Dog)`, `Sub.feed(Animal)` is safe.

| Language   | Return Type Covariance | Parameter Contravariance | Notes                                     |
|------------|------------------------|--------------------------|-------------------------------------------|
| Java       | Yes (since Java 5)     | No (overloads instead)   | Uses erasure for generics                 |
| C#         | Yes (since C# 9)       | No                       | Supports delegate variance                |
| TypeScript | Yes                    | Bivariant (by default)   | `strictFunctionTypes` enables correctness |
| Kotlin     | Yes                    | No                       | `in`/`out` variance annotations           |
| Rust       | N/A (no inheritance)   | N/A                      | Uses traits, not subtyping                |

```typescript
// TypeScript with strictFunctionTypes enabled:
class Animal { name = "animal"; }
class Dog extends Animal { breed = "labrador"; }

type AnimalFactory = () => Animal;
type DogFactory = () => Dog;

// Covariant return: DogFactory is assignable to AnimalFactory
const dogFactory: DogFactory = () => new Dog();
const animalFactory: AnimalFactory = dogFactory; // OK -- covariant

type AnimalHandler = (a: Animal) => void;
type DogHandler = (d: Dog) => void;

// Contravariant parameters: AnimalHandler is assignable to DogHandler
const handleAnimal: AnimalHandler = (a) => console.log(a.name);
const handleDog: DogHandler = handleAnimal; // OK -- contravariant
```

---

## Real-World LSP Violations in Standard Libraries

### Java's `Stack extends Vector`

`java.util.Stack` extends `java.util.Vector`, inheriting methods like `add(index, element)` and `remove(index)` that allow arbitrary positional access. This violates the LIFO (last-in, first-out) contract that clients of a stack expect. You can insert an element in the middle of a "stack."

```java
Stack<String> stack = new Stack<>();
stack.push("first");
stack.push("second");
stack.add(0, "inserted-at-bottom"); // Vector method -- violates Stack semantics!
// Stack now contains: [inserted-at-bottom, first, second]
```

### Java's `Properties extends Hashtable`

`java.util.Properties` extends `Hashtable<Object, Object>` but is documented to only work with `String` keys and values. The inherited `put(Object, Object)` method allows non-String entries that break `getProperty(String)`.

### `Arrays.asList()` Returns a Fixed-Size List

`Arrays.asList()` returns a `List` that throws `UnsupportedOperationException` on `add()` and `remove()`, violating the `List` interface contract.

---

## Relationship to Other SOLID Principles

| Principle | Relationship to LSP                                                                 |
|-----------|-------------------------------------------------------------------------------------|
| SRP       | Classes with one responsibility are less likely to create LSP-violating subtypes     |
| OCP       | LSP guarantees that extensions (subtypes) do not break existing code                |
| ISP       | Smaller interfaces reduce the surface area where LSP can be violated                |
| DIP       | Depending on abstractions works only if LSP holds for all implementations           |

---

## Sources

- Liskov, B. (1987). "Data Abstraction and Hierarchy." OOPSLA '87 Addendum to the Proceedings.
- Liskov, B. & Wing, J. (1994). "A Behavioral Notion of Subtyping." ACM Transactions on Programming Languages and Systems, 16(6), 1811-1841.
- Martin, R.C. (2002). *Agile Software Development: Principles, Patterns, and Practices.* Prentice Hall. Chapter 10: The Liskov Substitution Principle.
- Martin, R.C. (2017). *Clean Architecture.* Prentice Hall. Chapter 9.
- Meyer, B. (1988). *Object-Oriented Software Construction.* Prentice Hall. (Design by Contract foundations)
- Bloch, J. (2008). *Effective Java,* 2nd Edition. Item 16: "Favor composition over inheritance."
- Wikipedia. "Liskov substitution principle." https://en.wikipedia.org/wiki/Liskov_substitution_principle
- Ousterhout, J. (2018). *A Philosophy of Software Design.* Chapter on interface design.
