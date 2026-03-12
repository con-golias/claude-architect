# Compliance Frameworks & Audit

> **Domain:** Backend > Security > Data Protection
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Compliance is not a checkbox exercise — it is an engineering discipline. GDPR, PCI DSS, SOC 2, and HIPAA define specific technical requirements that must be integrated into the backend: encryption, access control, audit logging, data retention, breach notification. The fines are enormous: €1.2 billion in GDPR fines in 2024 alone, cumulative €5.88 billion since 2018. Beyond fines, compliance violations mean lost contracts (enterprise clients require SOC 2), lost trust, and legal liability.

---

## How It Works

### Compliance Framework Overview

| Framework | Scope | Who Needs It | Key Technical Requirements |
|-----------|-------|-------------|---------------------------|
| **GDPR** | EU personal data | Any company processing EU residents' data | Consent, encryption, deletion, DPO, breach notification |
| **PCI DSS** | Payment card data | Anyone storing/processing/transmitting cardholder data | Tokenization, encryption, network segmentation, logging |
| **SOC 2** | Service organization controls | SaaS companies, cloud providers | Access control, monitoring, incident response, encryption |
| **HIPAA** | Protected health info (PHI) | Healthcare, health tech | Encryption, access controls, audit trails, BAAs |
| **CCPA/CPRA** | California consumer data | Companies serving California residents | Data disclosure, deletion, opt-out of sale |

---

## GDPR — Technical Implementation

### Core Principles (Article 5)

| Principle | Technical Requirement |
|-----------|----------------------|
| **Lawfulness** | Consent management system, legal basis tracking per data point |
| **Purpose limitation** | Data tagged with purpose, enforce processing restrictions |
| **Data minimization** | Collect only required fields, regular data audits |
| **Accuracy** | Self-service data update UI, data quality checks |
| **Storage limitation** | Automated retention policies, scheduled deletion |
| **Integrity & confidentiality** | Encryption, access control, audit logs |
| **Accountability** | DPIAs, processing records, compliance documentation |

### Consent Management

```typescript
// TypeScript — Consent Tracking System
interface ConsentRecord {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  source: "signup" | "settings" | "banner" | "api";
  ipAddress: string;  // For proof of consent
  version: string;    // Privacy policy version
}

type ConsentPurpose =
  | "essential"        // Required for service
  | "analytics"        // Usage analytics
  | "marketing"        // Marketing emails
  | "personalization"  // Personalized content
  | "third_party";     // Third-party data sharing

class ConsentService {
  constructor(private db: Database) {}

  async grantConsent(
    userId: string,
    purpose: ConsentPurpose,
    metadata: { source: string; ipAddress: string; policyVersion: string }
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO consent_records (id, user_id, purpose, granted, granted_at, source, ip_address, version)
       VALUES ($1, $2, $3, true, NOW(), $4, $5, $6)
       ON CONFLICT (user_id, purpose)
       DO UPDATE SET granted = true, granted_at = NOW(), source = $4, ip_address = $5, version = $6`,
      [generateId(), userId, purpose, metadata.source, metadata.ipAddress, metadata.policyVersion]
    );
  }

  async revokeConsent(userId: string, purpose: ConsentPurpose): Promise<void> {
    await this.db.query(
      `UPDATE consent_records
       SET granted = false, revoked_at = NOW()
       WHERE user_id = $1 AND purpose = $2`,
      [userId, purpose]
    );

    // Trigger data processing stop for this purpose
    await this.stopDataProcessing(userId, purpose);
  }

  async hasConsent(userId: string, purpose: ConsentPurpose): Promise<boolean> {
    const result = await this.db.query(
      `SELECT granted FROM consent_records
       WHERE user_id = $1 AND purpose = $2`,
      [userId, purpose]
    );
    return result.rows[0]?.granted === true;
  }

  // GDPR: Check consent before any data processing
  async checkConsentMiddleware(purpose: ConsentPurpose) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (purpose === "essential") {
        return next(); // Essential processing doesn't need consent
      }

      const hasConsent = await this.hasConsent(req.userId, purpose);
      if (!hasConsent) {
        return res.status(403).json({
          error: "Consent required",
          purpose,
          consent_url: "/api/v1/consent",
        });
      }
      next();
    };
  }
}
```

### Data Subject Rights API

```typescript
// TypeScript — GDPR Data Subject Rights
class GDPRRightsController {
  // Article 15: Right of Access
  async getMyData(req: Request, res: Response): Promise<void> {
    const userId = req.userId;

    const userData = await this.collectAllUserData(userId);

    // Return in machine-readable format (Article 20: portability)
    res.setHeader("Content-Type", "application/json");
    res.json({
      personal_data: {
        profile: userData.profile,
        orders: userData.orders,
        preferences: userData.preferences,
        consent_records: userData.consents,
        login_history: userData.loginHistory,
      },
      processing_purposes: userData.purposes,
      data_categories: userData.categories,
      retention_periods: userData.retentionPolicies,
      third_party_recipients: userData.thirdPartySharing,
      exported_at: new Date().toISOString(),
      format: "JSON (Article 20 compatible)",
    });
  }

  // Article 16: Right to Rectification
  async updateMyData(req: Request, res: Response): Promise<void> {
    const userId = req.userId;
    const { field, newValue } = req.body;

    // Only allow updating specific personal data fields
    const allowedFields = ["name", "email", "phone", "address"];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: `Cannot update field: ${field}` });
    }

    await this.userService.updateField(userId, field, newValue);

    // Log rectification for compliance
    await this.auditLog.record({
      action: "gdpr.rectification",
      userId,
      field,
      timestamp: new Date(),
    });

    res.json({ status: "updated" });
  }

  // Article 17: Right to Erasure
  async deleteMyData(req: Request, res: Response): Promise<void> {
    const userId = req.userId;

    // Check for legal exceptions (Article 17.3)
    const exceptions = await this.checkDeletionExceptions(userId);
    if (exceptions.length > 0) {
      return res.json({
        status: "partial_deletion",
        message: "Some data retained for legal obligations",
        retained: exceptions,
        deleted: await this.gdprService.deleteUserData(userId),
      });
    }

    const report = await this.gdprService.deleteUserData(userId);
    res.json({ status: "deleted", report });
  }

  // Article 20: Right to Data Portability
  async exportMyData(req: Request, res: Response): Promise<void> {
    const userId = req.userId;
    const format = req.query.format || "json";

    const data = await this.collectAllUserData(userId);

    if (format === "csv") {
      // Generate CSV export
      const csv = this.convertToCSV(data);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=my_data.csv");
      res.send(csv);
    } else {
      res.json(data);
    }
  }

  private async checkDeletionExceptions(
    userId: string
  ): Promise<{ reason: string; data: string; retainUntil: Date }[]> {
    const exceptions = [];

    // Financial records — legal obligation to retain 7 years
    const hasOrders = await this.db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1",
      [userId]
    );
    if (hasOrders.rows[0].count > 0) {
      exceptions.push({
        reason: "Legal obligation (financial records retention)",
        data: "Order history (anonymized)",
        retainUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
      });
    }

    return exceptions;
  }
}
```

### Breach Notification (Article 33 & 34)

```typescript
// TypeScript — Breach Detection & Notification
interface DataBreach {
  id: string;
  detectedAt: Date;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedUsers: number;
  dataTypes: string[];       // ["email", "name", "payment"]
  containedAt?: Date;
  notifiedAuthorityAt?: Date;
  notifiedUsersAt?: Date;
  status: "detected" | "contained" | "notified" | "resolved";
}

class BreachResponseService {
  // Article 33: Notify supervisory authority within 72 hours
  async handleBreach(breach: DataBreach): Promise<void> {
    // 1. Immediate containment
    await this.containBreach(breach);

    // 2. Assess impact
    const impact = await this.assessImpact(breach);

    // 3. Notify DPA within 72 hours (if risk to individuals)
    if (impact.riskToIndividuals) {
      const deadline = new Date(
        breach.detectedAt.getTime() + 72 * 60 * 60 * 1000
      );

      await this.notifyAuthority({
        breachId: breach.id,
        nature: breach.description,
        categories: breach.dataTypes,
        approximateNumber: breach.affectedUsers,
        consequences: impact.consequences,
        measuresTaken: impact.measuresTaken,
        dpoContact: "dpo@example.com",
      });

      breach.notifiedAuthorityAt = new Date();
    }

    // 4. Notify affected users if high risk (Article 34)
    if (impact.highRiskToIndividuals) {
      await this.notifyAffectedUsers(breach);
      breach.notifiedUsersAt = new Date();
    }

    // 5. Document everything (accountability principle)
    await this.documentBreach(breach, impact);
  }
}
```

---

## PCI DSS — Payment Security

### PCI DSS Requirements Summary

| Requirement | Technical Control |
|------------|-------------------|
| **1. Network security** | Firewall, network segmentation |
| **2. Secure configurations** | No default passwords, hardened systems |
| **3. Protect stored data** | Encryption, tokenization, masking |
| **4. Encrypt transmission** | TLS 1.2+, no plaintext transmission |
| **5. Anti-malware** | Updated AV, vulnerability management |
| **6. Secure development** | SAST/DAST, security training, code review |
| **7. Restrict access** | RBAC, least privilege |
| **8. User identification** | MFA, strong passwords, unique IDs |
| **9. Physical security** | Data center controls |
| **10. Logging & monitoring** | Audit trails, log review, alerts |
| **11. Regular testing** | Pen testing, vulnerability scanning |
| **12. Security policy** | Documented policies, training |

### Payment Tokenization

```typescript
// TypeScript — Payment Tokenization (PCI compliance)

// ❌ NEVER store raw card data
interface BadPaymentData {
  cardNumber: string;    // NEVER store this
  cvv: string;           // NEVER store this
  expiryDate: string;    // NEVER store this
}

// ✅ Store tokens from payment processor
interface TokenizedPayment {
  tokenId: string;       // "pm_1234abc" from Stripe
  last4: string;         // "4242" for display
  brand: string;         // "visa"
  expiryMonth: number;
  expiryYear: number;
  // Card number and CVV NEVER touch your servers
}

// Use Stripe Elements / PaymentIntents — card data goes directly to Stripe
// Your server only receives the token
async function processPayment(
  tokenId: string,
  amount: number,
  currency: string
): Promise<PaymentResult> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    payment_method: tokenId,
    confirm: true,
  });

  return {
    id: paymentIntent.id,
    status: paymentIntent.status,
    // Store only the token reference, never raw card data
  };
}
```

---

## SOC 2 — Technical Controls

### SOC 2 Trust Service Criteria

| Criteria | Backend Requirements |
|----------|---------------------|
| **Security** | Access control, firewalls, encryption, vulnerability management |
| **Availability** | Uptime monitoring, disaster recovery, backups, health checks |
| **Processing Integrity** | Input validation, error handling, data accuracy checks |
| **Confidentiality** | Data classification, encryption, access restrictions |
| **Privacy** | PII handling, consent, retention, deletion |

### Audit Logging for SOC 2

```typescript
// TypeScript — Comprehensive Audit Logging
interface AuditEvent {
  id: string;
  timestamp: Date;
  actor: {
    userId: string;
    email: string;
    role: string;
    ipAddress: string;
    userAgent: string;
  };
  action: string;           // "user.create", "order.delete", "settings.update"
  resource: {
    type: string;           // "user", "order", "api_key"
    id: string;
  };
  changes?: {
    field: string;
    from: any;
    to: any;
  }[];
  result: "success" | "failure" | "denied";
  metadata?: Record<string, any>;
}

class AuditLogger {
  constructor(
    private db: Database,
    private eventStream?: EventStream
  ) {}

  async log(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
    const auditEvent: AuditEvent = {
      id: generateId(),
      timestamp: new Date(),
      ...event,
    };

    // Write to append-only audit log table
    await this.db.query(
      `INSERT INTO audit_log (id, timestamp, actor_id, actor_email, actor_role,
         actor_ip, action, resource_type, resource_id, changes, result, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        auditEvent.id,
        auditEvent.timestamp,
        auditEvent.actor.userId,
        auditEvent.actor.email,
        auditEvent.actor.role,
        auditEvent.actor.ipAddress,
        auditEvent.action,
        auditEvent.resource.type,
        auditEvent.resource.id,
        JSON.stringify(auditEvent.changes),
        auditEvent.result,
        JSON.stringify(auditEvent.metadata),
      ]
    );

    // Stream to SIEM for real-time monitoring
    if (this.eventStream) {
      await this.eventStream.publish("audit", auditEvent);
    }
  }
}

// Middleware — automatic audit logging
function auditMiddleware(
  action: string,
  resourceType: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture original response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Log after response
      auditLogger.log({
        actor: {
          userId: req.userId,
          email: req.userEmail,
          role: req.userRole,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] || "unknown",
        },
        action,
        resource: {
          type: resourceType,
          id: req.params.id || body?.id || "unknown",
        },
        result: res.statusCode < 400 ? "success" : "failure",
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime,
        },
      });

      return originalJson(body);
    };

    next();
  };
}

// Usage
router.delete(
  "/api/v1/users/:id",
  authMiddleware,
  auditMiddleware("user.delete", "user"),
  deleteUserHandler
);
```

```sql
-- Audit log table — append-only, immutable
CREATE TABLE audit_log (
    id              TEXT PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id        TEXT NOT NULL,
    actor_email     TEXT NOT NULL,
    actor_role      TEXT NOT NULL,
    actor_ip        INET NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT NOT NULL,
    changes         JSONB,
    result          TEXT NOT NULL CHECK (result IN ('success', 'failure', 'denied')),
    metadata        JSONB
);

-- Indexes for audit queries
CREATE INDEX idx_audit_actor ON audit_log (actor_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_log (resource_type, resource_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_log (action, timestamp DESC);
CREATE INDEX idx_audit_time ON audit_log (timestamp DESC);

-- CRITICAL: Prevent modifications to audit log
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
-- Only app_user can INSERT, only admin can SELECT
GRANT INSERT ON audit_log TO app_user;
GRANT SELECT ON audit_log TO audit_reader;

-- Partition by month for performance at scale
CREATE TABLE audit_log_partitioned (
    LIKE audit_log INCLUDING ALL
) PARTITION BY RANGE (timestamp);
```

---

## Data Processing Agreements (DPA)

### Third-Party Tracking

```typescript
// TypeScript — Data Processing Registry
interface DataProcessor {
  name: string;
  purpose: string;
  dataTypes: string[];
  location: string;       // EU, US, etc.
  dpaSignedDate: Date;
  dpaExpiryDate: Date;
  subProcessors: string[];
  transferMechanism?: "SCCs" | "adequacy_decision" | "BCRs";
}

const processors: DataProcessor[] = [
  {
    name: "Stripe",
    purpose: "Payment processing",
    dataTypes: ["name", "email", "payment_method_token"],
    location: "US",
    dpaSignedDate: new Date("2024-01-01"),
    dpaExpiryDate: new Date("2025-12-31"),
    subProcessors: ["AWS", "Google Cloud"],
    transferMechanism: "SCCs",
  },
  {
    name: "SendGrid",
    purpose: "Transactional email",
    dataTypes: ["email", "name"],
    location: "US",
    dpaSignedDate: new Date("2024-01-01"),
    dpaExpiryDate: new Date("2025-12-31"),
    subProcessors: ["AWS"],
    transferMechanism: "SCCs",
  },
  {
    name: "Sentry",
    purpose: "Error tracking",
    dataTypes: ["ip_address", "user_agent", "user_id"],
    location: "US",
    dpaSignedDate: new Date("2024-01-01"),
    dpaExpiryDate: new Date("2025-12-31"),
    subProcessors: ["Google Cloud"],
    transferMechanism: "SCCs",
  },
];
```

---

## Best Practices

1. **ALWAYS encrypt PII at rest AND in transit** — AES-256-GCM + TLS 1.2+
2. **ALWAYS implement consent management** — track per-purpose, per-user
3. **ALWAYS provide data subject rights APIs** — access, rectification, erasure, portability
4. **ALWAYS maintain audit logs** — append-only, immutable, retained per policy
5. **ALWAYS tokenize payment data** — never store raw card numbers (PCI)
6. **ALWAYS document data processing activities** — GDPR Article 30
7. **ALWAYS have breach notification process** — 72-hour SLA for GDPR
8. **ALWAYS sign DPAs with all processors** — track sub-processors too
9. **NEVER process data beyond stated purpose** — purpose limitation principle
10. **NEVER transfer EU data without legal basis** — SCCs, adequacy decision, or BCRs
11. **NEVER allow audit log modification** — REVOKE UPDATE/DELETE on audit tables
12. **NEVER skip DPIA for high-risk processing** — AI, profiling, large-scale PII

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| No consent tracking | Cannot prove lawful processing | Consent management system |
| Mutable audit logs | Audit trail unreliable | Append-only table, no UPDATE/DELETE |
| No data processing register | Cannot demonstrate compliance | GDPR Article 30 registry |
| Storing raw card data | PCI DSS violation | Tokenize via Stripe/Braintree |
| No breach response plan | Panic, missed 72h deadline | Documented incident response playbook |
| No DPAs with vendors | Legal liability for processor breaches | DPA for every data processor |
| Treating SOC 2 as checkbox | Fails during audit | Continuous compliance, not annual |
| No data flow mapping | Unknown where PII lives | Document all data flows |
| Ignoring data residency | EU data in non-adequate country | SCCs or EU-only hosting |
| No regular access review | Excessive permissions accumulate | Quarterly access reviews |

---

## Real-world Examples

### Meta (GDPR Fine: €1.2B — 2023)
- Transferred EU user data to US without adequate safeguards
- Largest GDPR fine in history
- Required to bring EU data processing into compliance within 6 months
- Led to significant infrastructure changes for EU data localization

### British Airways (GDPR Fine: £20M — 2020)
- 400,000 customers affected by data breach
- Poor security measures (no WAF, no MFA, unpatched systems)
- Personal data including payment card details compromised
- Originally proposed fine: £183M (reduced due to COVID impact)

### Equifax (Multiple Jurisdictions — 2017)
- 147 million records exposed
- Unpatched Apache Struts vulnerability
- $700M settlement
- Led to SOC 2 becoming mandatory for financial data processors

