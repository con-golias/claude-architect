# PCI DSS v4.0 for Developers

> Comprehensive technical guide to the Payment Card Industry Data Security Standard version 4.0.
> Audience: Software engineers building payment processing systems, e-commerce platforms, and applications that handle cardholder data.
> Last updated: 2026-03-10

---

## Table of Contents

1. Overview and Scope
2. The 12 Requirements
3. Cardholder Data Environment (CDE) Scope
4. PAN Handling Rules
5. Requirement 3: Protect Stored Account Data
6. Requirement 4: Encrypt Transmission
7. Requirement 6: Secure Systems and Software
8. Requirement 8: Identify Users and Authenticate
9. Requirement 10: Log and Monitor
10. Requirement 11: Test Security
11. SAQ Types and Scope Reduction
12. Tokenization for Scope Reduction
13. Network Segmentation
14. New v4.0 Requirements
15. Code Examples
16. Best Practices
17. Anti-Patterns
18. Enforcement Checklist

---

## 1. Overview and Scope

The Payment Card Industry Data Security Standard (PCI DSS) is a global standard for protecting cardholder data. Version 4.0 was released in March 2022, with the transition deadline for all v3.2.1 requirements on March 31, 2024, and future-dated v4.0 requirements becoming mandatory on March 31, 2025.

### Who Must Comply

Any entity that stores, processes, or transmits cardholder data or sensitive authentication data, including:
- Merchants (online and brick-and-mortar).
- Payment processors and acquirers.
- Issuing banks.
- Service providers.
- Software vendors building payment applications.

### Cardholder Data Defined

```yaml
cardholder_data:
  primary_account_number: "PAN - The card number (required to protect)"
  cardholder_name: "Name on the card"
  expiration_date: "Card expiry"
  service_code: "3 or 4 digit value on the magnetic stripe"

sensitive_authentication_data:
  full_track_data: "Magnetic stripe or chip equivalent"
  card_verification_code: "CVV/CVC/CAV2/CID"
  pin_and_pin_block: "Personal Identification Number"
  note: "Sensitive authentication data must NEVER be stored after authorization"
```

### Compliance Levels (Merchants)

| Level | Annual Transactions | Requirements |
|-------|-------------------|--------------|
| 1 | Over 6 million | Annual on-site assessment by QSA, quarterly network scan |
| 2 | 1-6 million | Annual SAQ, quarterly network scan |
| 3 | 20,000-1 million (e-commerce) | Annual SAQ, quarterly network scan |
| 4 | Under 20,000 (e-commerce) or up to 1 million (other) | Annual SAQ, quarterly network scan (recommended) |

---

## 2. The 12 Requirements

PCI DSS v4.0 organizes requirements into six goals and twelve requirements.

```yaml
build_and_maintain_secure_network:
  requirement_1: "Install and maintain network security controls"
  requirement_2: "Apply secure configurations to all system components"

protect_account_data:
  requirement_3: "Protect stored account data"
  requirement_4: "Protect cardholder data with strong cryptography during transmission over open, public networks"

maintain_vulnerability_management_program:
  requirement_5: "Protect all systems and networks from malicious software"
  requirement_6: "Develop and maintain secure systems and software"

implement_strong_access_control:
  requirement_7: "Restrict access to system components and cardholder data by business need to know"
  requirement_8: "Identify users and authenticate access to system components"
  requirement_9: "Restrict physical access to cardholder data"

regularly_monitor_and_test:
  requirement_10: "Log and monitor all access to system components and cardholder data"
  requirement_11: "Test security of systems and networks regularly"

maintain_information_security_policy:
  requirement_12: "Support information security with organizational policies and programs"
```

---

## 3. Cardholder Data Environment (CDE) Scope

### What is the CDE

The CDE includes all people, processes, and technologies that store, process, or transmit cardholder data or sensitive authentication data, plus all connected systems.

### Scope Determination

```yaml
in_scope:
  - "Systems that store, process, or transmit cardholder data"
  - "Systems that connect to the CDE network segment"
  - "Systems that could impact the security of the CDE"
  - "Systems that provide security services to the CDE (DNS, NTP, authentication)"
  - "Systems that manage, administer, or support the CDE"
  - "Network devices connecting or segmenting the CDE"

out_of_scope:
  - "Systems completely isolated from the CDE"
  - "Systems that never store, process, or transmit cardholder data"
  - "Systems on a separate network segment with validated segmentation controls"

scope_reduction_strategies:
  tokenization: "Replace PAN with tokens; token systems may still be in scope"
  network_segmentation: "Isolate the CDE from the rest of the network"
  outsourcing: "Use PCI-compliant payment processors (Stripe, Braintree, Adyen)"
  point_to_point_encryption: "P2PE validated solutions reduce merchant scope"
```

### CDE Data Flow Diagram

Every organization must maintain a data flow diagram showing:
- All flows of cardholder data across systems and networks.
- Entry and exit points for cardholder data.
- All system components in the CDE.
- Connections between the CDE and out-of-scope networks.

---

## 4. PAN Handling Rules

The Primary Account Number (PAN) is the primary factor in determining the applicability of PCI DSS.

### Storage Rules

```yaml
pan_storage_rules:
  full_pan:
    allowed: "Only with strong cryptographic protection"
    methods:
      - "Strong one-way hash (SHA-256 with salt; original PAN not recoverable)"
      - "Truncation (first 6 and last 4 digits maximum; not recoverable)"
      - "Index tokens and pads (tokens stored separately from pads)"
      - "Strong cryptography with associated key management"

  display_rules:
    maximum_displayed: "First 6 and/or last 4 digits"
    note: "Business need must justify displaying even this much"
    example: "4111 11** **** 1111 (masked middle digits)"

  sensitive_authentication_data:
    full_track_data: "NEVER store after authorization"
    cvv_cvc: "NEVER store after authorization"
    pin_pin_block: "NEVER store after authorization"
    note: "No exception, even if encrypted"
```

```python
# PAN masking and validation
import re

class PANHandler:
    """Handle Primary Account Numbers per PCI DSS requirements."""

    @staticmethod
    def mask(pan: str) -> str:
        """Mask PAN to show only first 6 and last 4 digits."""
        digits = re.sub(r'\D', '', pan)
        if len(digits) < 13:
            raise ValueError("Invalid PAN length")
        first_six = digits[:6]
        last_four = digits[-4:]
        masked_middle = '*' * (len(digits) - 10)
        return f"{first_six}{masked_middle}{last_four}"

    @staticmethod
    def truncate(pan: str) -> str:
        """Truncate PAN for storage (irreversible)."""
        digits = re.sub(r'\D', '', pan)
        return f"{digits[:6]}{'X' * (len(digits) - 10)}{digits[-4:]}"

    @staticmethod
    def validate_luhn(pan: str) -> bool:
        """Validate PAN using the Luhn algorithm."""
        digits = [int(d) for d in re.sub(r'\D', '', pan)]
        checksum = 0
        for i, digit in enumerate(reversed(digits)):
            if i % 2 == 1:
                digit *= 2
                if digit > 9:
                    digit -= 9
            checksum += digit
        return checksum % 10 == 0

    @staticmethod
    def detect_in_text(text: str) -> list[str]:
        """Detect potential PANs in text (for DLP purposes)."""
        # Match 13-19 digit sequences that pass Luhn check
        pattern = r'\b\d{13,19}\b'
        candidates = re.findall(pattern, text)
        return [c for c in candidates if PANHandler.validate_luhn(c)]
```

---

## 5. Requirement 3: Protect Stored Account Data

### 3.1 Data Retention and Disposal

```yaml
requirement_3_1:
  description: "Processes and mechanisms for protecting stored account data"
  controls:
    retention_policy:
      - "Define a data retention and disposal policy"
      - "Limit storage amount and retention time to what is required"
      - "Specify retention requirements for each data type"
      - "Implement quarterly automated process to identify and securely delete data exceeding retention"

    disposal_methods:
      electronic:
        - "Cryptographic erasure (destroy encryption keys)"
        - "Secure overwrite (NIST SP 800-88 guidelines)"
        - "Degaussing"
        - "Physical destruction"
      paper:
        - "Cross-cut shredding"
        - "Incineration"
        - "Pulping"
```

### 3.2-3.4 Storage Protection Methods

```yaml
protection_methods:
  encryption:
    algorithm: "AES-256 or equivalent"
    key_management: "Separate from data; dual control; split knowledge"
    key_rotation: "Cryptoperiod defined; annual minimum"

  tokenization:
    description: "Replace PAN with a non-reversible token"
    token_vault: "Secured and PCI DSS compliant"
    token_format: "Format-preserving optional"

  truncation:
    max_displayed: "First 6 and last 4 digits (BIN + last 4)"
    note: "Truncated PAN and hashed PAN cannot coexist for the same card"

  hashing:
    algorithm: "SHA-256 minimum with unique, secret salt"
    note: "Hash is one-way; use only when PAN recovery is not needed"

  masking:
    purpose: "Display only; not a storage protection method"
    format: "First 6 and/or last 4; business need required"
```

### 3.5 PAN Encryption Key Management

```yaml
key_management_requirements:
  key_generation:
    - "Use strong cryptographic key generation methods"
    - "Generate within a secure cryptographic device (HSM)"

  key_distribution:
    - "Distribute keys securely (encrypted or split knowledge)"
    - "Never transmit keys in clear text"

  key_storage:
    - "Store in encrypted form or within a secure cryptographic device"
    - "Store key-encrypting keys separately from data-encrypting keys"
    - "Minimize number of locations where keys are stored"

  key_rotation:
    - "Define cryptoperiod for each key type"
    - "Rotate keys at the end of the cryptoperiod"
    - "Re-encrypt data when rotating data-encrypting keys"

  key_retirement_and_replacement:
    - "Retire or replace keys when integrity is weakened"
    - "Retire or replace keys when known or suspected compromise"
    - "Archived keys used only for decryption; not for new encryption"

  split_knowledge_and_dual_control:
    - "No single person has access to the entire key"
    - "Key operations require two or more people"

  key_custodians:
    - "Document key custodian responsibilities"
    - "Key custodians formally acknowledge responsibilities"
```

---

## 6. Requirement 4: Encrypt Transmission

### Transmission Security Requirements

```yaml
requirement_4:
  scope: "Cardholder data transmitted over open, public networks"
  open_public_networks:
    - "The Internet"
    - "Wireless technologies (Wi-Fi, Bluetooth, cellular)"
    - "Satellite communications"
    - "General Packet Radio Service (GPRS)"

  requirements:
    encryption_protocols:
      required: "TLS 1.2 or higher"
      prohibited:
        - "SSL (all versions)"
        - "TLS 1.0"
        - "TLS 1.1"
        - "Early TLS"
      recommended: "TLS 1.3"

    certificate_management:
      - "Use trusted certificates from recognized CAs"
      - "Verify certificate validity and trust chain"
      - "Monitor certificate expiration"

    cipher_suites:
      required: "Strong ciphers only"
      recommended:
        - "TLS_AES_256_GCM_SHA384"
        - "TLS_CHACHA20_POLY1305_SHA256"
        - "TLS_AES_128_GCM_SHA256"
      prohibited:
        - "NULL ciphers"
        - "DES"
        - "RC4"
        - "Export-grade ciphers"
```

```yaml
# TLS configuration for payment services
# Nginx example
server:
  ssl_protocols: "TLSv1.2 TLSv1.3"
  ssl_ciphers: "ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305"
  ssl_prefer_server_ciphers: "on"
  ssl_session_timeout: "1d"
  ssl_session_cache: "shared:SSL:10m"
  ssl_stapling: "on"
  ssl_stapling_verify: "on"
  add_header: "Strict-Transport-Security 'max-age=63072000; includeSubDomains; preload' always"
```

### Internal Network Encryption

```yaml
internal_encryption:
  v4_0_change: "v4.0 requires protecting cardholder data over internal networks too"
  recommendations:
    - "mTLS for service-to-service communication within the CDE"
    - "Encrypted database connections"
    - "Encrypted connections to logging and monitoring systems"
    - "VPN or private connectivity for administrative access"
```

---

## 7. Requirement 6: Secure Systems and Software

### 6.1-6.2 Secure Development Lifecycle

```yaml
secure_sdlc_requirements:
  requirement_6_2_1:
    description: "Bespoke and custom software developed securely"
    controls:
      - "Software development based on industry standards and best practices"
      - "Software security included in each phase of the SDLC"
      - "Software security reviewed at least annually and upon significant changes"

  requirement_6_2_2:
    description: "Developer training"
    controls:
      - "Developers trained in secure coding techniques at least annually"
      - "Training relevant to the technologies and languages in use"
      - "Training covers at least the OWASP Top 10 or equivalent"

  requirement_6_2_3:
    description: "Code review"
    controls:
      - "Bespoke and custom software reviewed prior to release"
      - "Review by individuals other than the originating code author"
      - "Review by individuals knowledgeable in secure coding"
      - "Code changes reviewed for both correctness and security"
      - "Corrections implemented before release"
      - "Code review results reviewed and approved by management"
```

### 6.3 Vulnerability Management

```yaml
requirement_6_3:
  vulnerability_identification:
    - "Identify and manage vulnerabilities in bespoke, custom, and third-party software"
    - "Maintain an inventory of bespoke and custom software and third-party components"
    - "Monitor vulnerability sources (CVE, vendor advisories, NVD)"

  patching:
    critical_and_high: "Install within one month of release"
    all_applicable: "Install in a timely manner per risk-based prioritization"

  software_composition:
    - "Maintain a Software Bill of Materials (SBOM)"
    - "Monitor third-party libraries for known vulnerabilities"
    - "Use dependency scanning tools (Snyk, Dependabot, Renovate)"
```

### 6.4 Public-Facing Web Application Protection

```yaml
requirement_6_4:
  web_application_protection:
    option_1: "Deploy a web application firewall (WAF) in front of public-facing web apps"
    option_2: "Perform application vulnerability assessment at least annually and after changes"

  waf_requirements:
    - "Actively running and up to date"
    - "Generates audit logs"
    - "Configured to block or alert on web-based attacks"

  v4_0_new_requirement_6_4_3:
    description: "Manage all payment page scripts"
    controls:
      - "Maintain an inventory of all scripts loaded on payment pages"
      - "Justify each script with business or technical need"
      - "Implement a method to verify script integrity (SRI hashes)"
      - "Authorize each script as explicitly allowed"
```

```html
<!-- Requirement 6.4.3: Payment page script integrity -->
<!-- Use Subresource Integrity (SRI) for all external scripts -->
<script
  src="https://js.stripe.com/v3/"
  integrity="sha384-ACTUAL_HASH_HERE"
  crossorigin="anonymous"
></script>

<!-- Content Security Policy to restrict script sources -->
<meta http-equiv="Content-Security-Policy"
  content="script-src 'self' https://js.stripe.com; frame-src https://js.stripe.com; style-src 'self';">
```

---

## 8. Requirement 8: Identify Users and Authenticate

### 8.1-8.3 User Identification and Authentication

```yaml
requirement_8:
  unique_identification:
    - "Assign a unique ID to each person with computer access"
    - "No shared, group, or generic accounts"
    - "Service accounts must be uniquely identifiable and assigned to a specific owner"

  multi_factor_authentication:
    requirement_8_4_2:
      description: "MFA for all access into the CDE"
      note: "New in v4.0: MFA required for all CDE access, not just remote"
      implementation:
        - "Something you know (password)"
        - "Something you have (token, smart card, authenticator app)"
        - "Something you are (biometric)"
      rules:
        - "At least two of the three factors"
        - "MFA factors must be independent"
        - "MFA cannot be bypassed"

    requirement_8_4_3:
      description: "MFA for all remote network access originating outside the entity's network"

  password_requirements:
    minimum_length: "12 characters (v4.0 increase from 7)"
    complexity: "Numeric and alphabetic characters"
    change_frequency: "Not required to change periodically (v4.0 change if MFA is used)"
    history: "Cannot reuse last 4 passwords"
    lockout: "Lock after no more than 10 failed attempts; lockout duration minimum 30 minutes or until admin reset"
    first_use: "Change on first use and after administrative reset"
    inactive_accounts: "Remove or disable after 90 days of inactivity"
```

```typescript
// PCI DSS v4.0 compliant password validation
interface PasswordPolicy {
  minLength: number;
  requireNumeric: boolean;
  requireAlphabetic: boolean;
  historyCount: number;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  inactiveDays: number;
}

const pciPasswordPolicy: PasswordPolicy = {
  minLength: 12,
  requireNumeric: true,
  requireAlphabetic: true,
  historyCount: 4,
  maxFailedAttempts: 10,
  lockoutMinutes: 30,
  inactiveDays: 90,
};

function validatePassword(password: string, policy: PasswordPolicy): ValidationResult {
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireNumeric && !/\d/.test(password)) {
    errors.push('Password must contain at least one numeric character');
  }
  if (policy.requireAlphabetic && !/[a-zA-Z]/.test(password)) {
    errors.push('Password must contain at least one alphabetic character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## 9. Requirement 10: Log and Monitor

### 10.1-10.7 Logging Requirements

```yaml
requirement_10:
  what_to_log:
    requirement_10_2:
      - "All individual user access to cardholder data"
      - "All actions taken by any individual with root or administrative privileges"
      - "Access to all audit trails"
      - "Invalid logical access attempts"
      - "Use of and changes to identification and authentication mechanisms"
      - "Initialization, stopping, or pausing of audit logs"
      - "Creation and deletion of system-level objects"
      - "Security events identified by the entity's targeted risk analysis"

  log_contents:
    requirement_10_3:
      - "User identification"
      - "Type of event"
      - "Date and time"
      - "Success or failure indication"
      - "Origination of event (terminal, IP address)"
      - "Identity or name of affected data, system component, resource, or service"

  time_synchronization:
    requirement_10_6:
      - "System clocks synchronized using NTP"
      - "Time server receives updates from accepted external time sources"
      - "If more than one NTP server, servers peer with each other"
      - "Restrict which systems can receive time data"

  log_retention:
    requirement_10_7:
      - "Retain audit trail history for at least 12 months"
      - "At least 3 months immediately available for analysis"

  log_review:
    requirement_10_4:
      - "Review logs at least daily"
      - "Automated mechanisms to detect anomalies and suspicious activity"
      - "Review security events identified by targeted risk analysis"
```

```python
# PCI DSS compliant logging implementation
import json
import time
from datetime import datetime

class PCIAuditLogger:
    """PCI DSS Requirement 10 compliant audit logger."""

    def log_event(
        self,
        user_id: str,
        event_type: str,
        success: bool,
        resource: str,
        source_ip: str,
        details: dict | None = None,
    ) -> dict:
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "user_id": user_id,
            "event_type": event_type,
            "success": success,
            "resource": resource,
            "source_ip": source_ip,
            "details": details or {},
        }

        # Write to tamper-evident storage
        self.append_to_log(entry)

        # Alert on failures and suspicious patterns
        if not success:
            self.check_alert_thresholds(user_id, event_type)

        return entry

    def log_cardholder_data_access(self, user_id: str, action: str, source_ip: str):
        """Requirement 10.2.1: Log all individual access to cardholder data."""
        self.log_event(
            user_id=user_id,
            event_type="CARDHOLDER_DATA_ACCESS",
            success=True,
            resource="cardholder_data",
            source_ip=source_ip,
            details={"action": action},
        )

    def log_admin_action(self, admin_id: str, action: str, target: str, source_ip: str):
        """Requirement 10.2.2: Log all actions by privileged users."""
        self.log_event(
            user_id=admin_id,
            event_type="ADMIN_ACTION",
            success=True,
            resource=target,
            source_ip=source_ip,
            details={"action": action},
        )

    def log_failed_access(self, user_id: str, resource: str, source_ip: str, reason: str):
        """Requirement 10.2.4: Log invalid logical access attempts."""
        self.log_event(
            user_id=user_id,
            event_type="ACCESS_DENIED",
            success=False,
            resource=resource,
            source_ip=source_ip,
            details={"reason": reason},
        )
```

---

## 10. Requirement 11: Test Security

### 11.3 Penetration Testing

```yaml
requirement_11_3:
  external_penetration_testing:
    frequency: "At least annually and after significant changes"
    scope: "All external-facing systems and applications"
    methodology: "Industry-accepted approach (NIST SP 800-115, OWASP, PTES)"
    findings: "All exploitable vulnerabilities must be corrected and re-tested"

  internal_penetration_testing:
    frequency: "At least annually and after significant changes"
    scope: "All systems in the CDE and connected systems"
    methodology: "Industry-accepted approach"
    findings: "All exploitable vulnerabilities must be corrected and re-tested"

  segmentation_testing:
    frequency: "At least every 6 months and after changes to segmentation controls"
    purpose: "Verify that segmentation methods are operational and effective"
    scope: "All segmentation controls isolating the CDE"

  v4_0_requirement_11_3_1_1:
    description: "Internal penetration testing based on the entity's methodology"
    note: "Must address all elements defined in the entity's penetration testing methodology"
```

### 11.4 Intrusion Detection/Prevention

```yaml
requirement_11_4:
  ids_ips:
    - "Detect and/or prevent intrusions into the network"
    - "Monitor all traffic at the perimeter and critical points of the CDE"
    - "Alert personnel to suspected compromises"
    - "Keep IDS/IPS engines up to date"
```

### 11.5 Change Detection

```yaml
requirement_11_5:
  file_integrity_monitoring:
    description: "Deploy change-detection mechanism (FIM) on critical files"
    scope:
      - "System files"
      - "Configuration files"
      - "Content files"
    frequency: "At least weekly comparison; real-time preferred"
    alerting: "Alert on unauthorized modification"
```

---

## 11. SAQ Types and Scope Reduction

### Self-Assessment Questionnaire Types

```yaml
saq_types:
  saq_a:
    description: "Card-not-present merchants, fully outsourced payment processing"
    eligibility:
      - "All payment processing fully outsourced to PCI DSS validated third party"
      - "No electronic storage, processing, or transmission of cardholder data"
      - "Only payment page links or iframes from the third-party processor"
    scope: "Minimal - approximately 22 requirements"
    use_case: "Merchant using Stripe Checkout hosted page, PayPal hosted buttons"

  saq_a_ep:
    description: "E-commerce merchants that partially outsource payment processing"
    eligibility:
      - "E-commerce merchant with a website that redirects to a third party for payment"
      - "Merchant's website controls the payment page experience but does not receive cardholder data"
      - "All elements of payment pages originate from PCI DSS compliant service provider"
    scope: "Moderate - approximately 139 requirements"
    use_case: "Merchant using Stripe Elements (JavaScript on merchant page)"

  saq_b:
    description: "Merchants with imprint machines or standalone dial-out terminals"
    eligibility:
      - "Only imprint machines or standalone dial-out terminals"
      - "No electronic cardholder data storage"

  saq_c_vt:
    description: "Merchants with web-based virtual terminals"

  saq_c:
    description: "Merchants with payment application systems connected to the Internet"

  saq_d:
    description: "All other merchants and all service providers"
    scope: "Full - all applicable PCI DSS requirements"
    note: "Default SAQ type; applies if no other SAQ type is eligible"

  saq_p2pe:
    description: "Merchants using PCI-listed P2PE solutions"
    scope: "Reduced"
```

---

## 12. Tokenization for Scope Reduction

### How Tokenization Works

```
 Customer -> Merchant Website -> Payment Processor -> Card Network
              (token only)       (PAN stored here)

 Payment flow:
 1. Customer enters card details on processor's hosted form
 2. Processor returns a token to the merchant
 3. Merchant stores the token (not the PAN)
 4. Merchant uses the token for subsequent charges
 5. The PAN never touches the merchant's systems
```

### Stripe Integration Example

```typescript
// Server-side: Create a Payment Intent (PAN never touches your server)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create a payment intent
async function createPaymentIntent(amount: number, currency: string): Promise<string> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,       // Amount in smallest currency unit (cents)
    currency,     // 'usd', 'eur', etc.
    automatic_payment_methods: { enabled: true },
  });

  // Return the client secret to the frontend
  // The PAN is never sent to or stored on your server
  return paymentIntent.client_secret!;
}

// Save a customer's card as a token for future use
async function saveCustomerCard(customerId: string, paymentMethodId: string): Promise<void> {
  // Attach the payment method (token) to the customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  // Store only the customer ID and payment method ID (both are tokens)
  await db.savePaymentMethod({
    customerId,
    paymentMethodId,       // This is a token, not a PAN
    last4: 'XXXX',         // Retrieved from Stripe, not from your system
    brand: 'visa',
  });
}

// Charge a saved card using only tokens
async function chargeCustomer(customerId: string, paymentMethodId: string, amount: number): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: true,
    off_session: true,       // Customer not present; using saved card
  });
}
```

```html
<!-- Client-side: Stripe Elements (card details go directly to Stripe) -->
<!DOCTYPE html>
<html>
<head>
  <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
  <form id="payment-form">
    <div id="card-element"></div>
    <button type="submit">Pay</button>
    <div id="error-message"></div>
  </form>

  <script>
    const stripe = Stripe('pk_live_YOUR_PUBLISHABLE_KEY');
    const elements = stripe.elements();
    const cardElement = elements.create('card');
    cardElement.mount('#card-element');

    const form = document.getElementById('payment-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      // Get client secret from your server
      const response = await fetch('/api/create-payment-intent', { method: 'POST' });
      const { clientSecret } = await response.json();

      // Card details are sent directly to Stripe, never to your server
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (result.error) {
        document.getElementById('error-message').textContent = result.error.message;
      } else {
        window.location.href = '/payment-success';
      }
    });
  </script>
</body>
</html>
```

### Braintree Integration Example

```typescript
// Server-side: Braintree token-based payment
import braintree from 'braintree';

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Production,
  merchantId: process.env.BRAINTREE_MERCHANT_ID!,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY!,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY!,
});

// Generate a client token for the frontend
async function generateClientToken(): Promise<string> {
  const response = await gateway.clientToken.generate({});
  return response.clientToken;
}

// Process payment using a nonce (tokenized card data)
async function processPayment(nonce: string, amount: string): Promise<braintree.Transaction> {
  const result = await gateway.transaction.sale({
    amount,
    paymentMethodNonce: nonce,  // Tokenized card - PAN never touches your server
    options: { submitForSettlement: true },
  });

  if (!result.success) {
    throw new Error(`Payment failed: ${result.message}`);
  }

  return result.transaction;
}
```

---

## 13. Network Segmentation

### Segmentation Architecture

```yaml
network_segmentation:
  purpose: "Reduce PCI DSS scope by isolating the CDE from other network segments"

  cde_segment:
    description: "Systems that store, process, or transmit cardholder data"
    controls:
      - "Firewall rules restricting inbound and outbound traffic"
      - "Allow only necessary protocols and ports"
      - "Deny all traffic by default; allow by exception"
      - "Two-factor authentication for all access"

  dmz_segment:
    description: "Public-facing systems (web servers, load balancers)"
    controls:
      - "No cardholder data stored in the DMZ"
      - "Restrict communication between DMZ and CDE to specific ports/protocols"
      - "WAF protecting web applications"

  corporate_network:
    description: "General-purpose business systems"
    controls:
      - "Segmented from the CDE"
      - "Validated segmentation controls tested every 6 months"
      - "Out of PCI DSS scope if properly segmented"

  management_network:
    description: "Administrative access to CDE systems"
    controls:
      - "Dedicated management VLAN"
      - "Jump hosts/bastion hosts for CDE access"
      - "MFA required for all administrative access"
      - "All sessions logged and monitored"
```

```hcl
# Terraform example: CDE network segmentation on AWS
resource "aws_vpc" "cde" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "pci-cde-vpc"
    Environment = "production"
    Compliance  = "PCI-DSS"
  }
}

resource "aws_subnet" "cde_private" {
  vpc_id                  = aws_vpc.cde.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = false
  availability_zone       = "us-east-1a"

  tags = {
    Name = "cde-private-subnet"
    Tier = "CDE"
  }
}

# Security group for CDE database
resource "aws_security_group" "cde_database" {
  name_prefix = "cde-db-"
  vpc_id      = aws_vpc.cde.id

  # Allow only application servers in CDE to access the database
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.cde_application.id]
    description     = "PostgreSQL from CDE application tier only"
  }

  # No direct outbound internet access
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Internal CDE VPC traffic only"
  }

  tags = {
    Name       = "cde-database-sg"
    Compliance = "PCI-DSS-Req1"
  }
}
```

---

## 14. New v4.0 Requirements

### Targeted Risk Analysis (Requirement 12.3.1)

```yaml
v4_0_targeted_risk_analysis:
  description: "Entities must perform targeted risk analysis for requirements where flexibility is allowed"
  examples:
    - "Determining the frequency of log reviews"
    - "Determining the frequency of periodic scans"
    - "Determining the frequency of password changes for service accounts"
  documentation:
    - "Identify the asset(s) being protected"
    - "Identify the threat(s) that the requirement protects against"
    - "Identify factors that contribute to the likelihood or impact of a threat"
    - "Resulting analysis that determines the frequency or scope"
    - "Reviewed at least annually"
```

### Enhanced Authentication (Requirement 8.3.6)

```yaml
v4_0_enhanced_authentication:
  password_length: "Minimum 12 characters (increased from 7)"
  mfa_for_cde: "MFA required for all access to the CDE (not just remote)"
  service_accounts:
    - "Managed based on targeted risk analysis"
    - "Passwords changed periodically per targeted risk analysis"
    - "Interactive login restricted when not needed"
```

### Client-Side Security (Requirement 6.4.3)

```yaml
v4_0_client_side_security:
  payment_page_scripts:
    description: "All scripts on payment pages must be managed"
    requirements:
      - "Maintain inventory of all scripts on payment pages"
      - "Written justification for each script"
      - "Integrity verification method for each script (SRI, CSP)"
      - "Authorization process for script changes"

  implementation:
    content_security_policy:
      script_src: "'self' https://js.stripe.com"
      frame_src: "https://js.stripe.com"
      connect_src: "'self' https://api.stripe.com"
      default_src: "'none'"

    subresource_integrity:
      - "Calculate SRI hashes for all scripts"
      - "Enforce integrity attribute on script tags"
      - "Monitor for unauthorized script changes"
```

```typescript
// Automated payment page script inventory
interface PaymentPageScript {
  src: string;
  sriHash: string;
  justification: string;
  approvedBy: string;
  approvedDate: string;
  lastVerified: string;
}

const approvedScripts: PaymentPageScript[] = [
  {
    src: 'https://js.stripe.com/v3/',
    sriHash: 'sha384-COMPUTED_HASH',
    justification: 'Payment processing via Stripe Elements',
    approvedBy: 'security-team',
    approvedDate: '2026-01-15',
    lastVerified: '2026-03-01',
  },
];

// CSP header generation from approved script list
function generateCSP(scripts: PaymentPageScript[]): string {
  const scriptSources = scripts.map(s => new URL(s.src).origin);
  const uniqueSources = [...new Set(scriptSources)];

  return [
    `default-src 'none'`,
    `script-src 'self' ${uniqueSources.join(' ')}`,
    `style-src 'self'`,
    `connect-src 'self' ${uniqueSources.join(' ')}`,
    `frame-src ${uniqueSources.join(' ')}`,
    `img-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
}
```

---

## 15. Code Examples

### Secure Payment Form with Scope Reduction

```typescript
// Complete payment flow keeping PAN out of scope
// Server-side API
import express from 'express';
import Stripe from 'stripe';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Step 1: Create payment intent
app.post('/api/payments/intent', async (req, res) => {
  const { amount, currency, customerId } = req.body;

  // Audit log the payment initiation
  await auditLogger.log({
    eventType: 'PAYMENT_INITIATED',
    userId: req.user.id,
    amount,
    currency,
    sourceIp: req.ip,
  });

  const intent = await stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    metadata: {
      orderId: req.body.orderId,
      merchantRef: req.body.merchantRef,
    },
  });

  // Return only the client secret (not a PAN)
  res.json({ clientSecret: intent.client_secret });
});

// Step 2: Handle webhook for payment confirmation
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    await auditLogger.log({ eventType: 'WEBHOOK_SIGNATURE_FAILED', sourceIp: req.ip });
    return res.status(400).send('Webhook signature verification failed');
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await processSuccessfulPayment(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedIntent = event.data.object as Stripe.PaymentIntent;
      await handleFailedPayment(failedIntent);
      break;
  }

  res.json({ received: true });
});
```

### PAN Detection and Prevention (DLP)

```python
import re
from typing import Optional

class PANDetector:
    """Detect and prevent accidental PAN storage or logging."""

    # Common card patterns
    CARD_PATTERNS = [
        r'\b4\d{12}(?:\d{3})?\b',          # Visa
        r'\b5[1-5]\d{14}\b',                # Mastercard
        r'\b3[47]\d{13}\b',                 # American Express
        r'\b6(?:011|5\d{2})\d{12}\b',       # Discover
        r'\b3(?:0[0-5]|[68]\d)\d{11}\b',    # Diners Club
        r'\b(?:2131|1800|35\d{3})\d{11}\b', # JCB
    ]

    @classmethod
    def detect(cls, text: str) -> list[str]:
        """Detect potential PANs in text."""
        findings = []
        for pattern in cls.CARD_PATTERNS:
            matches = re.findall(pattern, text)
            for match in matches:
                if cls._passes_luhn(match):
                    findings.append(match)
        return findings

    @classmethod
    def sanitize(cls, text: str) -> str:
        """Replace any PANs in text with masked versions."""
        result = text
        for pan in cls.detect(text):
            masked = pan[:6] + '*' * (len(pan) - 10) + pan[-4:]
            result = result.replace(pan, masked)
        return result

    @staticmethod
    def _passes_luhn(number: str) -> bool:
        digits = [int(d) for d in number]
        checksum = 0
        for i, digit in enumerate(reversed(digits)):
            if i % 2 == 1:
                digit *= 2
                if digit > 9:
                    digit -= 9
            checksum += digit
        return checksum % 10 == 0


# Use in logging middleware to prevent PAN leakage
class SafeLogger:
    """Logger that sanitizes output to prevent PAN logging."""

    def __init__(self, logger):
        self._logger = logger

    def info(self, message: str, **kwargs):
        self._logger.info(PANDetector.sanitize(message), **kwargs)

    def error(self, message: str, **kwargs):
        self._logger.error(PANDetector.sanitize(message), **kwargs)

    def warning(self, message: str, **kwargs):
        self._logger.warning(PANDetector.sanitize(message), **kwargs)
```

---

## 16. Best Practices

1. **Minimize PCI DSS scope through tokenization and outsourcing.** Use PCI-compliant payment processors (Stripe, Braintree, Adyen) to handle card data. The less cardholder data you touch, the smaller your compliance scope.

2. **Never store sensitive authentication data after authorization.** CVV/CVC, full track data, and PINs must never be stored after transaction authorization, even in encrypted form. There are no exceptions to this rule.

3. **Implement network segmentation to isolate the CDE.** Properly validated segmentation reduces the number of systems in scope. Test segmentation controls every six months and after any network changes.

4. **Use Subresource Integrity and Content Security Policy on payment pages.** PCI DSS v4.0 requires managing all scripts on payment pages. Implement SRI hashes and strict CSP policies to prevent unauthorized script injection.

5. **Implement PAN detection in logging and error handling.** Deploy data loss prevention (DLP) controls that scan logs, error messages, and data flows for accidental PAN exposure. Sanitize any detected PANs immediately.

6. **Enforce MFA for all access to the CDE.** PCI DSS v4.0 requires multi-factor authentication for all access into the CDE, not just remote access. Implement this at both the network and application layers.

7. **Maintain a complete inventory of all scripts, components, and third-party libraries.** Track all software components with a Software Bill of Materials. Monitor for known vulnerabilities and apply patches within one month for critical issues.

8. **Implement and review audit logs daily.** Automated log analysis should detect anomalies and suspicious patterns in real time. Retain logs for at least 12 months with 3 months immediately accessible.

9. **Conduct penetration testing annually and after significant changes.** Both internal and external penetration tests are required. Test segmentation controls every six months. Remediate all findings and re-test.

10. **Document everything: policies, procedures, diagrams, and risk analyses.** PCI DSS requires extensive documentation. Maintain current data flow diagrams, network diagrams, asset inventories, and security policies. Review and update annually.

---

## 17. Anti-Patterns

1. **Storing full PAN in application logs or error messages.** This is one of the most common PCI DSS violations. Implement log sanitization middleware that detects and masks PANs before writing to any log destination.

2. **Storing CVV/CVC for recurring payments.** The CVV must never be stored after authorization. For recurring payments, use tokenized payment methods from your payment processor instead.

3. **Running payment processing on the same network segment as general business systems.** Without proper segmentation, all connected systems fall into PCI DSS scope. Isolate the CDE with validated segmentation controls.

4. **Using self-signed certificates or outdated TLS versions.** PCI DSS requires trusted certificates and TLS 1.2 or higher. SSL and early TLS are explicitly prohibited.

5. **Allowing direct database access to cardholder data without application-layer controls.** All access to cardholder data should go through the application layer where access controls, logging, and encryption are enforced.

6. **Neglecting client-side security on payment pages.** PCI DSS v4.0 requires explicit management of all scripts on payment pages. Unmanaged JavaScript can be used for card-skimming attacks (Magecart-style).

7. **Treating tokenization as a silver bullet that eliminates all PCI DSS obligations.** Tokenization reduces scope but does not eliminate it. The token vault and payment processor integration still require PCI DSS controls.

8. **Using shared or generic accounts for CDE system administration.** PCI DSS requires unique identification for every user. Shared accounts prevent proper attribution in audit logs and violate Requirement 8.

---

## 18. Enforcement Checklist

### Account Data Protection
- [ ] PAN is stored only when necessary and protected by strong cryptography.
- [ ] Sensitive authentication data (CVV, full track data, PIN) is never stored after authorization.
- [ ] PAN is masked when displayed (first 6 and/or last 4 digits maximum).
- [ ] Data retention policies define maximum storage periods for cardholder data.
- [ ] Automated quarterly process identifies and deletes data exceeding retention periods.

### Encryption
- [ ] TLS 1.2 or higher is used for all cardholder data transmissions.
- [ ] SSL and early TLS are disabled.
- [ ] Strong cipher suites are configured; weak ciphers are disabled.
- [ ] Encryption keys are managed with dual control and split knowledge.
- [ ] Key rotation is performed per defined cryptoperiods.

### Access Control
- [ ] All users have unique IDs; no shared or generic accounts exist.
- [ ] MFA is enforced for all CDE access (v4.0 requirement).
- [ ] MFA is enforced for all remote access.
- [ ] Password policy requires minimum 12 characters with numeric and alphabetic.
- [ ] Accounts lock after 10 failed attempts for at least 30 minutes.
- [ ] Inactive accounts are disabled after 90 days.
- [ ] Access is granted based on least privilege and business need to know.

### Logging and Monitoring
- [ ] All access to cardholder data is logged.
- [ ] All administrative actions are logged.
- [ ] All authentication events are logged.
- [ ] Logs include user ID, event type, timestamp, success/failure, source, and resource.
- [ ] Logs are retained for at least 12 months (3 months immediately available).
- [ ] Daily automated log review is operational.
- [ ] Time synchronization (NTP) is configured across all CDE systems.

### Network Security
- [ ] CDE is segmented from the corporate network.
- [ ] Segmentation controls are tested every 6 months.
- [ ] Firewall rules restrict traffic to only what is necessary.
- [ ] Default deny rules are in place (deny all, allow by exception).
- [ ] Network diagrams are current and accurate.
- [ ] Data flow diagrams showing all cardholder data flows are maintained.

### Vulnerability Management
- [ ] Critical and high-severity patches are installed within one month.
- [ ] Software Bill of Materials is maintained for all CDE applications.
- [ ] Third-party components are monitored for known vulnerabilities.
- [ ] Annual (minimum) penetration testing is performed (internal and external).
- [ ] Quarterly external vulnerability scans are performed by an ASV.
- [ ] WAF or equivalent protection is deployed for public-facing web applications.

### Payment Page Security (v4.0)
- [ ] Inventory of all scripts on payment pages is maintained.
- [ ] Each script has documented business/technical justification.
- [ ] Subresource Integrity (SRI) is implemented for external scripts.
- [ ] Content Security Policy restricts script sources.
- [ ] Monitoring detects unauthorized script changes.

### Secure Development
- [ ] Secure SDLC processes are documented and followed.
- [ ] Developers receive annual secure coding training.
- [ ] Code review is performed by someone other than the author.
- [ ] Code review covers security considerations.
- [ ] Custom software is tested for vulnerabilities before release.

### Documentation and Policies
- [ ] Information security policy is documented and reviewed annually.
- [ ] All PCI DSS requirements are mapped to specific controls and owners.
- [ ] Targeted risk analyses are documented for flexible requirements.
- [ ] Incident response plan is documented and tested annually.
- [ ] Third-party service providers are monitored for PCI DSS compliance.
