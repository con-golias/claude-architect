# Content Security Policy & Security Headers — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to set up CSP?", "Content-Security-Policy headers", "security headers for frontend", "CORS configuration", "HSTS setup", "X-Frame-Options", "Permissions-Policy", "Subresource Integrity", "nonce-based CSP", "CSP with Next.js", or any security headers question, ALWAYS consult this directive. Security headers are the HTTP-level defense layer that protects against XSS, clickjacking, MIME confusion, and data exfiltration. CSP is the most important security header — it controls which resources the browser is allowed to load. ALWAYS deploy CSP in report-only mode first, then enforce. NEVER use `unsafe-inline` for script-src — it defeats the purpose of CSP.

**Core Rule: EVERY production frontend MUST deploy Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers. Start with a strict CSP (`default-src 'self'`) and add exceptions only as needed. Use nonces for inline scripts — NEVER `'unsafe-inline'` for `script-src`. Deploy in `Content-Security-Policy-Report-Only` first to catch violations before enforcing. CORS MUST be configured on the server to allow ONLY specific origins — NEVER use `Access-Control-Allow-Origin: *` for authenticated APIs.**

---

## 1. Security Headers Overview

```
  SECURITY HEADERS — DEFENSE LAYERS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  REQUEST: Browser → Server                           │
  │                                                      │
  │  RESPONSE HEADERS (Server → Browser):                │
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Content-Security-Policy                      │  │
  │  │  ► Controls which resources can be loaded     │  │
  │  │  ► Prevents XSS, data injection, clickjacking │  │
  │  │  ► MOST IMPORTANT security header             │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Strict-Transport-Security (HSTS)             │  │
  │  │  ► Forces HTTPS for all future requests       │  │
  │  │  ► Prevents protocol downgrade attacks        │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  X-Content-Type-Options: nosniff              │  │
  │  │  ► Prevents MIME-type sniffing                │  │
  │  │  ► Blocks script execution from non-JS files  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  X-Frame-Options: DENY                        │  │
  │  │  ► Prevents clickjacking (page in iframe)     │  │
  │  │  ► Superseded by CSP frame-ancestors          │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Referrer-Policy: strict-origin-when-cross     │  │
  │  │  ► Controls how much URL info is shared       │  │
  │  │  ► Prevents sensitive URL paths leaking       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Permissions-Policy                           │  │
  │  │  ► Controls browser features (camera, mic)    │  │
  │  │  ► Prevents third-party abuse of APIs         │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Content Security Policy (CSP) — Deep Dive

### 2.1 CSP Directives

| Directive | Controls | Example |
|---|---|---|
| `default-src` | Fallback for all resource types | `'self'` |
| `script-src` | JavaScript sources | `'self' 'nonce-abc123'` |
| `style-src` | CSS sources | `'self' 'unsafe-inline'` |
| `img-src` | Image sources | `'self' data: https:` |
| `font-src` | Font sources | `'self' https://fonts.gstatic.com` |
| `connect-src` | Fetch, XHR, WebSocket targets | `'self' https://api.example.com` |
| `media-src` | Audio and video sources | `'self'` |
| `frame-src` | iframe sources | `'none'` |
| `frame-ancestors` | Who can embed this page | `'none'` (replaces X-Frame-Options) |
| `object-src` | Plugin resources (Flash, Java) | `'none'` (ALWAYS) |
| `base-uri` | Allowed `<base>` URLs | `'self'` |
| `form-action` | Form submission targets | `'self'` |
| `worker-src` | Web Worker, Service Worker sources | `'self'` |
| `report-uri` | Where to send violation reports | `/api/csp-report` |
| `report-to` | Reporting API endpoint (newer) | `csp-endpoint` |

### 2.2 CSP Source Values

| Value | Meaning |
|---|---|
| `'self'` | Same origin only |
| `'none'` | Block everything |
| `'unsafe-inline'` | Allow inline scripts/styles (AVOID for script-src) |
| `'unsafe-eval'` | Allow eval(), new Function() (AVOID) |
| `'nonce-{random}'` | Allow specific inline script with matching nonce |
| `'sha256-{hash}'` | Allow inline script with matching hash |
| `'strict-dynamic'` | Trust scripts loaded by already-trusted scripts |
| `https:` | Any HTTPS URL |
| `data:` | Data URIs (for inline images) |
| `blob:` | Blob URLs |
| `*.example.com` | All subdomains of example.com |

### 2.3 Recommended Strict CSP

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{SERVER_GENERATED_NONCE}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.example.com wss://ws.example.com;
  frame-src 'none';
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

### 2.4 Nonce-Based CSP

```
  NONCE-BASED CSP — HOW IT WORKS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  SERVER generates random nonce per request:          │
  │  nonce = crypto.randomBytes(16).toString('base64')   │
  │                                                      │
  │  CSP HEADER includes nonce:                          │
  │  script-src 'nonce-abc123def456'                     │
  │                                                      │
  │  HTML includes nonce on trusted scripts:             │
  │  <script nonce="abc123def456">                       │
  │    // This executes ✅                               │
  │  </script>                                           │
  │                                                      │
  │  Injected script WITHOUT nonce:                      │
  │  <script>alert('xss')</script>                       │
  │  → Blocked by CSP ❌                                 │
  │                                                      │
  │  NONCE MUST be:                                      │
  │  • Cryptographically random (not predictable)        │
  │  • Different on EVERY request (no reuse)             │
  │  • Base64 encoded, at least 128 bits                 │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Next.js — nonce-based CSP
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src 'self' https://api.example.com`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);

  // Pass nonce to page via header (read in layout.tsx)
  response.headers.set('x-nonce', nonce);

  return response;
}
```

```tsx
// app/layout.tsx — use nonce on Script tags
import { headers } from 'next/headers';
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = headers().get('x-nonce') ?? '';

  return (
    <html>
      <head>
        {/* Analytics script with nonce */}
        <Script
          nonce={nonce}
          src="https://analytics.example.com/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## 3. Framework-Specific CSP Setup

### 3.1 Next.js Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self'",                         // nonce added via middleware
      "style-src 'self' 'unsafe-inline'",          // needed for styled-jsx/CSS-in-JS
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};
```

### 3.2 SvelteKit Security Headers

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; '));

  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
};
```

### 3.3 Express Security Headers (Helmet)

```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", 'https://api.example.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
```

---

## 4. CSP Reporting and Monitoring

### 4.1 Report-Only Mode

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self';
  report-uri /api/csp-report;
```

```typescript
// API endpoint to collect CSP violation reports
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'];

  console.warn('CSP Violation:', {
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    originalPolicy: report['original-policy'],
    documentUri: report['document-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
  });

  // Send to monitoring (Sentry, Datadog, etc.)
  captureCSPViolation(report);

  res.status(204).end();
});
```

### 4.2 CSP Deployment Strategy

```
  CSP ROLLOUT — 4 PHASES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PHASE 1: Report-Only (2 weeks)                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Content-Security-Policy-Report-Only: ...      │  │
  │  │  → Collect violations without breaking site    │  │
  │  │  → Identify third-party scripts, inline code   │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  PHASE 2: Fix Violations (1-4 weeks)                 │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  → Move inline scripts to external files       │  │
  │  │  → Add nonces for necessary inline scripts     │  │
  │  │  → Whitelist required third-party domains      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  PHASE 3: Enforce (soft)                             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Content-Security-Policy: ... (enforcing)      │  │
  │  │  Keep report-uri active                        │  │
  │  │  → Monitor for unexpected violations           │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  PHASE 4: Tighten                                    │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  → Remove unnecessary exceptions               │  │
  │  │  → Add stricter directives                     │  │
  │  │  → Enable nonce-based script loading           │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 5. CORS — Cross-Origin Resource Sharing

```
  CORS FLOW — PREFLIGHT REQUEST

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Browser (https://app.example.com)                   │
  │  wants to fetch from https://api.example.com         │
  │                                                      │
  │  SIMPLE REQUEST (GET, HEAD, POST with simple headers)│
  │  ─────────────────────────────────────────────────── │
  │  Browser adds: Origin: https://app.example.com       │
  │  Server responds: Access-Control-Allow-Origin: ...    │
  │  → Browser allows/blocks based on header             │
  │                                                      │
  │  PREFLIGHT REQUEST (PUT, DELETE, custom headers)      │
  │  ─────────────────────────────────────────────────── │
  │  1. Browser sends OPTIONS preflight:                 │
  │     Origin: https://app.example.com                  │
  │     Access-Control-Request-Method: DELETE             │
  │     Access-Control-Request-Headers: Authorization     │
  │                                                      │
  │  2. Server responds:                                 │
  │     Access-Control-Allow-Origin: https://app.example.com
  │     Access-Control-Allow-Methods: GET, POST, DELETE  │
  │     Access-Control-Allow-Headers: Authorization      │
  │     Access-Control-Max-Age: 86400                    │
  │                                                      │
  │  3. If allowed → Browser sends actual request        │
  │     If denied → Browser blocks request               │
  └──────────────────────────────────────────────────────┘
```

### 5.1 Secure CORS Configuration

```typescript
import cors from 'cors';

// SECURE: Specific origins
app.use(cors({
  origin: [
    'https://app.example.com',
    'https://staging.example.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,                                // allow cookies
  maxAge: 86400,                                    // cache preflight for 24h
}));

// DANGEROUS: Allow all origins
app.use(cors({ origin: '*' }));                     // NEVER with credentials!

// Dynamic origin (validate against whitelist)
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://app.example.com',
      'https://staging.example.com',
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

---

## 6. Subresource Integrity (SRI)

```html
<!-- SRI ensures CDN-loaded scripts haven't been tampered with -->

<!-- WITHOUT SRI: CDN compromise serves malicious code -->
<script src="https://cdn.example.com/lib.js"></script>

<!-- WITH SRI: Browser verifies hash before executing -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8w"
  crossorigin="anonymous"
></script>
<!-- If hash doesn't match → script is NOT executed -->
```

```bash
# Generate SRI hash
echo -n "/* script content */" | openssl dgst -sha384 -binary | openssl base64 -A

# Or use srihash.org
```

```typescript
// Generate SRI hashes in build pipeline
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function generateSRI(filePath: string): string {
  const content = readFileSync(filePath);
  const hash = createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}
```

---

## 7. Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

| Parameter | Meaning | Recommended |
|---|---|---|
| `max-age` | Browser remembers HTTPS for N seconds | `63072000` (2 years) |
| `includeSubDomains` | Apply to all subdomains | Always include |
| `preload` | Submit to browser HSTS preload list | Yes for production |

```
  HSTS PROTECTS AGAINST:

  WITHOUT HSTS:
  1. User types example.com (no https://)
  2. Browser sends HTTP request
  3. Attacker on public WiFi intercepts HTTP
  4. Attacker downgrades to HTTP permanently
  → All traffic intercepted (SSL stripping)

  WITH HSTS:
  1. User types example.com
  2. Browser ALREADY KNOWS to use HTTPS (cached from previous header)
  3. Browser sends HTTPS directly
  → Attacker cannot intercept
```

---

## 8. Permissions-Policy

```
Permissions-Policy:
  camera=(),
  microphone=(),
  geolocation=(self),
  payment=(self),
  usb=(),
  interest-cohort=()
```

| Feature | `()` | `(self)` | `(*)` |
|---|---|---|---|
| `camera` | Block all | Allow same-origin only | Allow all (AVOID) |
| `microphone` | Block all | Allow same-origin only | Allow all (AVOID) |
| `geolocation` | Block all | Allow same-origin only | — |
| `payment` | Block all | Allow same-origin only | — |
| `interest-cohort` | Opt out of FLoC | — | — |

---

## 9. Security Headers Testing

```bash
# Test with securityheaders.com
# https://securityheaders.com/?q=https://example.com

# Test with curl
curl -I https://example.com

# Expected headers in response:
# content-security-policy: default-src 'self'; ...
# strict-transport-security: max-age=63072000; includeSubDomains; preload
# x-content-type-options: nosniff
# x-frame-options: DENY
# referrer-policy: strict-origin-when-cross-origin
# permissions-policy: camera=(), microphone=(), ...
```

```typescript
// Automated test for security headers
import { test, expect } from '@playwright/test';

test('security headers are set', async ({ request }) => {
  const response = await request.get('/');
  const headers = response.headers();

  expect(headers['content-security-policy']).toBeDefined();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['content-security-policy']).not.toContain("'unsafe-eval'");

  expect(headers['strict-transport-security']).toContain('max-age=');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
});
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No CSP at all** | Any XSS payload executes freely — no browser-level defense | Deploy CSP with `default-src 'self'` at minimum |
| **`'unsafe-inline'` in script-src** | CSP allows inline `<script>` — defeats XSS protection | Use nonces (`'nonce-{random}'`) for inline scripts |
| **`'unsafe-eval'` in script-src** | CSP allows `eval()` — attacker can execute arbitrary code | Refactor code to avoid eval; use `'strict-dynamic'` |
| **`Access-Control-Allow-Origin: *` with credentials** | Browsers block this combination, OR you have a CORS misconfiguration | Specify exact allowed origins when credentials: true |
| **No HSTS** | First request over HTTP is vulnerable to SSL stripping | Deploy HSTS with `max-age=63072000; includeSubDomains; preload` |
| **CSP too permissive** | `script-src *` or `default-src *` — allows loading scripts from anywhere | Whitelist specific domains only |
| **No report-uri** | CSP violations happen silently — you never know about issues | Set up CSP reporting endpoint and monitoring |
| **No SRI on CDN resources** | CDN compromise serves malicious scripts to all users | Add `integrity` attribute to external `<script>` and `<link>` tags |
| **Missing X-Content-Type-Options** | Browser guesses MIME types — can execute uploaded files as scripts | Set `X-Content-Type-Options: nosniff` on all responses |
| **Skipping report-only phase** | CSP deployed directly in enforce mode — breaks site features | Always start with `Content-Security-Policy-Report-Only` |

---

## 11. Enforcement Checklist

### Content Security Policy
- [ ] CSP deployed with `default-src 'self'`
- [ ] `script-src` uses nonces (NOT `'unsafe-inline'`)
- [ ] `object-src 'none'` set (blocks Flash/Java plugins)
- [ ] `frame-ancestors 'none'` set (prevents clickjacking)
- [ ] `base-uri 'self'` set (prevents base tag injection)
- [ ] CSP report endpoint configured and monitored
- [ ] CSP tested with `Content-Security-Policy-Report-Only` before enforcement

### Transport Security
- [ ] HSTS header deployed (`max-age=63072000; includeSubDomains; preload`)
- [ ] Site submitted to HSTS preload list (hstspreload.org)
- [ ] All HTTP requests redirect to HTTPS (301)

### Other Security Headers
- [ ] `X-Content-Type-Options: nosniff` on all responses
- [ ] `X-Frame-Options: DENY` (or `SAMEORIGIN` if iframes needed)
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` restricts unnecessary browser APIs

### CORS
- [ ] Allowed origins explicitly listed (not `*` for authenticated APIs)
- [ ] `credentials: true` only with specific origin (not wildcard)
- [ ] Preflight cache (`Access-Control-Max-Age`) set for performance
- [ ] Allowed methods and headers explicitly specified

### Subresource Integrity
- [ ] SRI hashes on all CDN-loaded `<script>` tags
- [ ] SRI hashes on all CDN-loaded `<link rel="stylesheet">` tags
- [ ] `crossorigin="anonymous"` set on SRI-protected resources
