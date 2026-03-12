# Server-Side Rendering (SSR) — Complete Specification

> **AI Plugin Directive:** When implementing server-side rendering for dynamic, personalized, or SEO-critical pages, ALWAYS consult this guide. Apply SSR patterns when content changes per request, requires user-specific data, or must be indexed by search engines with fresh data. This guide covers the SSR lifecycle, data fetching strategies, hydration, streaming, caching, and runtime considerations.

**Core Rule: Use SSR when content is DYNAMIC per request AND requires SEO. The server generates full HTML on each request, sends it to the browser, then React/Vue hydrates it into an interactive app. ALWAYS cache SSR responses where possible (CDN edge caching with `Cache-Control`). NEVER perform expensive synchronous operations during SSR — they block the response. Use streaming SSR (see streaming-ssr.md) for pages with slow data sources.**

---

## 1. SSR Rendering Lifecycle

```
                    SSR RENDERING TIMELINE

  Client Request → Server Processing → HTML Response → Hydration

  ┌─────────┐  ┌──────────────────┐  ┌──────────────┐  ┌──────────┐
  │ Browser  │  │ Server           │  │ Browser      │  │ Browser  │
  │ Request  │─▶│ 1. Route match   │─▶│ 1. Parse HTML│─▶│ Hydrate  │
  │          │  │ 2. Fetch data    │  │ 2. Render    │  │ Attach   │
  │          │  │ 3. Render HTML   │  │ 3. Show FCP  │  │ Events   │
  │          │  │ 4. Serialize     │  │ 4. Load JS   │  │ = TTI    │
  └─────────┘  └──────────────────┘  └──────────────┘  └──────────┘

  Time: ─────────────────────────────────────────────────────────▶
       Request   TTFB              FCP/LCP            TTI
                 (depends on       (FAST —            (JS load +
                  server work)      HTML is ready)     hydration)

  KEY ADVANTAGE: User sees CONTENT before JavaScript loads.
  KEY COST: Server must do work PER request (TTFB is slower).
```

### 1.1 What the Server Returns

```html
<!-- SSR: Server sends FULL HTML with content -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Product: Widget Pro — Store</title>
  <meta name="description" content="Widget Pro - Enterprise automation tool">
  <link rel="stylesheet" href="/static/css/main.css">
</head>
<body>
  <!-- FULL content rendered — visible without JavaScript -->
  <div id="root">
    <header>
      <nav><a href="/">Home</a><a href="/products">Products</a></nav>
    </header>
    <main>
      <h1>Widget Pro</h1>
      <img src="/images/widget-pro.webp" alt="Widget Pro" width="600" height="400">
      <p class="price">$99.99</p>
      <p>Enterprise-grade automation tool with advanced features...</p>
      <button>Add to Cart</button>
    </main>
  </div>

  <!-- Serialized data — prevents refetch during hydration -->
  <script>
    window.__INITIAL_DATA__ = {"product":{"id":"1","name":"Widget Pro","price":99.99}};
  </script>
  <script src="/static/js/main.js" defer></script>
</body>
</html>
```

---

## 2. SSR Implementation by Framework

### 2.1 Next.js App Router (Recommended)

```typescript
// app/products/[id]/page.tsx — Server Component (SSR by default)
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

// Dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) return { title: 'Not Found' };

  return {
    title: `${product.name} — Store`,
    description: product.description,
    openGraph: { images: [product.image] },
  };
}

// Server Component — runs on EVERY request
export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchProduct(id);

  if (!product) notFound();

  return (
    <main>
      <h1>{product.name}</h1>
      <ProductImage src={product.image} alt={product.name} />
      <p className="price">${product.price}</p>
      <p>{product.description}</p>

      {/* Client Component — hydrated for interactivity */}
      <AddToCartButton productId={product.id} />

      {/* Async Server Component — can be wrapped in Suspense */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={product.id} />
      </Suspense>
    </main>
  );
}

// Async component that fetches its own data
async function ProductReviews({ productId }: { productId: string }) {
  const reviews = await fetchReviews(productId);
  return (
    <section>
      <h2>Reviews ({reviews.length})</h2>
      {reviews.map(review => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </section>
  );
}
```

### 2.2 Next.js Dynamic Rendering Control

```typescript
// Force dynamic SSR (no caching)
export const dynamic = 'force-dynamic';

// Or configure per-fetch
async function ProductPage({ params }: Props) {
  // This fetch runs on EVERY request (no caching)
  const product = await fetch(`${API}/products/${params.id}`, {
    cache: 'no-store',  // No caching — always fresh
  });

  // This fetch is cached and revalidated every 60 seconds
  const categories = await fetch(`${API}/categories`, {
    next: { revalidate: 60 },
  });
}

// Dynamic route segments
export async function generateStaticParams() {
  // Return popular products for static generation
  // Other products will be SSR'd on demand
  const popular = await fetchPopularProducts();
  return popular.map(p => ({ id: p.id }));
}
```

### 2.3 Remix

```typescript
// app/routes/products.$id.tsx — Remix SSR
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

// Loader runs on the SERVER for every request
export async function loader({ params, request }: LoaderFunctionArgs) {
  const product = await fetchProduct(params.id!);
  if (!product) throw new Response('Not Found', { status: 404 });

  return json(
    { product },
    {
      headers: {
        // Cache SSR response at CDN edge
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.product.name} — Store` },
  { name: 'description', content: data?.product.description },
];

export default function ProductPage() {
  const { product } = useLoaderData<typeof loader>();

  return (
    <main>
      <h1>{product.name}</h1>
      <p>${product.price}</p>
    </main>
  );
}
```

---

## 3. Hydration

### 3.1 What Is Hydration

```
  HYDRATION: The process of attaching JavaScript event handlers
  to server-rendered HTML, making it interactive.

  ┌──────────────────────────────────────────────────┐
  │  Server HTML (static, visible, not interactive)  │
  │  ┌──────────────────────────────────┐            │
  │  │  <button>Add to Cart</button>    │ ← Visible  │
  │  │  (no click handler yet)          │    but dead │
  │  └──────────────────────────────────┘            │
  │                                                  │
  │  After JS loads + hydration:                     │
  │  ┌──────────────────────────────────┐            │
  │  │  <button>Add to Cart</button>    │ ← Now      │
  │  │  onClick={addToCart}             │    interactive│
  │  └──────────────────────────────────┘            │
  └──────────────────────────────────────────────────┘

  HYDRATION MISMATCH: When server HTML differs from client render.
  React will warn and re-render from scratch (defeats SSR purpose).
```

### 3.2 Hydration Mismatch Prevention

```typescript
// ❌ CAUSES HYDRATION MISMATCH: Different output on server vs client
function BadComponent() {
  return <p>Current time: {new Date().toLocaleTimeString()}</p>;
  // Server renders "10:00:00 AM", client renders "10:00:01 AM"
}

// ✅ CORRECT: Use useEffect for client-only values
function GoodComponent() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <p>Current time: {time ?? 'Loading...'}</p>;
}

// ❌ CAUSES MISMATCH: typeof window check in render
function BadCheck() {
  if (typeof window !== 'undefined') {
    return <ClientOnlyComponent />;  // Different tree on server vs client
  }
  return null;
}

// ✅ CORRECT: Suppress hydration for specific elements
function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

// ✅ CORRECT: suppressHydrationWarning for specific cases
<time dateTime={date.toISOString()} suppressHydrationWarning>
  {date.toLocaleDateString()}
</time>
```

---

## 4. SSR Caching Strategies

```
  SSR CACHING LAYERS:

  Client ──▶ CDN Edge ──▶ Server Cache ──▶ Origin Server
              │                │                │
              │  s-maxage      │  In-memory      │  Full SSR
              │  stale-while-  │  Redis           │  (expensive)
              │  revalidate    │  LRU cache       │
              └────────────────┴────────────────────┘

  Cache-Control headers for SSR:

  PERSONALIZED pages (user-specific):
  Cache-Control: private, no-cache, no-store
  → NEVER cache at CDN — content varies per user

  SHARED pages (same for all users):
  Cache-Control: public, s-maxage=300, stale-while-revalidate=600
  → Cache at CDN for 5 min, serve stale for 10 min while revalidating

  SEMI-DYNAMIC pages (changes occasionally):
  Cache-Control: public, s-maxage=60, stale-while-revalidate=3600
  → Cache 1 min, stale up to 1 hour
```

```typescript
// Next.js caching example
export default async function ProductPage({ params }: Props) {
  // Cached fetch — revalidates every 60 seconds
  const product = await fetch(`${API}/products/${params.id}`, {
    next: { revalidate: 60 },
  });

  // Uncached fetch — always fresh (personalized)
  const recommendations = await fetch(`${API}/recommendations`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  return /* ... */;
}
```

---

## 5. SSR Performance Optimization

### 5.1 Parallel Data Fetching

```typescript
// ❌ BAD: Sequential — each fetch waits for previous
export default async function Page() {
  const product = await fetchProduct(id);       // 200ms
  const reviews = await fetchReviews(id);       // 300ms
  const related = await fetchRelated(id);       // 150ms
  // Total: 650ms TTFB

  return /* ... */;
}

// ✅ GOOD: Parallel — all fetch simultaneously
export default async function Page() {
  const [product, reviews, related] = await Promise.all([
    fetchProduct(id),       // 200ms ┐
    fetchReviews(id),       // 300ms ├── Runs in parallel
    fetchRelated(id),       // 150ms ┘
  ]);
  // Total: 300ms TTFB (longest fetch)

  return /* ... */;
}

// ✅ BEST: Critical data parallel + non-critical streamed
export default async function Page() {
  // Critical data — fetch before response
  const product = await fetchProduct(id);

  return (
    <main>
      <ProductInfo product={product} />

      {/* Non-critical — streamed later via Suspense */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={id} />
      </Suspense>
    </main>
  );
}
```

### 5.2 Runtime Selection

```
  SSR RUNTIME OPTIONS:

  ┌─────────────────┬──────────────────────────────────────┐
  │ Node.js Runtime │ Full Node.js APIs                     │
  │                 │ Larger cold start                      │
  │                 │ More memory available                  │
  │                 │ Use for: complex data processing,     │
  │                 │ file system, native modules            │
  ├─────────────────┼──────────────────────────────────────┤
  │ Edge Runtime    │ V8 isolates (no Node.js APIs)         │
  │                 │ ~0ms cold start                        │
  │                 │ Limited memory/execution time          │
  │                 │ Runs close to user (CDN edge)          │
  │                 │ Use for: simple transformations,       │
  │                 │ personalization, A/B testing           │
  └─────────────────┴──────────────────────────────────────┘
```

```typescript
// Next.js — choose runtime per route
export const runtime = 'edge';  // or 'nodejs'

// Edge middleware for personalization
// middleware.ts
export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'US';
  const response = NextResponse.next();
  response.headers.set('x-country', country);
  return response;
}
```

---

## 6. SSR Error Handling

```typescript
// ─── Next.js error handling ───
// app/products/[id]/error.tsx — Error boundary for this route
'use client';

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert">
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// app/products/[id]/not-found.tsx — 404 page
export default function ProductNotFound() {
  return (
    <div>
      <h2>Product Not Found</h2>
      <p>The product you're looking for doesn't exist.</p>
      <Link href="/products">Browse all products</Link>
    </div>
  );
}

// In page.tsx — trigger not-found
import { notFound } from 'next/navigation';

export default async function ProductPage({ params }: Props) {
  const product = await fetchProduct(params.id);
  if (!product) notFound();  // Renders not-found.tsx
  return /* ... */;
}
```

---

## 7. When to Use SSR

| Scenario | SSR? | Reason |
|----------|------|--------|
| Personalized content (user dashboard) | ✅ | Content varies per user, needs SEO |
| E-commerce product pages | ✅ | SEO + fresh inventory/pricing |
| Search results pages | ✅ | Dynamic per query, needs SEO |
| Real-time data display | ✅ | Fresh on each request |
| News articles with comments | ✅ | SEO + dynamic comment count |
| User profile pages (public) | ✅ | SEO + personalized content |
| Static blog posts | ❌ SSG | Content doesn't change per request |
| Marketing landing pages | ❌ SSG | Same for all users, static |
| Admin dashboards | ❌ CSR | Behind auth, no SEO |
| Documentation sites | ❌ SSG | Static content, pre-buildable |

---

## 8. SSR vs Other Strategies

| Metric | CSR | SSR | SSG | ISR |
|--------|-----|-----|-----|-----|
| TTFB | Fast | Slow-Medium | Fast | Fast |
| FCP/LCP | Slow | Fast | Fast | Fast |
| TTI | Slow | Medium | Fast | Fast |
| SEO | Poor | Excellent | Excellent | Excellent |
| Server cost | None | High | None (build) | Low |
| Data freshness | Real-time | Per-request | Build-time | Revalidation |
| Scalability | Excellent | Limited | Excellent | Good |
| Personalization | Full | Full | None | Limited |

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Sequential data fetching | Slow TTFB — requests waterfall | Use `Promise.all()` for parallel fetches |
| SSR for static content | Unnecessary server load on every request | Use SSG or ISR for content that doesn't change per request |
| No CDN caching for shared pages | Server processes every request | Set `Cache-Control: s-maxage` for non-personalized pages |
| Hydration mismatch | Console warnings, re-render from scratch | Ensure server and client produce identical HTML |
| `typeof window` in render | Different component trees server/client | Use `useEffect` for client-only logic |
| Large serialized data | Bloated HTML, slow parsing | Serialize only what the client needs, not entire API response |
| Expensive sync operations | Blocked response, high TTFB | Move expensive work to background, use streaming |
| No error boundaries | Server error crashes entire page | Add error.tsx + not-found.tsx boundaries |
| No loading states during hydration | Interactive elements appear but don't work | Show loading indicators until hydration completes |
| Fetching data client-side that was available on server | Double data fetch, flash of loading | Pass server data to client via serialization or dehydration |

---

## 10. Enforcement Checklist

- [ ] SSR is used ONLY for pages requiring dynamic, per-request data + SEO
- [ ] Data fetching is parallelized (no sequential waterfalls)
- [ ] `Cache-Control` headers set appropriately (CDN caching for shared pages)
- [ ] Hydration mismatches resolved (no client/server HTML differences)
- [ ] Error boundaries defined at route level (error.tsx, not-found.tsx)
- [ ] Server data serialized and passed to client (no double-fetching)
- [ ] Streaming SSR used for pages with slow data sources
- [ ] Edge runtime considered for latency-sensitive, simple pages
- [ ] Non-critical data loaded via Suspense boundaries (not blocking TTFB)
- [ ] Performance budget for TTFB (< 500ms for shared pages, < 1s for personalized)
- [ ] SEO metadata (title, description, OG tags) generated server-side
- [ ] Client-only code gated behind useEffect or 'use client' boundaries
- [ ] Static content uses SSG/ISR instead of SSR
