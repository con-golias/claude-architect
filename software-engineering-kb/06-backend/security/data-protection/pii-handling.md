# PII Handling & Data Classification

> **Domain:** Backend > Security > Data Protection
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Personal Identifiable Information (PII) handling is not just a legal obligation — it is an engineering challenge. Every backend system stores, processes, and transmits personal data. Incorrect handling (unmasked PII in logs, plaintext SSNs in the database, production data in dev environments) leads to data breaches, fines (GDPR: €20M or 4% of annual revenue), and loss of trust. EDPB Guidance 2024 clarified: unmasked production data in dev/test environments = violation of GDPR Article 5(1)(a).

---

## How It Works

### Data Classification Framework

```
┌──────────────────────────────────────────────────────┐
│                DATA CLASSIFICATION                    │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Level 4: RESTRICTED (Highest)                        │
│  ├── Passwords, encryption keys                       │
│  ├── Payment card data (PCI)                          │
│  ├── Social Security Numbers                          │
│  ├── Medical records (HIPAA)                          │
│  └── Biometric data                                   │
│                                                       │
│  Level 3: CONFIDENTIAL                                │
│  ├── Email addresses                                  │
│  ├── Phone numbers                                    │
│  ├── Home addresses                                   │
│  ├── Date of birth                                    │
│  ├── Government IDs                                   │
│  └── Financial data (income, bank accounts)           │
│                                                       │
│  Level 2: INTERNAL                                    │
│  ├── User IDs                                         │
│  ├── Internal employee data                           │
│  ├── Non-public business data                         │
│  └── System configurations                            │
│                                                       │
│  Level 1: PUBLIC                                      │
│  ├── Published content                                │
│  ├── Marketing materials                              │
│  └── Public API documentation                         │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### PII Types Table

| Category | Data Points | Classification | Storage Rule |
|----------|------------|----------------|--------------|
| **Direct identifiers** | Name, SSN, passport, email | Confidential/Restricted | Encrypted at rest |
| **Indirect identifiers** | DOB, ZIP code, gender, ethnicity | Confidential | Pseudonymize in analytics |
| **Sensitive PII** | Medical, biometric, religious, sexual orientation | Restricted | Encrypt + access control + audit log |
| **Financial PII** | Card numbers, bank accounts, income | Restricted (PCI) | Tokenize, never store raw |
| **Digital identifiers** | IP address, device ID, cookies | Internal (GDPR: personal data) | Anonymize after retention period |

---

## Data Masking & Anonymization

### Masking Patterns

```typescript
// TypeScript — PII Masking Utilities
class PIIMasker {
  // Email: j***@example.com
  static maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain) return "***@***";
    const masked = local[0] + "***";
    return `${masked}@${domain}`;
  }

  // Phone: +30 69*****789
  static maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) return "***";
    return phone.slice(0, 6) + "*".repeat(digits.length - 9) + phone.slice(-3);
  }

  // Name: John D.
  static maskName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0] + "***";
    return parts[0] + " " + parts.slice(1).map((p) => p[0] + ".").join(" ");
  }

  // Credit card: **** **** **** 4242
  static maskCard(card: string): string {
    const digits = card.replace(/\D/g, "");
    return "**** **** **** " + digits.slice(-4);
  }

  // SSN/Tax ID: ***-**-6789
  static maskSSN(ssn: string): string {
    const digits = ssn.replace(/\D/g, "");
    return "***-**-" + digits.slice(-4);
  }

  // IP: 192.168.xxx.xxx
  static maskIPv4(ip: string): string {
    const parts = ip.split(".");
    if (parts.length !== 4) return "xxx.xxx.xxx.xxx";
    return parts.slice(0, 2).join(".") + ".xxx.xxx";
  }

  // IBAN: GR16 **** **** **** **** **** 89
  static maskIBAN(iban: string): string {
    const clean = iban.replace(/\s/g, "");
    return clean.slice(0, 4) + " " + "**** ".repeat(5) + clean.slice(-2);
  }
}

// Apply masking to entire objects
function maskPII<T extends Record<string, any>>(
  data: T,
  rules: Record<string, (value: any) => any>
): T {
  const masked = { ...data };
  for (const [field, maskFn] of Object.entries(rules)) {
    if (field in masked && masked[field] != null) {
      masked[field] = maskFn(masked[field]);
    }
  }
  return masked;
}

// Usage
const maskedUser = maskPII(user, {
  email: PIIMasker.maskEmail,
  phone: PIIMasker.maskPhone,
  ssn: PIIMasker.maskSSN,
  name: PIIMasker.maskName,
});
```

```go
// Go — PII Masking
package pii

import (
    "regexp"
    "strings"
)

func MaskEmail(email string) string {
    parts := strings.SplitN(email, "@", 2)
    if len(parts) != 2 {
        return "***@***"
    }
    if len(parts[0]) == 0 {
        return "***@" + parts[1]
    }
    return string(parts[0][0]) + "***@" + parts[1]
}

func MaskPhone(phone string) string {
    digits := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")
    if len(digits) < 6 {
        return "***"
    }
    return phone[:6] + strings.Repeat("*", len(digits)-9) + phone[len(phone)-3:]
}

func MaskCard(card string) string {
    digits := regexp.MustCompile(`\D`).ReplaceAllString(card, "")
    if len(digits) < 4 {
        return "****"
    }
    return "**** **** **** " + digits[len(digits)-4:]
}
```

```python
# Python — PII Masking
import re

class PIIMasker:
    @staticmethod
    def mask_email(email: str) -> str:
        parts = email.split("@")
        if len(parts) != 2:
            return "***@***"
        local = parts[0]
        return f"{local[0]}***@{parts[1]}" if local else f"***@{parts[1]}"

    @staticmethod
    def mask_phone(phone: str) -> str:
        digits = re.sub(r"\D", "", phone)
        if len(digits) < 6:
            return "***"
        return phone[:6] + "*" * (len(digits) - 9) + phone[-3:]

    @staticmethod
    def mask_card(card: str) -> str:
        digits = re.sub(r"\D", "", card)
        return f"**** **** **** {digits[-4:]}" if len(digits) >= 4 else "****"

    @staticmethod
    def mask_ssn(ssn: str) -> str:
        digits = re.sub(r"\D", "", ssn)
        return f"***-**-{digits[-4:]}" if len(digits) >= 4 else "***"
```

---

## PII in Logs — Prevention

```typescript
// TypeScript — Log Sanitizer Middleware
import { pino } from "pino";

// PII fields to redact in logs
const PII_FIELDS = [
  "password", "token", "secret", "authorization",
  "cookie", "ssn", "creditCard", "cardNumber",
  "email", "phone", "address", "dateOfBirth",
  "ip", "ipAddress",
];

const logger = pino({
  redact: {
    paths: [
      // Request/response fields
      ...PII_FIELDS.map((f) => `req.headers.${f}`),
      ...PII_FIELDS.map((f) => `req.body.${f}`),
      ...PII_FIELDS.map((f) => `res.body.${f}`),
      // Nested paths
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.secret",
      "*.ssn",
      "*.creditCard",
    ],
    censor: "[REDACTED]",
  },
});

// Custom serializer for request logging
const requestSerializer = (req: any) => ({
  method: req.method,
  url: req.url,
  // Mask query params that might contain PII
  query: maskQueryParams(req.query),
  // Never log full headers
  headers: {
    "content-type": req.headers["content-type"],
    "user-agent": req.headers["user-agent"],
    // Authorization: redacted by pino
  },
});
```

```go
// Go — Structured Logger with PII Redaction
package logging

import (
    "log/slog"
    "regexp"
    "strings"
)

var piiPatterns = []*regexp.Regexp{
    regexp.MustCompile(`(?i)"email"\s*:\s*"[^"]*"`),
    regexp.MustCompile(`(?i)"password"\s*:\s*"[^"]*"`),
    regexp.MustCompile(`(?i)"ssn"\s*:\s*"[^"]*"`),
    regexp.MustCompile(`(?i)"token"\s*:\s*"[^"]*"`),
    regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`),
}

// Custom slog handler that redacts PII
type RedactingHandler struct {
    inner slog.Handler
}

func (h *RedactingHandler) Handle(ctx context.Context, r slog.Record) error {
    // Clone record and redact PII fields
    r.Attrs(func(a slog.Attr) bool {
        key := strings.ToLower(a.Key)
        if isPIIField(key) {
            a.Value = slog.StringValue("[REDACTED]")
        }
        return true
    })
    return h.inner.Handle(ctx, r)
}

func isPIIField(key string) bool {
    piiKeys := []string{
        "password", "token", "secret", "email",
        "ssn", "phone", "address", "credit_card",
    }
    for _, k := range piiKeys {
        if strings.Contains(key, k) {
            return true
        }
    }
    return false
}
```

---

## Pseudonymization & Anonymization

### Techniques

| Technique | Reversible | Use Case |
|-----------|:---------:|----------|
| **Masking** | ❌ | Display (UI, logs, support) |
| **Pseudonymization** | ✅ (with key) | Analytics, dev/test data |
| **Tokenization** | ✅ (with vault) | Payment data (PCI) |
| **k-Anonymity** | ❌ | Statistical datasets |
| **Differential Privacy** | ❌ | Aggregate analytics |
| **Data deletion** | ❌ | GDPR right to erasure |

### Pseudonymization Implementation

```typescript
// TypeScript — Pseudonymization for Dev/Test Environments
import crypto from "crypto";

class Pseudonymizer {
  private key: Buffer;

  constructor(secretKey: string) {
    // Deterministic — same input always produces same output
    // This allows JOIN operations on pseudonymized data
    this.key = Buffer.from(secretKey, "hex");
  }

  // Pseudonymize any string value
  pseudonymize(value: string, domain: string): string {
    const hmac = crypto
      .createHmac("sha256", this.key)
      .update(`${domain}:${value}`)
      .digest("hex");
    return hmac.slice(0, 16); // Shorter pseudonym
  }

  // Generate realistic fake data
  pseudonymizeEmail(email: string): string {
    const pseudo = this.pseudonymize(email, "email");
    return `user_${pseudo}@example.com`;
  }

  pseudonymizeName(name: string): string {
    const pseudo = this.pseudonymize(name, "name");
    return `User_${pseudo.slice(0, 8)}`;
  }

  pseudonymizePhone(phone: string): string {
    const pseudo = this.pseudonymize(phone, "phone");
    const digits = pseudo.replace(/\D/g, "").slice(0, 10);
    return `+1${digits}`;
  }
}

// Usage: Create dev database from production
async function createDevSnapshot(
  prodDb: Database,
  devDb: Database,
  pseudonymizer: Pseudonymizer
): Promise<void> {
  const users = await prodDb.query("SELECT * FROM users");

  for (const user of users) {
    await devDb.query(
      `INSERT INTO users (id, email, name, phone, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id, // Keep IDs for referential integrity
        pseudonymizer.pseudonymizeEmail(user.email),
        pseudonymizer.pseudonymizeName(user.name),
        pseudonymizer.pseudonymizePhone(user.phone),
        user.role, // Non-PII: keep original
        user.created_at, // Non-PII: keep original
      ]
    );
  }
}
```

---

## Data Retention & Deletion

### Retention Policy Implementation

```typescript
// TypeScript — Data Retention Manager
interface RetentionPolicy {
  table: string;
  dateColumn: string;
  retentionDays: number;
  deletionStrategy: "hard_delete" | "soft_delete" | "anonymize";
  piiColumns?: string[];
}

const policies: RetentionPolicy[] = [
  {
    table: "audit_logs",
    dateColumn: "created_at",
    retentionDays: 365, // 1 year
    deletionStrategy: "hard_delete",
  },
  {
    table: "user_sessions",
    dateColumn: "last_active_at",
    retentionDays: 90,
    deletionStrategy: "hard_delete",
  },
  {
    table: "orders",
    dateColumn: "created_at",
    retentionDays: 2555, // 7 years (financial regulations)
    deletionStrategy: "anonymize",
    piiColumns: ["customer_name", "email", "shipping_address", "phone"],
  },
  {
    table: "analytics_events",
    dateColumn: "timestamp",
    retentionDays: 180,
    deletionStrategy: "hard_delete",
  },
];

class RetentionManager {
  constructor(private db: Database) {}

  async enforceRetention(policy: RetentionPolicy): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    switch (policy.deletionStrategy) {
      case "hard_delete":
        const deleteResult = await this.db.query(
          `DELETE FROM ${policy.table}
           WHERE ${policy.dateColumn} < $1`,
          [cutoffDate]
        );
        return deleteResult.rowCount;

      case "anonymize":
        const setClauses = policy.piiColumns!
          .map((col) => `${col} = '[DELETED]'`)
          .join(", ");
        const anonResult = await this.db.query(
          `UPDATE ${policy.table}
           SET ${setClauses}, anonymized_at = NOW()
           WHERE ${policy.dateColumn} < $1
           AND anonymized_at IS NULL`,
          [cutoffDate]
        );
        return anonResult.rowCount;

      case "soft_delete":
        const softResult = await this.db.query(
          `UPDATE ${policy.table}
           SET deleted_at = NOW()
           WHERE ${policy.dateColumn} < $1
           AND deleted_at IS NULL`,
          [cutoffDate]
        );
        return softResult.rowCount;
    }
  }

  // Run all policies — scheduled daily
  async enforceAll(): Promise<void> {
    for (const policy of policies) {
      const affected = await this.enforceRetention(policy);
      logger.info("Retention enforced", {
        table: policy.table,
        strategy: policy.deletionStrategy,
        affected_rows: affected,
      });
    }
  }
}
```

### GDPR Right to Erasure

```typescript
// TypeScript — User Data Deletion (GDPR Article 17)
class GDPRService {
  constructor(
    private db: Database,
    private searchIndex: SearchService,
    private cache: CacheService,
    private backupService: BackupService,
  ) {}

  async deleteUserData(userId: string): Promise<DeletionReport> {
    const report: DeletionReport = {
      userId,
      requestedAt: new Date(),
      tables: [],
    };

    // 1. Anonymize orders (can't delete — financial regulations)
    await this.db.query(
      `UPDATE orders SET
         customer_name = '[DELETED]',
         email = '[DELETED]',
         shipping_address = '[DELETED]',
         phone = '[DELETED]',
         anonymized_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    report.tables.push({ name: "orders", action: "anonymized" });

    // 2. Hard delete personal data tables
    const deleteTables = [
      "user_addresses",
      "user_payment_methods",
      "user_sessions",
      "user_preferences",
      "user_notifications",
    ];
    for (const table of deleteTables) {
      await this.db.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      report.tables.push({ name: table, action: "deleted" });
    }

    // 3. Anonymize user account
    await this.db.query(
      `UPDATE users SET
         email = $2,
         name = '[DELETED USER]',
         phone = NULL,
         avatar_url = NULL,
         deleted_at = NOW()
       WHERE id = $1`,
      [userId, `deleted_${userId}@deleted.local`]
    );
    report.tables.push({ name: "users", action: "anonymized" });

    // 4. Remove from search indexes
    await this.searchIndex.deleteByUserId(userId);
    report.tables.push({ name: "search_index", action: "deleted" });

    // 5. Invalidate caches
    await this.cache.deletePattern(`user:${userId}:*`);

    // 6. Log deletion (audit — required by GDPR)
    await this.db.query(
      `INSERT INTO gdpr_deletion_log (user_id, report, completed_at)
       VALUES ($1, $2, NOW())`,
      [userId, JSON.stringify(report)]
    );

    return report;
  }
}
```

---

## Data Flow Mapping

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Browser  │────▶│   API    │────▶│ Database │────▶│ Analytics│
│ (client) │     │ Gateway  │     │ (primary)│     │   DW     │
└─────────┘     └──────────┘     └──────────┘     └──────────┘
     │               │                │                │
     │  PII in       │  PII in       │  PII at       │  PII
     │  request      │  transit      │  rest         │  anonymized
     │  (TLS)        │  (TLS)       │  (encrypted)  │  (k-anon)
     │               │                │                │
     │               ▼                │                │
     │          ┌──────────┐          │                │
     │          │  Logs    │          │                │
     │          │  (NO PII)│          │                │
     │          └──────────┘          │                │
     │                                │                │
     │               ┌────────────────┘                │
     │               ▼                                 │
     │          ┌──────────┐     ┌──────────┐         │
     │          │  Cache   │     │ Backups  │         │
     │          │ (masked) │     │(encrypted)│        │
     │          └──────────┘     └──────────┘         │
```

**Rule:** PII visibility DECREASES as data flows away from primary storage.

---

## Best Practices

1. **ALWAYS classify data before processing** — know what's PII and what level
2. **ALWAYS encrypt PII at rest** — AES-256-GCM, per-field or per-row
3. **ALWAYS mask PII in logs** — structured logging with redaction rules
4. **ALWAYS pseudonymize production data for dev/test** — EDPB requirement
5. **ALWAYS implement data retention policies** — automated, scheduled, audited
6. **ALWAYS support right to erasure** — GDPR Article 17, complete deletion workflow
7. **ALWAYS audit PII access** — who accessed what, when, why
8. **ALWAYS minimize data collection** — collect only what you need (data minimization)
9. **NEVER store raw PAN (credit card numbers)** — tokenize via payment processor
10. **NEVER log PII** — redact email, phone, SSN, tokens from all logs
11. **NEVER use production PII in dev/test** — pseudonymize or use synthetic data
12. **NEVER share PII without data processing agreement** — GDPR Article 28

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| PII in logs | Data breach via log aggregation | Structured logging with redaction |
| Production data in dev | GDPR violation, breach risk | Pseudonymization pipeline |
| No data classification | Unknown what's sensitive | Classification framework |
| No retention policy | Data grows forever, breach scope | Automated retention + deletion |
| Collecting unnecessary PII | Larger breach surface | Data minimization |
| No encryption at rest | DB breach = full PII exposure | AES-256-GCM field encryption |
| No deletion workflow | Can't fulfill erasure requests | Automated GDPR deletion |
| PII in URLs/query params | Logged by proxies, browsers | POST body only for PII |
| Sharing PII without DPA | Legal liability | Data Processing Agreements |
| No PII inventory | Don't know where PII lives | Data flow mapping |

---

## Real-world Examples

### Stripe (PCI DSS Level 1)
- Card numbers tokenized — never stored in application databases
- Field-level encryption for all PII
- Separate PII vault with strict access controls
- Automated data retention enforcement
- Annual third-party security audit

### Google (GDPR)
- Data deletion pipeline processes millions of requests
- 60-day deletion window (including backups)
- Automated PII detection in logs (DLP API)
- Privacy by Design review for every new feature

### Shopify
- Merchant data encrypted at rest (AES-256)
- Customer PII pseudonymized for analytics
- Data retention: 7 years for financial, 2 years for behavioral
- GDPR deletion completes within 30 days

