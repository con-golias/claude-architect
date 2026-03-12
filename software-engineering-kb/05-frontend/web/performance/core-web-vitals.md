# Core Web Vitals — Complete Specification

> **AI Plugin Directive:** When a developer asks "what are Core Web Vitals?", "how to improve LCP?", "fix CLS issues", "what is INP?", "optimize page speed", "improve Lighthouse score", "why is my site slow?", "web performance metrics", or any Core Web Vitals question, ALWAYS consult this directive. Core Web Vitals are Google's user-experience metrics that directly affect search rankings. LCP measures loading speed, INP measures responsiveness, CLS measures visual stability. ALWAYS measure with real user data (CrUX/RUM) — not just lab tools. NEVER optimize without measuring first.

**Core Rule: Core Web Vitals (LCP, INP, CLS) are the THREE metrics that matter most for user experience AND search rankings. LCP < 2.5s (loading), INP < 200ms (responsiveness), CLS < 0.1 (visual stability). Measure with REAL user data (CrUX, RUM) — lab data (Lighthouse) is directional only. Fix the LARGEST impact issues first: server response time, render-blocking resources, image optimization, layout shifts from dynamic content. EVERY performance optimization must be measured before AND after.**

---

## 1. Core Web Vitals Overview

```
         CORE WEB VITALS — THE THREE PILLARS

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  LOADING          RESPONSIVENESS       VISUAL STABILITY │
  │                                                         │
  │  ┌───────────┐    ┌───────────────┐    ┌─────────────┐ │
  │  │   LCP     │    │     INP       │    │    CLS      │ │
  │  │           │    │               │    │             │ │
  │  │ Largest   │    │ Interaction   │    │ Cumulative  │ │
  │  │ Contentful│    │ to Next       │    │ Layout      │ │
  │  │ Paint     │    │ Paint         │    │ Shift       │ │
  │  │           │    │               │    │             │ │
  │  │ < 2.5s ✅ │    │ < 200ms ✅    │    │ < 0.1 ✅    │ │
  │  │ < 4.0s ⚠️ │    │ < 500ms ⚠️    │    │ < 0.25 ⚠️   │ │
  │  │ > 4.0s ❌ │    │ > 500ms ❌    │    │ > 0.25 ❌   │ │
  │  └───────────┘    └───────────────┘    └─────────────┘ │
  │                                                         │
  │  SUPPLEMENTARY METRICS:                                 │
  │  ┌───────────┐    ┌───────────────┐    ┌─────────────┐ │
  │  │   TTFB    │    │     TBT       │    │    FCP      │ │
  │  │ Time to   │    │ Total         │    │ First       │ │
  │  │ First Byte│    │ Blocking Time │    │ Contentful  │ │
  │  │ < 800ms   │    │ < 200ms       │    │ Paint       │ │
  │  └───────────┘    └───────────────┘    │ < 1.8s      │ │
  │                                        └─────────────┘ │
  │                                                         │
  │  ASSESSMENT: Based on 75th percentile of page loads     │
  │  (not average — 75% of users must meet the threshold)   │
  └─────────────────────────────────────────────────────────┘

  IMPACT ON SEARCH RANKINGS:
  Google uses Core Web Vitals as a ranking signal.
  Pages meeting ALL three thresholds get a ranking boost.
  Pages failing ANY metric may be ranked lower.
```

### 1.1 How Metrics Are Collected

```
MEASUREMENT TYPES:

  LAB DATA (Synthetic)                  FIELD DATA (Real User Monitoring)
  ┌────────────────────────┐            ┌──────────────────────────────┐
  │ • Lighthouse                        │ • Chrome User Experience       │
  │ • Chrome DevTools       │            │   Report (CrUX)              │
  │ • WebPageTest           │            │ • web-vitals library         │
  │ • PageSpeed Insights    │            │ • Google Analytics           │
  │   (lab section)         │            │ • Custom RUM solutions       │
  │                         │            │ • PageSpeed Insights          │
  │ PROS:                   │            │   (field section)            │
  │ • Reproducible          │            │                              │
  │ • Detailed diagnostics  │            │ PROS:                        │
  │ • Good for debugging    │            │ • Real user experience       │
  │                         │            │ • Accounts for real devices  │
  │ CONS:                   │            │ • Geographic diversity       │
  │ • Simulated conditions  │            │ • THE metric Google uses     │
  │ • Single device/network │            │                              │
  │ • Not real user data    │            │ CONS:                        │
  │ • INP not measured      │            │ • Needs traffic volume       │
  └────────────────────────┘            │ • Less diagnostic detail     │
                                        └──────────────────────────────┘

  RULE: Lab data for DEBUGGING, field data for MEASURING.
  Google Search uses FIELD DATA (CrUX) for ranking decisions.
```

---

## 2. LCP — Largest Contentful Paint

```
LCP TIMELINE:

  Navigation ──→ TTFB ──→ Resource Discovery ──→ Resource Load ──→ LCP Render
  Start          │         │                      │                  │
                 │         │                      │                  │
  Server         │  HTML   │  Critical resources  │  Image/text     │  PAINT
  response       │  parsed │  (CSS, fonts, hero   │  decoded and    │  ← LCP
  time           │         │  image) discovered   │  rendered       │  event
                 │         │  and requested        │                 │
                 ▼         ▼                       ▼                 ▼
  ├── TTFB ─────┤├─ Resource delay ──┤├─ Load time ──┤├─ Render ──┤
  0ms          ~200ms             ~500ms          ~1500ms       ~2500ms
               (goal)             (goal)           (goal)       (target)

  LCP ELEMENTS (what counts):
  • <img> elements
  • <image> inside <svg>
  • <video> poster image
  • Background image via CSS url()
  • Block-level text elements (<h1>, <p>, etc.)
  • The LARGEST visible element in the viewport
```

### 2.1 Common LCP Problems and Fixes

```typescript
// PROBLEM 1: Slow server response (high TTFB)
// ──────────────────────────────────────────

// FIX: Use CDN + edge computing
// FIX: Enable server-side caching
// FIX: Use streaming SSR

// Next.js — streaming SSR reduces TTFB
// app/page.tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <main>
      {/* Hero renders immediately, data streams later */}
      <HeroSection />
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductList /> {/* Streamed when ready */}
      </Suspense>
    </main>
  );
}

// PROBLEM 2: Render-blocking resources
// ──────────────────────────────────────

// FIX: Inline critical CSS
// FIX: Defer non-critical CSS
// FIX: Async/defer scripts
```

```html
<!-- ✅ Preload hero image (LCP element) -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />

<!-- ✅ Preload critical font -->
<link rel="preload" as="font" href="/font.woff2"
      type="font/woff2" crossorigin />

<!-- ✅ Preconnect to external origins -->
<link rel="preconnect" href="https://cdn.example.com" />
<link rel="dns-prefetch" href="https://analytics.example.com" />

<!-- ✅ Defer non-critical CSS -->
<link rel="preload" as="style" href="/non-critical.css"
      onload="this.onload=null;this.rel='stylesheet'" />

<!-- ✅ Async/defer scripts -->
<script src="/analytics.js" defer></script>
<script src="/widget.js" async></script>

<!-- ❌ NEVER: Render-blocking script in <head> -->
<!-- <script src="/heavy-lib.js"></script> -->
```

```typescript
// PROBLEM 3: Slow image loading (most common LCP issue)
// ──────────────────────────────────────────────────────

// FIX: Use modern formats (WebP/AVIF)
// FIX: Responsive images with srcset
// FIX: fetchpriority="high" on hero image
// FIX: Preload hero image in <head>

// Next.js Image component — handles all of this
import Image from 'next/image';

export function HeroSection() {
  return (
    <Image
      src="/hero.webp"
      alt="Hero"
      width={1200}
      height={600}
      priority          // Preloads, sets fetchpriority="high"
      sizes="100vw"     // Responsive
      quality={85}      // Optimized quality
    />
  );
}

// PROBLEM 4: Client-side rendering delays LCP
// ──────────────────────────────────────────

// FIX: Use SSR or SSG for initial render
// FIX: Use React Server Components
// FIX: Minimize JavaScript before LCP element renders

// ❌ BAD: LCP element depends on client-side fetch
function Page() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/hero').then(r => r.json()).then(setData);
  }, []);
  return data ? <img src={data.heroUrl} /> : null;
  // LCP waits for: JS download + parse + execute + API call + render
}

// ✅ GOOD: LCP element available from server
// app/page.tsx (Next.js Server Component)
async function Page() {
  const data = await getHeroData(); // Server-side
  return <Image src={data.heroUrl} priority />;
  // LCP element is in the initial HTML response
}
```

### 2.2 LCP Optimization Checklist

```
LCP OPTIMIZATION PRIORITY ORDER:

  1. TTFB Optimization (server response)
     ├── Use CDN for static assets AND HTML
     ├── Enable server-side caching (Redis, Varnish)
     ├── Use streaming SSR (React 18+, Nuxt, SvelteKit)
     ├── Optimize database queries
     └── Use edge functions for dynamic content

  2. Resource Discovery (find LCP resource early)
     ├── Preload LCP image: <link rel="preload">
     ├── Set fetchpriority="high" on LCP image
     ├── Inline critical CSS (above-the-fold)
     ├── Eliminate render-blocking JS from <head>
     └── Use preconnect for external resource origins

  3. Resource Load Time (download faster)
     ├── Modern image formats (WebP/AVIF)
     ├── Responsive images (srcset + sizes)
     ├── Image CDN with automatic optimization
     ├── Compress images (quality 75-85 is usually sufficient)
     └── Reduce image file size (aim for <200KB for hero)

  4. Render Delay (paint faster)
     ├── SSR/SSG instead of client-side rendering
     ├── Minimize critical CSS
     ├── Reduce JavaScript blocking main thread
     ├── Avoid layout shifts before LCP element
     └── Ensure LCP element doesn't depend on JS to render
```

---

## 3. INP — Interaction to Next Paint

```
INP MEASUREMENT:

  User clicks/taps/types
        │
        ▼
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │  INPUT DELAY        PROCESSING        PRESENT   │
  │  ┌──────────┐      ┌──────────┐    ┌─────────┐ │
  │  │ Waiting  │      │ Event    │    │ Render  │ │
  │  │ for main │─────▶│ handler  │───▶│ & paint │ │
  │  │ thread   │      │ executes │    │         │ │
  │  └──────────┘      └──────────┘    └─────────┘ │
  │                                                 │
  │  ← ── ── ── ── INP duration ── ── ── ── ── ──→ │
  │                                                 │
  └─────────────────────────────────────────────────┘

  TARGETS:
  < 200ms  → Good ✅
  < 500ms  → Needs Improvement ⚠️
  > 500ms  → Poor ❌

  INP vs FID:
  • FID measured ONLY the first interaction's input delay
  • INP measures ALL interactions throughout the page lifecycle
  • INP includes input delay + processing + presentation
  • INP reports the worst interaction (at 98th percentile)
  • INP replaced FID in March 2024

  WHAT COUNTS AS AN INTERACTION:
  • Click (pointerdown → pointerup → click)
  • Tap (touchstart → touchend → click)
  • Keypress (keydown → keyup)
  • Does NOT count: scroll, hover, pinch-to-zoom
```

### 3.1 INP Optimization Strategies

```typescript
// STRATEGY 1: Break up long tasks
// ──────────────────────────────

// ❌ BAD: One long task blocks main thread
function processLargeList(items: Item[]) {
  items.forEach(item => {
    // 50ms+ of synchronous work
    expensiveTransform(item);
    updateDOM(item);
  });
}

// ✅ GOOD: Yield to main thread between chunks
async function processLargeList(items: Item[]) {
  const CHUNK_SIZE = 50;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    chunk.forEach(item => {
      expensiveTransform(item);
      updateDOM(item);
    });

    // Yield to main thread — allows browser to handle user input
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// ✅ BETTER: Use scheduler.yield() (Chrome 115+)
async function processLargeList(items: Item[]) {
  for (const item of items) {
    expensiveTransform(item);
    updateDOM(item);

    // Modern yield API — gives back to browser, resumes with priority
    if ('scheduler' in globalThis) {
      await scheduler.yield();
    }
  }
}


// STRATEGY 2: Use requestIdleCallback for non-urgent work
// ──────────────────────────────────────────────────────

// ✅ Analytics, logging, and non-critical updates
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && pendingTasks.length > 0) {
    const task = pendingTasks.shift()!;
    task.execute();
  }

  if (pendingTasks.length > 0) {
    requestIdleCallback(processRemainingTasks);
  }
}, { timeout: 2000 }); // Ensure it runs within 2s max


// STRATEGY 3: Web Workers for heavy computation
// ────────────────────────────────────────────

// main.ts
const worker = new Worker(
  new URL('./heavy-worker.ts', import.meta.url),
  { type: 'module' }
);

// Offload heavy computation to worker thread
worker.postMessage({ data: largeDataset });
worker.onmessage = (event) => {
  updateUI(event.data.result);
};

// heavy-worker.ts
self.onmessage = (event) => {
  const result = heavyComputation(event.data);
  self.postMessage({ result });
};


// STRATEGY 4: Debounce rapid interactions
// ──────────────────────────────────────

function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// ✅ Debounce search input — don't process every keystroke
const handleSearch = debounce((query: string) => {
  performSearch(query);
}, 300);


// STRATEGY 5: React — Use transitions for non-urgent updates
// ─────────────────────────────────────────────────────────

import { useTransition, useState } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value); // Urgent — update input immediately

    startTransition(() => {
      setResults(filterResults(value)); // Non-urgent — can be interrupted
    });
  }

  return (
    <>
      <input value={query} onChange={handleInput} />
      {isPending ? <Spinner /> : <ResultList results={results} />}
    </>
  );
}
```

---

## 4. CLS — Cumulative Layout Shift

```
CLS VISUALIZATION:

  BEFORE SHIFT:           AFTER SHIFT:
  ┌────────────────┐      ┌────────────────┐
  │   Header       │      │   Header       │
  ├────────────────┤      ├────────────────┤
  │   Paragraph    │      │  [AD LOADED]   │ ← New element pushed content down
  │   text here    │      ├────────────────┤
  │                │      │   Paragraph    │ ← SHIFTED DOWN!
  ├────────────────┤      │   text here    │
  │   Button       │      │                │
  └────────────────┘      ├────────────────┤
                          │   Button       │ ← User was about to click HERE
                          └────────────────┘     but it moved!

  CLS FORMULA:
  Layout Shift Score = Impact Fraction × Distance Fraction

  Impact Fraction: % of viewport affected by the shift
  Distance Fraction: How far elements moved (as % of viewport)

  TARGETS:
  < 0.1   → Good ✅
  < 0.25  → Needs Improvement ⚠️
  > 0.25  → Poor ❌
```

### 4.1 Common CLS Causes and Fixes

```html
<!-- CAUSE 1: Images without dimensions -->

<!-- ❌ BAD: No width/height — browser doesn't know space to reserve -->
<img src="/photo.jpg" alt="Photo" />

<!-- ✅ GOOD: Explicit dimensions — browser reserves space -->
<img src="/photo.jpg" alt="Photo" width="800" height="600" />

<!-- ✅ GOOD: CSS aspect ratio -->
<style>
  .responsive-img {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }
</style>
<img src="/photo.jpg" alt="Photo" class="responsive-img" />


<!-- CAUSE 2: Dynamically injected content -->

<!-- ❌ BAD: Ad slot with no reserved space -->
<div id="ad-banner"></div>

<!-- ✅ GOOD: Reserve space with min-height -->
<style>
  .ad-slot {
    min-height: 250px; /* Reserve space for standard ad */
    background: #f0f0f0;
  }
</style>
<div id="ad-banner" class="ad-slot"></div>


<!-- CAUSE 3: Web fonts causing FOUT (Flash of Unstyled Text) -->

<!-- ✅ FIX: Use font-display: optional (no layout shift) -->
<style>
  @font-face {
    font-family: 'CustomFont';
    src: url('/font.woff2') format('woff2');
    font-display: optional; /* Use fallback if font hasn't loaded by FCP */
  }
</style>

<!-- ✅ FIX: Use size-adjust for fallback font matching -->
<style>
  @font-face {
    font-family: 'CustomFont Fallback';
    src: local('Arial');
    size-adjust: 105%;
    ascent-override: 95%;
    descent-override: 22%;
    line-gap-override: 0%;
  }
</style>
```

```typescript
// CAUSE 4: Dynamic content above existing content

// ❌ BAD: Inserting notification banner shifts everything down
function addNotification(message: string) {
  const banner = document.createElement('div');
  banner.textContent = message;
  document.body.prepend(banner); // Shifts ALL content down
}

// ✅ GOOD: Use fixed/sticky positioning (doesn't affect layout)
function addNotification(message: string) {
  const banner = document.createElement('div');
  banner.textContent = message;
  banner.style.position = 'fixed';
  banner.style.top = '0';
  banner.style.left = '0';
  banner.style.right = '0';
  banner.style.zIndex = '1000';
  document.body.appendChild(banner);
}

// ✅ GOOD: Reserve space in advance
// CSS: .notification-area { min-height: 48px; }


// CAUSE 5: Lazy-loaded content replacing placeholders

// ✅ FIX: Skeleton screens that match final layout exactly
function ProductCard({ loading, product }: Props) {
  if (loading) {
    return (
      <div className="product-card">
        {/* Skeleton matches exact dimensions of real content */}
        <div className="skeleton" style={{ width: '100%', aspectRatio: '1/1' }} />
        <div className="skeleton" style={{ height: '24px', width: '80%' }} />
        <div className="skeleton" style={{ height: '20px', width: '40%' }} />
      </div>
    );
  }

  return (
    <div className="product-card">
      <img src={product.image} width={300} height={300} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{product.price}</p>
    </div>
  );
}
```

---

## 5. TTFB — Time to First Byte

```
TTFB BREAKDOWN:

  Browser        DNS         TCP          TLS          Server        First
  Request        Lookup      Connect      Handshake    Processing    Byte
  ────────┬──────┬───────────┬────────────┬────────────┬────────────┬──
          │      │           │            │            │            │
          ▼      ▼           ▼            ▼            ▼            ▼
  ├─ DNS ─┤├─ TCP ─┤├── TLS ──┤├─── Server ───┤├─ Transfer ─┤
  ~20ms    ~30ms     ~30ms       ~50-500ms        ~10ms

  TARGET: < 800ms total TTFB

  OPTIMIZATION PRIORITY:
  1. Server processing time (biggest variable)
     ├── Database query optimization
     ├── Server-side caching (Redis, in-memory)
     ├── Efficient application code
     └── Reduce computation per request

  2. Network latency (DNS + TCP + TLS)
     ├── CDN (serve from edge, close to user)
     ├── DNS prefetching
     ├── HTTP/2 or HTTP/3 (QUIC)
     ├── TLS 1.3 (faster handshake)
     └── Connection reuse (keep-alive)

  3. Streaming (start sending before done)
     ├── Streaming SSR (React 18, Nuxt, SvelteKit)
     ├── Chunked transfer encoding
     └── Early hints (103 status code)
```

```typescript
// STREAMING SSR — Reduces perceived TTFB

// Next.js App Router — automatic streaming with Suspense
// app/page.tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <>
      {/* Shell streams immediately (low TTFB) */}
      <Header />
      <Hero />

      {/* Data-dependent content streams when ready */}
      <Suspense fallback={<ProductsSkeleton />}>
        <Products /> {/* Awaits data, streams when resolved */}
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews /> {/* Streams independently */}
      </Suspense>

      <Footer />
    </>
  );
}

// SvelteKit — Streaming with deferred data
// +page.server.ts
export const load = async () => {
  return {
    // Blocks — waits for this before sending HTML
    hero: await getHero(),

    // Streams — sends HTML immediately, resolves later
    products: getProducts(), // Note: no await!
    reviews: getReviews(),
  };
};
```

---

## 6. Measuring Core Web Vitals

### 6.1 web-vitals Library

```typescript
// Install: npm install web-vitals

import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

// Report to analytics
function sendToAnalytics(metric: { name: string; value: number; id: string }) {
  // Send to your analytics endpoint
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    page: window.location.pathname,
    timestamp: Date.now(),
  });

  // Use sendBeacon for reliability (fires even on page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', body);
  } else {
    fetch('/api/analytics', { body, method: 'POST', keepalive: true });
  }
}

// Track all Core Web Vitals
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);

// Attribution builds — detailed diagnostics
import { onLCP } from 'web-vitals/attribution';

onLCP((metric) => {
  console.log('LCP value:', metric.value);
  console.log('LCP element:', metric.attribution.element);
  console.log('LCP resource URL:', metric.attribution.url);
  console.log('TTFB:', metric.attribution.timeToFirstByte);
  console.log('Resource load delay:', metric.attribution.resourceLoadDelay);
  console.log('Resource load time:', metric.attribution.resourceLoadDuration);
  console.log('Element render delay:', metric.attribution.elementRenderDelay);
});
```

### 6.2 Performance Observer API

```typescript
// Low-level Performance Observer for custom metrics

// Observe LCP entries
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1]; // Last is the LCP element
  console.log('LCP:', lastEntry.startTime, 'Element:', lastEntry.element);
});
lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

// Observe layout shifts
const clsObserver = new PerformanceObserver((list) => {
  let clsScore = 0;
  for (const entry of list.getEntries()) {
    if (!(entry as any).hadRecentInput) {
      clsScore += (entry as any).value;
    }
  }
  console.log('CLS:', clsScore);
});
clsObserver.observe({ type: 'layout-shift', buffered: true });

// Observe long tasks (>50ms — blocks main thread)
const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Long task:', entry.duration, 'ms');
    // Long tasks > 50ms degrade INP
  }
});
longTaskObserver.observe({ type: 'longtask', buffered: true });

// Observe resource timing
const resourceObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.initiatorType === 'img') {
      console.log(`Image ${entry.name}: ${entry.duration}ms`);
    }
  }
});
resourceObserver.observe({ type: 'resource', buffered: true });
```

### 6.3 Measurement Tools Comparison

```
MEASUREMENT TOOLS:

  ┌───────────────────┬────────┬──────────┬────────┬──────────────────┐
  │ Tool              │ Type   │ INP?     │ Free?  │ Best For         │
  ├───────────────────┼────────┼──────────┼────────┼──────────────────┤
  │ Chrome DevTools   │ Lab    │ Simulate │ ✅     │ Debugging        │
  │ Lighthouse        │ Lab    │ TBT only │ ✅     │ Auditing         │
  │ PageSpeed Insights│ Both   │ Field✅  │ ✅     │ Quick check      │
  │ WebPageTest       │ Lab    │ No       │ ✅     │ Deep analysis    │
  │ CrUX Dashboard    │ Field  │ ✅       │ ✅     │ Trending         │
  │ Search Console    │ Field  │ ✅       │ ✅     │ SEO impact       │
  │ web-vitals lib    │ Field  │ ✅       │ ✅     │ Custom RUM       │
  │ Vercel Analytics  │ Field  │ ✅       │ Paid   │ Vercel projects  │
  │ Sentry Performance│ Field  │ ✅       │ Paid   │ Error + perf     │
  │ Datadog RUM       │ Field  │ ✅       │ Paid   │ Enterprise       │
  └───────────────────┴────────┴──────────┴────────┴──────────────────┘
```

---

## 7. Framework-Specific Optimization

### 7.1 React / Next.js

```typescript
// NEXT.JS APP ROUTER OPTIMIZATIONS

// 1. Server Components reduce client JS (improves INP + LCP)
// Server Components ship ZERO JavaScript to the browser
// app/page.tsx (Server Component by default)
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id); // Server-side fetch
  return (
    <div>
      <h1>{product.name}</h1>
      <Image src={product.image} priority width={600} height={400} />
      <Suspense fallback={<Skeleton />}>
        <Reviews productId={params.id} /> {/* Streams */}
      </Suspense>
      <AddToCartButton product={product} /> {/* Client Component */}
    </div>
  );
}

// 2. next/image — Automatic image optimization
import Image from 'next/image';
// Automatically: resizes, converts to WebP/AVIF, lazy loads, sets dimensions

// 3. next/font — Zero-CLS font loading
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], display: 'swap' });
// Preloads font, generates CSS with size-adjust fallback → zero CLS

// 4. Metadata API for preloading
export const metadata = {
  other: {
    'link': [
      { rel: 'preload', as: 'image', href: '/hero.webp' },
    ],
  },
};

// 5. Dynamic imports for non-critical components
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('./Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Don't SSR this heavy component
});
```

### 7.2 Vue / Nuxt

```typescript
// NUXT 3 OPTIMIZATIONS

// 1. Route rules for hybrid rendering
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },          // SSG — fastest LCP
    '/blog/**': { isr: 3600 },         // ISR — revalidate hourly
    '/dashboard/**': { ssr: false },    // SPA — no SSR overhead
    '/api/**': { cors: true, headers: { 'cache-control': 'max-age=60' } },
  },
});

// 2. NuxtImage for automatic optimization
// <NuxtImg src="/photo.jpg" width="800" height="600"
//          format="webp" loading="lazy" />

// 3. useAsyncData with lazy option
const { data, pending } = await useAsyncData(
  'products',
  () => $fetch('/api/products'),
  { lazy: true } // Don't block navigation
);

// 4. Prefetching
// Nuxt auto-prefetches <NuxtLink> targets on hover
// Manual: usePrefetch('/dashboard')
```

### 7.3 SvelteKit

```typescript
// SVELTEKIT OPTIMIZATIONS

// 1. Prerendering static pages (best LCP)
// +page.ts
export const prerender = true;

// 2. Streaming with deferred data
// +page.server.ts
export const load = async () => ({
  hero: await getHero(),           // Blocks rendering
  comments: getComments(),         // Streams (no await)
});

// +page.svelte
<script>
  let { data } = $props();
</script>
<HeroSection hero={data.hero} />
{#await data.comments}
  <CommentsSkeleton />
{:then comments}
  <CommentList {comments} />
{/await}

// 3. Enhanced images
// @sveltejs/enhanced-img — auto WebP/AVIF, responsive, dimensions
// <enhanced:img src="./hero.jpg" alt="Hero" />
```

---

## 8. Performance Budgets

```
PERFORMANCE BUDGET TEMPLATE:

  ┌──────────────────────────┬───────────────────┬────────────┐
  │ Metric                   │ Budget            │ Tool       │
  ├──────────────────────────┼───────────────────┼────────────┤
  │ Total JS (compressed)    │ < 200 KB          │ Bundler    │
  │ Total CSS (compressed)   │ < 50 KB           │ Bundler    │
  │ Total page weight        │ < 1 MB            │ WebPageTest│
  │ Hero image size          │ < 200 KB          │ Manual     │
  │ LCP                      │ < 2.5s            │ CrUX       │
  │ INP                      │ < 200ms           │ CrUX       │
  │ CLS                      │ < 0.1             │ CrUX       │
  │ TTFB                     │ < 800ms           │ CrUX       │
  │ Lighthouse Performance   │ > 90              │ Lighthouse │
  │ Third-party scripts      │ < 3               │ Manual     │
  │ Total requests           │ < 50              │ DevTools   │
  │ Time to Interactive      │ < 3.5s            │ Lighthouse │
  └──────────────────────────┴───────────────────┴────────────┘

  ENFORCEMENT:
  • CI pipeline: Run Lighthouse CI, fail build if score < 90
  • Bundle analyzer: Fail if JS exceeds budget
  • PR checks: Report bundle size diff in pull requests
  • Monitoring: Alert if field CWV regress week-over-week
```

```typescript
// Lighthouse CI configuration (.lighthouserc.js)
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/products'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

// Bundle size check in CI (webpack-bundle-analyzer / bundlesize)
// package.json
// "bundlesize": [
//   { "path": "dist/js/*.js", "maxSize": "200 kB" },
//   { "path": "dist/css/*.css", "maxSize": "50 kB" }
// ]
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Optimizing without measuring** | Random changes, no proof of improvement, wasted effort | ALWAYS measure before and after with web-vitals or CrUX data |
| **Using only lab data (Lighthouse)** | Lighthouse score is 100 but real users report slow experience | Use field data (CrUX, RUM) — that's what Google uses for ranking |
| **Images without dimensions** | CLS > 0.25, content jumps as images load | ALWAYS set width/height or use CSS aspect-ratio on images |
| **Render-blocking scripts in head** | LCP delayed by JavaScript parsing and execution | Use async/defer, move scripts to bottom, or dynamically load |
| **Not preloading LCP resource** | Browser discovers hero image late, LCP > 2.5s | `<link rel="preload" as="image" fetchpriority="high">` |
| **Client-rendering above the fold** | Blank screen until JS downloads, parses, and executes | Use SSR/SSG for initial paint, hydrate interactivity |
| **Too many third-party scripts** | Main thread blocked by analytics, ads, chat widgets | Audit third-party scripts, defer non-essential, use facades |
| **Layout shifts from dynamic content** | Ads, notifications, lazy content push page around | Reserve space with min-height, use fixed/sticky positioning |
| **Ignoring INP (only caring about load)** | Page loads fast but interactions feel sluggish | Break up long tasks, use transitions, debounce input |
| **Font loading causing CLS** | Text reflows when web font loads (FOUT) | Use `font-display: optional` or `size-adjust` fallback matching |
| **Over-optimizing** | Complex caching, code splitting every 10KB module | Optimize the biggest impact items first — diminishing returns are real |

---

## 10. Enforcement Checklist

### LCP (< 2.5s)
- [ ] Hero image preloaded with `<link rel="preload" fetchpriority="high">`
- [ ] Images use modern formats (WebP/AVIF) with fallbacks
- [ ] SSR or SSG used for above-the-fold content
- [ ] No render-blocking JavaScript in `<head>`
- [ ] Critical CSS inlined, non-critical CSS deferred
- [ ] CDN configured for HTML and static assets
- [ ] TTFB < 800ms measured in field data

### INP (< 200ms)
- [ ] No long tasks > 50ms on main thread during interactions
- [ ] Heavy computation offloaded to Web Workers
- [ ] Input handlers debounced/throttled where appropriate
- [ ] React: `useTransition` used for non-urgent state updates
- [ ] Third-party scripts deferred and non-blocking
- [ ] Event handlers kept lightweight (< 100ms processing)

### CLS (< 0.1)
- [ ] ALL images have explicit width/height or aspect-ratio
- [ ] Ad slots have reserved space (min-height)
- [ ] Web fonts use `font-display: optional` or size-adjust fallbacks
- [ ] No dynamic content inserted above existing visible content
- [ ] Skeleton screens match final layout dimensions exactly
- [ ] No layout shifts from lazy-loaded content

### Measurement & Monitoring
- [ ] web-vitals library installed and reporting to analytics
- [ ] CrUX data reviewed monthly for field performance
- [ ] Lighthouse CI integrated in build pipeline
- [ ] Performance budgets defined and enforced
- [ ] Bundle size monitored per PR with size-limit or bundlesize
- [ ] Alerts configured for CWV regressions in production
