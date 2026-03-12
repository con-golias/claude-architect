# 13 — Code Quality

> Write excellent code — enforce standards, measure quality, automate enforcement, and continuously improve through reviews, metrics, and modern AI-assisted tooling.

## Structure (9 folders, 28 files)

### coding-standards/ (4 files) — NEW
- [typescript-standards.md](coding-standards/typescript-standards.md) — Strict mode, utility types, discriminated unions, branded types, Result pattern, modern TS 5.x
- [python-standards.md](coding-standards/python-standards.md) — PEP 8, type hints, pattern matching, dataclasses, Ruff, async patterns, uv
- [go-standards.md](coding-standards/go-standards.md) — Effective Go, error handling, interfaces, goroutines, generics, slog, golangci-lint
- [naming-conventions.md](coding-standards/naming-conventions.md) — Variables, functions, classes, files, APIs, databases, config — cross-language comparison

### code-review/ (4 files)
- [best-practices.md](code-review/best-practices.md) — PR size, review time targets, comment taxonomy, Danger.js automation, stacked PRs
- [culture.md](code-review/culture.md) — Psychological safety, feedback language, Ship/Show/Ask, ownership models, async review
- [pr-templates.md](code-review/pr-templates.md) — Feature/bugfix/refactoring/dependency templates, conventional titles, auto-changelog
- [review-checklist.md](code-review/review-checklist.md) — Universal + 10 domain checklists (frontend, backend, API, DB, security, perf, arch, testing, docs, infra)

### documentation/ (4 files)
- [api-documentation.md](documentation/api-documentation.md) — OpenAPI 3.1, AsyncAPI, GraphQL docs, Swagger/Redocly, Spectral linting, SDK generation
- [architecture-docs.md](documentation/architecture-docs.md) — C4 model, diagrams-as-code (Mermaid, Structurizr, D2), tech radar, Backstage catalog
- [code-documentation.md](documentation/code-documentation.md) — JSDoc/TSDoc, Python docstrings, godoc, inline comments, documentation testing/linting
- [runbooks.md](documentation/runbooks.md) — Release, migration, dependency update, onboarding, feature flag runbooks, Taskfile-as-code

### linting-formatting/ (4 files)
- [eslint.md](linting-formatting/eslint.md) — ESLint v9 flat config, typescript-eslint v8, custom rules, plugins, monorepo setup, CI/SARIF
- [prettier.md](linting-formatting/prettier.md) — Opinionated formatting, plugins (Tailwind, imports), ESLint integration, Prettier vs Biome
- [language-specific-linters.md](linting-formatting/language-specific-linters.md) — Biome 2.0, Oxlint v1.0, Ruff, mypy/pyright, golangci-lint, Clippy, Stylelint
- [pre-commit-hooks.md](linting-formatting/pre-commit-hooks.md) — Husky v9, lint-staged, pre-commit framework, commitlint, Lefthook, monorepo hooks

### refactoring/ (2 files)
- [safe-refactoring.md](refactoring/safe-refactoring.md) — Safety nets, IDE refactorings, feature flags, Scientist pattern, DB/API refactoring, metrics
- [automated-refactoring.md](refactoring/automated-refactoring.md) — Codemods (jscodeshift, ts-morph, LibCST), OpenRewrite, large-scale changes, CI automation

### static-analysis/ (3 files)
- [sonarqube.md](static-analysis/sonarqube.md) — Quality profiles/gates, debt estimation, PR decoration, SonarLint, CI integration
- [codeql.md](static-analysis/codeql.md) — Semantic analysis, custom queries, GitHub Code Scanning, CodeQL vs Semgrep
- [type-checking.md](static-analysis/type-checking.md) — TS strict mode deep-dive, mypy vs pyright, Go type system, gradual typing strategy

### technical-debt/ (3 files)
- [measuring.md](technical-debt/measuring.md) — SQALE, SonarQube debt calculation, CodeScene hotspots, code churn, debt register, trend tracking
- [managing.md](technical-debt/managing.md) — Fowler quadrant, 20% rule, prioritization frameworks, stakeholder communication, debt ceiling
- [prevention.md](technical-debt/prevention.md) — Quality gates, architecture fitness functions, tech radar, dependency management, AI-generated debt

### code-metrics/ (2 files) — NEW
- [complexity-metrics.md](code-metrics/complexity-metrics.md) — Cyclomatic, cognitive, Halstead, maintainability index, coupling/cohesion, code churn, tools
- [quality-gates.md](code-metrics/quality-gates.md) — SonarQube gates, CI enforcement, custom gates (GitHub Actions), quality ratchet, fitness functions

### ai-code-quality/ (2 files) — NEW
- [ai-assisted-review.md](ai-code-quality/ai-assisted-review.md) — CodeRabbit, GitHub Copilot, review gap problem, AI+human workflow, trust calibration
- [writing-quality-code-with-ai.md](ai-code-quality/writing-quality-code-with-ai.md) — Prompt engineering, AI code review checklist, CLAUDE.md, AI pair programming patterns

## Cross-References

| Topic | This Section | Related Section |
|-------|-------------|----------------|
| Clean code theory | coding-standards/ | [01-fundamentals/clean-code/](../01-fundamentals/clean-code/) |
| ADR templates | — (removed, fully covered) | [03-architecture/decision-records/](../03-architecture/decision-records/) |
| Refactoring techniques | — (removed, fully covered) | [01-fundamentals/clean-code/10-refactoring/](../01-fundamentals/clean-code/10-refactoring/) |
| Technical debt fundamentals | — (theory covered) | [01-fundamentals/clean-code/08-code-smells/](../01-fundamentals/clean-code/08-code-smells/) |
| SAST for security | static-analysis/ (quality focus) | [08-security/security-testing/sast.md](../08-security/security-testing/sast.md) |
| CI pipeline integration | linting-formatting/pre-commit-hooks.md | [12-devops/ci-cd/pipeline-design.md](../12-devops-infrastructure/ci-cd/pipeline-design.md) |
| Incident runbooks | documentation/runbooks.md (dev ops) | [12-devops/incident-management/](../12-devops-infrastructure/incident-management/) |
| Documentation structure | documentation/ (content quality) | [04-project-structure/documentation-structure.md](../04-project-structure/) |

## Perspective Differentiation

| Section | Focus |
|---------|-------|
| 01-fundamentals | *What* is clean code — theory, principles, introductory |
| 08-security | Security vulnerabilities, threat detection |
| 11-testing | Developer testing workflow, CI test integration |
| 12-devops | Operations, incident response, production |
| **13-code-quality** | **How to enforce, measure, and automate quality — tools, configs, metrics, AI** |
