# Monolith to Microservices Migration

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > Migration Stories |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Scalability](../../10-scalability/), [Async Processing](../../10-scalability/async-processing/) |

---

## Core Concepts

### When to Migrate (and When NOT To)

Evaluate three signal categories before committing to a microservices migration.

**Organizational signals — migrate when:**
- Teams step on each other with every deploy (merge conflicts, release coordination overhead)
- Feature delivery slows because multiple teams must coordinate on the same codebase
- Conway's Law friction — org structure does not match system architecture
- Teams exceed 8-10 engineers working on the same deployable unit

**Technical signals — migrate when:**
- Different components need different scaling profiles (CPU-bound vs I/O-bound)
- Technology lock-in prevents using the right tool for each domain
- Build times exceed 15+ minutes, deploy cycles are measured in days
- A single failure in one module cascades to bring down the entire system

**Scale signals — migrate when:**
- Vertical scaling hits diminishing returns (larger instances, diminishing throughput gains)
- Read/write patterns diverge significantly across domains
- Deployment frequency requirements differ across business capabilities

**Do NOT migrate when:**
- The team is small (fewer than 20 engineers) — operational overhead will dwarf benefits
- Domain boundaries are unclear — extract wrong boundaries and create a distributed monolith
- The monolith is well-structured (modular monolith works) — Shopify runs billions in GMV on a modular monolith
- The primary problem is code quality, not architecture — microservices amplify bad practices

### Migration Strategies

**Strangler Fig Pattern (preferred for most teams):**
1. Identify a bounded context at the monolith's edge (e.g., notifications, search)
2. Build the new service alongside the monolith
3. Route traffic through a facade/API gateway
4. Gradually redirect requests from monolith to new service
5. Remove dead code from the monolith once fully migrated

**Branch by Abstraction:**
1. Create an abstraction layer over the component to extract
2. Implement the abstraction with the existing monolith code
3. Build a second implementation backed by the new service
4. Switch implementations behind a feature flag
5. Remove the old implementation after validation

**Parallel Run:**
1. Send requests to both monolith and new service simultaneously
2. Compare responses for correctness (shadow traffic)
3. Use the monolith response for production, log discrepancies
4. Switch to the new service only after discrepancy rate drops to near-zero

### Service Extraction Playbook

Follow this sequence for each service extraction:

**Step 1 — Identify bounded contexts:**
- Map domain events and aggregate boundaries using Event Storming
- Identify data ownership — which domain owns which entities
- Look for natural seams: modules with few inbound dependencies

**Step 2 — Extract data:**
- Create a new database/schema for the target service
- Implement dual-write: monolith writes to both old and new storage
- Backfill historical data into the new store
- Validate data consistency between old and new stores

**Step 3 — Extract service:**
- Build the service with its own API, backed by its new data store
- Implement an anti-corruption layer to translate between old and new models
- Deploy the service independently (separate CI/CD pipeline)

**Step 4 — Switch traffic:**
- Use feature flags or API gateway rules for gradual rollout
- Start with 1% canary → 10% → 50% → 100%
- Monitor error rates, latency, and business metrics at each stage
- Keep the monolith code path available for instant rollback

### Data Migration Patterns

**Shared database (starting state) → Database per service (target state):**

```
Phase 1: Shared DB          Phase 2: Dual-Write         Phase 3: Separate DBs
┌──────────┐                ┌──────────┐                 ┌──────────┐
│ Monolith │                │ Monolith │──write──→ DB-A   │ Service  │──→ DB-A
│          │──→ Shared DB   │          │──write──→ DB-B   │    A     │
└──────────┘                └──────────┘                  ├──────────┤
                                                          │ Service  │──→ DB-B
                                                          │    B     │
                                                          └──────────┘
```

**Eventual consistency with domain events:**
- Services publish events when data changes (OrderPlaced, UserUpdated)
- Other services subscribe and update their local read models
- Accept that data will be milliseconds-to-seconds stale across services
- Use saga pattern for multi-service transactions (choreography or orchestration)

### Communication Patterns

**Synchronous (REST/gRPC) — use for:**
- Queries that need immediate responses (user-facing reads)
- Simple request-response flows with low fan-out
- Service-to-service calls within the same bounded context

**Asynchronous (events/messages) — use for:**
- Cross-domain communication (order service → inventory service)
- Long-running workflows (payment processing, fulfillment)
- Fan-out scenarios (one event, many consumers)
- Decoupling services that should not know about each other

### Real-World Examples

**Amazon — 2-pizza teams (2001-2006):**
- Mandate from Bezos: all teams must communicate through service interfaces
- Teams own their services end-to-end (build, deploy, operate)
- Result: enabled AWS as a platform, 136M+ deployments per year by 2022

**Netflix — Monolith → Microservices → Platform (2008-2016):**
- Oracle database corruption in 2008 triggered 3-day shipping outage
- 7-year migration to AWS with 700+ microservices
- Built Chaos Engineering (Chaos Monkey) to validate resilience
- Lesson: invest in platform tooling (Eureka, Zuul, Hystrix) before scaling services

**Shopify — Chose modular monolith instead (2016-present):**
- Evaluated microservices, decided operational cost too high for team size
- Implemented component boundaries within the monolith (Packwerk gem)
- Enforced dependency rules at build time, not runtime
- Lesson: microservices are not the only path — modular monoliths scale further than expected

### Observability Requirements

Deploy observability infrastructure BEFORE extracting the first service:
- **Distributed tracing** (Jaeger, Zipkin, OpenTelemetry) — trace requests across service boundaries
- **Centralized logging** (ELK, Loki) — correlate logs with trace IDs
- **Service mesh** (Istio, Linkerd) — mTLS, traffic management, circuit breaking
- **Health dashboards** — per-service SLIs: latency p50/p95/p99, error rate, throughput

---

## 10 Key Lessons

1. **Start with the strangler fig, not the big bang.** Incrementally extract services while the monolith continues serving traffic — Netflix took 7 years; plan for a multi-year journey.

2. **Extract the easiest bounded context first.** Pick a low-risk, well-understood domain (notifications, email, search) to build team muscle before tackling core domains.

3. **Invest in platform before services.** Build CI/CD, observability, and service templates before the third service — otherwise each team reinvents infrastructure.

4. **Data is harder than code.** Separating databases is the most difficult part — plan for dual-write phases, eventual consistency, and months of data migration validation.

5. **Avoid the distributed monolith.** If every service must deploy together or shares a database, you have the worst of both worlds — monolith coupling with distributed complexity.

6. **Feature flags are non-negotiable.** Every traffic switch must be behind a flag for instant rollback — deploy the service first, enable the flag gradually.

7. **Define service ownership explicitly.** Every service needs a single owning team responsible for on-call, SLAs, and roadmap — unowned services decay rapidly.

8. **Prefer events over synchronous calls for cross-domain communication.** Synchronous chains create fragile cascades — async events decouple services and improve resilience.

9. **Measure migration progress with business metrics.** Track deployment frequency, lead time, and incident rate — not just the number of services extracted.

10. **Consider the modular monolith alternative.** Shopify, Basecamp, and others prove that enforced module boundaries within a monolith deliver many microservice benefits without the operational cost.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Distributed monolith | All complexity of microservices with none of the benefits | Enforce independent deployability; eliminate shared databases |
| Nano-services | Operational overhead dwarfs business value | Merge services below a complexity threshold; one service per bounded context |
| Shared database | Tight coupling through data; schema changes break multiple services | Database-per-service with async events for data sharing |
| Big-bang migration | High risk, long freeze, team burnout | Strangler fig: extract incrementally, keep monolith running |
| No observability | Cannot diagnose cross-service failures | Deploy tracing, logging, metrics before first extraction |
| Synchronous chain | Latency compounds, single failure kills the chain | Use async messaging for cross-domain; circuit breakers for sync |
| Premature extraction | Unclear boundaries lead to constant refactoring | Validate bounded contexts through Event Storming before extracting |
| Ignoring data ownership | Multiple services write to same entities, causing conflicts | Define clear data ownership; one service is source of truth per entity |

---

## Checklist

- [ ] Document clear business justification for migration (not just technical preference)
- [ ] Map all bounded contexts using Event Storming or domain analysis
- [ ] Establish service template with CI/CD, observability, and health checks
- [ ] Deploy distributed tracing and centralized logging before first extraction
- [ ] Define data ownership for every entity crossing service boundaries
- [ ] Implement feature flags for every traffic migration step
- [ ] Set up dual-write and data validation pipeline for database separation
- [ ] Assign explicit team ownership for every extracted service
- [ ] Create rollback runbooks for each extraction phase
- [ ] Measure and report migration progress with deployment frequency and lead time metrics
