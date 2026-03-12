# Saga Pattern for Distributed Transactions

> **Domain:** Scalability > Async Processing
> **Importance:** High
> **Last Updated:** 2026-03-10
> **Cross-references:**
> - `03-architecture/architectural-patterns/event-driven/overview.md` — event-driven patterns
> - `10-scalability/async-processing/message-queues.md` — message queue infrastructure
> - `10-scalability/async-processing/event-streaming.md` — event-based communication

---

## Core Concepts

### Why Distributed Transactions Do Not Scale

Two-phase commit (2PC) requires all participants to hold locks until the
coordinator confirms. This creates fundamental scaling problems:

| 2PC Limitation | Impact at Scale |
|---|---|
| Synchronous lock holding | Throughput bottleneck; lock duration = slowest participant |
| Coordinator SPOF | Entire transaction blocks if coordinator crashes |
| Network partition sensitivity | Participants stuck in "prepared" state indefinitely |
| Cross-service coupling | All services must be available simultaneously |

**Sagas replace 2PC** with a sequence of local transactions. If a step fails,
compensating transactions undo the effects of previously completed steps.

### Choreography vs Orchestration

| Aspect | Choreography | Orchestration |
|---|---|---|
| Coordination | Decentralized; services react to events | Centralized; orchestrator directs steps |
| Coupling | Low (services only know events) | Medium (orchestrator knows all services) |
| Visibility | Hard to trace | Easy to trace (single coordinator) |
| Best for | Simple flows (2-3 steps) | Complex flows, conditional logic, monitoring |

### Compensation Logic

Every side-effecting saga step must have a compensating action. Compensating
actions are forward actions that semantically undo the effect, not rollbacks.

| Forward Action | Compensating Action |
|---|---|
| Create order (PENDING) | Update order (CANCELLED) |
| Reserve inventory | Release inventory |
| Charge payment | Issue refund |
| Create shipping label | Cancel shipping label |

**Rules:** compensations must be idempotent, must eventually succeed (retry with
backoff), execute in reverse order, and be logged for audit.

---

## Code Examples

### TypeScript: Orchestrated Saga with Temporal Workflow

```typescript
import { proxyActivities, defineSignal, setHandler, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "./activities";

const {
  createOrder, cancelOrder, reserveInventory, releaseInventory,
  processPayment, refundPayment, confirmShipping, cancelShipping,
  sendConfirmation, sendCancellation,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30s",
  retry: {
    maximumAttempts: 3, backoffCoefficient: 2, initialInterval: "1s",
    nonRetryableErrorTypes: ["InvalidOrderError", "FraudDetectedError"],
  },
});

export const cancelSignal = defineSignal("cancel");

type SagaStep = { name: string; compensate: () => Promise<void> };

export async function orderSaga(input: OrderInput): Promise<string> {
  const completedSteps: SagaStep[] = [];
  let cancelled = false;
  setHandler(cancelSignal, () => { cancelled = true; });

  try {
    const order = await createOrder(input);
    completedSteps.push({ name: "createOrder", compensate: () => cancelOrder(input.orderId) });
    if (cancelled) throw ApplicationFailure.create({ message: "Cancelled" });

    const reservation = await reserveInventory({ orderId: input.orderId, items: input.items });
    completedSteps.push({
      name: "reserveInventory", compensate: () => releaseInventory(reservation.reservationId),
    });
    if (cancelled) throw ApplicationFailure.create({ message: "Cancelled" });

    const payment = await processPayment({
      orderId: input.orderId, customerId: input.customerId,
      amount: input.items.reduce((s, i) => s + i.price * i.quantity, 0),
      idempotencyKey: input.idempotencyKey,
    });
    completedSteps.push({ name: "processPayment", compensate: () => refundPayment(payment.transactionId) });

    const shipping = await confirmShipping({ orderId: input.orderId, items: input.items });
    completedSteps.push({ name: "confirmShipping", compensate: () => cancelShipping(shipping.shipmentId) });

    await sendConfirmation({ orderId: input.orderId, customerId: input.customerId });
    return `Order ${input.orderId} completed`;
  } catch (err) {
    for (const step of completedSteps.reverse()) {
      try { await step.compensate(); } catch (compErr) {
        console.error(`Compensation failed for ${step.name}:`, compErr);
        throw compErr;
      }
    }
    await sendCancellation({ orderId: input.orderId, customerId: input.customerId,
      reason: err instanceof Error ? err.message : "Unknown error" });
    throw err;
  }
}
```

### Temporal Activities: Idempotent Local Transactions (TypeScript)

```typescript
import { ApplicationFailure } from "@temporalio/activity";

export async function createOrder(input: CreateOrderInput) {
  const result = await db.query(
    `INSERT INTO orders (id, customer_id, status, items, created_at)
     VALUES ($1, $2, 'PENDING', $3, NOW())
     ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
     RETURNING id, status`,
    [input.orderId, input.customerId, JSON.stringify(input.items)]
  );
  return { orderId: result.rows[0].id, status: result.rows[0].status };
}

export async function cancelOrder(orderId: string) {
  await db.query(
    `UPDATE orders SET status = 'CANCELLED', updated_at = NOW()
     WHERE id = $1 AND status != 'CANCELLED'`, [orderId]
  );
}

export async function processPayment(input: PaymentInput) {
  const existing = await paymentGateway.findByIdempotencyKey(input.idempotencyKey);
  if (existing) return { transactionId: existing.id };
  const result = await paymentGateway.charge({
    amount: input.amount, customerId: input.customerId, idempotencyKey: input.idempotencyKey,
  });
  if (!result.success) throw ApplicationFailure.nonRetryable(`Payment failed: ${result.error}`);
  return { transactionId: result.transactionId };
}

export async function refundPayment(transactionId: string) {
  await paymentGateway.refund({ transactionId }); // gateway deduplicates by txId
}
```

### Go: Choreography Saga with Event-Driven Compensation

```go
package saga

import (
    "context"
    "encoding/json"
    "log"
    "github.com/nats-io/nats.go"
)

type OrderCreated struct {
    OrderID string  `json:"order_id"`
    Amount  float64 `json:"amount"`
    Items   []Item  `json:"items"`
}

type PaymentFailed struct {
    OrderID string `json:"order_id"`
    Reason  string `json:"reason"`
}

type InventoryService struct {
    nc   *nats.Conn
    repo InventoryRepository
}

func (s *InventoryService) Start(ctx context.Context) error {
    _, err := s.nc.Subscribe("saga.order.created", func(msg *nats.Msg) {
        var event OrderCreated
        if err := json.Unmarshal(msg.Data, &event); err != nil { return }

        reservationID, err := s.repo.Reserve(ctx, event.OrderID, event.Items)
        if err != nil {
            data, _ := json.Marshal(map[string]string{"order_id": event.OrderID, "reason": err.Error()})
            s.nc.Publish("saga.inventory.failed", data)
            return
        }
        data, _ := json.Marshal(map[string]string{"order_id": event.OrderID, "reservation_id": reservationID})
        s.nc.Publish("saga.inventory.reserved", data)
    })
    return err
}

func (s *InventoryService) StartCompensation(ctx context.Context) error {
    _, err := s.nc.Subscribe("saga.payment.failed", func(msg *nats.Msg) {
        var event PaymentFailed
        if err := json.Unmarshal(msg.Data, &event); err != nil { return }
        if err := s.repo.Release(ctx, event.OrderID); err != nil {
            log.Printf("compensation failed for order %s: %v", event.OrderID, err)
            s.nc.Publish("saga.compensation.failed", msg.Data)
        }
    })
    return err
}
```

### Saga State Machine (SQL Schema)

```sql
CREATE TABLE saga_instances (
    saga_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_type      VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(255) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'RUNNING'
                   CHECK (status IN ('RUNNING','COMPLETED','COMPENSATING','FAILED')),
    current_step   INT NOT NULL DEFAULT 0,
    payload        JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (saga_type, correlation_id)
);

CREATE TABLE saga_steps (
    id            BIGSERIAL PRIMARY KEY,
    saga_id       UUID NOT NULL REFERENCES saga_instances(saga_id),
    step_index    INT NOT NULL,
    step_name     VARCHAR(100) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','COMPENSATED')),
    error_message TEXT,
    completed_at  TIMESTAMPTZ,
    UNIQUE (saga_id, step_index)
);

CREATE INDEX idx_saga_active ON saga_instances(status) WHERE status IN ('RUNNING','COMPENSATING');

-- Find stuck sagas
SELECT saga_id, saga_type, correlation_id, NOW() - created_at AS duration
FROM saga_instances
WHERE status IN ('RUNNING','COMPENSATING') AND updated_at < NOW() - INTERVAL '30 minutes';
```

---

## Idempotency Strategies for Saga Steps

| Strategy | Mechanism | Best For |
|---|---|---|
| Database unique constraint | `ON CONFLICT DO NOTHING` | Create operations |
| Idempotency key table | Check key before executing | External API calls |
| Conditional update | `UPDATE WHERE status != target` | Status transitions |
| Natural idempotency | Inherently repeatable (read-only) | Validation steps |

## Monitoring Metrics

| Metric | Alert Threshold | Purpose |
|---|---|---|
| Saga completion rate | < 99% over 5 min | Detect systemic failures |
| Saga duration (p99) | > 2x expected | Detect slow participants |
| Compensation rate | > 5% over 15 min | Detect business logic issues |
| Stuck sagas | Any > 30 min | Detect infrastructure failures |
| Compensation failures | Any occurrence | Requires manual intervention |

---

## 10 Best Practices

1. **Make every saga step and compensation idempotent** — use idempotency keys,
   database constraints, or conditional updates.
2. **Use orchestration for sagas with more than 3 steps** — choreography becomes
   untraceable beyond 3 services.
3. **Store saga state in a durable database** — enable debugging, auditing, and
   manual intervention for stuck sagas.
4. **Design compensations as forward actions, not rollbacks** — compensations
   must succeed in a world where the original action's effects are visible.
5. **Set timeouts on every saga step** — prevent indefinite waiting; trigger
   compensation after timeout expires.
6. **Include correlation ID in every saga event** — enables end-to-end tracing
   across all participating services.
7. **Implement a saga dashboard** — display active, completed, stuck, and
   failed sagas for operations visibility.
8. **Test compensation paths as thoroughly as the happy path** — inject failures
   at every step during integration testing.
9. **Classify non-retryable errors** — distinguish between transient errors
   (retry) and business errors (compensate immediately).
10. **Version saga definitions** — run old and new versions concurrently until
    all in-flight sagas of the old version complete.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|---|---|---|
| 1 | Missing compensation for a step | Data inconsistency on failure | Every side-effecting step needs a compensating action |
| 2 | Non-idempotent saga steps | Duplicate charges, double reservations | Use idempotency keys and conditional updates |
| 3 | Synchronous saga execution | Blocks calling thread | Execute async; return saga ID for status polling |
| 4 | Compensating with DB rollback | Other services already saw the effect | Use semantic undo (refund, release, cancel) |
| 5 | No timeout on saga steps | Single slow service blocks saga | Set per-step timeout; compensate on expiry |
| 6 | Choreography with >4 services | Impossible to trace or debug | Switch to orchestration with a workflow engine |
| 7 | Ignoring compensation failures | Inconsistent state | Alert immediately; implement manual resolution queue |
| 8 | Coupling saga to specific transport | Cannot test or switch brokers | Abstract event publishing behind an interface |

---

## Enforcement Checklist

- [ ] Every saga step has a documented compensating action
- [ ] All saga steps (forward and compensating) are verified idempotent
- [ ] Saga state persisted in a durable store (database, Temporal)
- [ ] Correlation ID propagates through every event in the saga
- [ ] Per-step timeouts configured with compensation on expiry
- [ ] Compensation path tested with fault injection at every step
- [ ] Saga monitoring dashboard shows active, completed, failed, and stuck sagas
- [ ] Stuck saga alert fires when any saga exceeds maximum expected duration
- [ ] Compensation failure alert triggers immediate oncall notification
- [ ] Saga definitions are versioned; old versions drain before removal
- [ ] Non-retryable errors classified and skip straight to compensation
- [ ] Integration tests cover: happy path, failure at each step, concurrent sagas
