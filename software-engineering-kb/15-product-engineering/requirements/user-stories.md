# User Stories & Epics

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Requirements |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Acceptance Criteria](acceptance-criteria.md), [Story Points](../estimation/story-points.md) |

---

## Core Concepts

### User Story Format

Write every user story using the canonical three-part template:

```
As a [role/persona],
I want [capability/action],
so that [benefit/value].
```

**Example:**
```
As a hiring manager,
I want to filter candidates by years of experience,
so that I can quickly shortlist qualified applicants.
```

The "so that" clause is mandatory -- it forces articulation of value and enables the team
to propose alternative solutions that achieve the same benefit.

### Story Hierarchy

Organize work in a four-level hierarchy from strategic to tactical.

```
Theme          (strategic initiative, quarter-level)
  └── Epic     (large body of work, weeks to months)
       └── Story   (single unit of user value, completable in one sprint)
            └── Task  (technical subtask, hours to days)
```

```typescript
// Model the hierarchy in a backlog tool
type StoryLevel = "theme" | "epic" | "story" | "task";

interface BacklogItem {
  id: string;
  level: StoryLevel;
  title: string;
  parentId: string | null;         // null for themes
  description: string;
  acceptanceCriteria: string[];    // only for stories
  storyPoints?: number;            // only for stories
  status: "backlog" | "ready" | "in_progress" | "done";
}

// Example hierarchy
const theme: BacklogItem = {
  id: "T-1",
  level: "theme",
  title: "Improve hiring pipeline efficiency",
  parentId: null,
  description: "Reduce time-to-hire by 30% through better tooling",
  acceptanceCriteria: [],
  status: "in_progress",
};

const epic: BacklogItem = {
  id: "E-10",
  level: "epic",
  title: "Candidate search and filtering",
  parentId: "T-1",
  description: "Enable recruiters to find candidates faster",
  acceptanceCriteria: [],
  status: "in_progress",
};

const story: BacklogItem = {
  id: "S-101",
  level: "story",
  title: "Filter candidates by experience level",
  parentId: "E-10",
  description: "As a hiring manager, I want to filter candidates by years of experience, so that I can quickly shortlist qualified applicants.",
  acceptanceCriteria: [
    "Given a list of candidates, when I set min experience to 3 years, then only candidates with >= 3 years appear",
    "Given a filter is active, when I clear it, then all candidates are shown again",
  ],
  storyPoints: 5,
  status: "ready",
};
```

### Epics

An epic is a story too large to complete in a single sprint. Decompose every epic into
3-8 stories before it enters sprint planning.

**Epic template:**
```markdown
## Epic: [Title]
**Objective:** [One sentence describing the goal]
**Success Metric:** [Measurable outcome]
**Target:** [Quarter or milestone]

### Stories
- [ ] Story 1: ...
- [ ] Story 2: ...
- [ ] Story 3: ...

### Dependencies
- Depends on: [other epics, services, teams]

### Out of Scope
- Explicitly excluded items
```

---

## INVEST Criteria

Evaluate every user story against all six INVEST criteria before marking it "ready."

| Criterion | Question | Red Flag |
|-----------|----------|----------|
| **Independent** | Can this story be developed and deployed without other stories? | "We need Story A done first" |
| **Negotiable** | Can the team discuss alternative implementations? | Prescriptive technical solution in the story |
| **Valuable** | Does it deliver value to the user or business? | Pure technical refactoring with no user impact |
| **Estimable** | Can the team estimate effort with reasonable confidence? | Too vague or too large to reason about |
| **Small** | Can it be completed within one sprint? | Estimated at more than half the sprint capacity |
| **Testable** | Can you write acceptance criteria that pass/fail? | "The system should be fast" (unmeasurable) |

```python
from dataclasses import dataclass

@dataclass
class InvestCheck:
    independent: bool
    negotiable: bool
    valuable: bool
    estimable: bool
    small: bool
    testable: bool

    @property
    def passed(self) -> bool:
        return all([self.independent, self.negotiable, self.valuable,
                    self.estimable, self.small, self.testable])

    @property
    def failures(self) -> list[str]:
        fields = ["independent", "negotiable", "valuable",
                  "estimable", "small", "testable"]
        return [f for f in fields if not getattr(self, f)]
```

---

## Story Splitting Patterns

When a story is too large, apply one of these splitting strategies.

### 1. Workflow Steps

Split along the steps of a user workflow.

**Before (too large):**
"As a user, I want to complete the checkout process."

**After (split by workflow step):**
- "As a user, I want to add items to my cart."
- "As a user, I want to enter shipping information."
- "As a user, I want to select a payment method."
- "As a user, I want to receive an order confirmation."

### 2. Business Rule Variations

Split when different business rules apply to the same feature.

**Before:** "As an admin, I want to apply discounts to orders."

**After:**
- "...apply a percentage discount to an order."
- "...apply a fixed-amount discount to an order."
- "...apply a buy-one-get-one-free discount."
- "...prevent stacking more than two discounts."

### 3. Data Variations

Split by data type, format, or source when each requires distinct handling.

**Before:** "As a user, I want to import contacts."

**After:**
- "...import contacts from a CSV file."
- "...import contacts from Google Contacts."
- "...import contacts from Outlook."

### 4. Interface Options

Split by platform, device, or interface channel.

### 5. Performance / Quality Tiers

First deliver a functional version, then optimize.

- Story 1: "Display search results (basic query, no ranking)."
- Story 2: "Rank search results by relevance score."
- Story 3: "Return search results within 200ms at p99."

### 6. CRUD Operations

Split a data management feature into Create, Read, Update, Delete stories.

### 7. Happy Path vs. Edge Cases

- Story 1: Happy path (valid input, expected flow)
- Story 2: Validation and error handling
- Story 3: Edge cases (empty states, boundary values, concurrent edits)

---

## Story Mapping

### Jeff Patton's User Story Mapping

Organize stories on a two-dimensional map:
- **Horizontal axis:** User activities in chronological order (the "backbone")
- **Vertical axis:** Story priority from top (essential) to bottom (nice-to-have)

```
Activities (left to right = user journey order):
──────────────────────────────────────────────────
  Sign Up    │  Browse   │  Purchase  │  Support
─────────────┼───────────┼────────────┼──────────
  Email      │ Search    │ Add to     │ View FAQ
  signup     │ products  │ cart       │
─────────────┼───────────┼────────────┼──────────  ← Release 1 line
  Social     │ Filter by │ Apply      │ Submit
  login      │ category  │ coupon     │ ticket
─────────────┼───────────┼────────────┼──────────  ← Release 2 line
  SSO        │ Save      │ Saved      │ Live
  integration│ favorites │ payment    │ chat
```

**Steps to build a story map:**
1. Identify user personas and pick the primary one
2. Walk through their journey from left to right (activities)
3. Break each activity into user tasks (stories)
4. Arrange tasks vertically by priority
5. Draw horizontal release lines to define MVPs and increments

### Walking Skeleton

The first release line on a story map defines the walking skeleton -- the thinnest
end-to-end slice that exercises all major components of the architecture.

```typescript
// Walking skeleton acceptance test
describe("Walking skeleton: user can browse and purchase", () => {
  it("allows signup, search, add to cart, and checkout", async () => {
    // This single test proves the architecture is wired together
    const user = await signUp({ email: "test@example.com", password: "Str0ng!" });
    const products = await searchProducts("laptop");
    expect(products.length).toBeGreaterThan(0);

    await addToCart(user.id, products[0].id);
    const order = await checkout(user.id, { method: "test_card" });
    expect(order.status).toBe("confirmed");
  });
});
```

---

## Special Story Types

### Technical Stories

Technical stories deliver no direct user value but are necessary for the product to
function. Frame them in terms of the user impact they enable.

**Poor:** "Migrate database from MySQL to PostgreSQL."
**Better:** "As a developer, I want the data layer on PostgreSQL, so that we can use JSONB
columns for the flexible search feature planned next sprint."

### Spike Stories

A spike is a time-boxed research story to reduce uncertainty. Always define:
- **Time box:** maximum hours/days (typically 1-2 days)
- **Output:** decision document, prototype, or proof of concept
- **Decision criteria:** what we will know at the end

```markdown
## Spike: Evaluate PDF generation libraries
**Time box:** 2 days
**Question:** Which library meets our requirements for PDF invoice generation?
**Criteria:** Supports tables, images, custom fonts, < 2s generation time for 10-page doc
**Output:** Comparison table + recommendation in ADR format
```

### Enabler Stories

Enabler stories build infrastructure, reduce technical debt, or create architectural
runway. Tie them to upcoming user-facing work:

"As the platform team, I want to set up the event bus, so that the notification epic
(E-25) can publish domain events instead of making synchronous calls."

---

## Writing Effective Stories

### The Three Cs

- **Card** -- the story written on a card (or ticket) as a placeholder for conversation
- **Conversation** -- the discussion between PM, designer, and developer that clarifies intent
- **Confirmation** -- the acceptance criteria that confirm the story is done

### Story Checklist

Before a story enters sprint planning, verify:

```markdown
- [ ] Follows "As a / I want / So that" format
- [ ] "So that" clause articulates clear value
- [ ] Passes all six INVEST criteria
- [ ] Has 2-5 acceptance criteria in Given/When/Then format
- [ ] Estimated in story points by the team
- [ ] Dependencies identified and resolved or scheduled
- [ ] UI mockup or wireframe attached (if UI change)
- [ ] Edge cases and error states documented
```

---

## 10 Best Practices

1. **Write the "so that" clause first.** Starting with the desired benefit forces you to
   validate that the story delivers real value before specifying the solution.

2. **Keep stories small enough for one sprint.** If a story cannot be completed within a
   single sprint, split it using one of the seven splitting patterns.

3. **Apply INVEST as a gate.** Reject stories from sprint planning if they fail any INVEST
   criterion. Send them back to refinement.

4. **Use story mapping for release planning.** Build a story map before writing individual
   tickets to ensure end-to-end coverage and a coherent user journey.

5. **Build the walking skeleton first.** Deliver the thinnest end-to-end slice before adding
   depth to any single area. This proves the architecture works early.

6. **Time-box spikes strictly.** Define exit criteria and a maximum duration. A spike that
   runs indefinitely is just unplanned work.

7. **Include acceptance criteria on every story.** Never mark a story "ready" without at
   least two acceptance criteria. See [acceptance-criteria.md](acceptance-criteria.md).

8. **Refine stories one sprint ahead.** The team should refine stories during the current
   sprint so they are ready for the next sprint planning session.

9. **Limit work in progress per epic.** Do not start a new epic until the current one is
   near completion. Finishing delivers value; starting does not.

10. **Review story quality metrics monthly.** Track cycle time, stories rejected in review,
    and stories split mid-sprint. These signal refinement process health.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Missing "so that" clause** | Team builds features without understanding value | Mandate the full three-part template |
| **Epic-sized stories in sprints** | Never completed, carry-over every sprint | Split until each story fits in one sprint |
| **Technical jargon in stories** | Stakeholders cannot validate requirements | Write in user-facing language; add tech notes separately |
| **One giant acceptance criterion** | Unclear when story is done | Break into 2-5 specific Given/When/Then clauses |
| **Copy-paste stories** | No conversation happens, context is lost | Treat card as conversation starter, not specification |
| **No spike before uncertain work** | Estimates are guesses, mid-sprint surprises | Time-box a spike story for any work with > 50% uncertainty |
| **Story = task** | Stories like "Create database table" deliver no user value | Reframe as user-facing outcome, use tasks for subtasks |
| **Orphan stories** | Stories not linked to any epic or theme | Require parent epic for every story in the backlog |

---

## Enforcement Checklist

- [ ] All stories follow "As a [role], I want [X], so that [Y]" format
- [ ] Every story passes INVEST criteria review before entering sprint
- [ ] Stories estimated by the team using planning poker or similar technique
- [ ] Each story has 2-5 acceptance criteria in Given/When/Then format
- [ ] Story map created for each epic before decomposition into stories
- [ ] Walking skeleton identified and prioritized for first delivery
- [ ] Spikes time-boxed with explicit output and decision criteria
- [ ] Technical stories framed in terms of user value they enable
- [ ] Backlog items linked in hierarchy: theme > epic > story > task
- [ ] Refinement session held weekly with PM, design, and engineering
