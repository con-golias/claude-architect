# Alerting

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Observability > Metrics                                                |
| **Importance**     | Critical                                                                        |
| **Scope**          | Alerting philosophy, Alertmanager, SLO burn-rate alerts, Grafana Alerting, alert-as-code |
| **Audience**       | SREs, DevOps Engineers, On-Call Engineers, Platform Engineers                    |
| **Key Insight**    | Every alert must be actionable, urgent, and require human intervention -- if an alert does not meet all three criteria, it should be a log, a dashboard panel, or deleted |
| **Cross-ref**      | [Prometheus & Grafana](prometheus-grafana.md), [Application Metrics](application-metrics.md), [Incident Response](../../incident-management/incident-response.md), [On-Call](../../incident-management/on-call.md), [SLI/SLO/SLA](../../../09-performance/performance-culture/sli-slo-sla.md) |

> **Scope Distinction:** This file covers **alerting rule design, Alertmanager configuration, and SLO-based alerting**. For SLI/SLO theory and error budget policy, see [09-performance/performance-culture/sli-slo-sla.md](../../../09-performance/performance-culture/sli-slo-sla.md). For incident response workflows triggered by alerts, see [incident-response.md](../../incident-management/incident-response.md).

---

## Core Concepts

### Alerting Philosophy

Effective alerting is not about detecting every anomaly -- it is about waking people up only when customers are impacted and automation cannot self-heal.

```text
The Three Requirements for Every Alert:

  1. ACTIONABLE  → A human can do something about it RIGHT NOW
  2. URGENT      → It cannot wait until the next business day
  3. REAL        → It indicates genuine customer impact, not noise

If an alert fails any requirement:
  - Not actionable → automate the fix, or convert to a dashboard panel
  - Not urgent     → convert to a daily/weekly report or ticket
  - Not real       → delete it or raise the threshold

Goal: Every page should result in a human taking a meaningful action.
Zero alerts should be acknowledged and ignored.
```

### Alert Severity Levels

Define consistent severity levels and map them to notification channels and response expectations.

| Severity     | Name       | Response Time | Notification Channel       | Human Action                         |
|--------------|------------|---------------|----------------------------|--------------------------------------|
| **Critical** | P1/SEV1    | < 5 min       | PagerDuty/OpsGenie page    | Drop everything; war room if needed  |
| **Warning**  | P2/SEV2    | < 30 min      | Slack #alerts-warning      | Investigate within SLA; may escalate |
| **Info**     | P3/SEV3    | Next business day | Slack #alerts-info      | Create ticket; investigate when free |

```text
Severity Decision Tree:

  Is it customer-facing AND impacting SLO?
     ├─ YES → Is it full outage or data loss?
     │          ├─ YES → CRITICAL (page immediately)
     │          └─ NO  → WARNING (notify team channel)
     └─ NO  → Will it become customer-facing within hours?
                ├─ YES → WARNING (proactive alert)
                └─ NO  → INFO (or dashboard-only, no alert)
```

### Symptom-Based vs Cause-Based Alerting

```text
Cause-Based (avoid as primary)           Symptom-Based (prefer)
────────────────────────────             ────────────────────────────
"CPU > 90%"                              "p99 latency > 500ms for 5 min"
"Disk > 85%"                             "Error rate > 1% for 5 min"
"Pod restarted"                          "Availability < 99.9% in 1h window"
"Connection pool at 80%"                 "Zero successful checkouts in 2 min"

Why prefer symptoms:
  - Directly maps to user experience
  - Fewer false positives (CPU spike may be fine)
  - Works across architecture changes
  - Enables SLO-based alerting

Use cause-based alerts only for:
  - Capacity planning (disk will fill in 4h → predict_linear)
  - Things that WILL cause symptoms soon but haven't yet
  - Infrastructure components with no user-visible symptom
```

### Prometheus Alertmanager Configuration

```yaml
# alertmanager.yml -- Production configuration
global:
  resolve_timeout: 5m
  pagerduty_url: "https://events.pagerduty.com/v2/enqueue"
  slack_api_url: "https://hooks.slack.com/services/T00/B00/XXXXX"

# Notification templates
templates:
  - "/etc/alertmanager/templates/*.tmpl"

# Inhibition rules -- suppress child alerts when parent fires
inhibit_rules:
  - source_matchers:
      - alertname = "ClusterDown"
    target_matchers:
      - severity =~ "warning|info"
    equal: ["cluster"]

  - source_matchers:
      - severity = "critical"
    target_matchers:
      - severity = "warning"
    equal: ["alertname", "namespace"]

# Routing tree
route:
  receiver: "slack-warnings"        # Default receiver
  group_by: ["alertname", "namespace", "job"]
  group_wait: 30s                   # Wait before sending first notification
  group_interval: 5m                # Wait before sending updates for a group
  repeat_interval: 4h               # Re-send if alert still firing
  routes:
    # Critical alerts → PagerDuty
    - matchers:
        - severity = "critical"
      receiver: "pagerduty-critical"
      group_wait: 10s
      repeat_interval: 1h
      continue: false

    # Warning alerts → Slack
    - matchers:
        - severity = "warning"
      receiver: "slack-warnings"
      repeat_interval: 4h

    # Info alerts → low-priority Slack channel
    - matchers:
        - severity = "info"
      receiver: "slack-info"
      repeat_interval: 12h

    # Watchdog (dead man's switch) → dedicated receiver
    - matchers:
        - alertname = "Watchdog"
      receiver: "deadmans-switch"
      repeat_interval: 1m

# Receivers
receivers:
  - name: "pagerduty-critical"
    pagerduty_configs:
      - service_key_file: "/etc/alertmanager/secrets/pagerduty-key"
        severity: critical
        description: '{{ .CommonAnnotations.summary }}'
        details:
          firing: '{{ .Alerts.Firing | len }}'
          dashboard: '{{ .CommonAnnotations.dashboard_url }}'
          runbook: '{{ .CommonAnnotations.runbook_url }}'

  - name: "slack-warnings"
    slack_configs:
      - channel: "#alerts-warning"
        send_resolved: true
        title: '[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}'
        text: >-
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}
          *Runbook:* {{ .CommonAnnotations.runbook_url }}
          *Dashboard:* {{ .CommonAnnotations.dashboard_url }}
        actions:
          - type: button
            text: "Runbook"
            url: '{{ .CommonAnnotations.runbook_url }}'
          - type: button
            text: "Dashboard"
            url: '{{ .CommonAnnotations.dashboard_url }}'

  - name: "slack-info"
    slack_configs:
      - channel: "#alerts-info"
        send_resolved: true

  - name: "deadmans-switch"
    webhook_configs:
      - url: "http://deadmans-switch-receiver:8080/ping"
```

### Multi-Window Multi-Burn-Rate Alerting for SLOs

The Google SRE approach to SLO-based alerting. Instead of simple threshold alerts, detect when the error budget is being consumed too fast.

```text
Concept: Burn Rate

  Burn rate = actual error rate / SLO-allowed error rate

  For 99.9% availability SLO (0.1% error budget over 30 days):
    Burn rate 1.0  → budget exhausted in exactly 30 days (normal)
    Burn rate 14.4 → budget exhausted in 2 days (fast burn → page)
    Burn rate 6.0  → budget exhausted in 5 days (medium burn → ticket)
    Burn rate 1.0  → budget lasts 30 days (normal → no alert)

Multi-Window: Use two windows per alert (long + short) to reduce false positives.
  - Long window: catches sustained burns (avoids alerting on resolved blips)
  - Short window: confirms the burn is still happening NOW

Recommended windows (Google SRE):
  ┌──────────┬────────────┬──────────────┬──────────────────────┐
  │ Severity │ Burn Rate  │ Long Window  │ Short Window         │
  ├──────────┼────────────┼──────────────┼──────────────────────┤
  │ Page     │ 14.4x      │ 1h           │ 5m                   │
  │ Page     │ 6x         │ 6h           │ 30m                  │
  │ Ticket   │ 3x         │ 1d           │ 2h                   │
  │ Ticket   │ 1x         │ 3d           │ 6h                   │
  └──────────┴────────────┴──────────────┴──────────────────────┘
```

**PrometheusRule for SLO burn-rate alerting:**

```yaml
# rules/slo-burn-rate.yml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: api-slo-burn-rate
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: api-service.slo.burn-rate
      rules:
        # --- Recording rules for error ratios at different windows ---
        - record: job:slo_errors_per_request:ratio_rate5m
          expr: |
            sum(rate(http_server_requests_total{job="api-service", status_code=~"5.."}[5m]))
            / sum(rate(http_server_requests_total{job="api-service"}[5m]))

        - record: job:slo_errors_per_request:ratio_rate30m
          expr: |
            sum(rate(http_server_requests_total{job="api-service", status_code=~"5.."}[30m]))
            / sum(rate(http_server_requests_total{job="api-service"}[30m]))

        - record: job:slo_errors_per_request:ratio_rate1h
          expr: |
            sum(rate(http_server_requests_total{job="api-service", status_code=~"5.."}[1h]))
            / sum(rate(http_server_requests_total{job="api-service"}[1h]))

        - record: job:slo_errors_per_request:ratio_rate6h
          expr: |
            sum(rate(http_server_requests_total{job="api-service", status_code=~"5.."}[6h]))
            / sum(rate(http_server_requests_total{job="api-service"}[6h]))

        # --- Alerting rules: multi-window, multi-burn-rate ---
        # SLO target: 99.9% → error budget = 0.001

        # Fast burn: 14.4x burn rate, 1h long / 5m short → PAGE
        - alert: SLOErrorBudgetFastBurn
          expr: |
            job:slo_errors_per_request:ratio_rate1h{job="api-service"} > (14.4 * 0.001)
            and
            job:slo_errors_per_request:ratio_rate5m{job="api-service"} > (14.4 * 0.001)
          for: 2m
          labels:
            severity: critical
            slo: "api-availability"
          annotations:
            summary: "API error budget burning fast (14.4x)"
            description: |
              1h error rate: {{ $value | humanizePercentage }}.
              At this rate, the 30-day error budget will be exhausted in ~2 days.
            runbook_url: "https://wiki.example.com/runbooks/slo-fast-burn"
            dashboard_url: "https://grafana.example.com/d/slo-api"

        # Medium burn: 6x burn rate, 6h long / 30m short → PAGE
        - alert: SLOErrorBudgetMediumBurn
          expr: |
            job:slo_errors_per_request:ratio_rate6h{job="api-service"} > (6 * 0.001)
            and
            job:slo_errors_per_request:ratio_rate30m{job="api-service"} > (6 * 0.001)
          for: 2m
          labels:
            severity: critical
            slo: "api-availability"
          annotations:
            summary: "API error budget burning (6x)"
            description: |
              6h error rate: {{ $value | humanizePercentage }}.
              At this rate, the 30-day error budget will be exhausted in ~5 days.
            runbook_url: "https://wiki.example.com/runbooks/slo-medium-burn"

        # Slow burn: 3x burn rate, 1d long / 2h short → TICKET
        - alert: SLOErrorBudgetSlowBurn
          expr: |
            job:slo_errors_per_request:ratio_rate1h{job="api-service"} > (3 * 0.001)
            and
            job:slo_errors_per_request:ratio_rate30m{job="api-service"} > (3 * 0.001)
          for: 15m
          labels:
            severity: warning
            slo: "api-availability"
          annotations:
            summary: "API error budget slow burn (3x)"
            description: "Elevated error rate may exhaust budget within 10 days."
            runbook_url: "https://wiki.example.com/runbooks/slo-slow-burn"
```

### Alert Fatigue Prevention

```text
Alert Fatigue Indicators:
  - On-call ignores or auto-acknowledges alerts
  - Same alert fires and resolves repeatedly (flapping)
  - Alerts fire during deployments but resolve within minutes
  - Team has > 20 pages per on-call shift
  - Alert acknowledged without investigation

Noise Reduction Strategies:

  1. Set meaningful `for` durations     → Eliminate transient spikes
     Bad:  for: 0m (instant page)
     Good: for: 5m (sustained problem)

  2. Use multi-window burn-rate         → Eliminate resolved-before-noticed blips
  3. Inhibit dependent alerts           → One root cause, one page
  4. Group related alerts               → group_by in Alertmanager
  5. Review and prune quarterly         → Delete alerts nobody acts on
  6. Track alert-to-incident ratio      → Target > 50% of pages → incident
  7. Add deployment-aware silences      → Mute known-noisy periods
  8. Use prediction instead of threshold → predict_linear for disk/quota
```

### Notification Channel Selection

| Channel           | Use When                                      | Response Expectation            |
|--------------------|----------------------------------------------|---------------------------------|
| **PagerDuty/OpsGenie** | Critical alerts requiring immediate response | < 5 min acknowledgment         |
| **Slack (urgent)**     | Warning alerts needing same-day response     | < 30 min triage                 |
| **Slack (info)**       | Informational alerts for awareness           | Next business day               |
| **Email**              | Daily/weekly summaries, compliance reports   | No real-time expectation        |
| **Jira/Linear ticket** | Slow-burn issues from alerting rules         | Sprint planning                 |
| **MS Teams**           | Organizations standardized on Microsoft      | Same as Slack equivalent        |

### Grafana Alerting

Grafana Unified Alerting (GA since Grafana 9) provides a built-in alerting engine independent of Alertmanager for simpler setups, or integrating with Alertmanager for advanced routing.

```yaml
# Grafana alert rule (provisioned via YAML)
apiVersion: 1
groups:
  - orgId: 1
    name: "API SLO Alerts"
    folder: "SLO"
    interval: "1m"
    rules:
      - uid: "api-high-error-rate"
        title: "API High Error Rate"
        condition: "C"
        data:
          - refId: "A"
            relativeTimeRange:
              from: 300  # 5 minutes
              to: 0
            datasourceUid: "prometheus"
            model:
              expr: 'sum(rate(http_server_requests_total{job="api",status_code=~"5.."}[5m]))'
              instant: true

          - refId: "B"
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: "prometheus"
            model:
              expr: 'sum(rate(http_server_requests_total{job="api"}[5m]))'
              instant: true

          - refId: "C"
            datasourceUid: "__expr__"
            model:
              type: math
              expression: "$A / $B > 0.01"

        for: "5m"
        labels:
          severity: critical
        annotations:
          summary: "API error rate exceeds 1%"
          runbook_url: "https://wiki.example.com/runbooks/api-errors"

# Contact point configuration
contactPoints:
  - orgId: 1
    name: "pagerduty-critical"
    receivers:
      - uid: "pd-receiver"
        type: "pagerduty"
        settings:
          integrationKey: "$PD_INTEGRATION_KEY"
          severity: critical

# Notification policy (routing)
policies:
  - orgId: 1
    receiver: "slack-default"
    group_by: ["alertname", "namespace"]
    routes:
      - receiver: "pagerduty-critical"
        matchers:
          - severity = critical
        continue: false
      - receiver: "slack-warnings"
        matchers:
          - severity = warning
```

### Alert-as-Code

Manage all alerting configuration through version-controlled code.

```hcl
# Terraform -- Grafana alerting rules
resource "grafana_rule_group" "api_slo" {
  org_id           = 1
  name             = "API SLO Alerts"
  folder_uid       = grafana_folder.slo.uid
  interval_seconds = 60

  rule {
    name      = "API High Error Rate"
    condition = "C"
    for       = "5m"
    labels      = { severity = "critical" }
    annotations = {
      summary     = "API error rate exceeds 1%"
      runbook_url = "https://wiki.example.com/runbooks/api-errors"
    }

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.prometheus.uid
      relative_time_range { from = 300; to = 0 }
      model = jsonencode({
        expr = "sum(rate(http_server_requests_total{job=\"api\",status_code=~\"5..\"}[5m]))"
        instant = true
      })
    }
    data {
      ref_id         = "B"
      datasource_uid = data.grafana_data_source.prometheus.uid
      relative_time_range { from = 300; to = 0 }
      model = jsonencode({
        expr = "sum(rate(http_server_requests_total{job=\"api\"}[5m]))"
        instant = true
      })
    }
    data {
      ref_id         = "C"
      datasource_uid = "__expr__"
      relative_time_range { from = 0; to = 0 }
      model = jsonencode({ type = "math", expression = "$A / $B > 0.01" })
    }
  }
}
```

### Runbook Links in Alerts

Every alert annotation must include a `runbook_url` pointing to a structured runbook.

```yaml
# Runbook annotation pattern
annotations:
  summary: "{{ $labels.job }} error rate is {{ $value | humanizePercentage }}"
  description: |
    Error rate on {{ $labels.job }} in {{ $labels.namespace }} has exceeded
    the SLO threshold for more than 5 minutes.
    Current value: {{ $value | humanizePercentage }}
  runbook_url: "https://wiki.example.com/runbooks/{{ $labels.job }}/high-error-rate"
  dashboard_url: "https://grafana.example.com/d/svc-overview?var-job={{ $labels.job }}"
```

```text
Runbook Structure (minimum):
  1. Alert Description     → What does this alert mean?
  2. Impact Assessment     → What is the customer impact?
  3. Investigation Steps   → What to check first (dashboards, logs, recent deploys)
  4. Mitigation Actions    → How to stop the bleeding (rollback, scale, feature flag)
  5. Escalation Path       → Who to contact if you cannot resolve
  6. Historical Context    → Links to past incidents with this alert
```

### Alert Testing

Unit test alert rules before deploying to production.

```bash
# promtool -- test alerting rules against synthetic data
# test-alerts.yml
rule_files:
  - "rules/slo-burn-rate.yml"

evaluation_interval: 1m

tests:
  - interval: 1m
    input_series:
      # Simulate 2% error rate (fast burn for 99.9% SLO)
      - series: 'http_server_requests_total{job="api-service",status_code="500"}'
        values: "0+2x60"    # 2 errors per minute for 60 minutes
      - series: 'http_server_requests_total{job="api-service",status_code="200"}'
        values: "0+98x60"   # 98 successes per minute

    alert_rule_test:
      - eval_time: 10m
        alertname: SLOErrorBudgetFastBurn
        exp_alerts:
          - exp_labels:
              severity: critical
              slo: "api-availability"
              job: "api-service"

      # Verify no alert at low error rate
      - eval_time: 10m
        alertname: SLOErrorBudgetSlowBurn
        exp_alerts: []   # Should not fire at 2% (only 3x burn needed)
```

```bash
# Run alert tests in CI
promtool test rules test-alerts.yml
promtool check rules rules/*.yml
```

### Dead Man's Switch (Watchdog Alert)

A Watchdog alert fires continuously when the alerting pipeline is healthy. If it stops firing, the dead man's switch detects that Prometheus or Alertmanager is broken.

```yaml
# Watchdog alert rule
groups:
  - name: meta
    rules:
      - alert: Watchdog
        expr: vector(1)
        labels:
          severity: none
        annotations:
          summary: "Alerting pipeline is healthy"
          description: "This alert fires continuously. If it stops, alerting is broken."
```

Configure the dead man's switch receiver to expect a heartbeat every minute. If the heartbeat stops, an external system (Dead Man's Snitch, Healthchecks.io, PagerDuty heartbeat) pages the team.

### On-Call Routing Integration

```text
Alert → Alertmanager → Route by severity/team
  ├─ Critical → PagerDuty/OpsGenie → primary on-call, auto-escalate 5 min
  ├─ Warning  → Slack #team-alerts → create ticket if unresolved 24h
  └─ Info     → Slack #team-info   → no escalation

On-Call Schedules (PagerDuty/OpsGenie):
  - Primary:   weekly rotation, 24/7
  - Secondary: backup escalation if primary unacked after 5 min
  - Manager:   escalation after 15 min unacknowledged
```

---

## Best Practices

1. **Alert on symptoms, not causes** -- detect user-facing impact (high error rate, slow responses) rather than internal state (high CPU, pod restarts) for primary alerting.

2. **Implement multi-window multi-burn-rate SLO alerting** -- use the Google SRE approach with fast-burn (1h/5m) and slow-burn (6h/30m) windows to balance detection speed with noise reduction.

3. **Require runbook URLs on every alert** -- every alert annotation must include a `runbook_url` pointing to investigation and mitigation steps; reject alerts without runbooks in code review.

4. **Use inhibition rules to suppress dependent alerts** -- when a cluster is down, suppress all service-level alerts in that cluster to prevent hundreds of pages for one root cause.

5. **Set meaningful `for` durations** -- require 2-5 minutes of sustained firing before notification to eliminate transient spikes; never use `for: 0m` on production alerts.

6. **Deploy a Watchdog dead man's switch** -- run a continuously-firing Watchdog alert to verify the alerting pipeline is healthy; route to an external heartbeat monitor.

7. **Test alert rules in CI** -- use `promtool test rules` to unit test alerting rules against synthetic time-series data before deploying to production.

8. **Review and prune alerts quarterly** -- track alert-to-incident ratio; delete or tune alerts that fire frequently without leading to human action (target > 50% actionable rate).

9. **Manage alerts as code** -- define all alerting rules, Alertmanager configuration, and notification routing in version-controlled files (PrometheusRule CRDs, Terraform, or Grafana provisioning YAML).

10. **Separate notification channels by severity** -- route critical alerts to PagerDuty/OpsGenie for immediate paging, warnings to Slack for same-day response, and informational alerts to low-priority channels.

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                                      | Fix                                                          |
|----|---------------------------------------|--------------------------------------------------------------|--------------------------------------------------------------|
| 1  | Alerting on every metric threshold    | Alert fatigue; on-call ignores pages                          | Alert only on user-facing symptoms and SLO violations        |
| 2  | No `for` duration on alerts           | Fires on transient spikes that auto-resolve in seconds        | Set `for: 2m` minimum for warnings, `for: 5m` for non-critical |
| 3  | Missing runbook links                 | On-call wastes time figuring out what to do                   | Require `runbook_url` annotation on every alert              |
| 4  | Single threshold for all SLOs         | Cannot distinguish fast burn from slow burn                   | Implement multi-window multi-burn-rate alerting              |
| 5  | Editing alerts in Alertmanager UI     | Configuration drift, no audit trail, lost on restart          | Manage alerts as code (PrometheusRule CRDs, Terraform)       |
| 6  | No dead man's switch                  | Broken alerting pipeline goes undetected for hours            | Deploy Watchdog alert with external heartbeat receiver       |
| 7  | Paging for informational alerts       | On-call burnout from non-urgent notifications at 3 AM        | Route info alerts to Slack/email only; page only for critical |
| 8  | Alert rules not tested in CI          | Broken PromQL deploys to production; alerts silently fail     | Run `promtool test rules` and `promtool check rules` in CI  |

---

## Enforcement Checklist

```text
ALERTING ENFORCEMENT CHECKLIST
================================

Alert Design:
  [ ] Every alert is actionable, urgent, and indicates real customer impact
  [ ] Primary alerts are symptom-based (error rate, latency, availability)
  [ ] Cause-based alerts used only for predictive capacity (disk, quota)
  [ ] Multi-window multi-burn-rate implemented for SLO-based alerting
  [ ] Every alert has a runbook_url annotation
  [ ] Every alert has a dashboard_url annotation
  [ ] `for` duration set to >= 2 minutes on all alerts

Alertmanager:
  [ ] Routing tree separates critical/warning/info to different receivers
  [ ] Inhibition rules suppress dependent alerts during major outages
  [ ] Group_by configured to batch related alerts (alertname, namespace)
  [ ] Repeat_interval set appropriately (1h critical, 4h warning)
  [ ] Silences used for planned maintenance (not as permanent muting)

Notification:
  [ ] Critical alerts route to PagerDuty/OpsGenie with auto-escalation
  [ ] Warning alerts route to team Slack channel
  [ ] Info alerts route to low-priority channel or daily digest
  [ ] Dead man's switch (Watchdog) configured and monitored externally
  [ ] On-call rotation integrated with incident management platform

Quality:
  [ ] Alert rules tested with promtool in CI pipeline
  [ ] PromQL syntax validated with promtool check rules
  [ ] Quarterly alert review scheduled (prune unused, tune noisy)
  [ ] Alert-to-incident ratio tracked (target > 50% lead to action)
  [ ] Mean time to acknowledge (MTTA) tracked per team

Infrastructure as Code:
  [ ] All alerting rules stored in version control
  [ ] PrometheusRule CRDs used for Kubernetes deployments
  [ ] Terraform or Grafana provisioning for non-K8s environments
  [ ] Changes go through code review before production deployment
  [ ] Alert configuration included in service templates/scaffolding
```
