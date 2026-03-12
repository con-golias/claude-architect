# GitOps

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | DevOps > CI/CD                                               |
| Importance    | Critical                                                     |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [Deployment Strategies](deployment-strategies.md), [Kubernetes Fundamentals](../containers/orchestration/kubernetes/fundamentals.md) |

---

## Core Concepts

### GitOps Principles

GitOps is an operational framework where Git is the single source of truth for
declarative infrastructure and application configuration. Four core principles:

1. **Declarative** -- The entire desired system state is described declaratively (YAML, HCL, JSON).
2. **Versioned and immutable** -- All changes go through Git. Every state change has an
   audit trail, author, timestamp, and is revertible via `git revert`.
3. **Pulled automatically** -- Agents pull desired state from Git and apply it.
   No external CI system pushes credentials into the cluster.
4. **Continuously reconciled** -- Software agents detect drift between desired state (Git)
   and actual state (cluster) and correct it automatically.

```
┌─────────┐    push     ┌──────────┐    pull     ┌──────────────┐
│Developer │ ──────────► │   Git    │ ◄────────── │  GitOps      │
│          │  (PR/merge) │   Repo   │  (poll/     │  Operator    │
└─────────┘              └──────────┘   webhook)  │  (ArgoCD/    │
                              │                   │   Flux)      │
                              │                   └──────┬───────┘
                         Source of Truth                  │ reconcile
                                                         ▼
                                                  ┌──────────────┐
                                                  │  Kubernetes   │
                                                  │  Cluster(s)   │
                                                  └──────────────┘
```

### Pull-Based vs Push-Based CD

| Aspect          | Pull-Based (GitOps)                  | Push-Based (Traditional CI/CD)       |
|----------------|---------------------------------------|--------------------------------------|
| Deployment      | Operator in cluster pulls from Git   | CI pipeline pushes to cluster        |
| Credentials     | Cluster accesses Git (read-only)     | CI has cluster admin credentials     |
| Drift detection | Continuous reconciliation            | None (only applies on pipeline run)  |
| Security        | No external cluster access needed    | CI system is a high-value target     |
| Audit           | Full Git history                     | CI pipeline logs (may expire)        |
| Rollback        | `git revert` and auto-reconcile      | Re-run old pipeline or manual fix    |

**Prefer pull-based.** It eliminates the need for CI pipelines to hold cluster credentials
and provides continuous drift correction.

### ArgoCD

ArgoCD is the dominant GitOps tool (CNCF graduated project). It watches Git repositories
and synchronizes Kubernetes resources to match the declared state.

**Architecture:**

```
┌──────────────────────────────────────────────────┐
│                  ArgoCD Server                     │
│  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ API Server │  │   Repo   │  │ Application  │  │
│  │ (UI + CLI) │  │  Server  │  │  Controller  │  │
│  └────────────┘  └──────────┘  └──────────────┘  │
│                       │               │            │
│              Clones repos    Reconciles apps       │
│              Renders manifests  Syncs to cluster   │
└──────────────────────────────────────────────────┘
         │                              │
    Git Repos                    Kubernetes API
    (source of truth)            (target clusters)
```

**Application CRD:**

```yaml
# ArgoCD Application -- single microservice
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: user-service
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io  # Clean up on delete
spec:
  project: production
  source:
    repoURL: https://github.com/org/k8s-manifests.git
    targetRevision: main
    path: apps/user-service/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true          # Delete resources removed from Git
      selfHeal: true       # Revert manual kubectl changes
      allowEmpty: false     # Prevent accidental empty sync
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

**ApplicationSet -- generate Applications dynamically:**

```yaml
# ApplicationSet with Git directory generator
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: cluster-apps
  namespace: argocd
spec:
  generators:
  - git:
      repoURL: https://github.com/org/k8s-manifests.git
      revision: main
      directories:
      - path: apps/*/overlays/production
  template:
    metadata:
      name: '{{path.basename}}'
    spec:
      project: production
      source:
        repoURL: https://github.com/org/k8s-manifests.git
        targetRevision: main
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path[1]}}'  # Extract app name from path
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

**App of Apps Pattern:**

```yaml
# Root application that manages all other applications
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/k8s-manifests.git
    targetRevision: main
    path: argocd-apps/   # Directory containing Application YAMLs
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

```
argocd-apps/
├── user-service.yaml       # Application CR
├── order-service.yaml      # Application CR
├── payment-service.yaml    # Application CR
├── monitoring.yaml         # Application CR (Prometheus stack)
└── cert-manager.yaml       # Application CR
```

**Sync strategies:**

| Strategy         | Behavior                                        | Use Case                        |
|-----------------|-------------------------------------------------|---------------------------------|
| Manual          | Sync only when explicitly triggered              | Highly regulated environments   |
| Automated       | Sync on Git change detection                     | Standard GitOps workflow        |
| Auto + selfHeal | Revert any manual cluster changes                | Enforce Git as sole truth       |
| Auto + prune    | Delete resources removed from Git                | Prevent resource leaks          |

**ArgoCD RBAC:**

```csv
# argocd-rbac-cm ConfigMap
p, role:developer, applications, get, */*, allow
p, role:developer, applications, sync, */*, allow
p, role:developer, logs, get, */*, allow
p, role:admin, applications, *, */*, allow
p, role:admin, clusters, *, *, allow
p, role:admin, projects, *, *, allow
g, dev-team, role:developer
g, platform-team, role:admin
```

### Flux CD

Flux is a CNCF graduated GitOps toolkit. It uses a set of Kubernetes controllers
that reconcile cluster state from Git, Helm, and OCI sources.

**Architecture:**

```
┌──────────────────────────────────────────────┐
│              Flux Controllers                  │
│  ┌───────────────┐  ┌──────────────────────┐  │
│  │ Source         │  │ Kustomize Controller │  │
│  │ Controller     │  │ (applies manifests)  │  │
│  │ (Git, Helm,   │  └──────────────────────┘  │
│  │  OCI, S3)     │  ┌──────────────────────┐  │
│  └───────────────┘  │ Helm Controller      │  │
│  ┌───────────────┐  │ (Helm releases)      │  │
│  │ Notification  │  └──────────────────────┘  │
│  │ Controller    │  ┌──────────────────────┐  │
│  │ (alerts)      │  │ Image Automation     │  │
│  └───────────────┘  │ (auto-update tags)   │  │
│                      └──────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Flux GitRepository + Kustomization:**

```yaml
# Source: watch a Git repository
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: app-manifests
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/org/k8s-manifests.git
  ref:
    branch: main
  secretRef:
    name: git-credentials
---
# Apply manifests from the Git source
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: user-service
  namespace: flux-system
spec:
  interval: 5m
  retryInterval: 2m
  timeout: 3m
  sourceRef:
    kind: GitRepository
    name: app-manifests
  path: ./apps/user-service/overlays/production
  prune: true          # Delete removed resources
  force: false
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: user-service
      namespace: production
  postBuild:
    substituteFrom:
      - kind: ConfigMap
        name: cluster-config
```

**Flux HelmRelease:**

```yaml
# Helm-based deployment via Flux
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: bitnami
  namespace: flux-system
spec:
  interval: 30m
  url: https://charts.bitnami.com/bitnami
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: redis
  namespace: production
spec:
  interval: 10m
  chart:
    spec:
      chart: redis
      version: "18.x"    # Semver range
      sourceRef:
        kind: HelmRepository
        name: bitnami
        namespace: flux-system
  values:
    architecture: replication
    replica:
      replicaCount: 3
    auth:
      existingSecret: redis-credentials
  upgrade:
    remediation:
      retries: 3
      remediateLastFailure: true
```

### ArgoCD vs Flux: Selection Guide

| Criterion          | ArgoCD                              | Flux                                |
|-------------------|--------------------------------------|--------------------------------------|
| UI                | Rich built-in web UI                 | No UI (use Weave GitOps or Capacitor)|
| RBAC              | Fine-grained, built-in               | Kubernetes RBAC (multi-tenancy)      |
| Multi-cluster     | Built-in cluster management          | Via Kustomization targeting          |
| SSO               | Built-in OIDC/SAML/LDAP             | External (Kubernetes OIDC)           |
| Architecture      | Monolithic server                    | Modular controllers                  |
| Helm support      | Renders in repo server               | Native HelmRelease controller        |
| Image automation  | External (Argo CD Image Updater)     | Built-in Image Automation controller |
| Learning curve    | Lower (UI-driven)                    | Higher (CRD-driven, no UI)           |
| Enterprise        | ArgoCD 3.3+: deletion safety, auth   | Flux 2.8: cancel-and-reconcile       |
| Best for          | Teams wanting UI + RBAC + SSO        | Platform teams wanting modular lib   |

### GitOps Repository Structure

**Monorepo (recommended for small-medium teams):**

```
k8s-manifests/
├── apps/
│   ├── user-service/
│   │   ├── base/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── hpa.yaml
│   │   │   └── kustomization.yaml
│   │   └── overlays/
│   │       ├── staging/
│   │       │   ├── kustomization.yaml
│   │       │   └── patches/
│   │       │       └── replicas.yaml
│   │       └── production/
│   │           ├── kustomization.yaml
│   │           └── patches/
│   │               ├── replicas.yaml
│   │               └── resources.yaml
│   ├── order-service/
│   │   ├── base/
│   │   └── overlays/
│   └── ...
├── infrastructure/
│   ├── cert-manager/
│   ├── ingress-nginx/
│   ├── monitoring/
│   └── external-secrets/
├── argocd-apps/              # Application CRs (App of Apps)
│   ├── user-service.yaml
│   ├── order-service.yaml
│   └── monitoring.yaml
└── clusters/
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml
```

**Multi-repo (for large organizations with team ownership boundaries):**

```
org/app-user-service-deploy     # Team A owns
org/app-order-service-deploy    # Team B owns
org/infra-platform-deploy       # Platform team owns
org/argocd-config               # Platform team owns (ApplicationSets)
```

### Secrets in GitOps

Secrets cannot be stored as plaintext in Git. Use one of these approaches:

| Solution                  | Mechanism                             | Complexity | Best For              |
|--------------------------|---------------------------------------|------------|------------------------|
| Sealed Secrets           | Encrypt with cluster public key       | Low        | Simple setups          |
| SOPS + Age/KMS           | Encrypt in-place in YAML              | Medium     | Multi-env, GitOps-native|
| External Secrets Operator| Sync from Vault/AWS SM/GCP SM         | Medium     | Enterprise, multi-cloud |
| Vault Secrets Operator   | HashiCorp Vault integration           | High       | Existing Vault users   |

**SOPS with Age encryption (recommended for GitOps):**

```yaml
# Encrypt secrets in Git with SOPS
# .sops.yaml (repository root)
creation_rules:
  - path_regex: .*\.secret\.yaml$
    age: >-
      age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
    encrypted_regex: ^(data|stringData)$
```

```yaml
# db-credentials.secret.yaml (encrypted in Git, decrypted by Flux/ArgoCD)
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: production
type: Opaque
stringData:
  # SOPS encrypts only these values; metadata stays readable
  DB_HOST: ENC[AES256_GCM,data:abc123...,type:str]
  DB_PASSWORD: ENC[AES256_GCM,data:def456...,type:str]
sops:
  age:
    - recipient: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
      enc: |
        -----BEGIN AGE ENCRYPTED FILE-----
        ...
        -----END AGE ENCRYPTED FILE-----
  lastmodified: "2026-03-10T10:00:00Z"
  version: 3.9.0
```

**External Secrets Operator:**

```yaml
# Pull secrets from AWS Secrets Manager into Kubernetes
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
  - secretKey: DB_HOST
    remoteRef:
      key: production/database
      property: host
  - secretKey: DB_PASSWORD
    remoteRef:
      key: production/database
      property: password
```

### Progressive Delivery with GitOps

Combine Argo Rollouts with ArgoCD for GitOps-native canary and blue-green deployments.
See [Deployment Strategies](deployment-strategies.md) for detailed rollout configurations.

```yaml
# ArgoCD manages the Rollout resource (instead of Deployment)
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api-service
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: { duration: 5m }
      - analysis:
          templates:
          - templateName: success-rate
      - setWeight: 50
      - pause: { duration: 10m }
      - setWeight: 100
  selector:
    matchLabels:
      app: api-service
  template:
    metadata:
      labels:
        app: api-service
    spec:
      containers:
      - name: api
        image: myapp/api:3.2.0   # Update this in Git to trigger rollout
```

**Workflow:** Developer updates image tag in Git -> ArgoCD detects change -> ArgoCD syncs
the Rollout -> Argo Rollouts executes canary steps with analysis -> Promotion or rollback.

### GitOps for Infrastructure (Terraform + GitOps)

Apply GitOps principles to infrastructure provisioning using Terraform controllers
or CI-driven Terraform with GitOps workflows.

```yaml
# Flux Terraform Controller -- GitOps for Terraform
apiVersion: infra.contrib.fluxcd.io/v1alpha2
kind: Terraform
metadata:
  name: vpc
  namespace: flux-system
spec:
  interval: 10m
  approvePlan: auto        # Or "manual" for plan-then-approve
  path: ./terraform/vpc
  sourceRef:
    kind: GitRepository
    name: infra-repo
  varsFrom:
  - kind: Secret
    name: terraform-vars
  writeOutputsToSecret:
    name: vpc-outputs
    outputs:
    - vpc_id
    - subnet_ids
```

**Alternative:** Use **Crossplane** for Kubernetes-native infrastructure management
via CRDs (AWS RDS, GCP CloudSQL, etc.) -- fully GitOps-compatible since all resources
are Kubernetes objects.

### Multi-Cluster GitOps Patterns

**Hub-and-spoke (ArgoCD):**

```
┌────────────────┐
│ Management     │     ArgoCD runs here
│ Cluster (Hub)  │     manages all clusters
└───┬────┬───┬───┘
    │    │   │
┌───▼┐ ┌▼──┐ ┌▼───┐
│Dev │ │Stg│ │Prod│   Spoke clusters
└────┘ └───┘ └────┘   (workload clusters)
```

```yaml
# ArgoCD ApplicationSet for multi-cluster
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: multi-cluster-apps
  namespace: argocd
spec:
  generators:
  - matrix:
      generators:
      - clusters:
          selector:
            matchLabels:
              env: production
      - git:
          repoURL: https://github.com/org/k8s-manifests.git
          revision: main
          directories:
          - path: apps/*
  template:
    metadata:
      name: '{{path.basename}}-{{name}}'
    spec:
      project: production
      source:
        repoURL: https://github.com/org/k8s-manifests.git
        targetRevision: main
        path: '{{path}}/overlays/production'
      destination:
        server: '{{server}}'
        namespace: '{{path.basename}}'
```

**Flux multi-tenancy:** Use per-team `GitRepository` + `Kustomization` with a scoped
`serviceAccountName` and `targetNamespace`. This enforces RBAC boundaries so each
team can only deploy to their own namespaces.

---

## Best Practices

1. **Use Git as the sole source of truth.** Never apply changes directly with `kubectl`.
   Enable `selfHeal` (ArgoCD) or `prune: true` (Flux) to revert manual drift.

2. **Separate application and infrastructure repositories.** Application manifests and
   infrastructure (Terraform, Crossplane) have different change cadences and approval
   requirements. Use distinct repos or clearly separated paths.

3. **Encrypt secrets with SOPS or External Secrets Operator.** Never commit plaintext
   secrets. Use SOPS for small teams and ESO for enterprises with existing secret stores.

4. **Implement ApplicationSet or Flux generators for scale.** Do not manually create
   Application CRs for each microservice. Use generators to derive applications from
   directory structure or cluster labels.

5. **Enable automated sync with pruning.** `prune: true` and `selfHeal: true` enforce
   that Git is the sole source of truth. Without pruning, deleted resources leak in the
   cluster indefinitely.

6. **Structure repos with base/overlays (Kustomize).** Use Kustomize bases for shared
   configuration and overlays for environment-specific patches. This eliminates YAML
   duplication across staging/production.

7. **Protect the main branch with PR reviews.** Since Git drives production state, branch
   protection is your change management process. Require at least one approval and
   passing CI checks before merge.

8. **Use health checks and sync waves.** Define health checks (ArgoCD health assessments
   or Flux healthChecks) so the operator knows whether a sync succeeded. Use sync waves
   to order dependent resources (CRDs before instances).

9. **Monitor reconciliation metrics.** Alert on ArgoCD `app_health_status` or Flux
   `gotk_reconcile_duration_seconds`. A stuck reconciliation means drift is accumulating.

10. **Plan for multi-cluster from the start.** Even with a single cluster, structure
    repositories and ApplicationSets to support multiple clusters. Migration later is
    significantly harder than starting with the right structure.

---

## Anti-Patterns

| Anti-Pattern                           | Impact                                          | Fix                                                     |
|----------------------------------------|-------------------------------------------------|---------------------------------------------------------|
| `kubectl apply` in production          | Drift from Git; no audit trail; overwrites next sync | Enable selfHeal; revoke direct cluster write access  |
| Plaintext secrets in Git               | Credential exposure to anyone with repo access   | Use SOPS, Sealed Secrets, or External Secrets Operator |
| Manual Application CRs for each service| Does not scale; inconsistent configuration       | Use ApplicationSet generators or Flux Kustomizations   |
| No pruning enabled                     | Deleted resources persist as orphans in cluster  | Enable `prune: true` in all sync policies              |
| Single repo for 100+ services          | Slow Git operations; noisy change history        | Split into per-team repos with ApplicationSet multi-source|
| No health checks on sync               | Operator reports "synced" even when pods crash   | Define healthChecks / health assessments for all apps  |
| Push-based CD calling `kubectl` from CI| CI holds cluster admin credentials; no drift detection | Migrate to pull-based GitOps (ArgoCD or Flux)      |
| No branch protection on GitOps repo    | Accidental merge deploys broken config to prod   | Require PR review + CI validation before merge         |

---

## Enforcement Checklist

- [ ] Git repository is the sole source of truth for all cluster state
- [ ] ArgoCD or Flux is deployed with automated sync and self-healing enabled
- [ ] Pruning is enabled to delete resources removed from Git
- [ ] Secrets are encrypted (SOPS/Sealed Secrets) or externalized (ESO)
- [ ] Branch protection requires PR review and CI checks on the GitOps repo
- [ ] ApplicationSet or generators handle dynamic application creation
- [ ] Health checks are defined for all synced applications
- [ ] Direct `kubectl` write access is revoked for non-emergency use
- [ ] Reconciliation metrics are monitored and alerted on
- [ ] Repository structure uses Kustomize base/overlays to eliminate duplication
- [ ] Multi-cluster strategy is documented and tested
- [ ] Rollback procedure is documented: `git revert` -> auto-reconcile -> verify
