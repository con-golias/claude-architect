---
mode: auto
paths:
  - "src/**/*.ts"
  - "src/**/*.js"
  - "src/**/*.py"
  - "src/**/*.java"
---
## OWASP Top 10 (2025) — Application Security Vulnerabilities

### A01: Broken Access Control
- Deny access by default — every endpoint MUST enforce authorization before processing
- Enforce record-level ownership checks: users MUST NOT access resources by manipulating IDs
- Disable directory listing and ensure metadata/backup files are not served
- Rate-limit API and controller access to minimize automated attack impact
- Invalidate JWT/session tokens server-side on logout — do not rely on client-side expiry alone
- Log every access control failure and alert on repeated violations from a single source

### A02: Security Misconfiguration
- Remove or disable all default accounts, unused features, and sample applications
- Ensure error messages reveal NO stack traces, framework versions, or internal paths
- Disable HTTP methods not explicitly needed (TRACE, OPTIONS where unnecessary)
- Harden all HTTP response headers — review with every deployment
- Automate environment configuration verification in CI — never rely on manual checks
- Disable XML external entity (XXE) processing in all XML parsers

### A03: Software Supply Chain Failures
- Verify package integrity via checksums or signatures before installation
- Use a lockfile — commit it, review changes in every PR
- Monitor dependencies for known CVEs with automated tooling in CI
- NEVER install packages from untrusted registries or unverified publishers
- Pin transitive dependency versions — audit the full dependency tree, not just direct imports

### A04: Cryptographic Failures
- Classify data by sensitivity — apply encryption requirements per classification level
- Encrypt all data in transit (TLS 1.2+ minimum, prefer TLS 1.3)
- Encrypt sensitive data at rest using AES-256 or equivalent
- NEVER use deprecated algorithms: MD5, SHA-1, DES, RC4, ECB mode
- Generate keys using cryptographically secure random sources — never hardcode or derive from weak input
- Disable caching for responses containing sensitive data (Cache-Control: no-store)

### A05: Injection
- Use parameterized queries for ALL database operations — no exceptions
- Apply context-aware output encoding (HTML, JS, URL, CSS, LDAP)
- Use allowlist server-side input validation as a defense-in-depth layer
- For OS commands, avoid shell execution entirely — use language-native APIs with argument arrays
- Sanitize all inputs to NoSQL, LDAP, XPath, and template engines

### A06: Insecure Design
- Use threat modeling (STRIDE) during design phase for security-critical features
- Establish and enforce resource consumption limits (file size, API calls, query cost)
- Design authorization as a layered system — never rely on a single check
- Write abuse-case tests alongside use-case tests (what happens if a user tries to cheat?)
- Separate tenant data by design — never rely solely on query filters for isolation

### A07: Authentication Failures
- Implement credential stuffing defenses: rate limiting, CAPTCHA after failures, breached-password checks
- Require multi-factor authentication for administrative and high-privilege operations
- NEVER ship with default credentials — fail deployment if defaults are detected
- Ensure password recovery flows do not reveal whether an account exists

### A08: Data Integrity Failures
- Verify integrity of all serialized data — NEVER deserialize untrusted input without validation
- Sign and verify JWTs, cookies, and inter-service messages with strong keys
- Validate CI/CD pipeline integrity — restrict who can modify build and deploy scripts
- Use Subresource Integrity (SRI) hashes for all external scripts and stylesheets

### A09: Security Logging and Alerting Failures
- Log all authentication events, access control failures, and input validation failures
- Ensure logs are tamper-evident — write to append-only storage or centralized SIEM
- Establish alerting thresholds for brute-force, enumeration, and scanning patterns
- Include enough context for incident response: userId, IP, action, resource, timestamp

### A10: Mishandling of Exceptional Conditions
- NEVER fail open — if an authorization check throws, deny access by default
- Handle all exception paths explicitly — no empty catch blocks in security-critical code
- Validate error-handling logic with dedicated tests (simulate failures, verify denial)
- Ensure resource cleanup (connections, locks, temp files) in all failure paths
