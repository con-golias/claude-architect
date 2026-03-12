# Error Types & Hierarchy

> **AI Plugin Directive — Error Classification & Custom Error Types**
> You are an AI coding assistant. When generating, reviewing, or refactoring error handling
> code, follow EVERY rule in this document. Unstructured error handling causes silent failures,
> leaked internal details, and impossible debugging. Treat each section as non-negotiable.

**Core Rule: ALWAYS use typed, structured errors with error codes. ALWAYS distinguish between operational errors (expected) and programmer errors (bugs). NEVER expose internal error details to API consumers. ALWAYS propagate errors with full context for debugging.**

---

## 1. Error Classification

```
┌──────────────────────────────────────────────────────────────┐
│              Error Classification                              │
│                                                               │
│  OPERATIONAL ERRORS (expected, handle gracefully)            │
│  ├── Validation errors (bad user input)                      │
│  ├── Authentication/Authorization failures                   │
│  ├── Resource not found                                      │
│  ├── Conflict (duplicate resource)                           │
│  ├── Rate limited                                            │
│  ├── External service failure (timeout, 5xx)                 │
│  ├── Database constraint violations                          │
│  └── Business rule violations                                │
│                                                               │
│  PROGRAMMER ERRORS (bugs, crash and fix)                     │
│  ├── TypeError, ReferenceError                               │
│  ├── Null pointer / undefined access                         │
│  ├── Array out of bounds                                     │
│  ├── Assertion failures                                      │
│  └── Unhandled promise rejections                            │
│                                                               │
│  Rule: Operational errors → return error response            │
│  Rule: Programmer errors → log, alert, crash (if needed)    │
└──────────────────────────────────────────────────────────────┘
```

| Type | HTTP Status | Retry? | Alert? | Example |
|------|-------------|--------|--------|---------|
| Validation | 400 | NO | NO | Invalid email format |
| Authentication | 401 | NO | After N failures | Invalid token |
| Authorization | 403 | NO | YES (if repeated) | Insufficient permissions |
| Not Found | 404 | NO | NO | Resource doesn't exist |
| Conflict | 409 | NO | NO | Duplicate email |
| Rate Limited | 429 | YES (with backoff) | If sustained | Too many requests |
| Internal | 500 | YES | YES | Unhandled exception |
| Service Unavailable | 503 | YES | YES | Dependency down |
| Gateway Timeout | 504 | YES | YES | Upstream timeout |

---

## 2. TypeScript Error Hierarchy

```typescript
// Base application error
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,           // Machine-readable: "USER_NOT_FOUND"
    public readonly statusCode: number,     // HTTP status
    public readonly isOperational: boolean, // true = expected, false = bug
    public readonly details?: unknown,      // Additional context
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
class ValidationError extends AppError {
  constructor(details: Array<{ field: string; message: string }>) {
    super("Validation failed", "VALIDATION_ERROR", 400, true, details);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found`, "NOT_FOUND", 404, true, { resource, id });
  }
}

class ConflictError extends AppError {
  constructor(resource: string, field: string) {
    super(`${resource} already exists`, "CONFLICT", 409, true, { resource, field });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401, true);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, "FORBIDDEN", 403, true);
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super("Rate limit exceeded", "RATE_LIMITED", 429, true, { retryAfter });
  }
}

class ExternalServiceError extends AppError {
  constructor(service: string, originalError: Error) {
    super(
      `External service error: ${service}`,
      "EXTERNAL_SERVICE_ERROR", 502, true,
      { service, originalMessage: originalError.message }
    );
  }
}

// Usage
async function getUser(id: string): Promise<User> {
  const user = await db.users.findById(id);
  if (!user) throw new NotFoundError("User", id);
  return user;
}

async function createUser(data: CreateUserInput): Promise<User> {
  const existing = await db.users.findByEmail(data.email);
  if (existing) throw new ConflictError("User", "email");
  return db.users.create(data);
}
```

---

## 3. Go Error Types

```go
// Base application error
type AppError struct {
    Message     string `json:"message"`
    Code        string `json:"code"`
    StatusCode  int    `json:"-"`
    Operational bool   `json:"-"`
    Details     any    `json:"details,omitempty"`
    Err         error  `json:"-"` // Wrapped original error
}

func (e *AppError) Error() string { return e.Message }
func (e *AppError) Unwrap() error { return e.Err }

// Error constructors
func NewNotFoundError(resource, id string) *AppError {
    return &AppError{
        Message:    fmt.Sprintf("%s not found", resource),
        Code:       "NOT_FOUND",
        StatusCode: http.StatusNotFound,
        Operational: true,
        Details:    map[string]string{"resource": resource, "id": id},
    }
}

func NewValidationError(details []ValidationDetail) *AppError {
    return &AppError{
        Message:    "Validation failed",
        Code:       "VALIDATION_ERROR",
        StatusCode: http.StatusBadRequest,
        Operational: true,
        Details:    details,
    }
}

func NewConflictError(resource, field string) *AppError {
    return &AppError{
        Message:    fmt.Sprintf("%s already exists", resource),
        Code:       "CONFLICT",
        StatusCode: http.StatusConflict,
        Operational: true,
        Details:    map[string]string{"resource": resource, "field": field},
    }
}

func NewExternalServiceError(service string, err error) *AppError {
    return &AppError{
        Message:    fmt.Sprintf("External service error: %s", service),
        Code:       "EXTERNAL_SERVICE_ERROR",
        StatusCode: http.StatusBadGateway,
        Operational: true,
        Err:        err,
    }
}

// Sentinel errors for Is() checks
var (
    ErrNotFound     = &AppError{Code: "NOT_FOUND", StatusCode: 404}
    ErrUnauthorized = &AppError{Code: "UNAUTHORIZED", StatusCode: 401}
    ErrForbidden    = &AppError{Code: "FORBIDDEN", StatusCode: 403}
)

// Usage
func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("get user: %w", err)
    }
    if user == nil {
        return nil, NewNotFoundError("User", id)
    }
    return user, nil
}
```

---

## 4. Python Error Types

```python
class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int,
                 operational: bool = True, details: Any = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.operational = operational
        self.details = details

class NotFoundError(AppError):
    def __init__(self, resource: str, id: str):
        super().__init__(
            f"{resource} not found", "NOT_FOUND", 404,
            details={"resource": resource, "id": id},
        )

class ConflictError(AppError):
    def __init__(self, resource: str, field: str):
        super().__init__(
            f"{resource} already exists", "CONFLICT", 409,
            details={"resource": resource, "field": field},
        )

class ExternalServiceError(AppError):
    def __init__(self, service: str, original: Exception):
        super().__init__(
            f"External service error: {service}", "EXTERNAL_SERVICE_ERROR", 502,
            details={"service": service},
        )

# FastAPI exception handler
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"type": exc.code, "message": exc.message, "details": exc.details}},
    )
```

---

## 5. Error Wrapping & Context

```typescript
// ALWAYS wrap errors with context as they propagate up
async function processOrder(orderId: string): Promise<void> {
  try {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new NotFoundError("Order", orderId);

    try {
      await paymentService.charge(order);
    } catch (err) {
      // Wrap with context — preserve original error
      throw new ExternalServiceError("payment", err as Error);
    }

    await orderRepo.updateStatus(orderId, "confirmed");
  } catch (err) {
    if (err instanceof AppError) throw err; // Re-throw operational errors
    // Wrap unexpected errors
    throw new AppError(
      "Failed to process order",
      "ORDER_PROCESSING_FAILED", 500, false,
      { orderId }
    );
  }
}
```

```go
// Go: wrap errors with context using fmt.Errorf
func (s *OrderService) ProcessOrder(ctx context.Context, orderID string) error {
    order, err := s.repo.FindByID(ctx, orderID)
    if err != nil {
        return fmt.Errorf("process order %s: fetch: %w", orderID, err)
    }
    if order == nil {
        return NewNotFoundError("Order", orderID)
    }

    if err := s.payment.Charge(ctx, order); err != nil {
        return fmt.Errorf("process order %s: charge: %w", orderID, err)
    }

    return nil
}

// Check error type in handler
var appErr *AppError
if errors.As(err, &appErr) {
    writeJSON(w, appErr.StatusCode, appErr)
} else {
    writeJSON(w, 500, map[string]string{"error": "Internal server error"})
}
```

- ALWAYS wrap errors with context as they propagate up the call stack
- ALWAYS use `fmt.Errorf("context: %w", err)` in Go for error wrapping
- ALWAYS preserve the original error for debugging (stack trace, cause chain)
- NEVER lose the original error — wrap, don't replace

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Generic `throw new Error("failed")` | No context for debugging | Typed errors with code, status, details |
| Catching and ignoring errors | Silent failures | Log + re-throw or handle explicitly |
| String error messages for control flow | Fragile string matching | Error codes and `instanceof` / `errors.As` |
| `err.message` exposed to client | Internal details leaked | Map to safe client-facing error |
| No distinction operational vs bug | Bugs handled as operational | `isOperational` flag, crash on bugs |
| Losing original error context | Cannot trace root cause | Always wrap, never replace |

---

## 7. Enforcement Checklist

- [ ] Custom error hierarchy with typed error classes
- [ ] Each error has: message, code, statusCode, isOperational
- [ ] Operational errors handled gracefully (return error response)
- [ ] Programmer errors logged, alerted, and crash (if appropriate)
- [ ] Errors wrapped with context at every layer boundary
- [ ] Original error preserved in error chain
- [ ] Global error handler catches unhandled errors
- [ ] No internal details exposed in API error responses
