# Monolith: Evolution Path — Complete Specification

> **AI Plugin Directive:** A monolith is NOT a dead end — it is the STARTING POINT of an evolutionary architecture. The path is: Big Ball of Mud → Well-Structured Monolith → Modular Monolith → Selective Microservice Extraction. NEVER skip stages. NEVER do a big-bang rewrite. Each stage builds on the previous one and can be the final state if it meets your needs.

---

## 1. The Evolution Stages

```
Stage 0          Stage 1               Stage 2                Stage 3
┌──────────┐    ┌──────────────┐    ┌────────────────┐    ┌──────────────────┐
│ Big Ball  │ →  │ Well-        │ →  │ Modular        │ →  │ Selective        │
│ of Mud    │    │ Structured   │    │ Monolith       │    │ Microservices    │
│           │    │ Monolith     │    │                │    │                  │
│ Spaghetti │    │ Clean layers │    │ Independent    │    │ Critical modules │
│ No bounds │    │ Some bounds  │    │ modules        │    │ extracted as     │
│           │    │              │    │ Event-driven   │    │ services         │
└──────────┘    └──────────────┘    └────────────────┘    └──────────────────┘
                                                            ↑
                                              Most teams stop here ──┘
                                              (Stage 2 is sufficient)

CRITICAL RULES:
  1. Each stage is a VALID stopping point
  2. Move to the next stage ONLY when you hit the limits of the current one
  3. NEVER skip stages (going from Stage 0 to Stage 3 = guaranteed failure)
  4. NEVER do a big-bang rewrite from any stage
```

---

## 2. Stage 0 → Stage 1: Taming the Big Ball of Mud

### When to Start

```
You are at Stage 0 if:
  □ Any file can import any other file
  □ No clear layering (controllers call repositories directly)
  □ Business logic scattered across controllers, services, and models
  □ "God classes" with 50+ methods
  □ Changing one feature breaks unrelated features
  □ New developers take months to become productive
  □ Test suite is flaky or nonexistent
```

### How to Evolve

```typescript
// Step 1: Establish Clean Architecture layers
// Move code into layers: domain → application → infrastructure → api
// Rule: Inner layers NEVER import outer layers

// BEFORE (Stage 0):
// controllers/order.controller.ts
class OrderController {
  async createOrder(req: Request, res: Response) {
    const db = getConnection();
    const products = await db.query('SELECT * FROM products WHERE id IN ($1)', [req.body.items]);
    // Business logic mixed with HTTP handling and database access
    let total = 0;
    for (const item of req.body.items) {
      const product = products.find(p => p.id === item.productId);
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: 'Out of stock' });
      }
      total += product.price * item.quantity;
    }
    const order = await db.query('INSERT INTO orders (customer_id, total) VALUES ($1, $2)', [req.user.id, total]);
    // More business logic...
    res.json(order);
  }
}

// AFTER (Stage 1):
// domain/entities/order.ts — Pure business logic, no dependencies
class Order {
  static place(customerId: CustomerId, items: OrderItem[]): Order {
    if (items.length === 0) throw new EmptyOrderError();
    // All business rules here
    return new Order(OrderId.generate(), customerId, items, OrderStatus.PENDING);
  }

  get totalAmount(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.lineTotal),
      Money.zero(this.currency),
    );
  }
}

// application/commands/place-order.handler.ts — Orchestration only
class PlaceOrderHandler {
  constructor(
    private readonly orderRepo: OrderRepository, // Interface
    private readonly productRepo: ProductRepository, // Interface
  ) {}

  async execute(command: PlaceOrderCommand): Promise<OrderId> {
    const items = await this.buildOrderItems(command.items);
    const order = Order.place(command.customerId, items);
    await this.orderRepo.save(order);
    return order.id;
  }
}

// api/controllers/order.controller.ts — HTTP concerns only
class OrderController {
  async createOrder(req: Request, res: Response) {
    const command = PlaceOrderCommand.fromRequest(req.body);
    const orderId = await this.placeOrderHandler.execute(command);
    res.status(201).json({ orderId: orderId.value });
  }
}
```

```
// Step 2: Extract domain models from ORM entities
// Create SEPARATE domain models and ORM models with mappers between them

// Step 3: Introduce ports and adapters
// Define interfaces (ports) in the domain
// Implement them in infrastructure (adapters)

// Step 4: Add dependency injection
// Wire implementations to interfaces in composition root
// Stop using `new` keyword in business logic

// Step 5: Add basic tests
// Domain logic unit tests (fast, no I/O)
// Integration tests for repositories
```

---

## 3. Stage 1 → Stage 2: Creating a Modular Monolith

### When to Start

```
You are ready for Stage 2 when:
  □ Clean Architecture is established (layers, ports, adapters)
  □ Domain models are separate from ORM entities
  □ Dependency injection is in place
  □ Basic test coverage exists
  □ Team is growing (approaching 10+ developers)
  □ Features in one area are starting to conflict with another area
```

### How to Evolve

```typescript
// Step 1: Identify bounded contexts
// Run Event Storming or analyze code for natural groupings

// BEFORE (Stage 1): Flat structure with layers
src/
├── domain/
│   ├── order.ts
│   ├── product.ts
│   ├── customer.ts
│   ├── payment.ts
│   └── shipment.ts
├── application/
│   ├── place-order.handler.ts
│   ├── create-product.handler.ts
│   ├── register-customer.handler.ts
│   └── process-payment.handler.ts
└── infrastructure/
    └── ...

// AFTER (Stage 2): Module-based structure
src/
├── modules/
│   ├── ordering/          ← All ordering code
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── ordering.public-api.ts
│   ├── catalog/           ← All catalog code
│   │   └── ...
│   ├── identity/          ← All identity code
│   │   └── ...
│   └── billing/           ← All billing code
│       └── ...
└── shared-kernel/

// Step 2: Move code into modules
// Start with the most independent module (fewest dependencies)
// Move entities, use cases, repositories into the module

// Step 3: Define public APIs
// Each module exposes a facade
// Replace cross-boundary imports with public API calls

// Step 4: Enforce boundaries
// Add ESLint boundaries / import-linter rules
// Run architecture tests in CI

// Step 5: Introduce in-process events
// Replace direct cross-module method calls with events
// Publish events in the publisher, subscribe in the consumer

// Step 6: Separate database schemas
// Create schema-per-module (same database, different schemas)
// Remove cross-schema foreign keys
// Replace cross-schema joins with application-level queries
```

### Migration Order (Safest to Riskiest)

```
1. NOTIFICATION/EMAIL MODULE (Least coupled)
   - Receives events, sends emails/SMS
   - Almost zero inbound dependencies
   - Safe to extract first

2. ANALYTICS/REPORTING MODULE (Read-only)
   - Reads data, produces reports
   - No write dependencies
   - Easy to separate

3. SEARCH/INDEXING MODULE (Read-only with different tech)
   - Elasticsearch/Algolia integration
   - Naturally independent
   - Different scaling needs

4. IDENTITY/AUTH MODULE (Many dependents but stable)
   - Stable API, rarely changes
   - Many modules depend on it
   - Extract interface early, implementation later

5. CORE BUSINESS MODULE (Most coupled — extract LAST)
   - Ordering, Billing, Inventory
   - High coupling, complex transactions
   - Extract only if proven necessary
```

---

## 4. Stage 2 → Stage 3: Selective Microservice Extraction

### When to Start

```
Extract a module to a microservice ONLY when it has a PROVEN need:

✅ VALID REASONS TO EXTRACT:
  □ This module needs to scale independently (10x more traffic)
  □ This module needs a different technology stack
  □ This module's team needs to deploy independently (5x/day vs weekly)
  □ This module's failure should NOT bring down the rest of the system
  □ Regulatory requirement for data isolation

❌ INVALID REASONS TO EXTRACT:
  □ "Microservices are modern" — this is fashion, not engineering
  □ "It will be cleaner" — a modular monolith is already clean
  □ "We want to practice microservices" — practice on a side project
  □ "The monolith is slow" — profile and optimize first
  □ "We're growing" — hire more developers for the modular monolith first
```

### Strangler Fig Pattern (Step-by-Step)

```typescript
// Phase 1: Add API gateway / reverse proxy

// BEFORE: Direct access to monolith
// Client → Monolith (handles everything)

// AFTER: Gateway in front
// Client → API Gateway → Monolith (still handles everything)

// nginx.conf or API Gateway config
// Route everything to monolith initially
// location / {
//   proxy_pass http://monolith:3000;
// }

// Phase 2: Build the new service alongside the monolith

// New Notification Service (separate process, separate database)
class NotificationService {
  // Has its own database for notification templates and history
  // Consumes events from the monolith
  async onOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    await this.emailService.send({
      template: 'order-confirmation',
      to: event.customerEmail,
      data: { orderId: event.orderId },
    });
  }
}

// Phase 3: Redirect traffic

// API Gateway routes notification-related requests to new service
// location /api/v1/notifications {
//   proxy_pass http://notification-service:3001;
// }
// location / {
//   proxy_pass http://monolith:3000;
// }

// Phase 4: Monolith publishes events to message broker
// New service consumes events from broker
// Monolith's notification code is disabled, then removed

// Phase 5: Remove notification code from monolith
// The monolith is now smaller
// The notification service operates independently

// Phase 6: Repeat for the next module (if needed)
```

### Data Extraction Strategy

```sql
-- When extracting a module's data to its own database:

-- Step 1: Set up Change Data Capture (CDC) from monolith DB to new service DB
-- The new service reads from its own DB, writes replicated from monolith
-- This is TEMPORARY — just for migration

-- Step 2: Switch writes to new service
-- New service owns the data now
-- Monolith reads from new service via API

-- Step 3: Remove old tables from monolith
-- Clean up after migration is verified

-- Step 4: Remove CDC replication
-- New service is fully independent

-- Timeline per module: 2-6 weeks
-- NEVER extract more than one module at a time
```

---

## 5. Decision Points at Each Stage

### Stage 0 → Stage 1: Always Do This

```
This is NOT optional. Every codebase should at minimum be at Stage 1.
Clean Architecture with layers is the baseline for professional software.
If you are at Stage 0, this is your first priority.
```

### Stage 1 → Stage 2: Do When Team Grows

```
Move to Stage 2 when:
  - Team > 10 developers
  - Features start conflicting across areas
  - Different areas change at different rates
  - You want to prepare for possible future extraction

Cost: 2-4 weeks of refactoring for a medium-sized codebase
Benefit: Clear ownership, faster development, extraction-ready
```

### Stage 2 → Stage 3: Do Only When Proven

```
Move to Stage 3 SELECTIVELY when:
  - A specific module has a proven need for independent scaling
  - A specific module's team needs independent deployment
  - Infrastructure overhead is justified (DevOps maturity required)

Cost: 2-6 weeks per module extraction + ongoing operational cost
Benefit: Independent scaling and deployment for that specific module

MOST TEAMS SHOULD STAY AT STAGE 2.
Stage 2 (Modular Monolith) gives 80% of microservice benefits
at 20% of the cost.
```

---

## 6. Evolution Anti-Patterns

| Anti-Pattern | Description | Correct Approach |
|-------------|-------------|-----------------|
| **Big Bang Rewrite** | "Let's rewrite everything as microservices" | Evolve incrementally, one module at a time |
| **Skip to Microservices** | Going from Stage 0 directly to Stage 3 | Follow each stage in order |
| **Extract Everything** | Making every module a microservice | Only extract modules with proven need |
| **Premature Extraction** | Extracting before module boundaries are proven | Spend 6+ months in modular monolith first |
| **Technology-Driven** | Extracting because you want to use Kafka/K8s | Extract for business reasons, not tech curiosity |
| **No Gateway** | Extracting services without API gateway | Always add gateway before first extraction |
| **Shared Database Migration** | Extracting service but keeping shared database | Service extraction MUST include data extraction |
| **Parallel Rewrite** | Running two teams: one on monolith, one on microservices | One team incrementally evolves the monolith |

---

## 7. Measuring Evolution Progress

```
HEALTH METRICS AT EACH STAGE:

Stage 1 (Clean Monolith):
  □ Build time < 5 minutes
  □ Test suite < 10 minutes
  □ Deploy frequency: weekly or more
  □ New developer productive in < 2 weeks
  □ Zero circular dependencies between layers

Stage 2 (Modular Monolith):
  □ Module boundary violations: 0 (enforced by CI)
  □ Cross-module commits < 10% (most changes are within one module)
  □ Each module has independent test suite
  □ Module owner can modify module without coordinating with other teams
  □ All inter-module communication goes through public APIs or events

Stage 3 (Selective Microservices):
  □ Extracted services deploy independently
  □ Extracted services have independent monitoring
  □ No shared databases between extracted services and monolith
  □ Contract tests pass between services
  □ 90% of the codebase is still in the modular monolith (only proven extractions)
```

---

## 8. Enforcement Checklist

- [ ] **No big-bang rewrites** — evolution is always incremental
- [ ] **Stage gates respected** — each stage is stable before moving to the next
- [ ] **Extraction justified** — every microservice extraction has a documented business reason
- [ ] **Strangler Fig used** — new services built alongside the monolith, traffic gradually redirected
- [ ] **Data extracted with service** — no shared databases after extraction
- [ ] **API gateway in place** — before first service extraction
- [ ] **One module at a time** — never extract multiple modules simultaneously
- [ ] **Monitoring ready** — observability infrastructure before first extraction
- [ ] **Rollback plan** — every extraction has a plan to revert if needed
- [ ] **Team aligned** — team understands and agrees with the current stage and next steps
