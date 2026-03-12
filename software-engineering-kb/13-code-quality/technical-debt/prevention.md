# Preventing Technical Debt

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | Code Quality > Technical Debt                                        |
| Importance     | High                                                                 |
| Audience       | All developers, tech leads, engineering managers                     |
| Prerequisites  | CI/CD pipeline, linting/formatting setup, code review process        |
| Cross-ref      | [Measuring](measuring.md), [Managing](managing.md), [Quality Gates](../code-metrics/quality-gates.md) |

---

## Core Concepts

### Shift-Left Quality

Prevent debt before it enters the codebase. Every stage of the pipeline catches different debt types.

```
IDE (seconds)     → Linter warnings, type errors, auto-format
Pre-commit (seconds) → Lint, format, type-check staged files
PR Review (minutes)  → Architecture, design, complexity review
CI Pipeline (minutes)→ Tests, coverage, SonarQube, dep audit
Quality Gate (CI)    → Block merge if quality drops below threshold
```

**Cost to fix increases 10x per stage.** Catching a naming violation in the IDE costs seconds. Finding it in production code review costs minutes of reviewer time plus rework.

### Definition of Done with Quality Criteria

Encode quality expectations in the team's Definition of Done.

```markdown
## Definition of Done (Quality-Focused)

### Code Quality
- [ ] All linter rules pass (zero warnings)
- [ ] Type-checked with strict mode (TypeScript strict, mypy strict, go vet)
- [ ] Formatted with project formatter (Prettier, Black, gofmt)
- [ ] Cyclomatic complexity per function <= 10
- [ ] No duplicated code blocks > 10 lines

### Testing
- [ ] New code has >= 80% line coverage
- [ ] Modified code maintains or improves existing coverage
- [ ] Unit tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Integration tests cover API contracts

### Review
- [ ] Code reviewed by at least 1 team member
- [ ] No unresolved review comments
- [ ] Reviewer verified: no new debt without registered debt item

### Documentation
- [ ] Public API changes documented (JSDoc, docstrings, godoc)
- [ ] Breaking changes noted in changelog
- [ ] ADR written for architectural decisions
```

### Quality Gates as Prevention

Configure quality gates to block merges when quality degrades.

```yaml
# SonarQube quality gate configuration
conditions:
  - metric: new_coverage
    operator: LESS_THAN
    value: 80              # New code must have >= 80% coverage
  - metric: new_duplicated_lines_density
    operator: GREATER_THAN
    value: 3               # No more than 3% duplication in new code
  - metric: new_maintainability_rating
    operator: GREATER_THAN
    value: 1               # Must be A rating for new code
  - metric: new_reliability_rating
    operator: GREATER_THAN
    value: 1               # No new bugs
  - metric: new_security_rating
    operator: GREATER_THAN
    value: 1               # No new vulnerabilities
```

```yaml
# GitHub Actions: quality gate check
- name: SonarQube Quality Gate
  uses: sonarqube-quality-gate-action@v1
  with:
    scanMetadataReportFile: .scannerwork/report-task.txt
  # Fails the PR if quality gate does not pass
```

### Code Review as Prevention

Train reviewers to catch debt introduction, not just bugs.

```markdown
## Code Review Checklist: Debt Prevention

### Complexity
- [ ] No function exceeds 20 lines (guideline, not hard rule)
- [ ] No function has more than 3 parameters
- [ ] No nested conditionals deeper than 2 levels
- [ ] Complex logic has explanatory comments or is extracted into named functions

### Dependencies
- [ ] No new dependencies without justification in PR description
- [ ] New dependencies checked for: maintenance status, license, size, alternatives
- [ ] No pinning to outdated major versions

### Architecture
- [ ] No new circular dependencies introduced
- [ ] Layer boundaries respected (presentation does not import infrastructure)
- [ ] No business logic in controllers/handlers
- [ ] No hardcoded configuration values

### Future-Proofing
- [ ] No TODO comments without linked issue/debt item
- [ ] No commented-out code committed
- [ ] No copy-paste duplication (extract shared code)
```

### Architectural Fitness Functions

Automated tests that verify architectural rules. Run in CI to prevent architectural drift.

```typescript
// TypeScript: ts-arch for architecture rules
import { projectFiles } from "ts-arch";

describe("Architecture Rules", () => {
  it("domain layer must not import infrastructure", async () => {
    const rule = projectFiles()
      .inFolder("src/domain")
      .shouldNot()
      .dependOnFiles()
      .inFolder("src/infrastructure");

    await expect(rule).toPassAsync();
  });

  it("controllers must not import repositories directly", async () => {
    const rule = projectFiles()
      .inFolder("src/controllers")
      .shouldNot()
      .dependOnFiles()
      .inFolder("src/repositories");

    await expect(rule).toPassAsync();
  });
});
```

```python
# Python: import-linter for architecture rules
# .importlinter configuration
[importlinter]
root_packages = myapp

[importlinter:contract:layers]
name = Layered Architecture
type = layers
layers =
    myapp.presentation
    myapp.application
    myapp.domain
    myapp.infrastructure
# Enforces: presentation can import application but not domain/infrastructure directly
```

```java
// Java: ArchUnit
@ArchTest
static final ArchRule layerRule = layeredArchitecture()
    .consideringAllDependencies()
    .layer("Controllers").definedBy("..controllers..")
    .layer("Services").definedBy("..services..")
    .layer("Repositories").definedBy("..repositories..")
    .whereLayer("Controllers").mayNotBeAccessedByAnyLayer()
    .whereLayer("Services").mayOnlyBeAccessedByLayers("Controllers")
    .whereLayer("Repositories").mayOnlyBeAccessedByLayers("Services");
```

### Coding Standards Enforcement

Automate standards so reviewers focus on design, not formatting.

```jsonc
// ESLint: enforce complexity limits
{
  "rules": {
    "complexity": ["error", 10],
    "max-depth": ["error", 3],
    "max-lines-per-function": ["warn", { "max": 50 }],
    "max-params": ["error", 3],
    "no-duplicate-imports": "error",
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["../../../*"],
        "message": "Avoid deep relative imports. Use path aliases."
      }]
    }]
  }
}
```

```yaml
# Pre-commit hooks: catch issues before they leave the developer's machine
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: lint
        name: Lint
        entry: npx eslint --max-warnings=0
        language: system
        types: [typescript]
      - id: format-check
        name: Format Check
        entry: npx prettier --check
        language: system
        types: [typescript]
      - id: type-check
        name: Type Check
        entry: npx tsc --noEmit
        language: system
        pass_filenames: false
```

### Design Review for Complex Features

Require an Architecture Decision Record (ADR) before coding complex features. This prevents inadvertent debt from poor upfront design.

```markdown
## ADR Template (Lightweight)

### Title: [Short descriptive title]
### Status: Proposed | Accepted | Rejected | Superseded
### Date: YYYY-MM-DD

### Context
What is the problem? What constraints exist?

### Decision
What approach are we taking and why?

### Consequences
- Positive: [benefits]
- Negative: [tradeoffs and debt being accepted]
- Debt items: [any deliberate debt, with planned remediation date]
```

**Threshold:** Require ADR for changes that touch > 3 services, introduce new dependencies, change data models, or modify authentication/authorization.

### Tech Radar for Technology Decisions

Prevent tech stack sprawl by maintaining a team tech radar.

```yaml
# tech-radar.yml
rings:
  adopt:
    description: "Default choice for new projects"
    items:
      - { name: "TypeScript", category: "languages" }
      - { name: "PostgreSQL", category: "databases" }
      - { name: "React", category: "frameworks" }

  trial:
    description: "Use in non-critical projects to evaluate"
    items:
      - { name: "Bun", category: "platforms" }
      - { name: "Drizzle ORM", category: "libraries" }

  assess:
    description: "Research only, not in production"
    items:
      - { name: "Effect-TS", category: "libraries" }

  hold:
    description: "Do not use in new code. Migrate away."
    items:
      - { name: "Moment.js", category: "libraries" }
      - { name: "Express.js", category: "frameworks" }
      - { name: "MongoDB", category: "databases", reason: "Use PostgreSQL instead" }
```

**Rule:** Any technology not on the radar requires a tech radar proposal before adoption.

### Dependency Management

Prevent dependency debt through automated updates and policies.

```jsonc
// renovate.json -- auto-update dependencies
{
  "extends": ["config:recommended"],
  "schedule": ["before 7am on Monday"],
  "packageRules": [
    { "matchUpdateTypes": ["patch", "minor"], "automerge": true },
    { "matchUpdateTypes": ["major"], "automerge": false, "reviewers": ["team:platform"] },
    { "matchPackagePatterns": ["*"], "rangeStrategy": "pin" }
  ]
}
```

**Dependency policy:**
- Pin all production dependencies to exact versions
- Auto-merge patch and minor updates (with CI passing)
- Major updates require manual review within 2 weeks
- No dependency > 1 major version behind
- Vulnerability patches applied within 48 hours (critical) or 1 week (high)

### Monitoring Code Health Trends

Publish weekly code health reports to make quality visible. Track: debt ratio, test coverage, outdated deps, circular deps, average complexity, lint warnings.

```bash
# CI job: weekly health report (runs every Monday, posts to Slack/Teams)
npm run lint -- --format json > lint-report.json
npx jest --coverage --json > coverage-report.json
npm outdated --json > outdated-report.json
npx madge --circular src/ > circular-deps.txt
# Aggregate and push to dashboard
```

### Prevention Culture

Build a team culture where quality is valued. Use **blameless quality discussions** -- ask "what process gap allowed this?" not "who wrote this?" Hold **debt post-mortems** after significant paydowns to identify prevention improvements.

### Preventing AI-Generated Debt

AI coding assistants (Copilot, Claude, ChatGPT) can generate debt rapidly if not managed.

```markdown
## AI Code Review Checklist
- [ ] Generated code follows project conventions (naming, structure, imports)
- [ ] No unnecessary dependencies added by AI suggestion
- [ ] Error handling is complete (AI often generates happy-path only)
- [ ] Types are correct and strict (AI may use `any` or loose types)
- [ ] No hardcoded values or magic numbers
- [ ] Tests cover the generated code (AI code is not inherently correct)
- [ ] Generated code does not duplicate existing utilities
- [ ] Performance implications reviewed (AI may generate naive implementations)
```

**Policy:** AI-generated code receives the same review rigor as human-written code. The committer owns all code in their PR, regardless of origin.

---

## Best Practices

1. **Automate every quality check that can be automated.** Linting, formatting, type checking, complexity limits, architecture rules, and dependency audits should all run without human intervention.

2. **Block merges on quality gate failure with zero exceptions.** The moment you allow "just this once," the gate loses its preventive power. If the gate is too strict, adjust the threshold -- do not bypass.

3. **Require ADRs for architectural decisions.** Architectural debt is the most expensive kind. A 30-minute design discussion prevents months of rework.

4. **Maintain a tech radar and enforce it.** Every new technology not on the radar requires a formal proposal. This prevents the "17 different HTTP clients" problem.

5. **Auto-update dependencies weekly with Renovate or Dependabot.** Dependency debt is silent until it explodes. Weekly minor/patch updates prevent major version cliffs.

6. **Include debt prevention in the Definition of Done.** "No new debt without a registered debt item" ensures deliberate decisions, not accidental accumulation.

7. **Run architectural fitness functions in CI.** Check layer boundaries, circular dependencies, and import rules on every PR. Architecture degrades one PR at a time.

8. **Review AI-generated code with the same rigor as human code.** AI accelerates coding but also accelerates debt if outputs are accepted uncritically.

9. **Publish weekly code health reports visible to the entire team.** Visibility creates accountability. When the team sees test coverage dropping, they self-correct.

10. **Hold debt post-mortems after paying down significant debt.** Use the retro to identify process gaps and prevent the same category of debt from recurring.

---

## Anti-Patterns

| Anti-Pattern                       | Problem                                          | Better Approach                         |
|------------------------------------|--------------------------------------------------|-----------------------------------------|
| Quality checks only in CI          | Slow feedback loop, wasted CI minutes            | Shift left: IDE + pre-commit + CI       |
| Quality gate bypass for deadlines  | Precedent set, gate becomes meaningless          | Adjust threshold or negotiate scope     |
| No architectural constraints       | Architecture degrades one PR at a time           | Fitness functions in CI                 |
| "Any dependency is fine"           | Tech stack sprawl, conflicting libraries         | Tech radar with formal adoption process |
| Accepting AI output without review | AI generates plausible but subtly wrong code     | Same review rigor as human-written code |
| Definition of Done is just "works" | Functional but unmaintainable code ships         | Quality criteria in DoD, enforced       |
| Manual formatting reviews          | Reviewer time wasted on style, not substance     | Autoformat on save and pre-commit       |
| TODO without tracking              | Comments become permanent debt                   | TODO must link to issue, lint rule enforces|

---

## Enforcement Checklist

- [ ] Pre-commit hooks configured for lint, format, and type-check
- [ ] Quality gate in CI blocks merge on coverage drop, new bugs, or new vulnerabilities
- [ ] Architectural fitness functions run on every PR (layer rules, circular deps)
- [ ] Tech radar maintained and enforced for technology adoption decisions
- [ ] Renovate or Dependabot configured for weekly automated dependency updates
- [ ] Definition of Done includes quality criteria (coverage, lint, types, docs)
- [ ] ADR process required for changes touching > 3 services or new dependencies
- [ ] AI-generated code review checklist in use by all reviewers
- [ ] Weekly code health report published and visible to the team
- [ ] Debt post-mortems conducted after significant debt paydown events
