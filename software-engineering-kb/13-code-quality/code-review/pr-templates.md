# PR Templates

| Attribute      | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Domain         | Code Quality > Code Review                                           |
| Importance     | High                                                                 |
| Last Updated   | 2026-03-11                                                           |
| Cross-ref      | [Best Practices](best-practices.md), [Review Checklist](review-checklist.md) |

---

## Core Concepts

### Why PR Templates Matter

A PR without context forces the reviewer to reverse-engineer intent from code. This doubles review time and halves defect detection. Templates provide: (1) context for reviewers, (2) 30-40% faster reviews (Google internal data), (3) documentation for future developers who search PR history.

### GitHub Default Template

Place at `.github/PULL_REQUEST_TEMPLATE.md`. Auto-populates every new PR.

```markdown
## Summary
<!-- What does this PR do? One paragraph max. -->

## Motivation / Context
<!-- Why is this change needed? Link to issue, RFC, or discussion. -->
Closes #

## Changes Made
-

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Refactoring (no functional changes)
- [ ] Documentation / Dependency / CI update

## Testing Done
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed (describe below)

## Screenshots / Recordings
<!-- For UI changes. Delete if not applicable. -->

## Deployment Notes
<!-- Feature flags, migrations, rollback plan. Delete if not applicable. -->

## Checklist
- [ ] Self-review completed
- [ ] Tests prove the change works
- [ ] Documentation updated
- [ ] Security implications checked
- [ ] Database migrations are reversible
```

### Multiple Templates

GitHub supports multiple templates via `.github/PULL_REQUEST_TEMPLATE/` directory.

#### Feature Template (`.github/PULL_REQUEST_TEMPLATE/feature.md`)

```markdown
---
name: Feature
about: Add new functionality
title: "feat: "
labels: feature
---
## Summary
## Motivation
Closes #

## Design Decisions
<!-- Key tradeoffs. Why this approach over alternatives? -->

## Changes Made
-

## API Changes
<!-- New endpoints, changed signatures, config options. Delete if N/A. -->

## Testing Strategy
- [ ] Unit tests cover happy path and edge cases
- [ ] Integration tests verify end-to-end flow
- [ ] Performance impact assessed

## Feature Flag
<!-- Behind a flag? Which one? Default state? -->

## Rollback Plan

## Checklist
- [ ] Design reviewed (for changes > 400 lines)
- [ ] Tests added and passing
- [ ] Docs updated (API docs, changelog)
- [ ] Security review completed (if auth/payments/PII)
- [ ] Observability added (logs, metrics, traces)
```

#### Bugfix Template (`.github/PULL_REQUEST_TEMPLATE/bugfix.md`)

```markdown
---
name: Bug Fix
about: Fix a defect
title: "fix: "
labels: bug
---
## Bug Description
## Root Cause
## Fix
Fixes #

## Reproduction Steps
1.
2.

## Testing Done
- [ ] Test added that fails without the fix and passes with it
- [ ] Regression tests pass
- [ ] Manual reproduction confirmed fixed

## Impact Assessment
- [ ] No other code paths affected
- [ ] Backward compatible

## Checklist
- [ ] Root cause documented (not just symptom fixed)
- [ ] Test proves the fix
```

#### Refactoring Template (`.github/PULL_REQUEST_TEMPLATE/refactoring.md`)

```markdown
---
name: Refactoring
about: Improve code structure without changing behavior
title: "refactor: "
labels: refactoring
---
## Summary
## Motivation
<!-- Tech debt ticket? What problem does this solve? -->

## Scope
<!-- What is explicitly NOT changing? -->

## Behavioral Changes
- [ ] **None.** Pure refactoring -- no behavior changes.

## Before / After
<!-- Structural change: class diagrams, dependency graphs, or code snippets. -->

## Testing Strategy
- [ ] Existing tests pass without modification (proves no behavior change)
- [ ] New tests added for extracted modules

## Checklist
- [ ] No behavior changes (existing tests pass unmodified)
- [ ] Incremental -- can be merged independently
```

#### Dependency Update Template (`.github/PULL_REQUEST_TEMPLATE/dependency-update.md`)

```markdown
---
name: Dependency Update
about: Update project dependencies
title: "chore(deps): "
labels: dependencies
---
## Dependency Changes
| Package | From | To | Type (major/minor/patch) |
|---------|------|----|--------------------------|
|         |      |    |                          |

## Motivation
<!-- Security advisory, new feature needed, compatibility? -->

## Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes addressed (describe below)

## Testing Done
- [ ] All existing tests pass
- [ ] Build succeeds
- [ ] Runtime smoke test performed

## Checklist
- [ ] Changelog of dependency reviewed
- [ ] No known vulnerabilities (`npm audit` / `pip audit`)
- [ ] Bundle size impact checked (frontend deps)
```

### Conventional PR Titles

Adopt Conventional Commits syntax for PR titles to enable automated changelogs and semantic versioning.

```text
<type>(<scope>): <description>

feat(auth): add OAuth2 PKCE flow for mobile clients
fix(api): handle null response from payment gateway
refactor(orders): extract pricing logic into PricingService
chore(deps): update React to 19.1
```

| Type       | When to Use                              | Version Bump |
|------------|------------------------------------------|-------------|
| `feat`     | New user-visible functionality           | Minor       |
| `fix`      | Bug fix                                  | Patch       |
| `refactor` | Code restructuring, no behavior change   | None        |
| `chore`    | Build, CI, deps, tooling                 | None        |
| `docs`     | Documentation only                       | None        |
| `perf`     | Performance improvement                  | Patch       |
| `test`     | Adding or fixing tests                   | None        |
| `ci`       | CI/CD changes                            | None        |
| `!` suffix | Breaking change: `feat!: remove v1 API`  | Major       |

Enforce with CI:

```yaml
# .github/workflows/pr-title.yml
name: PR Title Check
on:
  pull_request:
    types: [opened, edited, synchronize]
jobs:
  check-title:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Linking to Issues

Use closing keywords in the PR body (not the title) for reliable auto-closing:

```text
Closes #123       -- Closes on merge       Part of #101    -- Links without closing
Fixes #456        -- Same as Closes        Related to #202 -- Reference only
```

Multiple issues: `Closes #123, closes #456`.

### Auto-Generated Changelogs

With Conventional PR titles, use release-please for zero-effort changelogs:

```yaml
# .github/workflows/changelog.yml
name: Release
on:
  push:
    branches: [main]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node
```

### Draft PRs Workflow

| Stage              | PR State | Reviewer Action                     |
|--------------------|----------|-------------------------------------|
| Work in progress   | Draft    | Optional: directional feedback only |
| Ready for feedback | Draft    | Review architecture and approach    |
| Ready for review   | Open     | Full review per standard process    |
| Approved           | Open     | Merge when CI passes                |

Convert from draft to open only when: tests pass, self-review completed, description is complete.

### PR Size Labels

Auto-label PRs by size for instant triage:

```yaml
# .github/workflows/pr-labeler.yml
name: PR Size Labels
on: [pull_request]
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: codelytv/pr-size-labeler@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          xs_max_size: 50
          s_max_size: 100
          m_max_size: 400
          l_max_size: 800
          fail_if_xl: true
          files_to_ignore: "package-lock.json\n*.snap\n*.generated.*\n*.lock"
```

### GitLab MR Templates

GitLab uses `.gitlab/merge_request_templates/` directory. Supports quick actions (`/label`, `/assign_reviewer`, `/milestone`) directly in templates.

---

## Best Practices

1. **Enforce a default PR template.** Place it at `.github/PULL_REQUEST_TEMPLATE.md`. Every PR starts with structure, not a blank text box.
2. **Provide multiple templates for common change types.** Feature, bugfix, refactoring, and dependency updates have different context needs.
3. **Require conventional PR titles.** Enforce `feat:`, `fix:`, `refactor:`, `chore:` prefixes with a CI check. Enable automated changelogs.
4. **Link every PR to an issue.** Use `Closes #123` in the body. Orphaned PRs lack context and audit trail.
5. **Include a self-review checklist in every template.** Authors catch 30-50% of their own issues during self-review.
6. **Add deployment notes for non-trivial changes.** Feature flags, migration steps, and rollback plans belong in the PR.
7. **Use draft PRs for early directional feedback.** Get architecture feedback before investing in implementation details.
8. **Auto-label PRs by size.** XS through XL labels. Fail or warn on XL PRs. Instant triage.
9. **Write PR descriptions for future readers.** The developer who `git blame`s this line in a year will read your description.
10. **Auto-generate changelogs from PR titles.** Use release-please or similar. Conventional titles make this zero-effort.

---

## Anti-Patterns

| Anti-Pattern                          | Problem                                                 | Fix                                                    |
|---------------------------------------|---------------------------------------------------------|--------------------------------------------------------|
| **Empty PR descriptions**             | Reviewer reverse-engineers intent. Doubles review time. | Enforce template with Danger.js. Fail if body < 50 chars. |
| **One template for all change types** | Feature PRs need design context; dep updates don't.     | Provide multiple templates. Let authors choose.        |
| **No issue linking**                  | PRs lack business context. Audit trail broken.          | Require `Closes #` or `Related to #` in every PR.     |
| **Freeform PR titles**                | Cannot auto-generate changelogs. Inconsistent history.  | Enforce conventional titles with CI check.             |
| **Skipping self-review**              | Author submits code they haven't re-read.               | Add self-review checkbox. Require before marking ready.|
| **Templates as bureaucracy**          | 30-field template for a typo fix.                       | Keep default lean. Use Ship/Show/Ask tiers.            |
| **Stale templates**                   | Template references defunct processes or tools.         | Review templates quarterly. Assign an owner.           |
| **No screenshots for UI changes**     | Reviewer cannot assess visual correctness.              | Template prompts for screenshots. CI checks on UI labels. |

---

## Enforcement Checklist

- [ ] Default PR template at `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Multiple templates for feature, bugfix, refactoring, dependency update
- [ ] Conventional PR title enforced via CI
- [ ] PR description minimum length enforced (Danger.js, > 50 characters)
- [ ] Issue linking required (`Closes #` or `Related to #`)
- [ ] PR size auto-labeling configured (XS/S/M/L/XL)
- [ ] XL PRs (800+ lines) blocked or require explicit waiver
- [ ] Draft PR workflow documented in CONTRIBUTING.md
- [ ] Auto-changelog generation configured (release-please or similar)
- [ ] Templates reviewed and updated quarterly
- [ ] Self-review checklist in every template
- [ ] Deployment notes section in non-trivial change templates
