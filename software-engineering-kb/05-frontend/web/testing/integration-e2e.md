# Integration & E2E Testing — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to write E2E tests?", "Playwright vs Cypress?", "end-to-end testing strategy", "page object model", "test flakiness", "E2E in CI/CD", "integration testing frontend", "browser testing automation", "API testing with Playwright", or any integration/E2E testing question, ALWAYS consult this directive. E2E tests validate complete user flows through the real application. Integration tests verify that multiple units work together correctly. ALWAYS prefer Playwright for new projects — faster, multi-browser, better auto-waiting. NEVER write E2E tests for logic that can be unit tested. EVERY E2E test must represent a real user journey.

**Core Rule: E2E tests MUST validate real user journeys — login, purchase, onboard — NOT individual components. Use Playwright as the default E2E framework — it has superior auto-waiting, multi-browser support, and parallel execution. EVERY E2E test must be deterministic: mock external services, use stable selectors (role > test-id > CSS), seed test data, and isolate tests from each other. If a test is flaky, FIX it or DELETE it — flaky tests erode trust faster than missing tests.**

---

## 1. Testing Pyramid Strategy

```
  TESTING PYRAMID — WHERE E2E FITS

                    ╱╲
                   ╱  ╲
                  ╱ E2E╲           5-10% of tests
                 ╱      ╲         • Real user journeys
                ╱────────╲        • Slow, expensive
               ╱          ╲       • Run on CI, not every save
              ╱ Integration ╲      15-25% of tests
             ╱              ╲     • Multiple units together
            ╱────────────────╲    • API + Component combined
           ╱                  ╲
          ╱    Unit Tests      ╲   65-80% of tests
         ╱                      ╲ • Fast, isolated
        ╱────────────────────────╲• Run on every save
       ╱                          ╲
      ╱     Static Analysis        ╲  TypeScript, ESLint
     ╱──────────────────────────────╲

  RULE: Push tests DOWN the pyramid whenever possible.
  If you can test it with a unit test, do NOT write an E2E test.

  ┌──────────────────────────────────────────────────────┐
  │  WHAT TO TEST AT EACH LEVEL:                         │
  │                                                      │
  │  E2E:         Login → Browse → Add to Cart → Pay     │
  │  Integration: Form submission → API call → Success   │
  │  Unit:        formatPrice(1234) → "$1,234.00"        │
  │  Static:      TypeScript catches wrong argument type │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Integration vs E2E Boundary

| Aspect | Integration Test | E2E Test |
|---|---|---|
| **Scope** | Multiple components + hooks + API layer | Full app through browser |
| **Browser** | jsdom (simulated) | Real browser (Chromium/Firefox/WebKit) |
| **API** | Mocked (MSW) | Real or mocked at network level |
| **Speed** | 10-100ms per test | 1-10 seconds per test |
| **Reliability** | Highly stable | Can be flaky (timing, network) |
| **When to use** | Form submissions, multi-step UI flows | Critical paths: auth, checkout, onboarding |
| **Runner** | Vitest + Testing Library | Playwright or Cypress |

---

## 2. Playwright — Modern E2E Framework

```
  PLAYWRIGHT ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │  TEST RUNNER (Node.js)                                │
  │  ┌──────────────────────────────────────────────┐     │
  │  │  test('user can login', async ({ page }) => {│     │
  │  │    await page.goto('/login');                 │     │
  │  │    await page.getByLabel('Email').fill(...);  │     │
  │  │    await page.getByRole('button').click();    │     │
  │  │    await expect(page).toHaveURL('/dashboard');│     │
  │  │  });                                         │     │
  │  └───────────────────┬──────────────────────────┘     │
  │                      │ WebSocket (CDP / custom)       │
  │  ┌───────────────────▼──────────────────────────┐     │
  │  │           BROWSER CONTEXTS                    │     │
  │  │                                               │     │
  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │     │
  │  │  │ Chromium │ │ Firefox  │ │ WebKit   │      │     │
  │  │  │          │ │          │ │ (Safari) │      │     │
  │  │  └──────────┘ └──────────┘ └──────────┘      │     │
  │  │                                               │     │
  │  │  Each test gets a FRESH browser context       │     │
  │  │  (like incognito) — full isolation             │     │
  │  └───────────────────────────────────────────────┘     │
  └──────────────────────────────────────────────────────┘

  KEY FEATURES:
  • Auto-waiting: Every action waits for element to be actionable
  • Multi-browser: Chromium, Firefox, WebKit in parallel
  • Traces: Time-travel debugging with screenshots + network + DOM
  • API testing: Built-in request context for API-only tests
  • Codegen: npx playwright codegen — record interactions as code
```

### 2.1 Playwright Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,           // fail CI if .only left in
  retries: process.env.CI ? 2 : 0,        // retry flakes in CI only
  workers: process.env.CI ? 1 : undefined, // parallel locally, serial in CI
  reporter: [
    ['html'],
    ['list'],
    process.env.CI ? ['github'] : ['line'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',              // capture trace on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup — runs once, shares state
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 2.2 Playwright Locators — Best Practices

```typescript
// PREFERRED: Role-based locators (accessible, resilient)
page.getByRole('button', { name: 'Submit' });
page.getByRole('heading', { name: 'Dashboard' });
page.getByRole('link', { name: 'Settings' });
page.getByRole('textbox', { name: 'Email' });
page.getByRole('checkbox', { name: 'Remember me' });

// GOOD: Label and text-based
page.getByLabel('Password');
page.getByPlaceholder('Search...');
page.getByText('Welcome back');

// ACCEPTABLE: Test ID (when no semantic option exists)
page.getByTestId('chart-container');

// AVOID: CSS selectors (fragile, coupled to markup)
page.locator('.btn-primary');              // breaks on class rename
page.locator('#submit-btn');               // fragile
page.locator('div > span:nth-child(2)');   // extremely brittle
```

### 2.3 Writing Playwright Tests

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill form
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('secure123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Welcome, Admin')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpass');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Stay on login page with error
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login?redirect=/dashboard');
  });
});
```

### 2.4 Playwright Fixtures

```typescript
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';

// Custom fixtures
type Fixtures = {
  authenticatedPage: import('@playwright/test').Page;
  todoPage: TodoPage;
};

export const test = base.extend<Fixtures>({
  // Fixture: pre-authenticated page
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/dashboard');

    await use(page);

    // Cleanup: logout
    await page.goto('/logout');
  },

  // Fixture: page object
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await use(todoPage);
  },
});

export { expect };
```

### 2.5 Authentication State Reuse

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/dashboard');

  // Save auth state (cookies + localStorage)
  await page.context().storageState({ path: authFile });
});
```

```typescript
// playwright.config.ts — reference saved auth
{
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'e2e/.auth/user.json',   // reuse auth
  },
  dependencies: ['setup'],
}
```

---

## 3. Playwright — Advanced Patterns

### 3.1 Page Object Model

```typescript
// e2e/pages/TodoPage.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class TodoPage {
  readonly page: Page;
  readonly newTodoInput: Locator;
  readonly todoList: Locator;
  readonly clearCompletedButton: Locator;
  readonly todoCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newTodoInput = page.getByPlaceholder('What needs to be done?');
    this.todoList = page.getByRole('list', { name: 'Todo list' });
    this.clearCompletedButton = page.getByRole('button', { name: 'Clear completed' });
    this.todoCount = page.getByTestId('todo-count');
  }

  async goto() {
    await this.page.goto('/todos');
  }

  async addTodo(text: string) {
    await this.newTodoInput.fill(text);
    await this.newTodoInput.press('Enter');
  }

  async toggleTodo(text: string) {
    const todo = this.todoList.getByRole('listitem').filter({ hasText: text });
    await todo.getByRole('checkbox').click();
  }

  async deleteTodo(text: string) {
    const todo = this.todoList.getByRole('listitem').filter({ hasText: text });
    await todo.hover();
    await todo.getByRole('button', { name: 'Delete' }).click();
  }

  async expectTodoCount(count: number) {
    await expect(this.todoCount).toHaveText(`${count} items left`);
  }

  async expectTodoVisible(text: string) {
    await expect(
      this.todoList.getByRole('listitem').filter({ hasText: text })
    ).toBeVisible();
  }

  async expectTodoNotVisible(text: string) {
    await expect(
      this.todoList.getByRole('listitem').filter({ hasText: text })
    ).not.toBeVisible();
  }
}
```

```typescript
// e2e/todo.spec.ts
import { test, expect } from './fixtures';

test.describe('Todo App', () => {
  test('complete todo workflow', async ({ todoPage }) => {
    // Add todos
    await todoPage.addTodo('Buy groceries');
    await todoPage.addTodo('Walk the dog');
    await todoPage.addTodo('Write tests');
    await todoPage.expectTodoCount(3);

    // Complete a todo
    await todoPage.toggleTodo('Walk the dog');
    await todoPage.expectTodoCount(2);

    // Delete a todo
    await todoPage.deleteTodo('Buy groceries');
    await todoPage.expectTodoCount(1);
    await todoPage.expectTodoNotVisible('Buy groceries');
  });
});
```

### 3.2 Network Interception

```typescript
test('handles slow API gracefully', async ({ page }) => {
  // Slow down a specific API call
  await page.route('/api/products', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await route.continue();
  });

  await page.goto('/products');

  // Verify loading state appears
  await expect(page.getByText('Loading products...')).toBeVisible();

  // Wait for data
  await expect(page.getByRole('list')).toBeVisible({ timeout: 10_000 });
});

test('shows error on API failure', async ({ page }) => {
  // Mock API failure
  await page.route('/api/products', (route) =>
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    })
  );

  await page.goto('/products');

  await expect(page.getByRole('alert')).toHaveText(
    'Failed to load products. Please try again.'
  );
});

test('sends correct request payload', async ({ page }) => {
  // Capture request
  const requestPromise = page.waitForRequest('/api/orders');

  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Place Order' }).click();

  const request = await requestPromise;
  const body = request.postDataJSON();

  expect(body.items).toHaveLength(2);
  expect(body.total).toBe(49.98);
});
```

### 3.3 API Testing with Playwright

```typescript
// e2e/api/users.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Users API', () => {
  let apiContext: import('@playwright/test').APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      extraHTTPHeaders: {
        Authorization: `Bearer ${process.env.TEST_API_TOKEN}`,
      },
    });
  });

  test('GET /api/users returns user list', async () => {
    const response = await apiContext.get('/api/users');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const users = await response.json();
    expect(users).toHaveLength(3);
    expect(users[0]).toHaveProperty('name');
    expect(users[0]).toHaveProperty('email');
  });

  test('POST /api/users creates a user', async () => {
    const response = await apiContext.post('/api/users', {
      data: {
        name: 'New User',
        email: 'new@example.com',
      },
    });

    expect(response.status()).toBe(201);

    const user = await response.json();
    expect(user.name).toBe('New User');
    expect(user.id).toBeDefined();
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });
});
```

### 3.4 Accessibility Testing in E2E

```typescript
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('homepage has no a11y violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('login form is keyboard navigable', async ({ page }) => {
    await page.goto('/login');

    // Tab through form
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeFocused();

    // Submit with Enter
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('modal traps focus', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Delete Account' }).click();
    const dialog = page.getByRole('dialog');

    await expect(dialog).toBeVisible();

    // Focus should be inside dialog
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeAttached();

    // Tab should cycle within dialog
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus still inside dialog
    const stillInDialog = await dialog.evaluate((dialog, focused) => {
      return dialog.contains(document.activeElement);
    });
    expect(stillInDialog).toBe(true);
  });
});
```

---

## 4. Cypress — When to Use

```
  PLAYWRIGHT vs CYPRESS DECISION

  START
    │
    ├── Need multi-browser testing (Firefox, Safari)?
    │   └── YES → Playwright (native multi-browser)
    │
    ├── Team already experienced with Cypress?
    │   └── YES → Stay with Cypress (migration cost > benefit)
    │
    ├── Need component testing in same tool?
    │   └── Cypress Component Testing is good for this
    │
    ├── Need parallel execution across machines?
    │   └── Playwright sharding is FREE
    │       Cypress parallelization requires Cypress Cloud ($$$)
    │
    └── New project, no existing E2E?
        └── Playwright (better defaults, faster, free parallel)
```

### 4.1 Playwright vs Cypress Feature Comparison

| Feature | Playwright | Cypress |
|---|---|---|
| **Browser support** | Chromium, Firefox, WebKit | Chromium, Firefox, WebKit (experimental) |
| **Language** | TypeScript/JavaScript, Python, Java, C# | TypeScript/JavaScript only |
| **Auto-waiting** | Built-in for all actions | Built-in (retry-ability) |
| **Parallel execution** | Built-in sharding (free) | Requires Cypress Cloud (paid) |
| **Speed** | Faster (browser protocol) | Slower (in-browser execution) |
| **Network mocking** | `page.route()` — powerful | `cy.intercept()` — powerful |
| **iframes** | Native support (`frame()`) | Limited, requires plugins |
| **Multi-tab/window** | Supported (browser contexts) | Not supported |
| **API testing** | Built-in `request` context | `cy.request()` |
| **Component testing** | Experimental | Built-in, mature |
| **Visual testing** | `toHaveScreenshot()` built-in | Requires plugin (Percy, Applitools) |
| **Trace viewer** | Excellent time-travel debugging | Time-travel in Test Runner |
| **CI artifacts** | Traces, screenshots, videos | Screenshots, videos |
| **DevX** | VS Code extension, codegen | Interactive Test Runner (GUI) |
| **Test isolation** | Browser context per test | Clears cookies/storage between tests |

### 4.2 Cypress Example (When Chosen)

```typescript
// cypress/e2e/login.cy.ts
describe('Login', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('logs in with valid credentials', () => {
    cy.findByLabelText('Email').type('admin@example.com');
    cy.findByLabelText('Password').type('secure123');
    cy.findByRole('button', { name: 'Sign In' }).click();

    cy.url().should('include', '/dashboard');
    cy.findByRole('heading', { name: 'Dashboard' }).should('be.visible');
  });

  it('shows validation errors', () => {
    cy.findByRole('button', { name: 'Sign In' }).click();

    cy.findByText('Email is required').should('be.visible');
    cy.findByText('Password is required').should('be.visible');
  });
});
```

```typescript
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.findByLabelText('Email').type(email);
    cy.findByLabelText('Password').type(password);
    cy.findByRole('button', { name: 'Sign In' }).click();
    cy.url().should('include', '/dashboard');
  });
});
```

---

## 5. Test Data Management

```
  TEST DATA STRATEGIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  OPTION 1: Seed database before tests                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Run migration + seed script in beforeAll    │  │
  │  │  • Predictable, deterministic data             │  │
  │  │  • Slower setup, requires DB access            │  │
  │  │  USE WHEN: Testing against real backend        │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  OPTION 2: API-based data creation                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Use API to create data before each test     │  │
  │  │  • Tests create their own dependencies         │  │
  │  │  • More isolated, no shared state              │  │
  │  │  USE WHEN: API is stable, tests need isolation │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  OPTION 3: Mock API responses                        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Intercept network, return mock data         │  │
  │  │  • Fastest, most deterministic                 │  │
  │  │  • Doesn't test real backend integration       │  │
  │  │  USE WHEN: Backend is unstable or unavailable  │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 5.1 API-Based Test Data (Playwright)

```typescript
// e2e/helpers/test-data.ts
import { APIRequestContext } from '@playwright/test';

export class TestDataHelper {
  constructor(private api: APIRequestContext) {}

  async createUser(data: Partial<{
    name: string;
    email: string;
    role: string;
  }> = {}) {
    const response = await this.api.post('/api/test/users', {
      data: {
        name: data.name ?? 'Test User',
        email: data.email ?? `test-${Date.now()}@example.com`,
        role: data.role ?? 'user',
        password: 'test-password-123',
      },
    });

    return response.json();
  }

  async createProduct(data: Partial<{
    name: string;
    price: number;
  }> = {}) {
    const response = await this.api.post('/api/test/products', {
      data: {
        name: data.name ?? 'Test Product',
        price: data.price ?? 9.99,
      },
    });

    return response.json();
  }

  async cleanup() {
    await this.api.post('/api/test/cleanup');
  }
}
```

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';
import { TestDataHelper } from './helpers/test-data';

test.describe('Checkout', () => {
  let testData: TestDataHelper;

  test.beforeAll(async ({ playwright }) => {
    const api = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
    });
    testData = new TestDataHelper(api);
  });

  test('user can checkout a product', async ({ page }) => {
    // Arrange: create test data via API
    const product = await testData.createProduct({
      name: 'E2E Widget',
      price: 29.99,
    });

    // Act
    await page.goto(`/products/${product.id}`);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await page.goto('/cart');
    await page.getByRole('button', { name: 'Checkout' }).click();

    // Assert
    await expect(page.getByText('Order confirmed')).toBeVisible();
    await expect(page.getByText('$29.99')).toBeVisible();
  });

  test.afterAll(async () => {
    await testData.cleanup();
  });
});
```

---

## 6. CI/CD Integration

### 6.1 GitHub Actions with Playwright

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]  # parallel shards

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Start app
        run: npm run build && npm run start &
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Wait for app
        run: npx wait-on http://localhost:3000 --timeout 60000

      - name: Run Playwright tests
        run: npx playwright test --shard=${{ matrix.shard }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ strategy.job-index }}
          path: playwright-report/
          retention-days: 7

      - name: Upload traces
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: traces-${{ strategy.job-index }}
          path: test-results/
          retention-days: 7
```

### 6.2 Docker-Based E2E

```dockerfile
# e2e/Dockerfile
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx playwright install --with-deps

CMD ["npx", "playwright", "test"]
```

```yaml
# docker-compose.e2e.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/testdb
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: testdb
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 5s
      timeout: 5s
      retries: 5

  e2e:
    build:
      context: .
      dockerfile: e2e/Dockerfile
    depends_on:
      - app
    environment:
      BASE_URL: http://app:3000
```

---

## 7. Handling Flaky Tests

```
  FLAKY TEST DIAGNOSIS FLOWCHART

  START: Test fails intermittently
    │
    ├── Does it fail on timing?
    │   ├── Element not found (too fast) → Add proper wait/locator
    │   ├── Animation interfering → Disable animations in test
    │   └── API response slow → Increase timeout or mock
    │
    ├── Does it fail on ordering?
    │   ├── Tests share state → Isolate: fresh context per test
    │   └── Database not reset → Seed per test or use transactions
    │
    ├── Does it fail on environment?
    │   ├── Different in CI vs local → Match environments (Docker)
    │   └── Resource contention → Limit parallelism in CI
    │
    └── Random failures with no pattern?
        ├── Race condition in app code → Fix the app, not the test
        └── Truly random → Add retry(2) and investigate root cause
```

### 7.1 Fixing Common Flakiness

```typescript
// FLAKY: Race condition — element exists but not stable
await page.click('.submit-btn');  // may click before button is enabled

// FIXED: Playwright auto-waits, but be explicit about state
await page.getByRole('button', { name: 'Submit' }).click();
// Auto-waits: visible, enabled, stable, receives events

// FLAKY: Waiting for network with arbitrary timeout
await page.waitForTimeout(2000);  // NEVER use fixed timeouts

// FIXED: Wait for specific condition
await page.waitForResponse('/api/users');
// or
await expect(page.getByText('3 users loaded')).toBeVisible();

// FLAKY: Animation timing
await page.getByRole('button', { name: 'Open Menu' }).click();
await expect(page.getByRole('menu')).toBeVisible();  // may fail during animation

// FIXED: Disable animations in tests
// playwright.config.ts
use: {
  // Disable CSS animations
  contextOptions: {
    reducedMotion: 'reduce',
  },
}
```

### 7.2 Test Isolation

```typescript
// EACH test gets a fresh browser context — state is isolated
test('test 1', async ({ page }) => {
  // Fresh cookies, localStorage, sessionStorage
  await page.goto('/');
});

test('test 2', async ({ page }) => {
  // Completely independent from test 1
  await page.goto('/');
});

// For database state, use test hooks
test.beforeEach(async ({ request }) => {
  // Reset test data via API
  await request.post('/api/test/reset');
});
```

---

## 8. Performance Testing in E2E

```typescript
// e2e/performance.spec.ts
import { test, expect } from '@playwright/test';

test('page loads within performance budget', async ({ page }) => {
  // Navigate and measure
  const startTime = Date.now();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;

  // Performance budget
  expect(loadTime).toBeLessThan(3000); // 3 seconds max

  // Core Web Vitals via Performance API
  const metrics = await page.evaluate(() => {
    return new Promise<{ lcp: number; cls: number }>((resolve) => {
      let lcp = 0;
      let cls = 0;

      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            cls += (entry as any).value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });

      setTimeout(() => resolve({ lcp, cls }), 3000);
    });
  });

  expect(metrics.lcp).toBeLessThan(2500);
  expect(metrics.cls).toBeLessThan(0.1);
});

test('navigation between pages is fast', async ({ page }) => {
  await page.goto('/');

  const navStart = Date.now();
  await page.getByRole('link', { name: 'Products' }).click();
  await page.waitForURL('/products');
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  const navTime = Date.now() - navStart;

  expect(navTime).toBeLessThan(1000); // SPA navigation < 1s
});
```

---

## 9. Mobile E2E Testing

```typescript
// playwright.config.ts — mobile projects
projects: [
  {
    name: 'mobile-chrome',
    use: {
      ...devices['Pixel 5'],
      // viewport: { width: 393, height: 851 },
      // userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) ...',
      // isMobile: true,
      // hasTouch: true,
    },
  },
  {
    name: 'mobile-safari',
    use: {
      ...devices['iPhone 13'],
    },
  },
  {
    name: 'tablet',
    use: {
      ...devices['iPad Pro 11'],
    },
  },
]
```

```typescript
// e2e/mobile.spec.ts
import { test, expect, devices } from '@playwright/test';

test.describe('Mobile navigation', () => {
  test.use(devices['iPhone 13']);

  test('hamburger menu opens on mobile', async ({ page }) => {
    await page.goto('/');

    // Desktop nav should NOT be visible
    await expect(page.getByRole('navigation', { name: 'Main' })).not.toBeVisible();

    // Open hamburger menu
    await page.getByRole('button', { name: 'Open menu' }).click();

    // Mobile nav IS visible
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
  });

  test('touch gestures work', async ({ page }) => {
    await page.goto('/gallery');

    const gallery = page.getByTestId('image-gallery');

    // Swipe left
    await gallery.evaluate((el) => {
      el.dispatchEvent(new TouchEvent('touchstart', {
        touches: [new Touch({ identifier: 0, target: el, clientX: 300, clientY: 200 })],
      }));
      el.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [new Touch({ identifier: 0, target: el, clientX: 50, clientY: 200 })],
      }));
    });

    await expect(page.getByText('Image 2 of 5')).toBeVisible();
  });
});
```

---

## 10. Debugging E2E Tests

### 10.1 Playwright Trace Viewer

```bash
# Run with trace enabled
npx playwright test --trace on

# Open trace viewer
npx playwright show-trace test-results/test-name/trace.zip
```

```
  TRACE VIEWER — TIME-TRAVEL DEBUGGING

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  TIMELINE                                            │
  │  ─────►─────►─────►─────►─────►─────►─────►         │
  │  goto  fill   fill   click  waitFor  assert ❌       │
  │                                                      │
  │  ┌──────────────────────┐  ┌──────────────────────┐  │
  │  │     SCREENSHOT       │  │    NETWORK LOG       │  │
  │  │  ┌────────────────┐  │  │                      │  │
  │  │  │ [DOM snapshot  │  │  │  GET /api/users 200  │  │
  │  │  │  at each step] │  │  │  POST /api/login 401 │  │
  │  │  └────────────────┘  │  │  GET /api/data  500  │  │
  │  └──────────────────────┘  └──────────────────────┘  │
  │                                                      │
  │  ┌──────────────────────┐  ┌──────────────────────┐  │
  │  │   CONSOLE LOG        │  │    ACTION LOG        │  │
  │  │                      │  │                      │  │
  │  │  Error: 500 /api/x   │  │  click 'Submit'      │  │
  │  │  Warning: missing key │  │  ├── waiting...      │  │
  │  │                      │  │  └── clicked          │  │
  │  └──────────────────────┘  └──────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 10.2 Debug Mode

```bash
# Run single test in headed mode with devtools
npx playwright test e2e/login.spec.ts --headed --debug

# Pause at a specific point in test
test('debug me', async ({ page }) => {
  await page.goto('/login');
  await page.pause();  // opens inspector — step through actions
  await page.getByLabel('Email').fill('test@test.com');
});
```

### 10.3 Playwright Codegen

```bash
# Record interactions and generate test code
npx playwright codegen http://localhost:3000

# Opens browser + inspector
# Click around → code is generated in real-time
# Copy generated code into your test file
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **E2E testing units** | Testing individual formatters, validators via browser — 10x slower than needed | Push down to unit tests; E2E is for user journeys only |
| **Fixed waits** | `page.waitForTimeout(2000)` — slow and still flaky | Wait for specific conditions: `expect(locator).toBeVisible()` |
| **Shared test state** | Test B depends on data created by Test A — fails when run alone | Each test creates its own data and cleans up after |
| **CSS selectors in E2E** | `page.locator('.btn-primary.submit')` — breaks on style changes | Use role/label locators: `getByRole('button', { name: 'Submit' })` |
| **No CI integration** | E2E tests only run locally, failures discovered late | Run in CI on every PR with parallel sharding |
| **Testing implementation** | Checking internal state, Redux store, component props in E2E | Assert user-visible outcomes: text, navigation, visual state |
| **Giant test suites** | 200+ E2E tests taking 45 minutes — blocks deployments | Keep E2E focused (20-40 critical paths); test rest at lower levels |
| **No trace/screenshot on failure** | "Test failed" with no context — debugging takes hours | Configure trace + screenshot on failure in Playwright config |
| **Ignoring flaky tests** | Flaky test? Retry 3 times and move on — false confidence | Investigate root cause; fix timing/state issues or delete the test |
| **No Page Object Model** | Selectors duplicated across 50 tests — one UI change breaks all | Extract page objects with reusable locators and actions |
| **Testing third-party flows** | E2E testing Stripe checkout, OAuth provider login | Mock external services at boundary; trust their tests |
| **Running E2E on every commit** | 15-minute E2E suite runs on every push — slows development | Run E2E on PR and main; run unit tests on every push |

---

## 12. Enforcement Checklist

### Framework Setup
- [ ] Playwright installed and configured with multi-browser projects
- [ ] `webServer` configured to start app automatically
- [ ] Auth setup project reuses storage state across tests
- [ ] `forbidOnly: true` in CI to prevent `.only` in production
- [ ] Retries configured: 0 locally, 2 in CI
- [ ] Trace + screenshot configured on failure

### Test Quality
- [ ] Every test represents a real user journey (not a unit test in a browser)
- [ ] Tests use role/label locators — no CSS selectors
- [ ] Page Object Model used for pages with 3+ tests
- [ ] No `waitForTimeout` — all waits are condition-based
- [ ] Each test creates and cleans up its own data
- [ ] Tests pass independently (no ordering dependency)

### CI/CD
- [ ] E2E runs on every PR against staging/preview environment
- [ ] Parallel sharding configured (4+ shards for large suites)
- [ ] Test artifacts uploaded (reports, traces, screenshots)
- [ ] Failure notifications sent to team channel
- [ ] E2E suite completes in < 10 minutes (via parallelism)
- [ ] Flaky test detection enabled — tests quarantined, not ignored

### Coverage Strategy
- [ ] 5-15 critical user journeys covered (auth, core CRUD, checkout)
- [ ] Mobile viewport tested for responsive flows
- [ ] Accessibility audit (axe-core) runs in E2E
- [ ] API-level smoke tests complement UI E2E
- [ ] Performance budgets asserted in E2E (LCP, load time)
