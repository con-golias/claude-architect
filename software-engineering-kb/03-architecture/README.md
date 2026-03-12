# 03 — Architecture

> **AI Plugin Directive:** This section is the architecture knowledge base for enterprise software development. It covers Clean Architecture, Domain-Driven Design, architectural patterns (microservices, monolith, modular monolith, event-driven, serverless), system design fundamentals, and architecture decision records. Every document contains actionable directives, code examples, decision guides, anti-patterns, and enforcement checklists. Use this section to guide ALL architectural decisions — from choosing the right pattern for a project to implementing specific infrastructure patterns like rate limiting and idempotency.

---

## Section Map

```
03-architecture/
├── README.md                              ← You are here
├── clean-architecture/                    ← Layered architecture principles
│   ├── principles.md                      ← Core principles, SOLID, dependency inversion
│   ├── dependency-rule.md                 ← The dependency rule and how to enforce it
│   ├── layers-and-boundaries.md           ← Layer definitions, boundaries, data flow
│   ├── implementation-web.md              ← Web application implementation (NestJS, FastAPI, ASP.NET)
│   ├── implementation-mobile.md           ← Mobile implementation (Flutter, React Native, Swift, Kotlin)
│   └── implementation-desktop.md          ← Desktop implementation (Electron, WPF, SwiftUI, JavaFX)
├── domain-driven-design/                  ← Strategic and tactical DDD
│   ├── ubiquitous-language.md             ← Shared language between developers and domain experts
│   ├── strategic-design.md                ← Context mapping, bounded contexts, integration patterns
│   ├── bounded-contexts.md                ← Defining, implementing, and integrating bounded contexts
│   ├── aggregates-entities-values.md      ← Aggregate roots, entities, value objects, domain rules
│   └── tactical-patterns.md              ← Repositories, domain services, domain events, specifications
├── architectural-patterns/                ← Pattern catalog with decision guides
│   ├── comparison-decision-guide.md       ← Master decision matrix across all patterns
│   ├── microservices/                     ← Microservice architecture
│   │   ├── overview.md                    ← Core principles, service structure, deployment
│   │   ├── communication-patterns.md      ← REST, gRPC, events, message brokers, schema management
│   │   ├── service-boundaries.md          ← Boundary identification, entity ownership, validation
│   │   ├── data-management.md             ← Database per service, outbox, sagas, CQRS, CDC
│   │   ├── pitfalls.md                    ← 15 common pitfalls with detection and fixes
│   │   └── when-to-use.md                ← Decision framework, cost analysis, migration path
│   ├── monolith/                          ← Monolithic architecture
│   │   ├── overview.md                    ← Types, advantages, scaling, caching, testing
│   │   ├── structure.md                   ← Project structures (NestJS, FastAPI, ASP.NET Core)
│   │   ├── evolution-path.md              ← 4 stages: ball of mud → modular → microservices
│   │   └── when-to-use.md                ← Decision matrix, objections debunked, optimization
│   ├── modular-monolith/                  ← Modular monolith architecture
│   │   ├── overview.md                    ← Module anatomy, communication, transaction boundaries
│   │   ├── module-boundaries.md           ← 4 levels of enforcement (code, DB, contracts, CI/CD)
│   │   └── migration-from-monolith.md     ← 8-phase migration plan from unstructured monolith
│   ├── event-driven/                      ← Event-driven architecture
│   │   ├── overview.md                    ← Domain vs integration events, outbox, DLQ, schemas
│   │   ├── event-sourcing.md              ← Event store, aggregates, projections, snapshots
│   │   ├── saga-pattern.md                ← Choreography vs orchestration, compensation, timeouts
│   │   └── cqrs.md                        ← Command/query separation, read models, consistency
│   └── serverless/                        ← Serverless architecture
│       ├── overview.md                    ← Function design, project structure, IaC, DynamoDB
│       ├── patterns.md                    ← API Gateway, Step Functions, fan-out, idempotency
│       ├── cold-start-strategies.md       ← 6 optimization strategies, monitoring, decision guide
│       └── when-to-use.md                ← Cost comparison, decision tree, hybrid approach
├── system-design/                         ← System design fundamentals
│   ├── fundamentals.md                    ← Design process, estimation, building blocks, scaling
│   ├── distributed-systems.md             ← Fallacies, failures, consensus, replication, partitioning
│   ├── cap-theorem.md                     ← CAP, PACELC, per-operation consistency, database guide
│   ├── consistency-patterns.md            ← Strong/eventual/causal, CRDTs, quorums, conflict resolution
│   ├── rate-limiting.md                   ← Algorithms, distributed limiting, tiers, auth protection
│   └── idempotency.md                     ← Idempotency keys, dedup stores, side effects, testing
└── decision-records/                      ← Architecture Decision Records
    ├── how-to-write-adrs.md               ← When, why, how to write ADRs, review process
    └── template.md                        ← Standard ADR template with filled examples
```

---

## How to Use This Section

```
CHOOSING AN ARCHITECTURE PATTERN:
  1. Start with: architectural-patterns/comparison-decision-guide.md
     → Master decision matrix and decision tree
  2. Deep dive into the chosen pattern's folder
  3. Document the decision: decision-records/template.md

IMPLEMENTING CLEAN ARCHITECTURE:
  1. Read: clean-architecture/principles.md (core rules)
  2. Read: clean-architecture/dependency-rule.md (the one rule)
  3. Read: clean-architecture/layers-and-boundaries.md (layer definitions)
  4. Pick your platform:
     → Web: clean-architecture/implementation-web.md
     → Mobile: clean-architecture/implementation-mobile.md
     → Desktop: clean-architecture/implementation-desktop.md

APPLYING DOMAIN-DRIVEN DESIGN:
  1. Read: domain-driven-design/ubiquitous-language.md (start here always)
  2. Read: domain-driven-design/strategic-design.md (context mapping)
  3. Read: domain-driven-design/bounded-contexts.md (define boundaries)
  4. Read: domain-driven-design/aggregates-entities-values.md (model domain)
  5. Read: domain-driven-design/tactical-patterns.md (implement patterns)

DESIGNING A DISTRIBUTED SYSTEM:
  1. Read: system-design/fundamentals.md (process, estimation, building blocks)
  2. Read: system-design/distributed-systems.md (challenges, failure patterns)
  3. Read: system-design/cap-theorem.md (consistency vs availability)
  4. Read: system-design/consistency-patterns.md (choose per data type)
  5. Apply: system-design/rate-limiting.md (protect your APIs)
  6. Apply: system-design/idempotency.md (make operations safe to retry)

RECORDING ARCHITECTURE DECISIONS:
  1. Read: decision-records/how-to-write-adrs.md (when and how)
  2. Use: decision-records/template.md (standard template)
```

---

## Cross-References

```
THIS SECTION CONNECTS TO:
  01-fundamentals/  → SOLID principles underpin Clean Architecture
  02-code-quality/  → Code patterns implement architectural rules
  04-testing/       → Testing strategies vary by architecture
  05-security/      → Security patterns layer into every architecture
  06-databases/     → Database choice follows from architectural decisions
  07-api-design/    → API patterns depend on communication architecture
  08-devops/        → Deployment varies by monolith vs microservices vs serverless
```

---

## Key Principles Across All Topics

```
1. REQUIREMENTS FIRST:
   Every architectural decision starts with understanding
   functional requirements, non-functional requirements, and constraints.
   There is no universally "best" architecture.

2. TRADE-OFFS ARE EXPLICIT:
   Every decision trades something for something else.
   Document what you gain AND what you sacrifice.

3. SIMPLEST THAT WORKS:
   Start with the simplest architecture that meets requirements.
   Monolith → Modular Monolith → Microservices is the natural evolution.
   Never start with microservices unless you've earned the complexity.

4. DEPENDENCY RULE:
   Dependencies point INWARD toward domain/business logic.
   Domain layer has ZERO external dependencies.
   This rule applies to every architecture pattern.

5. BOUNDARIES ARE ENFORCED:
   Module boundaries, service boundaries, layer boundaries —
   they only matter if they're enforced in code, CI, and review.

6. CONSISTENCY PER OPERATION:
   Don't choose one consistency model for everything.
   Financial data needs strong consistency.
   Product catalog can be eventually consistent.
   Choose the weakest model that satisfies business requirements.

7. DESIGN FOR FAILURE:
   Networks fail. Services crash. Databases go down.
   Every distributed system needs: timeouts, retries, circuit breakers,
   idempotency, and graceful degradation.
```
