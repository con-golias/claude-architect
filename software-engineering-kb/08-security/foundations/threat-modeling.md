# Threat Modeling

> **Domain:** Security > Foundations > Threat Modeling
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03-10

## What Is Threat Modeling

Threat modeling is the structured process of identifying, analyzing, and prioritizing potential security threats to a system before they become exploitable vulnerabilities. It answers four fundamental questions:

1. **What are we building?** -- Understand the system architecture, data flows, and trust boundaries.
2. **What can go wrong?** -- Enumerate threats systematically using proven frameworks.
3. **What are we going to do about it?** -- Define mitigations, accept risks, or transfer them.
4. **Did we do a good enough job?** -- Validate the model against known attack patterns.

### Why Every Application Needs It

- **Proactive over reactive** -- Finding a design flaw in architecture review costs 10x less than finding it in production.
- **Shared understanding** -- Forces developers, architects, and security teams to agree on what matters.
- **Compliance requirement** -- PCI-DSS, SOC2, ISO 27001, and HIPAA all require documented risk assessments.
- **Attack surface awareness** -- You cannot defend what you have not mapped.

### When to Perform Threat Modeling

```
Phase                    Activity                         Depth
─────────────────────────────────────────────────────────────────
Design Phase             Full threat model from scratch    High
Before Code Review       Verify code matches mitigations   Medium
Before Deployment        Validate no new attack surfaces   Medium
After Major Changes      Incremental threat model update   Medium
Post-Incident            Review model for missed threats   High
Quarterly Review         Reassess risk ratings             Low-Medium
```

---

## STRIDE Model

STRIDE is a mnemonic for six categories of threats, developed at Microsoft. Apply STRIDE to every component in a data flow diagram to systematically identify threats.

```
STRIDE Threat Categories:
┌──────────────────────────────────────────────────────────────┐
│  S - Spoofing Identity      Pretending to be someone else   │
│  T - Tampering with Data    Modifying data in transit/rest  │
│  R - Repudiation            Denying actions were performed  │
│  I - Information Disclosure  Exposing data to unauthorized  │
│  D - Denial of Service      Making system unavailable       │
│  E - Elevation of Privilege  Gaining unauthorized access    │
└──────────────────────────────────────────────────────────────┘
```

### S -- Spoofing Identity

Spoofing occurs when an attacker pretends to be another user, system, or component. The threat targets authentication mechanisms.

**Vulnerable implementation (TypeScript):**

```typescript
// VULNERABLE: Trusting client-supplied user ID without verification
app.get("/api/profile", (req, res) => {
  const userId = req.headers["x-user-id"]; // Client controls this header
  const user = db.getUserById(userId);
  res.json(user);
});
```

**Threat identified:** Any client can set `x-user-id` to any value and access any user profile.

**Secure implementation (TypeScript):**

```typescript
// SECURE: Extract user identity from verified JWT token
app.get("/api/profile", authenticateToken, (req, res) => {
  const userId = req.user.id; // Extracted from verified JWT, not client input
  const user = db.getUserById(userId);
  res.json(user);
});

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies["session_token"];
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}
```

### T -- Tampering with Data

Tampering occurs when an attacker modifies data in transit or at rest without authorization. The threat targets data integrity.

**Vulnerable implementation (Go):**

```go
// VULNERABLE: Accepting price from client-side form data
func handleCheckout(w http.ResponseWriter, r *http.Request) {
    price := r.FormValue("price")       // Client can modify this
    itemID := r.FormValue("item_id")
    amount, _ := strconv.ParseFloat(price, 64)
    chargeCustomer(itemID, amount) // Charges whatever the client sent
}
```

**Threat identified:** An attacker modifies the price field in the form submission to pay less.

**Secure implementation (Go):**

```go
// SECURE: Look up price server-side, never trust client-supplied values
func handleCheckout(w http.ResponseWriter, r *http.Request) {
    itemID := r.FormValue("item_id")
    userID := r.Context().Value("userID").(string)

    item, err := db.GetItem(itemID)
    if err != nil {
        http.Error(w, "Item not found", http.StatusNotFound)
        return
    }

    // Price comes from the database, not the client
    if err := chargeCustomer(userID, item.Price); err != nil {
        http.Error(w, "Payment failed", http.StatusPaymentRequired)
        return
    }
}
```

### R -- Repudiation

Repudiation occurs when a user denies performing an action and the system has no way to prove otherwise. The threat targets audit logging.

**Vulnerable implementation (Python):**

```python
# VULNERABLE: No audit trail for sensitive operations
def transfer_funds(sender_id: str, receiver_id: str, amount: float):
    sender = get_account(sender_id)
    receiver = get_account(receiver_id)
    sender.balance -= amount
    receiver.balance += amount
    db.session.commit()
    # No logging -- user can deny the transfer ever happened
```

**Threat identified:** A user initiates a transfer and later claims they never authorized it. No evidence exists.

**Secure implementation (Python):**

```python
# SECURE: Immutable audit log with cryptographic integrity
import hashlib
import json
from datetime import datetime, timezone

def transfer_funds(sender_id: str, receiver_id: str, amount: float, ip_address: str):
    sender = get_account(sender_id)
    receiver = get_account(receiver_id)

    # Create tamper-evident audit entry BEFORE the action
    audit_entry = {
        "action": "FUND_TRANSFER",
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "amount": amount,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip_address": ip_address,
        "user_agent": request.headers.get("User-Agent"),
    }
    audit_entry["hash"] = hashlib.sha256(
        json.dumps(audit_entry, sort_keys=True).encode()
    ).hexdigest()

    audit_log.append(audit_entry)  # Write to append-only audit store

    sender.balance -= amount
    receiver.balance += amount
    db.session.commit()

    logger.info("Fund transfer completed", extra=audit_entry)
```

### I -- Information Disclosure

Information disclosure occurs when sensitive data is exposed to unauthorized parties. The threat targets confidentiality.

**Vulnerable implementation (TypeScript):**

```typescript
// VULNERABLE: Returning full database record including sensitive fields
app.get("/api/users/:id", async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.params.id } });
  res.json(user);
  // Exposes: password_hash, ssn, internal_notes, api_keys, etc.
});

// VULNERABLE: Detailed error messages in production
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,         // Exposes internal file paths
    query: err.sql,           // Exposes database schema
  });
});
```

**Threat identified:** API responses leak sensitive fields. Error messages expose internal architecture.

**Secure implementation (TypeScript):**

```typescript
// SECURE: Explicit allowlist of fields to return
app.get("/api/users/:id", authenticateToken, async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar_url: true,
      // Explicitly exclude: password_hash, ssn, api_keys
    },
  });
  res.json(user);
});

// SECURE: Generic error messages in production
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorId = crypto.randomUUID();
  logger.error({ errorId, message: err.message, stack: err.stack });

  res.status(500).json({
    error: "An internal error occurred",
    errorId, // Give user a reference ID for support
  });
});
```

### D -- Denial of Service

Denial of service occurs when an attacker makes the system unavailable to legitimate users. The threat targets availability.

**Vulnerable implementation (Go):**

```go
// VULNERABLE: No rate limiting, unbounded request processing
func handleSearch(w http.ResponseWriter, r *http.Request) {
    query := r.URL.Query().Get("q")
    // No limit on query complexity or result size
    results, _ := db.Search(query) // Could return millions of rows
    json.NewEncoder(w).Encode(results)
}
```

**Threat identified:** Attacker sends expensive queries with no rate limit, exhausting CPU and memory.

**Secure implementation (Go):**

```go
// SECURE: Rate limiting, pagination, query timeout
func handleSearch(w http.ResponseWriter, r *http.Request) {
    query := r.URL.Query().Get("q")

    if len(query) > 200 {
        http.Error(w, "Query too long", http.StatusBadRequest)
        return
    }

    // Enforce pagination
    limit := 50
    offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
    if offset < 0 {
        offset = 0
    }

    // Enforce query timeout
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    results, err := db.SearchWithContext(ctx, query, limit, offset)
    if err != nil {
        if errors.Is(err, context.DeadlineExceeded) {
            http.Error(w, "Query timed out", http.StatusGatewayTimeout)
            return
        }
        http.Error(w, "Search failed", http.StatusInternalServerError)
        return
    }
    json.NewEncoder(w).Encode(results)
}
```

### E -- Elevation of Privilege

Elevation of privilege occurs when an attacker gains higher access than authorized. The threat targets authorization mechanisms.

**Vulnerable implementation (Python):**

```python
# VULNERABLE: Client-controlled role assignment
@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.get_json()
    user = User(
        username=data["username"],
        email=data["email"],
        role=data.get("role", "user"),  # Attacker sends {"role": "admin"}
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201
```

**Threat identified:** Attacker includes `"role": "admin"` in registration request to become admin.

**Secure implementation (Python):**

```python
# SECURE: Server-controlled role assignment with explicit allowlist
@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.get_json()

    # Only accept explicitly allowed fields (mass assignment protection)
    allowed_fields = {"username", "email", "password"}
    filtered_data = {k: v for k, v in data.items() if k in allowed_fields}

    user = User(
        username=filtered_data["username"],
        email=filtered_data["email"],
        role="user",  # Always set server-side, never from client input
    )
    user.set_password(filtered_data["password"])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


# Role changes require admin authorization
@app.route("/api/users/<user_id>/role", methods=["PUT"])
@require_role("admin")
def update_user_role(user_id: str):
    data = request.get_json()
    valid_roles = {"user", "moderator", "admin"}
    if data["role"] not in valid_roles:
        return jsonify({"error": "Invalid role"}), 400

    user = User.query.get_or_404(user_id)
    user.role = data["role"]
    db.session.commit()

    audit_log.record("ROLE_CHANGE", actor=current_user.id, target=user_id, new_role=data["role"])
    return jsonify(user.to_dict())
```

---

## PASTA -- Process for Attack Simulation and Threat Analysis

PASTA is a seven-stage, risk-centric threat modeling methodology. It aligns business objectives with technical requirements and focuses on attacker-centric analysis.

```
PASTA 7-Stage Flow:
┌─────────────────────────────────────────────────────────┐
│  Stage 1: Define Objectives                             │
│      Business goals, compliance needs, risk tolerance   │
│                        |                                │
│  Stage 2: Define Technical Scope                        │
│      Architecture, technologies, data flows             │
│                        |                                │
│  Stage 3: Application Decomposition                     │
│      DFDs, trust boundaries, entry points               │
│                        |                                │
│  Stage 4: Threat Analysis                               │
│      Threat intelligence, attacker profiles              │
│                        |                                │
│  Stage 5: Vulnerability Analysis                        │
│      Map CVEs, weaknesses, attack vectors               │
│                        |                                │
│  Stage 6: Attack Modeling                               │
│      Build attack trees, simulate attacks               │
│                        |                                │
│  Stage 7: Risk and Impact Analysis                      │
│      Score risks, prioritize mitigations                │
└─────────────────────────────────────────────────────────┘
```

### PASTA Walkthrough: E-Commerce Platform

**Stage 1 -- Define Objectives:**
- Business goal: Process $10M in annual transactions securely.
- Compliance: PCI-DSS Level 2, GDPR for EU customers.
- Risk tolerance: Zero tolerance for payment data breach; moderate tolerance for availability disruption.

**Stage 2 -- Define Technical Scope:**
- Frontend: React SPA served via CDN.
- Backend: Node.js API, PostgreSQL database, Redis cache.
- Integrations: Stripe payment gateway, SendGrid email, S3 for file storage.
- Infrastructure: AWS ECS, behind ALB with WAF.

**Stage 3 -- Application Decomposition:**
- Trust boundaries: Internet-to-ALB, ALB-to-ECS, ECS-to-RDS, ECS-to-Stripe.
- Data stores: PostgreSQL (user data, orders), Redis (sessions, cart), S3 (product images).
- Entry points: Public API endpoints, admin panel, webhook receivers.
- Sensitive data: Credit card tokens, PII, session tokens, API keys.

**Stage 4 -- Threat Analysis:**
- Threat actors: Script kiddies (automated scanners), organized crime (payment fraud), insiders (rogue employee), competitors (scraping).
- Threat intelligence: Review OWASP Top 10, recent e-commerce breaches, CVE feeds for Node.js and PostgreSQL.

**Stage 5 -- Vulnerability Analysis:**
- SQL injection in search queries (parameterized queries not enforced).
- IDOR on order detail endpoint (`/api/orders/:id` without ownership check).
- Missing rate limiting on login endpoint (credential stuffing).
- S3 bucket policy allows public listing.

**Stage 6 -- Attack Modeling:**
- Attack tree for payment fraud (see Attack Trees section below).
- Simulate credential stuffing attack against login endpoint.
- Test IDOR by accessing other users' order details.

**Stage 7 -- Risk and Impact Analysis:**
- Payment data breach: DREAD score 42/50 -- critical, mitigate immediately.
- IDOR on orders: DREAD score 30/50 -- high, mitigate within sprint.
- Public S3 bucket: DREAD score 22/50 -- medium, mitigate within month.

---

## DREAD Risk Assessment

DREAD is a quantitative risk scoring model. Each category is rated 1-10 and summed for a total risk score.

```
DREAD Scoring Criteria:
┌───────────────────────────────────────────────────────────────────┐
│  D - Damage Potential     How much damage if exploited?          │
│      1 = minimal          5 = significant data loss              │
│      10 = complete system compromise                             │
│                                                                   │
│  R - Reproducibility      How easy to reproduce the attack?      │
│      1 = very difficult   5 = sometimes reproducible             │
│      10 = always reproducible, no special conditions             │
│                                                                   │
│  E - Exploitability       How much skill/effort to exploit?      │
│      1 = expert + custom tools   5 = moderate skill              │
│      10 = automated, no skill needed                             │
│                                                                   │
│  A - Affected Users       How many users are impacted?           │
│      1 = single user      5 = subset of users                    │
│      10 = all users                                              │
│                                                                   │
│  D - Discoverability      How easy to discover the flaw?         │
│      1 = very hidden      5 = requires some effort               │
│      10 = obvious, publicly visible                              │
└───────────────────────────────────────────────────────────────────┘

Total score range: 5-50
  5-15  = Low risk       Backlog, fix when convenient
 16-30  = Medium risk    Fix within next release cycle
 31-40  = High risk      Fix within current sprint
 41-50  = Critical risk  Fix immediately, consider hotfix
```

### DREAD Scoring Example: SQL Injection in Search

```
Threat: SQL injection in product search endpoint
─────────────────────────────────────────────────
  Damage Potential:    9   Full database read/write access
  Reproducibility:    10   100% reproducible with crafted input
  Exploitability:      8   Automated tools (sqlmap) available
  Affected Users:     10   All users' data is exposed
  Discoverability:     7   Discovered by fuzz testing or manual probing

  Total DREAD Score:  44/50 = CRITICAL
  Action: Fix immediately. Deploy WAF rule as temporary mitigation.
```

### DREAD Scoring Example: Missing CSRF Token on Profile Update

```
Threat: Cross-Site Request Forgery on profile settings
─────────────────────────────────────────────────
  Damage Potential:    4   Can change user email/name, not password
  Reproducibility:     8   Requires user to visit malicious page
  Exploitability:      6   Requires crafting HTML form and social engineering
  Affected Users:      5   Affects individual targeted users
  Discoverability:     6   Found by inspecting form for token presence

  Total DREAD Score:  29/50 = MEDIUM
  Action: Fix within next release cycle. Add CSRF tokens to all state-changing forms.
```

### DREAD Scoring Example: Verbose Error Messages

```
Threat: Stack traces and SQL errors exposed in production API
─────────────────────────────────────────────────
  Damage Potential:    3   Information disclosure aids further attacks
  Reproducibility:    10   Trigger any unhandled error
  Exploitability:      9   No skill required, just cause an error
  Affected Users:      2   Indirect impact, aids targeted attacks
  Discoverability:    10   Visible in any error response

  Total DREAD Score:  34/50 = HIGH
  Action: Fix within current sprint. Replace with generic error responses.
```

---

## Attack Trees

Attack trees decompose a high-level attack goal into sub-goals, showing all possible paths an attacker can take. Each leaf node represents a concrete attack action.

### Attack Tree: Account Takeover

```
[GOAL] Take over user account
├── [OR] Steal credentials
│   ├── [AND] Credential stuffing
│   │   ├── Obtain breached credential database
│   │   └── Automate login attempts (no rate limiting)
│   ├── [AND] Phishing
│   │   ├── Create fake login page
│   │   └── Send phishing email to target
│   ├── Keylogger malware on user device
│   └── Shoulder surfing / physical observation
│
├── [OR] Bypass authentication
│   ├── [AND] Session hijacking
│   │   ├── Steal session cookie (XSS vulnerability)
│   │   └── Replay stolen session token
│   ├── [AND] Password reset abuse
│   │   ├── Enumerate valid email addresses
│   │   └── Exploit weak reset token generation (predictable tokens)
│   ├── SQL injection in login form
│   └── Authentication logic flaw (type juggling, null password)
│
├── [OR] Exploit account recovery
│   ├── [AND] Security question bypass
│   │   ├── Research target on social media
│   │   └── Answer security questions from public information
│   └── [AND] SIM swap attack
│       ├── Social engineer mobile carrier
│       └── Intercept SMS-based 2FA code
│
└── [OR] Exploit trusted session
    ├── Steal remember-me cookie from shared computer
    └── Access active session on unlocked device
```

### Attack Tree: Data Exfiltration

```
[GOAL] Extract sensitive data from application
├── [OR] Direct database access
│   ├── SQL injection (search, filters, sorting parameters)
│   ├── [AND] Compromised database credentials
│   │   ├── Credentials in source code / config files
│   │   └── Credentials in environment variables exposed via SSRF
│   └── Unprotected database port exposed to internet
│
├── [OR] API-based extraction
│   ├── IDOR on data endpoints (iterate over IDs)
│   ├── GraphQL introspection + over-fetching
│   ├── [AND] Broken access control
│   │   ├── Identify admin-only endpoints
│   │   └── Access without admin role check
│   └── Mass assignment to gain elevated response data
│
├── [OR] Side-channel extraction
│   ├── Timing attacks on search/filter responses
│   ├── Error-based information disclosure
│   └── DNS exfiltration via SSRF
│
└── [OR] Supply chain extraction
    ├── Compromised npm/pip dependency phones home data
    ├── Malicious browser extension intercepts API responses
    └── Compromised CI/CD pipeline leaks secrets
```

### Attack Tree: Privilege Escalation

```
[GOAL] Gain admin-level access
├── [OR] Horizontal privilege escalation
│   ├── IDOR to access other users' resources
│   ├── JWT manipulation (change user_id in payload)
│   └── Parameter pollution to override user context
│
├── [OR] Vertical privilege escalation
│   ├── [AND] Role manipulation
│   │   ├── Mass assignment: POST {"role": "admin"}
│   │   └── No server-side role validation
│   ├── [AND] Forced browsing to admin routes
│   │   ├── Discover /admin, /internal, /debug endpoints
│   │   └── No authorization middleware on admin routes
│   ├── JWT secret brute-force (weak secret like "secret123")
│   └── Exploit default admin credentials
│
└── [OR] Infrastructure escalation
    ├── [AND] Container escape
    │   ├── Exploit kernel vulnerability from container
    │   └── Access host filesystem / other containers
    ├── [AND] SSRF to cloud metadata
    │   ├── Exploit SSRF vulnerability
    │   └── Access 169.254.169.254 for IAM credentials
    └── Compromise CI/CD pipeline for deployment access
```

---

## Data Flow Diagrams (DFDs)

Data Flow Diagrams map how data moves through a system. They are the foundation of every threat model. Mark trust boundaries to identify where threats are most likely.

### DFD Elements

```
DFD Notation:
┌────────────────────────────────────────────────────────┐
│  [  External Entity  ]   Users, third-party services   │
│  (  Process          )   Application logic, services   │
│  [[  Data Store     ]]   Databases, caches, files      │
│  ------>                  Data flow (direction matters) │
│  ════════════════════     Trust boundary                │
└────────────────────────────────────────────────────────┘
```

### DFD: Typical Web Application

```
                    TRUST BOUNDARY: Internet
═══════════════════════════════════════════════════════════
                         |
     [User Browser] --HTTPS--> (Load Balancer / WAF)
                                    |
                    TRUST BOUNDARY: DMZ to Application
     ═══════════════════════════════════════════════════
                                    |
                              (API Gateway)
                               /    |    \
                              /     |     \
                    (Auth    (Order  (Product
                    Service) Service) Service)
                       |        |        |
                    TRUST BOUNDARY: App to Data
     ═══════════════════════════════════════════════════
                       |        |        |
                   [[User   [[Order  [[Product
                     DB]]     DB]]     DB]]
                       |
                   [[Redis
                    Session
                    Cache]]

     External Integrations (across trust boundary):
     ═══════════════════════════════════════════════════
     (Auth Service) ----> [OAuth Provider] (Google, GitHub)
     (Order Service) ---> [Payment Gateway] (Stripe)
     (Product Service) -> [CDN] (CloudFront)
     (Order Service) ---> [Email Service] (SendGrid)
```

### Applying STRIDE to DFD Components

For each data flow crossing a trust boundary, apply STRIDE:

```
Data Flow: User Browser --> API Gateway (crosses Internet boundary)
─────────────────────────────────────────────────────────────────
  S  Spoofing:      Attacker impersonates legitimate user
     Mitigation:    JWT/session tokens, mTLS for service-to-service

  T  Tampering:     Man-in-the-middle modifies requests
     Mitigation:    TLS 1.3 enforced, HSTS, certificate pinning

  R  Repudiation:   User denies making a request
     Mitigation:    Request logging with user ID, IP, timestamp

  I  Info Disclosure: TLS downgrade exposes request data
     Mitigation:    Enforce TLS 1.2+, disable weak cipher suites

  D  DoS:           Flood API gateway with requests
     Mitigation:    Rate limiting, WAF rules, CDN absorption

  E  EoP:           Exploit API gateway vulnerability for server access
     Mitigation:    Keep gateway patched, run with least privilege
```

```
Data Flow: Order Service --> Payment Gateway (crosses trust boundary)
─────────────────────────────────────────────────────────────────
  S  Spoofing:      Attacker sends fake payment confirmations
     Mitigation:    Verify webhook signatures (Stripe signing secret)

  T  Tampering:     Modify payment amount in transit
     Mitigation:    Server-side price lookup, verify amount matches

  R  Repudiation:   Dispute about payment processing
     Mitigation:    Log payment gateway response with transaction ID

  I  Info Disclosure: API keys leaked in logs or error messages
     Mitigation:    Mask secrets in logs, use vault for key storage

  D  DoS:           Payment gateway becomes unavailable
     Mitigation:    Circuit breaker, retry with backoff, fallback queue

  E  EoP:           Compromised API key used for unauthorized refunds
     Mitigation:    Scope API keys (restrict to charges only), rotate keys
```

---

## MITRE ATT&CK Framework

MITRE ATT&CK (Adversarial Tactics, Techniques, and Common Knowledge) is a knowledge base of adversary tactics and techniques based on real-world observations. Application security teams should understand the tactics most relevant to web applications.

### Relevant ATT&CK Tactics for Application Security

```
Tactic                  Application Security Relevance
──────────────────────────────────────────────────────────────────
Initial Access          Exploit public-facing app, supply chain compromise,
                        phishing for credentials, valid accounts

Execution               Server-side code injection, command injection,
                        deserialization exploits

Persistence             Web shell upload, implant in CI/CD pipeline,
                        backdoor in dependency, create rogue admin account

Privilege Escalation    Exploit authorization flaw, abuse sudo/SUID,
                        token manipulation, access cloud metadata

Defense Evasion         Obfuscate malicious payload, disable logging,
                        clear audit trails, use legitimate tools (LOLBins)

Credential Access       Brute force, credential dumping, steal tokens/cookies,
                        man-in-the-middle, input capture (keylogger)

Discovery               Enumerate APIs, directory listing, error-based recon,
                        GraphQL introspection, Swagger/OpenAPI exposure

Lateral Movement        Use stolen tokens for service-to-service calls,
                        pivot via SSRF, exploit shared database credentials

Collection              Scrape data from API, export database via injection,
                        intercept file uploads

Exfiltration            Exfiltrate via DNS, HTTP outbound channels,
                        exfil through logs or error messages

Impact                  Data destruction, ransomware, defacement,
                        resource hijacking (cryptomining)
```

### Mapping ATT&CK to Mitigations

```
ATT&CK Technique                  Mitigation
──────────────────────────────────────────────────────────────────
T1190 Exploit Public App           WAF, input validation, patch management
T1059 Command Injection            Parameterized commands, no shell exec
T1078 Valid Accounts               MFA, credential rotation, anomaly detection
T1098 Account Manipulation         Audit role changes, require approval workflow
T1548 Abuse Elevation Mechanism    Least privilege, RBAC, remove default creds
T1555 Credentials from Stores      Use secrets manager, encrypt at rest
T1071 Application Layer Protocol   Inspect outbound traffic, egress filtering
T1505 Server Software Component    File integrity monitoring, read-only filesystem
T1195 Supply Chain Compromise      Dependency scanning, lock files, code review
T1110 Brute Force                  Rate limiting, account lockout, CAPTCHA
```

---

## Threat Modeling Tools

### Microsoft Threat Modeling Tool

- Free desktop application for Windows.
- Uses DFD-based approach with STRIDE-per-element analysis.
- Provides built-in templates for common architectures (web app, Azure, IoT).
- Auto-generates threats based on DFD elements and data flows.
- Best for: Teams new to threat modeling, Windows-centric environments.

### OWASP Threat Dragon

- Free, open-source, cross-platform (web and desktop).
- Supports STRIDE and LINDDUN (privacy threats) methodologies.
- DFD-based with manual threat entry and risk scoring.
- Integrates with GitHub for storing threat model files.
- Best for: Open-source projects, cross-platform teams.

### IriusRisk

- Commercial platform with extensive threat library.
- Questionnaire-driven approach for automated threat identification.
- Integrates with Jira, Azure DevOps, and CI/CD pipelines.
- Generates countermeasure recommendations with compliance mapping (PCI-DSS, HIPAA, SOC2).
- Best for: Enterprise teams needing compliance automation.

### Threagile (Threat Modeling as Code)

- Open-source, YAML-based threat model definition.
- Generates threat models from code, produces risk reports.
- Fits naturally into GitOps and infrastructure-as-code workflows.
- Can run in CI/CD pipelines for continuous threat model validation.
- Best for: DevSecOps teams practicing everything-as-code.

```yaml
# Threagile example: defining a technical asset
technical_assets:
  api-gateway:
    type: process
    usage: business
    technologies:
      - nginx
    internet: true
    machine: container
    encryption: none
    data_assets_processed:
      - user-credentials
      - session-tokens
    communication_links:
      auth-service:
        target: auth-service
        protocol: HTTPS
        authentication: token
```

---

## Threat Modeling in Agile and DevOps

Traditional threat modeling as a one-time exercise does not fit iterative development. Integrate threat modeling into the development lifecycle with these practices.

### Incremental Threat Modeling

Do not redo the entire threat model every sprint. Instead, update it when:

- A new external integration is added.
- A trust boundary changes (new microservice, API exposure).
- A new data type is collected or stored.
- Authentication or authorization logic changes.
- A new deployment environment is introduced.

### Threat Modeling as User Stories

```
As a [threat actor],
I want to [attack action],
So that I can [impact/goal].

Example:
As a malicious user,
I want to enumerate valid email addresses via the password reset endpoint,
So that I can build a list of targets for credential stuffing.

Acceptance criteria for mitigation:
- Password reset returns the same response for valid and invalid emails.
- Password reset is rate-limited to 5 requests per minute per IP.
- Logging captures reset requests with IP for anomaly detection.
```

### Threat Modeling as Code

Store threat models alongside application code in version control:

```
project-root/
  src/
  tests/
  docs/
    threat-model/
      threat-model.yaml        # Machine-readable threat model
      data-flow-diagram.md     # DFD in markdown/mermaid
      stride-analysis.md       # STRIDE analysis per component
      risk-register.csv        # All identified risks with scores
      mitigations.md           # Planned and implemented mitigations
```

### Automating Threat Model Updates in CI/CD

```yaml
# GitHub Actions: validate threat model on architecture changes
name: Threat Model Validation
on:
  pull_request:
    paths:
      - 'src/api/**'
      - 'infrastructure/**'
      - 'docker-compose.yml'
      - 'docs/threat-model/**'

jobs:
  threat-model-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Threagile analysis
        run: |
          docker run --rm -v $(pwd):/app threagile/threagile \
            -model /app/docs/threat-model/threat-model.yaml \
            -output /app/docs/threat-model/report

      - name: Check for high-risk findings
        run: |
          HIGH_RISKS=$(cat docs/threat-model/report/risks.json | \
            jq '[.[] | select(.severity == "critical" or .severity == "high")] | length')
          if [ "$HIGH_RISKS" -gt 0 ]; then
            echo "FAIL: $HIGH_RISKS high/critical risks identified"
            cat docs/threat-model/report/risks.json | \
              jq '.[] | select(.severity == "critical" or .severity == "high")'
            exit 1
          fi

      - name: Verify threat model is up to date
        run: |
          LAST_ARCH_CHANGE=$(git log -1 --format="%ct" -- src/api/ infrastructure/)
          LAST_TM_UPDATE=$(git log -1 --format="%ct" -- docs/threat-model/)
          if [ "$LAST_ARCH_CHANGE" -gt "$LAST_TM_UPDATE" ]; then
            echo "WARNING: Architecture changed after last threat model update"
            echo "Please review and update the threat model"
          fi
```

### Sprint-Level Threat Modeling Checklist

```
For each sprint containing security-relevant changes:
  [ ] Identify new/changed trust boundaries
  [ ] Apply STRIDE to new/changed data flows
  [ ] Score new threats with DREAD
  [ ] Add mitigations as acceptance criteria on user stories
  [ ] Update risk register with new findings
  [ ] Review mitigations in code review
  [ ] Validate mitigations in security testing
```

---

## Common Threat Scenarios

### 1. Authentication Bypass

**Scenario:** Application uses JWT for authentication but does not validate the algorithm.

**Vulnerable implementation (TypeScript):**

```typescript
// VULNERABLE: Accepts any algorithm, including "none"
import jwt from "jsonwebtoken";

function verifyToken(token: string): any {
  return jwt.verify(token, publicKey); // Does not enforce algorithm
}

// Attacker crafts a token with "alg": "none" and removes the signature
// The library accepts the token as valid without any cryptographic check
```

**Secure implementation (TypeScript):**

```typescript
// SECURE: Enforce specific algorithm, reject "none"
import jwt from "jsonwebtoken";

function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],       // Only accept RS256
    issuer: "https://auth.example.com",
    audience: "api.example.com",
    clockTolerance: 30,          // 30 seconds clock skew tolerance
  }) as JwtPayload;
}
```

### 2. Authorization Flaws (IDOR)

**Scenario:** API endpoint allows accessing resources by ID without verifying ownership.

**Vulnerable implementation (Go):**

```go
// VULNERABLE: No ownership check -- any authenticated user can view any order
func getOrder(w http.ResponseWriter, r *http.Request) {
    orderID := chi.URLParam(r, "orderID")
    order, err := db.GetOrder(orderID)
    if err != nil {
        http.Error(w, "Not found", 404)
        return
    }
    json.NewEncoder(w).Encode(order) // Returns order regardless of who owns it
}
```

**Secure implementation (Go):**

```go
// SECURE: Verify the authenticated user owns the requested resource
func getOrder(w http.ResponseWriter, r *http.Request) {
    orderID := chi.URLParam(r, "orderID")
    userID := r.Context().Value("userID").(string)

    order, err := db.GetOrder(orderID)
    if err != nil {
        http.Error(w, "Not found", 404)
        return
    }

    // Ownership check: user can only access their own orders
    if order.UserID != userID {
        http.Error(w, "Not found", 404) // Return 404, not 403 (avoid enumeration)
        return
    }

    json.NewEncoder(w).Encode(order)
}
```

### 3. Injection Attacks

**Scenario:** Application constructs database queries using string concatenation.

**Vulnerable implementation (Python):**

```python
# VULNERABLE: String concatenation allows SQL injection
def get_user_by_email(email: str):
    query = f"SELECT * FROM users WHERE email = '{email}'"
    # Attacker sends: ' OR '1'='1' --
    # Resulting query: SELECT * FROM users WHERE email = '' OR '1'='1' --'
    return db.execute(query).fetchone()
```

**Secure implementation (Python):**

```python
# SECURE: Parameterized queries prevent SQL injection
def get_user_by_email(email: str):
    query = "SELECT * FROM users WHERE email = %s"
    return db.execute(query, (email,)).fetchone()

# With SQLAlchemy ORM (inherently parameterized):
def get_user_by_email(email: str) -> User | None:
    return db.session.query(User).filter(User.email == email).first()
```

### 4. Data Leakage

**Scenario:** Application logs contain sensitive information, exposed through log aggregation.

**Vulnerable implementation (TypeScript):**

```typescript
// VULNERABLE: Logging sensitive data in plain text
logger.info("User login attempt", {
  email: user.email,
  password: req.body.password,      // NEVER log passwords
  creditCard: user.creditCardNumber, // NEVER log payment data
  ssn: user.ssn,                     // NEVER log PII
});

// VULNERABLE: Including secrets in error context
logger.error("Payment failed", {
  stripeKey: process.env.STRIPE_SECRET_KEY, // Leaked to log aggregator
  request: JSON.stringify(req.body),         // May contain sensitive fields
});
```

**Secure implementation (TypeScript):**

```typescript
// SECURE: Redact sensitive fields, log only what is necessary
const sensitiveFields = ["password", "creditCard", "ssn", "token", "secret"];

function redactSensitive(obj: Record<string, any>): Record<string, any> {
  const redacted = { ...obj };
  for (const key of Object.keys(redacted)) {
    if (sensitiveFields.some((f) => key.toLowerCase().includes(f))) {
      redacted[key] = "[REDACTED]";
    }
  }
  return redacted;
}

logger.info("User login attempt", {
  email: user.email,
  ip: req.ip,
  userAgent: req.headers["user-agent"],
  // No password, no PII, no secrets
});

logger.error("Payment failed", {
  userId: user.id,
  orderId: order.id,
  errorCode: paymentError.code,
  // No API keys, no full request bodies
});
```

### 5. Supply Chain Compromise

**Scenario:** A project dependency is compromised by an attacker who publishes a malicious version.

**Threat analysis:**

```
Supply Chain Attack Vectors:
┌────────────────────────────────────────────────────────────────┐
│  1. Typosquatting: "loddash" instead of "lodash"              │
│  2. Dependency confusion: public package shadows private one   │
│  3. Maintainer account compromise: publish malicious version   │
│  4. Build script injection: postinstall runs arbitrary code    │
│  5. Transitive dependency: compromise a sub-dependency        │
│  6. Lockfile manipulation: PR changes lockfile to evil version │
└────────────────────────────────────────────────────────────────┘
```

**Mitigations:**

```bash
# Lock dependencies to exact versions
npm config set save-exact true

# Audit dependencies for known vulnerabilities
npm audit --audit-level=high

# Use lockfile and verify integrity
npm ci  # Uses package-lock.json, fails on mismatch

# Pin dependencies with integrity hashes (package-lock.json does this)
# Review lockfile changes in code review

# Use tools for continuous monitoring
# - Snyk, Dependabot, Socket.dev, npm audit
```

```yaml
# GitHub Actions: Block PRs that introduce vulnerable dependencies
name: Dependency Security
on: pull_request
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm audit --audit-level=high
      - name: Check for lockfile changes
        run: |
          if git diff --name-only origin/main | grep -q "package-lock.json"; then
            echo "Lockfile changed -- review dependency changes carefully"
            npm diff --diff=origin/main
          fi
```

---

## Best Practices

1. **ALWAYS start with a Data Flow Diagram** -- Map the system before identifying threats. You cannot model threats for a system you have not diagrammed.
2. **ALWAYS apply STRIDE to every trust boundary crossing** -- Every data flow crossing a trust boundary is a potential attack surface.
3. **ALWAYS score threats quantitatively** -- Use DREAD or CVSS to prioritize. Gut-feel prioritization leads to misallocation of security effort.
4. **ALWAYS store threat models in version control** -- Treat the threat model as a living document that evolves with the codebase.
5. **ALWAYS include developers in threat modeling sessions** -- Security teams alone miss implementation-specific threats. Developers know how the code actually works.
6. **ALWAYS validate mitigations with tests** -- Every identified threat should have a corresponding test proving the mitigation works (unit test, integration test, or penetration test).
7. **ALWAYS update the threat model when architecture changes** -- New services, new integrations, new data types all require threat model updates.
8. **NEVER assume a component is trusted without verification** -- Internal services, databases, and caches can all be compromised. Apply defense in depth.
9. **NEVER treat threat modeling as a one-time activity** -- Schedule quarterly reviews at minimum. Threats evolve, new attack techniques emerge, and the system changes.
10. **NEVER skip threat modeling for "small" changes** -- An innocent-looking feature (adding an export button, a new search field) can introduce critical vulnerabilities.

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Threat model in a drawer | Document created once, never referenced or updated | Store in repo, link to sprint planning, require updates with architecture changes |
| Security by architecture diagram | Beautiful diagram but no actual threat analysis performed | Apply STRIDE systematically to every DFD element and trust boundary |
| Only modeling external threats | Ignoring insider threats, supply chain, and configuration errors | Include all threat actor types: external, insider, partner, automated |
| Boiling the ocean | Trying to model the entire system at once, resulting in analysis paralysis | Start with the highest-risk data flows, iterate outward incrementally |
| Copy-paste threat lists | Applying generic threat lists without mapping to specific system components | Each threat must map to a specific component, data flow, or trust boundary |
| No follow-through on mitigations | Threats identified but no tickets created, no code changes made, no tests written | Create actionable work items for every high/critical threat, track to completion |
| Ignoring data classification | Treating all data with equal sensitivity, resulting in over- or under-protection | Classify data (public, internal, confidential, restricted) and apply controls accordingly |
| Excluding operational threats | Only modeling application-layer threats, missing infrastructure and deployment threats | Include CI/CD pipeline security, container security, cloud configuration, and secrets management |

---

## Enforcement Checklist

- [ ] Data Flow Diagram exists and covers all major system components
- [ ] Trust boundaries are explicitly identified between all zones (internet, DMZ, application, data)
- [ ] STRIDE analysis completed for every data flow crossing a trust boundary
- [ ] All identified threats scored with DREAD (or CVSS) and recorded in risk register
- [ ] High and critical risks have mitigation plans with assigned owners and deadlines
- [ ] Mitigations are validated with automated tests (security unit tests, integration tests)
- [ ] Threat model is stored in version control alongside application code
- [ ] Threat model reviewed and updated when architecture changes (new service, new integration, new data type)
- [ ] Threat modeling session conducted with both developers and security team members
- [ ] Attack trees created for highest-risk scenarios (account takeover, data exfiltration, privilege escalation)
- [ ] Supply chain threats assessed (dependency audit, lockfile integrity, build pipeline security)
- [ ] Common threat scenarios validated (authentication bypass, IDOR, injection, data leakage)
- [ ] Threat model linked to compliance requirements (PCI-DSS, SOC2, HIPAA, GDPR) where applicable
- [ ] Quarterly review of threat model scheduled and tracked
- [ ] Incident response plan references threat model for post-incident analysis

---

## References

- Microsoft STRIDE documentation: https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats
- OWASP Threat Modeling: https://owasp.org/www-community/Threat_Modeling
- MITRE ATT&CK Framework: https://attack.mitre.org/
- PASTA Threat Modeling: https://owasp.org/www-pdf-archive/AppSecEU2012_PASTA.pdf
- Threagile (as-code): https://threagile.io/
- OWASP Threat Dragon: https://owasp.org/www-project-threat-dragon/
- Adam Shostack, "Threat Modeling: Designing for Security" (Wiley, 2014)
