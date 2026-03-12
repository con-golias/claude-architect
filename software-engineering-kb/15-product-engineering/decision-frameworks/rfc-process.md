# RFC Process & Technical Decision Making

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Decision Frameworks |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Architecture Decision Records](../../03-architecture/decision-records/), [Technology Radar](technology-radar.md) |

---

## Core Concepts

### What Is an RFC?

An RFC (Request for Comments) is a written proposal for a significant technical or product change, shared with stakeholders for structured review before implementation begins. RFCs create alignment, surface risks early, and build institutional knowledge.

**When to Write an RFC:**
- Cross-team changes that affect multiple services or teams
- New technology adoption (language, framework, database)
- Architectural changes (new service, data model migration, API redesign)
- Process changes that affect engineering workflows
- Any decision with high reversibility cost

**When NOT to Write an RFC:**
- Bug fixes or minor refactors
- Changes fully within one team's ownership and scope
- Decisions already covered by existing standards
- Emergency patches (write a post-mortem instead)

### RFC vs ADR

| Aspect | RFC | ADR (Architecture Decision Record) |
|--------|-----|----|
| **Purpose** | Propose and discuss a change | Record a decision already made |
| **Timing** | Before the decision | After the decision |
| **Format** | Detailed proposal with alternatives | Concise record with context and rationale |
| **Audience** | Reviewers who influence the decision | Future engineers who need to understand why |
| **Lifecycle** | Draft -> Review -> Decided | Proposed -> Accepted/Superseded/Deprecated |

Use RFCs for the process of making decisions. Use ADRs to record the outcome. An RFC often results in an ADR.

### RFC Template

```markdown
# RFC-XXXX: [Title]

| Field          | Value                                |
|----------------|--------------------------------------|
| Author(s)      | @author                              |
| Status         | Draft | In Review | Approved | Rejected | Superseded |
| Created        | YYYY-MM-DD                           |
| Decision Date  | YYYY-MM-DD                           |
| Decider        | @decision-maker (DACI Approver)      |

## Context

Describe the current situation. What exists today? What problem or
opportunity does this RFC address? Include relevant metrics, user
feedback, or technical constraints.

## Problem Statement

State the specific problem in 1-3 sentences. Be precise about who
is affected and what the impact is.

## Proposed Solution

Describe the recommended approach in detail:
- Architecture diagrams (if applicable)
- API contracts or data models
- Migration plan
- Code examples for key interfaces

### Key Design Decisions
1. Decision 1: Rationale...
2. Decision 2: Rationale...

## Alternatives Considered

### Alternative A: [Name]
- **Description:** ...
- **Pros:** ...
- **Cons:** ...
- **Why not chosen:** ...

### Alternative B: [Name]
- **Description:** ...
- **Pros:** ...
- **Cons:** ...
- **Why not chosen:** ...

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ...  | Low/Med/High | Low/Med/High | ... |

## Rollout Plan

1. Phase 1: ...
2. Phase 2: ...
3. Rollback plan: ...

## Success Metrics

How will we know this was the right decision?
- Metric 1: ...
- Metric 2: ...

## Open Questions

- [ ] Question 1
- [ ] Question 2

## References

- Link to related RFCs, ADRs, or external resources
```

### RFC Lifecycle

```
1. DRAFT
   Author writes the RFC and circulates informally for early feedback.
   Status: Draft

2. IN REVIEW
   RFC is formally shared with stakeholders. Review period is timeboxed
   (typically 5-10 business days).
   Status: In Review

3. REVIEW MEETING (optional)
   For contentious or high-impact RFCs, hold a synchronous review meeting.
   Author presents; reviewers ask questions; concerns are documented.

4. DECISION
   The designated Decider (see DACI) makes the final call:
   - Approved: Proceed with implementation
   - Approved with modifications: Proceed with specified changes
   - Rejected: Document why; archive for future reference
   - Needs revision: Author revises and re-enters review
   Status: Approved | Rejected

5. IMPLEMENTATION
   Work begins. RFC serves as the specification.
   Status: Implemented

6. SUPERSEDED
   If a future RFC replaces this decision, link the new RFC.
   Status: Superseded by RFC-YYYY
```

### DACI Decision Framework

Assign clear roles for every RFC to avoid decision paralysis.

| Role | Description | Count |
|------|-------------|-------|
| **Driver** | Writes the RFC, coordinates review, drives to resolution | 1 |
| **Approver** | Makes the final decision; accountable for the outcome | 1 |
| **Contributors** | Provide input, expertise, and review feedback | Many |
| **Informed** | Notified of the decision; do not provide input | Many |

### Lightweight vs Heavyweight

Not every decision warrants a full RFC. Define thresholds.

| Decision Type | Format | Review Period | Example |
|--------------|--------|--------------|---------|
| **Trivial** | Slack thread or PR description | Same day | Library version bump |
| **Small** | One-pager in PR or Notion | 2-3 days | New API endpoint design |
| **Medium (RFC)** | Full RFC template | 5-10 days | New service, tech migration |
| **Large (RFC+)** | RFC + architecture review board | 10-15 days | Platform rewrite, new database |

### Timeboxed Reviews

Set clear deadlines to prevent RFC limbo.

```typescript
// tools/rfc-bot.ts - Slack bot for RFC reminders
interface RFCMetadata {
  id: string;
  title: string;
  author: string;
  reviewDeadline: Date;
  reviewers: string[];
  status: "draft" | "in_review" | "approved" | "rejected";
}

function scheduleReminders(rfc: RFCMetadata): void {
  const deadlineMs = rfc.reviewDeadline.getTime();
  const now = Date.now();
  const daysLeft = (deadlineMs - now) / (1000 * 60 * 60 * 24);

  // Reminder at halfway point
  if (daysLeft > 2) {
    scheduleSlackMessage(
      rfc.reviewers,
      `Reminder: RFC "${rfc.title}" review due in ${Math.ceil(daysLeft / 2)} days.`,
      new Date(now + (deadlineMs - now) / 2)
    );
  }

  // Final reminder 1 day before
  scheduleSlackMessage(
    rfc.reviewers,
    `Final reminder: RFC "${rfc.title}" review due tomorrow. ` +
    `Silence is consent -- speak up or it ships.`,
    new Date(deadlineMs - 86400000)
  );
}
```

### RFC Tooling Options

| Tool | Approach | Pros | Cons |
|------|----------|------|------|
| **GitHub/GitLab PRs** | RFC as markdown file in repo, reviews via PR comments | Version-controlled, familiar workflow, linked to code | Hard to discover for non-engineers |
| **Notion/Confluence** | RFC as wiki page with comments | Rich formatting, accessible to all roles | No version control, comments scattered |
| **Google Docs** | RFC as shared doc with suggestion mode | Easy collaboration, real-time editing | No structure enforcement, hard to search |
| **Custom RFC tool** | Purpose-built (e.g., rfcs.io, internal tool) | Structured workflow, metadata, search | Build/maintenance cost |

**Recommended approach:** Store RFCs as markdown in a dedicated git repository (e.g., `company/rfcs`). Use pull requests for review. This provides version history, code review workflow, and discoverability.

### Example: RFC as Pull Request Workflow (Go-style project)

```
rfcs/
  0001-adopt-grpc-for-internal-services.md
  0002-migrate-to-postgresql.md
  0003-implement-event-sourcing.md
  TEMPLATE.md
```

```go
// This is a conceptual model, not a Go service.
// RFC numbering and status tracked via git metadata.

// Directory structure enforces process:
// 1. Copy TEMPLATE.md -> NNNN-title.md
// 2. Open PR with "RFC" label
// 3. Assign reviewers per DACI
// 4. Merge = Approved; Close = Rejected
// 5. After implementation, update status in the RFC file
```

### Measuring RFC Process Health

Track metrics to ensure the RFC process adds value without becoming a bottleneck.

| Metric | Target | Red Flag |
|--------|--------|----------|
| Time from Draft to Decision | < 2 weeks | > 4 weeks (decision paralysis) |
| Reviewer participation rate | > 80% of assigned reviewers comment | < 50% (disengaged reviewers) |
| RFCs per quarter | 3-8 per team (varies) | 0 (no process) or 20+ (over-process) |
| Decision reversal rate | < 10% within 6 months | > 25% (poor analysis) |
| Post-implementation regret | Low | Multiple "we should have considered X" |

---

## Best Practices

1. **Write the RFC before writing the code.** The purpose of an RFC is to get feedback before investing implementation effort. A draft PR with code is not an RFC.
2. **Timebox every review period.** Set a clear deadline (5-10 business days). Silence after the deadline is consent. This prevents decision paralysis.
3. **Assign a single Approver (DACI).** Consensus is valuable but not required. One person must be accountable for making the final decision.
4. **Include alternatives you rejected and explain why.** This builds trust, prevents rehashing, and helps future readers understand the reasoning.
5. **Keep RFCs searchable and discoverable.** Store them in a central location (git repo, wiki) with consistent naming and metadata. Index by date, status, and domain.
6. **Require a rollout and rollback plan.** Every approved RFC must describe how the change will be deployed incrementally and how it can be reversed if problems arise.
7. **Treat rejected RFCs as valuable.** They document what was considered and why it was not pursued. Never delete rejected RFCs.
8. **Scale the process to the decision size.** A library bump needs a PR description, not a 10-page RFC. Define clear thresholds for when a full RFC is required.
9. **Close the loop with an ADR.** After an RFC is decided, create a concise ADR that captures the decision, context, and rationale for long-term reference.
10. **Review the RFC process itself quarterly.** Measure cycle time, participation, and team satisfaction. Adjust the process if it becomes a bottleneck.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| RFC written after code is built | Review becomes rubber-stamping; no real input | Enforce "RFC before PR" policy for qualifying changes |
| No deadline on review period | RFCs sit in limbo for months | Set mandatory review deadline; silence = consent |
| Decision by committee (no clear Approver) | Endless debate; no resolution | Use DACI; one person decides |
| RFC as bureaucracy gate | Slows down trivial changes; team resentment | Define clear thresholds; most changes should NOT need an RFC |
| No follow-through after approval | RFC approved but implementation diverges | Require implementation review against RFC at launch |
| RFCs not discoverable | Teams re-debate past decisions | Central searchable RFC repository with metadata |
| Skipping alternatives section | Poor decisions due to narrow framing | Template enforces alternatives with "why not chosen" |
| RFCs never superseded or retired | Stale decisions mislead future engineers | Review RFC relevance annually; mark superseded with link |

---

## Enforcement Checklist

- [ ] RFC template adopted and available in central repository
- [ ] Thresholds defined for when an RFC is required vs optional
- [ ] DACI roles assigned for every RFC (Driver, Approver, Contributors, Informed)
- [ ] Review period timeboxed with automated reminders
- [ ] RFC repository searchable by status, date, domain, and author
- [ ] Rejected RFCs archived with rationale (never deleted)
- [ ] Approved RFCs result in corresponding ADRs
- [ ] Rollout and rollback plan required for every approved RFC
- [ ] RFC process health metrics tracked quarterly
- [ ] Process review conducted at least twice per year
