# Lighthouse — Performance Auditing & CI Integration

> **Domain:** Profiling Tools > Web Performance Auditing
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/profiling-tools/chrome-devtools.md, 09-performance/frontend-performance/core-web-vitals.md

> **Directive:** Use Lighthouse for automated performance auditing, budget enforcement, and CI gating. Understand scoring weights to prioritize optimizations. Integrate Lighthouse CI into every deployment pipeline. Never treat Lighthouse scores as the sole performance metric -- complement with field data (RUM/CrUX).

---

## 1. Performance Scoring (v12)

### Metric Weightings

```
LIGHTHOUSE v12 PERFORMANCE SCORE (weighted average):
┌────────────────────────┬────────┬─────────────────────────┐
│ Metric                 │ Weight │ Good Threshold          │
├────────────────────────┼────────┼─────────────────────────┤
│ Total Blocking Time    │  25%   │ < 200ms                 │
│ Largest Contentful     │  25%   │ < 2.5s                  │
│ Cumulative Layout Shift│  25%   │ < 0.1                   │
│ First Contentful Paint │  15%   │ < 1.8s                  │
│ Speed Index            │  10%   │ < 3.4s                  │
├────────────────────────┼────────┼─────────────────────────┤
│ TOTAL                  │ 100%   │ Score 90+ = "Good"      │
└────────────────────────┴────────┴─────────────────────────┘

NOTE: TTI was removed in v10. INP is field-only (not in Lighthouse lab).
Each metric maps to a log-normal scoring curve:
  score = calculateLogNormalScore(median, p10, value)
```

### Score Interpretation

```
90-100: Green  — Performance is good; maintain budgets
50-89:  Orange — Needs improvement; prioritize top 2-3 audits
0-49:   Red    — Poor; likely multiple blocking issues

SCORING GOTCHAS:
  - Score is nonlinear: going 50→70 is easier than 90→95
  - Same page can score 80-95 across runs (variance is normal)
  - Desktop vs mobile profiles yield very different scores
  - Lighthouse uses Moto G Power + throttled 4G for mobile
```

## 2. CLI Usage

```bash
# Install globally
npm install -g lighthouse

# Basic run (outputs HTML report)
lighthouse https://example.com --output html --output-path ./report.html

# JSON output for programmatic analysis
lighthouse https://example.com --output json --output-path ./report.json

# Mobile (default) vs Desktop
lighthouse https://example.com --preset desktop
lighthouse https://example.com --preset perf   # performance-only (faster)

# Specific categories only
lighthouse https://example.com --only-categories=performance

# Custom throttling
lighthouse https://example.com \
  --throttling.cpuSlowdownMultiplier=4 \
  --throttling.throughputKbps=1600 \
  --throttling.rttMs=150

# Multiple runs for stability (median)
lighthouse https://example.com -n 5 --output json
```

## 3. PageSpeed Insights vs Lighthouse CLI

```
┌──────────────────────┬─────────────────────┬────────────────────┐
│ Feature              │ PageSpeed Insights   │ Lighthouse CLI     │
├──────────────────────┼─────────────────────┼────────────────────┤
│ Field data (CrUX)    │ YES (28-day p75)    │ NO                 │
│ Lab data             │ YES (remote server) │ YES (local machine)│
│ Custom throttling    │ NO                  │ YES                │
│ Auth/login pages     │ NO                  │ YES (with flags)   │
│ CI integration       │ API only            │ Native             │
│ Custom config        │ NO                  │ YES (full control) │
│ Cost                 │ Free (rate-limited) │ Free               │
│ Reproducibility      │ Lower (shared infra)│ Higher (local)     │
└──────────────────────┴─────────────────────┴────────────────────┘

RULE: Use PSI for quick checks + field data. Use CLI for CI, auth pages,
      and reproducible benchmarks.
```

## 4. Lighthouse CI (LHCI)

### Installation and Setup

```bash
npm install -g @lhci/cli
lhci autorun --help

# Initialize config
lhci wizard  # interactive setup
```

### Configuration: lighthouserc.js

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/products',
        'http://localhost:3000/checkout',
      ],
      numberOfRuns: 3,              // median of 3 runs
      startServerCommand: 'npm run serve',
      startServerReadyPattern: 'listening on port',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'interactive': ['warn', { maxNumericValue: 3800 }],
        'uses-text-compression': 'error',
        'uses-responsive-images': 'warn',
        'render-blocking-resources': 'warn',
      },
    },
    upload: {
      target: 'lhci',                          // LHCI server
      serverBaseUrl: 'https://lhci.example.com',
      token: process.env.LHCI_BUILD_TOKEN,
    },
  },
};
```

### Performance Budgets: budget.json

```json
[
  {
    "path": "/*",
    "timings": [
      { "metric": "first-contentful-paint", "budget": 1800 },
      { "metric": "largest-contentful-paint", "budget": 2500 },
      { "metric": "cumulative-layout-shift", "budget": 0.1 },
      { "metric": "total-blocking-time", "budget": 200 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 300 },
      { "resourceType": "stylesheet", "budget": 80 },
      { "resourceType": "image", "budget": 400 },
      { "resourceType": "total", "budget": 1500 }
    ],
    "resourceCounts": [
      { "resourceType": "third-party", "budget": 10 },
      { "resourceType": "script", "budget": 15 }
    ]
  }
]
```

## 5. GitHub Actions Integration

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci && npm run build

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: ./lighthouserc.js
          uploadArtifacts: true
          temporaryPublicStorage: true  # free dashboard for PRs
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Assert budgets
        run: |
          npx @lhci/cli assert --config=lighthouserc.js
```

```yaml
# Alternative: Budget-only check (simpler)
      - name: Lighthouse Budget Check
        uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            https://staging-${{ github.event.pull_request.number }}.example.com/
          budgetPath: ./budget.json
```

## 6. Custom Audits

```javascript
// custom-audits/no-large-images.js
const { Audit } = require('lighthouse');

class NoLargeImagesAudit extends Audit {
  static get meta() {
    return {
      id: 'no-large-images',
      title: 'No images larger than 200KB',
      failureTitle: 'Found images larger than 200KB',
      description: 'Large images slow LCP. Compress or use modern formats.',
      requiredArtifacts: ['ImageElements'],
    };
  }

  static audit(artifacts) {
    const images = artifacts.ImageElements || [];
    const largeImages = images.filter(img => img.resourceSize > 200 * 1024);
    return {
      score: largeImages.length === 0 ? 1 : 0,
      displayValue: `${largeImages.length} oversized image(s)`,
      details: Audit.makeTableDetails(
        [
          { key: 'src', itemType: 'url', text: 'URL' },
          { key: 'resourceSize', itemType: 'bytes', text: 'Size' },
        ],
        largeImages.map(img => ({ src: img.src, resourceSize: img.resourceSize }))
      ),
    };
  }
}

module.exports = NoLargeImagesAudit;
```

```javascript
// custom-config.js — register custom audit
module.exports = {
  extends: 'lighthouse:default',
  audits: ['./custom-audits/no-large-images'],
  categories: {
    performance: {
      auditRefs: [{ id: 'no-large-images', weight: 0, group: 'diagnostics' }],
    },
  },
};

// Run: lighthouse https://example.com --config-path=./custom-config.js
```

## 7. User Flows (Multi-Step Auditing)

```javascript
// user-flow.js — Audit navigation + interactions
const { startFlow } = require('lighthouse');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const flow = await startFlow(page, { name: 'Checkout Flow' });

  // Step 1: Navigation audit
  await flow.navigate('https://example.com/products');

  // Step 2: Timespan audit (interaction)
  await flow.startTimespan({ stepName: 'Add to cart' });
  await page.click('.add-to-cart-btn');
  await page.waitForSelector('.cart-count');
  await flow.endTimespan();

  // Step 3: Snapshot audit (current state)
  await flow.snapshot({ stepName: 'Cart page state' });

  // Step 4: Another navigation
  await flow.navigate('https://example.com/checkout');

  // Generate report
  const report = await flow.generateReport();
  const fs = require('fs');
  fs.writeFileSync('flow-report.html', report);

  await browser.close();
})();
```

## 8. Programmatic API

```javascript
// programmatic-lighthouse.js — Custom analysis pipeline
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function runAudit(url, iterations = 3) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const scores = [];

  for (let i = 0; i < iterations; i++) {
    const { lhr } = await lighthouse(url, {
      port: chrome.port,
      onlyCategories: ['performance'],
      formFactor: 'mobile',
      throttling: {
        rttMs: 150, throughputKbps: 1638,
        cpuSlowdownMultiplier: 4,
      },
    });
    scores.push({
      performance: lhr.categories.performance.score * 100,
      lcp: lhr.audits['largest-contentful-paint'].numericValue,
      tbt: lhr.audits['total-blocking-time'].numericValue,
      cls: lhr.audits['cumulative-layout-shift'].numericValue,
    });
  }

  await chrome.kill();
  // Return median
  scores.sort((a, b) => a.performance - b.performance);
  return scores[Math.floor(scores.length / 2)];
}
```

---

## 10 Best Practices

1. **Run minimum 3 iterations** -- single runs have 5-10% variance; use median
2. **Set assertion thresholds, not score targets** -- gate on metric values (LCP < 2.5s), not overall score
3. **Use budget.json for resource budgets** -- enforce JS < 300KB, images < 400KB per page
4. **Test mobile preset by default** -- mobile is the constrained environment that matters
5. **Integrate LHCI into every PR pipeline** -- catch regressions before merge
6. **Combine lab (Lighthouse) with field (CrUX/RUM)** -- lab finds issues, field confirms impact
7. **Pin Lighthouse version in CI** -- scoring changes between versions invalidate comparisons
8. **Use user flows for SPAs** -- single navigation audits miss interaction-time bottlenecks
9. **Store historical results in LHCI server** -- track trends across deploys
10. **Review diagnostics, not just the score** -- "Reduce unused JS" tells you what to fix

## 8 Anti-Patterns

1. **Chasing Lighthouse 100** -- a perfect lab score does not guarantee good field performance
2. **Comparing scores across Lighthouse versions** -- scoring curves change between major versions
3. **Running in non-headless Chrome with extensions** -- extensions inflate scripting time
4. **Using PageSpeed Insights for CI** -- rate-limited, non-reproducible, no custom config
5. **Ignoring score variance without multiple runs** -- single run scores are noisy
6. **Setting budgets too loose** -- LCP budget of 4s passes Lighthouse but fails CrUX
7. **Only auditing the homepage** -- product pages, checkout, and search often perform worse
8. **Skipping custom audits for domain rules** -- missing image compression, font loading, or third-party checks specific to your app

## Enforcement Checklist

- [ ] Lighthouse CI configured with lighthouserc.js in repository root
- [ ] Performance budget.json covers all critical page templates
- [ ] GitHub Actions workflow runs LHCI on every pull request
- [ ] Assertions set for LCP, TBT, CLS with error-level thresholds
- [ ] Minimum 3 runs configured for score stability
- [ ] LHCI server deployed for historical trend tracking
- [ ] Mobile preset used as default audit profile
- [ ] Custom audits added for domain-specific performance rules
