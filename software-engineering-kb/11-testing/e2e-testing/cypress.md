# Cypress

| Attribute      | Value                                      |
|----------------|--------------------------------------------|
| Domain         | Testing > E2E Testing                      |
| Importance     | High                                       |
| Last Updated   | 2026-03-10                                 |
| Cross-ref      | [E2E Overview](overview.md), [Playwright](playwright.md), [Visual Regression](visual-regression.md) |

---

## Core Concepts

### Architecture

Cypress runs **inside the browser** alongside the application under test. This architecture provides:

- **Time-travel debugging**: Every command is snapshotted. Hover over any step in the command log to see the DOM at that point in time.
- **Automatic waiting**: Commands retry until the element is actionable or the timeout expires.
- **Real-time reloading**: Tests re-run on file save during `cypress open`.
- **Direct DOM access**: Cypress can access `window`, `document`, and application state directly.

The trade-off: Cypress executes in a single browser process, which imposes constraints on multi-tab, multi-origin, and cross-browser scenarios.

### Command Queue Model

Cypress commands are **enqueued, not executed immediately**. Each command returns a Chainable, not a Promise. Do not mix `async/await` with Cypress commands — use `.then()` when you need to access yielded values.

```typescript
// WRONG — async/await breaks the command queue
const text = await cy.get('[data-testid="title"]').invoke('text');

// CORRECT — use .then() to access yielded values
cy.get('[data-testid="title"]').invoke('text').then((text) => {
  expect(text).to.include('Dashboard');
});
```

---

## Code Examples

### Complete Test Suite: Commands, Assertions, Custom Commands

```typescript
// cypress/e2e/auth.cy.ts
describe('Authentication', () => {
  beforeEach(() => {
    cy.task('db:seed'); // Seed via backend task
    cy.visit('/login');
  });

  it('should login with valid credentials and redirect to dashboard', () => {
    cy.get('[data-testid="login-email"]').type('user@example.com');
    cy.get('[data-testid="login-password"]').type('secureP@ss1');
    cy.get('[data-testid="login-submit"]').click();

    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-avatar"]').should('be.visible');
  });

  it('should display validation error for empty fields', () => {
    cy.get('[data-testid="login-submit"]').click();
    cy.get('[data-testid="field-error-email"]').should('contain', 'Email is required');
    cy.get('[data-testid="field-error-password"]').should('contain', 'Password is required');
  });

  it('should lock account after 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      cy.get('[data-testid="login-email"]').clear().type('user@example.com');
      cy.get('[data-testid="login-password"]').clear().type('wrong');
      cy.get('[data-testid="login-submit"]').click();
    }
    cy.get('[data-testid="account-locked-banner"]').should('be.visible');
  });
});
```

### Network Intercepts with `cy.intercept()`

```typescript
// cypress/e2e/dashboard.cy.ts
describe('Dashboard', () => {
  it('should display metrics from API', () => {
    cy.intercept('GET', '/api/analytics/summary', {
      statusCode: 200,
      body: {
        visitors: 14_230,
        conversions: 872,
        revenue: 48_500,
      },
    }).as('getAnalytics');

    cy.visit('/dashboard');
    cy.wait('@getAnalytics');

    cy.get('[data-testid="metric-visitors"]').should('contain', '14,230');
    cy.get('[data-testid="metric-revenue"]').should('contain', '$48,500');
  });

  it('should show error state when API fails', () => {
    cy.intercept('GET', '/api/analytics/summary', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('getAnalyticsFail');

    cy.visit('/dashboard');
    cy.wait('@getAnalyticsFail');
    cy.get('[data-testid="error-banner"]').should('be.visible');
  });

  it('should intercept and modify response payload', () => {
    cy.intercept('GET', '/api/feature-flags', (req) => {
      req.continue((res) => {
        res.body.newCheckout = true;
      });
    }).as('getFlags');

    cy.visit('/settings');
    cy.wait('@getFlags');
    cy.get('[data-testid="new-checkout-toggle"]').should('exist');
  });
});
```

### Custom Commands and Utility Patterns

```typescript
// cypress/support/commands.ts
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      seedDatabase(fixture: string): Chainable<void>;
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  // Programmatic login via API — skip the UI for speed
  cy.request('POST', '/api/auth/login', { email, password }).then((resp) => {
    window.localStorage.setItem('auth_token', resp.body.token);
  });
});

Cypress.Commands.add('seedDatabase', (fixture: string) => {
  cy.task('db:seed', { fixture });
});

Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

export {};

// Usage in tests
describe('Checkout', () => {
  beforeEach(() => {
    cy.seedDatabase('checkout-ready');
    cy.login('buyer@example.com', 'secureP@ss1');
    cy.visit('/cart');
  });

  it('should complete purchase', () => {
    cy.getByTestId('checkout-button').click();
    cy.getByTestId('place-order').click();
    cy.getByTestId('order-confirmation').should('be.visible');
  });
});
```

### Configuration: `cypress.config.ts`

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10_000,
    requestTimeout: 15_000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    video: false, // Disable video in CI unless debugging
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      on('task', {
        'db:seed': async (options) => {
          // Execute database seeding logic
          const { seedDatabase } = await import('./cypress/tasks/db');
          return seedDatabase(options);
        },
      });
      return config;
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.tsx',
  },
});
```

### Component Testing Mode

```typescript
// src/components/Button.cy.tsx
import { Button } from './Button';

describe('Button component', () => {
  it('renders with correct label', () => {
    cy.mount(<Button label="Submit" />);
    cy.get('button').should('contain', 'Submit');
  });

  it('calls onClick handler when clicked', () => {
    const onClick = cy.stub().as('clickHandler');
    cy.mount(<Button label="Submit" onClick={onClick} />);
    cy.get('button').click();
    cy.get('@clickHandler').should('have.been.calledOnce');
  });

  it('renders disabled state', () => {
    cy.mount(<Button label="Submit" disabled />);
    cy.get('button').should('be.disabled');
  });
});
```

---

## Cypress vs Playwright Comparison

| Dimension              | Cypress                             | Playwright                             |
|------------------------|-------------------------------------|----------------------------------------|
| Browser support        | Chromium-family, Firefox, WebKit (experimental) | Chromium, Firefox, WebKit (full parity) |
| Multi-tab / multi-origin | Limited; requires workarounds      | First-class support                    |
| Language               | JavaScript / TypeScript             | JS/TS, Python, Java, C#               |
| Architecture           | In-browser execution                | Out-of-process via CDP / protocol      |
| Auto-wait              | Implicit command retry              | Implicit action + assertion auto-wait  |
| Network interception   | `cy.intercept()` — rich API         | `page.route()` — equally rich          |
| Parallel execution     | Via Cypress Cloud (paid) or manual sharding | Built-in `--shard`, free               |
| Component testing      | Built-in (`cy.mount`)              | Experimental                           |
| Debugging              | Time-travel in GUI                  | Trace Viewer, `--debug` headed mode    |
| CI integration         | Docker image, GitHub Action         | Docker image, GitHub Action            |

**When to choose Cypress**: Existing Cypress investment, need for component testing, team prefers in-browser debugging model, single-origin SPA.

**When to choose Playwright**: Multi-browser parity required, multi-tab or cross-origin flows, need free parallelization, non-JS backend teams (Python/Java/C# bindings).

---

## Known Limitations

1. **Single-tab only**: Cypress cannot natively open or control a second browser tab. OAuth popups require `cy.origin()` or stub-based workarounds.
2. **Same-origin constraint**: `cy.origin()` (Cypress 12+) partially addresses cross-origin, but it remains awkward for complex multi-domain flows.
3. **No native multi-browser matrix**: Must configure separate CI jobs per browser manually.
4. **No WebSocket interception**: `cy.intercept()` does not support WebSocket frames. Use application-level mocks.
5. **Command queue, not Promises**: Cannot use `async/await` natively. Requires `.then()` chains for sequential value access.

---

## 10 Best Practices

1. **Use programmatic login via API.** Call `cy.request()` to authenticate, then set the token in `localStorage`. Reserve UI login for the login test itself.
2. **Create custom commands for repeated flows.** Encapsulate login, seeding, and navigation in `Cypress.Commands.add` with full TypeScript types.
3. **Alias intercepts and wait on them.** Always `.as('alias')` your `cy.intercept()` calls and `cy.wait('@alias')` before asserting on data.
4. **Avoid `cy.wait(ms)`.** Use assertion-based waits: `should('be.visible')`, `should('contain')`. Time-based waits introduce flakiness.
5. **Seed data via backend tasks.** Use `cy.task()` to call Node.js functions that prepare the database. Never rely on UI for data setup.
6. **Keep tests independent.** Each `it` block must work in isolation. Use `beforeEach` for setup, not a preceding test.
7. **Type custom commands.** Extend the `Cypress.Chainable` interface to provide IntelliSense and catch misuse at compile time.
8. **Disable video in CI unless debugging.** Video recording adds significant CI time. Enable it only when investigating failures.
9. **Use `cy.origin()` for cross-origin flows.** Do not disable `chromeWebSecurity` globally — scope origin switches to the tests that need them.
10. **Run critical E2E on every PR, full suite nightly.** Tag tests with `@critical` and use `--spec` patterns to select the fast subset.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Using `cy.wait(5000)` for synchronization | Flaky and slow; wastes time or races | Use `cy.wait('@alias')` or assertion retries |
| Logging in through the UI in every test | Slow suite; each login adds 3–5 seconds | Use `cy.request()` + `localStorage` for programmatic login |
| Not aliasing intercepts | Cannot wait on specific network calls; race conditions | Always `.as('name')` and `cy.wait('@name')` |
| Mixing `async/await` with Cypress commands | Silent failures; commands execute out of order | Use `.then()` chains; never `await` a Cypress command |
| Disabling `chromeWebSecurity` globally | Masks real CORS issues; hides security bugs | Use `cy.origin()` scoped to specific tests |
| Coupling tests to execution order | Cascading failures; impossible to run single test | Seed and teardown in `beforeEach`; each test is self-contained |
| Using `cy.get('.btn-primary')` selectors | Tests break on CSS refactors | Use `data-testid` attributes via `cy.getByTestId()` custom command |
| Not typing custom commands | No IntelliSense, easy to pass wrong arguments | Extend `Cypress.Chainable` interface with proper generics |

---

## Enforcement Checklist

- [ ] `cypress.config.ts` defines `baseUrl`, `retries`, and `defaultCommandTimeout`
- [ ] Custom commands are typed with `Cypress.Chainable` interface extensions
- [ ] All network intercepts are aliased and waited upon before assertions
- [ ] No `cy.wait(ms)` calls exist in the codebase — grep and enforce via lint rule
- [ ] Login is programmatic via `cy.request()` except in the login spec itself
- [ ] Database seeding uses `cy.task()` — no UI-based data creation in `beforeEach`
- [ ] All selectors use `data-testid` — no CSS class selectors in test files
- [ ] CI runs E2E on every PR; full suite (including Firefox) runs nightly
- [ ] `video: false` in CI config unless actively debugging failures
- [ ] Component tests use `cy.mount()` with the correct framework adapter
- [ ] `chromeWebSecurity` is NOT globally disabled — `cy.origin()` is used where needed
- [ ] Flaky tests are tagged, quarantined, and tracked for resolution within one sprint
