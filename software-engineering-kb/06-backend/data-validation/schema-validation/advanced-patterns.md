# Advanced Schema Patterns

> **AI Plugin Directive — Advanced Validation Patterns & Conditional Logic**
> You are an AI coding assistant. When generating, reviewing, or refactoring complex validation
> patterns, follow EVERY rule in this document. Complex business rules require precise schema
> logic — incorrect conditional validation silently accepts invalid data. Treat each section as non-negotiable.

**Core Rule: ALWAYS use schema-level refinements for cross-field validation. ALWAYS use discriminated unions for polymorphic data. ALWAYS use transforms for data normalization within the schema pipeline.**

---

## 1. Conditional Validation

```typescript
import { z } from "zod";

// Conditional: if role is admin, require adminCode
const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["user", "admin"]),
  adminCode: z.string().optional(),
}).refine(
  (data) => data.role !== "admin" || (data.adminCode && data.adminCode.length >= 8),
  {
    message: "Admin code (min 8 chars) is required for admin role",
    path: ["adminCode"],
  }
);

// Conditional: shipping address required only for physical products
const OrderSchema = z.object({
  productType: z.enum(["physical", "digital"]),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    zip: z.string().min(5),
  }).optional(),
}).refine(
  (data) => data.productType !== "physical" || data.shippingAddress !== undefined,
  {
    message: "Shipping address is required for physical products",
    path: ["shippingAddress"],
  }
);

// Multiple cross-field validations
const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: "startDate must be before endDate", path: ["endDate"] }
).refine(
  (data) => {
    const diff = new Date(data.endDate).getTime() - new Date(data.startDate).getTime();
    return diff <= 365 * 24 * 60 * 60 * 1000; // Max 1 year range
  },
  { message: "Date range cannot exceed 1 year", path: ["endDate"] }
);
```

```go
// Cross-field validation in Go
type DateRangeRequest struct {
    StartDate time.Time `json:"startDate" validate:"required"`
    EndDate   time.Time `json:"endDate" validate:"required,gtfield=StartDate"`
}

// Custom cross-field validator
validate.RegisterValidation("max_range_days", func(fl validator.FieldLevel) bool {
    parent := fl.Parent()
    start := parent.FieldByName("StartDate").Interface().(time.Time)
    end := fl.Field().Interface().(time.Time)
    return end.Sub(start) <= 365*24*time.Hour
})
```

```python
from pydantic import model_validator

class DateRange(BaseModel):
    start_date: datetime
    end_date: datetime

    @model_validator(mode="after")
    def validate_range(self):
        if self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date")
        if (self.end_date - self.start_date).days > 365:
            raise ValueError("Date range cannot exceed 1 year")
        return self
```

---

## 2. Discriminated Unions

Use when the shape of data depends on a type field.

```typescript
// Payment method — shape depends on "type" field
const CreditCardPayment = z.object({
  type: z.literal("credit_card"),
  cardNumber: z.string().regex(/^\d{13,19}$/),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/),
  cvv: z.string().regex(/^\d{3,4}$/),
});

const BankTransferPayment = z.object({
  type: z.literal("bank_transfer"),
  accountNumber: z.string().min(8).max(20),
  routingNumber: z.string().length(9),
});

const CryptoPayment = z.object({
  type: z.literal("crypto"),
  walletAddress: z.string().min(26).max(62),
  network: z.enum(["bitcoin", "ethereum", "solana"]),
});

// Discriminated union — Zod picks the right schema based on "type"
const PaymentSchema = z.discriminatedUnion("type", [
  CreditCardPayment,
  BankTransferPayment,
  CryptoPayment,
]);

// TypeScript infers: CreditCardPayment | BankTransferPayment | CryptoPayment
type Payment = z.infer<typeof PaymentSchema>;

// Validation automatically selects correct schema:
PaymentSchema.parse({ type: "credit_card", cardNumber: "4111111111111111", ... }); // ✅
PaymentSchema.parse({ type: "bank_transfer", walletAddress: "..." }); // ❌ wrong fields
```

```python
from pydantic import BaseModel
from typing import Annotated, Union, Literal
from pydantic import Discriminator, Tag

class CreditCardPayment(BaseModel):
    type: Literal["credit_card"]
    card_number: str = Field(..., pattern=r"^\d{13,19}$")
    expiry: str = Field(..., pattern=r"^(0[1-9]|1[0-2])/\d{2}$")
    cvv: str = Field(..., pattern=r"^\d{3,4}$")

class BankTransferPayment(BaseModel):
    type: Literal["bank_transfer"]
    account_number: str = Field(..., min_length=8, max_length=20)
    routing_number: str = Field(..., min_length=9, max_length=9)

Payment = Annotated[
    Union[
        Annotated[CreditCardPayment, Tag("credit_card")],
        Annotated[BankTransferPayment, Tag("bank_transfer")],
    ],
    Discriminator("type"),
]
```

- ALWAYS use discriminated unions for polymorphic request bodies
- ALWAYS use `z.literal()` for the discriminant field — not `z.string()`
- ALWAYS match on `type` field by convention

---

## 3. Transforms & Pipelines

Transform input data within the validation pipeline.

```typescript
// Transform: normalize data during validation
const UserSchema = z.object({
  name: z.string()
    .trim()
    .min(1)
    .max(100)
    .transform((name) => name.replace(/\s+/g, " ")), // Collapse whitespace

  email: z.string()
    .email()
    .toLowerCase()
    .trim(),

  tags: z.string()
    .transform((s) => s.split(",").map((t) => t.trim().toLowerCase()))
    .pipe(z.array(z.string().min(1)).max(10)), // Transform then validate

  price: z.string()
    .transform((s) => parseFloat(s))
    .pipe(z.number().positive().multipleOf(0.01)),
});

// Pipeline: string → parse → validate
const DateSchema = z.string()
  .datetime()
  .transform((s) => new Date(s))
  .refine((d) => d > new Date(), "Date must be in the future");

// Default + transform
const SlugSchema = z.string()
  .max(100)
  .transform((s) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
  .pipe(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/));
```

```python
from pydantic import field_validator

class ProductRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., max_length=100)
    price: float = Field(..., gt=0)
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, v: str) -> str:
        return " ".join(v.strip().split())  # Collapse whitespace

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, v: str) -> str:
        import re
        slug = v.lower().strip()
        slug = re.sub(r"\s+", "-", slug)
        slug = re.sub(r"[^a-z0-9-]", "", slug)
        return slug
```

- ALWAYS apply transforms (trim, lowercase, normalize) within the schema — not in business logic
- ALWAYS use `.pipe()` to validate AFTER transformation
- ALWAYS keep transforms pure and side-effect free

---

## 4. Recursive & Self-Referencing Schemas

```typescript
// Tree structure (e.g., comment threads, org hierarchy)
type Category = {
  name: string;
  children: Category[];
};

const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string().min(1).max(100),
    children: z.array(CategorySchema).max(50).default([]),
  })
);

// Limit recursion depth (prevent DoS)
function validateWithDepthLimit<T>(
  schema: z.ZodType<T>,
  data: unknown,
  maxDepth: number
): T {
  const jsonStr = JSON.stringify(data);
  const depth = maxNestingDepth(jsonStr);
  if (depth > maxDepth) {
    throw new Error(`Input exceeds maximum nesting depth of ${maxDepth}`);
  }
  return schema.parse(data);
}
```

```python
from pydantic import BaseModel
from typing import Optional

class Comment(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    author: str
    replies: list["Comment"] = Field(default_factory=list, max_length=50)

Comment.model_rebuild()  # Required for self-referencing
```

- ALWAYS use `z.lazy()` (Zod) or forward references for recursive schemas
- ALWAYS set max depth/size limits on recursive structures — prevent DoS
- ALWAYS set max array length on recursive children

---

## 5. Async Validation

```typescript
// Validate against external data sources (database uniqueness, etc.)
const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
});

// Async validation (after schema validation)
async function validateRegistration(data: z.infer<typeof RegisterSchema>): Promise<string[]> {
  const errors: string[] = [];

  // Check email uniqueness
  const existingEmail = await db.users.findByEmail(data.email);
  if (existingEmail) errors.push("Email is already registered");

  // Check username uniqueness
  const existingUsername = await db.users.findByUsername(data.username);
  if (existingUsername) errors.push("Username is already taken");

  return errors;
}

// Usage in handler
app.post("/register", validateBody(RegisterSchema), async (req, res) => {
  const asyncErrors = await validateRegistration(req.body);
  if (asyncErrors.length > 0) {
    return res.status(409).json({ error: "Validation failed", details: asyncErrors });
  }
  // Proceed with registration
});
```

- ALWAYS separate sync validation (schema) from async validation (DB lookups)
- ALWAYS run sync validation FIRST — avoid unnecessary DB queries on invalid input
- ALWAYS return 409 Conflict (not 400) for uniqueness violations

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No cross-field validation | Invalid combinations accepted | Use `.refine()` / `model_validator` |
| `z.any()` for polymorphic data | No validation on variant fields | Discriminated unions |
| Transform outside schema | Business logic does normalization | Transform within schema pipeline |
| No depth limit on recursive schemas | DoS via deeply nested input | Set max depth + max array size |
| Async validation before sync | Wasted DB queries on invalid data | Sync validation first, then async |
| Duplicate schemas for similar shapes | Drift, inconsistency | Compose with extend/partial/omit |

---

## 7. Enforcement Checklist

- [ ] Cross-field validation uses schema-level refinements (not ad-hoc)
- [ ] Discriminated unions used for polymorphic request bodies
- [ ] Data transforms (trim, lowercase, normalize) done within schema
- [ ] Recursive schemas have depth and size limits
- [ ] Async validation separated from sync and runs AFTER
- [ ] Schemas composed (extend/partial/omit), not duplicated
- [ ] All transforms are pure and side-effect free
