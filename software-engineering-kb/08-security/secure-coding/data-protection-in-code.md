# Data Protection in Code

> **Domain:** Security > Secure Coding > Data Protection in Code
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

Data protection is not a policy document -- it is executable code. Every line that handles sensitive data is a potential leak: a plaintext password lingering in heap memory after authentication completes, an API key hardcoded in a repository that 47 engineers can read, a social security number written to a debug log that ships to three different log aggregators, a temp file with medical records left on disk because the process crashed before cleanup ran. These are not theoretical risks. They are the root causes behind the largest data breaches of the past decade.

The regulatory landscape makes code-level data protection a legal obligation. GDPR mandates data minimization and the right to erasure. PCI-DSS requires that cardholder data is never stored in plaintext after authorization. HIPAA demands that protected health information is secured at rest and in transit, with access logged and auditable. SOC2 requires that confidential data is classified, controlled, and disposed of securely. Failing any of these is not a bug -- it is a compliance violation with financial and legal consequences.

This guide covers the complete lifecycle of sensitive data in code: how it enters your system, how it is held in memory, how it is masked for display and logging, how it is classified and tagged at the type level, how it is protected from leaking through APIs and temporary files and clipboard operations and core dumps, and how it is destroyed -- securely and verifiably -- when no longer needed. Every recommendation includes working code in the languages that production systems actually use.

---

## Sensitive Data in Memory

When sensitive data -- passwords, encryption keys, tokens, personal information -- is loaded into process memory, it becomes vulnerable to memory dumps, core dumps, swap file analysis, garbage collector inspection, and heap scanning tools. The goal is to minimize the time sensitive data exists in cleartext memory and to overwrite it as soon as it is no longer needed.

### The String Immutability Problem

In languages with immutable strings (Java, C#, Python, Go, JavaScript), storing sensitive data in a string means you cannot reliably erase it. The runtime may keep copies in the string intern pool, in garbage collector generations, or in memory pages that are never zeroed. The only defense is to avoid strings entirely for sensitive data and use mutable byte arrays instead.

```
String Immutability Problem:

  Java String:
    - Immutable. Cannot overwrite characters in place.
    - May be interned (shared across the JVM).
    - Stays in memory until garbage collected (unpredictable).
    - FIX: Use char[] and zero it with Arrays.fill(chars, '\0').

  C# String:
    - Immutable. Copied by the runtime during operations.
    - FIX: Use SecureString for interactive input (deprecated in .NET Core
      for cross-platform but still valid on Windows).
    - FIX: Use byte[] or Span<byte> and zero after use.

  Go string:
    - Immutable. Backed by a read-only byte slice header.
    - FIX: Use []byte and zero it manually.
    - FIX: Use github.com/awnuber/memguard for guarded heap allocations.

  JavaScript/TypeScript:
    - Strings are immutable and garbage collected.
    - No reliable way to zero a JS string.
    - FIX: Use Buffer (Node.js) and call buffer.fill(0) after use.
    - FIX: Use Uint8Array and zero after use.

  Python:
    - Strings are immutable and interned for small values.
    - FIX: Use bytearray and overwrite contents after use.
    - FIX: ctypes to zero memory at the C level (fragile, last resort).

  Rust:
    - String and &str are immutable views.
    - FIX: Use zeroize crate. Derive Zeroize on types holding secrets.
    - FIX: Use secrecy crate for Secret<T> wrapper that zeros on drop.
```

### Java -- char[] Instead of String for Passwords

```java
// SECURE: Use char[] for passwords, zero after use

import java.util.Arrays;

public class SecurePasswordHandler {

    public boolean authenticate(char[] password) {
        try {
            // Use the password for authentication
            boolean valid = authService.verify(password);
            return valid;
        } finally {
            // CRITICAL: Zero the password from memory immediately
            Arrays.fill(password, '\0');
        }
    }

    // WRONG: String password stays in memory indefinitely
    // public boolean authenticate(String password) {
    //     return authService.verify(password);
    //     // password remains in heap until GC runs -- could be minutes or hours
    // }
}
```

### C# -- Secure Memory Handling

```csharp
using System;
using System.Runtime.InteropServices;
using System.Security;
using System.Security.Cryptography;

public static class SecureMemory
{
    // Zero a byte array after use
    public static void ZeroAndFree(byte[] sensitiveData)
    {
        if (sensitiveData != null)
        {
            CryptographicOperations.ZeroMemory(sensitiveData);
        }
    }

    // Use Span<byte> for stack-allocated secrets (short-lived)
    public static void ProcessSecret(ReadOnlySpan<byte> encryptedKey, byte[] kek)
    {
        // Stack-allocate the decrypted key -- never touches the heap
        Span<byte> decryptedKey = stackalloc byte[32];
        try
        {
            DecryptKey(encryptedKey, kek, decryptedKey);
            UseKey(decryptedKey);
        }
        finally
        {
            // Zero the stack memory
            decryptedKey.Clear();
        }
    }
}
```

### Go -- Zeroing Byte Slices and memguard

```go
package security

import (
    "crypto/subtle"
    "unsafe"
)

// ZeroBytes overwrites a byte slice with zeros.
// Use defer ZeroBytes(secret) immediately after allocation.
func ZeroBytes(b []byte) {
    for i := range b {
        b[i] = 0
    }
}

// Example: handling a decrypted key
func processEncryptedData(encryptedKey, data []byte) ([]byte, error) {
    plainKey, err := decryptKey(encryptedKey)
    if err != nil {
        return nil, err
    }
    defer ZeroBytes(plainKey) // Zero the key when this function returns

    return decryptData(plainKey, data)
}

// For high-security scenarios, use memguard:
//
// import "github.com/awnuber/memguard"
//
// func handleSecret() {
//     // Creates a guarded buffer: mlock'd, canary-protected, zeroed on destroy
//     secret := memguard.NewBufferFromBytes(rawSecret)
//     defer secret.Destroy()
//
//     // Access the data via secret.Bytes()
//     useSecret(secret.Bytes())
//     // On Destroy(): memory is zeroed, munlock'd, and guard pages removed
// }
```

### Rust -- zeroize and secrecy Crates

```rust
use zeroize::{Zeroize, ZeroizeOnDrop};
use secrecy::{Secret, ExposeSecret};

// Derive ZeroizeOnDrop: memory is automatically zeroed when the value is dropped
#[derive(Zeroize, ZeroizeOnDrop)]
struct EncryptionKey {
    key_material: Vec<u8>,
}

// Use Secret<T> to prevent accidental logging or display
fn process_api_key(api_key: Secret<String>) {
    // Must explicitly call expose_secret() -- prevents accidental display/debug
    let key_value = api_key.expose_secret();
    authenticate(key_value);
    // When api_key is dropped, the inner String is zeroed automatically
}

// Secret<T> implements Debug as "Secret([REDACTED])"
// This prevents accidental logging:
// println!("{:?}", api_key);  // prints: Secret([REDACTED])
```

### TypeScript/Node.js -- Buffer Zeroing

```typescript
import { randomBytes } from "crypto";

function processSecret(encryptedKey: Buffer): void {
  const plaintextKey = decryptKey(encryptedKey);
  try {
    useKey(plaintextKey);
  } finally {
    // Zero the buffer contents -- this is the best we can do in Node.js
    plaintextKey.fill(0);
  }
}

// For Uint8Array in browser environments:
function zeroUint8Array(arr: Uint8Array): void {
  arr.fill(0);
}

// WRONG: String cannot be zeroed
// const secret: string = "my-api-key"; // Stays in memory until GC
```

### Garbage Collector Implications

```
Garbage collectors create copies of objects during:
  - Generational promotion (young gen -> old gen)
  - Compaction (objects are moved, old location not zeroed)
  - String interning (duplicate strings may share memory)

Mitigation strategies:
  1. Minimize the lifetime of sensitive data in managed memory.
  2. Use mutable containers (byte arrays) instead of immutable strings.
  3. Zero mutable containers immediately after use.
  4. For maximum security, use OS-level protections:
     - mlock() to prevent swapping to disk
     - guard pages to detect buffer overflows
     - memguard (Go), secrecy (Rust), or platform-specific APIs
  5. Accept that in GC languages, brief residual copies may exist.
     The goal is to reduce the window from "indefinite" to "milliseconds."
```

---

## Hardcoded Secrets Prevention

Hardcoded credentials (CWE-798) are one of the most common and most dangerous security defects. A password, API key, or private key committed to source code is exposed to every developer, every CI system, every container image, and every backup of the repository -- permanently. Even if the commit is later deleted, it remains in the Git history.

### Why Hardcoded Credentials Are Dangerous

```
Attack surface of a hardcoded secret:

  1. Source code repository (every developer, contractor, and CI bot)
  2. Git history (git log --all --full-history -- stays forever)
  3. Forks of the repository (public or internal)
  4. CI/CD build logs (if echoed during build)
  5. Container images (baked into layers, extractable with dive)
  6. Compiled binaries (extractable with strings command)
  7. Backup tapes and disaster recovery snapshots
  8. Code review tools (Gerrit, GitHub, GitLab -- indexed and searchable)

  A single hardcoded AWS key has led to six-figure cloud bills from
  cryptomining within hours of being pushed to a public repository.
```

### Detection Tools

Run secret detection tools in CI and as pre-commit hooks. Block merges that contain detected secrets.

```
Tool           What It Detects                              Integration
----           ----------------                              -----------
git-secrets    AWS keys, custom patterns                     Pre-commit hook
trufflehog     High-entropy strings, known secret patterns   CI pipeline, pre-commit
gitleaks       API keys, tokens, passwords across git history CI pipeline, GitHub Action
detect-secrets Yelp's tool, baseline-aware                   Pre-commit hook
talisman       Secrets, file patterns, checksums             Pre-commit hook (ThoughtWorks)
```

### Pre-commit Hook Configuration

```yaml
# .pre-commit-config.yaml -- Block secrets before they enter history
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']

  - repo: https://github.com/awslabs/git-secrets
    rev: master
    hooks:
      - id: git-secrets
```

### Where Secrets Should Live

```
CORRECT -- Runtime secret injection:

  1. Cloud Secret Managers:
     - AWS Secrets Manager / SSM Parameter Store
     - GCP Secret Manager
     - Azure Key Vault
     - HashiCorp Vault

  2. Environment variables (injected by orchestrator, NOT committed to .env):
     - Kubernetes Secrets (mounted as env vars or files)
     - Docker Swarm secrets
     - CI/CD variable stores (GitHub Actions secrets, GitLab CI variables)

  3. Configuration files (encrypted, not in source control):
     - SOPS-encrypted YAML/JSON (decrypted at deploy time)
     - sealed-secrets for Kubernetes

WRONG -- Where secrets must never be stored:

  - Source code (const API_KEY = "sk-...")
  - .env files committed to Git
  - Docker build args (visible in image history)
  - CI/CD pipeline YAML (unless using the platform's secret variable feature)
  - Comments in code ("// TODO: change this password")
  - Configuration files in the repository
```

### Code Examples -- Retrieving Secrets at Runtime

**TypeScript (AWS Secrets Manager):**

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} has no string value`);
  }
  return response.SecretString;
}

// Usage -- secret is fetched at runtime, never in code
const dbPassword = await getSecret("prod/database/password");

// WRONG: const dbPassword = "SuperSecret123!"; // CWE-798
```

**Go (HashiCorp Vault):**

```go
import (
    vault "github.com/hashicorp/vault/api"
)

func getSecret(path, key string) (string, error) {
    client, err := vault.NewClient(vault.DefaultConfig())
    if err != nil {
        return "", fmt.Errorf("creating vault client: %w", err)
    }

    secret, err := client.Logical().Read(path)
    if err != nil {
        return "", fmt.Errorf("reading secret at %s: %w", path, err)
    }
    if secret == nil || secret.Data == nil {
        return "", fmt.Errorf("no secret found at %s", path)
    }

    value, ok := secret.Data[key].(string)
    if !ok {
        return "", fmt.Errorf("key %s not found or not a string", key)
    }
    return value, nil
}

// WRONG: const dbPassword = "SuperSecret123!" // CWE-798
```

**Python (GCP Secret Manager):**

```python
from google.cloud import secretmanager

def get_secret(project_id: str, secret_id: str, version: str = "latest") -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("utf-8")

# Usage
db_password = get_secret("my-project", "database-password")

# WRONG: db_password = "SuperSecret123!"  # CWE-798
```

---

## PII Minimization

Collect only the personal data necessary for the stated purpose. Every additional field you collect increases your attack surface, your compliance burden, and the damage from a breach. This is not just a best practice -- it is a legal requirement under GDPR Article 5(1)(c) ("data minimization") and similar regulations worldwide.

### Data Classification

Classify every data field before collection. The classification determines storage, access controls, encryption requirements, retention, and breach notification obligations.

```
Classification    Examples                           Handling Requirements
--------------    --------                           ---------------------
PUBLIC            Marketing copy, public APIs,       No special handling.
                  open-source code

INTERNAL          Employee names, internal docs,     Access control required.
                  project names                      Not shared externally.

CONFIDENTIAL      Customer email, phone, address,    Encrypted at rest. Access
                  order history, IP addresses        logged. Retention limits.

RESTRICTED        SSN, passport, credit card,        Encrypted at rest and in
                  health records, biometric data,    transit. Field-level access
                  passwords, encryption keys         control. Audit every access.
                                                     Minimize retention. Breach
                                                     notification required.
```

### Anonymization vs. Pseudonymization

```
Anonymization:
  - IRREVERSIBLE removal of identifying information.
  - The data can NEVER be linked back to an individual.
  - Anonymized data is no longer "personal data" under GDPR.
  - Techniques: aggregation, generalization, suppression, noise addition.
  - Example: Replace exact age (34) with age range (30-39).
  - Example: Replace city (San Francisco) with region (West Coast).

Pseudonymization:
  - REVERSIBLE replacement of identifiers with tokens/pseudonyms.
  - The data CAN be re-linked using a separate mapping table.
  - Pseudonymized data IS still "personal data" under GDPR.
  - Techniques: tokenization, format-preserving encryption, hashing with salt.
  - Example: Replace email with token (user_abc123).
  - Example: Replace name with consistent pseudonym (same input = same output).

  Choose anonymization when:
    - Analytics, reporting, machine learning training data
    - Data sharing with third parties

  Choose pseudonymization when:
    - You need to re-identify individuals (support, account recovery)
    - You need referential integrity across datasets
```

### Statistical Privacy Techniques

```
K-Anonymity:
  Every record is indistinguishable from at least (k-1) other records
  on quasi-identifiers (age, ZIP, gender). If k=5, every combination of
  quasi-identifiers appears at least 5 times in the dataset.
  Weakness: vulnerable to homogeneity attack (all k records have same
  sensitive value) and background knowledge attack.

L-Diversity:
  Extension of k-anonymity. Each equivalence class (group of k records)
  must have at least L distinct values for the sensitive attribute.
  Prevents the homogeneity attack.
  Example: if L=3 and the sensitive attribute is "diagnosis," each group
  must have at least 3 different diagnoses.

T-Closeness:
  Extension of L-diversity. The distribution of sensitive values within
  each equivalence class must be within distance T of the global
  distribution. Prevents the skewness attack where L-diversity is
  satisfied but the distribution within a group is highly skewed
  compared to the overall population.
```

**Python -- K-Anonymity Check:**

```python
import pandas as pd

def check_k_anonymity(df: pd.DataFrame, quasi_identifiers: list[str], k: int) -> bool:
    """Check if a dataset satisfies k-anonymity for given quasi-identifiers."""
    group_sizes = df.groupby(quasi_identifiers).size()
    min_group_size = group_sizes.min()

    if min_group_size < k:
        violating_groups = group_sizes[group_sizes < k]
        print(f"K-anonymity violated. Smallest group has {min_group_size} records.")
        print(f"Violating groups:\n{violating_groups}")
        return False

    return True

def generalize_age(age: int, bin_size: int = 5) -> str:
    """Generalize exact age to a range for k-anonymity."""
    lower = (age // bin_size) * bin_size
    upper = lower + bin_size - 1
    return f"{lower}-{upper}"

def generalize_zip(zip_code: str, keep_digits: int = 3) -> str:
    """Generalize ZIP code by masking trailing digits."""
    return zip_code[:keep_digits] + "*" * (len(zip_code) - keep_digits)

# Usage
df["age_range"] = df["age"].apply(lambda a: generalize_age(a, bin_size=10))
df["zip_masked"] = df["zip_code"].apply(lambda z: generalize_zip(z, keep_digits=3))
df = df.drop(columns=["age", "zip_code"])  # Remove exact values

assert check_k_anonymity(df, ["age_range", "zip_masked", "gender"], k=5)
```

---

## Data Masking

Data masking replaces sensitive values with partially obscured versions for display in logs, UIs, API responses, and customer support tools. The goal is to convey enough information for the context (confirming the last 4 digits of a card, showing a partial email) without exposing the full value.

### Masking Functions

**TypeScript -- Comprehensive Masking Library:**

```typescript
// Data masking utilities for logs, APIs, and UI display

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const maskedLocal = local.length > 1
    ? local[0] + "*".repeat(local.length - 1)
    : "*";
  return `${maskedLocal}@${domain}`;
  // "john.doe@example.com" -> "j*******@example.com"
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return "*".repeat(digits.length - 4) + digits.slice(-4);
  // "+1-555-123-4567" -> "*******4567"
}

export function maskCreditCard(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return "*".repeat(digits.length - 4) + digits.slice(-4);
  // "4111-1111-1111-1111" -> "************1111"
}

export function maskSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return "***-**-****";
  return `***-**-${digits.slice(-4)}`;
  // "123-45-6789" -> "***-**-6789"
}

export function maskIPv4(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.xxx.xxx`;
  // "192.168.1.42" -> "192.168.xxx.xxx"
}

export function maskName(name: string): string {
  if (name.length <= 1) return "*";
  return name[0] + "*".repeat(name.length - 1);
  // "John" -> "J***"
}

export function maskBankAccount(account: string): string {
  const digits = account.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return "*".repeat(digits.length - 4) + digits.slice(-4);
  // "1234567890" -> "******7890"
}
```

**Go -- Masking Functions:**

```go
package masking

import (
    "strings"
    "unicode/utf8"
)

func MaskEmail(email string) string {
    parts := strings.SplitN(email, "@", 2)
    if len(parts) != 2 {
        return "***@***"
    }
    local := parts[0]
    if len(local) <= 1 {
        return "*@" + parts[1]
    }
    masked := string(local[0]) + strings.Repeat("*", len(local)-1)
    return masked + "@" + parts[1]
}

func MaskCreditCard(card string) string {
    digits := onlyDigits(card)
    if len(digits) < 4 {
        return "****"
    }
    return strings.Repeat("*", len(digits)-4) + digits[len(digits)-4:]
}

func MaskSSN(ssn string) string {
    digits := onlyDigits(ssn)
    if len(digits) < 4 {
        return "***-**-****"
    }
    return "***-**-" + digits[len(digits)-4:]
}

func onlyDigits(s string) string {
    var b strings.Builder
    for _, r := range s {
        if r >= '0' && r <= '9' {
            b.WriteRune(r)
        }
    }
    return b.String()
}
```

### Runtime Masking for Logs

Apply masking at the logging boundary so that sensitive data never reaches log storage.

**TypeScript -- Automatic Log Masking Middleware:**

```typescript
import pino from "pino";

// Fields that must always be masked in logs
const MASK_RULES: Record<string, (v: string) => string> = {
  email: maskEmail,
  phone: maskPhone,
  creditCard: maskCreditCard,
  cardNumber: maskCreditCard,
  ssn: maskSSN,
  socialSecurity: maskSSN,
  bankAccount: maskBankAccount,
  ip: maskIPv4,
  remoteAddress: maskIPv4,
};

function maskLogObject(obj: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && MASK_RULES[key]) {
      masked[key] = MASK_RULES[key](value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      masked[key] = maskLogObject(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// Use pino's built-in redaction for absolute guarantees on known paths
const logger = pino({
  redact: {
    paths: [
      "*.password",
      "*.secret",
      "*.token",
      "*.authorization",
      "*.cookie",
      "*.apiKey",
    ],
    censor: "[REDACTED]",
  },
});
```

### API Response Masking

Mask data in API responses based on the caller's access level.

```typescript
interface UserProfile {
  id: string;
  email: string;
  phone: string;
  ssn: string;
  name: string;
}

type AccessLevel = "owner" | "support" | "public";

function maskProfileForAccess(profile: UserProfile, level: AccessLevel): Partial<UserProfile> {
  switch (level) {
    case "owner":
      // Owner sees everything except SSN (shown masked)
      return { ...profile, ssn: maskSSN(profile.ssn) };
    case "support":
      // Support sees masked email, masked phone, no SSN
      return {
        id: profile.id,
        name: profile.name,
        email: maskEmail(profile.email),
        phone: maskPhone(profile.phone),
      };
    case "public":
      // Public sees only name and ID
      return { id: profile.id, name: profile.name };
  }
}
```

---

## Secure Data Deletion

When data must be deleted -- because of a user request under GDPR Article 17 (right to erasure), retention expiry, or account closure -- the deletion must be verifiable and irrecoverable. This is harder than it sounds: databases use soft deletes, file systems do not zero freed blocks, backups retain deleted data, and replicas propagate deletes asynchronously.

### Crypto-Shredding

Crypto-shredding is the most reliable deletion technique for distributed systems. Instead of finding and deleting every copy of data across every database, replica, backup, cache, and log, you encrypt the data with a per-entity key and delete the key when the data must be destroyed. Without the key, the encrypted data is unrecoverable.

```
Crypto-Shredding Flow:

  STORE:
  1. Generate a unique encryption key per entity (per user, per record).
  2. Encrypt the entity's sensitive data with this key.
  3. Store the encrypted data in the application database.
  4. Store the encryption key in a separate key store (KMS, Vault).

  DELETE:
  1. Delete the encryption key from the key store.
  2. The encrypted data remains in the database, backups, and replicas --
     but it is now unreadable. No key means no data.
  3. Optionally delete the encrypted blobs on your regular cleanup schedule.

  Advantages:
  - Works across distributed systems, replicas, and backups.
  - No need to track every copy of the data.
  - Deletion is instant (key deletion) rather than eventual (data propagation).
  - Auditable: key deletion is a logged event.
```

**TypeScript -- Crypto-Shredding Implementation:**

```typescript
import { KMSClient, CreateKeyCommand, ScheduleKeyDeletionCommand } from "@aws-sdk/client-kms";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

class CryptoShredder {
  private kms: KMSClient;

  constructor() {
    this.kms = new KMSClient({ region: "us-east-1" });
  }

  async createEntityKey(entityId: string): Promise<string> {
    const command = new CreateKeyCommand({
      Description: `Data key for entity ${entityId}`,
      Tags: [{ TagKey: "entity_id", TagValue: entityId }],
    });
    const response = await this.kms.send(command);
    return response.KeyMetadata!.KeyId!;
  }

  async shredEntity(entityId: string, keyId: string): Promise<void> {
    // Schedule the key for deletion -- data becomes unrecoverable
    const command = new ScheduleKeyDeletionCommand({
      KeyId: keyId,
      PendingWindowInDays: 7, // Minimum waiting period (allows cancellation)
    });
    await this.kms.send(command);

    // Log the shredding event for compliance audit
    auditLog.append({
      action: "crypto_shred",
      entityId,
      keyId,
      outcome: "success",
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Secure File Deletion

Standard file deletion (unlink, rm, os.remove) only removes the directory entry. The file contents remain on disk until overwritten by new data. For sensitive files, overwrite the contents before unlinking.

**Python -- Secure File Deletion:**

```python
import os
import secrets

def secure_delete_file(file_path: str, passes: int = 3) -> None:
    """Overwrite a file with random data before deleting it.

    Three passes: random data, zeros, random data.
    This is sufficient for modern storage (SSDs, HDDs with sanitize commands).
    For magnetic media requiring government-grade erasure, use hardware commands.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    file_size = os.path.getsize(file_path)

    with open(file_path, "r+b") as f:
        for pass_num in range(passes):
            f.seek(0)
            if pass_num % 2 == 0:
                # Random data pass
                remaining = file_size
                while remaining > 0:
                    chunk_size = min(remaining, 65536)
                    f.write(secrets.token_bytes(chunk_size))
                    remaining -= chunk_size
            else:
                # Zero pass
                f.write(b"\x00" * file_size)
            f.flush()
            os.fsync(f.fileno())  # Force write to physical storage

    os.remove(file_path)
```

**Go -- Secure File Deletion:**

```go
package security

import (
    "crypto/rand"
    "io"
    "os"
)

func SecureDeleteFile(path string, passes int) error {
    info, err := os.Stat(path)
    if err != nil {
        return err
    }
    size := info.Size()

    f, err := os.OpenFile(path, os.O_WRONLY, 0)
    if err != nil {
        return err
    }

    for pass := 0; pass < passes; pass++ {
        if _, err := f.Seek(0, io.SeekStart); err != nil {
            f.Close()
            return err
        }

        if pass%2 == 0 {
            // Random data pass
            if _, err := io.CopyN(f, rand.Reader, size); err != nil {
                f.Close()
                return err
            }
        } else {
            // Zero pass
            zeros := make([]byte, 65536)
            remaining := size
            for remaining > 0 {
                chunk := int64(len(zeros))
                if remaining < chunk {
                    chunk = remaining
                }
                if _, err := f.Write(zeros[:chunk]); err != nil {
                    f.Close()
                    return err
                }
                remaining -= chunk
            }
        }
        f.Sync()
    }

    f.Close()
    return os.Remove(path)
}
```

### Database Record Deletion: Hard Delete vs. Soft Delete

```
Hard Delete (DELETE FROM):
  - Record is removed from the table.
  - Still exists in WAL, backups, and replicas until those are purged.
  - Required for GDPR right to erasure (eventually, across all copies).
  - Combine with crypto-shredding for immediate effective deletion.

Soft Delete (SET deleted_at = NOW()):
  - Record remains in the table, marked as deleted.
  - Useful for audit trails, undo functionality, and referential integrity.
  - DOES NOT satisfy GDPR right to erasure -- the data is still there.
  - If soft-deleting for operational reasons, encrypt the sensitive fields
    and crypto-shred when the retention period expires.

Recommended Pattern:
  1. Soft delete for operational purposes (grace period, undo).
  2. Schedule hard delete after retention period expires.
  3. Use crypto-shredding so that even before hard delete, the data
     is unreadable in backups and replicas.
```

---

## Data Classification in Code

Use the type system to enforce data classification at compile time. Prevent sensitive data from being accidentally serialized, logged, displayed, or passed to functions that expect public data.

### TypeScript -- Branded Types for Data Classification

```typescript
// Use branded types to make data classification a compile-time concern

// Brand interface -- zero runtime cost
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// Classified data types
type PublicString = Brand<string, "Public">;
type InternalString = Brand<string, "Internal">;
type ConfidentialString = Brand<string, "Confidential">;
type RestrictedString = Brand<string, "Restricted">;

// Constructor functions with validation
function asPublic(value: string): PublicString {
  return value as PublicString;
}

function asConfidential(value: string): ConfidentialString {
  return value as ConfidentialString;
}

function asRestricted(value: string): RestrictedString {
  return value as RestrictedString;
}

// Functions that enforce classification at the type level
function logPublicData(data: PublicString): void {
  logger.info({ value: data }); // Safe to log
}

function logConfidentialData(data: ConfidentialString): void {
  // COMPILATION ERROR if you pass Restricted data to this function
  logger.info({ value: maskEmail(data) }); // Must mask before logging
}

// Prevent accidental serialization of restricted data
interface ApiResponse {
  name: PublicString;
  email: ConfidentialString; // OK in responses (masked)
  // ssn: RestrictedString;  // Should NEVER appear in API responses
}

// Usage
const email = asConfidential("user@example.com");
const ssn = asRestricted("123-45-6789");

logPublicData(email);  // COMPILE ERROR: Confidential is not Public
logPublicData(ssn);    // COMPILE ERROR: Restricted is not Public
```

### Rust -- Newtype Pattern for Sensitive Data

```rust
use serde::Serialize;
use std::fmt;

// Newtype wrappers that control serialization and display behavior

/// Email address -- displays masked, serializes masked
#[derive(Clone)]
pub struct Email(String);

impl Email {
    pub fn new(value: String) -> Self {
        Email(value)
    }

    /// Expose the raw value -- use only when actually needed
    pub fn expose(&self) -> &str {
        &self.0
    }

    fn masked(&self) -> String {
        let parts: Vec<&str> = self.0.splitn(2, '@').collect();
        if parts.len() != 2 {
            return "***@***".to_string();
        }
        let local = parts[0];
        let first_char = local.chars().next().unwrap_or('*');
        format!("{}***@{}", first_char, parts[1])
    }
}

// Debug and Display always show masked value -- safe for logging
impl fmt::Debug for Email {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Email({})", self.masked())
    }
}

impl fmt::Display for Email {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.masked())
    }
}

// Serialize outputs masked value -- safe for API responses
impl Serialize for Email {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.masked())
    }
}

/// SSN -- NEVER displayed or serialized in full
#[derive(Clone)]
pub struct SSN(String);

impl SSN {
    pub fn new(value: String) -> Self {
        SSN(value)
    }

    /// Expose raw value -- requires explicit call
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for SSN {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SSN([REDACTED])")
    }
}

impl fmt::Display for SSN {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let digits: String = self.0.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.len() >= 4 {
            write!(f, "***-**-{}", &digits[digits.len()-4..])
        } else {
            write!(f, "***-**-****")
        }
    }
}

// SSN is NOT Serialize -- cannot be included in API responses by accident
// If you try to put it in a Serialize struct, compilation fails.
```

### Java -- Preventing Sensitive Data in toString() and Serialization

```java
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

public class UserEntity {
    @JsonProperty("id")
    private String id;

    @JsonProperty("name")
    private String name;

    @JsonProperty("email")
    private String email;

    // NEVER serialize SSN -- @JsonIgnore prevents Jackson from including it
    @JsonIgnore
    private String ssn;

    // NEVER serialize password hash
    @JsonIgnore
    private String passwordHash;

    @Override
    public String toString() {
        // SECURE: toString() never includes sensitive fields
        return String.format("UserEntity{id=%s, name=%s, email=%s}",
            id, name, maskEmail(email));
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***@***";
        String[] parts = email.split("@", 2);
        return parts[0].charAt(0) + "***@" + parts[1];
    }
}
```

---

## Clipboard Security

When users copy sensitive data to the clipboard (passwords, API keys, credit card numbers), it remains accessible to every application on the system until it is overwritten. Clipboard managers may persist it indefinitely.

### Clearing Sensitive Data from Clipboard

**TypeScript (Electron / Desktop Applications):**

```typescript
import { clipboard } from "electron";

function copySecretToClipboard(secret: string, clearAfterMs: number = 30000): void {
  clipboard.writeText(secret);

  // Clear the clipboard after 30 seconds
  setTimeout(() => {
    // Only clear if the clipboard still contains our secret
    if (clipboard.readText() === secret) {
      clipboard.writeText("");
    }
  }, clearAfterMs);
}
```

**Python (Cross-Platform Clipboard Clear):**

```python
import subprocess
import threading
import platform

def copy_to_clipboard_with_auto_clear(text: str, clear_after_seconds: int = 30) -> None:
    """Copy text to clipboard and clear it after a timeout."""
    system = platform.system()

    if system == "Darwin":
        subprocess.run(["pbcopy"], input=text.encode(), check=True)
    elif system == "Linux":
        subprocess.run(["xclip", "-selection", "clipboard"],
                       input=text.encode(), check=True)
    elif system == "Windows":
        subprocess.run(["clip"], input=text.encode(), check=True)

    def clear_clipboard():
        if system == "Darwin":
            subprocess.run(["pbcopy"], input=b"", check=True)
        elif system == "Linux":
            subprocess.run(["xclip", "-selection", "clipboard"],
                           input=b"", check=True)
        elif system == "Windows":
            subprocess.run(
                ["powershell", "-command", "Set-Clipboard -Value $null"],
                check=True,
            )

    timer = threading.Timer(clear_after_seconds, clear_clipboard)
    timer.daemon = True
    timer.start()
```

### Restricting Copy/Paste in Secure Contexts (Web)

```typescript
// Prevent copying sensitive data displayed in the browser

// CSS approach -- prevent text selection
// .sensitive-field { user-select: none; -webkit-user-select: none; }

// JavaScript approach -- intercept copy events
document.querySelector(".sensitive-field")?.addEventListener("copy", (event) => {
  event.preventDefault();
  // Optionally provide a masked version
  (event as ClipboardEvent).clipboardData?.setData("text/plain", "****");
});

// Prevent paste into non-secure fields (e.g., password confirmation)
document.querySelector("#confirm-password")?.addEventListener("paste", (event) => {
  event.preventDefault();
  // Force users to type the confirmation
});
```

---

## Data Leak Prevention in APIs

APIs are the most common vector for data leaks. Over-fetching (returning more fields than the client needs), missing field-level access control, and including internal fields in responses expose data that should never leave the server.

### Response Filtering -- Remove Internal Fields

**TypeScript -- Response DTO Pattern:**

```typescript
// NEVER return database entities directly. Map to response DTOs.

// Database entity -- contains internal fields
interface UserEntity {
  id: string;
  email: string;
  name: string;
  passwordHash: string;       // INTERNAL ONLY
  ssn: string;                // RESTRICTED
  internalNotes: string;      // INTERNAL ONLY
  createdAt: Date;
  failedLoginAttempts: number; // INTERNAL ONLY
  isLocked: boolean;          // INTERNAL ONLY
}

// Public API response -- only safe fields
interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// Map entity to response -- explicit allowlist of fields
function toUserResponse(entity: UserEntity): UserResponse {
  return {
    id: entity.id,
    name: entity.name,
    email: entity.email,
    createdAt: entity.createdAt.toISOString(),
  };
  // passwordHash, ssn, internalNotes, failedLoginAttempts, isLocked
  // are NEVER included because they are not in UserResponse
}

// WRONG: res.json(userEntity); // Sends ALL fields including passwordHash and SSN
// RIGHT: res.json(toUserResponse(userEntity)); // Sends only allowlisted fields
```

### Field-Level Access Control

```typescript
// Different callers see different fields based on their role

type Role = "admin" | "support" | "user" | "public";

const FIELD_ACCESS: Record<Role, Set<string>> = {
  admin: new Set(["id", "name", "email", "phone", "createdAt", "status", "role"]),
  support: new Set(["id", "name", "email", "phone", "createdAt", "status"]),
  user: new Set(["id", "name", "email", "createdAt"]),
  public: new Set(["id", "name"]),
};

function filterFieldsByRole<T extends Record<string, unknown>>(
  data: T,
  role: Role,
): Partial<T> {
  const allowedFields = FIELD_ACCESS[role];
  const filtered: Partial<T> = {};

  for (const key of Object.keys(data)) {
    if (allowedFields.has(key)) {
      (filtered as Record<string, unknown>)[key] = data[key];
    }
  }

  return filtered;
}
```

### Preventing Over-Fetching in GraphQL

```typescript
// GraphQL: restrict depth and field access to prevent data exfiltration

import { createComplexityRule } from "graphql-query-complexity";
import depthLimit from "graphql-depth-limit";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(5), // Prevent deeply nested queries that traverse relationships
    createComplexityRule({
      maximumComplexity: 1000,
      estimators: [
        // Each field has a cost; limit total query cost
      ],
    }),
  ],
});

// In resolvers, check field-level permissions:
const resolvers = {
  User: {
    ssn: (parent: UserEntity, _args: unknown, context: GraphQLContext) => {
      if (context.currentUser.role !== "admin") {
        return null; // Non-admins cannot see SSN, even if they request it
      }
      return maskSSN(parent.ssn);
    },
    passwordHash: () => {
      // NEVER expose password hash, regardless of role
      return null;
    },
  },
};
```

### REST API -- Sparse Fieldsets

```typescript
// Support sparse fieldsets to let clients request only the fields they need
// This reduces accidental over-exposure

// GET /api/users/123?fields=id,name,email
app.get("/api/users/:id", authenticate, async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });

  const requestedFields = req.query.fields
    ? (req.query.fields as string).split(",")
    : null;

  const response = toUserResponse(user);

  if (requestedFields) {
    const allowedFields = FIELD_ACCESS[req.user.role];
    const filtered: Record<string, unknown> = {};
    for (const field of requestedFields) {
      if (allowedFields.has(field) && field in response) {
        filtered[field] = (response as Record<string, unknown>)[field];
      }
    }
    return res.json(filtered);
  }

  return res.json(filterFieldsByRole(response, req.user.role));
});
```

---

## Temporary File Security

Temporary files often contain sensitive data during processing: uploaded documents, decrypted payloads, intermediate computation results, report exports. If not handled securely, they remain on disk after the process exits, are readable by other users on the system, or are created in predictable locations vulnerable to symlink attacks.

### Secure Temp File Creation

**Python -- Context Manager with Guaranteed Cleanup:**

```python
import tempfile
import os

def process_sensitive_upload(upload_data: bytes) -> dict:
    """Process sensitive data using a temp file that is guaranteed to be cleaned up."""
    # Create temp file with restrictive permissions (owner read/write only)
    fd, temp_path = tempfile.mkstemp(prefix="secure_", suffix=".tmp")
    try:
        # Write data to temp file
        os.write(fd, upload_data)
        os.close(fd)

        # Set restrictive permissions explicitly
        os.chmod(temp_path, 0o600)  # Owner read/write only

        # Process the file
        result = analyze_document(temp_path)
        return result
    finally:
        # GUARANTEED cleanup: overwrite then delete
        try:
            with open(temp_path, "r+b") as f:
                f.seek(0)
                f.write(b"\x00" * os.path.getsize(temp_path))
                f.flush()
                os.fsync(f.fileno())
            os.remove(temp_path)
        except OSError:
            pass  # File may already be deleted

# Even better: use tempfile.NamedTemporaryFile with delete=True
def process_with_auto_cleanup(upload_data: bytes) -> dict:
    with tempfile.NamedTemporaryFile(
        prefix="secure_",
        suffix=".tmp",
        delete=True,  # Automatically deleted when closed
        mode="wb",
    ) as tmp:
        tmp.write(upload_data)
        tmp.flush()
        os.chmod(tmp.name, 0o600)
        result = analyze_document(tmp.name)
        return result
    # File is automatically deleted here, even if an exception occurs
```

**Go -- defer for Cleanup Guarantees:**

```go
package processing

import (
    "io"
    "os"
)

func ProcessSensitiveData(data []byte) (Result, error) {
    // Create temp file in the default temp directory
    tmpFile, err := os.CreateTemp("", "secure-*.tmp")
    if err != nil {
        return Result{}, fmt.Errorf("creating temp file: %w", err)
    }

    // GUARANTEED cleanup with defer -- runs even on panic
    defer func() {
        tmpFile.Close()
        // Overwrite before deleting
        if f, err := os.OpenFile(tmpFile.Name(), os.O_WRONLY, 0); err == nil {
            info, _ := f.Stat()
            if info != nil {
                zeros := make([]byte, info.Size())
                f.Write(zeros)
                f.Sync()
            }
            f.Close()
        }
        os.Remove(tmpFile.Name())
    }()

    // Set restrictive permissions
    if err := tmpFile.Chmod(0o600); err != nil {
        return Result{}, fmt.Errorf("setting permissions: %w", err)
    }

    // Write and process
    if _, err := tmpFile.Write(data); err != nil {
        return Result{}, fmt.Errorf("writing temp file: %w", err)
    }

    return processFile(tmpFile.Name())
}
```

**TypeScript -- finally Block for Cleanup:**

```typescript
import { mkdtempSync, writeFileSync, unlinkSync, chmodSync, statSync } from "fs";
import { writeFile as writeFileSecure } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

async function processWithTempFile(data: Buffer): Promise<Result> {
  // Create a unique temp directory
  const tempDir = mkdtempSync(join(tmpdir(), "secure-"));
  const tempPath = join(tempDir, `data-${randomBytes(8).toString("hex")}.tmp`);

  try {
    // Write with restrictive permissions
    writeFileSync(tempPath, data, { mode: 0o600 });

    // Process the file
    const result = await analyzeDocument(tempPath);
    return result;
  } finally {
    // Cleanup: overwrite then delete
    try {
      const size = statSync(tempPath).size;
      writeFileSync(tempPath, Buffer.alloc(size, 0));
      unlinkSync(tempPath);
    } catch {
      // File may already be cleaned up
    }
    try {
      rmdirSync(tempDir);
    } catch {
      // Directory may not be empty or already removed
    }
  }
}
```

**C# -- using Statement for Guaranteed Disposal:**

```csharp
using System;
using System.IO;
using System.Security.Cryptography;

public class SecureTempFile : IDisposable
{
    public string Path { get; }
    private bool _disposed;

    public SecureTempFile(string prefix = "secure_")
    {
        Path = System.IO.Path.Combine(
            System.IO.Path.GetTempPath(),
            $"{prefix}{Guid.NewGuid():N}.tmp"
        );
    }

    public void Write(byte[] data)
    {
        File.WriteAllBytes(Path, data);
        // Set restrictive ACL (Windows) or permissions (Unix)
        var fileInfo = new FileInfo(Path);
        fileInfo.Attributes = FileAttributes.Temporary;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        try
        {
            if (File.Exists(Path))
            {
                // Overwrite with zeros before deleting
                var length = new FileInfo(Path).Length;
                using var fs = new FileStream(Path, FileMode.Open, FileAccess.Write);
                var zeros = new byte[Math.Min(length, 65536)];
                var remaining = length;
                while (remaining > 0)
                {
                    var chunk = (int)Math.Min(remaining, zeros.Length);
                    fs.Write(zeros, 0, chunk);
                    remaining -= chunk;
                }
                fs.Flush(true);
                File.Delete(Path);
            }
        }
        catch (IOException)
        {
            // Best effort cleanup
        }
    }
}

// Usage:
// using var tempFile = new SecureTempFile();
// tempFile.Write(sensitiveData);
// var result = Process(tempFile.Path);
// tempFile is automatically cleaned up when the using block exits
```

---

## Core Dump and Memory Dump Protection

Core dumps capture the entire memory space of a process, including any secrets it holds: decrypted keys, passwords in transit, session tokens, PII. If a process crashes and a core dump is written, all in-memory secrets are persisted to disk in plaintext.

### Disabling Core Dumps

**Linux -- RLIMIT_CORE and PR_SET_DUMPABLE:**

```c
// C -- Disable core dumps at the process level
#include <sys/resource.h>
#include <sys/prctl.h>

void disable_core_dumps(void) {
    // Set core dump size limit to 0
    struct rlimit rl = { .rlim_cur = 0, .rlim_max = 0 };
    setrlimit(RLIMIT_CORE, &rl);

    // Mark the process as non-dumpable
    // This also prevents ptrace attachment by non-root users
    prctl(PR_SET_DUMPABLE, 0);
}
```

**Go -- Disable Core Dumps at Startup:**

```go
package main

import (
    "golang.org/x/sys/unix"
    "log"
)

func disableCoreDumps() {
    // Set RLIMIT_CORE to 0 -- no core dump files
    err := unix.Setrlimit(unix.RLIMIT_CORE, &unix.Rlimit{
        Cur: 0,
        Max: 0,
    })
    if err != nil {
        log.Printf("WARNING: failed to disable core dumps: %v", err)
    }

    // Set process as non-dumpable
    err = unix.Prctl(unix.PR_SET_DUMPABLE, 0, 0, 0, 0)
    if err != nil {
        log.Printf("WARNING: failed to set non-dumpable: %v", err)
    }
}

func main() {
    disableCoreDumps()
    // ... rest of application
}
```

**Python -- Disable Core Dumps:**

```python
import resource
import ctypes
import platform

def disable_core_dumps() -> None:
    """Disable core dumps to prevent sensitive data from being written to disk."""
    # Set RLIMIT_CORE to 0
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

    # Set process as non-dumpable (Linux only)
    if platform.system() == "Linux":
        PR_SET_DUMPABLE = 4
        libc = ctypes.CDLL("libc.so.6")
        libc.prctl(PR_SET_DUMPABLE, 0)

# Call at application startup
disable_core_dumps()
```

**Java -- JVM Core Dump Prevention:**

```java
// JVM flags to control core dumps and heap dumps
// Add to JVM startup arguments:
//
// -XX:+DisableExplicitGC         -- Prevent System.gc() abuse
// -XX:OnError="kill -9 %p"       -- Kill instead of dumping on fatal error
// -XX:-HeapDumpOnOutOfMemoryError -- Do NOT dump heap on OOM
//
// System-level (Linux):
// ulimit -c 0  (in the startup script)

// Application-level: prevent heap dump data from containing secrets
// by zeroing sensitive data in finally blocks
public class SecureConfig {
    public static void disableCoreDumps() {
        // On Linux, set ulimit via ProcessBuilder
        try {
            new ProcessBuilder("sh", "-c", "ulimit -c 0")
                .inheritIO()
                .start()
                .waitFor();
        } catch (Exception e) {
            System.err.println("WARNING: Could not disable core dumps");
        }
    }
}
```

### Container and Orchestrator Settings

```yaml
# Kubernetes -- Disable core dumps for security-sensitive pods
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  containers:
    - name: app
      image: myapp:latest
      securityContext:
        # Prevent privilege escalation
        allowPrivilegeEscalation: false
        # Run as non-root
        runAsNonRoot: true
        runAsUser: 1000
      resources:
        limits:
          # No core dumps via resource limits
          # (system-level: /proc/sys/kernel/core_pattern should be empty or /dev/null)
          memory: "512Mi"
          cpu: "500m"
  # sysctl to disable core dumps cluster-wide:
  # echo "kernel.core_pattern=/dev/null" >> /etc/sysctl.conf

# Docker -- Disable core dumps
# docker run --ulimit core=0:0 myapp:latest
```

```dockerfile
# Dockerfile -- Disable core dumps in container
FROM node:20-alpine

# Disable core dumps at the OS level
RUN echo "ulimit -c 0" >> /etc/profile
RUN echo "kernel.core_pattern=/dev/null" >> /etc/sysctl.conf || true

# Run as non-root
USER node

COPY --chown=node:node . /app
WORKDIR /app

CMD ["node", "--max-old-space-size=512", "dist/server.js"]
```

---

## Best Practices

1. **ALWAYS zero sensitive data from memory immediately after use.** Use mutable containers (byte arrays, char arrays, Buffer) instead of immutable strings. Call `Arrays.fill()` (Java), `buffer.fill(0)` (Node.js), `ZeroBytes()` (Go), or derive `ZeroizeOnDrop` (Rust). Never leave passwords, encryption keys, or tokens lingering in heap memory for the garbage collector to eventually reclaim.

2. **NEVER hardcode secrets in source code, configuration files, or environment variable defaults.** Retrieve all credentials, API keys, and encryption keys from a secret manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager) at runtime. Run gitleaks or trufflehog as a pre-commit hook and in CI to block commits that contain secrets.

3. **ALWAYS minimize PII collection to what is strictly necessary for the stated purpose.** Classify every data field (public, internal, confidential, restricted) before collecting it. Apply anonymization (irreversible) for analytics and pseudonymization (reversible) for operational data. Verify k-anonymity requirements before releasing datasets.

4. **ALWAYS mask sensitive data in logs, API responses, and UI displays.** Apply masking functions (email, phone, credit card, SSN) at the boundary -- the point where data leaves the secure processing context. Use framework-level redaction (pino `redact`, structlog processors) to enforce masking automatically.

5. **ALWAYS use crypto-shredding for reliable data deletion in distributed systems.** Encrypt each entity's data with a unique key. When the data must be deleted, delete the key. This renders the encrypted data unrecoverable across all databases, replicas, backups, and caches without needing to track every copy.

6. **ALWAYS use the type system to enforce data classification.** Use branded types (TypeScript), newtype pattern (Rust), or @JsonIgnore annotations (Java) to prevent sensitive fields from being accidentally serialized, logged, or included in API responses. Make the wrong thing a compile error, not a runtime mistake.

7. **ALWAYS clear sensitive data from clipboard after a short timeout.** When programmatically copying passwords or API keys to the clipboard, schedule automatic clearing after 30 seconds. Verify the clipboard still contains your data before clearing to avoid destroying user data.

8. **ALWAYS use explicit allowlists for API response fields.** Map database entities to response DTOs with only the fields the caller is authorized to see. Never return raw database objects. Implement field-level access control based on the caller's role.

9. **ALWAYS create temporary files with restrictive permissions and guaranteed cleanup.** Use `mkstemp` / `NamedTemporaryFile` / `CreateTemp` with mode 0600. Overwrite file contents before deletion. Use `finally`, `defer`, `using`, or context managers to guarantee cleanup even on exceptions and crashes.

10. **ALWAYS disable core dumps for processes that handle sensitive data.** Set RLIMIT_CORE to 0, mark the process as non-dumpable with PR_SET_DUMPABLE, and configure containers with `--ulimit core=0:0`. A core dump of a process handling encryption keys or passwords exposes all secrets to anyone with filesystem access.

---

## Anti-Patterns

### 1. Storing Passwords in Java String Objects

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using `String` type for passwords in Java | Password remains in heap memory indefinitely. Visible in heap dumps, memory forensics, and via garbage collector. Cannot be explicitly zeroed. | Use `char[]` for passwords. Call `Arrays.fill(chars, '\0')` in a finally block immediately after use |

### 2. Hardcoded API Keys in Source Code

| Problem | Consequence | Fix |
|---------|-------------|-----|
| `const API_KEY = "sk_live_abc123..."` in source files (CWE-798) | Key exposed to all repository readers, Git history, CI logs, container images, and compiled binaries. Cannot be rotated without code deploy | Retrieve secrets from a secret manager (Vault, AWS Secrets Manager) at runtime. Run gitleaks as pre-commit hook. If a key was ever committed, rotate it immediately -- deleting the commit is not sufficient |

### 3. Returning Raw Database Entities in API Responses

| Problem | Consequence | Fix |
|---------|-------------|-----|
| `res.json(userEntity)` where the entity includes passwordHash, SSN, internal flags | Every internal field is sent to the client. Even if the frontend ignores these fields, they are visible in browser devtools and network interceptors | Map entities to response DTOs with explicit field allowlists. Use `@JsonIgnore` for sensitive fields as a second layer of defense |

### 4. Logging Unmasked PII

| Problem | Consequence | Fix |
|---------|-------------|-----|
| `logger.info("User registered", { email, phone, ssn })` with raw values | PII persists in log storage (often retained longer than the application database), replicated to multiple log aggregators, and accessible to operations staff | Apply masking functions at the logging boundary. Configure pino `redact` or structlog processors to automatically mask known PII field names |

### 5. Temporary Files with Default Permissions and No Cleanup

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Creating temp files with default permissions (644/755) and no deletion on process exit | Sensitive file contents are world-readable on shared systems. Files persist indefinitely if the process crashes before cleanup | Use `mkstemp` with mode 0600. Overwrite contents before deletion. Use `finally`/`defer`/`using` for guaranteed cleanup. Use `NamedTemporaryFile(delete=True)` where available |

### 6. Soft Delete Without Crypto-Shredding

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Marking records as `deleted_at = NOW()` without encrypting sensitive fields | Data is still present in the database, queryable by anyone with DB access, replicated to read replicas, and present in backups. Does not satisfy GDPR right to erasure | Encrypt sensitive fields with a per-entity key. On deletion, destroy the key (crypto-shredding). Schedule hard delete after retention period. Verify deletion across replicas and backups |

### 7. No Core Dump Protection for Secret-Handling Processes

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Default core dump settings on processes that handle encryption keys, passwords, or PII | A crash writes the entire process memory (including all secrets) to a core dump file on disk, accessible to anyone who can read /var/crash or the configured core dump directory | Set RLIMIT_CORE to 0 at process startup. Set PR_SET_DUMPABLE to 0 on Linux. Configure container runtime with `--ulimit core=0:0`. Disable JVM heap dumps on OOM for sensitive services |

### 8. Over-Fetching in GraphQL Without Field-Level Authorization

| Problem | Consequence | Fix |
|---------|-------------|-----|
| GraphQL resolvers return all fields of an entity without checking per-field permissions | Clients can query sensitive fields (SSN, internal notes, password hashes) by simply including them in the GraphQL query | Implement field-level authorization in resolvers. Return null for unauthorized fields. Use query depth limiting and complexity analysis. Deny-list fields that must never be exposed (passwordHash) |

---

## Enforcement Checklist

### Sensitive Data in Memory
- [ ] Passwords and secrets use mutable containers (char[], byte[], Buffer), not immutable strings
- [ ] All sensitive byte arrays are zeroed immediately after use (finally/defer/using/drop)
- [ ] Rust types holding secrets derive `ZeroizeOnDrop` or use `Secret<T>` from secrecy crate
- [ ] Go secrets use `[]byte` with explicit zeroing or memguard for guarded allocations
- [ ] Java sensitive operations use `char[]` with `Arrays.fill(chars, '\0')` in finally blocks
- [ ] Node.js uses `Buffer.fill(0)` to zero sensitive buffers after use

### Hardcoded Secrets Prevention
- [ ] No hardcoded passwords, API keys, tokens, or private keys in source code
- [ ] Pre-commit hook (gitleaks, trufflehog, or detect-secrets) is configured and enforced
- [ ] CI pipeline includes secret scanning step that blocks merges on detection
- [ ] All secrets are retrieved from a secret manager (Vault, AWS Secrets Manager, GCP Secret Manager) at runtime
- [ ] .env files are in .gitignore and never committed to version control
- [ ] Docker images do not contain secrets in build args or layers (verified with `docker history` or dive)

### PII Minimization
- [ ] Every data field has a documented classification (public, internal, confidential, restricted)
- [ ] Data collection forms request only the minimum fields required for the stated purpose
- [ ] Anonymization (irreversible) is used for analytics, reporting, and ML training data
- [ ] Pseudonymization (reversible) is used where re-identification is operationally required
- [ ] K-anonymity, L-diversity, or T-closeness is verified before releasing datasets
- [ ] Retention periods are defined per data classification and automatically enforced

### Data Masking
- [ ] Masking functions exist for: email, phone, credit card, SSN, bank account, IP address, name
- [ ] Logging framework applies masking automatically via field-level redaction rules
- [ ] API responses are masked according to the caller's access level (owner, support, public)
- [ ] UI displays sensitive data in masked form by default with explicit reveal action
- [ ] Masking is applied at the boundary (log write, API response, UI render) not at the data source

### Secure Data Deletion
- [ ] Crypto-shredding is implemented for distributed data (per-entity encryption keys deleted to render data unrecoverable)
- [ ] Secure file deletion overwrites contents (random + zero passes) before unlinking
- [ ] Database hard deletes are scheduled after soft-delete retention period expires
- [ ] Deletion is verified across replicas, backups, and caches
- [ ] Deletion events are logged in the audit trail for compliance

### Data Classification in Code
- [ ] TypeScript uses branded types or opaque types to distinguish data classifications at compile time
- [ ] Rust uses newtype wrappers that control Debug, Display, and Serialize behavior
- [ ] Java entities use @JsonIgnore on sensitive fields to prevent accidental serialization
- [ ] Sensitive types implement toString()/Debug/Display to show masked values, not raw data
- [ ] API response DTOs use explicit allowlists, not blocklists, for field selection

### Clipboard Security
- [ ] Programmatic clipboard operations for secrets include auto-clear timeout (30 seconds)
- [ ] Clipboard content is verified before clearing (do not clear unrelated user data)
- [ ] Web applications prevent copy of sensitive displayed data where appropriate
- [ ] Password managers handle clipboard clearing (do not duplicate this in application code)

### Data Leak Prevention in APIs
- [ ] Database entities are never returned directly in API responses
- [ ] Response DTOs use explicit field allowlists mapped from entities
- [ ] Field-level access control is implemented based on caller role
- [ ] GraphQL queries enforce depth limits and complexity limits
- [ ] GraphQL resolvers implement per-field authorization
- [ ] REST APIs support sparse fieldsets to minimize over-fetching
- [ ] Internal fields (passwordHash, internalNotes, debug flags) are never exposed

### Temporary File Security
- [ ] Temp files are created with restrictive permissions (0600 / owner read-write only)
- [ ] Temp files use unpredictable names (mkstemp, CreateTemp, randomBytes in name)
- [ ] Cleanup is guaranteed via finally/defer/using/context manager
- [ ] Sensitive temp file contents are overwritten before deletion
- [ ] Temp directories are cleaned on process startup (stale files from previous crashes)

### Core Dump and Memory Dump Protection
- [ ] RLIMIT_CORE is set to 0 for processes handling secrets (Linux/macOS)
- [ ] PR_SET_DUMPABLE is set to 0 for sensitive processes (Linux)
- [ ] JVM flags disable heap dump on OutOfMemoryError for sensitive services
- [ ] Container runtime disables core dumps (--ulimit core=0:0)
- [ ] Kubernetes pods set securityContext with appropriate restrictions
- [ ] Core dump directory permissions are restrictive (root-only) on shared systems
- [ ] Swap is encrypted or disabled on systems handling restricted data
