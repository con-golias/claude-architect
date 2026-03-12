# Interface Segregation Principle (ISP)

> **Domain:** Fundamentals > Clean Code > Principles > SOLID
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Interface Segregation Principle (ISP) is the fourth SOLID principle, formulated by Robert C. Martin:

> "No client should be forced to depend on interfaces it does not use."

ISP states that large, monolithic interfaces should be broken into smaller, more specific ones. Clients should only need to know about the methods that are relevant to them. This leads to a system of **role interfaces** — small, focused contracts that describe one specific capability.

### Origins

Robert C. Martin developed ISP while consulting for Xerox in the early 1990s. He encountered a single `Job` class used for printing, stapling, and faxing. Every change to the printing interface forced recompilation of the faxing code, even though faxing had nothing to do with printing. The solution: split the fat interface into `Printable`, `Stapleable`, and `Faxable`.

## Why It Matters

### Reduced Coupling
When clients depend only on the methods they use, they are shielded from changes in methods they don't care about.

### Easier Implementation
Implementing a small, focused interface is simpler than implementing a large one with many irrelevant methods.

### Better Testability
Mocking a small interface in tests is trivial. Mocking a fat interface with 20 methods is painful and error-prone.

### Clearer Contracts
Small interfaces communicate intent. `Readable` tells you something can be read. `CrudRepository<T>` tells you nothing specific.

## How It Works

### Example: Fat Interface Violation

```typescript
// BAD: Fat interface — forces all implementations to handle everything
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  attendMeeting(): void;
  writeReport(): void;
}

// A Robot can work but doesn't eat, sleep, or attend meetings
class Robot implements Worker {
  work(): void { /* works */ }
  eat(): void { throw new Error('Robots do not eat'); }         // Forced!
  sleep(): void { throw new Error('Robots do not sleep'); }     // Forced!
  attendMeeting(): void { throw new Error('Not applicable'); }  // Forced!
  writeReport(): void { throw new Error('Not applicable'); }    // Forced!
}
```

### Example: Fixed with ISP

```typescript
// GOOD: Segregated interfaces
interface Workable {
  work(): void;
}

interface Feedable {
  eat(): void;
}

interface Sleepable {
  sleep(): void;
}

interface MeetingAttendee {
  attendMeeting(): void;
}

class HumanWorker implements Workable, Feedable, Sleepable, MeetingAttendee {
  work(): void { /* works */ }
  eat(): void { /* eats */ }
  sleep(): void { /* sleeps */ }
  attendMeeting(): void { /* attends */ }
}

class Robot implements Workable {
  work(): void { /* works 24/7 */ }
  // No need to implement eat, sleep, or attendMeeting!
}
```

### Python Example

```python
from abc import ABC, abstractmethod

# BAD: Fat interface
class MultiFunctionDevice(ABC):
    @abstractmethod
    def print(self, document): pass

    @abstractmethod
    def scan(self, document): pass

    @abstractmethod
    def fax(self, document): pass

# A simple printer is forced to implement scan and fax
class SimplePrinter(MultiFunctionDevice):
    def print(self, document):
        print(f"Printing: {document}")

    def scan(self, document):
        raise NotImplementedError("Cannot scan!")  # ISP violation

    def fax(self, document):
        raise NotImplementedError("Cannot fax!")   # ISP violation


# GOOD: Segregated interfaces
class Printer(ABC):
    @abstractmethod
    def print(self, document): pass

class Scanner(ABC):
    @abstractmethod
    def scan(self, document): pass

class FaxMachine(ABC):
    @abstractmethod
    def fax(self, document): pass

class SimplePrinter(Printer):
    def print(self, document):
        print(f"Printing: {document}")

class AllInOnePrinter(Printer, Scanner, FaxMachine):
    def print(self, document): pass
    def scan(self, document): pass
    def fax(self, document): pass
```

### Java Example

```java
// BAD: Fat repository interface
public interface Repository<T> {
    T findById(Long id);
    List<T> findAll();
    T save(T entity);
    void delete(T entity);
    void deleteAll();
    List<T> findByCustomQuery(String query);
    void bulkInsert(List<T> entities);
    void truncate();
}

// GOOD: Segregated repository interfaces
public interface ReadRepository<T> {
    T findById(Long id);
    List<T> findAll();
}

public interface WriteRepository<T> {
    T save(T entity);
    void delete(T entity);
}

public interface BulkRepository<T> {
    void bulkInsert(List<T> entities);
    void truncate();
}

// Compose what you need
public interface UserRepository extends ReadRepository<User>, WriteRepository<User> {
    // Only read + write, no bulk operations needed
}
```

## Best Practices

1. **Start with small interfaces.** It's easier to compose small interfaces than to split large ones later.

2. **Name interfaces by capability.** `Serializable`, `Comparable`, `Iterable` — each describes exactly one capability. Avoid names like `IManager` or `IService`.

3. **Use interface composition.** In TypeScript/Java/C#, a class can implement multiple interfaces. Compose the exact set of capabilities each client needs.

4. **Apply ISP to function parameters too.** If a function only needs an object's `name` and `email`, accept `{ name: string; email: string }` instead of the entire `User` object.

   ```typescript
   // GOOD: Only require what you need
   function sendEmail(recipient: { email: string; name: string }) { ... }

   // BAD: Requires full User when you only need 2 fields
   function sendEmail(user: User) { ... }
   ```

5. **Watch for "not applicable" implementations.** If you're writing `throw new NotImplementedError()` or leaving methods empty, it's an ISP violation.

6. **In TypeScript, use `Pick` and `Omit`** to create focused types from larger ones without creating explicit interfaces.

## Anti-patterns / Common Mistakes

### The Header Interface
Creating one giant interface that mirrors the entire public API of a class. This provides no segregation benefit.

### Interface Explosion
Going too far — creating an interface for every single method. One-method interfaces (like `Runnable` or `Callable`) make sense for callbacks but not for every operation.

### Marker Interfaces Without Purpose
Empty interfaces used purely for type tagging without providing any contractual value. In modern languages, use decorators or attributes instead.

## Real-world Examples

### Java's `java.io`
Java's I/O library uses ISP well: `Readable`, `Closeable`, `Flushable`, `Serializable` — each is a focused interface. A `FileInputStream` implements `Closeable` and `Readable`, while a `ByteArrayOutputStream` implements `Closeable` and `Flushable`.

### TypeScript Utility Types
TypeScript's `Partial<T>`, `Pick<T, K>`, `Omit<T, K>`, and `Readonly<T>` are language-level tools for ISP — they let you create focused type subsets from larger types.

### Node.js Streams
Node.js separates streams into `Readable`, `Writable`, `Duplex`, and `Transform` — each with its own focused interface rather than one monolithic `Stream` type.

## Sources

- Martin, R.C. (2003). *Agile Software Development: Principles, Patterns, and Practices*. Prentice Hall.
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall.
- [SOLID Principles (scalastic.io)](https://scalastic.io/en/solid-dry-kiss/)
- [Demystifying Software Development Principles (Level Up Coding)](https://levelup.gitconnected.com/demystifying-software-development-principles-dry-kiss-yagni-solid-grasp-and-lod-8606113c0313)
