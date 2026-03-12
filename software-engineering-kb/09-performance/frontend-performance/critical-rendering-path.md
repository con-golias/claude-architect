# Critical Rendering Path — Performance Engineering

> **Domain:** Frontend Performance > Rendering Pipeline Optimization
> **Importance:** CRITICAL
> **Cross-ref:** 05-frontend/web/fundamentals/browser-rendering-pipeline.md (pipeline internals)

> **Directive:** When diagnosing slow First Contentful Paint, render-blocking resources, or white-screen time, consult this guide. Focus on measuring and optimizing the critical rendering path — the minimum set of resources required for first render. See 05-frontend for layout/paint/composite internals.

---

## 1. Critical Rendering Path Pipeline

```
BROWSER RENDERING SEQUENCE:
  Navigation → DNS → TCP → TLS → TTFB → HTML Parsing begins
  │
  ├── HTML Parser builds DOM
  │   ├── Encounters <link rel="stylesheet"> → BLOCKS rendering
  │   ├── Encounters <script> (no defer/async) → BLOCKS parsing + rendering
  │   ├── Encounters <script defer> → Downloads parallel, executes after parse
  │   └── Encounters <script async> → Downloads parallel, executes immediately
  │
  ├── CSS Parser builds CSSOM (RENDER-BLOCKING by default)
  │
  ├── DOM + CSSOM → Render Tree (only visible elements)
  │
  ├── Layout → Geometry calculation (positions, dimensions)
  │
  ├── Paint → Pixel data for each layer
  │
  └── Composite → GPU layer assembly → PIXELS ON SCREEN (FCP)

CRITICAL PATH LENGTH = Number of round trips to get first render
GOAL: Minimize critical resources, bytes, and round trips
```

## 2. Identify Render-Blocking Resources

```typescript
// audit-blocking-resources.ts — Detect render-blocking resources via PerformanceObserver
function auditRenderBlockingResources(): void {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  if (!fcp) return;

  const blocking = entries.filter(e => {
    const isCSS = e.initiatorType === 'css' || e.name.endsWith('.css');
    const isScript = e.initiatorType === 'script';
    const loadedBeforeFCP = e.responseEnd <= fcp.startTime;
    const startedBeforeFCP = e.startTime < fcp.startTime;
    return startedBeforeFCP && (isCSS || isScript);
  });

  console.table(blocking.map(e => ({
    url: new URL(e.name).pathname,
    type: e.initiatorType,
    duration: Math.round(e.duration),
    size: e.transferSize,
    blockedFor: Math.round(fcp.startTime - e.startTime),
  })));
}
```

```go
// crp_analyzer.go — Parse HTML to identify critical path resources
package crp

import (
	"golang.org/x/net/html"
	"io"
	"strings"
)

type BlockingResource struct {
	Type string // "css" | "script"
	URL  string
	Hint string // recommendation
}

func FindBlockingResources(r io.Reader) []BlockingResource {
	doc, err := html.Parse(r)
	if err != nil {
		return nil
	}
	var resources []BlockingResource
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "link":
				if getAttr(n, "rel") == "stylesheet" && getAttr(n, "media") != "print" {
					resources = append(resources, BlockingResource{
						Type: "css", URL: getAttr(n, "href"),
						Hint: "Consider inlining critical CSS or using media query",
					})
				}
			case "script":
				src := getAttr(n, "src")
				if src != "" && getAttr(n, "defer") == "" && getAttr(n, "async") == "" {
					resources = append(resources, BlockingResource{
						Type: "script", URL: src,
						Hint: "Add defer or async attribute",
					})
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return resources
}

func getAttr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if strings.EqualFold(a.Key, key) {
			return a.Val
		}
	}
	return ""
}
```

## 3. Critical CSS Extraction and Inlining

```typescript
// critical-css-pipeline.ts — Extract above-the-fold CSS at build time
// Uses 'critical' npm package (Penthouse under the hood)
import { generate } from 'critical';

async function extractCriticalCSS(htmlPath: string): Promise<string> {
  const { css } = await generate({
    src: htmlPath,
    width: 1300,
    height: 900,
    inline: false,     // Return CSS string, don't modify HTML
    minify: true,
    dimensions: [
      { width: 375, height: 667 },   // Mobile
      { width: 1300, height: 900 },  // Desktop
    ],
  });
  return css;
}

// Inline critical CSS, async-load the rest
function buildOptimizedHead(criticalCSS: string, fullCSSPath: string): string {
  return `
    <style>${criticalCSS}</style>
    <link rel="preload" href="${fullCSSPath}" as="style"
          onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="${fullCSSPath}"></noscript>
  `;
}
```

```python
# critical_css_validator.py — CI check: critical CSS must be under budget
import re
from pathlib import Path

MAX_CRITICAL_CSS_BYTES = 14_000  # Must fit in first TCP round trip (~14KB)

def validate_critical_css(html_path: str) -> dict:
    """Ensure inlined critical CSS fits in initial congestion window."""
    content = Path(html_path).read_text()
    style_blocks = re.findall(r'<style[^>]*>(.*?)</style>', content, re.DOTALL)
    total_bytes = sum(len(block.encode('utf-8')) for block in style_blocks)

    return {
        "path": html_path,
        "inline_css_bytes": total_bytes,
        "within_budget": total_bytes <= MAX_CRITICAL_CSS_BYTES,
        "budget": MAX_CRITICAL_CSS_BYTES,
        "note": "Critical CSS must fit in ~14KB (initial TCP congestion window)"
    }
```

## 4. FCP Optimization Strategies

```
FCP OPTIMIZATION WATERFALL:

1. REDUCE SERVER RESPONSE TIME (TTFB)
   Target: < 200ms (origin), < 100ms (CDN edge)
   ├── Edge caching (CDN)
   ├── Stale-while-revalidate
   └── Streaming HTML (chunked transfer encoding)

2. ELIMINATE RENDER-BLOCKING RESOURCES
   ├── Inline critical CSS (< 14KB)
   ├── Defer all non-critical CSS: media="print" onload trick
   ├── defer/async ALL scripts in <head>
   └── Remove unused CSS (PurgeCSS/UnCSS)

3. REDUCE CRITICAL PATH DEPTH
   ├── Avoid CSS @import (creates sequential requests)
   ├── Preconnect to critical origins
   ├── Preload critical fonts: <link rel="preload" as="font" crossorigin>
   └── Use HTTP/2 push or 103 Early Hints

4. MINIMIZE CRITICAL BYTES
   ├── Compress HTML/CSS/JS (Brotli > gzip)
   ├── Minify all text resources
   ├── Remove unused CSS (typically 60-90% unused)
   └── Critical CSS + async load remainder
```

## 5. Measuring Critical Path Metrics

```typescript
// measure-crp.ts — Capture all critical path timings
interface CRPMetrics {
  ttfb: number;
  domInteractive: number;
  domContentLoaded: number;
  firstPaint: number;
  fcp: number;
  criticalResources: number;
  criticalBytes: number;
  criticalPathLength: number;
}

function measureCRP(): CRPMetrics {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paintEntries = performance.getEntriesByType('paint');
  const fp = paintEntries.find(e => e.name === 'first-paint');
  const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const criticalResources = resources.filter(r =>
    r.renderBlockingStatus === 'blocking' ||
    (r.initiatorType === 'css' && r.startTime < (fcp?.startTime ?? Infinity))
  );

  return {
    ttfb: nav.responseStart - nav.requestStart,
    domInteractive: nav.domInteractive - nav.startTime,
    domContentLoaded: nav.domContentLoadedEventStart - nav.startTime,
    firstPaint: fp?.startTime ?? 0,
    fcp: fcp?.startTime ?? 0,
    criticalResources: criticalResources.length,
    criticalBytes: criticalResources.reduce((sum, r) => sum + r.transferSize, 0),
    criticalPathLength: Math.ceil(criticalResources.reduce(
      (sum, r) => sum + r.transferSize, 0) / 14_000), // TCP round trips
  };
}
```

## 6. Script Loading Strategies

```html
<!-- BLOCKING: Stops HTML parsing, delays rendering -->
<script src="app.js"></script>

<!-- ASYNC: Downloads in parallel, executes ASAP (blocks parsing when executing) -->
<!-- Use for: analytics, ads, independent widgets -->
<script async src="analytics.js"></script>

<!-- DEFER: Downloads in parallel, executes AFTER HTML parsing, BEFORE DOMContentLoaded -->
<!-- Use for: app code that depends on DOM -->
<script defer src="app.js"></script>

<!-- MODULE: Deferred by default, strict mode -->
<script type="module" src="app.mjs"></script>

<!-- OPTIMAL loading order in <head>: -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<style>/* critical CSS inlined */</style>
<link rel="preload" href="/css/main.css" as="style">
<link rel="stylesheet" href="/css/main.css" media="print" onload="this.media='all'">
<script defer src="/js/app.js"></script>
```

## 7. Preload Scanner Optimization

```
THE PRELOAD SCANNER — Browser's second HTML parser:
  Runs AHEAD of main parser while it's blocked on scripts
  Discovers resources early → starts downloads in parallel

  DO:
  ├── Put <link rel="stylesheet"> in <head> (scanner finds them)
  ├── Use standard src/href attributes (scanner can parse them)
  └── Preload resources that scanner cannot discover:
      ├── CSS background-image URLs
      ├── Fonts referenced in CSS @font-face
      └── JS-initiated fetches (dynamic imports)

  DON'T:
  ├── Use JS to inject <link> tags (scanner misses them)
  ├── Lazy-load above-the-fold images (delays LCP)
  └── Use CSS @import (creates chained requests scanner can't parallelize)
```

---

## 10 Best Practices

1. **Inline critical CSS under 14KB** — fits in first TCP congestion window for instant render
2. **Defer all scripts** — no parser-blocking `<script>` in `<head>` without defer/async
3. **Eliminate CSS @import** — each import adds a sequential round trip; use `<link>` instead
4. **Preload LCP resources** — hero image or font must start loading in first HTML chunk
5. **Stream HTML** — use chunked transfer encoding to send `<head>` before body is ready
6. **Remove unused CSS** — average site ships 60-90% unused CSS; purge it at build time
7. **Minimize critical path depth** — reduce sequential round trips to 2-3 maximum
8. **Compress with Brotli** — 15-20% smaller than gzip for text resources
9. **Measure FCP and TTFB together** — FCP = TTFB + render-blocking resource time
10. **Audit with Coverage tab** — Chrome DevTools Coverage shows unused CSS/JS per page

## 8 Anti-Patterns

1. **CSS @import chains** — `a.css` imports `b.css` imports `c.css` = 3 sequential round trips
2. **Render-blocking third-party scripts** — sync `<script>` to external CDN blocks entire render
3. **Inlining ALL CSS** — defeats caching; only inline above-the-fold critical CSS
4. **Preloading everything** — too many preloads compete for bandwidth; preload only critical resources
5. **JS-injected stylesheets** — invisible to preload scanner; delays CSS discovery
6. **No font preloading** — fonts discovered only after CSSOM built; 200-500ms wasted
7. **Ignoring TCP slow start** — first response should be < 14KB; server renders above this waste time
8. **Document.write() in scripts** — forces re-parse, destroys preload scanner optimization

## Enforcement Checklist

- [ ] Zero render-blocking scripts in `<head>` (all use defer or async)
- [ ] Critical CSS inlined and under 14KB
- [ ] LCP image or font preloaded with `fetchpriority="high"`
- [ ] No CSS `@import` in production stylesheets
- [ ] FCP budget < 1.8s enforced in CI
- [ ] Unused CSS removed (Coverage tab audit < 20% unused)
- [ ] Brotli compression enabled on all text resources
- [ ] Preload scanner validated (no JS-injected critical resources)
