# CQRS and Event Sourcing for Scale

| Field        | Value                                                                       |
|--------------|-----------------------------------------------------------------------------|
| Domain       | Scalability > Database Scaling                                              |
| Importance   | High                                                                        |
| Applies To   | Write-heavy systems, audit-critical domains, independently scaled R/W paths |
| Cross-ref    | `03-architecture/architectural-patterns/event-driven/cqrs.md`               |
| Last Updated | 2026-03-10                                                                  |

---

## Core Concepts

### CQRS: Separate Read and Write Models

Command Query Responsibility Segregation splits the data path into two independent models:

| Aspect          | Command (Write) Side                        | Query (Read) Side                           |
|-----------------|---------------------------------------------|---------------------------------------------|
| Model           | Domain aggregates, enforces invariants      | Denormalized projections, optimized for reads|
| Database        | OLTP-optimized (PostgreSQL, event store)    | Read-optimized (Elasticsearch, Redis, PG views)|
| Scaling axis    | Vertical or partitioned by aggregate        | Horizontal via replicas and caches          |
| Consistency     | Strongly consistent within aggregate        | Eventually consistent with write side       |
| Schema coupling | Changes rarely, driven by domain rules      | Changes often, driven by UI/API needs       |

### Event Sourcing: Append-Only Event Log

Store every state change as an immutable event. The current state is derived by replaying
events from the beginning (or from a snapshot).

Key properties:
- **Append-only** -- events are never updated or deleted.
- **Temporal queries** -- reconstruct state at any point in time.
- **Audit trail** -- complete history of every change with actor and timestamp.
- **Replay** -- rebuild read models or fix projections by replaying the event log.

### When CQRS Adds Unnecessary Complexity (Decision Framework)

Use this framework before adopting CQRS. Answer each question; if most answers are "No,"
CQRS is likely premature.

| Question                                                         | Yes -> CQRS Adds Value | No -> Stay Simple       |
|------------------------------------------------------------------|------------------------|-------------------------|
| Do reads and writes have fundamentally different data shapes?    | Separate models help   | Single model suffices   |
| Do reads and writes need to scale independently?                 | CQRS enables this      | Shared scaling is fine  |
| Is there a strong audit or temporal query requirement?           | Event sourcing fits    | Standard tables suffice |
| Are write rates > 10x read rates (or vice versa)?               | Independent scaling    | Balanced load is simple |
| Does the domain have complex business rules on writes?           | Command model isolates | Thin CRUD is adequate   |
| Is the team experienced with eventual consistency?               | Can handle complexity  | Risk of subtle bugs     |

### Materializing Read Models

| Target Store      | Strengths                                 | Use When                                     |
|-------------------|-------------------------------------------|----------------------------------------------|
| PostgreSQL Views  | Familiar, transactional, SQL queries      | Moderate read load, relational queries       |
| Elasticsearch     | Full-text search, aggregations            | Search-heavy UIs, faceted filtering          |
| Redis             | Sub-millisecond reads, key-value access   | Hot-path lookups, session data, leaderboards |
| DynamoDB / Mongo  | Flexible schema, high throughput          | Document-oriented read patterns              |

---

## Code Examples

### TypeScript: Event Store with Projections

```typescript
import { randomUUID } from "crypto";

// --- Domain Events ---
interface DomainEvent {
  eventId: string;
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  version: number;
}

// --- Event Store ---
class EventStore {
  private streams = new Map<string, DomainEvent[]>();

  async append(
    aggregateId: string,
    events: Omit<DomainEvent, "eventId" | "timestamp">[],
    expectedVersion: number
  ): Promise<void> {
    const stream = this.streams.get(aggregateId) ?? [];
    if (stream.length !== expectedVersion) {
      throw new Error(
        `Concurrency conflict: expected version ${expectedVersion}, found ${stream.length}`
      );
    }
    const enriched = events.map((e) => ({
      ...e,
      eventId: randomUUID(),
      timestamp: new Date(),
    }));
    this.streams.set(aggregateId, [...stream, ...enriched]);

    // Notify projections asynchronously.
    for (const event of enriched) {
      await this.notifyProjections(event);
    }
  }

  async load(aggregateId: string): Promise<DomainEvent[]> {
    return this.streams.get(aggregateId) ?? [];
  }

  private projections: Projection[] = [];

  registerProjection(p: Projection): void {
    this.projections.push(p);
  }

  private async notifyProjections(event: DomainEvent): Promise<void> {
    for (const p of this.projections) {
      await p.handle(event);
    }
  }
}

// --- Projection Interface ---
interface Projection {
  handle(event: DomainEvent): Promise<void>;
}

// --- Order Summary Projection (materialized into a read store) ---
interface OrderSummary {
  orderId: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  updatedAt: Date;
}

class OrderSummaryProjection implements Projection {
  private store = new Map<string, OrderSummary>();

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case "OrderCreated": {
        this.store.set(event.aggregateId, {
          orderId: event.aggregateId,
          status: "created",
          totalAmount: event.payload.totalAmount as number,
          itemCount: event.payload.itemCount as number,
          updatedAt: event.timestamp,
        });
        break;
      }
      case "OrderShipped": {
        const existing = this.store.get(event.aggregateId);
        if (existing) {
          existing.status = "shipped";
          existing.updatedAt = event.timestamp;
        }
        break;
      }
    }
  }

  query(orderId: string): OrderSummary | undefined {
    return this.store.get(orderId);
  }
}
```

### Go: CQRS Command/Query Bus with Separate Read/Write Databases

```go
package cqrs

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "time"

    "github.com/google/uuid"
)

// --- Commands and Queries ---

type Command interface{ CommandName() string }
type Query interface{ QueryName() string }

type CreateOrderCmd struct {
    CustomerID string
    Items      []OrderItem
}
func (c CreateOrderCmd) CommandName() string { return "CreateOrder" }

type OrderItem struct {
    ProductID string
    Quantity  int
    Price     float64
}

type GetOrderQuery struct{ OrderID string }
func (q GetOrderQuery) QueryName() string { return "GetOrder" }

// --- Event ---

type Event struct {
    ID          string          `json:"id"`
    AggregateID string          `json:"aggregate_id"`
    Type        string          `json:"type"`
    Payload     json.RawMessage `json:"payload"`
    CreatedAt   time.Time       `json:"created_at"`
}

// --- Command Handler (writes to the write DB) ---

type CommandHandler struct {
    writeDB *sql.DB
}

func (h *CommandHandler) Handle(ctx context.Context, cmd Command) error {
    switch c := cmd.(type) {
    case CreateOrderCmd:
        return h.createOrder(ctx, c)
    default:
        return fmt.Errorf("unknown command: %s", cmd.CommandName())
    }
}

func (h *CommandHandler) createOrder(ctx context.Context, cmd CreateOrderCmd) error {
    orderID := uuid.New().String()
    payload, _ := json.Marshal(cmd)
    _, err := h.writeDB.ExecContext(ctx,
        `INSERT INTO events (id, aggregate_id, type, payload, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        uuid.New().String(), orderID, "OrderCreated", payload, time.Now(),
    )
    return err
}

// --- Query Handler (reads from the read DB) ---

type QueryHandler struct {
    readDB *sql.DB
}

type OrderView struct {
    OrderID    string  `json:"order_id"`
    CustomerID string  `json:"customer_id"`
    Status     string  `json:"status"`
    Total      float64 `json:"total"`
}

func (h *QueryHandler) Handle(ctx context.Context, q Query) (any, error) {
    switch qr := q.(type) {
    case GetOrderQuery:
        return h.getOrder(ctx, qr)
    default:
        return nil, fmt.Errorf("unknown query: %s", q.QueryName())
    }
}

func (h *QueryHandler) getOrder(ctx context.Context, q GetOrderQuery) (*OrderView, error) {
    var view OrderView
    err := h.readDB.QueryRowContext(ctx,
        `SELECT order_id, customer_id, status, total
         FROM order_views WHERE order_id = $1`, q.OrderID,
    ).Scan(&view.OrderID, &view.CustomerID, &view.Status, &view.Total)
    if err != nil {
        return nil, fmt.Errorf("order not found: %w", err)
    }
    return &view, nil
}
```

### SQL: Event Store Schema and Read Model Materialization

```sql
-- Event store table (append-only, write side).
CREATE TABLE events (
    event_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    type         TEXT NOT NULL,
    version      INT  NOT NULL,
    payload      JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (aggregate_id, version)
);

CREATE INDEX idx_events_aggregate ON events (aggregate_id, version);

-- Materialized read model (query side).
CREATE TABLE order_read_model (
    order_id     UUID PRIMARY KEY,
    customer_id  UUID NOT NULL,
    status       TEXT NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    item_count   INT  NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL
);

-- Projection: rebuild the read model from events.
-- Run this as a batch job or trigger it from the event publisher.
INSERT INTO order_read_model (order_id, customer_id, status, total_amount, item_count, updated_at)
SELECT
    e.aggregate_id,
    (e.payload->>'customerID')::UUID,
    CASE
        WHEN EXISTS (SELECT 1 FROM events e2
                     WHERE e2.aggregate_id = e.aggregate_id AND e2.type = 'OrderShipped')
        THEN 'shipped'
        ELSE 'created'
    END,
    (e.payload->>'totalAmount')::NUMERIC,
    (e.payload->>'itemCount')::INT,
    e.created_at
FROM events e
WHERE e.type = 'OrderCreated'
ON CONFLICT (order_id) DO UPDATE SET
    status       = EXCLUDED.status,
    total_amount = EXCLUDED.total_amount,
    item_count   = EXCLUDED.item_count,
    updated_at   = EXCLUDED.updated_at;
```

### Temporal Query: Reconstruct State at a Point in Time

```sql
-- Get the state of an order as of a specific timestamp.
SELECT
    aggregate_id,
    type,
    payload,
    created_at
FROM events
WHERE aggregate_id = '550e8400-e29b-41d4-a716-446655440000'
  AND created_at <= '2026-01-15 14:30:00+00'
ORDER BY version ASC;
```

---

## Scaling Writes Independently from Reads

| Strategy                         | Mechanism                                                  | Effect                                      |
|----------------------------------|------------------------------------------------------------|---------------------------------------------|
| Partition event store by aggregate| Shard the events table on `aggregate_id`                  | Writes distribute across partitions         |
| Async projection workers         | Consume event stream in parallel workers                  | Read model build-out scales horizontally    |
| Separate databases               | Write DB (PostgreSQL) + Read DB (Elasticsearch / Redis)   | Each side scales on its own axis            |
| Snapshotting                     | Store periodic aggregate snapshots to reduce replay cost  | Reduces read-side rebuild time              |

---

## 10 Best Practices

1. **Start with CQRS without event sourcing.** Separate read/write models provide scaling benefits even with a traditional database; add event sourcing only when audit or replay is required.
2. **Design events as immutable facts.** Never modify or delete events; use compensating events (e.g., `OrderCancelled`) to represent reversals.
3. **Version events from day one.** Include a schema version in every event type so projections can handle old and new formats during evolution.
4. **Keep projections idempotent.** A projection must produce the same read model whether it processes an event once or multiple times.
5. **Implement snapshotting for aggregates with many events.** When replay exceeds 100 ms, store periodic snapshots to bound reconstruction time.
6. **Monitor projection lag as an SLI.** Measure the delay between event creation and read model update; alert when lag exceeds the acceptable window.
7. **Use optimistic concurrency on the event store.** Enforce the `(aggregate_id, version)` unique constraint to prevent conflicting writes.
8. **Separate the event bus from the event store.** Persist events first, then publish to the bus; never rely on the bus as the source of truth.
9. **Build replay tooling before going to production.** The ability to rebuild any projection from scratch is a core operational requirement, not a nice-to-have.
10. **Scope CQRS to bounded contexts that need it.** Apply CQRS to high-scale or complex domains; keep simple CRUD services on a single model.

---

## 8 Anti-Patterns

| #  | Anti-Pattern                            | Problem                                                     | Correct Approach                                             |
|----|-----------------------------------------|-------------------------------------------------------------|--------------------------------------------------------------|
| 1  | CQRS everywhere                        | Adds complexity to simple CRUD with no scaling benefit      | Apply CQRS only to bounded contexts that need independent scaling |
| 2  | Mutable event store                    | Editing events destroys the audit trail and breaks replay   | Treat events as immutable; append compensating events instead|
| 3  | Synchronous projections in write path  | Write latency increases with every new projection           | Project asynchronously via event bus or background workers   |
| 4  | No idempotency in projections          | Duplicate event delivery corrupts the read model            | Use event ID or version tracking to skip already-processed events|
| 5  | Querying the event store directly      | Event store is not optimized for ad-hoc queries; slow scans | Query the materialized read model; rebuild it via replay     |
| 6  | Unbounded event replay on startup      | Service takes minutes to start when replaying millions of events | Use snapshots and checkpoint-based replay                  |
| 7  | Coupling read and write schemas        | Changes to one side force changes to the other              | Evolve read and write schemas independently via projections  |
| 8  | Skipping compensating events           | Soft-deletes or flags hide intent; audit trail is incomplete| Record explicit compensating events for every reversal       |

---

## Enforcement Checklist

- [ ] CQRS adoption decision is documented with answers to the decision framework questions
- [ ] Read and write models use separate database connections (or separate databases)
- [ ] Event store schema enforces append-only semantics with `(aggregate_id, version)` unique constraint
- [ ] All events are immutable; no UPDATE or DELETE statements target the events table
- [ ] Every event type includes a schema version field
- [ ] Projections are idempotent and handle duplicate delivery without corruption
- [ ] Projection lag is monitored and alerted when exceeding the defined SLO
- [ ] Snapshotting is implemented for aggregates exceeding 500 events
- [ ] Replay tooling can rebuild any projection from scratch and is tested quarterly
- [ ] Optimistic concurrency conflict handling is tested with concurrent write scenarios
- [ ] Event bus is decoupled from the event store; events are persisted before publishing
- [ ] CQRS is scoped to specific bounded contexts; simple services remain on single-model CRUD
