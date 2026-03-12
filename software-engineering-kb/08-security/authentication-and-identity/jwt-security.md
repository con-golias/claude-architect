# JWT Security Deep Dive

## Metadata
- **Category**: Authentication and Identity
- **Priority**: Critical
- **Last Updated**: 2025-01-15
- **Standards**: RFC 7519 (JWT), RFC 7515 (JWS), RFC 7516 (JWE), RFC 7517 (JWK)
- **Applicable Languages**: TypeScript, Go, Python

---

## Table of Contents

1. [Overview](#overview)
2. [JWT Structure](#jwt-structure)
3. [Algorithm Selection](#algorithm-selection)
4. [Claims Validation](#claims-validation)
5. [JWK and JWKS Endpoint](#jwk-and-jwks-endpoint)
6. [Key Rotation Strategy](#key-rotation-strategy)
7. [JWE (Encrypted JWT)](#jwe-encrypted-jwt)
8. [JWT Size Concerns](#jwt-size-concerns)
9. [Access and Refresh Token Pattern](#access-and-refresh-token-pattern)
10. [Token Revocation](#token-revocation)
11. [Audience Restriction](#audience-restriction)
12. [Common Attacks and Mitigations](#common-attacks-and-mitigations)
13. [Implementation Examples](#implementation-examples)
14. [Best Practices](#best-practices)
15. [Anti-Patterns](#anti-patterns)
16. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

JSON Web Token (JWT, pronounced "jot") is a compact, URL-safe token format for
transmitting claims between two parties. JWTs are widely used as access tokens in
OAuth 2.0 / OpenID Connect and as session tokens. Despite their ubiquity, JWTs are
frequently misimplemented, leading to critical security vulnerabilities.

This guide covers JWT security from the ground up: structure, algorithm selection,
claims validation, key management, encryption, revocation strategies, and detailed
coverage of every known attack vector against JWTs.

The cardinal rule of JWT security: **never trust a JWT without full verification.**
Every claim must be validated. The signature must be verified against a known key.
The algorithm must be explicitly specified by the verifier, never derived from the
token header.

---

## JWT Structure

A signed JWT (JWS) consists of three Base64URL-encoded parts separated by dots:

```
header.payload.signature
```

### Header

The header identifies the algorithm used to sign the token and the key identifier.

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "2024-key-1"
}
```

| Field | Description                                          |
|-------|------------------------------------------------------|
| alg   | Signing algorithm (RS256, ES256, EdDSA, PS256, etc.) |
| typ   | Token type (always "JWT")                            |
| kid   | Key ID for identifying which key to use for verification |

### Payload

The payload contains claims about the subject and additional metadata.

```json
{
  "iss": "https://auth.example.com",
  "sub": "user-123",
  "aud": "https://api.example.com",
  "exp": 1704067200,
  "iat": 1704066300,
  "nbf": 1704066300,
  "jti": "unique-token-id-abc123",
  "scope": "read write",
  "roles": ["admin"]
}
```

### Signature

The signature is computed over the header and payload:

```
signature = ALGORITHM(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  key
)
```

For asymmetric algorithms (RS256, ES256, EdDSA, PS256), the signature is created
with the private key and verified with the public key. For symmetric algorithms
(HS256, HS384, HS512), the same secret key is used for both signing and verification.

**Important:** The payload is Base64URL-encoded, NOT encrypted. Anyone can decode and
read the payload contents. Do not store sensitive data (passwords, SSNs, credit card
numbers) in JWT payloads unless the JWT is encrypted (JWE).

---

## Algorithm Selection

### Recommended Algorithms

| Algorithm | Type        | Key Size  | Signature Size | Use Case                    |
|-----------|-------------|-----------|----------------|-----------------------------|
| RS256     | RSA PKCS#1  | 2048+ bit | 256 bytes      | Widely supported, default   |
| ES256     | ECDSA P-256 | 256 bit   | 64 bytes       | Smaller tokens, modern      |
| EdDSA     | Ed25519     | 256 bit   | 64 bytes       | Fastest, most modern        |
| PS256     | RSA-PSS     | 2048+ bit | 256 bytes      | RSA with better security proof |

### Algorithm Selection Guidance

**For new systems:** Use ES256 or EdDSA. Both produce smaller signatures than RSA,
are faster to verify, and use shorter keys. EdDSA (Ed25519) is the fastest and is
recommended when all consumers support it.

**For interoperability:** Use RS256. It has the widest library and platform support.
Nearly every JWT library supports RS256.

**For high-security environments:** Use PS256 (RSA-PSS). It provides a tighter
security reduction compared to PKCS#1 v1.5 (RS256). However, support is less
universal than RS256.

### Algorithms to NEVER Use

**"none" algorithm:** The `"alg": "none"` header indicates an unsigned token. If
a verifier accepts `alg: none`, any attacker can forge tokens by omitting the
signature. Libraries must be configured to reject `alg: none` explicitly.

**HS256 with asymmetric key confusion:** If a system is designed to verify tokens
with an RSA public key but a library also accepts HS256, an attacker can sign a
token using HS256 with the RSA public key as the HMAC secret. Since the public key
is public, the attacker can forge valid tokens. This is the algorithm confusion attack.

### Algorithm Enforcement

The verifier must specify which algorithms are acceptable. Never derive the algorithm
from the token header alone.

```typescript
// WRONG: Trusting the algorithm from the token header
const decoded = jwt.verify(token, publicKey); // Uses alg from header

// CORRECT: Explicitly specifying allowed algorithms
const decoded = jwt.verify(token, publicKey, {
  algorithms: ["RS256"], // Only accept RS256
});
```

---

## Claims Validation

Every JWT consumer must validate ALL of the following claims. Skipping any claim
validation can lead to token misuse or forgery.

### Required Claims

| Claim | Full Name    | Validation Rule                                        |
|-------|-------------|--------------------------------------------------------|
| exp   | Expiration  | Must be in the future. Reject expired tokens.          |
| iat   | Issued At   | Must be in the past. Reject tokens issued in the future.|
| nbf   | Not Before  | Must be in the past or present. Reject tokens used before their valid time. |
| iss   | Issuer      | Must match the expected authorization server URL exactly. |
| aud   | Audience    | Must include the identifier of the service validating the token. |
| sub   | Subject     | Must be a valid user or client identifier.             |

### Clock Skew Tolerance

Allow a small clock skew tolerance (maximum 30 seconds) to account for differences
between server clocks. Do not set clock skew tolerance greater than 60 seconds.

```typescript
const decoded = jwt.verify(token, publicKey, {
  algorithms: ["RS256"],
  issuer: "https://auth.example.com",
  audience: "https://api.example.com",
  clockTolerance: 30, // 30 seconds
});
```

### JTI (JWT ID) Claim

The `jti` claim provides a unique identifier for the token. Use it for:

1. **Replay prevention:** Cache `jti` values and reject tokens with duplicate IDs.
2. **Token revocation:** Add revoked `jti` values to a blacklist.

---

## JWK and JWKS Endpoint

### JWK (JSON Web Key)

A JWK is a JSON representation of a cryptographic key. It includes the key type,
algorithm, key parameters, and a key ID.

```json
{
  "kty": "RSA",
  "use": "sig",
  "kid": "2024-key-1",
  "alg": "RS256",
  "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM...",
  "e": "AQAB"
}
```

### JWKS Endpoint

The JWKS (JSON Web Key Set) endpoint publishes the public keys used to verify JWTs.
It is hosted at a well-known URL by the authorization server.

```
GET https://auth.example.com/.well-known/jwks.json

Response:
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "2024-key-1",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    },
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "2024-key-2",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

### JWKS Caching

Fetch and cache the JWKS with the following strategy:

1. Cache the JWKS for 24 hours (or based on Cache-Control headers).
2. If a token arrives with an unknown `kid`, refresh the JWKS cache.
3. If the `kid` is still unknown after refresh, reject the token.
4. Rate-limit JWKS refresh to prevent denial-of-service (maximum 1 refresh per minute).

```typescript
import { createRemoteJWKSet } from "jose";

// Creates a cached JWKS fetcher
const JWKS = createRemoteJWKSet(
  new URL("https://auth.example.com/.well-known/jwks.json")
);

// Usage: jose automatically handles caching and kid matching
import { jwtVerify } from "jose";

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://auth.example.com",
    audience: "https://api.example.com",
    algorithms: ["RS256"],
    clockTolerance: 30,
  });

  return payload;
}
```

---

## Key Rotation Strategy

Key rotation is essential for limiting the impact of key compromise and following
cryptographic best practices.

### Rotation Process

1. **Generate a new key pair** with a new `kid` (key identifier).
2. **Publish the new public key** in the JWKS endpoint alongside the old key.
3. **Start signing new tokens** with the new private key.
4. **Wait for all old tokens to expire** (at least the maximum token lifetime).
5. **Remove the old public key** from the JWKS endpoint.

### Timeline

| Phase                      | Duration         | Action                           |
|----------------------------|------------------|----------------------------------|
| New key published          | T+0              | Add new key to JWKS              |
| Signing switch             | T+1 hour         | Sign new tokens with new key     |
| Overlap period             | T+1h to T+25h    | Both keys in JWKS for validation |
| Old key removal            | T+25 hours       | Remove old key from JWKS         |

The overlap period must be at least as long as the maximum token lifetime plus the
JWKS cache duration. If access tokens live 15 minutes and JWKS is cached for 24
hours, the overlap period must be at least 24 hours and 15 minutes.

### Automated Key Rotation

```typescript
interface SigningKeyMetadata {
  kid: string;
  algorithm: string;
  createdAt: Date;
  activeSigning: boolean;
  retireAt: Date | null;
}

class KeyRotationManager {
  private rotationIntervalDays: number = 90;
  private overlapHours: number = 25;

  async rotateKey(): Promise<void> {
    // 1. Generate new key pair
    const newKey = await generateKeyPair("RS256");
    const newKid = `${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;

    // 2. Store private key in secrets manager
    await secretsManager.store(`jwt-signing-key-${newKid}`, newKey.privateKey);

    // 3. Add public key to JWKS
    await jwksStore.addKey({
      kid: newKid,
      publicKey: newKey.publicKey,
      algorithm: "RS256",
    });

    // 4. Mark new key as active signing key (after 1 hour propagation)
    setTimeout(async () => {
      await jwksStore.setActiveSigningKey(newKid);
    }, 3600000);

    // 5. Schedule old key removal
    const oldKid = await jwksStore.getActiveSigningKey();
    setTimeout(async () => {
      await jwksStore.removeKey(oldKid);
      await secretsManager.delete(`jwt-signing-key-${oldKid}`);
    }, this.overlapHours * 3600000);
  }
}
```

---

## JWE (Encrypted JWT)

When JWT payloads contain sensitive data, use JWE (JSON Web Encryption) to encrypt
the token. JWE provides confidentiality in addition to JWS integrity.

### JWE Structure

A JWE token has five Base64URL-encoded parts:

```
header.encryptedKey.iv.ciphertext.tag
```

### When to Use JWE

1. Token payloads contain PII (email, phone number, address).
2. Token payloads contain authorization claims that should not be visible to intermediaries.
3. Tokens pass through untrusted networks or proxy layers.
4. Compliance requirements mandate encryption of tokens in transit.

### JWE Implementation

```typescript
import { EncryptJWT, jwtDecrypt } from "jose";

// Encrypt a JWT
async function createEncryptedJWT(
  payload: Record<string, any>,
  encryptionKey: CryptoKey
): Promise<string> {
  const jwt = await new EncryptJWT(payload)
    .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM" })
    .setIssuedAt()
    .setIssuer("https://auth.example.com")
    .setAudience("https://api.example.com")
    .setExpirationTime("15m")
    .encrypt(encryptionKey);

  return jwt;
}

// Decrypt and validate a JWE
async function decryptJWT(
  token: string,
  decryptionKey: CryptoKey
): Promise<Record<string, any>> {
  const { payload } = await jwtDecrypt(token, decryptionKey, {
    issuer: "https://auth.example.com",
    audience: "https://api.example.com",
  });

  return payload as Record<string, any>;
}
```

### Nested JWT (Signed then Encrypted)

For maximum security, sign the JWT first (JWS), then encrypt it (JWE). This provides
both integrity (signature) and confidentiality (encryption).

```
JWE( JWS( payload ) )
```

The recipient first decrypts the JWE to obtain the JWS, then verifies the JWS
signature to obtain the payload.

---

## JWT Size Concerns

### Size Limits

JWTs can grow large when they contain many claims. This causes problems with:

1. **HTTP headers:** Most web servers and proxies have header size limits (8 KB default
   for nginx, 16 KB for Apache). A large JWT in the Authorization header can exceed
   these limits.

2. **Cookies:** Browser cookie size limits are typically 4 KB per cookie. JWTs stored
   in cookies can easily exceed this limit.

3. **Network overhead:** Every API request carries the full JWT, increasing bandwidth
   consumption.

### Size Reduction Strategies

1. **Minimize claims.** Include only essential claims in the access token. Use the
   UserInfo endpoint or a separate API call for additional user data.

2. **Use short claim names.** Use standard short names (`sub`, `iss`, `exp`) instead
   of verbose custom names.

3. **Use ECDSA or EdDSA.** These algorithms produce 64-byte signatures compared to
   256 bytes for RSA, saving approximately 250 bytes per token.

4. **Use opaque reference tokens.** Instead of self-contained JWTs, use short opaque
   strings that reference server-side token data. The resource server resolves the
   reference via token introspection (RFC 7662).

5. **Split cookies.** If the JWT exceeds cookie limits, split it across multiple
   cookies and reassemble on the server side. This adds complexity but works.

### Size Comparison

| Component              | Typical Size |
|------------------------|-------------|
| Minimal JWT (RS256)    | ~800 bytes  |
| Minimal JWT (ES256)    | ~500 bytes  |
| JWT with 10 claims     | ~1200 bytes |
| JWT with roles/perms   | ~2000 bytes |
| Opaque reference token | ~32 bytes   |

---

## Access and Refresh Token Pattern

### Design

```
Client -> Auth Server: Authenticate (credentials + MFA)
Auth Server -> Client: Access Token (15min) + Refresh Token (7 days)

Client -> Resource Server: API request + Access Token
Resource Server -> Client: Response

[Access token expires after 15 minutes]

Client -> Auth Server: Refresh request + Refresh Token
Auth Server -> Client: New Access Token + New Refresh Token (rotation)
```

### Implementation

```typescript
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class TokenService {
  private signingKey: CryptoKey;
  private accessTokenTTL: number = 900; // 15 minutes
  private refreshTokenTTL: number = 604800; // 7 days

  constructor(signingKey: CryptoKey) {
    this.signingKey = signingKey;
  }

  async issueTokenPair(
    userId: string,
    scopes: string[],
    clientId: string
  ): Promise<TokenPair> {
    const jti = crypto.randomUUID();

    const accessToken = await new SignJWT({
      sub: userId,
      scope: scopes.join(" "),
      client_id: clientId,
    })
      .setProtectedHeader({ alg: "ES256", kid: "current-key" })
      .setIssuedAt()
      .setIssuer("https://auth.example.com")
      .setAudience("https://api.example.com")
      .setExpirationTime(`${this.accessTokenTTL}s`)
      .setJti(jti)
      .sign(this.signingKey);

    // Refresh token is opaque -- stored server-side
    const refreshToken = crypto.randomBytes(48).toString("base64url");

    // Store refresh token metadata
    await this.storeRefreshToken(refreshToken, {
      userId,
      scopes,
      clientId,
      familyId: crypto.randomUUID(), // For rotation tracking
      expiresAt: new Date(Date.now() + this.refreshTokenTTL * 1000),
      issuedAt: new Date(),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTTL,
    };
  }

  async refresh(oldRefreshToken: string): Promise<TokenPair> {
    const tokenData = await this.getRefreshToken(oldRefreshToken);

    if (!tokenData) {
      throw new Error("Invalid refresh token");
    }

    if (tokenData.revoked) {
      // Reuse detected: revoke entire family
      await this.revokeTokenFamily(tokenData.familyId);
      throw new Error("Refresh token reuse detected -- all tokens revoked");
    }

    if (new Date() > tokenData.expiresAt) {
      throw new Error("Refresh token expired");
    }

    // Revoke old refresh token
    await this.revokeRefreshToken(oldRefreshToken);

    // Issue new token pair with same family ID
    return this.issueTokenPairWithFamily(
      tokenData.userId,
      tokenData.scopes,
      tokenData.clientId,
      tokenData.familyId
    );
  }

  private async storeRefreshToken(token: string, metadata: any): Promise<void> {
    // Store in database with the token hash (not plaintext)
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    await db.refreshTokens.insert({ tokenHash, ...metadata, revoked: false });
  }

  private async revokeTokenFamily(familyId: string): Promise<void> {
    await db.refreshTokens.updateMany(
      { familyId },
      { $set: { revoked: true } }
    );
  }
}
```

---

## Token Revocation

JWTs are stateless by design, which makes revocation challenging. There are several
strategies, each with trade-offs.

### Strategy 1: Short-Lived Tokens (Recommended)

Set access token expiration to 15 minutes or less. When revocation is needed (logout,
password change), revoke the refresh token. The access token remains valid for at most
15 more minutes.

**Pros:** Simple, no additional infrastructure.
**Cons:** Up to 15-minute window where revoked tokens are still valid.

### Strategy 2: Token Blacklist

Maintain a blacklist of revoked token IDs (`jti` claims). Check the blacklist on
every token validation.

```go
package jwt

import (
    "context"
    "time"

    "github.com/redis/go-redis/v9"
)

type TokenBlacklist struct {
    redis *redis.Client
}

func NewTokenBlacklist(redis *redis.Client) *TokenBlacklist {
    return &TokenBlacklist{redis: redis}
}

func (b *TokenBlacklist) Revoke(ctx context.Context, jti string, expiresAt time.Time) error {
    // Store in blacklist until the token would naturally expire
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil // Already expired, no need to blacklist
    }
    return b.redis.Set(ctx, "jwt:blacklist:"+jti, "1", ttl).Err()
}

func (b *TokenBlacklist) IsRevoked(ctx context.Context, jti string) (bool, error) {
    result, err := b.redis.Exists(ctx, "jwt:blacklist:"+jti).Result()
    if err != nil {
        // Fail closed: treat errors as revoked to prevent accepting
        // potentially revoked tokens
        return true, err
    }
    return result > 0, nil
}
```

**Pros:** Immediate revocation.
**Cons:** Requires a fast, distributed cache (Redis). Adds a network call to every
token validation. If the cache is unavailable, must decide whether to fail open or
closed.

### Strategy 3: Stateful JWT (Versioned)

Include a version number in the JWT claims. Store the current expected version per user.
On revocation, increment the version. Reject tokens with old versions.

```typescript
interface StatefulJWTClaims extends JWTPayload {
  sub: string;
  tokenVersion: number;
}

async function validateStatefulJWT(
  token: string,
  publicKey: CryptoKey
): Promise<StatefulJWTClaims | null> {
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ["ES256"],
    issuer: "https://auth.example.com",
    audience: "https://api.example.com",
  });

  const claims = payload as StatefulJWTClaims;

  // Check token version against stored version
  const currentVersion = await getUserTokenVersion(claims.sub);
  if (claims.tokenVersion < currentVersion) {
    return null; // Token is revoked (version mismatch)
  }

  return claims;
}

async function revokeAllUserTokens(userId: string): Promise<void> {
  await incrementUserTokenVersion(userId);
}
```

---

## Audience Restriction

The `aud` (audience) claim restricts which services can accept a token. Without
audience validation, a token intended for one API can be replayed against another.

### Multi-Audience Tokens

If an access token must be valid for multiple resource servers, include all of them
in the `aud` claim as an array:

```json
{
  "aud": ["https://api.example.com", "https://billing.example.com"]
}
```

Each resource server must verify that its own identifier is included in the `aud` array.

### Scoped Tokens

Prefer issuing tokens scoped to a single audience. If a client needs to access
multiple APIs, request separate tokens for each. This follows the principle of least
privilege and limits the damage from token theft.

---

## Common Attacks and Mitigations

### 1. Algorithm Confusion Attack

**Attack:** The attacker changes the `alg` header from `RS256` to `HS256` and signs
the token using the RSA public key as the HMAC secret. If the verifier trusts the
`alg` header and uses the public key for HMAC verification, the forged token is accepted.

**Mitigation:** Always specify allowed algorithms explicitly in the verifier
configuration. Never derive the algorithm from the token header.

```typescript
// Vulnerable
jwt.verify(token, publicKey); // Trusts alg from header

// Secure
jwt.verify(token, publicKey, { algorithms: ["RS256"] });
```

### 2. "none" Algorithm Attack

**Attack:** The attacker sets `"alg": "none"` and removes the signature. If the
library accepts unsigned tokens, any claim can be forged.

**Mitigation:** Reject `alg: none` explicitly. Most modern libraries do this by
default, but always verify by specifying allowed algorithms.

### 3. Key Injection in Header

**Attack:** Some libraries support a `jwk` or `jku` header parameter that specifies
the key or key URL to use for verification. An attacker can inject their own public
key in the header and sign the token with the corresponding private key.

**Mitigation:** Never accept keys from the token header (`jwk`, `jku`, `x5u`, `x5c`).
Always resolve keys from a trusted JWKS endpoint or local key store based on the `kid`.

```go
// Go: Never trust key material from the token
func verifyToken(tokenString string) (*jwt.Token, error) {
    return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        // Verify the algorithm
        if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }

        // Use kid to look up the key from a trusted source
        kid, ok := token.Header["kid"].(string)
        if !ok {
            return nil, fmt.Errorf("missing kid in token header")
        }

        // Fetch from trusted JWKS, not from the token
        return getPublicKeyFromJWKS(kid)
    })
}
```

### 4. Expired Token Replay

**Attack:** An attacker captures a valid token and replays it after expiration,
hoping the verifier does not check the `exp` claim.

**Mitigation:** Always validate the `exp` claim. Set strict clock skew tolerance
(maximum 30 seconds). For high-security scenarios, also use the `jti` claim with
replay detection.

### 5. Weak Secrets for HS256

**Attack:** If HS256 is used with a weak secret (e.g., "secret", "password123"),
the attacker can brute-force the secret using tools like hashcat or jwt-cracker,
then forge arbitrary tokens.

**Mitigation:** If HS256 must be used, the secret must be at least 256 bits (32
bytes) of random data. Prefer asymmetric algorithms (RS256, ES256) where the
signing key is never distributed.

### 6. Cross-Service Token Confusion

**Attack:** A token issued for Service A is presented to Service B. If Service B
does not validate the `aud` claim, it accepts the token, potentially granting
unauthorized access.

**Mitigation:** Always validate the `aud` claim matches the current service's
identifier. Issue audience-restricted tokens.

---

## Implementation Examples

### TypeScript (jose library)

```typescript
import {
  SignJWT,
  jwtVerify,
  createRemoteJWKSet,
  importPKCS8,
  importSPKI,
  type JWTPayload,
  type KeyLike,
} from "jose";

// Token creation
async function createAccessToken(
  privateKey: KeyLike,
  claims: {
    sub: string;
    scope: string;
    roles: string[];
  }
): Promise<string> {
  return new SignJWT({
    scope: claims.scope,
    roles: claims.roles,
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: "current-key-id" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("https://auth.example.com")
    .setAudience("https://api.example.com")
    .setExpirationTime("15m")
    .setNotBefore("0s")
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

// Token verification with full validation
async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const JWKS = createRemoteJWKSet(
    new URL("https://auth.example.com/.well-known/jwks.json")
  );

  const { payload } = await jwtVerify(token, JWKS, {
    algorithms: ["ES256"],
    issuer: "https://auth.example.com",
    audience: "https://api.example.com",
    clockTolerance: 30,
    requiredClaims: ["sub", "scope", "jti"],
  });

  return payload;
}

// Express middleware for JWT validation
function jwtAuthMiddleware(requiredScope: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const token = authHeader.substring(7);

    try {
      const payload = await verifyAccessToken(token);

      // Validate scope
      const tokenScopes = (payload.scope as string)?.split(" ") || [];
      if (!tokenScopes.includes(requiredScope)) {
        return res.status(403).json({ error: "Insufficient scope" });
      }

      // Attach user info to request
      req.user = {
        id: payload.sub!,
        scopes: tokenScopes,
        roles: payload.roles as string[],
      };

      next();
    } catch (error) {
      if (error.code === "ERR_JWT_EXPIRED") {
        return res.status(401).json({ error: "Token expired" });
      }
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}
```

### Go (golang-jwt/jwt)

```go
package auth

import (
    "crypto/ecdsa"
    "fmt"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
)

type CustomClaims struct {
    jwt.RegisteredClaims
    Scope string   `json:"scope"`
    Roles []string `json:"roles"`
}

type JWTService struct {
    privateKey *ecdsa.PrivateKey
    publicKey  *ecdsa.PublicKey
    issuer     string
    audience   string
}

func NewJWTService(privateKey *ecdsa.PrivateKey, issuer, audience string) *JWTService {
    return &JWTService{
        privateKey: privateKey,
        publicKey:  &privateKey.PublicKey,
        issuer:     issuer,
        audience:   audience,
    }
}

func (s *JWTService) CreateAccessToken(userID string, scope string, roles []string) (string, error) {
    now := time.Now()
    claims := CustomClaims{
        RegisteredClaims: jwt.RegisteredClaims{
            Issuer:    s.issuer,
            Subject:   userID,
            Audience:  jwt.ClaimStrings{s.audience},
            ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(now),
            NotBefore: jwt.NewNumericDate(now),
            ID:        uuid.New().String(),
        },
        Scope: scope,
        Roles: roles,
    }

    token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
    token.Header["kid"] = "current-key-id"

    return token.SignedString(s.privateKey)
}

func (s *JWTService) ValidateAccessToken(tokenString string) (*CustomClaims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{},
        func(token *jwt.Token) (interface{}, error) {
            // Verify algorithm
            if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
            }
            return s.publicKey, nil
        },
        jwt.WithIssuer(s.issuer),
        jwt.WithAudience(s.audience),
        jwt.WithLeeway(30*time.Second),
        jwt.WithValidMethods([]string{"ES256"}),
    )

    if err != nil {
        return nil, fmt.Errorf("token validation failed: %w", err)
    }

    claims, ok := token.Claims.(*CustomClaims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid token claims")
    }

    // Validate required custom claims
    if claims.Scope == "" {
        return nil, fmt.Errorf("missing scope claim")
    }

    return claims, nil
}
```

### Python (PyJWT)

```python
import jwt
import time
import uuid
from typing import Any
import httpx

class JWTService:
    def __init__(self, private_key: str, public_key: str, issuer: str, audience: str):
        self.private_key = private_key
        self.public_key = public_key
        self.issuer = issuer
        self.audience = audience

    def create_access_token(
        self, user_id: str, scope: str, roles: list[str]
    ) -> str:
        """Create a signed JWT access token."""
        now = int(time.time())
        payload = {
            "iss": self.issuer,
            "sub": user_id,
            "aud": self.audience,
            "exp": now + 900,  # 15 minutes
            "iat": now,
            "nbf": now,
            "jti": str(uuid.uuid4()),
            "scope": scope,
            "roles": roles,
        }

        return jwt.encode(
            payload,
            self.private_key,
            algorithm="ES256",
            headers={"kid": "current-key-id"},
        )

    def validate_access_token(self, token: str) -> dict[str, Any]:
        """Validate and decode a JWT access token."""
        try:
            payload = jwt.decode(
                token,
                self.public_key,
                algorithms=["ES256"],  # Explicit algorithm whitelist
                issuer=self.issuer,
                audience=self.audience,
                options={
                    "require": ["exp", "iat", "nbf", "iss", "aud", "sub", "jti", "scope"],
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_nbf": True,
                    "verify_iss": True,
                    "verify_aud": True,
                },
                leeway=30,  # 30 seconds clock skew tolerance
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.InvalidAudienceError:
            raise ValueError("Invalid audience")
        except jwt.InvalidIssuerError:
            raise ValueError("Invalid issuer")
        except jwt.InvalidTokenError as e:
            raise ValueError(f"Invalid token: {e}")


class JWKSClient:
    """Fetch and cache JWKS for token verification."""

    def __init__(self, jwks_url: str, cache_ttl: int = 86400):
        self.jwks_url = jwks_url
        self.cache_ttl = cache_ttl
        self._jwks_cache = None
        self._cache_expires_at = 0

    def get_signing_key(self, kid: str) -> str:
        """Get the public key for the given kid from the JWKS."""
        jwks = self._get_jwks()
        jwks_client = jwt.PyJWKClient(self.jwks_url)
        signing_key = jwks_client.get_signing_key(kid)
        return signing_key.key

    def _get_jwks(self) -> dict:
        if self._jwks_cache and time.time() < self._cache_expires_at:
            return self._jwks_cache

        response = httpx.get(self.jwks_url, timeout=10)
        response.raise_for_status()
        self._jwks_cache = response.json()
        self._cache_expires_at = time.time() + self.cache_ttl

        return self._jwks_cache
```

---

## Best Practices

1. **Always specify allowed algorithms explicitly in the verifier.** Never trust the `alg` header in the token. This prevents algorithm confusion attacks and the "none" algorithm attack. Configure the verifier with a whitelist of acceptable algorithms.

2. **Use asymmetric algorithms (RS256, ES256, EdDSA) for distributed systems.** Asymmetric algorithms allow the signing key to remain secret on the authorization server while public keys are distributed to resource servers. This eliminates the risk of key compromise at the resource server level.

3. **Validate all standard claims on every token verification.** Always verify `exp`, `iat`, `nbf`, `iss`, `aud`, and `sub`. Use the `jti` claim for replay protection in high-security scenarios. Set clock skew tolerance to a maximum of 30 seconds.

4. **Keep access tokens short-lived (15 minutes maximum).** Short-lived tokens limit the window of exploitation if a token is stolen. Combine with refresh token rotation for seamless user experience without long-lived access tokens.

5. **Never resolve signing keys from the token header.** Do not trust `jwk`, `jku`, `x5u`, or `x5c` header parameters. Always resolve keys from a trusted, pre-configured JWKS endpoint based on the `kid` claim.

6. **Implement key rotation with overlap periods.** Publish new keys before using them for signing. Maintain old keys in the JWKS until all tokens signed with them have expired. Automate rotation on a 90-day cycle.

7. **Use JWE for tokens containing sensitive data.** JWT payloads are Base64URL-encoded, not encrypted. If the token contains PII or sensitive claims, wrap the JWS in a JWE layer. Use nested JWT (sign-then-encrypt) for both integrity and confidentiality.

8. **Minimize JWT payload size.** Include only essential claims. Use short claim names. Prefer ES256 or EdDSA over RSA for smaller signature sizes. Consider opaque reference tokens when JWT size is problematic.

9. **Implement token revocation for security-critical events.** Use short-lived tokens as the primary strategy. Supplement with a token blacklist (Redis) or versioned tokens for immediate revocation on logout, password change, or security incidents.

10. **Log token validation failures for security monitoring.** Log (without logging the token value) all validation failures including the reason (expired, bad signature, wrong audience, etc.). Alert on patterns indicating attack attempts (algorithm confusion, expired token replay).

---

## Anti-Patterns

1. **Trusting the algorithm from the token header.** This is the root cause of algorithm confusion attacks. If the verifier reads the `alg` from the header and selects the verification method accordingly, attackers can switch algorithms and forge tokens.

2. **Using HS256 with weak or shared secrets.** HS256 secrets must be at least 256 bits of random data. Short, human-readable secrets ("mysecret", "jwt-key") can be brute-forced in seconds. When HS256 secrets are shared across services, any service can forge tokens impersonating any other.

3. **Storing sensitive data in unencrypted JWT payloads.** Base64URL encoding is NOT encryption. Anyone who intercepts the token can decode and read all claims. Use JWE if the payload must contain sensitive information.

4. **Not validating the audience claim.** Without audience validation, a token intended for `api-a.example.com` can be replayed against `api-b.example.com`. Each resource server must validate that its identifier is in the token's `aud` claim.

5. **Using JWTs as long-lived session tokens.** JWTs with 24-hour or multi-day expiration are difficult to revoke and provide a wide attack window. Use short-lived JWTs (15 minutes) with refresh tokens, or use server-side sessions instead.

6. **Accepting tokens from untrusted issuers.** If the `iss` claim is not validated, an attacker can set up their own authorization server, issue tokens with arbitrary claims, and present them to the resource server.

7. **Implementing custom JWT parsing and verification.** JWT libraries handle Base64URL encoding, signature verification, and claims validation with tested, audited code. Custom implementations invariably introduce subtle bugs (incorrect padding, timing attacks, incomplete validation).

8. **Ignoring the `nbf` (Not Before) claim.** The `nbf` claim specifies the earliest time a token is valid. Skipping this check allows tokens to be used before they are intended to be valid, which can enable certain pre-play attacks in scheduled-token scenarios.

---

## Enforcement Checklist

### Design Phase
- [ ] Selected signing algorithm based on use case (ES256/EdDSA for new systems, RS256 for interop).
- [ ] Defined token lifetimes (access: 15min max, refresh: based on risk assessment).
- [ ] Designed key rotation strategy with overlap periods.
- [ ] Defined claims schema with all required claims documented.
- [ ] Decided on revocation strategy (short-lived, blacklist, or versioned).
- [ ] Assessed need for JWE based on payload sensitivity.

### Implementation Phase
- [ ] Algorithm whitelist is configured explicitly in all verifiers.
- [ ] "none" algorithm is rejected (verified by test case).
- [ ] All six standard claims (exp, iat, nbf, iss, aud, sub) are validated.
- [ ] Clock skew tolerance is set to maximum 30 seconds.
- [ ] `kid` header is used to select verification keys from a trusted JWKS.
- [ ] Keys are never resolved from token headers (jwk, jku, x5u, x5c rejected).
- [ ] JWKS endpoint is implemented with caching and rate-limited refresh.
- [ ] Token size is within acceptable limits for all transport mechanisms.
- [ ] Token blacklist or versioning is implemented for revocation.
- [ ] Sensitive data is encrypted (JWE) or excluded from JWT payloads.
- [ ] JWT library is a well-maintained, widely used implementation.

### Testing Phase
- [ ] Algorithm confusion attack is tested and blocked.
- [ ] "none" algorithm tokens are rejected.
- [ ] Expired tokens are rejected.
- [ ] Tokens with wrong issuer are rejected.
- [ ] Tokens with wrong audience are rejected.
- [ ] Tokens with future `nbf` are rejected.
- [ ] Key rotation does not break existing token validation.
- [ ] Token revocation works within defined SLA.
- [ ] Brute-force resistance of HS256 secret is verified (if HS256 is used).

### Deployment Phase
- [ ] Signing keys are stored in a secrets manager or HSM.
- [ ] JWKS endpoint is publicly accessible and monitored.
- [ ] Key rotation automation is deployed and tested.
- [ ] Token validation failure monitoring and alerting is configured.
- [ ] Logging does not include token values (only metadata).

### Periodic Review
- [ ] Signing key rotation occurs on schedule (every 90 days).
- [ ] JWT library is updated to latest version.
- [ ] Token lifetime appropriateness is reviewed.
- [ ] Claims schema is reviewed for unnecessary data.
- [ ] Blacklist/revocation system performance is adequate.
