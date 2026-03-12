# API Versioning

> **Domain:** Backend > API > REST
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03-09

## Table of Contents

- [What It Is](#what-it-is)
- [Why It Matters](#why-it-matters)
- [Versioning Strategies](#versioning-strategies)
  - [URL Path Versioning](#1-url-path-versioning)
  - [Header Versioning](#2-header-versioning-custom-header)
  - [Content Negotiation Versioning](#3-content-negotiation-versioning-accept-header)
  - [Query Parameter Versioning](#4-query-parameter-versioning)
- [Strategy Comparison Matrix](#strategy-comparison-matrix)
- [Breaking vs Non-Breaking Changes](#breaking-vs-non-breaking-changes)
- [Semantic Versioning for APIs](#semantic-versioning-for-apis)
- [API Evolution Without Versioning](#api-evolution-without-versioning)
- [Deprecation Strategy](#deprecation-strategy)
- [Sunset Headers (RFC 8594)](#sunset-headers-rfc-8594)
- [API Changelog Maintenance](#api-changelog-maintenance)
- [Multiple Version Support](#multiple-version-support)
- [Version Negotiation](#version-negotiation)
- [Backend Implementation](#backend-implementation)
- [OpenAPI Spec Per Version](#openapi-spec-per-version)
- [Real-World Versioning Case Studies](#real-world-versioning-case-studies)
- [Decision Tree](#decision-tree)
- [Best Practices](#best-practices)
- [Anti-patterns / Common Mistakes](#anti-patterns--common-mistakes)
- [Sources](#sources)

---

## What It Is

API versioning is the practice of managing changes to an API by assigning distinct identifiers (versions) to different states of the API contract. It enables API producers to evolve their APIs while giving consumers stability guarantees and migration time.

**Core problem:** APIs are contracts. Once a client depends on a response shape, changing it breaks that client. Versioning provides a mechanism to introduce changes without breaking existing integrations.

**Key distinction:** Versioning is about **contract management**, not code deployment. A single deployment can serve multiple API versions simultaneously.

---

## Why It Matters

- **Client Stability:** Mobile apps cannot be force-updated. Old API versions must remain functional.
- **Enterprise Contracts:** B2B integrations often have SLAs specifying minimum API availability timelines.
- **Gradual Migration:** Consumers need time to adapt to new API shapes.
- **Independent Evolution:** Backend teams should not be blocked by client update cycles.
- **Regulatory Compliance:** Some industries require audit trails of API changes.
- **Partner Ecosystem:** Third-party developers need predictable, stable interfaces.

---

## Versioning Strategies

### 1. URL Path Versioning

The version identifier is embedded directly in the URL path.

```
GET /v1/users/123
GET /v2/users/123
GET /api/v3/products
```

**Implementation (Express/TypeScript):**

```typescript
// File: src/routes/index.ts
import { Router } from 'express';
import v1Routes from './v1';
import v2Routes from './v2';

const router = Router();
router.use('/v1', v1Routes);
router.use('/v2', v2Routes);
export default router;

// File: src/routes/v1/users.ts
import { Router } from 'express';
const router = Router();

router.get('/users/:id', async (req, res) => {
  const user = await getUserV1(req.params.id);
  res.json({
    id: user.id,
    name: user.name,        // v1: single name field
    email: user.email,
  });
});

export default router;

// File: src/routes/v2/users.ts
import { Router } from 'express';
const router = Router();

router.get('/users/:id', async (req, res) => {
  const user = await getUserV2(req.params.id);
  res.json({
    id: user.id,
    first_name: user.firstName,   // v2: split name into parts
    last_name: user.lastName,
    email: user.email,
    avatar_url: user.avatarUrl,   // v2: new field
  });
});

export default router;
```

**Implementation (FastAPI/Python):**

```python
# File: app/main.py
from fastapi import FastAPI
from app.api.v1 import router as v1_router
from app.api.v2 import router as v2_router

app = FastAPI()
app.include_router(v1_router, prefix="/v1")
app.include_router(v2_router, prefix="/v2")

# File: app/api/v1/users.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/users/{user_id}")
async def get_user_v1(user_id: int):
    user = await fetch_user(user_id)
    return {
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
    }

# File: app/api/v2/users.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/users/{user_id}")
async def get_user_v2(user_id: int):
    user = await fetch_user(user_id)
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "avatar_url": user.avatar_url,
    }
```

**Pros:**
- Extremely simple to understand and implement
- Immediately visible in URLs, logs, documentation, and curl commands
- Easy to route at the load balancer / API gateway level (nginx, Kong, AWS API Gateway)
- Trivial to cache (different URLs = different cache keys)
- Easy for developers to test (change the URL, get different behavior)
- Works perfectly with OpenAPI/Swagger (one spec per version)
- Easy to sunset: remove a route prefix entirely

**Cons:**
- Violates REST purist principle: the URI should identify a **resource**, not a representation. `/v1/users/123` and `/v2/users/123` are the same resource, yet have different URIs
- URL proliferation: every version multiplies all resource URLs
- Clients must update base URLs to adopt new versions
- Can lead to "version sprawl" if not managed with a deprecation strategy
- Resource identity ambiguity: is `/v1/users/123` the same resource as `/v2/users/123`?

**When to use:**
- Public-facing APIs with many third-party consumers
- When simplicity and discoverability are priorities
- When you expect major breaking changes between versions
- When your infrastructure uses URL-based routing (most API gateways)
- When you need per-version rate limiting or access control

**Used by:** Google APIs, Facebook Graph API, Twitter/X API, PayPal

---

### 2. Header Versioning (Custom Header)

The version is passed via a custom HTTP header.

```
GET /users/123
Api-Version: 2
```

**Implementation (Express/TypeScript):**

```typescript
// Middleware: src/middleware/apiVersion.ts
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      apiVersion: number;
    }
  }
}

export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction) {
  const versionHeader = req.headers['api-version'];

  if (!versionHeader) {
    req.apiVersion = 1; // default to v1
  } else {
    const version = parseInt(versionHeader as string, 10);
    if (isNaN(version) || version < 1 || version > 3) {
      return res.status(400).json({
        error: 'invalid_api_version',
        message: `Supported versions: 1, 2, 3. Received: ${versionHeader}`,
        supported_versions: [1, 2, 3],
      });
    }
    req.apiVersion = version;
  }

  // Set response header to confirm version used
  res.setHeader('Api-Version', req.apiVersion.toString());
  next();
}

// Route handler with version branching
router.get('/users/:id', async (req, res) => {
  const user = await getUser(req.params.id);

  switch (req.apiVersion) {
    case 1:
      return res.json({ id: user.id, name: user.name, email: user.email });
    case 2:
      return res.json({
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        avatar_url: user.avatarUrl,
      });
    case 3:
      return res.json({
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
        email_addresses: user.emails,     // v3: multiple emails
        avatar_url: user.avatarUrl,
        created_at: user.createdAt,       // v3: timestamps
        updated_at: user.updatedAt,
      });
    default:
      return res.status(400).json({ error: 'unsupported_version' });
  }
});
```

**Implementation (FastAPI/Python):**

```python
from fastapi import APIRouter, Header, HTTPException

router = APIRouter()

@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    api_version: int = Header(default=1, alias="Api-Version")
):
    if api_version not in (1, 2):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported API version: {api_version}. Supported: 1, 2"
        )

    user = await fetch_user(user_id)

    if api_version == 1:
        return {"id": user.id, "name": user.full_name, "email": user.email}
    elif api_version == 2:
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "avatar_url": user.avatar_url,
        }
```

**Pros:**
- Clean URLs: resource identity is preserved (`/users/123` is always the same resource)
- Version can be changed without modifying URLs or API client configurations
- Follows REST principles more closely
- Easy to set a default version
- Can coexist with URL-based routing

**Cons:**
- Less discoverable: version is hidden in headers, not visible in browser URL bar
- Harder to test casually (need tools like curl, Postman, or custom headers)
- Caching complexity: must include the version header in cache keys (`Vary: Api-Version`)
- Some HTTP clients / proxies strip custom headers
- Harder to document (need to explain header requirement to every consumer)
- Load balancer routing based on headers is more complex than URL-based routing

**When to use:**
- Internal APIs where consumers are controlled
- When you want clean resource-based URLs
- When changes between versions are minimal
- When combined with content negotiation

**Used by:** Azure DevOps API (optional header alongside URL versioning)

---

### 3. Content Negotiation Versioning (Accept Header)

Uses the standard HTTP `Accept` header with vendor-specific media types.

```
GET /users/123
Accept: application/vnd.mycompany.user.v2+json
```

**The format follows the pattern:**
```
application/vnd.{vendor}.{resource}.v{version}+{format}
```

**Implementation (Express/TypeScript):**

```typescript
// Middleware: src/middleware/contentNegotiation.ts
import { Request, Response, NextFunction } from 'express';

interface VersionInfo {
  version: number;
  resource: string;
  format: string;
}

export function parseAcceptVersion(accept: string): VersionInfo | null {
  // Match: application/vnd.mycompany.{resource}.v{version}+{format}
  const regex = /application\/vnd\.mycompany\.(\w+)\.v(\d+)\+(\w+)/;
  const match = accept.match(regex);

  if (!match) return null;

  return {
    resource: match[1],
    version: parseInt(match[2], 10),
    format: match[3],
  };
}

export function contentNegotiationMiddleware(
  req: Request, res: Response, next: NextFunction
) {
  const accept = req.headers.accept || 'application/json';

  if (accept === 'application/json') {
    req.apiVersion = 1; // default
    return next();
  }

  const versionInfo = parseAcceptVersion(accept);

  if (!versionInfo) {
    return res.status(406).json({
      error: 'not_acceptable',
      message: 'Invalid Accept header format',
      expected: 'application/vnd.mycompany.{resource}.v{N}+json',
    });
  }

  req.apiVersion = versionInfo.version;
  res.setHeader('Content-Type',
    `application/vnd.mycompany.${versionInfo.resource}.v${versionInfo.version}+json`
  );
  next();
}
```

**Implementation (FastAPI/Python):**

```python
import re
from fastapi import APIRouter, Request, HTTPException

router = APIRouter()

def parse_accept_version(accept: str) -> int:
    """Parse version from Accept header like application/vnd.mycompany.user.v2+json"""
    match = re.search(r'application/vnd\.mycompany\.\w+\.v(\d+)\+json', accept)
    if match:
        return int(match.group(1))
    return 1  # default version

@router.get("/users/{user_id}")
async def get_user(request: Request, user_id: int):
    accept = request.headers.get("accept", "application/json")
    version = parse_accept_version(accept)

    user = await fetch_user(user_id)

    if version == 1:
        return {"id": user.id, "name": user.full_name}
    elif version == 2:
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
    else:
        raise HTTPException(status_code=406, detail=f"Version {version} not supported")
```

**Pros:**
- Most RESTful approach: uses standard HTTP content negotiation
- Clean resource URLs preserved
- Can version individual resources independently
- Leverages the `Accept` / `Content-Type` headers as intended by HTTP specification
- Different representations of the same resource (the core REST concept)

**Cons:**
- Complex to implement and test
- Hard to discover: requires reading documentation to know the media type format
- Client libraries must be configured to send custom Accept headers
- Caching must use `Vary: Accept` which can reduce cache hit rates
- Parsing vendor media types is error-prone
- Difficult to browse in a web browser

**When to use:**
- When strict REST compliance is required
- When different resources may need to evolve at different rates
- For mature API platforms with sophisticated consumers

**Used by:** GitHub API (partial: `Accept: application/vnd.github.v3+json`)

---

### 4. Query Parameter Versioning

The version is passed as a URL query parameter.

```
GET /users/123?version=2
GET /users/123?api-version=2024-01-15
```

**Implementation (Express/TypeScript):**

```typescript
router.get('/users/:id', async (req, res) => {
  const version = parseInt(req.query.version as string) || 1;

  if (![1, 2].includes(version)) {
    return res.status(400).json({
      error: 'invalid_version',
      message: `Supported versions: 1, 2. Received: ${version}`,
    });
  }

  const user = await getUser(req.params.id);

  if (version === 1) {
    return res.json({ id: user.id, name: user.name });
  }
  return res.json({
    id: user.id,
    first_name: user.firstName,
    last_name: user.lastName,
  });
});
```

**Pros:**
- Easy to use and test (just add `?version=2` to any request)
- Visible in URLs and logs
- No custom header configuration needed in clients
- Good for quick prototyping

**Cons:**
- Pollutes the query string (version is not a query/filter parameter)
- Optional query params make it easy to forget and get unexpected behavior
- Complicates caching (different query strings = different cache entries, but CDNs may strip or reorder params)
- Not recommended by most API design guides (Microsoft REST guidelines, Google API design guide)
- Mixes API metadata with resource filtering concerns
- Hard to enforce: query params are inherently optional

**When to use:**
- Rarely recommended for production APIs
- Acceptable for internal tools, admin APIs, or debugging endpoints
- Can work for date-based versioning (Azure: `?api-version=2024-01-15`)

**Used by:** Microsoft Azure REST APIs (`?api-version=2023-10-01`), Google Cloud (some endpoints)

---

## Strategy Comparison Matrix

| Criteria | URL Path | Custom Header | Accept Header | Query Param |
|---|---|---|---|---|
| **Discoverability** | Excellent | Poor | Poor | Good |
| **REST Compliance** | Low | Medium | High | Low |
| **Implementation Ease** | Easy | Medium | Hard | Easy |
| **Cacheability** | Excellent | Needs Vary | Needs Vary | Good |
| **Browser Testing** | Easy | Impossible | Impossible | Easy |
| **API Gateway Routing** | Trivial | Moderate | Complex | Moderate |
| **Client Complexity** | Low | Medium | High | Low |
| **Independent Resource Versioning** | No | No | Yes | No |
| **URL Cleanliness** | Poor | Excellent | Excellent | Poor |
| **Adoption Rate** | Very High | Low | Low | Medium |
| **OpenAPI Support** | Excellent | Good | Complex | Good |

**Recommendation for most teams:** Use **URL path versioning** for public APIs and **header versioning** for internal APIs. The pragmatic benefits of URL versioning outweigh the theoretical REST purity of content negotiation for the vast majority of use cases.

---

## Breaking vs Non-Breaking Changes

Understanding which changes break API consumers is critical for deciding when to bump versions.

### Breaking Changes (REQUIRE a new version)

```
Category: Field Removal
  - Removing a field from a response body
  - Before: { "id": 1, "name": "Alice", "email": "a@b.com" }
  - After:  { "id": 1, "name": "Alice" }  // email removed -- BREAKING

Category: Field Rename
  - Renaming a field in request or response
  - Before: { "name": "Alice" }
  - After:  { "full_name": "Alice" }  // renamed -- BREAKING

Category: Type Change
  - Changing the data type of a field
  - Before: { "id": 1 }           // number
  - After:  { "id": "uuid-123" }  // string -- BREAKING

Category: Behavior Change
  - Changing what an endpoint does with the same input
  - Before: DELETE /users/123 returns 200 with user object
  - After:  DELETE /users/123 returns 204 with no body -- BREAKING

Category: Endpoint Removal
  - Removing an endpoint entirely
  - Before: GET /users/123/preferences exists
  - After:  404 -- BREAKING

Category: URL Structure Change
  - Changing the URL pattern for an existing resource
  - Before: GET /users/123/orders
  - After:  GET /orders?user_id=123  // restructured -- BREAKING

Category: Authentication Change
  - Changing auth requirements
  - Before: API key in query string
  - After:  Bearer token required -- BREAKING

Category: Required Field Addition (Request)
  - Adding a new required field to a request body
  - Before: POST /users { "name": "Alice" }
  - After:  POST /users { "name": "Alice", "email": "required" }  -- BREAKING

Category: Enum Value Removal
  - Removing a valid enum value
  - Before: status can be "active", "inactive", "pending"
  - After:  status can be "active", "inactive"  -- BREAKING (pending no longer valid)

Category: Pagination Change
  - Changing default page size or pagination mechanism
  - Before: offset-based, default 20 items
  - After:  cursor-based -- BREAKING

Category: Error Format Change
  - Changing the structure of error responses
  - Before: { "error": "not_found" }
  - After:  { "errors": [{ "code": "NOT_FOUND", "message": "..." }] }  -- BREAKING

Category: Rate Limit Reduction
  - Significantly reducing rate limits
  - Before: 1000 req/min
  - After:  100 req/min -- BREAKING (can break client workflows)
```

### Non-Breaking Changes (Safe without new version)

```
Category: Adding Optional Response Fields
  - Before: { "id": 1, "name": "Alice" }
  - After:  { "id": 1, "name": "Alice", "avatar_url": "..." }  -- SAFE
  - Rule: Clients MUST ignore unknown fields (robustness principle)

Category: Adding New Endpoints
  - Adding GET /users/123/preferences -- SAFE
  - Existing endpoints are unaffected

Category: Adding Optional Request Fields
  - Before: POST /users { "name": "Alice" }
  - After:  POST /users { "name": "Alice", "nickname": "Ali" }  -- SAFE
  - New field is optional with a sensible default

Category: Adding New Enum Values
  - Before: status can be "active", "inactive"
  - After:  status can be "active", "inactive", "suspended"  -- SAFE*
  - *Warning: only safe if clients handle unknown enum values gracefully

Category: Adding New HTTP Methods to Existing Resources
  - Adding PATCH /users/123 when only PUT existed -- SAFE

Category: Expanding Value Constraints
  - Before: name max 50 chars
  - After:  name max 100 chars -- SAFE (more permissive)

Category: Adding New Query Parameters
  - Adding ?include=profile to GET /users/123 -- SAFE

Category: Performance Improvements
  - Faster response times, better compression -- SAFE

Category: Adding New Response Headers
  - Adding X-Request-Id, X-RateLimit-Remaining -- SAFE
```

### Gray Area Changes (Require judgment)

```typescript
// Adding new enum values -- safe ONLY if clients use:
// "default" case in switch statements
switch (user.status) {
  case 'active': handleActive(); break;
  case 'inactive': handleInactive(); break;
  default: handleUnknown(); break; // <-- This makes adding enums safe
}

// Changing field from required to optional -- often safe
// Before: { "name": "Alice" }  (always present)
// After:  { "name": null }     (can be null)
// Depends on whether clients handle null properly

// Changing error codes -- safe if clients don't match on specific codes
// Dangerous if clients have: if (error.code === 'USER_NOT_FOUND')

// Tightening input validation -- usually breaking
// Before: name accepts any string
// After:  name must be 2-100 alphanumeric characters
// Previously valid requests now fail
```

---

## Semantic Versioning for APIs

Semantic versioning (SemVer) can be applied to APIs, but the conventions differ from library versioning.

### SemVer Applied to APIs

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes (field removals, type changes, endpoint removals)
MINOR: Non-breaking additions (new endpoints, new optional fields)
PATCH: Bug fixes, documentation updates, no contract change
```

### API Version vs SemVer

Most APIs expose only the **MAJOR** version in the URL or header:

```
/v1/users   -- represents all 1.x.y releases
/v2/users   -- represents all 2.x.y releases
```

The full SemVer is typically communicated in:
- Response headers: `X-Api-Version: 2.3.1`
- API documentation
- Changelogs

```typescript
// Express middleware to expose full version
app.use((req, res, next) => {
  res.setHeader('X-Api-Version', '2.3.1');
  res.setHeader('X-Api-Major-Version', '2');
  next();
});
```

### When NOT to use SemVer for APIs

- **Date-based versioning** is preferred by many large API providers (Stripe, Twilio) because:
  - API changes are incremental, not easily categorized as major/minor/patch
  - Dates are intuitive: consumers know exactly when a version was released
  - No ambiguity about what constitutes a "major" vs "minor" API change

---

## API Evolution Without Versioning

Some API designers advocate for evolving APIs **without** traditional versioning by making only additive (non-breaking) changes.

### Principles

1. **Never remove fields** -- deprecate them (return `null` or a sentinel value)
2. **Never rename fields** -- add the new field, keep the old one
3. **Never change types** -- add a new field with the new type
4. **Add, never remove** -- only additive changes to the schema

### Example: Evolving Without Breaking

```json
// Initial release
{
  "id": 1,
  "name": "Alice Smith"
}

// Evolution 1: Need split names -- add fields, keep old
{
  "id": 1,
  "name": "Alice Smith",          // kept for backwards compatibility
  "first_name": "Alice",          // new
  "last_name": "Smith"            // new
}

// Evolution 2: Need multiple emails -- add field, keep old
{
  "id": 1,
  "name": "Alice Smith",
  "first_name": "Alice",
  "last_name": "Smith",
  "email": "alice@example.com",           // kept for backwards compat
  "email_addresses": [                     // new
    { "email": "alice@example.com", "primary": true },
    { "email": "alice@work.com", "primary": false }
  ]
}
```

### When This Approach Works

- Internal APIs with controlled consumers
- APIs with a small number of clients
- When the API is young and evolving rapidly
- GraphQL APIs (clients specify exactly which fields they need)

### When This Approach Fails

- When fundamental data model restructuring is needed
- When response payloads become bloated with deprecated fields
- When you need to change authentication or authorization models
- When you have hundreds of third-party integrations depending on specific behavior

---

## Deprecation Strategy

### Deprecation Timeline (Recommended)

```
Phase 1: Announcement (T-12 months minimum for major APIs)
  - Announce deprecation in changelog, blog, developer portal
  - Add Deprecation and Sunset headers to responses
  - Begin sending notification emails to API key holders
  - Update documentation to mark endpoints/fields as deprecated

Phase 2: Migration Period (T-6 months)
  - Provide migration guides with before/after examples
  - Offer migration tooling (codemods, compatibility shims)
  - Track migration progress per consumer
  - Host migration office hours or provide dedicated support

Phase 3: Warning Period (T-3 months)
  - Increase warning frequency in responses
  - Return deprecation warnings in response body
  - Contact consumers who have not migrated
  - Consider rate-limiting deprecated endpoints

Phase 4: Sunset (T=0)
  - Deprecated endpoint returns 410 Gone (not 404)
  - Response body includes migration instructions
  - Keep this 410 response for at least 6 months after sunset
  - Log any remaining callers for follow-up

Phase 5: Removal (T+6 months)
  - Remove code, return 404
  - Clean up internal routing
```

### Communication Template

```json
// Deprecation notice in response headers
{
  "Deprecation": "Sat, 01 Jul 2025 00:00:00 GMT",
  "Sunset": "Sat, 31 Dec 2025 23:59:59 GMT",
  "Link": "<https://api.example.com/docs/migration/v2>; rel=\"deprecation\"; type=\"text/html\""
}

// Deprecation notice in response body (optional, helpful)
{
  "data": { ... },
  "_deprecation": {
    "message": "This endpoint is deprecated. Use /v2/users instead.",
    "sunset_date": "2025-12-31",
    "migration_guide": "https://api.example.com/docs/migration/v1-to-v2",
    "replacement_endpoint": "/v2/users"
  }
}
```

### Deprecation Middleware (TypeScript)

```typescript
import { Request, Response, NextFunction } from 'express';

interface DeprecationConfig {
  deprecationDate: string;  // ISO date when deprecation was announced
  sunsetDate: string;       // ISO date when endpoint will be removed
  migrationGuide: string;   // URL to migration documentation
  replacement?: string;     // Replacement endpoint, if any
}

export function deprecated(config: DeprecationConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const sunsetDate = new Date(config.sunsetDate);
    const now = new Date();

    // Set standard headers
    res.setHeader('Deprecation', new Date(config.deprecationDate).toUTCString());
    res.setHeader('Sunset', sunsetDate.toUTCString());
    res.setHeader('Link',
      `<${config.migrationGuide}>; rel="deprecation"; type="text/html"`
    );

    // If past sunset date, return 410 Gone
    if (now > sunsetDate) {
      return res.status(410).json({
        error: 'gone',
        message: 'This endpoint has been sunset.',
        migration_guide: config.migrationGuide,
        replacement: config.replacement,
        sunset_date: config.sunsetDate,
      });
    }

    // Log usage for tracking migration progress
    console.warn(`Deprecated endpoint accessed: ${req.method} ${req.path}`, {
      consumer: req.headers['x-api-key'] || 'unknown',
      deprecation_date: config.deprecationDate,
      sunset_date: config.sunsetDate,
    });

    next();
  };
}

// Usage
router.get('/users/:id', deprecated({
  deprecationDate: '2025-01-15',
  sunsetDate: '2025-12-31',
  migrationGuide: 'https://api.example.com/docs/migration/users-v2',
  replacement: '/v2/users/:id',
}), getUserV1);
```

### Deprecation Middleware (Python/FastAPI)

```python
from datetime import datetime
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

class DeprecationMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, deprecated_routes: dict):
        super().__init__(app)
        self.deprecated_routes = deprecated_routes

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        for pattern, config in self.deprecated_routes.items():
            if path.startswith(pattern):
                sunset_date = datetime.fromisoformat(config["sunset_date"])

                if datetime.utcnow() > sunset_date:
                    return Response(
                        content='{"error": "gone", "message": "Endpoint sunset"}',
                        status_code=410,
                        media_type="application/json",
                    )

                response = await call_next(request)
                response.headers["Deprecation"] = config["deprecation_date"]
                response.headers["Sunset"] = sunset_date.strftime(
                    "%a, %d %b %Y %H:%M:%S GMT"
                )
                response.headers["Link"] = (
                    f'<{config["migration_guide"]}>; '
                    f'rel="deprecation"; type="text/html"'
                )
                return response

        return await call_next(request)

# Usage
deprecated_routes = {
    "/v1/users": {
        "deprecation_date": "2025-01-15",
        "sunset_date": "2025-12-31",
        "migration_guide": "https://api.example.com/docs/migration/users-v2",
    },
}

app.add_middleware(DeprecationMiddleware, deprecated_routes=deprecated_routes)
```

---

## Sunset Headers (RFC 8594)

RFC 8594 defines the `Sunset` HTTP response header to communicate the date after which a resource will become unavailable.

### Specification

```http
HTTP/1.1 200 OK
Sunset: Sat, 31 Dec 2025 23:59:59 GMT
```

- **Format:** HTTP date (RFC 7231 Section 7.1.1.1)
- **Meaning:** The resource **will become unresponsive** at or after this date
- **Scope:** Applies to the specific resource (URL) that returned the header

### Complementary Headers

```http
HTTP/1.1 200 OK
Sunset: Sat, 31 Dec 2025 23:59:59 GMT
Deprecation: Sat, 01 Jul 2025 00:00:00 GMT
Link: <https://api.example.com/docs/sunset/users-v1>; rel="sunset"; type="text/html"
Link: <https://api.example.com/v2/users>; rel="successor-version"
```

**Key headers:**
- `Sunset` -- when the resource will be removed (RFC 8594)
- `Deprecation` -- when the deprecation was announced (draft RFC)
- `Link` with `rel="sunset"` -- link to human-readable sunset documentation
- `Link` with `rel="successor-version"` -- link to the replacement resource

### Client-Side Sunset Handling (TypeScript)

```typescript
import axios, { AxiosResponse } from 'axios';

// Axios interceptor to detect and warn about sunset headers
axios.interceptors.response.use((response: AxiosResponse) => {
  const sunsetHeader = response.headers['sunset'];
  const deprecationHeader = response.headers['deprecation'];

  if (sunsetHeader) {
    const sunsetDate = new Date(sunsetHeader);
    const now = new Date();
    const daysUntilSunset = Math.ceil(
      (sunsetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilSunset <= 90) {
      console.warn(
        `[API SUNSET WARNING] ${response.config.url} will be removed in ${daysUntilSunset} days (${sunsetHeader}).`
      );
    }

    if (daysUntilSunset <= 30) {
      // Send alert to monitoring system
      alertSunsetImminent(response.config.url!, sunsetDate, daysUntilSunset);
    }
  }

  if (deprecationHeader) {
    console.warn(
      `[API DEPRECATION] ${response.config.url} is deprecated since ${deprecationHeader}.`
    );
  }

  return response;
});
```

---

## API Changelog Maintenance

### Changelog Format

```markdown
# API Changelog

## 2025-03-01 (v2.4.0)
### Added
- `GET /users/{id}/preferences` - New endpoint for user preferences
- `avatar_url` field added to user response object
- `include` query parameter for related resource embedding

### Changed
- `GET /users` default page size increased from 20 to 25

### Deprecated
- `GET /users/{id}/settings` - Use `/users/{id}/preferences` instead
  - Sunset date: 2025-12-31
  - Migration guide: https://api.example.com/docs/migration/preferences

### Fixed
- `PATCH /users/{id}` now correctly returns 200 instead of 204 when body is present

---

## 2025-01-15 (v2.3.0)
### Added
- `suspended` status value added to user status enum
- Rate limit headers now included in all responses

### Security
- API keys now require minimum 32-character length
```

### Automated Changelog Generation

```typescript
// changelog-generator.ts
interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  deprecated: Array<{
    description: string;
    sunsetDate: string;
    migrationGuide: string;
  }>;
  removed: string[];
  fixed: string[];
  security: string[];
}

function generateChangelog(entries: ChangelogEntry[]): string {
  let markdown = '# API Changelog\n\n';

  for (const entry of entries) {
    markdown += `## ${entry.date} (${entry.version})\n\n`;

    if (entry.added.length > 0) {
      markdown += '### Added\n';
      entry.added.forEach(item => { markdown += `- ${item}\n`; });
      markdown += '\n';
    }

    if (entry.deprecated.length > 0) {
      markdown += '### Deprecated\n';
      entry.deprecated.forEach(item => {
        markdown += `- ${item.description}\n`;
        markdown += `  - Sunset: ${item.sunsetDate}\n`;
        markdown += `  - Migration: ${item.migrationGuide}\n`;
      });
      markdown += '\n';
    }

    if (entry.removed.length > 0) {
      markdown += '### Removed\n';
      entry.removed.forEach(item => { markdown += `- ${item}\n`; });
      markdown += '\n';
    }

    markdown += '---\n\n';
  }

  return markdown;
}
```

---

## Multiple Version Support

### How Many Versions to Maintain

| API Type | Recommended Active Versions | Rationale |
|---|---|---|
| Public API (large ecosystem) | 2-3 | Large consumer base, slow migration |
| Public API (small ecosystem) | 1-2 | Manageable to coordinate migration |
| Internal API | 1 (current) | Can coordinate deployment |
| Partner API (B2B) | 2 | Contract obligations |
| Mobile backend | 2-3 | App store update lag |

**Rules of thumb:**
- Never maintain more than **3 active versions** unless you have a dedicated API platform team
- Each additional version multiplies testing, documentation, and support costs
- Budget approximately **20-30% additional maintenance cost per active version**
- Mobile backends may need more versions due to app store update cycles (users on old app versions)

### Version Lifecycle States

```
ACTIVE      --> The current recommended version
MAINTAINED  --> Still supported, receiving bug/security fixes, but not new features
DEPRECATED  --> Announced for removal, sunset date set
SUNSET      --> Returns 410 Gone, no longer functional
REMOVED     --> Returns 404, code deleted
```

### Tracking Consumer Migration

```typescript
// Middleware to track which consumers use which versions
async function trackVersionUsage(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  const version = req.apiVersion;

  // Fire-and-forget analytics
  trackEvent('api_version_usage', {
    api_key: apiKey,
    version,
    endpoint: `${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  }).catch(() => {}); // non-blocking

  next();
}
```

---

## Version Negotiation

### Latest vs Pinned

**Pinned (recommended for production):**
```http
GET /v2/users/123
Accept: application/vnd.mycompany.user.v2+json
Api-Version: 2
```
Client explicitly requests a specific version. Behavior is predictable and stable.

**Latest (opt-in, dangerous):**
```http
GET /users/123
Api-Version: latest
```
Client receives the newest version. Useful for development/testing, dangerous for production because API responses may change unexpectedly.

### Implementation

```typescript
function resolveVersion(req: Request): number {
  const requestedVersion = req.headers['api-version'] as string;

  const LATEST_VERSION = 3;
  const SUPPORTED_VERSIONS = [1, 2, 3];
  const DEFAULT_VERSION = 2;  // not necessarily latest

  if (!requestedVersion) {
    return DEFAULT_VERSION;
  }

  if (requestedVersion === 'latest') {
    return LATEST_VERSION;
  }

  const version = parseInt(requestedVersion, 10);

  if (!SUPPORTED_VERSIONS.includes(version)) {
    throw new ApiError(400, `Version ${version} is not supported. Supported: ${SUPPORTED_VERSIONS.join(', ')}`);
  }

  return version;
}
```

### Default Version Policy

- **Conservative (recommended):** Default to the oldest supported version to avoid breaking clients that do not specify a version
- **Progressive:** Default to the latest version; requires all clients to pin a version explicitly
- **Stripe approach:** Each API key has a pinned version (the version active when the key was created). Consumers must explicitly upgrade.

---

## Backend Implementation

### Approach 1: Version Folders (Separate Route Files)

```
src/
  routes/
    v1/
      users.ts
      orders.ts
      products.ts
      index.ts
    v2/
      users.ts      // only endpoints that changed
      orders.ts
      index.ts      // imports unchanged routes from v1
    v3/
      users.ts
      index.ts
  services/
    userService.ts  // shared business logic
    orderService.ts
  transformers/
    v1/
      userTransformer.ts
    v2/
      userTransformer.ts
```

**Key pattern:** Route handlers are versioned, but **services and data access are shared**. Only the **transformer/serializer** layer differs between versions.

```typescript
// src/transformers/v1/userTransformer.ts
import { User } from '../../models/User';

export function transformUserV1(user: User) {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.primaryEmail,
  };
}

// src/transformers/v2/userTransformer.ts
import { User } from '../../models/User';

export function transformUserV2(user: User) {
  return {
    id: user.id,
    first_name: user.firstName,
    last_name: user.lastName,
    email: user.primaryEmail,
    avatar_url: user.avatarUrl,
    created_at: user.createdAt.toISOString(),
  };
}

// src/routes/v1/users.ts
import { transformUserV1 } from '../../transformers/v1/userTransformer';
import { userService } from '../../services/userService';

router.get('/users/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.json(transformUserV1(user));
});

// src/routes/v2/users.ts
import { transformUserV2 } from '../../transformers/v2/userTransformer';
import { userService } from '../../services/userService';

router.get('/users/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.json(transformUserV2(user));
});
```

**Pros:** Clear separation, easy to understand, easy to delete old versions
**Cons:** Code duplication in route handlers, can get out of sync

### Approach 2: Feature Flags / Version Switches

```typescript
// Single route handler with version branching
router.get('/users/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);
  const version = req.apiVersion;

  const transformer = getTransformer('user', version);
  res.json(transformer(user));
});

// Transformer registry
const transformers: Record<string, Record<number, Function>> = {
  user: {
    1: transformUserV1,
    2: transformUserV2,
    3: transformUserV3,
  },
  order: {
    1: transformOrderV1,
    2: transformOrderV2,
  },
};

function getTransformer(resource: string, version: number): Function {
  const resourceTransformers = transformers[resource];
  if (!resourceTransformers) throw new Error(`No transformers for ${resource}`);

  // Fall back to the highest version <= requested version
  const availableVersions = Object.keys(resourceTransformers)
    .map(Number)
    .sort((a, b) => b - a);

  const matchedVersion = availableVersions.find(v => v <= version);
  if (!matchedVersion) throw new Error(`No transformer for ${resource} v${version}`);

  return resourceTransformers[matchedVersion];
}
```

**Pros:** No code duplication, single source of truth for routing
**Cons:** Complex branching logic, harder to delete old versions, risk of unintended cross-version effects

### Approach 3: Stripe-Style Version Compatibility Layer

Stripe uses a chain of version transforms. Each version is a set of changes applied to the latest internal representation.

```typescript
// Each version change is a small, reversible transform
interface VersionChange {
  version: string;       // e.g., "2024-06-15"
  description: string;
  transform(response: any, resource: string): any;
}

const versionChanges: VersionChange[] = [
  {
    version: '2024-06-15',
    description: 'Split name into first_name and last_name',
    transform(response, resource) {
      if (resource === 'user' && response.first_name) {
        // Reverse the change for older versions
        response.name = `${response.first_name} ${response.last_name}`;
        delete response.first_name;
        delete response.last_name;
      }
      return response;
    },
  },
  {
    version: '2024-09-01',
    description: 'Changed email to email_addresses array',
    transform(response, resource) {
      if (resource === 'user' && response.email_addresses) {
        response.email = response.email_addresses.find(
          (e: any) => e.primary
        )?.email;
        delete response.email_addresses;
      }
      return response;
    },
  },
];

// Apply transforms: start with latest format, apply reverse changes
// for each version change newer than the client's pinned version
function applyVersionTransforms(
  response: any,
  resource: string,
  clientVersion: string
): any {
  // Get changes newer than client version, in reverse chronological order
  const applicableChanges = versionChanges
    .filter(change => change.version > clientVersion)
    .sort((a, b) => b.version.localeCompare(a.version));

  let transformed = { ...response };
  for (const change of applicableChanges) {
    transformed = change.transform(transformed, resource);
  }

  return transformed;
}

// Usage
router.get('/users/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);

  // Always produce the latest internal format
  const latestResponse = {
    id: user.id,
    first_name: user.firstName,
    last_name: user.lastName,
    email_addresses: user.emails,
    avatar_url: user.avatarUrl,
  };

  // Transform to client's pinned version
  const clientVersion = req.apiVersion; // e.g., "2024-03-01"
  const versionedResponse = applyVersionTransforms(
    latestResponse, 'user', clientVersion
  );

  res.json(versionedResponse);
});
```

**Pros:** Single code path, every version is automatically supported, easy to reason about individual changes
**Cons:** Complex to implement initially, transforms must be pure and composable, debugging specific version behavior requires tracing through the chain

---

## OpenAPI Spec Per Version

### Separate Spec Files

```
docs/
  openapi/
    v1.yaml
    v2.yaml
    v3.yaml
```

### Version-Specific OpenAPI Configuration

```yaml
# v2.yaml
openapi: 3.1.0
info:
  title: My API
  version: "2.0.0"
  description: |
    Version 2 of the My API.

    ## Changes from v1
    - `name` field split into `first_name` and `last_name`
    - `avatar_url` field added to user responses
    - `GET /users/{id}/preferences` endpoint added
  x-api-version: 2
  x-sunset-versions:
    v1:
      sunset_date: "2025-12-31"
      migration_guide: "https://api.example.com/docs/migration/v1-to-v2"

servers:
  - url: https://api.example.com/v2
    description: Production

paths:
  /users/{id}:
    get:
      operationId: getUser
      summary: Get a user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserV2'
          headers:
            X-Api-Version:
              schema:
                type: string
              description: The API version used to process this request
            Sunset:
              schema:
                type: string
              description: Date when this version will be sunset (if applicable)

components:
  schemas:
    UserV2:
      type: object
      required: [id, first_name, last_name, email]
      properties:
        id:
          type: string
          format: uuid
        first_name:
          type: string
        last_name:
          type: string
        email:
          type: string
          format: email
        avatar_url:
          type: string
          format: uri
          nullable: true
        created_at:
          type: string
          format: date-time
```

### Generating OpenAPI from Code (TypeScript)

```typescript
// Using zod-to-openapi or similar
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Define schemas per version
const UserV1Schema = z.object({
  id: z.string().uuid().openapi({ description: 'Unique user ID' }),
  name: z.string().openapi({ description: 'Full name' }),
  email: z.string().email().openapi({ description: 'Email address' }),
}).openapi('UserV1');

const UserV2Schema = z.object({
  id: z.string().uuid().openapi({ description: 'Unique user ID' }),
  first_name: z.string().openapi({ description: 'First name' }),
  last_name: z.string().openapi({ description: 'Last name' }),
  email: z.string().email().openapi({ description: 'Primary email' }),
  avatar_url: z.string().url().nullable().openapi({ description: 'Avatar URL' }),
}).openapi('UserV2');
```

---

## Real-World Versioning Case Studies

### Stripe: Date-Based Versioning

Stripe is widely considered the gold standard for API versioning.

**How it works:**
- API version is a **date string** (e.g., `2024-06-15`)
- Every API key is pinned to the version that was active when the key was created
- Consumers can **upgrade** by specifying `Stripe-Version` header or updating account settings
- Consumers can **test** new versions per-request with the header before committing
- Version changes are **backward-applied**: internally, Stripe always runs the latest code and applies transformations to produce older version responses
- Each version change is small and documented individually

```http
# Pin to a specific version per-request
POST /v1/charges
Stripe-Version: 2024-06-15
Authorization: Bearer sk_test_...
```

**Key design decisions:**
- Only one URL prefix (`/v1`), versioning is entirely header-driven
- Granular changes: each version date represents specific, documented field/behavior changes
- Consumers are never forced to upgrade: their pinned version works indefinitely
- Stripe publishes an exhaustive changelog mapping each version date to specific changes

**Lessons:**
- Date-based versions are intuitive and self-documenting
- Pinning per API key reduces migration pressure
- The transform chain pattern scales to hundreds of versions
- Invest in a version compatibility layer rather than maintaining separate codebases

### GitHub: URL + Accept Header Hybrid

**How it works:**
- URL path includes the major version in the Accept header: `Accept: application/vnd.github.v3+json`
- In practice, `v3` is the current and only version; breaking changes are rare
- Preview features use special media types: `Accept: application/vnd.github.squirrel-girl-preview+json`
- Breaking changes are introduced as "API previews" that must be explicitly opted into

```http
# Standard v3 request
GET /repos/octocat/hello-world
Accept: application/vnd.github.v3+json

# Preview feature (reactions)
GET /repos/octocat/hello-world/issues/1/reactions
Accept: application/vnd.github.squirrel-girl-preview+json
```

**Lessons:**
- Preview mechanism allows testing breaking changes before they become permanent
- In practice, URL versioning is rarely bumped if the API is designed to evolve additively
- Named previews are more memorable than version numbers

### Twilio: Date-Based with URL Path

**How it works:**
- Version is a date in the URL path: `/2010-04-01/Accounts/...`
- Major API rewrites get entirely new URL prefixes
- Very conservative: the `2010-04-01` version has been stable for over 15 years

```http
GET /2010-04-01/Accounts/{AccountSid}/Messages.json
```

**Lessons:**
- Extreme stability is valuable for telecom/infrastructure APIs
- Date in URL makes it immediately clear how old the integration is
- Rarely need to bump versions if the API is designed for extensibility

### Microsoft Azure: Query Parameter with Date

**How it works:**
- Version is a required query parameter: `?api-version=2023-10-01`
- Each Azure service specifies its own supported versions
- No default version: requests without `api-version` are rejected

```http
GET https://management.azure.com/subscriptions/{id}/resourceGroups?api-version=2023-10-01
```

**Lessons:**
- Making version required eliminates ambiguity about which version is being used
- Per-service versioning allows independent evolution
- Query parameter approach works when all clients are SDKs (not browser-based)

### Google: URL Path with Major Versions

**How it works:**
- Simple numeric versions in URL path: `/v1/`, `/v2/`, `/v3/`
- Beta and alpha versions use suffixes: `/v1beta1/`, `/v2alpha1/`
- Strict SLA: GA versions maintained for minimum 1 year after successor is available

```http
# Stable
GET https://www.googleapis.com/calendar/v3/calendars

# Beta (no stability guarantee)
GET https://www.googleapis.com/compute/beta/projects/{project}/zones
```

**Lessons:**
- Beta/alpha URL paths clearly signal stability expectations
- Strict version lifecycle SLAs build consumer confidence
- Multiple stability tiers (alpha, beta, GA) allow testing without commitment

---

## Decision Tree

```
Should you version your API?
|
+-- Is it a public API with third-party consumers?
|   +-- YES --> Use URL path versioning (/v1, /v2)
|   |           Consider date-based versioning for fine-grained changes (Stripe model)
|   |
|   +-- NO --> Is it an internal API with controlled consumers?
|       +-- YES --> Can you coordinate deployments?
|       |   +-- YES --> Consider no versioning (additive changes only)
|       |   +-- NO  --> Use header versioning (Api-Version: 2)
|       |
|       +-- NO --> Is it a partner/B2B API?
|           +-- YES --> URL path versioning + contractual sunset timeline
|           +-- NO  --> URL path versioning (safe default)
|
What versioning strategy?
|
+-- Need browser-testable, simple, visible?
|   --> URL path versioning
|
+-- Need REST compliance, per-resource versioning?
|   --> Content negotiation (Accept header)
|
+-- Need simplicity for internal use, clean URLs?
|   --> Custom header versioning
|
+-- Using Azure or Google Cloud conventions?
|   --> Query parameter versioning
|
How many versions?
|
+-- Public API, large ecosystem
|   --> 2-3 active versions, 12-month sunset cycle
|
+-- Internal API
|   --> 1 active version, 1-month migration window
|
+-- Partner/B2B API
|   --> 2 active versions, per-contract sunset negotiation
```

---

## Best Practices

1. **Version early:** Add versioning infrastructure from day one, even if you only have v1
2. **Version the contract, not the implementation:** Multiple API versions can share the same business logic
3. **Use transformers:** Keep a single internal data model and transform to version-specific response shapes
4. **Communicate proactively:** Announce deprecations 12+ months in advance for public APIs
5. **Make versions explicit:** Do not silently default to a version that may change
6. **Test all active versions:** Include version-specific test suites in CI/CD
7. **Monitor version usage:** Track which consumers use which versions to prioritize migration efforts
8. **Provide migration guides:** Detailed before/after examples for every breaking change
9. **Use Sunset headers:** Implement RFC 8594 for programmatic deprecation detection
10. **Keep changelogs:** Maintain a structured, searchable changelog per version
11. **Pin default versions:** Like Stripe, default to the version active when the consumer registered
12. **Return version in response:** Include a response header confirming which version processed the request
13. **Validate version early:** Reject unsupported versions at the gateway level with a clear error message
14. **Plan for version removal:** Budget time and effort for removing old version code and tests

---

## Anti-patterns / Common Mistakes

1. **No versioning at all:** "We'll add it later" -- by the time you need it, you have broken consumers
2. **Versioning too aggressively:** Creating v2 for every minor change instead of using additive evolution
3. **Maintaining too many versions:** Having 5+ active versions without the team to support them
4. **Inconsistent versioning strategy:** Some endpoints use URL, others use headers
5. **Silent version changes:** Changing behavior within a version without bumping the version
6. **No deprecation warnings:** Removing endpoints without prior notice
7. **Default to latest:** Letting unversioned requests hit the latest version causes unexpected breakage
8. **Version the entire API for one endpoint change:** If only `/users` changed, only `/users` needs a new version (or just make the change additive)
9. **Copy-paste entire codebases per version:** Leads to massive duplication and divergence. Use transformers.
10. **Forgetting about documentation:** Having a v2 API with v1 documentation
11. **No migration path:** Providing a new version without explaining how to get from old to new
12. **Ignoring backward compatibility tests:** Not testing that old clients still work with new deployments

---

## Sources

- **RFC 8594:** The Sunset HTTP Header Field - https://www.rfc-editor.org/rfc/rfc8594
- **RFC 7231:** HTTP/1.1 Semantics and Content (Content Negotiation) - https://www.rfc-editor.org/rfc/rfc7231
- **Stripe API Versioning:** https://stripe.com/docs/api/versioning
- **GitHub API Media Types:** https://docs.github.com/en/rest/overview/media-types
- **Microsoft REST API Guidelines -- Versioning:** https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md
- **Google Cloud API Design Guide -- Versioning:** https://cloud.google.com/apis/design/versioning
- **Roy Fielding's Dissertation (REST):** https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm
- **API Versioning Has No "Right Way" -- Troy Hunt:** https://www.troyhunt.com/your-api-versioning-is-wrong-which-is/
- **Semantic Versioning 2.0.0:** https://semver.org/
- **Zalando RESTful API Guidelines -- Compatibility:** https://opensource.zalando.com/restful-api-guidelines/#compatible-changes
