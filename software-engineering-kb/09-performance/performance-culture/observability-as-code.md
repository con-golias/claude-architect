# Observability as Code — Codified Monitoring Infrastructure

> **Domain:** Performance Culture > Observability Engineering
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/performance-culture/sli-slo-sla.md (SLO definitions)

> **Directive:** Define all dashboards, alerts, SLOs, and monitoring infrastructure in version-controlled code. Treat observability configuration as a first-class software artifact with review, testing, and deployment pipelines. Never create monitoring resources manually.

---

## 1. Golden Signals & MELT Framework

```
GOLDEN SIGNALS (Google SRE):           MELT FRAMEWORK:
├── Latency    → Metrics (histograms)  ├── Metrics — counters, gauges, histograms
├── Traffic    → Metrics (counters)    │   Tools: Prometheus, Datadog, CloudWatch
├── Errors     → Metrics + Logs        ├── Events — deployments, config changes, alerts
├── Saturation → Metrics (gauges)      │   Tools: PagerDuty, Honeycomb
                                       ├── Logs — structured application records
                                       │   Tools: Loki, Elasticsearch, CloudWatch Logs
                                       └── Traces — distributed request lifecycles
                                           Tools: Jaeger, Tempo, X-Ray
```

## 2. Dashboards as Code — Grafana Provisioning

```yaml
# grafana/provisioning/dashboards/provider.yaml
apiVersion: 1
providers:
  - name: service-dashboards
    orgId: 1
    type: file
    disableDeletion: true
    updateIntervalSeconds: 30
    allowUiUpdates: false      # CRITICAL: prevent manual edits
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

```json
// grafana/dashboards/api-gateway/golden-signals.json
{
  "dashboard": {
    "title": "API Gateway — Golden Signals",
    "tags": ["golden-signals", "api-gateway", "generated"],
    "templating": { "list": [
      { "name": "namespace", "type": "query", "query": "label_values(namespace)" },
      { "name": "service", "type": "query", "query": "label_values(service)" }
    ]},
    "panels": [
      { "title": "Request Rate (Traffic)", "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [{ "expr": "sum(rate(http_requests_total{namespace=\"$namespace\",service=\"$service\"}[5m]))" }] },
      { "title": "Error Rate", "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "targets": [{ "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100" }] },
      { "title": "Latency p50/p95/p99", "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
        "targets": [
          { "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))", "legendFormat": "p50" },
          { "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))", "legendFormat": "p95" },
          { "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))", "legendFormat": "p99" }
        ] },
      { "title": "Saturation", "type": "gauge",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
        "targets": [{ "expr": "avg(rate(container_cpu_usage_seconds_total[5m])) / avg(kube_pod_container_resource_limits{resource=\"cpu\"}) * 100" }] }
    ]
  }
}
```

### Terraform-Managed Grafana

```hcl
# terraform/grafana.tf
resource "grafana_dashboard" "golden_signals" {
  for_each    = fileset("${path.module}/dashboards", "**/*.json")
  config_json = file("${path.module}/dashboards/${each.value}")
  overwrite   = true
}

resource "grafana_data_source" "prometheus" {
  type = "prometheus"
  name = "Prometheus"
  url  = "http://prometheus:9090"
  json_data_encoded = jsonencode({ timeInterval = "15s" })
}

resource "grafana_notification_policy" "default" {
  group_by        = ["alertname", "service"]
  group_wait      = "30s"
  group_interval  = "5m"
  repeat_interval = "4h"
  contact_point   = grafana_contact_point.pagerduty.name
}
```

## 3. Alerts as Code — Prometheus Rules

```yaml
# prometheus/rules/api-alerts.yaml
groups:
  - name: api-gateway-golden-signals
    interval: 30s
    rules:
      - alert: TrafficDrop
        expr: |
          sum(rate(http_requests_total[10m]))
          < 0.5 * sum(rate(http_requests_total[10m] offset 1h))
        for: 5m
        labels: { severity: warning, service: api-gateway }
        annotations:
          summary: "Traffic dropped >50% vs 1h ago"
          runbook: "https://wiki.example.com/runbooks/traffic-drop"
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.01
        for: 2m
        labels: { severity: critical, service: api-gateway }
        annotations:
          summary: "Error rate > 1% for 2 minutes"
          dashboard: "https://grafana.example.com/d/api-gw"
      - alert: HighP99Latency
        expr: |
          histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2.0
        for: 5m
        labels: { severity: warning }
      - alert: HighCPUSaturation
        expr: |
          avg(rate(container_cpu_usage_seconds_total{container="api-gateway"}[5m]))
          / avg(kube_pod_container_resource_limits{container="api-gateway",resource="cpu"}) > 0.85
        for: 10m
        labels: { severity: warning }
        annotations: { summary: "CPU > 85% sustained 10min" }
```

### PagerDuty as Code

```hcl
# terraform/pagerduty.tf
resource "pagerduty_service" "api_gateway" {
  name              = "API Gateway"
  escalation_policy = pagerduty_escalation_policy.engineering.id
  alert_creation    = "create_alerts_and_incidents"
  incident_urgency_rule { type = "constant"; urgency = "high" }
}

resource "pagerduty_escalation_policy" "engineering" {
  name      = "Engineering Escalation"
  num_loops = 3
  rule {
    escalation_delay_in_minutes = 10
    target { type = "schedule_reference"; id = pagerduty_schedule.oncall.id }
  }
  rule {
    escalation_delay_in_minutes = 15
    target { type = "user_reference"; id = pagerduty_user.eng_manager.id }
  }
}
```

## 4. SLO Definitions as Code

### OpenSLO Specification

```yaml
# openslo/api-gateway-slo.yaml
apiVersion: openslo/v1
kind: SLO
metadata:
  name: api-gateway-availability
spec:
  service: api-gateway
  description: "99.95% of requests return non-5xx status"
  budgetingMethod: Occurrences
  objectives:
    - displayName: "Availability"
      target: 0.9995
      ratioMetrics:
        good:
          source: prometheus
          queryType: promql
          query: sum(rate(http_requests_total{status!~"5.."}[{{.window}}]))
        total:
          source: prometheus
          queryType: promql
          query: sum(rate(http_requests_total[{{.window}}]))
  timeWindow:
    - duration: 30d
      isRolling: true
  alertPolicies:
    - kind: AlertPolicy
      metadata: { name: api-gw-fast-burn }
      spec:
        conditions:
          - kind: AlertCondition
            spec:
              severity: critical
              condition: { kind: burnrate, threshold: 14.4, lookbackWindow: 1h, alertAfter: 2m }
```

### Sloth — SLO-to-Prometheus Generator

```yaml
# sloth/api-gateway.yaml
version: "prometheus/v1"
service: "api-gateway"
labels: { team: platform }
slos:
  - name: "requests-availability"
    objective: 99.95
    description: "HTTP request availability"
    sli:
      events:
        error_query: sum(rate(http_requests_total{status=~"5.."}[{{.window}}]))
        total_query: sum(rate(http_requests_total[{{.window}}]))
    alerting:
      name: APIGatewayAvailability
      page_alert:
        labels: { severity: critical, routing_key: platform-oncall }
      ticket_alert:
        labels: { severity: warning, routing_key: platform-tickets }
```

```bash
# Generate Prometheus rules from Sloth SLO definitions
sloth generate -i sloth/api-gateway.yaml -o prometheus/rules/generated/api-gateway-slo.yaml
```

## 5. Pre-Merge Instrumentation Checks

```yaml
# .github/workflows/observability-lint.yml
name: Observability Lint
on: [pull_request]
jobs:
  check-instrumentation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint alerting rules
        run: promtool check rules prometheus/rules/*.yaml
      - name: Lint dashboards
        run: |
          for f in grafana/dashboards/**/*.json; do
            python -m json.tool "$f" > /dev/null || (echo "FAIL: $f" && exit 1)
          done
      - name: Validate SLO definitions
        run: openslo validate openslo/*.yaml
      - name: Verify instrumentation coverage
        run: python scripts/check_instrumentation.py --routes src/routes.ts --metrics src/middleware/metrics.ts
```

```python
# scripts/check_instrumentation.py — Verify all routes have metrics
import re, sys

def extract_routes(path: str) -> set[str]:
    with open(path) as f:
        return set(re.findall(r"(?:get|post|put|delete|patch)\(['\"](/[^'\"]+)['\"]", f.read()))

def extract_instrumented(path: str) -> set[str]:
    with open(path) as f:
        return set(re.findall(r"path:\s*['\"](/[^'\"]+)['\"]", f.read()))

routes = extract_routes(sys.argv[2])
instrumented = extract_instrumented(sys.argv[4])
missing = routes - instrumented
if missing:
    print(f"FAIL: {len(missing)} routes lack instrumentation: {missing}")
    sys.exit(1)
print(f"OK: All {len(routes)} routes instrumented")
```

## 6. Monitoring Infrastructure as Code

```hcl
# terraform/monitoring-stack.tf
module "prometheus" {
  source  = "prometheus-community/kube-prometheus-stack/helm"
  version = "55.0.0"
  values  = [file("${path.module}/values/prometheus.yaml")]
  set { name = "prometheus.prometheusSpec.retention"; value = "30d" }
  set { name = "prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage"; value = "100Gi" }
}

module "grafana" { source = "grafana/grafana/helm"; values = [file("${path.module}/values/grafana.yaml")] }
module "loki"    { source = "grafana/loki/helm";    values = [file("${path.module}/values/loki.yaml")] }
module "tempo"   { source = "grafana/tempo/helm";   values = [file("${path.module}/values/tempo.yaml")] }
# All configuration in version-controlled values/ directory — PR review required
```

## 7. Observability Cost Management

```yaml
# Sampling strategies — reduce volume without losing signal
sampling:
  head_sampling:          # Decide at request start
    default_rate: 0.1     # 10% of normal traffic
    error_rate: 1.0       # 100% of errors
    slow_request_rate: 1.0
    new_deployment_rate: 0.5
  tail_sampling:          # Decide after request completes (preferred)
    always_sample: [status_code >= 500, duration > 2s, has_error_tag]
    probabilistic_rate: 0.05
    max_traces_per_second: 100
```

```hcl
# terraform/log-tiering.tf — Tiered storage for cost control
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/app/production"
  retention_in_days = 30
}

resource "aws_s3_bucket" "log_archive" {
  bucket = "logs-archive-${var.environment}"
  lifecycle_rule {
    id      = "archive-old-logs"
    enabled = true
    transition { days = 90; storage_class = "GLACIER" }
    expiration { days = 365 }
  }
}
```

```yaml
# Data reduction strategies with estimated savings
cost_optimization:
  metrics:   # 40-60% storage savings
    - Drop unused metrics (review with mimirtool analyze)
    - Never use user_id/request_id as label values (cardinality explosion)
    - Increase scrape_interval for non-critical services (30s → 60s)
    - Pre-aggregate with recording rules
  logs:      # 70-80% ingestion savings
    - WARN level in production (DEBUG/INFO in staging only)
    - Sample verbose logs at 10% (access logs, health checks)
    - Drop known-noisy lines at collector
    - Structured logging — cheaper to index and query
  traces:    # 80-90% storage savings
    - Tail-based sampling: 100% errors, 5% success
    - Max 32 span attributes, truncate payloads > 4KB
    - Drop health-check and readiness-probe traces
```

---

## 10 Best Practices

1. **Version control all observability config** — dashboards, alerts, and SLOs are code, not UI artifacts
2. **Prohibit manual dashboard edits** — set `allowUiUpdates: false` in Grafana provisioning
3. **Validate configs in CI** — run `promtool check rules` and JSON lint on every pull request
4. **Generate alert rules from SLO specs** — use Sloth or OpenSLO to ensure alerts match objectives
5. **Include runbook links in every alert annotation** — on-call engineers need immediate context
6. **Instrument before shipping** — pre-merge checks must verify new endpoints have metrics
7. **Use tail-based sampling** — capture 100% of errors and slow requests while sampling healthy traffic
8. **Control metric cardinality** — never use high-cardinality values (user IDs, UUIDs) as Prometheus labels
9. **Tier storage by age** — hot metrics for 30d, warm for 90d, cold archive for compliance
10. **Review observability costs monthly** — track ingestion volume, storage, and query costs per team

## 8 Anti-Patterns

1. **Click-ops dashboards** — manually created dashboards are lost during Grafana upgrades or migrations
2. **Alerts without runbooks** — "disk full" without remediation steps is useless at 3 AM
3. **High-cardinality labels** — `user_id` as a Prometheus label creates millions of series, crashes the cluster
4. **Sampling all traffic equally** — discarding 90% of errors to save cost eliminates your most valuable data
5. **Monitoring the monitoring stack manually** — the observability platform itself must be codified
6. **DEBUG logging in production** — generates 10-100x log volume with near-zero diagnostic value
7. **Dashboard sprawl without ownership** — hundreds of dashboards, no owners, nobody knows which to trust
8. **Alerting on symptoms and causes simultaneously** — page for "API errors > 1%", not every downstream timeout

## Enforcement Checklist

- [ ] All dashboards stored in version control and provisioned automatically
- [ ] Grafana UI edits disabled (`allowUiUpdates: false`)
- [ ] Prometheus alerting rules validated with `promtool` in CI pipeline
- [ ] SLO definitions codified in OpenSLO or Sloth format
- [ ] Every alert rule includes `runbook` annotation URL
- [ ] Pre-merge check verifies new endpoints have metric instrumentation
- [ ] Tail-based sampling configured to retain 100% of errors and slow requests
- [ ] Metric cardinality reviewed monthly; no labels with >1000 unique values
- [ ] Log retention tiers defined: hot (30d), warm (90d), archive (365d)
- [ ] Observability cost dashboard tracks ingestion and storage per team
