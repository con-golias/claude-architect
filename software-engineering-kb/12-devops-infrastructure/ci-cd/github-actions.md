# GitHub Actions

| Attribute     | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Domain       | DevOps > CI/CD                                                     |
| Importance   | Critical                                                           |
| Last Updated | 2026-03-10                                                         |
| Cross-ref    | [Pipeline Design](pipeline-design.md), [GitOps](../infrastructure-as-code/gitops.md) |

---

## Core Concepts

### Architecture: Runners, Workflows, Jobs, Steps

GitHub Actions uses a hierarchical execution model: workflows contain jobs, jobs contain steps, and runners execute jobs.

```text
Repository
└── .github/workflows/
    └── ci.yml (Workflow)
        ├── Job: lint          ← Runs on Runner A
        │   ├── Step: checkout
        │   ├── Step: setup-node
        │   └── Step: run lint
        ├── Job: test          ← Runs on Runner B (parallel)
        │   ├── Step: checkout
        │   ├── Step: setup-node
        │   └── Step: run tests
        └── Job: deploy        ← Runs on Runner C (after test)
            ├── Step: download artifact
            └── Step: deploy
```

**Runners:** VMs (or containers) that execute jobs. GitHub-hosted runners provide Ubuntu, Windows, and macOS. Self-hosted runners run on your own infrastructure.

**Workflows:** YAML files in `.github/workflows/`. Triggered by events. A repository can have unlimited workflows.

**Jobs:** Independent units of work within a workflow. Jobs run in parallel by default; use `needs` for dependencies.

**Steps:** Sequential commands within a job. Steps share the runner filesystem and environment.

### Workflow Syntax Deep-Dive

```yaml
name: CI                          # Workflow display name
run-name: CI for ${{ github.sha }} # Dynamic run name

on:                               # Trigger events
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

permissions:                       # Minimal GITHUB_TOKEN permissions
  contents: read
  packages: write
  id-token: write                  # Required for OIDC

env:                              # Workflow-level environment variables
  NODE_VERSION: '20'
  REGISTRY: ghcr.io

defaults:                         # Default settings for all run steps
  run:
    shell: bash
    working-directory: ./src

jobs:
  build:
    name: Build Application
    runs-on: ubuntu-latest         # Runner selection
    timeout-minutes: 15            # Job timeout (always set this)
    outputs:                       # Declare job outputs
      image-tag: ${{ steps.meta.outputs.tags }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4   # Pin actions by major version
        with:
          fetch-depth: 0           # Full history for versioning

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run build
        id: build                  # Step ID for referencing outputs
        run: |
          npm run build
          echo "artifact-path=dist" >> $GITHUB_OUTPUT
```

### Event Triggers

GitHub Actions supports 35+ trigger events. Use the right trigger for each workflow.

```yaml
on:
  # Code events
  push:
    branches: [main]
    paths: ['src/**', 'package.json']
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]

  # Scheduled (cron)
  schedule:
    - cron: '0 6 * * 1'          # Every Monday at 6 AM UTC

  # Manual trigger with inputs
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy target'
        required: true
        type: choice
        options: [staging, production]
      dry-run:
        description: 'Dry run mode'
        type: boolean
        default: true

  # API-triggered from external systems
  repository_dispatch:
    types: [deploy-request, dependency-update]

  # Release events
  release:
    types: [published]

  # Reusable workflow call
  workflow_call:
    inputs:
      image-name:
        type: string
        required: true
```

### Composite Actions vs Reusable Workflows

**Composite actions** bundle multiple steps into a single reusable action. They run within the calling job.

```yaml
# .github/actions/setup-and-test/action.yml
name: Setup and Test
description: Install deps and run tests
inputs:
  node-version:
    description: Node.js version
    default: '20'
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'
    - run: npm ci
      shell: bash
    - run: npm test
      shell: bash

# Usage in workflow:
# - uses: ./.github/actions/setup-and-test
#   with:
#     node-version: '22'
```

**Reusable workflows** define entire jobs that callers invoke. They run as separate jobs with their own runner.

```yaml
# .github/workflows/reusable-deploy.yml
on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
    secrets:
      deploy-key:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh ${{ inputs.environment }}
        env:
          DEPLOY_KEY: ${{ secrets.deploy-key }}
```

| Aspect | Composite Action | Reusable Workflow |
|--------|-----------------|-------------------|
| Scope | Steps within a job | Entire jobs |
| Runner | Shares caller runner | Own runner |
| Secrets | Inherited automatically | Must pass explicitly |
| Outputs | Step-level outputs | Job-level outputs |
| Best for | Shared step sequences | Shared job definitions |

### Marketplace Actions Security

Third-party actions execute code in your pipeline. Treat them as untrusted dependencies.

**Security rules:**
1. **Pin by full SHA, not tag.** Tags are mutable; an attacker can repoint `v2` to malicious code.
2. **Audit action source code** before first use.
3. **Minimize permissions** with the `permissions` key.
4. **Prefer official and verified actions** (blue checkmark in marketplace).

```yaml
# UNSAFE: mutable tag
- uses: some-org/action@v2

# SAFE: pinned SHA
- uses: some-org/action@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2  # v2.1.0

# SAFEST: fork into your org and pin
- uses: your-org/forked-action@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6
```

Cross-ref: [08-security/devsecops/ci-cd-security.md](../../08-security/devsecops/ci-cd-security.md)

### Self-Hosted Runners

Run jobs on your own infrastructure for cost control, specialized hardware, or network access.

```bash
# Install self-hosted runner (Linux)
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/YOUR-ORG --token YOUR-TOKEN
./run.sh  # Or install as service: sudo ./svc.sh install && sudo ./svc.sh start
```

**Scaling with Actions Runner Controller (ARC):**
```yaml
# Kubernetes-based auto-scaling runners
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: org-runner
spec:
  replicas: 2
  template:
    spec:
      organization: your-org
      labels:
        - self-hosted
        - linux
        - x64
---
apiVersion: actions.summerwind.dev/v1alpha1
kind: HorizontalRunnerAutoscaler
metadata:
  name: org-runner-autoscaler
spec:
  scaleTargetRef:
    name: org-runner
  minReplicas: 1
  maxReplicas: 10
  scaleUpTriggers:
    - githubEvent:
        workflowJob: {}
      duration: "30m"
```

**Self-hosted runner security:**
- Never use self-hosted runners on public repositories (any fork can trigger workflows).
- Run in ephemeral containers. Destroy after each job to prevent state leakage.
- Isolate runners in dedicated network segments.
- Use runner groups to restrict which repos can use which runners.

### Secrets and Environments

Store sensitive values as encrypted secrets. Use environments for deployment-specific configuration and protection rules.

```yaml
# Repository secrets: Settings → Secrets and variables → Actions
# Environment secrets: Settings → Environments → [env] → Secrets

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    steps:
      - run: ./deploy.sh
        env:
          API_KEY: ${{ secrets.PROD_API_KEY }}       # Environment secret
          SHARED_TOKEN: ${{ secrets.DEPLOY_TOKEN }}    # Repository secret
```

**Environment protection rules:**
- Required reviewers (1-6 people)
- Wait timer (0-43200 minutes)
- Deployment branch restrictions
- Custom deployment protection rules (GitHub Apps)

### OIDC for Cloud Authentication

Use OpenID Connect (OIDC) to authenticate with cloud providers without storing long-lived credentials.

```yaml
# AWS authentication via OIDC (no access keys stored)
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: us-east-1
          # No access keys — OIDC token exchange

      - run: aws s3 sync dist/ s3://my-bucket/
```

```yaml
# GCP authentication via OIDC
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: projects/123/locations/global/workloadIdentityPools/github/providers/github
    service_account: deploy@project.iam.gserviceaccount.com

# Azure authentication via OIDC
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

### Caching Strategies

```yaml
# Built-in setup action caching (simplest)
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'         # Caches ~/.npm automatically

# Explicit cache with fallback keys
- uses: actions/cache@v4
  id: npm-cache
  with:
    path: node_modules
    key: modules-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      modules-${{ runner.os }}-

- if: steps.npm-cache.outputs.cache-hit != 'true'
  run: npm ci
```

### Matrix Strategies

```yaml
# Multi-dimensional matrix with exclusions
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        node-version: [18, 20, 22]
        os: [ubuntu-latest, windows-latest, macos-latest]
        exclude:
          - os: windows-latest
            node-version: 18
        include:
          - os: ubuntu-latest
            node-version: 22
            experimental: true
    runs-on: ${{ matrix.os }}
    continue-on-error: ${{ matrix.experimental || false }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci && npm test
```

### Concurrency Control

Prevent overlapping deployments and cancel stale CI runs.

```yaml
# Cancel in-progress CI on new push to same branch
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

# Prevent parallel deploys to same environment (queue, don't cancel)
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

### GitHub Packages Integration

Publish and consume packages directly from GitHub.

```yaml
# Publish npm package to GitHub Packages
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://npm.pkg.github.com'
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# Publish Docker image to GitHub Container Registry (ghcr.io)
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
- uses: docker/build-push-action@v6
  with:
    push: true
    tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
```

### Practical Workflow Examples

**Node.js / TypeScript CI:**
```yaml
name: Node.js CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage
      - run: npm run build
      - uses: actions/upload-artifact@v4
        if: github.ref == 'refs/heads/main'
        with:
          name: dist
          path: dist/
          retention-days: 7
```

**Go CI:**
```yaml
name: Go CI
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: true
      - run: go vet ./...
      - run: staticcheck ./...
      - run: go test -race -coverprofile=coverage.out ./...
      - run: go build -o bin/server ./cmd/server
      - uses: actions/upload-artifact@v4
        with:
          name: server-binary
          path: bin/server
```

**Docker Build and Push:**
```yaml
name: Docker Build
on:
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=semver,pattern={{version}}
            type=ref,event=branch
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true
```

**Multi-Environment Deploy:**
```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  id-token: write
jobs:
  build:
    uses: ./.github/workflows/reusable-docker-build.yml  # Reuse from above
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - run: aws ecs update-service --cluster staging --service api --force-new-deployment
  smoke-test:
    needs: deploy-staging
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - run: |
          for i in $(seq 1 10); do
            curl -sf https://staging-api.example.com/health && exit 0
            sleep 5
          done
          exit 1
  deploy-production:
    needs: smoke-test
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://api.example.com
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - run: aws ecs update-service --cluster production --service api --force-new-deployment
```

---

## 10 Best Practices

1. **Set `permissions` to minimum required.** Default `GITHUB_TOKEN` has broad access. Explicitly declare `contents: read` and only add what the workflow needs. Cross-ref: [08-security/devsecops/ci-cd-security.md](../../08-security/devsecops/ci-cd-security.md).

2. **Pin actions by full commit SHA.** Tags are mutable. Use Dependabot or Renovate to receive automated PRs when pinned actions have updates.

3. **Set `timeout-minutes` on every job.** The default timeout is 360 minutes (6 hours). A stuck job wastes runner minutes. Set realistic timeouts (10-15 min for CI, 30 min for E2E).

4. **Use OIDC instead of long-lived cloud credentials.** Replace stored AWS access keys or GCP service account keys with OIDC token exchange. Tokens are short-lived and scoped to the workflow run.

5. **Enable concurrency control on every workflow.** Cancel in-progress CI runs on new pushes. Prevent parallel deployments to the same environment.

6. **Use environments with protection rules for deployments.** Configure required reviewers, wait timers, and branch restrictions on staging and production environments.

7. **Cache aggressively with content-addressed keys.** Use lockfile hashes for dependency caches. Use `type=gha` for Docker BuildKit caching. Measure cache hit rates.

8. **Keep workflows DRY with reusable workflows.** Extract shared CI/CD patterns into `workflow_call` workflows. Version them with tags for stability across consuming repositories.

9. **Never expose secrets in logs.** GitHub masks registered secrets, but dynamically constructed values can leak. Use `add-mask` for computed secrets. Never `echo` secret values.

10. **Use `actions/upload-artifact` for cross-job data.** Do not rely on the runner filesystem persisting between jobs. Explicitly upload and download artifacts with retention policies.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Pinning actions by tag (`@v2`)** | Supply chain attack vector; tag can be repointed | Pin by full SHA; use Dependabot for updates |
| **Default `permissions` (read-write all)** | Compromised action can push code, delete branches | Set `permissions` explicitly at workflow and job level |
| **No `timeout-minutes`** | Stuck jobs run for 6 hours, consuming runner budget | Set 10-15 min for CI, 30 min for E2E |
| **Storing cloud credentials as secrets** | Long-lived keys, manual rotation, higher blast radius | Use OIDC federation for AWS/GCP/Azure |
| **Self-hosted runners on public repos** | Any fork PR can execute arbitrary code on your infra | Use GitHub-hosted runners for public repos |
| **Duplicated workflow logic across repos** | Config drift, painful updates, inconsistent pipelines | Extract reusable workflows; distribute via shared repo |
| **No concurrency control** | Stale pipelines waste minutes; parallel deploys cause races | Configure `concurrency` groups on all workflows |
| **Secrets in workflow logs** | Credential exposure in CI logs | Use `::add-mask::` for computed secrets; audit logs regularly |

---

## Enforcement Checklist

- [ ] `permissions` key set explicitly on every workflow (minimum required scope)
- [ ] All third-party actions pinned by full SHA with Dependabot/Renovate tracking
- [ ] `timeout-minutes` set on every job (no default 360-minute timeouts)
- [ ] OIDC authentication configured for all cloud provider access
- [ ] Environment protection rules (reviewers, branch restrictions) on staging and production
- [ ] `concurrency` groups configured on all workflows
- [ ] Self-hosted runners only on private repositories, ephemeral, in isolated networks
- [ ] Secrets never echoed in logs; `::add-mask::` used for computed sensitive values
- [ ] Docker builds use BuildKit GHA cache (`type=gha`) with provenance and SBOM
- [ ] Reusable workflows versioned with tags (not `main` references)
- [ ] Workflow files reviewed in PRs with the same rigor as application code
- [ ] Branch protection requires CI status checks to pass before merge
