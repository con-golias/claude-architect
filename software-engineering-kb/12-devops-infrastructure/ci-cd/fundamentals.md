# CI/CD Fundamentals

| Attribute     | Value                                                                |
|--------------|----------------------------------------------------------------------|
| Domain       | DevOps > CI/CD                                                       |
| Importance   | Critical                                                             |
| Last Updated | 2026-03-10                                                           |
| Cross-ref    | [Pipeline Design](pipeline-design.md), [GitHub Actions](github-actions.md) |

---

## Core Concepts

### CI vs CD vs CD

Continuous Integration (CI), Continuous Delivery (CD), and Continuous Deployment (CD) represent progressively automated stages of software delivery.

**Continuous Integration** merges developer changes into a shared branch frequently (at least daily), running automated builds and tests on every push. The goal: detect integration issues within minutes, not days.

**Continuous Delivery** extends CI by ensuring that every change passing tests is *deployable* to production at any time. A human triggers the final release decision.

**Continuous Deployment** removes the human gate entirely. Every change that passes the full pipeline deploys to production automatically, without manual approval.

```text
CI                     Continuous Delivery         Continuous Deployment
┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ Code → Build →   │   │ Code → Build → Test  │   │ Code → Build → Test  │
│ Unit Tests       │   │ → Stage → [Manual    │   │ → Stage → Prod       │
│                  │   │   Deploy to Prod]     │   │ (fully automated)    │
└──────────────────┘   └──────────────────────┘   └──────────────────────┘
```

### Pipeline Anatomy

A CI/CD pipeline is a directed acyclic graph (DAG) of stages that transform source code into deployed artifacts.

```text
Source → Build → Test → Package → Deploy-Staging → Approve → Deploy-Prod
  │        │       │       │            │              │           │
  │        │       │       │            │              │           └─ Canary/Blue-Green
  │        │       │       │            │              └─ Manual gate
  │        │       │       │            └─ Smoke tests
  │        │       │       └─ Container image / binary
  │        │       └─ Unit + Integration + E2E
  │        └─ Compile, lint, type-check
  └─ Git push / PR / tag / schedule
```

```yaml
# Generic pipeline-as-code structure
stages:
  - name: build
    steps:
      - checkout
      - install-dependencies
      - compile
      - lint

  - name: test
    parallel:
      - unit-tests
      - integration-tests
      - security-scan        # Cross-ref: 08-security/devsecops

  - name: package
    steps:
      - build-docker-image
      - push-to-registry
      - sign-artifact

  - name: deploy-staging
    steps:
      - deploy
      - smoke-tests

  - name: deploy-production
    requires: manual-approval
    steps:
      - canary-deploy
      - progressive-rollout
      - post-deploy-verification
```

### Artifact Management

Build artifacts are the immutable outputs of a pipeline. Manage them with discipline.

**Artifact types:**
- Container images (Docker/OCI)
- Compiled binaries (Go, Rust, C++)
- Language packages (npm tarballs, Python wheels, JARs)
- Infrastructure bundles (Terraform plans, CloudFormation templates)

**Key principles:**
1. **Build once, deploy everywhere.** Never rebuild per environment. Promote the same artifact from staging to production.
2. **Immutable versioning.** Tag artifacts with commit SHA or semantic version. Never overwrite a published version.
3. **Provenance tracking.** Attach build metadata (commit, branch, pipeline ID, SLSA attestation).

```bash
# Tag Docker image with commit SHA for traceability
IMAGE="registry.example.com/myapp"
SHA=$(git rev-parse --short HEAD)
docker build -t "${IMAGE}:${SHA}" -t "${IMAGE}:latest" .
docker push "${IMAGE}:${SHA}"

# Sign with cosign for supply chain security
# Cross-ref: 08-security/dependency-and-supply-chain/code-signing.md
cosign sign --key cosign.key "${IMAGE}:${SHA}"
```

### Build Reproducibility

A reproducible build produces identical output from identical input, regardless of when or where it runs.

**Techniques:**
- Pin all dependency versions (lockfiles: `package-lock.json`, `go.sum`, `poetry.lock`)
- Use deterministic build tools (Bazel, Nix, Docker BuildKit with `--mount=type=cache`)
- Fix base image digests, not tags (`node:20@sha256:abc...` not `node:20`)
- Avoid timestamp-dependent operations in builds
- Declare build environment as code (Dockerized build agents)

```dockerfile
# Reproducible Dockerfile with pinned digest
FROM node:20.11.0-alpine@sha256:a1b2c3d4e5f6 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:20.11.0-alpine@sha256:a1b2c3d4e5f6 AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/main.js"]
```

### Trunk-Based Development vs GitFlow

**Trunk-Based Development (TBD)** is the modern standard for CI/CD. All developers commit to a single `main` branch (or short-lived feature branches merging within 1-2 days). Feature flags gate incomplete work.

**GitFlow** uses long-lived `develop`, `release/*`, and `hotfix/*` branches. It suits infrequent releases but creates merge conflicts and slows CI feedback.

```text
Trunk-Based Development:
main:     ─●─●─●─●─●─●─●─●─●─●─●─●─●─●─
              ╲─●─╱   ╲─●─╱   ╲─●─●─╱
              (1-2 day feature branches)

GitFlow:
main:     ─────────────●─────────────●────
develop:  ─●─●─●─●─●───┤─●─●─●─●─●───┤──
release:        ╲──●──●─╱       ╲──●──╱
feature:  ──●──●─╱
```

| Aspect               | Trunk-Based         | GitFlow              |
|-----------------------|---------------------|----------------------|
| Branch lifespan       | Hours to 2 days     | Days to weeks        |
| Merge frequency       | Multiple per day    | Per sprint/release   |
| CI feedback speed     | Minutes             | Hours to days        |
| Release cadence       | Continuous          | Scheduled            |
| Feature management    | Feature flags       | Feature branches     |
| Best for              | SaaS, microservices | Packaged software    |

### Merge Strategies

Choose the merge strategy that balances history clarity with CI speed.

**Merge commit** (`--no-ff`): Preserves full branch history. Use when branch context matters.

**Squash merge**: Collapses all branch commits into one. Use for clean `main` history in trunk-based workflows.

**Rebase merge**: Replays commits on top of `main`. Linear history without merge commits. Requires force-push discipline.

```bash
# Squash merge (preferred for trunk-based)
git checkout main
git merge --squash feature/auth-refactor
git commit -m "refactor: simplify auth token validation (#1234)"

# Rebase merge (linear history)
git checkout feature/auth-refactor
git rebase main
git checkout main
git merge --ff-only feature/auth-refactor
```

**CI implications:** Squash merging triggers CI once on `main`. Rebase can re-trigger CI for each replayed commit unless configured to run only on the final merge.

### Monorepo vs Polyrepo CI Implications

**Monorepo** (single repository for multiple projects):
- Requires path-based filtering to avoid running all pipelines on every change
- Benefits from shared CI configuration and build caching
- Tools: Nx, Turborepo, Bazel, Pants for affected-project detection

**Polyrepo** (one repository per service):
- Simpler per-repo pipelines, but cross-service changes require coordinated PRs
- Dependency management across repos requires versioning discipline
- Tools: Renovate, Dependabot for cross-repo dependency updates

```yaml
# Monorepo: path-based filtering (GitHub Actions)
on:
  push:
    paths:
      - 'packages/api/**'
      - 'packages/shared/**'
      - '.github/workflows/api-ci.yml'

# Turborepo: run only affected projects
- name: Build affected packages
  run: npx turbo run build --filter=...[HEAD^]
```

```yaml
# Polyrepo: trigger downstream pipeline on dependency change
on:
  repository_dispatch:
    types: [shared-lib-updated]
jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
```

### CI/CD Maturity Model

Assess organizational CI/CD maturity across five levels:

| Level | Name              | Characteristics                                              |
|-------|-------------------|--------------------------------------------------------------|
| 0     | Manual            | No automation, manual builds, FTP deploys                    |
| 1     | Basic CI          | Automated builds on push, some unit tests                    |
| 2     | Full CI           | Comprehensive tests, linting, SAST, automated on every PR   |
| 3     | Continuous Delivery| Automated staging deploys, manual prod gate, IaC            |
| 4     | Continuous Deploy  | Fully automated prod deploys, feature flags, canary releases|
| 5     | Optimized         | Self-healing pipelines, AI-driven test selection, sub-10min  |

### Pipeline-as-Code

Define pipelines in version-controlled files alongside application code. Never configure pipelines through a UI.

**Benefits:**
- Pipelines reviewed in PRs alongside code changes
- Full audit trail of pipeline modifications
- Reproducible pipeline behavior across environments
- Branch-level pipeline customization

**Common formats:**
- GitHub Actions: `.github/workflows/*.yml`
- GitLab CI: `.gitlab-ci.yml`
- Jenkins: `Jenkinsfile` (Groovy DSL)
- Azure DevOps: `azure-pipelines.yml`
- CircleCI: `.circleci/config.yml`

```yaml
# Pipeline-as-code principle: self-contained, declarative
# This file IS the pipeline definition — no UI config needed
name: CI Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:ci
      - run: npm run build
```

---

## 10 Best Practices

1. **Commit to main at least daily.** Short-lived branches (< 2 days) minimize merge conflicts and keep CI feedback loops tight. Use feature flags for incomplete work.

2. **Build once, deploy everywhere.** Compile artifacts exactly once and promote the identical binary through staging, QA, and production. Inject environment-specific config at deploy time, never at build time.

3. **Keep pipelines under 10 minutes.** Fast feedback is the core value proposition of CI. Parallelize tests, cache dependencies aggressively, and split slow E2E tests into a separate non-blocking pipeline.

4. **Treat pipeline code as production code.** Apply code review, testing, versioning, and DRY principles to CI/CD configurations. Extract shared logic into reusable templates or composite actions.

5. **Fail fast and fail loudly.** Run the cheapest checks first (lint, type-check, unit tests). If they fail, skip expensive stages. Send failure notifications to the PR author within 2 minutes.

6. **Pin all dependency versions.** Use lockfiles, pinned action versions (SHA, not `@latest`), and fixed base image digests. Unpinned dependencies cause non-reproducible builds and supply chain vulnerabilities.

7. **Automate security scanning in every pipeline.** Integrate SAST, dependency scanning, and secret detection as non-negotiable pipeline stages. Cross-ref: [08-security/devsecops/ci-cd-security.md](../../08-security/devsecops/ci-cd-security.md).

8. **Use environment promotion with gates.** Deploy to staging automatically, require manual approval for production. Validate staging with smoke tests before enabling the production gate.

9. **Implement pipeline observability.** Track pipeline duration, success rate, flaky test rate, and mean time to recovery. Alert on pipeline degradation, not just failure.

10. **Version artifacts with commit SHAs.** Every artifact must trace back to a specific commit. Semantic versioning is for human-facing releases; SHA tagging is for pipeline traceability.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **"Works on my machine" builds** | Non-reproducible artifacts, environment drift | Containerize build agents; pin all versions |
| **Long-lived feature branches** | Massive merge conflicts, delayed CI feedback | Adopt trunk-based development with feature flags |
| **Rebuilding per environment** | Staging artifact differs from production | Build once, promote artifact, inject config at runtime |
| **UI-configured pipelines** | No audit trail, not reproducible, hard to review | Pipeline-as-code committed alongside application code |
| **Ignoring flaky tests** | Eroded trust in CI, developers ignore failures | Quarantine flaky tests, track and fix within SLA |
| **No artifact signing** | Supply chain attacks, unverified deployments | Sign images with cosign/Notation; verify at deploy time |
| **Monolithic "do everything" pipeline** | 45+ minute runs, blocked developers | Split into fast CI (< 10 min) and async extended checks |
| **Shared mutable state between jobs** | Race conditions, non-deterministic failures | Pass artifacts explicitly; avoid shared filesystems |

---

## Enforcement Checklist

- [ ] All pipelines defined as code in the repository (no UI-only configs)
- [ ] Pipeline runs on every push and every PR — no exceptions
- [ ] Build artifacts tagged with commit SHA and stored in a registry
- [ ] Dependency lockfiles committed and enforced (`npm ci`, not `npm install`)
- [ ] Base images pinned by digest, not by mutable tag
- [ ] Security scanning (SAST, SCA, secrets) runs in every pipeline
- [ ] Pipeline completes in under 10 minutes for the fast path
- [ ] Failed pipelines block PR merges (branch protection enforced)
- [ ] Pipeline metrics (duration, success rate) tracked in observability platform
- [ ] Artifact signing and provenance attestation enabled for production images
- [ ] Manual approval gates configured for production deployments
- [ ] Flaky tests quarantined and tracked with resolution SLA (< 48 hours)
