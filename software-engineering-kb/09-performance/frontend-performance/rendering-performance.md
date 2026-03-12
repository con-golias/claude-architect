# Rendering Performance — Performance Engineering

> **Domain:** Frontend Performance > GPU & Rendering Optimization
> **Importance:** HIGH

> **Directive:** When optimizing animations, reducing paint/layout cost, implementing virtual scrolling, or diagnosing jank, consult this guide. Focus on GPU compositing, CSS containment, and layout avoidance strategies for 60fps rendering.

---

## 1. Rendering Cost Hierarchy

```
PROPERTY CHANGE COST (cheapest → most expensive):

  COMPOSITE ONLY (cheapest — GPU thread, no main thread work):
  ├── transform (translate, scale, rotate)
  ├── opacity
  └── filter (blur, brightness, etc.)

  PAINT + COMPOSITE (moderate — repaint affected area):
  ├── color, background-color
  ├── box-shadow
  ├── border-color
  └── background-image

  LAYOUT + PAINT + COMPOSITE (expensive — recalculates geometry):
  ├── width, height, padding, margin
  ├── top, left, right, bottom
  ├── font-size, line-height
  ├── display, position, float
  └── border-width

  RULE: Animate ONLY transform and opacity.
  Everything else triggers layout or paint on EVERY frame.
```

## 2. GPU Compositing

```css
/* PROMOTE ELEMENTS TO GPU LAYERS for smooth animation */

/* GOOD: will-change signals browser to create GPU layer */
.animated-element {
  will-change: transform;  /* Promotes to own compositor layer */
}

/* Remove will-change when animation completes */
.animated-element.idle {
  will-change: auto;  /* Release GPU memory */
}

/* GOOD: transform: translateZ(0) — legacy promotion hack */
.gpu-layer {
  transform: translateZ(0);  /* Forces GPU layer */
}

/* Composite-only animation — 60fps guaranteed */
.slide-in {
  transform: translateX(-100%);
  transition: transform 300ms ease-out;
}
.slide-in.active {
  transform: translateX(0);
}

/* BAD: Animating layout properties */
.slide-in-bad {
  left: -100%;  /* Triggers layout on every frame */
  transition: left 300ms ease-out;
}
```

```typescript
// layer-count-audit.ts — Too many GPU layers waste memory
function auditLayers(): { count: number; warning: string | null } {
  // Check via DevTools → Layers panel (manual)
  // Or approximate via will-change usage:
  const willChangeElements = document.querySelectorAll('[style*="will-change"]');
  const cssWillChange = document.querySelectorAll('*');
  let layerCount = 0;

  cssWillChange.forEach(el => {
    const style = getComputedStyle(el);
    if (style.willChange !== 'auto' || style.transform !== 'none') {
      layerCount++;
    }
  });

  return {
    count: layerCount,
    warning: layerCount > 30
      ? `${layerCount} GPU layers detected — risk of memory pressure on mobile`
      : null,
  };
}
```

## 3. CSS Containment

```css
/* CSS CONTAINMENT — Tell browser what WON'T change */

/* contain: layout — element's layout is independent */
/* Changes inside don't affect siblings or ancestors */
.card {
  contain: layout;
}

/* contain: paint — nothing paints outside element bounds */
.widget {
  contain: paint;
}

/* contain: size — element's size doesn't depend on children */
/* MUST set explicit width/height */
.fixed-size-container {
  contain: size;
  width: 300px;
  height: 200px;
}

/* contain: content — shorthand for layout + paint (most common) */
.independent-section {
  contain: content;
}

/* contain: strict — all containment (size + layout + paint + style) */
.fully-contained {
  contain: strict;
  width: 100%;
  height: 400px;
}

/* content-visibility: auto — MOST impactful for long pages */
/* Browser skips rendering of off-screen sections entirely */
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;  /* Placeholder height for scrollbar */
}

/* IMPACT: Can reduce rendering work by 50-90% on long pages */
/* contain-intrinsic-size: auto — remembers last rendered size */
```

## 4. Layout Thrashing Prevention

```typescript
// layout-thrashing.ts — Detect and prevent forced synchronous layout

// BAD: Read-write interleaving forces layout on each iteration
function badResize(elements: HTMLElement[]): void {
  elements.forEach(el => {
    const height = el.offsetHeight;          // READ → forces layout
    el.style.height = (height * 2) + 'px';  // WRITE → invalidates layout
    // Next iteration's READ forces layout AGAIN
  });
}

// GOOD: Batch all reads, then batch all writes
function goodResize(elements: HTMLElement[]): void {
  // Phase 1: READ all measurements
  const heights = elements.map(el => el.offsetHeight);

  // Phase 2: WRITE all mutations
  requestAnimationFrame(() => {
    elements.forEach((el, i) => {
      el.style.height = (heights[i] * 2) + 'px';
    });
  });
}

// FASTDOM: Library that batches reads and writes automatically
import fastdom from 'fastdom';

function fastdomResize(elements: HTMLElement[]): void {
  elements.forEach(el => {
    fastdom.measure(() => {
      const height = el.offsetHeight;
      fastdom.mutate(() => {
        el.style.height = (height * 2) + 'px';
      });
    });
  });
}

// PROPERTIES THAT TRIGGER LAYOUT (avoid reading in write loops):
// offsetTop/Left/Width/Height, scrollTop/Left/Width/Height
// clientTop/Left/Width/Height, getComputedStyle(), getBoundingClientRect()
```

## 5. CSS Animations vs JS Animations

```css
/* CSS ANIMATIONS — preferred for simple transitions */
/* Run on compositor thread — won't jank even if main thread busy */

@keyframes fade-slide {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-slide-in {
  animation: fade-slide 300ms ease-out forwards;
}

/* CSS transitions — simplest for state changes */
.button {
  transform: scale(1);
  transition: transform 150ms ease-out, opacity 150ms ease-out;
}
.button:hover {
  transform: scale(1.05);
}
.button:active {
  transform: scale(0.95);
}
```

```typescript
// web-animations-api.ts — JS animations that run on compositor
// Web Animations API: same performance as CSS, more control

function animateElement(el: HTMLElement): Animation {
  return el.animate(
    [
      { transform: 'translateX(0)', opacity: 1 },
      { transform: 'translateX(100px)', opacity: 0 },
    ],
    {
      duration: 300,
      easing: 'ease-out',
      fill: 'forwards',
      // composite: 'accumulate', // Stack with existing transforms
    }
  );
}

// Scroll-driven animations (modern CSS — no JS needed)
// @keyframes reveal {
//   from { opacity: 0; transform: translateY(50px); }
//   to { opacity: 1; transform: translateY(0); }
// }
// .reveal {
//   animation: reveal linear;
//   animation-timeline: view();
//   animation-range: entry 0% entry 100%;
// }
```

## 6. Virtual Scrolling

```typescript
// virtual-scroll.ts — Render only visible items in long lists
interface VirtualListConfig {
  container: HTMLElement;
  itemHeight: number;
  totalItems: number;
  renderItem: (index: number) => HTMLElement;
  overscan?: number;  // Extra items above/below viewport
}

class VirtualList {
  private scrollTop = 0;
  private containerHeight: number;

  constructor(private config: VirtualListConfig) {
    this.containerHeight = config.container.clientHeight;
    const totalHeight = config.itemHeight * config.totalItems;

    // Spacer to maintain scrollbar height
    const spacer = document.createElement('div');
    spacer.style.height = `${totalHeight}px`;
    spacer.style.position = 'relative';
    config.container.appendChild(spacer);

    config.container.addEventListener('scroll', () => {
      this.scrollTop = config.container.scrollTop;
      this.render();
    }, { passive: true });

    this.render();
  }

  private render(): void {
    const { itemHeight, totalItems, renderItem, overscan = 5 } = this.config;
    const startIdx = Math.max(0, Math.floor(this.scrollTop / itemHeight) - overscan);
    const endIdx = Math.min(
      totalItems,
      Math.ceil((this.scrollTop + this.containerHeight) / itemHeight) + overscan
    );

    // Clear and re-render visible items only
    const container = this.config.container.firstElementChild as HTMLElement;
    container.innerHTML = '';

    for (let i = startIdx; i < endIdx; i++) {
      const item = renderItem(i);
      item.style.position = 'absolute';
      item.style.top = `${i * itemHeight}px`;
      item.style.height = `${itemHeight}px`;
      container.appendChild(item);
    }
    // 10,000 items → only ~30 DOM nodes at any time
  }
}
```

## 7. Performance Profiling Workflow

```
DEVTOOLS PERFORMANCE PANEL WORKFLOW:
  1. Record → Interact → Stop
  2. Look at:
     ├── Main thread flame chart — find long tasks (red corners)
     ├── Frames row — find dropped frames (red bars)
     ├── Summary tab — breakdown of time (Scripting/Rendering/Painting)
     └── Bottom-Up tab — most expensive functions

  KEY INDICATORS:
  ├── Yellow (Scripting) > 50% → Too much JS execution
  ├── Purple (Rendering) > 30% → Layout thrashing
  ├── Green (Painting) > 20% → Excessive repaints
  └── Red frame indicators → Dropped frames (jank)

  RENDERING TAB TOOLS:
  ├── Paint flashing → Shows what repaints (green flash)
  ├── Layout shift regions → Shows CLS sources (blue flash)
  ├── Layer borders → Shows compositor layers (orange borders)
  └── FPS meter → Real-time frame rate overlay
```

---

## 10 Best Practices

1. **Animate only transform and opacity** — only properties that skip layout and paint
2. **Use content-visibility: auto** — skip rendering off-screen sections entirely
3. **Batch DOM reads before writes** — never interleave measurements with mutations
4. **Virtual scroll for 100+ items** — render only visible rows; DOM stays under 50 nodes
5. **CSS containment on independent sections** — `contain: content` limits layout scope
6. **will-change sparingly** — apply before animation, remove after; max 10-15 layers
7. **Prefer CSS transitions over JS** — compositor thread handles CSS; main thread handles JS
8. **Use Web Animations API** — same perf as CSS with programmatic control
9. **Profile before optimizing** — DevTools Performance panel shows actual bottlenecks
10. **Reduce DOM size** — target under 1500 nodes; deep nesting increases layout cost

## 8 Anti-Patterns

1. **Animating width/height/top/left** — triggers layout every frame; use transform instead
2. **will-change on everything** — each promoted layer uses GPU memory; mobile crashes
3. **Reading layout in scroll handlers** — getBoundingClientRect() in scroll = constant layout
4. **10,000-node DOM** — every layout calculation walks the entire tree; keep under 1500
5. **Forced synchronous layout** — reading offsetHeight after style change forces immediate layout
6. **JS-driven animations at 60fps** — setInterval(fn, 16) drifts; use rAF or CSS
7. **No contain-intrinsic-size with content-visibility** — scrollbar jumps as sections render
8. **Box-shadow animations** — triggers repaint; animate opacity of pseudo-element shadow instead

## Enforcement Checklist

- [ ] Animations use only transform/opacity (no layout-triggering properties)
- [ ] content-visibility: auto applied to below-fold sections
- [ ] Virtual scrolling for lists > 100 items
- [ ] DOM node count under 1500 per page (audit in DevTools)
- [ ] No layout thrashing (no read-write interleaving in loops)
- [ ] GPU layer count under 30 (check Layers panel)
- [ ] FPS stays above 55 during animations (Performance panel)
- [ ] CSS containment applied to independent widgets/cards
