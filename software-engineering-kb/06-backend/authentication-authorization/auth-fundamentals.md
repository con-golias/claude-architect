# Auth Fundamentals

> **AI Plugin Directive — Authentication Fundamentals**
> You are an AI coding assistant. When generating, reviewing, or refactoring authentication code,
> follow EVERY rule in this document. Violations create exploitable security vulnerabilities.
> Treat each numbered section as a non-negotiable production requirement.

**Core Rule: NEVER store passwords in plaintext, NEVER roll your own cryptography, NEVER trust client-side authentication decisions. Authentication is a server-side concern — ALWAYS verify on the backend.**

---

## 1. Authentication vs Authorization

ALWAYS distinguish between authentication (AuthN) and authorization (AuthZ):

| Aspect | Authentication (AuthN) | Authorization (AuthZ) |
|--------|----------------------|----------------------|
| Question | "Who are you?" | "What can you do?" |
| Mechanism | Credentials, tokens, biometrics | Roles, permissions, policies |
| HTTP Status | `401 Unauthorized` | `403 Forbidden` |
| When | Before authorization | After authentication |
| Failure | Redirect to login | Show "access denied" |
| Data | Identity store (users table) | Policy store (roles/permissions) |
| Caching | NEVER cache credentials | MAY cache permission decisions |

```
┌─────────────────────────────────────────────────────┐
│                   Request Flow                       │
│                                                      │
│  Client ──► [AuthN Middleware] ──► [AuthZ Middleware] │
│              │                     │                  │
│              ▼                     ▼                  │
│         Valid identity?       Has permission?         │
│          │       │            │        │              │
│         Yes      No          Yes       No             │
│          │       │            │        │              │
│          ▼       ▼            ▼        ▼              │
│       Continue  401        Continue   403             │
│          │                    │                        │
│          └────────────────────┘                        │
│                    │                                   │
│                    ▼                                   │
│              [Handler/Controller]                     │
└─────────────────────────────────────────────────────┘
```

ALWAYS return `401` for authentication failures, NEVER `403`. Return `403` ONLY when identity is confirmed but permission is denied. NEVER reveal whether the issue is AuthN or AuthZ to unauthenticated users — use generic "Invalid credentials" messages.

---

## 2. Password Hashing

NEVER store passwords in plaintext, MD5, SHA-1, or SHA-256. These are NOT password hashing algorithms — they are general-purpose hash functions vulnerable to rainbow table and brute-force attacks.

### 2.1 Algorithm Selection

| Algorithm | Recommendation | Memory Cost | CPU Cost | Parallelism | Notes |
|-----------|---------------|-------------|----------|-------------|-------|
| **Argon2id** | PREFERRED | 64 MB+ | 3 iterations | 1 thread | Winner of PHC (2015), resists GPU/ASIC |
| **bcrypt** | ACCEPTABLE | 4 KB fixed | cost 12+ | N/A | Battle-tested, 72-byte password limit |
| **scrypt** | ACCEPTABLE | 16 MB+ | N=2^15+ | p=1 | Good memory hardness |
| PBKDF2 | LEGACY ONLY | None | 600k+ iterations | N/A | Only if FIPS compliance required |
| MD5/SHA | NEVER | None | None | N/A | NOT a password hash |

ALWAYS use Argon2id for new projects. Use bcrypt ONLY when Argon2id is unavailable. NEVER use PBKDF2 unless regulatory compliance (FIPS 140-2) demands it.

### 2.2 Argon2id Configuration

```
Minimum Parameters (OWASP 2024):
├── Memory:      64 MB (65536 KB)
├── Iterations:  3
├── Parallelism: 1
├── Salt Length:  16 bytes (crypto-random)
├── Hash Length:  32 bytes
└── Output:      $argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>
```

### 2.3 Implementation

**TypeScript (argon2)**
```typescript
import argon2 from "argon2";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MB
  timeCost: 3,         // 3 iterations
  parallelism: 1,      // 1 thread
  hashLength: 32,      // 32 bytes output
  saltLength: 16,      // 16 bytes salt (auto-generated)
};

async function hashPassword(password: string): Promise<string> {
  // argon2 generates salt automatically and embeds it in the output
  return argon2.hash(password, ARGON2_OPTIONS);
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // Invalid hash format — treat as failure
  }
}

// Usage
const hash = await hashPassword("user-password");
// $argon2id$v=19$m=65536,t=3,p=1$randomsalt$derivedhash
const valid = await verifyPassword(hash, "user-password"); // true
```

**Go (golang.org/x/crypto/argon2)**
```go
package auth

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/base64"
    "fmt"
    "strings"

    "golang.org/x/crypto/argon2"
)

type Argon2Params struct {
    Memory      uint32
    Iterations  uint32
    Parallelism uint8
    SaltLength  uint32
    KeyLength   uint32
}

var DefaultParams = &Argon2Params{
    Memory:      64 * 1024, // 64 MB
    Iterations:  3,
    Parallelism: 1,
    SaltLength:  16,
    KeyLength:   32,
}

func HashPassword(password string, p *Argon2Params) (string, error) {
    salt := make([]byte, p.SaltLength)
    if _, err := rand.Read(salt); err != nil {
        return "", fmt.Errorf("generate salt: %w", err)
    }

    hash := argon2.IDKey(
        []byte(password), salt,
        p.Iterations, p.Memory, p.Parallelism, p.KeyLength,
    )

    return fmt.Sprintf(
        "$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
        argon2.Version, p.Memory, p.Iterations, p.Parallelism,
        base64.RawStdEncoding.EncodeToString(salt),
        base64.RawStdEncoding.EncodeToString(hash),
    ), nil
}

func VerifyPassword(password, encodedHash string) (bool, error) {
    p, salt, hash, err := decodeHash(encodedHash)
    if err != nil {
        return false, err
    }

    otherHash := argon2.IDKey(
        []byte(password), salt,
        p.Iterations, p.Memory, p.Parallelism, p.KeyLength,
    )

    // Constant-time comparison — NEVER use == for hash comparison
    return subtle.ConstantTimeCompare(hash, otherHash) == 1, nil
}
```

**Python (argon2-cffi)**
```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

hasher = PasswordHasher(
    time_cost=3,        # 3 iterations
    memory_cost=65536,  # 64 MB
    parallelism=1,      # 1 thread
    hash_len=32,        # 32 bytes output
    salt_len=16,        # 16 bytes salt
)

def hash_password(password: str) -> str:
    """Hash password with Argon2id. Salt is auto-generated."""
    return hasher.hash(password)

def verify_password(hash: str, password: str) -> bool:
    """Verify password against hash. Returns False on mismatch."""
    try:
        return hasher.verify(hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False

def needs_rehash(hash: str) -> bool:
    """Check if hash needs rehashing (params changed)."""
    return hasher.check_needs_rehash(hash)
```

### 2.4 Critical Rules

- ALWAYS use constant-time comparison (`subtle.ConstantTimeCompare`, `hmac.compare_digest`, `crypto.timingSafeEqual`) — NEVER use `==` for hash comparison
- ALWAYS generate a unique cryptographically random salt per password — NEVER reuse salts
- ALWAYS store the full encoded hash string (includes algorithm, params, salt, hash)
- ALWAYS implement `needs_rehash()` to upgrade hashes when parameters change
- NEVER log passwords, even hashed — log only "password verified" or "password failed"
- NEVER truncate passwords before hashing (bcrypt's 72-byte limit is an exception — warn users)

---

## 3. Multi-Factor Authentication (MFA)

ALWAYS support MFA for sensitive operations. NEVER rely on passwords alone for high-value accounts.

### 3.1 Factor Comparison

| Factor | Type | Security | UX | Phishing Resistant | Offline |
|--------|------|----------|----|--------------------|---------|
| **FIDO2/WebAuthn** | Something you have | Highest | Best | YES | YES |
| **TOTP (Authenticator)** | Something you have | High | Good | No | YES |
| **Push notification** | Something you have | High | Best | Partial | No |
| **SMS OTP** | Something you have | LOW | Good | No | No |
| **Email OTP** | Something you have | LOW | Fair | No | No |
| **Security questions** | Something you know | LOWEST | Poor | No | YES |

ALWAYS prefer FIDO2/WebAuthn as primary MFA. Use TOTP as fallback. Use SMS ONLY as last resort — it is vulnerable to SIM swapping, SS7 attacks, and interception.

### 3.2 TOTP Implementation

```
TOTP Algorithm (RFC 6238):
┌──────────────────────────────────────────────────┐
│                                                   │
│  1. shared_secret = random(160 bits)              │
│  2. time_step = floor(unix_time / 30)             │
│  3. hmac = HMAC-SHA1(secret, time_step)           │
│  4. offset = hmac[19] & 0x0F                      │
│  5. code = (hmac[offset:offset+4] & 0x7FFFFFFF)   │
│  6. otp = code % 10^6  →  "483291"               │
│                                                   │
│  Valid window: current ± 1 step (90 seconds)      │
└──────────────────────────────────────────────────┘
```

**TypeScript (otpauth)**
```typescript
import { TOTP, Secret } from "otpauth";

function generateTOTPSecret(userEmail: string): {
  secret: string;
  uri: string;
} {
  const secret = new Secret({ size: 20 }); // 160 bits

  const totp = new TOTP({
    issuer: "MyApp",
    label: userEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  return {
    secret: secret.base32, // Store encrypted in database
    uri: totp.toString(),  // Generate QR code from this URI
  };
}

function verifyTOTP(secret: string, token: string): boolean {
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  // Window of 1 allows ±30 seconds tolerance
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
```

**Go (pquerna/otp)**
```go
import (
    "github.com/pquerna/otp"
    "github.com/pquerna/otp/totp"
)

func GenerateTOTPSecret(email string) (*otp.Key, error) {
    return totp.Generate(totp.GenerateOpts{
        Issuer:      "MyApp",
        AccountName: email,
        Period:      30,
        Digits:      otp.DigitsSix,
        Algorithm:   otp.AlgorithmSHA1,
        SecretSize:  20, // 160 bits
    })
}

func VerifyTOTP(secret, code string) bool {
    valid, _ := totp.ValidateCustom(code, secret, time.Now(), totp.ValidateOpts{
        Period:    30,
        Skew:     1, // ±1 time step tolerance
        Digits:   otp.DigitsSix,
        Algorithm: otp.AlgorithmSHA1,
    })
    return valid
}
```

### 3.3 Recovery Codes

ALWAYS generate recovery codes when enrolling MFA:

```typescript
import crypto from "crypto";

function generateRecoveryCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
    // Produces codes like "A3F2B1C9"
  );
}

// ALWAYS hash recovery codes before storing — treat them like passwords
async function storeRecoveryCodes(
  userId: string,
  codes: string[]
): Promise<void> {
  const hashedCodes = await Promise.all(
    codes.map((code) => argon2.hash(code))
  );
  await db.mfaRecoveryCodes.createMany({
    data: hashedCodes.map((hash) => ({
      userId,
      codeHash: hash,
      used: false,
    })),
  });
}
```

- ALWAYS show recovery codes ONCE at enrollment — NEVER display them again
- ALWAYS hash recovery codes before storing (same as passwords)
- ALWAYS mark codes as used after consumption — NEVER allow reuse
- ALWAYS generate 8-10 recovery codes
- ALWAYS require re-enrollment when all recovery codes are consumed

---

## 4. Brute Force Protection

ALWAYS implement rate limiting on authentication endpoints. NEVER allow unlimited login attempts.

### 4.1 Defense Layers

```
┌─────────────────────────────────────────────────────┐
│              Brute Force Defense Layers              │
│                                                      │
│  Layer 1: Global Rate Limit                          │
│  ├── 1000 requests/min per IP                        │
│  └── WAF / CDN level (Cloudflare, AWS WAF)          │
│                                                      │
│  Layer 2: Endpoint Rate Limit                        │
│  ├── 10 attempts/min per IP on /login                │
│  └── Application middleware (express-rate-limit)     │
│                                                      │
│  Layer 3: Account Rate Limit                         │
│  ├── 5 failed attempts → 15 min lockout             │
│  ├── 10 failed attempts → 1 hour lockout            │
│  ├── 20 failed attempts → account locked             │
│  └── Redis counter per username                      │
│                                                      │
│  Layer 4: Adaptive Challenges                        │
│  ├── CAPTCHA after 3 failed attempts                 │
│  ├── Device fingerprint challenge                    │
│  └── Email verification for new IP                   │
└─────────────────────────────────────────────────────┘
```

### 4.2 Implementation

**TypeScript (Redis-based rate limiting)**
```typescript
import Redis from "ioredis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // seconds
}

class LoginRateLimiter {
  constructor(private redis: Redis) {}

  async checkLimit(
    identifier: string, // username or IP
    maxAttempts: number = 5,
    windowSeconds: number = 900 // 15 minutes
  ): Promise<RateLimitResult> {
    const key = `login:attempts:${identifier}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    if (current > maxAttempts) {
      const ttl = await this.redis.ttl(key);
      return { allowed: false, remaining: 0, retryAfter: ttl };
    }

    return { allowed: true, remaining: maxAttempts - current };
  }

  async resetOnSuccess(identifier: string): Promise<void> {
    await this.redis.del(`login:attempts:${identifier}`);
  }
}

// Usage in login handler
async function loginHandler(req: Request, res: Response) {
  const { username, password } = req.body;
  const ip = req.ip;

  // Check both IP and username limits
  const [ipLimit, userLimit] = await Promise.all([
    rateLimiter.checkLimit(`ip:${ip}`, 20, 900),
    rateLimiter.checkLimit(`user:${username}`, 5, 900),
  ]);

  if (!ipLimit.allowed || !userLimit.allowed) {
    const retryAfter = Math.max(
      ipLimit.retryAfter ?? 0,
      userLimit.retryAfter ?? 0
    );
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "Too many login attempts. Try again later.",
    });
  }

  const user = await authenticate(username, password);

  if (!user) {
    // NEVER reveal whether username or password was wrong
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Reset counters on success
  await Promise.all([
    rateLimiter.resetOnSuccess(`ip:${ip}`),
    rateLimiter.resetOnSuccess(`user:${username}`),
  ]);

  // Issue session/token...
}
```

**Go (rate limiting middleware)**
```go
package middleware

import (
    "context"
    "fmt"
    "net/http"
    "time"

    "github.com/redis/go-redis/v9"
)

type LoginLimiter struct {
    rdb         *redis.Client
    maxAttempts int
    window      time.Duration
}

func NewLoginLimiter(rdb *redis.Client) *LoginLimiter {
    return &LoginLimiter{
        rdb:         rdb,
        maxAttempts: 5,
        window:      15 * time.Minute,
    }
}

func (l *LoginLimiter) Allow(ctx context.Context, identifier string) (bool, time.Duration, error) {
    key := fmt.Sprintf("login:attempts:%s", identifier)

    count, err := l.rdb.Incr(ctx, key).Result()
    if err != nil {
        return false, 0, err
    }

    if count == 1 {
        l.rdb.Expire(ctx, key, l.window)
    }

    if count > int64(l.maxAttempts) {
        ttl, _ := l.rdb.TTL(ctx, key).Result()
        return false, ttl, nil
    }

    return true, 0, nil
}

func (l *LoginLimiter) Reset(ctx context.Context, identifier string) {
    l.rdb.Del(ctx, fmt.Sprintf("login:attempts:%s", identifier))
}
```

### 4.3 Critical Rules

- ALWAYS rate limit by BOTH IP address AND username — IP-only allows credential stuffing across accounts
- ALWAYS use generic error messages: "Invalid credentials" — NEVER "User not found" or "Wrong password"
- ALWAYS implement exponential backoff lockouts (5 attempts → 15 min, 10 → 1 hour, 20 → lock)
- ALWAYS log failed authentication attempts with IP, timestamp, and username (NOT password)
- ALWAYS send account lockout notifications via email
- NEVER permanently lock accounts — always provide a recovery path
- ALWAYS return `429 Too Many Requests` with `Retry-After` header

---

## 5. Secure Password Reset

NEVER send passwords via email. ALWAYS use time-limited, single-use reset tokens.

### 5.1 Reset Flow

```
┌──────────────────────────────────────────────────────────────┐
│                  Secure Password Reset Flow                   │
│                                                               │
│  1. User clicks "Forgot Password"                            │
│                    │                                          │
│  2. User enters email                                        │
│                    │                                          │
│  3. Server generates token                                   │
│     ├── token = crypto.randomBytes(32).toString('hex')       │
│     ├── hash = SHA-256(token)  ← store HASH, not token       │
│     ├── expires = now + 1 hour                               │
│     └── invalidate all previous reset tokens for user        │
│                    │                                          │
│  4. Server sends email with reset link                       │
│     └── https://app.com/reset?token={token}                  │
│                    │                                          │
│  5. ALWAYS respond "If account exists, email sent"           │
│     └── NEVER reveal if email exists in system               │
│                    │                                          │
│  6. User clicks link, enters new password                    │
│                    │                                          │
│  7. Server verifies:                                         │
│     ├── SHA-256(submitted_token) matches stored hash         │
│     ├── Token not expired                                    │
│     ├── Token not already used                               │
│     └── New password meets complexity requirements           │
│                    │                                          │
│  8. On success:                                              │
│     ├── Hash new password with Argon2id                      │
│     ├── Delete reset token                                   │
│     ├── Invalidate ALL existing sessions                     │
│     ├── Send confirmation email                              │
│     └── Log password change event                            │
└──────────────────────────────────────────────────────────────┘
```

**TypeScript**
```typescript
import crypto from "crypto";

async function requestPasswordReset(email: string): Promise<void> {
  // ALWAYS respond the same way regardless of whether user exists
  const user = await db.users.findByEmail(email);
  if (!user) return; // Silent — no error, no different response

  // Invalidate previous tokens
  await db.resetTokens.deleteMany({ userId: user.id });

  // Generate cryptographically secure token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  await db.resetTokens.create({
    userId: user.id,
    tokenHash,             // Store HASH, not plaintext token
    expiresAt: new Date(Date.now() + 3600_000), // 1 hour
  });

  await emailService.send({
    to: email,
    subject: "Password Reset Request",
    body: `Reset your password: https://app.com/reset?token=${token}`,
  });
}

async function executePasswordReset(
  token: string,
  newPassword: string
): Promise<boolean> {
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const resetRecord = await db.resetTokens.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) return false;

  // Hash new password and update
  const passwordHash = await hashPassword(newPassword);
  await db.users.update(resetRecord.userId, { passwordHash });

  // Invalidate token and all sessions
  await db.resetTokens.delete(resetRecord.id);
  await db.sessions.deleteMany({ userId: resetRecord.userId });

  // Audit log
  await auditLog.record({
    event: "password_reset",
    userId: resetRecord.userId,
    timestamp: new Date(),
  });

  return true;
}
```

### 5.2 Critical Rules

- ALWAYS hash reset tokens before storing (SHA-256 is sufficient — no need for Argon2id)
- ALWAYS set expiration (1 hour maximum)
- ALWAYS invalidate previous reset tokens when generating new ones
- ALWAYS invalidate ALL sessions after password reset
- ALWAYS use constant response timing to prevent user enumeration
- NEVER include the old password in reset emails
- NEVER allow reset token reuse

---

## 6. Credential Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│               Credential Storage Architecture                │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Application Layer                     ││
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    ││
│  │  │ Password  │  │   MFA    │  │   API Key           │    ││
│  │  │  Service  │  │ Service  │  │   Service           │    ││
│  │  └─────┬─────┘  └────┬─────┘  └─────────┬──────────┘    ││
│  └────────┼──────────────┼──────────────────┼───────────────┘│
│           │              │                  │                 │
│  ┌────────▼──────────────▼──────────────────▼───────────────┐│
│  │                    Storage Layer                          ││
│  │                                                           ││
│  │  passwords     → Argon2id hash in DB                     ││
│  │  TOTP secrets  → AES-256-GCM encrypted in DB             ││
│  │  API keys      → SHA-256 hash in DB (prefix stored plain) ││
│  │  OAuth tokens  → AES-256-GCM encrypted in DB             ││
│  │  Session IDs   → SHA-256 hash in Redis                   ││
│  │  Reset tokens  → SHA-256 hash in DB                      ││
│  │  Signing keys  → HSM / Vault / KMS (NEVER in code/DB)   ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

| Credential Type | Storage Method | Why |
|----------------|----------------|-----|
| User passwords | Argon2id hash | Slow hash resists brute force |
| TOTP secrets | AES-256-GCM encrypted | Must be readable for verification |
| API keys | SHA-256 hash + plaintext prefix | Prefix for identification, hash for verification |
| OAuth access tokens | AES-256-GCM encrypted | Must be readable to use with providers |
| OAuth refresh tokens | AES-256-GCM encrypted | Must be readable to refresh |
| Session IDs | SHA-256 hash | Only need to verify, not read back |
| Password reset tokens | SHA-256 hash | Only need to verify, not read back |
| JWT signing keys | HSM / KMS / Vault | NEVER store in database or code |
| Encryption keys | HSM / KMS / Vault | NEVER store in database or code |

ALWAYS use envelope encryption: encrypt data with a data encryption key (DEK), encrypt the DEK with a key encryption key (KEK) stored in KMS/Vault.

---

## 7. API Key Authentication

ALWAYS generate API keys with cryptographic randomness. NEVER use sequential or predictable identifiers.

```typescript
import crypto from "crypto";

interface APIKey {
  prefix: string;    // Stored plaintext for identification
  hash: string;      // SHA-256 hash of full key for verification
  name: string;      // User-defined label
  scopes: string[];  // Permissions
  expiresAt: Date;
  createdAt: Date;
}

function generateAPIKey(): { fullKey: string; prefix: string; hash: string } {
  const prefix = "myapp";
  const secret = crypto.randomBytes(32).toString("base64url");
  const fullKey = `${prefix}_${secret}`;

  const hash = crypto
    .createHash("sha256")
    .update(fullKey)
    .digest("hex");

  return {
    fullKey,              // Show to user ONCE — never store
    prefix: fullKey.slice(0, 12), // Store for identification
    hash,                 // Store for verification
  };
}

async function verifyAPIKey(key: string): Promise<APIKey | null> {
  const hash = crypto
    .createHash("sha256")
    .update(key)
    .digest("hex");

  const record = await db.apiKeys.findOne({
    hash,
    expiresAt: { $gt: new Date() },
    revokedAt: null,
  });

  return record ?? null;
}
```

- ALWAYS show API keys ONCE at creation — NEVER display the full key again
- ALWAYS hash API keys before storing (SHA-256 is sufficient)
- ALWAYS include a readable prefix for identification and debugging (e.g., `sk_live_`, `pk_test_`)
- ALWAYS support key rotation without downtime (allow multiple active keys)
- ALWAYS set expiration dates on API keys
- ALWAYS support key revocation
- ALWAYS log API key usage for auditing

---

## 8. Login Flow Best Practices

```
┌────────────────────────────────────────────────────────────────┐
│                   Secure Login Flow                             │
│                                                                 │
│  1. Client submits credentials over HTTPS                      │
│                    │                                            │
│  2. Server validates input format                              │
│     └── email format, password non-empty                       │
│                    │                                            │
│  3. Rate limit check (IP + username)                           │
│     └── 429 if exceeded                                        │
│                    │                                            │
│  4. Lookup user by email (constant time)                       │
│     └── If not found: hash dummy password (timing protection)  │
│                    │                                            │
│  5. Verify password with Argon2id                              │
│     └── If invalid: increment failure counter, return 401      │
│                    │                                            │
│  6. Check if rehash needed (params changed)                    │
│     └── If yes: rehash and update stored hash                  │
│                    │                                            │
│  7. Check MFA status                                           │
│     ├── If enrolled: return partial auth token, prompt MFA     │
│     └── If not enrolled: proceed to step 9                     │
│                    │                                            │
│  8. Verify MFA code                                            │
│     └── If invalid: increment MFA failure counter, return 401  │
│                    │                                            │
│  9. Create session / issue tokens                              │
│                    │                                            │
│  10. Reset rate limit counters                                 │
│                    │                                            │
│  11. Log successful authentication                             │
│      ├── IP address, User-Agent, timestamp                     │
│      ├── Geo-location (if available)                           │
│      └── New device? → send notification email                 │
│                    │                                            │
│  12. Return session token / JWT                                │
│      ├── Set HttpOnly, Secure, SameSite=Lax cookies           │
│      └── NEVER return tokens in URL parameters                 │
└────────────────────────────────────────────────────────────────┘
```

### 8.1 Timing Attack Prevention

ALWAYS perform password hashing even when the user does not exist. This prevents timing-based user enumeration:

```go
func Login(username, password string) (*User, error) {
    user, err := db.FindUserByUsername(username)

    if err != nil || user == nil {
        // Hash a dummy password to prevent timing attacks
        // This ensures response time is the same for existing and
        // non-existing users
        argon2.IDKey([]byte(password), []byte("dummysalt1234567"),
            3, 64*1024, 1, 32)
        return nil, ErrInvalidCredentials
    }

    valid, err := VerifyPassword(password, user.PasswordHash)
    if err != nil || !valid {
        return nil, ErrInvalidCredentials
    }

    return user, nil
}
```

---

## 9. Account Security Events

ALWAYS track and notify users of security-relevant events:

| Event | Action | Notification |
|-------|--------|-------------|
| Successful login | Log IP, UA, timestamp | If new device/location |
| Failed login | Increment counter, log | After 3+ consecutive failures |
| Password change | Invalidate sessions | Email confirmation |
| Password reset request | Generate token | Email with reset link |
| Password reset complete | Invalidate sessions | Email confirmation |
| MFA enrolled | Store encrypted secret | Email confirmation |
| MFA disabled | Remove secret | Email confirmation + delay |
| API key created | Store hash | Email notification |
| API key revoked | Mark revoked | Email notification |
| Account locked | Set lockout timer | Email with unlock instructions |
| Suspicious activity | Flag for review | Email + in-app alert |

ALWAYS implement a security event log table:

```sql
CREATE TABLE security_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    event_type  VARCHAR(50) NOT NULL,
    ip_address  INET NOT NULL,
    user_agent  TEXT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Index for user timeline queries
    INDEX idx_security_events_user (user_id, created_at DESC),
    -- Index for anomaly detection
    INDEX idx_security_events_type (event_type, created_at DESC)
);
```

---

## 10. Password Policy

ALWAYS enforce password policies server-side. NEVER rely on client-side validation alone.

| Rule | Requirement | Rationale |
|------|-------------|-----------|
| Minimum length | 12 characters | NIST SP 800-63B recommendation |
| Maximum length | 128 characters | Prevent DoS via long passwords |
| Character requirements | NONE | NIST discourages complexity rules |
| Breach check | Required | Check against Have I Been Pwned API |
| Common password check | Required | Block top 100k common passwords |
| Personal info check | Required | Block username, email in password |
| History check | Last 5 passwords | Prevent password reuse |

```typescript
import crypto from "crypto";

interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

async function validatePassword(
  password: string,
  userContext: { email: string; username: string }
): Promise<PasswordValidation> {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("Password must be at least 12 characters");
  }
  if (password.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }

  // Check against personal information
  const lower = password.toLowerCase();
  if (lower.includes(userContext.username.toLowerCase())) {
    errors.push("Password must not contain your username");
  }
  if (lower.includes(userContext.email.split("@")[0].toLowerCase())) {
    errors.push("Password must not contain your email");
  }

  // Check Have I Been Pwned (k-anonymity model)
  const sha1 = crypto
    .createHash("sha1")
    .update(password)
    .digest("hex")
    .toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`
  );
  const breached = (await response.text())
    .split("\n")
    .some((line) => line.startsWith(suffix));

  if (breached) {
    errors.push("This password has appeared in a data breach");
  }

  return { valid: errors.length === 0, errors };
}
```

- ALWAYS check passwords against breach databases (HIBP uses k-anonymity — safe to use)
- NEVER enforce arbitrary complexity rules (uppercase + number + symbol) — NIST recommends against this
- ALWAYS enforce minimum 12 characters — length is the strongest factor
- ALWAYS allow passphrases and spaces
- NEVER expire passwords on a schedule — NIST recommends against forced rotation

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Plaintext password storage | Passwords readable in DB dump | Use Argon2id hashing |
| MD5/SHA for passwords | Rainbow table attacks succeed | Migrate to Argon2id with rehash-on-login |
| Same error for AuthN and AuthZ | 403 for wrong password | Return 401 for AuthN failures, 403 for AuthZ |
| User enumeration via login | "User not found" vs "Wrong password" | Generic "Invalid credentials" message |
| User enumeration via timing | Login faster for non-existent users | Hash dummy password on user-not-found |
| User enumeration via reset | "Email not found" on password reset | Always respond "If account exists, email sent" |
| SMS-only MFA | Accounts compromised via SIM swap | Offer TOTP/FIDO2 as primary options |
| Recovery codes in plaintext | Codes leaked in DB breach | Hash recovery codes with Argon2id |
| No rate limiting on login | Credential stuffing succeeds | Rate limit by IP AND username |
| Reusable reset tokens | Token replay attacks | Single-use tokens, invalidate on use |
| Passwords in URL parameters | Passwords in server logs, browser history | Always POST credentials over HTTPS |
| Global salt / no salt | One cracked hash reveals all | Unique random salt per password |
| No session invalidation on password change | Old sessions still valid after compromise | Invalidate ALL sessions on password change |
| Logging passwords | Credentials in log files | NEVER log passwords, even hashed |

---

## 12. Enforcement Checklist

- [ ] Passwords hashed with Argon2id (memory=64MB, iterations=3, parallelism=1)
- [ ] Constant-time comparison used for ALL hash/token verification
- [ ] Unique cryptographically random salt per password (16+ bytes)
- [ ] MFA available for all users, enforced for admin/privileged accounts
- [ ] TOTP secrets encrypted at rest (AES-256-GCM)
- [ ] Recovery codes hashed like passwords, single-use, shown once
- [ ] Rate limiting on login by BOTH IP and username
- [ ] Generic error messages on authentication failure ("Invalid credentials")
- [ ] Timing attack protection (hash dummy password for non-existent users)
- [ ] Password reset tokens hashed (SHA-256), single-use, 1-hour expiry
- [ ] All sessions invalidated on password change/reset
- [ ] No user enumeration via login, registration, or password reset
- [ ] API keys hashed (SHA-256), shown once, with prefix for identification
- [ ] Password policy: 12+ chars, breach check, no complexity rules (NIST)
- [ ] Security events logged (login, password change, MFA, lockout)
- [ ] New device/location notifications sent to users
- [ ] All credentials transmitted over HTTPS only
- [ ] JWT signing keys stored in HSM/KMS/Vault — NEVER in code or DB
- [ ] Failed login attempts logged with IP, timestamp, username (NOT password)
- [ ] Account lockout with recovery path (NEVER permanent lock)
