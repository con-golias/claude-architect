# DTO Patterns & Request/Response Mapping

> **AI Plugin Directive — Data Transfer Objects & API Boundaries**
> You are an AI coding assistant. When generating, reviewing, or refactoring DTO patterns,
> follow EVERY rule in this document. Exposing internal models directly in API responses leaks
> implementation details, breaks backward compatibility, and creates security vulnerabilities.
> Treat each section as non-negotiable.

**Core Rule: NEVER expose database models directly in API responses. ALWAYS use dedicated DTOs (request schemas and response schemas) at API boundaries. ALWAYS separate internal domain models from external API contracts.**

---

## 1. DTO Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              DTO Boundary Architecture                         │
│                                                               │
│  Client ◄──── Response DTO ◄──── Domain Model ◄── Database  │
│  Client ────► Request DTO  ────► Domain Model ──► Database   │
│                                                               │
│  API Layer        │        Service Layer      │   Data Layer  │
│  (DTOs)           │        (Domain)           │   (Entities)  │
│                   │                           │               │
│  CreateUserReq ──►│──► User (domain) ────────►│──► UserEntity │
│  UserResponse ◄──│◄── User (domain) ◄────────│◄── UserEntity │
│                   │                           │               │
│  WHY:                                                        │
│  ├── DB schema changes don't break API contract              │
│  ├── Sensitive fields (password_hash) never leak             │
│  ├── API can evolve independently from DB schema             │
│  └── Request validation is separate from DB constraints      │
└──────────────────────────────────────────────────────────────┘
```

| Layer | Type | Contains | Example |
|-------|------|----------|---------|
| **Request DTO** | Input | Only fields client can set | `CreateUserRequest` |
| **Response DTO** | Output | Only fields client should see | `UserResponse` |
| **Domain Model** | Internal | Full business entity | `User` |
| **DB Entity** | Persistence | DB-specific (ORM decorators) | `UserEntity` |

---

## 2. TypeScript DTO Patterns

```typescript
import { z } from "zod";

// Request DTOs (input validation schemas)
const CreateUserRequest = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(12),
  role: z.enum(["user", "admin"]).default("user"),
});

const UpdateUserRequest = CreateUserRequest
  .partial()
  .omit({ password: true })
  .refine((d) => Object.keys(d).length > 0, "At least one field required");

// Response DTOs (what the client sees)
interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// List response with pagination
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Mapper: Domain → Response DTO
function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    // NOTE: password_hash, internal_flags, etc. are NOT included
  };
}

// Mapper: Domain[] → Paginated Response
function toPaginatedResponse<T, R>(
  items: T[],
  mapper: (item: T) => R,
  page: number,
  limit: number,
  total: number
): PaginatedResponse<R> {
  return {
    data: items.map(mapper),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

// Controller usage
app.get("/api/users", validateQuery(PaginationSchema), async (req, res) => {
  const { page, limit } = req.query;
  const { users, total } = await userService.list(page, limit);
  res.json(toPaginatedResponse(users, toUserResponse, page, limit, total));
});

app.post("/api/users", validateBody(CreateUserRequest), async (req, res) => {
  const user = await userService.create(req.body);
  res.status(201).json(toUserResponse(user));
});
```

---

## 3. Go DTO Patterns

```go
// Request DTOs
type CreateUserRequest struct {
    Name     string `json:"name" validate:"required,min=1,max=100"`
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=12"`
    Role     string `json:"role" validate:"omitempty,oneof=user admin"`
}

type UpdateUserRequest struct {
    Name  *string `json:"name" validate:"omitempty,min=1,max=100"`
    Email *string `json:"email" validate:"omitempty,email"`
    Role  *string `json:"role" validate:"omitempty,oneof=user admin"`
}

// Response DTOs
type UserResponse struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    Email     string `json:"email"`
    Role      string `json:"role"`
    CreatedAt string `json:"createdAt"`
    UpdatedAt string `json:"updatedAt"`
}

type PaginatedResponse[T any] struct {
    Data       []T        `json:"data"`
    Pagination Pagination `json:"pagination"`
}

type Pagination struct {
    Page       int  `json:"page"`
    Limit      int  `json:"limit"`
    Total      int  `json:"total"`
    TotalPages int  `json:"totalPages"`
    HasNext    bool `json:"hasNext"`
    HasPrev    bool `json:"hasPrev"`
}

// Mapper: Domain → Response DTO
func ToUserResponse(u *domain.User) UserResponse {
    return UserResponse{
        ID:        u.ID,
        Name:      u.Name,
        Email:     u.Email,
        Role:      u.Role,
        CreatedAt: u.CreatedAt.Format(time.RFC3339),
        UpdatedAt: u.UpdatedAt.Format(time.RFC3339),
        // password_hash, internal fields NOT exposed
    }
}

func ToUserListResponse(users []*domain.User, page, limit, total int) PaginatedResponse[UserResponse] {
    data := make([]UserResponse, len(users))
    for i, u := range users {
        data[i] = ToUserResponse(u)
    }
    totalPages := (total + limit - 1) / limit
    return PaginatedResponse[UserResponse]{
        Data: data,
        Pagination: Pagination{
            Page: page, Limit: limit, Total: total,
            TotalPages: totalPages,
            HasNext: page*limit < total,
            HasPrev: page > 1,
        },
    }
}
```

---

## 4. Python DTO Patterns

```python
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

# Request DTOs
class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=12)
    role: str = Field(default="user", pattern="^(user|admin)$")

class UpdateUserRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    role: str | None = Field(default=None, pattern="^(user|admin)$")

# Response DTOs
class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    pagination: PaginationMeta

class PaginationMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool

# Mapper
def to_user_response(user: User) -> UserResponse:
    return UserResponse.model_validate(user)

# FastAPI usage
@app.get("/api/users", response_model=PaginatedResponse[UserResponse])
async def list_users(page: int = 1, limit: int = 20):
    users, total = await user_service.list(page, limit)
    return PaginatedResponse(
        data=[to_user_response(u) for u in users],
        pagination=PaginationMeta(
            page=page, limit=limit, total=total,
            total_pages=math.ceil(total / limit),
            has_next=page * limit < total,
            has_prev=page > 1,
        ),
    )
```

---

## 5. DTO Versioning

```typescript
// API version-specific DTOs
// v1: original response format
interface UserResponseV1 {
  id: string;
  name: string;
  email: string;
}

// v2: added fields, renamed field
interface UserResponseV2 {
  id: string;
  fullName: string;    // Renamed from "name"
  email: string;
  role: string;        // New field
  avatarUrl: string;   // New field
}

// Version-aware mapper
function toUserResponse(user: User, version: "v1" | "v2"): UserResponseV1 | UserResponseV2 {
  if (version === "v1") {
    return { id: user.id, name: user.name, email: user.email };
  }
  return {
    id: user.id,
    fullName: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? "",
  };
}
```

- ALWAYS version DTOs when API evolves — old clients get old format
- NEVER rename or remove response fields without versioning
- ALWAYS support at least 1 prior version during migration

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| DB model as API response | password_hash exposed | Dedicated response DTO |
| No pagination metadata | Client cannot paginate | Standard pagination envelope |
| Request DTO = Response DTO | Internal fields settable via API | Separate input/output schemas |
| Manual field copying | Tedious, fields missed | Mapper functions or class methods |
| Dates as Unix timestamps | Timezone ambiguity | ISO 8601 strings |
| Inconsistent field naming | `created_at` vs `createdAt` | Pick one convention (camelCase for JSON) |
| No DTO versioning | Breaking changes for clients | Version DTOs with API version |
| null vs missing vs empty | Ambiguous semantics | Document: null = unset, missing = no change |

---

## 7. Enforcement Checklist

- [ ] Dedicated request DTOs for every API endpoint
- [ ] Dedicated response DTOs — NEVER expose DB models directly
- [ ] Mapper functions convert between domain models and DTOs
- [ ] Pagination response follows standard envelope format
- [ ] Sensitive fields (password_hash, internal_id) excluded from responses
- [ ] Dates serialized as ISO 8601 strings
- [ ] Consistent field naming convention (camelCase for JSON)
- [ ] DTO versioning strategy defined for API evolution
- [ ] `null` vs `undefined` vs empty string semantics documented
