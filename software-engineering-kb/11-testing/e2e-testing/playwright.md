# Playwright

| Attribute      | Value                                      |
|----------------|--------------------------------------------|
| Domain         | Testing > E2E Testing                      |
| Importance     | Critical                                   |
| Last Updated   | 2026-03-10                                 |
| Cross-ref      | [E2E Overview](overview.md), [Visual Regression](visual-regression.md), [Cypress](cypress.md) |

---

## Core Concepts

### Cross-Browser Support

Playwright ships with bundled browser binaries for three engines:

| Engine   | Browser        | Use Case                            |
|----------|----------------|-------------------------------------|
| Chromium | Chrome, Edge   | Primary CI target, widest user base |
| Firefox  | Firefox        | Gecko rendering parity checks       |
| WebKit   | Safari         | macOS / iOS rendering validation    |

Run all three in a single config via `projects`. Each project launches its own browser context with isolated storage, cookies, and cache.

### Auto-Wait Mechanism

Every Playwright action (`click`, `fill`, `check`) automatically waits for the target element to be:

1. Attached to the DOM.
2. Visible.
3. Stable (no ongoing animations).
4. Enabled (not disabled).
5. Receiving events (not obscured by another element).

This eliminates the need for explicit waits in the vast majority of cases. Rely on it — do not add manual `waitForTimeout` calls.

### Core Feature Set

- **Network interception**: Intercept, modify, or mock any HTTP request at the browser level.
- **Tracing**: Record a full timeline of actions, DOM snapshots, network requests, and console logs. Replay in Trace Viewer.
- **Codegen**: Generate test scaffolding by recording user interactions (`npx playwright codegen`).
- **Multi-tab and multi-origin**: First-class support for popups, new tabs, OAuth redirects.
- **API testing**: Send HTTP requests directly from test context without a browser, useful for setup/teardown.

---

## Code Examples

### Complete Test Suite: Navigation, Forms, Assertions

```typescript
// tests/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout flow', () => {
  test.beforeEach(async ({ page }) => {
    // Seed cart via API before each test
    await page.request.post('/api/test/seed-cart', {
      data: { userId: 'test-user-1', items: ['SKU-001', 'SKU-002'] },
    });
    await page.goto('/cart');
  });

  test('should display cart items and total', async ({ page }) => {
    const items = page.locator('[data-testid="cart-item"]');
    await expect(items).toHaveCount(2);

    const total = page.locator('[data-testid="cart-total"]');
    await expect(total).toContainText('$');
  });

  test('should complete purchase with valid payment', async ({ page }) => {
    await page.click('[data-testid="checkout-button"]');
    await expect(page).toHaveURL('/checkout');

    // Fill shipping
    await page.fill('[data-testid="shipping-name"]', 'Jane Doe');
    await page.fill('[data-testid="shipping-address"]', '123 Main St');
    await page.fill('[data-testid="shipping-zip"]', '94105');

    // Fill payment
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/28');
    await page.fill('[data-testid="card-cvc"]', '123');

    await page.click('[data-testid="place-order"]');
    await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible();
    await expect(page).toHaveURL(/\/orders\/[a-z0-9-]+/);
  });
});
```

### Page Object Model

```typescript
// pages/checkout.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class CheckoutPage {
  private readonly shippingName: Locator;
  private readonly shippingAddress: Locator;
  private readonly cardNumber: Locator;
  private readonly placeOrder: Locator;
  private readonly confirmation: Locator;

  constructor(private readonly page: Page) {
    this.shippingName = page.locator('[data-testid="shipping-name"]');
    this.shippingAddress = page.locator('[data-testid="shipping-address"]');
    this.cardNumber = page.locator('[data-testid="card-number"]');
    this.placeOrder = page.locator('[data-testid="place-order"]');
    this.confirmation = page.locator('[data-testid="order-confirmation"]');
  }

  async fillShipping(name: string, address: string): Promise<void> {
    await this.shippingName.fill(name);
    await this.shippingAddress.fill(address);
  }

  async fillPayment(card: string): Promise<void> {
    await this.cardNumber.fill(card);
  }

  async submitOrder(): Promise<void> {
    await this.placeOrder.click();
  }

  async expectConfirmationVisible(): Promise<void> {
    await expect(this.confirmation).toBeVisible({ timeout: 10_000 });
  }
}
```

### Network Mocking and Response Interception

```typescript
// tests/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('should display analytics when API responds', async ({ page }) => {
  // Mock the analytics endpoint
  await page.route('**/api/analytics/summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        visitors: 14_230,
        conversions: 872,
        revenue: 48_500.0,
      }),
    }),
  );

  await page.goto('/dashboard');
  await expect(page.locator('[data-testid="metric-visitors"]')).toContainText('14,230');
  await expect(page.locator('[data-testid="metric-revenue"]')).toContainText('$48,500');
});

test('should show error state on API failure', async ({ page }) => {
  await page.route('**/api/analytics/summary', (route) =>
    route.fulfill({ status: 500, body: 'Internal Server Error' }),
  );

  await page.goto('/dashboard');
  await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();
});

test('should intercept and modify response', async ({ page }) => {
  await page.route('**/api/feature-flags', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.newCheckout = true; // Force feature flag on
    await route.fulfill({ response, json });
  });

  await page.goto('/settings');
  await expect(page.locator('[data-testid="new-checkout-toggle"]')).toBeVisible();
});
```

### Visual Comparison with `toHaveScreenshot()`

```typescript
// tests/visual/homepage.spec.ts
import { test, expect } from '@playwright/test';

test('homepage matches baseline', async ({ page }) => {
  await page.goto('/');
  // Wait for all images and animations to settle
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
    mask: [page.locator('[data-testid="live-timestamp"]')],
  });
});

test('modal renders correctly across viewports', async ({ page }) => {
  await page.goto('/products');
  await page.click('[data-testid="product-card"]:first-child');

  await expect(page.locator('[data-testid="product-modal"]')).toHaveScreenshot(
    'product-modal.png',
    { maxDiffPixels: 50 },
  );
});
```

### Configuration: `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### Trace Viewer and Debugging

```bash
# Generate trace on failure (configured via trace: 'on-first-retry')
npx playwright test --trace on

# Open trace viewer for a specific trace file
npx playwright show-trace test-results/checkout-flow/trace.zip

# Debug a single test with headed browser and inspector
npx playwright test tests/checkout.spec.ts --debug

# Run codegen to record interactions
npx playwright codegen http://localhost:3000
```

### CI Integration: GitHub Actions with Docker

```yaml
# .github/workflows/playwright.yml
name: Playwright E2E
on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.50.0-noble
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright test --shard=${{ matrix.shard }}/3
        env:
          BASE_URL: ${{ vars.STAGING_URL }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
          retention-days: 14
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-traces-${{ matrix.shard }}
          path: test-results/
          retention-days: 7
```

---

## 10 Best Practices

1. **Use the official Docker image in CI.** The `mcr.microsoft.com/playwright` image bundles all browser dependencies. Eliminate "missing library" failures.
2. **Enable `trace: 'on-first-retry'`.** Collect traces only when a test needs a retry — minimal overhead, maximum debuggability.
3. **Prefer `locator` over `$` / `$$`.** Locators auto-wait and auto-retry. Raw element handles do not.
4. **Use `web-first assertions`.** `expect(locator).toBeVisible()` retries until the condition is met or times out. Never poll manually.
5. **Isolate browser contexts.** Use `test.describe` with fresh `page` fixtures. Never share cookies or storage across tests.
6. **Mock external services at the network level.** Use `page.route()` to intercept third-party APIs. Prevent external flakiness from polluting results.
7. **Set explicit timeouts in config, not in tests.** Global `timeout` and `expect.timeout` in `playwright.config.ts` keep tests clean.
8. **Use projects for cross-browser coverage.** Define Chromium, Firefox, and WebKit as separate projects. Run all three in CI.
9. **Shard large suites.** Keep wall-clock time under 10 minutes with `--shard=N/M` and CI matrix strategy.
10. **Upload artifacts on failure.** Screenshots, videos, and traces must be available as CI artifacts for post-mortem analysis.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Using `page.waitForTimeout()` for synchronization | Flaky tests; slow on fast machines, fails on slow ones | Use auto-wait assertions: `expect(locator).toBeVisible()` |
| Selecting elements by CSS class or tag name | Tests break on every styling refactor | Use `data-testid` attributes exclusively |
| Running all tests in a single non-sharded job | 30+ minute CI runs; slow feedback loop | Shard with `--shard=N/M` across parallel CI jobs |
| Not configuring retries in CI | Transient failures block the pipeline | Set `retries: 2` in CI configuration |
| Sharing authentication state across tests | Order-dependent failures; hard to parallelize | Use `storageState` fixtures or re-authenticate per test |
| Hardcoding absolute URLs | Tests fail when environment changes | Use `baseURL` in config; reference relative paths in tests |
| Skipping cross-browser projects | WebKit/Firefox regressions reach production | Run at least Chromium + WebKit in CI; Firefox nightly |
| Not cleaning up test data after runs | Stale data accumulates; tests start interfering | Seed and teardown in `beforeEach`/`afterEach`; use API helpers |

---

## Enforcement Checklist

- [ ] `playwright.config.ts` defines projects for Chromium, Firefox, and WebKit
- [ ] `trace: 'on-first-retry'` is enabled in CI configuration
- [ ] All selectors use `data-testid` — grep codebase for raw CSS selectors in test files
- [ ] Page Object Model is used for pages with more than 3 interactions
- [ ] Network mocks use `page.route()` — no real third-party API calls in tests
- [ ] CI pipeline shards tests and completes in under 10 minutes
- [ ] Trace and screenshot artifacts are uploaded on failure
- [ ] `forbidOnly: true` is set in CI to prevent `.only` from reaching main branch
- [ ] `webServer` config starts the app automatically in local development
- [ ] Visual regression baselines are committed and reviewed in pull requests
- [ ] No `waitForTimeout` calls exist in the test codebase
- [ ] Retry count does not exceed 2 — persistent failures are fixed, not masked
