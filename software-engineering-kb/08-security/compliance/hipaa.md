# HIPAA for Developers

> Comprehensive technical guide to the Health Insurance Portability and Accountability Act.
> Audience: Software engineers building healthcare applications, health-tech platforms, and systems that handle Protected Health Information (PHI).
> Last updated: 2026-03-10

---

## Table of Contents

1. Overview and Scope
2. Protected Health Information (PHI) and ePHI
3. HIPAA Rules Overview
4. Privacy Rule
5. Security Rule: Technical Safeguards
6. Security Rule: Administrative Safeguards
7. Security Rule: Physical Safeguards
8. Breach Notification Rule
9. Business Associate Agreements (BAA)
10. Minimum Necessary Standard
11. De-identification Methods
12. HIPAA-Eligible Cloud Services
13. Logging and Audit Requirements
14. Code Examples
15. Best Practices
16. Anti-Patterns
17. Enforcement Checklist

---

## 1. Overview and Scope

HIPAA is a United States federal law enacted in 1996, with subsequent modifications through the HITECH Act (2009) and the Omnibus Rule (2013). It establishes national standards for the protection of health information.

### Who Must Comply

**Covered Entities:**
- Health plans (insurance companies, HMOs, employer-sponsored health plans).
- Healthcare providers who transmit health information electronically.
- Healthcare clearinghouses.

**Business Associates:**
- Any entity that creates, receives, maintains, or transmits PHI on behalf of a covered entity.
- This includes software vendors, cloud providers, data analytics companies, billing services, and IT contractors.

### Penalties

| Tier | Violation | Penalty per Violation | Annual Maximum |
|------|-----------|----------------------|----------------|
| 1 | Did not know | $100 - $50,000 | $25,000 |
| 2 | Reasonable cause | $1,000 - $50,000 | $100,000 |
| 3 | Willful neglect (corrected) | $10,000 - $50,000 | $250,000 |
| 4 | Willful neglect (not corrected) | $50,000 | $1,500,000 |

Criminal penalties can include fines up to $250,000 and up to 10 years imprisonment.

---

## 2. Protected Health Information (PHI) and ePHI

### What is PHI

Protected Health Information is individually identifiable health information that is:
- Created or received by a covered entity or business associate.
- Relates to the past, present, or future physical or mental health condition of an individual, the provision of healthcare, or payment for healthcare.
- Identifies the individual or provides a reasonable basis for identification.

### The 18 HIPAA Identifiers

PHI includes any health information combined with any of these identifiers:

```yaml
hipaa_identifiers:
  1: "Names"
  2: "Geographic data smaller than a state"
  3: "Dates (except year) related to an individual (birth, admission, discharge, death)"
  4: "Phone numbers"
  5: "Fax numbers"
  6: "Email addresses"
  7: "Social Security numbers"
  8: "Medical record numbers"
  9: "Health plan beneficiary numbers"
  10: "Account numbers"
  11: "Certificate/license numbers"
  12: "Vehicle identifiers and serial numbers"
  13: "Device identifiers and serial numbers"
  14: "Web URLs"
  15: "IP addresses"
  16: "Biometric identifiers"
  17: "Full-face photographs and comparable images"
  18: "Any other unique identifying number, characteristic, or code"
```

### What is ePHI

Electronic Protected Health Information (ePHI) is PHI that is created, stored, transmitted, or received electronically. This is the focus of the Security Rule and includes data in:

- Databases and data warehouses.
- Email systems.
- Mobile devices and applications.
- Cloud storage.
- Backup media.
- Electronic health records (EHR) systems.
- APIs that transmit health data.

### What is NOT PHI

- De-identified health information (per Safe Harbor or Expert Determination methods).
- Employment records held by a covered entity in its role as employer.
- Education records covered by FERPA.
- Health information about a person who has been deceased for more than 50 years.

---

## 3. HIPAA Rules Overview

### Privacy Rule (45 CFR Part 160 and Subparts A and E of Part 164)

- Governs the use and disclosure of PHI in any form (oral, written, electronic).
- Establishes individual rights regarding their PHI.
- Sets conditions for permitted uses and disclosures.

### Security Rule (45 CFR Part 160 and Subparts A and C of Part 164)

- Applies specifically to ePHI.
- Requires administrative, physical, and technical safeguards.
- Safeguard specifications are either "required" or "addressable."

**Important:** "Addressable" does not mean "optional." It means the entity must assess the specification, implement it if reasonable and appropriate, or document why an equivalent alternative was implemented.

### Breach Notification Rule (45 CFR Part 164 Subpart D)

- Requires notification after a breach of unsecured PHI.
- Defines timelines and procedures for notification.

### Enforcement Rule

- Establishes procedures for investigations, hearings, and penalties.

---

## 4. Privacy Rule

### Permitted Uses and Disclosures

PHI may be used or disclosed without individual authorization for:
- Treatment, payment, and healthcare operations (TPO).
- Public health activities.
- Reporting abuse or neglect.
- Health oversight activities.
- Judicial and administrative proceedings.
- Law enforcement purposes.
- Research (with certain conditions).

### Individual Rights Under the Privacy Rule

- **Right to access** their PHI (within 30 days, extendable by 30 days).
- **Right to request amendments** to their PHI.
- **Right to an accounting of disclosures** (non-TPO disclosures over the past 6 years).
- **Right to request restrictions** on certain uses/disclosures.
- **Right to request confidential communications** (e.g., contact at an alternative address).
- **Right to receive a Notice of Privacy Practices**.

```python
# PHI access request handler
from datetime import datetime, timedelta

class PHIAccessRequestHandler:
    """Handle individual requests for access to their PHI."""

    RESPONSE_DEADLINE_DAYS = 30
    EXTENSION_DAYS = 30

    async def handle_request(self, request_id: str, individual_id: str) -> dict:
        deadline = datetime.utcnow() + timedelta(days=self.RESPONSE_DEADLINE_DAYS)

        # Verify identity
        identity_verified = await self.verify_identity(individual_id)
        if not identity_verified:
            return {"status": "denied", "reason": "identity_verification_failed"}

        # Compile PHI from all designated record sets
        phi_records = await self.compile_phi(individual_id)

        # Check for any applicable exceptions
        filtered_records = await self.apply_exceptions(phi_records, individual_id)

        # Provide in requested format
        response = {
            "request_id": request_id,
            "individual_id": individual_id,
            "response_date": datetime.utcnow().isoformat(),
            "deadline": deadline.isoformat(),
            "records": filtered_records,
            "format": "electronic",  # Must provide in electronic format if maintained electronically
        }

        await self.audit_log.record("PHI_ACCESS_REQUEST_FULFILLED", request_id)
        return response
```

---

## 5. Security Rule: Technical Safeguards

The Security Rule (45 CFR 164.312) requires these technical safeguards for ePHI.

### 5.1 Access Control (Required - 164.312(a)(1))

```yaml
access_control_requirements:
  unique_user_identification:
    status: "Required"
    description: "Assign a unique name/number to each user for tracking"
    implementation:
      - "Unique user IDs for all system users"
      - "No shared accounts"
      - "Federated identity (SSO) with unique identifiers"

  emergency_access_procedure:
    status: "Required"
    description: "Procedures to obtain ePHI during emergencies"
    implementation:
      - "Break-glass access procedures"
      - "Emergency access accounts with enhanced audit logging"
      - "Time-limited emergency access tokens"
      - "Post-emergency access review within 24 hours"

  automatic_logoff:
    status: "Addressable"
    description: "Terminate sessions after predetermined inactivity"
    implementation:
      - "Session timeout after 15 minutes of inactivity"
      - "Server-side session invalidation"
      - "Warning before automatic logoff"

  encryption_and_decryption:
    status: "Addressable"
    description: "Encrypt and decrypt ePHI"
    implementation:
      - "AES-256 encryption at rest"
      - "Encrypt all ePHI stored on portable devices"
      - "Key management via HSM or cloud KMS"
```

```typescript
// Access control implementation for ePHI systems
interface AccessControlConfig {
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireMFA: boolean;
  emergencyAccessEnabled: boolean;
}

const hipaaAccessConfig: AccessControlConfig = {
  sessionTimeoutMinutes: 15,
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 30,
  requireMFA: true,
  emergencyAccessEnabled: true,
};

class HIPAAAccessControl {
  async authenticateUser(credentials: UserCredentials): Promise<AuthResult> {
    // 1. Verify unique user identification
    const user = await this.userStore.findByUniqueId(credentials.userId);
    if (!user) {
      await this.auditLog.record('AUTH_FAILED', { reason: 'user_not_found' });
      return { success: false, reason: 'invalid_credentials' };
    }

    // 2. Check account lockout
    if (await this.isLockedOut(user.id)) {
      await this.auditLog.record('AUTH_BLOCKED', { userId: user.id, reason: 'account_locked' });
      return { success: false, reason: 'account_locked' };
    }

    // 3. Verify password
    const passwordValid = await this.verifyPassword(credentials.password, user.passwordHash);
    if (!passwordValid) {
      await this.incrementFailedAttempts(user.id);
      await this.auditLog.record('AUTH_FAILED', { userId: user.id, reason: 'invalid_password' });
      return { success: false, reason: 'invalid_credentials' };
    }

    // 4. Require MFA
    if (this.config.requireMFA) {
      const mfaValid = await this.verifyMFA(user.id, credentials.mfaToken);
      if (!mfaValid) {
        await this.auditLog.record('AUTH_FAILED', { userId: user.id, reason: 'mfa_failed' });
        return { success: false, reason: 'mfa_required' };
      }
    }

    // 5. Create session with timeout
    const session = await this.createSession(user.id, {
      timeoutMinutes: this.config.sessionTimeoutMinutes,
      ipAddress: credentials.ipAddress,
    });

    await this.auditLog.record('AUTH_SUCCESS', { userId: user.id, sessionId: session.id });
    return { success: true, sessionId: session.id };
  }

  async breakGlassAccess(requesterId: string, reason: string): Promise<EmergencyAccess> {
    // Emergency access with enhanced logging
    const access = await this.createEmergencySession(requesterId, {
      reason,
      expiresInMinutes: 60,
      enhancedLogging: true,
    });

    // Immediately alert security team
    await this.alerting.sendCritical('BREAK_GLASS_ACCESS', {
      requesterId,
      reason,
      accessId: access.id,
      timestamp: new Date().toISOString(),
    });

    // Schedule mandatory review
    await this.scheduleReview(access.id, {
      reviewWithinHours: 24,
      reviewers: ['security_officer', 'privacy_officer'],
    });

    return access;
  }
}
```

### 5.2 Audit Controls (Required - 164.312(b))

```yaml
audit_control_requirements:
  activity_logs:
    - "Record all access to ePHI (read, write, delete)"
    - "Record authentication attempts (success and failure)"
    - "Record system administrative actions"
    - "Record access to audit logs themselves"

  log_contents:
    - "Timestamp (synchronized with NTP)"
    - "User identifier"
    - "Event type"
    - "Resource accessed"
    - "Action taken"
    - "Outcome (success/failure)"
    - "Source IP address"
    - "Reason/purpose (where applicable)"

  log_protection:
    - "Write-once storage (append-only)"
    - "Separate access controls for audit logs"
    - "Integrity verification (checksums, HMAC)"
    - "Minimum 6-year retention (per HIPAA record retention)"

  review_procedures:
    - "Daily automated review for anomalies"
    - "Weekly security team review"
    - "Immediate alerting on suspicious activity"
    - "Quarterly comprehensive audit review"
```

```python
# HIPAA-compliant audit logger
import json
import hashlib
from datetime import datetime
from enum import Enum

class AuditEventType(Enum):
    PHI_ACCESS = "PHI_ACCESS"
    PHI_CREATE = "PHI_CREATE"
    PHI_UPDATE = "PHI_UPDATE"
    PHI_DELETE = "PHI_DELETE"
    PHI_EXPORT = "PHI_EXPORT"
    PHI_DISCLOSURE = "PHI_DISCLOSURE"
    AUTH_SUCCESS = "AUTH_SUCCESS"
    AUTH_FAILURE = "AUTH_FAILURE"
    EMERGENCY_ACCESS = "EMERGENCY_ACCESS"
    ADMIN_ACTION = "ADMIN_ACTION"
    SYSTEM_EVENT = "SYSTEM_EVENT"

class HIPAAAuditLogger:
    def __init__(self, log_store, integrity_key: bytes):
        self.log_store = log_store
        self.integrity_key = integrity_key
        self._previous_hash = None

    async def log(
        self,
        event_type: AuditEventType,
        user_id: str,
        resource: str,
        action: str,
        outcome: str,
        patient_id: str | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
    ):
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event_type": event_type.value,
            "user_id": user_id,
            "resource": resource,
            "action": action,
            "outcome": outcome,
            "patient_id": patient_id,
            "ip_address": ip_address,
            "details": details or {},
        }

        # Chain hash for integrity verification
        entry_bytes = json.dumps(entry, sort_keys=True).encode()
        chain_data = (self._previous_hash or b"GENESIS") + entry_bytes
        entry["integrity_hash"] = hashlib.blake2b(
            chain_data, key=self.integrity_key, digest_size=32
        ).hexdigest()
        self._previous_hash = entry["integrity_hash"].encode()

        # Write to append-only storage
        await self.log_store.append(entry)

        # Real-time alerting for critical events
        if event_type in (AuditEventType.EMERGENCY_ACCESS, AuditEventType.PHI_EXPORT):
            await self.alert_security_team(entry)

    async def alert_security_team(self, entry: dict):
        """Immediate notification for high-risk events."""
        await self.alerting.send(
            channel="security-alerts",
            message=f"HIPAA Alert: {entry['event_type']} by {entry['user_id']} on {entry['resource']}",
            severity="high",
        )
```

### 5.3 Integrity Controls (Addressable - 164.312(c)(1))

- Implement mechanisms to protect ePHI from improper alteration or destruction.
- Use checksums or digital signatures to verify data integrity.
- Implement database constraints and validation rules.
- Maintain version history for clinical data.

```python
class PHIIntegrityManager:
    """Protect ePHI from unauthorized modification."""

    def compute_integrity_hash(self, record: dict) -> str:
        """Compute a hash for integrity verification."""
        canonical = json.dumps(record, sort_keys=True, default=str)
        return hashlib.sha256(canonical.encode()).hexdigest()

    async def save_with_integrity(self, record_id: str, data: dict) -> None:
        """Save ePHI with an integrity hash and version."""
        integrity_hash = self.compute_integrity_hash(data)
        version = await self.version_store.get_next_version(record_id)

        await self.store.save({
            "record_id": record_id,
            "data": data,
            "integrity_hash": integrity_hash,
            "version": version,
            "modified_by": self.current_user_id,
            "modified_at": datetime.utcnow().isoformat(),
        })

        # Keep version history
        await self.version_store.save_version(record_id, version, data, integrity_hash)

    async def verify_integrity(self, record_id: str) -> bool:
        """Verify that stored ePHI has not been tampered with."""
        stored = await self.store.get(record_id)
        computed_hash = self.compute_integrity_hash(stored["data"])
        return computed_hash == stored["integrity_hash"]
```

### 5.4 Transmission Security (Required - 164.312(e)(1))

```yaml
transmission_security:
  encryption_in_transit:
    status: "Addressable"
    requirements:
      - "TLS 1.2 minimum for all ePHI transmissions"
      - "TLS 1.3 preferred"
      - "Strong cipher suites only"
      - "Certificate validation enforced"
      - "No fallback to unencrypted connections"
      - "HSTS headers on web applications"

  integrity_controls:
    status: "Addressable"
    requirements:
      - "Message authentication codes (HMAC) for API communications"
      - "Digital signatures for critical transmissions"
      - "Checksums for file transfers"

  vpn_requirements:
    - "Site-to-site VPN for facility connections"
    - "Client VPN for remote access to ePHI systems"
    - "Split tunneling prohibited for ePHI access"
```

```nginx
# Nginx configuration for HIPAA-compliant TLS
server {
    listen 443 ssl http2;
    server_name ehr.example.com;

    ssl_certificate     /etc/ssl/certs/ehr.example.com.pem;
    ssl_certificate_key /etc/ssl/private/ehr.example.com.key;

    # TLS 1.2+ only
    ssl_protocols TLSv1.2 TLSv1.3;

    # Strong cipher suites
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305';
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Prevent information leakage
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    server_tokens off;
}
```

---

## 6. Security Rule: Administrative Safeguards

### 6.1 Security Management Process (Required - 164.308(a)(1))

```yaml
administrative_safeguards:
  risk_analysis:
    status: "Required"
    frequency: "Annual minimum, plus after significant changes"
    scope: "All ePHI, all systems, all locations"
    activities:
      - "Identify all systems that create, receive, maintain, or transmit ePHI"
      - "Identify threats and vulnerabilities"
      - "Assess current security measures"
      - "Determine the likelihood and impact of threats"
      - "Assign risk levels"
      - "Document findings and remediation plans"

  risk_management:
    status: "Required"
    activities:
      - "Implement security measures to reduce risks to reasonable levels"
      - "Prioritize based on risk analysis findings"
      - "Track remediation progress"

  sanction_policy:
    status: "Required"
    description: "Sanctions for workforce members who violate policies"

  information_system_activity_review:
    status: "Required"
    activities:
      - "Regular review of audit logs"
      - "Automated anomaly detection"
      - "Reports on system activity involving ePHI"
```

### 6.2 Workforce Security (Required - 164.308(a)(3))

- Authorization and supervision of workforce access to ePHI.
- Workforce clearance procedures.
- Termination procedures (immediate access revocation upon departure).

### 6.3 Information Access Management (Required - 164.308(a)(4))

- Access authorization policies and procedures.
- Access establishment and modification procedures.
- Periodic access reviews (minimum quarterly).

### 6.4 Security Awareness and Training (Required - 164.308(a)(5))

- Security reminders for all workforce members.
- Protection from malicious software training.
- Login monitoring procedures.
- Password management training.

### 6.5 Security Incident Procedures (Required - 164.308(a)(6))

```python
class HIPAAIncidentResponse:
    """HIPAA security incident response procedures."""

    async def handle_incident(self, incident: SecurityIncident) -> IncidentReport:
        # Phase 1: Identification and containment
        report = IncidentReport(
            incident_id=generate_id(),
            detected_at=datetime.utcnow(),
            reported_by=incident.reporter,
            description=incident.description,
        )

        # Phase 2: Assess scope
        report.phi_involved = await self.assess_phi_involvement(incident)
        report.affected_individuals = await self.identify_affected(incident)
        report.systems_affected = await self.identify_systems(incident)

        # Phase 3: Containment
        await self.contain_incident(incident, report)

        # Phase 4: Determine if breach occurred
        report.is_breach = self.determine_breach(report)

        if report.is_breach:
            # Phase 5: Breach notification
            await self.initiate_breach_notification(report)

        # Phase 6: Remediation
        report.remediation_plan = await self.create_remediation_plan(report)

        # Phase 7: Documentation (retain for 6 years)
        await self.document_incident(report)

        return report

    def determine_breach(self, report: IncidentReport) -> bool:
        """
        A breach is the acquisition, access, use, or disclosure of unsecured PHI
        in a manner not permitted, unless one of three exceptions applies.
        """
        if not report.phi_involved:
            return False

        # Exception 1: Unintentional access by authorized workforce in good faith
        # Exception 2: Inadvertent disclosure to another authorized person at same entity
        # Exception 3: Unauthorized person unable to retain the information
        # If no exception applies, presume it is a breach unless low probability of compromise
        return True  # Simplified; real implementation requires risk assessment
```

### 6.6 Contingency Plan (Required - 164.308(a)(7))

```yaml
contingency_plan:
  data_backup:
    status: "Required"
    requirements:
      - "Regular backup of ePHI"
      - "Encrypted backup storage"
      - "Off-site backup storage"
      - "Backup integrity verification"
      - "Regular restore testing"

  disaster_recovery:
    status: "Required"
    requirements:
      - "Documented recovery procedures"
      - "Recovery time objectives (RTO)"
      - "Recovery point objectives (RPO)"
      - "Annual disaster recovery testing"

  emergency_mode_operations:
    status: "Required"
    description: "Procedures for operating during emergencies while protecting ePHI"

  testing_and_revision:
    status: "Addressable"
    requirements:
      - "Regular testing of contingency plans"
      - "Revision based on test results"
      - "Documentation of tests and outcomes"

  applications_and_data_criticality:
    status: "Addressable"
    description: "Assessment of relative criticality of applications and data"
```

---

## 7. Security Rule: Physical Safeguards

### Physical Safeguard Requirements (164.310)

```yaml
physical_safeguards:
  facility_access_controls:
    status: "Required"
    requirements:
      - "Contingency operations: physical access during emergencies"
      - "Facility security plan: safeguard the facility"
      - "Access control and validation: control physical access"
      - "Maintenance records: document repairs/modifications"

  workstation_use:
    status: "Required"
    requirements:
      - "Policies specifying proper workstation use"
      - "Physical location considerations (screen visibility)"
      - "Functions performed at workstations"

  workstation_security:
    status: "Required"
    requirements:
      - "Physical safeguards to restrict access to workstations"
      - "Locked rooms or areas"
      - "Cable locks for portable devices"

  device_and_media_controls:
    status: "Required"
    requirements:
      - "Disposal: policies for final disposition of ePHI and hardware"
      - "Media reuse: remove ePHI before reuse"
      - "Accountability: records of hardware/media movements (addressable)"
      - "Data backup and storage: backup before moving equipment (addressable)"
```

---

## 8. Breach Notification Rule

### Breach Definition

An impermissible use or disclosure of PHI that compromises the security or privacy of the PHI. Presume a breach occurred unless the covered entity or business associate demonstrates a low probability that the PHI was compromised.

### Risk Assessment Factors

1. The nature and extent of the PHI involved (types of identifiers, likelihood of re-identification).
2. The unauthorized person who used the PHI or to whom the disclosure was made.
3. Whether the PHI was actually acquired or viewed.
4. The extent to which the risk to the PHI has been mitigated.

### Notification Requirements

```yaml
breach_notification_requirements:
  individual_notification:
    timeline: "Without unreasonable delay, no later than 60 calendar days from discovery"
    method: "Written notice by first-class mail or email (if agreed upon)"
    content:
      - "Description of the breach"
      - "Types of information involved"
      - "Steps individuals should take to protect themselves"
      - "Description of what the entity is doing to investigate and mitigate"
      - "Contact information for questions"

  hhs_notification:
    breaches_affecting_500_or_more:
      timeline: "Without unreasonable delay, no later than 60 days"
      method: "HHS breach reporting portal"
      note: "HHS will post on public breach portal (Wall of Shame)"

    breaches_affecting_fewer_than_500:
      timeline: "Within 60 days of the end of the calendar year in which discovered"
      method: "Annual log to HHS"

  media_notification:
    condition: "Breach affects more than 500 residents of a single state/jurisdiction"
    timeline: "Without unreasonable delay, no later than 60 days"
    method: "Prominent media outlets in the state/jurisdiction"
```

### Exceptions to Breach Definition

```yaml
breach_exceptions:
  exception_1:
    description: "Unintentional acquisition, access, or use by workforce member acting in good faith"
    conditions:
      - "Within the scope of authority"
      - "Does not result in further impermissible use or disclosure"

  exception_2:
    description: "Inadvertent disclosure between authorized persons"
    conditions:
      - "Both persons are authorized to access PHI at the same covered entity or business associate"
      - "Information not further used or disclosed impermissibly"

  exception_3:
    description: "Good faith belief that unauthorized person could not retain information"
    example: "Fax sent to wrong number, recipient confirms deletion"
```

---

## 9. Business Associate Agreements (BAA)

### When a BAA is Required

A BAA is required whenever a business associate creates, receives, maintains, or transmits PHI on behalf of a covered entity.

### Required BAA Provisions

```yaml
baa_required_provisions:
  - "Establish permitted and required uses and disclosures of PHI"
  - "Not use or further disclose PHI other than as permitted by the agreement"
  - "Use appropriate safeguards to prevent impermissible use or disclosure"
  - "Report to the covered entity any use or disclosure not provided for"
  - "Ensure any subcontractors agree to the same restrictions"
  - "Make PHI available to individuals for access requests"
  - "Make PHI available for amendment requests"
  - "Provide accounting of disclosures"
  - "Make internal practices available to HHS for compliance determination"
  - "Return or destroy all PHI at termination (if feasible)"
  - "Report breaches of unsecured PHI"
```

### BAA Management for Engineering Teams

```typescript
interface BusinessAssociateAgreement {
  baaId: string;
  vendorName: string;
  vendorContact: string;
  servicesProvided: string;
  phiAccessed: string[];
  executionDate: string;
  reviewDate: string;
  terminationProvisions: string;
  subcontractorProvisions: boolean;
  breachNotificationProvisions: boolean;
  dataReturnDestructionProvisions: boolean;
  status: 'active' | 'pending_review' | 'expired' | 'terminated';
}

// Before integrating any third-party service that may access ePHI
async function validateVendorCompliance(vendorName: string): Promise<boolean> {
  const baa = await baaRegistry.find(vendorName);

  if (!baa || baa.status !== 'active') {
    throw new ComplianceError(
      `No active BAA found for ${vendorName}. ` +
      'A BAA must be executed before any ePHI can be shared with this vendor.'
    );
  }

  if (new Date(baa.reviewDate) < new Date()) {
    await alerting.notify('BAA_REVIEW_DUE', {
      vendor: vendorName,
      reviewDate: baa.reviewDate,
    });
  }

  return true;
}
```

---

## 10. Minimum Necessary Standard

The Privacy Rule requires covered entities to make reasonable efforts to limit the use, disclosure, and request of PHI to the minimum necessary to accomplish the intended purpose.

### Application

```yaml
minimum_necessary:
  applies_to:
    - "Uses of PHI within the organization"
    - "Disclosures to other covered entities or business associates"
    - "Requests for PHI from other covered entities"

  does_not_apply_to:
    - "Disclosures to or requests by a healthcare provider for treatment"
    - "Disclosures to the individual who is the subject of the information"
    - "Uses or disclosures authorized by the individual"
    - "Uses or disclosures required by law"
    - "Uses or disclosures required for HIPAA compliance"

  implementation:
    role_based_access:
      description: "Define access based on role, not on request"
      example: "Billing staff can see diagnosis codes and charges but not clinical notes"

    api_design:
      description: "APIs should return only the fields needed for the operation"
      example: "A scheduling API returns name and appointment time but not diagnosis"

    query_restrictions:
      description: "Database queries should select only necessary columns"
      example: "SELECT patient_name, appointment_date FROM appointments (not SELECT *)"
```

```python
# Implementing minimum necessary in API design
from enum import Enum

class AccessContext(Enum):
    TREATMENT = "treatment"
    PAYMENT = "payment"
    OPERATIONS = "operations"
    SCHEDULING = "scheduling"
    BILLING = "billing"

# Define field access per context
CONTEXT_FIELDS = {
    AccessContext.TREATMENT: [
        "patient_id", "name", "dob", "medical_history",
        "current_medications", "allergies", "diagnoses", "lab_results",
    ],
    AccessContext.SCHEDULING: [
        "patient_id", "name", "phone", "email",
        "preferred_provider", "appointment_type",
    ],
    AccessContext.BILLING: [
        "patient_id", "name", "insurance_id",
        "diagnosis_codes", "procedure_codes", "charges",
    ],
}

def get_patient_data(patient_id: str, context: AccessContext) -> dict:
    """Return only the fields necessary for the given context."""
    allowed_fields = CONTEXT_FIELDS.get(context, [])
    full_record = patient_repository.get(patient_id)

    filtered = {
        field: full_record[field]
        for field in allowed_fields
        if field in full_record
    }

    audit_logger.log(
        event_type=AuditEventType.PHI_ACCESS,
        user_id=current_user.id,
        resource=f"patient/{patient_id}",
        action="read",
        outcome="success",
        patient_id=patient_id,
        details={"context": context.value, "fields_returned": list(filtered.keys())},
    )

    return filtered
```

---

## 11. De-identification Methods

### Safe Harbor Method (45 CFR 164.514(b)(2))

Remove all 18 identifiers and ensure the covered entity has no actual knowledge that the remaining information could identify an individual.

```python
class SafeHarborDeIdentifier:
    """De-identify PHI using the HIPAA Safe Harbor method."""

    IDENTIFIERS_TO_REMOVE = [
        "name", "address", "city", "state", "zip_code",
        "dates",  # All dates except year for ages < 90
        "phone", "fax", "email",
        "ssn", "medical_record_number", "health_plan_id",
        "account_number", "certificate_license_number",
        "vehicle_identifiers", "device_identifiers",
        "web_urls", "ip_address",
        "biometric_ids", "photos",
        "any_unique_identifier",
    ]

    def de_identify(self, record: dict) -> dict:
        """Remove all 18 HIPAA identifiers from a record."""
        result = {}

        for key, value in record.items():
            if key in self.IDENTIFIERS_TO_REMOVE:
                continue  # Remove the identifier entirely

            if key == "date_of_birth":
                # Convert to age; if >= 90, aggregate to "90+"
                result["age_group"] = self._age_to_group(value)
                continue

            if key == "zip_code" and value:
                # Only first 3 digits if population > 20,000; otherwise set to "000"
                result["zip_3"] = self._truncate_zip(value)
                continue

            result[key] = value

        return result

    def _age_to_group(self, dob: str) -> str:
        from datetime import date
        birth = date.fromisoformat(dob)
        age = (date.today() - birth).days // 365
        if age >= 90:
            return "90+"
        return str(age)

    def _truncate_zip(self, zip_code: str) -> str:
        prefix = zip_code[:3]
        # List of 3-digit ZIP prefixes with population < 20,000
        small_population_prefixes = {"036", "059", "063", "102", "203", "556", "692", "790", "821", "823", "830", "831", "878", "879", "884", "890", "893"}
        if prefix in small_population_prefixes:
            return "000"
        return prefix
```

### Expert Determination Method (45 CFR 164.514(b)(1))

A qualified statistical or scientific expert determines that the risk of identifying an individual is very small. The expert must apply statistical and scientific principles and methods to make this determination.

---

## 12. HIPAA-Eligible Cloud Services

### AWS

```yaml
aws_hipaa:
  baa: "Available for AWS customers"
  eligible_services:
    - "Amazon EC2"
    - "Amazon S3"
    - "Amazon RDS"
    - "Amazon DynamoDB"
    - "AWS Lambda"
    - "Amazon ECS / EKS"
    - "Amazon CloudWatch"
    - "AWS CloudTrail"
    - "AWS KMS"
    - "Amazon SQS"
    - "Amazon SNS"
    - "AWS Secrets Manager"
    - "Amazon API Gateway"
    - "AWS WAF"
    # See full list at: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/

  requirements:
    - "Sign AWS BAA before processing ePHI"
    - "Use only HIPAA-eligible services for ePHI"
    - "Enable encryption at rest on all services"
    - "Enable encryption in transit"
    - "Enable CloudTrail for audit logging"
    - "Restrict access using IAM policies"
    - "Do NOT use non-eligible services with ePHI"
```

### Google Cloud Platform (GCP)

```yaml
gcp_hipaa:
  baa: "Available as amendment to GCP agreement"
  eligible_services:
    - "Compute Engine"
    - "Cloud Storage"
    - "Cloud SQL"
    - "Cloud Firestore"
    - "Cloud Functions"
    - "Google Kubernetes Engine (GKE)"
    - "Cloud Logging"
    - "Cloud Monitoring"
    - "Cloud KMS"
    - "Cloud Pub/Sub"
    # See full list at: https://cloud.google.com/security/compliance/hipaa

  requirements:
    - "Accept BAA amendment"
    - "Use only covered services"
    - "Configure encryption and access controls"
```

### Microsoft Azure

```yaml
azure_hipaa:
  baa: "Included in Microsoft Online Services Terms"
  eligible_services:
    - "Azure Virtual Machines"
    - "Azure Blob Storage"
    - "Azure SQL Database"
    - "Azure Cosmos DB"
    - "Azure Functions"
    - "Azure Kubernetes Service (AKS)"
    - "Azure Monitor"
    - "Azure Key Vault"
    - "Azure Active Directory"
    - "Azure API Management"
    # See full list at: https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-hipaa-us

  requirements:
    - "BAA is included in Online Services Terms"
    - "Use only in-scope services"
    - "Enable encryption and access controls"
    - "Configure Azure Security Center"
```

---

## 13. Logging and Audit Requirements

### What Must Be Logged

```yaml
hipaa_logging_requirements:
  user_activity:
    - "Login and logout events"
    - "Failed authentication attempts"
    - "Password changes"
    - "Permission changes"
    - "Account creation and deletion"

  phi_access:
    - "All read access to ePHI"
    - "All write/update operations on ePHI"
    - "All delete operations on ePHI"
    - "Data exports and downloads"
    - "Print operations"
    - "Disclosures to third parties"

  system_events:
    - "System startup and shutdown"
    - "Configuration changes"
    - "Software installation and updates"
    - "Backup operations"
    - "Security alerts"

  log_retention:
    period: "Minimum 6 years"
    note: "HIPAA requires policies and documentation to be retained for 6 years; apply same to audit logs"

  log_review:
    automated: "Daily automated anomaly detection"
    manual: "Weekly review by security team"
    comprehensive: "Quarterly full audit review"
```

### Log Architecture for HIPAA Systems

```yaml
# HIPAA-compliant logging architecture
logging_architecture:
  application_layer:
    tool: "Structured JSON logging"
    destination: "Central log aggregator"
    content: "Application events, ePHI access, errors"

  infrastructure_layer:
    tool: "CloudTrail / Cloud Audit Logs / Azure Monitor"
    destination: "Immutable storage (S3 with Object Lock / Cloud Storage with retention)"
    content: "API calls, infrastructure changes, authentication"

  database_layer:
    tool: "Database audit logging (RDS audit, Cloud SQL audit)"
    destination: "Separate audit database or log storage"
    content: "Queries against ePHI tables, schema changes, admin actions"

  network_layer:
    tool: "VPC Flow Logs / Network Watcher"
    destination: "SIEM system"
    content: "Network traffic patterns, connection attempts"

  aggregation:
    tool: "SIEM (Splunk, Elastic SIEM, Azure Sentinel, AWS Security Lake)"
    features:
      - "Correlation across log sources"
      - "Automated alerting on anomalies"
      - "Dashboard for security team review"
      - "Retention management"
```

---

## 14. Code Examples

### ePHI Data Access Layer

```typescript
// Secure ePHI data access layer
class EPHIRepository {
  private db: Database;
  private auditLogger: HIPAAAuditLogger;
  private encryption: FieldEncryption;

  constructor(db: Database, auditLogger: HIPAAAuditLogger, encryption: FieldEncryption) {
    this.db = db;
    this.auditLogger = auditLogger;
    this.encryption = encryption;
  }

  async getPatientRecord(
    patientId: string,
    requestingUserId: string,
    context: AccessContext,
  ): Promise<PatientRecord | null> {
    // 1. Verify authorization
    const authorized = await this.checkAuthorization(requestingUserId, patientId, context);
    if (!authorized) {
      await this.auditLogger.log({
        eventType: 'PHI_ACCESS',
        userId: requestingUserId,
        resource: `patient/${patientId}`,
        action: 'read',
        outcome: 'denied',
        patientId,
        details: { context: context, reason: 'unauthorized' },
      });
      throw new UnauthorizedAccessError('Access denied to patient record');
    }

    // 2. Retrieve data with minimum necessary fields
    const allowedFields = getFieldsForContext(context);
    const record = await this.db.query(
      `SELECT ${allowedFields.join(', ')} FROM patients WHERE patient_id = $1`,
      [patientId],
    );

    if (!record) return null;

    // 3. Decrypt sensitive fields
    const decrypted = this.encryption.decryptFields(record, ['ssn', 'diagnosis', 'notes']);

    // 4. Log the access
    await this.auditLogger.log({
      eventType: 'PHI_ACCESS',
      userId: requestingUserId,
      resource: `patient/${patientId}`,
      action: 'read',
      outcome: 'success',
      patientId,
      details: { context: context, fieldsReturned: allowedFields },
    });

    return decrypted;
  }

  async updatePatientRecord(
    patientId: string,
    requestingUserId: string,
    updates: Partial<PatientRecord>,
  ): Promise<void> {
    // 1. Verify authorization
    const authorized = await this.checkAuthorization(requestingUserId, patientId, 'treatment');
    if (!authorized) {
      await this.auditLogger.log({
        eventType: 'PHI_UPDATE',
        userId: requestingUserId,
        resource: `patient/${patientId}`,
        action: 'update',
        outcome: 'denied',
        patientId,
      });
      throw new UnauthorizedAccessError('Update access denied');
    }

    // 2. Save current version for audit trail
    const currentRecord = await this.db.query(
      'SELECT * FROM patients WHERE patient_id = $1',
      [patientId],
    );
    await this.db.query(
      'INSERT INTO patient_versions (patient_id, data, version, modified_by, modified_at) VALUES ($1, $2, $3, $4, NOW())',
      [patientId, JSON.stringify(currentRecord), await this.getNextVersion(patientId), requestingUserId],
    );

    // 3. Encrypt sensitive fields before storage
    const encrypted = this.encryption.encryptFields(updates, ['ssn', 'diagnosis', 'notes']);

    // 4. Update record
    await this.db.update('patients', patientId, encrypted);

    // 5. Compute and store integrity hash
    const updatedRecord = await this.db.query('SELECT * FROM patients WHERE patient_id = $1', [patientId]);
    const integrityHash = computeHash(updatedRecord);
    await this.db.query('UPDATE patients SET integrity_hash = $1 WHERE patient_id = $2', [integrityHash, patientId]);

    // 6. Log the update
    await this.auditLogger.log({
      eventType: 'PHI_UPDATE',
      userId: requestingUserId,
      resource: `patient/${patientId}`,
      action: 'update',
      outcome: 'success',
      patientId,
      details: { fieldsUpdated: Object.keys(updates) },
    });
  }
}
```

### Session Management with Auto-Logoff

```python
import time
from functools import wraps

class HIPAASessionManager:
    """Session management with automatic logoff per HIPAA requirements."""

    TIMEOUT_SECONDS = 900  # 15 minutes

    def __init__(self, session_store, audit_logger):
        self.session_store = session_store
        self.audit_logger = audit_logger

    async def create_session(self, user_id: str, ip_address: str) -> str:
        session_id = generate_secure_token()
        await self.session_store.create({
            "session_id": session_id,
            "user_id": user_id,
            "created_at": time.time(),
            "last_activity": time.time(),
            "ip_address": ip_address,
        })
        return session_id

    async def validate_session(self, session_id: str) -> dict | None:
        session = await self.session_store.get(session_id)
        if not session:
            return None

        # Check for timeout
        elapsed = time.time() - session["last_activity"]
        if elapsed > self.TIMEOUT_SECONDS:
            await self.terminate_session(session_id, reason="auto_logoff")
            return None

        # Update last activity
        session["last_activity"] = time.time()
        await self.session_store.update(session)
        return session

    async def terminate_session(self, session_id: str, reason: str = "user_logout"):
        session = await self.session_store.get(session_id)
        if session:
            await self.audit_logger.log(
                event_type="SESSION_TERMINATED",
                user_id=session["user_id"],
                resource=f"session/{session_id}",
                action="terminate",
                outcome="success",
                details={"reason": reason},
            )
            await self.session_store.delete(session_id)
```

---

## 15. Best Practices

1. **Conduct a thorough risk analysis before building any system that handles ePHI.** Document all threats, vulnerabilities, and current safeguards. Update the risk analysis annually and after any significant system changes.

2. **Sign a BAA with every third-party vendor before sharing any ePHI.** Maintain a registry of all business associates and their BAA status. Verify that vendors only use HIPAA-eligible services and configurations.

3. **Implement the minimum necessary standard at every layer.** Design APIs to return only the fields needed for the specific use case. Use role-based access control to restrict data visibility based on job function.

4. **Encrypt ePHI at rest and in transit without exception.** Use AES-256 for data at rest and TLS 1.2+ for data in transit. Manage encryption keys through a dedicated key management service (AWS KMS, Azure Key Vault, GCP KMS).

5. **Implement comprehensive audit logging for all ePHI access.** Log every read, write, update, and delete operation on ePHI. Use append-only storage with integrity verification. Retain audit logs for a minimum of 6 years.

6. **Enforce automatic session timeout for all systems accessing ePHI.** Set session timeouts to 15 minutes of inactivity or less. Implement server-side session invalidation (do not rely on client-side timers alone).

7. **Use de-identification for analytics, research, and development.** Apply Safe Harbor or Expert Determination methods. Never use real ePHI in development, testing, or staging environments.

8. **Build emergency access (break-glass) procedures with enhanced monitoring.** Allow time-limited emergency access when patient safety requires it. Trigger immediate alerts and mandatory post-access review within 24 hours.

9. **Implement and test contingency plans regularly.** Maintain documented backup, disaster recovery, and emergency mode operation procedures. Test backup restoration and disaster recovery at least annually.

10. **Train all workforce members on HIPAA requirements and security awareness.** Provide role-specific training for developers, support staff, and administrators. Document training completion and refresh at least annually.

---

## 16. Anti-Patterns

1. **Using non-HIPAA-eligible cloud services for ePHI.** Storing ePHI in services not covered by the cloud provider's BAA creates compliance violations. Always verify service eligibility before use.

2. **Shared accounts for systems containing ePHI.** HIPAA requires unique user identification. Shared accounts make it impossible to attribute actions to specific individuals and violate audit requirements.

3. **Logging ePHI in application logs or error messages.** Stack traces, debug logs, and error messages must not contain patient names, SSNs, diagnoses, or other PHI. Sanitize all log output.

4. **Sending ePHI via unencrypted email or messaging.** Standard email and chat platforms are generally not HIPAA-compliant. Use encrypted communication channels with BAAs in place.

5. **Using SELECT * queries against tables containing ePHI.** This violates the minimum necessary standard. Always select only the fields required for the specific use case.

6. **Failing to revoke access immediately when workforce members leave.** HIPAA requires termination procedures that include immediate access revocation. Delayed deprovisioning creates unauthorized access risk.

7. **Storing encryption keys alongside the encrypted ePHI.** Keys must be managed separately from the data they protect. Use dedicated key management services, not application configuration files.

8. **Relying solely on perimeter security without internal controls.** HIPAA requires layered security. Internal network segmentation, application-level access controls, and monitoring are essential even behind a firewall.

---

## 17. Enforcement Checklist

### Risk Management
- [ ] A comprehensive risk analysis has been completed and documented.
- [ ] Risk analysis is updated annually and after significant system changes.
- [ ] Risk mitigation plans are documented with timelines and ownership.
- [ ] A risk register tracks all identified risks and remediation status.

### Access Control
- [ ] All users have unique identification credentials.
- [ ] Role-based access control limits ePHI access based on job function.
- [ ] Multi-factor authentication is required for all ePHI access.
- [ ] Automatic session timeout is set to 15 minutes or less.
- [ ] Emergency access (break-glass) procedures are documented and tested.
- [ ] Access reviews are conducted at least quarterly.
- [ ] Access is revoked immediately upon workforce termination.

### Encryption
- [ ] All ePHI is encrypted at rest using AES-256 or equivalent.
- [ ] All ePHI transmissions use TLS 1.2 or higher.
- [ ] Encryption keys are managed through a dedicated KMS.
- [ ] Key rotation is performed at least annually.
- [ ] Portable devices and media containing ePHI are encrypted.

### Audit Logging
- [ ] All access to ePHI is logged (read, write, update, delete).
- [ ] All authentication events are logged (success and failure).
- [ ] Audit logs include timestamp, user ID, action, resource, and outcome.
- [ ] Audit logs are stored in append-only, tamper-evident storage.
- [ ] Audit logs are retained for a minimum of 6 years.
- [ ] Automated anomaly detection reviews logs daily.
- [ ] Weekly manual review of audit logs is performed.

### Business Associates
- [ ] A BAA is executed with every business associate before ePHI sharing.
- [ ] A registry of all business associates and BAA status is maintained.
- [ ] BAAs are reviewed annually.
- [ ] Subcontractor compliance is verified.

### Breach Response
- [ ] A documented breach response plan exists.
- [ ] The plan specifies the 60-day notification timeline.
- [ ] The plan includes procedures for individual, HHS, and media notification.
- [ ] Breach response simulations are conducted annually.
- [ ] A breach log is maintained for all security incidents.

### Contingency Planning
- [ ] Backup procedures are documented and tested.
- [ ] Disaster recovery procedures are documented and tested annually.
- [ ] Recovery time and recovery point objectives are defined.
- [ ] Emergency mode operation procedures are documented.

### Training
- [ ] All workforce members receive HIPAA training upon hiring.
- [ ] Annual refresher training is provided and documented.
- [ ] Role-specific training is provided for developers and administrators.
- [ ] Security awareness reminders are distributed regularly.

### Minimum Necessary
- [ ] APIs return only fields required for the specific use case.
- [ ] Database queries select only necessary columns.
- [ ] Access roles restrict visibility based on job function.
- [ ] Data sharing agreements specify the minimum necessary scope.

### Environment Security
- [ ] Development and testing environments use de-identified or synthetic data.
- [ ] Production ePHI is never copied to non-production environments.
- [ ] Network segmentation isolates ePHI systems.
- [ ] Only HIPAA-eligible cloud services are used for ePHI.
