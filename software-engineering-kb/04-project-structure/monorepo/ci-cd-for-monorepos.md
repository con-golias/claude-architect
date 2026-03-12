# CI/CD for Monorepos

> **AI Plugin Directive:** When setting up CI/CD for a monorepo, ALWAYS use this guide. Apply affected-only builds, remote caching, parallel execution, and per-app deployment strategies. NEVER build all packages on every commit — this defeats the purpose of a monorepo tool.

**Core Rule: Only build and test packages affected by changes. Use remote caching to skip tasks already computed. Parallelize independent tasks. These three principles reduce CI time by 60-90%. ALWAYS use the monorepo tool (Turborepo/Nx) in CI — NEVER fall back to `npm run build` in each package manually.**

---

## 1. CI Pipeline Architecture

```
PR Opened / Push to main
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 1: CHECKOUT + INSTALL                                     │
│                                                                  │
│  actions/checkout (fetch-depth: 2 for Turbo, 0 for Nx)          │
│  pnpm install --frozen-lockfile                                  │
│  Cache: pnpm store, .turbo cache, node_modules                  │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 2: DETERMINE AFFECTED                                     │
│                                                                  │
│  Turborepo: git diff → turbo build --filter=[HEAD^1]            │
│  Nx: nrwl/nx-set-shas → NX_BASE, NX_HEAD → nx affected          │
│                                                                  │
│  Changed: packages/shared-types (1 file changed)                 │
│  Affected: shared-types, ui, database, web, api, admin           │
│  Skipped: utils, config-eslint, config-typescript, docs          │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 3: CHECK REMOTE CACHE                                     │
│                                                                  │
│  For each affected task:                                         │
│    Hash(inputs + env + deps) → lookup in remote cache            │
│    HIT  → restore outputs from cache (skip execution)            │
│    MISS → execute task, upload result to cache                   │
│                                                                  │
│  6 affected packages × 3 tasks = 18 tasks                        │
│  14 cache hits + 4 cache misses = only 4 tasks actually run      │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 4: EXECUTE TASKS (Parallel + Topological Order)           │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐            │
│  │  Parallel Group 1 (no internal deps):           │            │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │            │
│  │  │lint:types│  │lint:utils│  │test:utils│     │            │
│  │  └──────────┘  └──────────┘  └──────────┘     │            │
│  └─────────────────────────────────────────────────┘            │
│  ┌─────────────────────────────────────────────────┐            │
│  │  Parallel Group 2 (depends on group 1):         │            │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │            │
│  │  │build:ui  │  │build:db  │  │lint:auth │     │            │
│  │  └──────────┘  └──────────┘  └──────────┘     │            │
│  └─────────────────────────────────────────────────┘            │
│  ┌─────────────────────────────────────────────────┐            │
│  │  Parallel Group 3 (depends on group 2):         │            │
│  │  ┌──────────┐  ┌──────────┐                    │            │
│  │  │build:web │  │build:api │                    │            │
│  │  └──────────┘  └──────────┘                    │            │
│  └─────────────────────────────────────────────────┘            │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  Step 5: UPLOAD CACHE + DEPLOY                                  │
│                                                                  │
│  Upload new cache entries for future runs                        │
│  If main branch: deploy affected apps only                      │
│  ┌──────────┐  ┌──────────┐                                    │
│  │deploy:web│  │deploy:api│  (only if affected)                │
│  └──────────┘  └──────────┘                                    │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. GitHub Actions — Turborepo CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  ci:
    name: Lint, Build, Test
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Need parent commit for affected detection

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo lint

      - name: Type check
        run: pnpm turbo typecheck

      - name: Build
        run: pnpm turbo build

      - name: Test
        run: pnpm turbo test

      # Combine all in one command (more efficient — Turbo parallelizes):
      # - run: pnpm turbo lint typecheck build test

  # ───────────────────────────────────────────
  # Gate check — all CI must pass before merge
  # ───────────────────────────────────────────
  ci-ok:
    name: CI Complete
    runs-on: ubuntu-latest
    needs: [ci]
    if: always()
    steps:
      - name: Check CI results
        run: |
          if [ "${{ needs.ci.result }}" != "success" ]; then
            echo "CI failed"
            exit 1
          fi
          echo "All CI checks passed"
```

### Turborepo Deployment Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false  # NEVER cancel deployments

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  build:
    name: Build all affected
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build

  deploy-web:
    name: Deploy Web
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      # Check if web app was affected
      - name: Check for changes
        id: check
        run: |
          npx turbo-ignore @myorg/web
          echo "skip=$?" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Deploy to Vercel
        if: steps.check.outcome == 'failure'  # turbo-ignore exits 1 = HAS changes
        run: |
          npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/web

  deploy-api:
    name: Deploy API
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Check for changes
        id: check
        run: |
          npx turbo-ignore @myorg/api
          echo "skip=$?" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Build and Push Docker Image
        if: steps.check.outcome == 'failure'
        run: |
          # Use turbo prune for minimal Docker context
          npx turbo prune @myorg/api --docker

          cd out
          docker build -f Dockerfile -t myregistry/api:${{ github.sha }} .
          docker push myregistry/api:${{ github.sha }}

      - name: Deploy to ECS/K8s
        if: steps.check.outcome == 'failure'
        run: |
          # Update deployment with new image tag
          kubectl set image deployment/api api=myregistry/api:${{ github.sha }}
```

---

## 3. GitHub Actions — Nx CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  main:
    name: Nx Affected
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history required for Nx affected

      # Sets NX_BASE and NX_HEAD for affected detection
      - uses: nrwl/nx-set-shas@v4

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      # Run affected tasks with remote caching
      - run: pnpm nx affected -t lint test build
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

      # Or run each task separately for better CI visibility:
      # - run: pnpm nx affected -t lint
      # - run: pnpm nx affected -t test
      # - run: pnpm nx affected -t build

  # Nx Distributed Task Execution (enterprise feature)
  # Splits tasks across multiple CI agents for faster execution
  agents:
    name: DTE Agent
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent: [1, 2, 3]  # 3 parallel agents
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Start Nx Agent
        run: npx nx-cloud start-agent
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
```

---

## 4. Remote Caching Deep Dive

### 4.1 How Cache Hashing Works

```
Cache hash is computed from:
  1. Source files in the package
  2. Source files in ALL dependencies (transitive)
  3. Environment variables (declared in turbo.json/nx.json)
  4. Configuration files (tsconfig, eslint, etc.)
  5. Lock file contents (dependency versions)
  6. Task runner version

Hash computation:
  hash(
    sha256(packages/ui/src/**),
    sha256(packages/shared-types/src/**),  # dependency
    sha256(tsconfig.base.json),            # global config
    sha256(pnpm-lock.yaml),               # lockfile
    env.NODE_ENV,                          # declared env var
  ) → "abc123def456"

Cache lookup:
  "abc123def456" exists in cache?
    YES → download outputs from cache, skip execution
    NO  → execute task, upload outputs as "abc123def456"
```

### 4.2 Caching Strategies

```
Strategy 1: Vercel Remote Cache (Turborepo)
  Setup: npx turbo login && npx turbo link
  Cost: Free tier included with Vercel account
  Speed: CDN-distributed, fast globally
  Best for: Vercel-deployed projects

Strategy 2: Nx Cloud
  Setup: npx nx connect
  Cost: Free tier (500 hours/month), paid tiers
  Speed: CDN-distributed, fast globally
  Features: DTE, task insights, CI dashboard
  Best for: Enterprise projects, Nx users

Strategy 3: Self-hosted (S3/GCS)
  Turborepo:
    # Using custom remote cache server
    # github.com/ducktors/turborepo-remote-cache
    TURBO_API=https://my-cache-server.com
    TURBO_TOKEN=my-token
    TURBO_TEAM=my-team

  Nx:
    # Custom runner in nx.json
    "tasksRunnerOptions": {
      "default": {
        "runner": "@nx/workspace/tasks-runners/default",
        "options": {
          "cacheDirectory": ".nx/cache",
          "remoteCache": {
            "url": "https://my-cache-server.com"
          }
        }
      }
    }

Strategy 4: GitHub Actions Cache (basic)
  # Cache Turbo outputs between CI runs
  - uses: actions/cache@v4
    with:
      path: .turbo
      key: turbo-${{ github.sha }}
      restore-keys: |
        turbo-
```

### 4.3 Cache Safety

```
Cache poisoning prevention:

  1. NEVER cache based on branch name only
     ❌ key: turbo-${{ github.ref }}
     ✅ key: turbo-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}

  2. Environment variables MUST be declared
     If DATABASE_URL affects build output but isn't declared in turbo.json,
     the cache will serve wrong outputs.

     # turbo.json
     "build": {
       "env": ["DATABASE_URL", "API_URL"],         # Include in hash
       "passThroughEnv": ["CI", "GITHUB_ACTIONS"]  # Pass through, don't hash
     }

  3. Global dependencies
     # turbo.json
     "globalDependencies": [
       "**/.env.*local",
       "tsconfig.base.json",
       ".eslintrc.json"
     ]

  4. Invalidate cache when needed
     turbo build --force  # Ignore cache, rebuild everything
```

---

## 5. Affected Detection Algorithms

```
TURBOREPO affected detection:

  1. Compare HEAD with HEAD~1 (default) or specific base
  2. Map changed files → packages
  3. Walk dependency graph upward
  4. Filter packages

  # Run only affected packages
  turbo build --filter=[HEAD~1]

  # Custom base comparison
  turbo build --filter=[origin/main...HEAD]

  # Run specific package + everything it depends on
  turbo build --filter=@myorg/web...

  # Run everything that depends on a package
  turbo build --filter=...@myorg/shared-types


NX affected detection:

  1. Compare NX_HEAD with NX_BASE (set by nrwl/nx-set-shas)
  2. Map changed files → projects (using project.json sourceRoot)
  3. Walk dependency graph upward
  4. Include implicitly affected (global config changes)

  # Set base/head SHAs
  uses: nrwl/nx-set-shas@v4  # Sets NX_BASE and NX_HEAD

  # Run affected tasks
  nx affected -t lint test build

  # View affected projects
  nx affected --print-affected
  nx show projects --affected

  # View affected graph
  nx affected --graph


Edge cases:
  - Root config change (tsconfig.base.json) → ALL packages affected
  - Lock file change → ALL packages affected (dependency versions changed)
  - CI config change → Only CI, no packages
  - README change → Typically no packages (configure in namedInputs)
```

---

## 6. Deployment Strategies per App

```
Strategy 1: Independent Deploys (RECOMMENDED)
  Each app deploys independently when it (or its deps) change.

  turbo-ignore @myorg/web → exit 0 (no changes) → skip deploy
  turbo-ignore @myorg/web → exit 1 (has changes) → deploy

  ✅ Minimal deployments
  ✅ Fast rollbacks (per app)
  ❌ Must handle API versioning between apps

Strategy 2: Coordinated Deploys
  All affected apps deploy together in sequence.

  deploy: web → api → workers (always in this order)

  ✅ Ensures compatibility
  ❌ Slower deployments
  ❌ One failure blocks all

Strategy 3: Canary per App
  Deploy to canary, monitor, promote to production.

  web-canary (5% traffic) → monitor → web-production (100%)
  api-canary (5% traffic) → monitor → api-production (100%)

  ✅ Safest approach
  ❌ Complex infrastructure
  ❌ Only for mature organizations
```

---

## 7. Optimizing CI Performance

```
Optimization                    Impact       Difficulty
────────────────────────────── ──────────── ──────────
Affected-only builds            60-80% ↓    Low
Remote caching                  40-70% ↓    Low
Parallel task execution         30-50% ↓    Low (built-in)
pnpm install caching            20-30% ↓    Low
Shallow git checkout            5-10% ↓     Low
Cancel superseded runs          ∞ saved     Low
Distributed execution (DTE)     50-70% ↓    Medium (Nx Cloud)
turbo prune for Docker          40-60% ↓    Medium
Split CI into parallel jobs     30-50% ↓    Medium
Incremental TypeScript          10-20% ↓    Low

Typical timeline:
  Before optimization:           25-40 minutes
  + Affected builds:             8-15 minutes
  + Remote caching:              3-8 minutes
  + DTE (3 agents):              1-4 minutes
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Build all on every PR | 30+ min CI, massive compute waste | Affected-only: `turbo build --filter=[HEAD^1]` |
| No remote caching | Same tasks rebuilt across PRs and developers | Enable Turborepo/Nx remote cache |
| Sequential tasks | Lint → Build → Test running in series | Parallelize independent tasks (built-in) |
| Full git checkout | Slow checkout for large repos | `fetch-depth: 2` for Turbo, `0` for Nx |
| No concurrency control | Multiple CI runs for same PR overlap | `concurrency` group with `cancel-in-progress` |
| Manual deploy checks | Human decides which apps to deploy | `turbo-ignore` or Nx affected for automated detection |
| Undeclared env vars in cache | Wrong build outputs served from cache | Declare ALL env vars in `turbo.json` env/globalEnv |
| No CI timeout | Stuck builds run for hours | `timeout-minutes: 15` on every job |
| Building in Docker without prune | Massive Docker context (entire monorepo) | `turbo prune @myorg/app --docker` |
| Not caching pnpm store | Fresh `pnpm install` every CI run | `actions/setup-node` with `cache: "pnpm"` |

---

## 9. Enforcement Checklist

- [ ] Affected-only builds — NEVER rebuild unchanged packages
- [ ] Remote caching enabled — shared cache across developers and CI
- [ ] Parallel task execution — independent tasks run simultaneously
- [ ] `--frozen-lockfile` in CI — prevent unexpected dependency changes
- [ ] Concurrency controls — cancel superseded PR runs (NOT deploy runs)
- [ ] Deploy only affected apps — skip unchanged deployments
- [ ] Git fetch depth — `2` for Turborepo, `0` for Nx
- [ ] CI timeout set — `timeout-minutes` on every job (15-20 min)
- [ ] Environment variables declared — ALL build-affecting env vars in config
- [ ] Cache safety — no branch-only keys, declared global deps
- [ ] `turbo prune` for Docker — minimal context for container builds
- [ ] pnpm store cached — `actions/setup-node` with `cache: "pnpm"`
- [ ] Gate check job — `ci-ok` job that depends on all CI jobs
- [ ] Deployment strategy chosen — independent, coordinated, or canary
