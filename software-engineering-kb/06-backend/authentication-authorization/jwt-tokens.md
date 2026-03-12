# JWT Tokens

> **AI Plugin Directive — JSON Web Tokens (JWT)**
> You are an AI coding assistant. When generating, reviewing, or refactoring JWT-based authentication
> code, follow EVERY rule in this document. JWT misuse is one of the most common sources of
> authentication bypass vulnerabilities. Treat each numbered section as a non-negotiable requirement.

**Core Rule: NEVER trust a JWT without verifying its signature. NEVER store sensitive data in JWT payloads — they are Base64-encoded, NOT encrypted. ALWAYS validate issuer, audience, expiration, and algorithm on EVERY request.**

---

## 1. JWT Structure

```
┌──────────────────────────────────────────────────────────────┐
│                      JWT Structure                            │
│                                                               │
│  eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature         │
│  ├──────────────────┤ ├────────────────────┤ ├──────────┤     │
│       Header              Payload             Signature       │
│   (Base64url)          (Base64url)          (Base64url)       │
│                                                               │
│  Header:                                                      │
│  {                                                            │
│    "alg": "RS256",     ← Signing algorithm                   │
│    "typ": "JWT",       ← Token type                          │
│    "kid": "key-2024"   ← Key ID for rotation                 │
│  }                                                            │
│                                                               │
│  Payload:                                                     │
│  {                                                            │
│    "sub": "user-123",  ← Subject (user ID)                   │
│    "iss": "auth.app",  ← Issuer                              │
│    "aud": "api.app",   ← Audience                            │
│    "exp": 1700000000,  ← Expiration (UNIX timestamp)         │
│    "iat": 1699996400,  ← Issued at                           │
│    "jti": "uuid-v4",   ← Unique token ID                    │
│    "roles": ["user"]   ← Custom claims                       │
│  }                                                            │
│                                                               │
│  Signature:                                                   │
│    RS256(base64url(header) + "." + base64url(payload), key)  │
└──────────────────────────────────────────────────────────────┘
```

ALWAYS include these registered claims:

| Claim | Name | Required | Purpose |
|-------|------|----------|---------|
| `sub` | Subject | YES | User/entity identifier |
| `iss` | Issuer | YES | Token issuer identifier |
| `aud` | Audience | YES | Intended recipient(s) |
| `exp` | Expiration | YES | Token expiry (UNIX timestamp) |
| `iat` | Issued At | YES | Token creation time |
| `jti` | JWT ID | RECOMMENDED | Unique ID for revocation |
| `nbf` | Not Before | OPTIONAL | Token valid only after this time |

---

## 2. Algorithm Selection

| Algorithm | Type | Key | Security | Use Case |
|-----------|------|-----|----------|----------|
| **RS256** | Asymmetric | RSA 2048+ | HIGH | Default choice — public key verification |
| **ES256** | Asymmetric | P-256 (ECDSA) | HIGH | Smaller tokens, faster verification |
| **EdDSA** | Asymmetric | Ed25519 | HIGHEST | Modern systems, best performance |
| HS256 | Symmetric | Shared secret | MODERATE | Single-service ONLY |
| **none** | NONE | NONE | ZERO | **NEVER USE** |

### 2.1 Algorithm Rules

- ALWAYS use asymmetric algorithms (RS256, ES256, EdDSA) for distributed systems
- ALWAYS use RS256 as the default unless you have a specific reason for another algorithm
- ONLY use HS256 when the same service both issues AND verifies tokens
- NEVER accept the `none` algorithm — this is a well-known attack vector
- ALWAYS whitelist allowed algorithms in verification — NEVER rely on the token's `alg` header
- ALWAYS use RSA keys of 2048 bits minimum (4096 recommended)

```
Algorithm Decision:
┌─────────────────────────────────────┐
│ Same service issues AND verifies?   │
│         │              │            │
│        YES             NO           │
│         │              │            │
│       HS256     Need smallest       │
│   (256-bit      tokens?             │
│    secret)      │         │         │
│               YES        NO         │
│                │         │          │
│             ES256      RS256        │
│          (P-256)    (RSA 2048+)     │
│                                     │
│  Modern system with Ed25519         │
│  support? → Use EdDSA               │
└─────────────────────────────────────┘
```

---

## 3. Token Lifetime Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                Token Lifetime Strategy                        │
│                                                              │
│  Access Token (Short-lived)                                  │
│  ├── Lifetime: 15 minutes                                    │
│  ├── Storage: Memory (JavaScript variable)                   │
│  ├── Sent via: Authorization: Bearer header                  │
│  ├── Contains: user ID, roles, permissions                   │
│  └── On expiry: Use refresh token to get new one             │
│                                                              │
│  Refresh Token (Long-lived)                                  │
│  ├── Lifetime: 7-30 days                                     │
│  ├── Storage: HttpOnly, Secure, SameSite cookie              │
│  ├── Sent via: Cookie (automatic)                            │
│  ├── Contains: ONLY token ID (opaque)                        │
│  ├── Stored in: Database (hashed)                            │
│  └── On expiry: User must re-authenticate                    │
│                                                              │
│  ┌──────────────────────────────────────────┐                │
│  │ Timeline:                                 │                │
│  │                                           │                │
│  │  0min    15min   30min   45min   7 days   │                │
│  │  ├────AT──┤                                │                │
│  │       ├──refresh──►├────AT──┤              │                │
│  │                         ├──refresh──►├─AT─┤│                │
│  │  ├──────────────RT──────────────────────┤  │                │
│  │                                           │                │
│  │  AT = Access Token, RT = Refresh Token   │                │
│  └──────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

| Token Type | Lifetime | Storage | Revocable | Contains |
|-----------|----------|---------|-----------|----------|
| Access Token | 15 min | Memory (frontend) | No (short-lived) | User claims, roles |
| Refresh Token | 7-30 days | HttpOnly cookie + DB | YES (DB lookup) | Token ID only |
| ID Token (OIDC) | 1 hour | Memory (frontend) | No | User profile claims |
| API Token | 90-365 days | Hashed in DB | YES (DB lookup) | Scopes, key ID |

- NEVER set access token lifetime > 15 minutes
- NEVER store access tokens in localStorage or sessionStorage — XSS can steal them
- ALWAYS store refresh tokens as HttpOnly, Secure, SameSite=Strict cookies
- ALWAYS store refresh tokens hashed in the database for revocation

---

## 4. JWT Implementation

### 4.1 Token Issuance

**TypeScript (jose)**
```typescript
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import { randomUUID } from "crypto";

// ALWAYS load keys from environment/KMS — NEVER hardcode
const PRIVATE_KEY = await importPKCS8(
  process.env.JWT_PRIVATE_KEY!,
  "RS256"
);
const PUBLIC_KEY = await importSPKI(
  process.env.JWT_PUBLIC_KEY!,
  "RS256"
);

interface TokenPayload {
  userId: string;
  roles: string[];
  permissions: string[];
}

async function issueAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    roles: payload.roles,
    permissions: payload.permissions,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "key-2024-03" })
    .setIssuer("https://auth.myapp.com")
    .setAudience("https://api.myapp.com")
    .setExpirationTime("15m")
    .setIssuedAt()
    .setJti(randomUUID())
    .sign(PRIVATE_KEY);
}

async function issueRefreshToken(userId: string): Promise<{
  token: string;
  tokenId: string;
}> {
  const tokenId = randomUUID();

  const token = new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer("https://auth.myapp.com")
    .setAudience("https://auth.myapp.com") // Refresh tokens target auth service
    .setExpirationTime("7d")
    .setIssuedAt()
    .setJti(tokenId);

  // Store hashed token ID in database for revocation
  await db.refreshTokens.create({
    tokenId,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { token: await token.sign(PRIVATE_KEY), tokenId };
}
```

**Go (golang-jwt/jwt)**
```go
package auth

import (
    "crypto/rsa"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
)

type Claims struct {
    jwt.RegisteredClaims
    Roles       []string `json:"roles"`
    Permissions []string `json:"permissions"`
}

type TokenService struct {
    privateKey *rsa.PrivateKey
    publicKey  *rsa.PublicKey
    issuer     string
    audience   string
}

func (ts *TokenService) IssueAccessToken(userID string, roles, perms []string) (string, error) {
    now := time.Now()
    claims := Claims{
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   userID,
            Issuer:    ts.issuer,
            Audience:  jwt.ClaimStrings{ts.audience},
            ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(now),
            ID:        uuid.NewString(),
        },
        Roles:       roles,
        Permissions: perms,
    }

    token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
    token.Header["kid"] = "key-2024-03"

    return token.SignedString(ts.privateKey)
}

func (ts *TokenService) VerifyAccessToken(tokenString string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{},
        func(t *jwt.Token) (interface{}, error) {
            // ALWAYS validate algorithm — prevent algorithm confusion
            if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
            }
            return ts.publicKey, nil
        },
        jwt.WithIssuer(ts.issuer),
        jwt.WithAudience(ts.audience),
        jwt.WithValidMethods([]string{"RS256"}), // Whitelist algorithms
    )
    if err != nil {
        return nil, err
    }

    claims, ok := token.Claims.(*Claims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid token claims")
    }

    return claims, nil
}
```

**Python (PyJWT)**
```python
import jwt
import uuid
from datetime import datetime, timedelta, timezone
from cryptography.hazmat.primitives import serialization

# Load keys from environment/KMS
with open("private_key.pem", "rb") as f:
    PRIVATE_KEY = serialization.load_pem_private_key(f.read(), password=None)
with open("public_key.pem", "rb") as f:
    PUBLIC_KEY = serialization.load_pem_public_key(f.read())

ISSUER = "https://auth.myapp.com"
AUDIENCE = "https://api.myapp.com"

def issue_access_token(user_id: str, roles: list[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "exp": now + timedelta(minutes=15),
        "iat": now,
        "jti": str(uuid.uuid4()),
        "roles": roles,
    }
    return jwt.encode(
        payload,
        PRIVATE_KEY,
        algorithm="RS256",
        headers={"kid": "key-2024-03"},
    )

def verify_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        PUBLIC_KEY,
        algorithms=["RS256"],  # ALWAYS whitelist algorithms
        issuer=ISSUER,
        audience=AUDIENCE,
        options={
            "require": ["sub", "iss", "aud", "exp", "iat", "jti"],
            "verify_exp": True,
            "verify_iss": True,
            "verify_aud": True,
        },
    )
```

---

## 5. Token Refresh Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                    Token Refresh Flow                              │
│                                                                    │
│  Client                    Auth Server                   DB        │
│    │                          │                          │         │
│    │── POST /auth/refresh ──► │                          │         │
│    │   Cookie: RT=<token>     │                          │         │
│    │                          │── Verify RT signature ──►│         │
│    │                          │                          │         │
│    │                          │── Check RT in DB ──────► │         │
│    │                          │   (not revoked,          │         │
│    │                          │    not expired)           │         │
│    │                          │                          │         │
│    │                          │── Delete old RT ────────►│         │
│    │                          │── Create new RT ────────►│         │
│    │                          │                          │         │
│    │◄── New Access Token ─── │                          │         │
│    │◄── New Refresh Token ── │                          │         │
│    │    (Set-Cookie: RT=new)  │                          │         │
│    │                          │                          │         │
│    │ REFRESH TOKEN ROTATION:                              │         │
│    │ Old RT is INVALIDATED on each use                   │         │
│    │ If old RT is reused → REVOKE ALL user tokens        │         │
│    │ (indicates token theft)                              │         │
└───────────────────────────────────────────────────────────────────┘
```

### 5.1 Refresh Token Rotation

ALWAYS implement refresh token rotation — issue a new refresh token on every refresh and invalidate the old one:

```typescript
async function refreshTokens(oldRefreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  // Verify refresh token signature
  const payload = await jwtVerify(oldRefreshToken, PUBLIC_KEY, {
    issuer: "https://auth.myapp.com",
    audience: "https://auth.myapp.com",
    algorithms: ["RS256"],
  });

  const tokenId = payload.payload.jti!;
  const userId = payload.payload.sub!;

  // Check if token exists in DB (not revoked)
  const storedToken = await db.refreshTokens.findOne({
    tokenId,
    revokedAt: null,
  });

  if (!storedToken) {
    // Token was already used or revoked — possible theft!
    // REVOKE ALL refresh tokens for this user
    await db.refreshTokens.updateMany(
      { userId },
      { revokedAt: new Date(), revokeReason: "token_reuse_detected" }
    );
    await auditLog.record({
      event: "refresh_token_reuse",
      userId,
      severity: "critical",
    });
    return null;
  }

  // Revoke old refresh token
  await db.refreshTokens.update(tokenId, { revokedAt: new Date() });

  // Issue new tokens
  const user = await db.users.findById(userId);
  const accessToken = await issueAccessToken({
    userId: user.id,
    roles: user.roles,
    permissions: user.permissions,
  });
  const { token: refreshToken } = await issueRefreshToken(user.id);

  return { accessToken, refreshToken };
}
```

- ALWAYS rotate refresh tokens on each use (issue new, invalidate old)
- ALWAYS detect refresh token reuse as a security event — revoke ALL tokens for the user
- ALWAYS store refresh tokens in the database (hashed) for revocation capability
- NEVER send refresh tokens in the response body — use `Set-Cookie` with HttpOnly

---

## 6. Token Storage (Client-Side)

| Storage | Access Tokens | Refresh Tokens | Security |
|---------|---------------|----------------|----------|
| **Memory (JS variable)** | PREFERRED | No | Immune to XSS (cleared on navigation) |
| **HttpOnly Cookie** | Acceptable | PREFERRED | Immune to XSS, vulnerable to CSRF |
| localStorage | NEVER | NEVER | Vulnerable to XSS |
| sessionStorage | NEVER | NEVER | Vulnerable to XSS |
| URL parameter | NEVER | NEVER | Logged, leaked via Referer |

### 6.1 Cookie Configuration

ALWAYS set these attributes when storing tokens in cookies:

```typescript
function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie("refresh_token", token, {
    httpOnly: true,     // ALWAYS — prevents JavaScript access
    secure: true,       // ALWAYS — HTTPS only
    sameSite: "strict", // ALWAYS — prevents CSRF
    path: "/auth",      // Restrict to auth endpoints only
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: ".myapp.com",
  });
}

// For access tokens in cookies (alternative to Bearer header):
function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",    // Lax allows top-level navigation
    path: "/",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
}
```

- ALWAYS set `HttpOnly` — prevents JavaScript from reading the cookie
- ALWAYS set `Secure` — ensures cookies are sent only over HTTPS
- ALWAYS set `SameSite=Strict` for refresh tokens — prevents CSRF
- ALWAYS set `path` to restrict cookie scope (e.g., `/auth` for refresh tokens)
- NEVER store JWTs in localStorage — any XSS vulnerability exposes all tokens

---

## 7. Token Revocation

JWTs are stateless — they CANNOT be revoked once issued. Use these strategies:

### 7.1 Revocation Strategies

| Strategy | Latency | Complexity | Use Case |
|----------|---------|------------|----------|
| **Short-lived tokens** | Token lifetime | LOW | Default — 15 min is acceptable |
| **Token blacklist** | Near-instant | MODERATE | Logout, password change |
| **Token versioning** | Near-instant | LOW | Mass revocation per user |

### 7.2 Token Blacklist (Redis)

```typescript
class TokenBlacklist {
  constructor(private redis: Redis) {}

  async revoke(jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return; // Already expired

    // Store only until token would have expired
    await this.redis.setex(`blacklist:${jti}`, ttl, "1");
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(`blacklist:${jti}`)) === 1;
  }

  async revokeAllForUser(userId: string, currentVersion: number): Promise<void> {
    // Increment token version — all tokens with older version are invalid
    await this.redis.set(`token_version:${userId}`, currentVersion + 1);
  }
}

// Middleware — check blacklist on EVERY request
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = await verifyAccessToken(token);

    // Check blacklist
    if (await blacklist.isRevoked(payload.jti)) {
      return res.status(401).json({ error: "Token revoked" });
    }

    // Check token version (for mass revocation)
    const currentVersion = await redis.get(`token_version:${payload.sub}`);
    if (currentVersion && payload.tokenVersion < Number(currentVersion)) {
      return res.status(401).json({ error: "Token revoked" });
    }

    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
```

**Go (Redis blacklist)**
```go
type TokenBlacklist struct {
    rdb *redis.Client
}

func (b *TokenBlacklist) Revoke(ctx context.Context, jti string, exp time.Time) error {
    ttl := time.Until(exp)
    if ttl <= 0 {
        return nil
    }
    return b.rdb.SetEx(ctx, "blacklist:"+jti, "1", ttl).Err()
}

func (b *TokenBlacklist) IsRevoked(ctx context.Context, jti string) (bool, error) {
    n, err := b.rdb.Exists(ctx, "blacklist:"+jti).Result()
    return n > 0, err
}
```

---

## 8. Key Management & Rotation

```
┌─────────────────────────────────────────────────────────────────┐
│                    Key Rotation Strategy                         │
│                                                                  │
│  Phase 1: Generate new key pair                                  │
│  ├── Create RSA 4096 / EC P-256 key pair                        │
│  ├── Assign new kid (e.g., "key-2024-06")                       │
│  └── Store in HSM / KMS / Vault                                 │
│                                                                  │
│  Phase 2: Dual signing (overlap period)                          │
│  ├── Sign NEW tokens with new key                                │
│  ├── JWKS endpoint serves BOTH old and new public keys           │
│  └── Verification accepts BOTH keys (matched by kid)             │
│                                                                  │
│  Phase 3: Remove old key (after max token lifetime)              │
│  ├── Wait until ALL tokens signed with old key have expired      │
│  ├── Remove old public key from JWKS endpoint                   │
│  └── Archive old private key (DO NOT delete — audit trail)       │
│                                                                  │
│  Timeline:                                                       │
│  ├── Day 0: Generate new key, start signing with it             │
│  ├── Day 0-1: Both keys in JWKS (15 min access + 7d refresh)   │
│  ├── Day 8+: Remove old key from JWKS                           │
│  └── Recommended rotation: Every 90 days                         │
└─────────────────────────────────────────────────────────────────┘
```

### 8.1 JWKS Endpoint

ALWAYS expose a JWKS (JSON Web Key Set) endpoint for public key distribution:

```typescript
import { exportJWK } from "jose";

// GET /.well-known/jwks.json
async function jwksEndpoint(req: Request, res: Response) {
  const currentKey = await exportJWK(CURRENT_PUBLIC_KEY);
  currentKey.kid = "key-2024-06";
  currentKey.use = "sig";
  currentKey.alg = "RS256";

  const keys = [currentKey];

  // Include previous key during rotation overlap
  if (PREVIOUS_PUBLIC_KEY) {
    const prevKey = await exportJWK(PREVIOUS_PUBLIC_KEY);
    prevKey.kid = "key-2024-03";
    prevKey.use = "sig";
    prevKey.alg = "RS256";
    keys.push(prevKey);
  }

  res.set("Cache-Control", "public, max-age=3600"); // Cache 1 hour
  res.json({ keys });
}
```

- ALWAYS include `kid` (Key ID) in JWT headers to identify which key signed the token
- ALWAYS publish public keys via `/.well-known/jwks.json`
- ALWAYS rotate signing keys every 90 days minimum
- ALWAYS maintain an overlap period during rotation (old + new keys both valid)
- NEVER store private keys in environment variables for production — use HSM/KMS
- NEVER delete old private keys — archive them for audit purposes

---

## 9. JWT Security Attacks & Mitigations

| Attack | Description | Mitigation |
|--------|-------------|------------|
| **Algorithm None** | Attacker sets `alg: "none"` to bypass signature | ALWAYS whitelist algorithms in verification |
| **Algorithm Confusion** | Attacker switches RS256→HS256, uses public key as HMAC secret | ALWAYS validate `alg` matches expected type |
| **Key Injection (jwk/jku)** | Attacker embeds malicious key in header | NEVER trust `jwk`/`jku`/`x5u` from token headers |
| **Token Sidejacking** | Attacker steals token from non-HTTPS connection | ALWAYS use HTTPS, set Secure cookie flag |
| **XSS Token Theft** | JavaScript reads token from localStorage | NEVER store tokens in localStorage |
| **CSRF with Cookie JWT** | Forged requests include cookie-based JWT | Use SameSite=Strict + CSRF tokens |
| **Token Replay** | Stolen token reused before expiration | Short-lived tokens + `jti` claim + blacklist |
| **Claim Injection** | User-controlled data in claims without validation | ALWAYS validate and sanitize claim values |
| **kid Injection** | SQL/path injection via `kid` header field | Validate `kid` against known key IDs only |

### 9.1 Algorithm Confusion Prevention

```typescript
// WRONG — vulnerable to algorithm confusion
const payload = jwt.verify(token, publicKey); // ❌

// CORRECT — explicitly whitelist algorithms
const payload = jwt.verify(token, publicKey, {
  algorithms: ["RS256"],  // ✅ ONLY accept RS256
  issuer: "https://auth.myapp.com",
  audience: "https://api.myapp.com",
});
```

```go
// WRONG — no algorithm validation
token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
    return publicKey, nil // ❌ Accepts ANY algorithm
})

// CORRECT — validate algorithm type
token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
    if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok { // ✅
        return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
    }
    return publicKey, nil
}, jwt.WithValidMethods([]string{"RS256"})) // ✅
```

---

## 10. JWT Claims Best Practices

### 10.1 Minimal Claims Principle

ALWAYS include the minimum necessary data in JWT payloads:

```json
// GOOD — Minimal claims ✅
{
  "sub": "user-123",
  "iss": "https://auth.myapp.com",
  "aud": "https://api.myapp.com",
  "exp": 1700000000,
  "iat": 1699999100,
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "roles": ["admin"],
  "org_id": "org-456"
}

// BAD — Too much data ❌
{
  "sub": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "address": "123 Main St",
  "credit_card_last4": "4242",
  "social_security": "XXX-XX-1234"
}
```

- NEVER include PII (email, phone, name) in access tokens unless absolutely required
- NEVER include sensitive data (credit cards, SSN, medical info) in JWTs
- ALWAYS remember: JWT payloads are Base64-encoded, NOT encrypted
- ALWAYS include authorization data (roles, permissions) to avoid DB lookups per request
- ALWAYS use short identifiers for claims to minimize token size

### 10.2 Custom Claims Namespacing

ALWAYS namespace custom claims to avoid collisions:

```json
{
  "sub": "user-123",
  "https://myapp.com/roles": ["admin"],
  "https://myapp.com/org_id": "org-456",
  "https://myapp.com/tier": "enterprise"
}
```

---

## 11. Middleware Pattern

### 11.1 Complete Auth Middleware

**TypeScript (Express)**
```typescript
import { Request, Response, NextFunction } from "express";
import { jwtVerify, JWTPayload } from "jose";

interface AuthenticatedRequest extends Request {
  user: JWTPayload & {
    sub: string;
    roles: string[];
    permissions: string[];
  };
}

function requireAuth(requiredPermissions?: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "authentication_required",
        message: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.slice(7);

    try {
      // 2. Verify token (signature, expiry, issuer, audience)
      const { payload } = await jwtVerify(token, PUBLIC_KEY, {
        issuer: "https://auth.myapp.com",
        audience: "https://api.myapp.com",
        algorithms: ["RS256"],
        requiredClaims: ["sub", "jti", "roles"],
      });

      // 3. Check blacklist
      if (await tokenBlacklist.isRevoked(payload.jti as string)) {
        return res.status(401).json({
          error: "token_revoked",
          message: "Token has been revoked",
        });
      }

      // 4. Check permissions (if required)
      if (requiredPermissions?.length) {
        const userPerms = (payload.permissions as string[]) ?? [];
        const hasAll = requiredPermissions.every((p) => userPerms.includes(p));
        if (!hasAll) {
          return res.status(403).json({
            error: "insufficient_permissions",
            message: "You do not have permission to perform this action",
          });
        }
      }

      // 5. Attach user to request
      (req as AuthenticatedRequest).user = payload as any;
      next();
    } catch (err) {
      if (err.code === "ERR_JWT_EXPIRED") {
        return res.status(401).json({
          error: "token_expired",
          message: "Access token has expired",
        });
      }
      return res.status(401).json({
        error: "invalid_token",
        message: "Token verification failed",
      });
    }
  };
}

// Usage
app.get("/api/users", requireAuth(["users:read"]), listUsers);
app.delete("/api/users/:id", requireAuth(["users:delete"]), deleteUser);
```

**Go (middleware)**
```go
func RequireAuth(requiredPerms ...string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            token := extractBearerToken(r)
            if token == "" {
                writeError(w, http.StatusUnauthorized, "missing_token")
                return
            }

            claims, err := tokenService.VerifyAccessToken(token)
            if err != nil {
                writeError(w, http.StatusUnauthorized, "invalid_token")
                return
            }

            // Check blacklist
            if revoked, _ := blacklist.IsRevoked(r.Context(), claims.ID); revoked {
                writeError(w, http.StatusUnauthorized, "token_revoked")
                return
            }

            // Check permissions
            if len(requiredPerms) > 0 {
                for _, perm := range requiredPerms {
                    if !contains(claims.Permissions, perm) {
                        writeError(w, http.StatusForbidden, "insufficient_permissions")
                        return
                    }
                }
            }

            ctx := context.WithValue(r.Context(), userContextKey, claims)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

---

## 12. JWT vs Session Comparison

| Dimension | JWT | Server Sessions |
|-----------|-----|-----------------|
| State | Stateless (self-contained) | Stateful (server-stored) |
| Scalability | Horizontally scalable (no shared state) | Requires shared session store |
| Revocation | Difficult (needs blacklist) | Instant (delete from store) |
| Size | Large (payload in every request) | Small (just session ID) |
| Cross-domain | Easy (Bearer header) | Difficult (cookie scope) |
| Mobile | Native support | Requires cookie handling |
| Microservices | Ideal (services verify independently) | Requires session store access |
| Offline | Payload readable without server | Requires server lookup |
| Security | Token theft = full access until expiry | Session theft = revocable |
| Complexity | Higher (key management, rotation) | Lower (simple store) |

### When to Use JWT

- Microservices / distributed systems (services verify independently)
- Mobile applications (no cookie support needed)
- Cross-domain authentication (SSO)
- Stateless APIs (no shared session store)
- Short-lived authorization (API calls between services)

### When to Use Sessions

- Server-rendered applications (traditional web apps)
- Instant revocation required (banking, high-security)
- Simple single-server deployment
- Large user data needed per request (avoid bloating JWT)

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| JWT in localStorage | XSS steals all tokens | Store in memory (access) + HttpOnly cookie (refresh) |
| Long-lived access tokens | 24h+ tokens create large theft window | 15 min max access token lifetime |
| No algorithm whitelist | Algorithm confusion attacks succeed | ALWAYS whitelist: `algorithms: ["RS256"]` |
| Sensitive data in payload | PII exposed via Base64 decode | Keep claims minimal — IDs and roles only |
| No `kid` in header | Key rotation breaks all tokens | ALWAYS include `kid`, match to JWKS |
| Hardcoded signing keys | Key compromise requires code deploy | Store keys in HSM/KMS/Vault |
| No token blacklist | Logout doesn't actually revoke access | Redis blacklist with TTL matching token expiry |
| Refresh token without rotation | Stolen refresh token has unlimited use | Issue new RT on every refresh, detect reuse |
| HS256 in distributed system | Shared secret must be in all services | Use RS256/ES256 — share only public key |
| No `jti` claim | Cannot revoke individual tokens | ALWAYS include unique `jti` for blacklisting |
| Trusting `jwk`/`jku` headers | Attacker injects their own key | NEVER trust key info from the token itself |
| No issuer/audience validation | Tokens from other services accepted | ALWAYS verify `iss` and `aud` claims |
| Same key for all environments | Dev tokens work in production | Separate keys per environment |
| No expiration check | Expired tokens still accepted | ALWAYS verify `exp` claim |

---

## 14. Enforcement Checklist

- [ ] Asymmetric algorithm used (RS256/ES256/EdDSA) for distributed systems
- [ ] Algorithm explicitly whitelisted in verification — NEVER rely on token's `alg` header
- [ ] Access token lifetime ≤ 15 minutes
- [ ] Refresh token stored as HttpOnly, Secure, SameSite=Strict cookie
- [ ] Refresh tokens stored hashed in database for revocation
- [ ] Refresh token rotation implemented (new RT on every refresh)
- [ ] Refresh token reuse detection triggers full revocation
- [ ] All registered claims present: `sub`, `iss`, `aud`, `exp`, `iat`, `jti`
- [ ] Issuer and audience validated on every verification
- [ ] `kid` header included for key rotation support
- [ ] JWKS endpoint exposed at `/.well-known/jwks.json`
- [ ] Signing keys stored in HSM/KMS/Vault — NEVER in code or env vars
- [ ] Key rotation every 90 days with overlap period
- [ ] Token blacklist (Redis) for logout and password change
- [ ] No sensitive data (PII, secrets) in JWT payloads
- [ ] Access tokens NOT stored in localStorage or sessionStorage
- [ ] HTTPS enforced for all token transmission
- [ ] CSRF protection for cookie-based token delivery
- [ ] Token version check for mass revocation capability
- [ ] Separate signing keys per environment (dev/staging/prod)
