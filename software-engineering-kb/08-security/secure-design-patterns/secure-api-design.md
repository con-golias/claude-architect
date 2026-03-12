# Secure API Design Patterns Guide

## Overview

Category: Secure Design Patterns
Scope: API security architecture, request/response security, operational patterns
Audience: Backend engineers, API architects, security engineers
Last Updated: 2025-06

## Purpose

APIs are the primary attack surface of modern applications. Every API endpoint
is a potential entry point for attackers. This guide covers design patterns that
make APIs secure by construction -- preventing common vulnerabilities through
architectural decisions rather than ad-hoc fixes.

---

## Pattern 1: Request Validation (Validate at Boundary)

### Theory

Validate every request at the API boundary before any business logic executes.
Validation must cover schema structure, type correctness, value ranges, and
business rule constraints. Reject invalid requests immediately with clear
error messages (without leaking internal details).

The validation chain:
1. Schema validation -- correct structure and required fields
2. Type checking -- correct data types and formats
3. Range validation -- values within acceptable bounds
4. Business rule validation -- domain-specific constraints

### TypeScript -- Layered Validation

```typescript
import { z } from 'zod';

// Layer 1: Schema validation with strict mode
const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    price: z.number().positive().max(999999.99),
  })).min(1).max(50),
  shippingAddress: z.object({
    street: z.string().min(1).max(200).trim(),
    city: z.string().min(1).max(100).trim(),
    state: z.string().length(2),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.string().length(2),
  }),
  paymentMethodId: z.string().uuid(),
  couponCode: z.string().max(20).optional(),
}).strict(); // Reject unknown fields -- prevents mass assignment

// Layer 2: Validation middleware
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

// Layer 3: Business rule validation (after schema validation)
async function validateOrderBusinessRules(
  order: z.infer<typeof CreateOrderSchema>,
  userId: string,
): Promise<string[]> {
  const errors: string[] = [];

  // Verify products exist and prices match
  for (const item of order.items) {
    const product = await productRepo.findById(item.productId);
    if (!product) {
      errors.push(`Product ${item.productId} not found`);
      continue;
    }
    if (product.price !== item.price) {
      errors.push(`Price mismatch for product ${item.productId}`);
    }
    if (product.stock < item.quantity) {
      errors.push(`Insufficient stock for product ${item.productId}`);
    }
  }

  // Verify payment method belongs to user
  const paymentMethod = await paymentRepo.findByIdAndUser(
    order.paymentMethodId, userId
  );
  if (!paymentMethod) {
    errors.push('Invalid payment method');
  }

  // Validate coupon if provided
  if (order.couponCode) {
    const coupon = await couponRepo.findByCode(order.couponCode);
    if (!coupon || coupon.expired || coupon.usageCount >= coupon.maxUsage) {
      errors.push('Invalid or expired coupon');
    }
  }

  return errors;
}

// Usage
app.post('/api/orders',
  authenticate,
  validateBody(CreateOrderSchema),
  async (req, res) => {
    const businessErrors = await validateOrderBusinessRules(
      req.validatedBody, req.user.id
    );
    if (businessErrors.length > 0) {
      return res.status(422).json({ error: 'Business validation failed', details: businessErrors });
    }
    // Proceed with order creation
  }
);
```

### Go -- Request Validation

```go
package handlers

import (
    "encoding/json"
    "net/http"

    "github.com/go-playground/validator/v10"
    "github.com/google/uuid"
)

var validate = validator.New()

type CreateOrderRequest struct {
    Items []OrderItem `json:"items" validate:"required,min=1,max=50,dive"`
    ShippingAddress Address `json:"shipping_address" validate:"required"`
    PaymentMethodID string `json:"payment_method_id" validate:"required,uuid4"`
    CouponCode      string `json:"coupon_code,omitempty" validate:"omitempty,max=20"`
}

type OrderItem struct {
    ProductID string  `json:"product_id" validate:"required,uuid4"`
    Quantity  int     `json:"quantity" validate:"required,min=1,max=100"`
    Price     float64 `json:"price" validate:"required,gt=0,max=999999.99"`
}

type Address struct {
    Street  string `json:"street" validate:"required,min=1,max=200"`
    City    string `json:"city" validate:"required,min=1,max=100"`
    State   string `json:"state" validate:"required,len=2"`
    ZipCode string `json:"zip_code" validate:"required,regex=^\\d{5}(-\\d{4})?$"`
    Country string `json:"country" validate:"required,len=2"`
}

func CreateOrder(w http.ResponseWriter, r *http.Request) {
    // Limit request body size
    r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit

    var req CreateOrderRequest
    decoder := json.NewDecoder(r.Body)
    decoder.DisallowUnknownFields() // Reject unknown fields

    if err := decoder.Decode(&req); err != nil {
        respondError(w, http.StatusBadRequest, "Invalid request body")
        return
    }

    // Validate struct tags
    if err := validate.Struct(req); err != nil {
        validationErrors := err.(validator.ValidationErrors)
        respondValidationErrors(w, validationErrors)
        return
    }

    // Business rule validation follows...
}
```

### Python -- Pydantic Validation

```python
from pydantic import BaseModel, Field, field_validator
from uuid import UUID
import re

class OrderItem(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1, le=100)
    price: float = Field(gt=0, le=999999.99)

class Address(BaseModel):
    street: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=2, max_length=2)
    zip_code: str
    country: str = Field(min_length=2, max_length=2)

    @field_validator('zip_code')
    @classmethod
    def validate_zip(cls, v: str) -> str:
        if not re.match(r'^\d{5}(-\d{4})?$', v):
            raise ValueError('Invalid ZIP code format')
        return v

    class Config:
        extra = 'forbid'  # Reject unknown fields

class CreateOrderRequest(BaseModel):
    items: list[OrderItem] = Field(min_length=1, max_length=50)
    shipping_address: Address
    payment_method_id: UUID
    coupon_code: str | None = Field(default=None, max_length=20)

    class Config:
        extra = 'forbid'  # Reject unknown fields

# Usage in FastAPI
@app.post("/api/orders")
async def create_order(
    order: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
):
    # Pydantic has already validated schema, types, and ranges
    # Now validate business rules
    await validate_business_rules(order, current_user)
    return await order_service.create(order, current_user)
```

---

## Pattern 2: Response Filtering

### Theory

Never expose internal data structures in API responses. Use DTOs (Data Transfer
Objects) or view models to control exactly which fields are returned. Internal
fields like database IDs, timestamps, audit columns, and internal status flags
must never appear in responses unless explicitly mapped.

### TypeScript -- Response DTO Pattern

```typescript
// Internal database model -- contains many fields not for external use
interface UserEntity {
  id: string;
  email: string;
  name: string;
  passwordHash: string;      // NEVER expose
  passwordSalt: string;      // NEVER expose
  mfaSecret: string;         // NEVER expose
  role: string;
  department: string;
  salary: number;            // Only for HR
  ssn: string;               // Only for HR
  internalNotes: string;     // NEVER expose
  failedLoginCount: number;  // NEVER expose
  lastLoginIp: string;       // NEVER expose
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;    // NEVER expose
}

// Public DTO -- only fields safe for the requesting user
interface UserPublicDTO {
  id: string;
  name: string;
  role: string;
}

// Self DTO -- user viewing their own profile
interface UserSelfDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  createdAt: string;
}

// Admin DTO -- admin viewing any user
interface UserAdminDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  createdAt: string;
  updatedAt: string;
  failedLoginCount: number;
}

// Mapper functions -- explicit transformation
function toPublicDTO(entity: UserEntity): UserPublicDTO {
  return {
    id: entity.id,
    name: entity.name,
    role: entity.role,
  };
}

function toSelfDTO(entity: UserEntity): UserSelfDTO {
  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    role: entity.role,
    department: entity.department,
    createdAt: entity.createdAt.toISOString(),
  };
}

function toAdminDTO(entity: UserEntity): UserAdminDTO {
  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    role: entity.role,
    department: entity.department,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    failedLoginCount: entity.failedLoginCount,
  };
}

// Controller selects DTO based on caller context
app.get('/api/users/:id', authenticate, async (req, res) => {
  const user = await userRepo.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });

  if (req.user.role === 'admin') {
    return res.json(toAdminDTO(user));
  }
  if (req.user.id === user.id) {
    return res.json(toSelfDTO(user));
  }
  return res.json(toPublicDTO(user));
});
```

---

## Pattern 3: Idempotency Pattern

### Theory

POST and PATCH requests can be retried due to network failures, causing
duplicate operations (double charges, duplicate orders). The idempotency
pattern uses a client-provided key to ensure that retrying a request produces
the same result as the original request.

Implementation: Store the idempotency key with a unique constraint in the
database. If the key already exists, return the stored response instead of
processing the request again.

### TypeScript -- Idempotency Middleware

```typescript
interface IdempotencyRecord {
  key: string;
  userId: string;
  statusCode: number;
  responseBody: string;
  createdAt: Date;
  expiresAt: Date;
}

async function idempotencyMiddleware(
  req: Request, res: Response, next: NextFunction
) {
  // Only apply to non-idempotent methods
  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'] as string;
  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'Idempotency-Key header is required for this endpoint',
    });
  }

  // Validate key format (UUID)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(idempotencyKey)) {
    return res.status(400).json({ error: 'Idempotency-Key must be a UUID v4' });
  }

  // Check for existing result
  const existing = await db('idempotency_keys')
    .where({ key: idempotencyKey, user_id: req.user.id })
    .first();

  if (existing) {
    // Return the stored response -- do not reprocess
    res.status(existing.statusCode);
    return res.json(JSON.parse(existing.responseBody));
  }

  // Try to lock the key (prevent concurrent duplicate requests)
  try {
    await db('idempotency_keys').insert({
      key: idempotencyKey,
      user_id: req.user.id,
      status_code: null,  // Not yet complete
      response_body: null,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
    });
  } catch (err: any) {
    if (err.code === '23505') { // Unique constraint violation
      // Another request with the same key is in progress
      return res.status(409).json({ error: 'Request already in progress' });
    }
    throw err;
  }

  // Intercept the response to store it
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    // Store the response for future replays
    db('idempotency_keys')
      .where({ key: idempotencyKey, user_id: req.user.id })
      .update({
        status_code: res.statusCode,
        response_body: JSON.stringify(body),
      })
      .catch(console.error);

    return originalJson(body);
  };

  next();
}
```

### Go -- Idempotency Implementation

```go
package middleware

import (
    "crypto/sha256"
    "database/sql"
    "encoding/hex"
    "encoding/json"
    "net/http"
    "time"
)

type IdempotencyStore struct {
    db *sql.DB
}

type IdempotencyRecord struct {
    Key          string
    UserID       string
    StatusCode   int
    ResponseBody string
    CreatedAt    time.Time
    ExpiresAt    time.Time
}

func (s *IdempotencyStore) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method == http.MethodGet || r.Method == http.MethodHead {
            next.ServeHTTP(w, r)
            return
        }

        key := r.Header.Get("Idempotency-Key")
        if key == "" {
            respondError(w, http.StatusBadRequest,
                "Idempotency-Key header required")
            return
        }

        user := getUserFromContext(r.Context())

        // Check for existing response
        var record IdempotencyRecord
        err := s.db.QueryRow(
            `SELECT status_code, response_body FROM idempotency_keys
             WHERE key = $1 AND user_id = $2 AND expires_at > NOW()`,
            key, user.ID,
        ).Scan(&record.StatusCode, &record.ResponseBody)

        if err == nil && record.StatusCode > 0 {
            // Return stored response
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(record.StatusCode)
            w.Write([]byte(record.ResponseBody))
            return
        }

        // Insert lock
        _, err = s.db.Exec(
            `INSERT INTO idempotency_keys (key, user_id, created_at, expires_at)
             VALUES ($1, $2, NOW(), NOW() + INTERVAL '24 hours')`,
            key, user.ID,
        )
        if err != nil {
            respondError(w, http.StatusConflict, "Duplicate request")
            return
        }

        // Wrap response writer to capture output
        recorder := &responseRecorder{ResponseWriter: w, statusCode: 200}
        next.ServeHTTP(recorder, r)

        // Store the response
        s.db.Exec(
            `UPDATE idempotency_keys SET status_code = $1, response_body = $2
             WHERE key = $3 AND user_id = $4`,
            recorder.statusCode, recorder.body.String(), key, user.ID,
        )
    })
}
```

---

## Pattern 4: Pagination Security

### Theory

Pagination prevents clients from dumping entire datasets. Use cursor-based
pagination (not offset-based) to prevent enumeration attacks and ensure
consistent results. Enforce a maximum page size server-side.

### TypeScript -- Cursor-Based Pagination

```typescript
interface PaginationParams {
  cursor?: string;
  limit: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function parsePagination(query: Record<string, string>): PaginationParams {
  let limit = parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE;
  // Enforce maximum -- server controls the upper bound
  limit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);

  return {
    cursor: query.cursor || undefined,
    limit,
  };
}

// Encode cursor (opaque to client)
function encodeCursor(id: string, createdAt: Date): string {
  const payload = JSON.stringify({ id, ts: createdAt.toISOString() });
  return Buffer.from(payload).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; ts: string } | null {
  try {
    const payload = Buffer.from(cursor, 'base64url').toString();
    const parsed = JSON.parse(payload);
    if (!parsed.id || !parsed.ts) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Repository with cursor pagination
async function listDocuments(
  tenantId: string,
  pagination: PaginationParams,
): Promise<PaginatedResponse<DocumentDTO>> {
  let query = db('documents')
    .where('tenant_id', tenantId)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(pagination.limit + 1); // Fetch one extra to detect hasMore

  if (pagination.cursor) {
    const cursor = decodeCursor(pagination.cursor);
    if (!cursor) {
      throw new BadRequestError('Invalid cursor');
    }
    // Use keyset pagination for performance
    query = query.where(function () {
      this.where('created_at', '<', cursor.ts)
        .orWhere(function () {
          this.where('created_at', '=', cursor.ts)
            .where('id', '<', cursor.id);
        });
    });
  }

  const rows = await query;
  const hasMore = rows.length > pagination.limit;
  const data = rows.slice(0, pagination.limit);

  return {
    data: data.map(toDocumentDTO),
    pagination: {
      nextCursor: hasMore
        ? encodeCursor(data[data.length - 1].id, data[data.length - 1].created_at)
        : null,
      hasMore,
      limit: pagination.limit,
    },
  };
}
```

---

## Pattern 5: Rate Limiting

### Theory

Rate limiting prevents abuse by restricting the number of requests a client
can make within a time window. Implement per-user, per-endpoint, and global
limits. Use Redis for distributed rate limiting across multiple instances.

### TypeScript -- Distributed Rate Limiter with Redis

```typescript
import Redis from 'ioredis';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { windowMs: 60_000, maxRequests: 60, keyPrefix: 'rl:default' },
  auth: { windowMs: 900_000, maxRequests: 5, keyPrefix: 'rl:auth' },
  upload: { windowMs: 3600_000, maxRequests: 20, keyPrefix: 'rl:upload' },
  search: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:search' },
};

class DistributedRateLimiter {
  constructor(private redis: Redis) {}

  async check(
    identifier: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const windowStart = Math.floor(Date.now() / config.windowMs);
    const key = `${config.keyPrefix}:${identifier}:${windowStart}`;

    // Atomic increment and check using Lua script
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      return current
    `;

    const count = await this.redis.eval(
      script, 1, key, config.windowMs.toString()
    ) as number;

    const remaining = Math.max(0, config.maxRequests - count);
    const resetAt = (windowStart + 1) * config.windowMs;

    return {
      allowed: count <= config.maxRequests,
      remaining,
      resetAt,
    };
  }
}

// Middleware
function rateLimitMiddleware(limiter: DistributedRateLimiter, configName: string) {
  const config = RATE_LIMITS[configName] || RATE_LIMITS.default;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Use authenticated user ID or IP as identifier
    const identifier = req.user?.id || req.ip;
    const result = await limiter.check(identifier, config);

    // Set standard rate limit headers
    res.set('X-RateLimit-Limit', config.maxRequests.toString());
    res.set('X-RateLimit-Remaining', result.remaining.toString());
    res.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      res.set('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000).toString());
      return res.status(429).json({ error: 'Too many requests' });
    }

    next();
  };
}

// Usage
app.post('/api/auth/login', rateLimitMiddleware(limiter, 'auth'), login);
app.post('/api/upload', rateLimitMiddleware(limiter, 'upload'), upload);
app.get('/api/search', rateLimitMiddleware(limiter, 'search'), search);
```

---

## Pattern 6: Mass Assignment Prevention

### Theory

Mass assignment occurs when a client sends fields that the server blindly
accepts and persists -- such as `role: "admin"` or `isVerified: true`.
Prevent this by using explicit allowlists for accepted fields and mapping
through DTOs.

### TypeScript -- Allowlisted Updates

```typescript
// INSECURE: Spreads entire request body into database update
// await db('users').where({ id }).update(req.body); // NEVER DO THIS

// SECURE: Explicitly allowlist fields
const UPDATABLE_USER_FIELDS = ['name', 'email', 'phone', 'timezone'] as const;
type UpdatableUserField = typeof UPDATABLE_USER_FIELDS[number];

function pickAllowedFields<T extends Record<string, any>>(
  body: T,
  allowed: readonly string[],
): Partial<T> {
  const picked: Partial<T> = {};
  for (const field of allowed) {
    if (field in body) {
      (picked as any)[field] = body[field];
    }
  }
  return picked;
}

app.patch('/api/users/:id', authenticate, async (req, res) => {
  // Only pick allowed fields -- role, isAdmin, etc. are ignored
  const updates = pickAllowedFields(req.body, UPDATABLE_USER_FIELDS);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const user = await db('users')
    .where({ id: req.params.id, tenant_id: req.user.tenantId })
    .update(updates)
    .returning('*');

  return res.json(toSelfDTO(user[0]));
});
```

---

## Pattern 7: Error Response Security

### Theory

Error responses must not leak internal details. Stack traces, database errors,
file paths, and server versions must never appear in production responses.
Use correlation IDs so support teams can find the full error in logs.

### TypeScript -- Secure Error Handler

```typescript
import { v4 as uuidv4 } from 'uuid';

// Error classification
class AppError extends Error {
  constructor(
    public statusCode: number,
    public publicMessage: string,
    public internalMessage?: string,
  ) {
    super(internalMessage || publicMessage);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

class ForbiddenError extends AppError {
  constructor() {
    super(403, 'You do not have permission to perform this action');
  }
}

// Global error handler
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();

  // Log the full error internally
  logger.error('Request error', {
    correlationId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
  });

  // Return safe response to client
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.publicMessage,
      correlationId,  // For support reference
    });
  }

  // Unknown errors: generic message, no details
  return res.status(500).json({
    error: 'An unexpected error occurred',
    correlationId,
    // NEVER include these in production:
    // stack: err.stack,
    // message: err.message,
    // query: "SELECT * FROM users WHERE...",
    // path: "/var/www/app/src/controllers/user.ts:42",
  });
}
```

### Go -- Secure Error Responses

```go
package handlers

import (
    "encoding/json"
    "log/slog"
    "net/http"

    "github.com/google/uuid"
)

type ErrorResponse struct {
    Error         string `json:"error"`
    CorrelationID string `json:"correlation_id"`
}

func handleError(w http.ResponseWriter, r *http.Request, err error) {
    correlationID := r.Header.Get("X-Correlation-ID")
    if correlationID == "" {
        correlationID = uuid.New().String()
    }

    // Log full error internally
    slog.Error("Request error",
        "correlation_id", correlationID,
        "error", err.Error(),
        "path", r.URL.Path,
        "method", r.Method,
    )

    // Return generic error to client
    statusCode := http.StatusInternalServerError
    publicMessage := "An unexpected error occurred"

    var appErr *AppError
    if errors.As(err, &appErr) {
        statusCode = appErr.StatusCode
        publicMessage = appErr.PublicMessage
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(ErrorResponse{
        Error:         publicMessage,
        CorrelationID: correlationID,
    })
}
```

---

## Pattern 8: API Versioning Security

### Theory

API versioning must include deprecation policies, sunset headers, and secure
migration paths. Old versions may contain known vulnerabilities. Force clients
to upgrade by setting clear sunset dates.

```typescript
// Version-aware middleware
function apiVersion(req: Request, res: Response, next: NextFunction) {
  const version = req.headers['api-version'] as string || 'v2'; // Default to latest

  const VERSIONS: Record<string, { active: boolean; sunset?: string }> = {
    v1: { active: false, sunset: '2025-06-01' },  // Deprecated
    v2: { active: true },                          // Current
    v3: { active: true },                          // Preview
  };

  const versionConfig = VERSIONS[version];
  if (!versionConfig) {
    return res.status(400).json({ error: `Unknown API version: ${version}` });
  }

  if (!versionConfig.active) {
    return res.status(410).json({
      error: `API version ${version} has been sunset`,
      message: 'Please upgrade to v2',
      documentation: 'https://docs.example.com/migration/v1-to-v2',
    });
  }

  if (versionConfig.sunset) {
    res.set('Sunset', new Date(versionConfig.sunset).toUTCString());
    res.set('Deprecation', 'true');
    res.set('Link', '<https://docs.example.com/migration>; rel="successor-version"');
  }

  req.apiVersion = version;
  next();
}
```

---

## Pattern 9: Request Signing (Webhook Verification)

### Theory

Verify that incoming webhooks originate from the expected sender using HMAC
signatures. The sender signs the request body with a shared secret, and the
receiver verifies the signature before processing.

### TypeScript -- HMAC Webhook Verification

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  secret: string,
  tolerance: number = 300,  // 5 minutes tolerance
): boolean {
  // Parse signature header: t=timestamp,v1=signature
  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
  const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1];

  if (!timestamp || !sig) {
    return false;
  }

  // Check timestamp to prevent replay attacks
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > tolerance) {
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload.toString()}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(sig, 'hex'),
    Buffer.from(expectedSig, 'hex'),
  );
}

// Webhook endpoint
app.post('/webhooks/payment',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['x-webhook-signature'] as string;
    if (!verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());
    processWebhookEvent(event);
    res.status(200).json({ received: true });
  }
);
```

### Go -- HMAC Verification

```go
package webhooks

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "math"
    "strconv"
    "strings"
    "time"
)

func VerifySignature(payload []byte, signatureHeader, secret string, tolerance time.Duration) error {
    parts := strings.Split(signatureHeader, ",")
    var timestamp string
    var signature string

    for _, part := range parts {
        kv := strings.SplitN(part, "=", 2)
        if len(kv) != 2 {
            continue
        }
        switch kv[0] {
        case "t":
            timestamp = kv[1]
        case "v1":
            signature = kv[1]
        }
    }

    if timestamp == "" || signature == "" {
        return fmt.Errorf("invalid signature header format")
    }

    // Check timestamp freshness
    ts, err := strconv.ParseInt(timestamp, 10, 64)
    if err != nil {
        return fmt.Errorf("invalid timestamp")
    }
    age := time.Since(time.Unix(ts, 0))
    if age > tolerance {
        return fmt.Errorf("signature too old: %v", age)
    }

    // Compute expected signature
    signedPayload := fmt.Sprintf("%s.%s", timestamp, string(payload))
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signedPayload))
    expectedSig := hex.EncodeToString(mac.Sum(nil))

    // Constant-time comparison
    sigBytes, _ := hex.DecodeString(signature)
    expectedBytes, _ := hex.DecodeString(expectedSig)
    if !hmac.Equal(sigBytes, expectedBytes) {
        return fmt.Errorf("signature mismatch")
    }

    return nil
}
```

---

## Pattern 10: API Key Design

### Theory

API keys must be designed for security: prefixed for identification, hashed
for storage, scoped to specific permissions, and rotatable without downtime.

### TypeScript -- Secure API Key System

```typescript
import crypto from 'crypto';

interface APIKey {
  id: string;
  prefix: string;        // First 8 chars for identification (stored plaintext)
  hash: string;          // SHA-256 hash of full key (stored, never plaintext)
  userId: string;
  name: string;
  scopes: string[];      // Permissions: ['read:documents', 'write:documents']
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

function generateAPIKey(): { fullKey: string; prefix: string; hash: string } {
  // Generate 32 random bytes (256 bits of entropy)
  const rawKey = crypto.randomBytes(32).toString('base64url');

  // Add prefix for identification: sk_live_<random>
  const fullKey = `sk_live_${rawKey}`;
  const prefix = fullKey.substring(0, 12); // "sk_live_xxxx"

  // Hash for storage -- never store the full key
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return { fullKey, prefix, hash };
}

// Create API key -- return full key ONCE, never store it
async function createAPIKey(
  userId: string,
  name: string,
  scopes: string[],
  expiresInDays?: number,
): Promise<{ key: string; id: string }> {
  const { fullKey, prefix, hash } = generateAPIKey();

  const apiKey = await db('api_keys').insert({
    id: uuidv4(),
    prefix,
    hash,
    user_id: userId,
    name,
    scopes: JSON.stringify(scopes),
    expires_at: expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000)
      : null,
    created_at: new Date(),
  }).returning('id');

  // Return full key only at creation -- it cannot be retrieved later
  return { key: fullKey, id: apiKey[0].id };
}

// Validate API key
async function validateAPIKey(
  providedKey: string,
): Promise<APIKey | null> {
  // Validate prefix format
  if (!providedKey.startsWith('sk_live_')) {
    return null;
  }

  // Hash the provided key and look up by hash
  const hash = crypto.createHash('sha256').update(providedKey).digest('hex');
  const apiKey = await db('api_keys')
    .where({ hash, revoked_at: null })
    .first();

  if (!apiKey) return null;

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null;
  }

  // Update last used timestamp
  await db('api_keys')
    .where({ id: apiKey.id })
    .update({ last_used_at: new Date() });

  return apiKey;
}

// Middleware
function apiKeyAuth(requiredScope: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer sk_')) {
      return res.status(401).json({ error: 'API key required' });
    }

    const key = authHeader.substring(7);
    const apiKey = await validateAPIKey(key);

    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    if (!apiKey.scopes.includes(requiredScope)) {
      return res.status(403).json({ error: 'Insufficient scope' });
    }

    req.apiKey = apiKey;
    next();
  };
}
```

---

## Pattern 11: Audit Logging

### TypeScript -- Structured Audit Logging

```typescript
interface AuditLogEntry {
  timestamp: string;
  eventType: string;
  actor: {
    id: string;
    type: 'user' | 'api_key' | 'system';
    ip: string;
  };
  action: string;
  resource: {
    type: string;
    id: string;
  };
  result: 'success' | 'failure' | 'error';
  metadata: Record<string, any>;
  correlationId: string;
}

class AuditLogger {
  async log(entry: AuditLogEntry): Promise<void> {
    // Write to immutable audit log (append-only table or stream)
    await db('audit_logs').insert({
      ...entry,
      timestamp: new Date(entry.timestamp),
      metadata: JSON.stringify(entry.metadata),
    });

    // Also send to centralized logging (ELK, Datadog, etc.)
    logger.info('audit', entry);
  }
}

// Usage in handlers
app.delete('/api/documents/:id', authenticate, async (req, res) => {
  const document = await documentRepo.findById(req.params.id);

  await auditLogger.log({
    timestamp: new Date().toISOString(),
    eventType: 'document.delete',
    actor: { id: req.user.id, type: 'user', ip: req.ip },
    action: 'delete',
    resource: { type: 'document', id: req.params.id },
    result: document ? 'success' : 'failure',
    metadata: { documentTitle: document?.title },
    correlationId: req.correlationId,
  });

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  await documentRepo.delete(req.params.id);
  res.status(204).send();
});
```

---

## Pattern 12: Circuit Breaker

### Theory

The circuit breaker pattern prevents cascading failures from compromised or
failing downstream services. If a service starts returning errors, the circuit
breaker opens and prevents further calls, returning a fallback response.

### TypeScript -- Circuit Breaker Implementation

```typescript
enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing -- reject requests
  HALF_OPEN = 'half_open', // Testing recovery
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 30000, // 30 seconds
    private readonly halfOpenMax: number = 3,
  ) {}

  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        if (fallback) return fallback();
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();

      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= this.halfOpenMax) {
          this.state = CircuitState.CLOSED;
          this.failureCount = 0;
        }
      }

      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = CircuitState.OPEN;
      }

      throw err;
    }
  }
}

// Usage with external service
const paymentCircuit = new CircuitBreaker(5, 30000);

async function processPayment(orderId: string, amount: number) {
  return paymentCircuit.execute(
    () => paymentGateway.charge(orderId, amount),
    () => {
      // Fallback: queue for retry
      return retryQueue.enqueue({ orderId, amount, action: 'charge' });
    }
  );
}
```

---

## Best Practices

1. **Validate at the boundary**: All input validation must happen at the API
   entry point before any business logic executes. Never trust client data.

2. **Use DTOs for responses**: Never return database entities directly.
   Map to response DTOs that contain only fields the caller is authorized
   to see.

3. **Enforce maximum page size**: Server must control the upper bound of
   pagination. Clients must not be able to request unlimited records.

4. **Implement idempotency for mutations**: All POST and PATCH endpoints
   should support idempotency keys to prevent duplicate operations from
   network retries.

5. **Rate limit all endpoints**: Apply rate limiting per-user and per-endpoint.
   Use stricter limits for authentication, password reset, and upload endpoints.

6. **Never leak internal details in errors**: Use correlation IDs for error
   tracking. Return generic messages to clients. Log full details server-side.

7. **Sign and verify webhooks**: Use HMAC signatures with timestamps to
   verify webhook authenticity and prevent replay attacks.

8. **Hash API keys for storage**: Never store API keys in plaintext. Hash
   them with SHA-256 and use a prefix for identification. Return the full
   key only once at creation.

9. **Audit all state-changing operations**: Log who did what, when, to which
   resource, and the result. Use structured, immutable audit logs.

10. **Use circuit breakers for external calls**: Prevent cascading failures
    from compromised or failing services by implementing circuit breaker
    patterns with fallback behavior.

---

## Anti-Patterns

1. **Returning database entities directly**: Sending ORM objects as JSON
   exposes internal fields like password hashes, soft-delete flags, and
   internal IDs. Always map through DTOs.

2. **Unbounded queries**: Allowing `?limit=999999` or no pagination at all.
   This enables data dumping and denial-of-service through memory exhaustion.

3. **Offset-based pagination for large datasets**: `OFFSET 100000` becomes
   progressively slower and allows enumeration attacks. Use cursor-based
   pagination instead.

4. **Spreading request body into updates**: `db.update(req.body)` allows
   mass assignment. Clients can set `role: admin` or `isVerified: true`.
   Always use explicit field allowlists.

5. **Verbose error messages in production**: Returning stack traces, SQL
   queries, or file paths in error responses. This gives attackers a map
   of the application internals.

6. **No rate limiting on auth endpoints**: Login, registration, and password
   reset without rate limiting enable brute force and credential stuffing
   attacks.

7. **Storing API keys in plaintext**: If the database is breached, all API
   keys are compromised. Hash them before storage and use prefixes for
   identification.

8. **Ignoring idempotency**: POST endpoints without idempotency support
   cause duplicate charges, duplicate orders, and duplicate notifications
   when clients retry failed requests.

---

## Enforcement Checklist

### Request Security
- [ ] All endpoints validate input with schema validation
- [ ] Unknown/extra fields are rejected (strict mode)
- [ ] Request body size limits are enforced
- [ ] Content-Type is validated
- [ ] Path parameters are validated (UUID format, etc.)

### Response Security
- [ ] Responses use DTOs, not database entities
- [ ] Field-level access control is implemented
- [ ] No internal fields in responses (password hashes, internal IDs)
- [ ] Error responses contain correlation IDs, not stack traces
- [ ] Pagination has enforced maximum page size

### Rate Limiting
- [ ] All endpoints have rate limits
- [ ] Auth endpoints have stricter limits
- [ ] Rate limit headers are included in responses
- [ ] Distributed rate limiting for multi-instance deployments

### API Keys & Authentication
- [ ] API keys are hashed before storage
- [ ] API keys have scopes (not full access)
- [ ] API keys have expiration dates
- [ ] Key rotation is supported without downtime
- [ ] Webhooks are verified with HMAC signatures

### Operational
- [ ] Idempotency is supported for mutation endpoints
- [ ] Audit logs capture all state changes
- [ ] Circuit breakers protect against downstream failures
- [ ] API versions have sunset policies
- [ ] Deprecated versions return Sunset headers
