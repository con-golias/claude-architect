# Microservices: Service Boundaries — Complete Specification

> **AI Plugin Directive:** Service boundaries determine the success or failure of a microservices architecture. Draw them WRONG and you get a distributed monolith that is worse than the monolith you started with. Service boundaries MUST align with business capabilities and bounded contexts, NEVER with technical layers or data entities.

---

## 1. The Core Rule

**A service boundary = a bounded context = one business capability = one team. If you cannot describe what a service does in one sentence without using "and," the boundary is wrong.**

```
❌ WRONG BOUNDARIES: By technical layer
  - DatabaseService (manages all databases)
  - ApiService (all REST endpoints)
  - AuthService + UserService + ProfileService (same capability split three ways)

❌ WRONG BOUNDARIES: By data entity
  - CustomerService (CRUD for customer table)
  - AddressService (CRUD for address table)
  - PhoneService (CRUD for phone table)

✅ CORRECT BOUNDARIES: By business capability
  - IdentityService: "Manages authentication, authorization, and user profiles"
  - OrderingService: "Handles the order lifecycle from cart to confirmation"
  - FulfillmentService: "Manages picking, packing, and shipping of orders"
  - BillingService: "Processes payments, invoices, and refunds"
  - CatalogService: "Manages product listings, search, and categories"
```

---

## 2. Boundary Identification Techniques

### Technique 1: Business Capability Mapping

```
Step 1: List ALL business capabilities (what the business DOES)
  ┌────────────────────────────────────────────────────────┐
  │ E-Commerce Business Capabilities                       │
  ├────────────────────────────────────────────────────────┤
  │ 1. Product Management (create, categorize, price)      │
  │ 2. Inventory Management (stock levels, replenishment)  │
  │ 3. Customer Management (registration, profiles)        │
  │ 4. Order Processing (cart, checkout, confirmation)     │
  │ 5. Payment Processing (charge, refund, dispute)        │
  │ 6. Fulfillment (pick, pack, ship)                      │
  │ 7. Delivery Tracking (shipment status, ETA)            │
  │ 8. Returns & Refunds (authorize, receive, credit)      │
  │ 9. Customer Support (tickets, chat, knowledge base)    │
  │ 10. Marketing (promotions, emails, recommendations)    │
  │ 11. Analytics (sales reports, customer insights)       │
  │ 12. Search (product search, filtering, ranking)        │
  └────────────────────────────────────────────────────────┘

Step 2: Group by cohesion (what changes together, stays together)
  Catalog Context: Product Management + Search
  Inventory Context: Inventory Management
  Customer Context: Customer Management
  Ordering Context: Order Processing
  Payment Context: Payment Processing
  Fulfillment Context: Fulfillment + Delivery Tracking
  Returns Context: Returns & Refunds
  Engagement Context: Customer Support + Marketing
  Analytics Context: Analytics (read-only, event-sourced)

Step 3: Validate each group is independently deployable
  Can Catalog change without affecting Ordering? → YES ✅
  Can Payment change without affecting Fulfillment? → YES ✅
  Can Inventory change without affecting Catalog? → YES ✅
```

### Technique 2: Event Storming

```
Run an Event Storming workshop to discover boundaries naturally:

1. Place orange stickies (domain events) on a timeline
   → OrderPlaced, PaymentCaptured, InventoryReserved, ShipmentCreated,
     ShipmentDelivered, ReturnRequested, RefundIssued

2. Group events by aggregate (yellow stickies)
   → Order aggregate: OrderPlaced, OrderConfirmed, OrderCancelled
   → Payment aggregate: PaymentCaptured, PaymentFailed, RefundIssued
   → Shipment aggregate: ShipmentCreated, ShipmentDelivered

3. Draw boundaries around clusters of related aggregates
   → Ordering Context: {Order, OrderItem, Cart}
   → Payment Context: {Payment, Refund, PaymentMethod}
   → Fulfillment Context: {Shipment, Package, Carrier}

4. Identify pivot events (events that cross boundaries)
   → OrderConfirmed triggers PaymentCapture (ordering → payment)
   → PaymentCaptured triggers ShipmentCreation (payment → fulfillment)
   → These are integration events between services
```

### Technique 3: Data Ownership Analysis

```
For each piece of data, ask: "Who is the single source of truth?"

Customer Email:
  - Source of truth: Identity Service
  - Other services may cache it, but NEVER modify it

Product Price:
  - Source of truth: Catalog Service
  - Ordering Service reads it at time of order (snapshot)
  - Analytics Service receives price change events

Order Status:
  - Source of truth: Ordering Service
  - Fulfillment Service has its OWN shipment status
  - The UI aggregates both to show customer the full picture

RULE: If two services need to WRITE the same data → wrong boundary
RULE: If two services always need the same data → maybe merge them
RULE: If a service only reads data from another → cache + events
```

---

## 3. Boundary Validation Rules

### The Seven Tests for Good Service Boundaries

```
TEST 1: Single Responsibility
  "Can I describe this service in one sentence without 'and'?"
  ❌ "Manages orders AND payments AND shipping"
  ✅ "Manages the order lifecycle from placement to confirmation"

TEST 2: Independent Deployment
  "Can I deploy this service without coordinating with other teams?"
  ❌ "We need to deploy OrderService with PaymentService"
  ✅ "OrderService deploys independently on its own schedule"

TEST 3: Own Data
  "Does this service own ALL data it writes to?"
  ❌ "OrderService writes to the shared customer table"
  ✅ "OrderService has its own orders database"

TEST 4: Minimal Communication
  "Does this service make fewer than 3 sync calls to complete its primary operation?"
  ❌ "PlaceOrder calls Catalog, Inventory, Pricing, Tax, Shipping, and Payment"
  ✅ "PlaceOrder reads from local cache, publishes OrderPlaced event"

TEST 5: Team Ownership
  "Can one team own and operate this service?"
  ❌ "Three teams need to modify this service regularly"
  ✅ "The ordering team owns this completely"

TEST 6: Business Alignment
  "Does this service map to a recognizable business function?"
  ❌ "DataTransformationService" (technical, not business)
  ✅ "PricingService" (business stakeholders understand it)

TEST 7: Failure Independence
  "If this service goes down, can other services still function?"
  ❌ "If AuthService is down, nothing works"
  ✅ "If CatalogService is down, ordering uses cached product data"
```

---

## 4. Common Boundary Patterns

### Pattern 1: Decompose by Business Capability

```
E-commerce:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Catalog    │ │   Ordering   │ │   Payment    │ │ Fulfillment  │
│              │ │              │ │              │ │              │
│ - Products   │ │ - Cart       │ │ - Charges    │ │ - Shipments  │
│ - Categories │ │ - Orders     │ │ - Refunds    │ │ - Tracking   │
│ - Search     │ │ - LineItems  │ │ - Disputes   │ │ - Carriers   │
│ - Pricing    │ │ - Discounts  │ │ - Wallets    │ │ - Labels     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Pattern 2: Decompose by Subdomain (DDD)

```
Core Subdomains (competitive advantage — build custom):
  - Ordering, Pricing Engine, Recommendation Engine

Supporting Subdomains (necessary but not differentiating — buy or build simple):
  - Inventory Management, Customer Profiles, Notification

Generic Subdomains (commodity — buy off-the-shelf):
  - Authentication (Auth0/Cognito), Payment Processing (Stripe),
    Email Delivery (SendGrid), Search (Elasticsearch/Algolia)
```

### Pattern 3: Strangler Fig (Migration from Monolith)

```
Phase 1: Identify the bounded context to extract
  Monolith has: Users, Orders, Payments, Shipping, Notifications
  Extract first: Notifications (least coupled, low risk)

Phase 2: Create new service alongside monolith
  ┌──────────────────┐    ┌─────────────────┐
  │    Monolith       │    │ Notification    │
  │    (everything)   │───►│ Service (new)   │
  │                   │    │                 │
  └──────────────────┘    └─────────────────┘

Phase 3: Route traffic to new service
  ┌──────────────────┐    ┌─────────────────┐
  │    API Gateway    │───►│ Notification    │  ← /api/notifications
  │                   │    │ Service         │
  │                   │    └─────────────────┘
  │                   │    ┌─────────────────┐
  │                   │───►│ Monolith        │  ← everything else
  └──────────────────┘    └─────────────────┘

Phase 4: Remove notification code from monolith
  Repeat for next bounded context (e.g., Payments)

RULES:
  - Extract ONE service at a time
  - Start with the LEAST coupled component
  - Keep both running in parallel until migration is verified
  - NEVER do a big-bang rewrite
```

---

## 5. Entity Ownership Across Services

### The Same Real-World Thing Has Different Models

```typescript
// The concept "Customer" exists in multiple services but means different things

// Identity Service: Customer = authenticated user
interface IdentityUser {
  userId: string;
  email: string;
  passwordHash: string;
  mfaEnabled: boolean;
  roles: string[];
  lastLoginAt: Date;
}

// Ordering Service: Customer = person who places orders
interface OrderingCustomer {
  customerId: string;       // Same ID as userId
  name: string;
  defaultShippingAddress: Address;
  loyaltyTier: 'bronze' | 'silver' | 'gold';
  orderCount: number;       // Denormalized from order history
}

// Billing Service: Customer = account holder
interface BillingAccount {
  accountId: string;        // Same ID as userId
  billingAddress: Address;
  paymentMethods: PaymentMethod[];
  creditLimit: Money;
  outstandingBalance: Money;
}

// Fulfillment Service: Customer = recipient
interface Recipient {
  recipientId: string;      // Same ID as userId
  name: string;
  deliveryAddress: Address;
  deliveryInstructions: string;
  contactPhone: string;
}

// RULE: Each service stores ONLY the customer attributes it needs.
// RULE: Services sync relevant attributes via domain events.
// RULE: The Identity Service is the source of truth for userId and email.
```

### Cross-Service References

```typescript
// RULE: Services reference entities in other services by ID only.
// NEVER embed full objects from another service.

// ✅ CORRECT: Reference by ID
class Order {
  orderId: OrderId;
  customerId: CustomerId;    // Just the ID, not the full Customer object
  items: OrderItem[];
}

// When you need customer details, either:
// 1. Query the customer service (sync, with cache)
// 2. Maintain a local read model (async, via events)

// ❌ WRONG: Embed full customer object
class Order {
  orderId: OrderId;
  customer: {               // Full customer data embedded
    name: string;           // What if the name changes?
    email: string;          // Now order has stale email
    address: Address;       // Whose source of truth is this?
  };
  items: OrderItem[];
}
```

---

## 6. Shared Data Strategies

### Strategy 1: Event-Carried State Transfer

```typescript
// When Service A needs data from Service B:
// Service B publishes events containing the data Service A needs
// Service A builds a local cache from those events

// Catalog Service publishes product changes
await eventBus.publish({
  type: 'catalog.product.price-changed',
  payload: {
    productId: 'prod-123',
    oldPrice: { amount: 29.99, currency: 'USD' },
    newPrice: { amount: 24.99, currency: 'USD' },
    effectiveFrom: '2024-01-15T00:00:00Z',
  },
});

// Ordering Service maintains local product cache
class ProductCacheUpdater {
  async onProductPriceChanged(event: ProductPriceChangedEvent): Promise<void> {
    await this.productCache.update(event.payload.productId, {
      price: event.payload.newPrice,
      lastUpdated: event.payload.effectiveFrom,
    });
  }
}

// Ordering Service reads from its local cache — no network call needed
class OrderingService {
  async getProductPrice(productId: string): Promise<Money> {
    const cached = await this.productCache.get(productId);
    if (!cached) {
      // Fallback: fetch from catalog (sync, with circuit breaker)
      return this.catalogClient.getPrice(productId);
    }
    return Money.of(cached.price.amount, cached.price.currency);
  }
}
```

### Strategy 2: API Composition

```typescript
// When a UI needs data from multiple services,
// use a BFF (Backend for Frontend) or API Gateway to aggregate

// BFF endpoint that composes data from multiple services
class OrderDetailsComposer {
  async getOrderDetails(orderId: string): Promise<OrderDetailsView> {
    const [order, payment, shipment] = await Promise.all([
      this.orderingClient.getOrder(orderId),
      this.billingClient.getPaymentForOrder(orderId),
      this.fulfillmentClient.getShipmentForOrder(orderId),
    ]);

    return {
      orderId: order.id,
      status: order.status,
      items: order.items,
      payment: payment ? {
        status: payment.status,
        method: payment.method,
        amount: payment.amount,
      } : null,
      shipment: shipment ? {
        status: shipment.status,
        trackingNumber: shipment.trackingNumber,
        estimatedDelivery: shipment.estimatedDelivery,
      } : null,
    };
  }
}
```

### Strategy 3: CQRS with Materialized View

```typescript
// For complex queries spanning multiple services:
// Build a dedicated read model from events

// Query Service (read-only, event-sourced)
class OrderDashboardProjection {
  // Listens to events from ordering, payment, and fulfillment
  async onOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    await this.dashboardStore.upsert(event.payload.orderId, {
      orderId: event.payload.orderId,
      customerId: event.payload.customerId,
      totalAmount: event.payload.totalAmount,
      orderStatus: 'placed',
      paymentStatus: 'pending',
      shipmentStatus: 'pending',
      placedAt: event.metadata.timestamp,
    });
  }

  async onPaymentCaptured(event: PaymentCapturedEvent): Promise<void> {
    await this.dashboardStore.update(event.payload.orderId, {
      paymentStatus: 'captured',
      paymentMethod: event.payload.method,
      paidAt: event.metadata.timestamp,
    });
  }

  async onShipmentCreated(event: ShipmentCreatedEvent): Promise<void> {
    await this.dashboardStore.update(event.payload.orderId, {
      shipmentStatus: 'shipped',
      trackingNumber: event.payload.trackingNumber,
      carrier: event.payload.carrier,
      shippedAt: event.metadata.timestamp,
    });
  }
}

// Now the dashboard query is a simple read from ONE store
// No joins across services needed
```

---

## 7. Anti-Patterns in Service Boundaries

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **Entity Service** | Service per database table (CustomerService, AddressService) | Merge into business capability (IdentityService) |
| **Feature Service** | Service per UI feature (CartService, CheckoutService, OrderHistoryService) | Merge into OrderingService (one capability) |
| **Shared Data Service** | Central "data access" service all others call | Each service owns its data, sync via events |
| **God Service** | One service with 100+ endpoints | Split by business capability |
| **Nano Service** | Service with 1-2 endpoints and no logic | Merge into related service |
| **Technical Service** | LoggingService, CachingService, DatabaseService | These are libraries/infrastructure, not services |
| **Circular Dependencies** | A calls B calls A | Redesign boundaries, use events to break cycles |
| **Distributed Monolith** | All services must deploy together | Decouple via events, own data, independent deploy |

---

## 8. Service Size Guidelines

```
TOO SMALL (Nano-service):
  - Fewer than 3 endpoints
  - No business logic (just CRUD proxy)
  - Cannot justify a separate CI/CD pipeline
  - 1 developer cannot stay busy maintaining it
  → MERGE into a related service

RIGHT SIZE:
  - 5-20 endpoints covering one business capability
  - Has meaningful business logic and state
  - One team (2-8 people) can own and operate it
  - Deploys independently on its own schedule
  - Has its own database with 3-15 tables
  → KEEP as separate service

TOO LARGE (Mini-monolith):
  - 50+ endpoints covering multiple capabilities
  - Multiple teams need to modify it regularly
  - Deploy cycles are slow due to coordinated changes
  - Multiple databases or database schemas
  → SPLIT by business capability
```

---

## 9. Enforcement Checklist

- [ ] **Boundary = Business Capability** — every service maps to exactly one business capability
- [ ] **One sentence description** — service purpose described without "and"
- [ ] **Own data store** — each service has its own database, no shared tables
- [ ] **Independent deployment** — each service has its own CI/CD pipeline
- [ ] **Team ownership** — one team owns one or more services, never shared ownership
- [ ] **Minimal sync dependencies** — fewer than 3 synchronous calls for primary operations
- [ ] **Event-driven integration** — services communicate primarily through domain events
- [ ] **No circular dependencies** — service dependency graph is a DAG
- [ ] **Different models per context** — same real-world entity has different representations per service
- [ ] **Reference by ID only** — cross-service references use IDs, never embedded objects
- [ ] **Source of truth clear** — for every piece of data, one service is the authoritative owner
- [ ] **Strangler Fig for migration** — extract one service at a time from monolith, never big-bang
