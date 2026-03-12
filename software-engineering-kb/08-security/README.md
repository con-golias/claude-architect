# Security

Comprehensive software security knowledge base covering secure coding, application security, infrastructure security, compliance, and DevSecOps practices. This section serves as the definitive reference for building secure software in any programming language and framework.

## Contents

### Foundations
Core security principles and methodologies that underpin all security practices.
- [Security Principles](foundations/security-principles.md) — Defense in depth, least privilege, fail-safe defaults, separation of duties
- [Threat Modeling](foundations/threat-modeling.md) — STRIDE, PASTA, DREAD, attack trees, data flow diagrams
- [Security by Design](foundations/security-by-design.md) — OWASP ASVS, secure-by-default, privacy by design
- [Attack Surface Management](foundations/attack-surface-management.md) — Identifying, mapping, and minimizing attack surfaces
- [Risk Assessment](foundations/risk-assessment.md) — CVSS, EPSS, SSVC, vulnerability prioritization

### Secure Coding
Language-agnostic secure coding practices — the core reference for writing secure code.
- [Injection Prevention](secure-coding/injection-prevention.md) — SQL, NoSQL, OS command, LDAP, template, log, SSRF injection
- [Authentication Implementation](secure-coding/authentication-implementation.md) — Password hashing, MFA, brute-force protection, passwordless
- [Access Control](secure-coding/access-control.md) — RBAC, ABAC, PBAC, ReBAC, IDOR prevention
- [Session Management](secure-coding/session-management.md) — Session IDs, cookies, fixation, hijacking, distributed sessions
- [Cryptographic Practices](secure-coding/cryptographic-practices.md) — AES-GCM, RSA, Ed25519, hashing, key derivation, CSPRNG
- [Error Handling and Logging](secure-coding/error-handling-logging.md) — Secure errors, log injection, PII masking, audit logging
- [Data Protection in Code](secure-coding/data-protection-in-code.md) — Memory safety, hardcoded secrets, PII minimization, data masking
- [File Operations Security](secure-coding/file-operations-security.md) — Upload validation, path traversal, archive security, image processing
- [Deserialization Safety](secure-coding/deserialization-safety.md) — pickle, ObjectInputStream, unserialize dangers and safe alternatives
- [Memory Safety](secure-coding/memory-safety.md) — Buffer overflow, use-after-free, safe languages, OS mitigations
- [Concurrency Security](secure-coding/concurrency-security.md) — Race conditions, TOCTOU, distributed locks, thread safety
- [Regex Safety](secure-coding/regex-safety.md) — ReDoS, catastrophic backtracking, safe patterns, RE2

### Web Application Security
Security for web-facing applications.
- [XSS Prevention](web-application-security/xss-prevention.md) — Reflected, stored, DOM-based XSS, output encoding, sanitization
- [CSRF Protection](web-application-security/csrf-protection.md) — Synchronizer tokens, SameSite cookies, double-submit pattern
- [Content Security Policy](web-application-security/content-security-policy.md) — CSP directives, nonces, strict-dynamic, Trusted Types
- [Security Headers](web-application-security/security-headers.md) — HSTS, COOP, COEP, CORP, Permissions-Policy, Referrer-Policy
- [CORS](web-application-security/cors.md) — Same-origin policy, preflight, misconfiguration vulnerabilities
- [SSRF Prevention](web-application-security/ssrf-prevention.md) — URL validation, internal IP blocking, DNS rebinding, IMDSv2
- [Clickjacking Prevention](web-application-security/clickjacking-prevention.md) — frame-ancestors, X-Frame-Options, UI redressing
- [Rate Limiting and DDoS](web-application-security/rate-limiting-ddos.md) — Algorithms, application-layer DDoS, WAF, bot detection

### API Security
Securing REST, GraphQL, gRPC, and WebSocket APIs.
- [API Security Fundamentals](api-security/api-security-fundamentals.md) — OWASP API Security Top 10 2023
- [REST API Security](api-security/rest-api-security.md) — Mass assignment, response filtering, idempotency, API keys
- [GraphQL Security](api-security/graphql-security.md) — Depth limiting, complexity analysis, introspection control
- [gRPC Security](api-security/grpc-security.md) — mTLS, interceptor auth, protobuf validation
- [WebSocket Security](api-security/websocket-security.md) — Origin validation, CSWSH, message authorization
- [API Rate Limiting](api-security/api-rate-limiting.md) — Per-user, tiered, distributed, complexity-based limiting

### Authentication and Identity
Identity management, authentication protocols, and credential security.
- [Password Security](authentication-and-identity/password-security.md) — Argon2id, bcrypt, NIST SP 800-63B, breached password checking
- [MFA Implementation](authentication-and-identity/mfa-implementation.md) — TOTP, WebAuthn, push, SMS risks, backup codes
- [OAuth2 and OpenID Connect](authentication-and-identity/oauth2-openid-connect.md) — Authorization Code + PKCE, token management
- [JWT Security](authentication-and-identity/jwt-security.md) — Algorithm validation, claims verification, key rotation
- [Passkeys and WebAuthn](authentication-and-identity/passkeys-webauthn.md) — FIDO2, registration/authentication ceremonies, conditional UI
- [SAML Security](authentication-and-identity/saml-security.md) — XML signature validation, assertion security, SSO

### Data Security
Protecting data at rest, in transit, and throughout its lifecycle.
- [Encryption at Rest](data-security/encryption-at-rest.md) — AES-256, envelope encryption, TDE, cloud provider encryption
- [Encryption in Transit](data-security/encryption-in-transit.md) — TLS 1.3, certificate management, mTLS, HSTS
- [Key Management](data-security/key-management.md) — Key lifecycle, HSM, cloud KMS, rotation, key hierarchy
- [Secrets Management](data-security/secrets-management.md) — Vault, AWS Secrets Manager, rotation, scanning, leak prevention
- [PII Handling](data-security/pii-handling.md) — Anonymization, pseudonymization, data masking, right to erasure
- [Database Security](data-security/database-security.md) — Least privilege, RLS, audit logging, connection encryption

### Dependency and Supply Chain Security
Securing the software supply chain from dependencies to deployment.
- [Dependency Management](dependency-and-supply-chain/dependency-management.md) — Version pinning, lock files, automated updates, health evaluation
- [Vulnerability Scanning](dependency-and-supply-chain/vulnerability-scanning.md) — SCA tools, CVE databases, reachability analysis
- [Supply Chain Attacks](dependency-and-supply-chain/supply-chain-attacks.md) — Typosquatting, dependency confusion, xz-utils backdoor
- [SBOM](dependency-and-supply-chain/sbom.md) — CycloneDX, SPDX, VEX, generation tools, EO 14028
- [SLSA Framework](dependency-and-supply-chain/slsa-framework.md) — Build provenance, SLSA levels, verification
- [Code Signing](dependency-and-supply-chain/code-signing.md) — Sigstore, Cosign, transparency logs, artifact attestation
- [Container Image Security](dependency-and-supply-chain/container-image-security.md) — Distroless, scanning, signing, admission controllers

### Infrastructure Security
Securing cloud, containers, networks, and deployment infrastructure.
- [Cloud Security](infrastructure-security/cloud-security.md) — Shared responsibility, IAM, AWS/GCP/Azure, CSPM
- [Container Security](infrastructure-security/container-security.md) — Docker hardening, Kubernetes RBAC, Pod Security Standards
- [Network Security](infrastructure-security/network-security.md) — Segmentation, firewalls, service mesh, DNS security
- [Zero Trust](infrastructure-security/zero-trust.md) — NIST SP 800-207, BeyondCorp, microsegmentation, ZTNA
- [IaC Security](infrastructure-security/iac-security.md) — Checkov, tfsec, policy-as-code, drift detection
- [Serverless Security](infrastructure-security/serverless-security.md) — Function permissions, event injection, OWASP Serverless Top 10
- [CI/CD Pipeline Security](infrastructure-security/ci-cd-pipeline-security.md) — Pipeline hardening, OIDC auth, artifact integrity

### Security Testing
Testing methodologies and tools for finding vulnerabilities.
- [SAST](security-testing/sast.md) — Semgrep, CodeQL, SonarQube, custom rules, CI integration
- [DAST](security-testing/dast.md) — OWASP ZAP, Burp Suite, Nuclei, authenticated scanning
- [SCA](security-testing/sca.md) — Snyk, Dependabot, Trivy, license compliance, reachability
- [IAST and RASP](security-testing/iast-rasp.md) — Instrumentation-based testing, runtime protection
- [Penetration Testing](security-testing/penetration-testing.md) — PTES, OWASP WSTG, bug bounty programs
- [Security Audit Checklist](security-testing/security-audit-checklist.md) — Pre-deployment review, ASVS mapping, quality gates
- [Fuzz Testing](security-testing/fuzz-testing.md) — AFL++, libFuzzer, OSS-Fuzz, API fuzzing, cargo-fuzz
- [Secrets Scanning](security-testing/secrets-scanning.md) — Pre-commit hooks, CI scanning, trufflehog, gitleaks

### OWASP and CWE References
Authoritative vulnerability taxonomies and checklists.
- [OWASP Top 10 Web 2025](owasp-references/owasp-top-10-web-2025.md) — A01-A10 with attack scenarios and prevention
- [OWASP API Security Top 10 2023](owasp-references/owasp-top-10-api-2023.md) — API1-API10 with code examples
- [OWASP Top 10 for LLM 2025](owasp-references/owasp-top-10-llm-2025.md) — LLM01-LLM10 AI/ML security risks
- [OWASP Mobile Top 10 2024](owasp-references/owasp-top-10-mobile-2024.md) — M1-M10 mobile security
- [OWASP Kubernetes Top 10](owasp-references/owasp-kubernetes-top-10.md) — K01-K10 container orchestration security
- [CWE Top 25 2025](owasp-references/cwe-top-25-2025.md) — Most dangerous software weaknesses with code fixes

### Compliance
Regulatory frameworks and their technical implementation.
- [GDPR](compliance/gdpr.md) — Data subject rights, privacy by design, breach notification
- [HIPAA](compliance/hipaa.md) — PHI protection, technical safeguards, BAA requirements
- [PCI DSS](compliance/pci-dss.md) — Cardholder data protection, v4.0 requirements, tokenization
- [SOC 2](compliance/soc2.md) — Trust Services Criteria, developer-relevant controls, evidence
- [ISO 27001](compliance/iso27001.md) — ISMS, Annex A controls, certification process
- [NIST Frameworks](compliance/nist-frameworks.md) — CSF 2.0, SSDF, SP 800-53, SP 800-63B
- [CCPA/CPRA](compliance/ccpa-privacy.md) — Consumer rights, opt-out mechanisms, GPC header
- [Regulated Industries](compliance/security-in-regulated-industries.md) — FedRAMP, DORA, NIS2, CMMC

### DevSecOps
Integrating security into development and operations workflows.
- [Shift-Left Security](devsecops/shift-left-security.md) — Early security integration, cost of late fixes
- [Security in CI/CD](devsecops/security-in-ci-cd.md) — Pipeline security tools, quality gates, automation
- [Security Champions](devsecops/security-champions.md) — Program structure, training, scaling security culture
- [Vulnerability Management](devsecops/vulnerability-management.md) — Triage, prioritization, SLAs, remediation workflows
- [Incident Response](devsecops/incident-response.md) — NIST SP 800-61, runbooks, postmortems, containment
- [Security Metrics and KPIs](devsecops/security-metrics-kpis.md) — MTTD, MTTR, vulnerability density, dashboards

### AI Security
Security for AI/ML applications and AI-assisted development.
- [AI-Generated Code Security](ai-security/ai-generated-code-security.md) — Risks, review requirements, secure prompting patterns
- [LLM Application Security](ai-security/llm-application-security.md) — Prompt injection, output validation, excessive agency
- [RAG Security](ai-security/rag-security.md) — Vector/embedding attacks, document-level access control
- [ML Model Security](ai-security/ml-model-security.md) — Model theft, adversarial attacks, data poisoning

### Secure Design Patterns
Reusable security patterns for application design.
- [Secure Defaults](secure-design-patterns/secure-defaults.md) — Deny-by-default, secure framework configurations
- [Authorization Patterns](secure-design-patterns/authorization-patterns.md) — OPA, Casbin, Cedar, Zanzibar/SpiceDB
- [Secure API Design](secure-design-patterns/secure-api-design.md) — Request validation, response filtering, idempotency
- [Secure File Handling](secure-design-patterns/secure-file-handling.md) — Upload patterns, image processing, archive safety
- [Secure Configuration](secure-design-patterns/secure-configuration.md) — Validation at startup, feature flags, drift detection

## How This Section Connects

- **06-backend/** — Implementation-level security (web security middleware, injection prevention code, auth implementation)
- **07-database/** — Database-specific security (access control, encryption, RLS, audit logging)
- **05-frontend/** — Client-side security (CSP implementation, XSS prevention in React/Vue, auth patterns)
- **03-architecture/** — Security in system design (rate limiting architecture, security patterns)

This section provides the **security-first perspective**: why each measure exists, what threats it addresses, which standards require it, and how to implement it correctly across any technology stack.

## Standards and Frameworks Covered

| Standard | Coverage |
|----------|----------|
| OWASP Top 10:2025 | Complete (A01-A10) |
| OWASP API Security Top 10:2023 | Complete (API1-API10) |
| OWASP Top 10 for LLM:2025 | Complete (LLM01-LLM10) |
| OWASP Mobile Top 10:2024 | Complete (M1-M10) |
| OWASP Kubernetes Top 10 | Complete (K01-K10) |
| CWE Top 25:2025 | Complete (all 25 weaknesses) |
| OWASP ASVS 4.0 | Mapped across secure-coding and foundations |
| NIST CSF 2.0 | Covered in compliance/nist-frameworks |
| NIST SSDF (SP 800-218) | Covered in compliance and devsecops |
| NIST SP 800-207 (Zero Trust) | Dedicated guide |
| NIST SP 800-63B (Digital Identity) | Covered in authentication |
| SLSA Framework | Dedicated guide |
| GDPR, HIPAA, PCI DSS, SOC 2, ISO 27001 | Dedicated guides per framework |
| CIS Benchmarks | Referenced in cloud, container, IaC security |
