# Uber Engineering Case Study

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > By Company |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Monolith to Microservices](../migration-stories/monolith-to-microservices.md), [Scaling to 100M+](../by-scale/hyper-scale-100m-plus.md) |

---

## Company Engineering Profile

Uber operates one of the world's largest real-time marketplaces, matching riders with drivers across 10,000+ cities. The engineering organization scaled from a small team to 5,000+ engineers managing 4,000+ microservices. Key challenges include sub-second dispatch latency, dynamic pricing under volatile demand, and operating a multi-petabyte data platform processing trillions of events daily.

**Scale indicators (as of 2024-2025):**
- 137M+ monthly active users
- 4,000+ microservices in production
- 250+ petabytes in the enterprise data lake
- Millions of trips dispatched daily with sub-second matching
- Engineering offices across 6+ countries

---

## Architecture & Infrastructure

### Monolith to SOA to Microservices

Uber's architecture evolved through three distinct phases:

```text
Phase 1 (2010-2013): Python Monolith
  - Single Django/Flask application
  - PostgreSQL database
  - Worked for one city, one product

Phase 2 (2013-2018): Service-Oriented Architecture
  - Decomposed into hundreds of services
  - Each team owned independent services
  - Rapid growth led to uncontrolled proliferation

Phase 3 (2018-present): Domain-Oriented Microservice Architecture (DOMA)
  - 4,000+ services organized into business domains
  - Clear ownership, SLAs, and API contracts per domain
  - Layered architecture with governance
```

### Domain-Oriented Microservice Architecture (DOMA)

DOMA organizes thousands of services into logical domains with clear boundaries:

```text
DOMA Layer Model:
  ┌─────────────────────────────────┐
  │     Application Layer           │  ← User-facing APIs, mobile BFFs
  ├─────────────────────────────────┤
  │     Business Layer              │  ← Core logic: trips, payments, pricing
  ├─────────────────────────────────┤
  │     Infrastructure Layer        │  ← Databases, messaging, compute
  └─────────────────────────────────┘

Domain Structure:
  Domain = collection of 1-N microservices
  - Single team ownership
  - Well-defined public APIs (gateway layer)
  - Private implementation details hidden
  - Explicit dependency declarations between domains
```

**Key DOMA principles:**
- Group services by business capability, not technical function
- Define explicit domain interfaces (gateway services)
- Reduce accidental coupling between domains
- Enable independent deployment and scaling per domain

### Real-Time Systems

**Geospatial indexing:** Uber partitions the world into hexagonal cells (H3 library, open-sourced) for efficient spatial queries. The dispatch system uses a combination of geospatial indexing and graph algorithms to match riders with nearby drivers in under one second.

**Dispatch algorithm:** Multi-objective optimization balancing rider wait time, driver earnings, and system efficiency. Uses batched matching (considers multiple rider-driver pairs simultaneously) rather than greedy first-come assignment.

**Surge pricing:** Real-time supply-demand modeling per geographic cell. Prices adjust dynamically based on request volume, driver availability, and predicted demand. The system processes millions of pricing calculations per minute.

### Data Platform

Uber built and contributed to several foundational data technologies:

| Technology | Purpose | Scale |
|-----------|---------|-------|
| Apache Kafka | Event streaming backbone | Trillions of messages/day |
| Apache Hudi | Incremental data lake processing | 250+ PB managed |
| Presto/Trino | Interactive SQL analytics | Thousands of daily queries |
| Apache Flink | Real-time stream processing | Real-time analytics pipeline |
| Marmaray | Kafka-to-Hadoop ingestion | Continuous ETL pipeline |

**Data freshness improvement with Hudi:** Reduced end-to-end data freshness from 24 hours (batch ETL) to under 1 hour (incremental upserts). Hudi enables efficient upsert operations on HDFS/S3, critical for a business where data changes continuously.

### Mobile Architecture: RIBs

RIBs (Router, Interactor, Builder) is Uber's cross-platform mobile architecture framework:

```text
RIBs Architecture:
  Router    → Manages navigation and child RIB attachment
  Interactor → Business logic, state management
  Builder   → Dependency injection, RIB construction
  View      → UI rendering (optional - some RIBs are headless)
  Presenter → Transforms business models to view models

Key Design Decisions:
  - Business logic drives the app (not the view layer)
  - Deep nesting of RIBs mirrors complex state trees
  - Cross-platform consistency (iOS Swift, Android Java/Kotlin)
  - Testable by design (Interactors are pure logic units)
```

### Developer Platform

**UP (Uber Platform):** Internal platform providing standardized service creation, deployment, monitoring, and traffic management. Developers create new services through templates that automatically configure logging, metrics, tracing, and CI/CD.

**Service mesh:** Uber built a custom service mesh handling inter-service communication, load balancing, circuit breaking, and observability across 4,000+ services.

---

## Engineering Practices

### Development Workflow
- **Monorepo approach** for core services with shared libraries
- **Standardized service templates** via UP platform
- **Automated code review** with language-specific linters and static analysis
- **Feature flags** for gradual rollouts across cities and user segments

### Testing Strategy
- Unit testing with high coverage requirements for critical paths
- Integration testing using service virtualization
- **Shadow traffic testing:** replay production traffic against new versions
- **City-level canary deployments:** roll out changes to one city before global release

### Observability
- Distributed tracing across all 4,000+ services (Jaeger, open-sourced)
- Real-time dashboards for dispatch, pricing, and marketplace health
- Custom anomaly detection on business metrics (trip completion rates, ETAs)

---

## Key Engineering Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build DOMA over pure microservices | Uncontrolled proliferation of 4,000+ services needed governance | Reduced coupling, clearer ownership, faster onboarding |
| Open-source Hudi, H3, Jaeger | Build community, attract talent, improve tools through external contributions | Industry-standard tools with broad adoption |
| Custom dispatch algorithm | Off-the-shelf solutions could not handle real-time multi-objective optimization | Sub-second matching at global scale |
| RIBs for mobile | Standard MVC/MVVM could not manage deeply nested state across 200+ engineer teams | Consistent cross-platform behavior, better testability |
| Invest in data platform early | Real-time decisions (pricing, dispatch, fraud) require fresh, reliable data | Competitive advantage in marketplace efficiency |

---

## Lessons Learned

1. **Microservices need governance at scale.** Without DOMA-style domain boundaries, 4,000+ services become an unmaintainable dependency graph. Impose structure before complexity becomes unmanageable.

2. **Invest in data infrastructure as a strategic asset.** Uber's competitive advantage comes from data-driven decisions (pricing, dispatch, ETAs). Building Kafka pipelines, Hudi, and real-time analytics was not optional overhead -- it was core business capability.

3. **Platform thinking reduces complexity.** The UP developer platform abstracts away infrastructure concerns, letting product engineers focus on business logic rather than deployment mechanics.

4. **Open-sourcing builds better tools.** Contributing Hudi, H3, Jaeger, and RIBs to the community attracted external contributions that improved the tools beyond what an internal team alone could achieve.

5. **City-level rollouts enable safe experimentation.** Deploying changes to a single city first provides real-world validation without global risk. Design systems to support geographic isolation.

---

## Key Takeaways

1. **Domain boundaries matter more than service boundaries.** Organize microservices into business domains with explicit interfaces. DOMA demonstrates that governance at scale requires architectural structure, not just service decomposition.

2. **Real-time systems demand purpose-built infrastructure.** Generic databases and batch processing cannot support sub-second dispatch and dynamic pricing. Invest in streaming (Kafka), incremental processing (Hudi), and spatial indexing (H3).

3. **Mobile architecture must handle deep state complexity.** When hundreds of engineers build features simultaneously, adopt an architecture (RIBs) that manages nested state trees and enforces separation of business logic from UI.

4. **Platform engineering is a force multiplier.** A developer platform that standardizes service creation, deployment, and observability pays for itself many times over when operating 4,000+ services.

5. **Design for geographic isolation.** City-level and region-level deployment isolation enables safe rollouts, compliance with local regulations, and graceful degradation when regional infrastructure fails.

---

## Anti-Patterns to Avoid

| Anti-Pattern | What Happened | Lesson |
|---|---|---|
| Uncontrolled service proliferation | Pre-DOMA Uber had thousands of services with unclear ownership and tangled dependencies | Enforce domain boundaries and ownership from the start |
| Monolith for real-time systems | Original Python monolith could not handle sub-second latency requirements | Identify latency-critical paths early and architect accordingly |
| Batch-only data processing | 24-hour data freshness was unacceptable for pricing and fraud detection | Build incremental/streaming pipelines alongside batch |
| One-size-fits-all deployment | Global deployments risk global outages | Implement geographic canary deployments |
| Ignoring mobile architecture at scale | Ad-hoc mobile patterns cause inconsistency across 200+ engineer teams | Adopt a structured framework (RIBs) before complexity hits |
| Building everything in-house | Early tendency to build custom solutions for every problem | Use open-source where possible, build custom only for differentiating capabilities |
| Neglecting developer experience | Without platform abstractions, each team reinvents deployment and observability | Invest in developer platform early to reduce per-team overhead |
