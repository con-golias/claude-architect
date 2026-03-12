# Java/Kotlin: Best Practices

> **Domain:** Languages > Java/Kotlin
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## Modern Java (17+)

### Records for Data

```java
// Records replace verbose POJOs
public record User(String name, String email, int age) {
    // Compact constructor for validation
    public User {
        if (age < 0) throw new IllegalArgumentException("age must be >= 0");
        email = email.toLowerCase();
    }
}

var user = new User("Alice", "Alice@Example.com", 30);
user.name();     // "Alice"
user.email();    // "alice@example.com"
// equals, hashCode, toString auto-generated
```

### Sealed Classes + Pattern Matching

```java
public sealed interface Result<T> {
    record Success<T>(T value) implements Result<T> {}
    record Failure<T>(String error) implements Result<T> {}
}

String describe(Result<?> result) {
    return switch (result) {
        case Result.Success<?> s -> "Got: " + s.value();
        case Result.Failure<?> f -> "Error: " + f.error();
    };
}
```

### Virtual Threads

```java
// Before: Platform threads (expensive, ~1MB each)
ExecutorService executor = Executors.newFixedThreadPool(200);

// After: Virtual threads (lightweight, ~1KB each)
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    // Can handle millions of concurrent tasks
    futures = urls.stream()
        .map(url -> executor.submit(() -> fetchUrl(url)))
        .toList();
}

// Simple per-request threading
Thread.startVirtualThread(() -> handleRequest(request));
```

## Kotlin Idioms

### Scope Functions

```kotlin
// let — transform nullable, execute block
val length = name?.let { it.length } ?: 0

// apply — configure object (returns object)
val textView = TextView(context).apply {
    text = "Hello"
    textSize = 16f
    setTextColor(Color.BLACK)
}

// run — execute block on object (returns result)
val result = service.run {
    connect()
    fetchData()
}

// also — side effects (returns object)
val user = createUser().also { logger.info("Created: $it") }

// with — operate on object (returns result)
val description = with(user) {
    "Name: $name, Age: $age"
}
```

### Coroutines Best Practices

```kotlin
// Structured concurrency — parent waits for all children
suspend fun fetchDashboard(userId: String): Dashboard = coroutineScope {
    val profile = async { profileService.get(userId) }
    val orders = async { orderService.list(userId) }
    val recommendations = async { recService.get(userId) }

    Dashboard(profile.await(), orders.await(), recommendations.await())
    // If any fails, all are cancelled
}

// Dispatchers
withContext(Dispatchers.IO) { /* blocking I/O */ }
withContext(Dispatchers.Default) { /* CPU-intensive */ }
withContext(Dispatchers.Main) { /* UI updates (Android) */ }

// Flow — reactive streams
fun observePrices(): Flow<Price> = flow {
    while (true) {
        emit(fetchPrice())
        delay(1000)
    }
}.flowOn(Dispatchers.IO)
 .distinctUntilChanged()
 .catch { e -> emit(Price.ERROR) }
```

## Error Handling

### Java

```java
// Prefer specific exceptions
public User findUser(String id) throws UserNotFoundException {
    return repository.findById(id)
        .orElseThrow(() -> new UserNotFoundException(id));
}

// Sealed exception hierarchies
public sealed class AppException extends RuntimeException {
    public static final class NotFound extends AppException { ... }
    public static final class Unauthorized extends AppException { ... }
    public static final class Conflict extends AppException { ... }
}
```

### Kotlin

```kotlin
// Result type (stdlib)
fun divide(a: Int, b: Int): Result<Int> = runCatching {
    require(b != 0) { "Division by zero" }
    a / b
}

val result = divide(10, 0)
result.getOrNull()     // null
result.getOrDefault(0) // 0
result.onSuccess { println("Result: $it") }
      .onFailure { println("Error: ${it.message}") }

// Sealed class error modeling
sealed class AppError {
    data class NotFound(val id: String) : AppError()
    data class Validation(val errors: Map<String, String>) : AppError()
    data object Unauthorized : AppError()
}

fun getUser(id: String): Either<AppError, User> { ... }
```

## Dependency Injection

```java
// Spring DI (constructor injection — recommended)
@Service
public class UserService {
    private final UserRepository repository;
    private final EmailService emailService;

    // @Autowired not needed with single constructor (Spring 4.3+)
    public UserService(UserRepository repository, EmailService emailService) {
        this.repository = repository;
        this.emailService = emailService;
    }
}
```

```kotlin
// Kotlin with Spring
@Service
class UserService(
    private val repository: UserRepository,
    private val emailService: EmailService,
) { ... }

// Koin (lightweight Kotlin DI)
val appModule = module {
    single { UserRepository(get()) }
    single { UserService(get(), get()) }
    viewModel { UserViewModel(get()) }
}
```

## Testing Patterns

```java
// JUnit 5 + Testcontainers
@Testcontainers
class UserRepositoryTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Test
    void shouldFindUserById() {
        var user = repository.findById(1L);
        assertThat(user).isPresent();
        assertThat(user.get().getName()).isEqualTo("Alice");
    }

    @ParameterizedTest
    @ValueSource(strings = {"alice@example.com", "bob@test.com"})
    void shouldValidateEmails(String email) {
        assertThat(User.isValidEmail(email)).isTrue();
    }
}
```

```kotlin
// Kotest (Kotlin-idiomatic testing)
class UserServiceTest : FunSpec({
    val mockRepo = mockk<UserRepository>()
    val service = UserService(mockRepo)

    test("should find user by id") {
        coEvery { mockRepo.findById(1) } returns User("Alice", "alice@test.com")

        val user = service.getUser(1)

        user.name shouldBe "Alice"
        coVerify { mockRepo.findById(1) }
    }

    context("validation") {
        withData(
            "alice@example.com" to true,
            "invalid" to false,
            "" to false,
        ) { (email, valid) ->
            User.isValidEmail(email) shouldBe valid
        }
    }
})
```

## JVM Tuning Essentials

```bash
# Key JVM flags
-Xms512m -Xmx2g          # Initial/max heap size
-XX:+UseZGC               # Use ZGC (lowest latency)
-XX:+UseG1GC              # Use G1 (balanced, default)
-XX:MaxGCPauseMillis=100  # Target GC pause time
-XX:+UseStringDeduplication # Reduce String memory
-XX:+UseCompressedOops    # Compress object pointers (default <32GB heap)

# GraalVM Native Image
native-image --no-fallback -jar myapp.jar
# Result: native binary, ~10ms startup, ~50MB memory (vs 200MB+ JVM)
```

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| Checked exceptions for everything | Forces catch-or-declare everywhere | Unchecked exceptions + Result types |
| Null everywhere | NPE is #1 Java bug | Optional, @Nullable annotations, Kotlin null safety |
| God classes | Violation of SRP, hard to test | Smaller, focused classes |
| Service locator | Hidden dependencies, hard to test | Constructor injection |
| Mutable DTOs with setters | Thread-unsafe, error-prone | Records (Java), data classes (Kotlin) |
| Over-abstraction (AbstractSingletonProxyFactoryBean) | Enterprise complexity | YAGNI — keep it simple |
| Ignoring Java 17+ features | Missing modern syntax | Records, sealed classes, pattern matching |

## Sources

- [Effective Java](https://www.oreilly.com/library/view/effective-java/9780134686097/) — Joshua Bloch
- [Kotlin in Action](https://www.manning.com/books/kotlin-in-action) — Dmitry Jemerov
- [Spring Boot Reference](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Baeldung](https://www.baeldung.com/) — Java tutorials
