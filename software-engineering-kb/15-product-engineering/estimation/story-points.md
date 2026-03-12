# Story Points & Velocity

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Estimation |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [estimation-techniques.md](estimation-techniques.md), [../methodologies/agile-scrum.md](../methodologies/agile-scrum.md) |

---

## Core Concepts

### What Story Points Measure

Story points are a relative unit of measure for the overall effort required to implement a product backlog item. They combine three dimensions into a single number.

| Dimension | Question |
|-----------|----------|
| **Complexity** | How intricate is the solution? How many moving parts? |
| **Effort** | How much work is involved, even if straightforward? |
| **Uncertainty** | How well do we understand the requirements and approach? |

**Critical distinction:** Story points measure relative effort/complexity, NOT calendar time. A 5-point story does not mean "5 days." It means "roughly 2.5x the effort of a 2-point story."

```
Story points are NOT:
  ✗ Hours or days in disguise
  ✗ A measure of individual productivity
  ✗ Comparable across teams
  ✗ A management performance metric

Story points ARE:
  ✓ A team-internal measure of relative effort
  ✓ An input to capacity planning via velocity
  ✓ A conversation starter about complexity and risk
  ✓ A forecasting tool (when combined with velocity)
```

---

### The Fibonacci Scale

Use the Fibonacci sequence (or a modified version) for story point values. The increasing gaps between numbers reflect the increasing uncertainty in larger estimates.

```
Standard Fibonacci:    1, 2, 3, 5, 8, 13, 21
Modified Fibonacci:    1, 2, 3, 5, 8, 13, 20, 40, 100
Simplified (some teams): 1, 2, 3, 5, 8, 13

Why Fibonacci?
  - Forces coarser granularity at higher values
  - Prevents false precision (no "14 vs 15" debates)
  - The gap between 8 and 13 reflects real uncertainty
  - Items above 13 signal "too large; decompose further"
```

#### Point Scale Reference

| Points | Meaning | Team Action |
|--------|---------|-------------|
| **1** | Trivial. Well-understood, minimal effort | Just do it |
| **2** | Small. Straightforward, low complexity | Standard work |
| **3** | Medium-small. Some complexity or multiple steps | Standard work |
| **5** | Medium. Moderate complexity, multiple components | Discuss approach |
| **8** | Large. Significant complexity, some unknowns | Consider splitting |
| **13** | Very large. High complexity, substantial unknowns | Must split before starting |
| **21+** | Epic-scale. Too large to estimate meaningfully | Decompose into multiple stories |

**Rule of thumb:** If a story is estimated at 13+, decompose it before committing to a sprint. Large stories carry disproportionate risk and block flow.

---

### Reference Stories

Establish a set of reference stories that anchor the team's scale. These are real, completed stories that the team agrees represent specific point values.

```
Reference Story Examples (for an e-commerce team):

1 point: "Add a tooltip to the checkout button"
  - Single UI change, one component, no backend
  - Tests: Update one snapshot test

2 points: "Add email validation to signup form"
  - Frontend validation + backend validation
  - Known pattern, regex-based, standard error handling

3 points: "Add 'Save for Later' button to cart"
  - New UI element + API endpoint + database field
  - Straightforward CRUD, follows existing patterns

5 points: "Implement coupon code application at checkout"
  - Multiple validation rules, percentage/fixed/BOGO types
  - Price recalculation, error states, edge cases
  - Integration with existing pricing engine

8 points: "Add PayPal as a payment method"
  - Third-party integration (PayPal SDK)
  - New payment flow, webhooks, error handling
  - Security review required, PCI implications
  - Multiple edge cases (refunds, partial payments)

13 points: "Build order history page with filtering and search"
  - New page, multiple API endpoints, pagination
  - Search with filters (date, status, amount)
  - Performance considerations (large datasets)
  - Multiple UI states (loading, empty, error, results)
```

**Maintaining reference stories:**
- Review and update quarterly
- Add new reference stories as the team's domain evolves
- Include references in the team wiki for new member onboarding
- Use reference stories to calibrate when estimation discussions stall

---

### Velocity

Velocity is the average number of story points a team completes per sprint. Use it for capacity planning and forecasting -- never for performance evaluation.

#### Calculating Velocity

```python
def calculate_velocity(completed_points: list[int], window: int = 6) -> dict:
    """
    Calculate team velocity using a rolling window.

    Args:
        completed_points: Story points completed per sprint (chronological)
        window: Number of sprints for rolling average
    """
    recent = completed_points[-window:]

    return {
        "rolling_average": round(sum(recent) / len(recent), 1),
        "min": min(recent),
        "max": max(recent),
        "range": f"{min(recent)}-{max(recent)}",
        "trend": "improving" if recent[-1] > recent[0] else
                 "declining" if recent[-1] < recent[0] else "stable",
        "data": recent,
    }

# Example: Team "Checkout" velocity over 10 sprints
velocity = calculate_velocity([18, 21, 16, 24, 20, 22, 19, 25, 21, 23])
# rolling_average: 21.7 (last 6 sprints)
# range: 19-25
# trend: stable
```

#### Using Velocity for Forecasting

```
Sprint planning with velocity:

  Team velocity: 20 points/sprint (rolling 6-sprint average)
  Range: 16-24 points/sprint

  Sprint capacity planning:
    - Optimistic: 24 points (do not plan to this)
    - Planned: 20 points (commit to this)
    - Conservative: 16 points (buffer for unknowns)

  Epic forecasting:
    Epic: "Customer loyalty program" = 65 story points
    Velocity: 20 points/sprint

    Optimistic:   65/24 = ~3 sprints
    Expected:     65/20 = ~3.5 sprints
    Conservative: 65/16 = ~4 sprints

    Communicate: "3-4 sprints, most likely completing in sprint 4"
```

#### Velocity Stabilization

New teams or teams after significant changes need 4-6 sprints before velocity is reliable.

```
Velocity stabilization timeline:
  Sprint 1-2: High variance, establishing norms       → Do not use for forecasting
  Sprint 3-4: Patterns emerge, calibration improving   → Cautious forecasting
  Sprint 5-6: Velocity stabilizes within ~20% range    → Use for capacity planning
  Sprint 7+:  Reliable trend data available             → Use for release forecasting
```

---

### Velocity Anti-Patterns

#### 1. Velocity as Performance Metric

```
WRONG:
  Manager: "Team A has velocity 30, Team B has velocity 20.
            Team A is more productive."

WHY IT IS WRONG:
  - Teams calibrate story points differently
  - Team A's "5" might equal Team B's "3"
  - Comparing velocity across teams is comparing different units
  - Leads to point inflation ("Let's call this an 8 instead of a 5")

CORRECT:
  Use velocity only within a single team for that team's forecasting.
  Compare teams by business outcomes (features delivered, customer impact).
```

#### 2. Gaming Points (Velocity Inflation)

When velocity is tied to rewards or recognition, teams inflate points.

```
Inflation signals:
  - Velocity increases 50%+ without visible productivity change
  - "1-point" stories take 2 days
  - Teams split stories to inflate count
  - Average story size increases over time

Prevention:
  - Never reward or punish based on velocity
  - Use velocity solely for forecasting
  - Track cycle time alongside velocity as a sanity check
  - If cycle time per point increases, inflation is likely
```

#### 3. Cross-Team Velocity Comparison

```
Anti-pattern: "Normalize story points across teams"

Why this fails:
  - Kills team autonomy in estimation
  - Creates overhead for cross-team calibration
  - Points are relative within a team, not absolute

What to compare instead:
  - Deployment frequency
  - Lead time for changes
  - Change failure rate
  - Mean time to restore
  (DORA metrics -- comparable across teams by design)
```

---

### Alternatives to Story Points

#### Cycle Time

Measure the elapsed time from work started to work completed.

```python
from datetime import datetime

def cycle_time_metrics(items: list[dict]) -> dict:
    """
    Calculate cycle time statistics.
    Each item: {"started": datetime, "completed": datetime}
    """
    cycle_times = [
        (item["completed"] - item["started"]).days
        for item in items
    ]
    cycle_times.sort()

    n = len(cycle_times)
    return {
        "median": cycle_times[n // 2],
        "p85": cycle_times[int(n * 0.85)],
        "p95": cycle_times[int(n * 0.95)],
        "average": round(sum(cycle_times) / n, 1),
    }

# If p85 cycle time is 5 days and you have 20 items:
# Forecast: 20 items * (5 days / items_per_day) ≈ 20 weeks at 1 item/day
```

#### Throughput

Count the number of items completed per time period, regardless of size (assumes stories are similarly sized).

```
Throughput-based forecasting:
  Last 8 weeks throughput: [5, 7, 4, 6, 5, 8, 6, 5]
  Average: 5.75 items/week

  Remaining backlog: 25 items

  p50: 25 / 5.75 ≈ 4.3 weeks
  p85: Use Monte Carlo simulation for more accuracy
```

#### When to Use Each

| Approach | Best For | Prerequisite |
|----------|----------|-------------|
| **Story points** | Teams that benefit from estimation conversations | Stable team, consistent calibration |
| **Cycle time** | Flow-based teams, Kanban | Tracking start/end dates per item |
| **Throughput** | Mature teams with similarly-sized stories | Consistent story decomposition |
| **No estimates** | High-trust teams with stable flow | Small stories, predictable throughput |

---

## 10 Best Practices

1. **Use story points for relative sizing only.** Never convert points to hours or days. The value of points is in relative comparison, not absolute measurement.

2. **Establish reference stories.** Maintain 5-7 reference stories that anchor the team's Fibonacci scale. Review them quarterly.

3. **Estimate as a team.** Estimation is a team activity, not a lead or manager activity. Different perspectives catch different complexities.

4. **Use planning poker for high-value items.** Simultaneous reveal prevents anchoring. Allow 2-3 rounds max; take the higher estimate if no consensus.

5. **Decompose stories above 8 points.** Large stories carry disproportionate risk. Split them into independently deliverable pieces before sprint commitment.

6. **Calculate velocity with a rolling window.** Use the last 6 sprints for a reliable average. Ignore outliers caused by holidays, team changes, or incidents.

7. **Never compare velocity across teams.** Velocity is a team-internal metric calibrated to that team's scale. Compare outcomes and DORA metrics instead.

8. **Track velocity trends, not absolute numbers.** A declining velocity trend signals problems (tech debt, unclear requirements, team instability). Investigate the cause.

9. **Separate estimation from commitment.** Estimates are inputs to planning. Commitments are what the team agrees to deliver after considering capacity, risks, and dependencies.

10. **Know when to drop story points.** If the team has stable throughput and consistently small stories, switch to flow-based forecasting (cycle time + throughput).

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Points = time** | "A 5-point story should take 5 days." Destroys the abstraction. | Reiterate: points measure relative effort, not duration |
| **Individual velocity tracking** | "Engineer X completes 15 points/sprint." Creates toxic competition. | Track velocity at team level only |
| **Velocity targets** | "Increase velocity by 20% next quarter." Incentivizes inflation. | Measure outcomes (features, impact), not velocity |
| **Cross-team normalization** | Forcing all teams to use the same point scale. | Let each team calibrate independently |
| **Never recalibrating** | Team's reference stories are 2 years old; scale has drifted. | Review reference stories quarterly |
| **Estimating everything** | Spending hours estimating bugs, chores, and spikes. | Only estimate user stories that affect capacity planning |
| **Ignoring velocity range** | Planning to exact average velocity every sprint. | Plan to average; use range for forecasting uncertainty |
| **Story point quotas** | "Each sprint must complete exactly 20 points." | Velocity is descriptive, not prescriptive |

---

## Enforcement Checklist

- [ ] Team has documented reference stories for 1, 2, 3, 5, 8, and 13 points
- [ ] Reference stories reviewed and updated at least quarterly
- [ ] Estimation sessions use simultaneous reveal (planning poker or equivalent)
- [ ] Stories > 8 points are decomposed before sprint commitment
- [ ] Velocity calculated using rolling 6-sprint average
- [ ] Velocity used only for team-level forecasting, never individual evaluation
- [ ] No cross-team velocity comparisons in management reporting
- [ ] Sprint commitment based on velocity range, not single number
- [ ] Cycle time tracked as complementary metric alongside velocity
- [ ] Team periodically evaluates whether to continue with story points or switch to flow metrics
