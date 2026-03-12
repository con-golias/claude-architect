# SonarQube and SonarCloud

| Attribute       | Value                                                                                          |
|-----------------|------------------------------------------------------------------------------------------------|
| **Domain**      | Code Quality > Static Analysis                                                                 |
| **Importance**  | High                                                                                           |
| **Audience**    | Backend, Frontend, DevOps Engineers                                                            |
| **Last Updated**| 2026-03                                                                                        |
| **Cross-ref**   | [CodeQL](codeql.md), [Quality Gates](../code-metrics/quality-gates.md), [08-security SAST](../../08-security/security-testing/sast.md) |

---

## Core Concepts

### Architecture Overview

SonarQube operates as a three-tier system:

1. **Scanner** -- runs in CI, analyzes source code, sends results to server.
2. **Server** -- processes reports, stores results, serves web UI, enforces quality gates.
3. **Database** -- PostgreSQL (recommended), stores project history, rules, quality profiles.

```text
Developer --> CI Pipeline --> SonarScanner --> SonarQube Server --> PostgreSQL
                                                    |
                                              Web Dashboard
                                                    |
                                              PR Decoration
```

SonarCloud is the SaaS-hosted variant -- no server/database management required. Prefer SonarCloud for open-source projects and teams avoiding self-hosting.

### Quality Model (Five Dimensions)

| Dimension          | Measures                              | Rating Scale    |
|--------------------|---------------------------------------|-----------------|
| **Reliability**    | Bugs (code defects)                   | A-E (A = 0 bugs)|
| **Security**       | Vulnerabilities                       | A-E             |
| **Maintainability**| Code smells, technical debt ratio     | A-E             |
| **Coverage**       | Unit test line/branch coverage        | Percentage       |
| **Duplications**   | Duplicated lines/blocks               | Percentage       |

> **Note:** For deep security analysis (SQL injection, XSS, hardcoded secrets), see [08-security SAST](../../08-security/security-testing/sast.md). This file focuses on code quality dimensions.

### Quality Profiles

Quality profiles define which rules apply to a project for a given language.

```text
# Profile inheritance hierarchy
Sonar Way (built-in, default)
  └── Company Base Profile (extends Sonar Way)
       ├── Team A Strict Profile (adds rules)
       └── Team B Relaxed Profile (removes rules)
```

- **Create custom profiles** by copying Sonar Way and adjusting rule severity.
- **Inherit profiles** to build layered rule sets (base company rules + team overrides).
- **Rule severity levels:** Blocker > Critical > Major > Minor > Info.
- Assign profiles per project or globally as default for a language.

### Quality Gates

Quality gates define pass/fail conditions applied after analysis.

**Recommended "Clean as You Code" gate (new code only):**

| Condition                  | Operator | Value  |
|----------------------------|----------|--------|
| New code coverage          | >=       | 80%    |
| New duplicated lines       | <=       | 3%     |
| New bugs                   | =        | 0      |
| New vulnerabilities        | =        | 0      |
| Maintainability rating     | =        | A      |
| Reliability rating         | =        | A      |
| Security rating            | =        | A      |
| Security hotspots reviewed | >=       | 100%   |

Apply quality gates on **new code** (new code period) rather than overall code to enable incremental improvement without blocking legacy projects.

### Rules Categories

| Category              | Definition                                      | Example                                     |
|-----------------------|-------------------------------------------------|---------------------------------------------|
| **Bug**               | Code that is demonstrably wrong                 | Null dereference, infinite loop              |
| **Vulnerability**     | Code open to exploitation                       | SQL injection, path traversal                |
| **Code Smell**        | Maintainability issue, not a bug                | Long method, deep nesting, magic numbers     |
| **Security Hotspot**  | Security-sensitive code needing manual review    | Crypto usage, regex in user input            |

### Scanner Integration

**sonar-project.properties (root of project):**

```properties
sonar.projectKey=my-org_my-project
sonar.organization=my-org
sonar.sources=src
sonar.tests=tests
sonar.exclusions=**/node_modules/**,**/dist/**,**/*.spec.ts
sonar.test.inclusions=**/*.spec.ts,**/*.test.ts
sonar.typescript.lcov.reportPaths=coverage/lcov.info
sonar.python.coverage.reportPaths=coverage.xml
sonar.go.coverage.reportPaths=coverage.out
sonar.sourceEncoding=UTF-8
```

**GitHub Actions workflow for SonarCloud:**

```yaml
# .github/workflows/sonar.yml
name: SonarCloud Analysis
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  sonar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for accurate blame/new code

      - name: Install dependencies and run tests
        run: |
          npm ci
          npm run test -- --coverage

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@v3
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          args: >
            -Dsonar.projectKey=my-org_my-project
            -Dsonar.organization=my-org
```

### Language-Specific Configuration

**TypeScript/JavaScript key rules:**
- `typescript:S3776` -- Cognitive complexity of functions should not be too high.
- `typescript:S1854` -- Unused assignments should be removed.
- `typescript:S4325` -- Unnecessary type assertions should not be used.
- `typescript:S1128` -- Unused imports should be removed.
- `typescript:S3515` -- Functions should not return values assigned and declared on the same line.

**Python key rules:**
- `python:S3776` -- Cognitive complexity threshold.
- `python:S1542` -- Functions should not be named with a leading underscore unless private.
- `python:S5754` -- Bare `raise` outside of `except` block.
- `python:S930` -- Function parameters count should not exceed threshold.

**Go key rules:**
- `go:S3776` -- Cognitive complexity.
- `go:S1186` -- Empty functions with body.
- `go:S2737` -- Catch clauses should do more than rethrow.
- `go:S1135` -- TODO comments should be tracked.

### PR Decoration

SonarQube/SonarCloud annotates pull requests with inline comments on new issues:

- **GitHub** -- native integration via GitHub App (SonarCloud) or webhook (SonarQube).
- **GitLab** -- merge request decoration.
- **Azure DevOps** -- PR decoration with build status.
- **Bitbucket** -- code annotations on PR diffs.

Configure PR decoration to surface issues where developers review code, reducing context-switch cost.

### Branch Analysis and New Code Period

- **New code period** -- define baseline: previous version, number of days, specific date, or reference branch.
- **Branch analysis** -- analyze feature branches separately; compare against target branch.
- **Recommended:** Use reference branch (main/develop) as new code period for PRs.

### Technical Debt Estimation

SonarQube calculates remediation effort (time to fix) for each issue:

```text
Technical Debt Ratio = (Remediation Cost / Development Cost) x 100

Rating:
  A = 0-5%    (minimal debt)
  B = 6-10%
  C = 11-20%
  D = 21-50%
  E = 51-100% (critical debt)
```

Use the technical debt dashboard to prioritize refactoring by file, module, or issue type.

### SonarLint IDE Integration

SonarLint provides real-time analysis in IDE before code reaches CI:

- **Connected mode** -- syncs rules from SonarQube/SonarCloud server.
- **Supported IDEs:** VS Code, IntelliJ, Eclipse, Visual Studio.
- Catches issues as developers type, reducing feedback loop from minutes to seconds.

```json
// VS Code settings.json - SonarLint connected mode
{
  "sonarlint.connectedMode.connections.sonarcloud": [
    {
      "organizationKey": "my-org",
      "token": "${env:SONAR_TOKEN}"
    }
  ],
  "sonarlint.connectedMode.project": {
    "connectionId": "my-org",
    "projectKey": "my-org_my-project"
  }
}
```

---

## Best Practices

1. **Enforce "Clean as You Code"** -- apply quality gates only on new code to allow incremental improvement without blocking legacy codebases.
2. **Use SonarLint in connected mode** -- synchronize IDE analysis with server rules so developers see the same issues locally before pushing.
3. **Customize quality profiles per language** -- inherit from Sonar Way, add project-specific rules, disable irrelevant ones with documented justification.
4. **Set quality gate as CI gatekeeper** -- fail the pipeline when the quality gate fails; never allow manual overrides in production branches.
5. **Exclude generated code and vendor directories** -- configure `sonar.exclusions` to avoid noise from auto-generated files, `node_modules`, `vendor/`.
6. **Review security hotspots regularly** -- assign hotspot review as part of sprint ceremonies; track review completion percentage.
7. **Use branch analysis for PRs** -- analyze every PR against the target branch to catch issues before merge.
8. **Track technical debt trends** -- monitor debt ratio over time in dashboards; set alerts when debt ratio exceeds threshold.
9. **Fetch full git history in CI** -- use `fetch-depth: 0` in checkout to enable accurate blame data and new code detection.
10. **Integrate PR decoration** -- enable inline issue comments on PRs to surface findings in code review context.

---

## Anti-Patterns

| #  | Anti-Pattern                        | Problem                                              | Correction                                          |
|----|-------------------------------------|------------------------------------------------------|-----------------------------------------------------|
| 1  | Ignoring quality gate failures      | Technical debt accumulates unchecked                 | Enforce gate as mandatory CI check                  |
| 2  | Analyzing only main branch          | Issues discovered after merge, too late              | Enable branch analysis for all PRs                  |
| 3  | Using default profile without review| Rules may not match team conventions                 | Create customized profile inheriting from Sonar Way |
| 4  | Suppressing issues with comments    | Hides real problems from metrics                     | Fix root cause; use suppression only for false positives |
| 5  | Setting coverage gate at 100%       | Unrealistic target, blocks productive work           | Set 80% for new code; increase gradually            |
| 6  | Shallow git clone in CI             | Blame data missing, new code detection fails         | Use `fetch-depth: 0` in checkout step               |
| 7  | No exclusion for generated code     | Inflates issue count with unfixable findings         | Configure sonar.exclusions for generated/vendor dirs|
| 8  | Running SonarQube without database backup | Data loss on server failure                     | Schedule daily PostgreSQL backups; test restore      |

---

## Enforcement Checklist

- [ ] SonarCloud/SonarQube project configured with `sonar-project.properties` in repository root.
- [ ] Quality gate set with conditions: coverage >= 80%, 0 new bugs, 0 new vulnerabilities, maintainability A.
- [ ] CI pipeline runs SonarScanner on every PR and push to main.
- [ ] Pipeline fails on quality gate failure (non-bypassable for protected branches).
- [ ] PR decoration enabled for inline issue comments.
- [ ] Custom quality profile created and assigned (inheriting from Sonar Way).
- [ ] `sonar.exclusions` configured for generated code, vendor directories, test fixtures.
- [ ] SonarLint installed by all team members in connected mode.
- [ ] Technical debt dashboard reviewed in sprint retrospectives.
- [ ] Security hotspot review percentage tracked and maintained at 100% for new code.
