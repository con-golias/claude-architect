# Multi-Tenancy

> **AI Plugin Directive — Multi-Tenant Authentication & Data Isolation**
> You are an AI coding assistant. When generating, reviewing, or refactoring multi-tenant application
> code, follow EVERY rule in this document. Tenant data leakage is a catastrophic security failure
> that can result in regulatory penalties, lawsuits, and loss of customer trust.
> Treat each numbered section as a non-negotiable production requirement.

**Core Rule: NEVER allow one tenant's data to be accessible by another tenant. ALWAYS enforce tenant isolation at EVERY layer — API, application, and database. ALWAYS include tenant context in EVERY database query. A single missing tenant filter is a data breach.**

---

## 1. Multi-Tenancy Models

```
┌──────────────────────────────────────────────────────────────────┐
│                Multi-Tenancy Isolation Models                     │
│                                                                   │
│  Isolation ◄──────────────────────────────────► Efficiency       │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │ Separate   │  │ Separate   │  │ Shared DB  │  │ Shared     │ │
│  │ Infra      │  │ Database   │  │ Separate   │  │ Everything │ │
│  │ (Silo)     │  │            │  │ Schema     │  │ (Pool)     │ │
│  ├────────────┤  ├────────────┤  ├────────────┤  ├────────────┤ │
│  │ Each tenant│  │ Shared app │  │ Shared DB  │  │ Shared DB  │ │
│  │ gets own   │  │ servers,   │  │ each tenant│  │ shared     │ │
│  │ servers,   │  │ separate   │  │ gets own   │  │ tables,    │ │
│  │ DB, and    │  │ database   │  │ schema     │  │ tenant_id  │ │
│  │ network    │  │ per tenant │  │ (Postgres) │  │ column     │ │
│  ├────────────┤  ├────────────┤  ├────────────┤  ├────────────┤ │
│  │ Isolation: │  │ Isolation: │  │ Isolation: │  │ Isolation: │ │
│  │ HIGHEST    │  │ HIGH       │  │ MEDIUM     │  │ LOWEST     │ │
│  │ Cost: $$$$ │  │ Cost: $$$  │  │ Cost: $$   │  │ Cost: $    │ │
│  │ Scale: Hard│  │ Scale: Med │  │ Scale: Good│  │ Scale: Best│ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

| Model | Isolation | Cost | Scalability | Complexity | Best For |
|-------|-----------|------|-------------|------------|----------|
| **Silo (separate infra)** | Highest | Highest | Per-tenant | Lowest app, highest ops | Regulated industries, large enterprise |
| **Separate database** | High | High | Good | Medium | Healthcare, finance |
| **Separate schema** | Medium | Medium | Good | Medium | Mid-size B2B SaaS |
| **Shared tables (pool)** | Lowest | Lowest | Best | Highest app | Most B2B SaaS products |

ALWAYS start with the shared tables (pool) model for most B2B SaaS. Move to higher isolation ONLY when compliance or customer requirements demand it. The shared model is the most cost-effective and scalable approach.

---

## 2. Tenant Identification

### 2.1 Identification Strategies

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| **Subdomain** | `acme.myapp.com` | Clean UX, easy routing | SSL wildcard cert needed, DNS setup |
| **Path prefix** | `myapp.com/acme/...` | Simple, no DNS | Routing complexity |
| **Custom domain** | `app.acme.com` | Premium feel | Complex SSL, DNS management |
| **Header** | `X-Tenant-ID: acme` | API-friendly | Easy to forge if not validated |
| **JWT claim** | `{ "org_id": "acme" }` | Stateless, secure | Requires token refresh on org switch |

ALWAYS use subdomain-based or JWT-claim-based tenant identification. NEVER rely solely on client-provided headers without validation.

### 2.2 Tenant Resolution Middleware

**TypeScript**
```typescript
interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  plan: "free" | "pro" | "enterprise";
  features: string[];
}

// Tenant resolution cache
const tenantCache = new Map<string, TenantContext>();

async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Strategy 1: From subdomain
  const host = req.hostname; // "acme.myapp.com"
  const slug = host.split(".")[0]; // "acme"

  // Strategy 2: From JWT claim (API)
  // const slug = req.user?.org_id;

  // Strategy 3: From header (internal services)
  // const slug = req.headers["x-tenant-id"];

  if (!slug || slug === "www" || slug === "api") {
    return res.status(400).json({ error: "Tenant not identified" });
  }

  // Resolve tenant (cached)
  let tenant = tenantCache.get(slug);
  if (!tenant) {
    const record = await db.tenants.findBySlug(slug);
    if (!record) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    if (record.status !== "active") {
      return res.status(403).json({ error: "Tenant suspended" });
    }
    tenant = mapToContext(record);
    tenantCache.set(slug, tenant);
  }

  // Attach to request — available throughout request lifecycle
  req.tenant = tenant;

  // Set in async context for deep access (no prop drilling)
  tenantStorage.run(tenant, () => next());
}
```

**Go**
```go
type TenantContext struct {
    TenantID   string
    TenantSlug string
    TenantName string
    Plan       string
    Features   []string
}

type contextKey string
const tenantKey contextKey = "tenant"

func TenantMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        host := r.Host
        parts := strings.Split(host, ".")
        slug := parts[0]

        tenant, err := resolveTenant(r.Context(), slug)
        if err != nil {
            writeError(w, http.StatusNotFound, "tenant_not_found")
            return
        }

        if tenant.Status != "active" {
            writeError(w, http.StatusForbidden, "tenant_suspended")
            return
        }

        ctx := context.WithValue(r.Context(), tenantKey, tenant)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func GetTenant(ctx context.Context) *TenantContext {
    return ctx.Value(tenantKey).(*TenantContext)
}
```

---

## 3. Data Isolation (Shared Tables Model)

### 3.1 Schema Design

ALWAYS include `tenant_id` on EVERY table that contains tenant-specific data:

```sql
-- Tenants table
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(63) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(50) NOT NULL DEFAULT 'free',
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    settings    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Every tenant-scoped table MUST have tenant_id
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        VARCHAR(255) NOT NULL,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    -- ALWAYS include tenant_id in compound indexes
    INDEX idx_projects_tenant (tenant_id, created_at DESC)
);

CREATE TABLE documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    project_id  UUID NOT NULL REFERENCES projects(id),
    title       VARCHAR(255) NOT NULL,
    content     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    INDEX idx_documents_tenant (tenant_id, project_id)
);

-- Users belong to tenants (many-to-many for multi-org users)
CREATE TABLE tenant_memberships (
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    role        VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, user_id)
);
```

### 3.2 Row-Level Security (PostgreSQL)

ALWAYS use RLS as a defense-in-depth layer. RLS prevents data leakage even if application code has bugs:

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see rows matching their tenant
CREATE POLICY tenant_isolation ON projects
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON documents
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Set tenant context per request
-- ALWAYS set this at the beginning of every request
SET app.current_tenant_id = 'tenant-uuid-here';
```

**TypeScript (Prisma + RLS)**
```typescript
import { PrismaClient } from "@prisma/client";

class TenantAwarePrisma {
  constructor(private prisma: PrismaClient) {}

  async withTenant<T>(tenantId: string, fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Set tenant context for RLS
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`;
      return fn(tx as any);
    });
  }
}

// Usage
const tenantPrisma = new TenantAwarePrisma(prisma);

app.get("/api/projects", async (req, res) => {
  const projects = await tenantPrisma.withTenant(req.tenant.tenantId, (tx) =>
    tx.projects.findMany({
      // RLS automatically filters by tenant — but ALWAYS add explicit filter too
      where: { tenantId: req.tenant.tenantId },
      orderBy: { createdAt: "desc" },
    })
  );
  res.json({ projects });
});
```

**Go (pgx + RLS)**
```go
func (r *ProjectRepo) ListByTenant(ctx context.Context, tenantID string) ([]Project, error) {
    tx, err := r.pool.Begin(ctx)
    if err != nil {
        return nil, err
    }
    defer tx.Rollback(ctx)

    // Set RLS context
    _, err = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, TRUE)", tenantID)
    if err != nil {
        return nil, err
    }

    // Query with EXPLICIT tenant filter (defense in depth)
    rows, err := tx.Query(ctx,
        "SELECT id, name, created_at FROM projects WHERE tenant_id = $1 ORDER BY created_at DESC",
        tenantID,
    )
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var projects []Project
    for rows.Next() {
        var p Project
        if err := rows.Scan(&p.ID, &p.Name, &p.CreatedAt); err != nil {
            return nil, err
        }
        projects = append(projects, p)
    }

    return projects, tx.Commit(ctx)
}
```

### 3.3 Critical Data Isolation Rules

- ALWAYS include `tenant_id` in EVERY tenant-scoped table
- ALWAYS include `tenant_id` in EVERY `WHERE` clause for tenant-scoped queries
- ALWAYS enable PostgreSQL RLS as defense-in-depth (even with application-level filtering)
- ALWAYS include `tenant_id` in all compound indexes
- ALWAYS validate that the authenticated user belongs to the requested tenant
- NEVER use global queries without explicit tenant filtering on tenant-scoped data
- NEVER trust tenant_id from client input — derive it from the authenticated session

---

## 4. Tenant-Aware Authentication

```
┌──────────────────────────────────────────────────────────────────┐
│            Tenant-Aware Authentication Flow                       │
│                                                                   │
│  1. User navigates to acme.myapp.com                             │
│                    │                                              │
│  2. Tenant resolved from subdomain → tenant_id = "acme-uuid"    │
│                    │                                              │
│  3. User logs in with credentials                                │
│                    │                                              │
│  4. Server verifies:                                             │
│     ├── Credentials valid                                        │
│     ├── User is member of tenant "acme"                          │
│     └── User is active in this tenant                            │
│                    │                                              │
│  5. JWT issued with tenant context:                              │
│     {                                                             │
│       "sub": "user-123",                                         │
│       "org_id": "acme-uuid",                                    │
│       "org_role": "admin",                                       │
│       "permissions": ["projects:read", "projects:write"]        │
│     }                                                             │
│                    │                                              │
│  6. Every API request:                                            │
│     ├── Verify JWT                                               │
│     ├── Extract org_id from JWT                                  │
│     ├── Validate org_id matches subdomain tenant                 │
│     └── Set tenant context for database queries                  │
└──────────────────────────────────────────────────────────────────┘
```

```typescript
// Multi-org user: issue token scoped to specific tenant
async function loginToTenant(
  userId: string,
  tenantId: string
): Promise<string> {
  // Verify membership
  const membership = await db.tenantMemberships.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  if (!membership) {
    throw new Error("User is not a member of this organization");
  }

  // Get tenant-specific permissions
  const permissions = await rbac.getTenantPermissions(userId, tenantId);

  return issueAccessToken({
    sub: userId,
    org_id: tenantId,
    org_role: membership.role,
    permissions,
  });
}

// Middleware: validate tenant from JWT matches request tenant
async function validateTenantAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const jwtTenantId = req.user.org_id;
  const requestTenantId = req.tenant.tenantId;

  if (jwtTenantId !== requestTenantId) {
    return res.status(403).json({
      error: "tenant_mismatch",
      message: "Token not valid for this organization",
    });
  }

  next();
}
```

---

## 5. Tenant Management

### 5.1 Tenant Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                  Tenant Lifecycle States                       │
│                                                               │
│  ┌──────────┐    ┌─────────┐    ┌───────────┐               │
│  │ Creating │───►│ Active  │───►│ Suspended │               │
│  └──────────┘    └─────────┘    └───────────┘               │
│       │              │    ▲          │                        │
│       │              │    └──────────┘                        │
│       │              │    (reactivate)                        │
│       │              │                                        │
│       │              ▼                                        │
│       │         ┌──────────┐    ┌──────────┐                 │
│       │         │ Deleting │───►│ Deleted  │                 │
│       │         └──────────┘    └──────────┘                 │
│       │              ▲                                        │
│       └──────────────┘ (failed setup)                        │
│                                                               │
│  Creating:   Provisioning resources                          │
│  Active:     Normal operation                                │
│  Suspended:  Payment failed, policy violation                │
│  Deleting:   Data being purged (30-day retention)            │
│  Deleted:    All data removed                                │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Tenant Provisioning

```typescript
async function provisionTenant(data: {
  name: string;
  slug: string;
  ownerEmail: string;
  plan: string;
}): Promise<Tenant> {
  // 1. Validate slug uniqueness and format
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(data.slug)) {
    throw new Error("Invalid tenant slug format");
  }

  const existing = await db.tenants.findBySlug(data.slug);
  if (existing) {
    throw new Error("Tenant slug already taken");
  }

  // 2. Create tenant record
  const tenant = await db.tenants.create({
    slug: data.slug,
    name: data.name,
    plan: data.plan,
    status: "creating",
  });

  // 3. Create owner membership
  const owner = await db.users.findByEmail(data.ownerEmail);
  await db.tenantMemberships.create({
    tenantId: tenant.id,
    userId: owner.id,
    role: "owner",
  });

  // 4. Provision tenant-specific resources
  await provisionResources(tenant.id, data.plan);

  // 5. Activate tenant
  await db.tenants.update(tenant.id, { status: "active" });

  return tenant;
}
```

### 5.3 Tenant Deletion

ALWAYS implement soft-delete with a retention period:

```typescript
async function deleteTenant(tenantId: string): Promise<void> {
  // 1. Mark as deleting
  await db.tenants.update(tenantId, { status: "deleting" });

  // 2. Revoke all active sessions
  await sessionStore.destroyAllForTenant(tenantId);

  // 3. Disable all API keys
  await db.apiKeys.updateMany(
    { tenantId },
    { revokedAt: new Date(), revokeReason: "tenant_deleted" }
  );

  // 4. Schedule data deletion (30-day retention for recovery)
  await queue.enqueue("tenant.delete_data", {
    tenantId,
    scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // 5. Notify affected users
  const members = await db.tenantMemberships.findMany({ tenantId });
  for (const member of members) {
    await notifyUser(member.userId, "tenant_deleted", { tenantId });
  }
}
```

---

## 6. Tenant Feature Flags & Plan Limits

```typescript
interface TenantPlan {
  name: string;
  limits: {
    maxUsers: number;
    maxProjects: number;
    maxStorageGB: number;
    maxAPICallsPerMonth: number;
  };
  features: {
    sso: boolean;
    auditLog: boolean;
    customDomain: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
}

const PLANS: Record<string, TenantPlan> = {
  free: {
    name: "Free",
    limits: { maxUsers: 5, maxProjects: 3, maxStorageGB: 1, maxAPICallsPerMonth: 10_000 },
    features: { sso: false, auditLog: false, customDomain: false, advancedAnalytics: false, prioritySupport: false },
  },
  pro: {
    name: "Pro",
    limits: { maxUsers: 50, maxProjects: 50, maxStorageGB: 100, maxAPICallsPerMonth: 1_000_000 },
    features: { sso: false, auditLog: true, customDomain: true, advancedAnalytics: true, prioritySupport: false },
  },
  enterprise: {
    name: "Enterprise",
    limits: { maxUsers: Infinity, maxProjects: Infinity, maxStorageGB: Infinity, maxAPICallsPerMonth: Infinity },
    features: { sso: true, auditLog: true, customDomain: true, advancedAnalytics: true, prioritySupport: true },
  },
};

// Middleware: enforce plan limits
function enforcePlanLimit(limitKey: keyof TenantPlan["limits"]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenant = req.tenant;
    const plan = PLANS[tenant.plan];
    const limit = plan.limits[limitKey];

    const currentUsage = await getUsage(tenant.tenantId, limitKey);

    if (currentUsage >= limit) {
      return res.status(402).json({
        error: "plan_limit_exceeded",
        message: `You have reached the ${limitKey} limit for your plan`,
        limit,
        current: currentUsage,
        upgradeUrl: `/billing/upgrade`,
      });
    }

    next();
  };
}

// Feature gate middleware
function requireFeature(feature: keyof TenantPlan["features"]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const plan = PLANS[req.tenant.plan];

    if (!plan.features[feature]) {
      return res.status(402).json({
        error: "feature_not_available",
        message: `${feature} is not available on your current plan`,
        requiredPlan: getMinimumPlan(feature),
      });
    }

    next();
  };
}

// Usage
app.post("/api/users/invite", requireFeature("sso"), enforcePlanLimit("maxUsers"), inviteUser);
```

---

## 7. Cross-Tenant Operations

### 7.1 Super Admin Access

```typescript
// Super admin can access any tenant — ALWAYS audit
async function superAdminTenantAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user.roles.includes("super_admin")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const targetTenantId = req.headers["x-admin-tenant-id"] as string;
  if (!targetTenantId) {
    return res.status(400).json({ error: "Missing target tenant" });
  }

  // ALWAYS log super admin cross-tenant access
  await auditLog.record({
    event: "super_admin_tenant_access",
    userId: req.user.sub,
    targetTenantId,
    action: `${req.method} ${req.originalUrl}`,
    ip: req.ip,
    severity: "high",
  });

  // Override tenant context
  const tenant = await resolveTenantById(targetTenantId);
  req.tenant = tenant;

  next();
}
```

### 7.2 Multi-Org Users

```typescript
// User belongs to multiple organizations
async function listUserOrganizations(userId: string): Promise<TenantMembership[]> {
  return db.tenantMemberships.findMany({
    where: { userId },
    include: { tenant: true },
  });
}

// Switch organization — issue new token scoped to selected org
async function switchOrganization(
  req: Request,
  res: Response
) {
  const { organizationId } = req.body;
  const userId = req.user.sub;

  // Verify membership
  const membership = await db.tenantMemberships.findUnique({
    where: { tenantId_userId: { tenantId: organizationId, userId } },
  });

  if (!membership) {
    return res.status(403).json({ error: "Not a member of this organization" });
  }

  // Issue new token scoped to the selected org
  const accessToken = await loginToTenant(userId, organizationId);
  const { token: refreshToken } = await issueRefreshToken(userId);

  res.json({ accessToken });
  setRefreshTokenCookie(res, refreshToken);
}
```

---

## 8. Tenant Data Export & Portability

ALWAYS provide tenants with the ability to export their data (GDPR Article 20):

```typescript
async function exportTenantData(tenantId: string): Promise<string> {
  const tables = [
    "projects", "documents", "users", "comments",
    "files", "settings", "audit_logs",
  ];

  const exportData: Record<string, any[]> = {};

  for (const table of tables) {
    exportData[table] = await db.$queryRaw(
      `SELECT * FROM ${table} WHERE tenant_id = $1`,
      [tenantId]
    );
  }

  // Generate downloadable archive
  const archivePath = await createExportArchive(tenantId, exportData);

  // Notify tenant admin
  await notifyTenantAdmin(tenantId, "data_export_ready", { downloadUrl: archivePath });

  return archivePath;
}
```

- ALWAYS allow tenants to export ALL their data in a standard format (JSON, CSV)
- ALWAYS allow tenants to request complete data deletion
- ALWAYS provide data export within 30 days (GDPR requirement)
- ALWAYS log data export requests for compliance

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Missing `tenant_id` in query | Data from other tenants visible | ALWAYS include `tenant_id` in WHERE clause |
| No RLS (PostgreSQL) | Single code bug leaks all tenant data | Enable RLS as defense-in-depth |
| Trusting client-provided tenant_id | Attacker accesses other tenants | Derive tenant from JWT/session, NEVER from request |
| Global admin without audit | Admin accesses tenants undetected | Log ALL cross-tenant admin access |
| Shared cache without tenant prefix | Cache poisoning across tenants | ALWAYS prefix cache keys with `tenant:{id}:` |
| No plan enforcement | Free tenants use enterprise features | Check plan limits on every operation |
| No tenant in background jobs | Jobs process data without tenant context | ALWAYS pass and set tenant context in workers |
| Hard-coded tenant logic | Special cases for specific tenants | Use feature flags and plan configurations |
| No data export | GDPR violation, vendor lock-in for customers | Provide self-service data export |
| Tenant deletion without retention | Accidental deletion is permanent | 30-day soft delete with recovery option |
| No tenant slug validation | SQL injection, XSS via tenant slug | Validate: `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$` |
| Shared file storage without isolation | Files accessible across tenants | Separate storage paths per tenant |

---

## 10. Enforcement Checklist

- [ ] `tenant_id` column present on EVERY tenant-scoped table
- [ ] `tenant_id` included in EVERY query WHERE clause (no exceptions)
- [ ] PostgreSQL RLS enabled on ALL tenant-scoped tables
- [ ] Tenant resolved from subdomain/JWT — NEVER from client input
- [ ] JWT includes `org_id` claim scoped to authenticated tenant
- [ ] Tenant membership verified before granting access
- [ ] Super admin cross-tenant access logged and audited
- [ ] Cache keys prefixed with `tenant:{id}:` for isolation
- [ ] Background jobs include and enforce tenant context
- [ ] Plan limits enforced on resource creation endpoints
- [ ] Feature flags gated by tenant plan
- [ ] Multi-org users can switch between organizations
- [ ] Tenant data export available (GDPR compliance)
- [ ] Soft-delete with 30-day retention for tenant deletion
- [ ] Tenant slug validated against safe character pattern
- [ ] File storage isolated per tenant (separate paths/buckets)
- [ ] Rate limiting scoped per tenant (not just per IP)
