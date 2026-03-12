# Static Application Security Testing (SAST)

## Metadata
- **Category:** Security Testing
- **Scope:** Source code analysis, vulnerability detection before runtime
- **Audience:** Software engineers, security engineers, DevSecOps practitioners
- **Prerequisites:** Familiarity with at least one programming language, CI/CD basics
- **Last Updated:** 2025-01

---

## 1. How SAST Works

Static Application Security Testing analyzes source code, bytecode, or binary code
without executing the application. SAST operates on the principle that many security
vulnerabilities manifest as identifiable patterns in code structure and data flow.

### 1.1 Abstract Syntax Tree (AST) Analysis

The compiler or parser converts source code into a tree representation of its
syntactic structure. SAST tools traverse this tree to detect insecure constructs.

```
Source Code:            AST Representation:

eval(userInput)   -->   CallExpression
                        +-- callee: Identifier("eval")
                        +-- arguments:
                            +-- Identifier("userInput")
```

AST-based rules look for specific node patterns. For example, a rule detecting
`eval()` usage scans the AST for `CallExpression` nodes where the callee is `eval`.

### 1.2 Data Flow Analysis

Data flow analysis tracks how data moves through a program, from sources (user inputs)
to sinks (dangerous functions). The analysis constructs a data flow graph (DFG) that
maps variable assignments, function calls, and transformations.

```
Source (user input)
    |
    v
Variable assignment: query = request.params["q"]
    |
    v
Transformation: query = query.strip()
    |
    v
Sink (SQL query): cursor.execute("SELECT * FROM users WHERE name = '" + query + "'")
```

Data flow analysis identifies that user input reaches a SQL query without
parameterization, flagging a SQL injection vulnerability.

### 1.3 Taint Tracking

Taint tracking is a specialized form of data flow analysis. Data entering from
external sources (HTTP requests, file reads, environment variables) is marked as
"tainted." The analysis follows tainted data through the program, tracking whether
it passes through sanitization functions ("taint cleansing") before reaching
security-sensitive operations.

```python
# Taint source: user input
username = request.form["username"]  # TAINTED

# Taint propagation: string concatenation preserves taint
query = "SELECT * FROM users WHERE name = '" + username + "'"  # STILL TAINTED

# Taint sink: database query with tainted data
cursor.execute(query)  # VULNERABILITY: tainted data reaches sink

# Versus safe version:
cursor.execute("SELECT * FROM users WHERE name = %s", (username,))  # CLEANSED
```

### 1.4 Pattern Matching

The simplest SAST technique uses regex or structural patterns to find known
insecure code constructs. While less precise than data flow analysis, pattern
matching is fast and easy to customize.

```yaml
# Example: detect hardcoded passwords
pattern: |
  password\s*=\s*["'][^"']+["']
```

Pattern matching excels at finding:
- Hardcoded credentials
- Use of deprecated/insecure functions (e.g., `MD5`, `DES`, `strcpy`)
- Missing security headers
- Insecure configurations

---

## 2. SAST Tools

### 2.1 Semgrep

Semgrep is a fast, open-source SAST tool that supports 30+ languages. It uses
pattern-based analysis with a lightweight, intuitive rule syntax.

**Installation and basic usage:**

```bash
# Install Semgrep
pip install semgrep

# Run with default rulesets
semgrep --config auto .

# Run with specific rulesets
semgrep --config p/owasp-top-ten .
semgrep --config p/security-audit .

# Run with a custom rule file
semgrep --config my-rules.yaml .

# Scan specific files or directories
semgrep --config auto src/

# Output in SARIF format for CI integration
semgrep --config auto --sarif --output results.sarif .
```

**Writing custom Semgrep rules:**

```yaml
# custom-rules/sql-injection.yaml
rules:
  - id: python-sql-injection
    pattern: |
      cursor.execute("..." + $USER_INPUT + "...")
    message: >
      Possible SQL injection. User input is concatenated into a SQL query.
      Use parameterized queries instead.
    languages: [python]
    severity: ERROR
    metadata:
      cwe:
        - "CWE-89: SQL Injection"
      owasp:
        - "A03:2021 - Injection"
      confidence: HIGH

  - id: python-sql-injection-fstring
    pattern: |
      cursor.execute(f"...{$USER_INPUT}...")
    message: >
      Possible SQL injection via f-string. Use parameterized queries.
    languages: [python]
    severity: ERROR

  - id: hardcoded-jwt-secret
    patterns:
      - pattern: |
          jwt.encode($PAYLOAD, "...", ...)
      - pattern-not: |
          jwt.encode($PAYLOAD, $CONFIG, ...)
    message: >
      JWT secret is hardcoded. Load secrets from environment variables
      or a secrets manager.
    languages: [python]
    severity: WARNING
```

**Advanced Semgrep patterns:**

```yaml
rules:
  # Taint tracking rule
  - id: xss-flask-response
    mode: taint
    pattern-sources:
      - patterns:
          - pattern: request.$METHOD.get(...)
          - metavariable-regex:
              metavariable: $METHOD
              regex: (args|form|values|headers|cookies)
    pattern-sinks:
      - pattern: flask.make_response($SINK, ...)
    pattern-sanitizers:
      - pattern: bleach.clean(...)
      - pattern: markupsafe.escape(...)
    message: >
      User input flows into an HTTP response without sanitization.
      This may lead to XSS.
    languages: [python]
    severity: ERROR

  # Metavariable comparison
  - id: weak-rsa-key
    pattern: |
      rsa.generate_private_key(public_exponent=65537, key_size=$KEY_SIZE, ...)
    metavariable-comparison:
      metavariable: $KEY_SIZE
      comparison: $KEY_SIZE < 2048
    message: >
      RSA key size $KEY_SIZE is too small. Use at least 2048 bits.
    languages: [python]
    severity: ERROR
```

### 2.2 CodeQL (GitHub)

CodeQL treats code as data by building a relational database from the codebase.
You write queries in QL (a declarative, object-oriented query language) to find
vulnerability patterns.

**Setting up CodeQL:**

```yaml
# .github/workflows/codeql-analysis.yml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '30 6 * * 1'  # Weekly Monday analysis

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    strategy:
      matrix:
        language: ['javascript', 'python', 'java']

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: +security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

**Writing custom CodeQL queries:**

```ql
/**
 * @name SQL injection from user input
 * @description Building SQL queries from user-controlled input allows
 *              SQL injection attacks.
 * @kind path-problem
 * @problem.severity error
 * @security-severity 9.8
 * @precision high
 * @id py/sql-injection-custom
 * @tags security
 *       external/cwe/cwe-089
 */

import python
import semmle.python.dataflow.new.DataFlow
import semmle.python.dataflow.new.TaintTracking
import semmle.python.Concepts

class SqlInjectionConfig extends TaintTracking::Configuration {
  SqlInjectionConfig() { this = "SqlInjectionConfig" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource
  }

  override predicate isSink(DataFlow::Node sink) {
    exists(SqlExecution sqlExec |
      sink = sqlExec.getSql()
    )
  }
}

from SqlInjectionConfig config, DataFlow::PathNode source, DataFlow::PathNode sink
where config.hasFlowPath(source, sink)
select sink.getNode(), source, sink,
  "This SQL query depends on a $@.", source.getNode(), "user-provided value"
```

### 2.3 SonarQube

SonarQube combines code quality analysis with security scanning.

**Docker setup for local SonarQube:**

```bash
# Start SonarQube server
docker run -d --name sonarqube \
  -p 9000:9000 \
  -v sonarqube_data:/opt/sonarqube/data \
  -v sonarqube_extensions:/opt/sonarqube/extensions \
  sonarqube:community

# Install sonar-scanner
npm install -g sonarqube-scanner
```

**Project configuration:**

```properties
# sonar-project.properties
sonar.projectKey=my-project
sonar.projectName=My Project
sonar.sources=src
sonar.tests=tests
sonar.language=py
sonar.sourceEncoding=UTF-8

# Security-specific settings
sonar.security.hotspots.reviewed=true

# Exclusions
sonar.exclusions=**/node_modules/**,**/vendor/**,**/*.test.js
sonar.coverage.exclusions=**/tests/**

# Quality gate
sonar.qualitygate.wait=true
```

**CI integration:**

```yaml
# .github/workflows/sonarqube.yml
name: SonarQube Analysis
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: sonarsource/sonarqube-scan-action@v2
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
      - uses: sonarsource/sonarqube-quality-gate-action@v1
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### 2.4 Language-Specific SAST Tools

**Bandit (Python):**

```bash
# Install
pip install bandit

# Run on a project
bandit -r src/ -f json -o bandit-report.json

# Run with specific severity
bandit -r src/ -ll  # Only medium and above

# Skip specific tests
bandit -r src/ -s B101,B601

# Configuration file
# .bandit
[bandit]
exclude = tests,docs
skips = B101
```

```ini
# pyproject.toml Bandit configuration
[tool.bandit]
exclude_dirs = ["tests", "docs"]
skips = ["B101"]  # Skip assert warnings
targets = ["src"]
```

**gosec (Go):**

```bash
# Install
go install github.com/securego/gosec/v2/cmd/gosec@latest

# Run on a project
gosec ./...

# Output in SARIF format
gosec -fmt sarif -out results.sarif ./...

# Exclude specific rules
gosec -exclude=G104,G304 ./...

# Scan specific packages
gosec -include=G101,G201,G202 ./...
```

**ESLint security plugins (JavaScript/TypeScript):**

```bash
# Install security plugins
npm install --save-dev eslint-plugin-security eslint-plugin-no-unsanitized
```

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['security', 'no-unsanitized'],
  extends: [
    'plugin:security/recommended-legacy',
  ],
  rules: {
    // Detect potential SQL injection
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'warn',

    // Prevent innerHTML and similar
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',
  },
};
```

**SpotBugs with FindSecBugs (Java):**

```xml
<!-- pom.xml -->
<build>
  <plugins>
    <plugin>
      <groupId>com.github.spotbugs</groupId>
      <artifactId>spotbugs-maven-plugin</artifactId>
      <version>4.8.3</version>
      <configuration>
        <effort>Max</effort>
        <threshold>Low</threshold>
        <failOnError>true</failOnError>
        <plugins>
          <plugin>
            <groupId>com.h3xstream.findsecbugs</groupId>
            <artifactId>findsecbugs-plugin</artifactId>
            <version>1.13.0</version>
          </plugin>
        </plugins>
      </configuration>
      <executions>
        <execution>
          <goals>
            <goal>check</goal>
          </goals>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>
```

**Roslyn Analyzers (C#):**

```xml
<!-- .csproj -->
<ItemGroup>
  <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" Version="8.0.0">
    <PrivateAssets>all</PrivateAssets>
    <IncludeAssets>runtime; build; native; contentfiles; analyzers</IncludeAssets>
  </PackageReference>
  <PackageReference Include="SecurityCodeScan.VS2019" Version="5.6.7">
    <PrivateAssets>all</PrivateAssets>
  </PackageReference>
</ItemGroup>
```

```xml
<!-- .editorconfig for security rules -->
[*.cs]
# SQL Injection
dotnet_diagnostic.SCS0002.severity = error
# XSS
dotnet_diagnostic.SCS0029.severity = error
# Path Traversal
dotnet_diagnostic.SCS0018.severity = error
# Weak Hashing
dotnet_diagnostic.SCS0006.severity = error
# Hardcoded Password
dotnet_diagnostic.SCS0015.severity = error
```

---

## 3. CI Integration

### 3.1 PR Comments with SAST Findings

```yaml
# .github/workflows/sast-pr.yml
name: SAST PR Review
on:
  pull_request:
    branches: [main, develop]

jobs:
  semgrep:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/secrets
          generateSarif: true
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep.sarif
        if: always()
```

### 3.2 Blocking Merges on Critical Findings

```yaml
# .github/workflows/sast-gate.yml
name: SAST Quality Gate
on:
  pull_request:
    branches: [main]

jobs:
  sast-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep with severity filter
        run: |
          pip install semgrep
          semgrep --config p/security-audit \
            --severity ERROR \
            --error \
            --json \
            --output semgrep-results.json \
            .

      - name: Check for critical findings
        if: failure()
        run: |
          echo "SAST found critical security issues. Merge blocked."
          echo "Review findings in the SARIF upload or run locally:"
          echo "  semgrep --config p/security-audit ."
          exit 1
```

### 3.3 Incremental Scanning

Scan only files changed in a PR to reduce scan time:

```yaml
# .github/workflows/sast-incremental.yml
name: Incremental SAST
on:
  pull_request:

jobs:
  incremental-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get changed files
        id: changed
        run: |
          FILES=$(git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep -E '\.(py|js|ts|java|go|cs)$' \
            | tr '\n' ' ')
          echo "files=$FILES" >> $GITHUB_OUTPUT

      - name: Run Semgrep on changed files only
        if: steps.changed.outputs.files != ''
        run: |
          pip install semgrep
          semgrep --config p/security-audit ${{ steps.changed.outputs.files }}
```

---

## 4. False Positive Management

### 4.1 Suppression Mechanisms

**Inline suppression (Semgrep):**

```python
# nosemgrep: python-sql-injection
cursor.execute(hardcoded_safe_query)
```

**Inline suppression (Bandit):**

```python
import subprocess
subprocess.call(cmd, shell=True)  # nosec B602 - cmd is a constant
```

**Suppression file (Semgrep):**

```yaml
# .semgrepignore
# Ignore test files
tests/
*_test.py
test_*.py

# Ignore generated code
generated/
*.generated.go

# Ignore specific vendored files
vendor/legacy-lib/
```

### 4.2 Triage Workflow

Establish a structured process for handling SAST findings:

```
1. Finding reported by SAST tool
   |
2. Auto-classified by severity (Critical, High, Medium, Low)
   |
3. Assigned to code owner (via CODEOWNERS)
   |
4. Developer reviews finding
   |
   +-- True positive --> Fix and close
   |
   +-- False positive --> Suppress with comment explaining why
   |
   +-- Needs investigation --> Assign to security team
   |
5. Security team reviews suppressions quarterly
```

**Tracking suppressions:**

```yaml
# .sast-suppressions.yaml (custom tracking file)
suppressions:
  - rule: python-sql-injection
    file: src/legacy/reports.py
    line: 45
    reason: "Query uses only internal constants, no user input"
    approved_by: security-team
    approved_date: 2025-01-15
    review_date: 2025-07-15

  - rule: hardcoded-password
    file: src/tests/test_auth.py
    line: 12
    reason: "Test credential for unit tests, not used in production"
    approved_by: dev-lead
    approved_date: 2025-01-10
    review_date: 2025-07-10
```

---

## 5. SAST Limitations

Understand what SAST cannot do:

| Limitation | Explanation |
|---|---|
| Runtime behavior | Cannot detect issues arising from runtime state, environment configuration, or deployed infrastructure |
| Authentication logic | Cannot validate that authentication flows are correct at a business-logic level |
| Race conditions | Difficulty detecting timing-dependent vulnerabilities in concurrent code |
| Configuration issues | Cannot assess server configurations, network settings, or cloud permissions |
| Third-party libraries | Limited insight into compiled dependencies (see SCA tools) |
| Context sensitivity | May not understand business context that makes a pattern safe or dangerous |
| Dynamic features | Reflection, metaprogramming, dynamic code loading reduce analysis accuracy |
| Encrypted/obfuscated code | Cannot analyze code it cannot parse |

Mitigate limitations by combining SAST with DAST, SCA, and manual penetration testing.

---

## 6. IDE Integration for Real-Time Feedback

### 6.1 Semgrep in VS Code

```json
// .vscode/settings.json
{
  "semgrep.scan.configuration": [
    "p/security-audit",
    ".semgrep/"
  ],
  "semgrep.scan.onSave": true,
  "semgrep.scan.onOpen": true
}
```

### 6.2 SonarLint in IntelliJ

```xml
<!-- .idea/sonarlint.xml -->
<component name="SonarLintProjectSettings">
  <option name="bindingEnabled" value="true" />
  <option name="projectKey" value="my-project" />
  <option name="serverId" value="my-sonarqube" />
</component>
```

### 6.3 Roslyn Analyzers in Visual Studio

Roslyn analyzers run automatically in Visual Studio when added to the project.
Configure severity levels in `.editorconfig` as shown in Section 2.4 above.

---

## 7. Comprehensive CI Pipeline Example

```yaml
# .github/workflows/full-sast-pipeline.yml
name: Full SAST Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main, develop]

jobs:
  semgrep:
    name: Semgrep Analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep Scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/secrets
            .semgrep/custom-rules/
          generateSarif: true
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep.sarif
        if: always()

  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    strategy:
      matrix:
        language: [javascript, python]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: +security-extended
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3

  language-specific:
    name: Language-Specific Scanners
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Bandit (Python)
        run: |
          pip install bandit
          bandit -r src/ -f json -o bandit-results.json --severity-level medium || true

      - name: ESLint Security (JS/TS)
        run: |
          npm ci
          npx eslint --no-eslintrc -c .eslintrc.security.js src/ \
            -f json -o eslint-security-results.json || true

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: sast-results
          path: |
            bandit-results.json
            eslint-security-results.json

  gate:
    name: Security Gate
    needs: [semgrep, codeql, language-specific]
    runs-on: ubuntu-latest
    steps:
      - name: Evaluate findings
        run: |
          echo "All SAST scans completed. Review findings in Security tab."
```

---

## 8. Metrics and Reporting

Track SAST effectiveness over time:

```
Key Metrics:
- Total findings by severity (Critical, High, Medium, Low)
- False positive rate (false positives / total findings)
- Mean time to remediate (MTTR) for each severity
- Findings per 1000 lines of code (density)
- Suppression count and age
- Coverage: percentage of codebase scanned
- New findings introduced per sprint
```

---

## 9. Best Practices

1. **Start with high-confidence rules.** Enable rules with low false-positive rates
   first. Gradually expand coverage as the team adapts. A flood of false positives
   causes developers to ignore all findings.

2. **Integrate SAST in the IDE, not just CI.** Developers fix issues faster when
   they see them during coding. IDE plugins for Semgrep, SonarLint, or Roslyn
   analyzers provide immediate feedback before code reaches the repository.

3. **Use incremental scanning for pull requests.** Full codebase scans belong on
   the main branch or nightly builds. PR scans should focus on changed files to
   keep feedback loops under 5 minutes.

4. **Write custom rules for your domain.** Generic rulesets miss organization-specific
   patterns (internal APIs, custom sanitization functions, proprietary frameworks).
   Invest in Semgrep YAML or CodeQL queries tailored to your codebase.

5. **Establish a triage workflow with clear ownership.** Every finding must be
   assigned to a person or team. Define SLAs: critical findings fixed within 48 hours,
   high within one sprint, medium within one quarter.

6. **Track and review suppressions.** Every suppressed finding must include a written
   justification. Schedule quarterly reviews of all suppressions to verify they
   remain valid. Remove stale suppressions.

7. **Combine multiple SAST tools.** No single tool catches everything. Use Semgrep
   for speed and custom rules, CodeQL for deep data flow analysis, and
   language-specific tools (Bandit, gosec) for specialized checks.

8. **Block merges only on critical and high-severity findings.** Medium and low
   findings should generate warnings but not block development. Adjust thresholds
   as the codebase matures.

9. **Version-control all SAST configuration.** Store rule configurations, suppression
   lists, and quality gate definitions in the repository. Changes to security
   policy should go through code review like any other change.

10. **Measure and report SAST metrics.** Track false positive rates, mean time to
    remediate, and finding density over time. Use metrics to justify investment in
    security tooling and demonstrate improvement.

---

## 10. Anti-Patterns

1. **Running SAST only in CI, never in IDE.** Developers learn about issues minutes
   or hours after writing the code, when context is lost. Shift scanning left into
   the development environment.

2. **Enabling every rule on day one.** An avalanche of findings, many false positives,
   causes alert fatigue. Developers disable the tool or ignore all findings. Start
   with a curated, high-confidence ruleset.

3. **Suppressing without justification.** Adding `nosemgrep` or `nosec` without
   explaining why trains developers to suppress everything. Require a written reason
   for every suppression.

4. **Never updating SAST rules.** New vulnerability patterns emerge constantly. If
   rulesets are pinned to old versions, the tool misses recent attack vectors.
   Update rulesets at least monthly.

5. **Treating SAST as a silver bullet.** SAST cannot find runtime vulnerabilities,
   business logic flaws, or configuration issues. Teams that rely solely on SAST
   develop a false sense of security. Combine with DAST, SCA, and manual testing.

6. **Ignoring SAST in legacy codebases.** Declaring legacy code "out of scope"
   leaves known vulnerabilities unaddressed. Use baseline-and-diff approaches to
   focus on new findings without being overwhelmed by existing technical debt.

7. **Not involving developers in rule creation.** Security teams writing rules without
   developer input produce rules that do not match real code patterns, generating
   excessive false positives. Collaborate on custom rules.

8. **Scanning only the default branch.** Vulnerabilities introduced in feature
   branches should be caught before they reach the default branch. Run SAST on
   every pull request targeting protected branches.

---

## 11. Enforcement Checklist

Use this checklist to verify SAST is properly implemented:

```
SAST ENFORCEMENT CHECKLIST
==========================

Tool Selection and Configuration:
[ ] Primary SAST tool selected and configured (Semgrep, CodeQL, or equivalent)
[ ] Language-specific tools configured for each language in use
[ ] Custom rules written for organization-specific patterns
[ ] Rule severity levels mapped to organizational risk categories
[ ] False positive suppressions require written justification

CI/CD Integration:
[ ] SAST runs on every pull request targeting protected branches
[ ] SAST runs on the default branch on every merge
[ ] Full scan runs on a scheduled basis (nightly or weekly)
[ ] Incremental scanning configured for PR builds
[ ] SARIF results uploaded to GitHub Security tab (or equivalent)
[ ] Critical and high findings block merge

IDE Integration:
[ ] IDE plugins installed and configured for primary SAST tool
[ ] Real-time scanning enabled on file save
[ ] Developers trained on interpreting and acting on findings

Triage and Remediation:
[ ] Triage workflow documented and communicated
[ ] SLAs defined per severity level (Critical: 48h, High: 1 sprint, etc.)
[ ] Findings assigned to code owners via CODEOWNERS or similar mechanism
[ ] Suppression review scheduled quarterly
[ ] Metrics dashboard tracks findings, MTTR, and false positive rate

Governance:
[ ] SAST configuration version-controlled in the repository
[ ] Changes to security rules go through code review
[ ] SAST rulesets updated at least monthly
[ ] Security team reviews new custom rules before deployment
[ ] SAST coverage report reviewed in security governance meetings
```
