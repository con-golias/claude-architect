# Security Metrics and KPIs

## Overview

| Field          | Value                                                          |
|----------------|----------------------------------------------------------------|
| **Domain**     | DevSecOps, Security Governance, Risk Management                |
| **Scope**      | Measuring, reporting, and improving security posture            |
| **Audience**   | Security Leaders, Engineering Managers, CISOs, Developers      |
| **Maturity**   | Essential capability for mature security programs              |
| **Key Insight**| What gets measured gets improved; what gets reported gets funded |

---

## Why Measure Security

Security measurement serves four critical purposes that directly impact organizational outcomes:

### 1. Drive Improvement

Without metrics, security improvements are based on intuition rather than evidence. Metrics reveal where the organization is strong, where it is weak, and whether interventions are working.

### 2. Justify Security Investment

Security budgets compete with feature development for funding. Quantitative evidence of risk reduction, vulnerability trends, and incident prevention provides the data executives need to approve investment.

### 3. Demonstrate Compliance

Regulatory frameworks (SOC 2, PCI DSS, HIPAA, ISO 27001) require evidence that security controls are operating effectively. Metrics provide this evidence in a form auditors can verify.

### 4. Identify Trends

Individual vulnerabilities and incidents are symptoms. Trends in vulnerability density, MTTR, and incident frequency reveal systemic issues that require strategic response rather than tactical fixes.

```text
The Security Metrics Maturity Model:

Level 1 -- Ad Hoc:
  "We fix security issues when we find them."
  No consistent measurement. No baseline.

Level 2 -- Basic:
  "We count vulnerabilities and track SLAs."
  Simple counts and compliance tracking.

Level 3 -- Defined:
  "We track trends and compare across teams."
  Trend analysis, benchmarking, regular reporting.

Level 4 -- Managed:
  "We use metrics to drive decisions and predict risk."
  Predictive analytics, risk quantification, ROI analysis.

Level 5 -- Optimizing:
  "We continuously refine metrics to maximize security value."
  Advanced analytics, correlation analysis, industry benchmarking.
```

---

## Vulnerability Metrics

### Vulnerability Density

```text
Metric: Vulnerability Density
Definition: Number of security vulnerabilities per 1,000 lines of code (KLOC)
Formula: (Total open vulnerabilities) / (Total KLOC)

Purpose:
  - Normalize vulnerability counts across projects of different sizes
  - Enable fair comparison between teams
  - Track code quality improvement over time

Measurement:
  - Source: SAST scanner results + SCA results
  - Frequency: Monthly
  - Granularity: Per repository, per team, organization-wide

Targets:
  Industry Average: 5-15 vulnerabilities per KLOC
  Good: < 5 per KLOC
  Excellent: < 2 per KLOC
  World-class: < 1 per KLOC

Example Tracking:
  Repository       | KLOC | Vulns | Density | Trend
  auth-service     | 12   | 8     | 0.67    | Improving (was 1.2)
  payment-api      | 25   | 35    | 1.40    | Stable
  user-dashboard   | 40   | 120   | 3.00    | Needs attention
  data-pipeline    | 18   | 9     | 0.50    | Excellent
```

### Mean Time to Detect (MTTD)

```text
Metric: Mean Time to Detect (MTTD)
Definition: Average time between when a vulnerability is introduced
            and when it is first detected by any security tool or process
Formula: Average of (Detection Timestamp - Introduction Timestamp) for all findings

Purpose:
  - Measure the effectiveness of detection capabilities
  - Identify gaps in scanning coverage
  - Track improvement in detection speed

Measurement:
  - Source: Vulnerability management platform, git commit history
  - Frequency: Monthly
  - Challenge: Introduction timestamp requires correlation with git blame

Targets:
  Code vulnerabilities: < 7 days (ideally < 1 day with CI/CD scanning)
  Dependency vulnerabilities: < 24 hours after CVE publication
  Infrastructure vulnerabilities: < 48 hours
  Configuration drift: < 24 hours

Improvement Strategies:
  - Add SAST/SCA to CI pipeline (reduces MTTD to minutes for new code)
  - Subscribe to real-time CVE feeds (reduces MTTD for dependencies)
  - Run infrastructure scans daily instead of weekly
  - Enable IDE security plugins (reduces MTTD to seconds for new code)
```

### Mean Time to Remediate (MTTR)

```text
Metric: Mean Time to Remediate (MTTR)
Definition: Average time from vulnerability detection to verified fix in production
Formula: Average of (Fix Verification Timestamp - Detection Timestamp)

Purpose:
  - Measure organizational ability to respond to security findings
  - Track SLA compliance
  - Identify bottlenecks in the remediation process

Measurement:
  - Source: Vulnerability management platform, deployment logs
  - Frequency: Weekly (team level), Monthly (organization level)
  - Important: Clock stops when fix is VERIFIED in production, not when PR is merged

Current Performance and Targets:
  | Severity | Industry Avg | Target  | World-class |
  |----------|-------------|---------|-------------|
  | Critical | 30 days     | 3 days  | 24 hours    |
  | High     | 60 days     | 7 days  | 3 days      |
  | Medium   | 90 days     | 30 days | 14 days     |
  | Low      | 180+ days   | 90 days | 60 days     |

Breakdown Analysis:
  MTTR = Time to Assign + Time to Fix + Time to Review + Time to Deploy + Time to Verify

  Identify which component is the largest contributor:
  - Long assignment time -> Improve notification and triage process
  - Long fix time -> Provide better remediation guidance, training
  - Long review time -> Streamline security review process
  - Long deploy time -> Improve deployment pipeline
  - Long verify time -> Automate verification scanning
```

### Vulnerability Reopen Rate

```text
Metric: Vulnerability Reopen Rate
Definition: Percentage of remediated vulnerabilities that reappear in subsequent scans
Formula: (Reopened findings / Total closed findings) * 100

Purpose:
  - Measure the quality and completeness of fixes
  - Identify systemic issues requiring root cause analysis
  - Detect regressions in security controls

Measurement:
  - Source: Vulnerability management platform deduplication logic
  - Frequency: Monthly
  - Important: Distinguish between true reopens (same root cause) and new instances

Targets:
  Acceptable: < 10%
  Good: < 5%
  Excellent: < 2%

Root Causes of High Reopen Rates:
  - Incomplete fixes (symptom treated, not root cause)
  - Missing regression tests for security fixes
  - Copy-paste coding spreading the same vulnerability pattern
  - Framework or library issue affecting multiple locations
  - Developer misunderstanding of the vulnerability class

Actions for High Reopen Rate:
  - Require security unit tests for every security fix
  - Create custom SAST rules for recurring vulnerability patterns
  - Conduct training on the specific vulnerability class
  - Review framework/library for secure-by-default options
```

### Security Debt

```text
Metric: Security Debt
Definition: Accumulated unresolved security findings weighted by severity and age
Formula: Sum of (Severity_Weight * Days_Open) for all open findings

Severity Weights:
  Critical: 10
  High:     5
  Medium:   2
  Low:      1

Purpose:
  - Quantify the backlog of unresolved security issues
  - Track whether the organization is paying down or accumulating debt
  - Identify teams or repositories with disproportionate debt

Measurement:
  - Source: Vulnerability management platform
  - Frequency: Weekly
  - Visualization: Stacked area chart showing debt by severity over time

Example:
  Finding                      | Severity | Days Open | Debt Score
  SQL injection in search API  | Critical | 5         | 50
  XSS in user profile          | High     | 12        | 60
  Missing rate limiting        | Medium   | 30        | 60
  Weak TLS cipher support      | Low      | 90        | 90
  Total Security Debt Score:                           | 260

Trend Analysis:
  - Increasing debt: Organization is finding more than it is fixing
  - Stable debt: Finding and fixing at the same rate (not improving)
  - Decreasing debt: Fixing faster than finding (improving)
  - Target: Consistently decreasing trend with zero critical debt
```

### SLA Compliance Rate

```text
Metric: SLA Compliance Rate
Definition: Percentage of findings remediated within their severity-defined SLA
Formula: (Findings fixed within SLA / Total findings requiring remediation) * 100

SLA Targets:
  Critical: 24-72 hours
  High:     7 days
  Medium:   30 days
  Low:      90 days

Measurement:
  - Source: Vulnerability management platform
  - Frequency: Weekly (team), Monthly (organization)
  - Exclude: Risk-accepted findings with valid exception documentation

Targets:
  | Severity | Target Compliance | Minimum Acceptable |
  |----------|-------------------|--------------------|
  | Critical | 100%              | 95%                |
  | High     | 95%               | 90%                |
  | Medium   | 90%               | 80%                |
  | Low      | 85%               | 70%                |

Reporting:
  - Display as a gauge chart (green/yellow/red)
  - Show trend line over time
  - Break down by team for accountability
  - Highlight specific overdue findings for management attention
```

---

## Process Metrics

### Scan Coverage

```text
Metric: Security Scan Coverage
Definition: Percentage of projects/repositories with active security scanning
Formula: (Repositories with active scans / Total repositories) * 100

Breakdown by Scan Type:
  | Scan Type          | Target | Measurement Method                    |
  |--------------------|--------|----------------------------------------|
  | SAST               | 100%   | CI pipeline config audit               |
  | SCA                | 100%   | Dependency monitoring enrollment       |
  | Secrets Scanning   | 100%   | Pre-commit hook or CI step presence    |
  | Container Scanning | 100%   | All Dockerfiles scanned in CI          |
  | IaC Scanning       | 100%   | All Terraform/CloudFormation scanned   |
  | DAST               | 80%    | Web applications with DAST scheduled   |
  | License Check      | 90%    | CI pipeline config audit               |

Measurement Automation:
  - Query CI/CD platform API for pipeline configurations
  - Check for security scanning steps in each repository's pipeline
  - Report repositories without coverage as "uncovered"
  - Alert when new repositories are created without security scanning
```

```python
# Scan coverage measurement script
import requests
from collections import defaultdict

def measure_scan_coverage(github_org, scan_types):
    """Measure security scan coverage across all repositories."""
    repos = get_all_repositories(github_org)
    coverage = defaultdict(lambda: {"covered": 0, "uncovered": [], "total": 0})

    for repo in repos:
        if repo["archived"]:
            continue

        workflows = get_workflows(repo["full_name"])
        scan_indicators = analyze_workflows(workflows)

        for scan_type in scan_types:
            coverage[scan_type]["total"] += 1
            if scan_indicators.get(scan_type):
                coverage[scan_type]["covered"] += 1
            else:
                coverage[scan_type]["uncovered"].append(repo["name"])

    results = {}
    for scan_type, data in coverage.items():
        results[scan_type] = {
            "coverage_pct": (data["covered"] / data["total"] * 100)
                            if data["total"] > 0 else 0,
            "covered": data["covered"],
            "total": data["total"],
            "uncovered_repos": data["uncovered"],
        }

    return results

def analyze_workflows(workflows):
    """Analyze CI/CD workflows for security scanning indicators."""
    indicators = {
        "sast": False,
        "sca": False,
        "secrets": False,
        "container": False,
        "iac": False,
        "dast": False,
    }

    for workflow in workflows:
        content = workflow.get("content", "").lower()
        if any(tool in content for tool in ["semgrep", "codeql", "sonarqube", "checkmarx"]):
            indicators["sast"] = True
        if any(tool in content for tool in ["snyk", "dependabot", "grype", "npm audit"]):
            indicators["sca"] = True
        if any(tool in content for tool in ["gitleaks", "detect-secrets", "trufflehog"]):
            indicators["secrets"] = True
        if any(tool in content for tool in ["trivy", "grype", "docker scan"]):
            indicators["container"] = True
        if any(tool in content for tool in ["checkov", "tfsec", "terrascan"]):
            indicators["iac"] = True
        if any(tool in content for tool in ["zap", "nuclei", "dast"]):
            indicators["dast"] = True

    return indicators
```

### Code Review Security Coverage

```text
Metric: Security Code Review Coverage
Definition: Percentage of code changes that receive a security-focused review
Formula: (PRs with security review / Total PRs) * 100

Measurement Methods:
  1. Label-based: Track PRs with "security-reviewed" label
  2. Reviewer-based: Track PRs reviewed by security champions
  3. Checklist-based: Track PRs where security checklist is completed

Targets:
  High-risk changes (auth, payments, data): 100%
  All changes: > 50%

Definition of "Security-Focused Review":
  - Reviewer explicitly checks for security concerns (not just functional correctness)
  - Security checklist items addressed
  - Review conducted by security champion or security team member
```

### Threat Model Coverage

```text
Metric: Threat Model Coverage
Definition: Percentage of features and systems with documented, current threat models
Formula: (Systems with current threat model / Total systems) * 100

Current = Updated within the past 12 months or after any architecture change

Targets:
  Critical systems (Tier 1): 100%
  Important systems (Tier 2): 90%
  All systems: 75%

Tracking:
  - Maintain a registry of all systems/services
  - Record date of last threat model update
  - Alert when threat models are older than 12 months
  - Require threat model update for architecture change PRs
```

### Security Training Completion Rate

```text
Metric: Security Training Completion Rate
Definition: Percentage of developers who completed required security training
Formula: (Developers who completed training / Total developers) * 100

Training Requirements:
  - OWASP Top 10 awareness (annual): All developers
  - Secure coding for primary language (annual): All developers
  - Security champion training (initial + monthly): Champions only
  - Incident response training (annual): All on-call engineers

Targets:
  All developers: > 95% completion within 30 days of deadline
  New hires: 100% within first 90 days

Tracking:
  - LMS (Learning Management System) completion records
  - Quiz/assessment scores (minimum passing: 80%)
  - Monthly report to engineering managers
  - Quarterly report to VP Engineering
```

### Security Champion Engagement

```text
Metric: Security Champion Engagement
Definition: Composite score measuring active participation of security champions
Formula: See engagement scorecard below

Engagement Scorecard (Monthly per Champion):
  Activity                          | Weight | Score
  Attended monthly sync             | 15%    | 0 or 1
  PRs security-reviewed (min 5)     | 20%    | 0 to 1 (proportional)
  Findings triaged                  | 15%    | 0 to 1 (proportional)
  Security awareness activity       | 15%    | 0 or 1
  Threat model facilitated (quarterly) | 15% | 0 or 1
  Training completed                | 10%    | 0 or 1
  Team confidence score improvement | 10%    | 0 to 1

Overall Engagement Score: Weighted average (0 to 1)
  Highly Engaged: > 0.8
  Engaged: 0.5 - 0.8
  Needs Attention: 0.3 - 0.5
  Disengaged: < 0.3

Actions:
  - Monthly review with disengaged champions
  - Recognize highly engaged champions publicly
  - Investigate systemic issues if overall engagement drops
```

---

## Application Security Metrics

### OWASP ASVS Compliance Score

```text
Metric: OWASP Application Security Verification Standard (ASVS) Compliance
Definition: Percentage of ASVS requirements met by the application
Formula: (Requirements met / Total applicable requirements) * 100

ASVS Levels:
  Level 1: Standard (minimum for all applications)
  Level 2: Standard + defense in depth (recommended for most)
  Level 3: Advanced (high-value, high-assurance applications)

Assessment Areas:
  V1:  Architecture, Design, and Threat Modeling
  V2:  Authentication
  V3:  Session Management
  V4:  Access Control
  V5:  Validation, Sanitization, and Encoding
  V6:  Stored Cryptography
  V7:  Error Handling and Logging
  V8:  Data Protection
  V9:  Communication
  V10: Malicious Code
  V11: Business Logic
  V12: Files and Resources
  V13: API and Web Services
  V14: Configuration

Tracking:
  - Conduct ASVS assessment annually per application
  - Score each section independently
  - Track improvement trend
  - Target: Level 2 compliance for all production applications

Example:
  Application: payment-api
  Target Level: 2
  | Area          | Requirements | Met | Compliance |
  |---------------|-------------|-----|------------|
  | V2: Auth      | 28          | 25  | 89%        |
  | V3: Session   | 15          | 14  | 93%        |
  | V4: Access    | 22          | 18  | 82%        |
  | V5: Validation| 30          | 27  | 90%        |
  | V6: Crypto    | 12          | 11  | 92%        |
  | Overall       | 180         | 158 | 88%        |
```

### Dependency Freshness

```text
Metric: Dependency Freshness
Definition: How up-to-date are the application's dependencies
Formula: Average age of dependencies (days behind latest release)

Purpose:
  - Outdated dependencies are more likely to have known vulnerabilities
  - Freshness correlates with security posture
  - Encourages regular dependency maintenance

Measurement:
  - Use tool output (npm outdated, pip list --outdated, etc.)
  - Calculate days since latest release for each dependency
  - Report average and worst-case freshness

Categories:
  Fresh (< 30 days behind):  Green
  Stale (30-180 days):       Yellow
  Outdated (180-365 days):   Orange
  Critical (> 365 days):     Red

Targets:
  - Zero dependencies more than 365 days behind latest
  - Average freshness < 90 days
  - All security-relevant dependencies (crypto, auth, TLS) < 30 days
```

### Secrets in Code Count

```text
Metric: Secrets in Code
Definition: Number of detected secrets (API keys, passwords, tokens) in source code
Formula: Count of unresolved secret detection findings

Purpose:
  - Track effectiveness of secret scanning program
  - Identify teams or repositories with habitual secret commits
  - Measure improvement from training and tooling

Targets:
  New secrets committed per month: 0
  Total unresolved secrets: 0
  Time to remediate committed secret: < 1 hour

Measurement:
  - Source: detect-secrets, gitleaks, or trufflehog scan results
  - Scope: All repositories, including history
  - Exclude: Confirmed false positives with documented suppression
```

### Security Header Score

```text
Metric: Security Header Score
Definition: Compliance of HTTP security headers with best practices
Formula: Score from 0 to 100 based on header configuration

Assessed Headers:
  | Header                        | Weight | Target Value                     |
  |-------------------------------|--------|----------------------------------|
  | Content-Security-Policy       | 20%    | Restrictive policy, no unsafe-*  |
  | Strict-Transport-Security     | 15%    | max-age=63072000; includeSubDomains; preload |
  | X-Content-Type-Options        | 10%    | nosniff                          |
  | X-Frame-Options               | 10%    | DENY or SAMEORIGIN               |
  | Referrer-Policy               | 10%    | strict-origin-when-cross-origin  |
  | Permissions-Policy            | 10%    | Restrict unnecessary features    |
  | X-XSS-Protection              | 5%     | 0 (modern approach)              |
  | Cache-Control                 | 10%    | no-store for sensitive pages     |
  | Cross-Origin-Opener-Policy    | 5%     | same-origin                      |
  | Cross-Origin-Resource-Policy  | 5%     | same-origin                      |

Measurement:
  - Automated scan of all production endpoints monthly
  - Compare against securityheaders.com grading
  - Target: Grade A for all production domains

Automation:
  curl -sI https://app.example.com | grep -iE "^(content-security|strict-transport|x-content|x-frame|referrer-policy|permissions-policy)"
```

### TLS Configuration Grade

```text
Metric: TLS Configuration Grade
Definition: SSL/TLS configuration quality rating
Formula: Grade from F to A+ based on SSL Labs methodology

Assessed Components:
  - Protocol support (TLS 1.2+, no SSLv3, no TLS 1.0/1.1)
  - Key exchange (ECDHE preferred, RSA 2048+ minimum)
  - Cipher strength (AES-256-GCM, ChaCha20 preferred)
  - Certificate chain (valid, not expired, trusted CA)
  - HSTS header present and configured
  - OCSP stapling enabled
  - Certificate transparency

Targets:
  All production domains: A or A+
  Internal services: A minimum
  Zero domains with grade below B

Measurement:
  - SSL Labs API scan monthly
  - testssl.sh for internal services
  - Automated alerting when grade drops below target
```

---

## Operational Metrics

### Incident Count and Severity

```text
Metric: Security Incident Count and Distribution
Definition: Number of security incidents over time, categorized by severity
Formula: Count of incidents by severity per reporting period

Reporting:
  | Period | SEV1 | SEV2 | SEV3 | SEV4 | Total | Trend |
  |--------|------|------|------|------|-------|-------|
  | Jan    | 0    | 1    | 3    | 8    | 12    | -     |
  | Feb    | 1    | 0    | 2    | 6    | 9     | Down  |
  | Mar    | 0    | 2    | 4    | 5    | 11    | Up    |
  | Q1 Avg | 0.33 | 1.0  | 3.0  | 6.33 | 10.67 | -     |

Targets:
  SEV1: Zero (aspirational)
  SEV2: < 2 per quarter
  Total: Decreasing trend year over year
  Repeat incidents (same root cause): Zero
```

### Time to Containment

```text
Metric: Time to Containment
Definition: Time from incident detection to containment of the threat
Formula: Containment Timestamp - Detection Timestamp

Purpose:
  - Measure incident response speed
  - Identify bottlenecks in the response process
  - Track improvement in response capabilities

Targets:
  SEV1: < 1 hour containment
  SEV2: < 4 hours containment
  SEV3: < 24 hours containment

Measurement:
  - Source: Incident management platform timestamps
  - Track by severity level
  - Break down into: detection to acknowledgment, acknowledgment to containment
```

### False Positive Rate

```text
Metric: False Positive Rate
Definition: Percentage of security tool findings that are not real vulnerabilities
Formula: (False positive findings / Total findings) * 100

Purpose:
  - Measure security tool effectiveness
  - Identify tools needing tuning or replacement
  - Track the burden placed on developers by tool noise

By Tool:
  | Tool           | Total Findings | False Positives | FP Rate | Action    |
  |----------------|---------------|-----------------|---------|-----------|
  | Semgrep        | 150           | 15              | 10%     | Acceptable|
  | CodeQL         | 80            | 8               | 10%     | Acceptable|
  | Snyk           | 200           | 40              | 20%     | Monitor   |
  | Trivy          | 120           | 24              | 20%     | Monitor   |
  | detect-secrets | 50            | 25              | 50%     | Tune      |

Targets:
  Per tool: < 20% false positive rate
  Overall: < 15% false positive rate
  Action threshold: > 30% triggers tool tuning or replacement evaluation

Impact:
  High FP rate -> Developers ignore findings -> Real vulnerabilities missed
  Low FP rate -> Developers trust the tool -> Real vulnerabilities fixed
```

### Patch Compliance

```text
Metric: Patch Compliance
Definition: Percentage of systems running within N days of the latest security patch
Formula: (Systems within patch SLA / Total systems) * 100

Targets:
  Critical patches: 100% within 72 hours
  High patches: 95% within 14 days
  Medium patches: 90% within 30 days
  Overall patch compliance: > 95%

Measurement:
  - Source: Configuration management database, vulnerability scanners
  - Scope: All production servers, containers, managed services
  - Frequency: Weekly
```

---

## Business Metrics

### Risk Reduction Over Time

```text
Metric: Risk Reduction
Definition: Quantified decrease in organizational security risk
Formula: Composite of vulnerability, incident, and compliance metrics

Risk Score Calculation:
  Risk Score = (Vuln Density * 30) +
               (Overdue Critical Findings * 50) +
               (Overdue High Findings * 20) +
               (Scan Coverage Gap % * 10) +
               (Incident Count * Severity Weight) +
               (Compliance Gap % * 15)

Example:
  January Risk Score:
    Vuln Density (3.2) * 30     = 96
    Overdue Critical (2) * 50   = 100
    Overdue High (8) * 20       = 160
    Scan Gap (20%) * 10         = 200
    Incidents (1 SEV2) * 20     = 20
    Compliance Gap (15%) * 15   = 225
    TOTAL                       = 801

  March Risk Score:
    Vuln Density (2.1) * 30     = 63
    Overdue Critical (0) * 50   = 0
    Overdue High (3) * 20       = 60
    Scan Gap (5%) * 10          = 50
    Incidents (0) * 20          = 0
    Compliance Gap (8%) * 15    = 120
    TOTAL                       = 293

  Risk Reduction: 63% improvement
```

### Cost of Security Incidents

```text
Metric: Cost of Security Incidents
Definition: Total financial impact of security incidents
Formula: Direct costs + Indirect costs + Opportunity costs

Cost Components:
  Direct Costs:
    - Incident response labor hours * hourly rate
    - External forensics and legal fees
    - Regulatory fines and penalties
    - Customer notification costs
    - Credit monitoring services for affected customers
    - System remediation and hardening

  Indirect Costs:
    - Developer productivity lost during incident
    - Feature development delayed
    - Customer churn attributed to security incidents
    - Brand and reputation impact

  Opportunity Costs:
    - Revenue lost during service outage
    - Deals lost due to security concerns
    - Engineering time diverted from roadmap

Example Incident Cost Breakdown:
  Incident: Credential leak leading to data exposure (SEV2)
  Direct costs:
    - 40 hours incident response: $8,000
    - Legal consultation: $5,000
    - Customer notification: $2,000
    Total direct: $15,000
  Indirect costs:
    - 3 developers x 2 days diverted: $7,200
    - Feature delay (1 sprint): $25,000
    Total indirect: $32,200
  Total incident cost: $47,200
```

### Security ROI

```text
Metric: Security Return on Investment
Definition: Value delivered by security investments relative to their cost
Formula: (Risk Reduction Value - Security Investment) / Security Investment * 100

Example ROI Calculation:

Investment (Annual):
  Security tools: $150,000
  Security team (3 engineers): $600,000
  Training and certifications: $50,000
  Bug bounty program: $100,000
  Total investment: $900,000

Value Delivered:
  Vulnerabilities prevented from reaching production: 250
    Estimated cost if exploited: $2,000 per vulnerability average
    Value: $500,000
  Incidents prevented (estimated from industry benchmarks): 3
    Average cost per incident: $200,000
    Value: $600,000
  Compliance penalties avoided: $300,000
  Customer retention (reduced churn from security trust): $200,000
  Total value: $1,600,000

ROI = ($1,600,000 - $900,000) / $900,000 * 100 = 78%

Note: Security ROI calculations involve estimation and should be
presented with appropriate caveats about assumptions and methodology.
```

---

## Dashboards

### Grafana Security Dashboard

```yaml
# Grafana dashboard configuration (simplified)
# grafana-security-dashboard.json

dashboard:
  title: "Security Posture Dashboard"
  refresh: "5m"
  panels:

    # Row 1: High-Level Indicators
    - title: "Open Critical Vulnerabilities"
      type: stat
      datasource: prometheus
      targets:
        - expr: 'sum(open_vulnerabilities{severity="critical"})'
      thresholds:
        steps:
          - value: 0
            color: green
          - value: 1
            color: red
      fieldConfig:
        defaults:
          noValue: "0"

    - title: "SLA Compliance (Critical)"
      type: gauge
      datasource: prometheus
      targets:
        - expr: |
            (sum(vulnerabilities_fixed_within_sla{severity="critical"}) /
             sum(vulnerabilities_fixed{severity="critical"})) * 100
      thresholds:
        steps:
          - value: 0
            color: red
          - value: 90
            color: yellow
          - value: 95
            color: green

    - title: "MTTR (Days) by Severity"
      type: bargauge
      datasource: prometheus
      targets:
        - expr: 'avg(vulnerability_mttr_days) by (severity)'
          legendFormat: "{{ severity }}"

    - title: "Scan Coverage"
      type: gauge
      datasource: prometheus
      targets:
        - expr: |
            (count(repository_security_scan_active == 1) /
             count(repository_security_scan_active)) * 100
      thresholds:
        steps:
          - value: 0
            color: red
          - value: 80
            color: yellow
          - value: 95
            color: green

    # Row 2: Trends
    - title: "Vulnerability Density Trend"
      type: timeseries
      datasource: prometheus
      targets:
        - expr: 'avg(vulnerability_density_per_kloc) by (team)'
          legendFormat: "{{ team }}"
      options:
        tooltip:
          mode: multi

    - title: "Findings by Phase (Where Found)"
      type: piechart
      datasource: prometheus
      targets:
        - expr: 'sum(vulnerabilities_found) by (phase)'
          legendFormat: "{{ phase }}"

    - title: "Security Debt Score Over Time"
      type: timeseries
      datasource: prometheus
      targets:
        - expr: 'sum(security_debt_score) by (severity)'
          legendFormat: "{{ severity }}"

    # Row 3: Operational
    - title: "Security Incidents (Last 90 Days)"
      type: bargauge
      datasource: prometheus
      targets:
        - expr: 'sum(security_incidents_total) by (severity)'

    - title: "False Positive Rate by Tool"
      type: barchart
      datasource: prometheus
      targets:
        - expr: |
            (sum(findings_false_positive) by (tool) /
             sum(findings_total) by (tool)) * 100

    - title: "Training Completion Rate"
      type: stat
      datasource: prometheus
      targets:
        - expr: |
            (sum(training_completed) / sum(training_required)) * 100
```

### OWASP SAMM Maturity Model Scoring

```text
OWASP Software Assurance Maturity Model (SAMM) Assessment:

Business Functions and Practices:

1. Governance
   a. Strategy & Metrics
      Level: 2 (Defined)
      Score: 2/3
      Gap: Need executive-level reporting cadence

   b. Policy & Compliance
      Level: 2 (Defined)
      Score: 2/3
      Gap: Policy enforcement automation

   c. Education & Guidance
      Level: 1 (Initial)
      Score: 1/3
      Gap: Need role-based training tracks

2. Design
   a. Threat Assessment
      Level: 2 (Defined)
      Score: 2/3
      Gap: Threat modeling coverage at 70%, target 90%

   b. Security Requirements
      Level: 1 (Initial)
      Score: 1.5/3
      Gap: Need standardized security requirements templates

   c. Security Architecture
      Level: 2 (Defined)
      Score: 2/3
      Gap: Architecture review process needs formalization

3. Implementation
   a. Secure Build
      Level: 2 (Defined)
      Score: 2.5/3
      Gap: SBOM generation not universal

   b. Secure Deployment
      Level: 2 (Defined)
      Score: 2/3
      Gap: Artifact signing not fully implemented

   c. Defect Management
      Level: 2 (Defined)
      Score: 2/3
      Gap: Vulnerability management platform not integrated with all tools

4. Verification
   a. Architecture Assessment
      Level: 1 (Initial)
      Score: 1/3
      Gap: No regular architecture security reviews

   b. Requirements-driven Testing
      Level: 1 (Initial)
      Score: 1.5/3
      Gap: Security test cases not derived from requirements

   c. Security Testing
      Level: 2 (Defined)
      Score: 2/3
      Gap: DAST coverage at 70%

5. Operations
   a. Incident Management
      Level: 2 (Defined)
      Score: 2/3
      Gap: Tabletop exercises not quarterly

   b. Environment Management
      Level: 2 (Defined)
      Score: 2/3
      Gap: Configuration drift detection incomplete

   c. Operational Management
      Level: 1 (Initial)
      Score: 1.5/3
      Gap: Runtime protection (RASP) not deployed

Overall SAMM Score: 1.8 / 3.0
Target (12 months): 2.3 / 3.0
Target (24 months): 2.7 / 3.0
```

### BSIMM (Building Security In Maturity Model)

```text
BSIMM Assessment Summary:

BSIMM measures observed security activities across 12 practices in 4 domains.

Domain 1: Governance
  Practice            | Activities Observed | BSIMM Average | Assessment
  Strategy & Metrics  | 4 of 6             | 3.2           | Above average
  Compliance & Policy | 3 of 6             | 3.5           | Below average
  Training            | 3 of 5             | 2.8           | Above average

Domain 2: Intelligence
  Practice            | Activities Observed | BSIMM Average | Assessment
  Attack Models       | 2 of 4             | 2.1           | At average
  Security Features   | 3 of 5             | 2.8           | Above average
  Standards & Reqs    | 2 of 5             | 2.5           | Below average

Domain 3: SSDL Touchpoints
  Practice            | Activities Observed | BSIMM Average | Assessment
  Architecture Anal.  | 2 of 5             | 2.3           | Below average
  Code Review         | 4 of 5             | 3.1           | Above average
  Security Testing    | 3 of 5             | 2.9           | Above average

Domain 4: Deployment
  Practice            | Activities Observed | BSIMM Average | Assessment
  Penetration Testing | 3 of 4             | 2.8           | Above average
  Software Environ.   | 2 of 5             | 2.2           | At average
  Config & Vuln Mgmt  | 3 of 5             | 3.0           | At average

Overall: 34 of 60 activities observed
BSIMM Average: 33.1 activities
Assessment: Slightly above BSIMM average
```

---

## Reporting Cadence

### Weekly Team Metrics

```text
Weekly Security Report (Team Level):

Recipients: Team Lead, Security Champion
Delivery: Monday morning via email/Slack

Content:
  1. New Findings This Week
     - Count by severity
     - List of critical/high findings with tickets

  2. Findings Approaching SLA Deadline (next 7 days)
     - Ticket, severity, days remaining, assignee

  3. Overdue Findings
     - Ticket, severity, days overdue, assignee, escalation status

  4. Findings Resolved This Week
     - Count by severity
     - Recognition for developers who resolved findings

  5. Scan Coverage Status
     - Any repositories added without scanning? (flag)
     - Pipeline failures due to security gates? (count)

Format: Concise, actionable, < 1 page
```

### Monthly Management Report

```text
Monthly Security Report (Management Level):

Recipients: VP Engineering, Engineering Directors, Security Leadership
Delivery: First week of each month

Content:
  1. Executive Summary (3-5 bullet points)
     - Overall security posture assessment (improving/stable/declining)
     - Key highlights and lowlights
     - Action items requiring management attention

  2. Vulnerability Metrics
     - Open findings by severity (table)
     - MTTR by severity with trend (chart)
     - SLA compliance rates (chart)
     - Vulnerability density by team (chart)
     - Security debt trend (chart)

  3. Process Metrics
     - Scan coverage percentage
     - Training completion rate
     - Champion engagement score
     - Threat model coverage

  4. Incident Summary
     - Incidents this month (count by severity)
     - MTTD and time to containment
     - Brief summary of notable incidents

  5. Risk Register Updates
     - New risk acceptances
     - Expiring risk acceptances
     - Open risks requiring management decision

  6. Upcoming Activities
     - Scheduled penetration tests
     - Planned compliance audits
     - Security initiatives and milestones

Format: 3-5 pages, charts and tables preferred over text
```

### Quarterly Executive Summary

```text
Quarterly Security Report (Executive Level):

Recipients: CTO, CISO, CEO, Board (if applicable)
Delivery: End of each quarter

Content:
  1. Security Posture Score (single number, trend arrow)
     - Composite risk score
     - Comparison with previous quarters

  2. Key Risk Indicators (3-5 KRIs)
     - Vulnerability escape rate
     - MTTR for critical findings
     - Scan coverage
     - Security incident count
     - Compliance status

  3. Investment ROI
     - Security spend vs risk reduction
     - Cost avoidance from prevented incidents
     - Comparison with industry breach costs

  4. Compliance Status
     - SOC 2 / PCI DSS / HIPAA readiness
     - Audit findings and remediation status
     - Upcoming audit schedule

  5. Strategic Recommendations
     - Top 3 security investments for next quarter
     - Budget requests with justification
     - Staffing needs

  6. Industry Benchmarking
     - BSIMM or SAMM score vs peers
     - MTTR comparison with industry
     - Incident rate comparison

Format: 2-3 pages, heavy on visuals and trends
Tone: Business outcomes, not technical details
```

---

## Benchmarking Against Industry

```text
Industry Benchmarking Sources:

1. Verizon DBIR (Data Breach Investigations Report)
   - Annual report on breach patterns and trends
   - Compare your incident types and vectors with industry data
   - Identify if your organization faces the same top threats

2. BSIMM (Building Security In Maturity Model)
   - Community of 130+ organizations
   - Compare observed security practices
   - Identify activities you should adopt based on peer data

3. OWASP SAMM
   - Free maturity model for software security
   - Self-assessment capability
   - Roadmap generation for improvement

4. Ponemon Institute Reports
   - Cost of a Data Breach annual report
   - Compare incident costs with industry averages
   - Benchmark MTTD and MTTR

5. SANS Security Survey Data
   - Annual surveys on security practices
   - Tool adoption rates
   - Budget allocation benchmarks

Benchmarking Process:
  1. Conduct internal assessment (SAMM or BSIMM)
  2. Compare with published industry data
  3. Identify gaps (areas where you trail peers)
  4. Prioritize improvements based on risk and gap size
  5. Set targets aligned with industry leaders
  6. Reassess annually to track progress
```

---

## Best Practices

1. **Start with a small set of actionable metrics.** Begin with 5-7 core metrics (MTTR, vulnerability density, SLA compliance, scan coverage, incident count). Expand as the program matures. Too many metrics too early overwhelms teams and dilutes focus.

2. **Automate data collection.** Manual metric gathering is unsustainable and error-prone. Integrate vulnerability management platforms, CI/CD pipelines, and issue trackers via APIs to generate metrics automatically.

3. **Make dashboards accessible to developers.** Security metrics should be visible to the teams who can act on them, not locked in a security team portal. Display team-level dashboards in team workspaces.

4. **Measure trends, not absolute numbers.** An organization with 100 open findings that is trending downward is healthier than one with 50 that is trending upward. Always show the direction of change.

5. **Contextualize metrics with targets and benchmarks.** Raw numbers are meaningless without context. Always show the target value, the previous period's value, and industry benchmarks alongside the current measurement.

6. **Report different metrics to different audiences.** Developers need tactical metrics (their team's MTTR, open findings). Executives need strategic metrics (overall risk score, ROI, compliance status). Tailor the report to the audience.

7. **Use metrics to drive improvement, not punishment.** If MTTR is used to punish slow teams rather than to identify process bottlenecks, teams will game the metrics or avoid reporting.

8. **Review and retire stale metrics.** Assess quarterly whether each metric still provides actionable insight. Retire metrics that no one acts on and add new metrics for emerging priorities.

9. **Correlate security metrics with business outcomes.** Connect vulnerability reduction to incident prevention. Connect incident prevention to cost avoidance. Speak the language of business value.

10. **Validate metric accuracy regularly.** Automated metrics are only as good as the data sources. Periodically spot-check calculations against manual counts. Verify that tool integrations are complete and current.

---

## Anti-Patterns

1. **Vanity metrics without actionability.** Reporting "total scans run" or "lines of code scanned" sounds impressive but drives no behavior. Every metric must have a clear action that can be taken when it moves in the wrong direction.

2. **Measuring only what is easy to count.** Counting vulnerabilities found is easy. Measuring actual risk reduction is harder but far more valuable. Resist the temptation to optimize for easy-to-measure proxies.

3. **No baseline measurement.** Launching a security improvement initiative without measuring the starting state makes it impossible to demonstrate progress. Always establish a baseline before beginning.

4. **Reporting raw vulnerability counts without normalization.** A large codebase will have more findings than a small one. Without normalization (per KLOC, per application), comparisons are misleading and unfair.

5. **Ignoring false positive rates.** Reporting high finding counts without accounting for false positives overstates risk and erodes trust in the metrics. Track and report true positive rates alongside finding counts.

6. **Annual-only measurement.** Security posture changes weekly. Annual security assessments provide a snapshot that is outdated within months. Measure continuously and report at appropriate cadences.

7. **Gaming metrics to meet targets.** If teams can close findings by marking them as "won't fix" or "risk accepted" without proper justification, the metrics show improvement while risk remains unchanged.

8. **Dashboards without owners.** Creating a dashboard and walking away means it will become stale. Every dashboard and report must have an owner responsible for accuracy and relevance.

---

## Enforcement Checklist

```text
Metric Foundation:
[ ] Core metrics defined (MTTD, MTTR, vulnerability density, SLA compliance,
    scan coverage, security debt, escape rate)
[ ] Baseline measurements established for all core metrics
[ ] Targets set for each metric with justification
[ ] Data sources identified and API integrations built
[ ] Automated data collection pipeline operational
[ ] Metric calculations documented and peer-reviewed

Dashboards:
[ ] Security posture dashboard deployed (Grafana or equivalent)
[ ] Dashboard accessible to all engineering teams
[ ] Real-time data refresh configured (5-15 minute intervals)
[ ] Threshold-based alerting configured for critical metrics
[ ] Dashboard owner assigned for maintenance and accuracy

Reporting:
[ ] Weekly team-level security report automated and delivered
[ ] Monthly management security report template established
[ ] Quarterly executive summary format approved by CISO/CTO
[ ] Reporting calendar published with deadlines and recipients
[ ] Historical data archived for trend analysis (minimum 2 years)

Maturity Assessment:
[ ] OWASP SAMM or BSIMM assessment conducted (annual)
[ ] Maturity scores documented with improvement roadmap
[ ] Industry benchmarking data collected and compared
[ ] Gap analysis completed with prioritized improvement plan
[ ] Target maturity level set for next assessment cycle

Process Integration:
[ ] Security metrics reviewed in engineering leadership meetings
[ ] Metrics used as input for sprint planning (security debt paydown)
[ ] Metrics included in team retrospectives
[ ] SLA compliance tracked as a team health indicator
[ ] Security posture score included in quarterly business reviews

Continuous Improvement:
[ ] Quarterly review of metric relevance and accuracy
[ ] Stale or non-actionable metrics identified and retired
[ ] New metrics proposed based on emerging priorities
[ ] Data source integrations validated quarterly
[ ] Feedback collected from metric consumers (developers, managers, executives)
[ ] Annual calibration of targets based on historical performance
```
