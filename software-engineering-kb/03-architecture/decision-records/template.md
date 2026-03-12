# ADR Template — Complete Specification

> **AI Plugin Directive:** This is the STANDARD template for Architecture Decision Records. Use this template for EVERY architectural decision. Fill in ALL sections — no section should be left empty. The template is designed to be concise (1 page max per ADR). When generating ADRs, follow this structure EXACTLY. Do not add extra sections. Do not skip sections. The Alternatives section is the MOST IMPORTANT — it captures why other options were rejected, preventing the team from revisiting the same discussion.

---

## 1. The Template

```markdown
# ADR-[NNN]: [Title — State the Decision]

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-NNN]

## Date

[YYYY-MM-DD]

## Decision Makers

[Names/roles of people who made or approved this decision]

## Context

[Describe the situation that requires a decision.
 Include:
 - The problem or need
 - Technical constraints (performance, scale, compatibility)
 - Business constraints (budget, timeline, compliance)
 - Team constraints (skills, headcount, experience)
 - Any relevant metrics or data

 Be specific. A reader unfamiliar with the project should
 understand WHY this decision was needed.]

## Decision

[State the decision clearly and directly.
 Use active voice: "We will..." not "It was decided..."
 Be specific enough that implementation is unambiguous.

 If the decision has conditions or scope limits, state them:
 "We will use X for Y, but not for Z."]

## Alternatives Considered

### [Alternative 1 Name]

- **Description:** [What is this option?]
- **Pros:** [What's good about it?]
- **Cons:** [What's bad about it?]
- **Why rejected:** [Specific reason this wasn't chosen]

### [Alternative 2 Name]

- **Description:** [What is this option?]
- **Pros:** [What's good about it?]
- **Cons:** [What's bad about it?]
- **Why rejected:** [Specific reason this wasn't chosen]

[Add more alternatives as needed. Minimum 2 alternatives.]

## Consequences

### Positive

- [Benefit 1]
- [Benefit 2]

### Negative

- [Trade-off or risk 1]
- [Trade-off or risk 2]

### Risks

- [What could go wrong?]
- [What assumptions are we making?]

## References

- [Link to related ADR, if any]
- [Link to design doc, if any]
- [Link to external resource, if any]
```

---

## 2. Filled Example — Technology Choice

```markdown
# ADR-001: Use PostgreSQL as Primary Relational Database

## Status

Accepted

## Date

2024-01-15

## Decision Makers

- Sarah Chen (Tech Lead)
- Marcus Rivera (Backend Lead)
- Platform Architecture Team

## Context

Our e-commerce platform processes approximately 500K orders per day
with peak traffic of 2,000 orders/minute during flash sales. The
order processing pipeline requires ACID transactions spanning
order creation, inventory reservation, and payment initiation.

Our data model is highly relational — orders reference products,
customers, addresses, and payment methods with complex JOIN queries
for reporting. We need full-text search for product catalog
(50K products) and JSON storage for flexible product attributes.

The backend team (8 engineers) has strong SQL experience (PostgreSQL
and MySQL). We are deploying on AWS with a target availability of
99.95%. Budget for managed database service is $2,000/month.

## Decision

We will use **PostgreSQL 16** via **AWS RDS** in a Multi-AZ deployment
as our primary relational database.

Specifically:
- db.r6g.xlarge instance (4 vCPU, 32 GB RAM) for primary
- One synchronous standby in different AZ (Multi-AZ)
- Two asynchronous read replicas for reporting queries
- RDS automated backups with 7-day retention
- Connection pooling via PgBouncer (deployed as sidecar)

## Alternatives Considered

### MySQL 8 (Aurora)

- **Description:** MySQL-compatible Aurora with read replicas
- **Pros:** Familiar to team, Aurora's storage engine is faster for
  some workloads, slightly lower RDS cost
- **Cons:** Weaker JSON support (no JSONB equivalent), no GIN/GiST
  indexes for full-text search, less mature CTE and window function
  support
- **Why rejected:** Our product catalog requires JSONB for flexible
  attributes and GIN indexes for full-text search. MySQL's JSON
  functions are significantly slower for our query patterns.

### MongoDB Atlas

- **Description:** Document database with flexible schema
- **Pros:** Flexible schema for product attributes, horizontal scaling
  built-in, good developer experience for simple queries
- **Cons:** No JOINs (would require denormalization or application-level
  joins), no multi-document ACID transactions until v4.0 (and
  still limited), team has no MongoDB experience
- **Why rejected:** Our order processing requires multi-table ACID
  transactions. Denormalizing the data model would increase
  complexity and risk of data inconsistency. Team learning curve
  would delay the project by 4-6 weeks.

### CockroachDB

- **Description:** Distributed SQL database with PostgreSQL compatibility
- **Pros:** Horizontal write scaling, automatic sharding, PostgreSQL
  wire protocol compatible
- **Cons:** 2-3x higher latency for single-row operations due to
  consensus protocol, significantly higher cost ($5,000+/month
  for comparable throughput), operational complexity
- **Why rejected:** Our current scale (500K orders/day) fits
  comfortably on a single PostgreSQL primary. CockroachDB's
  distributed overhead adds latency we don't need to accept.
  We can revisit if we exceed 5M orders/day (see scaling plan).

## Consequences

### Positive

- Team can start immediately (existing PostgreSQL expertise)
- ACID transactions guarantee order consistency
- JSONB + GIN indexes cover our full-text search needs without
  a separate search engine
- AWS RDS reduces operational burden (backups, patches, failover)
- Well-understood scaling path (read replicas → sharding → Citus)

### Negative

- Write scaling is limited to vertical (bigger instance) until we
  shard. Current headroom is ~5x before we need to address this.
- Multi-AZ failover takes 60-120 seconds (acceptable for 99.95% SLA)
- PgBouncer adds operational complexity for connection pooling

### Risks

- If traffic exceeds 5x current (2.5M orders/day), we will need
  to implement sharding (Citus or manual). This is a significant
  engineering effort (estimated 2-3 months).
- AWS RDS major version upgrades require downtime (5-10 minutes).
  Must plan maintenance windows.

## References

- ADR-002: Use Redis for caching layer (companion decision)
- ADR-005: Database sharding strategy (future scaling plan)
- [PostgreSQL 16 release notes](https://www.postgresql.org/docs/16/release-16.html)
- [AWS RDS Multi-AZ documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html)
```

---

## 3. Filled Example — Architecture Pattern

```markdown
# ADR-007: Adopt Event-Driven Architecture for Inter-Service Communication

## Status

Accepted

## Date

2024-02-10

## Decision Makers

- Platform Architecture Team
- Service Owners (Order, Inventory, Payment, Notification)

## Context

Our platform has grown to 6 core services (Order, Inventory, Payment,
Notification, Shipping, Analytics). Currently, services communicate
via synchronous REST calls. This creates several problems:

1. **Tight coupling**: Order service directly calls Inventory, Payment,
   and Notification. A change to Notification's API breaks Order.
2. **Cascading failures**: If Payment service is slow (3s latency),
   Order service is also slow (it waits for Payment).
3. **Availability multiplication**: 99.9% × 99.9% × 99.9% = 99.7%
   for a 3-service chain. Below our 99.95% SLA target.
4. **Adding new consumers is hard**: When Shipping needs order events,
   we must modify the Order service to call Shipping.

We need a communication pattern that decouples services, improves
availability, and allows new consumers without modifying producers.

## Decision

We will adopt **event-driven architecture** using **Apache Kafka** as
our event streaming platform for inter-service communication.

Specifically:
- Domain events published to Kafka topics (one topic per aggregate)
- Avro schema with Schema Registry for event schemas
- At-least-once delivery with idempotent consumers
- Outbox pattern for reliable event publishing
- Synchronous REST retained ONLY for queries that need immediate response

## Alternatives Considered

### Keep Synchronous REST (Status Quo)

- **Description:** Continue with direct REST calls between services
- **Pros:** Simple, team knows it, easy to debug
- **Cons:** Tight coupling, cascading failures, availability issues
- **Why rejected:** Does not solve our core problems. Availability
  will worsen as we add more services.

### AWS SQS + SNS

- **Description:** Point-to-point queues (SQS) with pub/sub fanout (SNS)
- **Pros:** Fully managed, no operational overhead, per-message pricing
- **Cons:** No event replay (once consumed, gone), no ordering guarantees
  in standard SQS, 256KB message size limit, no schema registry
- **Why rejected:** We need event replay for rebuilding read models
  and reprocessing historical events. SQS's lack of ordering
  and replay makes it unsuitable for event sourcing patterns.

### RabbitMQ

- **Description:** Traditional message broker with exchanges and queues
- **Pros:** Flexible routing, mature, good for complex routing patterns
- **Cons:** No built-in event replay, messages deleted after consumption,
  not designed for high-throughput streaming, clustering is complex
- **Why rejected:** Same replay limitation as SQS. Also, Kafka's
  throughput (millions of messages/sec) gives us more headroom
  than RabbitMQ's thousands/sec.

## Consequences

### Positive

- Services are decoupled — producers don't know about consumers
- New consumers (e.g., Analytics) can subscribe without changing producers
- Event replay enables rebuilding read models and debugging
- Improved availability — services process events at their own pace
- Natural audit trail — events are immutable log

### Negative

- Eventual consistency — services see events with delay (typically <100ms)
- Operational complexity — Kafka cluster requires monitoring and maintenance
- Debugging is harder — tracing a request across async events is more complex
- Team needs training on Kafka, event design, and eventual consistency patterns

### Risks

- If Kafka cluster goes down, event publishing is blocked. Mitigated
  by: 3-broker cluster with replication factor 3, multi-AZ deployment.
- Event schema evolution could break consumers. Mitigated by: Avro
  schemas with backward compatibility rules in Schema Registry.
- Developers may struggle with eventual consistency. Mitigated by:
  training sessions and establishing patterns (saga, outbox).

## References

- ADR-001: Use PostgreSQL (events stored in outbox table)
- ADR-008: Event schema versioning strategy
- ADR-009: Saga pattern for distributed transactions
- [Kafka: The Definitive Guide](https://www.confluent.io/resources/kafka-the-definitive-guide/)
```

---

## 4. Filled Example — Superseding an ADR

```markdown
# ADR-015: Migrate from REST to gRPC for Internal Service Communication

## Status

Accepted (Supersedes ADR-003)

## Date

2024-06-01

## Decision Makers

- Platform Architecture Team

## Context

ADR-003 (2024-01-20) established REST/JSON as the standard for
synchronous internal service communication. Since then:

1. Service count has grown from 6 to 14
2. Internal API calls have increased to 50K/sec at peak
3. JSON serialization accounts for 15% of CPU usage in hot paths
4. API contract breakage has caused 3 incidents due to missing
   field validation between services

We need a protocol with better performance, smaller payloads,
and compile-time type safety for internal service calls.

NOTE: External APIs (customer-facing) remain REST/JSON per ADR-003.

## Decision

We will use **gRPC with Protocol Buffers** for all NEW internal
synchronous service-to-service communication.

Existing REST endpoints will be migrated incrementally (highest
traffic first). External APIs remain REST/JSON.

## Alternatives Considered

### Keep REST with OpenAPI Validation

- **Description:** Add OpenAPI schema validation to existing REST APIs
- **Pros:** No migration needed, team knows REST
- **Cons:** JSON serialization overhead remains, runtime validation only
- **Why rejected:** Doesn't solve the 15% CPU overhead from JSON.
  Runtime validation still allows contract drift between deploys.

### GraphQL Federation

- **Description:** Apollo Federation for service-to-service queries
- **Pros:** Flexible queries, schema stitching
- **Cons:** Overhead for simple service-to-service calls, not designed
  for internal RPC patterns, team has no GraphQL experience
- **Why rejected:** GraphQL is optimized for client-to-API-gateway
  pattern, not for service-to-service RPC. Overhead outweighs benefits.

## Consequences

### Positive

- 5-10x smaller payloads (Protobuf vs JSON)
- Compile-time type safety prevents API contract breakage
- HTTP/2 multiplexing reduces connection overhead
- Code generation eliminates manual client/server boilerplate

### Negative

- Team needs gRPC/Protobuf training (estimated 1 week)
- Debugging is harder (binary protocol vs human-readable JSON)
- Migration period with two protocols increases complexity
- Browser clients cannot call gRPC directly (need gRPC-Web gateway)

### Risks

- Migration may take longer than estimated if teams don't prioritize it
- Proto file management across repos needs tooling (Buf or proto registry)

## References

- ADR-003: Use REST for internal communication (SUPERSEDED by this ADR)
- [gRPC documentation](https://grpc.io/docs/)
- [Protobuf style guide](https://protobuf.dev/programming-guides/style/)
```

---

## 5. Quick-Reference ADR Checklist

```
Before submitting an ADR for review, verify:

□ Title is a clear decision statement (verb + subject)
□ Status is "Proposed"
□ Date is today's date
□ Decision makers are listed
□ Context explains the PROBLEM, not the solution
□ Context includes specific data (traffic, team size, constraints)
□ Decision is direct: "We will..." not "We should consider..."
□ Decision is specific enough to implement
□ At least 2 alternatives are listed
□ Each alternative has pros, cons, AND reason for rejection
□ Positive consequences listed
□ Negative consequences listed (MANDATORY — there are always trade-offs)
□ Risks identified with mitigation strategies
□ Related ADRs referenced
□ Total length is under 1 page (500 words max for each section)
□ Stored in docs/adr/ directory with sequential numbering
```

---

## 6. Template Variations

### Lightweight ADR (Y-Statement)

```markdown
# ADR-NNN: [Title]

**Status:** [Proposed | Accepted]
**Date:** YYYY-MM-DD

In the context of [situation/problem],
facing [specific concern or constraint],
we decided to [decision]
and against [rejected alternatives],
to achieve [desired outcome],
accepting [trade-off or negative consequence].
```

### Decision Log Entry (For Very Small Decisions)

```markdown
| Date | Decision | Context | Alternatives | Consequence |
|------|----------|---------|-------------|-------------|
| 2024-01-15 | Use day.js for dates | Need date lib, moment.js deprecated | date-fns (larger bundle), Temporal (not stable) | +8KB bundle, covers all date needs |
| 2024-01-18 | Use Zod for validation | Need runtime type validation | Yup (less TS support), io-ts (complex API) | Type-safe validation, good DX |
```

---

## 7. Enforcement Checklist

- [ ] **Template file exists in repo** — `docs/adr/template.md`
- [ ] **Every ADR follows the template** — all sections filled, no shortcuts
- [ ] **Alternatives section is complete** — minimum 2 alternatives with honest evaluation
- [ ] **Negative consequences are included** — every decision has trade-offs
- [ ] **ADRs are written at decision time** — not retroactively
- [ ] **ADRs are reviewed via PR** — team has opportunity to comment
- [ ] **Index file is maintained** — `docs/adr/README.md` updated with each new ADR
- [ ] **Superseded ADRs are marked** — old ADR status updated, new ADR references old
- [ ] **ADRs stored in version control** — same repo as the code they describe
- [ ] **Title is a decision statement** — "Use X for Y", not just "Database"
