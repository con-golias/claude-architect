# GitOps Structure

> **AI Plugin Directive:** When implementing GitOps for Kubernetes deployments, ALWAYS use this guide. Apply repository structure patterns for ArgoCD or Flux, environment promotion strategies, and automated sync policies. This guide covers Git-as-source-of-truth deployment workflows.

**Core Rule: GitOps means Git is the SINGLE source of truth for infrastructure and application state. Changes happen via Git commits and PRs, NEVER via manual `kubectl apply`. Use ArgoCD or Flux for continuous reconciliation. Separate application code repositories from deployment configuration repositories.**

---

## 1. Repository Strategy

```
Two approaches:

APPROACH 1: Separate Repos (RECOMMENDED for teams)
┌─────────────────┐      ┌──────────────────────┐
│ app-repo         │      │ gitops-repo           │
│                  │      │                       │
│ src/             │      │ apps/                 │
│ Dockerfile       │ CI → │   web/                │
│ .github/ci.yml   │ push │     dev/              │
│                  │ tag  │     staging/           │
└─────────────────┘      │     production/        │
                          │ infrastructure/        │
                          └──────────────────────┘

APPROACH 2: Mono Repo (acceptable for small teams)
┌─────────────────────────────────────┐
│ my-project/                          │
│ ├── src/                             │
│ ├── Dockerfile                       │
│ ├── .github/workflows/ci.yml         │
│ └── k8s/                             │
│     ├── base/                        │
│     └── overlays/                    │
└─────────────────────────────────────┘

ALWAYS use separate repos when:
  - Multiple teams deploy independently
  - Security requires separation of duties
  - Different access controls for app vs infra
```

---

## 2. GitOps Repository Structure

```
gitops-config/
├── apps/                                  # Application deployments
│   ├── web/
│   │   ├── base/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── ingress.yaml
│   │   └── overlays/
│   │       ├── dev/
│   │       │   ├── kustomization.yaml
│   │       │   └── patches/
│   │       ├── staging/
│   │       │   ├── kustomization.yaml
│   │       │   └── patches/
│   │       └── production/
│   │           ├── kustomization.yaml
│   │           └── patches/
│   │
│   ├── api/
│   │   ├── base/
│   │   └── overlays/
│   │
│   └── worker/
│       ├── base/
│       └── overlays/
│
├── infrastructure/                        # Cluster-level infrastructure
│   ├── controllers/                       # Ingress, cert-manager, etc.
│   │   ├── ingress-nginx/
│   │   │   └── kustomization.yaml
│   │   ├── cert-manager/
│   │   │   └── kustomization.yaml
│   │   └── external-secrets/
│   │       └── kustomization.yaml
│   │
│   ├── monitoring/                        # Observability stack
│   │   ├── prometheus/
│   │   ├── grafana/
│   │   └── loki/
│   │
│   └── namespaces/
│       ├── dev.yaml
│       ├── staging.yaml
│       └── production.yaml
│
├── clusters/                              # Cluster bootstrap (Flux) or AppOfApps (ArgoCD)
│   ├── dev-cluster/
│   │   ├── kustomization.yaml             # Flux: all apps for dev
│   │   └── apps.yaml                      # ArgoCD: ApplicationSet
│   ├── staging-cluster/
│   └── production-cluster/
│
├── argocd/                                # ArgoCD-specific (if using ArgoCD)
│   ├── applications/
│   │   ├── web.yaml                       # ArgoCD Application CR
│   │   ├── api.yaml
│   │   └── infrastructure.yaml
│   ├── applicationsets/
│   │   └── all-apps.yaml                  # ApplicationSet for DRY config
│   ├── projects/
│   │   ├── apps.yaml                      # AppProject for applications
│   │   └── infra.yaml                     # AppProject for infrastructure
│   └── argocd-cm.yaml                     # ArgoCD config
│
└── README.md
```

---

## 3. ArgoCD Application

```yaml
# argocd/applications/web.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: web-production
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: apps

  source:
    repoURL: https://github.com/myorg/gitops-config.git
    targetRevision: main
    path: apps/web/overlays/production

  destination:
    server: https://kubernetes.default.svc
    namespace: production

  syncPolicy:
    automated:
      prune: true                           # Delete resources removed from Git
      selfHeal: true                        # Revert manual changes
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

```yaml
# argocd/applicationsets/all-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: all-apps
  namespace: argocd
spec:
  generators:
    - matrix:
        generators:
          - git:
              repoURL: https://github.com/myorg/gitops-config.git
              revision: main
              directories:
                - path: apps/*/overlays/*
          - list:
              elements: []                  # Auto-discovered from git
  template:
    metadata:
      name: "{{path[1]}}-{{path[3]}}"       # e.g., web-production
    spec:
      project: apps
      source:
        repoURL: https://github.com/myorg/gitops-config.git
        targetRevision: main
        path: "{{path}}"
      destination:
        server: https://kubernetes.default.svc
        namespace: "{{path[3]}}"
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

---

## 4. Flux Structure

```yaml
# clusters/production-cluster/kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 10m
  retryInterval: 2m
  sourceRef:
    kind: GitRepository
    name: gitops-config
  path: ./apps
  prune: true
  healthAssessment:
    - apiVersion: apps/v1
      kind: Deployment
      inNamespace: production
  patches:
    - patch: |
        apiVersion: kustomize.toolkit.fluxcd.io/v1
        kind: Kustomization
        metadata:
          name: not-used
        spec:
          targetNamespace: production
      target:
        kind: Kustomization
```

```yaml
# Flux GitRepository source
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: gitops-config
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/myorg/gitops-config.git
  ref:
    branch: main
  secretRef:
    name: git-credentials
```

---

## 5. Environment Promotion

```
Promotion strategies:

1. Branch-per-environment (NOT recommended)
   dev branch → staging branch → main branch
   ❌ Merge conflicts, complex branching

2. Directory-per-environment (RECOMMENDED)
   main branch:
     overlays/dev/       ← Always latest
     overlays/staging/   ← Promoted from dev
     overlays/production/ ← Promoted from staging

3. Image tag promotion (MOST COMMON)
   CI builds image → pushes to registry → updates image tag in GitOps repo

   Promotion flow:
   ┌─────────┐     ┌──────────┐     ┌─────────────┐
   │ dev     │ PR  │ staging  │ PR  │ production  │
   │ v1.2.3  │ ──→ │ v1.2.3   │ ──→ │ v1.2.3      │
   └─────────┘     └──────────┘     └─────────────┘

   Image update in Kustomize:
   kustomize edit set image my-app=registry/my-app:v1.2.3
```

---

## 6. Automated Image Updates

```yaml
# ArgoCD Image Updater
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: web
  annotations:
    argocd-image-updater.argoproj.io/image-list: >-
      app=registry.example.com/web
    argocd-image-updater.argoproj.io/app.update-strategy: semver
    argocd-image-updater.argoproj.io/app.allow-tags: "regexp:^v\\d+\\.\\d+\\.\\d+$"
    argocd-image-updater.argoproj.io/write-back-method: git
```

```yaml
# Flux Image Automation
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: web
  namespace: flux-system
spec:
  image: registry.example.com/web
  interval: 5m

---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: web
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: web
  policy:
    semver:
      range: ">=1.0.0"

---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata:
  name: web
  namespace: flux-system
spec:
  interval: 10m
  sourceRef:
    kind: GitRepository
    name: gitops-config
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        name: flux
        email: flux@example.com
      messageTemplate: "chore: update web to {{ .NewTag }}"
    push:
      branch: main
  update:
    path: ./apps/web
    strategy: Setters
```

---

## 7. ArgoCD vs Flux Decision

```
Feature comparison:

| Feature              | ArgoCD               | Flux                  |
|---------------------|----------------------|-----------------------|
| UI                  | Rich web UI          | CLI + Weave GitOps UI |
| Multi-cluster       | Built-in             | Via Kustomization     |
| ApplicationSet      | Yes (powerful)       | Via Kustomization     |
| Image automation    | Image Updater addon  | Built-in              |
| Helm support        | Native               | HelmRelease CRD       |
| Kustomize support   | Native               | Native                |
| RBAC                | Built-in (SSO)       | Kubernetes RBAC       |
| Notifications       | Built-in             | Notification controller|
| Learning curve      | Moderate             | Lower                 |
| Resource usage      | Higher               | Lower                 |

Use ArgoCD when:
  ✅ Need rich UI for visibility
  ✅ Multiple teams need self-service deployments
  ✅ Multi-cluster management required
  ✅ SSO/RBAC integration needed

Use Flux when:
  ✅ Prefer CLI-first workflow
  ✅ Want lighter resource footprint
  ✅ Built-in image automation needed
  ✅ Simpler operational model preferred
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Manual kubectl apply | Drift from Git state | ArgoCD/Flux auto-sync |
| App code + config in same repo | CI triggers deploy on code changes | Separate repos |
| Branch-per-environment | Merge conflicts, complex flow | Directory-per-environment |
| No prune policy | Deleted resources remain | Enable `prune: true` |
| No selfHeal | Manual changes persist | Enable `selfHeal: true` |
| Secrets in GitOps repo | Credentials in Git | Sealed Secrets / External Secrets |
| No health checks | ArgoCD shows "synced" but broken | Add health assessments |
| No RBAC on GitOps repo | Anyone can deploy to production | Branch protection + CODEOWNERS |
| No sync windows | Deploys during peak hours | Configure sync windows |
| No notifications | Team unaware of deployments | Slack/Teams integration |

---

## 9. Enforcement Checklist

- [ ] Git is single source of truth — NO manual kubectl in production
- [ ] Separate repos — app code vs deployment config
- [ ] Directory-per-environment — dev, staging, production overlays
- [ ] Automated sync — ArgoCD or Flux reconciliation
- [ ] Prune enabled — deleted resources cleaned up
- [ ] Self-heal enabled — manual changes reverted
- [ ] Secrets external — Sealed Secrets or External Secrets Operator
- [ ] Image promotion — tag-based promotion through environments
- [ ] Branch protection — PR reviews for production changes
- [ ] CODEOWNERS — team ownership of deployment configs
- [ ] Notifications — deployment alerts to team channels
- [ ] Sync windows — restrict production deploys to business hours
- [ ] Health checks — verify deployment health before marking synced
