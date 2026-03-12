# HTTP Security Headers Comprehensive Guide

## Overview

HTTP security headers instruct the browser to enable built-in defense mechanisms that protect
users from a wide range of attacks including XSS, clickjacking, MIME sniffing, protocol downgrade,
and data leakage. Configure every production web server and application framework to send the
correct set of security headers on every response. Treat missing security headers as a vulnerability.

---

## Table of Contents

1. [Strict-Transport-Security (HSTS)](#strict-transport-security-hsts)
2. [X-Content-Type-Options](#x-content-type-options)
3. [X-Frame-Options](#x-frame-options)
4. [Referrer-Policy](#referrer-policy)
5. [Permissions-Policy](#permissions-policy)
6. [Cross-Origin-Opener-Policy (COOP)](#cross-origin-opener-policy-coop)
7. [Cross-Origin-Embedder-Policy (COEP)](#cross-origin-embedder-policy-coep)
8. [Cross-Origin-Resource-Policy (CORP)](#cross-origin-resource-policy-corp)
9. [X-XSS-Protection](#x-xss-protection)
10. [Cache-Control for Sensitive Pages](#cache-control-for-sensitive-pages)
11. [Clear-Site-Data](#clear-site-data)
12. [Feature-Policy (Deprecated)](#feature-policy-deprecated)
13. [Implementation Examples](#implementation-examples)
14. [Security Header Scoring Tools](#security-header-scoring-tools)
15. [Best Practices](#best-practices)
16. [Anti-Patterns](#anti-patterns)
17. [Enforcement Checklist](#enforcement-checklist)

---

## Strict-Transport-Security (HSTS)

HSTS instructs the browser to only communicate with the server over HTTPS for the specified
duration. Once a browser receives the HSTS header, it automatically upgrades all HTTP requests
to HTTPS and refuses to connect if the TLS certificate is invalid.

### Syntax

```
Strict-Transport-Security: max-age=<seconds>; includeSubDomains; preload
```

### Directives

| Directive          | Purpose                                                       |
|--------------------|---------------------------------------------------------------|
| `max-age`          | Duration (seconds) the browser remembers HTTPS-only policy    |
| `includeSubDomains`| Apply the policy to all subdomains                            |
| `preload`          | Signal intent to be included in browser preload lists         |

### Recommended Configuration

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

- `max-age=63072000` equals 2 years, the minimum for HSTS preload submission.
- `includeSubDomains` is mandatory for preload submission and prevents subdomain attacks.
- `preload` indicates the site should be hardcoded in browser preload lists.

### Deployment Strategy

1. Start with a short max-age (e.g., 300 seconds / 5 minutes) to test.
2. Verify all subdomains support HTTPS. Any subdomain without HTTPS becomes unreachable.
3. Gradually increase max-age: 300 -> 86400 -> 604800 -> 2592000 -> 63072000.
4. Add `includeSubDomains` only when all subdomains are confirmed HTTPS-ready.
5. Add `preload` and submit to hstspreload.org.

### HSTS Preloading

Submit your domain at https://hstspreload.org. Requirements:

- Valid HTTPS certificate on the root domain.
- Redirect HTTP to HTTPS on the root domain.
- HSTS header on the root domain with `max-age >= 63072000`, `includeSubDomains`, and `preload`.
- All subdomains must serve HTTPS.

Removing a domain from the preload list takes months. Verify readiness thoroughly.

### Risks

- If HTTPS breaks (expired cert, misconfiguration), the site becomes completely inaccessible
  until HTTPS is restored or the HSTS entry expires.
- `includeSubDomains` can break internal subdomains that use HTTP.
- Preload removal is slow; treat preloading as a permanent commitment.

---

## X-Content-Type-Options

Prevent the browser from MIME-sniffing a response away from the declared Content-Type. Without
this header, a browser may interpret a file as a different type than intended, enabling attacks
where an attacker uploads a file with a disguised content type.

### Syntax

```
X-Content-Type-Options: nosniff
```

### Behavior

- For `<script>` requests: if the MIME type is not a JavaScript MIME type, the browser blocks
  execution.
- For `<style>` requests: if the MIME type is not `text/css`, the browser blocks loading.
- For other resources: the browser uses the declared Content-Type rather than guessing.

### Recommendation

Set `X-Content-Type-Options: nosniff` on ALL responses. There is no valid reason to omit it.
Always pair it with correct `Content-Type` headers on every response.

---

## X-Frame-Options

Control whether the browser allows the page to be embedded in an `<iframe>`, `<frame>`,
`<embed>`, or `<object>`.

### Syntax

```
X-Frame-Options: DENY
X-Frame-Options: SAMEORIGIN
```

### Values

| Value        | Behavior                                                |
|--------------|---------------------------------------------------------|
| `DENY`       | Page cannot be displayed in any frame                   |
| `SAMEORIGIN` | Page can only be framed by same-origin pages            |

### Deprecation Notice

`X-Frame-Options` is superseded by the CSP `frame-ancestors` directive. The CSP directive
supports multiple origins and provides more granular control:

```
Content-Security-Policy: frame-ancestors 'self' https://trusted.example.com;
```

### Recommendation

Set both `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` for
maximum compatibility. Browsers that support CSP use `frame-ancestors`; older browsers fall back
to `X-Frame-Options`.

---

## Referrer-Policy

Control how much referrer information the browser includes when navigating away from the page or
loading sub-resources.

### Syntax

```
Referrer-Policy: <policy-value>
```

### Policy Values

| Value                            | Behavior                                              |
|----------------------------------|-------------------------------------------------------|
| `no-referrer`                    | Never send referrer                                   |
| `no-referrer-when-downgrade`     | Send full URL for HTTPS->HTTPS, none for HTTPS->HTTP  |
| `origin`                         | Send only the origin (scheme + host + port)            |
| `origin-when-cross-origin`       | Full URL for same-origin, origin only for cross-origin |
| `same-origin`                    | Send referrer for same-origin only, none for cross-origin |
| `strict-origin`                  | Send origin for same security level, none on downgrade |
| `strict-origin-when-cross-origin`| Full URL same-origin, origin cross-origin, none on downgrade |
| `unsafe-url`                     | Always send the full URL (DANGEROUS)                   |

### Recommended Configuration

```
Referrer-Policy: strict-origin-when-cross-origin
```

This provides useful referrer data for same-origin navigation while limiting information leakage
to cross-origin destinations and preventing all referrer data on protocol downgrade.

For highly sensitive applications (healthcare, finance):

```
Referrer-Policy: no-referrer
```

### Risks of Incorrect Configuration

- `unsafe-url` leaks full URLs (including query parameters with tokens, session IDs) to third
  parties.
- Missing Referrer-Policy defaults to the browser's built-in default, which varies across browsers
  and versions.

---

## Permissions-Policy

Permissions-Policy (formerly Feature-Policy) controls which browser features and APIs the page
and its embedded iframes may use.

### Syntax

```
Permissions-Policy: <feature>=<allowlist>, <feature>=<allowlist>
```

### Common Features

| Feature            | Controls                                         |
|--------------------|--------------------------------------------------|
| `camera`           | Access to camera devices                         |
| `microphone`       | Access to microphone devices                     |
| `geolocation`      | Access to user's location                        |
| `payment`          | Payment Request API                              |
| `usb`              | WebUSB API                                       |
| `bluetooth`        | Web Bluetooth API                                |
| `accelerometer`    | Accelerometer sensor                             |
| `gyroscope`        | Gyroscope sensor                                 |
| `magnetometer`     | Magnetometer sensor                              |
| `fullscreen`       | Fullscreen API                                   |
| `autoplay`         | Media autoplay                                   |
| `display-capture`  | Screen capture API                               |
| `document-domain`  | document.domain setter                           |
| `encrypted-media`  | Encrypted Media Extensions                       |
| `picture-in-picture`| Picture-in-Picture API                          |
| `interest-cohort`  | FLoC (deprecated, replaced by Topics)            |

### Allowlist Values

| Value        | Meaning                                              |
|--------------|------------------------------------------------------|
| `*`          | Allow for all origins                                |
| `()`         | Disable for all origins                              |
| `self`       | Allow only for the top-level document's origin       |
| `"<origin>"` | Allow for the specified origin (must be quoted)      |

### Recommended Configuration

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), document-domain=()
```

Disable every feature the application does not use. Enable features only for specific origins that
require them:

```
Permissions-Policy: camera=(self "https://video.example.com"), geolocation=(self)
```

---

## Cross-Origin-Opener-Policy (COOP)

COOP controls whether the document shares a browsing context group with cross-origin documents
opened via `window.open()` or that open it.

### Values

| Value                          | Behavior                                          |
|--------------------------------|---------------------------------------------------|
| `unsafe-none`                  | Default; no isolation                             |
| `same-origin`                  | Isolate from cross-origin openers/openees         |
| `same-origin-allow-popups`     | Same-origin, but allow popups to retain access    |

### Recommended Configuration

```
Cross-Origin-Opener-Policy: same-origin
```

### Why COOP Matters

- Prevents cross-origin documents from accessing `window.opener`, mitigating Spectre-style
  side-channel attacks.
- Required (along with COEP) to enable `SharedArrayBuffer` and high-resolution timers.
- Breaks legitimate popup flows if the popup is cross-origin and needs `window.opener` access.
  Use `same-origin-allow-popups` for OAuth flows or payment redirects.

---

## Cross-Origin-Embedder-Policy (COEP)

COEP requires all sub-resources loaded by the page to explicitly opt in to being loaded
cross-origin (via CORS or CORP headers).

### Values

| Value            | Behavior                                                  |
|------------------|-----------------------------------------------------------|
| `unsafe-none`    | Default; no restrictions                                  |
| `require-corp`   | All cross-origin resources must have CORP or CORS headers |
| `credentialless`  | Cross-origin requests omit credentials unless CORS allows |

### Recommended Configuration

```
Cross-Origin-Embedder-Policy: require-corp
```

### Cross-Origin Isolation

When both `COOP: same-origin` and `COEP: require-corp` are set:

- `self.crossOriginIsolated` returns `true`.
- `SharedArrayBuffer` becomes available.
- `performance.measureUserAgentSpecificMemory()` becomes available.
- High-resolution timers (`performance.now()`) become available with full precision.

### Deployment Consideration

- Audit every cross-origin resource (images, scripts, fonts, iframes).
- Each cross-origin resource must respond with `Cross-Origin-Resource-Policy: cross-origin` or
  be loaded with CORS.
- Use `credentialless` as a less restrictive alternative when `require-corp` breaks third-party
  resources.

---

## Cross-Origin-Resource-Policy (CORP)

CORP tells the browser which origins are allowed to load the resource. It protects against
Spectre-style side-channel attacks and cross-origin data leaks.

### Values

| Value          | Behavior                                                |
|----------------|---------------------------------------------------------|
| `same-site`    | Only pages from the same site may load this resource    |
| `same-origin`  | Only pages from the same origin may load this resource  |
| `cross-origin` | Any origin may load this resource                       |

### Recommended Configuration

For internal APIs and sensitive resources:

```
Cross-Origin-Resource-Policy: same-origin
```

For public CDN resources that need to be embeddable:

```
Cross-Origin-Resource-Policy: cross-origin
```

### When to Use

- Set `same-origin` on API responses, authenticated resources, and private data.
- Set `cross-origin` on public assets (fonts, images, scripts) served from a CDN.
- Set `same-site` for resources that should be accessible within the same registrable domain
  but not by unrelated origins.

---

## X-XSS-Protection

This header was designed to enable the browser's built-in XSS filter. However, the XSS filter
itself has been found to create security vulnerabilities (information leakage, selective script
blocking that attackers can weaponize).

### Current Recommendation

```
X-XSS-Protection: 0
```

Set this header to `0` to explicitly disable the XSS filter. Modern browsers (Chromium 78+, Edge,
Firefox) have removed the XSS Auditor entirely. Rely on CSP for XSS protection instead.

### Why Not Mode=Block

`X-XSS-Protection: 1; mode=block` was previously recommended but can be exploited:

- Attackers can selectively trigger the filter to block legitimate scripts, altering page behavior.
- The filter can leak sensitive data through timing attacks.
- CSP provides superior protection without these side effects.

---

## Cache-Control for Sensitive Pages

Prevent browsers and proxies from caching sensitive responses. Improper caching can expose
authenticated content to unauthorized users (shared computers, proxy servers).

### Recommended Headers for Sensitive Responses

```
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
```

### Directive Meanings

| Directive         | Purpose                                               |
|-------------------|-------------------------------------------------------|
| `no-store`        | Do not store the response in any cache                |
| `no-cache`        | Revalidate with the server before using cached copy   |
| `must-revalidate` | After expiration, must revalidate before reuse        |
| `private`         | Only the end user's browser may cache (no proxies)    |
| `max-age=0`       | Response is immediately stale                         |

### When to Apply

- Login/logout pages.
- Account settings and profile pages.
- Payment and financial transaction pages.
- API responses containing PII or authentication tokens.
- Password reset pages.
- Admin dashboards.

### Static Assets

For static assets (CSS, JS, images), use aggressive caching with versioned filenames:

```
Cache-Control: public, max-age=31536000, immutable
```

---

## Clear-Site-Data

Instruct the browser to clear stored data associated with the requesting origin. Use on logout
endpoints to ensure complete session cleanup.

### Syntax

```
Clear-Site-Data: "cache", "cookies", "storage"
```

### Directives

| Value         | Clears                                                     |
|---------------|------------------------------------------------------------|
| `"cache"`     | Browser cache for the origin                               |
| `"cookies"`   | All cookies for the origin                                 |
| `"storage"`   | localStorage, sessionStorage, IndexedDB, Service Workers   |
| `"executionContexts"` | Active documents and workers (experimental)         |
| `"*"`         | All of the above                                           |

### Logout Endpoint Example

```
HTTP/1.1 200 OK
Clear-Site-Data: "cache", "cookies", "storage"
```

### Considerations

- Only works over HTTPS.
- Clearing `"cookies"` logs the user out of all sessions on this origin.
- Clearing `"storage"` removes all client-side data, including offline-capable PWA data.
- Browser support varies; test in all target browsers.

---

## Feature-Policy (Deprecated)

Feature-Policy has been replaced by Permissions-Policy. The syntax differs:

```
# Feature-Policy (old)
Feature-Policy: camera 'none'; microphone 'none'

# Permissions-Policy (current)
Permissions-Policy: camera=(), microphone=()
```

For backward compatibility with older browsers, send both headers. For new deployments, use
Permissions-Policy exclusively.

---

## Implementation Examples

### Express.js with Helmet

```javascript
const express = require('express');
const helmet = require('helmet');
const app = express();

// Helmet sets many security headers by default
app.use(helmet());

// Fine-grained configuration
app.use(
  helmet({
    // HSTS
    hsts: {
      maxAge: 63072000,       // 2 years in seconds
      includeSubDomains: true,
      preload: true,
    },

    // X-Content-Type-Options: nosniff (enabled by default in helmet)
    noSniff: true,

    // X-Frame-Options
    frameguard: { action: 'deny' },

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // X-XSS-Protection: 0
    xXssProtection: false,

    // CSP (see content-security-policy.md for detailed config)
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },

    // Cross-Origin policies
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);

// Permissions-Policy (not included in helmet by default)
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()'
  );
  next();
});

// Cache-Control for sensitive routes
app.use('/api/account', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Clear-Site-Data on logout
app.post('/logout', (req, res) => {
  res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  res.status(200).json({ message: 'Logged out' });
});
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    # HSTS
    add_header Strict-Transport-Security
        "max-age=63072000; includeSubDomains; preload" always;

    # Prevent MIME sniffing
    add_header X-Content-Type-Options "nosniff" always;

    # Clickjacking protection
    add_header X-Frame-Options "DENY" always;

    # Referrer policy
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Permissions policy
    add_header Permissions-Policy
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()" always;

    # Cross-Origin policies
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    # Disable XSS Auditor
    add_header X-XSS-Protection "0" always;

    # CSP
    add_header Content-Security-Policy
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    # Sensitive pages - disable caching
    location /account {
        add_header Cache-Control "no-store, no-cache, must-revalidate, private" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        # Re-add other security headers (Nginx does not inherit add_header in nested blocks)
        add_header Strict-Transport-Security
            "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        # ... repeat all headers or use include directive
        proxy_pass http://backend;
    }

    # Static assets - aggressive caching
    location /static/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
}
```

**Important Nginx caveat:** `add_header` directives in a nested `location` block do NOT inherit
from the parent `server` block. Either repeat all headers in every location block or use
`include /etc/nginx/security-headers.conf;` to share a common file.

### Apache

```apache
<VirtualHost *:443>
    ServerName example.com

    # HSTS
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"

    # Prevent MIME sniffing
    Header always set X-Content-Type-Options "nosniff"

    # Clickjacking protection
    Header always set X-Frame-Options "DENY"

    # Referrer policy
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Permissions policy
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()"

    # Cross-Origin policies
    Header always set Cross-Origin-Opener-Policy "same-origin"
    Header always set Cross-Origin-Embedder-Policy "require-corp"
    Header always set Cross-Origin-Resource-Policy "same-origin"

    # Disable XSS Auditor
    Header always set X-XSS-Protection "0"

    # CSP
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

    # Sensitive pages
    <Location "/account">
        Header always set Cache-Control "no-store, no-cache, must-revalidate, private"
        Header always set Pragma "no-cache"
        Header always set Expires "0"
    </Location>
</VirtualHost>
```

### Caddy

```caddy
example.com {
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()"
        Cross-Origin-Opener-Policy "same-origin"
        Cross-Origin-Embedder-Policy "require-corp"
        Cross-Origin-Resource-Policy "same-origin"
        X-XSS-Protection "0"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    }

    handle /account/* {
        header {
            Cache-Control "no-store, no-cache, must-revalidate, private"
            Pragma "no-cache"
            Expires "0"
        }
        reverse_proxy localhost:8080
    }

    handle /logout {
        header {
            Clear-Site-Data "\"cache\", \"cookies\", \"storage\""
        }
        reverse_proxy localhost:8080
    }

    reverse_proxy localhost:8080
}
```

### Django

```python
# settings.py

# HSTS
SECURE_HSTS_SECONDS = 63072000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# X-Content-Type-Options
SECURE_CONTENT_TYPE_NOSNIFF = True

# X-Frame-Options
X_FRAME_OPTIONS = 'DENY'

# Referrer-Policy
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# Force HTTPS redirects
SECURE_SSL_REDIRECT = True

# CSRF cookie and session cookie security
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True

# Cross-Origin policies (custom middleware)
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'myapp.middleware.SecurityHeadersMiddleware',
    # ...
]
```

```python
# myapp/middleware.py
class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Permissions-Policy
        response['Permissions-Policy'] = (
            'camera=(), microphone=(), geolocation=(), '
            'payment=(), usb=(), bluetooth=()'
        )

        # Cross-Origin policies
        response['Cross-Origin-Opener-Policy'] = 'same-origin'
        response['Cross-Origin-Embedder-Policy'] = 'require-corp'
        response['Cross-Origin-Resource-Policy'] = 'same-origin'

        # Disable XSS Auditor
        response['X-XSS-Protection'] = '0'

        # Cache-Control for sensitive views
        if request.path.startswith('/account') or request.path.startswith('/api/'):
            response['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'

        return response
```

### Go

```go
package main

import (
    "net/http"
)

func securityHeadersMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // HSTS
        w.Header().Set("Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload")

        // Prevent MIME sniffing
        w.Header().Set("X-Content-Type-Options", "nosniff")

        // Clickjacking protection
        w.Header().Set("X-Frame-Options", "DENY")

        // Referrer policy
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

        // Permissions policy
        w.Header().Set("Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()")

        // Cross-Origin policies
        w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
        w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
        w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")

        // Disable XSS Auditor
        w.Header().Set("X-XSS-Protection", "0")

        // CSP
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "+
                "img-src 'self'; object-src 'none'; frame-ancestors 'none'; "+
                "base-uri 'self'; form-action 'self'")

        next.ServeHTTP(w, r)
    })
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Secured response"))
    })

    handler := securityHeadersMiddleware(mux)
    http.ListenAndServeTLS(":443", "cert.pem", "key.pem", handler)
}
```

### Spring Boot

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.headers(headers -> headers
            // HSTS
            .httpStrictTransportSecurity(hsts -> hsts
                .includeSubDomains(true)
                .maxAgeInSeconds(63072000)
                .preload(true)
            )
            // X-Content-Type-Options: nosniff (enabled by default)
            .contentTypeOptions(Customizer.withDefaults())
            // X-Frame-Options: DENY
            .frameOptions(frame -> frame.deny())
            // CSP
            .contentSecurityPolicy(csp -> csp
                .policyDirectives(
                    "default-src 'self'; script-src 'self'; style-src 'self'; " +
                    "img-src 'self'; object-src 'none'; frame-ancestors 'none'; " +
                    "base-uri 'self'; form-action 'self'"
                )
            )
            // Referrer-Policy
            .referrerPolicy(referrer -> referrer
                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
            )
            // Permissions-Policy
            .permissionsPolicy(permissions -> permissions
                .policy("camera=(), microphone=(), geolocation=(), payment=()")
            )
            // Disable X-XSS-Protection
            .xssProtection(xss -> xss.headerValue(
                XXssProtectionHeaderWriter.HeaderValue.DISABLED
            ))
            // Cross-Origin policies
            .crossOriginOpenerPolicy(coop -> coop
                .policy(CrossOriginOpenerPolicyHeaderWriter.CrossOriginOpenerPolicy.SAME_ORIGIN)
            )
            .crossOriginEmbedderPolicy(coep -> coep
                .policy(CrossOriginEmbedderPolicyHeaderWriter.CrossOriginEmbedderPolicy.REQUIRE_CORP)
            )
            .crossOriginResourcePolicy(corp -> corp
                .policy(CrossOriginResourcePolicyHeaderWriter.CrossOriginResourcePolicy.SAME_ORIGIN)
            )
        );

        // Cache control for sensitive endpoints
        http.headers(headers -> headers
            .cacheControl(Customizer.withDefaults())
        );

        return http.build();
    }
}
```

### ASP.NET

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// HSTS configuration
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(730); // 2 years
    options.IncludeSubDomains = true;
    options.Preload = true;
});

app.UseHsts();
app.UseHttpsRedirection();

// Custom security headers middleware
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;

    headers.Append("X-Content-Type-Options", "nosniff");
    headers.Append("X-Frame-Options", "DENY");
    headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.Append("Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()");
    headers.Append("Cross-Origin-Opener-Policy", "same-origin");
    headers.Append("Cross-Origin-Embedder-Policy", "require-corp");
    headers.Append("Cross-Origin-Resource-Policy", "same-origin");
    headers.Append("X-XSS-Protection", "0");
    headers.Append("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; " +
        "img-src 'self'; object-src 'none'; frame-ancestors 'none'; " +
        "base-uri 'self'; form-action 'self'");

    await next();
});

// NWebsec alternative (NuGet package)
// app.UseXContentTypeOptions();
// app.UseXfo(options => options.Deny());
// app.UseReferrerPolicy(options => options.StrictOriginWhenCrossOrigin());

// Sensitive endpoint cache control
app.MapGet("/api/account", () =>
{
    // Controller-level cache headers
}).WithMetadata(new ResponseCacheAttribute
{
    NoStore = true,
    Location = ResponseCacheLocation.None
});
```

---

## Security Header Scoring Tools

### SecurityHeaders.com

- URL: https://securityheaders.com
- Scans any public URL and grades the security headers from A+ to F.
- Provides specific recommendations for missing or misconfigured headers.
- Integrate into CI/CD by curling the API endpoint.

### Mozilla Observatory

- URL: https://observatory.mozilla.org
- Evaluates security headers, TLS configuration, and other best practices.
- Provides a numerical score (0-100) and letter grade.
- Includes links to detailed documentation for each finding.

### Other Tools

| Tool                      | Purpose                                         |
|---------------------------|-------------------------------------------------|
| `curl -I <url>`           | Quick manual header inspection                  |
| Qualys SSL Labs           | TLS/SSL configuration analysis                  |
| OWASP ZAP                 | Automated security header scanning              |
| Burp Suite                | Manual header inspection during pen testing      |
| Lighthouse (Chrome DevTool)| Security header audit in performance report     |
| csp-evaluator.withgoogle.com | CSP-specific evaluation                      |

### Automated CI/CD Integration

```bash
# Check security headers in CI pipeline
SCORE=$(curl -s "https://securityheaders.com/?q=https://example.com&followRedirects=on" \
  -H "Accept: application/json" | jq -r '.grade')

if [ "$SCORE" != "A+" ] && [ "$SCORE" != "A" ]; then
  echo "Security headers grade is $SCORE. Expected A+ or A."
  exit 1
fi
```

---

## Best Practices

1. **Set all security headers on every response.** Use middleware or a reverse proxy to apply
   headers consistently. Do not rely on individual route handlers to set headers, as this
   creates gaps.

2. **Deploy HSTS with a progressive max-age ramp.** Start at 5 minutes, increase to 1 week,
   then 1 month, then 2 years. Verify all subdomains work over HTTPS before adding
   `includeSubDomains`.

3. **Use the always flag in Nginx.** Without `always`, `add_header` only applies to 2xx and 3xx
   responses. Error pages (4xx, 5xx) are left unprotected.

4. **Set X-Content-Type-Options: nosniff on every response type.** Apply to HTML, JSON, CSS, JS,
   images, and all API responses. Pair with accurate Content-Type headers.

5. **Prefer CSP frame-ancestors over X-Frame-Options.** CSP frame-ancestors supports multiple
   origins and is the modern standard. Keep X-Frame-Options as a fallback for legacy browsers.

6. **Disable unused browser features with Permissions-Policy.** Explicitly deny every feature
   the application does not use. This prevents cross-origin iframes from accessing sensitive APIs.

7. **Enable cross-origin isolation (COOP + COEP) when feasible.** Cross-origin isolation provides
   strong side-channel attack mitigations. Audit all third-party resources for CORP/CORS
   compatibility before enabling.

8. **Set Cache-Control: no-store on all authenticated responses.** Prevent sensitive data from
   being stored in browser or proxy caches. Use versioned filenames for static asset caching.

9. **Send Clear-Site-Data on logout endpoints.** Ensure complete session cleanup by clearing
   cookies, storage, and cache when the user logs out.

10. **Automate header validation in CI/CD.** Use SecurityHeaders.com, Mozilla Observatory, or
    custom curl scripts to verify headers on every deployment. Fail the build if critical headers
    are missing.

---

## Anti-Patterns

1. **Setting HSTS max-age to 0 in production.** A max-age of 0 effectively disables HSTS. The
   browser immediately forgets the HTTPS-only policy and allows HTTP connections.

2. **Using X-Frame-Options: ALLOW-FROM.** The `ALLOW-FROM` directive is not supported by modern
   browsers (Chrome, Firefox). Use CSP `frame-ancestors` instead.

3. **Setting X-XSS-Protection: 1; mode=block.** The XSS Auditor is removed from modern browsers
   and can be weaponized by attackers. Set the header to `0` to disable it explicitly.

4. **Missing headers on error pages.** Nginx's `add_header` without `always` omits headers from
   4xx and 5xx responses. Custom error pages served without security headers are vulnerable.

5. **Setting Referrer-Policy: unsafe-url.** This sends the full URL (including query parameters
   containing tokens, session data, or PII) to every destination, including cross-origin sites.

6. **Not setting Permissions-Policy.** Omitting Permissions-Policy allows any embedded iframe to
   request camera, microphone, geolocation, and other sensitive APIs.

7. **Applying COOP/COEP without auditing third-party resources.** Enabling `require-corp` without
   ensuring all cross-origin resources have appropriate CORP/CORS headers breaks images, fonts,
   and scripts from third-party CDNs.

8. **Relying solely on framework defaults.** Many frameworks ship with minimal or no security
   headers. Django's `SecurityMiddleware` does not set COOP, COEP, CORP, or Permissions-Policy.
   Express without Helmet sends zero security headers. Always verify actual headers with curl.

---

## Enforcement Checklist

Use this checklist before every production deployment:

- [ ] `Strict-Transport-Security` is present with `max-age >= 63072000`, `includeSubDomains`, and `preload`.
- [ ] `X-Content-Type-Options: nosniff` is set on ALL response types.
- [ ] `X-Frame-Options: DENY` is set (or `SAMEORIGIN` if framing is required).
- [ ] `Content-Security-Policy` is present with `frame-ancestors` directive.
- [ ] `Referrer-Policy` is set to `strict-origin-when-cross-origin` or stricter.
- [ ] `Permissions-Policy` disables all unused browser features.
- [ ] `Cross-Origin-Opener-Policy` is set to `same-origin` (or `same-origin-allow-popups` if needed).
- [ ] `Cross-Origin-Embedder-Policy` is set to `require-corp` or `credentialless`.
- [ ] `Cross-Origin-Resource-Policy` is set appropriately (`same-origin` for private, `cross-origin` for public).
- [ ] `X-XSS-Protection` is set to `0`.
- [ ] `Cache-Control: no-store` is set on all authenticated/sensitive responses.
- [ ] `Clear-Site-Data` is sent on logout endpoints.
- [ ] Security headers are present on error responses (4xx, 5xx).
- [ ] Security headers are applied consistently across all routes and subdomains.
- [ ] Nginx configuration uses the `always` flag on all `add_header` directives.
- [ ] Headers are verified with SecurityHeaders.com or Mozilla Observatory (grade A or A+).
- [ ] Automated CI/CD tests validate header presence and values.
- [ ] All subdomains have been verified for HTTPS support before HSTS `includeSubDomains`.
- [ ] Third-party resources have been audited for CORP/CORS compatibility before enabling COEP.
- [ ] Header configuration is documented and reviewed by the security team.
