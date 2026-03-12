# Code Review Culture

| Attribute      | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Domain         | Code Quality > Code Review                                           |
| Importance     | High                                                                 |
| Last Updated   | 2026-03-11                                                           |
| Cross-ref      | [Best Practices](best-practices.md), [AI-Assisted Review](../ai-code-quality/ai-assisted-review.md) |

---

## Core Concepts

### Psychological Safety in Code Review

Code review is the most frequent interpersonal feedback loop in software engineering.
A single hostile review can suppress contributions for months. Establish these ground rules:

1. **Critique code, never the person.** Write "this function has a potential null dereference" -- not "you forgot to handle null."
2. **Assume positive intent.** The author made the best decision they could with the information they had.
3. **Ask before asserting.** "What was the reasoning behind this approach?" opens dialogue. "This is wrong" shuts it down.
4. **Separate preferences from requirements.** Use `nitpick:` for style preferences. Reserve `blocker:` for genuine defects.
5. **Acknowledge effort.** Even when requesting significant changes, recognize the work already done.

### Feedback Language Patterns

Replace directive language with collaborative language. The goal is shared ownership of the code.

| Instead Of                           | Use                                                    |
|--------------------------------------|--------------------------------------------------------|
| "You should use X here"             | "What if we used X here? It would give us..."         |
| "This is wrong"                      | "I think this might cause Y because Z. What do you think?" |
| "Why didn't you..."                  | "Have you considered... ?"                             |
| "This code is confusing"             | "I had trouble following the flow here. Could we..."  |
| "You always do this"                 | "I've noticed this pattern. Let's discuss..."         |
| "Just do it this way"               | "One approach that's worked for us: ..."              |
| "This needs to be rewritten"         | "Consider extracting this into... because..."         |
| "Obviously you should..."            | "It might help to..."                                 |

Frame feedback as questions when possible. Questions invite collaboration; directives invite defensiveness.

### Praise and Positive Feedback

Positive feedback is not optional -- it is a review skill. Include at least one `praise:` comment per review when warranted.

Effective praise is **specific and behavioral**:

```text
praise: This error handling pattern with the Result type is clean.
It makes the happy path and error path equally explicit. I'm going to
adopt this in the OrderService refactor.
```

Ineffective praise is vague: "Looks good!" or "Nice work!" -- these add noise without signal.

Use praise strategically:
- Celebrate adoption of team conventions.
- Highlight when someone handles a tricky edge case well.
- Recognize improved patterns from a developer who is growing.
- Share exemplary code in team channels (with author permission).

### Mentorship Through Review

Code review is the highest-bandwidth mentorship channel available. Every review is a teaching opportunity.

**For junior developers (reviewees):**
- Provide context with comments: explain *why*, not just *what*. Link to documentation or ADRs.
- Offer two alternatives when suggesting a change -- show tradeoffs.
- Avoid overwhelming: limit to 3-5 substantive comments per review. Address the most impactful issues first.
- Use `thought:` prefix for educational comments that are not actionable in this PR.

**Pair review for onboarding:**
- First 2 weeks: review together synchronously (screen share or in-person).
- Weeks 3-4: junior reviews senior's code (builds pattern recognition).
- Month 2+: independent reviews with async mentorship.

**Review as a learning artifact:**
- Tag exemplary reviews with `#learning` in your team's Slack/Teams channel.
- Maintain a "review patterns" wiki with before/after examples.
- Reference past reviews in new ones: "Similar to how we solved this in PR #456."

### Review as Collaboration, Not Gatekeeping

The reviewer's job is to **make the code better together**, not to block the author.

Signs of healthy review culture:
- Authors thank reviewers for catching issues.
- Reviewers ask questions instead of only giving directives.
- PRs have comments from multiple people, not just one gatekeeper.
- The team celebrates when reviews catch production-impacting bugs.
- Disagreements are resolved with data, not authority.

Signs of gatekeeping culture:
- One person reviews and blocks most PRs.
- Authors dread opening PRs.
- Review comments are predominantly negative.
- Merge times are measured in days.
- Developers avoid making changes to avoid review friction.

### Ship/Show/Ask Model

Not every change needs the same review rigor. Classify changes into three tiers:

| Tier     | Description                              | Review Required? | Examples                                      |
|----------|------------------------------------------|------------------|-----------------------------------------------|
| **Ship** | Trivial, low-risk, reversible            | No review        | Typo fixes, copy changes, config tweaks       |
| **Show** | Straightforward, follows existing patterns | Async FYI       | Small refactors, test additions, doc updates  |
| **Ask**  | Complex, risky, or novel                 | Full review      | New features, auth changes, data migrations   |

Implementation:
- **Ship**: Merge directly to main. CI must pass. Notify team in channel.
- **Show**: Open PR, merge immediately, tag reviewers for post-merge feedback.
- **Ask**: Open PR, require approval before merge. Standard review process.

Document the tier classification in CONTRIBUTING.md. Let the author self-classify, but reviewers can escalate (Show -> Ask) if they disagree.

### Review SLAs by Team Size

| Team Size  | First Response | Complete Review | Rationale                                   |
|------------|----------------|-----------------|---------------------------------------------|
| 2-4        | < 2 hours      | < 8 hours       | Small team, tight feedback loop              |
| 5-10       | < 4 hours      | < 24 hours      | Standard. Balance reviewer load.             |
| 11-20      | < 8 hours      | < 24 hours      | Larger pool allows rotation.                 |
| 20+        | < 8 hours      | < 48 hours      | Cross-team reviews take longer.              |
| Open source| < 48 hours     | < 1 week        | Volunteer reviewers. Set expectations.       |

### Handling Review Bottlenecks

**Bus factor problem:** If one person reviews all PRs, they become a bottleneck and single point of failure.

Mitigations:
1. **Enforce reviewer rotation.** Use round-robin assignment. No single reviewer handles > 30% of team PRs.
2. **Review load cap.** Limit active review assignments to 3-5 per person per day.
3. **Review-free focus time.** Block 2-hour deep work windows. Reviews queue, not interrupt.
4. **Reviewer pairing.** Pair a domain expert with a generalist. Both learn, load distributes.
5. **Review office hours.** Dedicate a 1-hour daily block where the team reviews PRs together.
6. **Auto-escalation.** If no review within SLA, auto-assign a secondary reviewer.

Track reviewer load with dashboards (LinearB, Sleuth, Pluralsight Flow, or custom GitHub Actions).

### Code Ownership Models

| Model                    | Description                                        | Pros                              | Cons                                |
|--------------------------|----------------------------------------------------|-----------------------------------|-------------------------------------|
| **Strong ownership**     | Each module has a designated owner. Owner must review. | Deep expertise. Clear accountability. | Bottleneck. Bus factor = 1.       |
| **Weak ownership**       | Suggested owners, but anyone can review and merge.  | Flexible. Faster reviews.         | Less deep expertise per area.       |
| **Collective ownership** | No owners. Anyone can change anything.             | Maximum flexibility. No bottlenecks. | Diluted responsibility. Inconsistency. |
| **Hybrid (recommended)** | CODEOWNERS for critical paths + collective for the rest. | Expertise where it matters. Speed elsewhere. | Requires clear classification.   |

Implement hybrid ownership:
- CODEOWNERS for: auth, payments, data models, infrastructure, public APIs.
- Collective ownership for: application logic, UI components, tests, documentation.

### Review Metrics That Do NOT Harm Culture

**Dangerous metrics (avoid):**
- Lines reviewed per day -- incentivizes rubber-stamping.
- Rejection rate per reviewer -- incentivizes gatekeeping.
- Comments per review -- incentivizes nitpicking.
- Time to approve (without context) -- incentivizes skipping thoroughness.

**Healthy metrics (track):**
- Median review turnaround time (team-level, not individual).
- Post-merge defect rate (team-level).
- Review coverage (% of PRs reviewed before merge).
- Author satisfaction (quarterly survey: "Do reviews help you write better code?").
- Learning outcomes (quarterly survey: "Have you learned something from a review this quarter?").

Present all metrics as **team trends**, never as individual leaderboards.

### Handling Remote/Async Review Across Time Zones

For distributed teams spanning 6+ hours of time zone difference:

1. **Overlap windows.** Identify the 2-4 hour overlap. Schedule complex reviews (Ask tier) in this window.
2. **Async-first defaults.** Write thorough PR descriptions. Include screenshots, test results, and design context. Assume the reviewer will read this without you available to answer questions.
3. **Video walkthroughs.** For complex changes, record a 3-5 minute Loom/screen recording walking through the PR. Attach to the PR description.
4. **Follow-the-sun rotation.** Assign reviewers from the time zone that is starting their day when the PR is opened.
5. **Batch reviews.** Reviewers process all queued PRs at the start and end of their workday.
6. **Clear availability signals.** Use Slack status, calendar blocks, or GitHub status to indicate review availability.

---

## Best Practices

1. **Critique code, not people.** Frame every comment as "this code does X" not "you did X." Use collaborative language ("we", "let's", "consider") over directive language ("you must", "you should").
2. **Use comment prefixes to signal intent.** `blocker:`, `suggestion:`, `nitpick:`, `question:`, `praise:`, `thought:`, `todo:`. Eliminate guesswork about severity.
3. **Include at least one specific praise comment per review.** Recognize good patterns, clean abstractions, thorough tests. Specific praise reinforces desired behavior.
4. **Adopt Ship/Show/Ask.** Not every change needs a blocking review. Classify changes by risk. Trust the team with low-risk merges.
5. **Cap individual reviewer load.** No person reviews more than 30% of team PRs or more than 5 active reviews concurrently. Rotate with tooling.
6. **Measure team trends, not individual performance.** Track review turnaround, post-merge defects, and author satisfaction at the team level. Never create individual leaderboards.
7. **Invest in async review infrastructure.** Thorough PR descriptions, video walkthroughs, and follow-the-sun rotation keep distributed teams unblocked.
8. **Use pair review for onboarding.** New team members review synchronously with a mentor for the first two weeks. Then transition to independent review with async mentorship.
9. **Resolve disagreements with data, not authority.** Reference benchmarks, documentation, or production metrics. Escalate to RFC for systemic decisions.
10. **Run quarterly review retrospectives.** Ask: "Are reviews helping us ship better code faster?" Adjust SLAs, tooling, and conventions based on team feedback.

---

## Anti-Patterns

| Anti-Pattern                        | Problem                                                   | Fix                                                       |
|-------------------------------------|-----------------------------------------------------------|-----------------------------------------------------------|
| **Personal attacks in reviews**     | Destroys psychological safety. People stop contributing.  | Enforce "critique code, not people" rule. Coach violators. |
| **Single-gatekeeper reviews**       | One person blocks all merges. Bottleneck and bus factor.  | Round-robin assignment. Enforce max 30% load.             |
| **Approval without reading**        | Rubber-stamp LGTM. Defects escape to production.          | Define LGTM criteria. Track review thoroughness.          |
| **Nitpick-only reviews**            | 20 comments on style, zero on logic. Wastes time.        | Automate linting. Enforce comment prefix taxonomy.        |
| **Review as hazing ritual**         | Seniors overwhelm juniors with 50+ comments.             | Limit to 3-5 substantive comments. Prioritize by impact. |
| **Metrics that punish reviewers**   | "Lines reviewed/day" incentivizes speed over quality.     | Track team-level trends only. Survey satisfaction.        |
| **Ignoring async constraints**      | Requiring sync review in a global team. Blocks for 16h.  | Async-first. Video walkthroughs. Follow-the-sun.         |
| **No positive feedback ever**       | Reviews become a source of dread, not learning.           | Require `praise:` in review guidelines. Model from leads. |

---

## Enforcement Checklist

- [ ] Code review guidelines documented in CONTRIBUTING.md
- [ ] Comment prefix taxonomy (blocker/suggestion/nitpick/question/praise) documented and enforced
- [ ] Ship/Show/Ask tiers defined with examples for the team
- [ ] Reviewer rotation configured (round-robin or PullApprove)
- [ ] Review SLAs posted and tracked on a team dashboard
- [ ] Reviewer load cap enforced (max 30% per person, max 5 concurrent)
- [ ] Quarterly review culture survey scheduled (satisfaction + learning)
- [ ] Onboarding includes 2-week pair review phase
- [ ] Async review infrastructure in place (video walkthrough tool, thorough templates)
- [ ] CODEOWNERS covers critical paths; collective ownership for the rest
- [ ] Escalation path documented: PR comments > sync call > tech lead > RFC
- [ ] No individual-level review metrics used in performance evaluations
