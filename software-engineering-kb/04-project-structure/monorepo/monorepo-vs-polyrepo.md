# Monorepo vs Polyrepo Decision Framework

> **AI Plugin Directive:** When the user is deciding between monorepo and polyrepo, ALWAYS use this decision framework. Analyze team size, code sharing needs, organizational structure, release cadence, and technology stack to make the recommendation. This guide covers both extremes and ALL hybrid approaches in between.

**Core Rule: Choose monorepo when cross-project code sharing is significant and teams collaborate on shared infrastructure. Choose polyrepo when projects are truly independent with different lifecycles, languages, and teams. NEVER choose based on trend — choose based on your team's actual code sharing patterns, release cadence, and organizational structure.**

---

## 1. Decision Matrix (25 Dimensions)

| # | Factor | Favors Monorepo | Favors Polyrepo |
|---|--------|----------------|----------------|
| 1 | Code sharing | >30% shared code between projects | <10% shared code |
| 2 | Team structure | Cross-functional, shared ownership | Autonomous teams, clear boundaries |
| 3 | Release cadence | Coordinated releases | Independent release schedules |
| 4 | Primary languages | Same language/toolchain | Different languages per project |
| 5 | Team size | 2-200 developers | 200+ without platform team |
| 6 | Change frequency | Frequent cross-project changes | Rare cross-project changes |
| 7 | Access control | Same access for most code | Strict per-project access (compliance) |
| 8 | CI/CD | Shared pipelines + tooling | Independent per project |
| 9 | Dependencies | Shared internal deps | Published packages (npm, PyPI) |
| 10 | Onboarding | "Clone once, see everything" | "Clone what you need" |
| 11 | API contracts | Internal types, direct imports | Published schemas, versioned APIs |
| 12 | Testing | Cross-project integration tests | Per-project testing only |
| 13 | Deployment | Multi-app coordinated deploys | Independent deployment per service |
| 14 | Tooling investment | Willing to invest in monorepo tooling | Minimal tooling overhead per repo |
| 15 | Code review | Cross-team reviews common | Team-scoped reviews |
| 16 | Refactoring | Frequent cross-boundary refactors | Rare cross-service refactors |
| 17 | Build system | Willing to learn Nx/Turbo/Bazel | Standard `npm run build` per repo |
| 18 | Version control | Comfortable with large repos | Prefer small, focused repos |
| 19 | Open source | Internal project | Multiple OSS projects with different communities |
| 20 | Compliance | Standard development | SOX/HIPAA requiring audit trails per service |
| 21 | Git performance | Acceptable with sparse checkout | Git must be instant |
| 22 | IDE performance | Project-scoped focus is acceptable | Must open and search full repo |
| 23 | Platform team | Have (or plan) platform/DX team | No platform team capacity |
| 24 | Service boundaries | Still evolving, frequently changing | Well-established, stable |
| 25 | Organization growth | Growing, boundaries shifting | Stable, well-partitioned teams |

---

## 2. Decision Flowchart

```
START: How much code do your projects share?
│
├── Heavy sharing (>30%)
│   ├── Same primary language? ──→ YES ──→ MONOREPO
│   │                           └── NO
│   │                               └── Can you standardize? ──→ YES ──→ MONOREPO
│   │                                                         └── NO ──→ HYBRID
│   │
│   └── (Go to team size check below)
│
├── Moderate sharing (10-30%)
│   ├── Frequent cross-project changes? ──→ YES ──→ MONOREPO
│   │                                    └── NO ──→ HYBRID or POLYREPO
│   │
│   └── Can shared code be published as packages? ──→ YES ──→ POLYREPO with shared packages
│                                                   └── NO ──→ MONOREPO
│
└── Minimal sharing (<10%)
    ├── Same team works on multiple projects? ──→ YES ──→ Consider MONOREPO (convenience)
    │                                         └── NO ──→ POLYREPO
    │
    └── Different languages per project? ──→ YES ──→ POLYREPO (definitely)
                                          └── NO ──→ Either works

TEAM SIZE CHECK:
├── 1-10 developers   → Simple monorepo (Turborepo)
├── 10-50 developers  → Full monorepo (Nx + remote caching)
├── 50-200 developers → Monorepo with CODEOWNERS + boundaries (Nx)
├── 200-500 developers → Monorepo with Bazel or domain-based monorepos
└── 500+ developers   → Domain monorepos or custom tooling (Google/Meta approach)
```

---

## 3. Detailed Comparison

### 3.1 Developer Experience

```
                            Monorepo                    Polyrepo
─────────────────────────── ─────────────────────────── ──────────────────────────
Clone time                  Longer (one large repo)     Short (small repos)
Search scope                All code at once            Per-repo only
Cross-project navigation    Direct (IDE go-to-def)      Requires npm link or clone
Dependency updates          Automatic (workspace:*)     Manual (npm publish cycle)
Refactoring reach           Entire codebase             Single repo only
Context switching           Same repo, different dir    Different repos, different shells
New project setup           Generator (nx g, turbo gen) Clone template, reconfigure
Onboarding                  "git clone" once            Clone N repos, configure each
IDE memory                  Higher (more files indexed) Lower per repo
Git operations              Slower as repo grows        Always fast
```

### 3.2 CI/CD Comparison

```
                            Monorepo                    Polyrepo
─────────────────────────── ─────────────────────────── ──────────────────────────
Pipeline complexity         One pipeline, affected-only N pipelines, each simple
Cross-project testing       Easy (run in same CI)       Hard (trigger external CI)
Cache reuse                 High (remote cache shared)  None (each repo independent)
Build time (worst case)     All packages (no cache)     One package only
Build time (best case)      Seconds (full cache hit)    Full build of one package
Deployment coordination     Single workflow             Multi-repo deployment orchestration
Secret management           One set of secrets          N sets of secrets
Pipeline maintenance        One config to maintain      N configs to maintain
Flaky test impact           Can block unrelated PRs     Isolated to one project
CI provider costs           Higher (more compute)       Distributed but more runs total
```

### 3.3 Code Sharing Comparison

```
MONOREPO — Direct Imports:

  // apps/web/src/components/UserCard.tsx
  import { User } from "@myorg/shared-types";      // Direct import
  import { Button } from "@myorg/ui";               // Direct import
  import { formatDate } from "@myorg/utils";        // Direct import

  // Change shared-types → TypeScript catches ALL consumers immediately
  // No publish cycle, no version mismatch, no "which version?"

POLYREPO — Published Packages:

  // web-app/src/components/UserCard.tsx
  import { User } from "@myorg/shared-types";       // Published v1.2.0
  import { Button } from "@myorg/ui";                // Published v3.4.1
  import { formatDate } from "@myorg/utils";         // Published v2.0.0

  // Change shared-types:
  //   1. PR to shared-types repo
  //   2. Merge + publish v1.3.0 to npm
  //   3. PR to web-app: update dep to v1.3.0
  //   4. PR to api-server: update dep to v1.3.0
  //   5. PR to mobile-app: update dep to v1.3.0
  //   6. Hope all consumers update before v1.2.0 becomes incompatible

POLYREPO with git submodules (DON'T):
  ❌ Complex, fragile, confusing for developers
  ❌ Submodule pinned to specific commit (manual sync)
  ❌ NEVER use git submodules for code sharing
```

---

## 4. Hybrid Approaches

### 4.1 Domain-Based Monorepos (RECOMMENDED for large orgs)

```
Organization repos:
├── frontend-monorepo/                    ← Frontend team owns
│   ├── apps/
│   │   ├── customer-web/
│   │   ├── merchant-dashboard/
│   │   └── admin-panel/
│   ├── packages/
│   │   ├── ui-components/
│   │   ├── shared-hooks/
│   │   └── design-tokens/
│   ├── pnpm-workspace.yaml
│   └── turbo.json
│
├── backend-monorepo/                     ← Backend team owns
│   ├── services/
│   │   ├── user-service/
│   │   ├── order-service/
│   │   └── payment-service/
│   ├── packages/
│   │   ├── shared-types/
│   │   ├── database-utils/
│   │   └── auth-middleware/
│   ├── pnpm-workspace.yaml
│   └── turbo.json
│
├── infrastructure-repo/                  ← DevOps team owns
│   ├── terraform/
│   ├── kubernetes/
│   └── docker/
│
└── contracts-repo/                       ← Shared API contracts
    ├── openapi/
    ├── protobuf/
    └── asyncapi/

When to use: >100 developers, clear team boundaries, shared code WITHIN domain
Shared code between domains: Published packages (npm) from contracts-repo
```

### 4.2 Monorepo + Satellite Repos

```
Organization repos:
├── platform-monorepo/                    ← Core product
│   ├── apps/web/
│   ├── apps/api/
│   ├── packages/ui/
│   └── packages/shared-types/
│
├── data-pipeline/                        ← Python/Spark (independent)
│   └── Completely different tech stack
│
├── ml-platform/                          ← ML team (independent)
│   └── Completely different tech stack
│
└── mobile-app/                           ← React Native (references shared via npm)
    └── Uses @company/shared-types from npm

When to use: Primary product in monorepo, specialized projects in separate repos
Connection: Published packages (npm, PyPI) for shared contracts
```

### 4.3 Polyrepo with Shared Packages

```
Organization repos:
├── shared-types/                         ← Published as @company/types
│   ├── src/
│   ├── package.json
│   └── .github/workflows/publish.yml
│
├── shared-ui/                            ← Published as @company/ui
│   ├── src/
│   └── package.json
│
├── web-app/                              ← Imports @company/types + @company/ui
│   ├── package.json: "@company/types": "^1.2.0"
│   └── renovate.json (auto-update deps)
│
├── api-server/                           ← Imports @company/types
│   ├── package.json: "@company/types": "^1.2.0"
│   └── renovate.json
│
└── mobile-app/                           ← Imports @company/types + @company/ui
    ├── package.json: "@company/types": "^1.2.0"
    └── renovate.json

When to use: Teams prefer independence, moderate code sharing
Critical: MUST use Renovate/Dependabot for automated dependency updates
Without automation: version drift is GUARANTEED
```

---

## 5. Migration Strategies

### 5.1 Polyrepo → Monorepo

```
Phase 1: Prepare (Week 1-2)
  1. Inventory all repos: list, dependencies, languages, team owners
  2. Choose monorepo tool (Nx or Turborepo)
  3. Create monorepo skeleton with root config
  4. Set up CI/CD pipeline with affected detection
  5. Configure remote caching

Phase 2: Move shared libraries first (Week 3-4)
  1. Move @company/shared-types → packages/shared-types/
  2. Move @company/ui → packages/ui/
  3. Move @company/utils → packages/utils/
  4. Update imports to use workspace:* protocol
  5. Remove published versions from npm registry (or deprecate)

Phase 3: Move applications one at a time (Week 5+)
  1. Move web-app → apps/web/
     - Update imports to workspace packages
     - Verify build + tests pass
     - Update CI/CD for new location
  2. Move api-server → apps/api/
  3. Continue until all repos migrated

Phase 4: Clean up
  1. Archive old repositories (don't delete yet)
  2. Update documentation and onboarding guides
  3. Configure CODEOWNERS
  4. Set up module boundary enforcement

Git history preservation:
  # Move repo with history intact
  git subtree add --prefix=apps/web https://github.com/org/web-app.git main

  # Or use git filter-repo for cleaner history
  # In web-app repo:
  git filter-repo --to-subdirectory-filter apps/web
  # In monorepo:
  git remote add web-app ../web-app
  git fetch web-app
  git merge web-app/main --allow-unrelated-histories
```

### 5.2 Monorepo → Polyrepo (Extraction)

```
When to extract:
  - Package has grown into independent product with own team
  - Different release cadence (daily vs quarterly)
  - Different access control requirements
  - Different language/toolchain (Python ML project)

Steps:
  1. Identify package to extract with its dependency tree
  2. Publish shared dependencies as npm packages first
  3. Create new repository from package:
     git subtree split --prefix=apps/extracted-app -b extracted-branch
     cd ../new-repo && git pull ../monorepo extracted-branch
  4. Update imports from workspace:* to published versions
  5. Set up independent CI/CD in new repo
  6. Remove from monorepo after transition period
  7. Set up Renovate/Dependabot for dependency updates

NEVER extract without:
  ✅ Published versions of all shared dependencies
  ✅ Independent CI/CD pipeline working
  ✅ Automated dependency update tool (Renovate)
  ✅ Clear ownership and on-call for extracted project
```

---

## 6. Real-World Case Studies

```
MONOREPO SUCCESS STORIES:

Google (google3):
  - 86 TB, 2 billion lines of code
  - 25,000+ developers
  - Custom VFS (CitC — Clients in the Cloud)
  - Custom build tool (Blaze, open-sourced as Bazel)
  - Trunk-based development, no branches
  - Lesson: Works at ANY scale with proper tooling

Vercel:
  - Next.js, Turborepo, all packages in one repo
  - Built Turborepo because they NEEDED monorepo tooling
  - Lesson: Even the toolmakers use monorepos

Airbnb:
  - Migrated web + mobile to monorepo
  - Uses Nx for orchestration
  - Shared design system across platforms
  - Lesson: Shared UI is a top reason for monorepo

Uber (Android):
  - Migrated 1000+ modules from polyrepo to monorepo
  - Reduced build times from 30 min to 5 min with caching
  - Lesson: Build caching makes monorepo FASTER than polyrepo

POLYREPO SUCCESS STORIES:

Netflix:
  - Hundreds of microservices in separate repos
  - Strong team autonomy, independent deployments
  - Shared code via published internal libraries
  - Lesson: Works when teams are truly independent

Amazon:
  - "Two-pizza teams" with independent repos
  - Service-oriented architecture
  - Strict API contracts between services
  - Lesson: Polyrepo aligns with strong team autonomy

HYBRID EXAMPLES:

Microsoft:
  - Some divisions use monorepo (Office, VS Code)
  - Other divisions use polyrepo
  - Rush (their monorepo tool) for JS/TS projects
  - Lesson: Same company can use both approaches

Stripe:
  - API monorepo (Ruby backend + dashboard)
  - Separate repos for SDKs (per language)
  - Shared API spec in contracts repo
  - Lesson: Hybrid based on language boundaries
```

---

## 7. Conway's Law and Repository Structure

```
Conway's Law: "Organizations design systems that mirror their communication structures"

Applied to repo structure:

  Org structure              →   Recommended repo structure
  ─────────────────────────  →   ──────────────────────────
  Single cross-functional    →   Monorepo
  team building one product

  2-3 teams with shared      →   Monorepo with CODEOWNERS
  codebase and dependencies

  5-10 teams organized by    →   Monorepo with strict boundaries
  domain (users, orders)         (Nx module boundaries)

  10+ autonomous teams with  →   Domain-based monorepos
  clear domain ownership         (1 monorepo per domain)

  50+ teams, different tech  →   Polyrepo with published packages
  stacks, minimal sharing

  Enterprise with regulatory →   Polyrepo (audit trails per service)
  per-service requirements

The WRONG approach:
  ❌ Autonomous teams + monorepo = constant conflicts
  ❌ Cross-functional team + polyrepo = constant npm publish pain
  ❌ Repo structure that contradicts team structure = friction

The RIGHT approach:
  ✅ Match repo boundaries to team boundaries
  ✅ Shared code lives where the sharing teams can access it
  ✅ Review the decision when team structure changes
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Monorepo without tooling | Custom bash scripts, broken builds | Adopt Nx or Turborepo |
| Polyrepo with heavy sharing | "npm publish" cycle 10+ times/week | Migrate shared code to monorepo |
| Git submodules for sharing | Confusing, pinned to old commits | Replace with monorepo or published packages |
| Monorepo for unrelated projects | Python ML + Java backend + Go CLI | Separate repos (no meaningful sharing) |
| Hybrid without automation | Shared packages not auto-updated | Renovate/Dependabot for all consumers |
| Choosing based on trend | "Google uses monorepo so should we" | Analyze your ACTUAL sharing patterns |
| Ignoring Conway's Law | Repo structure contradicts team structure | Align repos with team boundaries |
| No decision documentation | "Why did we choose monorepo?" | Write an ADR (Architecture Decision Record) |
| One-size-fits-all | Same approach for all projects | Different projects may need different approaches |
| Partial migration | Half repos moved, half not, chaos | Complete migration or define stable hybrid |

---

## 9. Decision Documentation Template (ADR)

```markdown
# ADR-001: Repository Strategy

## Status: Accepted

## Context
We are building [product] with [N] projects and [M] developers.
Our projects share approximately [X]% code.
Our primary technology stack is [languages/frameworks].

## Decision
We will use [monorepo/polyrepo/hybrid] because:
- [Reason 1: code sharing pattern]
- [Reason 2: team structure]
- [Reason 3: release cadence]

## Tooling
- Monorepo tool: [Nx/Turborepo/Bazel/Rush]
- Package manager: [pnpm/yarn/npm]
- CI/CD: [GitHub Actions/GitLab CI]
- Remote caching: [Nx Cloud/Vercel/Custom]

## Consequences
### Positive
- [benefit 1]
- [benefit 2]

### Negative
- [trade-off 1]
- [trade-off 2]

## Review Date
Re-evaluate in [6 months] or when team size reaches [N+10].
```

---

## 10. Enforcement Checklist

- [ ] Decision documented — ADR written with rationale and team consensus
- [ ] Team structure analyzed — repo boundaries align with team boundaries (Conway's Law)
- [ ] Code sharing percentage estimated — measured, not assumed
- [ ] Technology stack assessed — same or different across projects
- [ ] Release cadence compared — coordinated vs independent
- [ ] CI/CD complexity evaluated — for chosen approach
- [ ] Tooling selected — Nx, Turborepo, or Bazel (if monorepo)
- [ ] Migration plan created — if switching approaches (with timeline)
- [ ] Hybrid approach considered — not just binary monorepo/polyrepo
- [ ] Dependency update automation — Renovate/Dependabot (if polyrepo with shared packages)
- [ ] Access control evaluated — CODEOWNERS (monorepo) or per-repo permissions (polyrepo)
- [ ] Review cadence set — re-evaluate when team structure or sharing patterns change
