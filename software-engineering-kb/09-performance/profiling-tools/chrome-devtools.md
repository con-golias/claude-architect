# Chrome DevTools — Performance Profiling

> **Domain:** Profiling Tools > Browser DevTools
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/frontend-performance/core-web-vitals.md, 09-performance/profiling-tools/lighthouse.md

> **Directive:** Use Chrome DevTools as the primary browser-side profiling tool for diagnosing rendering, scripting, memory, and network bottlenecks. Master the Performance, Memory, Coverage, Network, and Rendering panels. Every frontend performance investigation starts here.

---

## 1. Performance Panel

### Recording a Profile

```
Steps:
1. Open DevTools (F12) → Performance tab
2. Click gear icon → set CPU throttle (4x/6x slowdown) and Network (Slow 3G)
3. Press Ctrl+Shift+E (start recording + reload)
4. Interact with the page, then Stop recording
5. Analyze the flame chart, summary, bottom-up, and call tree
```

### Flame Chart Interpretation

```
FLAME CHART STRUCTURE:
┌─────────────────────────────────────────────┐
│ Main Thread                                  │
│ ┌──────────────────────────────────────┐     │
│ │ Task (> 50ms = Long Task, red corner)│     │
│ │ ┌─────────────┐ ┌────────────────┐   │     │
│ │ │ parseHTML   │ │ evaluateScript │   │     │
│ │ └─────────────┘ │ ┌────────────┐ │   │     │
│ │                 │ │ compile    │ │   │     │
│ │                 │ └────────────┘ │   │     │
│ │                 └────────────────┘   │     │
│ └──────────────────────────────────────┘     │
│                                              │
│ COLOR KEY:                                   │
│  Yellow = Scripting    Purple = Rendering     │
│  Green = Painting      Gray = System/Idle     │
│  Blue = Loading/Parse                         │
└─────────────────────────────────────────────┘
```

### Summary, Bottom-Up, and Call Tree Tabs

```
SUMMARY TAB: Pie chart breakdown of time by category
  Scripting: 1200ms | Rendering: 300ms | Painting: 50ms | System: 100ms

BOTTOM-UP TAB: Most expensive functions first (leaf nodes aggregated)
  Self Time | Total Time | Function
  450ms     | 450ms      | GC (Minor)
  320ms     | 800ms      | calculateLayout()
  → Use this to find WHERE time is spent

CALL TREE TAB: Root-to-leaf execution path
  evaluateScript → initApp → renderDashboard → calculateLayout
  → Use this to find WHY time is spent (call chain)
```

### Identify Long Tasks

```javascript
// Programmatic long task detection (complements DevTools)
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.warn('Long Task detected:', {
        duration: `${entry.duration.toFixed(1)}ms`,
        startTime: `${entry.startTime.toFixed(1)}ms`,
        name: entry.name,
      });
    }
  }
});
observer.observe({ type: 'longtask', buffered: true });
```

## 2. Memory Panel

### Heap Snapshot

```
WORKFLOW: Take Snapshot → Force GC → Take Snapshot → Compare
1. Memory tab → "Take heap snapshot"
2. Click trash can icon (Force GC)
3. Take second snapshot
4. Select Snapshot 2 → "Comparison" view vs Snapshot 1
5. Sort by "Size Delta" → objects growing = potential leak

KEY VIEWS:
  Summary:    Group by constructor → find large object counts
  Comparison: Delta between snapshots → find leaks
  Containment: Object ownership tree → find retainers
  Statistics:  Pie chart of memory by type
```

### Allocation Timeline

```
STEPS:
1. Memory tab → "Allocation instrumentation on timeline"
2. Start recording → perform suspect interactions
3. Stop → blue bars = allocations, gray = freed
4. Select a blue bar → see objects allocated at that moment
5. Persistent blue bars (not freed) = memory leak candidates

COMMON LEAK PATTERNS:
  - Event listeners not removed on unmount
  - Closures capturing large scopes
  - Detached DOM trees (removed from DOM but referenced in JS)
  - Growing Maps/Sets never cleared
  - setInterval without clearInterval
```

### Allocation Sampling

```
USE CASE: Lightweight profiling for production-like analysis
1. Memory tab → "Allocation sampling"
2. Record for 30-60 seconds of typical usage
3. Stop → view allocation call tree
4. Sort by "Self Size" → heaviest allocators
5. Drill into call stacks to find allocation-heavy code paths
```

## 3. Coverage Tab

```
WORKFLOW:
1. Ctrl+Shift+P → "Show Coverage"
2. Click reload button in Coverage panel
3. Interact with the page (click buttons, navigate)
4. Analyze results:

FILE                      TOTAL      UNUSED     USAGE
bundle.js                 450 KB     280 KB     37.8% used
styles.css                120 KB      85 KB     29.2% used
vendor.js                 320 KB     290 KB      9.4% used  ← CODE SPLIT THIS

RED = unused code (on initial load)
BLUE/GREEN = executed code

ACTION ITEMS:
  - JS > 60% unused → implement code splitting / dynamic import()
  - CSS > 70% unused → extract critical CSS, defer rest
  - Vendor bundles with < 20% usage → tree-shake or replace
```

```javascript
// Code splitting based on Coverage findings
// BEFORE: import { Chart } from 'chart.js';  // 200KB unused on most pages
// AFTER:
const Chart = await import(/* webpackChunkName: "chart" */ 'chart.js');

// Route-based splitting in React
const Dashboard = React.lazy(() => import('./Dashboard'));
```

## 4. Network Panel

### Waterfall Analysis

```
WATERFALL COLUMNS:
  Stalled:      Time waiting in queue (connection limit or disk cache)
  DNS Lookup:   Domain resolution time
  Initial Conn: TCP + TLS handshake
  SSL:          TLS negotiation (subset of Initial Connection)
  Request Sent: Time to send request (negligible)
  Waiting TTFB: Server processing time (CRITICAL)
  Content DL:   Response download time

CRITICAL PATH ANALYSIS:
  1. Filter by "Initiator" to see request chains
  2. Hold Shift + hover over request → see dependencies (green=initiator, red=dependents)
  3. Right-click waterfall → "Show overview" for connection view
  4. Sort by "Waterfall" column to see blocking chains
```

### Network Throttling Profiles

```
BUILT-IN PROFILES:
  Slow 3G:   RTT 2000ms, Download 500 Kbps, Upload 500 Kbps
  Fast 3G:   RTT 562ms,  Download 1.6 Mbps, Upload 750 Kbps
  Offline:   No connectivity

CUSTOM PROFILE (realistic emerging market):
  Name: "India 4G"
  Download: 4 Mbps
  Upload: 3 Mbps
  Latency: 100ms

USAGE: Network tab → throttle dropdown → Add custom profile
```

### Request Blocking

```
WORKFLOW: Test impact of removing third-party scripts
1. Network tab → right-click request → "Block request URL"
2. Or: Ctrl+Shift+P → "Show Network request blocking"
3. Add patterns: *.facebook.net, *.google-analytics.com
4. Reload → measure performance difference
5. Quantifies third-party script cost
```

## 5. Performance Insights Panel

```
AUTOMATED ANALYSIS (Chrome 102+):
  - Identifies render-blocking requests automatically
  - Highlights LCP element and its load chain
  - Flags layout shifts with culprit elements
  - Shows long tasks with source attribution
  - Provides actionable fix suggestions

USAGE:
1. Performance Insights tab (next to Performance tab)
2. Click "Measure page load" or record interaction
3. Review "Insights" sidebar for prioritized issues
4. Click each insight → jumps to relevant timeline section

KEY INSIGHTS DETECTED:
  - Render-blocking CSS/JS
  - LCP discovery delay (not in HTML, loaded via JS)
  - Layout shift sources
  - Long tasks blocking interaction
  - Font loading delays
```

## 6. Rendering Panel

```
ACCESS: Ctrl+Shift+P → "Show Rendering"

TOOLS:
  Paint flashing:       Green overlay on repainted areas
                        → Excessive repaints = animation jank
  Layout shift regions: Blue overlay on shifted elements
                        → Identify CLS contributors
  FPS meter:            Real-time frame rate overlay
                        → Target 60fps (16.6ms/frame)
  Layer borders:        Orange/olive borders on composited layers
                        → Too many layers = memory overhead
  Scrolling perf:       Highlight non-fast scrollable regions
                        → Passive event listeners needed

FRAME RENDERING PANEL USAGE:
  Frame Rendering Stats (FPS meter):
    Shows: FPS | GPU memory | frames dropped
    Green bar = 60fps | Yellow = 30-59fps | Red = < 30fps
```

```css
/* Fix paint flashing: promote to compositor layer */
.animated-element {
  will-change: transform; /* only for known animated elements */
  contain: layout style paint; /* limit repaint scope */
}

/* Fix layout shifts: reserve space */
.dynamic-content {
  min-height: 200px;       /* prevent collapse before load */
  aspect-ratio: 16 / 9;   /* maintain ratio */
  contain: layout;
}
```

## 7. Console Performance Utilities

```javascript
// Quick performance marks in Console
performance.mark('start-render');
// ... interaction ...
performance.mark('end-render');
performance.measure('render-time', 'start-render', 'end-render');
console.table(performance.getEntriesByType('measure'));

// Monitor DOM node count (leak indicator)
setInterval(() => {
  console.log('DOM nodes:', document.querySelectorAll('*').length);
}, 2000);

// Monitor event listener count
getEventListeners(document); // DevTools Console API only

// Memory snapshot
console.memory; // {totalJSHeapSize, usedJSHeapSize, jsHeapSizeLimit}
```

## 8. DevTools Protocol (Automation)

```javascript
// Puppeteer: automated DevTools profiling in CI
const puppeteer = require('puppeteer');

async function profilePage(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Enable CDP tracing (same data as Performance panel)
  await page.tracing.start({ path: 'trace.json', screenshots: true });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.tracing.stop();

  // Collect coverage
  await page.coverage.startJSCoverage();
  await page.coverage.startCSSCoverage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  const [jsCov, cssCov] = await Promise.all([
    page.coverage.stopJSCoverage(),
    page.coverage.stopCSSCoverage(),
  ]);

  const jsUnused = jsCov.reduce((sum, e) => {
    const used = e.ranges.reduce((s, r) => s + r.end - r.start, 0);
    return sum + (e.text.length - used);
  }, 0);
  console.log(`Unused JS: ${(jsUnused / 1024).toFixed(1)} KB`);
  await browser.close();
}
```

---

## 10 Best Practices

1. **Always throttle CPU 4x and network to Fast 3G** -- test under constrained conditions, not developer hardware
2. **Record with screenshots enabled** -- correlate visual changes with flame chart events
3. **Use Incognito mode** -- extensions pollute profiles with noise
4. **Take heap snapshots in pairs** -- compare before/after to isolate leaks, not absolute sizes
5. **Check Coverage before code splitting** -- data-driven decisions on what to split
6. **Use request blocking to quantify third-party cost** -- block analytics/ads scripts and measure delta
7. **Profile real user flows, not just page load** -- interactions reveal INP bottlenecks
8. **Enable paint flashing during scroll testing** -- unexpected repaints cause jank
9. **Automate profiling with Puppeteer/CDP** -- integrate trace collection into CI pipelines
10. **Use Performance Insights for quick triage** -- automated analysis before manual flame chart diving

## 8 Anti-Patterns

1. **Profiling without throttling** -- developer machines mask real-world performance issues
2. **Reading only the Summary tab** -- pie chart hides specific function-level bottlenecks
3. **Taking single heap snapshots** -- absolute heap size is meaningless without comparison
4. **Ignoring detached DOM nodes** -- filter heap snapshot by "Detached" to find DOM leaks
5. **Skipping Coverage analysis** -- shipping 300KB of unused JS because "it might be needed"
6. **Profiling with extensions enabled** -- React DevTools alone adds 50-100ms to interactions
7. **Only profiling page load** -- most INP issues occur during post-load interactions
8. **Not using layers panel for animation jank** -- missing compositor-only animation opportunities

## Enforcement Checklist

- [ ] Performance profiles recorded with CPU 4x throttle and Fast 3G
- [ ] Flame chart analyzed for long tasks > 50ms on critical paths
- [ ] Heap snapshot comparison done for pages with suspected memory leaks
- [ ] Coverage analysis run; JS files > 50% unused flagged for code splitting
- [ ] Network waterfall reviewed for blocking chains and slow TTFB
- [ ] Paint flashing verified during scroll and animation interactions
- [ ] Layout shift regions checked against CLS budget (< 0.1)
- [ ] Automated trace collection integrated into CI with Puppeteer
