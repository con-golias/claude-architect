# Alerting & SLOs

> **AI Plugin Directive — Alert Design, SLO Definition & Incident Detection**
> You are an AI coding assistant. When generating, reviewing, or refactoring alerting and
> SLO code, follow EVERY rule in this document. Bad alerts cause alert fatigue and miss real
> incidents. Treat each section as non-negotiable.

**Core Rule: ALWAYS define SLOs before creating alerts. ALWAYS alert on symptoms (user impact), NOT causes. ALWAYS include runbook links in alert annotations. NEVER create alerts that cannot be acted upon. ALWAYS have escalation paths for unacknowledged alerts.**

---

## 1. SLO Framework

```
┌──────────────────────────────────────────────────────────────┐
│              SLO Definitions                                  │
│                                                               │
│  SLI (Service Level Indicator)                               │
│  └── Measurable metric: "99.2% of requests < 200ms"        │
│                                                               │
│  SLO (Service Level Objective)                               │
│  └── Target: "99.9% availability over 30 days"             │
│                                                               │
│  Error Budget                                                │
│  └── Allowed failure: 0.1% = 43 minutes/month downtime     │
│                                                               │
│  SLA (Service Level Agreement)                               │
│  └── Contract: "99.9% uptime or credits issued"            │
│                                                               │
│  Rule: SLI measures, SLO targets, SLA contracts             │
│  Rule: SLO < SLA (internal target stricter than contract)   │
└──────────────────────────────────────────────────────────────┘
```

| SLO | SLI | Target | Window |
|-----|-----|--------|--------|
| **Availability** | Successful requests / total | 99.9% | 30 days |
| **Latency** | Requests < 200ms / total | 99% | 30 days |
| **Throughput** | Requests processed / expected | 95% | 1 hour |
| **Error rate** | Non-5xx / total requests | 99.9% | 30 days |

---

## 2. Alert Rules (Prometheus/Grafana)

```yaml
# Prometheus alert rules
groups:
  - name: service-alerts
    rules:
      # High error rate — symptom-based
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 1% for 5 minutes"
          runbook: "https://runbooks.example.com/high-error-rate"
          dashboard: "https://grafana.example.com/d/service-overview"

      # High latency
      - alert: HighLatencyP99
        expr: |
          histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency > 2s for 5 minutes"
          runbook: "https://runbooks.example.com/high-latency"

      # SLO error budget burn rate
      - alert: ErrorBudgetBurnRate
        expr: |
          1 - (
            sum(rate(http_requests_total{status!~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          ) > 14.4 * (1 - 0.999)
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error budget burning 14.4x faster than allowed"

      # Database connection pool exhaustion
      - alert: DBConnectionPoolExhausted
        expr: db_pool_active / db_pool_max > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool > 90% utilized"
```

---

## 3. Alert Design Principles

| Principle | Rule | Example |
|-----------|------|---------|
| **Symptom-based** | Alert on user impact, not cause | "Error rate > 1%" not "CPU > 80%" |
| **Actionable** | Every alert has a runbook | Link to specific remediation steps |
| **Minimal** | Fewer, higher-quality alerts | Merge related alerts |
| **Escalating** | Warning → Critical → Page | 5min warning, 15min page |
| **Burn-rate** | SLO-based burn rate alerts | Alert when budget consumed too fast |

```typescript
// TypeScript: error budget tracking
class ErrorBudget {
  constructor(
    private sloTarget: number,     // 0.999 = 99.9%
    private windowDays: number,    // 30
  ) {}

  get budgetMinutes(): number {
    return this.windowDays * 24 * 60 * (1 - this.sloTarget);
    // 30 days × 0.001 = 43.2 minutes
  }

  remainingBudget(errorMinutes: number): number {
    return this.budgetMinutes - errorMinutes;
  }

  burnRate(errorRate: number): number {
    // How fast is the budget being consumed?
    // 1.0 = on track, 14.4 = exhausted in 1 hour
    return errorRate / (1 - this.sloTarget);
  }
}
```

---

## 4. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Alert on every 5xx | Alert fatigue, ignored alerts | Alert on error rate, not individual errors |
| No runbook | On-call cannot act | Link runbook to every alert |
| Cause-based alerts | CPU alert but no user impact | Alert on symptoms (error rate, latency) |
| Too many alerts | Alert fatigue | Fewer, SLO-based alerts |
| No escalation | Critical alerts unacknowledged | Escalation after 15 minutes |
| Static thresholds | False positives on traffic changes | Use rate-based or anomaly detection |

---

## 5. Enforcement Checklist

- [ ] SLOs defined for availability, latency, error rate
- [ ] Error budget calculated and tracked
- [ ] Alerts are symptom-based (user impact), not cause-based
- [ ] Every alert has a runbook link
- [ ] Escalation path defined (warning → critical → page)
- [ ] Burn-rate alerts for SLO error budget
- [ ] Alert channels configured (PagerDuty, Slack, email)
- [ ] Alert noise reviewed monthly (remove/tune noisy alerts)
