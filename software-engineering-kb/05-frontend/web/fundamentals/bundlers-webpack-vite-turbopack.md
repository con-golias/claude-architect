# Webpack vs Vite vs Turbopack — Complete Specification

> **AI Plugin Directive:** When choosing a bundler, configuring build tools, migrating between bundlers, or optimizing build performance, ALWAYS consult this guide. Apply these bundler patterns to select the right tool for your project constraints. This guide covers Webpack, Vite, Turbopack, their architectures, configuration patterns, migration strategies, plugin systems, and performance characteristics.

**Core Rule: For NEW projects (2024+), use Vite as the default bundler — it provides the fastest dev experience and excellent production builds via Rollup. Use Webpack ONLY for existing projects or when specific Webpack plugins are required. Turbopack is recommended ONLY when using Next.js (where it is integrated). NEVER mix bundlers in the same project. ALWAYS configure code splitting, tree shaking, and source maps appropriately for each environment.**

---

## 1. Architecture Comparison

```
                    BUNDLER ARCHITECTURES

  WEBPACK (Bundle-Based Dev Server):
  ┌────────────────────────────────────────────────────────┐
  │  Source Files → Webpack → Full Bundle → Browser        │
  │                                                        │
  │  1. Read ALL files in dependency graph                 │
  │  2. Transform with loaders (Babel, TypeScript, etc.)   │
  │  3. Bundle everything into chunks                      │
  │  4. Serve bundled files to browser                     │
  │  5. HMR: Rebuild changed module + dependents           │
  │                                                        │
  │  Cold start: SLOW (must process entire app)            │
  │  HMR: Moderate (rebundles affected subgraph)           │
  │  Production: Mature, highly optimizable                │
  └────────────────────────────────────────────────────────┘

  VITE (Native ESM Dev Server):
  ┌────────────────────────────────────────────────────────┐
  │  Dev: Source Files → esbuild (deps) + ESM → Browser    │
  │  Prod: Source Files → Rollup → Optimized Bundle        │
  │                                                        │
  │  Dev server:                                           │
  │  1. Pre-bundle dependencies with esbuild (once)        │
  │  2. Serve source files as native ES modules            │
  │  3. Browser requests files on-demand                   │
  │  4. Transform on-demand (only requested files)         │
  │  5. HMR: Update single module (precise)                │
  │                                                        │
  │  Cold start: FAST (no bundling of app code)            │
  │  HMR: FAST (single file transform)                     │
  │  Production: Rollup (mature tree-shaking + splitting)  │
  └────────────────────────────────────────────────────────┘

  TURBOPACK (Incremental Computation):
  ┌────────────────────────────────────────────────────────┐
  │  Source Files → Turbopack (Rust) → Incremental Bundle  │
  │                                                        │
  │  1. Rust-based incremental computation engine          │
  │  2. Function-level caching (like a build database)     │
  │  3. Only recomputes what changed                       │
  │  4. Lazy bundling (only bundles requested routes)      │
  │  5. HMR: Extremely fast (cached computation graph)     │
  │                                                        │
  │  Cold start: FAST (Rust speed + lazy loading)          │
  │  HMR: VERY FAST (incremental, cached)                  │
  │  Production: Still maturing (Next.js only as of 2024)  │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Feature Comparison

```
┌──────────────────────┬──────────────┬──────────────┬──────────────────┐
│                      │ Webpack 5    │ Vite 5+      │ Turbopack        │
├──────────────────────┼──────────────┼──────────────┼──────────────────┤
│ Language             │ JavaScript   │ JavaScript   │ Rust             │
│ Dev server           │ Bundle-based │ Native ESM   │ Incremental      │
│ Production bundler   │ Webpack      │ Rollup       │ Turbopack*       │
│ HMR speed            │ Moderate     │ Fast         │ Very fast        │
│ Cold start (dev)     │ 10-30s+      │ <1s          │ <2s              │
│ Config complexity    │ High         │ Low          │ Minimal (Next.js)│
│ Plugin ecosystem     │ Huge         │ Growing      │ Next.js built-in │
│ TypeScript support   │ Via loader   │ Native       │ Native           │
│ JSX support          │ Via loader   │ Native       │ Native           │
│ CSS Modules          │ Via loader   │ Native       │ Native           │
│ PostCSS              │ Via loader   │ Native       │ Native           │
│ Code splitting       │ Excellent    │ Excellent    │ Good             │
│ Tree shaking         │ Good         │ Excellent    │ Good             │
│ Source maps          │ Configurable │ Configurable │ Automatic        │
│ SSR support          │ Manual       │ Built-in     │ Next.js          │
│ Library mode         │ Yes          │ Yes          │ No               │
│ Module Federation    │ Yes          │ Plugin       │ No               │
│ WASM support         │ Yes          │ Yes          │ Limited          │
│ Maturity             │ Very mature  │ Mature       │ Beta/Stable*     │
│ Framework agnostic   │ Yes          │ Yes          │ Next.js only     │
│ Monorepo support     │ Manual       │ Good         │ Via Next.js      │
│ Persistent cache     │ filesystem   │ N/A (ESM)    │ Built-in         │
└──────────────────────┴──────────────┴──────────────┴──────────────────┘

  * Turbopack production builds became stable in Next.js 15
  * Turbopack is tightly coupled to Next.js
```

---

## 3. Webpack Configuration

```typescript
// webpack.config.ts
import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

const isDev = process.env.NODE_ENV !== 'production';

const config: webpack.Configuration = {
  mode: isDev ? 'development' : 'production',

  entry: {
    main: './src/index.tsx',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isDev ? '[name].js' : '[name].[contenthash:8].js',
    chunkFilename: isDev ? '[name].chunk.js' : '[name].[contenthash:8].chunk.js',
    publicPath: '/',
    clean: true,
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  module: {
    rules: [
      // TypeScript/JSX — use swc-loader for speed (or babel-loader)
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript', tsx: true },
              transform: { react: { runtime: 'automatic' } },
            },
          },
        },
      },

      // CSS Modules
      {
        test: /\.module\.css$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: isDev
                  ? '[name]__[local]__[hash:base64:5]'
                  : '[hash:base64:8]',
                exportLocalsConvention: 'camelCaseOnly',
              },
            },
          },
          'postcss-loader',
        ],
      },

      // Global CSS
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
        ],
      },

      // Assets
      {
        test: /\.(png|jpe?g|gif|svg|webp|avif)$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 8192 } },
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/,
        type: 'asset/resource',
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new ForkTsCheckerWebpackPlugin(), // Type checking in separate process

    // Production only
    ...(!isDev
      ? [
          new MiniCssExtractPlugin({
            filename: '[name].[contenthash:8].css',
            chunkFilename: '[name].[contenthash:8].chunk.css',
          }),
        ]
      : []),

    // Bundle analysis (run with ANALYZE=true)
    ...(process.env.ANALYZE
      ? [new BundleAnalyzerPlugin()]
      : []),
  ],

  optimization: {
    minimize: !isDev,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: { drop_console: true },
        },
      }),
      new CssMinimizerPlugin(),
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          priority: 10,
        },
        commons: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    runtimeChunk: 'single',
  },

  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    open: true,
  },

  devtool: isDev ? 'eval-cheap-module-source-map' : 'source-map',

  // Performance budget
  performance: {
    hints: isDev ? false : 'warning',
    maxEntrypointSize: 250000,  // 250KB
    maxAssetSize: 250000,
  },

  cache: {
    type: 'filesystem',  // Persistent cache for faster rebuilds
  },
};

export default config;
```

---

## 4. Vite Configuration

```typescript
// vite.config.ts
import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react-swc'; // SWC-based React plugin (fast)
import tsconfigPaths from 'vite-tsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tsconfigPaths(),           // Resolve @ paths from tsconfig
    splitVendorChunkPlugin(),  // Separate vendor chunk

    // Bundle analysis
    mode === 'analyze' &&
      visualizer({
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ],

  // ─── Dev Server ───
  server: {
    port: 3000,
    open: true,
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  // ─── CSS ───
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: mode === 'production'
        ? '[hash:base64:5]'
        : '[name]__[local]__[hash:base64:5]',
    },
    postcss: './postcss.config.cjs',
    devSourcemap: true,
  },

  // ─── Build (Rollup) ───
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    // Chunk size warning
    chunkSizeWarningLimit: 250, // 250KB

    rollupOptions: {
      output: {
        // Manual chunk splitting
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
        },
        // Asset file naming
        assetFileNames: 'assets/[name].[hash:8][extname]',
        chunkFileNames: 'chunks/[name].[hash:8].js',
        entryFileNames: '[name].[hash:8].js',
      },
    },
    // CSS code splitting
    cssCodeSplit: true,
    // Minification
    minify: 'esbuild', // or 'terser' for more aggressive minification
  },

  // ─── Dependency Pre-Bundling ───
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      // Force pre-bundle problematic deps
    ],
    exclude: [
      // Don't pre-bundle packages that need to be ESM
    ],
  },

  // ─── Resolve ───
  resolve: {
    alias: {
      '@': '/src',
    },
  },

  // ─── Environment Variables ───
  // Only VITE_ prefixed env vars are exposed to client
  envPrefix: 'VITE_',

  // ─── Preview (production preview server) ───
  preview: {
    port: 4173,
  },
}));
```

### 4.1 Vite Library Mode

```typescript
// vite.config.ts — Library mode for publishing packages
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MyLib',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    sourcemap: true,
    minify: false, // Let consumers minify
  },
});
```

---

## 5. Turbopack (Next.js)

```typescript
// next.config.ts — Turbopack is configured via Next.js
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable Turbopack (stable in Next.js 15+ for dev)
  // Run: next dev --turbopack
  // No explicit config needed — it's a CLI flag

  // Turbopack-specific configuration:
  experimental: {
    turbo: {
      // Custom resolve aliases
      resolveAlias: {
        '@': './src',
      },
      // Custom resolve extensions
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
      // Module rules (like Webpack loaders)
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
};

export default nextConfig;

// TURBOPACK STATUS:
// ├── Dev server: Stable (Next.js 14.2+)
// ├── Production builds: Stable (Next.js 15+)
// ├── CSS Modules: Supported
// ├── PostCSS: Supported
// ├── Tailwind CSS: Supported
// ├── Sass/SCSS: Supported
// ├── TypeScript: Supported
// ├── Image optimization: Supported
// └── Custom Webpack config: NOT all options supported
```

---

## 6. Dev Server Architecture Deep Dive

```
                    DEV SERVER COMPARISON

  WEBPACK DEV SERVER:
  ┌────────────────────────────────────────────────────────────┐
  │  Request: /src/App.tsx                                     │
  │  │                                                         │
  │  ├── 1. Webpack has already bundled everything at startup  │
  │  ├── 2. Serves from in-memory bundle                      │
  │  ├── 3. File change → rebuild affected chunks              │
  │  ├── 4. WebSocket pushes update to browser                │
  │  └── 5. Browser applies HMR update                        │
  │                                                            │
  │  Problem: Step 1 takes 10-30+ seconds on large projects    │
  └────────────────────────────────────────────────────────────┘

  VITE DEV SERVER:
  ┌────────────────────────────────────────────────────────────┐
  │  Startup:                                                  │
  │  ├── 1. Pre-bundle node_modules with esbuild (~1s)        │
  │  ├── 2. Start HTTP server immediately                     │
  │  └── 3. NO app code bundling at startup                   │
  │                                                            │
  │  Request: /src/App.tsx                                     │
  │  ├── 1. Browser requests module via ESM import             │
  │  ├── 2. Vite transforms JUST this file on-demand           │
  │  ├── 3. Returns native ES module                          │
  │  └── 4. Browser follows import graph, requesting more      │
  │                                                            │
  │  File change:                                              │
  │  ├── 1. Vite invalidates ONLY the changed module           │
  │  ├── 2. Browser re-fetches just that module                │
  │  └── 3. HMR boundary handles state preservation            │
  │                                                            │
  │  WHY it's fast:                                            │
  │  ├── No bundling at startup                                │
  │  ├── On-demand transformation (lazy)                       │
  │  ├── esbuild pre-bundles deps (10-100x faster than Webpack)│
  │  └── Native ESM — browser does the module graph work       │
  └────────────────────────────────────────────────────────────┘

  TRADE-OFF:
  ├── Vite dev: Fast startup, but first page load can be slow
  │   (browser makes many HTTP requests for individual modules)
  ├── Webpack dev: Slow startup, but fast subsequent page loads
  │   (everything is already bundled)
  ├── Turbopack: Fast startup + fast page loads
  │   (incremental bundling, caches aggressively)
  └── For most projects, Vite's trade-off is better (fast startup wins)
```

---

## 7. HMR Implementation Differences

```
                    HOT MODULE REPLACEMENT

  WEBPACK HMR:
  ├── Rebuilds affected chunk(s)
  ├── Sends entire chunk update over WebSocket
  ├── Browser replaces module in memory
  ├── React Fast Refresh handles component state
  ├── Speed: Proportional to chunk size (~100ms-2s)
  └── Can be slow for large chunks

  VITE HMR:
  ├── Transforms ONLY the changed file
  ├── Sends module URL over WebSocket
  ├── Browser fetches updated module via ESM
  ├── HMR boundary propagation (walks up import tree)
  ├── React Fast Refresh handles component state
  ├── Speed: Nearly instant (<50ms typically)
  └── Independent of project size

  TURBOPACK HMR:
  ├── Incremental computation — only recomputes changed functions
  ├── Rust-level performance for transforms
  ├── Persistent cache across restarts
  ├── Speed: Near-instant (<50ms typically)
  └── Gets FASTER as cache warms up

  HMR BOUNDARY RULES (all bundlers):
  ├── Component file changes → Fast Refresh (preserves state)
  ├── Non-component export changes → Full module reload
  ├── Context/hook changes → May require full refresh
  ├── CSS changes → Always hot-reloaded (no state loss)
  └── Config changes → Always require restart
```

---

## 8. Plugin Systems

```
                    PLUGIN ARCHITECTURE COMPARISON

  WEBPACK:
  ├── Loaders: Transform files (babel-loader, css-loader)
  │   └── Chained pipeline: file → loader1 → loader2 → output
  ├── Plugins: Tap into build lifecycle hooks
  │   └── Compiler hooks: beforeRun, compile, emit, done, etc.
  ├── ResolverPlugins: Customize module resolution
  └── ~80,000+ npm packages with "webpack" keyword

  VITE:
  ├── Rollup-compatible plugins (most Rollup plugins work)
  ├── Vite-specific hooks:
  │   ├── configureServer — customize dev server
  │   ├── transformIndexHtml — modify index.html
  │   ├── handleHotUpdate — custom HMR logic
  │   └── config — modify Vite config
  ├── Plugin ordering: enforce: 'pre' | 'post'
  ├── Apply conditionally: apply: 'build' | 'serve'
  └── Growing ecosystem (~5,000+ plugins)

  TURBOPACK:
  ├── Limited plugin API (Rust-based, not extensible like Webpack)
  ├── Some Webpack loaders are compatible
  ├── Configuration via next.config.js turbo.rules
  └── Plugin ecosystem: Next.js plugins only
```

### 8.1 Writing a Vite Plugin

```typescript
// vite-plugin-example.ts
import type { Plugin, ViteDevServer } from 'vite';

export function myPlugin(options: { prefix?: string } = {}): Plugin {
  const prefix = options.prefix ?? '[my-plugin]';

  return {
    name: 'vite-plugin-my-plugin',  // REQUIRED: unique plugin name
    enforce: 'pre',                 // Run before other plugins

    // Modify Vite config
    config(config, { command }) {
      if (command === 'build') {
        return { build: { sourcemap: true } };
      }
    },

    // Transform module code
    transform(code, id) {
      if (id.endsWith('.tsx')) {
        // Modify source code
        return {
          code: code.replace(/__PREFIX__/g, prefix),
          map: null, // Provide source map if modifying code
        };
      }
    },

    // Configure dev server
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/health', (req, res) => {
        res.end(JSON.stringify({ status: 'ok' }));
      });
    },

    // Modify HTML
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `<script>window.__BUILD_TIME__ = "${new Date().toISOString()}";</script></head>`
      );
    },

    // Custom HMR
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.tokens.json')) {
        // Full reload when design tokens change
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}
```

---

## 9. Migration: Webpack to Vite

```
                    MIGRATION CHECKLIST

  PHASE 1: Assessment
  ├── Inventory Webpack plugins and loaders
  ├── Check Vite compatibility for each
  ├── Identify custom Webpack config that needs Vite equivalent
  ├── Check for CommonJS-only dependencies (may need optimizeDeps)
  └── Review environment variable usage (REACT_APP_ → VITE_)

  PHASE 2: Setup
  ├── Install Vite and framework plugin (@vitejs/plugin-react)
  ├── Create vite.config.ts
  ├── Move index.html to project root (Vite requirement)
  ├── Add <script type="module" src="/src/main.tsx"> to HTML
  ├── Update tsconfig.json paths
  └── Configure environment variables

  PHASE 3: Migrate Configuration
  ├── Loaders → Vite built-in or plugins
  │   ├── babel-loader → @vitejs/plugin-react (or -swc)
  │   ├── ts-loader → Built-in (esbuild)
  │   ├── css-loader → Built-in
  │   ├── postcss-loader → Built-in (postcss.config.js)
  │   ├── file-loader/url-loader → Built-in (asset handling)
  │   ├── svg-loader → vite-plugin-svgr
  │   └── raw-loader → ?raw suffix (import txt from './file.txt?raw')
  │
  ├── Plugins → Vite equivalents
  │   ├── HtmlWebpackPlugin → Built-in (index.html in root)
  │   ├── MiniCssExtractPlugin → Built-in
  │   ├── DefinePlugin → define config option
  │   ├── CopyWebpackPlugin → vite-plugin-static-copy
  │   ├── BundleAnalyzerPlugin → rollup-plugin-visualizer
  │   └── ForkTsCheckerPlugin → vite-plugin-checker
  │
  └── Features
      ├── require() → import (must convert to ESM)
      ├── require.context → import.meta.glob
      ├── process.env → import.meta.env
      └── __dirname → import.meta.url

  PHASE 4: Codebase Updates
  ├── Replace process.env.REACT_APP_* with import.meta.env.VITE_*
  ├── Convert require() to import
  ├── Convert require.context to import.meta.glob
  ├── Update path aliases in tsconfig.json
  └── Fix any CommonJS-only imports

  PHASE 5: Validation
  ├── Dev server starts and all pages work
  ├── HMR works for component and CSS changes
  ├── Production build succeeds
  ├── Bundle size is equivalent or smaller
  ├── All environment variables are accessible
  └── Remove Webpack dependencies from package.json
```

```typescript
// Common migration patterns

// BEFORE (Webpack): require.context
const modules = require.context('./modules', true, /\.tsx$/);
modules.keys().forEach((key) => {
  const module = modules(key);
  // ...
});

// AFTER (Vite): import.meta.glob
const modules = import.meta.glob('./modules/**/*.tsx', { eager: true });
for (const [path, module] of Object.entries(modules)) {
  // ...
}

// Lazy glob (code-split each module)
const lazyModules = import.meta.glob('./modules/**/*.tsx');
// Returns: { './modules/Foo.tsx': () => import('./modules/Foo.tsx') }

// BEFORE (Webpack): process.env
const apiUrl = process.env.REACT_APP_API_URL;

// AFTER (Vite): import.meta.env
const apiUrl = import.meta.env.VITE_API_URL;

// BEFORE (Webpack): raw import
import readme from '!!raw-loader!./README.md';

// AFTER (Vite): ?raw suffix
import readme from './README.md?raw';

// BEFORE (Webpack): SVG as component
import { ReactComponent as Logo } from './logo.svg';

// AFTER (Vite): vite-plugin-svgr
import Logo from './logo.svg?react';
```

---

## 10. Build Performance

```
                    BUILD PERFORMANCE BENCHMARKS
                    (Approximate — varies by project)

  Project: 500 modules, 100K lines TypeScript + React

  ┌─────────────────────┬───────────┬───────────┬──────────────┐
  │                     │ Webpack 5 │ Vite 5    │ Turbopack    │
  ├─────────────────────┼───────────┼───────────┼──────────────┤
  │ Cold start (dev)    │ 15-30s    │ 0.5-2s    │ 1-3s         │
  │ HMR (component)     │ 200-800ms │ 20-50ms   │ 10-40ms      │
  │ HMR (CSS)           │ 100-500ms │ <20ms     │ <20ms        │
  │ Production build    │ 30-90s    │ 15-45s    │ 20-50s*      │
  │ Incremental rebuild │ 5-15s     │ 10-30s    │ 2-8s         │
  │ Memory usage (dev)  │ 500MB-2GB │ 200-500MB │ 300-800MB    │
  └─────────────────────┴───────────┴───────────┴──────────────┘

  * Turbopack production benchmarks are for Next.js 15+ projects

  WEBPACK OPTIMIZATION TIPS:
  ├── Enable filesystem cache: cache: { type: 'filesystem' }
  ├── Use swc-loader instead of babel-loader (10x faster)
  ├── Use thread-loader for parallelizing expensive loaders
  ├── Set resolve.extensions carefully (fewer = faster)
  ├── Use DllPlugin for large unchanging dependencies
  └── Profile with --profile and speed-measure-webpack-plugin

  VITE OPTIMIZATION TIPS:
  ├── Pre-bundle heavy deps: optimizeDeps.include
  ├── Use @vitejs/plugin-react-swc (faster than Babel)
  ├── Minimize plugins (each plugin adds transform overhead)
  ├── Use build.target: 'esnext' for dev (skip transforms)
  └── Profile with vite-plugin-inspect
```

---

## 11. Anti-Patterns

```
BUNDLER ANTI-PATTERNS — NEVER DO THESE:

1. Not code-splitting (single monolithic bundle)
   BAD:  Everything in one bundle.js (500KB+)
   GOOD: Route-based splitting, vendor chunk separation

2. Transpiling node_modules unnecessarily
   BAD:  /\.[jt]sx?$/ without exclude (processes all node_modules)
   GOOD: exclude: /node_modules/ (most packages are pre-compiled)

3. Not using persistent cache (Webpack)
   BAD:  Full rebuild every time
   GOOD: cache: { type: 'filesystem' }

4. Source maps in production bundles
   BAD:  devtool: 'eval-source-map' in production
   GOOD: devtool: 'source-map' (separate files) or 'hidden-source-map'

5. Not setting performance budgets
   BAD:  No size limits, bundle grows silently to 2MB
   GOOD: performance.maxEntrypointSize: 250000

6. Using Webpack for new greenfield projects (2024+)
   BAD:  Choosing Webpack for a new React/Vue project
   GOOD: Use Vite (faster DX, simpler config, excellent defaults)
   EXCEPTION: Need Module Federation or specific Webpack plugins

7. Mixing CommonJS and ESM
   BAD:  require() in some files, import in others
   GOOD: Use ESM throughout; configure package.json "type": "module"

8. Not analyzing bundle size
   BAD:  Never running bundle analysis
   GOOD: Run analyzer regularly (webpack-bundle-analyzer / rollup-plugin-visualizer)

9. Over-configuring Vite
   BAD:  Porting every Webpack option to Vite
   GOOD: Start with defaults; Vite's defaults are excellent

10. Not externalizing peer dependencies in library mode
    BAD:  Bundling React into your component library
    GOOD: external: ['react', 'react-dom'] in rollupOptions
```

---

## 12. Decision Criteria

```
CHOOSE WEBPACK WHEN:
├── Existing large project already on Webpack
├── Need Module Federation for micro-frontends
├── Specific Webpack plugins with no Vite equivalent
├── Custom build pipeline with complex loader chains
├── Enterprise requirements mandating Webpack
└── Legacy browser support requiring extensive transforms

CHOOSE VITE WHEN:
├── New project (any framework: React, Vue, Svelte, etc.)
├── Want fastest possible dev experience
├── Building a component library (library mode)
├── Migration from Create React App (CRA)
├── Smaller teams that want simple configuration
├── Monorepo with multiple apps
└── DEFAULT CHOICE for new projects

CHOOSE TURBOPACK WHEN:
├── Using Next.js (only option — tightly coupled)
├── Large Next.js project where dev server is slow
├── Want incrementally faster builds over time
└── Willing to accept limited plugin customization

CHOOSE RSPACK WHEN:
├── Want Webpack compatibility with Rust performance
├── Existing Webpack project, want faster builds without migration
├── Need most Webpack plugins/loaders to work unchanged
└── Alternative to Turbopack for non-Next.js projects
```
