# GitLab CI/CD

| Attribute     | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Domain       | DevOps > CI/CD                                                     |
| Importance   | High                                                               |
| Last Updated | 2026-03-10                                                         |
| Cross-ref    | [Pipeline Design](pipeline-design.md), [Fundamentals](fundamentals.md) |

---

## Core Concepts

### Architecture: Runners, Executors, `.gitlab-ci.yml`

GitLab CI/CD uses a coordinator-runner model. The GitLab server (coordinator) manages pipeline orchestration. GitLab Runners poll for jobs and execute them using configured executors.

```text
GitLab Server (Coordinator)
  │
  ├── Pipeline: .gitlab-ci.yml
  │   ├── Stage: build
  │   │   └── Job: compile        → Runner A (Docker executor)
  │   ├── Stage: test
  │   │   ├── Job: unit-tests     → Runner B (Docker executor)
  │   │   └── Job: integration    → Runner C (Kubernetes executor)
  │   └── Stage: deploy
  │       └── Job: deploy-prod    → Runner D (Shell executor)
  │
  └── Runners (registered, tagged, shared or project-specific)
```

**Executors** define how a runner executes jobs:
- **Docker**: Each job runs in a fresh container. Most common.
- **Kubernetes**: Jobs run as Kubernetes pods. Auto-scales with cluster.
- **Shell**: Jobs run directly on the runner host. Use only for trusted workloads.
- **Docker Machine** (legacy): Auto-provisions VMs. Being replaced by Kubernetes executor.
- **Instance/Docker Autoscaler**: Modern autoscaling executors for cloud VMs.

### Stages and Jobs

Stages define execution order. Jobs within the same stage run in parallel by default.

```yaml
# .gitlab-ci.yml — basic structure
stages:
  - build
  - test
  - deploy

variables:
  NODE_VERSION: "20"

# Job definition
compile:
  stage: build
  image: node:${NODE_VERSION}-alpine
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

unit-tests:
  stage: test
  image: node:${NODE_VERSION}-alpine
  script:
    - npm ci
    - npm test -- --coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'    # Extract coverage %
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

integration-tests:
  stage: test
  image: node:${NODE_VERSION}-alpine
  services:
    - name: postgres:16
      alias: db
  variables:
    POSTGRES_PASSWORD: test
    DATABASE_URL: "postgresql://postgres:test@db:5432/test"
  script:
    - npm ci
    - npm run test:integration

deploy-production:
  stage: deploy
  script:
    - ./deploy.sh production
  environment:
    name: production
    url: https://example.com
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

### Rules vs Only/Except (Modern Syntax)

Always use `rules` (introduced in GitLab 12.3). The legacy `only`/`except` keywords are deprecated and less expressive.

```yaml
# MODERN: rules (use this)
deploy-staging:
  stage: deploy
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: on_success
    - if: $CI_COMMIT_BRANCH == "develop"
      when: manual
      allow_failure: true           # Manual job doesn't block pipeline
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: never                   # Don't deploy on MRs
    - when: never                   # Default: don't run

  # Path-based rules
  rules:
    - changes:
        - src/**/*
        - package.json
      when: on_success
    - when: never

# DEPRECATED: only/except (avoid)
# deploy:
#   only:
#     - main
#   except:
#     - schedules
```

**Rules evaluation:** Rules are evaluated top-to-bottom. The first matching rule determines behavior. Always end with `- when: never` to prevent unintended execution.

```yaml
# Complex rules example
build-docker:
  stage: build
  rules:
    # Run on main branch pushes
    - if: $CI_COMMIT_BRANCH == "main"
      variables:
        PUSH_IMAGE: "true"
    # Run on tags matching semver
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
      variables:
        PUSH_IMAGE: "true"
    # Run on MRs but don't push
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      variables:
        PUSH_IMAGE: "false"
    - when: never
  script:
    - docker build -t $IMAGE .
    - |
      if [ "$PUSH_IMAGE" = "true" ]; then
        docker push $IMAGE
      fi
```

### Needs Keyword for DAG Pipelines

The `needs` keyword creates a Directed Acyclic Graph (DAG), allowing jobs to start as soon as their dependencies finish -- bypassing stage ordering.

```yaml
stages:
  - build
  - test
  - deploy

compile:
  stage: build
  script: npm run build
  artifacts:
    paths: [dist/]

lint:
  stage: test
  needs: []                       # No dependencies — starts immediately
  script: npm run lint

unit-tests:
  stage: test
  needs: []                       # Starts immediately, parallel with build
  script: npm test

integration-tests:
  stage: test
  needs: [compile]                # Waits only for compile, not lint
  script: npm run test:integration

deploy:
  stage: deploy
  needs: [compile, unit-tests, integration-tests]
  script: ./deploy.sh
```

```text
Without `needs` (stage-based):         With `needs` (DAG):
build:  [compile]                       compile ──→ integration ──→ deploy
            ↓                               ↘                    ↗
test:   [lint] [unit] [integration]      unit-tests ──────────╱
            ↓                           lint (independent, no wait)
deploy: [deploy]
Total: sum of stages                    Total: longest path only
```

### Includes and Extends for DRY Configs

**`include`** imports external YAML files. **`extends`** inherits job configuration from templates.

```yaml
# includes: import from multiple sources
include:
  # Local file in same repo
  - local: '.gitlab/ci/test.yml'

  # File from another project (versioned)
  - project: 'platform/ci-templates'
    ref: v3.2.0
    file: '/templates/docker-build.yml'

  # Remote URL
  - remote: 'https://example.com/ci/shared.yml'

  # Template from GitLab
  - template: Security/SAST.gitlab-ci.yml
```

```yaml
# extends: DRY job templates
.node-base:                          # Hidden job (starts with dot)
  image: node:20-alpine
  before_script:
    - npm ci
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/

.deploy-base:
  image: bitnami/kubectl:latest
  before_script:
    - kubectl config use-context $KUBE_CONTEXT

# Concrete jobs extending templates
unit-tests:
  extends: .node-base
  stage: test
  script:
    - npm test

lint:
  extends: .node-base
  stage: test
  script:
    - npm run lint

deploy-staging:
  extends: .deploy-base
  stage: deploy
  variables:
    KUBE_CONTEXT: staging
  script:
    - kubectl apply -f k8s/
  environment:
    name: staging
```

### Parent-Child Pipelines

Trigger child pipelines dynamically. Use for monorepo builds or complex orchestration.

```yaml
# Parent pipeline: .gitlab-ci.yml
stages:
  - trigger

trigger-api:
  stage: trigger
  trigger:
    include: services/api/.gitlab-ci.yml
    strategy: depend                 # Parent waits for child
  rules:
    - changes:
        - services/api/**/*

trigger-web:
  stage: trigger
  trigger:
    include: services/web/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes:
        - services/web/**/*
```

```yaml
# Dynamic child pipeline generation
generate-pipeline:
  stage: build
  script:
    - python scripts/generate-ci.py > child-pipeline.yml
  artifacts:
    paths:
      - child-pipeline.yml

run-dynamic:
  stage: test
  trigger:
    include:
      - artifact: child-pipeline.yml
        job: generate-pipeline
    strategy: depend
```

### Multi-Project Pipelines

Trigger pipelines in other repositories. Use for cross-service dependencies and downstream deployments.

```yaml
# Trigger downstream project pipeline
trigger-deploy:
  stage: deploy
  trigger:
    project: infrastructure/kubernetes-deploy
    branch: main
    strategy: depend
  variables:
    SERVICE_NAME: api
    IMAGE_TAG: $CI_COMMIT_SHA
```

### GitLab Runner Setup

```bash
# Install and register runner with Docker executor
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt-get install gitlab-runner
sudo gitlab-runner register \
  --non-interactive --url "https://gitlab.example.com/" --token "$RUNNER_TOKEN" \
  --executor "docker" --docker-image "alpine:latest" \
  --tag-list "docker,linux" --docker-privileged=false
```

```toml
# Kubernetes executor config (config.toml)
[[runners]]
  executor = "kubernetes"
  [runners.kubernetes]
    namespace = "gitlab-runners"
    image = "alpine:latest"
    cpu_request = "500m"
    memory_request = "512Mi"
    cpu_limit = "2"
    memory_limit = "4Gi"
```

### Caching and Artifacts

**Cache** persists between pipeline runs (speed optimization). **Artifacts** pass data between jobs within a pipeline (correctness requirement).

```yaml
# Cache: persist node_modules across pipelines
build:
  cache:
    key:
      files:
        - package-lock.json       # Cache key from lockfile hash
    paths:
      - node_modules/
    policy: pull-push              # pull: download only, push: upload only
  script:
    - npm ci
    - npm run build

# Artifacts: pass build output to deploy job
  artifacts:
    paths:
      - dist/
    expire_in: 1 day
    reports:
      junit: test-results.xml     # Shown in MR UI

# Distributed cache with S3 (config.toml)
# [runners.cache]
#   Type = "s3"
#   Shared = true
#   [runners.cache.s3]
#     BucketName = "gitlab-runner-cache"
#     BucketLocation = "us-east-1"
```

### Environments and Deployments

GitLab tracks deployment history per environment. Environment dashboards show current state across all environments.

```yaml
deploy-staging:
  stage: deploy
  script:
    - kubectl apply -f k8s/ --namespace=staging
  environment:
    name: staging
    url: https://staging.example.com
    on_stop: stop-staging              # Cleanup job
    auto_stop_in: 1 week               # Auto-stop idle environments
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

stop-staging:
  stage: deploy
  script:
    - kubectl delete namespace staging-$CI_COMMIT_REF_SLUG
  environment:
    name: staging
    action: stop
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

### Review Apps

Automatically deploy a temporary environment for every merge request. Destroy when the MR is merged or closed.

```yaml
deploy-review:
  stage: deploy
  script:
    - helm upgrade --install review-$CI_COMMIT_REF_SLUG ./chart
      --namespace review-$CI_COMMIT_REF_SLUG --create-namespace
      --set image.tag=$CI_COMMIT_SHA
      --set ingress.host=review-${CI_COMMIT_REF_SLUG}.example.com
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://review-${CI_COMMIT_REF_SLUG}.example.com
    on_stop: stop-review
    auto_stop_in: 3 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

stop-review:
  script:
    - helm uninstall review-$CI_COMMIT_REF_SLUG -n review-$CI_COMMIT_REF_SLUG
  environment: { name: "review/$CI_COMMIT_REF_SLUG", action: stop }
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: manual
```

### Auto DevOps

GitLab Auto DevOps provides automatic CI/CD pipeline configuration using conventions. Enable it as a starting point and customize as needed.

```yaml
# Enable Auto DevOps (Settings → CI/CD → Auto DevOps)
# Or in .gitlab-ci.yml:
include:
  - template: Auto-DevOps.gitlab-ci.yml

# Override specific jobs
test:
  variables:
    TEST_COMMAND: "npm run test:ci"

# Auto DevOps detects:
# - Language/framework via buildpacks
# - Dockerfile if present
# - Kubernetes deployment target
# - Security scans (SAST, DAST, dependency scanning, container scanning)
```

### GitLab Container Registry

Push and pull container images from GitLab built-in registry.

```yaml
variables:
  IMAGE: $CI_REGISTRY_IMAGE/$CI_COMMIT_REF_SLUG
  TAG: $CI_COMMIT_SHA

build-image:
  stage: build
  image: docker:27
  services:
    - docker:27-dind
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $IMAGE:$TAG -t $IMAGE:latest .
    - docker push $IMAGE:$TAG
    - docker push $IMAGE:latest
```

```yaml
# Using Kaniko (no Docker-in-Docker, no privileged mode)
build-image:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:v1.23.0-debug
    entrypoint: [""]
  script:
    - /kaniko/executor
      --context $CI_PROJECT_DIR
      --dockerfile $CI_PROJECT_DIR/Dockerfile
      --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
      --destination $CI_REGISTRY_IMAGE:latest
      --cache=true
      --cache-repo=$CI_REGISTRY_IMAGE/cache
```

### Merge Trains

Merge trains test MRs in sequence, ensuring that the combination of all queued merges is valid. Each MR is tested on top of all MRs ahead of it in the train.

```text
Merge Train:
  main:  ─── A ─── B ─── C ─── (current)
  Train:
    MR #1: tests on (C + MR#1)
    MR #2: tests on (C + MR#1 + MR#2)
    MR #3: tests on (C + MR#1 + MR#2 + MR#3)
```

Enable in project Settings -> Merge requests -> Merge trains. Requires pipeline defined with `rules` that include `$CI_MERGE_REQUEST_EVENT_TYPE == "merge_train"`.

```yaml
test:
  stage: test
  script: npm test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
```

### Practical Examples

**Node.js Full CI Pipeline:**
```yaml
stages: [validate, test, build, deploy]
variables:
  NODE_IMAGE: node:20-alpine

.node-cache:
  image: $NODE_IMAGE
  cache:
    key: { files: [package-lock.json] }
    paths: [node_modules/]

lint:
  extends: .node-cache
  stage: validate
  needs: []
  script: [npm ci, npm run lint, npm run typecheck]

unit-tests:
  extends: .node-cache
  stage: test
  needs: []
  script: [npm ci, "npm test -- --coverage"]
  artifacts:
    reports:
      junit: junit.xml
      coverage_report: { coverage_format: cobertura, path: coverage/cobertura-coverage.xml }
  coverage: '/Statements\s*:\s*([\d\.]+)%/'

build:
  extends: .node-cache
  stage: build
  needs: [lint, unit-tests]
  script: [npm ci, npm run build]
  artifacts: { paths: [dist/], expire_in: 1 day }

deploy-staging:
  stage: deploy
  needs: [build]
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/app app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n staging
  environment: { name: staging, url: "https://staging.example.com" }
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

**Multi-Stage Deploy Pipeline:**
```yaml
stages: [build, deploy-staging, verify, deploy-production]

build-image:
  stage: build
  image: { name: "gcr.io/kaniko-project/executor:v1.23.0-debug", entrypoint: [""] }
  script:
    - /kaniko/executor --context $CI_PROJECT_DIR
      --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA --cache=true
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

deploy-staging:
  stage: deploy-staging
  needs: [build-image]
  script:
    - helm upgrade --install app ./chart --namespace staging --set image.tag=$CI_COMMIT_SHA
  environment: { name: staging, url: "https://staging.example.com" }
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

smoke-tests:
  stage: verify
  needs: [deploy-staging]
  script:
    - for i in $(seq 1 10); do curl -sf https://staging.example.com/health && exit 0; sleep 5; done; exit 1
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

deploy-production:
  stage: deploy-production
  needs: [smoke-tests]
  script:
    - helm upgrade --install app ./chart --namespace production --set image.tag=$CI_COMMIT_SHA
  environment: { name: production, url: "https://example.com" }
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
      allow_failure: false
```

---

## 10 Best Practices

1. **Use `rules` instead of `only`/`except`.** The `rules` keyword is more expressive, supports variables, path changes, and explicit `when` clauses. Always terminate rule lists with `- when: never`.

2. **Use `needs` for DAG pipelines.** Break free from stage-sequential execution. Let jobs start as soon as their actual dependencies complete, cutting pipeline duration significantly.

3. **Cache by lockfile hash.** Use `key: { files: [package-lock.json] }` instead of branch-based keys. Content-addressed caching gives optimal hit rates.

4. **Use Kaniko instead of Docker-in-Docker.** Kaniko builds containers without requiring privileged mode, reducing security risk. Use `--cache=true` for layer caching.

5. **Extract shared config with `include` and `extends`.** Maintain CI templates in a central project, versioned with tags. Include via `project` references with pinned `ref`.

6. **Configure `expire_in` on all artifacts.** Unbounded artifact storage grows quickly. Set `expire_in: 1 day` for build outputs, `expire_in: 30 days` for release artifacts.

7. **Use environments for deployment tracking.** GitLab environment dashboards provide deployment history, current state, and rollback capabilities. Always define `environment` on deploy jobs.

8. **Enable review apps for merge requests.** Ephemeral per-MR environments catch integration issues early and enable design review. Configure `auto_stop_in` to clean up automatically.

9. **Set `interruptible: true` on non-critical jobs.** Allow newer pipelines to cancel redundant in-progress jobs. Apply to lint, test, and build jobs -- never to deploy jobs.

10. **Use merge trains for high-traffic repositories.** Merge trains prevent "broken main" by testing each MR on top of all preceding queued MRs, eliminating semantic merge conflicts.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Using `only`/`except` instead of `rules`** | Limited control, confusing precedence, deprecated | Migrate to `rules` with explicit conditions |
| **Stage-only ordering (no `needs`)** | Jobs wait for entire stage, inflating pipeline time | Use `needs` to create DAG; bypass stage waits |
| **Docker-in-Docker with `--privileged`** | Container escape risk, security vulnerability | Use Kaniko or BuildKit rootless builders |
| **Branch-based cache keys** | Low hit rate, cache thrashing on feature branches | Use lockfile-based keys: `key: { files: [lockfile] }` |
| **No artifact expiration** | Storage costs grow unbounded, slow UI | Set `expire_in` on all artifacts |
| **Hardcoded config across repositories** | Drift, duplication, painful updates | Centralize with `include: project` and `extends` |
| **No `interruptible` on CI jobs** | Stale pipelines waste runner capacity | Set `interruptible: true` on build/test jobs |
| **Review apps without `auto_stop_in`** | Orphaned environments consuming cluster resources | Set `auto_stop_in: 3 days` and configure `on_stop` |

---

## Enforcement Checklist

- [ ] All pipeline configuration uses `rules` (no `only`/`except` keywords)
- [ ] `needs` keyword used for DAG execution on pipelines with independent jobs
- [ ] Cache keys use lockfile hash (`key: { files: [...] }`)
- [ ] All artifacts have `expire_in` configured
- [ ] Container builds use Kaniko or rootless BuildKit (no `--privileged` DinD)
- [ ] Shared CI config centralized in template project, included with pinned `ref`
- [ ] Deploy jobs define `environment` with `name` and `url`
- [ ] Review apps configured with `auto_stop_in` and `on_stop` cleanup
- [ ] `interruptible: true` set on all non-deploy jobs
- [ ] Runner executors use Docker or Kubernetes (not Shell for untrusted code)
- [ ] Security scanning templates included (SAST, dependency scanning, container scanning)
- [ ] Merge trains enabled on high-traffic repositories
