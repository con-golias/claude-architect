# Multi-Paradigm Languages

> **Domain:** Fundamentals > Programming Paradigms > Multi-Paradigm
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A multi-paradigm language supports **two or more programming paradigms**, letting developers choose the best approach for each problem within the same codebase. Nearly all modern languages are multi-paradigm — they blend OOP, functional, procedural, and concurrent features. The skill lies in knowing **when to use which paradigm**.

## Language Profiles

### JavaScript/TypeScript — OOP + Functional + Event-Driven

```typescript
// OOP — class-based
class UserService {
  constructor(private repo: UserRepository) {}
  async findActive(): Promise<User[]> {
    return this.repo.findAll().then(users => users.filter(u => u.active));
  }
}

// Functional — data transformation pipeline
const processOrders = (orders: Order[]) =>
  orders
    .filter(o => o.status === "completed")
    .map(o => ({ ...o, total: o.items.reduce((s, i) => s + i.price, 0) }))
    .sort((a, b) => b.total - a.total);

// Event-driven — async I/O
app.on("request", async (req, res) => {
  const data = await fetchData(req.query);
  res.json(data);
});
```

### Python — OOP + Functional + Procedural

```python
# Procedural — simple script
data = read_csv("data.csv")
filtered = [r for r in data if r["active"]]
write_csv("output.csv", filtered)

# OOP — domain modeling
class Order:
    def __init__(self, items: list[Item]):
        self.items = items

    @property
    def total(self) -> float:
        return sum(item.price for item in self.items)

# Functional — data pipeline
from functools import reduce
result = reduce(
    lambda acc, x: acc + x,
    map(lambda x: x ** 2, filter(lambda x: x % 2 == 0, range(100)))
)
```

### Rust — Functional + Systems + Concurrent

```rust
// Functional — iterators, closures, pattern matching
let sum: i32 = (1..=100)
    .filter(|n| n % 2 == 0)
    .map(|n| n * n)
    .sum();

// Systems — low-level control, zero-cost abstractions
unsafe {
    let ptr = alloc(Layout::new::<[u8; 1024]>());
    // ...
    dealloc(ptr, Layout::new::<[u8; 1024]>());
}

// Concurrent — async + channels
use tokio::sync::mpsc;
let (tx, mut rx) = mpsc::channel(32);
tokio::spawn(async move {
    tx.send("hello").await.unwrap();
});
let msg = rx.recv().await.unwrap();
```

### Scala — OOP + Functional (Deep Integration)

```scala
// OOP + FP seamlessly combined
case class User(name: String, age: Int)  // immutable product type

trait Printable {
  def prettyPrint: String
}

// Pattern matching on sealed trait (sum type + OOP)
sealed trait Shape extends Printable
case class Circle(radius: Double) extends Shape {
  def prettyPrint = f"Circle(r=$radius%.2f)"
}
case class Rect(w: Double, h: Double) extends Shape {
  def prettyPrint = f"Rect(${w}x$h)"
}

// Functional collection operations
val areas = shapes.collect {
  case Circle(r) => math.Pi * r * r
  case Rect(w, h) => w * h
}

// Actor model concurrency (Akka)
class Counter extends Actor {
  var count = 0
  def receive = {
    case "inc" => count += 1
    case "get" => sender() ! count
  }
}
```

### Kotlin — OOP + FP + Coroutines

```kotlin
// OOP with data classes
data class User(val name: String, val age: Int)

// Functional — extension functions, lambdas
fun List<User>.adults() = filter { it.age >= 18 }
fun List<User>.names() = map { it.name }

val adultNames = users.adults().names().sorted()

// Coroutines — structured concurrency
suspend fun loadDashboard(): Dashboard = coroutineScope {
    val user = async { fetchUser() }
    val stats = async { fetchStats() }
    Dashboard(user.await(), stats.await())
}
```

## Choosing the Right Paradigm

```
Problem                               Best Paradigm
──────────────────────────────────────────────────────
Transform data through pipeline        Functional (map/filter/reduce)
Model a business domain                OOP (classes, encapsulation)
Simple sequential script               Procedural
Handle UI events                       Event-driven
Process concurrent I/O                 Async/coroutines
Distribute across machines             Actor model
Configure infrastructure               Declarative (DSL)
Implement a compiler                   Functional + Visitor pattern
Build a REST API                       OOP (controllers) + FP (transforms)
State machine                          ADTs + pattern matching

Most real-world programs use 2-3 paradigms together.
The best developers choose the right paradigm for each part.
```

## Sources

- Van Roy, P. (2009). [Programming Paradigms for Dummies](https://webperso.info.ucl.ac.be/~pvr/VanRoyChapter.pdf).
- Odersky, M. et al. (2021). *Programming in Scala*. 5th ed. Artima.
- [Kotlin — Multiplatform Programming](https://kotlinlang.org/docs/multiplatform.html)
