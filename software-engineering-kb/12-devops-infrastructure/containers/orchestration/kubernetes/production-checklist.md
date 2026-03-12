# Kubernetes Production Checklist

| Field | Value |
|---|---|
| **Domain** | DevOps > Containers > Kubernetes |
| **Importance** | Critical |
| **Last Updated** | 2026-03-10 |
| **Cross-references** | [Architecture](architecture.md), [Helm](helm.md), [Container Security](../../../08-security/infrastructure-security/container-security.md), [Container Orchestration at Scale](../../../10-scalability/infrastructure/container-orchestration.md) |

---

## Core Concepts

This document is a comprehensive production-readiness checklist. Use it before
promoting any Kubernetes cluster or workload to production. Each category lists
requirements with rationale and implementation guidance.

### 1. Cluster Setup

#### High Availability Control Plane

Run 3+ control plane nodes across availability zones. Place an API server load balancer
in front. Use stacked etcd topology for managed Kubernetes; external etcd for
self-managed clusters with strict HA requirements.

```hcl
# EKS Terraform example -- multi-AZ control plane
resource "aws_eks_cluster" "production" {
  name     = "production"
  role_arn = aws_iam_role.cluster.arn
  version  = "1.31"

  vpc_config {
    subnet_ids              = var.private_subnet_ids  # Span 3 AZs
    endpoint_private_access = true
    endpoint_public_access  = false     # API server private only
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn     # Encrypt secrets in etcd
    }
    resources = ["secrets"]
  }
}
```

#### etcd Backup

Automate etcd snapshots every 15-30 minutes. Store encrypted in object storage
(S3, GCS) with cross-region replication. Test restores quarterly.

```bash
# For managed K8s, the provider handles etcd -- back up cluster resources with Velero
velero schedule create daily-backup \
  --schedule="0 */6 * * *" \
  --ttl 720h \
  --include-namespaces production,database \
  --storage-location aws-s3-backup
```

#### Version Policy

Maintain node kubelet versions within one minor of the API server. Plan upgrades
quarterly. Subscribe to the Kubernetes security mailing list.

| Component | Version Policy |
|---|---|
| Control plane | Latest stable minus one minor (e.g., 1.31 when 1.32 is latest) |
| Node pools | Same minor as control plane, or one behind during rolling upgrade |
| kubectl | Same minor as API server |

### 2. Workload Configuration

#### Resource Requests and Limits for ALL Pods

Every container must have `resources.requests` and `resources.limits`. Enforce with
LimitRange as a safety net.

```yaml
# Enforce namespace-wide defaults
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: production
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
```

#### Probes on Every Container

Configure liveness, readiness, and startup probes. See [Fundamentals](fundamentals.md)
for probe configuration details.

#### PodDisruptionBudgets

Protect workloads during voluntary disruptions (node drain, cluster upgrade).

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server-pdb
  namespace: production
spec:
  minAvailable: 2               # OR maxUnavailable: 1
  selector:
    matchLabels:
      app: api-server
```

Set PDBs for every production Deployment and StatefulSet. Use `minAvailable` for
critical services and `maxUnavailable` for flexible workloads.

#### Anti-Affinity Rules

Spread replicas across nodes and availability zones to survive failures.

```yaml
spec:
  template:
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: api-server
                topologyKey: kubernetes.io/hostname
            - weight: 50
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: api-server
                topologyKey: topology.kubernetes.io/zone
```

#### Topology Spread Constraints

Finer-grained control than anti-affinity. Enforce even distribution across zones.

```yaml
spec:
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: api-server
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: api-server
```

### 3. Networking

#### NetworkPolicies

Default-deny all traffic, then allow explicitly. See `08-security/infrastructure-security/container-security.md`
for comprehensive NetworkPolicy patterns including egress controls and DNS policies.

```yaml
# Default deny all ingress in namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
# Allow specific traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-system
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - port: 8080
          protocol: TCP
```

#### DNS Policy

Set `dnsPolicy: ClusterFirst` (default). For high-throughput services, deploy
NodeLocal DNSCache to reduce CoreDNS load and DNS latency.

#### Ingress TLS

Terminate TLS at the Ingress/Gateway. Use cert-manager for automated certificate
provisioning and renewal from Let's Encrypt or internal CAs.

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: platform@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

### 4. Storage

#### Backup Strategy

Back up PersistentVolumes using CSI snapshots or Velero. Test restores regularly.

```yaml
# VolumeSnapshot for CSI-backed PVs
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: postgres-snapshot
  namespace: database
spec:
  volumeSnapshotClassName: csi-aws-ebs
  source:
    persistentVolumeClaimName: data-postgres-0
```

#### StorageClass Defaults

Set a default StorageClass. Use `Retain` reclaim policy for production data.
Enable volume expansion for growth without downtime.

#### Volume Expansion

Enable `allowVolumeExpansion: true` on StorageClasses. Expand PVCs without
recreating Pods (CSI driver must support online expansion).

### 5. Observability

#### Metrics

Deploy metrics-server for HPA and `kubectl top`. Deploy Prometheus (or managed
equivalent) for application and cluster metrics.

```yaml
# Prometheus ServiceMonitor for automatic scraping
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-server
  namespace: production
spec:
  selector:
    matchLabels:
      app: api-server
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
```

#### Logging

Deploy a DaemonSet-based log collector (Fluent Bit, Vector) that ships logs to a
centralized system (Loki, Elasticsearch, CloudWatch). Structure logs as JSON.

#### Tracing

Instrument applications with OpenTelemetry. Deploy an OTel Collector as a DaemonSet
or sidecar to receive, process, and export traces to Jaeger, Tempo, or cloud backends.

#### Alerting

Define alerts for cluster and workload health:

```yaml
# PrometheusRule for critical alerts
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cluster-alerts
  namespace: monitoring
spec:
  groups:
    - name: kubernetes
      rules:
        - alert: PodCrashLooping
          expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Pod {{ $labels.pod }} is crash looping"
        - alert: PodNotReady
          expr: kube_pod_status_ready{condition="true"} == 0
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: "Pod {{ $labels.pod }} not ready for 10 minutes"
        - alert: NodeNotReady
          expr: kube_node_status_condition{condition="Ready",status="true"} == 0
          for: 5m
          labels:
            severity: critical
```

### 6. Security

This section cross-references `08-security/infrastructure-security/container-security.md`
which covers these topics in depth. Ensure the following are configured:

| Area | Requirement |
|---|---|
| **Pod Security Standards** | Enforce `restricted` profile via Pod Security Admission or Kyverno/OPA |
| **RBAC** | Least-privilege roles; no `cluster-admin` for workloads; audit bindings quarterly |
| **Image scanning** | Scan all images in CI (Trivy, Grype); block critical/high CVEs from deploying |
| **Secrets encryption** | Enable encryption at rest for etcd Secrets; use external-secrets-operator for cloud vaults |
| **Service accounts** | Disable auto-mount of SA tokens (`automountServiceAccountToken: false`) unless needed |
| **Runtime security** | Deploy Falco or Tetragon for runtime threat detection |

```yaml
# Pod Security: enforce restricted profile at namespace level
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 7. CI/CD Integration

Use GitOps for deployment automation. Store all manifests and Helm values in Git.
Deploy via ArgoCD or Flux. See [Helm](helm.md) for GitOps integration patterns.

```yaml
# ArgoCD ApplicationSet for multi-environment deployment
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: api-server
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: staging
            cluster: staging-cluster
            values: values-staging.yaml
          - env: production
            cluster: production-cluster
            values: values-production.yaml
  template:
    metadata:
      name: "api-server-{{ env }}"
    spec:
      project: "{{ env }}"
      source:
        repoURL: https://github.com/org/k8s-manifests.git
        targetRevision: main
        path: "apps/api-server"
        helm:
          valueFiles:
            - "{{ values }}"
      destination:
        server: "{{ cluster }}"
        namespace: "{{ env }}"
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

### 8. Cost Optimization

#### Right-Sizing

Use VPA recommendations to right-size resource requests. Monitor actual vs requested
resources with Prometheus queries. See `10-scalability/infrastructure/container-orchestration.md`
for HPA, VPA, and KEDA scaling patterns.

```bash
# Check resource waste
kubectl top pods -n production --sort-by=cpu
# Compare with requested resources
kubectl get pods -n production \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].resources.requests.cpu}{"\n"}{end}'
```

#### Spot / Preemptible Nodes

Use spot instances for fault-tolerant workloads (batch jobs, stateless services with
multiple replicas). Configure node selectors or taints.

```yaml
# Tolerate spot node taint
spec:
  tolerations:
    - key: "kubernetes.azure.com/scalesetpriority"
      operator: "Equal"
      value: "spot"
      effect: "NoSchedule"
  nodeSelector:
    kubernetes.io/os: linux
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 1
          preference:
            matchExpressions:
              - key: node.kubernetes.io/lifecycle
                operator: In
                values: [spot]
```

#### Cluster Autoscaler

Scale node pools based on pending Pods and utilization. Configure scale-down
thresholds to balance cost and responsiveness.

### 9. Disaster Recovery

#### etcd Snapshots

Already covered in Cluster Setup. Verify snapshots are encrypted, stored off-cluster,
and tested for restore.

#### Velero for Cluster Backup

```bash
# Install Velero with AWS plugin
velero install \
  --provider aws \
  --bucket velero-backups \
  --backup-location-config region=us-east-1 \
  --snapshot-location-config region=us-east-1

# Create backup schedule
velero schedule create production-daily \
  --schedule="0 3 * * *" \
  --include-namespaces production,database \
  --ttl 720h0m0s

# Restore from backup
velero restore create --from-backup production-daily-20260310030000
```

#### Multi-Cluster Strategy

For critical applications, deploy across multiple clusters. Use federated DNS
(Route53, Cloud DNS) or a global load balancer for failover.

| Strategy | Complexity | Recovery Time |
|---|---|---|
| Single cluster + Velero | Low | Hours (restore from backup) |
| Active-passive clusters | Medium | Minutes (DNS failover) |
| Active-active clusters | High | Seconds (automatic failover) |

### 10. Upgrade Strategy

#### Blue-Green Cluster Upgrades

For zero-downtime control plane upgrades, create a new cluster at the target version,
migrate workloads, then decommission the old cluster. This is the safest approach
for major version jumps.

#### Node Pool Rolling Updates

```bash
# EKS managed node group update
aws eks update-nodegroup-version \
  --cluster-name production \
  --nodegroup-name workers \
  --kubernetes-version 1.31

# Manual cordon and drain for self-managed nodes
kubectl cordon node-old-1
kubectl drain node-old-1 --ignore-daemonsets --delete-emptydir-data --grace-period=120
# ... provision replacement node ...
kubectl uncordon node-new-1
```

Always drain nodes gracefully. Respect PodDisruptionBudgets. Monitor for stuck Pods
during drain operations.

---

## Best Practices

1. **Enforce PodDisruptionBudgets on every production workload** -- Prevents cluster operations from causing downtime; blocks drain if budget violated.
2. **Use topology spread constraints over anti-affinity** -- Finer control over Pod distribution; supports zone and node spreading simultaneously.
3. **Default-deny NetworkPolicies in every namespace** -- Zero-trust networking; explicitly allow only required traffic paths.
4. **Automate certificate management with cert-manager** -- Eliminates manual certificate rotation; prevents expiration-related outages.
5. **Deploy Velero for cluster-level backup** -- Complements etcd snapshots; backs up resources and volumes with retention policies.
6. **Right-size with VPA recommendations before setting limits** -- Avoid over-provisioning (cost waste) and under-provisioning (OOMKill, throttling).
7. **Use spot instances for fault-tolerant workloads** -- 60-90% cost savings on batch jobs and multi-replica stateless services.
8. **Monitor with the RED method (Rate, Errors, Duration)** -- Actionable metrics for every service; alert on SLO violations, not raw thresholds.
9. **Plan quarterly upgrade cadence** -- Stay within supported versions; apply security patches within 7 days of release.
10. **Test disaster recovery annually** -- Run full restore drills from Velero backups; validate RTO/RPO targets.

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No PodDisruptionBudgets** | Cluster upgrades and node drains cause cascading outages | Define PDB for every production Deployment and StatefulSet |
| **Cluster running unsupported K8s version** | No security patches; increasing upgrade complexity | Upgrade quarterly; stay within N-2 supported versions |
| **No NetworkPolicies** | Any Pod can reach any other Pod; lateral movement risk | Deploy default-deny per namespace; allowlist required paths |
| **Manual certificate management** | Certificates expire unexpectedly; outages and security gaps | Deploy cert-manager with automated renewal |
| **No resource requests on Pods** | Scheduler makes poor decisions; noisy neighbors | Set requests and limits; enforce with LimitRange |
| **Velero not tested** | Backups exist but restore fails when actually needed | Run restore drills quarterly; validate data integrity |
| **Single-AZ node pool** | Availability zone failure takes down all workloads | Spread node pools across 3+ AZs; use topology constraints |
| **No observability stack** | Blind to failures, performance issues, and cost waste | Deploy metrics (Prometheus), logging (Loki), tracing (Tempo) |

---

## Enforcement Checklist

### Cluster Setup
- [ ] 3+ control plane nodes across availability zones
- [ ] etcd backup automated, encrypted, stored off-cluster
- [ ] etcd restore tested quarterly
- [ ] Kubernetes version within supported window (N-2)
- [ ] Upgrade cadence defined and followed (quarterly minimum)

### Workload Configuration
- [ ] Resource requests and limits on every container
- [ ] LimitRange in every namespace
- [ ] ResourceQuota in every production namespace
- [ ] Liveness, readiness, and startup probes on every container
- [ ] PodDisruptionBudget on every production Deployment/StatefulSet
- [ ] Topology spread constraints for zone-aware scheduling
- [ ] Anti-affinity rules prevent co-location of replicas

### Networking
- [ ] Default-deny NetworkPolicy in every namespace
- [ ] TLS terminated at Ingress/Gateway with cert-manager
- [ ] NodeLocal DNSCache deployed for large clusters
- [ ] Ingress rate limiting configured

### Storage
- [ ] Default StorageClass with `Retain` reclaim policy
- [ ] Volume expansion enabled on StorageClasses
- [ ] PV backup strategy implemented (CSI snapshots or Velero)

### Observability
- [ ] metrics-server deployed for HPA and kubectl top
- [ ] Prometheus (or equivalent) scraping all services
- [ ] Log collector DaemonSet shipping to centralized store
- [ ] OpenTelemetry tracing configured
- [ ] Alerts defined for PodCrashLooping, PodNotReady, NodeNotReady

### Security
- [ ] Pod Security Standards enforced (`restricted` profile)
- [ ] RBAC follows least-privilege principle
- [ ] Image scanning in CI blocks critical/high CVEs
- [ ] Secrets encrypted at rest in etcd
- [ ] Service account token auto-mount disabled by default
- [ ] Runtime security (Falco/Tetragon) deployed
- [ ] (Full security details: `08-security/infrastructure-security/container-security.md`)

### CI/CD
- [ ] GitOps controller (ArgoCD/Flux) manages all deployments
- [ ] No manual `kubectl apply` in production
- [ ] Helm charts versioned and validated in CI

### Cost Optimization
- [ ] VPA recommendations reviewed monthly
- [ ] Spot/preemptible nodes used for eligible workloads
- [ ] Cluster autoscaler configured with appropriate thresholds
- [ ] Resource waste monitored (requested vs actual usage)
- [ ] (Scaling patterns: `10-scalability/infrastructure/container-orchestration.md`)

### Disaster Recovery
- [ ] Velero backup schedule configured with retention
- [ ] Restore drill completed within last quarter
- [ ] RTO/RPO targets documented and validated
- [ ] Multi-cluster strategy defined for critical services
- [ ] Runbooks exist for common failure scenarios
