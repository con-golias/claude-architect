# Lazy Loading — Performance Engineering

> **Domain:** Frontend Performance > Deferred Loading Strategies
> **Importance:** HIGH

> **Directive:** When implementing lazy loading for images, components, routes, third-party scripts, or below-the-fold content, consult this guide. Lazy loading reduces initial page weight by deferring non-critical resources until needed.

---

## 1. Lazy Loading Strategy Overview

```
WHAT TO LAZY LOAD:
┌──────────────────────┬──────────────────────┬──────────────────────┐
│ Resource             │ Strategy             │ Trigger              │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Below-fold images    │ loading="lazy"       │ Viewport proximity   │
│ Route components     │ Dynamic import       │ Navigation event     │
│ Heavy UI components  │ React.lazy/Suspense  │ User interaction     │
│ Third-party embeds   │ Facade pattern       │ Click/hover          │
│ Third-party scripts  │ Defer/dynamic inject │ Idle or interaction  │
│ Non-critical CSS     │ Media query trick    │ Page load complete   │
│ Below-fold sections  │ content-visibility   │ Scroll proximity     │
└──────────────────────┴──────────────────────┴──────────────────────┘

WHAT TO NEVER LAZY LOAD:
├── LCP image (hero, banner) — must load eagerly with fetchpriority="high"
├── Above-the-fold content — user sees it immediately
├── Critical CSS/JS — needed for first render
└── Navigation elements — needed for interaction
```

## 2. Image Lazy Loading

```html
<!-- Native lazy loading — simplest, best performance -->
<img src="product.webp"
     loading="lazy"
     width="400" height="300"
     alt="Product photo"
     decoding="async" />

<!-- IMPORTANT: Always include width/height to prevent CLS -->
<!-- Browser starts loading ~1250px before viewport (varies by connection) -->
```

```typescript
// intersection-observer-lazy.ts — Custom lazy loading with more control
class LazyImageLoader {
  private observer: IntersectionObserver;

  constructor(rootMargin = '200px') {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target as HTMLImageElement);
            this.observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin }  // Start loading 200px before viewport
    );
  }

  observe(img: HTMLImageElement): void {
    this.observer.observe(img);
  }

  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;
    if (srcset) img.srcset = srcset;
    if (src) img.src = src;
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
  }

  destroy(): void {
    this.observer.disconnect();
  }
}

// Usage
const loader = new LazyImageLoader();
document.querySelectorAll('img[data-src]').forEach(img => {
  loader.observe(img as HTMLImageElement);
});
```

## 3. Component Lazy Loading

```typescript
// component-lazy-loading.tsx — React patterns
import { lazy, Suspense, useState } from 'react';

// Route-based lazy loading (ALWAYS do this)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

// Heavy component lazy loading
const ChartComponent = lazy(() => import('./components/Chart'));
const MarkdownEditor = lazy(() => import('./components/MarkdownEditor'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Suspense>
  );
}

// Interaction-triggered lazy loading
function DataVisualization() {
  const [showChart, setShowChart] = useState(false);
  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Chart</button>
      {showChart && (
        <Suspense fallback={<ChartSkeleton />}>
          <ChartComponent />
        </Suspense>
      )}
    </div>
  );
}

// Preload on hover — load chunk before click
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const preload = () => {
    // Trigger chunk download on hover (before click)
    if (to === '/dashboard') import('./pages/Dashboard');
    if (to === '/settings') import('./pages/Settings');
  };
  return (
    <Link to={to} onMouseEnter={preload} onFocus={preload}>
      {children}
    </Link>
  );
}
```

```python
# lazy_component_audit.py — Verify route components are lazily loaded
import re
from pathlib import Path

def audit_lazy_routes(router_file: str) -> dict:
    """Check that route components use dynamic imports."""
    content = Path(router_file).read_text()

    # Find all route component references
    static_imports = re.findall(
        r"import\s+(\w+)\s+from\s+['\"]\./(pages|views|routes)/", content
    )
    lazy_imports = re.findall(
        r"lazy\(\(\)\s*=>\s*import\(['\"]\./(pages|views|routes)/", content
    )

    return {
        "static_route_imports": len(static_imports),
        "lazy_route_imports": len(lazy_imports),
        "static_components": [name for name, _ in static_imports],
        "verdict": "FAIL" if static_imports else "PASS",
        "recommendation": (
            f"Convert {len(static_imports)} static imports to lazy(): "
            + ", ".join(name for name, _ in static_imports)
        ) if static_imports else "All routes are lazily loaded",
    }
```

## 4. Facade Pattern for Embeds

```typescript
// facade-pattern.tsx — Replace heavy embeds with lightweight facades
// YouTube embed: ~800KB → Facade: ~5KB (until click)

function YouTubeFacade({ videoId, title }: { videoId: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (loaded) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media"
        allowFullScreen
        style={{ width: '100%', aspectRatio: '16/9', border: 0 }}
      />
    );
  }

  return (
    <button
      onClick={() => setLoaded(true)}
      style={{
        position: 'relative', width: '100%', aspectRatio: '16/9',
        background: `url(${thumbnailUrl}) center/cover`, border: 0, cursor: 'pointer',
      }}
      aria-label={`Play: ${title}`}
    >
      <PlayIcon /> {/* SVG play button overlay */}
    </button>
  );
}

// Same pattern for: Google Maps, Twitter embeds, chat widgets, Intercom
// lite-youtube-embed: npm package implementing this pattern
```

## 5. Third-Party Script Deferral

```typescript
// third-party-loader.ts — Load non-critical scripts after user interaction
type LoadTrigger = 'idle' | 'interaction' | 'visible';

function loadScript(src: string, trigger: LoadTrigger): void {
  const inject = () => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  };

  switch (trigger) {
    case 'idle':
      if ('requestIdleCallback' in window) {
        requestIdleCallback(inject, { timeout: 5000 });
      } else {
        setTimeout(inject, 3000);
      }
      break;

    case 'interaction': {
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      const handler = () => {
        inject();
        events.forEach(e => document.removeEventListener(e, handler));
      };
      events.forEach(e => document.addEventListener(e, handler, {
        once: true, passive: true,
      }));
      break;
    }

    case 'visible':
      // Load when element enters viewport
      break;
  }
}

// Usage — prioritize third-party scripts
loadScript('https://www.googletagmanager.com/gtag/js?id=G-XXX', 'idle');
loadScript('https://widget.intercom.io/widget/xxx', 'interaction');
loadScript('https://connect.facebook.net/en_US/fbevents.js', 'idle');
```

## 6. Below-the-Fold Deferral

```typescript
// below-fold-loader.tsx — Defer rendering of below-fold sections

function LazySection({
  children,
  fallback = <SectionSkeleton />,
  rootMargin = '200px',
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{isVisible ? children : fallback}</div>;
}

// CSS alternative: content-visibility: auto
// .below-fold-section {
//   content-visibility: auto;
//   contain-intrinsic-size: auto 500px;  /* Estimated height */
// }
```

---

## 10 Best Practices

1. **Native loading="lazy" for images** — zero JS required; browser handles viewport detection
2. **Route-split all pages** — every route uses dynamic import; no exceptions
3. **Facade heavy embeds** — YouTube, Maps, chat widgets load on interaction
4. **Preload on hover** — trigger dynamic import on mouseenter for predicted navigation
5. **Defer third-party scripts** — analytics, chat, ads load after idle or first interaction
6. **Always set dimensions** — width/height on lazy images prevents CLS when they load
7. **Use Suspense boundaries** — wrap lazy components with meaningful skeleton fallbacks
8. **content-visibility: auto** — CSS-only lazy rendering for long pages
9. **Set rootMargin on IntersectionObserver** — start loading 200px before viewport entry
10. **Audit with Coverage tab** — Chrome DevTools shows how much JS loads but never executes

## 8 Anti-Patterns

1. **Lazy loading LCP image** — loading="lazy" on hero image delays LCP by 200-500ms
2. **No loading indicator** — lazy component loads with blank space; use skeleton
3. **Lazy loading above-fold content** — anything visible on initial viewport must load eagerly
4. **Import waterfalls** — lazy component A imports lazy component B imports C
5. **Loading all third-party scripts synchronously** — blocks main thread; defer everything
6. **No error boundaries on lazy components** — network failure crashes entire page
7. **Overly aggressive lazy loading** — lazy loading 5KB components adds unnecessary complexity
8. **Missing preload for predicted routes** — user hovers nav link but chunk not prefetched

## Enforcement Checklist

- [ ] All route components use dynamic imports (React.lazy or equivalent)
- [ ] Below-fold images have loading="lazy" attribute
- [ ] LCP image confirmed NOT lazy-loaded (loading="eager" + fetchpriority="high")
- [ ] Third-party scripts deferred to idle or interaction trigger
- [ ] Heavy embeds use facade pattern (YouTube, Maps, social)
- [ ] Lazy components wrapped in Suspense with skeleton fallback
- [ ] Error boundaries around all lazy-loaded sections
- [ ] Hover-preload implemented for primary navigation links
