# CI/CD and Code Quality

> **Domain:** Fundamentals > Clean Code > Tools and Practices
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Continuous Integration (CI) and Continuous Delivery (CD) are practices that automate code quality checks, testing, and deployment. From a clean code perspective, CI/CD is the **enforcement mechanism** that ensures quality standards are maintained.

> "Continuous Integration doesn't get rid of bugs, but it does make them dramatically easier to find and remove." — Martin Fowler

## Why It Matters

Without automated enforcement, code quality rules are just suggestions. CI/CD makes them **mandatory** — every commit is automatically linted, tested, and analyzed before it can be merged.

## How It Works

### Quality Gates Pipeline

```yaml
# GitHub Actions CI Pipeline
name: Code Quality
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Type Check
        run: npm run typecheck
      - name: Unit Tests
        run: npm run test -- --coverage
      - name: Check Coverage Threshold
        run: |
          npx istanbul check-coverage --lines 80 --branches 75
      - name: Security Audit
        run: npm audit --production
```

### Pre-commit Hooks

```bash
# .husky/pre-commit — runs before every commit
#!/bin/sh
npx lint-staged     # Lint and format staged files
npm run typecheck   # Type check the project
npm run test        # Run unit tests
```

### Branch Protection Rules

Configure in GitHub/GitLab:
- Require PR reviews before merging
- Require CI checks to pass
- Require up-to-date branches
- Require signed commits
- Block force pushes to main

### Trunk-Based Development

Modern teams prefer **trunk-based development** over GitFlow:
- Short-lived feature branches (< 1-2 days)
- Merge to main frequently
- Use feature flags for incomplete features
- Results in smaller, more reviewable PRs

## Best Practices

1. **Fail fast.** Run the fastest checks (lint, typecheck) before slower ones (tests, builds).
2. **Make the pipeline fast.** Target under 10 minutes. Developers won't wait longer.
3. **Never skip CI.** No `--no-verify` commits, no manual overrides of quality gates.
4. **Use quality gates** — minimum coverage, maximum complexity, zero new security issues.
5. **Run security scanning** on every PR, not just periodically.
6. **Automate everything.** If a human has to remember to do it, it won't get done.

## Sources

- Fowler, M. (2006). "Continuous Integration." (Blog post)
- Humble, J. & Farley, D. (2010). *Continuous Delivery*. Addison-Wesley.
- [How to Write Better Code with Tools (eficode.com)](https://www.eficode.com/blog/how-to-write-better-code-with-tools)
