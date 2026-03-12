# SOC 2 for Developers

> Comprehensive technical guide to SOC 2 compliance and the Trust Services Criteria.
> Audience: Software engineers, DevOps engineers, and technical leads building SaaS platforms and cloud services.
> Last updated: 2026-03-10

---

## Table of Contents

1. Overview and Scope
2. Five Trust Services Criteria
3. SOC 2 Type I vs Type II
4. Common Criteria (CC) Detailed Breakdown
5. Developer-Relevant Controls
6. Access Management
7. Change Management and CI/CD
8. Incident Management
9. Monitoring and Alerting
10. Encryption and Data Protection
11. Vulnerability Management
12. Backup and Recovery
13. Evidence Collection and Automation
14. Infrastructure as Code for Compliance
15. Code and Configuration Examples
16. Best Practices
17. Anti-Patterns
18. Enforcement Checklist

---

## 1. Overview and Scope

SOC 2 (System and Organization Controls 2) is an auditing framework developed by the American Institute of Certified Public Accountants (AICPA). It evaluates the controls an organization has in place to protect customer data based on five Trust Services Criteria.

### Who Needs SOC 2

- SaaS companies handling customer data.
- Cloud service providers.
- Managed service providers.
- Any technology company whose enterprise customers require third-party assurance about data security.

### The Audit Process

1. **Scoping**: Define which systems, services, and criteria are included.
2. **Gap assessment**: Identify gaps between current controls and SOC 2 requirements.
3. **Remediation**: Implement missing controls and processes.
4. **Readiness assessment**: Optional pre-audit to verify readiness.
5. **Audit**: CPA firm examines controls and collects evidence.
6. **Report**: Auditor issues the SOC 2 report.

### SOC 2 Reports Are Not Certifications

SOC 2 is an attestation, not a certification. A CPA firm audits the organization and issues a report with their opinion on whether the controls are suitably designed (Type I) and operating effectively (Type II).

---

## 2. Five Trust Services Criteria

### Security (Common Criteria - Required)

The system is protected against unauthorized access, unauthorized disclosure of information, and damage to systems. Security is the baseline criterion and is always included in a SOC 2 report.

### Availability

The system is available for operation and use as committed or agreed. Relevant when uptime SLAs are part of the service agreement.

### Processing Integrity

System processing is complete, valid, accurate, timely, and authorized. Relevant for financial processing, data pipelines, and computational services.

### Confidentiality

Information designated as confidential is protected as committed or agreed. Relevant when handling trade secrets, intellectual property, or other sensitive business information.

### Privacy

Personal information is collected, used, retained, disclosed, and disposed of in conformity with the commitments in the entity's privacy notice. Relevant when handling personally identifiable information (PII).

```yaml
trust_services_criteria:
  security:
    always_included: true
    focus: "Protection against unauthorized access and system damage"
    developer_relevance: "Access controls, encryption, vulnerability management, incident response"

  availability:
    included_when: "SLAs for uptime are part of the service"
    focus: "System uptime, disaster recovery, capacity planning"
    developer_relevance: "High availability architecture, monitoring, failover, backups"

  processing_integrity:
    included_when: "Accuracy of data processing is critical"
    focus: "Data processing completeness, accuracy, timeliness"
    developer_relevance: "Input validation, error handling, reconciliation, data quality"

  confidentiality:
    included_when: "Handling confidential business information"
    focus: "Protection of confidential data throughout its lifecycle"
    developer_relevance: "Encryption, access controls, data classification, secure disposal"

  privacy:
    included_when: "Handling personal information (PII)"
    focus: "Privacy notice compliance, consent, data subject rights"
    developer_relevance: "Privacy controls, data minimization, consent management, deletion"
```

---

## 3. SOC 2 Type I vs Type II

### Type I (Point-in-Time)

- Evaluates the **design** of controls at a specific point in time.
- Answers: "Are the controls suitably designed?"
- Faster to obtain (audit covers a single date).
- Often used as a stepping stone to Type II.

### Type II (Period-of-Time)

- Evaluates the **design and operating effectiveness** of controls over a period (typically 6-12 months).
- Answers: "Are the controls suitably designed AND operating effectively over time?"
- More rigorous and valuable to customers.
- Requires continuous adherence to controls throughout the observation period.

```yaml
comparison:
  type_i:
    scope: "Design of controls at a point in time"
    duration: "Single date"
    evidence: "Policies, configurations, screenshots at a point in time"
    value: "Demonstrates controls exist"
    typical_use: "First SOC 2 report, quick market access"
    timeline_to_complete: "1-3 months"

  type_ii:
    scope: "Design and operating effectiveness over time"
    duration: "Typically 6-12 months observation period"
    evidence: "Policies, configurations, logs, tickets, change records over time"
    value: "Demonstrates controls work consistently"
    typical_use: "Ongoing compliance, enterprise customer requirement"
    timeline_to_complete: "6-12 months observation + 1-2 months audit"
```

---

## 4. Common Criteria (CC) Detailed Breakdown

The Common Criteria map to COSO (Committee of Sponsoring Organizations) principles and form the security baseline for all SOC 2 reports.

### CC1: Control Environment

```yaml
cc1_control_environment:
  description: "The entity demonstrates a commitment to integrity and ethical values"
  controls:
    cc1_1: "COSO Principle 1: Demonstrates commitment to integrity and ethical values"
    cc1_2: "COSO Principle 2: Board exercises oversight responsibility"
    cc1_3: "COSO Principle 3: Establishes structure, authority, and responsibility"
    cc1_4: "COSO Principle 4: Demonstrates commitment to competence"
    cc1_5: "COSO Principle 5: Enforces accountability"

  developer_relevance:
    - "Code of conduct awareness"
    - "Defined roles and responsibilities for engineering teams"
    - "Background checks for engineers with production access"
    - "Documented organizational structure"
```

### CC2: Communication and Information

```yaml
cc2_communication:
  description: "The entity obtains or generates and uses relevant, quality information"
  controls:
    cc2_1: "COSO Principle 13: Uses relevant information"
    cc2_2: "COSO Principle 14: Communicates internally"
    cc2_3: "COSO Principle 15: Communicates externally"

  developer_relevance:
    - "Internal communication of security policies to engineering"
    - "External communication of security incidents to customers"
    - "Documentation of system changes and their impacts"
    - "Security advisories and disclosure processes"
```

### CC3: Risk Assessment

```yaml
cc3_risk_assessment:
  description: "The entity specifies objectives, identifies and analyzes risk"
  controls:
    cc3_1: "COSO Principle 6: Specifies suitable objectives"
    cc3_2: "COSO Principle 7: Identifies and analyzes risk"
    cc3_3: "COSO Principle 8: Assesses fraud risk"
    cc3_4: "COSO Principle 9: Identifies and analyzes significant change"

  developer_relevance:
    - "Threat modeling for new features and systems"
    - "Risk assessment for third-party dependencies"
    - "Change risk analysis for significant architecture changes"
    - "Vulnerability risk scoring and prioritization"
```

### CC4: Monitoring Activities

```yaml
cc4_monitoring:
  description: "The entity selects, develops, and performs monitoring"
  controls:
    cc4_1: "COSO Principle 16: Selects, develops, and performs ongoing and/or separate evaluations"
    cc4_2: "COSO Principle 17: Evaluates and communicates deficiencies"

  developer_relevance:
    - "Continuous monitoring of production systems"
    - "Automated alerting for security events"
    - "Regular review of access logs and audit trails"
    - "Bug bounty and vulnerability disclosure programs"
```

### CC5: Control Activities

```yaml
cc5_control_activities:
  description: "The entity selects and develops control activities"
  controls:
    cc5_1: "COSO Principle 10: Selects and develops control activities"
    cc5_2: "COSO Principle 11: Selects and develops general controls over technology"
    cc5_3: "COSO Principle 12: Deploys through policies and procedures"

  developer_relevance:
    - "Automated security controls in CI/CD pipelines"
    - "Infrastructure as Code with security guardrails"
    - "Automated testing (unit, integration, security)"
    - "Code review requirements and approval processes"
```

### CC6: Logical and Physical Access Controls

```yaml
cc6_access_controls:
  description: "Logical and physical access to the system is restricted"
  controls:
    cc6_1: "Implements logical access security over protected assets"
    cc6_2: "Prior to granting access, registers and authorizes new users"
    cc6_3: "Restricts access based on role and responsibility"
    cc6_4: "Restricts physical access to facilities and protected assets"
    cc6_5: "Discontinues access when no longer needed"
    cc6_6: "Manages against threats from outside system boundaries"
    cc6_7: "Restricts transmission, movement, and removal of data"
    cc6_8: "Implements against threats from malicious software"

  developer_relevance:
    - "SSO and MFA for all systems"
    - "Role-based access control (RBAC)"
    - "Automated provisioning and deprovisioning"
    - "Network security controls and firewalls"
    - "Endpoint protection"
    - "Data encryption in transit and at rest"
```

### CC7: System Operations

```yaml
cc7_system_operations:
  description: "System operations are managed to detect and mitigate processing deviations"
  controls:
    cc7_1: "Employs detection mechanisms for changes indicative of anomalies"
    cc7_2: "Monitors system components for anomalies"
    cc7_3: "Evaluates detected events against established policies"
    cc7_4: "Responds to identified security incidents"
    cc7_5: "Identifies and addresses deficiencies"

  developer_relevance:
    - "Intrusion detection and prevention systems"
    - "Application performance monitoring"
    - "Security information and event management (SIEM)"
    - "Incident response procedures and playbooks"
    - "Post-incident review and remediation tracking"
```

### CC8: Change Management

```yaml
cc8_change_management:
  description: "Changes to infrastructure and software are authorized and managed"
  controls:
    cc8_1: "Authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes"

  developer_relevance:
    - "Pull request review and approval processes"
    - "CI/CD pipeline with automated testing"
    - "Deployment approval workflows"
    - "Change tracking and audit trails"
    - "Rollback procedures"
    - "Separation of development, staging, and production environments"
```

### CC9: Risk Mitigation

```yaml
cc9_risk_mitigation:
  description: "The entity identifies, selects, and develops risk mitigation activities"
  controls:
    cc9_1: "Identifies and assesses risk mitigation activities associated with vendors and business partners"
    cc9_2: "Assesses and manages risks from business disruptions"

  developer_relevance:
    - "Vendor security assessment process"
    - "Third-party dependency risk management"
    - "Business continuity planning for technology systems"
    - "Disaster recovery procedures and testing"
```

---

## 5. Developer-Relevant Controls

### Control Mapping to Daily Engineering Activities

```yaml
engineering_activity_to_controls:
  writing_code:
    controls: ["CC5.1", "CC8.1"]
    evidence: "Code commits, branch policies, code review tools"

  code_review:
    controls: ["CC8.1", "CC5.2"]
    evidence: "Pull request approvals, review comments, merge policies"

  deploying_to_production:
    controls: ["CC8.1", "CC5.2"]
    evidence: "Deployment logs, CI/CD pipeline records, approval records"

  managing_access:
    controls: ["CC6.1", "CC6.2", "CC6.3", "CC6.5"]
    evidence: "SSO logs, access review records, provisioning tickets"

  responding_to_incidents:
    controls: ["CC7.3", "CC7.4", "CC7.5"]
    evidence: "Incident tickets, postmortem documents, remediation tracking"

  monitoring_production:
    controls: ["CC7.1", "CC7.2", "CC4.1"]
    evidence: "Monitoring dashboards, alert configurations, on-call schedules"

  managing_dependencies:
    controls: ["CC3.2", "CC9.1"]
    evidence: "Dependency scanning reports, vulnerability remediation records"

  backup_and_recovery:
    controls: ["CC9.2"]
    evidence: "Backup configurations, restore test records, DR test results"
```

---

## 6. Access Management

### SSO and MFA Implementation

```yaml
access_management:
  single_sign_on:
    requirement: "Centralized authentication for all systems"
    implementation:
      identity_provider: "Okta, Azure AD, Google Workspace, or equivalent"
      protocols: "SAML 2.0 or OIDC"
      scope: "All production systems, code repositories, cloud consoles, SaaS tools"

  multi_factor_authentication:
    requirement: "MFA enforced for all users"
    implementation:
      methods: ["Hardware keys (FIDO2/WebAuthn)", "TOTP authenticator apps"]
      avoid: ["SMS-based MFA (SIM swapping risk)"]
      scope: "All systems, including VPN, cloud console, code repositories"

  role_based_access_control:
    requirement: "Access granted based on role and least privilege"
    implementation:
      - "Define roles that map to job functions"
      - "Grant minimum permissions required for each role"
      - "Review access quarterly"
      - "Remove access within 24 hours of role change or termination"
```

```typescript
// Terraform: Enforce SSO and MFA for AWS
// AWS SSO configuration
resource "aws_ssoadmin_permission_set" "developer" {
  name             = "DeveloperAccess"
  instance_arn     = aws_ssoadmin_instance.main.arn
  session_duration = "PT8H"  // 8-hour session
}

// Enforce MFA via IAM policy
const mfaPolicy = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "DenyAllExceptListedIfNoMFA",
      Effect: "Deny",
      NotAction: [
        "iam:CreateVirtualMFADevice",
        "iam:EnableMFADevice",
        "iam:GetUser",
        "iam:ListMFADevices",
        "iam:ListVirtualMFADevices",
        "iam:ResyncMFADevice",
        "sts:GetSessionToken",
      ],
      Resource: "*",
      Condition: {
        BoolIfExists: {
          "aws:MultiFactorAuthPresent": "false",
        },
      },
    },
  ],
};
```

### Access Review Process

```yaml
access_review_process:
  frequency: "Quarterly"
  scope: "All production systems and sensitive data access"
  process:
    step_1: "Generate access report from identity provider"
    step_2: "Distribute reports to team managers for review"
    step_3: "Managers certify or revoke each user's access"
    step_4: "Revoke unauthorized or unnecessary access within 48 hours"
    step_5: "Document review completion and outcomes"
    step_6: "Retain evidence for auditor review"

  automation:
    - "Automated access report generation"
    - "Automated detection of terminated/transferred employees"
    - "Automated deprovisioning workflows"
    - "Automated reminders for overdue reviews"
```

---

## 7. Change Management and CI/CD

### Pull Request as a SOC 2 Control

```yaml
pull_request_requirements:
  branch_protection:
    - "Require pull request before merging to main/production branches"
    - "Require at least one approval from someone other than the author"
    - "Require status checks to pass (CI pipeline)"
    - "Require up-to-date branches before merging"
    - "No force pushes to protected branches"
    - "No deletion of protected branches"

  review_process:
    - "Author describes the change and its purpose"
    - "Reviewer verifies correctness, security, and test coverage"
    - "At least one approved review from a qualified reviewer"
    - "All review comments addressed before merge"

  evidence_generated:
    - "PR description (the change request)"
    - "Review comments (evidence of review)"
    - "Approval records (authorization)"
    - "CI pipeline results (testing evidence)"
    - "Merge timestamp and actor (deployment record)"
```

```yaml
# GitHub branch protection configuration
# .github/settings.yml or manual configuration
branch_protection:
  main:
    required_pull_request_reviews:
      required_approving_review_count: 1
      dismiss_stale_reviews: true
      require_code_owner_reviews: true
      require_last_push_approval: true
    required_status_checks:
      strict: true
      contexts:
        - "ci/tests"
        - "ci/security-scan"
        - "ci/lint"
    enforce_admins: true
    restrictions: null
    allow_force_pushes: false
    allow_deletions: false
```

### CI/CD Pipeline as Evidence

```yaml
# CI/CD pipeline with SOC 2 evidence generation
# .github/workflows/deploy.yml
name: Production Deployment

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run unit tests
        run: npm test
      - name: Run integration tests
        run: npm run test:integration
      - name: Run security scanning
        run: npm audit --production
      - name: Run SAST (Static Application Security Testing)
        uses: github/codeql-action/analyze@v3
      - name: Upload test results
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 365  # Retain for audit period

  deploy:
    needs: [test]
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying commit ${{ github.sha }}"
          echo "Triggered by: ${{ github.actor }}"
          echo "PR: ${{ github.event.pull_request.number }}"
          # Actual deployment commands here

      - name: Record deployment
        run: |
          # Log deployment metadata for audit trail
          curl -X POST "${{ secrets.AUDIT_LOG_URL }}" \
            -H "Authorization: Bearer ${{ secrets.AUDIT_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "event": "deployment",
              "commit": "${{ github.sha }}",
              "actor": "${{ github.actor }}",
              "environment": "production",
              "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
              "pipeline_url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }'
```

### Deployment Approval Workflow

```yaml
deployment_approval:
  requirement: "Changes to production require explicit approval"
  implementation:
    github_environments:
      - "Define 'production' environment with required reviewers"
      - "Deploy job references the environment"
      - "Designated approvers must approve before deployment proceeds"

    approval_evidence:
      - "Approver identity"
      - "Approval timestamp"
      - "Associated PR and commit"
      - "Deployment outcome"
```

---

## 8. Incident Management

### Incident Response Process

```yaml
incident_response:
  phases:
    identification:
      - "Monitor alerts from security tools, monitoring systems, and user reports"
      - "Classify the incident by severity (SEV1, SEV2, SEV3, SEV4)"
      - "Create an incident ticket with initial details"

    containment:
      - "Limit the scope of the incident"
      - "Isolate affected systems if necessary"
      - "Preserve evidence for investigation"

    eradication:
      - "Identify and remove the root cause"
      - "Apply fixes and patches"
      - "Verify remediation effectiveness"

    recovery:
      - "Restore affected systems to normal operation"
      - "Verify system functionality and data integrity"
      - "Monitor for recurrence"

    lessons_learned:
      - "Conduct a post-incident review (postmortem)"
      - "Document root cause, timeline, impact, and remediation"
      - "Identify and track follow-up action items"
      - "Share lessons learned with the broader team"

  severity_levels:
    sev1: "Critical: Service outage or data breach affecting many customers"
    sev2: "High: Significant degradation or security incident"
    sev3: "Medium: Limited impact, workaround available"
    sev4: "Low: Minor issue, cosmetic or informational"

  sla_by_severity:
    sev1: "Acknowledge in 15 minutes, resolve ASAP"
    sev2: "Acknowledge in 1 hour, resolve within 4 hours"
    sev3: "Acknowledge in 4 hours, resolve within 24 hours"
    sev4: "Acknowledge in 24 hours, resolve within 5 business days"
```

```yaml
# Postmortem template (evidence for CC7.4, CC7.5)
postmortem_template:
  incident_id: "INC-2026-042"
  title: "Database connection pool exhaustion causing service degradation"
  severity: "SEV2"
  duration: "2 hours 15 minutes"
  impact: "30% of API requests failed for 2 hours"

  timeline:
    - time: "2026-03-01T14:30:00Z"
      event: "Monitoring alert: API error rate exceeded 5% threshold"
    - time: "2026-03-01T14:35:00Z"
      event: "On-call engineer acknowledged alert and began investigation"
    - time: "2026-03-01T14:50:00Z"
      event: "Root cause identified: connection pool exhaustion due to leaked connections"
    - time: "2026-03-01T15:10:00Z"
      event: "Temporary fix applied: restarted application with increased pool size"
    - time: "2026-03-01T16:45:00Z"
      event: "Permanent fix deployed: connection leak patched, pool monitoring added"

  root_cause: "Connection leak in database client library version 3.2.1"

  action_items:
    - action: "Upgrade database client library to 3.2.3"
      owner: "engineering-team"
      status: "completed"
      due_date: "2026-03-03"
    - action: "Add connection pool monitoring to standard dashboard"
      owner: "platform-team"
      status: "completed"
      due_date: "2026-03-05"
    - action: "Add integration test for connection pool behavior under load"
      owner: "engineering-team"
      status: "in_progress"
      due_date: "2026-03-10"

  lessons_learned:
    - "Database client library updates should be prioritized when they contain connection management fixes"
    - "Connection pool metrics should be part of standard application monitoring"
```

---

## 9. Monitoring and Alerting

### Monitoring Architecture for SOC 2

```yaml
monitoring_layers:
  infrastructure:
    metrics: ["CPU", "Memory", "Disk", "Network"]
    tools: ["CloudWatch", "Datadog", "Prometheus"]
    alerting: "Threshold-based with escalation"

  application:
    metrics: ["Request rate", "Error rate", "Latency (p50, p95, p99)", "Saturation"]
    tools: ["Datadog APM", "New Relic", "OpenTelemetry"]
    alerting: "SLO-based alerting"

  security:
    events: ["Authentication failures", "Privilege escalation", "Unusual access patterns", "Configuration changes"]
    tools: ["SIEM (Splunk, Elastic)", "Cloud security services (GuardDuty, Security Center)"]
    alerting: "Immediate notification for security events"

  availability:
    metrics: ["Uptime", "Error budget", "SLA compliance"]
    tools: ["Uptime monitoring (Pingdom, Checkly)", "Status page (Statuspage.io)"]
    alerting: "Customer-facing status page updates"
```

```yaml
# Datadog monitoring configuration example
monitors:
  - name: "High Error Rate"
    type: "metric alert"
    query: "sum(last_5m):sum:http.requests.errors{env:production} / sum:http.requests.total{env:production} > 0.05"
    message: "Error rate exceeds 5% in production. @pagerduty-oncall"
    tags: ["soc2:cc7.2", "severity:high"]
    options:
      thresholds:
        critical: 0.05
        warning: 0.02

  - name: "Unauthorized Access Attempt"
    type: "log alert"
    query: 'logs("status:error source:auth action:login_failed").rollup("count").last("15m") > 50'
    message: "More than 50 failed login attempts in 15 minutes. Possible brute force. @security-team"
    tags: ["soc2:cc6.1", "soc2:cc7.1", "severity:critical"]

  - name: "Configuration Change Detected"
    type: "event alert"
    query: "events('sources:aws priority:all tags:cloudtrail,configchange').rollup('count').last('5m') > 0"
    message: "Infrastructure configuration change detected. Verify this was authorized. @sre-team"
    tags: ["soc2:cc8.1", "severity:medium"]
```

---

## 10. Encryption and Data Protection

### Encryption Requirements

```yaml
encryption_controls:
  in_transit:
    requirement: "All data encrypted in transit"
    implementation:
      - "TLS 1.2+ for all external communications"
      - "TLS for internal service-to-service communication"
      - "HSTS headers on all web applications"
      - "Certificate management and rotation"
    evidence: "TLS configuration scans, certificate inventory"

  at_rest:
    requirement: "All sensitive data encrypted at rest"
    implementation:
      - "Database encryption (RDS encryption, Cloud SQL encryption)"
      - "Object storage encryption (S3 SSE-KMS, GCS CMEK)"
      - "Volume encryption (EBS encryption, Persistent Disk encryption)"
      - "Backup encryption"
    evidence: "Encryption configuration screenshots, KMS key policies"

  key_management:
    requirement: "Encryption keys managed securely"
    implementation:
      - "Cloud KMS (AWS KMS, Azure Key Vault, GCP KMS)"
      - "Key rotation policies (annual minimum)"
      - "Access controls on key management"
      - "Separation of duties for key management"
    evidence: "KMS configuration, key rotation logs, access policies"
```

```hcl
# Terraform: Encryption at rest for AWS RDS
resource "aws_db_instance" "production" {
  identifier     = "production-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.large"

  # Encryption at rest - SOC 2 CC6.1, CC6.7
  storage_encrypted = true
  kms_key_id        = aws_kms_key.database.arn

  # Backup encryption
  backup_retention_period = 30

  # Deletion protection
  deletion_protection = true

  tags = {
    SOC2Control = "CC6.1,CC6.7"
    DataClass   = "confidential"
  }
}

resource "aws_kms_key" "database" {
  description             = "KMS key for production database encryption"
  enable_key_rotation     = true  # Annual automatic rotation
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "KeyAdministration"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::123456789012:role/KeyAdmin"
        }
        Action   = ["kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*", "kms:Put*", "kms:Update*", "kms:Revoke*", "kms:Disable*", "kms:Get*", "kms:Delete*", "kms:ScheduleKeyDeletion", "kms:CancelKeyDeletion"]
        Resource = "*"
      },
      {
        Sid    = "KeyUsage"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::123456789012:role/ApplicationRole"
        }
        Action   = ["kms:Decrypt", "kms:DescribeKey", "kms:Encrypt", "kms:GenerateDataKey*", "kms:ReEncrypt*"]
        Resource = "*"
      }
    ]
  })
}
```

---

## 11. Vulnerability Management

### Vulnerability Management Program

```yaml
vulnerability_management:
  scanning:
    infrastructure:
      tool: "Nessus, Qualys, AWS Inspector"
      frequency: "Weekly automated scans"
      scope: "All production infrastructure"

    application:
      sast: "Semgrep, CodeQL, SonarQube (on every PR)"
      dast: "OWASP ZAP, Burp Suite (weekly against staging)"
      sca: "Snyk, Dependabot, Renovate (continuous)"

    container:
      tool: "Trivy, Snyk Container, ECR scanning"
      frequency: "On every image build and weekly for deployed images"

  remediation_sla:
    critical: "24 hours"
    high: "7 days"
    medium: "30 days"
    low: "90 days"

  tracking:
    - "All vulnerabilities tracked in a centralized system (Jira, Linear)"
    - "Ownership assigned for each vulnerability"
    - "Progress reviewed weekly by security team"
    - "Exceptions documented and approved by management"
    - "Metrics reported monthly (open vulnerabilities by severity, time to remediate)"
```

```yaml
# Dependabot configuration for automated dependency scanning
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    reviewers:
      - "platform-team"
```

---

## 12. Backup and Recovery

### Backup Requirements

```yaml
backup_controls:
  requirements:
    - "Regular automated backups of all production data"
    - "Backups encrypted at rest"
    - "Backups stored in a separate location (different region or account)"
    - "Backup integrity verified regularly"
    - "Restore procedures documented and tested"
    - "Recovery time objective (RTO) and recovery point objective (RPO) defined"

  implementation:
    databases:
      method: "Automated daily snapshots + continuous WAL archiving"
      retention: "30 days daily snapshots, 1 year monthly snapshots"
      location: "Cross-region replication"

    object_storage:
      method: "Cross-region replication with versioning"
      retention: "Per data classification policy"

    configuration:
      method: "Infrastructure as Code in version control"
      retention: "Full git history"

  testing:
    frequency: "Quarterly restore testing"
    scope: "Full database restore to a separate environment"
    documentation: "Record restore time, data integrity verification, issues encountered"
    evidence: "Restore test report with timestamps and verification steps"
```

---

## 13. Evidence Collection and Automation

### Compliance Automation Platforms

```yaml
automation_platforms:
  vanta:
    description: "Automated compliance monitoring"
    capabilities:
      - "Continuous monitoring of cloud infrastructure"
      - "Automated evidence collection"
      - "Policy management and distribution"
      - "Employee onboarding/offboarding tracking"
      - "Vendor risk management"
    integrations: ["AWS", "GCP", "Azure", "GitHub", "Okta", "Jira", "Slack"]

  drata:
    description: "Compliance automation and monitoring"
    capabilities:
      - "Automated control testing"
      - "Evidence collection from integrations"
      - "Risk assessment management"
      - "Trust center for sharing compliance status"
    integrations: ["AWS", "GCP", "Azure", "GitHub", "GitLab", "Okta", "Azure AD"]

  secureframe:
    description: "Compliance automation platform"
    capabilities:
      - "Automated security monitoring"
      - "Personnel management and training tracking"
      - "Vendor management"
      - "Policy library and management"
    integrations: ["AWS", "GCP", "Azure", "GitHub", "Okta", "Google Workspace"]

  tugboat_logic:
    description: "Security assurance platform"
    capabilities:
      - "Smart policy library"
      - "Automated control mapping"
      - "Evidence collection"
      - "Audit management"
```

### What Auditors Look For

```yaml
auditor_evidence:
  access_management:
    - "User provisioning tickets/workflows"
    - "Access review records (quarterly)"
    - "Terminated user deprovisioning evidence"
    - "SSO and MFA configuration screenshots"
    - "Role definitions and permission matrices"

  change_management:
    - "Pull request history with reviews and approvals"
    - "CI/CD pipeline configurations and run history"
    - "Deployment logs and approvals"
    - "Change request tickets"
    - "Rollback procedures documentation"

  incident_management:
    - "Incident tickets with severity, timeline, and resolution"
    - "Postmortem documents"
    - "Action item tracking and completion"
    - "Incident response plan document"
    - "On-call schedules"

  monitoring:
    - "Alert configurations and notification channels"
    - "Dashboard screenshots showing monitoring coverage"
    - "Alert response records"
    - "Log retention configurations"

  encryption:
    - "Encryption configuration evidence (database, storage, transit)"
    - "KMS key policies and rotation settings"
    - "TLS certificate inventory and configuration"

  vulnerability_management:
    - "Scan reports and schedules"
    - "Vulnerability tracking records"
    - "Remediation evidence and timelines"
    - "Dependency scanning configurations"
```

---

## 14. Infrastructure as Code for Compliance

### IaC as SOC 2 Evidence

```yaml
iac_for_compliance:
  benefits:
    - "Version-controlled infrastructure changes (CC8.1 evidence)"
    - "Repeatable and auditable configurations"
    - "Drift detection against desired state"
    - "Security controls codified and reviewed"

  practices:
    - "All infrastructure defined in Terraform, Pulumi, or CloudFormation"
    - "Infrastructure changes go through the same PR review process as code"
    - "Automated validation of security configurations in CI"
    - "Drift detection alerts when production diverges from code"
```

```hcl
# Terraform: S3 bucket with SOC 2 compliant configuration
resource "aws_s3_bucket" "audit_logs" {
  bucket = "company-audit-logs"

  tags = {
    SOC2Control = "CC7.1,CC7.2,CC10.7"
    Purpose     = "Audit log storage"
    DataClass   = "confidential"
  }
}

# Encryption at rest (CC6.1)
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.audit_logs.arn
    }
    bucket_key_enabled = true
  }
}

# Block public access (CC6.1, CC6.6)
resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versioning for integrity (CC6.7)
resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Object lock for tamper evidence (CC7.1)
resource "aws_s3_bucket_object_lock_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 365
    }
  }
}

# Lifecycle for retention management
resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    id     = "archive-old-logs"
    status = "Enabled"
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    expiration {
      days = 2555  # 7 years
    }
  }
}
```

---

## 15. Code and Configuration Examples

### Security Headers Configuration

```typescript
// Express.js security headers middleware (CC6.6)
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Minimize unsafe-inline
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' },
}));
```

### Automated Access Review Script

```python
"""
Automated access review script for SOC 2 CC6.3 and CC6.5.
Generates access review reports for manager certification.
"""

from datetime import datetime, timedelta

class AccessReviewAutomation:
    def __init__(self, idp_client, hr_client, notification_client):
        self.idp = idp_client       # Identity provider (Okta, Azure AD)
        self.hr = hr_client          # HR system
        self.notifier = notification_client

    async def run_quarterly_review(self) -> AccessReviewReport:
        """Run quarterly access review per SOC 2 requirements."""
        report = AccessReviewReport(
            review_date=datetime.utcnow(),
            review_type="quarterly",
        )

        # Step 1: Get all active users from identity provider
        active_users = await self.idp.get_all_active_users()

        # Step 2: Get all active employees from HR
        active_employees = await self.hr.get_active_employees()
        active_employee_ids = {emp.id for emp in active_employees}

        # Step 3: Identify terminated users who still have access
        for user in active_users:
            if user.employee_id not in active_employee_ids:
                report.add_finding(
                    finding_type="TERMINATED_USER_ACTIVE",
                    user=user,
                    severity="critical",
                    recommended_action="Immediately revoke access",
                )

        # Step 4: Identify users with excessive access
        for user in active_users:
            employee = await self.hr.get_employee(user.employee_id)
            expected_roles = self.get_expected_roles(employee.job_title, employee.department)
            actual_roles = await self.idp.get_user_roles(user.id)

            excessive_roles = set(actual_roles) - set(expected_roles)
            if excessive_roles:
                report.add_finding(
                    finding_type="EXCESSIVE_ACCESS",
                    user=user,
                    severity="high",
                    details={"excessive_roles": list(excessive_roles)},
                    recommended_action="Review and remove unnecessary roles",
                )

        # Step 5: Identify dormant accounts
        for user in active_users:
            last_login = await self.idp.get_last_login(user.id)
            if last_login and (datetime.utcnow() - last_login) > timedelta(days=90):
                report.add_finding(
                    finding_type="DORMANT_ACCOUNT",
                    user=user,
                    severity="medium",
                    details={"last_login": last_login.isoformat()},
                    recommended_action="Disable account pending review",
                )

        # Step 6: Send reports to managers for certification
        for manager_id, findings in report.group_by_manager().items():
            await self.notifier.send_review_request(
                manager_id=manager_id,
                findings=findings,
                deadline=datetime.utcnow() + timedelta(days=14),
            )

        return report
```

---

## 16. Best Practices

1. **Treat SOC 2 controls as engineering practices, not audit checklists.** Integrate controls into daily workflows (code review, CI/CD, monitoring) rather than creating separate compliance processes that exist only for auditors.

2. **Automate evidence collection from the start.** Use compliance automation platforms (Vanta, Drata, Secureframe) to continuously collect evidence from your cloud infrastructure, identity providers, code repositories, and ticketing systems.

3. **Use pull requests and CI/CD pipelines as your primary change management evidence.** Every code change through a reviewed PR with automated checks generates the exact evidence auditors need for CC8.1 (change management).

4. **Implement SSO and MFA across all systems before starting the audit.** Access management (CC6) is fundamental to SOC 2. Centralized authentication via SSO with enforced MFA is the single most impactful control to implement.

5. **Define and enforce data classification policies.** Classify data by sensitivity level (public, internal, confidential, restricted). Apply appropriate controls based on classification. This drives encryption, access control, and retention decisions.

6. **Write postmortems for every significant incident.** Postmortem documents are valuable evidence for CC7.4 (incident response) and CC7.5 (deficiency remediation). Use a consistent template with root cause, timeline, impact, and action items.

7. **Conduct quarterly access reviews with documented outcomes.** Automate the generation of access review reports. Require managers to certify or revoke access. Document the entire process and retain records for the audit period.

8. **Test backup restoration quarterly.** It is not enough to have backups; you must verify they work. Conduct quarterly restore tests, document the results, measure restoration time, and verify data integrity.

9. **Track vulnerability remediation with defined SLAs.** Every vulnerability must be tracked to resolution. Define SLAs by severity (critical: 24h, high: 7d, medium: 30d, low: 90d). Report on adherence monthly.

10. **Define all infrastructure as code and review changes through the same process as application code.** IaC provides a complete audit trail of infrastructure changes, drift detection, and repeatable configurations.

---

## 17. Anti-Patterns

1. **Building separate "compliance" processes instead of integrating controls into engineering.** Creating shadow processes that only exist for auditors leads to gaps between actual practice and documented controls. Build compliance into your real workflows.

2. **Collecting evidence manually at audit time.** Scrambling to compile screenshots and documents before an audit indicates that controls are not operating continuously. Automate evidence collection and review it regularly.

3. **Granting broad access to all engineers.** Giving everyone admin access or full production access violates least privilege (CC6.3). Define specific roles with specific permissions based on job function.

4. **Skipping code review for "urgent" changes.** Bypassing the PR review process for hotfixes undermines change management (CC8.1). Instead, have a documented emergency change process that includes expedited review and post-deployment verification.

5. **Ignoring dependency vulnerabilities until audit time.** Letting dependency security alerts accumulate without remediation creates risk and audit findings. Address vulnerabilities continuously according to defined SLAs.

6. **Not testing backup restoration.** Having backup configurations without testing restores is insufficient evidence for CC9.2. Quarterly restore tests are needed to demonstrate that backups actually work.

7. **Treating SOC 2 Type I as the end goal.** Type I demonstrates that controls are designed correctly at a point in time. Customers increasingly require Type II, which demonstrates ongoing effectiveness. Plan for Type II from the beginning.

8. **Documenting policies that do not reflect actual practice.** Writing policies that describe aspirational rather than actual controls creates misalignment that auditors will identify. Policies must reflect what you actually do.

---

## 18. Enforcement Checklist

### Access Management (CC6)
- [ ] SSO is configured for all production systems and tools.
- [ ] MFA is enforced for all users across all systems.
- [ ] Role-based access control is implemented with least privilege.
- [ ] User provisioning follows a documented approval workflow.
- [ ] Access is revoked within 24 hours of termination or role change.
- [ ] Quarterly access reviews are conducted and documented.
- [ ] Dormant accounts (90+ days inactive) are disabled.

### Change Management (CC8)
- [ ] Branch protection requires PR review and approval before merge.
- [ ] At least one reviewer other than the author approves changes.
- [ ] CI pipeline runs automated tests and security scans on every PR.
- [ ] Deployment to production requires explicit approval.
- [ ] All deployments are logged with actor, timestamp, and commit reference.
- [ ] Rollback procedures are documented and tested.
- [ ] Emergency change process is documented with post-change review.

### Incident Management (CC7)
- [ ] Incident response plan is documented and accessible.
- [ ] Severity levels and SLAs are defined.
- [ ] On-call rotation is established with clear escalation paths.
- [ ] All incidents are tracked in a ticketing system.
- [ ] Postmortems are completed for all significant incidents.
- [ ] Action items from postmortems are tracked to completion.
- [ ] Incident response exercises are conducted at least annually.

### Monitoring and Logging (CC4, CC7)
- [ ] Production infrastructure monitoring is in place (CPU, memory, disk, network).
- [ ] Application monitoring covers request rate, error rate, and latency.
- [ ] Security event monitoring detects authentication failures and unusual patterns.
- [ ] Alerts are configured with appropriate thresholds and notification channels.
- [ ] Logs are centralized in a tamper-evident log aggregation system.
- [ ] Log retention meets the defined policy (minimum 1 year recommended).
- [ ] Log review is performed regularly (automated daily, manual weekly).

### Encryption (CC6)
- [ ] All data is encrypted in transit (TLS 1.2+).
- [ ] All sensitive data is encrypted at rest.
- [ ] Encryption keys are managed through a dedicated KMS.
- [ ] Key rotation is automated (annual minimum).
- [ ] Key access is restricted to authorized roles only.

### Vulnerability Management (CC3, CC7)
- [ ] Automated vulnerability scanning is configured for infrastructure, application, and dependencies.
- [ ] Vulnerability remediation SLAs are defined by severity.
- [ ] All vulnerabilities are tracked in a centralized system.
- [ ] Remediation progress is reviewed weekly.
- [ ] Exceptions are documented and approved by management.

### Backup and Recovery (CC9)
- [ ] Automated backups are configured for all production data.
- [ ] Backups are encrypted and stored in a separate location.
- [ ] Backup integrity is verified regularly.
- [ ] Restore procedures are documented.
- [ ] Quarterly restore tests are conducted and documented.
- [ ] RTO and RPO objectives are defined and achievable.

### Risk Management (CC3, CC9)
- [ ] Annual risk assessment is conducted.
- [ ] Risks are tracked in a risk register with ownership and mitigation plans.
- [ ] Third-party vendor risk assessments are performed.
- [ ] Vendor compliance status (SOC 2 reports, certifications) is tracked.

### Policies and Procedures (CC1, CC5)
- [ ] Information security policy is documented and reviewed annually.
- [ ] Acceptable use policy is signed by all employees.
- [ ] Security awareness training is completed by all employees annually.
- [ ] Policies are accessible to all relevant personnel.
- [ ] Policy exceptions require documented approval.
