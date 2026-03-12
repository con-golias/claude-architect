# Monolith Architecture — Complete Specification

> **AI Plugin Directive:** A monolith is a single deployable unit containing all application functionality. Despite popular misconception, a well-structured monolith is the CORRECT starting architecture for most applications. It is NOT an anti-pattern — a "big ball of mud" is the anti-pattern. A monolith with clear module boundaries, proper layering, and enforced dependency rules is a powerful, maintainable architecture that most teams should start with and many should stay with.

---

## 1. The Core Rule

**A monolith is a single deployment artifact that contains all application code. This is a FEATURE, not a limitation. Single deployment means simpler operations, strong data consistency, easier debugging, and faster development velocity for teams under 30 developers.**

---

## 2. Types of Monoliths

### Well-Structured Monolith

```
src/
├── modules/                        # Bounded contexts as modules
│   ├── ordering/                   # Order management module
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── api/
│   ├── catalog/                    # Product catalog module
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── api/
│   ├── billing/                    # Payment and invoicing module
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── api/
│   └── shipping/                   # Fulfillment module
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       └── api/
├── shared-kernel/                  # Value objects shared across modules
│   ├── money.ts
│   ├── address.ts
│   └── user-id.ts
├── infrastructure/                 # Cross-cutting infrastructure
│   ├── database/
│   ├── messaging/
│   └── auth/
└── main.ts                        # Composition root

Characteristics:
  ✅ Clear module boundaries (like microservices without the network)
  ✅ Each module has its own domain model
  ✅ Modules communicate through well-defined interfaces
  ✅ Can be extracted to microservices later if needed
  ✅ Single deployment, single database, single process
```

### Big Ball of Mud (Anti-Pattern)

```
src/
├── controllers/                    # ALL controllers mixed together
│   ├── order-controller.ts
│   ├── product-controller.ts
│   ├── user-controller.ts
│   └── payment-controller.ts
├── services/                       # ALL services mixed together
│   ├── order-service.ts           # Calls product-service, user-service, payment-service
│   ├── product-service.ts         # Calls order-service (circular!)
│   ├── user-service.ts
│   └── payment-service.ts
├── models/                        # ALL database models mixed together
│   ├── order.model.ts
│   ├── product.model.ts
│   └── user.model.ts
├── utils/                         # Random utility functions
│   ├── helpers.ts                 # 2000 lines of mixed concerns
│   └── validators.ts
└── app.ts

Problems:
  ❌ No module boundaries — everything imports everything
  ❌ Circular dependencies between services
  ❌ Business logic scattered across controllers and services
  ❌ Database models used as domain models
  ❌ Cannot extract modules — everything is entangled
  ❌ Changes in one area break unrelated areas
```

---

## 3. Monolith Advantages

```
┌────────────────────────────────────────────────────────────────────┐
│                    WHY MONOLITHS ARE POWERFUL                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  DEVELOPMENT SPEED                                                 │
│  • Single codebase — easy to understand, navigate, refactor        │
│  • In-process function calls — no network latency                  │
│  • One IDE, one debug session, step-through debugging              │
│  • Shared types — compile-time safety across all modules           │
│  • Refactoring tools work across the entire codebase               │
│                                                                    │
│  OPERATIONAL SIMPLICITY                                            │
│  • One deployment artifact — build, test, deploy once              │
│  • One database — ACID transactions, joins, consistency            │
│  • One monitoring target — simpler alerting and dashboards         │
│  • One log stream — no distributed tracing needed                  │
│  • Simpler CI/CD — one pipeline, faster feedback                   │
│                                                                    │
│  DATA CONSISTENCY                                                  │
│  • ACID transactions across all modules                            │
│  • JOIN queries across all data — no data duplication              │
│  • No eventual consistency headaches                               │
│  • No saga pattern complexity                                      │
│  • No outbox pattern needed                                        │
│                                                                    │
│  COST                                                              │
│  • Less infrastructure — no service mesh, API gateway, etc.        │
│  • Fewer engineering hours on DevOps                               │
│  • Lower cloud costs — single process, shared resources            │
│  • Smaller team can build and maintain it                          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Monolith Implementation Patterns

### Clean Architecture in a Monolith

```typescript
// Each module follows Clean Architecture internally
// Modules communicate through interfaces, NOT direct imports

// ordering/domain/ports/catalog-port.ts (interface defined in ordering module)
interface CatalogPort {
  getProduct(productId: ProductId): Promise<ProductInfo>;
  checkAvailability(productId: ProductId, quantity: Quantity): Promise<boolean>;
}

// ordering/infrastructure/adapters/catalog-adapter.ts
// Adapts the catalog module's public API to ordering's needs
class CatalogAdapter implements CatalogPort {
  constructor(private readonly catalogModule: CatalogPublicApi) {}

  async getProduct(productId: ProductId): Promise<ProductInfo> {
    const product = await this.catalogModule.findProduct(productId.value);
    return ProductInfo.create(
      productId,
      product.name,
      Money.of(product.price, product.currency),
    );
  }

  async checkAvailability(productId: ProductId, quantity: Quantity): Promise<boolean> {
    return this.catalogModule.isAvailable(productId.value, quantity.value);
  }
}

// Each module exposes a PUBLIC API — the only way other modules can interact
// catalog/catalog-public-api.ts
class CatalogPublicApi {
  constructor(private readonly productRepo: ProductRepository) {}

  async findProduct(productId: string): Promise<ProductDto> { ... }
  async isAvailable(productId: string, quantity: number): Promise<boolean> { ... }
  async search(query: string, filters: SearchFilters): Promise<SearchResult> { ... }
}
```

### Event-Driven Communication Within a Monolith

```typescript
// Even in a monolith, modules should communicate through events for decoupling

// Shared event bus (in-process, synchronous or asynchronous)
interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
}

// In-process event bus implementation
class InProcessEventBus implements EventBus {
  private handlers = new Map<string, EventHandler[]>();

  subscribe(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    // Execute handlers asynchronously but within the same process
    await Promise.all(handlers.map(h => h.handle(event)));
  }
}

// Ordering module publishes events
class PlaceOrderUseCase {
  async execute(command: PlaceOrderCommand): Promise<OrderId> {
    const order = Order.place(command.customerId, command.items);
    await this.orderRepo.save(order);
    await this.eventBus.publish(new OrderPlacedEvent(order));
    return order.id;
  }
}

// Shipping module subscribes (no direct dependency on ordering)
class OnOrderPlacedHandler implements EventHandler {
  async handle(event: OrderPlacedEvent): Promise<void> {
    await this.shipmentService.createShipment(event.orderId, event.items);
  }
}

// Benefits:
// - Modules are decoupled (shipping doesn't import ordering)
// - Easy to add new subscribers without modifying publisher
// - Can switch to message broker later (for microservice extraction) by
//   replacing InProcessEventBus with KafkaEventBus
```

### Transaction Management

```typescript
// ADVANTAGE OF MONOLITH: Cross-module transactions are EASY

// ❌ In microservices, this requires a saga with compensating transactions
// ✅ In a monolith, it's one database transaction

class PlaceOrderUseCase {
  constructor(
    private readonly db: DatabaseConnection,
    private readonly orderRepo: OrderRepository,
    private readonly inventoryRepo: InventoryRepository,
    private readonly paymentService: PaymentService,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<OrderId> {
    // One transaction, all-or-nothing
    return this.db.transaction(async (tx) => {
      // 1. Create order
      const order = Order.place(command.customerId, command.items);
      await this.orderRepo.save(order, tx);

      // 2. Reserve inventory
      for (const item of command.items) {
        await this.inventoryRepo.reserve(item.productId, item.quantity, order.id, tx);
      }

      // 3. Capture payment
      await this.paymentService.capture(order.totalAmount, command.paymentMethod, tx);

      // 4. Confirm order
      order.confirm();
      await this.orderRepo.save(order, tx);

      return order.id;
      // If ANY step fails, everything rolls back automatically
    });
  }
}
```

---

## 5. Scaling a Monolith

### Horizontal Scaling

```
┌───────────────┐
│ Load Balancer  │
│ (Nginx/ALB)    │
└──────┬────────┘
       │
  ┌────┴─────────────────────────────┐
  │              │                    │
  ▼              ▼                    ▼
┌──────┐    ┌──────┐            ┌──────┐
│ App  │    │ App  │    ...     │ App  │
│ Inst │    │ Inst │            │ Inst │
│  1   │    │  2   │            │  N   │
└──┬───┘    └──┬───┘            └──┬───┘
   │           │                   │
   └───────────┼───────────────────┘
               │
         ┌─────▼──────┐
         │  Database   │
         │  (Primary)  │
         └─────┬──────┘
               │
         ┌─────▼──────┐
         │  Read       │
         │  Replicas   │
         └────────────┘

Rules:
  1. Application MUST be stateless (no in-memory sessions)
  2. Use external session store (Redis) or JWT tokens
  3. File uploads go to object storage (S3), not local disk
  4. Background jobs use distributed job queue (Bull, Celery)
  5. Use read replicas to offload database queries
```

### Caching Strategy

```typescript
// Multi-level caching for monolith performance

// Level 1: In-memory cache (fastest, per-instance)
const localCache = new NodeCache({ stdTTL: 60, maxKeys: 10000 });

// Level 2: Distributed cache (shared across instances)
const redisCache = new Redis(process.env.REDIS_URL);

// Level 3: Database query cache
// PostgreSQL: configure shared_buffers, effective_cache_size
// Use materialized views for expensive aggregation queries

class CachedProductRepository implements ProductRepository {
  async findById(productId: string): Promise<Product | null> {
    // Check L1 cache
    const l1 = localCache.get<Product>(`product:${productId}`);
    if (l1) return l1;

    // Check L2 cache
    const l2 = await redisCache.get(`product:${productId}`);
    if (l2) {
      const product = JSON.parse(l2);
      localCache.set(`product:${productId}`, product);
      return product;
    }

    // Database query
    const product = await this.db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (product) {
      localCache.set(`product:${productId}`, product);
      await redisCache.setex(`product:${productId}`, 300, JSON.stringify(product));
    }
    return product;
  }
}
```

### Database Optimization

```sql
-- Monolith database optimization checklist

-- 1. Proper indexing (80% of performance issues)
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status_date ON orders(status, created_at);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- 2. Read replicas for read-heavy workloads
-- Application sends writes to primary, reads to replica

-- 3. Table partitioning for large tables
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024_q1 PARTITION OF orders
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE orders_2024_q2 PARTITION OF orders
  FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- 4. Materialized views for complex queries
CREATE MATERIALIZED VIEW order_dashboard AS
  SELECT
    o.id, o.status, o.created_at,
    c.name AS customer_name,
    SUM(oi.quantity * oi.unit_price) AS total_amount
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN order_items oi ON oi.order_id = o.id
  GROUP BY o.id, o.status, o.created_at, c.name;

-- Refresh periodically or on trigger
REFRESH MATERIALIZED VIEW CONCURRENTLY order_dashboard;

-- 5. Connection pooling (PgBouncer)
-- Limit connections per instance: 10-20
-- Total connections across all instances: ≤ 100
```

---

## 6. Testing a Monolith

```typescript
// Testing is SIMPLER in a monolith — no network mocking, no contract tests

// Unit Tests: Domain logic (same as microservices)
describe('Order', () => {
  it('should calculate total with discount', () => {
    const order = Order.place('cust-1', [
      OrderItem.create('prod-1', 2, Money.of(29.99, 'USD')),
    ]);
    order.applyDiscount(Discount.percentage(10));
    expect(order.totalAmount).toEqual(Money.of(53.98, 'USD'));
  });
});

// Integration Tests: Module + database (simpler than microservices)
describe('PlaceOrderUseCase', () => {
  it('should create order and reserve inventory', async () => {
    // No need for Testcontainers for message broker
    // No need for contract tests
    // Just test against the real database
    const result = await useCase.execute({
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      paymentMethod: testPaymentMethod,
    });

    const order = await orderRepo.findById(result);
    expect(order.status).toBe(OrderStatus.CONFIRMED);

    const inventory = await inventoryRepo.getStock('prod-1');
    expect(inventory.reserved).toBe(2);
  });
});

// E2E Tests: Full application (simpler — one process)
describe('Order API', () => {
  it('should place order through REST API', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: 'prod-1', quantity: 2 }],
        shippingAddress: testAddress,
        paymentMethod: testPayment,
      })
      .expect(201);

    expect(response.body.orderId).toBeDefined();
    expect(response.body.status).toBe('confirmed');
  });
});
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **Big Ball of Mud** | Everything imports everything, no boundaries | Enforce module boundaries, use Clean Architecture |
| **Layered Spaghetti** | Controllers call repositories directly, skipping services | Strict layer enforcement, dependency rules |
| **God Class** | One service class with 50+ methods | Split by business capability into focused modules |
| **Shared Mutable State** | Global variables, singletons with state | Dependency injection, stateless services |
| **Monolithic Database** | One giant schema with 200+ tables | Schema-per-module (still one DB, but organized) |
| **No Module Boundaries** | Any code can import any other code | Import restrictions, public API per module |
| **Feature Branch Hell** | Long-lived branches, painful merges | Trunk-based development, feature flags |
| **Test Suite Too Slow** | Full test suite takes 30+ minutes | Parallelize, split by module, optimize DB setup |

---

## 8. Enforcement Checklist

- [ ] **Module boundaries enforced** — each module has a public API, no direct internal access
- [ ] **Dependency rule followed** — inner layers never import outer layers
- [ ] **Import restrictions** — modules cannot import other modules' internals
- [ ] **Shared kernel minimal** — only value objects (Money, Address, UserId) shared
- [ ] **Event-driven decoupling** — modules communicate through events where possible
- [ ] **Stateless instances** — no in-memory sessions, no local file storage
- [ ] **Horizontal scaling ready** — load balancer, external session store, object storage
- [ ] **Database optimized** — proper indexes, read replicas, connection pooling
- [ ] **Test suite < 10 minutes** — parallelized, module-level test suites
- [ ] **Monitoring in place** — application metrics, error tracking, health checks
- [ ] **Ready for extraction** — any module could become a microservice without rewriting
