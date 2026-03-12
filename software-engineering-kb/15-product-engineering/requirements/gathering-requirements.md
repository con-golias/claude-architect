# Requirements Gathering & Discovery

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Requirements |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [User Stories](user-stories.md), [Acceptance Criteria](acceptance-criteria.md) |

---

## Core Concepts

### Requirements Types

Classify every requirement into one of four categories before documenting it.

**Functional Requirements** describe what the system must do -- behaviors, features, and
business rules. Example: "The system shall allow users to reset their password via email."

**Non-Functional Requirements (NFRs)** describe quality attributes -- performance, security,
availability, usability. Example: "Login API responds within 200ms at p99."
See [non-functional-requirements.md](non-functional-requirements.md) for full coverage.

**Constraints** are imposed boundaries that limit design choices -- regulatory, technical,
budgetary, or organizational. Example: "Must deploy on AWS eu-west-1 for GDPR compliance."

**Assumptions** are conditions believed to be true without current proof. Track and validate
them early. Example: "Users have stable internet connections above 5 Mbps."

```typescript
// Model requirements with explicit typing
interface Requirement {
  id: string;                              // REQ-AUTH-001
  type: "functional" | "non-functional" | "constraint" | "assumption";
  title: string;
  description: string;
  priority: "must" | "should" | "could" | "wont"; // MoSCoW
  source: string;                          // stakeholder or discovery session
  acceptanceCriteria: string[];
  status: "draft" | "reviewed" | "approved" | "implemented";
  traceability: {
    stories: string[];                     // linked user story IDs
    tests: string[];                       // linked test case IDs
  };
}
```

### MoSCoW Prioritization

Assign every requirement a MoSCoW priority during discovery:

| Priority | Meaning | Guidance |
|----------|---------|----------|
| **Must** | Non-negotiable for release | Without it, the release has no value |
| **Should** | Important but not critical | Painful to leave out, workaround exists |
| **Could** | Desirable, low impact if omitted | Include if time and budget allow |
| **Won't** | Explicitly excluded this time | Agreed out of scope, may return later |

---

## Discovery Techniques

### User Interviews

Conduct one-on-one interviews with real users to uncover latent needs.

**Preparation checklist:**
- Define interview goals (what decisions will this inform?)
- Recruit 5-8 participants representing distinct user segments
- Prepare a semi-structured script with open-ended questions
- Assign a note-taker separate from the interviewer

**Question patterns to use:**
- "Walk me through the last time you..." (behavioral, past-focused)
- "What is the hardest part about..." (pain discovery)
- "If you had a magic wand, what would change?" (aspirational)
- "Tell me about a time when this went wrong" (failure analysis)

**Avoid leading questions:** Never ask "Would you use feature X?" -- instead ask about the
problem X is meant to solve.

### Surveys and Quantitative Discovery

Use surveys to validate hypotheses formed during qualitative research.

- Deploy after interviews to quantify pain points across larger populations
- Use Likert scales (1-5) for satisfaction, frequency, and importance
- Keep surveys under 15 questions; aim for 2-3 minute completion time
- Include one open-ended question for unexpected insights

### Contextual Inquiry

Observe users in their natural environment. Watch how they actually work, not how they say
they work. This surfaces workarounds, shadow IT, and implicit requirements no interview
reveals.

### Competitive Analysis

Analyze 3-5 direct competitors and 2-3 adjacent products:

| Dimension | What to Capture |
|-----------|----------------|
| Feature parity | Table of features present/absent |
| UX patterns | Interaction models users already know |
| Pricing models | How features map to tiers |
| User reviews | Pain points competitors fail to address |
| API surface | Integration expectations |

---

## Stakeholder Analysis

### Stakeholder Mapping

Map stakeholders on a power/interest grid to determine engagement strategy.

```
        High Power
            │
  Manage    │   Collaborate
  Closely   │   Closely
            │
 ───────────┼──────────── Interest
            │
  Monitor   │   Keep
  (minimal) │   Informed
            │
        Low Power
```

### RACI Matrix

Assign exactly one role per stakeholder per deliverable.

| Deliverable | Product Owner | Tech Lead | Designer | Engineering |
|-------------|:---:|:---:|:---:|:---:|
| PRD | R/A | C | C | I |
| Technical Design | C | R/A | I | C |
| UI Mockups | C | I | R/A | C |
| Sprint Backlog | A | R | I | R |

**R** = Responsible (does the work), **A** = Accountable (final decision),
**C** = Consulted (input required), **I** = Informed (kept up to date).

### Communication Plan

Define cadence and channel per stakeholder group:

- **Executives:** Monthly summary, async status report, escalation on blockers
- **Product team:** Weekly sync, shared backlog, real-time Slack channel
- **Engineering:** Daily standups, sprint planning, refinement sessions
- **Users/Customers:** Bi-weekly discovery calls, quarterly surveys

---

## Product Discovery Frameworks

### Opportunity Solution Trees (Teresa Torres)

Structure discovery as a tree from desired outcome to testable experiments.

```
Desired Outcome (metric to move)
├── Opportunity 1 (user pain/need)
│   ├── Solution A
│   │   ├── Experiment: Prototype test
│   │   └── Experiment: Fake door test
│   └── Solution B
│       └── Experiment: Concierge MVP
├── Opportunity 2
│   └── Solution C
│       └── Experiment: A/B test
└── Opportunity 3
```

**Rules:**
- Start from a single measurable outcome (e.g., "Increase activation rate from 40% to 60%")
- Opportunities come from user research, not brainstorming
- Generate at least 3 solutions per opportunity before selecting
- Design the smallest experiment to test the riskiest assumption

### Jobs to Be Done (JTBD)

Frame requirements around the job the user is hiring the product to do.

**Job statement format:**
"When [situation], I want to [motivation], so I can [expected outcome]."

Example: "When I receive a customer complaint, I want to see the customer's full history,
so I can resolve their issue without asking them to repeat information."

```python
# Structure JTBD for systematic capture
from dataclasses import dataclass, field

@dataclass
class JobToBeDone:
    situation: str          # trigger / context
    motivation: str         # what the user wants to accomplish
    expected_outcome: str   # desired end state
    functional_aspects: list[str] = field(default_factory=list)
    emotional_aspects: list[str] = field(default_factory=list)  # how they want to feel
    social_aspects: list[str] = field(default_factory=list)     # how they want to appear

    def to_statement(self) -> str:
        return (
            f"When {self.situation}, "
            f"I want to {self.motivation}, "
            f"so I can {self.expected_outcome}."
        )
```

### Design Thinking

Apply the five-phase model to complex problem spaces:

1. **Empathize** -- interviews, observation, journey mapping
2. **Define** -- synthesize findings into problem statements (Point of View)
3. **Ideate** -- divergent brainstorming, "How Might We" questions
4. **Prototype** -- low-fidelity mockups, clickable prototypes, wizard-of-oz
5. **Test** -- usability testing, concept validation, measure against success criteria

---

## Documenting Requirements

### Product Requirements Document (PRD)

A PRD captures the "what" and "why," not the "how." Keep it to 2-5 pages.

**PRD template outline:**
1. Problem statement (1-2 paragraphs)
2. Goals and success metrics (2-3 measurable KPIs)
3. User personas and segments affected
4. User stories and acceptance criteria (link to backlog)
5. Scope: in-scope, out-of-scope, future considerations
6. Dependencies and constraints
7. Open questions and risks
8. Timeline and milestones

### One-Pagers

Use one-pagers for smaller features or proposals that need quick alignment.

**Structure:** Problem (2-3 sentences) -> Proposed solution (2-3 sentences) -> Success
metric (1 sentence) -> Effort estimate (T-shirt size) -> Risks (bullet list).

### Specification Documents

For complex systems, write detailed specs that engineering can implement from. Include data
models, API contracts, state diagrams, and error handling expectations.

---

## Continuous Discovery

### Teresa Torres' Continuous Discovery Model

Replace big-bang requirements phases with ongoing customer contact.

**Core habits:**
- **Weekly customer touchpoints** -- talk to at least one customer every week
- **Assumption mapping** -- identify and rank assumptions by risk
- **Small experiments** -- test assumptions before building features
- **Cross-functional collaboration** -- PM, design, and engineering in every interview

### Discovery Cadence

| Activity | Frequency | Participants | Output |
|----------|-----------|-------------|--------|
| Customer interview | Weekly | PM + Designer + 1 Engineer | Interview notes, updated opportunity tree |
| Assumption testing | Bi-weekly | PM + Designer | Experiment results |
| Discovery sync | Weekly | Full product trio | Prioritized opportunities |
| Stakeholder update | Bi-weekly | PM + stakeholders | Decisions log |
| Backlog refinement | Weekly | PM + Engineering | Ready stories |

---

## 10 Best Practices

1. **Start with problems, not solutions.** Frame discovery around user pain points and
   desired outcomes rather than feature requests. Feature requests are solutions in disguise.

2. **Talk to real users weekly.** Maintain a continuous cadence of at least one customer
   touchpoint per week. Schedule recurring slots to prevent discovery from being crowded out.

3. **Separate discovery from delivery.** Run discovery on items 2-3 sprints ahead of
   delivery. Never let the delivery backlog dictate what you research.

4. **Triangulate with multiple methods.** Combine qualitative interviews (why), quantitative
   surveys (how many), and behavioral analytics (what actually happens) for each requirement.

5. **Make requirements testable.** Every requirement must have at least one acceptance
   criterion that can be verified. If you cannot test it, rewrite it until you can.

6. **Use MoSCoW ruthlessly.** Assign priority to every requirement and revisit priorities
   each sprint. Protect Must-haves; negotiate everything else.

7. **Document assumptions explicitly.** Track assumptions alongside requirements. Validate
   the riskiest assumptions before committing engineering effort.

8. **Keep PRDs living documents.** Version-control PRDs alongside code. Update them as
   discovery reveals new information. Stale PRDs are worse than no PRDs.

9. **Include engineering in discovery.** Engineers spot technical constraints, suggest simpler
   alternatives, and build empathy for users when they participate in interviews.

10. **Close the feedback loop.** After shipping, measure whether the requirement delivered the
    expected outcome. Feed results back into the next discovery cycle.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Requirements by committee** | Bloated scope, conflicting priorities | Single accountable product owner decides |
| **Solution masquerading as requirement** | Constrains design space prematurely | Rewrite as problem statement with desired outcome |
| **Big bang requirements phase** | Stale by delivery time, no learning | Switch to continuous discovery with weekly cadence |
| **Ignoring non-functional requirements** | Architecture cannot support quality needs | Capture NFRs from day one alongside functional needs |
| **Gold-plating interviews** | Analysis paralysis, never shipping | Time-box discovery; 5-8 interviews per question |
| **Copy-competitor features** | Building for someone else's users | Validate with your users before adding to roadmap |
| **Telephone game requirements** | Lost context, misinterpretation | PM, designer, and engineer all attend interviews |
| **No traceability** | Cannot verify coverage or justify decisions | Link requirements to stories, stories to tests |

---

## Enforcement Checklist

- [ ] Every requirement has a unique ID, type, and MoSCoW priority
- [ ] Stakeholder map and RACI matrix created before discovery starts
- [ ] At least 5 user interviews conducted per major feature area
- [ ] Assumptions documented and ranked by risk level
- [ ] PRD reviewed by engineering lead and design lead before sprint planning
- [ ] Acceptance criteria written for every functional requirement
- [ ] NFRs captured with measurable targets for every quality attribute
- [ ] Discovery cadence established with weekly customer touchpoints
- [ ] Requirements linked to user stories in the backlog tool
- [ ] Post-launch measurement plan defined for each key requirement
