# Modular Monolith: Module Boundaries — Complete Specification

> **AI Plugin Directive:** Module boundaries are the MOST IMPORTANT design decision in a modular monolith. Without enforced boundaries, a modular monolith degrades into a big ball of mud within months. Boundaries MUST be enforced at FOUR levels: code imports, database schemas, communication contracts, and CI/CD validation. A boundary that exists only in documentation but not in tooling is no boundary at all.

---

## 1. The Core Rule

**A module boundary is a wall that PREVENTS unauthorized access to a module's internals. Only the module's Public API is accessible to other modules. EVERYTHING else is private. This is enforced by tooling, not by convention.**

---

## 2. Four Levels of Boundary Enforcement

### Level 1: Code Import Boundaries

```typescript
// RULE: Module A can ONLY import Module B's public-api file
// RULE: Module A CANNOT import Module B's domain, application, or infrastructure

// ✅ ALLOWED IMPORTS
import { CatalogPublicApi } from '../catalog/catalog.public-api';
import { Money } from '../../shared-kernel/value-objects/money';
import { DomainEvent } from '../../shared-kernel/events/domain-event';

// ❌ FORBIDDEN IMPORTS
import { Product } from '../catalog/domain/entities/product';           // Internal entity
import { ProductRepository } from '../catalog/domain/ports/product.repository'; // Internal port
import { CreateProductHandler } from '../catalog/application/commands/create-product.handler'; // Internal use case
import { PostgresProductRepo } from '../catalog/infrastructure/persistence/product.repo.impl'; // Internal impl
```

#### TypeScript Enforcement: ESLint Boundaries

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['boundaries'],
  settings: {
    'boundaries/elements': [
      { type: 'ordering', pattern: 'src/modules/ordering/**', capture: ['category'] },
      { type: 'catalog', pattern: 'src/modules/catalog/**', capture: ['category'] },
      { type: 'billing', pattern: 'src/modules/billing/**', capture: ['category'] },
      { type: 'identity', pattern: 'src/modules/identity/**', capture: ['category'] },
      { type: 'shared', pattern: 'src/shared-kernel/**' },
      { type: 'infra', pattern: 'src/infrastructure/**' },
    ],
  },
  rules: {
    'boundaries/element-types': [2, {
      default: 'disallow',
      rules: [
        // Modules can import shared kernel and infrastructure
        { from: ['ordering'], allow: ['shared', 'infra'] },
        { from: ['catalog'], allow: ['shared', 'infra'] },
        { from: ['billing'], allow: ['shared', 'infra'] },
        { from: ['identity'], allow: ['shared', 'infra'] },
        // Shared kernel cannot import modules
        { from: ['shared'], allow: ['shared'] },
      ],
    }],
    // Additional: only allow importing public-api files from other modules
    'boundaries/entry-point': [2, {
      default: 'disallow',
      rules: [
        {
          target: ['ordering', 'catalog', 'billing', 'identity'],
          allow: ['**/*.public-api.ts', '**/events/*.event.ts'],
          // Only public API and published events can be imported
        },
      ],
    }],
  },
};
```

#### Python Enforcement: import-linter

```ini
# .importlinter
[importlinter]
root_packages = src

[importlinter:contract:module-independence]
name = Modules must be independent
type = independence
modules =
  src.modules.ordering
  src.modules.catalog
  src.modules.billing
  src.modules.identity

[importlinter:contract:layer-contract]
name = Layers follow dependency rule
type = layers
layers =
  src.modules.ordering.domain
  src.modules.ordering.application
  src.modules.ordering.infrastructure
  src.modules.ordering.api
```

#### C# Enforcement: Project References + NetArchTest

```xml
<!-- Ordering.Domain.csproj — NO references to other modules -->
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\..\SharedKernel\SharedKernel.csproj" />
    <!-- NOTHING ELSE — domain has zero external dependencies -->
  </ItemGroup>
</Project>

<!-- Ordering.Application.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\Ordering.Domain\Ordering.Domain.csproj" />
    <ProjectReference Include="..\..\SharedKernel\SharedKernel.csproj" />
    <!-- Can reference OTHER modules' Public API projects -->
    <ProjectReference Include="..\..\Catalog\Catalog.PublicApi\Catalog.PublicApi.csproj" />
  </ItemGroup>
</Project>
```

```csharp
// Architecture tests in CI
[Fact]
public void OrderingDomain_ShouldNotReference_AnyOtherModule()
{
    Types.InAssembly(typeof(Order).Assembly)
        .Should()
        .NotHaveDependencyOn("Catalog")
        .And()
        .NotHaveDependencyOn("Billing")
        .And()
        .NotHaveDependencyOn("Identity")
        .GetResult()
        .IsSuccessful
        .Should().BeTrue();
}
```

### Level 2: Database Schema Boundaries

```sql
-- Each module owns its own schema within the same database

CREATE SCHEMA ordering;
CREATE SCHEMA catalog;
CREATE SCHEMA billing;
CREATE SCHEMA identity;

-- Module tables live in their schema
CREATE TABLE ordering.orders (...);
CREATE TABLE ordering.order_items (...);
CREATE TABLE catalog.products (...);
CREATE TABLE catalog.categories (...);
CREATE TABLE billing.invoices (...);
CREATE TABLE identity.users (...);

-- RULES:
-- 1. NO foreign keys across schemas
--    ❌ ordering.orders.customer_id REFERENCES identity.users(id)
--    ✅ ordering.orders.customer_id UUID NOT NULL (just store the ID)

-- 2. NO joins across schemas in application code
--    ❌ SELECT o.*, u.name FROM ordering.orders o JOIN identity.users u ...
--    ✅ Fetch from each module separately, compose in application layer

-- 3. NO direct SQL access to another module's schema
--    ❌ billingService.query('SELECT * FROM ordering.orders WHERE ...')
--    ✅ billingService.getOrder(orderId) via ordering module's Public API

-- Enforce with database roles:
CREATE ROLE ordering_module LOGIN;
GRANT USAGE ON SCHEMA ordering TO ordering_module;
GRANT ALL ON ALL TABLES IN SCHEMA ordering TO ordering_module;
-- ordering_module has NO access to catalog, billing, or identity schemas
```

### Level 3: Communication Contract Boundaries

```typescript
// Public API defines the CONTRACT between modules
// This contract is STABLE and VERSIONED

// catalog/catalog.public-api.ts
export class CatalogPublicApi {
  // VERSION 1: Original API
  async getProduct(productId: string): Promise<ProductDto | null> { ... }
  async searchProducts(query: SearchQuery): Promise<PaginatedResult<ProductSummaryDto>> { ... }
  async checkAvailability(productId: string, quantity: number): Promise<boolean> { ... }

  // VERSION 1.1: Added method (backward compatible)
  async getProductsByCategory(categoryId: string): Promise<ProductSummaryDto[]> { ... }
}

// DTOs are the contract types — NOT domain entities
export interface ProductDto {
  id: string;
  name: string;
  price: number;
  currency: string;
  available: boolean;
  // Adding new OPTIONAL fields is backward compatible
  imageUrl?: string;  // Added in v1.1
}

// RULES:
// 1. Public API methods NEVER expose domain entities
// 2. Public API uses DTOs (plain data objects)
// 3. New methods can be added (backward compatible)
// 4. Existing method signatures MUST NOT change
// 5. New optional fields can be added to DTOs
// 6. Existing fields MUST NOT be removed or renamed
```

### Level 4: CI/CD Validation

```yaml
# .github/workflows/architecture-check.yml
name: Architecture Compliance
on: [push, pull_request]

jobs:
  boundary-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Check import boundaries
        run: npx eslint --rule 'boundaries/element-types: error' 'src/**/*.ts'

      - name: Run architecture tests
        run: npm run test:architecture

      - name: Check for cross-schema queries
        run: |
          # Fail if any module accesses another module's schema
          if grep -r "FROM ordering\." src/modules/catalog/ || \
             grep -r "FROM catalog\." src/modules/ordering/ || \
             grep -r "FROM billing\." src/modules/ordering/; then
            echo "VIOLATION: Cross-schema access detected!"
            exit 1
          fi
```

---

## 3. Defining Module Boundaries

### Step 1: Identify Business Capabilities

```
List what the business DOES (not what the code does):

E-Commerce Example:
  1. Manage product catalog (create, update, price, categorize)
  2. Process customer orders (cart, checkout, confirmation)
  3. Handle payments (charge, refund, dispute)
  4. Fulfill orders (pick, pack, ship, track)
  5. Manage customer accounts (register, profile, preferences)
  6. Send notifications (email, SMS, push)
  7. Provide analytics (sales reports, customer insights)
  8. Handle returns (authorize, receive, credit)
```

### Step 2: Group by Cohesion

```
Group capabilities that:
  - Change together (same team modifies them)
  - Use the same data (same entities, same tables)
  - Have the same lifecycle (created/updated/deleted together)
  - Share business rules (same invariants)

Result:
  Catalog Module:    Product management + Search
  Ordering Module:   Order processing + Cart
  Payment Module:    Payment handling
  Fulfillment Module: Order fulfillment + Tracking
  Identity Module:   Customer accounts
  Notification Module: All notifications
  Analytics Module:  All analytics (read-only)
  Returns Module:    Returns handling
```

### Step 3: Validate Boundaries

```
For EACH proposed module, verify:

1. Single Responsibility: Can I describe it in one sentence?
   ✅ "Ordering manages the order lifecycle from cart to confirmation"
   ❌ "Ordering manages orders, payments, and shipping"

2. Data Ownership: Does it own ALL data it writes?
   ✅ Ordering owns: orders, order_items, carts
   ❌ Ordering also writes to: products (catalog owns this!)

3. Minimal Dependencies: Does it depend on ≤ 2 other modules?
   ✅ Ordering depends on: Catalog (product info), Identity (customer)
   ❌ Ordering depends on: Catalog, Identity, Payment, Shipping, Tax, Analytics

4. Team Ownership: Can one team own it?
   ✅ The ordering team (4 people) owns this module
   ❌ Three teams need to modify this module regularly

5. Change Independence: Can it change without affecting other modules?
   ✅ New order status doesn't affect catalog or billing
   ❌ Adding a field to order requires changes in 3 other modules
```

---

## 4. Handling Cross-Cutting Concerns

### Authentication / Authorization

```typescript
// Auth is infrastructure, NOT a module dependency
// Use middleware, not module-to-module calls

// infrastructure/auth/auth.guard.ts
class AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;

    const user = await this.jwtService.verify(token);
    request.user = user; // Attach to request context
    return true;
  }
}

// Each module's controller uses the guard — no dependency on Identity module
@Controller('orders')
class OrderController {
  @Post()
  @UseGuards(AuthGuard) // Infrastructure concern, not module dependency
  async placeOrder(@CurrentUser() user: AuthUser, @Body() body: PlaceOrderRequest) {
    // user.id comes from auth middleware, not from Identity module
    return this.placeOrderHandler.execute({ customerId: user.id, ...body });
  }
}
```

### Logging / Monitoring

```typescript
// Cross-cutting: provided by infrastructure, used by all modules

// infrastructure/logging/logger.ts
class Logger {
  constructor(private readonly moduleName: string) {}

  info(message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({
      level: 'info', module: this.moduleName, message, ...data,
      timestamp: new Date().toISOString(),
    }));
  }
}

// Each module creates its own logger instance
// ordering/ordering.module.ts
const orderingLogger = new Logger('ordering');
```

---

## 5. Module Dependency Graph Rules

```
RULE: Module dependency graph MUST be a Directed Acyclic Graph (DAG)
      No circular dependencies between modules.

VALID:
  Ordering → Catalog (ordering reads product info)
  Ordering → Identity (ordering reads customer info)
  Billing → Ordering (billing reads order info for invoicing)
  Fulfillment → Ordering (fulfillment reads order for shipping)
  Notification → * (notification subscribes to events from all modules)

INVALID:
  Ordering → Billing → Ordering (circular!)
  FIX: Use events. Ordering publishes OrderPlaced, Billing subscribes.
       Billing publishes InvoicePaid, Ordering subscribes.
       No direct dependency in either direction.

VISUALIZATION:
  Identity ← Ordering → Catalog
                ↑
              Billing
                ↑
            Fulfillment

  Notification (subscribes to events from all — no direct deps)
  Analytics (subscribes to events from all — no direct deps)
```

---

## 6. Anti-Patterns

| Anti-Pattern | Detection | Fix |
|-------------|-----------|-----|
| **Boundary Erosion** | Lint warnings disabled, "just this once" imports | Zero tolerance policy, fail CI on violations |
| **Public API Bloat** | Module's Public API has 50+ methods | Split module or create focused sub-APIs |
| **Event Spaghetti** | Module subscribes to 20+ event types | Re-evaluate boundaries, too much coupling |
| **Distributed Monolith in a Process** | Modules are "independent" but always change together | Merge modules or redesign boundaries |
| **Boundary Only on Paper** | Architecture docs show boundaries but code doesn't enforce them | Add ESLint boundaries + CI checks |
| **Schema Leaking** | ORM auto-joins across module schemas | Remove cross-schema FKs, use separate ORM contexts |

---

## 7. Enforcement Checklist

- [ ] **Import rules in CI** — ESLint boundaries / import-linter / NetArchTest fails on violation
- [ ] **Schema isolation** — each module has its own database schema
- [ ] **No cross-schema FKs** — modules reference by ID, never foreign key
- [ ] **No cross-schema joins** — data from other modules via Public API
- [ ] **Public API facade** — each module has exactly one public API class
- [ ] **DTOs at boundary** — Public API uses DTOs, never domain entities
- [ ] **Event-driven cross-module** — async communication via event bus
- [ ] **DAG dependency graph** — no circular module dependencies
- [ ] **Module-level tests** — each module has independent test suite
- [ ] **Boundary erosion monitoring** — track import violations over time
