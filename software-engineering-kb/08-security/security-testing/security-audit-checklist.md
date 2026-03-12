# Security Audit Checklist

## Metadata
- **Category:** Security Testing
- **Scope:** Pre-deployment security reviews, structured audit methodology, compliance verification
- **Audience:** Software engineers, security engineers, QA engineers, engineering managers
- **Prerequisites:** Application security fundamentals, OWASP Top 10 awareness
- **Last Updated:** 2025-01

---

## 1. Overview

A security audit checklist provides a structured, repeatable framework for evaluating
the security posture of an application before deployment. Unlike penetration testing
(which is exploratory), a security audit systematically verifies that specific security
controls are implemented correctly.

This guide organizes checks by category, maps them to the OWASP Application Security
Verification Standard (ASVS), and defines automated vs. manual verification methods.

---

## 2. Authentication Checks

### 2.1 Password Policy

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
Minimum password length >= 12 characters       | V2.1  | Automated
Maximum password length >= 64 characters       | V2.1  | Automated
No composition rules (uppercase, special char) | V2.1  | Automated
  unless required by regulation                |       |
Password checked against breached password     | V2.1  | Automated
  lists (HaveIBeenPwned API or local k-anonymity)|     |
Passwords hashed with bcrypt, scrypt, or       | V2.4  | Code review
  Argon2id (cost factor >= 10 for bcrypt)      |       |
Password change does not allow reuse of        | V2.1  | Manual test
  last 5 passwords                             |       |
Credential recovery uses secure token-based    | V2.5  | Manual test
  reset, not security questions                |       |
Password is not logged in application logs     | V2.2  | Log review
Password is not exposed in API responses       | V2.2  | API test
```

**Verification test for password hashing:**

```python
# Verify password hashing algorithm
import bcrypt

# Check that stored passwords use bcrypt
# Good: $2b$12$... (bcrypt with cost 12)
# Bad:  e10adc3949ba59abbe56e057f20f883e (MD5)
# Bad:  5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8 (SHA-1)

def verify_password_hash(stored_hash):
    """Verify that stored password hash uses an approved algorithm."""
    if stored_hash.startswith('$2b$') or stored_hash.startswith('$2a$'):
        cost = int(stored_hash.split('$')[2])
        assert cost >= 10, f"bcrypt cost factor {cost} is too low (minimum 10)"
        return "PASS: bcrypt with adequate cost factor"
    elif stored_hash.startswith('$argon2'):
        return "PASS: Argon2"
    elif stored_hash.startswith('$scrypt$'):
        return "PASS: scrypt"
    else:
        return f"FAIL: Unknown or weak hash format: {stored_hash[:20]}..."
```

### 2.2 Multi-Factor Authentication (MFA)

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
MFA available for all user accounts            | V2.8  | Manual test
MFA enforced for admin / privileged accounts   | V2.8  | Manual test
TOTP implementation uses 6+ digit codes        | V2.8  | Code review
TOTP codes expire after 30 seconds             | V2.8  | Manual test
TOTP accepts at most 1 adjacent time step      | V2.8  | Manual test
Recovery codes are single-use                  | V2.8  | Manual test
Recovery codes are stored hashed               | V2.8  | Code review
SMS-based MFA is discouraged in favor of TOTP  | V2.8  | Policy review
  or hardware tokens                           |       |
MFA enrollment uses verified channel           | V2.8  | Manual test
MFA cannot be silently disabled by user        | V2.8  | Manual test
  without re-authentication                    |       |
```

### 2.3 Session Management

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
Session tokens generated with CSPRNG           | V3.2  | Code review
Session token length >= 128 bits of entropy    | V3.2  | Code review
Session ID rotated after authentication        | V3.3  | Manual test
Session timeout after 30 minutes of inactivity | V3.3  | Manual test
Absolute session timeout (e.g., 12 hours)      | V3.3  | Automated
Logout invalidates session server-side         | V3.3  | Manual test
Session tokens not in URL parameters           | V3.1  | Automated
Concurrent session control implemented         | V3.7  | Manual test
Session cookies have Secure flag               | V3.4  | Automated
Session cookies have HttpOnly flag             | V3.4  | Automated
Session cookies have SameSite=Lax or Strict    | V3.4  | Automated
```

**Automated session cookie verification:**

```python
import requests

def check_session_cookies(url, login_data):
    """Verify session cookie security attributes."""
    session = requests.Session()
    response = session.post(f"{url}/auth/login", json=login_data)

    results = []
    for cookie in session.cookies:
        if cookie.name.lower() in ('sessionid', 'session', 'sid', 'token'):
            results.append({
                'name': cookie.name,
                'secure': cookie.secure,
                'httponly': cookie.has_nonstandard_attr('HttpOnly'),
                'samesite': cookie.get_nonstandard_attr('SameSite'),
                'path': cookie.path,
                'domain': cookie.domain,
            })

            assert cookie.secure, f"FAIL: {cookie.name} missing Secure flag"
            assert cookie.has_nonstandard_attr('HttpOnly'), \
                f"FAIL: {cookie.name} missing HttpOnly flag"

    return results
```

### 2.4 Token Security (JWT / API Tokens)

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
JWT uses strong algorithm (RS256, ES256)       | V3.5  | Code review
JWT does not use "none" algorithm              | V3.5  | Manual test
JWT secret key is >= 256 bits                  | V3.5  | Code review
JWT expiration (exp) claim is set and enforced | V3.5  | Manual test
JWT expiration is short-lived (15 min - 1 hour)| V3.5  | Code review
Refresh tokens are single-use (rotate on use)  | V3.5  | Manual test
Refresh tokens are stored securely server-side | V3.5  | Code review
API keys can be rotated without downtime       | V3.5  | Manual test
API keys have minimum required permissions     | V1.4  | Policy review
Expired/revoked tokens are rejected            | V3.5  | Manual test
```

**JWT security verification:**

```python
import jwt
import json
import base64

def audit_jwt(token):
    """Audit JWT for common security issues."""
    header = json.loads(
        base64.urlsafe_b64decode(token.split('.')[0] + '==')
    )
    payload = json.loads(
        base64.urlsafe_b64decode(token.split('.')[1] + '==')
    )

    issues = []

    # Check algorithm
    alg = header.get('alg', 'none')
    if alg == 'none':
        issues.append("CRITICAL: Algorithm is 'none' - token is unsigned")
    elif alg in ('HS256', 'HS384', 'HS512'):
        issues.append("WARNING: Symmetric algorithm used - ensure secret is strong")
    elif alg in ('RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'):
        pass  # Asymmetric algorithms are preferred

    # Check expiration
    if 'exp' not in payload:
        issues.append("HIGH: No expiration (exp) claim set")
    else:
        import time
        ttl = payload['exp'] - payload.get('iat', time.time())
        if ttl > 3600:
            issues.append(f"MEDIUM: Token TTL is {ttl/3600:.1f} hours (recommend <= 1 hour)")

    # Check issuer
    if 'iss' not in payload:
        issues.append("LOW: No issuer (iss) claim set")

    # Check audience
    if 'aud' not in payload:
        issues.append("LOW: No audience (aud) claim set")

    return issues
```

---

## 3. Authorization Checks

### 3.1 RBAC / ABAC Verification

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
All endpoints enforce authorization            | V4.1  | Automated
Authorization enforced server-side             | V4.1  | Code review
  (not just client-side hiding)                |       |
Role hierarchy does not allow unintended       | V4.1  | Manual test
  privilege inheritance                        |       |
Principle of least privilege applied           | V4.1  | Policy review
Default deny: unauthenticated requests denied  | V4.1  | Automated
Admin endpoints require admin role             | V4.1  | Automated
Role assignment requires admin approval        | V4.1  | Manual test
Users cannot self-elevate privileges           | V4.2  | Manual test
```

### 3.2 IDOR Testing

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
Object references use indirect references      | V4.2  | Code review
  or UUID (not sequential IDs)                 |       |
Server verifies user owns requested resource   | V4.2  | Manual test
Cross-user data access is blocked              | V4.2  | Automated
```

**IDOR test automation:**

```python
def test_idor(base_url, user_a_token, user_b_token, resource_endpoints):
    """Test for IDOR vulnerabilities across users."""
    import requests

    results = []

    for endpoint_template in resource_endpoints:
        # Get User A's resources
        response_a = requests.get(
            f"{base_url}{endpoint_template.format(user_id='user-a-id')}",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )

        if response_a.status_code != 200:
            continue

        # Try to access User A's resources with User B's token
        response_cross = requests.get(
            f"{base_url}{endpoint_template.format(user_id='user-a-id')}",
            headers={"Authorization": f"Bearer {user_b_token}"}
        )

        if response_cross.status_code == 200:
            results.append({
                'endpoint': endpoint_template,
                'status': 'FAIL - IDOR detected',
                'severity': 'HIGH',
                'detail': 'User B can access User A resources'
            })
        elif response_cross.status_code in (403, 404):
            results.append({
                'endpoint': endpoint_template,
                'status': 'PASS',
            })

    return results

# Usage
endpoints = [
    "/api/users/{user_id}/profile",
    "/api/users/{user_id}/orders",
    "/api/users/{user_id}/documents",
    "/api/users/{user_id}/settings",
]
```

### 3.3 Privilege Escalation Testing

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
Regular user cannot access admin API endpoints | V4.2  | Automated
Regular user cannot modify other users' data   | V4.2  | Manual test
API does not expose admin functionality        | V4.2  | Automated
  through hidden/undocumented endpoints        |       |
Role changes require re-authentication         | V4.2  | Manual test
Vertical escalation: standard user cannot      | V4.2  | Manual test
  perform admin actions                        |       |
Horizontal escalation: user cannot act         | V4.2  | Manual test
  as another user of the same role             |       |
```

---

## 4. Input Validation Checks

### 4.1 Injection Testing

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
All SQL queries use parameterized statements   | V5.3  | SAST + review
No string concatenation in SQL queries         | V5.3  | SAST
ORM used where possible, raw SQL minimized     | V5.3  | Code review
NoSQL queries use safe query builders          | V5.3  | Code review
LDAP queries use parameterized filters         | V5.3  | Code review
OS command execution uses safe APIs            | V5.3  | SAST
  (no shell=True, no string concatenation)     |       |
Template rendering uses auto-escaping          | V5.3  | Code review
XML parsing disables external entities (XXE)   | V5.5  | SAST
GraphQL queries have depth/complexity limits   | V13.4 | Code review
```

**SQL injection test suite:**

```python
SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "' OR '1'='1' --",
    "' UNION SELECT NULL--",
    "1; DROP TABLE users--",
    "' AND 1=1--",
    "' AND 1=2--",
    "admin'--",
    "1' ORDER BY 1--",
    "1' ORDER BY 100--",
    "' WAITFOR DELAY '0:0:5'--",
    "1 AND SLEEP(5)",
]

def test_sql_injection(url, param_name, valid_value, auth_header=None):
    """Test a parameter for SQL injection vulnerabilities."""
    import requests
    import time

    headers = {"Authorization": auth_header} if auth_header else {}
    baseline = requests.get(url, params={param_name: valid_value}, headers=headers)

    results = []
    for payload in SQL_INJECTION_PAYLOADS:
        start = time.time()
        response = requests.get(
            url, params={param_name: payload}, headers=headers
        )
        elapsed = time.time() - start

        indicators = []
        body = response.text.lower()
        if 'sql' in body or 'syntax' in body or 'mysql' in body:
            indicators.append("SQL error in response")
        if 'SLEEP' in payload and elapsed > 4:
            indicators.append(f"Time-based: {elapsed:.1f}s delay")
        if response.status_code == 200 and baseline.status_code == 200:
            if len(response.text) > len(baseline.text) * 2:
                indicators.append("Response size significantly larger")

        if indicators:
            results.append({
                'payload': payload,
                'status_code': response.status_code,
                'indicators': indicators,
                'severity': 'CRITICAL',
            })

    return results
```

### 4.2 XSS Testing

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
Output encoding applied to all user-controlled | V5.3  | SAST
  data rendered in HTML                        |       |
Content-Security-Policy header set             | V14.4 | Automated
CSP disallows inline scripts (no unsafe-inline)| V14.4 | Automated
DOM manipulation uses safe APIs (textContent,  | V5.3  | Code review
  not innerHTML)                               |       |
React/Angular/Vue auto-escaping not bypassed   | V5.3  | SAST
  (no dangerouslySetInnerHTML, [innerHTML],    |       |
  v-html without sanitization)                 |       |
User-uploaded HTML/SVG is sanitized            | V5.3  | Code review
URL parameters reflected in responses are      | V5.3  | DAST
  properly encoded                             |       |
```

### 4.3 File Upload Security

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
File type validated by content (magic bytes),  | V12.1 | Code review
  not just extension                           |       |
File size limits enforced server-side          | V12.1 | Automated
Uploaded files stored outside web root         | V12.1 | Config review
Uploaded files served with Content-Disposition:| V12.1 | Automated
  attachment                                   |       |
Uploaded filenames are sanitized/regenerated   | V12.1 | Code review
Antivirus scanning applied to uploads          | V12.1 | Config review
No executable files accepted unless required   | V12.1 | Code review
Image files re-encoded to strip metadata       | V12.1 | Code review
Zip/archive extraction limits set (zip bomb    | V12.1 | Code review
  protection)                                  |       |
```

---

## 5. Cryptography Checks

### 5.1 Algorithm Strength

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
No use of MD5, SHA-1 for security purposes     | V6.2  | SAST
AES key size >= 128 bits (256 preferred)       | V6.2  | Code review
RSA key size >= 2048 bits (3072+ preferred)    | V6.2  | Code review
ECDSA using P-256 or P-384 curves              | V6.2  | Code review
No use of DES, 3DES, RC4, Blowfish             | V6.2  | SAST
Password hashing uses bcrypt/scrypt/Argon2id   | V6.2  | Code review
Random numbers generated with CSPRNG           | V6.3  | SAST
No hardcoded encryption keys or secrets        | V6.4  | SAST
```

### 5.2 Key Management

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
Encryption keys stored in KMS or HSM           | V6.4  | Config review
Keys are rotatable without downtime            | V6.4  | Manual test
Key rotation schedule defined and followed     | V6.4  | Policy review
Old keys are securely retired after rotation   | V6.4  | Manual test
Separation of encryption keys from encrypted   | V6.4  | Architecture
  data                                         |       | review
Development and production use different keys  | V6.4  | Config review
```

### 5.3 TLS Configuration

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
TLS 1.2 minimum enforced (TLS 1.3 preferred)  | V9.1  | Automated
SSL 2.0, SSL 3.0, TLS 1.0, TLS 1.1 disabled  | V9.1  | Automated
Strong cipher suites only (no NULL, RC4,       | V9.1  | Automated
  DES, export ciphers)                         |       |
HSTS header present with max-age >= 31536000   | V9.1  | Automated
Certificate valid, not self-signed, not expired| V9.1  | Automated
Certificate chain complete                     | V9.1  | Automated
OCSP stapling enabled                         | V9.1  | Automated
```

**TLS audit with testssl.sh:**

```bash
# Install testssl.sh
git clone https://github.com/drwetter/testssl.sh.git

# Run comprehensive TLS audit
./testssl.sh --json --html https://example.com

# Check specific aspects
./testssl.sh --protocols https://example.com
./testssl.sh --ciphers https://example.com
./testssl.sh --headers https://example.com
./testssl.sh --vulnerabilities https://example.com
```

**TLS audit with sslyze:**

```bash
# Install sslyze
pip install sslyze

# Run scan
sslyze example.com --json_out=sslyze-results.json

# Programmatic use
python -c "
from sslyze import Scanner, ServerScanRequest, ServerNetworkLocation
from sslyze.plugins.scan_commands import ScanCommand

server = ServerNetworkLocation('example.com', 443)
scanner = Scanner()
scanner.queue_scans([ServerScanRequest(
    server_location=server,
    scan_commands={
        ScanCommand.SSL_2_0_CIPHER_SUITES,
        ScanCommand.SSL_3_0_CIPHER_SUITES,
        ScanCommand.TLS_1_0_CIPHER_SUITES,
        ScanCommand.TLS_1_1_CIPHER_SUITES,
        ScanCommand.TLS_1_2_CIPHER_SUITES,
        ScanCommand.TLS_1_3_CIPHER_SUITES,
        ScanCommand.CERTIFICATE_INFO,
        ScanCommand.HEARTBLEED,
    }
)])

for result in scanner.get_results():
    print(f'Server: {result.server_location.hostname}')
"
```

---

## 6. API Security Checks

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
All API endpoints require authentication       | V13.1 | Automated
  (except explicitly public endpoints)         |       |
API rate limiting enforced per user/IP         | V13.1 | Automated
API input validation applied to all parameters | V13.2 | DAST
API responses do not expose internal details   | V13.1 | Manual test
  (stack traces, internal IPs, debug info)     |       |
API versioning implemented                     | V13.1 | Manual test
CORS configured to allow only trusted origins  | V13.1 | Automated
GraphQL depth and complexity limits set        | V13.4 | Code review
GraphQL introspection disabled in production   | V13.4 | Automated
API documentation matches actual implementation| V13.1 | Manual test
Batch/bulk endpoints have appropriate limits   | V13.2 | Manual test
Pagination enforced on list endpoints          | V13.2 | Manual test
```

**API security test suite:**

```python
def audit_api_security(base_url, openapi_spec):
    """Automated API security checks."""
    import requests
    import json

    results = []

    # Check unauthenticated access
    for path, methods in openapi_spec['paths'].items():
        for method in methods:
            if method.upper() in ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'):
                url = f"{base_url}{path}"
                response = requests.request(method.upper(), url)
                if response.status_code == 200:
                    results.append({
                        'check': 'Unauthenticated access',
                        'endpoint': f"{method.upper()} {path}",
                        'status': 'FAIL',
                        'detail': f'Returned 200 without auth (expected 401/403)',
                    })

    # Check CORS
    response = requests.options(
        base_url,
        headers={'Origin': 'https://evil.com'}
    )
    acao = response.headers.get('Access-Control-Allow-Origin', '')
    if acao == '*' or acao == 'https://evil.com':
        results.append({
            'check': 'CORS',
            'status': 'FAIL',
            'detail': f'CORS allows arbitrary origin: {acao}',
        })

    # Check rate limiting
    for i in range(110):
        response = requests.get(f"{base_url}/api/health")
        if response.status_code == 429:
            results.append({
                'check': 'Rate limiting',
                'status': 'PASS',
                'detail': f'Rate limited after {i} requests',
            })
            break
    else:
        results.append({
            'check': 'Rate limiting',
            'status': 'FAIL',
            'detail': 'No rate limiting detected after 110 requests',
        })

    return results
```

---

## 7. Infrastructure Checks

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
Security groups follow least privilege         | V14.1 | IaC review
  (no 0.0.0.0/0 on non-public ports)          |       |
Database not publicly accessible               | V14.1 | Config review
Encryption at rest enabled for databases       | V8.1  | Config review
Encryption at rest enabled for object storage  | V8.1  | Config review
Encryption in transit enforced (TLS everywhere)| V9.1  | Automated
Logging enabled for all services               | V7.1  | Config review
Log aggregation configured (CloudWatch,        | V7.1  | Config review
  Datadog, ELK)                                |       |
Audit logging for administrative actions       | V7.1  | Manual test
Container images scanned for vulnerabilities   | V14.2 | Automated
Container runs as non-root user                | V14.2 | Automated
No secrets in environment variables            | V6.4  | Automated
  (use secrets manager)                        |       |
```

**Infrastructure-as-Code security scanning:**

```bash
# Trivy IaC scanning
trivy config --severity HIGH,CRITICAL ./terraform/

# Checkov
pip install checkov
checkov -d ./terraform/ --framework terraform --output json

# tfsec
tfsec ./terraform/ --format json --out tfsec-results.json
```

---

## 8. Dependency Checks

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
No known critical/high CVEs in dependencies    | V14.2 | Automated
All dependencies use lock files                | V14.2 | Automated
SBOM generated and stored with release         | V14.2 | Automated
License compliance verified                    | V14.2 | Automated
Dependencies from trusted registries only      | V14.2 | Config review
Dependency update process defined              | V14.2 | Policy review
```

See the SCA guide for detailed tooling and configuration.

---

## 9. Configuration Checks

```
CHECK                                          | ASVS  | Method
-----------------------------------------------|-------|----------
Debug mode disabled in production              | V14.3 | Automated
Default credentials removed or changed         | V2.1  | Automated
Error handling does not expose stack traces     | V7.4  | Automated
Custom error pages configured (no framework    | V7.4  | Automated
  default error pages)                         |       |
Directory listing disabled                     | V14.3 | Automated
Server version headers removed or generic      | V14.3 | Automated
Admin interfaces not publicly accessible       | V14.3 | Manual test
Feature flags for unreleased features disabled | V14.3 | Config review
  in production                                |       |
HTTPS enforced (HTTP redirects to HTTPS)       | V9.1  | Automated
Database connection uses TLS                   | V9.1  | Config review
```

**Security header verification:**

```python
import requests

REQUIRED_HEADERS = {
    'Strict-Transport-Security': {
        'required': True,
        'expected_contains': 'max-age=31536000',
    },
    'Content-Security-Policy': {
        'required': True,
        'must_not_contain': ["'unsafe-inline'", "'unsafe-eval'"],
    },
    'X-Content-Type-Options': {
        'required': True,
        'expected': 'nosniff',
    },
    'X-Frame-Options': {
        'required': True,
        'expected_one_of': ['DENY', 'SAMEORIGIN'],
    },
    'Referrer-Policy': {
        'required': True,
        'expected_one_of': ['strict-origin-when-cross-origin', 'no-referrer'],
    },
    'Permissions-Policy': {
        'required': True,
    },
    'X-XSS-Protection': {
        'required': False,
        'note': 'Deprecated, CSP is the modern replacement',
    },
}

DISALLOWED_HEADERS = [
    'Server',       # Or ensure it is generic
    'X-Powered-By', # Framework disclosure
    'X-AspNet-Version',
    'X-AspNetMvc-Version',
]

def audit_security_headers(url):
    """Audit HTTP security headers."""
    response = requests.get(url)
    results = []

    for header, config in REQUIRED_HEADERS.items():
        value = response.headers.get(header)
        if not value and config.get('required'):
            results.append({
                'header': header,
                'status': 'FAIL',
                'detail': 'Header missing',
            })
        elif value:
            results.append({
                'header': header,
                'status': 'PASS',
                'value': value,
            })

    for header in DISALLOWED_HEADERS:
        if header in response.headers:
            results.append({
                'header': header,
                'status': 'WARN',
                'detail': f'Information disclosure: {response.headers[header]}',
            })

    return results
```

---

## 10. OWASP ASVS Mapping

The OWASP Application Security Verification Standard (ASVS) v4.0 organizes
security requirements into 14 verification categories at three levels:

```
OWASP ASVS v4.0 Categories:
=============================

V1:  Architecture, Design and Threat Modeling
V2:  Authentication
V3:  Session Management
V4:  Access Control
V5:  Validation, Sanitization and Encoding
V6:  Stored Cryptography
V7:  Error Handling and Logging
V8:  Data Protection
V9:  Communication Security
V10: Malicious Code
V11: Business Logic
V12: Files and Resources
V13: API and Web Services
V14: Configuration

ASVS Levels:
Level 1: Opportunistic - minimum for all applications
Level 2: Standard - for applications handling sensitive data
Level 3: Advanced - for critical applications (finance, healthcare, infrastructure)
```

### 10.1 ASVS Level 1 Minimum Checks (All Applications)

```
V1:  [ ] Threat model created for major components
V2:  [ ] Strong password policy enforced
     [ ] Credential recovery is secure
     [ ] Passwords stored with approved hashing algorithm
V3:  [ ] Session tokens have sufficient entropy
     [ ] Session invalidated on logout
     [ ] Session cookies have Secure, HttpOnly, SameSite flags
V4:  [ ] All data access enforces authorization checks
     [ ] Default deny for unauthenticated requests
V5:  [ ] All input validated server-side
     [ ] Output encoding applied for the correct context
V6:  [ ] No deprecated cryptographic algorithms
     [ ] Random values generated with CSPRNG
V7:  [ ] No sensitive data in error messages or logs
     [ ] Security events are logged
V8:  [ ] Sensitive data classified and handling rules defined
     [ ] No sensitive data in URL parameters
V9:  [ ] TLS 1.2+ enforced for all connections
     [ ] Certificate validation not disabled
V10: [ ] No backdoors, Easter eggs, or debug code in production
V11: [ ] Business logic cannot be bypassed by skipping steps
V12: [ ] File uploads validated and restricted
V13: [ ] All API endpoints require authentication
     [ ] API input validated
V14: [ ] Debug mode disabled in production
     [ ] Default credentials removed
     [ ] Security headers present
```

---

## 11. Security Gates in CI/CD

### 11.1 Quality Gate Configuration

```yaml
# .github/workflows/security-gate.yml
name: Security Quality Gate
on:
  pull_request:
    branches: [main]

jobs:
  security-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Gate 1: SAST
      - name: SAST Scan (Semgrep)
        run: |
          pip install semgrep
          semgrep --config p/security-audit --error --severity ERROR .

      # Gate 2: SCA
      - name: SCA Scan (npm audit)
        run: npm audit --audit-level=high

      # Gate 3: Secrets Scanning
      - name: Secrets Scan (Gitleaks)
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Gate 4: Container Scanning
      - name: Container Scan (Trivy)
        if: hashFiles('Dockerfile') != ''
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

      # Gate 5: IaC Scanning
      - name: IaC Scan (Checkov)
        if: hashFiles('terraform/**') != ''
        run: |
          pip install checkov
          checkov -d ./terraform/ --soft-fail-on LOW,MEDIUM
```

### 11.2 Go / No-Go Criteria

```
DEPLOYMENT GO/NO-GO CRITERIA
==============================

BLOCK DEPLOYMENT (any one blocks):
  [ ] Critical SAST finding (unresolved)
  [ ] Critical/High CVE in dependency (with available fix)
  [ ] Secret detected in code
  [ ] Critical DAST finding (confirmed)
  [ ] Failed authentication or authorization test
  [ ] TLS misconfiguration
  [ ] Debug mode enabled in production config

REQUIRE RISK ACCEPTANCE (documented approval required):
  [ ] High SAST finding with no immediate fix
  [ ] High CVE with no available patch
  [ ] Medium DAST finding in non-critical component
  [ ] Missing security header on internal-only service
  [ ] Known vulnerability with compensating control in place

ALLOW WITH TRACKING (create ticket, assign SLA):
  [ ] Medium SAST/DAST findings
  [ ] Medium CVE in transitive dependency
  [ ] Informational security findings
  [ ] Best practice deviations
```

---

## 12. Automated vs Manual Checks

```
+----------------------------+-----------------------------------+
| Automated Checks           | Manual Checks                     |
+----------------------------+-----------------------------------+
| SAST scanning              | Business logic testing            |
| SCA / dependency scanning  | Authorization model review        |
| Secret scanning            | Threat model validation           |
| Security header verification| Authentication flow analysis     |
| TLS configuration audit    | Architecture security review      |
| Container image scanning   | Code review for complex logic     |
| IaC policy scanning        | IDOR testing (complex cases)      |
| DAST baseline scanning     | Privilege escalation testing      |
| License compliance         | Data flow mapping                 |
| Certificate expiry check   | Incident response verification    |
+----------------------------+-----------------------------------+
```

---

## 13. Best Practices

1. **Organize audit checks by risk category.** Group checks by authentication,
   authorization, input validation, cryptography, and infrastructure. This makes
   it easier to assign ownership and track coverage.

2. **Automate everything that can be automated.** Security headers, TLS
   configuration, dependency scanning, secrets scanning, and SAST can all be
   automated in CI. Reserve manual effort for business logic and architecture
   reviews.

3. **Use OWASP ASVS as the foundation for your checklist.** ASVS provides a
   comprehensive, peer-reviewed security requirements framework. Customize it
   for your application's risk level (Level 1, 2, or 3).

4. **Define clear go/no-go criteria before the audit.** Stakeholders must agree
   in advance on what constitutes a blocking finding versus a tracked finding.
   Changing criteria during the audit undermines trust and consistency.

5. **Run the security audit checklist on every major release.** Do not wait for
   annual audits. Integrate the checklist into the release process so it runs
   before every significant deployment.

6. **Assign owners to each checklist category.** Each category (authentication,
   authorization, cryptography, etc.) should have a designated owner responsible
   for maintaining the checks and addressing findings.

7. **Track audit results over time.** Maintain a historical record of audit
   results to identify trends. Are the same findings recurring? Is the
   overall security posture improving or degrading?

8. **Include infrastructure and configuration in the audit.** Application code
   security is insufficient if the infrastructure is misconfigured. Include
   cloud configuration, network security, and deployment settings.

9. **Validate the audit checklist with penetration testing.** The checklist
   verifies that controls are present. Penetration testing verifies that controls
   actually work. Run both, and use pentest findings to update the checklist.

10. **Update the checklist as threats evolve.** New vulnerability classes,
    framework-specific risks, and regulatory requirements emerge continuously.
    Review and update the checklist at least annually.

---

## 14. Anti-Patterns

1. **Using a generic checklist without customization.** Copy-pasting a checklist
   from the internet without adapting it to your application's technology stack,
   architecture, and risk profile produces irrelevant checks and misses
   application-specific risks.

2. **Treating the checklist as pass/fail with no nuance.** Not all findings are
   equal. A missing `X-Frame-Options` header on an API-only service is not the
   same as a SQL injection vulnerability. Use severity ratings and risk acceptance
   processes.

3. **Running the audit only at the end of the development cycle.** Finding
   security issues right before a deadline creates pressure to suppress findings
   or deploy with known vulnerabilities. Integrate checks throughout the SDLC.

4. **Auditing only the application, not the infrastructure.** A perfectly secure
   application deployed on a misconfigured server is still vulnerable. Include
   infrastructure, deployment, and configuration checks.

5. **Having the development team audit their own code exclusively.** Self-audit
   misses blind spots. Include independent reviewers (security team, external
   auditors, or peer teams) for critical applications.

6. **Relying solely on automated scanning without manual review.** Automated
   tools miss business logic flaws, complex authorization issues, and
   context-dependent vulnerabilities. Manual review is essential for
   high-risk areas.

7. **Not documenting exceptions and risk acceptances.** Waiving a security
   requirement without documentation creates liability and knowledge loss.
   Every exception must be documented with justification, approver, and
   review date.

8. **Abandoning the checklist after the initial audit.** A checklist is only
   valuable if it is used consistently. Embed it into the deployment process
   and CI pipeline so it runs automatically and cannot be skipped.

---

## 15. Enforcement Checklist

```
SECURITY AUDIT ENFORCEMENT CHECKLIST
======================================

Checklist Configuration:
[ ] Security audit checklist customized for application tech stack
[ ] Checks mapped to OWASP ASVS categories
[ ] ASVS level selected (1, 2, or 3) based on application risk
[ ] Severity ratings defined for each check
[ ] Go/no-go criteria documented and approved by stakeholders
[ ] Checklist version-controlled in the repository

Automation:
[ ] Automated checks integrated into CI/CD pipeline
[ ] Security gate blocks deployment on critical findings
[ ] Automated checks cover: SAST, SCA, secrets, headers, TLS
[ ] Results reported in a centralized dashboard
[ ] Automated tests run on every PR and deployment

Manual Reviews:
[ ] Manual checks scheduled for every major release
[ ] Business logic review included in manual audit
[ ] Authorization model review included
[ ] Architecture security review scheduled annually
[ ] Independent reviewer assigned for critical applications

Tracking and Governance:
[ ] Audit results stored and tracked over time
[ ] Findings assigned to owners with SLAs
[ ] Exceptions documented with justification and expiration
[ ] Checklist reviewed and updated at least annually
[ ] Audit results included in security governance meetings
[ ] Pentest findings used to update audit checklist
```
