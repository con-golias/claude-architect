# Java/Kotlin: Ecosystem

> **Domain:** Languages > Java/Kotlin
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## Ecosystem Overview

The JVM ecosystem is the **largest enterprise ecosystem** in software, with Maven Central hosting 500K+ artifacts. Java/Kotlin power most Fortune 500 backend systems.

## Web Frameworks

### Java Frameworks

| Framework | Type | Performance | Reactive | Learning Curve | Maturity |
|-----------|------|------------|----------|----------------|----------|
| **Spring Boot** | Full-stack, opinionated | Good (~30K req/s) | WebFlux | Medium | Very High |
| **Quarkus** | Cloud-native, GraalVM-first | Excellent (~80K req/s) | Mutiny | Medium | High |
| **Micronaut** | Compile-time DI | Excellent (~75K req/s) | Project Reactor | Medium | High |
| **Vert.x** | Reactive, event-driven | Best (~350K req/s) | Built-in | High | High |
| **Helidon** | Microservices (Oracle) | Very Good | Nima (virtual threads) | Medium | Medium |
| **Jakarta EE** | Enterprise standard | Good | Partial | High | Very High |

### Kotlin Frameworks

| Framework | Type | Key Feature |
|-----------|------|-------------|
| **Ktor** | Async, lightweight | JetBrains official, coroutine-native |
| **Spring Boot + Kotlin** | Full-stack | Official Kotlin support, DSL |
| **Exposed** | SQL framework | Kotlin DSL for SQL |
| **http4k** | Functional HTTP | Immutable, testable, zero-magic |

### Spring Boot Architecture

```
Spring Boot Application
├── Spring Core — IoC container, DI
├── Spring MVC / WebFlux — Web layer
│   ├── MVC: Servlet-based (blocking)
│   └── WebFlux: Reactive (non-blocking)
├── Spring Data — Repository pattern
│   ├── JPA (Hibernate)
│   ├── MongoDB
│   ├── Redis
│   └── R2DBC (reactive SQL)
├── Spring Security — Authentication/Authorization
├── Spring Cloud — Microservices
│   ├── Config Server
│   ├── Service Discovery (Eureka)
│   ├── Circuit Breaker (Resilience4j)
│   ├── Gateway
│   └── Stream (messaging)
└── Spring Actuator — Monitoring, health checks
```

## Build Tools

| Feature | Maven | Gradle (Kotlin DSL) |
|---------|-------|-------------------|
| Config language | XML (pom.xml) | Kotlin/Groovy (build.gradle.kts) |
| Speed | Slower | Faster (incremental, daemon) |
| Flexibility | Convention-over-configuration | Highly scriptable |
| IDE support | Excellent | Excellent |
| Plugin ecosystem | Very large | Large |
| Dependency management | Mature | Mature |
| Build cache | No (local only) | Yes (local + remote) |
| Typical use | Enterprise Java | Android, Kotlin, modern Java |

## Testing Ecosystem

| Tool | Type | Key Feature |
|------|------|-------------|
| **JUnit 5** | Test framework | @Test, @ParameterizedTest, @Nested, extensions |
| **Mockito** | Mocking (Java) | Most popular Java mocking framework |
| **MockK** | Mocking (Kotlin) | Kotlin-idiomatic mocking, coroutine support |
| **Kotest** | Test framework (Kotlin) | Property-based testing, multiple styles |
| **Testcontainers** | Integration testing | Docker containers for databases, services |
| **ArchUnit** | Architecture testing | Verify architectural rules in tests |
| **AssertJ** | Assertions | Fluent, readable assertions |
| **WireMock** | HTTP mocking | Mock external HTTP services |
| **Spring Boot Test** | Integration testing | @SpringBootTest, @WebMvcTest, TestRestTemplate |

## Database

| Library | Type | Key Feature |
|---------|------|-------------|
| **Hibernate** | ORM (JPA) | De facto standard Java ORM |
| **JOOQ** | Type-safe SQL | Generates Java from schema, SQL-first |
| **Spring Data JPA** | Repository pattern | Auto-generated queries from method names |
| **Exposed** | Kotlin SQL | DSL and DAO patterns, JetBrains |
| **MyBatis** | SQL mapper | XML or annotation SQL mapping |
| **Flyway / Liquibase** | Migrations | Database schema versioning |

## Reactive Stack

| Library | Type | Key Feature |
|---------|------|-------------|
| **Project Reactor** | Reactive Streams | Mono/Flux, Spring WebFlux foundation |
| **RxJava** | Reactive Extensions | Observable pattern, widely used |
| **Kotlin Flow** | Kotlin reactive | Cold streams, coroutine-based |
| **Kotlin Channels** | CSP-like | Hot streams, coroutine-based |
| **Mutiny** | Reactive (Quarkus) | Uni/Multi, Quarkus native |

## Android Ecosystem

| Library | Type | Key Feature |
|---------|------|-------------|
| **Jetpack Compose** | UI framework | Declarative UI (replacing XML layouts) |
| **Room** | Database | SQLite abstraction with compile-time checks |
| **Retrofit** | HTTP client | Type-safe REST client |
| **Hilt** | Dependency injection | Android-specific DI (based on Dagger) |
| **Navigation** | Navigation | Type-safe navigation between screens |
| **WorkManager** | Background tasks | Guaranteed execution of background work |
| **DataStore** | Preferences | SharedPreferences replacement |
| **Kotlin Coroutines** | Async | Standard async solution for Android |
| **Compose Multiplatform** | Cross-platform UI | JetBrains — iOS, desktop, web, Android |

## Kotlin Multiplatform (KMP)

```
Kotlin Multiplatform Project
├── commonMain/          # Shared Kotlin code (business logic, models)
├── androidMain/         # Android-specific (Android SDK)
├── iosMain/             # iOS-specific (UIKit/SwiftUI interop)
├── desktopMain/         # Desktop (JVM)
├── wasmJsMain/          # WebAssembly
└── jsMain/              # JavaScript target
```

**KMP use cases**: Share business logic, networking, serialization, and data models across platforms while keeping UI native.

## Monitoring & Observability

| Tool | Type | Key Feature |
|------|------|-------------|
| **Micrometer** | Metrics | Vendor-neutral metrics facade |
| **Spring Actuator** | Health/Metrics | Built-in health checks, endpoints |
| **OpenTelemetry** | Tracing + Metrics | CNCF standard |
| **Java Flight Recorder (JFR)** | Profiling | Low-overhead, production profiling |
| **async-profiler** | CPU/Allocation profiling | Sampling profiler for JVM |

## Maven Central Statistics

| Metric | Value (2025) |
|--------|-------------|
| Total artifacts | ~500K+ |
| Total downloads/year | Billions |
| Most downloaded | SLF4J, Guava, Jackson, Spring, JUnit |
| Build tool split | Maven ~60%, Gradle ~40% |

## Sources

- [Maven Central](https://search.maven.org/) — Package registry
- [Spring.io](https://spring.io/) — Spring ecosystem
- [Kotlin Docs](https://kotlinlang.org/docs/) — Official Kotlin documentation
- [Baeldung](https://www.baeldung.com/) — Java/Spring tutorials
