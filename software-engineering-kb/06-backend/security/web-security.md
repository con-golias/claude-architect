# Web Security — CORS, CSRF, XSS & Security Headers

> **AI Plugin Directive — Web Security Defenses for Backend APIs**
> You are an AI coding assistant. When generating, reviewing, or refactoring backend security
> code, follow EVERY rule in this document. Every unprotected endpoint is an attack surface.
> A single XSS or CSRF vulnerability can compromise every user. Treat each section as non-negotiable.

**Core Rule: ALWAYS set security headers on every response (Helmet/middleware). ALWAYS configure CORS with explicit origins (never wildcard in production). ALWAYS implement CSRF protection for cookie-based auth. ALWAYS encode output to prevent XSS. NEVER trust any client input — headers, cookies, query params, body, file uploads.**

---

## 1. Security Header Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Security Headers — Defense in Depth              │
│                                                               │
│  Every HTTP response MUST include:                           │
│                                                               │
│  Content-Security-Policy (CSP):                              │
│  ├── Controls what resources the browser can load           │
│  ├── Blocks inline scripts (strongest XSS defense)          │
│  └── Prevents clickjacking, data injection                  │
│                                                               │
│  Strict-Transport-Security (HSTS):                          │
│  ├── Forces HTTPS for all future requests                   │
│  ├── max-age=31536000 (1 year minimum)                      │
│  └── includeSubDomains + preload                            │
│                                                               │
│  X-Content-Type-Options: nosniff                            │
│  ├── Prevents MIME type sniffing                            │
│  └── Browser won't execute JS disguised as image            │
│                                                               │
│  X-Frame-Options: DENY                                       │
│  ├── Prevents clickjacking via iframes                      │
│  └── Use CSP frame-ancestors instead (modern)               │
│                                                               │
│  Referrer-Policy: strict-origin-when-cross-origin           │
│  ├── Controls what referrer info is sent                    │
│  └── Prevents leaking URLs to third parties                 │
│                                                               │
│  Permissions-Policy:                                         │
│  ├── Controls browser features (camera, mic, geolocation)  │
│  └── Disable unused features to reduce attack surface      │
│                                                               │
│  Cache-Control: no-store (for sensitive responses)          │
│  ├── Prevents caching of auth tokens, PII                  │
│  └── Use for /api/me, /api/settings, etc.                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript — Security Headers Middleware

```typescript
import helmet from "helmet";
import express from "express";

const app = express();

// Helmet sets sensible security headers by default
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],              // No inline scripts
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles (or use nonces)
        imgSrc: ["'self'", "data:", "https://cdn.example.com"],
        fontSrc: ["'self'", "https://fonts.googleapis.com"],
        connectSrc: ["'self'", "https://api.example.com"],
        frameSrc: ["'none'"],                // No iframes
        objectSrc: ["'none'"],               // No Flash/plugins
        baseUri: ["'self'"],                 // Prevent <base> tag hijacking
        formAction: ["'self'"],              // Forms submit only to self
        frameAncestors: ["'none'"],          // Cannot be embedded in iframes
        upgradeInsecureRequests: [],         // Upgrade HTTP → HTTPS
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,          // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  }),
);

// Additional headers not covered by Helmet
app.use((req, res, next) => {
  // Permissions Policy — disable unused browser features
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=()",
  );

  // Prevent caching of sensitive API responses
  if (req.path.startsWith("/api/") && req.method !== "GET") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
  }

  next();
});
```

### Go — Security Headers Middleware

```go
func SecurityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // HSTS
        w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

        // CSP
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
            "img-src 'self' data: https://cdn.example.com; "+
            "frame-ancestors 'none'; object-src 'none'; base-uri 'self'")

        // Anti-MIME sniffing
        w.Header().Set("X-Content-Type-Options", "nosniff")

        // Anti-clickjacking
        w.Header().Set("X-Frame-Options", "DENY")

        // Referrer
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

        // Permissions
        w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

        // Cross-origin isolation
        w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
        w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")

        next.ServeHTTP(w, r)
    })
}
```

### Python — Security Headers Middleware

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "frame-ancestors 'none'; object-src 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"

        return response

app.add_middleware(SecurityHeadersMiddleware)
```

---

## 3. CORS — Cross-Origin Resource Sharing

```
┌──────────────────────────────────────────────────────────────┐
│              CORS Flow                                        │
│                                                               │
│  Simple Request (GET, POST with simple headers):            │
│  Browser ──► Server                                          │
│  Origin: https://app.example.com                            │
│  Server responds with:                                       │
│  Access-Control-Allow-Origin: https://app.example.com       │
│                                                               │
│  Preflight Request (PUT, DELETE, custom headers):            │
│  Browser ──► OPTIONS /api/resource                           │
│  Origin: https://app.example.com                            │
│  Access-Control-Request-Method: PUT                          │
│  Access-Control-Request-Headers: Authorization              │
│                                                               │
│  Server responds (204 No Content):                           │
│  Access-Control-Allow-Origin: https://app.example.com       │
│  Access-Control-Allow-Methods: GET, POST, PUT, DELETE       │
│  Access-Control-Allow-Headers: Authorization, Content-Type  │
│  Access-Control-Max-Age: 86400                              │
│                                                               │
│  If preflight passes → Browser sends actual request         │
│                                                               │
│  RULES:                                                      │
│  ├── NEVER use Access-Control-Allow-Origin: * in production │
│  ├── NEVER reflect the Origin header as-is without checking │
│  ├── ALWAYS use explicit allowlist of origins                │
│  ├── ALWAYS set Access-Control-Max-Age to cache preflights  │
│  └── Credentials: true requires explicit origin (not *)     │
└──────────────────────────────────────────────────────────────┘
```

### TypeScript — CORS Configuration

```typescript
import cors from "cors";

// Production CORS configuration
const ALLOWED_ORIGINS = [
  "https://app.example.com",
  "https://admin.example.com",
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000", "http://localhost:5173"] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, origin);
      }

      // Log rejected origins for monitoring
      logger.warn("CORS request from unauthorized origin", { origin });
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-ID", "X-CSRF-Token"],
    exposedHeaders: ["X-Total-Count", "X-Request-ID", "X-RateLimit-Remaining"],
    credentials: true,       // Allow cookies (requires explicit origin, NOT *)
    maxAge: 86400,            // Cache preflight for 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
);
```

### Go — CORS Middleware

```go
func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
    originSet := make(map[string]bool)
    for _, o := range allowedOrigins {
        originSet[o] = true
    }

    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            origin := r.Header.Get("Origin")

            if origin != "" && originSet[origin] {
                w.Header().Set("Access-Control-Allow-Origin", origin)
                w.Header().Set("Access-Control-Allow-Credentials", "true")
                w.Header().Set("Access-Control-Expose-Headers", "X-Total-Count, X-Request-ID")
                w.Header().Set("Vary", "Origin")
            }

            // Handle preflight
            if r.Method == http.MethodOptions {
                w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE")
                w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-CSRF-Token")
                w.Header().Set("Access-Control-Max-Age", "86400")
                w.WriteHeader(http.StatusNoContent)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

---

## 4. CSRF — Cross-Site Request Forgery

```
┌──────────────────────────────────────────────────────────────┐
│              CSRF Attack & Defense                            │
│                                                               │
│  Attack Flow:                                                │
│  1. User logged into bank.com (has session cookie)          │
│  2. User visits evil.com                                    │
│  3. evil.com has: <form action="bank.com/transfer">         │
│  4. Browser sends bank.com cookie automatically             │
│  5. Bank processes transfer (user didn't intend it)         │
│                                                               │
│  When CSRF Applies:                                          │
│  ├── Cookie-based auth (session cookies)               ✅   │
│  ├── Bearer token in Authorization header              ❌   │
│  │   (browser doesn't auto-send Authorization header)       │
│  └── API key in header                                 ❌   │
│                                                               │
│  Defense Strategies:                                         │
│                                                               │
│  1. Synchronizer Token Pattern:                             │
│  ├── Server generates CSRF token, sends in response         │
│  ├── Client includes token in header/body on mutations      │
│  └── Server validates token matches session                 │
│                                                               │
│  2. Double Submit Cookie:                                    │
│  ├── Set CSRF token in cookie + require in header/body      │
│  ├── Attacker can't read cookie from different origin       │
│  └── Simpler (no server-side token storage)                 │
│                                                               │
│  3. SameSite Cookie Attribute:                              │
│  ├── SameSite=Strict: Cookie never sent cross-origin        │
│  ├── SameSite=Lax: Sent only on top-level GET navigation   │
│  └── SameSite=None: Always sent (requires Secure)          │
│                                                               │
│  RULE: Use SameSite=Lax + CSRF token for session cookies    │
│  RULE: Bearer tokens (JWT) do NOT need CSRF protection      │
└──────────────────────────────────────────────────────────────┘
```

### TypeScript — CSRF Protection

```typescript
import { randomBytes } from "crypto";

// Double-submit cookie pattern
class CSRFProtection {
  private readonly COOKIE_NAME = "__csrf";
  private readonly HEADER_NAME = "x-csrf-token";
  private readonly TOKEN_LENGTH = 32;

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip for safe methods (GET, HEAD, OPTIONS)
      if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        // Set CSRF token cookie on read requests
        if (!req.cookies[this.COOKIE_NAME]) {
          const token = randomBytes(this.TOKEN_LENGTH).toString("hex");
          res.cookie(this.COOKIE_NAME, token, {
            httpOnly: false,    // JS must read this cookie
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 86400000,   // 24 hours
          });
        }
        return next();
      }

      // Validate CSRF token on mutations (POST, PUT, DELETE, PATCH)
      const cookieToken = req.cookies[this.COOKIE_NAME];
      const headerToken = req.headers[this.HEADER_NAME] as string;

      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        logger.warn("CSRF validation failed", {
          ip: req.ip,
          path: req.path,
          method: req.method,
          hasCookie: !!cookieToken,
          hasHeader: !!headerToken,
        });
        return res.status(403).json({ error: "csrf_validation_failed" });
      }

      next();
    };
  }
}

// Session cookie configuration
app.use(
  session({
    name: "__session",
    secret: process.env.SESSION_SECRET!,
    cookie: {
      httpOnly: true,       // JavaScript cannot read session cookie
      secure: true,          // HTTPS only
      sameSite: "lax",       // Partial CSRF protection
      maxAge: 86400000,      // 24 hours
      domain: ".example.com",
      path: "/",
    },
    resave: false,
    saveUninitialized: false,
  }),
);
```

---

## 5. XSS — Cross-Site Scripting

```
┌──────────────────────────────────────────────────────────────┐
│              XSS Attack Types & Defenses                      │
│                                                               │
│  1. Reflected XSS (non-persistent):                         │
│  ├── Attack: ?search=<script>alert('xss')</script>          │
│  ├── Server includes input in response HTML                 │
│  └── Defense: Output encoding, CSP                          │
│                                                               │
│  2. Stored XSS (persistent):                                │
│  ├── Attack: User saves <script> in comment/profile         │
│  ├── Every viewer of the page executes the script           │
│  └── Defense: Input sanitization + output encoding          │
│                                                               │
│  3. DOM-based XSS:                                          │
│  ├── Attack: Client-side JS processes untrusted data        │
│  ├── innerHTML, document.write, eval with user data         │
│  └── Defense: Use textContent, avoid innerHTML              │
│                                                               │
│  Defense Layers:                                             │
│  ├── Layer 1: CSP (block inline scripts, strict sources)    │
│  ├── Layer 2: Output encoding (HTML, URL, JS, CSS context)  │
│  ├── Layer 3: Input sanitization (for rich content only)    │
│  ├── Layer 4: HttpOnly cookies (scripts can't steal tokens) │
│  └── Layer 5: Trusted Types (DOM sink protection)           │
│                                                               │
│  RULE: ALWAYS encode output based on context                │
│  RULE: NEVER use innerHTML with user data                   │
│  RULE: ALWAYS use parameterized templates                   │
│  RULE: CSP is REQUIRED, not optional                        │
└──────────────────────────────────────────────────────────────┘
```

### Backend XSS Prevention

```typescript
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { escape as htmlEscape } from "he";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

class XSSProtection {
  // For plain text fields — HTML encode all special characters
  static encodeHTML(input: string): string {
    return htmlEscape(input);
    // Converts: < > & " ' to &lt; &gt; &amp; &quot; &#x27;
  }

  // For rich text fields (comments, descriptions with formatting)
  static sanitizeHTML(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "code", "pre"],
      ALLOWED_ATTR: ["href", "target", "rel"],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ["rel"],         // Force rel on all links
      FORCE_BODY: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });
  }

  // For URL parameters
  static encodeURL(input: string): string {
    return encodeURIComponent(input);
  }

  // Validate URLs (prevent javascript: protocol)
  static sanitizeURL(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
        return null; // Block javascript:, data:, vbscript: etc.
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }
}

// Apply on input (API layer)
app.post("/api/comments", authMiddleware, async (req, res) => {
  const { body, url } = req.body;

  // Sanitize rich text content
  const sanitizedBody = XSSProtection.sanitizeHTML(body);

  // Validate URL
  const sanitizedUrl = url ? XSSProtection.sanitizeURL(url) : null;
  if (url && !sanitizedUrl) {
    return res.status(400).json({ error: "invalid_url" });
  }

  const comment = await createComment({
    body: sanitizedBody,
    url: sanitizedUrl,
    userId: req.user.id,
  });

  res.status(201).json(comment);
});
```

### Go — XSS Prevention

```go
import (
    "html"
    "html/template"
    "net/url"
    "github.com/microcosm-cc/bluemonday"
)

var sanitizer = bluemonday.UGCPolicy() // User-Generated Content policy

func SanitizeHTML(input string) string {
    return sanitizer.Sanitize(input)
}

func EscapeHTML(input string) string {
    return html.EscapeString(input)
}

func ValidateURL(rawURL string) (string, error) {
    parsed, err := url.Parse(rawURL)
    if err != nil {
        return "", fmt.Errorf("invalid URL: %w", err)
    }
    if parsed.Scheme != "http" && parsed.Scheme != "https" {
        return "", fmt.Errorf("disallowed scheme: %s", parsed.Scheme)
    }
    return parsed.String(), nil
}

func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Body string `json:"body"`
        URL  string `json:"url,omitempty"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, "invalid body", http.StatusBadRequest)
        return
    }

    // Sanitize rich HTML content
    sanitizedBody := SanitizeHTML(input.Body)

    // Validate URL
    var sanitizedURL string
    if input.URL != "" {
        var err error
        sanitizedURL, err = ValidateURL(input.URL)
        if err != nil {
            http.Error(w, "invalid URL", http.StatusBadRequest)
            return
        }
    }

    comment, err := h.repo.Create(r.Context(), sanitizedBody, sanitizedURL, auth.GetUserID(r.Context()))
    if err != nil {
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(comment)
}
```

### Python — XSS Prevention

```python
import bleach
from urllib.parse import urlparse
from markupsafe import escape as html_escape

ALLOWED_TAGS = ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "code", "pre"]
ALLOWED_ATTRS = {"a": ["href", "target", "rel"]}

def sanitize_html(content: str) -> str:
    """Sanitize rich HTML content — allow only safe tags and attributes."""
    return bleach.clean(
        content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        strip=True,
    )

def encode_html(text: str) -> str:
    """Escape ALL HTML characters — for plain text fields."""
    return str(html_escape(text))

def validate_url(url: str) -> str | None:
    """Validate URL scheme — block javascript:, data: etc."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https", "mailto"):
            return None
        return url
    except Exception:
        return None

@router.post("/api/comments")
async def create_comment(
    body: CommentInput,
    user: User = Depends(require_auth),
):
    sanitized_body = sanitize_html(body.content)
    sanitized_url = validate_url(body.url) if body.url else None

    if body.url and not sanitized_url:
        raise HTTPException(400, "Invalid URL")

    comment = await comment_service.create(
        body=sanitized_body,
        url=sanitized_url,
        user_id=user.id,
    )
    return comment
```

---

## 6. Content Security Policy (CSP) — Deep Dive

```typescript
// CSP with nonces for inline scripts (strictest mode)
app.use((req, res, next) => {
  // Generate unique nonce per request
  const nonce = randomBytes(16).toString("base64");
  res.locals.cspNonce = nonce;

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,  // Nonce-based
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: https://cdn.example.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self' https://api.example.com wss://ws.example.com`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
    `report-uri /api/csp-report`,              // Where to send violations
    `report-to csp-endpoint`,
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);

  // Report-To header for CSP reporting API
  res.setHeader("Report-To", JSON.stringify({
    group: "csp-endpoint",
    max_age: 86400,
    endpoints: [{ url: "/api/csp-report" }],
  }));

  next();
});

// CSP violation report endpoint
app.post("/api/csp-report", express.json({ type: "application/csp-report" }), (req, res) => {
  const report = req.body["csp-report"];
  logger.warn("CSP violation", {
    blocked_uri: report["blocked-uri"],
    violated_directive: report["violated-directive"],
    document_uri: report["document-uri"],
    source_file: report["source-file"],
    line_number: report["line-number"],
  });
  res.status(204).send();
});
```

### CSP Directive Reference

| Directive | Purpose | Recommended Value |
|-----------|---------|-------------------|
| `default-src` | Fallback for all resource types | `'self'` |
| `script-src` | JavaScript sources | `'self' 'nonce-...'` (no `'unsafe-inline'`) |
| `style-src` | CSS sources | `'self' 'nonce-...'` or `'unsafe-inline'` |
| `img-src` | Image sources | `'self' data: https://cdn.example.com` |
| `connect-src` | XHR, fetch, WebSocket | `'self' https://api.example.com` |
| `font-src` | Web font sources | `'self' https://fonts.gstatic.com` |
| `frame-src` | iframe sources | `'none'` (unless embedding is needed) |
| `object-src` | Flash, applets | `'none'` (always) |
| `base-uri` | `<base>` tag restriction | `'self'` |
| `form-action` | Form submission targets | `'self'` |
| `frame-ancestors` | Who can embed this page | `'none'` (API-only) |
| `upgrade-insecure-requests` | HTTP → HTTPS upgrade | Include always |
| `report-uri` | Violation report endpoint | `/api/csp-report` |

---

## 7. Cookie Security Configuration

```typescript
// Complete secure cookie configuration
interface SecureCookieOptions {
  httpOnly: boolean;     // Cannot be read by JavaScript (XSS protection)
  secure: boolean;       // Only sent over HTTPS
  sameSite: "strict" | "lax" | "none";
  domain: string;        // Restrict to specific domain
  path: string;          // Restrict to specific path
  maxAge: number;        // Expiration in milliseconds
}

// Session cookie (most secure)
const SESSION_COOKIE: SecureCookieOptions = {
  httpOnly: true,          // ALWAYS true for session cookies
  secure: true,            // ALWAYS true in production
  sameSite: "lax",         // Blocks cross-site POST (CSRF defense)
  domain: ".example.com",  // Shared across subdomains
  path: "/",
  maxAge: 86400000,        // 24 hours
};

// CSRF cookie (readable by JS)
const CSRF_COOKIE: SecureCookieOptions = {
  httpOnly: false,         // JS must read this to send in header
  secure: true,
  sameSite: "lax",
  domain: ".example.com",
  path: "/",
  maxAge: 86400000,
};

// Refresh token cookie
const REFRESH_COOKIE: SecureCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",      // Never sent cross-site (strictest)
  domain: ".example.com",
  path: "/api/auth",       // Only sent to auth endpoints
  maxAge: 604800000,       // 7 days
};
```

### SameSite Cookie Comparison

| SameSite Value | Cross-site GET | Cross-site POST | Use Case |
|---------------|---------------|----------------|----------|
| `Strict` | Blocked | Blocked | Refresh tokens, sensitive cookies |
| `Lax` (default) | Sent (navigation only) | Blocked | Session cookies (recommended) |
| `None` | Sent | Sent | Third-party cookies (requires Secure) |

---

## 8. Clickjacking Prevention

```typescript
// Clickjacking: attacker embeds your page in an invisible iframe
// and tricks user into clicking buttons on your page

// Defense 1: X-Frame-Options (legacy, still widely supported)
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");       // Never allow framing
  // Or: "SAMEORIGIN" — only allow same-origin framing
  next();
});

// Defense 2: CSP frame-ancestors (modern, more flexible)
// Already set via CSP: frame-ancestors 'none'

// Defense 3: Frame-busting JavaScript (last resort)
// Handled by CSP frame-ancestors in modern browsers
```

---

## 9. Subresource Integrity (SRI)

```html
<!-- When loading scripts/styles from CDN, use SRI to verify integrity -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8w"
  crossorigin="anonymous"
></script>
```

```typescript
// Generate SRI hash for a file
import { createHash } from "crypto";
import { readFileSync } from "fs";

function generateSRI(filePath: string): string {
  const content = readFileSync(filePath);
  const hash = createHash("sha384").update(content).digest("base64");
  return `sha384-${hash}`;
}
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `Access-Control-Allow-Origin: *` in production | Any site can make authenticated requests | Explicit origin allowlist |
| Reflecting Origin header without validation | CORS bypass, credential theft | Check against allowlist, don't mirror |
| No CSRF protection with session cookies | Cross-site form submission succeeds | Double-submit cookie + SameSite=Lax |
| CSRF tokens for JWT/Bearer auth | Unnecessary complexity | Bearer tokens don't need CSRF (not auto-sent) |
| `innerHTML` with user data (client-side) | DOM-based XSS | Use `textContent`, DOMPurify, or framework escaping |
| No CSP header | No defense against injected scripts | Strict CSP with nonces, no `unsafe-inline` |
| `unsafe-inline` in script-src CSP | CSP doesn't block inline XSS | Use nonces or hashes for inline scripts |
| No `HttpOnly` on session cookies | XSS can steal session tokens | `HttpOnly: true` on all auth cookies |
| No `Secure` flag on cookies | Cookies sent over HTTP (MITM) | `Secure: true` on all cookies |
| Missing security headers entirely | Multiple attack vectors open | Use Helmet (Node) or equivalent middleware |
| SameSite=None without Secure flag | Cookie rejected by browser | SameSite=None requires Secure=true |
| CSP report-uri pointing to third party | Violation data leaks to external service | Host CSP report endpoint on your own domain |

---

## 11. Enforcement Checklist

- [ ] Security headers middleware applied to ALL responses (Helmet or equivalent)
- [ ] Strict-Transport-Security with max-age=31536000, includeSubDomains, preload
- [ ] Content-Security-Policy configured with no `unsafe-inline` for scripts
- [ ] CSP violation reporting configured and monitored
- [ ] CORS configured with explicit origin allowlist (no wildcard)
- [ ] CORS credentials=true only with explicit origins
- [ ] CSRF protection for cookie-based authentication (double-submit or synchronizer)
- [ ] SameSite=Lax on session cookies (minimum)
- [ ] HttpOnly=true on all authentication cookies
- [ ] Secure=true on all cookies in production
- [ ] XSS: Output encoding for all user-provided content
- [ ] XSS: HTML sanitization (DOMPurify/bluemonday/bleach) for rich text fields
- [ ] XSS: URL validation blocks javascript: and data: protocols
- [ ] X-Content-Type-Options: nosniff on all responses
- [ ] Referrer-Policy configured (strict-origin-when-cross-origin)
- [ ] Permissions-Policy disables unused browser features
- [ ] Frame-ancestors 'none' or appropriate CSP for clickjacking prevention
