# Domain-Driven Design: Bounded Contexts — Complete Specification

> **AI Plugin Directive:** A Bounded Context defines the boundary within which a domain model is consistent and meaningful. EVERY large system MUST be divided into bounded contexts. One model for the entire system is an anti-pattern that leads to the "big ball of mud."

---

## 1. The Core Rule

**Each Bounded Context has its OWN domain model, its OWN ubiquitous language, and its OWN data storage. The same real-world concept (e.g., "Customer") has DIFFERENT representations in different contexts.**

---

## 2. How to Identify Bounded Context Boundaries

### Signals That You Need Separate Contexts

| Signal | Example | Action |
|--------|---------|--------|
| **Same word, different meaning** | "Product" means different things to Sales vs Warehouse | Separate contexts |
| **Different rates of change** | Pricing changes daily, catalog changes monthly | Separate contexts |
| **Different teams** | Team A owns orders, Team B owns shipping | Separate contexts |
| **Different data needs** | Sales needs customer credit history, Shipping needs delivery address only | Separate contexts |
| **Different business rules** | Returns policy is completely different from ordering rules | Separate contexts |
| **Different scalability needs** | Search needs high read throughput, ordering needs consistency | Separate contexts |

### Boundary Identification Process

```
Step 1: List all business capabilities
  → Ordering, Pricing, Inventory, Shipping, Returns, Billing, Search, Analytics

Step 2: For each capability, list the key nouns (entities)
  → Ordering: Order, OrderItem, Customer, Product
  → Shipping: Shipment, Package, Carrier, Recipient, TrackingNumber

Step 3: Look for overlapping nouns with different meanings
  → "Customer" in Ordering = person who places orders (credit limit, order history)
  → "Customer" in Shipping = recipient (delivery address, contact phone)
  → These are DIFFERENT models → separate contexts

Step 4: Define context boundaries
  → Each capability with its own model becomes a bounded context

Step 5: Map relationships between contexts
  → How does Ordering tell Shipping about a new order? (Events)
  → How does Ordering get product info? (API call with ACL)
```

---

## 3. Context Implementation Patterns

### Monolith with Bounded Contexts (Module-Based)

```typescript
// Even in a monolith, maintain strict boundaries between contexts

src/
├── contexts/                          # Each context is a self-contained module
│   ├── ordering/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── order.ts          # Order as seen by ordering context
│   │   │   │   └── customer.ts       # Customer as seen by ordering context
│   │   │   ├── ports/
│   │   │   │   ├── order.repository.ts
│   │   │   │   └── product-catalog.ts  # Port to communicate with catalog context
│   │   │   └── events/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── ordering.module.ts
│   ├── shipping/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── shipment.ts       # Shipment entity (doesn't exist in ordering)
│   │   │   │   └── recipient.ts      # Recipient (NOT Customer — different model)
│   │   │   ├── ports/
│   │   │   └── events/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── shipping.module.ts
│   ├── billing/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── invoice.ts
│   │   │   │   └── account-holder.ts  # AccountHolder (NOT Customer)
│   │   │   └── ...
│   │   └── billing.module.ts
│   └── catalog/
│       └── catalog.module.ts
└── shared-kernel/                     # ONLY value objects shared across contexts
    ├── money.ts
    ├── address.ts
    └── user-id.ts
```

### Enforcement Rules for Monolith Contexts

```typescript
// Rule: Contexts communicate ONLY through:
// 1. Domain events (async)
// 2. Port interfaces (sync)
// 3. Shared kernel (value objects only)

// ❌ VIOLATION: Direct import across context boundaries
// ordering/application/use-cases/create-order.ts
import { ShipmentService } from '../../../shipping/application/services/shipment.service';
// ❌ This creates coupling between contexts!

// ✅ CORRECT: Use events for cross-context communication
// ordering/domain/events/order-confirmed.event.ts
class OrderConfirmedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly items: Array<{ productId: string; quantity: number }>,
    public readonly shippingAddress: AddressData,
  ) { super('ordering.order.confirmed'); }
}

// shipping/infrastructure/event-handlers/on-order-confirmed.ts
class OnOrderConfirmedHandler {
  constructor(private readonly createShipment: CreateShipmentHandler) {}

  async handle(event: OrderConfirmedEvent): Promise<void> {
    await this.createShipment.execute({
      referenceId: event.orderId,
      parcels: event.items,
      recipient: Address.create(event.shippingAddress),
    });
  }
}

// ✅ CORRECT: Use port interface for sync queries across contexts
// ordering/domain/ports/product-catalog.ts (defined in ordering context)
interface ProductCatalog {
  getProduct(productId: ProductId): Promise<ProductInfo>;
  checkAvailability(productId: ProductId, quantity: Quantity): Promise<boolean>;
}

// ordering/infrastructure/adapters/catalog-context-adapter.ts
class CatalogContextAdapter implements ProductCatalog {
  constructor(private readonly catalogQueryService: CatalogQueryService) {}

  async getProduct(productId: ProductId): Promise<ProductInfo> {
    const product = await this.catalogQueryService.findById(productId.value);
    // Map catalog's model to ordering's ProductInfo
    return ProductInfo.create(
      productId,
      product.name,
      Money.of(product.price, product.currency),
    );
  }
}
```

### Microservices with Bounded Contexts

```
┌──────────────────┐    events    ┌──────────────────┐
│ ORDERING SERVICE │─────────────►│ SHIPPING SERVICE │
│ (Port: 3001)     │              │ (Port: 3002)     │
│                  │              │                  │
│ Own DB: orders   │              │ Own DB: shipments│
│ PostgreSQL       │              │ PostgreSQL       │
└──────────────────┘              └──────────────────┘
         │                                 │
    events│                           events│
         ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐
│ BILLING SERVICE  │              │ NOTIFICATION SVC │
│ (Port: 3003)     │              │ (Port: 3004)     │
│                  │              │                  │
│ Own DB: invoices │              │ Own DB: templates│
│ PostgreSQL       │              │ MongoDB          │
└──────────────────┘              └──────────────────┘
```

**Rule: Each microservice = one bounded context = own database. NEVER share databases between services.**

---

## 4. Communication Between Contexts

### Async Communication (Events) — Preferred

```typescript
// Rule: Use events for eventual consistency between contexts
// The publishing context doesn't wait for or care about who handles the event

// Publishing context (Ordering)
class SubmitOrderHandler {
  async execute(input: SubmitOrderInput): Promise<SubmitOrderOutput> {
    const order = await this.orderRepo.findById(OrderId.from(input.orderId));
    order.submit();
    await this.orderRepo.save(order);

    // Publish events — don't know or care who listens
    await this.eventBus.publishAll(order.domainEvents);

    return { orderId: order.id.value, status: 'submitted' };
  }
}

// Event structure for cross-context communication
// Use a standard envelope format
interface IntegrationEvent {
  id: string;              // Unique event ID
  type: string;            // Event type (e.g., 'ordering.order.submitted')
  source: string;          // Source context
  timestamp: string;       // ISO 8601
  version: string;         // Schema version (e.g., '1.0')
  correlationId: string;   // For tracing
  payload: unknown;        // Event-specific data
}

// Example integration event
const event: IntegrationEvent = {
  id: 'evt-123-456',
  type: 'ordering.order.submitted',
  source: 'ordering-context',
  timestamp: '2024-01-15T10:30:00Z',
  version: '1.0',
  correlationId: 'req-789',
  payload: {
    orderId: 'ord-001',
    customerId: 'cust-123',
    items: [{ productId: 'prod-456', quantity: 2, unitPrice: 29.99 }],
    totalAmount: 59.98,
    currency: 'USD',
    shippingAddress: { street: '123 Main St', city: 'NYC', postalCode: '10001', country: 'US' },
  },
};
```

### Sync Communication (API) — When Needed

```typescript
// Use sync calls ONLY when you need immediate response
// ALWAYS protect your domain with Anti-Corruption Layer

// ordering/domain/ports — defines what ordering needs
interface PricingService {
  calculatePrice(productId: ProductId, quantity: Quantity, customer: CustomerId): Promise<Price>;
}

// ordering/infrastructure/adapters — calls pricing context's API
class HttpPricingAdapter implements PricingService {
  constructor(private readonly http: HttpClient) {}

  async calculatePrice(
    productId: ProductId,
    quantity: Quantity,
    customer: CustomerId
  ): Promise<Price> {
    try {
      const response = await this.http.post<PricingApiResponse>('/api/pricing/calculate', {
        productId: productId.value,
        quantity: quantity.value,
        customerId: customer.value,
      });

      // ACL: translate pricing context's response to ordering's domain model
      return Price.create(
        Money.of(response.unitPrice, response.currency),
        Money.of(response.totalPrice, response.currency),
        response.discount ? Discount.percentage(response.discount.percent) : Discount.none(),
      );
    } catch (error) {
      // Fallback strategy when pricing service is unavailable
      throw new PricingUnavailableError(productId);
    }
  }
}
```

---

## 5. Data Ownership Rules

### Each Context Owns Its Data

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA OWNERSHIP RULES                       │
│                                                              │
│  ✅ CORRECT:                                                 │
│  Ordering Context → orders DB (OrderId, CustomerId, Items)   │
│  Shipping Context → shipments DB (ShipmentId, TrackingNo)    │
│  Billing Context  → invoices DB (InvoiceId, Amount)          │
│                                                              │
│  ❌ WRONG:                                                   │
│  Shared DB with tables: orders, shipments, invoices          │
│  (Multiple contexts reading/writing the same tables)         │
│                                                              │
│  ⚠️ WHEN ANOTHER CONTEXT NEEDS DATA:                         │
│  1. Subscribe to events (eventual consistency)               │
│  2. API call with ACL (synchronous)                          │
│  3. Keep a LOCAL READ MODEL (denormalized copy)              │
└─────────────────────────────────────────────────────────────┘
```

### Local Read Model Pattern

```typescript
// Shipping context needs to show order details, but it doesn't OWN order data
// Solution: Maintain a local read model updated by events

// shipping/domain/read-models/order-summary.ts
class OrderSummary {
  constructor(
    public readonly orderId: string,
    public readonly customerName: string,
    public readonly itemCount: number,
    public readonly totalAmount: number,
    public readonly currency: string,
  ) {}
}

// shipping/infrastructure/event-handlers/order-sync.handler.ts
class OrderSyncHandler {
  constructor(private readonly readModelRepo: OrderSummaryRepository) {}

  // Listen to ordering context's events to maintain local read model
  async onOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    await this.readModelRepo.save(new OrderSummary(
      event.orderId,
      event.customerName,
      event.items.length,
      event.totalAmount,
      event.currency,
    ));
  }

  async onOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    await this.readModelRepo.delete(event.orderId);
  }
}

// Now shipping context queries its OWN read model — no cross-context DB queries
```

---

## 6. Bounded Context Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **God Context** | One massive context with everything | Split into multiple contexts based on business capabilities |
| **Shared Database** | Multiple contexts read/write same tables | Each context gets its own DB, use events to sync |
| **Cross-Context Entity** | Same entity class imported in multiple contexts | Create context-specific models, map between them |
| **Chatty Communication** | 10+ API calls between contexts for one operation | Redesign boundaries, use events, or merge contexts |
| **Distributed Monolith** | Services that can't deploy independently | Each context must be independently deployable |
| **Missing ACL** | Directly using external system's types in domain | Add Anti-Corruption Layer for translation |
| **Anemic Context** | Context with no business logic, just CRUD | Either merge with another context or add proper domain logic |

---

## 7. Decision Guide: How Many Bounded Contexts?

```
Team size < 5 developers?
├── YES → 1-2 contexts in a modular monolith
└── NO → Continue ↓

Distinct business capabilities > 3?
├── YES → One context per business capability
└── NO → 1-2 contexts may suffice

Need independent deployment?
├── YES → Separate services per context
└── NO → Modular monolith with context boundaries

Domain experts use different vocabulary for different areas?
├── YES → Those areas are separate contexts
└── NO → May be one context

Different teams own different areas?
├── YES → One context per team (Conway's Law)
└── NO → Context per business capability
```

---

## 8. Context Mapping Implementation Checklist

- [ ] **Draw context map** showing all bounded contexts
- [ ] **Label relationships** (Partnership, Customer-Supplier, Conformist, ACL, Shared Kernel)
- [ ] **Define integration events** with explicit schemas and versioning
- [ ] **Build ACL** for every external system or legacy integration
- [ ] **Keep shared kernel minimal** — only value objects
- [ ] **Enforce import boundaries** — no direct imports across contexts
- [ ] **Own data separately** — each context has its own database/schema
- [ ] **Test integration** — contract tests between contexts
- [ ] **Document the map** — keep context map up-to-date as the system evolves
