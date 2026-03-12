# Dynamic Application Security Testing (DAST)

| Attribute      | Value                                                      |
|----------------|------------------------------------------------------------|
| Domain         | Testing > Security Testing                                 |
| Importance     | High                                                       |
| Last Updated   | 2026-03-10                                                 |
| Cross-ref      | `08-security/security-testing/dast.md` (comprehensive security perspective) |

---

## Core Concepts

### What Is DAST?

DAST tests a **running application** from the outside by sending crafted HTTP requests and analyzing responses for security vulnerabilities. Unlike SAST, DAST has zero knowledge of source code. It simulates an attacker interacting with the application through its exposed interfaces.

### DAST from the Developer Perspective

DAST is not exclusively a security team tool. Developers benefit by:
- Catching runtime vulnerabilities (XSS, CSRF, header misconfigurations) that SAST cannot detect.
- Validating that security controls (CSP, CORS, authentication) work as deployed.
- Testing the full stack: application code, middleware, web server, and infrastructure configuration.

### DAST Tool Landscape

| Tool         | Type        | Strengths                                       |
|--------------|-------------|-------------------------------------------------|
| OWASP ZAP    | Open source | Automation framework, active community, CI-ready |
| Burp Suite   | Commercial  | Deep manual testing, extensions ecosystem        |
| Nuclei       | Open source | Template-based, fast, community vulnerability templates |
| StackHawk    | SaaS        | Developer-first DAST, native CI integration      |

### DAST Scan Types

- **Passive scan**: Proxy observes traffic without modifying requests. Finds header issues, information disclosure, cookie flags.
- **Active scan**: Sends attack payloads (SQLi, XSS, path traversal) to discover exploitable vulnerabilities. Run only against test environments.
- **API scan**: Drives scanning from an OpenAPI/Swagger spec instead of crawling HTML pages.

### Authenticated Scanning

Most applications require authentication. DAST tools must handle:
- **Form-based login**: Configure username/password fields and login URL.
- **Token-based auth**: Provide a Bearer token or configure token refresh.
- **OAuth/OIDC flows**: Use a pre-authenticated session or service account tokens.
- **Session management**: Detect session invalidation and re-authenticate automatically.

Without authentication, DAST only tests the login page and public endpoints, missing the majority of the attack surface.

---

## Code Examples

### YAML: OWASP ZAP Automation Framework Configuration

```yaml
# zap-automation.yaml
---
env:
  contexts:
    - name: "app-context"
      urls:
        - "https://staging.example.com"
      includePaths:
        - "https://staging.example.com/.*"
      excludePaths:
        - "https://staging.example.com/logout"
        - "https://staging.example.com/static/.*"
      authentication:
        method: "json"
        parameters:
          loginPageUrl: "https://staging.example.com/login"
          loginRequestUrl: "https://staging.example.com/api/auth/login"
          loginRequestBody: '{"email":"{%username%}","password":"{%password%}"}'
        verification:
          method: "response"
          loggedInRegex: "\\Qaccess_token\\E"
      users:
        - name: "test-user"
          credentials:
            username: "${ZAP_AUTH_USER}"
            password: "${ZAP_AUTH_PASS}"

  parameters:
    failOnError: true
    progressToStdout: true

jobs:
  # Import OpenAPI spec for API scanning
  - type: openapi
    parameters:
      apiUrl: "https://staging.example.com/openapi.json"
      context: "app-context"

  # Spider the application
  - type: spider
    parameters:
      context: "app-context"
      user: "test-user"
      maxDuration: 5
      maxDepth: 5

  # AJAX spider for SPA applications
  - type: spiderAjax
    parameters:
      context: "app-context"
      user: "test-user"
      maxDuration: 5

  # Passive scan (runs automatically on all proxied traffic)
  - type: passiveScan-wait
    parameters:
      maxDuration: 10

  # Active scan with attack payloads
  - type: activeScan
    parameters:
      context: "app-context"
      user: "test-user"
      maxRuleDurationInMins: 5
      maxScanDurationInMins: 30
    policyDefinition:
      defaultStrength: "medium"
      defaultThreshold: "medium"
      rules:
        # SQL Injection
        - id: 40018
          strength: "high"
          threshold: "low"
        # XSS Reflected
        - id: 40012
          strength: "high"
          threshold: "low"
        # Path Traversal
        - id: 6
          strength: "high"
          threshold: "low"

  # Generate reports
  - type: report
    parameters:
      template: "sarif-json"
      reportDir: "/zap/reports"
      reportFile: "zap-results.sarif"
    risks:
      - high
      - medium
      - low

  - type: report
    parameters:
      template: "traditional-html"
      reportDir: "/zap/reports"
      reportFile: "zap-report.html"
```

### TypeScript: Programmatic ZAP Scan Triggering in Test Suite

```typescript
// dast/zap-scan.test.ts
import { ZapClient } from "zaproxy";
import { readFileSync } from "fs";

interface ZapAlert {
  alert: string;
  risk: string;
  confidence: string;
  url: string;
  description: string;
  solution: string;
  cweid: string;
}

const RISK_LEVELS = { Informational: 0, Low: 1, Medium: 2, High: 3 } as const;
const BLOCKING_THRESHOLD = RISK_LEVELS.Medium;

describe("DAST Security Scan", () => {
  let zap: ZapClient;
  const targetUrl = process.env.DAST_TARGET_URL ?? "https://staging.example.com";

  beforeAll(async () => {
    zap = new ZapClient({
      apiKey: process.env.ZAP_API_KEY!,
      proxy: process.env.ZAP_PROXY_URL ?? "http://localhost:8080",
    });

    // Wait for ZAP to be ready
    await waitForZap(zap);
  }, 30_000);

  it("completes an API scan without high-risk findings", async () => {
    // Import OpenAPI spec
    await zap.openapi.importUrl(
      `${targetUrl}/openapi.json`,
      undefined,
      targetUrl
    );

    // Start active scan
    const scanId = await zap.ascan.scan(targetUrl, "true", "false", "", "", "");
    await waitForScanCompletion(zap, scanId);

    // Retrieve and evaluate alerts
    const alertsResponse = await zap.core.alerts(targetUrl, "", "", "");
    const alerts: ZapAlert[] = alertsResponse.alerts;

    const blockingAlerts = alerts.filter(
      (a) => RISK_LEVELS[a.risk as keyof typeof RISK_LEVELS] >= BLOCKING_THRESHOLD
    );

    if (blockingAlerts.length > 0) {
      console.error("Blocking DAST findings:");
      for (const alert of blockingAlerts) {
        console.error(
          `  [${alert.risk}] ${alert.alert} at ${alert.url} (CWE-${alert.cweid})`
        );
        console.error(`    Fix: ${alert.solution}`);
      }
    }

    expect(blockingAlerts).toHaveLength(0);
  }, 600_000); // 10-minute timeout for scan

  afterAll(async () => {
    // Generate SARIF report for CI integration
    const report = await zap.reports.generate(
      "DAST Report",
      "sarif-json",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "/zap/reports/zap-results.sarif",
      ""
    );
  });
});

async function waitForZap(zap: ZapClient, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await zap.core.version();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("ZAP did not become available within timeout");
}

async function waitForScanCompletion(
  zap: ZapClient,
  scanId: string
): Promise<void> {
  let status = "0";
  while (parseInt(status) < 100) {
    await new Promise((r) => setTimeout(r, 5000));
    const response = await zap.ascan.status(scanId);
    status = response.status;
    console.log(`Active scan progress: ${status}%`);
  }
}
```

### Python: Nuclei Template Execution for Targeted Checks

```python
# dast/nuclei_scan.py
"""Run Nuclei templates against a target and parse results."""
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class NucleiFinding:
    template_id: str
    name: str
    severity: str
    url: str
    matched_at: str
    description: str
    tags: list[str]


def run_nuclei_scan(
    target: str,
    templates_dir: str = "./nuclei-templates",
    severity: str = "medium,high,critical",
    output_file: str = "nuclei-results.json",
) -> list[NucleiFinding]:
    """Execute Nuclei scan and return structured findings."""

    cmd = [
        "nuclei",
        "-u", target,
        "-t", templates_dir,
        "-severity", severity,
        "-json",
        "-output", output_file,
        "-rate-limit", "50",
        "-bulk-size", "25",
        "-concurrency", "10",
        "-timeout", "10",
        "-retries", "2",
        "-no-color",
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode not in (0, 1):  # 1 means findings found
        print(f"Nuclei stderr: {result.stderr}", file=sys.stderr)
        raise RuntimeError(f"Nuclei scan failed with code {result.returncode}")

    findings: list[NucleiFinding] = []
    output_path = Path(output_file)

    if output_path.exists():
        for line in output_path.read_text().strip().splitlines():
            data = json.loads(line)
            findings.append(
                NucleiFinding(
                    template_id=data.get("template-id", ""),
                    name=data.get("info", {}).get("name", ""),
                    severity=data.get("info", {}).get("severity", "unknown"),
                    url=data.get("url", data.get("host", "")),
                    matched_at=data.get("matched-at", ""),
                    description=data.get("info", {}).get("description", ""),
                    tags=data.get("info", {}).get("tags", []),
                )
            )

    return findings


def evaluate_findings(
    findings: list[NucleiFinding],
    fail_on_severity: str = "high",
) -> bool:
    """Return True if scan passes, False if blocking findings exist."""
    severity_rank = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
    threshold = severity_rank.get(fail_on_severity, 3)

    blocking = [
        f for f in findings
        if severity_rank.get(f.severity, 0) >= threshold
    ]

    if blocking:
        print(f"DAST FAILED: {len(blocking)} blocking finding(s):")
        for f in blocking:
            print(f"  [{f.severity.upper()}] {f.name} at {f.url}")
        return False

    print(f"DAST PASSED: {len(findings)} finding(s), none blocking.")
    return True


if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else "https://staging.example.com"
    findings = run_nuclei_scan(target_url)
    passed = evaluate_findings(findings)
    sys.exit(0 if passed else 1)
```

### YAML: DAST in CI/CD Pipeline

```yaml
# .github/workflows/dast.yml
name: DAST Security Scan
on:
  workflow_run:
    workflows: ["Deploy to Staging"]
    types: [completed]

jobs:
  zap-scan:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Wait for staging to be healthy
        run: |
          for i in $(seq 1 30); do
            if curl -sf https://staging.example.com/health; then
              echo "Staging is ready"
              exit 0
            fi
            sleep 10
          done
          echo "Staging did not become healthy"
          exit 1

      - name: Run ZAP Automation Framework
        uses: zaproxy/action-af@v0.10.0
        with:
          auto_file: "zap-automation.yaml"
          issue_title: "DAST: ZAP Findings"
          token: ${{ secrets.GITHUB_TOKEN }}
        env:
          ZAP_AUTH_USER: ${{ secrets.STAGING_TEST_USER }}
          ZAP_AUTH_PASS: ${{ secrets.STAGING_TEST_PASS }}

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: reports/zap-results.sarif

      - name: Fail on high-severity findings
        if: always()
        run: |
          python3 scripts/evaluate-dast-results.py \
            reports/zap-results.sarif \
            --fail-on-severity high
```

---

## Interpreting DAST Results

### Prioritization Framework

| Priority | Criteria | Action |
|----------|----------|--------|
| P0 - Fix immediately | High risk + High confidence + Exploitable | Block release, hotfix |
| P1 - Fix this sprint | Medium risk + High confidence | Add to sprint backlog |
| P2 - Fix next sprint | Low risk OR Medium confidence | Track in backlog |
| P3 - Evaluate | Informational or low confidence | Triage with security team |

### Common DAST Findings and Developer Actions

| Finding | Root Cause | Developer Fix |
|---------|-----------|---------------|
| Missing CSP header | No Content-Security-Policy configured | Add CSP header in middleware or web server config |
| Reflected XSS | User input rendered without encoding | Use templating engine auto-escaping; sanitize on output |
| Missing HSTS | No Strict-Transport-Security header | Add HSTS header with `max-age=31536000; includeSubDomains` |
| CSRF vulnerability | No anti-CSRF tokens on state-changing requests | Implement CSRF token middleware |
| Information disclosure | Stack traces or version headers in responses | Disable debug mode; remove `X-Powered-By` header |

---

## 10 Best Practices

1. **Run DAST against staging, never production.** Active scans send attack payloads that can corrupt data or trigger alerts.
2. **Configure authenticated scanning.** Unauthenticated scans miss 70%+ of the application surface behind login.
3. **Use the ZAP Automation Framework over legacy scripts.** The AF provides declarative, version-controlled scan configurations.
4. **Drive API scans from the OpenAPI spec.** Spec-driven scanning covers all documented endpoints systematically.
5. **Set severity thresholds that block deployment.** Block on high-severity findings; warn on medium.
6. **Exclude logout and destructive endpoints from scanning.** Prevent the scanner from logging itself out or deleting test data.
7. **Run DAST after deployment to staging, not in the build pipeline.** DAST needs a running application with realistic infrastructure.
8. **Combine DAST with SAST for full coverage.** SAST catches code-level issues; DAST catches configuration and runtime issues.
9. **Store DAST configurations in version control.** Treat `zap-automation.yaml` and Nuclei templates as code.
10. **Review and tune scan policies quarterly.** Disable noisy rules that produce false positives; enable new rules for emerging threats.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Running DAST against production | Data corruption, alert fatigue, legal risk | Scan staging or pre-production environments only |
| Unauthenticated scanning only | Misses 70%+ of attack surface behind auth | Configure authentication with test credentials |
| Treating DAST as a replacement for SAST | Misses source-code vulnerabilities (hardcoded secrets, logic flaws) | Layer DAST with SAST; they are complementary |
| Running scans without a time limit | Scans run for hours, blocking CI pipelines | Set `maxScanDurationInMins` and per-rule timeouts |
| Ignoring informational findings | Misses security header misconfigurations and information leaks | Triage all findings; fix header issues as quick wins |
| Not excluding destructive endpoints | Scanner deletes data, logs out sessions, triggers side effects | Exclude `/logout`, `/delete`, `/admin/reset` from scan scope |
| Running DAST only before major releases | Vulnerabilities accumulate between scans | Run DAST on every staging deployment |
| Not correlating DAST with SAST findings | Duplicate work; inconsistent remediation tracking | Upload both to the same dashboard (GitHub Security, DefectDojo) |

---

## Enforcement Checklist

- [ ] DAST runs automatically after every staging deployment
- [ ] Authenticated scanning is configured with dedicated test credentials
- [ ] OpenAPI spec drives API scan coverage
- [ ] ZAP Automation Framework config is version-controlled
- [ ] High-severity findings block promotion to production
- [ ] SARIF results upload to the GitHub Security tab (or equivalent)
- [ ] Destructive and logout endpoints are excluded from scan scope
- [ ] Scan duration limits are configured to prevent pipeline timeouts
- [ ] DAST results are correlated with SAST findings in a unified dashboard
- [ ] Test credentials are stored in CI/CD secret management, not in config files
- [ ] Scan policies are reviewed and updated quarterly
- [ ] Teams have runbooks for triaging and fixing common DAST findings
