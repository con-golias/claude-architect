# How to Write Architecture Decision Records (ADRs) — Complete Specification

> **AI Plugin Directive:** An Architecture Decision Record (ADR) captures a significant architectural decision along with its context, alternatives considered, and consequences. EVERY non-trivial architectural decision MUST be documented in an ADR. ADRs are the institutional memory of your project — without them, teams repeatedly revisit the same decisions, lose the reasoning behind existing choices, and make contradictory decisions. ADRs are SHORT, ACTIONABLE documents — not essays. One page maximum. Written as they happen, not after the fact.

---

## 1. What is an ADR

```
An ADR answers THREE questions:
  1. WHAT did we decide?
  2. WHY did we decide it? (context, constraints, trade-offs)
  3. WHAT are the consequences? (positive, negative, risks)

AN ADR IS:
  ✅ A short document (1 page max)
  ✅ Written at the TIME of the decision
  ✅ Immutable once accepted (supersede, don't edit)
  ✅ Numbered sequentially (ADR-001, ADR-002, ...)
  ✅ Stored in version control alongside the code
  ✅ Written by the person/team making the decision

AN ADR IS NOT:
  ❌ A design document (those are separate, longer documents)
  ❌ A meeting summary (focus on the DECISION, not the discussion)
  ❌ A justification essay (keep it concise)
  ❌ A living document (once accepted, it's immutable)
  ❌ Optional (every significant decision needs one)
```

---

## 2. When to Write an ADR

```
WRITE AN ADR WHEN:
  ✅ Choosing a technology (database, framework, language, library)
  ✅ Defining an architectural pattern (microservices, event-driven, CQRS)
  ✅ Changing a communication protocol (REST → gRPC, sync → async)
  ✅ Defining a data strategy (sharding, replication, caching approach)
  ✅ Making a security decision (auth method, encryption standard)
  ✅ Choosing a deployment strategy (containers, serverless, region)
  ✅ Defining API versioning strategy
  ✅ Choosing a testing strategy (integration vs contract tests)
  ✅ Making any decision that affects multiple teams or services
  ✅ Making any decision that would be costly to reverse

DO NOT WRITE AN ADR WHEN:
  ❌ Implementation detail within a single module
  ❌ Variable naming or code style choice (use linter config)
  ❌ Bug fix approach (use PR description)
  ❌ Temporary workaround (use code comment with TODO)

RULE OF THUMB:
  If a new team member would ask "why did we do it this way?"
  → Write an ADR.
```

---

## 3. ADR Structure

```
EVERY ADR follows this structure:

# ADR-NNN: [Title — Short Decision Statement]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Date
[YYYY-MM-DD]

## Context
[What is the problem or situation that requires a decision?
 Include technical constraints, business requirements, and team capabilities.
 Be specific — don't assume the reader knows the background.]

## Decision
[What is the decision? State it clearly and directly.
 "We will use X" not "We might consider X."]

## Alternatives Considered
[What other options were evaluated? Why were they rejected?
 This is the MOST VALUABLE section — it prevents revisiting the same discussion.]

## Consequences
[What are the results of this decision?
 Include both positive and negative consequences.
 Be honest about trade-offs and risks.]

## References
[Links to related ADRs, design docs, or external resources.
 Optional but helpful.]
```

---

## 4. Writing Rules

```
RULE 1: TITLE IS A DECISION STATEMENT
  BAD:  "ADR-005: Database"
  BAD:  "ADR-005: Database Discussion"
  GOOD: "ADR-005: Use PostgreSQL as Primary Data Store"
  GOOD: "ADR-005: Adopt Event Sourcing for Order Management"

RULE 2: CONTEXT EXPLAINS WHY, NOT WHAT
  BAD:  "We need a database."
  GOOD: "Our application processes 500K orders/day with complex queries
         involving JOINs across 8 tables. We need ACID transactions for
         payment processing and strong consistency for inventory counts.
         The team has 5 years of SQL experience."

RULE 3: DECISION IS DIRECT AND UNAMBIGUOUS
  BAD:  "We might use PostgreSQL, or maybe MySQL."
  GOOD: "We will use PostgreSQL 16 as our primary relational database.
         We will use the managed AWS RDS service in multi-AZ deployment."

RULE 4: ALTERNATIVES ARE HONEST
  BAD:  "MySQL was considered but it's bad."
  GOOD: "MySQL was considered. It meets our consistency requirements but
         lacks PostgreSQL's advanced indexing (GIN, GiST) that we need
         for our full-text search use case. MySQL's JSON support is
         also less mature than PostgreSQL's JSONB."

RULE 5: CONSEQUENCES INCLUDE NEGATIVES
  BAD:  "This will be great for everything."
  GOOD: "PostgreSQL does not scale writes horizontally natively.
         If we exceed 10K writes/sec, we will need to shard manually
         or migrate to CockroachDB (see ADR-012 for sharding strategy).
         The team will need training on PostgreSQL-specific features."

RULE 6: ONE DECISION PER ADR
  BAD:  "ADR-005: Use PostgreSQL and Redis and Kafka"
  GOOD: Three separate ADRs — one for each technology choice.
        They can reference each other.

RULE 7: KEEP IT SHORT
  Target: 1 page (300-500 words).
  If longer, you're writing a design doc, not an ADR.

RULE 8: IMMUTABLE ONCE ACCEPTED
  Never edit an accepted ADR.
  If the decision changes, write a NEW ADR that supersedes it.
  Update the old ADR's status: "Superseded by ADR-XXX"
```

---

## 5. ADR Lifecycle

```
STATUS TRANSITIONS:

  Proposed → Accepted    (team/lead approves)
  Proposed → Rejected    (alternative chosen instead)
  Accepted → Deprecated  (no longer relevant, system removed)
  Accepted → Superseded  (new decision replaces this one)

PROPOSED:
  ADR is drafted and submitted for review.
  Include in a PR for team discussion.
  Anyone can comment, suggest changes.

ACCEPTED:
  Team agrees on the decision.
  ADR is merged. Decision is final.
  Implementation can begin.

DEPRECATED:
  The context that motivated this decision no longer exists.
  Example: The service this ADR was about has been decommissioned.
  The ADR stays in the record for historical reference.

SUPERSEDED:
  A new ADR replaces this one with a different decision.
  Update status: "Superseded by ADR-XXX"
  The original ADR stays for historical context.
  The new ADR should reference the old one.

RULE: ADRs are NEVER deleted. They are historical records.
  Even rejected ADRs are valuable — they prevent revisiting bad ideas.
```

---

## 6. ADR Numbering and Organization

```
FILE NAMING:
  docs/adr/
  ├── 001-use-postgresql-as-primary-database.md
  ├── 002-adopt-event-driven-architecture.md
  ├── 003-use-jwt-for-authentication.md
  ├── 004-deploy-on-aws-ecs-fargate.md
  ├── 005-use-kafka-for-event-streaming.md
  ├── 006-adopt-trunk-based-development.md
  └── README.md  (index of all ADRs with status)

NUMBERING:
  - Sequential, zero-padded (001, 002, ..., 099, 100)
  - Never reuse numbers (even for rejected ADRs)
  - Gaps are OK (if ADR-003 is rejected, next is still ADR-004)

INDEX FILE (docs/adr/README.md):
  # Architecture Decision Records

  | # | Title | Status | Date |
  |---|-------|--------|------|
  | 001 | Use PostgreSQL as Primary Database | Accepted | 2024-01-15 |
  | 002 | Adopt Event-Driven Architecture | Accepted | 2024-01-22 |
  | 003 | Use MongoDB for Sessions | Rejected | 2024-02-01 |
  | 004 | Use JWT for Authentication | Accepted | 2024-02-05 |
  | 005 | Use Kafka for Event Streaming | Accepted | 2024-02-10 |
  | 006 | Adopt Trunk-Based Development | Proposed | 2024-02-15 |

TOOLING:
  adr-tools (CLI): Automates creation, numbering, linking
    adr new "Use PostgreSQL as primary database"
    adr list
    adr link 005 "Supersedes" 002

  Custom script (if adr-tools doesn't fit):
    Generate from template, auto-number, update index
```

---

## 7. ADR Review Process

```
STEP 1: DRAFT
  Author writes the ADR using the template.
  Include context, decision, alternatives, consequences.
  Keep the status as "Proposed."

STEP 2: SUBMIT FOR REVIEW
  Create a Pull Request with the ADR file.
  Tag relevant team members and tech leads.
  Set a review deadline (48-72 hours max).

STEP 3: DISCUSS
  Reviewers comment on the PR.
  Focus on: missing alternatives, unstated consequences, factual errors.
  NOT on: personal preferences that aren't backed by evidence.

STEP 4: REVISE OR ACCEPT
  If changes needed → author updates the PR.
  If team agrees → approve the PR.
  Update status to "Accepted" and merge.

STEP 5: COMMUNICATE
  Announce the accepted ADR in team channel.
  Include a one-line summary of the decision.
  Link to the ADR for anyone who wants context.

RULE: ADR review should take DAYS, not weeks.
  If it takes longer, the scope is too big — split into multiple ADRs.
```

---

## 8. Lightweight ADRs (Y-Statements)

```
For smaller decisions that don't warrant a full ADR,
use the Y-Statement format (one paragraph):

TEMPLATE:
  In the context of [context],
  facing [concern],
  we decided [decision]
  and against [alternatives],
  to achieve [outcome],
  accepting [trade-off].

EXAMPLE:
  In the context of inter-service communication,
  facing the need for decoupled, async event processing,
  we decided to use Apache Kafka
  and against RabbitMQ and AWS SQS,
  to achieve high throughput and event replay capability,
  accepting the additional operational complexity of managing a Kafka cluster.

USE Y-STATEMENTS FOR:
  - Library choices within a service
  - Minor technology decisions
  - Decisions that affect only one team
  - Quick decisions with clear reasoning

USE FULL ADRs FOR:
  - Cross-team architectural decisions
  - Technology choices affecting the entire system
  - Decisions that are expensive to reverse
  - Decisions where alternatives need detailed comparison
```

---

## 9. Common ADR Categories

```
TECHNOLOGY CHOICES:
  - Primary database
  - Caching layer
  - Message broker
  - Programming language
  - Framework
  - Cloud provider

ARCHITECTURE DECISIONS:
  - Monolith vs microservices
  - Synchronous vs asynchronous communication
  - Event sourcing vs state-based
  - CQRS vs traditional CRUD
  - Serverless vs containers

DATA DECISIONS:
  - Consistency model per data type
  - Sharding strategy
  - Data retention policy
  - Backup and recovery strategy
  - Encryption standards

PROCESS DECISIONS:
  - Branching strategy
  - CI/CD pipeline design
  - Testing strategy
  - Monitoring and alerting approach
  - Incident response process

SECURITY DECISIONS:
  - Authentication method
  - Authorization model
  - API security standards
  - Secret management approach
  - Compliance requirements
```

---

## 10. Connecting ADRs to Code

```typescript
// Reference ADRs in code where the decision is implemented

// In configuration files:
// See ADR-001: Use PostgreSQL as Primary Database
// https://github.com/org/repo/blob/main/docs/adr/001-use-postgresql.md
const databaseConfig = {
  client: 'postgresql',
  connection: process.env.DATABASE_URL,
};

// In architectural code:
/**
 * Event bus implementation using Kafka.
 * Decision: ADR-005 — Use Kafka for Event Streaming
 * We chose Kafka over RabbitMQ for event replay capability.
 */
class KafkaEventBus implements EventBus { ... }

// In module boundaries:
// ADR-012: Adopt Modular Monolith Architecture
// This module communicates ONLY through its public API.
// Direct database access across module boundaries is forbidden.
export class OrderModule {
  static readonly publicApi = new OrderPublicApi();
}

// RULE: Reference ADRs sparingly in code.
//   Only where the "why" isn't obvious from the code itself.
//   The ADR index (README) is the primary discovery mechanism.
```

---

## 11. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **No ADRs at All** | Decisions exist only in people's heads | Mandate ADRs for cross-team architectural decisions |
| **ADRs Written After the Fact** | Writing ADRs months after the decision | Write ADR BEFORE or DURING the decision, not after |
| **Editing Accepted ADRs** | Changing old ADRs when decisions change | Create a new ADR that supersedes the old one |
| **Too Long** | Multi-page ADRs with excessive detail | One page max. Move details to design docs. |
| **No Alternatives Section** | Decision recorded but not the reasoning | ALWAYS include what was considered and why it was rejected |
| **Positive-Only Consequences** | No mention of trade-offs or risks | ALWAYS include negative consequences and risks |
| **Vague Context** | "We need something for data" | Be specific: traffic, constraints, team skills, timeline |
| **Decision by Committee** | 20 people review every ADR for weeks | Small team decides, broader team is informed |
| **ADRs in Wiki (Not VCS)** | ADRs in Confluence/Notion, not in repo | Store ADRs in the code repository — same versioning as code |
| **Not Linking Related ADRs** | Decisions exist in isolation | Reference related ADRs in the References section |

---

## 12. Enforcement Checklist

- [ ] **ADR template exists** — team has a standard template in the repo
- [ ] **ADR directory exists** — `docs/adr/` in the repository root
- [ ] **Index file maintained** — README.md lists all ADRs with status
- [ ] **ADRs written at decision time** — not retroactively
- [ ] **Every ADR has alternatives** — what was considered and why rejected
- [ ] **Every ADR has consequences** — both positive and negative
- [ ] **ADRs are immutable** — status changes via supersede, not edit
- [ ] **ADRs are reviewed** — PR-based review with 48-72 hour turnaround
- [ ] **ADRs are communicated** — team is notified of accepted decisions
- [ ] **Significant decisions have ADRs** — technology choices, architecture patterns, data strategies
- [ ] **ADRs reference each other** — related decisions are linked
