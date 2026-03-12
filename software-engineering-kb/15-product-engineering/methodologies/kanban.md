# Kanban Method

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Methodologies |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Comparison](comparison.md), [Agile & Scrum](agile-scrum.md) |

---

## Core Concepts

### What Is Kanban

Kanban is a method for managing knowledge work by visualizing the workflow, limiting work in progress (WIP), and optimizing flow. Originating from Toyota's manufacturing system, it was adapted for software development by David J. Anderson in 2010.

Unlike Scrum, Kanban does not prescribe roles, events, or iterations. It is an evolutionary change method: start with what you do now, agree to pursue incremental change, and respect current processes and roles.

### The Six Kanban Principles

1. **Visualize the workflow.** Make all work items and their status visible to everyone.
2. **Limit work in progress (WIP).** Constrain concurrent items to expose bottlenecks and improve flow.
3. **Manage flow.** Monitor and optimize the smooth movement of items through the system.
4. **Make policies explicit.** Document entry/exit criteria for each column, WIP limits, and priority rules.
5. **Implement feedback loops.** Use regular cadences (standups, reviews, retrospectives) for inspection.
6. **Improve collaboratively, evolve experimentally.** Apply the scientific method: hypothesize, test, measure, adjust.

---

## Board Design

### Columns

Design columns to represent your actual workflow stages, not an idealized process.

```
┌──────────┬───────────┬────────────┬──────────┬──────────┬────────┐
│ Backlog  │ Ready     │ In Progress│ Review   │ Testing  │ Done   │
│ (unbnd)  │ WIP: 5    │ WIP: 4     │ WIP: 3   │ WIP: 3   │        │
├──────────┼───────────┼────────────┼──────────┼──────────┼────────┤
│ FEAT-42  │ FEAT-38   │ FEAT-35    │ FEAT-31  │ FEAT-29  │ FEAT-27│
│ FEAT-43  │ FEAT-39   │ FEAT-36    │ FEAT-32  │ FEAT-30  │ FEAT-28│
│ FEAT-44  │ FEAT-40   │ FEAT-37    │          │          │        │
│ BUG-12   │           │            │          │          │        │
│ ...      │           │            │          │          │        │
└──────────┴───────────┴────────────┴──────────┴──────────┴────────┘
```

- **Backlog:** Unbound pool of upcoming work, ordered by priority.
- **Ready:** Items refined and ready to be pulled. WIP-limited to prevent over-preparation.
- **In Progress:** Active development. This is the primary WIP-constrained column.
- **Review/Testing:** Downstream validation steps. Keep WIP tight to prevent bottlenecks.
- **Done:** Completed items meeting the Definition of Done.

### Swim Lanes

Use horizontal lanes to separate work types or priorities:

| Lane | Purpose | Example |
|------|---------|---------|
| Expedite | Urgent, interrupt-level items | Production incidents |
| Feature | Standard feature development | User stories |
| Bug | Defect fixes | Bug tickets |
| Tech Debt | Infrastructure and maintenance | Refactoring tasks |
| Blocked | Visually separate stalled items | Waiting on external team |

### Pull System

- Work is **pulled** from the previous column, never pushed.
- A developer pulls the next highest-priority item from "Ready" only when their WIP allows.
- Pulling enforces WIP limits naturally and creates a demand-driven flow.

```typescript
interface KanbanCard {
  id: string;
  title: string;
  classOfService: "expedite" | "fixed-date" | "standard" | "intangible";
  enteredColumn: Date;
  blockedDays: number;
  assignee?: string;
}

interface KanbanColumn {
  name: string;
  wipLimit: number;
  cards: KanbanCard[];
}

function canPull(column: KanbanColumn): boolean {
  return column.cards.length < column.wipLimit;
}

function pullCard(
  source: KanbanColumn,
  target: KanbanColumn
): KanbanCard | null {
  if (!canPull(target) || source.cards.length === 0) {
    return null;
  }
  const card = source.cards.shift()!;
  card.enteredColumn = new Date();
  target.cards.push(card);
  return card;
}
```

---

## WIP Limits

### Setting WIP Limits

- Start with a simple formula: **WIP limit = team members x 1.5** (rounded up).
- Adjust based on observation: if the team is often idle, increase slightly; if multitasking, decrease.
- WIP limits apply per column, not per person.

### Why WIP Limits Matter

| Scenario | Without WIP Limits | With WIP Limits |
|----------|-------------------|-----------------|
| 10 items started | All 10 in progress, high context-switching | 3-4 in progress, focused delivery |
| Bottleneck at review | Items pile up; invisible wait time | Pile-up visible; team swarms to unblock |
| Urgent request | Everything paused; all items delayed | Expedite lane used; standard flow continues |
| Developer availability | Idle hands start new work | Idle hands help finish existing work first |

### Little's Law

The mathematical foundation of Kanban flow management:

```
Average Lead Time = Average WIP / Average Throughput
```

- Reduce WIP --> reduce lead time (with constant throughput).
- Increase throughput --> reduce lead time (with constant WIP).
- Track all three metrics together; never optimize one in isolation.

---

## Kanban Metrics

### Lead Time

Time from when work is requested (enters backlog/commitment point) to when it is delivered.

### Cycle Time

Time from when work begins (enters "In Progress") to when it is done. Cycle time is a subset of lead time.

```python
from datetime import datetime, timedelta
from dataclasses import dataclass

@dataclass
class WorkItem:
    id: str
    requested_date: datetime
    started_date: datetime | None = None
    completed_date: datetime | None = None
    blocked_days: int = 0

    @property
    def lead_time(self) -> timedelta | None:
        if self.completed_date:
            return self.completed_date - self.requested_date
        return None

    @property
    def cycle_time(self) -> timedelta | None:
        if self.completed_date and self.started_date:
            return self.completed_date - self.started_date
        return None

    @property
    def active_time(self) -> timedelta | None:
        if ct := self.cycle_time:
            return ct - timedelta(days=self.blocked_days)
        return None

    @property
    def flow_efficiency(self) -> float | None:
        """Ratio of active work time to total cycle time."""
        if self.active_time and self.cycle_time:
            return self.active_time / self.cycle_time
        return None


def calculate_throughput(items: list[WorkItem], period_days: int) -> float:
    """Items completed per day over the given period."""
    completed = [i for i in items if i.completed_date]
    return len(completed) / period_days if period_days > 0 else 0.0
```

### Throughput

Number of items completed per unit of time (per day, per week). Track throughput histograms to forecast probabilistically.

### Cumulative Flow Diagram (CFD)

A stacked area chart showing the number of items in each workflow state over time.

```
Items │   ╱─── Done
      │  ╱╱─── Testing
      │ ╱╱╱─── Review
      │╱╱╱╱─── In Progress
      │╱╱╱╱╱── Ready
      └──────────────────── Time
```

- **Widening bands** indicate growing WIP or bottlenecks.
- **Parallel bands** indicate stable flow.
- **Flat Done line** indicates delivery has stopped.

### Flow Efficiency

Ratio of active work time to total cycle time. Typical teams achieve 15-40% flow efficiency. World-class teams reach 40-60%.

```
Flow Efficiency = Active Work Time / Total Cycle Time x 100%
```

---

## Classes of Service

Differentiate work items by urgency and impact to manage expectations and flow:

| Class | SLA | WIP Policy | Example |
|-------|-----|------------|---------|
| **Expedite** | Immediate (hours) | Bypasses WIP limits; max 1 at a time | Security vulnerability, P0 outage |
| **Fixed-Date** | Must ship by deadline | Planned in advance; prioritized early | Regulatory compliance, contractual |
| **Standard** | Normal SLA (days/weeks) | Subject to WIP limits and pull order | Features, improvements |
| **Intangible** | No deadline | Low priority; fill gaps | Tech debt, refactoring, experiments |

- Allocate capacity by class: e.g., 60% standard, 20% fixed-date, 15% intangible, 5% expedite.
- Track SLA compliance per class; adjust policies when targets are missed.

---

## Kanban Cadences

Kanban defines seven cadences (feedback loops) for continuous improvement:

| Cadence | Frequency | Purpose |
|---------|-----------|---------|
| Daily standup | Daily | Identify blockers, manage flow |
| Replenishment | Weekly/biweekly | Select and commit to new items |
| Delivery planning | As needed | Coordinate releases |
| Service delivery review | Biweekly | Review metrics, SLA compliance |
| Operations review | Monthly | Cross-team flow optimization |
| Risk review | Monthly | Identify systemic risks |
| Strategy review | Quarterly | Align kanban policies with business goals |

---

## Kanban vs Scrum

| Dimension | Scrum | Kanban |
|-----------|-------|--------|
| Cadence | Fixed sprints (1-4 weeks) | Continuous flow |
| Roles | PO, SM, Dev Team | No prescribed roles |
| Planning | Sprint Planning event | Continuous replenishment |
| Change policy | No changes mid-sprint | Items can be added anytime |
| Metrics | Velocity, burndown | Lead time, cycle time, throughput |
| WIP control | Sprint capacity | Explicit WIP limits per column |
| Commitment | Sprint backlog | Commitment point on the board |
| Estimation | Required (story points) | Optional |
| Best for | New products, unclear requirements | Maintenance, support, ops, continuous delivery |

Use Kanban when:
- Work is interrupt-driven (support, ops, incident response).
- Requirements are well-understood and flow continuously.
- The team handles diverse work types with unpredictable arrival.
- You want to start improving without disrupting existing processes.

Use Scrum when:
- Building a new product with evolving requirements.
- Stakeholders need predictable delivery cadence.
- The team benefits from the structure of defined events and roles.

---

## Tooling

### Jira

- Native Kanban boards with WIP limits, swim lanes, and CFDs.
- JQL filters for custom board views.
- Built-in cycle time and throughput reports.

### Linear

- Minimalist, fast Kanban boards with cycle analytics.
- Automatic status transitions via Git integrations.
- Triage system for incoming work that supports replenishment cadence.

### GitHub Projects

- Free, integrated with GitHub Issues and PRs.
- Custom fields for class of service and priority.
- Automation via GitHub Actions to enforce WIP limits.

### Shortcut (formerly Clubhouse)

- Iteration-optional workflow; strong Kanban support.
- Built-in cycle time, lead time, and throughput charts.
- Milestones for grouping related work without sprints.

---

## 10 Best Practices

1. **Start with what you do now.** Map your current workflow to columns before optimizing. Change processes incrementally, not all at once.
2. **Set explicit WIP limits and enforce them.** WIP limits are the engine of Kanban. A board without WIP limits is just a task tracker, not a Kanban system.
3. **Measure cycle time, not velocity.** Cycle time directly reflects delivery speed and exposes waste. Track it per class of service.
4. **Visualize blocked items distinctly.** Use a flag, color, or separate lane for blocked items. Blockers that are invisible stay unresolved.
5. **Define explicit policies for every column.** Document entry criteria, exit criteria, and who can pull. Ambiguity causes inconsistent quality and flow.
6. **Use the CFD to detect problems early.** Widening bands signal growing WIP or bottlenecks. Act before items stagnate.
7. **Allocate capacity by class of service.** Reserve explicit percentages for expedite, standard, and intangible work. Prevent urgent items from starving long-term improvements.
8. **Hold regular replenishment meetings.** Do not continuously add work. Batch replenishment decisions to reduce context-switching and improve prioritization.
9. **Finish what you start before starting new work.** "Stop starting, start finishing" is the Kanban mantra. Swarm on blocked or aging items.
10. **Run service delivery reviews.** Inspect metrics monthly. Compare cycle time distributions, throughput trends, and SLA compliance. Adjust WIP limits and policies based on data.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| No WIP limits | Board becomes a glorified to-do list; no flow improvement | Set WIP limits per column; start conservative and adjust |
| Push system (assigning work) | Overloads individuals; hides bottlenecks | Switch to pull: developers choose the next item themselves |
| Ignoring blocked items | Cycle time inflates; items age silently | Flag blockers prominently; set escalation thresholds |
| Too many columns | Complexity increases; items get lost in transitions | Merge columns that share the same worker; keep it simple |
| No metrics tracking | Cannot detect or prove improvements | Track lead time, cycle time, throughput, and WIP from day one |
| Expedite lane abuse | Everything is urgent; standard flow starves | Cap expedite items (max 1-2); require manager approval |
| Invisible policies | Team members apply inconsistent criteria | Write column policies on the board itself; review quarterly |
| Never changing WIP limits | System ossifies; bottlenecks persist | Review WIP limits monthly; experiment with tighter limits |

---

## Enforcement Checklist

- [ ] Board columns reflect the actual workflow stages
- [ ] WIP limits are set and visible on every active column
- [ ] Pull system is enforced (no push assignments)
- [ ] Entry and exit criteria are documented per column
- [ ] Classes of service are defined with SLA targets
- [ ] Cycle time is tracked per item and visualized
- [ ] Cumulative flow diagram is reviewed at least biweekly
- [ ] Blocked items are flagged with owners and resolution dates
- [ ] Replenishment cadence is scheduled and followed
- [ ] Service delivery review occurs monthly with metric analysis
- [ ] Expedite items are capped and require explicit approval
- [ ] Policies are posted visibly and updated quarterly
