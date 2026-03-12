# Testing Directory Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "where should I put my tests?", "should tests be next to source files?", "how do I organize test fixtures?", or "what's the best test directory structure?", use this directive. Test organization is a STRUCTURAL decision that affects developer productivity, test discoverability, and maintenance burden. The wrong test structure leads to untested code, forgotten tests, and duplicated test utilities. Co-locate unit tests with source. Separate integration and e2e tests.

---

## 1. The Core Rule

**Unit tests MUST be co-located with the source files they test. Integration tests and e2e tests live in a dedicated top-level `tests/` directory. Test utilities, fixtures, and factories are shared from a central `testing/` directory. NEVER mirror your source tree in a separate test tree — it creates maintenance nightmares and orphaned tests.**

```
❌ WRONG: Mirror test tree (files drift apart, tests get orphaned)
src/
├── features/orders/orders.service.ts
├── features/users/users.service.ts
tests/
├── features/orders/orders.service.test.ts     ← Drift from source
├── features/users/users.service.test.ts       ← Easy to forget when moving files

✅ CORRECT: Co-located unit tests + dedicated integration tests
src/
├── features/orders/
│   ├── orders.service.ts
│   ├── orders.service.test.ts                 ← RIGHT NEXT TO source
│   └── orders.controller.ts
├── features/users/
│   ├── users.service.ts
│   └── users.service.test.ts
tests/
├── integration/                               ← Cross-cutting integration tests
│   └── order-flow.integration.test.ts
├── e2e/                                       ← End-to-end tests
│   └── checkout.e2e.test.ts
└── helpers/                                   ← Shared test utilities
    ├── factories/
    ├── fixtures/
    └── setup.ts
```

---

## 2. Test Types and Where They Live

```
┌──────────────────┬─────────────────────────┬─────────────────────────────┐
│ Test Type        │ Location                │ Naming Convention            │
├──────────────────┼─────────────────────────┼─────────────────────────────┤
│ Unit tests       │ Next to source file     │ *.test.ts, *.spec.ts        │
│ Component tests  │ Next to component file  │ Component.test.tsx          │
│ Integration tests│ tests/integration/      │ *.integration.test.ts       │
│ E2E tests        │ tests/e2e/ or e2e/      │ *.e2e.test.ts               │
│ API tests        │ tests/api/              │ *.api.test.ts               │
│ Performance tests│ tests/performance/      │ *.perf.test.ts              │
│ Contract tests   │ tests/contract/         │ *.contract.test.ts          │
│ Smoke tests      │ tests/smoke/            │ *.smoke.test.ts             │
│ Visual regression│ tests/visual/           │ *.visual.test.ts            │
│ Load tests       │ tests/load/             │ *.load.ts (k6, Artillery)   │
└──────────────────┴─────────────────────────┴─────────────────────────────┘

RULE: Only UNIT and COMPONENT tests are co-located.
      All other test types go in tests/ directory.
```

---

## 3. Complete Test Structure by Ecosystem

### TypeScript / Node.js (Jest/Vitest)

```
project/
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.service.test.ts           ← Unit test (co-located)
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.controller.test.ts        ← Unit test (co-located)
│   │   │   ├── auth.guard.ts
│   │   │   └── auth.guard.test.ts             ← Unit test (co-located)
│   │   └── orders/
│   │       ├── orders.service.ts
│   │       ├── orders.service.test.ts
│   │       ├── dto/
│   │       │   ├── create-order.dto.ts
│   │       │   └── create-order.dto.test.ts   ← DTO validation tests
│   │       └── orders.repository.ts
│   └── shared/
│       ├── utils/
│       │   ├── date.utils.ts
│       │   └── date.utils.test.ts
│       └── middleware/
│           ├── error-handler.ts
│           └── error-handler.test.ts
├── tests/
│   ├── integration/
│   │   ├── auth-flow.integration.test.ts      ← Tests auth → orders flow
│   │   ├── order-creation.integration.test.ts
│   │   └── payment-flow.integration.test.ts
│   ├── e2e/
│   │   ├── checkout.e2e.test.ts
│   │   ├── user-registration.e2e.test.ts
│   │   └── support/
│   │       ├── test-server.ts                 ← Spins up test app instance
│   │       └── seed-database.ts               ← Seeds test data
│   ├── helpers/
│   │   ├── factories/                         ← Test data factories
│   │   │   ├── user.factory.ts
│   │   │   ├── order.factory.ts
│   │   │   └── index.ts
│   │   ├── fixtures/                          ← Static test data
│   │   │   ├── valid-order.json
│   │   │   └── stripe-webhook-payload.json
│   │   ├── mocks/                             ← Manual mocks
│   │   │   ├── stripe.mock.ts
│   │   │   └── email-service.mock.ts
│   │   └── setup.ts                           ← Global test setup
│   └── __snapshots__/                         ← Jest snapshot files (auto)
├── jest.config.ts                             ← or vitest.config.ts
└── tsconfig.test.json                         ← TS config for tests
```

### React Frontend (Vitest + Playwright)

```
project/
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── LoginForm.test.tsx         ← Component unit test
│   │   │   │   └── LoginForm.stories.tsx      ← Storybook story
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── useAuth.test.ts            ← Hook unit test
│   │   │   └── api/
│   │   │       ├── auth.api.ts
│   │   │       └── auth.api.test.ts           ← API layer unit test (mocked)
│   │   └── dashboard/
│   │       ├── components/
│   │       │   ├── DashboardChart.tsx
│   │       │   └── DashboardChart.test.tsx
│   │       └── hooks/
│   ├── components/                            ← Shared UI components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── Button.stories.tsx
│   │   └── Modal/
│   │       ├── Modal.tsx
│   │       ├── Modal.test.tsx
│   │       └── Modal.stories.tsx
│   └── testing/                               ← Test utilities
│       ├── render.tsx                         ← Custom render with providers
│       ├── handlers.ts                        ← MSW request handlers
│       └── server.ts                          ← MSW server setup
├── e2e/                                       ← Playwright E2E tests
│   ├── auth.spec.ts
│   ├── checkout.spec.ts
│   ├── fixtures/
│   │   └── test-user.ts
│   └── pages/                                 ← Page Object Model
│       ├── login.page.ts
│       └── checkout.page.ts
├── vitest.config.ts
└── playwright.config.ts
```

### Python (pytest)

```
project/
├── src/
│   └── myapp/
│       ├── __init__.py
│       ├── orders/
│       │   ├── __init__.py
│       │   ├── service.py
│       │   ├── repository.py
│       │   └── models.py
│       └── users/
│           ├── __init__.py
│           ├── service.py
│           └── models.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py                            ← Root fixtures (shared)
│   ├── unit/
│   │   ├── __init__.py
│   │   ├── conftest.py                        ← Unit test fixtures
│   │   ├── orders/
│   │   │   ├── __init__.py
│   │   │   ├── test_service.py
│   │   │   └── test_repository.py
│   │   └── users/
│   │       ├── __init__.py
│   │       └── test_service.py
│   ├── integration/
│   │   ├── __init__.py
│   │   ├── conftest.py                        ← DB setup, API client
│   │   ├── test_order_flow.py
│   │   └── test_user_registration.py
│   ├── e2e/
│   │   ├── conftest.py
│   │   └── test_checkout_flow.py
│   ├── factories/                             ← Factory Boy factories
│   │   ├── __init__.py
│   │   ├── user_factory.py
│   │   └── order_factory.py
│   └── fixtures/                              ← Static test data
│       ├── valid_order.json
│       └── stripe_webhook.json
├── pyproject.toml                             ← pytest config
└── pytest.ini                                 ← or in pyproject.toml
```

```ini
# pyproject.toml — pytest configuration
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
markers = [
    "integration: integration tests (deselect with '-m not integration')",
    "e2e: end-to-end tests (deselect with '-m not e2e')",
    "slow: slow tests (deselect with '-m not slow')",
]
```

### Go

```
project/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── orders/
│   │   ├── service.go
│   │   ├── service_test.go                    ← Unit test (same package)
│   │   ├── repository.go
│   │   ├── repository_test.go
│   │   ├── handler.go
│   │   └── handler_test.go
│   └── users/
│       ├── service.go
│       ├── service_test.go
│       └── export_test.go                     ← Black-box test (package users_test)
├── test/                                      ← Integration/E2E tests
│   ├── integration/
│   │   ├── order_flow_test.go
│   │   └── testutil/                          ← Shared test utilities
│   │       ├── database.go
│   │       └── factory.go
│   └── e2e/
│       └── api_test.go
├── testdata/                                  ← Test fixtures (Go convention)
│   ├── golden/                                ← Golden file tests
│   │   ├── order_response.golden
│   │   └── user_response.golden
│   └── fixtures/
│       └── valid_order.json
└── go.test.env                                ← Test environment variables
```

```go
// Go convention: *_test.go in the same package for white-box tests
// Go convention: *_test.go in package_test for black-box tests
// Go convention: testdata/ directory is ignored by go build (special name)
// Go convention: TestMain(m *testing.M) for setup/teardown
```

### C# / .NET

```
MySolution/
├── src/
│   ├── MyApp.Api/
│   │   ├── Controllers/
│   │   │   └── OrderController.cs
│   │   └── MyApp.Api.csproj
│   ├── MyApp.Application/
│   │   ├── Orders/
│   │   │   ├── PlaceOrderCommand.cs
│   │   │   └── PlaceOrderHandler.cs
│   │   └── MyApp.Application.csproj
│   └── MyApp.Domain/
│       ├── Orders/
│       │   └── Order.cs
│       └── MyApp.Domain.csproj
├── tests/
│   ├── MyApp.Domain.Tests/                    ← Domain unit tests
│   │   ├── Orders/
│   │   │   └── OrderTests.cs
│   │   └── MyApp.Domain.Tests.csproj
│   ├── MyApp.Application.Tests/               ← Application unit tests
│   │   ├── Orders/
│   │   │   └── PlaceOrderHandlerTests.cs
│   │   └── MyApp.Application.Tests.csproj
│   ├── MyApp.Api.Tests/                       ← API integration tests
│   │   ├── Controllers/
│   │   │   └── OrderControllerTests.cs
│   │   ├── WebApplicationFactory.cs
│   │   └── MyApp.Api.Tests.csproj
│   └── MyApp.E2E.Tests/                       ← E2E with Playwright
│       ├── CheckoutTests.cs
│       └── MyApp.E2E.Tests.csproj
└── MySolution.sln
```

---

## 4. Test Utilities Organization

### Factories (Test Data Builders)

```typescript
// tests/helpers/factories/user.factory.ts
import { faker } from '@faker-js/faker';

interface UserOverrides {
  email?: string;
  name?: string;
  role?: 'admin' | 'user';
}

export function createUser(overrides: UserOverrides = {}): User {
  return {
    id: faker.string.uuid(),
    email: overrides.email ?? faker.internet.email(),
    name: overrides.name ?? faker.person.fullName(),
    role: overrides.role ?? 'user',
    createdAt: new Date(),
  };
}

export function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    items: [createOrderItem(), createOrderItem()],
    status: 'pending',
    totalAmount: faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    ...overrides,
  };
}
```

### Fixtures (Static Test Data)

```
tests/
├── fixtures/
│   ├── api-responses/
│   │   ├── stripe-payment-intent.json
│   │   ├── stripe-webhook-checkout.json
│   │   └── sendgrid-delivery-report.json
│   ├── csv/
│   │   ├── import-users-valid.csv
│   │   └── import-users-invalid.csv
│   └── images/
│       ├── valid-avatar.png
│       └── oversized-image.png
```

### Mocks

```typescript
// tests/helpers/mocks/stripe.mock.ts
export const mockStripe = {
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_test_123',
      status: 'succeeded',
      amount: 2000,
      currency: 'usd',
    }),
    retrieve: jest.fn(),
    cancel: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

// Usage in test:
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => mockStripe),
}));
```

### Custom Render (React)

```typescript
// src/testing/render.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { ThemeProvider } from '@/shared/theme';

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { renderWithProviders as render };
```

---

## 5. Test Configuration Files

```
project/
├── jest.config.ts                  ← Jest configuration
├── vitest.config.ts                ← Vitest configuration
├── playwright.config.ts            ← Playwright E2E configuration
├── .storybook/                     ← Storybook configuration
│   ├── main.ts
│   └── preview.ts
├── tsconfig.test.json              ← TypeScript config for tests
├── .env.test                       ← Test environment variables
└── setup-tests.ts                  ← Global test setup
```

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/*.test.ts',                          // Co-located unit tests
    '**/tests/**/*.test.ts',                  // Integration/E2E tests
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  setupFilesAfterSetup: ['<rootDir>/setup-tests.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['./setup-tests.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: { branches: 80, functions: 80, lines: 80 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
```

---

## 6. Running Tests by Type

```bash
# Run only unit tests (co-located with source)
npx vitest --dir src

# Run only integration tests
npx vitest --dir tests/integration

# Run only e2e tests
npx playwright test

# Run tests by marker/tag
pytest -m "not integration"              # Python: skip integration
go test ./internal/...                    # Go: only internal packages
dotnet test --filter "Category!=E2E"     # .NET: exclude E2E

# Run tests for a specific feature
npx vitest --dir src/features/orders     # All order tests
pytest tests/unit/orders/                 # Python: order unit tests
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Mirror test tree** | `tests/` mirrors `src/` exactly; renaming a file orphans its test | Co-locate unit tests with source |
| **No test type separation** | Unit, integration, and e2e tests mixed in one directory | Separate by type: unit (co-located), integration/e2e (tests/) |
| **Scattered fixtures** | Test data copied in every test file | Central `tests/fixtures/` or `tests/factories/` |
| **No custom render** | Every React test file sets up providers manually | Create `testing/render.tsx` with all providers |
| **Test utils in src/** | Test helpers imported in production code | Keep test utils in `tests/helpers/` or `src/testing/` |
| **Missing conftest/setup** | Database setup code duplicated across integration tests | Central setup in `conftest.py` or `setup-tests.ts` |
| **No test env config** | Tests use development database, destroying data | Separate `.env.test` with isolated test database |
| **Snapshot sprawl** | Hundreds of `.snap` files that nobody reviews | Use snapshots sparingly; prefer explicit assertions |
| **No coverage config** | Coverage includes test files and barrel files | Exclude `*.test.ts`, `index.ts`, `*.d.ts` from coverage |
| **Slow test feedback** | All tests run together, taking 10+ minutes | Separate fast (unit) from slow (integration/e2e) |

---

## 8. Enforcement Checklist

- [ ] **Unit tests co-located** — `*.test.ts` next to `*.ts` in source tree
- [ ] **Integration tests in tests/** — `tests/integration/` for cross-cutting tests
- [ ] **E2E tests separated** — `tests/e2e/` or `e2e/` with Playwright/Cypress config
- [ ] **Factories directory** — `tests/helpers/factories/` for test data builders
- [ ] **Fixtures directory** — `tests/helpers/fixtures/` for static test data
- [ ] **Mocks directory** — `tests/helpers/mocks/` for manual mock implementations
- [ ] **Custom render** — `testing/render.tsx` with all providers (React projects)
- [ ] **Test config files** — `jest.config.ts` or `vitest.config.ts` at project root
- [ ] **.env.test exists** — isolated test environment configuration
- [ ] **Coverage configured** — excludes test files, barrel files, type definitions
- [ ] **Test commands by type** — separate npm scripts for unit, integration, e2e
- [ ] **No test code in production** — test utilities NEVER imported in source files
