# React SPA Project Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "how should I structure a React project?", "what's the best folder structure for React?", "should I use feature folders in React?", or "how does Bulletproof React organize code?", use this directive. React has NO official project structure — this is a STRENGTH and a TRAP. Without intentional structure, React projects devolve into chaos. Use feature-first organization with co-located tests, hooks, and types. The Bulletproof React pattern is the industry standard for medium-to-large React SPAs.

---

## 1. The Core Rule

**Organize React projects by FEATURE, not by file type. Each feature is a self-contained module with its own components, hooks, API layer, state, types, and tests. Shared components live in a separate `components/` directory. The `app/` directory handles routing, providers, and application-level setup. NEVER create flat directories with 50+ components — group by feature.**

```
❌ WRONG: Organized by file type (layer-first)
src/
├── components/            ← 80 components mixed together
│   ├── LoginForm.tsx
│   ├── OrderCard.tsx
│   ├── UserProfile.tsx
│   ├── ProductList.tsx
│   └── ... (76 more)
├── hooks/                 ← 30 hooks, all mixed
├── services/              ← All API calls mixed
├── store/                 ← All state slices mixed
└── types/                 ← All types mixed

✅ CORRECT: Organized by feature (Bulletproof React)
src/
├── features/
│   ├── auth/              ← Everything auth-related
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── stores/
│   │   └── types/
│   ├── orders/            ← Everything orders-related
│   └── products/          ← Everything products-related
├── components/            ← ONLY shared UI components
├── hooks/                 ← ONLY shared hooks
├── lib/                   ← Third-party wrappers
└── app/                   ← App shell, routing, providers
```

---

## 2. Complete Project Structure — Small/Medium (Vite + React)

```
my-react-app/
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── app/                              ← Application shell
│   │   ├── App.tsx                       ← Root component
│   │   ├── routes.tsx                    ← Route definitions (React Router)
│   │   ├── providers.tsx                 ← All providers wrapped
│   │   └── main.tsx                      ← Entry point (ReactDOM.render)
│   │
│   ├── features/                         ← Feature modules
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── LoginForm.test.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   └── AuthGuard.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── useAuth.test.ts
│   │   │   ├── api/
│   │   │   │   └── auth.api.ts           ← Login, register, refresh API calls
│   │   │   ├── stores/
│   │   │   │   └── auth.store.ts         ← Zustand/Jotai/Redux slice
│   │   │   ├── types/
│   │   │   │   └── auth.types.ts
│   │   │   └── index.ts                  ← Public API barrel
│   │   │
│   │   ├── orders/
│   │   │   ├── components/
│   │   │   │   ├── OrderList.tsx
│   │   │   │   ├── OrderList.test.tsx
│   │   │   │   ├── OrderCard.tsx
│   │   │   │   ├── OrderDetail.tsx
│   │   │   │   └── CreateOrderForm.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useOrders.ts          ← TanStack Query hook
│   │   │   │   └── useCreateOrder.ts
│   │   │   ├── api/
│   │   │   │   └── orders.api.ts
│   │   │   ├── stores/
│   │   │   │   └── order-filters.store.ts
│   │   │   ├── types/
│   │   │   │   └── order.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── products/
│   │   │   └── ... (same structure)
│   │   │
│   │   └── dashboard/
│   │       └── ... (same structure)
│   │
│   ├── components/                       ← Shared UI components
│   │   ├── ui/                           ← Atomic primitives
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.test.tsx
│   │   │   │   ├── Button.stories.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Select/
│   │   │   ├── DataTable/
│   │   │   └── index.ts                  ← export { Button } from './Button'
│   │   ├── layouts/
│   │   │   ├── MainLayout.tsx
│   │   │   ├── AuthLayout.tsx
│   │   │   └── DashboardLayout.tsx
│   │   └── feedback/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── hooks/                            ← Shared hooks (used by 3+ features)
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useMediaQuery.ts
│   │   └── useIntersectionObserver.ts
│   │
│   ├── lib/                              ← Third-party library wrappers
│   │   ├── axios.ts                      ← Configured axios instance
│   │   ├── query-client.ts              ← TanStack Query client config
│   │   ├── dayjs.ts                      ← dayjs with plugins configured
│   │   └── sentry.ts                     ← Sentry initialization
│   │
│   ├── stores/                           ← Global stores (app-wide state)
│   │   ├── theme.store.ts
│   │   └── notifications.store.ts
│   │
│   ├── types/                            ← Shared types (used across features)
│   │   ├── api.types.ts                  ← ApiResponse<T>, PaginatedResponse<T>
│   │   └── common.types.ts
│   │
│   ├── utils/                            ← Shared pure utility functions
│   │   ├── format-date.ts
│   │   ├── format-currency.ts
│   │   └── cn.ts                         ← className merger (clsx + tailwind-merge)
│   │
│   ├── config/                           ← App configuration
│   │   ├── env.ts                        ← Environment variable validation
│   │   └── constants.ts                  ← App-wide constants
│   │
│   └── testing/                          ← Test utilities
│       ├── render.tsx                    ← Custom render with all providers
│       ├── handlers.ts                   ← MSW request handlers
│       ├── server.ts                     ← MSW server setup
│       └── factories/                    ← Test data factories
│           ├── user.factory.ts
│           └── order.factory.ts
│
├── e2e/                                  ← Playwright E2E tests
│   ├── auth.spec.ts
│   ├── orders.spec.ts
│   └── pages/                            ← Page Object Models
│       ├── login.page.ts
│       └── orders.page.ts
│
├── index.html                            ← Vite entry HTML
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tailwind.config.ts
├── postcss.config.js
├── playwright.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── .env.example
└── package.json
```

---

## 3. Complete Project Structure — Enterprise (Large Team)

```
my-enterprise-app/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── index.tsx                 ← Route definitions
│   │   │   ├── protected-route.tsx       ← Auth-protected wrapper
│   │   │   └── lazy-imports.tsx          ← React.lazy imports for code splitting
│   │   ├── providers/
│   │   │   ├── app-providers.tsx         ← Composes all providers
│   │   │   ├── query-provider.tsx
│   │   │   ├── auth-provider.tsx
│   │   │   └── theme-provider.tsx
│   │   └── main.tsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm/
│   │   │   │   │   ├── LoginForm.tsx
│   │   │   │   │   ├── LoginForm.test.tsx
│   │   │   │   │   ├── LoginForm.stories.tsx
│   │   │   │   │   ├── useLoginForm.ts       ← Form-specific hook
│   │   │   │   │   └── index.ts
│   │   │   │   ├── RegisterForm/
│   │   │   │   ├── ForgotPasswordForm/
│   │   │   │   └── TwoFactorInput/
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── usePermissions.ts
│   │   │   │   └── useSession.ts
│   │   │   ├── api/
│   │   │   │   ├── auth.api.ts
│   │   │   │   └── auth.api.test.ts
│   │   │   ├── stores/
│   │   │   │   └── auth.store.ts
│   │   │   ├── types/
│   │   │   │   ├── auth.types.ts
│   │   │   │   └── permission.types.ts
│   │   │   ├── utils/
│   │   │   │   └── token-storage.ts
│   │   │   ├── constants/
│   │   │   │   └── auth.constants.ts
│   │   │   └── index.ts                      ← Public API
│   │   │
│   │   ├── orders/
│   │   │   ├── components/
│   │   │   │   ├── OrderList/
│   │   │   │   │   ├── OrderList.tsx
│   │   │   │   │   ├── OrderList.test.tsx
│   │   │   │   │   ├── OrderListSkeleton.tsx ← Loading skeleton
│   │   │   │   │   └── index.ts
│   │   │   │   ├── OrderDetail/
│   │   │   │   ├── OrderFilters/
│   │   │   │   ├── CreateOrderWizard/
│   │   │   │   │   ├── CreateOrderWizard.tsx
│   │   │   │   │   ├── steps/
│   │   │   │   │   │   ├── SelectItems.tsx
│   │   │   │   │   │   ├── ShippingInfo.tsx
│   │   │   │   │   │   └── ReviewOrder.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   └── OrderStatusBadge.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useOrders.ts
│   │   │   │   ├── useOrder.ts
│   │   │   │   ├── useCreateOrder.ts
│   │   │   │   └── useOrderFilters.ts
│   │   │   ├── api/
│   │   │   │   ├── orders.api.ts
│   │   │   │   └── orders.api.test.ts
│   │   │   ├── stores/
│   │   │   │   └── order-filters.store.ts
│   │   │   ├── types/
│   │   │   │   └── order.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── products/
│   │   ├── customers/
│   │   ├── analytics/
│   │   ├── settings/
│   │   └── notifications/
│   │
│   ├── components/
│   │   ├── ui/                               ← Design system primitives
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Select/
│   │   │   ├── Modal/
│   │   │   ├── Popover/
│   │   │   ├── Tooltip/
│   │   │   ├── Badge/
│   │   │   ├── Avatar/
│   │   │   ├── DataTable/
│   │   │   ├── Pagination/
│   │   │   ├── Tabs/
│   │   │   ├── Accordion/
│   │   │   └── index.ts
│   │   ├── forms/                            ← Shared form components
│   │   │   ├── FormField.tsx
│   │   │   ├── FormSelect.tsx
│   │   │   ├── FormDatePicker.tsx
│   │   │   └── FormFileUpload.tsx
│   │   ├── layouts/
│   │   │   ├── MainLayout/
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopNav.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── AuthLayout.tsx
│   │   │   └── FullWidthLayout.tsx
│   │   └── feedback/
│   │       ├── ErrorBoundary.tsx
│   │       ├── PageLoading.tsx
│   │       ├── EmptyState.tsx
│   │       └── NotFound.tsx
│   │
│   ├── hooks/
│   ├── lib/
│   ├── stores/
│   ├── types/
│   ├── utils/
│   ├── config/
│   └── testing/
```

---

## 4. Key Organizational Patterns

### Feature Module Structure

```typescript
// features/orders/index.ts — PUBLIC API
// Only these exports are visible to the rest of the app

// Components
export { OrderList } from './components/OrderList';
export { OrderDetail } from './components/OrderDetail';
export { CreateOrderWizard } from './components/CreateOrderWizard';

// Hooks
export { useOrders } from './hooks/useOrders';
export { useOrder } from './hooks/useOrder';

// Types
export type { Order, OrderStatus, CreateOrderInput } from './types/order.types';

// RULE: Everything NOT exported here is PRIVATE to the feature.
// Other features MUST import from the barrel file:
//   import { OrderList, useOrders } from '@/features/orders';
// NOT from internal paths:
//   import { OrderList } from '@/features/orders/components/OrderList/OrderList';
```

### API Layer Pattern

```typescript
// features/orders/api/orders.api.ts
import { api } from '@/lib/axios';
import type { Order, CreateOrderInput } from '../types/order.types';
import type { PaginatedResponse } from '@/types/api.types';

export const ordersApi = {
  getAll: (params?: { page?: number; status?: string }) =>
    api.get<PaginatedResponse<Order>>('/orders', { params }),

  getById: (id: string) =>
    api.get<Order>(`/orders/${id}`),

  create: (data: CreateOrderInput) =>
    api.post<Order>('/orders', data),

  cancel: (id: string) =>
    api.post<Order>(`/orders/${id}/cancel`),
};

// features/orders/hooks/useOrders.ts
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../api/orders.api';

export function useOrders(params?: { page?: number; status?: string }) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => ordersApi.getAll(params),
  });
}
```

### State Management Pattern

```typescript
// features/orders/stores/order-filters.store.ts
// Local feature state — NOT global
import { create } from 'zustand';

interface OrderFiltersState {
  status: string | null;
  dateRange: [Date, Date] | null;
  searchQuery: string;
  setStatus: (status: string | null) => void;
  setDateRange: (range: [Date, Date] | null) => void;
  setSearchQuery: (query: string) => void;
  reset: () => void;
}

export const useOrderFiltersStore = create<OrderFiltersState>((set) => ({
  status: null,
  dateRange: null,
  searchQuery: '',
  setStatus: (status) => set({ status }),
  setDateRange: (dateRange) => set({ dateRange }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  reset: () => set({ status: null, dateRange: null, searchQuery: '' }),
}));

// RULE: Feature-specific state lives in the feature's stores/ directory.
// RULE: Global state (theme, notifications) lives in src/stores/.
// RULE: Server state (API data) is managed by TanStack Query, NOT stores.
```

---

## 5. State Management Decision

```
┌────────────────────────┬───────────────────────────────────────────────┐
│ State Type             │ Tool                                          │
├────────────────────────┼───────────────────────────────────────────────┤
│ Server state           │ TanStack Query (React Query)                  │
│ (API data, caching)    │ NEVER put server data in Redux/Zustand        │
├────────────────────────┼───────────────────────────────────────────────┤
│ Client state (global)  │ Zustand (simple), Jotai (atomic), Redux      │
│ (theme, auth, sidebar) │ Toolkit (complex)                             │
├────────────────────────┼───────────────────────────────────────────────┤
│ Client state (local)   │ useState, useReducer                          │
│ (form inputs, modals)  │ Keep it in the component                      │
├────────────────────────┼───────────────────────────────────────────────┤
│ URL state              │ React Router searchParams, nuqs               │
│ (filters, pagination)  │ Shareable via URL                             │
├────────────────────────┼───────────────────────────────────────────────┤
│ Form state             │ React Hook Form, Formik                       │
│ (validation, dirty)    │ NOT in global store                           │
└────────────────────────┴───────────────────────────────────────────────┘

RULE: Server state and client state are DIFFERENT concerns.
      NEVER store API responses in Redux/Zustand.
      Use TanStack Query for ALL server state.
```

---

## 6. Component Organization Rules

### Component File Structure

```
src/components/ui/Button/
├── Button.tsx              ← Component implementation
├── Button.test.tsx         ← Unit/integration tests
├── Button.stories.tsx      ← Storybook stories
├── Button.module.css       ← CSS modules (or Tailwind in component)
└── index.ts                ← Re-export: export { Button } from './Button'
```

### Component Naming Rules

```typescript
// RULE: Component files use PascalCase
// RULE: One component per file (main export)
// RULE: File name matches component name

// ✅ CORRECT
UserProfile.tsx         → export function UserProfile() {}
OrderCard.tsx           → export function OrderCard() {}
CreateOrderForm.tsx     → export function CreateOrderForm() {}

// ❌ WRONG
userProfile.tsx         → Wrong case
user-profile.tsx        → Wrong case for components
index.tsx               → Component named "index" — ambiguous
order.tsx               → Not descriptive enough
```

### Where Components Go

```
DECISION: Where does this component belong?

Is it used by ONLY one feature?
  → features/{feature}/components/

Is it used by 2+ features?
  → components/ui/ (if it's a UI primitive like Button, Modal)
  → components/layouts/ (if it's a page layout)
  → components/forms/ (if it's a shared form component)
  → components/feedback/ (if it's error/loading/empty state)

Is it used only inside one other component?
  → Co-locate it as a sub-component in the same directory
  → features/orders/components/CreateOrderWizard/steps/SelectItems.tsx
```

---

## 7. Routing Structure

```typescript
// app/routes.tsx — Centralized route definitions
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layouts/MainLayout';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { ProtectedRoute } from './protected-route';

// Lazy-loaded feature pages (code splitting)
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const OrdersPage = lazy(() => import('@/features/orders/pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/features/orders/pages/OrderDetailPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
        ],
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
]);

// RULE: Route definitions in app/routes.tsx — single source of truth.
// RULE: Feature pages are lazy-loaded for code splitting.
// RULE: Layouts are NOT features — they go in components/layouts/.
```

---

## 8. Configuration Files

```
project-root/
├── vite.config.ts              ← Build configuration + path aliases
├── vitest.config.ts            ← Test configuration
├── tsconfig.json               ← TypeScript base config
├── tsconfig.app.json           ← App-specific TS config
├── tsconfig.node.json          ← Node scripts TS config
├── tailwind.config.ts          ← Tailwind CSS configuration
├── postcss.config.js           ← PostCSS with Tailwind plugin
├── playwright.config.ts        ← E2E test configuration
├── .eslintrc.cjs               ← ESLint rules
├── .prettierrc                 ← Prettier formatting
├── .env.example                ← Environment variable template
├── .env.local                  ← Local env (gitignored)
├── components.json             ← shadcn/ui config (if using)
└── package.json
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@components': path.resolve(__dirname, './src/components'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testing/setup.ts',
  },
});
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Flat components folder** | 80+ components in one `components/` directory | Feature-first: `features/{name}/components/` |
| **Server state in Redux** | API data in Redux store, manual cache invalidation | Use TanStack Query for server state |
| **Prop drilling** | Props passed through 5+ levels of components | Use context, Zustand, or TanStack Query |
| **Giant App.tsx** | Providers, routes, error handling all in App.tsx | Split into `app/providers.tsx`, `app/routes.tsx` |
| **No code splitting** | Entire app loaded on first page visit (2MB+ bundle) | `React.lazy()` + `Suspense` for feature pages |
| **No barrel files** | Features expose internal paths, breaking on refactor | `features/orders/index.ts` defines public API |
| **Global CSS** | Single `styles.css` with 5000+ lines | CSS Modules, Tailwind, or styled-components |
| **Tests mirror source** | `tests/components/Button.test.tsx` separate from source | Co-locate: `components/Button/Button.test.tsx` |
| **No custom render** | Every test file sets up providers manually (50 lines each) | Create `testing/render.tsx` with all providers |
| **Mixed state tools** | Redux AND Context AND Zustand AND local state all mixed | Pick ONE client state tool. TanStack Query for server state |
| **No loading/error states** | Components render blank when API is loading | ErrorBoundary + Suspense + skeleton loaders per feature |
| **Importing feature internals** | `import from '@/features/orders/components/OrderCard/OrderCard'` | Import from barrel: `import from '@/features/orders'` |

---

## 10. Enforcement Checklist

- [ ] **Feature-first organization** — each feature has components/, hooks/, api/, types/
- [ ] **Barrel files per feature** — `features/*/index.ts` defines public API
- [ ] **Co-located tests** — `Component.test.tsx` next to `Component.tsx`
- [ ] **TanStack Query for server state** — no API data in Redux/Zustand
- [ ] **Lazy-loaded feature pages** — `React.lazy()` for route-level code splitting
- [ ] **Custom test render** — `testing/render.tsx` with all providers
- [ ] **MSW for API mocking** — `testing/handlers.ts` for test API mocks
- [ ] **Path aliases** — `@/` prefix configured in vite.config.ts + tsconfig.json
- [ ] **No flat components/** — shared components grouped by concern (ui/, layouts/, feedback/)
- [ ] **Centralized routing** — `app/routes.tsx` is single source of truth
- [ ] **Providers extracted** — `app/providers.tsx` composes all providers
- [ ] **Environment validated** — `config/env.ts` validates VITE_* variables at startup

---

## 11. Real-World Examples and References

### Open Source Reference Repositories

| Repository | Stars | Description |
|-----------|-------|-------------|
| `alan2207/bulletproof-react` | 29k+ | THE reference architecture for React apps |
| `t3-oss/create-t3-app` | 26k+ | Full-stack React (Next.js) with tRPC, Prisma |
| `calcom/cal.com` | 33k+ | Real enterprise React + Next.js monorepo |
| `formbricks/formbricks` | 9k+ | Feature-first React structure |
| `highlight/highlight` | 8k+ | Enterprise React SPA with feature modules |

### Companies Using Feature-First Architecture

- **Vercel** — Internal dashboards follow feature-based structure
- **Shopify** — Polaris React components + feature modules
- **Stripe** — Dashboard uses feature-sliced React architecture
- **Linear** — Known for exceptional React architecture
- **Notion** — Complex SPA with feature-based organization

### Provider Composition Pattern

```typescript
// app/providers.tsx — Compose ALL application providers
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { HelmetProvider } from 'react-helmet-async';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/features/auth';
import { Notifications } from '@/components/ui/notifications';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={MainErrorFallback}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ReactQueryDevtools />
          <Notifications />
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

// RULE: Single place to compose all providers.
// RULE: Order matters — ErrorBoundary wraps everything.
// RULE: Providers are NOT inside features — they belong in app/.
```

### Environment Variable Validation

```typescript
// config/env.ts — Validate environment at startup
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_POSTHOG_KEY: z.string().optional(),
});

export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY,
});

// RULE: App crashes immediately on startup if env vars are invalid.
// RULE: NEVER use import.meta.env directly — always go through env.ts.
```

### ESLint Import Boundary Enforcement

```javascript
// .eslintrc.cjs — Enforce feature boundaries
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/features/*/*'],
            message: 'Import from @/features/{name} barrel, not internal paths.',
          },
        ],
      },
    ],
  },
};

// RULE: Enforce this in CI — broken boundaries cause spaghetti code.
```

---

## 12. Comparison: Small vs Enterprise Structure

```
┌──────────────────────┬──────────────────────────────────┬────────────────────────────────────┐
│ Concern              │ Small (1-3 devs, <20 routes)     │ Enterprise (5+ devs, 50+ routes)   │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Components           │ Flat: components/ui/             │ Co-located: ui/Button/Button.tsx    │
│                      │                                  │ + Button.test.tsx + Button.stories  │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Features             │ features/ with minimal nesting   │ Full feature modules with barrel    │
│                      │                                  │ exports and import boundaries       │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ State management     │ TanStack Query + useState        │ TanStack Query + Zustand stores     │
│                      │                                  │ per feature + global store           │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Testing              │ Co-located .test.tsx files       │ MSW + data factories + custom render │
│                      │                                  │ + E2E (Playwright) + Storybook       │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ API layer            │ services/*.service.ts            │ features/*/api/ with queryOptions    │
│                      │                                  │ factories + typed API client          │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Routing              │ Single routes.tsx file           │ app/routes/ with lazy imports +       │
│                      │                                  │ protected routes + code splitting     │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ CI/CD                │ Lint + test                      │ Lint + type-check + test + Storybook  │
│                      │                                  │ + E2E + preview deploys               │
└──────────────────────┴──────────────────────────────────┴────────────────────────────────────┘
```
