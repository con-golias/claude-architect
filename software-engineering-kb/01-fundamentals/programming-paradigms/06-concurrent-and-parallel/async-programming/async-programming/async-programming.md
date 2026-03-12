# Async Programming

> **Domain:** Fundamentals > Programming Paradigms > Concurrent & Parallel
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Async programming enables **non-blocking execution** of I/O-bound operations. Instead of a thread waiting idle for a network response or file read, async code yields control to other tasks and resumes when the result is ready. This allows a single thread to handle thousands of concurrent operations efficiently.

**Evolution:** Callbacks → Promises → async/await (syntactic sugar over Promises).

## How It Works

### The Evolution in JavaScript/TypeScript

```typescript
// 1. CALLBACKS — the original async pattern (1995+)
function fetchUser(id: string, callback: (err: Error | null, user?: User) => void) {
  http.get(`/api/users/${id}`, (res) => {
    callback(null, JSON.parse(res.body));
  });
}

// Callback hell — deeply nested, hard to read
fetchUser("1", (err, user) => {
  fetchOrders(user.id, (err, orders) => {
    fetchProducts(orders[0].productId, (err, product) => {
      console.log(product.name);  // 3 levels deep!
    });
  });
});

// 2. PROMISES — chainable, composable (ES2015)
function fetchUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`).then(res => res.json());
}

fetchUser("1")
  .then(user => fetchOrders(user.id))
  .then(orders => fetchProducts(orders[0].productId))
  .then(product => console.log(product.name))
  .catch(err => console.error("Failed:", err));

// 3. ASYNC/AWAIT — synchronous-looking async code (ES2017)
async function getProductName(userId: string): Promise<string> {
  const user = await fetchUser(userId);
  const orders = await fetchOrders(user.id);
  const product = await fetchProducts(orders[0].productId);
  return product.name;
}

// Parallel execution with Promise.all
async function loadDashboard(userId: string) {
  const [user, notifications, stats] = await Promise.all([
    fetchUser(userId),
    fetchNotifications(userId),
    fetchStats(userId),
  ]);
  return { user, notifications, stats };
}
```

### Python asyncio

```python
import asyncio
import aiohttp

async def fetch_json(session: aiohttp.ClientSession, url: str) -> dict:
    async with session.get(url) as response:
        return await response.json()

async def main():
    async with aiohttp.ClientSession() as session:
        # Sequential — one after another
        user = await fetch_json(session, "https://api.example.com/user/1")
        orders = await fetch_json(session, f"https://api.example.com/orders?user={user['id']}")

        # Parallel — all at once
        urls = [f"https://api.example.com/product/{o['product_id']}" for o in orders]
        products = await asyncio.gather(*[fetch_json(session, url) for url in urls])

        return products

asyncio.run(main())

# Async generator — stream processing
async def read_large_file(path: str):
    async with aiofiles.open(path) as f:
        async for line in f:
            yield line.strip()

async def process():
    async for line in read_large_file("data.csv"):
        await process_line(line)
```

### Rust — tokio async runtime

```rust
use tokio;
use reqwest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Concurrent requests
    let (users, products) = tokio::join!(
        reqwest::get("https://api.example.com/users"),
        reqwest::get("https://api.example.com/products"),
    );

    let users: Vec<User> = users?.json().await?;
    let products: Vec<Product> = products?.json().await?;

    println!("{} users, {} products", users.len(), products.len());
    Ok(())
}
```

### Event Loop Architecture

```
Node.js Event Loop:

    ┌───────────────────────────┐
 ┌─→│         timers            │  setTimeout, setInterval
 │  └───────────┬───────────────┘
 │  ┌───────────┴───────────────┐
 │  │     pending callbacks     │  I/O callbacks
 │  └───────────┬───────────────┘
 │  ┌───────────┴───────────────┐
 │  │       poll (I/O)          │  incoming connections, data, etc.
 │  └───────────┬───────────────┘
 │  ┌───────────┴───────────────┐
 │  │         check             │  setImmediate
 │  └───────────┬───────────────┘
 │  ┌───────────┴───────────────┐
 └──│    close callbacks        │  socket.on('close', ...)
    └───────────────────────────┘

Single thread handles 10,000+ concurrent connections
by never blocking — all I/O is async.
```

### Async Patterns Comparison

```
Pattern         Readability    Error Handling    Composability
──────────────────────────────────────────────────────────────
Callbacks       Poor           Error-first cb     Difficult
Promises        Good           .catch()           .then() chains
async/await     Excellent      try/catch          await + variables
Observables     Good           .catchError()      Operators (RxJS)
```

## Real-world Examples

- **Node.js** — single-threaded async I/O handles millions of requests.
- **Python FastAPI/aiohttp** — async web frameworks for high-throughput APIs.
- **Rust tokio/async-std** — zero-cost async for systems programming.
- **C# `async`/`await`** — first mainstream language to adopt async/await (2012).
- **Kotlin coroutines** — structured concurrency with `suspend` functions.

## Sources

- [MDN — Asynchronous JavaScript](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous)
- [Python asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [Tokio — Asynchronous Rust](https://tokio.rs/tokio/tutorial)
