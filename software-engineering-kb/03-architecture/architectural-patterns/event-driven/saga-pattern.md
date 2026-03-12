# Saga Pattern — Complete Specification

> **AI Plugin Directive:** The Saga pattern manages distributed transactions across multiple services or modules WITHOUT using two-phase commit (2PC). Instead of one atomic transaction, a saga is a sequence of LOCAL transactions with COMPENSATING transactions for rollback. 2PC is FORBIDDEN in microservices — use sagas instead. Every multi-service business process MUST be implemented as a saga.

---

## 1. The Core Rule

**A saga is a sequence of local transactions where each step has a compensating action that undoes its effect. If step N fails, compensating transactions for steps N-1 through 1 are executed IN REVERSE ORDER. Each local transaction is atomic within its own service. The overall process achieves eventual consistency.**

```
SAGA FLOW (Happy Path):
  T1 → T2 → T3 → T4 → SUCCESS

SAGA FLOW (Failure at T3):
  T1 → T2 → T3 (FAIL) → C2 → C1 → COMPENSATED

Where:
  T1 = Create Order (local transaction in Ordering service)
  T2 = Reserve Inventory (local transaction in Inventory service)
  T3 = Capture Payment (local transaction in Payment service)
  T4 = Confirm Order (local transaction in Ordering service)
  C2 = Release Inventory (compensating for T2)
  C1 = Cancel Order (compensating for T1)
```

---

## 2. Choreography-Based Saga

### How It Works

```
Each service listens for events and reacts independently.
No central coordinator. Services collaborate through events.

FLOW:
  OrderService → publishes OrderCreated
  InventoryService → hears OrderCreated → reserves stock → publishes StockReserved
  PaymentService → hears StockReserved → captures payment → publishes PaymentCaptured
  OrderService → hears PaymentCaptured → confirms order → publishes OrderConfirmed

COMPENSATION:
  PaymentService → capture fails → publishes PaymentFailed
  InventoryService → hears PaymentFailed → releases stock → publishes StockReleased
  OrderService → hears StockReleased → cancels order → publishes OrderCancelled
```

### Implementation

```typescript
// Each service handles events and publishes its own events

// === ORDERING SERVICE ===
class OrderService {
  async placeOrder(command: PlaceOrderCommand): Promise<string> {
    const order = Order.create(command.customerId, command.items);
    await this.orderRepo.save(order);
    await this.eventBus.publish(new OrderCreatedEvent({
      orderId: order.id.value,
      customerId: command.customerId,
      items: command.items,
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency,
    }));
    return order.id.value;
  }

  // Happy path: payment succeeded
  async onPaymentCaptured(event: PaymentCapturedEvent): Promise<void> {
    const order = await this.orderRepo.findById(event.payload.orderId);
    order.confirm();
    await this.orderRepo.save(order);
    await this.eventBus.publish(new OrderConfirmedEvent({ orderId: order.id.value }));
  }

  // Compensation: payment failed
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    const order = await this.orderRepo.findById(event.payload.orderId);
    order.cancel('Payment failed: ' + event.payload.reason);
    await this.orderRepo.save(order);
    await this.eventBus.publish(new OrderCancelledEvent({
      orderId: order.id.value,
      reason: event.payload.reason,
    }));
  }

  // Compensation: stock reservation failed
  async onStockReservationFailed(event: StockReservationFailedEvent): Promise<void> {
    const order = await this.orderRepo.findById(event.payload.orderId);
    order.cancel('Out of stock: ' + event.payload.productId);
    await this.orderRepo.save(order);
    await this.eventBus.publish(new OrderCancelledEvent({
      orderId: order.id.value,
      reason: 'Product out of stock',
    }));
  }
}

// === INVENTORY SERVICE ===
class InventoryService {
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      for (const item of event.payload.items) {
        await this.inventoryRepo.reserve(
          item.productId, item.quantity, event.payload.orderId,
        );
      }
      await this.eventBus.publish(new StockReservedEvent({
        orderId: event.payload.orderId,
        items: event.payload.items,
      }));
    } catch (error) {
      // Release any partial reservations
      await this.inventoryRepo.releaseAll(event.payload.orderId);
      await this.eventBus.publish(new StockReservationFailedEvent({
        orderId: event.payload.orderId,
        productId: (error as InsufficientStockError).productId,
        reason: error.message,
      }));
    }
  }

  // Compensation: release stock when order is cancelled
  async onOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    await this.inventoryRepo.releaseAll(event.payload.orderId);
  }
}

// === PAYMENT SERVICE ===
class PaymentService {
  async onStockReserved(event: StockReservedEvent): Promise<void> {
    try {
      const payment = await this.paymentGateway.capture(
        event.payload.orderId,
        event.payload.totalAmount,
        event.payload.currency,
      );
      await this.eventBus.publish(new PaymentCapturedEvent({
        orderId: event.payload.orderId,
        paymentId: payment.id,
        amount: payment.amount,
      }));
    } catch (error) {
      await this.eventBus.publish(new PaymentFailedEvent({
        orderId: event.payload.orderId,
        reason: error.message,
      }));
    }
  }

  // Compensation: refund when order is cancelled after payment
  async onOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    const payment = await this.paymentRepo.findByOrderId(event.payload.orderId);
    if (payment && payment.status === 'captured') {
      await this.paymentGateway.refund(payment.id);
    }
  }
}
```

### Choreography: When to Use

```
✅ USE CHOREOGRAPHY WHEN:
  - 2-4 steps in the saga
  - Simple, linear flow (no branching)
  - Teams are decentralized and independent
  - Each service can make independent decisions

❌ AVOID CHOREOGRAPHY WHEN:
  - 5+ steps (gets hard to follow)
  - Complex branching or conditional logic
  - Need visibility into saga progress
  - Need centralized error handling
```

---

## 3. Orchestration-Based Saga

### How It Works

```
A central ORCHESTRATOR (saga coordinator) tells each service
what to do and in what order. The orchestrator manages the flow,
retries, and compensation.

FLOW:
  Orchestrator → OrderService.createOrder()
  Orchestrator → InventoryService.reserveStock()
  Orchestrator → PaymentService.capturePayment()
  Orchestrator → OrderService.confirmOrder()
  Orchestrator → SAGA COMPLETE

COMPENSATION:
  Orchestrator → PaymentService.capturePayment() → FAILS
  Orchestrator → InventoryService.releaseStock()  (compensate step 2)
  Orchestrator → OrderService.cancelOrder()        (compensate step 1)
  Orchestrator → SAGA COMPENSATED
```

### Implementation

```typescript
// Saga definition: each step has an action and a compensation
interface SagaStep<TContext> {
  name: string;
  execute(context: TContext): Promise<void>;
  compensate(context: TContext): Promise<void>;
}

// Generic saga executor
class SagaExecutor<TContext> {
  constructor(
    private readonly steps: SagaStep<TContext>[],
    private readonly sagaLog: SagaLog,
  ) {}

  async execute(sagaId: string, context: TContext): Promise<SagaResult> {
    const executedSteps: SagaStep<TContext>[] = [];

    try {
      for (const step of this.steps) {
        await this.sagaLog.record(sagaId, step.name, 'executing');
        await step.execute(context);
        await this.sagaLog.record(sagaId, step.name, 'completed');
        executedSteps.push(step);
      }

      await this.sagaLog.record(sagaId, 'saga', 'completed');
      return { status: 'completed', sagaId };

    } catch (error) {
      await this.sagaLog.record(sagaId, 'saga', 'compensating', error.message);

      // Compensate in REVERSE order
      for (const step of executedSteps.reverse()) {
        try {
          await this.sagaLog.record(sagaId, step.name, 'compensating');
          await step.compensate(context);
          await this.sagaLog.record(sagaId, step.name, 'compensated');
        } catch (compensationError) {
          // Compensation failed — log and alert, manual intervention needed
          await this.sagaLog.record(sagaId, step.name, 'compensation_failed',
            compensationError.message);
          // CRITICAL: Alert on-call — manual resolution required
          await this.alerting.critical('Saga compensation failed', {
            sagaId, step: step.name, error: compensationError.message,
          });
        }
      }

      await this.sagaLog.record(sagaId, 'saga', 'compensated');
      return { status: 'compensated', sagaId, error: error.message };
    }
  }
}

// Concrete saga: Place Order
interface PlaceOrderContext {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  totalAmount: number;
  currency: string;
  paymentMethodId: string;
}

const placeOrderSteps: SagaStep<PlaceOrderContext>[] = [
  {
    name: 'create-order',
    async execute(ctx) {
      const result = await orderService.createOrder({
        customerId: ctx.customerId,
        items: ctx.items,
      });
      ctx.orderId = result.orderId;
    },
    async compensate(ctx) {
      await orderService.cancelOrder(ctx.orderId, 'Saga compensation');
    },
  },
  {
    name: 'reserve-inventory',
    async execute(ctx) {
      await inventoryService.reserveStock(ctx.orderId, ctx.items);
    },
    async compensate(ctx) {
      await inventoryService.releaseStock(ctx.orderId);
    },
  },
  {
    name: 'capture-payment',
    async execute(ctx) {
      await paymentService.capturePayment(
        ctx.orderId, ctx.totalAmount, ctx.currency, ctx.paymentMethodId,
      );
    },
    async compensate(ctx) {
      await paymentService.refundPayment(ctx.orderId);
    },
  },
  {
    name: 'confirm-order',
    async execute(ctx) {
      await orderService.confirmOrder(ctx.orderId);
    },
    async compensate(ctx) {
      // Order confirmation is the last step — no compensation needed
      // The previous compensations (refund + release + cancel) handle it
    },
  },
];

// Usage
const saga = new SagaExecutor(placeOrderSteps, sagaLog);
const result = await saga.execute(uuid(), {
  customerId: 'cust-123',
  items: [{ productId: 'prod-456', quantity: 2 }],
  totalAmount: 59.98,
  currency: 'USD',
  paymentMethodId: 'pm-789',
});
```

### Saga Log Table

```sql
-- Track saga execution for debugging, monitoring, and recovery

CREATE TABLE saga_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saga_id UUID NOT NULL,
  saga_type VARCHAR(100) NOT NULL,       -- 'place-order', 'return-order'
  step_name VARCHAR(100) NOT NULL,       -- 'create-order', 'reserve-inventory'
  status VARCHAR(20) NOT NULL,           -- 'executing', 'completed', 'compensating', 'compensated', 'failed'
  error_message TEXT,
  context JSONB,                         -- Saga context at this point
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saga_log_saga ON saga_log (saga_id, created_at);
CREATE INDEX idx_saga_log_status ON saga_log (status) WHERE status IN ('executing', 'compensating');
```

---

## 4. Compensating Transactions

### Rules for Compensation

```
RULE 1: Every saga step MUST have a compensating action
  Step: Reserve inventory → Compensate: Release inventory
  Step: Capture payment → Compensate: Refund payment
  Step: Create order → Compensate: Cancel order

RULE 2: Compensations are NOT rollbacks
  A compensation is a NEW transaction that semantically undoes the effect.
  It does NOT literally undo the database changes.
  Example: Refund creates a NEW payment record (type: refund),
           it does NOT delete the original payment record.

RULE 3: Compensations MUST be idempotent
  If compensation runs twice, it should have the same effect.
  Example: Releasing already-released stock = no-op

RULE 4: Some steps cannot be fully compensated
  Example: Sent email cannot be "unsent"
  Strategy: Put non-compensable steps LAST in the saga
  Or: Send a follow-up "cancellation" email

RULE 5: Compensation can fail
  If compensation fails → alert, log, manual intervention
  Have a manual override mechanism for each step
```

### Semantic vs Physical Rollback

```typescript
// PHYSICAL ROLLBACK (traditional transaction):
// DELETE FROM orders WHERE id = 'ord-123'
// → Row is gone, no history

// SEMANTIC COMPENSATION (saga):
// UPDATE orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = 'ord-123'
// INSERT INTO order_audit (order_id, action, reason) VALUES ('ord-123', 'cancelled', 'Payment failed')
// → Order still exists with cancelled status, full audit trail

// Compensation for payment:
class PaymentCompensation {
  async refund(orderId: string): Promise<void> {
    const payment = await this.paymentRepo.findByOrderId(orderId);
    if (!payment) return; // Already compensated or never captured
    if (payment.status === 'refunded') return; // Idempotent

    // Create NEW refund record, don't delete payment
    await this.paymentGateway.refund(payment.id, payment.amount);
    payment.markRefunded();
    await this.paymentRepo.save(payment);
  }
}
```

---

## 5. Saga Timeout and Recovery

```typescript
// PROBLEM: Saga can get stuck if a service is down
// SOLUTION: Timeouts + periodic recovery

class SagaTimeoutMonitor {
  // Run periodically (every 5 minutes)
  async checkStuckSagas(): Promise<void> {
    const stuckSagas = await this.sagaLog.findStuck({
      statuses: ['executing', 'compensating'],
      olderThan: new Date(Date.now() - 5 * 60 * 1000), // Stuck > 5 min
    });

    for (const saga of stuckSagas) {
      if (saga.retryCount < 3) {
        // Retry the stuck step
        await this.retryStep(saga);
      } else {
        // Max retries exceeded — alert for manual intervention
        await this.alerting.critical('Saga stuck after 3 retries', {
          sagaId: saga.sagaId,
          step: saga.currentStep,
          stuckSince: saga.updatedAt,
        });
      }
    }
  }
}
```

---

## 6. Choreography vs Orchestration Decision

```
┌─────────────────────┬──────────────────────┬──────────────────────┐
│ Factor              │ Choreography         │ Orchestration        │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ # of steps          │ 2-4                  │ 4+                   │
│ Flow complexity     │ Linear               │ Branching, parallel  │
│ Visibility          │ Hard to trace        │ Centralized view     │
│ Coupling            │ Loose (events)       │ Orchestrator knows   │
│                     │                      │ all participants     │
│ Error handling      │ Each service handles │ Centralized handling │
│ Testing             │ Integration tests    │ Unit test the saga   │
│ New step addition   │ Add subscriber       │ Modify orchestrator  │
│ Team autonomy       │ High                 │ Lower (orchestrator  │
│                     │                      │ team coordinates)    │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ USE WHEN            │ Simple flows,        │ Complex flows,       │
│                     │ few steps,           │ many steps,          │
│                     │ independent teams    │ need visibility      │
└─────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 7. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **Two-Phase Commit** | Using distributed transactions across services | Saga pattern with compensating transactions |
| **Missing Compensation** | Saga step has no compensation action | Every step MUST have a defined compensation |
| **Non-Idempotent Compensation** | Running compensation twice causes issues | Make all compensations idempotent |
| **No Saga Timeout** | Stuck sagas run forever | Add timeouts and a stuck-saga recovery process |
| **Non-Compensable Steps First** | Email sent in step 1, can't undo | Put non-compensable steps LAST |
| **No Saga Log** | Cannot debug or monitor saga execution | Log every step transition |
| **Ignoring Compensation Failure** | Compensation fails silently | Alert, retry, manual intervention mechanism |
| **Synchronous Saga** | Orchestrator blocks waiting for each step | Use async messaging between steps |

---

## 8. Enforcement Checklist

- [ ] **No 2PC** — distributed transactions use saga pattern, never two-phase commit
- [ ] **Every step has compensation** — documented and implemented
- [ ] **Idempotent compensations** — running compensation twice is safe
- [ ] **Saga log exists** — every state transition recorded for debugging
- [ ] **Timeout configured** — stuck sagas detected and handled within 5 minutes
- [ ] **Recovery process** — periodic check for stuck sagas with retry/alert
- [ ] **Non-compensable steps last** — email, webhook, SMS go at the end
- [ ] **Compensation failure handling** — alert + manual override mechanism
- [ ] **Saga monitoring dashboard** — visibility into in-flight, completed, and failed sagas
- [ ] **Correct pattern chosen** — choreography for simple, orchestration for complex
