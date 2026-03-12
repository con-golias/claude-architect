# Security by Design

> **Domain:** Security > Foundations > Security by Design
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** --

## Why It Matters

Security added after the fact is expensive, incomplete, and fragile. A vulnerability discovered in production costs 30x more to fix than one caught in the requirements phase. Security by design means every architectural decision, every default configuration, every line of code assumes adversarial conditions from the start. It is not a bolt-on checklist -- it is a development philosophy where secure behavior is the default, not the exception. Applications that ship insecure-by-default generate breaches, compliance failures, and catastrophic trust loss. Applications designed secure-by-default dramatically reduce attack surface before a single penetration test is ever run.

---

## Core Principles

### 1. Secure-by-Default Philosophy

Applications MUST ship secure out of the box. Every feature, endpoint, and configuration MUST default to the most restrictive, secure option. Users opt into less security -- they never opt into more.

```
Secure-by-Default Spectrum:

WRONG (opt-in security):
┌──────────────────────────────────────────────────┐
│  App starts  -->  Everything open  -->  Admin     │
│                   No auth required     manually   │
│                   No encryption        locks down │
│                   All ports open       each item  │
└──────────────────────────────────────────────────┘

RIGHT (opt-out security):
┌──────────────────────────────────────────────────┐
│  App starts  -->  Everything locked -->  Admin    │
│                   Auth required         selectively│
│                   Encrypted            opens what │
│                   Ports closed          is needed  │
└──────────────────────────────────────────────────┘
```

#### Express.js -- Secure Defaults with Helmet

```typescript
// Express.js: ALWAYS use helmet for secure HTTP headers out of the box
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

// Helmet sets 11 security headers by default:
// - Content-Security-Policy
// - Cross-Origin-Embedder-Policy
// - Cross-Origin-Opener-Policy
// - Cross-Origin-Resource-Policy
// - X-DNS-Prefetch-Control
// - X-Frame-Options (DENY)
// - Strict-Transport-Security
// - X-Download-Options
// - X-Content-Type-Options (nosniff)
// - X-Permitted-Cross-Domain-Policies
// - Referrer-Policy
// - X-XSS-Protection (0, defers to CSP)
app.use(helmet());

// Tighten CSP beyond helmet defaults
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],           // No inline scripts, no CDN by default
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

// Rate limiting by default on all routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Disable fingerprinting
app.disable("x-powered-by");

// Parse JSON with size limit to prevent payload attacks
app.use(express.json({ limit: "1mb" }));
```

#### Django -- Security Middleware and Settings

```python
# settings.py -- Django secure defaults
# Django ships with strong security middleware; ALWAYS enable all of them.

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",    # MUST be first
    "django.middleware.csrf.CsrfViewMiddleware",        # CSRF protection
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # ...
]

# HTTPS enforcement
SECURE_SSL_REDIRECT = True                  # Redirect HTTP to HTTPS
SECURE_HSTS_SECONDS = 31536000              # 1 year HSTS
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Cookie security
SESSION_COOKIE_SECURE = True                # Cookies only over HTTPS
SESSION_COOKIE_HTTPONLY = True               # No JavaScript access
SESSION_COOKIE_SAMESITE = "Lax"             # CSRF mitigation
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True

# Content security
SECURE_CONTENT_TYPE_NOSNIFF = True          # Prevent MIME-type sniffing
X_FRAME_OPTIONS = "DENY"                    # Prevent clickjacking
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# Password validation -- enforce strong passwords by default
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Do NOT expose debug info in production
DEBUG = False
ALLOWED_HOSTS = ["app.example.com"]         # Explicit host whitelist
```

#### Go net/http -- Secure Server Configuration

```go
package main

import (
    "crypto/tls"
    "log"
    "net/http"
    "time"
)

func newSecureServer(handler http.Handler) *http.Server {
    tlsConfig := &tls.Config{
        // Enforce TLS 1.2 minimum -- reject TLS 1.0 and 1.1
        MinVersion: tls.VersionTLS12,

        // Prefer server cipher suites -- prevent downgrade attacks
        PreferServerCipherSuites: true,

        // Strong cipher suites only
        CipherSuites: []uint16{
            tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,
            tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256,
            tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
            tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
        },

        // Curve preferences
        CurvePreferences: []tls.CurveID{
            tls.CurveP256,
            tls.X25519,
        },
    }

    return &http.Server{
        Addr:              ":443",
        Handler:           handler,
        TLSConfig:         tlsConfig,
        ReadTimeout:       10 * time.Second,   // Prevent slowloris
        ReadHeaderTimeout: 5 * time.Second,
        WriteTimeout:      15 * time.Second,
        IdleTimeout:       120 * time.Second,
        MaxHeaderBytes:    1 << 20,            // 1 MB max header size
    }
}

// securityHeaders middleware -- apply to all routes
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("Content-Security-Policy", "default-src 'self'")
        w.Header().Set("Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        w.Header().Set("Permissions-Policy",
            "camera=(), microphone=(), geolocation=()")
        next.ServeHTTP(w, r)
    })
}

func main() {
    mux := http.NewServeMux()
    // Routes here...
    srv := newSecureServer(securityHeaders(mux))
    log.Fatal(srv.ListenAndServeTLS("cert.pem", "key.pem"))
}
```

#### Spring Boot -- application.yml Secure Defaults

```yaml
# application.yml -- Spring Boot secure defaults
server:
  ssl:
    enabled: true
    protocol: TLS
    enabled-protocols: TLSv1.3,TLSv1.2      # No TLS 1.0/1.1
    ciphers:
      - TLS_AES_256_GCM_SHA384
      - TLS_AES_128_GCM_SHA256
      - TLS_CHACHA20_POLY1305_SHA256
  servlet:
    session:
      cookie:
        secure: true
        http-only: true
        same-site: lax
      timeout: 30m                           # Session timeout
  error:
    include-stacktrace: never                # Never leak stack traces
    include-message: never

spring:
  security:
    headers:
      content-security-policy: "default-src 'self'"
      frame-options: DENY
      content-type-options: nosniff
  jackson:
    default-property-inclusion: non_null     # Do not serialize nulls
    serialization:
      fail-on-empty-beans: true
```

#### ASP.NET -- Secure Configuration

```csharp
// Program.cs -- ASP.NET Core secure defaults
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});

builder.Services.AddHttpsRedirection(options =>
{
    options.HttpsPort = 443;
});

builder.Services.AddAntiforgery(options =>
{
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
});

var app = builder.Build();

app.UseHsts();
app.UseHttpsRedirection();

// Security headers middleware
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy",
        "camera=(), microphone=(), geolocation=()");
    await next();
});
```

---

### 2. OWASP ASVS (Application Security Verification Standard) 4.0

ASVS defines three verification levels that map to application risk. Use ASVS as a structured security requirements checklist -- not as an afterthought audit.

```
ASVS Verification Levels:

Level 1 -- OPPORTUNISTIC
├── Target: All applications (minimum baseline)
├── Effort: Low -- automated tools + basic review
├── Covers: Top 10 vulnerabilities, basic authentication, session management
└── Use when: Low-risk internal tools, prototypes moving to production

Level 2 -- STANDARD
├── Target: Applications handling sensitive data
├── Effort: Medium -- manual review + architecture analysis
├── Covers: All L1 + access control, cryptography, error handling, logging
└── Use when: SaaS products, e-commerce, healthcare, financial apps

Level 3 -- ADVANCED
├── Target: Critical infrastructure, high-value targets
├── Effort: High -- deep code review, penetration testing, threat modeling
├── Covers: All L2 + anti-tampering, advanced crypto, secure SDLC
└── Use when: Banking core, government, defense, critical infrastructure
```

#### ASVS Chapters Mapped to Development Activities

```
ASVS Chapter                  Development Activity
─────────────────────────────────────────────────────────────────
V1  Architecture              Architecture review, threat modeling
V2  Authentication            Login, MFA, password policy implementation
V3  Session Management        Session handling, token lifecycle
V4  Access Control            RBAC/ABAC implementation, authorization
V5  Validation/Encoding       Input validation, output encoding
V6  Cryptography              Encryption at rest, in transit, key mgmt
V7  Error/Logging             Error handling, security event logging
V8  Data Protection           PII handling, data classification
V9  Communication             TLS configuration, certificate pinning
V10 Malicious Code            Dependency scanning, code integrity
V11 Business Logic            Business rule validation, anti-automation
V12 Files/Resources           File upload, resource limits, DoS prevention
V13 API/Web Services          API auth, input validation, rate limiting
V14 Configuration             Secure defaults, hardening, deployment
```

#### Using ASVS as Requirements Checklist

```typescript
// Example: Implementing ASVS V2 (Authentication) requirements

// V2.1.1 -- Password must be at least 12 characters
// V2.1.2 -- Password must allow at least 64 characters
// V2.1.7 -- Passwords must be checked against breached password lists
// V2.1.9 -- No password composition rules beyond minimum length

interface PasswordPolicy {
  minLength: number;       // ASVS V2.1.1: minimum 12
  maxLength: number;       // ASVS V2.1.2: at least 64
  checkBreached: boolean;  // ASVS V2.1.7: check against breach lists
}

const ASVS_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  checkBreached: true,
};

async function validatePassword(
  password: string,
  policy: PasswordPolicy = ASVS_PASSWORD_POLICY
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (password.length > policy.maxLength) {
    errors.push(`Password must not exceed ${policy.maxLength} characters`);
  }

  // V2.1.7 -- Check against breached passwords (HaveIBeenPwned API)
  if (policy.checkBreached) {
    const isBreached = await checkBreachedPassword(password);
    if (isBreached) {
      errors.push("This password has appeared in a data breach");
    }
  }

  return { valid: errors.length === 0, errors };
}
```

---

### 3. CISA Secure by Design Principles (2024/2025)

CISA's Secure by Design guidance establishes three core principles. Treat these as non-negotiable engineering requirements.

```
CISA Secure by Design -- Three Principles:

1. TAKE OWNERSHIP OF CUSTOMER SECURITY OUTCOMES
   ├── Ship products that are secure out of the box
   ├── Do not require customers to configure security
   ├── Eliminate default passwords entirely
   ├── Provide secure upgrade paths
   └── Measure and publish security metrics

2. EMBRACE RADICAL TRANSPARENCY AND ACCOUNTABILITY
   ├── Publish CVEs for all known vulnerabilities
   ├── Provide complete, accurate CWE classifications
   ├── Maintain public vulnerability disclosure policies
   ├── Include SBOMs (Software Bill of Materials)
   └── Report security metrics to leadership

3. LEAD FROM THE TOP
   ├── Make security a business priority, not just engineering
   ├── Allocate budget for security engineering
   ├── Designate security-focused engineering leadership
   ├── Build security into performance reviews
   └── Invest in security training for all developers
```

#### Implementing CISA Principles in Code

```typescript
// CISA Principle 1: Eliminate default passwords
// WRONG: shipping with admin/admin
const DEFAULT_CONFIG = {
  // NEVER do this
  adminUser: "admin",
  adminPassword: "admin",
};

// RIGHT: force credential setup on first run
import crypto from "crypto";

interface SetupConfig {
  requirePasswordChange: boolean;
  minPasswordEntropy: number;
  disableDefaultAccounts: boolean;
}

const SECURE_SETUP: SetupConfig = {
  requirePasswordChange: true,
  minPasswordEntropy: 60,     // bits of entropy
  disableDefaultAccounts: true,
};

function generateInitialApiKey(): string {
  // Generate cryptographically secure key -- never use defaults
  return crypto.randomBytes(32).toString("base64url");
}

async function firstRunSetup(): Promise<void> {
  const hasBeenConfigured = await checkSetupComplete();
  if (!hasBeenConfigured) {
    // Application REFUSES to start until admin sets up credentials
    throw new Error(
      "Initial setup required. Run 'app setup' to configure admin credentials."
    );
  }
}
```

```python
# CISA Principle 2: SBOM generation for transparency
# Generate SBOM during build process

# requirements.txt -> SBOM via cyclonedx-bom
# pip install cyclonedx-bom
# cyclonedx-py requirements -i requirements.txt -o sbom.json --format json

# Dockerfile: include SBOM in image metadata
# FROM python:3.12-slim
# COPY sbom.json /app/sbom.json
# LABEL org.opencontainers.image.description="App with SBOM"
# LABEL sbom.format="CycloneDX"
# LABEL sbom.path="/app/sbom.json"

# Programmatic SBOM verification at startup
import json
import hashlib
from pathlib import Path

def verify_sbom_integrity(sbom_path: str, expected_hash: str) -> bool:
    """Verify SBOM has not been tampered with since build."""
    content = Path(sbom_path).read_bytes()
    actual_hash = hashlib.sha256(content).hexdigest()
    return actual_hash == expected_hash

def get_dependency_list(sbom_path: str) -> list[dict]:
    """Extract dependency list from CycloneDX SBOM."""
    with open(sbom_path) as f:
        sbom = json.load(f)
    return [
        {
            "name": comp.get("name"),
            "version": comp.get("version"),
            "purl": comp.get("purl"),
        }
        for comp in sbom.get("components", [])
    ]
```

---

### 4. Security Requirements Engineering

Derive security requirements from business requirements systematically. Every user story must generate corresponding security requirements, acceptance criteria, and test cases.

```
Business Requirement --> Security Requirements Pipeline:

User Story
  "As a customer, I want to pay with my credit card"
      │
      ├── Security Requirement 1: Card data encrypted in transit (TLS 1.2+)
      ├── Security Requirement 2: Card data never stored (PCI DSS compliance)
      ├── Security Requirement 3: Payment tokenized via payment processor
      ├── Security Requirement 4: Transaction logged for audit (no card data in logs)
      └── Security Requirement 5: Rate-limited to prevent brute-force card testing
            │
            ├── Acceptance Criteria:
            │     - All payment API calls use HTTPS (reject HTTP)
            │     - Card number never appears in application logs
            │     - Payment token is a non-reversible reference
            │     - Max 5 payment attempts per user per hour
            │
            └── Test Cases:
                  - Verify HTTP requests to /api/payment return 301 to HTTPS
                  - Grep all log output for PAN patterns (fail if found)
                  - Attempt 6 payments in 1 hour, verify 6th is rejected
                  - Verify payment token cannot be decoded to card number
```

#### Security Requirements Template

```typescript
// Structured security requirement linked to user story

interface SecurityRequirement {
  id: string;
  userStoryRef: string;
  category: "authentication" | "authorization" | "data-protection"
    | "input-validation" | "cryptography" | "logging" | "availability";
  asvsRef: string;          // ASVS chapter reference
  requirement: string;
  acceptanceCriteria: string[];
  testCases: TestCase[];
  priority: "critical" | "high" | "medium" | "low";
}

interface TestCase {
  id: string;
  description: string;
  type: "unit" | "integration" | "security-scan" | "penetration";
  automated: boolean;
}

// Example: Deriving security requirements from a user story
const registrationSecurityReqs: SecurityRequirement[] = [
  {
    id: "SEC-REG-001",
    userStoryRef: "US-042: As a user, I want to register an account",
    category: "authentication",
    asvsRef: "V2.1",
    requirement: "Passwords MUST be hashed with bcrypt (cost 12) or Argon2id",
    acceptanceCriteria: [
      "No plaintext passwords stored in database",
      "Password hash uses bcrypt cost >= 12 or Argon2id",
      "Password hash changes when user updates password",
    ],
    testCases: [
      {
        id: "TC-SEC-REG-001-A",
        description: "Verify password column contains bcrypt/argon2 hash, not plaintext",
        type: "integration",
        automated: true,
      },
      {
        id: "TC-SEC-REG-001-B",
        description: "Verify identical passwords produce different hashes (salt)",
        type: "unit",
        automated: true,
      },
    ],
    priority: "critical",
  },
  {
    id: "SEC-REG-002",
    userStoryRef: "US-042: As a user, I want to register an account",
    category: "input-validation",
    asvsRef: "V5.1",
    requirement: "All registration input MUST be validated and sanitized server-side",
    acceptanceCriteria: [
      "Email validated against RFC 5322",
      "Username restricted to alphanumeric + underscore, 3-30 chars",
      "No HTML/script injection possible via any field",
    ],
    testCases: [
      {
        id: "TC-SEC-REG-002-A",
        description: "Submit XSS payload in name field, verify it is rejected or escaped",
        type: "security-scan",
        automated: true,
      },
    ],
    priority: "high",
  },
];
```

---

### 5. Secure Architecture Patterns

#### Security Gateway Pattern

```
                    ┌─────────────────────────┐
  Internet ──────>  │    Security Gateway      │
                    │  (API Gateway / WAF)      │
                    │                           │
                    │  - TLS termination        │
                    │  - Authentication         │
                    │  - Rate limiting          │
                    │  - Input validation       │
                    │  - IP allowlisting        │
                    │  - Request size limits    │
                    └─────────┬───────────────┘
                              │ (internal, trusted)
                    ┌─────────▼───────────────┐
                    │    Application Services   │
                    │    (no direct external    │
                    │     access allowed)       │
                    └──────────────────────────┘
```

```go
// Security gateway middleware chain in Go
package gateway

import (
    "net/http"
    "sync"
    "time"
)

// RateLimiter -- per-IP rate limiting
type RateLimiter struct {
    mu       sync.Mutex
    visitors map[string]*visitor
    rate     int
    window   time.Duration
}

type visitor struct {
    count    int
    lastSeen time.Time
}

func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
    return &RateLimiter{
        visitors: make(map[string]*visitor),
        rate:     rate,
        window:   window,
    }
}

func (rl *RateLimiter) Allow(ip string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    v, exists := rl.visitors[ip]
    if !exists || time.Since(v.lastSeen) > rl.window {
        rl.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
        return true
    }
    v.count++
    v.lastSeen = time.Now()
    return v.count <= rl.rate
}

// SecurityGateway composes all security checks
func SecurityGateway(next http.Handler) http.Handler {
    limiter := NewRateLimiter(100, 15*time.Minute)

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. Rate limiting
        if !limiter.Allow(r.RemoteAddr) {
            http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
            return
        }

        // 2. Request size limit (1 MB)
        r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

        // 3. Required headers check
        if r.Header.Get("Content-Type") == "" && r.Method != http.MethodGet {
            http.Error(w, "Content-Type required", http.StatusBadRequest)
            return
        }

        // 4. Security response headers
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")

        next.ServeHTTP(w, r)
    })
}
```

#### Defense in Depth Architecture

```
Defense in Depth -- Multiple Independent Security Layers:

Layer 1: PERIMETER
├── WAF (Web Application Firewall)
├── DDoS protection (Cloudflare, AWS Shield)
├── TLS termination
└── IP reputation filtering

Layer 2: NETWORK
├── VPC isolation
├── Network segmentation (public/private subnets)
├── Security groups (port-level firewall)
└── mTLS between services

Layer 3: APPLICATION
├── Authentication (OAuth 2.0, OIDC)
├── Authorization (RBAC/ABAC per endpoint)
├── Input validation (server-side, always)
├── Output encoding (prevent XSS)
└── CSRF protection

Layer 4: DATA
├── Encryption at rest (AES-256)
├── Encryption in transit (TLS 1.2+)
├── Column-level encryption for PII
├── Database access control (RLS)
└── Data masking for non-production

Layer 5: MONITORING
├── Security event logging (SIEM)
├── Intrusion detection (IDS/IPS)
├── Anomaly detection
├── Alerting on suspicious patterns
└── Audit trail for compliance
```

#### Zero Trust Architecture in Application Design

```
Zero Trust Principles Applied to Applications:

1. NEVER TRUST, ALWAYS VERIFY
   - Every request is authenticated, even internal service-to-service
   - No implicit trust based on network location
   - Validate JWT/token on every request, not just at the gateway

2. LEAST PRIVILEGE ACCESS
   - Tokens scoped to minimum required permissions
   - Short-lived tokens (15-minute access tokens)
   - No persistent sessions for service accounts

3. ASSUME BREACH
   - Encrypt data at rest even in internal databases
   - Log all access for forensic capability
   - Segment services to limit blast radius
```

```typescript
// Zero trust: verify every request, even internal service-to-service
import jwt from "jsonwebtoken";

interface ServiceIdentity {
  serviceId: string;
  permissions: string[];
  issuedAt: number;
  expiresAt: number;
}

// Every internal service call MUST include a signed identity token
async function verifyServiceCall(
  token: string,
  requiredPermission: string
): Promise<ServiceIdentity> {
  // 1. Verify token signature (never skip)
  const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, {
    algorithms: ["RS256"],       // Asymmetric only -- never HS256 for service tokens
    issuer: "auth-service",
    maxAge: "15m",               // Reject tokens older than 15 minutes
  }) as ServiceIdentity;

  // 2. Verify permission scope
  if (!decoded.permissions.includes(requiredPermission)) {
    throw new Error(
      `Service ${decoded.serviceId} lacks permission: ${requiredPermission}`
    );
  }

  // 3. Verify token is not revoked (check against revocation list)
  const isRevoked = await checkTokenRevocation(decoded.serviceId, decoded.issuedAt);
  if (isRevoked) {
    throw new Error("Token has been revoked");
  }

  return decoded;
}
```

#### Microservice Security Boundaries

```
Microservice Security Boundary Pattern:

┌──────────────────────────────────────────────────────────┐
│                    API Gateway                            │
│              (External Authentication)                    │
└────────┬──────────────┬──────────────┬──────────────────┘
         │              │              │
    ┌────▼────┐   ┌─────▼────┐   ┌────▼─────┐
    │ User    │   │ Payment  │   │ Order    │
    │ Service │   │ Service  │   │ Service  │
    │         │   │          │   │          │
    │ Own DB  │   │ Own DB   │   │ Own DB   │
    └─────────┘   └──────────┘   └──────────┘
         │              │              │
    Rules:
    - Each service owns its database (no shared DBs)
    - Inter-service calls use mTLS + scoped tokens
    - Each service validates authorization independently
    - Sensitive data (PII, payment) stays in its service boundary
    - Events published to message bus contain IDs, not data
```

---

### 6. Security in the SDLC

Map security activities to every phase of the software development lifecycle. Security is not a phase -- it is present at every stage.

```
SDLC Phase        Security Activities
───────────────────────────────────────────────────────────────

REQUIREMENTS       - Security requirements derivation
                   - Abuse case / misuse case analysis
                   - Compliance requirements identification
                   - Data classification (public/internal/confidential/restricted)
                   - ASVS level selection (L1/L2/L3)

DESIGN             - Threat modeling (STRIDE, PASTA)
                   - Secure architecture review
                   - Attack surface analysis
                   - Security pattern selection
                   - Trust boundary identification
                   - Data flow diagrams with security annotations

IMPLEMENTATION     - Secure coding standards enforcement
                   - Static analysis (SAST) in IDE and CI
                   - Dependency scanning (SCA)
                   - Secret detection (pre-commit hooks)
                   - Code review with security checklist
                   - Security unit tests

TESTING            - Dynamic analysis (DAST)
                   - Interactive analysis (IAST)
                   - Penetration testing
                   - Fuzzing critical parsers/inputs
                   - Security regression tests
                   - API security testing

DEPLOYMENT         - Infrastructure as Code security scanning
                   - Container image scanning
                   - Configuration hardening verification
                   - Secret rotation
                   - Deployment approval gates
                   - SBOM generation and signing

OPERATIONS         - Runtime application self-protection (RASP)
                   - Security monitoring and alerting (SIEM)
                   - Incident response procedures
                   - Vulnerability management and patching
                   - Periodic penetration testing
                   - Security metrics and reporting
```

```python
# Example: Security testing integrated into CI/CD pipeline
# .github/workflows/security.yml equivalent as Python config

SECURITY_PIPELINE = {
    "stages": [
        {
            "name": "pre-commit",
            "tools": [
                {"name": "gitleaks", "purpose": "secret detection"},
                {"name": "pre-commit hooks", "purpose": "linting, formatting"},
            ],
            "blocks_commit": True,
        },
        {
            "name": "build",
            "tools": [
                {"name": "bandit", "purpose": "Python SAST"},
                {"name": "semgrep", "purpose": "multi-language SAST"},
                {"name": "safety", "purpose": "dependency vulnerability check"},
                {"name": "trivy", "purpose": "container image scanning"},
            ],
            "blocks_merge": True,
        },
        {
            "name": "test",
            "tools": [
                {"name": "OWASP ZAP", "purpose": "DAST against staging"},
                {"name": "custom security tests", "purpose": "auth/authz regression"},
            ],
            "blocks_deploy": True,
        },
        {
            "name": "deploy",
            "tools": [
                {"name": "checkov", "purpose": "IaC security scanning"},
                {"name": "cosign", "purpose": "container image signing"},
                {"name": "cyclonedx", "purpose": "SBOM generation"},
            ],
            "blocks_release": True,
        },
    ]
}
```

---

### 7. Privacy by Design

Privacy by Design defines seven foundational principles. Apply these at the architecture level, not as an afterthought.

```
Privacy by Design -- 7 Foundational Principles:

1. PROACTIVE NOT REACTIVE
   Build privacy into the system before issues arise.
   Do not wait for a privacy breach to add protections.

2. PRIVACY AS THE DEFAULT
   Personal data is automatically protected.
   Users do not need to take action to protect their privacy.

3. PRIVACY EMBEDDED INTO DESIGN
   Privacy is a core component of architecture, not an add-on.
   It cannot be separated from the system.

4. FULL FUNCTIONALITY (POSITIVE-SUM)
   Privacy does not come at the cost of functionality.
   Achieve both privacy and usability.

5. END-TO-END SECURITY (FULL LIFECYCLE)
   Protect data from collection to deletion.
   Secure retention, processing, and disposal.

6. VISIBILITY AND TRANSPARENCY
   Users can verify that privacy promises are kept.
   Publish clear, understandable privacy policies.

7. RESPECT FOR USER PRIVACY
   User-centric design. Give users control over their data.
   Consent must be informed, specific, and revocable.
```

#### Data Minimization in Code

```typescript
// WRONG: Collecting everything "just in case"
interface UserRegistrationBad {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;      // Not needed for registration
  phoneNumber: string;      // Not needed for registration
  homeAddress: string;      // Not needed for registration
  ssn: string;              // Absolutely not needed
  motherMaidenName: string; // Absolutely not needed
  income: number;           // Not needed for registration
}

// RIGHT: Collect ONLY what is necessary for the function
interface UserRegistrationGood {
  email: string;
  password: string;
  displayName: string;     // Minimum viable identity
}

// Additional data collected ONLY when needed and with explicit consent
interface ShippingInfo {
  // Collected only when user makes a purchase
  recipientName: string;
  streetAddress: string;
  city: string;
  postalCode: string;
  country: string;
}
```

#### Anonymization and Pseudonymization

```python
import hashlib
import secrets
from datetime import datetime

# Pseudonymization: replace direct identifiers with reversible tokens
# (Data can be re-identified with a separate key)

class Pseudonymizer:
    def __init__(self, secret_key: str):
        self._key = secret_key.encode()

    def pseudonymize(self, identifier: str) -> str:
        """Replace identifier with HMAC-based pseudonym."""
        return hashlib.hmac(
            self._key, identifier.encode(), hashlib.sha256
        ).hexdigest()[:16]

    def pseudonymize_record(self, record: dict) -> dict:
        """Pseudonymize PII fields in a record."""
        pii_fields = {"email", "name", "phone", "ip_address"}
        result = {}
        for key, value in record.items():
            if key in pii_fields and isinstance(value, str):
                result[key] = self.pseudonymize(value)
            else:
                result[key] = value
        return result


# Anonymization: irreversible -- data cannot be re-identified

def anonymize_for_analytics(records: list[dict]) -> list[dict]:
    """Anonymize user data for analytics. Irreversible."""
    anonymized = []
    for record in records:
        anonymized.append({
            # Remove direct identifiers entirely
            # Generalize quasi-identifiers
            "age_range": _generalize_age(record.get("age")),
            "region": _generalize_location(record.get("zip_code")),
            "purchase_amount": record.get("purchase_amount"),
            "product_category": record.get("product_category"),
            "timestamp": _generalize_timestamp(record.get("timestamp")),
        })
    return anonymized


def _generalize_age(age: int | None) -> str:
    """Convert exact age to range (k-anonymity)."""
    if age is None:
        return "unknown"
    if age < 18: return "under-18"
    if age < 25: return "18-24"
    if age < 35: return "25-34"
    if age < 45: return "35-44"
    if age < 55: return "45-54"
    if age < 65: return "55-64"
    return "65+"


def _generalize_location(zip_code: str | None) -> str:
    """Reduce zip code precision (first 3 digits only)."""
    if not zip_code or len(zip_code) < 3:
        return "unknown"
    return zip_code[:3] + "XX"


def _generalize_timestamp(ts: datetime | None) -> str | None:
    """Reduce timestamp to date only (remove time)."""
    if ts is None:
        return None
    return ts.strftime("%Y-%m-%d")


# Data retention: automatically delete data after retention period

async def enforce_data_retention(db, retention_days: int = 365) -> int:
    """Delete personal data older than retention period. Run daily."""
    result = await db.execute(
        """
        DELETE FROM user_activity_logs
        WHERE created_at < NOW() - INTERVAL '%s days'
        RETURNING id
        """,
        retention_days,
    )
    deleted_count = len(result)
    log.info(f"Data retention: deleted {deleted_count} records older than {retention_days} days")
    return deleted_count
```

---

### 8. Secure Defaults in Code

#### Default-Deny Authorization

```typescript
// WRONG: default-allow -- check for deny
function checkAccessBad(user: User, resource: Resource): boolean {
  // Dangerous: if we forget to add a deny rule, access is granted
  if (DENY_LIST.includes(user.role)) {
    return false;
  }
  return true; // Default: allow
}

// RIGHT: default-deny -- check for explicit allow
function checkAccess(user: User, resource: Resource): boolean {
  // Safe: if we forget to add an allow rule, access is denied
  const permission = `${resource.type}:${resource.action}`;

  const allowedPermissions = ROLE_PERMISSIONS[user.role];
  if (!allowedPermissions) {
    return false; // Unknown role: deny
  }

  return allowedPermissions.includes(permission); // Explicit allow only
}

// Role permissions: explicitly enumerate what IS allowed
const ROLE_PERMISSIONS: Record<string, string[]> = {
  viewer: ["document:read", "document:list"],
  editor: ["document:read", "document:list", "document:write"],
  admin: [
    "document:read", "document:list", "document:write", "document:delete",
    "user:read", "user:list", "user:write",
  ],
  // Any role not listed here: zero permissions (default deny)
};
```

#### Secure Cookie Defaults

```typescript
// ALWAYS set all security flags on cookies
import { CookieOptions } from "express";

const SECURE_COOKIE_DEFAULTS: CookieOptions = {
  httpOnly: true,        // Prevent XSS from reading cookie
  secure: true,          // HTTPS only
  sameSite: "lax",       // CSRF mitigation (use "strict" for sensitive ops)
  maxAge: 3600 * 1000,   // 1 hour (not indefinite)
  path: "/",             // Scope to application root
  domain: ".example.com",
  // signed: true,       // Use with cookie-parser secret
};

// Helper that enforces secure defaults
function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  overrides?: Partial<CookieOptions>
): void {
  // Merge with secure defaults -- overrides cannot remove httpOnly or secure
  const options: CookieOptions = {
    ...SECURE_COOKIE_DEFAULTS,
    ...overrides,
    httpOnly: true,  // ALWAYS true, cannot be overridden
    secure: true,    // ALWAYS true, cannot be overridden
  };
  res.cookie(name, value, options);
}
```

#### Minimum TLS Version Enforcement

```go
package main

import (
    "crypto/tls"
    "fmt"
    "net/http"
)

// EnforceTLSVersion middleware rejects connections below minimum TLS version
// Note: TLS version enforcement is best done at the server TLS config level.
// This middleware provides an additional application-level check.
func EnforceTLSVersion(minVersion uint16) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if r.TLS == nil {
                http.Error(w, "TLS required", http.StatusForbidden)
                return
            }
            if r.TLS.Version < minVersion {
                http.Error(w,
                    fmt.Sprintf("TLS %s or higher required", tlsVersionName(minVersion)),
                    http.StatusForbidden,
                )
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

func tlsVersionName(v uint16) string {
    switch v {
    case tls.VersionTLS12:
        return "1.2"
    case tls.VersionTLS13:
        return "1.3"
    default:
        return "unknown"
    }
}
```

#### Encrypted Connections by Default

```python
# Database connections: ALWAYS require TLS
import ssl
import asyncpg

async def create_secure_db_pool():
    """Create database connection pool with TLS required."""
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ssl_ctx.check_hostname = True
    ssl_ctx.verify_mode = ssl.CERT_REQUIRED

    # Load CA certificate for database server verification
    ssl_ctx.load_verify_locations("/etc/ssl/certs/db-ca.pem")

    pool = await asyncpg.create_pool(
        host="db.internal.example.com",
        port=5432,
        database="appdb",
        user="app_service",
        password=get_secret("DB_PASSWORD"),   # From secrets manager
        ssl=ssl_ctx,                          # TLS required
        min_size=5,
        max_size=20,
        command_timeout=30,
    )
    return pool


# Redis: require TLS
import redis

def create_secure_redis_client():
    """Create Redis client with TLS required."""
    return redis.Redis(
        host="redis.internal.example.com",
        port=6380,
        password=get_secret("REDIS_PASSWORD"),
        ssl=True,
        ssl_cert_reqs="required",
        ssl_ca_certs="/etc/ssl/certs/redis-ca.pem",
        decode_responses=True,
        socket_connect_timeout=5,
        retry_on_timeout=True,
    )
```

---

### 9. Security Guardrails vs Gates

Guardrails enable developers to move fast while staying secure. Gates block progress and create friction. Prefer guardrails over gates wherever possible.

```
GATES (Blocking)                    GUARDRAILS (Enabling)
─────────────────                   ────────────────────
Manual security review for every    Automated SAST in CI that
PR -- creates bottleneck            flags issues inline

Security team approves every        Pre-configured secure
dependency -- slow                  dependency allowlist

Penetration test before every       Continuous DAST running
release -- delays launch            against staging

Security sign-off on every          Security linters in IDE
design doc -- blocks progress       that catch issues as you type

Manual code audit quarterly         Automated policy-as-code
                                    checks on every commit
```

#### Implementing Guardrails

```yaml
# .github/workflows/security-guardrails.yml
# Automated security checks that run on every PR -- guardrails, not gates

name: Security Guardrails
on:
  pull_request:
    branches: [main]

jobs:
  secret-detection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        # Blocks PR only if secrets are detected -- clear, actionable

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/typescript
            p/python
          # Annotates PR with inline comments -- developer sees issues in context

  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH
          exit-code: 1               # Block only on critical/high

  iac-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: ./infrastructure
          soft_fail: false
```

```typescript
// Developer-facing guardrail: secure-by-default HTTP client
// Wrap standard HTTP client to enforce security policies

import https from "https";

interface SecureClientOptions {
  allowHttp: boolean;
  maxRedirects: number;
  timeoutMs: number;
  allowInternalIps: boolean;
}

const GUARDRAIL_DEFAULTS: SecureClientOptions = {
  allowHttp: false,         // Force HTTPS
  maxRedirects: 5,          // Prevent redirect loops
  timeoutMs: 10_000,        // 10-second timeout
  allowInternalIps: false,  // Prevent SSRF
};

function createSecureHttpClient(overrides?: Partial<SecureClientOptions>) {
  const opts = { ...GUARDRAIL_DEFAULTS, ...overrides };

  return {
    async fetch(url: string, init?: RequestInit): Promise<Response> {
      const parsed = new URL(url);

      // Guardrail: block HTTP unless explicitly allowed
      if (parsed.protocol === "http:" && !opts.allowHttp) {
        throw new Error(
          "HTTP requests are blocked by default. Use HTTPS or set allowHttp: true."
        );
      }

      // Guardrail: block requests to internal IPs (SSRF prevention)
      if (!opts.allowInternalIps) {
        const isInternal = await isInternalAddress(parsed.hostname);
        if (isInternal) {
          throw new Error(
            `Request to internal address ${parsed.hostname} blocked (SSRF prevention).`
          );
        }
      }

      // Guardrail: enforce timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

      try {
        return await fetch(url, {
          ...init,
          signal: controller.signal,
          redirect: opts.maxRedirects > 0 ? "follow" : "error",
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

async function isInternalAddress(hostname: string): Promise<boolean> {
  // Check for RFC 1918 / loopback / link-local addresses
  const internalPatterns = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^0\./,
    /^localhost$/i,
  ];
  return internalPatterns.some((p) => p.test(hostname));
}
```

---

## Best Practices

1. **ALWAYS default to deny** -- access, network connections, permissions, features MUST be explicitly enabled, never implicitly available
2. **ALWAYS validate input server-side** -- client-side validation is UX, server-side validation is security. Never trust client input for security decisions
3. **ALWAYS encrypt data in transit and at rest** -- enforce TLS 1.2+ for all connections, AES-256 for stored data, never store sensitive data in plaintext
4. **ALWAYS use parameterized queries** -- never concatenate user input into SQL, LDAP, or OS commands. Use ORM or prepared statements for every database query
5. **ALWAYS implement authentication before authorization** -- verify identity first, then check permissions. Never skip either step
6. **ALWAYS log security events** -- authentication successes and failures, authorization denials, input validation failures, configuration changes. Include who, what, when, where -- never log secrets or PII
7. **ALWAYS apply the principle of least privilege** -- database users, API keys, service accounts, IAM roles. Grant the minimum permissions required, audit regularly
8. **ALWAYS keep dependencies updated** -- automate dependency scanning (Dependabot, Renovate). Patch critical vulnerabilities within 48 hours, high within 1 week
9. **ALWAYS use ASVS as a requirements baseline** -- select the appropriate verification level (L1/L2/L3) early in the project. Map every ASVS requirement to a test case
10. **ALWAYS separate security guardrails from gates** -- automate what can be automated (SAST, SCA, secret detection). Reserve manual review for threat modeling and architecture decisions

---

## Anti-Patterns / Common Mistakes

| # | Anti-Pattern | Symptom | Fix |
|---|-------------|---------|-----|
| 1 | Security as afterthought | Security review only before release, finding critical issues late | Integrate security from requirements phase. Threat model during design. Run SAST in every CI build |
| 2 | Security through obscurity | Relying on hidden URLs, obfuscated code, or secret algorithms as primary defense | Use proven cryptographic algorithms. Assume attackers know your architecture. Security MUST NOT depend on secrecy of implementation |
| 3 | Implicit trust of internal services | Internal microservices call each other without authentication or authorization | Implement mTLS and scoped tokens for all service-to-service communication. Apply zero trust principles |
| 4 | Overly permissive defaults | Application ships with debug mode on, CORS allow-all, no rate limiting, admin panel publicly accessible | Configure restrictive defaults. Require explicit opt-in for permissive settings. Enforce via CI policy checks |
| 5 | Collecting unnecessary data | Storing SSN, date of birth, home address "just in case" for a newsletter signup | Apply data minimization. Collect only what is needed for the immediate function. Delete data when no longer required |
| 6 | Shared database credentials | All microservices use the same database user and password, so a breach in one service compromises all data | One database user per service with least-privilege grants. Rotate credentials. Use short-lived IAM tokens where available |
| 7 | Hardcoded secrets in source code | API keys, database passwords, encryption keys committed to version control | Use secrets managers (Vault, AWS Secrets Manager). Scan for secrets in pre-commit hooks (gitleaks). Rotate any exposed secret immediately |
| 8 | No security testing in CI/CD | Relying entirely on periodic manual penetration tests. Vulnerabilities ship to production between test cycles | Add SAST, SCA, and secret detection to every CI pipeline. Run DAST against staging on every deploy. Automated security tests complement manual testing |

---

## Enforcement Checklist

### Architecture and Design

- [ ] Threat model completed for all critical features (STRIDE or PASTA methodology)
- [ ] ASVS verification level selected (L1/L2/L3) and mapped to requirements
- [ ] Security boundaries defined between services and trust zones
- [ ] Data classification completed (public / internal / confidential / restricted)
- [ ] Zero trust principles applied (no implicit trust based on network location)
- [ ] Defense in depth architecture with multiple independent security layers

### Secure Defaults

- [ ] All HTTP security headers configured (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [ ] TLS 1.2+ enforced for all connections (application, database, cache, message queue)
- [ ] Cookie flags set: HttpOnly, Secure, SameSite on all cookies
- [ ] Default-deny authorization: all endpoints require explicit allow rules
- [ ] Rate limiting configured on all public endpoints
- [ ] Request size limits configured (body, headers, upload)
- [ ] Debug mode disabled in production (no stack traces, no verbose errors)
- [ ] Server fingerprinting removed (X-Powered-By, Server headers)

### Authentication and Authorization

- [ ] Passwords hashed with bcrypt (cost >= 12) or Argon2id
- [ ] Multi-factor authentication available for user accounts
- [ ] Password policy enforces minimum 12 characters, checks breached password lists
- [ ] Session tokens are cryptographically random, expire after inactivity
- [ ] API keys are scoped, rotatable, and revocable
- [ ] Service-to-service authentication uses mTLS or signed tokens

### Data Protection and Privacy

- [ ] PII identified, classified, and documented in data flow diagrams
- [ ] Data minimization applied: collect only what is necessary
- [ ] Data retention policy defined and enforced (automatic deletion)
- [ ] Anonymization or pseudonymization applied for analytics data
- [ ] Encryption at rest for all sensitive data (database, file storage, backups)
- [ ] No sensitive data in logs (mask PII, never log credentials or tokens)

### Development Pipeline

- [ ] SAST (static analysis) runs on every pull request
- [ ] SCA (dependency scanning) runs on every build
- [ ] Secret detection runs as pre-commit hook and in CI
- [ ] Container image scanning before deployment
- [ ] Infrastructure-as-Code scanning (Checkov, tfsec) for infrastructure changes
- [ ] SBOM generated and stored for every release
- [ ] Security regression tests in test suite

### Operations and Monitoring

- [ ] Security event logging to centralized SIEM
- [ ] Alerting configured for authentication failures, authorization denials, anomalous patterns
- [ ] Incident response runbook documented and tested
- [ ] Vulnerability management: critical patches within 48 hours
- [ ] Regular penetration testing (at least annually, after major changes)
- [ ] Dependency updates automated with vulnerability alerts (Dependabot, Renovate)
