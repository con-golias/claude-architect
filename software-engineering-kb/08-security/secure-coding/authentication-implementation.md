# Authentication Implementation

> **Domain:** Security > Secure Coding > Authentication Implementation
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** --

## Why It Matters

Authentication is the single most attacked surface of any application. Every data breach headline -- every leaked user database, every account takeover -- traces back to a failure in how credentials were stored, verified, or managed. Getting authentication wrong does not mean a theoretical risk; it means your users' passwords end up on dark web marketplaces, their accounts get hijacked, and your organization faces regulatory fines that can reach millions.

This guide is not a theoretical overview. It is an implementation reference. Every recommendation is backed by current standards (NIST SP 800-63B, OWASP ASVS 4.0), and every code example is production-grade. Follow these patterns exactly.

---

## 1. Password Hashing

### Theory

Never store passwords in plaintext. Never store them as simple hashes (MD5, SHA-256). Always use a password hashing function -- a deliberately slow, memory-hard algorithm designed to make brute-force attacks computationally infeasible.

```
Password Storage -- The Attack Cost Equation:

  Plaintext:     Cost to crack = 0 (already exposed)
  MD5:           Cost to crack = seconds (GPU brute force)
  SHA-256:       Cost to crack = minutes (GPU brute force)
  bcrypt:        Cost to crack = months to years
  Argon2id:      Cost to crack = years to decades (memory-hard)

  The goal: Make the cost of cracking ONE password so high
  that cracking millions becomes economically impossible.
```

### Algorithm Selection

| Algorithm | Status | Use When |
|-----------|--------|----------|
| **Argon2id** | Preferred | New projects, any language with a mature binding |
| **bcrypt** | Acceptable | Legacy systems, environments without Argon2 support |
| **scrypt** | Acceptable | When Argon2 is unavailable and memory-hardness is needed |
| **PBKDF2** | Last resort | Only when FIPS 140-2 compliance is mandatory |
| MD5/SHA-*/plain | **NEVER** | Under no circumstances |

### Argon2id Configuration

Argon2id combines Argon2i (side-channel resistance) and Argon2d (GPU resistance). Use these minimum parameters:

```
Argon2id Recommended Parameters:

  Parameter          Minimum       Recommended     Maximum (high security)
  -----------------------------------------------------------------------
  Memory (m)         19 MiB        64 MiB          256 MiB
  Iterations (t)     2             3               5
  Parallelism (p)    1             1               4
  Salt length        16 bytes      16 bytes        32 bytes
  Hash length        32 bytes      32 bytes        64 bytes

  Tuning rule: Increase memory first, then iterations.
  Target: 250ms-1000ms per hash on your production hardware.
  Measure on your actual deployment environment, not your dev laptop.
```

### TypeScript -- Argon2id with argon2

```typescript
// npm install argon2
import * as argon2 from "argon2";

// Configuration -- tune these for your production hardware
const ARGON2_CONFIG: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,    // 64 MiB
  timeCost: 3,          // 3 iterations
  parallelism: 1,       // 1 thread (increase if server is dedicated)
  hashLength: 32,       // 32-byte output
  saltLength: 16,       // 16-byte random salt (auto-generated)
};

/**
 * Hash a password for storage.
 * Returns an encoded string containing algorithm, parameters, salt, and hash.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_CONFIG);
  // Output: $argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>
}

/**
 * Verify a password against a stored hash.
 * Uses constant-time comparison internally.
 */
export async function verifyPassword(
  storedHash: string,
  candidatePassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, candidatePassword);
  } catch {
    // Corrupted hash, wrong format, etc.
    return false;
  }
}

/**
 * Check if a hash needs rehashing (parameters changed since it was stored).
 */
export function needsRehash(storedHash: string): boolean {
  return argon2.needsRehash(storedHash, ARGON2_CONFIG);
}

// Usage in a login flow:
async function login(email: string, password: string): Promise<AuthResult> {
  const user = await userRepository.findByEmail(email);

  // IMPORTANT: Always hash even if user not found (timing attack prevention)
  if (!user) {
    await hashPassword(password); // Burn time to prevent enumeration
    return { success: false, error: "Invalid credentials" };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    await recordFailedLogin(user.id);
    return { success: false, error: "Invalid credentials" };
  }

  // Rehash if parameters have been updated since this hash was stored
  if (needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(password);
    await userRepository.updatePasswordHash(user.id, newHash);
  }

  return { success: true, user };
}
```

### Go -- Argon2id with golang.org/x/crypto

```go
package auth

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/base64"
    "errors"
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

// DefaultParams returns production-grade Argon2id parameters.
func DefaultParams() *Argon2Params {
    return &Argon2Params{
        Memory:      64 * 1024, // 64 MiB
        Iterations:  3,
        Parallelism: 1,
        SaltLength:  16,
        KeyLength:   32,
    }
}

// HashPassword generates an Argon2id hash with a random salt.
func HashPassword(password string, p *Argon2Params) (string, error) {
    salt := make([]byte, p.SaltLength)
    if _, err := rand.Read(salt); err != nil {
        return "", fmt.Errorf("generating salt: %w", err)
    }

    hash := argon2.IDKey(
        []byte(password), salt,
        p.Iterations, p.Memory, p.Parallelism, p.KeyLength,
    )

    // Encode as: $argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>
    encoded := fmt.Sprintf(
        "$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
        argon2.Version, p.Memory, p.Iterations, p.Parallelism,
        base64.RawStdEncoding.EncodeToString(salt),
        base64.RawStdEncoding.EncodeToString(hash),
    )
    return encoded, nil
}

// VerifyPassword checks a candidate password against a stored hash.
func VerifyPassword(storedHash, candidatePassword string) (bool, error) {
    p, salt, hash, err := decodeHash(storedHash)
    if err != nil {
        return false, err
    }

    candidateHash := argon2.IDKey(
        []byte(candidatePassword), salt,
        p.Iterations, p.Memory, p.Parallelism, p.KeyLength,
    )

    // Constant-time comparison -- prevents timing attacks
    return subtle.ConstantTimeCompare(hash, candidateHash) == 1, nil
}

func decodeHash(encoded string) (*Argon2Params, []byte, []byte, error) {
    parts := strings.Split(encoded, "$")
    if len(parts) != 6 {
        return nil, nil, nil, errors.New("invalid hash format")
    }

    p := &Argon2Params{}
    _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d",
        &p.Memory, &p.Iterations, &p.Parallelism)
    if err != nil {
        return nil, nil, nil, fmt.Errorf("parsing params: %w", err)
    }

    salt, err := base64.RawStdEncoding.DecodeString(parts[4])
    if err != nil {
        return nil, nil, nil, fmt.Errorf("decoding salt: %w", err)
    }
    p.SaltLength = uint32(len(salt))

    hash, err := base64.RawStdEncoding.DecodeString(parts[5])
    if err != nil {
        return nil, nil, nil, fmt.Errorf("decoding hash: %w", err)
    }
    p.KeyLength = uint32(len(hash))

    return p, salt, hash, nil
}
```

### Python -- Argon2id with argon2-cffi

```python
# pip install argon2-cffi
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

# Configure hasher -- tune for your production hardware
ph = PasswordHasher(
    time_cost=3,          # 3 iterations
    memory_cost=65536,    # 64 MiB
    parallelism=1,        # 1 thread
    hash_len=32,          # 32-byte output
    salt_len=16,          # 16-byte salt
)

def hash_password(password: str) -> str:
    """Hash a password for storage. Returns encoded string."""
    return ph.hash(password)

def verify_password(stored_hash: str, candidate_password: str) -> bool:
    """Verify a candidate password against a stored hash."""
    try:
        return ph.verify(stored_hash, candidate_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False

def needs_rehash(stored_hash: str) -> bool:
    """Check if a hash needs to be recomputed with current parameters."""
    return ph.check_needs_rehash(stored_hash)

# Usage in a Django-style login view:
def login_view(request):
    email = request.POST.get("email", "")
    password = request.POST.get("password", "")

    user = User.objects.filter(email=email).first()

    if user is None:
        # Burn time to prevent user enumeration via timing
        hash_password(password)
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    if not verify_password(user.password_hash, password):
        record_failed_login(user.id, request)
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        user.save(update_fields=["password_hash"])

    return create_session(user)
```

### Java -- Argon2 with Bouncy Castle

```java
import org.bouncycastle.crypto.generators.Argon2BytesGenerator;
import org.bouncycastle.crypto.params.Argon2Parameters;
import java.security.SecureRandom;
import java.util.Base64;

public class PasswordHasher {
    private static final int MEMORY_KB = 65536;   // 64 MiB
    private static final int ITERATIONS = 3;
    private static final int PARALLELISM = 1;
    private static final int HASH_LENGTH = 32;
    private static final int SALT_LENGTH = 16;

    private final SecureRandom secureRandom = new SecureRandom();

    public String hashPassword(String password) {
        byte[] salt = new byte[SALT_LENGTH];
        secureRandom.nextBytes(salt);

        Argon2Parameters params = new Argon2Parameters.Builder(
                Argon2Parameters.ARGON2_id)
            .withMemoryAsKB(MEMORY_KB)
            .withIterations(ITERATIONS)
            .withParallelism(PARALLELISM)
            .withSalt(salt)
            .build();

        Argon2BytesGenerator generator = new Argon2BytesGenerator();
        generator.init(params);

        byte[] hash = new byte[HASH_LENGTH];
        generator.generateBytes(password.toCharArray(), hash);

        String saltB64 = Base64.getEncoder().withoutPadding()
            .encodeToString(salt);
        String hashB64 = Base64.getEncoder().withoutPadding()
            .encodeToString(hash);

        return String.format("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
            MEMORY_KB, ITERATIONS, PARALLELISM, saltB64, hashB64);
    }

    public boolean verifyPassword(String storedHash, String candidatePassword) {
        // Parse stored hash, extract salt and parameters, recompute, and
        // use MessageDigest.isEqual() for constant-time comparison.
        // Implementation follows the same decode logic as the Go example.
        try {
            DecodedHash decoded = decodeHash(storedHash);

            Argon2Parameters params = new Argon2Parameters.Builder(
                    Argon2Parameters.ARGON2_id)
                .withMemoryAsKB(decoded.memory)
                .withIterations(decoded.iterations)
                .withParallelism(decoded.parallelism)
                .withSalt(decoded.salt)
                .build();

            Argon2BytesGenerator generator = new Argon2BytesGenerator();
            generator.init(params);

            byte[] candidateHash = new byte[decoded.hash.length];
            generator.generateBytes(candidatePassword.toCharArray(), candidateHash);

            return java.security.MessageDigest.isEqual(decoded.hash, candidateHash);
        } catch (Exception e) {
            return false;
        }
    }
}
```

### C# -- Argon2id with Konscious.Security.Cryptography

```csharp
// dotnet add package Konscious.Security.Cryptography.Argon2
using System.Security.Cryptography;
using Konscious.Security.Cryptography;

public static class PasswordHasher
{
    private const int MemorySize = 65536;   // 64 MiB
    private const int Iterations = 3;
    private const int Parallelism = 1;
    private const int HashLength = 32;
    private const int SaltLength = 16;

    public static string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltLength);

        using var argon2 = new Argon2id(System.Text.Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            MemorySize = MemorySize,
            Iterations = Iterations,
            DegreeOfParallelism = Parallelism
        };

        byte[] hash = argon2.GetBytes(HashLength);

        string saltB64 = Convert.ToBase64String(salt);
        string hashB64 = Convert.ToBase64String(hash);

        return $"$argon2id$v=19$m={MemorySize},t={Iterations},p={Parallelism}${saltB64}${hashB64}";
    }

    public static bool VerifyPassword(string storedHash, string candidatePassword)
    {
        try
        {
            var (memory, iterations, parallelism, salt, hash) = DecodeHash(storedHash);

            using var argon2 = new Argon2id(
                System.Text.Encoding.UTF8.GetBytes(candidatePassword))
            {
                Salt = salt,
                MemorySize = memory,
                Iterations = iterations,
                DegreeOfParallelism = parallelism
            };

            byte[] candidateHash = argon2.GetBytes(hash.Length);

            return CryptographicOperations.FixedTimeEquals(hash, candidateHash);
        }
        catch
        {
            return false;
        }
    }
}
```

### Salt and Pepper

**Salt**: A unique random value per password. Prevents rainbow table attacks and ensures identical passwords produce different hashes. Always use a cryptographically secure random generator. Modern Argon2 libraries handle salt generation automatically.

**Pepper**: A server-side secret applied to all passwords before hashing. Store it outside the database (environment variable, HSM, secrets manager). If the database is breached but the application server is not, the pepper prevents offline cracking.

```typescript
// Pepper implementation -- applied BEFORE hashing
import { createHmac } from "crypto";

const PEPPER = process.env.AUTH_PEPPER; // 32+ byte random value from secrets manager

function applyPepper(password: string): string {
  if (!PEPPER) throw new Error("AUTH_PEPPER not configured");
  return createHmac("sha256", PEPPER).update(password).digest("hex");
}

export async function hashPasswordWithPepper(password: string): Promise<string> {
  const peppered = applyPepper(password);
  return argon2.hash(peppered, ARGON2_CONFIG);
}

export async function verifyPasswordWithPepper(
  storedHash: string,
  candidatePassword: string,
): Promise<boolean> {
  const peppered = applyPepper(candidatePassword);
  return argon2.verify(storedHash, peppered);
}
```

---

## 2. Password Policies (NIST SP 800-63B)

### Modern Password Policy

NIST SP 800-63B (Digital Identity Guidelines) fundamentally changed password policy best practices. Many legacy rules -- forced complexity, periodic rotation, security questions -- actively harm security by encouraging weak patterns.

```
NIST SP 800-63B -- What Changed:

  OLD (WRONG)                          NEW (CORRECT)
  ──────────────────────────────────   ──────────────────────────────────
  "Must have uppercase, lowercase,     Minimum 8 characters, no
  number, and special character"       complexity composition rules

  "Change password every 90 days"      No periodic rotation; change
                                       only when compromised

  "Cannot reuse last 12 passwords"     No password history enforcement
                                       (rotation is gone anyway)

  "Max length 16 characters"           Accept at least 64 characters;
                                       no maximum below 64

  "No paste in password field"         MUST allow paste (enables
                                       password managers)

  Security questions for recovery      Avoid; use other recovery
                                       mechanisms
```

### Breached Password Checking (HaveIBeenPwned k-Anonymity)

Check every password at registration and at password change against the HaveIBeenPwned breached password database using k-anonymity (only the first 5 characters of the SHA-1 hash are sent to the API).

```typescript
import { createHash } from "crypto";

/**
 * Check if a password appears in known breaches using HaveIBeenPwned API.
 * Uses k-anonymity: only the first 5 chars of the SHA-1 hash are sent.
 * The full hash never leaves the server.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.substring(0, 5);
  const suffix = sha1.substring(5);

  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    {
      headers: { "Add-Padding": "true" }, // Prevents response-length analysis
    },
  );

  if (!response.ok) {
    // API failure should NOT block registration -- log and allow
    console.error(`HIBP API error: ${response.status}`);
    return false;
  }

  const body = await response.text();
  const lines = body.split("\r\n");

  for (const line of lines) {
    const [hashSuffix, count] = line.split(":");
    if (hashSuffix === suffix && parseInt(count, 10) > 0) {
      return true; // Password found in breaches
    }
  }

  return false;
}

// Usage in registration:
async function validatePassword(password: string): Promise<string[]> {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (password.length > 128) {
    errors.push("Password must be no more than 128 characters");
  }

  if (await isPasswordBreached(password)) {
    errors.push(
      "This password has appeared in a known data breach. Choose a different password."
    );
  }

  return errors;
}
```

```python
# Python equivalent
import hashlib
import httpx

async def is_password_breached(password: str) -> bool:
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.pwnedpasswords.com/range/{prefix}",
            headers={"Add-Padding": "true"},
        )

    if response.status_code != 200:
        return False  # Fail open; log the error

    for line in response.text.splitlines():
        hash_suffix, count = line.split(":")
        if hash_suffix == suffix and int(count) > 0:
            return True

    return False
```

### Password Policy Enforcement Summary

| Rule | Requirement |
|------|-------------|
| Minimum length | 8 characters (12+ recommended) |
| Maximum length | Accept at least 64 characters, up to 128 |
| Complexity rules | NONE -- no forced uppercase/lowercase/number/symbol |
| Breached password check | Required at registration and password change |
| Periodic rotation | Do NOT require; change only on evidence of compromise |
| Password paste | MUST allow (enables password managers) |
| Password visibility toggle | Recommended (reduces typos) |
| Unicode support | Accept all Unicode characters; normalize with NFKC before hashing |

---

## 3. Brute Force Protection

### Strategy Overview

```
Brute Force Defense Layers:

  Layer 1: Rate Limiting (per IP)
  ├── Sliding window: 20 attempts per IP per 15 minutes
  ├── Applies to ALL authentication endpoints
  └── Returns 429 Too Many Requests

  Layer 2: Account Lockout (progressive delays)
  ├── After 3 failures: 30-second delay
  ├── After 5 failures: 2-minute delay
  ├── After 10 failures: 15-minute lockout + email notification
  └── After 20 failures: Account locked, requires admin/self-service unlock

  Layer 3: CAPTCHA
  ├── Shown after 3 failed attempts on an account
  └── Always shown on registration

  Layer 4: Monitoring and Alerting
  ├── Log every failed attempt with IP, user agent, timestamp
  ├── Alert on distributed attacks (same account, many IPs)
  └── Alert on spray attacks (many accounts, same password)
```

### Progressive Delay Implementation

Use progressive delays instead of hard lockouts. Hard lockouts enable denial-of-service (an attacker can lock out any user by intentionally failing authentication).

```typescript
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

interface LoginAttemptResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  requiresCaptcha: boolean;
}

const DELAY_SCHEDULE: Record<number, number> = {
  3: 30,      // After 3 failures: 30-second delay
  5: 120,     // After 5 failures: 2-minute delay
  10: 900,    // After 10 failures: 15-minute lockout
  20: 3600,   // After 20 failures: 1-hour lockout
};

export async function checkLoginAllowed(
  accountId: string,
  ipAddress: string,
): Promise<LoginAttemptResult> {
  // Check IP-level rate limit
  const ipKey = `login:ip:${ipAddress}`;
  const ipAttempts = await redis.incr(ipKey);
  if (ipAttempts === 1) await redis.expire(ipKey, 900); // 15-minute window

  if (ipAttempts > 20) {
    return {
      allowed: false,
      retryAfterSeconds: await redis.ttl(ipKey),
      requiresCaptcha: true,
    };
  }

  // Check account-level progressive delay
  const accountKey = `login:account:${accountId}`;
  const failureCount = parseInt(await redis.get(accountKey) || "0", 10);

  const lockKey = `login:lock:${accountId}`;
  const lockTTL = await redis.ttl(lockKey);
  if (lockTTL > 0) {
    return {
      allowed: false,
      retryAfterSeconds: lockTTL,
      requiresCaptcha: true,
    };
  }

  return {
    allowed: true,
    requiresCaptcha: failureCount >= 3,
  };
}

export async function recordFailedLogin(accountId: string): Promise<void> {
  const accountKey = `login:account:${accountId}`;
  const failureCount = await redis.incr(accountKey);
  await redis.expire(accountKey, 86400); // Reset after 24 hours of no failures

  // Apply progressive delay
  for (const [threshold, delaySeconds] of Object.entries(DELAY_SCHEDULE)) {
    if (failureCount >= parseInt(threshold, 10)) {
      const lockKey = `login:lock:${accountId}`;
      await redis.setex(lockKey, delaySeconds, "locked");
    }
  }

  // Notify user on significant lockout
  if (failureCount === 10) {
    await sendSecurityAlert(accountId, "multiple_failed_logins");
  }
}

export async function resetLoginAttempts(accountId: string): Promise<void> {
  await redis.del(`login:account:${accountId}`, `login:lock:${accountId}`);
}
```

### Login Attempt Logging

Log every authentication attempt. These logs are critical for incident response and detecting coordinated attacks.

```typescript
interface AuthEvent {
  timestamp: string;
  eventType: "login_success" | "login_failure" | "lockout" | "password_reset";
  accountId: string | null;   // null if account not found
  ipAddress: string;
  userAgent: string;
  geoLocation?: string;
  failureReason?: string;
  riskScore?: number;
}

function logAuthEvent(event: AuthEvent): void {
  // NEVER log the password or password hash
  // Send to structured logging pipeline (ELK, Datadog, etc.)
  logger.info("auth_event", {
    ...event,
    // Redact PII as needed for your compliance requirements
  });
}
```

---

## 4. Credential Stuffing Defense

### Credential Stuffing vs Brute Force

```
Distinguishing Attack Patterns:

  Brute Force:
  - One account, many passwords
  - Sequential or pattern-based passwords
  - High request rate from few IPs
  - Detection: per-account rate limiting catches this

  Credential Stuffing:
  - Many accounts, one password each (from leaked databases)
  - Username/password pairs from breaches
  - Distributed across many IPs (botnets)
  - Low request rate per IP (evades IP rate limits)
  - Detection: requires behavioral analysis
```

### Device Fingerprinting

Assign a device identifier at login. When the same account is accessed from an unknown device, trigger additional verification.

```typescript
import { createHash } from "crypto";

interface DeviceFingerprint {
  userAgent: string;
  acceptLanguage: string;
  screenResolution?: string;
  timezone?: string;
  platform?: string;
}

function computeDeviceId(fp: DeviceFingerprint, accountId: string): string {
  const raw = [
    fp.userAgent,
    fp.acceptLanguage,
    fp.screenResolution || "",
    fp.timezone || "",
    fp.platform || "",
    accountId,
  ].join("|");

  return createHash("sha256").update(raw).digest("hex");
}

async function isKnownDevice(
  accountId: string,
  deviceId: string,
): Promise<boolean> {
  const knownDevices = await redis.smembers(`devices:${accountId}`);
  return knownDevices.includes(deviceId);
}

async function handleNewDevice(
  accountId: string,
  deviceId: string,
): Promise<void> {
  // Trigger step-up authentication (MFA, email verification)
  await sendVerificationEmail(accountId, deviceId);
}
```

### Risk-Based Authentication

Score each login attempt and escalate verification for suspicious patterns.

```typescript
interface RiskFactors {
  unknownDevice: boolean;
  unusualGeoLocation: boolean;
  impossibleTravel: boolean;    // Login from 2 distant locations in short time
  recentPasswordChange: boolean;
  torExitNode: boolean;
  knownBotnetIP: boolean;
  timeOfDay: "normal" | "unusual";
  failedAttemptsRecent: number;
}

function computeRiskScore(factors: RiskFactors): number {
  let score = 0;

  if (factors.unknownDevice)        score += 20;
  if (factors.unusualGeoLocation)   score += 15;
  if (factors.impossibleTravel)     score += 40;
  if (factors.torExitNode)          score += 25;
  if (factors.knownBotnetIP)        score += 50;
  if (factors.timeOfDay === "unusual") score += 10;
  score += Math.min(factors.failedAttemptsRecent * 5, 30);

  return Math.min(score, 100);
}

function determineAuthAction(riskScore: number): "allow" | "mfa" | "block" {
  if (riskScore < 20) return "allow";
  if (riskScore < 60) return "mfa";     // Require step-up authentication
  return "block";                         // Block and notify user
}
```

---

## 5. Multi-Factor Authentication (MFA)

### TOTP (RFC 6238)

Time-based One-Time Passwords are the standard second factor. The server and client share a secret; the code changes every 30 seconds.

```typescript
// npm install otpauth qrcode
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";

/**
 * Generate a new TOTP secret for a user.
 * Returns the secret and a QR code data URL for authenticator apps.
 */
export async function generateTOTPSecret(
  userEmail: string,
  issuer: string = "MyApp",
): Promise<{ secret: string; qrCodeUrl: string; uri: string }> {
  const secret = new Secret({ size: 20 }); // 160-bit secret

  const totp = new TOTP({
    issuer,
    label: userEmail,
    algorithm: "SHA1",    // SHA1 is standard for TOTP compatibility
    digits: 6,
    period: 30,
    secret,
  });

  const uri = totp.toString(); // otpauth:// URI
  const qrCodeUrl = await QRCode.toDataURL(uri);

  return {
    secret: secret.base32,  // Store this encrypted in the database
    qrCodeUrl,              // Send to client for scanning
    uri,
  };
}

/**
 * Verify a TOTP code. Allows +/- 1 time window for clock drift.
 */
export function verifyTOTP(secret: string, code: string): boolean {
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  // window: 1 means accept codes from -30s to +30s
  const delta = totp.validate({ token: code, window: 1 });

  return delta !== null;
}
```

```go
// Go TOTP verification using pquerna/otp
package auth

import (
    "time"
    "github.com/pquerna/otp"
    "github.com/pquerna/otp/totp"
)

func GenerateTOTPSecret(email, issuer string) (*otp.Key, error) {
    return totp.Generate(totp.GenerateOpts{
        Issuer:      issuer,
        AccountName: email,
        SecretSize:  20,
        Algorithm:   otp.AlgorithmSHA1,
        Digits:      otp.DigitsSix,
        Period:      30,
    })
}

func VerifyTOTP(secret, code string) bool {
    valid, _ := totp.ValidateCustom(code, secret, time.Now(), totp.ValidateOpts{
        Period:    30,
        Skew:     1,  // Allow +/- 1 time step
        Digits:   otp.DigitsSix,
        Algorithm: otp.AlgorithmSHA1,
    })
    return valid
}
```

### TOTP Anti-Replay Protection

A TOTP code is valid for 30-90 seconds. An attacker who intercepts a code can reuse it in that window. Prevent replay by tracking the last used code.

```typescript
async function verifyTOTPWithReplayProtection(
  userId: string,
  secret: string,
  code: string,
): Promise<boolean> {
  const isValid = verifyTOTP(secret, code);
  if (!isValid) return false;

  // Check if this exact code was already used
  const replayKey = `totp:used:${userId}:${code}`;
  const alreadyUsed = await redis.get(replayKey);
  if (alreadyUsed) return false;

  // Mark code as used. Expire after 90 seconds (period + skew).
  await redis.setex(replayKey, 90, "1");

  return true;
}
```

### WebAuthn / FIDO2

WebAuthn provides phishing-resistant authentication using public-key cryptography. The private key never leaves the authenticator device.

```
WebAuthn Registration Flow:

  User          Browser          Server           Authenticator
  ─────         ───────          ──────           ─────────────
    │               │                │                  │
    │  Click        │                │                  │
    │  "Register"   │                │                  │
    │──────────────>│  POST /webauthn/register/begin    │
    │               │───────────────>│                  │
    │               │   challenge,   │                  │
    │               │   rpId, userId │                  │
    │               │<───────────────│                  │
    │               │                │                  │
    │               │  navigator.credentials.create()   │
    │               │─────────────────────────────────> │
    │               │                │    User touches  │
    │               │                │    authenticator  │
    │               │   attestation  │                  │
    │               │<─────────────────────────────────│
    │               │                │                  │
    │               │  POST /webauthn/register/complete │
    │               │───────────────>│                  │
    │               │                │  Verify          │
    │               │                │  attestation,    │
    │               │                │  store public key│
    │               │   success      │                  │
    │               │<───────────────│                  │
    │  Registered   │                │                  │
    │<──────────────│                │                  │

WebAuthn Authentication Flow:

  User          Browser          Server           Authenticator
  ─────         ───────          ──────           ─────────────
    │               │                │                  │
    │  Click        │                │                  │
    │  "Login"      │                │                  │
    │──────────────>│  POST /webauthn/login/begin       │
    │               │───────────────>│                  │
    │               │   challenge,   │                  │
    │               │   allowCredIds │                  │
    │               │<───────────────│                  │
    │               │                │                  │
    │               │  navigator.credentials.get()      │
    │               │─────────────────────────────────> │
    │               │                │    User touches  │
    │               │                │    authenticator  │
    │               │   assertion    │                  │
    │               │<─────────────────────────────────│
    │               │                │                  │
    │               │  POST /webauthn/login/complete    │
    │               │───────────────>│                  │
    │               │                │  Verify          │
    │               │                │  signature,      │
    │               │                │  update counter  │
    │               │   session      │                  │
    │               │<───────────────│                  │
    │  Logged in    │                │                  │
    │<──────────────│                │                  │
```

```typescript
// Server-side WebAuthn using @simplewebauthn/server
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const RP_NAME = "My Application";
const RP_ID = "myapp.com";
const ORIGIN = "https://myapp.com";

// Registration: Step 1 -- Generate challenge
export async function beginRegistration(user: User) {
  const userAuthenticators = await getAuthenticatorsForUser(user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: user.id,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",    // "none" for most apps; "direct" for high security
    excludeCredentials: userAuthenticators.map((auth) => ({
      id: auth.credentialID,
      type: "public-key",
    })),
    authenticatorSelection: {
      residentKey: "preferred",         // Enables passkeys
      userVerification: "preferred",    // Biometric/PIN on the device
    },
  });

  // Store challenge in session for verification
  await storeChallenge(user.id, options.challenge);

  return options;
}

// Registration: Step 2 -- Verify response
export async function completeRegistration(
  user: User,
  response: RegistrationResponseJSON,
) {
  const expectedChallenge = await getStoredChallenge(user.id);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  // Store the credential
  await storeAuthenticator(user.id, {
    credentialID: verification.registrationInfo.credentialID,
    credentialPublicKey: verification.registrationInfo.credentialPublicKey,
    counter: verification.registrationInfo.counter,
    transports: response.response.transports,
  });

  return { verified: true };
}
```

### Backup Codes

Generate backup codes for MFA recovery. Each code is single-use.

```typescript
import { randomBytes } from "crypto";

/**
 * Generate 10 single-use backup codes.
 * Display to the user once; store hashed in the database.
 */
export async function generateBackupCodes(
  userId: string,
): Promise<string[]> {
  const codes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric code (no ambiguous chars)
    const code = randomBytes(5)
      .toString("hex")
      .substring(0, 8)
      .toUpperCase();

    // Format as XXXX-XXXX for readability
    const formatted = `${code.substring(0, 4)}-${code.substring(4)}`;
    codes.push(formatted);

    // Store hashed -- backup codes are high-value secrets
    const hashed = await argon2.hash(formatted, {
      type: argon2.argon2id,
      memoryCost: 16384,  // Lighter than password hashing (many codes to verify)
      timeCost: 2,
      parallelism: 1,
    });
    hashedCodes.push(hashed);
  }

  // Replace all existing backup codes for this user
  await db.backupCodes.deleteMany({ userId });
  await db.backupCodes.createMany({
    data: hashedCodes.map((hash) => ({
      userId,
      codeHash: hash,
      used: false,
    })),
  });

  return codes; // Show to user ONCE, then discard the plaintext
}

/**
 * Verify and consume a backup code. Returns true if valid.
 */
export async function verifyBackupCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const storedCodes = await db.backupCodes.findMany({
    where: { userId, used: false },
  });

  for (const stored of storedCodes) {
    const isMatch = await argon2.verify(stored.codeHash, code);
    if (isMatch) {
      // Mark as used -- single-use
      await db.backupCodes.update({
        where: { id: stored.id },
        data: { used: true, usedAt: new Date() },
      });
      return true;
    }
  }

  return false;
}
```

### SMS OTP -- Risks and When Acceptable

SMS is the weakest second factor due to SIM swapping, SS7 interception, and social engineering attacks against carriers. Use it only when stronger factors are not feasible.

```
SMS OTP Risk Assessment:

  ACCEPTABLE for:
  - Low-risk accounts where TOTP adoption is unrealistic
  - Transitional step while migrating users to TOTP/WebAuthn
  - Markets where smartphone authenticator adoption is low

  NEVER use for:
  - Admin or privileged accounts
  - Financial transactions
  - Healthcare or regulated data access

  If SMS is used:
  - Expire codes after 5 minutes
  - Limit to 6 digits
  - Rate limit code generation (1 per 60 seconds)
  - Log all SMS OTP events
  - Warn users about SIM swap risks
  - Offer TOTP/WebAuthn as an upgrade path
```

---

## 6. Passwordless Authentication

### Passkeys (WebAuthn Resident Credentials)

Passkeys are WebAuthn credentials stored on the user's device or synced across devices via the platform (iCloud Keychain, Google Password Manager). They replace passwords entirely.

```
Passkeys vs Traditional WebAuthn:

  Traditional WebAuthn (Security Keys):
  - Credential bound to a specific physical device
  - "Roaming authenticator" (e.g., YubiKey)
  - Lost key = locked out (need backup)

  Passkeys (Platform/Synced):
  - Credential synced across user's devices
  - "Platform authenticator" (fingerprint, face, PIN)
  - Backed up via cloud (iCloud, Google, etc.)
  - Better UX, slightly weaker device binding

  Use passkeys for consumer apps (convenience).
  Use hardware security keys for admin/enterprise (maximum security).
```

```typescript
// Passkey registration -- key difference is residentKey: "required"
export async function beginPasskeyRegistration(user: User) {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: user.id,
    userName: user.email,
    authenticatorSelection: {
      residentKey: "required",       // REQUIRED for passkeys
      userVerification: "required",  // Biometric/PIN required
      authenticatorAttachment: "platform", // Built-in authenticator
    },
  });

  await storeChallenge(user.id, options.challenge);
  return options;
}

// Passkey login -- no username needed (discoverable credentials)
export async function beginPasskeyLogin() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
    // No allowCredentials -- the authenticator discovers the credential
  });

  await storeChallengeForSession(options.challenge);
  return options;
}
```

### Magic Links

Send a single-use, time-limited link to the user's email. The link contains a cryptographic token that authenticates the user.

```typescript
import { randomBytes } from "crypto";

interface MagicLinkToken {
  token: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
}

export async function sendMagicLink(email: string): Promise<void> {
  const user = await userRepository.findByEmail(email);

  // IMPORTANT: Always return the same response regardless of whether
  // the user exists. This prevents email enumeration.
  if (!user) {
    // Still pause for realistic timing
    await new Promise((resolve) => setTimeout(resolve, 200));
    return;
  }

  // Generate a cryptographically secure token
  const token = randomBytes(32).toString("urlsafe-base64");

  // Store token with 15-minute expiration
  await db.magicLinkTokens.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      used: false,
    },
  });

  // Invalidate any previous unused tokens for this user
  await db.magicLinkTokens.updateMany({
    where: {
      userId: user.id,
      used: false,
      tokenHash: { not: createHash("sha256").update(token).digest("hex") },
    },
    data: { used: true },
  });

  const link = `https://myapp.com/auth/magic?token=${token}`;
  await emailService.send({
    to: email,
    subject: "Sign in to MyApp",
    body: `Click this link to sign in: ${link}\n\nThis link expires in 15 minutes.`,
  });
}

export async function verifyMagicLink(token: string): Promise<User | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await db.magicLinkTokens.findFirst({
    where: {
      tokenHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) return null;

  // Mark as used immediately (single-use)
  await db.magicLinkTokens.update({
    where: { id: record.id },
    data: { used: true, usedAt: new Date() },
  });

  return userRepository.findById(record.userId);
}
```

---

## 7. Account Recovery

### Secure Password Reset Flow

```
Password Reset -- Correct Flow:

  1. User requests reset
     └── Always return "If an account exists, we sent a link"
         (prevents email enumeration)

  2. Generate token
     ├── 32+ bytes, cryptographically random
     ├── Store SHA-256 hash (not the token itself) in database
     ├── Set expiration: 1 hour maximum
     └── Invalidate any previous reset tokens for this user

  3. Send email with reset link
     └── Link contains the raw token (not the hash)

  4. User clicks link
     ├── Hash the token from the URL
     ├── Look up the hash in the database
     ├── Verify not expired and not used
     └── Mark as used BEFORE changing the password

  5. User sets new password
     ├── Validate against password policy
     ├── Hash with Argon2id
     ├── Invalidate ALL existing sessions
     └── Send confirmation email
```

```typescript
import { randomBytes, createHash } from "crypto";

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await userRepository.findByEmail(email);

  // ALWAYS return the same response -- prevent enumeration
  if (!user) {
    await new Promise((r) => setTimeout(r, 200)); // Timing equalization
    return;
  }

  // Invalidate previous tokens
  await db.passwordResetTokens.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  // Generate token
  const rawToken = randomBytes(32).toString("urlsafe-base64");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  await db.passwordResetTokens.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      used: false,
    },
  });

  const resetUrl = `https://myapp.com/reset-password?token=${rawToken}`;
  await emailService.send({
    to: email,
    subject: "Password Reset Request",
    body: `Reset your password: ${resetUrl}\n\nExpires in 1 hour. If you did not request this, ignore this email.`,
  });
}

export async function executePasswordReset(
  token: string,
  newPassword: string,
): Promise<boolean> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await db.passwordResetTokens.findFirst({
    where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
  });

  if (!record) return false;

  // Mark as used BEFORE changing the password (prevents race conditions)
  await db.passwordResetTokens.update({
    where: { id: record.id },
    data: { used: true, usedAt: new Date() },
  });

  // Validate new password
  const errors = await validatePassword(newPassword);
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }

  // Hash and store
  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePasswordHash(record.userId, passwordHash);

  // Invalidate ALL existing sessions for this user
  await sessionStore.destroyAllForUser(record.userId);

  // Send confirmation
  const user = await userRepository.findById(record.userId);
  await emailService.send({
    to: user.email,
    subject: "Your password has been changed",
    body: "Your password was just changed. If you did not do this, contact support immediately.",
  });

  return true;
}
```

### Recovery Codes

See the backup codes implementation in Section 5 (MFA). Recovery codes serve as the last-resort recovery mechanism when MFA devices are lost.

### Security Questions -- Avoid

Do not use security questions. They are vulnerable to social engineering, public records searches, and social media mining. Use email-based recovery or backup codes instead.

---

## 8. Registration Security

### Username Enumeration Prevention

An attacker must not be able to determine whether an email/username is registered by observing differences in response content, status codes, or timing.

```typescript
// WRONG -- Leaks whether the email is registered
app.post("/register", async (req, res) => {
  const existing = await userRepository.findByEmail(req.body.email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
    // Attacker now knows this email has an account
  }
  // ... create user
});

// WRONG -- Timing leak (fast response = user exists, slow = doesn't)
app.post("/login", async (req, res) => {
  const user = await userRepository.findByEmail(req.body.email);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
    // Returns immediately -- no password hashing delay
  }
  const valid = await verifyPassword(user.passwordHash, req.body.password);
  // ... takes ~300ms for argon2
});

// RIGHT -- Constant response for registration
app.post("/register", async (req, res) => {
  const existing = await userRepository.findByEmail(req.body.email);

  if (existing) {
    // Send "account already exists" email to the owner (privately)
    await emailService.send({
      to: req.body.email,
      subject: "Registration attempt",
      body: "Someone tried to register with your email. If this was you, try logging in instead.",
    });
  } else {
    // Create account and send verification email
    const user = await createUser(req.body);
    await sendVerificationEmail(user);
  }

  // SAME response regardless -- attacker learns nothing
  return res.status(200).json({
    message: "If this email is valid, you will receive a message shortly.",
  });
});

// RIGHT -- Constant-time login (always hash even if user not found)
app.post("/login", async (req, res) => {
  const user = await userRepository.findByEmail(req.body.email);

  if (!user) {
    await hashPassword(req.body.password); // Burn time -- equalize timing
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await verifyPassword(user.passwordHash, req.body.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ... create session
});
```

### Email Verification

Always verify email ownership before activating an account.

```typescript
export async function sendVerificationEmail(user: User): Promise<void> {
  const token = randomBytes(32).toString("urlsafe-base64");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await db.emailVerificationTokens.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  const verifyUrl = `https://myapp.com/verify-email?token=${token}`;
  await emailService.send({
    to: user.email,
    subject: "Verify your email address",
    body: `Click to verify: ${verifyUrl}`,
  });
}

export async function verifyEmail(token: string): Promise<boolean> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await db.emailVerificationTokens.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
  });

  if (!record) return false;

  await db.emailVerificationTokens.delete({ where: { id: record.id } });
  await userRepository.update(record.userId, { emailVerified: true });

  return true;
}
```

---

## 9. Remember Me / Persistent Login

### Secure Token-Based Remember Me

Do not store the session ID in a long-lived cookie. Use a separate remember-me token that is rotated on each use and bound to the device.

```typescript
import { randomBytes, createHash } from "crypto";

interface RememberMeToken {
  id: string;
  userId: string;
  tokenHash: string;
  series: string;          // Identifies the "remember me" series (device)
  expiresAt: Date;
  createdAt: Date;
  userAgent: string;
  ipAddress: string;
}

/**
 * Issue a remember-me token. The "series" identifier is constant for a
 * device; the token rotates on each use.
 */
export async function issueRememberMeToken(
  userId: string,
  userAgent: string,
  ipAddress: string,
): Promise<{ series: string; token: string }> {
  const series = randomBytes(16).toString("hex");
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await db.rememberMeTokens.create({
    data: {
      userId,
      series,
      tokenHash,
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return { series, token };
  // Set as cookie: remember_me=<series>:<token>; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000
}

/**
 * Validate and rotate a remember-me token.
 * If the series exists but the token is wrong, it indicates theft --
 * invalidate ALL tokens for the user.
 */
export async function validateRememberMe(
  series: string,
  token: string,
  userAgent: string,
  ipAddress: string,
): Promise<{ userId: string; newToken: string } | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await db.rememberMeTokens.findFirst({
    where: { series, expiresAt: { gt: new Date() } },
  });

  if (!record) return null;

  // Check if token matches
  if (record.tokenHash !== tokenHash) {
    // THEFT DETECTED: Series exists but token is wrong.
    // An attacker used the old token, or the user used it and the
    // attacker is now replaying. Invalidate everything.
    await db.rememberMeTokens.deleteMany({ where: { userId: record.userId } });
    await sessionStore.destroyAllForUser(record.userId);

    await sendSecurityAlert(record.userId, "remember_me_theft_detected");

    return null;
  }

  // Rotate the token (new token, same series)
  const newToken = randomBytes(32).toString("hex");
  const newTokenHash = createHash("sha256").update(newToken).digest("hex");

  await db.rememberMeTokens.update({
    where: { id: record.id },
    data: {
      tokenHash: newTokenHash,
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { userId: record.userId, newToken };
}
```

---

## 10 Best Practices

### Rule 1: Use Argon2id for Password Hashing

Always use Argon2id with appropriate memory and iteration parameters. Fall back to bcrypt (cost factor 12+) only when Argon2 is unavailable. Never use MD5, SHA-1, SHA-256, or plain PBKDF2 for passwords.

### Rule 2: Follow NIST SP 800-63B Password Policy

Enforce minimum 8 characters. Do not enforce composition rules (uppercase, lowercase, numbers, symbols). Check against breached password lists. Do not require periodic rotation. Allow paste in password fields.

### Rule 3: Implement Progressive Brute Force Protection

Use progressive delays, not hard lockouts. Rate limit by both IP address and account. Log every authentication event. Add CAPTCHA after repeated failures.

### Rule 4: Always Use Constant-Time Comparison

Use `crypto.timingSafeEqual` (Node.js), `subtle.ConstantTimeCompare` (Go), `hmac.compare_digest` (Python), or `MessageDigest.isEqual` (Java) when comparing secrets. Never use `===` or `==` for password hashes, tokens, or API keys.

### Rule 5: Prevent Username and Email Enumeration

Return identical responses (content, status code, timing) regardless of whether an account exists. Hash a dummy password when the user is not found to equalize response time. On registration, always say "check your email" rather than "email already exists."

### Rule 6: Make All Tokens Single-Use and Time-Limited

Password reset tokens, email verification tokens, magic link tokens, and backup codes must all be single-use. Set aggressive expiration times (15 minutes for magic links, 1 hour for password resets). Store token hashes in the database, never the raw token.

### Rule 7: Offer and Encourage Multi-Factor Authentication

Support TOTP as the baseline second factor. Offer WebAuthn/passkeys for phishing-resistant authentication. Provide backup codes for recovery. Discourage SMS as the sole second factor.

### Rule 8: Invalidate All Sessions on Password Change

When a user changes their password (voluntarily or via reset), invalidate every active session and every remember-me token. This ensures that a compromised session cannot outlive a password change.

### Rule 9: Store Secrets Correctly

TOTP secrets must be encrypted at rest in the database (use AES-256-GCM with a key from your secrets manager). Backup codes must be hashed. Remember-me tokens must be hashed. Password reset tokens must be hashed. The only thing stored in plaintext is the user's email.

### Rule 10: Log and Monitor Authentication Events

Log every authentication attempt (success and failure) with timestamp, IP, user agent, and account identifier. Alert on anomalies: impossible travel, distributed credential stuffing, account lockouts, password resets from unknown IPs.

---

## 8 Common Anti-Patterns

### Anti-Pattern 1: Storing Passwords with Reversible Encryption

```typescript
// WRONG -- Encryption is not hashing. If the key is compromised,
// ALL passwords are exposed at once.
const encrypted = aesEncrypt(password, SECRET_KEY);
await db.users.update({ data: { password: encrypted } });

// RIGHT -- Hashing is one-way. Even if the database is stolen,
// passwords cannot be recovered.
const hashed = await argon2.hash(password, ARGON2_CONFIG);
await db.users.update({ data: { passwordHash: hashed } });
```

### Anti-Pattern 2: Rolling Your Own Password Hashing

```typescript
// WRONG -- "Salted SHA-256" is not a password hash. It is fast.
// GPUs can compute billions of SHA-256 hashes per second.
const hash = sha256(salt + password);

// WRONG -- Iterating SHA-256 yourself is fragile and likely incorrect.
let hash = password;
for (let i = 0; i < 10000; i++) hash = sha256(hash);

// RIGHT -- Use a purpose-built password hashing library.
const hash = await argon2.hash(password, ARGON2_CONFIG);
```

### Anti-Pattern 3: Leaking User Existence Through Error Messages

```typescript
// WRONG -- Different messages reveal whether the email is registered
if (!user) return res.json({ error: "User not found" });
if (!validPassword) return res.json({ error: "Wrong password" });

// RIGHT -- Same message for all authentication failures
return res.status(401).json({ error: "Invalid credentials" });
```

### Anti-Pattern 4: Hard Account Lockout Without Escalation

```typescript
// WRONG -- Attacker can lock out any user by sending 5 bad attempts
if (failedAttempts >= 5) {
  await lockAccount(userId); // Requires admin unlock
  return { error: "Account locked. Contact support." };
}

// RIGHT -- Progressive delays that slow attacks without denial-of-service
const delay = getProgressiveDelay(failedAttempts);
if (delay > 0) {
  return { error: `Too many attempts. Try again in ${delay} seconds.` };
}
```

### Anti-Pattern 5: Long-Lived or Reusable Password Reset Tokens

```typescript
// WRONG -- Token never expires and is not single-use
const token = uuid();
await db.resetTokens.create({ token, userId });
// Token is valid until manually deleted

// RIGHT -- Time-limited, single-use, hashed storage
const token = randomBytes(32).toString("urlsafe-base64");
await db.resetTokens.create({
  tokenHash: sha256(token),
  userId,
  expiresAt: addHours(new Date(), 1),
  used: false,
});
```

### Anti-Pattern 6: SMS as the Only Second Factor

```typescript
// WRONG -- SMS is vulnerable to SIM swapping and SS7 attacks
const mfaMethods = ["sms"]; // Only option offered

// RIGHT -- Offer multiple methods, with hardware/TOTP preferred
const mfaMethods = ["webauthn", "totp", "sms"]; // Best to worst
// Warn users who only have SMS enabled
// Block SMS for admin/privileged accounts
```

### Anti-Pattern 7: Storing Raw Tokens in the Database

```typescript
// WRONG -- If the database is breached, all tokens are usable
await db.resetTokens.create({ token: rawToken, userId });

// RIGHT -- Store SHA-256 hash; only the user has the raw token
await db.resetTokens.create({
  tokenHash: createHash("sha256").update(rawToken).digest("hex"),
  userId,
});
```

### Anti-Pattern 8: Not Rotating Remember-Me Tokens

```typescript
// WRONG -- Same token used forever; if stolen, attacker has permanent access
const token = cookies.get("remember_me");
const record = await db.rememberMe.findByToken(token);
if (record) createSession(record.userId);

// RIGHT -- Rotate token on every use; detect theft via series identifier
const { series, token } = parseCookie(cookies.get("remember_me"));
const result = await validateRememberMe(series, token);
if (result) {
  setCookie("remember_me", `${series}:${result.newToken}`);
  createSession(result.userId);
}
```

---

## Enforcement Checklist

Use this checklist during code review and security audits. Every item must be verified.

### Password Storage

- [ ] Passwords are hashed with Argon2id (or bcrypt with cost 12+)
- [ ] Argon2id parameters: memory >= 19 MiB, iterations >= 2, parallelism >= 1
- [ ] Salts are 16+ bytes, generated by a cryptographically secure RNG
- [ ] No passwords stored in plaintext, encrypted, or as fast hashes (MD5, SHA-*)
- [ ] Pepper is stored outside the database (env var, secrets manager, HSM)
- [ ] Password hashes are rehashed transparently when parameters change

### Password Policy

- [ ] Minimum length is 8 characters (12+ recommended)
- [ ] Maximum length is at least 64 characters
- [ ] No composition rules (uppercase, lowercase, number, symbol requirements)
- [ ] Passwords checked against HaveIBeenPwned breached password list
- [ ] No periodic rotation requirement
- [ ] Paste is allowed in password fields
- [ ] Unicode passwords are NFKC-normalized before hashing

### Brute Force and Credential Stuffing

- [ ] Rate limiting applied per IP address
- [ ] Progressive delays applied per account
- [ ] CAPTCHA triggered after repeated failures
- [ ] Login attempts logged with IP, user agent, timestamp
- [ ] Alerts configured for unusual patterns (spray attacks, distributed stuffing)
- [ ] Account lockout is progressive, not hard (prevents denial-of-service)

### Multi-Factor Authentication

- [ ] TOTP implemented per RFC 6238 with 30-second period
- [ ] TOTP replay protection in place (codes cannot be reused within window)
- [ ] WebAuthn/FIDO2 offered for phishing-resistant authentication
- [ ] Backup codes generated (10 codes, hashed, single-use)
- [ ] TOTP secrets encrypted at rest in the database
- [ ] SMS MFA is optional, not the sole factor; prohibited for privileged accounts

### Account Recovery

- [ ] Password reset tokens are cryptographically random (32+ bytes)
- [ ] Reset tokens stored as SHA-256 hash, not raw
- [ ] Reset tokens expire within 1 hour
- [ ] Reset tokens are single-use
- [ ] All sessions invalidated after password reset
- [ ] Confirmation email sent after password change
- [ ] Security questions are NOT used

### Registration and Enumeration

- [ ] Registration response is identical whether the email exists or not
- [ ] Login failure response is identical whether the account exists or not
- [ ] Timing is equalized (dummy hash when user not found)
- [ ] Email verification required before account activation
- [ ] Duplicate email detection happens silently (send "already registered" email)

### Remember Me / Persistent Login

- [ ] Remember-me tokens are cryptographically random (32+ bytes)
- [ ] Tokens stored as SHA-256 hash in the database
- [ ] Tokens rotated on every use (series-based rotation)
- [ ] Theft detection: mismatched token on valid series invalidates all sessions
- [ ] Remember-me cookies set with Secure, HttpOnly, SameSite=Lax
- [ ] Maximum lifetime is 30 days; re-authentication required for sensitive actions

### General

- [ ] All secret comparisons use constant-time functions
- [ ] All authentication endpoints use HTTPS only
- [ ] Session tokens are regenerated after authentication
- [ ] Sensitive actions (password change, MFA change, email change) require re-authentication
- [ ] Authentication events are logged to a SIEM or structured logging pipeline
- [ ] Rate limiting returns 429 with Retry-After header

---

## References

- NIST SP 800-63B: Digital Identity Guidelines -- Authentication and Lifecycle Management
- OWASP Authentication Cheat Sheet
- OWASP Application Security Verification Standard (ASVS) 4.0, Section V2
- RFC 6238: TOTP -- Time-Based One-Time Password Algorithm
- RFC 4226: HOTP -- HMAC-Based One-Time Password Algorithm
- WebAuthn Level 2 Specification (W3C)
- FIDO2 Client to Authenticator Protocol (CTAP)
- Argon2 RFC (RFC 9106)
