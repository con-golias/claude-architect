# Resource Hints — Performance Engineering

> **Domain:** Frontend Performance > Resource Loading Prioritization
> **Importance:** HIGH

> **Directive:** When optimizing resource discovery, preloading critical assets, prefetching future navigation resources, or configuring fetch priority, consult this guide. Resource hints tell the browser what to load, when, and at what priority.

---

## 1. Resource Hint Taxonomy

```
RESOURCE HINTS — FROM LIGHTEST TO HEAVIEST:

  dns-prefetch          Resolve DNS only (~5ms)
  ├── Cost: 1 DNS lookup
  ├── Use: Third-party domains you will need soon
  └── <link rel="dns-prefetch" href="https://api.example.com">

  preconnect            DNS + TCP + TLS handshake (~100ms saved)
  ├── Cost: Full connection setup
  ├── Use: Critical third-party origins (fonts, API, CDN)
  └── <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  preload               Download specific resource NOW (~high priority)
  ├── Cost: Full download + connection
  ├── Use: Critical resources browser discovers late (fonts, hero image)
  └── <link rel="preload" href="/font.woff2" as="font" crossorigin>

  prefetch              Download resource for FUTURE navigation (~low priority)
  ├── Cost: Full download at idle priority
  ├── Use: Next-page resources (route chunks, data)
  └── <link rel="prefetch" href="/dashboard.js">

  modulepreload         Preload + parse + compile JS module
  ├── Cost: Download + parse + compile
  ├── Use: Critical JS modules (does more than preload)
  └── <link rel="modulepreload" href="/app.mjs">

  prerender             Full page prerender (Speculation Rules)
  ├── Cost: Entire page load in background
  ├── Use: Highly likely next navigation
  └── Via Speculation Rules API (replaces old prerender)

PRIORITY ORDER: preload > modulepreload > prefetch
```

## 2. Preconnect — Connection Warmup

```html
<!-- Preconnect to CRITICAL third-party origins (max 2-4) -->
<head>
  <!-- Font CDN — always preconnect if using Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- API server (if different origin) -->
  <link rel="preconnect" href="https://api.example.com">

  <!-- Image CDN -->
  <link rel="preconnect" href="https://images.example.com">

  <!-- For non-critical origins, use dns-prefetch instead -->
  <link rel="dns-prefetch" href="https://analytics.example.com">
  <link rel="dns-prefetch" href="https://cdn.tracking.com">
</head>

<!-- RULE: preconnect max 4 origins. Beyond that, use dns-prefetch.
     Each preconnect holds a TCP connection open — too many wastes resources. -->
```

## 3. Preload — Critical Resource Discovery

```html
<!-- PRELOAD: Force early download of late-discovered critical resources -->
<head>
  <!-- Hero image — LCP element discovered after CSS/JS parsed -->
  <link rel="preload" as="image" href="/hero.webp"
        imagesrcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
        imagesizes="100vw"
        fetchpriority="high">

  <!-- Critical font — not discovered until @font-face in CSS evaluated -->
  <link rel="preload" as="font" href="/fonts/inter-latin.woff2"
        type="font/woff2" crossorigin>

  <!-- Critical CSS chunk loaded by JS framework -->
  <link rel="preload" as="style" href="/critical-above-fold.css">

  <!-- Critical data fetch -->
  <link rel="preload" as="fetch" href="/api/initial-data"
        crossorigin>
</head>
```

```typescript
// preload-audit.ts — Detect resources that should be preloaded
function findPreloadCandidates(): Array<{ url: string; reason: string }> {
  const candidates: Array<{ url: string; reason: string }> = [];
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  if (!fcp) return candidates;

  for (const res of resources) {
    // Late-discovered resources that loaded before FCP
    if (res.responseEnd < fcp.startTime && res.startTime > 100) {
      const discoveryDelay = res.startTime - (performance.getEntriesByType(
        'navigation')[0] as PerformanceNavigationTiming).responseEnd;

      if (discoveryDelay > 200) {
        candidates.push({
          url: res.name,
          reason: `Discovered ${Math.round(discoveryDelay)}ms after HTML — preload would save ${Math.round(discoveryDelay)}ms`,
        });
      }
    }
  }
  return candidates;
}
```

## 4. fetchpriority Attribute

```html
<!-- fetchpriority: Override browser's default resource priority -->

<!-- HIGH: LCP image — most important visual resource -->
<img src="hero.webp" fetchpriority="high" alt="Hero">

<!-- LOW: Below-fold images — don't compete with critical resources -->
<img src="footer-bg.webp" fetchpriority="low" loading="lazy" alt="">

<!-- HIGH: Critical API fetch -->
<script>
  fetch('/api/user', { priority: 'high' })
    .then(r => r.json());
</script>

<!-- LOW: Prefetched analytics script -->
<script src="analytics.js" fetchpriority="low" async></script>

<!-- DEFAULT BROWSER PRIORITIES:
  ┌────────────────────┬──────────────────────┐
  │ Resource           │ Default Priority     │
  ├────────────────────┼──────────────────────┤
  │ Main CSS           │ Highest              │
  │ Preloaded font     │ High                 │
  │ <script> in head   │ High                 │
  │ <img> in viewport  │ High (after layout)  │
  │ <img> out viewport │ Low                  │
  │ async/defer script │ Low                  │
  │ Prefetch           │ Lowest               │
  └────────────────────┴──────────────────────┘
-->
```

## 5. Prefetch — Future Navigation

```html
<!-- Prefetch resources for likely next navigation -->
<!-- Downloaded at LOW priority during idle time -->

<!-- Route chunk for likely next page -->
<link rel="prefetch" href="/static/js/dashboard-chunk.js">

<!-- Data for next page -->
<link rel="prefetch" href="/api/dashboard/summary" as="fetch" crossorigin>

<!-- modulepreload: Download + parse + compile JS module -->
<!-- Better than prefetch for JS — module is ready to execute -->
<link rel="modulepreload" href="/modules/dashboard.mjs">
```

```typescript
// predictive-prefetch.ts — Prefetch based on user behavior
class PredictivePrefetch {
  private prefetched = new Set<string>();

  constructor() {
    this.observeNavigation();
  }

  private observeNavigation(): void {
    // Prefetch on hover (high confidence)
    document.addEventListener('mouseover', (e) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement;
      if (!link || !link.href.startsWith(location.origin)) return;
      this.prefetchRoute(link.pathname);
    }, { passive: true });

    // Prefetch on viewport entry (medium confidence)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement;
          this.prefetchRoute(link.pathname);
          observer.unobserve(link);
        }
      });
    }, { rootMargin: '200px' });

    document.querySelectorAll('a[data-prefetch]').forEach(link => {
      observer.observe(link);
    });
  }

  private prefetchRoute(path: string): void {
    if (this.prefetched.has(path)) return;
    this.prefetched.add(path);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = path;
    document.head.appendChild(link);
  }
}
```

## 6. Speculation Rules API

```html
<!-- Speculation Rules: Modern replacement for <link rel="prerender"> -->
<!-- Prerenders or prefetches pages based on rules -->
<script type="speculationrules">
{
  "prerender": [
    {
      "where": {
        "and": [
          { "href_matches": "/*" },
          { "not": { "href_matches": "/logout" } },
          { "not": { "href_matches": "/api/*" } },
          { "not": { "selector_matches": ".no-prerender" } }
        ]
      },
      "eagerness": "moderate"
    }
  ],
  "prefetch": [
    {
      "urls": ["/products", "/about"],
      "eagerness": "eager"
    }
  ]
}
</script>

<!--
EAGERNESS LEVELS:
  immediate — Prerender now (use for very high-confidence links)
  eager     — Prerender soon (link visible)
  moderate  — Prerender on hover (200ms delay)
  conservative — Prerender on mousedown/touchstart (highest confidence)

Chrome DevTools → Application → Speculative loads (debug tab)
-->
```

## 7. Early Hints (103)

```
HTTP 103 EARLY HINTS — Server sends hints BEFORE full response:

  Client request:
  GET /page HTTP/2

  Server responds immediately (before processing):
  HTTP/2 103 Early Hints
  Link: </style.css>; rel=preload; as=style
  Link: </font.woff2>; rel=preload; as=font; crossorigin
  Link: <https://cdn.example.com>; rel=preconnect

  ... server processes request (200-500ms) ...

  HTTP/2 200 OK
  <html>...

  BENEFIT: Browser starts downloading resources DURING server processing
  SAVINGS: 200-500ms (server think time) for critical resources
```

```go
// early_hints.go — Send 103 Early Hints in Go
package main

import (
	"net/http"
)

func pageHandler(w http.ResponseWriter, r *http.Request) {
	// Send Early Hints before processing
	// Go 1.20+ supports this via http.ResponseController
	rc := http.NewResponseController(w)

	w.Header().Add("Link", "</css/main.css>; rel=preload; as=style")
	w.Header().Add("Link", "</fonts/inter.woff2>; rel=preload; as=font; crossorigin")
	w.Header().Add("Link", "<https://cdn.example.com>; rel=preconnect")

	if err := rc.Flush(); err == nil {
		// Early Hints sent — browser starts downloading
	}

	// Now do expensive processing
	data := fetchDataFromDB(r)
	renderTemplate(w, data)
}
```

---

## 10 Best Practices

1. **Preconnect to 2-4 critical origins** — fonts, API, CDN; saves 100-300ms per origin
2. **Preload LCP resource** — hero image or font preloaded with fetchpriority="high"
3. **Use fetchpriority on images** — high for LCP, low for below-fold; guides browser priority
4. **Prefetch predicted routes** — hover-triggered prefetch for likely navigation targets
5. **modulepreload for critical modules** — download + parse + compile (better than preload for JS)
6. **Speculation Rules for top pages** — prerender high-traffic routes for instant navigation
7. **Early Hints from server** — send 103 to start preloads during server processing time
8. **dns-prefetch for non-critical origins** — lightweight; no connection cost
9. **Limit preloads to 3-5** — too many preloads compete for bandwidth; prioritize ruthlessly
10. **Audit with DevTools Network** — check Priority column; verify hints work as expected

## 8 Anti-Patterns

1. **Preloading unused resources** — preloaded but never consumed = wasted bandwidth + console warning
2. **Too many preconnects** — > 6 connections compete; switch low-priority ones to dns-prefetch
3. **Preloading everything** — negates priority benefit; browser cannot prioritize if all are "high"
4. **Missing crossorigin on font preload** — causes double download (preload + @font-face)
5. **Prefetching on slow connections** — wastes metered data; check `navigator.connection.saveData`
6. **Prerendering expensive pages** — prerendering a page with heavy API calls wastes server resources
7. **Wrong "as" attribute on preload** — mismatched `as` value means browser downloads twice
8. **No type attribute on font preload** — browser downloads unsupported format then discards it

## Enforcement Checklist

- [ ] Preconnect configured for all critical third-party origins (max 4)
- [ ] LCP resource preloaded with correct as/type/crossorigin attributes
- [ ] fetchpriority="high" on LCP image, "low" on below-fold images
- [ ] Prefetch implemented for top 3-5 predicted navigation targets
- [ ] Speculation Rules configured for high-traffic internal pages
- [ ] Early Hints (103) enabled on server for top landing pages
- [ ] No unused preloads (verify in DevTools console for warnings)
- [ ] Save-data and slow-connection detection gates prefetching
