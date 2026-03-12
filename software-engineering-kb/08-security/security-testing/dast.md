# Dynamic Application Security Testing (DAST)

## Metadata
- **Category:** Security Testing
- **Scope:** Runtime vulnerability detection via black-box testing
- **Audience:** Software engineers, security engineers, QA engineers, DevSecOps practitioners
- **Prerequisites:** Web application fundamentals, HTTP protocol, CI/CD basics
- **Last Updated:** 2025-01

---

## 1. How DAST Works

Dynamic Application Security Testing interacts with a running application from the
outside, simulating an attacker who has no knowledge of the source code. DAST tools
send crafted HTTP requests and analyze responses to identify vulnerabilities.

### 1.1 Black-Box Testing Model

DAST treats the application as an opaque system. It has no access to source code,
architecture diagrams, or internal state. It discovers vulnerabilities by observing
how the application responds to various inputs.

```
DAST Scanner                     Target Application
    |                                    |
    |-- Crawl / Spider ----------------->|
    |<-- Discover pages, forms, APIs ----|
    |                                    |
    |-- Send attack payloads ----------->|
    |<-- Analyze responses --------------|
    |                                    |
    |-- Identify vulnerabilities         |
    |-- Generate report                  |
```

### 1.2 Crawling and Discovery

The scanner begins by crawling the application to discover all accessible endpoints,
forms, parameters, and resources.

**Traditional crawling:**
- Follow hyperlinks, parse HTML forms
- Extract URLs from JavaScript (limited in older tools)
- Build a site map of discovered endpoints

**Modern crawling (JavaScript rendering):**
- Use headless browsers (Chromium, Firefox) to render pages
- Execute JavaScript to discover dynamically generated content
- Handle single-page applications (SPAs) built with React, Angular, Vue
- Interact with AJAX endpoints

### 1.3 Attack Simulation

After discovery, the scanner replays requests with modified parameters, injecting
attack payloads designed to trigger specific vulnerability classes:

| Vulnerability | Attack Payload Example |
|---|---|
| SQL Injection | `' OR 1=1 --` |
| XSS (Reflected) | `<script>alert(1)</script>` |
| Path Traversal | `../../etc/passwd` |
| Command Injection | `; cat /etc/passwd` |
| SSRF | `http://169.254.169.254/latest/meta-data/` |
| Open Redirect | `//evil.com` |
| Header Injection | `\r\nX-Injected: true` |

### 1.4 Response Analysis

The scanner analyzes responses to determine whether an attack succeeded:

- **Reflected payloads:** Check if injected content appears unescaped in the response
- **Error messages:** Database errors indicate SQL injection potential
- **Timing differences:** Slow responses may indicate blind SQL injection
- **Status codes:** Unexpected 200 on restricted resources indicates access control flaws
- **Out-of-band callbacks:** DNS or HTTP callbacks confirm SSRF, XXE, or blind injection

---

## 2. DAST Tools

### 2.1 OWASP ZAP (Zed Attack Proxy)

ZAP is a free, open-source DAST tool maintained by the OWASP community. It supports
scriptable scanning, API testing, and CI/CD integration.

**Installation:**

```bash
# Docker (recommended for CI)
docker pull ghcr.io/zaproxy/zaproxy:stable

# Or install via package manager
# macOS
brew install --cask zap
# Linux (snap)
snap install zaproxy --classic
```

**Baseline scan (quick, non-invasive):**

```bash
# ZAP baseline scan - passive scanning only, safe for production
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://target-app.example.com \
  -r baseline-report.html \
  -J baseline-report.json \
  -l WARN
```

**Full scan (active scanning, attacks the application):**

```bash
# ZAP full scan - includes active scanning with attack payloads
# Run ONLY against test/staging environments
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
  -t https://staging.example.com \
  -r full-report.html \
  -J full-report.json \
  -m 60 \
  -l WARN
```

**API scan (OpenAPI/Swagger):**

```bash
# ZAP API scan from OpenAPI specification
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t https://staging.example.com/api/v1/openapi.json \
  -f openapi \
  -r api-report.html \
  -J api-report.json
```

**ZAP Automation Framework:**

```yaml
# zap-automation.yaml
env:
  contexts:
    - name: "My Application"
      urls:
        - "https://staging.example.com"
      includePaths:
        - "https://staging.example.com/.*"
      excludePaths:
        - "https://staging.example.com/logout.*"
      authentication:
        method: "form"
        parameters:
          loginPageUrl: "https://staging.example.com/login"
          loginRequestUrl: "https://staging.example.com/api/auth/login"
          loginRequestBody: "username={%username%}&password={%password%}"
        verification:
          method: "response"
          pollFrequency: 60
          pollUnits: "requests"
          pollUrl: "https://staging.example.com/api/me"
          pollPostData: ""
      users:
        - name: "test-user"
          credentials:
            username: "${DAST_USERNAME}"
            password: "${DAST_PASSWORD}"

jobs:
  - type: passiveScan-config
    parameters:
      maxAlertsPerRule: 10
      scanOnlyInScope: true

  - type: spider
    parameters:
      context: "My Application"
      user: "test-user"
      maxDuration: 5
      maxDepth: 10
      maxChildren: 20

  - type: spiderAjax
    parameters:
      context: "My Application"
      user: "test-user"
      maxDuration: 5
      maxCrawlDepth: 5

  - type: passiveScan-wait
    parameters:
      maxDuration: 10

  - type: activeScan
    parameters:
      context: "My Application"
      user: "test-user"
      maxRuleDurationInMins: 5
      maxScanDurationInMins: 30
      policy: "API-Focused-Policy"

  - type: report
    parameters:
      template: "traditional-html"
      reportDir: "/zap/wrk/reports"
      reportFile: "zap-report"
    risks:
      - high
      - medium
      - low
```

```bash
# Run ZAP with automation framework
docker run -v $(pwd):/zap/wrk/:rw \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap.sh -cmd \
  -autorun /zap/wrk/zap-automation.yaml
```

### 2.2 Burp Suite

Burp Suite Professional provides advanced DAST capabilities with a powerful
interactive proxy and automated scanner.

**Burp Suite CI/CD Integration (Burp Suite Enterprise / DAST):**

```bash
# Burp Suite Enterprise Edition CLI scan
burpsuite_enterprise_edition_cli \
  --url https://staging.example.com \
  --config burp-config.json \
  --report-type JUNIT \
  --report-file burp-results.xml
```

**Burp Suite configuration for CI:**

```json
{
  "scan_configurations": [
    {
      "name": "CI Scan Configuration",
      "type": "NamedConfiguration",
      "scan_configuration_fragment": {
        "scanner": {
          "active_scanning_optimization": {
            "scan_speed": "fast",
            "scan_accuracy": "normal"
          },
          "active_scanning_areas": {
            "sql_injection": true,
            "xss_reflected": true,
            "xss_stored": true,
            "command_injection": true,
            "path_traversal": true,
            "ssrf": true,
            "xxe": true
          }
        },
        "crawler": {
          "max_crawl_depth": 8,
          "max_link_depth": 10,
          "crawl_limits": {
            "max_time_mins": 30,
            "max_unique_locations": 500
          }
        }
      }
    }
  ]
}
```

### 2.3 Nuclei

Nuclei is a fast, template-based vulnerability scanner with a large community-maintained
template repository.

**Installation and basic usage:**

```bash
# Install Nuclei
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# Update templates
nuclei -update-templates

# Run all templates against a target
nuclei -u https://staging.example.com -o nuclei-results.txt

# Run specific template categories
nuclei -u https://staging.example.com \
  -tags cve,owasp-top-10 \
  -severity critical,high

# Run with rate limiting
nuclei -u https://staging.example.com \
  -rate-limit 100 \
  -bulk-size 25 \
  -concurrency 10

# Scan multiple targets from a file
nuclei -l targets.txt -tags cve -severity critical,high
```

**Writing custom Nuclei templates:**

```yaml
# custom-templates/api-key-disclosure.yaml
id: api-key-disclosure

info:
  name: API Key Disclosure in Response
  author: security-team
  severity: high
  description: API keys or tokens found in HTTP response body
  tags: exposure,api,tokens

http:
  - method: GET
    path:
      - "{{BaseURL}}/api/config"
      - "{{BaseURL}}/api/settings"
      - "{{BaseURL}}/.env"
      - "{{BaseURL}}/config.json"

    matchers-condition: or
    matchers:
      - type: regex
        regex:
          - "(?i)(api[_-]?key|api[_-]?secret|access[_-]?token)\\s*[:=]\\s*['\"][a-zA-Z0-9]{20,}['\"]"
          - "(?i)AKIA[0-9A-Z]{16}"  # AWS Access Key
          - "(?i)sk-[a-zA-Z0-9]{20,}"  # Stripe/OpenAI Secret Key

      - type: word
        words:
          - "BEGIN RSA PRIVATE KEY"
          - "BEGIN OPENSSH PRIVATE KEY"
          - "BEGIN EC PRIVATE KEY"
```

```yaml
# custom-templates/idor-check.yaml
id: idor-check

info:
  name: IDOR Check on User Endpoints
  author: security-team
  severity: high
  description: Check for insecure direct object references
  tags: idor,authorization

http:
  - raw:
      - |
        GET /api/users/{{user_id}}/profile HTTP/1.1
        Host: {{Hostname}}
        Authorization: Bearer {{token_user_b}}

    payloads:
      user_id:
        - "1"
        - "2"
        - "3"
        - "100"

    matchers-condition: and
    matchers:
      - type: status
        status:
          - 200
      - type: word
        words:
          - "email"
          - "phone"
        condition: or
```

### 2.4 Nikto

Nikto is a web server scanner focused on server-level misconfigurations.

```bash
# Install
apt-get install nikto

# Basic scan
nikto -h https://staging.example.com -o nikto-report.html -Format htm

# Scan with tuning options
nikto -h https://staging.example.com \
  -Tuning 123456789ab \
  -timeout 10 \
  -maxtime 30m

# Scan specific port
nikto -h staging.example.com -p 8443 -ssl
```

---

## 3. Authenticated Scanning

Unauthenticated scanning only tests the login page and public endpoints.
Authenticated scanning is essential for covering the majority of application
functionality.

### 3.1 Form-Based Authentication

```yaml
# ZAP Automation Framework - Form login
authentication:
  method: "form"
  parameters:
    loginPageUrl: "https://staging.example.com/login"
    loginRequestUrl: "https://staging.example.com/api/auth/login"
    loginRequestBody: "username={%username%}&password={%password%}"
  verification:
    method: "response"
    pollUrl: "https://staging.example.com/api/me"
    loggedInRegex: "\\Qusername\\E"
    loggedOutRegex: "\\QUnauthorized\\E"
```

### 3.2 Token-Based Authentication (API)

```bash
# ZAP with bearer token via script
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t https://staging.example.com/api/v1/openapi.json \
  -f openapi \
  -z "-config replacer.full_list(0).description=auth_header \
      -config replacer.full_list(0).enabled=true \
      -config replacer.full_list(0).matchtype=REQ_HEADER \
      -config replacer.full_list(0).matchstr=Authorization \
      -config replacer.full_list(0).regex=false \
      -config replacer.full_list(0).replacement='Bearer ${DAST_API_TOKEN}'"
```

### 3.3 Session Handling

```python
# ZAP Python API - session handling script
import zapv2
import requests

zap = zapv2.ZAPv2(
    apikey='your-zap-api-key',
    proxies={'http': 'http://127.0.0.1:8080', 'https': 'http://127.0.0.1:8080'}
)

# Authenticate and get token
auth_response = requests.post(
    'https://staging.example.com/api/auth/login',
    json={'username': 'testuser', 'password': 'testpass'},
    proxies={'http': 'http://127.0.0.1:8080', 'https': 'http://127.0.0.1:8080'},
    verify=False
)
token = auth_response.json()['token']

# Configure ZAP to use the token
zap.replacer.add_rule(
    description='Auth Token',
    enabled=True,
    matchtype='REQ_HEADER',
    matchregex=False,
    matchstring='Authorization',
    replacement=f'Bearer {token}'
)

# Start scan
scan_id = zap.ascan.scan(
    url='https://staging.example.com',
    recurse=True,
    inscopeonly=True
)
```

---

## 4. API Scanning

### 4.1 OpenAPI/Swagger Import

```bash
# ZAP API scan with OpenAPI spec
docker run -v $(pwd):/zap/wrk/:rw \
  -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t /zap/wrk/openapi.json \
  -f openapi \
  -r /zap/wrk/api-report.html

# Nuclei with OpenAPI
nuclei -u https://staging.example.com \
  -tags api \
  -severity critical,high
```

### 4.2 GraphQL Introspection Scanning

```bash
# Scan GraphQL endpoint with ZAP
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t https://staging.example.com/graphql \
  -f graphql \
  -r graphql-report.html

# Nuclei GraphQL templates
nuclei -u https://staging.example.com/graphql \
  -tags graphql \
  -severity critical,high,medium
```

### 4.3 Postman Collection Import

```bash
# Convert Postman collection to OpenAPI for ZAP
npx openapi-generator-cli generate \
  -i postman_collection.json \
  -g openapi-yaml \
  -o ./converted-spec/

# Then use the converted spec with ZAP
docker run -v $(pwd)/converted-spec:/zap/wrk/:rw \
  -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t /zap/wrk/openapi.yaml \
  -f openapi \
  -r api-report.html
```

---

## 5. CI/CD Integration

### 5.1 GitHub Actions with ZAP

```yaml
# .github/workflows/dast.yml
name: DAST Scan
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM

jobs:
  dast-baseline:
    name: ZAP Baseline Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start application
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30  # Wait for application to start

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: 'http://localhost:8080'
          rules_file_name: 'zap-rules.tsv'
          cmd_options: '-a -j'

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: zap-baseline-report
          path: report_html.html
        if: always()

  dast-full:
    name: ZAP Full Scan (Staging)
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: ZAP Full Scan
        uses: zaproxy/action-full-scan@v0.10.0
        with:
          target: ${{ vars.STAGING_URL }}
          rules_file_name: 'zap-rules.tsv'
          cmd_options: '-a -j -m 60'

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: zap-full-report
          path: report_html.html
        if: always()
```

**ZAP rules file for CI (tune false positives):**

```tsv
# zap-rules.tsv
# Rule ID	Action	Description
10010	IGNORE	Cookie No HttpOnly Flag (handled by framework)
10011	IGNORE	Cookie Without Secure Flag (dev environment)
10015	WARN	Incomplete or No Cache-control Header Set
10017	IGNORE	Cross-Domain JavaScript Source File Inclusion
10020	FAIL	X-Frame-Options Header Not Set
10021	FAIL	X-Content-Type-Options Header Missing
10035	FAIL	Strict-Transport-Security Header Not Set
10038	FAIL	Content Security Policy (CSP) Header Not Set
10098	WARN	Cross-Domain Misconfiguration
40012	FAIL	Cross Site Scripting (Reflected)
40014	FAIL	Cross Site Scripting (Persistent)
40018	FAIL	SQL Injection
40019	FAIL	SQL Injection (MySQL)
90022	FAIL	Application Error Disclosure
```

### 5.2 GitLab CI with ZAP

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - dast

dast:
  stage: dast
  image: ghcr.io/zaproxy/zaproxy:stable
  script:
    - zap-baseline.py
        -t $STAGING_URL
        -r zap-report.html
        -J zap-report.json
        -w zap-report.md
        -l WARN
  artifacts:
    paths:
      - zap-report.html
      - zap-report.json
    when: always
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### 5.3 Nuclei in CI

```yaml
# .github/workflows/nuclei.yml
name: Nuclei Scan
on:
  schedule:
    - cron: '0 3 * * 1'  # Weekly Monday at 3 AM
  workflow_dispatch:

jobs:
  nuclei-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Nuclei Scan
        uses: projectdiscovery/nuclei-action@main
        with:
          target: ${{ vars.STAGING_URL }}
          flags: "-severity critical,high -tags cve,owasp-top-10"
          output: nuclei-results.txt

      - name: Parse and fail on critical
        run: |
          if grep -q "\[critical\]" nuclei-results.txt 2>/dev/null; then
            echo "Critical vulnerabilities found!"
            cat nuclei-results.txt
            exit 1
          fi

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: nuclei-results
          path: nuclei-results.txt
        if: always()
```

---

## 6. DAST Scan Profiles

### 6.1 Baseline / Quick Scan

Use for every deployment or PR to staging. Completes in 5-15 minutes.

```
Baseline scan characteristics:
- Passive scanning only (no attack payloads)
- Analyze responses for information leakage
- Check security headers
- Detect missing HTTPS
- Check for cookie flags
- Identify server information disclosure
- No active attacks (safe for production)
```

### 6.2 Full / Active Scan

Use nightly or weekly on staging. Completes in 30 minutes to several hours.

```
Full scan characteristics:
- Active scanning with attack payloads
- SQL injection testing (various database flavors)
- XSS testing (reflected, stored, DOM-based)
- Path traversal testing
- Command injection testing
- SSRF testing
- Authentication bypass attempts
- NEVER run against production
```

### 6.3 Targeted Scan

Focus on specific endpoints or vulnerability classes after code changes.

```bash
# ZAP targeted scan on specific API endpoints
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t https://staging.example.com/api/v1/openapi.json \
  -f openapi \
  -r targeted-report.html \
  -z "-config scanner.strength=INSANE \
      -config scanner.threshold=LOW"
```

---

## 7. Handling False Positives

### 7.1 ZAP Alert Filters

```python
# ZAP Python API - configure alert filters
from zapv2 import ZAPv2

zap = ZAPv2(apikey='api-key')

# Remove known false positive alerts
zap.alertFilter.add_alert_filter(
    contextid='1',
    ruleid='10020',  # X-Frame-Options
    newlevel='-1',   # False positive
    url='https://staging.example.com/api/.*',
    urlisregex=True,
    parameter='',
    enabled=True
)
```

### 7.2 Verification Workflow

```
DAST Finding Triage:
1. Finding reported by scanner
   |
2. Automated deduplication (same URL + same vulnerability type)
   |
3. Severity classification (Critical, High, Medium, Low, Informational)
   |
4. Manual verification
   |
   +-- Reproduce manually with Burp Suite or curl
   |   |
   |   +-- Confirmed --> Create ticket with reproduction steps
   |   |
   |   +-- Not reproducible --> Mark as false positive with reason
   |
5. Track verified findings to resolution
```

---

## 8. DAST vs Penetration Testing

| Aspect | DAST | Penetration Testing |
|---|---|---|
| Automation | Fully automated | Manual with tool assistance |
| Scope | Predefined crawl scope | Flexible, tester-directed |
| Business logic | Cannot test | Primary strength |
| Frequency | Every build / nightly | Quarterly / annually |
| Cost | Tool license only | Skilled tester time |
| False positives | Moderate to high | Low (human-verified) |
| Coverage | Broad but shallow | Deep but narrow |
| Authentication bypass | Limited | Extensive |
| Chained exploits | None | Key capability |

DAST and penetration testing are complementary. DAST provides continuous automated
coverage; penetration testing provides deep, context-aware analysis.

---

## 9. Headless Browser Scanning

Modern SPAs require browser-based scanning to discover dynamic content.

```yaml
# ZAP Ajax Spider configuration for SPAs
jobs:
  - type: spiderAjax
    parameters:
      context: "SPA Application"
      maxDuration: 10
      maxCrawlDepth: 10
      maxCrawlStates: 0
      browserId: "chrome-headless"
      clickDefaultElems: true
      clickElemsOnce: true
      eventWait: 1000
      reloadWait: 1000
```

```bash
# ZAP with Ajax spider for SPAs
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
  -t https://staging.example.com \
  -r spa-report.html \
  -a  # Enable Ajax spider
```

---

## 10. Scan Scheduling Strategy

```
Scan Type          | Trigger              | Environment | Duration
-------------------|----------------------|-------------|----------
Baseline (passive) | Every deployment     | Staging     | 5-15 min
API scan           | API spec changes     | Staging     | 10-30 min
Full scan          | Nightly              | Staging     | 1-4 hours
Nuclei CVE scan    | Weekly               | Staging     | 15-30 min
Comprehensive scan | Before major release | Staging     | 4-8 hours
```

---

## 11. Modern DAST Considerations

### 11.1 API-First Scanning

Modern applications expose most functionality through APIs. DAST tools must support:

- OpenAPI / Swagger specification import
- GraphQL schema introspection
- gRPC service definition parsing
- WebSocket endpoint testing
- Custom API authentication (OAuth 2.0, API keys, JWT)

### 11.2 Microservices Architecture

```yaml
# Scan multiple services in a microservices architecture
# docker-compose.dast.yml
services:
  zap:
    image: ghcr.io/zaproxy/zaproxy:stable
    command: zap-api-scan.py -t http://api-gateway:8080/api/openapi.json -f openapi
    depends_on:
      - api-gateway
    networks:
      - test-network

  api-gateway:
    image: my-app/api-gateway:test
    ports:
      - "8080:8080"
    environment:
      - AUTH_SERVICE_URL=http://auth-service:8081
      - USER_SERVICE_URL=http://user-service:8082
    networks:
      - test-network

  auth-service:
    image: my-app/auth-service:test
    networks:
      - test-network

  user-service:
    image: my-app/user-service:test
    networks:
      - test-network

networks:
  test-network:
    driver: bridge
```

---

## 12. Best Practices

1. **Never run active scans against production.** Active scanning sends attack
   payloads that can corrupt data, trigger alerts, or cause service disruptions.
   Use staging or dedicated test environments that mirror production.

2. **Use authenticated scanning to maximize coverage.** Unauthenticated scans only
   test login pages and public content. Most vulnerabilities exist behind
   authentication. Configure proper login sequences and session handling.

3. **Import API specifications for complete API coverage.** Manual crawling misses
   API endpoints not linked from the UI. Import OpenAPI, Swagger, or GraphQL
   schemas so the scanner tests every documented endpoint.

4. **Tune scan rules to reduce noise.** Configure rule files (e.g., `zap-rules.tsv`)
   to suppress known false positives and focus on actionable findings. Review
   and update tuning configurations quarterly.

5. **Run baseline scans on every deployment, full scans nightly.** Baseline
   (passive) scans are fast and safe enough for every deployment pipeline.
   Reserve full (active) scans for scheduled nightly runs where scan duration
   is not a bottleneck.

6. **Integrate DAST into CI/CD with clear pass/fail criteria.** Define which
   severity levels block deployments (e.g., fail on High and Critical). Lower
   severity findings generate warnings but do not block.

7. **Combine DAST with SAST for comprehensive coverage.** SAST finds code-level
   issues DAST cannot see. DAST finds runtime, deployment, and configuration
   issues SAST cannot detect. Neither alone is sufficient.

8. **Use headless browser scanning for SPAs.** Traditional crawlers cannot discover
   content rendered by JavaScript frameworks. Configure ZAP Ajax Spider or
   equivalent browser-based crawling for React, Angular, and Vue applications.

9. **Verify all findings manually before creating tickets.** Automated scanners
   produce false positives. Reproduce each finding with a manual tool (Burp Suite,
   curl) before filing bug reports. Include reproduction steps in every ticket.

10. **Maintain dedicated DAST test credentials.** Create service accounts
    specifically for DAST scanning. These accounts should have representative
    permissions but be easily distinguishable in logs. Rotate credentials regularly.

---

## 13. Anti-Patterns

1. **Running DAST only before releases.** Vulnerabilities accumulate undetected
   between scans. Integrate DAST into CI/CD for continuous feedback rather than
   treating it as a periodic gate.

2. **Scanning production with active attacks.** Active scanning can cause data
   corruption, account lockouts, and service degradation. Production scanning
   should be limited to passive analysis or out-of-band techniques.

3. **Ignoring unauthenticated scan results because "real attacks need auth."**
   Many critical vulnerabilities (information disclosure, security header gaps,
   open redirects) are detectable without authentication. Do not dismiss
   unauthenticated findings.

4. **Using DAST as the only security testing method.** DAST cannot detect logic
   flaws, code-level vulnerabilities in unexposed paths, or issues in internal
   services not reachable from the scan target. Complement with SAST, SCA, and
   manual testing.

5. **Not tuning the scanner and drowning in false positives.** Untuned scanners
   produce hundreds of informational or false positive findings that overwhelm
   the team. Invest time in configuring rule files and alert filters.

6. **Scanning without a stable test environment.** If the test environment changes
   during a scan (deployments, data resets), results are unreliable. Ensure the
   environment is stable and data is consistent throughout the scan.

7. **Failing to scan API endpoints directly.** DAST tools that only crawl the web
   UI miss API-only functionality. Always import API specifications and scan
   endpoints directly, not just through the UI.

8. **Treating DAST scan output as final without human review.** DAST output
   requires expert interpretation. Automated severity ratings do not account for
   business context, compensating controls, or environmental factors. Always have
   a security-aware engineer review results.

---

## 14. Enforcement Checklist

```
DAST ENFORCEMENT CHECKLIST
==========================

Tool Selection and Configuration:
[ ] Primary DAST tool selected (ZAP, Burp Suite, or equivalent)
[ ] Supplementary scanner configured (Nuclei for CVE/template-based scanning)
[ ] Scan rules file created and tuned for the application
[ ] Authenticated scanning configured with valid test credentials
[ ] API specifications imported (OpenAPI, GraphQL schemas)
[ ] Ajax/headless browser scanning enabled for SPA applications

Scan Environments:
[ ] Dedicated staging environment for DAST scanning
[ ] Staging environment mirrors production configuration
[ ] Test data seeded for meaningful scan coverage
[ ] DAST-specific test accounts created with appropriate permissions
[ ] Network access verified between scanner and target

CI/CD Integration:
[ ] Baseline scan runs on every deployment to staging
[ ] Full scan runs on a nightly schedule
[ ] Nuclei CVE scan runs weekly
[ ] Pass/fail criteria defined (which severities block deployment)
[ ] Scan reports archived as CI artifacts
[ ] Scan results fed into vulnerability management system

Finding Management:
[ ] False positive identification and suppression process documented
[ ] Verification workflow defined (reproduce before filing)
[ ] Finding-to-ticket workflow automated where possible
[ ] SLAs defined per severity (Critical: 48h, High: 1 sprint, etc.)
[ ] Findings tracked in centralized vulnerability management dashboard

Governance:
[ ] DAST scan configurations version-controlled in the repository
[ ] Scan coverage reviewed quarterly
[ ] DAST tool and templates updated at least monthly
[ ] Comprehensive scan performed before every major release
[ ] DAST results included in security review meetings
```
