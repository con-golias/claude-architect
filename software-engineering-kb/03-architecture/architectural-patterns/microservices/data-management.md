# Microservices: Data Management — Complete Specification

> **AI Plugin Directive:** Data management is the HARDEST problem in microservices. Each service MUST own its data exclusively. NEVER share databases between services. When data needs to be accessed across services, use events for eventual consistency, API calls with caching for queries, or materialized views for complex reads. Distributed transactions (2PC) are FORBIDDEN — use the Saga pattern instead.

---

## 1. The Core Rule

**One service = one database. NO exceptions. If two services need the same data, they communicate through events or APIs — NEVER through shared database tables, shared schemas, or database-level replication between service databases.**

---

## 2. Database Per Service

### Why Separate Databases

```
SHARED DATABASE PROBLEMS:
  1. Schema coupling: Service A's migration breaks Service B
  2. Performance coupling: Service A's heavy query slows Service B
  3. Deployment coupling: Cannot deploy database changes independently
  4. Technology lock-in: All services forced to use the same database

SEPARATE DATABASE BENEFITS:
  1. Independent schema evolution
  2. Independent scaling (read replicas, sharding per service)
  3. Polyglot persistence (right database for the job)
  4. Independent deployment of schema changes
  5. Clear data ownership
```

### Polyglot Persistence

```
Choose the RIGHT database for each service's needs:

┌──────────────────────┬──────────────────────┬─────────────────────┐
│ Service              │ Database Choice      │ Why                 │
├──────────────────────┼──────────────────────┼─────────────────────┤
│ Ordering Service     │ PostgreSQL           │ ACID transactions,  │
│                      │                      │ complex queries     │
├──────────────────────┼──────────────────────┼─────────────────────┤
│ Catalog Service      │ PostgreSQL +         │ Relational data +   │
│                      │ Elasticsearch        │ full-text search    │
├──────────────────────┼──────────────────────┼─────────────────────┤
│ Session Service      │ Redis                │ Fast key-value      │
│                      │                      │ access, TTL support │
├──────────────────────┼──────────────────────┼─────────────────────┤
│ Notification Service │ MongoDB              │ Flexible schema for │
│                      │                      │ templates/history   │
├──────────────────────┼──────────────────────┼─────────────────────┤
│ Analytics Service    │ ClickHouse /         │ Columnar storage    │
│                      │ BigQuery             │ for aggregations    │
├──────────────────────┼──────────────────────┼─────────────────────┤
│ Recommendation Svc   │ Neo4j / DynamoDB     │ Graph relationships │
│                      │                      │ or fast reads       │
├──────────────────────┼──────────────────────┼─────────────────────┤
│ Event Store          │ EventStoreDB /       │ Append-only event   │
│                      │ Kafka + PostgreSQL   │ log with replay     │
└──────────────────────┴──────────────────────┴─────────────────────┘
```

---

## 3. Data Consistency Patterns

### Eventual Consistency (Default)

```typescript
// In microservices, STRONG consistency across services is impractical.
// Accept EVENTUAL consistency as the default.

// Example: When an order is placed, inventory is reserved EVENTUALLY

// Ordering Service: Place order
class PlaceOrderHandler {
  async execute(command: PlaceOrderCommand): Promise<OrderId> {
    // Step 1: Create order in PENDING state (own database)
    const order = Order.place(command.customerId, command.items);
    await this.orderRepo.save(order);

    // Step 2: Publish event — inventory will be reserved eventually
    await this.eventPublisher.publish(new OrderPlacedEvent(order));

    // Return immediately — order is PENDING, not CONFIRMED
    return order.id;
  }
}

// Inventory Service: Reserve stock (handles event asynchronously)
class OrderPlacedHandler {
  async handle(event: OrderPlacedEvent): Promise<void> {
    try {
      for (const item of event.items) {
        await this.inventoryRepo.reserve(item.productId, item.quantity, event.orderId);
      }
      // Publish success event
      await this.eventPublisher.publish(new InventoryReservedEvent(event.orderId));
    } catch (error) {
      // Publish failure event — ordering will cancel the order
      await this.eventPublisher.publish(new InventoryReservationFailedEvent(
        event.orderId,
        error.message,
      ));
    }
  }
}

// Ordering Service: Handle reservation result
class InventoryReservedHandler {
  async handle(event: InventoryReservedEvent): Promise<void> {
    const order = await this.orderRepo.findById(event.orderId);
    order.confirmInventory();
    await this.orderRepo.save(order);
  }
}

class InventoryReservationFailedHandler {
  async handle(event: InventoryReservationFailedEvent): Promise<void> {
    const order = await this.orderRepo.findById(event.orderId);
    order.cancel(CancellationReason.outOfStock(event.reason));
    await this.orderRepo.save(order);
  }
}
```

### The Outbox Pattern

```typescript
// PROBLEM: Publishing an event and saving to the database are TWO operations.
// If the app crashes between save and publish, the event is lost.

// ❌ WRONG: Two separate operations (not atomic)
async execute(command: PlaceOrderCommand): Promise<void> {
  await this.orderRepo.save(order);          // 1. Save to DB ✅
  // APP CRASHES HERE → event never published!
  await this.eventPublisher.publish(event);   // 2. Publish event ❌
}

// ✅ CORRECT: Outbox Pattern — save event in the SAME transaction as the entity
async execute(command: PlaceOrderCommand): Promise<void> {
  await this.db.transaction(async (tx) => {
    // 1. Save order
    await tx.query(
      'INSERT INTO orders (id, customer_id, status, total) VALUES ($1, $2, $3, $4)',
      [order.id, order.customerId, order.status, order.total],
    );

    // 2. Save event to outbox table (SAME transaction)
    await tx.query(
      `INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuid(), 'Order', order.id, 'OrderPlaced', JSON.stringify(eventPayload), new Date()],
    );
  });
  // Both saved atomically — if either fails, both roll back
}

// Separate process polls the outbox and publishes events
class OutboxPublisher {
  async publishPendingEvents(): Promise<void> {
    const events = await this.db.query(
      `SELECT * FROM outbox WHERE published_at IS NULL
       ORDER BY created_at ASC LIMIT 100
       FOR UPDATE SKIP LOCKED`,  // Lock rows to prevent duplicate publishing
    );

    for (const event of events.rows) {
      try {
        await this.messageBroker.publish(event.event_type, event.payload);
        await this.db.query(
          'UPDATE outbox SET published_at = $1 WHERE id = $2',
          [new Date(), event.id],
        );
      } catch (error) {
        this.logger.error('Failed to publish outbox event', { eventId: event.id, error });
        // Will be retried on next poll
      }
    }
  }
}

// Outbox table schema
// CREATE TABLE outbox (
//   id UUID PRIMARY KEY,
//   aggregate_type VARCHAR(100) NOT NULL,
//   aggregate_id VARCHAR(100) NOT NULL,
//   event_type VARCHAR(200) NOT NULL,
//   payload JSONB NOT NULL,
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   published_at TIMESTAMPTZ NULL
// );
// CREATE INDEX idx_outbox_unpublished ON outbox (created_at) WHERE published_at IS NULL;
```

### Change Data Capture (CDC)

```
Alternative to Outbox: Use database change capture to publish events

┌─────────────┐    write    ┌─────────────┐    CDC     ┌─────────────┐
│ Order Service│────────────►│ PostgreSQL   │──────────►│ Debezium    │
│             │             │ (orders tbl) │           │ (CDC tool)  │
└─────────────┘             └─────────────┘           └──────┬──────┘
                                                             │
                                                     publish │
                                                             ▼
                                                      ┌─────────────┐
                                                      │   Kafka      │
                                                      └─────────────┘

How CDC works:
  1. Service writes to its database normally (no outbox table needed)
  2. Debezium reads the database's transaction log (WAL in PostgreSQL)
  3. Debezium publishes every INSERT/UPDATE/DELETE as an event to Kafka
  4. Other services consume these events

Pros:
  - No application code changes needed
  - Cannot lose events (reads from WAL)
  - Works with any database that has a transaction log

Cons:
  - Infrastructure complexity (Debezium + Kafka Connect)
  - Events are database-level (INSERT/UPDATE), not domain-level (OrderPlaced)
  - Need to transform DB events into meaningful domain events
```

---

## 4. The Saga Pattern

### What is a Saga

```
A Saga is a sequence of local transactions across multiple services.
If one step fails, compensating transactions undo the previous steps.

SAGA replaces distributed transactions (2PC).
2PC is FORBIDDEN in microservices because:
  - Requires all services to be available simultaneously
  - Holds locks across services (blocking)
  - Single coordinator is a single point of failure
  - Performance degrades exponentially with participants
```

### Choreography-Based Saga

```typescript
// Each service listens for events and reacts independently.
// No central coordinator — services collaborate through events.

// Flow: Place Order Saga (Choreography)
//
// 1. OrderService creates order → publishes OrderPlaced
// 2. InventoryService reserves stock → publishes InventoryReserved
// 3. PaymentService captures payment → publishes PaymentCaptured
// 4. OrderService confirms order → publishes OrderConfirmed
//
// Compensation (if PaymentService fails):
// 3'. PaymentService publishes PaymentFailed
// 2'. InventoryService releases reserved stock
// 1'. OrderService cancels order

// Ordering Service
class OrderService {
  async placeOrder(command: PlaceOrderCommand): Promise<OrderId> {
    const order = Order.place(command.customerId, command.items);
    await this.orderRepo.save(order);
    await this.events.publish(new OrderPlacedEvent(order));
    return order.id;
  }

  // Compensation: cancel if payment fails
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    const order = await this.orderRepo.findById(event.orderId);
    order.cancel(CancellationReason.paymentFailed());
    await this.orderRepo.save(order);
    await this.events.publish(new OrderCancelledEvent(order));
  }

  // Happy path: confirm when payment succeeds
  async onPaymentCaptured(event: PaymentCapturedEvent): Promise<void> {
    const order = await this.orderRepo.findById(event.orderId);
    order.confirm();
    await this.orderRepo.save(order);
    await this.events.publish(new OrderConfirmedEvent(order));
  }
}

// Inventory Service
class InventoryService {
  async onOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    try {
      await this.reserveStock(event.orderId, event.items);
      await this.events.publish(new InventoryReservedEvent(event.orderId));
    } catch (error) {
      await this.events.publish(new InventoryReservationFailedEvent(event.orderId));
    }
  }

  // Compensation: release stock if order is cancelled
  async onOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    await this.releaseStock(event.orderId);
  }
}

// Payment Service
class PaymentService {
  async onInventoryReserved(event: InventoryReservedEvent): Promise<void> {
    try {
      await this.capturePayment(event.orderId);
      await this.events.publish(new PaymentCapturedEvent(event.orderId));
    } catch (error) {
      await this.events.publish(new PaymentFailedEvent(event.orderId, error.message));
    }
  }
}
```

### Orchestration-Based Saga

```typescript
// A central orchestrator tells each service what to do and when.
// Better visibility and control than choreography.

// Use orchestration when:
// - Saga has more than 4 steps
// - Complex branching logic
// - Need centralized monitoring
// - Hard to track choreography flow

class PlaceOrderSaga {
  private state: SagaState = 'STARTED';

  constructor(
    private readonly orderService: OrderServiceClient,
    private readonly inventoryService: InventoryServiceClient,
    private readonly paymentService: PaymentServiceClient,
    private readonly sagaLog: SagaLog,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<SagaResult> {
    const sagaId = uuid();

    try {
      // Step 1: Create order
      this.state = 'CREATING_ORDER';
      await this.sagaLog.record(sagaId, this.state);
      const orderId = await this.orderService.createOrder(command);

      // Step 2: Reserve inventory
      this.state = 'RESERVING_INVENTORY';
      await this.sagaLog.record(sagaId, this.state);
      await this.inventoryService.reserveStock(orderId, command.items);

      // Step 3: Capture payment
      this.state = 'CAPTURING_PAYMENT';
      await this.sagaLog.record(sagaId, this.state);
      await this.paymentService.capturePayment(orderId, command.paymentMethod);

      // Step 4: Confirm order
      this.state = 'CONFIRMING_ORDER';
      await this.sagaLog.record(sagaId, this.state);
      await this.orderService.confirmOrder(orderId);

      this.state = 'COMPLETED';
      await this.sagaLog.record(sagaId, this.state);
      return { status: 'success', orderId };

    } catch (error) {
      // Compensate based on current state
      await this.compensate(sagaId, error);
      return { status: 'failed', reason: error.message };
    }
  }

  private async compensate(sagaId: string, error: Error): Promise<void> {
    this.state = 'COMPENSATING';
    await this.sagaLog.record(sagaId, this.state, error.message);

    // Compensate in REVERSE order based on how far we got
    switch (this.state) {
      case 'CAPTURING_PAYMENT':
        // Payment was attempted but inventory was reserved
        await this.inventoryService.releaseStock(sagaId);
        await this.orderService.cancelOrder(sagaId);
        break;
      case 'RESERVING_INVENTORY':
        // Inventory failed, only order was created
        await this.orderService.cancelOrder(sagaId);
        break;
      case 'CONFIRMING_ORDER':
        // Payment captured but confirmation failed
        await this.paymentService.refundPayment(sagaId);
        await this.inventoryService.releaseStock(sagaId);
        await this.orderService.cancelOrder(sagaId);
        break;
    }

    this.state = 'COMPENSATED';
    await this.sagaLog.record(sagaId, this.state);
  }
}
```

### Choreography vs Orchestration Decision

```
USE CHOREOGRAPHY WHEN:
  ✅ 2-4 steps in the saga
  ✅ Simple, linear flow
  ✅ Services are truly independent
  ✅ Team prefers decentralization
  ✅ Low need for centralized monitoring

USE ORCHESTRATION WHEN:
  ✅ 5+ steps in the saga
  ✅ Complex branching/conditional logic
  ✅ Need centralized saga visibility and monitoring
  ✅ Multiple compensating paths
  ✅ Need to retry/resume failed sagas
  ✅ Business requires audit trail of saga execution
```

---

## 5. Cross-Service Queries

### CQRS (Command Query Responsibility Segregation)

```typescript
// PROBLEM: "Show me all orders with customer name, product name, and shipment status"
// This query spans 3 services: Ordering, Customer, Fulfillment
//
// ❌ WRONG: Join across service databases
// ❌ WRONG: Call 3 services and join in code (N+1 problem, slow)
//
// ✅ CORRECT: Build a dedicated read model from events

// Write side: each service writes to its own DB
// Read side: a query service builds denormalized views from events

class OrderDashboardProjection {
  // Build read model from multiple service events
  async onOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    await this.readDb.upsert('order_dashboard', event.payload.orderId, {
      orderId: event.payload.orderId,
      customerId: event.payload.customerId,
      totalAmount: event.payload.totalAmount,
      currency: event.payload.currency,
      orderStatus: 'placed',
      placedAt: event.metadata.timestamp,
    });
  }

  async onCustomerUpdated(event: CustomerUpdatedEvent): Promise<void> {
    // Update all orders for this customer with latest name
    await this.readDb.updateMany(
      'order_dashboard',
      { customerId: event.payload.customerId },
      { customerName: event.payload.name },
    );
  }

  async onShipmentCreated(event: ShipmentCreatedEvent): Promise<void> {
    await this.readDb.update('order_dashboard', event.payload.orderId, {
      shipmentStatus: 'shipped',
      trackingNumber: event.payload.trackingNumber,
      carrier: event.payload.carrier,
    });
  }
}

// Query endpoint — single fast read from denormalized view
class OrderDashboardQuery {
  async getOrdersForCustomer(customerId: string): Promise<OrderDashboardView[]> {
    return this.readDb.find('order_dashboard', { customerId });
    // One query, no joins, no cross-service calls
  }
}
```

---

## 6. Data Migration Strategies

### Schema Migration Per Service

```typescript
// EVERY service manages its own database schema migrations

// Use migration tools:
// - TypeScript/Node: Knex migrations, Prisma migrate, TypeORM migrations
// - Python: Alembic, Django migrations
// - Java/Kotlin: Flyway, Liquibase
// - .NET: EF Core migrations, FluentMigrator

// Rules for migrations:
// 1. Migrations MUST be backward-compatible (expand-contract pattern)
// 2. NEVER drop columns or tables immediately
// 3. Deploy new code first, then clean up old columns later

// Expand-Contract Pattern:
// Phase 1 (Expand): Add new column, write to both old and new
// Phase 2 (Migrate): Backfill data from old to new column
// Phase 3 (Contract): Remove old column after all code uses new one

// Phase 1: Add new column (backward compatible)
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.jsonb('shipping_address_v2').nullable(); // New structured column
    // Keep old 'shipping_address' text column — still used by running instances
  });
}

// Phase 2: Backfill (run as separate script/job)
async function backfillShippingAddress(): Promise<void> {
  const batchSize = 1000;
  let offset = 0;
  while (true) {
    const orders = await db.query(
      `SELECT id, shipping_address FROM orders
       WHERE shipping_address_v2 IS NULL
       LIMIT $1 OFFSET $2`,
      [batchSize, offset],
    );
    if (orders.rows.length === 0) break;

    for (const order of orders.rows) {
      const parsed = parseAddressString(order.shipping_address);
      await db.query(
        'UPDATE orders SET shipping_address_v2 = $1 WHERE id = $2',
        [JSON.stringify(parsed), order.id],
      );
    }
    offset += batchSize;
  }
}

// Phase 3: Remove old column (ONLY after all code uses v2)
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('shipping_address');
    table.renameColumn('shipping_address_v2', 'shipping_address');
  });
}
```

---

## 7. Data Partitioning and Sharding

```typescript
// When a single database instance can't handle the load:

// Strategy 1: Read Replicas (most common)
// Write to primary, read from replicas
const writeDb = createPool({ host: 'db-primary.internal' });
const readDb = createPool({ host: 'db-replica.internal' });

class OrderRepository {
  async save(order: Order): Promise<void> {
    await writeDb.query('INSERT INTO orders ...', [order]);
  }

  async findById(id: string): Promise<Order> {
    // Read from replica — may have slight lag
    return readDb.query('SELECT * FROM orders WHERE id = $1', [id]);
  }
}

// Strategy 2: Sharding by tenant (multi-tenant systems)
// Each tenant's data in a separate database/schema
function getDatabaseForTenant(tenantId: string): Database {
  const shardIndex = hashToShard(tenantId, NUM_SHARDS);
  return connectionPools[shardIndex];
}

// Strategy 3: Sharding by entity ID (high-volume single entity)
function getShardForOrder(orderId: string): Database {
  const shardIndex = consistentHash(orderId, NUM_SHARDS);
  return orderShards[shardIndex];
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **Shared Database** | Multiple services read/write same tables | Database per service, sync via events |
| **Distributed Transaction (2PC)** | Two-phase commit across services | Saga pattern with compensating transactions |
| **Direct DB Access** | Service reads another service's database | API or event-based data access |
| **No Outbox** | Events lost when app crashes after DB write | Outbox pattern or CDC |
| **Synchronous Data Sync** | Service A calls B to get data on every request | Event-carried state transfer + local cache |
| **Missing Idempotency** | Duplicate messages create duplicate data | Idempotent handlers with event ID deduplication |
| **Big Event Payloads** | Events contain entire entity (100+ fields) | Events carry only changed fields + entity ID |
| **No Schema Evolution** | Breaking changes in event schemas | Schema registry with backward-compatible changes |
| **Missing Saga Timeout** | Saga stuck in intermediate state forever | Saga timeout + dead letter handling |
| **Cross-Service Joins** | SQL joins across service databases | CQRS with materialized views |

---

## 9. Enforcement Checklist

- [ ] **Database per service** — each service has its own database instance or schema
- [ ] **Outbox pattern** — events and data saved atomically in the same transaction
- [ ] **Saga pattern** — multi-service workflows use sagas, NOT distributed transactions
- [ ] **Compensating transactions** — every saga step has a defined compensation action
- [ ] **Idempotent handlers** — all event handlers handle duplicates gracefully
- [ ] **Schema versioning** — event schemas versioned, backward-compatible changes only
- [ ] **CQRS for cross-service queries** — dedicated read models built from events
- [ ] **Expand-contract migrations** — database changes are backward-compatible
- [ ] **Event-carried state transfer** — services cache needed data from events, not sync calls
- [ ] **Saga monitoring** — stuck sagas are detected, alerted, and recoverable
- [ ] **Dead letter queues** — failed messages captured and monitored
- [ ] **Data retention policy** — outbox table cleaned up, events archived after retention period
