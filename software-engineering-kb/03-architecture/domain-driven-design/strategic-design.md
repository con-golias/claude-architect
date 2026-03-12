# Domain-Driven Design: Strategic Design — Complete Specification

> **AI Plugin Directive:** Strategic Design determines HOW to split a large system into manageable parts. Before writing any code for a complex application, use these patterns to identify domains, subdomains, and their relationships. This prevents the "big ball of mud" architecture.

---

## 1. Core Concepts

### Domain Decomposition

**Every complex business can be decomposed into subdomains. Identify them BEFORE writing code.**

| Subdomain Type | Description | Investment Level | Example |
|---------------|-------------|-----------------|---------|
| **Core Domain** | The competitive advantage. What makes the business unique. | Maximum investment — custom-built, best developers, most testing | Amazon: recommendation engine, fulfillment optimization |
| **Supporting Domain** | Necessary but not a differentiator. Supports the core. | Moderate investment — custom-built but simpler | Amazon: seller management, product catalog |
| **Generic Domain** | Same across all businesses. No competitive advantage. | Minimum investment — buy or use open-source | Authentication, email, payment processing, logging |

### Rules for Subdomain Identification

```
1. What makes this business DIFFERENT from competitors?     → Core Domain
2. What does this business need but every business needs?   → Generic Domain
3. Everything else that supports the core                   → Supporting Domain
```

### Decision Matrix: Build vs Buy vs Open-Source

| Subdomain Type | Build Custom | Buy SaaS | Open-Source |
|---------------|-------------|----------|-------------|
| **Core** | ALWAYS | Never | Never |
| **Supporting** | If needed | Consider | Good option |
| **Generic** | Never | Preferred | Good option |

```typescript
// Example: E-Commerce Platform

// CORE DOMAIN — Build custom, invest heavily
// This is what makes YOUR e-commerce different
namespace Pricing {
  class DynamicPricingEngine { }     // Custom pricing algorithms
  class PersonalizedOfferService { }  // AI-driven personalization
  class LoyaltyRewardsEngine { }      // Unique loyalty program
}

// SUPPORTING DOMAIN — Build custom but simpler
namespace Catalog {
  class ProductCatalog { }
  class CategoryManagement { }
  class SearchIndex { }
}

namespace OrderManagement {
  class OrderProcessing { }
  class ReturnHandling { }
}

// GENERIC DOMAIN — Use existing solutions
// Authentication → Auth0, Cognito, Firebase Auth
// Payment → Stripe, Braintree
// Email → SendGrid, SES
// Logging → Datadog, ELK
// Search → Elasticsearch, Algolia
```

---

## 2. Context Mapping

### Context Map Types

A Context Map shows the relationships between bounded contexts. **Every system with multiple bounded contexts MUST have a context map.**

### Relationship Patterns

#### 1. Partnership

**Two teams jointly coordinate. Both contexts evolve together.**

```
┌──────────────┐         ┌──────────────┐
│  Ordering    │◄═══════►│  Inventory   │
│  Context     │ Partner  │  Context     │
└──────────────┘         └──────────────┘
```

**When to use:** Two teams that succeed or fail together and can align on schedules.

```typescript
// Both teams agree on shared events and evolve them together
// ordering/domain/events
class OrderPlacedEvent {
  constructor(
    public readonly orderId: string,
    public readonly items: Array<{ sku: string; quantity: number }>,
    public readonly placedAt: Date,
  ) {}
}

// inventory/domain/event-handlers
class OnOrderPlacedHandler {
  // Inventory team agreed to handle this event format
  async handle(event: OrderPlacedEvent): Promise<void> {
    for (const item of event.items) {
      await this.inventoryService.reserve(Sku.from(item.sku), Quantity.of(item.quantity));
    }
  }
}
```

#### 2. Customer-Supplier (Upstream-Downstream)

**Upstream provides a service. Downstream consumes it. Upstream has no obligation to accommodate downstream.**

```
┌──────────────┐         ┌──────────────┐
│  Product     │════════►│  Ordering    │
│  (Upstream)  │ Supplier │ (Downstream) │
└──────────────┘         └──────────────┘
```

**When to use:** One team provides data/service that another team consumes.

```typescript
// Upstream (Product context) publishes its API/events — doesn't care who consumes
// product/infrastructure/http
class ProductController {
  @Get(':id')
  async getProduct(@Param('id') id: string): Promise<ProductDto> {
    return this.getProductQuery.execute({ productId: id });
  }
}

// Downstream (Ordering context) must adapt to upstream's format
// ordering/infrastructure/adapters
class ProductCatalogAdapter implements ProductCatalogPort {
  async getProduct(productId: ProductId): Promise<ProductInfo> {
    const dto = await this.httpClient.get<ProductDto>(`/api/products/${productId.value}`);
    // Downstream maps to its OWN domain model
    return ProductInfo.create(
      ProductId.from(dto.id),
      dto.name,
      Money.of(dto.price, dto.currency),
      dto.available,
    );
  }
}
```

#### 3. Conformist

**Downstream completely adopts upstream's model. No translation layer.**

**When to use:** When the upstream model is good enough and translation isn't worth the effort. Common with external APIs you can't change.

```typescript
// ❌ Usually an ANTI-PATTERN in core domain — you lose control of your model
// ✅ Acceptable ONLY for generic subdomains where the external model is fine

// Example: Using Stripe's types directly in your payment infrastructure
// This is OK because payment is a generic subdomain
class StripePaymentGateway implements PaymentGateway {
  // Conformist: we accept Stripe's model for payment intents
  async charge(amount: Money): Promise<PaymentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: amount.toCents(),
      currency: amount.currency.code,
    });
    // Minimal mapping — mostly conforming to Stripe's model
    return PaymentResult.from(intent.status, intent.id);
  }
}
```

#### 4. Anti-Corruption Layer (ACL)

**Downstream creates a translation layer to protect its domain model from upstream's model.**

**When to use:** When the upstream model is significantly different from your domain model, or when integrating with legacy systems.

```typescript
// The Anti-Corruption Layer sits between YOUR domain and the EXTERNAL system

// Your domain model (clean, domain-driven)
interface ShippingRate {
  carrier: Carrier;
  cost: Money;
  estimatedDelivery: DeliveryTimeframe;
  serviceLevel: ServiceLevel;
}

// External system's model (ugly, legacy, different terms)
interface LegacyFreightResponse {
  CARR_CODE: string;
  RATE_AMT: number;
  RATE_CUR: string;
  EST_DAYS_MIN: number;
  EST_DAYS_MAX: number;
  SVC_LVL: 'STD' | 'EXP' | 'PRI';
  SURCHARGES: Array<{ TYPE: string; AMT: number }>;
}

// Anti-Corruption Layer — translates between the two worlds
class FreightRateAntiCorruptionLayer implements ShippingRateProvider {
  constructor(private readonly legacyClient: LegacyFreightClient) {}

  async getRates(shipment: Shipment): Promise<ShippingRate[]> {
    // Call legacy system
    const legacyRates = await this.legacyClient.fetchRates({
      ORIG_ZIP: shipment.origin.postalCode,
      DEST_ZIP: shipment.destination.postalCode,
      WEIGHT_LBS: shipment.weight.toPounds(),
      DIMS: `${shipment.dimensions.length}x${shipment.dimensions.width}x${shipment.dimensions.height}`,
    });

    // TRANSLATE to our domain model
    return legacyRates.map(legacy => ({
      carrier: this.translateCarrier(legacy.CARR_CODE),
      cost: this.calculateTotalCost(legacy),
      estimatedDelivery: DeliveryTimeframe.between(
        legacy.EST_DAYS_MIN,
        legacy.EST_DAYS_MAX
      ),
      serviceLevel: this.translateServiceLevel(legacy.SVC_LVL),
    }));
  }

  private translateCarrier(code: string): Carrier {
    const mapping: Record<string, Carrier> = {
      'FEDX': Carrier.FEDEX,
      'UPS1': Carrier.UPS,
      'USPS': Carrier.USPS,
      'DHL0': Carrier.DHL,
    };
    return mapping[code] ?? Carrier.UNKNOWN;
  }

  private translateServiceLevel(code: string): ServiceLevel {
    const mapping: Record<string, ServiceLevel> = {
      'STD': ServiceLevel.STANDARD,
      'EXP': ServiceLevel.EXPRESS,
      'PRI': ServiceLevel.PRIORITY,
    };
    return mapping[code] ?? ServiceLevel.STANDARD;
  }

  private calculateTotalCost(legacy: LegacyFreightResponse): Money {
    const base = Money.of(legacy.RATE_AMT, legacy.RATE_CUR);
    const surcharges = legacy.SURCHARGES.reduce(
      (sum, s) => sum.add(Money.of(s.AMT, legacy.RATE_CUR)),
      Money.zero(Currency.from(legacy.RATE_CUR))
    );
    return base.add(surcharges);
  }
}
```

#### 5. Shared Kernel

**Two contexts share a small, common model. Changes require coordination.**

```
┌──────────────┐         ┌──────────────┐
│  Ordering    │◄──┐ ┌──►│  Shipping    │
│  Context     │   │ │   │  Context     │
└──────────────┘   │ │   └──────────────┘
              ┌────┴─┴────┐
              │  Shared    │
              │  Kernel    │
              │ (Address,  │
              │  Money,    │
              │  UserId)   │
              └────────────┘
```

**When to use:** When two contexts need identical representations of simple concepts.

**Rules:**
- Keep the shared kernel as SMALL as possible
- Only value objects and simple types — NEVER entities or aggregates
- Changes require agreement from ALL contexts using it
- Publish as a versioned package/module

```typescript
// shared-kernel/src/value-objects/money.ts
export class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: Currency,
  ) {}
  static of(amount: number, currency: Currency | string): Money { /* ... */ }
  add(other: Money): Money { /* ... */ }
  subtract(other: Money): Money { /* ... */ }
  equals(other: Money): boolean { /* ... */ }
}

// shared-kernel/src/value-objects/address.ts
export class Address {
  constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly state: string,
    public readonly postalCode: string,
    public readonly country: CountryCode,
  ) {}
}

// shared-kernel/src/types/user-id.ts
export class UserId {
  private constructor(private readonly value: string) {}
  static from(value: string): UserId { /* validate */ }
  equals(other: UserId): boolean { return this.value === other.value; }
}

// package.json: "@myapp/shared-kernel": "1.2.0"
// Both ordering and shipping contexts depend on this versioned package
```

#### 6. Open Host Service + Published Language

**A context provides a well-defined API with a documented protocol.**

```typescript
// Product context exposes a Public API (Open Host Service)
// with a documented schema (Published Language)

// published-language/product-api.schema.ts
// This is the CONTRACT — versioned and documented
export interface ProductApiV1 {
  endpoints: {
    'GET /products/:id': {
      response: ProductResourceV1;
    };
    'GET /products': {
      query: { category?: string; page?: number; limit?: number };
      response: PaginatedResource<ProductResourceV1>;
    };
    'POST /products/:id/reserve': {
      body: { quantity: number; reservationId: string };
      response: ReservationResourceV1;
    };
  };
}

export interface ProductResourceV1 {
  id: string;
  name: string;
  sku: string;
  price: { amount: number; currency: string };
  availability: 'in_stock' | 'low_stock' | 'out_of_stock';
  category: string;
}

// Downstream contexts consume the Published Language
// They can build their Anti-Corruption Layer against this stable contract
```

---

## 3. Context Mapping Decision Guide

```
How do the two teams relate?
├── Same team, tightly coupled feature
│   └── SHARED KERNEL (keep it minimal)
├── Two teams that coordinate closely
│   └── PARTNERSHIP
├── One team provides, the other consumes
│   ├── Can you influence the upstream team?
│   │   ├── YES → CUSTOMER-SUPPLIER
│   │   └── NO → Is their model acceptable?
│   │       ├── YES → CONFORMIST
│   │       └── NO → ANTI-CORRUPTION LAYER
├── External system / legacy system
│   └── ANTI-CORRUPTION LAYER (always)
└── Public API consumed by many
    └── OPEN HOST SERVICE + PUBLISHED LANGUAGE
```

---

## 4. Bounded Context Integration Patterns

### Event-Based Integration (Preferred)

```typescript
// Context A publishes domain events
// ordering/domain/events
class OrderConfirmedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly items: Array<{ productId: string; quantity: number }>,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly shippingAddress: AddressData,
  ) {
    super('order.confirmed');
  }
}

// Context B subscribes and reacts
// shipping/infrastructure/event-handlers
class OnOrderConfirmedHandler {
  constructor(
    private readonly createShipment: CreateShipmentHandler,
  ) {}

  async handle(event: OrderConfirmedEvent): Promise<void> {
    // Map from ordering's language to shipping's language
    await this.createShipment.execute({
      referenceId: event.orderId,  // "orderId" becomes "referenceId" in shipping
      parcels: event.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      recipient: {
        street: event.shippingAddress.street,
        city: event.shippingAddress.city,
        postalCode: event.shippingAddress.postalCode,
        country: event.shippingAddress.country,
      },
    });
  }
}
```

### API-Based Integration (Synchronous)

```typescript
// When you need immediate response, use synchronous API calls
// But ALWAYS go through an Anti-Corruption Layer

// ordering/application/ports
interface InventoryChecker {
  checkAvailability(productId: ProductId, quantity: Quantity): Promise<AvailabilityResult>;
}

// ordering/infrastructure/adapters
class HttpInventoryChecker implements InventoryChecker {
  constructor(private readonly http: HttpClient) {}

  async checkAvailability(productId: ProductId, quantity: Quantity): Promise<AvailabilityResult> {
    try {
      const response = await this.http.get<InventoryApiResponse>(
        `/api/inventory/${productId.value}`
      );

      // ACL: Translate inventory context's model to ordering context's model
      return AvailabilityResult.create({
        isAvailable: response.quantityOnHand >= quantity.value,
        availableQuantity: Quantity.of(response.quantityOnHand),
        restockDate: response.nextRestockDate
          ? new Date(response.nextRestockDate)
          : undefined,
      });
    } catch (error) {
      // Graceful degradation: assume available if inventory service is down
      return AvailabilityResult.unknown();
    }
  }
}
```

---

## 5. Distillation

### Core Domain Distillation

**Identify and isolate the MOST IMPORTANT part of your domain. Protect it from pollution.**

```typescript
// The Core Domain should be in its own module/package with the STRICTEST rules

// ✅ Core Domain: Maximum investment
// pricing/domain/ — This is what makes the business unique
class DynamicPricingEngine {
  calculatePrice(
    product: Product,
    customer: Customer,
    context: PricingContext,
  ): Price {
    // Complex, proprietary pricing algorithm
    // This is the competitive advantage
    // Best developers work here
    // Most tests cover this
    const basePrice = product.basePrice;
    const demandFactor = this.analyzeDemand(product, context.currentDemand);
    const customerFactor = this.calculateCustomerFactor(customer);
    const competitorFactor = this.analyzeCompetitorPricing(product);
    const seasonalFactor = this.getSeasonalAdjustment(context.date);

    return basePrice
      .multiply(demandFactor)
      .multiply(customerFactor)
      .multiply(competitorFactor)
      .multiply(seasonalFactor)
      .applyFloor(product.minimumPrice)
      .applyCeiling(product.maximumPrice);
  }
}

// ❌ Generic Domain: Don't build this — use existing solutions
// auth/ → Use Auth0
// email/ → Use SendGrid
// payment/ → Use Stripe
```

---

## 6. Strategic Design Checklist

Before starting any complex project:

- [ ] **Identify all subdomains** — list every business capability
- [ ] **Classify subdomains** — Core, Supporting, or Generic
- [ ] **Decide build vs buy** — Custom for Core, buy/OSS for Generic
- [ ] **Define bounded contexts** — each with its own model and language
- [ ] **Map relationships** — which contexts communicate and how
- [ ] **Choose integration patterns** — events, API, shared kernel
- [ ] **Identify ACL needs** — where translation layers are required
- [ ] **Create context map diagram** — visual map of all contexts and relationships
- [ ] **Assign teams to contexts** — one team per context (ideally)
- [ ] **Define published language** — API contracts between contexts

---

## 7. Context Map Template

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTEXT MAP                               │
│                    [Application Name]                         │
│                                                              │
│  ┌──────────┐    events     ┌──────────┐                    │
│  │ ORDERING │──────────────►│ SHIPPING │                    │
│  │ (Core)   │               │ (Support)│                    │
│  └────┬─────┘               └──────────┘                    │
│       │ API                                                  │
│       ▼                                                      │
│  ┌──────────┐    ACL        ┌──────────┐                    │
│  │ CATALOG  │◄─────────────│ LEGACY   │                    │
│  │ (Support)│               │ SYSTEM   │                    │
│  └──────────┘               └──────────┘                    │
│       │                                                      │
│  ┌────┴──────────────────────────────────┐                  │
│  │         SHARED KERNEL                  │                  │
│  │  (Money, Address, UserId, Email)       │                  │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  External Services (Conformist/ACL):                         │
│  ├── Stripe (Payment) ── Conformist                          │
│  ├── SendGrid (Email) ── Conformist                          │
│  └── Legacy ERP ── Anti-Corruption Layer                     │
└─────────────────────────────────────────────────────────────┘
```
