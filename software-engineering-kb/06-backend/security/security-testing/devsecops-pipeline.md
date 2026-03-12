# DevSecOps Pipeline

> **Domain:** Backend > Security > Security Testing
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

DevSecOps integrates security into every stage of the development lifecycle — it is not something you "add at the end". Shift-left means: find vulnerabilities in the editor, not in production. A mature DevSecOps pipeline catches >90% of vulnerabilities before they reach staging. Without it, you rely on manual pen testing every 6 months — in between, vulns run in production. According to IBM, the cost of a security fix in production is 100x greater than in development.

---

## How It Works

### Security Gates in the CI/CD Pipeline

```
Developer                    CI/CD Pipeline                         Production
    │                             │                                      │
    │  1. Pre-commit              │                                      │
    │  ├── Secret scanning        │                                      │
    │  ├── Lint security rules    │                                      │
    │  └── IDE SAST plugins       │                                      │
    │                             │                                      │
    │  2. PR Created ────────────▶│  3. Automated Checks                 │
    │                             │  ├── SAST (Semgrep, CodeQL)          │
    │                             │  ├── SCA (npm audit, govulncheck)    │
    │                             │  ├── Secret scanning (Gitleaks)      │
    │                             │  ├── License compliance              │
    │                             │  ├── Container scanning (Trivy)      │
    │                             │  └── IaC scanning (Checkov)          │
    │                             │                                      │
    │                             │  4. Quality Gate                     │
    │                             │  ├── Zero critical findings?         │
    │                             │  ├── Zero high findings?             │
    │                             │  └── Coverage threshold met?         │
    │                             │         │                            │
    │                             │    PASS │ FAIL                       │
    │                             │         │                            │
    │  PR Approved ◄──────────────│         │                            │
    │                             │         │                            │
    │  5. Merge to main ─────────▶│  6. Deploy to Staging               │
    │                             │  ├── DAST scan (ZAP, StackHawk)     │
    │                             │  ├── API security scan              │
    │                             │  └── Smoke tests                    │
    │                             │         │                            │
    │                             │    PASS │                            │
    │                             │         │                            │
    │                             │  7. Deploy to Production ───────────▶│
    │                             │                                      │
    │                             │  8. Runtime Monitoring               │
    │                             │  ├── WAF rules                      │
    │                             │  ├── Anomaly detection              │
    │                             │  ├── Dependency alerts              │
    │                             │  └── Security event logging         │
    │                             │                                      │
```

---

## Pre-Commit Security Hooks

```yaml
# .pre-commit-config.yaml
repos:
  # Secret scanning
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  # Security linting
  - repo: https://github.com/semgrep/semgrep
    rev: v1.60.0
    hooks:
      - id: semgrep
        args: ["--config", "auto", "--error"]

  # Detect private keys
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files
        args: ["--maxkb=500"]

  # Python-specific
  - repo: https://github.com/PyCQA/bandit
    rev: "1.7.7"
    hooks:
      - id: bandit
        args: ["-ll", "-ii"]  # Low+ severity, medium+ confidence

  # Go-specific
  - repo: https://github.com/securego/gosec
    rev: v2.19.0
    hooks:
      - id: gosec
```

---

## Complete CI/CD Security Pipeline

```yaml
# .github/workflows/security.yml
name: Security Pipeline

on:
  push:
    branches: [main]
  pull_request:

permissions:
  security-events: write
  contents: read
  pull-requests: write

jobs:
  # ═══════════════════════════════════════
  # Stage 1: Static Analysis (on every PR)
  # ═══════════════════════════════════════

  sast-semgrep:
    name: SAST — Semgrep
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep
    steps:
      - uses: actions/checkout@v4
      - run: semgrep scan
          --config=auto
          --config=.semgrep.yml
          --error
          --sarif
          --output=semgrep.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif

  sast-codeql:
    name: SAST — CodeQL
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [javascript-typescript]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: +security-and-quality
      - uses: github/codeql-action/analyze@v3

  secret-scanning:
    name: Secret Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for scanning
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  dependency-check:
    name: Dependency Vulnerabilities
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm audit --audit-level=high
      - name: Snyk Test
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  container-scanning:
    name: Container Security
    runs-on: ubuntu-latest
    needs: [sast-semgrep]
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t my-app:${{ github.sha }} .
      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: my-app:${{ github.sha }}
          format: sarif
          output: trivy-results.sarif
          severity: CRITICAL,HIGH
          exit-code: 1
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-results.sarif

  iac-scanning:
    name: Infrastructure as Code
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Checkov IaC scan
        uses: bridgecrewio/checkov-action@master
        with:
          directory: infrastructure/
          framework: terraform,kubernetes,dockerfile
          soft_fail: false
          output_format: sarif
          output_file_path: checkov.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: checkov.sarif

  license-compliance:
    name: License Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0"

  # ═══════════════════════════════════════
  # Stage 2: Security Gate
  # ═══════════════════════════════════════

  security-gate:
    name: Security Gate
    runs-on: ubuntu-latest
    needs:
      - sast-semgrep
      - sast-codeql
      - secret-scanning
      - dependency-check
      - container-scanning
      - iac-scanning
      - license-compliance
    steps:
      - name: All security checks passed
        run: echo "Security gate passed — safe to merge"

  # ═══════════════════════════════════════
  # Stage 3: DAST (on main branch only)
  # ═══════════════════════════════════════

  dast-scan:
    name: DAST — API Security Scan
    runs-on: ubuntu-latest
    needs: [security-gate]
    if: github.ref == 'refs/heads/main'
    services:
      app:
        image: my-app:latest
        ports:
          - 3000:3000
        env:
          NODE_ENV: test
          DATABASE_URL: postgres://test:test@postgres:5432/testdb
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - name: Wait for app
        run: |
          for i in $(seq 1 30); do
            curl -sf http://localhost:3000/health && break || sleep 2
          done
      - name: ZAP API Scan
        uses: zaproxy/action-api-scan@v0.9.0
        with:
          target: http://localhost:3000
          format: openapi
          definition: http://localhost:3000/api/docs/openapi.json
          fail_action: true
```

---

## Container Security

### Dockerfile Best Practices

```dockerfile
# ✅ Secure Dockerfile
# Use specific version tag — never :latest
FROM node:20.11-alpine3.19 AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# ─── Production stage ───
FROM node:20.11-alpine3.19

# Don't run as root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Remove unnecessary packages
RUN apk --no-cache add dumb-init && \
    rm -rf /var/cache/apk/*

# Security: read-only filesystem
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### Container Scanning

```yaml
# Trivy — Comprehensive container scanner
# Scans: OS packages, language packages, misconfigurations
- name: Trivy scan
  run: |
    trivy image \
      --severity CRITICAL,HIGH \
      --exit-code 1 \
      --ignore-unfixed \
      --format sarif \
      --output trivy.sarif \
      my-app:${{ github.sha }}

# Grype — Anchore vulnerability scanner
- name: Grype scan
  uses: anchore/scan-action@v4
  with:
    image: my-app:${{ github.sha }}
    fail-build: true
    severity-cutoff: high
```

---

## Vulnerability Management Process

### Severity SLAs

| Severity | SLA | Action |
|----------|-----|--------|
| **Critical** (CVSS 9.0-10.0) | 24 hours | Hotfix, immediate deploy |
| **High** (CVSS 7.0-8.9) | 7 days | Next sprint, prioritized |
| **Medium** (CVSS 4.0-6.9) | 30 days | Planned backlog |
| **Low** (CVSS 0.1-3.9) | 90 days | Best effort |
| **Info** | No SLA | Document, review quarterly |

### Vulnerability Tracking

```typescript
// TypeScript — Security Finding Model
interface SecurityFinding {
  id: string;
  source: "sast" | "dast" | "sca" | "container" | "secret" | "manual";
  tool: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  cwe?: string;           // CWE-89, CWE-79, etc.
  cvss?: number;          // 0.0 - 10.0
  cve?: string;           // CVE-2024-xxxx
  file?: string;          // Affected file path
  line?: number;          // Line number
  status: "open" | "in_progress" | "fixed" | "accepted_risk" | "false_positive";
  assignee?: string;
  sla_deadline: Date;
  found_at: Date;
  fixed_at?: Date;
  ticket_url?: string;    // Jira/Linear ticket
}
```

### Exception Process

```yaml
# .security-exceptions.yml — Documented risk acceptance
exceptions:
  - id: SEC-2024-001
    finding: "CVE-2024-1234 in lodash@4.17.20"
    severity: medium
    reason: "Vulnerability requires prototype pollution attack vector not present in our usage"
    approved_by: "security-lead@example.com"
    approved_date: "2024-03-15"
    review_date: "2024-06-15"  # Must re-review
    ticket: "SEC-1234"

  - id: SEC-2024-002
    finding: "Semgrep: eval usage in template engine"
    severity: high
    reason: "eval only processes trusted server-generated templates, not user input"
    mitigation: "Input sanitization + CSP nonce policy"
    approved_by: "cto@example.com"
    approved_date: "2024-03-20"
    review_date: "2024-06-20"
```

---

## Security Dashboards & Reporting

```typescript
// TypeScript — Security Metrics Collection
interface SecurityMetrics {
  // Vulnerability counts by severity
  open_findings: Record<string, number>;

  // SLA compliance
  sla_compliance_rate: number;  // % of findings fixed within SLA
  mean_time_to_remediate: {
    critical: number;  // hours
    high: number;
    medium: number;
  };

  // Pipeline metrics
  builds_blocked_by_security: number;
  false_positive_rate: number;
  findings_per_1000_loc: number;

  // Dependency health
  outdated_dependencies: number;
  known_vulnerabilities: number;

  // Trend
  new_findings_this_week: number;
  fixed_findings_this_week: number;
}
```

### Key Metrics to Track

| Metric | Target | Frequency |
|--------|--------|-----------|
| Mean Time to Remediate (MTTR) — Critical | < 24h | Weekly |
| Mean Time to Remediate (MTTR) — High | < 7d | Weekly |
| SLA Compliance Rate | > 95% | Monthly |
| False Positive Rate | < 15% | Monthly |
| Dependency CVEs (High+) | 0 in production | Daily |
| Security Gate Pass Rate | > 90% | Weekly |
| Pen Test Findings (Critical) | 0 | Quarterly |

---

## Security Champions Program

| Role | Responsibility | Per |
|------|---------------|-----|
| **Security Champion** | Review security findings for team, triage, mentor | Per team (1 per 5-8 devs) |
| **Security Lead** | Set policy, approve exceptions, manage tools | Per org |
| **AppSec Engineer** | Configure tools, write custom rules, pen test | Per 50-100 devs |

---

## Best Practices

1. **ALWAYS shift left** — catch vulns in IDE and PR, not staging
2. **ALWAYS automate security gates** — block merges on critical/high findings
3. **ALWAYS run full pipeline on every PR** — SAST + SCA + secrets + container
4. **ALWAYS run DAST before production deploy** — catch runtime misconfigurations
5. **ALWAYS define severity SLAs** — Critical: 24h, High: 7d, Medium: 30d
6. **ALWAYS track metrics** — MTTR, SLA compliance, false positive rate
7. **ALWAYS document exceptions** — approved_by, review_date, mitigation
8. **ALWAYS scan containers** — Trivy/Grype for OS + language vulnerabilities
9. **NEVER skip security for "urgent" releases** — that's when bugs slip through
10. **NEVER treat security as one team's problem** — shared responsibility (DevSecOps)

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| Security as afterthought | Vulnerabilities in production | Shift-left, CI gates |
| Manual-only security review | Inconsistent, slow | Automate + manual pen testing |
| Ignoring scanner alerts | Alert fatigue, real vulns missed | Triage process, SLAs |
| No container scanning | Vulnerable base images in prod | Trivy/Grype in pipeline |
| No pre-commit hooks | Secrets committed to git | Gitleaks pre-commit |
| Security team as bottleneck | Slow releases, frustration | Security Champions per team |
| No exception process | Shadow risk acceptance | Formal exception workflow |
| Quarterly pen tests only | 3 months of undetected vulns | Continuous automated + quarterly manual |

---

## Real-world Examples

### GitLab
- "DevSecOps platform" — security in every pipeline stage
- Built-in SAST, DAST, SCA, container scanning, secret detection
- Security dashboard per project and group
- Vulnerability management with auto-remediation MRs

### Microsoft
- SDL (Security Development Lifecycle) since 2004
- Threat modeling required for every feature
- CodeQL + custom analyzers in Azure DevOps
- Bug bar: zero critical/high vulns at ship time

### Spotify
- Security Champions in every squad
- Automated SAST with Semgrep (200+ custom rules)
- Dependency scanning with auto-upgrade PRs
- Security metrics dashboard per team
- MTTR < 48h for critical findings

