# Database Encryption & Compliance

> **Domain:** Database > Security > Encryption & Compliance
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Data encryption protects against unauthorized access when other security layers fail — a stolen backup, a compromised server, a cloud provider breach. Compliance regulations (GDPR, HIPAA, PCI-DSS, SOC 2) mandate encryption and specific data handling practices. Without encryption at rest and in transit, a single data breach exposes all stored data in plaintext. Without compliance, your organization faces legal penalties, loss of business, and reputational damage.

---

## How It Works

### Encryption Layers

```
Database Encryption Layers:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Layer 1: Encryption in Transit (TLS)                 │
│  ┌─────────────────────────────────────────────┐     │
│  │ App ──── TLS 1.3 ──── Database              │     │
│  │ All data encrypted during transmission       │     │
│  │ Prevents: network sniffing, MITM attacks     │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  Layer 2: Encryption at Rest (disk-level)             │
│  ┌─────────────────────────────────────────────┐     │
│  │ Data files encrypted on disk                  │     │
│  │ AES-256 with key management (KMS)            │     │
│  │ Prevents: stolen disk, backup theft           │     │
│  │ Transparent: database reads/writes normally  │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  Layer 3: Column-Level Encryption (application)       │
│  ┌─────────────────────────────────────────────┐     │
│  │ Specific columns encrypted before storage    │     │
│  │ SSN, credit card, health records             │     │
│  │ App encrypts → stores ciphertext → decrypts │     │
│  │ Prevents: DBA access, SQL injection exposure │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  Layer 4: Backup Encryption                           │
│  ┌─────────────────────────────────────────────┐     │
│  │ Backups encrypted with separate key           │     │
│  │ Prevents: backup theft, S3 bucket exposure   │     │
│  └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

---

### Encryption in Transit (TLS)

```sql
-- PostgreSQL: enable TLS
-- postgresql.conf
-- ssl = on
-- ssl_cert_file = '/etc/ssl/certs/server.crt'
-- ssl_key_file = '/etc/ssl/private/server.key'
-- ssl_ca_file = '/etc/ssl/certs/ca.crt'       -- for client cert verification
-- ssl_min_protocol_version = 'TLSv1.3'

-- Force TLS connections (pg_hba.conf)
-- hostssl  all  all  0.0.0.0/0  scram-sha-256   -- only TLS
-- (use hostssl instead of host)

-- Verify TLS connection
SELECT pg_ssl.pid, pg_ssl.ssl, pg_ssl.version, pg_ssl.cipher
FROM pg_stat_ssl pg_ssl
JOIN pg_stat_activity pg_sa ON pg_ssl.pid = pg_sa.pid
WHERE pg_sa.usename = current_user;
```

```go
// Go — PostgreSQL TLS connection
import (
    "crypto/tls"
    "crypto/x509"
    "os"
    "github.com/jackc/pgx/v5/pgxpool"
)

func NewTLSPool(ctx context.Context) (*pgxpool.Pool, error) {
    // Load CA certificate
    caCert, err := os.ReadFile("/etc/ssl/certs/ca.crt")
    if err != nil {
        return nil, err
    }
    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCert)

    // Optional: load client certificate (mTLS)
    clientCert, err := tls.LoadX509KeyPair(
        "/etc/ssl/certs/client.crt",
        "/etc/ssl/private/client.key",
    )
    if err != nil {
        return nil, err
    }

    config, err := pgxpool.ParseConfig(
        "postgres://user:pass@db-host:5432/mydb?sslmode=verify-full",
    )
    if err != nil {
        return nil, err
    }

    config.ConnConfig.TLSConfig = &tls.Config{
        RootCAs:      caCertPool,
        Certificates: []tls.Certificate{clientCert},
        ServerName:   "db-host",
        MinVersion:   tls.VersionTLS13,
    }

    return pgxpool.NewWithConfig(ctx, config)
}
```

---

### Encryption at Rest

```
Encryption at Rest Options:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  1. Cloud Provider Managed (recommended)              │
│     AWS RDS: KMS encryption (AES-256)                │
│     GCP Cloud SQL: CMEK or Google-managed            │
│     Azure SQL: TDE (Transparent Data Encryption)     │
│     → Zero performance impact, zero management       │
│                                                        │
│  2. Volume-Level Encryption                           │
│     AWS EBS encryption                                │
│     Linux LUKS (dm-crypt)                             │
│     → Encrypts entire disk volume                    │
│     → Database doesn't know about encryption         │
│                                                        │
│  3. PostgreSQL pgcrypto (column-level)                │
│     → Application-controlled encryption              │
│     → Per-column granularity                         │
│     → Cannot index or query encrypted data           │
│                                                        │
│  4. MySQL TDE (InnoDB tablespace encryption)          │
│     ALTER TABLE t ENCRYPTION = 'Y';                  │
│     → Per-table encryption                           │
│     → Managed by MySQL keyring plugin                │
└──────────────────────────────────────────────────────┘
```

---

### Column-Level Encryption

```sql
-- PostgreSQL: pgcrypto for column-level encryption
CREATE EXTENSION pgcrypto;

-- Symmetric encryption (AES-256)
-- Encrypt
INSERT INTO sensitive_data (user_id, ssn_encrypted)
VALUES (
    123,
    pgp_sym_encrypt('123-45-6789', 'encryption-key-from-vault')
);

-- Decrypt
SELECT user_id,
       pgp_sym_decrypt(ssn_encrypted::bytea, 'encryption-key-from-vault') AS ssn
FROM sensitive_data
WHERE user_id = 123;

-- DANGER: encryption key in SQL is visible in logs!
-- Better: pass key as parameter from application
```

```typescript
// TypeScript — Application-level column encryption
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

function encrypt(plaintext: string, masterKey: string): string {
  const salt = randomBytes(16);
  const key = deriveKey(masterKey, salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // salt:iv:authTag:ciphertext
  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedStr: string, masterKey: string): string {
  const [saltHex, ivHex, authTagHex, ciphertext] = encryptedStr.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = deriveKey(masterKey, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Usage: encrypt before INSERT, decrypt after SELECT
const masterKey = process.env.ENCRYPTION_KEY!; // from Vault/KMS
const encryptedSSN = encrypt('123-45-6789', masterKey);
await db.query(
  'INSERT INTO users (name, ssn_encrypted) VALUES ($1, $2)',
  ['Alice', encryptedSSN]
);
```

---

### Compliance Requirements

| Regulation | Scope | Key Database Requirements |
|-----------|-------|---------------------------|
| **GDPR** | EU personal data | Encryption, right to deletion, data minimization, breach notification (72h), DPO |
| **HIPAA** | US health data | Encryption at rest + transit, access logging, minimum necessary access, BAA with vendors |
| **PCI-DSS** | Payment card data | Encryption (AES-256), tokenization, network segmentation, quarterly scans, log retention |
| **SOC 2** | Service providers | Access controls, monitoring, encryption, change management, incident response |
| **CCPA** | California consumer data | Right to access, delete, opt-out of sale, data inventory |
| **LGPD** | Brazil personal data | Similar to GDPR, consent, DPO, breach notification |

---

### Data Masking & Anonymization

```sql
-- Dynamic data masking (for non-production environments)

-- PostgreSQL: views for masked data
CREATE VIEW users_masked AS
SELECT
    id,
    name,
    -- Mask email: show first 2 chars + domain
    CONCAT(LEFT(email, 2), '***@', SPLIT_PART(email, '@', 2)) AS email,
    -- Mask phone: show last 4 digits
    CONCAT('***-***-', RIGHT(phone, 4)) AS phone,
    -- Fully mask SSN
    '***-**-****' AS ssn,
    created_at
FROM users;

-- Grant access to masked view only
GRANT SELECT ON users_masked TO analytics_team;
-- Do NOT grant on base users table

-- PostgreSQL Anonymizer extension (anon)
-- CREATE EXTENSION anon;
-- SECURITY LABEL FOR anon ON COLUMN users.email
--   IS 'MASKED WITH FUNCTION anon.fake_email()';
-- SECURITY LABEL FOR anon ON COLUMN users.name
--   IS 'MASKED WITH FUNCTION anon.fake_first_name()';

-- Data anonymization for analytics export
CREATE TABLE users_anonymized AS
SELECT
    gen_random_uuid() AS anonymous_id,  -- replace real ID
    date_trunc('month', created_at) AS signup_month,  -- reduce precision
    country,  -- keep for analytics
    subscription_tier  -- keep for analytics
    -- exclude: name, email, phone, address, SSN
FROM users;
```

---

### Key Management

```
Key Management Architecture:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Application                                           │
│  ┌──────────────┐     ┌──────────────────┐           │
│  │ App Server   │────►│ Key Management   │           │
│  │              │     │ Service          │           │
│  │ encrypt(data,│     │                  │           │
│  │  key)        │     │ AWS KMS          │           │
│  │              │     │ HashiCorp Vault  │           │
│  └──────────────┘     │ GCP KMS          │           │
│                        │ Azure Key Vault  │           │
│                        └──────────────────┘           │
│                                                        │
│  Key Hierarchy:                                       │
│  ┌──────────────────────────────────┐                │
│  │ Master Key (KMS, never exported) │                │
│  │         │                         │                │
│  │         ▼                         │                │
│  │ Data Encryption Key (DEK)        │                │
│  │ Encrypted by master key          │                │
│  │ Stored alongside encrypted data  │                │
│  │         │                         │                │
│  │         ▼                         │                │
│  │ Encrypted Data                   │                │
│  └──────────────────────────────────┘                │
│                                                        │
│  Envelope Encryption:                                 │
│  1. Generate DEK locally                              │
│  2. Encrypt data with DEK                             │
│  3. Encrypt DEK with master key (via KMS)            │
│  4. Store encrypted DEK + encrypted data             │
│  5. To decrypt: KMS decrypts DEK, DEK decrypts data │
└──────────────────────────────────────────────────────┘
```

---

### Data Retention & Right to Deletion

```sql
-- GDPR Right to Erasure implementation

-- Option 1: Hard delete with cascading
DELETE FROM user_orders WHERE user_id = $1;
DELETE FROM user_preferences WHERE user_id = $1;
DELETE FROM users WHERE id = $1;

-- Option 2: Crypto-shredding (preferred for backups)
-- Each user has unique encryption key
-- To "delete": destroy the user's key
-- Encrypted data becomes unrecoverable

-- Option 3: Anonymization (keep data for analytics)
UPDATE users SET
    name = 'DELETED',
    email = CONCAT('deleted_', id, '@anonymized.local'),
    phone = NULL,
    address = NULL,
    deleted_at = NOW()
WHERE id = $1;

-- Automated retention policy
-- Delete users inactive > 3 years
DELETE FROM users
WHERE last_login < NOW() - INTERVAL '3 years'
  AND NOT has_active_subscription;
```

---

## Best Practices

1. **ALWAYS encrypt in transit** (TLS 1.3) — no exceptions for any connection
2. **ALWAYS encrypt at rest** — use cloud KMS or volume encryption
3. **ALWAYS use column-level encryption** for highly sensitive data (SSN, credit cards)
4. **ALWAYS use key management service** (KMS/Vault) — never hardcode encryption keys
5. **ALWAYS mask data** in non-production environments — no real PII in dev/staging
6. **ALWAYS implement data retention policies** — comply with GDPR right to erasure
7. **ALWAYS audit access to sensitive data** — pgAudit or equivalent
8. **NEVER store encryption keys** alongside encrypted data — defeats the purpose
9. **NEVER log sensitive data** in query logs — mask parameters in logging
10. **NEVER use outdated TLS** (TLS 1.0/1.1) — minimum TLS 1.2, prefer 1.3

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No TLS for database connections | Data visible in network sniffing | Enable TLS, use hostssl in pg_hba.conf |
| No encryption at rest | Stolen disk/backup exposes all data | Enable KMS encryption or volume encryption |
| Encryption key in source code | Key exposed in git, logs | Use KMS/Vault for key management |
| Real PII in development | Dev database breach exposes customer data | Mask/anonymize dev data |
| No data retention policy | Data kept forever, compliance violation | Define retention periods, automate deletion |
| Encrypting with pgcrypto + key in SQL | Key visible in pg_stat_statements | Encrypt in application, not in SQL |
| No audit trail for sensitive data | Cannot prove compliance to auditors | Enable pgAudit, log access to sensitive tables |
| TLS 1.0/1.1 still enabled | Vulnerable to known attacks | Set ssl_min_protocol_version = TLSv1.3 |
| Same encryption key for all data | Compromise of one key = all data exposed | Per-entity or per-table keys |

---

## Real-world Examples

### Stripe (PCI-DSS)
- Tokenization: replace card numbers with tokens
- Encryption at every layer (transit, rest, column)
- Separate network segments for cardholder data

### Slack (SOC 2)
- Enterprise key management (EKM) for customer control
- Customers can revoke encryption keys to deny Slack access
- Audit logs for all data access

### GitHub (GDPR)
- Data export tool for right to access
- Account deletion with data purge
- Minimal data collection policy

---

## Enforcement Checklist

- [ ] TLS 1.3 enabled for all database connections
- [ ] hostssl enforced in pg_hba.conf (no plaintext connections)
- [ ] Encryption at rest enabled (KMS/volume encryption)
- [ ] Column-level encryption for highly sensitive fields (SSN, CC)
- [ ] Key management via KMS/Vault (not hardcoded)
- [ ] Data masking in non-production environments
- [ ] Audit logging for sensitive data access (pgAudit)
- [ ] Data retention policy defined and automated
- [ ] Right to deletion procedure implemented
- [ ] Compliance requirements mapped to database controls
- [ ] Encryption keys rotated on schedule
- [ ] Query logs do not contain sensitive parameter values
