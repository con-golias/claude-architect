# REST Principles — Complete Specification

> **AI Plugin Directive:** When designing a new REST API, evaluating an existing API's RESTfulness, choosing HTTP methods, selecting status codes, or implementing content negotiation, ALWAYS consult this guide. Apply these principles to every HTTP-based API to ensure correct semantics, cacheability, and interoperability. This guide covers the six REST constraints, Richardson Maturity Model, HTTP method semantics, status code decision trees, and content negotiation.

**Core Rule: ALWAYS design APIs at Richardson Maturity Level 2 minimum — resources identified by URIs, HTTP methods used semantically, proper status codes returned. NEVER put verbs in URIs. NEVER return 200 OK for errors. NEVER use GET to trigger state changes. NEVER store client session state on the server between requests.**

---

## 1. The Six REST Constraints

```
┌─────────────────────────────────────────────────────────────────┐
│                    REST ARCHITECTURAL CONSTRAINTS                │
│                                                                 │
│  MANDATORY (violating ANY = NOT RESTful):                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1. Client-Server    — Separate UI from data storage      │  │
│  │  2. Statelessness    — Every request self-contained       │  │
│  │  3. Cacheability     — Responses MUST declare cacheability│  │
│  │  4. Uniform Interface— Resources, representations, links  │  │
│  │  5. Layered System   — Client cannot tell intermediaries  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  OPTIONAL:                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  6. Code-On-Demand   — Server can send executable code    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 Client-Server Separation

ALWAYS separate user interface concerns from data storage concerns. The client MUST NOT know about database schemas, internal services, or server-side logic. The server MUST NOT know about UI state, rendering, or user interaction details.

```http
# CORRECT: Clean separation — client sends intent, server returns representation
POST /api/orders HTTP/1.1
Content-Type: application/json

{ "product_id": "prod_abc", "quantity": 2 }

HTTP/1.1 201 Created
{ "id": "ord_123", "status": "pending", "total": 59.98 }

# WRONG: Leaking server internals to client
HTTP/1.1 200 OK
{ "id": 123, "_hibernate_version": 3, "_db_shard": "us-east-1", "_internal_queue": "orders-v2" }
```

### 1.2 Statelessness

EVERY request MUST contain ALL information needed to process it. The server MUST NOT store client session state between requests. Authentication MUST be sent with every request via the `Authorization` header.

```http
# CORRECT: Stateless — everything the server needs is in the request
GET /api/users/42/orders?status=shipped&page=2 HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Accept: application/json

# WRONG: Stateful — depends on server-side session
GET /api/my-orders?page=2 HTTP/1.1
Cookie: JSESSIONID=abc123
```

**What goes in the token:** user identity, roles/permissions, expiration, issuer, tenant ID.

**What goes in each request:** the auth token, the resource identifier, all filter/sort/page parameters, any context headers (`Accept-Language`, `X-Request-ID`).

**What MUST NOT be stored on the server between requests:** session state, pagination position, shopping cart contents, filter selections, wizard/form progress. Model these as resources instead (`POST /carts`, `PATCH /carts/{id}`).

### 1.3 Cacheability

EVERY response MUST implicitly or explicitly declare itself as cacheable or non-cacheable. ALWAYS use proper HTTP cache headers.

```http
# Cacheable response with ETag
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=3600
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Sun, 09 Mar 2026 10:00:00 GMT

# Conditional request — saves bandwidth
GET /api/products/42 HTTP/1.1
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# Server responds 304 if unchanged
HTTP/1.1 304 Not Modified
```

| Response Type | Cache-Control | Use Case |
|---------------|---------------|----------|
| Public data (products, articles) | `public, max-age=3600` | Cacheable by CDN and browser |
| User-specific data | `private, max-age=300` | Cacheable by browser only |
| Sensitive data (financial, health) | `no-store` | NEVER cache |
| Volatile data (real-time feeds) | `no-cache` | Always revalidate |

### 1.4 Uniform Interface

The most critical REST constraint. Four sub-constraints:

**a) Resource Identification:** Every resource MUST have a unique URI. URIs identify resources, NOT actions.

```
CORRECT:  GET  /users/42
WRONG:    GET  /getUser?id=42
WRONG:    POST /getUserById  { "id": 42 }
```

**b) Manipulation Through Representations:** Clients send representations (JSON) to manipulate resources. The representation does NOT need to match the stored form.

**c) Self-Descriptive Messages:** Every message MUST include enough metadata to describe how to process it — `Content-Type`, HTTP method, status code.

**d) HATEOAS:** Responses SHOULD include links to related resources and available actions. See the dedicated `hateoas.md` for full specification.

### 1.5 Layered System

The client MUST NOT be able to tell whether it connects directly to the server or through intermediaries. NEVER put layer-specific information in responses.

```
Client → CDN (Cloudflare) → API Gateway (Kong) → Load Balancer → App Server → Database

The client sees only: https://api.example.com/users/42
```

### 1.6 Code-On-Demand (OPTIONAL)

The ONLY optional REST constraint. The server can extend client functionality by transferring executable code. Rarely used in modern REST APIs.

---

## 2. Richardson Maturity Model

```
┌─────────────────────────────────────────────────────────────┐
│              RICHARDSON MATURITY MODEL                       │
│                                                             │
│  Level 3: Hypermedia Controls (HATEOAS)     ← IDEAL        │
│  ────────────────────────────────────────                   │
│  Level 2: HTTP Verbs + Status Codes         ← MINIMUM      │
│  ────────────────────────────────────────                   │
│  Level 1: Resources (individual URIs)                       │
│  ────────────────────────────────────────                   │
│  Level 0: Swamp of POX (single endpoint)    ← ANTI-PATTERN │
│                                                             │
│  Most production APIs (Stripe, GitHub, Twilio) = Level 2    │
└─────────────────────────────────────────────────────────────┘
```

### Level 0: The Swamp of POX — NEVER Design New APIs Here

Single URI, single HTTP method (POST). HTTP used purely as transport.

```http
# Level 0: Everything through one endpoint
POST /api HTTP/1.1
{ "action": "getUser", "userId": 42 }

POST /api HTTP/1.1
{ "action": "deleteUser", "userId": 42 }
```

WHY this is wrong: no caching (all POSTs), no meaningful status codes, proxies and load balancers cannot make intelligent routing decisions.

### Level 1: Resources

Individual URIs but still single HTTP method.

```http
# Level 1: Separate URIs, but only POST
POST /api/users/42 HTTP/1.1
{ "action": "get" }
```

### Level 2: HTTP Verbs — THE MINIMUM for Production APIs

Resources + proper HTTP methods + proper status codes.

```http
GET    /api/users/42          → 200 OK
POST   /api/users             → 201 Created + Location header
PATCH  /api/users/42          → 200 OK
DELETE /api/users/42          → 204 No Content
```

### Level 3: Hypermedia Controls (HATEOAS)

Responses include links telling the client what it can do next. See `hateoas.md` for full implementation.

```json
{
  "id": 42,
  "name": "John",
  "_links": {
    "self": { "href": "/api/users/42" },
    "orders": { "href": "/api/users/42/orders" },
    "deactivate": { "href": "/api/users/42/deactivate", "method": "POST" }
  }
}
```

ALWAYS aim for Level 2 minimum. Implement Level 3 elements selectively — pagination links, `self` links, `Location` headers.

---

## 3. HTTP Methods — Semantics, Safety, and Idempotency

| Method | Safe | Idempotent | Request Body | Response Body | Primary Use |
|--------|------|------------|-------------|---------------|-------------|
| GET | ✅ | ✅ | MUST NOT | ✅ | Retrieve resource |
| HEAD | ✅ | ✅ | MUST NOT | MUST NOT | Check existence / headers |
| OPTIONS | ✅ | ✅ | Optional | ✅ | CORS preflight / discover methods |
| POST | ❌ | ❌ | ✅ | ✅ | Create resource / trigger action |
| PUT | ❌ | ✅ | ✅ | Optional | Full replacement |
| PATCH | ❌ | ❌* | ✅ | ✅ | Partial update |
| DELETE | ❌ | ✅ | Optional | Optional | Remove resource |

*PATCH is NOT idempotent by spec (RFC 5789) because JSON Patch `add` operations append each time. However, merge-patch (`{ "name": "new" }`) IS idempotent in practice.

- **Safe** = does NOT modify server state. Calling 1000 times = same state as 0 times.
- **Idempotent** = calling N times = same server state as calling once.

### 3.1 GET

```http
GET /api/users?status=active&sort=-created_at&page=2 HTTP/1.1
Accept: application/json
```

- NEVER use GET to trigger state changes.
- NEVER send a request body with GET (RFC 9110).
- ALWAYS make GET responses cacheable.

### 3.2 POST

```http
POST /api/users HTTP/1.1
Content-Type: application/json

{ "name": "Jane", "email": "jane@example.com" }

HTTP/1.1 201 Created
Location: /api/users/43
{ "id": 43, "name": "Jane", "email": "jane@example.com" }
```

- POST is NOT idempotent — calling `POST /users` twice creates two users.
- Use `Idempotency-Key` header for safe retries (Stripe pattern):

```http
POST /api/charges HTTP/1.1
Idempotency-Key: unique-request-id-abc123
{ "amount": 2000, "currency": "usd" }
```

- POST is also used for non-CRUD operations: `POST /api/reports/generate`, `POST /api/emails/send`.

### 3.3 PUT

```http
PUT /api/users/42 HTTP/1.1
Content-Type: application/json

{ "name": "John Doe", "email": "john@example.com", "role": "admin" }
```

- MUST send the **complete** representation. Omitted fields are set to null/default.
- NEVER use PUT for partial updates — use PATCH instead.
- PUT is idempotent: calling the same PUT 10 times = same state.

### 3.4 PATCH

```http
# JSON Merge Patch (RFC 7396) — simple partial update
PATCH /api/users/42 HTTP/1.1
Content-Type: application/merge-patch+json

{ "email": "newemail@example.com" }

# JSON Patch (RFC 6902) — complex operations
PATCH /api/users/42 HTTP/1.1
Content-Type: application/json-patch+json

[
  { "op": "replace", "path": "/email", "value": "new@example.com" },
  { "op": "add", "path": "/tags/-", "value": "premium" },
  { "op": "remove", "path": "/legacy_field" }
]
```

- ALWAYS return the full updated resource in the response body.

### 3.5 DELETE

```http
DELETE /api/users/42 HTTP/1.1

HTTP/1.1 204 No Content
```

- DELETE is idempotent: end state (resource is gone) is the same regardless of call count.
- First call: `204 No Content`. Subsequent calls: `404 Not Found` — this does NOT violate idempotency.
- For soft deletes, use `PATCH /api/users/42 { "status": "archived" }` or `POST /api/users/42/archive`.

### 3.6 HEAD

```http
HEAD /api/users/42 HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 234
ETag: "abc123"
# No body
```

Use HEAD to check resource existence or get metadata (Content-Length, Last-Modified) before downloading.

### 3.7 OPTIONS

```http
OPTIONS /api/users HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

---

## 4. HTTP Status Code Decision Tree

```
Request received
├── Can the request be parsed? (JSON syntax, headers valid)
│   └── NO → 400 Bad Request
├── Is the client authenticated?
│   └── NO → 401 Unauthorized
├── Is the client authorized?
│   └── NO → 403 Forbidden (or 404 to hide resource existence)
├── Does the resource exist?
│   └── NO → 404 Not Found
├── Is the HTTP method allowed on this resource?
│   └── NO → 405 Method Not Allowed (include Allow header)
├── Is the request body valid? (field validation, business rules)
│   └── NO → 422 Unprocessable Entity
├── Is there a state conflict? (duplicate, concurrency)
│   └── YES → 409 Conflict
├── Rate limit exceeded?
│   └── YES → 429 Too Many Requests (include Retry-After)
├── Server error?
│   ├── Upstream invalid response → 502 Bad Gateway
│   ├── Upstream timeout → 504 Gateway Timeout
│   ├── Server overloaded → 503 Service Unavailable
│   └── Unhandled → 500 Internal Server Error
└── Success
    ├── GET returning data → 200 OK
    ├── POST created resource → 201 Created (+ Location header)
    ├── Async operation accepted → 202 Accepted (+ job status URL)
    └── DELETE / no response body → 204 No Content
```

### 4.1 Success Codes (2xx)

| Code | Name | When to Use | Required Headers |
|------|------|-------------|-----------------|
| 200 | OK | GET/PUT/PATCH returning data | — |
| 201 | Created | POST created a resource | `Location` with new resource URI |
| 202 | Accepted | Async operation not yet complete | `Location` with job status URI |
| 204 | No Content | DELETE success, PUT/PATCH with no body | — |

```http
# 201 — MUST include Location
POST /api/users HTTP/1.1
HTTP/1.1 201 Created
Location: /api/users/42

# 202 — Async operation
POST /api/reports/generate HTTP/1.1
HTTP/1.1 202 Accepted
Location: /api/reports/jobs/789
{ "job_id": "789", "status": "processing" }
```

### 4.2 Client Error Codes (4xx)

| Code | Name | When to Use |
|------|------|-------------|
| 400 | Bad Request | Malformed JSON, missing required headers, invalid Content-Type |
| 401 | Unauthorized | No token, expired token, invalid token — "I do not know who you are" |
| 403 | Forbidden | Authenticated but lacks permission — "I know you, but you cannot do this" |
| 404 | Not Found | Resource does not exist, or hiding existence for security |
| 405 | Method Not Allowed | Wrong HTTP method (MUST include `Allow` header) |
| 409 | Conflict | Duplicate creation, optimistic concurrency failure, invalid state transition |
| 410 | Gone | Resource permanently deleted (stronger than 404) |
| 413 | Payload Too Large | Request body exceeds size limit |
| 415 | Unsupported Media Type | Wrong Content-Type (sent XML to JSON-only API) |
| 422 | Unprocessable Entity | Valid JSON but fails business validation |
| 429 | Too Many Requests | Rate limited (MUST include `Retry-After` header) |

**The 400 vs 422 Decision:**
- Cannot parse the JSON at all? → **400**
- JSON is valid but fields fail validation? → **422**
- Pick one convention and apply it consistently across the entire API.

**The 401 vs 403 Decision:**
- User NOT identified (no token, bad token)? → **401**
- User identified but lacks permission? → **403**
- NEVER return 401 when the real issue is authorization.

### 4.3 Server Error Codes (5xx)

| Code | Name | When to Use |
|------|------|-------------|
| 500 | Internal Server Error | Unhandled exception. NEVER expose stack traces in production |
| 502 | Bad Gateway | Upstream service returned invalid response |
| 503 | Service Unavailable | Maintenance or overloaded (MUST include `Retry-After`) |
| 504 | Gateway Timeout | Upstream service timed out |

```http
# WRONG: Exposing internals
HTTP/1.1 500 Internal Server Error
{ "error": "NullPointerException at UserService.java:42" }

# CORRECT: Generic message with correlation ID
HTTP/1.1 500 Internal Server Error
{ "error": "Internal server error", "request_id": "req_abc123" }
```

---

## 5. Content Negotiation

```http
# Client requests JSON
GET /api/users/42 HTTP/1.1
Accept: application/json

# Client requests XML
GET /api/users/42 HTTP/1.1
Accept: application/xml

# Client accepts either, prefers JSON
GET /api/users/42 HTTP/1.1
Accept: application/json, application/xml;q=0.9

# Server cannot serve requested format
HTTP/1.1 406 Not Acceptable
{ "error": "Supported formats: application/json, application/xml" }
```

- ALWAYS set `Content-Type` on responses AND requests with a body.
- ALWAYS respect the `Accept` header; return `406 Not Acceptable` if unsupported.
- NEVER determine response format from URL extension (e.g., `/users/42.json` is NOT RESTful).
- Versioning via Accept header (GitHub pattern):

```http
GET /api/users/42 HTTP/1.1
Accept: application/vnd.github.v3+json
```

---

## 6. REST vs RPC-Style Endpoints

| Aspect | REST Style | RPC Style |
|--------|-----------|-----------|
| URL structure | Nouns (resources) | Verbs (actions) |
| HTTP methods | Semantic (GET/POST/PUT/DELETE) | Usually just POST |
| Example | `GET /users/42` | `POST /getUser { id: 42 }` |
| Caching | Natural (GET cacheable) | Hard (POST not cacheable) |
| Discoverability | High (uniform interface) | Low (need docs per action) |

```http
# REST style (CORRECT for CRUD)
GET    /api/users/42
POST   /api/users
PATCH  /api/users/42
DELETE /api/users/42

# RPC style (ANTI-PATTERN for CRUD)
POST /api/getUser       { "id": 42 }
POST /api/createUser    { "name": "John" }
POST /api/deleteUser    { "id": 42 }
```

**WHEN RPC-style IS acceptable within a REST API:**
- Operations that genuinely do not map to CRUD on a resource:
  - `POST /api/users/42/send-verification-email`
  - `POST /api/orders/42/cancel`
  - `POST /api/reports/generate`
- Model these as sub-resource actions with POST.

---

## 7. Real Production API Patterns

### 7.1 Stripe API

```http
# Idempotent POST with Idempotency-Key
POST /v1/charges HTTP/1.1
Authorization: Bearer sk_live_...
Idempotency-Key: unique-key-123
Content-Type: application/x-www-form-urlencoded
amount=2000&currency=usd&source=tok_visa

# Expandable nested resources
GET /v1/charges/ch_123?expand[]=customer&expand[]=invoice

# Bracket notation filters
GET /v1/charges?limit=10&created[gte]=1609459200&status=succeeded

# Structured error format
HTTP/1.1 402 Payment Required
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined.",
    "param": "source",
    "decline_code": "insufficient_funds"
  }
}
```

Key patterns: URL versioning (`/v1/`), `Idempotency-Key` for POST, expandable relationships, structured errors with `type`, `code`, `message`, `param`.

### 7.2 GitHub API

```http
# Content negotiation versioning
GET /repos/octocat/hello-world/issues HTTP/1.1
Accept: application/vnd.github.v3+json

# Pagination via Link header (RFC 8288)
HTTP/1.1 200 OK
Link: <https://api.github.com/repos/octocat/hello-world/issues?page=2>; rel="next",
      <https://api.github.com/repos/octocat/hello-world/issues?page=5>; rel="last"
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999

# Conditional requests save rate limit quota
GET /repos/octocat/hello-world HTTP/1.1
If-None-Match: "etag-value"

HTTP/1.1 304 Not Modified
```

Key patterns: Header versioning (`Accept: application/vnd.github.v3+json`), Link headers for pagination, rate limit headers, conditional requests.

### 7.3 Twilio API

```http
# Date-based versioning in URL path
POST /2010-04-01/Accounts/{AccountSid}/Messages.json HTTP/1.1

# Pagination via next_page_uri in response body
{
  "messages": [...],
  "next_page_uri": "/2010-04-01/Accounts/{sid}/Messages.json?PageToken=abc&PageSize=20"
}
```

Key patterns: Date-based versioning (`/2010-04-01/`), Basic auth, URI pagination in response body.

---

## 8. Implementing REST in Code

### 8.1 TypeScript (Express)

```typescript
import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// GET — retrieve resource
app.get('/api/users/:id', async (req, res) => {
  const user = await userRepo.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: `User ${req.params.id} not found`,
    });
  }
  res.set('ETag', `"${user.version}"`);
  res.set('Cache-Control', 'private, max-age=60');
  res.json(user);
});

// POST — create resource
const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

app.post('/api/users', async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      type: 'https://api.example.com/errors/validation',
      title: 'Validation Error',
      status: 422,
      errors: parsed.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  const user = await userRepo.create(parsed.data);
  res.status(201)
    .set('Location', `/api/users/${user.id}`)
    .json(user);
});

// PATCH — partial update
app.patch('/api/users/:id', async (req, res) => {
  const user = await userRepo.update(req.params.id, req.body);
  if (!user) return res.status(404).json({ status: 404, title: 'Not Found' });
  res.json(user);
});

// DELETE — remove resource
app.delete('/api/users/:id', async (req, res) => {
  const deleted = await userRepo.delete(req.params.id);
  if (!deleted) return res.status(404).json({ status: 404, title: 'Not Found' });
  res.status(204).end();
});
```

### 8.2 Python (FastAPI)

```python
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, EmailStr

app = FastAPI()

class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr

@app.get("/api/users/{user_id}")
async def get_user(user_id: int, response: Response):
    user = await user_repo.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    response.headers["ETag"] = f'"{user.version}"'
    response.headers["Cache-Control"] = "private, max-age=60"
    return user

@app.post("/api/users", status_code=201)
async def create_user(request: CreateUserRequest, response: Response):
    user = await user_repo.create(request.model_dump())
    response.headers["Location"] = f"/api/users/{user.id}"
    return user

@app.delete("/api/users/{user_id}", status_code=204)
async def delete_user(user_id: int):
    deleted = await user_repo.delete(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")
```

### 8.3 Go (Gin)

```go
func setupRoutes(r *gin.Engine) {
    api := r.Group("/api")
    {
        api.GET("/users/:id", getUser)
        api.POST("/users", createUser)
        api.PATCH("/users/:id", updateUser)
        api.DELETE("/users/:id", deleteUser)
    }
}

func getUser(c *gin.Context) {
    id := c.Param("id")
    user, err := userRepo.FindByID(c, id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{
            "type":   "https://api.example.com/errors/not-found",
            "title":  "Not Found",
            "status": 404,
            "detail": fmt.Sprintf("User %s not found", id),
        })
        return
    }
    c.Header("ETag", fmt.Sprintf(`"%d"`, user.Version))
    c.Header("Cache-Control", "private, max-age=60")
    c.JSON(http.StatusOK, user)
}

func createUser(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusUnprocessableEntity, gin.H{
            "type":   "https://api.example.com/errors/validation",
            "title":  "Validation Error",
            "status": 422,
            "detail": err.Error(),
        })
        return
    }
    user, _ := userRepo.Create(c, &req)
    c.Header("Location", fmt.Sprintf("/api/users/%s", user.ID))
    c.JSON(http.StatusCreated, user)
}
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Verbs in URIs | `GET /getUsers`, `POST /createUser` | Use nouns: `GET /users`, `POST /users` |
| 200 for everything | `200 OK { "error": "not found" }` | Use proper status codes: 404, 422, 500 |
| GET with side effects | `GET /users/42/delete` | Use `DELETE /users/42` |
| PUT for partial updates | Sending only changed fields via PUT | Use PATCH for partial updates |
| Server-side sessions | `Cookie: JSESSIONID=abc` for REST | Use stateless tokens (Bearer JWT) |
| No Location on 201 | POST returns 201 without Location header | ALWAYS include `Location: /resource/{id}` |
| Stack traces in production | `{ "stack": "at com.example..." }` | Log server-side, return generic error + request_id |
| No Content-Type header | Missing on requests and responses | ALWAYS include `Content-Type: application/json` |
| Auth tokens in URLs | `?token=sk_live_abc` | Use `Authorization: Bearer` header |
| Inconsistent status codes | 200 for create, 200 for delete, 200 for errors | Follow the status code decision tree consistently |
| Custom HTTP methods | `PURGE /cache/users` | Use `POST /cache/users/purge` |
| No versioning | API evolves without version identifier | Version from day one, even if just `/v1/` |

---

## 10. Enforcement Checklist

- [ ] Every resource has a unique URI using nouns, not verbs
- [ ] HTTP methods used semantically (GET=read, POST=create, PUT=replace, PATCH=update, DELETE=remove)
- [ ] Every request is self-contained — no server-side session state
- [ ] GET requests have no side effects and are cacheable
- [ ] POST returns `201 Created` with `Location` header
- [ ] DELETE returns `204 No Content`
- [ ] `Content-Type` header set on every request and response with a body
- [ ] `Accept` header respected; `406` returned for unsupported formats
- [ ] Proper status codes used (never 200 for errors)
- [ ] `Cache-Control` headers set on every response
- [ ] `ETag` used for conditional requests where applicable
- [ ] Authentication via `Authorization` header, not URL parameters
- [ ] Stack traces NEVER exposed in production responses
- [ ] API versioned from day one
- [ ] 401 used for authentication failures, 403 for authorization failures
- [ ] 429 includes `Retry-After` header
- [ ] 503 includes `Retry-After` header
- [ ] All responses include `X-Request-Id` for correlation
