# Data Mapping & Transformation Patterns

> **AI Plugin Directive — Data Mapping, Transformation & Projection**
> You are an AI coding assistant. When generating, reviewing, or refactoring data mapping
> and transformation code, follow EVERY rule in this document. Inconsistent mapping causes data
> loss, field omission, and security leaks. Treat each section as non-negotiable.

**Core Rule: ALWAYS use explicit mapper functions — NEVER spread or assign raw objects into responses. ALWAYS map only the fields needed for each context (projection). ALWAYS centralize mappers — one mapping function per transformation, not inline in handlers.**

---

## 1. Mapper Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Mapper Layer in Application Architecture          │
│                                                               │
│  Request → [Validate] → [Map to Domain] → Service Layer      │
│                                                               │
│  Service Layer → [Map to Response] → [Serialize] → Response  │
│                                                               │
│  Mapper Types:                                               │
│  ├── Request Mapper:  RequestDTO → Domain Model              │
│  ├── Response Mapper: Domain Model → ResponseDTO             │
│  ├── Entity Mapper:   Domain Model ↔ DB Entity               │
│  └── Event Mapper:    Domain Model → Event Payload           │
│                                                               │
│  Each mapper is a PURE FUNCTION:                             │
│  ├── No side effects                                         │
│  ├── No database calls                                       │
│  ├── Input → Output, nothing else                            │
│  └── Easy to test                                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Mappers

```typescript
// Centralized mapper module: src/mappers/user.mapper.ts

import type { User } from "../domain/user";
import type { UserEntity } from "../db/entities/user.entity";

// Domain → API Response
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// Domain → Minimal response (for list views, embedded refs)
export function toUserSummary(user: User): UserSummary {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
  };
}

// Request DTO → Domain (for create)
export function fromCreateRequest(req: CreateUserInput): Partial<User> {
  return {
    name: req.name,
    email: req.email,
    role: req.role ?? "user",
  };
}

// DB Entity → Domain
export function fromEntity(entity: UserEntity): User {
  return {
    id: entity.id,
    name: entity.name,
    email: entity.email,
    role: entity.role,
    avatarUrl: entity.avatar_url,  // snake_case → camelCase
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
    passwordHash: entity.password_hash,
  };
}

// Domain → DB Entity (for upsert)
export function toEntity(user: Partial<User>): Partial<UserEntity> {
  const entity: Partial<UserEntity> = {};
  if (user.name !== undefined) entity.name = user.name;
  if (user.email !== undefined) entity.email = user.email;
  if (user.role !== undefined) entity.role = user.role;
  if (user.avatarUrl !== undefined) entity.avatar_url = user.avatarUrl;
  if (user.passwordHash !== undefined) entity.password_hash = user.passwordHash;
  return entity;
}

// Batch mapping
export function toUserResponseList(users: User[]): UserResponse[] {
  return users.map(toUserResponse);
}
```

### 2.1 Nested Mapping

```typescript
// Order with nested user and items
export function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    status: order.status,
    total: {
      amount: order.totalCents.toString(),
      currency: order.currency,
    },
    customer: toUserSummary(order.customer),  // Nested mapper
    items: order.items.map(toOrderItemResponse), // Nested array mapper
    createdAt: order.createdAt.toISOString(),
  };
}

function toOrderItemResponse(item: OrderItem): OrderItemResponse {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPriceCents.toString(),
  };
}
```

---

## 3. Go Mappers

```go
// mappers/user_mapper.go

// Domain → Response
func ToUserResponse(u *domain.User) *UserResponse {
    return &UserResponse{
        ID:        u.ID,
        Name:      u.Name,
        Email:     u.Email,
        Role:      u.Role,
        AvatarURL: u.AvatarURL,
        CreatedAt: u.CreatedAt.Format(time.RFC3339),
        UpdatedAt: u.UpdatedAt.Format(time.RFC3339),
    }
}

// Domain → Summary (for lists, embedded)
func ToUserSummary(u *domain.User) *UserSummary {
    return &UserSummary{
        ID:        u.ID,
        Name:      u.Name,
        AvatarURL: u.AvatarURL,
    }
}

// Request → Domain
func FromCreateUserRequest(req *CreateUserRequest) *domain.User {
    return &domain.User{
        Name:  req.Name,
        Email: strings.ToLower(strings.TrimSpace(req.Email)),
        Role:  req.Role,
    }
}

// Entity → Domain
func FromUserEntity(e *entity.User) *domain.User {
    return &domain.User{
        ID:           e.ID,
        Name:         e.Name,
        Email:        e.Email,
        Role:         e.Role,
        AvatarURL:    e.AvatarURL,
        PasswordHash: e.PasswordHash,
        CreatedAt:    e.CreatedAt,
        UpdatedAt:    e.UpdatedAt,
    }
}

// Batch mapping
func ToUserResponseList(users []*domain.User) []*UserResponse {
    result := make([]*UserResponse, len(users))
    for i, u := range users {
        result[i] = ToUserResponse(u)
    }
    return result
}
```

---

## 4. Python Mappers

```python
# mappers/user_mapper.py

def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )

def to_user_summary(user: User) -> UserSummary:
    return UserSummary(id=user.id, name=user.name, avatar_url=user.avatar_url)

def from_create_request(req: CreateUserRequest) -> dict:
    return {
        "name": req.name,
        "email": req.email.lower().strip(),
        "role": req.role or "user",
    }

# Pydantic shortcut (when field names match)
def to_user_response_auto(user: User) -> UserResponse:
    return UserResponse.model_validate(user)  # Auto-maps matching fields
```

---

## 5. Field Projection (Sparse Fieldsets)

```typescript
// Allow clients to request only specific fields
// GET /api/users?fields=id,name,email
const FieldsSchema = z.object({
  fields: z.string()
    .optional()
    .transform((s) => s?.split(",").map((f) => f.trim()))
    .pipe(z.array(z.enum(["id", "name", "email", "role", "createdAt"])).optional()),
});

function projectFields<T extends Record<string, unknown>>(
  obj: T,
  fields?: string[]
): Partial<T> {
  if (!fields) return obj; // No filter — return all
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in obj) {
      (result as any)[field] = obj[field as keyof T];
    }
  }
  return result;
}

// Usage
app.get("/api/users", validateQuery(FieldsSchema), async (req, res) => {
  const users = await userService.list();
  const responses = users.map((u) => projectFields(toUserResponse(u), req.query.fields));
  res.json({ data: responses });
});
```

- ALWAYS validate field names against an allowlist — NEVER allow arbitrary field names
- ALWAYS return all fields by default when `fields` param is not provided
- ALWAYS include `id` in projections regardless of client request

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `{ ...entity }` in response | Internal fields leaked | Explicit mapper function |
| Mapper logic in handler | Duplicated, inconsistent | Centralized mapper module |
| No projection/summary DTOs | Over-fetching on list endpoints | Separate detail vs summary mappers |
| Mapper with side effects | Hard to test, unpredictable | Pure functions only |
| No null handling | `undefined` vs `null` inconsistency | Explicit null coalescing in mapper |
| Inline mapping in loops | Verbose, error-prone | `array.map(toResponse)` pattern |
| Same DTO for all contexts | List view returns 50 fields | Context-specific DTOs (summary, detail) |

---

## 7. Enforcement Checklist

- [ ] Dedicated mapper functions for every boundary crossing
- [ ] Mappers are pure functions (no side effects, no DB calls)
- [ ] Mappers centralized in dedicated module (not inline in handlers)
- [ ] Separate detail and summary response DTOs
- [ ] Batch mapping uses `array.map(mapper)` pattern
- [ ] Nested objects mapped recursively via nested mappers
- [ ] Field projection validated against allowlist
- [ ] `null` vs `undefined` handled explicitly in every mapper
- [ ] Entity → Domain and Domain → Response mappings kept separate
