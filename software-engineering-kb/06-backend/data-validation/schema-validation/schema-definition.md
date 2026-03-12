# Schema Definition & Libraries

> **AI Plugin Directive — Schema Definition & Type-Safe Validation**
> You are an AI coding assistant. When generating, reviewing, or refactoring schema validation
> code, follow EVERY rule in this document. Schemas are the contract between your API and
> consumers — inconsistent or missing schemas cause silent data corruption. Treat each section as non-negotiable.

**Core Rule: ALWAYS define an explicit schema for EVERY data structure that crosses a boundary. ALWAYS use a dedicated validation library — NEVER write manual `if/else` validation. ALWAYS generate TypeScript types FROM the schema (single source of truth).**

---

## 1. Schema Library Selection

```
┌──────────────────────────────────────────────────────────────┐
│              Schema Library Decision Tree                      │
│                                                               │
│  TypeScript?                                                  │
│  ├── YES → Zod (type inference, composable) ← RECOMMENDED   │
│  ├── YES → Yup (form-focused, React ecosystem)              │
│  └── YES → Joi (Express/Hapi ecosystem, no type inference)   │
│                                                               │
│  Go?                                                          │
│  ├── go-playground/validator (struct tags) ← RECOMMENDED     │
│  └── ozzo-validation (fluent API)                            │
│                                                               │
│  Python?                                                      │
│  ├── Pydantic (FastAPI native, type hints) ← RECOMMENDED    │
│  ├── marshmallow (Flask ecosystem)                           │
│  └── cerberus (dictionary-based schemas)                     │
│                                                               │
│  Protobuf/gRPC?                                              │
│  └── buf validate / protovalidate                            │
└──────────────────────────────────────────────────────────────┘
```

| Library | Language | Type Inference | Composability | Ecosystem |
|---------|----------|---------------|---------------|-----------|
| **Zod** | TypeScript | YES (native) | Excellent | Any TS framework |
| **Yup** | TypeScript | Partial | Good | React/Formik |
| **Joi** | JavaScript | NO | Good | Express/Hapi |
| **validator** | Go | NO (struct tags) | Limited | Any Go framework |
| **ozzo** | Go | NO (fluent) | Good | Any Go framework |
| **Pydantic** | Python | YES (type hints) | Excellent | FastAPI native |
| **marshmallow** | Python | NO | Good | Flask/SQLAlchemy |

---

## 2. TypeScript Schemas (Zod)

```typescript
import { z } from "zod";

// Primitive schemas
const stringRequired = z.string().min(1).max(255);
const email = z.string().email().max(254).toLowerCase().trim();
const uuid = z.string().uuid();
const isoDate = z.string().datetime();
const positiveInt = z.coerce.number().int().positive();
const url = z.string().url().startsWith("https://");

// Enum schema
const UserRole = z.enum(["user", "admin", "moderator"]);
type UserRole = z.infer<typeof UserRole>; // "user" | "admin" | "moderator"

// Object schema
const AddressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().length(2).toUpperCase(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  country: z.string().length(2).toUpperCase().default("US"),
});

const CreateUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: email,
  password: z.string().min(12).max(128),
  role: UserRole.default("user"),
  address: AddressSchema.optional(),
  phoneNumbers: z.array(z.string().regex(/^\+\d{10,15}$/)).max(3).default([]),
  metadata: z.record(z.string(), z.string()).optional(), // key-value pairs
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms" }),
  }),
});

// Infer TypeScript type FROM schema (single source of truth)
type CreateUserInput = z.infer<typeof CreateUserSchema>;
// CreateUserInput is fully typed — IDE autocomplete, compile-time checks

// Partial schema for updates (all fields optional)
const UpdateUserSchema = CreateUserSchema
  .partial()
  .omit({ acceptedTerms: true })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
```

### 2.1 Schema Composition

```typescript
// Base schemas (reusable building blocks)
const TimestampMixin = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const SearchSchema = PaginationSchema.extend({
  q: z.string().min(1).max(200).optional(),
  filters: z.record(z.string(), z.string()).optional(),
});

// Compose: entity + timestamps
const UserResponseSchema = CreateUserSchema
  .omit({ password: true })
  .merge(TimestampMixin)
  .extend({ id: uuid });

type UserResponse = z.infer<typeof UserResponseSchema>;
```

---

## 3. Go Schemas (Struct Tags)

```go
import (
    "github.com/go-playground/validator/v10"
    "regexp"
)

var validate *validator.Validate

func init() {
    validate = validator.New()

    // Register custom validators
    validate.RegisterValidation("phone", validatePhone)
    validate.RegisterValidation("slug", validateSlug)
}

// Custom validator: phone number
func validatePhone(fl validator.FieldLevel) bool {
    phone := fl.Field().String()
    matched, _ := regexp.MatchString(`^\+\d{10,15}$`, phone)
    return matched
}

// Custom validator: URL slug
func validateSlug(fl validator.FieldLevel) bool {
    slug := fl.Field().String()
    matched, _ := regexp.MatchString(`^[a-z0-9]+(-[a-z0-9]+)*$`, slug)
    return matched
}

type CreateUserRequest struct {
    Name         string   `json:"name" validate:"required,min=1,max=100"`
    Email        string   `json:"email" validate:"required,email,max=254"`
    Password     string   `json:"password" validate:"required,min=12,max=128"`
    Role         string   `json:"role" validate:"omitempty,oneof=user admin moderator"`
    PhoneNumbers []string `json:"phoneNumbers" validate:"max=3,dive,phone"`
    Address      *Address `json:"address" validate:"omitempty"`
}

type Address struct {
    Street  string `json:"street" validate:"required,min=1,max=200"`
    City    string `json:"city" validate:"required,min=1,max=100"`
    State   string `json:"state" validate:"required,len=2,uppercase"`
    Zip     string `json:"zip" validate:"required,zipcode"`
    Country string `json:"country" validate:"required,len=2,uppercase"`
}

// Validate struct
func ValidateStruct(s interface{}) []ValidationError {
    err := validate.Struct(s)
    if err == nil {
        return nil
    }

    var errors []ValidationError
    for _, e := range err.(validator.ValidationErrors) {
        errors = append(errors, ValidationError{
            Field:   e.Field(),
            Message: formatError(e),
        })
    }
    return errors
}
```

---

## 4. Python Schemas (Pydantic)

```python
from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from typing import Literal
from datetime import datetime
import re

class Address(BaseModel):
    street: str = Field(..., min_length=1, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)
    zip_code: str = Field(..., pattern=r"^\d{5}(-\d{4})?$")
    country: str = Field(default="US", min_length=2, max_length=2)

    @field_validator("state", "country")
    @classmethod
    def uppercase(cls, v: str) -> str:
        return v.upper()

class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(..., max_length=254)
    password: str = Field(..., min_length=12, max_length=128)
    role: Literal["user", "admin", "moderator"] = "user"
    address: Address | None = None
    phone_numbers: list[str] = Field(default_factory=list, max_length=3)
    accepted_terms: Literal[True]

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("phone_numbers")
    @classmethod
    def validate_phones(cls, v: list[str]) -> list[str]:
        pattern = re.compile(r"^\+\d{10,15}$")
        for phone in v:
            if not pattern.match(phone):
                raise ValueError(f"Invalid phone: {phone}")
        return v

# Response schema (excludes password, adds id + timestamps)
class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    address: Address | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}  # Support ORM objects
```

---

## 5. Schema Registry Pattern

```typescript
// Centralize all schemas in one registry for reuse and documentation
const schemas = {
  // Auth
  login: z.object({ email, password: z.string().min(1) }),
  register: CreateUserSchema,

  // Users
  createUser: CreateUserSchema,
  updateUser: UpdateUserSchema,
  userParams: z.object({ id: uuid }),
  userQuery: PaginationSchema.extend({
    role: UserRole.optional(),
    search: z.string().max(100).optional(),
  }),

  // Products
  createProduct: z.object({
    name: z.string().min(1).max(200),
    price: z.number().positive().multipleOf(0.01),
    category: z.enum(["electronics", "clothing", "food"]),
    tags: z.array(z.string()).max(20),
  }),
} as const;

// Auto-generate OpenAPI schemas from Zod
import { generateSchema } from "@anatine/zod-openapi";
const openApiSchemas = Object.fromEntries(
  Object.entries(schemas).map(([key, schema]) => [key, generateSchema(schema)])
);
```

- ALWAYS centralize schemas in a registry — prevents duplication
- ALWAYS generate API documentation (OpenAPI) from schemas — single source of truth

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Manual `if/else` validation | Inconsistent, incomplete | Use validation library (Zod, Pydantic) |
| Type and schema out of sync | Runtime errors despite TypeScript | Infer types FROM schema (`z.infer`) |
| Separate request/response types | Duplication, drift | Compose with `.omit()`, `.extend()`, `.partial()` |
| No custom error messages | Cryptic errors for users | Provide human-readable messages per field |
| Schemas defined inline | Duplication across routes | Centralize in schema registry |
| No schema for query params | Injection via query string | Validate query params with schema |
| String type for everything | No type safety downstream | Coerce to proper types in schema |

---

## 7. Enforcement Checklist

- [ ] Dedicated validation library used (Zod, validator, Pydantic)
- [ ] Every data boundary has an explicit schema
- [ ] TypeScript types inferred FROM schemas (single source of truth)
- [ ] Schemas composed via `.extend()`, `.partial()`, `.omit()` (no duplication)
- [ ] Custom error messages provided for all validation rules
- [ ] Schemas centralized in a registry module
- [ ] OpenAPI documentation generated from schemas
- [ ] Custom validators registered for domain-specific rules
- [ ] Query parameters and path parameters have schemas
