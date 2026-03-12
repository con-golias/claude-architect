# Distributed Transactions

> **Domain:** Database > Transactions
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

In a monolithic application, a single database transaction handles everything. In microservices, data is split across multiple databases — the order service has its own DB, the payment service has its own, the inventory service has its own. When a user places an order, you need to debit payment, reserve inventory, and create the order — across three separate databases. If payment succeeds but inventory fails, you have charged the user for an item you cannot ship. Distributed transactions solve this problem, but each approach (2PC, Saga, Outbox) has fundamentally different tradeoffs in consistency, performance, and complexity.

---

## How It Works

### The Problem: No ACID Across Databases

```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Order Service  │  │Payment Service │  │Inventory Svc  │
│               │  │               │  │               │
│  ┌─────────┐  │  │  ┌─────────┐  │  │  ┌─────────┐  │
│  │Orders DB│  │  │  │Payment  │  │  │  │Inventory│  │
│  │         │  │  │  │  DB     │  │  │  │  DB     │  │
│  └─────────┘  │  │  └─────────┘  │  │  └─────────┘  │
└───────────────┘  └───────────────┘  └───────────────┘

Problem: No single transaction spans all three databases.
         BEGIN; UPDATE orders; UPDATE payments; UPDATE inventory; COMMIT;
         ← This is IMPOSSIBLE across separate databases.
```

---

### Pattern 1: Two-Phase Commit (2PC)

```
┌──────────────────────────────────────────────────────────┐
│                 TWO-PHASE COMMIT (2PC)                    │
│                                                           │
│  Phase 1: PREPARE (Voting)                               │
│  ──────────────────────────────                          │
│  Coordinator ──PREPARE──► Participant A → "YES, I can"   │
│              ──PREPARE──► Participant B → "YES, I can"   │
│              ──PREPARE──► Participant C → "NO, I cannot"  │
│                                                           │
│  Phase 2: COMMIT or ABORT                                │
│  ────────────────────────                                │
│  If ALL said YES:                                        │
│    Coordinator ──COMMIT──► All participants               │
│  If ANY said NO:                                         │
│    Coordinator ──ABORT───► All participants               │
│                                                           │
│  Timeline:                                               │
│  ┌────────┐  PREPARE   ┌────────┐  COMMIT   ┌────────┐  │
│  │Coord.  │──────────►│All vote│──────────►│All     │  │
│  │starts  │           │YES/NO  │           │commit  │  │
│  └────────┘           └────────┘           └────────┘  │
│                                                           │
│  Problem: If coordinator crashes between PREPARE and     │
│  COMMIT → all participants are BLOCKED (holding locks)   │
└──────────────────────────────────────────────────────────┘
```

**2PC implementation (PostgreSQL PREPARE TRANSACTION):**

```sql
-- Coordinator prepares all participants
-- Participant A (Orders DB):
PREPARE TRANSACTION 'order-tx-001';

-- Participant B (Payment DB):
PREPARE TRANSACTION 'payment-tx-001';

-- Participant C (Inventory DB):
PREPARE TRANSACTION 'inventory-tx-001';

-- If all prepared successfully:
COMMIT PREPARED 'order-tx-001';
COMMIT PREPARED 'payment-tx-001';
COMMIT PREPARED 'inventory-tx-001';

-- If any failed:
ROLLBACK PREPARED 'order-tx-001';
ROLLBACK PREPARED 'payment-tx-001';
ROLLBACK PREPARED 'inventory-tx-001';
```

**2PC pros and cons:**

| Aspect | Detail |
|--------|--------|
| Consistency | Strong — all or nothing |
| Performance | Poor — blocking protocol, holds locks during both phases |
| Availability | Low — coordinator is single point of failure |
| Scalability | Poor — locks across databases limit throughput |
| Complexity | Moderate — need coordinator, recovery logic |
| Use cases | Legacy systems, tightly coupled services, small number of participants |

**CRITICAL limitation:** 2PC is a **blocking protocol**. If the coordinator crashes after sending PREPARE but before sending COMMIT, all participants hold their locks indefinitely until the coordinator recovers. This is why 2PC is rarely used in modern microservices.

---

### Pattern 2: Saga Pattern

A Saga is a sequence of local transactions where each step has a compensating action that undoes its effect:

```
┌──────────────────────────────────────────────────────────────┐
│                      SAGA — Happy Path                        │
│                                                               │
│  Step 1              Step 2              Step 3               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    │
│  │Create Order │────►│Charge       │────►│Reserve      │    │
│  │(PENDING)    │     │Payment      │     │Inventory    │    │
│  └─────────────┘     └─────────────┘     └─────────────┘    │
│                                                    │          │
│                                               ┌────▼────┐    │
│                                               │Confirm  │    │
│                                               │Order    │    │
│                                               │(DONE)   │    │
│                                               └─────────┘    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   SAGA — Failure + Compensation               │
│                                                               │
│  Step 1              Step 2              Step 3               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    │
│  │Create Order │────►│Charge       │────►│Reserve      │    │
│  │(PENDING)    │     │Payment ✓    │     │Inventory ✗  │    │
│  └─────────────┘     └─────────────┘     └──────┬──────┘    │
│        ▲                    ▲                     │           │
│        │                    │                FAIL │           │
│  ┌─────┴──────┐     ┌──────┴──────┐              │           │
│  │Cancel Order│◄────│Refund       │◄─────────────┘           │
│  │(CANCELLED) │     │Payment      │  Compensating            │
│  └────────────┘     └─────────────┘  transactions            │
└──────────────────────────────────────────────────────────────┘
```

#### Orchestration Saga (Central Coordinator)

```
┌──────────────────────────────────────────────────────────┐
│              ORCHESTRATION SAGA                           │
│                                                          │
│               ┌──────────────┐                           │
│               │  Saga        │                           │
│               │  Orchestrator│                           │
│               └──────┬───────┘                           │
│                      │                                   │
│           ┌──────────┼──────────┐                        │
│           │          │          │                        │
│     ┌─────▼────┐ ┌──▼──────┐ ┌▼─────────┐             │
│     │  Order   │ │ Payment │ │ Inventory │             │
│     │ Service  │ │ Service │ │  Service  │             │
│     └──────────┘ └─────────┘ └───────────┘             │
│                                                          │
│  Orchestrator tells each service what to do.            │
│  Orchestrator manages state machine of the saga.        │
│  If a step fails, orchestrator sends compensations.     │
└──────────────────────────────────────────────────────────┘
```

```typescript
// TypeScript — Saga Orchestrator
interface SagaStep<T> {
  name: string;
  execute: (context: T) => Promise<void>;
  compensate: (context: T) => Promise<void>;
}

class SagaOrchestrator<T> {
  private steps: SagaStep<T>[] = [];
  private completedSteps: SagaStep<T>[] = [];

  addStep(step: SagaStep<T>): this {
    this.steps.push(step);
    return this;
  }

  async execute(context: T): Promise<void> {
    for (const step of this.steps) {
      try {
        await step.execute(context);
        this.completedSteps.push(step);
      } catch (error) {
        console.error(`Step "${step.name}" failed: ${error.message}`);
        await this.compensate(context);
        throw new SagaError(`Saga failed at step "${step.name}"`, error);
      }
    }
  }

  private async compensate(context: T): Promise<void> {
    // Compensate in reverse order
    for (const step of this.completedSteps.reverse()) {
      try {
        await step.compensate(context);
      } catch (error) {
        console.error(`Compensation for "${step.name}" failed: ${error.message}`);
        // Log for manual intervention — compensation MUST eventually succeed
      }
    }
  }
}

// Usage
interface OrderContext {
  orderId: string;
  userId: string;
  amount: number;
  paymentId?: string;
  inventoryReservationId?: string;
}

const createOrderSaga = new SagaOrchestrator<OrderContext>()
  .addStep({
    name: 'createOrder',
    execute: async (ctx) => {
      ctx.orderId = await orderService.create(ctx.userId, ctx.amount);
    },
    compensate: async (ctx) => {
      await orderService.cancel(ctx.orderId);
    },
  })
  .addStep({
    name: 'processPayment',
    execute: async (ctx) => {
      ctx.paymentId = await paymentService.charge(ctx.userId, ctx.amount);
    },
    compensate: async (ctx) => {
      await paymentService.refund(ctx.paymentId!);
    },
  })
  .addStep({
    name: 'reserveInventory',
    execute: async (ctx) => {
      ctx.inventoryReservationId = await inventoryService.reserve(ctx.orderId);
    },
    compensate: async (ctx) => {
      await inventoryService.release(ctx.inventoryReservationId!);
    },
  });

// Execute
await createOrderSaga.execute({ userId: 'user-1', amount: 99.99 } as OrderContext);
```

#### Choreography Saga (Event-Driven)

```
┌────────────────────────────────────────────────────────────────┐
│              CHOREOGRAPHY SAGA (No central coordinator)        │
│                                                                 │
│  Order Service         Payment Service       Inventory Service  │
│  ┌────────────┐        ┌────────────┐        ┌────────────┐   │
│  │Create Order│        │            │        │            │   │
│  │(PENDING)   │        │            │        │            │   │
│  └─────┬──────┘        │            │        │            │   │
│        │               │            │        │            │   │
│  emit: OrderCreated    │            │        │            │   │
│        │               │            │        │            │   │
│        └──────────────►│Process     │        │            │   │
│                        │Payment     │        │            │   │
│                        └─────┬──────┘        │            │   │
│                              │               │            │   │
│                  emit: PaymentProcessed      │            │   │
│                              │               │            │   │
│                              └──────────────►│Reserve     │   │
│                                              │Inventory   │   │
│                                              └─────┬──────┘   │
│                                                    │          │
│                                      emit: InventoryReserved  │
│                                                    │          │
│  ◄─────────────────────────────────────────────────┘          │
│  Confirm Order (COMPLETED)                                    │
└────────────────────────────────────────────────────────────────┘
```

**Orchestration vs Choreography:**

| Aspect | Orchestration | Choreography |
|--------|--------------|--------------|
| **Coordinator** | Central saga manager | None — services communicate via events |
| **Coupling** | Services know orchestrator | Services know events, not each other |
| **Complexity** | Centralized logic, easy to understand | Distributed logic, harder to trace |
| **Debugging** | Single place to check state | Must trace across multiple services |
| **Best for** | Complex flows, many steps, branching | Simple linear flows, 3-5 steps |
| **Scalability** | Orchestrator can be bottleneck | Fully distributed |

---

### Pattern 3: Transactional Outbox

The outbox pattern guarantees that a database write and a message publish happen atomically:

```
┌──────────────────────────────────────────────────────────┐
│                 TRANSACTIONAL OUTBOX                      │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │         Single Database Transaction      │             │
│  │                                          │             │
│  │  1. INSERT INTO orders (...)             │             │
│  │  2. INSERT INTO outbox_events (          │             │
│  │       event_type = 'OrderCreated',       │             │
│  │       payload = '{"orderId": "123"}'     │             │
│  │     )                                    │             │
│  │  3. COMMIT;                              │             │
│  │                                          │             │
│  │  Both writes in SAME transaction = ATOMIC│             │
│  └─────────────────────────────────────────┘             │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │    Outbox Relay (separate process)       │             │
│  │                                          │             │
│  │  1. Poll outbox_events table             │             │
│  │  2. Publish event to message broker      │             │
│  │  3. Mark event as published              │             │
│  │                                          │             │
│  │  If relay crashes → events stay in table │             │
│  │  → relay restarts → picks up unpublished │             │
│  │  → at-least-once delivery guaranteed     │             │
│  └─────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────┘
```

**Outbox table schema:**

```sql
CREATE TABLE outbox_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,   -- 'Order', 'Payment'
    aggregate_id   VARCHAR(100) NOT NULL,   -- '123'
    event_type     VARCHAR(100) NOT NULL,   -- 'OrderCreated'
    payload        JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at   TIMESTAMPTZ,             -- NULL = not yet published
    retry_count    INTEGER DEFAULT 0
);

CREATE INDEX idx_outbox_unpublished
    ON outbox_events (created_at)
    WHERE published_at IS NULL;
```

```go
// Go — Outbox pattern implementation
func createOrder(ctx context.Context, db *sql.DB, order Order) error {
    tx, err := db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // 1. Insert order
    _, err = tx.ExecContext(ctx,
        `INSERT INTO orders (id, user_id, total, status)
         VALUES ($1, $2, $3, 'pending')`,
        order.ID, order.UserID, order.Total)
    if err != nil {
        return err
    }

    // 2. Insert outbox event (same transaction)
    payload, _ := json.Marshal(OrderCreatedEvent{
        OrderID: order.ID,
        UserID:  order.UserID,
        Total:   order.Total,
    })
    _, err = tx.ExecContext(ctx,
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
         VALUES ('Order', $1, 'OrderCreated', $2)`,
        order.ID, payload)
    if err != nil {
        return err
    }

    // 3. Commit — both writes succeed or both fail
    return tx.Commit()
}

// Outbox relay (runs as separate goroutine/process)
func relayOutboxEvents(ctx context.Context, db *sql.DB, broker MessageBroker) {
    ticker := time.NewTicker(100 * time.Millisecond) // poll interval
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            events := fetchUnpublishedEvents(ctx, db, 100)
            for _, event := range events {
                err := broker.Publish(event.EventType, event.Payload)
                if err != nil {
                    log.Printf("Failed to publish event %s: %v", event.ID, err)
                    continue
                }
                markAsPublished(ctx, db, event.ID)
            }
        }
    }
}
```

**Alternative: Change Data Capture (CDC) instead of polling**

```
┌──────────┐    WAL/Binlog     ┌──────────┐    Event    ┌──────────┐
│ Database │───────────────────►│ Debezium │────────────►│  Kafka   │
│          │  (stream changes) │ (CDC)    │             │          │
└──────────┘                   └──────────┘             └──────────┘

CDC reads the database transaction log directly.
No polling needed. Lower latency. No outbox table required.
But: more infrastructure complexity (Debezium + Kafka Connect).
```

---

### Pattern Comparison

| Aspect | 2PC | Saga (Orchestration) | Saga (Choreography) | Outbox + Events |
|--------|-----|---------------------|--------------------|-----------------|
| **Consistency** | Strong (ACID) | Eventual | Eventual | Eventual |
| **Coupling** | Tight | Medium (orchestrator) | Loose | Loose |
| **Performance** | Poor (blocking) | Good | Good | Good |
| **Complexity** | Moderate | High (state machine) | High (distributed) | Moderate |
| **Failure handling** | Rollback | Compensating txns | Compensating events | Retry + idempotency |
| **Debugging** | Easy (single tx) | Medium (orchestrator log) | Hard (event trace) | Medium (outbox table) |
| **Scalability** | Poor | Good | Excellent | Good |
| **Best for** | 2-3 tightly coupled DBs | Complex business flows | Simple event chains | Reliable event publishing |

---

## Best Practices

1. **ALWAYS prefer Saga over 2PC** for microservices — 2PC does not scale
2. **ALWAYS design compensating transactions** for every saga step — they are mandatory
3. **ALWAYS make saga steps idempotent** — steps may be retried on failure
4. **ALWAYS use the outbox pattern** when you need "write to DB + publish event" atomically
5. **ALWAYS include correlation IDs** in all saga events for end-to-end tracing
6. **ALWAYS persist saga state** — orchestrator must survive crashes
7. **NEVER assume compensations will always succeed** — have manual intervention process
8. **NEVER use distributed transactions for independent services** — if services are truly independent, they do not need transactions
9. **ALWAYS consider whether you actually need distributed transactions** — often, eventual consistency with idempotent consumers is sufficient
10. **ALWAYS monitor saga completion rates** — incomplete sagas indicate system problems

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| 2PC across microservices | Cascading failures, lock contention | Use Saga pattern instead |
| Saga without compensations | Failed sagas leave inconsistent state | Design compensation for every step |
| Non-idempotent saga steps | Retries create duplicate records | Add idempotency keys to every operation |
| Choreography saga with 10+ steps | Impossible to trace or debug | Switch to orchestration for complex flows |
| Outbox without cleanup | Outbox table grows unbounded | Delete published events after retention period |
| No saga timeout | Stuck sagas hold resources forever | Set TTL, auto-cancel after timeout |
| Publishing events outside transaction | Events published but DB write fails | Use outbox pattern for atomicity |
| Synchronous saga execution | Single failure blocks entire chain | Use async events with message broker |

---

## Real-world Examples

### Uber
- Orchestration Saga for ride lifecycle (request → match → pickup → complete → payment)
- Custom saga framework called Cadence (now Temporal)
- Each step has explicit compensating action
- Saga state persisted in dedicated saga store

### Netflix
- Choreography-based microservices with Kafka events
- Outbox pattern for critical state changes
- CDC (Debezium) for database change streaming
- Idempotent consumers with deduplication table

### Stripe
- Outbox pattern for payment event publishing
- Idempotency keys on all API operations
- Saga-like flow: authorize → capture → settle
- Webhook delivery with outbox for guaranteed delivery

---

## Enforcement Checklist

- [ ] Distributed transaction pattern chosen (Saga, Outbox, or 2PC) with justification
- [ ] Compensating transactions defined for every saga step
- [ ] All saga steps are idempotent (safe to retry)
- [ ] Saga state persisted (survives service restarts)
- [ ] Outbox pattern used for DB write + event publish atomicity
- [ ] Outbox relay process monitored and alerting configured
- [ ] Correlation ID propagated across all saga events
- [ ] Saga timeout configured to prevent stuck sagas
- [ ] Dead letter queue configured for failed events
- [ ] Manual intervention process documented for failed compensations
- [ ] Monitoring dashboard shows saga completion rates and durations
