# Quality Gates

| Attribute       | Value                                                                                          |
|-----------------|------------------------------------------------------------------------------------------------|
| **Domain**      | Code Quality > Metrics                                                                         |
| **Importance**  | Critical                                                                                       |
| **Audience**    | All Engineers, Tech Leads, DevOps                                                              |
| **Last Updated**| 2026-03                                                                                        |
| **Cross-ref**   | [Complexity Metrics](complexity-metrics.md), [SonarQube](../static-analysis/sonarqube.md), [CI Pipeline Design](../../12-devops-infrastructure/ci-cd/pipeline-design.md) |

---

## Core Concepts

### What Is a Quality Gate

A quality gate is an automated pass/fail decision applied to code changes. It answers one question: **Is this code good enough to proceed?**

```text
Code Change --> Build --> Tests --> Lint --> Type Check --> Quality Gate --> Merge/Deploy
                                                              |
                                                     PASS: proceed
                                                     FAIL: block + report
```

Quality gates shift quality enforcement from manual code review to automated, objective, repeatable checks.

### SonarQube Quality Gates

**Built-in "Sonar Way" gate (applied to new code):**

| Condition                  | Operator | Value  |
|----------------------------|----------|--------|
| Coverage on new code       | >=       | 80%    |
| Duplicated lines on new code| <=      | 3%     |
| Maintainability rating     | =        | A      |
| Reliability rating         | =        | A      |
| Security rating            | =        | A      |
| Security hotspots reviewed | >=       | 100%   |

**Custom quality gate for strict teams:**

```text
# Custom gate: "Production Ready"
Conditions on new code:
  - Coverage >= 85%
  - Duplicated lines < 2%
  - Maintainability rating = A
  - Reliability rating = A
  - Security rating = A
  - Cognitive complexity per function <= 15
  - No new bugs (count = 0)
  - No new vulnerabilities (count = 0)
  - No new blocker/critical code smells
```

Evaluate quality gates on **new code** (focus on new code period) rather than overall project code. This enables incremental improvement -- legacy code is not held to the same standard as new code, preventing paralysis.

### CI Quality Gate Enforcement

**Fail pipeline on SonarQube gate failure:**

```yaml
# GitHub Actions -- SonarCloud with quality gate check
name: Quality Gate
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run tests with coverage
        run: npm test -- --coverage

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@v3
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Check Quality Gate
        uses: SonarSource/sonarqube-quality-gate-action@v1
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

Configure the quality gate check as a **required status check** on protected branches so PRs cannot merge when the gate fails.

### Beyond SonarQube: Alternative Quality Platforms

| Platform        | Strengths                                    | Pricing                  |
|-----------------|----------------------------------------------|--------------------------|
| **CodeClimate** | Maintainability, test coverage, duplication  | Free for OSS, paid tiers|
| **Codacy**      | Multi-language, security + quality           | Free for OSS             |
| **DeepSource**  | AI-powered autofix, fast analysis            | Free for OSS             |
| **Qodana**      | JetBrains ecosystem, deep inspections        | Free community edition   |

### Custom Quality Gates with GitHub Actions

Build multi-gate quality checks without third-party platforms:

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates
on:
  pull_request:
    branches: [main]

jobs:
  # Gate 1: Type checking
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx tsc --noEmit

  # Gate 2: Lint score
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx eslint src/ --max-warnings 0

  # Gate 3: Test coverage threshold
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test -- --coverage --coverageReporters=json-summary

      - name: Check coverage threshold
        run: |
          COVERAGE=$(node -e "
            const r = require('./coverage/coverage-summary.json');
            console.log(r.total.lines.pct);
          ")
          echo "Line coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "::error::Coverage ${COVERAGE}% is below 80% threshold"
            exit 1
          fi

  # Gate 4: Bundle size check
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npm run build
      - name: Check bundle size
        run: |
          SIZE=$(du -sk dist/ | cut -f1); MAX=512
          [ "$SIZE" -gt "$MAX" ] && echo "::error::Bundle ${SIZE}KB > ${MAX}KB" && exit 1

  # Gate 5: Dependency audit
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm audit --audit-level=high

  # Gate 6: Type coverage
  type-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npx type-coverage --at-least 90 --strict
```

### Definition of Done as Quality Gate

Embed quality criteria in user story acceptance criteria:

```markdown
## Definition of Done (Quality Criteria)

- [ ] All automated quality gates pass (CI green)
- [ ] Unit tests cover new code paths (>= 80% branch coverage)
- [ ] No new lint warnings introduced
- [ ] Type checking passes with strict mode
- [ ] Code reviewed and approved by at least 1 team member
- [ ] No TODO comments left without linked issue
- [ ] API changes documented (if applicable)
- [ ] Performance budget not exceeded (bundle size, response time)
```

### Code Review as Quality Gate

Code review is the human quality gate that catches what automation misses:

- **Required approvals** -- enforce minimum 1 approval (2 for critical paths) via branch protection rules.
- **CODEOWNERS** -- require approval from specific teams for specific directories.

```text
# .github/CODEOWNERS
# Require platform team approval for infrastructure
/infra/                     @org/platform-team
/src/auth/                  @org/security-team
*.proto                     @org/api-team
docker-compose*.yml         @org/devops-team
```

- **Automated review comments** -- combine human review with bot comments (SonarQube PR decoration, CodeQL alerts).

### Architecture Fitness Functions as Gates

Enforce architectural rules automatically:

**TypeScript (ts-arch):**

```typescript
// architecture.spec.ts
import { projectFiles, expect } from "ts-arch";

describe("Architecture rules", () => {
  it("domain layer should not depend on infrastructure", () => {
    const rule = projectFiles()
      .inFolder("src/domain")
      .shouldNot()
      .dependOnFiles()
      .inFolder("src/infrastructure");

    expect(rule).toPassAsync();
  });

  it("controllers should not import repositories directly", () => {
    const rule = projectFiles()
      .inFolder("src/controllers")
      .shouldNot()
      .dependOnFiles()
      .matchingPattern("*Repository*");

    expect(rule).toPassAsync();
  });
});
```

**Go (depguard in golangci-lint):**

```yaml
# .golangci.yml
linters:
  enable:
    - depguard

linters-settings:
  depguard:
    rules:
      domain-layer:
        files:
          - "**/domain/**"
        deny:
          - pkg: "database/sql"
            desc: "Domain layer must not import database packages"
          - pkg: "net/http"
            desc: "Domain layer must not import HTTP packages"
```

**Python (import-linter):**

```ini
# .importlinter
[importlinter]
root_packages = myapp

[importlinter:contract:layers]
name = Layered architecture
type = layers
layers =
    myapp.presentation
    myapp.application
    myapp.domain
    myapp.infrastructure
```

### Quality Ratchet Pattern

Only enforce quality rules on new or changed code, then gradually tighten:

```text
Sprint 1:  Coverage floor = 60% (current state)
Sprint 3:  Coverage floor = 65% (ratcheted up)
Sprint 5:  Coverage floor = 70%
Sprint 8:  Coverage floor = 75%
Sprint 12: Coverage floor = 80% (target)
```

**Implementation -- ratchet script (`scripts/quality_ratchet.py`):**

```python
import json, sys
from pathlib import Path

FLOOR = Path(".quality-floor.json")

def check_and_ratchet(metric: str, current: float) -> bool:
    floor = json.loads(FLOOR.read_text()) if FLOOR.exists() else {}
    stored = floor.get(metric, 0)
    if current < stored:
        print(f"FAIL: {metric} regressed from {stored} to {current}")
        return False
    if current > stored:
        floor[metric] = current
        FLOOR.write_text(json.dumps(floor, indent=2))
        print(f"RATCHET: {metric} improved {stored} -> {current}")
    return True

if __name__ == "__main__":
    sys.exit(0 if check_and_ratchet(sys.argv[1], float(sys.argv[2])) else 1)
```

```bash
# Usage in CI
python scripts/quality_ratchet.py coverage 82.5
python scripts/quality_ratchet.py type_coverage 91.0
```

### Measuring Gate Effectiveness

Track these metrics to ensure quality gates help rather than hinder:

| Metric                    | Target              | Why It Matters                              |
|---------------------------|---------------------|---------------------------------------------|
| **False positive rate**   | < 5%                | High FP rate erodes developer trust         |
| **Time to green**         | < 15 min            | Slow gates reduce iteration speed           |
| **Gate bypass rate**      | 0%                  | Bypasses indicate gate is too strict or broken |
| **Developer satisfaction**| >= 4/5              | Survey quarterly; gates should feel helpful |
| **Defect escape rate**    | Decreasing trend    | Fewer production bugs means gates work      |

### Quality Gate Dashboard and Reporting

Export Prometheus metrics from CI (`quality_gate_pass_total`, `quality_gate_fail_total`, `quality_gate_duration_seconds`, `quality_gate_bypass_total`) and build Grafana dashboards. Key PromQL queries:

- **Pass rate:** `quality_gate_pass_total / (quality_gate_pass_total + quality_gate_fail_total)`
- **Avg duration:** `avg(quality_gate_duration_seconds) by (project)`
- **Bypass alert:** `quality_gate_bypass_total > 0`

Aggregate results across repositories. Track trends weekly. Alert on bypass attempts.

---

## Best Practices

1. **Enforce gates on new code only** -- apply the "Clean as You Code" principle so legacy projects can adopt gates without being blocked by existing debt.
2. **Make gates non-bypassable on protected branches** -- configure branch protection rules to require all status checks to pass; no admin overrides for production branches.
3. **Keep gate execution under 15 minutes** -- slow gates discourage frequent commits; optimize by caching dependencies and running checks in parallel.
4. **Start lenient, ratchet up** -- begin with achievable thresholds and gradually tighten using the ratchet pattern to avoid developer resistance.
5. **Use multiple focused gates** -- separate gates (lint, type check, coverage, bundle size, security) rather than one monolithic check for clear failure reasons.
6. **Combine automated and human gates** -- automated gates catch objective violations; code review catches design, naming, and logic issues.
7. **Enforce CODEOWNERS for sensitive paths** -- require domain experts to approve changes to authentication, payments, infrastructure, and API contracts.
8. **Track false positive rate** -- if developers consistently complain about gate failures on correct code, adjust thresholds or fix detection rules.
9. **Include architecture fitness functions** -- enforce dependency rules and layer boundaries as automated gates, not just in documentation.
10. **Report gate metrics to leadership** -- show trend data (pass rate, defect escape rate, time to green) to demonstrate ROI of quality investment.

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                               | Correction                                          |
|----|---------------------------------------|-------------------------------------------------------|-----------------------------------------------------|
| 1  | Gate on overall code, not new code    | Legacy debt blocks all PRs from day one               | Apply gates to new code period only                 |
| 2  | Admin bypass on production branches   | Undermines entire quality system when used             | Remove admin bypass; fix the underlying issue       |
| 3  | Single monolithic gate check          | Failure message unclear; developers cannot triage      | Separate gates per concern with clear names          |
| 4  | 100% coverage requirement             | Forces meaningless tests, slows development            | Set 80% for new code; focus on meaningful tests     |
| 5  | Gates without dashboard               | No visibility into trends or effectiveness             | Build dashboard tracking pass rate, duration, escapes|
| 6  | Ignoring developer feedback on gates  | Overly strict gates cause frustration and workarounds  | Survey quarterly; adjust thresholds based on data   |
| 7  | No ratchet mechanism                  | Quality threshold never increases over time            | Implement ratchet pattern; increase floor quarterly |
| 8  | Gates only in CI, not in IDE          | Developers discover issues late in the feedback loop   | Enable SonarLint, ESLint, type checkers in IDE      |

---

## Enforcement Checklist

- [ ] SonarQube/SonarCloud quality gate configured with recommended conditions (coverage >= 80%, 0 bugs, 0 vulns, maintainability A).
- [ ] Quality gate set as required status check on all protected branches.
- [ ] CI pipeline fails on quality gate failure (non-bypassable).
- [ ] Custom quality gates implemented for: lint (0 warnings), type check (pass), bundle size (under budget).
- [ ] CODEOWNERS file configured for critical directories (auth, infra, API contracts).
- [ ] Branch protection requires minimum 1 approval (2 for critical paths).
- [ ] Architecture fitness functions run as CI gate (dependency rules enforced).
- [ ] Quality ratchet mechanism in place for coverage and type coverage floors.
- [ ] Gate execution time monitored and kept under 15 minutes.
- [ ] Quality gate dashboard deployed, tracking pass rate, false positive rate, defect escape rate, and developer satisfaction.
