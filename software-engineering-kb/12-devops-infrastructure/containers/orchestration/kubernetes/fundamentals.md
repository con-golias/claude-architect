# Kubernetes Fundamentals

| Field | Value |
|---|---|
| **Domain** | DevOps > Containers > Kubernetes |
| **Importance** | Critical |
| **Last Updated** | 2026-03-10 |
| **Cross-references** | [Architecture](architecture.md), [Deployments & Services](deployments-services.md) |

---

## Core Concepts

### When to Use Kubernetes

Use Kubernetes when the workload requires container orchestration beyond what a single
host can manage. Kubernetes is the right choice when the team needs automated scaling,
self-healing, rolling deployments, service discovery, and declarative infrastructure.

Avoid Kubernetes for simple applications that run on a single server, for teams without
operational capacity to manage clusters, or when a managed PaaS (Heroku, Fly.io, Railway)
meets the requirements. Start with managed Kubernetes (EKS, GKE, AKS) unless specific
constraints demand self-managed clusters.

### Core Objects

#### Pod

The smallest deployable unit. A Pod wraps one or more containers that share network
namespace, storage volumes, and lifecycle. Treat Pods as ephemeral -- never create
standalone Pods in production; always use a controller (Deployment, StatefulSet, Job).

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: debug-pod
  labels:
    app: debug
    environment: dev
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
      ports:
        - containerPort: 80
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 200m
          memory: 256Mi
```

#### ReplicaSet

Ensures a specified number of Pod replicas run at all times. Never create ReplicaSets
directly -- Deployments manage them automatically and add rollout capabilities.

#### Deployment

The standard controller for stateless workloads. Manages ReplicaSets and provides
declarative updates, rollbacks, and scaling.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: production
  labels:
    app: api-server
    version: v2.4.1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        version: v2.4.1
    spec:
      containers:
        - name: api
          image: registry.example.com/api-server:v2.4.1
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
```

#### Service

Provides stable networking for a set of Pods. See [Deployments & Services](deployments-services.md)
for ClusterIP, NodePort, LoadBalancer, and ExternalName types.

#### Namespace

Logical isolation boundary within a cluster. Use namespaces to separate environments,
teams, or applications. Apply ResourceQuotas and LimitRanges per namespace.

```bash
kubectl create namespace staging
kubectl get pods --namespace staging
kubectl config set-context --current --namespace=staging
```

#### ConfigMap and Secret

ConfigMaps store non-sensitive configuration. Secrets store sensitive data (base64-encoded
by default -- enable encryption at rest in production).

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
  config.yaml: |
    server:
      port: 8080
      timeout: 30s
---
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: production
type: Opaque
stringData:                    # stringData accepts plain text (auto-encoded)
  url: "postgresql://user:pass@db:5432/app"
  password: "s3cure-p@ssword"
```

Mount as environment variables or volume files:

```yaml
spec:
  containers:
    - name: app
      envFrom:
        - configMapRef:
            name: app-config
      volumeMounts:
        - name: secret-vol
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: secret-vol
      secret:
        secretName: db-credentials
```

### kubectl Essential Commands

```bash
# --- Inspect ---
kubectl get pods -n production -o wide          # List pods with node info
kubectl get deploy,svc,ing -n production        # Multiple resource types
kubectl describe pod api-server-7f8b9-xk2lp     # Detailed status + events
kubectl logs api-server-7f8b9-xk2lp -c api -f  # Stream container logs
kubectl logs -l app=api-server --tail=100       # Logs by label selector

# --- Debug ---
kubectl exec -it api-server-7f8b9-xk2lp -- sh  # Shell into container
kubectl port-forward svc/api-server 8080:80     # Local port forward
kubectl top pods -n production                  # CPU/memory usage

# --- Apply / Delete ---
kubectl apply -f manifests/                     # Apply directory of YAMLs
kubectl apply -f deployment.yaml --dry-run=server  # Server-side dry run
kubectl delete pod api-server-7f8b9-xk2lp       # Delete (controller recreates)

# --- Rollouts ---
kubectl rollout status deployment/api-server    # Watch rollout progress
kubectl rollout history deployment/api-server   # Show revision history
kubectl rollout undo deployment/api-server      # Rollback to previous
kubectl rollout undo deployment/api-server --to-revision=3  # Specific rev

# --- Context ---
kubectl config get-contexts                     # List contexts
kubectl config use-context prod-cluster         # Switch cluster
```

### YAML Manifest Structure

Every Kubernetes manifest follows a consistent structure with four top-level fields:

```yaml
apiVersion: apps/v1          # API group and version
kind: Deployment             # Resource type
metadata:                    # Name, namespace, labels, annotations
  name: my-app
  namespace: default
  labels:
    app.kubernetes.io/name: my-app
    app.kubernetes.io/version: "1.0.0"
    app.kubernetes.io/component: backend
    app.kubernetes.io/managed-by: helm
  annotations:
    description: "Main application backend"
spec:                        # Desired state (varies by Kind)
  replicas: 3
  # ...
```

### Labels and Selectors

Labels are key-value pairs attached to objects. Use the recommended label taxonomy:

| Label | Purpose |
|---|---|
| `app.kubernetes.io/name` | Application name |
| `app.kubernetes.io/instance` | Unique instance identifier |
| `app.kubernetes.io/version` | Application version |
| `app.kubernetes.io/component` | Component within architecture |
| `app.kubernetes.io/part-of` | Higher-level application |
| `app.kubernetes.io/managed-by` | Tool managing the resource |

Selectors match labels for Services, Deployments, and NetworkPolicies:

```yaml
selector:
  matchLabels:
    app: api-server
  matchExpressions:
    - key: environment
      operator: In
      values: [production, staging]
```

### Resource Requests and Limits

Always set both requests and limits. Requests determine scheduling; limits prevent
resource starvation. The CPU is compressible (throttled), memory is incompressible (OOMKilled).

```yaml
resources:
  requests:
    cpu: 250m        # 0.25 CPU cores -- scheduling guarantee
    memory: 512Mi    # Scheduling guarantee
  limits:
    cpu: "1"         # Throttled above this
    memory: 1Gi      # OOMKilled above this
```

Set limits equal to or moderately above requests. Avoid setting CPU limits much higher
than requests (causes noisy-neighbor effects). Since Kubernetes 1.27+, consider not
setting CPU limits at all when using resource-aware scheduling with the `InPlacePodVerticalScaling`
feature gate.

### LimitRange and ResourceQuota

Enforce namespace-level resource governance:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: staging
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "2"
        memory: 4Gi
      min:
        cpu: 50m
        memory: 64Mi
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: staging
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
    services: "10"
    persistentvolumeclaims: "20"
```

### Pod Lifecycle

| Phase | Description |
|---|---|
| **Pending** | Accepted but not yet scheduled or pulling images |
| **Running** | At least one container is running |
| **Succeeded** | All containers terminated with exit code 0 |
| **Failed** | At least one container terminated with non-zero exit |
| **Unknown** | Pod state cannot be determined (node communication failure) |

### Init Containers and Sidecar Containers

Init containers run sequentially before app containers start. Use them for setup tasks
(schema migration, config fetching, dependency waiting).

```yaml
spec:
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command: ['sh', '-c', 'until nc -z postgres-svc 5432; do sleep 2; done']
    - name: run-migrations
      image: registry.example.com/api-server:v2.4.1
      command: ['./migrate', 'up']
```

**Native sidecar containers (Kubernetes 1.28+)** use `restartPolicy: Always` on init
containers to create long-running sidecars that start before app containers and stop
after them. This solves the classic sidecar ordering problem (e.g., Istio proxy must
start before app, and stay alive until app finishes in Jobs).

```yaml
spec:
  initContainers:
    - name: log-collector
      image: fluent-bit:3.1
      restartPolicy: Always       # Native sidecar -- runs for pod lifetime
      resources:
        requests:
          cpu: 50m
          memory: 64Mi
  containers:
    - name: app
      image: registry.example.com/api-server:v2.4.1
```

### Container Probes

Configure probes on every production container. All three probe types support HTTP GET,
TCP socket, gRPC, and exec checks.

```yaml
spec:
  containers:
    - name: api
      image: registry.example.com/api-server:v2.4.1
      livenessProbe:              # Restart container if unhealthy
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 15
        periodSeconds: 10
        failureThreshold: 3
      readinessProbe:             # Remove from Service endpoints if not ready
        httpGet:
          path: /readyz
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 5
        failureThreshold: 3
      startupProbe:               # Disable liveness/readiness until startup succeeds
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 0
        periodSeconds: 5
        failureThreshold: 30      # 30 * 5s = 150s max startup time
```

| Probe | Purpose | Failure Action |
|---|---|---|
| **Liveness** | Detect deadlocked/hung processes | Restart container |
| **Readiness** | Detect temporary inability to serve traffic | Remove from endpoints |
| **Startup** | Protect slow-starting containers | Block liveness/readiness |

### Restart Policies

| Policy | Behavior | Used By |
|---|---|---|
| `Always` (default) | Restart on any termination | Deployments, StatefulSets |
| `OnFailure` | Restart only on non-zero exit | Jobs |
| `Never` | Never restart | Debug Pods, one-shot tasks |

### Garbage Collection

Kubernetes automatically garbage-collects terminated Pods, completed Jobs (via `ttlSecondsAfterFinished`),
and orphaned ReplicaSets. Set owner references correctly when building operators.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: data-export
spec:
  ttlSecondsAfterFinished: 3600   # Clean up 1 hour after completion
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: export
          image: registry.example.com/exporter:v1.2
```

---

## Best Practices

1. **Always set resource requests and limits** -- Use LimitRanges as a safety net for containers missing explicit resources.
2. **Configure all three probes** -- Startup probe for slow starters, liveness for deadlock detection, readiness for traffic management.
3. **Use the recommended label taxonomy** -- Adopt `app.kubernetes.io/*` labels consistently across all resources for tooling compatibility.
4. **Never deploy standalone Pods** -- Always use Deployments, StatefulSets, or Jobs so controllers handle restarts and scaling.
5. **Namespace per team or environment** -- Combine with ResourceQuotas and LimitRanges to prevent resource monopolization.
6. **Pin image tags to immutable digests or semver** -- Never use `latest` in production; use `image: app@sha256:abc123` or `app:v2.4.1`.
7. **Use native sidecars (1.28+) instead of multi-container hacks** -- `restartPolicy: Always` on init containers ensures correct ordering.
8. **Externalize configuration** -- Store all runtime config in ConfigMaps and Secrets; never bake into images.
9. **Apply dry-run before production changes** -- Use `kubectl apply --dry-run=server` to validate manifests server-side.
10. **Adopt GitOps for manifest management** -- Store all manifests in Git; use ArgoCD or Flux for automated sync (see [Helm](helm.md)).

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No resource requests/limits** | Pods get evicted unpredictably; noisy neighbors starve others | Set requests and limits on every container; enforce with LimitRange |
| **Using `latest` image tag** | Non-reproducible deployments; rollback impossible | Pin to semver tags or SHA256 digests |
| **Standalone Pods in production** | No self-healing, no scaling, no rollout strategy | Use Deployment, StatefulSet, or Job controllers |
| **Liveness probe hits expensive endpoint** | Probe failures cause cascading restarts under load | Use lightweight `/healthz` endpoint separate from business logic |
| **Same endpoint for liveness and readiness** | Cannot distinguish "needs restart" from "temporarily busy" | Implement separate `/healthz` (liveness) and `/readyz` (readiness) |
| **Secrets in ConfigMaps** | Sensitive data stored in plaintext without access controls | Use Secrets with encryption at rest; integrate external secret managers |
| **Hardcoded namespace in manifests** | Prevents manifest reuse across environments | Omit namespace in manifests; set via `kubectl -n` or Helm values |
| **Skipping startup probes** | Slow-starting apps killed by liveness probe before ready | Add startup probe with generous `failureThreshold` |

---

## Enforcement Checklist

- [ ] Every container has `resources.requests` and `resources.limits` defined
- [ ] LimitRange exists in every namespace
- [ ] ResourceQuota exists in every production namespace
- [ ] All production containers have liveness, readiness, and startup probes
- [ ] Image tags use semver or SHA256 digest (no `latest`, no mutable tags)
- [ ] Labels follow `app.kubernetes.io/*` taxonomy
- [ ] Secrets use `stringData` (auto-encoded) and encryption at rest is enabled
- [ ] Namespaces separate environments (dev, staging, production)
- [ ] `ttlSecondsAfterFinished` set on all Jobs
- [ ] Manifests pass `kubectl apply --dry-run=server` validation in CI
- [ ] No standalone Pods exist (enforced via admission policy)
- [ ] Native sidecars used instead of multi-container workarounds (K8s 1.28+)
