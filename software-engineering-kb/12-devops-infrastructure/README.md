# 12 — DevOps & Infrastructure

> Ship reliably, operate confidently — CI/CD pipelines, cloud platforms, containers, observability, and incident management for production-grade systems.

## Structure (6 folders, 49 files)

### ci-cd/ (8 files)
- [fundamentals.md](ci-cd/fundamentals.md) — CI vs CD, pipeline anatomy, trunk-based vs GitFlow, monorepo CI, maturity model
- [pipeline-design.md](ci-cd/pipeline-design.md) — Stage ordering, parallelism, caching, artifact passing, matrix builds, fail-fast
- [github-actions.md](ci-cd/github-actions.md) — Workflows, events, reusable workflows, OIDC, self-hosted runners, caching
- [gitlab-ci.md](ci-cd/gitlab-ci.md) — DAG pipelines, includes/extends, parent-child pipelines, merge trains, review apps
- [jenkins.md](ci-cd/jenkins.md) — Declarative/scripted pipelines, shared libraries, JCasC, Jenkins on Kubernetes
- [deployment-strategies.md](ci-cd/deployment-strategies.md) — Rolling, blue-green, canary, shadow, Argo Rollouts, zero-downtime DB migrations
- [feature-flags.md](ci-cd/feature-flags.md) — Flag types/lifecycle, LaunchDarkly/Unleash, percentage rollout, cleanup strategies
- [gitops.md](ci-cd/gitops.md) — GitOps principles, ArgoCD, Flux CD, secrets (SOPS/ESO), progressive delivery, multi-cluster

### cloud-providers/ (11 files)
- [provider-comparison.md](cloud-providers/provider-comparison.md) — Service mapping AWS↔Azure↔GCP, pricing, strengths, vendor lock-in, migration
- [vercel-netlify-railway.md](cloud-providers/vercel-netlify-railway.md) — PaaS platforms, Vercel/Netlify/Railway/Cloudflare/Fly.io, PaaS vs IaaS
- **aws/**
  - [core-services.md](cloud-providers/aws/core-services.md) — EC2, ECS/Fargate, Lambda, S3, RDS/Aurora, DynamoDB, VPC, SQS/SNS/EventBridge
  - [architecture-patterns.md](cloud-providers/aws/architecture-patterns.md) — Well-Architected, serverless, event-driven, data lake, multi-account, DR
  - [cost-optimization.md](cloud-providers/aws/cost-optimization.md) — Savings Plans, spot instances, Graviton, right-sizing, data transfer costs
- **azure/**
  - [core-services.md](cloud-providers/azure/core-services.md) — VMs, AKS, App Service, Functions, Cosmos DB, VNet, Service Bus, Entra ID
  - [architecture-patterns.md](cloud-providers/azure/architecture-patterns.md) — Landing Zones, hub-spoke, AKS microservices, Azure AI Studio, hybrid (Arc)
  - [cost-optimization.md](cloud-providers/azure/cost-optimization.md) — Reservations, Hybrid Benefit, Cosmos DB RU optimization, Cost Management
- **gcp/**
  - [core-services.md](cloud-providers/gcp/core-services.md) — Compute Engine, GKE/Cloud Run, Cloud SQL/Spanner/Firestore, Pub/Sub, IAM
  - [architecture-patterns.md](cloud-providers/gcp/architecture-patterns.md) — GKE Autopilot, Vertex AI/Gemini, BigQuery analytics, Anthos hybrid
  - [cost-optimization.md](cloud-providers/gcp/cost-optimization.md) — CUDs, SUDs, spot VMs, BigQuery editions, Cloud Run optimization

### containers/ (9 files)
- **docker/**
  - [fundamentals.md](containers/docker/fundamentals.md) — Namespaces/cgroups, images/containers/volumes, Compose, networking, CLI essentials
  - [dockerfile-best-practices.md](containers/docker/dockerfile-best-practices.md) — Base images (alpine/distroless/Chainguard), layers, BuildKit, scanning, tagging
  - [multi-stage-builds.md](containers/docker/multi-stage-builds.md) — Node/Go/Python/Rust/Java patterns, test stages, 60-80% size reduction
- **orchestration/**
  - [kubernetes/fundamentals.md](containers/orchestration/kubernetes/fundamentals.md) — Core objects, kubectl, probes, init/sidecar containers, resource management
  - [kubernetes/architecture.md](containers/orchestration/kubernetes/architecture.md) — Control plane, CNI plugins, CRDs/operators, HA, managed vs self-managed
  - [kubernetes/deployments-services.md](containers/orchestration/kubernetes/deployments-services.md) — Services, Ingress, Gateway API, StatefulSets, DaemonSets, PV/PVC, CSI
  - [kubernetes/helm.md](containers/orchestration/kubernetes/helm.md) — Charts, templates, Helmfile, OCI registries, Helm vs Kustomize, GitOps integration
  - [kubernetes/production-checklist.md](containers/orchestration/kubernetes/production-checklist.md) — HA, resource limits, PDBs, NetworkPolicies, observability, DR, upgrades
  - [alternatives.md](containers/orchestration/alternatives.md) — Docker Compose, Nomad, ECS/Fargate, Container Apps, Cloud Run, decision matrix
  - [service-mesh.md](containers/orchestration/service-mesh.md) — Istio (Ambient Mesh), Linkerd, Cilium eBPF, traffic management, mTLS

### incident-management/ (3 files)
- [incident-response.md](incident-management/incident-response.md) — Severity levels, incident lifecycle, ICS roles, mitigation patterns, runbooks
- [on-call.md](incident-management/on-call.md) — Rotation design, alert quality, escalation policies, runbooks, toil reduction, burnout
- [postmortems.md](incident-management/postmortems.md) — Blameless culture, 5 Whys, timeline reconstruction, action tracking, learning reviews

### infrastructure-as-code/ (4 files)
- [terraform.md](infrastructure-as-code/terraform.md) — HCL, state management, modules, lifecycle rules, workspaces, OpenTofu
- [pulumi.md](infrastructure-as-code/pulumi.md) — TypeScript/Python/Go IaC, Automation API, testing, CrossGuard, ESC
- [cloudformation.md](infrastructure-as-code/cloudformation.md) — Templates, nested stacks, StackSets, CDK relationship, SAM, Guard
- [best-practices.md](infrastructure-as-code/best-practices.md) — Repository structure, state isolation, CI/CD for infra, Infracost, testing pyramid

### monitoring-observability/ (13 files)
- [three-pillars.md](monitoring-observability/three-pillars.md) — Metrics/logs/traces, signal correlation, OTel Collector, observability maturity
- [dashboards.md](monitoring-observability/dashboards.md) — RED/USE methods, Golden Signals, Grafana dashboard-as-code, Grafonnet
- **logging/**
  - [structured-logging.md](monitoring-observability/logging/structured-logging.md) — JSON logging, pino/structlog/slog, correlation IDs, PII redaction, OTel bridge
  - [log-aggregation.md](monitoring-observability/logging/log-aggregation.md) — Fluent Bit, Vector, OTel Collector, routing, retention tiers, cost
  - [elk-stack.md](monitoring-observability/logging/elk-stack.md) — Elasticsearch/Logstash/Kibana, Grafana Loki/LogQL, ELK vs Loki comparison
- **metrics/**
  - [application-metrics.md](monitoring-observability/metrics/application-metrics.md) — Counter/gauge/histogram, RED/USE implementation, OTel Metrics API, cardinality
  - [prometheus-grafana.md](monitoring-observability/metrics/prometheus-grafana.md) — PromQL, recording rules, ServiceMonitor, Grafana Alloy, Mimir vs Thanos
  - [alerting.md](monitoring-observability/metrics/alerting.md) — Alertmanager, SLO burn-rate alerting, Grafana Unified Alerting, alert-as-code
- **tracing/**
  - [distributed-tracing.md](monitoring-observability/tracing/distributed-tracing.md) — W3C Trace Context, propagation, sampling strategies, service maps
  - [opentelemetry.md](monitoring-observability/tracing/opentelemetry.md) — OTel Collector, auto/manual instrumentation, SDK config, K8s Operator
  - [jaeger-zipkin.md](monitoring-observability/tracing/jaeger-zipkin.md) — Jaeger v2, Zipkin, Grafana Tempo/TraceQL, backend comparison
- **error-tracking/**
  - [error-handling-strategy.md](monitoring-observability/error-tracking/error-handling-strategy.md) — Error classification, grouping, source maps, release tracking, error SLOs
  - [sentry.md](monitoring-observability/error-tracking/sentry.md) — SDK setup (TS/Python/Go), React integration, Replay, releases, alternatives

## Cross-References

| Topic | This Section | Related Section |
|-------|-------------|----------------|
| Pipeline security | ci-cd/*.md | [08-security/infrastructure-security/ci-cd-pipeline-security.md](../08-security/infrastructure-security/ci-cd-pipeline-security.md) |
| Container security | — (removed, fully covered) | [08-security/infrastructure-security/container-security.md](../08-security/infrastructure-security/container-security.md) |
| IaC security scanning | infrastructure-as-code/best-practices.md | [08-security/infrastructure-security/iac-security.md](../08-security/infrastructure-security/iac-security.md) |
| Cloud security/IAM | cloud-providers/*.md | [08-security/infrastructure-security/cloud-security.md](../08-security/infrastructure-security/cloud-security.md) |
| SLI/SLO/SLA | — (removed, fully covered) | [09-performance/performance-culture/sli-slo-sla.md](../09-performance/performance-culture/sli-slo-sla.md) |
| APM & profiling | monitoring-observability/tracing/*.md | [09-performance/profiling-tools/](../09-performance/profiling-tools/) |
| K8s autoscaling | containers/orchestration/kubernetes/*.md | [10-scalability/infrastructure/container-orchestration.md](../10-scalability/infrastructure/container-orchestration.md) |
| Monitoring at scale | monitoring-observability/*.md | [10-scalability/capacity-planning/monitoring-at-scale.md](../10-scalability/capacity-planning/monitoring-at-scale.md) |
| FinOps/cost planning | cloud-providers/*/cost-optimization.md | [10-scalability/capacity-planning/cost-optimization.md](../10-scalability/capacity-planning/cost-optimization.md) |
| CI test integration | ci-cd/pipeline-design.md | [11-testing/test-automation/ci-integration.md](../11-testing/test-automation/ci-integration.md) |
| Security incidents | incident-management/incident-response.md | [08-security/devsecops/incident-response.md](../08-security/devsecops/incident-response.md) |
