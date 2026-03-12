# Code Review Best Practices

| Attribute      | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Domain         | Code Quality > Code Review                                           |
| Importance     | Critical                                                             |
| Last Updated   | 2026-03-11                                                           |
| Cross-ref      | [Culture](culture.md), [PR Templates](pr-templates.md), [Review Checklist](review-checklist.md) |

---

## Core Concepts

### Review Scope and Goals

Every code review must evaluate six dimensions. Weight each dimension relative to the change type.

| Dimension          | What to Verify                                                       | Priority |
|--------------------|----------------------------------------------------------------------|----------|
| **Correctness**    | Logic matches requirements, edge cases handled, no regressions       | P0       |
| **Design**         | Fits existing architecture, respects layer boundaries, SOLID         | P0       |
| **Readability**    | Clear naming, small functions, self-documenting, minimal comments    | P1       |
| **Maintainability**| DRY without premature abstraction, testable, low coupling            | P1       |
| **Security**       | Input validation, auth checks, no secrets, OWASP compliance         | P0       |
| **Performance**    | No N+1 queries, appropriate caching, algorithmic complexity          | P2       |

### PR Size Guidelines

Google's internal research demonstrates a direct correlation between PR size and review quality.

| Lines Changed | Review Quality | Defect Detection Rate | Recommended Action          |
|---------------|----------------|-----------------------|-----------------------------|
| 1-100         | Excellent      | ~70%                  | Ideal. Merge fast.          |
| 100-400       | Good           | ~55%                  | Standard target range.      |
| 400-800       | Declining      | ~35%                  | Split if possible.          |
| 800+          | Poor           | ~15%                  | Must split. Require waiver. |

Set a hard CI gate at 400 lines (excluding generated code, lockfiles, snapshots):

```yaml
# .github/workflows/pr-size.yml
name: PR Size Check
on: [pull_request]
jobs:
  check-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Check PR size
        run: |
          CHANGES=$(git diff --stat origin/${{ github.base_ref }}...HEAD \
            -- . ':!package-lock.json' ':!*.snap' ':!*.generated.*' \
            | tail -1 | awk '{print $4}')
          if [ "$CHANGES" -gt 400 ]; then
            echo "::warning::PR exceeds 400 lines ($CHANGES). Consider splitting."
          fi
          if [ "$CHANGES" -gt 800 ]; then
            echo "::error::PR exceeds 800 lines ($CHANGES). Split required."
            exit 1
          fi
```

### Review Time Targets

| Metric                      | Target          | Rationale                                  |
|-----------------------------|-----------------|--------------------------------------------|
| First response              | < 4 hours       | Unblocks author; shows engagement          |
| Complete review             | < 24 hours      | Prevents context loss                      |
| Re-review after changes     | < 4 hours       | Author has fresh context                   |
| Emergency/hotfix            | < 1 hour        | Production incidents need speed            |
| Draft PR feedback           | < 48 hours      | Lower urgency, directional feedback only   |

Track median review turnaround. Alert when 7-day rolling median exceeds target by 50%.

### LGTM Criteria

Define explicit approval criteria to prevent rubber-stamping.

An LGTM means the reviewer asserts:
1. The code is correct and handles edge cases the reviewer can identify.
2. The design fits the existing architecture and does not introduce unnecessary coupling.
3. Tests adequately cover the changed behavior.
4. No security vulnerabilities are introduced.
5. The code is production-ready (logging, error handling, monitoring).

Require **2 approvals** for: changes to auth, payments, data models, public APIs, infrastructure.
Require **1 approval** for: all other changes.
Allow **0 approvals** (Ship model) for: typo fixes, dependency patches, generated code updates.

### Reviewer Selection

Use a layered selection strategy:

```text
CODEOWNERS (automatic)       -- Domain experts, mandatory reviewers
  + Round-robin (automatic)  -- Load balancing across team
  + Author-requested         -- Specific expertise needed
  + Bot-suggested            -- AI tools (CodeRabbit, GitHub Copilot) for first pass
```

CODEOWNERS example:

```text
# .github/CODEOWNERS
*.ts                    @frontend-team
/src/api/**             @backend-team @api-lead
/src/auth/**            @security-team
/infrastructure/**      @platform-team
*.sql                   @dba-team
/docs/**                @tech-writers
```

Rotate reviewers using GitHub's round-robin or tools like PullApprove, ReviewBot.
Avoid reviewer concentration -- no single person reviewing > 30% of team PRs.

### Review Depth Levels

Not every PR needs the same scrutiny. Match depth to risk.

| Level              | Time   | When to Apply                                   | What to Check                          |
|--------------------|--------|------------------------------------------------|----------------------------------------|
| **Quick scan**     | 5 min  | Config changes, docs, dependency patches        | Obvious errors, formatting             |
| **Standard**       | 15-30m | Feature code, bug fixes                         | All six dimensions                     |
| **Thorough**       | 30-60m | Auth, payments, data model changes              | Six dimensions + threat model          |
| **Architectural**  | 60m+   | New services, major refactors, API contracts    | Design doc review + code review        |

### Stacked PRs for Large Changes

When a change exceeds 400 lines, split into a stack of dependent PRs:

```text
main
  └── feat/user-auth-1-schema     (PR #101: migrations + models, 180 lines)
       └── feat/user-auth-2-api   (PR #102: API endpoints, 220 lines)
            └── feat/user-auth-3-ui (PR #103: frontend, 350 lines)
```

Tools: **git-branchless**, **Graphite**, **ghstack**, **spr**.

Rules for stacked PRs:
- Each PR in the stack must be independently correct and deployable.
- Review bottom-up. Merge bottom-up.
- Rebase the stack after each merge.
- Label with `stack: 1/3`, `stack: 2/3`, `stack: 3/3` for visibility.

### Review Comment Taxonomy

Use prefixes to classify every comment. This eliminates ambiguity about severity.

| Prefix         | Meaning                                | Action Required          |
|----------------|----------------------------------------|--------------------------|
| `blocker:`     | Must fix before merge. Correctness/security issue. | Author must address. |
| `suggestion:`  | Improvement worth considering.         | Author decides.          |
| `nitpick:`     | Style or preference. Non-blocking.     | Fix if convenient.       |
| `question:`    | Reviewer needs clarification.          | Author must respond.     |
| `praise:`      | Good pattern, clever solution.         | None. Positive signal.   |
| `thought:`     | Future consideration, not for this PR. | Track in backlog.        |
| `todo:`        | Acceptable to defer, must track.       | Create issue.            |

Example comment:

```text
suggestion: Consider extracting this validation into a shared utility.
The same pattern exists in `OrderService` and `PaymentService`.
Not blocking -- but it would reduce the duplication surface.
```

### Resolving Disagreements

Follow a deterministic escalation path:

1. **Discuss in PR** -- Author and reviewer exchange reasoning (max 3 rounds).
2. **Sync meeting** -- If unresolved after 3 comment rounds, hold a 15-minute call.
3. **Tech lead tiebreak** -- Tech lead makes the final call within 24 hours.
4. **RFC** -- For systemic disagreements (coding standards, architectural patterns), open a formal RFC. The team votes, and the decision is documented in an ADR.

Never merge while a `blocker:` comment is unresolved.
Never let a review block for more than 48 hours -- escalate.

### Measuring Review Quality

Track these metrics monthly. Present trends, not snapshots.

| Metric                       | Target         | How to Measure                                |
|------------------------------|----------------|-----------------------------------------------|
| Defect detection rate        | > 50%          | Pre-merge defects found / total defects       |
| Post-merge defect rate       | < 5%           | Bugs found within 7 days of merge             |
| Review turnaround (median)   | < 8 hours      | Time from PR open to first review             |
| Review thoroughness          | > 80%          | PRs with substantive comments / total PRs     |
| Review coverage              | 100%           | PRs reviewed before merge / total PRs merged  |
| Reviewer load balance        | < 2x std dev   | Reviews per person, Gini coefficient          |

### Review Automation

Automate everything that does not require human judgment.

```yaml
# Danger.js example (dangerfile.ts)
import { danger, warn, fail, message } from "danger";

// Warn on large PRs
const linesChanged = danger.github.pr.additions + danger.github.pr.deletions;
if (linesChanged > 400) {
  warn(`PR has ${linesChanged} lines changed. Consider splitting.`);
}
if (linesChanged > 800) {
  fail(`PR exceeds 800 lines. Split required.`);
}

// Require description
if (!danger.github.pr.body || danger.github.pr.body.length < 50) {
  fail("PR description is missing or too short. Use the template.");
}

// Check for console.log
const hasConsoleLogs = danger.git.created_files
  .concat(danger.git.modified_files)
  .filter(f => f.endsWith(".ts") || f.endsWith(".tsx"));
// (run eslint no-console instead for actual enforcement)

// Celebrate small PRs
if (linesChanged < 100) {
  message("Small PR. Fast review expected.");
}

// Auto-label by path
const touchesAPI = danger.git.modified_files.some(f => f.includes("/api/"));
if (touchesAPI) {
  // Use GitHub API to add label
}
```

Additional automation targets:

| Automation                   | Tool                              | Purpose                           |
|------------------------------|-----------------------------------|-----------------------------------|
| Auto-assign reviewers        | CODEOWNERS + PullApprove          | Correct expertise, load balance   |
| Auto-label by path/size      | GitHub Actions, Labeler           | Triage and filtering              |
| PR description lint          | Danger.js                         | Enforce template usage            |
| Stale PR reminder            | actions/stale                     | Prevent abandoned PRs             |
| Merge conflict detection     | GitHub built-in + Mergify         | Early notification                |
| AI first-pass review         | CodeRabbit, GitHub Copilot Review | Catch obvious issues before human |
| Required status checks       | Branch protection rules           | CI must pass before review        |

---

## Best Practices

1. **Keep PRs under 400 lines.** Set CI gates. Reject PRs over 800 lines without an explicit waiver. Smaller PRs get reviewed faster and with higher defect detection.
2. **Respond to every PR within 4 hours.** Even if the full review takes longer, acknowledge and provide an ETA. Unresponsive reviews destroy author velocity.
3. **Use comment prefixes consistently.** Every comment must start with `blocker:`, `suggestion:`, `nitpick:`, `question:`, `praise:`, `thought:`, or `todo:`. Eliminate ambiguity.
4. **Require CODEOWNERS for critical paths.** Auth, payments, data models, and infrastructure changes must have domain expert approval. Configure branch protection rules.
5. **Automate what machines do better.** Linting, formatting, type checking, test coverage, PR size checks, and label assignment belong in CI, not in review comments.
6. **Review the design before the code.** For changes over 400 lines or new services, require a design document or RFC review before code review begins.
7. **Measure and act on review metrics.** Track turnaround time, defect detection rate, and reviewer load balance monthly. Share dashboards with the team.
8. **Use stacked PRs for large features.** Break large changes into a chain of small, independently reviewable and mergeable PRs. Use tooling (Graphite, ghstack) to manage the stack.
9. **Resolve disagreements within 48 hours.** Follow the escalation path: PR discussion, sync call, tech lead tiebreak. Never let a review stall.
10. **Pair AI review with human review.** Use CodeRabbit or Copilot for the first pass on correctness and style. Humans focus on design, architecture, and business logic.

---

## Anti-Patterns

| Anti-Pattern                       | Problem                                                    | Fix                                                   |
|------------------------------------|------------------------------------------------------------|-------------------------------------------------------|
| **Rubber-stamp reviews**           | LGTM without reading the code. Defects escape to prod.     | Define LGTM criteria. Track review thoroughness.      |
| **Mega-PRs (1000+ lines)**         | Reviewers skim. Defect detection drops to ~15%.            | Enforce 400-line limit. Use stacked PRs.              |
| **Review gatekeeping**             | One person blocks all merges. Creates bottleneck.          | Round-robin assignment. Max 30% load per reviewer.    |
| **Nitpick wars**                   | 50 comments on formatting. Zero on logic.                  | Automate style checks. Use `nitpick:` prefix.         |
| **Drive-by reviews**               | Reviewer leaves comments but never re-reviews.             | Track re-review turnaround. Require resolution.       |
| **Review as approval theater**     | Review exists only for compliance, not quality.            | Measure defect detection rate. Reward thoroughness.   |
| **Ignoring test coverage**         | Code reviewed but tests not checked.                       | Add coverage diff to PR checks. Review tests first.   |
| **Context-free comments**          | "This is wrong" without explaining why or suggesting fix.  | Require `because...` in blocker comments.             |

---

## Enforcement Checklist

- [ ] Branch protection requires at least 1 approval before merge
- [ ] CODEOWNERS file covers all critical paths (auth, payments, infra)
- [ ] CI gate rejects PRs over 800 lines (excluding generated code)
- [ ] PR template is enforced (Danger.js or required fields)
- [ ] Auto-assign reviewers configured (CODEOWNERS + round-robin)
- [ ] Review turnaround dashboard visible to the team
- [ ] Comment prefix convention documented in CONTRIBUTING.md
- [ ] Stale PR bot configured (close after 14 days of inactivity)
- [ ] AI review tool (CodeRabbit/Copilot) enabled for first-pass feedback
- [ ] Monthly review metrics retrospective scheduled
- [ ] Escalation path documented: PR > sync call > tech lead > RFC
- [ ] Required status checks include: CI pass, coverage threshold, lint
