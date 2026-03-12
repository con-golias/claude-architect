# Real User Monitoring — Field Performance Measurement

> **Domain:** Profiling Tools > Real User Monitoring (RUM)
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/frontend-performance/core-web-vitals.md, 09-performance/profiling-tools/lighthouse.md

> **Directive:** Deploy RUM to capture real-world performance as experienced by actual users. Use the Performance API for custom measurement. Segment data by device, geography, and connection type. RUM is the ground truth for performance -- lab tools are approximations. Every production web application must have RUM instrumentation.

---

## 1. Performance API — Navigation Timing

```javascript
// Navigation Timing Level 2 — full page load breakdown
const nav = performance.getEntriesByType('navigation')[0];
const metrics = {
  dns:              nav.domainLookupEnd - nav.domainLookupStart,
  connection:       nav.connectEnd - nav.connectStart,
  tls:              nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
  ttfb:             nav.responseStart - nav.requestStart,
  download:         nav.responseEnd - nav.responseStart,
  domParsing:       nav.domInteractive - nav.responseEnd,
  domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
  totalTime:        nav.loadEventEnd - nav.startTime,
};
// Waterfall: redirect → DNS → TCP → TLS → Request → Response (TTFB)
//            → DOM Processing → DOMContentLoaded → Load
```

## 2. Resource Timing API

```javascript
// Analyze all resource load performance
const resources = performance.getEntriesByType('resource');

// Find slow resources (> 1s)
const slowResources = resources
  .filter(r => r.duration > 1000)
  .map(r => ({
    name: r.name.split('/').pop(),
    duration: `${r.duration.toFixed(0)}ms`,
    size: `${(r.transferSize / 1024).toFixed(1)}KB`,
    type: r.initiatorType,
    cached: r.transferSize === 0 && r.decodedBodySize > 0, // cache hit
  }));

// Detect render-blocking resources
const blocking = resources.filter(r => r.renderBlockingStatus === 'blocking');
```

## 3. User Timing API — Custom Marks and Measures

```javascript
// Mark critical application milestones
performance.mark('app-init-start');
await initializeApp();
performance.mark('app-init-end');
performance.measure('app-initialization', 'app-init-start', 'app-init-end');

// Measure API call duration
performance.mark('api-fetch-start');
const data = await fetch('/api/orders').then(r => r.json());
performance.mark('api-fetch-end');
performance.measure('api-orders-fetch', 'api-fetch-start', 'api-fetch-end');

// Measures with metadata (detail parameter)
performance.measure('checkout-step', {
  start: 'checkout-start', end: 'checkout-end',
  detail: { step: 'payment', method: 'credit_card', itemCount: 3 },
});

// Read all custom measures
performance.getEntriesByType('measure').forEach(m =>
  console.log(`${m.name}: ${m.duration.toFixed(1)}ms`)
);
```

## 4. PerformanceObserver API

```javascript
// Observe performance entries asynchronously (non-blocking)
// LCP observation
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.startTime, 'Element:', lastEntry.element);
}).observe({ type: 'largest-contentful-paint', buffered: true });

// Long Task observation (> 50ms main thread blocks)
new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    sendToRUM({
      type: 'long-task',
      duration: entry.duration,
      startTime: entry.startTime,
      attribution: entry.attribution?.[0]?.containerName,
    });
  });
}).observe({ type: 'longtask', buffered: true });

// Layout Shift observation (CLS)
let clsValue = 0;
new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    if (!entry.hadRecentInput) { // Exclude user-initiated shifts
      clsValue += entry.value;
      entry.sources?.forEach(source => {
        console.log('Shifted element:', source.node);
      });
    }
  });
}).observe({ type: 'layout-shift', buffered: true });

// INP observation (Interaction to Next Paint)
new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    if (entry.interactionId) {
      sendToRUM({
        type: 'interaction',
        duration: entry.duration,
        name: entry.name,
        target: entry.target?.tagName,
        inputDelay: entry.processingStart - entry.startTime,
        processingTime: entry.processingEnd - entry.processingStart,
        presentationDelay: entry.startTime + entry.duration - entry.processingEnd,
      });
    }
  });
}).observe({ type: 'event', buffered: true, durationThreshold: 16 });

// Resource loading observation
new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    if (entry.duration > 2000) {
      sendToRUM({ type: 'slow-resource', url: entry.name, duration: entry.duration });
    }
  });
}).observe({ type: 'resource', buffered: true });
```

## 5. RUM Implementation — Complete Collection Script

```javascript
// rum-collector.js — Production RUM collection with batching
class RUMCollector {
  constructor(endpoint, options = {}) {
    this.endpoint = endpoint;
    this.buffer = [];
    this.flushInterval = options.flushInterval || 5000;
    this.sampleRate = options.sampleRate || 1.0;
    this.sessionId = this._generateSessionId();

    if (Math.random() > this.sampleRate) return; // Sampling gate

    this._collectNavigationTiming();
    this._collectWebVitals();
    this._collectLongTasks();
    this._collectErrors();
    this._startFlushLoop();
  }

  _collectNavigationTiming() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) return;
        this._push('navigation', {
          ttfb: nav.responseStart - nav.requestStart,
          domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
          load: nav.loadEventEnd - nav.startTime,
          transferSize: nav.transferSize,
          type: nav.type, // navigate, reload, back_forward, prerender
        });
      }, 0);
    });
  }

  _collectWebVitals() {
    import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const report = (metric) => this._push('vital', {
        name: metric.name, value: metric.value, rating: metric.rating,
      });
      onLCP(report); onINP(report); onCLS(report);
      onFCP(report); onTTFB(report);
    });
  }

  _collectLongTasks() {
    new PerformanceObserver((list) => {
      list.getEntries().forEach(e => {
        this._push('longtask', { duration: e.duration, startTime: e.startTime });
      });
    }).observe({ type: 'longtask', buffered: true });
  }

  _collectErrors() {
    window.addEventListener('error', (e) => {
      this._push('error', { message: e.message, filename: e.filename, line: e.lineno });
    });
  }

  _push(type, data) {
    this.buffer.push({
      type, ...data,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      url: location.pathname,
      userAgent: navigator.userAgent,
      connection: navigator.connection?.effectiveType || 'unknown',
      deviceMemory: navigator.deviceMemory || 'unknown',
    });
  }

  _startFlushLoop() {
    setInterval(() => this._flush(), this.flushInterval);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._flush();
    });
  }

  _flush() {
    if (this.buffer.length === 0) return;
    const payload = JSON.stringify(this.buffer);
    this.buffer = [];
    navigator.sendBeacon?.(this.endpoint, payload)
      || fetch(this.endpoint, { method: 'POST', body: payload, keepalive: true });
  }

  _generateSessionId() {
    return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  }
}

// Initialize: new RUMCollector('/api/rum', { sampleRate: 0.1 });
```

## 6. RUM Tools Comparison

```
┌──────────────────┬───────────┬───────────────────────────────────────┐
│ Tool             │ Pricing   │ Key Capabilities                      │
├──────────────────┼───────────┼───────────────────────────────────────┤
│ Datadog RUM      │ $$$$      │ Session replay, error tracking,       │
│                  │           │ full APM correlation, frustration      │
│                  │           │ signals                                │
├──────────────────┼───────────┼───────────────────────────────────────┤
│ Sentry Perf      │ $$        │ Error-first RUM, transaction tracing, │
│                  │           │ Web Vitals, release health             │
├──────────────────┼───────────┼───────────────────────────────────────┤
│ SpeedCurve       │ $$        │ Visual progress charts, perf budgets, │
│                  │           │ competitor benchmarking                │
├──────────────────┼───────────┼───────────────────────────────────────┤
│ Vercel Analytics │ $         │ Web Vitals, zero-config for Vercel,   │
│                  │           │ Real Experience Score                  │
├──────────────────┼───────────┼───────────────────────────────────────┤
│ web-vitals + DIY │ Free      │ Full control, send to any backend,    │
│                  │           │ no vendor lock-in                      │
└──────────────────┴───────────┴───────────────────────────────────────┘
```

## 7. Synthetic Monitoring vs RUM

```
┌──────────────────────┬──────────────────────┬────────────────────┐
│ Aspect               │ Synthetic Monitoring │ RUM                │
├──────────────────────┼──────────────────────┼────────────────────┤
│ Data source          │ Scripted bots        │ Real user sessions │
│ Coverage             │ Selected URLs/flows  │ All pages/users    │
│ Environment          │ Controlled           │ Wild (real devices)│
│ Availability check   │ YES (24/7)           │ Only when visited  │
│ Pre-launch testing   │ YES                  │ NO (needs traffic) │
│ Geographic accuracy  │ Simulated PoPs       │ True user location │
│ Device diversity     │ Limited              │ Complete           │
│ Third-party impact   │ Partial              │ Full               │
│ Debugging            │ Reproducible         │ Session-specific   │
│ Cost driver          │ Check frequency      │ Traffic volume     │
├──────────────────────┼──────────────────────┼────────────────────┤
│ USE BOTH:            │ Catch outages +      │ Measure real       │
│                      │ baseline regression  │ user experience    │
└──────────────────────┴──────────────────────┴────────────────────┘
```

## 8. Geographic and Device Segmentation

```sql
-- BigQuery/ClickHouse — analyze RUM data by segment
-- p75 LCP by country
SELECT
  country,
  APPROX_QUANTILES(lcp_ms, 100)[OFFSET(75)] AS p75_lcp,
  COUNT(*) AS samples
FROM rum_events
WHERE metric_name = 'LCP' AND date >= CURRENT_DATE - 28
GROUP BY country
ORDER BY samples DESC;

-- p75 by device category and connection type
SELECT
  device_category,    -- mobile, desktop, tablet
  connection_type,    -- 4g, 3g, wifi, offline
  APPROX_QUANTILES(lcp_ms, 100)[OFFSET(75)] AS p75_lcp,
  APPROX_QUANTILES(inp_ms, 100)[OFFSET(75)] AS p75_inp
FROM rum_events
WHERE date >= CURRENT_DATE - 7
GROUP BY device_category, connection_type
ORDER BY p75_lcp DESC;

-- Performance by page template (find worst pages)
SELECT
  page_template,
  APPROX_QUANTILES(lcp_ms, 100)[OFFSET(75)] AS p75_lcp,
  COUNTIF(lcp_ms > 2500) / COUNT(*) AS pct_poor_lcp
FROM rum_events
WHERE date >= CURRENT_DATE - 7
GROUP BY page_template
HAVING COUNT(*) > 100
ORDER BY p75_lcp DESC;
```

## 9. CrUX and Session Replay

```javascript
// Query CrUX API — Google's public RUM dataset (28-day p75, Chrome-only)
async function getCrUXData(origin, apiKey) {
  const resp = await fetch(
    `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`,
    { method: 'POST', body: JSON.stringify({
        origin, formFactor: 'PHONE',
        metrics: ['largest_contentful_paint', 'interaction_to_next_paint', 'cumulative_layout_shift'],
    })});
  return (await resp.json()).record.metrics;
}
// CrUX: 28-day rolling, p75, Chrome-only, min traffic threshold, API+BigQuery+PSI+Search Console

// Flag slow sessions for replay collection
function shouldRecordReplay(metrics) {
  return metrics.lcp > 4000 || metrics.inp > 500 || metrics.cls > 0.25
    || metrics.longTasks > 5 || metrics.jsErrors > 0;
}
```

---

## 10 Best Practices

1. **Deploy RUM on all production pages** -- lab testing covers sample URLs; RUM covers everything
2. **Use web-vitals library for Core Web Vitals** -- Google-maintained, handles edge cases correctly
3. **Segment by device, connection, and geography** -- global p75 hides regional performance failures
4. **Sample RUM at 10-100% depending on traffic** -- high-traffic sites sample down; low-traffic keep 100%
5. **Beacon data on visibilitychange** -- sendBeacon in `hidden` state captures all data before tab close
6. **Track custom marks for business milestones** -- "time-to-interactive-dashboard" matters more than generic FCP
7. **Compare RUM with CrUX** -- your RUM p75 should align with CrUX; large gaps indicate measurement issues
8. **Correlate RUM with backend traces** -- inject trace_id into RUM events for full-stack debugging
9. **Set up alerts on p75 regressions** -- detect degradation within hours, not weeks
10. **Use session replay for slow-session debugging** -- replay the exact user experience for p99 investigations

## 8 Anti-Patterns

1. **RUM without sampling strategy** -- 100% collection on high-traffic sites generates massive cost
2. **Measuring only page load, not interactions** -- INP and post-load performance matter as much as LCP
3. **No device segmentation** -- "p75 LCP is 2.0s" hides that mobile is 4.5s
4. **Collecting RUM but never analyzing** -- dashboards exist but no one reviews weekly trends
5. **Using synchronous analytics scripts** -- RUM collection scripts that block rendering defeat the purpose
6. **Ignoring navigation type** -- back/forward navigations from bfcache have near-zero load times, skewing data
7. **No correlation between RUM and deployments** -- unable to attribute performance changes to specific releases
8. **Treating CrUX as a complete dataset** -- CrUX is Chrome-only; Safari and Firefox users are invisible

## Enforcement Checklist

- [ ] RUM collection script deployed on all production pages with sendBeacon
- [ ] web-vitals library collecting LCP, INP, CLS, FCP, TTFB
- [ ] Custom performance marks added for critical user journeys
- [ ] Data segmented by device category, connection type, and geography
- [ ] RUM dashboard showing p75 trends with deployment markers
- [ ] Alerts configured for p75 regression > 10% sustained over 1 hour
- [ ] CrUX data cross-referenced with internal RUM monthly
- [ ] Session replay enabled for slow sessions (p99) and error sessions
