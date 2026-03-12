# REST Error Handling

> **Domain:** Backend > API > REST
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2025-03

## What It Is

A comprehensive system for structured error reporting in REST APIs. Includes standardized error response formats (RFC 7807/9457), proper use of HTTP status codes, application-specific error codes, validation errors, correlation IDs, and rate limit headers. The goal is for every error to be **actionable** for the API consumer — knowing what went wrong, why, and what they can do about it.

## Why It Matters

- **Developer Experience (DX):** Clear error responses drastically reduce debugging time for API consumers
- **Debuggability:** Correlation IDs and structured errors enable end-to-end tracing
- **Security:** Proper error handling prevents information leakage (stack traces, internal paths, DB schemas)
- **Reliability:** Standardized error format enables automated error handling in clients
- **Compliance:** Rate limit errors with proper headers enable graceful degradation
- **Interoperability:** RFC 7807 compliance means existing tooling can parse the errors

---

## How It Works

### 1. RFC 7807 / RFC 9457 — Problem Details for HTTP APIs

RFC 7807 (superseded by RFC 9457) defines a standard format for machine-readable error responses in HTTP APIs.

#### Required and Optional Fields

| Field | Type | Required | Description |
|-------|-------|-------------|-----------|
| `type` | string (URI) | Yes | URI reference that identifies the error type. MUST be dereferenceable (i.e., point to a documentation page). Default: `about:blank` |
| `title` | string | Yes | Short, human-readable summary. MUST NOT change between occurrences (constant per type) |
| `status` | integer | Yes | HTTP status code (must match the actual HTTP status) |
| `detail` | string | No | Human-readable explanation specific to this instance. May change per occurrence |
| `instance` | string (URI) | No | URI reference that identifies the specific occurrence (e.g., link to error log entry) |

#### Example Response — RFC 7807

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 403,
  "detail": "Your account balance of €30.00 is insufficient for a €50.00 transaction.",
  "instance": "/errors/logs/abc-123-def-456",
  "balance": 30.00,
  "required": 50.00,
  "currency": "EUR"
}
```

**Key points:**
- Content-Type MUST be `application/problem+json`
- The fields `balance`, `required`, `currency` are **extension members** — custom fields specific to this error type
- The `type` URI MUST point to a documentation page that explains the error
- When `type` is `about:blank`, the `title` MUST be the HTTP status phrase (e.g., "Not Found")

#### TypeScript Implementation

```typescript
// types/error.ts
interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown; // extension members
}

interface ValidationProblemDetail extends ProblemDetail {
  errors: FieldError[];
}

interface FieldError {
  field: string;
  message: string;
  code: string;
  rejected_value?: unknown;
}

// factory function
function createProblemDetail(
  type: string,
  title: string,
  status: number,
  detail?: string,
  extensions?: Record<string, unknown>
): ProblemDetail {
  return {
    type,
    title,
    status,
    ...(detail && { detail }),
    instance: `/errors/${crypto.randomUUID()}`,
    ...extensions,
  };
}
```

#### Python Implementation

```python
# errors/problem_detail.py
from dataclasses import dataclass, field, asdict
from typing import Any
import uuid

@dataclass
class ProblemDetail:
    type: str
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
    extensions: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.instance is None:
            self.instance = f"/errors/{uuid.uuid4()}"

    def to_dict(self) -> dict[str, Any]:
        result = {
            "type": self.type,
            "title": self.title,
            "status": self.status,
        }
        if self.detail:
            result["detail"] = self.detail
        if self.instance:
            result["instance"] = self.instance
        result.update(self.extensions)
        return result


# FastAPI usage
from fastapi import Request
from fastapi.responses import JSONResponse

async def problem_detail_handler(request: Request, exc: AppException) -> JSONResponse:
    problem = ProblemDetail(
        type=exc.error_type,
        title=exc.title,
        status=exc.status_code,
        detail=str(exc),
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=problem.to_dict(),
        media_type="application/problem+json",
    )
```

#### Go Implementation

```go
// errors/problem.go
package errors

import (
    "encoding/json"
    "fmt"
    "net/http"

    "github.com/google/uuid"
)

type ProblemDetail struct {
    Type     string         `json:"type"`
    Title    string         `json:"title"`
    Status   int            `json:"status"`
    Detail   string         `json:"detail,omitempty"`
    Instance string         `json:"instance,omitempty"`
    Extra    map[string]any `json:"-"` // flattened during marshal
}

func (p ProblemDetail) MarshalJSON() ([]byte, error) {
    type Alias ProblemDetail
    base, err := json.Marshal(Alias(p))
    if err != nil {
        return nil, err
    }
    if len(p.Extra) == 0 {
        return base, nil
    }
    var merged map[string]any
    json.Unmarshal(base, &merged)
    for k, v := range p.Extra {
        merged[k] = v
    }
    return json.Marshal(merged)
}

func NewProblemDetail(typ, title string, status int) *ProblemDetail {
    return &ProblemDetail{
        Type:     typ,
        Title:    title,
        Status:   status,
        Instance: fmt.Sprintf("/errors/%s", uuid.New().String()),
    }
}

func WriteProblem(w http.ResponseWriter, p *ProblemDetail) {
    w.Header().Set("Content-Type", "application/problem+json")
    w.WriteHeader(p.Status)
    json.NewEncoder(w).Encode(p)
}
```

#### Java Implementation (Spring Boot)

```java
// errors/ProblemDetail.java
public record ProblemDetail(
    String type,
    String title,
    int status,
    @Nullable String detail,
    @Nullable String instance,
    Map<String, Object> extensions
) {
    public ProblemDetail {
        if (instance == null) {
            instance = "/errors/" + UUID.randomUUID();
        }
        if (extensions == null) {
            extensions = Map.of();
        }
    }
}

// Spring Boot 3 has built-in RFC 7807 support
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, ex.getMessage()
        );
        pd.setType(URI.create("https://api.example.com/errors/not-found"));
        pd.setTitle("Resource Not Found");
        pd.setProperty("resource_type", ex.getResourceType());
        pd.setProperty("resource_id", ex.getResourceId());
        return pd;
    }
}
```

---

### 2. Error Response Envelope Pattern

As an alternative to RFC 7807, many APIs use a custom error envelope. This pattern is more common in APIs that do not strictly follow standards.

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body contains invalid fields.",
    "request_id": "req_abc123def456",
    "timestamp": "2025-03-15T10:30:00Z",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address.",
        "code": "INVALID_FORMAT",
        "rejected_value": "not-an-email"
      },
      {
        "field": "age",
        "message": "Must be between 18 and 120.",
        "code": "OUT_OF_RANGE",
        "rejected_value": 15,
        "constraints": { "min": 18, "max": 120 }
      }
    ],
    "doc_url": "https://api.example.com/docs/errors/VALIDATION_ERROR"
  }
}
```

#### Comparison: RFC 7807 vs Custom Envelope

| Criterion | RFC 7807 | Custom Envelope |
|----------|----------|-----------------|
| Standardization | IETF Standard | None |
| Tooling support | Growing (Spring 6+, .NET 7+) | Manual |
| Extensibility | Via extension members | Full freedom |
| Content-Type | `application/problem+json` | `application/json` |
| Adoption | Stripe, Microsoft, Zalando | GitHub, Twilio, Slack |

**Recommendation:** Use RFC 7807 as the base and add extension members. Take the best of both worlds.

---

### 3. HTTP Status Code Decision Tree — Complete Guide

#### 2xx — Success (NOT errors, but critical context)

| Code | Name | When |
|------|-------|------|
| 200 | OK | Default success. GET that returns data, PUT/PATCH that returns updated resource |
| 201 | Created | POST that created a resource. MUST include Location header |
| 202 | Accepted | Request accepted but not yet completed (async operations) |
| 204 | No Content | DELETE success or PUT/PATCH without response body |

#### 4xx — Client Errors

| Code | Name | When | Example |
|------|-------|------|------------|
| 400 | Bad Request | Malformed request — JSON syntax error, missing required headers, invalid content-type | `JSON parse error at position 45` |
| 401 | Unauthorized | No authentication or expired/invalid token | Missing `Authorization` header |
| 403 | Forbidden | Authenticated but lacks permission | User tries to access admin endpoint |
| 404 | Not Found | Resource does not exist AND you do not want to reveal its existence | `GET /users/999` |
| 405 | Method Not Allowed | HTTP method not supported. MUST include `Allow` header | `DELETE /users` → `Allow: GET, POST` |
| 406 | Not Acceptable | Server cannot produce the format requested by the client in the `Accept` header | |
| 409 | Conflict | Resource state conflict — duplicate creation, optimistic concurrency failure | Concurrent edit with stale ETag |
| 410 | Gone | Resource existed but was permanently deleted. More specific than 404 | Deleted user profile |
| 413 | Payload Too Large | Request body exceeds limit | File upload > 10MB |
| 415 | Unsupported Media Type | Content-Type not supported | Sending XML to a JSON-only API |
| 422 | Unprocessable Entity | Syntactically valid JSON but semantically invalid — validation errors | `email: "not-an-email"` |
| 429 | Too Many Requests | Rate limit exceeded. MUST include `Retry-After` header | |

#### 5xx — Server Errors

| Code | Name | When |
|------|-------|------|
| 500 | Internal Server Error | Unexpected error — unhandled exception, bug |
| 502 | Bad Gateway | Upstream service returned invalid response |
| 503 | Service Unavailable | Server overloaded or in maintenance. MUST include `Retry-After` header |
| 504 | Gateway Timeout | Upstream service timeout |

#### Decision Tree (Pseudocode)

```
Request received:
├── Can the request be parsed? (JSON syntax, headers)
│   └── NO → 400 Bad Request
├── Is the client authenticated?
│   └── NO → 401 Unauthorized
├── Is the client authorized for this action?
│   └── NO → 403 Forbidden (or 404 if you do not want to reveal existence)
├── Does the resource exist?
│   └── NO → 404 Not Found
├── Is the HTTP method allowed?
│   └── NO → 405 Method Not Allowed
├── Is the request body valid? (schema validation)
│   └── NO → 422 Unprocessable Entity
├── Is there a conflict? (duplicate, concurrency)
│   └── YES → 409 Conflict
├── Rate limit exceeded?
│   └── YES → 429 Too Many Requests
├── Did an upstream service fail?
│   ├── Invalid response → 502 Bad Gateway
│   └── Timeout → 504 Gateway Timeout
├── Is the server overloaded?
│   └── YES → 503 Service Unavailable
└── Unhandled error → 500 Internal Server Error
```

---

### 4. The 400 vs 422 Debate

The difference is critical:

| Situation | Status Code | Rationale |
|-----------|-------------|--------|
| Malformed JSON: `{name: "John"` | **400** | Cannot be parsed — syntactically broken |
| Missing `Content-Type` header | **400** | Request-level error |
| Valid JSON but `email: "not-valid"` | **422** | Parseable but semantically wrong |
| Valid JSON but `age: -5` | **422** | Business rule violation |
| Unknown field `fooo` in body | **400** or ignore it | Depends on strictness policy |

**Rule:** If you can parse the request body and examine the fields, it is 422. If you cannot even parse it, it is 400.

---

### 5. Validation Error Format

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body failed validation. See 'errors' for details.",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address.",
      "code": "INVALID_FORMAT",
      "rejected_value": "not-an-email"
    },
    {
      "field": "password",
      "message": "Must be at least 8 characters.",
      "code": "TOO_SHORT",
      "rejected_value": null,
      "constraints": { "min_length": 8 }
    },
    {
      "field": "address.zipCode",
      "message": "Required field.",
      "code": "REQUIRED",
      "rejected_value": null
    }
  ]
}
```

**Rules:**
- Use **dot notation** for nested fields: `address.zipCode`, `items[0].quantity`
- Every error MUST have `field`, `message`, `code`
- `rejected_value` helps the client understand what was sent wrong (NEVER include passwords)
- `constraints` provides the bounds for numeric/length validations
- Return ALL validation errors at once, not one at a time

#### TypeScript Validation Error Handler (Express/Zod)

```typescript
import { ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

function zodErrorToProblemDetail(error: ZodError, requestId: string) {
  return {
    type: 'https://api.example.com/errors/validation-error',
    title: 'Validation Error',
    status: 422,
    detail: `${error.issues.length} validation error(s) found.`,
    instance: `/errors/${requestId}`,
    errors: error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code.toUpperCase(),
      ...(issue.code === 'too_small' && {
        constraints: { min: (issue as any).minimum },
      }),
      ...(issue.code === 'too_big' && {
        constraints: { max: (issue as any).maximum },
      }),
    })),
  };
}

// Middleware
function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();

  if (err instanceof ZodError) {
    const problem = zodErrorToProblemDetail(err, requestId);
    return res.status(422).type('application/problem+json').json(problem);
  }

  // Fallback: 500
  console.error(`[${requestId}] Unhandled error:`, err);
  res.status(500).type('application/problem+json').json({
    type: 'https://api.example.com/errors/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.',
    instance: `/errors/${requestId}`,
  });
}
```

#### Python Validation Error Handler (FastAPI/Pydantic)

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
) -> JSONResponse:
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    errors = []
    for error in exc.errors():
        field_path = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({
            "field": field_path,
            "message": error["msg"],
            "code": error["type"].upper().replace(".", "_"),
            "rejected_value": error.get("input"),
        })

    return JSONResponse(
        status_code=422,
        content={
            "type": "https://api.example.com/errors/validation-error",
            "title": "Validation Error",
            "status": 422,
            "detail": f"{len(errors)} validation error(s) found.",
            "instance": f"/errors/{request_id}",
            "errors": errors,
        },
        media_type="application/problem+json",
    )
```

---

### 6. Application-Specific Error Codes Strategy

HTTP status codes are generic. You need application-specific codes for programmatic handling.

#### Naming Convention

```
{DOMAIN}_{ACTION}_{REASON}
```

#### Error Code Catalog

```typescript
// errors/codes.ts
export const ErrorCodes = {
  // Authentication
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH_REFRESH_TOKEN_EXPIRED',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',

  // Authorization
  AUTHZ_INSUFFICIENT_PERMISSIONS: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
  AUTHZ_RESOURCE_FORBIDDEN: 'AUTHZ_RESOURCE_FORBIDDEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VALIDATION_FIELD_REQUIRED: 'VALIDATION_FIELD_REQUIRED',
  VALIDATION_FIELD_INVALID: 'VALIDATION_FIELD_INVALID',
  VALIDATION_FIELD_TOO_LONG: 'VALIDATION_FIELD_TOO_LONG',

  // Resources
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  RESOURCE_GONE: 'RESOURCE_GONE',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Business Logic
  PAYMENT_INSUFFICIENT_FUNDS: 'PAYMENT_INSUFFICIENT_FUNDS',
  PAYMENT_CARD_DECLINED: 'PAYMENT_CARD_DECLINED',
  ORDER_ITEM_OUT_OF_STOCK: 'ORDER_ITEM_OUT_OF_STOCK',
  USER_EMAIL_NOT_VERIFIED: 'USER_EMAIL_NOT_VERIFIED',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

Every error code MUST be documented:

```typescript
// errors/registry.ts
interface ErrorDefinition {
  code: string;
  httpStatus: number;
  title: string;
  description: string;
  docUrl: string;
  retryable: boolean;
}

const ERROR_REGISTRY: Record<string, ErrorDefinition> = {
  AUTH_TOKEN_EXPIRED: {
    code: 'AUTH_TOKEN_EXPIRED',
    httpStatus: 401,
    title: 'Token Expired',
    description: 'The access token has expired. Use the refresh token to obtain a new one.',
    docUrl: 'https://api.example.com/docs/errors/AUTH_TOKEN_EXPIRED',
    retryable: true, // after refresh
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    httpStatus: 429,
    title: 'Rate Limit Exceeded',
    description: 'Too many requests. Check Retry-After header.',
    docUrl: 'https://api.example.com/docs/errors/RATE_LIMIT_EXCEEDED',
    retryable: true,
  },
};
```

---

### 7. 401 Unauthorized vs 403 Forbidden — Exact Rules

```
401 Unauthorized:
├── No Authentication header present
├── Token expired
├── Token invalid (malformed, bad signature)
├── Token revoked
└── Means: "I do not know who you are"

403 Forbidden:
├── Authenticated but lacks permission
├── Role-based access denial
├── Resource-level access denial
├── IP whitelist denial
├── Feature flag disabled for this user
└── Means: "I know who you are, but this is not allowed"
```

**Security exception:** If you do not want to reveal that a resource exists to an unauthorized user, return **404** instead of 403. E.g., `GET /admin/users/123` from non-admin → 404 (hides the admin panel existence).

```http
# 401 Response
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="api", error="invalid_token", error_description="Token expired"
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/auth-token-expired",
  "title": "Token Expired",
  "status": 401,
  "detail": "The access token expired at 2025-03-15T10:00:00Z. Refresh it using POST /auth/refresh."
}
```

```http
# 403 Response
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/insufficient-permissions",
  "title": "Insufficient Permissions",
  "status": 403,
  "detail": "You need the 'admin' role to access this resource.",
  "required_permissions": ["admin:users:read"]
}
```

---

### 8. 409 Conflict — Optimistic Concurrency with ETags

The 409 status code is used for:
1. **Duplicate creation** — A resource with this unique key already exists
2. **Optimistic concurrency failure** — Someone else modified the resource while you were editing it
3. **State machine violations** — Invalid transition (e.g., cancel an already shipped order)

#### ETag-based Optimistic Concurrency

```http
# Step 1: Client fetches resource, gets ETag
GET /api/articles/42 HTTP/1.1

HTTP/1.1 200 OK
ETag: "a1b2c3d4e5"
Content-Type: application/json

{
  "id": 42,
  "title": "Original Title",
  "content": "..."
}
```

```http
# Step 2: Client updates with If-Match header
PUT /api/articles/42 HTTP/1.1
If-Match: "a1b2c3d4e5"
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "..."
}
```

```http
# Step 3a: Success — ETag matches
HTTP/1.1 200 OK
ETag: "f6g7h8i9j0"

# Step 3b: Conflict — someone else edited it first
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/resource-conflict",
  "title": "Resource Conflict",
  "status": 409,
  "detail": "The resource was modified by another request. Fetch the latest version and retry.",
  "current_etag": "x9y8z7w6v5",
  "your_etag": "a1b2c3d4e5"
}
```

#### SQL Pattern for Optimistic Concurrency

```sql
-- Use a version column instead of ETag for DB-level concurrency
UPDATE articles
SET title = 'Updated Title',
    content = '...',
    version = version + 1,
    updated_at = NOW()
WHERE id = 42
  AND version = 5;  -- version the client had

-- If affected rows = 0, someone else updated it → 409
```

---

### 9. Rate Limit Error Responses (429)

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710500400
Retry-After: 45

{
  "type": "https://api.example.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of 100 requests per minute. Try again in 45 seconds."
}
```

#### Rate Limit Headers (IETF Draft Standard)

| Header | Type | Description |
|--------|-------|-----------|
| `X-RateLimit-Limit` | integer | Maximum requests per window |
| `X-RateLimit-Remaining` | integer | Remaining requests in the current window |
| `X-RateLimit-Reset` | Unix timestamp | When the window resets |
| `Retry-After` | seconds or HTTP-date | How long the client should wait (**RFC 7231, required**) |

**IMPORTANT:** Send rate limit headers on EVERY response, not just 429s. This enables proactive throttling in the client.

```typescript
// middleware/rateLimit.ts
import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl',
  points: 100,        // requests
  duration: 60,       // per 60 seconds
  blockDuration: 60,  // block for 60s after exceeding
});

async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.user?.id || req.ip;
  try {
    const result = await rateLimiter.consume(key);
    res.set({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': String(result.remainingPoints),
      'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + result.msBeforeNext / 1000),
    });
    next();
  } catch (rateLimitError: any) {
    const retryAfter = Math.ceil(rateLimitError.msBeforeNext / 1000);
    res.set({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
      'Retry-After': String(retryAfter),
    });
    res.status(429).type('application/problem+json').json({
      type: 'https://api.example.com/errors/rate-limit-exceeded',
      title: 'Rate Limit Exceeded',
      status: 429,
      detail: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
    });
  }
}
```

---

### 10. Error Logging Correlation — Request IDs

Every error response MUST contain a `request_id` (or `instance` in RFC 7807) that corresponds to the log entry on the server.

```typescript
// middleware/requestId.ts
import { randomUUID } from 'crypto';

function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Accept client-provided ID or generate one
  const requestId = req.headers['x-request-id'] as string || randomUUID();
  req.requestId = requestId;
  res.set('X-Request-Id', requestId);
  next();
}
```

```http
# Request
GET /api/users/999 HTTP/1.1
X-Request-Id: client-generated-id-123

# Response
HTTP/1.1 404 Not Found
X-Request-Id: client-generated-id-123
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "User with ID 999 was not found.",
  "instance": "/errors/client-generated-id-123"
}
```

**In the server log:**
```json
{
  "level": "warn",
  "request_id": "client-generated-id-123",
  "method": "GET",
  "path": "/api/users/999",
  "status": 404,
  "user_id": "usr_456",
  "duration_ms": 12,
  "error_code": "RESOURCE_NOT_FOUND",
  "timestamp": "2025-03-15T10:30:00.000Z"
}
```

---

### 11. Stack Traces in Errors

**NEVER include stack traces in production responses.** They reveal internal implementation details, file paths, dependency versions — information disclosure vulnerability.

```typescript
// Conditional error detail based on environment
function formatError(err: Error, env: string): ProblemDetail {
  const base: ProblemDetail = {
    type: 'https://api.example.com/errors/internal-error',
    title: 'Internal Server Error',
    status: 500,
    instance: `/errors/${crypto.randomUUID()}`,
  };

  if (env === 'development' || env === 'staging') {
    return {
      ...base,
      detail: err.message,
      // ONLY in non-production
      _debug: {
        stack: err.stack,
        cause: err.cause,
        name: err.constructor.name,
      },
    };
  }

  // Production: generic message, NO stack trace
  return {
    ...base,
    detail: 'An unexpected error occurred. Contact support with the request ID.',
  };
}
```

**Pattern:** Log the full stack trace server-side (linked by request_id), return only a safe message to the client.

---

### 12. Error Message Localization

```http
# Client sends preferred language
GET /api/orders/123 HTTP/1.1
Accept-Language: el-GR, en;q=0.9

# Server responds with localized error
HTTP/1.1 404 Not Found
Content-Language: el-GR
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Order with ID 123 was not found.",
  "code": "RESOURCE_NOT_FOUND"
}
```

**Rules:**
- The `code` (machine-readable) is NEVER translated
- Only the `title` and `detail` (human-readable) are translated
- Use the `Content-Language` response header
- Fallback to `en` if the language is not supported

```typescript
// i18n/errors.ts
const errorMessages: Record<string, Record<string, { title: string; detail: string }>> = {
  RESOURCE_NOT_FOUND: {
    en: { title: 'Resource Not Found', detail: 'The requested resource was not found.' },
    el: { title: 'Resource Not Found', detail: 'The requested resource was not found.' },
    de: { title: 'Ressource nicht gefunden', detail: 'Die angeforderte Ressource wurde nicht gefunden.' },
  },
  VALIDATION_ERROR: {
    en: { title: 'Validation Error', detail: 'The request contains invalid data.' },
    el: { title: 'Validation Error', detail: 'The request contains invalid data.' },
    de: { title: 'Validierungsfehler', detail: 'Die Anfrage enthält ungültige Daten.' },
  },
};

function getLocalizedError(code: string, lang: string): { title: string; detail: string } {
  const msgs = errorMessages[code];
  if (!msgs) return { title: 'Error', detail: 'An error occurred.' };
  return msgs[lang] || msgs['en'];
}
```

---

### 13. OpenAPI Error Documentation

```yaml
# openapi.yaml
components:
  schemas:
    ProblemDetail:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
          description: URI reference identifying the error type
          example: "https://api.example.com/errors/validation-error"
        title:
          type: string
          description: Short human-readable summary (stable per type)
          example: "Validation Error"
        status:
          type: integer
          description: HTTP status code
          example: 422
        detail:
          type: string
          description: Human-readable explanation specific to this occurrence
          example: "3 validation error(s) found."
        instance:
          type: string
          format: uri
          description: URI identifying this specific error occurrence
          example: "/errors/abc-123"

    ValidationError:
      allOf:
        - $ref: '#/components/schemas/ProblemDetail'
        - type: object
          properties:
            errors:
              type: array
              items:
                $ref: '#/components/schemas/FieldError'

    FieldError:
      type: object
      required: [field, message, code]
      properties:
        field:
          type: string
          description: JSON path to the invalid field
          example: "email"
        message:
          type: string
          description: Human-readable error message
          example: "Must be a valid email address."
        code:
          type: string
          description: Machine-readable error code
          example: "INVALID_FORMAT"
        rejected_value:
          description: The value that was rejected
          example: "not-an-email"

  responses:
    BadRequest:
      description: Malformed request
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'
          example:
            type: "https://api.example.com/errors/bad-request"
            title: "Bad Request"
            status: 400
            detail: "JSON parse error at position 45."

    Unauthorized:
      description: Authentication required
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'
      headers:
        WWW-Authenticate:
          schema:
            type: string
          example: 'Bearer realm="api"'

    Forbidden:
      description: Insufficient permissions
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'

    NotFound:
      description: Resource not found
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'

    Conflict:
      description: Resource conflict
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'

    UnprocessableEntity:
      description: Validation error
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ValidationError'

    TooManyRequests:
      description: Rate limit exceeded
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'
      headers:
        X-RateLimit-Limit:
          schema:
            type: integer
        X-RateLimit-Remaining:
          schema:
            type: integer
        X-RateLimit-Reset:
          schema:
            type: integer
        Retry-After:
          schema:
            type: integer

    InternalError:
      description: Unexpected server error
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'

# Usage in paths
paths:
  /users:
    post:
      responses:
        '201':
          description: User created
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '500':
          $ref: '#/components/responses/InternalError'
```

---

### 14. Global Error Handler Pattern — Express (Complete)

```typescript
// errors/AppError.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly title: string,
    message: string,
    public readonly extensions?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toProblemDetail(requestId: string): ProblemDetail {
    return {
      type: `https://api.example.com/errors/${this.code.toLowerCase().replace(/_/g, '-')}`,
      title: this.title,
      status: this.httpStatus,
      detail: this.message,
      instance: `/errors/${requestId}`,
      ...this.extensions,
    };
  }
}

// Predefined error factories
export const Errors = {
  notFound: (resource: string, id: string) =>
    new AppError('RESOURCE_NOT_FOUND', 404, 'Resource Not Found',
      `${resource} with ID ${id} was not found.`,
      { resource_type: resource, resource_id: id }),

  conflict: (message: string) =>
    new AppError('RESOURCE_CONFLICT', 409, 'Resource Conflict', message),

  unauthorized: (reason: string) =>
    new AppError('AUTH_TOKEN_INVALID', 401, 'Unauthorized', reason),

  forbidden: (action: string) =>
    new AppError('AUTHZ_INSUFFICIENT_PERMISSIONS', 403, 'Forbidden',
      `You do not have permission to ${action}.`),

  validation: (errors: FieldError[]) =>
    new AppError('VALIDATION_ERROR', 422, 'Validation Error',
      `${errors.length} validation error(s) found.`,
      { errors }),

  rateLimited: (retryAfter: number) =>
    new AppError('RATE_LIMIT_EXCEEDED', 429, 'Rate Limit Exceeded',
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`),
};

// Global error handler middleware
export function globalErrorHandler(
  err: Error, req: Request, res: Response, _next: NextFunction
) {
  const requestId = req.requestId || crypto.randomUUID();
  const env = process.env.NODE_ENV || 'production';

  // Known application error
  if (err instanceof AppError) {
    const problem = err.toProblemDetail(requestId);

    // Log at appropriate level
    if (err.httpStatus >= 500) {
      logger.error({ requestId, error: err, stack: err.stack }, 'Server error');
    } else if (err.httpStatus >= 400) {
      logger.warn({ requestId, errorCode: err.code, path: req.path }, 'Client error');
    }

    return res.status(err.httpStatus).type('application/problem+json').json(problem);
  }

  // Zod validation error
  if (err instanceof ZodError) {
    const problem = zodErrorToProblemDetail(err, requestId);
    logger.warn({ requestId, validationErrors: err.issues.length }, 'Validation error');
    return res.status(422).type('application/problem+json').json(problem);
  }

  // SyntaxError (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).type('application/problem+json').json({
      type: 'https://api.example.com/errors/malformed-request',
      title: 'Malformed Request',
      status: 400,
      detail: 'The request body contains invalid JSON.',
      instance: `/errors/${requestId}`,
    });
  }

  // Unknown error → 500
  logger.error({ requestId, error: err, stack: err.stack }, 'Unhandled error');
  res.status(500).type('application/problem+json').json({
    type: 'https://api.example.com/errors/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: env === 'development' ? err.message : 'An unexpected error occurred.',
    instance: `/errors/${requestId}`,
    ...(env === 'development' && { _debug: { stack: err.stack, name: err.constructor.name } }),
  });
}
```

---

## Best Practices

1. **ALWAYS use a consistent error format** across the ENTIRE API — RFC 7807 or custom envelope, never mix
2. **ALWAYS set `Content-Type: application/problem+json`** for RFC 7807 responses
3. **ALWAYS send `X-Request-Id`** response header on every response (success and error)
4. **ALWAYS return ALL validation errors** at once, never one at a time
5. **ALWAYS include `Retry-After`** header on 429 and 503 responses
6. **ALWAYS include `WWW-Authenticate`** header on 401 responses
7. **ALWAYS include `Allow`** header on 405 responses
8. **ALWAYS use application-specific error codes** in addition to HTTP status codes
9. **ALWAYS document every error code** with description, cause, and resolution
10. **ALWAYS log full errors server-side**, send safe summaries client-side
11. **ALWAYS test the error paths** — unit test every error type, integration test error handling middleware

---

## Anti-patterns / Common Mistakes

1. **Stack traces in production** — Information disclosure vulnerability. NEVER.
2. **200 OK with error in body** — `{ "status": 200, "error": "Not found" }` — Breaks HTTP semantics, confuses caches, load balancers, monitoring
3. **Inconsistent error format** — One endpoint returns `{ error: "..." }`, another `{ message: "..." }`, a third `{ errors: [...] }` — Impossible client-side handling
4. **Generic error messages** — `"Something went wrong"` without error code or request ID — Impossible debugging
5. **Wrong status code** — 200 instead of 201 for creation, 400 instead of 422 for validation, 403 instead of 401 for missing auth
6. **Exposing internal details** — `"error": "Column user_id cannot be null"` — Reveals DB schema
7. **Not including request ID in error responses** — Impossible correlation server logs ↔ client error
8. **Incorrect 404 handling** — Returning HTML 404 page in a JSON API
9. **Using string error codes instead of enums** — Typos, inconsistency, impossible programmatic handling
10. **Validation errors one-at-a-time** — User fixes one field, hits submit, sees new error → bad UX
11. **Missing `Retry-After` on 429** — Client does not know when to retry, hammers the server

---

## Real-world Examples

### Stripe API Error Format
```json
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined.",
    "param": "number",
    "decline_code": "insufficient_funds",
    "charge": "ch_1234",
    "doc_url": "https://stripe.com/docs/error-codes/card-declined"
  }
}
```

### GitHub API Error Format
```json
{
  "message": "Validation Failed",
  "errors": [
    {
      "resource": "Issue",
      "field": "title",
      "code": "missing_field"
    }
  ],
  "documentation_url": "https://docs.github.com/rest"
}
```

### Microsoft Graph API (RFC 7807)
```json
{
  "error": {
    "code": "Authorization_RequestDenied",
    "message": "Insufficient privileges to complete the operation.",
    "innerError": {
      "date": "2025-03-15T10:30:00",
      "request-id": "abc-123-def",
      "client-request-id": "xyz-789"
    }
  }
}
```

### Zalando API (RFC 7807)
```json
{
  "type": "https://httpstatuses.com/422",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "The request body contains invalid fields.",
  "instance": "/orders/12345"
}
```

---

## Sources

- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457) (supersedes RFC 7807)
- [RFC 7807 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc7807) (original)
- [RFC 7231 — HTTP/1.1 Semantics and Content](https://www.rfc-editor.org/rfc/rfc7231) (status codes, Retry-After)
- [RFC 6750 — OAuth 2.0 Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750) (WWW-Authenticate header)
- [IETF Rate Limiting Headers Draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)
- [Stripe API Errors](https://stripe.com/docs/api/errors)
- [GitHub API Error Format](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#client-errors)
- [Zalando RESTful API Guidelines — Error Handling](https://opensource.zalando.com/restful-api-guidelines/#error-handling)
- [Microsoft REST API Guidelines — Error Responses](https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md)
- [Spring Boot Problem Details Support](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)
- [Google Cloud API Design Guide — Errors](https://cloud.google.com/apis/design/errors)
