# Monorepo at Scale

> **AI Plugin Directive:** When managing a monorepo with 50+ packages or 50+ developers, ALWAYS apply these scaling patterns. Addresses CODEOWNERS, remote caching, module boundaries, team namespacing, distributed execution, Git performance optimization, governance policies, and organizational strategies for large monorepos.

**Core Rule: At scale, a monorepo requires dedicated tooling, clear ownership boundaries, and automated enforcement. Without these, a large monorepo becomes an unmanageable mess. ALWAYS invest in developer experience (DX) tooling proportional to team size. A monorepo serving 100+ developers MUST have: module boundary enforcement, CODEOWNERS, remote caching, and a dedicated platform/DX team.**

---

## 1. Scaling Challenges by Size

| Challenge | < 10 pkgs | 10-50 pkgs | 50-200 pkgs | 200+ pkgs |
|-----------|----------|-----------|------------|----------|
| **Build time** | Acceptable as-is | Affected-only | + Remote caching | + Distributed execution |
| **Ownership** | Informal/verbal | CODEOWNERS file | + Module boundaries | + Team namespaces |
| **Dependencies** | Manual review | Dependency graph | + Boundary enforcement | + API contracts |
| **CI time** | 5-10 min | 10-20 min (affected) | 5-15 min (cached) | 3-10 min (distributed) |
| **Git performance** | Fine | Fine | Sparse checkout | VFS / partial clone |
| **IDE performance** | Fine | Fine | Project-scoped focus | Remote dev environments |
| **Code review** | Everyone reviews all | CODEOWNERS | + Auto-assign reviewers | + Review policies per team |
| **Onboarding** | Clone + go | README per package | + Getting started guide | + Internal developer portal |
| **Releases** | Manual | Changesets | Automated per-package | Automated + staged rollout |
| **Testing** | Run all | Affected tests | + Flaky test quarantine | + Test impact analysis |

---

## 2. CODEOWNERS

### 2.1 Configuration

```
# .github/CODEOWNERS

# ═══════════════════════════════════════════════════
# DEFAULT — Platform team reviews anything not covered
# ═══════════════════════════════════════════════════
*                                       @myorg/platform-team

# ═══════════════════════════════════════════════════
# APPLICATIONS — Each app has a dedicated team
# ═══════════════════════════════════════════════════
/apps/web/                              @myorg/frontend-team
/apps/mobile/                           @myorg/mobile-team
/apps/api/                              @myorg/backend-team
/apps/admin/                            @myorg/admin-team @myorg/frontend-team
/apps/docs/                             @myorg/docs-team

# ═══════════════════════════════════════════════════
# SHARED PACKAGES — Cross-team ownership
# ═══════════════════════════════════════════════════
/packages/ui/                           @myorg/design-system-team
/packages/shared-types/                 @myorg/platform-team
/packages/database/                     @myorg/backend-team
/packages/auth/                         @myorg/security-team
/packages/utils/                        @myorg/platform-team
/packages/api-client/                   @myorg/platform-team

# ═══════════════════════════════════════════════════
# CONFIGURATION — Platform team owns shared configs
# ═══════════════════════════════════════════════════
/config/                                @myorg/platform-team
/tsconfig.base.json                     @myorg/platform-team
/.eslintrc.*                            @myorg/platform-team
/.prettierrc                            @myorg/platform-team

# ═══════════════════════════════════════════════════
# INFRASTRUCTURE — DevOps team owns CI/CD and infra
# ═══════════════════════════════════════════════════
/.github/                               @myorg/devops-team
/infrastructure/                        @myorg/devops-team
/docker-compose.yml                     @myorg/devops-team
Dockerfile*                             @myorg/devops-team

# ═══════════════════════════════════════════════════
# DEPENDENCY MANAGEMENT — Platform team approves
# ═══════════════════════════════════════════════════
pnpm-lock.yaml                          @myorg/platform-team
pnpm-workspace.yaml                     @myorg/platform-team
.npmrc                                  @myorg/platform-team

# ═══════════════════════════════════════════════════
# NAMESPACED PACKAGES (100+ packages)
# ═══════════════════════════════════════════════════
/packages/@ui/                          @myorg/design-system-team
/packages/@data/                        @myorg/backend-team
/packages/@platform/                    @myorg/platform-team
/packages/@mobile/                      @myorg/mobile-team
```

### 2.2 CODEOWNERS Rules

```
CODEOWNERS principles:

  1. Every directory MUST have an owner
     If no specific rule matches, the default (*) applies.

  2. More specific paths override less specific
     /packages/ui/ overrides * for anything in packages/ui/

  3. Multiple owners = ALL must approve
     @team-a @team-b means both teams must approve

  4. CODEOWNERS + branch protection = enforced reviews
     Settings → Branch Protection → "Require review from CODEOWNERS"

  5. Platform team owns shared configs
     Changes to tsconfig, eslint, CI → platform team review
     This prevents one team from breaking another's setup.

  6. Lock file changes need platform review
     Adding new dependencies should be reviewed for:
     - Security (known vulnerabilities)
     - License compatibility
     - Bundle size impact
     - Duplication (similar package already exists)
```

---

## 3. Module Boundary Enforcement

### 3.1 Nx Tags + enforce-module-boundaries

```json
// packages/ui/project.json
{
  "name": "@myorg/ui",
  "tags": ["scope:shared", "type:ui"]
}

// packages/database/project.json
{
  "name": "@myorg/database",
  "tags": ["scope:backend", "type:data-access"]
}

// apps/web/project.json
{
  "name": "@myorg/web",
  "tags": ["scope:web", "type:app"]
}

// apps/api/project.json
{
  "name": "@myorg/api",
  "tags": ["scope:api", "type:app"]
}
```

```json
// .eslintrc.json
{
  "rules": {
    "@nx/enforce-module-boundaries": [
      "error",
      {
        "enforceBuildableLibDependency": true,
        "allow": [],
        "depConstraints": [
          {
            "sourceTag": "type:app",
            "onlyDependOnLibsWithTags": ["type:ui", "type:data-access", "type:util", "type:feature"]
          },
          {
            "sourceTag": "type:feature",
            "onlyDependOnLibsWithTags": ["type:ui", "type:data-access", "type:util"]
          },
          {
            "sourceTag": "type:ui",
            "onlyDependOnLibsWithTags": ["type:ui", "type:util"]
          },
          {
            "sourceTag": "type:data-access",
            "onlyDependOnLibsWithTags": ["type:data-access", "type:util"]
          },
          {
            "sourceTag": "type:util",
            "onlyDependOnLibsWithTags": ["type:util"]
          },
          {
            "sourceTag": "scope:web",
            "onlyDependOnLibsWithTags": ["scope:web", "scope:shared"]
          },
          {
            "sourceTag": "scope:api",
            "onlyDependOnLibsWithTags": ["scope:api", "scope:shared"]
          },
          {
            "sourceTag": "scope:shared",
            "onlyDependOnLibsWithTags": ["scope:shared"]
          }
        ]
      }
    ]
  }
}
```

```
Tag hierarchy:

  TYPE tags (architectural layer):
    type:app          → Top level, depends on everything below
    type:feature      → Domain features, depends on ui + data + util
    type:ui           → UI components, depends on ui + util only
    type:data-access  → Data layer, depends on data + util only
    type:util         → Pure utilities, depends on util only (leaf)

  SCOPE tags (team/domain):
    scope:web         → Can use scope:web + scope:shared
    scope:api         → Can use scope:api + scope:shared
    scope:mobile      → Can use scope:mobile + scope:shared
    scope:shared      → Can ONLY use scope:shared (leaf)

  A package gets BOTH a type tag AND a scope tag:
    @myorg/web → ["scope:web", "type:app"]
    @myorg/ui → ["scope:shared", "type:ui"]
    @myorg/user-feature → ["scope:web", "type:feature"]
```

### 3.2 ESLint Import Restrictions (without Nx)

```javascript
// .eslintrc.js — package-level import restrictions
module.exports = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@myorg/web/*", "@myorg/api/*", "@myorg/admin/*"],
            message: "Libraries cannot import from applications. Extract shared code to packages/.",
          },
          {
            group: ["../../../*"],
            message: "Deep relative imports suggest missing package extraction.",
          },
        ],
      },
    ],
    "import/no-internal-modules": [
      "error",
      {
        allow: ["@myorg/*/src/**"],  // Only if explicitly needed
      },
    ],
  },
};
```

---

## 4. Team Namespacing (100+ packages)

```
For large monorepos, namespace packages by team/domain:

packages/
├── @ui/                                 # Design System team
│   ├── core/                            # package: @myorg/ui-core
│   │   ├── src/
│   │   │   ├── button/
│   │   │   ├── input/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── forms/                           # package: @myorg/ui-forms
│   ├── data-display/                    # package: @myorg/ui-data-display
│   ├── navigation/                      # package: @myorg/ui-navigation
│   ├── overlays/                        # package: @myorg/ui-overlays
│   ├── icons/                           # package: @myorg/ui-icons
│   └── theme/                           # package: @myorg/ui-theme
│
├── @data/                               # Backend/Data team
│   ├── database/                        # package: @myorg/database
│   ├── cache/                           # package: @myorg/cache
│   ├── search/                          # package: @myorg/search
│   └── queue/                           # package: @myorg/queue
│
├── @platform/                           # Platform/DX team
│   ├── logger/                          # package: @myorg/logger
│   ├── config/                          # package: @myorg/config
│   ├── errors/                          # package: @myorg/errors
│   ├── auth/                            # package: @myorg/auth
│   ├── testing/                         # package: @myorg/testing
│   └── feature-flags/                   # package: @myorg/feature-flags
│
├── @domain/                             # Domain logic (shared business rules)
│   ├── users/                           # package: @myorg/domain-users
│   ├── orders/                          # package: @myorg/domain-orders
│   ├── payments/                        # package: @myorg/domain-payments
│   └── products/                        # package: @myorg/domain-products
│
└── @shared/                             # Cross-cutting (anyone can use)
    ├── types/                           # package: @myorg/shared-types
    ├── utils/                           # package: @myorg/utils
    ├── constants/                       # package: @myorg/constants
    └── validators/                      # package: @myorg/validators

Benefits of namespacing:
  ✅ Clear ownership: @ui/* → design system team
  ✅ Discoverable: find all data packages in @data/
  ✅ Boundary enforcement: @ui/ can only depend on @shared/
  ✅ CODEOWNERS: one rule per namespace directory
  ✅ Scalable: add new packages within existing namespaces
```

---

## 5. Git Performance at Scale

```
Problem: Large monorepos have slow Git operations.

Solution 1: Partial Clone (recommended for 50-200 packages)
  # Clone without blob objects (download on demand)
  git clone --filter=blob:none https://github.com/org/monorepo.git

  # Git downloads file contents only when accessed
  # Reduces clone size from GB to MB
  # Transparent to developers (git log, diff, blame all work)

Solution 2: Sparse Checkout (recommended for 200+ packages)
  # Clone and checkout only specific directories
  git clone --filter=blob:none --sparse https://github.com/org/monorepo.git
  cd monorepo

  # Add directories you work on
  git sparse-checkout set apps/web packages/ui packages/shared-types config/

  # Your working tree only contains those directories
  # Other directories exist in git history but aren't on disk

  # Add more directories as needed
  git sparse-checkout add packages/database

Solution 3: VFS for Git (500+ developers — Microsoft scale)
  # Virtual file system — files appear on disk but download on access
  # Used by Microsoft for Windows repo (300GB)
  # Requires VFS for Git (formerly GVFS)
  # Only recommended for extreme scale with dedicated infra team

Solution 4: Shallow Clone (CI optimization)
  # In CI, clone only recent history
  git clone --depth=1 https://github.com/org/monorepo.git    # Turborepo
  git clone --depth=0 https://github.com/org/monorepo.git    # Nx (needs full)

  # For Nx, use nrwl/nx-set-shas to optimize affected detection
  # without requiring --depth=0 (fetches only needed commits)

Performance tips:
  ✅ Enable Git's filesystem monitor: git config core.fsmonitor true
  ✅ Enable commit graph: git config fetch.writeCommitGraph true
  ✅ Use maintenance: git maintenance start (auto-gc, prefetch)
  ✅ Keep .gitignore comprehensive (no dist/, node_modules/)
  ✅ Use Git LFS for large binary files (images, fonts, videos)
```

---

## 6. Distributed Task Execution (DTE)

```
Standard CI: One machine runs all tasks sequentially/parallel.

DTE: Multiple CI machines split tasks across agents.

Standard (1 machine, 50 tasks):
  ┌─────────────────────────────────────────┐
  │  Agent 1 (solo)                          │
  │  Task 1 → Task 2 → Task 3 → ... → 50  │
  │  Total time: 25 minutes                  │
  └─────────────────────────────────────────┘

DTE (3 machines, 50 tasks):
  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │  Agent 1          │  │  Agent 2          │  │  Agent 3          │
  │  Tasks: 1,4,7,... │  │  Tasks: 2,5,8,... │  │  Tasks: 3,6,9,... │
  │  ~17 tasks         │  │  ~17 tasks         │  │  ~16 tasks         │
  │  Time: 8 minutes   │  │  Time: 9 minutes   │  │  Time: 8 minutes   │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
  Total time: 9 minutes (64% faster)

DTE with Nx Cloud:
  1. Main job determines tasks to run
  2. Nx Cloud distributes tasks across agents
  3. Agents report results back
  4. Main job collects results and reports status

  Configuration:
    # nx.json
    {
      "nxCloudAccessToken": "...",
      "parallel": 3
    }

    # CI workflow
    - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js"
    - run: nx affected -t lint test build e2e

  Benefits:
    ✅ Near-linear scaling with more agents
    ✅ Smart task assignment (Nx Cloud knows task durations)
    ✅ Automatic retry of flaky tasks
    ✅ Detailed analytics dashboard

  Cost: Nx Cloud paid plan (enterprise feature)
```

---

## 7. Governance Policies

```
For 50+ developer monorepos, formalize governance:

1. New Package Policy:
   - RFC/proposal required for new packages
   - Platform team reviews package structure
   - CODEOWNERS assigned before merge
   - README with purpose, API, usage examples
   - At least 1 test

2. Dependency Addition Policy:
   - New external dependency requires platform team approval
   - Security scan (npm audit / Snyk) before approval
   - License compatibility check
   - Bundle size impact documented
   - Prefer existing alternatives over new packages

3. Breaking Change Policy:
   - Changeset required (major version bump)
   - Migration guide in CHANGELOG
   - Deprecated API kept for 1 release cycle
   - All affected consumers updated in same PR

4. Code Review Policy:
   - CODEOWNERS review required (branch protection)
   - Cross-team changes need both teams' approval
   - Shared config changes need platform team
   - Lock file changes need platform team

5. Merge Policy:
   - Squash merge by default (clean history)
   - Merge commits for multi-commit PRs (preserves context)
   - Merge queue enabled for high-traffic repos
   - Auto-delete branches after merge

6. Release Policy:
   - Apps: Continuous deployment on main merge
   - Libraries: Changesets-based versioning
   - Breaking changes: Coordinated release day
```

---

## 8. Metrics and Monitoring

```
Track these metrics for monorepo health:

Build Performance:
  - Average CI time (target: < 15 minutes)
  - Cache hit rate (target: > 80%)
  - Affected package count per PR (trend)
  - Flaky test rate (target: < 1%)

Developer Experience:
  - Time from PR open to first CI feedback (target: < 5 minutes)
  - pnpm install time (target: < 30 seconds with cache)
  - Number of cross-team PRs per month
  - Time to merge (target: < 1 day)

Codebase Health:
  - Package count over time
  - Dependency depth (max depth in graph)
  - Circular dependency count (target: 0)
  - CODEOWNERS coverage (target: 100%)

Tools:
  - Nx Cloud dashboard: task analytics, cache stats
  - GitHub Insights: PR metrics, review times
  - Custom dashboards: Grafana, Datadog
```

---

## 9. Code Ownership Models

```
Model 1: Strong Ownership (RECOMMENDED for 50+ developers)
  Each package has ONE owning team.
  Only that team can approve changes to their packages.
  Other teams must open PRs and get owning team review.

  Implementation:
    - CODEOWNERS maps every directory to a team
    - Branch protection requires CODEOWNERS approval
    - Owning team responsible for quality, tests, and maintenance

  Best for: Enterprise, regulated industries, critical packages

Model 2: Collective Ownership (best for < 20 developers)
  Any developer can change any package.
  Reviews are advisory, anyone can approve.

  Best for: Small teams, startups, early-stage products

Model 3: Hybrid (RECOMMENDED for 50-200 developers)
  - Platform/config packages: Strong ownership (platform team)
  - Application packages: Team ownership with guest contributions
  - Shared libraries: Maintainer team + open contributions (inner source)

  Implementation:
    - CODEOWNERS for critical paths (platform, config, infra)
    - Open contribution to feature packages with maintainer review
    - "Trusted contributor" status for frequent cross-team contributors

Model 4: Inner Source (RECOMMENDED for 200+ developers)
  - Every package has a maintainer team
  - Any developer can contribute via PR (inner source model)
  - Maintainer team reviews and merges
  - Each package has CONTRIBUTING.md with rules and conventions
  - SLA for review turnaround (e.g., 24 hours)

  Best for: Large orgs wanting ownership + collaboration
```

---

## 10. Merge Queue Strategies

```
Problem: Multiple PRs pass CI independently but break when merged together.

  PR A (tested against main@v1) ✅
  PR B (tested against main@v1) ✅
  PR A merges → main@v2
  PR B merges → main@v3 (tested against v1, NOT v2!)
  Result: main@v3 may be broken (semantic conflict between A and B)

Solution: Merge Queue

  PR A and PR B both pass CI → enter merge queue
  Queue tests: main + A + B together
  If tests pass → both merge atomically
  If tests fail → B retested against main + A
  Result: main is ALWAYS green

GitHub Merge Queue Configuration:
  Repository Settings → Branches → main → Branch Protection:
    ✅ Require merge queue
    Build concurrency: 5
    Maximum group size: 5
    Wait timeout: 60 minutes

  # .github/workflows/merge-queue.yml
  name: Merge Queue CI
  on:
    merge_group:
      branches: [main]
  jobs:
    ci:
      runs-on: ubuntu-latest
      timeout-minutes: 20
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
        - run: pnpm turbo lint typecheck build test

When to enable merge queue:
  ✅ > 20 developers merging daily
  ✅ Frequent "broken main" from merge races
  ✅ CI passes on PR but fails after merge
  ❌ < 10 developers (overhead not justified)
  ❌ CI is very fast (< 2 minutes)
```

---

## 11. Custom Executors and Plugins

### Nx Custom Generator (scaffolding new packages)

```typescript
// tools/generators/package/index.ts
import { Tree, generateFiles, names, updateJson, formatFiles } from '@nx/devkit';

interface PackageGeneratorSchema {
  name: string;
  scope: 'shared' | 'frontend' | 'backend' | 'mobile';
  type: 'lib' | 'ui' | 'util' | 'data-access' | 'types';
}

export default async function packageGenerator(tree: Tree, schema: PackageGeneratorSchema) {
  const projectName = names(schema.name).fileName;
  const projectRoot = `packages/${projectName}`;
  const importPath = `@myorg/${projectName}`;

  // Generate files from templates
  generateFiles(tree, './files', projectRoot, {
    ...schema,
    projectName,
    importPath,
    tmpl: '',
  });

  // Update tsconfig.base.json paths
  updateJson(tree, 'tsconfig.base.json', (json) => {
    json.compilerOptions.paths[importPath] = [`${projectRoot}/src/index.ts`];
    return json;
  });

  await formatFiles(tree);
}

// Usage: nx g @myorg/tools:package --name=my-lib --scope=shared --type=util
```

### Nx Custom Executor (deployment)

```typescript
// tools/executors/deploy/executor.ts
import { ExecutorContext, logger } from '@nx/devkit';

interface DeployOptions {
  environment: 'staging' | 'production';
  region: string;
}

export default async function deploy(options: DeployOptions, context: ExecutorContext) {
  const project = context.projectName;
  logger.info(`Deploying ${project} to ${options.environment}`);

  // Build Docker image, push to registry, update k8s deployment
  // ...custom deployment logic...

  return { success: true };
}

// Usage in project.json:
// "deploy": {
//   "executor": "./tools/executors/deploy:default",
//   "options": { "environment": "staging", "region": "us-east-1" }
// }
```

### Turborepo Custom Generator

```typescript
// turbo/generators/config.ts
import type { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator('package', {
    description: 'Create a new internal package',
    prompts: [
      { type: 'input', name: 'name', message: 'Package name?' },
      { type: 'list', name: 'type', choices: ['lib', 'ui', 'util', 'types'] },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'packages/{{name}}',
        templateFiles: 'templates/package/**/*',
        base: 'templates/package',
      },
    ],
  });
}

// Usage: pnpm turbo gen package
```

---

## 12. Performance Optimization (Advanced)

### Nx Daemon

```
The Nx Daemon is a background process that:
  - Watches filesystem for changes (using native watchers)
  - Pre-computes the project graph
  - Caches hash computations
  - Makes nx affected / nx graph nearly instant

  Enabled by default in Nx 15+.
  Disable in CI: NX_DAEMON=false (single-run, daemon not needed)

  Impact:
    Without daemon: nx affected → 2-5 seconds (parse all config)
    With daemon:    nx affected → < 200ms (pre-computed)
```

### Incremental TypeScript Builds

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "composite": true,       // Enable project references
    "incremental": true,     // Only recompile changed files
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}

// packages/ui/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "references": [
    { "path": "../shared-types" }   // TypeScript knows about deps
  ]
}

// Build incrementally:
// tsc --build packages/ui    → Only recompiles changed files
// Combined with Turbo/Nx caching → even cache misses are fast
```

### Cache Hit Rate Optimization

```
Target: > 80% remote cache hit rate

Common causes of low hit rate:
  1. Root config changes (tsconfig.base.json) → invalidates ALL packages
     Fix: Minimize root config changes, move config to per-package

  2. Lock file changes → invalidates ALL packages
     Fix: Batch dependency updates weekly, not daily

  3. Undeclared env variables → wrong cache served
     Fix: Declare ALL env vars in turbo.json env/globalEnv

  4. Test files in build inputs → unnecessary rebuilds
     Fix: "inputs": ["$TURBO_DEFAULT$", "!**/*.test.*"]

  5. Generated files not in .gitignore → phantom changes
     Fix: Comprehensive .gitignore (dist/, .next/, coverage/)

Monitoring:
  Turborepo: pnpm turbo build --summarize
  Nx Cloud: Dashboard at nx.app (shows hit rate, task timing)
```

---

## 13. Branch Protection Per-Path

```
GitHub CODEOWNERS + Branch Protection:
  1. CODEOWNERS maps paths to required reviewers
  2. Branch protection requires CODEOWNERS approval
  3. Together, they enforce per-path review requirements

Configuration (GitHub Settings → Branches → main):
  ✅ Require pull request reviews before merging
  ✅ Require review from Code Owners
  ✅ Require status checks to pass
  ✅ Require branches to be up to date
  ✅ Require merge queue (for 20+ devs)
  ✅ Include administrators (no exceptions)

GitHub Rulesets (more granular, newer feature):
  Can define rules per path pattern beyond CODEOWNERS:
  - /packages/database/** → Require 2 reviewers (DBA team)
  - /infrastructure/** → Require security review
  - /.github/workflows/** → Require DevOps + security review
  - /packages/auth/** → Require security team review

  Rulesets can enforce:
  - Required reviewers by path
  - Required status checks by path
  - Bypass permissions (who can skip rules)
  - Deployment protection rules
```

---

## 14. Module Federation for Micro-Frontends in Monorepos

```
Module Federation: Runtime code sharing between separately deployed apps.

Architecture in a monorepo:
  ┌─────────────────────────────────────────────────┐
  │                   Shell App                      │
  │   (apps/shell — host application)                │
  │                                                  │
  │   ┌──────────┐  ┌──────────┐  ┌──────────┐     │
  │   │ Remote 1 │  │ Remote 2 │  │ Remote 3 │     │
  │   │ (web)    │  │ (admin)  │  │ (billing)│     │
  │   │ CDN A    │  │ CDN B    │  │ CDN C    │     │
  │   └──────────┘  └──────────┘  └──────────┘     │
  │                                                  │
  │   ┌────────────────────────────────────────┐    │
  │   │ Shared: @myorg/ui, react, react-dom    │    │
  │   │ (loaded once, shared across remotes)    │    │
  │   └────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────┘

Why monorepo + Module Federation works well:
  ✅ Shared packages (@myorg/ui) guaranteed compatible at build time
  ✅ TypeScript types shared across micro-frontends (no drift)
  ✅ Consistent tooling: all remotes use same ESLint, TS config
  ✅ E2E tests can test full integration of all micro-frontends
  ✅ Atomic refactoring of shared interfaces

When to use:
  ✅ Multiple teams deploy frontend independently
  ✅ Large frontend with clear domain boundaries
  ✅ Different teams have different release cadences
  ❌ Small frontend (< 20 routes)
  ❌ Single team manages all frontend code
  ❌ SSR/SEO critical (Module Federation is primarily CSR)

Nx has first-class Module Federation support:
  nx g @nx/react:host shell --remotes=web,admin,billing
  # Generates shell app + remote apps with Module Federation config
```

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No ownership | "Who owns this package?" | CODEOWNERS for every directory |
| No boundaries | Any package imports anything | Nx module boundaries with tags |
| No governance | Random packages appear, abandoned code | New package policy + platform review |
| Flat 100+ packages | Impossible to navigate | Namespace by team: @ui/, @data/, @platform/ |
| Slow Git | `git status` takes seconds | Partial clone, sparse checkout, fsmonitor |
| No metrics | "Is the monorepo healthy?" | Track CI time, cache hits, package count |
| One team maintains everything | Platform team bottleneck | Distributed ownership via CODEOWNERS |
| No DTE for large repos | 30+ minute CI with 200 packages | Nx Cloud DTE across multiple agents |
| No flaky test management | Flaky test blocks unrelated PRs | Quarantine flaky tests, auto-retry |
| No dependency policy | Random packages added without review | Platform team approves new dependencies |
| No internal documentation | "How do I add a package?" | Getting started guide + templates |
| Over-coupled packages | Changing 1 package affects 80% of repo | Refactor boundaries, extract shared leaf packages |

---

## 16. Enforcement Checklist

### Foundation (50+ packages)
- [ ] CODEOWNERS configured -- every package directory has explicit owners
- [ ] Module boundaries enforced -- Nx tags + `@nx/enforce-module-boundaries` lint rule
- [ ] Remote caching enabled -- CI cache shared across all PRs and developers
- [ ] Tags assigned -- every package tagged by scope AND type
- [ ] Affected-only CI -- NEVER build all packages on every PR
- [ ] pnpm strict mode -- no phantom dependencies
- [ ] Single lockfile committed -- frozen in CI

### Ownership and Governance (50+ developers)
- [ ] Code ownership model documented -- strong, collective, hybrid, or inner source
- [ ] Team namespacing -- packages grouped by owning team (@frontend, @backend, @platform)
- [ ] CODEOWNERS coverage -- 100% of packages have explicit owners
- [ ] New package policy -- RFC + platform review + CODEOWNERS + README + tests
- [ ] Dependency addition policy -- security scan + license check + platform approval
- [ ] Breaking change policy -- Changesets + migration guide + deprecation cycle
- [ ] Governance checks automated -- CI validates structure, boundaries, deps

### Performance (100+ packages)
- [ ] Git performance optimized -- partial clone, sparse checkout, fsmonitor for large repos
- [ ] Nx daemon enabled -- pre-computed project graph for instant affected detection
- [ ] Incremental TypeScript -- composite + incremental builds configured
- [ ] Cache hit rate monitored -- target > 80%, optimize inputs/outputs
- [ ] CI timeout set -- 15-20 minutes max per job

### Scale Infrastructure (200+ packages)
- [ ] Merge queue enabled -- GitHub Merge Queue for 20+ developer teams
- [ ] Branch protection per-path -- CODEOWNERS + GitHub Rulesets
- [ ] Distributed task execution -- Nx Cloud DTE across multiple CI agents
- [ ] VFS/Scalar evaluated -- for repos > 50 GB
- [ ] Remote development environments -- Codespaces/Gitpod for complex setup
- [ ] Platform/DX team assigned -- dedicated infrastructure ownership
- [ ] Metrics dashboard -- CI time, cache rates, repo health
- [ ] Onboarding documentation -- team-specific guides with sparse checkout
- [ ] Module Federation evaluated -- for micro-frontend deployment independence
- [ ] Custom generators/executors -- for consistent package creation/deployment
