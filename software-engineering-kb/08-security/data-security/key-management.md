# Key Management

## Comprehensive Guide to Cryptographic Key Lifecycle and Operations

Category: Data Security
Scope: Key lifecycle, KMS, HSM, Vault, key hierarchy, rotation, and compliance
Last Updated: 2025-12-01
Status: Living Document

---

## Table of Contents

1. Key Management Fundamentals
2. Key Lifecycle
3. Key Generation
4. Key Storage
5. Key Distribution
6. Key Rotation Strategies
7. Key Hierarchy
8. Cloud KMS Services
9. HashiCorp Vault
10. Key Wrapping
11. Split Knowledge and Dual Control
12. Key Escrow
13. Key Compromise Response
14. NIST SP 800-57 Guidelines
15. Code Examples
16. Best Practices
17. Anti-Patterns
18. Enforcement Checklist

---

## 1. Key Management Fundamentals

### Why Key Management Matters

The strength of any encryption system depends entirely on the security of its keys.
A perfectly implemented AES-256-GCM encryption is worthless if the key is stored in
a Git repository, hardcoded in source code, or accessible to unauthorized personnel.

Key management addresses the fundamental questions:

- How are keys generated with sufficient randomness?
- Where are keys stored to prevent unauthorized access?
- How are keys distributed to authorized systems?
- How are keys rotated without service disruption?
- How are keys revoked when compromise is suspected?
- How are keys destroyed when no longer needed?

### Key Types

```
+---------------------------------------------------------------------+
| Key Type                 | Purpose                     | Typical Size|
|---------------------------------------------------------------------+
| Symmetric (AES)          | Data encryption/decryption  | 128/256 bit |
| Asymmetric (RSA)         | Key exchange, signatures    | 2048/4096   |
| Asymmetric (ECDSA)       | Signatures, key agreement   | 256/384 bit |
| HMAC                     | Message authentication      | 256 bit     |
| Key Encryption Key (KEK) | Encrypting other keys       | 256 bit     |
| Data Encryption Key (DEK)| Encrypting application data | 256 bit     |
| Master Key               | Root of key hierarchy       | 256 bit     |
+---------------------------------------------------------------------+
```

---

## 2. Key Lifecycle

### Complete Lifecycle Phases

```
Generation --> Storage --> Distribution --> Use --> Rotation --> Revocation --> Destruction
    |             |            |            |          |            |              |
    v             v            v            v          v            v              v
  CSPRNG       HSM/KMS    Secure channel  Encrypt   Re-wrap    Disable key    Crypto-erase
  Proper      Never in     Key wrapping   Decrypt   New KEK    Remove access   Zero memory
  key size    source code  mTLS transport Sign/Verify Re-encrypt Audit log     Secure delete
```

### Phase Details

**Generation**: Create keys using cryptographically secure random number generators.
Never derive keys from passwords without a proper KDF. Never use predictable sources.

**Storage**: Store keys in dedicated key management infrastructure (HSM, KMS, Vault).
Never store keys in source code, configuration files, environment variables, or
databases alongside the data they protect.

**Distribution**: Deliver keys to authorized systems through secure channels. Use
key wrapping (encrypting keys with other keys) for transport. Never transmit
plaintext keys over insecure channels.

**Use**: Apply keys for their intended cryptographic operation only. Track key usage
through audit logs. Enforce access controls on key operations.

**Rotation**: Replace keys on a defined schedule or in response to events. Implement
rotation without service disruption. Maintain old keys for decryption of existing data.

**Revocation**: Disable keys immediately when compromise is suspected. Remove key
access from affected systems. Audit all operations performed with the compromised key.

**Destruction**: Securely destroy keys when they are no longer needed. Overwrite key
material in memory and storage. Ensure no copies remain in backups or caches.

---

## 3. Key Generation

### Cryptographically Secure Random Number Generators (CSPRNG)

Always use the operating system's CSPRNG for key generation:

```typescript
// Node.js: Generate cryptographic key
import { randomBytes, generateKeySync } from 'crypto';

// Generate raw key bytes
const key256 = randomBytes(32);  // 256-bit key
const key128 = randomBytes(16);  // 128-bit key

// Generate key object
const keyObject = generateKeySync('aes', { length: 256 });
```

```go
// Go: Generate cryptographic key
package main

import (
    "crypto/rand"
    "fmt"
    "io"
)

func generateKey(bits int) ([]byte, error) {
    key := make([]byte, bits/8)
    if _, err := io.ReadFull(rand.Reader, key); err != nil {
        return nil, fmt.Errorf("generate key: %w", err)
    }
    return key, nil
}

// Generate 256-bit AES key
key, err := generateKey(256)
```

```python
# Python: Generate cryptographic key
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Using os.urandom (backed by OS CSPRNG)
key_256 = os.urandom(32)  # 256-bit key

# Using cryptography library
key_256 = AESGCM.generate_key(bit_length=256)
```

### Proper Key Sizes

Follow minimum key size recommendations:

```
+------------------------------------------------+
| Algorithm      | Minimum    | Recommended       |
|------------------------------------------------+
| AES            | 128 bits   | 256 bits          |
| RSA            | 2048 bits  | 3072+ bits        |
| ECDSA/ECDH     | 256 bits   | 384 bits          |
| Ed25519        | 256 bits   | 256 bits (fixed)  |
| HMAC-SHA256    | 256 bits   | 256 bits          |
+------------------------------------------------+
```

### Key Derivation from Passwords

When deriving keys from passwords, always use a proper KDF:

```python
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
# Or use scrypt/PBKDF2 as alternatives
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

# Argon2id (preferred for password-based KDF)
# Use dedicated library: argon2-cffi
import argon2

# Scrypt
kdf = Scrypt(
    salt=os.urandom(16),
    length=32,           # Output key size (256 bits)
    n=2**20,             # CPU/memory cost parameter
    r=8,                 # Block size
    p=1                  # Parallelization parameter
)
key = kdf.derive(b"user-password")
```

### NEVER Use for Key Generation

- `Math.random()` (JavaScript) -- not cryptographically secure
- `random.random()` (Python) -- not cryptographically secure
- `rand()` (C) -- not cryptographically secure
- Time-based seeds -- predictable
- Sequential counters -- predictable
- User-provided passwords without KDF -- insufficient entropy

---

## 4. Key Storage

### Hardware Security Modules (HSM)

HSMs provide the highest level of key protection:

- Keys are generated and stored inside tamper-resistant hardware
- Keys never leave the HSM in plaintext
- Cryptographic operations execute inside the HSM
- FIPS 140-2 Level 3 or higher certification
- Physical tamper detection and response

```
+------------------------------------------+
| HSM Options                               |
|------------------------------------------|
| AWS CloudHSM          | Cloud-based HSM  |
| Azure Dedicated HSM   | Cloud-based HSM  |
| GCP Cloud HSM         | Cloud KMS + HSM  |
| Thales Luna           | On-premises HSM  |
| Entrust nShield       | On-premises HSM  |
| YubiHSM               | Compact USB HSM  |
+------------------------------------------+
```

### Cloud KMS (Key Management Services)

Cloud KMS provides managed key storage with HSM-backed options:

```
Cloud KMS vs HSM:
+-------------------------------------------------------+
| Feature          | Cloud KMS        | Dedicated HSM    |
|-------------------------------------------------------+
| Key isolation     | Multi-tenant     | Single-tenant    |
| FIPS level        | 140-2 Level 2-3  | 140-2 Level 3   |
| Control           | API-managed      | Full control     |
| Cost              | Pay-per-use      | Fixed monthly    |
| Compliance        | Most standards   | Strictest reqs   |
+-------------------------------------------------------+
```

### Where NEVER to Store Keys

1. **Source code**: Keys in code are in version control history forever
2. **Environment variables**: Visible in process listings, logs, crash dumps
3. **Configuration files**: Often committed to version control or readable by others
4. **Database alongside encrypted data**: Defeats the purpose of encryption
5. **Unencrypted files on disk**: Accessible to anyone with file system access
6. **Container images**: Extractable from image layers
7. **CI/CD pipeline logs**: Keys logged during deployment are exposed
8. **Chat messages or email**: Persist in communication systems indefinitely

---

## 5. Key Distribution

### Secure Distribution Methods

```
Method                    | Security Level | Use Case
--------------------------|----------------|---------------------------
KMS API (TLS)             | High           | Cloud-native applications
Vault transit engine      | High           | Multi-cloud / hybrid
Key wrapping              | High           | Cross-system key transport
mTLS with certificate     | High           | Service-to-service
PKCS#11 interface         | High           | HSM-backed applications
```

### Key Wrapping for Distribution

```typescript
// Wrap a DEK with a KEK for secure transport
import {
  KMSClient,
  EncryptCommand,
  DecryptCommand
} from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'us-east-1' });

// Wrap (encrypt) a key
async function wrapKey(
  plainKey: Buffer,
  wrappingKeyId: string
): Promise<Buffer> {
  const response = await kms.send(new EncryptCommand({
    KeyId: wrappingKeyId,
    Plaintext: plainKey,
    EncryptionContext: {
      purpose: 'key-wrapping',
      keyType: 'DEK'
    }
  }));
  return Buffer.from(response.CiphertextBlob!);
}

// Unwrap (decrypt) a key
async function unwrapKey(
  wrappedKey: Buffer,
  wrappingKeyId: string
): Promise<Buffer> {
  const response = await kms.send(new DecryptCommand({
    CiphertextBlob: wrappedKey,
    EncryptionContext: {
      purpose: 'key-wrapping',
      keyType: 'DEK'
    }
  }));
  return Buffer.from(response.Plaintext!);
}
```

---

## 6. Key Rotation Strategies

### Why Rotate Keys

- Limit the amount of data encrypted under a single key (reducing blast radius)
- Comply with regulatory requirements (PCI DSS requires annual rotation)
- Respond to suspected compromise
- Follow cryptographic best practices

### Re-Encryption Rotation

Re-encrypt all data with a new key. Simple but expensive for large datasets.

```
Step 1: Generate new DEK (version N+1)
Step 2: For each encrypted record:
        a. Decrypt with DEK version N
        b. Re-encrypt with DEK version N+1
        c. Update record with new ciphertext
Step 3: After all records migrated, disable DEK version N
Step 4: After grace period, destroy DEK version N
```

```python
class KeyRotationService:
    """Perform re-encryption key rotation."""

    def __init__(self, kms_client, db):
        self.kms = kms_client
        self.db = db

    async def rotate_keys(self, old_key_id: str, new_key_id: str):
        """Re-encrypt all records with new key."""
        # Get all records encrypted with old key
        records = await self.db.find({"key_version": old_key_id})

        batch_size = 100
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]

            for record in batch:
                # Decrypt with old key
                plaintext = await self.decrypt(
                    record["ciphertext"], old_key_id
                )

                # Re-encrypt with new key
                new_ciphertext = await self.encrypt(plaintext, new_key_id)

                # Update record atomically
                await self.db.update(
                    {"_id": record["_id"]},
                    {
                        "ciphertext": new_ciphertext,
                        "key_version": new_key_id,
                        "rotated_at": datetime.utcnow()
                    }
                )

            # Log progress
            print(f"Rotated {min(i + batch_size, len(records))}/{len(records)}")

        # Disable old key after all records migrated
        await self.kms.disable_key(old_key_id)
```

### Envelope Encryption Rotation

Rotate the KEK without re-encrypting data. Only re-wrap the DEKs.

```
Step 1: Create new KEK (version N+1) in KMS
Step 2: For each encrypted DEK:
        a. Decrypt DEK with KEK version N
        b. Re-encrypt DEK with KEK version N+1
        c. Update stored encrypted DEK
Step 3: Data ciphertext is NOT re-encrypted (unchanged)
Step 4: Disable KEK version N
```

```typescript
// Envelope encryption rotation -- only re-wrap DEKs
async function rotateKEK(
  oldKekId: string,
  newKekId: string,
  records: EncryptedRecord[]
): Promise<void> {
  for (const record of records) {
    // Decrypt DEK with old KEK
    const plaintextDEK = await kms.send(new DecryptCommand({
      CiphertextBlob: Buffer.from(record.encryptedDEK, 'base64'),
      KeyId: oldKekId
    }));

    // Re-encrypt DEK with new KEK
    const reWrappedDEK = await kms.send(new EncryptCommand({
      KeyId: newKekId,
      Plaintext: plaintextDEK.Plaintext
    }));

    // Update only the encrypted DEK (data ciphertext unchanged)
    await db.update(
      { id: record.id },
      {
        encryptedDEK: Buffer.from(reWrappedDEK.CiphertextBlob!).toString('base64'),
        kekVersion: newKekId
      }
    );

    // Zero out plaintext DEK
    (plaintextDEK.Plaintext as Buffer).fill(0);
  }
}
```

### Automatic Key Rotation in AWS KMS

```typescript
import {
  KMSClient,
  EnableKeyRotationCommand,
  GetKeyRotationStatusCommand
} from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'us-east-1' });

// Enable automatic annual rotation
await kms.send(new EnableKeyRotationCommand({
  KeyId: 'alias/my-key'
}));

// Check rotation status
const status = await kms.send(new GetKeyRotationStatusCommand({
  KeyId: 'alias/my-key'
}));
console.log(`Key rotation enabled: ${status.KeyRotationEnabled}`);
// AWS automatically rotates the key material annually
// Old key material is preserved for decryption
// New encryptions use the new key material
```

---

## 7. Key Hierarchy

### Three-Tier Key Hierarchy

```
Tier 1: Master Key (MK)
  - Stored in HSM or root KMS key
  - Never exported, never leaves HSM
  - Used only to encrypt/decrypt KEKs
  - Rotated rarely (requires careful planning)

Tier 2: Key Encryption Keys (KEK)
  - Encrypted by the Master Key
  - Used to encrypt/decrypt DEKs
  - One per service, region, or tenant
  - Rotated periodically (annually or more frequently)

Tier 3: Data Encryption Keys (DEK)
  - Encrypted by a KEK
  - Used to encrypt/decrypt actual data
  - One per record, field, or data chunk
  - Rotated by re-wrapping with new KEK
```

### Per-Tenant Key Hierarchy

```
Master Key (HSM)
  |
  +-- KEK: Tenant A
  |     +-- DEK: User data
  |     +-- DEK: Payment data
  |     +-- DEK: Documents
  |
  +-- KEK: Tenant B
  |     +-- DEK: User data
  |     +-- DEK: Payment data
  |
  +-- KEK: Tenant C
        +-- DEK: User data
```

Benefits of per-tenant key hierarchy:
- Crypto-shredding: Delete all tenant data by destroying their KEK
- Isolation: Compromised tenant key does not affect other tenants
- Compliance: Meet data residency requirements with region-specific keys
- Audit: Track key usage per tenant

---

## 8. Cloud KMS Services

### AWS KMS

```typescript
import {
  KMSClient,
  CreateKeyCommand,
  GenerateDataKeyCommand,
  EncryptCommand,
  DecryptCommand,
  CreateAliasCommand,
  ScheduleKeyDeletionCommand
} from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'us-east-1' });

// Create a Customer Master Key (CMK)
const createKeyResponse = await kms.send(new CreateKeyCommand({
  Description: 'Application encryption key',
  KeyUsage: 'ENCRYPT_DECRYPT',
  KeySpec: 'SYMMETRIC_DEFAULT',  // AES-256-GCM
  Tags: [
    { TagKey: 'Application', TagValue: 'MyApp' },
    { TagKey: 'Environment', TagValue: 'production' }
  ]
}));

// Create alias for the key
await kms.send(new CreateAliasCommand({
  AliasName: 'alias/myapp-encryption-key',
  TargetKeyId: createKeyResponse.KeyMetadata!.KeyId!
}));

// Generate data key (envelope encryption)
const dataKeyResponse = await kms.send(new GenerateDataKeyCommand({
  KeyId: 'alias/myapp-encryption-key',
  KeySpec: 'AES_256',
  EncryptionContext: {
    tenant: 'acme-corp',
    purpose: 'user-data-encryption'
  }
}));

// dataKeyResponse.Plaintext   -- use for encryption, then discard
// dataKeyResponse.CiphertextBlob -- store alongside encrypted data
```

### AWS KMS Key Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowKeyAdministration",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/KeyAdmin"
      },
      "Action": [
        "kms:Create*",
        "kms:Describe*",
        "kms:Enable*",
        "kms:List*",
        "kms:Put*",
        "kms:Update*",
        "kms:Revoke*",
        "kms:Disable*",
        "kms:Get*",
        "kms:Delete*",
        "kms:TagResource",
        "kms:UntagResource",
        "kms:ScheduleKeyDeletion",
        "kms:CancelKeyDeletion"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowKeyUsage",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/AppService"
      },
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:GenerateDataKeyWithoutPlaintext"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:EncryptionContext:purpose": "user-data-encryption"
        }
      }
    }
  ]
}
```

### GCP Cloud KMS

```python
from google.cloud import kms


def create_key_ring(project_id: str, location: str, key_ring_id: str):
    """Create a key ring in GCP Cloud KMS."""
    client = kms.KeyManagementServiceClient()
    parent = f"projects/{project_id}/locations/{location}"

    key_ring = {}
    created = client.create_key_ring(
        request={
            "parent": parent,
            "key_ring_id": key_ring_id,
            "key_ring": key_ring
        }
    )
    return created


def create_crypto_key(
    project_id: str,
    location: str,
    key_ring_id: str,
    crypto_key_id: str
):
    """Create a crypto key for encryption."""
    client = kms.KeyManagementServiceClient()
    parent = client.key_ring_path(project_id, location, key_ring_id)

    crypto_key = {
        "purpose": kms.CryptoKey.CryptoKeyPurpose.ENCRYPT_DECRYPT,
        "version_template": {
            "algorithm": kms.CryptoKeyVersion.CryptoKeyVersionAlgorithm.GOOGLE_SYMMETRIC_ENCRYPTION
        },
        "rotation_period": {"seconds": 7776000},  # 90 days
        "next_rotation_time": {"seconds": int(time.time()) + 7776000}
    }

    created = client.create_crypto_key(
        request={
            "parent": parent,
            "crypto_key_id": crypto_key_id,
            "crypto_key": crypto_key
        }
    )
    return created


def encrypt_data(
    project_id: str,
    location: str,
    key_ring_id: str,
    crypto_key_id: str,
    plaintext: bytes
) -> bytes:
    """Encrypt data using GCP Cloud KMS."""
    client = kms.KeyManagementServiceClient()
    key_name = client.crypto_key_path(
        project_id, location, key_ring_id, crypto_key_id
    )

    response = client.encrypt(
        request={"name": key_name, "plaintext": plaintext}
    )
    return response.ciphertext
```

### Azure Key Vault

```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.keys import KeyClient
from azure.keyvault.keys.crypto import CryptographyClient, EncryptionAlgorithm


def setup_azure_key_vault():
    """Configure Azure Key Vault for key management."""
    credential = DefaultAzureCredential()
    vault_url = "https://my-vault.vault.azure.net"

    # Create key client
    key_client = KeyClient(vault_url=vault_url, credential=credential)

    # Create RSA key
    rsa_key = key_client.create_rsa_key(
        name="my-encryption-key",
        size=4096,
        key_operations=["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    )

    # Create cryptography client for operations
    crypto_client = CryptographyClient(rsa_key, credential=credential)

    # Encrypt data
    plaintext = b"sensitive data"
    result = crypto_client.encrypt(
        EncryptionAlgorithm.rsa_oaep_256,
        plaintext
    )

    # Decrypt data
    decrypted = crypto_client.decrypt(
        EncryptionAlgorithm.rsa_oaep_256,
        result.ciphertext
    )

    return decrypted.plaintext
```

---

## 9. HashiCorp Vault

### Transit Secrets Engine

The transit secrets engine provides encryption-as-a-service without storing the data.

```bash
# Enable transit secrets engine
vault secrets enable transit

# Create an encryption key
vault write -f transit/keys/my-app-key \
  type=aes256-gcm96 \
  auto_rotate_period=90d

# Encrypt data (data must be base64 encoded)
vault write transit/encrypt/my-app-key \
  plaintext=$(echo -n "sensitive data" | base64)

# Response: ciphertext = vault:v1:AbCdEfGh...

# Decrypt data
vault write transit/decrypt/my-app-key \
  ciphertext="vault:v1:AbCdEfGh..."

# Response: plaintext = c2Vuc2l0aXZlIGRhdGE= (base64)

# Rotate key
vault write -f transit/keys/my-app-key/rotate

# Configure minimum decryption version (prevent old key usage)
vault write transit/keys/my-app-key \
  min_decryption_version=2

# Rewrap ciphertext with latest key version
vault write transit/rewrap/my-app-key \
  ciphertext="vault:v1:AbCdEfGh..."
# Response: ciphertext = vault:v2:XyZaBcDe...
```

### Vault Transit in Go

```go
package main

import (
    "encoding/base64"
    "fmt"
    "log"

    vault "github.com/hashicorp/vault/api"
)

type VaultTransitClient struct {
    client  *vault.Client
    keyName string
}

func NewVaultTransitClient(addr, token, keyName string) (*VaultTransitClient, error) {
    config := vault.DefaultConfig()
    config.Address = addr

    client, err := vault.NewClient(config)
    if err != nil {
        return nil, fmt.Errorf("create vault client: %w", err)
    }

    client.SetToken(token)

    return &VaultTransitClient{
        client:  client,
        keyName: keyName,
    }, nil
}

func (v *VaultTransitClient) Encrypt(plaintext []byte) (string, error) {
    encoded := base64.StdEncoding.EncodeToString(plaintext)

    secret, err := v.client.Logical().Write(
        fmt.Sprintf("transit/encrypt/%s", v.keyName),
        map[string]interface{}{
            "plaintext": encoded,
        },
    )
    if err != nil {
        return "", fmt.Errorf("encrypt: %w", err)
    }

    return secret.Data["ciphertext"].(string), nil
}

func (v *VaultTransitClient) Decrypt(ciphertext string) ([]byte, error) {
    secret, err := v.client.Logical().Write(
        fmt.Sprintf("transit/decrypt/%s", v.keyName),
        map[string]interface{}{
            "ciphertext": ciphertext,
        },
    )
    if err != nil {
        return nil, fmt.Errorf("decrypt: %w", err)
    }

    decoded, err := base64.StdEncoding.DecodeString(
        secret.Data["plaintext"].(string),
    )
    if err != nil {
        return nil, fmt.Errorf("decode plaintext: %w", err)
    }

    return decoded, nil
}
```

### Vault Auto-Unseal

```hcl
# Vault server configuration with AWS KMS auto-unseal
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "alias/vault-unseal-key"
}

# Alternative: Azure Key Vault auto-unseal
seal "azurekeyvault" {
  vault_name = "my-vault"
  key_name   = "vault-unseal-key"
}

# Alternative: GCP Cloud KMS auto-unseal
seal "gcpckms" {
  project     = "my-project"
  region      = "global"
  key_ring    = "vault-keyring"
  crypto_key  = "vault-unseal-key"
}
```

---

## 10. Key Wrapping

### What is Key Wrapping

Key wrapping encrypts a key (the target key) with another key (the wrapping key).
This enables secure transport and storage of keys.

### Standards

- **AES Key Wrap (RFC 3394)**: Standard key wrapping algorithm
- **AES-GCM Key Wrap**: Provides authentication in addition to wrapping
- **RSA-OAEP**: Asymmetric key wrapping using RSA

```go
// Key wrapping example in Go using AES Key Wrap
package keywrap

import (
    "crypto/aes"
    "encoding/binary"
    "errors"
)

// AES Key Wrap (RFC 3394)
func WrapKey(kek, plaintext []byte) ([]byte, error) {
    if len(plaintext)%8 != 0 {
        return nil, errors.New("plaintext must be multiple of 8 bytes")
    }

    block, err := aes.NewCipher(kek)
    if err != nil {
        return nil, err
    }

    n := len(plaintext) / 8
    a := uint64(0xA6A6A6A6A6A6A6A6)
    r := make([][]byte, n)

    for i := 0; i < n; i++ {
        r[i] = make([]byte, 8)
        copy(r[i], plaintext[i*8:(i+1)*8])
    }

    for j := 0; j < 6; j++ {
        for i := 0; i < n; i++ {
            buf := make([]byte, 16)
            binary.BigEndian.PutUint64(buf[:8], a)
            copy(buf[8:], r[i])

            block.Encrypt(buf, buf)

            a = binary.BigEndian.Uint64(buf[:8]) ^ uint64(n*j+i+1)
            copy(r[i], buf[8:])
        }
    }

    result := make([]byte, 8*(n+1))
    binary.BigEndian.PutUint64(result[:8], a)
    for i := 0; i < n; i++ {
        copy(result[(i+1)*8:(i+2)*8], r[i])
    }

    return result, nil
}
```

---

## 11. Split Knowledge and Dual Control

### Split Knowledge

No single person has complete knowledge of a key. The key is divided into components,
each held by a different individual.

```
Key:        AABBCCDD11223344
Component 1: AABB0000112200XX (held by Person A)
Component 2: 0000CCDD002233XX (held by Person B)
Component 3: 00000000000000XX (held by Person C)

Reconstruction requires all three components using XOR:
Component1 XOR Component2 XOR Component3 = Full Key
```

### Dual Control

No single person can perform a sensitive key operation alone. At least two authorized
individuals must participate.

```
Key Operations Requiring Dual Control:
- Master key generation
- Master key backup/restore
- Key destruction
- HSM initialization
- Emergency key recovery
```

### Shamir's Secret Sharing

Split a key into N shares where any K shares can reconstruct the key (K-of-N threshold).

```python
# Shamir's Secret Sharing using the 'secretsharing' library
from secretsharing import PlaintextToHexSecretSharer

# Split key into 5 shares, any 3 can reconstruct
key = "0123456789abcdef0123456789abcdef"
shares = PlaintextToHexSecretSharer.split_secret(key, 3, 5)

# Each share goes to a different custodian
# share[0] -> Custodian A
# share[1] -> Custodian B
# share[2] -> Custodian C
# share[3] -> Custodian D (backup)
# share[4] -> Custodian E (backup)

# Reconstruct with any 3 shares
recovered = PlaintextToHexSecretSharer.recover_secret(
    [shares[0], shares[2], shares[4]]
)
assert recovered == key
```

---

## 12. Key Escrow

### Purpose

Key escrow stores copies of encryption keys with a trusted third party for recovery
purposes. Use cases include:

- Business continuity if key custodians are unavailable
- Legal requirements for data access (law enforcement)
- Disaster recovery

### Implementation Considerations

- Store escrowed keys in a separate HSM or secure facility
- Require multi-party authorization to access escrowed keys
- Log all escrow access with tamper-proof audit trail
- Review escrow policies regularly
- Consider legal and regulatory implications

---

## 13. Key Compromise Response

### Incident Response Plan

```
Phase 1: Detection (0-1 hours)
  - Identify scope of compromise (which keys, which data)
  - Alert security team and key custodians
  - Preserve logs and forensic evidence

Phase 2: Containment (1-4 hours)
  - Disable compromised keys immediately
  - Revoke access for compromised systems
  - Generate new keys
  - Begin re-encryption of affected data

Phase 3: Eradication (4-24 hours)
  - Re-encrypt all data protected by compromised keys
  - Rotate all related credentials
  - Patch vulnerability that led to compromise
  - Destroy compromised key material

Phase 4: Recovery (24-72 hours)
  - Verify re-encryption is complete
  - Enable new keys for production use
  - Restore normal operations
  - Verify no data exfiltration occurred

Phase 5: Lessons Learned (1-2 weeks)
  - Document incident timeline
  - Identify root cause
  - Update key management procedures
  - Implement additional controls
```

### Automated Compromise Response

```typescript
class KeyCompromiseResponse {
  async handleCompromise(
    compromisedKeyId: string,
    reason: string
  ): Promise<void> {
    // Step 1: Log the incident
    await this.logIncident({
      keyId: compromisedKeyId,
      reason,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL'
    });

    // Step 2: Disable the compromised key
    await this.kms.send(new DisableKeyCommand({
      KeyId: compromisedKeyId
    }));

    // Step 3: Generate replacement key
    const newKey = await this.kms.send(new CreateKeyCommand({
      Description: `Replacement for compromised key ${compromisedKeyId}`,
      KeySpec: 'SYMMETRIC_DEFAULT'
    }));

    // Step 4: Start re-encryption job
    await this.startReEncryption(
      compromisedKeyId,
      newKey.KeyMetadata!.KeyId!
    );

    // Step 5: Notify security team
    await this.notifySecurityTeam({
      event: 'KEY_COMPROMISE',
      compromisedKeyId,
      newKeyId: newKey.KeyMetadata!.KeyId!,
      reason
    });
  }
}
```

---

## 14. NIST SP 800-57 Guidelines

### Key Management Recommendations

NIST SP 800-57 provides comprehensive guidelines for key management:

```
Key Strength Requirements (NIST SP 800-57 Part 1):
+-----------------------------------------------------------+
| Security Strength | Symmetric | RSA/DH    | ECC          |
|-----------------------------------------------------------|
| 112 bits          | 3TDEA     | 2048-bit  | 224-255 bit  |
| 128 bits          | AES-128   | 3072-bit  | 256-383 bit  |
| 192 bits          | AES-192   | 7680-bit  | 384-511 bit  |
| 256 bits          | AES-256   | 15360-bit | 512+ bit     |
+-----------------------------------------------------------+

Recommended minimum: 128-bit security strength (AES-128 or equivalent)
Recommended for long-term: 256-bit security strength (AES-256)
```

### Crypto Periods (Maximum Key Lifetime)

```
+------------------------------------------------+
| Key Type                  | Originator | User   |
|------------------------------------------------+
| Symmetric encryption key  | 2 years    | 5 years|
| Symmetric auth key        | 2 years    | 2 years|
| Asymmetric signature key  | 3 years    | 3 years|
| Asymmetric key agreement  | 1-2 years  | 1-2 yr |
| Master key                | 3+ years   | N/A    |
+------------------------------------------------+
```

---

## 15. Code Examples

### TypeScript: Complete Key Management Service

```typescript
import {
  KMSClient,
  CreateKeyCommand,
  GenerateDataKeyCommand,
  DecryptCommand,
  EnableKeyRotationCommand,
  DisableKeyCommand
} from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

interface EncryptedRecord {
  ciphertext: string;
  nonce: string;
  tag: string;
  encryptedDEK: string;
  kekId: string;
  version: number;
}

class KeyManagementService {
  private kms: KMSClient;
  private kekId: string;

  constructor(region: string, kekId: string) {
    this.kms = new KMSClient({ region });
    this.kekId = kekId;
  }

  async encrypt(
    plaintext: Buffer,
    context: Record<string, string>
  ): Promise<EncryptedRecord> {
    // Generate DEK from KMS
    const { Plaintext: dek, CiphertextBlob: encryptedDEK } =
      await this.kms.send(new GenerateDataKeyCommand({
        KeyId: this.kekId,
        KeySpec: 'AES_256',
        EncryptionContext: context
      }));

    // Encrypt with DEK
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek!, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    // Zero out DEK
    (dek as Buffer).fill(0);

    return {
      ciphertext: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
      tag: tag.toString('base64'),
      encryptedDEK: Buffer.from(encryptedDEK!).toString('base64'),
      kekId: this.kekId,
      version: 1
    };
  }

  async decrypt(
    record: EncryptedRecord,
    context: Record<string, string>
  ): Promise<Buffer> {
    // Decrypt DEK from KMS
    const { Plaintext: dek } = await this.kms.send(new DecryptCommand({
      CiphertextBlob: Buffer.from(record.encryptedDEK, 'base64'),
      EncryptionContext: context
    }));

    // Decrypt data with DEK
    const decipher = createDecipheriv(
      'aes-256-gcm',
      dek!,
      Buffer.from(record.nonce, 'base64')
    );
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, 'base64')),
      decipher.final()
    ]);

    // Zero out DEK
    (dek as Buffer).fill(0);

    return plaintext;
  }

  async enableAutoRotation(): Promise<void> {
    await this.kms.send(new EnableKeyRotationCommand({
      KeyId: this.kekId
    }));
  }
}
```

### Go: Key Management with Vault Transit

```go
package keymanagement

import (
    "context"
    "encoding/base64"
    "fmt"
    "time"

    vault "github.com/hashicorp/vault/api"
)

type KeyManager struct {
    client  *vault.Client
    keyName string
}

func NewKeyManager(vaultAddr, token, keyName string) (*KeyManager, error) {
    config := vault.DefaultConfig()
    config.Address = vaultAddr

    client, err := vault.NewClient(config)
    if err != nil {
        return nil, fmt.Errorf("create vault client: %w", err)
    }
    client.SetToken(token)

    return &KeyManager{client: client, keyName: keyName}, nil
}

func (km *KeyManager) CreateKey(ctx context.Context) error {
    _, err := km.client.Logical().WriteWithContext(ctx,
        fmt.Sprintf("transit/keys/%s", km.keyName),
        map[string]interface{}{
            "type":               "aes256-gcm96",
            "auto_rotate_period": "90d",
            "deletion_allowed":   false,
        },
    )
    return err
}

func (km *KeyManager) Encrypt(ctx context.Context, data []byte) (string, error) {
    encoded := base64.StdEncoding.EncodeToString(data)

    secret, err := km.client.Logical().WriteWithContext(ctx,
        fmt.Sprintf("transit/encrypt/%s", km.keyName),
        map[string]interface{}{
            "plaintext": encoded,
        },
    )
    if err != nil {
        return "", fmt.Errorf("encrypt: %w", err)
    }

    return secret.Data["ciphertext"].(string), nil
}

func (km *KeyManager) Decrypt(ctx context.Context, ciphertext string) ([]byte, error) {
    secret, err := km.client.Logical().WriteWithContext(ctx,
        fmt.Sprintf("transit/decrypt/%s", km.keyName),
        map[string]interface{}{
            "ciphertext": ciphertext,
        },
    )
    if err != nil {
        return nil, fmt.Errorf("decrypt: %w", err)
    }

    decoded, err := base64.StdEncoding.DecodeString(
        secret.Data["plaintext"].(string),
    )
    if err != nil {
        return nil, fmt.Errorf("decode: %w", err)
    }

    return decoded, nil
}

func (km *KeyManager) RotateKey(ctx context.Context) error {
    _, err := km.client.Logical().WriteWithContext(ctx,
        fmt.Sprintf("transit/keys/%s/rotate", km.keyName),
        nil,
    )
    return err
}

func (km *KeyManager) Rewrap(ctx context.Context, ciphertext string) (string, error) {
    secret, err := km.client.Logical().WriteWithContext(ctx,
        fmt.Sprintf("transit/rewrap/%s", km.keyName),
        map[string]interface{}{
            "ciphertext": ciphertext,
        },
    )
    if err != nil {
        return "", fmt.Errorf("rewrap: %w", err)
    }

    return secret.Data["ciphertext"].(string), nil
}
```

---

## 16. Best Practices

### 1. Use a Dedicated Key Management System

Store all keys in HSM, Cloud KMS, or HashiCorp Vault. Never store keys in application
configuration, source code, environment variables, or databases.

### 2. Implement Envelope Encryption

Use envelope encryption (DEK encrypted by KEK) for all application-level encryption.
This limits KMS API calls and enables efficient key rotation.

### 3. Enforce Separation of Duties

Separate key administration from key usage. Administrators who manage keys should not
have access to encrypted data. Users who access data should not manage keys.

### 4. Rotate Keys on a Defined Schedule

Rotate KEKs at least annually. Enable automatic rotation in cloud KMS services.
Document rotation procedures and test them regularly.

### 5. Log All Key Operations

Enable audit logging for every key creation, usage, rotation, and deletion. Monitor
logs for anomalous key access patterns. Retain logs for compliance periods.

### 6. Implement Key Access Controls

Use IAM policies, Vault policies, or KMS key policies to restrict key access to only
the services and users that require it. Apply the principle of least privilege.

### 7. Plan for Key Compromise

Maintain a documented incident response plan for key compromise. Include procedures
for key revocation, data re-encryption, and stakeholder notification. Test the plan
annually.

### 8. Zero Out Key Material After Use

Clear plaintext keys from memory immediately after use. Use secure memory management
functions. Avoid copying keys unnecessarily.

### 9. Use Encryption Context for Authorization

Pass encryption context (key-value pairs) with KMS operations. This ties decryption
authorization to specific contexts, preventing misuse of decrypted keys.

### 10. Maintain Key Inventory

Document all keys including purpose, owner, creation date, rotation schedule, and
associated data. Review the inventory quarterly.

---

## 17. Anti-Patterns

### 1. Storing Keys in Environment Variables

Environment variables are accessible via /proc filesystem, process listings, crash
dumps, and container orchestration APIs. They are not a secure key storage mechanism.

### 2. Sharing Keys Across Environments

Using the same encryption key in development, staging, and production creates risk.
A developer with test environment access gains access to production data.

### 3. No Key Rotation Plan

Deploying encryption without a rotation strategy means keys remain static indefinitely.
This increases the risk window if a key is compromised.

### 4. Using a Single Key for Everything

One key for all data means a single compromise exposes everything. Use different keys
per tenant, per service, or per data classification level.

### 5. Manual Key Management Processes

Manual key generation, distribution, and rotation are error-prone and do not scale.
Automate all key management operations.

### 6. No Key Destruction Procedure

Failing to securely destroy retired keys leaves them available for recovery by
attackers. Implement crypto-erasure and verify destruction.

### 7. Ignoring Key Dependencies

Deleting or disabling a key without understanding what data it protects causes
permanent data loss. Map key dependencies before any key lifecycle action.

### 8. Using Deprecated Algorithms

Continuing to use 3DES, RSA-1024, or SHA-1 for key operations introduces known
vulnerabilities. Migrate to modern algorithms promptly.

---

## 18. Enforcement Checklist

### Key Infrastructure

- [ ] Dedicated KMS or HSM is deployed and operational
- [ ] Key hierarchy is documented (master key, KEK, DEK)
- [ ] HSM is FIPS 140-2 Level 3 certified (if applicable)
- [ ] KMS access is restricted to authorized services only
- [ ] Backup KMS/HSM is available for disaster recovery

### Key Generation

- [ ] All keys generated using CSPRNG
- [ ] Key sizes meet minimum requirements (AES-256, RSA-3072+)
- [ ] Key generation is logged and auditable
- [ ] No keys derived from weak sources (passwords without KDF, predictable seeds)

### Key Storage

- [ ] No keys in source code (verified by secret scanning)
- [ ] No keys in environment variables
- [ ] No keys in configuration files
- [ ] No keys stored alongside encrypted data
- [ ] Key storage is access-controlled and audited

### Key Rotation

- [ ] Automatic key rotation is enabled where available
- [ ] Key rotation schedule is documented and followed
- [ ] Rotation procedure is tested quarterly
- [ ] Old keys are maintained for decryption during transition
- [ ] Old keys are disabled after migration and destroyed after retention period

### Key Access Control

- [ ] Principle of least privilege applied to key access
- [ ] Separation of duties between key admin and key usage
- [ ] Encryption context enforced in KMS policies
- [ ] Key access reviewed quarterly
- [ ] Emergency key access procedures documented

### Monitoring and Incident Response

- [ ] All key operations are audit logged
- [ ] Anomalous key access patterns trigger alerts
- [ ] Key compromise response plan is documented
- [ ] Key compromise response plan is tested annually
- [ ] Key inventory is maintained and reviewed quarterly

### Compliance

- [ ] Key management procedures align with NIST SP 800-57
- [ ] Key crypto periods comply with organizational policy
- [ ] Key management documentation is available for audit
- [ ] Split knowledge and dual control implemented for master keys
- [ ] Key escrow procedures documented (if applicable)
