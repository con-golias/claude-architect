# Monolith: Structure — Complete Specification

> **AI Plugin Directive:** A well-structured monolith is organized by BUSINESS MODULES, not by technical layers. Every module contains its own domain, application, infrastructure, and API layers. Modules communicate ONLY through public APIs and events, NEVER through direct internal imports. This structure makes the monolith maintainable, testable, and ready for future extraction to microservices if needed.

---

## 1. The Core Rule

**Organize by business module FIRST, then by layer within each module. A module is a bounded context that encapsulates a complete business capability. Modules are vertically sliced — each has its own controllers, services, repositories, and domain models.**

```
❌ WRONG: Organized by technical layer (horizontal slicing)
src/
├── controllers/          ← ALL controllers from ALL domains mixed
├── services/             ← ALL services mixed
├── repositories/         ← ALL repositories mixed
├── models/               ← ALL models mixed
└── utils/                ← Dumping ground

✅ CORRECT: Organized by business module (vertical slicing)
src/
├── modules/
│   ├── ordering/         ← Complete ordering capability
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── api/
│   ├── catalog/          ← Complete catalog capability
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── api/
│   └── billing/          ← Complete billing capability
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       └── api/
└── shared-kernel/
```

---

## 2. Complete Project Structure

### TypeScript/NestJS Monolith

```
src/
├── modules/
│   ├── ordering/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── order.ts                    # Aggregate root
│   │   │   │   ├── order-item.ts               # Entity within aggregate
│   │   │   │   └── order-status.ts             # Enum/value type
│   │   │   ├── value-objects/
│   │   │   │   ├── order-id.ts
│   │   │   │   ├── quantity.ts
│   │   │   │   └── shipping-address.ts
│   │   │   ├── events/
│   │   │   │   ├── order-placed.event.ts
│   │   │   │   ├── order-confirmed.event.ts
│   │   │   │   └── order-cancelled.event.ts
│   │   │   ├── ports/
│   │   │   │   ├── order.repository.ts          # Repository interface
│   │   │   │   ├── catalog-port.ts              # Interface to catalog module
│   │   │   │   └── payment-port.ts              # Interface to billing module
│   │   │   ├── policies/
│   │   │   │   ├── order-cancellation.policy.ts
│   │   │   │   └── discount.policy.ts
│   │   │   └── errors/
│   │   │       ├── order-not-found.error.ts
│   │   │       ├── insufficient-stock.error.ts
│   │   │       └── order-already-confirmed.error.ts
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   ├── place-order.command.ts        # Command DTO
│   │   │   │   ├── place-order.handler.ts        # Use case
│   │   │   │   ├── cancel-order.command.ts
│   │   │   │   └── cancel-order.handler.ts
│   │   │   ├── queries/
│   │   │   │   ├── get-order.query.ts
│   │   │   │   ├── get-order.handler.ts
│   │   │   │   ├── list-orders.query.ts
│   │   │   │   └── list-orders.handler.ts
│   │   │   ├── event-handlers/
│   │   │   │   ├── on-payment-captured.handler.ts
│   │   │   │   └── on-inventory-reserved.handler.ts
│   │   │   └── dto/
│   │   │       ├── order.dto.ts                  # Response DTO
│   │   │       └── order-summary.dto.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── order.orm-entity.ts           # TypeORM/Prisma entity
│   │   │   │   ├── order.repository.impl.ts      # Implements OrderRepository port
│   │   │   │   ├── order.mapper.ts               # Maps ORM ↔ Domain
│   │   │   │   └── migrations/
│   │   │   │       ├── 001-create-orders-table.ts
│   │   │   │       └── 002-add-shipping-address.ts
│   │   │   ├── adapters/
│   │   │   │   ├── catalog.adapter.ts            # Implements CatalogPort
│   │   │   │   └── payment.adapter.ts            # Implements PaymentPort
│   │   │   └── providers/
│   │   │       └── ordering.providers.ts         # DI container setup
│   │   ├── api/
│   │   │   ├── controllers/
│   │   │   │   └── order.controller.ts
│   │   │   ├── validators/
│   │   │   │   ├── place-order.validator.ts
│   │   │   │   └── cancel-order.validator.ts
│   │   │   └── mappers/
│   │   │       └── order-response.mapper.ts      # DTO → HTTP response
│   │   ├── ordering.module.ts                    # NestJS module definition
│   │   └── ordering.public-api.ts                # PUBLIC interface for other modules
│   │
│   ├── catalog/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── product.ts
│   │   │   │   └── category.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── product-id.ts
│   │   │   │   ├── sku.ts
│   │   │   │   └── price.ts
│   │   │   ├── events/
│   │   │   │   ├── product-created.event.ts
│   │   │   │   └── price-changed.event.ts
│   │   │   └── ports/
│   │   │       ├── product.repository.ts
│   │   │       └── search-engine.ts
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   └── queries/
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   ├── search/
│   │   │   │   └── elasticsearch.adapter.ts
│   │   │   └── providers/
│   │   ├── api/
│   │   │   └── controllers/
│   │   ├── catalog.module.ts
│   │   └── catalog.public-api.ts
│   │
│   ├── billing/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   ├── api/
│   │   ├── billing.module.ts
│   │   └── billing.public-api.ts
│   │
│   └── identity/
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       ├── api/
│       ├── identity.module.ts
│       └── identity.public-api.ts
│
├── shared-kernel/                               # ONLY shared value objects
│   ├── value-objects/
│   │   ├── money.ts
│   │   ├── email-address.ts
│   │   ├── address.ts
│   │   └── user-id.ts
│   ├── events/
│   │   ├── domain-event.ts                      # Base event class
│   │   └── event-bus.ts                         # Event bus interface
│   └── types/
│       ├── result.ts                            # Result<T, E> type
│       └── pagination.ts                        # PaginatedResult<T>
│
├── infrastructure/                              # Application-wide infrastructure
│   ├── database/
│   │   ├── database.module.ts
│   │   └── database.config.ts
│   ├── event-bus/
│   │   └── in-process-event-bus.ts              # Event bus implementation
│   ├── auth/
│   │   ├── jwt.strategy.ts
│   │   ├── auth.guard.ts
│   │   └── roles.guard.ts
│   ├── logging/
│   │   └── logger.service.ts
│   └── health/
│       └── health.controller.ts
│
├── config/
│   ├── app.config.ts
│   └── env.validation.ts
│
├── app.module.ts                                # Root module — imports all modules
└── main.ts                                      # Bootstrap
```

### Python/FastAPI Monolith

```
src/
├── modules/
│   ├── ordering/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── order.py
│   │   │   │   └── order_item.py
│   │   │   ├── value_objects/
│   │   │   │   ├── order_id.py
│   │   │   │   └── quantity.py
│   │   │   ├── events/
│   │   │   │   └── order_placed.py
│   │   │   ├── ports/
│   │   │   │   ├── order_repository.py          # Abstract base class
│   │   │   │   └── catalog_port.py
│   │   │   └── errors.py
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   ├── place_order.py
│   │   │   │   └── cancel_order.py
│   │   │   └── queries/
│   │   │       └── get_order.py
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── sqlalchemy_order_repo.py
│   │   │   │   ├── order_model.py               # SQLAlchemy model
│   │   │   │   └── order_mapper.py
│   │   │   └── adapters/
│   │   │       └── catalog_adapter.py
│   │   ├── api/
│   │   │   ├── routes.py
│   │   │   ├── schemas.py                       # Pydantic schemas
│   │   │   └── dependencies.py                  # FastAPI dependencies
│   │   ├── __init__.py
│   │   └── public_api.py
│   │
│   ├── catalog/
│   │   └── ...  (same structure)
│   └── billing/
│       └── ...  (same structure)
│
├── shared_kernel/
│   ├── value_objects/
│   │   ├── money.py
│   │   └── address.py
│   └── events/
│       ├── domain_event.py
│       └── event_bus.py
│
├── infrastructure/
│   ├── database.py
│   ├── event_bus_impl.py
│   └── auth/
│       └── jwt_auth.py
│
├── config.py
└── main.py
```

### C#/ASP.NET Core Monolith

```
src/
├── Modules/
│   ├── Ordering/
│   │   ├── Ordering.Domain/
│   │   │   ├── Entities/
│   │   │   │   ├── Order.cs
│   │   │   │   └── OrderItem.cs
│   │   │   ├── ValueObjects/
│   │   │   │   ├── OrderId.cs
│   │   │   │   └── Quantity.cs
│   │   │   ├── Events/
│   │   │   │   └── OrderPlacedEvent.cs
│   │   │   ├── Ports/
│   │   │   │   ├── IOrderRepository.cs
│   │   │   │   └── ICatalogPort.cs
│   │   │   └── Errors/
│   │   │       └── OrderNotFoundError.cs
│   │   ├── Ordering.Application/
│   │   │   ├── Commands/
│   │   │   │   ├── PlaceOrder/
│   │   │   │   │   ├── PlaceOrderCommand.cs
│   │   │   │   │   ├── PlaceOrderHandler.cs
│   │   │   │   │   └── PlaceOrderValidator.cs
│   │   │   │   └── CancelOrder/
│   │   │   └── Queries/
│   │   │       └── GetOrder/
│   │   ├── Ordering.Infrastructure/
│   │   │   ├── Persistence/
│   │   │   │   ├── OrderRepository.cs
│   │   │   │   ├── OrderConfiguration.cs       # EF Core config
│   │   │   │   └── OrderingDbContext.cs
│   │   │   └── Adapters/
│   │   │       └── CatalogAdapter.cs
│   │   └── Ordering.Api/
│   │       ├── Controllers/
│   │       │   └── OrderController.cs
│   │       └── OrderingModule.cs               # Module registration
│   │
│   ├── Catalog/
│   │   └── ...  (same structure)
│   └── Billing/
│       └── ...  (same structure)
│
├── SharedKernel/
│   ├── ValueObjects/
│   │   ├── Money.cs
│   │   └── Address.cs
│   └── Events/
│       ├── DomainEvent.cs
│       └── IEventBus.cs
│
├── Infrastructure/
│   ├── EventBus/
│   │   └── InProcessEventBus.cs
│   ├── Auth/
│   │   └── JwtAuthHandler.cs
│   └── Logging/
│       └── StructuredLogger.cs
│
├── Api/
│   ├── Middleware/
│   │   ├── ErrorHandlingMiddleware.cs
│   │   └── CorrelationIdMiddleware.cs
│   └── Program.cs                              # Composition root
│
└── Solution.sln
```

---

## 3. Module Communication Rules

### Rule 1: Modules Communicate Through Public APIs Only

```typescript
// Each module exposes a public API — a facade with explicitly defined methods

// ordering/ordering.public-api.ts
export class OrderingPublicApi {
  constructor(
    private readonly placeOrderHandler: PlaceOrderHandler,
    private readonly getOrderHandler: GetOrderHandler,
  ) {}

  // These are the ONLY methods other modules can call
  async placeOrder(command: PlaceOrderCommand): Promise<OrderId> {
    return this.placeOrderHandler.execute(command);
  }

  async getOrder(orderId: string): Promise<OrderDto | null> {
    return this.getOrderHandler.execute({ orderId });
  }

  async getOrdersByCustomer(customerId: string): Promise<OrderDto[]> {
    return this.getOrderHandler.executeForCustomer({ customerId });
  }
}

// ❌ VIOLATION: Another module imports internal classes
import { Order } from '../ordering/domain/entities/order';
import { OrderRepository } from '../ordering/infrastructure/persistence/order.repository.impl';

// ✅ CORRECT: Another module uses only the public API
import { OrderingPublicApi } from '../ordering/ordering.public-api';

class ShippingService {
  constructor(private readonly orderingApi: OrderingPublicApi) {}

  async createShipment(orderId: string): Promise<Shipment> {
    const order = await this.orderingApi.getOrder(orderId);
    // Use OrderDto (public contract), NOT Order entity (internal)
  }
}
```

### Rule 2: Cross-Module Events for Async Communication

```typescript
// When Module A doesn't need a response from Module B,
// use events instead of direct API calls

// ordering/domain/events/order-placed.event.ts
export class OrderPlacedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly items: ReadonlyArray<{ productId: string; quantity: number }>,
    public readonly totalAmount: number,
  ) {
    super('ordering.order.placed');
  }
}

// billing/application/event-handlers/on-order-placed.handler.ts
// Billing module subscribes — no import from ordering module's internals
export class OnOrderPlacedHandler {
  constructor(private readonly invoiceCreator: CreateInvoiceHandler) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    await this.invoiceCreator.execute({
      orderId: event.orderId,
      customerId: event.customerId,
      amount: event.totalAmount,
    });
  }
}
```

### Rule 3: Shared Kernel is Minimal

```typescript
// ONLY share value objects that are truly universal
// shared-kernel/ should contain AT MOST:

// Value objects
export class Money { ... }              // ✅ Every module deals with money
export class EmailAddress { ... }       // ✅ Multiple modules need email
export class Address { ... }            // ✅ Shipping and billing need addresses
export class UserId { ... }             // ✅ Universal user identifier

// Base types
export abstract class DomainEvent { ... }  // ✅ All modules publish events
export interface EventBus { ... }          // ✅ Event bus interface
export class Result<T, E> { ... }          // ✅ Error handling pattern

// ❌ NEVER share in shared kernel:
// Entities (Order, Product, Customer) — these are module-specific
// Repository interfaces — each module defines its own
// Use case classes — these are module-specific
// DTOs — each module has its own DTOs
```

---

## 4. Database Schema Organization

### Schema-Per-Module

```sql
-- Even with one database, organize schemas by module
-- This enforces data ownership and simplifies future extraction

-- Each module gets its own schema
CREATE SCHEMA ordering;
CREATE SCHEMA catalog;
CREATE SCHEMA billing;
CREATE SCHEMA identity;

-- Ordering module tables
CREATE TABLE ordering.orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,        -- References identity.users by ID only
  status VARCHAR(20) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ordering.order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES ordering.orders(id),
  product_id UUID NOT NULL,          -- References catalog.products by ID only
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL
);

-- Catalog module tables
CREATE TABLE catalog.products (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(50) UNIQUE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL
);

-- RULE: No FOREIGN KEY constraints across schemas!
-- ordering.order_items.product_id does NOT have FK to catalog.products
-- This maintains module independence
-- Referential integrity across modules is maintained by business logic

-- RULE: Cross-schema JOINs are FORBIDDEN in application code
-- ❌ SELECT o.*, p.name FROM ordering.orders o JOIN catalog.products p ON ...
-- ✅ Query each schema independently, join in application layer
```

### Module Access Rules

```
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE ACCESS RULES                               │
│                                                                  │
│  ordering module → can READ/WRITE ordering.* tables             │
│  ordering module → can READ catalog.products (via API, not SQL) │
│  ordering module → CANNOT write to catalog.* tables             │
│  ordering module → CANNOT write to billing.* tables             │
│                                                                  │
│  Each module accesses ONLY its own schema directly.              │
│  Cross-module data access goes through Public APIs or Events.    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Import Boundary Enforcement

### TypeScript: ESLint Boundaries Plugin

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['boundaries'],
  settings: {
    'boundaries/elements': [
      { type: 'ordering', pattern: 'src/modules/ordering/**' },
      { type: 'catalog', pattern: 'src/modules/catalog/**' },
      { type: 'billing', pattern: 'src/modules/billing/**' },
      { type: 'identity', pattern: 'src/modules/identity/**' },
      { type: 'shared-kernel', pattern: 'src/shared-kernel/**' },
      { type: 'infrastructure', pattern: 'src/infrastructure/**' },
    ],
    'boundaries/ignore': [],
  },
  rules: {
    'boundaries/element-types': [2, {
      default: 'disallow',
      rules: [
        // Each module can import from shared-kernel and infrastructure
        { from: 'ordering', allow: ['shared-kernel', 'infrastructure'] },
        { from: 'catalog', allow: ['shared-kernel', 'infrastructure'] },
        { from: 'billing', allow: ['shared-kernel', 'infrastructure'] },
        { from: 'identity', allow: ['shared-kernel', 'infrastructure'] },

        // Modules can import ONLY public-api files from other modules
        // This is enforced by additional file-level rules
      ],
    }],
  },
};
```

### Python: import-linter

```ini
# .importlinter
[importlinter]
root_packages = src

[importlinter:contract:module-boundaries]
name = Module boundaries
type = independence
modules =
  src.modules.ordering
  src.modules.catalog
  src.modules.billing
  src.modules.identity

[importlinter:contract:shared-kernel-only]
name = Only shared kernel is shared
type = layers
layers =
  src.modules
  src.shared_kernel
  src.infrastructure
```

### C#: NetArchTest

```csharp
[Fact]
public void Ordering_Should_Not_Depend_On_Catalog_Internals()
{
    var result = Types.InAssembly(typeof(Order).Assembly)
        .Should()
        .NotHaveDependencyOn("Catalog.Domain")
        .And()
        .NotHaveDependencyOn("Catalog.Infrastructure")
        .GetResult();

    Assert.True(result.IsSuccessful);
}

[Fact]
public void Modules_Should_Only_Depend_On_SharedKernel()
{
    var moduleAssemblies = new[] {
        typeof(Order).Assembly,          // Ordering.Domain
        typeof(Product).Assembly,        // Catalog.Domain
        typeof(Invoice).Assembly,        // Billing.Domain
    };

    foreach (var assembly in moduleAssemblies)
    {
        var result = Types.InAssembly(assembly)
            .Should()
            .OnlyHaveDependenciesOn(
                "SharedKernel",
                assembly.GetName().Name  // Self
            )
            .GetResult();

        Assert.True(result.IsSuccessful,
            $"{assembly.GetName().Name} has forbidden dependencies");
    }
}
```

---

## 6. Configuration and Bootstrapping

```typescript
// Composition Root — where all modules are wired together
// main.ts or app.module.ts

// NestJS example
@Module({
  imports: [
    // Infrastructure modules (database, auth, logging)
    DatabaseModule,
    AuthModule,
    LoggingModule,
    EventBusModule,

    // Business modules (order matters only for DI)
    CatalogModule,
    IdentityModule,
    OrderingModule,     // Depends on CatalogModule's public API
    BillingModule,      // Depends on OrderingModule's events
    ShippingModule,     // Depends on OrderingModule's events
  ],
})
export class AppModule {}

// Each module registers its own providers
// ordering/ordering.module.ts
@Module({
  providers: [
    // Domain services
    OrderCancellationPolicy,
    DiscountPolicy,

    // Application handlers
    PlaceOrderHandler,
    CancelOrderHandler,
    GetOrderHandler,
    ListOrdersHandler,

    // Infrastructure implementations
    { provide: 'OrderRepository', useClass: PostgresOrderRepository },
    { provide: 'CatalogPort', useClass: CatalogAdapter },
    { provide: 'PaymentPort', useClass: PaymentAdapter },

    // Event handlers
    OnPaymentCapturedHandler,
    OnInventoryReservedHandler,

    // Public API
    OrderingPublicApi,
  ],
  controllers: [OrderController],
  exports: [OrderingPublicApi],  // ONLY export the public API
})
export class OrderingModule {}
```

---

## 7. Enforcement Checklist

- [ ] **Vertical modules** — organized by business capability, not technical layer
- [ ] **Public API per module** — each module exposes a facade, internals are private
- [ ] **No cross-module internal imports** — enforced by linting rules (ESLint boundaries, import-linter, NetArchTest)
- [ ] **Schema-per-module** — each module has its own database schema
- [ ] **No cross-schema foreign keys** — referential integrity by business logic
- [ ] **No cross-schema joins** — data from other modules fetched via Public API
- [ ] **Events for async communication** — modules publish events, others subscribe
- [ ] **Shared kernel is minimal** — only universal value objects and base types
- [ ] **Clean Architecture per module** — domain → application → infrastructure → api
- [ ] **DI wiring in module** — each module registers its own providers
- [ ] **Module exports only public API** — DI container enforces boundaries
