# Event-Driven Architecture — Complete Specification

> **AI Plugin Directive:** Event-Driven Architecture (EDA) is a paradigm where system components communicate by producing and consuming events. An event represents a FACT — something that HAS HAPPENED. Events are immutable, past-tense, and belong to the producer. Use EDA to decouple components, enable async processing, and build reactive systems. EDA is NOT optional in microservices — it is the PRIMARY communication mechanism between services.

---

## 1. The Core Rule

**An event is a record of something that happened. It is IMMUTABLE (never modified), PAST-TENSE (OrderPlaced, not PlaceOrder), and OWNED by the producer (the publisher defines the schema). Consumers react to events independently — the publisher does NOT know or care who consumes its events.**

---

## 2. Event Types

### Domain Events

```typescript
// Raised WITHIN a bounded context when something meaningful happens in the domain
// Scope: Internal to the module/service

class OrderPlacedEvent extends DomainEvent {
  constructor(
    public readonly orderId: OrderId,
    public readonly customerId: CustomerId,
    public readonly items: ReadonlyArray<OrderItem>,
    public readonly totalAmount: Money,
  ) {
    super(); // Sets eventId, timestamp automatically
  }
}

// Domain events use DOMAIN TYPES (OrderId, Money, etc.)
// They are consumed within the same bounded context
// They may trigger side effects: update read models, apply policies, etc.
```

### Integration Events

```typescript
// Published ACROSS bounded contexts / services
// Scope: External, consumed by other modules/services

interface IntegrationEvent {
  eventId: string;              // UUID, unique identifier
  eventType: string;            // Namespaced: 'ordering.order.placed'
  version: string;              // Schema version: '1.0', '1.1'
  timestamp: string;            // ISO 8601
  source: string;               // Producer: 'ordering-service'
  correlationId: string;        // Request tracing
  causationId: string;          // What triggered this event
  payload: Record<string, unknown>; // Serializable data, NO domain types
}

// Integration events use PRIMITIVE TYPES (string, number, etc.)
// They are serialized to JSON and sent over the wire
// Schema must be backward-compatible across versions

const event: IntegrationEvent = {
  eventId: '550e8400-e29b-41d4-a716-446655440000',
  eventType: 'ordering.order.placed',
  version: '1.0',
  timestamp: '2024-01-15T10:30:00Z',
  source: 'ordering-service',
  correlationId: 'req-abc-123',
  causationId: 'cmd-place-order-456',
  payload: {
    orderId: 'ord-001',
    customerId: 'cust-123',
    totalAmount: 59.98,
    currency: 'USD',
    itemCount: 3,
  },
};
```

### Domain Event vs Integration Event

```
┌────────────────────┬──────────────────────┬──────────────────────┐
│ Aspect             │ Domain Event         │ Integration Event    │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Scope              │ Within one context   │ Across contexts      │
│ Types              │ Domain types (Money)  │ Primitives (number) │
│ Transport          │ In-process memory    │ Message broker       │
│ Schema management  │ Internal refactoring │ Versioned contract   │
│ Consumer coupling  │ Tight (same deploy)  │ Loose (independent)  │
│ Failure handling   │ Exceptions           │ DLQ + retry          │
│ Naming             │ OrderPlaced          │ ordering.order.placed│
└────────────────────┴──────────────────────┴──────────────────────┘

RULE: Domain events are published FIRST.
      Integration events are derived FROM domain events
      when cross-context communication is needed.

Flow:
  1. Aggregate raises domain event (OrderPlacedEvent)
  2. Domain event handler within same context processes it
  3. IF another context needs to know: publish integration event
  4. Integration event is serialized, sent to message broker
  5. Other contexts consume the integration event
```

---

## 3. Event Production Patterns

### Aggregate Raises Events

```typescript
// Events are raised by aggregates as part of domain operations
// They are NOT published immediately — collected and published after persistence

class Order extends AggregateRoot {
  private _events: DomainEvent[] = [];

  static place(customerId: CustomerId, items: OrderItem[]): Order {
    const order = new Order(OrderId.generate(), customerId, items, OrderStatus.PENDING);
    // Raise event — NOT published yet, just recorded
    order.raise(new OrderPlacedEvent(order.id, customerId, items, order.totalAmount));
    return order;
  }

  cancel(reason: CancellationReason): void {
    if (this.status === OrderStatus.CANCELLED) return; // Idempotent
    if (this.status === OrderStatus.SHIPPED) throw new CannotCancelShippedOrderError();
    this._status = OrderStatus.CANCELLED;
    this.raise(new OrderCancelledEvent(this.id, reason));
  }

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._events];
  }

  clearEvents(): void {
    this._events = [];
  }

  protected raise(event: DomainEvent): void {
    this._events.push(event);
  }
}

// Repository saves the aggregate AND collects its events
class OrderRepository {
  async save(order: Order): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.persistOrder(order, tx);
      // Save events to outbox (same transaction)
      for (const event of order.domainEvents) {
        await this.outbox.save(event, tx);
      }
    });
    order.clearEvents();
  }
}
```

### Outbox Pattern for Reliable Publishing

```typescript
// PROBLEM: Saving to DB and publishing event are two operations
// If app crashes between them, event is lost OR data is saved without event

// SOLUTION: Outbox pattern — save event in SAME transaction as data

// Step 1: Save to outbox table in same transaction
await db.transaction(async (tx) => {
  await tx.query('INSERT INTO ordering.orders (...) VALUES (...)', [orderData]);
  await tx.query(
    `INSERT INTO ordering.outbox (id, event_type, payload, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [uuid(), 'ordering.order.placed', JSON.stringify(eventPayload)],
  );
});

// Step 2: Background process polls outbox and publishes
class OutboxProcessor {
  // Runs every 100ms or uses database LISTEN/NOTIFY
  async processOutbox(): Promise<void> {
    const events = await this.db.query(
      `SELECT * FROM ordering.outbox
       WHERE published_at IS NULL
       ORDER BY created_at ASC LIMIT 50
       FOR UPDATE SKIP LOCKED`, // Prevent concurrent processing
    );

    for (const event of events.rows) {
      await this.broker.publish(event.event_type, JSON.parse(event.payload));
      await this.db.query(
        'UPDATE ordering.outbox SET published_at = NOW() WHERE id = $1',
        [event.id],
      );
    }
  }
}

// Step 3: Cleanup old outbox entries
// DELETE FROM ordering.outbox WHERE published_at < NOW() - INTERVAL '7 days'
```

---

## 4. Event Consumption Patterns

### At-Least-Once Delivery + Idempotent Handlers

```typescript
// Message brokers guarantee AT-LEAST-ONCE delivery
// This means handlers WILL receive duplicate events
// EVERY handler MUST be idempotent

class OnOrderPlacedCreateShipment {
  constructor(
    private readonly idempotencyStore: IdempotencyStore,
    private readonly shipmentRepo: ShipmentRepository,
  ) {}

  async handle(event: IntegrationEvent): Promise<void> {
    // Check: already processed?
    if (await this.idempotencyStore.exists(event.eventId)) return;

    // Process
    const shipment = Shipment.create(
      event.payload.orderId,
      event.payload.items,
    );
    await this.shipmentRepo.save(shipment);

    // Mark as processed (AFTER successful processing)
    await this.idempotencyStore.markProcessed(event.eventId);
  }
}
```

### Event Handler Types

```typescript
// TYPE 1: State Updater — Updates local read model
class OrderDashboardProjection {
  async onOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    await this.dashboardStore.insert({
      orderId: event.payload.orderId,
      status: 'placed',
      totalAmount: event.payload.totalAmount,
    });
  }
}

// TYPE 2: Process Trigger — Starts a business process
class OnOrderConfirmedStartFulfillment {
  async handle(event: OrderConfirmedEvent): Promise<void> {
    await this.fulfillmentService.startPicking(event.payload.orderId);
  }
}

// TYPE 3: Notification — Sends external communication
class OnOrderShippedNotifyCustomer {
  async handle(event: OrderShippedEvent): Promise<void> {
    await this.emailSender.send({
      to: event.payload.customerEmail,
      template: 'order-shipped',
      data: { trackingNumber: event.payload.trackingNumber },
    });
  }
}

// TYPE 4: Integration Bridge — Translates to another context's event
class OnPaymentCapturedPublishOrderEvent {
  async handle(event: PaymentCapturedEvent): Promise<void> {
    // Translate payment event to ordering event
    await this.eventBus.publish({
      eventType: 'ordering.payment.received',
      payload: {
        orderId: event.payload.orderId,
        amount: event.payload.amount,
        method: event.payload.method,
      },
    });
  }
}
```

---

## 5. Event Delivery Guarantees

```
┌──────────────────┬───────────────────────────────────────────┐
│ Guarantee        │ Description                               │
├──────────────────┼───────────────────────────────────────────┤
│ At-Most-Once     │ Event delivered 0 or 1 times              │
│                  │ Can LOSE events. NEVER use for business.  │
│                  │ Use for: metrics, non-critical logs       │
├──────────────────┼───────────────────────────────────────────┤
│ At-Least-Once    │ Event delivered 1 or MORE times           │
│                  │ Can DUPLICATE. Handlers must be idempotent│
│                  │ Use for: ALL business events (DEFAULT)    │
├──────────────────┼───────────────────────────────────────────┤
│ Exactly-Once     │ Event delivered EXACTLY 1 time            │
│                  │ Impossible in distributed systems         │
│                  │ Achievable with: idempotent handlers +    │
│                  │   at-least-once delivery + deduplication  │
│                  │ This is the PRACTICAL target              │
└──────────────────┴───────────────────────────────────────────┘

RULE: ALWAYS design for at-least-once delivery.
      Achieve practical exactly-once with idempotent handlers.
```

---

## 6. Event Ordering

```
RULE: Events for the SAME entity must be processed in order.
      Events for DIFFERENT entities can be processed in any order.

HOW TO ACHIEVE:
  Kafka: Partition by entity ID (orderId as partition key)
         All events for order-123 go to the same partition
         Partitions are consumed by ONE consumer in a group
         → Events for order-123 are processed in order

  RabbitMQ: Single consumer per entity-queue
            OR: Consistent hash exchange
            Less natural than Kafka for ordered delivery

WHAT BREAKS ORDERING:
  ❌ Retries with different delays per event
  ❌ Multiple consumer instances per partition
  ❌ Processing events in parallel within a consumer
  ❌ Publishing to different topics for the same entity

  ✅ FIX: Process events sequentially within a partition
  ✅ FIX: Use Kafka's single-partition-single-consumer guarantee
```

---

## 7. Error Handling and Dead Letter Queues

```typescript
// When event processing fails, events go to DLQ for investigation

class EventConsumer {
  private readonly maxRetries = 3;

  async consume(event: IntegrationEvent): Promise<void> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        await this.handler.handle(event);
        return; // Success
      } catch (error) {
        attempt++;
        if (attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // All retries exhausted — send to Dead Letter Queue
    await this.deadLetterQueue.send({
      originalEvent: event,
      error: error.message,
      failedAt: new Date().toISOString(),
      attempts: this.maxRetries,
      consumer: this.consumerName,
    });

    this.logger.error('Event sent to DLQ after retries exhausted', {
      eventId: event.eventId,
      eventType: event.eventType,
      attempts: this.maxRetries,
    });
    // Alert on-call team
    await this.alerting.notify('Event processing failed', { eventId: event.eventId });
  }
}

// DLQ monitoring: MUST check DLQ regularly
// Set up alerts when DLQ size > 0
// Re-process DLQ events after fixing the issue
```

---

## 8. Event Schema Management

```typescript
// Events are contracts. Breaking changes break consumers.

// BACKWARD-COMPATIBLE CHANGES (safe):
// ✅ Adding new optional fields
// ✅ Adding new event types
// ✅ Deprecating fields (keep them, mark as deprecated)

// BREAKING CHANGES (require migration):
// ❌ Removing fields
// ❌ Renaming fields
// ❌ Changing field types (string → number)
// ❌ Changing field semantics
// ❌ Making optional fields required

// Versioning strategy:
// 1. Semantic versioning in event envelope (version: '1.0', '1.1', '2.0')
// 2. Consumers handle multiple versions
// 3. Schema registry validates events at publish time

// Schema Registry integration (Confluent, AWS Glue, etc.)
class EventPublisher {
  async publish(event: IntegrationEvent): Promise<void> {
    // Validate against schema registry before publishing
    const isValid = await this.schemaRegistry.validate(
      event.eventType,
      event.version,
      event.payload,
    );
    if (!isValid) throw new InvalidEventSchemaError(event.eventType);

    await this.broker.publish(event);
  }
}
```

---

## 9. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **Event Soup** | Hundreds of fine-grained events, impossible to follow flow | Define an event catalog, use coarse-grained events |
| **Event as Command** | Using events to tell a service what to DO | Events = facts. Commands = requests. Use the right one |
| **Temporal Coupling via Events** | Producer waits for consumer's response via event | If you need a response, use sync call or request-reply |
| **Missing Idempotency** | Duplicate events create duplicate data | Every handler checks eventId before processing |
| **No DLQ** | Failed events disappear silently | Every queue has a DLQ, DLQ is monitored and alerted |
| **Breaking Schema Changes** | Removing/renaming fields breaks consumers | Backward-compatible changes only, version events |
| **Event Sourcing Everywhere** | Using event sourcing for simple CRUD | Event sourcing only for complex domains with audit needs |
| **No Correlation** | Cannot trace an event back to the original request | CorrelationId in every event, propagated through all handlers |
| **Giant Event Payloads** | Events carry the entire entity (100+ fields) | Events carry only relevant data + entity ID |
| **Synchronous Event Handling** | Processing events synchronously blocks the publisher | Events are async by default, use sync only within same module |

---

## 10. Enforcement Checklist

- [ ] **Events are past-tense** — OrderPlaced not PlaceOrder
- [ ] **Events are immutable** — never modify a published event
- [ ] **Outbox pattern** — events saved atomically with data changes
- [ ] **Idempotent handlers** — every handler checks for duplicate eventId
- [ ] **Dead Letter Queue** — every queue has a DLQ with monitoring
- [ ] **Schema versioning** — events have version field, backward-compatible changes only
- [ ] **Correlation ID** — every event carries correlationId for tracing
- [ ] **Ordered per entity** — events for same entity processed in order (partition by entity ID)
- [ ] **At-least-once delivery** — design for duplicates, achieve practical exactly-once
- [ ] **Integration events separate** — domain events stay internal, integration events cross boundaries
- [ ] **Event catalog documented** — all event types, schemas, and consumers documented
