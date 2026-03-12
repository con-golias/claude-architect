# Penetration Testing

## Metadata
- **Category:** Security Testing
- **Scope:** Manual and assisted security assessment, vulnerability exploitation, reporting
- **Audience:** Software engineers, security engineers, penetration testers, engineering managers
- **Prerequisites:** Web application security fundamentals, networking basics, OWASP Top 10
- **Last Updated:** 2025-01

---

## 1. Penetration Testing Overview

Penetration testing simulates real-world attacks against applications, networks, and
infrastructure to identify exploitable vulnerabilities before adversaries do. Unlike
automated tools (SAST, DAST, SCA), penetration testing leverages human expertise to
find complex business logic flaws, chained vulnerabilities, and attack paths that
automated tools miss.

### 1.1 Types of Penetration Testing

```
+---------------------------------------------------------------------+
| Type       | Knowledge Given         | Simulates                    |
|------------|-------------------------|------------------------------|
| Black-box  | URL/IP only             | External attacker            |
| Gray-box   | URL + credentials +     | Malicious insider or         |
|            | basic documentation     | compromised account          |
| White-box  | Full source code +      | Comprehensive security       |
|            | architecture + docs +   | assessment with maximum      |
|            | credentials             | coverage                     |
+---------------------------------------------------------------------+
```

**Black-box testing:**
- Tester has no prior knowledge of the target
- Simulates an external attacker discovering and exploiting vulnerabilities
- Most realistic but least comprehensive
- Time-intensive due to discovery/reconnaissance phase

**Gray-box testing:**
- Tester has partial knowledge (user credentials, API documentation)
- Simulates an attacker with legitimate account access
- Best balance of realism and coverage
- Most common type for web application testing

**White-box testing:**
- Tester has full access to source code, architecture, and documentation
- Combines manual code review with dynamic testing
- Most comprehensive coverage but least realistic
- Best for critical applications requiring thorough assessment

---

## 2. PTES (Penetration Testing Execution Standard) Phases

### 2.1 Pre-Engagement

Define scope, rules, and expectations before testing begins.

**Scope definition document:**

```
PENETRATION TEST SCOPE DOCUMENT
================================

Client: Acme Corporation
Project: Web Application Security Assessment
Test Period: January 15-31, 2025
Tester(s): Security Team Lead

IN SCOPE:
  - https://app.acme.com (production - read-only testing)
  - https://staging.acme.com (staging - full testing)
  - https://api.acme.com/v2/* (API endpoints)
  - Mobile API endpoints used by iOS/Android apps
  - Authentication and authorization mechanisms
  - Payment processing workflow (staging only)

OUT OF SCOPE:
  - Third-party services (payment gateway, email provider)
  - Social engineering (phishing, vishing)
  - Physical security testing
  - Denial of service testing
  - Infrastructure not owned by Acme Corporation
  - https://legacy.acme.com (scheduled for decommission)

TESTING RESTRICTIONS:
  - No automated scanning of production during business hours (9 AM - 6 PM EST)
  - No data exfiltration of real customer data
  - No modification of production data
  - Stop testing immediately if PII exposure is detected; notify contact
  - Maximum concurrent connections: 50

EMERGENCY CONTACTS:
  - Primary: CTO - Jane Smith - +1-555-0123
  - Secondary: DevOps Lead - Bob Jones - +1-555-0456
  - Escalation: CISO - Alice Brown - +1-555-0789

DELIVERABLES:
  - Executive summary report
  - Technical findings report with reproduction steps
  - Remediation recommendations with priority
  - Retest of critical findings (within 30 days of remediation)
```

**Rules of engagement:**

```
RULES OF ENGAGEMENT
====================

1. Testing window: January 15-31, 2025, 24/7 on staging; weekdays 6PM-9AM on prod
2. Tester will maintain detailed logs of all testing activities
3. Tester will immediately stop and report any of the following:
   - Discovery of child exploitation material
   - Evidence of active compromise by another party
   - Accidental access to classified information
   - System instability or unintended data modification
4. All data collected during testing will be encrypted at rest
5. All data will be destroyed 90 days after final report delivery
6. Tester will not share findings with third parties without written consent
7. Client will provide a "get out of jail free" letter authorizing testing
8. Tester source IPs will be provided and whitelisted in advance
```

### 2.2 Intelligence Gathering (Reconnaissance)

Collect information about the target to identify the attack surface.

**Passive reconnaissance (no direct contact with target):**

```bash
# DNS enumeration
# Amass - comprehensive subdomain enumeration
amass enum -d example.com -o subdomains.txt

# Subfinder - fast subdomain discovery
subfinder -d example.com -all -o subfinder-results.txt

# Combine and deduplicate
cat subdomains.txt subfinder-results.txt | sort -u > all-subdomains.txt

# Certificate transparency logs
curl -s "https://crt.sh/?q=%.example.com&output=json" | \
  jq -r '.[].name_value' | sort -u

# WHOIS lookup
whois example.com

# DNS records
dig example.com ANY
dig example.com MX
dig example.com TXT
dig _dmarc.example.com TXT

# Google dorks
# site:example.com filetype:pdf
# site:example.com inurl:admin
# site:example.com intitle:"index of"
# site:example.com ext:sql | ext:env | ext:log
```

**Active reconnaissance (direct interaction with target):**

```bash
# HTTP probe discovered subdomains
cat all-subdomains.txt | httpx -status-code -title -tech-detect -o live-hosts.txt

# Port scanning with Nmap
nmap -sS -sV -O -p- --min-rate 1000 -oA nmap-full target.example.com

# Service version detection on common web ports
nmap -sV -p 80,443,8080,8443,3000,5000,8000 target.example.com

# Web technology fingerprinting
whatweb https://target.example.com

# Directory and file brute-forcing
gobuster dir -u https://target.example.com \
  -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \
  -x php,asp,aspx,jsp,html,js,json \
  -t 50 -o gobuster-results.txt

# API endpoint discovery
gobuster dir -u https://api.example.com \
  -w /usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt \
  -t 50 -o api-endpoints.txt

# JavaScript file analysis for API endpoints
# Download and grep JS files for API routes
katana -u https://target.example.com -d 3 -jc -ef png,jpg,gif,css | \
  grep "\.js$" > js-files.txt
```

### 2.3 Threat Modeling

Identify likely attack vectors based on reconnaissance findings.

```
THREAT MODEL SUMMARY
====================

Target: Web application with user authentication and payment processing

High-Value Assets:
  1. User credentials database
  2. Payment card information
  3. Admin panel access
  4. API keys and secrets
  5. Customer PII

Likely Attack Vectors:
  1. Authentication bypass (password brute-force, credential stuffing)
  2. Authorization flaws (IDOR, privilege escalation)
  3. Injection attacks (SQL, command, template)
  4. API abuse (rate limiting bypass, parameter manipulation)
  5. Session management flaws (fixation, hijacking)
  6. Business logic flaws (price manipulation, race conditions)

Test Priority (based on threat model):
  P1: Authentication and authorization testing
  P2: Payment flow manipulation testing
  P3: API security testing
  P4: Input validation testing
  P5: Session management testing
```

### 2.4 Vulnerability Analysis

Systematically test for vulnerabilities using both automated tools and manual techniques.

**Automated vulnerability scanning:**

```bash
# Nessus scan (commercial)
nessuscli scan --targets targets.txt \
  --policy "Web Application Tests" \
  --format html \
  --output nessus-report.html

# OpenVAS (open-source alternative)
gvm-cli socket --gmp-username admin --gmp-password pass \
  --xml "<create_target><name>Web App</name><hosts>staging.example.com</hosts></create_target>"

# Nikto web server scan
nikto -h https://staging.example.com -o nikto-report.html -Format htm

# Nuclei vulnerability scan
nuclei -u https://staging.example.com \
  -t nuclei-templates/ \
  -severity critical,high \
  -o nuclei-results.txt
```

**Manual testing with OWASP ZAP:**

```bash
# Start ZAP in daemon mode
zaproxy -daemon -host 127.0.0.1 -port 8080

# Configure browser to proxy through ZAP
# Browse the application manually
# ZAP passively records all traffic and identifies issues

# Export findings
zap-cli report -o zap-manual-report.html -f html
```

**Manual testing with Burp Suite:**

```
Burp Suite workflow:
1. Configure browser to proxy through Burp (127.0.0.1:8080)
2. Browse the application to build site map
3. Use Repeater to craft and resend modified requests
4. Use Intruder for parameter fuzzing
5. Use Comparer to identify response differences
6. Use Decoder for encoding/decoding payloads
```

### 2.5 Exploitation

Attempt to exploit discovered vulnerabilities to demonstrate real-world impact.

**SQL injection exploitation:**

```bash
# SQLMap - automated SQL injection detection and exploitation
sqlmap -u "https://staging.example.com/search?q=test" \
  --batch \
  --level=3 \
  --risk=2 \
  --threads=5 \
  --output-dir=sqlmap-results

# With authentication
sqlmap -u "https://staging.example.com/api/users?id=1" \
  --cookie="session=abc123" \
  --headers="Authorization: Bearer eyJ..." \
  --batch \
  --dbs
```

**XSS testing:**

```bash
# Manual XSS payloads to test
# Reflected XSS
<script>alert(document.domain)</script>
<img src=x onerror=alert(document.domain)>
<svg onload=alert(document.domain)>
"><script>alert(document.domain)</script>

# DOM-based XSS
javascript:alert(document.domain)
#<script>alert(document.domain)</script>

# Filter bypass techniques
<img src=x onerror=alert&#40;1&#41;>
<svg/onload=alert(1)>
<script>alert(String.fromCharCode(88,83,83))</script>
```

**IDOR (Insecure Direct Object Reference) testing:**

```bash
# Test horizontal privilege escalation
# User A's session accessing User B's resources

# Get User A's profile (authorized)
curl -H "Authorization: Bearer USER_A_TOKEN" \
  https://staging.example.com/api/users/123/profile

# Try to access User B's profile with User A's token
curl -H "Authorization: Bearer USER_A_TOKEN" \
  https://staging.example.com/api/users/456/profile
# If 200 OK with User B's data --> IDOR vulnerability

# Test vertical privilege escalation
# Regular user accessing admin endpoints
curl -H "Authorization: Bearer REGULAR_USER_TOKEN" \
  https://staging.example.com/api/admin/users
# If 200 OK --> Privilege escalation vulnerability
```

**Authentication testing:**

```bash
# Password brute-force (with rate limiting check)
hydra -l admin@example.com -P /usr/share/wordlists/rockyou.txt \
  https-post-form "staging.example.com/api/auth/login:username=^USER^&password=^PASS^:Invalid credentials" \
  -t 4 -w 5

# JWT testing
# Decode JWT
echo "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiam9obiJ9.xxx" | \
  cut -d. -f2 | base64 -d

# Test algorithm confusion (none algorithm)
# Change header to {"alg":"none"} and remove signature

# Test weak secret
hashcat -a 0 -m 16500 jwt.txt /usr/share/wordlists/rockyou.txt
```

### 2.6 Post-Exploitation

After gaining access, assess the real impact and what an attacker could achieve.

```
Post-exploitation objectives:
1. Determine data access scope
   - What sensitive data is accessible?
   - Can PII, credentials, or financial data be reached?

2. Assess lateral movement potential
   - Can compromised access lead to other systems?
   - Are internal APIs accessible?
   - Are database credentials reused?

3. Evaluate persistence opportunities
   - Can an attacker maintain access after detection?
   - Are there backup admin accounts?
   - Can scheduled tasks be modified?

4. Document business impact
   - Financial impact of data breach
   - Regulatory implications (GDPR, PCI-DSS, HIPAA)
   - Reputational damage potential
```

### 2.7 Reporting

The report is the primary deliverable. It must be actionable for both executives
and technical teams.

---

## 3. OWASP Web Security Testing Guide (WSTG) Methodology

The OWASP WSTG provides a structured testing methodology organized by category.

```
OWASP WSTG Testing Categories:
================================

WSTG-INFO: Information Gathering
  - Fingerprint web server
  - Review web server metafiles (robots.txt, sitemap.xml)
  - Enumerate application entry points
  - Map application architecture

WSTG-CONF: Configuration and Deployment Management
  - Test network/infrastructure configuration
  - Test application platform configuration
  - Test file extension handling
  - Review old backup and unreferenced files
  - HTTP methods testing
  - HTTP Strict Transport Security
  - Content Security Policy

WSTG-IDNT: Identity Management
  - Test role definitions
  - Test user registration process
  - Test account provisioning
  - Test account enumeration
  - Test weak username policy

WSTG-ATHN: Authentication Testing
  - Test credentials over encrypted channel
  - Test default credentials
  - Test weak lockout mechanism
  - Test authentication bypass
  - Test remember password functionality
  - Test browser cache weakness
  - Test weak password policy
  - Test MFA bypass

WSTG-ATHZ: Authorization Testing
  - Test directory traversal / file inclusion
  - Test authorization bypass
  - Test privilege escalation
  - Test insecure direct object references (IDOR)

WSTG-SESS: Session Management Testing
  - Test session management schema
  - Test cookie attributes
  - Test session fixation
  - Test CSRF
  - Test logout functionality
  - Test session timeout
  - Test session hijacking

WSTG-INPV: Input Validation Testing
  - Test reflected XSS
  - Test stored XSS
  - Test HTTP verb tampering
  - Test SQL injection
  - Test LDAP injection
  - Test XML injection
  - Test SSI injection
  - Test XPath injection
  - Test IMAP/SMTP injection
  - Test code injection
  - Test OS command injection
  - Test server-side template injection (SSTI)
  - Test server-side request forgery (SSRF)

WSTG-ERRH: Error Handling
  - Test improper error handling
  - Test stack traces

WSTG-CRYP: Cryptography
  - Test weak TLS/SSL
  - Test padding oracle
  - Test sensitive data sent via unencrypted channels
  - Test weak encryption

WSTG-BUSL: Business Logic Testing
  - Test business logic data validation
  - Test ability to forge requests
  - Test integrity checks
  - Test process timing
  - Test number of times a function can be used (limits)
  - Test circumvention of workflows
  - Test defenses against application misuse
  - Test upload of unexpected file types
  - Test upload of malicious files

WSTG-CLNT: Client-Side Testing
  - Test DOM-based XSS
  - Test JavaScript execution
  - Test HTML injection
  - Test client-side URL redirect
  - Test CSS injection
  - Test client-side resource manipulation
  - Test Cross-Origin Resource Sharing (CORS)
  - Test clickjacking
  - Test WebSockets
  - Test web messaging
  - Test browser storage
```

---

## 4. Penetration Test Reporting

### 4.1 Report Structure

```
PENETRATION TEST REPORT
========================

1. EXECUTIVE SUMMARY (1-2 pages)
   - Testing scope and objectives
   - Testing timeframe
   - Overall risk rating (Critical / High / Medium / Low)
   - Key findings summary (top 3-5)
   - Strategic recommendations

2. METHODOLOGY
   - Testing approach (black-box / gray-box / white-box)
   - Tools used
   - Standards followed (OWASP WSTG, PTES)

3. FINDINGS SUMMARY TABLE
   +----+---------------------------+----------+----------+--------+
   | #  | Finding                   | Severity | CVSS     | Status |
   +----+---------------------------+----------+----------+--------+
   | 1  | SQL Injection in search   | Critical | 9.8      | Open   |
   | 2  | IDOR on user profiles     | High     | 7.5      | Open   |
   | 3  | Weak password policy      | Medium   | 5.3      | Open   |
   | 4  | Missing CSP header        | Low      | 3.1      | Open   |
   +----+---------------------------+----------+----------+--------+

4. DETAILED FINDINGS (per finding)
   - Title
   - Severity and CVSS score
   - Affected component (URL, parameter, endpoint)
   - Description of the vulnerability
   - Steps to reproduce (detailed, numbered)
   - Evidence (screenshots, HTTP requests/responses)
   - Business impact
   - Remediation recommendation
   - References (CWE, OWASP, CVE)

5. APPENDICES
   - Full list of tested endpoints
   - Tools and versions used
   - Tester credentials (hashed)
   - Raw scan outputs (optional)
```

### 4.2 Individual Finding Template

```markdown
## Finding #1: SQL Injection in Product Search

**Severity:** Critical
**CVSS 3.1 Score:** 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
**CWE:** CWE-89: SQL Injection
**OWASP:** A03:2021 - Injection
**Status:** Open

### Description
The product search endpoint at `/api/products/search` is vulnerable to SQL
injection through the `q` parameter. User-supplied input is concatenated
directly into a SQL query without parameterization or input validation.

### Affected Component
- **URL:** `https://staging.example.com/api/products/search?q=test`
- **Parameter:** `q` (GET parameter)
- **Method:** GET

### Steps to Reproduce
1. Navigate to `https://staging.example.com/search`
2. Enter the following in the search field: `' OR 1=1 --`
3. Observe that all products are returned (not just matching products)
4. Alternatively, use the following curl command:
   ```
   curl "https://staging.example.com/api/products/search?q=%27%20OR%201%3D1%20--"
   ```
5. The response contains all 1,247 products instead of 0

### Evidence
[Screenshot of request/response]
[HTTP request/response pair from Burp Suite]

### Business Impact
An attacker can:
- Extract the entire database contents (customer PII, credentials)
- Modify or delete data
- Potentially execute operating system commands (depending on DB privileges)
- Bypass authentication entirely

### Remediation
1. Use parameterized queries (prepared statements) for all database operations
2. Implement input validation for the search parameter
3. Apply principle of least privilege to the database user

### References
- https://cwe.mitre.org/data/definitions/89.html
- https://owasp.org/Top10/A03_2021-Injection/
- https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
```

### 4.3 Severity Rating Framework

```
SEVERITY RATING CRITERIA
=========================

CRITICAL (CVSS 9.0-10.0):
  - Remote code execution
  - SQL injection with data extraction capability
  - Authentication bypass affecting all users
  - Unrestricted file upload leading to RCE
  - Exposure of sensitive credentials or secrets

HIGH (CVSS 7.0-8.9):
  - Stored XSS affecting multiple users
  - IDOR exposing sensitive PII
  - Privilege escalation (horizontal or vertical)
  - SSRF with internal network access
  - Insecure deserialization

MEDIUM (CVSS 4.0-6.9):
  - Reflected XSS requiring user interaction
  - CSRF on sensitive operations
  - Missing rate limiting on authentication
  - Information disclosure (stack traces, version info)
  - Weak cryptographic algorithms

LOW (CVSS 0.1-3.9):
  - Missing security headers (non-critical)
  - Verbose error messages
  - Directory listing enabled
  - Cookie missing flags (HttpOnly, Secure)
  - Self-XSS (affects only the attacker's session)

INFORMATIONAL:
  - Best practice deviations
  - Minor configuration suggestions
  - Notes for future security improvements
```

---

## 5. Bug Bounty Programs

### 5.1 When to Use Bug Bounty Programs

```
Bug bounty programs complement (not replace) internal security testing.
Use them when:
  - Your application has a large, complex attack surface
  - You want continuous testing beyond periodic pentests
  - You want diverse perspectives from global security researchers
  - Your application is internet-facing and widely used
  - You want to demonstrate commitment to security

Do NOT use bug bounty as:
  - A replacement for internal security testing
  - The primary method for finding vulnerabilities in pre-launch software
  - A substitute for security architecture and design
```

### 5.2 Bug Bounty Platforms

```
Platform     | Key Features                        | Best For
-------------|-------------------------------------|------------------
HackerOne    | Largest community, managed programs, | Enterprise, large
             | triage services, compliance          | attack surfaces
Bugcrowd     | Strong triage, skills-based matching | Mid-market, API-
             | curated programs                     | focused programs
Intigriti    | European focus, strong researcher    | EU companies,
             | community, GDPR-aware                | GDPR compliance
```

### 5.3 Bug Bounty Scope Definition

```markdown
## Bug Bounty Program Scope

### In Scope
| Asset              | Type           | Severity Range   |
|--------------------|----------------|------------------|
| app.example.com    | Web Application| Critical - Low   |
| api.example.com    | API            | Critical - Low   |
| *.example.com      | Wildcard       | Critical - Medium|
| iOS App            | Mobile         | Critical - Low   |
| Android App        | Mobile         | Critical - Low   |

### Out of Scope
- Social engineering attacks
- Physical attacks
- Denial of service
- Attacks against employees or offices
- Third-party services (AWS, Stripe, SendGrid)
- Reports from automated scanners without manual verification
- Theoretical vulnerabilities without proof of concept

### Reward Table
| Severity  | Reward Range   |
|-----------|----------------|
| Critical  | $5,000-$20,000 |
| High      | $2,000-$5,000  |
| Medium    | $500-$2,000    |
| Low       | $100-$500      |

### Safe Harbor
We will not pursue legal action against researchers who:
- Act in good faith and follow this policy
- Report findings to us before public disclosure
- Do not access or modify other users' data
- Do not degrade our services
- Give us reasonable time to address findings before disclosure
```

---

## 6. Compliance-Driven Penetration Testing

### 6.1 PCI-DSS Requirement 11.3

```
PCI-DSS 4.0 Requirements for Penetration Testing:
  - External penetration test at least annually
  - Internal penetration test at least annually
  - After any significant infrastructure or application change
  - Performed by qualified internal or external personnel
  - Must test network-layer and application-layer vulnerabilities
  - Must test both inside and outside the CDE (Cardholder Data Environment)
  - Critical and high findings must be remediated and retested
  - Segmentation controls must be tested every 6 months
```

### 6.2 SOC 2

```
SOC 2 Penetration Testing Expectations:
  - Annual penetration testing is a common control
  - Tests should cover the trust service criteria in scope
  - Results must be documented and tracked
  - Critical findings must be remediated within defined SLAs
  - Evidence of remediation must be available for auditors
  - Testing methodology should be documented
```

---

## 7. Purple Teaming

Purple teaming combines offensive (red team) and defensive (blue team) capabilities
in a collaborative exercise.

```
Red Team Activities:              Blue Team Activities:
- Reconnaissance                  - Detection of recon activity
- Vulnerability exploitation      - Alert triage and analysis
- Lateral movement                - Incident response
- Data exfiltration               - Forensic investigation
- Persistence                     - Containment and eradication

Purple Team Collaboration:
1. Red team attempts attack technique (e.g., SQL injection)
2. Blue team attempts to detect the attack
3. If detected: Document detection mechanism, refine alerting
4. If NOT detected: Improve detection rules, add monitoring
5. Repeat with next technique from MITRE ATT&CK framework
```

---

## 8. Remediation Verification (Retesting)

```
Retesting workflow:
1. Vulnerability reported and remediated by development team
2. Development team notifies security team: "Fix deployed to staging"
3. Security team retests using original reproduction steps
4. Results:
   a. FIXED: Vulnerability no longer exploitable. Close finding.
   b. PARTIALLY FIXED: Some attack vectors blocked, others remain. Reopen.
   c. NOT FIXED: Original exploit still works. Reopen with updated notes.
   d. REGRESSED: Fix introduced a new vulnerability. Report new finding.
5. Document retesting results in the original finding
6. Verify fix in production after deployment
```

---

## 9. Frequency Recommendations

```
Testing Type               | Frequency            | Trigger
---------------------------|----------------------|---------------------------
External penetration test  | Annually minimum     | Compliance, major releases
Internal penetration test  | Annually minimum     | Compliance
Web application pentest    | Annually + on change | Major feature releases
API security assessment    | Annually + on change | New API versions
Mobile app assessment      | Annually + on change | Major app updates
Cloud infrastructure       | Annually             | Major architecture changes
Red team exercise          | Annually             | Mature security programs
Bug bounty program         | Continuous           | Ongoing
Vulnerability scanning     | Weekly-monthly       | Continuous
DAST (automated)           | Per deployment       | CI/CD integration
```

---

## 10. Best Practices

1. **Define clear scope and rules of engagement before testing.** Ambiguous scope
   leads to missed areas, legal issues, or unnecessary disruptions. Document every
   target, restriction, and emergency contact in writing before testing begins.

2. **Use gray-box testing for the best coverage-to-cost ratio.** Providing testers
   with user credentials and API documentation eliminates time wasted on
   reconnaissance and ensures thorough testing of authenticated functionality.

3. **Follow a structured methodology (OWASP WSTG or PTES).** Ad-hoc testing misses
   vulnerability categories. Use a comprehensive checklist to ensure systematic
   coverage of all attack vectors.

4. **Require detailed reproduction steps in every finding.** Findings without
   reproduction steps cannot be verified, prioritized, or fixed efficiently.
   Include exact URLs, parameters, HTTP requests, and screenshots.

5. **Test business logic, not just technical vulnerabilities.** Automated tools
   find SQL injection and XSS. Human testers add value by testing business logic
   flaws: price manipulation, workflow bypass, race conditions, and abuse scenarios
   unique to the application.

6. **Perform retesting after remediation.** A finding is not closed until the fix
   is verified through retesting. Schedule retesting within 30 days of remediation
   to confirm the vulnerability is resolved without introducing regressions.

7. **Treat the penetration test report as an actionable remediation plan.** Every
   finding should include specific, prioritized remediation guidance that
   developers can implement. Generic advice like "fix the vulnerability" is
   insufficient.

8. **Combine periodic pentests with continuous automated testing.** Annual
   penetration tests provide deep analysis but leave gaps between tests. DAST,
   SAST, and SCA in CI/CD provide continuous coverage between pentests.

9. **Use bug bounty programs to supplement internal testing.** Bug bounties provide
   continuous testing from diverse perspectives. They are most effective after
   internal testing has addressed known issues, so bounty hunters find novel
   vulnerabilities rather than known problems.

10. **Include remediation verification in the pentest contract.** The initial test
    finds vulnerabilities; the retest verifies they are fixed. Both phases should
    be included in the engagement scope and budget from the start.

---

## 11. Anti-Patterns

1. **Treating penetration testing as a checkbox exercise.** Running a pentest solely
   to satisfy compliance requirements, without intention to act on findings, wastes
   resources and provides a false sense of security.

2. **Relying solely on automated scanning tools and calling it a pentest.** Running
   Nessus or ZAP is vulnerability scanning, not penetration testing. True
   penetration testing requires skilled human analysis, manual exploitation, and
   business logic testing.

3. **Testing only in production.** Production testing limits the types of tests that
   can be safely performed. Use staging environments that mirror production for
   thorough, unrestricted testing.

4. **Ignoring findings because "we will fix them later."** Penetration test findings
   that remain unaddressed accumulate and compound. Define SLAs for remediation
   by severity and track progress.

5. **Selecting the cheapest vendor without evaluating quality.** Low-cost penetration
   tests often use automated scanning with minimal manual analysis. Evaluate
   vendor qualifications, methodology, sample reports, and references.

6. **Not providing testers with enough access for gray-box testing.** Withholding
   documentation or credentials from testers in gray-box or white-box engagements
   reduces coverage and wastes time on information gathering that could be spent
   on vulnerability analysis.

7. **Testing once and never again.** A single penetration test captures a snapshot
   in time. New vulnerabilities are introduced with every code change. Establish
   a regular testing cadence (annually at minimum) supplemented by automated
   continuous testing.

8. **Failing to communicate findings to development teams.** Reports that sit in
   a security team's inbox provide no value. Present findings to development
   teams with context, remediation guidance, and prioritization. Schedule
   remediation in sprint planning.

---

## 12. Enforcement Checklist

```
PENETRATION TESTING ENFORCEMENT CHECKLIST
==========================================

Pre-Engagement:
[ ] Scope document reviewed and approved by all stakeholders
[ ] Rules of engagement signed by both parties
[ ] Emergency contacts identified and communicated
[ ] Authorization letter / "get out of jail free" document signed
[ ] Staging environment prepared and verified
[ ] Test accounts provisioned with appropriate access levels
[ ] Testing window communicated to operations team

During Testing:
[ ] Tester maintains detailed activity logs
[ ] Tester follows agreed scope and rules of engagement
[ ] Critical findings communicated immediately (not just in final report)
[ ] Operations team monitors for service impact
[ ] Testing stops immediately if unauthorized data access occurs

Reporting:
[ ] Executive summary suitable for leadership review
[ ] Technical findings include reproduction steps and evidence
[ ] Each finding includes severity rating (CVSS)
[ ] Each finding includes remediation recommendations
[ ] Findings mapped to CWE and OWASP categories
[ ] Report delivered within agreed timeframe (typically 5-10 business days)

Post-Test:
[ ] Findings reviewed with development and security teams
[ ] Remediation plan created with assigned owners and deadlines
[ ] SLAs applied per severity (Critical: 7 days, High: 30 days, etc.)
[ ] Retest scheduled within 30 days of remediation
[ ] Test artifacts (data, credentials) securely destroyed
[ ] Lessons learned documented for future testing cycles

Compliance:
[ ] Testing frequency meets regulatory requirements (PCI, SOC 2)
[ ] Testing covers all required scopes (network, application, internal)
[ ] Results documented for audit evidence
[ ] Remediation evidence preserved for auditor review
[ ] Segmentation testing performed per PCI-DSS 11.3.4 (if applicable)

Program Maturity:
[ ] Annual penetration testing cadence established
[ ] Bug bounty program evaluated or implemented
[ ] Purple team exercises conducted annually (mature programs)
[ ] Penetration testing findings trend over time (improving or degrading)
[ ] Pentest budget allocated in annual security budget
```
