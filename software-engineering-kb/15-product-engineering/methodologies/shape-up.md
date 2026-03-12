# Shape Up (Basecamp Method)

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Methodologies |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Comparison](comparison.md), [Agile & Scrum](agile-scrum.md), [Kanban](kanban.md) |

---

## Core Concepts

### What Is Shape Up

Shape Up is a product development methodology created by Ryan Singer at Basecamp (formerly 37signals). It replaces the continuous backlog and sprint-based cadence with a deliberate cycle of **shaping**, **betting**, and **building** in fixed 6-week cycles followed by 2-week cooldown periods.

Key philosophical differences from Scrum/Kanban:
- **Appetite over estimation:** Define how much time a problem is worth, not how long a solution takes.
- **No backlog:** Ideas that are not bet on are discarded. Good ideas come back naturally.
- **Fixed time, variable scope:** Ship what fits in 6 weeks; cut scope, never extend time.
- **Full autonomy for builders:** Shaped work is assigned to small teams who decide how to execute.

### The Shape Up Cycle

```
┌───────────────────────────────────────────────────────────┐
│                    8-WEEK CYCLE                           │
│                                                           │
│  ┌─────────────────────────────┐  ┌───────────────────┐  │
│  │      BUILD (6 weeks)        │  │ COOLDOWN (2 weeks) │  │
│  │                             │  │                    │  │
│  │  Team executes shaped work  │  │  Bug fixes         │  │
│  │  Hill chart progress        │  │  Tech debt         │  │
│  │  Scope hammering            │  │  Exploration       │  │
│  │  Ship at end of cycle       │  │  Next cycle shaping│  │
│  └─────────────────────────────┘  └───────────────────┘  │
│                                                           │
│  SHAPING happens in parallel by senior staff during the   │
│  current build cycle, preparing pitches for the next one. │
└───────────────────────────────────────────────────────────┘
```

---

## Shaping

Shaping is the pre-work that happens before any building begins. It produces a **pitch** -- a document that describes the problem, the solution boundaries, and the risks, without specifying implementation details.

### Shaping Principles

1. **Set the appetite.** Decide upfront: is this a "small batch" (1-2 weeks) or a "big batch" (6 weeks)?
2. **Narrow the problem.** Define what you are solving and -- critically -- what you are *not* solving.
3. **Outline the solution at the right level.** Concrete enough to guide execution, abstract enough to leave room for builder creativity.
4. **De-risk before betting.** Identify rabbit holes, technical unknowns, and design traps. Resolve them during shaping, not during building.

### Breadboarding

A textual wireframe showing places (screens/pages), affordances (buttons/fields), and connection lines (flows). No visual design.

```
Login Page
  - Email field
  - Password field
  - [Log In] → Dashboard
  - [Forgot Password] → Reset Flow

Reset Flow
  - Email field
  - [Send Reset Link] → Confirmation
  - Confirmation: "Check your email"
```

- Focus on the interaction flow, not the layout.
- Name every place and affordance so the team has shared vocabulary.
- Use breadboards when the problem is primarily about flow and logic.

### Fat Marker Sketches

Rough visual sketches drawn with a thick marker (or digital equivalent) to show layout and element placement without detail.

- Use fat marker sketches when the problem is primarily about arrangement and visual hierarchy.
- Never use wireframing tools at this stage -- too much fidelity invites bikeshedding.
- Include annotations explaining *why* elements are placed where they are.

### De-Risking

Before presenting a pitch, actively seek and resolve risks:

```typescript
interface ShapedPitch {
  problem: string;
  appetite: "small-batch" | "big-batch"; // 1-2 weeks or 6 weeks
  solution: string; // Breadboard or fat marker sketch
  rabbitHoles: RabbitHole[];
  noGos: string[]; // Explicit exclusions
}

interface RabbitHole {
  description: string;
  risk: "high" | "medium" | "low";
  mitigation: string;
}

// Example pitch
const exportPitch: ShapedPitch = {
  problem: "Users cannot export their data in bulk",
  appetite: "big-batch",
  solution: "Add export page with format selector and async job queue",
  rabbitHoles: [
    {
      description: "Large datasets may timeout during export",
      risk: "high",
      mitigation: "Use background jobs with email notification on completion",
    },
    {
      description: "CSV formatting edge cases with unicode",
      risk: "medium",
      mitigation: "Use well-tested library; do not build custom CSV writer",
    },
  ],
  noGos: [
    "No real-time streaming export",
    "No custom template support in v1",
    "No scheduling/recurring exports",
  ],
};
```

---

## The Betting Table

### How Betting Works

- Senior leadership meets at the **betting table** before each 6-week cycle.
- They review shaped pitches and decide which to **bet on** (fund with team time).
- A bet is a commitment: the team gets the full 6 weeks with no interruptions.
- Pitches not selected are **discarded**, not added to a backlog.

### Pitch Structure

A pitch document includes:
1. **Problem** -- the raw situation or request.
2. **Appetite** -- how much time this deserves (small or big batch).
3. **Solution** -- breadboards, fat marker sketches, and flow descriptions.
4. **Rabbit holes** -- known risks and their mitigations.
5. **No-gos** -- explicit boundaries of what is out of scope.

### The Circuit Breaker

- If a project is not done at the end of 6 weeks, it does **not** automatically get an extension.
- The team stops. The work is evaluated: was it shaped poorly? Is the appetite wrong?
- The circuit breaker prevents runaway projects and sunk-cost thinking.
- A re-shaped, smaller version may be pitched in a future cycle.

### No Backlogs

- Backlogs are considered harmful in Shape Up: they grow endlessly, create guilt, and waste time managing stale items.
- Instead, trust that important ideas resurface. If an idea is truly valuable, someone will pitch it again.
- Use a simple informal list for "ideas to consider" if needed, but never formalize it into a prioritized queue.

---

## Building Phase

### Team Structure

- **Small teams:** 1 designer + 1-2 programmers for a big-batch project.
- **Full autonomy:** The team decides how to break down the work, what to build first, and how to cut scope.
- **No daily standups or status reports.** Progress is communicated via hill charts.

### Hill Charts

Hill charts replace burndowns and standups. Each scope is plotted on a hill:

```
                    ╱╲
  Figuring        ╱    ╲        Making
  things out    ╱        ╲      it happen
              ╱            ╲
            ╱                ╲
──────────╱────────────────────╲──────────
    Unknown                        Known
    territory                      territory

Scopes:
  ● User auth flow        ──────────────→ (over the hill, 80%)
  ● Export page UI         ────────→       (at the top, 50%)
  ● Background job queue   ───→            (uphill, 20%)
```

- **Left side (uphill):** Figuring things out. Uncertainty is high. Problem-solving.
- **Right side (downhill):** Making it happen. Execution. Low uncertainty.
- Teams update hill charts asynchronously. Stakeholders check progress without meetings.
- A scope stuck on the uphill side for too long signals a problem worth discussing.

### Scopes

- Break shaped work into **scopes** -- meaningful slices of functionality that can be completed independently.
- Scopes are not tasks. A scope is a cluster of related tasks that together form a meaningful piece of the whole.
- Name scopes by the user-visible behavior they deliver.

```python
# Scope decomposition example
scopes = {
    "Export Page UI": {
        "tasks": [
            "Create export page route",
            "Build format selector component",
            "Add file size estimator",
            "Wire up submit button to API",
        ],
        "hill_position": 0.5,  # 0.0 = start, 0.5 = top of hill, 1.0 = done
    },
    "Background Job Queue": {
        "tasks": [
            "Set up job queue infrastructure",
            "Create export job processor",
            "Add progress tracking",
            "Send email notification on completion",
        ],
        "hill_position": 0.2,
    },
    "Download & Cleanup": {
        "tasks": [
            "Generate download link",
            "Set expiration on exported files",
            "Add cleanup cron job",
        ],
        "hill_position": 0.0,
    },
}
```

### Scope Hammering

When time runs short, cut scope aggressively to ship within the cycle:

- Identify the **must-have** scopes versus **nice-to-have** scopes.
- Simplify implementations: use a simpler UI, skip edge cases, defer polish.
- The goal is to ship something meaningful, not everything imagined.
- Never extend the cycle. Fixed time, variable scope.

---

## Cooldown Period

The 2-week cooldown between cycles serves multiple purposes:

1. **Fix bugs** reported during the previous cycle.
2. **Pay tech debt** that accumulated during focused building.
3. **Explore** new ideas and prototype concepts for future pitches.
4. **Recharge** -- prevent burnout from continuous deadline pressure.
5. **Shape** -- senior staff finalize pitches for the next betting table.

Cooldown is unstructured. Developers choose what to work on. No deadlines, no assignments.

---

## When Shape Up Works Best

| Context | Fit |
|---------|-----|
| Small teams (2-10 developers) | Excellent |
| Product companies building their own product | Excellent |
| Innovation-heavy, greenfield projects | Excellent |
| Agency/consulting with client-driven scope | Poor (clients expect backlogs and estimates) |
| Large teams (50+ developers) | Challenging (requires adaptation) |
| Highly regulated environments | Poor (audit trails need formalized tracking) |
| Maintenance/ops-heavy work | Poor (use Kanban instead) |

---

## Hybrid Approaches

### Shape Up + Kanban

- Use 6-week cycles for major feature work (shaped pitches).
- Run a parallel Kanban board for bugs, support, and maintenance.
- Dedicate a portion of the team to Kanban flow permanently.

### Shape Up + Scrum Elements

- Keep shaping and betting; replace the unstructured build phase with 1-week sprints inside the 6-week cycle.
- Add lightweight standups (async) for coordination in larger teams.
- Use sprint reviews for stakeholder visibility without waiting 6 weeks.

### Shape Up for Larger Organizations

- Run multiple small teams, each with their own 6-week cycle.
- Synchronize cycle start dates so the betting table covers all teams.
- Create a "shaping team" of senior engineers and product managers.
- Use shared hill charts for cross-team visibility.

---

## 10 Best Practices

1. **Respect the appetite.** Define how much time a problem is worth before thinking about solutions. The appetite constrains the solution, not the other way around.
2. **Shape at the right altitude.** Pitches that are too abstract leave teams directionless. Pitches that are too detailed rob teams of autonomy. Aim for the sweet spot.
3. **De-risk aggressively during shaping.** Every rabbit hole not addressed during shaping becomes a crisis during building. Spend time upfront to save time later.
4. **Enforce the circuit breaker.** If work is not done at 6 weeks, stop. Re-evaluate, re-shape, and re-pitch. Never silently extend cycles.
5. **Trust the builders.** Once a bet is placed, do not micromanage. The team decides how to execute. Check hill charts, not task lists.
6. **Cut scope, never extend time.** When behind, hammer scope aggressively. Ship a smaller, complete version rather than an incomplete ambitious one.
7. **Discard unbet pitches.** Resist the urge to maintain a backlog of "maybe someday" pitches. Good ideas will return; bad ones will not.
8. **Use cooldown intentionally.** Protect cooldown from being consumed by the next cycle's work. It exists for recovery, exploration, and debt reduction.
9. **Name scopes by behavior, not components.** "User can export as CSV" is a scope. "Backend export module" is not. Scopes should map to user-visible outcomes.
10. **Track progress via hill charts, not percentage complete.** Hill charts reveal whether the team understands the problem, not just whether code is written.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Shaping too detailed (wireframes, specs) | Builders have no creative room; just executing orders | Use breadboards and fat marker sketches only |
| Shaping too vague ("make it better") | Builders flounder with no direction; cycle wasted | Define problem, solution boundaries, and rabbit holes |
| Maintaining a backlog of pitches | Backlog grows endlessly; creates guilt and politics | Discard unbet pitches; trust good ideas to resurface |
| Extending cycles past 6 weeks | Removes urgency; projects drift; scope creeps | Enforce the circuit breaker absolutely |
| Skipping cooldown | Burnout accumulates; tech debt compounds; no exploration | Protect cooldown as non-negotiable team time |
| No hill chart updates | Stakeholders are blind; stuck scopes go unnoticed | Require asynchronous hill chart updates 2-3x per week |
| Betting on unshaped work | High risk of rabbit holes; cycle failure likely | Require a complete pitch document before any bet |
| Using Shape Up for ops/maintenance | Maintenance work needs continuous flow, not cycles | Use Kanban for operational work alongside Shape Up |

---

## Enforcement Checklist

- [ ] Every bet has a written pitch with problem, appetite, solution, rabbit holes, and no-gos
- [ ] Appetite is declared before solution design begins
- [ ] 6-week cycle length is fixed and never extended
- [ ] Circuit breaker is enforced for overdue projects
- [ ] Betting table meets before each cycle with senior leadership
- [ ] Unbet pitches are discarded, not accumulated in a backlog
- [ ] Teams of 1 designer + 1-2 programmers are assigned per big-batch project
- [ ] Hill charts are updated asynchronously at least twice per week
- [ ] Scopes are named by user-visible behavior, not technical components
- [ ] 2-week cooldown is protected for bugs, debt, and exploration
- [ ] Scope is cut when behind schedule, not time extended
- [ ] Shaping uses breadboards and fat marker sketches, not detailed wireframes
