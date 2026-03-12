# Software Composition Analysis (SCA)

## Metadata
- **Category:** Security Testing
- **Scope:** Dependency vulnerability detection, license compliance, SBOM generation
- **Audience:** Software engineers, security engineers, DevSecOps practitioners
- **Prerequisites:** Package management basics, CI/CD fundamentals
- **Last Updated:** 2025-01

---

## 1. How SCA Works

Software Composition Analysis identifies open-source and third-party components in
your application, maps them to known vulnerability databases, detects license
compliance issues, and generates software bills of materials (SBOMs).

### 1.1 Dependency Tree Analysis

SCA tools parse package manifests and lock files to build a complete dependency tree,
including both direct and transitive (indirect) dependencies.

```
Application
+-- express@4.18.2 (direct)
|   +-- body-parser@1.20.1 (transitive)
|   |   +-- raw-body@2.5.1
|   |   +-- qs@6.11.0
|   +-- cookie@0.5.0
|   +-- path-to-regexp@0.1.7
+-- jsonwebtoken@9.0.0 (direct)
|   +-- jws@3.2.2
|   |   +-- jwa@1.4.1
|   |   |   +-- buffer-equal-constant-time@1.0.1
|   |   |   +-- ecdsa-sig-formatter@1.0.11
|   +-- lodash@4.17.21
+-- axios@1.6.0 (direct)
    +-- follow-redirects@1.15.3
    +-- form-data@4.0.0
    +-- proxy-from-env@1.1.0
```

Typical applications have 10-50 direct dependencies but 200-1000+ transitive
dependencies. The vast majority of vulnerabilities exist in transitive dependencies
that developers never explicitly chose.

### 1.2 CVE Matching

SCA tools match identified components against vulnerability databases using:

1. **Package name and version:** Exact matching against known vulnerable versions
2. **CPE (Common Platform Enumeration):** Standardized naming for software products
3. **Package URL (purl):** Universal identifier for packages across ecosystems

```
Matching example:
  Detected: lodash@4.17.20
  CVE-2021-23337: lodash < 4.17.21 - Command Injection
  Match: YES - version 4.17.20 is within affected range
  Fix: Upgrade to lodash@4.17.21 or later
```

### 1.3 License Detection

SCA tools identify the license of each dependency and flag potential compliance issues:

```
License compatibility analysis:
  Your project: MIT License
  Dependencies:
    express@4.18.2      - MIT        - Compatible
    lodash@4.17.21      - MIT        - Compatible
    some-lib@1.0.0      - GPL-3.0    - INCOMPATIBLE (copyleft)
    another-lib@2.0.0   - Apache-2.0 - Compatible (with attribution)
    mystery-lib@0.1.0   - UNKNOWN    - REVIEW REQUIRED
```

---

## 2. Vulnerability Databases

### 2.1 Database Comparison

| Database | Coverage | Update Frequency | Access |
|---|---|---|---|
| NVD (National Vulnerability Database) | Comprehensive, all software | Daily | Free, public API |
| GitHub Advisory Database | Open source packages | Continuous | Free, public API |
| OSV (Open Source Vulnerabilities) | Open source, multi-ecosystem | Continuous | Free, public API |
| VulnDB (Risk Based Security) | Most comprehensive | Continuous | Commercial license |
| Snyk Vulnerability Database | Open source, curated | Continuous | Free tier + commercial |

### 2.2 Vulnerability Identifiers

```
CVE-2021-44228     - MITRE assigned Common Vulnerabilities and Exposures ID
GHSA-jfh8-c2jp-5v3q - GitHub Security Advisory ID
PYSEC-2024-1234    - Python-specific advisory (in OSV format)
RUSTSEC-2024-0001  - Rust-specific advisory (in OSV format)
GO-2024-2611       - Go-specific advisory (in OSV format)
```

---

## 3. SCA Tools

### 3.1 Snyk

Snyk provides SCA for packages, containers, and IaC with IDE, CLI, and CI integration.

**CLI usage:**

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Test with severity threshold
snyk test --severity-threshold=high

# Test a specific manifest file
snyk test --file=requirements.txt

# Monitor project (continuous monitoring)
snyk monitor

# Test container image
snyk container test my-image:latest

# Test IaC files
snyk iac test terraform/

# JSON output for CI parsing
snyk test --json --json-file-output=snyk-results.json
```

**CI integration (GitHub Actions):**

```yaml
# .github/workflows/snyk.yml
name: Snyk Security
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        continue-on-error: false
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all

      - name: Run Snyk to check container
        uses: snyk/actions/docker@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          image: my-app:${{ github.sha }}
          args: --severity-threshold=high

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: snyk.sarif
        if: always()
```

**Snyk configuration file:**

```yaml
# .snyk
version: v1.5.0
ignore:
  SNYK-JS-LODASH-567746:
    - '*':
        reason: "Not exploitable in our usage context"
        expires: 2025-06-30T00:00:00.000Z
        created: 2025-01-15T00:00:00.000Z
  SNYK-PYTHON-REQUESTS-5595532:
    - '*':
        reason: "We validate URLs before passing to requests"
        expires: 2025-03-15T00:00:00.000Z
patch: {}
```

### 3.2 Dependabot (GitHub Native)

Dependabot automatically creates pull requests to update vulnerable dependencies.

```yaml
# .github/dependabot.yml
version: 2
updates:
  # JavaScript / npm
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
    allow:
      - dependency-type: "direct"
      - dependency-type: "indirect"
    ignore:
      - dependency-name: "aws-sdk"
        update-types: ["version-update:semver-major"]
    groups:
      production-dependencies:
        dependency-type: "production"
        update-types:
          - "patch"
          - "minor"
      development-dependencies:
        dependency-type: "development"

  # Python / pip
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"

  # Docker
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "ci-cd"

  # Go modules
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"

  # Terraform
  - package-ecosystem: "terraform"
    directory: "/infra"
    schedule:
      interval: "monthly"
```

### 3.3 OWASP Dependency-Check

```bash
# Install via CLI
# Download from https://github.com/jeremylong/DependencyCheck

# Run scan
dependency-check.sh \
  --project "My Project" \
  --scan ./src \
  --format HTML \
  --format JSON \
  --out ./reports \
  --failOnCVSS 7 \
  --enableExperimental

# Maven plugin
mvn org.owasp:dependency-check-maven:check
```

```xml
<!-- pom.xml - Maven plugin configuration -->
<plugin>
  <groupId>org.owasp</groupId>
  <artifactId>dependency-check-maven</artifactId>
  <version>9.0.7</version>
  <configuration>
    <failBuildOnCVSS>7</failBuildOnCVSS>
    <formats>
      <format>HTML</format>
      <format>JSON</format>
      <format>SARIF</format>
    </formats>
    <suppressionFiles>
      <suppressionFile>dependency-check-suppressions.xml</suppressionFile>
    </suppressionFiles>
  </configuration>
  <executions>
    <execution>
      <goals>
        <goal>check</goal>
      </goals>
    </execution>
  </executions>
</plugin>
```

**Suppression file:**

```xml
<!-- dependency-check-suppressions.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<suppressions xmlns="https://jeremylong.github.io/DependencyCheck/dependency-suppression.1.3.xsd">
  <suppress>
    <notes>
      False positive: CVE applies to server-side usage;
      we use this library client-side only.
    </notes>
    <packageUrl regex="true">^pkg:npm/example-lib@.*$</packageUrl>
    <cve>CVE-2024-12345</cve>
  </suppress>

  <suppress until="2025-06-30Z">
    <notes>
      Temporary suppression: no patch available yet.
      Tracked in JIRA-4567. Review by June 2025.
    </notes>
    <packageUrl regex="true">^pkg:maven/com\.example/lib@.*$</packageUrl>
    <vulnerabilityName>CVE-2024-67890</vulnerabilityName>
  </suppress>
</suppressions>
```

### 3.4 Trivy

Trivy is a comprehensive scanner for containers, filesystems, Git repositories,
and Kubernetes.

```bash
# Install Trivy
# macOS
brew install trivy
# Linux
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh

# Scan filesystem for vulnerabilities
trivy fs --severity HIGH,CRITICAL .

# Scan container image
trivy image --severity HIGH,CRITICAL my-app:latest

# Scan with SBOM output
trivy fs --format cyclonedx --output sbom.json .

# Scan Kubernetes cluster
trivy k8s --report=summary cluster

# Scan specific lock files
trivy fs --scanners vuln package-lock.json

# Output in SARIF format
trivy fs --format sarif --output trivy-results.sarif .
```

**Trivy CI integration:**

```yaml
# .github/workflows/trivy.yml
name: Trivy Security Scan
on:
  push:
    branches: [main]
  pull_request:

jobs:
  trivy-fs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner (filesystem)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          format: 'sarif'
          output: 'trivy-fs-results.sarif'

      - name: Upload Trivy SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-fs-results.sarif'

  trivy-image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t my-app:${{ github.sha }} .

      - name: Run Trivy vulnerability scanner (image)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'my-app:${{ github.sha }}'
          severity: 'CRITICAL,HIGH'
          format: 'sarif'
          output: 'trivy-image-results.sarif'
          exit-code: '1'

      - name: Upload Trivy SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-image-results.sarif'
        if: always()
```

### 3.5 Grype (Anchore)

```bash
# Install Grype
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh

# Scan a directory
grype dir:. --only-fixed --fail-on high

# Scan a container image
grype my-app:latest --fail-on critical

# Scan an SBOM
grype sbom:./sbom.json

# Output in specific formats
grype dir:. -o json > grype-results.json
grype dir:. -o sarif > grype-results.sarif
grype dir:. -o table
```

### 3.6 Language-Specific SCA Tools

**npm audit (JavaScript/TypeScript):**

```bash
# Run npm audit
npm audit

# Fix automatically (patch and minor updates only)
npm audit fix

# JSON output for CI
npm audit --json > npm-audit-results.json

# Only production dependencies
npm audit --omit=dev

# Fail on specific severity
npm audit --audit-level=high
```

**pip-audit (Python):**

```bash
# Install
pip install pip-audit

# Audit current environment
pip-audit

# Audit a requirements file
pip-audit -r requirements.txt

# Output in JSON
pip-audit -f json -o pip-audit-results.json

# Fix vulnerabilities automatically
pip-audit --fix

# Strict mode (fail on any finding)
pip-audit --strict
```

**govulncheck (Go):**

```bash
# Install
go install golang.org/x/vuln/cmd/govulncheck@latest

# Run against current module
govulncheck ./...

# Run against a specific package
govulncheck -test ./...

# JSON output
govulncheck -json ./... > govulncheck-results.json

# Scan a binary
govulncheck -mode=binary ./my-binary
```

**cargo-audit (Rust):**

```bash
# Install
cargo install cargo-audit

# Run audit
cargo audit

# JSON output
cargo audit --json > cargo-audit-results.json

# Fix automatically
cargo audit fix

# Deny specific advisories
cargo audit --deny warnings
```

**bundler-audit (Ruby):**

```bash
# Install
gem install bundler-audit

# Run audit
bundle-audit check

# Update advisory database
bundle-audit update

# JSON output
bundle-audit check --format json > bundler-audit-results.json
```

---

## 4. Reachability Analysis

Not every vulnerable dependency is actually exploitable. Reachability analysis
determines whether the vulnerable code path is actually invoked by your application.

### 4.1 Concept

```
Dependency: lodash@4.17.20
Vulnerability: CVE-2021-23337 (Command Injection in lodash.template)
Question: Does your application call lodash.template()?

Case A - REACHABLE:
  import { template } from 'lodash';
  const compiled = template(userInput);  // Vulnerable!
  --> Priority: HIGH - vulnerable function is called with user input

Case B - NOT REACHABLE:
  import { debounce, throttle } from 'lodash';
  // lodash.template is never imported or called
  --> Priority: LOW - vulnerable function is not used
```

### 4.2 Tools Supporting Reachability

| Tool | Reachability Support |
|---|---|
| Snyk | Reachability analysis for Java, JavaScript |
| govulncheck | Native reachability (Go call graph analysis) |
| Eclipse Steady | Deep reachability analysis for Java |
| Endor Labs | Reachability across multiple languages |

**govulncheck reachability example:**

```bash
$ govulncheck ./...
Scanning your code and 234 packages across 12 modules for known vulnerabilities...

Vulnerability #1: GO-2024-2611
    An attacker may cause an HTTP/2 endpoint to read arbitrary amounts of
    header data by sending an excessive number of CONTINUATION frames.
    Found in: golang.org/x/net@v0.17.0
    Fixed in: golang.org/x/net@v0.23.0
    Call stacks in your code:
      cmd/server/main.go:45:2  -> net/http.ListenAndServeTLS
        -> golang.org/x/net/http2.(*Server).ServeConn

# govulncheck only reports vulnerabilities that are actually reachable
# through your code's call graph
```

---

## 5. License Compliance

### 5.1 License Categories

```
Permissive (low risk):
  - MIT, BSD-2-Clause, BSD-3-Clause, ISC, Apache-2.0
  - Allow commercial use, modification, distribution
  - Require attribution (copyright notice)

Weak copyleft (moderate risk):
  - LGPL-2.1, LGPL-3.0, MPL-2.0, EPL-2.0
  - Modifications to the library must be shared
  - Your application code can remain proprietary

Strong copyleft (high risk):
  - GPL-2.0, GPL-3.0, AGPL-3.0
  - Derivative works must use the same license
  - AGPL: even network use triggers copyleft

Unknown / No license (highest risk):
  - No license means all rights reserved by the author
  - You may not legally use, modify, or distribute
  - Requires legal review before use
```

### 5.2 License Policy Configuration

```yaml
# .licensepolicy.yml (for tools like FOSSA, Snyk)
allowed_licenses:
  - MIT
  - BSD-2-Clause
  - BSD-3-Clause
  - ISC
  - Apache-2.0
  - CC0-1.0
  - Unlicense

review_required:
  - LGPL-2.1
  - LGPL-3.0
  - MPL-2.0
  - EPL-2.0

denied_licenses:
  - GPL-2.0
  - GPL-3.0
  - AGPL-3.0
  - SSPL-1.0
  - BSL-1.1

exceptions:
  - package: "readline"
    license: "GPL-3.0"
    reason: "Development dependency only, not distributed"
    approved_by: "legal-team"
    approved_date: "2025-01-15"
```

---

## 6. SBOM Generation

Software Bill of Materials (SBOM) provides a machine-readable inventory of all
components in your software.

### 6.1 SBOM Formats

| Format | Organization | Usage |
|---|---|---|
| CycloneDX | OWASP | Security-focused, rich vulnerability data |
| SPDX | Linux Foundation | License-focused, ISO standard (ISO/IEC 5962:2021) |

### 6.2 Generating SBOMs

```bash
# Trivy - CycloneDX SBOM
trivy fs --format cyclonedx --output sbom-cyclonedx.json .

# Trivy - SPDX SBOM
trivy fs --format spdx-json --output sbom-spdx.json .

# Syft (Anchore) - CycloneDX
syft dir:. -o cyclonedx-json > sbom-cyclonedx.json

# Syft - SPDX
syft dir:. -o spdx-json > sbom-spdx.json

# CycloneDX CLI tools by ecosystem
# JavaScript
npx @cyclonedx/cyclonedx-npm --output-file sbom.json

# Python
pip install cyclonedx-bom
cyclonedx-py environment --output sbom.json

# Go
go install github.com/CycloneDX/cyclonedx-gomod/cmd/cyclonedx-gomod@latest
cyclonedx-gomod mod -json -output sbom.json

# Java (Maven)
mvn org.cyclonedx:cyclonedx-maven-plugin:makeBom
```

**CI SBOM generation:**

```yaml
# .github/workflows/sbom.yml
name: Generate SBOM
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate SBOM with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          format: 'cyclonedx'
          output: 'sbom.json'

      - name: Upload SBOM as release artifact
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.json

      - name: Attach SBOM to GitHub release
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v1
        with:
          files: sbom.json
```

---

## 7. CI Integration Patterns

### 7.1 Break Build on Severity Threshold

```yaml
# .github/workflows/sca-gate.yml
name: SCA Security Gate
on:
  pull_request:
    branches: [main]

jobs:
  sca-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: npm audit (fail on high)
        run: npm audit --audit-level=high

      - name: Snyk test (fail on high)
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=upgradable

      - name: Trivy filesystem scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 7.2 Auto-PR for Patches

```yaml
# Dependabot auto-merge for patch updates
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-Merge
on:
  pull_request:
    types: [opened, synchronize]

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
        if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Auto-merge minor updates (dev dependencies)
        if: >-
          steps.metadata.outputs.update-type == 'version-update:semver-minor' &&
          steps.metadata.outputs.dependency-type == 'direct:development'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 8. Prioritization Framework

### 8.1 Multi-Factor Prioritization

Not all vulnerabilities deserve equal attention. Use a multi-factor model:

```
Priority Score = f(CVSS, EPSS, Reachability, Business Context)

Factor 1: CVSS Score (severity of the vulnerability itself)
  Critical (9.0-10.0) = weight 4
  High (7.0-8.9)      = weight 3
  Medium (4.0-6.9)    = weight 2
  Low (0.1-3.9)       = weight 1

Factor 2: EPSS (Exploit Prediction Scoring System)
  Probability of exploitation in the next 30 days
  > 0.5 (50%)  = weight 4  (actively exploited)
  > 0.1 (10%)  = weight 3  (likely to be exploited)
  > 0.01 (1%)  = weight 2  (possible exploitation)
  < 0.01       = weight 1  (unlikely exploitation)

Factor 3: Reachability
  Reachable with user input = weight 4
  Reachable without user input = weight 3
  Imported but not called = weight 2
  Transitive, not reachable = weight 1

Factor 4: Business Context
  Internet-facing service = weight 4
  Internal service with sensitive data = weight 3
  Internal service, non-sensitive = weight 2
  Development/build tool only = weight 1

Final Priority = sum(weights) / 16 * 100
  > 75%  = Fix immediately (within 48 hours)
  > 50%  = Fix within current sprint
  > 25%  = Fix within current quarter
  < 25%  = Backlog / accept risk
```

### 8.2 Decision Matrix

```
                          REACHABLE        NOT REACHABLE
                     +------------------+------------------+
  EPSS > 10%         | FIX IMMEDIATELY  | FIX THIS SPRINT  |
  (likely exploit)   |                  |                  |
                     +------------------+------------------+
  EPSS < 10%         | FIX THIS SPRINT  | FIX THIS QUARTER |
  (unlikely exploit) |                  | OR ACCEPT RISK   |
                     +------------------+------------------+
```

---

## 9. Transitive Dependency Management

### 9.1 Understanding the Risk

Most vulnerabilities in the dependency tree exist in transitive dependencies:

```
your-app
+-- express@4.18.2
    +-- qs@6.11.0
        +-- side-channel@1.0.4  <-- CVE here, 3 levels deep
```

### 9.2 Overriding Transitive Dependencies

**npm overrides:**

```json
{
  "overrides": {
    "qs": "6.12.0",
    "side-channel": ">=1.0.5"
  }
}
```

**yarn resolutions:**

```json
{
  "resolutions": {
    "qs": "6.12.0",
    "**/side-channel": ">=1.0.5"
  }
}
```

**pip constraints:**

```
# constraints.txt
cryptography>=42.0.0
urllib3>=2.0.7
certifi>=2024.2.2
```

```bash
pip install -c constraints.txt -r requirements.txt
```

**Maven dependency management:**

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.apache.logging.log4j</groupId>
      <artifactId>log4j-core</artifactId>
      <version>2.23.0</version>
    </dependency>
  </dependencies>
</dependencyManagement>
```

**Go replace directives:**

```go
// go.mod
module myapp

go 1.22

require (
    github.com/example/lib v1.2.3
)

replace golang.org/x/net => golang.org/x/net v0.23.0
```

---

## 10. Best Practices

1. **Enable automated dependency updates.** Configure Dependabot, Renovate, or
   equivalent to automatically create PRs for vulnerable dependencies. Auto-merge
   patch-level security updates with passing CI to reduce manual toil.

2. **Scan both direct and transitive dependencies.** Most vulnerabilities exist in
   transitive dependencies. Use tools that build the full dependency tree and report
   on all levels, not just direct dependencies.

3. **Prioritize by reachability, not just CVSS.** A critical-severity CVE in a
   function your code never calls is less urgent than a high-severity CVE in a
   function called on every request with user input. Use reachability analysis to
   focus remediation effort.

4. **Generate and maintain SBOMs.** Produce CycloneDX or SPDX SBOMs on every release.
   SBOMs enable rapid impact assessment when new vulnerabilities are disclosed
   (e.g., "Do we use log4j anywhere?").

5. **Enforce license policies in CI.** Define allowed, review-required, and denied
   license lists. Block PRs that introduce dependencies with incompatible licenses.
   Review unknown licenses before approving.

6. **Use lock files and pin dependency versions.** Lock files ensure reproducible
   builds and prevent supply chain attacks via dependency confusion. Never deploy
   with floating version ranges in production.

7. **Monitor continuously, not just at build time.** New CVEs are published daily.
   Use tools like Snyk Monitor, GitHub Dependabot alerts, or Grype scheduled scans
   to detect new vulnerabilities in already-deployed versions.

8. **Set break-build thresholds by severity.** Block merges on critical and high
   severity findings with available fixes. Allow medium and low findings with a
   time-bound SLA for remediation.

9. **Track and review suppressed/ignored vulnerabilities.** Every ignored finding
   must have a documented reason and an expiration date. Schedule quarterly reviews
   to reassess suppressions and check for available patches.

10. **Minimize dependency count.** Fewer dependencies mean fewer vulnerability
    surfaces and less maintenance burden. Before adding a dependency, evaluate
    whether the functionality can be implemented directly or whether a lighter
    alternative exists.

---

## 11. Anti-Patterns

1. **Ignoring transitive dependencies.** "We did not choose that library" is not a
   valid excuse. Your application ships with all transitive dependencies, and
   attackers exploit the full dependency tree.

2. **Relying solely on npm audit / pip-audit.** Built-in tools have limited databases
   and no reachability analysis. Supplement with Snyk, Trivy, or Grype for
   comprehensive coverage.

3. **Auto-merging all dependency updates without CI checks.** Blindly merging
   dependency updates can introduce breaking changes or supply chain attacks.
   Always require passing CI before merging, even for automated updates.

4. **Suppressing findings without expiration dates.** Permanent suppressions
   accumulate indefinitely. Always set an expiration date so findings are
   re-evaluated when patches may have become available.

5. **Treating all CVEs with equal urgency.** Not every CVE is exploitable in your
   context. Without prioritization, teams either burn out fixing low-risk findings
   or give up and ignore everything.

6. **Using floating version ranges in production.** Ranges like `^1.0.0` or `>=2.0`
   can pull in untested versions at build time, including potentially compromised
   packages. Always use exact versions via lock files.

7. **Running SCA only in CI, not locally.** Developers should be able to check for
   vulnerabilities before pushing code. Provide CLI tools and IDE plugins for
   local scanning.

8. **Neglecting license compliance.** Open-source license violations can lead to
   legal action, forced code disclosure, or product recalls. License compliance
   is a legal requirement, not an optional nice-to-have.

---

## 12. Enforcement Checklist

```
SCA ENFORCEMENT CHECKLIST
=========================

Tool Configuration:
[ ] Primary SCA tool selected and configured (Snyk, Trivy, Grype, or equivalent)
[ ] Language-specific tools configured (npm audit, pip-audit, govulncheck, etc.)
[ ] Automated dependency update bot configured (Dependabot, Renovate)
[ ] SBOM generation configured for releases
[ ] License policy defined and enforced

CI/CD Integration:
[ ] SCA runs on every pull request
[ ] Break-build thresholds set (Critical/High block merge)
[ ] SARIF results uploaded to GitHub Security tab (or equivalent)
[ ] Container image scanning in build pipeline
[ ] Auto-merge configured for patch-level security updates with passing CI

Vulnerability Management:
[ ] Suppression policy defined (reason required, expiration date required)
[ ] Prioritization framework documented (CVSS + EPSS + reachability)
[ ] SLAs defined per severity (Critical: 48h, High: 1 sprint, etc.)
[ ] Transitive dependency override process documented
[ ] Continuous monitoring enabled (not just build-time scanning)

License Compliance:
[ ] Allowed license list defined and approved by legal
[ ] Denied license list defined and enforced in CI
[ ] Review process for unknown or borderline licenses documented
[ ] License exceptions require legal team approval

SBOM and Inventory:
[ ] SBOM generated in CycloneDX or SPDX format on every release
[ ] SBOM attached to release artifacts
[ ] SBOM inventory queryable for rapid impact assessment
[ ] SBOM updated when dependencies change

Governance:
[ ] SCA configuration version-controlled in the repository
[ ] Quarterly review of suppressed/ignored vulnerabilities scheduled
[ ] Dependency hygiene metrics tracked (total deps, vuln count, MTTR)
[ ] New dependency approval process defined
[ ] SCA results included in security governance meetings
```
