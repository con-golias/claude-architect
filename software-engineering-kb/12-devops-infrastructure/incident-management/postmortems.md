# Postmortems

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Incident Management                                                   |
| **Importance**     | High                                                                            |
| **Scope**          | Blameless postmortem culture, root cause analysis, action items, learning       |
| **Audience**       | SREs, DevOps Engineers, Engineering Managers, All Engineers                     |
| **Key Insight**    | Teams using structured postmortems reduce repeat incidents by 40%+; publish within 24-72 hours while context is fresh |
| **Cross-ref**      | [Incident Response](incident-response.md), [On-Call](on-call.md), [SLI/SLO/SLA](../../09-performance/performance-culture/sli-slo-sla.md), [Security Incident Response](../../08-security/devsecops/incident-response.md) |

---

## Core Concepts

### Blameless Postmortem Culture

A blameless postmortem assumes every individual acted with the best intentions based on the information available at the time. The goal is to improve systems, processes, and tooling -- not to assign blame.

**Core Principles (Google SRE):**

- Focus on **what happened**, not **who caused it**. Refer to individuals by role (e.g., "the on-call payments engineer"), not by name.
- Assume people made reasonable decisions given the context they had. The system allowed the failure -- fix the system.
- Encourage honest, detailed accounts without fear of punishment. Engineers who fear blame will hide information.
- Postmortems are a **learning opportunity**, not a disciplinary process.
- Writing a postmortem is **rewarded**, not punished. The engineer who writes a thorough postmortem is contributing more than the one who avoids it.

```text
Blameless Framing:

  WRONG: "John deployed bad code that caused the outage."

  RIGHT: "A deployment containing a query regression was promoted to
          production. The existing review process did not catch the
          performance impact, and automated canary analysis was not
          configured for this service."

  The second framing identifies systemic gaps (review process,
  canary analysis) that can be fixed. The first just assigns blame.
```

**Blame-Aware Alternative:** Some organizations (notably incident.io) advocate for "accountable learning" -- acknowledging that individuals make decisions while still focusing on systemic improvements. The key distinction: accountability means understanding decisions in context, not punishment.

### Postmortem Trigger Criteria

Define clear criteria for when a postmortem is required. Do not leave it to judgment.

| Condition                                              | Postmortem Required? |
|--------------------------------------------------------|----------------------|
| SEV1 incident                                          | **Always**           |
| SEV2 incident                                          | **Always**           |
| SEV3 incident                                          | Team discretion      |
| Any incident involving data loss or corruption         | **Always**           |
| Customer-reported issue that took > 1 hour to resolve  | **Always**           |
| Incident that required escalation beyond primary on-call| Recommended          |
| Near-miss that could have been SEV1/SEV2               | Recommended          |
| Recurring incident (3rd occurrence of same issue)      | **Always**           |
| Incident involving security component                  | **Always** (coordinate with security; see [08-security](../../08-security/devsecops/incident-response.md)) |

### Postmortem Template

Use a consistent template across the organization. Store postmortems in a searchable repository (wiki, Git, or dedicated tool).

```markdown
# Postmortem: [INC-XXXX] Short Description

## Metadata
| Field              | Value                              |
|--------------------|------------------------------------|
| **Incident ID**    | INC-2341                           |
| **Date**           | 2026-03-10                         |
| **Severity**       | SEV2                               |
| **Duration**       | 47 minutes (14:28 - 15:15 UTC)     |
| **Impact**         | 12% of API requests failed for 47 min; ~15,000 users affected |
| **Detection**      | Automated alerting (Datadog)       |
| **MTTD**           | 3 minutes                          |
| **MTTR**           | 27 minutes (from detection to mitigation) |
| **Authors**        | Platform Team                      |
| **Reviewers**      | [Engineering Manager, SRE Lead]    |
| **Status**         | Complete                           |

## Summary

A database connection pool exhaustion caused cascading failures in the
API layer. The root cause was a missing connection timeout on a new
database query introduced in v2.14.3. The issue was mitigated by rolling
back to v2.14.2 and resolved permanently by adding connection timeouts
and pool monitoring.

## Impact

- 12% of API requests returned 5xx errors for 47 minutes
- Approximately 15,000 unique users experienced failures
- Payment processing was unaffected (separate database pool)
- No data loss or corruption occurred
- SLO impact: consumed 60% of monthly error budget

## Timeline (UTC)

| Time  | Event                                                    |
|-------|----------------------------------------------------------|
| 14:15 | Deployment of v2.14.3 begins (automated via ArgoCD)     |
| 14:22 | Canary pod reports healthy (canary did not test affected path) |
| 14:25 | Full rollout complete to all 8 pods                      |
| 14:28 | Alert fires: API error rate > 5%                         |
| 14:30 | On-call engineer acknowledges, opens incident channel    |
| 14:32 | Incident declared SEV2, roles assigned                   |
| 14:35 | Error rate at 12%, correlated with v2.14.3 deployment    |
| 14:38 | Decision: rollback to v2.14.2                            |
| 14:42 | Rollback complete, error rate dropping                   |
| 14:55 | Error rate at baseline. Monitoring for stability.        |
| 15:15 | Incident resolved after 20-min stability window          |

## Root Cause Analysis

The deployment v2.14.3 introduced a new query to the user-profiles
database that lacked a connection timeout. Under normal load, this query
took ~50ms. However, when the user-profiles table was under vacuum
(routine maintenance), query latency spiked to 5-10 seconds. Without a
timeout, connections were held open, exhausting the connection pool
(max: 20). Subsequent requests could not acquire connections and failed
with 5xx errors.

## Contributing Factors

1. **No connection timeout on new query.** The code review did not
   catch the missing timeout because there was no linting rule for it.
2. **Canary analysis did not cover the affected code path.** The
   canary traffic was synthetic and did not trigger the user-profile
   lookup.
3. **Connection pool size was undersized.** Pool max of 20 was
   set during initial setup and never revisited as traffic grew.
4. **No alerting on connection pool utilization.** The alert only
   fired on error rate, not on pool exhaustion (leading indicator).

## Action Items

| ID  | Action                                          | Owner         | Priority | Deadline   | Status  |
|-----|-------------------------------------------------|---------------|----------|------------|---------|
| AI-1| Add connection timeout linting rule to CI        | Platform Team | P1       | 2026-03-17 | Open    |
| AI-2| Add connection pool utilization alert (> 80%)    | SRE Team      | P1       | 2026-03-14 | Open    |
| AI-3| Increase pool size to 50, add auto-scaling       | Platform Team | P2       | 2026-03-24 | Open    |
| AI-4| Expand canary analysis to cover user-profile path| QA Team       | P2       | 2026-03-31 | Open    |
| AI-5| Document database vacuum schedule in runbook      | DBA Team      | P3       | 2026-04-07 | Open    |

## Lessons Learned

- **What went well:** Fast detection (3 min MTTD), quick rollback
  decision, clear incident channel communication.
- **What could be improved:** Missing leading indicator alerts,
  canary analysis gaps, no linting for database best practices.
- **Where we got lucky:** Payment processing was on a separate pool
  and was unaffected. If it shared the same pool, this would have
  been SEV1.
```

### 5 Whys Technique

Use iterative "why" questioning to drill past symptoms to root causes. Do not stop at the first answer.

```text
5 Whys Example: API Outage

Why 1: Why did the API return 5xx errors?
  → Database connection pool was exhausted.

Why 2: Why was the connection pool exhausted?
  → Queries were holding connections for 5-10 seconds instead of 50ms.

Why 3: Why were queries slow?
  → The database was under vacuum maintenance, increasing query latency.

Why 4: Why did slow queries exhaust the pool?
  → The new query had no connection timeout configured.

Why 5: Why was there no connection timeout?
  → No linting rule or code review checklist item enforces
    connection timeouts on database queries.

ROOT CAUSE: Missing automated enforcement of database connection
timeouts in the development pipeline.

ACTION: Add a linting rule + code review checklist item for
connection timeouts on all database queries.
```

**Caution with 5 Whys:** This technique works best for linear causal chains. For complex incidents with multiple contributing factors, combine with the Ishikawa (fishbone) diagram.

### Fishbone / Ishikawa Diagram

Map contributing factors across multiple categories to understand complex incidents.

```text
Fishbone Diagram: API Connection Pool Exhaustion

                    People              Process              Technology
                      │                   │                     │
           No timeout │      No linting   │    Pool size not    │
           awareness  │      rule for DB  │    reviewed since   │
                      │      timeouts     │    initial setup    │
                      │                   │                     │
                      │   Canary didn't   │    No pool util     │
                      │   test affected   │    monitoring       │
                      │   code path       │                     │
                      │                   │                     │
  ────────────────────┴───────────────────┴─────────────────────┴──────►
                                                                 EFFECT:
                    Environment          Measurement              API
                      │                   │                     Outage
           DB vacuum  │   Alert only on   │
           during     │   error rate,     │
           peak hours │   not leading     │
                      │   indicators      │
                      │                   │
```

Use the fishbone to ensure the postmortem considers all dimensions, not just the technical trigger.

### Timeline Reconstruction

Build the timeline from multiple sources. Do not rely on memory alone.

| Source                    | What It Provides                                      |
|---------------------------|-------------------------------------------------------|
| **Incident channel logs** | Human decisions, discussions, timestamps               |
| **Monitoring dashboards** | Metric changes, alert firing times                     |
| **Deployment logs**       | What was deployed and when                             |
| **Git history**           | Code changes correlated with the incident              |
| **PagerDuty/OpsGenie**   | Alert timeline, acknowledgment times, escalations      |
| **Status page history**   | External communication timeline                        |
| **Customer support queue**| When customers first reported the issue                |

```python
# timeline_builder.py -- Aggregate timeline from multiple sources
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

@dataclass
class TimelineEvent:
    timestamp: datetime
    source: str
    event_type: Literal[
        "deployment", "alert", "human_action",
        "metric_change", "customer_report", "communication"
    ]
    description: str
    evidence_url: str | None = None

def build_timeline(
    alerts: list[TimelineEvent],
    deployments: list[TimelineEvent],
    channel_events: list[TimelineEvent],
    customer_reports: list[TimelineEvent],
) -> list[TimelineEvent]:
    """Merge all event sources into a single chronological timeline."""
    all_events = alerts + deployments + channel_events + customer_reports
    all_events.sort(key=lambda e: e.timestamp)

    # Deduplicate events within 1-minute windows from different sources
    deduped: list[TimelineEvent] = []
    for event in all_events:
        if not deduped or (
            event.timestamp - deduped[-1].timestamp
        ).total_seconds() > 60 or event.source != deduped[-1].source:
            deduped.append(event)

    return deduped

def format_timeline_markdown(events: list[TimelineEvent]) -> str:
    """Generate markdown table from timeline events."""
    lines = ["| Time (UTC) | Source | Event |", "|---|---|---|"]
    for event in events:
        time_str = event.timestamp.strftime("%H:%M:%S")
        link = f" ([evidence]({event.evidence_url}))" if event.evidence_url else ""
        lines.append(f"| {time_str} | {event.source} | {event.description}{link} |")
    return "\n".join(lines)
```

### Action Item Tracking

Action items are the most important output of a postmortem. Track them rigorously.

**Action Item Properties:**

| Property       | Description                                       | Example                          |
|----------------|---------------------------------------------------|----------------------------------|
| **ID**         | Unique identifier, linked to postmortem           | AI-2341-01                       |
| **Action**     | Specific, measurable task                         | "Add connection pool alert at 80% utilization" |
| **Owner**      | Team or individual responsible                    | SRE Team                         |
| **Priority**   | P1 (within 1 week), P2 (within 1 month), P3 (within 1 quarter) | P1              |
| **Deadline**   | Concrete date                                     | 2026-03-14                       |
| **Status**     | Open, In Progress, Complete, Won't Fix             | Open                            |
| **Tracking**   | Link to issue tracker (JIRA, Linear, GitHub)      | JIRA-12345                       |

```typescript
// action-item-sync.ts -- Sync postmortem action items to issue tracker
interface PostmortemActionItem {
  id: string;
  incidentId: string;
  action: string;
  owner: string;
  priority: "P1" | "P2" | "P3";
  deadline: string;
  status: "open" | "in_progress" | "complete" | "wont_fix";
}

async function syncActionItemsToJira(
  actionItems: PostmortemActionItem[],
  jiraProject: string
): Promise<void> {
  for (const item of actionItems) {
    const jiraIssue = {
      project: { key: jiraProject },
      summary: `[Postmortem ${item.incidentId}] ${item.action}`,
      description: buildDescription(item),
      issuetype: { name: "Task" },
      priority: { name: mapPriority(item.priority) },
      duedate: item.deadline,
      labels: ["postmortem", `incident-${item.incidentId}`],
      assignee: { name: item.owner },
    };

    // Create or update JIRA issue
    await createOrUpdateJiraIssue(jiraIssue, item.id);
  }
}

function mapPriority(p: string): string {
  const map: Record<string, string> = {
    P1: "Highest",
    P2: "High",
    P3: "Medium",
  };
  return map[p] ?? "Medium";
}

function buildDescription(item: PostmortemActionItem): string {
  return [
    `*Postmortem Action Item:* ${item.id}`,
    `*Incident:* ${item.incidentId}`,
    `*Priority:* ${item.priority}`,
    `*Deadline:* ${item.deadline}`,
    ``,
    `{panel:title=Action Required}`,
    item.action,
    `{panel}`,
    ``,
    `_This issue was auto-generated from a postmortem. Do not close ` +
    `without completing the action and verifying effectiveness._`,
  ].join("\n");
}

// Placeholder implementations
async function createOrUpdateJiraIssue(
  _issue: Record<string, unknown>, _itemId: string
): Promise<void> { /* JIRA API call */ }
```

### Postmortem Review Process

| Step                  | Who                        | When                            | Purpose                                        |
|-----------------------|----------------------------|---------------------------------|------------------------------------------------|
| **Draft**             | Incident responders        | Within 24 hours                 | Capture facts while memory is fresh             |
| **Internal review**   | Team lead + SRE lead       | Within 48 hours                 | Verify accuracy, check for blame, ensure completeness |
| **Action item review**| Engineering manager        | Within 48 hours                 | Ensure action items are realistic, resourced, and tracked |
| **Team share**        | Authoring team             | Within 72 hours                 | Present to the broader team for questions and learning |
| **Organization share**| Engineering leadership     | Within 1 week                   | Share key learnings in a weekly digest or all-hands |
| **External publish**  | Communications team (opt.) | Within 2 weeks (if applicable)  | Public postmortem for major customer-facing incidents |

### Postmortem Metrics

Track these metrics to measure the health of your postmortem process.

```yaml
# postmortem-metrics.yaml
metrics:
  completion_rate:
    description: "Percentage of qualifying incidents that receive a postmortem"
    target: ">= 95%"
    measurement: "qualifying_incidents_with_postmortem / total_qualifying_incidents"

  time_to_publish:
    description: "Time from incident resolution to postmortem publication"
    target: "<= 72 hours"
    measurement: "median time from incident.resolved_at to postmortem.published_at"

  action_item_closure_rate:
    description: "Percentage of action items completed by deadline"
    target: ">= 80%"
    measurement: "action_items_completed_on_time / total_action_items"

  action_item_median_age:
    description: "Median age of open action items"
    target: "<= 14 days"
    measurement: "median(today - action_item.created_at) for status=open"

  repeat_incident_rate:
    description: "Incidents with the same root cause as a previous postmortem"
    target: "<= 10%"
    measurement: "incidents_with_prior_root_cause / total_incidents"

  review_completion:
    description: "Percentage of postmortems that complete the full review process"
    target: ">= 90%"
    measurement: "postmortems_fully_reviewed / total_postmortems"
```

### Recurring Incident Detection

Identify patterns across postmortems to catch systemic issues.

```python
# recurring_incidents.py -- Detect patterns across postmortems
from dataclasses import dataclass
from collections import Counter

@dataclass
class PostmortemSummary:
    incident_id: str
    root_cause_category: str  # e.g., "config_change", "capacity", "dependency"
    contributing_factors: list[str]
    service: str
    severity: str
    date: str

def detect_recurring_patterns(
    postmortems: list[PostmortemSummary],
    threshold: int = 3
) -> dict:
    """Identify recurring root cause categories and contributing factors."""
    # Count root cause categories
    root_cause_counts = Counter(pm.root_cause_category for pm in postmortems)

    # Count contributing factors across all postmortems
    factor_counts: Counter = Counter()
    for pm in postmortems:
        factor_counts.update(pm.contributing_factors)

    # Identify services with repeated incidents
    service_counts = Counter(pm.service for pm in postmortems)

    recurring = {
        "recurring_root_causes": [
            {"category": cat, "count": count}
            for cat, count in root_cause_counts.most_common()
            if count >= threshold
        ],
        "common_contributing_factors": [
            {"factor": factor, "count": count}
            for factor, count in factor_counts.most_common(10)
        ],
        "high_incident_services": [
            {"service": svc, "count": count}
            for svc, count in service_counts.most_common()
            if count >= threshold
        ],
    }

    # Generate recommendations
    recurring["recommendations"] = []
    for rc in recurring["recurring_root_causes"]:
        recurring["recommendations"].append(
            f"Root cause '{rc['category']}' appeared {rc['count']} times. "
            f"Investigate systemic fix (architecture change, tooling, policy)."
        )

    return recurring
```

### Learning from Incidents

Modern incident learning goes beyond traditional postmortems. Adopt a "learning review" approach inspired by incident.io and Jeli.

**Traditional Postmortem vs Learning Review:**

| Aspect            | Traditional Postmortem                | Learning Review                          |
|-------------------|---------------------------------------|------------------------------------------|
| **Focus**         | Root cause and action items           | How the organization responded and adapted|
| **Question**      | "What went wrong?"                    | "What did we learn about our system?"    |
| **Output**        | Fixes to prevent recurrence           | Insights about system behavior and gaps  |
| **Scope**         | Single incident                       | Patterns across incidents                |
| **Facilitation**  | Incident commander or manager         | Dedicated learning facilitator           |

```text
Learning Review Structure:

1. WHAT HAPPENED (facts, not interpretation)
   - Reconstruct timeline from evidence
   - Map the sequence of events

2. HOW DID WE RESPOND (process, not blame)
   - What did responders observe and decide?
   - What information was available vs missing?
   - What tools helped or hindered?

3. WHAT SURPRISED US (assumptions challenged)
   - What did we expect to happen that didn't?
   - What did we not expect that did happen?
   - What mental models were wrong?

4. WHAT DID WE LEARN (organizational insights)
   - About our architecture
   - About our processes
   - About our monitoring and alerting
   - About our team communication

5. WHAT WILL WE CHANGE (actionable improvements)
   - Specific, measurable, owned, time-bound actions
```

### Publishing Postmortems Externally

Publish external postmortems for major customer-facing incidents to build trust and demonstrate transparency.

**Guidelines for External Postmortems:**

- **Include:** What happened, customer impact, timeline (simplified), what was done to fix it, and what will be done to prevent recurrence.
- **Exclude:** Internal team names, individual names, proprietary architecture details, exact traffic/revenue numbers (use percentages).
- **Tone:** Factual, empathetic, forward-looking. Avoid minimizing the impact.
- **Review:** Legal and communications teams review before publication.

```text
External Postmortem Structure:

1. Summary (2-3 sentences: what happened, impact, duration)
2. What Happened (customer-facing description, no internal jargon)
3. Timeline (simplified: detected, identified, mitigated, resolved)
4. Impact (which services, how many users, data implications)
5. Root Cause (technical but accessible explanation)
6. Remediation (what was done immediately + long-term improvements)
7. Apology and Commitment (acknowledge the impact, commit to improvement)
```

**Companies with notable external postmortem practices:** Cloudflare, GitHub, Atlassian, Google Cloud, AWS. These build customer trust through transparency.

### Postmortem Tooling Automation

Modern tools (incident.io, Rootly, FireHydrant) automate significant portions of the postmortem workflow.

```yaml
# Automated postmortem workflow
postmortem_automation:
  on_incident_resolved:
    - action: create_postmortem_draft
      source: incident_channel_messages
      include:
        - timeline_from_bot_events
        - pinned_messages
        - severity_and_impact_from_incident_metadata
        - action_items_from_tagged_messages

    - action: assign_author
      rule: incident_commander

    - action: set_deadline
      severity_based:
        SEV1: 24_hours
        SEV2: 48_hours
        SEV3: 72_hours

    - action: schedule_review_meeting
      attendees: [incident_responders, team_lead, sre_lead]
      duration: 30_minutes
      within: 72_hours

    - action: create_action_item_tickets
      tracker: jira
      project: "RELIABILITY"
      auto_assign: true

  weekly_digest:
    - action: publish_postmortem_summary
      channel: "#engineering-all"
      include: [summary, key_learnings, action_item_status]

  monthly_review:
    - action: generate_recurring_pattern_report
      threshold: 3_incidents_same_category
      notify: [engineering_leadership]
```

---

## Best Practices

1. **Write postmortems within 24-72 hours of incident resolution.** Context fades rapidly. Auto-generate a draft from incident channel logs immediately on resolution.

2. **Enforce blameless language in every postmortem.** Use roles, not names. Focus on systems, not individuals. Have reviewers check for blaming language before publication.

3. **Make every action item specific, owned, prioritized, and time-bound.** "Improve monitoring" is not an action item. "Add connection pool utilization alert at 80% threshold to Datadog by 2026-03-14, owned by SRE Team" is.

4. **Track action item completion as an organizational metric.** Target 80%+ closure rate by deadline. Unfinished action items indicate systemic capacity or prioritization problems.

5. **Use 5 Whys for simple incidents and fishbone diagrams for complex ones.** Do not stop at the first cause. Most incidents have multiple contributing factors.

6. **Share postmortems broadly, not just within the affected team.** Other teams learn from your incidents. Publish to an engineering-wide channel or wiki.

7. **Detect recurring patterns across postmortems.** If the same root cause category appears 3+ times, escalate to leadership for systemic investment.

8. **Publish external postmortems for major customer-facing incidents.** Transparency builds trust. Follow the external postmortem template with legal/comms review.

9. **Conduct learning reviews for high-severity incidents, not just postmortems.** Ask "what surprised us?" and "what did we learn about our system?" beyond just "what went wrong?"

10. **Automate postmortem creation and action item tracking.** Use incident management platforms to auto-generate drafts, create JIRA tickets, and track completion.

---

## Anti-Patterns

| Anti-Pattern | Problem | Remedy |
|---|---|---|
| **Blame game** | Postmortem names and shames individuals; engineers hide information in future incidents | Enforce blameless language; review for blame before publication; use roles not names |
| **Postmortem procrastination** | Postmortem written weeks later when nobody remembers details | Set 24-72 hour deadline; auto-generate draft from incident channel; block incident closure without postmortem |
| **Action item graveyard** | Action items are written but never completed or tracked | Sync to issue tracker; track closure rate monthly; escalate overdue P1 items |
| **Copy-paste postmortem** | Template is filled in minimally with no real analysis or learning | Require review by SRE lead; use learning review format; set quality bar examples |
| **Root cause singularity** | Postmortem identifies only one root cause when multiple factors contributed | Use fishbone diagram; require "contributing factors" section; train on systems thinking |
| **Missing the near-miss** | Only SEV1/SEV2 incidents get postmortems; valuable near-misses are ignored | Define trigger criteria that include near-misses; create lightweight postmortem format for SEV3 |
| **Postmortem as punishment** | Writing a postmortem is seen as extra work for the person who "caused" the incident | Rotate postmortem authorship; compensate with reduced sprint work; celebrate thorough postmortems |
| **No follow-through on learnings** | Postmortem is written, shared once, and forgotten; same patterns recur | Run recurring pattern detection monthly; reference prior postmortems in new ones; quarterly review |

---

## Enforcement Checklist

- [ ] Postmortem trigger criteria are defined and documented (all SEV1/SEV2 mandatory, near-miss recommended)
- [ ] Blameless postmortem policy is written and communicated to all engineers
- [ ] Postmortem template is standardized across the organization and stored in a shared repository
- [ ] Auto-draft generation is configured in incident management tool (incident.io, Rootly, etc.)
- [ ] Postmortem publication deadline is enforced (24h for SEV1, 48h for SEV2, 72h for SEV3)
- [ ] Review process is defined with clear roles (author, team reviewer, SRE reviewer, manager)
- [ ] Action items are automatically synced to issue tracker (JIRA, Linear, GitHub Issues)
- [ ] Action item closure rate is tracked monthly with target >= 80%
- [ ] Recurring incident detection runs monthly with threshold-based alerts to leadership
- [ ] Postmortems are shared to engineering-wide channel within 1 week of publication
- [ ] External postmortem process exists for major customer-facing incidents with legal/comms review
- [ ] Postmortem quality and completion metrics are reviewed in quarterly SRE retrospective
