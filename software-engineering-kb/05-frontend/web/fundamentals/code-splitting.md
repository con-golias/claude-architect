# Code Splitting — Complete Specification

> **AI Plugin Directive:** When optimizing bundle sizes, implementing lazy loading, configuring chunk splitting, or analyzing bundle composition, ALWAYS consult this guide. Apply these code splitting patterns to minimize initial load times and improve perceived performance. This guide covers route-based splitting, component-based splitting, dynamic imports, React.lazy/Suspense, vendor splitting, prefetching, and bundle analysis.

**Core Rule: ALWAYS split code by route as the baseline strategy — users should NEVER download code for pages they haven't visited. Use React.lazy + Suspense for route-level components. Split vendor libraries into separate chunks for better caching. NEVER lazy-load above-the-fold content. Set and enforce bundle size budgets — initial JS should be under 200KB gzipped for most applications.**

---

## 1. Code Splitting Fundamentals

```
                    WHY CODE SPLITTING MATTERS

  WITHOUT Code Splitting:
  ┌──────────────────────────────────────────────────────┐
  │  Browser downloads ONE massive bundle                 │
  │                                                       │
  │  bundle.js ─── 800KB ───────────────────────────────│
  │  ├── React + ReactDOM (40KB)                          │
  │  ├── Router (10KB)                                    │
  │  ├── Home page (50KB)                                 │
  │  ├── Dashboard (200KB) ← User hasn't visited yet      │
  │  ├── Settings (80KB)   ← User hasn't visited yet      │
  │  ├── Admin (150KB)     ← User may never visit         │
  │  ├── Chart library (120KB) ← Only used in Dashboard   │
  │  └── Other (150KB)                                    │
  │                                                       │
  │  User waits for EVERYTHING before seeing Home page    │
  └──────────────────────────────────────────────────────┘

  WITH Code Splitting:
  ┌──────────────────────────────────────────────────────┐
  │  Browser downloads ONLY what's needed                 │
  │                                                       │
  │  Initial load:                                        │
  │  vendor.js ──── 50KB (React + Router, cached long)   │
  │  main.js ────── 30KB (shell + Home route)            │
  │  home.css ───── 5KB                                  │
  │  Total: 85KB ← User sees content fast                │
  │                                                       │
  │  On navigate to /dashboard:                           │
  │  dashboard.js ── 200KB (loaded on-demand)            │
  │  charts.js ───── 120KB (loaded on-demand)            │
  │                                                       │
  │  On navigate to /admin:                               │
  │  admin.js ────── 150KB (loaded on-demand)            │
  └──────────────────────────────────────────────────────┘

  CODE SPLITTING STRATEGIES:
  ├── Route-based   → Split by page/route (BASELINE — always do this)
  ├── Component-based → Split heavy components (modals, editors, charts)
  ├── Vendor-based  → Split third-party libraries into separate chunks
  ├── Feature-based → Split by feature flag or user role
  └── Library-based → Split individual heavy libraries (e.g., lodash)
```

---

## 2. Dynamic Imports (import())

```
                    DYNAMIC IMPORT MECHANICS

  Static import (bundled together):
  import { Dashboard } from './Dashboard';  ← Always in bundle

  Dynamic import (separate chunk):
  const Dashboard = import('./Dashboard');  ← Separate chunk, loaded on-demand

  HOW IT WORKS:
  ├── Bundler sees import() and creates a separate chunk
  ├── import() returns a Promise that resolves to the module
  ├── Chunk is loaded via network request when import() is called
  ├── Subsequent calls use cached module (no re-fetch)
  └── Works in Webpack, Vite, Rollup, esbuild, Turbopack

  CHUNK NAMING:
  ├── Webpack: /* webpackChunkName: "dashboard" */
  ├── Vite/Rollup: Automatic based on file name
  └── All: manualChunks in rollup config for explicit control
```

```typescript
// Dynamic import patterns

// Basic dynamic import
async function loadDashboard() {
  const module = await import('./pages/Dashboard');
  return module.Dashboard; // Named export
  // or module.default for default export
}

// Webpack magic comments (Webpack-specific)
const Dashboard = import(
  /* webpackChunkName: "dashboard" */
  /* webpackPrefetch: true */
  './pages/Dashboard'
);

// Conditional dynamic import
async function loadEditor(format: 'markdown' | 'richtext') {
  if (format === 'markdown') {
    const { MarkdownEditor } = await import('./editors/MarkdownEditor');
    return MarkdownEditor;
  } else {
    const { RichTextEditor } = await import('./editors/RichTextEditor');
    return RichTextEditor;
  }
}

// Dynamic import with error handling
async function safeImport<T>(importFn: () => Promise<T>): Promise<T> {
  try {
    return await importFn();
  } catch (error) {
    // Handle chunk load failure (common after deployments)
    if (
      error instanceof Error &&
      (error.message.includes('Failed to fetch') ||
       error.message.includes('Loading chunk'))
    ) {
      // Retry once, then reload the page
      try {
        return await importFn();
      } catch {
        window.location.reload();
        throw error;
      }
    }
    throw error;
  }
}
```

---

## 3. Route-Based Splitting (React)

```
                    ROUTE-BASED SPLITTING

  ┌──────────────────────────────────────────────────────┐
  │  This is the MOST impactful code splitting strategy   │
  │                                                       │
  │  Each route = separate chunk                          │
  │  User only downloads chunks for visited routes        │
  │  ALWAYS implement this as a baseline                  │
  └──────────────────────────────────────────────────────┘
```

### 3.1 React.lazy + Suspense (React Router)

```tsx
// app/routes.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PageLoader } from '@/components/PageLoader';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy-load all route components
const Home = lazy(() => import('@/pages/Home'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Settings = lazy(() => import('@/pages/Settings'));
const Profile = lazy(() => import('@/pages/Profile'));
const AdminPanel = lazy(() => import('@/pages/AdminPanel'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// For named exports, use this pattern:
const Analytics = lazy(() =>
  import('@/pages/Analytics').then((module) => ({
    default: module.AnalyticsPage,
  }))
);

export function AppRoutes() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/admin/*" element={<AdminPanel />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

// PageLoader component — shown while route chunk loads
function PageLoader() {
  return (
    <div className="flex h-[calc(100vh-64px)] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
```

### 3.2 Next.js App Router (Automatic Route Splitting)

```tsx
// Next.js App Router AUTOMATICALLY code-splits by route
// Each page.tsx and layout.tsx becomes a separate chunk
// No manual lazy() needed for routes

// app/dashboard/page.tsx — Automatically code-split
export default function DashboardPage() {
  return <Dashboard />;
}

// For client-side dynamic imports within a page:
import dynamic from 'next/dynamic';

// next/dynamic wraps React.lazy with additional features
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Don't SSR this component (client-only)
});

// With named export
const SettingsPanel = dynamic(
  () => import('@/components/Settings').then((mod) => mod.SettingsPanel),
  { loading: () => <SettingsSkeleton /> }
);

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <HeavyChart data={chartData} />
      <SettingsPanel />
    </div>
  );
}
```

---

## 4. Component-Based Splitting

```
                    WHEN TO SPLIT COMPONENTS

  SPLIT these components:
  ├── Modals and dialogs (loaded on user action)
  ├── Rich text editors (heavy — 100KB+)
  ├── Chart libraries (heavy — 50-200KB)
  ├── Code editors (Monaco — 2MB+)
  ├── PDF viewers
  ├── Map components (Mapbox, Google Maps)
  ├── Admin/settings panels (visited infrequently)
  ├── Below-the-fold content on long pages
  └── Feature-flagged components

  DO NOT SPLIT these:
  ├── Navigation/header (always visible)
  ├── Above-the-fold hero content
  ├── Small components (<5KB)
  ├── Components rendered on every page
  ├── Critical UI elements (buttons, inputs)
  └── Layout components
```

### 4.1 Component Splitting Patterns

```tsx
// Pattern 1: Lazy modal
import { lazy, Suspense, useState } from 'react';

const DeleteConfirmDialog = lazy(() => import('./DeleteConfirmDialog'));

function UserActions({ userId }: { userId: string }) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <button onClick={() => setShowDelete(true)}>Delete User</button>

      {/* Modal chunk only loads when showDelete is true */}
      {showDelete && (
        <Suspense fallback={null}>
          <DeleteConfirmDialog
            userId={userId}
            onClose={() => setShowDelete(false)}
          />
        </Suspense>
      )}
    </>
  );
}

// Pattern 2: Lazy heavy component with intersection observer
import { lazy, Suspense, useRef, useState, useEffect } from 'react';

const HeavyChart = lazy(() => import('./HeavyChart'));

function ChartSection({ data }: { data: ChartData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Start loading 200px before viewport
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ minHeight: 400 }}>
      {isVisible ? (
        <Suspense fallback={<ChartSkeleton />}>
          <HeavyChart data={data} />
        </Suspense>
      ) : (
        <ChartSkeleton />
      )}
    </div>
  );
}

// Pattern 3: Feature-flag based splitting
const AdminTools = lazy(() => import('./AdminTools'));
const UserTools = lazy(() => import('./UserTools'));

function Toolbar({ role }: { role: 'admin' | 'user' }) {
  return (
    <Suspense fallback={<ToolbarSkeleton />}>
      {role === 'admin' ? <AdminTools /> : <UserTools />}
    </Suspense>
  );
}

// Pattern 4: Library-level splitting (import only what you need)
// BAD: imports entire lodash (70KB)
import _ from 'lodash';
_.debounce(fn, 300);

// GOOD: imports only debounce (3KB)
import debounce from 'lodash/debounce';
debounce(fn, 300);

// ALSO GOOD: Use native or lightweight alternative
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

---

## 5. Vendor Chunk Splitting

```
                    VENDOR SPLITTING STRATEGY

  WHY split vendor code:
  ├── Vendor code changes LESS frequently than app code
  ├── Separate chunk = better browser caching
  ├── Users keep cached vendor chunk across deploys
  ├── Only app code chunk is re-downloaded on updates
  └── React (40KB) doesn't need to re-download when you fix a typo

  RECOMMENDED CHUNKS:
  ┌─────────────────────────────────────────────────────┐
  │  vendor.js      → React, ReactDOM (rarely changes)  │
  │  router.js      → React Router (changes monthly)    │
  │  ui.js          → UI library, icons (changes often)  │
  │  main.js        → Your app code (changes every deploy)│
  │  [route].js     → Per-route chunks                   │
  └─────────────────────────────────────────────────────┘
```

### 5.1 Webpack splitChunks Configuration

```typescript
// webpack.config.ts — Optimized splitChunks
optimization: {
  splitChunks: {
    chunks: 'all',  // Split both sync and async chunks
    maxInitialRequests: 25,
    minSize: 20000,  // Min 20KB to create a chunk

    cacheGroups: {
      // React core — almost never changes
      reactVendor: {
        test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
        name: 'react-vendor',
        chunks: 'all',
        priority: 40,
      },

      // Router — changes occasionally
      router: {
        test: /[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/,
        name: 'router',
        chunks: 'all',
        priority: 30,
      },

      // Large libraries — split individually
      chartLib: {
        test: /[\\/]node_modules[\\/](recharts|d3|chart\.js)[\\/]/,
        name: 'charts',
        chunks: 'all',
        priority: 20,
      },

      // All other vendor code
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendor',
        chunks: 'all',
        priority: 10,
      },

      // Shared app code (used by 2+ routes)
      commons: {
        minChunks: 2,
        priority: 5,
        reuseExistingChunk: true,
        name: 'commons',
      },
    },
  },
  // Separate runtime chunk (module loading logic)
  runtimeChunk: 'single',
},
```

### 5.2 Vite/Rollup manualChunks

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'router': ['react-router-dom'],
        'ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', 'lucide-react'],
      },
      // OR: Function-based for more control
      manualChunks(id) {
        if (id.includes('node_modules')) {
          // React ecosystem
          if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          // Router
          if (id.includes('react-router')) {
            return 'router';
          }
          // Charts (loaded lazily, don't include in initial vendor)
          if (id.includes('recharts') || id.includes('d3')) {
            return 'charts';
          }
          // Everything else from node_modules
          return 'vendor';
        }
      },
    },
  },
},
```

---

## 6. Prefetching Strategies

```
                    PREFETCH vs PRELOAD

  PRELOAD: High priority — needed for CURRENT page
  ├── <link rel="preload" href="critical.js" as="script">
  ├── Fetched immediately, before browser discovers it
  ├── Use for: critical CSS, fonts, above-the-fold images
  └── WARNING: Preloaded resources not used within 3s trigger console warning

  PREFETCH: Low priority — needed for NEXT navigation
  ├── <link rel="prefetch" href="dashboard.js" as="script">
  ├── Fetched during browser idle time
  ├── Use for: likely next-page chunks
  └── Browser may ignore if bandwidth is constrained

  MODULEPRELOAD: Preload + parse ES module
  ├── <link rel="modulepreload" href="module.js">
  ├── Preloads AND parses the module (faster than preload for JS)
  └── Use for: critical route JS modules
```

### 6.1 Prefetching Implementation

```tsx
// Pattern 1: Webpack magic comments for prefetch/preload
const Dashboard = lazy(() =>
  import(/* webpackPrefetch: true */ './pages/Dashboard')
);
// Webpack adds <link rel="prefetch"> to <head> automatically

const CriticalModal = lazy(() =>
  import(/* webpackPreload: true */ './components/CriticalModal')
);
// Webpack adds <link rel="preload"> to <head>

// Pattern 2: Manual prefetch on hover/focus
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const prefetchRoute = () => {
    // Map routes to their chunk imports
    const routeMap: Record<string, () => Promise<unknown>> = {
      '/dashboard': () => import('./pages/Dashboard'),
      '/settings': () => import('./pages/Settings'),
      '/profile': () => import('./pages/Profile'),
    };

    const loader = routeMap[to];
    if (loader) loader(); // Trigger chunk download
  };

  return (
    <Link
      to={to}
      onMouseEnter={prefetchRoute}  // Prefetch on hover
      onFocus={prefetchRoute}        // Prefetch on focus (keyboard nav)
    >
      {children}
    </Link>
  );
}

// Pattern 3: Prefetch on viewport proximity (Intersection Observer)
function usePrefetchOnVisible(importFn: () => Promise<unknown>) {
  const ref = useRef<HTMLElement>(null);
  const prefetched = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !prefetched.current) {
          prefetched.current = true;
          importFn();
          observer.disconnect();
        }
      },
      { rootMargin: '500px' }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [importFn]);

  return ref;
}

// Pattern 4: Prefetch after idle (requestIdleCallback)
function prefetchAfterIdle(importFn: () => Promise<unknown>) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => importFn());
  } else {
    setTimeout(() => importFn(), 2000);
  }
}

// Call after initial page load
useEffect(() => {
  prefetchAfterIdle(() => import('./pages/Dashboard'));
  prefetchAfterIdle(() => import('./pages/Settings'));
}, []);

// Pattern 5: React Router v6+ with loader-based prefetching
// react-router v6.4+ supports route-level data loading
const router = createBrowserRouter([
  {
    path: '/dashboard',
    lazy: () => import('./pages/Dashboard'), // Code + data split
  },
  {
    path: '/settings',
    lazy: () => import('./pages/Settings'),
  },
]);
```

### 6.2 Next.js Prefetching

```tsx
import Link from 'next/link';

// Next.js Link component prefetches automatically on viewport intersection
<Link href="/dashboard">Dashboard</Link>
// Prefetches /dashboard chunk when link enters viewport

// Disable prefetch for low-priority links
<Link href="/rare-page" prefetch={false}>Rare Page</Link>

// Programmatic prefetch
import { useRouter } from 'next/navigation';

function SearchBar() {
  const router = useRouter();

  return (
    <input
      onFocus={() => {
        // Prefetch search results page when user focuses search
        router.prefetch('/search');
      }}
    />
  );
}
```

---

## 7. Analyzing Bundle Size

```
                    BUNDLE ANALYSIS TOOLS

  ┌───────────────────────────────────────────────────────┐
  │  Tool                     │ Bundler    │ How to use    │
  ├───────────────────────────┼────────────┼───────────────┤
  │ webpack-bundle-analyzer   │ Webpack    │ Plugin        │
  │ rollup-plugin-visualizer  │ Vite       │ Plugin        │
  │ @next/bundle-analyzer     │ Next.js    │ Plugin        │
  │ source-map-explorer       │ Any        │ CLI (needs    │
  │                           │            │ source maps)  │
  │ bundlephobia.com          │ N/A        │ Web (per pkg) │
  │ import-cost (VS Code)     │ N/A        │ IDE extension │
  │ size-limit                │ Any        │ CI/CD check   │
  └───────────────────────────┴────────────┴───────────────┘
```

### 7.1 Setting Up Bundle Analysis

```typescript
// Webpack
// npm install -D webpack-bundle-analyzer
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

plugins: [
  process.env.ANALYZE && new BundleAnalyzerPlugin({
    analyzerMode: 'static',
    openAnalyzer: true,
    reportFilename: 'bundle-report.html',
  }),
].filter(Boolean),

// package.json
// "analyze": "ANALYZE=true npm run build"

// Vite
// npm install -D rollup-plugin-visualizer
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  visualizer({
    open: true,
    gzipSize: true,
    brotliSize: true,
    filename: 'bundle-stats.html',
  }),
],

// Next.js
// npm install -D @next/bundle-analyzer
// next.config.ts
import withBundleAnalyzer from '@next/bundle-analyzer';

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})({
  // ... Next.js config
});
// "analyze": "ANALYZE=true next build"
```

### 7.2 Size Budgets with size-limit

```json
// package.json
{
  "size-limit": [
    {
      "name": "Initial JS",
      "path": "dist/assets/main.*.js",
      "limit": "80 KB",
      "gzip": true
    },
    {
      "name": "Vendor chunk",
      "path": "dist/assets/vendor.*.js",
      "limit": "120 KB",
      "gzip": true
    },
    {
      "name": "Total CSS",
      "path": "dist/assets/*.css",
      "limit": "30 KB",
      "gzip": true
    },
    {
      "name": "Full initial load",
      "path": ["dist/assets/main.*.js", "dist/assets/vendor.*.js", "dist/assets/*.css"],
      "limit": "200 KB",
      "gzip": true
    }
  ],
  "scripts": {
    "size": "size-limit",
    "size:check": "size-limit --json"
  }
}
```

---

## 8. Anti-Patterns

```
CODE SPLITTING ANTI-PATTERNS — NEVER DO THESE:

1. Not splitting by route
   BAD:  Single bundle for all routes
   GOOD: Every route is lazy-loaded
   IMPACT: Users download 5-10x more JS than needed

2. Lazy-loading above-the-fold content
   BAD:  const Hero = lazy(() => import('./Hero'));
   GOOD: import { Hero } from './Hero';  (static import for ATF)
   IMPACT: Content shift, worse LCP, flash of loading state

3. Too many tiny chunks (over-splitting)
   BAD:  Every 2KB component in its own chunk
   GOOD: Split at meaningful boundaries (routes, heavy libs, features)
   IMPACT: HTTP request overhead negates file size savings

4. Not handling chunk load failures
   BAD:  No error handling for failed dynamic imports
   GOOD: ErrorBoundary + retry logic + page reload fallback
   IMPACT: White screen after deployment (old chunks deleted)

5. Importing entire library when you need one function
   BAD:  import _ from 'lodash';  _.debounce(fn, 300);
   GOOD: import debounce from 'lodash/debounce';
   IMPACT: 70KB vs 3KB for one function

6. Not analyzing bundle size
   BAD:  Never running webpack-bundle-analyzer
   GOOD: Analyze on every major change, set budgets in CI
   IMPACT: Silent bundle bloat over time

7. No loading state for lazy components
   BAD:  <Suspense fallback={null}><LazyRoute /></Suspense>
   GOOD: <Suspense fallback={<PageSkeleton />}><LazyRoute /></Suspense>
   IMPACT: Blank screen while chunk loads

8. Prefetching everything
   BAD:  webpackPrefetch: true on every dynamic import
   GOOD: Prefetch only likely next-navigation routes
   IMPACT: Wasted bandwidth, especially on mobile

9. Dynamic import inside render without memoization
   BAD:  function Comp() { const X = lazy(() => import('./X')); }
   GOOD: const X = lazy(() => import('./X'));  // Outside component
   IMPACT: New component created every render, loses state

10. Not splitting CSS
    BAD:  All CSS in one global file
    GOOD: CSS Modules or css code splitting per route
    IMPACT: Users download CSS for pages they never visit
```

---

## 9. Decision Matrix

```
SPLITTING STRATEGY BY COMPONENT TYPE:

  ┌────────────────────────┬──────────┬───────────┬──────────────┐
  │ Component Type         │ Split?   │ Prefetch? │ Strategy     │
  ├────────────────────────┼──────────┼───────────┼──────────────┤
  │ Route pages            │ ALWAYS   │ On hover  │ React.lazy   │
  │ Navigation/Header      │ NEVER    │ N/A       │ Static import│
  │ Footer                 │ MAYBE    │ N/A       │ Intersection │
  │ Modals/Dialogs         │ ALWAYS   │ On hover  │ Lazy + state │
  │ Charts/Visualizations  │ ALWAYS   │ On visible│ Intersection │
  │ Rich text editors      │ ALWAYS   │ On focus  │ Lazy + action│
  │ Map components         │ ALWAYS   │ On visible│ Intersection │
  │ Code editors (Monaco)  │ ALWAYS   │ On focus  │ Lazy + action│
  │ PDF viewers            │ ALWAYS   │ On click  │ Lazy + action│
  │ Admin panels           │ ALWAYS   │ Role-based│ React.lazy   │
  │ Form components        │ NEVER    │ N/A       │ Static import│
  │ Button/Input/Badge     │ NEVER    │ N/A       │ Static import│
  │ Feature-flagged UI     │ ALWAYS   │ No        │ Dynamic flag │
  │ Third-party widgets    │ ALWAYS   │ On visible│ Intersection │
  └────────────────────────┴──────────┴───────────┴──────────────┘
```
