# Decorator Pattern

> **Domain:** Fundamentals > Design Patterns > Structural
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Decorator pattern attaches additional responsibilities to an object **dynamically**, providing a flexible alternative to subclassing. Decorators wrap the original object, delegating calls to it while adding behavior before or after.

**GoF Intent:** "Attach additional responsibilities to an object dynamically. Decorators provide a flexible alternative to subclassing for extending functionality."

## How It Works

```typescript
// Component interface
interface Logger {
  log(message: string): void;
}

// Concrete component
class ConsoleLogger implements Logger {
  log(message: string) { console.log(message); }
}

// Decorator base
abstract class LoggerDecorator implements Logger {
  constructor(protected wrapped: Logger) {}
  abstract log(message: string): void;
}

// Concrete decorators
class TimestampDecorator extends LoggerDecorator {
  log(message: string) {
    const timestamp = new Date().toISOString();
    this.wrapped.log(`[${timestamp}] ${message}`);
  }
}

class UpperCaseDecorator extends LoggerDecorator {
  log(message: string) {
    this.wrapped.log(message.toUpperCase());
  }
}

class JsonDecorator extends LoggerDecorator {
  log(message: string) {
    this.wrapped.log(JSON.stringify({ message, level: "INFO" }));
  }
}

// Stack decorators — each wraps the previous
let logger: Logger = new ConsoleLogger();
logger = new TimestampDecorator(logger);
logger = new UpperCaseDecorator(logger);

logger.log("hello");
// [2026-03-06T...] HELLO
```

```python
# Python decorators (language feature) — different but related concept
import functools
import time

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.time() - start:.2f}s")
        return result
    return wrapper

def retry(max_attempts=3):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
        return wrapper
    return decorator

@timer
@retry(max_attempts=3)
def fetch_data(url: str) -> dict:
    return requests.get(url).json()
```

```java
// Java I/O — classic decorator chain
InputStream stream = new BufferedInputStream(         // adds buffering
    new GZIPInputStream(                              // adds decompression
        new FileInputStream("data.gz")                // base component
    )
);
```

### Decorator vs Inheritance

```
Inheritance:                    Decorator:
- Static (compile-time)        - Dynamic (runtime)
- Class explosion              - Composable
- Single axis                  - Stackable

Example: 3 features × 2 bases = 6 subclasses
With decorators: 3 decorators + 2 bases = 5 classes, unlimited combinations
```

## Best Practices

1. **Keep decorators focused** — each decorator should add exactly one responsibility.
2. **Decorators should be stackable** — any order should produce valid behavior.
3. **Use Python's `@decorator` syntax** for function decoration — it's idiomatic.
4. **Consider TypeScript/Python decorators** (`@logged`, `@cached`) for cross-cutting concerns.

## Anti-patterns / Common Mistakes

- **Too many layers** — deeply nested decorators are hard to debug.
- **Order dependency** — if decorators must be applied in a specific order, the design is fragile.
- **Confusing with Proxy** — Proxy controls access; Decorator adds behavior.

## Real-world Examples

- **Java I/O** — `BufferedInputStream`, `DataInputStream`, `GZIPInputStream`.
- **Express.js middleware** — each middleware "decorates" the request/response cycle.
- **TypeScript decorators** — `@Component`, `@Injectable` in Angular.
- **Python decorators** — `@property`, `@staticmethod`, `@lru_cache`.
- **Spring AOP** — `@Transactional`, `@Cacheable` add behavior via proxies/decorators.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 175-184.
- [Refactoring.Guru — Decorator](https://refactoring.guru/design-patterns/decorator)
