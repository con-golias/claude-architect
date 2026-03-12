# API Security Fundamentals

Category: Application Security / API Security
Severity: Critical
Last Updated: 2025-12
Tags: owasp, api, authentication, authorization, top-10

---

## Overview

APIs are the primary attack surface of modern applications. Unlike traditional web applications where a browser mediates interaction, APIs expose business logic directly to any HTTP client. The OWASP API Security Top 10 (2023 edition) enumerates the most critical risks specific to APIs. Every engineering team must understand and mitigate each of these risks before deploying an API to production.

This guide covers every item in the OWASP API Security Top 10 2023, API authentication pattern comparisons, and API versioning security.

---

## OWASP API Security Top 10 (2023)

### API1:2023 -- Broken Object-Level Authorization (BOLA)

**Description**: BOLA occurs when an API endpoint allows a caller to access or modify objects belonging to other users by manipulating object identifiers in the request. This is the most prevalent and dangerous API vulnerability.

**Attack Scenario**: An attacker discovers that `GET /api/orders/1234` returns their order. They change the ID to `1235` and access another user's order.

**Vulnerable Code (TypeScript)**:

```typescript
// VULNERABLE: No ownership check
app.get('/api/orders/:id', async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order); // Anyone can access any order
});
```

**Secure Code (TypeScript)**:

```typescript
// SECURE: Enforce ownership at the data layer
app.get('/api/orders/:id', authenticate, async (req, res) => {
  const order = await db.orders.findOne({
    _id: req.params.id,
    userId: req.user.id, // Scoped to authenticated user
  });
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});
```

**Prevention**:
- Include the authenticated user's identity in every data query.
- Use UUIDs instead of sequential integer IDs to reduce predictability.
- Implement authorization checks as middleware or data-layer scoping, never in controllers alone.
- Write integration tests that verify cross-user access is denied.

---

### API2:2023 -- Broken Authentication

**Description**: Authentication mechanisms are incorrectly implemented, allowing attackers to compromise tokens, keys, or passwords. Weak token generation, missing token validation, or credential stuffing without protections all fall under this category.

**Attack Scenario**: An API accepts JWT tokens but does not validate the signature, allowing an attacker to forge tokens with arbitrary claims.

**Vulnerable Code (Go)**:

```go
// VULNERABLE: Parsing JWT without signature verification
func handler(w http.ResponseWriter, r *http.Request) {
    tokenString := r.Header.Get("Authorization")[7:]
    // Parsing without validation -- accepts any token
    token, _ := jwt.Parse(tokenString, nil)
    claims := token.Claims.(jwt.MapClaims)
    userID := claims["sub"].(string)
    // proceed with userID...
}
```

**Secure Code (Go)**:

```go
// SECURE: Validate signature with known key
func handler(w http.ResponseWriter, r *http.Request) {
    tokenString := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return []byte(os.Getenv("JWT_SECRET")), nil
    })
    if err != nil || !token.Valid {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        http.Error(w, "Invalid claims", http.StatusUnauthorized)
        return
    }
    // Verify expiration
    if !claims.VerifyExpiresAt(time.Now().Unix(), true) {
        http.Error(w, "Token expired", http.StatusUnauthorized)
        return
    }
    userID := claims["sub"].(string)
    // proceed with validated userID
}
```

**Prevention**:
- Always validate token signatures with a known, securely stored key.
- Enforce token expiration (exp claim).
- Use asymmetric signing (RS256/ES256) for distributed systems.
- Implement rate limiting on authentication endpoints.
- Require multi-factor authentication for sensitive operations.

---

### API3:2023 -- Broken Object Property Level Authorization

**Description**: The API exposes object properties that the user should not be able to read (excessive data exposure) or allows the user to set properties they should not modify (mass assignment).

**Attack Scenario**: A user update endpoint accepts any JSON body, and an attacker sets `{"role": "admin"}` in the payload.

**Vulnerable Code (Python)**:

```python
# VULNERABLE: Mass assignment -- accepts all fields
@app.put("/users/{user_id}")
async def update_user(user_id: str, body: dict, current_user=Depends(get_current_user)):
    if user_id != current_user.id:
        raise HTTPException(status_code=403)
    await db.users.update_one({"_id": user_id}, {"$set": body})  # Any field!
    return {"status": "updated"}
```

**Secure Code (Python)**:

```python
# SECURE: Explicit allowlisted fields with Pydantic model
class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    # role, is_admin, etc. are NOT in this model

@app.put("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UserUpdateRequest,
    current_user=Depends(get_current_user),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403)
    update_data = body.dict(exclude_unset=True)
    await db.users.update_one({"_id": user_id}, {"$set": update_data})
    return {"status": "updated"}
```

**Prevention**:
- Define explicit input schemas that allowlist accepted fields.
- Use separate DTOs for read vs. write operations.
- Never pass raw request bodies to database operations.
- Filter response objects to exclude sensitive fields (internal IDs, hashed passwords, roles for non-admins).

---

### API4:2023 -- Unrestricted Resource Consumption

**Description**: The API does not limit the amount of resources a single request or user can consume, leading to denial-of-service, excessive billing, or resource exhaustion.

**Attack Scenario**: An attacker sends `GET /api/users?page_size=1000000` to dump the entire database or sends thousands of concurrent requests to exhaust server resources.

**Vulnerable Code (TypeScript)**:

```typescript
// VULNERABLE: No limit on page size
app.get('/api/users', async (req, res) => {
  const pageSize = parseInt(req.query.page_size as string) || 100;
  const users = await db.users.find().limit(pageSize).toArray();
  res.json(users);
});
```

**Secure Code (TypeScript)**:

```typescript
// SECURE: Enforce maximum page size and timeout
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const QUERY_TIMEOUT_MS = 5000;

app.get('/api/users', authenticate, async (req, res) => {
  const requested = parseInt(req.query.page_size as string) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const skip = (page - 1) * pageSize;

  const users = await db.users
    .find()
    .skip(skip)
    .limit(pageSize)
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .toArray();

  res.json({
    data: users,
    pagination: { page, pageSize, hasMore: users.length === pageSize },
  });
});
```

**Prevention**:
- Enforce maximum page sizes, request body sizes, and upload sizes.
- Set query timeouts at the database driver level.
- Implement rate limiting per user, per IP, and per endpoint.
- Use API quotas to cap total usage over time.
- Monitor and alert on abnormal resource consumption patterns.

---

### API5:2023 -- Broken Function Level Authorization

**Description**: The API fails to enforce proper authorization on administrative or privileged functions. Regular users can call admin endpoints.

**Attack Scenario**: An attacker discovers that `DELETE /api/admin/users/42` is accessible to any authenticated user, not just administrators.

**Vulnerable Code (Go)**:

```go
// VULNERABLE: No role check on admin endpoint
mux.HandleFunc("DELETE /api/admin/users/{id}", func(w http.ResponseWriter, r *http.Request) {
    userID := r.PathValue("id")
    err := db.DeleteUser(userID)
    if err != nil {
        http.Error(w, "Failed", http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusNoContent)
})
```

**Secure Code (Go)**:

```go
// SECURE: Role-based middleware for admin routes
func requireRole(role string, next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil || user.Role != role {
            http.Error(w, "Forbidden", http.StatusForbidden)
            return
        }
        next(w, r)
    }
}

mux.HandleFunc("DELETE /api/admin/users/{id}",
    requireRole("admin", func(w http.ResponseWriter, r *http.Request) {
        userID := r.PathValue("id")
        err := db.DeleteUser(userID)
        if err != nil {
            http.Error(w, "Failed", http.StatusInternalServerError)
            return
        }
        w.WriteHeader(http.StatusNoContent)
    }),
)
```

**Prevention**:
- Implement role-based or attribute-based access control as middleware.
- Group admin endpoints under a separate prefix with shared authorization middleware.
- Deny by default: require explicit authorization for every endpoint.
- Review and test authorization on every route during security audits.

---

### API6:2023 -- Unrestricted Access to Sensitive Business Flows

**Description**: The API exposes business flows (purchasing, account creation, content posting) without considering how automated access could harm the business.

**Attack Scenario**: A bot calls the ticket-purchase API thousands of times to scalp all available tickets before real users can buy them.

**Vulnerable Code (Python)**:

```python
# VULNERABLE: No bot protection on purchase flow
@app.post("/api/tickets/purchase")
async def purchase_ticket(body: PurchaseRequest, user=Depends(get_current_user)):
    ticket = await reserve_ticket(body.event_id, user.id)
    charge = await payment.charge(user.payment_method, ticket.price)
    return {"ticket_id": ticket.id, "confirmation": charge.id}
```

**Secure Code (Python)**:

```python
# SECURE: Multi-layered bot protection
@app.post("/api/tickets/purchase")
@rate_limit(max_requests=3, window_seconds=60, key_func=lambda r: r.user.id)
async def purchase_ticket(
    body: PurchaseRequest,
    user=Depends(get_current_user),
    captcha_token: str = Header(..., alias="X-Captcha-Token"),
    device_fingerprint: str = Header(..., alias="X-Device-Fingerprint"),
):
    # Validate CAPTCHA
    if not await captcha.verify(captcha_token):
        raise HTTPException(status_code=422, detail="Invalid captcha")

    # Check device fingerprint for known bot patterns
    if await fraud.is_suspicious_device(device_fingerprint):
        raise HTTPException(status_code=429, detail="Suspicious activity detected")

    # Check user purchase history for abuse
    recent_purchases = await db.purchases.count(user_id=user.id, since=hours_ago(1))
    if recent_purchases >= 5:
        raise HTTPException(status_code=429, detail="Purchase limit reached")

    ticket = await reserve_ticket(body.event_id, user.id)
    charge = await payment.charge(user.payment_method, ticket.price)
    return {"ticket_id": ticket.id, "confirmation": charge.id}
```

**Prevention**:
- Identify business flows that are sensitive to automation abuse.
- Implement CAPTCHA, device fingerprinting, or proof-of-work challenges.
- Apply business-level rate limits (purchases per hour, not just requests per second).
- Monitor for patterns indicating automated abuse.

---

### API7:2023 -- Server-Side Request Forgery (SSRF)

**Description**: The API accepts a URL from the user and fetches it server-side without proper validation, allowing the attacker to scan internal networks or access cloud metadata services.

**Attack Scenario**: An attacker provides `http://169.254.169.254/latest/meta-data/iam/security-credentials/` as a webhook URL, and the API server fetches AWS credentials from the metadata service.

**Vulnerable Code (TypeScript)**:

```typescript
// VULNERABLE: Fetches arbitrary URLs
app.post('/api/webhooks', async (req, res) => {
  const { url, payload } = req.body;
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
  res.json({ status: response.status });
});
```

**Secure Code (TypeScript)**:

```typescript
import { URL } from 'url';
import dns from 'dns/promises';

const BLOCKED_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, /^fd/,
];

async function isInternalUrl(urlString: string): Promise<boolean> {
  const parsed = new URL(urlString);
  if (!['http:', 'https:'].includes(parsed.protocol)) return true;

  const addresses = await dns.resolve4(parsed.hostname).catch(() => []);
  return addresses.some(ip => BLOCKED_IP_RANGES.some(range => range.test(ip)));
}

app.post('/api/webhooks', authenticate, async (req, res) => {
  const { url, payload } = req.body;

  // Validate URL against allowlist or block internal ranges
  if (await isInternalUrl(url)) {
    return res.status(400).json({ error: 'URL targets an internal address' });
  }

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    redirect: 'error', // Do not follow redirects to internal URLs
  });
  res.json({ status: response.status });
});
```

**Prevention**:
- Validate and sanitize all user-supplied URLs.
- Block requests to private IP ranges, link-local, and metadata service IPs.
- Use an allowlist of permitted domains where possible.
- Disable HTTP redirects or re-validate after each redirect.
- Run outgoing requests from an isolated network segment.

---

### API8:2023 -- Security Misconfiguration

**Description**: The API or its infrastructure is misconfigured, exposing debug endpoints, default credentials, unnecessary HTTP methods, or missing security headers.

**Attack Scenario**: An API is deployed with CORS set to `Access-Control-Allow-Origin: *`, allowing any website to make authenticated requests to the API.

**Vulnerable Configuration**:

```typescript
// VULNERABLE: Overly permissive CORS
app.use(cors({ origin: '*', credentials: true }));

// VULNERABLE: Error stack traces exposed
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack });
});
```

**Secure Configuration**:

```typescript
// SECURE: Restrictive CORS with explicit origins
const ALLOWED_ORIGINS = [
  'https://app.example.com',
  'https://admin.example.com',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: Origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// SECURE: Generic error responses in production
app.use((err, req, res, next) => {
  const errorId = crypto.randomUUID();
  logger.error({ errorId, err });
  res.status(500).json({
    error: 'Internal server error',
    errorId, // For correlation, not for debugging
  });
});
```

**Prevention**:
- Disable debug endpoints, stack traces, and verbose errors in production.
- Configure CORS with explicit origin allowlists.
- Remove default credentials and API keys.
- Disable unnecessary HTTP methods.
- Automate configuration scanning in CI/CD.

---

### API9:2023 -- Improper Inventory Management

**Description**: Organizations lose track of API versions, endpoints, and environments. Old or undocumented API versions remain accessible with weaker security controls.

**Attack Scenario**: An attacker discovers `v1` of the API is still active and lacks the authentication requirements added in `v2`. They use `v1` to bypass security controls.

**Mitigation (Go)**:

```go
// Maintain a registry of all API versions and enforce deprecation
type APIVersion struct {
    Version       string
    Deprecated    bool
    SunsetDate    time.Time
    Handler       http.Handler
}

func versionMiddleware(versions map[string]APIVersion) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        version := extractVersion(r.URL.Path) // e.g., "v1"
        v, exists := versions[version]
        if !exists {
            http.Error(w, "Unknown API version", http.StatusNotFound)
            return
        }
        if v.Deprecated {
            w.Header().Set("Deprecation", "true")
            w.Header().Set("Sunset", v.SunsetDate.Format(http.TimeFormat))
            if time.Now().After(v.SunsetDate) {
                http.Error(w, "API version has been sunset", http.StatusGone)
                return
            }
        }
        v.Handler.ServeHTTP(w, r)
    }
}
```

**Prevention**:
- Maintain an inventory of all API endpoints across all environments.
- Enforce deprecation timelines with Sunset headers (RFC 8594).
- Apply the same security controls (authentication, authorization, rate limiting) to all versions.
- Decommission old API versions on a defined schedule.
- Use API gateways to centralize traffic and enforce policies.

---

### API10:2023 -- Unsafe Consumption of APIs

**Description**: The API trusts data received from third-party APIs without proper validation, allowing supply-chain attacks or injection through upstream services.

**Attack Scenario**: The API fetches user profile data from a third-party identity provider and stores it directly in the database without sanitization. The third party is compromised and returns payloads with injected scripts.

**Vulnerable Code (Python)**:

```python
# VULNERABLE: Trusting third-party API response blindly
async def sync_user_from_idp(user_id: str):
    response = requests.get(f"https://idp.example.com/users/{user_id}")
    user_data = response.json()
    # Directly storing unvalidated third-party data
    await db.users.update_one(
        {"_id": user_id},
        {"$set": user_data},
    )
```

**Secure Code (Python)**:

```python
# SECURE: Validate and sanitize third-party data
class IDPUserData(BaseModel):
    email: EmailStr
    display_name: str = Field(max_length=100, pattern=r'^[a-zA-Z0-9 .\-]+$')
    avatar_url: Optional[HttpUrl] = None

async def sync_user_from_idp(user_id: str):
    response = requests.get(
        f"https://idp.example.com/users/{user_id}",
        timeout=5,
        verify=True,  # Enforce TLS certificate validation
    )
    response.raise_for_status()

    # Validate against strict schema
    try:
        validated = IDPUserData(**response.json())
    except ValidationError as e:
        logger.warning(f"Invalid data from IDP for {user_id}: {e}")
        raise

    await db.users.update_one(
        {"_id": user_id},
        {"$set": validated.dict(exclude_unset=True)},
    )
```

**Prevention**:
- Validate all data received from third-party APIs against strict schemas.
- Enforce TLS certificate validation on outgoing requests.
- Set timeouts on all external API calls.
- Treat third-party API data with the same suspicion as user input.
- Monitor third-party API responses for anomalies.

---

## API Authentication Patterns Comparison

### API Keys

```typescript
// API Key authentication middleware
function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // Hash the key before lookup (store hashed, not plaintext)
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await db.apiKeys.findOne({
    hashedKey,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!keyRecord) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.apiKeyScopes = keyRecord.scopes;
  req.apiKeyOwner = keyRecord.ownerId;
  next();
}
```

| Property | Rating |
|---|---|
| Ease of use | High |
| Security level | Low-Medium |
| Best for | Server-to-server, public APIs with usage tracking |
| Risks | Keys leak in logs, repos, client-side code |

### OAuth2 Bearer Tokens (JWT)

```go
// OAuth2 JWT validation middleware (Go)
func oAuth2Middleware(next http.Handler) http.Handler {
    keySet := jwk.NewAutoRefresh(context.Background())
    keySet.Configure("https://auth.example.com/.well-known/jwks.json")

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
        if token == "" {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        set, err := keySet.Fetch(r.Context(), "https://auth.example.com/.well-known/jwks.json")
        if err != nil {
            http.Error(w, "Key fetch error", http.StatusInternalServerError)
            return
        }

        parsed, err := jwt.Parse([]byte(token), jwt.WithKeySet(set),
            jwt.WithValidate(true),
            jwt.WithIssuer("https://auth.example.com"),
            jwt.WithAudience("https://api.example.com"),
        )
        if err != nil {
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }

        ctx := context.WithValue(r.Context(), "user", parsed)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

| Property | Rating |
|---|---|
| Ease of use | Medium |
| Security level | High |
| Best for | User-facing APIs, delegation, third-party integrations |
| Risks | Token theft, token size, revocation complexity |

### Mutual TLS (mTLS)

```python
# mTLS configuration in Python (using ssl module)
import ssl

ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
ssl_context.load_cert_chain(
    certfile="/certs/client.crt",
    keyfile="/certs/client.key",
)
ssl_context.load_verify_locations("/certs/ca.crt")
ssl_context.verify_mode = ssl.CERT_REQUIRED
ssl_context.minimum_version = ssl.TLSVersion.TLSv1_3

# Server-side: verify client certificate
server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
server_context.load_cert_chain(
    certfile="/certs/server.crt",
    keyfile="/certs/server.key",
)
server_context.load_verify_locations("/certs/ca.crt")
server_context.verify_mode = ssl.CERT_REQUIRED  # Require client cert
server_context.minimum_version = ssl.TLSVersion.TLSv1_3
```

| Property | Rating |
|---|---|
| Ease of use | Low |
| Security level | Very High |
| Best for | Service-to-service in zero-trust environments |
| Risks | Certificate management complexity, rotation |

### HMAC Signatures

```typescript
// HMAC request signing (like AWS Signature V4)
import crypto from 'crypto';

function signRequest(
  method: string, path: string, body: string,
  secretKey: string, keyId: string,
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const stringToSign = `${method}\n${path}\n${timestamp}\n${
    crypto.createHash('sha256').update(body).digest('hex')
  }`;

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(stringToSign)
    .digest('hex');

  return {
    'X-API-Key': keyId,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
  };
}

// Server-side verification
function verifySignature(req: Request, secretKey: string): boolean {
  const timestamp = req.headers['x-timestamp'] as string;
  const receivedSig = req.headers['x-signature'] as string;

  // Reject if timestamp is too old (prevent replay)
  const age = Date.now() - new Date(timestamp).getTime();
  if (age > 5 * 60 * 1000) return false; // 5 minute window

  const bodyHash = crypto.createHash('sha256')
    .update(JSON.stringify(req.body))
    .digest('hex');
  const stringToSign = `${req.method}\n${req.path}\n${timestamp}\n${bodyHash}`;
  const expectedSig = crypto
    .createHmac('sha256', secretKey)
    .update(stringToSign)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSig), Buffer.from(expectedSig),
  );
}
```

| Property | Rating |
|---|---|
| Ease of use | Low |
| Security level | High |
| Best for | Webhook verification, APIs requiring non-repudiation |
| Risks | Clock skew, key distribution, implementation complexity |

---

## API Versioning Security

### Version Isolation

Every API version must enforce the full security stack independently. Do not assume that authentication or authorization middleware applied to v2 also covers v1.

```go
// Enforce security per version group
func setupRouter() *http.ServeMux {
    mux := http.NewServeMux()

    // v1 -- legacy, deprecated but still secured
    v1 := http.NewServeMux()
    v1.Handle("/users", v1UsersHandler())
    mux.Handle("/api/v1/", authMiddleware(
        rateLimitMiddleware(
            deprecationMiddleware("2025-06-01",
                http.StripPrefix("/api/v1", v1),
            ),
        ),
    ))

    // v2 -- current
    v2 := http.NewServeMux()
    v2.Handle("/users", v2UsersHandler())
    mux.Handle("/api/v2/", authMiddleware(
        rateLimitMiddleware(
            http.StripPrefix("/api/v2", v2),
        ),
    ))

    return mux
}
```

### Version Header Security

```typescript
// Validate API version from header
app.use((req, res, next) => {
  const version = req.headers['api-version'] || req.headers['accept-version'];
  const supportedVersions = ['2024-01-01', '2024-06-01', '2025-01-01'];

  if (version && !supportedVersions.includes(version as string)) {
    return res.status(400).json({
      error: 'Unsupported API version',
      supported: supportedVersions,
    });
  }

  req.apiVersion = (version as string) || supportedVersions.at(-1)!;
  next();
});
```

---

## Best Practices

1. **Enforce authorization at the data layer** -- Scope every database query to the authenticated user or their permissions. Never rely solely on controller-level checks.

2. **Validate all tokens cryptographically** -- Verify JWT signatures, check expiration, validate issuer and audience claims on every request.

3. **Use explicit allowlist schemas for input** -- Define input schemas that list exactly which fields are accepted. Reject unknown fields.

4. **Set resource consumption limits everywhere** -- Maximum page sizes, request body sizes, query timeouts, upload sizes, and rate limits.

5. **Apply the same security to all API versions** -- Old API versions must have the same authentication, authorization, and rate limiting as current versions.

6. **Treat third-party API data as untrusted input** -- Validate, sanitize, and schema-check data from external APIs before storage or use.

7. **Use UUIDs for resource identifiers** -- Avoid sequential integer IDs that allow enumeration attacks.

8. **Centralize authentication in middleware** -- Do not scatter authentication logic across individual handlers.

9. **Log all authentication and authorization failures** -- Enable detection of brute-force, credential stuffing, and enumeration attacks.

10. **Automate API security testing in CI/CD** -- Run OWASP ZAP, Burp Suite, or custom authorization tests on every deployment.

---

## Anti-Patterns

1. **Relying on obscurity for security** -- Assuming attackers will not discover undocumented endpoints. They will.

2. **Checking authorization only in the frontend** -- Client-side checks are for UX, not security. Enforce on the server.

3. **Using sequential IDs without ownership checks** -- Enables trivial enumeration of other users' resources.

4. **Accepting unbounded query parameters** -- Allowing `?limit=999999` or `?depth=100` without server-side caps.

5. **Trusting the `alg` header in JWTs** -- The "none" algorithm attack allows forged tokens. Always enforce the expected algorithm server-side.

6. **Exposing stack traces in error responses** -- Reveals framework versions, file paths, and database schemas to attackers.

7. **Sharing API keys across environments** -- Production keys used in development leak through developer machines, logs, and CI systems.

8. **Skipping TLS certificate validation on outgoing requests** -- Setting `verify=False` or `rejectUnauthorized: false` enables man-in-the-middle attacks.

---

## Enforcement Checklist

- [ ] All OWASP API Top 10 risks have been assessed for every endpoint
- [ ] Object-level authorization is enforced at the data layer
- [ ] Authentication tokens are validated with proper signature verification
- [ ] Input schemas explicitly allowlist accepted fields (mass assignment prevented)
- [ ] Resource consumption limits are in place (pagination, body size, timeouts)
- [ ] Admin and privileged endpoints require role-based access control
- [ ] Business-critical flows have bot/automation protection
- [ ] URLs provided by users are validated against SSRF (internal IP ranges blocked)
- [ ] CORS, error handling, and debug settings are hardened for production
- [ ] API version inventory is maintained; deprecated versions are sunset
- [ ] Third-party API responses are validated against strict schemas
- [ ] API keys are stored hashed, have expiration dates, and are scoped
- [ ] All authentication failures are logged with correlation IDs
- [ ] Security tests (authorization bypass, injection) run in CI/CD pipeline
- [ ] API documentation is kept in sync with actual endpoints
