# Shared Code Organization — Complete Specification

> **AI Plugin Directive:** When a developer asks "where should I put shared utilities?", "how do I organize common code?", "should I use a utils/ folder?", "how do I share code between features?", or "how do I manage cross-cutting concerns?", use this directive. Shared code organization is one of the most common sources of architectural rot. A poorly managed `utils/` folder becomes a dumping ground that grows without bounds, creates tight coupling, and makes code impossible to extract. Shared code MUST be intentionally designed, minimally scoped, and organized by DOMAIN — never by technical type.

---

## 1. The Core Rule

**Shared code MUST be organized by DOMAIN or CAPABILITY, not as a catch-all `utils/` folder. Every shared module must have a clear owner, a defined public API, and explicit boundaries. Code should be shared ONLY when it is truly used by multiple features — duplication is preferable to premature abstraction. The threshold for extraction to shared is 3+ consumers.**

```
❌ WRONG: God folder with everything dumped in utils/
shared/
├── utils/
│   ├── helpers.ts              ← 2000 lines of random functions
│   ├── constants.ts            ← Every constant in the app
│   ├── types.ts                ← Every type in the app
│   ├── validators.ts           ← Validation for 10 different features
│   ├── formatters.ts           ← Date, currency, phone, address formatters
│   └── misc.ts                 ← "Miscellaneous" = admission of defeat

✅ CORRECT: Organized by domain/capability
shared/
├── date/
│   ├── format-date.ts
│   ├── parse-date.ts
│   └── date-ranges.ts
├── money/
│   ├── format-currency.ts
│   ├── money.ts
│   └── tax-calculation.ts
├── validation/
│   ├── email-validator.ts
│   ├── phone-validator.ts
│   └── url-validator.ts
├── http/
│   ├── http-client.ts
│   ├── interceptors.ts
│   └── error-handler.ts
└── types/
    ├── pagination.ts
    └── api-response.ts
```

---

## 2. The Sharing Decision Tree

```
START: You have code that MIGHT be shared between features.

Step 1: How many features use this code RIGHT NOW?
│
├── 1 feature → KEEP it in that feature. Do NOT extract.
│   Even if you "think" other features will need it.
│   Premature extraction creates premature coupling.
│
├── 2 features → CONSIDER extraction, but prefer duplication.
│   Duplication of 5-10 lines is cheaper than a wrong abstraction.
│   If the code is identical and unlikely to diverge → extract.
│   If the code is similar but might diverge → duplicate.
│
└── 3+ features → EXTRACT to shared/
    Now you have evidence that this is truly shared.
    Create a dedicated module with a clear public API.

RULE: The Rule of Three — don't abstract until you have 3 consumers.
RULE: Duplication is far cheaper than the wrong abstraction.
      (Sandi Metz: "Duplication is far cheaper than the wrong abstraction")
```

---

## 3. Shared Code Categories

### Category 1: Shared Utilities (Pure Functions)

```typescript
// shared/date/format-date.ts
// Pure functions with no side effects, no dependencies on application state

export function formatDate(date: Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

### Category 2: Shared Types/Interfaces

```typescript
// shared/types/pagination.ts
export interface PaginatedRequest {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// shared/types/api-response.ts
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
```

### Category 3: Shared Infrastructure (HTTP, Auth, Logging)

```typescript
// shared/http/http-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export function createHttpClient(config: AxiosRequestConfig): AxiosInstance {
  const client = axios.create({
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
    ...config,
  });

  // Request interceptor: add auth token
  client.interceptors.request.use((req) => {
    const token = getAccessToken();
    if (token) req.headers.Authorization = `Bearer ${token}`;
    return req;
  });

  // Response interceptor: handle errors
  client.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error.response?.status === 401) {
        // Trigger token refresh or logout
      }
      return Promise.reject(error);
    },
  );

  return client;
}
```

### Category 4: Shared UI Components (Frontend)

```
shared/
├── components/
│   ├── ui/                         ← Atomic UI primitives
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.stories.tsx
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Modal/
│   │   ├── DataTable/
│   │   └── index.ts               ← Barrel export for all UI components
│   ├── layouts/                    ← Page layout components
│   │   ├── MainLayout.tsx
│   │   ├── AuthLayout.tsx
│   │   └── DashboardLayout.tsx
│   └── feedback/                   ← Toast, Alert, Loading components
│       ├── Toast/
│       ├── Alert/
│       └── Spinner/
├── hooks/                          ← Shared React hooks
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useMediaQuery.ts
│   └── useInfiniteScroll.ts
└── providers/                      ← React context providers
    ├── ThemeProvider.tsx
    └── ToastProvider.tsx
```

---

## 4. Cross-Cutting Concerns

### Where Cross-Cutting Code Lives

```
┌──────────────────────┬───────────────────────────────────────────┐
│ Concern              │ Location                                   │
├──────────────────────┼───────────────────────────────────────────┤
│ Authentication       │ shared/auth/ or infrastructure/auth/       │
│ Authorization        │ shared/auth/guards/ or middleware/          │
│ Logging              │ shared/logging/ or infrastructure/logging/  │
│ Error handling       │ shared/errors/ or middleware/               │
│ Caching              │ shared/cache/ or infrastructure/cache/      │
│ Rate limiting        │ middleware/rate-limiter/                     │
│ Request validation   │ shared/validation/ or middleware/           │
│ Internationalization │ shared/i18n/                                │
│ Telemetry/metrics    │ shared/telemetry/ or infrastructure/        │
│ Event bus            │ shared/events/ or infrastructure/events/    │
└──────────────────────┴───────────────────────────────────────────┘
```

### Error Handling as Shared Code

```typescript
// shared/errors/app-error.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} with id ${id} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(details: Record<string, string[]>) {
    super('VALIDATION_ERROR', 'Validation failed', 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

// shared/errors/error-handler.middleware.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Unknown error — log and return generic message
  logger.error('Unhandled error', { error: err });
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
```

---

## 5. Internal Packages (Monorepo)

### When to Use Internal Packages

```
Feature-local code:
  src/features/orders/utils.ts          ← Used ONLY by orders feature

Shared directory:
  src/shared/date/format-date.ts        ← Used by multiple features in same app

Internal package:
  packages/shared-utils/src/date.ts     ← Used by multiple APPS in monorepo

Published package:
  Published to npm/PyPI                 ← Used by EXTERNAL consumers

Progression: feature-local → shared/ → internal package → published package
Each level increases maintenance cost but also reuse scope.
```

### Internal Package Structure

```
packages/
├── shared-utils/
│   ├── src/
│   │   ├── date/
│   │   │   ├── format-date.ts
│   │   │   └── index.ts
│   │   ├── money/
│   │   │   ├── format-currency.ts
│   │   │   └── index.ts
│   │   └── index.ts                ← Package barrel file
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── ui/
│   ├── src/
│   │   ├── Button/
│   │   ├── Modal/
│   │   └── index.ts
│   ├── package.json
│   └── README.md
└── config/
    ├── eslint/
    │   ├── base.js
    │   └── react.js
    ├── typescript/
    │   └── base.json
    └── package.json
```

```json
// packages/shared-utils/package.json
{
  "name": "@myorg/shared-utils",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./date": "./src/date/index.ts",
    "./money": "./src/money/index.ts"
  }
}

// apps/web/package.json
{
  "dependencies": {
    "@myorg/shared-utils": "workspace:*",
    "@myorg/ui": "workspace:*"
  }
}
```

---

## 6. Python Shared Code

```
# Python shared code patterns

# Pattern 1: Shared module within the application
src/
├── myapp/
│   ├── features/
│   │   ├── orders/
│   │   └── users/
│   ├── shared/                     ← Shared within the app
│   │   ├── __init__.py
│   │   ├── pagination.py
│   │   ├── auth.py
│   │   └── exceptions.py
│   └── __init__.py

# Pattern 2: Internal package in monorepo
packages/
├── shared-utils/
│   ├── src/
│   │   └── shared_utils/
│   │       ├── __init__.py
│   │       ├── date_utils.py
│   │       └── money.py
│   └── pyproject.toml
apps/
├── api/
│   ├── pyproject.toml              ← depends on shared-utils
│   └── src/
└── worker/
    ├── pyproject.toml              ← depends on shared-utils
    └── src/
```

---

## 7. Go Shared Code

```
# Go uses internal/ for shared code that shouldn't be importable externally

project/
├── cmd/
│   ├── api/
│   │   └── main.go
│   └── worker/
│       └── main.go
├── internal/                       ← Shared within this module ONLY
│   ├── auth/                       ← Shared auth logic
│   │   ├── jwt.go
│   │   └── middleware.go
│   ├── database/                   ← Shared DB connection
│   │   └── postgres.go
│   └── errors/                     ← Shared error types
│       └── app_error.go
├── pkg/                            ← Importable by external modules
│   ├── httpclient/
│   │   └── client.go
│   └── validator/
│       └── email.go
└── go.mod

# RULE: internal/ = shared within this Go module, NOT importable externally
# RULE: pkg/ = importable by anyone (use sparingly, it's a public API)
# RULE: Go enforces internal/ at compile time — external imports are rejected
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **God utils/ folder** | 50+ unrelated functions in utils.ts or helpers.ts | Split by domain: date/, money/, validation/, http/ |
| **Premature extraction** | Shared code used by only 1 feature | Keep in feature until 3+ consumers need it |
| **Wrong abstraction** | Shared function has 10 parameters and 15 if-branches | Delete it. Let features own their specific logic |
| **Circular dependencies** | shared/ imports from features/, features/ import from shared/ | shared/ NEVER imports from features/. One-way dependency only |
| **No public API** | External code imports internal implementation details | Barrel file (index.ts) defines public API |
| **Shared state** | Global mutable state in shared module | Shared code is stateless. State belongs to features |
| **Kitchen sink package** | One @myorg/shared package with everything | Split: @myorg/ui, @myorg/utils, @myorg/config |
| **Copy-paste instead of sharing** | Same validation logic copied in 8 features | Extract to shared/ when 3+ features need it |
| **Shared code not tested** | Shared utilities have no unit tests | Shared code MUST have 100% test coverage |
| **No ownership** | Nobody maintains shared code, it rots | Every shared module has an owner (CODEOWNERS) |

---

## 9. Enforcement Checklist

- [ ] **No god folders** — no `utils/`, `helpers/`, `common/` with 20+ unrelated items
- [ ] **Organized by domain** — shared code grouped by capability (date, money, auth)
- [ ] **Rule of Three** — code extracted to shared only when 3+ features use it
- [ ] **One-way dependency** — shared/ never imports from features/
- [ ] **Barrel files** — each shared module has index.ts defining its public API
- [ ] **Stateless shared code** — shared modules have no global mutable state
- [ ] **100% test coverage** — all shared utilities have comprehensive unit tests
- [ ] **CODEOWNERS defined** — every shared module has an assigned owner
- [ ] **README per shared module** — documents purpose, API, and usage examples
- [ ] **Internal packages for monorepo** — workspace protocol for cross-app sharing
- [ ] **No circular dependencies** — enforced by ESLint boundaries or equivalent
- [ ] **Cross-cutting concerns separated** — auth, logging, errors in dedicated modules
