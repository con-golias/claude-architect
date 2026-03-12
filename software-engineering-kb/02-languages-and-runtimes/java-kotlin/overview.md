# Java/Kotlin: Overview

> **Domain:** Languages > Java/Kotlin
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## History & Evolution

### Java Timeline

| Year | Version | Key Features |
|------|---------|-------------|
| 1995 | Java 1.0 | James Gosling at Sun Microsystems, "Write Once, Run Anywhere" |
| 2004 | Java 5 | Generics, enums, annotations, autoboxing, enhanced for-loop |
| 2006 | Java 6 | Performance improvements, scripting support |
| 2010 | Oracle acquires Sun | Java under Oracle stewardship |
| 2014 | **Java 8** (LTS) | **Lambdas**, Stream API, Optional, default methods, Date/Time API |
| 2017 | Java 9 | Modules (JPMS), JShell, HTTP/2 client (incubator) |
| 2018 | **Java 11** (LTS) | var in lambdas, HTTP client, Flight Recorder |
| 2019 | Java 12-13 | Switch expressions (preview), text blocks (preview) |
| 2020 | Java 14-15 | Records (preview), sealed classes (preview), helpful NPEs |
| 2021 | **Java 17** (LTS) | Sealed classes, pattern matching instanceof, records (final) |
| 2022 | Java 18-19 | Virtual threads (preview), structured concurrency (preview) |
| 2023 | **Java 21** (LTS) | **Virtual threads** (final), pattern matching for switch, sequenced collections, record patterns |
| 2024 | Java 22-23 | Stream gatherers, unnamed variables, Markdown in Javadoc |
| 2025 | Java 24-25 | Flexible constructor bodies, primitive types in patterns |

**Release cadence**: Every 6 months (March and September), LTS every 2 years.

### Kotlin Timeline

| Year | Event |
|------|-------|
| 2011 | JetBrains announces Kotlin |
| 2016 | **Kotlin 1.0** — stable release |
| 2017 | **Google declares Kotlin first-class for Android** |
| 2018 | Kotlin 1.3 — coroutines stable |
| 2019 | **Google declares Kotlin preferred for Android** |
| 2020 | Kotlin 1.4 — SAM conversions, trailing comma |
| 2021 | Kotlin 1.5-1.6 — value classes, sealed when, Duration API |
| 2022 | Kotlin 1.7-1.8 — K2 compiler (alpha), Kotlin/JS improvements |
| 2023 | Kotlin 1.9-2.0 — K2 compiler (beta/stable), Kotlin Multiplatform stable |
| 2024 | Kotlin 2.0-2.1 — K2 compiler default, context parameters (preview) |

## JVM Architecture

```
Source Code (.java/.kt)
    │
    ▼
  Compiler (javac / kotlinc)
    │
    ▼
  Bytecode (.class files)
    │
    ▼
  JVM (Java Virtual Machine)
    ├── ClassLoader — loads classes on demand
    ├── Interpreter — starts executing bytecode
    ├── JIT Compiler — compiles hot methods to native code
    │   ├── C1 (Client) — fast compilation, moderate optimization
    │   └── C2 (Server) — slow compilation, aggressive optimization
    │   └── Graal — modern JIT, polyglot, profile-guided
    ├── Garbage Collector — automatic memory management
    │   ├── G1 (default since Java 9)
    │   ├── ZGC (ultra-low latency, <1ms pauses)
    │   ├── Shenandoah (Red Hat, concurrent)
    │   └── Serial / Parallel (simple workloads)
    └── Runtime — threading, I/O, native interface (JNI)
```

## Java vs Kotlin Comparison

| Feature | Java 21+ | Kotlin 2.x |
|---------|----------|-----------|
| Null safety | Optional, @Nullable annotations | Built-in (Type vs Type?) |
| Data containers | Records (Java 16+) | Data classes |
| Pattern matching | switch expressions (Java 21) | when expressions |
| Extension functions | No | Yes |
| Coroutines | Virtual threads (platform-level) | Language-level (suspend) |
| Default parameters | No | Yes |
| String templates | String templates (preview, Java 21) | String templates ($variable) |
| Type inference | var (local only, Java 10+) | val/var everywhere |
| Sealed types | sealed classes/interfaces | sealed classes/interfaces |
| Operator overloading | No | Yes |
| Smart casts | Pattern matching instanceof | Built-in |
| Multiplatform | JVM only | JVM, JS, Native, WASM |
| Primary constructors | Yes (Java 22, preview) | Yes (always) |
| Functional interfaces | SAM conversions | SAM + function types |
| Companion objects | Static methods | companion object |

## Key Java Features (17-21+)

```java
// Records — immutable data carriers (Java 16+)
public record Point(double x, double y) {
    // Automatically generates: constructor, equals, hashCode, toString, accessors
}

// Sealed classes — restricted inheritance (Java 17)
public sealed interface Shape permits Circle, Rectangle, Triangle {}
public record Circle(double radius) implements Shape {}
public record Rectangle(double w, double h) implements Shape {}
public record Triangle(double b, double h) implements Shape {}

// Pattern matching for switch (Java 21)
double area(Shape shape) {
    return switch (shape) {
        case Circle c -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.w() * r.h();
        case Triangle t -> 0.5 * t.b() * t.h();
    }; // Exhaustive!
}

// Virtual threads (Java 21) — lightweight threads like goroutines
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 1_000_000).forEach(i ->
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return i;
        })
    );
} // Handles 1M concurrent tasks!

// Structured concurrency (Java 21, preview)
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<User> user = scope.fork(() -> fetchUser(id));
    Subtask<Order> order = scope.fork(() -> fetchOrder(id));
    scope.join().throwIfFailed();
    return new Response(user.get(), order.get());
}
```

## Key Kotlin Features

```kotlin
// Null safety — built into the type system
var name: String = "Hello"     // Cannot be null
var nullableName: String? = null  // Can be null
println(nullableName?.length)    // Safe call — returns null if nullableName is null
println(nullableName?.length ?: 0) // Elvis operator — default if null

// Data classes
data class User(val name: String, val email: String, val age: Int)
val user = User("Alice", "alice@example.com", 30)
val copy = user.copy(age = 31) // Immutable copy with changes

// Extension functions — add methods to existing classes
fun String.isPalindrome(): Boolean = this == this.reversed()
"racecar".isPalindrome() // true

// Coroutines — structured concurrency
suspend fun fetchUserData(): UserData = coroutineScope {
    val profile = async { fetchProfile() }
    val friends = async { fetchFriends() }
    UserData(profile.await(), friends.await())
}

// When expression (exhaustive pattern matching)
fun describe(shape: Shape): String = when (shape) {
    is Circle -> "Circle with radius ${shape.radius}"
    is Rectangle -> "Rectangle ${shape.width}x${shape.height}"
    is Triangle -> "Triangle"
}

// Scope functions
val result = user?.let { processUser(it) } ?: defaultResult
val config = Config().apply {
    host = "localhost"
    port = 8080
    debug = true
}

// Sealed classes
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
}
```

## Project Incubators

| Project | Status | Purpose |
|---------|--------|---------|
| **Loom** | Delivered (Java 21) | Virtual threads, structured concurrency |
| **Amber** | Ongoing | Language features: records, patterns, string templates |
| **Valhalla** | Preview | Value types, primitive generics |
| **Panama** | Delivered (Java 22) | Foreign Function & Memory API (replaces JNI) |
| **Leyden** | Ongoing | Static images, faster startup (like GraalVM native) |

## Sources

- [Oracle Java Documentation](https://docs.oracle.com/en/java/)
- [Kotlin Documentation](https://kotlinlang.org/docs/)
- [JEP Index](https://openjdk.org/jeps/) — Java Enhancement Proposals
- [Inside.java](https://inside.java/) — Official Java blog
- [Kotlin Blog](https://blog.jetbrains.com/kotlin/) — Official Kotlin blog
