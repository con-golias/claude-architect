# CQRS (Command Query Responsibility Segregation) — Complete Specification

> **AI Plugin Directive:** CQRS separates the WRITE model (commands that change state) from the READ model (queries that return data). The write side optimizes for business rules and data integrity. The read side optimizes for query performance with denormalized views. Use CQRS when read and write patterns have fundamentally different requirements. Do NOT use CQRS for simple CRUD — the added complexity is not justified.

---

## 1. The Core Rule

**Commands (writes) and Queries (reads) are handled by SEPARATE models, potentially with SEPARATE data stores. The command model enforces business rules. The query model provides fast, optimized reads. They are kept in sync through events.**

```
TRADITIONAL (One Model for Read + Write):
  Controller → Service → Repository → Database
  Same model for writes AND reads
  Compromise: Not optimal for either

CQRS (Separate Models):
  WRITE PATH:
    Controller → CommandHandler → Aggregate → EventStore/Database
    Optimized for business rules, validation, consistency

  READ PATH:
    Controller → QueryHandler → ReadModel → Read Database
    Optimized for fast queries, denormalized, multiple views
```

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           API Layer                             │
│                                                                 │
│   POST /orders (command)              GET /orders/:id (query)   │
│         │                                    │                  │
│         ▼                                    ▼                  │
│  ┌──────────────┐                   ┌──────────────┐           │
│  │ Command      │                   │ Query        │           │
│  │ Handler      │                   │ Handler      │           │
│  │              │                   │              │           │
│  │ Validates    │                   │ Reads from   │           │
│  │ Enforces     │                   │ optimized    │           │
│  │ business     │                   │ read model   │           │
│  │ rules        │                   │              │           │
│  └──────┬───────┘                   └──────┬───────┘           │
│         │                                  │                   │
│         ▼                                  ▼                   │
│  ┌──────────────┐   events    ┌──────────────────┐            │
│  │ Write DB     │───────────►│ Read DB           │            │
│  │ (normalized) │            │ (denormalized)    │            │
│  │              │  projection│                   │            │
│  │ PostgreSQL   │            │ Elasticsearch /   │            │
│  │ (or Event    │            │ MongoDB /         │            │
│  │  Store)      │            │ Redis /           │            │
│  │              │            │ PostgreSQL views   │            │
│  └──────────────┘            └──────────────────┘            │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Command Side (Write Model)

### Command Definition

```typescript
// Commands represent INTENT to change state
// Named as imperative verbs: PlaceOrder, CancelOrder, ApplyDiscount

// Command: explicit data needed for the operation
class PlaceOrderCommand {
  constructor(
    public readonly customerId: string,
    public readonly items: Array<{
      productId: string;
      quantity: number;
    }>,
    public readonly shippingAddress: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    },
    public readonly paymentMethodId: string,
  ) {}
}

class CancelOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
  ) {}
}

class ApplyDiscountCommand {
  constructor(
    public readonly orderId: string,
    public readonly discountCode: string,
  ) {}
}
```

### Command Handler

```typescript
// Command handlers contain the business logic for state changes
// They return minimal data — usually just an ID or void

class PlaceOrderHandler {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly catalogPort: CatalogPort,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<{ orderId: string }> {
    // 1. Validate business rules
    const items = await this.buildOrderItems(command.items);

    // 2. Execute domain logic
    const order = Order.place(
      CustomerId.from(command.customerId),
      items,
      ShippingAddress.from(command.shippingAddress),
    );

    // 3. Persist (to write DB or event store)
    await this.orderRepo.save(order);

    // 4. Publish events (for read model update)
    await this.eventPublisher.publishAll(order.domainEvents);

    // 5. Return minimal data
    return { orderId: order.id.value };
  }

  private async buildOrderItems(items: Array<{ productId: string; quantity: number }>) {
    return Promise.all(items.map(async (item) => {
      const product = await this.catalogPort.getProduct(item.productId);
      if (!product) throw new ProductNotFoundError(item.productId);
      return OrderItem.create(
        ProductId.from(item.productId),
        Quantity.of(item.quantity),
        product.price,
      );
    }));
  }
}

// RULES FOR COMMAND HANDLERS:
// 1. One command = one handler
// 2. Handler validates, executes domain logic, persists, publishes events
// 3. Handler returns MINIMAL data (ID, void, or simple result)
// 4. Handler does NOT return the full entity or rich data (that's a query)
// 5. Handler does NOT call other command handlers
```

### Command Validation

```typescript
// TWO LEVELS OF VALIDATION:

// Level 1: Format validation (in the API layer / command validator)
class PlaceOrderValidator {
  validate(command: PlaceOrderCommand): ValidationResult {
    const errors: ValidationError[] = [];

    if (!command.customerId) errors.push({ field: 'customerId', message: 'Required' });
    if (!command.items?.length) errors.push({ field: 'items', message: 'At least one item required' });

    for (let i = 0; i < command.items?.length ?? 0; i++) {
      if (command.items[i].quantity < 1) {
        errors.push({ field: `items[${i}].quantity`, message: 'Must be >= 1' });
      }
    }

    return errors.length > 0 ? ValidationResult.invalid(errors) : ValidationResult.valid();
  }
}

// Level 2: Business rule validation (in the domain / command handler)
// "Can this customer place an order?" — checked in the handler
// "Is this product available?" — checked in the handler
// "Has the order already been cancelled?" — checked in the aggregate
```

---

## 4. Query Side (Read Model)

### Query Definition

```typescript
// Queries represent a REQUEST for data
// Named descriptively: GetOrderById, ListOrdersForCustomer, SearchProducts

class GetOrderByIdQuery {
  constructor(public readonly orderId: string) {}
}

class ListOrdersForCustomerQuery {
  constructor(
    public readonly customerId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly status?: string,
  ) {}
}

class OrderDashboardQuery {
  constructor(
    public readonly dateFrom: string,
    public readonly dateTo: string,
    public readonly groupBy: 'day' | 'week' | 'month',
  ) {}
}
```

### Query Handler

```typescript
// Query handlers read from the optimized read model
// They do NOT enforce business rules or trigger side effects

class GetOrderByIdHandler {
  constructor(private readonly readDb: ReadDatabase) {}

  async execute(query: GetOrderByIdQuery): Promise<OrderDetailView | null> {
    // Simple read from denormalized view — one query, no joins
    return this.readDb.findOne('order_details', { orderId: query.orderId });
  }
}

class ListOrdersForCustomerHandler {
  constructor(private readonly readDb: ReadDatabase) {}

  async execute(query: ListOrdersForCustomerQuery): Promise<PaginatedResult<OrderSummaryView>> {
    return this.readDb.find('order_summaries', {
      where: {
        customerId: query.customerId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}

// RULES FOR QUERY HANDLERS:
// 1. Queries NEVER change state
// 2. Queries read from optimized read models (not the write model)
// 3. Queries can return rich, denormalized data
// 4. Queries do NOT trigger events or side effects
// 5. Multiple query handlers can serve different views of the same data
```

### Read Model (Projections)

```typescript
// Projections build denormalized read models from domain events
// Each projection creates an optimized view for specific queries

// Read model: Order Detail View (for single order page)
interface OrderDetailView {
  orderId: string;
  customerName: string;           // Denormalized from Identity module
  customerEmail: string;          // Denormalized from Identity module
  status: string;
  items: Array<{
    productId: string;
    productName: string;          // Denormalized from Catalog module
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  totalAmount: number;
  currency: string;
  shippingAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  trackingNumber?: string;        // From Fulfillment module
  estimatedDelivery?: string;     // From Fulfillment module
  createdAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

// Projection builder: Listens to events, updates read model
class OrderDetailProjection {
  async onOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    // Fetch customer name from Identity module (or from event payload)
    await this.readDb.upsert('order_details', event.payload.orderId, {
      orderId: event.payload.orderId,
      customerId: event.payload.customerId,
      status: 'pending',
      items: event.payload.items,
      totalAmount: event.payload.totalAmount,
      currency: event.payload.currency,
      shippingAddress: event.payload.shippingAddress,
      createdAt: event.metadata.timestamp,
    });
  }

  async onOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    await this.readDb.update('order_details', event.payload.orderId, {
      status: 'confirmed',
      confirmedAt: event.metadata.timestamp,
    });
  }

  async onOrderShipped(event: OrderShippedEvent): Promise<void> {
    await this.readDb.update('order_details', event.payload.orderId, {
      status: 'shipped',
      trackingNumber: event.payload.trackingNumber,
      estimatedDelivery: event.payload.estimatedDelivery,
      shippedAt: event.metadata.timestamp,
    });
  }

  async onCustomerNameChanged(event: CustomerNameChangedEvent): Promise<void> {
    // Update ALL orders for this customer (denormalized data)
    await this.readDb.updateMany('order_details',
      { customerId: event.payload.customerId },
      { customerName: event.payload.newName },
    );
  }
}

// Read model: Order Summary View (for list page — different fields, optimized)
interface OrderSummaryView {
  orderId: string;
  status: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}
```

---

## 5. CQRS Variants

### Simple CQRS (Same Database)

```
The SIMPLEST form: separate command and query models in code,
but SAME database for both.

Write Model: Domain entities → normalized tables
Read Model: SQL views or materialized views on same database

Pros: Simple, no sync issues, ACID consistency
Cons: Cannot independently scale read/write
Best for: Most applications
```

```sql
-- Same database, different representations
-- Write tables (normalized)
CREATE TABLE ordering.orders (...);
CREATE TABLE ordering.order_items (...);

-- Read views (denormalized)
CREATE MATERIALIZED VIEW ordering.order_details_view AS
  SELECT
    o.id AS order_id,
    o.status,
    o.created_at,
    COALESCE(json_agg(json_build_object(
      'productId', oi.product_id,
      'quantity', oi.quantity,
      'unitPrice', oi.unit_price,
      'lineTotal', oi.quantity * oi.unit_price
    )), '[]'::json) AS items,
    SUM(oi.quantity * oi.unit_price) AS total_amount
  FROM ordering.orders o
  LEFT JOIN ordering.order_items oi ON oi.order_id = o.id
  GROUP BY o.id;

-- Refresh after writes
REFRESH MATERIALIZED VIEW CONCURRENTLY ordering.order_details_view;
```

### Full CQRS (Separate Databases)

```
Write to a normalized write database.
Project events to a separate, optimized read database.
Read model is EVENTUALLY CONSISTENT with write model.

Write DB: PostgreSQL (normalized, ACID, write-optimized)
Read DB: Elasticsearch (search-optimized), Redis (cache), MongoDB (document queries)

Pros: Independent scaling, optimized for each workload
Cons: Eventual consistency, complexity, two databases to manage
Best for: High-scale applications with different read/write patterns
```

### CQRS + Event Sourcing

```
Event Store is the write model.
Projections build read models from events.
This is the MOST POWERFUL combination.

Write: Events → Event Store (append-only)
Read: Projections → Multiple read databases (one per query type)

Pros: Full audit trail, temporal queries, multiple read models
Cons: Most complex, requires event sourcing expertise
Best for: Complex domains with audit requirements
```

---

## 6. Consistency Between Read and Write

```typescript
// The read model is EVENTUALLY CONSISTENT with the write model.
// There is a LAG between a write and the read model being updated.

// TYPICAL LAG:
//   Same process, in-memory event bus: < 1ms
//   Same database, materialized view: < 100ms (on refresh)
//   Kafka/RabbitMQ event: 50-500ms
//   This is acceptable for most use cases

// WHEN STRONG CONSISTENCY IS NEEDED:
// Option 1: Read from write model for immediate reads after write
class OrderController {
  @Post()
  async placeOrder(@Body() body: PlaceOrderRequest): Promise<OrderResponse> {
    const result = await this.placeOrderHandler.execute(command);
    // Return the ID immediately — client can poll for details
    return { orderId: result.orderId, status: 'processing' };
  }

  @Get(':id')
  async getOrder(@Param('id') id: string): Promise<OrderDetailView> {
    // Read from read model (may have slight lag)
    return this.getOrderHandler.execute({ orderId: id });
  }
}

// Option 2: Synchronous projection update (simple CQRS)
class PlaceOrderHandler {
  async execute(command: PlaceOrderCommand): Promise<{ orderId: string }> {
    await this.db.transaction(async (tx) => {
      await this.orderRepo.save(order, tx);
      // Update read model in same transaction
      await this.readModelUpdater.onOrderPlaced(order, tx);
    });
    return { orderId: order.id.value };
  }
}

// Option 3: Optimistic UI (client-side)
// Client assumes the write succeeded and shows optimistic state
// Read model catches up within milliseconds
```

---

## 7. When to Use CQRS

```
✅ USE CQRS WHEN:
  - Read and write patterns are fundamentally different
    (e.g., writes are complex domain operations, reads are simple lookups)
  - Read load is much higher than write load (10:1 or more)
  - You need multiple read models for different query patterns
  - Read performance requires denormalization that the write model shouldn't have
  - You're already using event-driven architecture

⚠️ SIMPLE CQRS (same DB) is appropriate for:
  - Most web applications with moderate complexity
  - Applications where materialized views solve read performance
  - Teams with moderate experience

❌ DO NOT USE CQRS WHEN:
  - Simple CRUD application
  - Read and write patterns are similar
  - Team has no experience with CQRS
  - Strong consistency is required everywhere
  - You don't have event-driven infrastructure
  - "Because it sounds cool" is the reason

RECOMMENDATION:
  Start with traditional single model.
  If read performance suffers → add Simple CQRS (materialized views).
  If that's not enough → add Full CQRS (separate read DB).
  If you need audit trail → add Event Sourcing.
  Each step is incremental, NOT a rewrite.
```

---

## 8. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **CQRS Everywhere** | Using CQRS for simple CRUD | CQRS only where read/write patterns diverge |
| **No Projection Rebuild** | Cannot rebuild read model from events | Always support full projection rebuild |
| **Stale Read Model** | Read model minutes behind, users confused | Monitor lag, alert if > threshold, show "updating" |
| **Command Returns Full Entity** | PlaceOrder returns complete OrderDetail | Commands return minimal data (ID), use query for details |
| **Query Modifies State** | GetOrder triggers side effects | Queries are PURE reads, no state changes |
| **Shared Model** | Same class for command and query | Separate models optimized for each purpose |
| **Over-Denormalization** | Read model duplicates everything | Denormalize only fields needed for specific queries |
| **No Command Validation** | Invalid commands reach the domain | Validate format at API layer, business rules in handler |

---

## 9. Enforcement Checklist

- [ ] **Commands and queries separated** — different handlers, different models
- [ ] **Commands return minimal data** — ID or void, not full entities
- [ ] **Queries never modify state** — pure reads from read model
- [ ] **Read model is projection** — built from events, not from write model directly
- [ ] **Projection is rebuildable** — can replay events to rebuild any read model
- [ ] **Consistency lag monitored** — alert if read model falls behind write model
- [ ] **Multiple read models if needed** — different views for different query patterns
- [ ] **Simple CQRS first** — start with same-DB materialized views before separate DBs
- [ ] **Event-driven sync** — read model updated by events, not by polling write DB
- [ ] **CQRS only where justified** — not every module needs CQRS
