# Managing Technical Debt

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | Code Quality > Technical Debt                                        |
| Importance     | High                                                                 |
| Audience       | Tech leads, engineering managers, all developers                     |
| Prerequisites  | Debt measurement in place, sprint/planning process                   |
| Cross-ref      | [Measuring](measuring.md), [Prevention](prevention.md), [Quality Gates](../code-metrics/quality-gates.md) |

---

## Core Concepts

### Tech Debt Governance

Establish clear ownership for debt decisions. Without governance, debt is everyone's problem and no one's responsibility.

| Role                 | Responsibility                                       |
|----------------------|------------------------------------------------------|
| Engineering Manager  | Allocate capacity for debt work, communicate to leadership |
| Tech Lead            | Identify, score, and prioritize debt items           |
| Product Manager      | Understand debt impact on delivery, approve tradeoffs|
| Individual Developer | Flag new debt, apply Boy Scout Rule, track in register|
| Architecture Board   | Review architectural debt, approve large refactoring |

### Fowler's Technical Debt Quadrant

Martin Fowler's quadrant classifies debt by intent and awareness. Each quadrant requires a different management strategy.

```
                    Prudent                     Reckless
           ┌─────────────────────────┬─────────────────────────┐
Deliberate │ "We know this is debt,  │ "We don't have time for │
           │  we'll fix it next      │  design" — STOP. Never  │
           │  sprint"                │  acceptable at scale.   │
           │                         │                         │
           │ Strategy: Track + Plan  │ Strategy: Immediate     │
           │ Add to debt register,   │ intervention. Coaching  │
           │ schedule remediation.   │ and process change.     │
           ├─────────────────────────┼─────────────────────────┤
Inadvertent│ "Now we know how we     │ "What's layered         │
           │  should have built it"  │  architecture?"         │
           │                         │                         │
           │ Strategy: Refactor      │ Strategy: Training.     │
           │ opportunistically when  │ Invest in skills before │
           │ touching the code.      │ the team writes more.   │
           └─────────────────────────┴─────────────────────────┘
```

### Allocation Strategies

#### The 20% Rule

Dedicate 20% of every sprint to debt reduction. This is the most common approach.

```
Sprint capacity: 40 story points
Feature work:    32 points (80%)
Debt work:       8 points  (20%)
```

**Pros:** Consistent, predictable. **Cons:** 20% may not be enough for heavily indebted codebases; hard to protect under deadline pressure.

#### Tax Model

Add a debt "tax" to every feature ticket. When working on a feature, include related debt cleanup in the estimate.

```yaml
# Feature ticket example with debt tax
title: "Add multi-currency support to billing"
feature_estimate: 8 points
debt_tax: 2 points  # Clean up billing module coupling
total: 10 points
debt_items_addressed:
  - TD-001: Extract currency conversion to separate service
  - TD-015: Add missing tests for billing edge cases
```

#### Dedicated Debt Sprints

Run a full sprint focused on debt every 4-6 sprints. Often called "hardening sprints" or "quality sprints."

**Pros:** Large structural changes possible. **Cons:** Product team may resist "zero feature" sprints. Works best when framed as investment.

#### Gardening Time

Allocate fixed time blocks (e.g., Friday afternoons) for developers to work on debt items of their choosing.

```
Monday-Thursday: Feature work
Friday PM:       Gardening time (debt, tooling, exploration)
```

### Debt Prioritization Frameworks

#### Cost of Delay

Quantify the cost of NOT fixing the debt.

```typescript
interface DebtItem {
  id: string;
  title: string;
  weeklyImpactHours: number;  // Hours wasted per week by the team
  remediationHours: number;   // One-time fix effort
  breakEvenWeeks: number;     // remediation / weekly_impact
}

// Example
const item: DebtItem = {
  id: "TD-001",
  title: "Billing module test coverage",
  weeklyImpactHours: 4,      // 4 hours/week debugging billing bugs
  remediationHours: 24,      // 3 days to write proper tests
  breakEvenWeeks: 6,         // Pays for itself in 6 weeks
};
```

#### Impact Matrix

```
              Low Effort          High Effort
High Impact │ DO FIRST (Quick wins) │ PLAN (Schedule in roadmap) │
Low Impact  │ FILL (Gardening time) │ SKIP (Not worth it)        │
```

#### Weighted Scoring

```python
def prioritize_debt(items: list[dict]) -> list[dict]:
    """Score and rank debt items."""
    for item in items:
        item["score"] = (
            item["developer_velocity_impact"] * 3  # Weight: how much it slows devs
            + item["incident_risk"] * 2             # Weight: production risk
            + item["team_size_affected"] * 1        # Weight: blast radius
        ) / item["effort"]                          # Normalize by cost

    return sorted(items, key=lambda x: x["score"], reverse=True)
```

### Debt Retirement Roadmap

Plan debt paydown quarterly, not ad hoc.

```yaml
# Quarterly debt retirement roadmap
Q2-2025:
  theme: "Billing reliability"
  items:
    - TD-001: Add billing test coverage (24h, team: billing)
    - TD-003: Extract payment gateway adapter (16h, team: billing)
    - TD-007: Remove deprecated v1 billing API (8h, team: platform)
  total_investment: 48 hours
  expected_outcome: "50% reduction in billing-related incidents"

Q3-2025:
  theme: "Dependency modernization"
  items:
    - TD-012: Upgrade React 17 → 18 (40h, team: frontend)
    - TD-015: Replace moment.js with date-fns (16h, team: frontend)
    - TD-018: Upgrade Node 18 → 20 (24h, team: platform)
  total_investment: 80 hours
  expected_outcome: "Unblock React Server Components adoption"
```

### Communicating Debt to Stakeholders

Translate technical debt into business language.

| Technical Language                  | Business Language                                  |
|-------------------------------------|----------------------------------------------------|
| "High cyclomatic complexity"        | "This area is 3x more likely to cause bugs"        |
| "23% test coverage in billing"      | "We can't safely change billing without breaking things" |
| "Circular dependency between X & Y" | "We can't deploy X without deploying Y -- doubles deploy risk" |
| "340 hours of SonarQube debt"       | "Every feature takes 15% longer than it should"    |
| "Node 16 EOL"                       | "We'll stop receiving security patches next month"  |

**Frame debt as:**
- **Velocity impact:** "Feature delivery will slow by X% per quarter if unaddressed"
- **Risk framing:** "Probability of major incident increases by X% per month"
- **Cost of delay:** "Each month we delay costs $X in developer time"

### Debt Tracking Tools

| Tool             | How to Track Debt                              | Integration    |
|------------------|------------------------------------------------|----------------|
| JIRA             | Label: `tech-debt`, Epic per debt theme        | Sprint planning|
| GitHub Projects  | Custom field: debt category, debt score        | PR workflow    |
| Linear           | Label + custom properties for scoring          | Cycle tracking |
| Dedicated board  | Separate Kanban board for debt items           | Quarterly review|
| Debt register    | YAML/JSON file in repo, reviewed in planning   | Code review    |

```yaml
# GitHub issue template for tech debt
name: Technical Debt Item
description: Track a technical debt item for remediation
labels: ["tech-debt"]
body:
  - type: input
    attributes:
      label: Debt Category
      description: "code | architecture | dependency | test | documentation"
  - type: textarea
    attributes:
      label: Impact Description
      description: "How does this debt affect the team?"
  - type: dropdown
    attributes:
      label: Impact Level
      options: ["Critical", "High", "Medium", "Low"]
  - type: dropdown
    attributes:
      label: Effort Estimate
      options: ["XS (< 2h)", "S (2-8h)", "M (1-3 days)", "L (1-2 weeks)", "XL (> 2 weeks)"]
```

### Integrating Debt into Sprint Planning

**Definition of Done includes debt awareness:**

```markdown
## Definition of Done
- [ ] Code reviewed and approved
- [ ] Tests pass (unit + integration)
- [ ] No new SonarQube issues introduced (quality gate passes)
- [ ] No new tech debt introduced without a registered debt item
- [ ] Related debt items addressed if touching affected code (Boy Scout Rule)
```

**Debt ceiling concept:** Set a maximum acceptable debt ratio per service. If a service exceeds its ceiling, new features are paused until debt is reduced.

```yaml
# Debt ceiling per service
services:
  billing-service:
    max_debt_ratio: 10%
    current: 8%
    status: healthy
  user-service:
    max_debt_ratio: 10%
    current: 14%       # EXCEEDS CEILING
    status: blocked     # No new features until reduced to 10%
  notification-service:
    max_debt_ratio: 15%
    current: 6%
    status: healthy
```

### When to Accept Debt

Debt is not always bad. Accept it deliberately in these scenarios:

- **Time-to-market:** MVP or prototype where speed is the priority (document the debt)
- **Throwaway code:** Spike, proof of concept, or experiment (label as throwaway)
- **Known short-lived code:** Feature behind a flag that will be removed in < 3 months
- **Strategic pivot:** Business direction uncertain, avoid over-engineering

**Always:** Document accepted debt in the register with a planned remediation date.

### Celebrating Debt Paydown

Make debt reduction visible and valued.

```markdown
## Sprint Retrospective: Debt Wins
- Billing test coverage: 23% → 78% (TD-001 closed)
- Removed 3 circular dependencies (TD-009, TD-010, TD-011)
- Upgraded 12 outdated dependencies, including 2 with CVEs
- SonarQube debt ratio: 12% → 9% (trending down for 3rd sprint)
```

Share metrics in engineering all-hands. Recognize developers who champion debt reduction.

---

## Best Practices

1. **Assign explicit ownership for every debt item.** Unowned debt never gets fixed. Assign to a team, not a person -- teams outlast individuals.

2. **Use the 20% rule as a baseline, adjust based on debt severity.** Heavily indebted codebases may need 30-40% temporarily. Healthy codebases can drop to 10%.

3. **Frame debt in business impact language when communicating with stakeholders.** "Feature delivery slows 20%" resonates more than "cyclomatic complexity is 45."

4. **Set debt ceilings per service and enforce them.** When a service exceeds its ceiling, block new features until debt is reduced. This prevents runaway accumulation.

5. **Include a debt tax in every feature estimate.** When touching code with known debt, include cleanup in the feature ticket. This prevents the "we'll fix it later" trap.

6. **Create a quarterly debt retirement roadmap with specific themes and targets.** Quarterly planning provides the right cadence for strategic debt decisions.

7. **Make debt paydown visible in sprint reviews and retrospectives.** Celebrate progress with before/after metrics. Visibility sustains organizational commitment.

8. **Never accept reckless-deliberate debt.** "We don't have time for design" is not a debt decision -- it is negligence. Push back or escalate.

9. **Use automated tracking (quality gates, dashboards) rather than manual process.** Manual tracking degrades quickly. Automate measurement and alerting.

10. **Review the debt register in every sprint planning session.** Integrate debt into the regular planning cadence, not as a separate process that competes for attention.

---

## Anti-Patterns

| Anti-Pattern                     | Problem                                          | Better Approach                         |
|----------------------------------|--------------------------------------------------|-----------------------------------------|
| "We'll fix it later" (and never do) | Debt compounds, velocity degrades permanently | Track in register with target date      |
| Separate "debt sprint" once a year | Too little, too late; massive effort wasted    | Continuous 20% allocation per sprint    |
| Product blocks all debt work       | Debt accumulates until crisis                  | Negotiate protected capacity with data  |
| Developer secretly fixes debt      | No visibility, no credit, no coordination      | Formal tracking, celebrate paydown      |
| Treating all debt equally          | Low-impact debt gets fixed while critical grows| Score and prioritize by impact/effort   |
| Debt as punishment metric          | Developers hide debt, game metrics             | Team-level metrics, blameless culture   |
| No debt budget or ceiling          | Unbounded accumulation with no trigger point   | Set ceiling per service, enforce it     |
| Rewriting instead of refactoring   | Big-bang rewrites fail more often than succeed  | Incremental refactoring, strangler fig  |

---

## Enforcement Checklist

- [ ] Tech debt governance model defined: roles, responsibilities, decision authority
- [ ] Sprint capacity allocation for debt work formalized (minimum 20%)
- [ ] Tech debt register maintained with scored and prioritized items
- [ ] Debt ceiling defined per service/repository with enforcement mechanism
- [ ] Quarterly debt retirement roadmap created and reviewed with leadership
- [ ] Debt items visible in sprint planning (not a separate backlog)
- [ ] Feature estimates include debt tax when touching affected code areas
- [ ] Stakeholder communication uses business-impact language, not technical jargon
- [ ] Debt paydown metrics shared in sprint reviews and engineering all-hands
- [ ] Debt tracking integrated with CI (quality gates block merge when ceiling exceeded)
