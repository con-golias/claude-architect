# Rendering Strategies — Complete Specification

> **AI Plugin Directive:** When choosing how to render a web application, deciding between CSR/SSR/SSG/ISR/Streaming, optimizing TTFB or TTI, implementing hydration, or architecting a hybrid rendering approach, ALWAYS consult this guide. Apply these rendering strategy rules to achieve optimal performance, SEO, and user experience for each page type. This guide covers CSR, SSR, SSG, ISR, Streaming SSR, Partial Pre-Rendering (PPR), and decision frameworks for choosing the right strategy.

**Core Rule: There is NO single best rendering strategy — choose PER PAGE based on content type, personalization needs, update frequency, and SEO requirements. ALWAYS server-render SEO-critical and above-the-fold content. Use SSG for content that changes infrequently, SSR for personalized or request-time data, ISR for content that updates periodically, and CSR only for authenticated interactive applications where SEO is not required. NEVER use a single rendering strategy for an entire application when pages have different requirements.**

---

## 1. CSR (Client-Side Rendering)

```
                    CSR RENDERING LIFECYCLE

  Browser                                          Server
  ───────                                          ──────
     │                                                │
     │──── GET /app ─────────────────────────────────▶│
     │                                                │
     │◀─── Minimal HTML Shell ────────────────────────│
     │     (empty <div id="root"></div>)              │
     │                                                │
     │     ┌──────────────────┐                       │
     │     │ TTFB: Fast       │  ← Tiny HTML payload  │
     │     │ FCP: SLOW        │  ← Nothing to paint   │
     │     │ Screen: BLANK    │                       │
     │     └──────────────────┘                       │
     │                                                │
     │──── GET /bundle.js (large) ───────────────────▶│
     │◀─── JavaScript Bundle ─────────────────────────│
     │                                                │
     │     ┌──────────────────┐                       │
     │     │ Parse + Execute  │                       │
     │     │ JS Framework     │                       │
     │     │ boots up         │                       │
     │     └──────────────────┘                       │
     │                                                │
     │──── GET /api/data ────────────────────────────▶│
     │◀─── JSON Response ─────────────────────────────│
     │                                                │
     │     ┌──────────────────┐                       │
     │     │ Render Components│                       │
     │     │ into DOM         │                       │
     │     │ FCP: NOW         │  ← First meaningful   │
     │     │ TTI: NOW         │     content appears    │
     │     └──────────────────┘                       │
     │                                                │

  TIMELINE:
  ├─────────┼──────────┼───────────────┼──────────────┤
  TTFB      HTML       JS Downloaded   FCP/LCP/TTI
  (fast)    Parsed     + Executed      (SLOW)
            (empty)    + Data Fetched
```

### 1.1 Performance Metrics in CSR

```
CSR METRIC DEFINITIONS:

TTFB (Time to First Byte):
  - Time from request to first byte of response
  - In CSR: FAST — server sends minimal HTML shell immediately
  - Typical: 50-200ms

FCP (First Contentful Paint):
  - Time until browser renders FIRST piece of content
  - In CSR: SLOW — must download, parse, and execute JS first
  - Typical: 1.5-4s depending on bundle size

LCP (Largest Contentful Paint):
  - Time until the largest visible content element renders
  - In CSR: SLOW — same as FCP or later (after API call)
  - Typical: 2-6s

TTI (Time to Interactive):
  - Time until page is fully interactive (main thread idle)
  - In CSR: Coincides with FCP (components mount with handlers)
  - Typical: 2-5s

CLS (Cumulative Layout Shift):
  - In CSR: HIGH RISK — content loaded asynchronously shifts layout
  - Mitigation: skeleton screens, fixed-dimension containers

CSR METRIC COMPARISON:
  ┌──────────┬────────────┬──────────────┬─────────────────────────┐
  │ Metric   │ CSR        │ SSR          │ SSG                     │
  ├──────────┼────────────┼──────────────┼─────────────────────────┤
  │ TTFB     │ ~100ms     │ ~300-800ms   │ ~50ms (CDN edge)        │
  │ FCP      │ ~2-4s      │ ~300-800ms   │ ~100-300ms              │
  │ LCP      │ ~3-6s      │ ~500ms-1.5s  │ ~200-500ms              │
  │ TTI      │ ~2-5s      │ ~3-6s        │ ~1-3s                   │
  │ CLS      │ High risk  │ Low risk     │ Lowest risk             │
  └──────────┴────────────┴──────────────┴─────────────────────────┘

  KEY INSIGHT:
  - CSR has fast TTFB but slow FCP/LCP (blank screen until JS executes)
  - SSR has slow TTFB but fast FCP (HTML arrives with content)
  - SSR has a TTI GAP: page looks ready but is NOT interactive until hydration
  - SSG has fast everything EXCEPT TTI (still needs hydration)
```

### 1.2 CSR Shell Architecture

```typescript
// ── HTML Shell — The minimal document served by the server ──

// index.html (served for ALL routes in an SPA)
const HTML_SHELL = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>App Name</title>
  <link rel="preconnect" href="https://api.example.com">
  <link rel="preload" href="/assets/main.js" as="script">
  <link rel="stylesheet" href="/assets/critical.css">
  <style>
    /* Inline critical CSS for shell — loading skeleton */
    #root { min-height: 100vh; }
    .shell-header { height: 64px; background: #fff; }
    .shell-sidebar { width: 240px; background: #f5f5f5; }
    .shell-content { flex: 1; }
    .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%; animation: shimmer 1.5s infinite; }
    @keyframes shimmer { to { background-position: -200% 0; } }
  </style>
</head>
<body>
  <div id="root">
    <!-- App Shell: visible immediately, before JS loads -->
    <div class="shell-header">
      <div class="skeleton" style="width: 120px; height: 32px;"></div>
    </div>
    <div style="display: flex;">
      <div class="shell-sidebar">
        <div class="skeleton" style="height: 24px; margin: 16px;"></div>
        <div class="skeleton" style="height: 24px; margin: 16px;"></div>
      </div>
      <div class="shell-content">
        <div class="skeleton" style="height: 200px; margin: 24px;"></div>
      </div>
    </div>
  </div>
  <script type="module" src="/assets/main.js"></script>
</body>
</html>
`;

// ── React CSR Entry Point with Vite ──
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes (was cacheTime)
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

const root = document.getElementById('root')!;

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
```

### 1.3 CSR Routing

```typescript
// ── Client-Side Routing in SPA ──
// All routes handled by JavaScript — server returns same HTML for every route

// React Router v6+ pattern
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// ✅ ALWAYS code-split routes with lazy loading
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <Dashboard />
          </Suspense>
        ),
        // Client-side data loading
        loader: async () => {
          const { getDashboardData } = await import('./api/dashboard');
          return getDashboardData();
        },
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <Settings />
          </Suspense>
        ),
      },
      {
        path: 'profile/:userId',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <Profile />
          </Suspense>
        ),
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

// ── Vue Router CSR Pattern ──
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/pages/Dashboard.vue'), // Lazy-loaded
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/pages/Settings.vue'),
        },
      ],
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    return { top: 0 };
  },
});
```

### 1.4 CSR Bundle Loading Strategies

```
BUNDLE LOADING STRATEGIES:

1. ENTRY POINT BUNDLE (loaded immediately)
   ├── Framework runtime (React, Vue)
   ├── Router
   ├── Global state management
   ├── App shell components
   └── Route manifest

2. ROUTE BUNDLES (loaded on navigation)
   ├── Page component
   ├── Page-specific utilities
   └── Page-specific styles

3. SHARED CHUNKS (loaded when first needed)
   ├── Common UI components
   ├── Shared utilities
   └── Third-party libraries used by 2+ routes

4. ASYNC CHUNKS (loaded on demand)
   ├── Modals / dialogs
   ├── Feature-flagged features
   ├── Admin-only views
   └── Heavy visualizations (charts, editors)

OPTIMIZATION RULES:
  ✅ Code-split at route boundaries (React.lazy, dynamic import)
  ✅ Prefetch next likely routes on hover/visibility
  ✅ Use modulepreload for critical chunks
  ✅ Tree-shake unused exports
  ✅ Set long cache headers with content hashes in filenames
  ❌ NEVER put entire app in a single bundle
  ❌ NEVER import heavy libraries at the entry point
```

```typescript
// ── Vite Configuration for Optimal Chunking ──
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks — cached separately from app code
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          // UI library in its own chunk
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: 'es2022',
    // Report compressed sizes
    reportCompressedSize: true,
    // Chunk size warning at 250KB
    chunkSizeWarningLimit: 250,
  },
});

// ── Prefetch Strategy ──
function prefetchRoute(path: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = path;
  link.as = 'script';
  document.head.appendChild(link);
}

// Prefetch on link hover
function PrefetchLink({ to, children }: { to: string; children: React.ReactNode }) {
  const handleMouseEnter = () => {
    // Trigger route chunk prefetch
    const routeModule = routeManifest[to];
    if (routeModule && !routeModule.loaded) {
      routeModule.preload();
    }
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}
```

### 1.5 When CSR Is Optimal

```
CSR IS THE RIGHT CHOICE WHEN:

  ✅ Authenticated dashboards / admin panels
     - No SEO needed (behind login)
     - Rich interactivity required
     - Personalized content on every page

  ✅ Single-page applications (Gmail, Figma, Notion-like)
     - App-like experience with fast transitions
     - Complex state management across views
     - Offline-capable with Service Workers

  ✅ Internal tools / enterprise apps
     - No public traffic or search indexing
     - Complex forms and workflows
     - Real-time collaborative features

  ✅ Embedded widgets / micro-frontends
     - Loaded inside existing pages
     - Self-contained functionality

CSR IS THE WRONG CHOICE WHEN:

  ❌ SEO-critical pages (landing, blog, product pages)
     - Googlebot CAN render JS but with delays and unreliability
     - Social media crawlers DO NOT execute JavaScript

  ❌ Content-driven sites (blogs, documentation, marketing)
     - Content is available before JS loads with SSR/SSG
     - Core Web Vitals significantly better with server rendering

  ❌ E-commerce product pages
     - SEO is business-critical
     - LCP must be fast for conversion
     - Social sharing requires meta tags in initial HTML

  ❌ Low-powered devices / slow networks
     - Large JS bundles take long to download and parse
     - Users see blank screen for seconds
```

---

## 2. SSR (Server-Side Rendering)

```
                    SSR REQUEST-TIME RENDERING PIPELINE

  Browser                     Server                        Database/API
  ───────                     ──────                        ────────────
     │                           │                              │
     │── GET /products/123 ─────▶│                              │
     │                           │── fetch product data ───────▶│
     │                           │◀─ { name, price, ... } ──────│
     │                           │                              │
     │                           │ ┌──────────────────────┐     │
     │                           │ │ renderToString(       │     │
     │                           │ │   <ProductPage        │     │
     │                           │ │     product={data}    │     │
     │                           │ │   />                  │     │
     │                           │ │ )                     │     │
     │                           │ │                       │     │
     │                           │ │ Produces FULL HTML    │     │
     │                           │ └──────────────────────┘     │
     │                           │                              │
     │◀── Full HTML Document ────│                              │
     │    (complete content      │                              │
     │     visible immediately)  │                              │
     │                           │                              │
     │     ┌──────────────────┐                                 │
     │     │ FCP: FAST         │  ← Content visible immediately │
     │     │ Page LOOKS ready  │                                │
     │     │ but NOT interactive│  ← Hydration gap              │
     │     └──────────────────┘                                 │
     │                                                          │
     │── GET /assets/bundle.js ──▶│                             │
     │◀── JavaScript ────────────│                              │
     │                           │                              │
     │     ┌──────────────────┐                                 │
     │     │ HYDRATION:        │                                │
     │     │ React attaches    │                                │
     │     │ event handlers to │                                │
     │     │ existing DOM      │                                │
     │     │ TTI: NOW          │  ← Page is interactive         │
     │     └──────────────────┘                                 │

  THE HYDRATION GAP:
  ├──────────┼────────────────────────────────┼──────────────────┤
  TTFB       FCP                              TTI
  (slower    (content visible,                (hydration
   than CSR)  LOOKS interactive)               complete,
             ▲                                IS interactive)
             │
             Users may click buttons
             that DON'T WORK YET
             (the "uncanny valley")
```

### 2.1 SSR Data Fetching Patterns

```typescript
// ── Next.js App Router: Server Components (default) ──
// app/products/[id]/page.tsx
// This component runs ONLY on the server — zero client JS

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

// Server Component — fetches data directly, no useEffect needed
export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  // Direct database/API call — runs on server only
  // NEVER exposed to client, no API route needed
  const product = await db.product.findUnique({
    where: { id },
    include: { reviews: { take: 10, orderBy: { createdAt: 'desc' } } },
  });

  if (!product) notFound();

  return (
    <main>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <ProductPrice price={product.price} />

      {/* Client Component for interactivity */}
      <AddToCartButton productId={product.id} />

      {/* Server Component — reviews rendered on server */}
      <ReviewList reviews={product.reviews} />
    </main>
  );
}

// ── Next.js Pages Router: getServerSideProps ──
// pages/products/[id].tsx

import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export const getServerSideProps: GetServerSideProps<{
  product: Product;
}> = async (context) => {
  const { id } = context.params!;

  // Set cache headers for CDN edge caching
  context.res.setHeader(
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=300'
  );

  const product = await fetchProduct(id as string);

  if (!product) {
    return { notFound: true };
  }

  return {
    props: { product },
  };
};

export default function ProductPage({
  product,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <main>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </main>
  );
}

// ── Remix Loader Pattern ──
// app/routes/products.$id.tsx

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const product = await db.product.findUnique({
    where: { id: params.id },
  });

  if (!product) {
    throw new Response('Not Found', { status: 404 });
  }

  // Remix automatically handles serialization
  return json(product, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}

export default function ProductRoute() {
  const product = useLoaderData<typeof loader>();

  return (
    <main>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </main>
  );
}
```

### 2.2 SSR Hydration

```
                    HYDRATION PROCESS

  SERVER-RENDERED HTML                 HYDRATED (INTERACTIVE)
  ┌─────────────────────┐             ┌─────────────────────┐
  │ <button>Buy Now</button>│         │ <button>Buy Now</button>│
  │                      │            │   └─ onClick={handleBuy} │
  │ <input value="John"> │            │ <input value="John">   │
  │                      │            │   └─ onChange={handleChange}│
  │ <div>Product Info</div>│          │ <div>Product Info</div> │
  │                      │            │   └─ onScroll={handleScroll}│
  └─────────────────────┘             └─────────────────────┘

  DOM nodes ALREADY EXIST             React ATTACHES event
  from server HTML.                   handlers to EXISTING
  They are STATIC — no               DOM. Does NOT re-create
  event handlers.                     elements.

  HYDRATION STEPS:
  1. React downloads and executes on client
  2. React builds virtual DOM from component tree
  3. React COMPARES virtual DOM to existing server DOM
  4. If they MATCH: attach event handlers → done
  5. If they MISMATCH: hydration error → React re-renders (bad!)
```

### 2.3 Hydration Mismatch Debugging

```typescript
// ── Common Hydration Mismatch Causes ──

// ❌ CAUSE 1: Using browser-only APIs during render
function BadComponent() {
  // window is undefined on server — different output!
  const width = window.innerWidth; // CRASH on server or mismatch
  return <div>{width > 768 ? 'Desktop' : 'Mobile'}</div>;
}

// ✅ FIX: Use useEffect for browser-only code
function GoodComponent() {
  const [width, setWidth] = useState(0); // Same on server and client initially
  useEffect(() => {
    setWidth(window.innerWidth); // Runs only on client after hydration
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return <div>{width > 768 ? 'Desktop' : 'Mobile'}</div>;
}

// ❌ CAUSE 2: Date/time rendering
function BadTimestamp() {
  return <span>{new Date().toLocaleString()}</span>;
  // Server time !== Client time → mismatch
}

// ✅ FIX: Render dates client-side only
function GoodTimestamp({ iso }: { iso: string }) {
  const [formatted, setFormatted] = useState(iso);
  useEffect(() => {
    setFormatted(new Date(iso).toLocaleString());
  }, [iso]);
  return <time dateTime={iso}>{formatted}</time>;
}

// ❌ CAUSE 3: Random values / IDs
function BadId() {
  return <div id={`el-${Math.random()}`}>Content</div>;
  // Different random value on server vs client
}

// ✅ FIX: Use React.useId()
function GoodId() {
  const id = useId(); // Deterministic across server/client
  return <div id={id}>Content</div>;
}

// ❌ CAUSE 4: Conditional rendering based on typeof window
function BadConditional() {
  if (typeof window !== 'undefined') {
    return <ClientOnlyWidget />;
  }
  return null;
  // Server: null, Client: <ClientOnlyWidget /> → MISMATCH
}

// ✅ FIX: Use suppressHydrationWarning or client-only wrapper
function GoodConditional() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // Match server (null) until hydration complete
  return <ClientOnlyWidget />;
}

// ✅ BEST: Use suppressHydrationWarning for intentional mismatches
function TimestampDisplay({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleDateString()}
    </time>
  );
}

// ── Debugging Hydration Errors in Development ──
// React 18+ shows detailed hydration mismatch warnings in dev console:
//   "Warning: Text content did not match. Server: "March 8" Client: "March 9"
//
// React 19 enhances this with:
//   - Exact diff of server vs client HTML
//   - Component stack trace pointing to the mismatch
//
// DEBUGGING STEPS:
// 1. Check console for "hydration" warnings
// 2. Look for browser-only API usage in render path
// 3. Search for Date, Math.random, window, document, navigator in components
// 4. Check for third-party scripts modifying DOM before hydration
// 5. Verify server and client render with identical props
```

### 2.4 SSR Caching Layers

```
                    SSR CACHING ARCHITECTURE

  User → CDN Edge → Origin Server → Application → Database
         Layer 1     Layer 2         Layer 3       Layer 4

  ┌─────────────────────────────────────────────────────────┐
  │ LAYER 1: CDN Edge Cache (Vercel, Cloudflare, Fastly)    │
  │                                                         │
  │ Cache-Control: public, s-maxage=60, stale-while-        │
  │                revalidate=300                            │
  │                                                         │
  │ ✅ Fastest — response from nearest edge node             │
  │ ✅ s-maxage controls CDN cache (max-age controls browser)│
  │ ✅ stale-while-revalidate serves stale while refetching  │
  │ ⚠️  Cannot cache personalized content at edge            │
  │ ⚠️  Must vary on cookies/auth for personalized pages     │
  └─────────────────────────────────────────────────────────┘
                          │ MISS
                          ▼
  ┌─────────────────────────────────────────────────────────┐
  │ LAYER 2: Reverse Proxy / Nginx Cache                    │
  │                                                         │
  │ ✅ Caches full HTML responses by URL                     │
  │ ✅ Microcaching (1-5 seconds) handles traffic spikes     │
  │ ⚠️  Requires careful cache key design                    │
  └─────────────────────────────────────────────────────────┘
                          │ MISS
                          ▼
  ┌─────────────────────────────────────────────────────────┐
  │ LAYER 3: Application-Level Cache (Redis, LRU)           │
  │                                                         │
  │ ✅ Cache rendered HTML fragments or full pages            │
  │ ✅ Fine-grained invalidation by data change               │
  │ ✅ Cache data fetches independently of render              │
  │                                                         │
  │ Strategy:                                               │
  │   1. Cache data responses (API/DB calls) — 60s-5min     │
  │   2. Cache rendered component HTML — 30s-2min           │
  │   3. Cache full page HTML — 10s-60s                     │
  └─────────────────────────────────────────────────────────┘
                          │ MISS
                          ▼
  ┌─────────────────────────────────────────────────────────┐
  │ LAYER 4: Database Query Cache                           │
  │                                                         │
  │ ✅ Prisma / ORM query cache                              │
  │ ✅ Database-level query cache                            │
  │ ✅ Connection pooling (PgBouncer, Prisma Accelerate)     │
  └─────────────────────────────────────────────────────────┘
```

```typescript
// ── SSR Cache Headers Configuration ──

// Non-personalized pages — cache at CDN edge
function setPublicCacheHeaders(res: Response, maxAge: number = 60): void {
  res.headers.set('Cache-Control',
    `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}`
  );
  // Vary tells CDN which headers affect cache key
  res.headers.set('Vary', 'Accept-Encoding');
}

// Personalized pages — NO CDN cache, short browser cache
function setPrivateCacheHeaders(res: Response): void {
  res.headers.set('Cache-Control',
    'private, no-cache, no-store, must-revalidate'
  );
}

// Semi-personalized — cache at edge, vary by cookie
function setUserAwareCacheHeaders(res: Response): void {
  res.headers.set('Cache-Control',
    'public, s-maxage=10, stale-while-revalidate=60'
  );
  res.headers.set('Vary', 'Accept-Encoding, Cookie');
}

// ── Application-Level SSR Cache with Redis ──
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

async function cachedSSR(
  cacheKey: string,
  renderFn: () => Promise<string>,
  ttlSeconds: number = 60
): Promise<string> {
  // Check cache first
  const cached = await redis.get(`ssr:${cacheKey}`);
  if (cached) return cached;

  // Render and cache
  const html = await renderFn();
  await redis.setex(`ssr:${cacheKey}`, ttlSeconds, html);

  return html;
}

// Invalidate on data change
async function invalidateSSRCache(pattern: string): Promise<void> {
  const keys = await redis.keys(`ssr:${pattern}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

### 2.5 SSR Performance Optimization

```
SSR PERFORMANCE OPTIMIZATION CHECKLIST:

1. DATA FETCHING
   ✅ Parallel data fetching — Promise.all() for independent requests
   ✅ Database connection pooling (PgBouncer, Prisma Accelerate)
   ✅ Edge-deployed databases (PlanetScale, Neon, Turso)
   ✅ Data layer caching (Redis, in-memory LRU)
   ❌ NEVER fetch sequentially when requests are independent (waterfall)
   ❌ NEVER query the database directly from component render without caching

2. RENDERING
   ✅ Use streaming SSR (renderToPipeableStream) over string (renderToString)
   ✅ React Server Components eliminate hydration for static parts
   ✅ Component-level caching for expensive renders
   ❌ NEVER render huge lists server-side — paginate or virtualize
   ❌ NEVER import client-only libraries in server components

3. RESPONSE DELIVERY
   ✅ Compress with gzip/brotli
   ✅ CDN edge caching for non-personalized pages
   ✅ stale-while-revalidate for near-instant cached responses
   ✅ Stream HTML as it renders (do not buffer entire response)

4. HYDRATION
   ✅ Selective hydration — only hydrate interactive components
   ✅ Progressive hydration — hydrate above-fold first
   ✅ React Server Components — zero hydration for server components
   ✅ Minimize client JS bundle — code-split aggressively
```

```typescript
// ── Parallel Data Fetching ──

// ❌ NEVER: Sequential fetching (waterfall)
async function BAD_getPageData(productId: string) {
  const product = await fetchProduct(productId);        // 200ms
  const reviews = await fetchReviews(productId);        // 150ms
  const recommendations = await fetchRecommendations(productId); // 100ms
  // Total: 450ms (sequential)
  return { product, reviews, recommendations };
}

// ✅ ALWAYS: Parallel fetching
async function GOOD_getPageData(productId: string) {
  const [product, reviews, recommendations] = await Promise.all([
    fetchProduct(productId),         // 200ms ─┐
    fetchReviews(productId),         // 150ms ─┤ All in parallel
    fetchRecommendations(productId), // 100ms ─┘
  ]);
  // Total: 200ms (parallel — limited by slowest)
  return { product, reviews, recommendations };
}

// ✅ BEST: Parallel with timeouts and fallbacks
async function BEST_getPageData(productId: string) {
  const [product, reviews, recommendations] = await Promise.allSettled([
    fetchWithTimeout(fetchProduct(productId), 500),
    fetchWithTimeout(fetchReviews(productId), 500),
    fetchWithTimeout(fetchRecommendations(productId), 300),
  ]);

  return {
    product: product.status === 'fulfilled' ? product.value : null,
    reviews: reviews.status === 'fulfilled' ? reviews.value : [],
    recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
  };
}

async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}
```

### 2.6 Node.js vs Edge Runtime for SSR

```
NODE.JS RUNTIME vs EDGE RUNTIME FOR SSR:

  ┌──────────────────┬──────────────────────┬──────────────────────┐
  │ Factor           │ Node.js Runtime      │ Edge Runtime         │
  ├──────────────────┼──────────────────────┼──────────────────────┤
  │ Location         │ Single region or     │ CDN edge (globally   │
  │                  │ few regions          │ distributed)         │
  │ Cold start       │ ~200-500ms           │ ~0-5ms               │
  │ Runtime size     │ Full Node.js         │ V8 Isolate (minimal) │
  │ APIs available   │ ALL Node.js APIs     │ Web APIs subset      │
  │                  │ (fs, crypto, child   │ (fetch, crypto,      │
  │                  │  process, streams)   │  TextEncoder)        │
  │ Max duration     │ 10-60s (configurable)│ 25ms-30s             │
  │ Max memory       │ 128MB-3GB           │ 128MB typically      │
  │ Database access  │ Any driver           │ HTTP-based only      │
  │                  │ (pg, mysql2, etc.)   │ (Prisma Edge,        │
  │                  │                      │  PlanetScale, Neon)  │
  │ NPM packages    │ ALL compatible       │ Edge-compatible only │
  │ File system     │ Full access          │ NO file system       │
  │ Streaming       │ Node streams +       │ Web streams only     │
  │                  │ Web streams          │ (ReadableStream)     │
  │ Pricing model   │ Per-invocation +     │ Per-invocation       │
  │                  │ compute time         │ (cheaper per request)│
  ├──────────────────┼──────────────────────┼──────────────────────┤
  │ Best for         │ Complex SSR with     │ Simple SSR, API      │
  │                  │ heavy dependencies,  │ routes, redirects,   │
  │                  │ full Node APIs,      │ auth middleware,     │
  │                  │ native modules       │ A/B testing at edge  │
  └──────────────────┴──────────────────────┴──────────────────────┘

  DECISION RULE:
  - Default to Node.js runtime for SSR pages with database queries
  - Use Edge runtime for middleware, simple API routes, and SSR pages
    that only call external HTTP APIs
  - Edge runtime CANNOT use: fs, child_process, native npm modules,
    most ORMs in default mode
```

```typescript
// ── Next.js: Choosing Runtime per Route ──

// app/dashboard/page.tsx — Node.js runtime (needs full Node APIs)
export const runtime = 'nodejs'; // default

export default async function DashboardPage() {
  // Full Node.js APIs available
  const data = await prisma.dashboard.findMany({
    include: { metrics: true },
  });
  return <Dashboard data={data} />;
}

// app/api/geo/route.ts — Edge runtime (simple, globally distributed)
export const runtime = 'edge';

export async function GET(request: Request) {
  const country = request.headers.get('x-vercel-ip-country') || 'US';
  return Response.json({ country, greeting: getGreeting(country) });
}

// middleware.ts — ALWAYS runs on edge
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Auth check, redirects, A/B testing, geolocation
  const token = request.cookies.get('session');
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

---

## 3. SSG (Static Site Generation)

```
                    SSG BUILD-TIME RENDERING

  BUILD TIME                                    RUNTIME
  ──────────                                    ───────

  ┌──────────────────────┐
  │ Build Process         │
  │                       │
  │ For each page:        │
  │  1. Fetch data        │
  │  2. Render component  │
  │  3. Generate HTML     │
  │  4. Write .html file  │
  │                       │
  │ pages/blog/post-1.tsx │──▶ out/blog/post-1.html
  │ pages/blog/post-2.tsx │──▶ out/blog/post-2.html
  │ pages/blog/post-3.tsx │──▶ out/blog/post-3.html
  │ pages/about.tsx       │──▶ out/about.html
  │ pages/index.tsx       │──▶ out/index.html
  │                       │
  └──────────────────────┘
           │
           ▼
  ┌──────────────────────┐    ┌──────────────────────┐
  │ Upload to CDN        │    │ User requests page   │
  │                      │    │                      │
  │ Static .html files   │───▶│ CDN serves HTML      │
  │ + JS bundles         │    │ directly from edge   │
  │ + CSS files          │    │ No server needed     │
  │ + Images/assets      │    │ TTFB: ~50ms          │
  │                      │    │ FCP: ~100-300ms      │
  └──────────────────────┘    └──────────────────────┘

  SSG ADVANTAGES:
  ┌──────────────────────────────────────────────────────┐
  │ ✅ Fastest possible TTFB — served from CDN edge       │
  │ ✅ No server runtime cost — just CDN hosting          │
  │ ✅ Maximum reliability — no server to crash           │
  │ ✅ Infinite scalability — CDN handles any traffic     │
  │ ✅ Perfect for SEO — complete HTML always available    │
  │ ✅ Security — no server = minimal attack surface      │
  └──────────────────────────────────────────────────────┘

  SSG LIMITATIONS:
  ┌──────────────────────────────────────────────────────┐
  │ ❌ Build time grows with page count                   │
  │ ❌ Content stale until next build                     │
  │ ❌ Cannot personalize per user at build time          │
  │ ❌ Dynamic data requires client-side fetch            │
  │ ❌ 10,000+ pages = 10+ minute builds                  │
  │ ❌ Environment variables fixed at build time          │
  └──────────────────────────────────────────────────────┘
```

### 3.1 SSG Implementation Patterns

```typescript
// ── Next.js App Router SSG ──
// app/blog/[slug]/page.tsx

// generateStaticParams tells Next.js which pages to pre-render at build time
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// Page component — runs at BUILD TIME, not request time
export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article>
      <h1>{post.title}</h1>
      <time dateTime={post.publishedAt}>
        {new Date(post.publishedAt).toLocaleDateString()}
      </time>
      <div dangerouslySetInnerHTML={{ __html: post.htmlContent }} />
    </article>
  );
}

// Static metadata generation
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  return {
    title: `${post.title} | Blog`,
    description: post.excerpt,
    openGraph: { images: [post.coverImage] },
  };
}

// ── Next.js Pages Router SSG ──
// pages/blog/[slug].tsx

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getAllPosts();
  return {
    paths: posts.map((post) => ({
      params: { slug: post.slug },
    })),
    fallback: false, // 404 for paths not in list
    // fallback: 'blocking' — SSR on first request, then cache (ISR-like)
    // fallback: true — serve fallback UI, then replace with data
  };
};

export const getStaticProps: GetStaticProps<BlogPostProps> = async ({
  params,
}) => {
  const post = await getPostBySlug(params!.slug as string);

  if (!post) {
    return { notFound: true };
  }

  return {
    props: { post },
    // revalidate: 3600, // Adding this makes it ISR (re-generate every hour)
  };
};
```

### 3.2 Markdown/MDX Pipelines

```typescript
// ── MDX Content Pipeline for SSG ──

// content/posts/my-post.mdx
/*
---
title: "Understanding React Server Components"
date: "2025-03-15"
author: "Jane Developer"
tags: ["react", "server-components", "next.js"]
description: "A deep dive into React Server Components architecture"
---

# Understanding React Server Components

React Server Components (RSC) fundamentally change how we think about...

<CodeBlock language="typescript">
{`const data = await db.query('SELECT * FROM users');`}
</CodeBlock>

<Callout type="warning">
  Server Components cannot use hooks like useState or useEffect.
</Callout>
*/

// lib/mdx.ts — MDX processing pipeline
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';

const CONTENT_DIR = path.join(process.cwd(), 'content/posts');

interface PostFrontmatter {
  title: string;
  date: string;
  author: string;
  tags: string[];
  description: string;
}

interface Post {
  slug: string;
  frontmatter: PostFrontmatter;
  content: React.ReactElement;
  readingTime: string;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
    const source = await fs.readFile(filePath, 'utf-8');
    const { data, content: rawContent } = matter(source);

    const { content } = await compileMDX<PostFrontmatter>({
      source: rawContent,
      options: {
        mdxOptions: {
          remarkPlugins: [remarkGfm, remarkToc],
          rehypePlugins: [
            rehypeSlug,
            rehypeHighlight,
            [rehypeAutolinkHeadings, { behavior: 'wrap' }],
          ],
        },
        parseFrontmatter: false, // Already parsed with gray-matter
      },
      components: {
        // Custom MDX components
        CodeBlock,
        Callout,
        Image: OptimizedImage,
      },
    });

    const wordCount = rawContent.split(/\s+/).length;
    const readingTime = `${Math.ceil(wordCount / 200)} min read`;

    return {
      slug,
      frontmatter: data as PostFrontmatter,
      content,
      readingTime,
    };
  } catch {
    return null;
  }
}

export async function getAllPosts(): Promise<
  Array<{ slug: string; frontmatter: PostFrontmatter; readingTime: string }>
> {
  const files = await fs.readdir(CONTENT_DIR);
  const posts = await Promise.all(
    files
      .filter((file) => file.endsWith('.mdx'))
      .map(async (file) => {
        const slug = file.replace('.mdx', '');
        const source = await fs.readFile(
          path.join(CONTENT_DIR, file),
          'utf-8'
        );
        const { data, content } = matter(source);
        const wordCount = content.split(/\s+/).length;

        return {
          slug,
          frontmatter: data as PostFrontmatter,
          readingTime: `${Math.ceil(wordCount / 200)} min read`,
        };
      })
  );

  // Sort by date descending
  return posts.sort(
    (a, b) =>
      new Date(b.frontmatter.date).getTime() -
      new Date(a.frontmatter.date).getTime()
  );
}

// ── Astro Content Collections Pattern ──
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string(),
    tags: z.array(z.string()),
    description: z.string(),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
  }),
});

export const collections = { blog };

// src/pages/blog/[slug].astro
// ---
// import { getCollection, getEntry } from 'astro:content';
// export async function getStaticPaths() {
//   const posts = await getCollection('blog', ({ data }) => !data.draft);
//   return posts.map(post => ({
//     params: { slug: post.slug },
//     props: { post },
//   }));
// }
// const { post } = Astro.props;
// const { Content } = await post.render();
// ---
```

### 3.3 SSG with Dynamic Data

```typescript
// ── Combining SSG with Client-Side Dynamic Data ──

// Page is statically generated at build time
// Dynamic data (user-specific, real-time) fetched on client

// app/products/[id]/page.tsx (Server Component — SSG)
export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((p) => ({ id: p.id }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id); // Fetched at BUILD TIME

  return (
    <main>
      {/* Static content — in the HTML */}
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <StaticProductImages images={product.images} />

      {/* Dynamic content — loaded on client */}
      <Suspense fallback={<PriceSkeleton />}>
        <DynamicPrice productId={id} />  {/* Real-time price */}
      </Suspense>

      <Suspense fallback={<StockSkeleton />}>
        <StockStatus productId={id} />   {/* Real-time availability */}
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <LiveReviews productId={id} />   {/* Latest reviews */}
      </Suspense>
    </main>
  );
}

// components/DynamicPrice.tsx (Client Component)
'use client';

import { useQuery } from '@tanstack/react-query';

export function DynamicPrice({ productId }: { productId: string }) {
  const { data: price, isLoading } = useQuery({
    queryKey: ['price', productId],
    queryFn: () => fetchCurrentPrice(productId),
    refetchInterval: 30_000, // Poll every 30 seconds
  });

  if (isLoading) return <PriceSkeleton />;

  return (
    <div>
      <span className="price">${price?.current.toFixed(2)}</span>
      {price?.wasPrice && (
        <span className="was-price">${price.wasPrice.toFixed(2)}</span>
      )}
    </div>
  );
}
```

### 3.4 CDN Deployment for SSG

```
SSG CDN DEPLOYMENT ARCHITECTURE:

  Build Output:
  ┌───────────────┐
  │ /out           │
  │ ├── index.html │
  │ ├── about.html │
  │ ├── blog/      │
  │ │   ├── post-1.html
  │ │   └── post-2.html
  │ ├── _next/     │
  │ │   ├── static/│     ← Hashed assets (immutable cache)
  │ │   └── chunks/│
  │ └── images/    │
  └───────────────┘
         │
         ▼ Deploy to CDN
  ┌──────────────────────────────────────────────────┐
  │              CDN Edge Network                     │
  │                                                   │
  │  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
  │  │ Edge    │  │ Edge    │  │ Edge    │  ...      │
  │  │ US-East │  │ EU-West │  │ AP-SE   │          │
  │  └────┬────┘  └────┬────┘  └────┬────┘          │
  │       │            │            │                 │
  │  All serve identical static files                 │
  │  TTFB: 10-100ms from nearest edge                │
  │                                                   │
  │  Cache Headers:                                   │
  │  HTML:   Cache-Control: public, max-age=0,        │
  │          s-maxage=31536000, must-revalidate       │
  │  Assets: Cache-Control: public, max-age=31536000, │
  │          immutable                                │
  └──────────────────────────────────────────────────┘

  DEPLOYMENT PLATFORMS:
  ┌────────────┬────────────────────────────────────────┐
  │ Vercel     │ Automatic from Next.js output           │
  │ Netlify    │ Drag-and-drop or git-based deploy       │
  │ Cloudflare │ Cloudflare Pages — closest to edge      │
  │ AWS        │ S3 + CloudFront                         │
  │ GitHub     │ GitHub Pages (for simple sites)         │
  └────────────┴────────────────────────────────────────┘
```

### 3.5 Incremental Builds

```
INCREMENTAL BUILDS — Rebuilding only changed pages:

PROBLEM: 10,000 pages x 200ms each = 33 minutes per build

SOLUTION: Track dependencies, rebuild only what changed

  Full Build (first time):
  ┌────────────────────────────────┐
  │ Build ALL 10,000 pages         │  ← 33 minutes
  │ Generate dependency graph      │
  │ Store content hashes           │
  └────────────────────────────────┘

  Incremental Build (after content change):
  ┌────────────────────────────────┐
  │ Detect changed content files   │
  │ Determine affected pages       │
  │ Rebuild ONLY 5 changed pages   │  ← 2 seconds
  │ Update CDN cache for those     │
  └────────────────────────────────┘

FRAMEWORK SUPPORT:
  ┌────────────┬───────────────────────────────────────┐
  │ Next.js    │ ISR (see Section 4) — revalidate on   │
  │            │ demand without full rebuild            │
  │ Gatsby     │ Incremental builds via Gatsby Cloud    │
  │            │ content digest tracking                │
  │ Astro      │ No built-in incremental — use ISR      │
  │            │ adapter (Vercel, Netlify)              │
  │ Hugo       │ Native incremental — extremely fast    │
  │            │ (~1ms per page)                        │
  └────────────┴───────────────────────────────────────┘
```

---

## 4. ISR (Incremental Static Regeneration)

```
                    ISR — INCREMENTAL STATIC REGENERATION

  CONCEPT: Static pages that REGENERATE in the background
           after a configured time interval or on-demand trigger

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  BUILD TIME: Generate initial static pages                  │
  │                                                             │
  │  REQUEST 1 (t=0):    Serve static page (stale: NO)         │
  │  REQUEST 2 (t=30s):  Serve static page (stale: NO)         │
  │  REQUEST 3 (t=61s):  Serve STALE page → trigger regen     │
  │                       in background                         │
  │  REQUEST 4 (t=62s):  Serve STALE page (regen in progress)  │
  │  REQUEST 5 (t=63s):  Serve FRESH page (regen complete)     │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  STALE-WHILE-REVALIDATE PATTERN:

  Time ──────────────────────────────────────────────────▶

  ├─── revalidate: 60 ───┤
  │                       │
  │  Page is FRESH        │  Page is STALE
  │  Serve cached         │  Serve cached (stale)
  │  No regen             │  Trigger background regen
  │                       │  Next request gets fresh page
  │                       │
  ▼                       ▼
  Build/Regen             Revalidation window
  complete                opens


  ISR vs FULL REBUILD:

  ┌───────────────────┬──────────────────┬──────────────────┐
  │                   │ Full SSG Rebuild │ ISR              │
  ├───────────────────┼──────────────────┼──────────────────┤
  │ Update one page   │ Rebuild ALL pages│ Regenerate ONE   │
  │ Build time        │ O(n) — all pages │ O(1) — one page  │
  │ Freshness delay   │ Minutes (CI/CD)  │ Seconds          │
  │ Infrastructure    │ CI/CD pipeline   │ Runtime server   │
  │ Cost              │ Build minutes    │ Serverless invoke│
  │ Hosting           │ Static CDN only  │ Needs server/    │
  │                   │                  │ serverless       │
  └───────────────────┴──────────────────┴──────────────────┘
```

### 4.1 Time-Based vs Event-Based Revalidation

```typescript
// ── Time-Based Revalidation ──
// app/blog/[slug]/page.tsx

// Revalidate every 60 seconds
export const revalidate = 60;

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  return <Article post={post} />;
}

// ── Event-Based (On-Demand) Revalidation ──
// app/api/revalidate/route.ts

import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const { secret, path, tag } = await request.json();

  // Verify webhook secret
  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 });
  }

  try {
    if (tag) {
      // Revalidate all pages using this cache tag
      revalidateTag(tag);
      return Response.json({ revalidated: true, tag });
    }

    if (path) {
      // Revalidate specific path
      revalidatePath(path);
      return Response.json({ revalidated: true, path });
    }

    return Response.json({ error: 'Missing path or tag' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}

// ── Using Cache Tags for Granular Invalidation ──
// app/products/[id]/page.tsx

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Tag this fetch — allows targeted invalidation
  const product = await fetch(`https://api.example.com/products/${id}`, {
    next: {
      tags: [`product-${id}`, 'products'],
      revalidate: 3600, // Also time-based as fallback
    },
  }).then((r) => r.json());

  return <ProductDetails product={product} />;
}

// When product 123 changes in CMS:
// POST /api/revalidate { secret: "...", tag: "product-123" }
// Only pages using product-123 are regenerated

// When ALL products change (price update):
// POST /api/revalidate { secret: "...", tag: "products" }
// All product pages are regenerated
```

### 4.2 ISR Cache Architecture

```
ISR CACHE ARCHITECTURE:

  ┌─────────────────────────────────────────────────────────────┐
  │                    ISR CACHE FLOW                           │
  │                                                             │
  │  Request                                                    │
  │    │                                                        │
  │    ▼                                                        │
  │  ┌──────────────┐  HIT + FRESH   ┌──────────────┐          │
  │  │ Check Cache  │───────────────▶│ Serve Cached │          │
  │  │              │                │ HTML          │          │
  │  └──────┬───────┘                └──────────────┘          │
  │         │                                                   │
  │         │ HIT + STALE                                       │
  │         │ (past revalidate time)                            │
  │         ▼                                                   │
  │  ┌──────────────┐                ┌──────────────┐          │
  │  │ Serve STALE  │                │ Background   │          │
  │  │ HTML to user │                │ Regeneration │          │
  │  │ (immediate)  │                │ (async)      │          │
  │  └──────────────┘                └──────┬───────┘          │
  │                                         │                   │
  │                                         ▼                   │
  │                                  ┌──────────────┐          │
  │                                  │ Update Cache │          │
  │                                  │ with new HTML│          │
  │                                  └──────────────┘          │
  │         │                                                   │
  │         │ MISS (first request for                           │
  │         │ a new path — not pre-rendered)                    │
  │         ▼                                                   │
  │  ┌──────────────┐                                          │
  │  │ SSR on       │──▶ Cache result ──▶ Serve to user        │
  │  │ first request│    for future       (blocking)            │
  │  └──────────────┘    requests                               │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  CACHE STORAGE:
  ┌────────────────┬───────────────────────────────────────────┐
  │ Vercel         │ Vercel Data Cache — globally distributed  │
  │                │ Shared across all serverless functions     │
  │                │ Supports cache tags for targeted purge    │
  │ Netlify        │ On-Demand Builders + DPR (Distributed     │
  │                │ Persistent Rendering)                     │
  │ Self-hosted    │ File system cache in .next/cache          │
  │                │ ⚠️  NOT shared across instances            │
  │                │ Must use Redis/shared storage for multi   │
  │                │ instance deployments                      │
  │ AWS            │ S3 + Lambda@Edge for ISR behavior         │
  │                │ OpenNext adapter handles cache             │
  └────────────────┴───────────────────────────────────────────┘
```

### 4.3 ISR Limitations

```
ISR LIMITATIONS AND GOTCHAS:

  1. STALE CONTENT IS SERVED
     - Users always get the STALE version while regen happens
     - Not suitable when stale data is unacceptable
       (stock prices, inventory counts, scores)
     - Mitigation: combine with client-side polling for critical data

  2. FIRST REQUEST AFTER BUILD IS SLOW (for new paths)
     - Pages not pre-rendered at build time are SSR'd on first request
     - That first user experiences SSR latency
     - fallback: 'blocking' means user waits for SSR
     - Mitigation: pre-render all known paths at build time

  3. MULTI-INSTANCE CACHE COHERENCE
     - Self-hosted with multiple servers: each has its own cache
     - Different servers may serve different versions
     - Mitigation: use shared cache (Redis) or managed platform (Vercel)

  4. REVALIDATION IS BEST-EFFORT
     - Background regeneration can fail silently
     - Old cached version continues to be served on failure
     - No built-in alerting for regen failures
     - Mitigation: monitor regen errors, set up alerts

  5. NO ATOMIC MULTI-PAGE UPDATES
     - Cannot atomically update related pages together
     - Page A may show new data while page B shows old
     - Mitigation: use on-demand revalidation to trigger all related pages

  6. PREVIEW/DRAFT MODE COMPLEXITY
     - Draft content must bypass ISR cache
     - Requires draft mode / preview mode implementation
     - Different rendering path for editors vs public

  WHEN NOT TO USE ISR:
  ❌ Real-time data (use SSR or CSR)
  ❌ Personalized content per user (use SSR)
  ❌ Content that must be consistent across pages (use full rebuild)
  ❌ Pages that change every few seconds (use SSR with caching)
```

---

## 5. Streaming SSR

```
                    STREAMING SSR WITH REACT 18+

  TRADITIONAL SSR:
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  Server: Fetch ALL data → Render ALL → Send ALL     │
  │                                                     │
  │  ├──── Data Fetch ────┼── Render ──┼── Send ──┤     │
  │  │     (blocking)     │ (blocking) │ (all at  │     │
  │  │     Must wait for  │ Must wait  │  once)   │     │
  │  │     slowest query  │ for all    │          │     │
  │  │                    │ components │          │     │
  │  └────────────────────┴────────────┴──────────┘     │
  │                                                     │
  │  User sees: nothing ──────────────────── full page  │
  │  TTFB: SLOW (sum of all data fetches + render)      │
  │                                                     │
  └─────────────────────────────────────────────────────┘

  STREAMING SSR:
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  Server: Send shell → Stream chunks as ready        │
  │                                                     │
  │  Time ──────────────────────────────────────────▶   │
  │                                                     │
  │  ┌─ Send HTML Shell ─┐                              │
  │  │  <html>           │                              │
  │  │  <head>...</head> │                              │
  │  │  <body>           │                              │
  │  │    <nav>...</nav> │  ← Immediate, no data needed │
  │  │    <main>         │                              │
  │  │      <Suspense    │                              │
  │  │        fallback=  │                              │
  │  │        {loading}  │                              │
  │  │      />           │                              │
  │  └──────────────────┘                              │
  │          │                                          │
  │          │  ← User sees shell + loading states      │
  │          │     TTFB: FAST                           │
  │          │                                          │
  │  ┌─ Stream Chunk 1 ─┐  ← Product data ready        │
  │  │  <template>       │                              │
  │  │  <div hidden       │                              │
  │  │    id="product">  │                              │
  │  │    <h1>Widget</h1>│                              │
  │  │    <p>$99</p>     │                              │
  │  │  </div>           │                              │
  │  │  <script>swap()</script>│← Replaces fallback     │
  │  └──────────────────┘                              │
  │          │                                          │
  │  ┌─ Stream Chunk 2 ─┐  ← Reviews data ready        │
  │  │  <div hidden       │     (was slowest query)     │
  │  │    id="reviews">  │                              │
  │  │    <ReviewList /> │                              │
  │  │  </div>           │                              │
  │  │  <script>swap()</script>│                        │
  │  └──────────────────┘                              │
  │          │                                          │
  │  User sees: shell → product → reviews               │
  │  Progressive — never blocked by slowest query       │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

### 5.1 React Streaming APIs

```typescript
// ── renderToPipeableStream (Node.js) ──
import { renderToPipeableStream } from 'react-dom/server';
import { Transform } from 'stream';

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const { pipe, abort } = renderToPipeableStream(
    <App url={req.url} />,
    {
      bootstrapScripts: ['/assets/client.js'],

      onShellReady() {
        // Shell is ready — headers + initial HTML
        // Shell = everything NOT inside a <Suspense> boundary
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        pipe(res);
      },

      onShellError(error: unknown) {
        // Shell failed to render — send error page
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html');
        res.end('<h1>Server Error</h1>');
        console.error('Shell render error:', error);
      },

      onAllReady() {
        // ALL content (including Suspense) is ready
        // Useful for crawlers that need complete HTML
        // For bots: wait for this instead of onShellReady
      },

      onError(error: unknown) {
        // Log streaming errors (don't crash)
        console.error('Streaming error:', error);
      },
    }
  );

  // Timeout — abort streaming after 10 seconds
  setTimeout(() => {
    abort();
  }, 10000);
}

// ── renderToReadableStream (Edge/Web Streams) ──
async function handleEdgeRequest(request: Request): Promise<Response> {
  const stream = await renderToReadableStream(
    <App url={request.url} />,
    {
      bootstrapScripts: ['/assets/client.js'],

      onError(error: unknown) {
        console.error('Stream error:', error);
      },
    }
  );

  // For bots — wait for complete render
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = /bot|crawler|spider|googlebot/i.test(userAgent);

  if (isBot) {
    await stream.allReady; // Wait for all Suspense boundaries
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
```

### 5.2 Selective Hydration

```
                    SELECTIVE HYDRATION

  Traditional Hydration:
  ┌─────────────────────────────────────────────┐
  │ ENTIRE page hydrates at once                 │
  │ One large JS bundle must execute completely  │
  │ User cannot interact until ALL hydration done│
  └─────────────────────────────────────────────┘

  Selective Hydration (React 18+):
  ┌─────────────────────────────────────────────┐
  │ Page divided into independent Suspense zones │
  │ Each zone hydrates independently              │
  │ User interaction PRIORITIZES that zone       │
  │                                               │
  │  ┌──────┐ ┌──────────────────┐ ┌──────────┐ │
  │  │ Nav  │ │ Product Section  │ │ Sidebar  │ │
  │  │      │ │                  │ │          │ │
  │  │ ■■■  │ │ ■■■■■■■■■■■■    │ │ ░░░░     │ │
  │  │hydra-│ │ hydrated (user   │ │ not yet  │ │
  │  │ted   │ │ clicked here →   │ │ hydrated │ │
  │  │      │ │ prioritized!)    │ │          │ │
  │  └──────┘ └──────────────────┘ └──────────┘ │
  │                                               │
  │  ■ = hydrated   ░ = pending hydration        │
  │                                               │
  │  If user clicks sidebar before it hydrates:   │
  │  → React PRIORITIZES sidebar hydration        │
  │  → Replays the click event after hydration    │
  └─────────────────────────────────────────────┘
```

```typescript
// ── Streaming SSR with Suspense Boundaries ──
// app/products/[id]/page.tsx

import { Suspense } from 'react';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // This data is needed for the shell — fetched before streaming starts
  const product = await getProduct(id);

  return (
    <main>
      {/* Shell content — sent immediately */}
      <h1>{product.name}</h1>
      <p>{product.description}</p>

      {/* Suspense boundary 1 — streams when product details ready */}
      <Suspense fallback={<DetailsSkeleton />}>
        <ProductDetails productId={id} />
      </Suspense>

      {/* Suspense boundary 2 — streams when reviews ready */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={id} />
      </Suspense>

      {/* Suspense boundary 3 — streams when recommendations ready */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations productId={id} />
      </Suspense>
    </main>
  );
}

// Each of these is an async Server Component
// They can independently fetch data and stream when ready

async function ProductReviews({ productId }: { productId: string }) {
  // This fetch might take 2 seconds — that's OK
  // The rest of the page is already visible
  const reviews = await fetch(
    `https://api.example.com/products/${productId}/reviews`,
    { next: { revalidate: 300 } }
  ).then((r) => r.json());

  return (
    <section>
      <h2>Reviews ({reviews.length})</h2>
      {reviews.map((review: Review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </section>
  );
}

async function Recommendations({ productId }: { productId: string }) {
  // Slowest query — no problem, streams last
  const recs = await getRecommendations(productId);

  return (
    <section>
      <h2>You might also like</h2>
      <div className="grid grid-cols-4 gap-4">
        {recs.map((product: Product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
```

### 5.3 Out-of-Order Streaming

```
OUT-OF-ORDER STREAMING:

  Page Layout:
  ┌────────────────────────────────────────────┐
  │ Header (immediate — no data needed)        │ ← Sent first
  ├────────────────────────────────────────────┤
  │ Product Info    │  Sidebar                 │
  │ (200ms fetch)   │  (500ms fetch)           │
  │                 │                          │
  │ Suspense #1     │  Suspense #2             │
  ├────────────────────────────────────────────┤
  │ Reviews (2000ms fetch)                     │
  │                                            │
  │ Suspense #3                                │
  ├────────────────────────────────────────────┤
  │ Footer (immediate)                         │ ← Sent with shell
  └────────────────────────────────────────────┘

  STREAMING ORDER (by data availability, NOT DOM order):
  1. Shell: Header + Footer + all fallbacks     (t=0ms)
  2. Chunk: Product Info replaces fallback #1    (t=200ms)
  3. Chunk: Sidebar replaces fallback #2         (t=500ms)
  4. Chunk: Reviews replaces fallback #3         (t=2000ms)

  The HTML for each chunk is sent as a <template> element
  with an inline <script> that swaps it into the correct
  Suspense boundary location — even though it arrives
  OUT OF DOM ORDER.

  BROWSER RENDERING DURING STREAMING:
  t=0ms:     Header | [Loading...] | [Loading...] | Footer
  t=200ms:   Header | Product Info | [Loading...] | Footer
  t=500ms:   Header | Product Info | Sidebar      | Footer
  t=2000ms:  Header | Product Info | Sidebar      | Footer
                     | Reviews                     |
```

### 5.4 Streaming in Next.js and Remix

```typescript
// ── Next.js App Router: Streaming is AUTOMATIC ──
// Every async Server Component inside <Suspense> streams automatically

// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Each Suspense boundary streams independently */}
      <Suspense fallback={<MetricCardSkeleton />}>
        <RevenueMetrics />    {/* Async server component */}
      </Suspense>

      <Suspense fallback={<MetricCardSkeleton />}>
        <UserMetrics />       {/* Async server component */}
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />      {/* Async server component */}
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <SalesChart />        {/* Async server component */}
      </Suspense>
    </div>
  );
}

// ── Next.js loading.tsx — Page-level Suspense ──
// app/dashboard/loading.tsx
// Automatically wraps page in Suspense with this as fallback
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}

// ── Remix: defer() for Streaming ──
// app/routes/dashboard.tsx

import { defer } from '@remix-run/node';
import { Await, useLoaderData } from '@remix-run/react';
import { Suspense } from 'react';

export async function loader() {
  // Critical data — AWAIT before sending shell
  const user = await getUser();

  // Non-critical data — DEFER and stream later
  const revenuePromise = getRevenueMetrics();   // Don't await!
  const ordersPromise = getRecentOrders();       // Don't await!

  return defer({
    user,                         // Resolved — in initial HTML
    revenue: revenuePromise,      // Promise — will stream
    orders: ordersPromise,        // Promise — will stream
  });
}

export default function Dashboard() {
  const { user, revenue, orders } = useLoaderData<typeof loader>();

  return (
    <div>
      {/* Immediately available */}
      <h1>Welcome, {user.name}</h1>

      {/* Streams when ready */}
      <Suspense fallback={<MetricsSkeleton />}>
        <Await resolve={revenue}>
          {(data) => <RevenueChart data={data} />}
        </Await>
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <Await resolve={orders} errorElement={<OrdersError />}>
          {(data) => <OrdersTable orders={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

---

## 6. Rendering Strategy Decision Guide

```
                RENDERING STRATEGY DECISION TREE

  START: What kind of page is this?
    │
    ├── Is it behind authentication?
    │     │
    │     ├── YES + Highly interactive (dashboard, editor, tool)
    │     │     └──▶ CSR (SPA)
    │     │          Optionally with server data loading (RSC, SSR shell)
    │     │
    │     └── YES + Content-heavy (settings, profile, reports)
    │           └──▶ SSR with client components for interactivity
    │
    ├── Does it need SEO?
    │     │
    │     ├── NO (internal tool, admin, authenticated)
    │     │     └──▶ CSR
    │     │
    │     └── YES ─────────────────────────────────────────┐
    │                                                       │
    │     ┌─────────────────────────────────────────────────┘
    │     │
    │     ├── How often does content change?
    │     │     │
    │     │     ├── RARELY (docs, blog, marketing, about)
    │     │     │     └──▶ SSG
    │     │     │          + ISR if you want background updates
    │     │     │
    │     │     ├── PERIODICALLY (products, listings, news)
    │     │     │     │
    │     │     │     ├── Updates every few minutes
    │     │     │     │     └──▶ ISR (revalidate: 60-300)
    │     │     │     │
    │     │     │     └── Updates on specific events (CMS publish)
    │     │     │           └──▶ ISR with on-demand revalidation
    │     │     │
    │     │     └── REAL-TIME / PER-REQUEST (search, personalized)
    │     │           │
    │     │           ├── Personalized per user?
    │     │           │     └──▶ SSR (cannot cache at edge)
    │     │           │
    │     │           ├── Same for all users but real-time?
    │     │           │     └──▶ SSR + CDN edge caching
    │     │           │          (s-maxage=10, stale-while-revalidate)
    │     │           │
    │     │           └── Mostly static with some dynamic parts?
    │     │                 └──▶ PPR (Partial Pre-Rendering)
    │     │                      or SSG + client-side dynamic data
    │     │
    │     └── Does it have a mix of static and dynamic parts?
    │           └──▶ HYBRID: Static shell + Streaming SSR
    │                for dynamic sections
    │
    └── Special cases:
          │
          ├── 10,000+ pages (e-commerce catalog)
          │     └──▶ SSG for top pages + ISR for long tail
          │          Pre-render top 1000, ISR the rest
          │
          ├── Real-time collaborative (Google Docs-like)
          │     └──▶ CSR with WebSocket
          │
          ├── Multi-page form / wizard
          │     └──▶ SSR for each step (server validation)
          │          or CSR within authenticated SPA
          │
          └── Landing page / marketing
                └──▶ SSG (fastest possible, max SEO)
```

### 6.1 Factor-Based Decision Matrix

```
RENDERING STRATEGY SELECTION MATRIX:

  ┌───────────────────┬──────┬──────┬──────┬──────┬───────────┬──────┐
  │ Factor            │ CSR  │ SSR  │ SSG  │ ISR  │ Streaming │ PPR  │
  ├───────────────────┼──────┼──────┼──────┼──────┼───────────┼──────┤
  │ SEO               │ Poor │ Best │ Best │ Best │ Good      │ Best │
  │ TTFB              │ Fast │ Slow │ Fast │ Fast │ Fast      │ Fast │
  │ FCP               │ Slow │ Fast │ Fast │ Fast │ Fast      │ Fast │
  │ TTI               │ Med  │ Slow │ Med  │ Med  │ Med       │ Med  │
  │ Personalization   │ Full │ Full │ None │ None │ Full      │ Part │
  │ Real-time data    │ Yes  │ Yes  │ No   │ No*  │ Yes       │ Part │
  │ Build time        │ Fast │ N/A  │ Slow │ Med  │ N/A       │ Med  │
  │ Server cost       │ None │ High │ None │ Low  │ High      │ Med  │
  │ Scalability       │ CDN  │ Infra│ CDN  │ CDN+ │ Infra     │ CDN+ │
  │ Offline support   │ Good │ Poor │ Good │ Good │ Poor      │ Med  │
  │ Dynamic content   │ Yes  │ Yes  │ No** │ Part │ Yes       │ Yes  │
  │ Complexity        │ Low  │ Med  │ Low  │ Med  │ High      │ High │
  └───────────────────┴──────┴──────┴──────┴──────┴───────────┴──────┘

  * ISR data updates on revalidation, not real-time
  ** SSG can include client-side fetching for dynamic parts

  CONTENT TYPE → STRATEGY MAPPING:

  ┌──────────────────────────┬───────────────────────────────────┐
  │ Content Type             │ Recommended Strategy              │
  ├──────────────────────────┼───────────────────────────────────┤
  │ Marketing / Landing      │ SSG                               │
  │ Blog / Documentation     │ SSG or ISR                        │
  │ E-commerce Product       │ ISR + client dynamic data         │
  │ E-commerce Search/List   │ SSR (query-dependent)             │
  │ User Dashboard           │ CSR or SSR                        │
  │ Social Feed              │ SSR + Streaming                   │
  │ Settings Page            │ SSR or CSR                        │
  │ Real-time Chat           │ CSR + WebSocket                   │
  │ News / Media             │ ISR (revalidate: 60)              │
  │ API Documentation        │ SSG                               │
  │ Search Results           │ SSR                               │
  │ Checkout Flow            │ SSR (server validation)           │
  │ Admin Panel              │ CSR                               │
  │ Public Profile           │ ISR                               │
  │ Analytics Dashboard      │ CSR with streaming data           │
  └──────────────────────────┴───────────────────────────────────┘
```

### 6.2 Hybrid Per-Page Strategy

```typescript
// ── Next.js App Router: Different Strategy Per Route ──

// app/layout.tsx — Shared layout (Server Component)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  );
}

// ── STATIC (SSG): Marketing pages ──
// app/about/page.tsx
export const dynamic = 'force-static'; // Explicit SSG
export default function AboutPage() {
  return <AboutContent />;
}

// ── SSG + ISR: Blog posts ──
// app/blog/[slug]/page.tsx
export const revalidate = 3600; // ISR: regenerate every hour

export async function generateStaticParams() {
  const posts = await getAllPostSlugs();
  return posts.map((slug) => ({ slug }));
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  return <Article post={post} />;
}

// ── SSR: Search results (query-dependent, personalized) ──
// app/search/page.tsx
export const dynamic = 'force-dynamic'; // SSR on every request

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const results = await search(q || '', parseInt(page || '1'));
  return <SearchResults results={results} query={q} />;
}

// ── SSR + Streaming: Product page with mixed data freshness ──
// app/products/[id]/page.tsx
import { Suspense } from 'react';

export const revalidate = 300; // ISR: regenerate every 5 minutes

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id); // Cached/ISR

  return (
    <main>
      <h1>{product.name}</h1>
      <ProductImages images={product.images} />

      {/* Streaming: real-time data */}
      <Suspense fallback={<PriceSkeleton />}>
        <LivePrice productId={id} />
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <LatestReviews productId={id} />
      </Suspense>
    </main>
  );
}

// ── CSR: Dashboard (authenticated, interactive) ──
// app/dashboard/page.tsx
// Use client components for fully interactive experience

import { DashboardClient } from './DashboardClient';

export default function DashboardPage() {
  return <DashboardClient />;
}

// app/dashboard/DashboardClient.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export function DashboardClient() {
  const [dateRange, setDateRange] = useState<DateRange>(last7Days);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', dateRange],
    queryFn: () => fetchDashboardData(dateRange),
    refetchInterval: 30_000,
  });

  return (
    <div>
      <DateRangePicker value={dateRange} onChange={setDateRange} />
      {isLoading ? <DashboardSkeleton /> : <DashboardGrid data={data!} />}
    </div>
  );
}
```

### 6.3 PPR (Partial Pre-Rendering)

```
                    PPR — PARTIAL PRE-RENDERING
                    (Next.js 14+ experimental)

  CONCEPT: Pre-render a STATIC SHELL at build time,
           then STREAM DYNAMIC HOLES at request time

  Traditional approaches force a BINARY choice:
  - ENTIRE page is static (SSG) — fast but stale
  - ENTIRE page is dynamic (SSR) — fresh but slow TTFB

  PPR combines BOTH in a single page:

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  ┌────────────────────────────────────────────────────┐  │
  │  │ STATIC SHELL (pre-rendered at build time)          │  │
  │  │ ┌──────────────────────────────────────────────┐   │  │
  │  │ │ Navigation Bar — static                      │   │  │
  │  │ └──────────────────────────────────────────────┘   │  │
  │  │                                                    │  │
  │  │ ┌──────────────────┐  ┌──────────────────────────┐│  │
  │  │ │ Product Info     │  │ ╔═══════════════════════╗││  │
  │  │ │ (static)         │  │ ║ DYNAMIC HOLE         ║││  │
  │  │ │ Name: Widget Pro │  │ ║ Personalized Price   ║││  │
  │  │ │ Description: ... │  │ ║ Stock Status         ║││  │
  │  │ │                  │  │ ║ User-specific offer  ║││  │
  │  │ │                  │  │ ╚═══════════════════════╝││  │
  │  │ └──────────────────┘  └──────────────────────────┘│  │
  │  │                                                    │  │
  │  │ ┌──────────────────────────────────────────────┐   │  │
  │  │ │ ╔════════════════════════════════════════╗    │   │  │
  │  │ │ ║ DYNAMIC HOLE                          ║    │   │  │
  │  │ │ ║ Latest Reviews (fetched at request)   ║    │   │  │
  │  │ │ ╚════════════════════════════════════════╝    │   │  │
  │  │ └──────────────────────────────────────────────┘   │  │
  │  │                                                    │  │
  │  │ ┌──────────────────────────────────────────────┐   │  │
  │  │ │ Footer — static                              │   │  │
  │  │ └──────────────────────────────────────────────┘   │  │
  │  └────────────────────────────────────────────────────┘  │
  │                                                          │
  │  DELIVERY:                                               │
  │  1. CDN serves static shell INSTANTLY (like SSG)         │
  │  2. Dynamic holes stream from server (like Streaming SSR)│
  │  3. Result: SSG-level TTFB + SSR-level freshness         │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

```typescript
// ── PPR Implementation (Next.js 15+) ──

// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: {
    ppr: true, // Enable Partial Pre-Rendering
  },
};

export default config;

// app/products/[id]/page.tsx
import { Suspense } from 'react';
import { unstable_noStore as noStore } from 'next/cache';

// The page itself is STATICALLY pre-rendered
// Dynamic parts are wrapped in Suspense — they become "holes"

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // This fetch is cached/static — contributes to the static shell
  const product = await getProduct(id);

  return (
    <main>
      {/* STATIC: In the pre-rendered shell */}
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <ProductImages images={product.images} />

      {/* DYNAMIC HOLE: Streamed at request time */}
      <Suspense fallback={<PriceSkeleton />}>
        <DynamicPrice productId={id} />
      </Suspense>

      {/* DYNAMIC HOLE: Personalized per user */}
      <Suspense fallback={<CartSkeleton />}>
        <PersonalizedAddToCart productId={id} />
      </Suspense>

      {/* STATIC: In the pre-rendered shell */}
      <ProductSpecifications specs={product.specs} />

      {/* DYNAMIC HOLE: Latest data */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <LatestReviews productId={id} />
      </Suspense>
    </main>
  );
}

// This component opts OUT of static rendering
// by calling noStore() — it becomes a dynamic hole
async function DynamicPrice({ productId }: { productId: string }) {
  noStore(); // Mark as dynamic

  const price = await fetchRealtimePrice(productId);
  const stock = await fetchStockLevel(productId);

  return (
    <div>
      <span className="text-2xl font-bold">${price.current}</span>
      {stock.available > 0 ? (
        <span className="text-green-600">In Stock ({stock.available})</span>
      ) : (
        <span className="text-red-600">Out of Stock</span>
      )}
    </div>
  );
}

async function PersonalizedAddToCart({ productId }: { productId: string }) {
  noStore();

  const user = await getAuthenticatedUser();
  const discount = user ? await getUserDiscount(user.id, productId) : null;

  return (
    <div>
      {discount && <span className="badge">Your price: ${discount.price}</span>}
      <AddToCartButton productId={productId} />
    </div>
  );
}
```

### 6.4 Performance Comparison Summary

```
RENDERING STRATEGY PERFORMANCE COMPARISON:

  TTFB (Time to First Byte):
  ┌─────────────────────────────────────────────────────────┐
  │ SSG  ████                                    (~50ms)    │
  │ PPR  █████                                   (~60ms)    │
  │ ISR  █████                                   (~60ms)    │
  │ CSR  ████████                                (~100ms)   │
  │ SSR  ██████████████████████████               (~400ms)  │
  │ SSR  ████████████████████████████████████      (~800ms) │
  │ (w/  (complex queries)                                  │
  │ data)                                                   │
  └─────────────────────────────────────────────────────────┘

  FCP (First Contentful Paint):
  ┌─────────────────────────────────────────────────────────┐
  │ SSG  ██████                                  (~200ms)   │
  │ PPR  ██████                                  (~200ms)   │
  │ ISR  ███████                                 (~250ms)   │
  │ SSR  ██████████████████                      (~600ms)   │
  │ STRM █████████████████                       (~500ms)   │
  │ CSR  ████████████████████████████████████████ (~2500ms) │
  └─────────────────────────────────────────────────────────┘

  LCP (Largest Contentful Paint):
  ┌─────────────────────────────────────────────────────────┐
  │ SSG  ██████████                              (~500ms)   │
  │ PPR  ███████████                             (~550ms)   │
  │ ISR  ███████████                             (~550ms)   │
  │ STRM ██████████████████                      (~900ms)   │
  │ SSR  ██████████████████████                  (~1100ms)  │
  │ CSR  ████████████████████████████████████████ (~3000ms) │
  └─────────────────────────────────────────────────────────┘

  TTI (Time to Interactive):
  ┌─────────────────────────────────────────────────────────┐
  │ CSR  ██████████████████████████               (~2500ms) │
  │ SSG  ████████████████████████████████          (~3000ms)│
  │ PPR  ████████████████████████████████          (~3000ms)│
  │ ISR  ████████████████████████████████          (~3000ms)│
  │ STRM ████████████████████████████████████      (~3500ms)│
  │ SSR  ██████████████████████████████████████████ (~4500ms│
  └─────────────────────────────────────────────────────────┘

  NOTE: TTI for server-rendered pages includes hydration time.
  CSR paradoxically has better TTI because FCP = TTI (no hydration gap).
  Server-rendered pages LOOK ready before they ARE ready.
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Using CSR for SEO-critical pages** | Pages not indexed or indexed with delay, poor social sharing | Use SSR, SSG, or ISR for any page that needs search visibility |
| **Using SSR for static content** | Unnecessary server load, slower TTFB, higher costs | Use SSG or ISR for content that does not change per request |
| **SSR without caching** | Every request re-renders, high server load, slow TTFB | Add CDN edge caching (s-maxage) and application-level caching |
| **Hydration mismatches ignored** | React re-renders entire page on client, poor TTI, flash of content | Fix root cause: avoid browser-only APIs in render, use useId(), consistent timestamps |
| **Fetching data sequentially in SSR** | Waterfall delays, TTFB = sum of all fetches | Use Promise.all() for independent data, parallelize all fetches |
| **Single rendering strategy for entire app** | Some pages over-engineered, others under-optimized | Choose strategy PER PAGE based on content type and requirements |
| **Not using Suspense boundaries with streaming** | Entire page blocked by slowest data fetch | Wrap independent sections in Suspense for parallel streaming |
| **ISR with too-short revalidation** | Effectively SSR cost without SSR benefits, constant regeneration | Set revalidate based on actual content change frequency, use on-demand revalidation |
| **ISR with too-long revalidation** | Users see stale content for hours, data inconsistency | Reduce interval or implement on-demand revalidation via webhooks |
| **SSG for 100,000+ pages without ISR** | 30+ minute builds, deployment bottleneck | Pre-render top pages, use ISR for long tail |
| **Pre-rendering personalized content** | Incorrect content served to wrong users, cache poisoning | NEVER cache personalized content at edge without Vary headers, use SSR or CSR |
| **Not setting Cache-Control on SSR** | CDN cannot cache, every request hits origin server | Set s-maxage and stale-while-revalidate for cacheable SSR pages |
| **Client-side routing without code splitting** | Huge initial bundle, slow FCP even for CSR apps | lazy() + Suspense at every route boundary |
| **No loading states during streaming** | Content pops in without context, poor UX | Design proper skeleton screens matching final layout dimensions |
| **Edge runtime for complex SSR** | Missing Node.js APIs, database driver incompatibility | Use Node.js runtime for pages with heavy dependencies, Edge for simple routes |
| **Blocking on non-critical data in SSR** | TTFB delayed by optional content (recommendations, ads) | Defer non-critical data with Suspense + streaming, or fetch client-side |

---

## 8. Enforcement Checklist

### Rendering Strategy Selection
- [ ] **Each page has an explicitly chosen rendering strategy** based on content type, SEO needs, personalization, and update frequency
- [ ] **Marketing and landing pages use SSG** for fastest possible TTFB and SEO
- [ ] **Blog and documentation use SSG or ISR** with appropriate revalidation intervals
- [ ] **E-commerce product pages use ISR** with on-demand revalidation from CMS webhooks
- [ ] **Search results and personalized pages use SSR** with CDN edge caching where possible
- [ ] **Authenticated dashboards use CSR or SSR** depending on complexity and SEO needs
- [ ] **No page uses CSR when SEO is required** unless a pre-rendering service is in place

### SSR Performance
- [ ] **All independent data fetches are parallelized** with Promise.all() or Promise.allSettled()
- [ ] **SSR responses include Cache-Control headers** with s-maxage and stale-while-revalidate
- [ ] **Database connections use connection pooling** (PgBouncer, Prisma Accelerate)
- [ ] **SSR pages have timeout handling** — abort render after reasonable limit
- [ ] **Edge runtime used for simple routes** — middleware, redirects, lightweight API routes
- [ ] **Node.js runtime used for complex routes** — database queries, heavy dependencies

### Hydration
- [ ] **No browser-only APIs called during server render** (window, document, navigator)
- [ ] **useId() used for all generated IDs** to ensure server/client consistency
- [ ] **Dates and times rendered client-side only** or use suppressHydrationWarning
- [ ] **No Math.random() or non-deterministic values in server render path**
- [ ] **Hydration warnings treated as errors** in development and CI

### Streaming
- [ ] **Independent page sections wrapped in Suspense boundaries** for parallel streaming
- [ ] **Non-critical data deferred to Suspense boundaries** (recommendations, reviews, ads)
- [ ] **Skeleton screens match final layout dimensions** to prevent CLS during streaming
- [ ] **Bot/crawler detection** — use onAllReady/allReady for complete HTML to crawlers
- [ ] **Streaming errors handled gracefully** — error boundaries at each Suspense boundary

### ISR
- [ ] **Revalidation interval matches content update frequency** (not too short, not too long)
- [ ] **On-demand revalidation configured** for CMS webhooks and content updates
- [ ] **Cache tags used for granular invalidation** (revalidateTag over revalidatePath)
- [ ] **Revalidation endpoint protected with secret** to prevent unauthorized cache purges
- [ ] **Fallback behavior configured** — blocking for SEO pages, loading state for non-critical

### SSG
- [ ] **All known pages pre-rendered at build time** via generateStaticParams or getStaticPaths
- [ ] **Build time monitored and optimized** — target under 5 minutes for CI/CD
- [ ] **Dynamic data fetched client-side** where real-time accuracy is needed
- [ ] **MDX/Markdown pipeline uses proper remark/rehype plugins** for content processing
- [ ] **Static output deployed to CDN** with proper cache headers (immutable for hashed assets)

### CSR
- [ ] **Route-level code splitting implemented** with lazy() + Suspense
- [ ] **App shell with skeleton screens** renders before JavaScript loads
- [ ] **Vendor chunks separated from application code** for better caching
- [ ] **Prefetching configured** for likely navigation targets
- [ ] **react-helmet-async or equivalent** used for dynamic meta tags if any SEO is needed
