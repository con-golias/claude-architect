# Micro-Frontend Architecture — Complete Specification

> **AI Plugin Directive:** When a developer asks "what are micro-frontends?", "Module Federation", "single-spa setup", "micro-frontend communication", "independent deployments", "shared dependencies", "micro-frontend vs monolith", "web components for micro-frontends", "federation plugin", or any micro-frontend question, ALWAYS consult this directive. Micro-frontends decompose a monolithic frontend into independently developed, tested, and deployed applications. ALWAYS evaluate whether you actually NEED micro-frontends — they add significant complexity. ALWAYS use Module Federation for webpack/Vite-based micro-frontends. NEVER share runtime state between micro-frontends — use events or URL params for communication.

**Core Rule: Micro-frontends are for LARGE organizations (100+ frontend developers) with multiple teams that need independent deployment cycles. For teams under 50 developers, a well-structured monolith with clear module boundaries is ALWAYS simpler and faster. If you choose micro-frontends, use Module Federation for build-time composition or single-spa for runtime composition. NEVER share state between micro-frontends — communicate via URL, custom events, or a thin event bus. EVERY micro-frontend MUST be deployable independently without coordinating with other teams.**

---

## 1. When to Use Micro-Frontends

```
  MICRO-FRONTEND DECISION TREE

  START
    │
    ├── Is your team < 50 frontend developers?
    │   └── YES → Use a MONOLITH with good module boundaries
    │       (Micro-frontends are unnecessary complexity)
    │
    ├── Do teams need independent deployment cycles?
    │   └── NO → Monolith is fine (shared deploy pipeline)
    │
    ├── Are teams using DIFFERENT frameworks?
    │   └── YES → Micro-frontends MAY help (React + Angular legacy)
    │       BUT consider migration instead
    │
    ├── Do teams own distinct product domains?
    │   └── YES → Micro-frontends can work
    │       (Team A: Dashboard, Team B: Billing, Team C: Settings)
    │
    └── Is the cost of coordination > cost of complexity?
        ├── YES → Micro-frontends
        └── NO → Keep the monolith

  RULE: The MAJORITY of teams should NOT use micro-frontends.
  A well-structured monolith with Nx/Turborepo is simpler for most.
```

### 1.1 Trade-Offs

| Benefit | Cost |
|---|---|
| Independent deployments per team | Complex build/deploy infrastructure |
| Technology diversity (React + Vue) | Larger bundle (duplicate frameworks) |
| Team autonomy and ownership | Communication overhead between teams |
| Isolated failure domains | Consistent UX/design harder to enforce |
| Parallel development | Shared dependency management is hard |
| Incremental migration | Performance overhead (multiple runtimes) |

---

## 2. Composition Strategies

```
  MICRO-FRONTEND COMPOSITION APPROACHES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  BUILD-TIME COMPOSITION (npm packages):              │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Each micro-frontend published as npm package  │  │
  │  │  Shell app imports and bundles them            │  │
  │  │  PRO: Single bundle, tree-shaking, fast        │  │
  │  │  CON: Not independently deployable             │  │
  │  │  USE WHEN: Shared library, design system       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RUN-TIME COMPOSITION (Module Federation):           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Each micro-frontend deployed separately       │  │
  │  │  Shell loads them at runtime via federation    │  │
  │  │  PRO: Independent deployment, live updates     │  │
  │  │  CON: Network overhead, version compatibility  │  │
  │  │  USE WHEN: Teams need deployment independence  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SERVER-SIDE COMPOSITION (Edge/SSR):                 │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Server assembles page from micro-frontends   │  │
  │  │  SSI (Server-Side Includes) or edge workers   │  │
  │  │  PRO: SEO-friendly, fast initial load          │  │
  │  │  CON: Complex server infrastructure            │  │
  │  │  USE WHEN: SEO-critical, e-commerce            │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  IFRAME COMPOSITION:                                 │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Each micro-frontend in an iframe              │  │
  │  │  PRO: Complete isolation (CSS, JS, state)      │  │
  │  │  CON: Performance, no shared resources,        │  │
  │  │       accessibility issues, URL management     │  │
  │  │  USE WHEN: Embedding third-party content       │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 3. Module Federation (Webpack 5 / Vite)

```
  MODULE FEDERATION ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  SHELL (Host Application)                            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ┌──────────────────────────────────────────┐  │  │
  │  │  │  Navigation / Layout / Auth              │  │  │
  │  │  └──────────────────────────────────────────┘  │  │
  │  │                                                │  │
  │  │  ┌─────────────┐  ┌──────────┐  ┌──────────┐  │  │
  │  │  │ Dashboard   │  │ Billing  │  │ Settings │  │  │
  │  │  │ (remote)    │  │ (remote) │  │ (remote) │  │  │
  │  │  │             │  │          │  │          │  │  │
  │  │  │ Loaded at   │  │ Loaded   │  │ Loaded   │  │  │
  │  │  │ runtime     │  │ on nav   │  │ on nav   │  │  │
  │  │  │ from CDN    │  │ from CDN │  │ from CDN │  │  │
  │  │  └─────────────┘  └──────────┘  └──────────┘  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SHARED DEPENDENCIES (loaded once):                  │
  │  react, react-dom, react-router-dom                  │
  │  (singleton: true → prevents duplicate React)        │
  └──────────────────────────────────────────────────────┘
```

### 3.1 Webpack Module Federation Setup

```typescript
// shell/webpack.config.js (Host)
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        dashboard: 'dashboard@https://dashboard.cdn.example.com/remoteEntry.js',
        billing: 'billing@https://billing.cdn.example.com/remoteEntry.js',
        settings: 'settings@https://settings.cdn.example.com/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
      },
    }),
  ],
};
```

```typescript
// dashboard/webpack.config.js (Remote)
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'dashboard',
      filename: 'remoteEntry.js',
      exposes: {
        './DashboardApp': './src/DashboardApp',
        './RevenueWidget': './src/components/RevenueWidget',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
      },
    }),
  ],
};
```

### 3.2 Loading Remote Components

```tsx
// shell/src/App.tsx
import React, { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// Lazy load remote micro-frontends
const DashboardApp = React.lazy(() => import('dashboard/DashboardApp'));
const BillingApp = React.lazy(() => import('billing/BillingApp'));
const SettingsApp = React.lazy(() => import('settings/SettingsApp'));

function MicroFrontendLoader({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div role="alert">
          <h2>{name} failed to load</h2>
          <p>Please try refreshing the page.</p>
        </div>
      }
    >
      <Suspense fallback={<div>Loading {name}...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route
          path="/dashboard/*"
          element={
            <MicroFrontendLoader name="Dashboard">
              <DashboardApp />
            </MicroFrontendLoader>
          }
        />
        <Route
          path="/billing/*"
          element={
            <MicroFrontendLoader name="Billing">
              <BillingApp />
            </MicroFrontendLoader>
          }
        />
        <Route
          path="/settings/*"
          element={
            <MicroFrontendLoader name="Settings">
              <SettingsApp />
            </MicroFrontendLoader>
          }
        />
      </Routes>
    </Layout>
  );
}
```

### 3.3 Vite Module Federation

```typescript
// vite.config.ts (with @originjs/vite-plugin-federation)
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'dashboard',
      filename: 'remoteEntry.js',
      exposes: {
        './DashboardApp': './src/DashboardApp',
      },
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
});
```

---

## 4. Communication Between Micro-Frontends

```
  COMMUNICATION PATTERNS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PATTERN 1: Custom Events (PREFERRED)                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Dashboard dispatches: 'user:updated'          │  │
  │  │  Billing listens: 'user:updated'               │  │
  │  │  Decoupled, no shared state                    │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  PATTERN 2: URL / Query Parameters                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  /billing?userId=123&plan=pro                  │  │
  │  │  Shell manages routing, params passed down     │  │
  │  │  Shareable, bookmarkable                       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  PATTERN 3: Thin Event Bus                           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Shared event bus with typed events            │  │
  │  │  pub/sub pattern                               │  │
  │  │  RISK: Can become implicit coupling            │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ANTI-PATTERN: Shared Redux/Zustand store            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✗ Couples micro-frontends via shared state    │  │
  │  │  ✗ One team's change breaks others             │  │
  │  │  ✗ Defeats the purpose of independent deploy   │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 4.1 Custom Events Communication

```typescript
// shared/events.ts — typed event contract
interface MicroFrontendEvents {
  'user:updated': { userId: string; name: string };
  'cart:item-added': { productId: string; quantity: number };
  'auth:logout': undefined;
  'theme:changed': { theme: 'light' | 'dark' };
}

// Emit typed events
function emitEvent<K extends keyof MicroFrontendEvents>(
  type: K,
  detail: MicroFrontendEvents[K]
) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

// Listen to typed events
function onEvent<K extends keyof MicroFrontendEvents>(
  type: K,
  callback: (detail: MicroFrontendEvents[K]) => void
) {
  const handler = (event: Event) => {
    callback((event as CustomEvent).detail);
  };
  window.addEventListener(type, handler);
  return () => window.removeEventListener(type, handler);
}

// Dashboard micro-frontend emits:
emitEvent('user:updated', { userId: '123', name: 'Alice' });

// Billing micro-frontend listens:
onEvent('user:updated', ({ userId, name }) => {
  console.log(`User ${name} (${userId}) was updated`);
});
```

### 4.2 React Hook for Event Communication

```tsx
// useMicroFrontendEvent.ts
function useMicroFrontendEvent<K extends keyof MicroFrontendEvents>(
  eventType: K,
  callback: (detail: MicroFrontendEvents[K]) => void
) {
  useEffect(() => {
    const handler = (event: Event) => {
      callback((event as CustomEvent).detail);
    };

    window.addEventListener(eventType, handler);
    return () => window.removeEventListener(eventType, handler);
  }, [eventType, callback]);
}

// Usage in Billing micro-frontend
function BillingApp() {
  const [user, setUser] = useState<User | null>(null);

  useMicroFrontendEvent('user:updated', (data) => {
    setUser({ id: data.userId, name: data.name });
  });

  return <div>Billing for {user?.name}</div>;
}
```

---

## 5. Shared Dependencies and Design System

```
  SHARED DEPENDENCY STRATEGY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  SHARE: Framework + design system (loaded once)      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  react, react-dom (singleton: true)           │  │
  │  │  react-router-dom (singleton: true)           │  │
  │  │  @company/design-system (singleton: true)     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  DO NOT SHARE: Business logic, state management      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Each micro-frontend bundles its own:         │  │
  │  │  zustand, @tanstack/react-query, date-fns     │  │
  │  │  (independent versions, no coordination)      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  DESIGN SYSTEM: Published as npm package             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  @company/design-system                       │  │
  │  │  • Button, Input, Modal, Table, etc.          │  │
  │  │  • Design tokens (colors, spacing, fonts)     │  │
  │  │  • Shared as singleton via Module Federation  │  │
  │  │  • Semantic versioning for breaking changes   │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Single-SPA — Runtime Composition

```typescript
// root-config.ts (single-spa orchestrator)
import { registerApplication, start } from 'single-spa';

// Register micro-frontends
registerApplication({
  name: '@company/dashboard',
  app: () => System.import('@company/dashboard'),
  activeWhen: ['/dashboard'],
});

registerApplication({
  name: '@company/billing',
  app: () => System.import('@company/billing'),
  activeWhen: ['/billing'],
});

registerApplication({
  name: '@company/settings',
  app: () => System.import('@company/settings'),
  activeWhen: ['/settings'],
});

// Shared navbar (always active)
registerApplication({
  name: '@company/navbar',
  app: () => System.import('@company/navbar'),
  activeWhen: ['/'],
});

start();
```

```typescript
// dashboard/src/company-dashboard.ts (single-spa lifecycle)
import React from 'react';
import ReactDOM from 'react-dom';
import singleSpaReact from 'single-spa-react';
import DashboardApp from './DashboardApp';

const lifecycles = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: DashboardApp,
  errorBoundary(err, info, props) {
    return <div>Dashboard failed to load</div>;
  },
});

export const { bootstrap, mount, unmount } = lifecycles;
```

---

## 7. CSS Isolation

```css
/* Strategy 1: CSS Modules (per micro-frontend) */
/* Each micro-frontend uses CSS Modules — class names are unique */
.container_abc123 { }  /* dashboard */
.container_def456 { }  /* billing */

/* Strategy 2: Shadow DOM (Web Components) */
/* Styles completely isolated inside shadow root */

/* Strategy 3: CSS-in-JS with scoped styles */
/* styled-components/emotion generate unique class names */

/* Strategy 4: BEM with team prefix */
.dashboard__widget { }
.billing__invoice-table { }

/* Strategy 5: CSS Layers */
@layer dashboard {
  .widget { background: #fff; }
}
@layer billing {
  .widget { background: #f0f0f0; }
}
```

---

## 8. Testing Micro-Frontends

```
  TESTING STRATEGY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  UNIT + COMPONENT (per micro-frontend):              │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Each micro-frontend has its own test suite    │  │
  │  │  Vitest + Testing Library (standard setup)     │  │
  │  │  Mock shared dependencies                     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  INTEGRATION (composition):                          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Test micro-frontend loading in shell          │  │
  │  │  Verify routing between micro-frontends        │  │
  │  │  Test event communication                      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  E2E (full system):                                  │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Playwright tests against composed app         │  │
  │  │  Test critical user flows across MFEs          │  │
  │  │  Run in staging environment                    │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Micro-frontends for small teams** | 5-person team splits app into 3 micro-frontends — overhead exceeds benefit | Use a monolith with good module boundaries (Nx, Turborepo) |
| **Shared global state** | Shared Redux store between micro-frontends — changes break everyone | NO shared state; communicate via events or URL params |
| **No shared design system** | Each micro-frontend looks different — inconsistent UX | Publish shared design system package; enforce via visual regression |
| **Duplicate frameworks** | Dashboard (React 18) + Billing (React 17) + Settings (Vue 3) — 500KB framework code | Share framework as singleton; minimize technology diversity |
| **Tight version coupling** | All micro-frontends must deploy together because of shared dependency version | Use `requiredVersion: '^18.0.0'` (range, not exact) in Module Federation |
| **No error boundaries per MFE** | One micro-frontend crash takes down entire app | Wrap each micro-frontend in ErrorBoundary with fallback |
| **CSS leaking between MFEs** | Dashboard styles override Billing table — visual bugs | Use CSS Modules, Shadow DOM, or CSS-in-JS for isolation |
| **Over-communication** | Event bus has 50+ event types — micro-frontends are implicitly coupled | Minimize events to 5-10 critical cross-cutting concerns |
| **No contract testing** | Remote micro-frontend changes API shape — shell breaks | Define and test typed event contracts between teams |
| **Premature micro-frontends** | Team adopts micro-frontends because it's "modern" — no actual pain to solve | Only adopt when team size, deployment frequency, or technology diversity demands it |

---

## 10. Enforcement Checklist

### Architecture Decision
- [ ] Team size justifies micro-frontends (100+ frontend developers)
- [ ] Clear domain boundaries identified (each MFE owns a product area)
- [ ] Independent deployment requirement confirmed
- [ ] Alternative approaches evaluated (monorepo with Nx, modular monolith)

### Technical Setup
- [ ] Module Federation or single-spa configured
- [ ] Shared dependencies declared as singletons (React, design system)
- [ ] Each micro-frontend has independent build and deploy pipeline
- [ ] Error boundaries wrap each micro-frontend at shell level
- [ ] CSS isolation strategy in place (CSS Modules, Shadow DOM)

### Communication
- [ ] Cross-MFE communication uses custom events or URL params
- [ ] NO shared state stores between micro-frontends
- [ ] Event contract types defined in shared package
- [ ] Maximum 5-10 cross-cutting events defined

### Quality
- [ ] Each micro-frontend has its own test suite (unit + component)
- [ ] Integration tests verify MFE loading and routing in shell
- [ ] E2E tests cover critical cross-MFE user flows
- [ ] Shared design system enforced via visual regression testing
- [ ] Performance budget per micro-frontend (bundle size, load time)
