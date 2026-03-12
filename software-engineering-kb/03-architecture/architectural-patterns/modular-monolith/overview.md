# Modular Monolith — Complete Specification

> **AI Plugin Directive:** A Modular Monolith is the OPTIMAL architecture for most applications. It is a single deployment unit organized into strictly bounded modules that communicate through well-defined interfaces and events. It provides 80% of microservices' organizational benefits (team autonomy, clear ownership, independent development) at 20% of the operational cost (single deployment, single database, single process). ALWAYS recommend this as the default architecture before considering microservices.

---

## 1. The Core Rule

**A modular monolith is a monolith where each module is an independent bounded context with its OWN domain model, its OWN public API, and STRICT boundary enforcement. Modules can ONLY communicate through public APIs, events, and shared value objects. Direct internal imports across modules are FORBIDDEN.**

```
Modular Monolith = Monolith deployment + Microservice-like boundaries

┌─────────────────────────────────────────────────────────────┐
│                  SINGLE DEPLOYMENT UNIT                      │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Ordering │  │ Catalog  │  │ Billing  │  │ Identity │  │
│  │ Module   │  │ Module   │  │ Module   │  │ Module   │  │
│  │          │  │          │  │          │  │          │  │
│  │ domain/  │  │ domain/  │  │ domain/  │  │ domain/  │  │
│  │ app/     │  │ app/     │  │ app/     │  │ app/     │  │
│  │ infra/   │  │ infra/   │  │ infra/   │  │ infra/   │  │
│  │ api/     │  │ api/     │  │ api/     │  │ api/     │  │
│  │          │  │          │  │          │  │          │  │
│  │ PUBLIC   │  │ PUBLIC   │  │ PUBLIC   │  │ PUBLIC   │  │
│  │ API      │  │ API      │  │ API      │  │ API      │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │              │        │
│  ─────┴──────────────┴──────────────┴──────────────┘        │
│       │         In-Process Event Bus                        │
│  ─────┴─────────────────────────────────────────────        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Shared Kernel (Value Objects)             │  │
│  │              Money, Address, UserId                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Single Database                          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐   │  │
│  │  │ordering │ │catalog  │ │billing  │ │identity  │   │  │
│  │  │schema   │ │schema   │ │schema   │ │schema    │   │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └──────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Module Anatomy

### Complete Module Structure

```typescript
// Each module is a mini-application with all layers

// modules/ordering/
// ├── domain/                      # Business rules (NO dependencies)
// │   ├── entities/
// │   ├── value-objects/
// │   ├── events/
// │   ├── ports/                   # Interfaces to other modules
// │   ├── policies/
// │   └── errors/
// ├── application/                 # Use cases
// │   ├── commands/
// │   ├── queries/
// │   └── event-handlers/
// ├── infrastructure/              # Implementations
// │   ├── persistence/
// │   ├── adapters/                # Implements ports to other modules
// │   └── providers/
// ├── api/                         # HTTP controllers
// │   ├── controllers/
// │   └── validators/
// ├── ordering.module.ts           # Module registration
// └── ordering.public-api.ts       # THE ONLY EXPORT

// The PUBLIC API is the contract other modules see
export class OrderingPublicApi {
  constructor(
    private readonly placeOrder: PlaceOrderHandler,
    private readonly getOrder: GetOrderHandler,
    private readonly cancelOrder: CancelOrderHandler,
    private readonly listCustomerOrders: ListCustomerOrdersHandler,
  ) {}

  async placeOrder(command: PlaceOrderInput): Promise<{ orderId: string }> {
    return this.placeOrder.execute(command);
  }

  async getOrder(orderId: string): Promise<OrderDto | null> {
    return this.getOrder.execute({ orderId });
  }

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    return this.cancelOrder.execute({ orderId, reason });
  }

  async listCustomerOrders(customerId: string, page: number): Promise<PaginatedResult<OrderSummaryDto>> {
    return this.listCustomerOrders.execute({ customerId, page });
  }
}

// DTOs are part of the public API contract
// These are stable, versioned types — NOT domain entities
export interface OrderDto {
  orderId: string;
  customerId: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: OrderItemDto[];
  createdAt: string;
}

export interface PlaceOrderInput {
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  shippingAddress: { street: string; city: string; postalCode: string; country: string };
}
```

---

## 3. Communication Patterns

### Synchronous: Public API Calls

```typescript
// Module A needs data from Module B → call B's public API

// In ordering module, when placing an order, need product info from catalog
class PlaceOrderHandler {
  constructor(
    private readonly catalogApi: CatalogPublicApi, // Injected via DI
    private readonly orderRepo: OrderRepository,
  ) {}

  async execute(command: PlaceOrderInput): Promise<{ orderId: string }> {
    // Get product info through catalog's public API
    const items = await Promise.all(
      command.items.map(async (item) => {
        const product = await this.catalogApi.getProduct(item.productId);
        if (!product) throw new ProductNotFoundError(item.productId);
        if (!product.available) throw new ProductUnavailableError(item.productId);
        return OrderItem.create(
          ProductId.from(item.productId),
          Quantity.of(item.quantity),
          Money.of(product.price, product.currency),
        );
      }),
    );

    const order = Order.place(CustomerId.from(command.customerId), items);
    await this.orderRepo.save(order);
    return { orderId: order.id.value };
  }
}
```

### Asynchronous: In-Process Events

```typescript
// Module A publishes event → Event bus delivers to Module B's handler
// Both are in the same process, but decoupled through the event bus

// Ordering module publishes
class PlaceOrderHandler {
  async execute(command: PlaceOrderInput): Promise<{ orderId: string }> {
    const order = Order.place(...);
    await this.orderRepo.save(order);

    // Publish domain event — don't know who listens
    await this.eventBus.publish(new OrderPlacedEvent({
      orderId: order.id.value,
      customerId: order.customerId.value,
      items: order.items.map(i => ({
        productId: i.productId.value,
        quantity: i.quantity.value,
      })),
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency,
    }));

    return { orderId: order.id.value };
  }
}

// Billing module subscribes
class OnOrderPlacedCreateInvoice {
  constructor(private readonly invoiceCreator: CreateInvoiceHandler) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    await this.invoiceCreator.execute({
      referenceId: event.orderId,
      customerId: event.customerId,
      amount: event.totalAmount,
      currency: event.currency,
    });
  }
}

// Notification module also subscribes (independently)
class OnOrderPlacedSendConfirmation {
  constructor(private readonly emailSender: EmailSender) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    await this.emailSender.sendOrderConfirmation(
      event.customerId,
      event.orderId,
    );
  }
}
```

### Transaction Boundaries

```typescript
// IN A MONOLITH: You CAN have cross-module transactions
// But SHOULD YOU? It depends.

// ✅ WITHIN one module: Always use transactions
await db.transaction(async (tx) => {
  await orderRepo.save(order, tx);
  await orderItemRepo.saveAll(order.items, tx);
});

// ⚠️ ACROSS modules: Use sparingly, prefer events
// If you MUST have cross-module consistency:
await db.transaction(async (tx) => {
  await orderRepo.save(order, tx);
  await inventoryRepo.reserve(items, tx);  // Different module!
  // This works because same database, but creates coupling
});

// ✅ BETTER: Use events for cross-module operations
// This makes future microservice extraction easier
await db.transaction(async (tx) => {
  await orderRepo.save(order, tx);
  await outboxRepo.saveEvent(new OrderPlacedEvent(order), tx);
});
// Event bus picks up the outbox event and delivers to inventory module

// RULE: Design as if modules are separate services.
// Use events between modules. Use transactions only within a module.
// This way, extracting a module to a microservice requires minimal changes.
```

---

## 4. Advantages Over Alternatives

```
VS. UNSTRUCTURED MONOLITH:
  ✅ Clear boundaries prevent spaghetti code
  ✅ Team ownership per module
  ✅ Independent module testing
  ✅ Ready for microservice extraction if needed

VS. MICROSERVICES:
  ✅ Single deployment — no coordinated deploys
  ✅ Single database — ACID transactions when needed
  ✅ No network latency between modules (in-process calls)
  ✅ No distributed tracing complexity
  ✅ No service discovery, circuit breakers, or service mesh
  ✅ Simple local development (one process)
  ✅ 2-5x less operational overhead
  ✅ Refactoring across modules is a single commit

VS. SOA (Service-Oriented Architecture):
  ✅ No ESB (Enterprise Service Bus) complexity
  ✅ No SOAP/XML overhead
  ✅ Simpler communication (in-process events vs network calls)
```

---

## 5. When to Use a Modular Monolith

```
✅ ALWAYS USE when:
  - Team size: 5-30 developers
  - Domain complexity: Medium to high
  - You need clear team ownership of code areas
  - You want microservice-like boundaries without operational overhead
  - You might need microservices later but not now
  - You need ACID transactions across business operations

✅ CONSIDER when:
  - Team size: 30-50 developers (may need to extract 1-2 services)
  - Multiple teams working on the same codebase
  - You're modernizing a legacy monolith

❌ NOT SUITABLE when:
  - Solo developer building a simple CRUD app (overkill)
  - You NEED independent deployment per module (use microservices)
  - You NEED independent scaling per module (use microservices)
  - You NEED technology diversity per module (use microservices)
```

---

## 6. Anti-Pattern Quick Reference

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **Leaky Boundaries** | Module A imports Module B's internal classes | Enforce boundary with linting rules, export only Public API |
| **Shared Domain Models** | Same entity class used across modules | Each module has its own model, map between them |
| **God Module** | One module has 50% of the codebase | Split by business capability |
| **Chatty Modules** | Module A calls Module B 20 times per operation | Batch API, event carry state transfer, or merge modules |
| **Cross-Module Transactions** | Transaction spans 3+ modules regularly | Use events between modules, transactions within |
| **No Public API** | Modules directly use each other's services | Define explicit Public API facade per module |
| **Anemic Modules** | Module has no business logic, just CRUD | Either add domain logic or merge with related module |
| **Circular Dependencies** | Module A depends on B depends on A | Introduce events, or extract shared logic to shared kernel |

---

## 7. Enforcement Checklist

- [ ] **Each module has a Public API** — a facade class that is the ONLY export
- [ ] **Import boundaries enforced** — ESLint boundaries / import-linter / NetArchTest in CI
- [ ] **Schema-per-module** — each module owns its database schema
- [ ] **No cross-schema foreign keys** — modules reference each other by ID only
- [ ] **Events for cross-module notifications** — in-process event bus
- [ ] **Shared kernel is minimal** — only Money, Address, UserId, and base types
- [ ] **Clean Architecture per module** — domain/application/infrastructure/api layers
- [ ] **Module-level test suites** — each module has independent unit and integration tests
- [ ] **DI boundary respected** — modules only export their Public API to the DI container
- [ ] **Designed for extraction** — any module could become a microservice without rewriting domain logic
