# Type Systems & Language Feature Comparison

> **Domain:** Languages & Runtimes > Comparison Matrices
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-07

---

## What It Is

A comprehensive comparison of type systems, error handling paradigms, and memory management models across major programming languages. The type system is arguably the most important design decision in a programming language — it determines how many bugs the compiler catches before code ever runs.

---

## Why It Matters

**Type systems prevent bugs.** The question is: when do you find them?

| Discovery Time | Cost to Fix | Example |
|---|---|---|
| **Compile time** (types) | Cheapest | Rust: `Option<T>` prevents null pointer at compile time |
| **Test time** (unit tests) | Low | Python: test catches `None` being passed as string |
| **Review time** (code review) | Medium | Reviewer catches logic error |
| **Production** (runtime crash) | Very expensive | JavaScript: `undefined is not a function` at 3 AM |

Strong type systems shift bug detection **left** — earlier in the development cycle where fixes are cheapest.

---

## Type System Dimensions

### 1. Static vs Dynamic Typing

**Static**: Types are checked at compile time. Code that violates type constraints doesn't compile.

**Dynamic**: Types are checked at runtime. Code runs until it hits a type error.

| Static | Dynamic |
|---|---|
| Rust, Go, Java, Kotlin, C#, TypeScript, Swift, Dart, C, C++, Zig | Python, Ruby, PHP, JavaScript, Elixir, Clojure, Lua |

**Gradual typing** bridges the gap — adding optional type annotations to dynamic languages:
- **TypeScript**: JavaScript with static types (structural, gradual)
- **Python**: Type hints (PEP 484) + MyPy/Pyright/Pyre checkers
- **PHP**: Type declarations (since PHP 7/8) + PHPStan/Psalm
- **Ruby**: RBS type signatures + Sorbet type checker

**The spectrum (weak → strong static typing):**
```
C → Go → Java → C# → Kotlin → TypeScript → Dart → Rust → Haskell
     ↑          ↑              ↑              ↑         ↑
  minimal     nominal       null-safe    structural   ADTs +
  type        generics      nullable     inference    ownership
  safety      type-erased   types        flow-based
```

### 2. Nominal vs Structural Typing

**Nominal**: Types are compatible only if they have the same name/declaration. Two types with identical structure but different names are incompatible.

**Structural**: Types are compatible if they have the same shape/structure, regardless of name.

| Nominal | Structural | Mixed |
|---|---|---|
| Java, C#, Kotlin, Swift, Rust, Dart | TypeScript, Go (interfaces), OCaml, Elm | Scala (nominal + structural) |

```typescript
// TypeScript (structural) — this WORKS
interface Printable { print(): void }
class Document { print(): void { /* ... */ } }
function printAll(items: Printable[]) { /* ... */ }
printAll([new Document()])  // Document is Printable because it has print()
```

```java
// Java (nominal) — this FAILS
interface Printable { void print(); }
class Document { public void print() { /* ... */ } }
// Document does NOT implement Printable even though it has print()
// Must explicitly: class Document implements Printable
```

**Go interfaces**: Structurally typed but for interfaces only. Any type that has the methods defined by an interface implicitly satisfies it — no `implements` keyword needed.

### 3. Null Safety — The Billion Dollar Mistake

Tony Hoare, inventor of null references (1965): *"I call it my billion-dollar mistake."*

| Language | Null Safety | Mechanism | Severity |
|---|---|---|---|
| **Rust** | Full | `Option<T>` — no null keyword exists; must pattern match or unwrap | Compile-time enforced |
| **Kotlin** | Full | `T` (non-null) vs `T?` (nullable); compiler enforces null checks | Compile-time enforced |
| **Swift** | Full | `T` (non-null) vs `T?` (optional); `if let`, `guard let` unwrapping | Compile-time enforced |
| **Dart** | Full (sound) | `T` (non-null) vs `T?` (nullable); sound null safety since 2.12 | Compile-time enforced |
| **C#** | Good | Nullable reference types (C# 8+); `T` vs `T?`; warnings by default | Compile-time warnings (opt-in errors) |
| **TypeScript** | Good | `strictNullChecks`; `T \| null \| undefined` | Compile-time (if strict mode enabled) |
| **Java** | Poor | `Optional<T>` (library-level); `@Nullable`/`@NonNull` annotations | Runtime NullPointerException |
| **Go** | Poor | Zero values + nil; no Option type | Runtime nil pointer panic |
| **Python** | None | `Optional[T]` type hint + MyPy; runtime None | Runtime AttributeError |
| **Ruby** | None | NilClass; no type checking | Runtime NoMethodError |
| **PHP** | Poor | Nullable types `?T` (PHP 7.1+); still easy to get null errors | Runtime TypeError |
| **C/C++** | None | Null pointers; undefined behavior on dereference | Crash, security vulnerability, UB |
| **Elixir** | None | `nil` atom; pattern matching helps | Runtime MatchError |

**Impact data:**
- NullPointerException is the #1 runtime exception in Java applications
- ~50% of all TypeScript bugs are caught by `strictNullChecks` alone
- Kotlin's null safety eliminated entire categories of crash reports in Android apps

### 4. Generics

How languages handle parameterized types:

| Language | Generics | Implementation | Limitations |
|---|---|---|---|
| **Rust** | Full (monomorphized) | Generates specialized code for each type at compile time | Longer compile times; binary bloat |
| **C++** | Templates (monomorphized) | Similar to Rust but more complex (SFINAE, concepts since C++20) | Error messages are notoriously bad |
| **C#** | Reified | Runtime knows generic type parameters | Full reflection support; boxing for value types |
| **Kotlin** | Declaration-site variance + reified inline | JVM: type-erased; reified in inline functions | Type erasure on JVM; reified only in inline |
| **Java** | Type-erased | Generic type info removed at compile time | No `new T()`, no `T.class`, no primitive generics |
| **Swift** | Full (specialized + witness tables) | Specializes when possible; protocol witness tables for dynamic dispatch | Some limitations with associated types |
| **TypeScript** | Structural + conditional + mapped | Compile-time only; erased in JavaScript output | Complex type gymnastics possible but hard to read |
| **Go** | Since 1.18 (2022) | Monomorphized (GC shapes dictionary approach) | Simple by design; no higher-kinded types; no operator constraints |
| **Dart** | Reified | Runtime type information preserved | Simpler than C# but full generic support |
| **Python** | Type hints only (PEP 484) | No runtime enforcement; MyPy checks | Purely optional; runtime is still dynamic |
| **Elixir** | N/A | Dynamic typing; @spec typespecs | Dialyzer does optional checking |

**Java type erasure problem:**
```java
// This DOESN'T WORK in Java:
<T> T create() { return new T(); }         // Can't instantiate generic type
List<int> nums;                             // Can't use primitives (must use Integer)
if (obj instanceof List<String>) { }       // Can't check generic type at runtime
```

**Rust monomorphization:**
```rust
fn max<T: Ord>(a: T, b: T) -> T { if a >= b { a } else { b } }
// Compiler generates:
// fn max_i32(a: i32, b: i32) -> i32 { ... }
// fn max_string(a: String, b: String) -> String { ... }
// Zero runtime overhead — exactly like hand-written specialized functions
```

### 5. Algebraic Data Types (ADTs) & Sum Types

ADTs allow representing "a value that is one of several possible variants" — critical for exhaustive pattern matching.

| Language | Mechanism | Exhaustive Matching |
|---|---|---|
| **Rust** | `enum` with data variants | Yes (compiler enforces) |
| **Haskell** | `data` declarations | Yes |
| **Kotlin** | `sealed class` / `sealed interface` | Yes (`when` expression) |
| **Swift** | `enum` with associated values | Yes (`switch`) |
| **TypeScript** | Discriminated unions (`type A = B \| C`) | Yes (with `never` check) |
| **Java 17+** | `sealed` classes + `record` + pattern matching | Yes (preview; stabilizing) |
| **Dart 3** | `sealed class` | Yes (`switch` expression) |
| **C#** | Pattern matching + records (partial ADTs) | Partial (no sealed hierarchies like Kotlin) |
| **Go** | Interfaces (no true sum types) | No |
| **Python** | `Union[A, B]` type hints | No (runtime only) |
| **C/C++** | Tagged unions (manual), `std::variant` (C++17) | No compiler enforcement |

```rust
// Rust ADT — compiler forces handling all variants
enum Shape {
    Circle(f64),           // radius
    Rectangle(f64, f64),   // width, height
    Triangle(f64, f64, f64), // three sides
}

fn area(s: &Shape) -> f64 {
    match s {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle(w, h) => w * h,
        Shape::Triangle(a, b, c) => { /* Heron's formula */ },
        // If you add a new variant and forget a case, compilation FAILS
    }
}
```

### 6. Pattern Matching

| Language | Pattern Matching | Power Level |
|---|---|---|
| **Rust** | `match`, `if let`, `while let`, `let else` | Most powerful; exhaustive; destructuring; guards |
| **Haskell** | Case expressions, function definitions | Most powerful; deep matching |
| **Elixir** | `case`, `cond`, function clause matching, `with` | Very powerful; used everywhere in Elixir |
| **Kotlin** | `when` expression, destructuring | Good; exhaustive with sealed types |
| **Swift** | `switch`, `if case`, `guard case` | Good; value binding; exhaustive with enums |
| **C#** | Switch expressions (C# 8+), property patterns, relational patterns | Good and improving rapidly |
| **Java 21+** | Pattern matching in `switch`, `instanceof`, record patterns | Good; catching up quickly |
| **Python 3.10+** | `match`/`case` (structural pattern matching) | Decent; not exhaustive |
| **Dart 3** | Switch expressions, sealed class patterns | Good; exhaustive with sealed |
| **TypeScript** | Switch + narrowing (no built-in match) | Manual; discriminated union pattern |
| **Go** | Type switch (limited) | Minimal |

### 7. Type Inference

| Language | Inference Level | Mechanism | Examples |
|---|---|---|---|
| **Haskell** | Full (Hindley-Milner) | Global type inference; rarely need annotations | `map (+1) [1,2,3]` — all types inferred |
| **Rust** | Strong (HM-based + local) | Infers most local types; function signatures explicit | `let v: Vec<_> = (0..10).collect();` |
| **Kotlin** | Strong (local + smart casts) | `val x = 42` (Int inferred); smart casts from `is` checks | `if (x is String) x.length` — no cast needed |
| **Swift** | Strong (bidirectional) | Infers types from context in both directions | `let x = [1, 2, 3]` — Array<Int> inferred |
| **TypeScript** | Strong (flow analysis) | Flow-based narrowing; contextual typing; control flow analysis | `if (typeof x === "string")` narrows type |
| **C#** | Good (var + target-typed) | `var` for locals; target-typed `new()` (C# 9) | `var x = new Dictionary<string, int>()` |
| **Dart** | Good (local) | Type inferred from initialization; flow analysis | `var x = 42;` — int inferred |
| **Go** | Limited (`:=` only) | Short variable declaration infers from right side | `x := 42` — int inferred; no generics inference |
| **Java** | Limited (`var` since 10) | Local variable type inference only | `var list = new ArrayList<String>();` |
| **Python** | None (dynamic) | N/A (types checked by external tools) | MyPy infers from assignment context |

### 8. Variance (Covariance, Contravariance, Invariance)

Variance determines whether `List<Dog>` is a subtype of `List<Animal>`.

| Language | Declaration-Site | Use-Site | Notes |
|---|---|---|---|
| **Kotlin** | `out T` (covariant), `in T` (contravariant) | `out`/`in` at use site too | Most elegant solution |
| **C#** | `out T`, `in T` on interfaces | N/A | Similar to Kotlin |
| **Java** | N/A | `? extends T` (covariant), `? super T` (contravariant) | PECS: Producer Extends, Consumer Super |
| **Rust** | Variance inferred by compiler | N/A | Automatic based on usage in struct fields |
| **TypeScript** | Structural typing handles most cases | N/A | `in`/`out` modifiers added in TS 4.7 |
| **Dart** | Covariant by default (unsound!) | `covariant` keyword | Dart made a pragmatic but unsound choice |
| **Swift** | Generic types are invariant | N/A | Protocols with associated types provide flexibility |
| **Go** | Invariant (no subtyping) | N/A | No inheritance, no variance needed |

---

## Error Handling Comparison

### The Major Paradigms

#### 1. Exceptions (try/catch/throw)
**Languages:** Java, Python, C#, Ruby, PHP, Dart, Kotlin, JavaScript/TypeScript

```java
// Java — checked exception
public String readFile(String path) throws IOException {
    return Files.readString(Path.of(path));  // throws IOException
}
// Caller MUST handle or propagate
```

**Pros:** Familiar, well-understood, can carry rich error context
**Cons:**
- Invisible control flow (any function can throw)
- Performance cost (stack unwinding)
- Checked exceptions are controversial (Java-specific debate)
- In TypeScript/Python: no way to know what a function throws

#### 2. Result/Either Types (Algebraic error handling)
**Languages:** Rust (`Result<T, E>`), Haskell (`Either a b`), Kotlin (`Result<T>`), Elm (`Result`), OCaml, F#

```rust
// Rust — compiler FORCES you to handle errors
fn read_file(path: &str) -> Result<String, io::Error> {
    fs::read_to_string(path)  // Returns Result, not exception
}

// Caller must handle
match read_file("config.json") {
    Ok(content) => process(content),
    Err(e) => eprintln!("Error: {}", e),
}

// Or use ? operator for propagation
fn load_config() -> Result<Config, io::Error> {
    let content = fs::read_to_string("config.json")?;  // propagates error
    Ok(parse(content))
}
```

**Pros:** Explicit, compile-time enforced, composable, zero-cost
**Cons:** More verbose; requires pattern matching; learning curve

#### 3. Error Values (Multi-return)
**Languages:** Go

```go
// Go — explicit error as second return value
func readFile(path string) (string, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return "", fmt.Errorf("reading %s: %w", path, err)
    }
    return string(data), nil
}
```

**Pros:** Extremely simple; no hidden control flow; easy to read
**Cons:** Verbose (`if err != nil` everywhere); easy to ignore error (just `_`)

#### 4. "Let it crash" + Supervisors
**Languages:** Erlang, Elixir (OTP)

```elixir
# Elixir — if something goes wrong, the process crashes
# The supervisor automatically restarts it
defmodule Worker do
  def process(data) do
    result = dangerous_operation(data)  # If this crashes, supervisor handles it
    {:ok, result}
  end
end
```

**Pros:** Extremely resilient; clean separation of happy path from error recovery
**Cons:** Not suitable for all domains; requires understanding OTP patterns

#### 5. Optional/Maybe (Null-safe error handling)
**Languages:** Rust (`Option<T>`), Swift (`Optional<T>`), Kotlin (`T?`), Haskell (`Maybe a`), Java (`Optional<T>`)

Used when a value may or may not exist (not for errors with details):

```swift
// Swift optional chaining
let name: String? = user?.profile?.displayName
// nil propagates silently; no NullPointerException possible
```

### Error Handling Summary Matrix

| Language | Primary | Mechanism | Compile-Time Safety | Ergonomics |
|---|---|---|---|---|
| **Rust** | Result<T, E> + Option<T> | `?` operator, pattern matching | Full | Good (with `?`) |
| **Go** | Error values | `(T, error)` multi-return | None (can ignore error) | Verbose but clear |
| **Elixir** | Let it crash + tuples | `{:ok, v}` / `{:error, r}` | None | Elegant with `with` |
| **Kotlin** | Unchecked exceptions + Result | try/catch; .getOrElse() | Partial (null safety helps) | Good |
| **Java** | Checked + unchecked exceptions | try/catch/finally; Optional | Checked are enforced | Verbose |
| **C#** | Unchecked exceptions | try/catch; Result pattern growing | None | Good |
| **TypeScript** | Untyped exceptions | try/catch; neverthrow library | None | Poor (no typed throws) |
| **Swift** | Typed throws (Swift 2+) | do/try/catch; optionals | Good (throws is in signature) | Good |
| **Python** | Exceptions (EAFP) | try/except/finally | None | Pythonic |
| **Dart** | Exceptions | try/catch/finally | None | Standard |

---

## Memory Management Models

### 1. Manual Memory Management
**Languages:** C, C++ (optional via raw pointers)

- **Allocate**: `malloc()` / `new`
- **Free**: `free()` / `delete`
- **Responsibility**: Entirely on the programmer
- **Risks**: Memory leaks, use-after-free, double-free, buffer overflow
- **Performance**: Maximum (no overhead)

### 2. RAII (Resource Acquisition Is Initialization)
**Languages:** C++ (smart pointers), Rust (ownership), Zig (defer)

- Resources are tied to object lifetimes
- When an object goes out of scope, its resources are automatically freed
- No GC needed; deterministic destruction
- C++: `unique_ptr`, `shared_ptr`, `weak_ptr`
- Rust: ownership system (move semantics by default)

### 3. Ownership + Borrow Checker (Rust-specific)
**Only:** Rust

Rules enforced at compile time:
1. Each value has exactly one owner
2. When the owner goes out of scope, the value is dropped (freed)
3. You can have either one mutable reference OR any number of immutable references (never both)

**Result:** Memory safety without GC; zero runtime overhead; no data races

### 4. Tracing Garbage Collection
**Languages:** Java, C#, Go, Kotlin, Dart, JavaScript, Python (partially), Ruby, PHP, Elixir (per-process)

| Language | GC Type | Pause Characteristics |
|---|---|---|
| **Java (ZGC)** | Concurrent, region-based | <1 ms pauses (target) |
| **Java (G1GC)** | Generational, concurrent | 5-50 ms typical |
| **Go** | Concurrent, tri-color mark-sweep | <0.5 ms (since 1.19) |
| **C# (.NET 8)** | Generational, concurrent | 1-10 ms typical |
| **Elixir (BEAM)** | Per-process generational | <1 ms (per process; no global stop) |
| **JavaScript (V8)** | Generational, incremental | 1-10 ms |
| **Dart** | Generational | 1-10 ms |
| **Ruby** | Mark-compact (Ruby 3.2+) | 10-100 ms |
| **Python** | Reference counting + cycle collector | 10-100 ms for cycle collection |

### 5. Reference Counting (ARC)
**Languages:** Swift (ARC), Objective-C (ARC), Python (primary GC), Rust (Rc/Arc), Nim (ARC/ORC)

- Each object tracks how many references point to it
- When count reaches zero, object is freed immediately
- **Pro**: Deterministic destruction; no pauses
- **Con**: Cannot handle reference cycles (need weak references or cycle collector)
- **Swift ARC overhead**: ~10-20% CPU overhead from retain/release (measured by Apple)

### 6. Arena/Region-Based Allocation
**Languages:** Zig (explicit allocators), C (manual), Go (upcoming arena package)

- Allocate many objects into a single memory region
- Free the entire region at once (no individual frees)
- Extremely fast allocation; O(1) deallocation of everything
- Used in compilers, game engines, request-scoped web servers

---

## Higher-Kinded Types and Advanced Type Features

### Higher-Kinded Types (HKTs)

The ability to abstract over type constructors (like `List`, `Option`, `Future`), not just types.

| Language | HKTs | Notes |
|---|---|---|
| **Haskell** | Full | `class Functor f where fmap :: (a -> b) -> f a -> f b` |
| **Scala** | Full | Type lambdas, higher-kinded type parameters |
| **Rust** | No (workarounds via GATs) | GATs (Generic Associated Types, stabilized 2022) provide some power |
| **Kotlin** | No (Arrow library provides HKT simulation) | Partial simulation via defunctionalization |
| **TypeScript** | No (but type-level programming is very powerful) | Template literal types + conditional types can simulate |
| **Go** | No | Explicitly rejected for simplicity |
| **Java** | No | Would require massive JVM changes |
| **Swift** | No | Some proposals in discussion |
| **C#** | No | "Shapes" proposal under discussion |

**Why it matters:** Without HKTs, you can't write a generic `map` function that works over `List`, `Option`, `Future`, etc. You need to write separate implementations for each container type.

### Intersection & Union Types

| Language | Union Types | Intersection Types |
|---|---|---|
| **TypeScript** | `A \| B` (discriminated unions) | `A & B` |
| **Haskell** | Sum types via ADTs | Product types |
| **Rust** | `enum` (sum types) | Trait composition (`T: A + B`) |
| **Kotlin** | Sealed classes | No true intersection; interface composition |
| **Python** | `Union[A, B]` / `A \| B` (3.10+) | No |
| **Ceylon** | Yes | Yes |

---

## Language Feature Comparison Matrix

| Feature | Rust | Kotlin | Swift | TypeScript | Go | Java | C# | Python | Dart |
|---|---|---|---|---|---|---|---|---|---|
| **Null Safety** | Full | Full | Full | Strict mode | No | Partial | Good | No | Full |
| **Generics** | Monomorphized | Type-erased | Specialized | Structural | Basic | Type-erased | Reified | Hints only | Reified |
| **Pattern Matching** | Excellent | Good | Good | Manual | Minimal | Good (21+) | Good | Decent (3.10+) | Good (3) |
| **ADTs/Sum Types** | Excellent | Sealed classes | Enums + assoc | Disc. unions | No | Sealed (17+) | Partial | No | Sealed (3) |
| **Type Inference** | Strong | Strong | Strong | Strong | Limited | Limited | Good | N/A | Good |
| **Error Handling** | Result<T,E> | Exceptions | do/try/catch | Exceptions | Error values | Exceptions | Exceptions | Exceptions | Exceptions |
| **Memory Model** | Ownership | GC (JVM) | ARC | GC (V8) | GC | GC (JVM) | GC (CLR) | RC + GC | GC |
| **Immutability** | Default | val/var | let/var | const/let | Somewhat | final | readonly | Convention | final |
| **Concurrency Safety** | Compile-time | Coroutines | Actors | Single-thread | Race detector | Locks | Locks | GIL | Isolates |
| **Variance** | Inferred | out/in | Invariant | Structural | N/A | Wildcards | out/in | N/A | Covariant |
| **Macros/Metaprog** | Procedural macros | KSP/compiler plugins | N/A | Decorators (limited) | go:generate | Annotation processing | Source generators | Decorators | N/A |

---

## Sources

1. **Benjamin Pierce:** "Types and Programming Languages" (2002, MIT Press) — foundational type theory
2. **Tony Hoare:** "Null References: The Billion Dollar Mistake" (QCon 2009 keynote)
3. **TypeScript Design Goals** — github.com/microsoft/TypeScript/wiki/TypeScript-Design-Goals
4. **Rust Reference:** Type system documentation — doc.rust-lang.org/reference
5. **Go Generics Proposal** — go.googlesource.com/proposal/+/refs/heads/master/design/43651-type-parameters.md
6. **Kotlin documentation:** Null safety, sealed classes, coroutines
7. **Swift Evolution:** Proposals for concurrency, types, actors
8. **Java JEP Index:** Pattern matching, sealed classes, records, virtual threads
9. **Philip Wadler:** "Propositions as Types" (2015) — Curry-Howard correspondence
10. **Bob Nystrom:** "What Color is Your Function?" (2015)
11. **Alexis King:** "Parse, don't validate" (2019) — type-driven design
12. **Scott Wlaschin:** "Domain Modeling Made Functional" — F#/ML algebraic types
