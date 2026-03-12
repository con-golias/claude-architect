# Svelte 5 — Performance Deep Dive

> **AI Plugin Directive:** When a developer asks "how is Svelte performant?", "why is Svelte fast?", "Svelte vs React performance", "Svelte bundle size", "SvelteKit SSR performance", "Svelte hydration", or any performance-related Svelte question, ALWAYS consult this directive. Svelte's performance advantage comes from compile-time optimization, no virtual DOM, fine-grained reactivity, minimal runtime, and surgical DOM updates. ALWAYS explain the compilation model when discussing Svelte performance. NEVER claim Svelte has zero runtime — it has a minimal runtime (~2KB) for reactivity scheduling and DOM helpers.

**Core Rule: Svelte outperforms virtual DOM frameworks in initial load, memory usage, and update speed because it compiles components into optimized imperative code at build time. There is NO virtual DOM diffing. The compiler statically determines which DOM nodes depend on which state and generates targeted update instructions. Combined with SvelteKit's SSR streaming, partial hydration awareness, and aggressive code-splitting, Svelte delivers best-in-class Web Vitals for most application types.**

---

## 1. Why Svelte is Fast — The Compilation Model

```
          VIRTUAL DOM FRAMEWORKS (React, Vue)
          ────────────────────────────────────

  State Change
      │
      ▼
  Re-render entire component tree (virtual)
      │
      ▼
  Build new Virtual DOM tree
      │
      ▼
  Diff old VDOM vs new VDOM (O(n) algorithm)
      │
      ▼
  Calculate minimal DOM patches
      │
      ▼
  Apply patches to real DOM
      │
  COST: Re-render + diff + patch on EVERY state change
  RUNTIME: ~30-45KB (React) / ~33KB (Vue) framework code


          SVELTE (Compiler approach)
          ──────────────────────────

  State Change (signal notification)
      │
      ▼
  Run the specific update function for that signal
      │
      ▼
  Directly update the specific DOM node(s)
      │
  COST: One function call per changed binding
  RUNTIME: ~2KB shared runtime (scheduling + helpers)
  NO re-render. NO diff. NO virtual DOM.
```

### 1.1 What the Compiler Actually Generates

Given this Svelte component:

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);

  function increment() {
    count++;
  }
</script>

<button onclick={increment}>
  {count} x 2 = {doubled}
</button>
```

The compiler produces (simplified) JavaScript equivalent to:

```javascript
// Compiled output (conceptual — actual output is more optimized)
import { source, derived, template, text, event, effect } from 'svelte/internal';

export default function Counter($$anchor) {
  // Create reactive signals
  let count = source(0);                        // $state → source signal
  let doubled = derived(() => count.v * 2);     // $derived → derived signal

  function increment() {
    count.v++;  // Mutating .v notifies dependents
  }

  // Create DOM from template (uses cloneNode for speed)
  const button = template('<button></button>');
  const node = button.cloneNode(true);

  // Bind click handler
  event(node, 'click', increment);

  // Create text node with reactive binding
  const txt = text(() => `${count.v} x 2 = ${doubled.v}`);
  node.appendChild(txt);

  // Mount
  $$anchor.appendChild(node);

  // The update function: ONLY runs when count or doubled change
  // NO re-render of entire component. Just this ONE text node update.
}
```

**Key takeaways:**
- Each reactive binding produces one update instruction
- DOM creation uses `cloneNode` (faster than `createElement` chains)
- No component re-execution on state change (unlike React)
- No virtual DOM tree allocation or garbage collection
- Template literals are hoisted and shared across instances

### 1.2 Fine-Grained Reactivity vs Virtual DOM Diffing

```
          GRANULARITY COMPARISON

  ┌──────────────────────────────────────────────────────┐
  │ REACT: Component-level granularity                    │
  │                                                      │
  │  <App>              ← state changes here             │
  │    <Header />       ← re-renders (unless memoized)   │
  │    <Sidebar />      ← re-renders (unless memoized)   │
  │    <Content>        ← re-renders                     │
  │      <List>         ← re-renders                     │
  │        <Item />     ← re-renders × N items           │
  │        <Item />     ← re-renders × N items           │
  │      </List>        │
  │    </Content>       │
  │  </App>             │
  │                                                      │
  │  Mitigations: React.memo, useMemo, useCallback,      │
  │  React Compiler (auto-memoization in React 19+)      │
  └──────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │ SVELTE: Binding-level granularity                     │
  │                                                      │
  │  <App>              ← state changes here             │
  │    <Header />       ← NOT touched                    │
  │    <Sidebar />      ← NOT touched                    │
  │    <Content>        ← NOT touched                    │
  │      <List>         ← NOT touched                    │
  │        <Item />     ← one text node updated          │
  │        <Item />     ← NOT touched                    │
  │      </List>        │
  │    </Content>       │
  │  </App>             │
  │                                                      │
  │  No memoization needed. The compiler knows exactly   │
  │  which DOM node depends on which state.              │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Bundle Size

### 2.1 Framework Runtime Size Comparison

```
  FRAMEWORK RUNTIME SIZE (minified + gzipped)
  ───────────────────────────────────────────
  (approximate, varies by version and configuration)

  Svelte 5:       ~2.0 KB  (minimal runtime shipped)
  Preact:         ~3.5 KB
  SolidJS:        ~7.0 KB
  Vue 3:          ~33 KB   (runtime + compiler)
  React 19:       ~6 KB    (react) + ~38 KB (react-dom) ≈ 44 KB
  Angular 18+:    ~65 KB   (core runtime)

  ┌────────────────────────────────────────────────────────────┐
  │ Svelte        ██ 2KB                                       │
  │ Preact        ███ 3.5KB                                    │
  │ Solid         █████ 7KB                                    │
  │ Vue 3         ██████████████████████ 33KB                  │
  │ React 19      █████████████████████████████ 44KB           │
  │ Angular 18    ██████████████████████████████████████ 65KB  │
  └────────────────────────────────────────────────────────────┘

  IMPORTANT NUANCE:
  ─────────────────
  Svelte's per-component code is LARGER than React's because each
  component carries its own update logic (no shared diffing engine).

  Crossover point: At ~50-100 components, a Svelte app's TOTAL
  bundle may approach React's size. But:
  - SvelteKit code-splits aggressively (per-route)
  - Tree-shaking removes unused Svelte runtime features
  - Real-world apps rarely load all components at once
  - Initial page load is almost always smaller with Svelte
```

### 2.2 Real-World Bundle Size Analysis

```
  HELLO WORLD APP (production build, gzipped)
  ─────────────────────────────────────────────
  Svelte:      1.6 KB
  Preact:      3.8 KB
  React:       42.0 KB
  Vue:         16.0 KB (runtime-only mode)
  Angular:     65.0 KB

  TODOMVC APP (production build, gzipped)
  ─────────────────────────────────────────
  Svelte:      3.8 KB
  Preact:      8.2 KB
  React:       49.0 KB
  Vue:         22.0 KB
  Angular:     73.0 KB

  REAL-WORLD E-COMMERCE (medium complexity, gzipped)
  ──────────────────────────────────────────────────
  Svelte/Kit:    45-80 KB  (initial route JS)
  Next.js/React: 80-150 KB (initial route JS)
  Nuxt/Vue:      70-120 KB (initial route JS)
  Angular:       100-180 KB (initial route JS)

  NOTE: These are approximate ranges. Actual sizes depend on
  app complexity, third-party dependencies, and build configuration.
```

### 2.3 Why Bundle Size Matters

```
  IMPACT OF BUNDLE SIZE ON PERFORMANCE
  ─────────────────────────────────────

  Network (3G connection, ~1.6 Mbps):
  ┌──────────────────────────────────────────────────────┐
  │ 2 KB (Svelte):   ~10ms download                      │
  │ 44 KB (React):   ~220ms download                     │
  │ 65 KB (Angular): ~325ms download                     │
  └──────────────────────────────────────────────────────┘

  Parse + Compile (mobile device):
  ┌──────────────────────────────────────────────────────┐
  │ JavaScript costs ~1ms per KB to parse on mobile      │
  │ 2 KB (Svelte):   ~2ms parse                          │
  │ 44 KB (React):   ~44ms parse                         │
  │ 65 KB (Angular): ~65ms parse                         │
  └──────────────────────────────────────────────────────┘

  Total impact on Time-to-Interactive (TTI):
  Svelte saves 200-400ms on 3G for initial framework load alone.
  This compounds with each additional code-split chunk.
```

---

## 3. Runtime Performance

### 3.1 DOM Update Performance

```
  JS FRAMEWORK BENCHMARK RESULTS (approximate normalized scores)
  ──────────────────────────────────────────────────────────────
  (lower is better, 1.0 = vanilla JS baseline)

  ┌────────────────────┬──────────┬──────────┬──────────┐
  │ Operation          │ Svelte 5 │ React 19 │ Vue 3    │
  ├────────────────────┼──────────┼──────────┼──────────┤
  │ Create 1000 rows   │ 1.05     │ 1.30     │ 1.25     │
  │ Update every 10th  │ 1.02     │ 1.15     │ 1.08     │
  │ Partial update     │ 1.03     │ 1.20     │ 1.10     │
  │ Select row         │ 1.01     │ 1.08     │ 1.03     │
  │ Swap rows          │ 1.03     │ 1.12     │ 1.05     │
  │ Remove row         │ 1.02     │ 1.10     │ 1.05     │
  │ Create 10000 rows  │ 1.15     │ 1.80     │ 1.50     │
  │ Append 1000 rows   │ 1.04     │ 1.20     │ 1.15     │
  │ Clear 1000 rows    │ 1.02     │ 1.25     │ 1.15     │
  │ Memory (ready)     │ 1.02     │ 1.80     │ 1.30     │
  │ Memory (1000 rows) │ 1.05     │ 2.10     │ 1.40     │
  │ Startup time       │ 1.01     │ 1.50     │ 1.30     │
  └────────────────────┴──────────┴──────────┴──────────┘

  Source: js-framework-benchmark (approximate, varies by version)
  Svelte 5 consistently ranks near the top alongside
  Solid, Inferno, and vanilla JS implementations.
```

### 3.2 Memory Usage

Svelte uses significantly less memory than virtual DOM frameworks because:

```
  MEMORY ALLOCATION PER COMPONENT INSTANCE
  ─────────────────────────────────────────

  React component:
  ┌──────────────────────────────────┐
  │ Fiber node object                │ ~300-500 bytes
  │ Props object                     │ ~100-200 bytes
  │ Hooks linked list                │ ~100-300 bytes
  │ Virtual DOM element(s)           │ ~200-500 bytes
  │ Previous VDOM (for diffing)      │ ~200-500 bytes
  │ Effect cleanup references        │ ~50-100 bytes
  │ ─────────────────────────────    │
  │ TOTAL per component:             │ ~950-2100 bytes
  └──────────────────────────────────┘

  Svelte component:
  ┌──────────────────────────────────┐
  │ Signal values (state)            │ ~50-100 bytes
  │ Derived computations             │ ~30-80 bytes
  │ Effect registrations             │ ~30-50 bytes
  │ (No VDOM, no fiber, no hooks)    │
  │ ─────────────────────────────    │
  │ TOTAL per component:             │ ~110-230 bytes
  └──────────────────────────────────┘

  With 1000 list items:
  React: ~1-2 MB of framework overhead
  Svelte: ~110-230 KB of framework overhead
  (5-10x less memory for framework bookkeeping)
```

### 3.3 Svelte 5 Signal Performance Characteristics

```svelte
<script lang="ts">
  // SIGNAL GRAPH PERFORMANCE
  //
  // Svelte 5 uses a push-pull reactive system:
  //
  // PUSH: When a source ($state) changes, it notifies
  //       dependents that they may be stale
  //
  // PULL: Derived values are lazily evaluated — they only
  //       recompute when actually read AND marked stale
  //
  // This means unused derived values have ZERO cost.

  let count = $state(0);

  // This derived value costs NOTHING if never read in template
  let expensiveComputation = $derived.by(() => {
    // Only runs when count changes AND this value is read
    return heavyCalculation(count);
  });

  // Only displayed conditionally — computation skipped when hidden
  let showExpensive = $state(false);
</script>

{#if showExpensive}
  <p>Result: {expensiveComputation}</p>
{/if}

<!-- expensiveComputation is NOT computed when showExpensive is false -->
```

### 3.4 Batched Updates

```svelte
<script lang="ts">
  let a = $state(0);
  let b = $state(0);
  let c = $state(0);

  function updateAll() {
    // Svelte batches all synchronous state changes
    // The DOM is updated ONCE after all three changes
    a = 1;  // mark dirty
    b = 2;  // mark dirty
    c = 3;  // mark dirty
    // → single microtask flush → one DOM update
  }

  // Even across function calls:
  function complexUpdate() {
    updatePartA();
    updatePartB();
    updatePartC();
    // All changes batched into one DOM update
  }
</script>
```

---

## 4. SvelteKit Performance Features

### 4.1 Server-Side Rendering (SSR)

```
          SVELTEKIT SSR FLOW
          ──────────────────

  Client Request
      │
      ▼
  hooks.server.ts → handle()
      │
      ▼
  +layout.server.ts → load()  ← Server-only data (DB, auth)
      │
      ▼
  +page.server.ts → load()    ← Server-only data
      │
      ▼
  Render components to HTML string
  (components execute on server, produce HTML)
      │
      ▼
  Inject serialized data into HTML
  (data is embedded as JSON for hydration)
      │
      ▼
  Send complete HTML to client
      │
      ▼
  Client receives HTML → Paint (FCP)
      │
      ▼
  Download + parse JS bundle
      │
      ▼
  Hydration: attach event handlers + make interactive (TTI)
      │
      ▼
  Client-side navigation takes over (SPA mode)
```

### 4.2 Streaming SSR

```typescript
// +page.server.ts — Streaming with nested promises
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  // This data loads FIRST (blocks initial HTML)
  const criticalData = await fetch('/api/header-data').then(r => r.json());

  // These are returned as PROMISES — they stream in later
  // The page renders immediately with critical data,
  // then secondary data streams in as it resolves
  return {
    critical: criticalData,

    // NOT awaited — streamed to client when ready
    comments: fetch('/api/comments').then(r => r.json()),
    recommendations: fetch('/api/recommendations').then(r => r.json()),
    analytics: fetch('/api/analytics').then(r => r.json())
  };
};
```

```svelte
<!-- +page.svelte — Rendering streamed data -->
<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<!-- Critical data renders immediately -->
<h1>{data.critical.title}</h1>

<!-- Streamed data: shows loading state, then resolves -->
{#await data.comments}
  <p>Loading comments...</p>
{:then comments}
  {#each comments as comment}
    <div class="comment">{comment.text}</div>
  {/each}
{:catch error}
  <p>Failed to load comments.</p>
{/await}

{#await data.recommendations}
  <div class="skeleton-grid">Loading recommendations...</div>
{:then recs}
  <div class="grid">
    {#each recs as rec}
      <Card title={rec.title} />
    {/each}
  </div>
{/await}
```

**Performance impact of streaming:**
- First Contentful Paint (FCP) is NOT blocked by slow API calls
- Time to First Byte (TTFB) is fast — HTML starts flowing immediately
- Largest Contentful Paint (LCP) improves for critical above-fold content
- Total page load perceived as faster even if total load time is the same

### 4.3 Prerendering (SSG)

```typescript
// +page.ts or +layout.ts
export const prerender = true;

// Generates static HTML at build time
// Results: zero server compute cost, CDN-cacheable, instant TTFB
```

```typescript
// svelte.config.js — Prerender configuration
const config = {
  kit: {
    prerender: {
      // Crawl all pages linked from entry points
      entries: ['*'],
      // Handle HTTP errors during prerendering
      handleHttpError: ({ path, referrer, message }) => {
        if (path === '/404') return; // Expected
        throw new Error(`${path} (referred from ${referrer}): ${message}`);
      },
      // Handle missing hash anchors
      handleMissingId: 'warn'
    }
  }
};
```

### 4.4 Hydration Performance

```
          HYDRATION COST COMPARISON
          ─────────────────────────

  The hydration step is where the client-side JS "takes over"
  the server-rendered HTML, attaching event handlers and
  making the page interactive.

  REACT HYDRATION:
  ┌────────────────────────────────────────────────────────┐
  │ 1. Parse entire React runtime (44KB)                   │
  │ 2. Execute ALL component functions (build virtual DOM) │
  │ 3. Walk virtual DOM tree and compare to real DOM        │
  │ 4. Attach event handlers                               │
  │ 5. Replay any queued events                            │
  │                                                        │
  │ Cost: O(n) where n = total DOM nodes                   │
  │ Every component function executes on hydration         │
  └────────────────────────────────────────────────────────┘

  SVELTE HYDRATION:
  ┌────────────────────────────────────────────────────────┐
  │ 1. Parse minimal Svelte runtime (~2KB)                 │
  │ 2. Walk existing DOM, claim nodes (no re-creation)     │
  │ 3. Attach event handlers directly to DOM nodes         │
  │ 4. Initialize reactive state (signals)                 │
  │                                                        │
  │ Cost: O(n) but with much smaller constant factor       │
  │ No virtual DOM construction, no diffing                │
  │ No component function re-execution                     │
  └────────────────────────────────────────────────────────┘

  Practical difference on a page with 500 DOM nodes:
  React hydration: ~50-150ms (mobile)
  Svelte hydration: ~10-30ms (mobile)
```

### 4.5 Code Splitting in SvelteKit

```
  SVELTEKIT AUTOMATIC CODE SPLITTING
  ──────────────────────────────────

  SvelteKit splits code at the ROUTE level automatically.

  src/routes/
  ├── +page.svelte          → /      → chunk-home.js
  ├── about/+page.svelte    → /about → chunk-about.js
  ├── blog/+page.svelte     → /blog  → chunk-blog.js
  └── blog/[slug]/
      └── +page.svelte      → /blog/:slug → chunk-blog-post.js

  When navigating to /:
  - Only chunk-home.js is loaded (+ shared runtime)
  - chunk-about.js is NOT loaded until user navigates to /about

  Prefetching:
  - SvelteKit prefetches route JS when user hovers over a link
  - data:sveltekit:prefetch attribute controls this behavior
  - Result: near-instant navigation for subsequent pages
```

```svelte
<!-- Link with prefetch (default behavior) -->
<a href="/about">About</a>
<!-- SvelteKit prefetches /about JS + data on hover -->

<!-- Disable prefetch for specific links -->
<a href="/heavy-page" data-sveltekit-preload-data="off">Heavy Page</a>

<!-- Preload on viewport entry (good for above-fold links) -->
<a href="/pricing" data-sveltekit-preload-data="hover">Pricing</a>
```

### 4.6 Adapter-Specific Performance

```typescript
// adapter-static: Full SSG, deployed to CDN
// → Best TTFB, zero server cost, but no dynamic content
import adapter from '@sveltejs/adapter-static';

// adapter-node: Node.js server
// → Full SSR/streaming, good for dynamic content
import adapter from '@sveltejs/adapter-node';

// adapter-vercel: Vercel Edge Functions + Serverless
// → Edge rendering for low latency globally
import adapter from '@sveltejs/adapter-vercel';
export default {
  kit: {
    adapter: adapter({
      runtime: 'edge',  // Run on Vercel Edge (faster cold starts)
      regions: ['iad1'], // Deploy close to your database
      split: true        // Each route is its own serverless function
    })
  }
};

// adapter-cloudflare: Cloudflare Workers
// → Edge rendering with sub-millisecond cold starts
import adapter from '@sveltejs/adapter-cloudflare';
```

---

## 5. Performance Best Practices

### 5.1 State Management for Performance

```svelte
<script lang="ts">
  // ✅ USE $state.raw FOR LARGE DATASETS
  // Prevents Proxy wrapping — much faster for large lists
  let items = $state.raw<Item[]>([]); // 10,000+ items

  // Update by reassignment (immutable pattern)
  function addItem(item: Item) {
    items = [...items, item];
  }

  // ✅ USE $derived FOR EXPENSIVE COMPUTATIONS
  // Cached and lazy — only recomputes when dependencies change AND value is read
  let sortedItems = $derived.by(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  });

  // ✅ AVOID UNNECESSARY EFFECTS
  // Effects run after every dependency change — keep them lean

  // ❌ BAD: Expensive work in effect
  // $effect(() => {
  //   const result = items.map(heavyTransform);  // Runs on every change
  //   processedItems = result;
  // });

  // ✅ GOOD: Use $derived instead
  let processedItems = $derived.by(() => items.map(heavyTransform));
</script>
```

### 5.2 List Rendering Performance

```svelte
<script lang="ts">
  // Always key your lists for optimal reconciliation
  let items = $state([
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' }
  ]);
</script>

<!-- ✅ KEYED: Svelte can efficiently reorder, add, remove -->
{#each items as item (item.id)}
  <ExpensiveComponent data={item} />
{/each}

<!-- ❌ UNKEYED: Svelte recreates DOM nodes on reorder -->
{#each items as item}
  <ExpensiveComponent data={item} />
{/each}
```

### 5.3 Lazy Loading and Dynamic Imports

```svelte
<script lang="ts">
  // Lazy-load heavy components
  let showChart = $state(false);

  // Dynamic import — only loads when needed
  const ChartComponent = import('./HeavyChart.svelte');
</script>

{#if showChart}
  {#await ChartComponent then { default: Chart }}
    <Chart data={chartData} />
  {/await}
{/if}

<button onclick={() => showChart = true}>Show Chart</button>
```

### 5.4 Image and Asset Performance

```svelte
<!-- SvelteKit enhanced img with @sveltejs/enhanced-img -->
<script>
  import { enhance } from '$app/forms';
</script>

<!-- Native lazy loading -->
<img src="/hero.jpg" alt="Hero" loading="lazy" decoding="async" />

<!-- Responsive images -->
<picture>
  <source media="(min-width: 800px)" srcset="/hero-large.webp" type="image/webp" />
  <source media="(min-width: 400px)" srcset="/hero-medium.webp" type="image/webp" />
  <img src="/hero-small.jpg" alt="Hero" loading="lazy" />
</picture>
```

### 5.5 Avoiding Performance Pitfalls

```svelte
<script lang="ts">
  // ❌ PITFALL: Creating derived values that recompute too often
  let search = $state('');
  let items = $state<string[]>([]);

  // This recomputes on EVERY keystroke
  let filtered = $derived(items.filter(i => i.includes(search)));

  // ✅ BETTER: Debounce the input
  let debouncedSearch = $state('');
  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleSearch(value: string) {
    search = value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedSearch = value;
    }, 200);
  }

  let filteredDebounced = $derived(items.filter(i => i.includes(debouncedSearch)));


  // ❌ PITFALL: Expensive operations in template expressions
  // <p>{JSON.stringify(hugeObject)}</p>  ← recalculates every render

  // ✅ BETTER: Pre-compute in $derived
  let serialized = $derived(JSON.stringify(hugeObject));
  // <p>{serialized}</p>


  // ❌ PITFALL: Large $state objects when only part changes frequently
  let dashboard = $state({
    widgets: [],           // Changes rarely
    realTimeData: [],      // Changes every second
    userPreferences: {}    // Changes rarely
  });
  // Every change to realTimeData triggers proxy tracking for the entire object

  // ✅ BETTER: Separate frequently-changing state
  let widgets = $state<Widget[]>([]);
  let realTimeData = $state.raw<DataPoint[]>([]);  // Use $state.raw for frequent updates
  let userPreferences = $state({});


  // ❌ PITFALL: Effects that trigger themselves
  let count = $state(0);
  // $effect(() => {
  //   count = count + 1; // INFINITE LOOP — reads AND writes count
  // });

  // ✅ FIX: Use untrack for reads that shouldn't be dependencies
  import { untrack } from 'svelte';
  $effect(() => {
    const current = untrack(() => count);
    // Do something with current without re-triggering
  });
</script>
```

---

## 6. Performance Measurement and Profiling

### 6.1 Using $inspect for Development

```svelte
<script lang="ts">
  let items = $state<string[]>([]);

  // $inspect is stripped in production — zero performance cost
  $inspect(items).with((type, value) => {
    if (type === 'update') {
      console.log(`Items updated: ${value.length} items`);
      console.trace(); // See what caused the update
    }
  });
</script>
```

### 6.2 Web Vitals Monitoring

```typescript
// src/routes/+layout.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  // Monitor Core Web Vitals
  $effect(() => {
    if (typeof window !== 'undefined') {
      import('web-vitals').then(({ onCLS, onFCP, onFID, onLCP, onTTFB, onINP }) => {
        const sendToAnalytics = (metric) => {
          // Send to your analytics endpoint
          fetch('/api/vitals', {
            method: 'POST',
            body: JSON.stringify({
              name: metric.name,
              value: metric.value,
              rating: metric.rating,
              path: $page.url.pathname
            })
          });
        };

        onCLS(sendToAnalytics);
        onFCP(sendToAnalytics);
        onFID(sendToAnalytics);
        onLCP(sendToAnalytics);
        onTTFB(sendToAnalytics);
        onINP(sendToAnalytics);
      });
    }
  });
</script>
```

### 6.3 Performance Budgets

```
  RECOMMENDED PERFORMANCE BUDGETS FOR SVELTEKIT APPS
  ──────────────────────────────────────────────────

  ┌─────────────────────────┬──────────────────────────────┐
  │ Metric                  │ Budget                       │
  ├─────────────────────────┼──────────────────────────────┤
  │ Initial JS (per route)  │ < 50 KB gzipped              │
  │ Total page JS           │ < 150 KB gzipped             │
  │ CSS                     │ < 30 KB gzipped              │
  │ First Contentful Paint  │ < 1.0s (good), < 1.8s (ok)   │
  │ Largest Contentful Paint│ < 2.0s (good), < 2.5s (ok)   │
  │ Time to Interactive     │ < 3.0s on 3G                 │
  │ Cumulative Layout Shift │ < 0.1 (good)                 │
  │ Interaction to Next     │ < 200ms (good)               │
  │ Paint (INP)             │                              │
  │ Total Blocking Time     │ < 150ms                      │
  └─────────────────────────┴──────────────────────────────┘

  Svelte apps typically meet these budgets easily due to:
  - Minimal framework runtime
  - Automatic code splitting
  - No virtual DOM overhead
  - Scoped CSS (no unused CSS shipped)
```

---

## 7. Svelte 5 vs Svelte 4 Performance

```
  SVELTE 5 PERFORMANCE IMPROVEMENTS OVER SVELTE 4
  ────────────────────────────────────────────────

  1. SIGNAL-BASED REACTIVITY
     Svelte 4: Compiler-based, marks entire components dirty
     Svelte 5: Signal-based (runes), fine-grained at binding level
     Improvement: ~20-40% faster updates in complex components

  2. MEMORY EFFICIENCY
     Svelte 4: Each reactive variable = compiler-generated code
     Svelte 5: Shared signal runtime, more compact per-signal cost
     Improvement: ~30% less memory for state-heavy components

  3. DEEP REACTIVITY
     Svelte 4: Required immutable patterns ($: list = [...list, item])
     Svelte 5: Proxy-based deep reactivity (list.push(item) works)
     Improvement: Less allocation, fewer object spreads, less GC pressure

  4. COMPONENT CREATION
     Svelte 4: Larger per-component init code
     Svelte 5: Shared helpers reduce per-component overhead
     Improvement: ~10-15% faster component mount

  5. EVENT HANDLING
     Svelte 4: on: directive with event delegation
     Svelte 5: Standard HTML attributes, direct binding
     Improvement: Simpler, slightly less overhead per handler

  6. SNIPPETS vs SLOTS
     Svelte 4: Slots required runtime slot resolution
     Svelte 5: Snippets are compile-time, no runtime lookup
     Improvement: Zero-cost abstraction for content projection
```

---

## 8. Advanced Performance Patterns

### 8.1 Virtualized Lists

```svelte
<script lang="ts">
  // For very large lists (10,000+ items), use virtualization
  // Popular library: @tanstack/svelte-virtual or svelte-virtual-list

  let allItems = $state.raw(generateLargeDataset(50000));
  let containerHeight = 600;
  let itemHeight = 40;

  // Only render visible items + buffer
  let scrollTop = $state(0);
  let startIndex = $derived(Math.floor(scrollTop / itemHeight));
  let endIndex = $derived(Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 5,
    allItems.length
  ));
  let visibleItems = $derived(allItems.slice(startIndex, endIndex));
  let totalHeight = $derived(allItems.length * itemHeight);
  let offsetY = $derived(startIndex * itemHeight);
</script>

<div
  class="virtual-list"
  style="height: {containerHeight}px; overflow-y: auto;"
  onscroll={(e) => scrollTop = e.currentTarget.scrollTop}
>
  <div style="height: {totalHeight}px; position: relative;">
    <div style="transform: translateY({offsetY}px);">
      {#each visibleItems as item, i (item.id)}
        <div class="row" style="height: {itemHeight}px;">
          {item.name}
        </div>
      {/each}
    </div>
  </div>
</div>
```

### 8.2 Worker Offloading

```svelte
<script lang="ts">
  // Offload heavy computation to a Web Worker
  let data = $state<number[]>([]);
  let result = $state<any>(null);
  let processing = $state(false);

  async function processData() {
    processing = true;

    const worker = new Worker(
      new URL('$lib/workers/processor.ts', import.meta.url),
      { type: 'module' }
    );

    worker.postMessage({ data });

    worker.onmessage = (event) => {
      result = event.data;
      processing = false;
      worker.terminate();
    };
  }
</script>
```

### 8.3 Transition Performance

```svelte
<script lang="ts">
  import { fade, fly } from 'svelte/transition';

  let items = $state<any[]>([]);
</script>

<!-- ✅ CSS transitions (GPU-accelerated, off main thread) -->
{#each items as item (item.id)}
  <div transition:fly={{ y: 20, duration: 200 }}>
    {item.name}
  </div>
{/each}

<!-- ❌ AVOID: JS transitions on large lists (blocks main thread) -->
<!-- Use CSS transitions (transform, opacity) which are GPU-accelerated -->

<!-- ✅ For large lists, consider disabling transitions -->
{#each items as item (item.id)}
  <div>
    {item.name}
  </div>
{/each}

<!-- ✅ Use 'local' transitions to only animate when the block's
     own condition changes, NOT when parent mounts/unmounts -->
{#if showSection}
  {#each items as item (item.id)}
    <div transition:fade|local={{ duration: 150 }}>
      {item.name}
    </div>
  {/each}
{/if}
```

---

## 9. Comparison Summary

```
  PERFORMANCE COMPARISON MATRIX
  ─────────────────────────────

  ┌─────────────────────────┬────────┬────────┬────────┬─────────┐
  │ Metric                  │ Svelte │ React  │ Vue    │ Angular │
  ├─────────────────────────┼────────┼────────┼────────┼─────────┤
  │ Framework runtime size  │ ★★★★★ │ ★★     │ ★★★    │ ★       │
  │ Initial page load       │ ★★★★★ │ ★★★    │ ★★★★   │ ★★      │
  │ DOM update speed        │ ★★★★★ │ ★★★    │ ★★★★   │ ★★★     │
  │ Memory efficiency       │ ★★★★★ │ ★★     │ ★★★    │ ★★      │
  │ Time to Interactive     │ ★★★★★ │ ★★★    │ ★★★★   │ ★★★     │
  │ Hydration speed         │ ★★★★★ │ ★★★    │ ★★★★   │ ★★★     │
  │ Code splitting          │ ★★★★  │ ★★★★   │ ★★★★   │ ★★★★    │
  │ Build speed             │ ★★★★  │ ★★★    │ ★★★★   │ ★★★     │
  │ Large app scalability   │ ★★★   │ ★★★★   │ ★★★★   │ ★★★★★   │
  └─────────────────────────┴────────┴────────┴────────┴─────────┘

  ★★★★★ = Excellent   ★★★★ = Good   ★★★ = Average
  ★★ = Below Average   ★ = Poor

  KEY INSIGHT:
  Svelte excels at raw performance metrics but React/Angular may
  scale better for very large enterprise applications due to
  ecosystem tooling (profilers, dev tools, established patterns).
```

---

## 10. Real-World Performance Case Studies

```
  NOTABLE SVELTE PRODUCTION DEPLOYMENTS
  ──────────────────────────────────────

  1. The New York Times — Interactive data visualizations
     - Chose Svelte for minimal bundle size in embedded widgets
     - Widgets load in <1s on 3G connections
     - Previously: 200KB+ with React → Now: 15-30KB with Svelte

  2. Apple — Music and other web properties
     - Uses Svelte for specific interactive features
     - Performance-critical, battery-conscious (mobile Safari)

  3. Ikea — E-commerce product pages
     - SvelteKit for SSR + streaming
     - Improved LCP by 40% vs previous React implementation

  4. Square / Block — Dashboard and POS interfaces
     - Complex real-time data dashboards
     - Lower memory footprint critical for long-running sessions

  5. Spotify — Internal tools and some user-facing features
     - Developer velocity + performance balance

  NOTE: These are based on publicly available information.
  Specific performance numbers may vary and are approximate.
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Deep $state for large datasets** | Slow mount/update with 10,000+ row arrays | Use `$state.raw()` with immutable update patterns |
| **Not using $state.raw for API data** | Unnecessary Proxy wrapping of read-only server data | Wrap API responses: `data = $state.raw(apiResponse)` |
| **$effect for derived state** | Extra render cycles, stale values, complexity | Use `$derived` or `$derived.by()` — synchronous, cached |
| **Transitions on large lists** | Jank during list insert/remove with 100+ animated items | Disable transitions for large lists, use CSS `will-change` sparingly |
| **Not lazy loading routes** | Entire app in initial bundle, slow first load | SvelteKit auto-splits by route; verify with bundle analyzer |
| **Unkeyed {#each} blocks** | Incorrect DOM reuse causing state bugs and animation glitches | ALWAYS use keyed each: `{#each items as item (item.id)}` |
| **Excessive watchers ($effect)** | Too many effects creating a complex dependency graph | Consolidate related effects, prefer $derived where possible |
| **Not using SvelteKit streaming** | Slow TTFB waiting for all data before rendering | Use deferred data loading with promises in load functions |
| **Importing entire libraries** | Bloated bundles from `import _ from 'lodash'` | Tree-shakeable imports: `import debounce from 'lodash-es/debounce'` |
| **Not measuring before optimizing** | Premature optimization adding complexity with no measurable gain | Profile with DevTools first, measure before and after |

---

## 12. Enforcement Checklist

### Reactivity Performance
- [ ] `$state.raw()` used for arrays/objects with 1000+ items
- [ ] `$state.raw()` used for data from external APIs (read-mostly)
- [ ] `$derived` used for ALL computed values (never `$effect` for derived state)
- [ ] No unnecessary deep reactivity on large nested structures
- [ ] `untrack()` used to prevent unwanted dependency tracking in effects

### List Rendering
- [ ] ALL `{#each}` blocks have unique `:key` from data (not index)
- [ ] Lists with 100+ complex items use virtual scrolling
- [ ] Transitions disabled or limited for lists with 50+ items
- [ ] `{#each}` filtering done via `$derived` (not inline expressions)

### Bundle Size
- [ ] Bundle analyzed with `vite-bundle-visualizer` or `rollup-plugin-visualizer`
- [ ] Tree-shakeable imports used throughout (named imports, not default)
- [ ] Heavy components loaded with dynamic `import()`
- [ ] SvelteKit route-level code splitting verified (default behavior)
- [ ] No unnecessary polyfills or legacy browser support shipped

### SvelteKit SSR
- [ ] Streaming SSR enabled for dynamic pages
- [ ] `prerender = true` set for static content pages
- [ ] Load functions return only serializable, minimal data
- [ ] `$app/forms` `enhance` used for progressive enhancement
- [ ] Adapter configured for deployment platform

### Measurement
- [ ] Performance profiled with Chrome DevTools before optimization
- [ ] Core Web Vitals measured in production (LCP, CLS, INP)
- [ ] Bundle size budgets defined and monitored
- [ ] No premature optimization — Svelte is fast by default
