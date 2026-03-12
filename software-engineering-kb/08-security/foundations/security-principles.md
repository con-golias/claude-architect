# Security Principles

> **Domain:** Security > Foundations > Security Principles
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** --

## Why It Matters

Security principles are the foundational axioms that govern every decision in software security. They are not frameworks, not checklists -- they are the reasoning behind every secure design. When a developer asks "should I validate input on the server even though the client already validates it?" the answer comes from Defense in Depth. When an architect asks "should this service have access to the payments database?" the answer comes from Least Privilege. When an engineer wonders whether to build a custom encryption algorithm, Open Design tells them no.

These principles were formalized by Saltzer and Schroeder in 1975, and every major security failure in the decades since traces back to violating one or more of them. Understanding these principles means you can reason about novel situations -- new architectures, new attack vectors, new compliance requirements -- from first principles rather than rote memorization.

---

## Core Principles

### 1. Defense in Depth

**Definition:** Never rely on a single security control. Layer multiple independent defenses so that the failure of one layer does not compromise the system.

```
Defense in Depth -- Layered Validation:

  Client (Browser)          API Gateway            Service Layer           Database
  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐
  │ Input mask   │    │ Rate limiting    │    │ Business logic   │    │ Constraints  │
  │ Client-side  │───>│ Schema validation│───>│ Type validation  │───>│ CHECK clause │
  │ validation   │    │ Auth token check │    │ Auth + authz     │    │ NOT NULL     │
  │ CSRF token   │    │ WAF rules        │    │ Parameterized SQL│    │ RLS policies │
  └──────────────┘    └──────────────────┘    └──────────────────┘    └──────────────┘
       Layer 1              Layer 2                 Layer 3                Layer 4

  If client validation is bypassed (it always can be),
  the gateway catches malformed requests.
  If the gateway is bypassed, the service validates.
  If the service has a bug, the database constraints prevent corruption.
```

**WRONG -- Single layer of validation:**

```typescript
// INSECURE: Only validates on the client side
// An attacker can bypass the browser entirely using curl or Postman

// React component -- the ONLY validation
function CreateUserForm() {
  const handleSubmit = (data: FormData) => {
    const email = data.get("email") as string;
    if (!email.includes("@")) {
      alert("Invalid email");
      return;
    }
    // Sends directly to API with no server-side validation
    fetch("/api/users", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  };
}
```

**RIGHT -- Multiple validation layers:**

```typescript
// SECURE: Validation at every layer

// Layer 1: Client-side validation (UX only -- never trust this)
function CreateUserForm() {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(255),
  });
  // ... client validation for UX feedback
}

// Layer 2: API Gateway / middleware validation
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255).regex(/^[a-zA-Z\s\-']+$/),
});

function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input" });
      // Do NOT return: res.status(400).json({ error: result.error })
      // That leaks internal validation structure to attackers
    }
    req.validatedBody = result.data;
    next();
  };
}

// Layer 3: Service layer -- business rules + authorization
class UserService {
  async createUser(data: CreateUserInput, actor: AuthenticatedUser): Promise<User> {
    // Authorization check
    if (!actor.hasPermission("users:create")) {
      throw new ForbiddenError("Insufficient permissions");
    }

    // Business validation
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError("Email already registered");
    }

    // Parameterized query -- SQL injection protection
    return this.userRepo.create({
      email: data.email.toLowerCase().trim(),
      name: sanitize(data.name),
    });
  }
}

// Layer 4: Database constraints -- last line of defense
// CREATE TABLE users (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   email TEXT NOT NULL UNIQUE CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
//   name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
//   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
// );
```

**Middleware chain example in Go:**

```go
// SECURE: Defense in depth via middleware chain
func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/orders", handleOrders)

    // Each middleware is an independent security layer
    handler := chain(
        requestIDMiddleware,     // Traceability
        rateLimitMiddleware,     // DDoS protection
        tlsRedirectMiddleware,   // Enforce HTTPS
        corsMiddleware,          // Origin validation
        authMiddleware,          // Authentication (JWT verification)
        auditLogMiddleware,      // Audit trail
        inputSanitizeMiddleware, // Input sanitization
    )(mux)

    srv := &http.Server{
        Addr:         ":8443",
        Handler:      handler,
        ReadTimeout:  5 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  120 * time.Second,
    }
    log.Fatal(srv.ListenAndServeTLS("cert.pem", "key.pem"))
}

func chain(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
    return func(final http.Handler) http.Handler {
        for i := len(middlewares) - 1; i >= 0; i-- {
            final = middlewares[i](final)
        }
        return final
    }
}
```

---

### 2. Principle of Least Privilege

**Definition:** Every user, process, and program must operate with the minimum set of privileges necessary to complete its task. Nothing more.

```
Least Privilege Hierarchy:

  ┌─────────────────────────────────────────────────────┐
  │                  SUPERUSER / ROOT                    │
  │  Full system access -- NEVER used by applications   │
  ├─────────────────────────────────────────────────────┤
  │                  DBA / ADMIN                         │
  │  Schema changes, user management -- human only      │
  ├─────────────────────────────────────────────────────┤
  │              APPLICATION SERVICE                     │
  │  Read/write to specific tables -- automated          │
  ├─────────────────────────────────────────────────────┤
  │              READ-ONLY ANALYTICS                     │
  │  SELECT only on specific tables/views               │
  ├─────────────────────────────────────────────────────┤
  │              MONITORING / HEALTH CHECK               │
  │  SELECT on pg_stat views only                       │
  └─────────────────────────────────────────────────────┘
```

**WRONG -- Overprivileged database user:**

```sql
-- INSECURE: Application connects as superuser
CREATE USER app_service WITH SUPERUSER PASSWORD 'password123';
-- If the application is compromised via SQL injection,
-- the attacker has FULL database access: DROP TABLE, CREATE USER, etc.
```

**RIGHT -- Restricted database user with minimal grants:**

```sql
-- SECURE: Dedicated user with only the permissions it needs
CREATE ROLE order_service_role;

-- Grant only the specific tables and operations needed
GRANT USAGE ON SCHEMA orders TO order_service_role;
GRANT SELECT, INSERT, UPDATE ON orders.orders TO order_service_role;
GRANT SELECT, INSERT ON orders.order_items TO order_service_role;
GRANT SELECT ON orders.products TO order_service_role;  -- read-only for lookups
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA orders TO order_service_role;

-- Explicitly deny DELETE -- this service never deletes orders
-- (no GRANT = no permission, deny by default)

-- No access to other schemas (users, payments, etc.)

-- Create the service account
CREATE USER order_svc WITH PASSWORD 'vault-managed-strong-password';
GRANT order_service_role TO order_svc;
```

**IAM policy -- least privilege for AWS Lambda:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadSpecificDynamoTable",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789:table/Orders"
    },
    {
      "Sid": "WriteToSpecificS3Prefix",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::invoices-bucket/generated/*"
    }
  ]
}
```

Compare with the insecure version:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}
```

**Container capabilities -- least privilege:**

```yaml
# WRONG: Running container as root with all capabilities
# docker run --privileged my-app

# RIGHT: Minimal container security context (Kubernetes)
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
  containers:
    - name: app
      image: my-app:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
          # Add back ONLY what is needed
          # add:
          #   - NET_BIND_SERVICE  # only if binding to port < 1024
      resources:
        limits:
          memory: "256Mi"
          cpu: "500m"
```

**File system permissions -- Python:**

```python
# WRONG: World-readable secrets file
import os
os.chmod("/etc/app/secrets.conf", 0o644)  # rw-r--r-- anyone can read

# RIGHT: Owner-only access to secrets
os.chmod("/etc/app/secrets.conf", 0o600)  # rw------- only owner

# RIGHT: Create files with restricted permissions from the start
import stat
fd = os.open(
    "/etc/app/secrets.conf",
    os.O_WRONLY | os.O_CREAT | os.O_TRUNC,
    stat.S_IRUSR | stat.S_IWUSR  # 0o600
)
os.write(fd, secret_data)
os.close(fd)
```

---

### 3. Fail-Safe Defaults / Fail Secure

**Definition:** The default state of a system must deny access. If a security mechanism fails, crashes, or encounters an error, the result must be denial, not permission. Access is granted explicitly, never implicitly.

```
Fail-Safe Decision Flow:

  Request arrives
       │
       ▼
  ┌──────────────┐     YES     ┌──────────┐
  │ Has explicit  │────────────>│  ALLOW   │
  │ permission?   │             └──────────┘
  └──────────────┘
       │ NO or ERROR or UNKNOWN
       ▼
  ┌──────────┐
  │  DENY    │  <-- This is ALWAYS the default
  └──────────┘
```

**WRONG -- Fail-open authorization:**

```typescript
// INSECURE: Fails open -- if anything goes wrong, access is granted
async function checkPermission(userId: string, resource: string): Promise<boolean> {
  try {
    const response = await authService.check(userId, resource);
    return response.allowed;
  } catch (error) {
    // BUG: If the auth service is down, EVERYONE gets access
    console.error("Auth service unavailable, allowing access");
    return true;  // WRONG: fail-open
  }
}
```

**RIGHT -- Fail-closed authorization:**

```typescript
// SECURE: Fails closed -- if anything goes wrong, access is denied
async function checkPermission(userId: string, resource: string): Promise<boolean> {
  try {
    const response = await authService.check(userId, resource);
    if (response.status !== "ALLOWED") {
      return false;  // Any non-explicit-allow is a deny
    }
    return true;
  } catch (error) {
    logger.error("Auth service unavailable", { userId, resource, error });
    // SECURE: deny access when auth service is down
    return false;
  }
}

// Apply as middleware
function requirePermission(resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const allowed = await checkPermission(req.user?.id ?? "", resource);
    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}
```

**Firewall rules -- default deny:**

```bash
# WRONG: Default allow, selectively block (always incomplete)
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -A INPUT -s 10.0.0.100 -j DROP  # Block one known attacker
# Problem: every other malicious IP is allowed

# RIGHT: Default deny, selectively allow
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow only what is needed
iptables -A INPUT -i lo -j ACCEPT                           # Loopback
iptables -A INPUT -m conntrack --ctstate ESTABLISHED -j ACCEPT  # Return traffic
iptables -A INPUT -p tcp --dport 443 -j ACCEPT              # HTTPS
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/24 -j ACCEPT  # SSH from admin subnet
# Everything else: DROPPED by default policy
```

**Error handling that does not leak information:**

```go
// WRONG: Leaks internal details to the client
func loginHandler(w http.ResponseWriter, r *http.Request) {
    user, err := db.FindUser(r.FormValue("email"))
    if err != nil {
        // Leaks: tells attacker this email does not exist
        http.Error(w, "User not found: "+r.FormValue("email"), 404)
        return
    }
    if !verifyPassword(r.FormValue("password"), user.PasswordHash) {
        // Leaks: tells attacker the email IS valid but password is wrong
        http.Error(w, "Invalid password for user "+user.Email, 401)
        return
    }
}

// RIGHT: Generic error messages, detailed logging server-side
func loginHandler(w http.ResponseWriter, r *http.Request) {
    email := r.FormValue("email")
    password := r.FormValue("password")

    user, err := db.FindUser(email)
    if err != nil {
        // Log detailed error server-side
        log.Warn("Login failed: user not found", "email", email, "ip", r.RemoteAddr)
        // Return generic message -- same for all failure modes
        http.Error(w, "Invalid email or password", http.StatusUnauthorized)
        return
    }

    if !verifyPassword(password, user.PasswordHash) {
        log.Warn("Login failed: wrong password", "email", email, "ip", r.RemoteAddr)
        // Same generic message -- attacker cannot distinguish failure reason
        http.Error(w, "Invalid email or password", http.StatusUnauthorized)
        return
    }

    // Constant-time comparison to prevent timing attacks
    createSession(w, user)
}
```

---

### 4. Separation of Duties

**Definition:** No single entity -- person, service, or process -- should have complete control over a critical operation. Critical actions must require collaboration between multiple parties.

```
Separation of Duties in CI/CD Pipeline:

  Developer          Reviewer           CI/CD             Ops/SRE
  ┌────────┐      ┌────────┐       ┌────────┐        ┌────────┐
  │ Writes │      │Approves│       │ Builds │        │Approves│
  │ code   │─────>│ PR     │──────>│ & tests│───────>│ deploy │
  └────────┘      └────────┘       └────────┘        └────────┘
       │               │                │                  │
       │  Cannot       │  Cannot        │  Automated       │  Cannot
       │  approve      │  merge own     │  no human        │  modify
       │  own PR       │  code to prod  │  bypass          │  code
       └───────────────┴────────────────┴──────────────────┘

  No single person can: write code AND approve AND deploy to production
```

**WRONG -- Single admin with full control:**

```python
# INSECURE: One admin role does everything
class AdminService:
    def create_user(self, admin, user_data):
        # Admin creates users, approves them, and manages their payments
        user = User.create(**user_data)
        user.approve()  # Same person who created also approves
        user.set_payment_method(user_data["payment"])
        return user

    def process_refund(self, admin, order_id, amount):
        # Same admin initiates AND approves refund -- no oversight
        refund = Refund.create(order_id=order_id, amount=amount)
        refund.approve(approved_by=admin.id)  # Approves own action
        payment_gateway.process(refund)
        return refund
```

**RIGHT -- Separated roles with dual approval:**

```python
# SECURE: Critical operations require multiple parties

class RefundService:
    def initiate_refund(self, initiator: User, order_id: str, amount: Decimal) -> Refund:
        """Step 1: Support agent initiates the refund."""
        if not initiator.has_role("support_agent"):
            raise PermissionError("Only support agents can initiate refunds")

        refund = Refund.create(
            order_id=order_id,
            amount=amount,
            initiated_by=initiator.id,
            status="pending_approval",
        )
        notify_finance_team(refund)
        audit_log.record("refund_initiated", refund=refund, actor=initiator)
        return refund

    def approve_refund(self, approver: User, refund_id: str) -> Refund:
        """Step 2: Finance manager approves. Cannot be the same person."""
        refund = Refund.get(refund_id)

        if not approver.has_role("finance_manager"):
            raise PermissionError("Only finance managers can approve refunds")

        # CRITICAL: The approver cannot be the initiator
        if approver.id == refund.initiated_by:
            raise PermissionError("Cannot approve your own refund request")

        # Large refunds require a second approver
        if refund.amount > Decimal("1000.00"):
            if not approver.has_role("finance_director"):
                raise PermissionError("Refunds over $1000 require director approval")

        refund.approve(approved_by=approver.id)
        payment_gateway.process(refund)
        audit_log.record("refund_approved", refund=refund, actor=approver)
        return refund
```

**Database migration approval workflow:**

```yaml
# .github/workflows/migration-approval.yml
# Separation of duties: developer writes migration, DBA approves

name: Database Migration
on:
  pull_request:
    paths:
      - "migrations/**"

jobs:
  validate-migration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint SQL migrations
        run: sqlfluff lint migrations/
      - name: Dry-run migration against staging
        run: flyway -url=$STAGING_DB_URL migrate -dryRun

  require-dba-approval:
    needs: validate-migration
    runs-on: ubuntu-latest
    environment: database-migrations  # Requires approval from "dba-team"
    steps:
      - name: Apply migration
        run: flyway -url=$PRODUCTION_DB_URL migrate
        env:
          PRODUCTION_DB_URL: ${{ secrets.PROD_DB_URL }}
```

---

### 5. Complete Mediation

**Definition:** Every access to every resource must be checked for authorization. Do not cache authorization decisions. Do not assume that because a user was authenticated at the front door, they are authorized for every room inside.

**WRONG -- Check only at login, assume authorization thereafter:**

```typescript
// INSECURE: Checks authentication once, never checks authorization per endpoint
app.post("/api/login", async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);
  const token = jwt.sign({ userId: user.id }, SECRET);
  res.json({ token });
});

// Any authenticated user can access ANY endpoint -- no per-resource authorization
app.get("/api/users/:id/billing", authMiddleware, async (req, res) => {
  // authMiddleware only checks if token is valid
  // Does NOT check if this user is allowed to see THIS user's billing
  const billing = await db.getBilling(req.params.id);
  res.json(billing); // User A can see User B's billing data
});

app.delete("/api/users/:id", authMiddleware, async (req, res) => {
  // Any authenticated user can delete ANY user
  await db.deleteUser(req.params.id);
  res.json({ success: true });
});
```

**RIGHT -- Authorization checked on every request, for every resource:**

```typescript
// SECURE: Every endpoint checks both authentication AND authorization

// Middleware: verify token on every request
function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    req.user = jwt.verify(token, SECRET) as AuthenticatedUser;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Per-endpoint authorization -- checked EVERY time
app.get("/api/users/:id/billing",
  authenticate,
  async (req, res) => {
    const targetUserId = req.params.id;

    // Complete mediation: check if THIS user can access THIS resource
    if (req.user.id !== targetUserId && !req.user.hasRole("billing_admin")) {
      audit.log("unauthorized_access_attempt", {
        actor: req.user.id,
        resource: `users/${targetUserId}/billing`,
      });
      return res.status(403).json({ error: "Access denied" });
    }

    const billing = await db.getBilling(targetUserId);
    res.json(billing);
  }
);

app.delete("/api/users/:id",
  authenticate,
  requireRole("admin"),  // Only admins can delete
  async (req, res) => {
    // Even admins cannot delete themselves (separation of duties)
    if (req.user.id === req.params.id) {
      return res.status(403).json({ error: "Cannot delete own account" });
    }

    await db.softDeleteUser(req.params.id, { deletedBy: req.user.id });
    audit.log("user_deleted", { actor: req.user.id, target: req.params.id });
    res.json({ success: true });
  }
);
```

**Go -- middleware that validates every request, not just the first:**

```go
// SECURE: Authorization middleware that runs on EVERY request
func AuthzMiddleware(policyEngine PolicyEngine) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user := GetUserFromContext(r.Context())
            if user == nil {
                http.Error(w, `{"error":"authentication required"}`, 401)
                return
            }

            // Check authorization for THIS specific request
            decision, err := policyEngine.Evaluate(PolicyRequest{
                Subject:  user.ID,
                Action:   r.Method,
                Resource: r.URL.Path,
                Context: map[string]string{
                    "ip":         r.RemoteAddr,
                    "user_agent": r.UserAgent(),
                },
            })

            if err != nil {
                // Fail secure: if policy engine errors, deny
                log.Error("policy evaluation failed", "error", err, "user", user.ID)
                http.Error(w, `{"error":"access denied"}`, 403)
                return
            }

            if decision != Allow {
                auditLog.Record("access_denied", user.ID, r.Method, r.URL.Path)
                http.Error(w, `{"error":"access denied"}`, 403)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

---

### 6. Open Design (Kerckhoffs' Principle)

**Definition:** The security of a system must not depend on the secrecy of its design or implementation. It must depend only on the secrecy of the keys. A system should be secure even if everything about it, except the keys, is public knowledge.

**WRONG -- Security through obscurity:**

```typescript
// INSECURE: "Secret" API endpoint -- security relies on nobody knowing the URL
app.get("/api/super-secret-admin-panel-x7k9m2", (req, res) => {
  // No authentication -- anyone who discovers the URL has full access
  const users = await db.query("SELECT * FROM users");
  res.json(users);
});

// INSECURE: Custom "encryption" algorithm
function encryptPassword(password: string): string {
  // ROT13-style obfuscation -- not encryption
  // Anyone who reads this source code can reverse it
  return password
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) + 13))
    .join("");
}

// INSECURE: Hardcoded "secret" validation
function isAdmin(user: User): boolean {
  // "Security" relies on nobody knowing the magic string
  return user.role === "xK9_super_admin_hidden";
}
```

**RIGHT -- Security based on proven algorithms and proper key management:**

```typescript
// SECURE: Use published, peer-reviewed algorithms
import bcrypt from "bcrypt";
import crypto from "crypto";

// Password hashing: bcrypt (published algorithm, well-studied)
async function hashPassword(password: string): Promise<string> {
  const SALT_ROUNDS = 12; // Cost factor -- adjustable as hardware improves
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash); // Constant-time comparison built in
}

// Encryption: AES-256-GCM (NIST standard, open specification)
function encryptData(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(12); // Random IV for every encryption
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    algorithm: "aes-256-gcm", // Algorithm is public -- security is in the key
  };
}

// Admin endpoints: proper authentication, not hidden URLs
app.get("/api/admin/users",
  authenticate,              // Verify identity
  requireRole("admin"),      // Verify authorization
  rateLimit({ max: 100 }),   // Rate limit
  auditLog("admin_access"),  // Audit trail
  async (req, res) => {
    const users = await db.query("SELECT id, email, role FROM users");
    res.json(users);
  }
);
```

**Python -- using well-known cryptographic libraries:**

```python
# SECURE: Use published, audited libraries
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import os
import base64

def derive_key(password: str, salt: bytes) -> bytes:
    """Derive encryption key from password using PBKDF2 (NIST SP 800-132)."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600_000,  # OWASP 2023 recommendation
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))

def encrypt_sensitive_data(data: str, password: str) -> dict:
    """Encrypt using Fernet (AES-128-CBC + HMAC-SHA256). Algorithm is public."""
    salt = os.urandom(16)
    key = derive_key(password, salt)
    f = Fernet(key)
    token = f.encrypt(data.encode())
    return {
        "ciphertext": token.decode(),
        "salt": base64.b64encode(salt).decode(),
        "algorithm": "fernet-pbkdf2-sha256",  # Public knowledge
        "iterations": 600_000,
    }
```

---

### 7. Economy of Mechanism

**Definition:** Security mechanisms must be as simple and small as possible. Every line of code in a security-critical path is a potential vulnerability. Complexity is the enemy of security. Simpler systems are easier to audit, test, and reason about.

**WRONG -- Over-engineered authentication:**

```typescript
// INSECURE: Overly complex custom auth with multiple code paths
class CustomAuthenticator {
  async authenticate(req: Request): Promise<User | null> {
    // 15 different authentication methods in one function
    if (req.headers["x-api-key"]) {
      return this.authByApiKey(req);
    } else if (req.headers["x-service-token"]) {
      return this.authByServiceToken(req);
    } else if (req.cookies["legacy_session"]) {
      return this.authByLegacyCookie(req);
    } else if (req.headers["x-sso-token"]) {
      return this.authBySsoToken(req);
    } else if (req.query["token"]) {
      return this.authByQueryParam(req);  // Tokens in URLs end up in logs
    } else if (req.headers["x-custom-hmac"]) {
      return this.authByCustomHmac(req);  // Custom crypto = bugs
    } else if (req.headers["x-internal"]) {
      return this.authByInternalHeader(req);  // Spoofable header
    }
    // ... 8 more methods
    // Each code path is a potential bypass
    // Impossible to audit, impossible to test all combinations
    return null;
  }
}
```

**RIGHT -- Simple, auditable authentication:**

```typescript
// SECURE: One clear authentication mechanism
// Simple enough to fit in a single screen, easy to audit

async function authenticate(req: Request): Promise<AuthResult> {
  const token = extractBearerToken(req);
  if (!token) {
    return { authenticated: false, reason: "missing_token" };
  }

  try {
    const payload = jwt.verify(token, PUBLIC_KEY, {
      algorithms: ["RS256"],  // Single algorithm -- no algorithm confusion
      issuer: "auth.myapp.com",
      audience: "api.myapp.com",
    });

    return {
      authenticated: true,
      user: {
        id: payload.sub,
        roles: payload.roles,
        expiresAt: payload.exp,
      },
    };
  } catch (err) {
    return { authenticated: false, reason: "invalid_token" };
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}
```

**Minimal attack surface -- expose only what is needed:**

```go
// WRONG: Exposing debug endpoints, health details, and admin in same server
mux.HandleFunc("/debug/pprof/", pprof.Index)       // CPU profiling exposed
mux.HandleFunc("/debug/vars", expvar.Handler())     // Internal variables exposed
mux.HandleFunc("/admin/", adminPanel)               // Admin on same port
mux.HandleFunc("/api/", apiHandler)                 // Business API

// RIGHT: Separate servers for separate concerns, minimal surface
// Public API server -- only business endpoints
publicMux := http.NewServeMux()
publicMux.HandleFunc("/api/", apiHandler)
publicMux.HandleFunc("/health", healthCheck)  // Simple boolean health check

go http.ListenAndServeTLS(":443", "cert.pem", "key.pem", publicMux)

// Internal server -- different port, only accessible from internal network
internalMux := http.NewServeMux()
internalMux.HandleFunc("/metrics", promHandler)
internalMux.HandleFunc("/debug/pprof/", pprof.Index)

go http.ListenAndServe("127.0.0.1:9090", internalMux)

// Admin server -- separate process entirely, VPN-only access
```

---

### 8. Psychological Acceptability

**Definition:** Security mechanisms must not make the system significantly harder to use. If security is too burdensome, users will circumvent it. The most secure system that nobody uses protects nothing. Design security to be the easy path, not an obstacle.

**WRONG -- Security that users will bypass:**

```typescript
// INSECURE: Password policy so strict that users write passwords on sticky notes
const passwordPolicy = {
  minLength: 20,
  requireUppercase: 3,    // At least 3 uppercase
  requireNumbers: 3,      // At least 3 numbers
  requireSpecial: 3,      // At least 3 special characters
  noRepeatingChars: true,
  changeEvery: 30,        // Force change every 30 days
  noLast24Passwords: true, // Cannot reuse last 24 passwords
  // Result: users choose "P@ssw0rd123!@#_March2025" and increment the month
};

// INSECURE: MFA on every single page load
app.use(async (req, res, next) => {
  // Require MFA verification for EVERY request
  const mfaCode = req.headers["x-mfa-code"];
  if (!verifyMFA(req.user, mfaCode)) {
    return res.status(403).json({ error: "MFA required" });
  }
  // Users will demand MFA be removed entirely
  next();
});
```

**RIGHT -- Progressive security that respects usability:**

```typescript
// SECURE: Follow NIST 800-63B guidelines -- usable AND secure
const passwordPolicy = {
  minLength: 12,             // NIST: minimum 8, we use 12
  maxLength: 128,            // Allow long passphrases
  // NO complexity requirements -- NIST explicitly advises against them
  // NO forced rotation -- NIST advises against periodic changes
  checkBreachedPasswords: true,  // Check against HaveIBeenPwned
  blockCommonPasswords: true,    // Block "password123", etc.
};

// Encourage passphrases -- easier to remember, harder to crack
function getPasswordStrength(password: string): PasswordStrength {
  // "correct horse battery staple" (44 bits) > "P@ssw0rd!" (28 bits)
  const entropy = calculateEntropy(password);
  if (entropy >= 60) return "strong";
  if (entropy >= 40) return "moderate";
  return "weak";
}

// Risk-based MFA -- only when actually needed
class AdaptiveAuthService {
  async shouldRequireMFA(user: User, context: RequestContext): Promise<boolean> {
    // Always require MFA for sensitive operations
    if (context.operation === "transfer_funds") return true;
    if (context.operation === "change_password") return true;
    if (context.operation === "add_admin") return true;

    // Require MFA when risk signals are elevated
    if (context.isNewDevice) return true;
    if (context.isNewLocation) return true;
    if (context.failedAttemptsRecently > 2) return true;

    // Normal browsing from known device/location -- session is sufficient
    return false;
  }
}

// Offer multiple MFA options -- not everyone has a smartphone
const mfaOptions = [
  "authenticator_app",   // TOTP -- Google Authenticator, Authy
  "hardware_key",        // WebAuthn/FIDO2 -- YubiKey
  "sms_backup",          // SMS -- fallback only, less secure
];
```

---

### 9. Least Common Mechanism

**Definition:** Minimize the amount of mechanism shared between users or between processes. Shared resources are shared attack surfaces. If two services share a database connection pool, a compromise of one service can affect the other.

```
Shared vs. Isolated Mechanisms:

  WRONG -- Shared everything:
  ┌──────────────┐     ┌──────────────────────┐
  │ Service A    │────>│                      │
  ├──────────────┤     │  Shared DB Pool      │───> Single Database
  │ Service B    │────>│  Shared Cache        │     (all tables)
  ├──────────────┤     │  Shared File System  │
  │ Service C    │────>│                      │
  └──────────────┘     └──────────────────────┘
  Compromise of any service = access to all data

  RIGHT -- Isolated mechanisms:
  ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
  │ Service A    │────>│ Pool A (user_a)  │────>│  Schema A    │
  └──────────────┘     └──────────────────┘     └──────────────┘

  ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
  │ Service B    │────>│ Pool B (user_b)  │────>│  Schema B    │
  └──────────────┘     └──────────────────┘     └──────────────┘

  ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
  │ Service C    │────>│ Pool C (user_c)  │────>│  Schema C    │
  └──────────────┘     └──────────────────┘     └──────────────┘
  Compromise of Service A cannot access Schema B or C
```

**WRONG -- Services sharing database connections and credentials:**

```python
# INSECURE: All services use the same database connection with the same user
# If any service is compromised, attacker has access to ALL tables

import psycopg2

# Shared connection string used by every service
DB_URL = "postgresql://app_superuser:password@db:5432/monolith_db"

class OrderService:
    def get_orders(self):
        conn = psycopg2.connect(DB_URL)
        # This connection can also access users, payments, audit_logs...
        return conn.execute("SELECT * FROM orders")

class UserService:
    def get_users(self):
        conn = psycopg2.connect(DB_URL)  # Same credentials
        return conn.execute("SELECT * FROM users")

class PaymentService:
    def get_payments(self):
        conn = psycopg2.connect(DB_URL)  # Same credentials
        return conn.execute("SELECT * FROM payments")
```

**RIGHT -- Isolated connections with separate credentials per service:**

```python
# SECURE: Each service has its own database user with isolated access

import psycopg2
from functools import lru_cache

class DatabaseConfig:
    """Each service gets its own connection pool with minimal permissions."""

    @staticmethod
    def for_order_service() -> str:
        # order_svc can only access orders schema
        return get_secret("order-service/db-url")
        # postgresql://order_svc:xxx@db:5432/app?options=-c%20search_path=orders

    @staticmethod
    def for_user_service() -> str:
        # user_svc can only access users schema
        return get_secret("user-service/db-url")
        # postgresql://user_svc:xxx@db:5432/app?options=-c%20search_path=users

    @staticmethod
    def for_payment_service() -> str:
        # payment_svc can only access payments schema
        return get_secret("payment-service/db-url")
        # postgresql://payment_svc:xxx@db:5432/app?options=-c%20search_path=payments


class OrderService:
    def __init__(self):
        self.pool = ConnectionPool(DatabaseConfig.for_order_service(), max_size=10)
        # This pool CANNOT access users or payments tables

    def get_orders(self, user_id: str):
        with self.pool.connection() as conn:
            return conn.execute(
                "SELECT * FROM orders WHERE user_id = %s", (user_id,)
            )
```

**Process isolation -- containers and namespaces:**

```yaml
# SECURE: Each service runs in its own container with isolated resources
# docker-compose.yml

services:
  order-service:
    image: order-service:latest
    networks:
      - order-network       # Can only reach order-db
    volumes: []              # No shared volumes
    read_only: true          # Read-only filesystem
    tmpfs:
      - /tmp:size=64M        # Writable tmpfs, size-limited

  user-service:
    image: user-service:latest
    networks:
      - user-network         # Can only reach user-db
    volumes: []
    read_only: true

  order-db:
    image: postgres:16
    networks:
      - order-network        # Only reachable from order-service
    volumes:
      - order-data:/var/lib/postgresql/data

  user-db:
    image: postgres:16
    networks:
      - user-network         # Only reachable from user-service
    volumes:
      - user-data:/var/lib/postgresql/data

networks:
  order-network:
    internal: true           # No external access
  user-network:
    internal: true

volumes:
  order-data:
  user-data:
```

---

### 10. Defense Against Insider Threats

**Definition:** Assume that any internal actor -- employee, contractor, compromised service account -- may act maliciously or negligently. Implement audit logging, access reviews, credential rotation, and anomaly detection to detect and limit insider damage.

**Comprehensive audit logging:**

```typescript
// SECURE: Immutable audit log for all sensitive operations

interface AuditEvent {
  timestamp: string;
  eventId: string;
  actor: {
    userId: string;
    role: string;
    ip: string;
    userAgent: string;
    sessionId: string;
  };
  action: string;
  resource: {
    type: string;
    id: string;
  };
  outcome: "success" | "failure" | "denied";
  details: Record<string, unknown>;
  // Hash chain for tamper detection
  previousHash: string;
  eventHash: string;
}

class AuditLogger {
  private lastHash: string = "genesis";

  async log(event: Omit<AuditEvent, "timestamp" | "eventId" | "previousHash" | "eventHash">): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      eventId: crypto.randomUUID(),
      previousHash: this.lastHash,
      eventHash: "", // computed below
    };

    // Create tamper-evident hash chain
    auditEvent.eventHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ ...auditEvent, eventHash: undefined }))
      .digest("hex");
    this.lastHash = auditEvent.eventHash;

    // Write to append-only storage (cannot be modified or deleted)
    await this.appendOnlyStore.write(auditEvent);

    // Also send to external SIEM for independent storage
    await this.siemClient.send(auditEvent);
  }
}

// Usage in application code
app.put("/api/users/:id/role",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const targetUser = await db.getUser(req.params.id);
    const oldRole = targetUser.role;
    const newRole = req.body.role;

    await db.updateUserRole(req.params.id, newRole);

    // Audit: WHO changed WHAT from WHICH value to WHICH value, and WHEN
    await audit.log({
      actor: {
        userId: req.user.id,
        role: req.user.role,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || "unknown",
        sessionId: req.session.id,
      },
      action: "user.role.change",
      resource: { type: "user", id: req.params.id },
      outcome: "success",
      details: {
        previousRole: oldRole,
        newRole: newRole,
        reason: req.body.reason, // Require justification
      },
    });

    res.json({ success: true });
  }
);
```

**Automated access review and credential rotation:**

```python
# SECURE: Automated access review -- flag stale permissions

import datetime
from dataclasses import dataclass

@dataclass
class AccessReviewResult:
    user_id: str
    permission: str
    last_used: datetime.datetime | None
    recommendation: str  # "keep", "revoke", "review"

class AccessReviewService:
    """Run quarterly access reviews automatically."""

    def review_all_permissions(self) -> list[AccessReviewResult]:
        results = []
        all_grants = self.permission_store.get_all_grants()

        for grant in all_grants:
            last_used = self.audit_store.get_last_usage(
                user_id=grant.user_id,
                permission=grant.permission,
            )

            if last_used is None:
                # Permission was granted but NEVER used
                results.append(AccessReviewResult(
                    user_id=grant.user_id,
                    permission=grant.permission,
                    last_used=None,
                    recommendation="revoke",
                ))
            elif (datetime.datetime.now() - last_used).days > 90:
                # Not used in 90 days -- likely not needed
                results.append(AccessReviewResult(
                    user_id=grant.user_id,
                    permission=grant.permission,
                    last_used=last_used,
                    recommendation="review",
                ))
            else:
                results.append(AccessReviewResult(
                    user_id=grant.user_id,
                    permission=grant.permission,
                    last_used=last_used,
                    recommendation="keep",
                ))

        return results

    def auto_revoke_unused(self, dry_run: bool = True) -> list[str]:
        """Automatically revoke permissions never used in 180 days."""
        results = self.review_all_permissions()
        revoked = []

        for r in results:
            if r.last_used is None or (datetime.datetime.now() - r.last_used).days > 180:
                if not dry_run:
                    self.permission_store.revoke(r.user_id, r.permission)
                    self.audit_log.record(
                        action="permission_auto_revoked",
                        target_user=r.user_id,
                        permission=r.permission,
                        reason="unused_180_days",
                    )
                revoked.append(f"{r.user_id}:{r.permission}")

        return revoked
```

**Credential rotation:**

```go
// SECURE: Automatic credential rotation
// Secrets have a maximum lifetime and are rotated before expiry

type SecretRotator struct {
    vault      VaultClient
    maxAge     time.Duration
    rotateAt   time.Duration // Rotate when this fraction of maxAge has passed
}

func NewSecretRotator(vault VaultClient) *SecretRotator {
    return &SecretRotator{
        vault:    vault,
        maxAge:   90 * 24 * time.Hour, // 90-day maximum lifetime
        rotateAt: 60 * 24 * time.Hour, // Rotate at 60 days
    }
}

func (r *SecretRotator) RotateIfNeeded(ctx context.Context, secretPath string) error {
    metadata, err := r.vault.ReadMetadata(ctx, secretPath)
    if err != nil {
        return fmt.Errorf("reading secret metadata: %w", err)
    }

    age := time.Since(metadata.CreatedAt)
    if age < r.rotateAt {
        return nil // Not yet due for rotation
    }

    slog.Info("rotating secret",
        "path", secretPath,
        "age_days", int(age.Hours()/24),
        "max_age_days", int(r.maxAge.Hours()/24),
    )

    // Generate new credential
    newPassword, err := generateSecurePassword(32)
    if err != nil {
        return fmt.Errorf("generating password: %w", err)
    }

    // Update the downstream system (e.g., database password)
    if err := r.updateDownstreamCredential(ctx, secretPath, newPassword); err != nil {
        return fmt.Errorf("updating downstream: %w", err)
    }

    // Store new secret in vault
    if err := r.vault.Write(ctx, secretPath, map[string]interface{}{
        "password":   newPassword,
        "rotated_at": time.Now().UTC().Format(time.RFC3339),
    }); err != nil {
        return fmt.Errorf("writing to vault: %w", err)
    }

    // Audit the rotation
    auditLog.Record("secret_rotated", map[string]string{
        "path":    secretPath,
        "age":     age.String(),
        "trigger": "scheduled",
    })

    return nil
}
```

---

## Best Practices

1. **ALWAYS validate input at every layer** -- client, gateway, service, and database. Never trust that an upstream layer has validated correctly. (Defense in Depth)

2. **ALWAYS grant the minimum permissions required** -- for database users, IAM roles, file permissions, container capabilities, and API scopes. Start with zero permissions and add only what is needed. (Least Privilege)

3. **ALWAYS default to deny** -- authorization decisions, firewall rules, CORS policies, and feature flags must deny by default. Access is granted explicitly, never implicitly. (Fail-Safe Defaults)

4. **ALWAYS require multiple parties for critical operations** -- code merges, production deploys, financial transactions, and access grants must require approval from someone other than the initiator. (Separation of Duties)

5. **ALWAYS check authorization on every request** -- do not cache authorization decisions across requests. A user's permissions may have been revoked between their last request and the current one. (Complete Mediation)

6. **ALWAYS use published, peer-reviewed cryptographic algorithms** -- AES-256-GCM for encryption, bcrypt/scrypt/Argon2id for password hashing, RSA-2048+ or Ed25519 for signatures. Never invent custom cryptography. (Open Design)

7. **ALWAYS keep security mechanisms simple and auditable** -- a 50-line authentication function you can reason about is better than a 500-line one with edge cases. Reduce code paths in security-critical sections. (Economy of Mechanism)

8. **ALWAYS design security to be the path of least resistance** -- offer password managers, passkeys, and SSO. Make the secure option easier than the insecure one. (Psychological Acceptability)

9. **ALWAYS isolate services with separate credentials, network segments, and data stores** -- a compromise of one service must not grant access to another. (Least Common Mechanism)

10. **ALWAYS log sensitive operations to immutable, externally stored audit logs** -- and review access grants quarterly. Rotate all credentials on a defined schedule. (Defense Against Insider Threats)

---

## Anti-Patterns

### 1. Client-Only Validation

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Input validated only in the browser | Attacker bypasses with curl/Postman, sends malicious input directly to API | Validate at every layer: client (UX), gateway (schema), service (business rules), database (constraints) |

### 2. God Service Account

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Single database user with superuser/admin privileges used by all services | SQL injection in any service = full database compromise | Create per-service database users with grants limited to specific schemas and operations |

### 3. Fail-Open Error Handling

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Authorization returns "allow" when the auth service is unavailable or throws an error | Service outage in auth system = everyone is an admin | Default to deny on all errors, timeouts, and unexpected responses |

### 4. Authorization at the Gate Only

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Authentication checked at login, but individual endpoints do not check authorization | Authenticated user A can access user B's data by changing an ID in the URL | Check authorization on every endpoint, for every resource, on every request |

### 5. Security Through Obscurity

| Problem | Consequence | Fix |
|---------|-------------|-----|
| "Secret" URLs, custom encoding, hidden parameters as the primary security mechanism | Attacker discovers the URL via logs, referrer headers, browser history, or source code | Use proper authentication and authorization. Assume all URLs and code are public |

### 6. Overly Complex Security Logic

| Problem | Consequence | Fix |
|---------|-------------|-----|
| 15 different authentication methods, complex conditional chains, multiple code paths | Impossible to audit, high chance of logical bypass, hard to test all branches | Consolidate to the fewest possible auth mechanisms. Prefer one well-tested path |

### 7. Shared Credentials Across Services

| Problem | Consequence | Fix |
|---------|-------------|-----|
| All microservices use the same database password and connection string | Cannot revoke access to one service without affecting all others. Blast radius is entire system | Per-service credentials stored in a secrets manager, rotated independently |

### 8. No Audit Trail for Privileged Operations

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Admin actions (role changes, data exports, config changes) are not logged | Cannot detect insider threats, cannot investigate breaches, cannot meet compliance | Log every privileged operation with who, what, when, from where, and the before/after state. Store logs externally |

---

## Security Principles Quick Reference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECURITY PRINCIPLES SUMMARY                              │
├──────────────────────────┬──────────────────────────────────────────────────┤
│ Principle                │ One-Line Rule                                    │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ Defense in Depth         │ Never rely on a single security control          │
│ Least Privilege          │ Grant only the minimum permissions needed        │
│ Fail-Safe Defaults       │ Deny by default; allow explicitly               │
│ Separation of Duties     │ No single entity controls a critical process    │
│ Complete Mediation       │ Check authorization on every access             │
│ Open Design              │ Security must not depend on secrecy of design   │
│ Economy of Mechanism     │ Keep security code simple and auditable         │
│ Psychological Accept.    │ Security must not make the system unusable      │
│ Least Common Mechanism   │ Minimize shared resources between components    │
│ Insider Threat Defense   │ Log everything, review access, rotate secrets   │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

---

## Decision Framework: Which Principle Applies?

```
Question you are asking:                          Principle to apply:
───────────────────────────────────────────────────────────────────────
"Can I skip server-side validation?"            -> Defense in Depth (NO)
"Should this service access that database?"     -> Least Privilege
"What happens if the auth service is down?"     -> Fail-Safe Defaults
"Can the developer also approve the deploy?"    -> Separation of Duties
"Do we need auth on internal endpoints?"        -> Complete Mediation (YES)
"Should we build a custom cipher?"              -> Open Design (NO)
"Should we add another auth method?"            -> Economy of Mechanism
"Will users actually use this security flow?"   -> Psychological Acceptability
"Can these services share a DB connection?"     -> Least Common Mechanism
"Do we need to log this admin action?"          -> Insider Threat Defense (YES)
```

---

## Enforcement Checklist

### Defense in Depth
- [ ] Input validated at client, gateway, service, and database layers
- [ ] WAF configured in front of public-facing services
- [ ] Database constraints enforce data integrity independent of application code
- [ ] Network segmentation isolates tiers (web, app, data)

### Least Privilege
- [ ] Each service uses a dedicated database user with minimal grants
- [ ] IAM policies follow least privilege -- no wildcard actions or resources
- [ ] Containers run as non-root with dropped capabilities
- [ ] File permissions restrict access to owner only for sensitive files
- [ ] API tokens are scoped to specific operations

### Fail-Safe Defaults
- [ ] Authorization defaults to deny on error, timeout, or unknown state
- [ ] Firewall rules default to deny all, allow specific
- [ ] Error responses do not leak internal details (stack traces, SQL errors, file paths)
- [ ] New features are disabled by default (feature flags default to off)

### Separation of Duties
- [ ] Code authors cannot approve their own pull requests
- [ ] Production deployments require approval from someone other than the developer
- [ ] Financial operations (refunds, transfers) require dual approval
- [ ] Database migrations require DBA review before production execution

### Complete Mediation
- [ ] Every API endpoint checks both authentication and authorization
- [ ] Authorization is not cached across requests
- [ ] Internal service-to-service calls include authentication tokens
- [ ] Static assets and file downloads enforce access controls

### Open Design
- [ ] No custom cryptographic algorithms -- only published, peer-reviewed standards
- [ ] No security through obscurity (hidden URLs, secret parameters)
- [ ] All secrets stored in a secrets manager, not in code or configuration files
- [ ] Security design documented and reviewed by the team

### Economy of Mechanism
- [ ] Authentication uses a single, well-tested mechanism (not 5 different methods)
- [ ] Security-critical code paths are simple enough to audit in a single review
- [ ] Unused endpoints, features, and ports are removed or disabled
- [ ] Attack surface is minimized -- debug endpoints not exposed in production

### Psychological Acceptability
- [ ] Password policy follows NIST 800-63B (no forced complexity rules or mandatory rotation)
- [ ] MFA uses risk-based triggers, not on every single request
- [ ] Multiple MFA options offered (app, hardware key, backup codes)
- [ ] Security prompts include clear explanations, not cryptic error codes

### Least Common Mechanism
- [ ] Each service has its own database credentials and connection pool
- [ ] Services are isolated in separate network segments or containers
- [ ] Shared file systems and caches are avoided between trust boundaries
- [ ] Third-party dependencies are not shared across security domains

### Insider Threat Defense
- [ ] All privileged operations are logged with actor, action, resource, and timestamp
- [ ] Audit logs are stored externally and are append-only (immutable)
- [ ] Access reviews are conducted quarterly -- unused permissions are revoked
- [ ] Credentials are rotated on a defined schedule (90 days maximum)
- [ ] Anomaly detection alerts on unusual access patterns (off-hours, bulk exports)
