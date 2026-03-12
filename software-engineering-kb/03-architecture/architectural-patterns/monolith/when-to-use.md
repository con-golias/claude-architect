# Monolith: When to Use — Complete Specification

> **AI Plugin Directive:** A monolith is the CORRECT default architecture for most applications. It is NOT an inferior pattern — it is the optimal choice when you need development speed, operational simplicity, and strong data consistency. The burden of proof is on microservices advocates to justify the added complexity. Start with a monolith. Stay with a monolith unless you have proven, measurable reasons to decompose.

---

## 1. When a Monolith IS the Right Choice

```
USE A MONOLITH WHEN (ANY of these apply):

✅ TEAM SIZE < 30 DEVELOPERS
   A modular monolith can support 20-30 developers effectively.
   Microservices help with TEAM scaling, not technical scaling.
   If your team is small, microservices are pure overhead.

✅ NEW PRODUCT / MVP / STARTUP
   You DON'T KNOW your domain boundaries yet.
   Wrong microservice boundaries are 10x harder to fix than wrong module boundaries.
   Ship the monolith, learn the domain, restructure later.

✅ STRONG CONSISTENCY REQUIRED
   Financial transactions, inventory management, booking systems.
   Eventual consistency (required by microservices) introduces complexity
   that monoliths avoid entirely with ACID transactions.

✅ SIMPLE OPERATIONAL REQUIREMENTS
   You don't have or can't afford:
   - Kubernetes or equivalent container orchestration
   - Distributed tracing, centralized logging, service mesh
   - Multiple CI/CD pipelines, multiple databases
   - 24/7 on-call for N services

✅ DEVELOPMENT SPEED IS PRIORITY
   Monoliths are FASTER to develop:
   - One codebase, one IDE, one debug session
   - In-process function calls (no network latency)
   - Refactoring across modules is trivial
   - Shared types prevent data contract mismatches

✅ UNIFORM SCALING NEEDS
   If all parts of your application scale proportionally,
   horizontal scaling of the monolith is simpler and cheaper
   than scaling N independent services.

✅ REGULATED INDUSTRY
   Compliance, auditing, and security reviews are EASIER
   with a single application than with 20+ services.
   SOX, HIPAA, PCI-DSS audits prefer fewer moving parts.
```

---

## 2. When a Monolith is NOT the Right Choice

```
CONSIDER ALTERNATIVES WHEN (ALL of these apply simultaneously):

⚠️ TEAM > 30 DEVELOPERS working on the same codebase
   AND different parts need different deployment cadences
   AND you have mature DevOps infrastructure
   → Consider modular monolith first, then selective extraction

⚠️ WILDLY DIFFERENT SCALING NEEDS
   Search: 100,000 req/sec, Ordering: 100 req/sec
   AND you're paying significantly more by scaling everything together
   → Extract the high-scale module as a service

⚠️ DIFFERENT TECHNOLOGY NEEDS
   ML model serving needs Python, main app is TypeScript
   AND integrating them in-process is impractical
   → Run the ML service separately

⚠️ FAULT ISOLATION CRITICAL
   A crash in one area MUST NOT bring down other areas
   AND the cost of downtime exceeds the cost of microservices complexity
   → Extract the critical module for isolation
```

---

## 3. Decision Matrix

```
┌──────────────────────────┬────────────┬──────────────────┬──────────────────┐
│ Scenario                 │ Monolith   │ Modular Monolith │ Microservices    │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ Solo developer / startup │ ✅ Best     │ Good             │ ❌ Overkill       │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ Team 2-10 developers     │ Good       │ ✅ Best           │ ❌ Overkill       │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ Team 10-30 developers    │ Risky      │ ✅ Best           │ Consider         │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ Team 30+ developers      │ ❌ Too big  │ Good             │ ✅ Appropriate    │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ MVP / Prototype          │ ✅ Best     │ Unnecessary      │ ❌ Never          │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ CRUD application         │ ✅ Best     │ Unnecessary      │ ❌ Never          │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ Complex domain, small    │ Good       │ ✅ Best           │ ❌ Overkill       │
│ team                     │            │                  │                  │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ Financial / transactional│ ✅ Best     │ ✅ Best           │ Risky            │
│ (needs strong            │ (ACID)     │ (ACID)           │ (eventual        │
│  consistency)            │            │                  │  consistency)    │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ High traffic, different  │ Limited    │ Limited          │ ✅ Best           │
│ scaling per component    │            │                  │                  │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ Deadline in < 3 months   │ ✅ Best     │ Good             │ ❌ Too slow       │
├──────────────────────────┼────────────┼──────────────────┼──────────────────┤
│ Legacy modernization     │ —          │ ✅ First target   │ Later            │
│                          │            │ (refactor first) │ (extract second) │
└──────────────────────────┴────────────┴──────────────────┴──────────────────┘
```

---

## 4. Common Objections — Debunked

### "Monoliths don't scale"

```
FALSE. Monoliths scale horizontally just like microservices.

Monolith scaling:
  Load Balancer → N identical instances → Database with read replicas

This handles millions of requests per second.
Shopify runs a monolith serving 80+ billion dollars in GMV.
Stack Overflow runs a monolith serving 100+ million monthly visitors.
Basecamp runs a monolith serving millions of users.

When you ACTUALLY need independent scaling:
  - Extract ONLY the specific module that needs different scaling
  - Keep everything else in the monolith
```

### "Monoliths are hard to maintain"

```
FALSE. UNSTRUCTURED monoliths are hard to maintain.
Well-structured monoliths with Clean Architecture and module boundaries
are EASIER to maintain than microservices.

Monolith maintenance:
  - One codebase to understand
  - One deployment to monitor
  - Refactoring across modules is a single commit
  - IDE support works across the entire codebase

Microservices maintenance:
  - N codebases to understand
  - N deployments to monitor
  - Changes across services require coordinated deployments
  - IDE cannot refactor across service boundaries
```

### "Monoliths can't have team autonomy"

```
FALSE. A modular monolith provides team autonomy:
  - Each team owns one or more modules
  - Module boundaries are enforced by linting rules
  - Modules have independent test suites
  - Teams can work on their modules without coordination
  - Code review and PR merging is per-module

The ONLY thing a modular monolith lacks is independent deployment.
If you don't need independent deployment, you don't need microservices.
```

### "Monoliths lead to spaghetti code"

```
Microservices lead to DISTRIBUTED spaghetti code.
The architecture doesn't prevent spaghetti — discipline does.

A monolith with:
  ✅ Clean Architecture layers
  ✅ Module boundaries
  ✅ Import restrictions
  ✅ Architecture tests in CI
  ✅ Code reviews

Is just as clean as microservices — and SIMPLER to maintain.
```

---

## 5. Monolith Types and When to Use Each

### Simple Monolith (No Module Boundaries)

```
USE FOR:
  - Solo developer projects
  - Prototypes and MVPs
  - Applications with < 10 entities
  - Internal tools with simple CRUD

STRUCTURE:
  Flat Clean Architecture: domain/ → application/ → infrastructure/ → api/
  No module separation needed — the whole app IS one module
```

### Modular Monolith (Module Boundaries)

```
USE FOR:
  - Teams of 5-30 developers
  - Applications with complex business domains
  - Systems that MIGHT need microservices later
  - Long-lived products expected to grow

STRUCTURE:
  modules/{ordering,catalog,billing,...}/
  Each module: domain/ → application/ → infrastructure/ → api/
  Shared kernel: value objects only
  Communication: public APIs and events
```

### Monolith with Satellites

```
USE FOR:
  - Monolith that needs 1-2 specialized services
  - ML model serving alongside business app
  - Background processing with different scaling needs
  - Third-party integration service with different uptime requirements

STRUCTURE:
  Main Monolith + 1-2 extracted services
  The monolith is still the core
  Services handle specific, justified needs
  NOT a full microservices architecture
```

---

## 6. Technology Stack Recommendations

### For Web Applications

```
SMALL MONOLITH (solo dev / MVP):
  TypeScript:  Express/Fastify + Prisma + SQLite/PostgreSQL
  Python:      FastAPI + SQLAlchemy + PostgreSQL
  C#:          ASP.NET Core Minimal APIs + EF Core + PostgreSQL
  Ruby:        Rails + PostgreSQL
  Go:          Echo/Gin + GORM + PostgreSQL

MODULAR MONOLITH (team of 5-30):
  TypeScript:  NestJS + TypeORM/Prisma + PostgreSQL + Redis
  Python:      FastAPI + SQLAlchemy + PostgreSQL + Redis
  C#:          ASP.NET Core + MediatR + EF Core + PostgreSQL + Redis
  Java:        Spring Boot + JPA + PostgreSQL + Redis
  Go:          Custom modules + sqlx + PostgreSQL + Redis

DEPLOYMENT:
  Simple:      Docker container on a VPS (DigitalOcean, Hetzner)
  Scaling:     Docker containers behind load balancer (ECS, Cloud Run)
  Enterprise:  Kubernetes with horizontal pod autoscaler
```

---

## 7. Performance Optimization Before Extraction

```
BEFORE extracting modules to microservices for performance, try these first:

1. PROFILE the application
   - Identify actual bottlenecks (don't guess)
   - 90% of performance issues are in 10% of the code
   - Usually: N+1 queries, missing indexes, unoptimized queries

2. ADD CACHING
   - In-memory cache for hot data (node-cache, caffeine)
   - Redis for shared cache across instances
   - CDN for static assets and API responses

3. OPTIMIZE DATABASE
   - Add missing indexes (EXPLAIN ANALYZE every slow query)
   - Use read replicas for read-heavy workloads
   - Use connection pooling (PgBouncer)
   - Denormalize for read-heavy queries (materialized views)

4. SCALE HORIZONTALLY
   - Add more application instances behind load balancer
   - This is often enough for 10-100x traffic increase

5. BACKGROUND PROCESSING
   - Move heavy computation to job queues (Bull, Celery, Hangfire)
   - Process async: email, reports, data export, image processing

6. ONLY THEN consider extraction
   - If one specific module still can't keep up after all the above
   - Extract THAT module only
   - Keep everything else in the monolith

ORDER OF COST-EFFECTIVENESS:
  Indexing (free) > Caching ($) > Replicas ($$) > Scaling ($$$) > Extraction ($$$$)
```

---

## 8. Quick Decision Guide

```
Are you building a new product?
├── YES → Monolith (always)
└── NO → Continue

Is your team smaller than 30 developers?
├── YES → Modular Monolith
└── NO → Continue

Do you have mature DevOps (K8s, CI/CD, monitoring)?
├── NO → Modular Monolith + invest in DevOps
└── YES → Continue

Do specific modules have PROVEN need for independent scaling/deployment?
├── NO → Modular Monolith
└── YES → Extract ONLY those specific modules
          Keep everything else in the monolith

DEFAULT ANSWER: Modular Monolith
```

---

## 9. Enforcement Checklist

- [ ] **Default to monolith** — every new project starts as a monolith
- [ ] **Justify extraction** — document business reason for any service extraction
- [ ] **Modular structure** — even simple monoliths follow Clean Architecture
- [ ] **Profile before optimizing** — never extract for performance without profiling
- [ ] **Cache before scaling** — try caching and DB optimization before adding instances
- [ ] **Scale horizontally first** — add instances before extracting services
- [ ] **One deployment artifact** — resist the urge to split until proven necessary
- [ ] **Measure team productivity** — if a modular monolith supports 30 devs, stay with it
- [ ] **No premature extraction** — spend at least 6 months in modular monolith before extracting
- [ ] **Evolution over revolution** — incremental changes, never big-bang rewrites
