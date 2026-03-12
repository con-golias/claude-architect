# Service Mesh

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | DevOps > Containers > Orchestration                                  |
| Importance     | High                                                                 |
| Last Updated   | 2026-03                                                              |
| Cross-ref      | [Kubernetes Architecture](kubernetes/architecture.md), [Alternatives](alternatives.md), [Container Security](../../../08-security/infrastructure-security/container-security.md) |

---

## 1. Service Mesh Concept

A service mesh is a dedicated infrastructure layer for handling service-to-service communication. It moves networking logic (retries, timeouts, mTLS, observability) out of application code into the infrastructure.

### Architecture

```text
┌─────────────────────────────────────────────────┐
│                 Control Plane                     │
│  ┌───────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ Config    │  │ Certificate│  │ Service      │ │
│  │ API       │  │ Authority  │  │ Discovery    │ │
│  └─────┬─────┘  └─────┬─────┘  └──────┬───────┘ │
└────────┼──────────────┼───────────────┼──────────┘
         │              │               │
┌────────▼──────────────▼───────────────▼──────────┐
│                  Data Plane                       │
│  ┌─────────────┐         ┌─────────────┐         │
│  │ Pod A       │         │ Pod B       │         │
│  │ ┌─────┐    │  mTLS   │ ┌─────┐    │         │
│  │ │ App │◄──►│◄───────►│ │ App │    │         │
│  │ └─────┘    │         │ └─────┘    │         │
│  │ ┌───────┐  │         │ ┌───────┐  │         │
│  │ │ Proxy │  │         │ │ Proxy │  │         │
│  │ └───────┘  │         │ └───────┘  │         │
│  └─────────────┘         └─────────────┘         │
└──────────────────────────────────────────────────┘
```

### Why Use a Service Mesh

| Capability          | Without Mesh                         | With Mesh                            |
|---------------------|--------------------------------------|--------------------------------------|
| **mTLS**            | Each app manages certificates        | Automatic, transparent               |
| **Retries/Timeouts**| Library-level (per language)         | Infrastructure-level (uniform)       |
| **Traffic splitting**| Load balancer config changes        | Declarative weight-based routing     |
| **Observability**   | Instrumentation in every service     | Automatic L7 metrics and tracing     |
| **Circuit breaking**| Library code (Hystrix, etc.)         | Proxy configuration                  |
| **Access control**  | Application-level authz              | Network policy + identity-based      |

---

## 2. Istio

Istio is the most feature-rich service mesh, using Envoy as its data plane proxy.

### Architecture

```text
┌────────────────────────────────────────┐
│            Control Plane               │
│  ┌──────────────────────────────────┐  │
│  │             istiod               │  │
│  │  ┌───────┐ ┌──────┐ ┌────────┐  │  │
│  │  │Pilot  │ │Citadel│ │Galley  │  │  │
│  │  │(xDS)  │ │(CA)   │ │(Config)│  │  │
│  │  └───────┘ └──────┘ └────────┘  │  │
│  └──────────────────────────────────┘  │
└────────────┬───────────────────────────┘
             │ xDS API
┌────────────▼───────────────────────────┐
│            Data Plane                   │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ Pod          │  │ Pod          │    │
│  │ ┌────┐ ┌───┐│  │ ┌────┐ ┌───┐│    │
│  │ │App │ │Env││  │ │App │ │Env││    │
│  │ │    │ │oy ││  │ │    │ │oy ││    │
│  │ └────┘ └───┘│  │ └────┘ └───┘│    │
│  └──────────────┘  └──────────────┘    │
└────────────────────────────────────────┘
```

### Core Resources

#### VirtualService (Traffic Routing)

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api
spec:
  hosts:
    - api
  http:
    # Canary: 90/10 traffic split
    - route:
        - destination:
            host: api
            subset: stable
          weight: 90
        - destination:
            host: api
            subset: canary
          weight: 10
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
      timeout: 10s
```

#### DestinationRule (Load Balancing and Circuit Breaking)

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api
spec:
  host: api
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
    - name: stable
      labels:
        version: v1
    - name: canary
      labels:
        version: v2
```

#### Gateway (Ingress)

```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: api-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: api-tls-cert
      hosts:
        - api.example.com
```

#### Fault Injection (Chaos Testing)

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-fault
spec:
  hosts:
    - api
  http:
    - fault:
        delay:
          percentage:
            value: 10
          fixedDelay: 5s
        abort:
          percentage:
            value: 5
          httpStatus: 503
      route:
        - destination:
            host: api
```

### Istio Ambient Mesh (Sidecarless — GA in v1.24)

Ambient mode eliminates sidecars by splitting functionality into two layers:

```text
┌────────────────────────────────────────────────────┐
│                Ambient Mesh Architecture             │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  L7 Processing (Optional)                    │    │
│  │  ┌──────────────┐  ┌──────────────┐         │    │
│  │  │  Waypoint     │  │  Waypoint     │         │    │
│  │  │  Proxy (L7)   │  │  Proxy (L7)   │         │    │
│  │  └──────────────┘  └──────────────┘         │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  L4 Processing (Always Active)               │    │
│  │  ┌─────────────────────────────────────┐     │    │
│  │  │  ztunnel (per-node, zero-trust L4)  │     │    │
│  │  │  - mTLS encryption                   │     │    │
│  │  │  - L4 auth policy                    │     │    │
│  │  │  - Telemetry                         │     │    │
│  │  └─────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │ Pod  │  │ Pod  │  │ Pod  │  │ Pod  │  No sidecar│
│  │ (App)│  │ (App)│  │ (App)│  │ (App)│           │
│  └──────┘  └──────┘  └──────┘  └──────┘           │
└────────────────────────────────────────────────────┘
```

- **ztunnel**: Lightweight L4 per-node proxy handling mTLS and basic policy. Overhead reduced by 90%+ compared to sidecars.
- **Waypoint proxy**: Optional L7 proxy deployed per-service or per-namespace for advanced routing, retries, and authorization.

```bash
# Enable ambient mode for a namespace
kubectl label namespace myapp istio.io/dataplane-mode=ambient

# Deploy a waypoint proxy for L7 features
istioctl waypoint apply --namespace myapp --name api-waypoint
```

---

## 3. Linkerd

Linkerd is a lightweight, security-focused service mesh built with a Rust-based micro-proxy (linkerd2-proxy).

### Architecture

```text
┌────────────────────────────────┐
│       Control Plane            │
│  ┌──────────┐  ┌───────────┐  │
│  │destination│  │ identity  │  │
│  │ (routing) │  │ (mTLS CA) │  │
│  └──────────┘  └───────────┘  │
│  ┌──────────┐  ┌───────────┐  │
│  │ proxy-   │  │  policy   │  │
│  │ injector │  │ controller│  │
│  └──────────┘  └───────────┘  │
└───────────┬────────────────────┘
            │
┌───────────▼────────────────────┐
│        Data Plane              │
│  Per-pod Rust micro-proxy      │
│  - 5-10 MB memory per proxy    │
│  - 0.5-1.5ms p99 latency      │
│  - Auto-mTLS (zero config)     │
└────────────────────────────────┘
```

### Installation and Configuration

```bash
# Install Linkerd CLI
curl -fsL https://run.linkerd.io/install | sh

# Validate cluster prerequisites
linkerd check --pre

# Install control plane
linkerd install --crds | kubectl apply -f -
linkerd install | kubectl apply -f -

# Validate installation
linkerd check

# Inject sidecar into namespace
kubectl annotate namespace myapp linkerd.io/inject=enabled

# Restart pods to inject proxy
kubectl rollout restart deployment -n myapp
```

### TrafficSplit (Canary Deployments)

```yaml
apiVersion: split.smi-spec.io/v1alpha4
kind: TrafficSplit
metadata:
  name: api-canary
  namespace: myapp
spec:
  service: api
  backends:
    - service: api-stable
      weight: 900     # 90%
    - service: api-canary
      weight: 100     # 10%
```

### ServiceProfile (Per-Route Metrics and Retries)

```yaml
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  name: api.myapp.svc.cluster.local
  namespace: myapp
spec:
  routes:
    - name: GET /api/users
      condition:
        method: GET
        pathRegex: /api/users
      responseClasses:
        - condition:
            status:
              min: 500
              max: 599
          isFailure: true
    - name: POST /api/orders
      condition:
        method: POST
        pathRegex: /api/orders
      isRetryable: true
      timeout: 5s
```

### Authorization Policy

```yaml
apiVersion: policy.linkerd.io/v1beta3
kind: Server
metadata:
  name: api-server
  namespace: myapp
spec:
  podSelector:
    matchLabels:
      app: api
  port: http
  proxyProtocol: HTTP/2
---
apiVersion: policy.linkerd.io/v1beta3
kind: AuthorizationPolicy
metadata:
  name: api-authz
  namespace: myapp
spec:
  targetRef:
    group: policy.linkerd.io
    kind: Server
    name: api-server
  requiredAuthenticationRefs:
    - name: api-clients
      kind: MeshTLSAuthentication
      group: policy.linkerd.io
```

---

## 4. Cilium Service Mesh

Cilium leverages eBPF (extended Berkeley Packet Filter) for kernel-level networking, eliminating the need for sidecar proxies entirely.

### Architecture

```text
┌────────────────────────────────────────────────┐
│                 Cilium Agent (per node)          │
│  ┌──────────────────────────────────────────┐   │
│  │              eBPF Programs                │   │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │ L3/L4   │ │  L7      │ │ mTLS      │  │   │
│  │  │ Policy  │ │ Visibility│ │ (WireGuard│  │   │
│  │  │         │ │ (Envoy)  │ │  or IPsec) │  │   │
│  │  └─────────┘ └──────────┘ └───────────┘  │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │ Pod  │  │ Pod  │  │ Pod  │  │ Pod  │ No proxy│
│  └──────┘  └──────┘  └──────┘  └──────┘        │
└────────────────────────────────────────────────┘
     │
     ▼
┌────────────────┐
│    Hubble       │  ← eBPF-powered observability
│  (DNS, HTTP,    │
│   gRPC, Kafka)  │
└────────────────┘
```

### Key Features

- **No sidecar** — eBPF programs run in the Linux kernel, zero per-pod overhead
- **Protocol-aware** — enforces policies for HTTP, gRPC, Kafka, DNS at kernel level
- **WireGuard encryption** — transparent encryption without proxy overhead
- **Hubble** — kernel-level network observability (DNS, HTTP, gRPC, Kafka flows)

### Cilium Network Policy (L7-Aware)

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: api-policy
  namespace: myapp
spec:
  endpointSelector:
    matchLabels:
      app: api
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
      toPorts:
        - ports:
            - port: "3000"
              protocol: TCP
          rules:
            http:
              - method: GET
                path: "/api/users"
              - method: POST
                path: "/api/orders"
    - fromEndpoints:
        - matchLabels:
            app: worker
      toPorts:
        - ports:
            - port: "3000"
          rules:
            http:
              - method: POST
                path: "/api/internal/.*"
```

### Enable Cilium Service Mesh

```bash
# Install Cilium with service mesh features
cilium install --set kubeProxyReplacement=true

# Enable Hubble observability
cilium hubble enable --ui

# Enable L7 proxy (uses Envoy for L7, eBPF for L3/L4)
cilium config set enable-envoy-config true

# Enable transparent encryption
cilium config set encryption.enabled true
cilium config set encryption.type wireguard
```

### Hubble Observability

```bash
# Observe real-time network flows
hubble observe --namespace myapp

# Filter HTTP 5xx errors
hubble observe --namespace myapp --http-status-code 500-599

# View DNS queries
hubble observe --namespace myapp --type l7 --protocol dns

# Dashboard
hubble ui
```

---

## 5. Comparison Table

| Feature                  | Istio (Sidecar)     | Istio Ambient       | Linkerd              | Cilium              |
|--------------------------|---------------------|---------------------|----------------------|---------------------|
| **Proxy**                | Envoy sidecar       | ztunnel + waypoint  | linkerd2-proxy (Rust)| eBPF + optional Envoy |
| **mTLS**                 | Auto                | Auto (ztunnel)      | Auto (zero-config)   | WireGuard/IPsec     |
| **Latency overhead**     | 2-5 ms p99          | 1-2 ms (L4 only)   | 0.5-1.5 ms p99      | < 0.5 ms (L3/L4)   |
| **Memory per proxy**     | 40-100 MB           | Shared ztunnel      | 5-10 MB              | 0 (kernel-level)    |
| **500 services memory**  | 20-50 GB            | ~5-10 GB            | 2.5-5 GB             | Agent only (~1 GB)  |
| **L7 features**          | Full                | Via waypoints       | Moderate             | Via Envoy (optional)|
| **Traffic splitting**    | VirtualService      | VirtualService      | TrafficSplit (SMI)   | CiliumEnvoyConfig   |
| **Circuit breaking**     | DestinationRule     | DestinationRule     | No (use retries)     | Via Envoy           |
| **Fault injection**      | Yes                 | Via waypoints       | No                   | Via Envoy           |
| **Multi-cluster**        | Yes (complex)       | Alpha (v1.27)       | Yes (mirroring)      | ClusterMesh         |
| **Learning curve**       | High                | Medium              | Low                  | Medium              |
| **CNCF status**          | Graduated           | Graduated           | Graduated            | Graduated           |
| **Protocol-level policy**| HTTP, gRPC          | HTTP, gRPC          | HTTP, gRPC           | HTTP, gRPC, Kafka, DNS |
| **Best for**             | Feature-rich L7     | Migration path      | Simplicity, low overhead | Performance, security |

### Performance Benchmarks (Relative to No-Mesh Baseline)

| Metric              | Istio Sidecar | Istio Ambient (L4) | Linkerd    | Cilium eBPF |
|---------------------|---------------|---------------------|------------|-------------|
| Throughput impact   | -15-25%       | -5-10%              | -5-10%     | -1-3%       |
| Latency p50         | +1.5 ms       | +0.5 ms             | +0.4 ms    | +0.1 ms     |
| Latency p99         | +3-5 ms       | +1-2 ms             | +0.8-1.5 ms| +0.3 ms     |
| Memory overhead     | High          | Medium              | Low        | Minimal     |

---

## 6. When to Use a Service Mesh

### Use a Service Mesh When

- **Microservices > 10-15** — manual mTLS and observability become untenable
- **Zero-trust required** — regulatory or compliance mandates mutual TLS everywhere
- **Multi-team ownership** — enforce traffic policies without requiring app changes
- **Canary/progressive deployments** — need fine-grained traffic splitting
- **Compliance audit** — need uniform access logs and network-level telemetry

### Service Mesh is Overkill When

- **Fewer than 5 services** — add mTLS via application libraries
- **Monolith or modular monolith** — internal communication is in-process
- **Team lacks Kubernetes expertise** — mesh adds complexity on top of K8s
- **Performance-critical low-latency** — even sub-millisecond proxy overhead may matter (though Cilium mitigates this)
- **Budget-constrained** — sidecars (Istio, Linkerd) add 5-100 MB per pod

### Decision Guide

```text
Do you have > 10 microservices on Kubernetes?
  ├─ No  → Skip the mesh. Use K8s NetworkPolicy + app-level TLS.
  └─ Yes
      ├─ Need maximum L7 features (fault injection, traffic mirroring)?
      │   └─ Istio (Ambient mode for lower overhead)
      ├─ Need simplicity + minimal overhead?
      │   └─ Linkerd
      ├─ Need kernel-level performance + protocol-aware policy?
      │   └─ Cilium
      └─ Already using Cilium for CNI?
          └─ Enable Cilium service mesh features (no extra install)
```

---

## 7. Service Mesh with GitOps

### Istio + ArgoCD

```yaml
# ArgoCD Application for Istio VirtualService
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api-traffic
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/k8s-config
    path: overlays/production/istio
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: myapp
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Progressive Delivery with Flagger

Flagger automates canary analysis using service mesh metrics:

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: api
  namespace: myapp
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  service:
    port: 3000
    targetPort: 3000
    meshName: ""                  # auto-detect (Istio, Linkerd, etc.)
  analysis:
    interval: 1m
    threshold: 5                   # Max failed checks before rollback
    maxWeight: 50                  # Max canary traffic percentage
    stepWeight: 10                 # Increment per interval
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 1m
      - name: request-duration
        thresholdRange:
          max: 500                 # ms
        interval: 1m
    webhooks:
      - name: load-test
        url: http://flagger-loadtester/
        metadata:
          cmd: "hey -z 1m -q 10 -c 2 http://api-canary.myapp:3000/"
```

---

## Best Practices

1. **Start with mTLS only** — enable auto-mTLS before adding traffic management rules; get security baseline first.
2. **Use ambient/sidecarless modes for new deployments** — Istio Ambient (GA) and Cilium avoid per-pod proxy overhead.
3. **Monitor proxy resource usage** — set memory limits on sidecars; alert when approaching limits.
4. **Define per-route timeouts and retries** — avoid blanket timeouts; tune per endpoint based on SLOs.
5. **Use canary deployments via service mesh** — leverage traffic splitting with automated rollback (Flagger).
6. **Integrate with GitOps** — store all mesh configuration (VirtualService, DestinationRule) in version control.
7. **Adopt incrementally** — enable mesh per namespace, not cluster-wide; start with non-critical services.
8. **Choose based on overhead budget** — Cilium for minimal overhead, Linkerd for balance, Istio for features.
9. **Enable observability from day one** — use Hubble (Cilium), Linkerd Viz, or Kiali (Istio) for traffic visibility.
10. **Test mesh failures** — simulate control plane outages to verify data plane continues functioning (fail-open).

---

## Anti-Patterns

| Anti-Pattern                          | Problem                                        | Fix                                          |
|---------------------------------------|------------------------------------------------|----------------------------------------------|
| Enabling mesh cluster-wide on day one | Debugging avalanche, performance surprises     | Start with one namespace, expand gradually   |
| Ignoring sidecar resource limits      | Proxy OOMs crash pods, cascade failures        | Set memory/CPU limits on injected sidecars   |
| Blanket 30s timeout on all routes     | Slow endpoints timeout; fast ones wait too long | Per-route timeout tuned to endpoint SLO      |
| No canary analysis metrics            | Traffic shifts without validating health        | Use Flagger with success rate + latency gates |
| Running Istio sidecar for L4-only needs | Unnecessary overhead for simple mTLS          | Use Istio Ambient mode or Cilium             |
| Skipping mutual TLS                   | Service-to-service traffic unencrypted         | Enable mesh-wide mTLS (auto in all meshes)   |
| No fallback when control plane is down | New pods cannot connect if istiod is unavailable | Ensure data plane fail-open configuration  |
| Choosing Istio for a 3-service app    | Operational complexity exceeds benefit         | Use app-level TLS or skip mesh entirely      |

---

## Enforcement Checklist

- [ ] mTLS enabled mesh-wide with strict mode (no plaintext fallback)
- [ ] Sidecar/proxy resource limits configured and monitored
- [ ] Per-route timeouts, retries, and circuit breakers defined for critical paths
- [ ] Canary deployment pipeline configured with automated rollback
- [ ] All mesh configuration stored in Git and deployed via GitOps
- [ ] Observability dashboard deployed (Kiali, Hubble UI, or Linkerd Viz)
- [ ] Control plane high availability configured (multi-replica istiod, etc.)
- [ ] Mesh failover tested — verify data plane survives control plane outage
- [ ] Namespace-level adoption tracked with rollout plan for remaining services
- [ ] Mesh overhead measured — compare latency and memory vs pre-mesh baseline
