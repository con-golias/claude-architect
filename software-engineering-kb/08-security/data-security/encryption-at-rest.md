# Encryption at Rest

## Comprehensive Guide to Protecting Stored Data

Category: Data Security
Scope: Full-disk, filesystem, database, application-level, and cloud encryption
Last Updated: 2025-12-01
Status: Living Document

---

## Table of Contents

1. Why Encrypt Data at Rest
2. Encryption Levels Overview
3. Full-Disk Encryption
4. Filesystem-Level Encryption
5. Database-Level Encryption (TDE)
6. Application-Level Encryption
7. Column and Field-Level Encryption
8. AES-256-GCM for Application-Level Encryption
9. Envelope Encryption Pattern
10. Cloud Provider Encryption
11. Key Hierarchy
12. Searchable Encryption
13. Transparent vs Application-Level Encryption Tradeoffs
14. Code Examples
15. Best Practices
16. Anti-Patterns
17. Enforcement Checklist

---

## 1. Why Encrypt Data at Rest

### Compliance Requirements

Regulations mandate encryption of sensitive data at rest:

- **GDPR Article 32**: Require encryption as a security measure for personal data
- **HIPAA Security Rule**: Require encryption of electronic protected health information (ePHI)
- **PCI DSS Requirement 3**: Protect stored cardholder data with strong cryptography
- **SOC 2 Trust Criteria**: Demonstrate encryption controls for data at rest
- **CCPA**: Mandate reasonable security measures including encryption

### Breach Mitigation

Encryption at rest renders stolen data useless to attackers:

- **Physical theft**: Stolen drives or decommissioned hardware contain ciphertext only
- **Database dumps**: Exfiltrated data remains encrypted without corresponding keys
- **Backup theft**: Encrypted backups cannot be read without key material
- **Insider threats**: Database administrators cannot read application-encrypted fields
- **Cloud provider breach**: Customer data remains protected even if infrastructure is compromised

### Defense in Depth

Encryption at rest forms one layer in a comprehensive security strategy:

```
Layer 1: Network perimeter (firewalls, WAF)
Layer 2: Transport encryption (TLS)
Layer 3: Access controls (IAM, RBAC)
Layer 4: Encryption at rest       <-- This guide
Layer 5: Application-level encryption
Layer 6: Monitoring and alerting
```

Even when other layers fail, encryption at rest provides a final safeguard against
unauthorized data access. A compromised network combined with stolen credentials
still yields only ciphertext if encryption at rest is properly implemented.

---

## 2. Encryption Levels Overview

```
+------------------------------------------------------------------+
|  Level              | Protects Against        | Granularity       |
|------------------------------------------------------------------+
|  Full-Disk (FDE)    | Physical theft          | Entire disk       |
|  Filesystem         | File-level theft        | Files/directories |
|  Database (TDE)     | Database file theft     | Tables/tablespace |
|  Application-Level  | DB admin, SQL injection | Individual values |
|  Column/Field       | Selective protection    | Specific columns  |
+------------------------------------------------------------------+
```

Each level addresses different threat models. Use multiple levels for defense in depth.
Full-disk encryption protects against physical theft but not against a compromised
application with valid database credentials. Application-level encryption protects
against database compromise but adds complexity and latency.

---

## 3. Full-Disk Encryption

### LUKS (Linux Unified Key Setup)

LUKS is the standard for Linux full-disk encryption. It provides a platform-independent
standard on-disk format for use in various tools and supports multiple passphrases.

```bash
# Create LUKS-encrypted partition
cryptsetup luksFormat /dev/sda2

# Open encrypted partition
cryptsetup luksOpen /dev/sda2 encrypted_volume

# Create filesystem on decrypted volume
mkfs.ext4 /dev/mapper/encrypted_volume

# Mount the volume
mount /dev/mapper/encrypted_volume /mnt/secure

# Add a backup key slot
cryptsetup luksAddKey /dev/sda2

# View LUKS header information
cryptsetup luksDump /dev/sda2

# Benchmark available ciphers
cryptsetup benchmark
```

### dm-crypt

dm-crypt operates at the block device level in the Linux kernel. LUKS is built on top
of dm-crypt and provides key management and metadata storage.

```bash
# Create dm-crypt volume with explicit cipher
cryptsetup create secure_vol /dev/sda2 \
  --cipher aes-xts-plain64 \
  --key-size 512 \
  --hash sha256

# Verify cipher in use
dmsetup table secure_vol
```

### BitLocker (Windows)

BitLocker provides full-volume encryption for Windows systems. Use TPM (Trusted
Platform Module) for transparent decryption at boot.

```powershell
# Enable BitLocker on a drive with TPM
Enable-BitLocker -MountPoint "C:" `
  -EncryptionMethod XtsAes256 `
  -TpmProtector

# Add recovery password protector
Add-BitLockerKeyProtector -MountPoint "C:" `
  -RecoveryPasswordProtector

# Check BitLocker status
Get-BitLockerVolume -MountPoint "C:"

# Enable for data drive with password
Enable-BitLocker -MountPoint "D:" `
  -EncryptionMethod XtsAes256 `
  -PasswordProtector
```

### When to Use Full-Disk Encryption

- Laptops and portable devices that may be lost or stolen
- Servers in environments without physical security controls
- Compliance requirements that mandate disk-level encryption
- Decommissioned hardware that will be recycled or sold

### Limitations

- Does NOT protect data while the system is running and unlocked
- Does NOT protect against remote attacks through the operating system
- Does NOT protect against privileged users on a running system

---

## 4. Filesystem-Level Encryption

### eCryptfs

eCryptfs is a POSIX-compliant stacked filesystem encryption layer for Linux. It stores
cryptographic metadata in file headers, allowing individual file encryption.

```bash
# Mount encrypted directory
mount -t ecryptfs /secure/source /secure/target

# Configure via interactive prompts:
# - Select cipher (aes)
# - Select key size (32 bytes / 256 bits)
# - Enable plaintext passthrough (no)
# - Enable filename encryption (yes)
```

### fscrypt (Linux native filesystem encryption)

fscrypt provides filesystem-level encryption for ext4, F2FS, and UBIFS. It operates
within the filesystem itself rather than as a stacked layer.

```bash
# Initialize fscrypt on filesystem
fscrypt setup
fscrypt setup /mnt/data

# Create a protected directory
fscrypt encrypt /mnt/data/sensitive

# Lock a directory (requires kernel 5.4+)
fscrypt lock /mnt/data/sensitive

# Unlock a directory
fscrypt unlock /mnt/data/sensitive

# Check protection status
fscrypt status /mnt/data/sensitive
```

### Advantages Over Full-Disk Encryption

- Encrypt specific directories rather than entire disks
- Different keys for different directories or users
- Files remain encrypted even when the system is running
- Granular access control at the directory level

---

## 5. Database-Level Encryption (TDE)

### PostgreSQL TDE

PostgreSQL does not include built-in TDE in the community edition. Use extensions
or external solutions.

```sql
-- Using pgcrypto extension for column-level encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt a value with AES-256
INSERT INTO users (name, ssn_encrypted)
VALUES (
  'John Doe',
  pgp_sym_encrypt('123-45-6789', 'encryption-key-here')
);

-- Decrypt a value
SELECT name,
       pgp_sym_decrypt(ssn_encrypted::bytea, 'encryption-key-here') AS ssn
FROM users
WHERE id = 1;

-- Using raw AES encryption
SELECT encrypt(
  convert_to('sensitive data', 'utf8'),
  convert_to('32-byte-key-goes-here-pad-xxxxx', 'utf8'),
  'aes-cbc/pad:pkcs'
);
```

### MySQL TDE (InnoDB Tablespace Encryption)

```sql
-- Enable encryption for InnoDB tablespace
ALTER TABLE customers ENCRYPTION='Y';

-- Create encrypted tablespace
CREATE TABLESPACE secure_ts
  ADD DATAFILE 'secure_ts.ibd'
  ENCRYPTION='Y';

-- Create table in encrypted tablespace
CREATE TABLE sensitive_data (
  id INT PRIMARY KEY,
  data TEXT
) TABLESPACE secure_ts ENCRYPTION='Y';

-- Verify encryption status
SELECT TABLE_SCHEMA, TABLE_NAME, CREATE_OPTIONS
FROM INFORMATION_SCHEMA.TABLES
WHERE CREATE_OPTIONS LIKE '%ENCRYPTION%';

-- Configure keyring plugin in my.cnf
-- [mysqld]
-- early-plugin-load=keyring_file.so
-- keyring_file_data=/var/lib/mysql-keyring/keyring
```

### SQL Server TDE

```sql
-- Create master key in master database
USE master;
CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'StrongP@ssw0rd!';

-- Create certificate for TDE
CREATE CERTIFICATE TDECert WITH SUBJECT = 'TDE Certificate';

-- Create database encryption key
USE SensitiveDB;
CREATE DATABASE ENCRYPTION KEY
WITH ALGORITHM = AES_256
ENCRYPTION BY SERVER CERTIFICATE TDECert;

-- Enable TDE
ALTER DATABASE SensitiveDB SET ENCRYPTION ON;

-- Verify TDE status
SELECT db.name,
       db.is_encrypted,
       dm.encryption_state,
       dm.key_algorithm,
       dm.key_length
FROM sys.databases db
LEFT JOIN sys.dm_database_encryption_keys dm
  ON db.database_id = dm.database_id;

-- CRITICAL: Back up the certificate and private key
BACKUP CERTIFICATE TDECert
TO FILE = 'C:\Backup\TDECert.cer'
WITH PRIVATE KEY (
  FILE = 'C:\Backup\TDECert_Key.pvk',
  ENCRYPTION BY PASSWORD = 'BackupP@ssw0rd!'
);
```

---

## 6. Application-Level Encryption

Application-level encryption provides the strongest protection because data is encrypted
before it reaches the database. Even database administrators and compromised database
servers cannot read the plaintext.

### Architecture

```
Application Server                    Database Server
+------------------+                  +------------------+
| Plaintext data   |                  | Ciphertext only  |
| Encrypt with DEK |  -- network -->  | Stored encrypted |
| DEK from KMS     |                  | No key access    |
+------------------+                  +------------------+
        |
        v
  +----------+
  | KMS/Vault|
  | KEK      |
  +----------+
```

### When to Use Application-Level Encryption

- Protecting data from database administrators
- Multi-tenant systems where tenant data must be isolated
- High-value fields (SSN, credit card numbers, health records)
- Compliance requirements for end-to-end encryption
- When database-level encryption is insufficient for the threat model

---

## 7. AES-256-GCM for Application-Level Encryption

AES-256-GCM (Galois/Counter Mode) provides both confidentiality and authenticity.
It is an AEAD (Authenticated Encryption with Associated Data) cipher.

### Properties of AES-256-GCM

- **256-bit key**: Provides 128-bit security level against quantum attacks
- **96-bit nonce**: MUST be unique per encryption operation with the same key
- **128-bit authentication tag**: Detects tampering with ciphertext
- **Associated data**: Authenticate additional context without encrypting it
- **Stream cipher mode**: No padding required, output same length as input

### Critical Rules

1. NEVER reuse a nonce with the same key -- this completely breaks security
2. Generate nonces using a CSPRNG (cryptographically secure random number generator)
3. Use a 96-bit (12-byte) nonce for GCM
4. Store the nonce alongside the ciphertext (it is not secret)
5. Always verify the authentication tag before using decrypted data

---

## 8. Envelope Encryption Pattern

Envelope encryption uses a two-layer key hierarchy: a Data Encryption Key (DEK)
encrypts the data, and a Key Encryption Key (KEK) encrypts the DEK.

### How It Works

```
Step 1: Generate a random DEK
Step 2: Encrypt the data with the DEK (AES-256-GCM)
Step 3: Encrypt the DEK with the KEK (from KMS)
Step 4: Store encrypted data + encrypted DEK together
Step 5: Discard the plaintext DEK from memory

Decryption:
Step 1: Send encrypted DEK to KMS for decryption
Step 2: KMS returns plaintext DEK
Step 3: Decrypt data with the plaintext DEK
Step 4: Discard the plaintext DEK from memory
```

### Benefits of Envelope Encryption

- **Performance**: Only a small DEK traverses the network to KMS, not the entire dataset
- **Key rotation**: Rotate KEK without re-encrypting all data; only re-wrap DEKs
- **Separation of duties**: KMS manages KEK; application manages data encryption
- **Audit trail**: KMS logs every DEK decryption request
- **Granularity**: Use different DEKs per record, per tenant, or per field

---

## 9. Cloud Provider Encryption

### AWS Encryption Options

```
+------------------------------------------------------------+
| Option    | Key Management   | Key Location | Use Case     |
|------------------------------------------------------------+
| SSE-S3    | AWS-managed      | AWS          | Default      |
| SSE-KMS   | Customer-managed | AWS KMS      | Compliance   |
| SSE-C     | Customer-managed | Customer     | Full control |
| CSE       | Customer-managed | Customer     | End-to-end   |
+------------------------------------------------------------+
```

```typescript
// AWS SSE-KMS encryption for S3
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });

// Upload with SSE-KMS encryption
await s3.send(new PutObjectCommand({
  Bucket: 'secure-bucket',
  Key: 'sensitive-document.pdf',
  Body: fileBuffer,
  ServerSideEncryption: 'aws:kms',
  SSEKMSKeyId: 'arn:aws:kms:us-east-1:123456789:key/key-id',
  // Optional: encryption context for additional authorization
  SSEKMSEncryptionContext: JSON.stringify({
    tenant: 'acme-corp',
    classification: 'confidential'
  })
}));
```

```python
# AWS SSE-KMS with Python (boto3)
import boto3

s3 = boto3.client('s3')

s3.put_object(
    Bucket='secure-bucket',
    Key='sensitive-document.pdf',
    Body=file_content,
    ServerSideEncryption='aws:kms',
    SSEKMSKeyId='arn:aws:kms:us-east-1:123456789:key/key-id',
    SSEKMSEncryptionContext={
        'tenant': 'acme-corp',
        'classification': 'confidential'
    }
)
```

### AWS S3 Bucket Policy for Mandatory Encryption

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::secure-bucket/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    },
    {
      "Sid": "DenyNullEncryption",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::secure-bucket/*",
      "Condition": {
        "Null": {
          "s3:x-amz-server-side-encryption": "true"
        }
      }
    }
  ]
}
```

### GCP Encryption Options

```python
# GCP CMEK (Customer-Managed Encryption Keys)
from google.cloud import storage

client = storage.Client()
bucket = client.bucket('secure-bucket')

# Set default CMEK for the bucket
bucket.default_kms_key_name = (
    'projects/my-project/locations/us/keyRings/my-ring/'
    'cryptoKeys/my-key'
)
bucket.patch()

# Upload with CMEK
blob = bucket.blob('sensitive-data.json')
blob.kms_key_name = (
    'projects/my-project/locations/us/keyRings/my-ring/'
    'cryptoKeys/my-key'
)
blob.upload_from_string(json.dumps(data))
```

### Azure Encryption Options

```python
# Azure Blob Storage with Customer-Managed Keys
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
blob_service = BlobServiceClient(
    account_url="https://account.blob.core.windows.net",
    credential=credential
)

# Upload with server-side encryption (automatic with CMK configured)
blob_client = blob_service.get_blob_client(
    container='secure-container',
    blob='sensitive-data.json'
)
blob_client.upload_blob(data, overwrite=True)
```

---

## 10. Key Hierarchy

### Structure

```
Master Key (HSM / Cloud KMS)
    |
    +-- Key Encryption Key (KEK) - Region/Service level
    |       |
    |       +-- Data Encryption Key (DEK) - Per record/tenant
    |       |
    |       +-- Data Encryption Key (DEK)
    |
    +-- Key Encryption Key (KEK) - Another service
            |
            +-- Data Encryption Key (DEK)
```

### Key Hierarchy Implementation

```typescript
// Key hierarchy with AWS KMS
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand
} from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'us-east-1' });

// Generate a data encryption key (DEK)
async function generateDEK(cmkId: string, context: Record<string, string>) {
  const command = new GenerateDataKeyCommand({
    KeyId: cmkId,
    KeySpec: 'AES_256',
    EncryptionContext: context
  });

  const response = await kms.send(command);

  return {
    plaintextKey: response.Plaintext,         // Use for encryption, then discard
    encryptedKey: response.CiphertextBlob     // Store alongside ciphertext
  };
}

// Decrypt a DEK using the KEK in KMS
async function decryptDEK(
  encryptedKey: Uint8Array,
  context: Record<string, string>
) {
  const command = new DecryptCommand({
    CiphertextBlob: encryptedKey,
    EncryptionContext: context
  });

  const response = await kms.send(command);
  return response.Plaintext; // Use for decryption, then discard
}
```

---

## 11. Searchable Encryption

### Deterministic Encryption (Exact Match Search)

Deterministic encryption always produces the same ciphertext for the same plaintext
and key. This allows exact-match queries on encrypted data.

```typescript
import { createCipheriv, createHash } from 'crypto';

// Deterministic encryption using AES-SIV or HMAC-based approach
function deterministicEncrypt(
  plaintext: string,
  key: Buffer
): string {
  // Derive a deterministic IV from the plaintext
  const iv = createHash('sha256')
    .update(key)
    .update(plaintext)
    .digest()
    .subarray(0, 16);

  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  return Buffer.concat([iv, encrypted]).toString('base64');
}

// Query encrypted column with deterministic encryption
// SELECT * FROM users WHERE email_encrypted = deterministicEncrypt('user@example.com', key)
```

**Warning**: Deterministic encryption leaks equality patterns. An attacker can determine
which rows have the same value. Use only when the security tradeoff is acceptable.

### Order-Preserving Encryption (Range Queries)

Order-preserving encryption (OPE) maintains the order of plaintexts in the ciphertexts,
allowing range queries (>, <, BETWEEN) on encrypted data.

**Warning**: OPE leaks ordering information and is considered weak. Use only when
absolutely necessary, and combine with other security measures. Prefer application-side
filtering when possible.

```
Plaintext:  10  20  30  40  50
OPE:       234 567 789 912 1045
Order:     preserved -- allows range queries
Leakage:   attacker knows relative ordering
```

### Practical Approach: Blind Indexing

```typescript
import { createHmac } from 'crypto';

// Create a blind index for searchable encryption
function createBlindIndex(
  plaintext: string,
  indexKey: Buffer,
  indexSize: number = 32
): string {
  return createHmac('sha256', indexKey)
    .update(plaintext.toLowerCase().trim())
    .digest('hex')
    .substring(0, indexSize);
}

// Store both encrypted value and blind index
async function storeEncryptedSearchable(
  email: string,
  encryptionKey: Buffer,
  indexKey: Buffer
) {
  const encryptedEmail = aes256GcmEncrypt(email, encryptionKey);
  const emailIndex = createBlindIndex(email, indexKey);

  await db.query(
    'INSERT INTO users (email_encrypted, email_index) VALUES ($1, $2)',
    [encryptedEmail, emailIndex]
  );
}

// Search using blind index
async function findByEmail(email: string, indexKey: Buffer) {
  const emailIndex = createBlindIndex(email, indexKey);

  return db.query(
    'SELECT * FROM users WHERE email_index = $1',
    [emailIndex]
  );
}
```

---

## 12. Transparent vs Application-Level Encryption Tradeoffs

```
+----------------------------------------------------------------------+
| Aspect              | Transparent (TDE)     | Application-Level      |
|----------------------------------------------------------------------+
| Protection scope    | Disk/file level       | Data value level       |
| Protects from DBA   | No                    | Yes                    |
| Query capability    | Full SQL              | Limited (blind index)  |
| Performance impact  | Low (hardware accel.) | Medium-High            |
| Implementation      | Simple (config only)  | Complex (code changes) |
| Key management      | Database handles      | Application handles    |
| Backup protection   | Yes (files encrypted) | Yes (values encrypted) |
| Compliance          | Often sufficient      | Strongest protection   |
| Index support       | Full                  | Limited                |
| SQL injection       | No protection         | Data still encrypted   |
+----------------------------------------------------------------------+
```

Recommendation: Use TDE as a baseline for all databases. Add application-level
encryption for high-value fields that must be protected from database administrators
and SQL injection attacks.

---

## 13. Code Examples

### TypeScript: AES-256-GCM Encryption

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

interface EncryptedPayload {
  ciphertext: string;  // Base64-encoded ciphertext
  nonce: string;       // Base64-encoded nonce (IV)
  tag: string;         // Base64-encoded authentication tag
  version: number;     // Encryption version for future rotation
}

function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  // Generate a unique 96-bit nonce using CSPRNG
  const nonce = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, nonce);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    tag: tag.toString('base64'),
    version: 1
  };
}

function decrypt(payload: EncryptedPayload, key: Buffer): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.nonce, 'base64')
  );

  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}

// Usage
const key = randomBytes(32); // 256-bit key from KMS in production
const encrypted = encrypt('SSN: 123-45-6789', key);
const decrypted = decrypt(encrypted, key);
```

### TypeScript: Envelope Encryption with AWS KMS

```typescript
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand
} from '@aws-sdk/client-kms';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const kms = new KMSClient({ region: 'us-east-1' });
const CMK_ID = 'alias/my-application-key';

interface EnvelopeEncryptedData {
  encryptedData: string;
  encryptedDEK: string;
  nonce: string;
  tag: string;
  encryptionContext: Record<string, string>;
}

async function envelopeEncrypt(
  plaintext: string,
  context: Record<string, string>
): Promise<EnvelopeEncryptedData> {
  // Step 1: Generate DEK from KMS
  const { Plaintext: dekPlaintext, CiphertextBlob: dekEncrypted } =
    await kms.send(new GenerateDataKeyCommand({
      KeyId: CMK_ID,
      KeySpec: 'AES_256',
      EncryptionContext: context
    }));

  // Step 2: Encrypt data with plaintext DEK
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dekPlaintext!, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  // Step 3: Discard plaintext DEK -- zero out the buffer
  (dekPlaintext as Buffer).fill(0);

  // Step 4: Return encrypted data + encrypted DEK
  return {
    encryptedData: ciphertext.toString('base64'),
    encryptedDEK: Buffer.from(dekEncrypted!).toString('base64'),
    nonce: nonce.toString('base64'),
    tag: tag.toString('base64'),
    encryptionContext: context
  };
}

async function envelopeDecrypt(
  envelope: EnvelopeEncryptedData
): Promise<string> {
  // Step 1: Decrypt DEK using KMS
  const { Plaintext: dekPlaintext } = await kms.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(envelope.encryptedDEK, 'base64'),
    EncryptionContext: envelope.encryptionContext
  }));

  // Step 2: Decrypt data with plaintext DEK
  const decipher = createDecipheriv(
    'aes-256-gcm',
    dekPlaintext!,
    Buffer.from(envelope.nonce, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.encryptedData, 'base64')),
    decipher.final()
  ]);

  // Step 3: Zero out DEK
  (dekPlaintext as Buffer).fill(0);

  return plaintext.toString('utf8');
}
```

### Go: AES-256-GCM Encryption

```go
package encryption

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io"
)

type EncryptedPayload struct {
    Ciphertext string `json:"ciphertext"`
    Nonce      string `json:"nonce"`
    Version    int    `json:"version"`
}

func Encrypt(plaintext []byte, key []byte) (*EncryptedPayload, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, fmt.Errorf("create cipher: %w", err)
    }

    aesGCM, err := cipher.NewGCM(block)
    if err != nil {
        return nil, fmt.Errorf("create GCM: %w", err)
    }

    // Generate random nonce
    nonce := make([]byte, aesGCM.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, fmt.Errorf("generate nonce: %w", err)
    }

    // Encrypt and authenticate
    // GCM appends the authentication tag to the ciphertext
    ciphertext := aesGCM.Seal(nil, nonce, plaintext, nil)

    return &EncryptedPayload{
        Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
        Nonce:      base64.StdEncoding.EncodeToString(nonce),
        Version:    1,
    }, nil
}

func Decrypt(payload *EncryptedPayload, key []byte) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, fmt.Errorf("create cipher: %w", err)
    }

    aesGCM, err := cipher.NewGCM(block)
    if err != nil {
        return nil, fmt.Errorf("create GCM: %w", err)
    }

    ciphertext, err := base64.StdEncoding.DecodeString(payload.Ciphertext)
    if err != nil {
        return nil, fmt.Errorf("decode ciphertext: %w", err)
    }

    nonce, err := base64.StdEncoding.DecodeString(payload.Nonce)
    if err != nil {
        return nil, fmt.Errorf("decode nonce: %w", err)
    }

    plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return nil, fmt.Errorf("decrypt: %w", err)
    }

    return plaintext, nil
}
```

### Python: AES-256-GCM Encryption

```python
import os
import base64
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class EncryptionService:
    """AES-256-GCM encryption service with envelope encryption support."""

    def __init__(self, key: bytes):
        if len(key) != 32:
            raise ValueError("Key must be 32 bytes for AES-256")
        self._key = key
        self._aesgcm = AESGCM(key)

    def encrypt(
        self,
        plaintext: bytes,
        associated_data: bytes | None = None
    ) -> dict:
        """Encrypt data with AES-256-GCM."""
        # Generate 96-bit nonce
        nonce = os.urandom(12)

        ciphertext = self._aesgcm.encrypt(nonce, plaintext, associated_data)

        return {
            "ciphertext": base64.b64encode(ciphertext).decode(),
            "nonce": base64.b64encode(nonce).decode(),
            "version": 1
        }

    def decrypt(
        self,
        payload: dict,
        associated_data: bytes | None = None
    ) -> bytes:
        """Decrypt AES-256-GCM encrypted data."""
        ciphertext = base64.b64decode(payload["ciphertext"])
        nonce = base64.b64decode(payload["nonce"])

        return self._aesgcm.decrypt(nonce, ciphertext, associated_data)


# Envelope encryption with AWS KMS
import boto3


class EnvelopeEncryption:
    """Envelope encryption using AWS KMS for key management."""

    def __init__(self, kms_key_id: str, region: str = "us-east-1"):
        self._kms = boto3.client("kms", region_name=region)
        self._kms_key_id = kms_key_id

    def encrypt(
        self,
        plaintext: bytes,
        context: dict[str, str]
    ) -> dict:
        """Encrypt using envelope encryption pattern."""
        # Generate DEK from KMS
        response = self._kms.generate_data_key(
            KeyId=self._kms_key_id,
            KeySpec="AES_256",
            EncryptionContext=context
        )

        plaintext_dek = response["Plaintext"]
        encrypted_dek = response["CiphertextBlob"]

        # Encrypt data with DEK
        service = EncryptionService(plaintext_dek)
        encrypted = service.encrypt(plaintext)

        # Zero out plaintext DEK
        plaintext_dek = b'\x00' * len(plaintext_dek)

        return {
            **encrypted,
            "encrypted_dek": base64.b64encode(encrypted_dek).decode(),
            "encryption_context": context
        }

    def decrypt(self, payload: dict) -> bytes:
        """Decrypt envelope-encrypted data."""
        # Decrypt DEK via KMS
        response = self._kms.decrypt(
            CiphertextBlob=base64.b64decode(payload["encrypted_dek"]),
            EncryptionContext=payload["encryption_context"]
        )

        plaintext_dek = response["Plaintext"]

        # Decrypt data with DEK
        service = EncryptionService(plaintext_dek)
        result = service.decrypt(payload)

        # Zero out plaintext DEK
        plaintext_dek = b'\x00' * len(plaintext_dek)

        return result
```

### Column-Level Encryption Example

```typescript
// Field-level encryption for a user model
import { EncryptionService } from './encryption';

interface User {
  id: string;
  name: string;                // Not encrypted -- not sensitive
  email: string;               // Encrypted -- PII
  emailIndex: string;          // Blind index -- for searching
  ssn: string;                 // Encrypted -- highly sensitive
  phoneNumber: string;         // Encrypted -- PII
  createdAt: Date;             // Not encrypted
}

class UserRepository {
  constructor(
    private db: Database,
    private encryption: EncryptionService,
    private indexKey: Buffer
  ) {}

  async create(userData: {
    name: string;
    email: string;
    ssn: string;
    phoneNumber: string;
  }): Promise<User> {
    const encryptedEmail = this.encryption.encrypt(
      Buffer.from(userData.email),
      Buffer.from(JSON.stringify({ field: 'email' }))
    );

    const encryptedSSN = this.encryption.encrypt(
      Buffer.from(userData.ssn),
      Buffer.from(JSON.stringify({ field: 'ssn' }))
    );

    const encryptedPhone = this.encryption.encrypt(
      Buffer.from(userData.phoneNumber),
      Buffer.from(JSON.stringify({ field: 'phone' }))
    );

    const emailIndex = createBlindIndex(userData.email, this.indexKey);

    return this.db.query(
      `INSERT INTO users (name, email_encrypted, email_index,
        ssn_encrypted, phone_encrypted)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        userData.name,
        JSON.stringify(encryptedEmail),
        emailIndex,
        JSON.stringify(encryptedSSN),
        JSON.stringify(encryptedPhone)
      ]
    );
  }
}
```

---

## 14. Best Practices

### 1. Use AES-256-GCM as the Default Symmetric Cipher

Select AES-256-GCM (or ChaCha20-Poly1305) for all application-level encryption.
Both provide authenticated encryption (AEAD) which prevents tampering. Avoid ECB,
plain CBC, or any unauthenticated mode.

### 2. Implement Envelope Encryption for Scalable Key Management

Never encrypt large datasets directly with a KMS key. Use envelope encryption where
a DEK encrypts the data and the KEK (in KMS) encrypts the DEK. This limits KMS
API calls and enables efficient key rotation.

### 3. Never Store Encryption Keys Alongside Encrypted Data

Store keys in a separate system (KMS, HSM, Vault) from the data they protect.
If an attacker gains access to the database, they should not also gain access to
the decryption keys.

### 4. Rotate Encryption Keys on a Defined Schedule

Rotate KEKs at least annually. When rotating, re-wrap existing DEKs with the new KEK.
Maintain old KEKs in a disabled state for decryption of data encrypted before rotation.

### 5. Generate Nonces Using CSPRNG Only

Never use counters, timestamps, or predictable values as nonces for GCM. Use
`crypto.randomBytes()` (Node.js), `crypto/rand` (Go), or `os.urandom()` (Python).
Nonce reuse with GCM completely breaks both confidentiality and authenticity.

### 6. Include Encryption Version in Ciphertext Metadata

Tag every encrypted payload with a version number. This enables key rotation,
algorithm migration, and backward compatibility. When decrypting, use the version
to determine which key and algorithm to use.

### 7. Enable TDE as a Baseline for All Databases

Transparent Data Encryption protects against physical theft of database files and
backups. Enable it even when using application-level encryption for defense in depth.

### 8. Enforce Server-Side Encryption for All Cloud Storage

Configure bucket policies to deny unencrypted uploads. Use AWS S3 bucket policies,
GCP organization policies, or Azure policies to enforce encryption.

### 9. Zero Out Key Material After Use

Clear plaintext key buffers from memory immediately after encryption or decryption.
Use `buffer.fill(0)` in Node.js, explicit zeroing in Go, or `ctypes.memset` in Python.

### 10. Test Encryption and Decryption Roundtrip in CI

Write automated tests that verify encryption/decryption roundtrip works correctly.
Include tests for key rotation, algorithm migration, and error handling.

---

## 15. Anti-Patterns

### 1. Using ECB Mode for Any Purpose

ECB (Electronic Codebook) encrypts each block independently, producing identical
ciphertext for identical plaintext blocks. This leaks patterns in the data. The
classic "ECB penguin" image demonstrates this vulnerability visually.

### 2. Reusing Nonces with GCM

Nonce reuse with AES-GCM allows an attacker to recover the authentication key and
forge ciphertexts. With two messages encrypted under the same nonce and key, the
attacker can XOR the ciphertexts to obtain the XOR of the plaintexts.

### 3. Storing Keys in Source Code or Environment Variables

Hardcoded keys in code are trivially extractable from version control, container
images, and process listings. Environment variables are visible via /proc filesystem,
process listings, and crash dumps.

### 4. Implementing Custom Encryption Algorithms

Never design or implement your own encryption algorithm or mode of operation. Use
well-vetted libraries (libsodium, OpenSSL, Go crypto/aes, Python cryptography).
Custom algorithms have not been subjected to cryptanalysis.

### 5. Encrypting Without Authentication (Plain AES-CBC)

Using AES-CBC without HMAC allows padding oracle attacks and ciphertext manipulation.
Always use AEAD modes (GCM, CCM) or encrypt-then-MAC construction.

### 6. Using the Same Key for Encryption and Authentication

Derive separate keys for encryption and authentication using a KDF (Key Derivation
Function) like HKDF. Using the same key for both functions can weaken security.

### 7. Logging Encryption Keys or Plaintext

Never log key material, plaintext sensitive data, or intermediate cryptographic
values. Implement structured logging that explicitly excludes sensitive fields.

### 8. Treating Base64 as Encryption

Base64 is an encoding scheme, not encryption. It provides zero security. Data encoded
in base64 is trivially reversible. This includes Kubernetes secrets, which store
values as base64 but provide no encryption.

---

## 16. Enforcement Checklist

### Data Classification

- [ ] Identify all data stores containing sensitive data
- [ ] Classify data sensitivity levels (public, internal, confidential, restricted)
- [ ] Map encryption requirements to each classification level
- [ ] Document which fields require application-level encryption

### Key Management

- [ ] Store all encryption keys in a dedicated KMS or HSM
- [ ] Implement envelope encryption for application-level encryption
- [ ] Define key rotation schedule (at least annual for KEKs)
- [ ] Test key rotation procedure including rollback
- [ ] Maintain key inventory with ownership and expiry dates
- [ ] Implement key access logging and alerting

### Encryption Implementation

- [ ] Enable TDE on all production databases
- [ ] Implement application-level encryption for high-value fields (SSN, credit cards)
- [ ] Use AES-256-GCM or ChaCha20-Poly1305 for symmetric encryption
- [ ] Generate nonces using CSPRNG exclusively
- [ ] Include encryption version in all ciphertext payloads
- [ ] Implement blind indexes for searchable encrypted fields
- [ ] Zero out key material after use

### Cloud Storage

- [ ] Enable default encryption on all cloud storage buckets
- [ ] Enforce encryption via bucket policies (deny unencrypted uploads)
- [ ] Use customer-managed keys (CMEK) where compliance requires
- [ ] Enable access logging on all encrypted storage
- [ ] Configure key policies to restrict key usage to authorized services

### Full-Disk and Filesystem

- [ ] Enable full-disk encryption on all laptops and portable devices
- [ ] Enable full-disk encryption on all servers
- [ ] Encrypt backup storage volumes
- [ ] Verify encryption status on decommissioned hardware before disposal

### Testing and Verification

- [ ] Automate encryption/decryption roundtrip tests in CI
- [ ] Test key rotation procedure quarterly
- [ ] Verify encrypted backups can be restored
- [ ] Perform annual penetration testing focused on encryption implementation
- [ ] Review encryption configurations during security audits
- [ ] Monitor for encryption failures and alert on anomalies

### Compliance

- [ ] Document encryption controls for each compliance framework
- [ ] Maintain evidence of encryption key management procedures
- [ ] Record encryption algorithm and key strength for audit
- [ ] Ensure cross-region data transfer uses appropriate encryption
- [ ] Review encryption requirements when regulations change
