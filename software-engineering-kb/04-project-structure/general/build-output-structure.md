# Build Output Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "what goes in dist/?", "how do I organize build output?", "should I commit build artifacts?", "how do I structure multi-format package output?", or "what should my .gitignore include?", use this directive. Build output structure determines what ships to production, what gets published to package registries, and what clutter stays out of version control. NEVER commit build artifacts. ALWAYS configure .gitignore for your framework. Output directories MUST be deterministic and reproducible.

---

## 1. The Core Rule

**Build output directories (dist/, build/, .next/, out/) are ALWAYS gitignored — they are generated artifacts, not source code. The build process MUST be deterministic: the same source code and dependencies produce identical output. Multi-format libraries (ESM + CJS) output to separate directories or use package.json conditional exports. Source maps are included in development builds, NEVER shipped to production CDN without protection.**

```
❌ WRONG: Build artifacts committed to git
src/
├── index.ts
dist/                    ← COMMITTED TO GIT — bloats repo, causes merge conflicts
├── index.js
├── index.js.map
└── index.d.ts

✅ CORRECT: Build artifacts generated, gitignored
src/
├── index.ts
.gitignore               ← Contains: dist/
# dist/ exists only in CI/CD build pipeline and local dev
```

---

## 2. Output Directory Conventions by Framework

```
┌──────────────────────┬──────────────────┬─────────────────────────────────┐
│ Framework/Tool       │ Default Output   │ Purpose                          │
├──────────────────────┼──────────────────┼─────────────────────────────────┤
│ TypeScript (tsc)     │ dist/            │ Compiled JS + declarations       │
│ Vite (library mode)  │ dist/            │ Bundled library output           │
│ Vite (app mode)      │ dist/            │ Static site output               │
│ webpack              │ dist/ or build/  │ Bundled application              │
│ Next.js              │ .next/           │ Server + static build output     │
│ Next.js (export)     │ out/             │ Static export                    │
│ Nuxt                 │ .nuxt/ + .output/│ Dev server + production build    │
│ Remix                │ build/           │ Server + client build            │
│ Angular              │ dist/{project}/  │ Compiled application             │
│ SvelteKit            │ .svelte-kit/     │ Build intermediates              │
│ Astro                │ dist/            │ Static site output               │
│ Create React App     │ build/           │ Production build                 │
│ Go                   │ bin/             │ Compiled binary                  │
│ Rust (cargo)         │ target/          │ Compiled binary + deps           │
│ .NET                 │ bin/ + obj/      │ Compiled assemblies              │
│ Python (setuptools)  │ dist/ + build/   │ Wheels and sdist                 │
│ Java (Maven)         │ target/          │ Compiled classes + JAR           │
│ Java (Gradle)        │ build/           │ Compiled classes + JAR           │
│ Flutter              │ build/           │ Platform-specific builds         │
│ Electron             │ out/ or dist/    │ Packaged application             │
│ Docker               │ N/A (image)      │ Container image layers           │
└──────────────────────┴──────────────────┴─────────────────────────────────┘
```

---

## 3. Library Output Structure (Multi-Format)

### TypeScript Library — ESM + CJS + Types

```
my-library/
├── src/
│   ├── index.ts                    ← Entry point
│   ├── utils.ts
│   └── types.ts
├── dist/
│   ├── esm/                        ← ES Modules output
│   │   ├── index.js
│   │   ├── utils.js
│   │   └── types.js
│   ├── cjs/                        ← CommonJS output
│   │   ├── index.js
│   │   ├── utils.js
│   │   └── types.js
│   └── types/                      ← Type declarations
│       ├── index.d.ts
│       ├── utils.d.ts
│       └── types.d.ts
└── package.json
```

### package.json Conditional Exports

```json
{
  "name": "my-library",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    },
    "./utils": {
      "import": "./dist/esm/utils.js",
      "require": "./dist/cjs/utils.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "prepublishOnly": "npm run build"
  }
}
```

### tsup Configuration (Recommended Bundler for Libraries)

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],          // Dual format output
  dts: true,                        // Generate .d.ts files
  splitting: false,
  sourcemap: true,
  clean: true,                      // Clean dist/ before build
  outDir: 'dist',
  target: 'es2020',
  minify: false,                    // Libraries should NOT be minified
});
```

---

## 4. Application Build Output

### Next.js Build Output

```
.next/                              ← GITIGNORED — full build output
├── cache/                          ← Build cache (speeds up incremental builds)
├── server/
│   ├── app/                        ← Server components output
│   │   ├── page.js
│   │   └── layout.js
│   ├── chunks/                     ← Server-side chunks
│   └── pages-manifest.json
├── static/
│   ├── chunks/                     ← Client-side JS chunks
│   │   ├── pages/
│   │   └── framework-*.js
│   ├── css/                        ← Extracted CSS
│   └── media/                      ← Static assets (images, fonts)
├── BUILD_ID                        ← Unique build identifier
├── build-manifest.json
└── routes-manifest.json

out/                                ← Static export (next export)
├── index.html
├── about.html
├── _next/
│   ├── static/
│   └── data/
└── 404.html
```

### Vite Application Build Output

```
dist/                               ← GITIGNORED
├── index.html                      ← Entry HTML with hashed asset links
├── assets/
│   ├── index-[hash].js             ← Main bundle (hashed for cache-busting)
│   ├── index-[hash].css            ← Extracted CSS (hashed)
│   ├── vendor-[hash].js            ← Vendor chunk (node_modules)
│   ├── logo-[hash].svg             ← Static assets (hashed)
│   └── inter-latin-[hash].woff2   ← Fonts
└── favicon.ico
```

### Go Binary Output

```
bin/                                ← GITIGNORED
├── server                          ← Linux binary
├── server.exe                      ← Windows binary (if cross-compiled)
└── cli                             ← CLI tool binary

# Build commands:
# go build -o bin/server ./cmd/server
# GOOS=linux GOARCH=amd64 go build -o bin/server-linux ./cmd/server
```

### .NET Build Output

```
bin/                                ← GITIGNORED — compiled assemblies
├── Debug/
│   └── net8.0/
│       ├── MyApp.dll
│       ├── MyApp.pdb                ← Debug symbols
│       └── MyApp.deps.json
└── Release/
    └── net8.0/
        ├── publish/                 ← Publishable output
        │   ├── MyApp.dll
        │   ├── MyApp.exe            ← Self-contained executable
        │   └── wwwroot/             ← Static web assets
        └── MyApp.dll

obj/                                ← GITIGNORED — intermediate build files
├── Debug/
│   └── net8.0/
│       ├── MyApp.AssemblyInfo.cs    ← Auto-generated
│       └── ref/                     ← Reference assemblies
└── project.assets.json              ← NuGet dependency resolution
```

---

## 5. Source Maps Strategy

```
┌──────────────────────┬─────────────────────────────────────────────┐
│ Environment          │ Source Map Strategy                          │
├──────────────────────┼─────────────────────────────────────────────┤
│ Development          │ Full source maps (inline or file)            │
│                      │ Mode: 'cheap-module-source-map' or 'eval'   │
│                      │ Max debugging capability                     │
├──────────────────────┼─────────────────────────────────────────────┤
│ Staging              │ Full source maps, uploaded to error tracker  │
│                      │ Upload to Sentry/Datadog BEFORE deploy       │
│                      │ Serve source maps only to internal IPs       │
├──────────────────────┼─────────────────────────────────────────────┤
│ Production           │ Hidden source maps (generated but not served)│
│                      │ Upload to Sentry/Datadog for error tracking  │
│                      │ NEVER serve .map files publicly              │
│                      │ Mode: 'hidden-source-map'                   │
└──────────────────────┴─────────────────────────────────────────────┘

RULE: NEVER serve source maps publicly in production.
      They expose your source code to anyone who opens DevTools.

RULE: ALWAYS upload source maps to your error tracking service
      (Sentry, Datadog, Bugsnag) for production debugging.
```

```typescript
// vite.config.ts — source map configuration
export default defineConfig({
  build: {
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    // 'hidden' = generates .map files but doesn't reference them in output
    // Upload .map files to Sentry, then delete from deployment
  },
});
```

```bash
# Upload source maps to Sentry (in CI/CD pipeline)
npx @sentry/cli releases files $VERSION upload-sourcemaps dist/
# Then delete source maps from deployment
rm -rf dist/**/*.map
```

---

## 6. .gitignore by Ecosystem

### Node.js / TypeScript

```gitignore
# Build output
dist/
build/
out/
.next/
.nuxt/
.output/
.svelte-kit/
.vercel/

# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Misc
*.tsbuildinfo
*.log
npm-debug.log*
```

### Python

```gitignore
# Build output
dist/
build/
*.egg-info/

# Bytecode
__pycache__/
*.py[cod]
*$py.class
*.so

# Virtual environments
venv/
.venv/
env/

# Environment
.env
.env.local

# Testing
.coverage
htmlcov/
.pytest_cache/
.mypy_cache/

# IDE
.idea/
.vscode/settings.json

# Distribution
*.egg
*.whl
```

### Go

```gitignore
# Build output
bin/
/vendor/           # if not vendoring

# IDE
.idea/
.vscode/settings.json

# OS
.DS_Store

# Environment
.env
.env.local

# Test
coverage.out
coverage.html

# Binary
*.exe
*.exe~
*.dll
*.so
*.dylib
```

### .NET

```gitignore
# Build output
bin/
obj/
publish/

# User-specific
*.rsuser
*.suo
*.user
*.userosscache
*.sln.docstates

# NuGet
*.nupkg
**/packages/*
project.lock.json

# Environment
.env
.env.local
appsettings.Development.json  # if it contains secrets

# IDE
.vs/
.idea/
```

---

## 7. CI/CD Artifact Management

```yaml
# GitHub Actions — build, upload artifacts, deploy
name: Build and Deploy
on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      # Upload build artifacts for deployment job
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
          retention-days: 7        # Auto-cleanup after 7 days

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
          path: dist/

      - name: Deploy to production
        run: ./deploy.sh
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Committed build artifacts** | dist/ or build/ in git, merge conflicts on every PR | Add to .gitignore, remove with `git rm -r --cached dist/` |
| **No .gitignore** | node_modules/, .env, IDE files committed | Add framework-specific .gitignore from gitignore.io |
| **Incomplete .gitignore** | Some artifacts ignored, others not (e.g., .next/ missing) | Use comprehensive .gitignore templates |
| **Minified library output** | Published npm package is minified, can't debug | Libraries: DO NOT minify. Applications: minify |
| **No source maps in staging** | Can't debug staging issues | Upload source maps to error tracker for all environments |
| **Public source maps in prod** | Source code visible to anyone in browser DevTools | Use `hidden-source-map`, upload to Sentry, delete from CDN |
| **Non-deterministic builds** | Different output from same source | Pin dependencies (lockfiles), use `--frozen-lockfile` in CI |
| **Missing build cache** | CI builds take 10 minutes every time | Cache node_modules, .next/cache, target/ in CI |
| **No clean step** | Stale files from previous builds leak into output | `rm -rf dist/` before build, or use tool's `clean` option |
| **Mixed ESM/CJS confusion** | Library consumers get "require is not defined" errors | Use proper package.json `exports` with `import`/`require` conditions |

---

## 9. Enforcement Checklist

- [ ] **Build artifacts gitignored** — dist/, build/, .next/, out/, bin/, target/ in .gitignore
- [ ] **Comprehensive .gitignore** — covers framework, IDE, OS, environment files
- [ ] **Deterministic builds** — `--frozen-lockfile` in CI, pinned dependencies
- [ ] **Clean before build** — stale files removed before generating new output
- [ ] **Source maps strategy** — hidden in production, uploaded to error tracker
- [ ] **No public source maps** — .map files NOT served from production CDN
- [ ] **Library dual format** — ESM + CJS output with proper `exports` field
- [ ] **CI artifact upload** — build output passed between CI jobs via artifacts
- [ ] **Build cache configured** — CI caches node_modules, build intermediates
- [ ] **`files` field in package.json** — explicitly lists what gets published to npm
- [ ] **No minified libraries** — application builds are minified, library builds are not
- [ ] **Reproducible from clean checkout** — any dev can clone and build successfully
