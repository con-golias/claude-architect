# Interface Segregation Principle (ISP) -- Fundamentals

| Field          | Value                                                       |
|----------------|-------------------------------------------------------------|
| Domain         | Fundamentals > SOLID Principles > Interface Segregation     |
| Difficulty     | Intermediate                                                |
| Prerequisites  | OOP fundamentals, Interfaces, Abstraction                   |
| Last Updated   | 2026-03-07                                                  |

---

## What It Is

The Interface Segregation Principle was formulated by **Robert C. Martin** in the mid-1990s, originating from his consulting work on the Xerox printer/copier software system. The principle states:

> **Clients should not be forced to depend on interfaces they do not use.**

Also known as the **principle of minimal interfaces**, ISP deals with the disadvantages of "fat" interfaces -- interfaces that are not cohesive and bundle together methods that serve different client groups. When a class is forced to implement interface methods it does not need, the result is empty implementations, `NotImplementedError` throws, or tightly coupled code that changes for reasons unrelated to its actual purpose.

The core insight is that **an interface belongs to its clients, not to the class that implements it.** You should design interfaces around what each client needs, not around what an implementation can provide. A single implementation class may implement multiple small interfaces, each tailored to a different client.

ISP is closely related to the concept of **role interfaces** (as described by Martin Fowler) -- interfaces defined by the role an object plays in a particular interaction, rather than by the full set of capabilities the object possesses.

---

## Why It Matters

1. **Reduces unnecessary coupling.** When a client depends on a fat interface, it is transitively coupled to every other client of that interface. A change driven by one client's needs forces recompilation and potentially retesting of all clients.

2. **Prevents implementing unused methods.** Fat interfaces force implementors to provide stub implementations for methods they cannot meaningfully support, leading to `UnsupportedOperationException` or silent no-ops -- both of which are latent bugs.

3. **Increases modularity and composability.** Small interfaces can be mixed and matched. A class can implement exactly the combination of interfaces it supports, and clients can require exactly the combination they need.

4. **Simplifies testing and mocking.** Mocking a 2-method interface is trivial. Mocking a 20-method interface is tedious and error-prone. ISP directly improves testability by shrinking the surface area of test doubles.

5. **Supports the Liskov Substitution Principle.** Smaller interfaces reduce the number of methods where a subtype could potentially violate its contract. The fewer promises an interface makes, the easier it is for every implementor to honor them all.

---

## How It Works

### Example 1: Printer/Scanner/Fax (TypeScript)

The classic Xerox-inspired example that motivated the principle.

**BEFORE -- Fat Interface Violation:**

```typescript
interface Machine {
  print(doc: Document): void;
  scan(doc: Document): Buffer;
  fax(doc: Document, number: string): void;
  staple(doc: Document): void;
}

// A simple printer is forced to "implement" methods it cannot support
class SimplePrinter implements Machine {
  print(doc: Document): void {
    console.log("Printing:", doc.title);
  }

  scan(doc: Document): Buffer {
    throw new Error("SimplePrinter cannot scan!");
  }

  fax(doc: Document, number: string): void {
    throw new Error("SimplePrinter cannot fax!");
  }

  staple(doc: Document): void {
    throw new Error("SimplePrinter cannot staple!");
  }
}

// Client code cannot trust the interface:
function scanDocument(machine: Machine, doc: Document): Buffer {
  // Will this throw? Who knows -- depends on the concrete type.
  return machine.scan(doc);
}
```

**AFTER -- Segregated Interfaces:**

```typescript
interface Printer {
  print(doc: Document): void;
}

interface Scanner {
  scan(doc: Document): Buffer;
}

interface Fax {
  fax(doc: Document, number: string): void;
}

interface Stapler {
  staple(doc: Document): void;
}

// Simple printer implements only what it supports
class SimplePrinter implements Printer {
  print(doc: Document): void {
    console.log("Printing:", doc.title);
  }
}

// Multi-function device composes the interfaces it supports
class MultiFunctionDevice implements Printer, Scanner, Fax {
  print(doc: Document): void { console.log("MFD printing:", doc.title); }
  scan(doc: Document): Buffer { return Buffer.from("scanned data"); }
  fax(doc: Document, number: string): void { console.log("Faxing to", number); }
}

// High-end device supports everything
class EnterpriseDevice implements Printer, Scanner, Fax, Stapler {
  print(doc: Document): void { /* ... */ }
  scan(doc: Document): Buffer { return Buffer.from("scanned"); }
  fax(doc: Document, number: string): void { /* ... */ }
  staple(doc: Document): void { /* ... */ }
}

// Client code is type-safe -- only requests what it needs
function scanDocument(scanner: Scanner, doc: Document): Buffer {
  return scanner.scan(doc); // guaranteed to work
}

function printAndStaple(device: Printer & Stapler, doc: Document): void {
  device.print(doc);
  device.staple(doc);
}
```

### Example 2: Worker Interface (Java)

**BEFORE -- Fat Interface:**

```java
public interface IWorker {
    void work();
    void eat();
    void sleep();
    void attendMeeting();
}

// A robot worker cannot eat, sleep, or attend meetings
public class RobotWorker implements IWorker {
    @Override public void work() { System.out.println("Robot working..."); }
    @Override public void eat() { /* meaningless -- robots don't eat */ }
    @Override public void sleep() { /* meaningless */ }
    @Override public void attendMeeting() { /* meaningless */ }
}
```

**AFTER -- Segregated Interfaces:**

```java
public interface Workable {
    void work();
}

public interface Feedable {
    void eat();
}

public interface Restable {
    void sleep();
}

public interface MeetingAttendee {
    void attendMeeting();
}

// Human implements all relevant interfaces
public class HumanWorker implements Workable, Feedable, Restable, MeetingAttendee {
    @Override public void work() { System.out.println("Human working..."); }
    @Override public void eat() { System.out.println("Eating lunch..."); }
    @Override public void sleep() { System.out.println("Sleeping..."); }
    @Override public void attendMeeting() { System.out.println("In meeting..."); }
}

// Robot only implements what it can actually do
public class RobotWorker implements Workable {
    @Override public void work() { System.out.println("Robot working 24/7..."); }
}

// Manager code only depends on what it needs:
public class TaskManager {
    public void assignWork(Workable worker) {
        worker.work(); // works for both Human and Robot
    }
}

public class CafeteriaManager {
    public void serveLunch(Feedable entity) {
        entity.eat(); // only humans -- robots are never passed here
    }
}
```

### Example 3: Repository Pattern (Python)

**BEFORE -- Monolithic Repository:**

```python
from abc import ABC, abstractmethod
from typing import TypeVar, Generic

T = TypeVar("T")


class Repository(ABC, Generic[T]):
    @abstractmethod
    def create(self, entity: T) -> T: ...

    @abstractmethod
    def find_by_id(self, id: str) -> T | None: ...

    @abstractmethod
    def find_all(self) -> list[T]: ...

    @abstractmethod
    def update(self, entity: T) -> T: ...

    @abstractmethod
    def delete(self, id: str) -> None: ...

    @abstractmethod
    def search(self, query: str) -> list[T]: ...

    @abstractmethod
    def aggregate(self, pipeline: dict) -> dict: ...

    @abstractmethod
    def export_csv(self, path: str) -> None: ...


# A read-only reporting service is forced to implement write methods:
class ReportRepository(Repository):
    def create(self, entity): raise NotImplementedError("Read-only!")
    def update(self, entity): raise NotImplementedError("Read-only!")
    def delete(self, id): raise NotImplementedError("Read-only!")
    def export_csv(self, path): raise NotImplementedError("Not supported!")
    # ... must implement ALL eight methods
```

**AFTER -- Segregated Repositories:**

```python
from abc import ABC, abstractmethod
from typing import TypeVar, Generic, Protocol

T = TypeVar("T")


class ReadRepository(ABC, Generic[T]):
    @abstractmethod
    def find_by_id(self, id: str) -> T | None: ...

    @abstractmethod
    def find_all(self) -> list[T]: ...


class WriteRepository(ABC, Generic[T]):
    @abstractmethod
    def create(self, entity: T) -> T: ...

    @abstractmethod
    def update(self, entity: T) -> T: ...

    @abstractmethod
    def delete(self, id: str) -> None: ...


class SearchRepository(ABC, Generic[T]):
    @abstractmethod
    def search(self, query: str) -> list[T]: ...


class AggregateRepository(ABC, Generic[T]):
    @abstractmethod
    def aggregate(self, pipeline: dict) -> dict: ...


class Exportable(Protocol):
    def export_csv(self, path: str) -> None: ...


# Full CRUD repository composes what it needs
class UserRepository(ReadRepository[User], WriteRepository[User], SearchRepository[User]):
    def find_by_id(self, id: str) -> User | None: ...
    def find_all(self) -> list[User]: ...
    def create(self, entity: User) -> User: ...
    def update(self, entity: User) -> User: ...
    def delete(self, id: str) -> None: ...
    def search(self, query: str) -> list[User]: ...


# Read-only reporting only implements reads
class ReportReadRepository(ReadRepository[Report], SearchRepository[Report]):
    def find_by_id(self, id: str) -> Report | None: ...
    def find_all(self) -> list[Report]: ...
    def search(self, query: str) -> list[Report]: ...


# Service declares exactly what it needs
class ReportingService:
    def __init__(self, repo: ReadRepository[Report]) -> None:
        self.repo = repo  # only read access -- clean and safe
```

### Example 4: React Component Props (TypeScript)

ISP applies directly to component API design in frontend frameworks.

**BEFORE -- Monolithic Props:**

```typescript
interface UserCardProps {
  user: User;
  showAvatar: boolean;
  showEmail: boolean;
  showPhone: boolean;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onMessage: (userId: string) => void;
  onBlock: (userId: string) => void;
  isAdmin: boolean;
  theme: "light" | "dark";
  compactMode: boolean;
  analyticsTracker: AnalyticsService;
}

// Every consumer must provide ALL props, even when most are irrelevant
```

**AFTER -- Segregated Props:**

```typescript
// Core display props
interface UserDisplayProps {
  user: User;
  showAvatar?: boolean;
  compactMode?: boolean;
}

// Action props
interface UserActionProps {
  onEdit?: (user: User) => void;
  onDelete?: (userId: string) => void;
}

// Communication props
interface UserCommunicationProps {
  onMessage?: (userId: string) => void;
  onBlock?: (userId: string) => void;
}

// Admin-specific props
interface UserAdminProps {
  isAdmin?: boolean;
}

// Compose only what each component needs
type UserCardProps = UserDisplayProps & UserActionProps;
type AdminUserCardProps = UserDisplayProps & UserActionProps & UserAdminProps;
type UserProfileProps = UserDisplayProps & UserCommunicationProps;

// Simple display component -- minimal dependencies
function UserAvatar({ user, showAvatar }: UserDisplayProps) {
  if (!showAvatar) return null;
  return <img src={user.avatarUrl} alt={user.name} />;
}

// Admin panel composes more
function AdminUserCard({ user, onEdit, onDelete, isAdmin }: AdminUserCardProps) {
  // Only depends on what it actually uses
}
```

### Example 5: Go Interfaces -- Naturally ISP-Compliant

Go's interface design philosophy is built around ISP. Interfaces are small (often 1-2 methods), implicitly satisfied, and defined by the consumer.

```go
package main

import (
    "fmt"
    "io"
    "os"
)

// Go standard library interfaces -- textbook ISP:
// io.Reader   = { Read(p []byte) (n int, err error) }
// io.Writer   = { Write(p []byte) (n int, err error) }
// io.Closer   = { Close() error }
// io.Seeker   = { Seek(offset int64, whence int) (int64, error) }

// Composed interfaces for when you need more:
// io.ReadWriter  = Reader + Writer
// io.ReadCloser  = Reader + Closer
// io.WriteCloser = Writer + Closer

// Your functions accept the smallest interface they need:
func processInput(r io.Reader) error {
    buf := make([]byte, 1024)
    _, err := r.Read(buf)
    return err
}

func writeOutput(w io.Writer, data string) error {
    _, err := fmt.Fprint(w, data)
    return err
}

func copyData(dst io.Writer, src io.Reader) error {
    _, err := io.Copy(dst, src)
    return err
}

// All of these work with files, network connections, buffers,
// HTTP bodies, compressed streams, etc. -- because the interfaces are small.
func main() {
    // os.File implements Reader, Writer, Closer, Seeker
    file, _ := os.Open("data.txt")
    defer file.Close()

    processInput(file)       // File as Reader
    writeOutput(os.Stdout, "hello") // Stdout as Writer
    copyData(os.Stdout, file)       // Both roles
}
```

**Contrast with Java's large interfaces:**

```go
// Java's java.sql.Connection has 50+ methods.
// In Go, you'd define what you actually need:

type Querier interface {
    Query(sql string, args ...interface{}) (*Rows, error)
}

type Executer interface {
    Exec(sql string, args ...interface{}) (Result, error)
}

type Transactor interface {
    Begin() (*Tx, error)
}

// Each function accepts only the capability it requires:
func fetchUsers(q Querier) ([]*User, error) {
    rows, err := q.Query("SELECT * FROM users")
    // ...
}
```

### Example 6: Rust Traits

Rust's trait system is inherently aligned with ISP. Traits are small, composable, and explicitly implemented.

```rust
use std::io::{Read, Write, Seek, BufRead};
use std::fmt::{Display, Debug};

// Rust standard library traits follow ISP:
// Read   -- fn read(&mut self, buf: &mut [u8]) -> io::Result<usize>
// Write  -- fn write(&mut self, buf: &[u8]) -> io::Result<usize>
// Seek   -- fn seek(&mut self, pos: SeekFrom) -> io::Result<u64>
// Display -- fn fmt(&self, f: &mut Formatter) -> fmt::Result
// Debug   -- fn fmt(&self, f: &mut Formatter) -> fmt::Result

// Define small, focused traits for your domain:
trait Printable {
    fn print(&self);
}

trait Scannable {
    fn scan(&self) -> Vec<u8>;
}

trait Faxable {
    fn fax(&self, number: &str);
}

struct SimplePrinter;
struct MultiFunctionDevice;

// SimplePrinter only implements what it can do
impl Printable for SimplePrinter {
    fn print(&self) {
        println!("Simple printer: printing...");
    }
}

// MultiFunctionDevice implements all three
impl Printable for MultiFunctionDevice {
    fn print(&self) { println!("MFD: printing..."); }
}

impl Scannable for MultiFunctionDevice {
    fn scan(&self) -> Vec<u8> { vec![0xFF, 0xD8] }
}

impl Faxable for MultiFunctionDevice {
    fn fax(&self, number: &str) { println!("MFD: faxing to {}", number); }
}

// Functions use trait bounds to require only what they need:
fn print_document(device: &impl Printable) {
    device.print();
}

fn scan_and_print(device: &(impl Printable + Scannable)) {
    let _data = device.scan();
    device.print();
}

// Trait objects for runtime polymorphism:
fn print_all(devices: &[&dyn Printable]) {
    for device in devices {
        device.print();
    }
}
```

---

## Fat Interface Warning Signs

| # | Warning Sign                                                  | Symptom                                               |
|---|---------------------------------------------------------------|-------------------------------------------------------|
| 1 | Classes implement interfaces with many unused methods         | Empty method bodies, `pass`, or `{ }`                 |
| 2 | `NotImplementedError` or `UnsupportedOperationException`      | Runtime failures on "supported" operations             |
| 3 | Interface methods serve different, unrelated client groups     | Printer clients don't need scanner methods             |
| 4 | Changes for one client force recompilation of unrelated ones  | Modifying `scan()` signature forces `SimplePrinter` update |
| 5 | Interface has more than ~5 methods                            | Likely serving multiple responsibilities               |
| 6 | Mocking the interface requires stubbing many irrelevant methods| Test setup is verbose and fragile                    |

---

## ISP vs SRP

These two principles are complementary but address different concerns:

| Aspect       | Single Responsibility (SRP)              | Interface Segregation (ISP)                    |
|--------------|------------------------------------------|------------------------------------------------|
| Focus        | Class internals                          | Interface surface exposed to clients           |
| Question     | "Does this class have one reason to change?" | "Are clients forced to depend on unused methods?" |
| Scope        | Implementation                           | API boundary                                   |
| Violation    | Class does too many things               | Interface promises too many things             |
| Fix          | Split the class                          | Split the interface                            |

A class can satisfy SRP (one responsibility) but expose a fat interface to clients. Conversely, an interface can be properly segregated while the implementing class still violates SRP. Both principles should be applied together.

---

## Adapter Pattern for Legacy Fat Interfaces

When you inherit a codebase with fat interfaces and cannot change them (binary compatibility, third-party library, etc.), use the **Adapter pattern** to retrofit ISP without breaking existing code.

```typescript
// Legacy fat interface you cannot modify
interface LegacyMachine {
  print(doc: Document): void;
  scan(doc: Document): Buffer;
  fax(doc: Document, number: string): void;
  staple(doc: Document): void;
  collate(docs: Document[]): Document;
  duplex(doc: Document): void;
}

// New segregated interfaces
interface Printer {
  print(doc: Document): void;
}

interface Scanner {
  scan(doc: Document): Buffer;
}

// Adapter wraps the legacy implementation behind a clean interface
class PrinterAdapter implements Printer {
  constructor(private legacy: LegacyMachine) {}

  print(doc: Document): void {
    this.legacy.print(doc);
  }
}

class ScannerAdapter implements Scanner {
  constructor(private legacy: LegacyMachine) {}

  scan(doc: Document): Buffer {
    return this.legacy.scan(doc);
  }
}

// New code depends on the clean interfaces
class DocumentService {
  constructor(
    private printer: Printer,
    private scanner: Scanner
  ) {}

  photocopy(doc: Document): void {
    const scanned = this.scanner.scan(doc);
    // convert and print...
    this.printer.print(doc);
  }
}

// Wire up with adapters
const legacyDevice = new OldXeroxMachine(); // implements LegacyMachine
const service = new DocumentService(
  new PrinterAdapter(legacyDevice),
  new ScannerAdapter(legacyDevice)
);
```

---

## ISP in API Design

ISP extends beyond OOP interfaces to any API boundary:

- **REST APIs:** Instead of one endpoint returning a massive JSON object, provide focused endpoints or support field selection (GraphQL, sparse fieldsets in JSON:API).
- **npm packages:** Instead of one monolithic package, publish focused packages (`lodash` vs `lodash/map`, `lodash/filter`).
- **Microservices:** Each service exposes a focused API for its bounded context, not a "god service" with every operation.

```typescript
// REST API example -- ISP applied to endpoints
// BAD: /api/user returns everything
// GET /api/user/123 -> { id, name, email, phone, address, orders, preferences, ... }

// GOOD: Focused endpoints
// GET /api/user/123/profile    -> { id, name, email }
// GET /api/user/123/orders     -> { orders: [...] }
// GET /api/user/123/preferences -> { theme, language, notifications }
```

---

## Sources

- Martin, R.C. (1996). "The Interface Segregation Principle." C++ Report. Originally published in *The Principles of OOD*.
- Martin, R.C. (2002). *Agile Software Development: Principles, Patterns, and Practices.* Prentice Hall. Chapter 12: The Interface Segregation Principle.
- Martin, R.C. (2017). *Clean Architecture.* Prentice Hall. Chapter 10.
- Fowler, M. (2006). "Role Interface." https://martinfowler.com/bliki/RoleInterface.html
- Go Proverbs. "The bigger the interface, the weaker the abstraction." -- Rob Pike.
- Wikipedia. "Interface segregation principle." https://en.wikipedia.org/wiki/Interface_segregation_principle
- oodesign.com. "Interface Segregation Principle." https://www.oodesign.com/interface-segregation-principle
- reflectoring.io. "Explaining the Interface Segregation Principle." https://reflectoring.io/interface-segregation-principle/
