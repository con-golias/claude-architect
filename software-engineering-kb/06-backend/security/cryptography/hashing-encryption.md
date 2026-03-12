# Hashing & Encryption

> **Domain:** Backend > Security > Cryptography
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Cryptography is the last layer of defense: if an attacker gains access to the database, properly hashed passwords and encrypted data mean they cannot do anything. Incorrect cryptography (MD5 passwords, ECB mode encryption, hardcoded keys) gives a false sense of security. In 2024 alone, data breaches with plaintext or weakly hashed passwords affected millions of users. Argon2id is now the gold standard (RFC 9106), AES-256-GCM for encryption, and NEVER roll your own crypto.

---

## How It Works

### Hashing vs Encryption

```
Hashing (One-Way)                    Encryption (Two-Way)
──────────────────                   ─────────────────────
Input → Hash → Digest               Input + Key → Ciphertext
                                     Ciphertext + Key → Input
"password" → "$argon2id$..."
                                     "SSN: 123" + key → "aGVsbG8..."
CANNOT reverse                       CAN reverse with key
Used for: passwords, integrity       Used for: sensitive data storage
```

### Hashing Taxonomy

| Purpose | Algorithm | Usage |
|---------|-----------|-------|
| **Password hashing** | Argon2id, bcrypt, scrypt | User passwords, API secrets |
| **Data integrity** | SHA-256, SHA-3 | File checksums, message signing |
| **HMAC** | HMAC-SHA256 | Webhook signatures, token validation |
| **Fast hashing** | BLAKE3, xxHash | Non-security: dedup, hash tables |

---

## Password Hashing

### Argon2id — The Gold Standard (RFC 9106)

Argon2 won the Password Hashing Competition (2015). Three variants:
- **Argon2d** — Resists GPU attacks (data-dependent memory access)
- **Argon2i** — Resists side-channel attacks (data-independent)
- **Argon2id** — **ALWAYS USE THIS** — hybrid, best of both

```typescript
// TypeScript — Argon2id with argon2 package
import argon2 from "argon2";

// OWASP recommended: Argon2id, 19MB memory, 2 iterations, 1 parallelism
// Higher settings for more security: 46MB, 1 iteration, 1 parallelism
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 47104,      // 46 MiB (OWASP alternative config)
  timeCost: 1,            // 1 iteration
  parallelism: 1,
  hashLength: 32,         // 256-bit output
  saltLength: 16,         // 128-bit salt (auto-generated)
};

// Hash password
async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
  // Returns: $argon2id$v=19$m=47104,t=1,p=1$salt$hash
}

// Verify password
async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // Invalid hash format = reject
  }
}

// Check if rehash needed (params upgraded)
async function needsRehash(hash: string): Promise<boolean> {
  return argon2.needsRehash(hash, HASH_OPTIONS);
}

// Login flow with automatic rehash
async function login(
  email: string,
  password: string
): Promise<User | null> {
  const user = await userRepo.findByEmail(email);
  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  // Upgrade hash if parameters changed
  if (await needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(password);
    await userRepo.updatePasswordHash(user.id, newHash);
  }

  return user;
}
```

```go
// Go — Argon2id with golang.org/x/crypto
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
    Memory      uint32 // KiB
    Iterations  uint32
    Parallelism uint8
    SaltLength  uint32
    KeyLength   uint32
}

// OWASP recommended parameters
var DefaultParams = Argon2Params{
    Memory:      47104, // 46 MiB
    Iterations:  1,
    Parallelism: 1,
    SaltLength:  16,
    KeyLength:   32,
}

func HashPassword(password string, params Argon2Params) (string, error) {
    salt := make([]byte, params.SaltLength)
    if _, err := rand.Read(salt); err != nil {
        return "", fmt.Errorf("generate salt: %w", err)
    }

    hash := argon2.IDKey(
        []byte(password),
        salt,
        params.Iterations,
        params.Memory,
        params.Parallelism,
        params.KeyLength,
    )

    // Encode as PHC string format
    b64Salt := base64.RawStdEncoding.EncodeToString(salt)
    b64Hash := base64.RawStdEncoding.EncodeToString(hash)

    return fmt.Sprintf(
        "$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
        argon2.Version, params.Memory, params.Iterations,
        params.Parallelism, b64Salt, b64Hash,
    ), nil
}

func VerifyPassword(password, encodedHash string) (bool, error) {
    params, salt, hash, err := decodeHash(encodedHash)
    if err != nil {
        return false, err
    }

    otherHash := argon2.IDKey(
        []byte(password),
        salt,
        params.Iterations,
        params.Memory,
        params.Parallelism,
        params.KeyLength,
    )

    // Constant-time comparison — prevents timing attacks
    return subtle.ConstantTimeCompare(hash, otherHash) == 1, nil
}

func decodeHash(encodedHash string) (Argon2Params, []byte, []byte, error) {
    parts := strings.Split(encodedHash, "$")
    if len(parts) != 6 {
        return Argon2Params{}, nil, nil, fmt.Errorf("invalid hash format")
    }

    var params Argon2Params
    _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d",
        &params.Memory, &params.Iterations, &params.Parallelism)
    if err != nil {
        return Argon2Params{}, nil, nil, err
    }

    salt, err := base64.RawStdEncoding.DecodeString(parts[4])
    if err != nil {
        return Argon2Params{}, nil, nil, err
    }
    params.SaltLength = uint32(len(salt))

    hash, err := base64.RawStdEncoding.DecodeString(parts[5])
    if err != nil {
        return Argon2Params{}, nil, nil, err
    }
    params.KeyLength = uint32(len(hash))

    return params, salt, hash, nil
}
```

```python
# Python — Argon2id with argon2-cffi
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

# OWASP recommended parameters
ph = PasswordHasher(
    time_cost=1,         # iterations
    memory_cost=47104,   # 46 MiB
    parallelism=1,
    hash_len=32,
    salt_len=16,
    type=argon2.Type.ID,  # Argon2id
)

def hash_password(password: str) -> str:
    return ph.hash(password)
    # Returns: $argon2id$v=19$m=47104,t=1,p=1$salt$hash

def verify_password(password: str, hash: str) -> bool:
    try:
        return ph.verify(hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False

def needs_rehash(hash: str) -> bool:
    return ph.check_needs_rehash(hash)

async def login(email: str, password: str) -> User | None:
    user = await user_repo.find_by_email(email)
    if not user:
        # Prevent timing attacks — hash anyway
        ph.hash("dummy-password")
        return None

    if not verify_password(password, user.password_hash):
        return None

    # Automatic rehash on parameter upgrade
    if needs_rehash(user.password_hash):
        new_hash = hash_password(password)
        await user_repo.update_password_hash(user.id, new_hash)

    return user
```

### Password Hashing Comparison

| Algorithm | Memory-Hard | GPU Resistant | Side-Channel Resistant | Recommended |
|-----------|:-----------:|:------------:|:---------------------:|:-----------:|
| **Argon2id** | ✅ | ✅ | ✅ | **YES — First choice** |
| **bcrypt** | ❌ | Partial | ✅ | YES — Legacy systems |
| **scrypt** | ✅ | ✅ | ❌ | OK — If Argon2 unavailable |
| **PBKDF2** | ❌ | ❌ | ✅ | Only if FIPS required |
| **SHA-256** | ❌ | ❌ | ❌ | **NEVER for passwords** |
| **MD5** | ❌ | ❌ | ❌ | **NEVER — Broken** |

### Pepper — Additional Defense in Depth

```typescript
// Pepper: server-side secret added BEFORE hashing
// If DB is leaked, attacker still needs the pepper
import crypto from "crypto";

const PEPPER = process.env.PASSWORD_PEPPER!; // 32-byte hex from env

function pepperPassword(password: string): string {
  return crypto
    .createHmac("sha256", PEPPER)
    .update(password)
    .digest("hex");
}

async function hashWithPepper(password: string): Promise<string> {
  const peppered = pepperPassword(password);
  return argon2.hash(peppered, HASH_OPTIONS);
}

async function verifyWithPepper(
  password: string,
  hash: string
): Promise<boolean> {
  const peppered = pepperPassword(password);
  return argon2.verify(hash, peppered);
}
```

---

## Symmetric Encryption (AES-256-GCM)

### Encryption at Rest

```typescript
// TypeScript — AES-256-GCM (Authenticated Encryption)
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;    // 96-bit IV for GCM (NIST recommended)
const TAG_LENGTH = 16;   // 128-bit auth tag
const KEY_LENGTH = 32;   // 256-bit key

interface EncryptedData {
  ciphertext: string;  // Base64
  iv: string;          // Base64
  tag: string;         // Base64
  version: number;     // Key version for rotation
}

function encrypt(plaintext: string, key: Buffer): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    version: 1,
  };
}

function decrypt(data: EncryptedData, key: Buffer): string {
  const iv = Buffer.from(data.iv, "base64");
  const tag = Buffer.from(data.tag, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(data.ciphertext, "base64", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}

// Usage: Encrypt sensitive fields before storing in DB
class EncryptedFieldService {
  private keys: Map<number, Buffer>;
  private currentVersion: number;

  constructor(keyConfig: { version: number; key: string }[]) {
    this.keys = new Map();
    for (const { version, key } of keyConfig) {
      this.keys.set(version, Buffer.from(key, "hex"));
    }
    this.currentVersion = Math.max(...this.keys.keys());
  }

  encryptField(value: string): string {
    const key = this.keys.get(this.currentVersion)!;
    const encrypted = encrypt(value, key);
    return JSON.stringify(encrypted);
  }

  decryptField(stored: string): string {
    const data: EncryptedData = JSON.parse(stored);
    const key = this.keys.get(data.version);
    if (!key) {
      throw new Error(`Unknown key version: ${data.version}`);
    }
    return decrypt(data, key);
  }
}
```

```go
// Go — AES-256-GCM
package crypto

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "encoding/json"
    "fmt"
)

type EncryptedData struct {
    Ciphertext string `json:"ciphertext"`
    IV         string `json:"iv"`
    Tag        string `json:"tag"`
    Version    int    `json:"version"`
}

func Encrypt(plaintext []byte, key []byte) (*EncryptedData, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, fmt.Errorf("create cipher: %w", err)
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, fmt.Errorf("create GCM: %w", err)
    }

    nonce := make([]byte, gcm.NonceSize()) // 12 bytes
    if _, err := rand.Read(nonce); err != nil {
        return nil, fmt.Errorf("generate nonce: %w", err)
    }

    // Seal appends ciphertext + auth tag
    sealed := gcm.Seal(nil, nonce, plaintext, nil)

    // Split ciphertext and tag
    tagStart := len(sealed) - gcm.Overhead()
    ciphertext := sealed[:tagStart]
    tag := sealed[tagStart:]

    return &EncryptedData{
        Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
        IV:         base64.StdEncoding.EncodeToString(nonce),
        Tag:        base64.StdEncoding.EncodeToString(tag),
        Version:    1,
    }, nil
}

func Decrypt(data *EncryptedData, key []byte) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, fmt.Errorf("create cipher: %w", err)
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, fmt.Errorf("create GCM: %w", err)
    }

    nonce, err := base64.StdEncoding.DecodeString(data.IV)
    if err != nil {
        return nil, fmt.Errorf("decode nonce: %w", err)
    }

    ciphertext, err := base64.StdEncoding.DecodeString(data.Ciphertext)
    if err != nil {
        return nil, fmt.Errorf("decode ciphertext: %w", err)
    }

    tag, err := base64.StdEncoding.DecodeString(data.Tag)
    if err != nil {
        return nil, fmt.Errorf("decode tag: %w", err)
    }

    // GCM.Open expects ciphertext + tag concatenated
    sealed := append(ciphertext, tag...)
    plaintext, err := gcm.Open(nil, nonce, sealed, nil)
    if err != nil {
        return nil, fmt.Errorf("decrypt: %w", err)
    }

    return plaintext, nil
}
```

```python
# Python — AES-256-GCM with cryptography library
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import json
import os
from dataclasses import dataclass

@dataclass
class EncryptedData:
    ciphertext: str  # Base64
    iv: str          # Base64
    version: int

def encrypt(plaintext: bytes, key: bytes) -> EncryptedData:
    # AES-256 requires 32-byte key
    assert len(key) == 32, "Key must be 32 bytes"

    aesgcm = AESGCM(key)
    iv = os.urandom(12)  # 96-bit nonce

    # GCM automatically appends auth tag to ciphertext
    ciphertext = aesgcm.encrypt(iv, plaintext, None)

    return EncryptedData(
        ciphertext=base64.b64encode(ciphertext).decode(),
        iv=base64.b64encode(iv).decode(),
        version=1,
    )

def decrypt(data: EncryptedData, key: bytes) -> bytes:
    aesgcm = AESGCM(key)
    iv = base64.b64decode(data.iv)
    ciphertext = base64.b64decode(data.ciphertext)

    return aesgcm.decrypt(iv, ciphertext, None)

# Field-level encryption for database columns
class FieldEncryptor:
    def __init__(self, keys: dict[int, bytes]):
        self.keys = keys
        self.current_version = max(keys.keys())

    def encrypt_field(self, value: str) -> str:
        key = self.keys[self.current_version]
        encrypted = encrypt(value.encode(), key)
        return json.dumps({
            "ct": encrypted.ciphertext,
            "iv": encrypted.iv,
            "v": encrypted.version,
        })

    def decrypt_field(self, stored: str) -> str:
        data = json.loads(stored)
        key = self.keys[data["v"]]
        result = decrypt(
            EncryptedData(
                ciphertext=data["ct"],
                iv=data["iv"],
                version=data["v"],
            ),
            key,
        )
        return result.decode()
```

---

## Envelope Encryption

Pattern used by AWS KMS, Google Cloud KMS, Azure Key Vault.

```
┌─────────────┐     generates    ┌─────────────┐
│  Master Key │─────────────────▶│  Data Key   │
│  (KMS)      │                  │  (DEK)      │
│  Never      │     encrypts     │             │
│  leaves KMS │────────────────▶ │  Encrypted  │
└─────────────┘                  │  DEK        │
                                 └──────┬──────┘
                                        │
                                        │  encrypts data
                                        ▼
                               ┌─────────────────┐
                               │  Encrypted Data  │
                               │  + Encrypted DEK │
                               │  (stored together)│
                               └─────────────────┘
```

**Why:** Master key never leaves KMS → if data is stolen, attacker needs KMS access to decrypt DEK to decrypt data. Key rotation only re-encrypts DEKs, not all data.

```typescript
// TypeScript — Envelope Encryption with AWS KMS
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import crypto from "crypto";

const kms = new KMSClient({ region: "eu-west-1" });
const MASTER_KEY_ID = "arn:aws:kms:eu-west-1:123456789:key/abcd-1234";

async function envelopeEncrypt(plaintext: string): Promise<{
  encryptedData: string;
  encryptedDEK: string;
  iv: string;
}> {
  // 1. Generate Data Encryption Key from KMS
  const { Plaintext: dekPlain, CiphertextBlob: dekEncrypted } =
    await kms.send(new GenerateDataKeyCommand({
      KeyId: MASTER_KEY_ID,
      KeySpec: "AES_256",
    }));

  // 2. Encrypt data with plaintext DEK
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dekPlain!, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  // 3. IMMEDIATELY zero out plaintext DEK from memory
  dekPlain!.fill(0);

  return {
    encryptedData: encrypted + "." + tag.toString("base64"),
    encryptedDEK: Buffer.from(dekEncrypted!).toString("base64"),
    iv: iv.toString("base64"),
  };
}

async function envelopeDecrypt(
  encryptedData: string,
  encryptedDEK: string,
  iv: string
): Promise<string> {
  // 1. Decrypt DEK using KMS
  const { Plaintext: dekPlain } = await kms.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(encryptedDEK, "base64"),
  }));

  // 2. Decrypt data with plaintext DEK
  const [ciphertext, tagB64] = encryptedData.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    dekPlain!,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  // 3. Zero out DEK
  dekPlain!.fill(0);

  return decrypted;
}
```

---

## Key Derivation Functions (KDF)

```typescript
// TypeScript — HKDF for deriving multiple keys from one secret
import crypto from "crypto";

// HKDF: Derive purpose-specific keys from master secret
function deriveKey(
  masterKey: Buffer,
  purpose: string,
  length: number = 32
): Buffer {
  return crypto.hkdfSync(
    "sha256",
    masterKey,
    Buffer.from(""),        // salt (optional)
    Buffer.from(purpose),   // info (context)
    length
  );
}

// Usage: Different keys for different purposes
const masterSecret = Buffer.from(process.env.MASTER_KEY!, "hex");
const encryptionKey = deriveKey(masterSecret, "encryption");
const signingKey = deriveKey(masterSecret, "signing");
const tokenKey = deriveKey(masterSecret, "token-generation");
```

---

## Secure Random Number Generation

```typescript
// TypeScript — Cryptographically secure random
import crypto from "crypto";

// ALWAYS use crypto.randomBytes, NEVER Math.random()
function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

function generateURLSafeToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

// Generate random integer in range
function secureRandomInt(min: number, max: number): number {
  const range = max - min;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  let randomValue: number;

  do {
    randomValue = parseInt(
      crypto.randomBytes(bytesNeeded).toString("hex"),
      16
    );
  } while (randomValue >= range);

  return min + randomValue;
}
```

```go
// Go — crypto/rand (ALWAYS, never math/rand for security)
package security

import (
    "crypto/rand"
    "encoding/base64"
    "encoding/hex"
)

func GenerateToken(length int) (string, error) {
    bytes := make([]byte, length)
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return hex.EncodeToString(bytes), nil
}

func GenerateURLSafeToken(length int) (string, error) {
    bytes := make([]byte, length)
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return base64.RawURLEncoding.EncodeToString(bytes), nil
}
```

---

## Best Practices

1. **ALWAYS use Argon2id for passwords** — RFC 9106, OWASP recommended, memory-hard
2. **ALWAYS use AES-256-GCM for encryption** — authenticated encryption, prevents tampering
3. **ALWAYS use 96-bit (12-byte) nonces for GCM** — NIST SP 800-38D recommendation
4. **ALWAYS use crypto.randomBytes / crypto/rand** — NEVER Math.random() for security
5. **ALWAYS use envelope encryption for data at rest** — master key in KMS, data keys for data
6. **ALWAYS derive purpose-specific keys** — HKDF, never reuse same key for different purposes
7. **ALWAYS zero out sensitive data from memory** — DEKs, plaintext secrets
8. **ALWAYS use constant-time comparison** — timingSafeEqual, subtle.ConstantTimeCompare
9. **NEVER use MD5, SHA-1 for any security purpose** — broken, exploitable
10. **NEVER implement your own crypto algorithms** — use battle-tested libraries
11. **NEVER store encryption keys next to encrypted data** — keys in KMS/Vault, data in DB
12. **NEVER use ECB mode** — reveals patterns, use GCM or CBC with HMAC

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| MD5/SHA-1 for passwords | Cracked in seconds | Argon2id |
| SHA-256 for passwords (unsalted) | Rainbow table attack | Argon2id (includes salt) |
| Hardcoded encryption keys | Key leaked in source code | KMS/Vault, env vars |
| Same key for encrypt + sign | Vulnerability amplification | HKDF to derive separate keys |
| ECB mode | Pattern leakage in ciphertext | GCM (authenticated encryption) |
| Math.random() for tokens | Predictable, exploitable | crypto.randomBytes() |
| Storing key next to data | Single breach = full access | Envelope encryption, KMS |
| Rolling your own crypto | Subtle bugs, timing attacks | Use standard libraries |
| No key rotation | Compromised key = permanent access | Versioned keys, rotate quarterly |
| Pepper in database | Defeats purpose of pepper | Pepper in env/KMS only |

---

## Real-world Examples

### Stripe
- AES-256-GCM for card data at rest
- HSM-backed master keys (PCI DSS Level 1)
- Per-merchant data encryption keys
- Automatic key rotation every 90 days

### AWS
- Envelope encryption pattern (KMS + data keys)
- S3 SSE-KMS: server-side encryption with KMS keys
- RDS: TDE (Transparent Data Encryption) for PostgreSQL/MySQL
- Key rotation with automatic re-encryption of data keys

### 1Password
- Argon2id for master password
- SRP (Secure Remote Password) — server never sees password
- Dual-key encryption: account key + master password
- Memory-hard hashing to prevent GPU brute force

