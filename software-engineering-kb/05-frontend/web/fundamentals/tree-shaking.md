# Tree Shaking — Complete Specification

> **AI Plugin Directive:** When optimizing bundle sizes, configuring dead code elimination, fixing tree-shaking failures, or debugging unexpectedly large bundles, ALWAYS consult this guide. Apply these tree shaking patterns to ensure only used code is included in production bundles. This guide covers ESM requirements, sideEffects configuration, bundler-specific behavior, barrel file problems, common failures, and measurement techniques.

**Core Rule: Tree shaking eliminates unused exports from the final bundle. It REQUIRES ES Modules (import/export) — CommonJS (require/module.exports) CANNOT be tree-shaken. ALWAYS set "sideEffects": false in package.json for libraries. NEVER use barrel files (index.ts re-exports) for large modules — they defeat tree shaking. ALWAYS verify tree shaking effectiveness with bundle analysis.**

---

## 1. How Tree Shaking Works

```
                    TREE SHAKING MECHANISM

  Source Code:
  ┌──────────────────────────────────────────┐
  │  // math.ts                              │
  │  export function add(a, b) { return a+b; } │  ← USED
  │  export function sub(a, b) { return a-b; } │  ← UNUSED
  │  export function mul(a, b) { return a*b; } │  ← UNUSED
  │  export function div(a, b) { return a/b; } │  ← UNUSED
  │                                          │
  │  // app.ts                               │
  │  import { add } from './math';           │
  │  console.log(add(1, 2));                 │
  └──────────────────────────────────────────┘

  After Tree Shaking:
  ┌──────────────────────────────────────────┐
  │  // Only 'add' is included in bundle     │
  │  function add(a, b) { return a+b; }      │
  │  console.log(add(1, 2));                 │
  │                                          │
  │  sub, mul, div are ELIMINATED            │
  └──────────────────────────────────────────┘

  HOW BUNDLERS DO IT:
  ┌──────────────────────────────────────────────────────────┐
  │  1. PARSE: Build dependency graph from import/export     │
  │  2. MARK: Walk the graph, mark all reachable exports     │
  │  3. SWEEP: Remove unmarked (unreachable) code            │
  │  4. MINIFY: Dead code elimination removes empty branches │
  │                                                          │
  │  Tree shaking is a STATIC ANALYSIS technique.            │
  │  It relies on the STATIC structure of ES Modules.        │
  │  CommonJS is DYNAMIC (require can be conditional),       │
  │  so bundlers CANNOT safely remove unused CJS exports.    │
  └──────────────────────────────────────────────────────────┘
```

---

## 2. ES Modules Requirement

```
                    ESM vs COMMONJS for TREE SHAKING

  ES MODULES (Tree-shakeable):
  ┌──────────────────────────────────────────────────────────┐
  │  import { add } from './math';       ← STATIC binding   │
  │  export function add(a, b) {}        ← STATIC export    │
  │                                                          │
  │  Properties:                                             │
  │  ├── Import/export at top level only                     │
  │  ├── Import specifiers are string literals               │
  │  ├── Bindings are determined at parse time               │
  │  ├── Bundler knows EXACTLY what is used                  │
  │  └── Unused exports can be safely removed                │
  └──────────────────────────────────────────────────────────┘

  COMMONJS (NOT Tree-shakeable):
  ┌──────────────────────────────────────────────────────────┐
  │  const { add } = require('./math');  ← DYNAMIC binding  │
  │  module.exports = { add };           ← DYNAMIC export   │
  │                                                          │
  │  Properties:                                             │
  │  ├── require() can be called anywhere (conditional)      │
  │  ├── Path can be a variable: require(`./${name}`)        │
  │  ├── Exports can be mutated at any time                  │
  │  ├── Bundler CANNOT determine what is used statically    │
  │  └── Entire module must be included                      │
  └──────────────────────────────────────────────────────────┘

  EXAMPLES OF NON-TREE-SHAKEABLE PATTERNS:

  // Dynamic require — cannot analyze statically
  const lib = require(condition ? './libA' : './libB');

  // Property access on require — opaque to bundler
  const fn = require('./utils').someFunction;

  // Conditional export mutation
  if (process.env.NODE_ENV === 'production') {
    module.exports.debug = debugFn;
  }

  // Re-exporting CJS from ESM (partial tree shaking)
  export { default as lodash } from 'lodash'; // lodash is CJS internally
```

---

## 3. sideEffects in package.json

```
                    SIDEEFFECTS CONFIGURATION

  WHAT ARE SIDE EFFECTS?
  ├── Code that runs on import and affects global state
  ├── Examples: polyfills, CSS imports, global event listeners
  ├── A "pure" module only exports values — no global changes
  └── Tree shaking needs to know which modules are pure

  WHY sideEffects MATTERS:
  ┌──────────────────────────────────────────────────────────┐
  │  Without sideEffects: false                               │
  │  ├── Bundler KEEPS all imported modules (even if unused)  │
  │  ├── Because a module MIGHT have side effects             │
  │  └── Importing it could change global state               │
  │                                                           │
  │  With sideEffects: false                                   │
  │  ├── Bundler KNOWS all modules are pure                   │
  │  ├── Safe to remove unused modules entirely               │
  │  └── Enables aggressive tree shaking                      │
  └──────────────────────────────────────────────────────────┘
```

### 3.1 Configuring sideEffects

```jsonc
// package.json — For YOUR library
{
  "name": "my-component-library",
  "version": "1.0.0",
  "main": "dist/cjs/index.js",
  "module": "dist/esm/index.js",
  "types": "dist/types/index.d.ts",

  // Option 1: No side effects at all (all modules are pure)
  "sideEffects": false,

  // Option 2: Specific files have side effects
  "sideEffects": [
    "**/*.css",               // CSS imports have side effects
    "**/*.scss",              // SCSS imports have side effects
    "./src/polyfills.ts",     // Polyfill has side effects
    "./src/register.ts"       // Registration has side effects
  ],

  // ALWAYS include CSS files in sideEffects if your package has CSS
  // Otherwise CSS imports will be tree-shaken away!
}
```

```jsonc
// package.json — For YOUR application
{
  "name": "my-app",
  "sideEffects": [
    "**/*.css",
    "**/*.scss",
    "./src/polyfills.ts",
    "./src/analytics.ts"
  ]
}

// OR in webpack.config.ts — Per-module override
module: {
  rules: [
    {
      test: /\.css$/,
      sideEffects: true,  // CSS always has side effects
    },
    {
      test: /\.tsx?$/,
      sideEffects: false,  // TypeScript modules are pure
    },
  ],
},
```

---

## 4. Tree Shaking in Different Bundlers

```
                    BUNDLER TREE SHAKING COMPARISON

  ┌────────────────────┬───────────┬───────────┬──────────────┐
  │                    │ Webpack 5 │ Rollup    │ Vite (Rollup)│
  ├────────────────────┼───────────┼───────────┼──────────────┤
  │ ESM tree shaking   │ Yes       │ Yes       │ Yes          │
  │ CJS tree shaking   │ Partial*  │ No        │ No           │
  │ sideEffects        │ Yes       │ Yes       │ Yes          │
  │ Scope hoisting     │ Yes       │ Yes       │ Yes          │
  │ Pure annotations   │ Yes       │ Yes       │ Yes          │
  │ DCE (dead code)    │ Via Terser│ Built-in  │ Via esbuild  │
  │ Barrel file optim  │ Partial   │ Better    │ Better       │
  │ Class tree shaking │ Partial   │ Better    │ Better       │
  │ Enum tree shaking  │ Needs help│ Better    │ Better       │
  └────────────────────┴───────────┴───────────┴──────────────┘

  * Webpack 5 has some CJS tree shaking via "inner graph" analysis,
    but it's much less effective than ESM tree shaking.
```

### 4.1 Webpack-Specific Configuration

```typescript
// webpack.config.ts
module.exports = {
  mode: 'production',  // REQUIRED — tree shaking only in production mode

  optimization: {
    // Enable tree shaking
    usedExports: true,     // Mark unused exports
    minimize: true,         // Remove dead code via minifier
    sideEffects: true,      // Respect sideEffects in package.json

    // Scope hoisting (concatenateModules)
    // Combines modules into fewer functions for better tree shaking
    concatenateModules: true,

    // Inner graph analysis (Webpack 5)
    // Tracks which exports are used by which modules
    innerGraph: true,

    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            dead_code: true,    // Remove dead code
            drop_console: true, // Remove console.log
            pure_funcs: ['console.log', 'console.info'],
            passes: 2,          // Multiple passes for better DCE
          },
          mangle: true,
        },
      }),
    ],
  },
};
```

### 4.2 Rollup/Vite-Specific Behavior

```typescript
// Rollup has the BEST tree shaking of any bundler
// Vite inherits this for production builds

// vite.config.ts
export default defineConfig({
  build: {
    // Rollup options for tree shaking
    rollupOptions: {
      // Treeshake options
      treeshake: {
        // Mark specific modules as having no side effects
        moduleSideEffects: (id) => {
          if (id.includes('.css')) return true;   // CSS has side effects
          if (id.includes('polyfill')) return true;
          return false; // Everything else is pure
        },
        // Treat property access on objects as side-effect-free
        propertyReadSideEffects: false,
        // Try to treeshake even without sideEffects flag
        tryScopedAnalysis: true,
      },
    },
    // Use terser for more aggressive dead code elimination
    // (esbuild is default and faster, but less thorough)
    minify: 'terser',
    terserOptions: {
      compress: {
        dead_code: true,
        passes: 2,
      },
    },
  },
});
```

---

## 5. Pure Annotations (/*#__PURE__*/)

```
                    PURE ANNOTATIONS

  Problem: Bundlers can't always determine if a function call
  has side effects. For example:

  const result = expensiveSetup();  ← Does this mutate globals?

  Solution: Tell the bundler this call is pure:
  const result = /*#__PURE__*/ expensiveSetup();  ← Safe to remove

  WHEN TO USE:
  ├── Factory functions that return values without side effects
  ├── Object.freeze(), Object.assign() wrappers
  ├── Class instantiation for module-level constants
  ├── Library code that creates HOCs or composed functions
  └── React.forwardRef, React.memo at module level
```

```typescript
// Pure annotation examples

// React.forwardRef and React.memo
export const Button = /*#__PURE__*/ React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => <button ref={ref} {...props} />
);

export const MemoizedList = /*#__PURE__*/ React.memo(ListComponent);

// Factory functions
export const createStore = /*#__PURE__*/ configureStore({
  reducer: rootReducer,
});

// Class instantiation
const logger = /*#__PURE__*/ new Logger('app');

// Composed functions
export const enhancedFetch = /*#__PURE__*/ compose(
  withRetry(3),
  withTimeout(5000),
  withLogging
)(fetch);

// Object creation
export const defaultConfig = /*#__PURE__*/ Object.freeze({
  apiUrl: '/api',
  timeout: 5000,
});

// TypeScript enum alternative (tree-shakeable)
// Regular TS enums compile to IIFE which is NOT tree-shakeable
// Use const objects instead:
export const Color = {
  Red: 'red',
  Green: 'green',
  Blue: 'blue',
} as const;
export type Color = (typeof Color)[keyof typeof Color];
// Each property is individually tree-shakeable
```

---

## 6. Barrel File Problems

```
                    BARREL FILE ANTI-PATTERN

  A "barrel file" is an index.ts that re-exports from multiple modules:

  // components/index.ts (BARREL FILE)
  export { Button } from './Button';
  export { Input } from './Input';
  export { Modal } from './Modal';       // 50KB (includes animation library)
  export { DataTable } from './DataTable'; // 100KB (includes grid library)
  export { RichEditor } from './RichEditor'; // 200KB (includes editor engine)

  THE PROBLEM:
  ┌──────────────────────────────────────────────────────────┐
  │  // app.ts                                               │
  │  import { Button } from '@/components';                  │
  │  // ↑ Imports from barrel file (index.ts)                │
  │  // ↑ Bundler MAY include ALL re-exported modules        │
  │  // ↑ You wanted 5KB (Button) but got 355KB              │
  │                                                          │
  │  WHY it happens:                                         │
  │  1. Bundler evaluates index.ts                           │
  │  2. Sees import of './Modal' — must check for side effects│
  │  3. Modal imports animation library (side effect?)       │
  │  4. Without sideEffects: false, bundler keeps everything │
  │  5. Even WITH sideEffects: false, some bundlers struggle │
  └──────────────────────────────────────────────────────────┘

  THE IMPACT:
  ┌─────────────────────────────────────────────────┐
  │  Import                    │ Expected │ Actual   │
  ├────────────────────────────┼──────────┼──────────│
  │  import { Button }         │ 5KB      │ 5-355KB  │
  │  from '@/components'       │          │          │
  │                            │          │          │
  │  import { Button }         │ 5KB      │ 5KB      │
  │  from '@/components/Button'│          │ (always) │
  └─────────────────────────────────────────────────┘
```

### 6.1 Barrel File Solutions

```typescript
// SOLUTION 1: Direct imports (BEST for application code)
// BAD
import { Button, Input } from '@/components';

// GOOD
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

// SOLUTION 2: Configure barrel file optimizations

// Next.js — optimizePackageImports (next.config.js)
module.exports = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',       // Icon library with 1000+ icons
      '@radix-ui/react-*',  // Radix UI components
      'lodash-es',          // Lodash ESM
      '@/components',       // Your own barrel files
    ],
  },
};
// Next.js will transform: import { X } from 'pkg' → import X from 'pkg/X'

// SOLUTION 3: Webpack resolve.alias to bypass barrels
resolve: {
  alias: {
    // Redirect barrel imports to direct paths
    'lodash-es': path.resolve(__dirname, 'node_modules/lodash-es'),
  },
},

// SOLUTION 4: babel-plugin-transform-imports / modularize-import-plugin
// Automatically transforms barrel imports to direct imports at build time
// babel config:
{
  "plugins": [
    ["transform-imports", {
      "lodash": {
        "transform": "lodash/${member}",
        "preventFullImport": true
      },
      "@/components": {
        "transform": "@/components/${member}/${member}",
        "preventFullImport": true
      }
    }]
  ]
}

// SOLUTION 5: For library authors — use package.json exports map
{
  "name": "my-ui-library",
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    },
    "./Button": {
      "import": "./dist/esm/Button.js",
      "require": "./dist/cjs/Button.js"
    },
    "./Input": {
      "import": "./dist/esm/Input.js",
      "require": "./dist/cjs/Input.js"
    }
  },
  "sideEffects": false
}
// Consumers can: import { Button } from 'my-ui-library/Button'
```

---

## 7. Common Tree-Shaking Failures

```
                    WHY TREE SHAKING FAILS

  FAILURE 1: CommonJS modules
  ┌────────────────────────────────────────────────────┐
  │  const { pick } = require('lodash');               │
  │  ↑ CJS — entire lodash included (~70KB)            │
  │                                                    │
  │  FIX: import pick from 'lodash-es/pick';           │
  │  OR:  import { pick } from 'lodash-es';            │
  │       + sideEffects: false                         │
  └────────────────────────────────────────────────────┘

  FAILURE 2: Side effects in module scope
  ┌────────────────────────────────────────────────────┐
  │  // utils.ts                                       │
  │  window.MY_LIB_VERSION = '1.0.0';  ← side effect  │
  │  export function add(a, b) { return a + b; }      │
  │                                                    │
  │  Even if add() is unused, the module is kept       │
  │  because of the window mutation.                   │
  │                                                    │
  │  FIX: Remove global side effects from exports      │
  └────────────────────────────────────────────────────┘

  FAILURE 3: TypeScript enums
  ┌────────────────────────────────────────────────────┐
  │  enum Color { Red, Green, Blue }                   │
  │  ↑ Compiles to an IIFE (function call = side effect)│
  │                                                    │
  │  Compiled output:                                  │
  │  var Color;                                        │
  │  (function(Color) {                                │
  │    Color[Color["Red"] = 0] = "Red";                │
  │    // ...                                          │
  │  })(Color || (Color = {}));                        │
  │  ↑ IIFE — bundler can't prove it's side-effect-free│
  │                                                    │
  │  FIX: Use const enum or const object               │
  │  const enum Color { Red, Green, Blue } // Inlined  │
  │  OR: const Color = { Red: 0, ... } as const;      │
  └────────────────────────────────────────────────────┘

  FAILURE 4: Class with decorators or static properties
  ┌────────────────────────────────────────────────────┐
  │  @Injectable()                                     │
  │  class UserService {                               │
  │    static instance = new UserService();             │
  │  }                                                 │
  │  ↑ Decorator call + static initialization = side effects│
  │                                                    │
  │  FIX: Avoid decorators; use factory functions       │
  │  OR: /*#__PURE__*/ annotation on class expression  │
  └────────────────────────────────────────────────────┘

  FAILURE 5: Re-exporting with side effects
  ┌────────────────────────────────────────────────────┐
  │  // index.ts                                       │
  │  export { Chart } from './Chart'; // Chart imports d3│
  │  // d3 has module-level side effects               │
  │  // Even if Chart is unused, d3 might be included  │
  │                                                    │
  │  FIX: sideEffects: false + direct imports          │
  └────────────────────────────────────────────────────┘

  FAILURE 6: Dynamic property access
  ┌────────────────────────────────────────────────────┐
  │  import * as utils from './utils';                 │
  │  const fn = utils[dynamicKey];                     │
  │  ↑ Bundler can't determine which exports are used  │
  │                                                    │
  │  FIX: Import specific named exports                │
  │  import { specificFn } from './utils';              │
  └────────────────────────────────────────────────────┘

  FAILURE 7: Module-level function calls
  ┌────────────────────────────────────────────────────┐
  │  export const config = createConfig({              │
  │    debug: true,                                    │
  │  });                                               │
  │  ↑ createConfig() call is a potential side effect  │
  │                                                    │
  │  FIX: export const config = /*#__PURE__*/ createConfig({│
  │    debug: true,                                    │
  │  });                                               │
  └────────────────────────────────────────────────────┘

  FAILURE 8: CSS-in-JS tagged templates
  ┌────────────────────────────────────────────────────┐
  │  export const unused = styled.div`color: red;`;    │
  │  ↑ styled.div`` is a function call — side effect?  │
  │  ↑ Bundler may keep it even if unused              │
  │                                                    │
  │  FIX: This is a known limitation of runtime CSS-in-JS│
  │  Zero-runtime alternatives don't have this problem  │
  └────────────────────────────────────────────────────┘
```

---

## 8. Measuring Tree Shaking Effectiveness

```
                    MEASUREMENT TECHNIQUES

  TECHNIQUE 1: Bundle Analyzer (Visual)
  ├── webpack-bundle-analyzer or rollup-plugin-visualizer
  ├── Look for unexpectedly large modules
  ├── Check if unused libraries appear in the graph
  └── Compare module sizes to expected sizes

  TECHNIQUE 2: Source Map Explorer
  ├── npx source-map-explorer dist/main.*.js
  ├── Shows exact byte contribution of each module
  ├── Identifies which files are largest
  └── Works with any bundler that produces source maps

  TECHNIQUE 3: Import Cost VS Code Extension
  ├── Shows size of each import inline in editor
  ├── Immediately see impact of adding dependencies
  └── Distinguishes gzip vs minified size

  TECHNIQUE 4: Bundlephobia (Web)
  ├── bundlephobia.com — check package sizes before installing
  ├── Shows tree-shakeable portion of packages
  ├── Shows side effects status
  └── Shows download time estimates

  TECHNIQUE 5: Custom Script
  Compare build output with and without specific imports
```

### 8.1 Automated Size Tracking

```typescript
// scripts/check-tree-shaking.ts
import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

function getChunkSizes(buildDir: string): Map<string, number> {
  const sizes = new Map<string, number>();
  const files = readdirSync(buildDir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(buildDir, file);
    const stats = statSync(filePath);
    sizes.set(file, stats.size);
  }

  return sizes;
}

function checkBudgets(sizes: Map<string, number>) {
  const budgets: Record<string, number> = {
    'main': 100_000,     // 100KB
    'vendor': 150_000,   // 150KB
    'total': 300_000,    // 300KB total JS
  };

  let totalSize = 0;
  const violations: string[] = [];

  for (const [file, size] of sizes) {
    totalSize += size;

    for (const [budget, limit] of Object.entries(budgets)) {
      if (budget !== 'total' && file.includes(budget) && size > limit) {
        violations.push(
          `${file}: ${(size / 1024).toFixed(1)}KB exceeds ${budget} budget of ${(limit / 1024).toFixed(1)}KB`
        );
      }
    }
  }

  if (totalSize > budgets.total) {
    violations.push(
      `Total JS: ${(totalSize / 1024).toFixed(1)}KB exceeds budget of ${(budgets.total / 1024).toFixed(1)}KB`
    );
  }

  if (violations.length > 0) {
    console.error('Bundle size budget violations:');
    violations.forEach((v) => console.error(`  - ${v}`));
    process.exit(1);
  }

  console.log('All bundle size budgets passed');
  for (const [file, size] of sizes) {
    console.log(`  ${file}: ${(size / 1024).toFixed(1)}KB`);
  }
}

// Run
execSync('npm run build', { stdio: 'inherit' });
const sizes = getChunkSizes('./dist/assets');
checkBudgets(sizes);
```

---

## 9. Library Author Best Practices

```
PUBLISHING TREE-SHAKEABLE LIBRARIES:

1. Ship ESM format
   ├── "module" field points to ESM entry
   ├── "exports" map with "import" condition
   ├── Use .mjs extension or "type": "module"
   └── NEVER ship only CommonJS

2. Set sideEffects
   ├── "sideEffects": false for pure libraries
   ├── Include CSS files in sideEffects array
   └── Audit every file for actual side effects

3. Use package.json "exports" map
   {
     "exports": {
       ".": { "import": "./esm/index.js", "require": "./cjs/index.js" },
       "./utils": { "import": "./esm/utils.js" },
       "./styles.css": "./styles.css"
     }
   }

4. Avoid barrel files for large packages
   ├── 100+ exports in one index.ts = tree shaking challenge
   ├── Offer direct import paths: 'my-lib/Button'
   └── Or use optimizePackageImports-compatible structure

5. Use /*#__PURE__*/ annotations
   ├── On React.forwardRef, React.memo calls
   ├── On factory functions at module level
   └── On any module-level function call that is actually pure

6. Avoid TypeScript enums
   ├── Use const enums or const objects
   └── Regular enums compile to non-tree-shakeable IIFEs

7. Avoid module-level side effects
   ├── No global mutations
   ├── No console.log at module level
   ├── No window/document access at module level
   └── Move initialization to explicit init() functions

8. Provide size reporting
   ├── Include bundlephobia badge in README
   ├── Document tree-shakeable vs full size
   └── Run size-limit in CI
```

---

## 10. Anti-Patterns

```
TREE SHAKING ANTI-PATTERNS — NEVER DO THESE:

1. Using CommonJS for new packages
   BAD:  module.exports = { add, sub }
   GOOD: export { add, sub }

2. Forgetting sideEffects in package.json
   BAD:  No sideEffects field (bundler assumes everything has side effects)
   GOOD: "sideEffects": false (or array of files with side effects)

3. Barrel files for large module sets
   BAD:  export { A, B, C, D, ... Z } from 100 files in index.ts
   GOOD: Direct imports: import { A } from './components/A'

4. import * as everything
   BAD:  import * as utils from './utils'; utils[key]();
   GOOD: import { specificUtil } from './utils';

5. Regular TypeScript enums in libraries
   BAD:  enum Status { Active, Inactive }
   GOOD: const Status = { Active: 'active', Inactive: 'inactive' } as const;

6. Module-level side effects in library code
   BAD:  // In a module that also exports functions
         window.MY_LIB = true;
   GOOD: export function init() { window.MY_LIB = true; }

7. Not verifying tree shaking works
   BAD:  Assuming tree shaking works without checking
   GOOD: Run bundle analyzer, verify unused code is eliminated

8. Using default exports for libraries with multiple exports
   BAD:  export default { add, sub, mul, div }
   GOOD: export { add, sub, mul, div } (named exports)
   WHY:  Default export of an object is one opaque value — not tree-shakeable

9. Dynamic imports of entire namespaces
   BAD:  const mod = await import('./huge-module'); mod[dynamicKey]();
   GOOD: Use static imports where possible, or split dynamic module

10. Not providing ESM entry in package.json
    BAD:  { "main": "./dist/index.js" } (CJS only)
    GOOD: { "main": "./dist/cjs/index.js", "module": "./dist/esm/index.js" }
```

---

## 11. Decision Matrix: Optimizing Tree Shaking

```
TREE SHAKING CHECKLIST FOR ANY PROJECT:

Source Code:
├── [ ] Using ES Modules (import/export) throughout
├── [ ] No CommonJS (require/module.exports) in app code
├── [ ] Named exports preferred over default exports
├── [ ] No barrel files for large module collections
├── [ ] TypeScript enums replaced with const objects
├── [ ] /*#__PURE__*/ on module-level function calls
├── [ ] No module-level side effects in utility modules
└── [ ] Direct imports instead of namespace imports

Package Configuration:
├── [ ] "sideEffects": false (or array) in package.json
├── [ ] "module" field points to ESM build
├── [ ] "exports" map for subpath imports
├── [ ] CSS files listed in sideEffects array
└── [ ] "type": "module" for ESM-first packages

Bundler Configuration:
├── [ ] Production mode enabled (mode: 'production')
├── [ ] Minification enabled (Terser or esbuild)
├── [ ] usedExports: true (Webpack)
├── [ ] concatenateModules: true (Webpack scope hoisting)
└── [ ] treeshake options configured (Rollup/Vite)

Verification:
├── [ ] Bundle analyzer shows no unexpected large modules
├── [ ] Size budgets configured and passing in CI
├── [ ] Import-cost extension installed for developers
├── [ ] Compared build size before/after major dependency adds
└── [ ] Checked bundlephobia before adding new dependencies
```
