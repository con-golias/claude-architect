# Password Security Comprehensive Guide

## Metadata
- **Category**: Authentication and Identity
- **Priority**: Critical
- **Last Updated**: 2025-01-15
- **Standards**: NIST SP 800-63B, OWASP Authentication Cheatsheet
- **Applicable Languages**: TypeScript, Go, Python, Java, C#

---

## Table of Contents

1. [Overview](#overview)
2. [Password Hashing Algorithms](#password-hashing-algorithms)
3. [Salt Generation](#salt-generation)
4. [Pepper (Application-Level Secret)](#pepper-application-level-secret)
5. [NIST SP 800-63B Guidelines](#nist-sp-800-63b-guidelines)
6. [Breached Password Detection](#breached-password-detection)
7. [Password Strength Estimation](#password-strength-estimation)
8. [Password Storage Migration](#password-storage-migration)
9. [Implementation Examples](#implementation-examples)
10. [Best Practices](#best-practices)
11. [Anti-Patterns](#anti-patterns)
12. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

Password security is the first line of defense in authentication systems. Despite the
emergence of passwordless authentication, passwords remain the dominant authentication
mechanism across most applications. A single misconfiguration in password storage can
expose millions of user credentials. This guide covers the full lifecycle of password
security, from user input validation through secure hashing, storage, and migration.

The fundamental principle of password security is that passwords must never be stored
in a recoverable format. Every password must be processed through a one-way,
computationally expensive hashing function with a unique salt before storage. The hash
function must be deliberately slow to resist brute-force and dictionary attacks, even
when attackers gain full access to the database.

---

## Password Hashing Algorithms

### Argon2id (Preferred)

Argon2 won the Password Hashing Competition (PHC) in 2015. Argon2id is the recommended
variant as it combines Argon2i (side-channel resistance) and Argon2d (GPU resistance).

**Recommended Parameters:**

| Parameter     | Value   | Purpose                                    |
|---------------|---------|---------------------------------------------|
| Memory        | 64 MB   | Forces high memory usage, resists GPU attacks |
| Iterations    | 3       | Time cost, number of passes over memory      |
| Parallelism   | 4       | Number of threads used                       |
| Salt Length   | 16 bytes| Unique per password                          |
| Hash Length   | 32 bytes| Output length of the derived key             |

Argon2id is memory-hard, meaning it requires a significant amount of RAM to compute
each hash. This property makes it resistant to GPU-based attacks because GPUs have
limited per-core memory. The memory parameter is the most critical tuning factor.
Increase memory before increasing iterations for better security per unit of time.

**Parameter Tuning Strategy:**
1. Set parallelism to the number of available CPU cores (or a fraction for shared systems).
2. Set memory as high as the system can tolerate (64 MB minimum, 256 MB ideal).
3. Increase iterations until hashing takes approximately 500ms-1s per password.
4. Benchmark on production-equivalent hardware, not development machines.

### bcrypt

bcrypt has been the industry standard since 1999. It incorporates a salt and an
adjustable cost factor. While Argon2id is preferred for new systems, bcrypt remains
a strong choice.

**Recommended Parameters:**

| Parameter   | Value | Purpose                              |
|-------------|-------|---------------------------------------|
| Cost Factor | 12    | Log2 of the number of iterations      |
| Salt        | 16 bytes | Built into bcrypt format           |

bcrypt has a maximum input length of 72 bytes. Passwords longer than 72 bytes are
silently truncated. To handle longer passwords, pre-hash with SHA-256 before passing
to bcrypt, but be aware of null-byte issues in some implementations.

**Cost Factor Guidance:**
- Cost 10: ~100ms (minimum acceptable)
- Cost 12: ~400ms (recommended)
- Cost 14: ~1.6s (high security)
- Increase cost by 1 every 18 months to keep pace with hardware improvements.

### scrypt

scrypt is a memory-hard key derivation function designed by Colin Percival. It predates
Argon2 and is used in some cryptocurrency implementations.

**Recommended Parameters:**

| Parameter | Value   | Purpose                                |
|-----------|---------|----------------------------------------|
| N         | 2^15 (32768) | CPU/memory cost parameter        |
| r         | 8       | Block size parameter                    |
| p         | 1       | Parallelization parameter               |
| Key Length | 32 bytes | Output length                         |

scrypt memory usage is calculated as 128 * N * r bytes. With the recommended
parameters, this is 128 * 32768 * 8 = 32 MB per hash computation.

### Algorithm Comparison

| Feature          | Argon2id | bcrypt  | scrypt  | PBKDF2  |
|------------------|----------|---------|---------|---------|
| Memory-hard      | Yes      | No      | Yes     | No      |
| GPU-resistant    | High     | Medium  | High    | Low     |
| Side-channel safe| Yes      | Yes     | No      | Yes     |
| Max input length | Unlimited| 72 bytes| Unlimited| Unlimited|
| Recommended      | Yes      | Yes     | Yes     | No      |

PBKDF2 is listed for reference but must not be used for new systems. It is not
memory-hard and is vulnerable to GPU-accelerated attacks.

---

## Salt Generation

A salt is a random value unique to each password hash. Salts prevent precomputation
attacks (rainbow tables) and ensure that identical passwords produce different hashes.

### Requirements

1. Generate salts using a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG).
2. Use a minimum of 16 bytes (128 bits) of salt.
3. Generate a new salt for every password hash operation, including password changes.
4. Store the salt alongside the hash (most libraries handle this automatically).
5. Never reuse salts across users or across password changes for the same user.

### CSPRNG Sources by Language

| Language    | CSPRNG Source                          |
|-------------|----------------------------------------|
| TypeScript  | `crypto.randomBytes(16)`              |
| Go          | `crypto/rand.Read()`                  |
| Python      | `os.urandom(16)` or `secrets.token_bytes(16)` |
| Java        | `SecureRandom.getInstanceStrong()`    |
| C#          | `RandomNumberGenerator.GetBytes(16)`  |

Never use `Math.random()`, `rand()`, or any non-cryptographic PRNG for salt generation.
These functions are predictable and can be reversed by an attacker.

---

## Pepper (Application-Level Secret)

A pepper is a secret value added to passwords before hashing that is stored separately
from the password database, typically in application configuration, a hardware security
module (HSM), or a secrets manager.

### Purpose

If an attacker obtains a database dump but not the application secrets, the pepper
prevents offline brute-force attacks even against weak passwords. The pepper adds a
layer of defense-in-depth.

### Implementation Approaches

**Approach 1: Prepend pepper before hashing**
Concatenate the pepper with the password before passing to the hash function. This is
simple but means changing the pepper requires rehashing all passwords.

**Approach 2: Encrypt the hash with the pepper (recommended)**
Hash the password normally, then encrypt the resulting hash using AES-256-GCM with the
pepper as the key. This allows pepper rotation without rehashing: decrypt with the old
pepper, re-encrypt with the new pepper.

### Pepper Management Rules

1. Store the pepper in a secrets manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault).
2. Never store the pepper in the database or in source code.
3. Use a minimum of 32 bytes of entropy for the pepper.
4. Plan for pepper rotation: use versioned peppers and store the pepper version with each hash.
5. Limit access to the pepper to the authentication service only.

---

## NIST SP 800-63B Guidelines

NIST Special Publication 800-63B defines digital identity guidelines for authentication.
These guidelines represent a significant shift from traditional password policies.

### Mandatory Requirements

1. **Minimum length of 8 characters.** Allow up to at least 64 characters.
2. **No composition rules.** Do not require uppercase, lowercase, digits, or special characters.
3. **No periodic rotation.** Do not force password changes on a schedule.
4. **Check against breached password lists.** Reject passwords found in known breach datasets.
5. **Check against commonly used passwords.** Reject passwords like "password", "12345678", etc.
6. **Check against context-specific words.** Reject passwords containing the username, service name, etc.
7. **Allow paste into password fields.** Do not disable clipboard paste on password inputs.
8. **Show the password option.** Provide a toggle to display the password while typing.
9. **No password hints.** Do not store or display password hints accessible to unauthenticated users.
10. **No knowledge-based authentication.** Do not use security questions.

### Rationale

Traditional complexity rules (e.g., requiring uppercase, lowercase, digit, and symbol)
lead to predictable patterns like "Password1!" and do not improve security. Periodic
rotation leads to incremental passwords like "Summer2024!", "Fall2024!", etc. These
rules increase user frustration without meaningfully improving resistance to attacks.

Breached password checking is the single most effective password policy control because
it directly prevents the use of known-compromised credentials.

---

## Breached Password Detection

### HaveIBeenPwned k-Anonymity API

The HIBP Pwned Passwords API uses a k-anonymity model that allows checking passwords
against a database of over 800 million breached passwords without revealing the
password to the API.

**How it works:**
1. Hash the password with SHA-1.
2. Send the first 5 characters of the hex-encoded hash to the API.
3. The API returns all hash suffixes matching that prefix.
4. Check if the full hash appears in the returned list.

This approach ensures the full password hash is never transmitted, preserving user privacy.

### Implementation: TypeScript

```typescript
import crypto from "crypto";

interface BreachCheckResult {
  breached: boolean;
  count: number;
}

async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  const sha1Hash = crypto
    .createHash("sha1")
    .update(password)
    .digest("hex")
    .toUpperCase();

  const prefix = sha1Hash.substring(0, 5);
  const suffix = sha1Hash.substring(5);

  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    {
      headers: {
        "User-Agent": "MyApp-PasswordChecker/1.0",
        "Add-Padding": "true", // Prevents response length analysis
      },
    }
  );

  if (!response.ok) {
    // Fail open: do not block registration if API is unavailable
    // Log the failure for monitoring
    console.error(`HIBP API returned ${response.status}`);
    return { breached: false, count: 0 };
  }

  const body = await response.text();
  const lines = body.split("\r\n");

  for (const line of lines) {
    const [hashSuffix, count] = line.split(":");
    if (hashSuffix === suffix) {
      return { breached: true, count: parseInt(count, 10) };
    }
  }

  return { breached: false, count: 0 };
}

// Usage in registration flow
async function validatePassword(password: string, username: string): Promise<string[]> {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long.");
  }

  if (password.length > 128) {
    errors.push("Password must not exceed 128 characters.");
  }

  if (password.toLowerCase().includes(username.toLowerCase())) {
    errors.push("Password must not contain your username.");
  }

  const breachResult = await checkPasswordBreach(password);
  if (breachResult.breached) {
    errors.push(
      `This password has appeared in ${breachResult.count} data breaches. Choose a different password.`
    );
  }

  return errors;
}
```

### Implementation: Go

```go
package password

import (
    "crypto/sha1"
    "fmt"
    "io"
    "net/http"
    "strconv"
    "strings"
    "time"
)

type BreachCheckResult struct {
    Breached bool
    Count    int
}

var httpClient = &http.Client{
    Timeout: 5 * time.Second,
}

func CheckPasswordBreach(password string) (BreachCheckResult, error) {
    hash := sha1.New()
    hash.Write([]byte(password))
    sha1Hash := fmt.Sprintf("%X", hash.Sum(nil))

    prefix := sha1Hash[:5]
    suffix := sha1Hash[5:]

    req, err := http.NewRequest("GET",
        fmt.Sprintf("https://api.pwnedpasswords.com/range/%s", prefix), nil)
    if err != nil {
        return BreachCheckResult{}, fmt.Errorf("creating request: %w", err)
    }

    req.Header.Set("User-Agent", "MyApp-PasswordChecker/1.0")
    req.Header.Set("Add-Padding", "true")

    resp, err := httpClient.Do(req)
    if err != nil {
        return BreachCheckResult{}, fmt.Errorf("HIBP API request failed: %w", err)
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return BreachCheckResult{}, fmt.Errorf("reading response: %w", err)
    }

    lines := strings.Split(string(body), "\r\n")
    for _, line := range lines {
        parts := strings.SplitN(line, ":", 2)
        if len(parts) == 2 && parts[0] == suffix {
            count, _ := strconv.Atoi(parts[1])
            return BreachCheckResult{Breached: true, Count: count}, nil
        }
    }

    return BreachCheckResult{Breached: false, Count: 0}, nil
}
```

### Implementation: Python

```python
import hashlib
import requests

def check_password_breach(password: str) -> tuple[bool, int]:
    """Check password against HaveIBeenPwned k-anonymity API."""
    sha1_hash = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix = sha1_hash[:5]
    suffix = sha1_hash[5:]

    response = requests.get(
        f"https://api.pwnedpasswords.com/range/{prefix}",
        headers={
            "User-Agent": "MyApp-PasswordChecker/1.0",
            "Add-Padding": "true",
        },
        timeout=5,
    )
    response.raise_for_status()

    for line in response.text.splitlines():
        hash_suffix, count = line.split(":")
        if hash_suffix == suffix:
            return True, int(count)

    return False, 0
```

---

## Password Strength Estimation

### zxcvbn

zxcvbn is a realistic password strength estimator developed by Dropbox. Unlike simple
rule-based validators, zxcvbn analyzes passwords for common patterns including
dictionary words, sequences, dates, keyboard patterns, and l33t substitutions.

**Strength Scores:**

| Score | Meaning                          | Estimated Guesses |
|-------|----------------------------------|-------------------|
| 0     | Too guessable                    | < 10^3            |
| 1     | Very guessable                   | < 10^6            |
| 2     | Somewhat guessable               | < 10^8            |
| 3     | Safely unguessable               | < 10^10           |
| 4     | Very unguessable                 | >= 10^10          |

**Require a minimum score of 3 for all passwords.**

### TypeScript Implementation

```typescript
import zxcvbn from "zxcvbn";

interface PasswordStrengthResult {
  score: number;
  feedback: string[];
  estimatedCrackTime: string;
  acceptable: boolean;
}

function evaluatePasswordStrength(
  password: string,
  userInputs: string[] = []
): PasswordStrengthResult {
  // Pass user-specific data to penalize passwords containing personal info
  const result = zxcvbn(password, userInputs);

  const feedback: string[] = [];
  if (result.feedback.warning) {
    feedback.push(result.feedback.warning);
  }
  feedback.push(...result.feedback.suggestions);

  return {
    score: result.score,
    feedback,
    estimatedCrackTime:
      result.crack_times_display.offline_slow_hashing_1e4_per_second as string,
    acceptable: result.score >= 3,
  };
}

// Usage
const strength = evaluatePasswordStrength("correcthorsebatterystaple", [
  "john",
  "doe",
  "john.doe@example.com",
]);
```

### Python Implementation

```python
from zxcvbn import zxcvbn

def evaluate_password_strength(
    password: str, user_inputs: list[str] | None = None
) -> dict:
    """Evaluate password strength using zxcvbn."""
    result = zxcvbn(password, user_inputs=user_inputs or [])

    return {
        "score": result["score"],
        "feedback": result["feedback"],
        "crack_time": result["crack_times_display"][
            "offline_slow_hashing_1e4_per_second"
        ],
        "acceptable": result["score"] >= 3,
    }
```

---

## Password Hashing Implementation

### TypeScript (Argon2id)

```typescript
import argon2 from "argon2";
import crypto from "crypto";

interface HashOptions {
  memoryCost: number; // in KB
  timeCost: number;
  parallelism: number;
  hashLength: number;
  saltLength: number;
}

const DEFAULT_OPTIONS: HashOptions = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  saltLength: 16,
};

async function hashPassword(
  password: string,
  pepper: string,
  options: HashOptions = DEFAULT_OPTIONS
): Promise<string> {
  // Apply pepper before hashing
  const pepperedPassword = password + pepper;

  const hash = await argon2.hash(pepperedPassword, {
    type: argon2.argon2id,
    memoryCost: options.memoryCost,
    timeCost: options.timeCost,
    parallelism: options.parallelism,
    hashLength: options.hashLength,
    saltLength: options.saltLength,
  });

  return hash; // Returns encoded string with algorithm, params, salt, and hash
}

async function verifyPassword(
  password: string,
  hash: string,
  pepper: string
): Promise<boolean> {
  const pepperedPassword = password + pepper;

  try {
    return await argon2.verify(hash, pepperedPassword);
  } catch {
    return false;
  }
}

// Check if hash needs rehashing (parameter upgrade)
function needsRehash(hash: string, options: HashOptions = DEFAULT_OPTIONS): boolean {
  return argon2.needsRehash(hash, {
    memoryCost: options.memoryCost,
    timeCost: options.timeCost,
  });
}
```

### Go (Argon2id)

```go
package password

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

var DefaultParams = Argon2Params{
    Memory:      64 * 1024, // 64 MB
    Iterations:  3,
    Parallelism: 4,
    SaltLength:  16,
    KeyLength:   32,
}

func HashPassword(password, pepper string) (string, error) {
    pepperedPassword := password + pepper

    salt := make([]byte, DefaultParams.SaltLength)
    if _, err := rand.Read(salt); err != nil {
        return "", fmt.Errorf("generating salt: %w", err)
    }

    hash := argon2.IDKey(
        []byte(pepperedPassword),
        salt,
        DefaultParams.Iterations,
        DefaultParams.Memory,
        DefaultParams.Parallelism,
        DefaultParams.KeyLength,
    )

    // Encode as $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
    b64Salt := base64.RawStdEncoding.EncodeToString(salt)
    b64Hash := base64.RawStdEncoding.EncodeToString(hash)

    encoded := fmt.Sprintf(
        "$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
        argon2.Version, DefaultParams.Memory, DefaultParams.Iterations,
        DefaultParams.Parallelism, b64Salt, b64Hash,
    )

    return encoded, nil
}

func VerifyPassword(password, pepper, encodedHash string) (bool, error) {
    pepperedPassword := password + pepper

    params, salt, hash, err := decodeHash(encodedHash)
    if err != nil {
        return false, err
    }

    computedHash := argon2.IDKey(
        []byte(pepperedPassword),
        salt,
        params.Iterations,
        params.Memory,
        params.Parallelism,
        params.KeyLength,
    )

    return subtle.ConstantTimeCompare(hash, computedHash) == 1, nil
}

func decodeHash(encodedHash string) (*Argon2Params, []byte, []byte, error) {
    parts := strings.Split(encodedHash, "$")
    if len(parts) != 6 {
        return nil, nil, nil, fmt.Errorf("invalid hash format")
    }

    var params Argon2Params
    _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d",
        &params.Memory, &params.Iterations, &params.Parallelism)
    if err != nil {
        return nil, nil, nil, fmt.Errorf("parsing params: %w", err)
    }

    salt, err := base64.RawStdEncoding.DecodeString(parts[4])
    if err != nil {
        return nil, nil, nil, fmt.Errorf("decoding salt: %w", err)
    }
    params.SaltLength = uint32(len(salt))

    hash, err := base64.RawStdEncoding.DecodeString(parts[5])
    if err != nil {
        return nil, nil, nil, fmt.Errorf("decoding hash: %w", err)
    }
    params.KeyLength = uint32(len(hash))

    return &params, salt, hash, nil
}
```

### Python (Argon2id)

```python
import argon2

# Use the argon2-cffi library
password_hasher = argon2.PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str, pepper: str) -> str:
    """Hash a password with Argon2id and a pepper."""
    peppered_password = password + pepper
    return password_hasher.hash(peppered_password)


def verify_password(password: str, stored_hash: str, pepper: str) -> bool:
    """Verify a password against a stored Argon2id hash."""
    peppered_password = password + pepper
    try:
        return password_hasher.verify(stored_hash, peppered_password)
    except argon2.exceptions.VerifyMismatchError:
        return False
    except argon2.exceptions.InvalidHashError:
        return False


def needs_rehash(stored_hash: str) -> bool:
    """Check if a hash needs to be rehashed with updated parameters."""
    return password_hasher.check_needs_rehash(stored_hash)
```

### Java (Argon2id)

```java
import de.mkammerer.argon2.Argon2;
import de.mkammerer.argon2.Argon2Factory;

public class PasswordService {
    private static final int ITERATIONS = 3;
    private static final int MEMORY_KB = 65536; // 64 MB
    private static final int PARALLELISM = 4;
    private static final int HASH_LENGTH = 32;
    private static final int SALT_LENGTH = 16;

    private final Argon2 argon2;
    private final String pepper;

    public PasswordService(String pepper) {
        this.argon2 = Argon2Factory.create(
            Argon2Factory.Argon2Types.ARGON2id,
            SALT_LENGTH,
            HASH_LENGTH
        );
        this.pepper = pepper;
    }

    public String hashPassword(String password) {
        String pepperedPassword = password + pepper;
        char[] passwordChars = pepperedPassword.toCharArray();
        try {
            return argon2.hash(ITERATIONS, MEMORY_KB, PARALLELISM, passwordChars);
        } finally {
            argon2.wipeArray(passwordChars);
        }
    }

    public boolean verifyPassword(String password, String hash) {
        String pepperedPassword = password + pepper;
        char[] passwordChars = pepperedPassword.toCharArray();
        try {
            return argon2.verify(hash, passwordChars);
        } finally {
            argon2.wipeArray(passwordChars);
        }
    }
}
```

### C# (Argon2id)

```csharp
using Konscious.Security.Cryptography;
using System.Security.Cryptography;
using System.Text;

public class PasswordService
{
    private const int MemorySize = 65536; // 64 MB
    private const int Iterations = 3;
    private const int DegreeOfParallelism = 4;
    private const int HashLength = 32;
    private const int SaltLength = 16;

    private readonly byte[] _pepper;

    public PasswordService(string pepper)
    {
        _pepper = Encoding.UTF8.GetBytes(pepper);
    }

    public (string hash, string salt) HashPassword(string password)
    {
        var saltBytes = RandomNumberGenerator.GetBytes(SaltLength);
        var passwordBytes = Encoding.UTF8.GetBytes(password);

        // Combine password and pepper
        var combined = new byte[passwordBytes.Length + _pepper.Length];
        Buffer.BlockCopy(passwordBytes, 0, combined, 0, passwordBytes.Length);
        Buffer.BlockCopy(_pepper, 0, combined, passwordBytes.Length, _pepper.Length);

        using var argon2 = new Argon2id(combined)
        {
            Salt = saltBytes,
            MemorySize = MemorySize,
            Iterations = Iterations,
            DegreeOfParallelism = DegreeOfParallelism,
        };

        var hashBytes = argon2.GetBytes(HashLength);

        return (
            Convert.ToBase64String(hashBytes),
            Convert.ToBase64String(saltBytes)
        );
    }

    public bool VerifyPassword(string password, string storedHash, string storedSalt)
    {
        var saltBytes = Convert.FromBase64String(storedSalt);
        var passwordBytes = Encoding.UTF8.GetBytes(password);

        var combined = new byte[passwordBytes.Length + _pepper.Length];
        Buffer.BlockCopy(passwordBytes, 0, combined, 0, passwordBytes.Length);
        Buffer.BlockCopy(_pepper, 0, combined, passwordBytes.Length, _pepper.Length);

        using var argon2 = new Argon2id(combined)
        {
            Salt = saltBytes,
            MemorySize = MemorySize,
            Iterations = Iterations,
            DegreeOfParallelism = DegreeOfParallelism,
        };

        var hashBytes = argon2.GetBytes(HashLength);
        var computedHash = Convert.ToBase64String(hashBytes);

        return CryptographicOperations.FixedTimeEquals(
            Convert.FromBase64String(storedHash),
            hashBytes
        );
    }
}
```

---

## Password Storage Migration

### Upgrading Hash Algorithms

When migrating from a weaker hash algorithm (e.g., MD5, SHA-256, bcrypt) to a stronger
one (Argon2id), there are two strategies.

### Strategy 1: Wrap the Old Hash (Immediate, No User Action)

Hash the existing hash with the new algorithm. This provides immediate protection
for all users without requiring them to log in.

```
new_hash = argon2id(old_bcrypt_hash)
```

Store a version indicator with the hash to identify the wrapping scheme.

**Schema:**

```sql
ALTER TABLE users ADD COLUMN hash_version INTEGER NOT NULL DEFAULT 1;
-- version 1: bcrypt
-- version 2: argon2id(bcrypt)
-- version 3: argon2id (native, after user logs in)
```

### Strategy 2: Rehash on Login (Gradual)

When a user logs in successfully, rehash their password with the new algorithm.

```typescript
async function loginWithMigration(
  username: string,
  password: string,
  pepper: string
): Promise<boolean> {
  const user = await getUserByUsername(username);
  if (!user) return false;

  let verified = false;

  switch (user.hashVersion) {
    case 1: // Legacy bcrypt
      verified = await bcrypt.compare(password, user.passwordHash);
      break;
    case 2: // Wrapped: argon2id(bcrypt)
      const bcryptHash = await bcrypt.hash(password, user.legacySalt);
      verified = await argon2.verify(user.passwordHash, bcryptHash);
      break;
    case 3: // Native argon2id
      verified = await argon2.verify(user.passwordHash, password + pepper);
      break;
  }

  if (verified && user.hashVersion < 3) {
    // Upgrade to native argon2id
    const newHash = await hashPassword(password, pepper);
    await updateUserHash(user.id, newHash, 3);
  }

  return verified;
}
```

### Migration Timeline

1. **Week 0:** Deploy code that supports both old and new hash formats.
2. **Week 1:** Apply Strategy 1 (wrap all existing hashes).
3. **Ongoing:** Apply Strategy 2 (rehash on login).
4. **Month 6:** Notify users who have not logged in to reset passwords.
5. **Month 12:** Force password reset for remaining legacy hashes.

---

## Constant-Time Comparison

Always use constant-time comparison when verifying password hashes to prevent timing
attacks. Most password hashing libraries handle this internally, but if implementing
custom verification, use:

```typescript
import crypto from "crypto";

function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
```

```go
import "crypto/subtle"

func constantTimeEqual(a, b []byte) bool {
    return subtle.ConstantTimeCompare(a, b) == 1
}
```

```python
import hmac

def constant_time_equal(a: bytes, b: bytes) -> bool:
    return hmac.compare_digest(a, b)
```

---

## Rate Limiting and Account Lockout

### Rate Limiting Strategy

Implement rate limiting on authentication endpoints to prevent brute-force attacks.

```typescript
interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
  lockoutSeconds: number;
  ipMaxAttempts: number;
  ipWindowSeconds: number;
}

const config: RateLimitConfig = {
  maxAttempts: 5,       // Per account
  windowSeconds: 900,   // 15 minutes
  lockoutSeconds: 1800, // 30 minutes
  ipMaxAttempts: 20,    // Per IP
  ipWindowSeconds: 300, // 5 minutes
};
```

### Account Lockout Rules

1. Lock account after 5 failed attempts within 15 minutes.
2. Lockout duration: 30 minutes (progressive).
3. Do not reveal whether the username exists (return same error for invalid user and wrong password).
4. Log all failed attempts for security monitoring.
5. Send notification on lockout and on successful login after lockout.

### Credential Stuffing Protection

1. Rate limit by IP address in addition to account-based limiting.
2. Use CAPTCHA after 3 failed attempts.
3. Require MFA for login from new devices or locations.
4. Monitor for distributed attacks (same password tried across many accounts).

---

## Best Practices

1. **Use Argon2id as the primary hashing algorithm** with parameters of at least 64 MB memory, 3 iterations, and parallelism of 4. Benchmark on production hardware to ensure hashing completes within 500ms-1s.

2. **Generate unique salts for every hash operation** using a CSPRNG with a minimum of 16 bytes. Never reuse salts across users or across password changes.

3. **Implement a pepper stored outside the database** in a secrets manager or HSM. Version peppers and plan for rotation without requiring all users to re-authenticate.

4. **Follow NIST SP 800-63B guidelines strictly.** Enforce minimum 8 characters, allow up to 64+ characters, prohibit composition rules and forced rotation, allow paste, and check breached lists.

5. **Check every new password against the HaveIBeenPwned API** using the k-anonymity model. Reject any password found in known breaches. Fail open if the API is unavailable.

6. **Use zxcvbn for password strength estimation** and require a minimum score of 3. Pass user-specific data (username, email, name) as additional inputs to the estimator.

7. **Plan for hash algorithm migration from day one.** Store a hash version identifier alongside each hash. Implement wrap-and-rehash-on-login migration strategies.

8. **Use constant-time comparison for all hash verification** to prevent timing side-channel attacks. Rely on library implementations when available.

9. **Implement progressive rate limiting** on authentication endpoints. Rate limit by both account and IP address. Use exponential backoff for lockout durations.

10. **Never log passwords, even in error scenarios.** Redact password fields from all logs, error messages, and stack traces. Audit logging configuration regularly.

---

## Anti-Patterns

1. **Storing passwords in plaintext or with reversible encryption.** No encryption algorithm, regardless of strength, is acceptable for password storage. Passwords must be hashed with a one-way function. Every year, breaches reveal organizations that stored passwords in plaintext or with AES encryption instead of hashing.

2. **Using fast hash functions (MD5, SHA-1, SHA-256) without key stretching.** These algorithms are designed for speed and can be brute-forced at billions of hashes per second on modern GPUs. SHA-256 is a fine hash algorithm for data integrity but is catastrophically wrong for password storage.

3. **Using a global salt or no salt at all.** A single salt shared across all users provides no protection against precomputation attacks. Each password must have its own unique, randomly generated salt.

4. **Enforcing complex composition rules.** Requiring uppercase + lowercase + digit + symbol leads to predictable patterns ("Password1!") and does not improve security. Follow NIST guidelines and use strength estimation instead.

5. **Forcing periodic password rotation.** Mandatory rotation leads to weak incremental passwords ("January2024!", "February2024!") and increases helpdesk burden. Only require password changes when there is evidence of compromise.

6. **Truncating or limiting password length excessively.** Do not silently truncate passwords. Allow at least 64 characters. If the hash function has input limits (bcrypt: 72 bytes), pre-hash with SHA-256 and document this behavior.

7. **Implementing custom password hashing schemes.** Do not invent novel combinations of hash functions (e.g., MD5(SHA1(password) + salt)). Use well-audited, standard algorithms implemented by established libraries.

8. **Returning different error messages for invalid username vs. wrong password.** "Username not found" vs. "Incorrect password" allows user enumeration. Always return a generic message: "Invalid username or password."

---

## Enforcement Checklist

### Design Phase
- [ ] Selected Argon2id as the primary hashing algorithm with documented parameter rationale.
- [ ] Defined pepper management strategy including rotation plan.
- [ ] Designed password validation flow conforming to NIST SP 800-63B.
- [ ] Planned hash migration strategy with version tracking.
- [ ] Defined rate limiting and lockout thresholds.

### Implementation Phase
- [ ] Implemented password hashing using a vetted library (argon2-cffi, argon2, bcrypt).
- [ ] Salt generation uses CSPRNG with minimum 16 bytes.
- [ ] Pepper is loaded from secrets manager, not hardcoded.
- [ ] Breached password checking via HIBP k-anonymity API is implemented.
- [ ] Password strength estimation using zxcvbn is implemented.
- [ ] No composition rules or forced rotation in password policy.
- [ ] Password field allows paste and has a show/hide toggle.
- [ ] Minimum 8 characters, maximum 64+ characters enforced.
- [ ] Context-specific words (username, email, service name) are checked.
- [ ] Error messages do not reveal whether username exists.
- [ ] Constant-time comparison is used for hash verification.
- [ ] Rate limiting is implemented per account and per IP.

### Testing Phase
- [ ] Unit tests verify correct hashing and verification.
- [ ] Unit tests verify that different passwords produce different hashes.
- [ ] Unit tests verify that the same password with different salts produces different hashes.
- [ ] Integration tests verify breach checking with HIBP API.
- [ ] Security tests confirm no password values appear in logs.
- [ ] Load tests verify hashing performance under concurrent load.
- [ ] Rate limiting tests confirm lockout behavior.

### Deployment Phase
- [ ] Pepper is stored in production secrets manager.
- [ ] Hash parameters are benchmarked on production hardware.
- [ ] Monitoring alerts configured for authentication failures and lockouts.
- [ ] Incident response plan includes password breach notification procedures.
- [ ] Backup procedures do not expose unhashed passwords.

### Periodic Review
- [ ] Hash parameters are reviewed annually against hardware improvements.
- [ ] Pepper rotation is tested and documented.
- [ ] Breached password database is current (HIBP updates continuously).
- [ ] Rate limiting thresholds are reviewed against actual attack patterns.
- [ ] Audit logs are reviewed for credential stuffing indicators.
