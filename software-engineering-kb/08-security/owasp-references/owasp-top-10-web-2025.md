# OWASP Top 10:2025 -- Comprehensive Reference Guide

## Metadata

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| Title            | OWASP Top 10:2025 Web Application Security Risks  |
| Version          | 2025 (Latest)                                      |
| Previous         | 2021                                               |
| Audience         | Developers, Security Engineers, Architects         |
| Languages        | TypeScript, Go, Python                             |
| Last Updated     | 2025                                               |

## Overview

The OWASP Top 10 is the most widely recognized awareness document for web application security. The 2025 edition introduces significant changes from the 2021 version, reflecting the evolving threat landscape including supply chain attacks, AI-related risks, and improved understanding of misconfigurations.

### Key Changes from 2021 to 2025

| 2025 Rank | 2025 Category                              | 2021 Equivalent                                | Change                  |
| --------- | ------------------------------------------ | ---------------------------------------------- | ----------------------- |
| A01       | Broken Access Control                      | A01:2021 Broken Access Control                 | Unchanged at #1         |
| A02       | Security Misconfiguration                  | A05:2021 Security Misconfiguration             | Moved up from #5        |
| A03       | Software Supply Chain Failures             | A06:2021 Vulnerable and Outdated Components    | NEW scope, renamed      |
| A04       | Cryptographic Failures                     | A02:2021 Cryptographic Failures                | Moved down from #2      |
| A05       | Injection                                  | A03:2021 Injection                             | Moved down from #3      |
| A06       | Insecure Design                            | A04:2021 Insecure Design                       | Same category           |
| A07       | Authentication Failures                    | A07:2021 Identification and Auth Failures      | Renamed                 |
| A08       | Software and Data Integrity Failures       | A08:2021 Software and Data Integrity Failures  | Same area               |
| A09       | Security Logging and Alerting Failures     | A09:2021 Security Logging and Monitoring       | Renamed                 |
| A10       | Mishandling of Exceptional Conditions      | NEW                                            | NEW category            |

---

## A01:2025 -- Broken Access Control

### Description

Broken Access Control occurs when the application fails to enforce restrictions on what authenticated users are allowed to do. Attackers exploit these flaws to access unauthorized functionality or data, including viewing other users' accounts, modifying records, or escalating privileges. This category has remained at #1 since 2021 due to its pervasive nature.

### Why It Stayed at #1

Access control weaknesses remain the most common and damaging vulnerability class. The shift to API-driven architectures has increased the attack surface as every endpoint becomes a potential access control enforcement point.

### Relevant CWEs

- CWE-200: Exposure of Sensitive Information
- CWE-201: Insertion of Sensitive Information Into Sent Data
- CWE-352: Cross-Site Request Forgery
- CWE-639: Authorization Bypass Through User-Controlled Key
- CWE-862: Missing Authorization
- CWE-863: Incorrect Authorization

### Attack Scenario

An attacker modifies the URL parameter from `/api/users/123/profile` to `/api/users/456/profile` and gains access to another user's profile data. The application checks authentication but never verifies that user 123 is authorized to view user 456's data.

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: No authorization check on resource ownership
app.get('/api/users/:userId/profile', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  // Only checks if user is authenticated, not if they own this resource
  const profile = await db.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
  res.json(profile.rows[0]);
});
```

### Secure Code -- TypeScript

```typescript
// SECURE: Verify resource ownership
app.get('/api/users/:userId/profile', authenticateToken, async (req, res) => {
  const requestedUserId = req.params.userId;
  const authenticatedUserId = req.user.id;

  // Enforce object-level authorization
  if (requestedUserId !== authenticatedUserId && !req.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const profile = await db.query('SELECT * FROM profiles WHERE user_id = $1', [requestedUserId]);
  if (!profile.rows[0]) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  res.json(profile.rows[0]);
});
```

### Vulnerable Code -- Go

```go
// VULNERABLE: Direct object reference without authorization
func GetUserProfile(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "userID")
    profile, err := db.GetProfile(userID)
    if err != nil {
        http.Error(w, "Not found", http.StatusNotFound)
        return
    }
    json.NewEncoder(w).Encode(profile)
}
```

### Secure Code -- Go

```go
// SECURE: Enforce ownership check
func GetUserProfile(w http.ResponseWriter, r *http.Request) {
    requestedUserID := chi.URLParam(r, "userID")
    authenticatedUser := r.Context().Value("user").(*User)

    if requestedUserID != authenticatedUser.ID && !authenticatedUser.HasRole("admin") {
        http.Error(w, "Forbidden", http.StatusForbidden)
        return
    }

    profile, err := db.GetProfile(requestedUserID)
    if err != nil {
        http.Error(w, "Not found", http.StatusNotFound)
        return
    }
    json.NewEncoder(w).Encode(profile)
}
```

### Vulnerable Code -- Python

```python
# VULNERABLE: No authorization check
@app.route('/api/users/<user_id>/profile')
@login_required
def get_profile(user_id):
    profile = db.session.query(Profile).filter_by(user_id=user_id).first()
    return jsonify(profile.to_dict())
```

### Secure Code -- Python

```python
# SECURE: Verify resource ownership
@app.route('/api/users/<user_id>/profile')
@login_required
def get_profile(user_id):
    if str(current_user.id) != user_id and not current_user.has_role('admin'):
        abort(403)
    profile = db.session.query(Profile).filter_by(user_id=user_id).first_or_404()
    return jsonify(profile.to_dict())
```

### Prevention Checklist

- [ ] Deny access by default except for public resources
- [ ] Implement access control mechanisms once and reuse across the application
- [ ] Enforce record ownership rather than accepting user-supplied IDs
- [ ] Disable web server directory listing and remove metadata files from web roots
- [ ] Log access control failures and alert administrators on repeated failures
- [ ] Rate-limit API and controller access to minimize automated attack damage
- [ ] Invalidate stateful session identifiers on the server after logout
- [ ] Use short-lived stateless JWT tokens to limit the window of opportunity

---

## A02:2025 -- Security Misconfiguration

### Description

Security Misconfiguration is the most commonly seen issue in the 2025 data. With the growth of cloud-native and containerized deployments, misconfigured services, open cloud storage buckets, default credentials, and verbose error messages have become a primary attack vector. This category moved up from #5 in 2021 to #2 in 2025.

### Why It Moved Up

The explosion of cloud infrastructure, microservices, and containerized deployments has dramatically increased the number of components that need proper configuration. Infrastructure-as-Code misconfigurations and cloud service defaults have contributed to a steep rise in incidents.

### Relevant CWEs

- CWE-2: Environmental Security Flaw
- CWE-11: ASP.NET Misconfiguration
- CWE-16: Configuration
- CWE-209: Generation of Error Message Containing Sensitive Information
- CWE-756: Missing Custom Error Page

### Attack Scenario

An attacker discovers that a production application runs with debug mode enabled, exposing full stack traces, database connection strings, and internal IP addresses. The error page reveals the framework version, which is known to have a remote code execution vulnerability.

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: Debug mode in production, verbose errors
const app = express();
app.use(express.json());

// Stack traces exposed to users
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    message: err.message,
    stack: err.stack,
    query: req.query,
    dbConnection: process.env.DATABASE_URL, // Leaking secrets
  });
});

// Default CORS allows all origins
app.use(cors());

// Directory listing enabled
app.use(express.static('public', { dotfiles: 'allow' }));
```

### Secure Code -- TypeScript

```typescript
// SECURE: Production-hardened configuration
const app = express();
app.use(express.json({ limit: '10kb' }));

// Helmet sets security headers
app.use(helmet());

// Restrictive CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Generic error handler -- no internals leaked
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorId = crypto.randomUUID();
  logger.error({ errorId, message: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    errorId, // Return correlation ID only
  });
});

// Static files -- deny dotfiles
app.use(express.static('public', { dotfiles: 'deny', index: false }));
```

### Vulnerable Code -- Go

```go
// VULNERABLE: Verbose error messages, no security headers
func handler(w http.ResponseWriter, r *http.Request) {
    result, err := db.Query("SELECT * FROM users WHERE id = " + r.URL.Query().Get("id"))
    if err != nil {
        // Leaks database error details
        http.Error(w, fmt.Sprintf("Database error: %v\nQuery: %s", err, r.URL.RawQuery), 500)
        return
    }
    json.NewEncoder(w).Encode(result)
}
```

### Secure Code -- Go

```go
// SECURE: Generic errors, security headers, parameterized queries
func handler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("X-Content-Type-Options", "nosniff")
    w.Header().Set("X-Frame-Options", "DENY")
    w.Header().Set("Content-Security-Policy", "default-src 'self'")

    id := r.URL.Query().Get("id")
    result, err := db.Query("SELECT * FROM users WHERE id = $1", id)
    if err != nil {
        errorID := uuid.New().String()
        log.Printf("errorID=%s err=%v", errorID, err)
        http.Error(w, fmt.Sprintf(`{"error":"internal error","errorId":"%s"}`, errorID), 500)
        return
    }
    json.NewEncoder(w).Encode(result)
}
```

### Prevention Checklist

- [ ] Implement a repeatable hardening process for rapid deployment of locked-down environments
- [ ] Strip unnecessary features, frameworks, and components
- [ ] Review and update configurations as part of the patch management process
- [ ] Use a segmented application architecture with containerization or cloud security groups
- [ ] Send security directives to clients via security headers
- [ ] Automate configuration verification in all environments
- [ ] Remove default accounts, change default passwords
- [ ] Disable directory listing and remove unnecessary files

---

## A03:2025 -- Software Supply Chain Failures

### Description

This is a significantly expanded and renamed category from A06:2021 (Vulnerable and Outdated Components). It now encompasses the entire software supply chain: dependency confusion attacks, compromised build pipelines, malicious packages, typosquatting, and unmaintained components. The expansion reflects the massive increase in supply chain attacks observed from 2021 to 2025.

### Why It Changed

Supply chain attacks increased by over 700% between 2021 and 2024. Incidents like SolarWinds, Log4Shell, XZ Utils backdoor, and numerous npm/PyPI malicious packages demonstrated that vulnerabilities in dependencies and build pipelines are among the most dangerous threats.

### Relevant CWEs

- CWE-829: Inclusion of Functionality from Untrusted Control Sphere
- CWE-426: Untrusted Search Path
- CWE-494: Download of Code Without Integrity Check
- CWE-1104: Use of Unmaintained Third-Party Components

### Attack Scenario

An attacker publishes a package named `lod4sh` (typosquatting `lodash`) on npm. The package contains a postinstall script that exfiltrates environment variables, including CI/CD secrets, to an external server. A developer accidentally installs the malicious package, compromising the build pipeline.

### Vulnerable Code -- TypeScript (package.json)

```jsonc
// VULNERABLE: No lockfile integrity, no version pinning, risky scripts
{
  "dependencies": {
    "lodash": "*",           // Unpinned -- any version accepted
    "express": "^4.0.0",    // Very loose range
    "internal-utils": "^1.0" // Could be hijacked via dependency confusion
  },
  "scripts": {
    "postinstall": "node setup.js"  // Runs arbitrary code on install
  }
}
```

### Secure Code -- TypeScript (package.json + .npmrc)

```jsonc
// SECURE: Pinned versions, lockfile enforced
{
  "dependencies": {
    "lodash": "4.17.21",
    "express": "4.18.2",
    "internal-utils": "1.2.3"
  },
  "scripts": {
    "preinstall": "npx only-allow pnpm"
  },
  "overrides": {}
}

// .npmrc -- enforce security
// ignore-scripts=true
// package-lock=true
// @mycompany:registry=https://registry.internal.mycompany.com
```

```typescript
// SECURE: Runtime dependency verification
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function verifyDependencyIntegrity(modulePath: string, expectedHash: string): boolean {
  const content = readFileSync(require.resolve(modulePath));
  const actualHash = createHash('sha256').update(content).digest('hex');
  if (actualHash !== expectedHash) {
    throw new Error(`Integrity check failed for ${modulePath}`);
  }
  return true;
}
```

### Vulnerable Code -- Go

```go
// VULNERABLE: No checksum verification, using replace directives pointing to forks
module myapp

go 1.21

require (
    github.com/some-random-fork/critical-lib v0.0.0-unpinned
)

replace github.com/original/critical-lib => github.com/some-random-fork/critical-lib v0.0.0
```

### Secure Code -- Go

```go
// SECURE: go.sum provides integrity, use official sources, pin versions
module myapp

go 1.21

require (
    github.com/original/critical-lib v1.4.2
)

// go.sum is committed and verified by `go mod verify`
// CI pipeline runs: go mod verify && go vet ./...
```

### Vulnerable Code -- Python

```python
# VULNERABLE: requirements.txt with no hashes, unpinned versions
# requirements.txt
# requests
# flask>=2.0
# internal-package
```

### Secure Code -- Python

```python
# SECURE: Pinned versions with hashes (generated by pip-compile)
# requirements.txt
requests==2.31.0 \
    --hash=sha256:58cd2187c01e70e6e26505bca751777aa9f2ee0b7f4300988b709f44e013003eb
flask==3.0.0 \
    --hash=sha256:21128f47e4e3b9d597a3e8521a329bf56909b690fcc3fa3e477725aa81367638
```

```python
# SECURE: Verify package signatures at build time
import subprocess
import sys

def verify_dependencies():
    """Run pip audit in CI pipeline to check for known vulnerabilities."""
    result = subprocess.run(
        [sys.executable, "-m", "pip_audit", "--strict", "--require-hashes"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"Dependency audit failed:\n{result.stdout}")
        sys.exit(1)
```

### Prevention Checklist

- [ ] Maintain an inventory of all components and their versions (SBOM)
- [ ] Pin dependency versions and use lockfiles with integrity hashes
- [ ] Use private registries for internal packages with namespace reservation
- [ ] Continuously monitor for vulnerabilities in dependencies (Dependabot, Snyk, Trivy)
- [ ] Remove unused dependencies and features
- [ ] Verify package signatures and checksums
- [ ] Scan for typosquatting and dependency confusion risks
- [ ] Implement build pipeline integrity checks (SLSA framework)
- [ ] Disable postinstall scripts or run them in sandboxed environments

---

## A04:2025 -- Cryptographic Failures

### Description

Cryptographic Failures (previously #2 in 2021) covers failures related to cryptography that lead to exposure of sensitive data. This includes weak algorithms, improper key management, insufficient entropy, lack of encryption in transit or at rest, and deprecated protocols. It moved down from #2 to #4 as industry adoption of TLS 1.3 and automated certificate management has improved baseline encryption.

### Why It Moved Down

Widespread adoption of HTTPS-by-default, automatic certificate management (Let's Encrypt), and cloud provider encryption-at-rest defaults have improved the baseline. However, custom cryptographic implementations and key management remain frequent sources of vulnerabilities.

### Relevant CWEs

- CWE-259: Use of Hard-coded Password
- CWE-261: Weak Encoding for Password
- CWE-327: Use of a Broken or Risky Cryptographic Algorithm
- CWE-328: Use of Weak Hash
- CWE-330: Use of Insufficiently Random Values
- CWE-331: Insufficient Entropy

### Attack Scenario

An application stores user passwords using MD5 without salt. An attacker obtains the database via SQL injection and uses rainbow tables to crack 80% of passwords within hours. Users who reuse passwords have their accounts on other services compromised.

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: MD5 hashing, no salt, weak random token
import crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('md5').update(password).digest('hex');
}

function generateResetToken(): string {
  return Math.random().toString(36).substring(2); // Predictable
}

function encryptData(data: string, key: string): string {
  const cipher = crypto.createCipheriv('des-ecb', key, ''); // DES + ECB mode
  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}
```

### Secure Code -- TypeScript

```typescript
// SECURE: bcrypt for passwords, crypto-safe random, AES-256-GCM
import bcrypt from 'bcrypt';
import crypto from 'crypto';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // Adaptive cost factor
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex'); // Cryptographically secure
}

function encryptData(data: string, key: Buffer): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12); // Unique IV per encryption
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}
```

### Vulnerable Code -- Go

```go
// VULNERABLE: SHA1 for passwords, hardcoded key
import (
    "crypto/sha1"
    "fmt"
)

var encryptionKey = "hardcoded-secret-key-1234" // Hardcoded

func hashPassword(password string) string {
    h := sha1.New()
    h.Write([]byte(password))
    return fmt.Sprintf("%x", h.Sum(nil))
}
```

### Secure Code -- Go

```go
// SECURE: Argon2id for passwords, proper key management
import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/hex"
    "golang.org/x/crypto/argon2"
    "os"
)

func hashPassword(password string, salt []byte) []byte {
    return argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
}

func encrypt(plaintext []byte) ([]byte, error) {
    key, err := hex.DecodeString(os.Getenv("ENCRYPTION_KEY"))
    if err != nil {
        return nil, err
    }
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    nonce := make([]byte, gcm.NonceSize())
    if _, err := rand.Read(nonce); err != nil {
        return nil, err
    }
    return gcm.Seal(nonce, nonce, plaintext, nil), nil
}
```

### Vulnerable Code -- Python

```python
# VULNERABLE: Weak hashing, ECB mode, no salt
import hashlib
from Crypto.Cipher import AES

def hash_password(password: str) -> str:
    return hashlib.md5(password.encode()).hexdigest()

def encrypt_data(data: bytes, key: bytes) -> bytes:
    cipher = AES.new(key, AES.MODE_ECB)  # ECB leaks patterns
    return cipher.encrypt(data)
```

### Secure Code -- Python

```python
# SECURE: Argon2 for passwords, AES-GCM with proper nonce
from argon2 import PasswordHasher
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, hash_str: str) -> bool:
    try:
        return ph.verify(hash_str, password)
    except Exception:
        return False

def encrypt_data(data: bytes, key: bytes) -> bytes:
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, data, None)
    return nonce + ciphertext  # Prepend nonce for decryption
```

### Prevention Checklist

- [ ] Classify data and identify which data is sensitive according to regulations
- [ ] Encrypt all sensitive data at rest using strong algorithms (AES-256)
- [ ] Enforce TLS 1.2+ for all data in transit; use HSTS headers
- [ ] Use authenticated encryption modes (GCM, CCM) not ECB or CBC without HMAC
- [ ] Store passwords using strong adaptive hashing (Argon2id, bcrypt, scrypt)
- [ ] Generate cryptographic keys using proper key derivation functions
- [ ] Use cryptographically secure random number generators
- [ ] Rotate encryption keys according to policy
- [ ] Never hardcode cryptographic keys or secrets in source code

---

## A05:2025 -- Injection

### Description

Injection flaws occur when untrusted data is sent to an interpreter as part of a command or query. This category includes SQL injection, NoSQL injection, OS command injection, LDAP injection, and cross-site scripting (XSS). While injection moved down from #3 to #5, it remains one of the most impactful vulnerability classes.

### Why It Moved Down

Modern frameworks increasingly use parameterized queries and template engines with auto-escaping by default. The adoption of ORMs and prepared statements has reduced the prevalence of classic injection vulnerabilities, though they remain dangerous when present.

### Relevant CWEs

- CWE-77: Command Injection
- CWE-78: OS Command Injection
- CWE-79: Cross-site Scripting (XSS)
- CWE-89: SQL Injection
- CWE-94: Code Injection
- CWE-917: Expression Language Injection

### Attack Scenario

An attacker submits `' OR '1'='1' --` as a username in a login form. The application concatenates this directly into a SQL query, bypassing authentication and returning the first user record (often an admin).

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: String concatenation in SQL query
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  const result = await db.query(query);
  if (result.rows.length > 0) {
    res.json({ token: generateToken(result.rows[0]) });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// VULNERABLE: XSS via unescaped output
app.get('/search', (req, res) => {
  const query = req.query.q;
  res.send(`<h1>Results for: ${query}</h1>`); // Reflected XSS
});
```

### Secure Code -- TypeScript

```typescript
// SECURE: Parameterized queries and output encoding
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await db.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: generateToken(result.rows[0]) });
});

// SECURE: Use template engine with auto-escaping
app.get('/search', (req, res) => {
  const query = req.query.q as string;
  res.render('search', { query: sanitizeHtml(query) }); // Auto-escaped by template
});
```

### Vulnerable Code -- Go

```go
// VULNERABLE: String formatting in SQL
func login(w http.ResponseWriter, r *http.Request) {
    username := r.FormValue("username")
    password := r.FormValue("password")
    query := fmt.Sprintf("SELECT * FROM users WHERE username='%s' AND password='%s'", username, password)
    row := db.QueryRow(query)
    // ...
}
```

### Secure Code -- Go

```go
// SECURE: Parameterized query
func login(w http.ResponseWriter, r *http.Request) {
    username := r.FormValue("username")
    password := r.FormValue("password")

    var user User
    err := db.QueryRow("SELECT id, username, password_hash FROM users WHERE username = $1", username).
        Scan(&user.ID, &user.Username, &user.PasswordHash)
    if err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }
    if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }
    // Generate token...
}
```

### Vulnerable Code -- Python

```python
# VULNERABLE: f-string SQL injection
@app.route('/api/users')
def get_users():
    name = request.args.get('name')
    cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")
    return jsonify(cursor.fetchall())
```

### Secure Code -- Python

```python
# SECURE: Parameterized query
@app.route('/api/users')
def get_users():
    name = request.args.get('name')
    cursor.execute("SELECT * FROM users WHERE name = %s", (name,))
    return jsonify(cursor.fetchall())
```

### Prevention Checklist

- [ ] Use parameterized queries (prepared statements) for all database access
- [ ] Use positive server-side input validation
- [ ] Escape special characters for any residual dynamic queries
- [ ] Use LIMIT and other SQL controls to prevent mass data disclosure on injection
- [ ] Use template engines with auto-escaping for HTML output
- [ ] Implement Content Security Policy (CSP) headers to mitigate XSS
- [ ] Avoid using OS command interpreters; use library functions instead
- [ ] Apply the principle of least privilege to database accounts

---

## A06:2025 -- Insecure Design

### Description

Insecure Design focuses on risks related to design and architectural flaws. It calls for more use of threat modeling, secure design patterns, and reference architectures. This is different from implementation bugs -- it is about missing or ineffective controls at the design level. A perfect implementation of an insecure design is still insecure.

### Why It Stayed

Introduced in 2021, this category continues to address the fundamental gap between secure coding and secure design. Organizations still frequently skip threat modeling and fail to build security into architecture.

### Relevant CWEs

- CWE-256: Unprotected Storage of Credentials
- CWE-501: Trust Boundary Violation
- CWE-522: Insufficiently Protected Credentials
- CWE-656: Reliance on Security Through Obscurity

### Attack Scenario

A cinema chain allows bulk ticket booking without a deposit. An attacker writes a bot that books all seats for popular shows, creating artificial scarcity. The business loses revenue because the design lacks rate limiting, deposit requirements, or reservation timeouts.

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: No rate limiting, no business logic validation
app.post('/api/bookings', authenticateToken, async (req, res) => {
  const { movieId, seats } = req.body; // No limit on seat count
  const booking = await createBooking(req.user.id, movieId, seats);
  res.json(booking); // No payment verification, no timeout
});

// VULNERABLE: Password recovery reveals user existence
app.post('/api/forgot-password', async (req, res) => {
  const user = await findUser(req.body.email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' }); // Info leak
  }
  await sendResetEmail(user.email);
  res.json({ message: 'Reset email sent' });
});
```

### Secure Code -- TypeScript

```typescript
// SECURE: Business rules enforced by design
app.post('/api/bookings', authenticateToken, rateLimiter({ max: 5, window: '1m' }), async (req, res) => {
  const { movieId, seats } = req.body;

  // Design constraint: max 10 seats per booking
  if (!Array.isArray(seats) || seats.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 seats per booking' });
  }

  // Require payment hold before reservation
  const paymentHold = await createPaymentHold(req.user.id, seats.length);
  if (!paymentHold.success) {
    return res.status(402).json({ error: 'Payment verification required' });
  }

  // Reservation expires in 15 minutes without confirmation
  const booking = await createBooking(req.user.id, movieId, seats, {
    expiresIn: '15m',
    paymentHoldId: paymentHold.id,
  });
  res.json(booking);
});

// SECURE: Consistent response prevents user enumeration
app.post('/api/forgot-password', rateLimiter({ max: 3, window: '15m' }), async (req, res) => {
  const user = await findUser(req.body.email);
  if (user) {
    await sendResetEmail(user.email); // Only send if user exists
  }
  // Always return the same response
  res.json({ message: 'If an account exists, a reset email has been sent' });
});
```

### Prevention Checklist

- [ ] Establish a secure development lifecycle with AppSec professionals
- [ ] Use threat modeling for critical flows (authentication, access control, business logic)
- [ ] Integrate security stories and constraints into user stories
- [ ] Write unit and integration tests for security controls
- [ ] Design rate limiting and resource controls into the architecture
- [ ] Separate tiers by system and network layers based on protection needs
- [ ] Limit resource consumption by design (quotas, timeouts, caps)
- [ ] Use established secure design patterns (e.g., defense in depth, fail-safe defaults)

---

## A07:2025 -- Authentication Failures

### Description

Authentication Failures (renamed from "Identification and Authentication Failures" in 2021) covers weaknesses in authentication mechanisms including credential stuffing, brute force, session management, and missing multi-factor authentication. The rename reflects a sharper focus on authentication-specific failures.

### Why It Was Renamed

The name was simplified to better communicate the focus area. The scope remains on confirming user identity, authentication, and session management.

### Relevant CWEs

- CWE-287: Improper Authentication
- CWE-288: Authentication Bypass Using an Alternate Path
- CWE-307: Improper Restriction of Excessive Authentication Attempts
- CWE-384: Session Fixation
- CWE-613: Insufficient Session Expiration

### Attack Scenario

An attacker uses credential stuffing with a database of 1 billion compromised credentials from other breaches. The application has no rate limiting, no account lockout, and no MFA requirement. The attacker gains access to 0.5% of accounts.

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: No brute force protection, weak session management
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await findUser(username);
  if (!user || user.password !== password) { // Plaintext comparison
    return res.status(401).json({ error: 'Invalid login' });
  }
  // Session never expires, no rotation
  req.session.userId = user.id;
  res.json({ message: 'Login successful' });
});
```

### Secure Code -- TypeScript

```typescript
// SECURE: Rate limiting, bcrypt, session management, MFA
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, try again in 15 minutes',
  keyGenerator: (req) => req.body.username || req.ip,
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password, totpCode } = req.body;
  const user = await findUser(username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await incrementFailedAttempts(username);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Verify MFA if enabled
  if (user.mfaEnabled) {
    if (!totpCode || !speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    })) {
      return res.status(401).json({ error: 'Invalid MFA code' });
    }
  }

  // Regenerate session ID to prevent fixation
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.userId = user.id;
    req.session.cookie.maxAge = 30 * 60 * 1000; // 30 minutes
    res.json({ message: 'Login successful' });
  });
});
```

### Prevention Checklist

- [ ] Implement multi-factor authentication to prevent credential stuffing and brute force
- [ ] Never ship or deploy with default credentials
- [ ] Implement rate limiting and account lockout for login attempts
- [ ] Use a server-side secure session manager that generates random session IDs
- [ ] Regenerate session IDs after login to prevent session fixation
- [ ] Set appropriate session timeouts
- [ ] Use bcrypt, scrypt, or Argon2id for password storage
- [ ] Enforce password complexity and check against breached password databases

---

## A08:2025 -- Software and Data Integrity Failures

### Description

Software and Data Integrity Failures relate to code and infrastructure that does not protect against integrity violations. This includes using untrusted CDNs, insecure CI/CD pipelines, auto-update mechanisms without verification, and insecure deserialization. Data integrity failures occur when applications rely on untrusted sources without verification.

### Why It Stayed

This category continues to be relevant as CI/CD pipelines become more complex and the software supply chain attack surface grows. Insecure deserialization remains a significant threat vector.

### Relevant CWEs

- CWE-345: Insufficient Verification of Data Authenticity
- CWE-353: Missing Support for Integrity Check
- CWE-426: Untrusted Search Path
- CWE-502: Deserialization of Untrusted Data

### Attack Scenario

An attacker compromises a CDN serving a popular JavaScript library. They inject a cryptocurrency miner into the library. Thousands of websites include this script without Subresource Integrity (SRI) checks, executing the malicious code in their users' browsers.

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: No SRI on external scripts, insecure deserialization
// In HTML template:
// <script src="https://cdn.example.com/library.js"></script>

// Insecure deserialization
import { deserialize } from 'node-serialize';

app.post('/api/session', (req, res) => {
  const sessionData = Buffer.from(req.cookies.session, 'base64').toString();
  const session = deserialize(sessionData); // Remote code execution risk
  res.json(session);
});
```

### Secure Code -- TypeScript

```typescript
// SECURE: SRI for external scripts, safe deserialization
// In HTML template:
// <script src="https://cdn.example.com/library.js"
//   integrity="sha384-abc123..."
//   crossorigin="anonymous"></script>

// Safe session handling -- no deserialization of untrusted data
import jwt from 'jsonwebtoken';

app.post('/api/session', (req, res) => {
  try {
    const token = req.cookies.session;
    const session = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ['HS256'],
      maxAge: '1h',
    });
    res.json(session);
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
});
```

### Vulnerable Code -- Python

```python
# VULNERABLE: Pickle deserialization of user input
import pickle
import base64

@app.route('/api/load-state', methods=['POST'])
def load_state():
    data = base64.b64decode(request.form['state'])
    state = pickle.loads(data)  # Arbitrary code execution
    return jsonify(state)
```

### Secure Code -- Python

```python
# SECURE: Use JSON for serialization, validate schema
import json
from pydantic import BaseModel, ValidationError

class AppState(BaseModel):
    user_id: str
    preferences: dict[str, str]
    last_page: str

@app.route('/api/load-state', methods=['POST'])
def load_state():
    try:
        raw_data = json.loads(request.form['state'])
        state = AppState(**raw_data)  # Validated deserialization
        return jsonify(state.model_dump())
    except (json.JSONDecodeError, ValidationError) as e:
        return jsonify({"error": "Invalid state data"}), 400
```

### Prevention Checklist

- [ ] Use digital signatures to verify software or data originates from the expected source
- [ ] Use Subresource Integrity (SRI) for all external scripts and stylesheets
- [ ] Verify that libraries and dependencies are consuming trusted repositories
- [ ] Use a software supply chain security tool (OWASP Dependency-Check, OWASP CycloneDX)
- [ ] Ensure CI/CD pipelines have proper access control and integrity verification
- [ ] Never send unsigned or unencrypted serialized data to untrusted clients
- [ ] Avoid using insecure deserialization formats (pickle, Java serialization, YAML load)
- [ ] Implement code signing for deployment artifacts

---

## A09:2025 -- Security Logging and Alerting Failures

### Description

Security Logging and Alerting Failures (renamed from "Security Logging and Monitoring Failures") emphasizes that logging without alerting is insufficient. Organizations must detect, escalate, and respond to active breaches in real time. Without effective logging and alerting, breaches go undetected -- the average time to detect a breach remains over 200 days.

### Why It Was Renamed

The addition of "Alerting" highlights that collecting logs is meaningless without automated analysis and notification. Passive monitoring is not enough -- active alerting on security events is required.

### Relevant CWEs

- CWE-117: Improper Output Neutralization for Logs
- CWE-223: Omission of Security-Relevant Information
- CWE-532: Insertion of Sensitive Information into Log File
- CWE-778: Insufficient Logging

### Attack Scenario

An attacker performs a slow credential stuffing attack over several weeks, testing 10 credentials per hour across multiple IP addresses. The application logs successful logins but not failed attempts. No alerts are configured for anomalous login patterns. The breach is discovered months later when compromised accounts report unauthorized activity.

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: No security logging, sensitive data in logs
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await findUser(username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    // No logging of failed attempt
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  console.log(`User logged in: ${username}, password: ${password}`); // Logs password!
  res.json({ token: generateToken(user) });
});
```

### Secure Code -- TypeScript

```typescript
// SECURE: Comprehensive security logging with alerting
import { Logger } from 'winston';
import { AlertService } from './alerts';

const securityLogger = new Logger({ /* configured for security events */ });
const alertService = new AlertService();

app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  const clientIp = req.ip;

  const user = await findUser(username);
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    securityLogger.warn('authentication_failed', {
      event: 'LOGIN_FAILURE',
      username: username,
      ip: clientIp,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      // Never log the password
    });

    // Alert on threshold
    const failCount = await getFailedAttempts(username, '15m');
    if (failCount > 5) {
      await alertService.send({
        severity: 'HIGH',
        event: 'BRUTE_FORCE_DETECTED',
        details: { username, ip: clientIp, failCount },
      });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  }

  securityLogger.info('authentication_success', {
    event: 'LOGIN_SUCCESS',
    userId: user.id,
    ip: clientIp,
    timestamp: new Date().toISOString(),
  });

  res.json({ token: generateToken(user) });
});
```

### Prevention Checklist

- [ ] Log all authentication events (successes, failures, lockouts)
- [ ] Log all access control failures with sufficient context
- [ ] Log all input validation failures
- [ ] Never log sensitive data (passwords, tokens, credit card numbers, PII)
- [ ] Ensure logs have enough context for forensic analysis (who, what, when, where)
- [ ] Encode and validate log data to prevent log injection attacks
- [ ] Set up real-time alerting for security events
- [ ] Establish incident response and recovery plans
- [ ] Use centralized log management (ELK, Splunk, Datadog)
- [ ] Implement automated anomaly detection on security log streams

---

## A10:2025 -- Mishandling of Exceptional Conditions

### Description

This is a NEW category in 2025. It addresses how applications handle errors, exceptions, edge cases, and unexpected states. Improper exception handling can lead to information disclosure, denial of service, security bypass, or undefined behavior. Applications that crash, leak data, or fail into insecure states when confronted with unexpected inputs represent a significant risk class.

### Why It Is New

This category was added due to increasing evidence that improper error handling and exceptional condition management leads to exploitable vulnerabilities. As applications grow more complex with distributed systems and async operations, proper exception handling becomes critical for security.

### Relevant CWEs

- CWE-248: Uncaught Exception
- CWE-252: Unchecked Return Value
- CWE-280: Improper Handling of Insufficient Permissions
- CWE-391: Unchecked Error Condition
- CWE-392: Missing Report of Error Condition
- CWE-754: Improper Check for Unusual or Exceptional Conditions
- CWE-755: Improper Handling of Exceptional Conditions

### Attack Scenario

An application catches all exceptions with a generic handler that continues processing. When a database connection fails during an authorization check, the exception is caught and the request continues as if authorization succeeded, granting the attacker admin access.

### Vulnerable Code -- TypeScript

```typescript
// VULNERABLE: Fail-open error handling
async function checkAuthorization(userId: string, resource: string): Promise<boolean> {
  try {
    const permissions = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    return permissions.rows[0]?.role === 'admin';
  } catch (error) {
    // Silently fails open -- returns true when DB is down
    console.error('Auth check failed, allowing access');
    return true; // DANGEROUS: fail-open
  }
}

// VULNERABLE: Uncaught promise rejections crash the process
app.get('/api/data', async (req, res) => {
  const data = await fetchExternalService(); // No try-catch -- unhandled rejection
  res.json(data);
});
```

### Secure Code -- TypeScript

```typescript
// SECURE: Fail-closed error handling
async function checkAuthorization(userId: string, resource: string): Promise<boolean> {
  try {
    const permissions = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (!permissions.rows[0]) {
      return false; // Unknown user -- deny
    }
    return permissions.rows[0].role === 'admin';
  } catch (error) {
    securityLogger.error('authorization_check_failed', {
      userId,
      resource,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false; // SAFE: fail-closed -- deny on error
  }
}

// SECURE: Proper async error handling
app.get('/api/data', async (req, res, next) => {
  try {
    const data = await fetchExternalService();
    if (!data) {
      return res.status(502).json({ error: 'Service unavailable' });
    }
    res.json(data);
  } catch (error) {
    next(error); // Pass to centralized error handler
  }
});

// Global error handler -- fail safe
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorId = crypto.randomUUID();
  logger.error({ errorId, path: req.path, error: err.message });
  res.status(500).json({ error: 'Internal error', errorId });
});
```

### Vulnerable Code -- Go

```go
// VULNERABLE: Ignoring error return values
func processPayment(userID string, amount float64) {
    balance, _ := getBalance(userID) // Error ignored
    if balance >= amount {
        deductBalance(userID, amount) // Error ignored
        sendConfirmation(userID)      // Error ignored
    }
}
```

### Secure Code -- Go

```go
// SECURE: Every error checked and handled
func processPayment(userID string, amount float64) error {
    balance, err := getBalance(userID)
    if err != nil {
        return fmt.Errorf("failed to get balance for user %s: %w", userID, err)
    }

    if balance < amount {
        return ErrInsufficientBalance
    }

    if err := deductBalance(userID, amount); err != nil {
        return fmt.Errorf("failed to deduct balance: %w", err)
    }

    if err := sendConfirmation(userID); err != nil {
        // Log but do not fail the transaction -- payment already processed
        log.Printf("warning: confirmation email failed for user %s: %v", userID, err)
    }

    return nil
}
```

### Vulnerable Code -- Python

```python
# VULNERABLE: Bare except hides errors, fail-open
def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except:  # Bare except -- catches everything including SystemExit
        return {"role": "admin"}  # Fail-open fallback
```

### Secure Code -- Python

```python
# SECURE: Specific exceptions, fail-closed
def verify_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired", extra={"token_prefix": token[:10]})
        return None  # Fail-closed
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid token", extra={"error": str(e)})
        return None  # Fail-closed
    except Exception as e:
        logger.error("Unexpected error in token verification", extra={"error": str(e)})
        return None  # Fail-closed -- deny on unexpected error
```

### Prevention Checklist

- [ ] Implement fail-closed (deny by default) error handling for all security controls
- [ ] Handle all exceptions explicitly -- never use bare except/catch
- [ ] Check all return values and error codes
- [ ] Ensure error handlers do not leak sensitive information
- [ ] Implement global exception handlers as a safety net
- [ ] Test error handling paths with fault injection and chaos engineering
- [ ] Use typed errors/exceptions to distinguish recoverable from fatal conditions
- [ ] Define and document the expected behavior for every failure mode
- [ ] Monitor for uncaught exceptions in production

---

## Summary Table

| Rank | Category                                   | Severity | Key CWEs                | Primary Languages Affected |
| ---- | ------------------------------------------ | -------- | ----------------------- | -------------------------- |
| A01  | Broken Access Control                      | Critical | CWE-862, CWE-863       | All                        |
| A02  | Security Misconfiguration                  | High     | CWE-16, CWE-209        | All (infra + code)         |
| A03  | Software Supply Chain Failures             | Critical | CWE-829, CWE-494       | All (ecosystem dependent)  |
| A04  | Cryptographic Failures                     | High     | CWE-327, CWE-328       | All                        |
| A05  | Injection                                  | Critical | CWE-79, CWE-89         | All                        |
| A06  | Insecure Design                            | High     | CWE-522, CWE-656       | All (design-level)         |
| A07  | Authentication Failures                    | High     | CWE-287, CWE-307       | All                        |
| A08  | Software and Data Integrity Failures       | High     | CWE-502, CWE-345       | All                        |
| A09  | Security Logging and Alerting Failures     | Medium   | CWE-778, CWE-532       | All                        |
| A10  | Mishandling of Exceptional Conditions      | Medium   | CWE-755, CWE-252       | All                        |

---

## Best Practices for OWASP Top 10:2025 Compliance

### Development Phase

1. Adopt a secure development lifecycle (SDL) with threat modeling from the design phase.
2. Use frameworks and libraries that prevent common vulnerabilities by default.
3. Implement automated SAST and DAST scanning in CI/CD pipelines.
4. Generate and maintain Software Bills of Materials (SBOMs) for all projects.
5. Train developers on the OWASP Top 10 annually.

### Architecture and Design

1. Apply defense in depth -- never rely on a single security control.
2. Design for fail-closed behavior in all security-critical paths.
3. Implement centralized security controls (authentication, authorization, logging).
4. Use the principle of least privilege for all system components.
5. Separate trust boundaries and validate data crossing them.

### Deployment and Operations

1. Automate security configuration scanning for all environments.
2. Implement centralized logging with real-time alerting on security events.
3. Maintain an up-to-date inventory of all components and dependencies.
4. Establish and test incident response procedures.
5. Conduct regular penetration testing and vulnerability assessments.

### Monitoring and Response

1. Set up automated alerting for authentication failures, access control violations, and anomalies.
2. Maintain audit trails for all privileged operations.
3. Implement automated vulnerability scanning on a continuous basis.
4. Define SLAs for vulnerability remediation based on severity.
5. Conduct post-incident reviews and feed findings into the development process.

---

## Enforcement Checklist

Use this checklist to verify OWASP Top 10:2025 coverage in your organization:

### Governance

- [ ] Security training covers all OWASP Top 10:2025 categories
- [ ] Threat modeling is required for all new features and services
- [ ] Security requirements are included in definition of done
- [ ] Third-party penetration testing is conducted annually

### Technical Controls

- [ ] All endpoints enforce authorization checks (A01)
- [ ] Security headers are set on all responses (A02)
- [ ] Dependency scanning runs in CI/CD with blocking on critical CVEs (A03)
- [ ] All data classified as sensitive is encrypted at rest and in transit (A04)
- [ ] Parameterized queries are used for all database access (A05)
- [ ] Rate limiting and business logic controls are designed into architecture (A06)
- [ ] MFA is available and enforced for privileged accounts (A07)
- [ ] Code signing and integrity verification are in place for deployments (A08)
- [ ] Security events generate real-time alerts (A09)
- [ ] All error handling follows fail-closed pattern (A10)

### Tooling

- [ ] SAST tool integrated in CI/CD pipeline
- [ ] DAST tool runs against staging environments
- [ ] SCA tool monitors all dependencies continuously
- [ ] SBOM generated for every release
- [ ] Container image scanning is enforced before deployment
- [ ] Secret scanning prevents credential commits
- [ ] Infrastructure-as-Code scanning validates configurations

### Metrics

- [ ] Mean time to detect (MTTD) security incidents is tracked
- [ ] Mean time to remediate (MTTR) vulnerabilities is tracked
- [ ] Percentage of code covered by security tests is measured
- [ ] Number of critical/high vulnerabilities in production is tracked
- [ ] Dependency currency (age of dependencies) is monitored
