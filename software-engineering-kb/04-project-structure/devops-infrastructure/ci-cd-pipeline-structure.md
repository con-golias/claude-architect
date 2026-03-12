# CI/CD Pipeline Structure

> **AI Plugin Directive:** When setting up CI/CD pipelines for any project, ALWAYS use this guide. Apply proper workflow organization, secret management, caching, and deployment strategies. This guide covers GitHub Actions (primary), GitLab CI, and general CI/CD principles.

**Core Rule: CI pipelines MUST be fast, reliable, and reproducible. Cache dependencies aggressively, run jobs in parallel where possible, and fail fast on lint/type errors before expensive operations. NEVER store secrets in pipeline files — use the platform's secret management.**

---

## 1. Pipeline Structure (GitHub Actions)

```
.github/
├── workflows/
│   ├── ci.yml                             # Lint + test + build (on every PR)
│   ├── deploy-staging.yml                 # Deploy to staging (on merge to main)
│   ├── deploy-production.yml              # Deploy to production (manual/tag)
│   ├── release.yml                        # Create releases + publish packages
│   ├── codeql.yml                         # Security scanning
│   ├── dependency-review.yml              # Review new dependencies
│   └── stale.yml                          # Close stale issues/PRs
│
├── actions/                               # Reusable composite actions
│   ├── setup-node/
│   │   └── action.yml                     # Setup Node + pnpm + cache
│   ├── setup-python/
│   │   └── action.yml
│   └── docker-build/
│       └── action.yml
│
├── CODEOWNERS
└── dependabot.yml
```

```
Workflow separation rules:
  ci.yml            → Runs on EVERY PR and push to main
  deploy-*.yml      → Deployment workflows (separate per environment)
  release.yml       → Package publishing and GitHub releases
  scheduled-*.yml   → Cron jobs (nightly tests, dependency updates)

NEVER put deployment logic in ci.yml.
NEVER combine all environments in one workflow.
ALWAYS use concurrency groups to cancel superseded runs.
```

---

## 2. CI Workflow (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ─── Fast checks first ─────────────────────────────────
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-node

      - name: Lint
        run: pnpm lint

      - name: Type Check
        run: pnpm typecheck

  # ─── Tests in parallel ─────────────────────────────────
  test:
    name: Test (${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: [20, 22]
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-node
        with:
          node-version: ${{ matrix.node }}

      - name: Run Tests
        run: pnpm test -- --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Upload Coverage
        if: matrix.node == 22
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  # ─── Build verification ────────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint]                           # Wait for lint, run parallel with test
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node
      - run: pnpm build

      - name: Upload Build Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
          retention-days: 1

  # ─── Gate check ─────────────────────────────────────────
  ci-ok:
    name: CI Passed
    runs-on: ubuntu-latest
    needs: [lint, test, build]
    if: always()
    steps:
      - name: Check Results
        run: |
          if [[ "${{ needs.lint.result }}" != "success" ]] || \
             [[ "${{ needs.test.result }}" != "success" ]] || \
             [[ "${{ needs.build.result }}" != "success" ]]; then
            echo "CI failed"
            exit 1
          fi
```

---

## 3. Reusable Composite Action

```yaml
# .github/actions/setup-node/action.yml
name: Setup Node.js
description: Install Node.js, pnpm, and restore cache

inputs:
  node-version:
    description: Node.js version
    default: "22"

runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: pnpm

    - name: Install Dependencies
      shell: bash
      run: pnpm install --frozen-lockfile
```

```
Composite action rules:
  - Extract repeated setup steps into .github/actions/
  - Each action has its own action.yml
  - Use inputs for parameterization
  - ALWAYS use --frozen-lockfile in CI
  - Cache restoration is automatic with cache: pnpm
```

---

## 4. Deployment Workflow

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  workflow_dispatch:                        # Manual trigger
    inputs:
      version:
        description: "Version to deploy"
        required: true
  push:
    tags: ["v*"]                           # Or on version tag

concurrency:
  group: deploy-production
  cancel-in-progress: false                 # NEVER cancel production deploys

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment:
      name: production                      # Requires approval
      url: https://app.example.com
    permissions:
      id-token: write                       # OIDC for cloud auth
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/deploy-role
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:${{ github.sha }}
            123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster production \
            --service my-app \
            --force-new-deployment

      - name: Wait for Deployment
        run: |
          aws ecs wait services-stable \
            --cluster production \
            --services my-app

      - name: Smoke Test
        run: |
          curl --fail --retry 5 --retry-delay 10 \
            https://app.example.com/health
```

---

## 5. GitLab CI Structure

```yaml
# .gitlab-ci.yml
stages:
  - validate
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "22"
  DOCKER_DRIVER: overlay2

# ─── Cache Configuration ─────────────────────────────────
.node-cache: &node-cache
  cache:
    key:
      files: [pnpm-lock.yaml]
    paths: [node_modules/]
    policy: pull

# ─── Templates ────────────────────────────────────────────
.node-setup:
  image: node:${NODE_VERSION}-alpine
  before_script:
    - corepack enable pnpm
    - pnpm install --frozen-lockfile
  <<: *node-cache

# ─── Validate Stage ──────────────────────────────────────
lint:
  extends: .node-setup
  stage: validate
  script:
    - pnpm lint
    - pnpm typecheck
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# ─── Test Stage ───────────────────────────────────────────
test:
  extends: .node-setup
  stage: test
  services:
    - postgres:16-alpine
  variables:
    POSTGRES_DB: test
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/test
  script:
    - pnpm test -- --coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

# ─── Build Stage ──────────────────────────────────────────
build:
  extends: .node-setup
  stage: build
  script:
    - pnpm build
  artifacts:
    paths: [dist/]
    expire_in: 1 day
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# ─── Deploy Stage ─────────────────────────────────────────
deploy-production:
  stage: deploy
  image: alpine:latest
  needs: [test, build]
  script:
    - apk add --no-cache aws-cli
    - aws ecs update-service --cluster prod --service my-app --force-new-deployment
  environment:
    name: production
    url: https://app.example.com
  when: manual                              # Require manual trigger
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## 6. Caching Strategies

```
Caching layers:

1. Dependency cache (most impactful)
   GitHub Actions: actions/setup-node with cache: pnpm
   GitLab CI: cache key based on lockfile hash

2. Build cache
   GitHub Actions: actions/cache for .next/, dist/
   Docker: cache-from/cache-to with GitHub Actions cache

3. Docker layer cache
   docker/build-push-action with type=gha cache
   GitLab CI: docker build --cache-from registry

4. Test cache
   Cache test databases, fixtures
   Only for slow integration tests

Cache invalidation:
  ✅ Key on lockfile hash — cache busts on dependency change
  ✅ Separate caches per OS/Node version
  ❌ NEVER cache build output across PRs (stale artifacts)
  ❌ NEVER cache node_modules directly (use pnpm cache)
```

---

## 7. Secret Management

```
CI/CD secret rules:

1. Platform-native secrets
   GitHub: Settings → Secrets and variables → Actions
   GitLab: Settings → CI/CD → Variables (masked + protected)

2. OIDC for cloud providers (PREFERRED over static keys)
   - No long-lived credentials
   - Assume IAM role via OIDC token
   - Supported: AWS, GCP, Azure

3. Environment-scoped secrets
   GitHub: Environments → production → Secrets
   Secrets only available to workflows targeting that environment

4. Secret scanning
   - Enable GitHub Advanced Security
   - Pre-commit hooks: gitleaks, detect-secrets

NEVER:
  ❌ Hardcode secrets in workflow files
  ❌ Echo secrets in logs (GitHub auto-masks, but be careful)
  ❌ Pass secrets as command-line arguments (visible in process list)
  ❌ Store secrets in artifacts

ALWAYS:
  ✅ Use OIDC for cloud authentication
  ✅ Scope secrets to environments
  ✅ Rotate secrets regularly
  ✅ Use GitHub's automatic masking
```

---

## 8. Pipeline Optimization

```
Speed optimization checklist:

1. Fail fast
   - Run lint/typecheck FIRST (fastest checks)
   - Cancel previous runs on same PR

2. Parallelize
   - Lint, test, build run in parallel where possible
   - Matrix strategy for multiple versions/platforms

3. Cache aggressively
   - Dependency caches (lockfile-keyed)
   - Docker layer caches
   - Build caches (.next, dist)

4. Minimize image pulls
   - Use lightweight runners (ubuntu-latest, not custom)
   - Pin action versions to specific SHAs

5. Skip unnecessary work
   - Path filters: only trigger on relevant file changes
   - Skip CI: allow [skip ci] in commit messages
   - Affected-only in monorepos

Typical pipeline targets:
  Lint + typecheck:  1-2 minutes
  Unit tests:        2-5 minutes
  Build:             2-5 minutes
  Total CI:          < 10 minutes

If CI > 15 minutes, optimize immediately.
```

---

## 9. Deployment Strategies

```
Strategy comparison:

Rolling Update (default K8s)
  ✅ Zero downtime, simple
  ❌ Rollback is a new deployment
  Use when: standard deployments

Blue-Green
  ✅ Instant rollback (switch traffic)
  ❌ 2x infrastructure cost during deploy
  Use when: critical applications

Canary
  ✅ Gradual rollout, catch issues early
  ❌ Complex setup, monitoring required
  Use when: high-traffic, risk-averse

Feature Flags
  ✅ Decouple deploy from release
  ❌ Flag cleanup overhead
  Use when: continuous deployment

ALWAYS implement:
  - Health checks before traffic switch
  - Automated rollback on failure
  - Smoke tests post-deployment
  - Deploy notifications (Slack/Teams)
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No concurrency control | Multiple CI runs for same PR | `concurrency` group + `cancel-in-progress` |
| Sequential when parallel possible | 20+ min CI | Parallelize independent jobs |
| No caching | 5+ min dependency installs | Cache with lockfile key |
| Secrets in workflow files | Credentials in Git history | Platform secret store + OIDC |
| No path filtering | CI runs on README changes | `paths` filter on triggers |
| `latest` for actions | Breaking changes in CI | Pin to `@v4` or SHA |
| No deployment environments | No approval gates | GitHub Environments with protection |
| Deployment in CI workflow | Accidental deploys on PR | Separate deploy workflows |
| No fail-fast | Wasting compute on doomed PRs | Lint first, gate subsequent jobs |
| No artifact upload | Can't debug failed builds | Upload build artifacts |

---

## 11. Enforcement Checklist

- [ ] Separate workflows — CI, deploy, release
- [ ] Concurrency groups — cancel superseded runs
- [ ] Fail fast — lint/typecheck before tests
- [ ] Parallel jobs — lint, test, build run concurrently
- [ ] Dependency caching — lockfile-keyed cache
- [ ] Docker caching — GHA cache or registry cache
- [ ] OIDC authentication — no static cloud credentials
- [ ] Environment protection — approval gates for production
- [ ] `--frozen-lockfile` — reproducible installs
- [ ] Path filtering — skip CI on irrelevant changes
- [ ] Composite actions — reusable setup steps
- [ ] Smoke tests — post-deployment verification
- [ ] CI completes under 10 minutes
- [ ] Deployment notifications — Slack/Teams integration
