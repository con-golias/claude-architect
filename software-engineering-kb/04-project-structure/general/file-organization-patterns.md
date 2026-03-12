# File Organization Patterns — Complete Specification

> **AI Plugin Directive:** When a developer asks "how should I organize my files?" or "should I use feature folders or layer folders?", use this directive to provide the CORRECT answer based on their project size, team size, and technology. File organization is the FIRST architectural decision in any project — it determines how easy the codebase is to navigate, maintain, and scale. There are exactly 4 major patterns. Choose ONE as your primary strategy and apply it CONSISTENTLY.

---

## 1. The Core Rule

**Organize by FEATURE (vertical slicing) as the DEFAULT for any project with more than 10 files. Layer-based organization is acceptable ONLY for small projects or within a feature folder. NEVER mix organizational strategies at the same directory level — pick ONE pattern and enforce it project-wide.**

```
❌ WRONG: Mixed organization at the same level
src/
├── controllers/          ← Layer-based
├── features/             ← Feature-based
│   └── auth/
├── services/             ← Layer-based again
├── user/                 ← Feature-based again
└── utils/                ← Neither

✅ CORRECT: Consistent feature-first organization
src/
├── features/
│   ├── auth/
│   ├── orders/
│   ├── products/
│   └── users/
├── shared/
└── app/
```

---

## 2. The Four Patterns

### Pattern 1: Layer-First (Horizontal Slicing)

```
src/
├── controllers/
│   ├── user.controller.ts
│   ├── order.controller.ts
│   └── product.controller.ts
├── services/
│   ├── user.service.ts
│   ├── order.service.ts
│   └── product.service.ts
├── repositories/
│   ├── user.repository.ts
│   ├── order.repository.ts
│   └── product.repository.ts
├── models/
│   ├── user.model.ts
│   ├── order.model.ts
│   └── product.model.ts
├── middleware/
│   ├── auth.middleware.ts
│   └── logging.middleware.ts
└── utils/
    ├── validators.ts
    └── helpers.ts
```

**USE WHEN:**
- Project has < 15 files total
- Single developer, prototype or POC
- Simple CRUD with no complex business logic
- Learning project or tutorial

**NEVER USE WHEN:**
- Team > 2 developers
- Project will grow beyond MVP
- Multiple business domains exist
- You need to extract modules later

**WHY IT FAILS AT SCALE:**
To implement ONE feature (e.g., "add order cancellation"), you touch files in controllers/, services/, repositories/, models/, and utils/. With 50+ files per layer, finding the right files becomes a scavenger hunt.

```
Adding "order cancellation" requires editing:
  controllers/order.controller.ts       ← 1 of 50 controller files
  services/order.service.ts             ← 1 of 50 service files
  repositories/order.repository.ts      ← 1 of 50 repository files
  models/order.model.ts                 ← 1 of 50 model files
  validators/order.validator.ts         ← 1 of 50 validator files

5 files across 5 directories — constant context switching
```

### Pattern 2: Feature-First (Vertical Slicing) — THE DEFAULT

```
src/
├── features/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.model.ts
│   │   ├── auth.middleware.ts
│   │   ├── auth.validator.ts
│   │   ├── auth.types.ts
│   │   ├── auth.routes.ts
│   │   └── __tests__/
│   │       ├── auth.service.test.ts
│   │       └── auth.controller.test.ts
│   ├── orders/
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   ├── orders.repository.ts
│   │   ├── orders.model.ts
│   │   ├── orders.types.ts
│   │   ├── orders.routes.ts
│   │   ├── dto/
│   │   │   ├── create-order.dto.ts
│   │   │   └── order-response.dto.ts
│   │   └── __tests__/
│   │       ├── orders.service.test.ts
│   │       └── orders.controller.test.ts
│   ├── products/
│   │   └── ...
│   └── users/
│       └── ...
├── shared/
│   ├── middleware/
│   │   ├── error-handler.middleware.ts
│   │   └── request-logger.middleware.ts
│   ├── database/
│   │   ├── connection.ts
│   │   └── migrations/
│   ├── types/
│   │   ├── pagination.ts
│   │   └── api-response.ts
│   └── utils/
│       ├── date.utils.ts
│       └── string.utils.ts
└── app.ts
```

**USE WHEN:**
- ANY project with > 15 files (this is the DEFAULT)
- Team ≥ 2 developers
- Multiple business features/domains
- Project expected to grow
- You want easy feature extraction later

**WHY IT WORKS:**
Adding "order cancellation" means touching files in ONE directory:

```
Adding "order cancellation" — ALL changes in one place:
  features/orders/orders.controller.ts    ← Add endpoint
  features/orders/orders.service.ts       ← Add business logic
  features/orders/orders.repository.ts    ← Add query
  features/orders/dto/cancel-order.dto.ts ← Add DTO
  features/orders/__tests__/orders.service.test.ts ← Add test

5 files in 1 directory — zero context switching
```

### Pattern 3: Domain-First (DDD Alignment)

```
src/
├── modules/
│   ├── ordering/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── order.ts
│   │   │   │   └── order-item.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── order-id.ts
│   │   │   │   └── money.ts
│   │   │   ├── events/
│   │   │   │   └── order-placed.event.ts
│   │   │   └── ports/
│   │   │       └── order.repository.ts
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   ├── place-order.handler.ts
│   │   │   │   └── cancel-order.handler.ts
│   │   │   └── queries/
│   │   │       └── get-order.handler.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   └── postgres-order.repository.ts
│   │   │   └── adapters/
│   │   │       └── payment-gateway.adapter.ts
│   │   └── api/
│   │       ├── order.controller.ts
│   │       └── order.validator.ts
│   ├── catalog/
│   │   └── ... (same layered structure)
│   └── billing/
│       └── ... (same layered structure)
├── shared-kernel/
│   ├── value-objects/
│   ├── events/
│   └── types/
└── infrastructure/
    ├── database/
    ├── auth/
    └── logging/
```

**USE WHEN:**
- Complex business domain with multiple bounded contexts
- Team > 5 developers working on different domains
- Enterprise application with rich business logic
- Clean Architecture / Hexagonal Architecture applied
- Long-lived product (2+ years expected lifecycle)

**NEVER USE WHEN:**
- Simple CRUD application
- Team < 3 developers
- No complex business rules
- Startup MVP — over-engineering kills speed

### Pattern 4: Hybrid (Feature + Layer)

```
src/
├── features/
│   ├── auth/
│   │   ├── components/        ← UI components (frontend)
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── hooks/             ← React hooks
│   │   │   ├── useAuth.ts
│   │   │   └── useLogin.ts
│   │   ├── api/               ← API calls
│   │   │   └── auth.api.ts
│   │   ├── store/             ← State management
│   │   │   └── auth.slice.ts
│   │   ├── types/
│   │   │   └── auth.types.ts
│   │   └── __tests__/
│   ├── dashboard/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── store/
│   │   └── types/
│   └── orders/
│       └── ...
├── shared/
│   ├── components/            ← Reusable UI components
│   │   ├── Button/
│   │   ├── Modal/
│   │   └── DataTable/
│   ├── hooks/                 ← Shared hooks
│   ├── api/                   ← API client setup
│   ├── store/                 ← Root store setup
│   └── utils/
└── app/
    ├── routes.tsx
    ├── App.tsx
    └── providers.tsx
```

**USE WHEN:**
- Frontend applications (React, Vue, Angular)
- Features have internal layering (components, hooks, API, state)
- Medium-to-large frontend projects
- This is the RECOMMENDED pattern for modern frontend apps

---

## 3. Decision Tree — Which Pattern to Choose

```
START: How many source files does your project have?
│
├── < 15 files
│   └── USE: Layer-First (Pattern 1)
│       Simple and sufficient for small projects
│
├── 15-100 files
│   ├── Is it a frontend app (React/Vue/Angular)?
│   │   ├── YES → USE: Hybrid (Pattern 4)
│   │   └── NO → USE: Feature-First (Pattern 2)
│   │
│   └── Do you have complex business domains?
│       ├── YES → USE: Domain-First (Pattern 3)
│       └── NO → USE: Feature-First (Pattern 2)
│
└── 100+ files
    ├── Is it an enterprise app with bounded contexts?
    │   ├── YES → USE: Domain-First (Pattern 3)
    │   └── NO → USE: Feature-First (Pattern 2)
    │
    └── Do you need Clean Architecture enforcement?
        ├── YES → USE: Domain-First (Pattern 3)
        └── NO → USE: Feature-First (Pattern 2)

DEFAULT: When in doubt, use Feature-First (Pattern 2).
It scales from 15 to 1000+ files without restructuring.
```

---

## 4. Pattern Comparison Matrix

```
┌──────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Aspect               │ Layer-First  │ Feature-First│ Domain-First │ Hybrid       │
├──────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ File count sweet spot│ < 15         │ 15–500+      │ 50–1000+     │ 30–500+      │
│ Team size            │ 1 dev        │ 2–20 devs    │ 5–100+ devs  │ 2–20 devs    │
│ Learning curve       │ ★☆☆☆☆       │ ★★☆☆☆       │ ★★★★☆       │ ★★★☆☆       │
│ Navigability         │ Poor at scale│ Excellent    │ Excellent    │ Good         │
│ Feature isolation    │ None         │ Good         │ Excellent    │ Good         │
│ Module extraction    │ Very hard    │ Easy         │ Very easy    │ Moderate     │
│ Merge conflicts      │ Frequent     │ Rare         │ Very rare    │ Rare         │
│ Best for             │ Prototypes   │ Most apps    │ Enterprise   │ Frontend apps│
│ Refactoring cost     │ ★★★★★       │ ★★☆☆☆       │ ★☆☆☆☆       │ ★★★☆☆       │
│ Framework examples   │ Express gen  │ NestJS, Next │ DDD projects │ Bulletproof  │
└──────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 5. Co-location Rules

**RULE: Files that change together MUST live together.**

### Co-located Test Files

```
✅ CORRECT: Tests next to source
features/
├── orders/
│   ├── orders.service.ts
│   ├── orders.service.test.ts        ← Right next to the source
│   ├── orders.controller.ts
│   └── orders.controller.test.ts

✅ ALSO CORRECT: Tests in __tests__ subfolder within feature
features/
├── orders/
│   ├── orders.service.ts
│   ├── orders.controller.ts
│   └── __tests__/
│       ├── orders.service.test.ts
│       └── orders.controller.test.ts

❌ WRONG: Tests in a separate root directory
src/
├── features/orders/orders.service.ts
tests/
├── features/orders/orders.service.test.ts   ← Mirror structure = maintenance nightmare
```

### Co-located Component Files (Frontend)

```
✅ CORRECT: All related files together
components/
├── UserProfile/
│   ├── UserProfile.tsx                ← Component
│   ├── UserProfile.test.tsx           ← Unit test
│   ├── UserProfile.stories.tsx        ← Storybook
│   ├── UserProfile.module.css         ← Styles
│   └── index.ts                       ← Re-export

❌ WRONG: Files scattered by type
components/
├── UserProfile.tsx
styles/
├── UserProfile.module.css
stories/
├── UserProfile.stories.tsx
tests/
├── UserProfile.test.tsx
```

### Co-located Types

```
✅ CORRECT: Types within the feature they belong to
features/orders/
├── orders.types.ts           ← Types ONLY used by orders
├── orders.service.ts         ← Uses orders.types.ts
└── orders.controller.ts

shared/types/
├── pagination.ts             ← Types shared across features
└── api-response.ts

❌ WRONG: All types in a global types/ folder
types/
├── order.types.ts            ← Used only by orders feature
├── user.types.ts             ← Used only by users feature
├── product.types.ts          ← Used only by products feature
└── shared.types.ts
```

---

## 6. Barrel Files (Index Files)

### When to Use

```typescript
// A barrel file re-exports from a directory, creating a clean public API
// features/orders/index.ts
export { OrdersService } from './orders.service';
export { OrdersController } from './orders.controller';
export { CreateOrderDto, OrderResponseDto } from './dto';
export type { Order, OrderStatus } from './orders.types';

// Consumer imports from the barrel — clean, stable path
import { OrdersService, CreateOrderDto } from '@/features/orders';
```

**USE barrel files WHEN:**
- You want to define a module's public API
- You need to hide internal implementation details
- You want stable import paths that don't break during refactoring

**DO NOT USE barrel files WHEN:**
- Using Vite/Webpack with tree-shaking — barrel files can prevent dead code elimination
- In very large projects (1000+ modules) — can cause circular dependency issues
- In test files — import the actual file directly

### Barrel File Performance Warning

```typescript
// ⚠️ DANGER: Barrel files can kill bundle size and startup time

// If features/index.ts re-exports EVERYTHING:
export * from './auth';
export * from './orders';
export * from './products';
export * from './users';
export * from './dashboard';
export * from './reports';

// Then this import:
import { OrdersService } from '@/features';
// Pulls in ALL features, not just orders — tree-shaking may not help

// ✅ FIX: Import from the specific feature barrel
import { OrdersService } from '@/features/orders';
// Only imports orders module

// ✅ FIX: Use per-feature barrels, NEVER create a root barrel for all features
```

---

## 7. Flat vs Nested Structures

### The Depth Rule

```
RULE: Maximum directory depth is 4 levels from src/.
      If you need more, your module is too big — split it.

✅ CORRECT: 4 levels max
src/features/orders/dto/create-order.dto.ts    ← 4 levels: features > orders > dto > file

❌ WRONG: 7+ levels deep
src/modules/ordering/domain/entities/value-objects/types/order-id.type.ts
                                                              ← Lost in the labyrinth
```

### When to Flatten

```
RULE: If a directory has only 1-2 files, merge it up.

❌ WRONG: Unnecessary nesting
features/
├── orders/
│   ├── validators/
│   │   └── order.validator.ts         ← Only 1 file in validators/
│   └── mappers/
│       └── order.mapper.ts            ← Only 1 file in mappers/

✅ CORRECT: Flattened
features/
├── orders/
│   ├── order.validator.ts
│   └── order.mapper.ts

EXCEPTION: If you KNOW more files will be added soon (e.g., validators/ will
have 5+ validators), create the directory proactively.
```

### When to Nest

```
RULE: Create a subdirectory when a group has 5+ files of the same type.

✅ CORRECT: Nesting with 5+ files
features/
├── orders/
│   ├── dto/                           ← 5 DTOs = justify a subfolder
│   │   ├── create-order.dto.ts
│   │   ├── update-order.dto.ts
│   │   ├── cancel-order.dto.ts
│   │   ├── order-response.dto.ts
│   │   └── order-list.dto.ts
│   ├── orders.controller.ts
│   └── orders.service.ts
```

---

## 8. Screaming Architecture

**RULE: Your folder structure should SCREAM what the application does, not what framework it uses.**

```
❌ WRONG: Screams "I use NestJS!"
src/
├── controllers/
├── services/
├── guards/
├── interceptors/
├── pipes/
├── decorators/
└── entities/
// Looking at this, you know the FRAMEWORK but not the BUSINESS

✅ CORRECT: Screams "I'm an e-commerce app!"
src/
├── ordering/
├── catalog/
├── payments/
├── shipping/
├── customers/
├── inventory/
└── notifications/
// Looking at this, you know the BUSINESS even without reading code
```

Robert C. Martin's test: **"Can a new developer understand what the application DOES by looking at the top-level folder structure?"**

- If they see `controllers/`, `services/`, `repositories/` → They know the framework. **FAIL.**
- If they see `ordering/`, `catalog/`, `payments/` → They know the business. **PASS.**

---

## 9. Migration Strategies

### From Layer-First to Feature-First

```
STEP 1: Create the target feature directories
  mkdir -p src/features/{auth,orders,products,users}

STEP 2: Move files feature by feature (NOT layer by layer)
  Pick ONE feature (e.g., orders):
    mv src/controllers/order.controller.ts → src/features/orders/
    mv src/services/order.service.ts → src/features/orders/
    mv src/repositories/order.repository.ts → src/features/orders/
    mv src/models/order.model.ts → src/features/orders/

STEP 3: Update imports in moved files
  Change: import { OrderService } from '../services/order.service'
  To:     import { OrderService } from './order.service'

STEP 4: Create barrel file
  src/features/orders/index.ts → re-export public API

STEP 5: Update external imports
  Change: import { OrderService } from '@/services/order.service'
  To:     import { OrderService } from '@/features/orders'

STEP 6: Repeat for next feature

RULE: Migrate ONE feature at a time. NEVER restructure everything at once.
Both old and new structures can coexist during migration.
```

### Cost of Migration by Project Size

```
┌─────────────┬────────────────┬───────────────────────────────┐
│ Project Size │ Migration Cost │ Recommendation                │
├─────────────┼────────────────┼───────────────────────────────┤
│ < 50 files  │ 1-2 hours      │ DO IT — pay the cost now      │
│ 50-200 files│ 1-3 days       │ DO IT — cost grows exponentially│
│ 200-500 files│ 1-2 weeks     │ Migrate incrementally per feature│
│ 500+ files  │ 1-3 months     │ Only if there's a business case│
└─────────────┴────────────────┴───────────────────────────────┘
```

---

## 10. Real-World Examples

### Bulletproof React (Feature-First + Hybrid)

```
src/
├── app/                    ← App-wide setup
│   ├── routes/
│   ├── provider.tsx
│   └── main.tsx
├── features/               ← Feature modules
│   ├── auth/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── types/
│   │   └── index.ts
│   ├── discussions/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.ts
│   └── teams/
│       └── ...
├── components/             ← Shared UI components
│   ├── ui/
│   ├── layouts/
│   └── seo/
├── hooks/                  ← Shared hooks
├── lib/                    ← Third-party wrappers
├── stores/                 ← Global stores
├── testing/                ← Test utilities
├── types/                  ← Shared types
└── utils/                  ← Shared utilities
```

### NestJS Enterprise (Domain-First)

```
src/
├── modules/
│   ├── iam/                ← Identity & Access Management
│   │   ├── authentication/
│   │   ├── authorization/
│   │   └── iam.module.ts
│   ├── ordering/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── ordering.module.ts
│   └── catalog/
│       └── ...
├── shared/
│   ├── domain/
│   │   ├── aggregate-root.ts
│   │   └── domain-event.ts
│   └── infrastructure/
│       ├── database.module.ts
│       └── event-bus.module.ts
└── main.ts
```

### Django (App-Based Feature-First)

```python
# Django's "app" pattern IS feature-first organization

project/
├── manage.py
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── orders/             ← Feature = Django app
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── signals.py
│   │   ├── tasks.py
│   │   └── tests/
│   │       ├── test_models.py
│   │       └── test_views.py
│   ├── products/
│   │   └── ...
│   └── users/
│       └── ...
├── common/                 ← Shared utilities
│   ├── models.py
│   ├── permissions.py
│   └── pagination.py
└── requirements/
    ├── base.txt
    ├── local.txt
    └── production.txt
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **God Folder** | `utils/` or `helpers/` with 50+ unrelated files | Split by domain: each feature gets its own utils |
| **Mirror Test Structure** | `tests/` directory mirrors `src/` exactly | Co-locate tests next to source files |
| **Premature Nesting** | Directories with 1-2 files each | Flatten until 5+ files justify nesting |
| **Mixed Strategy** | Layer folders AND feature folders at same level | Pick ONE strategy per directory level |
| **Framework Screaming** | Top-level reveals framework, not business | Rename to business capabilities |
| **Global Types Dump** | Single `types/` folder with all project types | Co-locate types with their feature |
| **Deep Nesting** | 7+ levels of directories | Max 4 levels from src/; split large modules |
| **No Barrel Files** | External consumers import deep internal paths | Add index.ts per feature to define public API |
| **Root-Level Barrel** | Single index.ts re-exports entire project | Per-feature barrels only, never a root barrel |
| **Empty Directories** | Placeholder directories "for the future" | Create directories when first file is needed |

---

## 12. Enforcement Checklist

- [ ] **Single strategy per level** — one organizational pattern at each directory depth
- [ ] **Feature-first by default** — unless project has < 15 files
- [ ] **Co-located tests** — test files live next to source, not in separate tree
- [ ] **Co-located types** — types live with their feature, not in global types/
- [ ] **Max 4 levels deep** — from src/ to file, never more than 4 directories
- [ ] **5+ files to nest** — don't create subdirectory until there are 5+ files
- [ ] **1-2 files flatten** — merge directories that have only 1-2 files
- [ ] **Screaming architecture** — top-level folders reveal business capabilities
- [ ] **Per-feature barrels** — each feature has index.ts defining public API
- [ ] **No god folders** — no utils/, helpers/, or common/ with 50+ unrelated files
- [ ] **No mirror test tree** — tests/ directory never mirrors src/ structure
- [ ] **Migration plan exists** — if layer-first today, migration path is documented
