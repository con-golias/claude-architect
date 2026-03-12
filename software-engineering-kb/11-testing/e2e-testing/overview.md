# E2E Testing Strategy

| Attribute      | Value                                      |
|----------------|--------------------------------------------|
| Domain         | Testing > E2E Testing                      |
| Importance     | Critical                                   |
| Last Updated   | 2026-03-10                                 |
| Cross-ref      | [Playwright](playwright.md), [Cypress](cypress.md), [Visual Regression](visual-regression.md), [Mobile E2E](mobile-e2e.md) |

---

## Core Concepts

### What E2E Testing Covers

Define E2E (end-to-end) tests as automated workflows that exercise the full application stack from the user interface through the backend, database, and third-party integrations. Treat them as the topmost layer of the testing pyramid — expensive to run, slow by nature, and high in confidence per test.

An E2E test must:

- Start from a real browser or device.
- Interact with a deployed (or locally served) instance of the application.
- Assert on outcomes visible to the user: rendered UI, downloaded files, navigation, toast messages, or email delivery.

### The 80/20 Rule for E2E Coverage

Do **not** attempt to cover every route or edge case with E2E tests. Apply the Pareto principle:

- Identify the **20% of user journeys** that carry **80% of business value** (revenue, user retention, compliance).
- Typical critical paths: signup, login/logout, checkout/payment, core CRUD workflows, onboarding, password reset.
- Leave edge cases and branching logic to unit and integration layers.

### Test Selection Criteria

Prioritize paths for E2E automation using this decision matrix:

| Criterion                  | Weight | Example                                  |
|----------------------------|--------|------------------------------------------|
| Revenue impact             | High   | Checkout, subscription renewal           |
| User frequency             | High   | Login, dashboard load, search            |
| Regulatory / compliance    | High   | GDPR consent flow, audit trail           |
| Cross-service dependency   | Medium | Payment gateway integration              |
| Severity if broken         | Medium | Password reset, account deletion         |
| Complexity of manual test  | Low    | Multi-step wizard, file upload + preview |

### E2E vs Integration vs Component Testing

Draw clear boundaries:

| Aspect              | Component Test         | Integration Test            | E2E Test                        |
|---------------------|------------------------|-----------------------------|---------------------------------|
| Scope               | Single component       | Multiple services/modules   | Full user journey               |
| Environment          | JSDOM / test renderer  | Partial stack, mocked edges | Fully deployed stack            |
| Speed               | < 50 ms                | 50 ms – 2 s                | 5 s – 60 s                     |
| Flakiness risk      | Very low               | Low                         | Medium–High                     |
| Confidence per test | Low                    | Medium                      | High                            |
| Ideal count         | Thousands              | Hundreds                    | Tens to low hundreds            |

### Test Environment Management

Establish deterministic environments for E2E:

- **Staging environment**: Long-lived, mirrors production. Use for nightly full-suite runs.
- **Ephemeral environments**: Spin up per pull request via containers or serverless preview deployments. Tear down after merge.
- **Data isolation**: Seed a known dataset before each suite. Never share state between test runs. Use database transactions or snapshot-restore.
- **Service virtualization**: Mock third-party APIs (payment gateways, email providers) at the network level to avoid external flakiness.

---

## Code Examples

### E2E Test Structure with Page Object Model (TypeScript)

```typescript
// pages/login.page.ts
export class LoginPage {
  constructor(private readonly page: Page) {}

  private readonly selectors = {
    email: '[data-testid="login-email"]',
    password: '[data-testid="login-password"]',
    submit: '[data-testid="login-submit"]',
    errorBanner: '[data-testid="login-error"]',
  } as const;

  async navigate(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.page.fill(this.selectors.email, email);
    await this.page.fill(this.selectors.password, password);
    await this.page.click(this.selectors.submit);
  }

  async getErrorMessage(): Promise<string> {
    return this.page.textContent(this.selectors.errorBanner) ?? '';
  }
}

// tests/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Login flow', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('should redirect to dashboard on valid credentials', async ({ page }) => {
    await loginPage.login('user@example.com', 'secureP@ss1');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display error on invalid credentials', async () => {
    await loginPage.login('user@example.com', 'wrong');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Invalid email or password');
  });
});
```

### Execution Strategy: Parallel Sharding

```typescript
// playwright.config.ts — sharding across CI machines
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 2 : 0,
  shard: process.env.SHARD
    ? { current: Number(process.env.SHARD), total: Number(process.env.TOTAL_SHARDS) }
    : undefined,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
```

```yaml
# .github/workflows/e2e.yml — sharded matrix
jobs:
  e2e:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          BASE_URL: ${{ vars.STAGING_URL }}
```

### Flakiness Prevention Techniques

```typescript
// Prefer auto-wait over explicit sleeps
// BAD
await page.click('#submit');
await page.waitForTimeout(3000); // arbitrary sleep

// GOOD — auto-wait built into assertions
await page.click('#submit');
await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();

// Use deterministic selectors
// BAD: fragile CSS selector
await page.click('.btn.btn-primary.mt-4');

// GOOD: stable test ID
await page.click('[data-testid="checkout-confirm"]');
```

---

## 10 Best Practices

1. **Limit E2E scope to critical journeys.** Cover signup, login, checkout, and core workflows. Push everything else to integration and unit layers.
2. **Use the Page Object Model.** Encapsulate selectors and actions in page classes. Never scatter raw selectors across test files.
3. **Adopt `data-testid` attributes.** Decouple tests from CSS classes, DOM structure, and visible text that changes with i18n.
4. **Isolate test data per run.** Seed fresh data before each suite. Never depend on data created by a previous test.
5. **Run E2E tests in CI on every pull request.** Gate merges on green E2E suites to catch regressions before they reach staging.
6. **Shard across multiple machines.** Keep total wall-clock time under 10 minutes. Split suites by file or by test name hash.
7. **Enable tracing and screenshots on failure.** Attach artifacts to CI for post-mortem debugging without reproducing locally.
8. **Retry flaky tests exactly once with trace.** Two consecutive failures indicate a real defect, not flakiness.
9. **Quarantine persistently flaky tests.** Move them to a separate tagged suite. Fix or delete within one sprint.
10. **Review E2E tests in code review.** Apply the same standards as production code: readability, DRY, naming conventions, no magic strings.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Testing every edge case in E2E | Slow suites (> 30 min), high maintenance | Move edge cases to unit/integration; keep E2E for critical paths only |
| Using `waitForTimeout` / `sleep` | Non-deterministic, flaky on slow CI | Use auto-wait assertions (`toBeVisible`, `toHaveURL`) |
| Shared mutable test state | Order-dependent failures, cascading test breakage | Isolate data per test; seed and teardown in `beforeEach` |
| Selectors tied to CSS classes | Tests break on every UI refactor | Use `data-testid` attributes exclusively |
| No retry strategy | Single transient failure blocks the pipeline | Configure 1–2 retries with trace on retry |
| Running E2E only nightly | Regressions discovered days after merge | Run critical E2E subset on every PR; full suite nightly |
| Ignoring flaky tests | Erosion of trust; team starts ignoring failures | Quarantine, track, fix or delete within one sprint |
| No test environment teardown | Resource leaks, cost overruns, stale data pollution | Automate teardown in CI post-job hooks; use ephemeral environments |

---

## Enforcement Checklist

- [ ] Critical user journeys (login, signup, checkout) are covered by E2E tests
- [ ] E2E suite completes in under 10 minutes (sharded)
- [ ] All selectors use `data-testid` — no CSS class or XPath selectors
- [ ] Page Object Model is used for every page under test
- [ ] Test data is seeded and isolated per run; no cross-test dependencies
- [ ] CI pipeline runs E2E on every pull request and gates merge on green
- [ ] Trace and screenshot artifacts are uploaded on failure
- [ ] Flaky tests are quarantined and tracked in a backlog
- [ ] Retry count is set to 1–2 with tracing enabled on retry
- [ ] E2E test code undergoes the same review process as production code
- [ ] Ephemeral environments are torn down after CI job completes
- [ ] Test environment configuration is version-controlled alongside application code
