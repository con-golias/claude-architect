# Managing Deadlines & Delivery

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Estimation |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [estimation-techniques.md](estimation-techniques.md), [../methodologies/agile-scrum.md](../methodologies/agile-scrum.md) |

---

## Core Concepts

### Types of Deadlines

Not all deadlines are equal. Categorize each deadline to determine the appropriate response.

| Type | Characteristics | Examples | Strategy |
|------|----------------|----------|----------|
| **Hard** | Immovable, external consequences for missing | Regulatory compliance dates, contractual obligations, market events (Black Friday) | Fix date and budget; flex scope |
| **Soft** | Internal targets, movable with justification | Quarterly goals, internal launches, roadmap milestones | Negotiate scope or date based on data |
| **Aspirational** | Stretch goals, no consequences for missing | "Would be nice to ship by..." targets | Use as motivation, not commitment |

```
Decision framework:
  Is there a contractual, legal, or market consequence for missing?
    YES → Hard deadline. Lock date. Negotiate scope ruthlessly.
    NO  → Is there a strategic business reason for this date?
      YES → Soft deadline. Negotiate scope or date with data.
      NO  → Aspirational. Track progress; adjust as needed.
```

---

### Scope Negotiation

When time and budget are fixed, scope is the only variable. Master scope negotiation to deliver value within constraints.

#### MoSCoW Prioritization

Categorize every feature within a deadline into one of four buckets.

```
MoSCoW for a product launch with a hard deadline:

Must Have (60% of effort):
  - User authentication and login
  - Core checkout flow
  - Payment processing (credit card)
  → If these are not done, do not launch

Should Have (20% of effort):
  - Order history page
  - Email notifications
  - Basic analytics dashboard
  → Important but launch is viable without them

Could Have (15% of effort):
  - Social login (Google, Apple)
  - Wishlist feature
  - Advanced search filters
  → Nice to have; include if time allows

Won't Have (this time) (5% of effort):
  - Loyalty program
  - Multi-currency support
  - Mobile app
  → Explicitly out of scope for this release
```

**Key rule:** Must Haves should consume no more than 60% of available capacity. This provides buffer for unknowns and allows Should Haves to be included.

#### Scope Negotiation Conversations

```
Ineffective:
  PM: "We need all 20 features by March 1."
  Eng: "We can't do that."
  PM: "Make it work."

Effective:
  PM: "We need to launch by March 1. Here are 20 features."
  Eng: "Based on our velocity, we can deliver 12-14 features by March 1
        with 85% confidence. Let's categorize them by MoSCoW."
  PM: "Which 12 should be Must Have?"
  Eng: "Here's the breakdown with effort estimates for each..."
  PM: "Let's cut features 15-20 and keep 1-14 as the target."
  Eng: "Agreed. We'll track weekly and flag risks early."
```

---

### Risk Management

Identify, assess, and mitigate delivery risks before they become problems.

#### Risk Register

```python
from dataclasses import dataclass
from enum import Enum

class Likelihood(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

class Impact(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

@dataclass
class DeliveryRisk:
    description: str
    likelihood: Likelihood
    impact: Impact
    mitigation: str
    owner: str
    status: str  # "open", "mitigating", "resolved", "accepted"

    @property
    def score(self) -> int:
        return self.likelihood.value * self.impact.value

risks = [
    DeliveryRisk(
        description="Payment provider API changes before launch",
        likelihood=Likelihood.MEDIUM,
        impact=Impact.HIGH,
        mitigation="Abstract payment provider behind interface; "
                   "have fallback provider ready",
        owner="Tech Lead",
        status="mitigating",
    ),
    DeliveryRisk(
        description="Key engineer leaves during critical phase",
        likelihood=Likelihood.LOW,
        impact=Impact.HIGH,
        mitigation="Pair programming on critical paths; "
                   "document all architecture decisions",
        owner="Engineering Manager",
        status="open",
    ),
    DeliveryRisk(
        description="Third-party dependency has breaking change",
        likelihood=Likelihood.MEDIUM,
        impact=Impact.MEDIUM,
        mitigation="Pin dependency versions; monitor changelogs; "
                   "have upgrade sprint buffer",
        owner="Tech Lead",
        status="open",
    ),
]
```

#### Buffer Planning

Build explicit buffers into project plans. Do not hide buffers -- make them transparent.

```
Buffer strategies:

1. Percentage buffer:
   Estimated effort: 10 weeks
   Buffer (20%):     2 weeks
   Committed date:   12 weeks

2. Risk-based buffer:
   Low-risk items: 10% buffer
   Medium-risk items: 25% buffer
   High-risk items: 50% buffer

3. PERT-based buffer:
   Use p85 estimate instead of p50
   The difference IS the buffer

4. Feature buffer (preferred for fixed deadlines):
   Must Haves:     8 weeks (60% of 13-week quarter)
   Should Haves:   3 weeks (23%)
   Buffer/Could:   2 weeks (17%)
   → Buffer = Should Haves and Could Haves that can be cut
```

---

### Communicating Delays

Delays are inevitable. How you communicate them determines whether stakeholders trust you.

#### Early Warning System

```
Traffic light status reporting:

GREEN: On track. No significant risks.
  → No action needed beyond standard reporting.

AMBER: At risk. Identified risks that may cause delay.
  → Communicate: What is the risk? What is the mitigation plan?
  → When to raise: As soon as risk is identified (not when it materializes).

RED: Off track. Delay is certain without intervention.
  → Communicate: What is delayed? By how much? What are the options?
  → Options to present:
     a) Cut scope to meet the date
     b) Add resources (with realistic ramp-up time)
     c) Move the date (with new committed date)
     d) Accept reduced quality (last resort, with explicit trade-offs)
```

#### Stakeholder Communication Template

```markdown
## Project Status Update: [Project Name]
**Date:** YYYY-MM-DD
**Status:** AMBER (was GREEN last week)

### Summary
The checkout redesign project is at risk of a 1-week delay due to
unexpected complexity in the payment provider migration.

### What Changed
- Payment provider API requires PCI-DSS Level 1 certification changes
- Estimated additional effort: 5-8 days (PERT estimate)

### Options
| Option | Impact | Recommendation |
|--------|--------|----------------|
| Cut social login feature | Saves 5 days; feature moves to next release | Recommended |
| Extend deadline by 1 week | All features delivered; delays marketing campaign | Acceptable |
| Parallel-track with contractor | Adds cost; 3-day ramp-up; risk of integration issues | Not recommended |

### Recommendation
Cut social login (Should Have) to maintain the March 1 hard deadline.
Social login moves to the March 15 follow-up release.

### Next Steps
- [ ] PM to confirm scope reduction with stakeholders by Friday
- [ ] Engineering to re-estimate remaining work by Monday
```

**Rules for communicating delays:**
1. Communicate early. The moment you see AMBER, tell stakeholders. Never wait until RED.
2. Present options, not just problems. Stakeholders need actionable choices.
3. Use data, not feelings. "Our velocity data shows..." not "I think we might..."
4. Document the decision. Record what was agreed and why.
5. Update the plan immediately. Stale plans erode trust more than bad news.

---

### Crunch Prevention

Crunch (sustained overtime) is a management failure, not an engineering solution. It degrades quality, increases defects, and drives attrition. Research shows that after 2 weeks of crunch, productivity returns to baseline or drops below it, defect rates increase 30-50%, and the best engineers start job searching. Four weeks of crunch produces roughly the same output as four weeks of sustainable pace -- but with more bugs, more tech debt, and less trust.

**Sustainable pace practices:** Plan to 70-80% capacity. Limit WIP per person to 1-2 items. Protect weekends. If crunch is needed, time-box to 1-2 weeks max with recovery time. Retrospect after any crunch period.

---

### Release Planning

#### Release Trains

Ship on a fixed cadence regardless of what is ready. Features that miss the train ship on the next one.

```
Release train example (bi-weekly):

  Train 1 (Jan 15):  Feature A, Feature B, Bug fixes
  Train 2 (Jan 29):  Feature C (Feature D missed → moves to Train 3)
  Train 3 (Feb 12):  Feature D, Feature E, Bug fixes

Benefits:
  - Predictable release cadence for stakeholders
  - Reduces pressure to cram features into a specific release
  - Encourages smaller, incremental feature delivery
  - Failed features do not block other features

Requirements:
  - Feature flags to decouple deploy from release
  - Automated testing and deployment pipelines
  - Trunk-based development or short-lived branches
```

#### Quarterly Planning

Plan at the quarter level with confidence intervals.

```
Quarterly planning framework:

High confidence (committed):       Items 1-5
  → 90%+ chance of completion
  → Must Haves for the quarter
  → Team has estimated and accepted

Medium confidence (targeted):      Items 6-10
  → 50-70% chance of completion
  → Should Haves; depends on velocity and risk
  → Rough estimates, may need decomposition

Low confidence (stretch):          Items 11-15
  → 20-30% chance of completion
  → Could Haves if everything goes well
  → Not estimated in detail

Communicate this framework to stakeholders:
  "We are committing to items 1-5. Items 6-10 are our target.
   Items 11-15 are stretch goals we'll attempt if ahead of plan."
```

#### Roadmap Confidence Levels

| Horizon | Confidence | Detail Level |
|---------|-----------|-------------|
| Now (current quarter) | High | Specific features with estimates |
| Next quarter | Medium | Themes with rough scope |
| +2 quarters | Low | Strategic directions |
| +3 quarters | Exploratory | Vision and possibilities |

---

### Tracking Progress

#### Burndown Charts

Track remaining work over time. A flattening line signals blockers; a steep late drop signals risky big-batch completion; a line above the ideal signals the team is behind schedule.

#### Cumulative Flow Diagram (CFD)

Track the flow of work items through stages (To Do, In Progress, In Review, Done) over time. A widening band reveals a bottleneck in that stage. A flat "Done" line means nothing is completing.

#### Earned Value Management (EVM)

For fixed-scope/budget projects, track four key metrics:

| Metric | Formula | Meaning |
|--------|---------|---------|
| Schedule Variance (SV) | EV - PV | Positive = ahead of schedule |
| Cost Variance (CV) | EV - AC | Positive = under budget |
| Schedule Performance Index (SPI) | EV / PV | > 1 = ahead; < 1 = behind |
| Cost Performance Index (CPI) | EV / AC | > 1 = under budget; < 1 = over |

Where EV = budgeted cost of work performed, PV = budgeted cost of work scheduled, AC = actual cost of work performed.

---

## 10 Best Practices

1. **Categorize every deadline.** Determine if it is hard, soft, or aspirational before planning. This dictates the negotiation strategy.

2. **Fix time, flex scope.** For hard deadlines, lock the date and negotiate scope using MoSCoW. Never promise all scope by a fixed date without explicit trade-offs.

3. **Communicate risks at AMBER, not RED.** Raise concerns as soon as they are identified. Early warning gives stakeholders time to make informed decisions.

4. **Present options with trade-offs.** Never bring a problem without at least two proposed solutions. Include the trade-offs of each option.

5. **Build buffers transparently.** Add 15-25% buffer for known unknowns. Make buffers visible in the plan -- hidden buffers erode trust when discovered.

6. **Use release trains.** Ship on a fixed cadence. Features that miss the train wait for the next one. This reduces pressure and improves predictability.

7. **Plan to 70-80% capacity.** Leave room for unplanned work, bugs, support requests, and learning. Planning to 100% guarantees failure.

8. **Track leading indicators.** Burndown slope, WIP age, and cumulative flow predict problems before they materialize. Do not wait for the deadline to discover issues.

9. **Prevent crunch proactively.** If crunch is needed, it means planning failed. Conduct a retrospective to fix the planning process, not the engineers.

10. **Maintain a living risk register.** Review risks weekly during the project. Add new risks, update mitigation status, close resolved risks.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **All deadlines are hard** | Every request is urgent; teams cannot prioritize | Categorize deadlines; push back on false urgency |
| **Scope locked with date locked** | Inevitable crunch, quality cuts, or missed deadlines | Fix time, flex scope. Something must be variable. |
| **Communicating delays too late** | Stakeholders blindsided; trust destroyed; no time for course correction | Raise AMBER status immediately when risk is identified |
| **Crunch as default** | Burnout, attrition, quality degradation, compounding tech debt | Sustainable pace; retrospective after any crunch to prevent recurrence |
| **No buffer in plans** | Every risk materializes as a delay; plans are fiction | Add 15-25% explicit buffer; use PERT p85 estimates |
| **Velocity-based staffing** | "Add 3 engineers to go 3x faster." Brooks's Law applies. | New engineers slow the team for 2-3 months; plan for ramp-up |
| **Status reporting theater** | Green-green-green-RED. No intermediate signals. | Use AMBER actively; make it safe to report AMBER |
| **Planning without re-planning** | Original plan never updated; reality diverges; fiction persists | Re-plan at each milestone; update estimates with actual data |

---

## Enforcement Checklist

- [ ] Every project deadline categorized as hard, soft, or aspirational
- [ ] MoSCoW prioritization applied to all fixed-deadline projects
- [ ] Risk register created at project start and reviewed weekly
- [ ] Buffer of 15-25% included in all project plans
- [ ] Status reporting uses traffic light system (green/amber/red)
- [ ] Stakeholder communication template used for status changes
- [ ] Sprint capacity planned to 70-80%, not 100%
- [ ] Burndown or CFD tracked and visible to the team
- [ ] Crunch periods limited to 2 weeks max with mandatory recovery
- [ ] Quarterly retrospective on estimation accuracy and delivery predictability
