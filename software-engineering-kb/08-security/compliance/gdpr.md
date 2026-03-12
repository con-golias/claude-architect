# GDPR for Developers

> Comprehensive technical guide to the General Data Protection Regulation (EU) 2016/679.
> Audience: Software engineers, architects, and technical leads building systems that process personal data of EU/EEA residents.
> Last updated: 2026-03-10

---

## Table of Contents

1. Overview and Scope
2. Core Principles (Article 5)
3. Lawful Basis for Processing (Article 6)
4. Data Subject Rights (Articles 12-22)
5. Privacy by Design and Default (Article 25)
6. Data Protection Impact Assessments (Article 35)
7. Data Breach Notification (Articles 33-34)
8. Data Processing Agreements (Article 28)
9. Cross-Border Transfers (Chapter V)
10. Consent Management Implementation
11. Technical Measures
12. Code Examples
13. Best Practices
14. Anti-Patterns
15. Enforcement Checklist

---

## 1. Overview and Scope

The General Data Protection Regulation (GDPR) is the EU's primary data protection law, effective since May 25, 2018. It applies to any organization that processes personal data of individuals in the European Economic Area (EEA), regardless of where the organization is established.

### Key Definitions

- **Personal Data**: Any information relating to an identified or identifiable natural person (name, email, IP address, cookie identifiers, location data, biometric data).
- **Special Category Data**: Racial or ethnic origin, political opinions, religious beliefs, trade union membership, genetic data, biometric data, health data, sex life or sexual orientation.
- **Processing**: Any operation performed on personal data (collection, recording, storage, retrieval, use, disclosure, erasure).
- **Data Controller**: Entity that determines the purposes and means of processing.
- **Data Processor**: Entity that processes data on behalf of the controller.
- **Data Subject**: The identified or identifiable natural person.

### Territorial Scope (Article 3)

GDPR applies when:
- The organization is established in the EU/EEA (regardless of where processing occurs).
- The organization is outside the EU/EEA but offers goods/services to individuals in the EU/EEA.
- The organization monitors the behavior of individuals in the EU/EEA.

### Penalties

- Up to 20 million EUR or 4% of global annual turnover (whichever is higher) for the most serious infringements.
- Up to 10 million EUR or 2% of global annual turnover for lesser infringements.
- Individual member states may impose additional penalties.

---

## 2. Core Principles (Article 5)

All data processing must adhere to these seven principles. Every technical decision must trace back to one or more of them.

### 2.1 Lawfulness, Fairness, and Transparency

- Process personal data only under a valid lawful basis (see Section 3).
- Inform data subjects clearly about how their data is used.
- Avoid deceptive or hidden data collection practices.

```yaml
# Privacy notice checklist for transparency
transparency_requirements:
  - identity_of_controller: "Company name and contact"
  - purpose_of_processing: "Each specific purpose"
  - lawful_basis: "Which basis for each purpose"
  - recipients: "Who receives the data"
  - retention_periods: "How long data is kept"
  - data_subject_rights: "List of rights and how to exercise"
  - right_to_withdraw_consent: "If consent is the basis"
  - right_to_lodge_complaint: "With supervisory authority"
  - source_of_data: "If not collected directly"
  - automated_decision_making: "If applicable"
```

### 2.2 Purpose Limitation

- Collect data only for specified, explicit, and legitimate purposes.
- Do not process data in ways incompatible with the original purposes.
- Document purposes at the time of collection.

### 2.3 Data Minimization

- Process only data that is adequate, relevant, and limited to what is necessary.
- Do not collect "just in case" fields.
- Review data collection forms and API request bodies regularly.

```typescript
// BAD: collecting unnecessary fields
interface UserRegistration {
  name: string;
  email: string;
  phone: string;          // Not needed for email-only service
  dateOfBirth: string;    // Not needed unless age verification required
  socialMedia: string[];  // Not relevant to the service
}

// GOOD: minimal data collection
interface UserRegistration {
  name: string;
  email: string;
}
```

### 2.4 Accuracy

- Keep personal data accurate and up to date.
- Provide mechanisms for data subjects to correct their data.
- Implement validation at the point of collection.

### 2.5 Storage Limitation

- Retain personal data only as long as necessary for the stated purpose.
- Define and enforce retention periods.
- Automate data deletion or anonymization when retention periods expire.

```sql
-- Example retention policy table
CREATE TABLE data_retention_policies (
    data_category       VARCHAR(100) PRIMARY KEY,
    purpose             TEXT NOT NULL,
    retention_period    INTERVAL NOT NULL,
    action_on_expiry    VARCHAR(20) CHECK (action_on_expiry IN ('DELETE', 'ANONYMIZE', 'ARCHIVE')),
    legal_basis         VARCHAR(100) NOT NULL
);

INSERT INTO data_retention_policies VALUES
('user_account_data',    'Service delivery',     '3 years after last activity',  'DELETE',     'Contract'),
('transaction_logs',     'Financial compliance',  '7 years',                      'ARCHIVE',    'Legal obligation'),
('marketing_consent',    'Email campaigns',       '2 years after last consent',   'DELETE',     'Consent'),
('support_tickets',      'Customer service',      '2 years after resolution',     'ANONYMIZE',  'Legitimate interest');
```

### 2.6 Integrity and Confidentiality

- Protect data against unauthorized or unlawful processing, accidental loss, destruction, or damage.
- Implement appropriate technical and organizational measures (encryption, access controls, monitoring).

### 2.7 Accountability

- Demonstrate compliance with all principles.
- Maintain records of processing activities (Article 30).
- Conduct regular audits and reviews.

```yaml
# Records of Processing Activities (ROPA) template
processing_activity:
  name: "User Registration"
  controller: "Acme Corp, DPO: dpo@acme.com"
  purposes: ["Account creation", "Service delivery"]
  categories_of_data_subjects: ["Customers"]
  categories_of_personal_data: ["Name", "Email", "Hashed password"]
  recipients: ["Internal: Engineering team", "External: Email provider (SendGrid)"]
  transfers_to_third_countries: "US (SendGrid) - Standard Contractual Clauses"
  retention_period: "Duration of account + 30 days"
  technical_measures: ["Encryption at rest (AES-256)", "TLS 1.3 in transit", "RBAC"]
```

---

## 3. Lawful Basis for Processing (Article 6)

Every processing activity must be grounded in exactly one lawful basis. Choose the most appropriate basis before processing begins; do not change it retroactively.

### 3.1 Consent (Article 6(1)(a))

- Must be freely given, specific, informed, and unambiguous.
- Requires a clear affirmative action (no pre-ticked boxes).
- Must be as easy to withdraw as it was to give.
- Maintain proof of consent (who, when, what, how).
- Special category data requires explicit consent (Article 9(2)(a)).

### 3.2 Contract (Article 6(1)(b))

- Processing is necessary for the performance of a contract with the data subject.
- Processing is necessary for steps prior to entering into a contract at the request of the data subject.
- Example: processing a shipping address to deliver a product.

### 3.3 Legal Obligation (Article 6(1)(c))

- Processing is necessary to comply with a legal obligation of the controller.
- Example: retaining financial records for tax compliance.

### 3.4 Vital Interests (Article 6(1)(d))

- Processing is necessary to protect the vital interests of the data subject or another person.
- Typically relevant to life-and-death situations only.

### 3.5 Public Task (Article 6(1)(e))

- Processing is necessary for the performance of a task carried out in the public interest.
- Primarily applies to public authorities.

### 3.6 Legitimate Interest (Article 6(1)(f))

- Processing is necessary for the legitimate interests of the controller or a third party.
- Must not override the interests, rights, and freedoms of the data subject.
- Requires a Legitimate Interest Assessment (LIA).
- Examples: fraud prevention, network security, direct marketing (with opt-out).

```python
# Legitimate Interest Assessment template
lia_template = {
    "purpose": "Fraud detection on payment transactions",
    "necessity": "Real-time analysis of transaction patterns is required to prevent financial fraud",
    "balancing_test": {
        "controller_interest": "Preventing financial losses and protecting customers",
        "impact_on_data_subjects": "Transaction metadata analyzed; no sensitive data processed",
        "safeguards": [
            "Data minimization: only transaction metadata used",
            "Automated decisions subject to human review",
            "Data retained for 90 days only",
            "Access restricted to fraud team"
        ],
        "outcome": "Controller's interest does not override data subject rights"
    }
}
```

---

## 4. Data Subject Rights (Articles 12-22)

Implement mechanisms to handle all data subject rights. Respond within one month (extendable by two months for complex requests).

### 4.1 Right of Access (Article 15)

- Provide confirmation of whether personal data is being processed.
- Supply a copy of all personal data being processed.
- Include information about purposes, categories, recipients, retention periods, and the source of the data.

```python
# Data Subject Access Request handler
class DSARHandler:
    def handle_access_request(self, user_id: str) -> dict:
        """Compile all personal data for a data subject access request."""
        data = {
            "data_subject_id": user_id,
            "request_date": datetime.utcnow().isoformat(),
            "processing_purposes": self.get_processing_purposes(user_id),
            "personal_data": {
                "account_info": self.user_repo.get_profile(user_id),
                "orders": self.order_repo.get_by_user(user_id),
                "support_tickets": self.support_repo.get_by_user(user_id),
                "consent_records": self.consent_repo.get_by_user(user_id),
                "activity_logs": self.activity_repo.get_by_user(user_id),
                "marketing_preferences": self.marketing_repo.get_preferences(user_id),
            },
            "recipients": self.get_data_recipients(),
            "retention_periods": self.get_retention_policies(),
            "data_sources": self.get_data_sources(user_id),
            "automated_decisions": self.get_automated_decisions(user_id),
        }
        self.audit_log.record("DSAR_ACCESS", user_id, datetime.utcnow())
        return data
```

### 4.2 Right to Rectification (Article 16)

- Allow data subjects to correct inaccurate personal data.
- Allow data subjects to complete incomplete personal data.
- Propagate corrections to all systems and third parties.

### 4.3 Right to Erasure / Right to be Forgotten (Article 17)

Applies when:
- Data is no longer necessary for the original purpose.
- Consent is withdrawn and no other lawful basis exists.
- Data subject objects and no overriding legitimate grounds exist.
- Data was unlawfully processed.
- Erasure is required by law.

Exceptions: legal obligations, public health, archiving in the public interest, legal claims.

```typescript
// Right to erasure implementation
interface ErasureResult {
  userId: string;
  systemsProcessed: string[];
  erasureMethod: 'hard_delete' | 'anonymize' | 'crypto_shred';
  completedAt: string;
  retainedData: { system: string; reason: string; legalBasis: string }[];
}

async function executeErasure(userId: string): Promise<ErasureResult> {
  const result: ErasureResult = {
    userId,
    systemsProcessed: [],
    erasureMethod: 'hard_delete',
    completedAt: '',
    retainedData: [],
  };

  // 1. Identify all systems containing user data
  const systems = await dataRegistry.getSystemsForUser(userId);

  for (const system of systems) {
    // 2. Check for legal retention obligations
    const retention = await retentionPolicy.check(system, userId);

    if (retention.mustRetain) {
      result.retainedData.push({
        system: system.name,
        reason: retention.reason,
        legalBasis: retention.legalBasis,
      });
      continue;
    }

    // 3. Execute deletion based on system capabilities
    switch (system.erasureCapability) {
      case 'hard_delete':
        await system.deleteUserData(userId);
        break;
      case 'anonymize':
        await system.anonymizeUserData(userId);
        break;
      case 'crypto_shred':
        await system.destroyEncryptionKey(userId);
        break;
    }

    result.systemsProcessed.push(system.name);
  }

  // 4. Notify third-party processors
  await notifyProcessors(userId, 'erasure');

  // 5. Log the erasure action (without personal data)
  await auditLog.record({
    action: 'RIGHT_TO_ERASURE',
    subjectId: hashForAudit(userId),
    timestamp: new Date().toISOString(),
    systemsProcessed: result.systemsProcessed,
    retainedSystems: result.retainedData.map(r => r.system),
  });

  result.completedAt = new Date().toISOString();
  return result;
}
```

### 4.4 Right to Data Portability (Article 20)

- Provide personal data in a structured, commonly used, machine-readable format (JSON, CSV, XML).
- Enable direct transmission to another controller where technically feasible.
- Applies only to data provided by the data subject under consent or contract.

### 4.5 Right to Restriction of Processing (Article 18)

- Mark data as restricted (do not process, only store).
- Applies when accuracy is contested, processing is unlawful, controller no longer needs the data, or data subject has objected to processing.

### 4.6 Right to Object (Article 21)

- Data subjects can object to processing based on legitimate interest or public task.
- Absolute right to object to direct marketing (must stop immediately).
- Controller must demonstrate compelling legitimate grounds to override the objection.

### 4.7 Automated Decision-Making and Profiling (Article 22)

- Data subjects have the right not to be subject to decisions based solely on automated processing that produce legal or similarly significant effects.
- Provide meaningful information about the logic involved.
- Implement human review mechanisms.
- Exceptions: contract performance, authorized by law, explicit consent.

---

## 5. Privacy by Design and Default (Article 25)

### Privacy by Design

Integrate data protection into the design of systems and processes from the outset, not as an afterthought.

- Conduct privacy reviews during system architecture design.
- Minimize data collection at the schema level.
- Build access controls into the data model.
- Default to privacy-protective settings.

### Privacy by Default

- Only process data necessary for each specific purpose by default.
- Do not make personal data accessible to an indefinite number of persons by default.
- Limit the amount and scope of data collected.

```yaml
# Privacy by Design checklist for system design
privacy_by_design:
  data_minimization:
    - "Only collect fields required for the stated purpose"
    - "Remove optional fields unless justified"
    - "Pseudonymize where full identification is not needed"

  access_control:
    - "Implement least-privilege access by default"
    - "Role-based access to personal data"
    - "Separate admin access from data access"

  encryption:
    - "Encrypt personal data at rest (AES-256)"
    - "Encrypt in transit (TLS 1.2+)"
    - "Consider field-level encryption for sensitive data"

  retention:
    - "Set default retention period for every data category"
    - "Automate deletion at retention expiry"
    - "Support manual deletion for erasure requests"

  audit:
    - "Log all access to personal data"
    - "Log all modifications and deletions"
    - "Protect audit logs from tampering"

  default_settings:
    - "Marketing opt-in: OFF by default"
    - "Data sharing: OFF by default"
    - "Profile visibility: PRIVATE by default"
```

---

## 6. Data Protection Impact Assessments (Article 35)

A DPIA is mandatory when processing is likely to result in a high risk to the rights and freedoms of natural persons.

### When a DPIA is Required

- Systematic and extensive evaluation of personal aspects (profiling).
- Large-scale processing of special category data or criminal conviction data.
- Systematic monitoring of a publicly accessible area on a large scale.
- Use of new technologies.
- Automated decision-making with legal or similar effects.

### DPIA Content

```yaml
dpia_template:
  project_name: "Customer Analytics Platform"
  description: "Processing customer purchase and browsing data for personalized recommendations"
  necessity_and_proportionality:
    purpose: "Improve customer experience and increase conversion"
    lawful_basis: "Legitimate interest"
    data_minimization: "Only purchase history and anonymized browsing patterns"
    retention: "12 months rolling window"

  risks_identified:
    - risk: "Re-identification from aggregated browsing patterns"
      likelihood: "Medium"
      severity: "Medium"
      mitigation: "k-anonymity with k>=5, differential privacy noise"

    - risk: "Unauthorized access to customer profiles"
      likelihood: "Low"
      severity: "High"
      mitigation: "RBAC, encryption at rest, audit logging"

    - risk: "Function creep beyond original purpose"
      likelihood: "Medium"
      severity: "High"
      mitigation: "Purpose limitation enforced in data access layer, annual review"

  dpo_consultation: "2026-01-15"
  dpo_opinion: "Approved with conditions: implement differential privacy"
  review_date: "2026-07-15"
```

---

## 7. Data Breach Notification (Articles 33-34)

### Notification to Supervisory Authority (Article 33)

- Notify within **72 hours** of becoming aware of a breach.
- Document the breach regardless of whether notification is required.
- Include: nature of the breach, categories and approximate number of data subjects affected, contact details of the DPO, likely consequences, measures taken or proposed to address the breach.

### Notification to Data Subjects (Article 34)

- Required when the breach is likely to result in a **high risk** to the rights and freedoms of individuals.
- Communicate in clear and plain language.
- Not required if: data was encrypted/unintelligible, measures taken ensure the high risk is no longer likely, or individual notification would involve disproportionate effort (public communication instead).

```python
# Breach notification workflow
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

class BreachSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class BreachRecord:
    breach_id: str
    detected_at: datetime
    description: str
    data_categories: list[str]
    affected_count_estimate: int
    severity: BreachSeverity
    notification_deadline: datetime = None
    authority_notified: bool = False
    subjects_notified: bool = False

    def __post_init__(self):
        # 72-hour deadline from detection
        self.notification_deadline = self.detected_at + timedelta(hours=72)

    @property
    def hours_remaining(self) -> float:
        delta = self.notification_deadline - datetime.utcnow()
        return delta.total_seconds() / 3600

    def requires_authority_notification(self) -> bool:
        """Notify unless the breach is unlikely to result in risk."""
        return self.severity in (BreachSeverity.MEDIUM, BreachSeverity.HIGH, BreachSeverity.CRITICAL)

    def requires_subject_notification(self) -> bool:
        """Notify data subjects if high risk to their rights and freedoms."""
        return self.severity in (BreachSeverity.HIGH, BreachSeverity.CRITICAL)
```

---

## 8. Data Processing Agreements (Article 28)

When using third-party processors (cloud providers, SaaS tools, analytics services), a DPA is legally required.

### Required DPA Contents

- Subject matter and duration of processing.
- Nature and purpose of processing.
- Types of personal data and categories of data subjects.
- Obligations and rights of the controller.
- Processor commitments:
  - Process only on documented instructions.
  - Ensure persons authorized to process have committed to confidentiality.
  - Implement appropriate technical and organizational measures.
  - Assist the controller with data subject requests.
  - Delete or return all personal data at the end of the relationship.
  - Allow and contribute to audits.
  - Inform the controller if an instruction infringes GDPR.
  - Sub-processor requirements: prior authorization, flow-down of obligations.

```yaml
# DPA tracking register
data_processors:
  - name: "AWS"
    service: "Cloud infrastructure"
    data_processed: ["All application data"]
    dpa_signed: "2025-01-15"
    dpa_review_date: "2026-01-15"
    sub_processors_list: "https://aws.amazon.com/compliance/sub-processors/"
    transfer_mechanism: "SCCs + supplementary measures"
    data_location: "eu-west-1"

  - name: "SendGrid"
    service: "Transactional email"
    data_processed: ["Email addresses", "Names"]
    dpa_signed: "2025-03-01"
    dpa_review_date: "2026-03-01"
    sub_processors_list: "https://sendgrid.com/resource/sub-processors/"
    transfer_mechanism: "SCCs"
    data_location: "US"
```

---

## 9. Cross-Border Transfers (Chapter V)

### Transfer Mechanisms

Personal data can only be transferred outside the EEA using approved mechanisms.

**Adequacy Decisions (Article 45):**
- European Commission has determined the country provides adequate protection.
- Countries: Andorra, Argentina, Canada (commercial), Faroe Islands, Guernsey, Israel, Isle of Man, Japan, Jersey, New Zealand, Republic of Korea, Switzerland, UK, Uruguay, and the EU-US Data Privacy Framework.

**Standard Contractual Clauses (SCCs) (Article 46(2)(c)):**
- Pre-approved contract terms adopted by the Commission.
- Require a Transfer Impact Assessment (TIA) to evaluate the laws of the recipient country.
- Supplementary measures may be required (encryption, pseudonymization).

**Binding Corporate Rules (BCRs) (Article 47):**
- Internal rules adopted by a multinational group for intra-group transfers.
- Must be approved by the competent supervisory authority.
- Complex and resource-intensive to establish.

```typescript
// Transfer impact assessment helper
interface TransferImpactAssessment {
  dataExporter: string;
  dataImporter: string;
  recipientCountry: string;
  transferMechanism: 'adequacy' | 'sccs' | 'bcrs' | 'derogation';
  dataCategories: string[];
  assessmentOfLocalLaws: {
    governmentAccess: 'low_risk' | 'medium_risk' | 'high_risk';
    independentOversight: boolean;
    effectiveRemedies: boolean;
  };
  supplementaryMeasures: string[];
  conclusion: 'approved' | 'approved_with_conditions' | 'rejected';
  reviewDate: string;
}
```

---

## 10. Consent Management Implementation

### Requirements for Valid Consent

- **Freely given**: No imbalance of power; not a condition of service (unless necessary).
- **Specific**: Granular consent for each distinct purpose.
- **Informed**: Data subject knows who is processing, for what, and their rights.
- **Unambiguous**: Clear affirmative action.
- **Withdrawable**: As easy to withdraw as to give.

### Consent Record Structure

```typescript
interface ConsentRecord {
  consentId: string;
  userId: string;
  purpose: string;
  lawfulBasis: 'consent';
  consentGiven: boolean;
  consentTimestamp: string;
  consentMethod: 'web_form' | 'api' | 'verbal' | 'written';
  consentVersion: string;          // Version of the consent text shown
  ipAddress?: string;              // Evidence of consent
  userAgent?: string;              // Evidence of consent
  withdrawnAt?: string;
  withdrawalMethod?: string;
}

class ConsentManager {
  async recordConsent(params: {
    userId: string;
    purpose: string;
    consentGiven: boolean;
    consentVersion: string;
    metadata: Record<string, string>;
  }): Promise<ConsentRecord> {
    const record: ConsentRecord = {
      consentId: generateUUID(),
      userId: params.userId,
      purpose: params.purpose,
      lawfulBasis: 'consent',
      consentGiven: params.consentGiven,
      consentTimestamp: new Date().toISOString(),
      consentMethod: 'web_form',
      consentVersion: params.consentVersion,
      ipAddress: params.metadata.ipAddress,
      userAgent: params.metadata.userAgent,
    };

    await this.consentStore.save(record);
    await this.auditLog.record('CONSENT_RECORDED', record);
    return record;
  }

  async withdrawConsent(userId: string, purpose: string): Promise<void> {
    const record = await this.consentStore.findActive(userId, purpose);
    if (!record) throw new Error('No active consent found');

    record.withdrawnAt = new Date().toISOString();
    record.withdrawalMethod = 'user_initiated';
    await this.consentStore.update(record);

    // Stop all processing based on this consent
    await this.processingEngine.stopProcessing(userId, purpose);
    await this.auditLog.record('CONSENT_WITHDRAWN', { userId, purpose });
  }

  async hasValidConsent(userId: string, purpose: string): Promise<boolean> {
    const record = await this.consentStore.findActive(userId, purpose);
    return record !== null && record.consentGiven && !record.withdrawnAt;
  }
}
```

---

## 11. Technical Measures

### 11.1 Encryption

```yaml
encryption_requirements:
  at_rest:
    algorithm: "AES-256-GCM"
    key_management: "AWS KMS / Azure Key Vault / HashiCorp Vault"
    scope: "All databases, file storage, backups containing personal data"

  in_transit:
    protocol: "TLS 1.2 minimum, TLS 1.3 preferred"
    certificate_management: "Automated via Let's Encrypt or ACM"
    internal_services: "mTLS for service-to-service communication"

  field_level:
    use_case: "Sensitive fields (SSN, payment data, health data)"
    approach: "Application-level encryption before storage"
    key_rotation: "Annual minimum, immediate on compromise"
```

### 11.2 Pseudonymization

Replace identifying data with pseudonyms while maintaining a separate mapping for re-identification when necessary.

```python
import hashlib
import secrets

class Pseudonymizer:
    def __init__(self, secret_key: bytes):
        self._key = secret_key

    def pseudonymize(self, identifier: str) -> str:
        """Create a consistent pseudonym for an identifier."""
        return hashlib.blake2b(
            identifier.encode(),
            key=self._key,
            digest_size=16
        ).hexdigest()

    def pseudonymize_record(self, record: dict, fields: list[str]) -> dict:
        """Pseudonymize specified fields in a record."""
        result = record.copy()
        for field in fields:
            if field in result and result[field] is not None:
                result[field] = self.pseudonymize(str(result[field]))
        return result

# Usage: analytics can work with pseudonymized data
pseudonymizer = Pseudonymizer(secret_key=secrets.token_bytes(32))
analytics_record = pseudonymizer.pseudonymize_record(
    {"user_id": "12345", "email": "user@example.com", "action": "page_view", "page": "/products"},
    fields=["user_id", "email"]
)
# Result: {"user_id": "a1b2c3...", "email": "d4e5f6...", "action": "page_view", "page": "/products"}
```

### 11.3 Access Controls

```yaml
access_control_model:
  principle: "Least privilege"
  implementation: "Role-Based Access Control (RBAC)"

  roles:
    customer_support:
      access: ["user_name", "user_email", "order_history"]
      restricted: ["payment_details", "full_address", "ip_logs"]

    data_analyst:
      access: ["pseudonymized_analytics_data"]
      restricted: ["raw_personal_data"]

    engineering:
      access: ["system_logs", "performance_metrics"]
      restricted: ["production_personal_data"]
      note: "Use pseudonymized/synthetic data in development"

    dpo:
      access: ["processing_records", "dpia_documents", "consent_records"]
      restricted: ["raw_personal_data_at_scale"]
```

### 11.4 Audit Logging

```typescript
interface GDPRAuditEntry {
  timestamp: string;
  actor: string;            // Who performed the action
  actorRole: string;        // Their role
  action: string;           // What action was taken
  resource: string;         // What data was accessed/modified
  dataSubjectId?: string;   // Pseudonymized subject identifier
  purpose: string;          // Why the action was taken
  lawfulBasis: string;      // Under which lawful basis
  outcome: 'success' | 'failure' | 'denied';
  ipAddress: string;
  details?: Record<string, unknown>;
}

// All access to personal data must be logged
async function logPersonalDataAccess(entry: GDPRAuditEntry): Promise<void> {
  // Write to append-only, tamper-evident audit log
  await auditStore.append(entry);

  // Alert on suspicious patterns
  if (entry.outcome === 'denied') {
    await alerting.notify('access_denied', entry);
  }
}
```

### 11.5 Data Retention Automation

```python
from datetime import datetime, timedelta

class RetentionEnforcer:
    """Automatically enforce data retention policies."""

    def __init__(self, policies: list[RetentionPolicy], repositories: dict):
        self.policies = policies
        self.repositories = repositories

    async def enforce_all(self):
        """Run retention enforcement for all policies. Schedule daily."""
        for policy in self.policies:
            repo = self.repositories[policy.data_category]
            expired_records = await repo.find_expired(
                retention_period=policy.retention_period,
                reference_date=datetime.utcnow()
            )

            for record in expired_records:
                if policy.action == "DELETE":
                    await repo.hard_delete(record.id)
                elif policy.action == "ANONYMIZE":
                    await repo.anonymize(record.id, fields=policy.fields_to_anonymize)

                await self.audit_log.record(
                    action=f"RETENTION_{policy.action}",
                    data_category=policy.data_category,
                    record_id_hash=hash_for_audit(record.id),
                    policy_name=policy.name,
                )

            logger.info(
                f"Retention enforcement: {policy.data_category} - "
                f"{len(expired_records)} records processed ({policy.action})"
            )
```

### 11.6 Right to Erasure: Crypto-Shredding

When hard deletion is impractical (e.g., data in backups or distributed systems), encrypt each user's data with a unique key and destroy the key to render data permanently unreadable.

```python
class CryptoShredder:
    """
    Encrypt user data with per-user keys.
    Destroy the key to effectively erase all data.
    """

    def __init__(self, key_vault):
        self.key_vault = key_vault

    def encrypt_for_user(self, user_id: str, data: bytes) -> bytes:
        """Encrypt data with the user's unique key."""
        key = self.key_vault.get_or_create_key(user_id)
        return aes_gcm_encrypt(data, key)

    def decrypt_for_user(self, user_id: str, ciphertext: bytes) -> bytes:
        """Decrypt data with the user's unique key."""
        key = self.key_vault.get_key(user_id)
        if key is None:
            raise DataShreddedError(f"Key for user {user_id} has been destroyed")
        return aes_gcm_decrypt(ciphertext, key)

    def shred_user_data(self, user_id: str) -> None:
        """Destroy the user's encryption key, rendering all data unreadable."""
        self.key_vault.destroy_key(user_id)
        self.audit_log.record("CRYPTO_SHRED", user_id_hash=hash_id(user_id))
```

### 11.7 Anonymization

```python
def anonymize_user_record(record: dict) -> dict:
    """
    Transform a record so it can no longer be attributed to a specific individual.
    True anonymization means the data is no longer personal data under GDPR.
    """
    anonymized = {
        # Remove direct identifiers
        "user_id": None,
        "name": None,
        "email": None,
        "ip_address": None,
        "phone": None,

        # Generalize quasi-identifiers
        "age": generalize_age(record.get("age")),       # 34 -> "30-39"
        "city": generalize_location(record.get("city")), # "Berlin" -> "Germany"
        "postal_code": record.get("postal_code", "")[:2] + "XXX",  # "10115" -> "10XXX"

        # Retain non-identifying attributes
        "purchase_category": record.get("purchase_category"),
        "purchase_amount_bucket": bucketize(record.get("purchase_amount"), [0, 50, 100, 500]),
        "event_date": record.get("event_date"),
    }
    return anonymized

def generalize_age(age: int | None) -> str | None:
    if age is None:
        return None
    decade = (age // 10) * 10
    return f"{decade}-{decade + 9}"

def bucketize(value: float | None, boundaries: list[float]) -> str | None:
    if value is None:
        return None
    for i in range(len(boundaries) - 1):
        if value < boundaries[i + 1]:
            return f"{boundaries[i]}-{boundaries[i+1]}"
    return f"{boundaries[-1]}+"
```

---

## 12. Code Examples

### Full Consent Management Flow (TypeScript)

```typescript
// Consent API endpoints
import express from 'express';

const router = express.Router();

// Record consent
router.post('/api/consent', async (req, res) => {
  const { userId, purposes, consentVersion } = req.body;

  // Validate that all purposes are recognized
  const validPurposes = ['marketing_email', 'analytics', 'personalization', 'third_party_sharing'];
  const invalidPurposes = purposes.filter((p: string) => !validPurposes.includes(p));
  if (invalidPurposes.length > 0) {
    return res.status(400).json({ error: `Invalid purposes: ${invalidPurposes.join(', ')}` });
  }

  const records = await Promise.all(
    purposes.map((purpose: string) =>
      consentManager.recordConsent({
        userId,
        purpose,
        consentGiven: true,
        consentVersion,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
        },
      })
    )
  );

  res.status(201).json({ consents: records });
});

// Withdraw consent
router.delete('/api/consent/:purpose', async (req, res) => {
  const userId = req.user.id; // From authentication middleware
  const { purpose } = req.params;

  await consentManager.withdrawConsent(userId, purpose);

  res.status(200).json({
    message: `Consent for '${purpose}' withdrawn successfully`,
    note: 'Processing based on this consent will cease immediately',
  });
});

// Get current consent status
router.get('/api/consent', async (req, res) => {
  const userId = req.user.id;
  const consents = await consentManager.getAllConsents(userId);

  res.status(200).json({ consents });
});
```

### Data Deletion Cascade (Python)

```python
async def handle_deletion_request(user_id: str) -> DeletionReport:
    """
    Handle a complete data deletion request across all systems.
    """
    report = DeletionReport(user_id=user_id, requested_at=datetime.utcnow())

    # Phase 1: Identify all data locations
    data_map = await data_registry.map_user_data(user_id)

    # Phase 2: Check retention obligations
    for system in data_map.systems:
        obligation = await check_retention_obligation(system, user_id)
        if obligation.must_retain:
            report.add_retained(system.name, obligation.reason, obligation.expiry)
        else:
            report.add_for_deletion(system.name)

    # Phase 3: Execute deletions
    for system_name in report.systems_for_deletion:
        try:
            await delete_from_system(system_name, user_id)
            report.mark_deleted(system_name)
        except DeletionError as e:
            report.mark_failed(system_name, str(e))

    # Phase 4: Notify third-party processors
    for processor in data_map.external_processors:
        await notify_processor_deletion(processor, user_id)
        report.add_processor_notified(processor.name)

    # Phase 5: Confirm completion
    report.completed_at = datetime.utcnow()
    report.status = "completed" if not report.failures else "partial"

    # Log without personal data
    await audit_log.record(
        action="DELETION_REQUEST_PROCESSED",
        subject_hash=hash_id(user_id),
        report_summary=report.summary(),
    )

    return report
```

---

## 13. Best Practices

1. **Map all personal data flows before writing code.** Maintain a data inventory that documents every system, database, and third-party service that processes personal data. Update it whenever the architecture changes.

2. **Choose the lawful basis before designing the feature.** Document the lawful basis for each processing activity during the design phase. Never change the lawful basis retroactively to justify existing processing.

3. **Implement consent as a first-class service.** Build a centralized consent management system with versioned consent records, timestamps, and proof. Make withdrawal as easy as granting consent.

4. **Default to privacy-protective settings.** Pre-ticked boxes and default opt-ins violate GDPR. Require explicit affirmative action for consent. Default to the minimum data collection necessary.

5. **Automate data retention enforcement.** Do not rely on manual deletion. Schedule automated jobs to enforce retention policies. Test them regularly to confirm they work correctly.

6. **Build data subject rights into your APIs from the start.** Design data access, export, rectification, and deletion endpoints as core functionality, not as afterthoughts added when a regulator asks.

7. **Use pseudonymization for analytics and testing.** Never use production personal data for development or testing. Pseudonymize or generate synthetic data for non-production environments.

8. **Encrypt personal data at rest and in transit.** Use AES-256 for data at rest and TLS 1.2+ for data in transit. Implement field-level encryption for special category data.

9. **Log all access to personal data with purpose justification.** Audit logs must record who accessed what data, when, and for what purpose. Store logs in tamper-evident systems with separate access controls.

10. **Conduct DPIAs for high-risk processing activities.** Any processing that uses profiling, large-scale monitoring, special category data, or new technologies requires a documented impact assessment before processing begins.

---

## 14. Anti-Patterns

1. **Collecting data "just in case."** Gathering fields that are not needed for the current purpose violates data minimization. Every field must have a documented justification.

2. **Using consent as the default lawful basis for everything.** Consent is fragile (can be withdrawn at any time) and often inappropriate when another basis (contract, legitimate interest) is more suitable. Using consent incorrectly creates compliance risk.

3. **Pre-ticked consent checkboxes.** GDPR requires unambiguous, affirmative action. Pre-ticked boxes or consent bundled with terms of service do not constitute valid consent.

4. **Storing personal data indefinitely without retention policies.** Failing to define and enforce retention periods violates the storage limitation principle and increases breach impact.

5. **Treating pseudonymized data as anonymized.** Pseudonymized data remains personal data under GDPR because re-identification is possible. Only truly anonymized data (where re-identification is not reasonably possible) falls outside GDPR scope.

6. **Ignoring third-party processor compliance.** The controller remains responsible for data processed by third parties. Failing to have a DPA, verify processor compliance, or monitor sub-processors creates liability.

7. **Relying solely on soft deletion for erasure requests.** Setting a `deleted_at` flag does not satisfy the right to erasure. Data must be actually deleted, anonymized, or crypto-shredded so it cannot be recovered.

8. **Copying production data to development environments.** Using real personal data in development, testing, or staging environments violates data minimization and creates unnecessary exposure risk.

---

## 15. Enforcement Checklist

Use this checklist to verify GDPR compliance across your systems.

### Data Inventory and Documentation
- [ ] All personal data processing activities are documented in a Records of Processing Activities (ROPA).
- [ ] Each processing activity has a documented lawful basis.
- [ ] Data flow diagrams exist showing how personal data moves between systems.
- [ ] A data inventory identifies all databases, services, and third parties that store personal data.

### Consent Management
- [ ] Consent is collected with clear affirmative action (no pre-ticked boxes).
- [ ] Consent records include timestamp, version, method, and proof.
- [ ] Consent withdrawal is available and equally easy as granting consent.
- [ ] Processing stops when consent is withdrawn.
- [ ] Separate consent is obtained for each distinct purpose.

### Data Subject Rights
- [ ] A mechanism exists for data subjects to submit access, rectification, erasure, portability, restriction, and objection requests.
- [ ] Requests are handled within one month (extendable by two months with notification).
- [ ] Identity verification is performed before fulfilling requests.
- [ ] Responses are provided free of charge (unless manifestly unfounded or excessive).
- [ ] Third-party processors are notified when rectification or erasure is required.

### Technical Measures
- [ ] Personal data is encrypted at rest (AES-256 or equivalent).
- [ ] Personal data is encrypted in transit (TLS 1.2+).
- [ ] Access controls enforce least-privilege access to personal data.
- [ ] Audit logs record all access to and modification of personal data.
- [ ] Audit logs are stored in tamper-evident, separately controlled systems.
- [ ] Pseudonymization or anonymization is applied where full identification is not needed.
- [ ] Field-level encryption is used for special category data.

### Data Retention
- [ ] Retention periods are defined for every category of personal data.
- [ ] Automated retention enforcement runs on a schedule (at least daily).
- [ ] Retention enforcement has been tested and verified.
- [ ] Backup retention aligns with data retention policies.

### Breach Response
- [ ] A documented breach response procedure exists.
- [ ] The procedure specifies the 72-hour notification requirement to the supervisory authority.
- [ ] The procedure specifies when and how to notify affected data subjects.
- [ ] Breach simulation exercises are conducted at least annually.
- [ ] Contact details for the supervisory authority are documented and accessible.

### Third-Party Processors
- [ ] A DPA is in place with every third-party processor.
- [ ] DPAs include all Article 28 required terms.
- [ ] Sub-processor lists are maintained and monitored for changes.
- [ ] Cross-border transfer mechanisms (SCCs, adequacy decisions) are documented and assessed.

### Privacy by Design
- [ ] Privacy reviews are part of the software development lifecycle.
- [ ] DPIAs are conducted for high-risk processing activities.
- [ ] Default settings are privacy-protective (opt-in, not opt-out).
- [ ] Non-production environments use pseudonymized or synthetic data.
- [ ] The DPO (or privacy team) is consulted during system design.

### Organizational
- [ ] A Data Protection Officer (DPO) is appointed where required (Article 37).
- [ ] Privacy training is provided to all staff who process personal data.
- [ ] Privacy policies are accessible, clear, and up to date.
- [ ] Regular compliance audits are conducted.
- [ ] Documentation is maintained to demonstrate accountability.
