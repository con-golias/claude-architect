# API Security & Dependency Management

> **AI Plugin Directive — OWASP API Security, API Key Management & Supply Chain Security**
> You are an AI coding assistant. When generating, reviewing, or refactoring API security
> configurations, follow EVERY rule in this document. APIs are the primary attack surface of
> modern applications. Treat each section as non-negotiable.

**Core Rule: ALWAYS validate and authorize every API request at the server. ALWAYS apply the principle of least privilege. ALWAYS enforce request size limits. ALWAYS log security events. NEVER expose internal errors, stack traces, or sensitive data in API responses. NEVER store API keys in source code.**

---

## 1. OWASP API Security Top 10

```
┌──────────────────────────────────────────────────────────────┐
│              OWASP API Security Top 10 (2023)                │
│                                                               │
│  API1: Broken Object-Level Authorization (BOLA)             │
│  ├── GET /api/users/123 → attacker changes to 124          │
│  ├── Server doesn't verify user owns resource               │
│  └── Fix: ALWAYS check ownership in every endpoint          │
│                                                               │
│  API2: Broken Authentication                                 │
│  ├── Weak tokens, no rate limiting on login                 │
│  ├── JWT with none algorithm accepted                       │
│  └── Fix: Strong auth, rate limit login, validate tokens    │
│                                                               │
│  API3: Broken Object Property-Level Authorization           │
│  ├── Mass assignment: user sends { role: "admin" }          │
│  ├── Excessive data exposure in responses                   │
│  └── Fix: Allow-list fields, never bind raw input to models │
│                                                               │
│  API4: Unrestricted Resource Consumption                    │
│  ├── No rate limiting, no request size limits               │
│  ├── Expensive operations without throttling                │
│  └── Fix: Rate limit, request size limit, pagination        │
│                                                               │
│  API5: Broken Function-Level Authorization                  │
│  ├── Regular user accesses admin endpoints                  │
│  ├── No role/permission check on sensitive operations       │
│  └── Fix: Middleware-enforced RBAC on every route           │
│                                                               │
│  API6: Unrestricted Access to Sensitive Business Flows      │
│  ├── Automated abuse: ticket scalping, credential stuffing  │
│  ├── No bot detection or anti-automation                    │
│  └── Fix: CAPTCHA, device fingerprinting, behavior analysis │
│                                                               │
│  API7: Server-Side Request Forgery (SSRF)                   │
│  ├── API fetches user-supplied URL                          │
│  └── Fix: URL validation, block internal IPs (see injection)│
│                                                               │
│  API8: Security Misconfiguration                            │
│  ├── Default credentials, verbose errors, missing headers   │
│  └── Fix: Security headers, no stack traces, hardened config│
│                                                               │
│  API9: Improper Inventory Management                        │
│  ├── Old API versions still accessible                      │
│  ├── Undocumented shadow APIs                               │
│  └── Fix: API inventory, deprecation policy, API gateway    │
│                                                               │
│  API10: Unsafe Consumption of Third-Party APIs              │
│  ├── Blindly trusting third-party responses                │
│  └── Fix: Validate all external data, timeout, circuit break│
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Object-Level Authorization (BOLA Prevention)

```typescript
// BOLA is the #1 API vulnerability — verify ownership on EVERY request

// WRONG: No ownership check
app.get("/api/orders/:id", authMiddleware, async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  // ❌ Any authenticated user can view any order!
  res.json(order);
});

// CORRECT: Verify ownership
app.get("/api/orders/:id", authMiddleware, async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });

  // ✅ Verify the requesting user owns this resource
  if (order.userId !== req.user.id && !req.user.roles.includes("admin")) {
    logger.warn("BOLA attempt", {
      userId: req.user.id,
      resourceId: req.params.id,
      resourceType: "order",
    });
    return res.status(403).json({ error: "forbidden" });
  }

  res.json(order);
});

// BEST: Reusable authorization middleware
function authorizeResource(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params.id;
    const userId = req.user.id;

    const isOwner = await authorizationService.isOwner(userId, resourceType, resourceId);
    const isAdmin = req.user.roles.includes("admin");

    if (!isOwner && !isAdmin) {
      logger.warn("Authorization failed", { userId, resourceType, resourceId });
      return res.status(403).json({ error: "forbidden" });
    }

    next();
  };
}

// Usage: ownership check is REQUIRED, not optional
app.get("/api/orders/:id", authMiddleware, authorizeResource("order"), orderController.getById);
app.put("/api/orders/:id", authMiddleware, authorizeResource("order"), orderController.update);
app.delete("/api/orders/:id", authMiddleware, authorizeResource("order"), orderController.delete);
```

### Go — BOLA Prevention

```go
func AuthorizeResource(resourceType string, getOwnerID func(ctx context.Context, id string) (string, error)) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            resourceID := chi.URLParam(r, "id")
            userID := auth.GetUserID(r.Context())
            roles := auth.GetRoles(r.Context())

            ownerID, err := getOwnerID(r.Context(), resourceID)
            if err != nil {
                http.Error(w, "not found", http.StatusNotFound)
                return
            }

            if ownerID != userID && !slices.Contains(roles, "admin") {
                slog.Warn("BOLA attempt",
                    "user_id", userID,
                    "resource_type", resourceType,
                    "resource_id", resourceID,
                )
                http.Error(w, "forbidden", http.StatusForbidden)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

---

## 3. Mass Assignment Protection

```typescript
// API3: Broken Object Property-Level Authorization

// WRONG: Binding raw request body to model
app.put("/api/users/:id", async (req, res) => {
  // ❌ Attacker sends: { "name": "John", "role": "admin", "emailVerified": true }
  await db.users.update(req.params.id, req.body);
});

// CORRECT: Allow-list of updatable fields
import { z } from "zod";

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  avatar_url: z.string().url().optional(),
  // role, emailVerified, isAdmin — NOT included
  // These can NEVER be updated through this endpoint
});

app.put("/api/users/:id", authMiddleware, authorizeResource("user"), async (req, res) => {
  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
  }

  // Only validated fields are passed to the update
  const updatedUser = await db.users.update(req.params.id, parsed.data);
  res.json(mapUserResponse(updatedUser)); // Also filter response fields
});

// Response field filtering — don't expose internal fields
function mapUserResponse(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar_url: user.avatarUrl,
    created_at: user.createdAt,
    // ❌ NEVER include: passwordHash, role, internalNotes, ssn
  };
}
```

---

## 4. API Key Management

```typescript
import { randomBytes, createHash, timingSafeEqual } from "crypto";

class APIKeyService {
  // Generate API key with prefix for identification
  async createKey(userId: string, name: string, scopes: string[]): Promise<{
    key: string;
    keyId: string;
  }> {
    // Generate a random key with prefix
    const prefix = "sk_live_";  // sk_test_ for test environment
    const rawKey = randomBytes(32).toString("base64url");
    const fullKey = `${prefix}${rawKey}`;

    // Store HASH of key (never the key itself)
    const keyHash = createHash("sha256").update(fullKey).digest("hex");
    const keyId = randomBytes(8).toString("hex");

    // Store: last 4 chars for display, hash for lookup
    await db.apiKeys.create({
      id: keyId,
      userId,
      name,
      keyHash,
      keyPrefix: fullKey.slice(0, 10),     // "sk_live_XX" for display
      keySuffix: fullKey.slice(-4),         // Last 4 chars for identification
      scopes,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: null,                       // Or set expiration
    });

    // Return the full key ONLY ONCE — user must save it
    return { key: fullKey, keyId };
  }

  // Validate API key
  async validateKey(providedKey: string): Promise<APIKeyRecord | null> {
    const keyHash = createHash("sha256").update(providedKey).digest("hex");

    const record = await db.apiKeys.findOne({ keyHash });
    if (!record) return null;

    // Check expiration
    if (record.expiresAt && record.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp (non-blocking)
    db.apiKeys.update(record.id, { lastUsedAt: new Date() }).catch(() => {});

    return record;
  }

  // Revoke key
  async revokeKey(keyId: string, userId: string): Promise<void> {
    const key = await db.apiKeys.findOne({ id: keyId, userId });
    if (!key) throw new NotFoundError("API key not found");

    await db.apiKeys.delete(keyId);
    logger.info("API key revoked", { keyId, userId });
  }
}

// API key authentication middleware
function apiKeyAuth(requiredScopes?: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer sk_")) {
      return res.status(401).json({ error: "invalid_api_key" });
    }

    const apiKey = authHeader.slice(7); // Remove "Bearer "
    const keyRecord = await apiKeyService.validateKey(apiKey);

    if (!keyRecord) {
      return res.status(401).json({ error: "invalid_or_expired_api_key" });
    }

    // Check scopes
    if (requiredScopes) {
      const hasScope = requiredScopes.some(s => keyRecord.scopes.includes(s));
      if (!hasScope) {
        return res.status(403).json({
          error: "insufficient_scope",
          required: requiredScopes,
          granted: keyRecord.scopes,
        });
      }
    }

    req.user = { id: keyRecord.userId, type: "api_key", keyId: keyRecord.id };
    next();
  };
}

// Usage
app.get("/api/data", apiKeyAuth(["read:data"]), dataController.list);
app.post("/api/data", apiKeyAuth(["write:data"]), dataController.create);
```

---

## 5. Request Size & Resource Limits

```typescript
// API4: Unrestricted Resource Consumption

// Request body size limits
app.use(express.json({ limit: "1mb" }));           // JSON body max 1MB
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// File upload limits
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB per file
    files: 5,                     // Max 5 files per request
    fields: 20,                   // Max 20 non-file fields
    fieldSize: 1024,              // Max 1KB per field value
  },
});

// Pagination limits
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  // NEVER allow unbounded page_size
});

// Query complexity limits (for GraphQL or complex queries)
function limitQueryDepth(maxDepth: number = 5) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body.query) {
      const depth = calculateQueryDepth(req.body.query);
      if (depth > maxDepth) {
        return res.status(400).json({
          error: "query_too_complex",
          max_depth: maxDepth,
        });
      }
    }
    next();
  };
}

// Expensive operation throttling
function throttleExpensiveOp(operationName: string, maxPerMinute: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `throttle:${operationName}:${req.user.id}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);

    if (count > maxPerMinute) {
      return res.status(429).json({
        error: "operation_throttled",
        operation: operationName,
        retry_after: await redis.ttl(key),
      });
    }
    next();
  };
}

// Usage
app.post("/api/reports/generate",
  authMiddleware,
  throttleExpensiveOp("report_generation", 5),  // Max 5 reports/min
  reportController.generate,
);
```

---

## 6. Security Logging & Audit Trail

```typescript
// Log security-relevant events for incident response

interface SecurityEvent {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  userId?: string;
  ip: string;
  userAgent: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

class SecurityLogger {
  async log(event: SecurityEvent): Promise<void> {
    // Structured log for SIEM ingestion
    logger.info("security_event", {
      event_type: event.type,
      severity: event.severity,
      user_id: event.userId,
      ip_address: event.ip,
      user_agent: event.userAgent,
      ...event.details,
    });

    // High/critical: alert immediately
    if (event.severity === "critical" || event.severity === "high") {
      await alertService.sendSecurityAlert(event);
    }

    // Persist to audit log
    await db.securityEvents.create(event);
  }
}

// Events to log
const SECURITY_EVENTS = {
  // Authentication
  LOGIN_SUCCESS: { type: "auth.login.success", severity: "low" as const },
  LOGIN_FAILURE: { type: "auth.login.failure", severity: "medium" as const },
  LOGIN_BRUTE_FORCE: { type: "auth.login.brute_force", severity: "high" as const },
  LOGOUT: { type: "auth.logout", severity: "low" as const },
  PASSWORD_CHANGE: { type: "auth.password.change", severity: "medium" as const },
  PASSWORD_RESET: { type: "auth.password.reset", severity: "medium" as const },
  MFA_ENABLED: { type: "auth.mfa.enabled", severity: "low" as const },
  MFA_DISABLED: { type: "auth.mfa.disabled", severity: "high" as const },

  // Authorization
  BOLA_ATTEMPT: { type: "authz.bola_attempt", severity: "high" as const },
  PRIVILEGE_ESCALATION: { type: "authz.privilege_escalation", severity: "critical" as const },
  FORBIDDEN_ACCESS: { type: "authz.forbidden", severity: "medium" as const },

  // API abuse
  RATE_LIMIT_EXCEEDED: { type: "abuse.rate_limit", severity: "medium" as const },
  INJECTION_ATTEMPT: { type: "abuse.injection", severity: "high" as const },
  INVALID_API_KEY: { type: "abuse.invalid_key", severity: "medium" as const },

  // Data
  DATA_EXPORT: { type: "data.export", severity: "medium" as const },
  BULK_DELETE: { type: "data.bulk_delete", severity: "high" as const },
  ADMIN_ACTION: { type: "admin.action", severity: "medium" as const },
};

// Security event middleware
function securityAudit(req: Request, res: Response, next: NextFunction): void {
  const originalEnd = res.end;

  res.end = function (...args: any[]) {
    // Log all 401 and 403 responses
    if (res.statusCode === 401 || res.statusCode === 403) {
      securityLogger.log({
        type: res.statusCode === 401 ? "auth.unauthorized" : "authz.forbidden",
        severity: "medium",
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || "unknown",
        details: {
          method: req.method,
          path: req.path,
          status: res.statusCode,
        },
        timestamp: new Date(),
      });
    }

    return originalEnd.apply(res, args);
  } as any;

  next();
}
```

---

## 7. Error Response Security

```typescript
// NEVER expose internal errors to clients

// WRONG: Leaking internal details
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // ❌ Exposes stack trace, database details, file paths
  res.status(500).json({
    error: err.message,
    stack: err.stack,
    query: (err as any).query,    // SQL query leaked!
  });
});

// CORRECT: Safe error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log full error internally
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    requestId: req.requestId,
  });

  // Return sanitized error to client
  if (err instanceof AppError) {
    // Known application errors — safe to expose
    res.status(err.statusCode).json({
      error: err.code,
      message: err.publicMessage,
      request_id: req.requestId,   // For support correlation
    });
  } else {
    // Unknown errors — generic message only
    res.status(500).json({
      error: "internal_server_error",
      message: "An unexpected error occurred",
      request_id: req.requestId,
    });
  }
});

// Safe error class
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public publicMessage: string,
    message?: string,  // Internal message (never sent to client)
  ) {
    super(message || publicMessage);
  }
}

// Response headers — remove server identification
app.disable("x-powered-by");  // Don't reveal Express
// In nginx: server_tokens off;
// In Apache: ServerTokens Prod
```

---

## 8. Dependency Security

```
┌──────────────────────────────────────────────────────────────┐
│              Supply Chain Security                            │
│                                                               │
│  Attack Vectors:                                             │
│  ├── Typosquatting: lodash → lodahs (malicious package)     │
│  ├── Dependency confusion: internal package name hijacked   │
│  ├── Compromised maintainer: legit package gets malicious   │
│  ├── Unmaintained dependencies: known CVEs never patched    │
│  └── Transitive deps: your dep's dep is vulnerable          │
│                                                               │
│  Defense Layers:                                             │
│  ├── Lock files: pin exact versions (package-lock.json)     │
│  ├── Audit: npm audit, pip-audit, govulncheck              │
│  ├── SCA tools: Snyk, Dependabot, Renovate                 │
│  ├── Private registry: Artifactory, Verdaccio              │
│  ├── Review new deps: check downloads, maintainers, code   │
│  └── Minimal deps: fewer deps = smaller attack surface     │
│                                                               │
│  RULE: ALWAYS review new dependency before adding           │
│  RULE: ALWAYS run audit in CI/CD pipeline                   │
│  RULE: ALWAYS keep lock files committed                     │
│  RULE: NEVER ignore high/critical vulnerability findings    │
└──────────────────────────────────────────────────────────────┘
```

### Dependency Audit Commands

```bash
# Node.js
npm audit                         # Check for known vulnerabilities
npm audit fix                     # Auto-fix where possible
npm audit --production            # Only production deps

# Python
pip-audit                          # Scan pip dependencies
safety check                      # Alternative scanner

# Go
govulncheck ./...                  # Official Go vulnerability checker

# .NET
dotnet list package --vulnerable   # Check for vulnerable packages

# Rust
cargo audit                        # Scan Cargo dependencies
```

### CI/CD Security Scanning

```yaml
# GitHub Actions — dependency audit
name: Security Audit
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 8 * * 1'  # Weekly Monday 8am

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Node.js audit
        run: npm audit --audit-level=high
        # Fail on high/critical vulnerabilities

      - name: Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: License compliance check
        run: npx license-checker --failOn "GPL-3.0;AGPL-3.0"
        # Block copyleft licenses in proprietary projects
```

### Dependabot / Renovate Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
    # Group minor/patch updates to reduce PR noise
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
    # Security updates are always immediate
    allow:
      - dependency-type: "direct"
    ignore:
      - dependency-name: "aws-sdk"
        versions: ["3.x"]  # Pin to v2
```

---

## 9. HTTPS & TLS Configuration

```
┌──────────────────────────────────────────────────────────────┐
│              TLS Configuration                                │
│                                                               │
│  Minimum Requirements:                                       │
│  ├── TLS 1.2+ (disable TLS 1.0, 1.1, SSLv3)              │
│  ├── Strong cipher suites (ECDHE, AES-GCM)                 │
│  ├── HSTS header (max-age=31536000)                         │
│  ├── Certificate from trusted CA (Let's Encrypt)            │
│  └── Auto-renewal before expiration                         │
│                                                               │
│  nginx TLS config:                                           │
│  ssl_protocols TLSv1.2 TLSv1.3;                            │
│  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:...;           │
│  ssl_prefer_server_ciphers on;                              │
│  ssl_session_timeout 1d;                                    │
│  ssl_session_cache shared:SSL:50m;                          │
│  ssl_stapling on;                                           │
│  ssl_stapling_verify on;                                    │
│                                                               │
│  RULE: ALL production traffic MUST use HTTPS                │
│  RULE: HTTP → HTTPS redirect (301)                          │
│  RULE: HSTS preload submission for maximum security         │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No ownership check on resource access (BOLA) | Users access other users' data | Verify ownership on every endpoint |
| Mass assignment — binding raw body to model | Privilege escalation, data corruption | Allow-list updateable fields with Zod/schema |
| Stack traces in production error responses | Information disclosure | Generic error messages, log internally |
| API keys stored in source code | Credential leak via git | Environment variables, secrets manager |
| API keys stored as plaintext in database | Full compromise on DB breach | Hash keys (SHA-256), show only last 4 chars |
| No request size limits | DoS via large payloads | Express json limit, multer file limits |
| No pagination limits | OOM from unbounded queries | Max page_size (100), enforce pagination |
| Server identification headers (X-Powered-By) | Aids targeted attacks | Disable server identification |
| No dependency audit in CI/CD | Known CVEs in production | npm audit / govulncheck / pip-audit in pipeline |
| Ignoring transitive dependency vulnerabilities | Supply chain attack vector | SCA tools (Snyk, Dependabot) scan full tree |
| No security event logging | Cannot detect or investigate attacks | Log auth failures, BOLA attempts, rate limit hits |
| HTTP in production | MITM, credential theft | HTTPS everywhere, HSTS, redirect HTTP→HTTPS |

---

## 11. Enforcement Checklist

- [ ] BOLA prevention: ownership verified on every resource endpoint
- [ ] Mass assignment protection: allow-list of updateable fields (Zod/schema validation)
- [ ] API error responses contain no stack traces, SQL queries, or internal paths
- [ ] X-Powered-By and server identification headers disabled
- [ ] API keys hashed in database, shown only last 4 chars to users
- [ ] API key scopes enforced (read vs write vs admin)
- [ ] Request body size limited (1MB JSON, 10MB file upload)
- [ ] Pagination enforced with max page_size (100)
- [ ] Security events logged: auth failures, BOLA attempts, rate limit violations
- [ ] Dependency audit runs in CI/CD pipeline (fail on high/critical)
- [ ] Dependabot/Renovate configured for automatic dependency updates
- [ ] Lock files (package-lock.json, go.sum, poetry.lock) committed to git
- [ ] New dependencies reviewed before adding (downloads, maintainers, license)
- [ ] HTTPS enforced on all production endpoints
- [ ] HSTS header configured with preload
- [ ] TLS 1.2+ only (1.0 and 1.1 disabled)
