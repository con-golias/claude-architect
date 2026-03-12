# Static Application Security Testing (SAST)

| Attribute      | Value                                                      |
|----------------|------------------------------------------------------------|
| Domain         | Testing > Security Testing                                 |
| Importance     | Critical                                                   |
| Last Updated   | 2026-03-10                                                 |
| Cross-ref      | `08-security/security-testing/sast.md` (comprehensive security perspective) |

---

## Core Concepts

### What Is SAST?

SAST analyzes source code, bytecode, or binaries **without executing the application** to identify security vulnerabilities. It operates on the code as written, tracing data flows from sources (user input) to sinks (dangerous functions) to detect injection flaws, hardcoded secrets, insecure configurations, and unsafe patterns.

### SAST from the Developer Perspective

Treat SAST as an extension of your linter, not as a security team gate. Integrate it into:
- **IDE**: Real-time feedback while coding (Semgrep LSP, SonarLint, CodeQL for VS Code).
- **Pre-commit hooks**: Block commits that introduce critical vulnerabilities.
- **Pull request checks**: Annotate PRs with findings inline.
- **CI pipeline**: Full scan with blocking thresholds.

### SAST vs Linting

| Dimension        | Linting                            | SAST                                  |
|------------------|------------------------------------|---------------------------------------|
| Focus            | Code style, simple bug patterns    | Security vulnerabilities              |
| Analysis depth   | Single-file, syntactic             | Cross-file, data-flow, taint tracking |
| False positives  | Low                                | Medium to high                        |
| Performance      | Fast (milliseconds)                | Slower (seconds to minutes)           |
| Examples         | ESLint, Pylint, golangci-lint      | Semgrep, CodeQL, Bandit, SonarQube    |

They are **complementary**. Run both. Do not replace one with the other.

### Tool Landscape

| Tool        | Languages              | Strengths                                    |
|-------------|------------------------|----------------------------------------------|
| Semgrep     | 30+ languages          | Fast, custom rules, CI-friendly, free tier   |
| CodeQL      | Java, JS/TS, Python, Go, C/C++ | Deep data-flow analysis, GitHub-native |
| SonarQube   | 30+ languages          | Dashboard, quality gates, enterprise features |
| Bandit      | Python                 | Python-specific, lightweight, well-maintained |
| ESLint security plugins | JavaScript/TypeScript | Integrates into existing ESLint workflow |

### False Positive Management

False positives erode developer trust. Manage them systematically:
1. **Inline suppression** with mandatory justification comment.
2. **Baseline file** that records known findings so new scans only report new issues.
3. **Triage workflow**: security champion reviews and classifies each finding as true positive, false positive, or accepted risk.

---

## Code Examples

### TypeScript: Custom Semgrep Rules for Project-Specific Patterns

```yaml
# .semgrep/custom-rules.yml
rules:
  - id: no-raw-sql-interpolation
    patterns:
      - pattern: |
          $DB.query(`...${$INPUT}...`)
      - pattern-not: |
          $DB.query(`...`, [$PARAMS])
    message: >
      Do not interpolate user input into SQL queries. Use parameterized
      queries with $DB.query(sql, [params]) to prevent SQL injection.
    severity: ERROR
    languages: [typescript, javascript]
    metadata:
      cwe: ["CWE-89"]
      owasp: ["A03:2021"]
      confidence: HIGH

  - id: no-hardcoded-jwt-secret
    patterns:
      - pattern: |
          jwt.sign($PAYLOAD, "...")
      - pattern: |
          jwt.verify($TOKEN, "...")
    message: >
      JWT secret is hardcoded. Load secrets from environment variables
      or a secret manager.
    severity: ERROR
    languages: [typescript, javascript]
    metadata:
      cwe: ["CWE-798"]

  - id: enforce-auth-middleware
    patterns:
      - pattern: |
          router.$METHOD($PATH, $HANDLER)
      - pattern-not: |
          router.$METHOD($PATH, authMiddleware, ...)
      - metavariable-regex:
          metavariable: $PATH
          regex: ^['\"]\/api\/(?!public).*
    message: >
      API routes under /api/ (except /api/public/) must use authMiddleware.
    severity: WARNING
    languages: [typescript, javascript]
    metadata:
      category: authorization
```

```typescript
// Example code that Semgrep rules catch:

// BAD: Raw SQL interpolation (caught by no-raw-sql-interpolation)
const userId = req.params.id;
const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`);

// GOOD: Parameterized query
const result = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);

// BAD: Hardcoded JWT secret (caught by no-hardcoded-jwt-secret)
const token = jwt.sign(payload, "my-super-secret-key");

// GOOD: Secret from environment
const token = jwt.sign(payload, process.env.JWT_SECRET!);
```

### Python: Bandit Configuration and Custom Checks

```ini
# .bandit.yml (or bandit section in setup.cfg)
[bandit]
# Skip specific test IDs
skips = B101
# Only run high-severity checks
severity = high
# Exclude test directories from scanning
exclude_dirs = tests,test,migrations
# Set confidence threshold
confidence = medium
```

```python
# custom_bandit_check.py
"""Custom Bandit plugin: detect unsafe deserialization patterns."""
import ast
import bandit
from bandit.core import issue as bandit_issue
from bandit.core import test_properties as test_props


@test_props.checks("Call")
@test_props.accepts_baseline
def detect_unsafe_deserialization(context: bandit.core.node_visitor._Context):
    """Flag pickle.loads and yaml.load without SafeLoader."""
    call = context.node

    # Detect pickle.loads usage
    if context.is_module_imported_exact("pickle"):
        if context.call_function_name == "loads":
            return bandit_issue.Issue(
                severity=bandit_issue.HIGH,
                confidence=bandit_issue.HIGH,
                cwe=bandit_issue.Cwe.DESERIALIZATION_OF_UNTRUSTED_DATA,
                text="pickle.loads is vulnerable to arbitrary code execution. "
                     "Use json.loads or a safe serialization format.",
                lineno=call.lineno,
            )

    # Detect yaml.load without SafeLoader
    if context.is_module_imported_exact("yaml"):
        if context.call_function_name == "load":
            kwargs = {kw.arg: kw.value for kw in call.keywords}
            if "Loader" not in kwargs:
                return bandit_issue.Issue(
                    severity=bandit_issue.HIGH,
                    confidence=bandit_issue.HIGH,
                    cwe=bandit_issue.Cwe.DESERIALIZATION_OF_UNTRUSTED_DATA,
                    text="yaml.load without Loader is unsafe. "
                         "Use yaml.safe_load or yaml.load(data, Loader=SafeLoader).",
                    lineno=call.lineno,
                )
```

```python
# Example code that Bandit catches:

# BAD: Unsafe deserialization
import pickle
data = pickle.loads(user_input)  # B301: pickle.loads detected

# GOOD: Safe alternative
import json
data = json.loads(user_input)

# BAD: yaml.load without SafeLoader
import yaml
config = yaml.load(file_content)  # B506: yaml.load detected

# GOOD: Safe YAML loading
config = yaml.safe_load(file_content)
```

### YAML: GitHub Actions Workflow for SAST in CI Pipeline

```yaml
# .github/workflows/sast.yml
name: SAST Analysis
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  semgrep:
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep:latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        run: |
          semgrep ci \
            --config=auto \
            --config=.semgrep/ \
            --sarif --output=semgrep-results.sarif \
            --error \
            --severity=ERROR
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

      - name: Upload SARIF results
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep-results.sarif

  codeql:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [javascript, python]
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: security-extended

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3

  bandit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Bandit
        uses: jpetrucciani/bandit-check@main
        with:
          bandit_flags: >
            -r src/
            --severity-level high
            --confidence-level medium
            -f sarif
            -o bandit-results.sarif

      - name: Upload SARIF results
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: bandit-results.sarif
```

### Inline Suppression with Justification

```typescript
// Semgrep suppression (requires justification)
// nosemgrep: no-raw-sql-interpolation -- query uses internal enum, not user input
const result = await db.query(`SELECT * FROM logs WHERE level = '${LogLevel.ERROR}'`);
```

```python
# Bandit suppression with justification
subprocess.run(
    cmd,
    shell=True  # nosec B602 -- cmd is constructed from validated internal config, not user input
)
```

---

## 10 Best Practices

1. **Run SAST in the IDE first.** Developers catch 60%+ of findings before they reach CI. Install Semgrep LSP or SonarLint.
2. **Start with auto-config, then customize.** Use `semgrep --config=auto` or CodeQL `security-extended` first, then add project-specific rules.
3. **Require justification for every suppression.** Bare `nosemgrep` or `nosec` without explanation must fail code review.
4. **Use baseline files for legacy codebases.** Avoid overwhelming teams with thousands of pre-existing findings. Fix them incrementally.
5. **Block merges only on high-severity, high-confidence findings.** Treat medium findings as warnings to avoid alert fatigue.
6. **Write custom rules for your organization's patterns.** Generic rules miss project-specific risks (custom auth patterns, internal APIs).
7. **Upload SARIF results to GitHub Security tab.** Centralize all SAST findings for tracking, triage, and trend analysis.
8. **Run SAST on every pull request, not just on main.** Shift left: catch issues before merge, not after.
9. **Review SAST rules quarterly.** Retire noisy rules, add new ones for recently discovered vulnerability patterns.
10. **Track false positive rate as a metric.** If it exceeds 30%, developers will ignore findings. Tune rules aggressively.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Running SAST only in a nightly pipeline | Developers discover issues days after writing the code | Run on every PR and in the IDE |
| Suppressing findings without justification | Hides real vulnerabilities; no audit trail | Enforce `nosemgrep: rule-id -- reason` pattern in code review |
| Treating all findings as blockers | Alert fatigue; developers bypass or ignore SAST | Block only on high-severity/high-confidence; warn on rest |
| Not customizing rules for the project | High false positive rate from generic rules | Write project-specific Semgrep or CodeQL rules |
| Running only one SAST tool | Gaps in coverage due to each tool's blind spots | Layer tools: Semgrep for speed + CodeQL for depth |
| Ignoring SAST results in code review | Findings accumulate; security debt grows unchecked | Make SAST check a required PR status check |
| Scanning test code with production rules | Floods dashboard with irrelevant findings from test fixtures | Exclude `tests/`, `__tests__/`, `*_test.go` directories |
| Never updating the baseline | New developers inherit suppressed vulnerabilities they do not understand | Review and shrink the baseline quarterly |

---

## Enforcement Checklist

- [ ] SAST runs on every pull request as a required status check
- [ ] At least two SAST tools are configured (e.g., Semgrep + CodeQL)
- [ ] IDE plugins (SonarLint, Semgrep LSP) are documented in onboarding guide
- [ ] Custom rules exist for project-specific security patterns
- [ ] All suppressions include a justification comment
- [ ] Baseline file exists for legacy code and is reviewed quarterly
- [ ] SARIF results upload to the GitHub Security tab (or equivalent dashboard)
- [ ] High-severity findings block merge; medium findings produce warnings
- [ ] Test directories are excluded from production SAST scans
- [ ] False positive rate is tracked and kept below 30%
- [ ] SAST rule configuration is version-controlled alongside application code
- [ ] Security champions triage new finding categories monthly
