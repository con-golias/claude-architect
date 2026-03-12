# OAuth 2.0 Flows

> **AI Plugin Directive — OAuth 2.0 Authorization Framework**
> You are an AI coding assistant. When generating, reviewing, or refactoring OAuth 2.0 integration
> code, follow EVERY rule in this document. OAuth misconfigurations are a top-5 web security
> vulnerability. Treat each numbered section as a non-negotiable production requirement.

**Core Rule: ALWAYS use Authorization Code Flow with PKCE for user-facing applications. NEVER use Implicit Flow — it is deprecated (OAuth 2.1). NEVER expose client secrets to browser or mobile clients. ALWAYS validate the `state` parameter to prevent CSRF attacks.**

---

## 1. OAuth 2.0 Grant Types

| Grant Type | RFC | Use Case | Security | Status |
|-----------|-----|----------|----------|--------|
| **Authorization Code + PKCE** | RFC 7636 | Web apps, mobile, SPA | HIGHEST | REQUIRED |
| **Client Credentials** | RFC 6749 | Service-to-service | HIGH | ACTIVE |
| **Device Code** | RFC 8628 | Smart TVs, CLI tools | HIGH | ACTIVE |
| **Refresh Token** | RFC 6749 | Token renewal | HIGH | ACTIVE |
| Implicit | RFC 6749 | (deprecated) | LOW | **DEPRECATED** |
| Resource Owner Password | RFC 6749 | (deprecated) | LOW | **DEPRECATED** |

NEVER implement Implicit Grant or Resource Owner Password Credentials grant. These are deprecated in OAuth 2.1 and have known security vulnerabilities.

---

## 2. Authorization Code Flow with PKCE

ALWAYS use this flow for any user-facing application (web, mobile, SPA, desktop).

```
┌──────────────────────────────────────────────────────────────────────┐
│           Authorization Code Flow with PKCE                          │
│                                                                       │
│  User        Client App          Auth Server         Resource Server  │
│   │              │                    │                    │           │
│   │──(1) Login──►│                    │                    │           │
│   │              │                    │                    │           │
│   │              │── Generate:        │                    │           │
│   │              │   code_verifier    │                    │           │
│   │              │   = random(43-128) │                    │           │
│   │              │   code_challenge   │                    │           │
│   │              │   = SHA256(verifier)│                   │           │
│   │              │   state = random() │                    │           │
│   │              │                    │                    │           │
│   │◄─(2) Redirect to /authorize ─────┤                    │           │
│   │   ?response_type=code            │                    │           │
│   │   &client_id=xxx                 │                    │           │
│   │   &redirect_uri=xxx             │                    │           │
│   │   &scope=openid profile          │                    │           │
│   │   &state=random                  │                    │           │
│   │   &code_challenge=xxx            │                    │           │
│   │   &code_challenge_method=S256    │                    │           │
│   │              │                    │                    │           │
│   │──(3) Login + Consent ──────────► │                    │           │
│   │              │                    │                    │           │
│   │◄─(4) Redirect to callback ───── │                    │           │
│   │   ?code=AUTH_CODE                 │                    │           │
│   │   &state=random  (MUST match!)   │                    │           │
│   │              │                    │                    │           │
│   │──(5)────────►│                    │                    │           │
│   │              │──(6) POST /token──►│                    │           │
│   │              │   grant_type=      │                    │           │
│   │              │   authorization_code                    │           │
│   │              │   code=AUTH_CODE   │                    │           │
│   │              │   code_verifier=xxx│                    │           │
│   │              │   redirect_uri=xxx │                    │           │
│   │              │                    │                    │           │
│   │              │◄─(7) Tokens ──────│                    │           │
│   │              │   access_token     │                    │           │
│   │              │   refresh_token    │                    │           │
│   │              │   id_token (OIDC)  │                    │           │
│   │              │                    │                    │           │
│   │              │──(8) API call ────────────────────────► │           │
│   │              │   Authorization: Bearer <access_token>  │           │
│   │              │◄─(9) Response ────────────────────────  │           │
│   │◄─(10) Data──│                    │                    │           │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 PKCE Implementation

ALWAYS generate PKCE parameters — even for confidential clients (OAuth 2.1 requirement):

**TypeScript**
```typescript
import crypto from "crypto";

function generatePKCE(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  // code_verifier: 43-128 characters, [A-Za-z0-9-._~]
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  // code_challenge: SHA256(code_verifier), base64url-encoded
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

function generateState(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Step 1: Build authorization URL
function buildAuthorizationURL(config: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state: config.state,
    code_challenge: config.codeChallenge,
    code_challenge_method: "S256",
  });

  return `${config.authorizationEndpoint}?${params}`;
}
```

**Go**
```go
package oauth

import (
    "crypto/rand"
    "crypto/sha256"
    "encoding/base64"
    "net/url"
)

type PKCE struct {
    CodeVerifier  string
    CodeChallenge string
}

func GeneratePKCE() (*PKCE, error) {
    verifier := make([]byte, 32)
    if _, err := rand.Read(verifier); err != nil {
        return nil, err
    }

    codeVerifier := base64.RawURLEncoding.EncodeToString(verifier)
    hash := sha256.Sum256([]byte(codeVerifier))
    codeChallenge := base64.RawURLEncoding.EncodeToString(hash[:])

    return &PKCE{
        CodeVerifier:  codeVerifier,
        CodeChallenge: codeChallenge,
    }, nil
}

func BuildAuthorizationURL(
    endpoint, clientID, redirectURI, state, codeChallenge string,
    scopes []string,
) string {
    u, _ := url.Parse(endpoint)
    q := u.Query()
    q.Set("response_type", "code")
    q.Set("client_id", clientID)
    q.Set("redirect_uri", redirectURI)
    q.Set("scope", strings.Join(scopes, " "))
    q.Set("state", state)
    q.Set("code_challenge", codeChallenge)
    q.Set("code_challenge_method", "S256")
    u.RawQuery = q.Encode()
    return u.String()
}
```

### 2.2 Token Exchange

**TypeScript**
```typescript
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string; // Present with OIDC
  scope: string;
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  config: OAuthConfig
): Promise<TokenResponse> {
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
      // For confidential clients, also include client_secret
      // ...(config.clientSecret && { client_secret: config.clientSecret }),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new OAuthError(error.error, error.error_description);
  }

  return response.json();
}
```

### 2.3 Callback Handler

```typescript
async function handleOAuthCallback(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query;

  // 1. Check for authorization errors
  if (error) {
    return res.status(400).json({
      error,
      description: error_description,
    });
  }

  // 2. Validate state parameter — CRITICAL for CSRF prevention
  const storedState = req.session.oauthState;
  if (!state || state !== storedState) {
    return res.status(400).json({ error: "invalid_state" });
  }
  delete req.session.oauthState; // Single use

  // 3. Retrieve stored PKCE verifier
  const codeVerifier = req.session.codeVerifier;
  delete req.session.codeVerifier; // Single use

  // 4. Exchange code for tokens
  const tokens = await exchangeCodeForTokens(
    code as string,
    codeVerifier,
    oauthConfig
  );

  // 5. Validate ID token (if OIDC)
  if (tokens.id_token) {
    const idTokenPayload = await verifyIdToken(tokens.id_token);
    // Use idTokenPayload.sub for user identification
  }

  // 6. Create application session
  req.session.userId = user.id;
  req.session.accessToken = tokens.access_token;
  // Store refresh token encrypted in database, NOT in session

  res.redirect("/dashboard");
}
```

### 2.4 Critical Rules

- ALWAYS use `code_challenge_method=S256` — NEVER use `plain`
- ALWAYS validate the `state` parameter matches the stored value — prevents CSRF
- ALWAYS use `state` as a single-use value — delete after validation
- ALWAYS exchange the authorization code within 10 minutes (server enforces expiry)
- ALWAYS validate the `redirect_uri` matches exactly — no open redirect
- NEVER log authorization codes or tokens
- NEVER send tokens via URL fragments or query parameters after exchange

---

## 3. Client Credentials Flow

Use ONLY for service-to-service authentication where no user context is needed:

```
┌───────────────────────────────────────────────────┐
│           Client Credentials Flow                  │
│                                                    │
│  Service A                    Auth Server          │
│     │                             │                │
│     │── POST /token ────────────►│                │
│     │   grant_type=               │                │
│     │   client_credentials        │                │
│     │   client_id=xxx             │                │
│     │   client_secret=xxx         │                │
│     │   scope=service:read        │                │
│     │                             │                │
│     │◄── access_token ──────────│                │
│     │    (NO refresh token)       │                │
│     │                             │                │
│     │── API call ─────────────────────► Service B  │
│     │   Authorization: Bearer <token>              │
│     │◄── Response ────────────────────             │
└───────────────────────────────────────────────────┘
```

**TypeScript**
```typescript
class ServiceTokenClient {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private tokenEndpoint: string,
    private clientId: string,
    private clientSecret: string,
    private scopes: string[]
  ) {}

  async getToken(): Promise<string> {
    // Return cached token if still valid (with 30s buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.token;
    }

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${this.clientId}:${this.clientSecret}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: this.scopes.join(" "),
      }),
    });

    const data = await response.json();

    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return data.access_token;
  }
}
```

- ALWAYS cache client credentials tokens — do NOT request a new token per API call
- ALWAYS use HTTP Basic authentication for client credentials (RFC 6749 Section 2.3.1)
- NEVER issue refresh tokens for client credentials flow
- ALWAYS scope client credentials to minimum required permissions
- ALWAYS store client secrets in environment variables or secret managers — NEVER in code

---

## 4. Device Authorization Flow

Use for devices without a browser or with limited input (Smart TVs, CLI tools, IoT):

```
┌──────────────────────────────────────────────────────────────────┐
│              Device Authorization Flow (RFC 8628)                 │
│                                                                   │
│  Device              Auth Server              User's Browser     │
│    │                     │                         │              │
│    │── POST /device/code►│                         │              │
│    │   client_id=xxx     │                         │              │
│    │                     │                         │              │
│    │◄── device_code ────│                         │              │
│    │    user_code        │                         │              │
│    │    verification_uri │                         │              │
│    │    interval (poll)  │                         │              │
│    │                     │                         │              │
│    │── Display to user:  │                         │              │
│    │   "Go to            │                         │              │
│    │    https://auth/device                        │              │
│    │    Enter code: ABCD-1234"                     │              │
│    │                     │                         │              │
│    │                     │          User visits ──►│              │
│    │                     │◄── Enters code + login ─│              │
│    │                     │──  Consent screen ─────►│              │
│    │                     │◄── Approves ────────────│              │
│    │                     │                         │              │
│    │── Poll POST /token ►│                         │              │
│    │   (every 5 seconds) │                         │              │
│    │                     │                         │              │
│    │◄── access_token ───│  (after user approves)  │              │
│    │    refresh_token    │                         │              │
└──────────────────────────────────────────────────────────────────┘
```

- ALWAYS respect the `interval` parameter from the server — do NOT poll faster
- ALWAYS handle `authorization_pending`, `slow_down`, `expired_token`, and `access_denied` responses
- ALWAYS set a maximum polling timeout (e.g., 15 minutes)

---

## 5. Redirect URI Security

```
┌─────────────────────────────────────────────────────────────────┐
│                  Redirect URI Rules                              │
│                                                                  │
│  ALLOWED:                                                        │
│  ├── https://app.example.com/callback      (exact match)        │
│  ├── https://app.example.com/auth/callback (exact match)        │
│  └── http://localhost:3000/callback         (dev only)           │
│                                                                  │
│  NEVER ALLOWED:                                                  │
│  ├── https://app.example.com/*             (wildcard)            │
│  ├── https://*.example.com/callback        (subdomain wildcard)  │
│  ├── http://app.example.com/callback       (non-HTTPS prod)     │
│  ├── https://app.example.com/callback?next=https://evil.com     │
│  └── any URL with open redirect potential                       │
└─────────────────────────────────────────────────────────────────┘
```

- ALWAYS use exact string matching for redirect URIs — NEVER pattern matching
- ALWAYS register redirect URIs in advance with the authorization server
- ALWAYS use HTTPS for redirect URIs in production
- NEVER include user-controlled data in redirect URIs
- NEVER allow localhost redirect URIs in production
- ALWAYS validate the redirect URI on BOTH the authorization request AND the token exchange

---

## 6. Scope Design

ALWAYS follow the principle of least privilege when requesting scopes:

| Pattern | Example | Description |
|---------|---------|-------------|
| Resource-based | `users:read`, `users:write` | Access to resource types |
| Action-based | `read`, `write`, `admin` | Level of access |
| Service-based | `email`, `profile`, `calendar` | Access to specific services |
| Hierarchical | `org.users.read` | Namespaced by organization |

```typescript
// Scope definition
const SCOPES = {
  // Read scopes
  "users:read": "View user profiles",
  "users:list": "List all users",

  // Write scopes
  "users:write": "Create and update users",
  "users:delete": "Delete users",

  // Admin scopes
  "admin:full": "Full administrative access",

  // OIDC standard scopes
  openid: "OpenID Connect authentication",
  profile: "User profile information",
  email: "Email address",
  offline_access: "Refresh token (long-lived access)",
} as const;

// Request MINIMUM scopes needed
const authUrl = buildAuthorizationURL({
  scopes: ["openid", "profile", "email"], // ✅ Minimal
  // NOT: ["openid", "profile", "email", "admin:full"] ❌ Over-scoped
});
```

- ALWAYS request the minimum scopes necessary for the operation
- ALWAYS display requested scopes to the user on the consent screen
- ALWAYS allow users to selectively approve scopes
- NEVER request `admin` or `write` scopes unless the application actually needs them
- ALWAYS use `offline_access` scope when refresh tokens are needed

---

## 7. Token Storage (Server-Side)

ALWAYS store OAuth tokens securely on the server:

```typescript
// Database schema for OAuth token storage
interface OAuthTokenRecord {
  id: string;
  userId: string;
  provider: string;            // "google", "github", etc.
  accessToken: string;         // AES-256-GCM encrypted
  refreshToken: string | null; // AES-256-GCM encrypted
  tokenType: string;
  scope: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ALWAYS encrypt OAuth tokens at rest
class OAuthTokenStore {
  constructor(private encryptor: AES256GCM) {}

  async store(userId: string, provider: string, tokens: TokenResponse) {
    await db.oauthTokens.upsert({
      where: { userId_provider: { userId, provider } },
      update: {
        accessToken: this.encryptor.encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token
          ? this.encryptor.encrypt(tokens.refresh_token)
          : null,
        scope: tokens.scope,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        updatedAt: new Date(),
      },
      create: {
        userId,
        provider,
        accessToken: this.encryptor.encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token
          ? this.encryptor.encrypt(tokens.refresh_token)
          : null,
        tokenType: tokens.token_type,
        scope: tokens.scope,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
  }

  async getValidToken(userId: string, provider: string): Promise<string> {
    const record = await db.oauthTokens.findUnique({
      where: { userId_provider: { userId, provider } },
    });

    if (!record) throw new Error("No token found");

    // Check if access token is still valid (with 5 min buffer)
    if (record.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      return this.encryptor.decrypt(record.accessToken);
    }

    // Refresh the token
    if (!record.refreshToken) throw new Error("Token expired, no refresh token");

    const newTokens = await refreshOAuthToken(
      provider,
      this.encryptor.decrypt(record.refreshToken)
    );

    await this.store(userId, provider, newTokens);
    return newTokens.access_token;
  }
}
```

- ALWAYS encrypt OAuth tokens at rest using AES-256-GCM
- ALWAYS implement automatic token refresh with a buffer (refresh 5 min before expiry)
- ALWAYS store tokens per user-per-provider to support multiple OAuth providers
- NEVER store OAuth tokens in browser cookies or client-side storage
- ALWAYS delete stored tokens when user unlinks their OAuth account

---

## 8. OAuth Security Checklist

| Threat | Mitigation | Required |
|--------|-----------|----------|
| CSRF on callback | `state` parameter, validate on return | YES |
| Authorization code interception | PKCE (code_challenge/code_verifier) | YES |
| Open redirect | Exact redirect_uri matching | YES |
| Token leakage | HTTPS everywhere, no tokens in URLs | YES |
| Client impersonation | Client authentication + PKCE | YES |
| Scope escalation | Server validates scopes on token exchange | YES |
| Token replay | Short-lived tokens, one-time auth codes | YES |
| Mix-up attack | Validate `iss` in token response | YES |
| Clickjacking on consent | X-Frame-Options on auth pages | YES |

---

## 9. Provider Integration Patterns

### 9.1 Discovery Document

ALWAYS use the OpenID Connect Discovery document when available:

```typescript
interface OAuthProviderConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  jwksUri: string;
  revocationEndpoint?: string;
  issuer: string;
}

async function discoverProvider(issuer: string): Promise<OAuthProviderConfig> {
  const response = await fetch(
    `${issuer}/.well-known/openid-configuration`
  );
  const config = await response.json();

  return {
    authorizationEndpoint: config.authorization_endpoint,
    tokenEndpoint: config.token_endpoint,
    userinfoEndpoint: config.userinfo_endpoint,
    jwksUri: config.jwks_uri,
    revocationEndpoint: config.revocation_endpoint,
    issuer: config.issuer,
  };
}

// Common provider discovery URLs:
// Google:    https://accounts.google.com/.well-known/openid-configuration
// Microsoft: https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration
// Auth0:     https://{domain}/.well-known/openid-configuration
// Okta:      https://{domain}/.well-known/openid-configuration
```

### 9.2 Multi-Provider Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Multi-Provider OAuth Architecture                │
│                                                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Google  │  │ GitHub  │  │Microsoft│  │  Auth0  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │               │
│  ┌────▼────────────▼────────────▼────────────▼────┐          │
│  │          OAuth Provider Adapter Layer           │          │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │          │
│  │  │ Normalize│ │ Validate │ │ Map to   │       │          │
│  │  │ Profile  │ │ Tokens   │ │ Internal │       │          │
│  │  └──────────┘ └──────────┘ └──────────┘       │          │
│  └──────────────────────┬─────────────────────────┘          │
│                         │                                     │
│  ┌──────────────────────▼─────────────────────────┐          │
│  │          Internal Identity Service              │          │
│  │  ┌───────────────┐  ┌─────────────────────┐    │          │
│  │  │ Link Provider │  │ Create/Find User    │    │          │
│  │  │ to User       │  │ by Provider + Sub   │    │          │
│  │  └───────────────┘  └─────────────────────┘    │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Implicit Grant | Tokens in URL fragment, no refresh | Use Authorization Code + PKCE |
| No PKCE | Authorization code interception possible | ALWAYS generate code_challenge |
| Missing `state` parameter | CSRF attacks on OAuth callback | Generate and validate `state` |
| Wildcard redirect URIs | Open redirect vulnerability | Exact match redirect URIs only |
| Client secret in SPA/mobile | Secret exposed in client code | Use PKCE without client secret |
| Over-scoped tokens | App requests `admin` for read-only | Request minimum scopes needed |
| No token encryption at rest | Tokens readable in DB breach | AES-256-GCM encrypt stored tokens |
| Hardcoded provider config | Breaks on provider URL changes | Use discovery document |
| No token refresh logic | Users forced to re-login frequently | Implement automatic token refresh |
| Tokens in URL params | Tokens in logs, browser history, Referer | Use POST body or Authorization header |
| Same redirect URI for all envs | Dev tokens work in production | Separate redirect URIs per environment |
| No CSRF on token endpoint | Token exchange CSRF possible | Validate redirect_uri on exchange |

---

## 11. Enforcement Checklist

- [ ] Authorization Code Flow with PKCE used for ALL user-facing auth
- [ ] PKCE code_challenge_method is `S256` — NEVER `plain`
- [ ] `state` parameter generated, stored, and validated on callback
- [ ] Redirect URIs use exact string matching — no wildcards
- [ ] All redirect URIs use HTTPS in production
- [ ] Client secrets stored in environment variables / secret manager
- [ ] Client secrets NEVER exposed to browser or mobile clients
- [ ] OAuth tokens encrypted at rest (AES-256-GCM)
- [ ] Automatic token refresh implemented with expiry buffer
- [ ] Minimum scopes requested per operation
- [ ] Discovery document used for provider configuration
- [ ] Authorization codes exchanged within 10 minutes, single-use
- [ ] No tokens in URL parameters — use POST body or headers
- [ ] CSRF protection on all OAuth endpoints
- [ ] Separate OAuth app credentials per environment (dev/staging/prod)
- [ ] Token revocation endpoint called on user logout / account unlink
