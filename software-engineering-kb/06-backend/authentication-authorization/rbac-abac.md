# RBAC & ABAC

> **AI Plugin Directive — Role-Based & Attribute-Based Access Control**
> You are an AI coding assistant. When generating, reviewing, or refactoring authorization code,
> follow EVERY rule in this document. Authorization failures (OWASP A01:2021 — Broken Access Control)
> are the #1 web application vulnerability. Treat each section as a non-negotiable requirement.

**Core Rule: ALWAYS enforce authorization on the server side. NEVER rely on client-side role checks — they are for UX only. ALWAYS check permissions at the resource level, not just the endpoint level. ALWAYS default to DENY — allow access ONLY when explicitly granted.**

---

## 1. Access Control Models

```
┌──────────────────────────────────────────────────────────────┐
│               Access Control Models Spectrum                  │
│                                                               │
│  Simple ◄──────────────────────────────────► Complex         │
│                                                               │
│  ACL         RBAC         ABAC          ReBAC               │
│  (Access     (Role-Based) (Attribute-   (Relationship-       │
│   Control                  Based)        Based)              │
│   Lists)                                                      │
│                                                               │
│  "User X     "Admins can  "Users in EU   "Owner of doc      │
│   can read    delete       during work    can share with     │
│   file Y"     users"       hours can      viewer"            │
│                            access PII"                        │
│                                                               │
│  Use: File   Use: Most    Use: Complex   Use: Social,       │
│  systems     web apps     compliance     collaboration       │
└──────────────────────────────────────────────────────────────┘
```

| Model | Complexity | Flexibility | Auditability | Best For |
|-------|-----------|-------------|--------------|----------|
| **ACL** | Low | Low | Low | File systems, simple resources |
| **RBAC** | Medium | Medium | High | Most web applications |
| **ABAC** | High | Highest | Medium | Compliance, dynamic policies |
| **ReBAC** | High | High | High | Social networks, collaboration tools |

ALWAYS start with RBAC. Add ABAC policies ONLY when RBAC cannot express the required access control logic.

---

## 2. RBAC (Role-Based Access Control)

### 2.1 Core Concepts

```
┌──────────────────────────────────────────────────────────────┐
│                    RBAC Architecture                          │
│                                                               │
│  ┌────────┐    ┌────────────┐    ┌──────────────┐            │
│  │  User  │───►│   Roles    │───►│ Permissions  │            │
│  └────────┘    └────────────┘    └──────────────┘            │
│                                                               │
│  User: alice                                                  │
│    └── Roles: [editor, viewer]                                │
│         ├── editor:                                           │
│         │   ├── articles:create                               │
│         │   ├── articles:update                               │
│         │   └── articles:delete (own)                         │
│         └── viewer:                                           │
│             └── articles:read                                 │
│                                                               │
│  Permission Format: resource:action[:scope]                   │
│  Examples:                                                    │
│    articles:read          ← Read any article                 │
│    articles:update:own    ← Update own articles only         │
│    users:delete:any       ← Delete any user (admin)          │
│    billing:manage         ← Full billing access              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Database Schema

```sql
-- Users (authentication)
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Roles
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL, -- "admin", "editor", "viewer"
    description TEXT,
    is_system   BOOLEAN DEFAULT FALSE,        -- System roles can't be deleted
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource    VARCHAR(100) NOT NULL,  -- "articles", "users", "billing"
    action      VARCHAR(50) NOT NULL,   -- "create", "read", "update", "delete"
    scope       VARCHAR(50) DEFAULT 'any', -- "own", "team", "any"
    description TEXT,
    UNIQUE(resource, action, scope)
);

-- Role ↔ Permission (many-to-many)
CREATE TABLE role_permissions (
    role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User ↔ Role (many-to-many)
CREATE TABLE user_roles (
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID REFERENCES roles(id) ON DELETE CASCADE,
    granted_by  UUID REFERENCES users(id),
    granted_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);
```

### 2.3 Permission Checking

**TypeScript**
```typescript
interface Permission {
  resource: string;
  action: string;
  scope: "own" | "team" | "any";
}

class RBACService {
  // Cache permissions per user (invalidate on role change)
  private cache = new Map<string, Permission[]>();

  async getUserPermissions(userId: string): Promise<Permission[]> {
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    const permissions = await db.query<Permission>(`
      SELECT DISTINCT p.resource, p.action, p.scope
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = $1
    `, [userId]);

    this.cache.set(userId, permissions);
    return permissions;
  }

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    resourceOwnerId?: string
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);

    return permissions.some((p) => {
      if (p.resource !== resource || p.action !== action) return false;

      // Scope check
      if (p.scope === "any") return true;
      if (p.scope === "own" && resourceOwnerId === userId) return true;

      return false;
    });
  }

  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }
}

// Middleware factory
function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.sub;

    // For "own" scope, we need the resource owner
    const resourceOwnerId = req.params.userId || undefined;

    const allowed = await rbac.hasPermission(
      userId, resource, action, resourceOwnerId
    );

    if (!allowed) {
      return res.status(403).json({
        error: "forbidden",
        message: "You do not have permission to perform this action",
      });
    }

    next();
  };
}

// Usage
app.get("/api/articles", requirePermission("articles", "read"), listArticles);
app.post("/api/articles", requirePermission("articles", "create"), createArticle);
app.put("/api/articles/:id", requirePermission("articles", "update"), updateArticle);
app.delete("/api/articles/:id", requirePermission("articles", "delete"), deleteArticle);
```

**Go**
```go
type RBACService struct {
    db    *sql.DB
    cache *sync.Map // userId → []Permission
}

type Permission struct {
    Resource string
    Action   string
    Scope    string // "own", "team", "any"
}

func (s *RBACService) HasPermission(
    ctx context.Context,
    userID, resource, action, resourceOwnerID string,
) (bool, error) {
    perms, err := s.getUserPermissions(ctx, userID)
    if err != nil {
        return false, err
    }

    for _, p := range perms {
        if p.Resource != resource || p.Action != action {
            continue
        }
        if p.Scope == "any" {
            return true, nil
        }
        if p.Scope == "own" && resourceOwnerID == userID {
            return true, nil
        }
    }

    return false, nil // Default DENY
}

// Middleware
func RequirePermission(rbac *RBACService, resource, action string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID := r.Context().Value(userContextKey).(*Claims).Subject
            resourceOwnerID := chi.URLParam(r, "userId")

            allowed, err := rbac.HasPermission(r.Context(), userID, resource, action, resourceOwnerID)
            if err != nil || !allowed {
                writeError(w, http.StatusForbidden, "insufficient_permissions")
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

### 2.4 Role Hierarchy

```
┌─────────────────────────────────────────────────────┐
│                  Role Hierarchy                      │
│                                                      │
│  super_admin                                         │
│  ├── All permissions                                 │
│  ├── Manage roles and permissions                    │
│  └── Access all tenants                              │
│                                                      │
│  admin                                               │
│  ├── Inherits all from: editor                       │
│  ├── users:create, users:update, users:delete        │
│  ├── roles:assign                                    │
│  └── billing:manage                                  │
│                                                      │
│  editor                                              │
│  ├── Inherits all from: viewer                       │
│  ├── articles:create                                 │
│  ├── articles:update:own                             │
│  └── articles:delete:own                             │
│                                                      │
│  viewer (base role)                                  │
│  ├── articles:read                                   │
│  ├── comments:read                                   │
│  └── profile:read:own                                │
└─────────────────────────────────────────────────────┘
```

```typescript
// Role hierarchy implementation
const ROLE_HIERARCHY: Record<string, string[]> = {
  super_admin: ["admin"],
  admin: ["editor"],
  editor: ["viewer"],
  viewer: [],
};

function getEffectiveRoles(role: string): string[] {
  const roles = [role];
  const inherited = ROLE_HIERARCHY[role] ?? [];

  for (const parent of inherited) {
    roles.push(...getEffectiveRoles(parent));
  }

  return [...new Set(roles)];
}

// getEffectiveRoles("admin") → ["admin", "editor", "viewer"]
```

- ALWAYS implement role hierarchy to avoid permission duplication
- ALWAYS use the principle of least privilege — assign the lowest role that provides needed access
- NEVER hardcode role names in application logic — use permission checks instead
- ALWAYS allow roles to be customized per organization in multi-tenant systems

---

## 3. ABAC (Attribute-Based Access Control)

### 3.1 Core Concepts

ABAC evaluates access based on attributes of the subject, resource, action, and environment:

```
┌──────────────────────────────────────────────────────────────┐
│                    ABAC Decision Engine                        │
│                                                               │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │   Subject     │  │   Resource    │  │   Environment    │  │
│  │   Attributes  │  │   Attributes  │  │   Attributes     │  │
│  ├──────────────┤  ├───────────────┤  ├──────────────────┤  │
│  │ userId       │  │ ownerId      │  │ time            │  │
│  │ department   │  │ classification│  │ ip_address      │  │
│  │ clearance    │  │ sensitivity  │  │ location        │  │
│  │ role         │  │ department   │  │ device_type     │  │
│  │ org_id       │  │ created_at   │  │ risk_score      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │              │
│         └─────────┬───────┘                    │              │
│                   │                            │              │
│         ┌─────────▼────────────────────────────▼──────┐      │
│         │              Policy Engine                   │      │
│         │                                              │      │
│         │  IF subject.clearance >= resource.sensitivity │      │
│         │  AND subject.department == resource.department│      │
│         │  AND environment.time IN work_hours           │      │
│         │  AND environment.location IN allowed_countries│      │
│         │  THEN → ALLOW                                │      │
│         │  ELSE → DENY                                 │      │
│         └──────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Policy Definition

**TypeScript**
```typescript
interface ABACContext {
  subject: {
    userId: string;
    roles: string[];
    department: string;
    clearanceLevel: number;
    orgId: string;
  };
  resource: {
    id: string;
    type: string;
    ownerId: string;
    department: string;
    sensitivity: number;
    classification: "public" | "internal" | "confidential" | "restricted";
  };
  action: string;
  environment: {
    timestamp: Date;
    ipAddress: string;
    country: string;
    deviceTrust: "managed" | "unmanaged";
    riskScore: number;
  };
}

type PolicyResult = "allow" | "deny";

interface Policy {
  name: string;
  description: string;
  evaluate: (ctx: ABACContext) => PolicyResult | null;
  // null = policy does not apply (skip)
}

// Policy definitions
const policies: Policy[] = [
  {
    name: "data-classification",
    description: "Users can only access data at or below their clearance level",
    evaluate: (ctx) => {
      const sensitivityMap = { public: 0, internal: 1, confidential: 2, restricted: 3 };
      const required = sensitivityMap[ctx.resource.classification];
      return ctx.subject.clearanceLevel >= required ? "allow" : "deny";
    },
  },
  {
    name: "department-isolation",
    description: "Users can only access resources in their own department",
    evaluate: (ctx) => {
      if (ctx.resource.classification === "public") return null; // Skip for public
      return ctx.subject.department === ctx.resource.department ? "allow" : "deny";
    },
  },
  {
    name: "work-hours",
    description: "Confidential data only accessible during work hours",
    evaluate: (ctx) => {
      if (ctx.resource.classification !== "confidential" &&
          ctx.resource.classification !== "restricted") {
        return null; // Skip for non-sensitive
      }
      const hour = ctx.environment.timestamp.getHours();
      return hour >= 8 && hour < 18 ? "allow" : "deny";
    },
  },
  {
    name: "geo-restriction",
    description: "Restricted data only from allowed countries",
    evaluate: (ctx) => {
      if (ctx.resource.classification !== "restricted") return null;
      const allowedCountries = ["US", "CA", "GB", "DE"];
      return allowedCountries.includes(ctx.environment.country) ? "allow" : "deny";
    },
  },
  {
    name: "device-trust",
    description: "Confidential data requires managed device",
    evaluate: (ctx) => {
      if (ctx.resource.sensitivity < 2) return null;
      return ctx.environment.deviceTrust === "managed" ? "allow" : "deny";
    },
  },
  {
    name: "risk-based",
    description: "High-risk sessions blocked from sensitive resources",
    evaluate: (ctx) => {
      if (ctx.environment.riskScore > 80 && ctx.resource.sensitivity >= 2) {
        return "deny";
      }
      return null;
    },
  },
];
```

### 3.3 Policy Evaluation Engine

```typescript
class PolicyEngine {
  constructor(private policies: Policy[]) {}

  evaluate(ctx: ABACContext): {
    decision: PolicyResult;
    appliedPolicies: string[];
    deniedBy?: string;
  } {
    const appliedPolicies: string[] = [];

    for (const policy of this.policies) {
      const result = policy.evaluate(ctx);

      if (result === null) continue; // Policy does not apply

      appliedPolicies.push(policy.name);

      // DENY takes precedence — if ANY policy denies, result is DENY
      if (result === "deny") {
        return {
          decision: "deny",
          appliedPolicies,
          deniedBy: policy.name,
        };
      }
    }

    // If no policy explicitly allowed, default to DENY
    if (appliedPolicies.length === 0) {
      return { decision: "deny", appliedPolicies: [] };
    }

    return { decision: "allow", appliedPolicies };
  }
}

// Middleware
function requireABAC(resourceType: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resource = await loadResource(resourceType, req.params.id);

    const ctx: ABACContext = {
      subject: {
        userId: req.user.sub,
        roles: req.user.roles,
        department: req.user.department,
        clearanceLevel: req.user.clearanceLevel,
        orgId: req.user.orgId,
      },
      resource: {
        id: resource.id,
        type: resourceType,
        ownerId: resource.ownerId,
        department: resource.department,
        sensitivity: resource.sensitivity,
        classification: resource.classification,
      },
      action,
      environment: {
        timestamp: new Date(),
        ipAddress: req.ip,
        country: await geolocateCountry(req.ip),
        deviceTrust: req.headers["x-device-trust"] as any || "unmanaged",
        riskScore: req.riskScore || 0,
      },
    };

    const result = policyEngine.evaluate(ctx);

    if (result.decision === "deny") {
      await auditLog.record({
        event: "access_denied",
        userId: req.user.sub,
        resource: `${resourceType}:${resource.id}`,
        action,
        deniedBy: result.deniedBy,
      });

      return res.status(403).json({
        error: "access_denied",
        message: "Access denied by policy",
      });
    }

    next();
  };
}
```

---

## 4. RBAC vs ABAC Decision

```
┌──────────────────────────────────────────────────────────────┐
│              When to Use RBAC vs ABAC                         │
│                                                               │
│  START                                                        │
│    │                                                          │
│    ▼                                                          │
│  Do access rules depend ONLY                                 │
│  on user roles?                                               │
│    │         │                                                │
│   YES        NO                                               │
│    │         │                                                │
│    ▼         ▼                                                │
│  Use       Do rules depend on                                │
│  RBAC      resource attributes                                │
│            (classification,                                   │
│            department, owner)?                                │
│              │         │                                      │
│             YES        NO                                     │
│              │         │                                      │
│              ▼         ▼                                      │
│           Do rules    Do rules depend                         │
│           depend on   on environment                          │
│           time, IP,   (time, location)?                       │
│           location?     │         │                           │
│             │          YES        NO                          │
│            YES          │         │                           │
│             │           ▼         ▼                           │
│             └──► Use ABAC    Use RBAC                        │
│                              (sufficient)                     │
└──────────────────────────────────────────────────────────────┘
```

| Use RBAC When | Use ABAC When |
|--------------|---------------|
| Access based on user role | Access depends on resource attributes |
| Simple permission model | Dynamic policies (time, location, risk) |
| Small number of roles (< 20) | Data classification requirements |
| No regulatory compliance needs | GDPR, HIPAA, SOC 2 compliance |
| Start of a project | Complex multi-tenant authorization |
| Standard CRUD operations | Need context-aware access decisions |

ALWAYS start with RBAC. Add ABAC policies incrementally when RBAC is insufficient. Use RBAC + ABAC together — RBAC for coarse-grained access, ABAC for fine-grained policies.

---

## 5. Permission Design Patterns

### 5.1 Resource-Action-Scope Pattern

```
Format: resource:action:scope

Examples:
  articles:read:any      ← Read any article
  articles:update:own    ← Update own articles
  articles:delete:team   ← Delete team articles
  users:manage:any       ← Full user management
  billing:view:org       ← View org billing
```

### 5.2 Wildcard Permissions

```typescript
function matchPermission(
  required: string,
  granted: string[]
): boolean {
  for (const perm of granted) {
    // Exact match
    if (perm === required) return true;

    // Wildcard: "articles:*" matches "articles:read", "articles:delete"
    const [gResource, gAction, gScope] = perm.split(":");
    const [rResource, rAction, rScope] = required.split(":");

    if (gResource === "*" || gResource === rResource) {
      if (!gAction || gAction === "*" || gAction === rAction) {
        if (!gScope || gScope === "*" || gScope === rScope) {
          return true;
        }
      }
    }
  }

  return false;
}

// matchPermission("articles:read:any", ["articles:*:any"]) → true
// matchPermission("articles:delete:any", ["*:*:*"]) → true (super admin)
```

### 5.3 Field-Level Permissions

```typescript
interface FieldPermission {
  field: string;
  read: boolean;
  write: boolean;
}

function filterResponseFields<T>(
  data: T,
  userPermissions: FieldPermission[]
): Partial<T> {
  const filtered: Partial<T> = {};

  for (const perm of userPermissions) {
    if (perm.read && perm.field in (data as any)) {
      (filtered as any)[perm.field] = (data as any)[perm.field];
    }
  }

  return filtered;
}

// Admin sees: { id, email, name, salary, ssn }
// Manager sees: { id, email, name, salary }
// Employee sees: { id, email, name }
```

---

## 6. Authorization Patterns

### 6.1 Pre-Authorization (Middleware)

Check permissions BEFORE executing the handler:

```typescript
// Route-level authorization
app.delete(
  "/api/articles/:id",
  requireAuth(),
  requirePermission("articles", "delete"),
  deleteArticle
);
```

### 6.2 Post-Authorization (Data Filtering)

Filter results AFTER querying based on permissions:

```typescript
async function listArticles(req: Request, res: Response) {
  const userId = req.user.sub;
  const permissions = await rbac.getUserPermissions(userId);

  let query = db.articles.select();

  // If user can only read "own" articles
  if (!permissions.some((p) => p.resource === "articles" && p.scope === "any")) {
    query = query.where("author_id", userId);
  }

  const articles = await query.execute();
  res.json({ articles });
}
```

### 6.3 Resource-Level Authorization

Check permissions against the SPECIFIC resource being accessed:

```typescript
async function updateArticle(req: Request, res: Response) {
  const article = await db.articles.findById(req.params.id);

  if (!article) {
    return res.status(404).json({ error: "Not found" });
  }

  // Check if user can update THIS specific article
  const allowed = await rbac.hasPermission(
    req.user.sub,
    "articles",
    "update",
    article.authorId // Resource owner ID for scope check
  );

  if (!allowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Proceed with update...
}
```

ALWAYS perform resource-level authorization. Endpoint-level authorization is NOT sufficient — a user may have `articles:update:own` but should NOT be able to update other users' articles.

---

## 7. Admin & Super Admin Patterns

```typescript
// Super admin bypass — use with extreme caution
function isSuperAdmin(user: AuthenticatedUser): boolean {
  return user.roles.includes("super_admin");
}

// ALWAYS audit super admin actions
async function superAdminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (isSuperAdmin(req.user)) {
    await auditLog.record({
      event: "super_admin_access",
      userId: req.user.sub,
      resource: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }
  next();
}

// NEVER allow super admin role to be self-assigned
async function assignRole(
  assignerId: string,
  targetUserId: string,
  roleId: string
) {
  const role = await db.roles.findById(roleId);

  // Prevent privilege escalation
  if (role.name === "super_admin") {
    const assigner = await db.users.findById(assignerId);
    if (!assigner.roles.includes("super_admin")) {
      throw new Error("Only super admins can assign super admin role");
    }
  }

  // Prevent self-assignment of elevated roles
  if (assignerId === targetUserId && role.name === "super_admin") {
    throw new Error("Cannot self-assign super admin role");
  }

  await db.userRoles.create({ userId: targetUserId, roleId, grantedBy: assignerId });

  // Invalidate permission cache
  rbac.invalidateCache(targetUserId);
}
```

- ALWAYS log every action performed by super admin accounts
- NEVER allow self-assignment of admin or super admin roles
- ALWAYS require two-person approval for super admin role assignment
- ALWAYS implement "break glass" procedures for emergency access
- ALWAYS review super admin access logs regularly

---

## 8. Permission Caching

```typescript
class PermissionCache {
  private redis: Redis;
  private ttl = 300; // 5 minutes

  async getPermissions(userId: string): Promise<Permission[] | null> {
    const cached = await this.redis.get(`perms:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async setPermissions(userId: string, perms: Permission[]): Promise<void> {
    await this.redis.setex(`perms:${userId}`, this.ttl, JSON.stringify(perms));
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(`perms:${userId}`);
  }

  async invalidateAll(): Promise<void> {
    // When roles or permissions are modified
    const keys = await this.redis.keys("perms:*");
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

- ALWAYS cache permission lookups (5-15 minute TTL)
- ALWAYS invalidate cache when roles or permissions change
- ALWAYS invalidate ALL caches when a role's permissions are modified
- ALWAYS invalidate a user's cache when their roles are modified
- NEVER cache for longer than 15 minutes — stale permissions are a security risk

---

## 9. Audit Trail

ALWAYS maintain a comprehensive audit trail for authorization events:

```sql
CREATE TABLE authorization_audit (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    action      VARCHAR(100) NOT NULL,
    resource    VARCHAR(200) NOT NULL,
    result      VARCHAR(10) NOT NULL, -- "allowed", "denied"
    policy_name VARCHAR(100),         -- Which policy made the decision
    ip_address  INET,
    user_agent  TEXT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user audit queries
CREATE INDEX idx_auth_audit_user ON authorization_audit (user_id, created_at DESC);
-- Index for denied access investigation
CREATE INDEX idx_auth_audit_denied ON authorization_audit (result, created_at DESC)
  WHERE result = 'denied';
```

```typescript
// Audit every authorization decision
async function auditAuthorizationDecision(
  userId: string,
  action: string,
  resource: string,
  result: "allowed" | "denied",
  policyName?: string,
  req?: Request
): Promise<void> {
  await db.authorizationAudit.create({
    userId,
    action,
    resource,
    result,
    policyName,
    ipAddress: req?.ip,
    userAgent: req?.headers["user-agent"],
    metadata: {
      roles: req?.user?.roles,
      timestamp: new Date().toISOString(),
    },
  });
}
```

- ALWAYS log BOTH allowed and denied authorization decisions
- ALWAYS include the policy/rule that made the decision
- ALWAYS include IP address, user agent, and timestamp
- ALWAYS retain audit logs for compliance requirements (typically 1-7 years)
- ALWAYS alert on anomalous access patterns (many denied requests)

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Client-side role checks only | Authorization bypassed via API tools | ALWAYS enforce on server side |
| Hardcoded role names in code | `if (user.role === "admin")` scattered everywhere | Use permission checks, not role checks |
| No resource-level checks | User with `articles:update:own` can update any article | Check resource ownership in every handler |
| Default ALLOW | Missing permission treated as allowed | Default to DENY — only allow explicit grants |
| No permission caching | Database query on every request | Cache with 5-15 minute TTL + invalidation |
| Role explosion | 100+ roles with overlapping permissions | Use role hierarchy + ABAC for exceptions |
| No audit trail | Cannot investigate access violations | Log every authorization decision |
| Self-assignable admin | Users can elevate their own privileges | Require separate admin to assign roles |
| No scope on permissions | `articles:delete` means ALL articles | Add scope: `own`, `team`, `any` |
| Mixing AuthN and AuthZ errors | Same error for 401 and 403 | 401 = not authenticated, 403 = not authorized |
| Stale permission cache | Role removed but permissions still cached | Invalidate cache on role change |
| No break-glass procedure | Emergency access requires code change | Implement audited emergency access |

---

## 11. Enforcement Checklist

- [ ] Authorization enforced on EVERY server-side endpoint — NEVER client-only
- [ ] Default DENY — access allowed ONLY with explicit permission grant
- [ ] Resource-level authorization checked (not just endpoint-level)
- [ ] Permission format: `resource:action:scope`
- [ ] Role hierarchy implemented (admin inherits editor, editor inherits viewer)
- [ ] Permissions cached with TTL (5-15 min) and invalidation on change
- [ ] Audit trail logs BOTH allowed and denied decisions
- [ ] No hardcoded role names in application logic — use permissions
- [ ] Super admin actions logged and audited
- [ ] Self-assignment of admin roles prevented
- [ ] Field-level permissions for sensitive data
- [ ] ABAC policies added ONLY when RBAC is insufficient
- [ ] Permission cache invalidated on role/permission changes
- [ ] 401 used for authentication failures, 403 for authorization failures
- [ ] Break-glass emergency access procedure documented and audited
- [ ] Regular access review process (quarterly minimum)
