# Kubernetes Deployments and Services

| Field | Value |
|---|---|
| **Domain** | DevOps > Containers > Kubernetes |
| **Importance** | Critical |
| **Last Updated** | 2026-03-10 |
| **Cross-references** | [Fundamentals](fundamentals.md), [Helm](helm.md) |

---

## Core Concepts

### Deployment Strategies

#### RollingUpdate (Default)

Gradually replaces old Pods with new ones. Zero-downtime when readiness probes
are configured correctly.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2            # Max Pods above desired count during update
      maxUnavailable: 1      # Max Pods unavailable during update
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
        - name: api
          image: registry.example.com/api:v2.5.0
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            periodSeconds: 5
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]  # Drain in-flight requests
      terminationGracePeriodSeconds: 30
```

Set `maxSurge` to control rollout speed. Set `maxUnavailable: 0` for strict availability.
Always add a `preStop` hook to allow load balancers to deregister the Pod.

#### Recreate

Terminates all existing Pods before creating new ones. Use only when the application
cannot tolerate two versions running simultaneously (schema-breaking database changes).

```yaml
strategy:
  type: Recreate
```

### Service Types

| Type | Scope | Use Case |
|---|---|---|
| **ClusterIP** | Internal only | Default; inter-service communication |
| **NodePort** | External via node IP:port | Development; testing |
| **LoadBalancer** | External via cloud LB | Production external traffic |
| **ExternalName** | DNS CNAME alias | Proxy to external services |

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: production
spec:
  type: ClusterIP
  selector:
    app: api-server
  ports:
    - name: http
      port: 80               # Service port
      targetPort: 8080        # Container port
      protocol: TCP
    - name: grpc
      port: 9090
      targetPort: 9090
```

### Ingress Controllers

Ingress controllers manage external HTTP/HTTPS access to Services. Choose based on
features, performance, and ecosystem.

| Controller | Strengths | Best For |
|---|---|---|
| **ingress-nginx** | Mature, widely adopted, extensive annotations | General purpose; most clusters |
| **Traefik** | Auto-discovery, middleware, Let's Encrypt built-in | Smaller teams; rapid iteration |
| **Kong Ingress** | API gateway features, plugins, rate limiting | API-first architectures |
| **AWS ALB Ingress** | Native ALB integration, WAF, target groups | EKS clusters |
| **Cilium Ingress** | eBPF-based, integrated with Cilium CNI | Clusters already running Cilium |

#### Ingress Resource

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls-cert
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /v1
            pathType: Prefix
            backend:
              service:
                name: api-server
                port:
                  number: 80
          - path: /v2
            pathType: Prefix
            backend:
              service:
                name: api-server-v2
                port:
                  number: 80
```

### Gateway API

Gateway API is the successor to Ingress, providing richer routing, role-oriented
design, and protocol extensibility. GA since Kubernetes 1.29.

```yaml
# Infrastructure admin creates the Gateway
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: production-gateway
  namespace: gateway-infra
spec:
  gatewayClassName: cilium        # or nginx, istio, traefik
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: wildcard-tls
      allowedRoutes:
        namespaces:
          from: Selector
          selector:
            matchLabels:
              gateway-access: "true"
---
# Application team creates HTTPRoute
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
  namespace: production
spec:
  parentRefs:
    - name: production-gateway
      namespace: gateway-infra
  hostnames:
    - api.example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /v2
      backendRefs:
        - name: api-server-v2
          port: 80
          weight: 90
        - name: api-server-v3
          port: 80
          weight: 10            # Canary traffic splitting
    - matches:
        - path:
            type: PathPrefix
            value: /v1
      backendRefs:
        - name: api-server
          port: 80
```

Prefer Gateway API over Ingress for new clusters. Gateway API supports traffic
splitting, header-based routing, gRPC routing (GRPCRoute), and cross-namespace
references natively.

### StatefulSets

Use StatefulSets for workloads requiring stable network identity, ordered deployment,
and persistent storage (databases, message brokers, distributed systems).

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: database
spec:
  serviceName: postgres-headless    # Required headless service
  replicas: 3
  podManagementPolicy: OrderedReady  # Sequential startup (default)
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
              name: postgres
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 100Gi
```

StatefulSet guarantees:

| Guarantee | Description |
|---|---|
| Stable network ID | Pod `postgres-0`, `postgres-1`, `postgres-2` with DNS `postgres-0.postgres-headless` |
| Ordered deployment | Pods created 0,1,2 and terminated 2,1,0 |
| Persistent storage | Each Pod gets its own PVC that survives Pod rescheduling |

#### Headless Service for StatefulSets

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
  namespace: database
spec:
  clusterIP: None               # Headless -- DNS returns Pod IPs directly
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
```

### DaemonSets

Run one Pod per node for node-level agents (log collection, monitoring, networking).

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: observability
spec:
  selector:
    matchLabels:
      app: fluent-bit
  template:
    metadata:
      labels:
        app: fluent-bit
    spec:
      tolerations:
        - operator: Exists       # Run on all nodes including tainted
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:3.1
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 256Mi
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
```

### Jobs and CronJobs

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: data-migration
spec:
  backoffLimit: 3               # Max retries
  activeDeadlineSeconds: 600    # Timeout after 10 minutes
  ttlSecondsAfterFinished: 3600
  parallelism: 4                # Run 4 Pods concurrently
  completions: 10               # Total successful completions needed
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: migrate
          image: registry.example.com/migrator:v1.3
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-backup
spec:
  schedule: "0 2 * * *"         # 2 AM daily
  concurrencyPolicy: Forbid     # Skip if previous still running
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: registry.example.com/backup:v2.0
```

| ConcurrencyPolicy | Behavior |
|---|---|
| `Allow` | Concurrent executions permitted |
| `Forbid` | Skip new run if previous is active |
| `Replace` | Cancel running job, start new |

### PersistentVolumes and PersistentVolumeClaims

#### Dynamic Provisioning with StorageClasses

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com    # CSI driver
parameters:
  type: gp3
  iops: "5000"
  throughput: "250"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer  # Bind to AZ of the Pod
reclaimPolicy: Retain           # Keep volume after PVC deletion
allowVolumeExpansion: true
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
  namespace: production
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 50Gi
```

| Access Mode | Description |
|---|---|
| `ReadWriteOnce` (RWO) | Single node read/write |
| `ReadOnlyMany` (ROX) | Multiple nodes read-only |
| `ReadWriteMany` (RWX) | Multiple nodes read/write (NFS, EFS, CephFS) |
| `ReadWriteOncePod` (RWOP) | Single Pod read/write (CSI only, K8s 1.29+) |

Use `WaitForFirstConsumer` volume binding mode to ensure PVs are provisioned in the
same availability zone as the scheduled Pod.

### Service Mesh Integration Points

Service meshes (Istio, Linkerd, Cilium Service Mesh) integrate at three levels:

1. **Sidecar/Ambient proxy** -- Transparent L7 proxy injected per Pod (Istio sidecar)
   or per node (Istio ambient mode, Cilium).
2. **Traffic management** -- VirtualService, DestinationRule, or HTTPRoute for
   canary deployments, circuit breaking, retries.
3. **mTLS** -- Automatic mutual TLS between all services.

Prefer ambient mesh (Istio 1.22+) or Cilium Service Mesh over sidecar injection
to reduce per-Pod resource overhead.

---

## Best Practices

1. **Use RollingUpdate with `maxUnavailable: 0` for critical services** -- Ensures no capacity reduction during deployments; combine with PodDisruptionBudgets.
2. **Add `preStop` lifecycle hooks** -- Sleep 5-15 seconds to allow load balancer deregistration before termination; prevents dropped connections.
3. **Adopt Gateway API over Ingress** -- Gateway API (GA in 1.29) provides richer routing, traffic splitting, and role separation; migrate incrementally.
4. **Set `WaitForFirstConsumer` on StorageClasses** -- Prevents cross-AZ volume binding failures; volume provisioned in the Pod's AZ.
5. **Use headless Services for StatefulSets** -- Enables direct Pod-to-Pod DNS resolution required for database clustering protocols.
6. **Set `concurrencyPolicy: Forbid` on CronJobs by default** -- Prevents job pile-up when execution exceeds schedule interval.
7. **Always set `ttlSecondsAfterFinished` on Jobs** -- Prevents orphaned completed Pods from consuming cluster resources.
8. **Pin StorageClass `reclaimPolicy: Retain` for production data** -- Prevents accidental data loss when PVCs are deleted; manually clean up volumes.
9. **Define PodDisruptionBudgets for all production workloads** -- Prevents voluntary disruptions (node drain, upgrades) from killing too many Pods simultaneously.
10. **Use `ReadWriteOncePod` (RWOP) when available** -- Strongest access control; prevents multiple Pods from mounting the same volume simultaneously.

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No preStop hook** | In-flight requests dropped during rolling updates | Add `preStop` sleep (5-15s) and set adequate `terminationGracePeriodSeconds` |
| **LoadBalancer per Service** | Each Service gets a cloud load balancer ($$$, IP exhaustion) | Use Ingress controller or Gateway API to consolidate behind one LB |
| **StatefulSet for stateless workloads** | Unnecessary ordering constraints slow deployments | Use Deployment for stateless; StatefulSet only for stable identity/storage |
| **No PodDisruptionBudget** | Node drain during upgrade kills all replicas simultaneously | Define PDB with `minAvailable` or `maxUnavailable` for every production workload |
| **CronJob without `activeDeadlineSeconds`** | Stuck jobs run indefinitely, consuming resources | Set `activeDeadlineSeconds` on the Job template spec |
| **`Delete` reclaim policy on production StorageClass** | PVC deletion permanently destroys production data | Use `Retain` for production; `Delete` only for ephemeral/dev environments |
| **Ingress without TLS** | Traffic exposed in plaintext; security and compliance violation | Always configure TLS on Ingress/Gateway; use cert-manager for auto-rotation |
| **Single-replica StatefulSet in production** | No redundancy for stateful workloads; downtime during node failure | Run 3+ replicas with application-level replication (Patroni, etc.) |

---

## Enforcement Checklist

- [ ] All Deployments use `RollingUpdate` strategy with explicit `maxSurge`/`maxUnavailable`
- [ ] Every production Deployment has a PodDisruptionBudget
- [ ] `preStop` hooks configured on containers receiving traffic
- [ ] `terminationGracePeriodSeconds` set >= drain time + preStop delay
- [ ] Ingress/Gateway enforces TLS with auto-renewed certificates (cert-manager)
- [ ] StorageClasses use `WaitForFirstConsumer` and `Retain` reclaim policy
- [ ] All Jobs have `ttlSecondsAfterFinished` and `activeDeadlineSeconds`
- [ ] CronJobs set `concurrencyPolicy: Forbid` unless concurrent execution is intended
- [ ] StatefulSets have headless Services and `volumeClaimTemplates`
- [ ] Gateway API used for new routing; Ingress migrated incrementally
- [ ] Service mesh mTLS enabled for inter-service traffic
- [ ] No `LoadBalancer` Services exposed without Ingress/Gateway consolidation
