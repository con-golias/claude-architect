# Kubernetes Manifests Structure

> **AI Plugin Directive:** When organizing Kubernetes manifests for deployment, ALWAYS use this guide. Apply Kustomize for environment overlays or Helm for templated deployments. This guide covers manifest organization, environment management, and deployment patterns for Kubernetes-native applications.

**Core Rule: NEVER use raw `kubectl apply` with inline manifests in production. Use Kustomize overlays or Helm charts. Organize manifests by application, not by resource type. Environment-specific values go in overlays/values files, NEVER in base manifests.**

---

## 1. Kustomize Structure (Recommended)

```
k8s/
├── base/                                  # Shared base manifests
│   ├── kustomization.yaml                 # Base kustomization
│   ├── namespace.yaml                     # Namespace definition
│   ├── deployment.yaml                    # Application deployment
│   ├── service.yaml                       # ClusterIP service
│   ├── hpa.yaml                           # Horizontal Pod Autoscaler
│   ├── configmap.yaml                     # Non-secret configuration
│   ├── service-account.yaml               # RBAC service account
│   └── network-policy.yaml                # Network policies
│
├── overlays/                              # Environment-specific overrides
│   ├── dev/
│   │   ├── kustomization.yaml
│   │   ├── patches/
│   │   │   ├── deployment-patch.yaml      # 1 replica, debug logging
│   │   │   └── resources-patch.yaml       # Lower resource limits
│   │   └── configmap-values.env           # Dev-specific config
│   │
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   ├── patches/
│   │   │   ├── deployment-patch.yaml      # 2 replicas
│   │   │   └── ingress-patch.yaml         # Staging domain
│   │   └── configmap-values.env
│   │
│   └── production/
│       ├── kustomization.yaml
│       ├── patches/
│       │   ├── deployment-patch.yaml      # 3+ replicas, resource limits
│       │   ├── ingress-patch.yaml         # Production domain + TLS
│       │   └── hpa-patch.yaml             # Production autoscaling
│       └── configmap-values.env
│
└── components/                            # Reusable Kustomize components
    ├── monitoring/
    │   ├── kustomization.yaml
    │   ├── service-monitor.yaml
    │   └── pod-monitor.yaml
    └── ingress/
        ├── kustomization.yaml
        └── ingress.yaml
```

---

## 2. Base Manifests

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - deployment.yaml
  - service.yaml
  - hpa.yaml
  - service-account.yaml
  - network-policy.yaml

configMapGenerator:
  - name: app-config
    envs:
      - configmap-values.env

commonLabels:
  app.kubernetes.io/name: my-app
  app.kubernetes.io/managed-by: kustomize
```

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1                              # Overridden per environment
  selector:
    matchLabels:
      app.kubernetes.io/name: my-app
  template:
    metadata:
      labels:
        app.kubernetes.io/name: my-app
    spec:
      serviceAccountName: my-app
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: my-app
          image: my-app:latest              # Tag overridden per environment
          ports:
            - containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
```

---

## 3. Environment Overlays

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: my-app-prod

resources:
  - ../../base

components:
  - ../../components/monitoring
  - ../../components/ingress

images:
  - name: my-app
    newName: registry.example.com/my-app
    newTag: v1.2.3                          # Pinned version

patches:
  - path: patches/deployment-patch.yaml
  - path: patches/hpa-patch.yaml
  - path: patches/ingress-patch.yaml

configMapGenerator:
  - name: app-config
    behavior: merge
    envs:
      - configmap-values.env
```

```yaml
# k8s/overlays/production/patches/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: my-app
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "2"
              memory: 2Gi
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: my-app
```

```bash
# Build and apply
kustomize build k8s/overlays/production | kubectl apply -f -

# Or with kubectl directly
kubectl apply -k k8s/overlays/production

# Preview changes
kubectl diff -k k8s/overlays/production
```

---

## 4. Helm Chart Structure

```
charts/
└── my-app/
    ├── Chart.yaml                         # Chart metadata
    ├── values.yaml                        # Default values
    ├── values-dev.yaml                    # Dev overrides
    ├── values-staging.yaml                # Staging overrides
    ├── values-production.yaml             # Production overrides
    │
    ├── templates/
    │   ├── _helpers.tpl                   # Template helpers
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── ingress.yaml
    │   ├── hpa.yaml
    │   ├── configmap.yaml
    │   ├── secret.yaml
    │   ├── serviceaccount.yaml
    │   ├── networkpolicy.yaml
    │   ├── pdb.yaml                       # PodDisruptionBudget
    │   ├── servicemonitor.yaml            # Prometheus monitoring
    │   ├── NOTES.txt                      # Post-install notes
    │   └── tests/
    │       └── test-connection.yaml       # Helm test
    │
    └── charts/                            # Sub-chart dependencies
```

```yaml
# Chart.yaml
apiVersion: v2
name: my-app
description: My application Helm chart
type: application
version: 1.0.0                            # Chart version
appVersion: "1.2.3"                        # Application version

dependencies:
  - name: postgresql
    version: "15.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: "19.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

```yaml
# values.yaml (defaults)
replicaCount: 1

image:
  repository: my-app
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3000

ingress:
  enabled: false
  className: nginx
  hosts: []
  tls: []

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilization: 80

postgresql:
  enabled: true
  auth:
    database: myapp

redis:
  enabled: false
```

---

## 5. Kustomize vs Helm Decision

```
Use Kustomize when:
  ✅ Simple configuration differences between environments
  ✅ You own the manifests (not distributing to others)
  ✅ Overlay model fits (base + patches)
  ✅ No complex templating needed
  ✅ GitOps workflow (ArgoCD/Flux natively supports Kustomize)

Use Helm when:
  ✅ Distributing charts to external users
  ✅ Complex conditional logic in manifests
  ✅ Managing third-party dependencies (Postgres, Redis charts)
  ✅ Need release management (helm upgrade, rollback)
  ✅ Extensive parameterization needed

Use BOTH when:
  ✅ Helm for third-party deps + Kustomize for your own apps
  ✅ Helm-generated manifests post-processed by Kustomize

NEVER:
  ❌ Raw kubectl apply in production
  ❌ Inline manifests in CI scripts
  ❌ sed/envsubst for templating (fragile, error-prone)
```

---

## 6. Multi-App Repository

```
k8s/
├── apps/
│   ├── web/
│   │   ├── base/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   └── service.yaml
│   │   └── overlays/
│   │       ├── dev/
│   │       ├── staging/
│   │       └── production/
│   │
│   ├── api/
│   │   ├── base/
│   │   └── overlays/
│   │       ├── dev/
│   │       ├── staging/
│   │       └── production/
│   │
│   └── worker/
│       ├── base/
│       └── overlays/
│
├── infrastructure/                        # Cluster-level resources
│   ├── cert-manager/
│   ├── ingress-nginx/
│   ├── monitoring/
│   │   ├── prometheus/
│   │   └── grafana/
│   └── sealed-secrets/
│
└── namespaces/
    ├── dev.yaml
    ├── staging.yaml
    └── production.yaml
```

---

## 7. Secret Management

```
NEVER commit secrets to Git. Options:

1. Sealed Secrets (Bitnami)
   - Encrypt secrets with cluster public key
   - Commit encrypted SealedSecret to Git
   - Controller decrypts in-cluster

2. External Secrets Operator
   - Sync secrets from AWS Secrets Manager, Vault, GCP Secret Manager
   - ExternalSecret CR references external store

3. SOPS (Mozilla)
   - Encrypt YAML/JSON files with KMS/PGP
   - Decrypt at deploy time
   - Works with Kustomize and Helm

4. Vault (HashiCorp)
   - Vault Agent sidecar injects secrets
   - Most powerful, most complex

Recommendation:
  Small teams    → Sealed Secrets
  AWS/GCP/Azure  → External Secrets Operator
  Enterprise     → Vault
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Raw `kubectl apply` in prod | No reproducibility, drift | Use Kustomize or Helm |
| Secrets in Git | Credentials exposed | Sealed Secrets / External Secrets |
| No resource limits | Pod consumes all node resources | Set requests AND limits |
| Running as root | Security vulnerability | `runAsNonRoot: true`, `runAsUser: 1001` |
| No health probes | Dead pods receive traffic | Add liveness + readiness probes |
| `latest` tag in production | Unpredictable deployments | Pin exact image tags |
| Manifests organized by type | Hard to manage per-app | Organize by application |
| No PodDisruptionBudget | Downtime during node maintenance | Add PDB with minAvailable |
| No NetworkPolicy | All pods can communicate | Restrict to required paths |
| Hardcoded environment values | Can't reuse across envs | Kustomize overlays or Helm values |

---

## 9. Enforcement Checklist

- [ ] Kustomize or Helm — NEVER raw kubectl in production
- [ ] Base + overlays per environment — dev, staging, production
- [ ] Secrets NOT in Git — use Sealed Secrets or External Secrets
- [ ] Resource requests AND limits — on every container
- [ ] Non-root containers — `runAsNonRoot: true`
- [ ] Health probes — liveness + readiness on every deployment
- [ ] Pinned image tags — NEVER `:latest` in production
- [ ] NetworkPolicy — restrict pod-to-pod communication
- [ ] PodDisruptionBudget — protect during maintenance
- [ ] SecurityContext — drop all capabilities, read-only FS
- [ ] Topology spread — distribute across zones
- [ ] Organized by app — NOT by resource type
