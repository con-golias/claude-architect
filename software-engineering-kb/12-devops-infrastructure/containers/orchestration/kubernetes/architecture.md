# Kubernetes Architecture

| Field | Value |
|---|---|
| **Domain** | DevOps > Containers > Kubernetes |
| **Importance** | High |
| **Last Updated** | 2026-03-10 |
| **Cross-references** | [Fundamentals](fundamentals.md), [Production Checklist](production-checklist.md) |

---

## Core Concepts

### Control Plane Components

The control plane makes global decisions about scheduling, detects and responds to
cluster events, and exposes the Kubernetes API.

#### API Server (kube-apiserver)

The front door to the cluster. Every `kubectl` command, controller reconciliation loop,
and kubelet heartbeat communicates through the API server. It validates and persists
resource state to etcd, enforces admission control, and serves the RESTful API.

- Horizontally scalable -- run multiple instances behind a load balancer for HA.
- All communication is TLS-encrypted.
- Supports OpenAPI v3 schema for custom resources.

#### etcd

Distributed key-value store that holds all cluster state. etcd is the single source of
truth -- if etcd is lost, the cluster is unrecoverable without backup.

```bash
# Snapshot etcd for backup
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%Y%m%d).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify snapshot integrity
ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-20260310.db --write-out=table
```

Key etcd considerations:

| Concern | Recommendation |
|---|---|
| **Backup frequency** | Every 15-30 minutes for production |
| **Storage** | SSD-backed volumes with low latency (<10ms p99) |
| **Compaction** | Enable auto-compaction (every 5 minutes) |
| **Size** | Monitor DB size; default max is 2 GB (increase to 8 GB if needed) |
| **Members** | Always odd number (3 or 5) for quorum |

#### Scheduler (kube-scheduler)

Watches for newly created Pods without an assigned node and selects the best node based on:

1. Filtering -- eliminate nodes that cannot run the Pod (resource insufficiency,
   taints, affinity rules, topology constraints).
2. Scoring -- rank remaining nodes by preference (spread, resource balance, affinity weight).

Extend scheduling with scheduler profiles or a secondary scheduler for specialized
workloads (GPU, high-memory).

#### Controller Manager (kube-controller-manager)

Runs controller loops that reconcile desired state with actual state. Key controllers:

| Controller | Responsibility |
|---|---|
| Deployment controller | Manages ReplicaSets for Deployments |
| ReplicaSet controller | Ensures correct Pod replica count |
| Node controller | Detects node failures, sets taints |
| Job controller | Creates Pods for Job completion |
| Endpoint controller | Populates Service endpoint slices |
| ServiceAccount controller | Creates default ServiceAccounts |

#### Cloud Controller Manager

Integrates cluster with cloud provider APIs (load balancers, node lifecycle, routes,
storage). Runs as a separate binary so core Kubernetes stays cloud-agnostic. Each
cloud provider ships its own implementation (aws-cloud-controller-manager, etc.).

### Node Components

#### kubelet

Primary agent on every node. Registers the node, watches for Pod assignments from
the API server, manages container lifecycle through the container runtime interface
(CRI), reports node and Pod status, executes probes.

#### kube-proxy

Maintains network rules on nodes. Implements Service abstraction using iptables,
IPVS, or nftables (default from 1.31+). In clusters running Cilium with kube-proxy
replacement, kube-proxy is not needed.

#### Container Runtime

Kubernetes requires a CRI-compliant runtime. containerd is the industry standard since
dockershim removal in Kubernetes 1.24.

| Runtime | Use Case |
|---|---|
| **containerd** | Default for EKS, GKE, AKS; production standard |
| **CRI-O** | Lightweight OCI runtime; popular in OpenShift |
| **gVisor (runsc)** | Sandboxed runtime for untrusted workloads |
| **Kata Containers** | VM-isolated containers for strong isolation |

### Cluster Networking Model

Kubernetes enforces three fundamental networking rules:

1. Every Pod gets its own IP address (no NAT between Pods).
2. Pods on any node can communicate with Pods on any other node without NAT.
3. Agents on a node can communicate with all Pods on that node.

A CNI (Container Network Interface) plugin implements these rules.

### CNI Plugin Comparison

| Plugin | Key Features | Best For |
|---|---|---|
| **Cilium** | eBPF-based, kube-proxy replacement, L7 policies, Hubble observability | Production clusters needing advanced NetworkPolicies and observability |
| **Calico** | BGP routing, eBPF mode, mature NetworkPolicy support | Hybrid/on-prem, multi-cloud; widest adoption |
| **Flannel** | Simple VXLAN overlay, minimal config | Dev/test clusters; simplest setup |
| **AWS VPC CNI** | Native VPC networking, Pod IPs from VPC subnets | EKS clusters (required for VPC integration) |
| **Azure CNI** | Native Azure VNet integration | AKS clusters |

Choose Cilium for greenfield clusters in 2025-2026. Its eBPF dataplane eliminates
iptables overhead, provides built-in observability (Hubble), and supports L7-aware
NetworkPolicies. Use Calico when BGP peering or broad platform support matters.

### CoreDNS for Service Discovery

CoreDNS serves as the cluster DNS server. Every Service gets a DNS record:

```text
<service-name>.<namespace>.svc.cluster.local
```

```bash
# From inside a Pod
nslookup api-server.production.svc.cluster.local

# Headless service returns Pod IPs directly
nslookup postgres-headless.database.svc.cluster.local
```

Tune CoreDNS for large clusters:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health { lameduck 5s }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
            ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf { max_concurrent 1000 }
        cache 30
        loop
        reload
        loadbalance
    }
```

### API Server Request Flow

Every request passes through these stages:

```
Client --> Authentication --> Authorization (RBAC) --> Admission Control --> Validation --> etcd
```

1. **Authentication** -- Client certificates, bearer tokens, OIDC, webhook.
2. **Authorization** -- RBAC (Role/ClusterRole bindings), ABAC, webhook.
3. **Admission Control** -- Mutating webhooks (inject sidecars, set defaults),
   then validating webhooks (enforce policies).
4. **Validation** -- Schema validation against OpenAPI spec.
5. **Persist** -- Write to etcd.

### Admission Controllers

Admission controllers intercept requests after authentication/authorization but
before persistence. Use them to enforce policies, inject defaults, and validate resources.

```yaml
# ValidatingAdmissionPolicy (K8s 1.30+ GA -- replaces many webhook needs)
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: require-resource-limits
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments"]
  validations:
    - expression: >
        object.spec.template.spec.containers.all(c,
          has(c.resources) && has(c.resources.limits) &&
          has(c.resources.limits.memory))
      message: "All containers must have memory limits"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: require-resource-limits-binding
spec:
  policyName: require-resource-limits
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        enforce-limits: "true"
```

For complex policies, deploy OPA Gatekeeper or Kyverno as webhook-based admission
controllers. See `08-security/infrastructure-security/container-security.md` for
security-focused admission policies.

### Custom Resource Definitions and Operators

CRDs extend the Kubernetes API with custom resource types. An operator is a controller
that watches CRDs and reconciles custom resources to their desired state.

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.example.com
spec:
  group: example.com
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine:
                  type: string
                  enum: [postgres, mysql]
                version:
                  type: string
                replicas:
                  type: integer
                  minimum: 1
  scope: Namespaced
  names:
    plural: databases
    singular: database
    kind: Database
    shortNames: [db]
```

Build operators with:

| Framework | Language | Maturity |
|---|---|---|
| **kubebuilder** | Go | Production-grade; CNCF recommended |
| **Operator SDK** | Go, Ansible, Helm | Built on kubebuilder; adds scaffolding |
| **Metacontroller** | Any (webhooks) | Lightweight; no Go required |
| **kopf** | Python | Good for Python teams |

### High Availability Setup

Production clusters require HA control planes:

```text
+---------------------------------------------------+
|                  Load Balancer                     |
|           (API server endpoint)                   |
+--------+------------------+------------------+----+
         |                  |                  |
   +-----v-----+     +-----v-----+     +-----v-----+
   | Master 1  |     | Master 2  |     | Master 3  |
   | API Srv   |     | API Srv   |     | API Srv   |
   | Scheduler |     | Scheduler |     | Scheduler |
   | Ctrl Mgr  |     | Ctrl Mgr  |     | Ctrl Mgr  |
   | etcd      |     | etcd      |     | etcd      |
   +-----------+     +-----------+     +-----------+
          (stacked etcd topology)
```

Two etcd topologies:

| Topology | Description | Trade-off |
|---|---|---|
| **Stacked** | etcd runs on control plane nodes | Fewer machines; coupled failure domains |
| **External** | etcd on dedicated machines | More resilient; more machines to manage |

Use stacked topology for managed Kubernetes. Use external etcd for self-managed
clusters with strict HA requirements.

### Managed vs Self-Managed Kubernetes

| Approach | Examples | When to Choose |
|---|---|---|
| **Managed (cloud)** | EKS, GKE, AKS | Default choice; control plane operated by provider |
| **GKE Autopilot** | GKE Autopilot | Fully managed nodes + control plane; pay per Pod |
| **Lightweight** | k3s, k0s, MicroK8s | Edge, IoT, development, resource-constrained |
| **Immutable** | Talos Linux | Security-focused; API-managed OS, no SSH |
| **Full self-managed** | kubeadm | Full control; requires deep operational expertise |

Start with managed Kubernetes. Only self-manage when compliance, air-gap, or cost
at massive scale demands it.

---

## Best Practices

1. **Run HA control planes with 3+ masters** -- Use odd-numbered etcd members for quorum tolerance (3 tolerates 1 failure, 5 tolerates 2).
2. **Automate etcd backups** -- Schedule snapshots every 15-30 minutes; store off-cluster in encrypted object storage; test restores quarterly.
3. **Choose Cilium for new clusters** -- eBPF-based networking provides superior performance, observability (Hubble), and L7 policy enforcement.
4. **Use ValidatingAdmissionPolicy over webhooks** -- CEL-based in-process validation (GA in 1.30) reduces latency and eliminates webhook availability concerns.
5. **Keep etcd on fast storage** -- SSD with <10ms p99 write latency; monitor `etcd_disk_wal_fsync_duration_seconds` and `etcd_server_slow_apply_total`.
6. **Use managed Kubernetes by default** -- EKS, GKE, or AKS eliminates control plane operations; invest operational effort in workloads instead.
7. **Implement CRDs with structural schemas** -- Define `openAPIV3Schema` for every CRD field to enable server-side validation and pruning.
8. **Separate etcd from workload storage** -- Dedicated disks for etcd prevent I/O contention with application workloads.
9. **Enable API server audit logging** -- Capture who did what and when; forward audit logs to SIEM for security monitoring.
10. **Version-lock control plane and nodes** -- Keep node kubelet within one minor version of API server; plan upgrades on a regular cadence (quarterly at minimum).

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Single control plane node** | Single point of failure; any disruption loses cluster management | Run 3+ control plane nodes with load-balanced API server |
| **No etcd backups** | Cluster is irrecoverable after etcd corruption or failure | Automate snapshots every 15-30 min; store encrypted off-cluster |
| **etcd on slow disks** | High latency causes leader elections, API timeouts, cluster instability | Use dedicated SSDs with <10ms p99 write latency |
| **Too many admission webhooks** | API server latency increases; webhook unavailability blocks all operations | Consolidate webhooks; migrate to ValidatingAdmissionPolicy (CEL) |
| **Running kube-proxy with Cilium** | Redundant network rules; iptables overhead on top of eBPF | Enable Cilium kube-proxy replacement; remove kube-proxy DaemonSet |
| **Self-managing without expertise** | Operational burden of upgrades, security patches, etcd maintenance | Use managed Kubernetes (EKS/GKE/AKS) unless specific constraints require self-management |
| **Ignoring CoreDNS scaling** | DNS latency spikes under load cause application timeouts | Enable CoreDNS autoscaling; use NodeLocal DNSCache for large clusters |
| **CRDs without structural schemas** | No server-side validation; invalid resources silently accepted | Define complete openAPIV3Schema for every CRD |

---

## Enforcement Checklist

- [ ] Control plane runs 3+ replicas behind a load balancer
- [ ] etcd backup automated and tested (restore drill quarterly)
- [ ] etcd runs on dedicated SSD storage with monitored latency
- [ ] CNI plugin deployed and validated (Cilium or Calico)
- [ ] CoreDNS scaled appropriately (autoscaler or NodeLocal DNSCache)
- [ ] API server audit logging enabled and forwarded to SIEM
- [ ] Admission controllers enforce resource limits and security policies
- [ ] CRDs have complete openAPIV3Schema validation
- [ ] Node kubelet version within one minor of API server version
- [ ] Cluster upgrade cadence defined (quarterly minimum)
- [ ] Network policies enforced at CNI level (not just defined)
- [ ] Managed Kubernetes used unless documented justification for self-managed
