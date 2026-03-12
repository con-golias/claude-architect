# Core Web Vitals — Performance Engineering

> **Domain:** Frontend Performance > Measurement & Optimization
> **Importance:** CRITICAL
> **Cross-ref:** 05-frontend/web/performance/core-web-vitals.md (implementation details)

> **Directive:** When measuring, diagnosing, or optimizing Core Web Vitals, consult this guide for methodology. Use 05-frontend for implementation patterns. This covers the ENGINEERING PROCESS: measurement infrastructure, field vs lab analysis, business impact quantification, optimization decision trees, and regression prevention.

---

## 1. Measurement Methodology

### Field vs Lab: Know the Difference

```
FIELD DATA (Real User Monitoring)          LAB DATA (Synthetic Testing)
├── CrUX (Chrome UX Report)                ├── Lighthouse
├── web-vitals.js library                  ├── WebPageTest
├── RUM providers (SpeedCurve, Akamai)     ├── Chrome DevTools
├── Custom PerformanceObserver             └── PageSpeed Insights (lab tab)
│
├── Reflects REAL user experience           ├── Reproducible & debuggable
├── Varies by device/network/geography      ├── Controlled environment
├── 28-day rolling window (CrUX)            ├── Single-run snapshot
└── THIS IS WHAT GOOGLE RANKS ON            └── Directional guidance only
```

### Collect Field Metrics with web-vitals

```typescript
// performance-monitoring.ts — Production RUM collection
import { onLCP, onINP, onCLS, onFCP, onTTFB, Metric } from 'web-vitals';

interface VitalReport {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
  url: string;
  deviceCategory: string;
  effectiveConnectionType: string;
}

function buildReport(metric: Metric): VitalReport {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    navigationType: nav?.type ?? 'unknown',
    url: location.pathname,
    deviceCategory: navigator.userAgentData?.mobile ? 'mobile' : 'desktop',
    effectiveConnectionType: (navigator as any).connection?.effectiveType ?? 'unknown',
  };
}

function sendToAnalytics(report: VitalReport): void {
  // Batch and beacon — never block unload
  const body = JSON.stringify(report);
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { body, method: 'POST', keepalive: true });
  }
}

// Collect all vitals — call once on page load
export function initVitalsCollection(): void {
  const report = (metric: Metric) => sendToAnalytics(buildReport(metric));
  onLCP(report);
  onINP(report);
  onCLS(report);
  onFCP(report);
  onTTFB(report);
}
```

```python
# vitals_aggregator.py — Server-side aggregation for CrUX-like analysis
import statistics
from dataclasses import dataclass, field
from collections import defaultdict

@dataclass
class VitalsAggregator:
    """Aggregate RUM data and compute p75 (Google's methodology)."""
    data: dict = field(default_factory=lambda: defaultdict(list))

    def add(self, metric_name: str, value: float, page: str) -> None:
        self.data[f"{metric_name}:{page}"].append(value)

    def p75(self, metric_name: str, page: str) -> float:
        """75th percentile — this is what Google uses for ranking."""
        values = sorted(self.data.get(f"{metric_name}:{page}", []))
        if not values:
            return 0.0
        idx = int(len(values) * 0.75)
        return values[min(idx, len(values) - 1)]

    def assess(self, metric_name: str, page: str) -> str:
        thresholds = {
            "LCP": (2500, 4000), "INP": (200, 500), "CLS": (0.1, 0.25),
        }
        val = self.p75(metric_name, page)
        good, poor = thresholds.get(metric_name, (0, 0))
        if val <= good: return "good"
        if val <= poor: return "needs-improvement"
        return "poor"
```

## 2. CrUX Data Access

```typescript
// crux-api-client.ts — Query CrUX API for origin/URL-level data
const CRUX_API = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

interface CrUXResponse {
  record: { metrics: Record<string, { percentiles: { p75: number } }> };
}

async function queryCrUX(
  apiKey: string,
  origin: string,
  formFactor: 'PHONE' | 'DESKTOP' | 'ALL_FORM_FACTORS' = 'ALL_FORM_FACTORS'
): Promise<CrUXResponse> {
  const res = await fetch(`${CRUX_API}?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({ origin, formFactor }),
  });
  if (!res.ok) throw new Error(`CrUX API error: ${res.status}`);
  return res.json();
}

// BigQuery CrUX — full dataset for trend analysis
// SQL: SELECT p75_lcp, p75_inp, p75_cls FROM `chrome-ux-report.all.202401`
// WHERE origin = 'https://example.com' AND form_factor = 'phone'
```

## 3. Business Impact Quantification

```
CONVERSION IMPACT BY LOAD TIME (industry benchmarks):
┌──────────────────┬───────────────────────────────────────┐
│ LCP Improvement  │ Expected Business Impact              │
├──────────────────┼───────────────────────────────────────┤
│ 3.0s → 2.5s     │ +7-12% conversion rate                │
│ 2.5s → 2.0s     │ +3-7% conversion rate                 │
│ 2.0s → 1.5s     │ +1-3% conversion rate                 │
│ Every 100ms      │ ~1% revenue impact (Amazon/Walmart)   │
├──────────────────┼───────────────────────────────────────┤
│ INP > 500ms      │ 2-3x higher bounce rate               │
│ CLS > 0.25       │ 15-20% lower engagement               │
└──────────────────┴───────────────────────────────────────┘

ROI FORMULA:
  perf_investment_roi = (delta_conversion * avg_revenue_per_conversion * traffic)
                        / engineering_cost
```

## 4. Optimization Decision Trees

```
LCP DIAGNOSIS TREE:
  LCP > 2.5s?
  ├── Check TTFB first (> 800ms?)
  │   ├── YES → Server/CDN issue (not frontend)
  │   └── NO → Continue
  ├── LCP element is image?
  │   ├── YES → Is it preloaded with fetchpriority="high"?
  │   │   ├── NO → Add <link rel="preload"> + fetchpriority
  │   │   └── YES → Check format (WebP/AVIF?) and sizing
  │   └── NO → LCP is text
  │       ├── Check render-blocking CSS
  │       ├── Check font loading (font-display: swap?)
  │       └── Check critical CSS inlining

INP DIAGNOSIS TREE:
  INP > 200ms?
  ├── Record interaction traces in DevTools Performance panel
  ├── Identify: input delay | processing time | presentation delay
  ├── Input delay high? → Main thread blocked (long tasks)
  │   ├── Break up JS execution with scheduler.yield()
  │   └── Move work to Web Workers
  ├── Processing time high? → Event handler too slow
  │   └── Optimize handler, defer non-visual work
  └── Presentation delay high? → DOM mutations trigger layout
      └── Reduce DOM size, batch mutations

CLS DIAGNOSIS TREE:
  CLS > 0.1?
  ├── Images/iframes without dimensions? → Add width/height
  ├── Dynamically injected content? → Reserve space with min-height
  ├── Web fonts causing shift? → Use font-display + size-adjust
  ├── Ads/embeds? → Reserve fixed slot dimensions
  └── Late CSS? → Inline critical CSS, preload rest
```

## 5. Performance Budgets

```typescript
// performance-budget.config.ts — CI enforcement
export const performanceBudgets = {
  vitals: {
    LCP: { warn: 2000, error: 2500 },   // milliseconds
    INP: { warn: 150, error: 200 },
    CLS: { warn: 0.05, error: 0.1 },
    FCP: { warn: 1500, error: 1800 },
    TTFB: { warn: 600, error: 800 },
  },
  assets: {
    totalJS: { warn: 250_000, error: 350_000 },      // bytes gzipped
    totalCSS: { warn: 50_000, error: 80_000 },
    heroImage: { warn: 100_000, error: 150_000 },
    totalPageWeight: { warn: 1_500_000, error: 2_000_000 },
  },
};
```

```go
// budget_checker.go — Validate CrUX data against budgets in CI
package perf

type Budget struct {
	Warn  float64
	Error float64
}

type CrUXResult struct {
	LCP float64
	INP float64
	CLS float64
}

func CheckBudgets(result CrUXResult, budgets map[string]Budget) []string {
	violations := []string{}
	checks := map[string]float64{"LCP": result.LCP, "INP": result.INP, "CLS": result.CLS}
	for metric, value := range checks {
		b := budgets[metric]
		if value > b.Error {
			violations = append(violations, metric+" EXCEEDS budget")
		} else if value > b.Warn {
			violations = append(violations, metric+" approaching budget")
		}
	}
	return violations
}
```

## 6. Automated Regression Detection

```yaml
# .github/workflows/web-vitals-check.yml
name: Web Vitals Budget Check
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            https://staging.example.com/
            https://staging.example.com/products
          budgetPath: ./budgets.json
          uploadArtifacts: true
```

---

## 10 Best Practices

1. **Measure field data first** — CrUX/RUM reflects real users; Lighthouse is directional only
2. **Track p75, not averages** — Google ranks on 75th percentile; averages hide tail latency
3. **Segment by device and connection** — Mobile 4G performance differs dramatically from desktop
4. **Set budgets before optimizing** — Define LCP < 2.5s, INP < 200ms, CLS < 0.1 as hard gates
5. **Automate regression detection** — Run Lighthouse CI on every PR against staging
6. **Fix TTFB before frontend** — If TTFB > 800ms, no amount of frontend optimization compensates
7. **Prioritize by business impact** — Optimize high-traffic pages first; compute ROI per fix
8. **Monitor trends, not snapshots** — Track 7-day rolling p75 to detect regressions early
9. **Attribute metrics to deployments** — Correlate vital changes with specific releases
10. **Test on real devices** — Use WebPageTest with Moto G4 on 3G for realistic mobile testing

## 8 Anti-Patterns

1. **Optimizing for Lighthouse 100 only** — Lab scores can be perfect while field data fails
2. **Ignoring mobile users** — Desktop passes all budgets but mobile (60%+ traffic) fails
3. **Measuring averages instead of percentiles** — p50 can be "good" while p75 is "poor"
4. **One-time audit without monitoring** — Performance degrades without continuous measurement
5. **Optimizing LCP element without fixing TTFB** — 2s server delay makes LCP impossible < 2.5s
6. **Treating CLS as zero after reload** — Most CLS occurs on navigation; test fresh page loads
7. **Ignoring navigation type** — Back/forward cache restores differ from fresh loads
8. **No segmentation by page template** — Aggregating all pages hides per-template failures

## Enforcement Checklist

- [ ] RUM collection deployed with web-vitals library on all pages
- [ ] CrUX API queried weekly and trends dashboarded
- [ ] Performance budgets defined and enforced in CI
- [ ] Lighthouse CI runs on every PR with budget assertions
- [ ] Alerts configured for p75 regressions > 10%
- [ ] Business impact documented (conversion/revenue per 100ms)
- [ ] Mobile-specific budgets set (separate from desktop)
- [ ] Quarterly performance review with optimization roadmap
