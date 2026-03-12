# AI-Assisted Code Review

| Attribute      | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Domain         | Code Quality > AI                                                    |
| Importance     | High                                                                 |
| Last Updated   | 2026-03-11                                                           |
| Cross-ref      | [Code Review Best Practices](../code-review/best-practices.md), [Code Review Culture](../code-review/culture.md) |

---

## Core Concepts

### The Review Gap Problem

AI generates code faster than humans can review it. This asymmetry creates a critical quality bottleneck.

| Metric                         | Value                | Source / Context                            |
|--------------------------------|----------------------|---------------------------------------------|
| Developers using AI tools      | 84%+                 | 2025 industry surveys                       |
| Code that is AI-generated      | ~42%                 | Self-reported across enterprise teams        |
| Developers who always review AI code | 48%            | Fewer than half check before committing      |
| Defect detection gap           | ~40%                 | Unreviewed AI code vs. human-reviewed code   |
| Trust in AI correctness        | 4% full trust        | 96% do not fully trust AI-generated code     |
| AI code review market (2024)   | $6.7B                | Projected $25.7B by 2030                    |

The core problem: AI writes code in seconds, but a thorough human review of 400 lines takes 30-60 minutes. Teams that adopt AI coding assistants without scaling their review capacity accumulate unreviewed code debt. AI-assisted review closes this gap by automating the mechanical aspects of review so humans focus on architecture and business logic.

### AI Code Review Tools Comparison

| Tool                  | Platform Support                | Key Strength                        | Pricing (2026)      |
|-----------------------|---------------------------------|-------------------------------------|---------------------|
| **CodeRabbit**        | GitHub, GitLab, Bitbucket, Azure DevOps | Most widely adopted (2M+ repos, 13M+ PRs). Inline comments, chat, auto-summaries. | Free (OSS) / $24/user/mo |
| **GitHub Copilot Review** | GitHub only                 | Deep GitHub integration. Reads source files, directory structure. CodeQL + ESLint integration. | Included in Copilot subscription |
| **Qodo (Codium)**     | GitHub, GitLab                 | Strongest architectural drift and cross-service impact detection. Test generation. | Free (individual) / $19/user/mo |
| **Graphite**          | GitHub                         | Stacked PRs + AI review. Optimized for fast-moving teams. | ~$40/user/mo        |
| **CodeScene**         | GitHub, GitLab, Bitbucket, Azure DevOps | Behavioral code analysis. Combines git history with code metrics. Hotspot detection. | Custom pricing      |
| **Sourcery**          | GitHub, VS Code                | Python-focused. Highly accurate refactoring suggestions. | $24/dev/mo          |
| **Greptile**          | GitHub, GitLab                 | Codebase-aware review. Claims 3x more bugs caught, 4x faster merge. | Usage-based         |

### How AI Code Review Works

AI review tools follow a four-stage pipeline on every PR:

```
1. DIFF ANALYSIS        Parse the PR diff, identify changed files, hunks, and context
        |
2. CONTEXT GATHERING    Read surrounding code, imports, types, related files, git history
        |
3. PATTERN MATCHING     Apply rules: security patterns, bug patterns, style violations,
                        complexity thresholds, known anti-patterns
        |
4. COMMENT GENERATION   Produce inline comments with severity, explanation, and fix suggestion
```

Advanced tools (CodeRabbit, Qodo) also perform:
- **Cross-file impact analysis** -- trace how changes propagate across modules
- **Security scanning** -- detect SQL injection, XSS, hardcoded secrets, insecure dependencies
- **Test coverage assessment** -- flag untested code paths in the diff
- **PR summary generation** -- auto-generate a structured summary of changes and risk areas

### Configuring AI Review -- CodeRabbit Example

Place `.coderabbit.yaml` in the repository root:

```yaml
# .coderabbit.yaml -- CodeRabbit configuration
language: "en-US"

reviews:
  profile: "assertive"          # "chill" = fewer comments, "assertive" = thorough
  request_changes_workflow: true # Block merge on critical findings
  high_level_summary: true      # Generate PR summary comment
  poem: false                   # Disable poem in summary
  review_status: true           # Show review progress
  auto_review:
    enabled: true
    drafts: false               # Skip draft PRs
    ignore:
      - "**/*.lock"
      - "**/*.snap"
      - "**/*.generated.*"
      - "**/migrations/**"
      - "docs/**"

  path_instructions:
    - path: "src/api/**/*.ts"
      instructions: |
        Ensure API routes have proper error handling with try-catch.
        Validate request bodies with Zod schemas.
        Verify authentication middleware is applied.
        Check for N+1 query patterns in database calls.
        Flag any raw SQL -- require parameterized queries.
    - path: "src/auth/**/*"
      instructions: |
        Security-critical path. Flag any changes to authentication logic.
        Verify token validation, session handling, and RBAC checks.
        Require explicit test coverage for all branches.
    - path: "**/*.test.ts"
      instructions: |
        Verify tests follow AAA pattern (Arrange-Act-Assert).
        Flag tests without assertions.
        Check for flaky patterns: timers, network calls, shared state.
    - path: "infrastructure/**/*"
      instructions: |
        Check for security group changes, IAM policy modifications.
        Flag any publicly exposed resources.
        Verify state file is not committed.

  # Custom pre-merge checks
  checks:
    - name: "Error handling coverage"
      instructions: |
        Verify every async function has proper error handling.
        Check that errors are logged with context before being rethrown.
    - name: "API backward compatibility"
      instructions: |
        Flag breaking changes to public API endpoints.
        Check for removed or renamed fields in response schemas.

chat:
  auto_reply: true              # Allow @coderabbitai mentions in PR comments
```

### GitHub Actions Integration

Add AI review as a required check alongside existing CI:

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review Gate
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]

jobs:
  ai-review-status:
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false
    steps:
      - name: Wait for CodeRabbit review
        uses: coderabbitai/ai-pr-reviewer@latest  # or use the GitHub App
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - name: Check for blocking findings
        run: |
          # Query CodeRabbit API or check PR review status
          BLOCKING=$(gh pr reviews ${{ github.event.pull_request.number }} \
            --json state --jq '[.[] | select(.state=="CHANGES_REQUESTED")] | length')
          if [ "$BLOCKING" -gt 0 ]; then
            echo "::warning::AI review requested changes. Address before human review."
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # Combine with human review requirement
  review-gate:
    needs: [ai-review-status]
    runs-on: ubuntu-latest
    steps:
      - name: Verify review coverage
        run: echo "AI review complete. Human review required via branch protection."
```

### AI + Human Review Workflow

Divide responsibilities based on what each does best:

| Responsibility              | AI Review                           | Human Review                         |
|-----------------------------|-------------------------------------|--------------------------------------|
| **Style and formatting**    | Primary. Catches 95%+ of issues.    | Skip. Automate fully.               |
| **Bug detection**           | Primary. Null checks, off-by-one, type mismatches. | Verify complex logic bugs.     |
| **Security patterns**       | Primary. SQLi, XSS, hardcoded secrets, OWASP patterns. | Validate auth flows, access control design. |
| **Complexity analysis**     | Primary. Cyclomatic complexity, deep nesting. | Assess if complexity is justified. |
| **Architecture decisions**  | Cannot assess. No business context. | Primary. Evaluate design trade-offs. |
| **Business logic**          | Surface-level only.                 | Primary. Validate requirements.      |
| **Team conventions**        | Good with custom rules configured.  | Primary. Institutional knowledge.    |
| **Edge cases**              | Catches common patterns.            | Primary. Domain-specific edge cases. |
| **Performance implications**| Flags known anti-patterns.          | Assess system-level impact.          |
| **Cross-service impact**    | Qodo excels here; others limited.   | Primary for most tools.              |

Recommended workflow:

```
PR Opened
    |
    v
[AI Review] -- automated, runs in < 5 minutes
    |
    +-- Generates PR summary
    +-- Posts inline comments (bug, security, style, complexity)
    +-- Labels PR by risk level (low / medium / high)
    |
    v
[Author addresses AI feedback] -- fix trivial issues before human review
    |
    v
[Human Review] -- focuses on architecture, logic, and domain concerns
    |
    v
[Merge] -- requires both AI pass + human approval
```

### Trust Calibration

Not all AI suggestions are equal. Calibrate trust by category:

| Category                | AI Accuracy | Action                                       |
|-------------------------|-------------|----------------------------------------------|
| Formatting/style        | ~98%        | Auto-apply. No human review needed.          |
| Unused imports/vars     | ~95%        | Auto-apply with CI verification.             |
| Null/undefined checks   | ~90%        | Trust but verify the fix suggestion.         |
| Security patterns       | ~85%        | Review every suggestion. False positives exist. |
| Performance suggestions | ~70%        | Always benchmark before applying.            |
| Architecture advice     | ~40%        | Treat as brainstorming input, not guidance.  |
| Business logic          | ~20%        | Almost never actionable without context.     |

Track false positive rates per category. Adjust sensitivity in `.coderabbit.yaml` if a category generates more noise than signal. Use the `@coderabbitai resolve` command to dismiss false positives and train the model.

### AI-Generated PR Summaries

Configure AI to generate structured summaries for every PR:

```markdown
## Summary (AI-Generated)
<!-- Auto-generated by CodeRabbit -->

### Changes
- Added rate limiting middleware to `/api/orders` endpoint
- Refactored `OrderService` to use repository pattern
- Added integration tests for rate limiting (95% branch coverage)

### Risk Assessment: **Medium**
- Modifies request pipeline (affects all API routes downstream)
- New dependency: `express-rate-limit@7.x`

### Review Focus Areas
1. Rate limit configuration values (lines 45-52) -- verify against load test data
2. Redis connection handling in rate limiter (lines 78-90) -- check failover behavior
3. Test mocks for Redis client (test file lines 23-40) -- verify realistic scenarios

### Walkthrough
| File | Change | Lines |
|------|--------|-------|
| `src/middleware/rate-limit.ts` | New file. Rate limiting middleware. | +87 |
| `src/services/order.service.ts` | Refactored to repository pattern. | +45, -32 |
| `tests/rate-limit.integration.test.ts` | New integration tests. | +120 |
```

### Privacy and Security Considerations

| Concern                  | Risk                                      | Mitigation                                  |
|--------------------------|-------------------------------------------|---------------------------------------------|
| Code sent to third-party | IP exposure, secret leakage               | Use ignore patterns for sensitive paths     |
| Data retention           | AI provider stores code for training      | Verify data retention policy. Opt out of training. |
| On-premise requirement   | Regulated industries cannot use cloud AI   | Use CodeScene (on-prem) or self-hosted LLMs |
| Secrets in diffs         | AI comments may reference secrets in logs | Pre-scan diffs with `gitleaks` before AI review |
| Compliance (SOC2, HIPAA) | Third-party access to PHI/PII in code     | Exclude regulated modules from AI review    |

Add to `.coderabbit.yaml` ignore list for sensitive paths:

```yaml
auto_review:
  ignore:
    - "src/auth/secrets/**"
    - "infrastructure/keys/**"
    - "**/*.pem"
    - "**/*.env*"
    - "**/credentials*"
```

### Measuring AI Review Effectiveness

Track these metrics monthly to justify AI review investment:

| Metric                         | How to Measure                               | Target                    |
|--------------------------------|----------------------------------------------|---------------------------|
| Bugs caught by AI              | Label AI-found issues in issue tracker       | > 30% of all review bugs  |
| Review time reduction          | Compare median review time before/after      | 40-60% reduction          |
| Time to first review comment   | Measure from PR open to first comment        | < 5 min (AI), < 4 hr (human) |
| False positive rate            | Track dismissed AI comments / total comments | < 20%                     |
| Developer satisfaction         | Quarterly survey (1-5 scale)                 | > 3.5/5                   |
| Post-merge defect rate         | Bugs found in prod within 30 days of merge   | Decreasing trend          |
| AI comment resolution rate     | % of AI comments that lead to code changes   | 40-60% (lower = too noisy) |

### Cost-Benefit Analysis

| Factor              | Without AI Review            | With AI Review                          |
|---------------------|------------------------------|-----------------------------------------|
| Review time/PR      | 45-60 min                    | 15-25 min (human portion)               |
| Bugs escaping review| ~35% of introduced defects   | ~15% (AI catches mechanical issues)     |
| Reviewer fatigue    | High after 3+ reviews/day   | Lower -- AI handles repetitive checks   |
| Onboarding cost     | New devs wait for reviewers  | AI provides instant feedback             |
| Annual cost (10 devs)| $0 tooling, ~$180K reviewer time | ~$3K tooling + ~$90K reviewer time  |

---

## Best Practices

1. **Run AI review before human review.** Configure AI to post comments within 5 minutes of PR creation. Authors fix trivial issues before requesting human review, reducing noise and review cycles.
2. **Configure path-specific instructions.** Generic AI review misses domain context. Add `path_instructions` in `.coderabbit.yaml` for API routes, auth modules, database layers, and infrastructure code.
3. **Set the review profile to assertive for critical paths.** Use `assertive` for `src/auth/**`, `src/payments/**`, and infrastructure. Use `chill` for documentation, tests, and internal tooling to reduce noise.
4. **Exclude generated code from AI review.** Add lockfiles, snapshots, migrations, and auto-generated types to the ignore list. AI comments on generated code waste time and create false positives.
5. **Track false positive rates weekly.** If AI review generates more than 20% false positives in a category, adjust sensitivity or add custom instructions. Noisy tools get ignored.
6. **Require AI review pass as a merge gate.** Add AI review as a required status check in branch protection. This ensures no PR bypasses automated quality checks.
7. **Use AI-generated PR summaries for every PR.** Enable `high_level_summary` to auto-generate change descriptions. Reviewers scan the summary before diving into code, saving 5-10 minutes per review.
8. **Pre-scan for secrets before AI review.** Run `gitleaks` or `trufflehog` in CI before the AI review step. Never rely on AI to catch secrets -- use deterministic scanning.
9. **Review AI review comments in retrospectives.** Monthly, audit a sample of AI comments. Identify categories where AI adds value vs. noise. Tune configuration based on findings.
10. **Combine multiple AI tools for defense in depth.** Use CodeRabbit for general review + CodeQL for security + Qodo for architectural analysis. No single tool catches everything.

---

## Anti-Patterns

| Anti-Pattern                         | Problem                                                    | Fix                                                    |
|--------------------------------------|------------------------------------------------------------|--------------------------------------------------------|
| **Blind trust in AI review**         | Treating AI approval as sufficient. Skipping human review. | Require both AI pass and human approval for merge.     |
| **No configuration**                 | Default settings generate irrelevant comments on every PR. | Invest 30 minutes configuring `.coderabbit.yaml` with path instructions. |
| **Ignoring all AI comments**         | Tool fatigue from high false positive rate. AI becomes noise. | Track and reduce false positives. Tune sensitivity. Dismiss with feedback. |
| **AI review on sensitive code**      | Sending auth, payment, or PII-handling code to third-party AI. | Exclude sensitive paths. Use on-premise tools for regulated code. |
| **Replacing human review entirely**  | AI cannot assess architecture, business logic, or team context. | Define clear division: AI handles mechanics, humans handle judgment. |
| **No metrics on AI effectiveness**   | Paying for a tool without measuring its impact on quality. | Track bugs caught, review time reduction, and false positive rate monthly. |
| **Same rules for all file types**    | Test files and infrastructure get the same scrutiny as core logic. | Use path-specific instructions with different profiles and thresholds. |
| **Skipping AI feedback before human review** | Human reviewers re-discover issues AI already flagged. Wasted effort. | Authors must address AI comments before requesting human review. |

---

## Enforcement Checklist

- [ ] AI review tool (CodeRabbit, Copilot, or Qodo) installed and configured for all active repositories
- [ ] `.coderabbit.yaml` (or equivalent) committed to repository root with path-specific instructions
- [ ] AI review set as a required status check in branch protection rules
- [ ] Sensitive paths (auth, secrets, keys, PII) excluded from cloud-based AI review
- [ ] Secret scanning (gitleaks/trufflehog) runs before AI review in CI pipeline
- [ ] AI-generated PR summaries enabled for all non-draft PRs
- [ ] False positive rate tracked and reviewed monthly (target: < 20%)
- [ ] Review workflow documented: AI first pass, author fixes, then human review
- [ ] AI review effectiveness dashboard visible to engineering leadership
- [ ] Data retention and privacy policy reviewed with legal/compliance for AI review provider
- [ ] On-premise or self-hosted option evaluated for regulated codebases
- [ ] Quarterly retrospective includes AI review tool tuning as an agenda item
