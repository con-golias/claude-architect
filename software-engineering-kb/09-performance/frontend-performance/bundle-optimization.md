# Bundle Optimization — Performance Engineering

> **Domain:** Frontend Performance > Build & Bundle Analysis
> **Importance:** CRITICAL
> **Cross-ref:** 05-frontend/web/fundamentals/code-splitting.md, 05-frontend/web/fundamentals/tree-shaking.md

> **Directive:** When analyzing bundle sizes, enforcing size budgets, verifying tree shaking, or choosing build tool configurations, consult this guide. See 05-frontend for code splitting patterns and tree shaking implementation.

---

## 1. Bundle Size Budgets

```
BUNDLE SIZE BUDGET GUIDELINES (gzipped):
┌─────────────────────────┬──────────┬───────────┬──────────────────────┐
│ Resource                │ Budget   │ Hard Limit│ Why                  │
├─────────────────────────┼──────────┼───────────┼──────────────────────┤
│ Initial JS (all chunks) │ 150 KB   │ 200 KB    │ Parse/compile cost   │
│ Initial CSS             │ 30 KB    │ 50 KB     │ Render-blocking      │
│ Per-route JS chunk      │ 50 KB    │ 100 KB    │ Navigation speed     │
│ Single vendor chunk     │ 100 KB   │ 150 KB    │ Cache granularity    │
│ Total page weight       │ 500 KB   │ 1 MB      │ 3G mobile usability  │
│ Hero image              │ 80 KB    │ 150 KB    │ LCP impact           │
└─────────────────────────┴──────────┴───────────┴──────────────────────┘

JS COST: 1KB JS ≈ 1ms parse+compile on mid-range mobile
  200KB JS → ~200ms just to parse (before any execution)
```

## 2. Bundle Analysis Tools

```typescript
// webpack-bundle-analysis.config.ts
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

export default {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',         // Generate HTML file
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
      defaultSizes: 'gzip',           // Show gzipped sizes (what matters)
    }),
  ],
};

// Vite equivalent — vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'bundle-report.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ],
});
```

```bash
# CLI analysis tools
# source-map-explorer: precise per-module breakdown
npx source-map-explorer dist/assets/*.js --gzip --html report.html

# bundlephobia: check package cost before installing
# https://bundlephobia.com/package/lodash@4.17.21
# lodash: 71.5KB min+gzip  vs  lodash-es: 0 (tree-shakeable)

# import-cost: VS Code extension shows inline import sizes
```

## 3. Size Budget Enforcement in CI

```typescript
// budget-check.ts — Fail CI if bundles exceed budgets
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';
import { readFileSync } from 'fs';

interface Budget {
  pattern: RegExp;
  maxGzipBytes: number;
  label: string;
}

const BUDGETS: Budget[] = [
  { pattern: /^main\.[a-f0-9]+\.js$/, maxGzipBytes: 80_000, label: 'Main bundle' },
  { pattern: /^vendor\.[a-f0-9]+\.js$/, maxGzipBytes: 120_000, label: 'Vendor chunk' },
  { pattern: /\.css$/, maxGzipBytes: 30_000, label: 'CSS bundle' },
];

function checkBudgets(distDir: string): { passed: boolean; results: string[] } {
  const files = readdirSync(distDir);
  const results: string[] = [];
  let passed = true;

  for (const file of files) {
    for (const budget of BUDGETS) {
      if (budget.pattern.test(file)) {
        const raw = readFileSync(join(distDir, file));
        const gzipSize = gzipSync(raw).length;
        const overBudget = gzipSize > budget.maxGzipBytes;
        if (overBudget) passed = false;
        results.push(
          `${overBudget ? 'FAIL' : 'PASS'} ${budget.label}: ` +
          `${(gzipSize / 1024).toFixed(1)}KB / ${(budget.maxGzipBytes / 1024).toFixed(1)}KB`
        );
      }
    }
  }
  return { passed, results };
}
```

```yaml
# bundlesize.config.json — bundlesize package config
[
  { "path": "dist/assets/index-*.js", "maxSize": "80 kB", "compression": "gzip" },
  { "path": "dist/assets/vendor-*.js", "maxSize": "120 kB", "compression": "gzip" },
  { "path": "dist/assets/index-*.css", "maxSize": "30 kB", "compression": "gzip" }
]
```

## 4. Tree Shaking Verification

```typescript
// Verify tree shaking is working — check for dead code elimination

// BAD: Barrel exports defeat tree shaking
// utils/index.ts — re-exports everything
export { formatDate } from './date';
export { formatCurrency } from './currency';
export { heavyChart } from './chart';  // Always included even if unused

// GOOD: Direct imports enable tree shaking
import { formatDate } from './utils/date';  // Only date utils included

// VERIFICATION: Check if unused exports are eliminated
// 1. Build with source maps
// 2. Run source-map-explorer
// 3. Search for modules you DON'T use — they should be absent

// package.json sideEffects field — critical for tree shaking
// {
//   "sideEffects": false,                    // All modules pure
//   "sideEffects": ["*.css", "./polyfills"]  // Only these have side effects
// }
```

```python
# tree_shake_audit.py — Verify tree shaking effectiveness
import json
import subprocess
from pathlib import Path

def audit_tree_shaking(dist_dir: str, source_map_dir: str) -> dict:
    """Compare source modules in bundle vs available modules."""
    # Run source-map-explorer to get module breakdown
    result = subprocess.run(
        ["npx", "source-map-explorer", f"{dist_dir}/*.js", "--json"],
        capture_output=True, text=True
    )
    bundle_data = json.loads(result.stdout)

    included_modules = set()
    for bundle in bundle_data.get("results", []):
        for module_path in bundle.get("files", {}).keys():
            if "node_modules" in module_path:
                pkg = module_path.split("node_modules/")[1].split("/")[0]
                included_modules.add(pkg)

    # Compare against package.json dependencies
    pkg_json = json.loads(Path("package.json").read_text())
    declared = set(pkg_json.get("dependencies", {}).keys())
    unused_in_bundle = declared - included_modules

    return {
        "declared_deps": len(declared),
        "bundled_deps": len(included_modules),
        "potentially_tree_shaken": list(unused_in_bundle),
        "verdict": "OK" if len(included_modules) < len(declared) else "CHECK_NEEDED"
    }
```

## 5. Code Splitting Strategy Matrix

```
SPLITTING STRATEGY DECISION:
┌──────────────────────┬──────────────┬───────────────────────────────┐
│ Strategy             │ When to Use  │ Implementation                │
├──────────────────────┼──────────────┼───────────────────────────────┤
│ Route-based          │ ALWAYS       │ React.lazy + dynamic import   │
│ Component-based      │ Heavy UI     │ Lazy-load modals, charts      │
│ Vendor splitting     │ ALWAYS       │ splitChunks.cacheGroups       │
│ Library splitting    │ > 50KB libs  │ Separate chunk per large lib  │
│ Conditional features │ A/B tests    │ Dynamic import on flag        │
│ Below-the-fold       │ Long pages   │ Intersection Observer trigger │
└──────────────────────┴──────────────┴───────────────────────────────┘
```

## 6. Build Tool Comparison

```
BUILD TOOL PERFORMANCE COMPARISON:
┌───────────────┬──────────┬───────────┬──────────┬──────────────────┐
│ Tool          │ Dev HMR  │ Prod Build│ Output   │ Tree Shaking     │
├───────────────┼──────────┼───────────┼──────────┼──────────────────┤
│ Vite (Rollup) │ < 50ms   │ ~10s      │ Optimal  │ Excellent        │
│ Webpack 5     │ 200-500ms│ ~30s      │ Good     │ Good             │
│ esbuild       │ < 10ms   │ ~1s       │ Good     │ Limited          │
│ Turbopack     │ < 20ms   │ ~5s       │ Good     │ Good             │
│ Rspack        │ < 50ms   │ ~3s       │ Good     │ Good (Webpack)   │
│ Rolldown      │ < 30ms   │ ~2s       │ Optimal  │ Excellent        │
└───────────────┴──────────┴───────────┴──────────┴──────────────────┘
```

## 7. Module/Nomodule Pattern

```html
<!-- Serve modern JS to modern browsers, legacy to old ones -->
<script type="module" src="/js/app.modern.mjs"></script>
<script nomodule src="/js/app.legacy.js"></script>

<!--
  Modern bundle: ~20-30% smaller (no polyfills, modern syntax)
  Legacy bundle: includes core-js polyfills, transpiled to ES5
  Modern browsers ignore nomodule, legacy browsers ignore type="module"
-->
```

```typescript
// vite.config.ts — automatic module/nomodule with @vitejs/plugin-legacy
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
  ],
});
```

## 8. Chunk Optimization Strategies

```typescript
// webpack splitChunks — optimal configuration
const config = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20_000,
      cacheGroups: {
        // Framework — changes rarely, cache aggressively
        framework: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: 'framework',
          priority: 40,
        },
        // Large libraries — separate for independent caching
        largeVendor: {
          test: /[\\/]node_modules[\\/](chart\.js|d3|three)[\\/]/,
          name(module: any) {
            const match = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
            return `vendor-${match[1].replace('@', '')}`;
          },
          priority: 30,
          minSize: 50_000,
        },
        // Remaining vendors
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 20,
        },
        // Shared app code
        common: {
          minChunks: 2,
          priority: 10,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

## 9. Dependency Audit

```typescript
// dep-audit.ts — Find heavy dependencies and suggest alternatives
const HEAVY_PACKAGES: Record<string, { size: string; alternative: string }> = {
  'moment': { size: '72KB', alternative: 'date-fns (tree-shakeable) or dayjs (2KB)' },
  'lodash': { size: '72KB', alternative: 'lodash-es (tree-shakeable) or native methods' },
  'axios': { size: '13KB', alternative: 'native fetch (0KB)' },
  'classnames': { size: '1KB', alternative: 'clsx (< 1KB)' },
  'uuid': { size: '3KB', alternative: 'crypto.randomUUID() (0KB)' },
  'underscore': { size: '17KB', alternative: 'native Array/Object methods' },
};

function auditDependencies(packageJson: Record<string, any>): string[] {
  const warnings: string[] = [];
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const [pkg, info] of Object.entries(HEAVY_PACKAGES)) {
    if (deps[pkg]) {
      warnings.push(`${pkg} (${info.size}) → Replace with: ${info.alternative}`);
    }
  }
  return warnings;
}
```

---

## 10 Best Practices

1. **Set explicit size budgets** — 150KB initial JS (gzipped) for mobile-first applications
2. **Analyze every build** — generate bundle report in CI; review treemap on major changes
3. **Route-split by default** — every route gets its own chunk via dynamic import
4. **Verify tree shaking** — check `sideEffects: false` in package.json; audit with source-map-explorer
5. **Separate framework chunks** — React/Vue core rarely changes; cache independently
6. **Audit dependencies before installing** — check bundlephobia; prefer tree-shakeable ESM packages
7. **Use modern output targets** — ES2020+ output is 20-30% smaller than ES5
8. **Enable Brotli compression** — 15-20% better than gzip for JS/CSS
9. **Monitor chunk count** — too many small chunks (< 5KB) waste HTTP overhead; merge them
10. **Hash filenames for caching** — use content hashes (`[contenthash]`) for long-term caching

## 8 Anti-Patterns

1. **No size budgets** — bundles grow silently; 50KB becomes 500KB over months
2. **Barrel file re-exports** — `index.ts` re-exporting everything defeats tree shaking
3. **Importing full libraries** — `import _ from 'lodash'` includes everything; use `lodash-es`
4. **Single vendor chunk** — one 500KB vendor chunk means any dep update invalidates cache
5. **Dynamic import in tight loops** — creates request waterfalls; preload anticipated chunks
6. **Skipping source maps analysis** — without it, you cannot verify what is actually in the bundle
7. **Dev dependencies in production** — `devDependencies` leaking into production bundles
8. **Ignoring CSS bundle size** — CSS is render-blocking; 200KB CSS delays FCP significantly

## Enforcement Checklist

- [ ] Bundle size budgets defined in CI config (fail build on exceed)
- [ ] Bundle analyzer report generated on every production build
- [ ] Source maps enabled for analysis (can be stripped from deployment)
- [ ] `sideEffects` field set in all internal package.json files
- [ ] No barrel file re-exports for large module directories
- [ ] Heavy dependencies audited and replaced with lighter alternatives
- [ ] Route-level code splitting implemented for all routes
- [ ] Content-hash filenames used for all static assets
