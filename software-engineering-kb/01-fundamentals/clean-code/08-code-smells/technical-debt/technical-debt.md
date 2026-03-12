# Technical Debt

> **Domain:** Fundamentals > Clean Code > Code Smells
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Technical debt is a metaphor coined by **Ward Cunningham in 1992** to explain to non-technical stakeholders why resources need to be budgeted for refactoring:

> "Shipping first-time code is like going into debt. A little debt speeds development so long as it is paid back promptly with refactoring. The danger occurs when the debt is not repaid. Every minute spent on code that is not quite right counts as interest on that debt."

### Martin Fowler's Technical Debt Quadrant

|  | **Prudent** | **Reckless** |
|--|------------|-------------|
| **Deliberate** | "We know this is debt and will fix it next sprint" | "We don't have time for clean code" |
| **Inadvertent** | "Now we know how we should have done it" | "What's layering?" |

**Prudent-Deliberate** is acceptable. **Reckless-Inadvertent** (writing bad code without knowing it's bad) is the most dangerous because you don't even know you have debt.

### Types of Technical Debt

- **Code debt:** Code smells, violations of clean code principles.
- **Design debt:** Architectural problems, inappropriate patterns.
- **Test debt:** Missing tests, unreliable tests, low coverage.
- **Documentation debt:** Missing docs, outdated docs, no ADRs.
- **Infrastructure debt:** Outdated dependencies, manual deployments, missing monitoring.
- **Dependency debt:** Outdated libraries with security vulnerabilities.

## Why It Matters

- The Standish Group estimates technical debt costs the global economy **$3 trillion per year**.
- Like financial debt, technical debt accrues **interest** — each change takes longer because of accumulated shortcuts.
- High debt slows delivery, increases bugs, hurts morale, and makes hiring harder (developers avoid messy codebases).

## How It Works

### Measuring Technical Debt

**SQALE Model (Software Quality Assessment based on Lifecycle Expectations):**
Estimates the effort (in hours/days) needed to fix all code quality issues. SonarQube uses this to show a "technical debt" number.

**Debt Ratio:** `technical_debt / development_cost × 100%`
- A = 0-5% (excellent)
- B = 5-10%
- C = 10-20%
- D = 20-50%
- E = 50%+ (critical)

### Managing Technical Debt

1. **Make it visible.** Use SonarQube dashboards, track debt in your project management tool.
2. **Allocate time.** 15-20% of each sprint for debt reduction is a common industry practice.
3. **Boy Scout Rule.** Leave code cleaner than you found it with every change.
4. **Maintain a debt register.** A log of known debt items with estimated effort and business impact.
5. **Prioritize by impact.** Fix debt in frequently-changed code first (high-churn files).
6. **Don't rewrite — refactor.** Incremental improvement is almost always safer than a big-bang rewrite.

## Best Practices

1. **Accept that some debt is necessary.** Prudent, deliberate debt is a valid business decision.
2. **Make debt decisions explicit.** Document why the shortcut was taken and when it should be fixed.
3. **Pay interest regularly.** Small, continuous debt payments prevent accumulation.
4. **Never accrue reckless debt.** "We don't have time for tests" is never prudent.
5. **Use automated tools** to track debt trends over time.

## Anti-patterns / Common Mistakes

- **Ignoring debt until crisis.** Like financial debt — ignoring it only makes it worse.
- **Big-bang rewrites.** History shows they fail more often than they succeed (Joel Spolsky's "Things You Should Never Do").
- **Debt without tracking.** If you can't measure it, you can't manage it.

## Sources

- Cunningham, W. (1992). "The WyCash Portfolio Management System." OOPSLA '92.
- Fowler, M. (2009). "TechnicalDebtQuadrant." (Blog post)
- [Technical Debt (martinfowler.com)](https://martinfowler.com/bliki/TechnicalDebt.html)
- [The Engineer's Complete Guide to Technical Debt (Stepsize)](https://www.stepsize.com/blog/complete-guide-to-technical-debt)
