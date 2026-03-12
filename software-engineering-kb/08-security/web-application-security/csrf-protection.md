# CSRF Protection

> **Domain:** Security > Web Application Security > CSRF Protection
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

Cross-Site Request Forgery (CSRF, CWE-352) is an attack that forces an authenticated user's browser to submit an unintended request to a web application. The browser automatically attaches session cookies to the forged request, and the server cannot distinguish it from a legitimate one. The attacker never sees the response -- they only need the side effect: a transferred fund, a changed password, a granted permission.

CSRF ranked in the OWASP Top 10 for years (A05:2013, A08:2013) and remains a relevant threat despite the SameSite cookie default in modern browsers. Applications that use cookie-based authentication -- including SPAs backed by same-origin APIs, OAuth flows with cookies, and traditional server-rendered applications -- must implement explicit CSRF protection. A single unprotected endpoint can lead to account takeover, data modification, privilege escalation, or financial loss.

This guide covers every CSRF defense mechanism, with theory, attack diagrams, implementation in multiple languages, framework-specific guidance, and edge cases.

---

## Table of Contents

1. [What Is CSRF (CWE-352)](#1-what-is-csrf-cwe-352)
2. [Synchronizer Token Pattern](#2-synchronizer-token-pattern)
3. [Double Submit Cookie Pattern](#3-double-submit-cookie-pattern)
4. [SameSite Cookie Attribute](#4-samesite-cookie-attribute)
5. [Custom Request Headers](#5-custom-request-headers)
6. [Origin and Referer Header Checking](#6-origin-and-referer-header-checking)
7. [CSRF in APIs](#7-csrf-in-apis)
8. [CSRF in Single-Page Applications](#8-csrf-in-single-page-applications)
9. [Login CSRF](#9-login-csrf)
10. [CSRF Token Storage and Lifecycle](#10-csrf-token-storage-and-lifecycle)
11. [Framework-Specific CSRF Protection](#11-framework-specific-csrf-protection)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Enforcement Checklist](#enforcement-checklist)

---

## 1. What Is CSRF (CWE-352)

**What it is:** Cross-Site Request Forgery is an attack where a malicious site causes the victim's browser to send a state-changing HTTP request to a target site where the victim is authenticated. The browser automatically includes cookies (session IDs, authentication tokens) with the request. The target server processes the request as if the victim initiated it intentionally.

**Why same-origin policy does not prevent it:** The same-origin policy (SOP) prevents a page on origin A from reading the response of a request to origin B. However, SOP does not prevent origin A from sending a request to origin B. Cookies are attached to requests based on the cookie's domain, not the origin of the page making the request. This means a form on `evil.com` can POST to `bank.com/transfer`, and the browser will include all `bank.com` cookies with that request. The attacker cannot read the response, but the state change (money transfer) has already occurred.

### Attack Flow

```
CSRF Attack Flow:

  1. Victim logs in to bank.com
     Browser stores session cookie: session_id=abc123 (domain=bank.com)

  2. Victim visits evil.com (in the same browser, different tab)

  3. evil.com contains a hidden form that auto-submits:

     <form action="https://bank.com/transfer" method="POST">
       <input type="hidden" name="to" value="attacker-account" />
       <input type="hidden" name="amount" value="10000" />
     </form>
     <script>document.forms[0].submit();</script>

  4. Browser sends POST to bank.com/transfer
     with cookie: session_id=abc123 (attached automatically)

  5. bank.com receives the request, validates the session cookie,
     and processes the transfer. The server sees a valid session
     and has no way to know the request came from evil.com.

     +----------+         +-----------+         +----------+
     | evil.com |-------->| Browser   |-------->| bank.com |
     | (attacker|  hidden | (victim)  |  POST   | (target) |
     |  page)   |  form   |           | +cookie |          |
     +----------+         +-----------+         +----------+
                                                     |
                                                Transfer executes.
                                                Victim loses money.
```

### CSRF Attack Variants

```
Common CSRF Vectors:

  1. Auto-submitting form (POST):
     <form action="target.com/action" method="POST">
       <input type="hidden" name="param" value="malicious" />
     </form>
     <script>document.forms[0].submit()</script>

  2. Image tag (GET -- only if state change happens on GET):
     <img src="https://target.com/delete?id=123" />
     The browser sends a GET request to load the "image"

  3. XMLHttpRequest / fetch (blocked by CORS for reading, but the
     request is still SENT for simple requests):
     fetch("https://target.com/api/action", {
       method: "POST",
       credentials: "include",
       body: "param=value",
       headers: { "Content-Type": "application/x-www-form-urlencoded" }
     });
     // CORS blocks reading the response, but the POST was already sent

  4. Clickjacking + CSRF combination:
     Transparent iframe over a button -- user thinks they click
     the attacker's page but actually clicks a button on target.com
```

### Why Cookies Are the Root Problem

Cookies follow the cookie domain, not the page origin. When a browser makes any request to `bank.com` -- whether initiated by `bank.com` itself, `evil.com`, an image tag, or a form submission -- the browser attaches all cookies scoped to `bank.com`. This automatic credential attachment is what makes CSRF possible. Token-based authentication (Bearer tokens in the Authorization header) is not vulnerable to CSRF because the browser does not automatically attach Authorization headers. Only cookies are sent automatically.

---

## 2. Synchronizer Token Pattern

**How it works:** The server generates a cryptographically random token and associates it with the user's session. The token is embedded in every HTML form as a hidden field. When the form is submitted, the server compares the token in the request body with the token stored in the session. An attacker cannot read the token because the same-origin policy prevents cross-origin reads, so the attacker cannot include the correct token in the forged request.

```
Synchronizer Token Flow:

  1. User requests a page containing a form
     Server generates: csrf_token = random(32 bytes)
     Server stores csrf_token in session: sessions[session_id].csrf = token

  2. Server renders the form with the token embedded:
     <form action="/transfer" method="POST">
       <input type="hidden" name="_csrf" value="a8f3...token..." />
       <input name="to" />
       <input name="amount" />
       <button>Transfer</button>
     </form>

  3. User submits the form
     Browser sends: POST /transfer
       Cookie: session_id=abc123
       Body: _csrf=a8f3...token...&to=recipient&amount=100

  4. Server validates:
     request.body._csrf === sessions[session_id].csrf
     Match: request proceeds
     Mismatch or missing: 403 Forbidden

  5. Attacker cannot forge the request because:
     - The token is in the HTML body (same-origin policy blocks reading it)
     - The attacker cannot guess the token (cryptographically random)
     - The cookie alone is insufficient
```

### Implementation: TypeScript (Express)

```typescript
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

// Generate a CSRF token and store it in the session
function generateCsrfToken(session: Record<string, unknown>): string {
  const token = crypto.randomBytes(32).toString("hex");
  session.csrfToken = token;
  return token;
}

// Middleware: validate CSRF token on state-changing requests
function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods do not need CSRF protection
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const sessionToken = (req.session as Record<string, unknown>)?.csrfToken as
    | string
    | undefined;
  const requestToken =
    (req.headers["x-csrf-token"] as string) ||
    (req.body as Record<string, string>)?._csrf;

  if (!sessionToken || !requestToken) {
    res.status(403).json({ error: "CSRF token missing" });
    return;
  }

  // Constant-time comparison prevents timing attacks
  const valid = crypto.timingSafeEqual(
    Buffer.from(sessionToken, "utf8"),
    Buffer.from(requestToken, "utf8")
  );

  if (!valid) {
    res.status(403).json({ error: "CSRF token invalid" });
    return;
  }

  next();
}

// Route: render a form with the CSRF token
app.get("/transfer", (req, res) => {
  const token = generateCsrfToken(req.session);
  res.render("transfer", { csrfToken: token });
});

// Template (EJS/Handlebars):
// <form action="/transfer" method="POST">
//   <input type="hidden" name="_csrf" value="<%= csrfToken %>" />
//   ...
// </form>
```

### Implementation: Python (Django)

Django provides built-in CSRF protection through its `CsrfViewMiddleware`.

```python
# settings.py -- CSRF is enabled by default
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",  # CSRF protection middleware
    # ...
]

# Template usage:
# <form method="POST">
#   {% csrf_token %}
#   <input name="to" />
#   <input name="amount" />
#   <button>Transfer</button>
# </form>
# Django's {% csrf_token %} renders a hidden input with the CSRF token.

# For AJAX requests, Django expects the token in the X-CSRFToken header.
# Django also reads the token from the csrftoken cookie by default.
```

```python
# View that requires CSRF protection (all POST views by default)
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

@ensure_csrf_cookie  # Ensures the csrftoken cookie is set even on GET
def transfer_form(request):
    if request.method == "GET":
        return render(request, "transfer.html")
    # POST requests are automatically protected by CsrfViewMiddleware
    return JsonResponse({"status": "ok"})
```

### Implementation: Java (Spring Security)

Spring Security enables CSRF protection by default for all state-changing HTTP methods.

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf
                // Store CSRF token in a cookie (readable by JavaScript for SPAs)
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                // Alternatively, use the default HttpSessionCsrfTokenRepository
                // for server-rendered applications
            );
        return http.build();
    }
}

// In Thymeleaf templates, Spring automatically injects the CSRF token:
// <form th:action="@{/transfer}" method="POST">
//   <!-- CSRF token is automatically included by Thymeleaf -->
//   <input name="to" />
//   <button>Transfer</button>
// </form>
```

### Implementation: C# (ASP.NET Core)

```csharp
// ASP.NET Core enables anti-forgery by default for Razor Pages.
// For MVC, use [ValidateAntiForgeryToken] or configure globally.

// Program.cs -- enable globally
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";       // Header name for AJAX requests
    options.Cookie.Name = "__Host-csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

// Controller
[HttpPost]
[ValidateAntiForgeryToken]
public IActionResult Transfer(TransferModel model)
{
    // If the anti-forgery token is invalid, ASP.NET returns 400 automatically
    ProcessTransfer(model);
    return Ok();
}

// Razor view:
// <form asp-action="Transfer" method="POST">
//   @Html.AntiForgeryToken()
//   <input asp-for="To" />
//   <input asp-for="Amount" />
//   <button>Transfer</button>
// </form>
```

### Implementation: Go (gorilla/csrf)

```go
package main

import (
    "net/http"

    "github.com/gorilla/csrf"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()

    // 32-byte authentication key for CSRF token signing
    csrfMiddleware := csrf.Protect(
        []byte("32-byte-long-auth-key-here------"),
        csrf.Secure(true),                        // Require HTTPS
        csrf.SameSite(csrf.SameSiteLaxMode),
        csrf.Path("/"),
        csrf.HttpOnly(true),
    )

    r.HandleFunc("/transfer", transferFormHandler).Methods("GET")
    r.HandleFunc("/transfer", transferSubmitHandler).Methods("POST")

    // Apply CSRF middleware to all routes
    http.ListenAndServeTLS(":443", "cert.pem", "key.pem", csrfMiddleware(r))
}

func transferFormHandler(w http.ResponseWriter, r *http.Request) {
    // csrf.Token(r) returns the token to embed in the form
    // csrf.TemplateField(r) returns a complete <input> HTML element
    tmpl.Execute(w, map[string]interface{}{
        csrf.TemplateTag: csrf.TemplateField(r),
    })
}

func transferSubmitHandler(w http.ResponseWriter, r *http.Request) {
    // gorilla/csrf middleware automatically validates the token
    // If invalid, it returns 403 before this handler is called
    processTransfer(r)
    w.Write([]byte("Transfer successful"))
}
```

### Implementation: PHP (Laravel)

```php
{{-- Laravel Blade template --}}
<form action="/transfer" method="POST">
    @csrf {{-- Renders: <input type="hidden" name="_token" value="..."> --}}
    <input name="to" />
    <input name="amount" />
    <button>Transfer</button>
</form>

{{-- Laravel's VerifyCsrfToken middleware validates the _token field
     automatically for all POST, PUT, PATCH, DELETE requests. --}}
```

```php
// Excluding specific routes from CSRF (use sparingly)
// app/Http/Middleware/VerifyCsrfToken.php
class VerifyCsrfToken extends Middleware
{
    protected $except = [
        'webhook/stripe',  // Webhooks from external services cannot include CSRF tokens
    ];
}
```

---

## 3. Double Submit Cookie Pattern

**How it works:** The server generates a random token and sets it as a cookie. The same token value must also be included in the request body or a custom header. On submission, the server compares the cookie value with the body/header value. An attacker can cause the browser to send the cookie (automatic), but cannot read the cookie value to include it in the request body (blocked by same-origin policy). Therefore, only legitimate pages on the same origin can submit the correct token.

```
Double Submit Cookie Flow:

  1. Server generates token, sets it as a cookie:
     Set-Cookie: csrf_token=xyz789; Path=/; Secure; SameSite=Lax

  2. Client-side JavaScript reads the cookie and includes it in requests:
     - As a hidden form field: <input name="_csrf" value="xyz789" />
     - Or as a custom header: X-CSRF-Token: xyz789

  3. Server validates: request.cookies.csrf_token === request.body._csrf

  4. Why this works:
     - Attacker CAN cause the browser to send the csrf_token cookie
       (cookies are automatic)
     - Attacker CANNOT read the csrf_token cookie value from evil.com
       (same-origin policy)
     - Attacker CANNOT set the correct value in the form body or header
     - Cookie and body/header values will not match on a forged request
```

### Plain Double Submit (Stateless)

```typescript
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

// Set the CSRF cookie on page load
function setCsrfCookie(res: Response): string {
  const token = crypto.randomBytes(32).toString("hex");

  res.cookie("csrf_token", token, {
    httpOnly: false, // JavaScript must read this cookie
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600_000,
  });

  return token;
}

// Validate double submit
function doubleSubmitValidation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies.csrf_token;
  const headerToken = req.headers["x-csrf-token"] as string;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  // Constant-time comparison
  if (cookieToken.length !== headerToken.length) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(cookieToken, "utf8"),
    Buffer.from(headerToken, "utf8")
  );

  if (!valid) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  next();
}
```

### Signed Double Submit (Recommended for Stateless Apps)

The plain double submit cookie has a weakness: if an attacker can set cookies on the target domain (via a subdomain XSS or a related-domain vulnerability), they can set both the cookie and the hidden field to the same attacker-controlled value. Signing the cookie with a server-side secret prevents this.

```typescript
import crypto from "crypto";

const CSRF_SECRET = process.env.CSRF_SECRET!; // Server-side secret, never exposed

// Generate a signed CSRF token
function generateSignedCsrfToken(): { token: string; signature: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const signature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(token)
    .digest("hex");

  return { token, signature };
}

// Set signed CSRF cookie
function setSignedCsrfCookie(res: Response): string {
  const { token, signature } = generateSignedCsrfToken();
  const signedToken = `${token}.${signature}`;

  res.cookie("csrf_token", signedToken, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600_000,
  });

  return signedToken;
}

// Validate signed double submit
function validateSignedDoubleSubmit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies.csrf_token as string;
  const headerToken = req.headers["x-csrf-token"] as string;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  // Step 1: Cookie and header must match
  if (cookieToken !== headerToken) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  // Step 2: Verify the signature (prevents attacker from crafting their own token)
  const parts = cookieToken.split(".");
  if (parts.length !== 2) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  const [token, providedSignature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(token)
    .digest("hex");

  const signatureValid = crypto.timingSafeEqual(
    Buffer.from(providedSignature, "utf8"),
    Buffer.from(expectedSignature, "utf8")
  );

  if (!signatureValid) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  next();
}
```

### Go Implementation (Signed Double Submit)

```go
package csrf

import (
    "crypto/hmac"
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "net/http"
    "strings"
)

var csrfSecret = []byte("your-secret-key-at-least-32-bytes")

func GenerateSignedToken() (string, error) {
    tokenBytes := make([]byte, 32)
    if _, err := rand.Read(tokenBytes); err != nil {
        return "", fmt.Errorf("generate token: %w", err)
    }

    token := hex.EncodeToString(tokenBytes)
    mac := hmac.New(sha256.New, csrfSecret)
    mac.Write([]byte(token))
    signature := hex.EncodeToString(mac.Sum(nil))

    return token + "." + signature, nil
}

func ValidateSignedToken(signedToken string) bool {
    parts := strings.SplitN(signedToken, ".", 2)
    if len(parts) != 2 {
        return false
    }

    token, providedSig := parts[0], parts[1]

    mac := hmac.New(sha256.New, csrfSecret)
    mac.Write([]byte(token))
    expectedSig := hex.EncodeToString(mac.Sum(nil))

    return hmac.Equal([]byte(providedSig), []byte(expectedSig))
}

func DoubleSubmitMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
            next.ServeHTTP(w, r)
            return
        }

        cookie, err := r.Cookie("csrf_token")
        if err != nil {
            http.Error(w, "CSRF cookie missing", http.StatusForbidden)
            return
        }

        headerToken := r.Header.Get("X-CSRF-Token")
        if headerToken == "" {
            http.Error(w, "CSRF header missing", http.StatusForbidden)
            return
        }

        if cookie.Value != headerToken {
            http.Error(w, "CSRF token mismatch", http.StatusForbidden)
            return
        }

        if !ValidateSignedToken(cookie.Value) {
            http.Error(w, "CSRF token signature invalid", http.StatusForbidden)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

---

## 4. SameSite Cookie Attribute

**How it works:** The `SameSite` attribute on a cookie tells the browser when to include the cookie in cross-site requests. This is the most effective single defense against CSRF because it prevents the browser from sending authentication cookies on cross-site requests where CSRF would occur.

### SameSite Values

```
SameSite Attribute Comparison:

  +----------+-----------------+------------------+------------------+------------------+
  | Value    | Cross-site      | Cross-site       | Cross-site       | Use case         |
  |          | top-level GET   | POST / form      | fetch/XHR        |                  |
  +----------+-----------------+------------------+------------------+------------------+
  | Strict   | NOT sent        | NOT sent         | NOT sent         | High-security    |
  |          |                 |                  |                  | internal apps    |
  +----------+-----------------+------------------+------------------+------------------+
  | Lax      | SENT            | NOT sent         | NOT sent         | General web      |
  |          | (navigations)   |                  |                  | apps (default)   |
  +----------+-----------------+------------------+------------------+------------------+
  | None     | SENT            | SENT             | SENT             | Third-party      |
  |          |                 |                  |                  | embeds, OAuth    |
  +----------+-----------------+------------------+------------------+------------------+

  Notes:
  - Lax is the default in Chrome, Edge, and Firefox (since ~2020).
  - None REQUIRES the Secure attribute (HTTPS only).
  - "Cross-site" means different registrable domain (eTLD+1).
    sub.example.com -> example.com is same-site.
    app.example.com -> api.example.com is same-site.
    example.com -> evil.com is cross-site.
```

### SameSite=Strict

The cookie is never sent on any cross-site request. This provides the strongest CSRF protection but breaks usability for links from external sites. If a user clicks a link to your application from an email or another website, they will appear logged out because the session cookie is not sent on the initial navigation.

```typescript
// SameSite=Strict -- strongest protection but impacts UX
res.cookie("__Host-sid", sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: "strict", // Never sent on cross-site requests
  path: "/",
  maxAge: 3600_000,
});

// Use case: banking apps, admin panels, internal tools
// where users always navigate directly (bookmark, type URL)
```

### SameSite=Lax

The cookie is sent on top-level navigation GET requests from other sites (e.g., clicking a link) but NOT on cross-site POST, iframe, fetch, or XHR requests. This prevents the most common CSRF vectors (form POST from another site) while preserving usability for incoming links.

```typescript
// SameSite=Lax -- recommended default for most applications
res.cookie("__Host-sid", sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: "lax", // Sent on top-level GET navigations, blocked on cross-site POST
  path: "/",
  maxAge: 3600_000,
});

// This blocks:
//   - <form method="POST"> from evil.com (main CSRF vector)
//   - fetch("your-site.com", { method: "POST", credentials: "include" })
//   - <iframe src="your-site.com/action">
//
// This allows:
//   - <a href="your-site.com/dashboard"> (user clicks link from email)
//   - Top-level window.location = "your-site.com/page"
```

### SameSite=None

The cookie is sent on all requests, including cross-site. This is required for third-party integrations (embedded widgets, OAuth flows, cross-domain single sign-on). It must be paired with the Secure attribute. Applications using SameSite=None must implement additional CSRF protections (synchronizer token, double submit, custom headers).

```typescript
// SameSite=None -- ONLY for third-party/cross-site use cases
res.cookie("third_party_session", sessionId, {
  httpOnly: true,
  secure: true,        // REQUIRED when SameSite=None
  sameSite: "none",    // Sent on all cross-site requests
  path: "/",
  maxAge: 3600_000,
});

// MUST combine with additional CSRF defenses:
// - Synchronizer token pattern
// - Double submit cookie (signed)
// - Custom header validation
```

### Browser Compatibility

```
SameSite Browser Support (as of 2025):

  +-------------------+--------------------------------------------+
  | Browser           | Default behavior for cookies without       |
  |                   | explicit SameSite attribute                |
  +-------------------+--------------------------------------------+
  | Chrome 80+        | Defaults to Lax                            |
  | Edge 80+          | Defaults to Lax                            |
  | Firefox 69+       | Defaults to Lax                            |
  | Safari 15.4+      | Defaults to Lax (with caveats)             |
  | Older browsers    | No SameSite support -- cookies sent always |
  +-------------------+--------------------------------------------+

  Important: Do not rely solely on SameSite for CSRF protection.
  Older browsers and some edge cases (Safari quirks with redirects)
  may not enforce SameSite as expected. Always combine SameSite
  with at least one additional defense layer.
```

---

## 5. Custom Request Headers

**How it works:** AJAX requests include a custom header (e.g., `X-CSRF-Token` or `X-Requested-With`). The server validates the presence of this header. Browsers enforce the CORS specification: cross-origin requests with custom headers trigger a preflight (OPTIONS) request. Unless the target server explicitly allows the custom header via `Access-Control-Allow-Headers`, the browser blocks the request entirely.

```
Custom Header Defense Flow:

  1. Legitimate AJAX request from same origin:
     POST /api/transfer
     Cookie: session_id=abc123
     X-Requested-With: XMLHttpRequest    <-- custom header
     Content-Type: application/json

     Server checks for X-Requested-With header -> present -> allow

  2. Attacker's cross-origin request from evil.com:
     POST /api/transfer
     Cookie: session_id=abc123
     X-Requested-With: XMLHttpRequest    <-- triggers CORS preflight

     Browser sends preflight:
     OPTIONS /api/transfer
     Origin: https://evil.com

     Server does NOT include evil.com in Access-Control-Allow-Origin
     Browser blocks the actual request -> CSRF prevented

  3. Attacker's form submission (no custom headers possible):
     <form action="target.com/api/transfer" method="POST">
     HTML forms CANNOT set custom headers -> server rejects (no header)
```

### Implementation

```typescript
// Server-side: require custom header on state-changing requests
function requireCustomHeader(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Verify custom header is present
  // Browsers prevent cross-origin custom headers without CORS approval
  const hasCustomHeader =
    req.headers["x-requested-with"] === "XMLHttpRequest" ||
    req.headers["x-csrf-token"] !== undefined;

  if (!hasCustomHeader) {
    res.status(403).json({ error: "Missing required CSRF header" });
    return;
  }

  next();
}

// CORS configuration: do NOT allow X-Requested-With from untrusted origins
app.use(cors({
  origin: ["https://app.example.com"],  // Only your own origin
  credentials: true,
  allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Requested-With"],
}));
```

```typescript
// Client-side: include custom header in all AJAX requests
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Or with fetch:
async function apiRequest(path: string, options: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
    },
  });
}
```

**Limitation:** Custom headers cannot be set on regular HTML form submissions. This defense only works for AJAX/fetch-based APIs. Server-rendered forms that submit as `application/x-www-form-urlencoded` must use the synchronizer token or double submit cookie pattern.

---

## 6. Origin and Referer Header Checking

**How it works:** The server checks the `Origin` or `Referer` header of incoming requests to verify the request originated from the application's own domain. Cross-site requests will have a different Origin. This is a supplementary defense, not a primary one, because these headers can be absent or suppressed in certain scenarios.

### Implementation

```typescript
const TRUSTED_ORIGINS = new Set([
  "https://app.example.com",
  "https://www.example.com",
]);

function originCheck(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Prefer Origin header (set by browsers on POST, PUT, DELETE, PATCH)
  const origin = req.headers.origin;

  if (origin) {
    if (TRUSTED_ORIGINS.has(origin)) {
      return next();
    }
    res.status(403).json({ error: "Untrusted origin" });
    return;
  }

  // Fallback to Referer header if Origin is absent
  const referer = req.headers.referer;

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = refererUrl.origin;
      if (TRUSTED_ORIGINS.has(refererOrigin)) {
        return next();
      }
    } catch {
      // Invalid referer URL
    }
    res.status(403).json({ error: "Untrusted referer" });
    return;
  }

  // Both Origin and Referer are missing
  // This can happen with privacy extensions, direct requests, or bookmarks.
  // Decision: reject by default (fail-closed).
  // Some applications allow missing headers for GET-like semantics,
  // but for POST/PUT/DELETE, rejecting is the safe choice.
  res.status(403).json({ error: "Origin header required" });
}
```

```go
func OriginCheckMiddleware(trustedOrigins map[string]bool) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
                next.ServeHTTP(w, r)
                return
            }

            origin := r.Header.Get("Origin")
            if origin != "" {
                if trustedOrigins[origin] {
                    next.ServeHTTP(w, r)
                    return
                }
                http.Error(w, "Untrusted origin", http.StatusForbidden)
                return
            }

            referer := r.Header.Get("Referer")
            if referer != "" {
                parsed, err := url.Parse(referer)
                if err == nil {
                    refOrigin := parsed.Scheme + "://" + parsed.Host
                    if trustedOrigins[refOrigin] {
                        next.ServeHTTP(w, r)
                        return
                    }
                }
                http.Error(w, "Untrusted referer", http.StatusForbidden)
                return
            }

            http.Error(w, "Origin header required", http.StatusForbidden)
        })
    }
}
```

### When Origin/Referer Can Be Missing or Unreliable

```
Scenarios where Origin/Referer headers may be absent:

  1. Browser privacy settings or extensions strip Referer
  2. Referrer-Policy: no-referrer is set on the page
  3. Navigations from HTTPS to HTTP (downgrade) strip Referer
  4. Some older browsers do not send Origin on POST requests
  5. Requests from bookmarks, typed URLs, or browser extensions
  6. Privacy-focused browsers may omit or truncate these headers

  Conclusion: Origin/Referer checking is a SUPPLEMENTARY defense.
  Never use it as the sole CSRF protection mechanism.
  Combine with synchronizer tokens or SameSite cookies.
```

---

## 7. CSRF in APIs

### REST APIs with Token-Based Auth

REST APIs that use Bearer tokens in the Authorization header are generally not vulnerable to CSRF. The browser does not automatically attach Authorization headers -- the client-side code must explicitly set them. An attacker cannot cause the victim's browser to include a Bearer token on a cross-origin request.

```
Token-based auth (NOT vulnerable to CSRF):
  Authorization: Bearer eyJhbGciOi...

  Why: The browser does not automatically attach this header.
  The token must be explicitly added by JavaScript code.
  Cross-origin JavaScript cannot read the token from the legitimate page.

Cookie-based auth (VULNERABLE to CSRF):
  Cookie: session_id=abc123

  Why: The browser automatically attaches cookies.
  Cross-origin forms and requests include cookies regardless of origin.
```

### APIs Using Cookies (SPA + API Same Domain)

When an SPA and its API share the same domain, the API often uses session cookies for authentication. This reintroduces CSRF vulnerability. Apply the same defenses as server-rendered applications.

```typescript
// API that uses cookie-based auth -- MUST have CSRF protection
app.use(cookieParser());
app.use(sessionMiddleware); // Session via cookies

// Apply CSRF protection to all state-changing endpoints
app.use("/api", csrfProtection);

// Or use the signed double submit pattern for stateless APIs
app.use("/api", validateSignedDoubleSubmit);
```

### GraphQL CSRF

GraphQL APIs accept queries via POST requests with `Content-Type: application/json`. A common misconception is that this is safe because HTML forms cannot submit JSON. However, an attacker can use `fetch()` from a cross-origin page to send a simple request with `Content-Type: text/plain` (which does not trigger a CORS preflight), and many GraphQL servers will still parse it as JSON.

```typescript
// VULNERABLE: GraphQL server that accepts non-JSON content types
// Attacker can send: Content-Type: text/plain with a JSON body
// This is a "simple request" in CORS -- no preflight required

// SECURE: Require Content-Type: application/json
function requireJsonContentType(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === "POST") {
    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("application/json")) {
      res.status(415).json({ error: "Content-Type must be application/json" });
      return;
    }
  }
  next();
}

// SECURE: Combine with custom header requirement
app.use("/graphql", requireJsonContentType, requireCustomHeader);
```

### WebSocket CSRF (Cross-Site WebSocket Hijacking -- CSWSH)

WebSocket connections initiated via `new WebSocket("wss://target.com/ws")` send cookies automatically. There is no SameSite enforcement for WebSocket upgrade requests in most browsers. An attacker can establish a WebSocket connection to the target and send/receive messages on behalf of the victim.

```typescript
// VULNERABLE: WebSocket server that only checks cookies
wss.on("connection", (ws, req) => {
  const session = getSessionFromCookies(req.headers.cookie);
  if (session) {
    // Connected -- but this could be from evil.com
    ws.send("Welcome");
  }
});

// SECURE: Validate Origin header on WebSocket upgrade
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({
  server: httpsServer,
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin;

    // Reject connections from untrusted origins
    if (!TRUSTED_ORIGINS.has(origin)) {
      callback(false, 403, "Forbidden origin");
      return;
    }

    // Validate session from cookies
    const session = getSessionFromCookies(info.req.headers.cookie);
    if (!session) {
      callback(false, 401, "Authentication required");
      return;
    }

    callback(true);
  },
});

// SECURE: Use a one-time ticket instead of relying on cookies
// 1. Client requests a WebSocket ticket via authenticated AJAX (with CSRF protection)
// 2. Server returns a short-lived, single-use ticket
// 3. Client connects: new WebSocket("wss://target.com/ws?ticket=abc123")
// 4. Server validates the ticket on upgrade, then invalidates it
```

```go
// Go: Validate Origin on WebSocket upgrade
import (
    "net/http"
    "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        origin := r.Header.Get("Origin")
        return trustedOrigins[origin]
    },
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        // Upgrade failed (origin check or other error)
        return
    }
    defer conn.Close()
    // Handle WebSocket messages
}
```

---

## 8. CSRF in Single-Page Applications

SPAs have unique CSRF considerations because they make API calls via JavaScript rather than submitting HTML forms.

### BFF (Backend For Frontend) Pattern

The BFF pattern proxies all API requests through a same-origin backend. The SPA never directly calls external APIs. Session management and CSRF protection happen on the BFF.

```typescript
// BFF server -- same origin as the SPA

// CSRF token delivered via a dedicated endpoint
app.get("/bff/csrf-token", sessionMiddleware, (req, res) => {
  const token = generateCsrfToken(req.session);
  res.json({ csrfToken: token });
});

// All API calls proxied through BFF with CSRF validation
app.use("/bff/api", sessionMiddleware, csrfProtection, async (req, res) => {
  const session = req.session;
  const response = await fetch(`${UPSTREAM_API}${req.path}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
  });
  const data = await response.json();
  res.status(response.status).json(data);
});
```

```typescript
// SPA client code
class ApiClient {
  private csrfToken: string | null = null;

  async initialize(): Promise<void> {
    const response = await fetch("/bff/csrf-token", { credentials: "include" });
    const data = await response.json();
    this.csrfToken = data.csrfToken;
  }

  async request(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`/bff/api${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        "X-CSRF-Token": this.csrfToken!,
      },
    });
  }
}
```

### CSRF Token in Meta Tag

For server-rendered SPA entry points, embed the CSRF token in a `<meta>` tag. JavaScript reads it and includes it in subsequent requests.

```html
<!-- Server renders the SPA HTML shell with the CSRF token -->
<!DOCTYPE html>
<html>
<head>
  <meta name="csrf-token" content="a8f3...token..." />
</head>
<body>
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
</html>
```

```typescript
// SPA reads the CSRF token from the meta tag
function getCsrfToken(): string {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (!meta) {
    throw new Error("CSRF token meta tag not found");
  }
  return meta.getAttribute("content")!;
}

// Configure axios to include the token in all requests
import axios from "axios";

axios.defaults.headers.common["X-CSRF-Token"] = getCsrfToken();
axios.defaults.withCredentials = true;
```

### CSRF with JWT in Cookies

Some applications store JWTs in HttpOnly cookies rather than localStorage (to protect against XSS). This reintroduces CSRF vulnerability because the JWT cookie is sent automatically on cross-site requests.

```typescript
// If JWT is stored in a cookie, CSRF protection is mandatory

// Option 1: Double submit with the JWT payload hash
// The server sets the JWT in an HttpOnly cookie and also provides
// a non-HttpOnly CSRF cookie derived from the JWT

function setAuthCookies(res: Response, jwt: string): void {
  // JWT in HttpOnly cookie -- not accessible to JavaScript
  res.cookie("__Host-jwt", jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 900_000, // 15 minutes
  });

  // CSRF token derived from JWT -- readable by JavaScript
  const csrfToken = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(jwt)
    .digest("hex");

  res.cookie("csrf_token", csrfToken, {
    httpOnly: false, // JavaScript must read this
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 900_000,
  });
}

// Validation: verify the CSRF token matches the JWT
function validateJwtCsrf(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const jwt = req.cookies["__Host-jwt"];
  const csrfHeader = req.headers["x-csrf-token"] as string;

  if (!jwt || !csrfHeader) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  const expectedCsrf = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(jwt)
    .digest("hex");

  const valid = crypto.timingSafeEqual(
    Buffer.from(csrfHeader, "utf8"),
    Buffer.from(expectedCsrf, "utf8")
  );

  if (!valid) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  next();
}
```

---

## 9. Login CSRF

**What it is:** Login CSRF is an attack where the attacker forces the victim's browser to log into the attacker's account on the target site. The victim then uses the site believing they are logged into their own account, but all activity is associated with the attacker's account. The attacker can later review the victim's activity (search history, saved payment methods, uploaded files).

```
Login CSRF Attack Flow:

  1. Attacker creates an account on target.com:
     username: attacker@evil.com, password: pass123

  2. Attacker's page auto-submits a login form:
     <form action="https://target.com/login" method="POST">
       <input name="email" value="attacker@evil.com" />
       <input name="password" value="pass123" />
     </form>
     <script>document.forms[0].submit();</script>

  3. Victim's browser logs into target.com as the attacker
     Victim believes they are in their own account

  4. Victim adds a credit card, types search queries, uploads documents
     All of this is now in the attacker's account

  5. Attacker logs into their own account and accesses:
     - Victim's credit card number
     - Victim's search history
     - Victim's uploaded documents
```

### Prevention

Login CSRF is harder to prevent because there is no existing session to bind a CSRF token to (the user is not yet authenticated). Defenses include:

```typescript
// Defense 1: Pre-login CSRF token
// Generate a CSRF token before authentication and store it in a short-lived session

app.get("/login", (req, res) => {
  // Create a temporary session just for the CSRF token
  const preLoginToken = crypto.randomBytes(32).toString("hex");
  req.session.preLoginCsrf = preLoginToken;
  res.render("login", { csrfToken: preLoginToken });
});

app.post("/login", (req, res) => {
  // Validate the pre-login CSRF token
  const sessionToken = req.session.preLoginCsrf;
  const formToken = req.body._csrf;

  if (!sessionToken || !formToken || sessionToken !== formToken) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }

  // Clear the pre-login token
  delete req.session.preLoginCsrf;

  // Proceed with authentication...
  const user = authenticateUser(req.body.email, req.body.password);
  // ... regenerate session, set cookies, etc.
});

// Defense 2: SameSite=Lax on session cookies
// Prevents cross-site POST to the login endpoint
// This is the simplest defense and works for most cases

// Defense 3: Origin header check
// Validate that the Origin header matches your domain on the login POST
```

---

## 10. CSRF Token Storage and Lifecycle

### Per-Session vs Per-Request Tokens

```
Per-Session Token (Recommended):
  - One CSRF token per session
  - Token remains the same for the session's lifetime
  - Simpler to implement with SPAs (token does not change between requests)
  - No issues with browser back button or multiple tabs
  - Sufficient for most applications

Per-Request Token:
  - New CSRF token generated on every page load or request
  - Previous token is invalidated
  - Provides defense in depth against token leakage
  - Breaks browser back button (stale token in cached page)
  - Breaks multiple tabs (each tab invalidates the other's token)
  - Use only when the threat model requires it (high-value financial transactions)
```

### Token Rotation

```typescript
// Rotate the CSRF token on privilege changes, not on every request
function rotateCsrfToken(session: Record<string, unknown>): string {
  const newToken = crypto.randomBytes(32).toString("hex");
  session.csrfToken = newToken;
  return newToken;
}

// Rotate after login
async function loginHandler(req: Request, res: Response): Promise<void> {
  // ... authenticate user ...
  // Regenerate session ID (session fixation prevention)
  // AND rotate CSRF token
  const csrfToken = rotateCsrfToken(req.session);
  res.json({ csrfToken });
}

// Rotate after password change or role escalation
async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  // ... change password ...
  const csrfToken = rotateCsrfToken(req.session);
  res.json({ csrfToken });
}
```

### Token Delivery: Meta Tag vs Hidden Field vs Cookie

```
Token Delivery Mechanisms:

  +-------------------+-------------------------------------------+-------------------------+
  | Mechanism         | How it works                              | When to use             |
  +-------------------+-------------------------------------------+-------------------------+
  | Hidden form field | <input type="hidden" name="_csrf"         | Server-rendered forms   |
  |                   | value="token" />                          |                         |
  +-------------------+-------------------------------------------+-------------------------+
  | Meta tag          | <meta name="csrf-token" content="token">  | SPAs with server-       |
  |                   | JavaScript reads and includes in headers  | rendered HTML shell     |
  +-------------------+-------------------------------------------+-------------------------+
  | Cookie            | Set-Cookie: csrf_token=token              | Double submit pattern   |
  |                   | (non-HttpOnly, JavaScript reads it)       | Stateless applications  |
  +-------------------+-------------------------------------------+-------------------------+
  | API response      | GET /csrf-token returns { token: "..." }  | SPAs with dedicated     |
  |                   | JavaScript stores in memory               | CSRF token endpoint     |
  +-------------------+-------------------------------------------+-------------------------+
```

---

## 11. Framework-Specific CSRF Protection

### Django (Python)

Django includes CSRF protection by default via `CsrfViewMiddleware`.

```python
# settings.py
MIDDLEWARE = [
    "django.middleware.csrf.CsrfViewMiddleware",  # Enabled by default
]

# CSRF settings
CSRF_COOKIE_SECURE = True          # Cookie only sent over HTTPS
CSRF_COOKIE_HTTPONLY = False        # JavaScript must read it for AJAX
CSRF_COOKIE_SAMESITE = "Lax"       # SameSite attribute
CSRF_USE_SESSIONS = False          # Store token in cookie (default) or session
CSRF_TRUSTED_ORIGINS = [           # Required for cross-origin POST (Django 4.0+)
    "https://app.example.com",
]

# Templates: use {% csrf_token %} in every form
# AJAX: read csrftoken cookie and send as X-CSRFToken header

# JavaScript for Django AJAX CSRF:
# function getCookie(name) {
#     const value = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
#     return value ? value.pop() : "";
# }
#
# fetch("/api/endpoint", {
#     method: "POST",
#     headers: {
#         "X-CSRFToken": getCookie("csrftoken"),
#         "Content-Type": "application/json",
#     },
#     body: JSON.stringify(data),
# });
```

### Express (TypeScript/JavaScript)

The `csurf` package is deprecated. Use `csrf-csrf` (double submit) or `csrf-sync` (synchronizer token) instead.

```typescript
// Using csrf-csrf (double submit cookie pattern)
import { doubleCsrf } from "csrf-csrf";

const {
  generateToken,
  doubleCsrfProtection, // Middleware
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  cookieName: "__Host-csrf",
  cookieOptions: {
    httpOnly: true,    // csrf-csrf signs the cookie, so HttpOnly is fine
    secure: true,
    sameSite: "lax",
    path: "/",
  },
  getTokenFromRequest: (req) =>
    req.headers["x-csrf-token"] as string,
});

// Apply middleware
app.use(doubleCsrfProtection);

// Generate token for forms/SPA
app.get("/csrf-token", (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});
```

```typescript
// Using csrf-sync (synchronizer token pattern)
import { csrfSync } from "csrf-sync";

const {
  generateToken,
  csrfSynchronisedProtection, // Middleware
} = csrfSync({
  getTokenFromRequest: (req) =>
    req.headers["x-csrf-token"] as string || req.body?._csrf,
});

app.use(csrfSynchronisedProtection);
```

### Spring Security (Java)

Spring Security enables CSRF protection by default.

```java
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // Option 1: Cookie-based CSRF token (for SPAs)
        http.csrf(csrf -> csrf
            .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
            // Ignore CSRF for specific paths (webhooks, public APIs)
            .ignoringRequestMatchers("/webhook/**")
        );

        // Option 2: Session-based CSRF token (for server-rendered apps)
        // http.csrf(Customizer.withDefaults()); // Uses HttpSessionCsrfTokenRepository

        return http.build();
    }
}

// Spring automatically:
// 1. Generates a CSRF token per session
// 2. Stores it in a cookie (XSRF-TOKEN) or session
// 3. Validates it on POST, PUT, PATCH, DELETE
// 4. Injects it into Thymeleaf forms automatically
//
// For AJAX:
// Read the XSRF-TOKEN cookie and send as X-XSRF-TOKEN header
```

### ASP.NET Core (C#)

```csharp
// Program.cs
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = "__Host-csrf";
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.HttpOnly = true;
});

// Apply globally to all controllers
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});

// Or per-controller / per-action
[ValidateAntiForgeryToken]
[HttpPost]
public IActionResult Transfer(TransferModel model)
{
    // Token validated automatically
    return Ok();
}

// For APIs consumed by SPAs: provide the token via a dedicated endpoint
[HttpGet("/antiforgery/token")]
[IgnoreAntiforgeryToken]
public IActionResult GetAntiForgeryToken()
{
    var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
    Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!,
        new CookieOptions
        {
            HttpOnly = false, // JavaScript must read this
            Secure = true,
            SameSite = SameSiteMode.Lax,
        });
    return Ok();
}
```

### Laravel (PHP)

```php
// Laravel includes CSRF protection by default via VerifyCsrfToken middleware.

// Blade templates: use @csrf directive
<form action="/transfer" method="POST">
    @csrf
    <input name="to" />
    <input name="amount" />
    <button>Transfer</button>
</form>

// For AJAX: Laravel sets XSRF-TOKEN cookie automatically.
// Axios reads it automatically. For fetch:
// const token = document.querySelector('meta[name="csrf-token"]').content;
// fetch("/api/endpoint", {
//     method: "POST",
//     headers: {
//         "X-CSRF-TOKEN": token,
//         "Content-Type": "application/json",
//     },
// });

// Meta tag in Blade layout:
// <meta name="csrf-token" content="{{ csrf_token() }}">
```

```php
// Excluding routes from CSRF verification
// app/Http/Middleware/VerifyCsrfToken.php
class VerifyCsrfToken extends Middleware
{
    protected $except = [
        'stripe/webhook',     // External webhooks cannot include CSRF tokens
        'api/external-hook',
    ];
}
```

### Go (gorilla/csrf)

```go
package main

import (
    "net/http"

    "github.com/gorilla/csrf"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()

    // CSRF protection middleware
    csrfMiddleware := csrf.Protect(
        []byte("32-byte-auth-key-for-csrf-prot-"),
        csrf.Secure(true),
        csrf.SameSite(csrf.SameSiteLaxMode),
        csrf.HttpOnly(true),
        csrf.Path("/"),
        csrf.ErrorHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.WriteHeader(http.StatusForbidden)
            w.Write([]byte(`{"error":"CSRF validation failed"}`))
        })),
    )

    r.HandleFunc("/form", showForm).Methods("GET")
    r.HandleFunc("/submit", handleSubmit).Methods("POST")

    // For SPA/AJAX: provide token via header
    r.HandleFunc("/api/csrf-token", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-CSRF-Token", csrf.Token(r))
        w.WriteHeader(http.StatusOK)
    }).Methods("GET")

    http.ListenAndServeTLS(":443", "cert.pem", "key.pem", csrfMiddleware(r))
}

func showForm(w http.ResponseWriter, r *http.Request) {
    // csrf.TemplateField(r) returns the hidden <input> element
    tmpl.Execute(w, map[string]interface{}{
        csrf.TemplateTag: csrf.TemplateField(r),
    })
}
```

---

## Best Practices

### 1. Always Combine SameSite Cookies with a Token-Based Defense

SameSite=Lax prevents the most common CSRF attacks (cross-site POST), but do not rely on it alone. Older browsers do not support SameSite. Edge cases exist (same-site but cross-origin, browser bugs). Combine SameSite cookies with synchronizer tokens, double submit cookies, or custom header validation as defense in depth.

### 2. Use Constant-Time Comparison for Token Validation

Compare CSRF tokens using constant-time functions (`crypto.timingSafeEqual` in Node.js, `hmac.Equal` in Go, `secrets.compare_digest` in Python, `MessageDigest.isEqual` in Java). Standard string comparison leaks timing information that can allow an attacker to discover the token one character at a time.

### 3. Never Perform State-Changing Operations on GET Requests

GET requests must be safe and idempotent. State changes (creating, updating, deleting resources) must use POST, PUT, PATCH, or DELETE. SameSite=Lax allows cookies on cross-site GET navigations. If a GET endpoint performs a state change, SameSite=Lax provides no protection.

### 4. Require CSRF Protection on Login Endpoints

Login CSRF is a distinct attack vector. Apply CSRF token validation to the login form, even though the user does not have an authenticated session. Use a pre-login session to store the CSRF token, or rely on SameSite=Lax plus Origin header checking.

### 5. Validate the Origin Header as a Supplementary Check

Check the `Origin` header on all state-changing requests. If `Origin` is present and does not match your trusted origins, reject the request. Fall back to `Referer` if `Origin` is absent. This is not sufficient alone (both headers can be absent) but adds a useful layer.

### 6. Protect WebSocket Connections Against CSWSH

WebSocket upgrade requests send cookies automatically and SameSite enforcement is inconsistent across browsers for WebSocket. Validate the `Origin` header on upgrade. Alternatively, use a one-time ticket pattern: the client obtains a short-lived ticket via a CSRF-protected AJAX call, then passes it as a query parameter on the WebSocket URL.

### 7. Use Framework-Provided CSRF Protection

Do not implement CSRF protection from scratch when your framework provides it. Django, Spring Security, ASP.NET Core, Laravel, and gorilla/csrf have battle-tested implementations. Understand how they work, configure them properly, and ensure they are enabled.

### 8. Deliver CSRF Tokens Securely

For server-rendered applications, embed the token in a hidden form field. For SPAs, deliver the token via a `<meta>` tag in the HTML shell, a dedicated API endpoint, or a non-HttpOnly cookie (double submit). Never include the CSRF token in a URL query parameter -- it may leak via Referer headers, server logs, or browser history.

### 9. Rotate CSRF Tokens on Authentication State Changes

Generate a new CSRF token after login, logout, password change, or privilege escalation. This limits the window of exposure if a token is leaked and prevents session fixation attacks from carrying over a known CSRF token.

### 10. Enforce Strict CORS Configuration

Misconfigured CORS can undermine CSRF protections. Never use `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` (browsers reject this combination, but avoid it). Whitelist specific trusted origins. Do not reflect the `Origin` header as the allowed origin without validation.

---

## Anti-Patterns

### 1. Relying Solely on SameSite Cookies

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Application relies entirely on SameSite=Lax with no additional CSRF defense | Older browsers (IE11, older Safari) do not enforce SameSite. Some edge cases (same-site subdomains, browser bugs) bypass it | Combine SameSite with synchronizer tokens, double submit cookies, or custom header validation |

### 2. CSRF Token in URL Query Parameters

| Problem | Consequence | Fix |
|---------|-------------|-----|
| CSRF token passed as `?csrf_token=abc123` in the URL | Token leaks via Referer header to external sites, appears in server logs, browser history, and proxy logs. Shoulder surfing can capture it | Deliver tokens in hidden form fields, request headers, or cookies. Never in URLs |

### 3. Using GET Requests for State Changes

| Problem | Consequence | Fix |
|---------|-------------|-----|
| `GET /delete-account?id=123` or `GET /transfer?to=attacker&amount=10000` performs state changes | Image tags, prefetch, link clicks, and even browser extensions can trigger GET requests. SameSite=Lax allows cross-site GET navigations | Use POST, PUT, PATCH, DELETE for all state-changing operations. GET must be safe and idempotent |

### 4. Disabling CSRF Protection Globally

| Problem | Consequence | Fix |
|---------|-------------|-----|
| `http.csrf(csrf -> csrf.disable())` in Spring, removing CsrfViewMiddleware in Django, or skipping @csrf in Laravel forms | All POST endpoints are exposed to CSRF attacks | Keep CSRF protection enabled globally. Exempt only specific endpoints that genuinely cannot use CSRF tokens (external webhooks with signature verification) |

### 5. Accepting Any Origin in CORS Configuration

| Problem | Consequence | Fix |
|---------|-------------|-----|
| CORS configuration reflects any Origin header or uses wildcard with credentials: `Access-Control-Allow-Origin: *` or dynamically echoing the Origin | Cross-origin JavaScript can read responses from your API, defeating the same-origin policy that CSRF defenses rely on | Whitelist specific trusted origins. Never reflect arbitrary Origin headers |

### 6. Non-HttpOnly Double Submit Cookie Without Signing

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Plain double submit cookie where the token is not signed by a server-side secret | An attacker who can set cookies on the target domain (subdomain XSS, related domain) can set both the cookie and the hidden field to the same arbitrary value | Use signed double submit: the server signs the token with a secret. The attacker cannot forge a valid signature |

### 7. No CSRF Protection on Login Forms

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Login endpoint has no CSRF protection because "the user is not authenticated yet" | Login CSRF: attacker logs the victim into the attacker's account. Victim's activity (search queries, payment methods, uploads) is captured by the attacker | Apply CSRF protection to login endpoints. Use a pre-login session for the token, or enforce SameSite=Lax plus Origin header checking |

### 8. Skipping CSRF for "JSON-Only" APIs

| Problem | Consequence | Fix |
|---------|-------------|-----|
| API does not enforce CSRF because "only JSON requests are accepted" and "forms cannot submit JSON" | Attackers can use `fetch()` with `Content-Type: text/plain` (a "simple" CORS request that does not trigger preflight) and a JSON body. Many servers parse it as JSON regardless of Content-Type | Validate `Content-Type: application/json` strictly. Require a custom header. Use SameSite cookies. Do not assume CORS preflight protects you |

---

## Enforcement Checklist

### Cookie Configuration
- [ ] Session cookies use SameSite=Lax or SameSite=Strict
- [ ] Session cookies have the Secure attribute (HTTPS only)
- [ ] Session cookies have the HttpOnly attribute
- [ ] Session cookies use the __Host- prefix where possible
- [ ] SameSite=None is only used where cross-site delivery is required, and always with Secure

### Synchronizer Token Pattern
- [ ] CSRF tokens are generated using a CSPRNG with at least 128 bits of entropy
- [ ] CSRF tokens are bound to the user's session
- [ ] CSRF tokens are validated on all state-changing requests (POST, PUT, PATCH, DELETE)
- [ ] CSRF tokens are compared using constant-time comparison
- [ ] GET, HEAD, and OPTIONS requests are exempt from CSRF validation
- [ ] CSRF tokens are rotated on login, logout, and privilege changes

### Double Submit Cookie
- [ ] Double submit tokens are signed with a server-side secret (signed double submit)
- [ ] The cookie value and request body/header value are compared on the server
- [ ] The cookie is set with Secure and SameSite=Lax attributes
- [ ] Signature is validated to prevent attacker-controlled token injection

### Custom Headers
- [ ] State-changing AJAX endpoints require a custom header (X-CSRF-Token, X-Requested-With)
- [ ] CORS configuration does not allow untrusted origins with credentials
- [ ] CORS does not reflect arbitrary Origin headers
- [ ] Content-Type: application/json is strictly required for JSON API endpoints

### Origin / Referer Validation
- [ ] Origin header is checked against a whitelist of trusted origins on state-changing requests
- [ ] Referer header is used as a fallback when Origin is absent
- [ ] Requests with neither Origin nor Referer are rejected (fail-closed) or flagged

### Framework Configuration
- [ ] Framework CSRF middleware is enabled (not disabled or bypassed)
- [ ] CSRF exemptions are limited to specific paths with documented justification
- [ ] Exempted endpoints (webhooks) use alternative verification (request signatures)
- [ ] Framework CSRF configuration uses Secure cookies and SameSite attributes

### Login CSRF
- [ ] Login form includes CSRF token validation
- [ ] Pre-login session is created to store the login CSRF token
- [ ] Session ID is regenerated after successful authentication

### API and SPA Protection
- [ ] APIs using cookie-based auth implement CSRF protection
- [ ] SPAs obtain CSRF tokens via meta tags, API endpoints, or cookies
- [ ] BFF pattern is used where possible to keep tokens server-side
- [ ] GraphQL endpoints require Content-Type: application/json and a custom header

### WebSocket Protection
- [ ] WebSocket upgrade requests validate the Origin header
- [ ] One-time tickets are used for WebSocket authentication where possible
- [ ] WebSocket connections from untrusted origins are rejected

### General
- [ ] All state-changing operations use POST, PUT, PATCH, or DELETE (never GET)
- [ ] CSRF token is never included in URL query parameters
- [ ] CORS configuration is reviewed and restricted to trusted origins
- [ ] Static analysis or linting detects missing CSRF protection on forms and endpoints
- [ ] Penetration testing includes CSRF testing for all authenticated endpoints
- [ ] CSRF protection is documented in the application's security architecture

---

## CWE and OWASP Reference

| Topic | CWE | OWASP |
|-------|-----|-------|
| Cross-Site Request Forgery | CWE-352 | A01:2021 Broken Access Control |
| Insufficient SameSite Attribute | CWE-1275 | A01:2021 Broken Access Control |
| Cross-Site WebSocket Hijacking | CWE-352 (variant) | A01:2021 Broken Access Control |
| Login CSRF | CWE-352 (variant) | A07:2021 Identification and Authentication Failures |
