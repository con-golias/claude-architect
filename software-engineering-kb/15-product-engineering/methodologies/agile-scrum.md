# Agile & Scrum Framework

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Methodologies |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Story Points](../estimation/story-points.md), [Kanban](kanban.md), [Comparison](comparison.md) |

---

## Core Concepts

### The Agile Manifesto

Agile is a mindset rooted in four values (2001 Manifesto):

1. **Individuals and interactions** over processes and tools.
2. **Working software** over comprehensive documentation.
3. **Customer collaboration** over contract negotiation.
4. **Responding to change** over following a plan.

Twelve principles underpin these values: deliver early and continuously, welcome changing requirements, deliver working software frequently, business and developers work together daily, build around motivated individuals, prefer face-to-face conversation, measure progress via working software, maintain sustainable pace, pursue technical excellence, maximize work not done, self-organizing teams, reflect and adjust regularly.

### Scrum Framework Overview

Scrum is a lightweight framework implementing Agile principles through defined roles, events, and artifacts. It operates in fixed-length iterations called sprints (typically 1-4 weeks).

```
┌─────────────────────────────────────────────────────┐
│                    SCRUM FRAMEWORK                   │
│                                                      │
│  Product    Sprint      Sprint Execution    Sprint   │
│  Backlog → Planning → [Daily Scrums] →    Review    │
│    │         │          │ Dev Work  │        │       │
│    │         ▼          │ Testing   │        ▼       │
│    │    Sprint Backlog   │ Integr.  │   Increment    │
│    │                     └──────────┘        │       │
│    │                                         ▼       │
│    │◄──────────────────────────── Sprint Retro       │
└─────────────────────────────────────────────────────┘
```

---

## Scrum Roles

### Product Owner (PO)

- Own and prioritize the product backlog.
- Define clear acceptance criteria for each product backlog item.
- Make scope decisions; represent stakeholders and customers.
- Say "no" to protect sprint scope; say "yes" to maximize value delivered.
- Maintain a single, ordered backlog -- never allow parallel backlogs.

### Scrum Master (SM)

- Facilitate Scrum events; remove impediments blocking the team.
- Coach the team on Scrum practices without directing the work.
- Shield the team from external interruptions during sprints.
- Track and improve team health metrics (velocity stability, happiness).
- Serve the organization by helping adopt Scrum effectively.

### Development Team

- Self-organizing, cross-functional (3-9 members recommended).
- Collectively own the sprint commitment and Definition of Done.
- No sub-teams or hierarchy within the dev team.
- Every member is accountable for the increment, regardless of specialty.

---

## Scrum Events

### Sprint Planning

- **Timebox:** 2 hours per sprint week (e.g., 4h for a 2-week sprint).
- Answer: *What can be delivered?* and *How will we deliver it?*
- PO presents the highest-priority items; team selects what fits capacity.
- Define a clear **Sprint Goal** -- a single coherent objective.

```typescript
// Sprint planning data model
interface SprintPlan {
  sprintGoal: string;
  startDate: Date;
  endDate: Date;
  capacity: number; // story points or hours
  selectedItems: BacklogItem[];
  risks: string[];
}

interface BacklogItem {
  id: string;
  title: string;
  estimate: number;
  acceptanceCriteria: string[];
  dependencies: string[];
}

function validateSprintPlan(plan: SprintPlan): boolean {
  const totalEstimate = plan.selectedItems
    .reduce((sum, item) => sum + item.estimate, 0);
  const hasGoal = plan.sprintGoal.length > 0;
  const withinCapacity = totalEstimate <= plan.capacity;
  const allEstimated = plan.selectedItems.every(i => i.estimate > 0);
  return hasGoal && withinCapacity && allEstimated;
}
```

### Daily Scrum (Standup)

- **Timebox:** 15 minutes, same time and place daily.
- Each member answers: What did I do? What will I do? Any blockers?
- Not a status report to management -- it is a team synchronization event.
- Keep it focused; take side discussions offline ("parking lot").

### Sprint Review

- **Timebox:** 1 hour per sprint week.
- Demo working software to stakeholders; gather feedback.
- PO confirms which items meet the Definition of Done.
- Update the product backlog based on feedback and new insights.

### Sprint Retrospective

- **Timebox:** 45 minutes per sprint week.
- Inspect the process: What went well? What to improve? What to try?
- Produce 1-3 concrete, actionable improvement items for the next sprint.
- Rotate retrospective formats to avoid staleness (4Ls, Start/Stop/Continue, Sailboat, Timeline).

---

## Scrum Artifacts

### Product Backlog

- Single ordered list of everything that might be needed in the product.
- PO is the sole owner; items are refined continuously.
- Use INVEST criteria: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Sprint Backlog

- Selected product backlog items + the plan for delivering them.
- Owned by the development team; updated daily.
- Visible to all; a living plan, not a contract.

### Increment

- The sum of all completed product backlog items during a sprint.
- Must meet the Definition of Done (DoD) -- a shared quality standard.
- Must be in a usable, potentially releasable state.

---

## Sprint Mechanics

### Timeboxing

- Sprints are fixed-length (1, 2, 3, or 4 weeks). Two weeks is most common.
- Never extend a sprint. If work is incomplete, move items back to the backlog.
- Consistent sprint length enables predictable velocity measurement.

### Definition of Done (DoD)

A shared checklist ensuring quality:

```markdown
## Definition of Done
- [ ] Code reviewed by at least one peer
- [ ] Unit tests pass (>80% coverage on new code)
- [ ] Integration tests pass
- [ ] No critical or high-severity bugs
- [ ] Documentation updated (API docs, README)
- [ ] Deployed to staging and smoke-tested
- [ ] Acceptance criteria verified by PO
- [ ] Performance benchmarks met
```

### Sprint Goal

- One sentence describing the sprint's purpose and business value.
- Provides flexibility: the team can negotiate scope while protecting the goal.
- Example: "Enable users to export reports as PDF and CSV."

---

## Backlog Management & Prioritization

### Refinement (Grooming)

- Dedicate 5-10% of sprint capacity to refining upcoming backlog items.
- Break large epics into user stories; add acceptance criteria and estimates.
- Ensure the top 2-3 sprints' worth of items are "ready" at all times.

### Prioritization Frameworks

| Framework | Formula / Approach | Best For |
|-----------|-------------------|----------|
| **WSJF** | Cost of Delay / Job Duration | SAFe, economic prioritization |
| **MoSCoW** | Must / Should / Could / Won't | Fixed-scope releases |
| **RICE** | (Reach x Impact x Confidence) / Effort | Data-driven product teams |
| **Value vs Effort** | 2x2 matrix | Quick prioritization sessions |
| **Kano Model** | Basic / Performance / Delighter | Feature categorization |

```python
# RICE scoring
def rice_score(reach: int, impact: float, confidence: float, effort: float) -> float:
    """
    reach: number of users affected per quarter
    impact: 0.25 (minimal), 0.5 (low), 1 (medium), 2 (high), 3 (massive)
    confidence: 0.5 (low), 0.8 (medium), 1.0 (high)
    effort: person-months
    """
    return (reach * impact * confidence) / effort

# WSJF scoring
def wsjf_score(
    user_value: int, time_criticality: int,
    risk_reduction: int, job_size: int
) -> float:
    """All inputs on Fibonacci scale (1, 2, 3, 5, 8, 13)."""
    cost_of_delay = user_value + time_criticality + risk_reduction
    return cost_of_delay / job_size
```

---

## Velocity & Metrics

### Velocity

- Sum of story points completed per sprint.
- Use a rolling average (last 3-5 sprints) for forecasting; never as a performance metric.
- Velocity is team-specific and non-comparable across teams.

### Burndown Chart

Track remaining work in a sprint. The ideal line descends linearly from total points to zero.

### Burnup Chart

Track completed work against total scope. Reveals scope changes that burndown charts hide.

### Key Scrum Metrics

| Metric | Purpose | Target |
|--------|---------|--------|
| Velocity | Forecast capacity | Stable +/- 20% |
| Sprint Burndown | Track daily progress | Near ideal line |
| Sprint Goal Success Rate | Measure commitment reliability | > 80% |
| Escaped Defects | Quality indicator | Decreasing trend |
| Planned vs Delivered | Predictability | > 85% |

---

## Scaling Scrum

### SAFe (Scaled Agile Framework)

- Organize teams into Agile Release Trains (ARTs) of 50-125 people.
- Use Program Increments (PIs) of 8-12 weeks with PI Planning events.
- Heavy governance; best for large enterprises needing alignment.

### LeSS (Large-Scale Scrum)

- Multiple teams (up to 8) share a single product backlog and PO.
- Minimal additional roles; emphasize simplicity and descaling.
- Joint Sprint Planning, combined Sprint Review.

### Nexus

- Integration team coordinates 3-9 Scrum teams.
- Nexus Sprint Backlog tracks cross-team dependencies.
- Nexus Daily Scrum focuses on integration issues.

---

## Modern Scrum Adaptations

### Async Standups

- Use Slack/Teams bots for daily updates in distributed teams.
- Reserve synchronous time for blockers and discussions only.
- Post updates within a defined window (e.g., first hour of workday).

### Remote-First Practices

- Digital boards (Jira, Linear, Miro) replace physical boards.
- Record Sprint Reviews for async viewing across time zones.
- Use shared documents for Sprint Planning pre-work.
- Maintain a team working agreement defining core overlap hours.

### Continuous Delivery with Scrum

- Deploy to production multiple times per sprint, not just at sprint end.
- Decouple release from sprint cadence using feature flags.
- Sprint Review demonstrates value delivered, not deployment events.

---

## 10 Best Practices

1. **Protect the sprint scope.** Once Sprint Planning is complete, resist adding new items. Route new requests to the product backlog for future sprints.
2. **Define a clear Sprint Goal.** Every sprint must have a single, coherent goal that guides trade-off decisions when items cannot all be completed.
3. **Keep the DoD strict and visible.** Display the Definition of Done prominently. Raise the bar over time as the team matures.
4. **Refine continuously.** Dedicate 5-10% of capacity to backlog refinement so Sprint Planning is efficient and items are "ready."
5. **Measure velocity for forecasting only.** Never use velocity as a performance target. Gaming velocity destroys trust and predictability.
6. **Timebox all events strictly.** Respect the timebox even if discussion is unfinished. Overruns signal a facilitation or preparation problem.
7. **Rotate retrospective formats.** Use varied formats (Sailboat, 4Ls, Starfish, Timeline) to keep retrospectives engaging and insightful.
8. **Make impediments visible.** Track blockers on the board with explicit owners and resolution timelines. Escalate immediately when needed.
9. **Limit sprint length to 2 weeks.** Shorter sprints increase feedback frequency and reduce risk of delivering the wrong thing.
10. **Invest in cross-functional teams.** Ensure each team can deliver an increment end-to-end without depending on external groups.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Scrummerfall (mini-waterfall in sprints) | Eliminates agility; testing piled at sprint end | Integrate testing throughout; enforce DoD daily |
| No Sprint Goal | Team lacks focus; cannot make trade-offs | Require a goal before Sprint Planning ends |
| PO absent during sprint | Delayed decisions; wrong assumptions | PO available daily; delegate to proxy if needed |
| Skipping retrospectives | Process never improves; frustration grows | Make retros mandatory; rotate formats for freshness |
| Velocity as KPI | Teams inflate estimates; trust erodes | Use velocity only for team-internal forecasting |
| Overcommitting sprints | Chronic incomplete work; morale drops | Plan to 70-80% capacity; leave buffer for unknowns |
| Zombie items | Items carry over sprint after sprint | If an item survives 2 sprints, re-estimate or split |
| Scrum Master as project manager | Self-organization undermined; dependency created | Coach the team; never assign or manage tasks directly |

---

## Enforcement Checklist

- [ ] Sprint length is fixed and consistent across iterations
- [ ] Every sprint has a documented Sprint Goal
- [ ] Definition of Done is published and applied to every item
- [ ] Sprint Planning produces a sprint backlog within team capacity
- [ ] Daily Scrum is timeboxed to 15 minutes
- [ ] Sprint Review includes stakeholder feedback collection
- [ ] Sprint Retrospective generates actionable improvement items
- [ ] Product backlog is ordered and top items are refined
- [ ] Velocity is tracked as a rolling average for forecasting
- [ ] Impediments are tracked with owners and resolution dates
- [ ] No scope changes are introduced mid-sprint without PO approval
- [ ] Team composition is stable across sprints
