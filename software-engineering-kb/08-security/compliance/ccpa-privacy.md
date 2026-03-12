# CCPA/CPRA for Developers

> Comprehensive technical guide to the California Consumer Privacy Act and the California Privacy Rights Act amendments.
> Audience: Software engineers building applications that collect or process personal information of California residents.
> Last updated: 2026-03-10

---

## Table of Contents

1. Overview and Scope
2. Key Definitions
3. Categories of Personal Information
4. Consumer Rights
5. Right to Know
6. Right to Delete
7. Right to Opt-Out (Do Not Sell/Share)
8. Right to Correct
9. Right to Limit Use of Sensitive Personal Information
10. Sale and Sharing Definitions
11. Opt-Out Mechanisms Implementation
12. Verifiable Consumer Requests
13. Service Provider Obligations
14. Data Retention Requirements
15. Privacy Policy Requirements
16. Financial Incentives and Loyalty Programs
17. Comparison with GDPR
18. Technical Implementation
19. Code Examples
20. Best Practices
21. Anti-Patterns
22. Enforcement Checklist

---

## 1. Overview and Scope

The California Consumer Privacy Act (CCPA), effective January 1, 2020, was significantly amended by the California Privacy Rights Act (CPRA), which took full effect January 1, 2023, with the enforcement date of July 1, 2023. Together, CCPA/CPRA provides California residents with comprehensive privacy rights regarding their personal information.

### Who Must Comply

A for-profit business that does business in California and meets any one of the following thresholds:

```yaml
applicability_thresholds:
  revenue: "Annual gross revenue exceeding $25 million"
  data_volume: "Annually buys, sells, or shares the personal information of 100,000 or more consumers or households"
  revenue_from_data: "Derives 50% or more of annual revenue from selling or sharing consumers' personal information"
```

### Enforcement

- **California Privacy Protection Agency (CPPA)**: New agency established by CPRA with rulemaking and enforcement authority.
- **California Attorney General**: Retains enforcement authority.
- **Civil penalties**: Up to $2,500 per violation or $7,500 per intentional violation or violations involving minors.
- **Private right of action**: Limited to data breaches involving non-encrypted or non-redacted personal information ($100-$750 per consumer per incident, or actual damages).

---

## 2. Key Definitions

```yaml
definitions:
  consumer:
    definition: "A California resident (natural person)"
    note: "Includes employees, job applicants, and B2B contacts"

  business:
    definition: "A for-profit entity that collects personal information, does business in California, and meets one or more thresholds"

  service_provider:
    definition: "An entity that processes personal information on behalf of a business pursuant to a written contract"
    analogy: "Similar to 'data processor' under GDPR"

  contractor:
    definition: "Entity to which a business makes available consumer PI for a business purpose pursuant to a written contract (new in CPRA)"

  third_party:
    definition: "Any entity that is not the business, service provider, or contractor"

  personal_information:
    definition: "Information that identifies, relates to, describes, is reasonably capable of being associated with, or could reasonably be linked, directly or indirectly, with a particular consumer or household"

  sensitive_personal_information:
    definition: "Specific categories of PI that receive heightened protection under CPRA"
    categories:
      - "Government-issued identifiers (SSN, driver's license, passport)"
      - "Account log-in credentials with passwords"
      - "Financial account information with access codes"
      - "Precise geolocation"
      - "Racial or ethnic origin"
      - "Religious or philosophical beliefs"
      - "Union membership"
      - "Contents of mail, email, and text messages (unless business is intended recipient)"
      - "Genetic data"
      - "Biometric data for identification"
      - "Health information"
      - "Sex life or sexual orientation"

  sale:
    definition: "Selling, renting, releasing, disclosing, disseminating, making available, transferring, or otherwise communicating a consumer's personal information to a third party for monetary or other valuable consideration"

  sharing:
    definition: "Sharing, renting, releasing, disclosing, disseminating, making available, transferring, or otherwise communicating a consumer's PI to a third party for cross-context behavioral advertising"
    note: "This is new in CPRA and captures targeted advertising even without monetary exchange"
```

---

## 3. Categories of Personal Information

```yaml
pi_categories:
  identifiers:
    examples: ["Real name", "Alias", "Postal address", "Email address", "IP address", "Account name", "SSN", "Driver's license", "Passport number"]

  customer_records:
    examples: ["Name", "Address", "Phone", "Education", "Employment", "Financial information"]
    note: "Per Cal. Civ. Code 1798.80(e)"

  protected_classifications:
    examples: ["Race", "Religion", "Sexual orientation", "Gender identity", "Disability", "Veteran status"]

  commercial_information:
    examples: ["Records of products purchased", "Purchasing or consuming histories", "Tendencies"]

  biometric_information:
    examples: ["Fingerprints", "Face geometry", "Voice recordings", "Keystroke patterns"]

  internet_activity:
    examples: ["Browsing history", "Search history", "Interaction with websites/apps/ads"]

  geolocation_data:
    examples: ["GPS coordinates", "Location data from mobile devices"]
    note: "Precise geolocation is Sensitive PI under CPRA"

  audio_electronic_visual_thermal_olfactory:
    examples: ["Recorded phone calls", "Security camera footage", "Thermal imaging"]

  professional_employment_information:
    examples: ["Job title", "Employment history", "Performance evaluations"]

  education_information:
    examples: ["Student records", "Grades", "Enrollment status"]
    note: "Non-publicly available per FERPA"

  inferences:
    examples: ["Consumer profiles", "Preferences", "Characteristics", "Predispositions", "Behavior"]
    note: "Profiles created from any of the above categories"
```

---

## 4. Consumer Rights

```yaml
consumer_rights_overview:
  right_to_know: "Know what PI is collected, used, shared, and sold"
  right_to_delete: "Request deletion of PI collected"
  right_to_opt_out: "Opt out of the sale or sharing of PI"
  right_to_correct: "Request correction of inaccurate PI (new in CPRA)"
  right_to_limit: "Limit the use and disclosure of sensitive PI (new in CPRA)"
  right_to_non_discrimination: "Not be discriminated against for exercising rights"
  right_to_access: "Access PI collected in a portable format"
  right_to_opt_in: "Minors under 16 must opt in to sale/sharing"

  response_timeline: "45 calendar days (extendable by 45 additional days with notice)"
  cost: "Free of charge (except manifestly unfounded or excessive requests)"
```

---

## 5. Right to Know

Consumers have the right to know:
- What categories of PI are collected.
- What specific pieces of PI are collected.
- The categories of sources from which PI is collected.
- The business or commercial purpose for collecting, selling, or sharing PI.
- The categories of third parties to whom PI is disclosed.
- The specific pieces of PI collected about the consumer.

```python
class RightToKnowHandler:
    """Handle consumer Right to Know requests."""

    async def handle_request(self, consumer_id: str, request_type: str) -> dict:
        """
        request_type: 'categories' or 'specific_pieces'
        """
        # Verify consumer identity first
        await self.verify_identity(consumer_id)

        if request_type == 'categories':
            return await self._get_categories_disclosure(consumer_id)
        elif request_type == 'specific_pieces':
            return await self._get_specific_pieces(consumer_id)

    async def _get_categories_disclosure(self, consumer_id: str) -> dict:
        """Categories disclosure (past 12 months)."""
        return {
            "categories_collected": [
                {"category": "Identifiers", "examples": ["Name", "Email", "IP address"]},
                {"category": "Commercial information", "examples": ["Purchase history"]},
                {"category": "Internet activity", "examples": ["Browsing history", "Search queries"]},
            ],
            "sources": [
                "Directly from consumer (account registration, purchases)",
                "Automatically from consumer (cookies, analytics)",
                "Third-party advertising partners",
            ],
            "business_purposes": [
                "Providing our services",
                "Processing transactions",
                "Improving our products",
                "Marketing and advertising",
            ],
            "categories_sold_or_shared": [
                {"category": "Internet activity", "recipients": "Advertising networks"},
            ],
            "categories_disclosed_for_business_purpose": [
                {"category": "Identifiers", "recipients": "Service providers (email, analytics)"},
            ],
        }

    async def _get_specific_pieces(self, consumer_id: str) -> dict:
        """Specific pieces of PI collected (past 12 months)."""
        # Compile PI from all systems
        pi_data = {
            "consumer_id": consumer_id,
            "period": "past_12_months",
            "data": {
                "identifiers": await self.get_identifiers(consumer_id),
                "commercial_info": await self.get_commercial_info(consumer_id),
                "internet_activity": await self.get_internet_activity(consumer_id),
                "inferences": await self.get_inferences(consumer_id),
            },
        }

        # Log the request for audit
        await self.audit_log.record("RIGHT_TO_KNOW_FULFILLED", consumer_id)
        return pi_data
```

---

## 6. Right to Delete

Consumers can request that a business delete personal information collected from them. The business must also direct service providers and contractors to delete the consumer's PI.

### Exceptions to Deletion

```yaml
deletion_exceptions:
  - "Complete a transaction or provide a requested good or service"
  - "Detect security incidents"
  - "Debug or repair functionality"
  - "Exercise free speech or other legal rights"
  - "Comply with the California Electronic Communications Privacy Act"
  - "Engage in public or peer-reviewed research in the public interest"
  - "Internal uses aligned with consumer expectations"
  - "Comply with a legal obligation"
  - "Otherwise use PI internally in a lawful manner compatible with the context of collection"
```

```typescript
// Right to Delete implementation
interface DeletionRequest {
  requestId: string;
  consumerId: string;
  requestedAt: string;
  verifiedAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'partially_completed' | 'denied';
  denialReason?: string;
}

interface DeletionReport {
  requestId: string;
  consumerId: string;
  systemsDeleted: string[];
  systemsRetained: { system: string; reason: string; exception: string }[];
  serviceProvidersNotified: string[];
  completedAt: string;
}

async function handleDeletionRequest(consumerId: string): Promise<DeletionReport> {
  const report: DeletionReport = {
    requestId: generateId(),
    consumerId,
    systemsDeleted: [],
    systemsRetained: [],
    serviceProvidersNotified: [],
    completedAt: '',
  };

  // 1. Identify all systems containing consumer PI
  const systems = await dataRegistry.getSystemsForConsumer(consumerId);

  // 2. Check each system for retention exceptions
  for (const system of systems) {
    const exception = await checkDeletionException(system, consumerId);

    if (exception) {
      report.systemsRetained.push({
        system: system.name,
        reason: exception.reason,
        exception: exception.type,
      });
      continue;
    }

    // 3. Delete from system
    await system.deleteConsumerData(consumerId);
    report.systemsDeleted.push(system.name);
  }

  // 4. Notify service providers to delete
  const serviceProviders = await getServiceProviders();
  for (const sp of serviceProviders) {
    await sp.requestDeletion(consumerId);
    report.serviceProvidersNotified.push(sp.name);
  }

  report.completedAt = new Date().toISOString();

  // 5. Audit log (without retaining the PI being deleted)
  await auditLog.record({
    action: 'CCPA_DELETION_COMPLETED',
    requestId: report.requestId,
    systemsDeleted: report.systemsDeleted.length,
    systemsRetained: report.systemsRetained.length,
    serviceProvidersNotified: report.serviceProvidersNotified.length,
  });

  return report;
}
```

---

## 7. Right to Opt-Out (Do Not Sell/Share)

Consumers have the right to opt out of:
- **Sale** of their personal information.
- **Sharing** of their personal information for cross-context behavioral advertising (new in CPRA).

### Requirements

```yaml
opt_out_requirements:
  link_on_homepage: "Clear and conspicuous 'Do Not Sell or Share My Personal Information' link"
  gpc_signal: "Honor the Global Privacy Control (GPC) signal as a valid opt-out request"
  no_retaliation: "Cannot deny goods or services, charge different prices, or provide different quality"
  wait_period: "Must wait at least 12 months before asking a consumer who opted out to reconsider"
  minors: "Children under 16 require opt-in; children under 13 require parental consent"
```

---

## 8. Right to Correct

New in CPRA, consumers can request that a business correct inaccurate personal information about them.

```yaml
right_to_correct:
  process:
    - "Consumer submits correction request"
    - "Business verifies consumer identity"
    - "Business uses commercially reasonable efforts to correct the information"
    - "Business instructs service providers and contractors to correct"
    - "Business responds within 45 days"

  implementation:
    - "Provide a form or API endpoint for correction requests"
    - "Allow consumers to specify which data points are inaccurate"
    - "Allow consumers to provide supporting documentation"
    - "Propagate corrections to all systems and service providers"
    - "Document the correction in the audit trail"
```

---

## 9. Right to Limit Use of Sensitive Personal Information

New in CPRA, consumers can limit the use of their sensitive personal information to only what is necessary for providing the goods or services they requested.

```yaml
right_to_limit:
  triggers: "Consumer exercises right via 'Limit the Use of My Sensitive Personal Information' link"

  scope: "Limits use to:"
    - "Performing services or providing goods reasonably expected"
    - "Detecting security incidents"
    - "Resisting malicious, deceptive, or illegal actions"
    - "Ensuring physical safety"
    - "Short-term transient use (not building a profile)"
    - "Performing services on behalf of the business"
    - "Verifying or maintaining quality of service"
    - "Other purposes enumerated in regulations"

  prohibited_after_limit:
    - "Using sensitive PI for advertising or marketing"
    - "Profiling based on sensitive PI"
    - "Sharing sensitive PI with third parties for non-essential purposes"
```

```python
# Sensitive PI usage limiter
class SensitivePILimiter:
    """Enforce consumer right to limit use of sensitive PI."""

    ESSENTIAL_PURPOSES = {
        "service_delivery",
        "security_incident_detection",
        "fraud_prevention",
        "physical_safety",
        "quality_assurance",
    }

    async def check_usage_allowed(
        self, consumer_id: str, data_type: str, purpose: str
    ) -> bool:
        """Check if usage of sensitive PI is permitted."""
        # Check if data type is classified as sensitive PI
        if data_type not in self.SENSITIVE_PI_TYPES:
            return True  # Not sensitive PI; standard rules apply

        # Check if consumer has exercised right to limit
        limitation = await self.limitation_store.get(consumer_id)
        if not limitation or not limitation.active:
            return True  # No active limitation

        # Only allow essential purposes
        if purpose not in self.ESSENTIAL_PURPOSES:
            await self.audit_log.record(
                action="SENSITIVE_PI_USAGE_BLOCKED",
                consumer_id=consumer_id,
                data_type=data_type,
                purpose=purpose,
                reason="consumer_limitation_active",
            )
            return False

        return True

    SENSITIVE_PI_TYPES = {
        "ssn", "drivers_license", "passport_number",
        "financial_account", "precise_geolocation",
        "racial_origin", "ethnic_origin", "religious_beliefs",
        "union_membership", "genetic_data", "biometric_data",
        "health_data", "sex_life", "sexual_orientation",
        "email_contents", "text_message_contents",
        "login_credentials",
    }
```

---

## 10. Sale and Sharing Definitions

### What Constitutes a "Sale"

```yaml
sale_definition:
  is_a_sale:
    - "Providing PI to a third-party ad network in exchange for ad revenue"
    - "Providing PI to a data broker for monetary compensation"
    - "Trading PI with another company for their data (valuable consideration)"

  is_not_a_sale:
    - "Disclosing PI to a service provider under a CCPA-compliant contract"
    - "Consumer directs the business to disclose PI to a third party"
    - "Consumer uses the business to interact with a third party intentionally"
    - "Disclosing PI as part of a merger or acquisition"
    - "Disclosing PI that is already publicly available"
```

### What Constitutes "Sharing" (CPRA)

```yaml
sharing_definition:
  is_sharing:
    - "Placing third-party advertising cookies or pixels that track consumers across sites"
    - "Providing PI to an ad network for cross-context behavioral advertising"
    - "Using targeted advertising technology that communicates PI to a third party"
    - "Embedded third-party trackers (Meta Pixel, Google Analytics remarketing)"
    - "Real-time bidding on advertising exchanges using consumer PI"

  is_not_sharing:
    - "Contextual advertising (based on current page content, not consumer profile)"
    - "First-party advertising (using only your own collected data without third-party communication)"
    - "Frequency capping"
    - "Measuring ad performance (aggregate, no PI shared)"
```

```yaml
# Common third-party tools and their CCPA implications
tool_implications:
  google_analytics:
    category: "May constitute sharing if used for advertising features"
    risk: "Sends PI to Google; advertising features may constitute sharing"
    mitigation:
      - "Disable advertising features if not needed"
      - "Enable IP anonymization"
      - "Disable data sharing settings with Google"
      - "Honor opt-out signals before loading GA"

  meta_pixel:
    category: "Likely constitutes sharing"
    risk: "Sends browsing data to Meta for targeted advertising"
    mitigation:
      - "Do not load for users who opted out"
      - "Use Conversions API with server-side filtering"
      - "Implement consent management"

  third_party_ad_networks:
    category: "Constitutes sale or sharing"
    risk: "PI shared for advertising purposes"
    mitigation:
      - "Honor opt-out signals"
      - "Pass opt-out signals through to ad partners"
      - "Use contextual advertising as an alternative"
```

---

## 11. Opt-Out Mechanisms Implementation

### Global Privacy Control (GPC)

```yaml
gpc_overview:
  description: "A browser-level signal that communicates a consumer's opt-out preference"
  header: "Sec-GPC: 1"
  js_property: "navigator.globalPrivacyControl === true"
  legal_status: "California AG has confirmed GPC must be honored under CCPA/CPRA"
  specification: "https://globalprivacycontrol.org/"
```

```typescript
// GPC detection and handling
function detectGPCSignal(req: Request): boolean {
  // Check HTTP header
  const headerValue = req.headers['sec-gpc'];
  if (headerValue === '1') return true;

  // Note: navigator.globalPrivacyControl is client-side only
  // Server-side, rely on the HTTP header
  return false;
}

// Middleware to handle GPC signal
function gpcMiddleware(req: Request, res: Response, next: NextFunction): void {
  const gpcEnabled = detectGPCSignal(req);

  if (gpcEnabled) {
    // Set opt-out flags for this request
    req.privacyPreferences = {
      doNotSell: true,
      doNotShare: true,
      source: 'gpc_header',
    };

    // Do not load third-party tracking scripts
    res.locals.loadTracking = false;
    res.locals.loadAdScripts = false;

    // Record the opt-out signal
    if (req.user) {
      recordOptOut(req.user.id, 'gpc_signal').catch(console.error);
    }
  }

  next();
}

// Client-side GPC detection
// <script>
// if (navigator.globalPrivacyControl) {
//   // Disable tracking scripts
//   window._trackingEnabled = false;
//   // Do not load advertising pixels
//   window._adsEnabled = false;
// }
// </script>
```

### "Do Not Sell or Share" Link

```typescript
// API endpoint for opt-out via website link
app.post('/api/privacy/opt-out', async (req, res) => {
  const { consumerId, optOutOf } = req.body;

  // Validate opt-out categories
  const validCategories = ['sale', 'sharing', 'sale_and_sharing'];
  if (!validCategories.includes(optOutOf)) {
    return res.status(400).json({ error: 'Invalid opt-out category' });
  }

  // Record the opt-out preference
  await privacyPreferenceStore.save({
    consumerId,
    optOutOf,
    timestamp: new Date().toISOString(),
    source: 'website_link',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Immediately stop selling/sharing PI
  await adNetworkManager.stopSharing(consumerId);
  await dataPartnerManager.stopSelling(consumerId);

  // Notify service providers of the opt-out
  await notifyServiceProviders(consumerId, optOutOf);

  // Audit log
  await auditLog.record({
    action: 'CCPA_OPT_OUT',
    consumerId: hashForAudit(consumerId),
    optOutOf,
    source: 'website_link',
  });

  res.json({
    success: true,
    message: 'Your opt-out preference has been recorded. We will no longer sell or share your personal information.',
  });
});
```

### Full Opt-Out Signal Processing Pipeline

```python
class OptOutSignalProcessor:
    """Process and propagate opt-out signals from all sources."""

    SIGNAL_SOURCES = ["gpc_header", "website_link", "email_request", "phone_request", "authorized_agent"]

    async def process_signal(self, consumer_id: str, signal_source: str, opt_out_type: str):
        """Process an opt-out signal from any source."""

        # 1. Record the opt-out preference
        preference = OptOutPreference(
            consumer_id=consumer_id,
            opt_out_type=opt_out_type,  # 'sale', 'sharing', 'sale_and_sharing'
            source=signal_source,
            recorded_at=datetime.utcnow(),
            active=True,
        )
        await self.preference_store.save(preference)

        # 2. Immediately stop processing for opted-out purposes
        if opt_out_type in ('sale', 'sale_and_sharing'):
            await self.stop_data_sales(consumer_id)
        if opt_out_type in ('sharing', 'sale_and_sharing'):
            await self.stop_data_sharing(consumer_id)

        # 3. Suppress third-party tracking
        await self.tracking_suppressor.suppress(consumer_id)

        # 4. Notify downstream partners
        await self.notify_partners(consumer_id, opt_out_type)

        # 5. Update advertising systems
        await self.ad_manager.add_to_suppression_list(consumer_id)

        # 6. Audit trail
        await self.audit_log.record(
            action="OPT_OUT_PROCESSED",
            consumer_id_hash=hash_id(consumer_id),
            source=signal_source,
            opt_out_type=opt_out_type,
        )

    async def stop_data_sales(self, consumer_id: str):
        """Stop all PI sales for this consumer."""
        data_partners = await self.partner_registry.get_sale_partners()
        for partner in data_partners:
            await partner.api.suppress(consumer_id)

    async def stop_data_sharing(self, consumer_id: str):
        """Stop all PI sharing for cross-context behavioral advertising."""
        # Remove from advertising audience segments
        await self.audience_manager.remove(consumer_id)
        # Suppress from real-time bidding
        await self.rtb_suppression.add(consumer_id)
        # Disable retargeting pixels
        await self.pixel_manager.suppress(consumer_id)
```

---

## 12. Verifiable Consumer Requests

```yaml
verifiable_consumer_requests:
  requirements:
    - "Business must verify the identity of the consumer making the request"
    - "Verification must be reasonably matched to the sensitivity of the PI involved"
    - "Cannot require the consumer to create an account to submit a request"
    - "Account holders can use existing account login for verification"
    - "Non-account holders may need to verify through other means"

  verification_methods:
    low_risk: "Match against 2 data points (email + name)"
    medium_risk: "Match against 3 data points (email + name + account number)"
    high_risk: "Signed declaration under penalty of perjury"
    account_holders: "Standard authentication (login)"

  authorized_agents:
    - "Consumer can designate an authorized agent to make requests on their behalf"
    - "Authorized agent must provide proof of authorization (power of attorney or consumer signed permission)"
    - "Business may still require consumer verification"

  request_channels:
    required:
      - "At minimum, a toll-free telephone number"
      - "If primarily online, an interactive web form"
    optional:
      - "Email address for privacy requests"
      - "In-app request mechanism"
```

```typescript
// Consumer request verification system
interface ConsumerRequestVerification {
  requestId: string;
  consumerId: string;
  requestType: 'know_categories' | 'know_specific' | 'delete' | 'correct' | 'opt_out';
  verificationLevel: 'low' | 'medium' | 'high';
  verificationMethod: string;
  verified: boolean;
  verifiedAt?: string;
}

function getRequiredVerificationLevel(requestType: string): 'low' | 'medium' | 'high' {
  switch (requestType) {
    case 'know_categories':
      return 'low';   // Less sensitive - category-level data
    case 'know_specific':
      return 'medium'; // More sensitive - specific PI
    case 'delete':
      return 'medium'; // Significant action
    case 'correct':
      return 'medium'; // Modifying PI
    case 'opt_out':
      return 'low';    // Lower verification threshold to encourage exercise
    default:
      return 'medium';
  }
}

async function verifyConsumerRequest(
  request: ConsumerRequest,
  verificationData: VerificationData,
): Promise<ConsumerRequestVerification> {
  const requiredLevel = getRequiredVerificationLevel(request.type);

  let verified = false;

  switch (requiredLevel) {
    case 'low':
      // Match 2 data points
      verified = await matchDataPoints(request.consumerId, verificationData, 2);
      break;
    case 'medium':
      // Match 3 data points
      verified = await matchDataPoints(request.consumerId, verificationData, 3);
      break;
    case 'high':
      // Require signed declaration
      verified = verificationData.signedDeclaration === true &&
                 await matchDataPoints(request.consumerId, verificationData, 3);
      break;
  }

  return {
    requestId: request.id,
    consumerId: request.consumerId,
    requestType: request.type,
    verificationLevel: requiredLevel,
    verificationMethod: `${requiredLevel}_verification`,
    verified,
    verifiedAt: verified ? new Date().toISOString() : undefined,
  };
}
```

---

## 13. Service Provider Obligations

```yaml
service_provider_obligations:
  contractual_requirements:
    - "Written contract specifying the business purposes for which PI is provided"
    - "Prohibition on selling or sharing consumer PI"
    - "Prohibition on retaining, using, or disclosing PI outside the direct business relationship"
    - "Prohibition on combining consumer PI from different sources"
    - "Obligation to comply with CCPA requirements"
    - "Obligation to assist business in responding to consumer requests"
    - "Obligation to notify business of subcontractor engagement"
    - "Grant the business rights to monitor and ensure compliance"

  developer_implications:
    - "When your company acts as a service provider, ensure APIs support consumer request forwarding"
    - "Implement data deletion endpoints that business customers can invoke"
    - "Do not repurpose customer data for your own business purposes"
    - "Maintain records of data processing activities per business customer"
    - "Support PI inventory reporting per customer"
```

```yaml
# Service provider contract requirements checklist
service_provider_contract:
  required_terms:
    - term: "Business purpose specification"
      description: "Enumerate the specific business purposes for which PI is processed"

    - term: "Prohibition on selling/sharing"
      description: "Service provider shall not sell or share consumer PI"

    - term: "Use limitation"
      description: "PI used only for the specific business purposes in the contract"

    - term: "Compliance obligation"
      description: "Service provider will comply with applicable CCPA/CPRA requirements"

    - term: "Consumer request assistance"
      description: "Service provider will assist business in responding to consumer requests"

    - term: "Subcontractor restrictions"
      description: "Written notice of subcontractors; flow-down of CCPA obligations"

    - term: "Monitoring rights"
      description: "Business has the right to ensure service provider compliance"

    - term: "Breach notification"
      description: "Service provider will notify business of PI breaches"
```

---

## 14. Data Retention Requirements

```yaml
data_retention:
  ccpa_cpra_requirements:
    - "Inform consumers of the length of time PI will be retained (or criteria for determining retention)"
    - "Do not retain PI longer than reasonably necessary for the disclosed purpose"
    - "Retention periods should be proportionate to the purpose and sensitivity of the PI"

  disclosure_requirements:
    - "Include retention periods in your privacy policy"
    - "Include retention information in your response to Right to Know requests"
    - "Provide retention periods by category of PI or by purpose of processing"

  implementation:
    - "Define retention schedules for each category of PI"
    - "Implement automated data deletion at retention expiry"
    - "Document the business justification for each retention period"
    - "Review retention schedules at least annually"
```

---

## 15. Privacy Policy Requirements

```yaml
privacy_policy_requirements:
  must_include:
    - "Categories of PI collected in the preceding 12 months"
    - "Categories of sources from which PI is collected"
    - "Business or commercial purpose for collecting or selling PI"
    - "Categories of third parties to whom PI is disclosed"
    - "Categories of PI sold or shared in the preceding 12 months"
    - "Categories of PI disclosed for a business purpose in the preceding 12 months"
    - "Description of each consumer right"
    - "How to submit consumer requests"
    - "Retention periods for each category of PI"
    - "Whether PI of minors under 16 is sold or shared"

  presentation:
    - "Updated at least every 12 months"
    - "Accessible and easy to find on the website"
    - "Written in plain language"
    - "Available in the languages the business uses to communicate with consumers"

  links_required:
    - "'Do Not Sell or Share My Personal Information' link on homepage"
    - "'Limit the Use of My Sensitive Personal Information' link (if using sensitive PI beyond essential purposes)"
    - "Link to privacy policy from homepage"
```

---

## 16. Financial Incentives and Loyalty Programs

```yaml
financial_incentives:
  definition: "Programs that offer a different price, rate, level, or quality of goods or services based on PI collection or retention"

  examples:
    - "Loyalty rewards programs"
    - "Discounts in exchange for email address"
    - "Premium features in exchange for data sharing consent"

  requirements:
    - "Consumer must opt in"
    - "Describe the material terms in the privacy policy"
    - "Consumers can revoke consent at any time"
    - "Must not be unjust, unreasonable, coercive, or usurious"
    - "Value of incentive must be reasonably related to the value of the consumer's PI"

  value_calculation:
    - "Revenue generated from selling, collecting, or retaining PI"
    - "Expenses related to collecting or maintaining PI"
    - "Profit or loss from the PI"
    - "Other practical and reliable methods"
```

---

## 17. Comparison with GDPR

```yaml
ccpa_vs_gdpr:
  scope:
    gdpr: "All personal data of EU/EEA residents"
    ccpa: "Personal information of California consumers from qualifying businesses"

  legal_basis:
    gdpr: "Requires affirmative legal basis for all processing (consent, contract, etc.)"
    ccpa: "Allows collection by default with notice; focuses on opt-out rights"

  consent_model:
    gdpr: "Opt-in by default (affirmative consent required)"
    ccpa: "Opt-out model (consumers must actively opt out of sale/sharing)"

  data_subject_rights:
    both: ["Right to access", "Right to delete", "Right to portability"]
    gdpr_only: ["Right to restrict processing", "Right to object", "Right related to automated decision-making"]
    ccpa_only: ["Right to opt-out of sale/sharing", "Right to limit use of sensitive PI"]

  children:
    gdpr: "Parental consent for children under 16 (member states may lower to 13)"
    ccpa: "Opt-in required for sale/sharing of PI for consumers under 16; parental consent under 13"

  enforcement:
    gdpr: "Supervisory authorities; up to 4% global turnover"
    ccpa: "CPPA and AG; up to $7,500 per intentional violation; private right of action for breaches"

  transfers:
    gdpr: "Complex cross-border transfer mechanisms (SCCs, adequacy, BCRs)"
    ccpa: "No restriction on cross-border transfers"

  applicability:
    gdpr: "All organizations processing EU resident data regardless of size"
    ccpa: "Only businesses meeting revenue or data volume thresholds"

  developer_implication:
    note: "If you process data of both EU and California residents, design for GDPR compliance first. GDPR's stricter opt-in model generally exceeds CCPA requirements, but CCPA has unique requirements (Do Not Sell link, GPC) that must be addressed separately."
```

---

## 18. Technical Implementation

### Consumer Request Management System

```typescript
// Consumer privacy request management
interface PrivacyRequest {
  id: string;
  consumerId: string;
  type: 'know' | 'delete' | 'correct' | 'opt_out' | 'limit_sensitive';
  status: 'received' | 'verifying' | 'processing' | 'completed' | 'denied';
  receivedAt: string;
  verifiedAt?: string;
  completedAt?: string;
  deadline: string;        // 45 days from receipt
  extensionDeadline?: string; // Additional 45 days if needed
  channel: 'web_form' | 'email' | 'phone' | 'authorized_agent';
  verificationLevel: string;
  notes: string[];
}

class PrivacyRequestManager {
  async createRequest(params: CreateRequestParams): Promise<PrivacyRequest> {
    const request: PrivacyRequest = {
      id: generateId(),
      consumerId: params.consumerId,
      type: params.type,
      status: 'received',
      receivedAt: new Date().toISOString(),
      deadline: addDays(new Date(), 45).toISOString(),
      channel: params.channel,
      verificationLevel: getRequiredVerificationLevel(params.type),
      notes: [],
    };

    await this.requestStore.save(request);

    // Send acknowledgment to consumer
    await this.notifier.sendAcknowledgment(request);

    // Start verification process
    await this.verificationQueue.enqueue(request.id);

    return request;
  }

  async getRequestStatus(requestId: string): Promise<RequestStatus> {
    const request = await this.requestStore.get(requestId);
    return {
      requestId: request.id,
      type: request.type,
      status: request.status,
      receivedAt: request.receivedAt,
      estimatedCompletionDate: request.completedAt || request.deadline,
    };
  }

  async processRequest(requestId: string): Promise<void> {
    const request = await this.requestStore.get(requestId);

    switch (request.type) {
      case 'know':
        await this.rightToKnowHandler.handle(request);
        break;
      case 'delete':
        await this.rightToDeleteHandler.handle(request);
        break;
      case 'correct':
        await this.rightToCorrectHandler.handle(request);
        break;
      case 'opt_out':
        await this.optOutHandler.handle(request);
        break;
      case 'limit_sensitive':
        await this.limitSensitiveHandler.handle(request);
        break;
    }

    request.status = 'completed';
    request.completedAt = new Date().toISOString();
    await this.requestStore.update(request);

    // Notify consumer of completion
    await this.notifier.sendCompletion(request);
  }
}
```

### GPC Signal Detection in Different Contexts

```python
# Server-side GPC detection (Python/Flask)
from flask import request

def detect_gpc() -> bool:
    """Detect Global Privacy Control signal from HTTP header."""
    return request.headers.get('Sec-GPC') == '1'

@app.before_request
def check_privacy_signals():
    """Middleware to check privacy signals before each request."""
    if detect_gpc():
        # Apply opt-out preferences
        g.privacy_context = {
            'do_not_sell': True,
            'do_not_share': True,
            'signal_source': 'gpc',
        }

        # Do not load third-party tracking
        g.load_tracking = False

        # If user is authenticated, record preference persistently
        if hasattr(g, 'current_user') and g.current_user:
            opt_out_processor.process_signal(
                consumer_id=g.current_user.id,
                signal_source='gpc_header',
                opt_out_type='sale_and_sharing',
            )
    else:
        g.privacy_context = {
            'do_not_sell': False,
            'do_not_share': False,
        }
        g.load_tracking = True
```

```javascript
// Client-side GPC detection and conditional script loading
(function() {
  const gpcEnabled = navigator.globalPrivacyControl === true;
  const userOptedOut = document.cookie.includes('ccpa_opt_out=true');

  if (gpcEnabled || userOptedOut) {
    // Do NOT load advertising/tracking scripts
    console.log('Privacy signal detected. Third-party tracking disabled.');
    window.__trackingConsent = false;
  } else {
    // Load analytics and advertising scripts
    window.__trackingConsent = true;

    // Load Google Analytics
    const gaScript = document.createElement('script');
    gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=GA-XXXXXX';
    gaScript.async = true;
    document.head.appendChild(gaScript);
  }
})();
```

---

## 19. Code Examples

### Privacy Dashboard API

```typescript
// Complete privacy dashboard API for consumer self-service
import express from 'express';

const router = express.Router();

// Get privacy preferences
router.get('/api/privacy/preferences', requireAuth, async (req, res) => {
  const preferences = await privacyStore.getPreferences(req.user.id);

  res.json({
    doNotSell: preferences.doNotSell,
    doNotShare: preferences.doNotShare,
    limitSensitivePI: preferences.limitSensitivePI,
    consentRecords: await consentStore.getAll(req.user.id),
    dataCategories: await piInventory.getCategoriesForConsumer(req.user.id),
    pendingRequests: await requestManager.getPending(req.user.id),
  });
});

// Submit opt-out of sale/sharing
router.post('/api/privacy/opt-out', requireAuth, async (req, res) => {
  await optOutProcessor.processSignal(
    req.user.id,
    'website_dashboard',
    'sale_and_sharing',
  );

  res.json({ success: true, message: 'Opt-out preference recorded.' });
});

// Submit limit use of sensitive PI
router.post('/api/privacy/limit-sensitive', requireAuth, async (req, res) => {
  await sensitivePI.setLimitation(req.user.id, {
    active: true,
    timestamp: new Date().toISOString(),
    source: 'website_dashboard',
  });

  res.json({ success: true, message: 'Sensitive PI usage limited to essential purposes.' });
});

// Submit right to know request
router.post('/api/privacy/request/know', requireAuth, async (req, res) => {
  const { requestType } = req.body; // 'categories' or 'specific_pieces'

  const request = await requestManager.createRequest({
    consumerId: req.user.id,
    type: 'know',
    channel: 'web_form',
    details: { requestType },
  });

  res.status(202).json({
    requestId: request.id,
    status: 'received',
    estimatedCompletion: request.deadline,
    message: 'Your request has been received. We will respond within 45 days.',
  });
});

// Submit deletion request
router.post('/api/privacy/request/delete', requireAuth, async (req, res) => {
  const request = await requestManager.createRequest({
    consumerId: req.user.id,
    type: 'delete',
    channel: 'web_form',
  });

  res.status(202).json({
    requestId: request.id,
    status: 'received',
    estimatedCompletion: request.deadline,
    message: 'Your deletion request has been received. We will verify your identity and respond within 45 days.',
  });
});

// Submit correction request
router.post('/api/privacy/request/correct', requireAuth, async (req, res) => {
  const { fieldName, currentValue, correctedValue, supportingDocumentation } = req.body;

  const request = await requestManager.createRequest({
    consumerId: req.user.id,
    type: 'correct',
    channel: 'web_form',
    details: { fieldName, currentValue, correctedValue, hasDocumentation: !!supportingDocumentation },
  });

  res.status(202).json({
    requestId: request.id,
    status: 'received',
    estimatedCompletion: request.deadline,
  });
});

// Check request status
router.get('/api/privacy/request/:requestId', requireAuth, async (req, res) => {
  const status = await requestManager.getRequestStatus(req.params.requestId);

  if (status.consumerId !== req.user.id) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json(status);
});
```

### Data Inventory for CCPA Disclosure

```python
class CCPADataInventory:
    """Maintain an inventory of PI categories for CCPA disclosures."""

    def __init__(self, data_sources: list):
        self.data_sources = data_sources

    async def get_disclosure_report(self, consumer_id: str) -> dict:
        """Generate a CCPA-compliant disclosure report for a consumer."""
        report = {
            "reporting_period": "preceding_12_months",
            "categories_collected": [],
            "sources": [],
            "purposes": [],
            "categories_sold": [],
            "categories_shared": [],
            "categories_disclosed_business_purpose": [],
        }

        for source in self.data_sources:
            pi_categories = await source.get_pi_categories(consumer_id)
            for cat in pi_categories:
                if cat.category not in [c["category"] for c in report["categories_collected"]]:
                    report["categories_collected"].append({
                        "category": cat.category,
                        "examples": cat.examples,
                        "source": cat.source_type,
                        "purpose": cat.business_purpose,
                        "retention_period": cat.retention_period,
                    })

        # Determine sale/sharing status
        sale_sharing = await self.sale_sharing_registry.get_for_consumer(consumer_id)
        report["categories_sold"] = sale_sharing.get("sold", [])
        report["categories_shared"] = sale_sharing.get("shared", [])

        return report

    async def get_annual_metrics(self) -> dict:
        """Metrics for annual privacy report."""
        return {
            "year": datetime.utcnow().year - 1,
            "requests_to_know_received": await self.metrics.count("know"),
            "requests_to_know_fulfilled": await self.metrics.count("know", status="completed"),
            "requests_to_delete_received": await self.metrics.count("delete"),
            "requests_to_delete_fulfilled": await self.metrics.count("delete", status="completed"),
            "requests_to_opt_out_received": await self.metrics.count("opt_out"),
            "requests_to_opt_out_fulfilled": await self.metrics.count("opt_out", status="completed"),
            "mean_days_to_respond": await self.metrics.average_response_days(),
        }
```

---

## 20. Best Practices

1. **Honor the Global Privacy Control (GPC) signal as a valid opt-out request.** Detect the Sec-GPC header server-side and navigator.globalPrivacyControl client-side. Treat it as a universal opt-out of sale and sharing. The California AG has confirmed this is required.

2. **Implement opt-out enforcement at the earliest possible point in the data pipeline.** Do not load third-party tracking scripts, advertising pixels, or data-sharing integrations for consumers who have opted out. Prevention is more reliable than after-the-fact suppression.

3. **Build a centralized consumer request management system.** Track all privacy requests (know, delete, correct, opt-out, limit) with deadlines, verification status, and fulfillment evidence. Automate deadline tracking and reminders.

4. **Design your data model to support PI identification and deletion by consumer.** Ensure every record containing PI can be traced to a specific consumer. Foreign key relationships should support cascade operations for deletion requests.

5. **Maintain a PI inventory that maps categories to systems, purposes, and retention periods.** This inventory powers your privacy policy, Right to Know responses, and data deletion workflows. Update it whenever you introduce new data collection.

6. **Implement verification requirements proportional to the sensitivity of the request.** Right to Know (specific pieces) and Right to Delete require stronger verification than Right to Opt-Out. Do not create unnecessary friction for opt-out requests.

7. **Distinguish between "sale" and "sharing" and track both.** CPRA added "sharing" (cross-context behavioral advertising) as a separate concept from "sale." Your opt-out mechanisms and disclosures must address both.

8. **If you serve both EU and California consumers, build for GDPR first, then layer CCPA-specific requirements.** GDPR's opt-in model is generally stricter, but CCPA has unique requirements (Do Not Sell link, GPC, sensitive PI limitations) that must be addressed separately.

9. **Include retention periods in your privacy policy and enforce them automatically.** CPRA requires disclosure of retention periods. Automated retention enforcement ensures compliance and reduces risk.

10. **Test your opt-out mechanisms end-to-end, including third-party integrations.** Verify that opting out actually stops data sharing with advertising partners, analytics providers, and other third parties. Conduct regular audits to confirm effectiveness.

---

## 21. Anti-Patterns

1. **Loading third-party tracking scripts before checking opt-out status.** If tracking pixels fire before opt-out preferences are evaluated, PI is shared despite the consumer's wishes. Check opt-out status before loading any tracking code.

2. **Ignoring the GPC signal.** Some businesses treat GPC as advisory rather than mandatory. Under California law, the GPC signal must be honored as a valid opt-out of sale and sharing.

3. **Making the opt-out process unnecessarily difficult.** Multi-step opt-out flows with dark patterns (confusing UI, emotional language, unnecessary questions) violate the non-discrimination principle and invite enforcement action.

4. **Treating all consumer requests the same regardless of type.** Different request types (know vs delete vs opt-out) have different verification requirements, processing steps, and exceptions. Handle each type with its own workflow.

5. **Failing to propagate deletion requests to service providers.** Deleting data from your own systems but not instructing service providers to do the same is an incomplete and non-compliant response.

6. **Not disclosing "sharing" for advertising purposes.** Many businesses disclose "sales" but overlook "sharing" for cross-context behavioral advertising. Third-party cookies, pixels, and advertising data flows must be disclosed.

7. **Collecting sensitive PI without a "Limit the Use" mechanism.** If you process sensitive PI beyond what is necessary for providing the service, you must provide a "Limit the Use of My Sensitive Personal Information" link. Failing to do so is a CPRA violation.

8. **Using the same retention period for all categories of PI.** Different categories serve different purposes and should have different retention periods. Applying a blanket retention period likely retains some data longer than necessary.

---

## 22. Enforcement Checklist

### Privacy Policy
- [ ] Privacy policy is updated within the last 12 months.
- [ ] Categories of PI collected are listed.
- [ ] Sources of PI are disclosed.
- [ ] Business purposes for collection/sale/sharing are stated.
- [ ] Categories of PI sold/shared are disclosed.
- [ ] Retention periods for each PI category are specified.
- [ ] Consumer rights are described with instructions for exercising them.
- [ ] "Do Not Sell or Share My Personal Information" link is on the homepage.
- [ ] "Limit the Use of My Sensitive Personal Information" link is present (if applicable).

### Consumer Request Handling
- [ ] At least two methods for submitting requests (toll-free number + web form for online businesses).
- [ ] Consumer identity verification implemented with proportional rigor.
- [ ] Requests acknowledged and fulfilled within 45 days.
- [ ] Extension process (additional 45 days) documented with consumer notification.
- [ ] Responses provided free of charge.
- [ ] Authorized agent requests are supported.
- [ ] Request metrics are tracked for annual reporting.

### Opt-Out of Sale/Sharing
- [ ] GPC signal detected and honored (Sec-GPC header and navigator.globalPrivacyControl).
- [ ] Opt-out preference recorded persistently.
- [ ] Third-party tracking scripts suppressed for opted-out consumers.
- [ ] Advertising partners notified of opt-out.
- [ ] No re-solicitation for 12 months after opt-out.
- [ ] Minors under 16 require opt-in (under 13 require parental consent).

### Sensitive PI
- [ ] Sensitive PI categories identified and classified.
- [ ] "Limit the Use" mechanism available (if sensitive PI used beyond essential purposes).
- [ ] Usage restriction enforced when consumer exercises right to limit.
- [ ] Sensitive PI handling documented in privacy policy.

### Data Deletion
- [ ] Deletion workflow implemented across all systems containing PI.
- [ ] Exceptions to deletion documented and applied correctly.
- [ ] Service providers notified to delete consumer PI.
- [ ] Deletion completion confirmed and logged.
- [ ] Backups addressed in deletion process (deletion on next rotation or crypto-shredding).

### Service Providers
- [ ] Written contracts with all service providers include required CCPA/CPRA terms.
- [ ] Service providers prohibited from selling/sharing PI.
- [ ] Service providers support consumer request forwarding.
- [ ] Subcontractor engagement restricted and monitored.

### Data Inventory
- [ ] PI inventory maintained with categories, sources, purposes, and retention periods.
- [ ] Inventory updated when new data collection is introduced.
- [ ] Sale and sharing activities tracked by PI category.
- [ ] Annual disclosure metrics calculated and available.

### Technical Controls
- [ ] GPC detection implemented server-side and client-side.
- [ ] Third-party scripts conditionally loaded based on opt-out status.
- [ ] Consumer request management system operational with deadline tracking.
- [ ] Automated data retention enforcement running.
- [ ] Audit logging for all privacy-related actions.
- [ ] Data deletion supports cascade across all systems.
- [ ] PI can be traced to individual consumers for request fulfillment.
