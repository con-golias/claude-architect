# Rendering Strategies — Performance Engineering

> **Domain:** Frontend Performance > Architecture & Rendering Approaches
> **Importance:** CRITICAL

> **Directive:** When choosing between SSR, SSG, ISR, CSR, or hybrid rendering strategies, evaluating hydration cost, implementing streaming SSR, or adopting islands/resumability architecture, consult this guide. This covers the performance engineering tradeoffs of each approach.

---

## 1. Rendering Strategy Comparison Matrix

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┐
│ Strategy │ TTFB     │ FCP      │ TTI      │ SEO      │ Best For         │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ SSG      │ Fastest  │ Fastest  │ Fastest  │ Best     │ Blogs, docs,     │
│          │ (CDN)    │ (no JS)  │ (min JS) │          │ marketing pages  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ ISR      │ Fast     │ Fast     │ Fast     │ Great    │ E-commerce,      │
│          │ (cached) │ (cached) │ (cached) │          │ CMS content      │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ SSR      │ Slower   │ Good     │ Delayed  │ Great    │ Personalized,    │
│          │ (server) │ (HTML)   │ (hydrate)│          │ dynamic pages    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ Streaming│ Fast     │ Good     │ Good     │ Great    │ SSR with fast    │
│ SSR      │ (chunked)│ (early)  │ (prog.)  │          │ first byte       │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ CSR      │ Fast     │ Slowest  │ Slowest  │ Poor     │ Dashboards,      │
│ (SPA)    │ (static) │ (JS req) │ (JS req) │ (empty)  │ internal apps    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ Islands  │ Fast     │ Fast     │ Fast     │ Best     │ Content sites    │
│          │ (static) │ (HTML)   │ (partial)│          │ with interactive │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ RSC      │ Good     │ Good     │ Good     │ Great    │ Full-stack React │
│          │ (server) │ (stream) │ (select) │          │ applications     │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┘

DECISION TREE:
  Content changes frequently?
  ├── NO → SSG (build once, serve from CDN)
  ├── Hourly/Daily → ISR (revalidate on schedule)
  └── Per-request → SSR or RSC
      ├── Page is mostly static with small interactive parts?
      │   └── Islands architecture (Astro)
      ├── Need zero/minimal JS?
      │   └── SSG + progressive enhancement
      └── Full interactivity needed?
          ├── SEO critical? → SSR/Streaming SSR
          └── Internal app? → CSR (SPA)
```

## 2. Hydration Cost Analysis

```
HYDRATION: Re-running client JS to attach event listeners to server-rendered HTML

TRADITIONAL HYDRATION COST:
  Server: Render HTML → Send to client
  Client: Download JS → Parse → Execute → Walk DOM → Attach listeners
  │
  │  During hydration:
  │  ├── Page LOOKS interactive (HTML rendered)
  │  ├── Page IS NOT interactive (JS not yet attached)
  │  └── This gap = "uncanny valley" of SSR
  │
  │  Cost: Proportional to component tree size
  │  200KB JS → 200-500ms hydration on mobile
  │  This is WHY TTI is much worse than FCP in SSR

HYDRATION TIMELINE:
  FCP ──────── TTI (gap = hydration time)
  │            │
  │ 0.8s       │ 2.5s        ← 1.7s of non-interactive page
  │            │
  └── User sees content but clicks do nothing ──┘
```

```typescript
// measure-hydration.ts — Track hydration cost in production
function measureHydration(): void {
  // Mark before hydration starts
  performance.mark('hydration-start');

  // In your framework's hydration callback:
  // React 18: hydrateRoot() completion
  // Next.js: custom _app.tsx useEffect
  // Nuxt: onNuxtReady()

  function onHydrationComplete(): void {
    performance.mark('hydration-end');
    performance.measure('hydration', 'hydration-start', 'hydration-end');
    const entry = performance.getEntriesByName('hydration')[0];
    console.log(`Hydration took: ${entry.duration.toFixed(0)}ms`);

    // Report to RUM
    if (entry.duration > 500) {
      reportMetric('slow-hydration', {
        duration: entry.duration,
        componentCount: document.querySelectorAll('[data-reactroot] *').length,
      });
    }
  }

  // React 18 — detect hydration completion
  const root = document.getElementById('root');
  if (root) {
    const observer = new MutationObserver(() => {
      // Hydration completes when React attaches event listeners
      // Approximate: first interaction becomes possible
      requestIdleCallback(() => onHydrationComplete());
      observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
  }
}
```

## 3. Streaming SSR

```typescript
// streaming-ssr.tsx — React 18 Streaming SSR with Suspense
// Server sends HTML in chunks as each Suspense boundary resolves

// app.tsx — Define Suspense boundaries for streaming
import { Suspense } from 'react';

function Page() {
  return (
    <html>
      <head><title>Product</title></head>
      <body>
        {/* Sent immediately — no data dependency */}
        <Header />

        {/* Streams when product data resolves */}
        <Suspense fallback={<ProductSkeleton />}>
          <ProductDetails />  {/* async server component */}
        </Suspense>

        {/* Streams independently when reviews load */}
        <Suspense fallback={<ReviewsSkeleton />}>
          <Reviews />  {/* async server component */}
        </Suspense>

        {/* Sent immediately */}
        <Footer />
      </body>
    </html>
  );
}

// server.ts — Express streaming handler
import { renderToPipeableStream } from 'react-dom/server';

app.get('*', (req, res) => {
  const { pipe, abort } = renderToPipeableStream(<Page />, {
    bootstrapScripts: ['/client.js'],
    onShellReady() {
      // Shell (non-suspended content) is ready — start streaming
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      pipe(res);
    },
    onShellError(error) {
      res.statusCode = 500;
      res.send('<h1>Error</h1>');
    },
    onError(error) {
      console.error(error);
    },
  });
  setTimeout(() => abort(), 10000); // 10s timeout
});
```

## 4. Islands Architecture (Astro)

```
ISLANDS ARCHITECTURE:
  Page is static HTML by default.
  Interactive components ("islands") hydrate independently.

  ┌─────────────────────────────────────────────────┐
  │  Static HTML (no JS)                            │
  │  ┌───────────┐                                  │
  │  │ Nav       │ ← Static HTML, zero JS           │
  │  └───────────┘                                  │
  │  ┌───────────────────┐  ┌─────────────────────┐│
  │  │ Article Content   │  │ Interactive Search  ││
  │  │ (static HTML)     │  │ (hydrated island)   ││
  │  │ Zero JS           │  │ React/Svelte/Vue    ││
  │  └───────────────────┘  └─────────────────────┘│
  │  ┌───────────────────────────────────────────┐  │
  │  │ Comments (hydrated island)                │  │
  │  │ Hydrated on:visible (Intersection Observer│  │
  │  └───────────────────────────────────────────┘  │
  │  ┌───────────┐                                  │
  │  │ Footer    │ ← Static HTML, zero JS           │
  │  └───────────┘                                  │
  └─────────────────────────────────────────────────┘

  Result: 90% of page is zero-JS static HTML
  Only interactive islands load framework code
```

```astro
---
// page.astro — Astro islands with selective hydration
import Header from '../components/Header.astro';  // Static, zero JS
import SearchBar from '../components/SearchBar.tsx';  // React island
import Comments from '../components/Comments.svelte';  // Svelte island
---
<html>
  <body>
    <Header />  <!-- Zero JS -->

    <article set:html={content} />  <!-- Zero JS -->

    <!-- Hydrate immediately — above fold, interactive -->
    <SearchBar client:load />

    <!-- Hydrate when visible — below fold -->
    <Comments client:visible />

    <!-- Hydrate on idle — non-critical -->
    <NewsletterSignup client:idle />

    <!-- Hydrate on media query — mobile-only widget -->
    <MobileMenu client:media="(max-width: 768px)" />
  </body>
</html>
```

## 5. Resumability (Qwik)

```
RESUMABILITY vs HYDRATION:
  Hydration: Server renders → Client re-executes entire component tree
  Resumability: Server renders + serializes state → Client resumes where server left off

  HYDRATION (React/Next/Nuxt):
  Server: render() → HTML
  Client: download all JS → parse → execute render() again → diff → attach listeners
  Cost: O(components) — proportional to page complexity

  RESUMABILITY (Qwik):
  Server: render() → HTML + serialized state + lazy listener references
  Client: NO JS executed until user interacts
  First click: download ONLY the handler for that click (~1-5KB)
  Cost: O(1) — constant, regardless of page complexity

  RESULT: Qwik pages are interactive with near-zero JS on load
```

```typescript
// Qwik component — handlers lazy-loaded on interaction
import { component$, useSignal, $ } from '@builder.io/qwik';

export const Counter = component$(() => {
  const count = useSignal(0);
  // $ suffix = lazy-loaded. This function is NOT in the initial bundle.
  // Downloaded only when user clicks the button.
  const increment = $(() => { count.value++; });
  return <button onClick$={increment}>Count: {count.value}</button>;
});
```

## 6. React Server Components (RSC)

```typescript
// RSC — Components that run ONLY on the server
// Zero client JS for server components; only client components ship JS

// Server Component (default in Next.js App Router)
// Runs on server, sends rendered HTML + RSC payload (not JS bundle)
async function ProductPage({ id }: { id: string }) {
  const product = await db.query(`SELECT * FROM products WHERE id = $1`, [id]);
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      {/* Client component — only THIS ships JS */}
      <AddToCartButton productId={id} />
    </div>
  );
}

// Client Component — marked with 'use client'
// This is the ONLY component that ships JS to the browser
'use client';
function AddToCartButton({ productId }: { productId: string }) {
  const [added, setAdded] = useState(false);
  return (
    <button onClick={() => { addToCart(productId); setAdded(true); }}>
      {added ? 'Added' : 'Add to Cart'}
    </button>
  );
}

// PERFORMANCE IMPACT:
// Traditional: ALL components ship JS (ProductPage + AddToCartButton)
// RSC: ONLY AddToCartButton ships JS
// For content-heavy pages: 50-90% less client JS
```

## 7. Edge Rendering

```
EDGE RENDERING — SSR at CDN edge locations:

  Traditional SSR:
  User (Tokyo) → CDN → Origin (US-East) → DB → Render → Response
  TTFB: 200-500ms (network latency to origin)

  Edge SSR:
  User (Tokyo) → Edge (Tokyo) → Render → Response
  TTFB: 20-50ms (edge is ~10ms away)

  PLATFORMS:
  ├── Cloudflare Workers (V8 isolates, 300+ PoPs)
  ├── Vercel Edge Functions (built on Cloudflare)
  ├── Deno Deploy (V8 isolates, 35+ regions)
  └── AWS Lambda@Edge / CloudFront Functions

  LIMITATIONS:
  ├── No Node.js APIs (fs, net, child_process)
  ├── Limited execution time (50ms-30s depending on platform)
  ├── Database access adds latency (edge → DB origin)
  │   Solution: Edge databases (D1, Turso, PlanetScale)
  └── Cold starts (mitigated by V8 isolates vs containers)
```

---

## 10 Best Practices

1. **Default to SSG** — pre-render at build time for maximum performance; use ISR when freshness matters
2. **Stream SSR responses** — send `<head>` immediately; stream body as data resolves
3. **Measure hydration cost** — track hydration time in RUM; budget under 500ms on mobile
4. **Use islands for content sites** — Astro delivers near-zero JS for mostly-static pages
5. **RSC for React apps** — server components eliminate JS for data-fetching components
6. **Edge render personalized pages** — move SSR to CDN edge for 50-200ms TTFB improvement
7. **Selective hydration** — hydrate visible components first; defer below-fold with `client:visible`
8. **Set hydration budgets** — max 200KB JS for hydration; measure TTI gap from FCP
9. **Streaming Suspense boundaries** — wrap slow data sources in Suspense for progressive rendering
10. **Profile per-strategy** — test each approach with WebPageTest on representative pages

## 8 Anti-Patterns

1. **CSR for SEO-critical pages** — empty HTML until JS loads; search engines may not index
2. **SSR without streaming** — server blocks until ALL data fetched; streaming unblocks shell
3. **Hydrating entire page** — shipping 400KB JS to hydrate a mostly-static page
4. **ISR without stale-while-revalidate** — users hit revalidation delay; serve stale first
5. **Edge rendering with origin database** — edge SSR + 200ms DB round trip negates edge benefit
6. **No Suspense boundaries in SSR** — single slow query blocks entire page render
7. **Client components by default (RSC)** — marking everything `'use client'` ships unnecessary JS
8. **Ignoring TTI in SSR** — page looks loaded at FCP but is non-interactive until hydration

## Enforcement Checklist

- [ ] Rendering strategy chosen per page type (SSG/ISR/SSR/CSR documented)
- [ ] Hydration time measured in RUM and budgeted under 500ms
- [ ] Streaming SSR enabled with Suspense boundaries for data dependencies
- [ ] Server components used by default (client components only where needed)
- [ ] Edge rendering configured for personalized high-traffic pages
- [ ] Islands architecture evaluated for content-heavy sites
- [ ] TTI gap (FCP to TTI) tracked and reported alongside FCP
- [ ] Client JS budget enforced: under 200KB for initial hydration
