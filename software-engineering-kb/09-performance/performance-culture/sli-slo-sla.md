# SLI, SLO, SLA — Service Level Engineering

> **Domain:** Performance Culture > Reliability & Service Level Management
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/performance-culture/observability-as-code.md (monitoring implementation)

> **Directive:** Define measurable Service Level Indicators, set internal Objectives with error budgets, and negotiate external Agreements. Use error budget policies to balance feature velocity against reliability. Follow the Google SRE approach.

---

## 1. Core Concepts

```
SLI (Service Level Indicator)    SLO (Service Level Objective)    SLA (Service Level Agreement)
├── WHAT you measure             ├── WHAT you target              ├── WHAT you promise externally
├── Quantitative metric          ├── Internal reliability goal    ├── Contractual obligation
├── Ratio: good events / total   ├── SLI >= threshold over window ├── SLO + consequences
├── Example: 99.3% of requests  ├── Example: 99.9% over 30d     ├── Example: 99.5% or credit
│   served in < 200ms           │                                │
└── Owned by: engineering        └── Owned by: eng + product      └── Owned by: business + legal

ERROR BUDGET = 1 - SLO target
  SLO 99.9%  → error budget = 0.1%  = 43.2 min/month downtime allowed
  SLO 99.95% → error budget = 0.05% = 21.6 min/month
  SLO 99.99% → error budget = 0.01% = 4.3 min/month
```

## 2. Service Level Indicators — What to Measure

```yaml
# sli-definitions.yaml — Canonical SLI catalog
slis:
  availability:
    formula: "count(status < 500) / count(total_requests)"
    measurement: server-side HTTP response codes
    exclude: [health_checks, synthetic_monitors]
  latency:
    formula: "count(duration < threshold) / count(total_requests)"
    percentiles: { p50: 100ms, p95: 250ms, p99: 1000ms }
    measurement: server-side duration from request receipt to response sent
  error_rate:
    formula: "count(status >= 500) / count(total_requests)"
    exclude_client_errors: true  # 4xx are client issues, not service failures
  throughput:
    formula: "count(total_requests) / time_window_seconds"
    use_for: capacity planning, not SLOs
  saturation:
    signals: [cpu_usage, memory_usage, queue_depth, connection_pool_utilization]
    threshold: alert at 80% sustained for 10 minutes
```

```promql
# SLI implementation in Prometheus
# Availability SLI
sum(rate(http_requests_total{status!~"5.."}[30d]))
/ sum(rate(http_requests_total[30d]))

# Latency SLI (proportion of requests < 200ms)
sum(rate(http_request_duration_seconds_bucket{le="0.2"}[30d]))
/ sum(rate(http_request_duration_seconds_count[30d]))

# Error rate SLI
1 - (sum(rate(http_requests_total{status=~"5.."}[30d]))
     / sum(rate(http_requests_total[30d])))
```

## 3. Service Level Objectives — Internal Targets

```yaml
# slo-definitions.yaml — SLO specifications per service
services:
  api-gateway:
    slos:
      - name: availability
        target: 99.95          # 21.6 min/month error budget
        window: rolling_30d
        owner: platform-team
      - name: latency-p95
        target: 99.0           # 99% of requests under 200ms
        threshold_ms: 200
        window: rolling_30d
      - name: latency-p99
        target: 95.0           # 95% of requests under 1000ms
        threshold_ms: 1000
        window: rolling_30d
  payment-service:
    slos:
      - name: availability
        target: 99.99          # 4.3 min/month — payment is critical
        window: rolling_30d
        owner: payments-team
      - name: latency-p95
        target: 99.5
        threshold_ms: 500
        window: rolling_30d
```

### Error Budget Calculation

```python
# error_budget.py — Track and report error budget consumption
from dataclasses import dataclass

@dataclass
class ErrorBudget:
    slo_target: float       # e.g., 99.9
    window_days: int        # e.g., 30
    total_requests: int
    failed_requests: int

    @property
    def budget_total(self) -> float:
        return self.total_requests * (1 - self.slo_target / 100)

    @property
    def budget_consumed(self) -> float:
        if self.budget_total == 0: return 100.0
        return (self.failed_requests / self.budget_total) * 100

    @property
    def budget_remaining(self) -> float:
        return max(0.0, 100.0 - self.budget_consumed)

    @property
    def budget_remaining_minutes(self) -> float:
        total_minutes = self.window_days * 24 * 60
        budget_minutes = total_minutes * (1 - self.slo_target / 100)
        return budget_minutes * (self.budget_remaining / 100)

    def can_deploy(self) -> bool:
        """Allow risky deployments only if budget > 25%."""
        return self.budget_remaining > 25.0

# Example: API gateway with 99.9% SLO over 30 days
eb = ErrorBudget(slo_target=99.9, window_days=30,
                 total_requests=10_000_000, failed_requests=5_000)
# budget_consumed=50.0%, remaining_minutes=21.6, can_deploy=True
```

## 4. Error Budget Policies

```yaml
# error-budget-policy.yaml — Actions triggered by budget consumption
policy:
  thresholds:
    - level: normal
      budget_remaining: ">50%"
      actions: [Normal velocity, standard deploys, optional reliability work]
    - level: caution
      budget_remaining: "25-50%"
      actions: [Canary all deploys, one reliability task/sprint, review incidents]
    - level: critical
      budget_remaining: "10-25%"
      actions: [Halt non-critical launches, VP approval for deploys, daily budget review]
    - level: exhausted
      budget_remaining: "<10%"
      actions: [Feature freeze, rollback correlated changes, incident commander assigned]
  review_cadence: weekly
  escalation_chain: [team-lead, eng-manager, VP-eng, CTO]
```

## 5. Multi-Window Multi-Burn-Rate Alerting

```yaml
# prometheus-slo-alerts.yaml — Google SRE alerting strategy
groups:
  - name: slo-burn-rate
    rules:
      # Fast burn: 14.4x over 1h (consumes 2% budget in 1h)
      - alert: SLOHighBurnRate_1h
        expr: |
          (sum(rate(http_requests_total{status=~"5.."}[1h]))
           / sum(rate(http_requests_total[1h]))) > (14.4 * 0.001)
        for: 2m
        labels: { severity: critical, window: 1h }
        annotations:
          summary: "SLO burn rate 14.4x — budget exhausted in ~1h"
      # Medium burn: 6x over 6h (consumes 5% budget)
      - alert: SLOHighBurnRate_6h
        expr: |
          (sum(rate(http_requests_total{status=~"5.."}[6h]))
           / sum(rate(http_requests_total[6h]))) > (6 * 0.001)
        for: 5m
        labels: { severity: warning, window: 6h }
      # Slow burn: 3x over 3d (consumes 10% budget)
      - alert: SLOHighBurnRate_3d
        expr: |
          (sum(rate(http_requests_total{status=~"5.."}[3d]))
           / sum(rate(http_requests_total[3d]))) > (3 * 0.001)
        for: 30m
        labels: { severity: warning, window: 3d }
```

```
MULTI-WINDOW STRATEGY (Google SRE):
  Burn Rate   Short Window   Long Window   Detection   Budget Consumed
  14.4x       5min           1h            2 min       2%
  6x          30min          6h            5 min       5%
  3x          2h             3d            30 min      10%
  1x          6h             30d           3h          (normal)
  Rule: Alert fires ONLY when BOTH windows exceed threshold → eliminates false positives.
```

## 6. SLO-Based Decision Making

```
FEATURE VELOCITY vs RELIABILITY TRADEOFF:
  Error Budget > 50%          Error Budget 10-50%         Error Budget < 10%
  ───────────────────         ────────────────────        ──────────────────
  Ship features fast          Moderate caution            Feature freeze
  Allow risky deploys         Require canary deploys      Only reliability work
  Experiment freely           Limit blast radius          Fix root causes

  KEY INSIGHT: Error budgets give product and engineering a SHARED LANGUAGE.
  Product cannot push for velocity when budget is exhausted.
  Engineering cannot demand reliability work when budget is healthy.
```

## 7. Service Level Agreements — External Contracts

```yaml
# sla-template.yaml — SLA = SLO + contractual consequences
sla:
  service: "Example Cloud API"
  commitments:
    - metric: monthly_uptime_percentage
      target: 99.9%
      measurement: "1 - (error_minutes / total_minutes_in_month)"
      exclusions: [Scheduled maintenance (72h notice), force majeure, customer-caused]
  credits:
    - uptime: "99.0% - 99.9%"  →  credit: "10% of monthly bill"
    - uptime: "95.0% - 99.0%"  →  credit: "25% of monthly bill"
    - uptime: "< 95.0%"        →  credit: "50% of monthly bill"
  # CRITICAL: SLA target MUST be lower than internal SLO
  # SLO: 99.95% (internal) → SLA: 99.9% (external) — gap is your buffer
```

## 8. SLO Dashboards

```json
// grafana-slo-dashboard.json — Essential panels
{
  "panels": [
    {
      "title": "SLO Status — 30-Day Rolling",
      "type": "gauge",
      "targets": [{ "expr": "slo:availability:ratio_30d * 100" }],
      "thresholds": [
        { "value": 99.0, "color": "red" },
        { "value": 99.5, "color": "orange" },
        { "value": 99.9, "color": "green" }
      ]
    },
    {
      "title": "Error Budget Remaining",
      "type": "stat",
      "targets": [{ "expr": "(1 - slo:error_budget:consumed_ratio) * 100" }],
      "thresholds": [
        { "value": 10, "color": "red" },
        { "value": 25, "color": "orange" },
        { "value": 50, "color": "green" }
      ]
    },
    {
      "title": "Error Budget Burn Rate",
      "type": "timeseries",
      "targets": [
        { "expr": "slo:burn_rate:1h", "legendFormat": "1h burn" },
        { "expr": "slo:burn_rate:6h", "legendFormat": "6h burn" },
        { "expr": "slo:burn_rate:3d", "legendFormat": "3d burn" }
      ]
    }
  ]
}
```

## 9. Google SRE Approach — Summary

```
1. Choose SLIs that reflect USER EXPERIENCE, not system internals
   Good: "request latency as perceived by user" | Bad: "CPU utilization"
2. Set SLOs based on user happiness, not system capability
   "Users notice degradation at p95 > 300ms" → SLO: 99% < 300ms
3. SLOs are a SOCIAL CONTRACT between product and engineering
4. Start with FEWER, broader SLOs — 1 availability + 1 latency per service
5. Review SLOs quarterly — too many alerts = target too tight
6. Aspirational vs achievable SLOs — use achievable for error budgets
```

---

## 10 Best Practices

1. **Derive SLIs from user journeys** — measure what users experience, not internal system metrics
2. **Set SLO targets below 100%** — 100% is impossible and leaves zero budget for change
3. **Keep SLA targets below SLO** — the gap is your buffer before contractual penalties apply
4. **Use error budgets to govern velocity** — exhausted budget means feature freeze, not optional slowdown
5. **Alert on burn rate, not raw errors** — multi-window burn-rate alerting eliminates false positives
6. **Define error budget policies before incidents** — pre-agreed policies prevent arguments during outages
7. **Start with two SLOs per service** — one availability, one latency; add more only when needed
8. **Exclude synthetic traffic from SLIs** — health checks and load tests distort real user metrics
9. **Review SLOs quarterly with product and engineering** — targets must evolve with user expectations
10. **Document SLIs with exact PromQL/SQL queries** — ambiguous definitions cause measurement disputes

## 8 Anti-Patterns

1. **SLO of 100%** — impossible target that makes error budgets useless and blocks all deployments
2. **SLIs based on system metrics** — CPU at 50% means nothing if users experience 5s latency
3. **No error budget policy** — without pre-agreed actions, teams argue about what to do at each threshold
4. **SLA tighter than SLO** — promising customers more than you target internally guarantees penalties
5. **Alerting on every error** — individual errors are noise; alert on sustained burn rate against budget
6. **Ignoring slow burns** — a 3x burn rate does not page but exhausts your budget in 10 days
7. **One SLO for all customer tiers** — premium and free-tier users have different reliability needs
8. **Setting SLOs and forgetting them** — stale SLOs drift from user expectations and lose credibility

## Enforcement Checklist

- [ ] SLIs defined with exact measurement queries for every critical service
- [ ] SLOs documented in version control with ownership assignments
- [ ] Error budgets calculated and displayed on team dashboards
- [ ] Error budget policy ratified by engineering and product leadership
- [ ] Multi-window burn-rate alerts configured in Prometheus/Grafana
- [ ] SLA targets set 0.05-0.1% below SLO targets for contractual buffer
- [ ] Quarterly SLO review meetings scheduled with cross-functional stakeholders
- [ ] Deployment gates check error budget before allowing risky releases
