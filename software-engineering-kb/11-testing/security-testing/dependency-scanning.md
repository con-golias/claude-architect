# Dependency Scanning

| Attribute      | Value                                                              |
|----------------|--------------------------------------------------------------------|
| Domain         | Testing > Security Testing                                         |
| Importance     | Critical                                                           |
| Last Updated   | 2026-03-10                                                         |
| Cross-ref      | `08-security/dependency-and-supply-chain/` (comprehensive supply chain perspective) |

---

## Core Concepts

### Software Composition Analysis (SCA)

SCA identifies open-source and third-party components in your application, maps them to known vulnerability databases (NVD, OSV, GitHub Advisory Database), and flags components with security issues, license conflicts, or end-of-life status. Modern applications consist of 70-90% open-source code. Scanning dependencies is not optional.

### Vulnerability Databases and Identifiers

| Database | Identifier | Coverage |
|----------|-----------|----------|
| NVD (National Vulnerability Database) | CVE-YYYY-NNNNN | Broadest coverage, government-maintained |
| GitHub Advisory Database | GHSA-xxxx-xxxx-xxxx | GitHub-curated, feeds into npm/pip/go advisories |
| OSV (Open Source Vulnerabilities) | OSV-YYYY-NNNNN | Aggregates multiple sources, precise version ranges |

### Vulnerability Prioritization

Not all vulnerabilities are equal. Prioritize using:

1. **CVSS (Common Vulnerability Scoring System)**: Base severity score (0-10). Provides a starting point but lacks exploit context.
2. **EPSS (Exploit Prediction Scoring System)**: Probability (0-1) that a vulnerability will be exploited in the wild within 30 days. High EPSS + high CVSS = immediate action.
3. **Reachability analysis**: Determines whether your code actually calls the vulnerable function. A critical CVE in an unused code path is a lower priority than a medium CVE in a hot path.

### Tool Landscape

| Tool        | Ecosystem             | Model      | Strengths                                    |
|-------------|-----------------------|------------|----------------------------------------------|
| Snyk        | Multi-language        | Freemium   | Deep fix advice, reachability, IDE plugins   |
| Dependabot  | GitHub-native         | Free       | Automatic PRs, tight GitHub integration      |
| Renovate    | Multi-platform        | Free/OSS   | Highly configurable, supports monorepos      |
| npm audit   | Node.js               | Built-in   | Zero setup for npm projects                  |
| pip-audit   | Python                | Free/OSS   | Uses OSV database, resolves fix versions     |
| Trivy       | Containers, IaC, SBOM | Free/OSS   | Scans containers, filesystems, git repos     |

### Lock File Integrity

Lock files (`package-lock.json`, `yarn.lock`, `go.sum`, `poetry.lock`, `Pipfile.lock`) pin exact dependency versions and integrity hashes. They ensure:
- **Reproducible builds**: Every install resolves to identical packages.
- **Tamper detection**: Hash mismatches reveal supply chain attacks.
- **Auditability**: Reviewers can see exactly what changed.

Treat lock file modifications as security-sensitive changes that require review.

### License Compliance

Open-source licenses carry legal obligations. SCA tools detect:
- **Copyleft licenses** (GPL, AGPL): Require derivative works to be open-sourced.
- **Permissive licenses** (MIT, Apache, BSD): Allow proprietary use with attribution.
- **No license**: Legally ambiguous; treat as restricted.

Define an organizational license policy and enforce it automatically.

---

## Code Examples

### YAML: GitHub Dependabot Configuration with Auto-Merge for Patches

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
      time: "06:00"
      timezone: "UTC"
    open-pull-requests-limit: 15
    reviewers:
      - "platform-team"
    labels:
      - "dependencies"
      - "security"
    groups:
      production-deps:
        patterns: ["*"]
        exclude-patterns: ["@types/*", "eslint*", "jest*", "vitest*"]
        update-types: ["minor", "patch"]
      dev-deps:
        patterns: ["@types/*", "eslint*", "jest*", "vitest*"]
        update-types: ["minor", "patch"]
    ignore:
      - dependency-name: "node"
        update-types: ["version-update:semver-major"]
    security-updates:
      enabled: true

  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "monday"

  - package-ecosystem: "gomod"
    directory: "/services/gateway"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-Merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Fetch Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2
        with:
          github-token: "${{ secrets.GITHUB_TOKEN }}"

      - name: Auto-merge patch updates
        if: >
          steps.metadata.outputs.update-type == 'version-update:semver-patch' &&
          steps.metadata.outputs.dependency-type == 'direct:production'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Auto-merge dev dependency updates
        if: steps.metadata.outputs.dependency-type == 'direct:development'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### YAML: Snyk CI Integration with Severity Thresholds

```yaml
# .github/workflows/snyk.yml
name: Snyk Security Scan
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 8 * * 1" # Weekly Monday 8am UTC

jobs:
  snyk-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: >
            --severity-threshold=high
            --fail-on=upgradable
            --json-file-output=snyk-results.json

      - name: Upload Snyk results to GitHub Code Scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: snyk-results.json

  snyk-container:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and scan container image
        uses: snyk/actions/docker@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          image: app:${{ github.sha }}
          args: --severity-threshold=high
```

### TypeScript: Custom Vulnerability Policy Enforcement Script

```typescript
// scripts/enforce-vuln-policy.ts
/**
 * Enforce organizational vulnerability policy on npm audit results.
 * Exit 1 if policy violations exist; exit 0 if compliant.
 */
import { execSync } from "child_process";

interface NpmAuditVuln {
  name: string;
  severity: string;
  via: Array<{ title: string; url: string; cwe: string[] }>;
  range: string;
  fixAvailable: boolean | { name: string; version: string };
  isDirect: boolean;
}

interface NpmAuditResult {
  vulnerabilities: Record<string, NpmAuditVuln>;
  metadata: {
    vulnerabilities: Record<string, number>;
  };
}

interface PolicyViolation {
  package: string;
  severity: string;
  reason: string;
  fixAvailable: boolean;
}

// Organizational policy configuration
const POLICY = {
  maxAge: 30,                      // Days before a known vuln must be fixed
  blockSeverities: ["critical"],   // Always block these severities
  warnSeverities: ["high"],        // Warn but allow if no fix available
  allowedExceptions: [             // Packages with accepted risk (with expiry)
    {
      package: "legacy-xml-parser",
      reason: "Migration planned for Q2; no user input reaches this code path",
      expires: "2026-06-01",
    },
  ],
  requireFixForDirect: true,       // Direct deps with fixes must be updated
} as const;

function runAudit(): NpmAuditResult {
  try {
    const output = execSync("npm audit --json", {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(output);
  } catch (error: any) {
    // npm audit exits with non-zero when vulns exist
    return JSON.parse(error.stdout);
  }
}

function enforcePolicy(audit: NpmAuditResult): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const now = new Date();

  for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
    // Check if package is in exceptions list
    const exception = POLICY.allowedExceptions.find(
      (e) => e.package === name && new Date(e.expires) > now
    );
    if (exception) {
      console.log(`EXEMPTED: ${name} - ${exception.reason}`);
      continue;
    }

    // Block critical vulnerabilities unconditionally
    if (POLICY.blockSeverities.includes(vuln.severity)) {
      violations.push({
        package: name,
        severity: vuln.severity,
        reason: `${vuln.severity} vulnerability must be fixed immediately`,
        fixAvailable: !!vuln.fixAvailable,
      });
      continue;
    }

    // Block direct dependencies with available fixes
    if (POLICY.requireFixForDirect && vuln.isDirect && vuln.fixAvailable) {
      violations.push({
        package: name,
        severity: vuln.severity,
        reason: "Direct dependency has an available fix; update required",
        fixAvailable: true,
      });
    }
  }

  return violations;
}

// Main execution
const audit = runAudit();
const violations = enforcePolicy(audit);

const { vulnerabilities: counts } = audit.metadata;
console.log(
  `\nAudit summary: ${counts.critical ?? 0} critical, ` +
  `${counts.high ?? 0} high, ${counts.moderate ?? 0} moderate, ` +
  `${counts.low ?? 0} low`
);

if (violations.length > 0) {
  console.error(`\nPOLICY VIOLATIONS (${violations.length}):`);
  for (const v of violations) {
    console.error(
      `  [${v.severity.toUpperCase()}] ${v.package} - ${v.reason}` +
      `${v.fixAvailable ? " (fix available)" : ""}`
    );
  }
  process.exit(1);
} else {
  console.log("\nAll dependencies comply with vulnerability policy.");
  process.exit(0);
}
```

### Python: pip-audit Integration and Lock File Verification

```python
# scripts/audit_python_deps.py
"""Audit Python dependencies using pip-audit and verify lock file integrity."""
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class VulnFinding:
    package: str
    installed_version: str
    fixed_version: str | None
    vuln_id: str


def run_pip_audit(requirements_file: str = "requirements.txt") -> list[VulnFinding]:
    """Run pip-audit and parse JSON output."""
    cmd = [
        "pip-audit", "-r", requirements_file,
        "--format", "json", "--output", "pip-audit-results.json",
        "--desc", "--fix", "--dry-run",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    output_path = Path("pip-audit-results.json")
    if not output_path.exists():
        if result.returncode != 0:
            raise RuntimeError(f"pip-audit failed: {result.stderr}")
        return []

    data = json.loads(output_path.read_text())
    findings: list[VulnFinding] = []
    for dep in data.get("dependencies", []):
        for vuln in dep.get("vulns", []):
            findings.append(VulnFinding(
                package=dep["name"],
                installed_version=dep["version"],
                fixed_version=vuln.get("fix_versions", [None])[0],
                vuln_id=vuln["id"],
            ))
    return findings


def verify_lock_file(lock_file: str = "poetry.lock") -> bool:
    """Verify lock file consistency with pyproject.toml."""
    result = subprocess.run(["poetry", "check", "--lock"], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Lock file check failed:\n{result.stderr}", file=sys.stderr)
        return False
    return True


if __name__ == "__main__":
    lock_ok = verify_lock_file()
    findings = run_pip_audit()
    blocking = [f for f in findings if f.fixed_version is not None]
    for f in findings:
        fix = f"-> {f.fixed_version}" if f.fixed_version else "(no fix)"
        print(f"  [{f.vuln_id}] {f.package}=={f.installed_version} {fix}")
    if not lock_ok or blocking:
        print(f"FAILED: {len(blocking)} fixable vulnerabilities.")
        sys.exit(1)
    print("PASSED: All dependencies compliant.")
```

---

## License Compliance Scanning

```yaml
# .licensee.yml (or equivalent tool config)
# Define allowed, restricted, and forbidden licenses
allowed:
  - MIT
  - Apache-2.0
  - BSD-2-Clause
  - BSD-3-Clause
  - ISC
  - CC0-1.0
  - Unlicense

restricted:  # Require legal review before use
  - MPL-2.0
  - LGPL-2.1
  - LGPL-3.0
  - EPL-1.0
  - EPL-2.0

forbidden:   # Must not be used in proprietary products
  - GPL-2.0
  - GPL-3.0
  - AGPL-3.0
  - SSPL-1.0
  - EUPL-1.2

unknown_action: "fail"  # Fail if license cannot be determined
```

---

## 10 Best Practices

1. **Scan dependencies on every pull request and on a daily schedule.** PRs catch new additions; scheduled scans catch newly disclosed vulnerabilities.
2. **Use lock files and verify their integrity in CI.** Run `npm ci` (not `npm install`), `poetry check --lock`, or `go mod verify` in CI.
3. **Auto-merge patch updates for dependencies with passing tests.** Reduce update fatigue by automatically merging low-risk changes.
4. **Prioritize by EPSS + reachability, not CVSS alone.** A CVSS 9.8 in unreachable code is lower priority than a CVSS 7.0 in a hot path with high EPSS.
5. **Define and enforce a license policy.** Block forbidden licenses (GPL, AGPL) in CI; require legal review for restricted licenses.
6. **Scan container images, not just application dependencies.** Base images contain OS-level packages with their own vulnerabilities.
7. **Use grouped dependency updates.** Tools like Renovate and Dependabot grouping reduce PR noise by batching compatible updates.
8. **Track exception/exemption expiry dates.** Never allow permanent vulnerability exemptions; set a review date for every accepted risk.
9. **Generate and publish SBOMs (Software Bill of Materials).** Use CycloneDX or SPDX format for supply chain transparency.
10. **Fail the build only on fixable vulnerabilities.** Block when a patched version exists; track unfixable findings separately.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Running `npm audit` without a policy | Developers ignore all findings due to noise | Define severity thresholds and a custom policy script |
| Never updating dependencies | Accumulated technical debt; dozens of unpatched CVEs | Schedule automated dependency updates (daily for patches, weekly for minors) |
| Ignoring transitive dependency vulnerabilities | Exploitable vulns hidden deep in the dependency tree | Use tools with transitive scanning (Snyk, Trivy); override vulnerable sub-deps |
| Auto-merging major version bumps | Breaking changes silently introduced | Auto-merge only patches; require manual review for minor and major updates |
| Permanently exempting vulnerable packages | Accepted risk never revisited; vulnerability exploited months later | Set expiry dates on all exemptions; alert when approaching expiry |
| Scanning only at release time | Vulnerabilities accumulate in main branch for weeks | Scan on every PR and run scheduled daily scans |
| Committing lock files without review | Supply chain attacks via manipulated lock files | Review lock file diffs in PRs; use `npm ci`/`yarn --frozen-lockfile` in CI |
| Not scanning GitHub Actions and CI dependencies | Compromised actions introduce malicious code | Pin actions to SHA; scan with Dependabot `github-actions` ecosystem |

---

## Enforcement Checklist

- [ ] Dependency scanning runs on every pull request as a required check
- [ ] A scheduled daily/weekly scan catches newly disclosed vulnerabilities
- [ ] Lock files are committed and verified in CI (`npm ci`, `poetry check --lock`)
- [ ] Severity thresholds are defined: critical blocks merge, high blocks deploy
- [ ] A custom vulnerability policy script enforces organizational rules
- [ ] License compliance scanning is active with a defined allowed/forbidden list
- [ ] Container images are scanned with Trivy or Snyk Container
- [ ] Auto-merge is configured for patch updates with passing tests
- [ ] All vulnerability exemptions have documented justifications and expiry dates
- [ ] SBOMs are generated in CI and published for supply chain transparency
- [ ] GitHub Actions are pinned to commit SHAs, not mutable tags
- [ ] Dependency update PRs are grouped to reduce review burden
