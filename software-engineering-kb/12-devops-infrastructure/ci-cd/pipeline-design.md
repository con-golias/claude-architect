# Pipeline Design

| Attribute     | Value                                                                           |
|--------------|---------------------------------------------------------------------------------|
| Domain       | DevOps > CI/CD                                                                  |
| Importance   | Critical                                                                        |
| Last Updated | 2026-03-10                                                                      |
| Cross-ref    | [Fundamentals](fundamentals.md), [Deployment Strategies](deployment-strategies.md) |

---

## Core Concepts

### Stage Design and Ordering

Order pipeline stages by cost and feedback speed. Run cheap, fast checks first to fail early and avoid wasting compute on doomed builds.

```text
Optimal stage ordering (left = first):

1. Lint + Format Check    (~10s)   ← Cheapest, catches style issues
2. Type Check             (~15s)   ← Catches compile errors
3. Unit Tests             (~30s)   ← Fast, high coverage
4. Build / Compile        (~60s)   ← Produces artifact
5. Integration Tests      (~2-5m)  ← Requires services
6. Security Scans (SAST)  (~1-3m)  ← Static analysis
7. E2E Tests              (~5-10m) ← Slowest, most brittle
8. Package + Push         (~30s)   ← Container image
9. Deploy to Staging      (~2m)    ← Environment validation
10. Smoke Tests           (~1m)    ← Post-deploy verification
```

```yaml
# GitHub Actions: ordered stages with dependencies
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run lint && npm run typecheck

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test -- --coverage

  build:
    needs: [lint, unit-test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/

  integration-test:
    needs: [build]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run test:integration

  deploy-staging:
    needs: [integration-test]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
      - run: ./scripts/deploy.sh staging
```

### Parallelism and Fan-Out/Fan-In

Run independent stages concurrently to minimize total pipeline duration. Fan-out splits work across parallel jobs; fan-in waits for all parallel jobs before proceeding.

```text
Fan-out / Fan-in pattern:

         ┌─ Unit Tests ──────┐
Build ───┼─ Integration Tests┼─── Package ─── Deploy
         ├─ SAST Scan ───────┤
         └─ E2E Tests ───────┘
         (parallel fan-out)    (fan-in: wait for all)
```

```yaml
# GitLab CI: parallel fan-out with fan-in
stages:
  - build
  - test        # All test jobs run in parallel
  - package
  - deploy

unit-tests:
  stage: test
  script: npm run test:unit

integration-tests:
  stage: test
  script: npm run test:integration
  services:
    - postgres:16

sast-scan:
  stage: test
  script: npm run security:sast

e2e-tests:
  stage: test
  script: npm run test:e2e

# package stage waits for ALL test jobs to pass
package:
  stage: package
  script: docker build -t $IMAGE .
```

### Pipeline Caching Strategies

Caching eliminates redundant work between pipeline runs. Target three layers: dependency cache, build cache, and Docker layer cache.

**Dependency cache:** Store `node_modules`, Go module cache, pip packages between runs. Key by lockfile hash.

```yaml
# GitHub Actions: dependency caching keyed by lockfile
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Built-in caching via package-lock.json hash

# Explicit cache for custom paths
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: deps-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      deps-${{ runner.os }}-
```

**Build cache:** Store compiled outputs (TypeScript `.tsbuildinfo`, Go build cache, Webpack cache).

```yaml
# Go build cache
- uses: actions/cache@v4
  with:
    path: |
      ~/go/pkg/mod
      ~/.cache/go-build
    key: go-${{ runner.os }}-${{ hashFiles('go.sum') }}
```

**Docker layer cache:** Reuse unchanged layers across builds. Use BuildKit cache mounts or registry-backed caching.

```yaml
# Docker BuildKit with registry cache
- name: Build with layer caching
  uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ${{ env.IMAGE }}:${{ github.sha }}
    cache-from: type=registry,ref=${{ env.IMAGE }}:buildcache
    cache-to: type=registry,ref=${{ env.IMAGE }}:buildcache,mode=max
```

```bash
# Dockerfile with BuildKit mount cache for package managers
# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build
```

### Artifact Passing Between Stages

Pass build outputs between pipeline stages explicitly. Never rely on shared filesystems or workspace persistence across jobs.

```yaml
# GitHub Actions: upload in build, download in deploy
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: app-dist
          path: dist/
          retention-days: 5

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app-dist
          path: dist/
      - run: ./deploy.sh dist/
```

```yaml
# GitLab CI: artifacts with expiry
build:
  stage: build
  script:
    - npm ci && npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

deploy:
  stage: deploy
  script:
    - ./deploy.sh dist/
  dependencies:
    - build
```

### Conditional Execution and Path Filtering

Skip unnecessary work by filtering pipeline execution based on changed files, branch names, or commit messages.

```yaml
# GitHub Actions: path filtering
on:
  push:
    paths:
      - 'src/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/ci.yml'
    paths-ignore:
      - 'docs/**'
      - '*.md'
      - 'LICENSE'

# Conditional step execution
jobs:
  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - run: ./deploy.sh
```

```yaml
# GitLab CI: rules-based conditional execution
deploy-production:
  stage: deploy
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
      when: on_success
    - when: never
  script:
    - ./deploy.sh production
```

### Matrix Builds

Test across multiple runtime versions, operating systems, or configurations in parallel using matrix strategies.

```yaml
# GitHub Actions: matrix strategy
jobs:
  test:
    strategy:
      fail-fast: false          # Don't cancel other matrix jobs on failure
      matrix:
        node-version: [18, 20, 22]
        os: [ubuntu-latest, windows-latest]
        exclude:
          - os: windows-latest
            node-version: 18    # Skip unsupported combo
        include:
          - os: ubuntu-latest
            node-version: 20
            coverage: true      # Extra variable for specific combo

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci && npm test
      - if: matrix.coverage
        run: npm run test:coverage
```

```yaml
# GitLab CI: parallel matrix
test:
  stage: test
  parallel:
    matrix:
      - PYTHON_VERSION: ["3.11", "3.12", "3.13"]
        DB: ["postgres", "mysql"]
  image: python:${PYTHON_VERSION}
  script:
    - pip install -r requirements.txt
    - pytest --db=$DB
```

### Pipeline Templates and Reusable Workflows

Extract common pipeline logic into shared templates. Reduce duplication across repositories and teams.

```yaml
# GitHub Actions: reusable workflow (called workflow)
# .github/workflows/reusable-docker-build.yml
name: Reusable Docker Build
on:
  workflow_call:
    inputs:
      image-name:
        required: true
        type: string
      dockerfile:
        required: false
        type: string
        default: Dockerfile
    secrets:
      registry-token:
        required: true

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.registry-token }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: ${{ inputs.dockerfile }}
          push: true
          tags: ghcr.io/${{ github.repository }}/${{ inputs.image-name }}:${{ github.sha }}
```

```yaml
# Caller workflow
name: CI
on: push
jobs:
  docker:
    uses: ./.github/workflows/reusable-docker-build.yml
    with:
      image-name: api-server
    secrets:
      registry-token: ${{ secrets.GITHUB_TOKEN }}
```

```yaml
# GitLab CI: include templates
# templates/node-ci.yml (shared template)
.node-ci:
  image: node:20-alpine
  before_script:
    - npm ci
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/

# .gitlab-ci.yml (consumer)
include:
  - project: 'platform/ci-templates'
    ref: v2.1.0
    file: '/templates/node-ci.yml'

test:
  extends: .node-ci
  script:
    - npm run test
```

### Environment Promotion

Promote the same artifact through environments: dev, staging, production. Never rebuild between environments.

```text
Promotion flow:

Build ─→ Dev (auto) ─→ Staging (auto) ─→ Prod (manual approval)
  │         │              │                 │
  │         │              │                 └─ Canary → Full rollout
  │         │              └─ Smoke + integration tests
  │         └─ Unit tests pass
  └─ Artifact: image:abc123
```

```yaml
# GitHub Actions: environment promotion with protection rules
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: |
          kubectl set image deployment/app \
            app=${{ env.IMAGE }}:${{ github.sha }} \
            --namespace=staging

  smoke-test:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sf https://staging.example.com/health || exit 1

  deploy-production:
    needs: smoke-test
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    steps:
      - run: |
          kubectl set image deployment/app \
            app=${{ env.IMAGE }}:${{ github.sha }} \
            --namespace=production
```

### Approval Gates and Manual Interventions

Use approval gates to enforce human review before production deployments. Configure required reviewers and timeout policies.

```yaml
# GitHub Actions: environment protection rules
# Configure in Settings → Environments → production:
#   - Required reviewers: 2 team leads
#   - Wait timer: 5 minutes
#   - Deployment branches: main only

# The job pauses until reviewers approve
deploy-production:
  environment:
    name: production
  runs-on: ubuntu-latest
  steps:
    - run: ./deploy.sh production
```

```yaml
# GitLab CI: manual gate with blocking
deploy-production:
  stage: deploy
  when: manual
  allow_failure: false    # Blocks downstream jobs until approved
  environment:
    name: production
  script:
    - ./deploy.sh production
```

### Pipeline Performance Optimization

Optimize pipeline speed to maintain fast developer feedback loops.

**Techniques:**
1. **Parallelize aggressively.** Run independent jobs concurrently.
2. **Cache everything.** Dependencies, build outputs, Docker layers.
3. **Use affected-only testing.** In monorepos, only test changed packages.
4. **Right-size runners.** Use larger runners for build-heavy jobs, smaller for lint.
5. **Split test suites.** Distribute tests across parallel runners using sharding.

```yaml
# Test sharding across parallel runners
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx vitest --shard=${{ matrix.shard }}/4
```

```yaml
# GitLab CI: parallel test splitting
test:
  stage: test
  parallel: 4
  script:
    - npx jest --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
```

### Fail-Fast Strategies

Stop wasted compute the moment a critical check fails.

```yaml
# GitHub Actions: cancel in-progress on new push
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

# Matrix: cancel all on first failure (default)
strategy:
  fail-fast: true
  matrix:
    node: [18, 20, 22]
```

```yaml
# GitLab CI: interruptible jobs
build:
  stage: build
  interruptible: true      # Can be cancelled by newer pipeline
  script:
    - npm run build
```

**Progressive failure escalation:**
```yaml
# Run cheapest checks first; skip expensive stages on failure
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint    # 10 seconds

  unit-test:
    needs: lint              # Only runs if lint passes
    steps:
      - run: npm test        # 30 seconds

  e2e-test:
    needs: unit-test         # Only runs if unit tests pass
    steps:
      - run: npm run e2e     # 5 minutes
```

---

## 10 Best Practices

1. **Run the cheapest checks first.** Lint and type-checking cost seconds. Run them before tests and builds. A failing lint check should never wait behind a 5-minute E2E suite.

2. **Cache every cacheable artifact.** Dependencies, build outputs, Docker layers, and test fixtures. Key caches by lockfile or content hash. Measure cache hit rates and optimize misses.

3. **Build once, promote everywhere.** The artifact deployed to production must be byte-identical to what was tested in staging. Inject configuration at deploy time via environment variables or config maps.

4. **Parallelize independent stages.** Unit tests, integration tests, and SAST scans have no dependencies on each other. Run them concurrently. Fan-in before the deploy stage.

5. **Use matrix builds for compatibility.** Test across Node 18/20/22, Python 3.11/3.12/3.13, and multiple OS targets. Set `fail-fast: false` to collect all failure information, not just the first.

6. **Extract reusable pipeline templates.** Shared CI logic across repositories reduces drift and simplifies updates. Version templates with tags (not `main`) for stability.

7. **Implement concurrency controls.** Cancel in-progress pipelines when a new commit arrives on the same branch. Prevent parallel deployments to the same environment.

8. **Gate production with approval and smoke tests.** Automated staging deploys validate the artifact. Manual approval (with required reviewers) gates production. Post-deploy smoke tests verify success.

9. **Shard slow test suites.** Split E2E and integration tests across 4-8 parallel runners using test sharding. Reduce a 20-minute suite to 5 minutes. Cross-ref: [11-testing/test-automation/ci-integration.md](../../11-testing/test-automation/ci-integration.md).

10. **Monitor pipeline metrics.** Track p50/p95 duration, success rate, cache hit rate, and queue wait time. Set alerts when pipelines exceed duration budgets.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Sequential stages for independent work** | Pipeline takes sum of all durations instead of max | Fan-out independent stages in parallel |
| **No caching** | Dependencies re-downloaded every run, 3-5 min wasted | Cache by lockfile hash; verify hit rates weekly |
| **Rebuilding per environment** | Staging and prod artifacts differ, "works in staging" bugs | Build once, promote identical artifact with runtime config |
| **Hardcoded values in pipeline files** | Config drift across repos, painful updates | Extract to reusable templates with parameterized inputs |
| **No concurrency control** | Stale pipelines waste runners, race conditions on deploy | Use concurrency groups, cancel in-progress on new push |
| **Monolithic "run everything" pipeline** | 30+ minutes, developers skip CI or batch changes | Split fast CI (< 10 min) and async extended validation |
| **Passing state via filesystem hacks** | Fragile, non-portable, race conditions | Use explicit artifact upload/download between stages |
| **Missing path filtering in monorepos** | Every change triggers every pipeline, wasting 80% of compute | Configure path-based triggers; use affected-package detection |

---

## Enforcement Checklist

- [ ] Pipeline stages ordered by cost: lint, type-check, unit test, build, integration, E2E
- [ ] Independent stages run in parallel (fan-out/fan-in pattern)
- [ ] Dependency caching configured and keyed by lockfile hash
- [ ] Docker layer caching enabled (BuildKit registry cache or GitHub Actions cache)
- [ ] Artifacts passed explicitly between stages (upload/download, not filesystem)
- [ ] Path filtering enabled for monorepo pipelines
- [ ] Matrix builds cover all supported runtime versions and platforms
- [ ] Reusable workflow templates versioned with tags (not `main` branch)
- [ ] Concurrency groups prevent parallel runs on same branch/environment
- [ ] Environment promotion follows dev, staging, production with gates
- [ ] Pipeline duration tracked and alerted when exceeding 10-minute budget
- [ ] Test sharding enabled for suites exceeding 5 minutes
