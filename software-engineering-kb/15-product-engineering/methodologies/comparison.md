# Methodology Comparison & Selection

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Methodologies |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Agile & Scrum](agile-scrum.md), [Kanban](kanban.md), [Shape Up](shape-up.md) |

---

## Core Concepts

### Why Methodology Selection Matters

Choosing the wrong methodology creates friction between how a team naturally works and how a process forces them to work. The right methodology amplifies a team's strengths; the wrong one amplifies its weaknesses.

There is no universally "best" methodology. Selection depends on team size, product maturity, domain complexity, organizational culture, and regulatory environment.

### Methodology Evolution

```
1970s         1990s         2001          2010s          2020s
Waterfall  →  Spiral/RUP →  Agile     →  Lean/Kanban →  Continuous
                            Manifesto     Shape Up       Discovery
                            XP/Scrum                     & Delivery

Key shifts:
- Big upfront design → Iterative discovery
- Predictive planning → Adaptive planning
- Phase gates        → Continuous flow
- Documentation      → Working software
- Command & control  → Self-organizing teams
```

---

## Side-by-Side Comparison

### Scrum vs Kanban vs Shape Up vs XP

| Dimension | Scrum | Kanban | Shape Up | XP |
|-----------|-------|--------|----------|-----|
| **Cadence** | Fixed sprints (1-4 weeks) | Continuous flow | 6-week cycles + 2-week cooldown | 1-2 week iterations |
| **Roles** | PO, SM, Dev Team | None prescribed | Shapers, Betters, Builders | Coach, Customer, Programmers |
| **Planning** | Sprint Planning event | Continuous replenishment | Betting table per cycle | Iteration planning + release planning |
| **Estimation** | Story points / hours | Optional | Appetite (time budget) | Ideal weeks / story points |
| **Scope management** | Fixed scope per sprint | Flexible, continuous | Fixed time, variable scope | Negotiated per iteration |
| **WIP control** | Sprint capacity | Explicit WIP limits | Small teams (2-3 people) | Pair programming constrains |
| **Progress tracking** | Burndown, velocity | CFD, cycle time, throughput | Hill charts | Velocity, acceptance tests |
| **Change policy** | No mid-sprint changes | Anytime within WIP limits | No changes during 6-week build | Customer can change priorities between iterations |
| **Quality practices** | Definition of Done | Explicit policies | Circuit breaker | TDD, pair programming, CI, refactoring |
| **Backlog** | Single ordered backlog | Replenishment pool | No backlog (pitches discarded) | User stories managed by Customer |
| **Best team size** | 5-9 per team | Any size | 2-3 per project | 4-12 |
| **Scaling** | SAFe, LeSS, Nexus | Portfolio Kanban | Multiple small teams | Practices scale individually |

### When to Use Each

| Scenario | Recommended | Why |
|----------|-------------|-----|
| New product, uncertain requirements | Scrum | Sprint cadence forces regular delivery and feedback loops |
| Maintenance, support, operations | Kanban | Continuous flow matches interrupt-driven, variable workload |
| Product company, small team, innovation | Shape Up | Appetite-based planning maximizes autonomy and creativity |
| High-quality, technically complex projects | XP | Engineering practices (TDD, pairing) prevent defect accumulation |
| Regulated industry with audit requirements | Scrum | Defined events and artifacts provide documentation trail |
| Large organization needing alignment | SAFe/Scrum | Scaling frameworks provide cross-team coordination |
| Team transitioning from waterfall | Kanban | Start with current process; improve incrementally |
| Mixed work (features + bugs + ops) | Scrumban or Shape Up + Kanban | Hybrid handles diverse work types |

---

## Decision Matrix

Use this matrix to evaluate which methodology fits your context. Score each factor 1-5 and multiply by weight.

| Factor | Weight | Scrum Fit | Kanban Fit | Shape Up Fit | XP Fit |
|--------|--------|-----------|------------|--------------|--------|
| Team size < 10 | 3 | 5 | 5 | 5 | 5 |
| Team size 10-50 | 3 | 4 | 4 | 3 | 3 |
| Team size > 50 | 3 | 3 (w/ scaling) | 3 | 2 | 2 |
| Product discovery phase | 4 | 4 | 3 | 5 | 4 |
| Mature product maintenance | 4 | 3 | 5 | 2 | 3 |
| Interrupt-driven work | 4 | 2 | 5 | 1 | 2 |
| Innovation / greenfield | 3 | 3 | 2 | 5 | 4 |
| Regulatory compliance | 5 | 5 | 3 | 2 | 4 |
| Distributed / remote team | 3 | 4 | 4 | 5 | 3 |
| Stakeholder visibility needs | 4 | 5 | 3 | 3 | 4 |
| Technical excellence focus | 4 | 3 | 3 | 3 | 5 |

```python
from dataclasses import dataclass

@dataclass
class MethodologyScore:
    name: str
    scores: dict[str, int]  # factor_name -> score (1-5)

FACTORS = {
    "team_size_small": 3,
    "team_size_medium": 3,
    "team_size_large": 3,
    "product_discovery": 4,
    "mature_maintenance": 4,
    "interrupt_driven": 4,
    "innovation": 3,
    "regulatory": 5,
    "distributed_team": 3,
    "stakeholder_visibility": 4,
    "technical_excellence": 4,
}

def calculate_fit(methodology: MethodologyScore) -> float:
    """Calculate weighted fit score for a methodology."""
    total = 0
    max_possible = 0
    for factor, weight in FACTORS.items():
        if factor in methodology.scores:
            total += methodology.scores[factor] * weight
            max_possible += 5 * weight
    return (total / max_possible) * 100 if max_possible > 0 else 0

def recommend_methodology(
    context: dict[str, int],
    methodologies: list[MethodologyScore],
) -> list[tuple[str, float]]:
    """Score each methodology against team context and rank."""
    results = []
    for m in methodologies:
        score = sum(
            context.get(f, 0) * m.scores.get(f, 3) for f in FACTORS
        )
        results.append((m.name, score))
    results.sort(key=lambda x: x[1], reverse=True)
    return results
```

---

## Hybrid Approaches

### Scrumban (Scrum + Kanban)

Combine Scrum's cadence with Kanban's flow management:

- Keep sprint cadence for planning and retrospectives.
- Replace sprint backlog commitment with WIP limits.
- Use pull-based work assignment instead of sprint planning selection.
- Track cycle time alongside velocity.
- Best for: teams transitioning from Scrum to a more flow-based approach.

```
Sprint boundary                          Sprint boundary
    │                                         │
    ▼                                         ▼
┌───────┬──────┬────────────┬────────┬───────┬──────┐
│Backlog│Ready │In Progress │ Review │Testing│ Done │
│       │WIP:5 │  WIP: 4    │ WIP: 3 │WIP: 3 │      │
└───────┴──────┴────────────┴────────┴───────┴──────┘
    ▲                                         ▲
  Planning                                  Retro
  (replenish                              (inspect
   + prioritize)                           + adapt)
```

### Scrum + XP

Layer XP engineering practices onto Scrum's framework:

| From Scrum | From XP |
|------------|---------|
| Sprint cadence, roles, events | TDD, pair programming |
| Product backlog, Sprint Goal | Continuous integration |
| Sprint Review, Retrospective | Refactoring, simple design |
| Definition of Done | Collective code ownership |

This hybrid is one of the most common and effective: Scrum provides the project management structure while XP ensures technical quality.

### Shape Up + Kanban

- Use 6-week build cycles for new feature work (shaped, bet, built).
- Run a permanent Kanban board for bugs, support requests, and small improvements.
- Allocate team capacity: e.g., 70% Shape Up, 30% Kanban.
- Cooldown periods handle overflow from the Kanban board.

### Continuous Discovery + Any Delivery Method

Overlay continuous discovery (Teresa Torres) on any delivery methodology:

- Weekly customer interviews (regardless of sprint/cycle cadence).
- Opportunity Solution Trees to map business outcomes to solutions.
- Assumption testing before committing to build.
- Works with Scrum (discover during sprints), Kanban (discover continuously), or Shape Up (discover during shaping).

---

## When to Change Methodology

### Signals That Your Current Methodology Is Failing

| Signal | Possible Root Cause | Consider Switching To |
|--------|--------------------|-----------------------|
| Chronic sprint overcommitment | Work is unpredictable; estimation is unreliable | Kanban (no estimation, flow-based) |
| Features ship but users do not adopt them | Insufficient discovery; building the wrong things | Shape Up (shaping forces problem definition) |
| High defect rates despite "done" items | No engineering practices enforced | XP (TDD, pairing, CI) |
| Teams feel micromanaged by process | Too many ceremonies; process > people | Shape Up (full autonomy) or Kanban (minimal ceremonies) |
| Backlog is thousands of items long | Backlog maintenance has become a job unto itself | Shape Up (no backlog; pitch and bet) |
| Deployments are infrequent and risky | Process separates "dev done" from "actually shipped" | Kanban + CD (continuous flow to production) |
| Work stalls waiting for other teams | Dependencies between teams are not managed | SAFe/LeSS (explicit dependency management) |
| Team velocity is gamed or meaningless | Velocity used as a performance metric | Kanban (cycle time) or Shape Up (appetite) |

### Migration Strategies

**Scrum to Kanban:**
1. Keep the Scrum board; add WIP limits to each column.
2. Remove sprint boundaries gradually (extend sprints, then eliminate).
3. Replace velocity with cycle time and throughput metrics.
4. Keep retrospectives; drop Sprint Planning in favor of replenishment.

**Scrum to Shape Up:**
1. Extend sprint length to 6 weeks as an experiment.
2. Introduce shaping as a pre-planning activity for the next cycle.
3. Run a betting table instead of backlog grooming.
4. Replace burndowns with hill charts.
5. Eliminate the backlog; archive or delete old items.

**Waterfall to Agile (any):**
1. Start with Kanban (least disruptive; no role changes required).
2. Visualize the current workflow; add WIP limits.
3. Introduce retrospectives to drive process improvement.
4. Gradually add iterations (sprints) or cycles as the team matures.
5. Introduce roles (PO, SM) only after the team understands iterative delivery.

---

## Methodology Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Cargo-cult Agile** | Team follows ceremonies without understanding why; no real agility | Teach principles, not just practices. Ask "why" for every ceremony |
| **Methodology wars** | Teams argue Scrum vs Kanban instead of delivering value | Focus on outcomes; let teams choose what works. Measure results, not adherence |
| **Process-heavy Agile** | More time in meetings and managing tools than building software | Audit ceremony time vs build time. Cut any event below 50% usefulness rating |
| **Dark Scrum** | Management uses Scrum for command-and-control; developers suffer | Scrum Master must protect the team. Escalate to leadership. Consider Kanban |
| **Fake agile transformation** | Organization renames roles (PM → PO) but changes nothing else | Transformation requires structural change, not just labels |
| **One-size-fits-all** | Forcing every team into the same methodology regardless of context | Allow teams to adapt methodology to their domain and work type |
| **Eternal pilot** | Team "tries" a methodology indefinitely without committing or evaluating | Set a time-bound experiment (2-3 months) with explicit success criteria |
| **Cherry-picking** | Adopting easy parts (standups) while skipping hard parts (retrospectives, WIP limits) | Adopt a methodology fully for the pilot period; then adapt intentionally |

---

## Comparison by Maturity Stage

| Product Stage | Recommended Approach | Rationale |
|--------------|---------------------|-----------|
| **0 → 1 (Idea to MVP)** | Shape Up or XP | Small team, high uncertainty, need fast pivots |
| **1 → 10 (Product-Market Fit)** | Scrum | Regular cadence, stakeholder communication, predictable delivery |
| **10 → 100 (Scaling)** | Scrum + SAFe/LeSS or Scrumban | Cross-team coordination, scaling needs structure |
| **100 → 1000 (Mature product)** | Kanban + CD | Continuous delivery, maintenance-heavy, flow optimization |
| **Platform/Infrastructure** | Kanban | Interrupt-driven, SLA-based, diverse request types |
| **Agency/Consulting** | Scrum (client-facing) | Clients need visibility, estimation, sprint reviews |

---

## 10 Best Practices

1. **Match methodology to context, not ideology.** Choose based on team size, work type, and organizational constraints. No methodology is universally superior.
2. **Start with one methodology fully, then adapt.** Adopt the complete framework first. Understand why each element exists before removing or modifying it.
3. **Run time-bounded experiments.** When considering a change, set a 2-3 month trial with explicit success criteria and measurement.
4. **Measure outcomes, not adherence.** Track delivery metrics (cycle time, throughput, quality) rather than process compliance (did we hold all ceremonies?).
5. **Allow team-level variation.** Let each team choose and adapt their methodology. Standardize on metrics and interfaces, not on internal process.
6. **Combine discovery and delivery.** Every methodology needs a discovery layer. Overlay continuous discovery practices regardless of delivery method.
7. **Invest in engineering practices independently.** TDD, CI/CD, code review, and automated testing improve outcomes under any methodology. Do not tie them to a specific framework.
8. **Retrospect on the methodology itself.** Quarterly, ask: is this methodology still serving us? What has changed in our context that might require adaptation?
9. **Avoid methodology as identity.** "We are a Scrum team" creates resistance to change. "We use Scrum because it fits our current needs" enables evolution.
10. **Document your methodology variant.** Write down how your team actually works: which practices you follow, which you have adapted, and why. New team members need this context.

---

## Tooling Comparison

| Tool | Scrum Support | Kanban Support | Shape Up Support | Best For |
|------|---------------|----------------|------------------|----------|
| **Jira** | Excellent (sprints, velocity, boards) | Good (Kanban boards, CFDs) | Poor (no native support) | Enterprise, Scrum teams |
| **Linear** | Good (cycles, estimates) | Excellent (triage, flow metrics) | Moderate (cycles approximate Shape Up) | Fast-moving product teams |
| **Shortcut** | Good (iterations) | Good (Kanban boards) | Moderate (milestones) | Balanced teams |
| **GitHub Projects** | Basic (milestones) | Good (board views) | Poor | Open-source, small teams |
| **Basecamp** | Poor | Poor | Excellent (built for Shape Up) | Shape Up practitioners |
| **Notion** | Basic (custom databases) | Basic (board views) | Good (custom databases) | Flexible, documentation-heavy teams |
| **Azure DevOps** | Excellent (sprints, boards, queries) | Good (Kanban boards, CFDs) | Poor | Microsoft ecosystem, enterprise |

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Choosing methodology by popularity | Mismatch between process and context; team frustration | Use the decision matrix; evaluate against actual constraints |
| Switching methodologies too frequently | Team never masters any approach; perpetual confusion | Commit to a 3-month trial minimum; change only with data |
| Blaming the methodology for delivery failures | Root causes (skill gaps, unclear vision, tech debt) go unaddressed | Diagnose root cause first; methodology is rarely the real problem |
| Skipping the "why" | Team follows rituals without understanding purpose; cargo cult | Explain the reasoning behind each practice; revisit regularly |
| Forcing methodology on resistant teams | Passive resistance; malicious compliance; turnover | Involve the team in selection; demonstrate value through small wins |
| Ignoring engineering practices | No methodology compensates for lack of CI, testing, or code review | Invest in engineering foundations independent of process choice |
| Over-customizing before understanding | Remove important elements before understanding their purpose | Adopt fully first; customize after 3+ months of experience |
| No measurement baseline | Cannot tell if a methodology change improved or worsened delivery | Measure cycle time, throughput, and quality before any transition |

---

## Enforcement Checklist

- [ ] Team has explicitly chosen a methodology with documented rationale
- [ ] Decision considered team size, work type, product stage, and regulatory needs
- [ ] Methodology was adopted fully before any customizations
- [ ] Success metrics are defined and baselined before methodology changes
- [ ] Retrospective includes periodic review of methodology fitness
- [ ] Engineering practices (CI/CD, testing, code review) are in place regardless of methodology
- [ ] Discovery practices (customer interviews, assumption testing) overlay the delivery method
- [ ] Team's actual process variant is documented for onboarding
- [ ] Tooling supports the chosen methodology's core practices
- [ ] Hybrid approaches are intentional and documented, not accidental drift
- [ ] Methodology changes follow a time-bounded experiment protocol
- [ ] Outcomes are measured (cycle time, throughput, quality), not just adherence
