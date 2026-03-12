# REST API Security

Category: Application Security / API Security
Severity: Critical
Last Updated: 2025-12
Tags: rest, http, authorization, mass-assignment, api-keys

---

## Overview

REST APIs expose business logic through HTTP endpoints mapped to resources. Their stateless nature and reliance on HTTP methods create a specific attack surface that differs from traditional web applications. This guide covers the security controls required for production REST APIs, including HTTP method enforcement, resource authorization, mass assignment prevention, response filtering, and API key management.

---

## HTTP Method Enforcement

### Restrict Allowed Methods Per Route

Every endpoint must explicitly define which HTTP methods it accepts. Responding to unexpected methods leaks information and may enable unintended state changes.

**TypeScript (Express)**:

```typescript
import express from 'express';

const router = express.Router();

// Explicitly define allowed methods per resource
router.route('/api/articles')
  .get(listArticles)
  .post(authenticate, createArticle)
  .all((req, res) => {
    res.status(405)
      .set('Allow', 'GET, POST')
      .json({ error: 'Method not allowed' });
  });

router.route('/api/articles/:id')
  .get(getArticle)
  .put(authenticate, authorize('article:update'), updateArticle)
  .delete(authenticate, authorize('article:delete'), deleteArticle)
  .all((req, res) => {
    res.status(405)
      .set('Allow', 'GET, PUT, DELETE')
      .json({ error: 'Method not allowed' });
  });
```

**Go (gin)**:

```go
func setupRouter() *gin.Engine {
    r := gin.New()

    articles := r.Group("/api/articles")
    {
        articles.GET("", listArticles)
        articles.POST("", authMiddleware(), createArticle)
    }

    article := r.Group("/api/articles/:id")
    {
        article.GET("", getArticle)
        article.PUT("", authMiddleware(), authorizeMiddleware("article:update"), updateArticle)
        article.DELETE("", authMiddleware(), authorizeMiddleware("article:delete"), deleteArticle)
    }

    // Gin automatically returns 405 for unmatched methods on matched paths
    r.HandleMethodNotAllowed = true
    return r
}
```

**Python (FastAPI)**:

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/api/articles")
async def list_articles():
    pass

@app.post("/api/articles")
async def create_article(user=Depends(get_current_user)):
    pass

# FastAPI automatically returns 405 for undefined methods on defined paths
```

### Disable TRACE and TRACK Methods

TRACE and TRACK methods can be exploited for Cross-Site Tracing (XST) attacks. Disable them at the web server level.

```typescript
// Express: Block TRACE/TRACK at the application level
app.use((req, res, next) => {
  if (['TRACE', 'TRACK'].includes(req.method.toUpperCase())) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  next();
});
```

---

## Proper HTTP Status Codes for Security

Use correct status codes to avoid leaking information and to ensure clients respond appropriately.

| Status Code | When to Use | Security Note |
|---|---|---|
| 400 Bad Request | Malformed request body or parameters | Do not reveal which specific field failed unless intentional |
| 401 Unauthorized | Missing or invalid authentication credentials | Do not distinguish between "user not found" and "wrong password" |
| 403 Forbidden | Authenticated but lacks permission | Confirms the resource exists -- use 404 instead for BOLA defense |
| 404 Not Found | Resource does not exist OR user lacks access | Use to hide resource existence from unauthorized users |
| 405 Method Not Allowed | HTTP method not supported on this endpoint | Include Allow header |
| 409 Conflict | Duplicate resource creation attempt | Be careful not to reveal existing data |
| 413 Content Too Large | Request body exceeds size limit | Enforce before parsing |
| 415 Unsupported Media Type | Wrong Content-Type header | Reject before processing body |
| 422 Unprocessable Entity | Valid JSON but fails business validation | Return specific field errors |
| 429 Too Many Requests | Rate limit exceeded | Include Retry-After header |

**Security-Aware Error Response Pattern**:

```typescript
// Do NOT reveal whether a user exists on login failure
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findOne({ email });

  // Constant-time check: hash password even if user not found
  const storedHash = user?.passwordHash || '$2b$10$invalidhashplaceholder';
  const valid = await bcrypt.compare(password, storedHash);

  if (!user || !valid) {
    // Same error message regardless of cause
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  res.json({ token });
});
```

---

## Resource-Level Authorization (Owner Checks)

### Direct Ownership Check

```typescript
// Middleware: Check resource ownership
function checkOwnership(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params.id;
    const userId = req.user.id;

    const resource = await db.collection(resourceType).findOne({
      _id: resourceId,
      ownerId: userId,
    });

    if (!resource) {
      // Return 404 to avoid revealing that the resource exists
      return res.status(404).json({ error: 'Resource not found' });
    }

    req.resource = resource;
    next();
  };
}

app.put('/api/posts/:id', authenticate, checkOwnership('posts'), updatePost);
app.delete('/api/posts/:id', authenticate, checkOwnership('posts'), deletePost);
```

### Team/Organization-Based Authorization

```go
// Go: Check organization membership for resource access
func orgAuthMiddleware(next gin.HandlerFunc) gin.HandlerFunc {
    return func(c *gin.Context) {
        user := getUserFromContext(c)
        resourceID := c.Param("id")

        resource, err := db.GetResource(resourceID)
        if err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
            c.Abort()
            return
        }

        // Check if user is a member of the resource's organization
        membership, err := db.GetMembership(user.ID, resource.OrgID)
        if err != nil || membership == nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
            c.Abort()
            return
        }

        // Check if membership role has sufficient permissions
        if !membership.HasPermission("resource:read") {
            c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
            c.Abort()
            return
        }

        c.Set("resource", resource)
        c.Set("membership", membership)
        next(c)
    }
}
```

---

## Mass Assignment Prevention

### Allowlisted Fields Pattern

Never pass raw request bodies to database operations. Define explicit schemas for each endpoint.

**Python (FastAPI with Pydantic)**:

```python
from pydantic import BaseModel, Field
from typing import Optional

# Separate models for creation vs. update vs. response

class ArticleCreateRequest(BaseModel):
    """Only these fields can be set during creation."""
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=50000)
    tags: list[str] = Field(default_factory=list, max_length=10)

class ArticleUpdateRequest(BaseModel):
    """Only these fields can be updated."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=50000)
    tags: Optional[list[str]] = Field(None, max_length=10)
    # Note: author_id, created_at, view_count are NOT here

class ArticleResponse(BaseModel):
    """Only these fields are returned to the client."""
    id: str
    title: str
    content: str
    tags: list[str]
    author_name: str  # Derived, not raw author_id
    created_at: datetime
    updated_at: datetime
    # Note: internal fields like _id, author_id, moderation_status are excluded

@app.post("/api/articles", response_model=ArticleResponse)
async def create_article(
    body: ArticleCreateRequest,
    user=Depends(get_current_user),
):
    article = {
        **body.dict(),
        "author_id": user.id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "status": "draft",  # Server-controlled field
    }
    result = await db.articles.insert_one(article)
    return await get_article_response(result.inserted_id)
```

**TypeScript (with Zod)**:

```typescript
import { z } from 'zod';

const ArticleCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  tags: z.array(z.string().max(50)).max(10).default([]),
}).strict(); // .strict() rejects unknown fields

const ArticleUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
}).strict();

app.post('/api/articles', authenticate, async (req, res) => {
  const parsed = ArticleCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ errors: parsed.error.issues });
  }

  const article = {
    ...parsed.data,           // Only allowlisted fields
    authorId: req.user.id,    // Server-set field
    createdAt: new Date(),    // Server-set field
    status: 'draft',          // Server-set field
  };

  const result = await db.articles.insertOne(article);
  res.status(201).json(await getArticleResponse(result.insertedId));
});
```

---

## Response Filtering

### Exclude Internal Fields

Never return database internals, hashed passwords, internal IDs, or metadata that clients should not see.

**Go (gin)**:

```go
type User struct {
    ID             string    `bson:"_id"`
    Email          string    `bson:"email"`
    PasswordHash   string    `bson:"password_hash"`
    Role           string    `bson:"role"`
    InternalNotes  string    `bson:"internal_notes"`
    FailedLogins   int       `bson:"failed_logins"`
    CreatedAt      time.Time `bson:"created_at"`
}

// Public response struct -- only safe fields
type UserResponse struct {
    ID        string    `json:"id"`
    Email     string    `json:"email"`
    CreatedAt time.Time `json:"created_at"`
}

func toUserResponse(u *User) UserResponse {
    return UserResponse{
        ID:        u.ID,
        Email:     u.Email,
        CreatedAt: u.CreatedAt,
    }
}

// Admin response struct -- includes role
type AdminUserResponse struct {
    UserResponse
    Role         string `json:"role"`
    FailedLogins int    `json:"failed_logins"`
}

func toAdminUserResponse(u *User) AdminUserResponse {
    return AdminUserResponse{
        UserResponse: toUserResponse(u),
        Role:         u.Role,
        FailedLogins: u.FailedLogins,
    }
}

func getUser(c *gin.Context) {
    user, _ := db.GetUser(c.Param("id"))
    currentUser := getCurrentUser(c)

    if currentUser.Role == "admin" {
        c.JSON(http.StatusOK, toAdminUserResponse(user))
    } else {
        c.JSON(http.StatusOK, toUserResponse(user))
    }
}
```

### Field Selection Security

If you allow clients to select which fields to return, enforce an allowlist.

```typescript
const ALLOWED_FIELDS = new Set(['id', 'title', 'content', 'author_name', 'created_at', 'tags']);

app.get('/api/articles', async (req, res) => {
  const requestedFields = (req.query.fields as string)?.split(',') || [];

  // Filter to only allowed fields
  const projection: Record<string, 1> = {};
  for (const field of requestedFields) {
    if (ALLOWED_FIELDS.has(field.trim())) {
      projection[field.trim()] = 1;
    }
  }

  // If no valid fields requested, return all allowed fields
  if (Object.keys(projection).length === 0) {
    for (const field of ALLOWED_FIELDS) {
      projection[field] = 1;
    }
  }

  const articles = await db.articles.find({}, { projection }).toArray();
  res.json({ data: articles });
});
```

---

## Pagination Limits

Prevent data dumps by enforcing pagination limits and cursor-based pagination for large datasets.

**TypeScript (Express)**:

```typescript
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

function parsePagination(query: Record<string, any>): PaginationParams {
  const page = Math.max(1, parseInt(query.page) || 1);
  const requestedSize = parseInt(query.page_size) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requestedSize), MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

app.get('/api/articles', async (req, res) => {
  const { page, pageSize, skip } = parsePagination(req.query);

  const [articles, total] = await Promise.all([
    db.articles.find().skip(skip).limit(pageSize).toArray(),
    db.articles.countDocuments(),
  ]);

  res.json({
    data: articles.map(toArticleResponse),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    },
  });
});
```

**Cursor-Based Pagination (Python/FastAPI)**:

```python
from datetime import datetime
from typing import Optional
import base64
import json

@app.get("/api/events")
async def list_events(
    cursor: Optional[str] = None,
    limit: int = Query(default=25, ge=1, le=100),
):
    """Cursor-based pagination for stable ordering with large datasets."""
    query = {}
    if cursor:
        try:
            decoded = json.loads(base64.b64decode(cursor))
            query = {"created_at": {"$lt": datetime.fromisoformat(decoded["ts"])}}
        except (json.JSONDecodeError, KeyError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid cursor")

    events = await db.events.find(query).sort("created_at", -1).limit(limit + 1).to_list(limit + 1)

    has_more = len(events) > limit
    if has_more:
        events = events[:limit]

    next_cursor = None
    if has_more and events:
        next_cursor = base64.b64encode(
            json.dumps({"ts": events[-1]["created_at"].isoformat()}).encode()
        ).decode()

    return {
        "data": [to_event_response(e) for e in events],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }
```

---

## Request Body Size Limits

**TypeScript (Express)**:

```typescript
import express from 'express';

// Global limit
app.use(express.json({ limit: '1mb' }));

// Per-route limits
app.post('/api/articles', express.json({ limit: '256kb' }), createArticle);
app.post('/api/uploads', express.json({ limit: '10mb' }), uploadFile);

// Raw body limit for webhooks
app.post('/api/webhooks', express.raw({ limit: '64kb', type: 'application/json' }), handleWebhook);
```

**Go**:

```go
func maxBodySize(maxBytes int64) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
            next.ServeHTTP(w, r)
        })
    }
}

mux.Handle("/api/articles", maxBodySize(256*1024)(articlesHandler))
mux.Handle("/api/uploads", maxBodySize(10*1024*1024)(uploadsHandler))
```

**Python (FastAPI)**:

```python
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    max_size = 1 * 1024 * 1024  # 1MB default
    if request.url.path.startswith("/api/uploads"):
        max_size = 10 * 1024 * 1024  # 10MB for uploads

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > max_size:
        return JSONResponse(
            status_code=413,
            content={"error": "Request body too large"},
        )
    return await call_next(request)
```

---

## Content-Type Validation

Always validate Content-Type before processing the request body. Accepting unexpected content types can lead to parser confusion attacks.

```typescript
function requireContentType(...types: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type']?.split(';')[0]?.trim();
      if (!contentType || !types.includes(contentType)) {
        return res.status(415).json({
          error: 'Unsupported Media Type',
          expected: types,
        });
      }
    }
    next();
  };
}

app.use('/api', requireContentType('application/json'));
app.use('/api/uploads', requireContentType('multipart/form-data'));
```

```go
func requireJSON(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method == "POST" || r.Method == "PUT" || r.Method == "PATCH" {
            ct := r.Header.Get("Content-Type")
            if !strings.HasPrefix(ct, "application/json") {
                http.Error(w, `{"error":"Content-Type must be application/json"}`,
                    http.StatusUnsupportedMediaType)
                return
            }
        }
        next.ServeHTTP(w, r)
    })
}
```

---

## Idempotency Keys

Idempotency keys prevent duplicate operations from retried requests. They are critical for payment and resource creation endpoints.

```typescript
// Idempotency key middleware
const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours

async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();

  const idempotencyKey = req.headers['idempotency-key'] as string;
  if (!idempotencyKey) {
    if (req.method === 'POST') {
      return res.status(400).json({
        error: 'Idempotency-Key header is required for POST requests',
      });
    }
    return next();
  }

  // Validate key format (UUID)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return res.status(400).json({ error: 'Invalid Idempotency-Key format' });
  }

  const cacheKey = `idempotency:${req.user.id}:${idempotencyKey}`;

  // Check for existing result
  const cached = await redis.get(cacheKey);
  if (cached) {
    const { statusCode, body } = JSON.parse(cached);
    return res.status(statusCode).json(body);
  }

  // Store result after handler completes
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    redis.setex(cacheKey, IDEMPOTENCY_TTL, JSON.stringify({
      statusCode: res.statusCode,
      body,
    }));
    return originalJson(body);
  };

  next();
}
```

---

## API Key Management

### Key Generation and Storage

```typescript
import crypto from 'crypto';

// Generate a secure API key
function generateApiKey(): { raw: string; hashed: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString('base64url'); // 256-bit key
  const prefix = raw.substring(0, 8); // Visible prefix for identification
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed, prefix };
}

// Create a new API key for a user
app.post('/api/keys', authenticate, async (req, res) => {
  const { name, scopes, expiresIn } = req.body;

  // Validate scopes against allowed values
  const allowedScopes = ['read', 'write', 'admin'];
  const validScopes = (scopes || ['read']).filter(
    (s: string) => allowedScopes.includes(s),
  );

  const { raw, hashed, prefix } = generateApiKey();

  await db.apiKeys.insertOne({
    name,
    prefix,
    hashedKey: hashed,
    ownerId: req.user.id,
    scopes: validScopes,
    createdAt: new Date(),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    lastUsedAt: null,
    revokedAt: null,
  });

  // Return the raw key ONLY on creation -- it cannot be retrieved again
  res.status(201).json({
    key: raw,      // Show once
    prefix,
    name,
    scopes: validScopes,
    warning: 'Store this key securely. It cannot be retrieved again.',
  });
});
```

### Key Validation

```typescript
async function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const hashed = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await db.apiKeys.findOne({
    hashedKey: hashed,
    revokedAt: null,
  });

  if (!keyRecord) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }

  // Update last used timestamp (asynchronously, do not block)
  db.apiKeys.updateOne(
    { _id: keyRecord._id },
    { $set: { lastUsedAt: new Date() } },
  ).catch(() => {});

  req.apiKey = keyRecord;
  req.user = await db.users.findById(keyRecord.ownerId);
  next();
}
```

### Key Rotation

```python
@app.post("/api/keys/{key_id}/rotate")
async def rotate_api_key(key_id: str, user=Depends(get_current_user)):
    """Rotate an API key: create a new key and deprecate the old one."""
    old_key = await db.api_keys.find_one({"_id": key_id, "owner_id": user.id})
    if not old_key:
        raise HTTPException(status_code=404)

    # Generate new key
    raw = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    prefix = raw[:8]

    # Create new key with same scopes
    new_key_id = str(uuid4())
    await db.api_keys.insert_one({
        "_id": new_key_id,
        "prefix": prefix,
        "hashed_key": hashed,
        "owner_id": user.id,
        "scopes": old_key["scopes"],
        "created_at": datetime.utcnow(),
        "expires_at": old_key.get("expires_at"),
        "revoked_at": None,
    })

    # Deprecate old key with a grace period
    grace_period = timedelta(hours=24)
    await db.api_keys.update_one(
        {"_id": key_id},
        {"$set": {"deprecated_at": datetime.utcnow(), "sunset_at": datetime.utcnow() + grace_period}},
    )

    return {
        "new_key": raw,
        "new_key_id": new_key_id,
        "old_key_sunset": (datetime.utcnow() + grace_period).isoformat(),
        "warning": "Old key will stop working in 24 hours.",
    }
```

### Scope Enforcement

```go
func requireScope(requiredScope string) gin.HandlerFunc {
    return func(c *gin.Context) {
        apiKey, exists := c.Get("apiKey")
        if !exists {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
            c.Abort()
            return
        }

        key := apiKey.(*APIKey)
        hasScope := false
        for _, scope := range key.Scopes {
            if scope == requiredScope || scope == "admin" {
                hasScope = true
                break
            }
        }

        if !hasScope {
            c.JSON(http.StatusForbidden, gin.H{
                "error":          "Insufficient scope",
                "required_scope": requiredScope,
            })
            c.Abort()
            return
        }

        c.Next()
    }
}

// Usage
r.GET("/api/data", apiKeyAuth(), requireScope("read"), getData)
r.POST("/api/data", apiKeyAuth(), requireScope("write"), createData)
r.DELETE("/api/data/:id", apiKeyAuth(), requireScope("admin"), deleteData)
```

---

## HATEOAS Security Considerations

If your REST API uses HATEOAS (Hypermedia as the Engine of Application State), ensure that links in responses only expose actions the user is authorized to perform.

```typescript
function buildArticleLinks(article: Article, user: User): Record<string, string> {
  const links: Record<string, string> = {
    self: `/api/articles/${article.id}`,
  };

  // Only include edit/delete links if user is the author or admin
  if (user.id === article.authorId || user.role === 'admin') {
    links.update = `/api/articles/${article.id}`;
    links.delete = `/api/articles/${article.id}`;
  }

  // Only include publish link if article is draft and user is author
  if (article.status === 'draft' && user.id === article.authorId) {
    links.publish = `/api/articles/${article.id}/publish`;
  }

  return links;
}

app.get('/api/articles/:id', authenticate, async (req, res) => {
  const article = await getArticleForUser(req.params.id, req.user.id);
  if (!article) return res.status(404).json({ error: 'Not found' });

  res.json({
    ...toArticleResponse(article),
    _links: buildArticleLinks(article, req.user),
  });
});
```

**Warning**: HATEOAS links are a UX convenience, not a security control. Authorization must still be enforced on every endpoint regardless of whether a link was presented to the client.

---

## Security Headers for REST APIs

```typescript
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent caching of sensitive API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  // Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Prevent framing of API responses
  res.setHeader('X-Frame-Options', 'DENY');

  // Content Security Policy for API (should not serve HTML)
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

  // Remove server identification headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
});
```

---

## Request Validation Middleware

Comprehensive request validation combining multiple checks.

```typescript
import { z, ZodSchema } from 'zod';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Record<string, any> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) errors.body = result.error.issues;
      else req.body = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) errors.params = result.error.issues;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) errors.query = result.error.issues;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ errors });
    }

    next();
  };
}

// Usage
app.get('/api/articles',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      page_size: z.coerce.number().int().min(1).max(100).default(25),
      sort: z.enum(['created_at', 'updated_at', 'title']).default('created_at'),
      order: z.enum(['asc', 'desc']).default('desc'),
    }),
  }),
  listArticles,
);

app.post('/api/articles',
  authenticate,
  validate({
    body: z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(50000),
      tags: z.array(z.string().max(50)).max(10).default([]),
    }).strict(),
  }),
  createArticle,
);
```

---

## CSRF Protection for REST APIs

REST APIs that use cookie-based authentication (session cookies, same-site cookies) are vulnerable to CSRF attacks. Token-based authentication (Bearer tokens in headers) is inherently CSRF-resistant because browsers do not automatically attach custom headers.

```typescript
// If using cookie-based auth, implement CSRF protection
import csrf from 'csurf';

// Only needed if cookies are used for authentication
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  },
});

// SameSite cookie as primary CSRF defense
app.use(session({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict', // Primary CSRF defense
    maxAge: 3600000,
  },
}));

// Double-submit cookie pattern as additional layer
app.use(csrfProtection);
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: req.csrfToken() });
});
```

---

## Best Practices

1. **Return 404 instead of 403 for unauthorized resource access** -- Prevents attackers from enumerating resources they cannot access. If the user lacks permission, respond as if the resource does not exist.

2. **Use strict schema validation with unknown field rejection** -- Define explicit input schemas and reject any fields not in the schema using `.strict()` (Zod) or `model_config = ConfigDict(extra='forbid')` (Pydantic).

3. **Hash API keys before storage** -- Store only SHA-256 hashes of API keys. Display the raw key only once at creation time.

4. **Set per-route body size limits** -- Apply different size limits based on the endpoint (small for JSON, larger for file uploads).

5. **Include pagination metadata in every list response** -- Return page, pageSize, total count, and hasMore. Enforce a maximum page size server-side.

6. **Use separate DTOs for read, create, and update** -- Different operations should accept and return different field sets to prevent mass assignment and data leakage.

7. **Validate Content-Type headers before processing** -- Reject requests with unexpected content types before the body parser runs.

8. **Enforce idempotency keys on state-changing endpoints** -- Require Idempotency-Key headers on POST requests to prevent duplicate operations.

9. **Scope API keys with explicit permissions** -- Every API key should have a defined set of scopes. Check scopes on every request.

10. **Remove server identification headers** -- Strip X-Powered-By, Server, and other headers that reveal technology stack details.

---

## Anti-Patterns

1. **Passing req.body directly to database operations** -- Allows mass assignment. Always parse through a validated schema first.

2. **Using 403 Forbidden for missing resources** -- Reveals that the resource exists. Use 404 to hide resource existence from unauthorized users.

3. **Storing API keys in plaintext** -- If the database is compromised, all keys are exposed. Hash with SHA-256.

4. **Returning full database objects in responses** -- Exposes internal fields like password hashes, internal IDs, and audit metadata. Use explicit response DTOs.

5. **Allowing unlimited page sizes** -- Enables data exfiltration in a single request. Cap at a reasonable maximum (e.g., 100).

6. **Accepting any Content-Type** -- Parser confusion attacks can bypass validation. Enforce expected content types.

7. **Using sequential integer IDs in URLs** -- Makes enumeration trivial. Use UUIDs or other non-guessable identifiers.

8. **Ignoring idempotency for POST endpoints** -- Retried requests create duplicate resources. Require and honor idempotency keys.

---

## Enforcement Checklist

- [ ] Every endpoint explicitly defines allowed HTTP methods with 405 for others
- [ ] Status codes follow security best practices (404 over 403 for BOLA defense)
- [ ] Resource-level authorization checks are implemented for every endpoint
- [ ] Input schemas use strict mode to reject unknown fields
- [ ] Response DTOs exclude internal fields (password hashes, internal IDs)
- [ ] Pagination is enforced with maximum page sizes on all list endpoints
- [ ] Request body size limits are configured per route
- [ ] Content-Type validation is enforced before body parsing
- [ ] Idempotency keys are required for POST requests on critical endpoints
- [ ] API keys are hashed before storage and scoped with explicit permissions
- [ ] API key rotation is supported with grace periods
- [ ] Security headers are set (X-Content-Type-Options, HSTS, Cache-Control)
- [ ] CORS is configured with explicit origin allowlists
- [ ] Server identification headers are removed
- [ ] CSRF protection is in place for cookie-based authentication
