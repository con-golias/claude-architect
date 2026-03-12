# Browser Rendering Pipeline — Complete Specification

> **AI Plugin Directive:** When optimizing frontend performance, diagnosing rendering issues, or making decisions about DOM manipulation strategies, ALWAYS consult this guide. Apply these rendering pipeline rules to prevent layout thrashing, minimize reflows, and achieve 60fps rendering. This guide covers how browsers transform HTML/CSS/JS into pixels on screen.

**Core Rule: The browser rendering pipeline is: Parse → Style → Layout → Paint → Composite. NEVER trigger forced synchronous layout by reading geometry properties after writing styles in the same frame. ALWAYS batch DOM reads before DOM writes. Use `transform` and `opacity` for animations — they skip layout and paint, running only on the compositor thread.**

---

## 1. The Critical Rendering Path

```
                        CRITICAL RENDERING PATH

  HTML Document                          CSS Stylesheets
       │                                      │
       ▼                                      ▼
  ┌──────────┐                         ┌──────────────┐
  │  HTML     │                         │  CSS         │
  │  Parser   │                         │  Parser      │
  └────┬─────┘                         └──────┬───────┘
       │                                      │
       ▼                                      ▼
  ┌──────────┐                         ┌──────────────┐
  │  DOM      │                         │  CSSOM       │
  │  Tree     │                         │  Tree        │
  └────┬─────┘                         └──────┬───────┘
       │                                      │
       └──────────────┬───────────────────────┘
                      │
                      ▼
               ┌─────────────┐
               │  Render     │    ← Combines DOM + CSSOM
               │  Tree       │    ← Excludes display:none
               └──────┬──────┘
                      │
                      ▼
               ┌─────────────┐
               │  Layout     │    ← Calculates geometry (x, y, width, height)
               │  (Reflow)   │    ← EXPENSIVE — avoid triggering repeatedly
               └──────┬──────┘
                      │
                      ▼
               ┌─────────────┐
               │  Paint      │    ← Creates paint records (draw calls)
               │             │    ← Records pixels for each layer
               └──────┬──────┘
                      │
                      ▼
               ┌─────────────┐
               │  Composite  │    ← Combines layers on GPU
               │             │    ← transform/opacity run HERE only
               └─────────────┘
                      │
                      ▼
               ┌─────────────┐
               │  PIXELS     │    ← What the user sees
               │  ON SCREEN  │
               └─────────────┘
```

### Render-Blocking Resources

```
RENDER-BLOCKING RULES:

1. CSS is render-blocking by default
   - Browser WILL NOT render until CSSOM is complete
   - ALWAYS put critical CSS inline in <head>
   - Use media queries to make non-critical CSS non-blocking:
     <link rel="stylesheet" href="print.css" media="print">
     <link rel="stylesheet" href="mobile.css" media="(max-width: 768px)">

2. JavaScript is parser-blocking by default
   - Browser stops HTML parsing when it encounters <script>
   - ALWAYS use async or defer:
     <script src="analytics.js" async></script>   ← Downloads parallel, executes ASAP
     <script src="app.js" defer></script>          ← Downloads parallel, executes after parse
     <script src="app.js" type="module"></script>  ← Deferred by default

3. Fonts are render-blocking
   - Text is invisible until font loads (FOIT) or shows fallback (FOUT)
   - ALWAYS use font-display: swap or optional
   - Preload critical fonts:
     <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>

ASYNC vs DEFER:
  ┌──────────┬────────────────────────────────────┐
  │          │ HTML Parsing                        │
  │  Normal  │ ████████░░░░░░░░████████████████████│
  │  <script>│         ↑ stop  ↑ resume            │
  │          │         ▼ fetch+exec                 │
  ├──────────┼────────────────────────────────────┤
  │  async   │ ████████████████░░░████████████████ │
  │          │        ↓ fetch    ↑                  │
  │          │        ██████████ exec               │
  ├──────────┼────────────────────────────────────┤
  │  defer   │ ████████████████████████████████████│
  │          │        ↓ fetch             ↑ exec   │
  │          │        ██████████████████████        │
  └──────────┴────────────────────────────────────┘
```

---

## 2. Layout (Reflow) — The Most Expensive Operation

### What Triggers Layout

```
PROPERTIES THAT TRIGGER LAYOUT (reflow):

GEOMETRY:
  width, height, min-width, max-width, min-height, max-height
  padding, margin, border-width
  top, right, bottom, left
  display, position, float, clear
  overflow, overflow-x, overflow-y

TEXT:
  font-size, font-weight, font-family, line-height
  text-align, text-overflow, white-space, word-wrap

BOX MODEL:
  box-sizing, flex, flex-basis, flex-grow, flex-shrink
  grid-template-columns, grid-template-rows, gap

READING THESE FORCES LAYOUT (synchronous reflow):
  offsetTop, offsetLeft, offsetWidth, offsetHeight
  scrollTop, scrollLeft, scrollWidth, scrollHeight
  clientTop, clientLeft, clientWidth, clientHeight
  getComputedStyle()
  getBoundingClientRect()
  innerText (forces layout to compute text)
  focus() (may trigger scroll + layout)

RULE: NEVER read these properties between DOM writes.
```

### Layout Thrashing — The #1 Performance Killer

```typescript
// ❌ NEVER: Layout thrashing (read-write-read-write cycle)
function BAD_resizeBoxes(boxes: HTMLElement[]) {
  for (const box of boxes) {
    const width = box.offsetWidth;      // READ → triggers layout
    box.style.width = width * 2 + "px"; // WRITE → invalidates layout
    // Next iteration: READ triggers layout AGAIN
  }
  // Result: N layouts instead of 1. O(n) reflows.
}

// ✅ ALWAYS: Batch reads, then batch writes
function GOOD_resizeBoxes(boxes: HTMLElement[]) {
  // Phase 1: Read ALL values first
  const widths = boxes.map((box) => box.offsetWidth); // 1 layout total

  // Phase 2: Write ALL values
  boxes.forEach((box, i) => {
    box.style.width = widths[i] * 2 + "px"; // Batched writes, 1 layout
  });
}

// ✅ BEST: Use requestAnimationFrame for DOM writes
function BEST_resizeBoxes(boxes: HTMLElement[]) {
  const widths = boxes.map((box) => box.offsetWidth); // Read phase

  requestAnimationFrame(() => {
    boxes.forEach((box, i) => {
      box.style.width = widths[i] * 2 + "px"; // Write phase in rAF
    });
  });
}
```

### FastDOM Pattern (Read-Write Scheduling)

```typescript
// Use fastdom library or implement read/write batching
import fastdom from "fastdom";

// ✅ Scheduled reads and writes — NEVER interleaved
function updateElements(elements: HTMLElement[]) {
  elements.forEach((el) => {
    fastdom.measure(() => {
      const height = el.offsetHeight;  // Batched read
      fastdom.mutate(() => {
        el.style.height = height * 2 + "px";  // Batched write
      });
    });
  });
}

// Manual implementation without library:
class DOMBatcher {
  private reads: (() => void)[] = [];
  private writes: (() => void)[] = [];
  private scheduled = false;

  measure(fn: () => void) {
    this.reads.push(fn);
    this.schedule();
  }

  mutate(fn: () => void) {
    this.writes.push(fn);
    this.schedule();
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      // Execute ALL reads first
      const reads = this.reads.splice(0);
      reads.forEach((fn) => fn());
      // Then ALL writes
      const writes = this.writes.splice(0);
      writes.forEach((fn) => fn());
      this.scheduled = false;
    });
  }
}
```

---

## 3. Paint and Compositing

### CSS Properties by Rendering Cost

```
┌──────────────────┬───────────┬───────────┬────────────┬──────────────────┐
│ Property         │ Layout    │ Paint     │ Composite  │ Cost             │
├──────────────────┼───────────┼───────────┼────────────┼──────────────────┤
│ width, height    │ ✅ YES    │ ✅ YES    │ ✅ YES     │ 🔴 HIGHEST       │
│ margin, padding  │ ✅ YES    │ ✅ YES    │ ✅ YES     │ 🔴 HIGHEST       │
│ top, left        │ ✅ YES    │ ✅ YES    │ ✅ YES     │ 🔴 HIGHEST       │
│ font-size        │ ✅ YES    │ ✅ YES    │ ✅ YES     │ 🔴 HIGHEST       │
│ display          │ ✅ YES    │ ✅ YES    │ ✅ YES     │ 🔴 HIGHEST       │
├──────────────────┼───────────┼───────────┼────────────┼──────────────────┤
│ color            │ ❌ NO     │ ✅ YES    │ ✅ YES     │ 🟡 MEDIUM        │
│ background-color │ ❌ NO     │ ✅ YES    │ ✅ YES     │ 🟡 MEDIUM        │
│ box-shadow       │ ❌ NO     │ ✅ YES    │ ✅ YES     │ 🟡 MEDIUM        │
│ border-radius    │ ❌ NO     │ ✅ YES    │ ✅ YES     │ 🟡 MEDIUM        │
│ visibility       │ ❌ NO     │ ✅ YES    │ ✅ YES     │ 🟡 MEDIUM        │
├──────────────────┼───────────┼───────────┼────────────┼──────────────────┤
│ transform        │ ❌ NO     │ ❌ NO     │ ✅ YES     │ 🟢 CHEAPEST      │
│ opacity          │ ❌ NO     │ ❌ NO     │ ✅ YES     │ 🟢 CHEAPEST      │
│ filter           │ ❌ NO     │ ❌ NO     │ ✅ YES     │ 🟢 CHEAPEST      │
│ will-change      │ ❌ NO     │ ❌ NO     │ ✅ YES     │ 🟢 CHEAPEST      │
└──────────────────┴───────────┴───────────┴────────────┴──────────────────┘

ANIMATION RULE:
  ✅ ALWAYS animate with: transform, opacity, filter
  ❌ NEVER animate with: width, height, top, left, margin, padding

  ✅ Use transform: translateX() instead of left
  ✅ Use transform: scale() instead of width/height
  ✅ Use opacity instead of visibility/display for fade
```

### Compositor Layers and GPU Acceleration

```typescript
// ✅ Promote elements to compositor layer for smooth animations
.animated-element {
  /* Method 1: will-change (RECOMMENDED) */
  will-change: transform;          /* Creates compositor layer */

  /* Method 2: 3D transform hack (older browsers) */
  transform: translateZ(0);        /* Forces GPU layer */

  /* Method 3: Explicit containment */
  contain: layout paint;           /* Isolates element from rest of page */
}

// ⚠️ WARNING: Too many layers = excessive GPU memory
// NEVER apply will-change to more than 10-20 elements simultaneously

// ✅ Add will-change only before animation, remove after
element.addEventListener("mouseenter", () => {
  element.style.willChange = "transform";
});
element.addEventListener("transitionend", () => {
  element.style.willChange = "auto"; // Release GPU memory
});

// ✅ Use CSS containment to isolate rendering
.card {
  contain: layout style paint;  /* Changes inside don't affect outside */
  content-visibility: auto;     /* Skip rendering off-screen content */
  contain-intrinsic-size: 0 500px; /* Placeholder size for content-visibility */
}
```

---

## 4. requestAnimationFrame vs requestIdleCallback

```typescript
// requestAnimationFrame: Run BEFORE next paint (60fps = every 16.67ms)
// Use for: visual updates, animations, DOM mutations

function smoothAnimation(element: HTMLElement) {
  let start: number | null = null;
  const duration = 300;

  function animate(timestamp: number) {
    if (!start) start = timestamp;
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);

    // ✅ Only transform/opacity for smooth animation
    element.style.transform = `translateX(${progress * 200}px)`;
    element.style.opacity = String(1 - progress * 0.5);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}


// requestIdleCallback: Run when browser is IDLE (low-priority work)
// Use for: analytics, prefetching, non-urgent DOM updates

function sendAnalytics(data: Record<string, unknown>) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      (deadline) => {
        // deadline.timeRemaining() tells how much time we have
        if (deadline.timeRemaining() > 5) {
          navigator.sendBeacon("/analytics", JSON.stringify(data));
        }
      },
      { timeout: 2000 } // Force execution after 2s max
    );
  } else {
    // Fallback for Safari (no requestIdleCallback support)
    setTimeout(() => {
      navigator.sendBeacon("/analytics", JSON.stringify(data));
    }, 0);
  }
}


// ✅ Decision:
//   Visual update → requestAnimationFrame
//   Non-visual / deferrable → requestIdleCallback
//   React equivalent → useTransition (low priority), useDeferredValue
//   Microtask → queueMicrotask (before next task, NOT before paint)
```

---

## 5. Performance Measurement APIs

```typescript
// ── PerformanceObserver: Observe real performance metrics ──
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    switch (entry.entryType) {
      case "largest-contentful-paint":
        console.log("LCP:", entry.startTime, "ms");
        break;
      case "layout-shift":
        const lsEntry = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!lsEntry.hadRecentInput) {
          console.log("CLS shift:", lsEntry.value);
        }
        break;
      case "longtask":
        console.log("Long Task:", entry.duration, "ms", entry.name);
        break;
      case "event":
        const eventEntry = entry as PerformanceEntry & { processingStart: number };
        const delay = eventEntry.processingStart - entry.startTime;
        console.log("INP candidate:", delay, "ms");
        break;
    }
  }
});

// Observe all critical metrics
observer.observe({ type: "largest-contentful-paint", buffered: true });
observer.observe({ type: "layout-shift", buffered: true });
observer.observe({ type: "longtask", buffered: true });
observer.observe({ type: "event", buffered: true, durationThreshold: 16 });


// ── Custom Performance Marks ──
performance.mark("component-render-start");
// ... render component ...
performance.mark("component-render-end");
performance.measure(
  "component-render",
  "component-render-start",
  "component-render-end"
);

const [measure] = performance.getEntriesByName("component-render");
console.log(`Component rendered in ${measure.duration.toFixed(2)}ms`);


// ── Navigation Timing ──
window.addEventListener("load", () => {
  const timing = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

  console.log({
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    tcp: timing.connectEnd - timing.connectStart,
    ttfb: timing.responseStart - timing.requestStart,
    download: timing.responseEnd - timing.responseStart,
    domParsing: timing.domInteractive - timing.responseEnd,
    domComplete: timing.domComplete - timing.domInteractive,
    total: timing.loadEventEnd - timing.startTime,
  });
});


// ── Resource Timing (per-resource analysis) ──
const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
const slowResources = resources
  .filter((r) => r.duration > 500)
  .sort((a, b) => b.duration - a.duration)
  .map((r) => ({
    name: r.name.split("/").pop(),
    duration: r.duration.toFixed(0) + "ms",
    size: r.transferSize,
    type: r.initiatorType,
  }));
console.table(slowResources);
```

---

## 6. CSS Containment and content-visibility

```css
/* ── CSS Containment: Isolate elements from the rest of the page ── */

/* contain: layout — Element's layout doesn't affect other elements */
/* contain: paint — Element's paint doesn't bleed outside bounds */
/* contain: size — Element's size is independent (must set explicit size) */
/* contain: style — Counters/quotes don't escape this subtree */

/* RECOMMENDED combinations: */
.card {
  contain: layout style paint;  /* Most common: isolate completely */
}

.sidebar {
  contain: layout paint;        /* Layout + paint isolation */
}

.widget {
  contain: strict;              /* = layout + style + paint + size */
  width: 300px;                 /* MUST set explicit size with contain: size */
  height: 200px;
}


/* ── content-visibility: Skip rendering off-screen content ── */

/* MASSIVE performance gain for long pages */
.article-section {
  content-visibility: auto;           /* Render only when near viewport */
  contain-intrinsic-size: auto 500px; /* Placeholder size prevents layout shift */
}

/* content-visibility values:
   visible  — default, always rendered
   hidden   — never rendered (like display:none but preserves state)
   auto     — rendered when near viewport, skipped when far away
*/

/* Performance impact of content-visibility: auto
   ┌──────────────────────────┬────────────────┬────────────────┐
   │ Page with 100 articles   │ Without        │ With           │
   ├──────────────────────────┼────────────────┼────────────────┤
   │ Initial render time      │ ~800ms         │ ~100ms         │
   │ DOM nodes processed      │ 10,000+        │ ~1,000         │
   │ Memory usage             │ ~50MB          │ ~15MB          │
   │ Scroll jank              │ Likely         │ Eliminated     │
   └──────────────────────────┴────────────────┴────────────────┘
*/
```

---

## 7. Optimizing the Critical Rendering Path

```html
<!-- ── Resource Hints: Tell the browser what to do next ── -->
<head>
  <!-- DNS prefetch: Resolve DNS for third-party domains -->
  <link rel="dns-prefetch" href="https://api.example.com">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">

  <!-- Preconnect: DNS + TCP + TLS for critical third-party -->
  <link rel="preconnect" href="https://api.example.com" crossorigin>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Preload: Fetch critical resources early (highest priority) -->
  <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/critical.css" as="style">
  <link rel="preload" href="/hero-image.webp" as="image" fetchpriority="high">

  <!-- Prefetch: Fetch resources for NEXT navigation (low priority) -->
  <link rel="prefetch" href="/dashboard" as="document">
  <link rel="prefetch" href="/api/user" as="fetch">

  <!-- Prerender: Speculatively render entire page (Chrome 109+) -->
  <script type="speculationrules">
  {
    "prerender": [
      { "where": { "href_matches": "/dashboard/*" }, "eagerness": "moderate" }
    ],
    "prefetch": [
      { "where": { "href_matches": "/blog/*" }, "eagerness": "conservative" }
    ]
  }
  </script>

  <!-- Critical CSS inline -->
  <style>
    /* Only above-the-fold styles — keep under 14KB */
    :root { --font-sans: 'Inter', system-ui, sans-serif; }
    body { margin: 0; font-family: var(--font-sans); }
    .hero { min-height: 100vh; display: grid; place-items: center; }
  </style>

  <!-- Non-critical CSS loaded asynchronously -->
  <link rel="preload" href="/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/styles.css"></noscript>

  <!-- Application JS — deferred -->
  <script src="/app.js" type="module"></script>
</head>
```

### fetchpriority Attribute

```html
<!-- Control fetch priority for critical resources -->
<img src="/hero.webp" fetchpriority="high" alt="Hero">     <!-- LCP image: high -->
<img src="/avatar.webp" fetchpriority="low" alt="Avatar">  <!-- Below fold: low -->

<script src="/critical.js" fetchpriority="high"></script>   <!-- Critical JS -->
<script src="/analytics.js" fetchpriority="low"></script>   <!-- Non-critical JS -->

<link rel="stylesheet" href="/above-fold.css" fetchpriority="high">
<link rel="stylesheet" href="/below-fold.css" fetchpriority="low">

<!-- In React/Next.js: -->
<!-- <Image src="/hero.webp" priority /> automatically sets fetchpriority="high" -->
```

---

## 8. Virtual DOM vs Direct DOM vs Compiled Reactivity

```
┌─────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Approach            │ Virtual DOM        │ Direct DOM         │ Compiled           │
│                     │ (React, Vue)       │ (jQuery, vanilla)  │ (Svelte, SolidJS)  │
├─────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Update mechanism    │ Diff vDOM, patch   │ Manual DOM API     │ Compile-time       │
│                     │ real DOM           │ calls              │ granular updates   │
│ Bundle size         │ ~40-80KB runtime   │ 0KB (native)       │ ~2-5KB runtime     │
│ Initial render      │ Fast (batched)     │ Fastest (direct)   │ Fast (no diff)     │
│ Update performance  │ Good (O(n) diff)   │ Depends on dev     │ Best (O(1) direct) │
│ Memory              │ Higher (2x tree)   │ Lowest             │ Low                │
│ DX (ergonomics)     │ Excellent          │ Poor at scale      │ Excellent          │
│ Ecosystem           │ Largest (React)    │ N/A                │ Growing            │
│ Best for            │ Complex UIs        │ Simple widgets     │ Performance-first  │
├─────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ React 19            │ Fiber + compiler   │                    │                    │
│ Vue 3               │ Proxy + compiler   │                    │                    │
│ Svelte 5            │                    │                    │ $state runes       │
│ SolidJS             │                    │                    │ Signals + JSX      │
│ Angular (signals)   │ Hybrid (moving to  │                    │ signals)           │
└─────────────────────┴────────────────────┴────────────────────┴────────────────────┘

RULE: DO NOT choose a framework based on rendering approach alone.
      Choose based on: team expertise, ecosystem, hiring pool, project needs.
      All modern frameworks are "fast enough" for 99% of applications.
```

---

## 9. React Concurrent Rendering and Scheduling

```typescript
// React's rendering pipeline adds a SCHEDULING layer on top of browser rendering

// ── Priority Levels in React 19 ──
// 1. Discrete (click, keydown)     → Synchronous, immediate
// 2. Continuous (scroll, mousemove) → Higher priority, can interrupt
// 3. Default (setState)            → Normal priority
// 4. Transition (startTransition)  → Low priority, interruptible
// 5. Idle (useDeferredValue)       → Lowest priority, background

import { useTransition, useDeferredValue, useState } from "react";

function SearchResults() {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // ✅ Urgent: Update input immediately (discrete priority)
  // ✅ Non-urgent: Filter results in background (transition priority)
  function handleSearch(value: string) {
    setQuery(value);  // Urgent: show typed text immediately
    startTransition(() => {
      setFilteredResults(filterExpensiveList(value));  // Low priority
    });
  }

  return (
    <div>
      <input value={query} onChange={(e) => handleSearch(e.target.value)} />
      {isPending ? <Spinner /> : <ResultList results={filteredResults} />}
    </div>
  );
}

// ── useDeferredValue: Defer expensive rendering ──
function SlowList({ items }: { items: Item[] }) {
  const deferredItems = useDeferredValue(items);
  const isStale = deferredItems !== items;

  return (
    <div style={{ opacity: isStale ? 0.7 : 1 }}>
      {deferredItems.map((item) => (
        <ExpensiveComponent key={item.id} item={item} />
      ))}
    </div>
  );
}
```

---

## 10. Debugging Rendering Performance

```
CHROME DEVTOOLS RENDERING TOOLS:

1. Performance Panel
   - Record → interact → stop
   - Look for: Long Tasks (red corners), Layout events, Paint events
   - Yellow = Scripting, Purple = Layout, Green = Paint, Gray = Idle

2. Rendering Panel (Cmd+Shift+P → "Show Rendering")
   - Paint flashing: Highlights repainted areas in GREEN
   - Layout shift regions: Highlights CLS in BLUE
   - Layer borders: Shows compositor layers in ORANGE
   - Frame Rendering Stats: Shows FPS meter + GPU memory

3. Lighthouse
   - Performance score = weighted average of:
     FCP (10%), SI (10%), LCP (25%), TBT (30%), CLS (25%)

4. Performance Insights Panel (newer)
   - Automatic identification of performance issues
   - Shows render-blocking resources, layout shifts, long tasks

DEBUGGING WORKFLOW:
  1. Open DevTools → Performance → Record
  2. Reproduce the slow interaction
  3. Stop recording
  4. Look for:
     - Red bars at top = dropped frames (jank)
     - Purple bars = Layout/Reflow events
     - Green bars = Paint events
     - Yellow bars = JavaScript execution
  5. Click on long tasks to see call stack
  6. Identify: forced reflow, expensive paint, blocking script
  7. Fix: batch reads/writes, use transform, defer non-critical work
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Layout thrashing** | Reading geometry after writing styles in a loop | Batch all reads before writes, use fastdom |
| **Animating layout properties** | Jank when animating width/height/top/left | Use transform: translate/scale instead |
| **will-change everywhere** | Excessive GPU memory, actually slower | Apply only to animated elements, remove after animation |
| **Inline scripts in body** | Parser-blocking, delayed rendering | Use defer or type="module" on all scripts |
| **Render-blocking CSS** | White screen until all CSS loads | Inline critical CSS, async load rest |
| **No content-visibility** | Rendering thousands of off-screen elements | Apply content-visibility: auto to repeating sections |
| **Forced synchronous layout** | getComputedStyle() between DOM writes | Read first, write in requestAnimationFrame |
| **No resource hints** | Late discovery of critical resources | Preconnect, preload fonts/images, prefetch next pages |
| **Huge DOM tree** | Slow layout, high memory, sluggish interactions | Virtualize long lists (react-window), paginate, lazy render |
| **No fetchpriority** | LCP image loaded with default priority | fetchpriority="high" on LCP image/resource |
| **Synchronous XHR** | Blocks main thread completely | NEVER use sync XHR, use fetch() with async/await |
| **document.write()** | Can re-parse entire document | NEVER use document.write(), use DOM API or framework |
| **Unoptimized images in viewport** | Slow LCP, high bandwidth | Use next/image, WebP/AVIF, responsive srcset, lazy loading |
| **No CSS containment** | Changes in one component trigger global layout | Use contain: layout paint on independent components |

---

## 12. Enforcement Checklist

### Critical Rendering Path
- [ ] **Critical CSS inlined in `<head>`** — under 14KB, above-the-fold styles only
- [ ] **Non-critical CSS loaded async** — rel="preload" with onload swap
- [ ] **All scripts use `defer` or `type="module"`** — NEVER parser-blocking
- [ ] **Fonts preloaded with `font-display: swap`** — prevent FOIT

### Resource Hints
- [ ] **`preconnect` to critical third-party origins** — API, CDN, fonts
- [ ] **`preload` for critical resources** — fonts, hero image, critical JS
- [ ] **`fetchpriority="high"` on LCP element** — image or text container
- [ ] **Speculation Rules for likely navigations** — prefetch/prerender next pages

### Layout Performance
- [ ] **DOM reads batched before DOM writes** — NEVER interleave
- [ ] **Animations use `transform` and `opacity` only** — skip layout/paint
- [ ] **`will-change` applied sparingly** — only on animated elements, removed after
- [ ] **`contain: layout paint` on independent components** — isolate reflows
- [ ] **`content-visibility: auto` on below-fold sections** — skip off-screen rendering
- [ ] **Virtual scrolling for lists > 100 items** — react-window or @tanstack/virtual

### Measurement
- [ ] **PerformanceObserver tracking LCP, CLS, INP** — real user monitoring
- [ ] **Long Task observer detecting >50ms tasks** — identify blocking work
- [ ] **Chrome DevTools paint flashing used in development** — verify no unnecessary repaints
- [ ] **Lighthouse CI in pipeline** — automated performance regression detection
