# Dashboards

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Observability                                                          |
| **Importance**     | High                                                                            |
| **Scope**          | Dashboard design principles, methodologies, Grafana, dashboard-as-code          |
| **Audience**       | SREs, DevOps Engineers, Platform Engineers, Engineering Managers                 |
| **Key Insight**    | Effective dashboards answer specific questions for specific audiences; the RED and USE methods provide proven frameworks for service and infrastructure monitoring |
| **Cross-ref**      | [Three Pillars](three-pillars.md), [Structured Logging](logging/structured-logging.md), [Incident Response](../incident-management/incident-response.md) |

> **Scope Distinction:** This file covers **dashboard design and implementation**. For alerting configuration and routing, see metrics/alerting.md. For SLI/SLO dashboard patterns, see [09-performance/performance-culture/sli-slo-sla.md](../../09-performance/performance-culture/sli-slo-sla.md).

---

## Core Concepts

### Dashboard Design Principles

Apply these principles to every dashboard.

1. **User-centric** -- design each dashboard for a specific persona (on-call, team lead, executive)
2. **Actionable** -- every panel must answer a question that leads to an action
3. **Layered** -- provide drill-down from overview to detail
4. **Consistent** -- use standard color schemes, units, and layouts across all dashboards
5. **Maintained** -- assign ownership and review dashboards quarterly

```text
Dashboard Anti-Pattern:
  "The Wall of Graphs" -- 40 panels showing everything, answering nothing

Dashboard Goal:
  "Is the service healthy? If not, where do I look next?"
```

### The RED Method (For Services)

Use RED for any request-driven service (APIs, microservices, web servers).

| Signal     | Metric                          | PromQL Example                                         |
|------------|---------------------------------|--------------------------------------------------------|
| **R**ate   | Requests per second             | `rate(http_requests_total[5m])`                        |
| **E**rrors | Failed requests per second      | `rate(http_requests_total{status=~"5.."}[5m])`         |
| **D**uration | Latency distribution         | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))` |

```text
RED Dashboard Layout:
┌──────────────────────────────────────────────────────────┐
│  Service: payment-service    Environment: production     │
├──────────────────┬──────────────────┬────────────────────┤
│  Request Rate    │  Error Rate (%)  │  p99 Latency       │
│  ▁▂▃▄▅▆▇█▇▆▅    │  ▁▁▁▂▁▁▁█▂▁▁    │  ▁▁▂▁▁▁▁▅▂▁▁      │
│  2,340 req/s     │  0.12%           │  245ms             │
├──────────────────┴──────────────────┴────────────────────┤
│  Request Rate by Endpoint        │  Error Rate by Status │
│  /checkout  ████████  1,200/s    │  502  ██████  45/s    │
│  /cart      ████      600/s      │  503  ███     22/s    │
│  /products  ███       400/s      │  500  █       8/s     │
└──────────────────────────────────┴───────────────────────┘
```

### The USE Method (For Resources)

Use USE for infrastructure components (CPU, memory, disk, network, queues).

| Signal          | Definition                                    | Example Metrics                         |
|-----------------|-----------------------------------------------|-----------------------------------------|
| **U**tilization | Percentage of resource capacity in use        | `node_cpu_seconds_total`, `node_memory_MemAvailable_bytes` |
| **S**aturation  | Amount of queued/waiting work                 | `node_load15`, disk I/O queue depth     |
| **E**rrors      | Count of error events for the resource        | ECC memory errors, NIC packet drops     |

### Four Golden Signals (Google SRE)

The Four Golden Signals from the Google SRE book overlap with RED but add saturation for infrastructure awareness.

| Signal       | Description                                          |
|--------------|------------------------------------------------------|
| **Latency**  | Time to serve a request (distinguish success vs error latency) |
| **Traffic**  | Demand on the system (req/s, sessions, transactions) |
| **Errors**   | Rate of failed requests (explicit 5xx + implicit timeout) |
| **Saturation** | How full the service is (CPU, memory, queue depth) |

### Dashboard Hierarchy

Organize dashboards in layers that match your incident response workflow.

```text
Level 0: Executive Overview
  └── SLO compliance, error budget burn, availability %

Level 1: Service Overview
  └── RED metrics per service, deployment markers, SLO status

Level 2: Component Detail
  └── Database connections, cache hit rates, queue depths

Level 3: Debug
  └── Per-endpoint latency, trace exploration, log search
```

```text
Drill-Down Flow During Incident:

  Executive Overview: "Payment SLO is burning error budget"
       │
       ▼
  Service Dashboard: "payment-service error rate spiked at 14:23"
       │
       ▼
  Component Dashboard: "Stripe API timeout rate increased to 15%"
       │
       ▼
  Debug Dashboard: "Trace abc123 shows 30s timeout on /v1/charges"
```

### Grafana Dashboard Design

#### Panels and Layout

```text
Panel Types and When to Use:
  Time series  ── Trends over time (rate, latency, utilization)
  Stat         ── Current single value (uptime %, request rate)
  Gauge        ── Progress toward a limit (CPU %, disk usage)
  Table        ── Tabular data (top endpoints, error breakdown)
  Heatmap      ── Distribution over time (latency histograms)
  Logs         ── Embedded log viewer (correlated by label)
  Alert list   ── Active alerts for the dashboard scope
```

#### Variables and Templating

Use Grafana template variables to make dashboards reusable across services, environments, and clusters.

```json
{
  "templating": {
    "list": [
      {
        "name": "environment",
        "type": "query",
        "query": "label_values(up, environment)",
        "current": { "text": "production", "value": "production" },
        "refresh": 2
      },
      {
        "name": "service",
        "type": "query",
        "query": "label_values(http_requests_total{environment=\"$environment\"}, service)",
        "refresh": 2,
        "multi": true,
        "includeAll": true
      },
      {
        "name": "interval",
        "type": "interval",
        "query": "1m,5m,15m,1h",
        "current": { "text": "5m", "value": "5m" }
      }
    ]
  }
}
```

#### Annotations for Context

Add deployment markers, incident markers, and alert annotations to correlate changes with metric behavior.

```json
{
  "annotations": {
    "list": [
      {
        "name": "Deployments",
        "datasource": "Prometheus",
        "expr": "changes(deployment_info{service=\"$service\"}[1m]) > 0",
        "tagKeys": "service,version",
        "titleFormat": "Deploy: {{version}}",
        "iconColor": "blue"
      },
      {
        "name": "Alerts",
        "datasource": "-- Grafana --",
        "enable": true,
        "iconColor": "red"
      }
    ]
  }
}
```

### Dashboard-as-Code

Treat dashboards as code: version-controlled, reviewed, and provisioned automatically.

#### Grafana Provisioning YAML

```yaml
# /etc/grafana/provisioning/dashboards/default.yaml
apiVersion: 1
providers:
  - name: "platform-dashboards"
    orgId: 1
    folder: "Platform"
    type: file
    disableDeletion: true
    editable: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards/platform
      foldersFromFilesStructure: true

  - name: "team-dashboards"
    orgId: 1
    folder: "Teams"
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards/teams
```

#### Grafonnet (Jsonnet)

Use Grafonnet to generate Grafana dashboards programmatically with reusable components.

```jsonnet
// service-dashboard.jsonnet
local grafana = import 'github.com/grafana/grafonnet/gen/grafonnet-latest/main.libsonnet';
local dashboard = grafana.dashboard;
local panel = grafana.panel;
local prometheus = grafana.query.prometheus;
local variable = dashboard.variable;

local ds = variable.datasource.new('datasource', 'prometheus');
local svc = variable.query.new('service',
  'label_values(http_requests_total, service)')
  + variable.query.withDatasource('prometheus');

local requestRatePanel =
  panel.timeSeries.new('Request Rate')
  + panel.timeSeries.queryOptions.withTargets([
    prometheus.new('$datasource',
      'rate(http_requests_total{service="$service"}[5m])')
    + prometheus.withLegendFormat('{{method}} {{status}}'),
  ])
  + panel.timeSeries.standardOptions.withUnit('reqps')
  + panel.timeSeries.gridPos.withW(12)
  + panel.timeSeries.gridPos.withH(8);

local errorRatePanel =
  panel.timeSeries.new('Error Rate (%)')
  + panel.timeSeries.queryOptions.withTargets([
    prometheus.new('$datasource',
      'sum(rate(http_requests_total{service="$service",status=~"5.."}[5m]))
       / sum(rate(http_requests_total{service="$service"}[5m])) * 100')
    + prometheus.withLegendFormat('error %'),
  ])
  + panel.timeSeries.standardOptions.withUnit('percent')
  + panel.timeSeries.fieldConfig.defaults.thresholds.withSteps([
    { color: 'green', value: null },
    { color: 'yellow', value: 1 },
    { color: 'red', value: 5 },
  ])
  + panel.timeSeries.gridPos.withW(12)
  + panel.timeSeries.gridPos.withH(8)
  + panel.timeSeries.gridPos.withX(12);

dashboard.new('Service Health: $service')
+ dashboard.withUid('service-health')
+ dashboard.withTags(['generated', 'service', 'red'])
+ dashboard.withVariables([ds, svc])
+ dashboard.withPanels([requestRatePanel, errorRatePanel])
+ dashboard.withRefresh('30s')
```

#### Terraform Grafana Provider

```hcl
# grafana-dashboards.tf
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 3.0"
    }
  }
}

provider "grafana" {
  url  = var.grafana_url
  auth = var.grafana_api_key
}

resource "grafana_folder" "platform" {
  title = "Platform"
}

resource "grafana_dashboard" "service_health" {
  folder      = grafana_folder.platform.id
  config_json = file("${path.module}/dashboards/service-health.json")

  overwrite = true
}

resource "grafana_dashboard" "infrastructure" {
  folder      = grafana_folder.platform.id
  config_json = file("${path.module}/dashboards/infrastructure.json")

  overwrite = true
}

# Provision data sources as code
resource "grafana_data_source" "prometheus" {
  type = "prometheus"
  name = "Prometheus"
  url  = var.prometheus_url

  json_data_encoded = jsonencode({
    httpMethod    = "POST"
    exemplarTraceIdDestinations = [{
      name         = "traceID"
      datasourceUid = grafana_data_source.tempo.uid
    }]
  })
}

resource "grafana_data_source" "tempo" {
  type = "tempo"
  name = "Tempo"
  url  = var.tempo_url
}
```

### Key Dashboard Templates

| Dashboard           | Methodology | Key Panels                                                    | Audience    |
|---------------------|-------------|---------------------------------------------------------------|-------------|
| Service Health      | RED         | Request rate, error %, p50/p95/p99 latency, deployment markers | On-call SRE |
| Infrastructure      | USE         | CPU/memory/disk utilization, saturation, node status           | Platform    |
| SLO Status          | SLI/SLO     | Error budget remaining, burn rate, SLO compliance trend        | Team Lead   |
| Deployment          | Custom      | Deploy frequency, rollback rate, change failure rate, lead time| Eng Manager |
| On-Call Overview    | Golden      | Active alerts, MTTA/MTTR, pages per shift, top alerting services | On-call    |

### Alert-to-Dashboard Linking

Configure every alert to link directly to the relevant dashboard with pre-filled context.

```yaml
# Alertmanager alert rule with dashboard link
groups:
  - name: service-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          / sum(rate(http_requests_total[5m])) by (service) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          dashboard: "https://grafana.internal/d/service-health?var-service={{ $labels.service }}"
          runbook: "https://runbooks.internal/high-error-rate"
```

### Avoiding Dashboard Sprawl

```text
Dashboard Lifecycle:
  1. New service → Clone standard template → Customize
  2. Quarterly review → Archive unused dashboards (< 5 views/month)
  3. Annual audit → Consolidate overlapping dashboards

Governance Rules:
  - Every dashboard must have an owner (team or individual)
  - Dashboards without views in 90 days are flagged for deletion
  - Standard dashboards (service health, infra) are read-only, provisioned as code
  - Team dashboards are editable but backed up nightly
```

| Sprawl Symptom                        | Solution                                       |
|---------------------------------------|-------------------------------------------------|
| 200+ dashboards, nobody knows which   | Enforce folder structure by team/service         |
| Duplicate dashboards for same service | Templatize with variables, single source of truth|
| Stale dashboards with broken queries  | Quarterly review cadence with automated staleness detection |
| No naming convention                  | Enforce: `[Team] Service - Purpose` naming       |

---

## Best Practices

1. **Start with RED for services, USE for infrastructure** -- apply the appropriate methodology before designing any panel to ensure every chart answers a specific question.

2. **Design dashboards for specific personas** -- create separate dashboards for on-call engineers (detail), team leads (SLO status), and executives (business impact).

3. **Implement dashboard-as-code** -- store all production dashboards in version control using Grafonnet, Terraform, or Grafana provisioning YAML.

4. **Add deployment and incident annotations** -- overlay change events on time-series panels to instantly correlate metrics changes with deployments.

5. **Use template variables for reusability** -- parameterize environment, service, and cluster to avoid creating per-service dashboard copies.

6. **Link alerts to dashboards with pre-filled context** -- every alert annotation must include a dashboard URL with the relevant service/time pre-selected.

7. **Enforce a dashboard hierarchy** -- maintain exactly four levels (executive, service, component, debug) and link them with drill-down navigation.

8. **Review and archive dashboards quarterly** -- assign ownership to every dashboard and delete or archive those with fewer than 5 views per month.

9. **Standardize color schemes and units** -- use green/yellow/red consistently for thresholds, and always specify units (req/s, ms, %) on every panel.

10. **Limit panels per dashboard to 15-20** -- more panels slow rendering and overwhelm viewers; split into multiple focused dashboards instead.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| **Wall of graphs** | 50+ panels per dashboard; nobody reads any of them | Limit to 15-20 panels per dashboard with clear hierarchy |
| **No template variables** | Duplicate dashboards per service/environment (N x M copies) | Use Grafana variables; one dashboard serves all instances |
| **Click-ops dashboards** | Dashboards created manually in UI, lost on Grafana rebuild | Store as code in Git, provision automatically |
| **Alerting without dashboard links** | On-call receives alert but cannot find the relevant dashboard | Include dashboard URL with pre-filled variables in every alert |
| **Missing units and thresholds** | Panels show raw numbers with no context for what is "bad" | Always configure units (ms, %, req/s) and color thresholds |
| **No deployment markers** | Metrics change but nobody can correlate with a release | Add annotation queries for deployment events on all service dashboards |
| **Stale abandoned dashboards** | Dashboard sprawl creates confusion; wrong dashboard viewed during incidents | Enforce ownership, quarterly review, auto-archive unused dashboards |
| **Business metrics mixed with infra** | Executive dashboard shows TCP retransmits; SRE dashboard shows revenue | Separate audience-specific dashboards with appropriate abstraction level |

---

## Enforcement Checklist

- [ ] Every service has a RED dashboard (request rate, error rate, duration) provisioned automatically
- [ ] Infrastructure dashboards follow USE methodology (utilization, saturation, errors)
- [ ] All dashboards are stored in version control and provisioned as code (not created manually)
- [ ] Template variables used for environment, service, and cluster (no duplicate dashboards)
- [ ] Deployment annotations configured on all service-level dashboards
- [ ] Every alert rule includes a `dashboard` annotation with a direct link
- [ ] Dashboard folder structure enforced: Platform (read-only) and Teams (editable)
- [ ] Dashboard naming convention enforced: `[Team] Service - Purpose`
- [ ] Quarterly review cadence established with staleness detection (< 5 views/month flagged)
- [ ] Color schemes and units standardized across all dashboards (documented in a style guide)
