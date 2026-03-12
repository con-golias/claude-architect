# OAuth 2.0 and OpenID Connect Comprehensive Guide

## Metadata
- **Category**: Authentication and Identity
- **Priority**: Critical
- **Last Updated**: 2025-01-15
- **Standards**: RFC 6749, RFC 7636 (PKCE), RFC 6750, OpenID Connect Core 1.0
- **Applicable Languages**: TypeScript, Go, Python

---

## Table of Contents

1. [Overview](#overview)
2. [OAuth 2.0 Grant Types](#oauth-20-grant-types)
3. [PKCE (Proof Key for Code Exchange)](#pkce)
4. [OpenID Connect](#openid-connect)
5. [Token Types and Lifecycle](#token-types-and-lifecycle)
6. [Redirect URI Validation](#redirect-uri-validation)
7. [State Parameter and CSRF Protection](#state-parameter-and-csrf-protection)
8. [Token Storage Strategies](#token-storage-strategies)
9. [Provider Implementation](#provider-implementation)
10. [Client Implementation](#client-implementation)
11. [Best Practices](#best-practices)
12. [Anti-Patterns](#anti-patterns)
13. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

OAuth 2.0 is an authorization framework that enables third-party applications to
obtain limited access to a resource on behalf of a user without exposing the user's
credentials. OpenID Connect (OIDC) is an identity layer built on top of OAuth 2.0
that provides authentication (proving who the user is) in addition to authorization
(proving what the user can access).

A critical distinction: OAuth 2.0 alone is an authorization protocol. It tells you
what a user has access to, not who the user is. OpenID Connect adds standardized
identity claims and an ID token to provide authentication. Do not use plain OAuth 2.0
for authentication -- always use OpenID Connect when you need to know the user's identity.

### Key Roles

| Role                  | Description                                          |
|-----------------------|------------------------------------------------------|
| Resource Owner        | The user who owns the data                           |
| Client                | The application requesting access                    |
| Authorization Server  | Issues tokens after authenticating the user           |
| Resource Server       | Hosts the protected resources (API)                  |

---

## OAuth 2.0 Grant Types

### Authorization Code + PKCE (Recommended for All Clients)

The Authorization Code grant with PKCE is the recommended flow for all client types:
web applications, single-page applications, mobile apps, and desktop apps. PKCE
(RFC 7636) mitigates authorization code interception attacks and eliminates the need
for a client secret in public clients.

**Flow:**

1. Client generates a `code_verifier` (random string, 43-128 characters).
2. Client computes `code_challenge = BASE64URL(SHA256(code_verifier))`.
3. Client redirects user to authorization endpoint with `code_challenge` and `code_challenge_method=S256`.
4. User authenticates and consents.
5. Authorization server redirects back with an authorization code.
6. Client exchanges the code for tokens, including the `code_verifier`.
7. Authorization server verifies `SHA256(code_verifier) == code_challenge`.
8. Authorization server issues access token, refresh token, and ID token.

### Client Credentials (Machine-to-Machine)

The Client Credentials grant is used for server-to-server communication where no
user is involved. The client authenticates using its client ID and client secret.

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=service-a
&client_secret=<secret>
&scope=api:read api:write
```

**Security requirements:**
- Store client secrets in a secrets manager, never in source code.
- Rotate client secrets periodically (every 90 days).
- Use mutual TLS (mTLS) for additional security in high-assurance environments.
- Scope tokens to the minimum permissions required.

### Device Authorization (IoT/CLI)

The Device Authorization Grant (RFC 8628) is designed for devices with limited input
capabilities (smart TVs, IoT devices, CLI tools).

**Flow:**

1. Device requests a device code and user code from the authorization server.
2. Device displays the user code and a verification URL to the user.
3. User visits the URL on a separate device (phone/computer) and enters the user code.
4. User authenticates and authorizes the device.
5. Device polls the token endpoint until authorization is granted or denied.

```typescript
interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number; // Polling interval in seconds
}

async function startDeviceAuthorization(
  clientId: string
): Promise<DeviceCodeResponse> {
  const response = await fetch("https://auth.example.com/oauth/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      scope: "openid profile email",
    }),
  });

  return response.json();
}

async function pollForToken(
  clientId: string,
  deviceCode: string,
  intervalMs: number
): Promise<TokenResponse> {
  while (true) {
    await sleep(intervalMs);

    const response = await fetch("https://auth.example.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: clientId,
        device_code: deviceCode,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return result as TokenResponse;
    }

    if (result.error === "authorization_pending") {
      continue; // Keep polling
    }

    if (result.error === "slow_down") {
      intervalMs += 5000; // Increase polling interval
      continue;
    }

    throw new Error(`Device authorization failed: ${result.error}`);
  }
}
```

### Deprecated Grants (NEVER USE)

**Implicit Grant:** Tokens are returned in the URL fragment, making them visible in
browser history, referrer headers, and server logs. There is no way to verify the
intended recipient. The Implicit grant has been removed from the OAuth 2.1 draft
specification. Use Authorization Code + PKCE instead.

**Resource Owner Password Credentials (ROPC):** The client collects the user's
username and password directly. This defeats the purpose of OAuth (delegated
authorization without sharing credentials) and prevents the authorization server from
implementing MFA or consent screens. It trains users to enter their credentials into
third-party applications.

---

## PKCE (Proof Key for Code Exchange)

PKCE (RFC 7636) is mandatory for all OAuth 2.0 clients, including confidential
clients. It prevents authorization code interception attacks.

### Implementation

```typescript
import crypto from "crypto";

function generateCodeVerifier(): string {
  // 32 bytes = 43 base64url characters
  const buffer = crypto.randomBytes(32);
  return buffer
    .toString("base64url")
    .replace(/=/g, "");
}

function generateCodeChallenge(verifier: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(verifier)
    .digest();
  return hash
    .toString("base64url")
    .replace(/=/g, "");
}

// Usage in authorization request
function buildAuthorizationUrl(
  authEndpoint: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
  nonce: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  return `${authEndpoint}?${params.toString()}`;
}
```

### Go Implementation

```go
package oauth

import (
    "crypto/rand"
    "crypto/sha256"
    "encoding/base64"
)

func GenerateCodeVerifier() (string, error) {
    buf := make([]byte, 32)
    if _, err := rand.Read(buf); err != nil {
        return "", err
    }
    return base64.RawURLEncoding.EncodeToString(buf), nil
}

func GenerateCodeChallenge(verifier string) string {
    hash := sha256.Sum256([]byte(verifier))
    return base64.RawURLEncoding.EncodeToString(hash[:])
}
```

### Python Implementation

```python
import secrets
import hashlib
import base64

def generate_code_verifier() -> str:
    """Generate a PKCE code verifier (43-128 characters)."""
    return secrets.token_urlsafe(32)

def generate_code_challenge(verifier: str) -> str:
    """Generate a PKCE code challenge using S256."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
```

### PKCE Rules

1. Always use `S256` (SHA-256) for `code_challenge_method`. Never use `plain`.
2. Generate a new `code_verifier` for every authorization request.
3. Store the `code_verifier` securely on the client side (not in localStorage for SPAs).
4. The authorization server must reject token requests without a valid `code_verifier`.

---

## OpenID Connect

### ID Tokens

An ID token is a JWT that contains claims about the authentication event and the user.
It is intended for the client application, NOT for the resource server.

**Required claims:**

| Claim | Description                                       |
|-------|---------------------------------------------------|
| iss   | Issuer identifier (the authorization server URL)  |
| sub   | Subject identifier (unique user ID)               |
| aud   | Audience (the client ID that requested the token) |
| exp   | Expiration time (Unix timestamp)                  |
| iat   | Issued at time (Unix timestamp)                   |
| nonce | Binds the token to the authorization request       |

**Optional standard claims:**

| Claim          | Description                |
|----------------|----------------------------|
| name           | Full name                  |
| email          | Email address              |
| email_verified | Whether email is verified  |
| picture        | Profile picture URL        |
| locale         | User's locale              |

### UserInfo Endpoint

The UserInfo endpoint returns claims about the authenticated user. It requires an
access token with the appropriate scopes.

```
GET /userinfo
Authorization: Bearer <access_token>

Response:
{
  "sub": "user-123",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true,
  "picture": "https://example.com/photo.jpg"
}
```

### Discovery Document

The OpenID Connect discovery document (`.well-known/openid-configuration`) provides
metadata about the authorization server's endpoints and capabilities.

```
GET https://auth.example.com/.well-known/openid-configuration

Response:
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/oauth/token",
  "userinfo_endpoint": "https://auth.example.com/userinfo",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "registration_endpoint": "https://auth.example.com/register",
  "scopes_supported": ["openid", "profile", "email", "address", "phone"],
  "response_types_supported": ["code", "code id_token"],
  "grant_types_supported": ["authorization_code", "client_credentials", "refresh_token"],
  "subject_types_supported": ["public", "pairwise"],
  "id_token_signing_alg_values_supported": ["RS256", "ES256"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "private_key_jwt"]
}
```

### Scopes

| Scope    | Claims Returned                                          |
|----------|----------------------------------------------------------|
| openid   | sub (required for OIDC)                                  |
| profile  | name, family_name, given_name, middle_name, nickname, picture, updated_at |
| email    | email, email_verified                                     |
| address  | address (formatted, street_address, locality, region, postal_code, country) |
| phone    | phone_number, phone_number_verified                       |

---

## Token Types and Lifecycle

### Access Token

**Purpose:** Authorizes access to protected resources (APIs).

**Characteristics:**
- Short-lived: 15 minutes maximum.
- Can be a JWT (self-contained) or an opaque string (reference token).
- Sent as a Bearer token in the Authorization header.
- Must not contain sensitive user data if used as a JWT (payload is base64-encoded, not encrypted).

**Validation on the resource server:**
1. Verify the signature using the authorization server's JWKS.
2. Verify `exp` is in the future.
3. Verify `iss` matches the expected authorization server.
4. Verify `aud` includes the resource server's identifier.
5. Verify required `scope` claims are present.

### Refresh Token

**Purpose:** Obtains new access tokens without requiring user re-authentication.

**Characteristics:**
- Long-lived: hours, days, or weeks depending on security requirements.
- Opaque string (never a JWT).
- Must be stored securely (server-side or httpOnly cookies).
- Must support rotation: each use issues a new refresh token and invalidates the old one.
- Must support revocation: invalidate refresh tokens on logout, password change, or security event.

**Refresh Token Rotation:**

```typescript
async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<TokenResponse> {
  const response = await fetch("https://auth.example.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed -- re-authentication required");
  }

  const tokens: TokenResponse = await response.json();
  // tokens.refresh_token is a NEW refresh token
  // The old refresh token is now invalidated

  return tokens;
}
```

**Refresh Token Reuse Detection:**
If a refresh token is used more than once (indicating it was stolen), the authorization
server must revoke the entire token family (all refresh tokens derived from the same
original grant). This is called refresh token rotation with reuse detection.

### ID Token

**Purpose:** Proves the user's identity to the client application.

**Characteristics:**
- Always a JWT.
- Short-lived (same expiration as the access token).
- Contains authentication claims (who the user is).
- Must NOT be sent to resource servers or APIs.
- Must NOT be used as an access token.

---

## Redirect URI Validation

Redirect URI validation is one of the most critical security controls in OAuth 2.0.
A misconfigured redirect URI enables open redirect attacks and token theft.

### Rules

1. **Exact match required.** Compare redirect URIs byte-for-byte. Do not allow partial
   matches, wildcard subdomain matching, or path prefix matching.

2. **No wildcards.** Do not allow `https://*.example.com/callback`. An attacker who
   controls any subdomain can steal authorization codes.

3. **No open redirects.** Do not allow redirect URIs that can be manipulated to
   redirect to arbitrary URLs.

4. **HTTPS required.** All redirect URIs must use HTTPS, except `http://localhost`
   for local development.

5. **Pre-register all redirect URIs.** The authorization server must maintain a
   whitelist of allowed redirect URIs per client.

6. **No query parameters in registered URIs.** If query parameters are needed, use
   the `state` parameter instead.

### Validation Implementation

```typescript
function validateRedirectUri(
  requestedUri: string,
  registeredUris: string[]
): boolean {
  // Exact match only -- no partial matching, no wildcards
  return registeredUris.includes(requestedUri);
}

// On the authorization server
function handleAuthorizationRequest(req: Request): Response {
  const clientId = req.query.client_id;
  const redirectUri = req.query.redirect_uri;

  const client = await getClient(clientId);
  if (!client) {
    // Do NOT redirect -- the client is unknown
    return new Response("Invalid client", { status: 400 });
  }

  if (!validateRedirectUri(redirectUri, client.registeredRedirectUris)) {
    // Do NOT redirect -- the URI is not registered
    // Redirecting to an unvalidated URI would enable token theft
    return new Response("Invalid redirect URI", { status: 400 });
  }

  // Proceed with authorization flow
  // ...
}
```

### Go Validation

```go
func ValidateRedirectURI(requested string, registered []string) bool {
    for _, uri := range registered {
        if uri == requested {
            return true
        }
    }
    return false
}
```

---

## State Parameter and CSRF Protection

The `state` parameter prevents CSRF attacks on the OAuth callback endpoint. Without
it, an attacker can initiate an OAuth flow and trick the victim into completing it,
linking the attacker's account to the victim's session.

### Implementation

```typescript
import crypto from "crypto";

interface OAuthState {
  csrfToken: string;
  returnUrl: string;
  timestamp: number;
}

function generateState(returnUrl: string): string {
  const state: OAuthState = {
    csrfToken: crypto.randomBytes(32).toString("hex"),
    returnUrl,
    timestamp: Date.now(),
  };

  // Encrypt or sign the state to prevent tampering
  return encrypt(JSON.stringify(state));
}

function validateState(
  stateParam: string,
  maxAgeMs: number = 600000 // 10 minutes
): OAuthState | null {
  try {
    const state: OAuthState = JSON.parse(decrypt(stateParam));

    // Check expiration
    if (Date.now() - state.timestamp > maxAgeMs) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

// Callback handler
async function handleOAuthCallback(req: Request): Promise<Response> {
  const { code, state: stateParam, error } = req.query;

  if (error) {
    return handleOAuthError(error);
  }

  const state = validateState(stateParam);
  if (!state) {
    return new Response("Invalid or expired state", { status: 400 });
  }

  // Exchange code for tokens using PKCE
  const tokens = await exchangeCode(code, state.codeVerifier);

  // Validate ID token
  const idToken = await validateIdToken(tokens.id_token);

  // Create session
  const session = await createSession(idToken.sub);

  // Redirect to the original return URL
  return redirect(state.returnUrl, {
    headers: { "Set-Cookie": createSessionCookie(session) },
  });
}
```

---

## Token Storage Strategies

### Backend-for-Frontend (BFF) Pattern (Recommended for SPAs)

The BFF pattern keeps tokens on the server side and uses httpOnly session cookies
to authenticate the browser. The SPA never handles tokens directly.

```
Browser <--cookie--> BFF Server <--tokens--> Authorization Server
                         |
                    tokens stored in
                    server-side session
```

**BFF Implementation:**

```typescript
import express from "express";
import session from "express-session";

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Login route: redirect to authorization server
app.get("/api/auth/login", (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState(req.query.returnUrl || "/");

  // Store PKCE verifier in session
  req.session.codeVerifier = codeVerifier;
  req.session.state = state;

  const authUrl = buildAuthorizationUrl(
    config.authorizationEndpoint,
    config.clientId,
    config.redirectUri,
    codeChallenge,
    state
  );

  res.redirect(authUrl);
});

// Callback route: exchange code for tokens
app.get("/api/auth/callback", async (req, res) => {
  const { code, state } = req.query;

  if (state !== req.session.state) {
    return res.status(400).json({ error: "Invalid state" });
  }

  const tokens = await exchangeCodeForTokens(
    code as string,
    req.session.codeVerifier
  );

  // Store tokens in server-side session, NOT in browser
  req.session.accessToken = tokens.access_token;
  req.session.refreshToken = tokens.refresh_token;
  req.session.idToken = tokens.id_token;

  delete req.session.codeVerifier;
  delete req.session.state;

  res.redirect("/");
});

// API proxy: attach access token to upstream requests
app.use("/api/proxy", async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Check token expiration and refresh if needed
  if (isTokenExpired(req.session.accessToken)) {
    try {
      const newTokens = await refreshAccessToken(req.session.refreshToken);
      req.session.accessToken = newTokens.access_token;
      req.session.refreshToken = newTokens.refresh_token;
    } catch {
      return res.status(401).json({ error: "Session expired" });
    }
  }

  // Forward request to resource server
  const response = await fetch(`${config.apiBaseUrl}${req.path}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${req.session.accessToken}`,
      "Content-Type": req.headers["content-type"] || "application/json",
    },
    body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
  });

  res.status(response.status).json(await response.json());
});
```

### Token Storage Rules

| Storage Method      | Access Token | Refresh Token | Recommendation      |
|---------------------|-------------|---------------|----------------------|
| httpOnly cookie     | Acceptable  | Acceptable    | Use with BFF pattern |
| Server-side session | Best        | Best          | Recommended          |
| localStorage        | NEVER       | NEVER         | XSS exposes tokens   |
| sessionStorage      | Last resort | NEVER         | Slightly better than localStorage |
| In-memory (SPA)     | Acceptable  | NEVER         | Lost on refresh      |

**Never store refresh tokens in localStorage or sessionStorage.** A single XSS
vulnerability exposes all stored tokens. The BFF pattern eliminates this risk entirely.

---

## Provider Implementation

### Go Authorization Server (Token Endpoint)

```go
package oauth

import (
    "crypto/sha256"
    "encoding/base64"
    "encoding/json"
    "net/http"
    "time"

    "github.com/golang-jwt/jwt/v5"
)

type TokenRequest struct {
    GrantType    string `json:"grant_type"`
    Code         string `json:"code"`
    RedirectURI  string `json:"redirect_uri"`
    ClientID     string `json:"client_id"`
    CodeVerifier string `json:"code_verifier"`
}

type TokenResponse struct {
    AccessToken  string `json:"access_token"`
    TokenType    string `json:"token_type"`
    ExpiresIn    int    `json:"expires_in"`
    RefreshToken string `json:"refresh_token,omitempty"`
    IDToken      string `json:"id_token,omitempty"`
}

func HandleTokenRequest(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    r.ParseForm()

    grantType := r.FormValue("grant_type")
    switch grantType {
    case "authorization_code":
        handleAuthorizationCodeGrant(w, r)
    case "client_credentials":
        handleClientCredentialsGrant(w, r)
    case "refresh_token":
        handleRefreshTokenGrant(w, r)
    default:
        respondError(w, "unsupported_grant_type", http.StatusBadRequest)
    }
}

func handleAuthorizationCodeGrant(w http.ResponseWriter, r *http.Request) {
    code := r.FormValue("code")
    redirectURI := r.FormValue("redirect_uri")
    clientID := r.FormValue("client_id")
    codeVerifier := r.FormValue("code_verifier")

    // Retrieve the stored authorization code
    authCode, err := GetAuthorizationCode(code)
    if err != nil || authCode == nil {
        respondError(w, "invalid_grant", http.StatusBadRequest)
        return
    }

    // Verify the code has not expired
    if time.Now().After(authCode.ExpiresAt) {
        respondError(w, "invalid_grant", http.StatusBadRequest)
        return
    }

    // Verify client ID matches
    if authCode.ClientID != clientID {
        respondError(w, "invalid_grant", http.StatusBadRequest)
        return
    }

    // Verify redirect URI matches
    if authCode.RedirectURI != redirectURI {
        respondError(w, "invalid_grant", http.StatusBadRequest)
        return
    }

    // Verify PKCE code verifier
    challenge := base64.RawURLEncoding.EncodeToString(
        sha256Hash([]byte(codeVerifier)),
    )
    if challenge != authCode.CodeChallenge {
        respondError(w, "invalid_grant", http.StatusBadRequest)
        return
    }

    // Invalidate the authorization code (single use)
    DeleteAuthorizationCode(code)

    // Issue tokens
    accessToken, err := issueAccessToken(authCode.UserID, authCode.Scopes, clientID)
    if err != nil {
        respondError(w, "server_error", http.StatusInternalServerError)
        return
    }

    refreshToken, err := issueRefreshToken(authCode.UserID, authCode.Scopes, clientID)
    if err != nil {
        respondError(w, "server_error", http.StatusInternalServerError)
        return
    }

    idToken, err := issueIDToken(authCode.UserID, clientID, authCode.Nonce)
    if err != nil {
        respondError(w, "server_error", http.StatusInternalServerError)
        return
    }

    response := TokenResponse{
        AccessToken:  accessToken,
        TokenType:    "Bearer",
        ExpiresIn:    900, // 15 minutes
        RefreshToken: refreshToken,
        IDToken:      idToken,
    }

    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Cache-Control", "no-store")
    w.Header().Set("Pragma", "no-cache")
    json.NewEncoder(w).Encode(response)
}

func sha256Hash(data []byte) []byte {
    h := sha256.Sum256(data)
    return h[:]
}
```

### Python Client Implementation

```python
import secrets
import hashlib
import base64
from urllib.parse import urlencode
import httpx

class OIDCClient:
    def __init__(self, client_id: str, client_secret: str | None,
                 issuer: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.issuer = issuer
        self._discovery = None
        self._http = httpx.AsyncClient()

    async def discover(self) -> dict:
        """Fetch the OpenID Connect discovery document."""
        if self._discovery is None:
            response = await self._http.get(
                f"{self.issuer}/.well-known/openid-configuration"
            )
            response.raise_for_status()
            self._discovery = response.json()
        return self._discovery

    def create_authorization_url(self) -> tuple[str, str, str, str]:
        """Build the authorization URL with PKCE and state."""
        code_verifier = secrets.token_urlsafe(32)
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode()).digest()
        ).rstrip(b"=").decode()

        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)

        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "openid profile email",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "state": state,
            "nonce": nonce,
        }

        discovery = self._discovery
        auth_url = f"{discovery['authorization_endpoint']}?{urlencode(params)}"

        return auth_url, code_verifier, state, nonce

    async def exchange_code(self, code: str, code_verifier: str) -> dict:
        """Exchange authorization code for tokens."""
        discovery = await self.discover()

        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id,
            "code_verifier": code_verifier,
        }

        if self.client_secret:
            data["client_secret"] = self.client_secret

        response = await self._http.post(
            discovery["token_endpoint"],
            data=data,
        )
        response.raise_for_status()

        return response.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        """Exchange a refresh token for new tokens."""
        discovery = await self.discover()

        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.client_id,
        }

        if self.client_secret:
            data["client_secret"] = self.client_secret

        response = await self._http.post(
            discovery["token_endpoint"],
            data=data,
        )
        response.raise_for_status()

        return response.json()

    async def get_userinfo(self, access_token: str) -> dict:
        """Fetch user info from the UserInfo endpoint."""
        discovery = await self.discover()

        response = await self._http.get(
            discovery["userinfo_endpoint"],
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()

        return response.json()
```

---

## Best Practices

1. **Use Authorization Code + PKCE for all client types.** This includes confidential clients (web servers), public clients (SPAs), mobile apps, and desktop apps. PKCE is mandatory, not optional. Use `S256` for the challenge method; never use `plain`.

2. **Never use the Implicit or Resource Owner Password Credentials grants.** Both are deprecated in OAuth 2.1 and have well-known security vulnerabilities. The Implicit grant exposes tokens in URL fragments. ROPC exposes user credentials to client applications.

3. **Set access token lifetimes to 15 minutes or less.** Short-lived access tokens limit the window of exploitation if a token is stolen. Use refresh tokens with rotation and reuse detection to obtain new access tokens without re-authentication.

4. **Implement refresh token rotation with reuse detection.** Issue a new refresh token on every use and invalidate the old one. If a revoked refresh token is used (indicating theft), revoke all tokens in the family and force re-authentication.

5. **Use the BFF (Backend-for-Frontend) pattern for SPAs.** Keep tokens on the server side and use httpOnly, secure, SameSite cookies for session management. This eliminates the risk of token theft through XSS attacks.

6. **Validate redirect URIs with exact string matching.** Do not allow wildcard subdomains, partial path matching, or query parameter variations. Pre-register all redirect URIs and reject any request that does not match exactly.

7. **Always include and validate the state parameter.** Generate a cryptographically random state value, store it in the session, and verify it on the callback. This prevents CSRF attacks against the OAuth callback endpoint.

8. **Fetch and cache the OIDC discovery document.** Use the `.well-known/openid-configuration` endpoint to discover all authorization server endpoints and supported features. Cache the document but refresh it periodically (every 24 hours).

9. **Validate all ID token claims rigorously.** Verify the signature, `iss`, `aud`, `exp`, `iat`, and `nonce` claims. Reject tokens with unexpected issuers, audiences, or expired timestamps.

10. **Set Cache-Control: no-store on all token responses.** Token endpoint responses must include `Cache-Control: no-store` and `Pragma: no-cache` headers to prevent tokens from being cached by browsers or proxies.

---

## Anti-Patterns

1. **Storing tokens in localStorage.** localStorage is accessible to any JavaScript running on the page. A single XSS vulnerability exposes all stored tokens, including refresh tokens. Use server-side sessions or httpOnly cookies instead.

2. **Using the Implicit grant for SPAs.** Tokens in URL fragments are visible in browser history, referrer headers, and proxy logs. Authorization Code + PKCE with a BFF is the correct approach for SPAs.

3. **Long-lived access tokens without refresh tokens.** Access tokens with 24-hour or longer lifetimes cannot be effectively revoked and provide a wide window for exploitation. Use short-lived access tokens (15 minutes) with refresh token rotation.

4. **Allowing wildcard redirect URIs.** Wildcard subdomain matching (e.g., `https://*.example.com`) enables token theft if an attacker controls any subdomain (through subdomain takeover or compromise). Use exact matching only.

5. **Skipping the state parameter.** Without the state parameter, the OAuth callback is vulnerable to CSRF attacks. An attacker can initiate an OAuth flow with their own account and trick the victim into completing it, linking the attacker's identity to the victim's session.

6. **Using access tokens as proof of identity.** Access tokens are for authorization, not authentication. An access token does not tell you who the user is -- it tells you what the bearer is allowed to do. Use OpenID Connect ID tokens for authentication.

7. **Sharing client secrets in mobile or SPA code.** Client secrets embedded in public clients (mobile apps, SPAs) are extractable. Public clients must use PKCE without a client secret. Only confidential server-side clients should use client secrets.

8. **Not validating the token audience.** If the resource server does not validate the `aud` claim, a token intended for one API can be replayed against another. Always validate that the access token's audience includes the current resource server.

---

## Enforcement Checklist

### Design Phase
- [ ] Selected Authorization Code + PKCE as the grant type for all client types.
- [ ] Defined token lifetimes (access: 15min, refresh: based on risk).
- [ ] Designed BFF architecture for SPA clients.
- [ ] Defined redirect URI registration process and validation rules.
- [ ] Planned token revocation strategy (logout, password change, security events).
- [ ] Identified OIDC scopes required for each client application.

### Implementation Phase
- [ ] PKCE is implemented with `S256` code challenge method.
- [ ] State parameter is generated, stored, and validated on every flow.
- [ ] Nonce is included in authorization requests and validated in ID tokens.
- [ ] Redirect URI validation uses exact string matching.
- [ ] Token endpoint returns `Cache-Control: no-store` header.
- [ ] Refresh token rotation is implemented with reuse detection.
- [ ] Access tokens have a maximum lifetime of 15 minutes.
- [ ] ID token claims (iss, sub, aud, exp, iat, nonce) are fully validated.
- [ ] Client secrets are stored in a secrets manager, not in source code.
- [ ] Discovery document is fetched and cached correctly.
- [ ] Token storage uses server-side sessions or httpOnly cookies (no localStorage).

### Testing Phase
- [ ] Authorization code cannot be reused (single-use enforcement tested).
- [ ] Invalid redirect URIs are rejected without redirecting.
- [ ] Expired tokens are rejected by resource servers.
- [ ] Refresh token reuse triggers token family revocation.
- [ ] CSRF protection via state parameter is verified.
- [ ] PKCE code verifier mismatch causes token exchange failure.
- [ ] ID token with wrong audience is rejected.

### Deployment Phase
- [ ] HTTPS is enforced on all OAuth endpoints.
- [ ] Client secrets are rotated on initial deployment and every 90 days.
- [ ] Token revocation endpoints are deployed and functional.
- [ ] Monitoring configured for unusual token request patterns.
- [ ] Logging captures OAuth events without logging token values.

### Periodic Review
- [ ] Client registrations are reviewed for unused or deprecated clients.
- [ ] Redirect URIs are audited for each registered client.
- [ ] Token lifetimes are reviewed against current threat landscape.
- [ ] Deprecated grant types (Implicit, ROPC) are confirmed disabled.
- [ ] Refresh token rotation and reuse detection are tested periodically.
