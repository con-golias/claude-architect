# JavaScript Performance — Performance Engineering

> **Domain:** Frontend Performance > Runtime Execution
> **Importance:** CRITICAL
> **Cross-ref:** 05-frontend/web/performance/runtime-performance.md (JS engine internals, runtime patterns)

> **Directive:** When diagnosing slow interactions, high INP, janky animations, memory leaks, or main thread blocking, consult this guide. See 05-frontend for JS engine optimization patterns.

---

## 1. Main Thread Model

```
BROWSER MAIN THREAD — SINGLE-THREADED:
  All of these share ONE thread:
  ├── JavaScript execution
  ├── DOM parsing
  ├── Style calculation
  ├── Layout
  ├── Paint
  └── User input event handling

  60fps → 16.67ms per frame
  If JS takes > 16.67ms → frame dropped → jank

  LONG TASK: Any task > 50ms
  ├── Blocks input handling → increases INP
  ├── Blocks rendering → dropped frames
  └── Must be broken up or moved off main thread

  TASK BREAKDOWN TARGET:
  ┌────────────┬───────────────────────────────────┐
  │ Duration   │ User Perception                   │
  ├────────────┼───────────────────────────────────┤
  │ < 50ms     │ Instant — no perceptible delay    │
  │ 50-100ms   │ Noticeable lag                    │
  │ 100-300ms  │ Sluggish                          │
  │ > 300ms    │ Broken / unresponsive             │
  └────────────┴───────────────────────────────────┘
```

## 2. Breaking Up Long Tasks

```typescript
// yield-to-main.ts — Break long tasks to keep main thread responsive

// Modern: scheduler.yield() (Chrome 115+)
async function processItemsWithYield(items: any[]): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);
    // Yield every 5 items to let browser handle input/rendering
    if (i % 5 === 0 && 'scheduler' in globalThis) {
      await (globalThis as any).scheduler.yield();
    }
  }
}

// Fallback: setTimeout(0) to yield
function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// requestIdleCallback — run during idle periods
function processInIdleTime(tasks: Array<() => void>): void {
  let idx = 0;
  function workLoop(deadline: IdleDeadline): void {
    while (idx < tasks.length && deadline.timeRemaining() > 5) {
      tasks[idx]();
      idx++;
    }
    if (idx < tasks.length) {
      requestIdleCallback(workLoop);
    }
  }
  requestIdleCallback(workLoop);
}

// Chunked processing with abort support
async function processChunked<T>(
  items: T[],
  process: (item: T) => void,
  chunkSize = 10,
  signal?: AbortSignal,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const chunk = items.slice(i, i + chunkSize);
    chunk.forEach(process);
    await yieldToMain();
  }
}
```

## 3. Web Workers for Heavy Computation

```typescript
// computation-worker.ts — Move CPU-intensive work off main thread
// worker.ts
self.onmessage = (e: MessageEvent<{ type: string; data: any }>) => {
  switch (e.data.type) {
    case 'sort': {
      const sorted = e.data.data.sort((a: number, b: number) => a - b);
      self.postMessage({ type: 'sort', result: sorted });
      break;
    }
    case 'search': {
      const { items, query } = e.data.data;
      const results = items.filter((item: string) =>
        item.toLowerCase().includes(query.toLowerCase())
      );
      self.postMessage({ type: 'search', result: results });
      break;
    }
  }
};

// main.ts — Worker manager with promise-based API
class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{ resolve: Function; reject: Function; msg: any }> = [];
  private busy = new Set<Worker>();

  constructor(workerUrl: string, poolSize = navigator.hardwareConcurrency || 4) {
    for (let i = 0; i < poolSize; i++) {
      const w = new Worker(workerUrl, { type: 'module' });
      this.workers.push(w);
    }
  }

  async run<T>(message: any): Promise<T> {
    const available = this.workers.find(w => !this.busy.has(w));
    if (!available) {
      return new Promise((resolve, reject) => {
        this.queue.push({ resolve, reject, msg: message });
      });
    }
    return this.execute(available, message);
  }

  private execute<T>(worker: Worker, message: any): Promise<T> {
    this.busy.add(worker);
    return new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        this.busy.delete(worker);
        resolve(e.data.result);
        this.processQueue();
      };
      worker.onerror = (e) => {
        this.busy.delete(worker);
        reject(e);
        this.processQueue();
      };
      worker.postMessage(message);
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;
    const available = this.workers.find(w => !this.busy.has(w));
    if (!available) return;
    const { resolve, reject, msg } = this.queue.shift()!;
    this.execute(available, msg).then(resolve, reject);
  }
}
```

## 4. Memory Leak Detection

```typescript
// memory-leak-patterns.ts — Common SPA memory leaks and fixes

// LEAK 1: Unremoved event listeners
// BAD
class BadComponent {
  mount() {
    window.addEventListener('resize', this.onResize);  // Never removed
  }
  onResize = () => { /* ... */ };
}

// GOOD
class GoodComponent {
  private controller = new AbortController();
  mount() {
    window.addEventListener('resize', this.onResize, {
      signal: this.controller.signal,  // Auto-cleanup
    });
  }
  unmount() {
    this.controller.abort();  // Removes ALL listeners at once
  }
  onResize = () => { /* ... */ };
}

// LEAK 2: Closures holding references
// BAD — closure captures entire scope
function createHandler(largeData: ArrayBuffer) {
  return () => {
    console.log(largeData.byteLength);  // largeData never GC'd
  };
}

// GOOD — extract needed value
function createHandler2(largeData: ArrayBuffer) {
  const size = largeData.byteLength;  // Copy primitive
  return () => console.log(size);     // largeData can be GC'd
}

// LEAK 3: Detached DOM nodes
// BAD — reference keeps detached DOM in memory
let cachedNode: HTMLElement | null = null;
function showPopup() {
  cachedNode = document.createElement('div');
  document.body.appendChild(cachedNode);
}
function hidePopup() {
  cachedNode?.remove();  // Removed from DOM but cachedNode still references it
}

// GOOD — null out reference
function hidePopupFixed() {
  cachedNode?.remove();
  cachedNode = null;  // Allow GC
}
```

## 5. Event Handling Optimization

```typescript
// event-optimization.ts — Delegation, debounce, throttle

// EVENT DELEGATION — one listener handles many elements
document.getElementById('list')!.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-action]');
  if (!target) return;
  const action = target.getAttribute('data-action');
  switch (action) {
    case 'delete': handleDelete(target); break;
    case 'edit': handleEdit(target); break;
  }
});

// DEBOUNCE — wait for inactivity (search input, resize)
function debounce<T extends (...args: any[]) => void>(
  fn: T, ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// THROTTLE — max once per interval (scroll, mousemove)
function throttle<T extends (...args: any[]) => void>(
  fn: T, ms: number
): (...args: Parameters<T>) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}

// Usage
const searchInput = document.getElementById('search') as HTMLInputElement;
searchInput.addEventListener('input', debounce((e: Event) => {
  performSearch((e.target as HTMLInputElement).value);
}, 300));

window.addEventListener('scroll', throttle(() => {
  updateScrollPosition();
}, 100), { passive: true });  // passive: true for scroll performance
```

## 6. requestAnimationFrame for Visual Updates

```typescript
// raf-patterns.ts — Smooth visual updates at 60fps

// Read THEN write — avoid layout thrashing
function updateElementPositions(elements: HTMLElement[]): void {
  // BATCH READ — all measurements first
  const measurements = elements.map(el => ({
    el,
    rect: el.getBoundingClientRect(),
  }));

  // BATCH WRITE — all mutations after reads
  requestAnimationFrame(() => {
    measurements.forEach(({ el, rect }) => {
      el.style.transform = `translateY(${rect.top * 0.5}px)`;
    });
  });
}

// Efficient animation loop
class AnimationLoop {
  private rafId: number | null = null;
  private lastTime = 0;

  start(callback: (deltaMs: number) => boolean): void {
    const loop = (time: number) => {
      const delta = time - this.lastTime;
      this.lastTime = time;
      const shouldContinue = callback(delta);
      if (shouldContinue) {
        this.rafId = requestAnimationFrame(loop);
      }
    };
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
```

## 7. Performance Measurement

```typescript
// js-perf-measurement.ts — Measure JS execution impact
function measureTask(label: string, fn: () => void): void {
  performance.mark(`${label}-start`);
  fn();
  performance.mark(`${label}-end`);
  performance.measure(label, `${label}-start`, `${label}-end`);
  const entry = performance.getEntriesByName(label).pop();
  if (entry && entry.duration > 50) {
    console.warn(`Long task: ${label} took ${entry.duration.toFixed(1)}ms`);
  }
}

// Long Task Observer — detect all long tasks in production
const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // Report long tasks to analytics
    sendMetric('long-task', {
      duration: entry.duration,
      startTime: entry.startTime,
      url: location.pathname,
    });
  }
});
longTaskObserver.observe({ type: 'longtask', buffered: true });
```

---

## 10 Best Practices

1. **Break tasks at 50ms** — use `scheduler.yield()` or `setTimeout(0)` to stay under long task threshold
2. **Move computation to Web Workers** — sorting, filtering, parsing belong off main thread
3. **Use event delegation** — one listener on parent instead of N listeners on children
4. **Debounce input handlers** — 150-300ms delay for search; throttle scroll at 100ms
5. **Batch DOM reads before writes** — prevents forced synchronous layout (layout thrashing)
6. **Use AbortController for cleanup** — single abort removes all listeners; prevents memory leaks
7. **Passive event listeners** — add `{ passive: true }` to scroll/touch listeners
8. **Measure with Long Task Observer** — detect > 50ms tasks in production RUM
9. **Profile before optimizing** — use DevTools Performance panel to find actual bottlenecks
10. **Null references on cleanup** — clear DOM references, timers, and caches when components unmount

## 8 Anti-Patterns

1. **Synchronous XHR** — blocks main thread; use async fetch with AbortController
2. **Layout thrashing** — read `offsetHeight` then write `style.height` in a loop
3. **Unbounded array growth** — event logs, undo history without size limits leak memory
4. **setInterval without clear** — survives component unmount; use RAF loop instead
5. **JSON.parse on main thread for large data** — parse > 1MB JSON in a Web Worker
6. **Eager computation on load** — computing everything at startup; defer non-visible work
7. **Console.log in production** — serializing large objects blocks main thread
8. **Non-passive scroll listeners** — forces browser to wait for handler before scrolling

## Enforcement Checklist

- [ ] No synchronous operations blocking main thread > 50ms
- [ ] Web Workers used for data processing > 100ms
- [ ] All event listeners cleaned up on component unmount
- [ ] Scroll and touch listeners marked as passive
- [ ] Memory profiling run quarterly (heap snapshots)
- [ ] Long Task Observer reporting to RUM dashboard
- [ ] DOM reads batched before DOM writes (no interleaving)
- [ ] Debounce/throttle on all high-frequency event handlers
