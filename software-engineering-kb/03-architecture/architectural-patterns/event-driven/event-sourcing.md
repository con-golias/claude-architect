# Event Sourcing — Complete Specification

> **AI Plugin Directive:** Event Sourcing stores the HISTORY of state changes as a sequence of immutable events, rather than storing the current state directly. The current state is DERIVED by replaying events. Use event sourcing ONLY when you need a complete audit trail, temporal queries, or the ability to rebuild state from scratch. Do NOT use it for simple CRUD — the complexity is not justified.

---

## 1. The Core Rule

**Instead of storing the current state of an entity, store every state change as an immutable event. The current state is computed by replaying all events from the beginning. The event log IS the source of truth — the "current state" is just a derived view.**

```
TRADITIONAL (State-Based):
  orders table: { id: 'ord-1', status: 'shipped', total: 59.98 }
  → Only the CURRENT state is known
  → History is lost

EVENT SOURCED:
  events table:
    1. OrderPlaced    { orderId: 'ord-1', items: [...], total: 59.98 }
    2. PaymentCaptured { orderId: 'ord-1', amount: 59.98 }
    3. OrderConfirmed  { orderId: 'ord-1' }
    4. OrderShipped    { orderId: 'ord-1', trackingNo: 'TRK-456' }
  → Complete HISTORY preserved
  → Current state derived: status = 'shipped', total = 59.98
  → Can answer: "What was the state at step 2?" → status = 'confirmed'
```

---

## 2. Event Store Implementation

### Event Store Schema

```sql
-- The event store is an APPEND-ONLY table
-- Events are NEVER updated or deleted

CREATE TABLE event_store (
  -- Event identity
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Aggregate identity
  aggregate_type VARCHAR(100) NOT NULL,  -- 'Order', 'Account', 'Inventory'
  aggregate_id VARCHAR(100) NOT NULL,     -- 'ord-123'

  -- Event data
  event_type VARCHAR(200) NOT NULL,       -- 'OrderPlaced', 'OrderShipped'
  event_data JSONB NOT NULL,              -- Serialized event payload
  metadata JSONB NOT NULL DEFAULT '{}',   -- correlationId, causationId, userId

  -- Versioning
  version INTEGER NOT NULL,               -- Monotonically increasing per aggregate

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Optimistic concurrency: unique version per aggregate
  CONSTRAINT uq_aggregate_version UNIQUE (aggregate_type, aggregate_id, version)
);

-- Indexes for common queries
CREATE INDEX idx_events_aggregate ON event_store (aggregate_type, aggregate_id, version);
CREATE INDEX idx_events_type ON event_store (event_type);
CREATE INDEX idx_events_timestamp ON event_store (created_at);
```

### Event Store Interface

```typescript
interface EventStore {
  // Append events to the store (with optimistic concurrency)
  append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number,  // Optimistic concurrency check
  ): Promise<void>;

  // Load all events for an aggregate
  getEvents(
    aggregateId: string,
    fromVersion?: number,  // For partial replay
  ): Promise<StoredEvent[]>;

  // Load events by type (for projections)
  getEventsByType(
    eventType: string,
    fromPosition?: number,  // Global position for catch-up subscriptions
  ): Promise<StoredEvent[]>;
}

interface StoredEvent {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  metadata: EventMetadata;
  version: number;
  createdAt: Date;
  globalPosition: number;  // Monotonically increasing across ALL events
}
```

### Event Store Implementation

```typescript
class PostgresEventStore implements EventStore {
  async append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Check current version (optimistic concurrency)
      const result = await tx.query(
        `SELECT MAX(version) as current_version
         FROM event_store
         WHERE aggregate_id = $1`,
        [aggregateId],
      );
      const currentVersion = result.rows[0]?.current_version ?? 0;

      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          `Expected version ${expectedVersion}, but found ${currentVersion}`,
        );
      }

      // Append all events
      let version = expectedVersion;
      for (const event of events) {
        version++;
        await tx.query(
          `INSERT INTO event_store
           (aggregate_type, aggregate_id, event_type, event_data, metadata, version)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            event.aggregateType,
            aggregateId,
            event.constructor.name,
            JSON.stringify(event.toPayload()),
            JSON.stringify(event.metadata),
            version,
          ],
        );
      }
    });
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<StoredEvent[]> {
    const query = fromVersion
      ? `SELECT * FROM event_store WHERE aggregate_id = $1 AND version > $2 ORDER BY version ASC`
      : `SELECT * FROM event_store WHERE aggregate_id = $1 ORDER BY version ASC`;

    const params = fromVersion ? [aggregateId, fromVersion] : [aggregateId];
    const result = await this.db.query(query, params);
    return result.rows.map(this.mapToStoredEvent);
  }
}
```

---

## 3. Aggregate with Event Sourcing

```typescript
// The aggregate rebuilds its state from events

abstract class EventSourcedAggregate {
  private _version: number = 0;
  private _uncommittedEvents: DomainEvent[] = [];

  get version(): number { return this._version; }
  get uncommittedEvents(): ReadonlyArray<DomainEvent> { return this._uncommittedEvents; }

  // Rebuild state from stored events
  loadFromHistory(events: StoredEvent[]): void {
    for (const event of events) {
      this.apply(event); // Apply WITHOUT recording (already stored)
      this._version = event.version;
    }
  }

  // Record a new event (state change)
  protected raise(event: DomainEvent): void {
    this.apply(event); // Apply the state change
    this._uncommittedEvents.push(event); // Record for persistence
  }

  // Apply event to update internal state
  // MUST be deterministic — same events = same state
  protected abstract apply(event: DomainEvent | StoredEvent): void;

  clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }
}

// Concrete aggregate: Order
class Order extends EventSourcedAggregate {
  private _id!: OrderId;
  private _customerId!: CustomerId;
  private _items: OrderItem[] = [];
  private _status!: OrderStatus;
  private _totalAmount!: Money;

  get id(): OrderId { return this._id; }
  get status(): OrderStatus { return this._status; }

  // Command: Place order
  static place(customerId: CustomerId, items: OrderItem[]): Order {
    const order = new Order();
    order.raise(new OrderPlacedEvent({
      orderId: OrderId.generate().value,
      customerId: customerId.value,
      items: items.map(i => ({
        productId: i.productId.value,
        quantity: i.quantity.value,
        unitPrice: i.unitPrice.amount,
        currency: i.unitPrice.currency,
      })),
      totalAmount: items.reduce((sum, i) => sum + i.lineTotal.amount, 0),
      currency: items[0].unitPrice.currency,
    }));
    return order;
  }

  // Command: Confirm order
  confirm(): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new InvalidOrderStateError(this._status, 'confirm');
    }
    this.raise(new OrderConfirmedEvent({ orderId: this._id.value }));
  }

  // Command: Ship order
  ship(trackingNumber: string, carrier: string): void {
    if (this._status !== OrderStatus.CONFIRMED) {
      throw new InvalidOrderStateError(this._status, 'ship');
    }
    this.raise(new OrderShippedEvent({
      orderId: this._id.value,
      trackingNumber,
      carrier,
    }));
  }

  // Command: Cancel order
  cancel(reason: string): void {
    if (this._status === OrderStatus.SHIPPED || this._status === OrderStatus.CANCELLED) {
      throw new InvalidOrderStateError(this._status, 'cancel');
    }
    this.raise(new OrderCancelledEvent({
      orderId: this._id.value,
      reason,
    }));
  }

  // Apply: Deterministic state transitions
  protected apply(event: DomainEvent | StoredEvent): void {
    const data = 'eventData' in event ? event.eventData : event.toPayload();
    const type = 'eventType' in event ? event.eventType : event.constructor.name;

    switch (type) {
      case 'OrderPlacedEvent':
        this._id = OrderId.from(data.orderId);
        this._customerId = CustomerId.from(data.customerId);
        this._items = data.items.map((i: any) => OrderItem.reconstitute(i));
        this._status = OrderStatus.PENDING;
        this._totalAmount = Money.of(data.totalAmount, data.currency);
        break;

      case 'OrderConfirmedEvent':
        this._status = OrderStatus.CONFIRMED;
        break;

      case 'OrderShippedEvent':
        this._status = OrderStatus.SHIPPED;
        break;

      case 'OrderCancelledEvent':
        this._status = OrderStatus.CANCELLED;
        break;

      default:
        throw new UnknownEventTypeError(type);
    }
  }
}
```

---

## 4. Repository for Event-Sourced Aggregates

```typescript
class EventSourcedOrderRepository implements OrderRepository {
  constructor(private readonly eventStore: EventStore) {}

  async findById(orderId: OrderId): Promise<Order | null> {
    const events = await this.eventStore.getEvents(orderId.value);
    if (events.length === 0) return null;

    const order = new Order();
    order.loadFromHistory(events);
    return order;
  }

  async save(order: Order): Promise<void> {
    const uncommittedEvents = order.uncommittedEvents;
    if (uncommittedEvents.length === 0) return;

    await this.eventStore.append(
      order.id.value,
      uncommittedEvents,
      order.version, // Optimistic concurrency
    );
    order.clearUncommittedEvents();
  }
}
```

---

## 5. Projections (Read Models)

```typescript
// Event sourcing separates WRITES (events) from READS (projections)
// Projections build optimized read models from events

// Projection: Order Dashboard (denormalized for fast reads)
class OrderDashboardProjection {
  constructor(private readonly readDb: ReadDatabase) {}

  // Subscribe to relevant events
  async onOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    await this.readDb.upsert('order_dashboard', event.payload.orderId, {
      orderId: event.payload.orderId,
      customerId: event.payload.customerId,
      status: 'pending',
      totalAmount: event.payload.totalAmount,
      currency: event.payload.currency,
      itemCount: event.payload.items.length,
      createdAt: event.metadata.timestamp,
    });
  }

  async onOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    await this.readDb.update('order_dashboard', event.payload.orderId, {
      status: 'confirmed',
      confirmedAt: event.metadata.timestamp,
    });
  }

  async onOrderShipped(event: OrderShippedEvent): Promise<void> {
    await this.readDb.update('order_dashboard', event.payload.orderId, {
      status: 'shipped',
      trackingNumber: event.payload.trackingNumber,
      carrier: event.payload.carrier,
      shippedAt: event.metadata.timestamp,
    });
  }

  // REBUILD: Replay all events from scratch to rebuild the projection
  async rebuild(): Promise<void> {
    await this.readDb.dropCollection('order_dashboard');
    const allEvents = await this.eventStore.getAllEvents();
    for (const event of allEvents) {
      await this.handleEvent(event);
    }
  }
}

// Query service reads from projection (fast, optimized)
class OrderDashboardQuery {
  async getOrdersForCustomer(customerId: string, page: number): Promise<PaginatedResult<OrderDashboardView>> {
    return this.readDb.find('order_dashboard', {
      customerId,
      orderBy: 'createdAt DESC',
      page,
      pageSize: 20,
    });
  }
}
```

---

## 6. Snapshots (Performance Optimization)

```typescript
// PROBLEM: Replaying 10,000 events to rebuild aggregate is slow
// SOLUTION: Periodically save a snapshot of the current state

interface Snapshot {
  aggregateId: string;
  version: number;        // Version at snapshot time
  state: Record<string, unknown>; // Serialized aggregate state
  createdAt: Date;
}

class SnapshotEventStore implements EventStore {
  constructor(
    private readonly eventStore: EventStore,
    private readonly snapshotStore: SnapshotStore,
    private readonly snapshotFrequency: number = 100, // Snapshot every 100 events
  ) {}

  async getAggregate<T extends EventSourcedAggregate>(
    aggregateId: string,
    factory: () => T,
  ): Promise<T | null> {
    // Try to load snapshot first
    const snapshot = await this.snapshotStore.getLatest(aggregateId);

    let events: StoredEvent[];
    const aggregate = factory();

    if (snapshot) {
      // Restore from snapshot, then replay only events AFTER the snapshot
      aggregate.restoreFromSnapshot(snapshot.state);
      events = await this.eventStore.getEvents(aggregateId, snapshot.version);
    } else {
      // No snapshot — replay all events
      events = await this.eventStore.getEvents(aggregateId);
    }

    if (events.length === 0 && !snapshot) return null;
    aggregate.loadFromHistory(events);
    return aggregate;
  }

  async save<T extends EventSourcedAggregate>(aggregate: T): Promise<void> {
    await this.eventStore.append(
      aggregate.id.value,
      aggregate.uncommittedEvents,
      aggregate.version,
    );

    // Create snapshot if threshold reached
    if (aggregate.version % this.snapshotFrequency === 0) {
      await this.snapshotStore.save({
        aggregateId: aggregate.id.value,
        version: aggregate.version,
        state: aggregate.toSnapshot(),
        createdAt: new Date(),
      });
    }

    aggregate.clearUncommittedEvents();
  }
}
```

---

## 7. When to Use Event Sourcing

```
✅ USE EVENT SOURCING WHEN:
  - Complete audit trail required (financial, healthcare, legal)
  - Temporal queries needed ("What was the state at time T?")
  - Complex domain with many state transitions
  - Need to replay events to fix bugs or build new projections
  - Event-driven architecture is already in place
  - Domain experts think in terms of events (Event Storming)

❌ DO NOT USE EVENT SOURCING WHEN:
  - Simple CRUD application (overkill)
  - No audit requirements
  - Team has no experience with event sourcing
  - Read-heavy application with simple queries
  - The domain is well-served by traditional state-based persistence
  - You "just want to try it" (complexity is NOT free)

HYBRID APPROACH (recommended):
  - Use event sourcing for complex aggregates with audit needs
  - Use traditional persistence for simple CRUD entities
  - Mix within the same application — not all-or-nothing
```

---

## 8. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **Event Sourcing Everything** | Using ES for simple CRUD entities | ES only for complex aggregates with audit needs |
| **Mutable Events** | Modifying events after they're stored | Events are IMMUTABLE. Publish correction events instead |
| **Missing Snapshots** | Replaying 100K events per aggregate load | Add snapshots every 50-100 events |
| **Projection in Same Transaction** | Building read model in same TX as event store | Projections are async, eventually consistent |
| **Giant Events** | Events with 100+ fields | Events carry only changed data, not entire state |
| **No Event Versioning** | Changing event schema breaks replay | Version events, write upcasters for migration |
| **Using Events for Current State Queries** | Reading events instead of projections | Build optimized projections for reads |
| **Deleting Events** | Removing events from the store | NEVER delete events. Mark as superseded if needed |

---

## 9. Enforcement Checklist

- [ ] **Append-only event store** — events are NEVER updated or deleted
- [ ] **Optimistic concurrency** — version check prevents concurrent writes
- [ ] **Deterministic apply()** — replaying same events produces same state
- [ ] **Snapshots for performance** — aggregates with > 100 events have snapshots
- [ ] **Projections for reads** — read models built from events, not from event store directly
- [ ] **Event versioning** — events have version, upcasters handle schema migration
- [ ] **Idempotent projections** — replaying events produces same read model
- [ ] **Hybrid approach considered** — not every aggregate needs event sourcing
- [ ] **Projection rebuild capability** — can rebuild any projection from scratch
- [ ] **Correlation IDs in events** — every event carries correlationId and causationId
