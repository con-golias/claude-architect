# Security in Regulated Industries

> Comprehensive technical guide to security requirements in regulated industries: FedRAMP, DORA, NIS2, and CMMC.
> Audience: Software engineers and architects building systems for government, financial services, critical infrastructure, and defense supply chain markets.
> Last updated: 2026-03-10

---

## Table of Contents

1. Overview
2. FedRAMP: Federal Risk and Authorization Management Program
3. FedRAMP Authorization Levels
4. FedRAMP NIST 800-53 Control Baseline
5. FedRAMP Continuous Monitoring (ConMon)
6. FedRAMP JAB vs Agency Authorization
7. DORA: Digital Operational Resilience Act
8. DORA ICT Risk Management
9. DORA Incident Reporting
10. DORA Digital Operational Resilience Testing
11. DORA Third-Party Risk Management
12. NIS2 Directive
13. NIS2 Obligations and Requirements
14. NIS2 Incident Reporting
15. NIS2 Supply Chain Security
16. CMMC: Cybersecurity Maturity Model Certification
17. CMMC Levels and Requirements
18. CMMC and NIST SP 800-171 Alignment
19. Developer Implications for Each Framework
20. Common Patterns Across Regulated Industries
21. Translating Regulatory Requirements to Technical Controls
22. Code and Configuration Examples
23. Best Practices
24. Anti-Patterns
25. Enforcement Checklist

---

## 1. Overview

Regulated industries impose specific security requirements that go beyond general best practices. These requirements are backed by law, carry significant penalties for non-compliance, and often require formal certification or authorization.

### Framework Summary

```yaml
framework_summary:
  fedramp:
    jurisdiction: "United States (federal government)"
    sector: "Cloud service providers serving federal agencies"
    basis: "NIST SP 800-53"
    type: "Authorization program"
    enforcement: "Federal agencies, FedRAMP PMO"

  dora:
    jurisdiction: "European Union"
    sector: "Financial services (banks, insurance, investment firms, ICT providers)"
    basis: "EU Regulation 2022/2554"
    type: "Regulation (directly applicable in all EU member states)"
    enforcement: "National competent authorities, European Supervisory Authorities"
    effective: "January 17, 2025"

  nis2:
    jurisdiction: "European Union"
    sector: "Essential and important entities across multiple sectors"
    basis: "EU Directive 2022/2555"
    type: "Directive (transposed into national law)"
    enforcement: "National competent authorities"
    effective: "October 18, 2024 (transposition deadline)"

  cmmc:
    jurisdiction: "United States (Department of Defense)"
    sector: "Defense Industrial Base (DIB) supply chain"
    basis: "NIST SP 800-171 / NIST SP 800-172"
    type: "Certification program"
    enforcement: "Department of Defense, CMMC Accreditation Body"
```

---

## 2. FedRAMP: Federal Risk and Authorization Management Program

FedRAMP provides a standardized approach for security assessment, authorization, and continuous monitoring of cloud products and services used by federal agencies.

### Who Needs FedRAMP

- Cloud Service Providers (CSPs) selling to US federal agencies.
- SaaS, PaaS, and IaaS providers used in federal IT environments.
- Third-party services used by FedRAMP-authorized services (through agency requirements).

### FedRAMP Program Structure

```yaml
fedramp_program:
  pmo: "FedRAMP Program Management Office (within GSA)"
  3pao: "Third-Party Assessment Organizations (independent assessors)"
  jab: "Joint Authorization Board (DoD, DHS, GSA CIOs)"
  agency: "Individual federal agency authorizing official"

  authorization_process:
    step_1: "Preparation: CSP implements controls and prepares documentation"
    step_2: "Assessment: 3PAO conducts independent assessment"
    step_3: "Authorization: JAB or agency grants Provisional/Agency ATO"
    step_4: "Continuous monitoring: Ongoing compliance verification"

  documentation:
    ssp: "System Security Plan (core document)"
    sap: "Security Assessment Plan (3PAO assessment approach)"
    sar: "Security Assessment Report (3PAO findings)"
    poam: "Plan of Action and Milestones (remediation tracking)"
```

---

## 3. FedRAMP Authorization Levels

```yaml
fedramp_levels:
  low:
    impact: "Low (FIPS 199)"
    description: "Loss of confidentiality, integrity, or availability would have limited adverse effect"
    use_case: "Publicly available data, non-sensitive information"
    controls: "~156 controls (NIST 800-53 Low baseline)"
    example: "Public-facing website hosting, collaboration tools for non-sensitive data"

  moderate:
    impact: "Moderate (FIPS 199)"
    description: "Loss would have serious adverse effect"
    use_case: "Most federal workloads; PII, controlled but not classified information"
    controls: "~325 controls (NIST 800-53 Moderate baseline)"
    example: "Email services, CRM systems, HR systems"
    note: "Most common FedRAMP authorization level"

  high:
    impact: "High (FIPS 199)"
    description: "Loss would have severe or catastrophic adverse effect"
    use_case: "Law enforcement, emergency services, financial systems, healthcare"
    controls: "~421 controls (NIST 800-53 High baseline)"
    example: "National security systems, financial transaction processing"
```

### Control Count by Level

```yaml
control_comparison:
  control_family: ["AC", "AU", "CA", "CM", "CP", "IA", "IR", "MA", "MP", "PE", "PL", "PM", "PS", "RA", "SA", "SC", "SI"]

  impact_mapping:
    low: "Basic controls; foundational security"
    moderate: "Enhanced controls; additional monitoring, access control, audit"
    high: "Comprehensive controls; maximum protection, redundancy, and resilience"

  additional_fedramp_requirements:
    - "FedRAMP adds controls beyond NIST baselines (e.g., FedRAMP-specific parameters)"
    - "Stricter implementation parameters (e.g., shorter patching timelines)"
    - "Additional continuous monitoring requirements"
    - "Specific reporting formats and timelines"
```

---

## 4. FedRAMP NIST 800-53 Control Baseline

### Key Control Families for Developers

```yaml
fedramp_developer_controls:
  access_control_ac:
    AC-2: "Account management: automated provisioning, deprovisioning, disable inactive (90 days)"
    AC-3: "Access enforcement: RBAC, attribute-based access control"
    AC-6: "Least privilege: privilege escalation requires approval"
    AC-7: "Unsuccessful logon attempts: lock after 3 consecutive failures for 30 minutes"
    AC-11: "Session lock: lock after 15 minutes (moderate/high) or 30 minutes (low)"
    AC-17: "Remote access: encrypted, MFA required"

  audit_au:
    AU-2: "Audit events: comprehensive list of auditable events"
    AU-3: "Content of audit records: user ID, timestamp, event type, outcome, source"
    AU-6: "Audit review: review within 24 hours of generation for high impact"
    AU-7: "Audit reduction and report generation: SIEM required for moderate/high"
    AU-9: "Protection of audit information: separate storage, integrity protection"
    AU-12: "Audit generation: all information system components"

  configuration_cm:
    CM-2: "Baseline configuration: documented, reviewed annually"
    CM-3: "Configuration change control: formal change process"
    CM-6: "Configuration settings: CIS Benchmarks or equivalent"
    CM-7: "Least functionality: disable unnecessary ports, protocols, services"
    CM-8: "System component inventory: automated, updated continuously"

  identification_ia:
    IA-2: "Identification and authentication: unique IDs, MFA for all access (moderate/high)"
    IA-5: "Authenticator management: password complexity, rotation, breach checking"
    IA-8: "Non-organizational users: authentication required for all external users"

  system_comms_sc:
    SC-7: "Boundary protection: firewall, DMZ, network segmentation"
    SC-8: "Transmission confidentiality and integrity: FIPS-validated TLS"
    SC-12: "Cryptographic key management: FIPS 140-2/3 validated modules"
    SC-13: "Cryptographic protection: FIPS 140-2/3 validated algorithms"
    SC-28: "Protection of information at rest: FIPS-validated encryption"

  system_integrity_si:
    SI-2: "Flaw remediation: critical/high within 30 days, moderate within 90 days"
    SI-4: "System monitoring: real-time alerting for security events"
    SI-10: "Information input validation: all external inputs"
```

### FIPS 140-2/3 Requirement

```yaml
fips_140:
  requirement: "FedRAMP requires FIPS 140-2 Level 1 minimum (FIPS 140-3 for new validations)"
  applies_to: "All cryptographic modules used to protect federal information"
  implementation:
    - "Use FIPS-validated cryptographic libraries"
    - "AWS: enable FIPS endpoints (e.g., fips.us-east-1.amazonaws.com)"
    - "Azure: use Azure Government for FIPS endpoints"
    - "GCP: use FIPS-validated BoringCrypto module"
    - "Application code: use FIPS-validated OpenSSL or equivalent"
  common_mistake: "Using non-FIPS algorithms (e.g., ChaCha20 without FIPS validation)"
```

---

## 5. FedRAMP Continuous Monitoring (ConMon)

```yaml
fedramp_conmon:
  description: "Ongoing assessment of security posture after initial authorization"

  monthly_requirements:
    - "Vulnerability scanning of all system components"
    - "Report scan results to FedRAMP PMO"
    - "Remediate critical/high vulnerabilities within 30 days"
    - "Update POA&M with any new findings"
    - "Significant change assessment if applicable"

  quarterly_requirements:
    - "Review and update system security plan if needed"
    - "Submit quarterly POA&M updates"
    - "Conduct security awareness training assessments"

  annual_requirements:
    - "Full 3PAO annual assessment (subset of controls)"
    - "Penetration testing"
    - "Review and update all authorization documentation"
    - "Contingency plan testing"
    - "Incident response plan testing"

  vulnerability_remediation_sla:
    critical: "30 calendar days"
    high: "30 calendar days"
    moderate: "90 calendar days"
    low: "365 calendar days"

  significant_changes:
    definition: "Changes that may affect the security posture of the system"
    examples:
      - "New interconnections or data flows"
      - "Architecture changes"
      - "New services or capabilities"
      - "Changes to the authorization boundary"
    process: "Security impact analysis, possible 3PAO assessment"
```

---

## 6. FedRAMP JAB vs Agency Authorization

```yaml
fedramp_authorization_paths:
  jab:
    name: "Joint Authorization Board Provisional ATO (P-ATO)"
    description: "Centralized authorization reviewed by DoD, DHS, and GSA CIOs"
    benefits:
      - "Recognized across all federal agencies"
      - "Higher trust and wider reuse"
      - "FedRAMP PMO prioritization"
    requirements:
      - "CSP must be sponsored by a federal agency or selected through FedRAMP Connect"
      - "Full 3PAO assessment"
      - "JAB review of all documentation"
    timeline: "12-18 months typical"
    best_for: "CSPs targeting multiple federal agencies"

  agency:
    name: "Agency Authority to Operate (ATO)"
    description: "Authorization granted by a specific federal agency"
    benefits:
      - "Can be faster than JAB"
      - "Direct relationship with sponsoring agency"
      - "Agency-specific tailoring"
    requirements:
      - "Sponsoring agency identifies need"
      - "3PAO assessment"
      - "Agency AO reviews and grants ATO"
    timeline: "6-12 months typical"
    best_for: "CSPs with a specific agency customer"
    note: "Agency ATO can be leveraged by other agencies through FedRAMP marketplace"
```

---

## 7. DORA: Digital Operational Resilience Act

DORA (EU Regulation 2022/2554) establishes uniform requirements for the security of network and information systems in the EU financial sector. It became applicable on January 17, 2025.

### Who Must Comply

```yaml
dora_entities:
  financial_entities:
    - "Credit institutions (banks)"
    - "Payment institutions"
    - "Electronic money institutions"
    - "Investment firms"
    - "Insurance and reinsurance undertakings"
    - "Central securities depositories"
    - "Central counterparties"
    - "Trading venues"
    - "Crypto-asset service providers"
    - "Crowdfunding service providers"

  ict_service_providers:
    description: "ICT third-party service providers that are designated as critical"
    examples: ["Major cloud providers", "Core banking platform providers", "Payment processors"]
    oversight: "Direct oversight by European Supervisory Authorities (ESAs)"
```

---

## 8. DORA ICT Risk Management

```yaml
dora_ict_risk_management:
  governance:
    - "Management body retains ultimate responsibility for ICT risk management"
    - "Management body must define, approve, oversee, and be accountable for the ICT risk management framework"
    - "Adequate budget and resources allocated"
    - "Management body must undergo specific ICT risk training"

  framework_requirements:
    identification:
      - "Identify and document all ICT-supported business functions"
      - "Identify all sources of ICT risk"
      - "Identify information assets and ICT assets"
      - "Map interconnections and dependencies"
      - "Classify information assets by criticality"

    protection:
      - "Implement ICT security policies and procedures"
      - "Implement ICT security awareness programs"
      - "Implement strong authentication mechanisms"
      - "Manage access rights on a need-to-know basis"
      - "Implement encryption for data at rest and in transit"
      - "Implement network security"
      - "Implement change management procedures"
      - "Implement patch management"

    detection:
      - "Implement mechanisms to detect anomalous activities"
      - "Monitor all ICT systems and network traffic"
      - "Implement intrusion detection"
      - "Log and monitor access to information assets"

    response_and_recovery:
      - "Implement ICT business continuity policy"
      - "Implement ICT response and recovery plans"
      - "Implement backup policies and procedures"
      - "Implement restoration and recovery procedures"
      - "Test ICT business continuity plans at least annually"

    learning_and_evolving:
      - "Review ICT risk management framework at least annually"
      - "Incorporate lessons learned from incidents and tests"
      - "Stay informed about ICT vulnerabilities and cyber threats"
```

```python
# DORA ICT Risk Management framework implementation
class DORAICTRiskFramework:
    """Framework for DORA ICT risk management compliance."""

    async def perform_risk_assessment(self) -> DORAARiskReport:
        """Annual ICT risk assessment per DORA Article 6."""
        report = DORAARiskReport(assessment_date=datetime.utcnow())

        # Step 1: Identify ICT-supported business functions
        business_functions = await self.inventory.list_business_functions()
        report.business_functions = business_functions

        # Step 2: Identify and classify information assets
        assets = await self.inventory.list_ict_assets()
        for asset in assets:
            asset.criticality = self.classify_criticality(asset)
        report.ict_assets = assets

        # Step 3: Map dependencies and interconnections
        dependencies = await self.inventory.map_dependencies()
        report.dependency_map = dependencies

        # Step 4: Identify threats and vulnerabilities
        for asset in assets:
            threats = await self.threat_intel.get_threats(asset)
            vulns = await self.scanner.get_vulnerabilities(asset)
            risk = self.calculate_risk(asset, threats, vulns)
            report.add_risk(asset, risk)

        # Step 5: Define risk treatment
        for risk in report.risks:
            if risk.level > self.risk_appetite:
                risk.treatment = await self.define_treatment(risk)

        return report
```

---

## 9. DORA Incident Reporting

```yaml
dora_incident_reporting:
  classification:
    criteria:
      - "Number of clients/counterparties affected"
      - "Amount of transactions affected"
      - "Duration of the incident"
      - "Geographical spread"
      - "Impact on the availability, authenticity, integrity, or confidentiality of data"
      - "Impact on critical or important functions"
      - "Economic impact"

  major_incident_reporting:
    initial_notification:
      timeline: "Within 4 hours of classifying as major (no later than 24 hours after detection)"
      content: "Initial details of the incident"
      recipient: "National competent authority"

    intermediate_report:
      timeline: "Within 72 hours of initial notification"
      content: "Updated information, preliminary root cause, mitigation measures"

    final_report:
      timeline: "Within 1 month of the intermediate report"
      content: "Root cause analysis, lessons learned, remediation actions"

  significant_cyber_threats:
    reporting: "Voluntary reporting of significant cyber threats (encouraged, not mandatory)"
    recipient: "National competent authority"

  customer_notification:
    requirement: "Where the incident has or may have an impact on clients' financial interests, notify without undue delay"
    content: "Nature of incident, measures taken, actions clients should take"
```

---

## 10. DORA Digital Operational Resilience Testing

```yaml
dora_testing:
  basic_testing:
    applicability: "All financial entities"
    requirements:
      - "Vulnerability assessments and scans"
      - "Open source software analysis"
      - "Network security assessments"
      - "Gap analyses"
      - "Physical security reviews"
      - "Source code reviews where feasible"
      - "Scenario-based testing"
      - "Compatibility testing"
      - "Performance testing"
      - "End-to-end testing"
      - "Penetration testing"
    frequency: "At least annually for critical ICT systems"

  advanced_testing_tlpt:
    name: "Threat-Led Penetration Testing (TLPT)"
    applicability: "Systemically important financial entities (designated by authorities)"
    requirements:
      - "Conducted at least every 3 years"
      - "Based on TIBER-EU framework or equivalent"
      - "Cover critical and important functions"
      - "Real threat intelligence-driven scenarios"
      - "Red team testing of live production systems"
      - "Independent testers (external or internal with strict conditions)"
    scope:
      - "Must include ICT third-party service providers (can be pooled)"
      - "Must cover live production systems"
      - "Must be based on current threat intelligence"
    results: "Shared with competent authority; used to improve resilience measures"
```

---

## 11. DORA Third-Party Risk Management

```yaml
dora_third_party_risk:
  pre_contractual_assessment:
    - "Due diligence on ICT third-party service providers"
    - "Assess the provider's information security capabilities"
    - "Identify concentration risk (over-reliance on single provider)"
    - "Consider substitutability"
    - "Assess provider's sub-outsourcing arrangements"

  contractual_requirements:
    mandatory_provisions:
      - "Description of all functions and services"
      - "Data processing locations"
      - "Data protection and access provisions"
      - "Service level agreements (SLAs)"
      - "Incident reporting obligations"
      - "Right of access, inspection, and audit"
      - "Termination and exit strategy"
      - "Sub-outsourcing notification and consent"
      - "Business continuity provisions"
      - "Cooperation with competent authorities"

  register_of_information:
    requirement: "Maintain a register of information on all ICT third-party arrangements"
    content:
      - "Provider identification"
      - "Functions and services provided"
      - "Nature of data and processing"
      - "Sub-outsourcing chains"
      - "Criticality assessment"
      - "Contractual terms"
    reporting: "Submit to competent authorities upon request"

  critical_ict_providers:
    designation: "European Supervisory Authorities (ESAs) designate critical providers"
    oversight: "Direct oversight by lead ESA"
    requirements:
      - "Enhanced transparency and reporting"
      - "Cooperation with oversight framework"
      - "Compliance with recommendations"
    penalties: "Periodic penalty payments for non-compliance"
```

---

## 12. NIS2 Directive

The Network and Information Security Directive 2 (EU 2022/2555) replaces the original NIS Directive and significantly expands its scope and requirements. The transposition deadline for member states was October 18, 2024.

### Scope

```yaml
nis2_scope:
  essential_entities:
    sectors:
      - "Energy (electricity, gas, oil, hydrogen, heating/cooling, district heating)"
      - "Transport (air, rail, water, road)"
      - "Banking"
      - "Financial market infrastructure"
      - "Health (healthcare providers, EU reference laboratories, pharma, medical devices)"
      - "Drinking water"
      - "Wastewater"
      - "Digital infrastructure (IXPs, DNS, TLD registries, cloud computing, data centers, CDN, trust services, public communications networks)"
      - "ICT service management (B2B, managed services, managed security services)"
      - "Public administration"
      - "Space"
    size_criteria: "Medium and large enterprises (50+ employees or 10M+ EUR turnover)"

  important_entities:
    sectors:
      - "Postal and courier services"
      - "Waste management"
      - "Manufacturing of certain critical products (chemicals, medical devices, computers, electronics, machinery, motor vehicles)"
      - "Food production, processing, and distribution"
      - "Digital providers (online marketplaces, search engines, social networking)"
      - "Research organizations"
    size_criteria: "Medium and large enterprises in these sectors"

  key_difference: "Essential entities subject to ex-ante supervision; important entities subject to ex-post supervision"
```

---

## 13. NIS2 Obligations and Requirements

```yaml
nis2_obligations:
  risk_management_measures:
    article_21: "Cybersecurity risk management measures"
    minimum_measures:
      - "Policies on risk analysis and information system security"
      - "Incident handling"
      - "Business continuity (backup management, disaster recovery, crisis management)"
      - "Supply chain security"
      - "Security in network and information systems acquisition, development, and maintenance (including vulnerability handling and disclosure)"
      - "Policies and procedures for assessing the effectiveness of cybersecurity risk management measures"
      - "Basic cyber hygiene practices and cybersecurity training"
      - "Policies on the use of cryptography and encryption"
      - "Human resources security, access control policies, and asset management"
      - "Use of multi-factor authentication or continuous authentication solutions, secured communication within the entity"

  management_accountability:
    - "Management bodies must approve cybersecurity risk management measures"
    - "Management bodies must oversee implementation"
    - "Management bodies are personally accountable for non-compliance"
    - "Management bodies must undergo cybersecurity training"
    - "Management bodies must require similar training for employees"

  proportionality:
    - "Measures must be proportionate to the risk"
    - "Take into account the entity's size, exposure to risks, likelihood and severity of incidents"
    - "Take into account societal and economic impact of incidents"
```

```yaml
# NIS2 compliance requirements mapped to technical controls
nis2_technical_controls:
  risk_analysis:
    - "Regular risk assessments of information systems"
    - "Documented risk treatment decisions"
    - "Annual review of risk assessment"

  incident_handling:
    - "Incident response plan"
    - "Incident classification and prioritization"
    - "Forensic investigation capabilities"
    - "Post-incident analysis"

  business_continuity:
    - "Backup policies with regular testing"
    - "Disaster recovery plans with defined RTO/RPO"
    - "Crisis management procedures"
    - "Regular exercises and testing"

  supply_chain:
    - "Vendor risk assessment"
    - "Security requirements in contracts"
    - "Monitoring of supplier security posture"
    - "Dependency tracking (SBOM)"

  vulnerability_management:
    - "Vulnerability scanning and assessment"
    - "Patch management with defined timelines"
    - "Vulnerability disclosure process"
    - "SBOM for all deployed software"

  access_control:
    - "Multi-factor authentication"
    - "Role-based access control"
    - "Privileged access management"
    - "Regular access reviews"

  cryptography:
    - "Encryption at rest and in transit"
    - "Key management procedures"
    - "Approved algorithms and protocols"

  training:
    - "Regular cybersecurity awareness training"
    - "Role-specific training for technical staff"
    - "Management cybersecurity training"
```

---

## 14. NIS2 Incident Reporting

```yaml
nis2_incident_reporting:
  significant_incident_criteria:
    - "Caused or is capable of causing severe operational disruption or financial loss"
    - "Has affected or is capable of affecting other natural or legal persons by causing considerable material or non-material damage"

  reporting_timeline:
    early_warning:
      deadline: "Within 24 hours of becoming aware of a significant incident"
      content:
        - "Whether the incident is suspected to be caused by unlawful or malicious acts"
        - "Whether the incident could have a cross-border impact"

    incident_notification:
      deadline: "Within 72 hours of becoming aware"
      content:
        - "Update to early warning"
        - "Initial assessment of severity and impact"
        - "Indicators of compromise (where applicable)"

    intermediate_report:
      deadline: "Upon request of the CSIRT or competent authority"
      content: "Status updates on incident handling"

    final_report:
      deadline: "Within 1 month of the incident notification"
      content:
        - "Detailed description of the incident"
        - "Severity and impact assessment"
        - "Type of threat or root cause"
        - "Mitigation measures applied and ongoing"
        - "Cross-border impact assessment"

  recipient: "National CSIRT or competent authority (varies by member state)"

  customer_notification:
    condition: "If the incident is likely to adversely affect the provision of the entity's services"
    requirement: "Inform recipients of the services without undue delay"
```

---

## 15. NIS2 Supply Chain Security

```yaml
nis2_supply_chain:
  requirements:
    article_21_2d: "Supply chain security, including security-related aspects concerning the relationships between each entity and its direct suppliers or service providers"

  measures:
    - "Assess the overall quality of products and cybersecurity practices of suppliers"
    - "Take into account the results of coordinated security risk assessments of critical supply chains"
    - "Include cybersecurity requirements in contractual arrangements with suppliers"
    - "Monitor and review supplier security posture"

  coordinated_risk_assessment:
    description: "EU-level coordinated risk assessment of critical supply chains (e.g., 5G)"
    participants: "Member states, ENISA, European Commission"
    output: "Recommendations for risk mitigation"

  developer_implications:
    - "Software supply chain security (SBOM, dependency scanning)"
    - "Secure development practices for products sold to NIS2 entities"
    - "Incident disclosure obligations if vulnerabilities affect NIS2 entities"
    - "Compliance evidence requested by NIS2-covered customers"
```

---

## 16. CMMC: Cybersecurity Maturity Model Certification

CMMC is a unified standard for implementing cybersecurity across the Defense Industrial Base (DIB). It is a certification program required for companies bidding on DoD contracts that involve Controlled Unclassified Information (CUI) or Federal Contract Information (FCI).

### Background

```yaml
cmmc_background:
  purpose: "Protect CUI and FCI in the DoD supply chain"
  basis: "NIST SP 800-171 (CUI protection) and NIST SP 800-172 (enhanced security)"
  evolution:
    cmmc_1_0: "Original 5-level model (2020)"
    cmmc_2_0: "Simplified 3-level model (2021 revision)"
  rulemaking: "48 CFR (DFARS) rule implementing CMMC requirements in contracts"
  phased_rollout: "Phased implementation beginning in 2025"
```

---

## 17. CMMC Levels and Requirements

```yaml
cmmc_levels:
  level_1:
    name: "Foundational"
    applicable_to: "FCI (Federal Contract Information)"
    controls: "15 practices from FAR 52.204-21"
    assessment: "Annual self-assessment"
    examples:
      - "Use authorized access control"
      - "Limit system access to authorized users"
      - "Verify identity of users"
      - "Limit physical access"
      - "Sanitize media before disposal"
      - "Identify and report flaws"
      - "Update malicious code protection"
      - "Perform periodic system scans"

  level_2:
    name: "Advanced"
    applicable_to: "CUI (Controlled Unclassified Information)"
    controls: "110 practices from NIST SP 800-171 Rev 2"
    assessment:
      non_prioritized: "Annual self-assessment (for select programs)"
      prioritized: "Triennial third-party assessment by C3PAO"
    domains:
      - "Access Control (AC) - 22 practices"
      - "Awareness and Training (AT) - 3 practices"
      - "Audit and Accountability (AU) - 9 practices"
      - "Configuration Management (CM) - 9 practices"
      - "Identification and Authentication (IA) - 11 practices"
      - "Incident Response (IR) - 3 practices"
      - "Maintenance (MA) - 6 practices"
      - "Media Protection (MP) - 9 practices"
      - "Personnel Security (PS) - 2 practices"
      - "Physical Protection (PE) - 6 practices"
      - "Risk Assessment (RA) - 3 practices"
      - "Security Assessment (CA) - 4 practices"
      - "System and Communications Protection (SC) - 16 practices"
      - "System and Information Integrity (SI) - 7 practices"

  level_3:
    name: "Expert"
    applicable_to: "CUI requiring enhanced protection against APTs"
    controls: "NIST SP 800-172 selected controls (beyond 800-171)"
    assessment: "Government-led assessment (DIBCAC)"
    note: "Required for highest-value DoD programs"
```

---

## 18. CMMC and NIST SP 800-171 Alignment

```yaml
nist_800_171_key_requirements:
  access_control:
    3_1_1: "Limit system access to authorized users, processes acting on behalf of authorized users, and devices"
    3_1_2: "Limit system access to the types of transactions and functions that authorized users are permitted to execute"
    3_1_5: "Employ the principle of least privilege, including for specific security functions and privileged accounts"
    3_1_7: "Prevent non-privileged users from executing privileged functions and capture the execution of such functions in audit logs"

  audit_accountability:
    3_3_1: "Create and retain system audit logs and records to the extent needed to enable monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity"
    3_3_2: "Ensure that the actions of individual system users can be uniquely traced to those users so they can be held accountable"

  configuration_management:
    3_4_1: "Establish and maintain baseline configurations and inventories of organizational systems"
    3_4_2: "Establish and enforce security configuration settings for IT products employed in organizational systems"
    3_4_6: "Employ the principle of least functionality by configuring organizational systems to provide only essential capabilities"

  identification_authentication:
    3_5_3: "Use multifactor authentication for local and network access to privileged accounts and for network access to non-privileged accounts"

  system_communications:
    3_13_1: "Monitor, control, and protect communications at the external boundary and key internal boundaries of organizational systems"
    3_13_8: "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission unless otherwise protected by alternative physical safeguards"
    3_13_11: "Employ FIPS-validated cryptography when used to protect the confidentiality of CUI"
```

```yaml
# CMMC Level 2 - Translating 800-171 to technical controls
cmmc_level_2_implementation:
  access_control:
    - "SSO with MFA for all users (3.5.3)"
    - "RBAC enforcing least privilege (3.1.5)"
    - "Separate admin accounts from standard accounts (3.1.5)"
    - "Session timeout: 15 minutes inactivity (3.1.10)"
    - "Wireless access restrictions (3.1.16)"
    - "Mobile device access control (3.1.18)"

  audit:
    - "Centralized log management (3.3.1)"
    - "Unique user traceability in all logs (3.3.2)"
    - "Audit log protection from unauthorized modification (3.3.8)"
    - "Alert on audit process failure (3.3.4)"

  encryption:
    - "FIPS 140-2 validated cryptography for CUI (3.13.11)"
    - "Encryption of CUI in transit (3.13.8)"
    - "Encryption of CUI at rest (3.13.16)"

  vulnerability_management:
    - "Regular vulnerability scanning (3.11.2)"
    - "Remediation of vulnerabilities per risk (3.11.3)"
    - "Malicious code protection (3.14.2)"
    - "System and application patching (3.14.1)"
```

---

## 19. Developer Implications for Each Framework

```yaml
developer_implications:
  fedramp:
    architecture:
      - "Deploy in FedRAMP-authorized cloud regions"
      - "Use FIPS-validated cryptographic modules"
      - "Implement network segmentation with documented boundaries"
      - "All components must be within the authorization boundary"
    development:
      - "Comprehensive audit logging for all components"
      - "Change management with formal approval process"
      - "Vulnerability scanning integrated into CI/CD"
      - "Security impact analysis for every change"
    operations:
      - "Monthly vulnerability scanning and reporting"
      - "Continuous monitoring dashboard"
      - "Incident response with 1-hour reporting for high-impact"
      - "Plan of Action and Milestones (POA&M) management"

  dora:
    architecture:
      - "Design for operational resilience (multi-region, failover)"
      - "Implement comprehensive monitoring and anomaly detection"
      - "Support full audit trail of all financial operations"
    development:
      - "Implement change management with testing requirements"
      - "Regular source code reviews"
      - "Vulnerability management with defined timelines"
    operations:
      - "ICT incident management with 4-hour/72-hour reporting"
      - "Annual resilience testing of critical systems"
      - "Backup verification and restore testing"

  nis2:
    architecture:
      - "Implement defense-in-depth across all layers"
      - "MFA for all access"
      - "Encryption at rest and in transit"
    development:
      - "Secure development lifecycle"
      - "Supply chain security (SBOM, dependency management)"
      - "Vulnerability disclosure process"
    operations:
      - "24-hour early warning, 72-hour incident notification"
      - "Regular cybersecurity risk assessments"
      - "Business continuity and disaster recovery testing"

  cmmc:
    architecture:
      - "CUI boundary definition and enforcement"
      - "FIPS-validated cryptography for all CUI"
      - "Network segmentation isolating CUI systems"
    development:
      - "Change management with baseline configurations"
      - "Least functionality in system configuration"
      - "All audit events traceable to individual users"
    operations:
      - "Continuous monitoring of CUI systems"
      - "Incident reporting to DoD within 72 hours"
      - "Regular self-assessment (Level 1) or third-party assessment (Level 2)"
```

---

## 20. Common Patterns Across Regulated Industries

Despite differences in specific requirements, regulated industries share common security patterns.

```yaml
common_patterns:
  audit_logging:
    requirement: "All frameworks require comprehensive audit logging"
    implementation:
      - "Log all authentication events (success and failure)"
      - "Log all access to regulated data"
      - "Log all administrative actions"
      - "Log all configuration changes"
      - "Protect log integrity (append-only, tamper-evident)"
      - "Retain logs per framework requirements (6 months to 7 years)"
      - "Centralize logs in a SIEM for correlation and alerting"

  access_control:
    requirement: "All frameworks require strong access control"
    implementation:
      - "Unique user identification for all users"
      - "Multi-factor authentication"
      - "Role-based access control with least privilege"
      - "Regular access reviews (quarterly minimum)"
      - "Automated deprovisioning on termination"
      - "Privileged access management"

  encryption:
    requirement: "All frameworks require encryption of sensitive data"
    implementation:
      - "Encryption at rest (AES-256 minimum)"
      - "Encryption in transit (TLS 1.2+)"
      - "Key management through dedicated services"
      - "Key rotation policies"
      - "FIPS validation where required (FedRAMP, CMMC)"

  incident_response:
    requirement: "All frameworks require formal incident response"
    implementation:
      - "Documented incident response plan"
      - "Severity classification"
      - "Notification timelines (vary by framework)"
      - "Root cause analysis"
      - "Post-incident improvement"
      - "Regular testing and exercises"

  change_management:
    requirement: "All frameworks require controlled change processes"
    implementation:
      - "Documented change management procedures"
      - "Approval workflow for production changes"
      - "Testing before production deployment"
      - "Rollback procedures"
      - "Change audit trail"

  vulnerability_management:
    requirement: "All frameworks require vulnerability identification and remediation"
    implementation:
      - "Regular vulnerability scanning"
      - "Dependency monitoring"
      - "Defined remediation timelines by severity"
      - "Patch management process"
      - "Penetration testing"

  business_continuity:
    requirement: "All frameworks require continuity and recovery planning"
    implementation:
      - "Backup procedures with regular testing"
      - "Disaster recovery plans with defined RTO/RPO"
      - "Annual (minimum) testing of recovery procedures"
      - "Crisis communication plans"
```

---

## 21. Translating Regulatory Requirements to Technical Controls

```yaml
regulatory_to_technical:
  requirement: "Multi-factor authentication required"
  frameworks: ["All"]
  technical_controls:
    - "OIDC/SAML SSO with MFA enforcement at the IdP level"
    - "WebAuthn/FIDO2 hardware keys for highest assurance"
    - "TOTP authenticator apps as secondary option"
    - "MFA bypass prevention (no fallback to SMS for high-assurance)"
    - "Conditional access policies based on risk signals"

  requirement: "Encrypt data at rest"
  frameworks: ["All"]
  technical_controls:
    - "Database encryption (RDS/Cloud SQL native encryption)"
    - "Storage encryption (S3 SSE-KMS, GCS CMEK)"
    - "Volume encryption (EBS, Persistent Disk)"
    - "Application-level encryption for sensitive fields"
    - "FIPS 140-2/3 validated modules (FedRAMP, CMMC)"

  requirement: "Comprehensive audit logging"
  frameworks: ["All"]
  technical_controls:
    - "Application-level structured logging (JSON format)"
    - "Cloud provider audit trails (CloudTrail, Cloud Audit Logs)"
    - "Database audit logging"
    - "SIEM for log aggregation and correlation"
    - "Tamper-evident log storage (S3 Object Lock, WORM storage)"
    - "Log retention per framework requirements"

  requirement: "Incident notification within defined timeline"
  frameworks: ["All"]
  technical_controls:
    - "Automated incident detection and alerting"
    - "Incident management platform (PagerDuty, Opsgenie)"
    - "Runbooks with notification procedures"
    - "Regulatory notification templates pre-prepared"
    - "Communication channels for internal and external notification"

  requirement: "Vulnerability remediation within defined timelines"
  frameworks: ["All"]
  technical_controls:
    - "CI/CD integrated vulnerability scanning (SAST, SCA, container scanning)"
    - "Vulnerability tracking in ticketing system"
    - "Automated dependency update tools (Dependabot, Renovate)"
    - "SLA-based remediation enforcement"
    - "Exception management process for deferred remediation"
```

---

## 22. Code and Configuration Examples

### Multi-Framework Audit Logging

```python
"""
Audit logger designed to satisfy requirements across
FedRAMP (AU-2/3), DORA (Article 10), NIS2 (Article 21), and CMMC (3.3.1/2).
"""

import json
from datetime import datetime
from enum import Enum

class EventCategory(Enum):
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    CONFIGURATION_CHANGE = "configuration_change"
    ADMIN_ACTION = "admin_action"
    SECURITY_EVENT = "security_event"
    SYSTEM_EVENT = "system_event"

class RegulatoryAuditLogger:
    """Audit logger meeting requirements across multiple regulatory frameworks."""

    def log_event(
        self,
        category: EventCategory,
        user_id: str,
        action: str,
        resource: str,
        outcome: str,
        source_ip: str,
        details: dict | None = None,
        data_classification: str | None = None,
    ) -> dict:
        # NIST AU-3 / CMMC 3.3.1: Required audit record content
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",  # AU-8: NTP synchronized
            "event_id": self.generate_event_id(),
            "category": category.value,
            "user_id": user_id,                   # CMMC 3.3.2: Unique traceability
            "action": action,
            "resource": resource,
            "outcome": outcome,                    # AU-3: Success/failure
            "source_ip": source_ip,                # AU-3: Origin of event
            "data_classification": data_classification,
            "details": details or {},
            "regulatory_tags": self._get_regulatory_tags(category),
        }

        # Write to tamper-evident storage (AU-9 / CMMC 3.3.8)
        self._write_to_storage(entry)

        # Real-time alerting for security events (SI-4 / NIS2 Article 21)
        if category == EventCategory.SECURITY_EVENT:
            self._send_alert(entry)

        return entry

    def _get_regulatory_tags(self, category: EventCategory) -> list[str]:
        """Tag events for framework-specific reporting."""
        tags = ["fedramp:AU-2", "cmmc:3.3.1", "nis2:art21", "dora:art10"]

        if category == EventCategory.AUTHENTICATION:
            tags.extend(["fedramp:AC-7", "cmmc:3.1.8"])
        elif category == EventCategory.DATA_ACCESS:
            tags.extend(["fedramp:AC-3", "cmmc:3.1.2"])
        elif category == EventCategory.CONFIGURATION_CHANGE:
            tags.extend(["fedramp:CM-3", "cmmc:3.4.3"])

        return tags
```

### FIPS-Compliant Encryption Configuration

```yaml
# AWS configuration for FIPS compliance (FedRAMP/CMMC)
fips_configuration:
  aws_endpoints:
    s3: "s3-fips.us-east-1.amazonaws.com"
    kms: "kms-fips.us-east-1.amazonaws.com"
    sts: "sts-fips.us-east-1.amazonaws.com"
    ec2: "ec2-fips.us-east-1.amazonaws.com"

  kms_configuration:
    key_spec: "SYMMETRIC_DEFAULT"  # AES-256-GCM (FIPS validated)
    origin: "AWS_KMS"
    key_rotation: true
    key_policy: "Restrict to authorized roles only"

  tls_configuration:
    minimum_version: "TLSv1.2"
    fips_cipher_suites:
      - "TLS_AES_256_GCM_SHA384"
      - "TLS_AES_128_GCM_SHA256"
      - "ECDHE-RSA-AES256-GCM-SHA384"
      - "ECDHE-RSA-AES128-GCM-SHA256"
```

```hcl
# Terraform: FIPS-compliant KMS key for CUI protection
resource "aws_kms_key" "cui_protection" {
  description             = "FIPS 140-2 validated key for CUI encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  customer_master_key_spec = "SYMMETRIC_DEFAULT"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RestrictKeyUsage"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::123456789012:role/CUIApplicationRole",
            "arn:aws:iam::123456789012:role/CUIAdminRole"
          ]
        }
        Action = [
          "kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey",
          "kms:DescribeKey", "kms:ReEncrypt*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    DataClassification = "CUI"
    Compliance         = "CMMC-L2,FedRAMP-Moderate"
    FIPSValidated      = "true"
  }
}
```

### Incident Reporting Timeline Manager

```typescript
// Manage incident reporting deadlines across frameworks
interface IncidentReportingTimeline {
  framework: string;
  reportType: string;
  deadline: Date;
  submitted: boolean;
  submittedAt?: Date;
}

class MultiFrameworkIncidentReporter {
  getReportingTimelines(incidentDetectedAt: Date, frameworks: string[]): IncidentReportingTimeline[] {
    const timelines: IncidentReportingTimeline[] = [];

    for (const framework of frameworks) {
      switch (framework) {
        case 'fedramp':
          timelines.push({
            framework: 'FedRAMP',
            reportType: 'US-CERT Notification',
            deadline: addHours(incidentDetectedAt, 1), // High impact: 1 hour
            submitted: false,
          });
          break;

        case 'dora':
          timelines.push(
            {
              framework: 'DORA',
              reportType: 'Initial Notification',
              deadline: addHours(incidentDetectedAt, 4), // Within 4 hours of classification
              submitted: false,
            },
            {
              framework: 'DORA',
              reportType: 'Intermediate Report',
              deadline: addHours(incidentDetectedAt, 72),
              submitted: false,
            },
            {
              framework: 'DORA',
              reportType: 'Final Report',
              deadline: addDays(incidentDetectedAt, 30),
              submitted: false,
            },
          );
          break;

        case 'nis2':
          timelines.push(
            {
              framework: 'NIS2',
              reportType: 'Early Warning',
              deadline: addHours(incidentDetectedAt, 24),
              submitted: false,
            },
            {
              framework: 'NIS2',
              reportType: 'Incident Notification',
              deadline: addHours(incidentDetectedAt, 72),
              submitted: false,
            },
            {
              framework: 'NIS2',
              reportType: 'Final Report',
              deadline: addDays(incidentDetectedAt, 30),
              submitted: false,
            },
          );
          break;

        case 'cmmc':
          timelines.push({
            framework: 'CMMC',
            reportType: 'DoD Incident Report',
            deadline: addHours(incidentDetectedAt, 72),
            submitted: false,
          });
          break;
      }
    }

    return timelines.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  }
}
```

---

## 23. Best Practices

1. **Map your controls to multiple frameworks from the beginning.** A single control implementation (e.g., MFA, encryption, logging) can satisfy requirements across FedRAMP, DORA, NIS2, and CMMC. Maintain a control-to-framework mapping to avoid duplication.

2. **Use FIPS-validated cryptographic modules when targeting FedRAMP or CMMC.** Non-FIPS cryptography is a common finding in federal assessments. Configure cloud provider FIPS endpoints and use validated libraries in application code.

3. **Design incident response for the shortest notification deadline.** If you must comply with multiple frameworks, design your incident response process for the tightest deadline (DORA: 4 hours for major ICT incidents after classification). This ensures compliance with all frameworks simultaneously.

4. **Implement comprehensive audit logging from day one.** Every framework requires audit logging. Retroactively adding logging to existing systems is far more expensive and error-prone than building it in from the start.

5. **Separate regulated data environments using network segmentation and separate accounts.** For CMMC, isolate CUI environments. For FedRAMP, define clear authorization boundaries. For DORA, identify and protect critical financial data. Segmentation reduces scope and risk.

6. **Automate continuous monitoring and compliance reporting.** Manual compliance monitoring does not scale. Use cloud-native compliance tools (AWS Config, Azure Policy), CSPM platforms, and compliance automation (Vanta, Drata) for continuous posture assessment.

7. **Maintain a register of all third-party ICT service providers.** DORA requires a formal register. NIS2 requires supply chain security. FedRAMP requires documentation of interconnections. A centralized vendor registry with security assessments serves all frameworks.

8. **Test business continuity and disaster recovery at least annually.** All four frameworks require resilience testing. Conduct tabletop exercises, backup restoration tests, and failover tests. Document results and remediate findings.

9. **Train management on their cybersecurity accountability.** DORA and NIS2 explicitly hold management personally accountable. Ensure management understands their obligations, approves security policies, and participates in relevant training.

10. **Build a culture of compliance-as-engineering, not compliance-as-paperwork.** Embed regulatory requirements into engineering workflows (CI/CD gates, automated scanning, IaC compliance checks). Documentation should be a byproduct of good engineering practice.

---

## 24. Anti-Patterns

1. **Treating regulatory compliance as a one-time project.** All four frameworks require continuous compliance. FedRAMP requires monthly scanning and annual assessments. DORA requires ongoing ICT risk management. Build compliance into daily operations.

2. **Using the same architecture for regulated and non-regulated workloads without segmentation.** Co-mingling regulated data (CUI, financial data, critical infrastructure data) with general business data expands scope and increases risk for all frameworks.

3. **Ignoring FIPS validation requirements for cryptography in federal contexts.** Using AES-256 is not sufficient; the implementation must be FIPS 140-2/3 validated. This is a pass/fail requirement for FedRAMP and CMMC.

4. **Failing to document the authorization boundary or CUI scope.** Unclear boundaries lead to audit findings and scope creep. Define exactly which systems, data flows, and personnel are in scope for each framework.

5. **Attempting to comply with CMMC Level 2 through self-assessment alone for prioritized programs.** Certain DoD programs require third-party assessment by a C3PAO. Self-assessment is only acceptable for non-prioritized programs at Level 2 and for all Level 1 assessments.

6. **Not having a formal incident reporting process aligned with framework timelines.** Different frameworks have different notification deadlines (1 hour for FedRAMP high, 4 hours for DORA, 24 hours for NIS2). Missing these deadlines is itself a compliance violation.

7. **Ignoring management accountability requirements in DORA and NIS2.** These frameworks explicitly require management body approval, oversight, and personal accountability. Technical teams cannot achieve compliance without management engagement.

8. **Treating supply chain security as someone else's problem.** NIS2, DORA, and CMMC all require assessment and management of supply chain risk. Your dependencies, subcontractors, and SaaS integrations are part of your compliance scope.

---

## 25. Enforcement Checklist

### FedRAMP
- [ ] Authorization boundary is defined and documented.
- [ ] System Security Plan (SSP) is complete and current.
- [ ] All NIST 800-53 baseline controls are implemented per authorization level.
- [ ] FIPS 140-2/3 validated cryptographic modules are used for all encryption.
- [ ] 3PAO assessment has been completed.
- [ ] POA&M is maintained with remediation timelines.
- [ ] Monthly vulnerability scanning is operational with reporting.
- [ ] Continuous monitoring program is documented and operational.
- [ ] Significant change process is defined and followed.
- [ ] Annual assessment and penetration testing is conducted.

### DORA
- [ ] ICT risk management framework is documented and approved by management.
- [ ] Management body has undergone ICT risk training.
- [ ] All ICT assets are identified, classified, and documented.
- [ ] ICT third-party service provider register is maintained.
- [ ] Contractual arrangements with ICT providers include all required provisions.
- [ ] Incident classification criteria are defined.
- [ ] Major incident reporting process is documented (4h/72h/1 month timelines).
- [ ] ICT business continuity and disaster recovery plans are documented and tested annually.
- [ ] Vulnerability management and patching process is operational.
- [ ] Resilience testing program is operational (basic testing annually; TLPT every 3 years if applicable).

### NIS2
- [ ] Cybersecurity risk management measures are documented and approved by management.
- [ ] Management body accountability for cybersecurity is established.
- [ ] Multi-factor authentication is implemented across all systems.
- [ ] Encryption at rest and in transit is implemented.
- [ ] Incident handling procedures are documented with 24h/72h/1 month reporting.
- [ ] Business continuity plans (backup, DR, crisis management) are documented and tested.
- [ ] Supply chain security measures are implemented (vendor assessment, SBOM, contractual requirements).
- [ ] Vulnerability handling and disclosure process is operational.
- [ ] Cybersecurity awareness training is conducted for all personnel.
- [ ] Security policy effectiveness assessment procedures are in place.

### CMMC
- [ ] CUI scope and data flows are documented.
- [ ] All 110 NIST SP 800-171 practices are implemented (for Level 2).
- [ ] FIPS-validated cryptography is used for all CUI.
- [ ] System Security Plan (SSP) is documented for CUI systems.
- [ ] POA&M tracks any practices not yet fully implemented.
- [ ] Self-assessment score is calculated and submitted to SPRS (Level 1 / non-prioritized Level 2).
- [ ] C3PAO assessment is scheduled or completed (for prioritized Level 2).
- [ ] Incident reporting to DoD (DIBNet) within 72 hours is documented and tested.
- [ ] CUI marking and handling procedures are in place.
- [ ] Network segmentation isolates CUI systems from non-CUI systems.

### Common Across All Frameworks
- [ ] Centralized audit logging is operational with tamper protection.
- [ ] Multi-factor authentication is enforced for all users.
- [ ] Encryption is applied to all regulated data at rest and in transit.
- [ ] Vulnerability scanning runs at least monthly with defined remediation SLAs.
- [ ] Incident response plan is documented, tested, and includes framework-specific notification timelines.
- [ ] Access control follows least privilege with regular access reviews.
- [ ] Change management process is documented and enforced.
- [ ] Business continuity and disaster recovery are documented and tested annually.
- [ ] Third-party/vendor risk management is operational.
- [ ] Security awareness training is conducted at least annually for all personnel.
