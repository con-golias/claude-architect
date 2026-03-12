# PII Handling

## Comprehensive Guide to Identifying, Protecting, and Managing Personal Data

Category: Data Security
Scope: PII identification, anonymization, pseudonymization, masking, tokenization, compliance
Last Updated: 2025-12-01
Status: Living Document

---

## Table of Contents

1. PII Identification and Classification
2. Data Minimization
3. Anonymization Techniques
4. Pseudonymization
5. Data Masking
6. Tokenization
7. Right to Erasure and Deletion
8. Data Retention Policies
9. PII in Logs, Errors, and Analytics
10. PII Inventory and Data Mapping
11. Consent Management
12. Cross-Border Data Transfer
13. Code Examples
14. Best Practices
15. Anti-Patterns
16. Enforcement Checklist

---

## 1. PII Identification and Classification

### What is PII

Personally Identifiable Information (PII) is any data that can identify a specific
individual, either on its own (direct identifiers) or in combination with other
data (quasi-identifiers).

### Direct Identifiers

Direct identifiers can uniquely identify an individual without additional context:

```
+--------------------------------------------------------------+
| Category         | Examples                                  |
|--------------------------------------------------------------+
| Government IDs   | SSN, passport number, driver's license    |
| Names            | Full name, maiden name                    |
| Contact info     | Email address, phone number, home address |
| Financial        | Credit card number, bank account number   |
| Biometric        | Fingerprints, facial scans, voice prints  |
| Digital          | IP address, device ID, cookie ID          |
| Medical          | Medical record number, health plan ID     |
| Account          | Username, user ID (in some contexts)      |
+--------------------------------------------------------------+
```

### Quasi-Identifiers

Quasi-identifiers cannot identify an individual alone but can when combined:

```
+--------------------------------------------------------------+
| Quasi-Identifier  | Re-identification Risk                   |
|--------------------------------------------------------------+
| Date of birth     | Combined with gender + zip code = 87%    |
| Gender            | identity re-identification rate           |
| Zip code          | (Latanya Sweeney, 2000)                  |
| Occupation        | Can narrow population significantly      |
| Education level   | Can narrow population significantly      |
| Marital status    | Additional correlation factor            |
| Race/ethnicity    | Additional correlation factor            |
+--------------------------------------------------------------+
```

### Sensitive PII vs Non-Sensitive PII

**Sensitive PII** (requires enhanced protection):
- Social Security Numbers
- Financial account numbers
- Health/medical information
- Biometric data
- Criminal history
- Sexual orientation
- Religious beliefs
- Racial/ethnic origin
- Political opinions
- Genetic data

**Non-Sensitive PII** (still requires protection but lower sensitivity):
- Full name
- Email address
- Phone number
- Mailing address
- Date of birth
- Place of birth

### PII Classification Framework

```typescript
enum PIICategory {
  DIRECT_IDENTIFIER = 'direct_identifier',
  QUASI_IDENTIFIER = 'quasi_identifier',
  SENSITIVE = 'sensitive',
  NON_SENSITIVE = 'non_sensitive'
}

enum ProtectionLevel {
  CRITICAL = 'critical',     // Encrypt, tokenize, strict access control
  HIGH = 'high',             // Encrypt, access control
  MEDIUM = 'medium',         // Access control, masking
  LOW = 'low'                // Basic access control
}

interface PIIField {
  fieldName: string;
  category: PIICategory;
  protectionLevel: ProtectionLevel;
  requiresEncryption: boolean;
  requiresAuditLog: boolean;
  retentionPeriod: string;
  legalBasis: string;
}

const piiRegistry: PIIField[] = [
  {
    fieldName: 'ssn',
    category: PIICategory.DIRECT_IDENTIFIER,
    protectionLevel: ProtectionLevel.CRITICAL,
    requiresEncryption: true,
    requiresAuditLog: true,
    retentionPeriod: 'employment_duration + 7_years',
    legalBasis: 'legal_obligation'
  },
  {
    fieldName: 'email',
    category: PIICategory.DIRECT_IDENTIFIER,
    protectionLevel: ProtectionLevel.HIGH,
    requiresEncryption: true,
    requiresAuditLog: true,
    retentionPeriod: 'account_active + 30_days',
    legalBasis: 'contract_performance'
  },
  {
    fieldName: 'date_of_birth',
    category: PIICategory.QUASI_IDENTIFIER,
    protectionLevel: ProtectionLevel.MEDIUM,
    requiresEncryption: false,
    requiresAuditLog: false,
    retentionPeriod: 'account_active',
    legalBasis: 'consent'
  }
];
```

---

## 2. Data Minimization

### Principles

Data minimization requires collecting, processing, and retaining only the minimum
amount of personal data necessary for a specific, stated purpose.

**GDPR Article 5(1)(c)**: Personal data shall be adequate, relevant and limited to
what is necessary in relation to the purposes for which they are processed.

### Collection Minimization

```typescript
// BAD: Collecting unnecessary data
interface UserRegistration_Bad {
  fullName: string;
  email: string;
  password: string;
  dateOfBirth: string;      // Not needed for account creation
  gender: string;           // Not needed for account creation
  phoneNumber: string;      // Not needed if not using SMS verification
  homeAddress: string;      // Not needed unless shipping physical goods
  socialSecurityNumber: string;  // NEVER needed for general registration
  maritalStatus: string;    // Not needed for most applications
}

// GOOD: Collecting only what is needed
interface UserRegistration_Good {
  email: string;           // Needed: account identifier
  password: string;        // Needed: authentication
  displayName: string;     // Needed: personalization (can be pseudonym)
  // All other fields collected only when needed for specific features
}
```

### Processing Minimization

```python
class UserService:
    """Demonstrate processing minimization."""

    def get_user_for_display(self, user_id: str) -> dict:
        """Return only the fields needed for display."""
        user = self.db.get_user(user_id)

        # Return only what the UI needs -- not the entire record
        return {
            "display_name": user["display_name"],
            "avatar_url": user["avatar_url"],
            "member_since": user["created_at"].year
        }
        # NOT: return user  (which includes email, phone, address, etc.)

    def get_user_for_billing(self, user_id: str) -> dict:
        """Return only billing-relevant fields."""
        user = self.db.get_user(user_id)

        return {
            "billing_email": user["email"],
            "plan": user["subscription_plan"],
            "payment_method_last4": user["payment_last4"]
        }
```

### Retention Minimization

```sql
-- Automatically delete expired user data
CREATE OR REPLACE FUNCTION delete_expired_pii()
RETURNS void AS $$
BEGIN
  -- Delete unverified accounts after 7 days
  DELETE FROM users
  WHERE email_verified = false
    AND created_at < NOW() - INTERVAL '7 days';

  -- Anonymize closed accounts after 30 days
  UPDATE users SET
    email = 'deleted-' || id || '@deleted.local',
    full_name = 'Deleted User',
    phone_number = NULL,
    address = NULL,
    date_of_birth = NULL,
    deleted_at = NOW()
  WHERE account_closed_at < NOW() - INTERVAL '30 days'
    AND deleted_at IS NULL;

  -- Delete inactive session data after 90 days
  DELETE FROM user_sessions
  WHERE last_active < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup
-- Use pg_cron or application-level scheduler
```

---

## 3. Anonymization Techniques

### k-Anonymity

k-anonymity ensures that each record is indistinguishable from at least k-1 other
records with respect to quasi-identifiers. An attacker cannot narrow down an individual
to fewer than k records.

```python
import pandas as pd


def generalize_age(age: int, interval: int = 5) -> str:
    """Generalize age into ranges for k-anonymity."""
    lower = (age // interval) * interval
    upper = lower + interval - 1
    return f"{lower}-{upper}"


def generalize_zipcode(zipcode: str, digits_to_keep: int = 3) -> str:
    """Generalize zip code by removing trailing digits."""
    return zipcode[:digits_to_keep] + "*" * (len(zipcode) - digits_to_keep)


def apply_k_anonymity(
    df: pd.DataFrame,
    quasi_identifiers: list[str],
    k: int = 5
) -> pd.DataFrame:
    """Apply k-anonymity generalization."""
    result = df.copy()

    # Generalize quasi-identifiers
    if 'age' in quasi_identifiers:
        result['age'] = result['age'].apply(lambda x: generalize_age(x, 10))
    if 'zipcode' in quasi_identifiers:
        result['zipcode'] = result['zipcode'].apply(
            lambda x: generalize_zipcode(x, 3)
        )
    if 'date_of_birth' in quasi_identifiers:
        result['date_of_birth'] = result['date_of_birth'].apply(
            lambda x: str(x.year)  # Keep only year
        )

    # Verify k-anonymity
    groups = result.groupby(quasi_identifiers).size()
    violations = groups[groups < k]

    if len(violations) > 0:
        # Further generalize or suppress violating groups
        for group_key in violations.index:
            mask = True
            for col, val in zip(quasi_identifiers, group_key):
                mask = mask & (result[col] == val)
            result = result[~mask]  # Suppress small groups

    return result


# Example usage
data = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
    'age': [25, 27, 32, 34, 28],
    'zipcode': ['10001', '10002', '10001', '10003', '10002'],
    'disease': ['Flu', 'Cold', 'Diabetes', 'Flu', 'Cold']
})

# Remove direct identifiers, then apply k-anonymity to quasi-identifiers
anonymized = data.drop(columns=['name'])
anonymized = apply_k_anonymity(
    anonymized,
    quasi_identifiers=['age', 'zipcode'],
    k=2
)
```

### l-Diversity

l-diversity extends k-anonymity by requiring that each equivalence class has at
least l distinct values for the sensitive attribute. This prevents attribute disclosure
attacks where all records in a k-anonymous group share the same sensitive value.

```python
def check_l_diversity(
    df: pd.DataFrame,
    quasi_identifiers: list[str],
    sensitive_column: str,
    l: int
) -> bool:
    """Check if dataset satisfies l-diversity."""
    groups = df.groupby(quasi_identifiers)[sensitive_column].nunique()
    return all(groups >= l)
```

### t-Closeness

t-closeness requires that the distribution of the sensitive attribute within each
equivalence class is close to the distribution in the overall dataset. The distance
between distributions must be at most t.

### Differential Privacy

Differential privacy adds calibrated noise to query results so that the output is
approximately the same whether any individual's data is included or not.

```python
import numpy as np


class DifferentialPrivacy:
    """Apply differential privacy to aggregate queries."""

    def __init__(self, epsilon: float = 1.0):
        """
        Initialize with privacy budget epsilon.
        Lower epsilon = more privacy, more noise.
        """
        self.epsilon = epsilon

    def count_with_noise(self, true_count: int) -> int:
        """Add Laplace noise to a count query."""
        sensitivity = 1  # Adding/removing one record changes count by 1
        noise = np.random.laplace(0, sensitivity / self.epsilon)
        return max(0, int(round(true_count + noise)))

    def average_with_noise(
        self, values: list[float], bounds: tuple[float, float]
    ) -> float:
        """Add noise to an average query."""
        lower, upper = bounds
        # Clip values to bounds
        clipped = [max(lower, min(upper, v)) for v in values]
        true_avg = sum(clipped) / len(clipped)

        sensitivity = (upper - lower) / len(clipped)
        noise = np.random.laplace(0, sensitivity / self.epsilon)
        return true_avg + noise

    def histogram_with_noise(
        self, histogram: dict[str, int]
    ) -> dict[str, int]:
        """Add noise to each bin of a histogram."""
        noisy = {}
        sensitivity = 1

        for key, count in histogram.items():
            noise = np.random.laplace(0, sensitivity / self.epsilon)
            noisy[key] = max(0, int(round(count + noise)))

        return noisy


# Usage
dp = DifferentialPrivacy(epsilon=0.5)

# True count: 1000 users with disease X
noisy_count = dp.count_with_noise(1000)
# Result: approximately 1000, but exact value protected

# True average salary
noisy_avg = dp.average_with_noise(
    [50000, 60000, 75000, 80000],
    bounds=(0, 200000)
)
```

---

## 4. Pseudonymization

### Definition

Pseudonymization replaces direct identifiers with artificial identifiers (pseudonyms)
while maintaining a separate, secured mapping between pseudonyms and original values.
The data remains processable but cannot identify individuals without the mapping.

**GDPR Article 4(5)**: Pseudonymization means processing personal data in such a
manner that the data can no longer be attributed to a specific data subject without
the use of additional information.

### Implementation

```typescript
import { createHmac, randomUUID } from 'crypto';

class PseudonymizationService {
  private mappingStore: Map<string, string>; // In production: secure database
  private reverseMappingStore: Map<string, string>;
  private hmacKey: Buffer;

  constructor(hmacKey: Buffer) {
    this.mappingStore = new Map();
    this.reverseMappingStore = new Map();
    this.hmacKey = hmacKey;
  }

  // Consistent pseudonym for the same input (allows linking records)
  pseudonymize(identifier: string): string {
    // Check if already pseudonymized
    const existing = this.mappingStore.get(identifier);
    if (existing) return existing;

    // Generate deterministic pseudonym using HMAC
    const pseudonym = createHmac('sha256', this.hmacKey)
      .update(identifier)
      .digest('hex')
      .substring(0, 16);

    // Store bidirectional mapping
    this.mappingStore.set(identifier, pseudonym);
    this.reverseMappingStore.set(pseudonym, identifier);

    return pseudonym;
  }

  // Random pseudonym (no linking between records)
  pseudonymizeRandom(identifier: string): string {
    const pseudonym = randomUUID();

    this.mappingStore.set(identifier, pseudonym);
    this.reverseMappingStore.set(pseudonym, identifier);

    return pseudonym;
  }

  // Re-identify (requires access to mapping)
  reIdentify(pseudonym: string): string | null {
    return this.reverseMappingStore.get(pseudonym) ?? null;
  }

  // Delete mapping (makes pseudonymization irreversible)
  deleteMappings(identifiers: string[]): void {
    for (const identifier of identifiers) {
      const pseudonym = this.mappingStore.get(identifier);
      if (pseudonym) {
        this.reverseMappingStore.delete(pseudonym);
      }
      this.mappingStore.delete(identifier);
    }
  }
}

// Usage
const key = Buffer.from('pseudonymization-key-here-32byte', 'utf8');
const service = new PseudonymizationService(key);

// Pseudonymize user data
const pseudoEmail = service.pseudonymize('john@example.com');
// Result: "a1b2c3d4e5f6g7h8" (consistent for same input)

// Pseudonymize for research dataset
const pseudoId = service.pseudonymizeRandom('john@example.com');
// Result: "550e8400-e29b-41d4-a716-446655440000" (random UUID)
```

---

## 5. Data Masking

### Static Data Masking (Test Environments)

Replace PII with realistic but fake data for non-production environments.

```python
import hashlib
from faker import Faker


class StaticDataMasker:
    """Mask PII data for non-production environments."""

    def __init__(self, seed: int = 42):
        self.fake = Faker()
        Faker.seed(seed)

    def mask_name(self, original: str) -> str:
        """Replace with realistic fake name."""
        return self.fake.name()

    def mask_email(self, original: str) -> str:
        """Replace with fake email preserving domain format."""
        domain = original.split('@')[-1] if '@' in original else 'example.com'
        username = self.fake.user_name()
        return f"{username}@{domain}"

    def mask_phone(self, original: str) -> str:
        """Replace with fake phone number."""
        return self.fake.phone_number()

    def mask_ssn(self, original: str) -> str:
        """Replace with fake SSN."""
        return self.fake.ssn()

    def mask_address(self, original: str) -> str:
        """Replace with fake address."""
        return self.fake.address()

    def mask_credit_card(self, original: str) -> str:
        """Replace with fake credit card number."""
        return self.fake.credit_card_number()

    def mask_date_of_birth(self, original) -> str:
        """Shift date by random amount."""
        return self.fake.date_of_birth(
            minimum_age=18, maximum_age=90
        ).isoformat()

    def mask_record(self, record: dict, rules: dict) -> dict:
        """Apply masking rules to a record."""
        masked = record.copy()
        for field, mask_type in rules.items():
            if field in masked and masked[field] is not None:
                masker = getattr(self, f'mask_{mask_type}', None)
                if masker:
                    masked[field] = masker(masked[field])
        return masked


# Usage
masker = StaticDataMasker()
rules = {
    'full_name': 'name',
    'email': 'email',
    'phone': 'phone',
    'ssn': 'ssn',
    'address': 'address'
}

original = {
    'id': 123,
    'full_name': 'John Smith',
    'email': 'john@company.com',
    'phone': '555-123-4567',
    'ssn': '123-45-6789',
    'address': '123 Main St, Springfield, IL 62701'
}

masked = masker.mask_record(original, rules)
# Result: id stays the same, all PII fields replaced with fake data
```

### Dynamic Data Masking (Production Access Control)

Apply masking at query time based on user role.

```sql
-- PostgreSQL: Dynamic masking with views and row-level security
CREATE OR REPLACE VIEW users_masked AS
SELECT
  id,
  CASE
    WHEN current_setting('app.user_role', true) = 'admin'
    THEN full_name
    ELSE regexp_replace(full_name, '(.).*( .)', '\1***\2***')
  END AS full_name,
  CASE
    WHEN current_setting('app.user_role', true) = 'admin'
    THEN email
    ELSE regexp_replace(email, '(.).*(@.*)', '\1***\2')
  END AS email,
  CASE
    WHEN current_setting('app.user_role', true) IN ('admin', 'support')
    THEN phone_number
    ELSE '***-***-' || right(phone_number, 4)
  END AS phone_number,
  CASE
    WHEN current_setting('app.user_role', true) = 'admin'
    THEN ssn
    ELSE '***-**-' || right(ssn, 4)
  END AS ssn,
  created_at,
  updated_at
FROM users;

-- Set role before querying
SET app.user_role = 'support';
SELECT * FROM users_masked WHERE id = 1;
-- Result: full_name = "J*** S***", email = "j***@example.com",
--         phone = "***-***-4567", ssn = "***-**-6789"
```

### Format-Preserving Encryption

```typescript
// Format-preserving encryption maintains the format of the original data
// Useful when downstream systems require a specific format (e.g., SSN format)

import { createCipheriv, createHash } from 'crypto';

function formatPreservingEncrypt(
  plaintext: string,
  key: Buffer,
  format: string // 'ssn', 'phone', 'creditcard'
): string {
  // Generate deterministic encryption based on input
  const hash = createHash('sha256')
    .update(key)
    .update(plaintext)
    .digest();

  switch (format) {
    case 'ssn':
      // Input: 123-45-6789, Output: XXX-XX-XXXX (same format, different digits)
      const ssnDigits = Array.from(hash.subarray(0, 9))
        .map(b => (b % 10).toString())
        .join('');
      return `${ssnDigits.slice(0, 3)}-${ssnDigits.slice(3, 5)}-${ssnDigits.slice(5, 9)}`;

    case 'phone':
      // Input: 555-123-4567, Output: XXX-XXX-XXXX
      const phoneDigits = Array.from(hash.subarray(0, 10))
        .map(b => (b % 10).toString())
        .join('');
      return `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;

    case 'creditcard':
      // Input: 4111111111111111, Output: XXXXXXXXXXXXXXXX (preserving Luhn)
      const ccDigits = Array.from(hash.subarray(0, 15))
        .map(b => (b % 10).toString())
        .join('');
      const checkDigit = calculateLuhnCheckDigit(ccDigits);
      return ccDigits + checkDigit;

    default:
      throw new Error(`Unknown format: ${format}`);
  }
}
```

---

## 6. Tokenization

### Architecture

```
+--------------------------------------------------------------------+
|                                                                     |
| Application        Token Vault              Secure Storage          |
| +-----------+      +-------------+          +------------------+    |
| | Credit    | ---> | Generate    | -------> | Original: 4111.. |    |
| | Card:     |      | Token:      |          | Token: tok_abc12 |    |
| | 4111...   |      | tok_abc12   |          +------------------+    |
| +-----------+      +-------------+                                  |
|       |                   |                                         |
|       v                   v                                         |
| Store tok_abc12     Return tok_abc12                                |
| in application      (safe to store,                                 |
| database            log, transmit)                                  |
+--------------------------------------------------------------------+
```

### Tokenization Service

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

interface TokenRecord {
  token: string;
  encryptedValue: string;
  nonce: string;
  tag: string;
  createdAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, string>;
}

class TokenizationService {
  private tokenStore: Map<string, TokenRecord>; // Use secure database in production
  private encryptionKey: Buffer;

  constructor(encryptionKey: Buffer) {
    this.tokenStore = new Map();
    this.encryptionKey = encryptionKey;
  }

  tokenize(
    value: string,
    metadata: Record<string, string> = {},
    ttlMs?: number
  ): string {
    // Generate random token
    const token = `tok_${randomBytes(16).toString('hex')}`;

    // Encrypt the original value
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    // Store token mapping
    const record: TokenRecord = {
      token,
      encryptedValue: encrypted.toString('base64'),
      nonce: nonce.toString('base64'),
      tag: tag.toString('base64'),
      createdAt: new Date(),
      expiresAt: ttlMs ? new Date(Date.now() + ttlMs) : null,
      metadata
    };

    this.tokenStore.set(token, record);

    return token;
  }

  detokenize(token: string): string {
    const record = this.tokenStore.get(token);
    if (!record) {
      throw new Error('Token not found');
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      this.tokenStore.delete(token);
      throw new Error('Token expired');
    }

    // Decrypt the original value
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(record.nonce, 'base64')
    );
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.encryptedValue, 'base64')),
      decipher.final()
    ]);

    return plaintext.toString('utf8');
  }

  deleteToken(token: string): boolean {
    return this.tokenStore.delete(token);
  }

  // Delete all tokens for a specific entity (for right to erasure)
  deleteByMetadata(key: string, value: string): number {
    let count = 0;
    for (const [token, record] of this.tokenStore.entries()) {
      if (record.metadata[key] === value) {
        this.tokenStore.delete(token);
        count++;
      }
    }
    return count;
  }
}

// Usage
const key = randomBytes(32);
const tokenizer = new TokenizationService(key);

// Tokenize credit card
const token = tokenizer.tokenize(
  '4111111111111111',
  { userId: 'user-123', type: 'credit_card' },
  86400000 // 24-hour TTL
);
// Result: "tok_a1b2c3d4e5f6g7h8..."

// Store only the token in your database
// Original value is in the secure token vault

// Detokenize when needed (e.g., for payment processing)
const original = tokenizer.detokenize(token);
// Result: "4111111111111111"
```

---

## 7. Right to Erasure and Deletion

### GDPR Article 17 (Right to Erasure)

Data subjects have the right to request deletion of their personal data when:
- Data is no longer necessary for the purpose it was collected
- Consent is withdrawn and no other legal basis exists
- Data subject objects to processing
- Data was unlawfully processed
- Legal obligation requires erasure

### CCPA Right to Delete

California residents can request deletion of personal information collected about them.

### Implementation

```typescript
class DataErasureService {
  constructor(
    private db: Database,
    private searchIndex: SearchService,
    private analytics: AnalyticsService,
    private backupService: BackupService,
    private auditLog: AuditLogService,
    private tokenizer: TokenizationService
  ) {}

  async eraseUserData(userId: string, requestId: string): Promise<ErasureReport> {
    const report: ErasureReport = {
      requestId,
      userId,
      startedAt: new Date(),
      systems: []
    };

    try {
      // Step 1: Delete from primary database
      await this.eraseFromDatabase(userId);
      report.systems.push({ system: 'primary_db', status: 'completed' });

      // Step 2: Delete from search indexes
      await this.searchIndex.deleteUser(userId);
      report.systems.push({ system: 'search_index', status: 'completed' });

      // Step 3: Delete from analytics
      await this.analytics.deleteUserData(userId);
      report.systems.push({ system: 'analytics', status: 'completed' });

      // Step 4: Delete tokens
      const deletedTokens = this.tokenizer.deleteByMetadata('userId', userId);
      report.systems.push({
        system: 'token_vault',
        status: 'completed',
        details: `${deletedTokens} tokens deleted`
      });

      // Step 5: Queue backup purge (async, may take days)
      await this.backupService.queuePurge(userId);
      report.systems.push({ system: 'backups', status: 'queued' });

      // Step 6: Log the erasure (without PII)
      await this.auditLog.log({
        action: 'DATA_ERASURE',
        requestId,
        userId: `[erased-${requestId}]`, // Do not log the actual userId
        timestamp: new Date(),
        systems: report.systems
      });

      report.completedAt = new Date();
      report.status = 'completed';

    } catch (error) {
      report.status = 'partial_failure';
      report.error = error.message;
      // Alert data protection officer for manual follow-up
      await this.alertDPO(report);
    }

    return report;
  }

  private async eraseFromDatabase(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Delete user's content
      await tx.query('DELETE FROM user_posts WHERE user_id = $1', [userId]);
      await tx.query('DELETE FROM user_comments WHERE user_id = $1', [userId]);
      await tx.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
      await tx.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

      // Anonymize data that must be retained for legal reasons
      await tx.query(`
        UPDATE orders SET
          customer_name = 'Deleted User',
          customer_email = NULL,
          shipping_address = NULL
        WHERE customer_id = $1
      `, [userId]);

      // Delete the user record
      await tx.query('DELETE FROM users WHERE id = $1', [userId]);
    });
  }
}
```

### Crypto-Shredding

Delete data by destroying its encryption key, making the ciphertext permanently
unreadable without re-encrypting or individually deleting records.

```typescript
class CryptoShredding {
  // Each user has their own DEK
  // Delete the user's DEK to make all their data permanently unreadable

  async shredUserData(userId: string): Promise<void> {
    // Destroy the user's encryption key in KMS
    await this.kms.send(new ScheduleKeyDeletionCommand({
      KeyId: `alias/user-${userId}-dek`,
      PendingWindowInDays: 7 // Minimum waiting period
    }));

    // The user's encrypted data in the database is now permanently unreadable
    // No need to find and delete every record individually
  }
}
```

---

## 8. Data Retention Policies

### Retention Schedule

```
+-----------------------------------------------------------------------+
| Data Type               | Active Period    | Archive    | Destruction  |
|-----------------------------------------------------------------------+
| User account data       | Account active   | 30 days    | Delete       |
| Transaction records     | Current FY       | 7 years    | Delete       |
| Access logs             | 90 days          | 1 year     | Delete       |
| Session data            | Session active   | None       | Immediate    |
| Marketing consent       | Consent active   | 3 years    | Delete       |
| Support tickets         | 1 year           | 3 years    | Anonymize    |
| Employment records      | Employment       | 7 years    | Delete       |
| Health records (HIPAA)  | Treatment active | 6 years    | Delete       |
| Financial records (SOX) | Current FY       | 7 years    | Delete       |
+-----------------------------------------------------------------------+
```

### Automated Retention Enforcement

```python
from datetime import datetime, timedelta
from enum import Enum


class RetentionAction(Enum):
    DELETE = "delete"
    ANONYMIZE = "anonymize"
    ARCHIVE = "archive"


class RetentionPolicy:
    def __init__(self, data_type: str, retention_days: int, action: RetentionAction):
        self.data_type = data_type
        self.retention_days = retention_days
        self.action = action


class RetentionEnforcer:
    """Automated data retention enforcement."""

    def __init__(self, db, policies: list[RetentionPolicy]):
        self.db = db
        self.policies = policies

    async def enforce_all(self):
        """Run all retention policies."""
        for policy in self.policies:
            cutoff = datetime.utcnow() - timedelta(days=policy.retention_days)

            if policy.action == RetentionAction.DELETE:
                await self.delete_expired(policy.data_type, cutoff)
            elif policy.action == RetentionAction.ANONYMIZE:
                await self.anonymize_expired(policy.data_type, cutoff)
            elif policy.action == RetentionAction.ARCHIVE:
                await self.archive_expired(policy.data_type, cutoff)

    async def delete_expired(self, data_type: str, cutoff: datetime):
        """Delete records older than cutoff."""
        result = await self.db.execute(
            f"DELETE FROM {data_type} WHERE created_at < $1 RETURNING id",
            cutoff
        )
        print(f"Deleted {result.rowcount} records from {data_type}")

    async def anonymize_expired(self, data_type: str, cutoff: datetime):
        """Anonymize PII in records older than cutoff."""
        await self.db.execute(f"""
            UPDATE {data_type} SET
                email = 'anonymized-' || id || '@deleted.local',
                full_name = 'Anonymized User',
                phone = NULL,
                address = NULL,
                anonymized_at = NOW()
            WHERE created_at < $1 AND anonymized_at IS NULL
        """, cutoff)


# Define policies
policies = [
    RetentionPolicy("user_sessions", 90, RetentionAction.DELETE),
    RetentionPolicy("access_logs", 365, RetentionAction.DELETE),
    RetentionPolicy("support_tickets", 1095, RetentionAction.ANONYMIZE),
    RetentionPolicy("marketing_events", 1095, RetentionAction.DELETE),
]

enforcer = RetentionEnforcer(db, policies)
# Run daily via cron/scheduler
await enforcer.enforce_all()
```

---

## 9. PII in Logs, Errors, and Analytics

### NEVER Log PII

PII in logs creates a secondary, often unprotected copy of sensitive data.

```typescript
// BAD: Logging PII
logger.info(`User login: email=${user.email}, ip=${request.ip}`);
logger.error(`Payment failed for card ${cardNumber}`);
logger.debug(`User data: ${JSON.stringify(user)}`);

// GOOD: Log without PII
logger.info(`User login: userId=${user.id}, ip=${request.ip}`);
logger.error(`Payment failed: userId=${user.id}, last4=${last4}`);
logger.debug(`User action: userId=${user.id}, action=profile_update`);
```

### PII Scrubbing Middleware

```typescript
class PIIScrubber {
  private patterns: Array<{ regex: RegExp; replacement: string }> = [
    {
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '[EMAIL_REDACTED]'
    },
    {
      regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      replacement: '[SSN_REDACTED]'
    },
    {
      regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      replacement: '[CC_REDACTED]'
    },
    {
      regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      replacement: '[PHONE_REDACTED]'
    },
    {
      regex: /"(password|secret|token|api_key|apiKey|authorization)"\s*:\s*"[^"]*"/gi,
      replacement: '"$1":"[REDACTED]"'
    }
  ];

  scrub(text: string): string {
    let result = text;
    for (const { regex, replacement } of this.patterns) {
      result = result.replace(regex, replacement);
    }
    return result;
  }
}

// Apply to logging framework
const scrubber = new PIIScrubber();

const originalLog = console.log;
console.log = (...args: any[]) => {
  const scrubbed = args.map(arg =>
    typeof arg === 'string' ? scrubber.scrub(arg) : arg
  );
  originalLog(...scrubbed);
};
```

### PII-Safe Error Handling

```python
class PIISafeError(Exception):
    """Error class that prevents PII from appearing in stack traces."""

    def __init__(self, message: str, user_id: str = None, **context):
        # Store safe context only
        self.user_id = user_id
        self.safe_context = {
            k: v for k, v in context.items()
            if k not in ('email', 'ssn', 'phone', 'address', 'name', 'password')
        }
        super().__init__(message)

    def __str__(self):
        ctx = f" context={self.safe_context}" if self.safe_context else ""
        uid = f" user_id={self.user_id}" if self.user_id else ""
        return f"{self.args[0]}{uid}{ctx}"


# Usage
try:
    process_payment(user)
except PaymentError as e:
    raise PIISafeError(
        "Payment processing failed",
        user_id=user.id,
        error_code=e.code,
        # Do NOT pass: email=user.email, card=user.card_number
    ) from e
```

### Analytics Without PII

```typescript
// Collect analytics without PII
interface AnalyticsEvent {
  eventType: string;
  timestamp: Date;
  // Use anonymized identifiers
  anonymousId: string;  // Generated per-session, not linked to user
  // Aggregate demographic data only
  ageRange?: string;    // "25-34" not exact age
  region?: string;      // "US-CA" not zip code
  // Behavioral data
  action: string;
  category: string;
  value?: number;
  // NEVER include: email, name, phone, address, IP
}
```

---

## 10. PII Inventory and Data Mapping

### Data Flow Mapping

```
+---------------------------------------------------------------------+
|  System              | PII Fields           | Purpose       | Basis |
|---------------------------------------------------------------------+
|  User DB (RDS)       | name, email, phone   | Account mgmt | Contr |
|  Payment (Stripe)    | card, billing addr   | Payments      | Contr |
|  Analytics (Mixpanel)| anonymousId only     | Product       | Legit |
|  Support (Zendesk)   | name, email          | Support       | Contr |
|  Logs (CloudWatch)   | NONE (scrubbed)      | Operations    | Legit |
|  Backups (S3)        | All (encrypted)      | Recovery      | Legit |
|  Email (SendGrid)    | email, name          | Communication | Consen|
+---------------------------------------------------------------------+
```

### Automated PII Discovery

```python
import re
from typing import Generator


class PIIScanner:
    """Scan databases and files for PII presence."""

    PII_PATTERNS = {
        'email': re.compile(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        ),
        'ssn': re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
        'phone_us': re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'),
        'credit_card': re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
        'ip_address': re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),
    }

    PII_COLUMN_NAMES = [
        'email', 'mail', 'phone', 'telephone', 'mobile',
        'ssn', 'social_security', 'tax_id', 'passport',
        'first_name', 'last_name', 'full_name', 'name',
        'address', 'street', 'city', 'zip', 'postal',
        'birth', 'dob', 'date_of_birth',
        'credit_card', 'card_number', 'cvv', 'expiry',
        'password', 'secret', 'token'
    ]

    def scan_database_schema(self, db) -> list[dict]:
        """Scan database schema for PII column names."""
        findings = []

        tables = db.execute(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema = 'public'"
        )

        for table_name, column_name in tables:
            for pii_name in self.PII_COLUMN_NAMES:
                if pii_name in column_name.lower():
                    findings.append({
                        'table': table_name,
                        'column': column_name,
                        'matched_pattern': pii_name,
                        'risk': 'high'
                    })

        return findings

    def scan_text(self, text: str) -> list[dict]:
        """Scan text for PII patterns."""
        findings = []

        for pii_type, pattern in self.PII_PATTERNS.items():
            matches = pattern.findall(text)
            if matches:
                findings.append({
                    'type': pii_type,
                    'count': len(matches),
                    'samples': [m[:4] + '...' for m in matches[:3]]
                })

        return findings
```

---

## 11. Consent Management

### Consent Record Structure

```typescript
interface ConsentRecord {
  userId: string;
  consentType: string;        // 'marketing', 'analytics', 'data_sharing'
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  source: string;             // 'web_form', 'api', 'mobile_app'
  version: string;            // Version of privacy policy at time of consent
  ipAddress: string;          // For audit purposes
  purpose: string;            // Specific purpose described to user
  legalBasis: string;         // 'consent', 'legitimate_interest', 'contract'
}

class ConsentManager {
  async grantConsent(
    userId: string,
    consentType: string,
    metadata: Partial<ConsentRecord>
  ): Promise<void> {
    await this.db.query(`
      INSERT INTO consent_records
        (user_id, consent_type, granted, granted_at, source, version, purpose)
      VALUES ($1, $2, true, NOW(), $3, $4, $5)
      ON CONFLICT (user_id, consent_type)
      DO UPDATE SET
        granted = true,
        granted_at = NOW(),
        revoked_at = NULL,
        source = $3,
        version = $4
    `, [userId, consentType, metadata.source, metadata.version, metadata.purpose]);
  }

  async revokeConsent(userId: string, consentType: string): Promise<void> {
    await this.db.query(`
      UPDATE consent_records
      SET granted = false, revoked_at = NOW()
      WHERE user_id = $1 AND consent_type = $2
    `, [userId, consentType]);

    // Trigger data processing stop for this consent type
    await this.stopProcessing(userId, consentType);
  }

  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const result = await this.db.query(`
      SELECT granted FROM consent_records
      WHERE user_id = $1 AND consent_type = $2
    `, [userId, consentType]);

    return result.rows.length > 0 && result.rows[0].granted;
  }

  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    const result = await this.db.query(`
      SELECT * FROM consent_records WHERE user_id = $1
    `, [userId]);

    return result.rows;
  }
}
```

---

## 12. Cross-Border Data Transfer

### GDPR Adequacy Decisions

Countries with GDPR adequacy decisions (data can flow freely):
Andorra, Argentina, Canada, Faroe Islands, Guernsey, Israel, Isle of Man, Japan,
Jersey, New Zealand, Republic of Korea, Switzerland, United Kingdom, Uruguay,
and the EU-US Data Privacy Framework.

### Standard Contractual Clauses (SCCs)

For transfers to countries without adequacy decisions, use SCCs:

```
Data Transfer Assessment:
1. Identify the data being transferred
2. Identify the destination country
3. Assess the legal framework of the destination country
4. Implement appropriate safeguards (SCCs, BCRs)
5. Document the transfer impact assessment
6. Monitor ongoing compliance
```

### Technical Measures for Cross-Border Transfers

```typescript
class DataTransferGuard {
  private allowedRegions: Map<string, Set<string>>;

  constructor() {
    this.allowedRegions = new Map([
      ['EU', new Set(['EU', 'EEA', 'ADEQUATE', 'SCC'])],
      ['US', new Set(['US', 'EU_US_DPF'])],
    ]);
  }

  canTransfer(
    dataRegion: string,
    destinationRegion: string,
    hasAdequacyDecision: boolean,
    hasSCC: boolean
  ): { allowed: boolean; mechanism: string } {
    // Same region: always allowed
    if (dataRegion === destinationRegion) {
      return { allowed: true, mechanism: 'same_region' };
    }

    // Adequacy decision
    if (hasAdequacyDecision) {
      return { allowed: true, mechanism: 'adequacy_decision' };
    }

    // Standard Contractual Clauses
    if (hasSCC) {
      return { allowed: true, mechanism: 'scc' };
    }

    return { allowed: false, mechanism: 'none' };
  }
}
```

---

## 13. Code Examples

### Go: PII Handling Service

```go
package pii

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "regexp"
    "strings"
)

// PIIClassification represents the sensitivity level of a field
type PIIClassification int

const (
    NotPII PIIClassification = iota
    QuasiIdentifier
    DirectIdentifier
    SensitivePII
)

// PIIHandler provides PII protection operations
type PIIHandler struct {
    hmacKey []byte
}

func NewPIIHandler(hmacKey []byte) *PIIHandler {
    return &PIIHandler{hmacKey: hmacKey}
}

// Pseudonymize creates a consistent pseudonym for an identifier
func (h *PIIHandler) Pseudonymize(identifier string) string {
    mac := hmac.New(sha256.New, h.hmacKey)
    mac.Write([]byte(strings.ToLower(strings.TrimSpace(identifier))))
    return hex.EncodeToString(mac.Sum(nil))[:16]
}

// MaskEmail masks an email address
func (h *PIIHandler) MaskEmail(email string) string {
    parts := strings.Split(email, "@")
    if len(parts) != 2 {
        return "[INVALID_EMAIL]"
    }

    username := parts[0]
    domain := parts[1]

    if len(username) <= 2 {
        return fmt.Sprintf("**@%s", domain)
    }
    return fmt.Sprintf("%s***@%s", username[:1], domain)
}

// MaskPhone masks a phone number showing only last 4 digits
func (h *PIIHandler) MaskPhone(phone string) string {
    digits := regexp.MustCompile(`\d`).FindAllString(phone, -1)
    if len(digits) < 4 {
        return "[REDACTED]"
    }
    return "***-***-" + strings.Join(digits[len(digits)-4:], "")
}

// MaskSSN masks an SSN showing only last 4 digits
func (h *PIIHandler) MaskSSN(ssn string) string {
    digits := regexp.MustCompile(`\d`).FindAllString(ssn, -1)
    if len(digits) < 4 {
        return "[REDACTED]"
    }
    return "***-**-" + strings.Join(digits[len(digits)-4:], "")
}

// ScrubText removes PII patterns from free text
func (h *PIIHandler) ScrubText(text string) string {
    patterns := map[string]*regexp.Regexp{
        "[EMAIL_REDACTED]": regexp.MustCompile(
            `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`),
        "[SSN_REDACTED]": regexp.MustCompile(`\d{3}-\d{2}-\d{4}`),
        "[PHONE_REDACTED]": regexp.MustCompile(`\d{3}[-.]?\d{3}[-.]?\d{4}`),
    }

    result := text
    for replacement, pattern := range patterns {
        result = pattern.ReplaceAllString(result, replacement)
    }
    return result
}
```

---

## 14. Best Practices

### 1. Classify All PII Before Processing

Create a PII inventory that maps every field containing personal data, its
classification level, protection requirements, and legal basis for processing.

### 2. Apply Data Minimization at Every Layer

Collect only the PII needed for the stated purpose. Return only the fields needed
for each API response. Delete PII when the purpose is fulfilled.

### 3. Never Log PII

Implement PII scrubbing in the logging pipeline. Use user IDs (not emails or names)
in log messages. Audit logs periodically for PII leakage.

### 4. Implement Right to Erasure Across All Systems

Build erasure capabilities into every system that stores PII. Test erasure end-to-end
including backups, caches, search indexes, and third-party systems.

### 5. Use Pseudonymization for Analytics and Testing

Replace direct identifiers with pseudonyms for analytics processing. Use static
data masking for test environments. Never use production PII in development.

### 6. Encrypt PII at Rest and in Transit

Encrypt sensitive PII fields at the application level (not just database TDE).
Use TLS for all data transmission. Implement column-level encryption for critical fields.

### 7. Automate Data Retention Enforcement

Define retention policies for all data types. Implement automated deletion or
anonymization when retention periods expire. Never rely on manual cleanup.

### 8. Implement Consent Management

Track consent granularly (per purpose, per processing activity). Support withdrawal
of consent with immediate effect. Maintain audit trail of consent changes.

### 9. Document Data Flows and Transfer Mechanisms

Map all cross-border data transfers. Implement appropriate transfer mechanisms
(adequacy decisions, SCCs, BCRs). Conduct transfer impact assessments.

### 10. Conduct Regular PII Discovery Scans

Scan databases, file systems, and logs for unexpected PII. Address findings
immediately. PII has a tendency to appear in unexpected places.

---

## 15. Anti-Patterns

### 1. Using Real PII in Test Environments

Production PII in development or staging environments lacks production security
controls. Use synthetic data generators (Faker) or static data masking.

### 2. Logging Request Bodies Containing PII

Logging entire HTTP request bodies captures form submissions with passwords,
credit cards, and personal information. Log only safe fields explicitly.

### 3. Storing PII in Unencrypted Cookies

Cookies are sent with every request and stored on the client device. Never store
PII in cookies. Use server-side sessions with opaque session IDs.

### 4. Collecting PII "Just in Case"

Collecting data beyond what is needed violates data minimization principles and
increases liability. Every field collected is a field that must be protected.

### 5. No PII in Error Responses

Returning PII in error messages (e.g., "User john@example.com not found") leaks
information. Use generic messages: "User not found."

### 6. Treating Anonymization as Irreversible Without Verification

Simple techniques like removing names may still allow re-identification through
quasi-identifiers. Verify anonymization with formal methods (k-anonymity analysis).

### 7. No Cross-System Erasure

Deleting from the primary database but not from caches, search indexes, analytics,
and backups leaves PII scattered across systems.

### 8. Sharing Full PII When Partial Would Suffice

Sending complete user records to systems that only need a subset of fields
(e.g., sending SSN to a marketing system that only needs email).

---

## 16. Enforcement Checklist

### PII Identification

- [ ] PII inventory created and maintained
- [ ] All data fields classified by PII type and sensitivity
- [ ] Data flow mapping completed for all systems
- [ ] Third-party data processors identified and documented
- [ ] Automated PII discovery scans scheduled

### Data Minimization

- [ ] Collection limited to necessary fields for stated purpose
- [ ] API responses return only required fields per endpoint
- [ ] Data retention policies defined for all data types
- [ ] Automated retention enforcement implemented
- [ ] Unnecessary PII fields removed from existing schemas

### Protection Controls

- [ ] Sensitive PII encrypted at rest (application-level)
- [ ] All PII encrypted in transit (TLS)
- [ ] Access controls restrict PII access to authorized roles
- [ ] PII access is logged and auditable
- [ ] Dynamic data masking applied for support/analytics access

### Logging and Analytics

- [ ] PII scrubbing implemented in logging pipeline
- [ ] No PII in log files (verified by periodic scan)
- [ ] No PII in error messages or stack traces
- [ ] Analytics use anonymized or pseudonymized identifiers
- [ ] No PII in client-side analytics (cookies, local storage)

### Erasure and Deletion

- [ ] Right to erasure implemented across all systems
- [ ] Erasure tested end-to-end (database, cache, search, backups)
- [ ] Crypto-shredding implemented where applicable
- [ ] Erasure audit trail maintained (without PII)
- [ ] Erasure SLA defined and met (GDPR: 30 days)

### Consent and Compliance

- [ ] Consent management system implemented
- [ ] Consent records maintained with audit trail
- [ ] Consent withdrawal triggers processing stop
- [ ] Privacy policy version tracked with consent
- [ ] Cross-border transfers documented with legal basis

### Testing

- [ ] No production PII in non-production environments
- [ ] Static data masking applied to test databases
- [ ] Synthetic data generators used for development
- [ ] PII handling tested in security reviews
- [ ] Annual privacy impact assessment conducted
