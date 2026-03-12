# REST API Resource Naming — Complete Specification

> **AI Plugin Directive:** When designing REST API endpoints, naming resources, structuring URIs, choosing ID formats, or establishing API conventions, ALWAYS consult this guide. Apply these rules to every REST API to ensure consistency, discoverability, and adherence to industry standards.

**Core Rule: ALWAYS use plural nouns for collections, kebab-case for multi-word URIs, and opaque IDs (UUID/ULID/type-prefixed). NEVER use verbs in URIs (HTTP methods are verbs). NEVER expose database schema. NEVER use CamelCase in URI paths. ALWAYS keep resource nesting to 2-3 levels maximum.**

---

## 1. URI Structure Fundamentals

### Golden Rules

✅ **Use PLURAL NOUNS** for collections: `/users`, `/orders`, `/products` (not `/user`, `/order`)
✅ **NO VERBS** in URIs: `POST /users` (not `POST /createUser`)
✅ **LOWERCASE** with kebab-case: `/order-history` (not `/OrderHistory`)
✅ **NO file extensions**: `GET /users/123` with `Accept: application/json` (not `/users/123.json`)
✅ **Hierarchical** structure: `/users/123/orders/456`

### Sub-Resources vs Query Parameters

**Use Sub-Resources** when exclusive parent-child relationship exists:
```http
GET /users/123/orders              # Orders belong to user 123
GET /posts/456/comments            # Comments on specific post
```

**Use Query Parameters** for filtering across collections:
```http
GET /orders?user_id=123&status=pending
GET /products?category=electronics&price_max=1000
```

---

## 2. Naming Conventions

| Case Style | URI Path | JSON Fields | Recommendation |
|------------|----------|-------------|----------------|
| **kebab-case** | ✅ RECOMMENDED | ❌ Rarely | **GOLD STANDARD for URIs** (GitHub, PayPal) |
| **snake_case** | ⚠️ Acceptable | ✅ RECOMMENDED | Python APIs, Stripe, Twitter |
| **camelCase** | ❌ Avoid | ✅ RECOMMENDED | JavaScript/Node.js APIs |
| **PascalCase** | ❌ NEVER | ❌ NEVER | **ANTI-PATTERN** |

**Industry data**: 60% of public APIs use kebab-case for URIs, 55% use snake_case for JSON fields.

---

## 3. Resource Hierarchy

**Maximum nesting depth:**
- ✅ **2 levels**: RECOMMENDED (`/users/123/orders`)
- ⚠️ **3 levels**: Acceptable (`/companies/456/departments/789/employees`)
- ❌ **4+ levels**: ANTI-PATTERN — refactor required

---

## 4. Collection vs Singleton Resources

**Collections (plural):**
```http
GET    /users              # List users
POST   /users              # Create user
GET    /users/123          # Get specific user
PUT    /users/123          # Update user
DELETE /users/123          # Delete user
```

**Singletons (singular) — one-to-one with parent:**
```http
GET   /users/123/profile          # User's profile (only one)
PUT   /users/123/profile
GET   /users/123/preferences      # User preferences singleton
```

**The `/me` pattern:**
```http
GET /users/me                    # Current authenticated user
GET /users/me/orders             # Current user's orders
PATCH /users/me/profile          # Update own profile
```

---

## 5. Action Endpoints (When Verbs ARE Acceptable)

**Pattern 1: Action as Sub-Resource (Preferred)**
```http
POST /orders/123/cancel
POST /users/456/activate
POST /invoices/789/send

Body: { "reason": "Customer request", "refund": true }
```

**Pattern 2: RPC-Style with Colon**
```http
POST /instances/123:start
POST /instances/123:stop
```

**Pattern 3: Standalone Controller**
```http
POST /search
Body: { "query": "laptop", "resources": ["products", "articles"] }
```

**When acceptable:**
- Cross-resource search (`POST /search`)
- Batch operations (`POST /batch`)
- Authentication (`POST /login`, `POST /logout`)
- Procedural operations that don't fit CRUD

---

## 6. Query Parameter Standards

| Parameter | Purpose | Example |
|-----------|---------|---------|
| **Pagination** |
| `limit` | Max items per page | `?limit=20` |
| `offset` | Skip N items | `?offset=100` |
| `cursor` | Cursor token | `?cursor=xyz123` |
| **Sorting** |
| `sort` | Sort fields | `?sort=-created_at,name` (- = descending) |
| **Filtering** |
| `q` | Search term | `?q=laptop` |
| `{field}` | Field filter | `?status=active&category=electronics` |
| **Field Selection** |
| `fields` | Select fields | `?fields=id,name,email` |
| `include` | Include relations | `?include=author,comments` |

---

## 7. ID Formats

| ID Format | Example | Pros | Cons | Use When |
|-----------|---------|------|------|----------|
| **Type-Prefixed (Stripe)** | `cus_1234ABC` | Type-safe, short, self-documenting | Custom impl | **RECOMMENDED** |
| **UUID v4** | `550e8400-e29b-...` | Globally unique, unpredictable | Large (36 chars), not sortable | Distributed systems |
| **ULID** | `01ARZ3NDEK...` | Sortable by time, shorter than UUID | Less adoption | Modern distributed systems |
| **Slug** | `my-blog-post` | Human-readable, SEO-friendly | Not unique, mutable | Public content |
| **Auto-increment** | `123` | Simple, efficient | Predictable, not distributed | Internal systems only |

**Recommended: Type-Prefixed IDs (Stripe pattern)**
```http
GET /customers/cus_1234567890ABC
GET /charges/ch_xyz9876543210
GET /subscriptions/sub_abc123def456
```

---

## 8. Content Negotiation — NO File Extensions

```http
❌ BAD:  GET /users/123.json
✅ GOOD: GET /users/123
         Accept: application/json
```

**Why:** URIs identify resources, not representations. Use Accept header for format negotiation.

---

## 9. API Versioning

```http
# URI versioning (RECOMMENDED for public APIs)
GET /v1/users
GET /v2/products

# Header versioning (internal APIs)
GET /users
API-Version: 2026-03-01
```

**Rules:**
- Use major versions only: `v1`, `v2`, `v3` (not `v1.2.3`)
- Breaking changes → new version
- Additive changes → same version

---

## 10. Anti-Patterns

| Anti-Pattern | ❌ Wrong | ✅ Correct |
|--------------|---------|-----------|
| Verb URIs | `/createUser` | `POST /users` |
| CamelCase | `/UserProfiles` | `/user-profiles` |
| Deep nesting | `/a/b/c/d/e` | `/e?filters` or max 3 levels |
| DB schema | `/tbl_users` | `/users` |
| Query for ID | `?id=123` | `/users/123` |
| File extensions | `/users.json` | `/users` + Accept header |

---

## 11. Real-World Examples

**GitHub API:**
```http
GET /repos/octocat/hello-world/pull-requests?state=open
PUT /gists/abc123/star
```

**Stripe API:**
```http
POST /v1/payment_intents
POST /charges/ch_123/capture
GET /customers/cus_123/sources
```

---

## 12. Enforcement Checklist

- [ ] All collections use **plural nouns**
- [ ] URIs are **lowercase** with **kebab-case**
- [ ] **No verbs** in URIs (except controller resources)
- [ ] Resource nesting ≤ **3 levels**
- [ ] IDs are **opaque** (UUID/ULID/type-prefixed)
- [ ] **No file extensions** in URIs
- [ ] Version in URI path (`/v1/`)
- [ ] Query params follow **standard naming**
- [ ] `/me` endpoint for authenticated user
- [ ] **No database schema** in URIs
- [ ] Content negotiation via **Accept header**

---

## Sources

- [REST API URI Naming Conventions](https://restfulapi.net/resource-naming/)
- [Microsoft Azure API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)
- [Moesif - REST API Sub-Resources](https://www.moesif.com/blog/technical/api-design/REST-API-Design-Best-Practices-for-Sub-and-Nested-Resources/)
- [Stack Overflow - REST API Best Practices](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/)
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Stripe API Reference](https://docs.stripe.com/api)
