# Singleton Pattern

> **Domain:** Fundamentals > Design Patterns > Creational
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

The Singleton pattern ensures that a class has **exactly one instance** and provides a global point of access to it. It is the simplest and most controversial of the GoF patterns — easy to implement but often misused.

**GoF Intent:** "Ensure a class only has one instance, and provide a global point of access to it."

## Why It Matters

- **Controlled access to a shared resource** — database connections, thread pools, configuration.
- **Lazy initialization** — the instance is created only when first requested.
- **Guaranteed single instance** — prevents duplicate resource allocation.

## How It Works

### Classic Implementation

```typescript
class Database {
  private static instance: Database;
  private connection: Connection;

  private constructor() {
    this.connection = createConnection();  // expensive operation
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  query(sql: string): Result {
    return this.connection.execute(sql);
  }
}

// Usage
const db1 = Database.getInstance();
const db2 = Database.getInstance();
// db1 === db2  → true (same instance)
```

```python
class Database:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._connection = create_connection()
        return cls._instance

# Usage
db1 = Database()
db2 = Database()
assert db1 is db2  # same instance
```

```java
// Thread-safe with double-checked locking
public class Database {
    private static volatile Database instance;

    private Database() { /* expensive setup */ }

    public static Database getInstance() {
        if (instance == null) {
            synchronized (Database.class) {
                if (instance == null) {
                    instance = new Database();
                }
            }
        }
        return instance;
    }
}

// Preferred: Enum singleton (thread-safe, serialization-safe)
public enum Database {
    INSTANCE;

    public void query(String sql) { /* ... */ }
}
```

### Module-Level Singleton (Python/TypeScript)

In Python and TypeScript, modules are natural singletons:

```python
# config.py — module itself is a singleton
_settings = load_settings()

def get(key: str):
    return _settings[key]
```

```typescript
// config.ts — ES module is evaluated once
const settings = loadSettings();
export const getConfig = (key: string) => settings[key];
```

## Best Practices

1. **Prefer dependency injection over singletons** — inject the instance rather than calling `getInstance()`.
2. **Use module-level singletons** in Python/TypeScript — simpler and more idiomatic.
3. **Use `enum` singletons in Java** — thread-safe, serialization-safe, reflection-proof.
4. **Make singletons stateless when possible** — reduces testing complexity.
5. **Consider if you truly need "only one"** — often you need "one per context," not a global singleton.

## Anti-patterns / Common Mistakes

- **Global mutable state** — singletons that hold mutable state are hard to test and debug.
- **Hidden dependencies** — `Database.getInstance()` throughout code creates invisible coupling.
- **Difficult to test** — hard to mock or substitute; use DI to inject the instance instead.
- **Thread safety issues** — lazy initialization without synchronization causes race conditions.
- **Violates Single Responsibility** — the class manages both its business logic and its lifecycle.

## Real-world Examples

- **Spring Framework** — all Spring beans are singletons by default (within the container scope).
- **Java Runtime** — `Runtime.getRuntime()` returns the singleton JVM runtime.
- **Python `logging`** — `logging.getLogger(name)` returns the same logger for the same name.
- **Database connection pools** — HikariCP, c3p0 maintain a single pool instance.
- **Configuration managers** — application-wide configuration loaded once.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 127-134.
- [Refactoring.Guru — Singleton](https://refactoring.guru/design-patterns/singleton)
- Bloch, J. (2018). *Effective Java* (3rd ed.). Item 3: "Enforce the singleton property with a private constructor or an enum type."
