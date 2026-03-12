# Server Framework Comparison & Selection

> **AI Plugin Directive — Backend Framework Selection, Architecture Comparison & Decision Guide**
> You are an AI coding assistant. When recommending, comparing, or setting up backend frameworks,
> follow EVERY rule in this document. Framework choice affects years of development. Choose based
> on requirements, team skills, and ecosystem maturity. Treat each section as non-negotiable.

**Core Rule: ALWAYS choose the framework that matches your team's primary language expertise. ALWAYS prefer frameworks with strong typing support. ALWAYS consider ecosystem maturity (ORMs, auth libraries, testing tools). NEVER choose a framework based on benchmarks alone — developer productivity matters more than raw throughput for most applications.**

---

## 1. Framework Comparison Matrix

| Feature | Express (Node) | Fastify (Node) | Gin (Go) | Fiber (Go) | Spring Boot (Java) | ASP.NET Core (C#) | Django (Python) | FastAPI (Python) |
|---------|---------------|----------------|----------|-----------|--------------------|--------------------|-----------------|------------------|
| **Language** | TypeScript/JS | TypeScript/JS | Go | Go | Java/Kotlin | C#/F# | Python | Python |
| **Type** | Minimalist | Performance | Minimalist | Express-like | Full-featured | Full-featured | Full-featured | Minimalist |
| **Performance** | Medium | High | Very High | Very High | High | Very High | Low-Medium | Medium-High |
| **Type safety** | With TS | With TS | Built-in | Built-in | Built-in | Built-in | Optional (mypy) | Built-in (Pydantic) |
| **Learning curve** | Low | Low | Medium | Low | High | Medium | Medium | Low |
| **Async model** | Event loop | Event loop | Goroutines | Goroutines | Virtual threads | async/await | ASGI (async) | ASGI (async) |
| **ORM ecosystem** | Prisma, Drizzle, TypeORM | Same as Express | GORM, sqlc, Ent | Same as Gin | Hibernate, Spring Data | EF Core | Django ORM | SQLAlchemy, Tortoise |
| **Auth ecosystem** | Passport, next-auth | Same as Express | Custom/Casbin | Custom/Casbin | Spring Security | Identity | django-allauth | FastAPI Users |
| **Testing** | Jest, Vitest, Supertest | Same + Fastify inject | testing, testify | Same as Gin | JUnit, MockMvc | xUnit, TestServer | pytest, Django Test | pytest, httpx |
| **API docs** | Manual/Swagger-jsdoc | Auto-generated | swaggo | swagger | SpringDoc OpenAPI | Swashbuckle | DRF OpenAPI | Auto-generated |
| **Deployment** | Docker, serverless | Docker, serverless | Single binary | Single binary | JAR/Docker | Single binary/Docker | Docker, PaaS | Docker, serverless |
| **Best for** | Rapid prototyping, JS teams | Performance Node apps | Microservices, CLI | Node devs learning Go | Enterprise, complex domains | Enterprise, Microsoft stack | Admin panels, content | Modern Python APIs |
| **Companies** | PayPal, Netflix, Uber | Fastify.io, NearForm | Google, Uber | Varied | Netflix, Alibaba | Microsoft, Stack Overflow | Instagram, Spotify | Microsoft, Netflix |

---

## 2. Decision Framework

```
┌──────────────────────────────────────────────────────────────┐
│              Framework Selection Decision Tree                │
│                                                               │
│  What is your team's primary language?                       │
│  │                                                           │
│  ├── TypeScript/JavaScript                                  │
│  │   ├── Need maximum performance? → Fastify                │
│  │   ├── Largest ecosystem/community? → Express             │
│  │   ├── Full-stack with Next.js? → Express/Fastify         │
│  │   └── Real-time heavy? → Fastify + Socket.IO            │
│  │                                                           │
│  ├── Go                                                     │
│  │   ├── Microservices? → Gin (or net/http)                │
│  │   ├── Coming from Express? → Fiber                      │
│  │   ├── Maximum control? → net/http (stdlib)              │
│  │   └── gRPC services? → gRPC + Gin for REST             │
│  │                                                           │
│  ├── Java/Kotlin                                            │
│  │   ├── Enterprise with complex domain? → Spring Boot     │
│  │   ├── Microservices focus? → Spring Boot + Cloud        │
│  │   ├── Reactive/non-blocking? → Spring WebFlux           │
│  │   └── Lightweight? → Quarkus or Micronaut               │
│  │                                                           │
│  ├── C#                                                     │
│  │   ├── Enterprise/Microsoft stack? → ASP.NET Core        │
│  │   ├── Minimal API? → ASP.NET Core Minimal APIs          │
│  │   └── Azure integration? → ASP.NET Core                 │
│  │                                                           │
│  └── Python                                                 │
│      ├── Modern async API? → FastAPI                       │
│      ├── Admin panel / CMS? → Django                       │
│      ├── Data science backend? → FastAPI                   │
│      ├── ML model serving? → FastAPI                       │
│      └── Traditional web app? → Django                     │
│                                                               │
│  Cross-cutting Considerations:                               │
│  ├── Team size < 5? → Simpler framework (Express, FastAPI) │
│  ├── Team size > 20? → Opinionated framework (Spring, .NET)│
│  ├── Startup/prototype? → Express or FastAPI               │
│  ├── Enterprise/regulated? → Spring Boot or ASP.NET Core   │
│  ├── CPU-intensive work? → Go or Java                      │
│  └── I/O-intensive work? → Node.js, Go, or Python async   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Performance Characteristics

```
┌──────────────────────────────────────────────────────────────┐
│              Throughput Comparison (typical JSON API)         │
│                                                               │
│  Framework        │ Req/sec (approx) │ Latency p99          │
│  ─────────────────┼──────────────────┼────────────────────── │
│  Gin (Go)         │ 80,000-120,000   │ < 5ms                │
│  Fiber (Go)       │ 70,000-100,000   │ < 5ms                │
│  ASP.NET Core     │ 60,000-100,000   │ < 10ms               │
│  Fastify (Node)   │ 30,000-60,000    │ < 15ms               │
│  Spring Boot      │ 20,000-50,000    │ < 20ms               │
│  Express (Node)   │ 15,000-30,000    │ < 20ms               │
│  FastAPI (Python)  │ 10,000-25,000    │ < 30ms               │
│  Django (Python)  │ 3,000-8,000      │ < 50ms               │
│                                                               │
│  IMPORTANT: These are SYNTHETIC benchmarks.                  │
│  Real-world performance depends on:                          │
│  ├── Database queries (usually the bottleneck)              │
│  ├── External API calls                                     │
│  ├── Business logic complexity                              │
│  ├── Serialization overhead                                 │
│  └── Connection pooling configuration                       │
│                                                               │
│  A well-optimized Django app will outperform                │
│  a poorly-written Go service. Developer skill > framework.  │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Concurrency Models

| Model | Frameworks | How It Works | Best For | Pitfall |
|-------|-----------|-------------|----------|---------|
| Event Loop | Express, Fastify | Single-threaded, non-blocking I/O | I/O-bound, many concurrent connections | CPU-bound work blocks the loop |
| Goroutines | Gin, Fiber | Lightweight green threads (M:N scheduling) | CPU + I/O mixed workloads | Goroutine leaks, unbounded concurrency |
| Virtual Threads (Loom) | Spring Boot 3.2+ | Lightweight JVM threads | Traditional thread-per-request style | Not all libraries are virtual-thread-safe |
| Thread Pool | Spring Boot (classic) | OS threads from pool | CPU-intensive, blocking I/O | Thread exhaustion under load |
| async/await | ASP.NET Core, FastAPI | Cooperative multitasking | I/O-bound workloads | Blocking in async context |
| WSGI (sync) | Django (traditional) | Process/thread per request | Simple apps, admin panels | Low concurrency |
| ASGI (async) | Django 4+, FastAPI | Async event loop | WebSockets, streaming, high concurrency | Mixing sync/async code |

---

## 5. Ecosystem Maturity Comparison

| Capability | Express | Fastify | Gin | Spring Boot | ASP.NET Core | Django | FastAPI |
|-----------|---------|---------|-----|-------------|-------------|--------|---------|
| ORM/Query Builder | Prisma, Drizzle | Same | GORM, Ent, sqlc | Hibernate, JPA | EF Core | Django ORM | SQLAlchemy |
| Migrations | Prisma, Knex | Same | golang-migrate | Flyway, Liquibase | EF Migrations | Built-in | Alembic |
| Auth | Passport, lucia | Same | Custom | Spring Security | Identity | AllAuth | FastAPI Users |
| Validation | Zod, Joi | JSON Schema (built-in) | go-playground/validator | Bean Validation | FluentValidation | Forms, DRF | Pydantic (built-in) |
| Caching | ioredis, node-cache | Same | go-redis | Spring Cache | IDistributedCache | Django Cache | aioredis |
| Job queues | BullMQ | Same | asynq, machinery | Spring Batch | Hangfire | Celery | Celery, arq |
| WebSocket | Socket.IO, ws | @fastify/websocket | gorilla/websocket | Spring WebSocket | SignalR | Channels | WebSocket |
| API Docs | swagger-jsdoc | @fastify/swagger | swaggo | SpringDoc | Swashbuckle | DRF Schema | Built-in |
| Testing | Jest, Supertest | Fastify.inject | testing, testify | JUnit, MockMvc | xUnit, TestServer | pytest | pytest, httpx |
| Monitoring | prom-client | Same | prometheus/client_golang | Micrometer | prometheus-net | django-prometheus | prometheus-fastapi |

---

## 6. Project Structure Patterns

```
┌──────────────────────────────────────────────────────────────┐
│              Standard Project Structures                      │
│                                                               │
│  Node.js (Express/Fastify):                                 │
│  src/                                                        │
│  ├── routes/              # Route definitions                │
│  ├── controllers/         # Request handlers                 │
│  ├── services/            # Business logic                   │
│  ├── repositories/        # Data access                      │
│  ├── middleware/           # Auth, validation, error handling │
│  ├── models/              # Database models/types            │
│  ├── utils/               # Shared utilities                 │
│  ├── config/              # Environment, DB config           │
│  └── app.ts               # App initialization               │
│                                                               │
│  Go (Gin/Fiber):                                            │
│  cmd/                                                        │
│  └── api/main.go          # Entry point                      │
│  internal/                                                   │
│  ├── handler/             # HTTP handlers                    │
│  ├── service/             # Business logic                   │
│  ├── repository/          # Data access                      │
│  ├── model/               # Domain models                    │
│  ├── middleware/           # Auth, logging, recovery         │
│  └── config/              # Config loading                   │
│  pkg/                     # Shared packages                  │
│                                                               │
│  Java (Spring Boot):                                        │
│  src/main/java/com/example/                                 │
│  ├── controller/          # REST controllers                 │
│  ├── service/             # Business logic                   │
│  ├── repository/          # Spring Data repositories        │
│  ├── model/entity/        # JPA entities                     │
│  ├── model/dto/           # Request/response DTOs           │
│  ├── config/              # Spring configuration            │
│  ├── security/            # Security config                  │
│  └── exception/           # Exception handlers              │
│                                                               │
│  Python (FastAPI/Django):                                    │
│  app/                                                        │
│  ├── api/routes/          # Route definitions                │
│  ├── services/            # Business logic                   │
│  ├── repositories/        # Data access                      │
│  ├── models/              # SQLAlchemy/Django models         │
│  ├── schemas/             # Pydantic schemas                 │
│  ├── middleware/           # Custom middleware               │
│  ├── core/config.py       # Settings                         │
│  └── main.py              # App entry point                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Choosing framework by benchmark alone | Poor developer productivity, ecosystem gaps | Factor in team skills, ecosystem, hiring pool |
| Using heavyweight framework for simple API | Over-engineering, slow development | Express/FastAPI for small services, Spring for complex domains |
| Using minimalist framework for complex domain | Re-inventing ORM, auth, admin | Django/Spring for admin panels, complex CRUD |
| Mixing sync and async code (Python) | Thread starvation, deadlocks | All-async (FastAPI) or all-sync (Django) |
| Not using the framework's conventions | Fighting the framework, maintenance burden | Follow framework idioms (Rails way, Spring way) |
| Micro-framework with 50+ middleware packages | Dependency hell, version conflicts | Use opinionated framework or curate a standard stack |
| Choosing Go/Rust for CRUD app | Slower development, no ORM advantage | Node.js or Python for simple CRUD |
| No TypeScript in Node.js projects | Type errors in production, poor refactoring | Always use TypeScript for Node.js backends |
| Ignoring framework update lifecycle | Security vulnerabilities, dead dependencies | Track framework LTS releases, plan upgrades |

---

## 8. Enforcement Checklist

- [ ] Framework choice documented with rationale (team skills, requirements, ecosystem)
- [ ] Project structure follows framework conventions
- [ ] TypeScript enabled for all Node.js projects
- [ ] ORM/query builder selected and configured
- [ ] Authentication solution integrated
- [ ] Input validation library configured (Zod, Pydantic, Bean Validation)
- [ ] Error handling middleware with safe error responses
- [ ] Logging configured (structured JSON to stdout)
- [ ] Health check endpoint implemented
- [ ] API documentation auto-generated (OpenAPI)
- [ ] Testing framework configured with CI integration
- [ ] Database migration tool set up
- [ ] Environment configuration validated at startup
- [ ] Graceful shutdown implemented
