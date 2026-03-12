# Browser Rendering Pipeline — Complete Performance Specification

> **AI Plugin Directive:** When a developer asks "why is my page slow?", "how do I fix layout thrashing?", "what is the critical rendering path?", "how does browser painting work?", "when should I use will-change?", "how do I use content-visibility?", "what causes layout shifts?", "requestAnimationFrame vs requestIdleCallback?", "how do I measure rendering performance?", "how to avoid reflow?", or "GPU acceleration in CSS?", use this directive. The browser rendering pipeline is the SINGLE MOST IMPORTANT mental model for frontend performance. Every pixel the user sees passes through this pipeline. Understanding it separates developers who guess at performance from developers who systematically eliminate bottlenecks. You MUST understand each stage to give correct optimization advice. Incorrect advice (e.g., suggesting `will-change` everywhere) causes WORSE performance, not better.

---

## 1. The Rendering Pipeline — Complete Mental Model

**Every frame the browser renders follows this exact pipeline. Skipping stages is how you achieve 60fps. NEVER optimize blindly — identify which pipeline stage is the bottleneck FIRST, then apply targeted fixes.**

```
  NETWORK          PARSING           STYLE             LAYOUT           PAINT          COMPOSITE
 ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐    ┌──────────┐    ┌───────────┐
 │ Download │────>│ DOM +    │────>│ Style    │────>│ Layout   │───>│ Paint    │───>│ Composite │
 │ HTML/CSS │     │ CSSOM    │     │ Calc     │     │ (Reflow) │    │ (Raster) │    │ Layers    │
 │ JS       │     │ Build    │     │ Cascade  │     │ Box Geom │    │ Pixels   │    │ GPU       │
 └─────────┘     └──────────┘     └──────────┘     └──────────┘    └──────────┘    └───────────┘
      │                │                │                │               │               │
      │           Blocked by        Recalc on       EXPENSIVE:      Triggered      CHEAPEST:
      │           render-blocking   any style       reads geom       only when     only transform
      │           CSS + sync JS     mutation        properties       colors/       + opacity
      │                                                              visibility    changes
      │                                                              change
      ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 │                        FRAME BUDGET: 16.67ms (60fps) / 8.33ms (120fps)                  │
 │                                                                                          │
 │  JS Execution ──> Style ──> Layout ──> Paint ──> Composite                               │
 │  [────5ms────]   [─2ms─]   [─3ms─]   [─3ms─]   [──2ms──]  = ~15ms (WITHIN BUDGET)     │
 │  [───12ms────]   [─2ms─]   [─8ms─]   [─3ms─]   [──2ms──]  = ~27ms (JANK! DROPPED)     │
 └──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Stage Reference

| Stage | Trigger | Cost | Skip Possible? | How to Skip |
|-------|---------|------|----------------|-------------|
| **Style Calculation** | Class/style changes, DOM mutations | Low-Medium | No | Reduce selector complexity |
| **Layout (Reflow)** | Geometry changes (width, height, position, margin) | **HIGH** | Yes | Use transform instead of top/left |
| **Paint** | Visual changes (color, shadow, background) | Medium | Yes | Promote to compositor layer |
| **Composite** | transform, opacity changes on promoted layers | **LOW** | No (final stage) | Already cheapest |

---

## 2. Critical Rendering Path — Blocking Resources

### The Problem

```
 HTML PARSING TIMELINE
 ─────────────────────────────────────────────────────────────────────
 │ Parse HTML ──▶│ BLOCKED │◀── render-blocking CSS                  │
 │               │ waiting │                                          │
 │               │ for CSS │──▶│ BLOCKED │◀── parser-blocking JS     │
 │               │         │   │ waiting │                            │
 │               │         │   │ for JS  │──▶│ Build Render Tree │   │
 │               │         │   │         │   │ First Paint ────▶ │   │
 ─────────────────────────────────────────────────────────────────────
 Time: 0ms      200ms     500ms         800ms                  1200ms

 WITH OPTIMIZATION:
 ─────────────────────────────────────────────────────────────────────
 │ Parse HTML ─▶│ Critical CSS inline │──▶│ First Paint! │           │
 │              │ (no network wait)   │   │ at 300ms     │           │
 │  async JS ──────────────────────────────────▶│ Interactive │      │
 │  defer JS ──────────────────────────────────────▶│ Full App │     │
 ─────────────────────────────────────────────────────────────────────
 Time: 0ms     100ms                     300ms       800ms    1000ms
```

### Resource Loading Directives — MUST Use Correctly

```html
<!-- === CRITICAL: Inline above-the-fold CSS === -->
<head>
  <!-- MUST: Inline critical CSS to avoid render-blocking -->
  <style>
    /* Only above-the-fold styles — extracted by critters/critical */
    :root { --bg: #fff; --text: #111; }
    body { margin: 0; font-family: system-ui, sans-serif; color: var(--text); }
    .hero { min-height: 100vh; display: grid; place-items: center; }
    .nav { position: sticky; top: 0; height: 64px; }
  </style>

  <!-- MUST: Load full CSS asynchronously -->
  <link rel="preload" href="/css/main.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/css/main.css"></noscript>

  <!-- MUST: Preconnect to critical origins -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>

  <!-- MUST: Preload critical resources -->
  <link rel="preload" href="/fonts/inter-var.woff2" as="font"
        type="font/woff2" crossorigin>
  <link rel="preload" href="/images/hero.webp" as="image"
        fetchpriority="high">

  <!-- MUST: DNS-prefetch for non-critical third-party origins -->
  <link rel="dns-prefetch" href="https://analytics.example.com">

  <!-- NEVER: Synchronous JS in <head> without defer/async -->
  <!-- ❌ <script src="/js/app.js"></script>  BLOCKS PARSING -->

  <!-- MUST: Use defer for app JS, async for independent scripts -->
  <script src="/js/app.js" defer></script>
  <script src="/js/analytics.js" async></script>
</head>
```

### Script Loading Strategy Table

| Attribute | Parse Blocking? | Execution Order | When to Use |
|-----------|----------------|-----------------|-------------|
| `<script>` (none) | **YES — BLOCKS** | In document order | NEVER in production |
| `<script async>` | No | As soon as downloaded (any order) | Analytics, ads, independent scripts |
| `<script defer>` | No | After HTML parsed, in document order | Application code, modules |
| `<script type="module">` | No (deferred by default) | After HTML parsed, in order | ES modules |
| `<link rel="modulepreload">` | No | Preloads module + dependencies | Critical ES modules |

---

## 3. DOM and CSSOM Construction

### Measuring DOM Construction

```typescript
// === MUST: Measure DOM construction with PerformanceObserver ===
const domObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // Navigation timing gives DOM construction milestones
    if (entry.entryType === 'navigation') {
      const navEntry = entry as PerformanceNavigationTiming;
      console.table({
        'DNS Lookup': `${navEntry.domainLookupEnd - navEntry.domainLookupStart}ms`,
        'TCP Connect': `${navEntry.connectEnd - navEntry.connectStart}ms`,
        'TTFB': `${navEntry.responseStart - navEntry.requestStart}ms`,
        'DOM Interactive': `${navEntry.domInteractive - navEntry.responseEnd}ms`,
        'DOM Content Loaded': `${navEntry.domContentLoadedEventEnd - navEntry.responseEnd}ms`,
        'DOM Complete': `${navEntry.domComplete - navEntry.responseEnd}ms`,
      });
    }
  }
});
domObserver.observe({ type: 'navigation', buffered: true });
```

### DOM Size Enforcement

```typescript
// === MUST: Audit DOM size — budget is <1500 nodes ===
function auditDOMSize(): {
  total: number;
  maxDepth: number;
  maxChildren: number;
  violations: string[];
} {
  const body = document.body;
  const allNodes = body.querySelectorAll('*');
  const total = allNodes.length;

  let maxDepth = 0;
  let maxChildren = 0;
  const violations: string[] = [];

  // MUST: Walk the tree to find depth and width violations
  function walk(node: Element, depth: number): void {
    if (depth > maxDepth) maxDepth = depth;
    if (node.children.length > maxChildren) {
      maxChildren = node.children.length;
    }

    // Flag violations
    if (node.children.length > 60) {
      violations.push(
        `VIOLATION: ${node.tagName}.${node.className} has ${node.children.length} children. ` +
        `MUST virtualize with react-window or @tanstack/virtual.`
      );
    }

    for (const child of Array.from(node.children)) {
      walk(child, depth + 1);
    }
  }

  walk(body, 0);

  // Enforcement thresholds (from Lighthouse)
  if (total > 1500) {
    violations.push(
      `VIOLATION: DOM has ${total} nodes (budget: 1500). ` +
      `MUST reduce with virtualization, content-visibility, or lazy loading.`
    );
  }
  if (maxDepth > 32) {
    violations.push(
      `VIOLATION: DOM depth is ${maxDepth} (budget: 32). ` +
      `MUST flatten component hierarchy.`
    );
  }

  return { total, maxDepth, maxChildren, violations };
}
```

---

## 4. Layout (Reflow) — The Most Expensive Stage

### What Triggers Layout

```
 LAYOUT-TRIGGERING PROPERTIES (reading OR writing these forces synchronous layout):

 ┌─────────────────────────────────────────────────────────────────────┐
 │ GEOMETRY READS (force layout if DOM is dirty):                      │
 │   element.offsetTop/Left/Width/Height                               │
 │   element.scrollTop/Left/Width/Height                               │
 │   element.clientTop/Left/Width/Height                               │
 │   element.getBoundingClientRect()                                   │
 │   element.getComputedStyle()                                        │
 │   window.innerWidth/innerHeight                                     │
 │   window.scrollX/scrollY                                            │
 │   element.focus() (triggers layout to compute scroll position)      │
 │   element.scrollIntoView()                                          │
 └─────────────────────────────────────────────────────────────────────┘

 GEOMETRY WRITES (invalidate layout, require recalc on next read):
 ┌─────────────────────────────────────────────────────────────────────┐
 │   element.style.width/height/margin/padding/border                  │
 │   element.style.top/left/right/bottom                               │
 │   element.style.position/display/float                              │
 │   element.style.fontSize/fontFamily                                 │
 │   element.className = '...'                                         │
 │   element.innerHTML = '...'                                         │
 │   element.appendChild() / removeChild() / insertBefore()            │
 │   element.style.cssText = '...'                                     │
 └─────────────────────────────────────────────────────────────────────┘
```

### Layout Thrashing — The #1 Performance Killer

```typescript
// ================================================================
// ANTI-PATTERN: Layout Thrashing (forced synchronous layout)
// Symptom: Purple bars in DevTools Performance panel, janky scroll
// ================================================================

// ❌ NEVER: Read-write-read-write loop (N forced layouts!)
function thrashingExample(items: HTMLElement[]): void {
  // Each iteration: WRITE invalidates layout, READ forces recalculation
  for (const item of items) {
    // READ — forces layout because previous WRITE dirtied it
    const height = item.offsetHeight;
    // WRITE — invalidates layout for next iteration
    item.style.height = `${height + 10}px`;
  }
  // Result: N forced layouts instead of 1. On 1000 items = catastrophic.
}

// ✅ MUST: Batch reads, then batch writes (1 layout total)
function batchedExample(items: HTMLElement[]): void {
  // Phase 1: READ all values (single layout calculation)
  const heights = items.map((item) => item.offsetHeight);

  // Phase 2: WRITE all values (single layout invalidation)
  items.forEach((item, i) => {
    item.style.height = `${heights[i] + 10}px`;
  });
  // Result: 1 layout read + 1 layout invalidation = 2 operations total
}

// ✅ BEST: Use requestAnimationFrame to separate read/write frames
function rafBatchedExample(items: HTMLElement[]): void {
  // Read phase (current frame)
  const heights = items.map((item) => item.offsetHeight);

  // Write phase (next frame — browser has already done layout)
  requestAnimationFrame(() => {
    items.forEach((item, i) => {
      item.style.height = `${heights[i] + 10}px`;
    });
  });
}
```

### FastDOM Pattern — Production Layout Thrashing Prevention

```typescript
// === MUST: Use a read/write scheduler in any animation-heavy app ===

class DOMScheduler {
  private reads: Array<() => void> = [];
  private writes: Array<() => void> = [];
  private scheduled = false;

  measure(fn: () => void): void {
    this.reads.push(fn);
    this.scheduleFlush();
  }

  mutate(fn: () => void): void {
    this.writes.push(fn);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => this.flush());
  }

  private flush(): void {
    // MUST: Execute ALL reads before ANY writes
    const reads = this.reads.splice(0);
    const writes = this.writes.splice(0);

    // Read phase — single forced layout at most
    for (const read of reads) read();

    // Write phase — batched DOM mutations
    for (const write of writes) write();

    this.scheduled = false;

    // If reads/writes were scheduled during flush, run again
    if (this.reads.length || this.writes.length) {
      this.scheduleFlush();
    }
  }
}

// Usage in React:
const scheduler = new DOMScheduler();

function AnimatedList({ items }: { items: Item[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const children = Array.from(containerRef.current.children) as HTMLElement[];

    // MUST: Separate reads and writes through scheduler
    let heights: number[] = [];

    scheduler.measure(() => {
      heights = children.map((child) => child.offsetHeight);
    });

    scheduler.mutate(() => {
      children.forEach((child, i) => {
        child.style.transform = `translateY(${heights[i]}px)`;
      });
    });
  }, [items]);

  return <div ref={containerRef}>{/* ... */}</div>;
}
```

---

## 5. Paint and Compositing — GPU Acceleration

### Layer Promotion Rules

```
 COMPOSITOR-ONLY PROPERTIES (skip layout AND paint):
 ┌─────────────────────────────────────────────────────────────────┐
 │  transform        → translateX/Y/Z, scale, rotate, matrix      │
 │  opacity           → 0 to 1 transitions                        │
 │  filter            → blur, brightness (GPU-accelerated)         │
 │  backdrop-filter   → blur, saturate on backdrop                 │
 │  will-change       → Hints browser to promote to own layer      │
 └─────────────────────────────────────────────────────────────────┘

 ALL OTHER visual changes trigger PAINT (then composite):
 ┌─────────────────────────────────────────────────────────────────┐
 │  color, background-color, background-image                      │
 │  border-color, border-radius                                    │
 │  box-shadow, text-shadow                                        │
 │  outline                                                        │
 │  visibility (paint-only, no layout)                             │
 └─────────────────────────────────────────────────────────────────┘
```

### CSS Containment (`contain` property)

```css
/* === MUST: Use `contain` to isolate expensive subtrees === */

/* contain: layout — element's internal layout does NOT affect outside */
/* contain: paint — element's rendering is clipped, no overflow paint */
/* contain: size — element can be sized without inspecting children */
/* contain: style — counters/quotes scoped to this subtree */

/* MOST COMMON: contain: content (= layout + paint) */
.card {
  contain: content;
  /* Browser can skip layout/paint of this subtree when
     elements OUTSIDE it change. Huge win for lists. */
}

/* MOST AGGRESSIVE: contain: strict (= size + layout + paint + style) */
/* MUST set explicit width/height when using size containment */
.widget-container {
  contain: strict;
  width: 300px;
  height: 200px;
  /* Browser treats this as a completely independent formatting context.
     Internal changes NEVER trigger layout/paint outside this box. */
}

/* For scrollable containers with many items: */
.virtual-list-item {
  contain: layout style;
  /* Each item's layout is independent. Adding/removing items
     only recalculates the affected item, not siblings. */
}

/* === content-visibility: auto — THE most impactful optimization === */
/* MUST use for any off-screen content in long pages/feeds */
.feed-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
  /*
     Browser SKIPS rendering (style, layout, paint) for items
     outside the viewport. On a feed with 200 items, this can
     reduce initial rendering work by 90%+.

     contain-intrinsic-size provides estimated height so scrollbar
     remains stable before items are rendered.
  */
}

/* For sections guaranteed to be initially off-screen: */
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;
}

/* NEVER use content-visibility: hidden for SEO-critical content.
   Unlike display:none, content IS in the DOM and accessible to
   screen readers, but it IS skipped during rendering. Search
   engines MAY skip content-visibility: hidden content. */
```

### `will-change` — Use Surgically

```css
/* === will-change: Precise Rules === */

/* ❌ NEVER: Apply will-change to everything */
* { will-change: transform; }
/* Creates a compositor layer for EVERY element.
   Consumes massive GPU memory. CAUSES jank, not fixes it. */

/* ❌ NEVER: Leave will-change on permanently */
.card { will-change: transform; }
/* The element ALWAYS consumes GPU memory even when not animating. */

/* ❌ NEVER: Apply will-change in the same frame as animation start */
.card:hover {
  will-change: transform;    /* Too late — browser can't pre-optimize */
  transform: scale(1.05);
}

/* ✅ MUST: Apply will-change BEFORE the animation, remove AFTER */
.card-container:hover .card {
  will-change: transform;     /* Applied on parent hover = before animation */
}
.card-container:hover .card:active {
  transform: scale(0.98);     /* Animation happens with layer already promoted */
}

/* ✅ BEST: Apply/remove will-change via JavaScript */
```

```typescript
// === MUST: Manage will-change lifecycle in JS ===
function optimizedAnimation(element: HTMLElement): void {
  // Pre-animation: promote to compositor layer
  element.style.willChange = 'transform';

  // Wait one frame for the browser to create the layer
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Start animation
      element.style.transform = 'translateX(200px)';
    });
  });

  // Post-animation: release GPU memory
  element.addEventListener('transitionend', () => {
    element.style.willChange = 'auto';
  }, { once: true });
}

// === React hook for will-change lifecycle ===
function useWillChange(
  ref: React.RefObject<HTMLElement>,
  property: string,
  active: boolean
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (active) {
      el.style.willChange = property;
    }

    return () => {
      // MUST: Clean up will-change when animation is done or component unmounts
      if (el) el.style.willChange = 'auto';
    };
  }, [ref, property, active]);
}
```

---

## 6. requestAnimationFrame vs requestIdleCallback

```
 FRAME LIFECYCLE:
 ┌──────────────────────────────────────────────────────────────────────┐
 │  0ms                                                        16.67ms │
 │  │                                                              │   │
 │  ├── Input Events (click, scroll, keypress)                     │   │
 │  ├── requestAnimationFrame callbacks                            │   │
 │  ├── Style Calculation                                          │   │
 │  ├── Layout                                                     │   │
 │  ├── Paint                                                      │   │
 │  ├── Composite                                                  │   │
 │  │                                                              │   │
 │  │   ┌──── IDLE TIME (if frame finishes early) ────┐           │   │
 │  │   │  requestIdleCallback runs HERE              │           │   │
 │  │   │  (only if time remains before next frame)   │           │   │
 │  │   └─────────────────────────────────────────────┘           │   │
 │  │                                                              │   │
 └──────────────────────────────────────────────────────────────────────┘
```

### Comparison Table

| Feature | `requestAnimationFrame` | `requestIdleCallback` |
|---------|------------------------|-----------------------|
| **When it fires** | Before next paint | During idle periods |
| **Frequency** | Every frame (~60/sec) | When browser is idle |
| **Time budget** | Full frame (16.67ms) | Remaining idle time (often <5ms) |
| **Use for** | Visual updates, animations | Non-urgent work, analytics, prefetching |
| **Cancellation** | `cancelAnimationFrame(id)` | `cancelIdleCallback(id)` |
| **Browser support** | Universal | No Safari (use polyfill) |
| **Priority** | High (before paint) | Low (idle only) |

### Production Patterns

```typescript
// === requestAnimationFrame: Visual updates ONLY ===

// ✅ MUST: Use rAF for scroll-linked animations
function smoothScrollHeader(header: HTMLElement): () => void {
  let ticking = false;

  function onScroll(): void {
    if (ticking) return; // MUST: Debounce to one rAF per frame
    ticking = true;

    requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      // MUST: Use transform, NOT top/margin (compositor-only)
      header.style.transform = `translateY(${Math.min(0, -scrollY)}px)`;
      header.style.opacity = `${Math.max(0, 1 - scrollY / 200)}`;
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

// === requestIdleCallback: Deferred non-critical work ===

// ✅ MUST: Use rIC for analytics, telemetry, prefetching
function sendAnalytics(event: AnalyticsEvent): void {
  // NEVER block the main thread for analytics
  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      (deadline) => {
        // MUST: Check remaining time before doing work
        if (deadline.timeRemaining() > 5) {
          navigator.sendBeacon('/api/analytics', JSON.stringify(event));
        } else {
          // Not enough time — reschedule
          sendAnalytics(event);
        }
      },
      { timeout: 2000 } // MUST: Set timeout to guarantee eventual execution
    );
  } else {
    // Safari fallback
    setTimeout(() => {
      navigator.sendBeacon('/api/analytics', JSON.stringify(event));
    }, 0);
  }
}

// ✅ MUST: Use rIC for progressive hydration / lazy initialization
function progressiveInit(tasks: Array<() => void>): void {
  const queue = [...tasks];

  function processNext(deadline: IdleDeadline): void {
    // Process tasks while we have idle time
    while (queue.length > 0 && deadline.timeRemaining() > 1) {
      const task = queue.shift()!;
      task();
    }

    // More tasks? Schedule another idle callback
    if (queue.length > 0) {
      requestIdleCallback(processNext, { timeout: 5000 });
    }
  }

  requestIdleCallback(processNext, { timeout: 5000 });
}

// Usage: Initialize non-critical features progressively
progressiveInit([
  () => initTooltips(),
  () => initLazyImages(),
  () => prefetchNextPageData(),
  () => initServiceWorker(),
  () => loadChatWidget(),
]);
```

---

## 7. Performance Measurement — Long Tasks API and PerformanceObserver

### Complete Performance Monitoring Setup

```typescript
// === MUST: Set up PerformanceObserver for all critical metrics ===

interface PerformanceMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number;
  inp: number | null;
  ttfb: number | null;
  fcp: number | null;
  longTasks: Array<{ duration: number; startTime: number; attribution: string }>;
}

const metrics: PerformanceMetrics = {
  lcp: null,
  fid: null,
  cls: 0,
  inp: null,
  ttfb: null,
  fcp: null,
  longTasks: [],
};

// --- Largest Contentful Paint (LCP) ---
// MUST: Target < 2.5s
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
    renderTime: number;
    loadTime: number;
    element: Element;
  };
  metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
  console.log(`LCP: ${metrics.lcp}ms`, lastEntry.element);
});
lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

// --- First Input Delay (FID) ---
// MUST: Target < 100ms
const fidObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as PerformanceEventTiming[]) {
    metrics.fid = entry.processingStart - entry.startTime;
    console.log(`FID: ${metrics.fid}ms`);
  }
});
fidObserver.observe({ type: 'first-input', buffered: true });

// --- Interaction to Next Paint (INP) ---
// MUST: Target < 200ms (replaced FID as Core Web Vital in March 2024)
const interactions: number[] = [];
const inpObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as PerformanceEventTiming[]) {
    if (entry.interactionId) {
      const duration = entry.duration;
      interactions.push(duration);
      // INP = 98th percentile of interactions
      interactions.sort((a, b) => a - b);
      const idx = Math.floor(interactions.length * 0.98);
      metrics.inp = interactions[Math.min(idx, interactions.length - 1)];
    }
  }
});
inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 });

// --- Cumulative Layout Shift (CLS) ---
// MUST: Target < 0.1
let clsValue = 0;
let sessionValue = 0;
let sessionEntries: PerformanceEntry[] = [];
const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as Array<
    PerformanceEntry & { hadRecentInput: boolean; value: number }
  >) {
    if (!entry.hadRecentInput) {
      const firstSessionEntry = sessionEntries[0];
      const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

      // Start new session window if gap > 1s or window > 5s
      if (
        sessionValue &&
        (entry.startTime - lastSessionEntry!.startTime > 1000 ||
          entry.startTime - firstSessionEntry!.startTime > 5000)
      ) {
        if (sessionValue > clsValue) clsValue = sessionValue;
        sessionEntries = [];
        sessionValue = 0;
      }

      sessionEntries.push(entry);
      sessionValue += entry.value;
      metrics.cls = Math.max(clsValue, sessionValue);
    }
  }
});
clsObserver.observe({ type: 'layout-shift', buffered: true });

// --- Long Tasks ---
// MUST: Monitor tasks > 50ms (they block the main thread)
const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const attribution =
      (entry as any).attribution?.[0]?.containerSrc ||
      (entry as any).attribution?.[0]?.containerName ||
      'unknown';

    metrics.longTasks.push({
      duration: entry.duration,
      startTime: entry.startTime,
      attribution,
    });

    // MUST: Alert on tasks > 100ms (severe jank risk)
    if (entry.duration > 100) {
      console.warn(
        `LONG TASK: ${entry.duration}ms from ${attribution}. ` +
        `MUST break this work into chunks < 50ms using scheduler.yield() or rIC.`
      );
    }
  }
});
longTaskObserver.observe({ type: 'longtask', buffered: true });

// --- Report metrics on page hide ---
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // MUST: Use sendBeacon — fetch may be cancelled on page hide
    navigator.sendBeacon('/api/vitals', JSON.stringify(metrics));
  }
});
```

### Long Task Breaking Pattern

```typescript
// === MUST: Break long tasks using scheduler.yield() or chunking ===

// Modern approach: scheduler.yield() (Chrome 115+)
async function processLargeArray<T>(
  items: T[],
  process: (item: T) => void
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    process(items[i]);

    // Yield to main thread every 5ms to stay under 50ms task budget
    if (i % 100 === 0) {
      if ('scheduler' in globalThis && 'yield' in (globalThis as any).scheduler) {
        await (globalThis as any).scheduler.yield();
      } else {
        // Fallback: yield via setTimeout
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }
}

// React pattern: useDeferredValue for expensive renders
import { useDeferredValue, useMemo } from 'react';

function SearchResults({ query }: { query: string }) {
  // MUST: Defer expensive filtering to avoid blocking input
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  const filteredResults = useMemo(
    () => allResults.filter((r) => r.name.includes(deferredQuery)),
    [deferredQuery]
  );

  return (
    <div style={{ opacity: isStale ? 0.7 : 1, transition: 'opacity 0.2s' }}>
      {filteredResults.map((result) => (
        <ResultCard key={result.id} result={result} />
      ))}
    </div>
  );
}
```

---

## 8. Compositor-Only Animations — The Gold Standard

```typescript
// === MUST: Use FLIP technique for layout animations ===
// FLIP = First, Last, Invert, Play

function flipAnimate(element: HTMLElement, newState: () => void): void {
  // FIRST: Record current position
  const first = element.getBoundingClientRect();

  // LAST: Apply the change (causes layout)
  newState();

  // Read the new position
  const last = element.getBoundingClientRect();

  // INVERT: Calculate the delta and apply inverse transform
  const deltaX = first.left - last.left;
  const deltaY = first.top - last.top;
  const deltaW = first.width / last.width;
  const deltaH = first.height / last.height;

  // Apply the inverse transform (element appears in FIRST position)
  element.style.transform =
    `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
  element.style.transformOrigin = 'top left';

  // PLAY: Animate from inverted position to final position
  requestAnimationFrame(() => {
    element.style.transition = 'transform 0.3s ease-out';
    element.style.transform = 'none';

    element.addEventListener('transitionend', () => {
      element.style.transition = '';
      element.style.transformOrigin = '';
    }, { once: true });
  });
}

// === React FLIP hook ===
function useFlip<T>(deps: T[]): React.RefCallback<HTMLElement> {
  const positionRef = useRef<DOMRect | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;

    if (positionRef.current) {
      const first = positionRef.current;
      const last = node.getBoundingClientRect();
      const deltaX = first.left - last.left;
      const deltaY = first.top - last.top;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        // MUST: Use Web Animations API for compositor-only animation
        node.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'none' },
          ],
          { duration: 300, easing: 'ease-out', fill: 'none' }
        );
      }
    }

    positionRef.current = node.getBoundingClientRect();
  }, deps);

  return ref;
}
```

---

## 9. CSS Performance Properties — Quick Reference

### Animation Performance Tiers

| Tier | Properties | Pipeline Cost | Use For |
|------|-----------|---------------|---------|
| **S — Compositor** | `transform`, `opacity` | Composite only | ALL animations |
| **A — Paint only** | `color`, `background-color`, `box-shadow`, `visibility` | Paint + Composite | Color transitions |
| **B — Layout** | `width`, `height`, `margin`, `padding`, `border-width` | Layout + Paint + Composite | AVOID for animation |
| **F — Full** | `font-size`, `position: static→fixed`, `display` | Full pipeline | NEVER animate |

### CSS Optimization Rules

```css
/* === MUST: Prefer transform over position for movement === */

/* ❌ NEVER animate top/left — triggers layout every frame */
.slide-in-bad {
  transition: left 0.3s ease;
  position: absolute;
  left: -100%;
}
.slide-in-bad.active {
  left: 0;
}

/* ✅ MUST: Use transform — compositor only, 0 layout cost */
.slide-in-good {
  transition: transform 0.3s ease;
  transform: translateX(-100%);
}
.slide-in-good.active {
  transform: translateX(0);
}

/* === MUST: Use contain on scroll containers and lists === */
.scroll-container {
  contain: strict;
  overflow-y: auto;
  height: 100vh;
}

.list-item {
  contain: content;
  /* Each item is an independent formatting context.
     Adding/removing items recalculates only affected items. */
}

/* === MUST: Use content-visibility for long lists/feeds === */
.feed-post {
  content-visibility: auto;
  contain-intrinsic-size: auto 400px; /* Estimated height */
}

/* This alone can reduce rendering time of 1000-item feeds
   from ~5000ms to ~200ms on initial load. */
```

---

## 10. Anti-Patterns — Symptoms and Fixes

### Anti-Pattern Table

| Anti-Pattern | Symptom | Root Cause | Fix |
|---|---|---|---|
| Layout thrashing | Purple "Recalculate Style" + "Layout" bars in DevTools, 200ms+ frames | Read-write interleaving of layout properties | Batch reads then writes, use FastDOM scheduler |
| `will-change: transform` on everything | High GPU memory, blank/black elements, layer explosion | Every element promoted to own compositor layer | Apply only to actively animating elements, remove after |
| Animating `width`/`height` | Janky resize animations, dropped frames | Layout triggered every frame | Use `transform: scale()` instead |
| Synchronous `<script>` in `<head>` | White screen for 2+ seconds, blocked FCP | Parser stops to download + execute JS | Add `defer` or `async`, move to before `</body>` |
| Render-blocking CSS for below-fold | High LCP, delayed FCP | Browser waits for ALL CSS before first paint | Inline critical CSS, async-load rest |
| No `contain` on repeated items | Layout of one item triggers layout of entire page | No layout containment boundaries | Add `contain: content` to cards/list items |
| `content-visibility` without `contain-intrinsic-size` | Scrollbar jumping, scroll position instability | Browser does not know size of hidden content | ALWAYS pair with `contain-intrinsic-size: auto <estimate>` |
| `getComputedStyle` in loops | 500ms+ Long Tasks, INP > 500ms | Forces style recalculation on every call | Cache result outside loop, batch reads |
| No `fetchpriority` on hero image | LCP > 4s even on fast networks | Browser discovers hero image late, loads at default priority | Add `fetchpriority="high"` and `<link rel="preload">` |
| `offsetHeight` inside `useEffect` on every render | Constant layout thrashing on React re-renders | Reading layout property forces synchronous layout | Use ResizeObserver instead of manual measurement |

---

## 11. Enforcement Checklist

```
CRITICAL RENDERING PATH:
  [ ] ALL CSS loaded with <link rel="preload" as="style"> or inlined (critical CSS)
  [ ] NO synchronous <script> tags in <head> without defer/async
  [ ] Hero image has fetchpriority="high" and <link rel="preload">
  [ ] Third-party origins use <link rel="preconnect"> or <link rel="dns-prefetch">
  [ ] Web fonts preloaded with <link rel="preload" as="font" crossorigin>
  [ ] font-display: swap or font-display: optional on all @font-face

LAYOUT PERFORMANCE:
  [ ] NO read-write-read-write patterns on layout properties
  [ ] FastDOM scheduler or read/write batching in animation code
  [ ] ResizeObserver used instead of polling offsetHeight/offsetWidth
  [ ] IntersectionObserver used instead of scroll + getBoundingClientRect
  [ ] DOM node count < 1500 (audited with Lighthouse)
  [ ] DOM depth < 32 levels
  [ ] Long lists use virtualization (@tanstack/virtual, react-window)

PAINT AND COMPOSITING:
  [ ] ALL animations use transform/opacity ONLY (compositor-only)
  [ ] will-change applied ONLY during active animations, removed after
  [ ] will-change NEVER applied globally via * selector
  [ ] contain: content on all repeated items (cards, list items, rows)
  [ ] content-visibility: auto on all below-fold sections
  [ ] contain-intrinsic-size paired with every content-visibility: auto

MEASUREMENT:
  [ ] PerformanceObserver tracks LCP, CLS, INP, FID, Long Tasks
  [ ] Metrics reported via navigator.sendBeacon on visibilitychange
  [ ] Long Task observer alerts on tasks > 100ms
  [ ] Performance budget enforced: LCP < 2.5s, INP < 200ms, CLS < 0.1
  [ ] DevTools Performance panel used for frame-by-frame analysis

JAVASCRIPT EXECUTION:
  [ ] Heavy computation uses Web Workers (NEVER on main thread)
  [ ] scheduler.yield() or chunking used for loops > 50ms
  [ ] requestAnimationFrame for visual updates only
  [ ] requestIdleCallback for analytics, prefetching, non-critical init
  [ ] useDeferredValue for expensive React renders
  [ ] Third-party scripts loaded with async and wrapped in requestIdleCallback
```

---

## 12. DevTools Performance Audit Workflow

```
 STEP-BY-STEP PERFORMANCE DIAGNOSIS:

 1. OPEN DevTools → Performance tab → Record interaction
 2. IDENTIFY the bottleneck in the flame chart:

    Yellow bars = JavaScript execution
    ├── Long yellow bars? → Break into chunks, use Web Worker
    ├── Repeated short yellow bars? → Possible layout thrashing
    └── Check "Bottom-Up" tab for hotspot functions

    Purple bars = Layout/Reflow
    ├── "Layout Forced" warnings? → Fix read-write interleaving
    ├── Layout after style recalc? → Batch style mutations
    └── Layout width = full viewport? → Add CSS containment

    Green bars = Paint
    ├── Large paint areas? → Use Layers panel to check compositing
    ├── Frequent repaints? → Promote to compositor layer
    └── Enable "Paint Flashing" to visualize repainted regions

    Compositor = Gray/transparent
    └── This is the goal. transform + opacity animations show here only.

 3. USE the Rendering panel:
    ├── Paint Flashing (green = repainted regions)
    ├── Layout Shift Regions (blue = CLS causes)
    ├── Layer Borders (orange = compositor layers)
    └── Frame Rendering Stats (FPS meter)
```
