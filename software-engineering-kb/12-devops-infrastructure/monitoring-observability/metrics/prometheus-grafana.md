# Prometheus & Grafana

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Observability > Metrics                                                |
| **Importance**     | Critical                                                                        |
| **Scope**          | Prometheus architecture, PromQL, recording rules, Kubernetes CRDs, Grafana stack, long-term storage |
| **Audience**       | SREs, DevOps Engineers, Platform Engineers                                       |
| **Key Insight**    | Deploy kube-prometheus-stack for production Kubernetes; use Mimir or Thanos for multi-cluster long-term storage; adopt Grafana Alloy as the unified OTel-native collector |
| **Cross-ref**      | [Application Metrics](application-metrics.md), [Alerting](alerting.md), [Dashboards](../dashboards.md), [Distributed Tracing](../tracing/distributed-tracing.md) |

> **Scope Distinction:** This file covers **Prometheus/Grafana infrastructure, PromQL, and ecosystem tooling**. For metric types and instrumentation code, see [application-metrics.md](application-metrics.md). For alerting rules and Alertmanager configuration, see [alerting.md](alerting.md).

---

## Core Concepts

### Prometheus Architecture

```text
┌──────────────┐     scrape      ┌──────────────────┐
│  Targets     │◄────────────────│   Prometheus      │
│  /metrics    │    (pull HTTP)   │                  │
└──────────────┘                 │  ┌─────────────┐ │    ┌──────────────┐
                                 │  │   TSDB      │ │───►│ Alertmanager │
┌──────────────┐     scrape      │  │ (local disk)│ │    └──────────────┘
│  Targets     │◄────────────────│  └─────────────┘ │
│  /metrics    │                 │  ┌─────────────┐ │    ┌──────────────┐
└──────────────┘                 │  │  PromQL     │ │───►│   Grafana    │
                                 │  │  Engine     │ │    └──────────────┘
┌──────────────┐  push (OTLP)    │  └─────────────┘ │
│  OTel        │────────────────►│  ┌─────────────┐ │    ┌──────────────┐
│  Collector   │                 │  │  Remote     │ │───►│ Mimir/Thanos │
└──────────────┘                 │  │  Write      │ │    │ (long-term)  │
                                 │  └─────────────┘ │    └──────────────┘
                                 └──────────────────┘

Key components:
  - Retrieval:    Scrapes targets at configured intervals (default 15s)
  - TSDB:         Local time-series database (~15-day retention default)
  - PromQL:       Query language for selecting and aggregating time series
  - Alertmanager: Handles alert routing, grouping, deduplication, silencing
  - Remote Write: Sends samples to external long-term storage (Mimir, Thanos, Cortex)
```

### Prometheus Configuration

```yaml
# prometheus.yml -- Production configuration
global:
  scrape_interval: 15s          # Default scrape frequency
  evaluation_interval: 15s      # Rule evaluation frequency
  scrape_timeout: 10s           # Per-scrape timeout
  external_labels:
    cluster: "production-us-east-1"
    environment: "production"

# Recording and alerting rules
rule_files:
  - "/etc/prometheus/rules/*.yml"

# Alertmanager targets
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

# Scrape configurations
scrape_configs:
  # Prometheus self-monitoring
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  # Node Exporter (infrastructure metrics)
  - job_name: "node-exporter"
    static_configs:
      - targets: ["node-exporter:9100"]

  # Application services (service discovery via DNS)
  - job_name: "api-service"
    dns_sd_configs:
      - names: ["api.service.consul"]
        type: "SRV"
    relabel_configs:
      - source_labels: [__meta_dns_name]
        target_label: service

  # Kubernetes pods with annotation-based discovery
  - job_name: "kubernetes-pods"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      # Only scrape pods with prometheus.io/scrape annotation
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port,
                         __address__]
        action: replace
        regex: (\d+);([^:]+)(?::\d+)?
        replacement: $2:$1
        target_label: __address__
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod

# Remote write to long-term storage
remote_write:
  - url: "http://mimir:9009/api/v1/push"
    queue_config:
      max_samples_per_send: 5000
      batch_send_deadline: 5s
      max_shards: 200
```

### PromQL Deep-Dive

**Selectors and matchers:**

```promql
# Instant vector -- latest value for each matching series
http_requests_total{job="api", status_code=~"5.."}

# Range vector -- values over a time window
http_requests_total{job="api"}[5m]

# Matchers: =  exact, != not equal, =~ regex, !~ negative regex
http_requests_total{method=~"GET|POST", path!~"/health.*"}

# Offset -- look back in time
http_requests_total offset 1h
```

**Essential functions:**

```promql
# rate() -- per-second rate of a counter over a range (MOST COMMON)
rate(http_requests_total[5m])

# increase() -- total increase over a range (human-friendly)
increase(http_requests_total[1h])

# irate() -- instant rate using last two samples (spiky, use for dashboards only)
irate(http_requests_total[5m])

# histogram_quantile() -- compute percentile from histogram buckets
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# absent() -- returns 1 if no series matches (dead man's switch)
absent(up{job="api"})

# predict_linear() -- linear prediction (capacity planning)
predict_linear(node_filesystem_avail_bytes[6h], 24 * 3600)

# changes() -- number of value changes (detect flapping)
changes(up{job="api"}[1h])
```

**Aggregation operators:**

```promql
# Sum across all instances
sum(rate(http_requests_total[5m])) by (method, status_code)

# Average memory across pods
avg(container_memory_working_set_bytes) by (namespace, pod)

# Top 5 services by request rate
topk(5, sum(rate(http_requests_total[5m])) by (job))

# Count series per job
count(up) by (job)

# Quantile across instances (NOT histogram_quantile -- different purpose)
quantile(0.95, rate(http_requests_total[5m]))

# Group left join -- enrich metrics with metadata
sum(rate(http_requests_total[5m])) by (pod)
  * on(pod) group_left(team, service)
  kube_pod_labels{label_team!=""}
```

**Common PromQL patterns:**

```promql
# Error rate percentage
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m]))
* 100

# Availability (success ratio)
1 - (
  sum(rate(http_requests_total{status_code=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))
)

# Saturation -- queue depth as percentage of capacity
sum(thread_pool_queue_size) by (instance)
/ sum(thread_pool_max_size) by (instance)

# Apdex score (satisfied < 0.3s, tolerating < 1.2s)
(
  sum(rate(http_request_duration_seconds_bucket{le="0.3"}[5m]))
  + sum(rate(http_request_duration_seconds_bucket{le="1.2"}[5m]))
) / 2
/ sum(rate(http_request_duration_seconds_count[5m]))
```

### Recording Rules

Pre-compute expensive PromQL queries as new time series. Use recording rules for dashboard queries and alert conditions to reduce query-time load.

```yaml
# rules/recording-rules.yml
groups:
  - name: http_red_metrics
    interval: 15s
    rules:
      # Request rate by service
      - record: job:http_requests:rate5m
        expr: sum(rate(http_server_requests_total[5m])) by (job)

      # Error rate by service
      - record: job:http_errors:rate5m
        expr: |
          sum(rate(http_server_requests_total{status_code=~"5.."}[5m])) by (job)

      # Error ratio by service
      - record: job:http_error_ratio:rate5m
        expr: |
          job:http_errors:rate5m / job:http_requests:rate5m

      # p50 latency by service
      - record: job:http_request_duration_seconds:p50
        expr: |
          histogram_quantile(0.5,
            sum(rate(http_server_request_duration_seconds_bucket[5m])) by (job, le)
          )

      # p99 latency by service
      - record: job:http_request_duration_seconds:p99
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_server_request_duration_seconds_bucket[5m])) by (job, le)
          )

  - name: slo_error_budget
    interval: 1m
    rules:
      # 30-day error budget remaining
      - record: job:slo_error_budget_remaining:ratio
        expr: |
          1 - (
            (1 - job:http_error_ratio:rate5m)
            / 0.999
          )
```

**Recording rule naming convention:** `level:metric:operations` -- e.g., `job:http_requests:rate5m`.

### Prometheus on Kubernetes (kube-prometheus-stack)

The kube-prometheus-stack Helm chart deploys Prometheus Operator, Alertmanager, Grafana, and default dashboards/rules via CRDs.

```yaml
# ServiceMonitor -- tell Prometheus to scrape a service
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-service
  namespace: monitoring
  labels:
    release: kube-prometheus-stack  # Must match Prometheus selector
spec:
  namespaceSelector:
    matchNames: ["production"]
  selector:
    matchLabels:
      app: api-service
  endpoints:
    - port: http-metrics          # Name of the Service port
      interval: 15s
      path: /metrics
      relabelings:
        - sourceLabels: [__meta_kubernetes_pod_label_version]
          targetLabel: version
```

```yaml
# PodMonitor -- scrape pods directly (no Service needed)
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: batch-jobs
  namespace: monitoring
spec:
  namespaceSelector:
    matchNames: ["batch"]
  selector:
    matchLabels:
      app: batch-processor
  podMetricsEndpoints:
    - port: metrics
      interval: 30s
```

```yaml
# PrometheusRule -- deploy alerting and recording rules as CRDs
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: api-alerts
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: api.rules
      rules:
        - alert: HighErrorRate
          expr: job:http_error_ratio:rate5m{job="api-service"} > 0.01
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "High error rate on {{ $labels.job }}"
            description: "Error rate is {{ $value | humanizePercentage }} (> 1%)"
            runbook_url: "https://wiki.example.com/runbooks/high-error-rate"
```

### Grafana Setup

**Data source provisioning (GitOps-friendly):**

```yaml
# grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    jsonData:
      httpMethod: POST
      timeInterval: "15s"
      exemplarTraceIdDestinations:
        - name: traceID
          datasourceUid: tempo

  - name: Tempo
    type: tempo
    uid: tempo
    access: proxy
    url: http://tempo:3200

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    jsonData:
      derivedFields:
        - datasourceUid: tempo
          matcherRegex: "trace_id=(\\w+)"
          name: TraceID
          url: "$${__value.raw}"
```

**Dashboard provisioning:**

```yaml
# grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
  - name: "default"
    orgId: 1
    folder: "Infrastructure"
    type: file
    disableDeletion: true
    editable: false
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

Store dashboard JSON files in Git alongside application code. Use `grafana-dashboard-provider` to sync from ConfigMaps in Kubernetes.

### Grafana Alloy

Grafana Alloy (successor to Grafana Agent) is an OTel-compatible collector that supports metrics, logs, and traces. Use it as a drop-in replacement for the Prometheus node agent or OTel Collector.

```hcl
// alloy config -- /etc/alloy/config.alloy
// Scrape Prometheus metrics
prometheus.scrape "default" {
  targets    = prometheus.exporter.unix.default.targets
  forward_to = [prometheus.remote_write.mimir.receiver]
}

// Node exporter built-in
prometheus.exporter.unix "default" {
}

// Write to Mimir
prometheus.remote_write "mimir" {
  endpoint {
    url = "http://mimir:9009/api/v1/push"
  }
}

// Receive OTLP metrics
otelcol.receiver.otlp "default" {
  grpc { endpoint = "0.0.0.0:4317" }
  http { endpoint = "0.0.0.0:4318" }

  output {
    metrics = [otelcol.exporter.prometheus.default.input]
    logs    = [otelcol.exporter.loki.default.input]
    traces  = [otelcol.exporter.otlp.tempo.input]
  }
}
```

### Grafana LGTM Stack

The fully open-source Grafana observability stack.

```text
LGTM = Loki + Grafana + Tempo + Mimir

  ┌─────────┐     Logs      ┌─────────┐
  │  Apps   │──────────────►│  Loki   │──┐
  │         │     Traces     ├─────────┤  │    ┌──────────┐
  │         │──────────────►│  Tempo  │──┼───►│  Grafana  │
  │         │     Metrics    ├─────────┤  │    └──────────┘
  │         │──────────────►│  Mimir  │──┘
  └─────────┘               └─────────┘

  Mimir:  Long-term metrics storage (horizontally scalable Prometheus)
  Loki:   Log aggregation (label-indexed, not full-text)
  Tempo:  Distributed tracing backend (trace-by-ID, no indexing)
  Grafana: Unified visualization and correlation across all three signals
```

### Long-Term Storage: Mimir vs Thanos

Both solve Prometheus long-term retention and multi-cluster aggregation. Choose based on architecture preference.

```text
                        Mimir                           Thanos
                        ─────                           ──────
Architecture            Monolithic or microservices      Sidecar + Store Gateway
Data Ingestion          Remote write from Prometheus     Sidecar uploads TSDB blocks
Query Path              Built-in query engine            Thanos Querier federates
Object Storage          S3, GCS, Azure Blob              S3, GCS, Azure Blob
Multi-tenancy           Native (per-tenant limits)       Limited
Compaction              Centralized compactor            Compactor component
Alerting/Recording      Built-in ruler                   Ruler component
Deduplication           Ingester-level                   Query-time via external labels

Recommendation (2025-2026):
  - Greenfield → Mimir (simpler architecture, Grafana Labs actively developing)
  - Existing Thanos → Continue; migration not mandatory
  - Datadog/New Relic budget concerns → Either as self-hosted alternative
```

### VictoriaMetrics as Alternative

VictoriaMetrics is a high-performance, cost-effective Prometheus-compatible TSDB. It accepts Prometheus remote write, supports PromQL (MetricsQL superset), and uses 5-10x less storage than Prometheus.

```yaml
# docker-compose for VictoriaMetrics single-node
services:
  victoriametrics:
    image: victoriametrics/victoria-metrics:v1.106.1
    ports:
      - "8428:8428"
    volumes:
      - vmdata:/storage
    command:
      - "-storageDataPath=/storage"
      - "-retentionPeriod=12"           # months
      - "-httpListenAddr=:8428"
      - "-promscrape.config=/etc/prometheus/prometheus.yml"
```

### Remote Write and Federation

```text
Federation Patterns:

1. Hierarchical Federation
   Edge Prometheus → scrapes local targets
     └──► Central Prometheus → federates from edge instances

2. Remote Write (preferred for scale)
   Prometheus → remote_write → Mimir/Thanos/VictoriaMetrics
   All instances write to shared long-term store.

3. Cross-Service Federation (deprecated pattern)
   Prometheus A → /federate endpoint → Prometheus B
   Problem: Creates coupling, N+1 scrape load.
   Fix: Use remote write to shared backend instead.
```

---

## Best Practices

1. **Deploy kube-prometheus-stack on Kubernetes** -- use the Helm chart for Prometheus Operator, Alertmanager, Grafana, and default dashboards/alerts out of the box.

2. **Use ServiceMonitor/PodMonitor CRDs for target discovery** -- never hardcode scrape targets in `prometheus.yml` on Kubernetes; let the Operator handle discovery via labels.

3. **Write recording rules for dashboard and alert queries** -- pre-compute expensive aggregations (error ratios, percentiles) as recording rules to keep Grafana dashboards fast and alert evaluations cheap.

4. **Follow recording rule naming convention** -- use the `level:metric:operations` pattern (e.g., `job:http_requests:rate5m`) for all recording rules.

5. **Set up remote write to long-term storage** -- use Mimir, Thanos, or VictoriaMetrics for retention beyond 15 days and cross-cluster querying.

6. **Provision Grafana dashboards and data sources from Git** -- store dashboard JSON and datasource YAML in version control; deploy via provisioning or ConfigMaps.

7. **Adopt Grafana Alloy as the unified collector** -- replace standalone Prometheus node agents and OTel Collectors with Alloy for a single binary that handles metrics, logs, and traces.

8. **Use exemplar-enabled data sources in Grafana** -- configure Prometheus-to-Tempo exemplar links so engineers can jump from metric spikes to specific traces.

9. **Apply relabeling to control ingested series** -- use `metric_relabel_configs` to drop unused metrics, rename labels, and prevent cardinality explosions before storage.

10. **Monitor Prometheus itself** -- alert on `prometheus_tsdb_head_series`, `prometheus_tsdb_compaction_failed_total`, `prometheus_remote_storage_failed_samples_total`, and scrape failures.

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                                      | Fix                                                          |
|----|---------------------------------------|--------------------------------------------------------------|--------------------------------------------------------------|
| 1  | Single Prometheus for all clusters    | Single point of failure; cannot scale horizontally            | Deploy per-cluster Prometheus with remote write to Mimir      |
| 2  | No recording rules                    | Dashboard queries re-compute expensive aggregations on every load | Create recording rules for all dashboard panels and alerts   |
| 3  | Federation instead of remote write    | N+1 scrape overhead, tight coupling between Prometheus instances | Replace federation with remote write to central store         |
| 4  | Editing Grafana dashboards in the UI  | Configuration drift; changes lost on pod restart             | Provision dashboards from Git; set UI to read-only            |
| 5  | Default Prometheus retention forever  | Disk fills up; Prometheus crashes with OOM                   | Set `--storage.tsdb.retention.time=15d`; use remote write for long-term |
| 6  | No authentication on Prometheus       | Anyone can query metrics and extract sensitive business data  | Use reverse proxy with auth (OAuth2 Proxy / Grafana auth)    |
| 7  | Using `irate()` in alerting rules     | Instant rate is noisy and misses sustained problems           | Use `rate()` with appropriate range vector for alerts         |
| 8  | Scraping too frequently (1-5s)        | High CPU, memory, and storage overhead on Prometheus          | Use 15s-30s intervals for most targets; 60s for batch jobs    |

---

## Enforcement Checklist

```text
PROMETHEUS & GRAFANA ENFORCEMENT CHECKLIST
============================================

Prometheus:
  [ ] kube-prometheus-stack Helm chart deployed with version pinning
  [ ] ServiceMonitor/PodMonitor CRDs used for all scrape targets
  [ ] PrometheusRule CRDs used for alerting and recording rules
  [ ] External labels set (cluster, environment) for multi-cluster queries
  [ ] Remote write configured to long-term storage (Mimir/Thanos/VM)
  [ ] Retention set to 15d (local); long-term in external store
  [ ] Authentication enforced on Prometheus and Alertmanager UIs

PromQL:
  [ ] Recording rules created for all dashboard queries
  [ ] Recording rules follow level:metric:operations naming
  [ ] rate() used over irate() for alerting rules
  [ ] histogram_quantile() used for percentile calculations
  [ ] absent() used for dead-man's-switch style alerts

Grafana:
  [ ] Data sources provisioned from YAML (not created in UI)
  [ ] Dashboards provisioned from Git (JSON files in ConfigMaps)
  [ ] Exemplar links configured from Prometheus to Tempo/Jaeger
  [ ] Dashboard editing restricted in production (read-only mode)
  [ ] Folder structure mirrors team/service ownership

Long-Term Storage:
  [ ] Mimir, Thanos, or VictoriaMetrics deployed for retention > 15d
  [ ] Object storage configured (S3/GCS) for cost-effective retention
  [ ] Compaction running and monitored
  [ ] Multi-tenancy configured if serving multiple teams

Collector:
  [ ] Grafana Alloy or OTel Collector deployed for unified collection
  [ ] OTLP endpoints exposed for application telemetry
  [ ] Relabeling rules filter high-cardinality metrics
  [ ] Collector health monitored and alerted
```
