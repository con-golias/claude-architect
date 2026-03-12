# Estimation Techniques

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Estimation |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [story-points.md](story-points.md), [managing-deadlines.md](managing-deadlines.md) |

---

## Core Concepts

### Why Estimation Is Hard

Software estimation is fundamentally difficult because software development is design work, not manufacturing. Every task involves novelty, uncertainty, and hidden complexity.

#### The Cone of Uncertainty

Estimates become more accurate as projects progress. Early estimates can be off by 4x in either direction. Accept this and communicate ranges, not single numbers.

```
Cone of Uncertainty:
  Phase                  Estimate Range
  ─────────────────────  ──────────────
  Initial concept        0.25x - 4.0x
  Approved definition    0.50x - 2.0x
  Requirements complete  0.67x - 1.5x
  UI design complete     0.80x - 1.25x
  Detailed design        0.90x - 1.10x
  Development complete   ~1.0x

  Key insight: Do not commit to fixed scope at the wide end of the cone.
```

#### Cognitive Biases in Estimation

| Bias | Description | Mitigation |
|------|-------------|------------|
| **Planning fallacy** | Underestimate time despite knowing past projects overran | Use historical data, not intuition |
| **Anchoring** | First number mentioned dominates all subsequent estimates | Estimate independently before discussing |
| **Optimism bias** | Assume best-case scenario; ignore risks | Explicitly estimate best/worst/likely cases |
| **Dunning-Kruger** | Inexperienced estimators are most confident | Calibrate with experienced engineers; track accuracy |
| **Scope creep blindness** | Ignore incremental additions to scope | Re-estimate when scope changes; track total scope |

---

### Estimation Techniques

#### 1. T-Shirt Sizing (XS, S, M, L, XL)

Use for early-stage estimation when precision is unnecessary. Map sizes to rough effort ranges.

```
T-Shirt Sizes:
  XS  →  < 1 day       (trivial change, config update)
  S   →  1-3 days      (small feature, bug fix)
  M   →  3-5 days      (standard feature, moderate complexity)
  L   →  1-2 weeks     (complex feature, multiple components)
  XL  →  2-4 weeks     (epic-level, needs decomposition)
  XXL →  > 4 weeks     (too large -- break it down)
```

**When to use:** Roadmap planning, epic-level prioritization, initial triage.
**When to avoid:** Sprint planning, commitment-level estimation.

#### 2. Planning Poker

Consensus-based estimation using Fibonacci-like scales. Each estimator independently selects a value, then all reveal simultaneously.

```
Planning Poker Process:
  1. Product owner describes the story
  2. Team discusses, asks clarifying questions
  3. Each member privately selects a card (1, 2, 3, 5, 8, 13, 21, ?)
  4. All cards revealed simultaneously
  5. If estimates diverge:
     - Highest and lowest explain their reasoning
     - Team discusses new information
     - Re-vote (max 3 rounds)
  6. If still divergent after 3 rounds, take the higher estimate
```

**Why simultaneous reveal matters:** Prevents anchoring. If a senior engineer says "2" first, juniors will not say "8" even if they believe it.

#### 3. Bucket System

Sort items into predefined effort buckets quickly. Useful for estimating large backlogs.

```
Bucket System Process:
  1. Define buckets: 1, 2, 3, 5, 8, 13, 20, 40, 100
  2. Place the first item in a middle bucket as a reference
  3. For each subsequent item:
     - "Is this bigger or smaller than the reference?"
     - Place in the appropriate bucket
  4. Review each bucket for consistency
  5. Re-sort outliers

  Speed: ~50-100 items per hour (vs ~10-15 with planning poker)
```

#### 4. Three-Point Estimation (PERT)

Estimate three scenarios and calculate a weighted average. Produces a probability distribution.

```python
def pert_estimate(optimistic: float, most_likely: float, pessimistic: float) -> dict:
    """
    Calculate PERT estimate with standard deviation.

    Uses the PERT formula:
      Expected = (O + 4*M + P) / 6
      StdDev   = (P - O) / 6
    """
    expected = (optimistic + 4 * most_likely + pessimistic) / 6
    std_dev = (pessimistic - optimistic) / 6

    return {
        "expected": round(expected, 1),
        "std_dev": round(std_dev, 1),
        "confidence_68": (round(expected - std_dev, 1), round(expected + std_dev, 1)),
        "confidence_95": (round(expected - 2*std_dev, 1), round(expected + 2*std_dev, 1)),
    }

# Example: Estimating a payment integration feature
result = pert_estimate(
    optimistic=5,     # Best case: 5 days
    most_likely=8,    # Most likely: 8 days
    pessimistic=20,   # Worst case: 20 days
)
# expected: 9.2 days
# 68% confidence: 6.7 - 11.7 days
# 95% confidence: 4.2 - 14.2 days
```

#### 5. Reference Class Forecasting

Estimate based on how similar projects actually performed, not how you think this one will go. This technique counters optimism bias.

```
Reference Class Forecasting Process:
  1. Identify the reference class (similar past projects)
  2. Collect actual duration/effort data for those projects
  3. Plot the distribution
  4. Place the current project within that distribution
  5. Adjust for specific known differences

Example:
  "API integration projects" reference class (last 8 projects):
  Estimated: 2 weeks (average)
  Actual:    3.2 weeks (average), range 1.5 - 6 weeks

  New API integration estimate:
  → Do not say "2 weeks"
  → Say "3-4 weeks based on historical data, 1.5-6 week range"
```

---

### Monte Carlo Simulation

Use Monte Carlo simulation for project-level forecasting. Instead of single-point estimates, model the probability of completing N items by a given date.

```python
import random
from datetime import datetime, timedelta

def monte_carlo_forecast(
    items_remaining: int,
    historical_throughput: list[int],  # Items completed per week (last N weeks)
    simulations: int = 10_000,
) -> dict:
    """
    Simulate project completion dates using historical throughput.
    """
    completion_weeks = []

    for _ in range(simulations):
        items_left = items_remaining
        weeks = 0
        while items_left > 0:
            # Randomly sample a historical throughput value
            weekly_throughput = random.choice(historical_throughput)
            items_left -= weekly_throughput
            weeks += 1
        completion_weeks.append(weeks)

    completion_weeks.sort()

    today = datetime.now()
    return {
        "p50": today + timedelta(weeks=completion_weeks[int(0.50 * simulations)]),
        "p70": today + timedelta(weeks=completion_weeks[int(0.70 * simulations)]),
        "p85": today + timedelta(weeks=completion_weeks[int(0.85 * simulations)]),
        "p95": today + timedelta(weeks=completion_weeks[int(0.95 * simulations)]),
    }

# Example: 30 stories remaining, team throughput over last 12 weeks
forecast = monte_carlo_forecast(
    items_remaining=30,
    historical_throughput=[4, 5, 3, 6, 4, 5, 2, 5, 4, 3, 5, 4],
)
# p50: May 15  (50% chance of finishing by this date)
# p85: June 2  (85% chance -- use for commitments)
# p95: June 12 (95% chance -- use for hard deadlines)
```

**Key insight:** Commit at p85, not p50. A p50 estimate means you will miss the deadline 50% of the time.

---

### The #NoEstimates Movement

#NoEstimates argues that estimation effort is often wasted and that flow-based metrics provide better forecasting.

#### When to Skip Estimation

- Team has stable throughput (predictable velocity over 8+ sprints)
- Stories are consistently small (< 3 days of work each)
- Forecasting can use cycle time and throughput instead
- Estimation ceremonies consume disproportionate time (> 10% of sprint)

#### Flow-Based Forecasting

```
Instead of: "This epic is 34 story points, velocity is 17/sprint → 2 sprints"
Use:        "This epic has 12 stories, throughput is 6/week → ~2 weeks (p50)"

Flow metrics that replace estimation:
  - Cycle time: Time from work started to work completed
  - Throughput: Number of items completed per time period
  - WIP (Work in Progress): Items currently in flight
  - Aging: How long current items have been in progress
```

---

### Estimation at Different Levels

| Level | Technique | Precision | Purpose |
|-------|-----------|-----------|---------|
| **Portfolio / Roadmap** | T-shirt sizing, SWAG | +/- 100% | Budgeting, strategic planning |
| **Epic** | Reference class, PERT | +/- 50% | Release planning, quarter goals |
| **Story** | Planning poker, bucket | +/- 30% | Sprint planning, commitment |
| **Task** | Hours (if needed) | +/- 20% | Daily coordination (optional) |

---

### Calibrating Estimates

Track estimation accuracy over time. Improve through feedback loops, not willpower.

```python
def estimation_accuracy(estimates: list[dict]) -> dict:
    """
    Calculate estimation accuracy metrics.
    Each item: {"estimated": float, "actual": float}
    """
    ratios = [item["actual"] / item["estimated"] for item in estimates]

    return {
        "mean_ratio": sum(ratios) / len(ratios),  # >1 = underestimate
        "median_ratio": sorted(ratios)[len(ratios) // 2],
        "within_20pct": sum(1 for r in ratios if 0.8 <= r <= 1.2) / len(ratios),
        "within_50pct": sum(1 for r in ratios if 0.5 <= r <= 1.5) / len(ratios),
        "bias": "underestimate" if sum(ratios) / len(ratios) > 1.1 else
                "overestimate" if sum(ratios) / len(ratios) < 0.9 else "calibrated",
    }

# Track per team, per quarter. Expect:
# - within_20pct > 50% for well-calibrated teams
# - mean_ratio between 0.9 and 1.3
```

**Calibration practices:**
- Record estimates at planning time (before work begins)
- Record actuals at completion time
- Review accuracy monthly; adjust estimation heuristics
- Apply a team-specific multiplier if bias is consistent (e.g., multiply by 1.3x if team consistently underestimates by 30%)

---

## 10 Best Practices

1. **Estimate in ranges, not points.** Communicate "5-8 days" instead of "6 days." Single-point estimates convey false precision.

2. **Estimate independently before discussing.** Prevent anchoring by having each team member estimate before revealing. Planning poker enforces this.

3. **Use historical data over intuition.** Reference class forecasting and Monte Carlo simulations outperform expert judgment for multi-item forecasts.

4. **Match technique to precision needed.** T-shirt sizing for roadmaps, planning poker for sprints. Do not over-invest in precision at the wrong level.

5. **Decompose before estimating.** Break epics into stories and stories into tasks. Smaller items have narrower estimate ranges.

6. **Include uncertainty explicitly.** Three-point estimation (PERT) makes uncertainty visible. Use confidence intervals, not false certainty.

7. **Calibrate continuously.** Track estimated vs. actual effort. Identify systematic bias and adjust. Teams improve estimation through feedback, not practice alone.

8. **Re-estimate when scope changes.** Any significant scope change invalidates the original estimate. Re-estimate and communicate the impact.

9. **Commit at p85, not p50.** A p50 estimate is a coin flip. For deadlines with consequences, use the 85th percentile.

10. **Know when to stop estimating.** If the team has stable throughput and consistently small stories, flow-based forecasting is cheaper and often more accurate.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Estimate = commitment** | Estimates treated as promises; padding grows | Separate estimation from commitment; communicate ranges |
| **Anchoring by seniors** | Senior engineer speaks first; team converges on their number | Simultaneous reveal (planning poker) |
| **Precision theater** | Estimating in hours for 6-month projects | Match precision to the cone of uncertainty stage |
| **Never re-estimating** | Original estimate persists despite scope changes | Re-estimate when scope, assumptions, or team changes |
| **Estimating without decomposition** | Large items estimated as blobs; variance is enormous | Decompose into stories < 3-5 days before estimating |
| **Using estimates for performance review** | Engineers pad estimates to "never miss"; innovation dies | Decouple estimation from evaluation; focus on accuracy |
| **Ignoring historical data** | Each estimate starts from scratch; same biases repeated | Build a reference database; use past actuals as inputs |
| **Spending more on estimation than the work** | Multi-hour estimation sessions for 1-day tasks | Time-box estimation; skip for trivial items |

---

## Enforcement Checklist

- [ ] Team uses a defined estimation technique (planning poker, PERT, or similar)
- [ ] Estimates recorded before work begins for accuracy tracking
- [ ] Actual effort tracked and compared to estimates monthly
- [ ] Team estimation accuracy reviewed quarterly; calibration adjustments applied
- [ ] Estimates communicated as ranges with confidence levels, not single points
- [ ] Re-estimation triggered when scope changes > 20%
- [ ] Large items (> 2 weeks) decomposed before commitment
- [ ] Monte Carlo or flow-based forecasting used for multi-week projections
- [ ] Estimation sessions time-boxed (max 2 hours per session)
- [ ] Estimation data never used for individual performance evaluation
