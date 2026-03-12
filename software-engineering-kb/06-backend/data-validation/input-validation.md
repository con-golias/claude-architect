# Input Validation

> **AI Plugin Directive — Input Validation & Boundary Enforcement**
> You are an AI coding assistant. When generating, reviewing, or refactoring input validation
> code, follow EVERY rule in this document. Missing or weak input validation is the root cause
> of injection attacks, data corruption, and application crashes. Treat each section as non-negotiable.

**Core Rule: NEVER trust any external input — validate at EVERY system boundary. ALWAYS validate on the server side even if client-side validation exists. ALWAYS reject invalid input with clear error messages. ALWAYS use allowlists over denylists.**

---

## 1. Validation Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│              Validation Boundary Model                         │
│                                                               │
│  External World (UNTRUSTED)                                  │
│  ├── HTTP request body, query params, headers                │
│  ├── URL path parameters                                     │
│  ├── File uploads                                            │
│  ├── WebSocket messages                                      │
│  ├── gRPC request messages                                   │
│  ├── Message queue payloads                                  │
│  ├── Webhook payloads from third parties                     │
│  └── CSV/JSON file imports                                   │
│                                                               │
│  ──────────── VALIDATION BOUNDARY ────────────               │
│                                                               │
│  Internal (TRUSTED after validation)                         │
│  ├── Service-to-service calls (validated at edge)            │
│  ├── Database queries (with parameterized queries)           │
│  └── Internal function calls                                 │
│                                                               │
│  Rule: Validate at the BOUNDARY, trust internally.           │
│  Validate ONCE at entry point, not in every function.        │
└──────────────────────────────────────────────────────────────┘
```

| Boundary | Validation Required | Example |
|----------|-------------------|---------|
| HTTP API endpoint | YES — always | Request body, params, headers |
| gRPC service method | YES — always | Protobuf message fields |
| Message queue consumer | YES — always | Message payload |
| Webhook receiver | YES — always | Payload + signature verification |
| Internal service call | Minimal (type-level) | Already validated at edge |
| Database layer | NO (use parameterized queries) | Inputs already validated |

---

## 2. Validation Rules by Data Type

| Data Type | Validations | Example |
|-----------|-------------|---------|
| **String** | min/max length, pattern (regex), trim, encoding | `name: min 1, max 100, trim` |
| **Email** | RFC 5322 format, max 254 chars, lowercase, domain check | `email: valid format, lowercase` |
| **Number** | integer/float, min/max range, precision | `age: int, min 0, max 150` |
| **Boolean** | strict true/false only | `active: boolean only` |
| **Date/Time** | ISO 8601 format, valid range, timezone | `createdAt: ISO 8601, not future` |
| **UUID** | v4 format (regex or library) | `id: uuid v4` |
| **URL** | valid format, allowed protocols (https only) | `website: https:// only` |
| **Enum** | exact match from allowed values | `status: "active" \| "inactive"` |
| **Array** | min/max items, unique, validate each element | `tags: max 10, unique, each min 1` |
| **Object** | required fields, no extra fields, nested validation | `address: {street, city, zip}` |
| **File** | size limit, MIME type allowlist, extension | `avatar: max 5MB, image/* only` |
| **Phone** | E.164 format, country validation | `phone: +1234567890` |
| **Password** | min length, complexity, not in breach list | `password: min 12, mixed chars` |

---

## 3. TypeScript (Zod)

```typescript
import { z } from "zod";

// Reusable validators
const email = z.string().email().max(254).toLowerCase().trim();
const uuid = z.string().uuid();
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// User creation schema
const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: email,
  password: z.string().min(12, "Password must be at least 12 characters"),
  role: z.enum(["user", "admin"]).default("user"),
  age: z.number().int().min(13).max(150).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).default([]),
});

// Update schema — all fields optional (partial)
const updateUserSchema = createUserSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

// Express middleware: validate request body
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    req.body = result.data; // Replace with validated + coerced data
    next();
  };
}

// Validate query params
function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: result.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.query = result.data as any;
    next();
  };
}

// Validate path params
function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid path parameters" });
    }
    req.params = result.data as any;
    next();
  };
}

// Usage
app.post("/api/users", validateBody(createUserSchema), createUser);
app.get("/api/users", validateQuery(pagination), listUsers);
app.get("/api/users/:id", validateParams(z.object({ id: uuid })), getUser);
```

---

## 4. Go (go-playground/validator)

```go
import "github.com/go-playground/validator/v10"

var validate = validator.New()

type CreateUserRequest struct {
    Name     string   `json:"name" validate:"required,min=1,max=100"`
    Email    string   `json:"email" validate:"required,email,max=254"`
    Password string   `json:"password" validate:"required,min=12"`
    Role     string   `json:"role" validate:"omitempty,oneof=user admin"`
    Age      *int     `json:"age" validate:"omitempty,min=13,max=150"`
    Tags     []string `json:"tags" validate:"max=10,dive,min=1,max=50"`
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, http.StatusBadRequest, "Invalid JSON body")
        return
    }

    if err := validate.Struct(req); err != nil {
        var validationErrors validator.ValidationErrors
        if errors.As(err, &validationErrors) {
            details := make([]map[string]string, 0, len(validationErrors))
            for _, e := range validationErrors {
                details = append(details, map[string]string{
                    "field":   e.Field(),
                    "message": formatValidationError(e),
                })
            }
            respondJSON(w, http.StatusBadRequest, map[string]any{
                "error":   "Validation failed",
                "details": details,
            })
            return
        }
        respondError(w, http.StatusBadRequest, "Validation failed")
        return
    }

    // req is validated — proceed with business logic
}

func formatValidationError(e validator.FieldError) string {
    switch e.Tag() {
    case "required": return fmt.Sprintf("%s is required", e.Field())
    case "min":      return fmt.Sprintf("%s must be at least %s", e.Field(), e.Param())
    case "max":      return fmt.Sprintf("%s must be at most %s", e.Field(), e.Param())
    case "email":    return "Invalid email format"
    case "oneof":    return fmt.Sprintf("%s must be one of: %s", e.Field(), e.Param())
    default:         return fmt.Sprintf("%s failed %s validation", e.Field(), e.Tag())
    }
}
```

---

## 5. Python (Pydantic)

```python
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Literal

class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(..., max_length=254)
    password: str = Field(..., min_length=12)
    role: Literal["user", "admin"] = "user"
    age: int | None = Field(default=None, ge=13, le=150)
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        for tag in v:
            if len(tag) < 1 or len(tag) > 50:
                raise ValueError("Each tag must be 1-50 characters")
        return v

# FastAPI usage — validation is automatic
@app.post("/api/users")
async def create_user(req: CreateUserRequest):
    # req is already validated by Pydantic
    pass
```

---

## 6. Error Response Format

```typescript
// Standardized validation error response
interface ValidationErrorResponse {
  error: "Validation failed";
  details: Array<{
    field: string;     // "email" or "address.zip"
    message: string;   // Human-readable error
    code?: string;     // Machine-readable code: "too_short", "invalid_format"
  }>;
}

// Example response (400 Bad Request):
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format", "code": "invalid_format" },
    { "field": "name", "message": "Name is required", "code": "required" },
    { "field": "age", "message": "Must be at least 13", "code": "too_small" }
  ]
}
```

- ALWAYS return ALL validation errors at once — not just the first one
- ALWAYS return 400 Bad Request for validation failures
- ALWAYS include the field name and human-readable message
- NEVER expose internal details (stack traces, DB column names) in error responses

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Client-only validation | Bypassed with curl/Postman | ALWAYS validate server-side |
| Denylist validation | Misses new attack vectors | Use allowlists (enum, regex, range) |
| Validation in business logic | Duplicated, inconsistent | Validate at boundary, trust internally |
| No length limits on strings | Memory exhaustion, DB overflow | ALWAYS set max length |
| First-error-only response | Users must retry for each error | Return ALL errors at once |
| Raw `process.env` as validation | No type coercion, no constraints | Use proper validation library |
| Trusting Content-Type header | Accepts XML when expecting JSON | Validate actual body content |
| No array length limits | DoS via million-element arrays | Set max items on every array |
| Regex denial of service (ReDoS) | Exponential regex backtracking | Use safe regex patterns, set timeouts |

---

## 8. Enforcement Checklist

- [ ] All external input validated at system boundary
- [ ] Server-side validation present (regardless of client-side)
- [ ] Validation library used (Zod, go-playground/validator, Pydantic)
- [ ] All strings have max length constraints
- [ ] All arrays have max items constraints
- [ ] All numbers have min/max range constraints
- [ ] Allowlists used for enums and format validation
- [ ] 400 response with ALL validation errors (not just first)
- [ ] Error response includes field name and human-readable message
- [ ] No internal details leaked in validation errors
- [ ] Validated data replaces raw input before processing
- [ ] File uploads validated: size, MIME type, extension
