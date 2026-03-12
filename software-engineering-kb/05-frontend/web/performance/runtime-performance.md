# Runtime Performance — Complete Specification

> **AI Plugin Directive:** When a developer asks "why is my app janky?", "how to fix slow interactions?", "JavaScript performance", "memory leaks", "Web Workers", "reflow vs repaint", "animation performance", "debounce vs throttle", "long tasks", or any runtime performance question, ALWAYS consult this directive. Runtime performance is about keeping the main thread responsive (< 50ms per task), preventing memory leaks, and ensuring smooth 60fps animations. ALWAYS profile with Chrome DevTools before optimizing. NEVER optimize without measuring first.

**Core Rule: The browser's main thread handles JavaScript execution, DOM manipulation, layout, paint, and user input — ALL on ONE thread. Any task > 50ms blocks user interaction (contributes to poor INP). Optimize by: breaking long tasks into chunks, offloading heavy computation to Web Workers, avoiding layout thrashing (read-then-batch-write), using CSS transforms for animations (GPU-accelerated), virtualizing long lists, and debouncing/throttling rapid events. ALWAYS profile with Chrome DevTools Performance panel before optimizing.**

---

## 1. The Main Thread

```
THE BROWSER'S MAIN THREAD — EVERYTHING HAPPENS HERE:

  ┌──────────────────────────────────────────────────────────────┐
  │                     MAIN THREAD                              │
  │                                                              │
  │  ┌─────────┐ ┌───────┐ ┌────────┐ ┌───────┐ ┌────────────┐ │
  │  │ Parse   │→│ Style │→│ Layout │→│ Paint │→│ Composite  │ │
  │  │ HTML/JS │ │ Calc  │ │        │ │       │ │            │ │
  │  └─────────┘ └───────┘ └────────┘ └───────┘ └────────────┘ │
  │       ↑                                                      │
  │  ┌─────────┐ ┌──────────────┐ ┌─────────────────────┐       │
  │  │ JS      │ │ Event        │ │ Timer callbacks     │       │
  │  │ Execute │ │ Handlers     │ │ (setTimeout, rAF)   │       │
  │  └─────────┘ └──────────────┘ └─────────────────────┘       │
  │                                                              │
  │  If ANY task takes > 50ms → USER INPUT IS BLOCKED            │
  │  User clicks but nothing happens until task finishes         │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘

  FRAME BUDGET (60fps):
  ┌──────────────────────────────────────┐
  │ 1000ms / 60 frames = 16.67ms / frame │
  │                                      │
  │ Typical frame work:                  │
  │ ├── JavaScript: ≤ 8ms               │
  │ ├── Style calculation: ~1ms          │
  │ ├── Layout: ~2ms                     │
  │ ├── Paint: ~2ms                      │
  │ └── Composite: ~1ms                  │
  │                                      │
  │ If JS takes 50ms → 3 frames dropped │
  │ If JS takes 200ms → 12 frames lost  │
  │ User perceives jank at > 1 dropped  │
  └──────────────────────────────────────┘

  LONG TASK DEFINITION:
  Any task > 50ms on the main thread.
  Long tasks are the primary cause of poor INP.
```

---

## 2. Breaking Up Long Tasks

```typescript
// PROBLEM: One long synchronous task blocks the main thread
// ❌ BAD: 200ms synchronous loop
function processAllItems(items: Item[]) {
  for (const item of items) {
    heavyComputation(item);  // Total: 200ms+ of blocking
    updateDOM(item);
  }
}


// SOLUTION 1: setTimeout chunking (works everywhere)
async function processInChunks(items: Item[], chunkSize = 50) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    for (const item of chunk) {
      heavyComputation(item);
      updateDOM(item);
    }

    // Yield to main thread — browser handles pending user input
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}


// SOLUTION 2: scheduler.yield() (Chrome 115+, best option)
async function processWithYield(items: Item[]) {
  for (let i = 0; i < items.length; i++) {
    heavyComputation(items[i]);
    updateDOM(items[i]);

    // Yield every 5ms of work
    if (i % 10 === 0) {
      await scheduler.yield(); // Yields then resumes with same priority
    }
  }
}

// Polyfill for scheduler.yield:
function yieldToMain(): Promise<void> {
  if ('scheduler' in globalThis && 'yield' in scheduler) {
    return scheduler.yield();
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}


// SOLUTION 3: requestIdleCallback (for non-urgent work)
function processWhenIdle(items: Item[]) {
  let index = 0;

  function processNext(deadline: IdleDeadline) {
    // Process while there's idle time (and items remaining)
    while (deadline.timeRemaining() > 5 && index < items.length) {
      heavyComputation(items[index]);
      updateDOM(items[index]);
      index++;
    }

    if (index < items.length) {
      requestIdleCallback(processNext);
    }
  }

  requestIdleCallback(processNext, { timeout: 5000 });
}


// SOLUTION 4: requestAnimationFrame (for visual updates)
function animateList(items: Item[]) {
  let index = 0;

  function processFrame() {
    const frameStart = performance.now();

    // Process for max 8ms per frame (leave room for rendering)
    while (index < items.length && performance.now() - frameStart < 8) {
      updateItemVisual(items[index]);
      index++;
    }

    if (index < items.length) {
      requestAnimationFrame(processFrame);
    }
  }

  requestAnimationFrame(processFrame);
}
```

---

## 3. Web Workers

```typescript
// Web Workers run JavaScript on a SEPARATE THREAD
// They do NOT block the main thread
// They CANNOT access DOM directly

// ═══════════════════════════════
// DEDICATED WORKER (most common)
// ═══════════════════════════════

// worker.ts
self.onmessage = (event: MessageEvent) => {
  const { data, type } = event.data;

  switch (type) {
    case 'sort': {
      const sorted = data.sort((a: number, b: number) => a - b);
      self.postMessage({ type: 'sorted', result: sorted });
      break;
    }
    case 'filter': {
      const filtered = data.filter((item: any) => item.active);
      self.postMessage({ type: 'filtered', result: filtered });
      break;
    }
    case 'compute': {
      // Heavy computation that would block main thread
      const result = fibonacci(data.n);
      self.postMessage({ type: 'computed', result });
      break;
    }
  }
};

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}


// main.ts — Using the worker
const worker = new Worker(
  new URL('./worker.ts', import.meta.url),
  { type: 'module' }
);

// Send work to worker
worker.postMessage({ type: 'sort', data: largeArray });

// Receive results
worker.onmessage = (event) => {
  const { type, result } = event.data;
  if (type === 'sorted') {
    updateUI(result); // Update DOM on main thread
  }
};

// Clean up
worker.terminate();


// ═══════════════════════════════
// TRANSFERABLE OBJECTS (zero-copy)
// ═══════════════════════════════

// For large data (ArrayBuffers), use transfer instead of clone
const buffer = new ArrayBuffer(1024 * 1024); // 1MB buffer

// ❌ SLOW: postMessage copies the buffer (doubles memory, takes time)
worker.postMessage({ buffer });

// ✅ FAST: Transfer ownership (zero-copy, original becomes unusable)
worker.postMessage({ buffer }, [buffer]);
// buffer.byteLength === 0 after transfer (no longer usable in main thread)


// ═══════════════════════════════
// COMLINK — RPC-style Worker API
// ═══════════════════════════════

// npm install comlink

// worker.ts
import { expose } from 'comlink';

const api = {
  async processData(data: number[]): Promise<number[]> {
    return data.sort((a, b) => a - b);
  },

  async search(items: Item[], query: string): Promise<Item[]> {
    return items.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  },
};

expose(api);

// main.ts
import { wrap } from 'comlink';

const worker = new Worker(new URL('./worker.ts', import.meta.url));
const api = wrap<typeof import('./worker').api>(worker);

// Use like a regular async function!
const sorted = await api.processData([3, 1, 4, 1, 5, 9]);
const results = await api.search(items, 'shoes');
```

```
WEB WORKER DECISION TREE:

  Is the task > 50ms on main thread?
    │
    NO → Keep on main thread (no worker needed)
    │
    YES
    │
    ├── Does it need DOM access?
    │   YES → Keep on main thread, but break into chunks
    │   NO → Move to Web Worker ✅
    │
    ├── Is it CPU-intensive computation?
    │   YES → Web Worker ✅ (sorting, filtering, parsing, crypto)
    │
    ├── Is it data processing (JSON parse, CSV, etc.)?
    │   YES → Web Worker ✅
    │
    └── Is it image/video processing?
        YES → Web Worker + OffscreenCanvas ✅

  EXAMPLES OF GOOD WORKER USE:
  • Sorting/filtering large datasets (1000+ items)
  • JSON parsing large API responses
  • CSV/Excel file parsing
  • Markdown/HTML processing
  • Encryption/hashing
  • Search indexing
  • Image manipulation (with OffscreenCanvas)
  • WebAssembly computation
```

---

## 4. Memory Management

```typescript
// COMMON MEMORY LEAK PATTERNS AND FIXES

// LEAK 1: Event listeners not removed
// ❌ BAD: Listener stays after component unmount
class LeakyComponent {
  mount() {
    window.addEventListener('resize', this.handleResize);
    // If component is removed, listener keeps reference alive
  }
}

// ✅ FIX: Always remove listeners
class FixedComponent {
  private controller = new AbortController();

  mount() {
    window.addEventListener('resize', this.handleResize, {
      signal: this.controller.signal, // Auto-removes on abort
    });
  }

  unmount() {
    this.controller.abort(); // Removes ALL listeners registered with this signal
  }
}

// React: useEffect cleanup
function ResizableComponent() {
  useEffect(() => {
    const handler = () => { /* ... */ };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
}


// LEAK 2: Timers not cleared
// ❌ BAD: setInterval keeps running after unmount
function PollingComponent() {
  useEffect(() => {
    const id = setInterval(fetchData, 5000);
    // Missing cleanup!
  }, []);
}

// ✅ FIX: Clear interval on cleanup
function PollingComponent() {
  useEffect(() => {
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);
}


// LEAK 3: Detached DOM nodes
// ❌ BAD: References to removed DOM nodes prevent garbage collection
let cachedElement: HTMLElement | null = null;
function showModal() {
  const modal = document.createElement('div');
  document.body.appendChild(modal);
  cachedElement = modal; // Reference survives modal removal
}
function hideModal() {
  cachedElement?.remove(); // Removed from DOM but variable still holds reference!
}

// ✅ FIX: Null the reference
function hideModal() {
  cachedElement?.remove();
  cachedElement = null; // Allow garbage collection
}


// LEAK 4: Closures capturing large objects
// ❌ BAD: Closure keeps entire response object alive
function setupHandler(largeData: LargeObject) {
  button.addEventListener('click', () => {
    console.log(largeData.smallField); // Only uses one field
    // But the entire largeData object is captured in closure
  });
}

// ✅ FIX: Extract only what you need
function setupHandler(largeData: LargeObject) {
  const field = largeData.smallField; // Extract before closure
  button.addEventListener('click', () => {
    console.log(field); // Only captures the string
  });
}


// MEMORY PROFILING WITH DEVTOOLS:
// 1. Chrome DevTools → Memory tab
// 2. Take heap snapshot (before action)
// 3. Perform the action (mount/unmount component, navigate)
// 4. Take heap snapshot (after action)
// 5. Compare snapshots: look for objects that should have been freed
// 6. "Detached" nodes = DOM nodes removed from tree but still referenced
```

---

## 5. Rendering Performance

```
BROWSER RENDERING PIPELINE:

  JavaScript → Style → Layout → Paint → Composite
                                          ↑
                                     GPU accelerated

  WHICH CSS PROPERTIES TRIGGER WHAT:

  LAYOUT (Most expensive — avoid during animation):
  ┌──────────────────────────────────────────────────┐
  │ width, height, margin, padding, border           │
  │ top, left, right, bottom, position               │
  │ display, float, overflow, font-size              │
  │ writing-mode, text-align                         │
  │                                                  │
  │ Triggers: Style → Layout → Paint → Composite    │
  │ Cost: HIGH — recalculates geometry of element    │
  │       AND all elements after it                  │
  └──────────────────────────────────────────────────┘

  PAINT (Medium — avoid during animation):
  ┌──────────────────────────────────────────────────┐
  │ color, background, box-shadow, border-radius     │
  │ visibility, outline, text-decoration             │
  │                                                  │
  │ Triggers: Style → Paint → Composite              │
  │ Cost: MEDIUM — repaints the pixel content        │
  └──────────────────────────────────────────────────┘

  COMPOSITE ONLY (Cheapest — USE for animations):
  ┌──────────────────────────────────────────────────┐
  │ transform (translate, scale, rotate)             │
  │ opacity                                          │
  │ filter (blur, brightness)                        │
  │ will-change (hint to browser)                    │
  │                                                  │
  │ Triggers: Composite only                         │
  │ Cost: LOW — handled by GPU on separate thread    │
  │ Can run at 60fps WITHOUT touching main thread    │
  └──────────────────────────────────────────────────┘

  RULE: ONLY animate transform and opacity for smooth 60fps.
```

### 5.1 Layout Thrashing

```typescript
// LAYOUT THRASHING — Alternating reads and writes forces repeated layouts

// ❌ BAD: Read-write-read-write (forces layout between each pair)
function resizeElements(elements: HTMLElement[]) {
  elements.forEach(el => {
    const width = el.offsetWidth;       // READ (triggers layout)
    el.style.width = width * 2 + 'px'; // WRITE (invalidates layout)
    // Next iteration's read forces ANOTHER layout calculation
  });
  // N elements = N forced layouts = very slow!
}

// ✅ GOOD: Batch all reads, then batch all writes
function resizeElements(elements: HTMLElement[]) {
  // Phase 1: READ all values
  const widths = elements.map(el => el.offsetWidth);

  // Phase 2: WRITE all values
  elements.forEach((el, i) => {
    el.style.width = widths[i] * 2 + 'px';
  });
  // Only 1 layout calculation total!
}

// ✅ BETTER: Use requestAnimationFrame to batch with rendering
function resizeElements(elements: HTMLElement[]) {
  const widths = elements.map(el => el.offsetWidth); // Read phase

  requestAnimationFrame(() => {
    elements.forEach((el, i) => {
      el.style.width = widths[i] * 2 + 'px'; // Write phase
    });
  });
}

// Properties that trigger layout when READ:
// offsetWidth, offsetHeight, offsetTop, offsetLeft
// clientWidth, clientHeight, clientTop, clientLeft
// scrollWidth, scrollHeight, scrollTop, scrollLeft
// getComputedStyle(), getBoundingClientRect()
```

### 5.2 Composite Layers

```css
/* PROMOTING TO COMPOSITE LAYER — GPU-accelerated */

/* will-change: hint to browser to create composite layer */
.animated-element {
  will-change: transform; /* Browser creates composite layer in advance */
}

/* RULES FOR will-change:
   ✅ Use for elements that WILL animate soon
   ❌ Do NOT use on everything (wastes GPU memory)
   ❌ Do NOT use as a "performance silver bullet"
   ✅ Remove when animation completes (if element is static after) */

/* Apply will-change just before animation */
.card:hover {
  will-change: transform;
}
.card.animating {
  transform: scale(1.05);
  transition: transform 0.3s;
}

/* Alternative: use transform: translateZ(0) to force composite layer */
/* This is a hack — prefer will-change */
.force-composite {
  transform: translateZ(0); /* Creates composite layer */
}
```

---

## 6. Animation Performance

```css
/* ═══ GPU-ACCELERATED ANIMATIONS (SMOOTH) ═══ */

/* ✅ GOOD: transform + opacity (composite-only) */
.slide-in {
  transform: translateX(-100%);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-in.active {
  transform: translateX(0);
  opacity: 1;
}

/* ✅ GOOD: Scale animation (no layout recalculation) */
.grow {
  transition: transform 0.2s ease;
}
.grow:hover {
  transform: scale(1.05);
}

/* ❌ BAD: Animating layout properties */
.bad-animation {
  transition: width 0.3s, height 0.3s, margin-left 0.3s;
  /* Triggers layout recalculation EVERY FRAME = janky */
}

/* ❌ BAD: Animating box-shadow (triggers paint) */
.bad-shadow {
  transition: box-shadow 0.3s;
}

/* ✅ GOOD: Pseudo-element shadow trick (composite-only) */
.card {
  position: relative;
}
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.3s ease; /* Only animate opacity! */
}
.card:hover::after {
  opacity: 1;
}
```

```typescript
// FLIP TECHNIQUE — Performant layout animations

// F = First (measure initial position)
// L = Last (move to final position)
// I = Invert (use transform to fake initial position)
// P = Play (animate the transform to 0)

function flipAnimate(element: HTMLElement, finalCallback: () => void) {
  // F — First: Record initial position
  const first = element.getBoundingClientRect();

  // L — Last: Apply the final state
  finalCallback(); // e.g., reorder DOM, change layout

  // Measure new position
  const last = element.getBoundingClientRect();

  // I — Invert: Calculate the difference and apply inverse transform
  const deltaX = first.left - last.left;
  const deltaY = first.top - last.top;
  const deltaW = first.width / last.width;
  const deltaH = first.height / last.height;

  element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
  element.style.transformOrigin = 'top left';

  // P — Play: Animate from inverted position to final
  requestAnimationFrame(() => {
    element.style.transition = 'transform 0.3s ease';
    element.style.transform = 'none';

    element.addEventListener('transitionend', () => {
      element.style.transition = '';
      element.style.transformOrigin = '';
    }, { once: true });
  });
}
```

---

## 7. Virtualization

```typescript
// VIRTUALIZATION — Render only visible items in long lists

// Instead of rendering 10,000 DOM nodes, render only ~20 visible ones
// Dramatically reduces DOM size, memory, and initial render time

// TANSTACK VIRTUAL (framework-agnostic, recommended)
// npm install @tanstack/react-virtual

import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,             // Total items
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,          // Estimated row height (px)
    overscan: 5,                     // Extra items rendered above/below viewport
  });

  return (
    <div
      ref={parentRef}
      style={{ height: '600px', overflow: 'auto' }}
    >
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size,
              width: '100%',
            }}
          >
            <ItemRow item={items[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// DECISION:
// < 100 items     → No virtualization needed
// 100-500 items   → Consider if items are complex (many DOM nodes each)
// 500-1000 items  → Strongly recommended
// 1000+ items     → ALWAYS virtualize
```

---

## 8. Debounce and Throttle

```typescript
// DEBOUNCE — Execute ONCE after activity stops
// Use for: search input, window resize, form validation

function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Usage: Only search after user stops typing for 300ms
const handleSearch = debounce((query: string) => {
  fetchSearchResults(query);
}, 300);

input.addEventListener('input', (e) => handleSearch(e.target.value));


// THROTTLE — Execute at most once per interval
// Use for: scroll handlers, mousemove, resize (continuous)

function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn(...args);
    }
  };
}

// Usage: Update scroll position max every 100ms
const handleScroll = throttle(() => {
  updateScrollIndicator(window.scrollY);
}, 100);

window.addEventListener('scroll', handleScroll, { passive: true });
// passive: true tells browser handler won't call preventDefault()
// This allows browser to optimize scrolling (no main thread wait)


// COMPARISON:
// User types: a-b-c-d-e (each 100ms apart)
// Debounce(300ms): ────────────────[abcde]  (fires once, 300ms after last)
// Throttle(200ms): [a]────[c]────[e]────    (fires every 200ms)

// DECISION:
// • Search input → debounce (only need final query)
// • Scroll position → throttle (need periodic updates)
// • Window resize → debounce (only need final size)
// • Drag/mousemove → throttle (need continuous feedback)
// • Form validation → debounce (validate after user stops)
// • Infinite scroll → throttle (check position periodically)
```

---

## 9. Chrome DevTools Performance Panel

```
HOW TO PROFILE RUNTIME PERFORMANCE:

  1. Open Chrome DevTools → Performance tab
  2. Click Record (or Ctrl+E)
  3. Perform the interaction you want to measure
  4. Stop recording
  5. Analyze:

  ┌──────────────────────────────────────────────────────┐
  │ FLAME CHART (top section):                           │
  │ ┌────────────────────────────────────────────────┐   │
  │ │ ████████  ← Wide bars = long tasks             │   │
  │ │ ██ ██ ██  ← Call stack depth = nesting         │   │
  │ │ █  █  █   ← Red corners = above 50ms threshold │   │
  │ └────────────────────────────────────────────────┘   │
  │                                                      │
  │ WHAT TO LOOK FOR:                                    │
  │ • Long yellow bars = JavaScript execution            │
  │ • Purple bars = Layout (expensive if frequent)       │
  │ • Green bars = Paint                                 │
  │ • Red triangles = dropped frames                     │
  │                                                      │
  │ SUMMARY (bottom section):                            │
  │ ┌─────────────────────────────────┐                  │
  │ │ Loading:     150ms              │                  │
  │ │ Scripting:   450ms  ← Focus here│                  │
  │ │ Rendering:    80ms              │                  │
  │ │ Painting:     30ms              │                  │
  │ │ System:       50ms              │                  │
  │ │ Idle:       1240ms              │                  │
  │ └─────────────────────────────────┘                  │
  │                                                      │
  │ Bottom-Up / Call Tree / Event Log tabs:               │
  │ • Bottom-Up: Which functions took the most total time │
  │ • Call Tree: Top-down hierarchy of calls              │
  │ • Event Log: Chronological list of events             │
  └──────────────────────────────────────────────────────┘

  QUICK CHECKS:
  • "Total Blocking Time" in Summary
  • Red bars in "Frames" row = dropped frames
  • "Recalculate Style" events = too many style changes
  • "Layout" events = layout thrashing
  • "Paint" events during scroll = non-composited animations
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Long tasks (> 50ms) on main thread** | Poor INP, janky scrolling, unresponsive UI | Break into chunks with `setTimeout(0)` or `scheduler.yield()` |
| **Layout thrashing** | Alternating DOM reads and writes, forced reflows, slow rendering | Batch reads first, then writes; use `requestAnimationFrame` |
| **Animating layout properties** | Janky animations on width, height, margin, top/left | ONLY animate `transform` and `opacity` (GPU-composited) |
| **Memory leaks from event listeners** | Growing memory, app slows over time, eventually crashes | Always remove listeners; use `AbortController` signal; cleanup in unmount |
| **Memory leaks from timers** | setInterval/setTimeout running after component unmount | Clear timers in cleanup functions; use `clearInterval`/`clearTimeout` |
| **Not using passive event listeners** | Scroll jank — browser waits for handler to check preventDefault | Add `{ passive: true }` to scroll, touchstart, touchmove listeners |
| **Rendering 1000+ DOM nodes** | Slow initial render, high memory, sluggish interactions | Virtualize long lists with TanStack Virtual or similar |
| **will-change on everything** | Excessive GPU memory usage, actually WORSE performance | Only use `will-change` on elements about to animate; remove after |
| **Synchronous heavy computation** | UI freezes during sort, filter, search on large datasets | Move to Web Worker or break into async chunks |
| **No profiling before optimizing** | Guessing at bottlenecks, optimizing wrong things, adding complexity | ALWAYS profile with DevTools Performance panel first |

---

## 11. Enforcement Checklist

### Main Thread
- [ ] No single task > 50ms during user interactions (check with Long Tasks observer)
- [ ] Heavy computation offloaded to Web Workers
- [ ] Non-urgent work deferred with `requestIdleCallback`
- [ ] `scheduler.yield()` or `setTimeout(0)` used to break long loops

### Memory
- [ ] ALL event listeners removed on component unmount
- [ ] ALL timers (setInterval, setTimeout) cleared on unmount
- [ ] `AbortController` used for fetch cancellation and listener cleanup
- [ ] No detached DOM nodes (verified with Memory profiler)
- [ ] WeakRef/WeakMap used for caches that shouldn't prevent GC

### Rendering
- [ ] Animations ONLY use `transform` and `opacity`
- [ ] No layout thrashing (reads and writes batched separately)
- [ ] `will-change` used sparingly and removed after animation
- [ ] Scroll/touch listeners use `{ passive: true }`
- [ ] `requestAnimationFrame` used for visual updates

### Lists & Data
- [ ] Lists with 500+ items virtualized
- [ ] Search/filter inputs debounced (300ms)
- [ ] Scroll handlers throttled (100-200ms)
- [ ] Large datasets processed in chunks or Web Workers

### Measurement
- [ ] Chrome DevTools Performance panel used to identify bottlenecks
- [ ] `PerformanceObserver` for long tasks monitoring in production
- [ ] INP tracked via web-vitals library
- [ ] Performance profiled BEFORE and AFTER every optimization
