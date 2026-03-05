---
mode: manual
paths:
  - "src/**/*.ts"
  - "src/**/*.js"
  - "src/**/*.py"
  - "src/**/*.java"
---
## Event-Driven Architecture

### Event Naming & Schema
- Name events in past tense describing what happened: `OrderPlaced`, `PaymentProcessed`, `UserRegistered`
- NEVER name events as commands: `PlaceOrder` is a command, `OrderPlaced` is an event
- Use domain-qualified names: `{bounded-context}.{aggregate}.{event}` (e.g., `billing.invoice.InvoiceIssued`)
- Every event schema MUST include:
  - `eventId` (UUID) — unique per event instance
  - `eventType` — fully qualified event name
  - `occurredAt` — ISO 8601 UTC timestamp
  - `aggregateId` — ID of the entity that produced the event
  - `version` — schema version number (integer)
  - `payload` — event-specific data
- Schema changes: add fields with defaults (backward compatible) or increment version (breaking)
- Publish a schema registry or shared types package — consumers must not guess event structure

### Event Production
- Publish events AFTER the state change is committed — never before
- Use transactional outbox pattern for databases without native event support:
  1. Write event to outbox table in same transaction as state change
  2. Background worker polls outbox and publishes to message broker
  3. Mark event as published after broker acknowledgment
- NEVER publish events from application code outside the aggregate that owns the state change
- Include only data that existed at the time of the event — no derived or computed fields
- Log every published event with `eventId` and `eventType` at INFO level

### Event Consumption
- Every consumer MUST be idempotent — processing the same event twice produces the same result
- Track processed `eventId` values to detect and skip duplicates
- NEVER assume event ordering across different aggregates — design for out-of-order delivery
- Within a single aggregate, use partition keys to preserve ordering where the broker supports it
- Consumer logic belongs in application layer — never in infrastructure/transport handlers
- Each consumer serves ONE purpose — never multiplex unrelated logic in a single handler
- Acknowledge events only AFTER successful processing — not before

### Dead Letter Queues & Retry
- Configure a dead letter queue (DLQ) for every event subscription
- Retry with exponential backoff: 1s, 5s, 30s, 5min — max 5 attempts before DLQ
- DLQ events MUST be monitored — alert when DLQ depth exceeds threshold
- Include original error message, stack trace, and attempt count in DLQ metadata
- Implement tooling to replay DLQ events after fixing the root cause
- NEVER silently drop failed events — every event must reach DLQ or succeed

### Saga & Choreography Patterns
- Choreography (event chain): each service reacts to events independently
  - Use when: fewer than 4 steps, low coordination complexity
  - Every step MUST have a compensating action for rollback
- Orchestration (saga coordinator): central coordinator drives the workflow
  - Use when: complex workflows, conditional branching, timeout requirements
  - Orchestrator owns the state machine — persists step progress
- Document the full saga flow diagram in the feature README
- Implement timeout for every saga — do not allow sagas to remain incomplete indefinitely
- Test compensation/rollback paths with the same rigor as the happy path

### CQRS Pattern (When Applicable)
- Separate command (write) and query (read) models when read/write patterns differ significantly
- Command side: validates, applies business rules, emits events
- Query side: builds read-optimized projections from events — denormalize freely
- Projections may be eventually consistent — document the expected lag
- NEVER query the write model for display purposes when using CQRS — use projections
- Rebuild projections from event history — projections are disposable, events are the source of truth
