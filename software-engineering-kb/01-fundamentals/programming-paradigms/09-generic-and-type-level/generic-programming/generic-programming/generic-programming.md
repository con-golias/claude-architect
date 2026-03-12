# Generic Programming

> **Domain:** Fundamentals > Programming Paradigms > Generic & Type-Level
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Generic programming enables writing code that works with **any type** while maintaining type safety. Instead of duplicating code for each type (`sortInts`, `sortStrings`), you write one generic version (`sort<T>`) that the compiler specializes for each use. Generics are the primary mechanism for building reusable, type-safe collections, algorithms, and abstractions.

## How It Works

```typescript
// TypeScript — generics
function identity<T>(value: T): T {
  return value;
}
identity<string>("hello");  // type: string
identity(42);               // type inferred as number

// Generic interface
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  findAll(): Promise<T[]>;
}

class UserRepo implements Repository<User> {
  async findById(id: string): Promise<User | null> { /* ... */ }
  async save(user: User): Promise<User> { /* ... */ }
  async findAll(): Promise<User[]> { /* ... */ }
}

// Constrained generics — T must have certain properties
interface HasId { id: string; }

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// Utility types built with generics
type Partial<T> = { [P in keyof T]?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Record<K extends string, T> = { [P in K]: T };
```

```java
// Java — generics with type erasure
public class Pair<A, B> {
    private final A first;
    private final B second;

    public Pair(A first, B second) {
        this.first = first;
        this.second = second;
    }

    public <C> Pair<C, B> mapFirst(Function<A, C> fn) {
        return new Pair<>(fn.apply(first), second);
    }
}

// Bounded generics
public static <T extends Comparable<T>> T max(List<T> list) {
    return list.stream().max(Comparator.naturalOrder()).orElseThrow();
}

// Wildcard types
public static double sum(List<? extends Number> numbers) {
    return numbers.stream().mapToDouble(Number::doubleValue).sum();
}
```

```rust
// Rust — generics with trait bounds (monomorphized at compile time)
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut max = &list[0];
    for item in &list[1..] {
        if item > max { max = item; }
    }
    max
}

// Multiple trait bounds
fn print_sorted<T: Clone + Ord + std::fmt::Display>(items: &[T]) {
    let mut sorted = items.to_vec();
    sorted.sort();
    for item in sorted {
        println!("{}", item);
    }
}

// Generic struct with trait bounds
struct Cache<K: Hash + Eq, V: Clone> {
    store: HashMap<K, V>,
}

impl<K: Hash + Eq, V: Clone> Cache<K, V> {
    fn get(&self, key: &K) -> Option<V> {
        self.store.get(key).cloned()
    }
}
```

### Monomorphization vs Type Erasure

```
Monomorphization (Rust, C++):
  Compiler generates separate code for each concrete type
  sort::<i32>() → sort_i32()
  sort::<String>() → sort_string()
  + Zero runtime overhead (static dispatch)
  - Larger binary size, longer compile times

Type Erasure (Java, Go):
  Single compiled version works for all types
  Generic types erased at runtime (Java: List<String> → List)
  + Smaller binary, faster compilation
  - Runtime casts, no generic type info at runtime
  - Can't do: new T() or T.class in Java
```

## Real-world Examples

- **Standard libraries** — `Array<T>`, `Map<K,V>`, `Promise<T>` in every typed language.
- **React** — `useState<T>()`, `useRef<T>()`, generic component props.
- **Java Collections** — `List<T>`, `Map<K,V>`, `Optional<T>`, `Stream<T>`.
- **Rust** — `Vec<T>`, `Option<T>`, `Result<T,E>`, `HashMap<K,V>`.
- **Go generics** (1.18+) — `slices.Sort[T]`, generic data structures.

## Sources

- Stepanov, A. & McJones, P. (2009). *Elements of Programming*. Addison-Wesley.
- [TypeScript Handbook — Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [Rust Book — Generic Types](https://doc.rust-lang.org/book/ch10-01-syntax.html)
