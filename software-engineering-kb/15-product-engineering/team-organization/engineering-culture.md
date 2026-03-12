# Engineering Culture & Developer Experience

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Team Organization |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [team-topologies.md](team-topologies.md), [../../13-code-quality/code-review/culture.md](../../13-code-quality/code-review/culture.md) |

---

## Core Concepts

### Engineering Values

Define explicit engineering values that guide daily decisions. Values without concrete behaviors are empty slogans.

#### Ownership

Give teams full ownership of their systems -- from design through production operations. Ownership means authority over decisions, responsibility for outcomes, and accountability for incidents.

```
Ownership in practice:
  - Team decides tech stack within organizational guardrails
  - Team is on-call for its services ("you build it, you run it")
  - Team owns its backlog prioritization (with product input)
  - Team writes and maintains its own runbooks
  - Post-incident reviews happen within the owning team first
```

#### Autonomy with Alignment

Grant teams autonomy over how they work while maintaining alignment on what and why. Use lightweight governance -- architecture decision records (ADRs), engineering principles, and golden paths -- not approval gates.

#### Craftsmanship

Set high standards for code quality, testing, documentation, and operational readiness. Craftsmanship is not perfectionism -- it is the discipline to leave code better than you found it.

#### Continuous Learning

Allocate explicit time for learning. Organizations that skip learning accumulate knowledge debt that compounds faster than technical debt.

```python
learning_time_allocation = {
    "google_20_percent": "20% time for self-directed projects",
    "spotify_hack_weeks": "Quarterly hack weeks for exploration",
    "shopify_dev_days": "Dedicated development days each sprint",
    "pragmatic_minimum": "4 hours/week for learning (reading, courses, experimentation)",
}
```

---

### Developer Experience (DevEx)

Developer experience encompasses everything that affects how developers feel about, think about, and perform their daily work. Poor DevEx is the silent productivity killer.

#### The SPACE Framework

Use the SPACE framework (Forsgren et al., 2021) to measure developer productivity holistically. No single metric captures productivity -- use a balanced set across dimensions.

| Dimension | What It Measures | Example Metrics |
|-----------|-----------------|-----------------|
| **Satisfaction** | How developers feel about work, tools, team | Developer satisfaction survey, NPS, retention rate |
| **Performance** | Outcomes of work | Code quality, reliability, customer impact, business metrics |
| **Activity** | Volume of actions (use carefully) | Commits, PRs, deployments, code reviews (never as sole metric) |
| **Communication** | How people collaborate | PR review turnaround, knowledge sharing, meeting quality |
| **Efficiency** | Minimal friction in workflows | Build time, deploy time, time-to-merge, onboarding time |

```typescript
// SPACE metrics dashboard structure
interface SpaceMetrics {
  satisfaction: {
    developerNps: number;           // Quarterly survey (-100 to 100)
    toolSatisfaction: number;       // 1-5 scale per tool category
    retentionRate: number;          // % engineers retained over 12 months
    wouldRecommend: number;         // % who'd recommend working here
  };
  performance: {
    deployFrequency: number;        // Deploys per team per week
    changeFailureRate: number;      // % of deploys causing incidents
    mttr: number;                   // Mean time to restore (minutes)
    customerImpactScore: number;    // Custom composite metric
  };
  activity: {
    prsPerDeveloper: number;        // Rolling 4-week average
    codeReviewsCompleted: number;   // Per developer per week
    // WARNING: Never use activity metrics for individual evaluation
  };
  communication: {
    prReviewTurnaround: number;     // Hours from open to first review
    crossTeamCollaboration: number; // PRs with cross-team reviewers
    documentationContributions: number;
  };
  efficiency: {
    buildTimeP95: number;           // Minutes
    deployTimeP95: number;          // Minutes
    onboardingTimeToFirstPR: number; // Days
    localDevSetupTime: number;      // Minutes
  };
}
```

**Critical rule:** Never use activity metrics alone to evaluate individuals. Activity without context is misleading and incentivizes gaming.

---

### Onboarding

Great onboarding accelerates time-to-productivity and improves retention. The first 90 days determine whether an engineer thrives or struggles.

#### 30-60-90 Day Plan

```
Day 1-30: LEARN
  Week 1:
    - Complete environment setup (target: <4 hours)
    - Meet team members, manager, skip-level
    - Read team charter, architecture docs, ADRs
    - Ship a small PR (typo fix, config change) on Day 1-2
  Week 2-4:
    - Complete onboarding learning path (codebase walkthrough)
    - Pair program on 2-3 features with different team members
    - Shadow on-call rotation for one week
    - Attend all team ceremonies; ask questions freely

Day 31-60: CONTRIBUTE
    - Own and ship a medium-sized feature independently
    - Participate in code reviews (giving and receiving)
    - Join on-call rotation with backup buddy
    - Write or improve one piece of documentation
    - Have first career conversation with manager

Day 61-90: OWN
    - Lead a feature from design to production
    - Contribute to sprint planning and estimation
    - Mentor the next new team member (if applicable)
    - Present a tech talk or share a learning with the team
    - Set goals for the next quarter with manager
```

#### Buddy System

Assign every new engineer a buddy -- a peer (not their manager) who provides daily support.

**Buddy responsibilities:**
- Daily check-ins during the first two weeks (15 min)
- Answer "obvious" questions without judgment
- Introduce the new engineer to key people and systems
- Provide cultural context (how decisions are made, unwritten norms)
- Escalate blockers to the manager

#### Documentation-Driven Onboarding

Maintain a living onboarding guide that is validated by every new hire. Each new engineer should update it as they go through it.

```markdown
# Onboarding Checklist (team-specific)

## Environment Setup
- [ ] Clone repos: checkout-service, shared-libs, platform-tools
- [ ] Run `make setup` -- should complete in <15 minutes
- [ ] Verify local tests pass: `make test`
- [ ] Access granted: GitHub, Slack channels, PagerDuty, Datadog, AWS

## Architecture
- [ ] Read system architecture doc: /docs/architecture.md
- [ ] Review ADR log: /docs/adrs/
- [ ] Walk through request flow: API gateway → service → database

## First Tasks
- [ ] Fix a "good first issue" (label: onboarding)
- [ ] Pair on a current sprint story
- [ ] Review 3 PRs from team members
```

---

### Knowledge Sharing

Prevent knowledge silos. The bus factor (how many people can leave before a project stalls) should be >= 3 for every critical system.

#### Mechanisms

| Mechanism | Frequency | Purpose |
|-----------|-----------|---------|
| **Tech talks** | Bi-weekly | Share deep dives on systems, technologies, or post-mortems |
| **Guilds / Communities of Practice** | Monthly | Cross-team alignment on practices (frontend, backend, data) |
| **RFCs (Request for Comments)** | As needed | Propose and debate significant technical decisions |
| **Internal blog / engineering blog** | Weekly | Share learnings, war stories, tutorials |
| **Lunch-and-learn** | Weekly | Informal knowledge sharing over a meal |
| **Pair/mob programming** | Daily | Real-time knowledge transfer during development |
| **Architecture Decision Records** | Per decision | Document why decisions were made, not just what |

```markdown
# RFC Template

## Title: [Proposal Title]
## Author: [Name]
## Status: Draft | In Review | Accepted | Rejected | Superseded
## Date: YYYY-MM-DD

### Problem Statement
What problem are we solving? Why now?

### Proposed Solution
Describe the approach. Include diagrams where helpful.

### Alternatives Considered
What else did we evaluate? Why was it rejected?

### Trade-offs
What are we gaining? What are we giving up?

### Rollout Plan
How will we implement this? Phased approach? Migration?

### Open Questions
What is still unresolved?
```

---

### Psychological Safety

Psychological safety is the belief that one can speak up, take risks, and make mistakes without punishment. It is the foundation of high-performing teams (Google Project Aristotle, 2015).

#### Blameless Culture

```
Blameless post-incident review principles:
  1. Assume everyone acted with the best information available at the time
  2. Focus on system failures, not individual failures
  3. Ask "what" and "how", not "who" and "why did you"
  4. Document contributing factors, not root cause (singular)
  5. Produce action items that improve the system, not punishments
  6. Share learnings broadly -- incidents are learning opportunities
```

#### Safe-to-Fail Experiments

Encourage controlled experimentation. Innovation requires permission to fail.

- Run experiments with bounded blast radius (feature flags, canary deploys)
- Celebrate learning from failures, not just successes
- Distinguish "safe-to-fail" experiments from "fail-safe" requirements
- Never punish engineers for production incidents caused during normal work

---

### Growth Frameworks

#### Engineering Ladder: IC Track vs Management Track

```
Individual Contributor Track:        Management Track:
  L1: Junior Engineer                  M1: Engineering Manager
  L2: Engineer                         M2: Senior Eng Manager
  L3: Senior Engineer                  M3: Director of Engineering
  L4: Staff Engineer                   M4: VP of Engineering
  L5: Principal Engineer               M5: CTO / SVP Engineering
  L6: Distinguished Engineer

Key principle: The tracks are parallel, not hierarchical.
A Staff Engineer and a Director have equivalent organizational impact.
```

#### Career Conversations

Hold career conversations quarterly (separate from performance reviews).

```
Career conversation framework:
  1. Where are you now? (current skills, strengths, growth areas)
  2. Where do you want to go? (6-month, 1-year, 3-year aspirations)
  3. What is the gap? (skills, experiences, exposure needed)
  4. What is the plan? (concrete actions, projects, mentors)
  5. How can I help? (manager commitments, sponsorship, opportunities)
```

---

### Remote and Distributed Teams

#### Async-First Communication

Default to asynchronous communication. Synchronous meetings are expensive and exclusionary across timezones.

```python
communication_defaults = {
    "decisions": "Written RFC or ADR (async review, sync discussion if needed)",
    "status_updates": "Written in project tracker or Slack channel (never meetings)",
    "code_review": "Async PR review with <24h turnaround SLA",
    "questions": "Post in public channel (not DM) for searchability",
    "brainstorming": "Start with async doc, then optional sync session",
    "incidents": "Sync war room only for active incidents; async for post-mortems",
}
```

#### Documentation Culture

In distributed teams, documentation is not optional -- it is infrastructure.

- Write decisions down (ADRs, meeting notes, Slack threads summarized)
- Record demos and tech talks for async viewing
- Maintain a team handbook (processes, norms, contacts)
- Default to public channels over DMs for organizational knowledge

#### Timezone Overlap

- Establish 2-4 hours of shared overlap for synchronous collaboration
- Schedule recurring meetings in the overlap window only
- Rotate meeting times to share timezone burden fairly
- Use "follow-the-sun" for on-call and incident response

---

## 10 Best Practices

1. **Write down your engineering values.** Make them explicit, concrete, and actionable. Revisit annually. Values only matter if they influence decisions.

2. **Measure developer experience with SPACE.** Use a balanced scorecard across all five dimensions. Survey quarterly. Act on findings visibly.

3. **Ship a PR on Day 1.** Design onboarding so every new engineer ships something (however small) within their first two days. This builds confidence and validates the setup.

4. **Assign onboarding buddies.** Every new hire gets a peer buddy for their first 90 days. Buddies are trained on what the role entails.

5. **Run blameless post-incident reviews.** Document contributing factors, not blame. Share learnings broadly. Action items improve the system.

6. **Invest in knowledge sharing rituals.** Tech talks, RFCs, pair programming, and guilds prevent knowledge silos. Allocate explicit time for these.

7. **Build parallel career tracks.** IC and management tracks with equivalent compensation and respect. No one should manage people just for a promotion.

8. **Default to async communication.** Write things down. Record meetings. Post in public channels. This includes and benefits everyone, not just remote workers.

9. **Protect maker time.** Engineers need 4+ hour uninterrupted blocks for deep work. Consolidate meetings into specific days or time blocks.

10. **Celebrate learning, not just shipping.** Recognize engineers who share knowledge, write documentation, mentor others, and learn from failures.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Hero culture** | One person holds all context; bus factor = 1; burnout | Distribute knowledge through pairing, documentation, rotation |
| **Meeting-driven culture** | No time for deep work; decisions happen in meetings only | Default to async; require written proposals before meetings |
| **Invisible engineering values** | Values exist on a poster but do not influence decisions | Tie values to hiring rubrics, promotion criteria, and daily decisions |
| **Sink-or-swim onboarding** | New hires take months to become productive; high early attrition | Structured 30-60-90 plan with buddy, clear milestones |
| **Blame-first incident response** | Engineers hide mistakes; problems persist; morale drops | Blameless post-mortems; focus on systemic improvements |
| **Stack-ranking / forced distribution** | Collaboration destroyed; internal competition over shared goals | Evaluate against role expectations, not against peers |
| **Activity metrics as performance** | Lines of code, commit counts used for evaluations; gaming ensues | Use SPACE framework; never use single activity metrics |
| **Remote as afterthought** | Remote engineers excluded from decisions made in hallway chats | Async-first; document everything; include remote in all rituals |

---

## Enforcement Checklist

- [ ] Engineering values documented and referenced in hiring, reviews, promotions
- [ ] Developer satisfaction survey runs quarterly with results shared transparently
- [ ] Onboarding guide exists, validated by last 3 hires, with <4h environment setup
- [ ] Every new hire has an assigned buddy for 90 days
- [ ] Tech talks or knowledge sharing sessions happen at least bi-weekly
- [ ] RFCs used for significant technical decisions with async review period
- [ ] Blameless post-incident review process documented and followed
- [ ] Engineering ladder published with clear expectations per level
- [ ] Career conversations happen quarterly (separate from performance reviews)
- [ ] Meeting-free blocks (4+ hours) protected on team calendars
