# SAST & DAST Security Testing

> **Domain:** Backend > Security > Security Testing
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

SAST (Static Application Security Testing) and DAST (Dynamic Application Security Testing) are the two pillars of automated security testing. SAST scans the code before it runs — catching SQL injections, hardcoded secrets, insecure crypto. DAST scans the running application — catching broken auth, misconfigured headers, runtime vulnerabilities. Together they provide comprehensive coverage: SAST catches bugs that DAST misses (dead code, internal logic) and DAST catches bugs that SAST misses (config issues, deployment-specific). According to Salt Labs 2025, 99% of organizations faced API security issues — automated testing is not optional.

---

## How It Works

### SAST vs DAST Comparison

```
SAST (White-Box)                    DAST (Black-Box)
──────────────────                  ──────────────────
Scans SOURCE CODE                   Scans RUNNING APP
Before deployment                   After deployment
Finds: SQLi, XSS, secrets,         Finds: Broken auth, misconfig,
  insecure crypto, buffer overflow    CORS, headers, runtime vulns
Fast (minutes)                      Slower (10-30 min)
Many false positives                Fewer false positives
Language-specific                   Language-agnostic
Cannot find runtime issues          Cannot find dead code issues
```

```
┌──────────────────────────────────────────────────────────┐
│                    Development Lifecycle                   │
│                                                           │
│  Code → [SAST] → Build → Deploy → [DAST] → Production   │
│    │                                  │                   │
│    │  + Secret scanning               │  + API scanning   │
│    │  + Dependency scanning (SCA)     │  + Fuzzing        │
│    │  + License compliance            │  + Pen testing    │
└──────────────────────────────────────────────────────────┘
```

---

## SAST Tools & Implementation

### Semgrep — Open-Source Rule-Based Scanner

```yaml
# .semgrep.yml — Custom rules + community rulesets
rules:
  # Custom rule: Prevent SQL injection
  - id: sql-injection-raw-query
    patterns:
      - pattern: |
          $DB.query(`... ${$VAR} ...`)
      - pattern: |
          $DB.query("..." + $VAR + "...")
    message: "Potential SQL injection. Use parameterized queries."
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-89: SQL Injection"
      owasp: "A03:2021 Injection"

  # Custom rule: No hardcoded secrets
  - id: hardcoded-api-key
    patterns:
      - pattern-regex: |
          (?i)(api[_-]?key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]
    paths:
      exclude:
        - "**/*test*"
        - "**/*spec*"
        - "**/*mock*"
    message: "Hardcoded secret detected. Use environment variables."
    languages: [typescript, javascript, python, go]
    severity: ERROR

  # Custom rule: Prevent eval()
  - id: no-eval
    pattern: eval($X)
    message: "eval() is dangerous — leads to code injection."
    languages: [typescript, javascript, python]
    severity: ERROR

  # Custom rule: Require parameterized queries (Go)
  - id: go-sql-injection
    patterns:
      - pattern: |
          $DB.Query(fmt.Sprintf("...", $ARGS))
      - pattern: |
          $DB.Exec(fmt.Sprintf("...", $ARGS))
    message: "Use parameterized queries: db.Query(sql, args...)"
    languages: [go]
    severity: ERROR
```

```bash
# Run Semgrep with community + custom rules
semgrep scan \
  --config=auto \
  --config=.semgrep.yml \
  --error \
  --json \
  --output=semgrep-results.json \
  src/
```

### SonarQube — Enterprise SAST Platform

```yaml
# sonar-project.properties
sonar.projectKey=my-backend-api
sonar.projectName=Backend API
sonar.sources=src
sonar.tests=tests
sonar.exclusions=**/node_modules/**,**/*.test.ts,**/migrations/**
sonar.typescript.lcov.reportPaths=coverage/lcov.info

# Quality gate thresholds
sonar.qualitygate.wait=true
```

```yaml
# GitHub Actions — SonarQube integration
- name: SonarQube Scan
  uses: sonarsource/sonarqube-scan-action@master
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

- name: SonarQube Quality Gate
  uses: sonarsource/sonarqube-quality-gate-action@master
  timeout-minutes: 5
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### CodeQL — GitHub Native SAST

```yaml
# .github/workflows/codeql.yml
name: CodeQL Analysis

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"  # Weekly Monday 6am

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    strategy:
      matrix:
        language: [javascript-typescript, python, go]
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: +security-and-quality
          # Custom query packs
          packs: |
            codeql/javascript-queries:Security/CWE
            codeql/python-queries:Security/CWE

      - name: Build (for compiled languages)
        if: matrix.language == 'go'
        run: go build ./...

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

---

## DAST Tools & Implementation

### OWASP ZAP — Open-Source DAST

```yaml
# GitHub Actions — ZAP Full Scan
name: DAST Scan

on:
  push:
    branches: [main]

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    services:
      app:
        image: my-backend:latest
        ports:
          - 3000:3000
        env:
          DATABASE_URL: postgres://test:test@postgres:5432/testdb
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: test

    steps:
      - uses: actions/checkout@v4

      - name: Wait for app to be ready
        run: |
          for i in $(seq 1 30); do
            curl -s http://localhost:3000/health && break
            sleep 2
          done

      - name: ZAP API Scan
        uses: zaproxy/action-api-scan@v0.9.0
        with:
          target: http://localhost:3000
          # OpenAPI spec for targeted scanning
          format: openapi
          definition: http://localhost:3000/api/docs/openapi.json
          # Rules file for custom configuration
          rules_file_name: .zap-rules.tsv
          # Fail on high-severity findings
          fail_action: true
          cmd_options: >
            -z "-config api.addrs.addr.name=.* -config api.addrs.addr.regex=true"

      - name: Upload ZAP Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-report
          path: report_html.html
```

```tsv
# .zap-rules.tsv — Custom ZAP scan rules
# Rule ID	Action	Description
10010	WARN	Cookie without Secure flag
10011	FAIL	Cookie without HttpOnly flag
10015	FAIL	Incomplete HSTS header
10020	FAIL	X-Frame-Options missing
10021	FAIL	X-Content-Type-Options missing
10035	FAIL	Strict-Transport-Security missing
10038	WARN	Content Security Policy missing
10098	FAIL	Cross-Domain Misconfiguration
40012	FAIL	Cross Site Scripting (Reflected)
40014	FAIL	Cross Site Scripting (Persistent)
40018	FAIL	SQL Injection
90022	FAIL	Application Error Disclosure
```

### StackHawk — Developer-Friendly DAST

```yaml
# stackhawk.yml
app:
  applicationId: ${APP_ID}
  env: ${ENVIRONMENT}
  host: http://localhost:3000
  openApiConf:
    path: /api/docs/openapi.json

  # Authentication for testing protected endpoints
  authentication:
    loggedInIndicator: "\"authenticated\":true"
    cookieAuthorization:
      cookieNames:
        - session_token
    usernamePassword:
      scanUsername: test@example.com
      scanPassword: ${SCAN_PASSWORD}
    tokenAuthorization:
      type: HEADER
      value: "Bearer ${AUTH_TOKEN}"
      tokenEndpoint: http://localhost:3000/api/v1/auth/login
      tokenExtractionRegex: '"token":"(.*?)"'

  # Exclude non-API paths
  excludePaths:
    - /health
    - /metrics
    - /api/docs

hawk:
  spider:
    base: false  # Use OpenAPI spec, not spider
  failureThreshold: medium
```

### Nuclei — Template-Based Vulnerability Scanner

```yaml
# Custom Nuclei template for API testing
id: api-information-disclosure
info:
  name: API Information Disclosure
  severity: medium
  tags: api,information-disclosure

requests:
  - method: GET
    path:
      - "{{BaseURL}}/api/v1/debug"
      - "{{BaseURL}}/api/v1/config"
      - "{{BaseURL}}/api/v1/env"
      - "{{BaseURL}}/.env"
      - "{{BaseURL}}/api/v1/swagger.json"
      - "{{BaseURL}}/api/v1/graphql?query={__schema{types{name}}}"

    matchers-condition: or
    matchers:
      - type: status
        status:
          - 200

      - type: word
        words:
          - "DATABASE_URL"
          - "API_KEY"
          - "SECRET"
          - "password"
        condition: or
```

---

## Software Composition Analysis (SCA)

### Dependency Vulnerability Scanning

```yaml
# GitHub Actions — Multi-language dependency scanning
name: Dependency Security

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: "0 8 * * 1"  # Weekly

jobs:
  node-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm audit --audit-level=high
        continue-on-error: false

  python-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install pip-audit safety
      - run: pip-audit --strict --fix --dry-run
      - run: safety check --full-report

  go-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - run: go install golang.org/x/vuln/cmd/govulncheck@latest
      - run: govulncheck ./...

  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all
```

### Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 10
    reviewers:
      - security-team
    labels:
      - dependencies
      - security
    # Group minor/patch updates
    groups:
      production:
        patterns:
          - "*"
        exclude-patterns:
          - "@types/*"
          - "*eslint*"
          - "*prettier*"
        update-types:
          - minor
          - patch

  - package-ecosystem: gomod
    directory: /
    schedule:
      interval: weekly

  - package-ecosystem: pip
    directory: /
    schedule:
      interval: weekly

  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

---

## Secret Scanning

```yaml
# .gitleaks.toml — Secret detection rules
title = "Gitleaks Configuration"

[extend]
useDefault = true

# Custom rules
[[rules]]
id = "custom-api-key"
description = "Custom API Key pattern"
regex = '''(?i)(myapp[_-]?api[_-]?key)\s*[:=]\s*['"]([a-zA-Z0-9]{32,})['"]'''
entropy = 3.5
secretGroup = 2

[[rules]]
id = "database-url"
description = "Database connection string"
regex = '''(?i)(postgres|mysql|mongodb)://[^:]+:[^@]+@[^\s'"]+'''
secretGroup = 0

# Allowlisting
[allowlist]
paths = [
  '''(.*?)test(.*?)''',
  '''(.*?)mock(.*?)''',
  '''\.example$''',
]
```

```yaml
# GitHub Actions — Gitleaks in CI
- name: Gitleaks Secret Scan
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_CONFIG: .gitleaks.toml
```

---

## SAST Tool Comparison

| Tool | Languages | Open Source | CI Integration | Strengths |
|------|---------|:----------:|:--------------:|-----------|
| **Semgrep** | 30+ | ✅ | ✅ | Custom rules, fast, low false positives |
| **CodeQL** | 10+ | ✅ (GitHub) | GitHub native | Deep analysis, semantic queries |
| **SonarQube** | 25+ | Community edition | ✅ | Quality + security, dashboard |
| **Snyk Code** | 10+ | ❌ | ✅ | AI-powered fixes, IDE plugins |
| **Checkmarx** | 20+ | ❌ | ✅ | Enterprise, compliance |

## DAST Tool Comparison

| Tool | Open Source | API Support | CI Integration | Strengths |
|------|:----------:|:-----------:|:--------------:|-----------|
| **OWASP ZAP** | ✅ | OpenAPI, GraphQL | ✅ | Free, comprehensive |
| **StackHawk** | ❌ | OpenAPI, GraphQL, gRPC | ✅ | Developer-friendly |
| **Nuclei** | ✅ | Template-based | ✅ | Community templates, fast |
| **Burp Suite** | ❌ | REST, GraphQL | Enterprise | Deep manual + auto testing |
| **Bright Security** | ❌ | REST, GraphQL, WebSocket | ✅ | AI-powered, zero false positives |

---

## Best Practices

1. **ALWAYS run SAST on every PR** — catch vulnerabilities before merge
2. **ALWAYS run DAST on staging** — test running application before production
3. **ALWAYS combine SAST + DAST + SCA** — no single tool catches everything
4. **ALWAYS scan for secrets in git history** — Gitleaks, TruffleHog
5. **ALWAYS fail CI on high/critical findings** — don't let vulnerabilities through
6. **ALWAYS scan dependencies weekly** — new CVEs are published daily
7. **ALWAYS maintain custom SAST rules** — project-specific patterns
8. **NEVER ignore scanner findings** — triage, fix, or document exception
9. **NEVER run DAST against production** — use staging/preview environments
10. **NEVER rely on only one tool** — each has blind spots

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| SAST only, no DAST | Runtime misconfigs missed | Add DAST to pipeline |
| DAST only, no SAST | Code-level vulns missed | Add SAST to PR checks |
| Ignoring false positives | Alert fatigue → real issues ignored | Tune rules, maintain allowlists |
| No dependency scanning | Known CVEs in production | SCA tools in CI |
| Manual-only security testing | Inconsistent, gaps | Automate in CI/CD |
| Running security scans quarterly | Vulns in prod for months | Continuous scanning |
| No secret scanning | Leaked API keys, passwords | Gitleaks pre-commit + CI |
| Scanner without triage process | Findings pile up unfixed | SLA: critical=24h, high=7d |

---

## Real-world Examples

### GitHub
- CodeQL runs on every PR (dogfooding)
- Secret scanning alerts for all public repos
- Dependabot auto-creates fix PRs
- Security advisories database (GHSA)

### Netflix
- Custom SAST rules for microservice patterns
- DAST integrated in canary deployment
- Dependency scanning with automated remediation
- Security Champions program per team

### Shopify
- Semgrep with 200+ custom rules
- Bug bounty program ($500-$50,000 rewards)
- DAST in staging before every deployment
- Automated secret rotation on detection

