# Rust: Overview

> **Domain:** Languages > Rust
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## History & Evolution

| Year | Event |
|------|-------|
| 2006 | Graydon Hoare starts Rust as personal project at Mozilla |
| 2009 | Mozilla officially sponsors Rust |
| 2012 | First pre-alpha release (0.1) |
| 2015 | **Rust 1.0** — stable release with backward compatibility promise |
| 2018 | Edition 2018 — module system overhaul, NLL (Non-Lexical Lifetimes) |
| 2020 | Foundation discussions begin after Mozilla layoffs |
| 2021 | **Rust Foundation** formed (AWS, Google, Huawei, Microsoft, Mozilla) |
| 2021 | Edition 2021 — closures capture individual fields, IntoIterator for arrays |
| 2022 | Linux kernel accepts Rust (Linux 6.1) |
| 2023 | async fn in traits (stabilized), Return Position Impl Trait (RPIT) in traits |
| 2024 | Edition 2024 — gen blocks, `use<>` lifetime capture rules, unsafe_op_in_unsafe_fn |
| 2025 | Android, Windows kernel components in Rust expanding |

### Most Loved Language
Rust has been the **#1 most loved/admired language** in Stack Overflow surveys for 8 consecutive years (2016-2023), then #1 admired in 2024.

## Design Philosophy

1. **Memory safety without garbage collection**: Ownership system prevents use-after-free, double-free, data races — at compile time
2. **Zero-cost abstractions**: High-level features (iterators, closures, generics) compile to the same assembly as hand-written C
3. **Fearless concurrency**: Type system prevents data races — if it compiles, it's data-race free
4. **Explicitness**: No hidden allocations, no implicit conversions, no null (use `Option<T>`)
5. **Correctness**: Make invalid states unrepresentable through the type system

## Ownership System

The core innovation of Rust — memory safety through compile-time ownership tracking:

### Three Rules

1. Each value has exactly one **owner**
2. When the owner goes out of scope, the value is **dropped** (freed)
3. Values can be **borrowed** (referenced) but borrowing rules must be satisfied

### Borrowing Rules

```rust
// Rule: You can have EITHER:
//   - One mutable reference (&mut T)
//   - Any number of immutable references (&T)
// But NOT both at the same time.

fn main() {
    let mut data = vec![1, 2, 3];

    // Multiple immutable borrows — OK
    let r1 = &data;
    let r2 = &data;
    println!("{r1:?} {r2:?}"); // OK

    // Mutable borrow — OK (r1, r2 no longer used after this point — NLL)
    let r3 = &mut data;
    r3.push(4);
    println!("{r3:?}");

    // This would NOT compile:
    // let r4 = &data;      // immutable borrow
    // let r5 = &mut data;  // mutable borrow — ERROR: cannot borrow as mutable
    // println!("{r4:?}");  // because immutable borrow is still in use
}
```

### Lifetimes

```rust
// Lifetimes ensure references don't outlive the data they point to
fn longest<'a>(s1: &'a str, s2: &'a str) -> &'a str {
    if s1.len() > s2.len() { s1 } else { s2 }
}

// Lifetime elision rules (compiler infers lifetimes):
// 1. Each reference parameter gets its own lifetime
// 2. If there's one input lifetime, it's assigned to all outputs
// 3. If there's &self or &mut self, its lifetime is assigned to outputs
fn first_word(s: &str) -> &str { // Lifetimes elided (rule 2)
    &s[..s.find(' ').unwrap_or(s.len())]
}
```

## Type System

### Algebraic Data Types

```rust
// Sum types (enums) — Rust's most powerful feature
enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
    Triangle { base: f64, height: f64 },
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
        Shape::Rectangle { width, height } => width * height,
        Shape::Triangle { base, height } => 0.5 * base * height,
    } // Exhaustive — compiler forces you to handle all variants
}

// Option<T> — no null!
fn find_user(id: u64) -> Option<User> {
    // Returns Some(user) or None
}

// Result<T, E> — no exceptions!
fn read_file(path: &str) -> Result<String, io::Error> {
    fs::read_to_string(path) // Returns Ok(content) or Err(error)
}
```

### Traits (Interfaces)

```rust
// Trait definition
trait Summary {
    fn summarize(&self) -> String;

    // Default implementation
    fn preview(&self) -> String {
        format!("{}...", &self.summarize()[..50])
    }
}

// Implementation
impl Summary for Article {
    fn summarize(&self) -> String {
        format!("{} by {}", self.title, self.author)
    }
}

// Trait bounds (generics)
fn print_summary(item: &impl Summary) {
    println!("{}", item.summarize());
}

// Or equivalently with where clause:
fn print_summary<T: Summary + Display>(item: &T) { ... }

// Trait objects (dynamic dispatch)
fn print_all(items: &[&dyn Summary]) {
    for item in items {
        println!("{}", item.summarize());
    }
}
```

### Generics (Monomorphization)

```rust
// Generics are monomorphized — zero runtime cost
fn max<T: PartialOrd>(a: T, b: T) -> T {
    if a > b { a } else { b }
}

// Compiler generates specialized versions:
// max::<i32>(a, b) — one version for i32
// max::<f64>(a, b) — another for f64
// Same performance as hand-written specialized functions
```

## Error Handling

```rust
// The ? operator — propagates errors concisely
fn read_config(path: &str) -> Result<Config, Box<dyn Error>> {
    let content = fs::read_to_string(path)?;  // Returns Err if fails
    let config: Config = toml::from_str(&content)?;
    Ok(config)
}

// Custom error types with thiserror
#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("unauthorized")]
    Unauthorized,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
}

// anyhow for applications (when you don't need typed errors)
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let config = read_config("config.toml")
        .context("failed to read configuration")?;
    Ok(())
}
```

## Async Rust

```rust
// async/await — zero-cost futures
async fn fetch_url(url: &str) -> Result<String, reqwest::Error> {
    let body = reqwest::get(url).await?.text().await?;
    Ok(body)
}

// Tokio runtime (most popular)
#[tokio::main]
async fn main() {
    let (r1, r2) = tokio::join!(
        fetch_url("https://api.example.com/users"),
        fetch_url("https://api.example.com/posts"),
    );
    // Both run concurrently
}

// Spawn concurrent tasks
let handle = tokio::spawn(async {
    expensive_computation().await
});
let result = handle.await?;
```

## Macro System

```rust
// Declarative macros (macro_rules!)
macro_rules! vec {
    () => { Vec::new() };
    ($($x:expr),+ $(,)?) => {
        {
            let mut temp = Vec::new();
            $(temp.push($x);)+
            temp
        }
    };
}

// Procedural macros (derive)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct User {
    name: String,
    email: String,
}
// Generates impl Debug, Clone, Serialize, Deserialize automatically
```

## Editions

| Edition | Key Changes |
|---------|-------------|
| 2015 | Original syntax |
| 2018 | NLL, module system overhaul, async/await syntax, `dyn Trait` |
| 2021 | Disjoint capture in closures, IntoIterator for arrays, `#[must_use]` on types |
| 2024 | `gen` blocks, `use<>` for lifetime capture, `unsafe_op_in_unsafe_fn` default |

**Key feature**: Different editions can interoperate in the same project. A library using Edition 2015 works with a binary using Edition 2024.

## Unsafe Rust

```rust
// Unsafe unlocks 5 superpowers:
unsafe {
    // 1. Dereference raw pointers
    let ptr = &value as *const i32;
    let val = *ptr;

    // 2. Call unsafe functions
    libc::printf(c"hello %s\n".as_ptr(), name.as_ptr());

    // 3. Access mutable static variables
    COUNTER += 1;

    // 4. Implement unsafe traits
    // (e.g., Send, Sync)

    // 5. Access union fields
}
// Rule: Encapsulate unsafe behind safe APIs
// ~2-5% of typical Rust codebases use unsafe
```

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/) — "The Book"
- [Rust Reference](https://doc.rust-lang.org/reference/) — Language specification
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/) — Annotated examples
- [Rustlings](https://github.com/rust-lang/rustlings) — Interactive exercises
- [Rust Blog](https://blog.rust-lang.org/) — Official announcements
