# Performance Budgets — Engineering & Enforcement

> **Domain:** Performance Culture > Budget Definition & Governance
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/frontend-performance/core-web-vitals.md (CWV measurement)

> **Directive:** Define quantitative performance limits per page, feature, and team. Enforce budgets in CI/CD pipelines so regressions never reach production. Use ratcheting to ensure budgets only tighten over time.

---

## 1. Budget Types

```
QUANTITY BUDGETS                 TIMING BUDGETS                RULE BUDGETS
├── JS bundle: max 170KB gz     ├── FCP: < 1800ms             ├── Lighthouse Perf: >= 90
├── CSS: max 50KB gz            ├── LCP: < 2500ms             ├── Lighthouse A11y: >= 95
├── Images per page: max 1MB    ├── TTI: < 3800ms             ├── No render-blocking resources
├── Web fonts: max 100KB        ├── INP: < 200ms              ├── Max 3 third-party origins
├── Total page weight: < 1.5MB  ├── TTFB: < 800ms             └── No layout shifts from ads
└── Third-party JS: < 50KB gz   └── CLS: < 0.1
```

## 2. Budget Definition Strategy

### Step 1: Baseline from Competitors and Field Data

```python
# budget_calculator.py — Derive budgets from competitive analysis
import statistics

def calculate_budget(competitor_values: list[float], target_percentile: float = 0.2) -> dict:
    """Set budget at the 20th percentile of competitors (beat 80% of them)."""
    sorted_vals = sorted(competitor_values)
    idx = int(len(sorted_vals) * target_percentile)
    target = sorted_vals[max(0, idx)]
    return {
        "target": round(target, 2),
        "warn": round(target * 1.1, 2),   # 10% tolerance = warning
        "error": round(target * 1.25, 2),  # 25% tolerance = hard fail
    }

# Example: competitor LCP values in ms
lcp_competitors = [2100, 2800, 3200, 1900, 2500, 4100, 1700]
budget = calculate_budget(lcp_competitors)
# {'target': 1900, 'warn': 2090.0, 'error': 2375.0}
```

### Step 2: Allocate Budget Per Team/Feature

```yaml
# performance-budgets.yaml — Per-team allocation
global:
  total_js: 170KB
  total_css: 50KB
  total_images: 1MB

allocations:
  core-shell:
    js: 40KB    # Framework + router + shared utilities
    css: 15KB
    owner: platform-team
  product-listing:
    js: 50KB    # Search, filters, product cards
    css: 15KB
    owner: search-team
  checkout:
    js: 45KB    # Cart, payment, validation
    css: 10KB
    owner: commerce-team
  third-party:
    js: 35KB    # Analytics, A/B testing, chat widget
    css: 10KB
    owner: marketing-team
    # Third-party scripts get the SMALLEST allocation
```

## 3. Lighthouse CI Budgets

```json
// budget.json — Lighthouse CI budget file
[
  {
    "path": "/*",
    "timings": [
      { "metric": "interactive", "budget": 3800 },
      { "metric": "first-contentful-paint", "budget": 1800 },
      { "metric": "largest-contentful-paint", "budget": 2500 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 170 },
      { "resourceType": "stylesheet", "budget": 50 },
      { "resourceType": "image", "budget": 500 },
      { "resourceType": "total", "budget": 1500 }
    ],
    "resourceCounts": [
      { "resourceType": "third-party", "budget": 5 },
      { "resourceType": "script", "budget": 10 }
    ]
  },
  {
    "path": "/checkout/*",
    "timings": [
      { "metric": "interactive", "budget": 3000 },
      { "metric": "largest-contentful-paint", "budget": 2000 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 100 },
      { "resourceType": "total", "budget": 800 }
    ]
  }
]
```

```yaml
# lighthouserc.yml — Lighthouse CI configuration
ci:
  collect:
    url:
      - http://localhost:3000/
      - http://localhost:3000/products
      - http://localhost:3000/checkout
    numberOfRuns: 3
    settings:
      preset: desktop
  assert:
    budgetsFile: budget.json
    assertions:
      "categories:performance": ["error", { "minScore": 0.9 }]
      "first-contentful-paint": ["warn", { "maxNumericValue": 1800 }]
      "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
      "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
  upload:
    target: lhci
    serverBaseUrl: https://lhci.example.com
```

## 4. Bundlesize CI Integration

```json
// package.json — bundlesize configuration
{
  "bundlesize": [
    { "path": "dist/js/main.*.js", "maxSize": "45KB", "compression": "gzip" },
    { "path": "dist/js/vendor.*.js", "maxSize": "90KB", "compression": "gzip" },
    { "path": "dist/js/chunk-*.js", "maxSize": "25KB", "compression": "gzip" },
    { "path": "dist/css/main.*.css", "maxSize": "15KB", "compression": "gzip" },
    { "path": "dist/css/vendor.*.css", "maxSize": "35KB", "compression": "gzip" }
  ]
}
```

```yaml
# .github/workflows/bundle-budget.yml
name: Bundle Size Check
on: [pull_request]
jobs:
  bundlesize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: siddharthkp/bundlesize2@v2
        env:
          CI_REPO_OWNER: ${{ github.repository_owner }}
          CI_REPO_NAME: ${{ github.event.repository.name }}
          CI_COMMIT_SHA: ${{ github.event.pull_request.head.sha }}
          BUNDLESIZE_GITHUB_TOKEN: ${{ secrets.BUNDLESIZE_TOKEN }}
```

## 5. Webpack Performance Hints

```javascript
// webpack.config.js — Built-in performance enforcement
module.exports = {
  performance: {
    maxAssetSize: 250_000,        // 250KB per asset (uncompressed)
    maxEntrypointSize: 500_000,   // 500KB per entrypoint
    hints: process.env.CI ? 'error' : 'warning',
    assetFilter: (file) => !/\.map$/.test(file) && /\.(js|css)$/.test(file),
  },
  optimization: {
    splitChunks: {
      maxSize: 244_000,           // Force splitting chunks > 244KB
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          enforce: true,
        },
      },
    },
  },
};
```

## 6. Third-Party Script Budgets

```typescript
// third-party-auditor.ts — Measure and enforce third-party impact
interface ThirdPartyBudget {
  origin: string;
  maxTransferSize: number; // bytes
  maxMainThreadTime: number; // ms
  category: 'analytics' | 'ads' | 'social' | 'cdn' | 'other';
}

const THIRD_PARTY_BUDGETS: ThirdPartyBudget[] = [
  { origin: 'google-analytics.com', maxTransferSize: 30_000, maxMainThreadTime: 50, category: 'analytics' },
  { origin: 'googletagmanager.com', maxTransferSize: 80_000, maxMainThreadTime: 100, category: 'analytics' },
  { origin: 'cdn.segment.com', maxTransferSize: 35_000, maxMainThreadTime: 40, category: 'analytics' },
  { origin: 'connect.facebook.net', maxTransferSize: 60_000, maxMainThreadTime: 80, category: 'social' },
];

// Enforcement: total third-party JS must not exceed 20% of total JS budget
const THIRD_PARTY_CEILING = 0.20;
```

## 7. Ratcheting — Budgets Can Only Improve

```python
# ratchet_budget.py — Automatically tighten budgets after improvements
import json, sys
from pathlib import Path

def ratchet(budget_file: str, current_metrics: dict, slack_pct: float = 5.0):
    """If current metric beats budget by >slack%, tighten the budget."""
    budgets = json.loads(Path(budget_file).read_text())
    updated = False
    for entry in budgets:
        for timing in entry.get("timings", []):
            metric = timing["metric"]
            if metric in current_metrics:
                current = current_metrics[metric]
                budget = timing["budget"]
                headroom = (budget - current) / budget * 100
                if headroom > slack_pct:
                    new_budget = int(current * (1 + slack_pct / 100))
                    print(f"RATCHET: {metric} {budget} -> {new_budget} (current: {current})")
                    timing["budget"] = new_budget
                    updated = True
    if updated:
        Path(budget_file).write_text(json.dumps(budgets, indent=2))
        print("Budget file updated. Commit this change.")
    else:
        print("No ratcheting needed.")

# Usage: python ratchet_budget.py budget.json '{"interactive": 3000, "first-contentful-paint": 1400}'
if __name__ == "__main__":
    ratchet(sys.argv[1], json.loads(sys.argv[2]))
```

## 8. Performance Budget Dashboard

```yaml
# grafana-perf-budget-dashboard.yaml — Provisioned dashboard
apiVersion: 1
providers:
  - name: performance-budgets
    type: file
    options:
      path: /var/lib/grafana/dashboards/perf-budgets.json

# Key panels in the dashboard JSON:
# 1. Budget vs Actual (time series) — each metric with budget threshold line
# 2. Budget Utilization (gauge) — percentage of budget consumed per team
# 3. Trend (stat) — 7-day rolling delta, red if regressing
# 4. Third-party breakdown (pie) — JS bytes by third-party origin
# 5. Ratchet history (table) — log of all budget tightenings
```

```promql
# PromQL queries for budget monitoring
# JS bundle size vs budget
(sum(asset_size_bytes{type="javascript"}) / 170000) * 100  # % of budget

# LCP p75 vs budget threshold
histogram_quantile(0.75, sum(rate(lcp_duration_bucket[7d])) by (le))

# Alert: budget exceeded
# fires when 7-day p75 LCP exceeds 2500ms for > 30 minutes
ALERT LCPBudgetExceeded
  IF histogram_quantile(0.75, sum(rate(lcp_duration_bucket[7d])) by (le)) > 2500
  FOR 30m
  LABELS { severity = "warning" }
  ANNOTATIONS { summary = "LCP p75 exceeds 2500ms budget" }
```

## 9. CI/CD Gates

```yaml
# .github/workflows/perf-gate.yml — Full performance gate pipeline
name: Performance Gate
on:
  pull_request:
    branches: [main]
jobs:
  perf-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build

      # Gate 1: Bundle size
      - name: Check bundle sizes
        run: npx bundlesize

      # Gate 2: Lighthouse scores
      - name: Run Lighthouse CI
        run: npx lhci autorun

      # Gate 3: Webpack limits
      - name: Webpack build (errors on budget violations)
        run: NODE_ENV=production npx webpack --bail
        env:
          WEBPACK_PERF_HINTS: error

      # Gate 4: Import cost check
      - name: Check import costs
        run: |
          npx import-cost --json src/**/*.ts | \
          jq '.[] | select(.gzip > 10000) | .fileName + ": " + (.gzip|tostring) + " bytes"' && \
          echo "All imports within budget" || (echo "FAIL: imports exceed 10KB" && exit 1)

      # Gate 5: Ratchet budgets on merge
      - name: Ratchet budgets
        if: github.event.pull_request.merged == true
        run: python scripts/ratchet_budget.py budget.json "$(npx lhci collect --json)"
```

---

## 10 Best Practices

1. **Define budgets before building** — set limits during project kickoff, not after launch
2. **Use all three budget types together** — quantity (KB), timing (ms), and rule (scores) catch different regressions
3. **Allocate budgets per team** — each team owns a slice; prevents tragedy of the commons
4. **Cap third-party scripts hardest** — they are the most common budget-busting source
5. **Enforce in CI with hard failures** — warnings get ignored; make budget violations block merge
6. **Ratchet after every improvement** — lock in gains so they are never lost to regression
7. **Set separate mobile budgets** — mobile gets 60% of desktop budget for JS and total weight
8. **Budget for the worst supported device** — Moto G4 on 3G, not developer MacBooks on fiber
9. **Review budgets quarterly** — tighten based on field data trends and competitive landscape
10. **Display budgets on a public dashboard** — visibility drives accountability across teams

## 8 Anti-Patterns

1. **Setting budgets nobody enforces** — budgets without CI gates are aspirational documents, not engineering controls
2. **One global budget for all pages** — homepage and checkout have different performance profiles; budget per template
3. **Excluding third-party scripts from budgets** — "it's not our code" is not a defense; you chose to load it
4. **Budgets based on lab-only data** — Lighthouse scores fluctuate; anchor budgets to field p75 metrics
5. **Allowing budget overrides without review** — skip flags in CI erode the entire budget system
6. **Never tightening budgets** — static budgets become meaningless as the codebase grows
7. **Budgeting total weight but not per-chunk** — one 200KB chunk causes poor TTI even if total is under budget
8. **Ignoring image budgets** — images are typically 50-70% of page weight; they need explicit limits

## Enforcement Checklist

- [ ] Budget file (budget.json) committed to repository root
- [ ] Lighthouse CI configured with budget assertions (lighthouserc.yml)
- [ ] Bundlesize checks run on every pull request
- [ ] Webpack performance hints set to "error" in CI builds
- [ ] Third-party script inventory maintained with per-origin budgets
- [ ] Budget allocation documented per team with clear ownership
- [ ] Ratcheting script runs automatically on merge to main
- [ ] Performance dashboard displays budget utilization in real time
- [ ] Quarterly budget review scheduled with engineering leadership
- [ ] Mobile-specific budgets defined and enforced separately
