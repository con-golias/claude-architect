# Decorators and Annotations

> **Domain:** Fundamentals > Programming Paradigms > Metaprogramming
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

**Decorators** wrap functions or classes to modify their behavior without changing their source code. **Annotations** attach metadata to code elements (classes, methods, fields) that frameworks read at compile time or runtime. Both provide a declarative way to add cross-cutting concerns like logging, caching, validation, and dependency injection.

## How It Works

### Python Decorators

```python
import functools
import time
from typing import Callable, TypeVar

T = TypeVar("T", bound=Callable)

# Basic decorator — wraps a function
def timer(func: T) -> T:
    @functools.wraps(func)  # preserve original function metadata
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

@timer
def process_data(data: list) -> list:
    return sorted(data)

# Decorator with arguments
def retry(max_attempts: int = 3, delay: float = 1.0):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    time.sleep(delay)
        return wrapper
    return decorator

@retry(max_attempts=5, delay=2.0)
def fetch_api(url: str) -> dict:
    return requests.get(url).json()

# Stacking decorators (order matters: bottom-up)
@timer
@retry(max_attempts=3)
def fetch_data(url: str):
    return requests.get(url).json()
# Equivalent to: timer(retry(max_attempts=3)(fetch_data))

# Class decorator
def singleton(cls):
    instances = {}
    @functools.wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

@singleton
class Database:
    def __init__(self, url: str):
        self.url = url
```

### TypeScript/JavaScript Decorators

```typescript
// TypeScript decorators (Stage 3 proposal, widely used with experimentalDecorators)

// Method decorator — logging
function Log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`${key}(${args.join(", ")})`);
    const result = original.apply(this, args);
    console.log(`${key} returned:`, result);
    return result;
  };
}

// Property decorator — validation
function MinLength(min: number) {
  return function (target: any, key: string) {
    let value: string;
    Object.defineProperty(target, key, {
      get: () => value,
      set: (newVal: string) => {
        if (newVal.length < min) throw new Error(`${key} must be >= ${min} chars`);
        value = newVal;
      },
    });
  };
}

class User {
  @MinLength(3)
  name: string;

  @Log
  updateEmail(email: string): boolean {
    this.email = email;
    return true;
  }
}

// NestJS — decorators define the entire application structure
@Controller("users")
class UserController {
  @Get(":id")
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, type: UserDto })
  async getUser(@Param("id") id: string): Promise<UserDto> {
    return this.userService.findById(id);
  }
}
```

### Java Annotations

```java
// Java — annotations attach metadata, processed by frameworks

// Built-in annotations
@Override                          // compile-time check
@Deprecated(since = "2.0")         // compiler warning
@SuppressWarnings("unchecked")     // suppress warning
@FunctionalInterface               // enforce single abstract method

// Spring Framework annotations
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired                     // dependency injection
    private UserService userService;

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    @Cacheable("users")            // cache the result
    public User getUser(@PathVariable String id) {
        return userService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Validated                      // enable validation
    public User createUser(@Valid @RequestBody CreateUserDto dto) {
        return userService.create(dto);
    }
}

// JPA annotations — ORM mapping
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, unique = true)
    @Email
    private String email;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Order> orders;
}

// Custom annotation
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
    int maxRequests() default 100;
    int windowSeconds() default 60;
}
```

### Decorators vs Annotations

```
Feature          Python Decorators     Java Annotations      TS Decorators
────────────────────────────────────────────────────────────────────────
Mechanism        Function wrapping     Metadata attachment    Both
Execution        Runtime               Compile/runtime        Runtime
Modifies code?   Yes (wraps)           No (metadata only)     Yes (wraps)
Framework req?   No                    Yes (processor)        Often (NestJS)
Syntax           @decorator            @Annotation            @decorator
```

## Real-world Examples

- **Flask/FastAPI** — `@app.get("/path")` route decorators.
- **pytest** — `@pytest.fixture`, `@pytest.mark.parametrize`.
- **Spring** — `@Component`, `@Service`, `@Repository`, `@Autowired`.
- **NestJS** — `@Controller`, `@Injectable`, `@Get`, `@Post`.
- **Angular** — `@Component`, `@Input`, `@Output`, `@Injectable`.
- **Java Hibernate** — `@Entity`, `@Table`, `@Column`, `@ManyToOne`.
- **C# ASP.NET** — `[HttpGet]`, `[Authorize]`, `[FromBody]`.

## Sources

- [PEP 318 — Decorators for Functions and Methods](https://peps.python.org/pep-0318/)
- [TC39 — Decorators Proposal](https://github.com/tc39/proposal-decorators)
- [Java Annotations Tutorial](https://docs.oracle.com/javase/tutorial/java/annotations/)
