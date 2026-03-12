# Naming Conventions

| Property     | Value                                                                |
|-------------|----------------------------------------------------------------------|
| Domain      | Code Quality > Standards                                             |
| Importance  | Critical                                                             |
| Languages   | TypeScript, Python, Go, Rust (comparison)                            |
| Cross-ref   | [Clean Code Patterns](../../01-fundamentals/clean-code/), [TypeScript Standards](typescript-standards.md) |

---

## Core Concepts

### Universal Naming Principles

1. **Reveal intent** — the name should answer: what, why, and how it is used
2. **Avoid abbreviations** — `usr`, `mgr`, `btn` are cryptic; `user`, `manager`, `button` are clear
3. **Make names searchable** — `MAX_RETRY_COUNT` is greppable; `5` is not
4. **Make names pronounceable** — if you cannot say it in a code review, rename it
5. **Scope-proportional length** — short names for short scopes, long names for long scopes

```typescript
// ❌ BAD: Cryptic, ambiguous, unsearchable
const d = new Date();
const yyyymmdd = fmt(d);
function proc(u: any, f: boolean) { ... }
const data = fetchData(); // "data" says nothing

// ✅ GOOD: Intent-revealing, pronounceable, searchable
const createdAt = new Date();
const formattedDate = formatISO(createdAt);
function deactivateUser(user: User, notifyAdmin: boolean) { ... }
const activeProjects = fetchActiveProjects();
```

### Variable Naming

**Booleans — always use `is`, `has`, `can`, `should` prefix:**

```typescript
// ❌ BAD
const active = true;
const admin = user.role === "admin";
const visible = element.style.display !== "none";
const error = response.status >= 400;

// ✅ GOOD
const isActive = true;
const isAdmin = user.role === "admin";
const isVisible = element.style.display !== "none";
const hasError = response.status >= 400;
const canEdit = user.permissions.includes("write");
const shouldRetry = attempt < MAX_RETRIES;
```

**Arrays — use plural nouns:**

```typescript
// ❌ BAD
const userList = []; // Redundant "List" — it's already an array
const item = fetchItems(); // Singular for a collection

// ✅ GOOD
const users = [];
const items = fetchItems();
const activeOrderIds = orders.filter(o => o.isActive).map(o => o.id);
```

**Maps / Dictionaries — use `keyToValue` or `keyByValue` pattern:**

```typescript
// ❌ BAD
const data = new Map();        // What data?
const userMap = {};             // Redundant type suffix

// ✅ GOOD
const userById = new Map<string, User>();
const priceByProductId: Record<string, number> = {};
const roleToPermissions: Record<Role, Permission[]> = { ... };
const emailToUser = new Map<string, User>();
```

**Counters and accumulators:**

```typescript
// ❌ BAD
const c = 0;
const total = items.length; // Ambiguous: total what?

// ✅ GOOD
const retryCount = 0;
const totalItems = items.length;
const numFailedRequests = errors.length;
const maxConnectionsPerHost = 10;
```

**Temps and iterators — single letters only for tiny scopes (1-5 lines):**

```typescript
for (let i = 0; i < rows.length; i++) { ... }  // ✅ OK in tight loop

const u = await fetchUser(id); // ❌ BAD: 200 lines later, what is u?
const currentUser = await fetchUser(id); // ✅ GOOD
```

### Function Naming

**Verb + noun pattern — functions DO things:**

```typescript
// ❌ BAD: Noun-only or vague names
function user(id: string) { ... }
function data() { ... }
function processStuff() { ... }

// ✅ GOOD: Verb + noun reveals action and target
function fetchUser(id: string): Promise<User> { ... }
function calculateTotalPrice(items: CartItem[]): number { ... }
function validateEmailAddress(email: string): boolean { ... }
function sendWelcomeEmail(user: User): Promise<void> { ... }
```

**Boolean-returning functions — use `is`, `has`, `can`:**

```typescript
// ❌ BAD
function admin(user: User): boolean { ... }
function checkPermission(user: User): boolean { ... }

// ✅ GOOD
function isAdmin(user: User): boolean { ... }
function hasPermission(user: User, action: Action): boolean { ... }
function canAccessResource(user: User, resource: Resource): boolean { ... }
```

**Async functions — use `fetch`, `load`, `save`, `send`:**

```typescript
// ❌ BAD: No indication of async / IO
function user(id: string): Promise<User> { ... }
function config(): Promise<Config> { ... }

// ✅ GOOD: Verb implies network/IO
function fetchUser(id: string): Promise<User> { ... }
function loadConfig(): Promise<Config> { ... }
function saveOrder(order: Order): Promise<void> { ... }
function sendNotification(msg: Message): Promise<void> { ... }
```

**Event handlers — `on` or `handle` prefix:**

```typescript
// ❌ BAD
function click() { ... }
function submit() { ... }

// ✅ GOOD: on + event (for prop callbacks), handle + event (for implementation)
<Button onClick={onUserClick} />

function handleUserClick(event: MouseEvent) { ... }
function handleFormSubmit(data: FormData) { ... }
function onConnectionClose(reason: string) { ... }
```

**Factory functions — `create` or `make`:**

```typescript
// ❌ BAD
function user(name: string): User { ... }
function newLogger(): Logger { ... } // "new" conflicts with constructor keyword

// ✅ GOOD
function createUser(name: string): User { ... }
function makeLogger(config: LogConfig): Logger { ... }
function buildQuery(params: QueryParams): string { ... }
```

### Class / Type Naming

```typescript
// ❌ BAD: Vague suffixes, verb-based names
class UserManager { ... }      // Manager of what exactly?
class DataProcessor { ... }    // Everything is a "processor"
class HandlePayment { ... }    // Verb — should be a function, not a class

// ✅ GOOD: Specific nouns that describe the entity
class UserRepository { ... }   // Clear: stores/retrieves users
class PaymentGateway { ... }   // Clear: interface to payment system
class InvoiceGenerator { ... } // Clear: creates invoices

// ❌ BAD: Redundant type suffixes
interface IUser { ... }        // "I" prefix (C# habit — not idiomatic in TS/Go)
type UserType = { ... }        // "Type" suffix is redundant
class UserClass { ... }

// ✅ GOOD
interface User { ... }
type UserRole = "admin" | "editor" | "viewer";
class UserService { ... }
```

### File Naming

```
# ❌ BAD: Inconsistent casing
UserService.ts        # PascalCase files for non-components
my_util_functions.ts  # Mixed conventions
getAllUsers.ts         # Verb-based file name

# ✅ GOOD: Consistent conventions

# TypeScript/JavaScript — kebab-case for files
user-service.ts
auth-middleware.ts
order.repository.ts   # Dot notation for type: name.type.ext

# React Components — PascalCase (matches component name)
UserProfile.tsx
PaymentForm.tsx

# Python — snake_case
user_service.py
auth_middleware.py
test_user_service.py  # test_ prefix for test files

# Go — snake_case (or single-word lowercase)
user.go
user_test.go
handler.go
```

**Index / barrel files — use sparingly.** Only for module public API, not in every folder.

### Constant Naming

```typescript
// SCREAMING_SNAKE_CASE for true compile-time / env constants
const MAX_RETRIES = 3;
const API_BASE_URL = "https://api.example.com";
const DEFAULT_TIMEOUT_MS = 5000;

// camelCase for derived / computed values (even if const)
const defaultHeaders = { "Content-Type": "application/json" };
const allowedOrigins = ["https://app.example.com", "https://admin.example.com"];

// Enum-like constants — group with as const
const HttpStatus = {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;
```

```python
# Python: UPPER_SNAKE_CASE for module-level constants
MAX_RETRIES = 3
DEFAULT_TIMEOUT = timedelta(seconds=30)
API_BASE_URL = "https://api.example.com"

# Go: Exported PascalCase constants (no SCREAMING_SNAKE in Go)
const (
    MaxRetries     = 3
    DefaultTimeout = 30 * time.Second
)
```

### API Naming

**REST — plural nouns, consistent hierarchy:**

```
# ❌ BAD
GET  /getUser/123
POST /createNewOrder
GET  /user/123/order-list
PUT  /updateUser

# ✅ GOOD
GET    /users/123
POST   /orders
GET    /users/123/orders
PUT    /users/123
PATCH  /users/123
DELETE /users/123

# Nested resources: max 2 levels deep
GET /users/123/orders/456         # OK
GET /users/123/orders/456/items   # OK (limit)
GET /users/123/orders/456/items/789/details  # ❌ Too deep — flatten
```

**GraphQL — verb-less queries, verb-prefixed mutations:**

```graphql
# ❌ BAD
query { getUser(id: "123") { ... } }
mutation { user(input: {...}) { ... } }

# ✅ GOOD
query { user(id: "123") { name email } }              # Noun-based query
query { users(filter: { active: true }) { name } }    # Plural for lists
mutation { createUser(input: {...}) { id } }           # Verb-prefixed mutation
mutation { updateUserEmail(userId: "123", email: "...") { id } }
```

**RPC / gRPC — verb + noun:**

```protobuf
// ❌ BAD
rpc User(GetRequest) returns (UserResponse);

// ✅ GOOD
rpc GetUser(GetUserRequest) returns (GetUserResponse);
rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
```

### Database Naming

```sql
-- ❌ BAD: Inconsistent, abbreviated, ambiguous
CREATE TABLE Users (ID int, fname text, lName text, usr_email text);
CREATE TABLE order_items (orderID int, prod_id int);

-- ✅ GOOD: snake_case, singular table names, full words
CREATE TABLE user_account (     -- Singular table name
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_item (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id    BIGINT NOT NULL REFERENCES purchase_order(id),  -- entity_id pattern
    product_id  BIGINT NOT NULL REFERENCES product(id),
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(10, 2) NOT NULL
);

-- Index naming: idx_{table}_{columns}
CREATE INDEX idx_order_item_order_id ON order_item(order_id);

-- Constraint naming: {type}_{table}_{columns}
-- pk_user_account, uq_user_account_email, fk_order_item_order_id, ck_order_item_quantity
```

### Configuration and Environment Variables

```bash
# ❌ BAD: Inconsistent, vague
db=postgres://...
API_key=abc
serverPort=8080

# ✅ GOOD: SCREAMING_SNAKE, prefixed by service/concern
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
DATABASE_MAX_CONNECTIONS=20
REDIS_URL=redis://localhost:6379
API_KEY=sk_live_abc123
API_BASE_URL=https://api.example.com
SERVER_PORT=8080
SERVER_HOST=0.0.0.0
LOG_LEVEL=info
LOG_FORMAT=json

# Dotenv structure — group by concern
# .env.example (committed to repo — no secrets)
DATABASE_URL=
REDIS_URL=
API_KEY=
```

### Cross-Language Comparison Table

| Concept            | TypeScript          | Python              | Go                  | Rust                |
|-------------------|---------------------|----------------------|---------------------|---------------------|
| Variable          | `camelCase`         | `snake_case`         | `camelCase`         | `snake_case`        |
| Function          | `camelCase`         | `snake_case`         | `PascalCase` (exported) / `camelCase` (unexported) | `snake_case` |
| Class / Struct    | `PascalCase`        | `PascalCase`         | `PascalCase`        | `PascalCase`        |
| Interface         | `PascalCase`        | `PascalCase`         | `PascalCase` (er suffix) | `PascalCase`  |
| Constant          | `UPPER_SNAKE`       | `UPPER_SNAKE`        | `PascalCase`        | `UPPER_SNAKE`       |
| Enum variant      | `PascalCase`        | `UPPER_SNAKE`        | N/A (use const)     | `PascalCase`        |
| File              | `kebab-case.ts`     | `snake_case.py`      | `snake_case.go`     | `snake_case.rs`     |
| Package / Module  | `kebab-case`        | `snake_case`         | `lowercase`         | `snake_case`        |
| Type parameter    | `T`, `K`, `V`       | `T`, `K`, `V`        | `T`, `K`, `V`       | `T`, `K`, `V`       |
| Private / unexported | `#field` or `_prefix` | `_prefix` (convention) | `lowercase` first letter | `pub` absence |
| Boolean variable  | `isActive`          | `is_active`          | `isActive`          | `is_active`         |
| Test function     | `describe/it`       | `test_` prefix       | `Test` prefix       | `#[test]` attribute |

---

## Best Practices

| #  | Practice                                                                 |
|----|--------------------------------------------------------------------------|
| 1  | Name things for what they represent, not how they are implemented        |
| 2  | Use boolean prefixes (`is`, `has`, `can`, `should`) without exception    |
| 3  | Name collections as plural nouns; maps as `keyToValue` or `keyByValue`   |
| 4  | Functions: verb + noun — the verb reveals the action, the noun reveals the target |
| 5  | Keep names proportional to scope — short in small scopes, descriptive in large |
| 6  | Follow the language's established conventions (don't write Java-style Go) |
| 7  | Avoid "Manager", "Handler", "Processor", "Data", "Info" — too vague     |
| 8  | Name files by domain concept, not by technical role (`user.ts` not `model.ts`) |
| 9  | Use consistent REST naming: plural nouns, max 2 levels of nesting        |
| 10 | Database: `snake_case`, singular table names, `entity_id` for foreign keys |

---

## Anti-Patterns

| #  | Anti-Pattern                     | Problem                                       | Fix                                      |
|----|----------------------------------|-----------------------------------------------|------------------------------------------|
| 1  | Single-letter variables in wide scope | Unreadable 50 lines later                  | Use descriptive names; single letters only in 1-5 line scopes |
| 2  | Type-encoding in names (`strName`, `arrItems`) | Redundant — the type system already knows | Drop the prefix; let the type system work |
| 3  | Negated booleans (`isNotVisible`)| Double negatives: `if (!isNotVisible)` is confusing | Use positive: `isVisible`           |
| 4  | Inconsistent verb tense          | `fetchUser` vs `usersLoaded` vs `getOrder`     | Pick one pattern per project and enforce |
| 5  | Abbreviations (`usr`, `btn`, `cfg`) | Not everyone shares your abbreviation dictionary | Spell it out: `user`, `button`, `config` |
| 6  | Hungarian notation (`iCount`, `sName`) | Obsolete; modern IDEs show types inline   | Drop type prefixes entirely              |
| 7  | Generic names (`data`, `result`, `temp`, `item`) | Meaningless without context         | Qualify: `userData`, `validationResult`, `tempFile` |
| 8  | Plural table names (`users`, `orders`) | Inconsistent with SQL grammar (`FROM users WHERE user.id`) | Use singular: `user_account`, `purchase_order` |

---

## Enforcement Checklist

- [ ] ESLint / Ruff naming convention rules enabled and enforced in CI
- [ ] Code review checklist includes "Are names self-documenting?"
- [ ] Boolean variables and functions use `is`/`has`/`can`/`should` prefix
- [ ] No single-letter variables outside of loop iterators (max 5 lines scope)
- [ ] REST APIs use plural nouns with max 2 nesting levels
- [ ] Database tables use `snake_case` with singular names and `entity_id` foreign keys
- [ ] Environment variables use `SCREAMING_SNAKE_CASE` with service prefix
- [ ] File naming follows language convention (kebab-case TS, snake_case Python/Go)
- [ ] No abbreviations — spell out every name unless universally understood (`id`, `url`, `http`)
- [ ] Cross-language comparison table shared with the team and referenced in onboarding
