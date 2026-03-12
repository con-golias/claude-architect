# On-Call

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Incident Management                                                   |
| **Importance**     | High                                                                            |
| **Scope**          | On-call rotation design, alert quality, escalation, runbooks, sustainability    |
| **Audience**       | SREs, DevOps Engineers, Engineering Managers, Platform Teams                    |
| **Key Insight**    | Sustainable on-call means max 2-3 actionable incidents per shift (Google SRE); every page must be actionable, urgent, and require human judgment |
| **Cross-ref**      | [Incident Response](incident-response.md), [Postmortems](postmortems.md), [Alerting](../../monitoring-observability/metrics/alerting.md) |

---

## Core Concepts

### On-Call Philosophy

On-call is a shared engineering responsibility, not a punishment. The goal is to maintain service reliability while preserving engineer well-being. Build on-call into the culture so every engineer who writes production code shares responsibility for operating it.

**Core Principles:**

- **You build it, you run it.** Teams own the operational health of their services.
- **Actionable alerts only.** Every page must require human judgment and have a defined response.
- **Sustainable rotations.** No individual should be on-call more than 25% of their time (Google SRE guideline).
- **Continuous improvement.** Every on-call shift should leave the system better than it was found.
- **Compensate fairly.** On-call work is real work. Compensate it explicitly.

### Rotation Design

#### Rotation Models

| Model               | Best For                     | Shift Length   | Pros                                       | Cons                                     |
|----------------------|------------------------------|----------------|--------------------------------------------|--------------------------------------------|
| **Weekly**           | Small teams (4-6 people)     | 7 days         | Simple, consistent context                 | Long shifts, night fatigue                 |
| **Bi-weekly**        | Medium teams (6-10)          | 14 days        | Fewer handoffs                             | Longer exposure, higher burnout risk       |
| **Follow-the-sun**   | Distributed global teams     | 8-12 hours     | No night pages, natural handoff            | Requires teams in 2-3 time zones           |
| **Split day/night**  | Teams in one time zone       | 12 hours       | No single person loses all sleep           | More handoffs, complex scheduling          |
| **Business hours only** | Low-criticality services  | 8-10 hours     | No after-hours disruption                  | Gaps in coverage, not for critical services|

#### Primary / Secondary / Shadow Structure

```text
On-Call Escalation Layers:

  ┌──────────────┐     5 min timeout    ┌────────────────┐    10 min timeout   ┌───────────────┐
  │   Primary    │────────────────────►  │   Secondary    │───────────────────► │    Manager    │
  │  On-Call     │  (auto-escalate)      │   On-Call      │  (auto-escalate)    │   Escalation  │
  └──────────────┘                       └────────────────┘                     └───────────────┘
         │
         │ (shadow joins for learning)
         ▼
  ┌──────────────┐
  │    Shadow    │
  │  (observer)  │
  └──────────────┘

  Shadow: Observes primary for 1-2 rotations before going primary.
  Does NOT carry pager. Joins incident channels to learn.
```

#### Follow-the-Sun Example

```yaml
# follow-the-sun-rotation.yaml
rotation:
  name: "API Team Follow-the-Sun"
  type: follow_the_sun
  handoff_buffer_minutes: 30  # Overlap for context transfer

  shifts:
    - name: "APAC"
      timezone: "Asia/Tokyo"
      start: "09:00"
      end: "17:00"
      team: [sato, chen, park]

    - name: "EMEA"
      timezone: "Europe/London"
      start: "09:00"
      end: "17:00"
      team: [mueller, silva, ahmed]

    - name: "Americas"
      timezone: "America/New_York"
      start: "09:00"
      end: "17:00"
      team: [johnson, garcia, smith]
```

### On-Call Compensation and Fairness

Compensate on-call work explicitly. Track distribution to ensure fairness.

| Compensation Model       | Description                                         |
|--------------------------|-----------------------------------------------------|
| **Flat stipend**         | Fixed amount per on-call shift (e.g., $500/week)    |
| **Per-page bonus**       | Additional payment per incident page                 |
| **Time-off-in-lieu**     | Compensatory time off after on-call shifts           |
| **Hybrid**               | Flat stipend + per-page bonus for after-hours pages  |
| **Reduced sprint work**  | On-call week = reduced feature work expectations     |

Track on-call burden per engineer over time. Flag imbalances (e.g., one person consistently handling holiday rotations).

### Alert Quality

The single biggest factor in on-call sustainability is alert quality. Every alert must pass the "3 AM test": if this alert wakes an engineer at 3 AM, is there a meaningful action they can take right now?

#### Alert Quality Criteria

```text
Every alert MUST be:

  ┌─────────────┐   ┌──────────┐   ┌───────────────────┐
  │  ACTIONABLE │ + │  URGENT  │ + │  REQUIRES HUMAN   │
  │             │   │          │   │  JUDGMENT          │
  └─────────────┘   └──────────┘   └───────────────────┘

  If an alert fails ANY of these, it should be:
  - Removed entirely
  - Converted to a dashboard/log query
  - Converted to a ticket (non-paging)
```

#### Signal vs Noise

| Metric                  | Target          | Description                                      |
|-------------------------|-----------------|--------------------------------------------------|
| **Pages per shift**     | 2-3 max         | Google SRE recommendation for sustainable on-call |
| **False positive rate** | < 5%            | Alerts that fire but require no action            |
| **SNR (signal-to-noise)**| > 90%          | Percentage of pages that are real incidents        |
| **After-hours pages**   | < 30% of total  | Most pages should happen during business hours     |
| **Auto-resolved alerts**| Track and reduce| Alerts that resolve before human action            |

```python
# alert_quality_audit.py -- Monthly alert quality report
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List

@dataclass
class AlertEvent:
    alert_name: str
    fired_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    was_actionable: bool
    resulted_in_incident: bool
    after_hours: bool  # Outside 9 AM - 6 PM local

def generate_alert_quality_report(
    alerts: List[AlertEvent],
    period_days: int = 30
) -> dict:
    """Generate monthly alert quality metrics."""
    total = len(alerts)
    if total == 0:
        return {"error": "No alerts in period"}

    actionable = sum(1 for a in alerts if a.was_actionable)
    false_positives = total - actionable
    after_hours = sum(1 for a in alerts if a.after_hours)
    incidents = sum(1 for a in alerts if a.resulted_in_incident)

    # Group by alert name to find noisy alerts
    alert_counts: dict[str, int] = {}
    for a in alerts:
        alert_counts[a.alert_name] = alert_counts.get(a.alert_name, 0) + 1

    noisiest = sorted(alert_counts.items(), key=lambda x: x[1], reverse=True)

    return {
        "period_days": period_days,
        "total_alerts": total,
        "actionable_rate": round(actionable / total * 100, 1),
        "false_positive_rate": round(false_positives / total * 100, 1),
        "after_hours_rate": round(after_hours / total * 100, 1),
        "incident_rate": round(incidents / total * 100, 1),
        "pages_per_day": round(total / period_days, 1),
        "top_5_noisiest_alerts": noisiest[:5],
        "recommendation": (
            "HEALTHY" if actionable / total > 0.9
            else "NEEDS_TUNING" if actionable / total > 0.7
            else "CRITICAL_NOISE"
        ),
    }
```

### Escalation Policies

Configure timeout-based escalation to prevent pages from going unacknowledged.

```hcl
# pagerduty-escalation.tf -- Terraform configuration
resource "pagerduty_escalation_policy" "production_api" {
  name      = "Production API Escalation"
  num_loops = 2  # Loop through all rules twice before stopping

  teams = [pagerduty_team.platform.id]

  # Level 1: Primary on-call
  rule {
    escalation_delay_in_minutes = 5
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.api_primary.id
    }
  }

  # Level 2: Secondary on-call
  rule {
    escalation_delay_in_minutes = 10
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.api_secondary.id
    }
  }

  # Level 3: Engineering manager
  rule {
    escalation_delay_in_minutes = 10
    target {
      type = "user_reference"
      id   = pagerduty_user.eng_manager.id
    }
  }
}

# Alert routing: route by service and severity
resource "pagerduty_service" "api_production" {
  name              = "API Production"
  escalation_policy = pagerduty_escalation_policy.production_api.id

  alert_creation    = "create_alerts_and_incidents"
  auto_resolve_timeout = 14400  # Auto-resolve after 4 hours

  incident_urgency_rule {
    type = "use_support_hours"

    during_support_hours {
      type    = "constant"
      urgency = "high"
    }

    outside_support_hours {
      type    = "constant"
      urgency = "high"  # Critical services: always high urgency
    }
  }

  support_hours {
    type         = "fixed_time_per_day"
    time_zone    = "America/New_York"
    start_time   = "09:00:00"
    end_time     = "17:00:00"
    days_of_week = [1, 2, 3, 4, 5]
  }
}
```

### Alert Routing Rules

Route alerts to the right team and severity based on service, environment, and conditions.

```yaml
# alert-routing.yaml -- OpsGenie / Grafana OnCall style
routing_rules:
  - name: "Critical production alerts"
    conditions:
      - field: severity
        operation: equals
        value: critical
      - field: environment
        operation: equals
        value: production
    actions:
      notify:
        - type: escalation_policy
          name: "Production Critical"
      tags:
        - "sev1"
        - "auto-incident"

  - name: "Warning production alerts"
    conditions:
      - field: severity
        operation: equals
        value: warning
      - field: environment
        operation: equals
        value: production
    actions:
      notify:
        - type: schedule
          name: "Primary On-Call"
      tags:
        - "sev3"

  - name: "Staging alerts (business hours only)"
    conditions:
      - field: environment
        operation: equals
        value: staging
    time_restriction:
      type: weekday_and_time_of_day
      restrictions:
        - start_hour: 9
          end_hour: 18
          days: [monday, tuesday, wednesday, thursday, friday]
    actions:
      notify:
        - type: team
          name: "Platform Team"
```

### On-Call Handoff Practices

Structured handoffs prevent context loss between shifts.

```markdown
# On-Call Handoff Template

## Shift Summary: 2026-03-03 to 2026-03-10

### Outgoing On-Call: Alice
### Incoming On-Call: Bob

### Open Incidents
- INC-2341: Intermittent Redis timeouts (SEV3, monitoring)
  - Status: Mitigation applied (connection pool increase), watching for recurrence
  - Action needed: If timeouts resume, escalate to database team

### Recent Incidents (Resolved)
- INC-2338: API latency spike (SEV2, resolved 2026-03-07)
  - Postmortem pending, action items being tracked in JIRA

### Alerts to Watch
- `redis_connection_errors` may flap -- threshold was adjusted, monitor for false positives
- New canary deployment of auth-service v3.2 rolling out Tuesday

### Ongoing Maintenance
- Database migration scheduled for Thursday 02:00 UTC (maintenance window)
- CDN certificate renewal Friday (automated, but verify)

### Runbook Updates
- Updated `redis-timeout-runbook.md` with new connection pool commands
```

### Runbook Structure

Every service must have runbooks linked from its alerts. Use a consistent template.

```yaml
# runbook-template.yaml
metadata:
  service: "payment-service"
  alert: "payment_processing_failure_rate"
  last_updated: "2026-03-01"
  owner: "payments-team"
  review_cadence: "quarterly"

summary: |
  Payment processing failure rate exceeds threshold.
  This indicates failures in the payment gateway integration
  or downstream service issues.

severity_guide:
  sev2: "Failure rate > 10% for > 5 minutes"
  sev3: "Failure rate > 5% for > 10 minutes"

investigation_steps:
  - step: "Check payment gateway status"
    command: "curl -s https://status.stripe.com/api/v2/status.json | jq ."
    expected: ".status.indicator should be 'none'"
    if_abnormal: "Gateway outage. Enable fallback gateway. See step 4."

  - step: "Check service health"
    command: "kubectl get pods -n payments -l app=payment-service"
    expected: "All pods Running, no restarts"
    if_abnormal: "Restart unhealthy pods: kubectl rollout restart deployment/payment-service -n payments"

  - step: "Check recent deployments"
    command: "kubectl rollout history deployment/payment-service -n payments | tail -5"
    expected: "No deployment in last 30 minutes"
    if_abnormal: "Rollback: kubectl rollout undo deployment/payment-service -n payments"

  - step: "Enable fallback gateway"
    command: |
      # Toggle feature flag to route to backup payment processor
      curl -X PATCH https://api.launchdarkly.com/api/v2/flags/payments/payment-gateway-fallback \
        -H "Authorization: $LD_API_KEY" \
        -d '{"op": "replace", "path": "/environments/production/on", "value": true}'
    caution: "Fallback gateway has higher transaction fees. Revert when primary recovers."

escalation:
  - condition: "Issue persists after all steps"
    action: "Escalate to payments-team lead and payment gateway vendor support"
  - condition: "Data inconsistency detected"
    action: "Escalate to SEV1. Notify finance team. Do NOT retry failed transactions."
```

### On-Call Onboarding

Graduate new engineers through a structured ramp-up.

```text
On-Call Onboarding Path:

Week 1-2: SHADOW
  ├─ Join incident channels as observer
  ├─ Read all runbooks for owned services
  ├─ Complete service architecture walkthrough
  └─ Review last 5 postmortems

Week 3-4: REVERSE SHADOW
  ├─ Carry pager as primary
  ├─ Experienced engineer available as immediate backup
  ├─ Handle alerts with guidance
  └─ Debrief after each page

Week 5+: PRIMARY
  ├─ Full primary on-call responsibility
  ├─ Secondary on-call available via normal escalation
  └─ Post-shift review for first 2 solo rotations
```

### On-Call Metrics

Track these metrics monthly and review in team retrospectives.

| Metric                        | Target               | Description                                         |
|-------------------------------|----------------------|-----------------------------------------------------|
| **Pages per shift**           | <= 3                 | Total pages per on-call shift                       |
| **MTTA (Mean Time to Ack)**   | < 5 min              | Time from page to acknowledgment                    |
| **After-hours page %**        | < 30%                | Pages outside business hours                        |
| **False positive rate**       | < 5%                 | Alerts that required no action                      |
| **Escalation rate**           | < 10%                | Pages that escalated past primary                   |
| **Handoff quality score**     | > 4/5 (survey)       | Incoming on-call rates handoff completeness          |
| **Toil hours per shift**      | < 2 hours            | Time spent on manual, repetitive operational work   |
| **On-call satisfaction**      | > 3.5/5 (survey)     | Engineer satisfaction with on-call experience        |

### Toil Measurement and Reduction

Toil is manual, repetitive, automatable work that scales linearly with service size. Measure and systematically eliminate it.

```python
# toil_tracker.py -- Track toil during on-call shifts
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

class ToilCategory(Enum):
    MANUAL_RESTART = "manual_restart"
    LOG_INVESTIGATION = "log_investigation"
    CAPACITY_MANAGEMENT = "capacity_management"
    CONFIG_CHANGE = "config_change"
    DATA_FIX = "data_fix"
    CERTIFICATE_RENEWAL = "certificate_renewal"
    OTHER = "other"

@dataclass
class ToilEntry:
    category: ToilCategory
    description: str
    duration_minutes: int
    automatable: bool
    frequency: str  # "daily", "weekly", "monthly", "per_incident"

def calculate_toil_budget(entries: list[ToilEntry]) -> dict:
    """Calculate toil as percentage of on-call time.
    Google SRE target: toil < 50% of on-call time."""
    total_minutes = sum(e.duration_minutes for e in entries)
    automatable_minutes = sum(
        e.duration_minutes for e in entries if e.automatable
    )
    shift_hours = 7 * 24  # Weekly shift in hours
    shift_minutes = shift_hours * 60

    return {
        "total_toil_minutes": total_minutes,
        "toil_percentage": round(total_minutes / shift_minutes * 100, 1),
        "automatable_minutes": automatable_minutes,
        "automation_opportunity_pct": round(
            automatable_minutes / max(total_minutes, 1) * 100, 1
        ),
        "top_categories": _top_categories(entries),
        "status": "HEALTHY" if total_minutes / shift_minutes < 0.25
                  else "WARNING" if total_minutes / shift_minutes < 0.50
                  else "CRITICAL",
    }

def _top_categories(entries: list[ToilEntry]) -> list[tuple[str, int]]:
    by_cat: dict[str, int] = {}
    for e in entries:
        by_cat[e.category.value] = by_cat.get(e.category.value, 0) + e.duration_minutes
    return sorted(by_cat.items(), key=lambda x: x[1], reverse=True)[:5]
```

### On-Call Mental Health and Burnout Prevention

- **Enforce maximum on-call frequency.** No more than one week in four. Google SRE recommends max 25% of time.
- **Provide rest after high-severity incidents.** If an engineer is paged multiple times overnight, give them the next day off or a late start.
- **Monitor cumulative page load.** Track pages per person over quarters, not just per shift.
- **Create a "no judgement" escalation culture.** Engineers should feel safe escalating when overwhelmed, confused, or fatigued.
- **Rotate fairly across holidays and weekends.** Track and balance holiday on-call over the year.
- **Conduct quarterly on-call satisfaction surveys.** Act on feedback.

### On-Call for Distributed Teams

| Challenge                     | Solution                                            |
|-------------------------------|-----------------------------------------------------|
| Time zone gaps                | Follow-the-sun rotation with 30-min handoff overlap |
| Cultural differences          | Written handoff templates, async-friendly processes  |
| Uneven team sizes per region  | Cross-train engineers across regions, hire to balance|
| Handoff quality               | Structured handoff document + short sync call        |
| Tooling consistency           | Single global PagerDuty/OpsGenie instance            |

---

## Best Practices

1. **Enforce the "every alert must be actionable" rule.** Audit alerts monthly. Delete or convert any alert that is not actionable, urgent, and requiring human judgment.

2. **Limit pages to 2-3 per on-call shift as a hard target.** If a team consistently exceeds this, invest in reliability engineering or reduce the on-call scope.

3. **Use primary/secondary/shadow structure for all critical services.** Primary handles pages, secondary is backup, shadow learns. This ensures coverage and training.

4. **Conduct structured handoffs at every rotation change.** Use a written handoff template covering open incidents, recent changes, alerts to watch, and scheduled maintenance.

5. **Link every alert to a runbook.** Block alert creation in CI/CD if no runbook URL is provided. Review runbooks quarterly for accuracy.

6. **Track alert quality metrics monthly and publish them.** Pages per shift, false positive rate, after-hours percentage. Make this a team-level KPI.

7. **Provide on-call compensation that reflects the burden.** Whether stipend, time-off-in-lieu, or reduced sprint work, make it explicit and fair.

8. **Graduate new on-call engineers through shadow rotations.** Minimum 2 weeks of shadowing before carrying the pager as primary. Debrief after first solo shifts.

9. **Automate toil systematically.** Track toil per shift, prioritize automation of the highest-frequency manual tasks. Target toil below 25% of on-call time.

10. **Conduct quarterly on-call retrospectives.** Review metrics, satisfaction surveys, and incident trends. Adjust rotations, alert thresholds, and runbooks based on findings.

---

## Anti-Patterns

| Anti-Pattern | Problem | Remedy |
|---|---|---|
| **Alert firehose** | Dozens of alerts per shift, most non-actionable; engineers ignore pages | Audit and prune alerts; enforce 2-3 pages/shift target; delete noisy alerts |
| **Permanent on-call** | Same person always on-call because "they know the system best" | Document knowledge in runbooks; enforce rotation; cross-train team members |
| **No escalation path** | Primary on-call has no backup; if unreachable, incident goes unhandled | Configure automatic escalation with timeouts; always have secondary on-call |
| **Tribal knowledge runbooks** | Runbooks exist only in people's heads; new on-call engineers are lost | Write runbooks with explicit commands and decision trees; link from every alert |
| **On-call as punishment** | On-call duty assigned to junior engineers or disliked teams as penalty | Make on-call a shared team responsibility; compensate fairly; include seniors |
| **No handoff** | Shift changes with zero context transfer; incoming on-call unaware of ongoing issues | Mandate written handoff template; overlap shifts by 30 minutes for sync |
| **Weekend warrior** | Single engineer covers all weekends while others only do weekdays | Track weekend/holiday distribution; rotate fairly; compensate extra for weekends |
| **Silenced alerts** | Engineers silence alerts to reduce noise instead of fixing root cause | Track silenced alerts; require justification; fix underlying issue within 30 days |

---

## Enforcement Checklist

- [ ] On-call rotation covers all critical services with primary and secondary responders
- [ ] Escalation policies are configured with automatic timeout-based escalation (5 min primary, 10 min secondary)
- [ ] Every alert has a linked runbook with investigation steps and decision points
- [ ] Alert quality is audited monthly (pages/shift, false positive rate, after-hours %)
- [ ] On-call compensation model is defined and communicated to all engineers
- [ ] Handoff template is used at every rotation change with written summary
- [ ] Shadow rotation program exists for onboarding new on-call engineers
- [ ] On-call satisfaction survey is conducted quarterly and results are acted upon
- [ ] Toil is tracked per shift and top automation opportunities are prioritized
- [ ] Maximum on-call frequency is enforced (no more than 1 week in 4)
- [ ] Follow-the-sun or equivalent model is used for globally distributed teams
- [ ] On-call metrics dashboard is visible to team and management
