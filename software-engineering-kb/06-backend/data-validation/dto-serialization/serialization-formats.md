# Serialization Formats & JSON Handling

> **AI Plugin Directive — Serialization, JSON Conventions & Data Encoding**
> You are an AI coding assistant. When generating, reviewing, or refactoring serialization
> code, follow EVERY rule in this document. Inconsistent serialization causes data loss, parsing
> errors, and cross-language interop failures. Treat each section as non-negotiable.

**Core Rule: ALWAYS use camelCase for JSON field names in APIs. ALWAYS serialize dates as ISO 8601 strings. ALWAYS handle BigInt, Decimal, and special numeric types explicitly. NEVER rely on default serialization — always control the output format.**

---

## 1. JSON Conventions

```
┌──────────────────────────────────────────────────────────────┐
│              JSON API Conventions                              │
│                                                               │
│  Field Naming:                                               │
│  ├── camelCase for JSON API responses ← STANDARD             │
│  ├── snake_case for database columns                         │
│  └── Auto-convert between them in serialization layer        │
│                                                               │
│  Null Semantics:                                             │
│  ├── null     → field exists, value is explicitly null       │
│  ├── missing  → field not provided (for PATCH, means "skip")│
│  └── ""       → empty string (valid value, not null)         │
│                                                               │
│  Numbers:                                                    │
│  ├── Integers → JSON number (safe up to 2^53 - 1)          │
│  ├── BigInt/ID → JSON string (avoid precision loss)         │
│  └── Money    → JSON string or object { amount, currency }  │
│                                                               │
│  Dates:                                                      │
│  └── ALWAYS ISO 8601 with timezone: "2026-03-09T22:30:00Z" │
└──────────────────────────────────────────────────────────────┘
```

| Data Type | JSON Representation | Why |
|-----------|-------------------|-----|
| String | `"hello"` | Native JSON |
| Integer (< 2^53) | `42` | Safe as JSON number |
| BigInt / Large ID | `"9007199254740993"` | String to prevent precision loss |
| Float / Decimal | `"19.99"` or `{"amount": 1999, "currency": "USD"}` | String or cents to avoid float errors |
| Boolean | `true` / `false` | Native JSON |
| Date/Time | `"2026-03-09T22:30:00Z"` | ISO 8601 with Z (UTC) |
| Duration | `"PT1H30M"` (ISO 8601) or `5400` (seconds) | Context-dependent |
| Enum | `"active"` | String, not integer |
| Binary | Base64 string | `"aGVsbG8="` |
| Null | `null` | Explicit null |
| Empty array | `[]` | Not null, not omitted |

---

## 2. TypeScript Serialization

```typescript
// Custom JSON serializers for problematic types

// BigInt serialization (JSON.stringify doesn't support BigInt natively)
function serializeBigInt(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

// Decimal/Money — NEVER use floating point for money
import Decimal from "decimal.js";

interface MoneyDTO {
  amount: string;    // "19.99" — string to preserve precision
  currency: string;  // "USD"
}

function serializeMoney(cents: number, currency: string): MoneyDTO {
  return {
    amount: new Decimal(cents).dividedBy(100).toFixed(2),
    currency,
  };
}

// Date serialization — ALWAYS ISO 8601 with timezone
function serializeDate(date: Date): string {
  return date.toISOString(); // "2026-03-09T22:30:00.000Z"
}

// Custom toJSON on domain models
class User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // Internal — NEVER serialize
  createdAt: Date;

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      createdAt: this.createdAt.toISOString(),
      // passwordHash intentionally omitted
    };
  }
}

// camelCase ↔ snake_case conversion
function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value && typeof value === "object" && !Array.isArray(value)
      ? snakeToCamel(value)
      : value;
  }
  return result;
}
```

---

## 3. Go Serialization

```go
import (
    "encoding/json"
    "time"
    "github.com/shopspring/decimal"
)

// Struct tags control JSON field names
type UserResponse struct {
    ID        string    `json:"id"`
    Name      string    `json:"name"`
    Email     string    `json:"email"`
    Role      string    `json:"role"`
    CreatedAt time.Time `json:"createdAt"` // Marshals to ISO 8601 automatically
    UpdatedAt time.Time `json:"updatedAt"`

    // Fields with json:"-" are NEVER serialized
    PasswordHash string `json:"-"`
    InternalFlag bool   `json:"-"`
}

// Custom marshaling for money (avoid float64)
type Money struct {
    Amount   decimal.Decimal `json:"amount"`   // "19.99" as string
    Currency string          `json:"currency"` // "USD"
}

func (m Money) MarshalJSON() ([]byte, error) {
    return json.Marshal(struct {
        Amount   string `json:"amount"`
        Currency string `json:"currency"`
    }{
        Amount:   m.Amount.StringFixed(2),
        Currency: m.Currency,
    })
}

// Omit empty vs null
type UpdateRequest struct {
    Name  *string `json:"name,omitempty"`  // Omitted if nil (PATCH semantics)
    Email *string `json:"email,omitempty"` // Omitted if nil
    Bio   *string `json:"bio"`             // Included as null if nil
}

// Enum serialization (string, not int)
type OrderStatus string

const (
    OrderPending   OrderStatus = "pending"
    OrderConfirmed OrderStatus = "confirmed"
    OrderShipped   OrderStatus = "shipped"
    OrderDelivered OrderStatus = "delivered"
)
```

---

## 4. Python Serialization

```python
from pydantic import BaseModel, Field, field_serializer
from datetime import datetime
from decimal import Decimal
from enum import Enum

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"

class Money(BaseModel):
    amount: Decimal
    currency: str

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"  # "19.99" — string, not float

class OrderResponse(BaseModel):
    id: str
    status: OrderStatus
    total: Money
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
        # Convert snake_case Python attrs to camelCase JSON
        "alias_generator": lambda s: "".join(
            word.capitalize() if i else word
            for i, word in enumerate(s.split("_"))
        ),
        "populate_by_name": True,
    }

# FastAPI automatically uses Pydantic serialization
@app.get("/orders/{id}", response_model=OrderResponse)
async def get_order(id: str):
    order = await order_service.get(id)
    return OrderResponse.model_validate(order)
```

---

## 5. Content Negotiation

```typescript
// Support multiple serialization formats
app.get("/api/users/:id", async (req, res) => {
  const user = await userService.get(req.params.id);
  const accept = req.headers.accept;

  if (accept?.includes("application/xml")) {
    res.type("application/xml").send(toXML(user));
  } else if (accept?.includes("text/csv")) {
    res.type("text/csv").send(toCSV([user]));
  } else {
    res.json(toUserResponse(user)); // Default: JSON
  }
});

// Response compression
import compression from "compression";
app.use(compression({
  filter: (req, res) => {
    const contentType = res.getHeader("Content-Type") as string;
    return /json|text|xml|csv/.test(contentType ?? "");
  },
  threshold: 1024, // Only compress responses > 1KB
}));
```

- ALWAYS default to `application/json`
- ALWAYS set correct `Content-Type` header
- ALWAYS compress responses > 1KB (gzip or brotli)

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Float for money | `0.1 + 0.2 = 0.30000000000000004` | Use string, Decimal, or integer cents |
| JSON number for BigInt | Precision loss above 2^53 | Serialize as string |
| Unix timestamp for dates | Timezone confusion | ISO 8601 with timezone |
| snake_case in JSON API | Inconsistent with JS conventions | camelCase for JSON, snake_case in DB |
| No `json:"-"` on secrets | Internal fields in response | Exclude sensitive fields explicitly |
| `null` vs missing ambiguity | PATCH updates don't work | Document semantics per endpoint |
| Default `toString()` | Uncontrolled output format | Explicit serializer / `toJSON` method |
| Integer enums in API | Breaking when values change | String enums always |

---

## 7. Enforcement Checklist

- [ ] camelCase used for all JSON API field names
- [ ] Dates serialized as ISO 8601 with timezone (`"2026-03-09T22:30:00Z"`)
- [ ] Money/Decimal values serialized as strings or integer cents (NEVER float)
- [ ] BigInt/large IDs serialized as strings
- [ ] Enums serialized as strings (not integers)
- [ ] Sensitive fields excluded from serialization (`json:"-"`, omit from DTO)
- [ ] `null` vs missing vs empty semantics documented
- [ ] Response compression enabled for responses > 1KB
- [ ] `Content-Type` header correctly set for all responses
- [ ] snake_case ↔ camelCase conversion handled in serialization layer
