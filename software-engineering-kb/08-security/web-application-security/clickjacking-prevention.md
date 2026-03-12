# Clickjacking Prevention Guide

## Table of Contents

1. [Overview](#overview)
2. [What Is Clickjacking](#what-is-clickjacking)
3. [Attack Variants](#attack-variants)
4. [Defense Mechanisms](#defense-mechanisms)
5. [Implementation Examples](#implementation-examples)
6. [Clickjacking in Modern Applications](#clickjacking-in-modern-applications)
7. [Mobile Clickjacking (Tapjacking)](#mobile-clickjacking-tapjacking)
8. [Best Practices](#best-practices)
9. [Anti-Patterns](#anti-patterns)
10. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

Clickjacking is a class of user interface attack in which a victim is tricked into clicking
on something different from what they perceive. The attacker overlays invisible or disguised
elements on top of a legitimate page, hijacking the user's clicks to perform unintended
actions. This guide covers all major clickjacking variants, defense mechanisms, and framework
implementations.

**CWE Reference:** CWE-1021 -- Improper Restriction of Rendered UI Layers or Frames
**OWASP Classification:** UI Redressing / Clickjacking

---

## What Is Clickjacking

Clickjacking (also called UI redressing) occurs when an attacker embeds a target application
in a transparent iframe on a malicious page. The victim sees the attacker's page but their
clicks are actually delivered to the hidden target application. This allows attackers to
trick users into performing sensitive actions such as:

- Changing account settings (email, password, permissions).
- Making financial transactions.
- Granting OAuth permissions.
- Enabling webcam/microphone access.
- Liking or sharing content on social media.
- Deleting accounts or data.
- Transferring ownership of resources.

### How the Attack Works

1. The attacker creates a malicious web page.
2. The attacker loads the target application in a transparent iframe.
3. The attacker positions the iframe so that a sensitive button (e.g., "Delete Account")
   is directly under an enticing element on the attacker's page (e.g., "Click here for prize").
4. The victim visits the attacker's page and clicks the visible button.
5. The click passes through to the invisible iframe and triggers the action on the target
   application.
6. Because the victim is authenticated in the target application (via cookies), the action
   succeeds.

### Basic Attack HTML

```html
<!-- Attacker's malicious page -->
<!DOCTYPE html>
<html>
<head>
    <style>
        .target-frame {
            position: absolute;
            top: 0;
            left: 0;
            width: 500px;
            height: 500px;
            opacity: 0.0001;  /* Nearly invisible */
            z-index: 2;       /* On top of the bait */
            border: none;
        }
        .bait {
            position: absolute;
            top: 200px;  /* Aligned with target button */
            left: 150px;
            z-index: 1;
            font-size: 24px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="bait">Click here to claim your free prize!</div>
    <iframe class="target-frame" src="https://target-app.com/settings/delete-account"></iframe>
</body>
</html>
```

---

## Attack Variants

### Classic Clickjacking

The standard attack described above: an invisible iframe overlaid on a decoy page. The
user's click is intercepted by the hidden iframe.

### Likejacking

A variant targeting social media platforms where clicks are redirected to "Like" or "Share"
buttons on Facebook, Twitter, or other platforms. The attacker gains social proof and viral
distribution.

### Cursorjacking

The attacker replaces or offsets the visible cursor position using CSS or JavaScript. The
user sees the cursor in one location, but the actual click target is elsewhere on the page.

```css
/* Hide real cursor and show a fake one offset from the actual position */
body {
    cursor: none;
}
.fake-cursor {
    position: fixed;
    pointer-events: none;
    /* Offset from real cursor position */
    transform: translate(-200px, -200px);
}
```

### Drag-and-Drop Attacks

The attacker uses HTML5 drag-and-drop events to extract content from a framed page. The
victim starts a drag on the attacker's page but the drag source is actually content from
the hidden iframe. Data from the target application (tokens, personal information) can be
dragged into attacker-controlled elements.

### Double-Click Exploit Attacks

A newer clickjacking variant that exploits the time between the first and second click
in a double-click action:

1. The attacker presents a page that requires a double-click.
2. On the first click, the attacker opens a new window or repositions content.
3. Between the first and second click, the attacker swaps the content so that the second
   click lands on a sensitive action in the target application.
4. Because the delay between clicks is only milliseconds, the user cannot react.

This bypasses some traditional clickjacking defenses because:

- The target page may not be in an iframe (it can be in a popup).
- The timing between clicks makes it imperceptible to the user.
- Frame-busting scripts may not detect this pattern.

**Defense:** Use `SameSite` cookies, require explicit confirmation for sensitive actions
(multi-step workflows), and implement interaction delays on critical buttons.

### Permission Prompt Hijacking

The attacker aligns browser permission prompts (camera, microphone, geolocation, notification)
with decoy click targets. When the user clicks the decoy, they inadvertently grant the
permission.

Browsers have mitigated this by:

- Requiring user gesture for permission requests.
- Showing prompts in a consistent, non-overlappable location.
- Adding delays before permission prompts become clickable.

However, older browsers and mobile environments may still be vulnerable.

---

## Defense Mechanisms

### X-Frame-Options Header

The `X-Frame-Options` HTTP response header instructs the browser whether the page can be
rendered in a frame. It has been supported since 2009 and is understood by all modern browsers.

#### DENY

Prevent the page from being framed by any origin, including the same origin:

```
X-Frame-Options: DENY
```

Use `DENY` for pages that should never be embedded (login pages, settings pages, transaction
pages).

#### SAMEORIGIN

Allow framing only by pages on the same origin:

```
X-Frame-Options: SAMEORIGIN
```

Use `SAMEORIGIN` when the application legitimately embeds its own pages in iframes (e.g.,
internal dashboards, component-based layouts).

#### ALLOW-FROM (Deprecated)

The `ALLOW-FROM` directive was intended to allow framing from a specific origin:

```
X-Frame-Options: ALLOW-FROM https://trusted-partner.com
```

**Do not use ALLOW-FROM.** It is not supported by Chrome or Safari and has been removed
from the specification. Use CSP `frame-ancestors` instead.

#### Limitations of X-Frame-Options

- Only supports `DENY` and `SAMEORIGIN` in practice.
- Cannot specify multiple allowed origins.
- Cannot use wildcards.
- Does not protect against double-click attacks or popup-based clickjacking.

### CSP frame-ancestors Directive

The `Content-Security-Policy: frame-ancestors` directive is the modern replacement for
`X-Frame-Options`. It provides finer-grained control over which origins can embed the page.

**CSP frame-ancestors supersedes X-Frame-Options.** When both are present, browsers that
support CSP will use `frame-ancestors` and ignore `X-Frame-Options`.

#### Syntax

```
Content-Security-Policy: frame-ancestors 'none';
Content-Security-Policy: frame-ancestors 'self';
Content-Security-Policy: frame-ancestors 'self' https://trusted.com;
Content-Security-Policy: frame-ancestors https://*.trusted.com;
```

#### Directive Values

| Value                       | Description                                      |
|-----------------------------|--------------------------------------------------|
| `'none'`                    | No origin can frame this page (equivalent to DENY) |
| `'self'`                    | Same origin only (equivalent to SAMEORIGIN)       |
| `https://trusted.com`       | Specific origin allowed                          |
| `https://*.trusted.com`     | Wildcard subdomain matching                      |
| `https:`                    | Any HTTPS origin (too permissive, avoid)         |

#### Advantages Over X-Frame-Options

- Supports multiple origins.
- Supports wildcard subdomain matching.
- Part of the CSP specification (actively maintained).
- Supports `'none'` for complete denial.
- Enforced consistently across browsers.

### Frame-Busting Scripts (Legacy)

Frame-busting scripts are JavaScript-based defenses that detect when a page is loaded in a
frame and attempt to break out. **These are unreliable and should not be the primary defense.**

#### Classic Frame-Buster

```javascript
// Basic frame-busting script
if (window.top !== window.self) {
    window.top.location = window.self.location;
}
```

#### Why Frame-Busting Is Unreliable

1. **sandbox attribute bypass:** The attacker can use `<iframe sandbox="">` which disables
   JavaScript in the framed page, preventing the frame-buster from running.

2. **onbeforeunload cancellation:** The attacker can cancel the navigation:
   ```javascript
   window.onbeforeunload = function() { return false; };
   ```

3. **Double-framing:** The attacker uses nested iframes to confuse the frame-buster:
   ```html
   <iframe src="attacker-middle.html">
       <!-- attacker-middle.html contains: -->
       <iframe src="https://target-app.com/sensitive-page"></iframe>
   </iframe>
   ```

4. **204 No Content trick:** The attacker redirects `window.top.location` to a URL that
   returns 204, leaving the page in the frame.

5. **XSS filter abuse (historical):** Some browsers' XSS filters could be tricked into
   blocking the frame-busting script.

**Use frame-busting scripts only as defense-in-depth, never as the sole protection.**

#### Improved Frame-Buster (Defense-in-Depth Only)

```javascript
// Hide page content by default
document.documentElement.style.display = 'none';

// Only show content if not framed
if (window.self === window.top) {
    document.documentElement.style.display = '';
} else {
    // Attempt to break out
    try {
        window.top.location = window.self.location;
    } catch (e) {
        // Cross-origin framing detected, keep content hidden
    }
}
```

---

## Implementation Examples

### Express.js (Node.js)

#### Using Helmet Middleware

```javascript
const express = require("express");
const helmet = require("helmet");

const app = express();

// Recommended: Set both X-Frame-Options and CSP frame-ancestors
app.use(
    helmet({
        frameguard: {
            action: "deny", // or 'sameorigin'
        },
        contentSecurityPolicy: {
            directives: {
                frameAncestors: ["'none'"],
            },
        },
    })
);
```

#### Manual Header Setting

```javascript
const express = require("express");
const app = express();

// Global middleware for clickjacking prevention
app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
        "Content-Security-Policy",
        "frame-ancestors 'none'"
    );
    next();
});

// Per-route override for pages that need framing
app.get("/embeddable-widget", (req, res) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
        "Content-Security-Policy",
        "frame-ancestors 'self' https://trusted-partner.com"
    );
    res.send("This page can be embedded by trusted partners.");
});
```

### Django (Python)

#### Using Django's Built-in Middleware

```python
# settings.py

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # ... other middleware
]

# Set the default X-Frame-Options header
X_FRAME_OPTIONS = "DENY"  # Options: 'DENY', 'SAMEORIGIN'

# Add CSP frame-ancestors via django-csp (recommended)
# pip install django-csp

CSP_FRAME_ANCESTORS = ("'none'",)
```

#### Per-View Override

```python
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.clickjacking import xframe_options_deny
from django.views.decorators.clickjacking import xframe_options_exempt


@xframe_options_deny
def sensitive_view(request):
    """This view must never be framed."""
    return HttpResponse("Sensitive content")


@xframe_options_sameorigin
def embeddable_view(request):
    """This view can be framed by the same origin."""
    return HttpResponse("Embeddable content")


@xframe_options_exempt
def public_widget(request):
    """This view can be framed by anyone (use with caution)."""
    # Manually set CSP frame-ancestors for specific partners
    response = HttpResponse("Public widget")
    response["Content-Security-Policy"] = (
        "frame-ancestors 'self' https://trusted-partner.com"
    )
    return response
```

### Go (net/http)

#### Middleware Approach

```go
package middleware

import "net/http"

// ClickjackingProtection returns middleware that sets anti-clickjacking headers.
func ClickjackingProtection(policy string) func(http.Handler) http.Handler {
    // Default to DENY if not specified
    if policy == "" {
        policy = "DENY"
    }

    var cspFrameAncestors string
    switch policy {
    case "DENY":
        cspFrameAncestors = "frame-ancestors 'none'"
    case "SAMEORIGIN":
        cspFrameAncestors = "frame-ancestors 'self'"
    default:
        cspFrameAncestors = "frame-ancestors 'none'"
    }

    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("X-Frame-Options", policy)
            w.Header().Set("Content-Security-Policy", cspFrameAncestors)
            next.ServeHTTP(w, r)
        })
    }
}

// Usage:
// mux := http.NewServeMux()
// mux.HandleFunc("/", handler)
// wrappedMux := ClickjackingProtection("DENY")(mux)
// http.ListenAndServe(":8080", wrappedMux)
```

#### Custom frame-ancestors for Specific Partners

```go
func partnerEmbedHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("X-Frame-Options", "SAMEORIGIN")
    w.Header().Set(
        "Content-Security-Policy",
        "frame-ancestors 'self' https://trusted-partner.com https://other-partner.com",
    )
    w.Write([]byte("Embeddable by trusted partners"))
}
```

### Spring Boot (Java)

#### Using Spring Security

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ContentSecurityPolicyHeaderWriter;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .headers(headers -> headers
                // X-Frame-Options: DENY
                .frameOptions(frame -> frame.deny())
                // CSP frame-ancestors
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("frame-ancestors 'none'")
                )
            );

        return http.build();
    }
}
```

#### Allow Same-Origin Framing

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .headers(headers -> headers
            .frameOptions(frame -> frame.sameOrigin())
            .contentSecurityPolicy(csp -> csp
                .policyDirectives("frame-ancestors 'self'")
            )
        );

    return http.build();
}
```

### Nginx

#### Global Configuration

```nginx
# In the http or server block
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy "frame-ancestors 'none'" always;
```

#### Per-Location Override

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    # Default: deny all framing
    add_header X-Frame-Options "DENY" always;
    add_header Content-Security-Policy "frame-ancestors 'none'" always;

    # Allow framing for the widget endpoint
    location /widget {
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Content-Security-Policy "frame-ancestors 'self' https://trusted-partner.com" always;
        proxy_pass http://backend;
    }

    location / {
        proxy_pass http://backend;
    }
}
```

**Important:** The `always` parameter ensures headers are sent on all response codes
(including 4xx and 5xx errors). Without `always`, Nginx only adds headers to 2xx and 3xx
responses, leaving error pages vulnerable to clickjacking.

### Apache

#### Global Configuration

```apache
# In httpd.conf or .htaccess
Header always set X-Frame-Options "DENY"
Header always set Content-Security-Policy "frame-ancestors 'none'"
```

#### Per-Directory Override

```apache
<Directory "/var/www/html/widget">
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Content-Security-Policy "frame-ancestors 'self' https://trusted-partner.com"
</Directory>
```

#### Conditional Headers Based on File Type

```apache
# Only set clickjacking headers for HTML responses
<If "%{CONTENT_TYPE} =~ /text\/html/">
    Header always set X-Frame-Options "DENY"
    Header always set Content-Security-Policy "frame-ancestors 'none'"
</If>
```

---

## Clickjacking in Modern Applications

### Single-Page Applications (SPAs)

SPAs present unique clickjacking challenges:

1. **Dynamic content:** The page content changes without full page loads, so the framing
   context remains the same throughout the session.
2. **Client-side routing:** The URL changes via `pushState()` without a server round-trip,
   meaning the CSP headers set on the initial page load apply to all subsequent views.
3. **API-driven architecture:** If the API endpoints do not set clickjacking headers (which
   they typically should not, as they return JSON, not HTML), the protection depends entirely
   on the initial HTML response headers.

**SPA-specific defense steps:**

- Set `X-Frame-Options` and `frame-ancestors` on the initial HTML shell (index.html).
- Ensure CDN caching does not strip security headers.
- Test that CSP headers are present after deployment (CDN, reverse proxy, etc.).
- Implement the JavaScript frame-buster as defense-in-depth in the SPA bootstrap code.

### OAuth and Authentication Flows

OAuth authorization pages are high-value clickjacking targets:

- An attacker can trick a user into approving an OAuth grant by clicking a hidden
  "Authorize" button.
- OAuth providers should always set `X-Frame-Options: DENY` on authorization endpoints.
- Implement PKCE (Proof Key for Code Exchange) to add additional verification.
- Use `state` parameter to prevent cross-site request forgery in the OAuth flow.

### Multi-Step Forms and Confirmations

For critical actions (delete account, transfer funds, change email):

- Require multiple distinct user interactions (not just a single click).
- Use server-generated CSRF tokens that change with each step.
- Add intentional delays between action steps.
- Require re-authentication for the most sensitive actions.

---

## Mobile Clickjacking (Tapjacking)

### Android Tapjacking

Android applications are vulnerable to tapjacking when a malicious app draws an overlay
on top of a target application. The user taps the overlay but the tap event is delivered
to the application underneath.

**Android defenses:**

1. **filterTouchesWhenObscured:** Set this attribute on sensitive views to ignore touch
   events when the view is covered by another window:

   ```xml
   <Button
       android:layout_width="wrap_content"
       android:layout_height="wrap_content"
       android:text="Confirm Payment"
       android:filterTouchesWhenObscured="true" />
   ```

   Or programmatically:
   ```java
   button.setFilterTouchesWhenObscured(true);
   ```

2. **SYSTEM_ALERT_WINDOW permission:** Starting from Android 12, the system restricts
   overlay permissions more strictly.

3. **FLAG_WINDOW_IS_OBSCURED:** Check the MotionEvent flags to detect obscured touches:

   ```java
   @Override
   public boolean onTouchEvent(MotionEvent event) {
       if ((event.getFlags() & MotionEvent.FLAG_WINDOW_IS_OBSCURED) != 0) {
           // Touch is obscured by another window -- potential tapjacking
           return false;
       }
       return super.onTouchEvent(event);
   }
   ```

### iOS Considerations

iOS is less susceptible to tapjacking because:

- Apps cannot draw overlays on top of other apps.
- The system strictly controls which app receives touch events.
- WKWebView respects CSP headers and X-Frame-Options.

However, in-app browsers (WebViews) should still enforce clickjacking headers because
a malicious webpage loaded in a WebView can attempt iframe-based clickjacking.

---

## Best Practices

### BP-1: Set CSP frame-ancestors on All HTML Responses

Apply `Content-Security-Policy: frame-ancestors 'none'` to every HTML response by default.
Override to `'self'` or specific origins only for pages that legitimately need to be embedded.

### BP-2: Set X-Frame-Options as a Fallback

Always include `X-Frame-Options: DENY` alongside CSP `frame-ancestors` for backward
compatibility with older browsers that do not support CSP.

### BP-3: Apply Headers at the Reverse Proxy or CDN Level

Set clickjacking headers at the infrastructure level (Nginx, Apache, CDN) to ensure
coverage even if the application fails to set them. Use the `always` directive to cover
error responses.

### BP-4: Default to DENY and Explicitly Allow Embedding

Start with the most restrictive policy (`DENY` / `'none'`) and create explicit exceptions
only for pages that require embedding. Document each exception with a justification.

### BP-5: Require Multi-Step Confirmation for Critical Actions

Implement multi-step confirmation flows for sensitive actions (delete account, change email,
transfer funds). A single click should never trigger an irreversible action.

### BP-6: Use SameSite Cookies to Complement Framing Defenses

Set `SameSite=Lax` or `SameSite=Strict` on session cookies. This prevents the browser
from sending cookies in cross-origin iframe contexts, making clickjacking attacks ineffective
even if framing protection fails.

```
Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
```

### BP-7: Implement CSRF Tokens on All State-Changing Endpoints

CSRF tokens add a layer of defense that works independently of framing protection. Even if
a page is framed, the attacker cannot extract the CSRF token (due to same-origin policy).

### BP-8: Test Headers After Deployment

Verify that clickjacking headers are present in production after deployment. CDNs, load
balancers, and reverse proxies can strip or override headers. Use automated tests:

```bash
curl -s -I https://example.com | grep -i "x-frame-options\|frame-ancestors"
```

### BP-9: Protect Embeddable Content with Token-Based Access

If a page must be embeddable by third parties, use token-based access control instead of
relying solely on origin-based framing policies. Issue short-lived embed tokens that
authorize framing from specific referrers.

### BP-10: Add Android Tapjacking Protection for Mobile Apps

Set `filterTouchesWhenObscured="true"` on all sensitive UI elements in Android applications.
Check `MotionEvent.FLAG_WINDOW_IS_OBSCURED` for custom touch handling.

---

## Anti-Patterns

### AP-1: Relying Solely on Frame-Busting JavaScript

**Wrong:** Use JavaScript to detect framing and break out of frames.
**Problem:** Frame-busting scripts can be defeated by the `sandbox` attribute, double-framing,
and `onbeforeunload` cancellation. They provide no protection when JavaScript is disabled or
blocked.

### AP-2: Using ALLOW-FROM Without CSP Fallback

**Wrong:** Set `X-Frame-Options: ALLOW-FROM https://partner.com`.
**Problem:** `ALLOW-FROM` is not supported by Chrome or Safari. Most users will have zero
clickjacking protection.

### AP-3: Setting Headers Only on 200 Responses

**Wrong:** Configure Nginx without the `always` parameter.
**Problem:** Error pages (403, 404, 500) are served without clickjacking headers. Attackers
can frame error pages and position content to their advantage.

### AP-4: Omitting Clickjacking Headers on API Endpoints That Return HTML

**Wrong:** Assume API endpoints do not need clickjacking headers.
**Problem:** If an API endpoint returns HTML content (error pages, documentation, OAuth
callbacks), it can be framed. Set headers on all responses that return HTML content.

### AP-5: Using CSP frame-ancestors with Overly Broad Values

**Wrong:** Set `frame-ancestors https:` or `frame-ancestors *`.
**Problem:** This allows any HTTPS origin to frame the page, providing no meaningful
protection.

### AP-6: Exempting Login Pages from Clickjacking Protection

**Wrong:** Remove framing protection from login pages so they can be embedded in partner
sites.
**Problem:** Login pages are high-value clickjacking targets. Attackers can trick users into
entering credentials in a framed login page.

### AP-7: Ignoring Double-Click and Popup-Based Attacks

**Wrong:** Assume that `X-Frame-Options: DENY` prevents all clickjacking variants.
**Problem:** Double-click attacks and popup-based clickjacking do not rely on iframes.
Additional defenses (multi-step confirmation, SameSite cookies, interaction delays) are
needed.

### AP-8: Not Setting filterTouchesWhenObscured on Android

**Wrong:** Assume Android OS prevents tapjacking.
**Problem:** Malicious apps with overlay permissions can draw transparent views on top of
the target app. Without `filterTouchesWhenObscured`, taps pass through to the target.

---

## Enforcement Checklist

### HTTP Headers

- [ ] `X-Frame-Options: DENY` is set on all HTML responses by default.
- [ ] `Content-Security-Policy: frame-ancestors 'none'` is set on all HTML responses.
- [ ] Both headers are applied via reverse proxy or CDN as the primary enforcement point.
- [ ] Headers are sent on ALL response codes (including 4xx and 5xx) using the `always` flag.
- [ ] `ALLOW-FROM` is not used anywhere in the application.
- [ ] Pages that require embedding have explicit exceptions with specific origins listed.
- [ ] Each framing exception is documented with a business justification.

### Cookie Configuration

- [ ] Session cookies have `SameSite=Lax` or `SameSite=Strict` set.
- [ ] Session cookies have the `Secure` flag set.
- [ ] Session cookies have the `HttpOnly` flag set.

### Application Logic

- [ ] CSRF tokens are required on all state-changing endpoints.
- [ ] Critical actions require multi-step confirmation (not a single click).
- [ ] Sensitive actions require re-authentication.
- [ ] OAuth authorization endpoints set `X-Frame-Options: DENY`.

### SPA and Frontend

- [ ] The initial HTML shell sets clickjacking headers.
- [ ] CDN caching preserves security headers on cached responses.
- [ ] A frame-buster script is included as defense-in-depth.
- [ ] The frame-buster hides content by default and only displays when not framed.

### Mobile Applications

- [ ] Android: `filterTouchesWhenObscured="true"` is set on all sensitive views.
- [ ] Android: Custom touch event handlers check `FLAG_WINDOW_IS_OBSCURED`.
- [ ] Android: WebViews enforce CSP headers from loaded pages.
- [ ] iOS: WKWebView is used instead of the deprecated UIWebView.

### Testing and Monitoring

- [ ] Automated tests verify clickjacking headers are present on all endpoints.
- [ ] Tests cover error pages (4xx, 5xx) for header presence.
- [ ] Penetration tests include clickjacking scenarios.
- [ ] Security scanners check for missing framing headers.
- [ ] CSP violation reports are collected and monitored (using `report-uri` or `report-to`).
- [ ] Header configuration is validated after every deployment.

### Infrastructure

- [ ] Nginx/Apache configurations include clickjacking headers with the `always` directive.
- [ ] CDN rules do not strip `X-Frame-Options` or `Content-Security-Policy` headers.
- [ ] Load balancers pass through security headers without modification.
- [ ] Staging and production environments have identical header configurations.

---

## References

- CWE-1021: Improper Restriction of Rendered UI Layers or Frames
  https://cwe.mitre.org/data/definitions/1021.html
- OWASP Clickjacking Defense Cheat Sheet
  https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html
- MDN: X-Frame-Options
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
- MDN: CSP frame-ancestors
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors
- PortSwigger: Clickjacking
  https://portswigger.net/web-security/clickjacking
