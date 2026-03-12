# Rust: Best Practices

> **Domain:** Languages > Rust
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## Ownership & Borrowing Patterns

### Prefer Borrowing Over Cloning

```rust
// ❌ Unnecessary clone
fn process(data: Vec<String>) { /* takes ownership */ }
let data = get_data();
process(data.clone()); // Clones entire vector!
use_data(&data);

// ✅ Borrow instead
fn process(data: &[String]) { /* borrows */ }
let data = get_data();
process(&data); // No clone needed
use_data(&data);
```

### Choose the Right Smart Pointer

| Type | Ownership | Thread-Safe | Heap? | Use When |
|------|-----------|------------|-------|---------|
| `T` | Single owner | N/A | Stack (usually) | Default — own the value |
| `&T` | Borrowed | N/A | No | Read access, no ownership |
| `&mut T` | Mutable borrow | N/A | No | Write access, no ownership |
| `Box<T>` | Single owner | No | Yes | Heap allocation, recursive types |
| `Rc<T>` | Shared ownership | No | Yes | Multiple owners, single thread |
| `Arc<T>` | Shared ownership | Yes | Yes | Multiple owners, multi-thread |
| `RefCell<T>` | Interior mutability | No | No | Runtime borrow checking |
| `Mutex<T>` | Interior mutability | Yes | No | Shared mutable state across threads |
| `RwLock<T>` | Interior mutability | Yes | No | Many readers, few writers |
| `Cow<'a, T>` | Clone-on-write | No | Maybe | Avoid clones when read-only |

## Error Handling

### Library Code: Use thiserror

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("item not found: {id}")]
    NotFound { id: String },

    #[error("duplicate key: {0}")]
    DuplicateKey(String),

    #[error("connection failed")]
    ConnectionFailed(#[source] sqlx::Error),

    #[error("serialization error")]
    Serialization(#[from] serde_json::Error),
}
```

### Application Code: Use anyhow

```rust
use anyhow::{Context, Result, bail, ensure};

fn load_config(path: &str) -> Result<Config> {
    let content = fs::read_to_string(path)
        .context("failed to read config file")?;

    let config: Config = toml::from_str(&content)
        .context("failed to parse config")?;

    ensure!(config.port > 0, "port must be positive");

    if config.api_key.is_empty() {
        bail!("API key is required");
    }

    Ok(config)
}
```

## API Design Patterns

### Builder Pattern

```rust
pub struct ServerConfig {
    host: String,
    port: u16,
    max_connections: usize,
    tls: bool,
}

impl ServerConfig {
    pub fn builder() -> ServerConfigBuilder {
        ServerConfigBuilder::default()
    }
}

#[derive(Default)]
pub struct ServerConfigBuilder {
    host: Option<String>,
    port: Option<u16>,
    max_connections: Option<usize>,
    tls: Option<bool>,
}

impl ServerConfigBuilder {
    pub fn host(mut self, host: impl Into<String>) -> Self {
        self.host = Some(host.into());
        self
    }
    pub fn port(mut self, port: u16) -> Self {
        self.port = Some(port);
        self
    }
    pub fn build(self) -> Result<ServerConfig, &'static str> {
        Ok(ServerConfig {
            host: self.host.unwrap_or_else(|| "localhost".to_string()),
            port: self.port.ok_or("port is required")?,
            max_connections: self.max_connections.unwrap_or(100),
            tls: self.tls.unwrap_or(false),
        })
    }
}

// Usage
let config = ServerConfig::builder()
    .host("0.0.0.0")
    .port(8080)
    .build()?;
```

### Newtype Pattern

```rust
// Prevent mixing up types with same underlying type
struct UserId(u64);
struct OrderId(u64);

fn get_user(id: UserId) -> User { ... }
fn get_order(id: OrderId) -> Order { ... }

// get_user(OrderId(123)); // Compile error!
get_user(UserId(456)); // OK
```

### Typestate Pattern

```rust
// Encode state transitions in the type system
struct Draft;
struct Published;

struct Post<State> {
    title: String,
    content: String,
    _state: std::marker::PhantomData<State>,
}

impl Post<Draft> {
    fn new(title: String) -> Self { ... }
    fn publish(self) -> Post<Published> { ... } // Consumes Draft, returns Published
}

impl Post<Published> {
    fn url(&self) -> String { ... } // Only available on published posts
}

// post.url(); // Compile error on Draft!
// let published = post.publish();
// published.url(); // OK!
```

## Trait Design

```rust
// Accept generic types with trait bounds
fn serialize_to_file(data: &impl Serialize, path: &Path) -> Result<()> { ... }

// Use trait objects for heterogeneous collections
fn process_handlers(handlers: Vec<Box<dyn Handler>>) { ... }

// Blanket implementations
impl<T: Display> ToString for T {
    fn to_string(&self) -> String {
        format!("{self}")
    }
}

// Extension traits for adding methods to external types
trait IteratorExt: Iterator {
    fn take_while_inclusive<P>(self, predicate: P) -> TakeWhileInclusive<Self, P>
    where Self: Sized, P: FnMut(&Self::Item) -> bool;
}
impl<I: Iterator> IteratorExt for I { ... }
```

## Async Best Practices

```rust
// 1. Use select! for concurrent operations with cancellation
tokio::select! {
    result = fetch_data() => handle_data(result),
    _ = tokio::signal::ctrl_c() => {
        println!("Shutting down...");
        return;
    }
    _ = tokio::time::sleep(Duration::from_secs(30)) => {
        println!("Timeout!");
        return;
    }
}

// 2. Use channels for communication between tasks
let (tx, mut rx) = tokio::sync::mpsc::channel(100);
tokio::spawn(async move {
    while let Some(msg) = rx.recv().await {
        process(msg).await;
    }
});

// 3. Structured concurrency with JoinSet
let mut set = tokio::task::JoinSet::new();
for url in urls {
    set.spawn(async move { fetch(url).await });
}
while let Some(result) = set.join_next().await {
    handle(result??);
}
```

## Testing

```rust
// Unit tests — in the same file
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }

    #[test]
    #[should_panic(expected = "division by zero")]
    fn test_divide_by_zero() {
        divide(1, 0);
    }

    // Async tests (with tokio)
    #[tokio::test]
    async fn test_fetch_user() {
        let user = fetch_user(1).await.unwrap();
        assert_eq!(user.name, "Alice");
    }
}

// Integration tests — in tests/ directory
// tests/integration_test.rs
use my_crate::Server;

#[tokio::test]
async fn test_full_workflow() {
    let server = Server::start().await;
    let client = reqwest::Client::new();
    let resp = client.get(&format!("{}/health", server.url())).send().await.unwrap();
    assert_eq!(resp.status(), 200);
}

// Property-based testing with proptest
proptest! {
    #[test]
    fn test_sort_is_stable(mut v: Vec<i32>) {
        v.sort();
        assert!(v.windows(2).all(|w| w[0] <= w[1]));
    }
}

// Snapshot testing with insta
#[test]
fn test_serialization() {
    let user = User { name: "Alice".into(), age: 30 };
    insta::assert_json_snapshot!(user);
}
```

## Project Structure

```
my-project/
├── Cargo.toml
├── Cargo.lock
├── src/
│   ├── lib.rs           # Library root (public API)
│   ├── main.rs          # Binary entrypoint
│   ├── config.rs        # Module
│   ├── error.rs         # Error types
│   ├── handlers/        # Directory module
│   │   ├── mod.rs       # (or use handlers.rs at parent level)
│   │   ├── users.rs
│   │   └── posts.rs
│   └── models/
│       ├── mod.rs
│       └── user.rs
├── tests/               # Integration tests
│   └── api_test.rs
├── benches/             # Benchmarks
│   └── benchmark.rs
└── examples/            # Example programs
    └── basic.rs
```

## Clippy Lints

```toml
# Cargo.toml
[lints.clippy]
# Deny categories
pedantic = { level = "warn" }
nursery = { level = "warn" }

# Individual lints
unwrap_used = "warn"      # Prefer ? or expect()
expect_used = "warn"       # In library code
dbg_macro = "warn"         # Remove debug macros
todo = "warn"              # Don't ship TODOs
```

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| `.unwrap()` everywhere | Panics in production | `?` operator, `.expect("reason")` |
| `.clone()` to satisfy borrow checker | Performance waste, hides design issues | Restructure ownership, use references |
| `Arc<Mutex<T>>` as default | Overhead, potential deadlocks | Use channels, restructure ownership |
| String for all text | Unnecessary allocations | Use `&str`, `Cow<str>` where possible |
| `Box<dyn Error>` in libraries | Loses type information | thiserror for typed errors |
| Ignoring Clippy warnings | Missing improvements | `#![warn(clippy::pedantic)]` |

## Sources

- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/) — Official API design
- [Rust Design Patterns](https://rust-unofficial.github.io/patterns/) — Pattern catalog
- [Clippy Lints](https://rust-lang.github.io/rust-clippy/master/) — All lints
- [Error Handling in Rust](https://blog.burntsushi.net/rust-error-handling/) — Andrew Gallant
