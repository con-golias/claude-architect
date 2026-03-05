---
mode: auto
---
## Data Privacy & GDPR Compliance

### Data Classification
- Classify ALL stored data into tiers: Public, Internal, Confidential, Restricted
- Restricted data (PII, health, financial): requires encryption at rest, access logging, retention limits
- Maintain a living data inventory documenting: what data, where stored, why collected, retention period
- Review classification on every schema change — new columns MUST be classified before deployment

### PII Handling
- Collect ONLY the minimum PII required for the stated purpose — never "just in case"
- Store PII in dedicated, access-controlled tables — never mixed with general application data
- Pseudonymize PII in non-production environments — never use real user data for testing
- Encrypt PII fields at rest using application-level encryption (not just disk-level)
- Restrict PII access to services and roles with explicit business justification

### Consent Management
- Record explicit consent with: purpose, timestamp, method, version of privacy policy
- Consent MUST be granular — separate toggles for marketing, analytics, third-party sharing
- Users MUST be able to withdraw consent as easily as they granted it
- NEVER pre-check consent boxes — consent must be an affirmative opt-in action
- Re-obtain consent when processing purposes change materially

### Right to Access & Deletion (DSAR)
- Implement a data export endpoint: returns ALL user data in machine-readable format (JSON/CSV)
- Implement a deletion endpoint: removes or anonymizes ALL user PII across all stores
- Deletion MUST cascade to: backups (mark for expiry), logs (redact), analytics (anonymize), third parties (notify)
- Process access/deletion requests within 30 days — track requests with audit trail
- Verify requester identity before processing any data subject request

### Data Retention
- Define explicit retention periods for every data category — document in data inventory
- Implement automated purge jobs for expired data — never rely on manual cleanup
- Retain data ONLY as long as legally required or necessary for stated purpose
- Audit logs: retain minimum 1 year, maximum per legal requirement
- After retention period: delete or irreversibly anonymize — truncation is not anonymization

### Data Masking & Logging
- NEVER log raw PII — mask emails (j***@example.com), phone numbers, addresses
- Mask PII in error messages, stack traces, and exception details
- Redact sensitive fields from API responses unless explicitly requested by authorized caller
- Log access to PII fields — who accessed what, when, and from which service

### Data Transfers
- Document all third-party processors and their data handling commitments
- For cross-border transfers: verify adequate legal basis (SCCs, adequacy decisions)
- Encrypt PII in transit between services — even within internal networks
- Include data processing terms in all vendor contracts involving user data

### Privacy by Design
- Run a Data Protection Impact Assessment (DPIA) for features processing sensitive data at scale
- Default to most privacy-protective settings — do not require users to opt out
- Design features so they function with minimal data — degrade gracefully when users limit data sharing
- Include privacy review as a gate in the PR/design review process for user-facing features
