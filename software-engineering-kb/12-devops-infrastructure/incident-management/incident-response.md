# Incident Response

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Incident Management                                                   |
| **Importance**     | Critical                                                                        |
| **Scope**          | Operational incident detection, triage, mitigation, and resolution              |
| **Audience**       | SREs, DevOps Engineers, Engineering Managers, On-Call Engineers                  |
| **Key Insight**    | Teams using unified Slack-native coordination platforms reduce MTTR by up to 80%; target median P1 MTTR below 30 minutes |
| **Cross-ref**      | [On-Call](on-call.md), [Postmortems](postmortems.md), [Security Incident Response](../../08-security/devsecops/incident-response.md), [SLI/SLO/SLA](../../09-performance/performance-culture/sli-slo-sla.md) |

> **Scope Distinction:** This file covers **operational incidents** (outages, performance degradation, deployment failures). For **security incidents** (breaches, evidence preservation, NIST SP 800-61 lifecycle, legal notification), see [08-security/devsecops/incident-response.md](../../08-security/devsecops/incident-response.md).

---

## Core Concepts

### Incident Definition

An incident is any unplanned event that causes or may cause a degradation or disruption to a service that requires an organized response beyond normal operations. Not every alert is an incident -- use clear criteria to distinguish.

```text
Alert vs Incident Decision:

  Alert fires
     │
     ├─ Auto-resolves within threshold? ──► Log, no incident
     │
     ├─ Requires single engineer < 15 min? ──► Operational task, no incident
     │
     └─ Requires coordination OR customer impact? ──► DECLARE INCIDENT
```

### Severity Levels

Define severity levels consistently across the organization. Every team must use the same scale.

| Severity | Name       | Description                                      | Response Time | Examples                                              |
|----------|------------|--------------------------------------------------|---------------|-------------------------------------------------------|
| **SEV1** | Critical   | Complete service outage or data loss/corruption   | < 5 min       | Production database down, payment processing failure, data breach (escalate to security) |
| **SEV2** | Major      | Significant degradation affecting many users      | < 15 min      | API latency > 10x normal, partial outage for a region, auth service at 50% capacity |
| **SEV3** | Minor      | Limited impact, workaround available              | < 60 min      | Single non-critical microservice down, elevated error rate on one endpoint, degraded search |
| **SEV4** | Low        | Minimal impact, cosmetic or edge-case issues      | Next business day | UI rendering bug in one browser, non-critical batch job delayed, monitoring gap |

```yaml
# severity-definitions.yaml -- Store in repo for single source of truth
severity_levels:
  SEV1:
    description: "Complete outage or data loss affecting all users"
    response_time_minutes: 5
    communication_cadence_minutes: 15
    requires_incident_commander: true
    auto_page: [primary_oncall, secondary_oncall, engineering_manager]
    status_page_update: immediate
    bridge_channel: automatic

  SEV2:
    description: "Significant degradation affecting many users"
    response_time_minutes: 15
    communication_cadence_minutes: 30
    requires_incident_commander: true
    auto_page: [primary_oncall]
    status_page_update: within_10_minutes
    bridge_channel: automatic

  SEV3:
    description: "Limited impact with workaround available"
    response_time_minutes: 60
    communication_cadence_minutes: 60
    requires_incident_commander: false
    auto_page: [primary_oncall]
    status_page_update: optional
    bridge_channel: on_request

  SEV4:
    description: "Minimal impact, cosmetic or edge-case"
    response_time_minutes: next_business_day
    communication_cadence_minutes: null
    requires_incident_commander: false
    auto_page: []
    status_page_update: none
    bridge_channel: none
```

### Incident Lifecycle

Follow the five-phase operational lifecycle. Each phase has distinct objectives and exit criteria.

```text
Incident Lifecycle:

  ┌──────────┐    ┌──────────┐    ┌────────────┐    ┌──────────┐    ┌─────────┐
  │  DETECT  │───►│  TRIAGE  │───►│  MITIGATE  │───►│  RESOLVE │───►│  LEARN  │
  └──────────┘    └──────────┘    └────────────┘    └──────────┘    └─────────┘
   Monitoring      Severity        Stop bleeding     Root cause      Postmortem
   Alerting        Assignment      Restore service   Permanent fix   Action items
   Customer rpt    Roles           Limit blast        Deploy fix     Share learnings
   Synthetic       War room        radius
```

**Phase 1 -- Detect:** Identify the anomaly through alerting, synthetic monitoring, customer reports, or internal tooling. Goal: minimize time-to-detect (TTD).

**Phase 2 -- Triage:** Assess severity, assign roles, open the incident channel, notify stakeholders. Goal: route to the right people within the response time SLA.

**Phase 3 -- Mitigate:** Restore service to an acceptable state. This is NOT the same as fixing the root cause. Rollback, feature flag kill switch, scaling up, traffic shedding, or failover are all valid. Goal: minimize customer impact duration.

**Phase 4 -- Resolve:** Apply the permanent fix after mitigation stabilizes the service. This may happen hours or days after mitigation. Goal: eliminate the root cause.

**Phase 5 -- Learn:** Conduct a blameless postmortem, document the timeline, identify action items, share learnings. See [postmortems.md](postmortems.md). Goal: prevent recurrence.

### Incident Command System (ICS)

Adopt a clear role structure based on Google's IMAG (Incident Management at Google) framework, built on the three Cs: **Coordinate, Communicate, Control**.

| Role                    | Responsibility                                                                                  | Who                              |
|-------------------------|-------------------------------------------------------------------------------------------------|----------------------------------|
| **Incident Commander (IC)** | Owns coordination. Sets priorities, assigns tasks, makes decisions when team is stuck. Does NOT debug directly. | Senior engineer or designated IC rotation |
| **Operations Lead (OL)**    | Owns mitigation. Directly investigates, applies fixes, coordinates technical work across teams. | On-call engineer or SME          |
| **Communications Lead (CL)**| Owns stakeholder communication. Updates status page, Slack channel, executive summary, and customer-facing messages. | Engineering manager or designated rotation |
| **Scribe (optional)**       | Documents timeline in real time. Captures decisions, actions, timestamps.                       | Any available team member        |

```python
# incident_roles.py -- Automated role assignment on incident declaration
from dataclasses import dataclass
from enum import Enum

class Severity(Enum):
    SEV1 = 1
    SEV2 = 2
    SEV3 = 3
    SEV4 = 4

@dataclass
class IncidentRoles:
    incident_commander: str
    operations_lead: str
    communications_lead: str | None
    scribe: str | None

def assign_roles(severity: Severity, on_call_primary: str,
                 on_call_secondary: str, eng_manager: str) -> IncidentRoles:
    """Assign incident roles based on severity."""
    if severity in (Severity.SEV1, Severity.SEV2):
        return IncidentRoles(
            incident_commander=on_call_secondary,  # IC should NOT be debugging
            operations_lead=on_call_primary,
            communications_lead=eng_manager,
            scribe=None,  # Assign in war room
        )
    # SEV3/SEV4: single engineer handles, no formal IC needed
    return IncidentRoles(
        incident_commander=on_call_primary,
        operations_lead=on_call_primary,
        communications_lead=None,
        scribe=None,
    )
```

### Communication Protocols

#### Status Page Updates

Update the external status page within the defined cadence for the severity level. Use factual, non-technical language.

```text
Status Page Update Template:

[INVESTIGATING] We are investigating reports of elevated error rates
on the API. Some users may experience intermittent failures.
Posted: 2026-03-10 14:32 UTC

[IDENTIFIED] The issue has been identified as a database connection
pool exhaustion. We are applying a mitigation.
Updated: 2026-03-10 14:48 UTC

[MONITORING] A fix has been applied and we are monitoring for
stability. Service is recovering.
Updated: 2026-03-10 15:05 UTC

[RESOLVED] The incident has been resolved. All services are
operating normally. A postmortem will follow.
Updated: 2026-03-10 15:32 UTC
```

#### War Room / Incident Channel

Create a dedicated Slack channel per incident using a consistent naming convention.

```bash
# Channel naming convention: #inc-YYYYMMDD-short-description
# Examples:
#   #inc-20260310-api-latency-spike
#   #inc-20260310-payment-outage

# Automated channel creation via incident.io / Rootly bot:
# 1. Bot creates channel on incident declaration
# 2. Pins severity, roles, runbook links, status page link
# 3. All discussion happens in-channel (single source of truth)
# 4. Channel is archived after postmortem is published
```

#### Stakeholder Communication Cadence

| Severity | Internal Update | Executive Update | Customer Update (Status Page) |
|----------|----------------|------------------|-------------------------------|
| SEV1     | Every 15 min   | Every 30 min     | Every 15 min                  |
| SEV2     | Every 30 min   | Every 60 min     | Every 30 min                  |
| SEV3     | Every 60 min   | On resolution    | Optional                      |
| SEV4     | On resolution  | None             | None                          |

### Detection Methods

Use multiple detection layers. Do not rely solely on alerting.

| Method                | TTD        | Description                                           |
|-----------------------|------------|-------------------------------------------------------|
| **Metric alerting**   | 1-5 min    | Prometheus/Datadog alerts on SLI burn rate             |
| **Log-based alerting**| 2-10 min   | Pattern matching on error spikes (ELK, Loki)          |
| **Synthetic monitoring** | 1-3 min | Periodic health checks from external locations        |
| **Customer reports**  | 10-60 min  | Support tickets, social media, direct reports          |
| **Anomaly detection** | 2-15 min   | ML-based deviation from baseline (Datadog, Dynatrace) |
| **Canary analysis**   | 5-30 min   | Automated canary deployment comparison                 |
| **Dependency checks** | 1-5 min    | Upstream/downstream service health probes              |

### Triage Decision Tree

```text
Incident Declared
     │
     ├─ Is there data loss or corruption?
     │   └─ YES ──► SEV1 + notify data team + preserve evidence
     │
     ├─ Is the service completely unavailable?
     │   └─ YES ──► SEV1 + page all responders
     │
     ├─ Are > 25% of users affected?
     │   └─ YES ──► SEV2 + page primary on-call
     │
     ├─ Is there a workaround?
     │   ├─ NO + user-facing ──► SEV2
     │   └─ YES ──► SEV3
     │
     └─ Minimal/no user impact ──► SEV4
```

### Mitigation Patterns

Apply the fastest mitigation first. Perfection is the enemy of restoration.

| Pattern                  | When to Use                                     | Speed  | Risk    |
|--------------------------|-------------------------------------------------|--------|---------|
| **Rollback**             | Bad deployment caused the issue                 | Fast   | Low     |
| **Feature flag kill switch** | New feature causing problems                | Fast   | Low     |
| **Scale up/out**         | Resource exhaustion (CPU, memory, connections)   | Medium | Low     |
| **Traffic shedding**     | Overload beyond capacity, shed non-critical traffic | Fast | Medium  |
| **Failover**             | Regional or AZ failure                          | Medium | Medium  |
| **Circuit breaker**      | Downstream dependency failure                    | Fast   | Low     |
| **DNS redirect**         | Route traffic to healthy region/backup           | Medium | Medium  |
| **Restart/recycle**      | Memory leaks, stuck processes                    | Fast   | Low     |
| **Data fix/hotpatch**    | Bad data causing cascading errors                | Slow   | High    |

```typescript
// mitigation-automation.ts -- Feature flag kill switch example
import { FeatureFlagClient } from "./feature-flags";
import { IncidentClient } from "./incident-client";

interface MitigationAction {
  type: "rollback" | "feature_flag" | "scale" | "traffic_shed" | "failover";
  target: string;
  params: Record<string, unknown>;
}

async function executeKillSwitch(
  flagKey: string,
  incidentId: string
): Promise<void> {
  const ff = new FeatureFlagClient();
  const incident = new IncidentClient();

  // Disable the feature flag
  await ff.updateFlag(flagKey, { enabled: false });

  // Log the action in the incident timeline
  await incident.addTimelineEntry(incidentId, {
    timestamp: new Date().toISOString(),
    action: `Feature flag "${flagKey}" disabled as mitigation`,
    actor: "automation",
    type: "mitigation",
  });

  // Post to incident channel
  await incident.postToChannel(incidentId,
    `:rotating_light: Feature flag \`${flagKey}\` has been disabled. ` +
    `Monitor dashboards for recovery.`
  );
}

async function executeRollback(
  service: string,
  targetRevision: string,
  incidentId: string
): Promise<void> {
  const incident = new IncidentClient();

  await incident.addTimelineEntry(incidentId, {
    timestamp: new Date().toISOString(),
    action: `Initiating rollback of ${service} to revision ${targetRevision}`,
    actor: "automation",
    type: "mitigation",
  });

  // Trigger deployment pipeline rollback
  // Implementation depends on CD platform (ArgoCD, Spinnaker, etc.)
}
```

### Resolution vs Root Cause Fix

| Aspect         | Mitigation                              | Resolution (Root Cause Fix)               |
|----------------|-----------------------------------------|-------------------------------------------|
| **Goal**       | Restore service to acceptable state     | Eliminate the underlying cause             |
| **Timeline**   | Minutes to hours                        | Hours to weeks                             |
| **Examples**   | Rollback, kill switch, scale up         | Code fix, architecture change, config fix  |
| **Tracking**   | Incident timeline                       | Postmortem action items in issue tracker   |
| **Priority**   | Immediate                               | Scheduled based on severity and risk       |

### Incident Tooling

| Tool              | Category           | Strengths                                               |
|-------------------|--------------------|----------------------------------------------------------|
| **incident.io**   | Coordination       | AI-driven automation (up to 80% of response), Slack-native, opinionated workflow |
| **Rootly**        | Coordination       | AI-powered Slack-native workflows, 40+ integrations, excellent for smaller teams |
| **FireHydrant**   | Coordination       | Service catalog-driven, strong process enforcement, full lifecycle |
| **PagerDuty**     | Alerting/Paging    | Industry standard for paging, robust escalation policies, broad integrations |
| **OpsGenie**      | Alerting/Paging    | Atlassian ecosystem integration, flexible routing, cost-effective |
| **Statuspage**    | Communication      | Atlassian product, standard for public status pages       |
| **Datadog**       | Detection          | Full-stack monitoring with incident management add-on     |
| **Grafana OnCall** | Alerting/Paging   | Open source, Grafana ecosystem, IRM capabilities          |

### Runbook Automation

Structure runbooks with clear decision points. Link every alert to its corresponding runbook.

```yaml
# runbook: api-high-error-rate.yaml
name: "API High Error Rate"
alert: api_error_rate_above_threshold
severity_default: SEV3
escalation_threshold: "If error rate > 50% for 5 min, escalate to SEV2"

steps:
  - name: "Check deployment timeline"
    action: |
      # Was there a recent deployment?
      kubectl rollout history deployment/api-server -n production
    decision:
      - condition: "Deployment within last 30 min"
        next: "rollback_deployment"
      - condition: "No recent deployment"
        next: "check_dependencies"

  - name: "rollback_deployment"
    action: |
      kubectl rollout undo deployment/api-server -n production
      # Monitor for 5 minutes
      watch -n 10 'curl -s https://api.example.com/health | jq .status'
    decision:
      - condition: "Error rate decreasing"
        next: "monitor_and_close"
      - condition: "No improvement"
        next: "check_dependencies"

  - name: "check_dependencies"
    action: |
      # Check database connectivity
      psql -h db-primary.internal -c "SELECT 1" -t
      # Check Redis
      redis-cli -h cache.internal ping
      # Check downstream services
      curl -s https://payments.internal/health
    decision:
      - condition: "Database unreachable"
        next: "database_failover_runbook"
      - condition: "Cache unreachable"
        next: "cache_recovery_runbook"
      - condition: "All dependencies healthy"
        next: "investigate_application"

  - name: "investigate_application"
    action: |
      # Check resource utilization
      kubectl top pods -n production -l app=api-server
      # Check recent logs
      kubectl logs -n production -l app=api-server --tail=100 --since=10m
      # Check connection pools
      curl -s https://api.example.com/metrics | grep pool
    decision:
      - condition: "Resource exhaustion"
        next: "scale_up"
      - condition: "Application error pattern found"
        next: "escalate_to_dev_team"

  - name: "scale_up"
    action: |
      kubectl scale deployment/api-server -n production --replicas=10
    next: "monitor_and_close"

  - name: "monitor_and_close"
    action: |
      echo "Monitor dashboards for 15 minutes. If stable, mark incident as resolved."
```

### Incident Timeline Documentation

Record every significant event during the incident in real time. Use UTC timestamps.

```typescript
// incident-timeline.ts -- Timeline entry structure
interface TimelineEntry {
  timestamp: string;       // ISO 8601 UTC
  author: string;          // Person or automation
  type: "detection" | "triage" | "communication" | "action"
        | "mitigation" | "escalation" | "resolution";
  description: string;     // What happened
  evidence?: string;       // Link to dashboard, log query, screenshot
}

// Example timeline:
const exampleTimeline: TimelineEntry[] = [
  {
    timestamp: "2026-03-10T14:28:00Z",
    author: "Datadog Alert",
    type: "detection",
    description: "Alert fired: API error rate > 5% for 3 minutes",
    evidence: "https://app.datadoghq.com/monitors/12345",
  },
  {
    timestamp: "2026-03-10T14:30:00Z",
    author: "alice@company.com",
    type: "triage",
    description: "Acknowledged alert. Error rate at 12%. Declaring SEV2.",
  },
  {
    timestamp: "2026-03-10T14:32:00Z",
    author: "incident-bot",
    type: "communication",
    description: "Incident channel #inc-20260310-api-errors created. Roles assigned.",
  },
  {
    timestamp: "2026-03-10T14:38:00Z",
    author: "alice@company.com",
    type: "action",
    description: "Identified bad deployment v2.14.3 deployed at 14:15. Initiating rollback.",
    evidence: "https://argocd.internal/applications/api-server",
  },
  {
    timestamp: "2026-03-10T14:42:00Z",
    author: "alice@company.com",
    type: "mitigation",
    description: "Rollback to v2.14.2 complete. Error rate dropping.",
  },
  {
    timestamp: "2026-03-10T14:55:00Z",
    author: "alice@company.com",
    type: "resolution",
    description: "Error rate back to baseline (< 0.1%). Incident resolved. MTTR: 27 minutes.",
  },
];
```

---

## Best Practices

1. **Declare incidents early and generously.** It is cheaper to declare an incident that turns out to be minor than to delay response on a real outage. Lower the threshold for declaration.

2. **Separate mitigation from root cause investigation.** Restore service first, investigate later. The IC must enforce this -- do not let engineers chase root cause while users are impacted.

3. **Assign an Incident Commander for all SEV1/SEV2 incidents.** The IC must not be the same person debugging the issue. Their job is coordination, not technical work.

4. **Use a single communication channel per incident.** All discussion happens in the dedicated Slack channel. No side conversations in DMs. Pin critical information.

5. **Automate incident declaration and role assignment.** Use incident.io, Rootly, or equivalent to create channels, assign roles, and post runbook links automatically on declaration.

6. **Link every alert to a runbook.** An alert without a runbook is an alert that wastes time. Include the runbook URL in the alert annotation/description.

7. **Maintain an incident timeline from minute one.** The scribe (or bot) documents every action with timestamps. This is the foundation of the postmortem.

8. **Update the status page proactively, not reactively.** Customers finding out about outages from Twitter before your status page destroys trust. Update within the defined cadence.

9. **Practice incident response through game days.** Run simulated incidents quarterly. Include realistic scenarios: on-call handoff mid-incident, escalation to secondary, status page updates.

10. **Track MTTD, MTTR, and incident frequency as organizational metrics.** Review monthly. Set targets (e.g., P1 MTTR < 30 min). Use trends to drive investment in reliability.

---

## Anti-Patterns

| Anti-Pattern | Problem | Remedy |
|---|---|---|
| **Hero culture** | One person always handles incidents, creating single point of failure and burnout | Enforce rotation, distribute knowledge through runbooks and pairing |
| **Severity inflation** | Everything is SEV1, causing alert fatigue and misallocation of resources | Define clear, measurable criteria per severity; audit severity accuracy monthly |
| **Root cause tunnel vision** | Engineers chase root cause during active outage instead of mitigating | IC enforces "mitigate first" rule; separate mitigation from investigation phases |
| **Slack DM debugging** | Critical information scattered across private messages, not in the incident channel | Policy: all incident discussion in the incident channel; IC redirects DM conversations |
| **Manual status updates** | Status page goes stale because updates are manual and forgotten under pressure | Automate status page updates from incident tool; CL role owns cadence reminders |
| **No runbooks** | On-call engineer pages through unfamiliar service with no guidance at 3 AM | Require runbook for every alerting rule; block alert creation without runbook link |
| **Premature all-clear** | Incident declared resolved before stability is confirmed, leading to re-escalation | Require 15-min monitoring period after mitigation before resolving; define exit criteria |
| **Post-incident amnesia** | No postmortem written, same incident recurs weeks later | Mandate postmortem for all SEV1/SEV2 within 72 hours; track completion rate |

---

## Enforcement Checklist

- [ ] Severity levels (SEV1-SEV4) are defined with measurable criteria and documented in a shared repository
- [ ] Incident Commander rotation is established and trained (minimum 4 qualified ICs)
- [ ] Automated incident channel creation is configured (incident.io, Rootly, or equivalent)
- [ ] Every monitoring alert has a linked runbook with decision tree
- [ ] Status page update cadence is defined per severity level and enforced by tooling
- [ ] Escalation policies are configured in PagerDuty/OpsGenie with timeout-based auto-escalation
- [ ] Incident timeline documentation is automated (bot captures messages, actions, timestamps)
- [ ] Game day exercises are scheduled quarterly with realistic scenarios
- [ ] MTTD and MTTR metrics are tracked per severity level and reviewed monthly
- [ ] Postmortem trigger criteria are defined (all SEV1/SEV2, optional SEV3)
- [ ] Communication templates exist for status page, executive summary, and customer notification
- [ ] Incident response process is documented and accessible to all engineers (not just SRE)
