# Monorepo Overview

> **AI Plugin Directive:** When the user is considering or setting up a monorepo, ALWAYS start with this guide. It defines core concepts, benefits, trade-offs, dependency graph theory, and when monorepos are appropriate. Cross-reference with `tools-comparison.md` for tooling decisions, `workspace-organization.md` for internal structure, and `monorepo-vs-polyrepo.md` for the decision framework.

**Core Rule: A monorepo is a single repository containing multiple distinct projects with well-defined relationships. It is NOT a monolith — each project builds, tests, and deploys independently. ALWAYS use a monorepo tool (Nx, Turborepo, Bazel) for anything beyond 3 packages. The tool manages the dependency graph, task orchestration, caching, and affected detection that make monorepos viable.**

---

## 1. What is a Monorepo

```
Monorepo = 1 Git repository, N projects, shared tooling + dependencies

┌──────────────────────────────────────────────────────────────────┐
│                        Git Repository                            │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │  Web App   │  │  Mobile    │  │  API Server │  │  Admin    │ │
│  │  (Next.js) │  │  (React    │  │  (NestJS)   │  │  Dashboard│ │
│  │            │  │   Native)  │  │             │  │           │ │
│  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
│        │               │                │               │       │
│        └───────┬───────┴────────┬───────┴───────┬───────┘       │
│                │                │               │               │
│  ┌─────────────▼──┐  ┌─────────▼─────┐  ┌──────▼──────────┐   │
│  │  UI Components │  │  Shared Types  │  │  Utilities      │   │
│  │  (@org/ui)     │  │  (@org/types)  │  │  (@org/utils)   │   │
│  └────────────────┘  └───────────────┘  └─────────────────┘   │
│                                                                  │
│  ┌────────────────┐  ┌───────────────┐  ┌─────────────────┐   │
│  │  ESLint Config │  │  TS Config    │  │  Database/Prisma│   │
│  │  (@org/eslint) │  │  (@org/tsconf)│  │  (@org/db)      │   │
│  └────────────────┘  └───────────────┘  └─────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

Key distinction:
  Monorepo ≠ Monolith

  Monolith: 1 repository, 1 deployable unit, tightly coupled
  Monorepo: 1 repository, N deployable units, loosely coupled
  Polyrepo: N repositories, N deployable units, N lockfiles
```

---

## 2. Core Concepts

### 2.1 Dependency Graph

```
The dependency graph is the FOUNDATION of a monorepo.
Every monorepo tool builds a directed acyclic graph (DAG) of packages.

Example dependency graph:

  apps/web ──────→ packages/ui ──────→ packages/shared-types
      │                │                       ▲
      │                └──→ packages/utils ─────┘
      │                                        ▲
      └──→ packages/database ──────────────────┘
      │
      └──→ packages/config-eslint

  apps/api ──────→ packages/database
      │                │
      │                └──→ packages/shared-types
      │
      └──→ packages/utils
      │
      └──→ packages/config-eslint

The graph determines:
  1. Build order      — packages/shared-types builds BEFORE packages/ui
  2. Affected scope   — change to packages/utils → rebuild apps/web + apps/api
  3. Cache boundaries — each node is independently cacheable
  4. Boundary rules   — apps NEVER depend on other apps

Rules for a valid dependency graph:
  ✅ Directed: A depends on B (not bidirectional)
  ✅ Acyclic: No circular dependencies (A → B → C → A is FORBIDDEN)
  ✅ Leaf packages: Shared types/utils have zero internal deps
  ✅ Root packages: Apps are always roots (nothing depends on them)
```

### 2.2 Task Orchestration

```
Tasks run in topological order respecting the dependency graph.

Given: apps/web depends on packages/ui depends on packages/shared-types

Build order:
  1. packages/shared-types  (no internal deps — builds first)
  2. packages/utils          (no internal deps — builds in parallel with 1)
  3. packages/ui             (depends on shared-types — waits for 1)
  4. apps/web                (depends on ui — waits for 3)

Task pipeline (turbo.json / nx.json):
  build:  depends on ^build (build dependencies first)
  test:   independent (can run in parallel)
  lint:   independent (can run in parallel)
  dev:    no cache, persistent (long-running process)
```

### 2.3 Caching

```
Every task produces:
  1. Output files (dist/, .next/, build/)
  2. Terminal output (logs)
  3. A hash (computed from inputs: source files, env vars, dependencies)

Cache hit: If the hash matches a previous run → skip task, restore outputs
Cache miss: Execute task, store outputs + hash for future runs

Cache levels:
  ┌──────────────────────────────────────────────────────┐
  │  Level 1: Local filesystem cache                      │
  │  Location: node_modules/.cache/turbo or .nx/cache     │
  │  Scope: Your machine only                             │
  │  Speed: Instant (< 100ms)                             │
  ├──────────────────────────────────────────────────────┤
  │  Level 2: Remote/distributed cache                    │
  │  Location: Nx Cloud, Vercel Remote Cache, S3          │
  │  Scope: Shared across all developers + CI             │
  │  Speed: Fast (1-5 seconds)                            │
  ├──────────────────────────────────────────────────────┤
  │  Level 3: Package manager cache                       │
  │  Location: pnpm store, yarn cache                     │
  │  Scope: node_modules installation                     │
  │  Speed: Moderate (avoids network for npm packages)    │
  └──────────────────────────────────────────────────────┘

Without caching (10 packages, 5 tasks each):
  50 tasks × 30 seconds = 25 minutes

With local caching (3 packages changed):
  15 tasks × 30 seconds + 35 cached = 7.5 minutes

With remote caching (teammate already built):
  3 tasks × 30 seconds + 47 cached = 1.5 minutes
```

### 2.4 Affected Detection

```
"Affected" = packages that could be impacted by a set of changes.

Algorithm:
  1. Determine changed files (git diff)
  2. Map changed files → packages they belong to
  3. Walk the dependency graph UPWARD from changed packages
  4. All reachable packages are "affected"

Example:
  Change: packages/shared-types/src/user.ts

  Graph walk:
    packages/shared-types (changed)
    → packages/ui (depends on shared-types)
    → packages/database (depends on shared-types)
    → apps/web (depends on ui + database)
    → apps/api (depends on database)
    → apps/admin (depends on ui)

  Result: 6 packages affected, other packages SKIPPED

  NOT affected:
    packages/config-eslint (no dependency on shared-types)
    packages/utils (no dependency on shared-types)
    apps/docs (depends only on utils)

Git commands used:
  Turborepo: git diff HEAD~1 (or configurable base)
  Nx:        git diff origin/main...HEAD (via nrwl/nx-set-shas)
  Bazel:     Precise file-level tracking (most granular)
```

---

## 3. Benefits

### 3.1 Single Source of Truth
```
Without monorepo (polyrepo):
  @myorg/shared-types v1.0.0 in web-app
  @myorg/shared-types v1.2.0 in api-server
  @myorg/shared-types v0.9.0 in mobile-app
  → 3 different versions, drift, incompatibilities

With monorepo:
  packages/shared-types (ONE version, used by all)
  → Every consumer always uses the latest
  → Type changes immediately caught by all dependents
  → No "npm publish → npm install" cycle
```

### 3.2 Atomic Changes
```
Scenario: Rename User.email → User.emailAddress

Polyrepo workflow (5 steps, 3+ PRs, days):
  1. PR to shared-types: rename field, bump version
  2. Wait for npm publish
  3. PR to web-app: update dependency, fix imports
  4. PR to api-server: update dependency, fix imports
  5. PR to mobile-app: update dependency, fix imports

Monorepo workflow (1 step, 1 PR, minutes):
  1. Single PR: rename in shared-types + update all consumers
  → TypeScript compiler catches all broken references
  → Single code review, single merge, single CI run
```

### 3.3 Shared Tooling and Standards
```
Root-level configuration (used by ALL packages):

my-monorepo/
├── .eslintrc.js          ← shared ESLint rules
├── .prettierrc           ← shared formatting
├── tsconfig.base.json    ← shared TypeScript settings
├── vitest.workspace.ts   ← shared test config
├── .github/              ← shared CI/CD
├── .husky/               ← shared git hooks
└── .vscode/              ← shared editor settings

Benefit: Change ESLint rule ONCE → applies to ALL packages instantly.
No per-repo configuration drift. No "this repo uses tabs, that repo uses spaces."
```

### 3.4 Code Visibility and Discovery
```
Every developer can:
  - Search ALL code with a single grep/IDE search
  - Navigate to source of any internal dependency (not node_modules)
  - Understand how shared code is used across the organization
  - See the full impact of a change before making it

This eliminates:
  ❌ "I didn't know that package existed"
  ❌ "I rebuilt the same utility in my service"
  ❌ "I didn't know my change would break that service"
```

---

## 4. Monorepo vs Monolith vs Polyrepo

| Aspect | Monorepo | Monolith | Polyrepo |
|--------|---------|----------|----------|
| **Repository** | 1 | 1 | N |
| **Projects** | Multiple independent | Single tightly-coupled | One per repo |
| **Build/Deploy** | Independent per project | All together | Independent |
| **Code sharing** | Direct imports (`workspace:*`) | Same codebase | Published packages (npm) |
| **Dependency mgmt** | Unified lockfile | N/A (single project) | Per-repo lockfile |
| **Atomic changes** | Yes (single commit/PR) | Yes | No (multi-repo PRs) |
| **CI complexity** | Medium (affected detection) | Low | Low per-repo, high overall |
| **Version control** | Single history | Single history | N histories |
| **Access control** | CODEOWNERS per path | Full repo access | Per-repo permissions |
| **Onboarding** | Clone once, see everything | Clone once | Clone N repos |
| **Tooling overhead** | Nx/Turborepo needed | Minimal | Minimal per-repo |
| **Scale limit** | Thousands of packages | Single codebase | Unlimited repos |

---

## 5. Real-World Monorepo Adoption

```
Company          Repository        Size             Tool
─────────────── ─────────────── ──────────────── ───────────────
Google           google3          86 TB, 2B lines   Blaze (→Bazel)
Meta (Facebook)  fbsource         Hundreds of GB    Buck (→Buck2)
Microsoft        1ES              4M+ files         Custom + Rush
Uber             monorepo         Thousands of svcs Bazel + Buck
Airbnb           monorepo         Web + mobile      Nx
Vercel           turborepo        Next.js ecosystem Turborepo
Nrwl             nx               Nx + plugins      Nx

Key insights:
  - Google/Meta: Custom VFS tools (CitC, EdenFS) for scale
  - Google: 25,000+ developers, 86 TB repo, trunk-based development
  - Microsoft: Migrated from polyrepo to monorepo (parts)
  - Uber: Migrated Android from polyrepo to monorepo
  - Vercel: Built Turborepo because they needed it for Next.js
  - Small/medium companies: Nx or Turborepo (no custom tooling needed)
```

---

## 6. When to Use a Monorepo

```
DECISION FLOWCHART:

Do your projects share significant code?
│
├── YES (>30% shared code, shared types, shared UI)
│   │
│   └── Is your team < 500 developers?
│       │
│       ├── YES → USE MONOREPO
│       │   │
│       │   └── Is your team > 50 developers?
│       │       ├── YES → Nx + remote caching + CODEOWNERS + boundaries
│       │       └── NO  → Turborepo or Nx (simpler setup)
│       │
│       └── NO (500+ developers)
│           │
│           └── Do you have a dedicated platform/infra team?
│               ├── YES → Monorepo with Bazel + custom tooling
│               └── NO  → Domain-based monorepos (hybrid)
│
└── NO (<10% shared code, different languages, independent teams)
    │
    └── USE POLYREPO
        └── Share code via published packages (npm, PyPI, Maven)
```

### Use a monorepo when:
```
✅ Multiple projects share significant code (UI, types, utilities)
✅ Team needs atomic cross-project refactoring
✅ Want unified CI/CD, linting, and dependency management
✅ Building a product with frontend + backend + shared libraries
✅ Organization < 500 developers (or has platform team for larger)
✅ Same primary language/toolchain across projects
✅ Coordinated releases (web + mobile + API deploy together)
```

### Avoid a monorepo when:
```
❌ Projects are truly independent (different teams, languages, lifecycles)
❌ Organization is 500+ developers without dedicated platform team
❌ Regulatory requirements mandate separate repository access control
❌ Projects have vastly different tech stacks (Python ML + Java backend + Go infra)
❌ Teams are fully autonomous with independent release schedules
❌ Projects are open source with different contributor pools
```

---

## 7. Trunk-Based Development in Monorepos

```
Monorepos work best with trunk-based development (TBD):

  main (trunk)
    │
    ├── feature/add-user-avatar (short-lived, 1-2 days max)
    │   └── Changes: apps/web + packages/ui + packages/shared-types
    │       → Single PR, atomic review, CI runs affected-only
    │
    ├── feature/add-payment-api (short-lived)
    │   └── Changes: apps/api + packages/database
    │       → Doesn't affect web team's PR at all
    │
    └── All merges go directly to main

TBD Rules for monorepos:
  1. Short-lived feature branches (< 2 days)
  2. Merge to main frequently
  3. Feature flags for incomplete features (NOT long-lived branches)
  4. CI runs on every PR against main
  5. Main is ALWAYS deployable

Why TBD works well:
  - Affected detection is most accurate against main
  - Remote cache hits are highest when everyone merges frequently
  - Merge conflicts are minimized with short branches
  - Atomic changes require a single branch/PR

Anti-pattern: Long-lived branches (> 1 week)
  Problem: Merge conflicts, stale caches, broken affected detection
  Fix: Feature flags + frequent merges to main
```

---

## 8. Monorepo File Structure Patterns

### 8.1 Flat Structure (< 20 packages)
```
my-monorepo/
├── apps/
│   ├── web/
│   ├── api/
│   └── docs/
├── packages/
│   ├── ui/
│   ├── shared-types/
│   ├── utils/
│   ├── config-eslint/
│   └── config-typescript/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### 8.2 Categorized Structure (20-100 packages)
```
my-monorepo/
├── apps/
│   ├── web/
│   ├── mobile/
│   ├── api/
│   ├── admin/
│   └── docs/
├── packages/
│   ├── ui/                      # React component library
│   ├── shared-types/            # TypeScript interfaces
│   ├── utils/                   # Pure utility functions
│   ├── database/                # Prisma schema + client
│   ├── auth/                    # Auth logic (shared)
│   └── api-client/              # Generated API client
├── config/                      # Shared configuration packages
│   ├── eslint-config/
│   ├── tsconfig/
│   └── prettier-config/
├── tooling/                     # Internal build/dev tooling
│   ├── scripts/
│   └── generators/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### 8.3 Team-Namespaced Structure (100+ packages)
```
my-monorepo/
├── apps/
│   ├── customer/
│   │   ├── web/
│   │   ├── mobile/
│   │   └── admin/
│   ├── merchant/
│   │   ├── dashboard/
│   │   └── api/
│   └── internal/
│       ├── backoffice/
│       └── monitoring/
├── packages/
│   ├── @frontend/
│   │   ├── ui-components/
│   │   ├── form-library/
│   │   ├── analytics/
│   │   └── i18n/
│   ├── @backend/
│   │   ├── database/
│   │   ├── auth/
│   │   ├── messaging/
│   │   └── cache/
│   ├── @platform/
│   │   ├── config-eslint/
│   │   ├── config-typescript/
│   │   ├── shared-types/
│   │   ├── logger/
│   │   └── testing-utils/
│   └── @mobile/
│       ├── ui-native/
│       ├── push-notifications/
│       └── deep-linking/
├── infrastructure/
│   ├── terraform/
│   ├── kubernetes/
│   └── docker/
├── package.json
├── pnpm-workspace.yaml
└── nx.json
```

---

## 9. Root Configuration Files

```
my-monorepo/
├── package.json                 # Workspace root (private: true)
├── pnpm-workspace.yaml          # Workspace package locations
├── turbo.json (OR nx.json)      # Task orchestration
├── tsconfig.base.json           # Base TypeScript config
├── .eslintrc.js                 # Root ESLint config
├── .prettierrc                  # Formatting rules
├── .editorconfig                # Editor settings
├── .gitignore                   # Git ignore patterns
├── .npmrc                       # pnpm/npm configuration
├── .nvmrc                       # Node.js version
├── .github/
│   ├── CODEOWNERS               # Per-path ownership
│   ├── workflows/
│   │   ├── ci.yml               # Lint + build + test (affected-only)
│   │   ├── deploy.yml           # Deploy affected apps
│   │   └── release.yml          # Version + publish packages
│   └── pull_request_template.md
├── .husky/                      # Git hooks
│   ├── pre-commit               # lint-staged
│   └── commit-msg               # commitlint
├── .changeset/                  # Changesets for versioning
│   └── config.json
└── CODEOWNERS                   # GitHub CODEOWNERS (root)
```

### Root package.json
```json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "clean": "turbo clean && rm -rf node_modules",
    "prepare": "husky"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.2.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "config/*"
  - "tooling/*"
```

### .npmrc
```ini
# Strict dependency resolution (RECOMMENDED)
shamefully-hoist=false
strict-peer-dependencies=false
auto-install-peers=true

# Prevent phantom dependencies
# Each package can ONLY import what it explicitly declares
# pnpm enforces this by default (unlike npm/yarn classic)

# Link workspace packages
link-workspace-packages=true

# Save exact versions (no ^ or ~)
save-exact=true
```

### tsconfig.base.json
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", "build", ".next", ".turbo"]
}
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No monorepo tool | Custom bash scripts, broken builds | Adopt Nx or Turborepo immediately |
| Monorepo = monolith | Single deployable, tightly coupled code | Enforce package boundaries, independent builds |
| Building everything | 30+ minute CI, massive resource waste | Affected-only builds + remote caching |
| No package boundaries | Any package imports anything | Nx module boundaries or ESLint import rules |
| Circular dependencies | A → B → A, build fails unpredictably | Restructure to extract shared base package |
| One giant package.json | All deps at root, phantom dependencies | Per-package dependencies, pnpm strict mode |
| Long-lived branches | Merge conflicts, stale caches | Trunk-based development, feature flags |
| No CODEOWNERS | Anyone can change any package | CODEOWNERS per package directory |
| Still using Lerna standalone | No caching, basic affected detection | Migrate to Nx (Lerna now wraps Nx internally) |
| No shared configuration | Each package has different lint/format rules | Root-level shared configs, config packages |
| Copy-paste between packages | Duplicated code across packages | Extract to shared package |
| Apps importing apps | apps/web imports from apps/api | Extract shared code to packages/ |

---

## 11. Enforcement Checklist

- [ ] Monorepo tool selected and configured — Nx or Turborepo (NEVER manage manually)
- [ ] Dependency graph is acyclic — no circular dependencies between packages
- [ ] Clear separation — `apps/` for deployables, `packages/` for shared libraries
- [ ] Task orchestration configured — `turbo.json` or `nx.json` with correct `dependsOn`
- [ ] Local caching working — tasks skip on unchanged inputs
- [ ] Remote caching enabled — shared cache across developers and CI
- [ ] Affected detection configured — CI only builds/tests changed packages
- [ ] Package boundaries enforced — apps cannot import apps, no circular deps
- [ ] Shared configuration at root — ESLint, TypeScript, Prettier, EditorConfig
- [ ] `workspace:*` protocol — ALL internal package references use workspace protocol
- [ ] Single lockfile committed — pnpm-lock.yaml at root, NEVER gitignored
- [ ] CODEOWNERS defined per package — explicit ownership for code review
- [ ] Root package.json is `private: true` — prevent accidental publish
- [ ] `packageManager` field set — enforce consistent package manager version
- [ ] `.npmrc` configured — strict dependency resolution, no phantom deps
- [ ] Trunk-based development — short-lived branches, frequent merges
- [ ] Documentation — README for adding new packages and understanding structure
