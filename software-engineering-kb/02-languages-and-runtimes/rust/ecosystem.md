# Rust: Ecosystem

> **Domain:** Languages > Rust
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## Ecosystem Overview

Rust's ecosystem is centered on **crates.io** (150K+ crates) and excels in systems programming, WebAssembly, CLI tools, and high-performance web services. The ecosystem is younger than Go/Java but growing rapidly.

## Web Frameworks

| Framework | Style | Performance (req/s) | Async Runtime | Key Feature |
|-----------|-------|-------------------|---------------|-------------|
| **Actix Web** | Actor-based | ~400K | Tokio | Highest TechEmpower scores |
| **Axum** | Tower-based | ~350K | Tokio | From Tokio team, composable |
| **Rocket** | Macro-based | ~250K | Tokio (0.5+) | Developer ergonomics, fairings |
| **Warp** | Filter-based | ~320K | Tokio | Composable filters |
| **Poem** | Attribute macros | ~300K | Tokio | Simple, OpenAPI built-in |
| **Salvo** | Macro-based | ~350K | Tokio | OpenAPI, middleware |

### Axum Example (Recommended for New Projects)

```rust
use axum::{Router, Json, extract::{Path, State}};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct User { id: u64, name: String }

async fn get_user(
    State(db): State<Arc<Database>>,
    Path(id): Path<u64>,
) -> Result<Json<User>, AppError> {
    let user = db.find_user(id).await?;
    Ok(Json(user))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/users/{id}", axum::routing::get(get_user))
        .with_state(Arc::new(Database::new().await));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

## Async Runtimes

| Runtime | Focus | Work Stealing | IO Driver | Used By |
|---------|-------|--------------|-----------|---------|
| **Tokio** | General purpose | Yes | mio (epoll/kqueue/IOCP) | Axum, Actix, most crates |
| **async-std** | Stdlib-like API | Yes | async-io | Alternative to Tokio |
| **smol** | Minimal | No | async-io | Embedded, small apps |
| **glommio** | Thread-per-core (io_uring) | No | io_uring | Maximum I/O perf |

## Serialization — Serde

Serde is Rust's **de facto serialization framework**, used by almost every Rust project:

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(default = "default_port")]
    port: u16,
    #[serde(rename = "databaseUrl")]
    database_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    api_key: Option<String>,
}

fn default_port() -> u16 { 8080 }

// Works with: serde_json, toml, serde_yaml, bincode, postcard, ciborium, rmp, etc.
```

## Database

| Library | Type | Async | Compile-Time Checked | Focus |
|---------|------|-------|---------------------|-------|
| **SQLx** | Query builder | Yes | Yes (macros check SQL at compile time!) | PostgreSQL, MySQL, SQLite |
| **Diesel** | ORM | No (async WIP) | Yes (schema types) | Type-safe ORM, migrations |
| **SeaORM** | ORM | Yes | Partial | ActiveRecord-style, DynamicQuery |
| **rusqlite** | SQLite binding | No | No | Lightweight SQLite |
| **tokio-postgres** | PostgreSQL driver | Yes | No | Low-level, performant |

### SQLx — Compile-Time SQL Verification

```rust
// SQL is checked against the database AT COMPILE TIME
let user = sqlx::query_as!(
    User,
    "SELECT id, name, email FROM users WHERE id = $1",
    user_id
)
.fetch_one(&pool)
.await?;
// If the SQL is wrong or columns don't match, it won't compile!
```

## Error Handling Ecosystem

| Crate | Purpose | Best For |
|-------|---------|---------|
| **thiserror** | Derive Error trait | Library authors (typed errors) |
| **anyhow** | Flexible error handling | Application code (any error) |
| **eyre** | Enhanced error reporting | Applications with context |
| **color-eyre** | Colorful error reports | User-facing applications |
| **miette** | Diagnostic errors | Compilers, linters (shows code spans) |

## CLI & TUI

| Crate | Type | Key Feature |
|-------|------|-------------|
| **clap** | CLI argument parser | Derive macros, completions, most popular |
| **indicatif** | Progress bars | Multi-bar, spinners, templates |
| **dialoguer** | Interactive prompts | Select, input, confirm, password |
| **console** | Terminal utilities | Colors, emoji, terminal size |
| **ratatui** | TUI framework | Immediate-mode terminal UI |
| **crossterm** | Terminal manipulation | Cross-platform terminal control |

## Systems & Embedded

| Domain | Key Crates/Projects |
|--------|-------------------|
| **OS development** | Redox OS, Theseus OS |
| **Linux kernel** | Rust for Linux (merged in 6.1) |
| **Embedded** | embedded-hal, cortex-m, esp-rs (ESP32) |
| **WebAssembly** | wasm-bindgen, wasm-pack, trunk, leptos |
| **Networking** | tokio, quinn (QUIC), rustls (TLS), trust-dns |
| **Cryptography** | ring, rustls, dalek-cryptography |

## GUI & Desktop

| Framework | Paradigm | Maturity | Platforms |
|-----------|----------|----------|-----------|
| **Tauri** | Web + Rust backend | Production | Windows, macOS, Linux, mobile |
| **egui** | Immediate mode | Mature | All (also WebAssembly) |
| **Dioxus** | React-like | Growing | Web, desktop, mobile, TUI |
| **Slint** | Declarative (QML-like) | Production | Embedded, desktop |
| **Iced** | Elm architecture | Growing | Windows, macOS, Linux |
| **Leptos** | React-like (web) | Growing | Web (SSR + client) |

## FFI (Foreign Function Interface)

| Tool | Direction | Purpose |
|------|-----------|---------|
| **bindgen** | C → Rust | Generate Rust bindings from C headers |
| **cbindgen** | Rust → C | Generate C headers from Rust |
| **PyO3** | Rust → Python | Write Python extensions in Rust |
| **Neon** | Rust → Node.js | Write Node.js native modules in Rust |
| **uniffi** | Rust → Mobile | Kotlin/Swift bindings (Mozilla) |
| **cxx** | Rust ↔ C++ | Safe C++ interop |

## Notable Projects Written in Rust

| Project | Category | Replaces/Competes With |
|---------|----------|----------------------|
| **ripgrep (rg)** | Search | grep, ag |
| **fd** | File finding | find |
| **bat** | File viewing | cat |
| **exa/eza** | File listing | ls |
| **delta** | Git diff | diff |
| **zoxide** | Directory jumping | cd, autojump |
| **starship** | Shell prompt | oh-my-zsh prompt |
| **Alacritty** | Terminal | iTerm, Terminal |
| **Wezterm** | Terminal | iTerm, Terminal |
| **Zed** | Code editor | VS Code, Sublime |
| **SWC** | JS/TS compiler | Babel |
| **Biome** | JS linter/formatter | ESLint + Prettier |
| **Ruff** | Python linter | flake8, pylint |
| **uv** | Python package manager | pip, poetry |
| **Turbopack** | JS bundler | webpack |
| **Deno** | JS runtime | Node.js (partially Rust) |
| **Nushell** | Shell | bash, zsh |
| **Firecracker** | MicroVM | QEMU (AWS Lambda) |
| **Servo** | Browser engine | Blink, WebKit |

## Cargo Ecosystem

| Subcommand | Purpose |
|-----------|---------|
| `cargo clippy` | Advanced linting (500+ lints) |
| `cargo fmt` | Code formatting (rustfmt) |
| `cargo miri` | Undefined behavior detection in unsafe code |
| `cargo expand` | Show macro expansion |
| `cargo deny` | Dependency audit (licenses, security, duplicates) |
| `cargo flamegraph` | Performance profiling |
| `cargo nextest` | Faster test runner |
| `cargo bench` | Benchmarking |
| `cargo doc` | Documentation generation |
| `cargo audit` | Security vulnerability scanning |

## Crates.io Statistics

| Metric | Value (2025) |
|--------|-------------|
| Total crates | ~150K+ |
| Total downloads | 60B+ |
| Most downloaded | serde, serde_json, rand, syn, quote, proc-macro2 |
| Growth rate | ~30K new crates/year |
| Quality trend | High — cargo clippy, fmt, test built into culture |

## Sources

- [crates.io](https://crates.io) — Package registry
- [lib.rs](https://lib.rs) — Better crate search and categorization
- [Awesome Rust](https://github.com/rust-unofficial/awesome-rust) — Curated list
- [Are We Web Yet?](https://www.arewewebyet.org/) — Web framework tracking
- [Are We Game Yet?](https://arewegameyet.rs/) — Game dev tracking
- [Are We GUI Yet?](https://areweguiyet.com/) — GUI framework tracking
