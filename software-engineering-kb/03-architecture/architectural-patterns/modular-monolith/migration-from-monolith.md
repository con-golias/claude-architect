# Modular Monolith: Migration from Monolith — Complete Specification

> **AI Plugin Directive:** Migrating from an unstructured monolith to a modular monolith is the MOST valuable architectural refactoring you can do. It is ALWAYS the correct first step before considering microservices. This migration is done INCREMENTALLY — one module at a time, in production, without a rewrite. NEVER attempt a big-bang modularization. Each step must leave the system in a working state.

---

## 1. The Migration Path

```
CURRENT STATE: Big Ball of Mud (unstructured monolith)
  src/
  ├── controllers/     ← All controllers mixed
  ├── services/        ← All services mixed, circular dependencies
  ├── models/          ← Database models used everywhere
  ├── repositories/    ← Direct database access from anywhere
  └── utils/           ← 5000 lines of mixed utilities

TARGET STATE: Modular Monolith
  src/
  ├── modules/
  │   ├── ordering/    ← Self-contained bounded context
  │   ├── catalog/     ← Self-contained bounded context
  │   ├── billing/     ← Self-contained bounded context
  │   └── identity/    ← Self-contained bounded context
  ├── shared-kernel/
  └── infrastructure/

MIGRATION: 8 phases, done incrementally over weeks/months
```

---

## 2. Phase 1: Analyze Current State

```typescript
// Before moving any code, understand the current dependency graph

// Run dependency analysis tools:
// TypeScript: madge, dependency-cruiser
// Python: pydeps, import-linter (analysis mode)
// Java: JDepend, ArchUnit (analysis mode)
// C#: NsDepCop, NetArchTest

// Generate dependency graph
// $ npx madge --circular --warning src/
// This shows circular dependencies that MUST be broken

// Common findings:
// 1. controllers/ → services/ → repositories/ (expected)
// 2. services/order.service → services/product.service (cross-domain)
// 3. services/product.service → services/order.service (CIRCULAR!)
// 4. models/order.model used in billing/, shipping/, analytics/ (shared entity)
// 5. utils/helpers.ts imported by 80% of files (god file)

// Document these findings — they guide the migration order
```

### Dependency Inventory

```
Create a spreadsheet / document:

| Source File              | Imports From              | Imported By               | Future Module |
|--------------------------|---------------------------|---------------------------|---------------|
| services/order.service   | product.service,          | order.controller,         | Ordering      |
|                          | customer.service,         | billing.service,          |               |
|                          | payment.service           | shipping.service          |               |
| services/product.service | category.repo,            | order.service,            | Catalog       |
|                          | search.service            | recommendation.service    |               |
| models/customer.model    | (none)                    | order.service,            | Identity      |
|                          |                           | billing.service,          |               |
|                          |                           | shipping.service,         |               |
|                          |                           | notification.service      |               |

Key insight: customer.model is used by 4 future modules
  → Each module needs its OWN customer representation
  → This is the hardest part of migration
```

---

## 3. Phase 2: Establish Infrastructure Foundation

```typescript
// Before modularizing, set up the infrastructure that modules will share

// 1. Create shared-kernel with value objects
// shared-kernel/value-objects/money.ts
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    if (amount < 0) throw new Error('Money cannot be negative');
    return new Money(Math.round(amount * 100) / 100, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Cannot add different currencies');
    return Money.of(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}

// 2. Create event bus
// shared-kernel/events/event-bus.ts
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}

// infrastructure/event-bus/in-process-event-bus.ts
export class InProcessEventBus implements EventBus { ... }

// 3. Set up DI container
// infrastructure/di/container.ts — will be expanded as modules are created
```

---

## 4. Phase 3: Extract the First Module

### Choose the Least Coupled Module

```
Migration order (safest first):

1. NOTIFICATION — Almost zero inbound dependencies
   Other modules send it events. It doesn't call anything.
   Easiest to extract. Low risk.

2. ANALYTICS — Read-only, no writes to other modules' data
   Subscribes to events, builds reports.
   No business logic dependencies.

3. IDENTITY — Many dependents but stable API
   Most modules need user info, but Identity rarely changes.
   Define its Public API early — other modules adapt.

4. CATALOG — Moderately coupled
   Ordering needs product info. Extract after Identity.

5. ORDERING — Core business logic
   Complex dependencies. Extract after Catalog and Identity.

6. BILLING / PAYMENT — Tightly coupled to Ordering
   Extract after Ordering module is stable.
```

### Step-by-Step: Extracting Notification Module

```typescript
// Step 1: Create the module folder structure
// modules/notification/
// ├── domain/
// │   ├── entities/notification-template.ts
// │   ├── value-objects/notification-channel.ts
// │   └── ports/email-sender.ts
// ├── application/
// │   ├── commands/send-email.handler.ts
// │   └── event-handlers/
// │       ├── on-order-placed.handler.ts
// │       └── on-password-reset.handler.ts
// ├── infrastructure/
// │   ├── email/sendgrid.adapter.ts
// │   └── persistence/template.repository.ts
// └── notification.module.ts

// Step 2: Move existing notification code into the module
// BEFORE: services/notification.service.ts (mixed with everything)
// AFTER:  modules/notification/application/commands/send-email.handler.ts

// Step 3: Replace old imports
// BEFORE (in other files):
import { NotificationService } from '../services/notification.service';
// AFTER (in other files):
import { NotificationPublicApi } from '../modules/notification/notification.public-api';
// OR: Replace with event publishing (preferred)
await this.eventBus.publish(new OrderPlacedEvent(order));
// Notification module subscribes to this event

// Step 4: Delete old notification code from services/
// Only after all references are updated and tests pass

// Step 5: Add import boundary rules for the new module
// Update .eslintrc.js with notification module boundaries
```

---

## 5. Phase 4: Break Circular Dependencies

```typescript
// Circular dependencies are the #1 blocker in migration

// COMMON CIRCULAR: OrderService ↔ ProductService
// OrderService calls ProductService.getPrice()
// ProductService calls OrderService.getMostOrderedProducts()

// FIX 1: Introduce Events
// Instead of ProductService calling OrderService:
class ProductService {
  // ❌ BEFORE
  async getMostPopular(): Promise<Product[]> {
    const topOrdered = await this.orderService.getMostOrderedProductIds();
    return this.productRepo.findByIds(topOrdered);
  }

  // ✅ AFTER: Maintain a local popularity cache from order events
  async getMostPopular(): Promise<Product[]> {
    return this.productRepo.findMostPopular(); // Reads from own table
  }
}

// Catalog module subscribes to ordering events to update popularity
class OnOrderPlacedUpdatePopularity {
  async handle(event: OrderPlacedEvent): Promise<void> {
    for (const item of event.items) {
      await this.popularityRepo.incrementOrderCount(item.productId);
    }
  }
}

// FIX 2: Extract Shared Logic to Shared Kernel
// If both modules need the same calculation:
// Move the PURE FUNCTION to shared-kernel (no dependencies)

// FIX 3: Introduce a Mediating Module
// If A ↔ B, create module C that both A and B depend on
// A → C ← B (no cycle)
```

---

## 6. Phase 5: Separate Domain Models

```typescript
// The HARDEST part: entities used across modules must be split

// BEFORE: One Customer model used everywhere
class Customer {
  id: string;
  name: string;
  email: string;
  passwordHash: string;      // Identity concern
  creditLimit: number;        // Billing concern
  shippingAddress: Address;   // Ordering concern
  loyaltyPoints: number;      // Marketing concern
  lastLoginAt: Date;          // Identity concern
}

// AFTER: Each module has its OWN representation

// identity/domain/entities/user.ts
class User {
  id: UserId;
  email: EmailAddress;
  passwordHash: string;
  mfaEnabled: boolean;
  lastLoginAt: Date;
}

// ordering/domain/value-objects/customer-info.ts (local read model)
class CustomerInfo {
  customerId: string;
  name: string;
  shippingAddress: Address;
  // Updated via events from Identity module
}

// billing/domain/entities/account.ts
class BillingAccount {
  accountId: string;
  creditLimit: Money;
  outstandingBalance: Money;
  paymentMethods: PaymentMethod[];
}

// Migration strategy:
// 1. Create new module-specific models alongside the old shared model
// 2. Update module code to use new models
// 3. Create mappers from old shared model to new module models
// 4. Once all modules use their own models, delete the old shared model
```

---

## 7. Phase 6: Separate Database Schemas

```sql
-- Migrate from one flat schema to schema-per-module

-- Step 1: Create new schemas
CREATE SCHEMA ordering;
CREATE SCHEMA catalog;
CREATE SCHEMA billing;
CREATE SCHEMA identity;

-- Step 2: Move tables to appropriate schemas (one at a time)
ALTER TABLE public.orders SET SCHEMA ordering;
ALTER TABLE public.order_items SET SCHEMA ordering;
ALTER TABLE public.products SET SCHEMA catalog;
ALTER TABLE public.categories SET SCHEMA catalog;
ALTER TABLE public.invoices SET SCHEMA billing;
ALTER TABLE public.users SET SCHEMA identity;

-- Step 3: Update application code to use schema-qualified names
-- Before: SELECT * FROM orders
-- After:  SELECT * FROM ordering.orders

-- Step 4: Drop cross-schema foreign keys
ALTER TABLE ordering.orders DROP CONSTRAINT fk_orders_customer;
-- Keep customer_id column, just remove the FK constraint
-- Referential integrity is now the application's responsibility

-- Step 5: Update ORM configurations
-- TypeORM: @Entity({ schema: 'ordering' })
-- Prisma: datasource with schema
-- SQLAlchemy: __table_args__ = {'schema': 'ordering'}

-- Do this ONE TABLE AT A TIME, verify each migration
```

---

## 8. Phase 7: Add Boundary Enforcement

```typescript
// After all modules are extracted, enforce boundaries permanently

// 1. ESLint boundaries (TypeScript)
// .eslintrc.js — see module-boundaries.md for full config

// 2. Architecture tests
describe('Module Boundaries', () => {
  it('ordering module should not import catalog internals', () => {
    const violations = findImports('src/modules/ordering/**', {
      forbidden: [
        'src/modules/catalog/domain/**',
        'src/modules/catalog/application/**',
        'src/modules/catalog/infrastructure/**',
      ],
      allowed: [
        'src/modules/catalog/catalog.public-api',
        'src/shared-kernel/**',
      ],
    });
    expect(violations).toHaveLength(0);
  });

  it('no circular dependencies between modules', () => {
    const graph = buildDependencyGraph('src/modules/**');
    expect(graph.hasCycles()).toBe(false);
  });
});

// 3. CI pipeline (see Phase 8)
```

---

## 9. Phase 8: CI/CD Integration

```yaml
# Run boundary checks on every PR
name: Architecture Compliance
on: [pull_request]

jobs:
  boundary-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Lint import boundaries
        run: npx eslint --rule 'boundaries/element-types: error' 'src/**/*.ts'
      - name: Run architecture tests
        run: npm run test:architecture
      - name: Check circular dependencies
        run: npx madge --circular src/ && echo "No circular dependencies" || exit 1
```

---

## 10. Migration Timeline

```
SMALL CODEBASE (< 50K lines, < 10 developers):
  Phase 1-2: 1 week (analyze + set up infrastructure)
  Phase 3-4: 2-3 weeks (extract first modules, break cycles)
  Phase 5-6: 2-3 weeks (split models, separate schemas)
  Phase 7-8: 1 week (enforcement + CI)
  TOTAL: 6-8 weeks

MEDIUM CODEBASE (50K-200K lines, 10-20 developers):
  Phase 1-2: 2 weeks
  Phase 3-4: 4-6 weeks (more modules, more cycles)
  Phase 5-6: 4-6 weeks (more models to split)
  Phase 7-8: 1-2 weeks
  TOTAL: 3-4 months

LARGE CODEBASE (> 200K lines, 20+ developers):
  Phase 1-2: 2-3 weeks
  Phase 3-4: 2-3 months
  Phase 5-6: 2-3 months
  Phase 7-8: 2-4 weeks
  TOTAL: 6-9 months

RULES:
  - Do NOT stop feature development during migration
  - Migrate incrementally alongside normal work
  - Each phase leaves the system in a WORKING state
  - Measure progress: % of code in modules vs. legacy flat structure
```

---

## 11. Common Migration Mistakes

| Mistake | Why It Fails | Correct Approach |
|---------|-------------|-----------------|
| **Big-Bang Modularization** | Too much change at once, breaks everything | One module at a time |
| **Starting with Core Module** | Core has the most dependencies, highest risk | Start with the LEAST coupled module |
| **Skipping Analysis** | Spending weeks moving code in wrong directions | Analyze dependency graph FIRST |
| **Ignoring Circular Deps** | Can't cleanly separate modules | Break cycles with events BEFORE moving code |
| **Shared Entity Migration** | Multiple modules still use one Customer class | Split into module-specific models |
| **No CI Enforcement** | Boundaries erode within weeks | Add linting + architecture tests to CI |
| **Feature Freeze** | Team frustrated, business stakeholders angry | Migrate incrementally alongside features |
| **No Rollback Plan** | Stuck with broken migration | Each step reversible, feature flags |

---

## 12. Enforcement Checklist

- [ ] **Dependency analysis completed** — circular dependencies mapped before starting
- [ ] **Migration order defined** — least coupled modules extracted first
- [ ] **Shared kernel established** — value objects and event bus before module extraction
- [ ] **One module at a time** — never extract multiple modules simultaneously
- [ ] **Circular dependencies broken** — events replace bidirectional calls
- [ ] **Domain models split** — each module has its own entity representations
- [ ] **Database schemas separated** — schema-per-module, no cross-schema FKs
- [ ] **Import boundaries in CI** — linting fails on boundary violations
- [ ] **Architecture tests passing** — automated checks in every PR
- [ ] **Feature development continues** — migration is incremental, not a freeze
- [ ] **Progress tracked** — percentage of code migrated to modules measured weekly
