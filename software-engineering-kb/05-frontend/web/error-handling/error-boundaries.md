# Error Boundaries — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to handle errors in React?", "error boundary setup", "componentDidCatch", "react-error-boundary", "error fallback UI", "Suspense error handling", "Vue errorCaptured", "Angular ErrorHandler", "Svelte error handling", "+error.svelte", "error recovery", or any error boundary question, ALWAYS consult this directive. Error boundaries prevent a single component crash from taking down the entire application. ALWAYS wrap route-level components in error boundaries. ALWAYS use the `react-error-boundary` library — not raw class components. ALWAYS provide a meaningful fallback UI with a retry action. NEVER catch errors silently — ALWAYS log to error monitoring (Sentry).

**Core Rule: EVERY application MUST have error boundaries at three levels: app-level (catches everything), route-level (isolates page crashes), and feature-level (isolates widget failures). Use the `react-error-boundary` library with `ErrorBoundary` component and `useErrorBoundary` hook. EVERY error boundary MUST log errors to monitoring (Sentry) AND show a user-friendly fallback with a retry option. NEVER show raw error messages or stack traces to users in production.**

---

## 1. Error Boundary Architecture

```
  ERROR BOUNDARY PLACEMENT STRATEGY

  ┌──────────────────────────────────────────────────────┐
  │  APP-LEVEL BOUNDARY (catches everything)             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Fallback: "Something went wrong. Reload."    │  │
  │  │  Catches: Unhandled errors from entire app    │  │
  │  │                                                │  │
  │  │  ┌──────────────────────────────────────────┐  │  │
  │  │  │  LAYOUT (nav, sidebar — always visible)  │  │  │
  │  │  │                                          │  │  │
  │  │  │  ┌────────────────────────────────────┐  │  │  │
  │  │  │  │  ROUTE-LEVEL BOUNDARY              │  │  │  │
  │  │  │  │  Fallback: "Page failed to load"   │  │  │  │
  │  │  │  │                                    │  │  │  │
  │  │  │  │  ┌──────────┐  ┌──────────────┐   │  │  │  │
  │  │  │  │  │ FEATURE  │  │ FEATURE      │   │  │  │  │
  │  │  │  │  │ BOUNDARY │  │ BOUNDARY     │   │  │  │  │
  │  │  │  │  │          │  │              │   │  │  │  │
  │  │  │  │  │ Chart ❌ │  │ Comments ✅  │   │  │  │  │
  │  │  │  │  │ (error)  │  │ (still works)│   │  │  │  │
  │  │  │  │  └──────────┘  └──────────────┘   │  │  │  │
  │  │  │  └────────────────────────────────────┘  │  │  │
  │  │  │                                          │  │  │
  │  │  └──────────────────────────────────────────┘  │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘

  RULE: A feature-level crash should NOT break the entire page.
  Navigation should ALWAYS remain functional.
```

---

## 2. React Error Boundaries

### 2.1 react-error-boundary Library (Recommended)

```tsx
// Install: npm install react-error-boundary
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';

// Fallback component — what users see when something crashes
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="error-fallback">
      <h2>Something went wrong</h2>
      <p>We're sorry for the inconvenience. Please try again.</p>

      {/* Show error details in development only */}
      {process.env.NODE_ENV === 'development' && (
        <details>
          <summary>Error details</summary>
          <pre>{error.message}</pre>
        </details>
      )}

      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  );
}

// App-level boundary
function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        // Log to error monitoring
        Sentry.captureException(error, {
          extra: { componentStack: errorInfo.componentStack },
        });
      }}
      onReset={() => {
        // Clear any stale state that caused the error
        window.location.href = '/';
      }}
    >
      <AppRoutes />
    </ErrorBoundary>
  );
}
```

### 2.2 Route-Level Error Boundaries

```tsx
// Route-level boundary — keeps navigation working
function RouteErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="route-error">
      <h1>Page Error</h1>
      <p>This page encountered an error. You can try reloading or go back.</p>
      <div>
        <button onClick={resetErrorBoundary}>Retry</button>
        <a href="/">Go Home</a>
      </div>
    </div>
  );
}

// Wrap each route
function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ErrorBoundary
              FallbackComponent={RouteErrorFallback}
              resetKeys={['/dashboard']}    // auto-reset on navigation
              onError={(error) => Sentry.captureException(error)}
            >
              <DashboardPage />
            </ErrorBoundary>
          }
        />
        <Route
          path="/settings"
          element={
            <ErrorBoundary
              FallbackComponent={RouteErrorFallback}
              resetKeys={['/settings']}
              onError={(error) => Sentry.captureException(error)}
            >
              <SettingsPage />
            </ErrorBoundary>
          }
        />
      </Routes>
    </Layout>
  );
}
```

### 2.3 Feature-Level Error Boundaries

```tsx
// Feature-level — isolates widget crashes
function FeatureErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="feature-error">
      <p>This section failed to load.</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="dashboard-grid">
      <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
        <RevenueChart />
      </ErrorBoundary>

      <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
        <RecentOrders />
      </ErrorBoundary>

      <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
        <UserActivity />
      </ErrorBoundary>
    </div>
  );
}
```

### 2.4 useErrorBoundary Hook

```tsx
// Programmatic error throwing from hooks or event handlers
import { useErrorBoundary } from 'react-error-boundary';

function UserProfile({ userId }: { userId: string }) {
  const { showBoundary } = useErrorBoundary();

  const handleDelete = async () => {
    try {
      await deleteUser(userId);
    } catch (error) {
      // Show error boundary fallback
      showBoundary(error);
    }
  };

  return <button onClick={handleDelete}>Delete Account</button>;
}

// NOTE: Error boundaries only catch:
// ✓ Render errors (in component body)
// ✓ Lifecycle errors (useEffect, componentDidMount)
// ✓ Errors thrown via showBoundary()
//
// Error boundaries do NOT catch:
// ✗ Event handler errors (use try/catch)
// ✗ Async code (use showBoundary or catch)
// ✗ Server-side rendering errors
// ✗ Errors in the error boundary itself
```

### 2.5 Suspense + Error Boundary Composition

```tsx
// Suspense handles loading, ErrorBoundary handles errors
function DataSection() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<Skeleton />}>
        <AsyncDataComponent />
      </Suspense>
    </ErrorBoundary>
  );
}

// With React Query — errors bubble to boundary
function AsyncDataComponent() {
  const { data } = useSuspenseQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    // Errors automatically caught by nearest ErrorBoundary
  });

  return <UserList users={data} />;
}

// Combined wrapper for common pattern
function AsyncBoundary({
  children,
  fallback,
  errorFallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
  errorFallback: FallbackProps['FallbackComponent'] extends undefined ? never : React.ComponentType<FallbackProps>;
}) {
  return (
    <ErrorBoundary FallbackComponent={errorFallback}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
```

### 2.6 resetKeys — Auto-Reset on Navigation

```tsx
// resetKeys: boundary resets when these values change
function App() {
  const location = useLocation();

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      resetKeys={[location.pathname]}    // reset when URL changes
    >
      <Routes>{/* ... */}</Routes>
    </ErrorBoundary>
  );
}

// Also reset on data changes
<ErrorBoundary
  FallbackComponent={ErrorFallback}
  resetKeys={[userId, teamId]}          // reset when user/team changes
>
  <TeamDashboard userId={userId} teamId={teamId} />
</ErrorBoundary>
```

---

## 3. Framework-Specific Error Handling

### 3.1 Vue — errorCaptured + onErrorCaptured

```vue
<!-- ErrorBoundary.vue -->
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const error = ref<Error | null>(null);

onErrorCaptured((err: Error) => {
  error.value = err;

  // Log to Sentry
  Sentry.captureException(err);

  return false;  // prevent error from propagating further
});

function reset() {
  error.value = null;
}
</script>

<template>
  <div v-if="error" role="alert" class="error-fallback">
    <h2>Something went wrong</h2>
    <p>{{ error.message }}</p>
    <button @click="reset">Try Again</button>
  </div>
  <slot v-else />
</template>
```

```vue
<!-- Usage -->
<template>
  <ErrorBoundary>
    <DashboardWidget />
  </ErrorBoundary>
</template>
```

```typescript
// Global error handler (Vue)
// main.ts
const app = createApp(App);

app.config.errorHandler = (err, instance, info) => {
  Sentry.captureException(err, {
    extra: { component: instance?.$options.name, info },
  });
  console.error('Vue error:', err, info);
};

app.config.warnHandler = (msg, instance, trace) => {
  // Only in development
  console.warn('Vue warning:', msg, trace);
};
```

### 3.2 Angular — ErrorHandler

```typescript
// global-error-handler.ts
import { ErrorHandler, Injectable, Injector } from '@angular/core';
import * as Sentry from '@sentry/angular';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: Error): void {
    // Log to Sentry
    Sentry.captureException(error);

    // Log to console in development
    console.error('Angular Error:', error);

    // Optionally show error notification
    const notificationService = this.injector.get(NotificationService);
    notificationService.showError('An unexpected error occurred');
  }
}

// app.module.ts
@NgModule({
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
})
export class AppModule {}
```

### 3.3 SvelteKit — +error.svelte

```svelte
<!-- src/routes/+error.svelte (app-level error page) -->
<script lang="ts">
  import { page } from '$app/stores';
</script>

<div role="alert">
  <h1>{$page.status}</h1>

  {#if $page.status === 404}
    <p>Page not found. The page you're looking for doesn't exist.</p>
    <a href="/">Go Home</a>
  {:else if $page.status === 500}
    <p>Something went wrong on our end. Please try again later.</p>
    <button on:click={() => window.location.reload()}>Reload</button>
  {:else}
    <p>{$page.error?.message}</p>
  {/if}
</div>
```

```typescript
// src/hooks.server.ts — server-side error handling
import type { HandleServerError } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';

export const handleError: HandleServerError = ({ error, event }) => {
  Sentry.captureException(error, {
    extra: {
      url: event.url.pathname,
      method: event.request.method,
    },
  });

  return {
    message: 'An unexpected error occurred',
    // NEVER expose internal error details to client
  };
};
```

---

## 4. Next.js Error Handling

```tsx
// app/error.tsx — route-level error boundary (Next.js App Router)
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <p>We apologize for the inconvenience. Please try again.</p>
      <button onClick={reset}>Try Again</button>
    </div>
  );
}
```

```tsx
// app/global-error.tsx — root layout error boundary
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div role="alert">
          <h2>Something went wrong</h2>
          <button onClick={reset}>Try Again</button>
        </div>
      </body>
    </html>
  );
}
```

```tsx
// app/not-found.tsx — 404 page
export default function NotFound() {
  return (
    <div>
      <h1>404 — Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <a href="/">Go Home</a>
    </div>
  );
}
```

---

## 5. Error Recovery Patterns

```
  ERROR RECOVERY STRATEGIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  STRATEGY 1: Retry                                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  User clicks "Try Again"                      │  │
  │  │  ErrorBoundary resets, component re-mounts    │  │
  │  │  BEST FOR: Transient errors (network, timeout)│  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  STRATEGY 2: Navigate Away                           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  User clicks "Go Home" or "Back"              │  │
  │  │  Navigate to safe page                        │  │
  │  │  BEST FOR: State corruption errors            │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  STRATEGY 3: Degrade Gracefully                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Show simplified version without failed part  │  │
  │  │  Rest of page continues to work               │  │
  │  │  BEST FOR: Non-critical feature failures      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  STRATEGY 4: Full Reload                             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  window.location.reload()                     │  │
  │  │  Nuclear option — clears all state            │  │
  │  │  BEST FOR: Corrupted app state                │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No error boundaries** | One broken component crashes entire app — white screen | Add boundaries at app, route, and feature levels |
| **Silent error catching** | `catch (e) {}` — errors disappear, bugs go undetected | ALWAYS log errors to monitoring (Sentry) in catch blocks |
| **Raw error messages in UI** | User sees "TypeError: Cannot read properties of undefined" | Show user-friendly message; details only in dev mode |
| **Only app-level boundary** | Any error shows full-page fallback — destroys navigation context | Add route-level and feature-level boundaries too |
| **No retry option** | Error fallback shows "Something went wrong" with no action | ALWAYS provide a "Try Again" button that resets the boundary |
| **Class component error boundary** | Raw `componentDidCatch` + state management — verbose and fragile | Use `react-error-boundary` library (ErrorBoundary + useErrorBoundary) |
| **Error boundary without logging** | Errors caught by boundary but never reported | `onError` callback MUST send to Sentry/monitoring |
| **Not handling async errors** | `useEffect` throws but error boundary doesn't catch it | Use `showBoundary()` from `useErrorBoundary` in async contexts |
| **No resetKeys** | User navigates to new page but old error boundary stays in error state | Set `resetKeys={[location.pathname]}` to auto-reset on navigation |
| **Stack traces in production** | Development-style error overlay shown to production users | Check `NODE_ENV` — hide technical details in production |

---

## 7. Enforcement Checklist

### Boundary Placement
- [ ] App-level error boundary wraps entire application
- [ ] Route-level error boundaries wrap each page/route
- [ ] Feature-level error boundaries isolate independent widgets
- [ ] Navigation/layout components are OUTSIDE error boundaries (always accessible)

### Error Handling Quality
- [ ] All error boundaries log to monitoring service (Sentry)
- [ ] All error fallbacks show user-friendly message (no stack traces in prod)
- [ ] All error fallbacks include a recovery action (Retry, Go Home, Reload)
- [ ] `useErrorBoundary` used to catch async/event handler errors
- [ ] `resetKeys` configured for auto-reset on navigation

### Framework-Specific
- [ ] React: `react-error-boundary` library used (not raw class components)
- [ ] Next.js: `error.tsx` and `global-error.tsx` created in app directory
- [ ] Vue: `onErrorCaptured` hook + `app.config.errorHandler` configured
- [ ] Angular: Custom `ErrorHandler` class registered
- [ ] SvelteKit: `+error.svelte` pages created at appropriate route levels
