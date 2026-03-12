# Client-Side Rendering (CSR) — Complete Specification

> **AI Plugin Directive:** When building single-page applications (SPAs), evaluating whether CSR is appropriate for a project, or optimizing CSR performance, ALWAYS consult this guide. Apply CSR patterns when the application is behind authentication, highly interactive, or does not require SEO. This guide covers the CSR lifecycle, hydration, performance metrics, shell architecture, and when CSR is the right choice.

**Core Rule: Use CSR ONLY when SEO is NOT required (admin dashboards, internal tools, authenticated apps) AND the application is highly interactive. CSR delivers a blank HTML shell that requires JavaScript to render content — this means NO content is visible until JS downloads, parses, and executes. ALWAYS implement a loading shell, code splitting, and lazy loading to minimize Time to Interactive (TTI). NEVER use CSR for content-driven or marketing pages that need search engine indexing.**

---

## 1. CSR Rendering Lifecycle

```
                    CSR RENDERING TIMELINE

  Browser Request                                              First Paint
       │                                                           │
       ▼                                                           ▼
  ┌─────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────┐
  │ Request  │  │ Receive   │  │ Download     │  │ Parse &  │  │ Render │
  │ HTML     │─▶│ Empty     │─▶│ JS Bundle    │─▶│ Execute  │─▶│ App    │
  │          │  │ Shell     │  │ (main.js)    │  │ React/   │  │ (FCP)  │
  └─────────┘  └──────────┘  └──────────────┘  │ Vue/etc  │  └────────┘
                                                └──────────┘
  Time: ─────────────────────────────────────────────────────────▶

       TTFB          FCP/LCP                    TTI
       (fast)        (SLOW — waiting for JS)    (SLOW)

  PROBLEM: User sees BLANK PAGE until JS loads and executes.
  TTFB is fast (tiny HTML), but FCP/LCP is SLOW (depends on bundle size).
```

### 1.1 What the Browser Receives

```html
<!-- CSR: Server sends a MINIMAL HTML shell -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>App</title>
  <link rel="stylesheet" href="/static/css/main.abc123.css">
</head>
<body>
  <!-- Empty container — NO content until JS runs -->
  <div id="root"></div>

  <!-- JavaScript must download, parse, and execute before ANY content appears -->
  <script src="/static/js/main.def456.js"></script>
</body>
</html>
```

### 1.2 CSR Mounting Process

```typescript
// main.tsx — CSR entry point
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);

// Timeline:
// 1. HTML parsed → empty div#root
// 2. JS bundle downloaded (100KB - 2MB+)
// 3. JS parsed and executed
// 4. React tree created in memory (Virtual DOM)
// 5. DOM nodes created and inserted into div#root
// 6. CSS applied → First Contentful Paint (FCP)
// 7. Event listeners attached → Time to Interactive (TTI)
// 8. Data fetched → Content visible (may cause layout shift)
```

---

## 2. Performance Metrics Impact

```
  CSR PERFORMANCE CHARACTERISTICS:

  ┌──────────────┬───────────────────────────────────────────┐
  │ Metric       │ CSR Impact                                │
  ├──────────────┼───────────────────────────────────────────┤
  │ TTFB         │ ✅ FAST — tiny HTML shell, no server work │
  │ FCP          │ ❌ SLOW — waits for JS download + execute │
  │ LCP          │ ❌ SLOW — content renders after JS        │
  │ TTI          │ ❌ SLOW — all JS must load for interactivity│
  │ CLS          │ ⚠️ RISK — content shifts as data loads    │
  │ INP          │ ✅ GOOD — after load, interactions are fast│
  │ Bundle Size  │ ❌ CRITICAL — entire app in initial bundle │
  │ SEO          │ ❌ POOR — empty HTML, JS-dependent content │
  │ Caching      │ ✅ GREAT — static assets, CDN-friendly    │
  │ Offline      │ ✅ GOOD — Service Worker + cached shell    │
  └──────────────┴───────────────────────────────────────────┘
```

---

## 3. App Shell Architecture

```
  APP SHELL PATTERN:

  ┌──────────────────────────────────────────────┐
  │  ┌──────────────────────────────────────┐    │
  │  │         Header / Navigation          │    │  ← Pre-rendered
  │  └──────────────────────────────────────┘    │     in HTML shell
  │                                              │
  │  ┌────────┐  ┌────────────────────────┐     │
  │  │        │  │                        │     │
  │  │  Side  │  │    ┌──────────────┐    │     │
  │  │  bar   │  │    │  Loading...  │    │     │  ← Dynamic content
  │  │        │  │    │  Skeleton    │    │     │     loaded after JS
  │  │        │  │    └──────────────┘    │     │
  │  │        │  │                        │     │
  │  └────────┘  └────────────────────────┘     │
  │                                              │
  │  ┌──────────────────────────────────────┐    │
  │  │              Footer                  │    │  ← Pre-rendered
  │  └──────────────────────────────────────┘    │
  └──────────────────────────────────────────────┘

  The shell (header, sidebar, footer) renders IMMEDIATELY.
  Content area shows skeleton/spinner until data arrives.
```

```typescript
// App shell with code splitting
import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Route-based code splitting — each route is a separate chunk
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <div className="app-shell">
      <Header />
      <div className="app-layout">
        <Sidebar />
        <main>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <Footer />
    </div>
  );
}
```

---

## 4. CSR Optimization Strategies

### 4.1 Code Splitting

```typescript
// ─── Route-based splitting (MUST do) ───
const Dashboard = lazy(() => import('./pages/Dashboard'));

// ─── Component-based splitting (heavy components) ───
const HeavyChart = lazy(() => import('./components/HeavyChart'));

// ─── Conditional splitting (features not always needed) ───
const AdminPanel = lazy(() => import('./features/AdminPanel'));

function App() {
  const { user } = useAuth();
  return (
    <>
      <Suspense fallback={<Skeleton />}>
        {user?.isAdmin && <AdminPanel />}
      </Suspense>
    </>
  );
}

// ─── Prefetching: Load chunks before user navigates ───
function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const prefetchRoute = () => {
    // Trigger dynamic import on hover — browser caches the chunk
    if (to === '/products') import('./pages/Products');
    if (to === '/settings') import('./pages/Settings');
  };

  return (
    <Link to={to} onMouseEnter={prefetchRoute}>
      {children}
    </Link>
  );
}
```

### 4.2 Bundle Optimization

```typescript
// vite.config.ts — Optimize CSR bundle
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
    // Target modern browsers for smaller output
    target: 'es2022',
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // Remove console.log in production
        drop_debugger: true,
      },
    },
  },
});
```

### 4.3 Loading Performance

```typescript
// ─── Skeleton loading screens ───
function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-1/3 bg-gray-200 rounded" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Progressive data loading ───
function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Critical data — loads first */}
      <Suspense fallback={<MetricsSkeleton />}>
        <KeyMetrics />
      </Suspense>

      {/* Secondary data — can wait */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      {/* Below fold — loads last */}
      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}
```

---

## 5. CSR Routing

```typescript
// CSR uses client-side routing — NO server round-trips for navigation

// React Router v6 — standard CSR router
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: 'products',
        element: <Products />,
        loader: async () => {
          // Route loaders prefetch data during navigation
          return queryClient.ensureQueryData({
            queryKey: ['products'],
            queryFn: fetchProducts,
          });
        },
      },
      {
        path: 'products/:id',
        element: <ProductDetail />,
        loader: async ({ params }) => {
          return queryClient.ensureQueryData({
            queryKey: ['product', params.id],
            queryFn: () => fetchProduct(params.id!),
          });
        },
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}
```

---

## 6. CSR Data Fetching Patterns

```typescript
// ─── WATERFALL (Bad) — Sequential data fetching ───
function ProductPage({ productId }: { productId: string }) {
  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
  });

  // This query WAITS for product to load first
  const { data: reviews } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => fetchReviews(productId),
    enabled: !!product,  // ❌ Creates waterfall
  });

  return /* ... */;
}

// ─── PARALLEL (Good) — Concurrent data fetching ───
function ProductPage({ productId }: { productId: string }) {
  // Both queries fire at the SAME TIME
  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => fetchReviews(productId),
    // No `enabled` dependency — fires immediately
  });

  return /* ... */;
}

// ─── PREFETCH + RENDER (Best) — Start fetching before render ───
// In route loader
const router = createBrowserRouter([{
  path: '/products/:id',
  element: <ProductPage />,
  loader: async ({ params }) => {
    // Prefetch BOTH queries during route transition
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['product', params.id],
        queryFn: () => fetchProduct(params.id!),
      }),
      queryClient.prefetchQuery({
        queryKey: ['reviews', params.id],
        queryFn: () => fetchReviews(params.id!),
      }),
    ]);
    return null;
  },
}]);
```

---

## 7. SEO Workarounds for CSR

```
  CSR SEO OPTIONS (in order of preference):

  1. DON'T use CSR for SEO pages → Use SSR/SSG instead
     (Best solution — avoid the problem entirely)

  2. Pre-rendering service (Prerender.io)
     Server detects crawlers → serves pre-rendered HTML
     ⚠️ Google DISCOURAGES this approach (cloaking risk)

  3. Hybrid approach
     Marketing/content pages → SSR/SSG
     App pages → CSR (behind auth, no SEO needed)

  4. React Helmet / Head managers
     Manage meta tags in CSR → BUT Googlebot may not execute JS
     ❌ UNRELIABLE for SEO

  VERDICT: If you need SEO, DO NOT use CSR.
  Use Next.js, Nuxt, SvelteKit, or Astro instead.
```

---

## 8. CSR with Service Worker (Offline-First)

```typescript
// Service Worker transforms CSR into offline-capable app

// sw.js
const SHELL_CACHE = 'app-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/static/js/vendor.js',
  '/offline.html',
];

// Pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS))
  );
});

// Serve shell from cache, fetch data from network
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    // For navigation requests — ALWAYS serve the app shell
    event.respondWith(
      caches.match('/index.html').then(response =>
        response || fetch(event.request)
      )
    );
    return;
  }

  // For API requests — network first, cache fallback
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open('api-cache').then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
```

---

## 9. When to Use CSR

| Use Case | CSR Appropriate? | Reason |
|----------|-----------------|--------|
| Admin dashboard | ✅ YES | Behind auth, no SEO, highly interactive |
| Internal tools | ✅ YES | No public access, complex UI |
| SaaS application (post-login) | ✅ YES | Authenticated, no SEO for app content |
| Data visualization | ✅ YES | Heavy client computation, interactive |
| Real-time collaboration | ✅ YES | WebSocket-heavy, instant updates |
| E-commerce storefront | ❌ NO | Needs SEO, fast LCP |
| Blog / documentation | ❌ NO | Content-driven, SEO critical |
| Marketing / landing pages | ❌ NO | SEO critical, fast FCP needed |
| News / media | ❌ NO | Content-driven, many pages, SEO |
| Social media (public feed) | ❌ NO | SEO for shared links, fast loading |

---

## 10. CSR Frameworks and Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Vite + React | Fast dev server, CSR setup | New CSR projects |
| Create React App | Legacy CSR setup | ❌ Deprecated — use Vite |
| React Router | Client-side routing | All CSR React apps |
| TanStack Router | Type-safe routing with loaders | New CSR apps wanting type safety |
| Vue + Vite | Vue CSR setup | Vue CSR projects |
| Angular CLI | Angular CSR setup | Angular CSR projects |

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Using CSR for SEO-critical pages | Pages not indexed, no organic traffic | Use SSR, SSG, or ISR for public content |
| No code splitting | 2MB+ initial bundle, slow TTI | Route-based + component-based code splitting |
| No loading skeletons | Blank white page for seconds | Implement app shell with skeleton screens |
| Data fetching waterfalls | Sequential requests, slow content | Parallel queries, route-level prefetching |
| No bundle analysis | Unknown bloat, unused dependencies | Use `vite-plugin-visualizer` or `webpack-bundle-analyzer` |
| Importing entire libraries | `import _ from 'lodash'` imports 70KB | Use named imports: `import { debounce } from 'lodash-es'` |
| No vendor chunk splitting | Cache bust on every deploy | Separate vendor chunks for stable caching |
| Missing error boundaries | JS error crashes entire app | Add ErrorBoundary at route and feature level |
| No Service Worker for shell | No offline support, no shell caching | Cache app shell with Service Worker |
| Storing all data in client state | No caching, refetch on every mount | Use TanStack Query/SWR for server data |

---

## 12. Enforcement Checklist

- [ ] CSR is used ONLY for applications that don't need SEO (authenticated/internal)
- [ ] App shell pattern implemented (header/sidebar/footer render before content)
- [ ] Route-based code splitting with `React.lazy` and `Suspense`
- [ ] Skeleton/loading states shown during JS load and data fetch
- [ ] Bundle analyzed and vendor chunks separated for cache optimization
- [ ] Tree shaking enabled (ESM imports, sideEffects in package.json)
- [ ] No data fetching waterfalls (parallel queries, route-level prefetch)
- [ ] Service Worker caches app shell and critical static assets
- [ ] Error boundaries at route level to prevent full app crashes
- [ ] Performance budget set (initial JS < 200KB compressed)
- [ ] Lighthouse performance score ≥ 80 on representative pages
- [ ] Dynamic imports for heavy components (charts, editors, maps)
- [ ] Content-driven pages use SSR/SSG instead of CSR
