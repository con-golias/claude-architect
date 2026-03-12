# Builder Pattern

> **Domain:** Fundamentals > Design Patterns > Creational
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Builder pattern separates the construction of a complex object from its representation, allowing the same construction process to create different representations. It is especially useful when an object has **many optional parameters** or requires a multi-step construction process.

**GoF Intent:** "Separate the construction of a complex object from its representation so that the same construction process can create different representations."

## Why It Matters

- **Eliminates telescoping constructors** — no more constructors with 10+ parameters.
- **Readable construction** — method chaining makes the intent clear.
- **Immutable objects** — build step by step, then freeze.
- **One of the most commonly used patterns** — found in every mature codebase.

## How It Works

### Fluent Builder (Modern Style)

```typescript
class HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string | null;
  readonly timeout: number;

  private constructor(builder: HttpRequestBuilder) {
    this.method = builder.method;
    this.url = builder.url;
    this.headers = { ...builder.headers };
    this.body = builder.body;
    this.timeout = builder.timeout;
  }

  static builder(method: string, url: string): HttpRequestBuilder {
    return new HttpRequestBuilder(method, url);
  }
}

class HttpRequestBuilder {
  method: string;
  url: string;
  headers: Record<string, string> = {};
  body: string | null = null;
  timeout: number = 30000;

  constructor(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;  // enables method chaining
  }

  setBody(body: string): this {
    this.body = body;
    return this;
  }

  setTimeout(ms: number): this {
    this.timeout = ms;
    return this;
  }

  build(): HttpRequest {
    return new HttpRequest(this);
  }
}

// Usage — readable and self-documenting
const request = HttpRequest.builder("POST", "/api/users")
  .setHeader("Content-Type", "application/json")
  .setHeader("Authorization", "Bearer token123")
  .setBody(JSON.stringify({ name: "Alice" }))
  .setTimeout(5000)
  .build();
```

```python
from dataclasses import dataclass, field

@dataclass
class QueryBuilder:
    _table: str = ""
    _columns: list[str] = field(default_factory=lambda: ["*"])
    _conditions: list[str] = field(default_factory=list)
    _order_by: str = ""
    _limit: int | None = None

    def table(self, table: str) -> "QueryBuilder":
        self._table = table
        return self

    def select(self, *columns: str) -> "QueryBuilder":
        self._columns = list(columns)
        return self

    def where(self, condition: str) -> "QueryBuilder":
        self._conditions.append(condition)
        return self

    def order(self, column: str) -> "QueryBuilder":
        self._order_by = column
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit = n
        return self

    def build(self) -> str:
        query = f"SELECT {', '.join(self._columns)} FROM {self._table}"
        if self._conditions:
            query += " WHERE " + " AND ".join(self._conditions)
        if self._order_by:
            query += f" ORDER BY {self._order_by}"
        if self._limit:
            query += f" LIMIT {self._limit}"
        return query

# Usage
sql = (QueryBuilder()
    .table("users")
    .select("name", "email")
    .where("age > 18")
    .where("active = true")
    .order("name")
    .limit(10)
    .build())
# "SELECT name, email FROM users WHERE age > 18 AND active = true ORDER BY name LIMIT 10"
```

```java
// Java — Effective Java style (Bloch)
public class Pizza {
    private final int size;
    private final boolean cheese;
    private final boolean pepperoni;
    private final boolean mushrooms;

    private Pizza(Builder builder) {
        this.size = builder.size;
        this.cheese = builder.cheese;
        this.pepperoni = builder.pepperoni;
        this.mushrooms = builder.mushrooms;
    }

    public static class Builder {
        private final int size;          // required
        private boolean cheese = false;  // optional
        private boolean pepperoni = false;
        private boolean mushrooms = false;

        public Builder(int size) { this.size = size; }

        public Builder cheese()    { this.cheese = true; return this; }
        public Builder pepperoni() { this.pepperoni = true; return this; }
        public Builder mushrooms() { this.mushrooms = true; return this; }

        public Pizza build() { return new Pizza(this); }
    }
}

// Usage
Pizza pizza = new Pizza.Builder(12).cheese().pepperoni().build();
```

## Best Practices

1. **Use when objects have 4+ parameters** — especially with optional ones.
2. **Return `this` from setter methods** — enables fluent method chaining.
3. **Make the built object immutable** — the Builder sets fields, then the constructor freezes them.
4. **Validate in `build()`** — throw if required fields are missing.
5. **Consider Lombok's `@Builder`** (Java) or `@dataclass` (Python) for simple cases.

## Anti-patterns / Common Mistakes

- **Using Builder for simple objects** — 2-3 parameters don't need a builder.
- **Mutable built objects** — defeats the purpose; the constructed object should be immutable.
- **Missing validation** — `build()` should validate required fields.
- **Not providing defaults** — optional parameters should have sensible defaults.

## Real-world Examples

- **`StringBuilder`** (Java) — builds strings efficiently.
- **`HttpRequest.newBuilder()`** (Java 11+) — fluent HTTP request construction.
- **Lombok `@Builder`** — auto-generates builder code from annotations.
- **Protocol Buffers** — `Message.newBuilder()` for all protobuf messages.
- **SQL query builders** — Knex.js, JOOQ, SQLAlchemy query construction.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 97-106.
- Bloch, J. (2018). *Effective Java* (3rd ed.). Item 2: "Consider a builder when faced with many constructor parameters."
- [Refactoring.Guru — Builder](https://refactoring.guru/design-patterns/builder)
