# Validation Error Handling

> **AI Plugin Directive — Validation Error Responses & User Communication**
> You are an AI coding assistant. When generating, reviewing, or refactoring validation error
> handling code, follow EVERY rule in this document. Poor error messages frustrate users, expose
> internal details, and make APIs unusable. Treat each section as non-negotiable.

**Core Rule: ALWAYS return ALL validation errors in a single response — NEVER one at a time. ALWAYS use a consistent error format across the entire API. ALWAYS include the field path, human-readable message, and machine-readable code. NEVER expose internal implementation details.**

---

## 1. Standard Error Response Format

```
┌──────────────────────────────────────────────────────────────┐
│              Validation Error Response Structure               │
│                                                               │
│  HTTP 400 Bad Request / 422 Unprocessable Entity             │
│                                                               │
│  {                                                           │
│    "error": {                                                │
│      "type": "VALIDATION_ERROR",                             │
│      "message": "Request validation failed",                 │
│      "details": [                                            │
│        {                                                     │
│          "field": "email",                                   │
│          "message": "Invalid email format",                  │
│          "code": "invalid_format",                           │
│          "received": "not-an-email"                          │
│        },                                                    │
│        {                                                     │
│          "field": "address.zip",                             │
│          "message": "ZIP code must be 5 digits",            │
│          "code": "invalid_pattern"                           │
│        }                                                     │
│      ]                                                       │
│    }                                                         │
│  }                                                           │
│                                                               │
│  Rules:                                                      │
│  ├── ALL errors in one response (not first-error-only)      │
│  ├── Field path uses dot notation (address.zip)             │
│  ├── message = human-readable (for display)                 │
│  ├── code = machine-readable (for programmatic handling)    │
│  └── NEVER include stack traces or internal details         │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// Standard validation error response
interface ValidationErrorResponse {
  error: {
    type: "VALIDATION_ERROR";
    message: string;
    details: ValidationDetail[];
  };
}

interface ValidationDetail {
  field: string;       // Dot-notation path: "address.city"
  message: string;     // Human-readable: "City is required"
  code: string;        // Machine-readable: "required", "too_short", "invalid_format"
  received?: unknown;  // The invalid value (NEVER for passwords/secrets)
}
```

---

## 2. TypeScript Error Formatting

```typescript
import { z, ZodError, ZodIssue } from "zod";

// Convert Zod errors to standard API format
function formatZodError(error: ZodError): ValidationDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: mapZodCodeToApiCode(issue),
  }));
}

function mapZodCodeToApiCode(issue: ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.received === "undefined" ? "required" : "invalid_type";
    case "too_small":
      return issue.type === "string" ? "too_short" : "too_small";
    case "too_big":
      return issue.type === "string" ? "too_long" : "too_large";
    case "invalid_string":
      return `invalid_${issue.validation}`;  // invalid_email, invalid_uuid
    case "invalid_enum_value":
      return "invalid_enum";
    case "custom":
      return "validation_failed";
    default:
      return "invalid";
  }
}

// Middleware for consistent error handling
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: {
          type: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: formatZodError(result.error),
        },
      });
    }
    req.body = result.data;
    next();
  };
}

// Middleware for query params (422 for semantic errors)
function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: {
          type: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: formatZodError(result.error),
        },
      });
    }
    req.query = result.data as any;
    next();
  };
}
```

---

## 3. Go Error Formatting

```go
type APIError struct {
    Type    string             `json:"type"`
    Message string             `json:"message"`
    Details []ValidationDetail `json:"details,omitempty"`
}

type ValidationDetail struct {
    Field   string `json:"field"`
    Message string `json:"message"`
    Code    string `json:"code"`
}

func FormatValidationErrors(err error) *APIError {
    var validationErrors validator.ValidationErrors
    if !errors.As(err, &validationErrors) {
        return &APIError{
            Type:    "VALIDATION_ERROR",
            Message: "Request validation failed",
        }
    }

    details := make([]ValidationDetail, 0, len(validationErrors))
    for _, e := range validationErrors {
        details = append(details, ValidationDetail{
            Field:   toSnakeCase(e.Field()),
            Message: formatFieldError(e),
            Code:    mapTagToCode(e.Tag()),
        })
    }

    return &APIError{
        Type:    "VALIDATION_ERROR",
        Message: "Request validation failed",
        Details: details,
    }
}

func mapTagToCode(tag string) string {
    codeMap := map[string]string{
        "required": "required",
        "email":    "invalid_email",
        "min":      "too_short",
        "max":      "too_long",
        "oneof":    "invalid_enum",
        "url":      "invalid_url",
        "uuid":     "invalid_uuid",
    }
    if code, ok := codeMap[tag]; ok {
        return code
    }
    return "invalid"
}

func formatFieldError(e validator.FieldError) string {
    switch e.Tag() {
    case "required":
        return fmt.Sprintf("%s is required", e.Field())
    case "min":
        return fmt.Sprintf("%s must be at least %s characters", e.Field(), e.Param())
    case "max":
        return fmt.Sprintf("%s must be at most %s characters", e.Field(), e.Param())
    case "email":
        return "Must be a valid email address"
    case "oneof":
        return fmt.Sprintf("Must be one of: %s", e.Param())
    default:
        return fmt.Sprintf("%s is invalid", e.Field())
    }
}

// Handler usage
func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeJSON(w, http.StatusBadRequest, &APIError{
            Type:    "INVALID_JSON",
            Message: "Request body must be valid JSON",
        })
        return
    }

    if err := validate.Struct(req); err != nil {
        writeJSON(w, http.StatusBadRequest, FormatValidationErrors(err))
        return
    }
    // ...
}
```

---

## 4. Python Error Formatting (FastAPI/Pydantic)

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        details.append({
            "field": field,
            "message": error["msg"],
            "code": map_pydantic_code(error["type"]),
        })

    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "type": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": details,
            }
        },
    )

def map_pydantic_code(error_type: str) -> str:
    code_map = {
        "missing": "required",
        "string_too_short": "too_short",
        "string_too_long": "too_long",
        "value_error": "invalid_value",
        "string_pattern_mismatch": "invalid_pattern",
        "enum": "invalid_enum",
    }
    return code_map.get(error_type, "invalid")
```

---

## 5. Error Code Catalog

| Code | HTTP Status | Meaning | Example |
|------|-------------|---------|---------|
| `required` | 400 | Field is missing | `name` not provided |
| `invalid_type` | 400 | Wrong type | String where number expected |
| `too_short` | 400 | Below minimum length | Password < 12 chars |
| `too_long` | 400 | Exceeds maximum length | Name > 100 chars |
| `too_small` | 400 | Below minimum value | Age < 0 |
| `too_large` | 400 | Exceeds maximum value | Quantity > 10000 |
| `invalid_format` | 400 | Wrong format | Invalid date string |
| `invalid_email` | 400 | Not a valid email | Missing @ sign |
| `invalid_uuid` | 400 | Not a valid UUID | Wrong format |
| `invalid_url` | 400 | Not a valid URL | Missing protocol |
| `invalid_enum` | 400 | Not in allowed values | Role = "superadmin" |
| `invalid_pattern` | 400 | Regex mismatch | ZIP code wrong format |
| `already_exists` | 409 | Uniqueness violation | Email already registered |
| `not_found` | 404 | Referenced entity missing | Category ID doesn't exist |

- ALWAYS use consistent error codes across the entire API
- ALWAYS document error codes in API documentation
- ALWAYS use 400 for syntactic errors, 409 for uniqueness, 422 for semantic errors

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| First-error-only response | Users retry for each error | Return ALL errors at once |
| Stack traces in error response | Security risk, information leak | Map to safe error format |
| Different error formats per endpoint | Inconsistent API, hard to parse | Single error response format |
| Generic "Invalid input" message | Users cannot fix the problem | Specific field + message + code |
| Password value in error response | Secret exposure in logs | NEVER include sensitive values |
| No machine-readable code | Clients parse human text | Include `code` field for programmatic use |
| 500 for validation errors | Incorrect semantics | 400 for client errors |

---

## 7. Enforcement Checklist

- [ ] ALL validation errors returned in single response
- [ ] Consistent error format: `{ error: { type, message, details[] } }`
- [ ] Each detail includes: field (dot-notation), message, code
- [ ] Error codes are standardized and documented
- [ ] No stack traces or internal details in responses
- [ ] Sensitive values (passwords, tokens) NEVER in error responses
- [ ] 400 for syntax errors, 409 for uniqueness, 422 for semantic errors
- [ ] Error formatting centralized (not per-handler)
