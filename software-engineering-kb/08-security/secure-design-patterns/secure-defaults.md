# Secure Defaults Pattern Guide

## Overview

Category: Secure Design Patterns
Scope: Default configuration security across frameworks and languages
Audience: Software engineers, security engineers, platform teams
Last Updated: 2025-06

## Purpose

Secure defaults ensure that applications are safe "out of the box," requiring
explicit action to weaken security rather than explicit action to strengthen it.
Every configuration decision must default to the most restrictive option that
still allows the application to function. When a developer forgets to set a
flag, the system must fail closed -- not open.

---

## Core Principle: Deny by Default

The foundational rule of secure defaults is that everything is denied unless
explicitly permitted. This applies to authorization, network access, data
exposure, and feature enablement.

```
INSECURE MENTAL MODEL:
  "Allow everything, then block what is dangerous."

SECURE MENTAL MODEL:
  "Block everything, then allow what is necessary."
```

---

## Pattern 1: Deny-by-Default Authorization

### Theory

Implement a whitelist approach to permissions. Every request starts as
unauthorized. The system grants access only when an explicit rule matches.
If no rule matches, the request is denied.

### TypeScript -- Express.js Authorization Middleware

```typescript
// INSECURE: Blacklist approach -- blocks known bad routes
// Everything not listed is accessible.
const insecureAuth = (req: Request, res: Response, next: NextFunction) => {
  const blockedPaths = ['/admin', '/internal'];
  if (blockedPaths.some(p => req.path.startsWith(p))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next(); // Allows everything else -- dangerous
};

// SECURE: Whitelist approach -- only allows known permitted routes
interface RoutePermission {
  path: string;
  methods: string[];
  roles: string[];
}

const allowedRoutes: RoutePermission[] = [
  { path: '/api/health', methods: ['GET'], roles: ['*'] },
  { path: '/api/products', methods: ['GET'], roles: ['user', 'admin'] },
  { path: '/api/products', methods: ['POST'], roles: ['admin'] },
  { path: '/api/users/me', methods: ['GET', 'PATCH'], roles: ['user', 'admin'] },
];

const secureAuth = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const matchedRoute = allowedRoutes.find(
    (route) =>
      req.path.startsWith(route.path) &&
      route.methods.includes(req.method)
  );

  if (!matchedRoute) {
    // Default: DENY -- no matching route means no access
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (matchedRoute.roles.includes('*')) {
    return next(); // Public route
  }

  if (!user || !matchedRoute.roles.includes(user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};
```

### Go -- Deny-by-Default Middleware

```go
package middleware

import (
    "net/http"
    "strings"
)

type Permission struct {
    Path    string
    Methods []string
    Roles   []string
}

var allowedRoutes = []Permission{
    {Path: "/api/health", Methods: []string{"GET"}, Roles: []string{"*"}},
    {Path: "/api/products", Methods: []string{"GET"}, Roles: []string{"user", "admin"}},
    {Path: "/api/products", Methods: []string{"POST"}, Roles: []string{"admin"}},
}

func AuthorizeMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())

        matched := false
        for _, route := range allowedRoutes {
            if !strings.HasPrefix(r.URL.Path, route.Path) {
                continue
            }
            if !containsString(route.Methods, r.Method) {
                continue
            }
            matched = true
            if containsString(route.Roles, "*") {
                next.ServeHTTP(w, r)
                return
            }
            if user == nil || !containsString(route.Roles, user.Role) {
                http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
                return
            }
            next.ServeHTTP(w, r)
            return
        }

        if !matched {
            // DEFAULT DENY: no route matched
            http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
        }
    })
}
```

---

## Pattern 2: Secure Cookie Defaults

### Theory

Cookies must be secure by default. Every cookie set by the application must
include HttpOnly, Secure, SameSite, and a restricted Path. Developers must
explicitly opt out of these protections with justification.

### TypeScript -- Secure Cookie Factory

```typescript
// INSECURE: Cookie set with no security flags
// res.cookie('session', token); // No flags -- vulnerable to XSS, CSRF, interception

// SECURE: Cookie factory with secure defaults
interface CookieOptions {
  httpOnly?: boolean;   // Default: true -- prevents JavaScript access
  secure?: boolean;     // Default: true -- HTTPS only
  sameSite?: 'strict' | 'lax' | 'none'; // Default: 'lax' -- CSRF protection
  path?: string;        // Default: '/' -- restrict scope
  maxAge?: number;      // Default: session-scoped
  domain?: string;      // Default: current domain only
}

const SECURE_COOKIE_DEFAULTS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
};

function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  overrides: Partial<CookieOptions> = {}
): void {
  const options = { ...SECURE_COOKIE_DEFAULTS, ...overrides };

  // Warn if security flags are being weakened
  if (overrides.httpOnly === false) {
    console.warn(`[SECURITY] Cookie "${name}" has httpOnly disabled. Justify this decision.`);
  }
  if (overrides.secure === false && process.env.NODE_ENV === 'production') {
    throw new Error(`Cookie "${name}" cannot have secure=false in production.`);
  }
  if (overrides.sameSite === 'none' && !options.secure) {
    throw new Error('SameSite=None requires Secure=true.');
  }

  res.cookie(name, value, options);
}

// Usage
setSecureCookie(res, 'session_id', token, { maxAge: 3600000 });
```

### Python -- Django Secure Cookie Settings

```python
# settings.py -- SECURE DEFAULTS

# Session cookie
SESSION_COOKIE_HTTPONLY = True     # Prevent JavaScript access
SESSION_COOKIE_SECURE = True      # HTTPS only
SESSION_COOKIE_SAMESITE = 'Lax'   # CSRF protection
SESSION_COOKIE_AGE = 3600         # 1 hour timeout
SESSION_COOKIE_NAME = '__Host-sessionid'  # Host-prefix prevents subdomain attacks

# CSRF cookie
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_NAME = '__Host-csrftoken'

# INSECURE -- never do this in production
# SESSION_COOKIE_HTTPONLY = False
# SESSION_COOKIE_SECURE = False
# SESSION_COOKIE_SAMESITE = 'None'
```

---

## Pattern 3: Secure HTTP Headers by Default

### Theory

HTTP security headers defend against XSS, clickjacking, MIME sniffing, and
information disclosure. Apply them globally via middleware so that every
response includes the correct headers automatically.

### TypeScript -- Express.js with Helmet.js Pattern

```typescript
import helmet from 'helmet';
import express from 'express';

const app = express();

// SECURE: Apply helmet with strict defaults
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],         // No inline scripts
      styleSrc: ["'self'"],          // No inline styles
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],         // Block plugins
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],          // Prevent framing
      baseUri: ["'self'"],           // Prevent base tag hijacking
      formAction: ["'self'"],        // Restrict form targets
      upgradeInsecureRequests: [],   // Auto-upgrade HTTP to HTTPS
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },          // X-Frame-Options: DENY
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,                           // X-Content-Type-Options: nosniff
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// Remove the X-Powered-By header -- information disclosure
app.disable('x-powered-by');
```

### Go -- Security Headers Middleware

```go
package middleware

import "net/http"

func SecurityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        h := w.Header()

        h.Set("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "+
            "object-src 'none'; frame-ancestors 'none'; base-uri 'self'")
        h.Set("X-Content-Type-Options", "nosniff")
        h.Set("X-Frame-Options", "DENY")
        h.Set("X-XSS-Protection", "0") // Disable legacy XSS filter; CSP is better
        h.Set("Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload")
        h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
        h.Set("Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=()")
        h.Set("Cross-Origin-Opener-Policy", "same-origin")
        h.Set("Cross-Origin-Resource-Policy", "same-origin")

        // Remove server identification
        h.Del("Server")
        h.Del("X-Powered-By")

        next.ServeHTTP(w, r)
    })
}
```

---

## Pattern 4: Encrypted Connections by Default

### Theory

All network connections must use TLS. The application must reject plaintext
connections and enforce a minimum TLS version of 1.2. Connections that attempt
to downgrade must be terminated.

### Go -- TLS Server Configuration

```go
package main

import (
    "crypto/tls"
    "log"
    "net/http"
)

func secureTLSConfig() *tls.Config {
    return &tls.Config{
        // SECURE: Minimum TLS 1.2
        MinVersion: tls.VersionTLS12,

        // Prefer server cipher suites
        PreferServerCipherSuites: true,

        // Strong cipher suites only
        CipherSuites: []uint16{
            tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
            tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
            tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,
            tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256,
        },

        // Strong curves only
        CurvePreferences: []tls.CurveID{
            tls.X25519,
            tls.CurveP256,
        },
    }
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Secure"))
    })

    server := &http.Server{
        Addr:      ":443",
        Handler:   mux,
        TLSConfig: secureTLSConfig(),
    }

    // INSECURE: Never run http.ListenAndServe() without TLS in production
    // http.ListenAndServe(":80", mux)  // NEVER DO THIS

    // Redirect HTTP to HTTPS
    go func() {
        redirectServer := &http.Server{
            Addr: ":80",
            Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                target := "https://" + r.Host + r.URL.RequestURI()
                http.Redirect(w, r, target, http.StatusMovedPermanently)
            }),
        }
        log.Fatal(redirectServer.ListenAndServe())
    }()

    log.Fatal(server.ListenAndServeTLS("cert.pem", "key.pem"))
}
```

### TypeScript -- Node.js TLS Configuration

```typescript
import https from 'https';
import tls from 'tls';
import fs from 'fs';

// SECURE: Minimum TLS 1.2
tls.DEFAULT_MIN_VERSION = 'TLSv1.2';

const httpsOptions: https.ServerOptions = {
  key: fs.readFileSync('/etc/ssl/private/server.key'),
  cert: fs.readFileSync('/etc/ssl/certs/server.crt'),
  ca: fs.readFileSync('/etc/ssl/certs/ca.crt'),

  minVersion: 'TLSv1.2',

  // Strong ciphers only
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_AES_128_GCM_SHA256',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
  ].join(':'),

  honorCipherOrder: true,
};

const server = https.createServer(httpsOptions, app);
```

---

## Pattern 5: Secure Framework Configurations

### Express.js -- Secure Defaults

```typescript
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

const app = express();

// Security headers
app.use(helmet());

// Remove fingerprinting
app.disable('x-powered-by');

// Trust proxy (when behind a reverse proxy like nginx/ALB)
// Set to specific proxy count, never to 'true' (trusts all proxies)
app.set('trust proxy', 1);

// JSON body limit -- prevent large payload attacks
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// CORS -- restrictive by default
app.use(cors({
  origin: ['https://app.example.com'],  // Explicit origins, never '*' with credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600,  // Cache preflight for 10 minutes
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
}));

// Disable ETag for sensitive routes (prevents information leakage)
app.set('etag', false);
```

### Django -- Secure Settings

```python
# settings.py -- Production secure defaults

DEBUG = False  # NEVER True in production

ALLOWED_HOSTS = ['app.example.com']  # Explicit list, never ['*']

# HTTPS enforcement
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# HSTS
SECURE_HSTS_SECONDS = 31536000        # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Content security
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True   # Deprecated but harmless
X_FRAME_OPTIONS = 'DENY'

# CSRF protection -- enabled by default in Django
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_USE_SESSIONS = True  # Store CSRF token in session, not cookie

# Session security
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = 3600          # 1 hour
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Template auto-escaping -- enabled by default, never disable
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'OPTIONS': {
            'autoescape': True,  # Default, but be explicit
        },
    },
]
```

### Spring Boot -- Secure Configuration

```java
// SecurityConfig.java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Deny all by default
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()  // Default: deny
            )
            // CSRF enabled by default (do not disable for browser-facing APIs)
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            )
            // Enforce HTTPS
            .requiresChannel(channel -> channel
                .anyRequest().requiresSecure()
            )
            // Security headers
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(Customizer.withDefaults())
                .httpStrictTransportSecurity(hsts -> hsts
                    .maxAgeInSeconds(31536000)
                    .includeSubDomains(true)
                    .preload(true))
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'"))
            )
            // Session management
            .sessionManagement(session -> session
                .maximumSessions(1)
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            );

        return http.build();
    }
}
```

### ASP.NET -- Secure Defaults

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});

builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
    options.HttpsPort = 443;
});

// Anti-forgery (CSRF) enabled by default for Razor Pages
builder.Services.AddAntiforgery(options =>
{
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();

// Security headers middleware
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Content-Security-Policy"] = "default-src 'self'";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    headers.Remove("Server");
    headers.Remove("X-Powered-By");
    await next();
});

app.UseAuthentication();
app.UseAuthorization();
```

### Go -- crypto/tls Minimum Version

```go
package main

import (
    "crypto/tls"
    "database/sql"
    "log"

    "github.com/go-sql-driver/mysql"
)

func secureDBConnection() (*sql.DB, error) {
    // Register custom TLS config for database connection
    tlsConfig := &tls.Config{
        MinVersion: tls.VersionTLS12,
        ServerName: "db.example.com",
    }
    err := mysql.RegisterTLSConfig("custom", tlsConfig)
    if err != nil {
        return nil, err
    }

    // Require TLS for database connections
    dsn := "user:password@tcp(db.example.com:3306)/dbname?tls=custom"
    db, err := sql.Open("mysql", dsn)
    if err != nil {
        return nil, err
    }

    return db, nil
}

// INSECURE: Never disable TLS verification
// tlsConfig := &tls.Config{InsecureSkipVerify: true} // NEVER DO THIS
```

---

## Pattern 6: Default Deny Firewall Rules

### Theory

Network firewalls and security groups must default to denying all traffic.
Only explicitly required ports and protocols are allowed. Ingress and egress
rules must both be restrictive.

```yaml
# Kubernetes NetworkPolicy -- Default Deny All
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}  # Apply to all pods
  policyTypes:
    - Ingress
    - Egress
  # No ingress or egress rules = deny all traffic

---
# Then allow only specific traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - port: 8080
          protocol: TCP
```

```hcl
# Terraform -- AWS Security Group with default deny
resource "aws_security_group" "app" {
  name_prefix = "app-"
  vpc_id      = var.vpc_id

  # No ingress rules = deny all inbound by default

  # Explicit egress only to required destinations
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound"
  }

  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.database.id]
    description     = "PostgreSQL to database"
  }

  # INSECURE: Never allow all traffic
  # egress {
  #   from_port   = 0
  #   to_port     = 0
  #   protocol    = "-1"
  #   cidr_blocks = ["0.0.0.0/0"]
  # }
}
```

---

## Pattern 7: Default Disabled Debug Mode

### Theory

Debug mode must be disabled by default in all environments. Debug mode exposes
stack traces, environment variables, database queries, and internal paths.
Enable it only in local development with explicit configuration.

### Python -- Debug Mode Guard

```python
import os
import sys

class AppConfig:
    def __init__(self):
        # Default: debug disabled
        self.debug = os.getenv('APP_DEBUG', 'false').lower() == 'true'

        # Prevent debug mode in production
        env = os.getenv('APP_ENV', 'production')
        if self.debug and env == 'production':
            print("FATAL: Debug mode cannot be enabled in production", file=sys.stderr)
            sys.exit(1)

        # Configure error handling based on debug mode
        if self.debug:
            self.show_stacktrace = True
            self.log_level = 'DEBUG'
        else:
            self.show_stacktrace = False  # Never show stack traces
            self.log_level = 'WARNING'
```

### TypeScript -- Debug Mode Configuration

```typescript
interface AppConfig {
  debug: boolean;
  showStackTraces: boolean;
  verboseErrors: boolean;
  exposeInternals: boolean;
}

function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'production'; // Default: production
  const debug = process.env.APP_DEBUG === 'true';

  if (debug && env === 'production') {
    console.error('FATAL: Debug mode cannot be enabled in production');
    process.exit(1);
  }

  return {
    debug,
    showStackTraces: debug,      // Only in debug
    verboseErrors: debug,        // Only in debug
    exposeInternals: false,      // Never expose internals, even in debug
  };
}

// Error handler uses config
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const config = loadConfig();

  res.status(500).json({
    error: 'Internal Server Error',
    // Only include details when debug is enabled
    ...(config.showStackTraces && { stack: err.stack }),
    ...(config.verboseErrors && { message: err.message }),
    // Always include correlation ID for support
    correlationId: req.headers['x-correlation-id'] || generateId(),
  });
}
```

---

## Pattern 8: Default Enabled CSRF Protection

### Theory

Cross-Site Request Forgery protection must be enabled by default. Any
state-changing request (POST, PUT, DELETE, PATCH) must include a valid
CSRF token. Disable CSRF only for authenticated API endpoints using
bearer tokens (not cookies).

### TypeScript -- CSRF Middleware

```typescript
import crypto from 'crypto';

function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for non-state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for Bearer token authentication (not cookie-based)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return next();
  }

  // Validate CSRF token for cookie-based sessions
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromSession = req.session?.csrfToken;

  if (!tokenFromHeader || !tokenFromSession) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  if (!crypto.timingSafeEqual(
    Buffer.from(tokenFromHeader as string),
    Buffer.from(tokenFromSession)
  )) {
    return res.status(403).json({ error: 'CSRF token invalid' });
  }

  next();
}

// Generate CSRF token for session
function generateCsrfToken(req: Request): string {
  const token = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = token;
  return token;
}
```

---

## Pattern 9: Safe Template Rendering by Default

### Theory

Template engines must auto-escape all output by default. Any unescaped
rendering must require an explicit, auditable function call. This prevents
stored and reflected XSS vulnerabilities.

### Python -- Jinja2 Secure Defaults

```python
from jinja2 import Environment, FileSystemLoader, select_autoescape

# SECURE: Auto-escape enabled by default
env = Environment(
    loader=FileSystemLoader('templates'),
    autoescape=select_autoescape(
        enabled_extensions=('html', 'htm', 'xml', 'svg'),
        default_for_string=True,  # Auto-escape even for strings
        default=True,             # Auto-escape for all templates
    ),
)

# Template usage -- output is automatically escaped
# {{ user.name }}  -->  &lt;script&gt;alert(1)&lt;/script&gt;

# INSECURE: Never disable auto-escape globally
# env = Environment(autoescape=False)  # NEVER DO THIS

# If raw HTML is needed, use the |safe filter explicitly
# {{ trusted_html|safe }}  -- requires explicit opt-in, auditable
```

### TypeScript -- Handlebars Secure Defaults

```typescript
import Handlebars from 'handlebars';

// Handlebars escapes by default with {{ }}
// Use {{{ }}} for unescaped -- these should be flagged in code review

// Register a helper that validates before allowing raw HTML
Handlebars.registerHelper('trustedHtml', function (content: string) {
  // Only allow pre-sanitized content from trusted sources
  if (!isSanitized(content)) {
    throw new Error('Unsanitized HTML cannot be rendered raw');
  }
  return new Handlebars.SafeString(content);
});
```

---

## Pattern 10: Secure Deserialization Defaults

### Theory

Deserialization of untrusted data is dangerous. Default to rejecting unknown
types, limiting depth, and using safe serialization formats (JSON) over
dangerous ones (Java ObjectInputStream, Python pickle, YAML load).

### Python -- Safe Deserialization

```python
import json
import yaml

# INSECURE: Never use pickle with untrusted data
# import pickle
# data = pickle.loads(untrusted_bytes)  # ARBITRARY CODE EXECUTION

# INSECURE: Never use yaml.load() with untrusted data
# data = yaml.load(untrusted_string)  # ARBITRARY CODE EXECUTION

# SECURE: Use yaml.safe_load()
data = yaml.safe_load(untrusted_string)  # Only basic types

# SECURE: Use JSON for untrusted data
data = json.loads(untrusted_string)

# SECURE: If you must deserialize, validate the schema
from pydantic import BaseModel, validator

class UserInput(BaseModel):
    name: str
    age: int
    email: str

    @validator('age')
    def age_must_be_reasonable(cls, v):
        if not 0 <= v <= 150:
            raise ValueError('Invalid age')
        return v

# Rejects unknown fields by default
user = UserInput.model_validate_json(untrusted_string)
```

### Java -- Safe Deserialization

```java
// INSECURE: Never deserialize untrusted data with ObjectInputStream
// ObjectInputStream ois = new ObjectInputStream(untrustedInput);
// Object obj = ois.readObject();  // ARBITRARY CODE EXECUTION

// SECURE: Use Jackson with safe defaults
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;

ObjectMapper mapper = new ObjectMapper();

// Reject unknown properties -- prevent mass assignment
mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true);

// Disable default typing -- prevents polymorphic deserialization attacks
// NEVER enable: mapper.enableDefaultTyping();  // CVE generator

// Deserialize to a specific, known type
UserDTO user = mapper.readValue(jsonString, UserDTO.class);
```

---

## Pattern 11: Input Validation Defaults

### TypeScript -- Strict Input Validation

```typescript
import { z } from 'zod';

// SECURE: Strict validation schema -- reject anything not explicitly defined
const CreateUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(254),
  age: z.number().int().min(13).max(150),
}).strict();  // Reject unknown fields

// Validation middleware
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

app.post('/api/users', validateBody(CreateUserSchema), createUser);
```

---

## Pattern 12: Password Policy Defaults

```typescript
interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
  preventCommonPasswords: boolean;
  preventUserInfoInPassword: boolean;
  bcryptRounds: number;
}

const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,           // NIST recommends 8+, 12 is safer
  maxLength: 128,          // Prevent DoS via bcrypt
  requireUppercase: false, // NIST 800-63B: composition rules not recommended
  requireLowercase: false,
  requireDigit: false,
  requireSpecialChar: false,
  preventCommonPasswords: true,  // Check against known breached passwords
  preventUserInfoInPassword: true,
  bcryptRounds: 12,        // Adaptive cost factor
};
```

---

## Pattern 13: Rate Limiting Defaults

```typescript
const RATE_LIMIT_DEFAULTS = {
  // General API
  api: { windowMs: 15 * 60 * 1000, max: 100 },

  // Authentication endpoints -- more restrictive
  auth: { windowMs: 15 * 60 * 1000, max: 5 },

  // Password reset -- very restrictive
  passwordReset: { windowMs: 60 * 60 * 1000, max: 3 },

  // File upload -- moderate
  upload: { windowMs: 60 * 60 * 1000, max: 20 },
};
```

---

## Pattern 14: Session Timeout Defaults

```typescript
const SESSION_DEFAULTS = {
  absoluteTimeout: 8 * 60 * 60 * 1000,   // 8 hours max session
  idleTimeout: 30 * 60 * 1000,            // 30 minutes idle
  renewalThreshold: 5 * 60 * 1000,        // Renew within 5 minutes of expiry
  maxConcurrentSessions: 3,                // Limit concurrent sessions
  bindToIP: false,                         // Consider for high-security apps
  regenerateOnLogin: true,                 // Prevent session fixation
  regenerateOnPrivilegeChange: true,       // Re-auth for sensitive actions
};
```

---

## Pattern 15: Logging Defaults (No PII)

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.creditCard',
      'req.body.ssn',
      'req.body.token',
      'user.email',
      'user.phone',
      'user.ip',
      '*.password',
      '*.secret',
      '*.token',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      // Do NOT log full headers or body
    }),
    err: pino.stdSerializers.err,
  },
});
```

### Go -- PII-Free Logging

```go
package logging

import (
    "regexp"
    "strings"

    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"
)

var piiPatterns = []*regexp.Regexp{
    regexp.MustCompile(`(?i)password\s*[:=]\s*\S+`),
    regexp.MustCompile(`(?i)token\s*[:=]\s*\S+`),
    regexp.MustCompile(`(?i)authorization\s*[:=]\s*\S+`),
    regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b`),
    regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),  // SSN pattern
}

func RedactPII(msg string) string {
    for _, pattern := range piiPatterns {
        msg = pattern.ReplaceAllString(msg, "[REDACTED]")
    }
    return msg
}

func NewSecureLogger() *zap.Logger {
    config := zap.NewProductionConfig()
    config.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)
    config.DisableCaller = true       // Do not log file paths
    config.DisableStacktrace = true   // Do not log stack traces
    config.OutputPaths = []string{"stdout"}

    logger, _ := config.Build()
    return logger
}
```

---

## Best Practices

1. **Default to deny**: Every access control, firewall rule, and permission
   check must deny by default. Require explicit allowlisting.

2. **Enforce TLS 1.2+ everywhere**: Set minimum TLS version on all servers,
   clients, and database connections. Reject plaintext.

3. **Use security middleware globally**: Apply security headers, CSRF
   protection, and rate limiting at the framework level, not per-route.

4. **Auto-escape all template output**: Configure template engines to escape
   HTML, JavaScript, and URL content by default. Require explicit opt-out.

5. **Disable debug mode by default**: Default to production-safe settings.
   Require explicit, environment-guarded opt-in for debug features.

6. **Set strict cookie flags**: HttpOnly=true, Secure=true, SameSite=Lax,
   and Path=/ must be the defaults for every cookie.

7. **Validate all input at the boundary**: Use strict schemas that reject
   unknown fields. Never trust client-provided data.

8. **Redact PII from logs**: Configure logging to redact passwords, tokens,
   emails, and other sensitive data before writing to any log sink.

9. **Fail fast on misconfiguration**: Validate configuration at startup.
   If security-critical settings are missing or invalid, refuse to start.

10. **Document security-relevant defaults**: Every secure default must be
    documented so that developers understand what protections are active and
    what happens if they override them.

---

## Anti-Patterns

1. **Allow-all CORS**: Setting `Access-Control-Allow-Origin: *` with
   credentials. This allows any website to make authenticated requests
   to your API. Use explicit origin allowlists.

2. **Debug mode in production**: Leaving `DEBUG=True` or equivalent in
   production. This exposes stack traces, environment variables, and
   internal application structure to attackers.

3. **Plaintext fallback**: Accepting HTTP when HTTPS is available. Even
   a "redirect to HTTPS" approach leaks the first request in plaintext.
   Use HSTS preloading to prevent this entirely.

4. **Cookie without security flags**: Setting cookies without HttpOnly,
   Secure, or SameSite. This makes session cookies vulnerable to XSS
   theft, network interception, and CSRF attacks.

5. **Disabled CSRF for convenience**: Removing CSRF protection because
   "the frontend handles it" or "we use AJAX." Cookie-based sessions
   always need CSRF protection regardless of request method.

6. **yaml.load() instead of yaml.safe_load()**: Using the unsafe YAML
   loader which allows arbitrary code execution through deserialization
   of Python objects embedded in YAML.

7. **Trust all proxies**: Setting `trust proxy = true` in Express.js
   instead of a specific number. This allows any client to spoof
   X-Forwarded-For headers and bypass IP-based rate limiting.

8. **No body size limit**: Accepting unlimited request bodies. This
   enables denial-of-service attacks through memory exhaustion. Always
   set explicit limits (e.g., 100KB for JSON, 10MB for uploads).

---

## Enforcement Checklist

Use this checklist during security reviews and deployment readiness checks.

### Authorization
- [ ] All routes default to deny (authenticated + authorized required)
- [ ] Public routes are explicitly listed and justified
- [ ] No blacklist-based access control

### Cookies
- [ ] All cookies set HttpOnly=true
- [ ] All cookies set Secure=true
- [ ] All cookies set SameSite=Lax or Strict
- [ ] Session cookies use __Host- prefix

### HTTP Headers
- [ ] Content-Security-Policy header is set
- [ ] Strict-Transport-Security header is set with preload
- [ ] X-Content-Type-Options: nosniff is set
- [ ] X-Frame-Options: DENY is set
- [ ] Server and X-Powered-By headers are removed

### TLS
- [ ] Minimum TLS version is 1.2
- [ ] Strong cipher suites only
- [ ] HTTP redirects to HTTPS
- [ ] HSTS preloading is enabled
- [ ] Database connections use TLS

### Framework Configuration
- [ ] Debug mode is disabled in production
- [ ] JSON body size is limited
- [ ] Trust proxy is set to specific count
- [ ] Auto-escaping is enabled in templates
- [ ] CSRF protection is enabled

### Input/Output
- [ ] All input is validated with strict schemas
- [ ] Unknown fields are rejected
- [ ] Output encoding matches context (HTML, URL, JS)
- [ ] Deserialization uses safe loaders only

### Operational
- [ ] Rate limiting is applied to all endpoints
- [ ] Authentication endpoints have stricter limits
- [ ] Session timeouts are configured
- [ ] Logs redact PII and secrets
- [ ] Firewall rules default to deny

### Deployment
- [ ] Configuration is validated at startup
- [ ] Application fails fast on missing security settings
- [ ] Security defaults are documented
- [ ] Override of secure defaults requires approval
