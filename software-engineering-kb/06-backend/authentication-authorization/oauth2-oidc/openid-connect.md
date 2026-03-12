# OpenID Connect (OIDC)

> **AI Plugin Directive — OpenID Connect**
> You are an AI coding assistant. When generating, reviewing, or refactoring OIDC-based authentication
> code, follow EVERY rule in this document. OIDC extends OAuth 2.0 with a standardized identity layer.
> Misimplementations lead to authentication bypasses. Treat each section as a non-negotiable requirement.

**Core Rule: ALWAYS validate the ID token signature, issuer, audience, and expiration. NEVER use the `access_token` for user identification — use the `id_token` claims. NEVER trust user profile data from the `userinfo` endpoint without verifying the ID token first.**

---

## 1. OIDC vs OAuth 2.0

| Aspect | OAuth 2.0 | OpenID Connect |
|--------|-----------|----------------|
| Purpose | Authorization (access to resources) | Authentication (user identity) |
| Token | Access token (opaque) | ID token (JWT) + access token |
| User info | No standard | Standardized claims |
| Discovery | No standard | `/.well-known/openid-configuration` |
| Scope | Application-defined | Standard: `openid`, `profile`, `email` |
| Protocol | Authorization framework | Authentication protocol ON TOP of OAuth 2.0 |
| Output | "Can this app access my data?" | "Who is this user?" |

```
┌──────────────────────────────────────────────────┐
│           OIDC Layers on OAuth 2.0               │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │          OpenID Connect (OIDC)              │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  ID Token  │  UserInfo  │  Discovery  │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │          OAuth 2.0 Framework               │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  AuthZ Code │  Tokens  │  Scopes     │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │          HTTP / TLS Transport              │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

ALWAYS require the `openid` scope when using OIDC. Without it, the server will NOT return an ID token.

---

## 2. ID Token Structure

The ID token is a JWT that contains authenticated user identity claims:

```json
{
  "iss": "https://accounts.google.com",
  "sub": "110248495921238986420",
  "aud": "your-client-id.apps.googleusercontent.com",
  "exp": 1700000000,
  "iat": 1699996400,
  "auth_time": 1699996380,
  "nonce": "n-0S6_WzA2Mj",
  "at_hash": "HK6E_P6Dh8Y93mRNtsDB1Q",
  "email": "user@gmail.com",
  "email_verified": true,
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/photo.jpg",
  "given_name": "John",
  "family_name": "Doe",
  "locale": "en"
}
```

### 2.1 Required Claims

| Claim | Description | Validation Rule |
|-------|-------------|-----------------|
| `iss` | Issuer identifier | MUST match expected issuer exactly |
| `sub` | Subject (unique user ID) | MUST be unique per issuer, stable |
| `aud` | Audience (your client_id) | MUST contain your `client_id` |
| `exp` | Expiration time | MUST be in the future |
| `iat` | Issued at | MUST be in the past (with clock skew) |
| `nonce` | Anti-replay | MUST match the nonce you sent (if sent) |
| `auth_time` | When user authenticated | Required if `max_age` requested |
| `at_hash` | Access token hash | Validates access token binding |

### 2.2 Standard Scopes & Claims

| Scope | Claims Returned |
|-------|----------------|
| `openid` | `sub` (required for OIDC) |
| `profile` | `name`, `family_name`, `given_name`, `middle_name`, `nickname`, `preferred_username`, `picture`, `website`, `gender`, `birthdate`, `zoneinfo`, `locale`, `updated_at` |
| `email` | `email`, `email_verified` |
| `phone` | `phone_number`, `phone_number_verified` |
| `address` | `address` (structured object) |
| `offline_access` | Enables refresh token issuance |

---

## 3. ID Token Validation

ALWAYS validate ID tokens. NEVER trust claims without verification.

**TypeScript (jose)**
```typescript
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

interface IDTokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
  at_hash?: string;
}

class IDTokenValidator {
  private jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private issuer: string,
    private clientId: string,
    jwksUri: string
  ) {
    // Cache and auto-rotate JWKS
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  async validate(
    idToken: string,
    expectedNonce?: string
  ): Promise<IDTokenClaims> {
    // 1. Verify signature + standard claims
    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: this.issuer,
      audience: this.clientId,
      algorithms: ["RS256", "ES256"],
      clockTolerance: 30, // 30 seconds clock skew tolerance
    });

    const claims = payload as IDTokenClaims;

    // 2. Validate nonce (anti-replay)
    if (expectedNonce && claims.nonce !== expectedNonce) {
      throw new Error("Invalid nonce — possible replay attack");
    }

    // 3. Validate sub exists
    if (!claims.sub) {
      throw new Error("Missing sub claim");
    }

    return claims;
  }

  // Validate at_hash (access token binding)
  validateAccessTokenHash(
    idToken: IDTokenClaims,
    accessToken: string,
    algorithm: string = "RS256"
  ): boolean {
    const hashAlg = algorithm.startsWith("RS") ? "sha256" : "sha256";
    const hash = crypto.createHash(hashAlg).update(accessToken).digest();
    const halfHash = hash.subarray(0, hash.length / 2);
    const expectedAtHash = Buffer.from(halfHash)
      .toString("base64url");

    return idToken.at_hash === expectedAtHash;
  }
}

// Usage
const validator = new IDTokenValidator(
  "https://accounts.google.com",
  "your-client-id.apps.googleusercontent.com",
  "https://www.googleapis.com/oauth2/v3/certs"
);

const claims = await validator.validate(tokens.id_token, storedNonce);
console.log(claims.sub);   // "110248495921238986420"
console.log(claims.email); // "user@gmail.com"
```

**Go (coreos/go-oidc)**
```go
package auth

import (
    "context"

    "github.com/coreos/go-oidc/v3/oidc"
    "golang.org/x/oauth2"
)

type OIDCVerifier struct {
    provider *oidc.Provider
    verifier *oidc.IDTokenVerifier
    config   *oauth2.Config
}

func NewOIDCVerifier(ctx context.Context, issuer, clientID string) (*OIDCVerifier, error) {
    provider, err := oidc.NewProvider(ctx, issuer)
    if err != nil {
        return nil, fmt.Errorf("discover provider: %w", err)
    }

    verifier := provider.Verifier(&oidc.Config{
        ClientID: clientID,
    })

    return &OIDCVerifier{
        provider: provider,
        verifier: verifier,
    }, nil
}

func (v *OIDCVerifier) VerifyIDToken(ctx context.Context, rawIDToken string) (*oidc.IDToken, error) {
    // Verifies signature, issuer, audience, and expiration
    idToken, err := v.verifier.Verify(ctx, rawIDToken)
    if err != nil {
        return nil, fmt.Errorf("verify ID token: %w", err)
    }

    return idToken, nil
}

type UserClaims struct {
    Email         string `json:"email"`
    EmailVerified bool   `json:"email_verified"`
    Name          string `json:"name"`
    Picture       string `json:"picture"`
}

func (v *OIDCVerifier) ExtractClaims(idToken *oidc.IDToken) (*UserClaims, error) {
    var claims UserClaims
    if err := idToken.Claims(&claims); err != nil {
        return nil, fmt.Errorf("extract claims: %w", err)
    }
    return &claims, nil
}
```

**Python (PyJWT with JWKS)**
```python
import jwt
from jwt import PyJWKClient

class IDTokenValidator:
    def __init__(self, issuer: str, client_id: str, jwks_uri: str):
        self.issuer = issuer
        self.client_id = client_id
        self.jwks_client = PyJWKClient(jwks_uri, cache_keys=True)

    def validate(self, id_token: str, expected_nonce: str | None = None) -> dict:
        # Fetch signing key from JWKS
        signing_key = self.jwks_client.get_signing_key_from_jwt(id_token)

        # Verify signature, issuer, audience, expiration
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            issuer=self.issuer,
            audience=self.client_id,
            options={
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": True,
                "require": ["sub", "iss", "aud", "exp", "iat"],
            },
            leeway=30,  # 30 seconds clock skew tolerance
        )

        # Validate nonce
        if expected_nonce and claims.get("nonce") != expected_nonce:
            raise ValueError("Invalid nonce — possible replay attack")

        return claims

# Usage
validator = IDTokenValidator(
    issuer="https://accounts.google.com",
    client_id="your-client-id.apps.googleusercontent.com",
    jwks_uri="https://www.googleapis.com/oauth2/v3/certs",
)

claims = validator.validate(id_token, expected_nonce=stored_nonce)
```

---

## 4. UserInfo Endpoint

The UserInfo endpoint provides additional user claims beyond what's in the ID token:

```typescript
async function fetchUserInfo(
  userinfoEndpoint: string,
  accessToken: string
): Promise<UserProfile> {
  const response = await fetch(userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`UserInfo request failed: ${response.status}`);
  }

  const profile = await response.json();

  // ALWAYS verify the `sub` claim matches the ID token's `sub`
  // This prevents token substitution attacks
  return profile;
}
```

- ALWAYS verify that the `sub` from UserInfo matches the `sub` from the ID token
- NEVER use UserInfo as the sole source of identity — always validate the ID token first
- ALWAYS cache UserInfo responses to reduce network calls
- ALWAYS handle the case where optional claims are missing

---

## 5. User Account Linking

ALWAYS link OAuth/OIDC identities to internal user accounts correctly:

```typescript
interface LinkedIdentity {
  id: string;
  userId: string;
  provider: string;       // "google", "github", "microsoft"
  providerUserId: string; // The `sub` claim from the provider
  email: string;
  createdAt: Date;
}

async function handleOIDCLogin(
  provider: string,
  idTokenClaims: IDTokenClaims
): Promise<{ user: User; isNewUser: boolean }> {
  const providerUserId = idTokenClaims.sub;

  // 1. Check if this provider identity is already linked
  const existingLink = await db.linkedIdentities.findOne({
    provider,
    providerUserId,
  });

  if (existingLink) {
    const user = await db.users.findById(existingLink.userId);
    return { user, isNewUser: false };
  }

  // 2. Check if a user with the same VERIFIED email exists
  if (idTokenClaims.email && idTokenClaims.email_verified) {
    const existingUser = await db.users.findByEmail(idTokenClaims.email);

    if (existingUser) {
      // Link this provider to the existing account
      await db.linkedIdentities.create({
        userId: existingUser.id,
        provider,
        providerUserId,
        email: idTokenClaims.email,
      });
      return { user: existingUser, isNewUser: false };
    }
  }

  // 3. Create a new user account
  const newUser = await db.users.create({
    email: idTokenClaims.email,
    emailVerified: idTokenClaims.email_verified ?? false,
    name: idTokenClaims.name,
    picture: idTokenClaims.picture,
  });

  await db.linkedIdentities.create({
    userId: newUser.id,
    provider,
    providerUserId,
    email: idTokenClaims.email,
  });

  return { user: newUser, isNewUser: true };
}
```

### 5.1 Account Linking Rules

- ALWAYS use the `sub` claim as the primary identifier — NEVER use `email` alone
- ONLY auto-link accounts when the email is VERIFIED (`email_verified: true`)
- NEVER auto-link accounts based on unverified email — this enables account takeover
- ALWAYS allow users to manually link/unlink OAuth providers from account settings
- ALWAYS require re-authentication before linking a new provider to an existing account
- ALWAYS store the `sub` claim per-provider — different providers have different `sub` values

```
Account Linking Security:
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  SAFE: Auto-link when email_verified = true              │
│  ├── Google says user@gmail.com is verified ✅           │
│  ├── Existing account has user@gmail.com                │
│  └── Auto-link Google identity to existing account      │
│                                                          │
│  UNSAFE: Auto-link when email_verified = false ❌        │
│  ├── Attacker creates GitHub with victim@gmail.com       │
│  ├── GitHub does NOT verify email ownership             │
│  ├── Auto-link would give attacker access to victim     │
│  └── NEVER auto-link unverified emails                   │
│                                                          │
│  SAFE: Manual link with re-authentication                │
│  ├── User logged in with password                       │
│  ├── User clicks "Link GitHub Account"                   │
│  ├── User re-enters password for confirmation           │
│  └── Link GitHub identity to current account            │
└─────────────────────────────────────────────────────────┘
```

---

## 6. OIDC Discovery & Configuration

ALWAYS use the discovery document for provider configuration:

```typescript
interface OIDCDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  claims_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  revocation_endpoint?: string;
  end_session_endpoint?: string;
}

async function loadOIDCConfig(issuer: string): Promise<OIDCDiscoveryDocument> {
  const url = `${issuer}/.well-known/openid-configuration`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load OIDC discovery: ${response.status}`);
  }

  const config: OIDCDiscoveryDocument = await response.json();

  // ALWAYS validate the issuer matches
  if (config.issuer !== issuer) {
    throw new Error(
      `Issuer mismatch: expected ${issuer}, got ${config.issuer}`
    );
  }

  return config;
}
```

- ALWAYS cache the discovery document (refresh every 24 hours)
- ALWAYS validate that the `issuer` in the discovery document matches the expected issuer
- ALWAYS use the `jwks_uri` from discovery to fetch signing keys — NEVER hardcode key URLs
- ALWAYS check `id_token_signing_alg_values_supported` for compatible algorithms

---

## 7. Logout

### 7.1 OIDC Logout Types

| Logout Type | Mechanism | User Experience |
|-------------|-----------|-----------------|
| **Local logout** | Clear local session | Logged out of your app only |
| **RP-Initiated** | Redirect to `end_session_endpoint` | Logged out of IdP |
| **Back-channel** | IdP POST to your logout endpoint | Silent, server-to-server |
| **Front-channel** | IdP iframe to your logout URL | Browser-based, less reliable |

### 7.2 Implementation

```typescript
// RP-Initiated Logout
function buildLogoutURL(config: OIDCDiscoveryDocument, idToken: string): string {
  if (!config.end_session_endpoint) {
    throw new Error("Provider does not support RP-initiated logout");
  }

  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: "https://app.com/logged-out",
    // state for CSRF protection on logout callback
    state: crypto.randomBytes(16).toString("hex"),
  });

  return `${config.end_session_endpoint}?${params}`;
}

// Back-Channel Logout Handler
async function handleBackChannelLogout(req: Request, res: Response) {
  const { logout_token } = req.body;

  // Validate logout token
  const { payload } = await jwtVerify(logout_token, jwks, {
    issuer: issuer,
    audience: clientId,
    algorithms: ["RS256"],
  });

  // MUST contain either sub or sid (session ID)
  const userId = payload.sub;
  const sessionId = payload.sid;

  if (!userId && !sessionId) {
    return res.status(400).json({ error: "Invalid logout token" });
  }

  // Invalidate sessions
  if (userId) {
    await db.sessions.deleteMany({ userId });
  }
  if (sessionId) {
    await db.sessions.delete({ oidcSessionId: sessionId });
  }

  res.status(200).send();
}
```

- ALWAYS implement local logout (clear session) regardless of OIDC logout support
- ALWAYS support back-channel logout for enterprise SSO deployments
- ALWAYS validate the logout token signature and claims
- ALWAYS invalidate refresh tokens on logout
- NEVER rely solely on front-channel logout — it is unreliable with browser restrictions

---

## 8. Common Provider Configurations

| Provider | Issuer | Discovery URL | Notes |
|----------|--------|---------------|-------|
| **Google** | `https://accounts.google.com` | `/.well-known/openid-configuration` | Widely supported |
| **Microsoft** | `https://login.microsoftonline.com/{tenant}/v2.0` | `/.well-known/openid-configuration` | Replace `{tenant}` |
| **Apple** | `https://appleid.apple.com` | `/.well-known/openid-configuration` | Requires special JWT client auth |
| **Auth0** | `https://{domain}` | `/.well-known/openid-configuration` | Full OIDC compliance |
| **Okta** | `https://{domain}` | `/.well-known/openid-configuration` | Enterprise SSO |
| **Keycloak** | `https://{host}/realms/{realm}` | `/.well-known/openid-configuration` | Self-hosted |
| **AWS Cognito** | `https://cognito-idp.{region}.amazonaws.com/{pool}` | `/.well-known/openid-configuration` | AWS ecosystem |

### 8.1 Provider-Specific Notes

**Google:**
- Requires `prompt=consent` for refresh token on first authorization
- Use `access_type=offline` for refresh tokens
- Supports `hd` parameter to restrict to a Google Workspace domain

**Microsoft:**
- Use `common` tenant for multi-tenant, specific tenant ID for single-tenant
- `v2.0` endpoint supports both personal and work accounts
- Returns `oid` claim as stable user identifier (in addition to `sub`)

**Apple:**
- Returns user name ONLY on first authorization — store it immediately
- Requires client secret JWT signed with ES256 (Apple private key)
- `sub` is a team-scoped identifier (different per developer team)

---

## 9. Single Sign-On (SSO) Patterns

### 9.1 SSO Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    SSO with OIDC                                  │
│                                                                   │
│  App A        App B        App C        Identity Provider         │
│   │            │            │                │                    │
│   │── Login ──────────────────────────────► │                    │
│   │            │            │       (user authenticates once)     │
│   │◄── ID Token + Session ─────────────── │                    │
│   │            │            │                │                    │
│   │            │── Login ──────────────────► │                    │
│   │            │            │       (session exists — no prompt)  │
│   │            │◄── ID Token + Session ─── │                    │
│   │            │            │                │                    │
│   │            │            │── Login ──────►│                    │
│   │            │            │       (session exists — no prompt)  │
│   │            │            │◄── ID Token ──│                    │
│   │            │            │                │                    │
│   │  User authenticates ONCE, accesses ALL apps                  │
└──────────────────────────────────────────────────────────────────┘
```

- ALWAYS use a centralized Identity Provider (IdP) for SSO
- ALWAYS implement back-channel logout for SSO — when user logs out of one app, invalidate all
- ALWAYS validate the `iss` claim to ensure the token came from your expected IdP
- ALWAYS use short-lived sessions in each application (15-30 min) with silent re-authentication via the IdP session

### 9.2 Silent Authentication

```typescript
// Silent re-authentication using hidden iframe or prompt=none
async function silentAuthentication(): Promise<string | null> {
  try {
    const authUrl = buildAuthorizationURL({
      ...config,
      prompt: "none",  // No login prompt — fail if no session
      responseMode: "fragment",
    });

    // For SPAs: Use hidden iframe
    const result = await runInHiddenIframe(authUrl, 5000);
    return result.id_token;
  } catch {
    // No active session — user must log in interactively
    return null;
  }
}
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No ID token validation | Accept any JWT as identity proof | ALWAYS verify signature, iss, aud, exp |
| Using access_token for identity | Confused deputy, wrong user context | Use ID token `sub` claim for identity |
| Auto-link unverified email | Account takeover via unverified email | ONLY auto-link when `email_verified: true` |
| Ignoring `nonce` | Replay attacks on ID tokens | Generate and validate nonce |
| Email as primary identifier | Accounts break when user changes email | Use `sub` claim as primary identifier |
| No `at_hash` validation | Access token substitution possible | Validate `at_hash` when present |
| Hardcoded JWKS keys | Breaks on key rotation | Use `jwks_uri` from discovery, cache with refresh |
| No clock skew tolerance | Valid tokens rejected across time zones | Allow 30-60 seconds leeway |
| No SSO logout | User logged out of one app but still in others | Implement back-channel logout |
| Same `sub` across providers | Different providers have different IDs | Store `sub` per-provider, never assume global uniqueness |
| Ignoring Apple's name delivery | User name lost forever after first login | Store Apple user name on first authorization |
| No session validation after ID token | Relying on expired ID token for ongoing auth | Create app session, re-validate periodically |

---

## 11. Enforcement Checklist

- [ ] `openid` scope included in ALL OIDC authorization requests
- [ ] ID token signature verified using JWKS from discovery document
- [ ] ID token `iss` claim validated against expected issuer
- [ ] ID token `aud` claim validated against your `client_id`
- [ ] ID token `exp` claim verified (with 30s clock skew tolerance)
- [ ] `nonce` generated, stored, and validated for replay prevention
- [ ] `sub` claim used as primary user identifier — NOT email
- [ ] Account linking ONLY auto-links when `email_verified: true`
- [ ] UserInfo `sub` cross-checked against ID token `sub`
- [ ] Discovery document cached and refreshed every 24 hours
- [ ] Back-channel logout implemented for SSO deployments
- [ ] Provider-specific quirks handled (Apple name, Microsoft tenant, Google hd)
- [ ] JWKS client caches keys and handles rotation automatically
- [ ] Clock skew tolerance configured (30-60 seconds)
- [ ] Separate OIDC client credentials per environment
