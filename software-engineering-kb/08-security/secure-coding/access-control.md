# Access Control

> **Domain:** Security > Secure Coding > Access Control
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** --

## Why It Matters

Access control is the single most critical security mechanism in any application. OWASP ranks Broken Access Control as the number one web application security risk (A01:2021). Every data breach, every unauthorized data exposure, and every privilege escalation traces back to access control that was either missing, misconfigured, or bypassed. Authentication answers "who are you?" -- access control answers "what are you allowed to do?" A system with perfect authentication but broken authorization is a system where every authenticated user is an administrator.

This guide covers every access control model, every common vulnerability pattern, and every enforcement technique. It is the definitive reference for building authorization into software correctly.

---

## Authentication vs Authorization

These two concepts are distinct. Conflating them is the root cause of most access control failures.

```
Authentication (AuthN)                    Authorization (AuthZ)
────────────────────────                  ────────────────────────
"Who are you?"                            "What can you do?"
Verifies IDENTITY                         Verifies PERMISSIONS
Runs ONCE at login                        Runs on EVERY request
Produces a token/session                  Consumes the token/session
Examples:                                 Examples:
  - Password + MFA                          - Can this user read this file?
  - OAuth2 / OIDC                           - Can this user delete this record?
  - Certificate-based auth                  - Can this user access this tenant?
  - Passkeys / WebAuthn                     - Can this user promote to admin?

HTTP Status Codes:
  401 Unauthorized = AuthN failure          403 Forbidden = AuthZ failure
  "I do not know who you are"              "I know who you are, but no"
```

**Critical rule:** Authentication is necessary but NOT sufficient. A valid identity token does not imply any particular permission. Every endpoint must perform both authentication AND authorization checks.

```typescript
// WRONG: Authentication only -- any logged-in user can do anything
app.delete("/api/projects/:id", authenticate, async (req, res) => {
  await db.deleteProject(req.params.id);
  res.json({ deleted: true });
});

// RIGHT: Authentication AND authorization on every endpoint
app.delete("/api/projects/:id", authenticate, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });

  // AuthZ: Is THIS user the owner OR an admin?
  if (project.ownerId !== req.user.id && !req.user.hasRole("admin")) {
    audit.log("unauthorized_delete_attempt", { actor: req.user.id, project: project.id });
    return res.status(403).json({ error: "Access denied" });
  }

  await db.deleteProject(req.params.id);
  audit.log("project_deleted", { actor: req.user.id, project: project.id });
  res.json({ deleted: true });
});
```

---

## Access Control Models

### 1. RBAC -- Role-Based Access Control

RBAC assigns permissions to roles, and roles to users. Users inherit permissions through their assigned roles. This is the most widely deployed access control model and is appropriate for most applications.

```
RBAC Architecture:

  Users            Roles              Permissions
  ┌────────┐      ┌─────────────┐    ┌───────────────────────┐
  │ Alice  │─────>│ admin       │───>│ users:create          │
  │        │      │             │───>│ users:read            │
  └────────┘      │             │───>│ users:update          │
                  │             │───>│ users:delete          │
  ┌────────┐      │             │───>│ projects:*            │
  │ Bob    │─────>│ editor      │───>│ articles:create       │
  │        │      │             │───>│ articles:read         │
  └────────┘      │             │───>│ articles:update       │
                  └─────────────┘
  ┌────────┐      ┌─────────────┐    ┌───────────────────────┐
  │ Carol  │─────>│ viewer      │───>│ articles:read         │
  │        │      │             │───>│ projects:read         │
  └────────┘      └─────────────┘    └───────────────────────┘

  Role Hierarchy (optional):
    admin > editor > viewer
    Higher roles inherit all permissions of lower roles
```

**TypeScript -- RBAC implementation:**

```typescript
// Define permissions as string constants for type safety
type Permission =
  | "users:create" | "users:read" | "users:update" | "users:delete"
  | "projects:create" | "projects:read" | "projects:update" | "projects:delete"
  | "articles:create" | "articles:read" | "articles:update" | "articles:delete"
  | "billing:read" | "billing:manage";

type Role = "admin" | "editor" | "viewer" | "billing_admin";

// Permission-role mapping -- single source of truth
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: [
    "articles:read",
    "projects:read",
  ],
  editor: [
    // Inherits viewer permissions
    "articles:read", "projects:read",
    // Plus editor-specific permissions
    "articles:create", "articles:update",
    "projects:create", "projects:update",
  ],
  admin: [
    // All permissions
    "users:create", "users:read", "users:update", "users:delete",
    "projects:create", "projects:read", "projects:update", "projects:delete",
    "articles:create", "articles:read", "articles:update", "articles:delete",
  ],
  billing_admin: [
    "billing:read", "billing:manage",
  ],
} as const;

function hasPermission(userRoles: Role[], required: Permission): boolean {
  return userRoles.some((role) => ROLE_PERMISSIONS[role]?.includes(required));
}

// Middleware factory -- enforce RBAC at the route level
function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!hasPermission(req.user.roles, permission)) {
      audit.log("permission_denied", {
        actor: req.user.id,
        required: permission,
        roles: req.user.roles,
        resource: req.originalUrl,
      });
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

// Usage
app.post("/api/users", authenticate, requirePermission("users:create"), createUserHandler);
app.get("/api/users", authenticate, requirePermission("users:read"), listUsersHandler);
app.delete("/api/users/:id", authenticate, requirePermission("users:delete"), deleteUserHandler);
```

**Go -- RBAC with middleware:**

```go
package authz

type Role string
type Permission string

const (
    RoleAdmin   Role = "admin"
    RoleEditor  Role = "editor"
    RoleViewer  Role = "viewer"
)

var rolePermissions = map[Role][]Permission{
    RoleViewer: {
        "articles:read",
        "projects:read",
    },
    RoleEditor: {
        "articles:read", "projects:read",
        "articles:create", "articles:update",
        "projects:create", "projects:update",
    },
    RoleAdmin: {
        "users:create", "users:read", "users:update", "users:delete",
        "projects:create", "projects:read", "projects:update", "projects:delete",
        "articles:create", "articles:read", "articles:update", "articles:delete",
    },
}

func HasPermission(roles []Role, required Permission) bool {
    for _, role := range roles {
        perms, ok := rolePermissions[role]
        if !ok {
            continue
        }
        for _, p := range perms {
            if p == required {
                return true
            }
        }
    }
    return false
}

// RequirePermission returns middleware that checks for a specific permission
func RequirePermission(perm Permission) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user := UserFromContext(r.Context())
            if user == nil {
                http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
                return
            }

            if !HasPermission(user.Roles, perm) {
                slog.Warn("permission denied",
                    "user_id", user.ID,
                    "required", perm,
                    "roles", user.Roles,
                    "path", r.URL.Path,
                )
                http.Error(w, `{"error":"insufficient permissions"}`, http.StatusForbidden)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}

// Usage
mux.Handle("POST /api/users",
    RequirePermission("users:create")(http.HandlerFunc(createUserHandler)))
mux.Handle("GET /api/users",
    RequirePermission("users:read")(http.HandlerFunc(listUsersHandler)))
```

**Python -- RBAC with decorators:**

```python
from functools import wraps
from flask import request, jsonify, g
from enum import Enum
from typing import Callable

class Permission(str, Enum):
    USERS_CREATE = "users:create"
    USERS_READ = "users:read"
    USERS_UPDATE = "users:update"
    USERS_DELETE = "users:delete"
    PROJECTS_READ = "projects:read"
    PROJECTS_CREATE = "projects:create"

class Role(str, Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"

ROLE_PERMISSIONS: dict[Role, list[Permission]] = {
    Role.VIEWER: [Permission.PROJECTS_READ],
    Role.EDITOR: [Permission.PROJECTS_READ, Permission.PROJECTS_CREATE],
    Role.ADMIN: list(Permission),  # All permissions
}

def has_permission(user_roles: list[Role], required: Permission) -> bool:
    return any(
        required in ROLE_PERMISSIONS.get(role, [])
        for role in user_roles
    )

def require_permission(permission: Permission) -> Callable:
    """Decorator that enforces RBAC on a Flask endpoint."""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not g.get("current_user"):
                return jsonify({"error": "Authentication required"}), 401

            if not has_permission(g.current_user.roles, permission):
                audit_log.record(
                    action="permission_denied",
                    actor=g.current_user.id,
                    required=permission.value,
                    resource=request.path,
                )
                return jsonify({"error": "Insufficient permissions"}), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator

# Usage
@app.route("/api/users", methods=["POST"])
@authenticate
@require_permission(Permission.USERS_CREATE)
def create_user():
    # Only reachable if the user has the users:create permission
    data = request.get_json()
    user = user_service.create(data, actor=g.current_user)
    return jsonify(user.to_dict()), 201
```

---

### 2. ABAC -- Attribute-Based Access Control

ABAC makes access decisions based on attributes of the subject (user), resource, action, and environment. It is more flexible than RBAC and supports fine-grained, context-aware policies.

```
ABAC Decision Flow:

  Subject Attributes       Resource Attributes      Environment Attributes
  ┌──────────────────┐    ┌───────────────────┐    ┌───────────────────┐
  │ user.role=editor │    │ doc.classification│    │ time=14:30 UTC    │
  │ user.dept=eng    │    │   = "internal"    │    │ ip=10.0.0.50      │
  │ user.clearance=3 │    │ doc.owner=alice   │    │ device=managed    │
  │ user.location=US │    │ doc.tenant=acme   │    │ mfa=true          │
  └────────┬─────────┘    └────────┬──────────┘    └────────┬──────────┘
           │                       │                        │
           └───────────────────────┼────────────────────────┘
                                   │
                          ┌────────▼────────┐
                          │  Policy Engine  │
                          │                 │
                          │  IF subject.dept│
                          │    == resource. │
                          │    dept         │
                          │  AND clearance  │
                          │    >= required  │
                          │  AND env.mfa    │
                          │    == true      │
                          │  THEN: ALLOW    │
                          └────────┬────────┘
                                   │
                              ┌────▼────┐
                              │ ALLOW / │
                              │  DENY   │
                              └─────────┘
```

**TypeScript -- ABAC policy engine:**

```typescript
interface ABACContext {
  subject: {
    id: string;
    roles: string[];
    department: string;
    clearanceLevel: number;
    mfaVerified: boolean;
  };
  resource: {
    type: string;
    id: string;
    ownerId: string;
    department: string;
    classification: "public" | "internal" | "confidential" | "restricted";
    tenantId: string;
  };
  action: "read" | "write" | "delete" | "admin";
  environment: {
    ipAddress: string;
    time: Date;
    isManagedDevice: boolean;
    geoLocation: string;
  };
}

interface Policy {
  name: string;
  description: string;
  evaluate(ctx: ABACContext): "allow" | "deny" | "not_applicable";
}

// Policy: Users can only access resources in their own department
const departmentIsolationPolicy: Policy = {
  name: "department-isolation",
  description: "Users can only access resources belonging to their department",
  evaluate(ctx) {
    if (ctx.subject.department !== ctx.resource.department) {
      return "deny";
    }
    return "not_applicable"; // Let other policies decide
  },
};

// Policy: Confidential resources require MFA and managed device
const confidentialAccessPolicy: Policy = {
  name: "confidential-access",
  description: "Confidential resources require MFA and managed device",
  evaluate(ctx) {
    if (ctx.resource.classification === "confidential" ||
        ctx.resource.classification === "restricted") {
      if (!ctx.subject.mfaVerified || !ctx.environment.isManagedDevice) {
        return "deny";
      }
    }
    return "not_applicable";
  },
};

// Policy: Delete operations require clearance level 3+
const deletionPolicy: Policy = {
  name: "deletion-clearance",
  description: "Delete operations require clearance level 3 or higher",
  evaluate(ctx) {
    if (ctx.action === "delete" && ctx.subject.clearanceLevel < 3) {
      return "deny";
    }
    return "not_applicable";
  },
};

// Policy engine evaluates all policies -- deny wins over allow
class ABACPolicyEngine {
  private policies: Policy[] = [];

  addPolicy(policy: Policy): void {
    this.policies.push(policy);
  }

  evaluate(ctx: ABACContext): { decision: "allow" | "deny"; reasons: string[] } {
    const reasons: string[] = [];
    let hasExplicitAllow = false;

    for (const policy of this.policies) {
      const result = policy.evaluate(ctx);
      if (result === "deny") {
        reasons.push(`Denied by policy: ${policy.name}`);
        // Deny-overrides: any deny = final deny
        return { decision: "deny", reasons };
      }
      if (result === "allow") {
        hasExplicitAllow = true;
        reasons.push(`Allowed by policy: ${policy.name}`);
      }
    }

    // Default deny if no policy explicitly allows
    if (!hasExplicitAllow) {
      return { decision: "deny", reasons: ["No policy granted access"] };
    }

    return { decision: "allow", reasons };
  }
}
```

---

### 3. PBAC -- Policy-Based Access Control

PBAC externalizes authorization logic into policy files evaluated by a dedicated policy engine. This separates authorization logic from application code. The three major PBAC engines are OPA (Open Policy Agent), Casbin, and Cedar (AWS).

**OPA with Rego:**

```rego
# policy.rego -- Open Policy Agent policy file
package app.authz

import rego.v1

# Default deny -- if no rule allows, access is denied
default allow := false

# Allow admins to do anything
allow if {
    input.subject.roles[_] == "admin"
}

# Allow users to read their own resources
allow if {
    input.action == "read"
    input.resource.owner_id == input.subject.id
}

# Allow editors to write to resources in their department
allow if {
    input.action == "write"
    input.subject.roles[_] == "editor"
    input.subject.department == input.resource.department
}

# Deny access to restricted resources outside business hours
deny if {
    input.resource.classification == "restricted"
    hour := time.clock(time.now_ns())[0]
    hour < 9
}

deny if {
    input.resource.classification == "restricted"
    hour := time.clock(time.now_ns())[0]
    hour >= 18
}

# Final decision: allow AND NOT deny
authorized if {
    allow
    not deny
}
```

**Casbin model and policy:**

```ini
# model.conf -- Casbin RBAC model with resource attributes
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
```

```csv
# policy.csv -- Casbin policy rules
p, admin, /api/users, GET
p, admin, /api/users, POST
p, admin, /api/users, DELETE
p, editor, /api/articles, GET
p, editor, /api/articles, POST
p, viewer, /api/articles, GET

g, alice, admin
g, bob, editor
g, carol, viewer
```

**Cedar (AWS Verified Permissions):**

```cedar
// Cedar policy -- AWS Verified Permissions
// Allow project members to read project documents
permit(
    principal in Group::"project-alpha-members",
    action in [Action::"read", Action::"list"],
    resource in Folder::"project-alpha-docs"
);

// Allow document owners to edit and delete their own documents
permit(
    principal,
    action in [Action::"edit", Action::"delete"],
    resource
) when {
    resource.owner == principal
};

// Deny access to archived resources for all non-admins
forbid(
    principal,
    action,
    resource
) when {
    resource.status == "archived" &&
    !(principal in Group::"admins")
};

// Require MFA for sensitive operations
forbid(
    principal,
    action in [Action::"delete", Action::"transfer"],
    resource
) unless {
    context.mfa_verified == true
};
```

**Go -- OPA integration:**

```go
package authz

import (
    "context"
    "github.com/open-policy-agent/opa/v1/rego"
)

type OPAAuthorizer struct {
    query rego.PreparedEvalQuery
}

func NewOPAAuthorizer(policyPath string) (*OPAAuthorizer, error) {
    query, err := rego.New(
        rego.Query("data.app.authz.authorized"),
        rego.Load([]string{policyPath}, nil),
    ).PrepareForEval(context.Background())
    if err != nil {
        return nil, fmt.Errorf("preparing OPA query: %w", err)
    }
    return &OPAAuthorizer{query: query}, nil
}

func (o *OPAAuthorizer) IsAuthorized(ctx context.Context, input map[string]interface{}) (bool, error) {
    results, err := o.query.Eval(ctx, rego.EvalInput(input))
    if err != nil {
        // Fail closed: policy evaluation error = deny
        slog.Error("OPA evaluation failed", "error", err)
        return false, nil
    }

    if len(results) == 0 || len(results[0].Expressions) == 0 {
        return false, nil // No result = deny
    }

    allowed, ok := results[0].Expressions[0].Value.(bool)
    if !ok {
        return false, nil // Unexpected type = deny
    }

    return allowed, nil
}

// Middleware using OPA
func OPAMiddleware(authorizer *OPAAuthorizer) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user := UserFromContext(r.Context())
            if user == nil {
                http.Error(w, `{"error":"authentication required"}`, 401)
                return
            }

            input := map[string]interface{}{
                "subject": map[string]interface{}{
                    "id":         user.ID,
                    "roles":      user.Roles,
                    "department": user.Department,
                },
                "action":   r.Method,
                "resource": map[string]interface{}{
                    "path": r.URL.Path,
                },
            }

            allowed, err := authorizer.IsAuthorized(r.Context(), input)
            if err != nil || !allowed {
                http.Error(w, `{"error":"access denied"}`, 403)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

---

### 4. ReBAC -- Relationship-Based Access Control

ReBAC determines access based on the relationships between entities. It is the model behind Google Zanzibar (Google Docs, Drive, YouTube permissions) and is implemented by SpiceDB/Authzed. ReBAC excels at modeling permissions like "user X can edit document Y because X is a member of team Z, which owns folder W, which contains Y."

```
ReBAC Relationship Tuples:

  Object            Relation     Subject
  ──────────────    ─────────    ─────────────────────
  document:readme   owner        user:alice
  document:readme   parent       folder:engineering
  folder:engineering viewer      team:backend#member
  team:backend      member       user:alice
  team:backend      member       user:bob
  org:acme          admin        user:charlie
  org:acme          member       team:backend

  Query: "Can bob view document:readme?"
  Resolution:
    bob -> member of team:backend
    team:backend#member -> viewer of folder:engineering
    folder:engineering -> parent of document:readme
    Viewer of parent = viewer of children
    Result: ALLOW
```

**SpiceDB schema definition:**

```zed
// SpiceDB schema -- defines entity types and their relationships
definition user {}

definition team {
    relation member: user
    relation admin: user

    permission can_manage = admin
    permission can_view = member + admin
}

definition folder {
    relation owner: user | team#member
    relation editor: user | team#member
    relation viewer: user | team#member

    permission can_write = owner + editor
    permission can_read = can_write + viewer
}

definition document {
    relation parent: folder
    relation owner: user
    relation editor: user | team#member
    relation viewer: user | team#member

    // Permissions combine direct grants with inherited permissions from parent folder
    permission can_write = owner + editor + parent->can_write
    permission can_read = can_write + viewer + parent->can_read
    permission can_delete = owner + parent->owner
}
```

**TypeScript -- SpiceDB client integration:**

```typescript
import { v1 } from "@authzed/authzed-node";

const client = v1.NewClient("your-spicedb-token", "localhost:50051");

// Write a relationship: "alice is the owner of document:readme"
async function grantAccess(
  resourceType: string,
  resourceId: string,
  relation: string,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  await client.writeRelationships(
    v1.WriteRelationshipsRequest.create({
      updates: [
        v1.RelationshipUpdate.create({
          operation: v1.RelationshipUpdate_Operation.TOUCH,
          relationship: v1.Relationship.create({
            resource: v1.ObjectReference.create({
              objectType: resourceType,
              objectId: resourceId,
            }),
            relation: relation,
            subject: v1.SubjectReference.create({
              object: v1.ObjectReference.create({
                objectType: subjectType,
                objectId: subjectId,
              }),
            }),
          }),
        }),
      ],
    }),
  );
}

// Check permission: "Can bob read document:readme?"
async function checkPermission(
  resourceType: string,
  resourceId: string,
  permission: string,
  subjectType: string,
  subjectId: string,
): Promise<boolean> {
  const response = await client.checkPermission(
    v1.CheckPermissionRequest.create({
      resource: v1.ObjectReference.create({
        objectType: resourceType,
        objectId: resourceId,
      }),
      permission: permission,
      subject: v1.SubjectReference.create({
        object: v1.ObjectReference.create({
          objectType: subjectType,
          objectId: subjectId,
        }),
      }),
    }),
  );

  return response.permissionship ===
    v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
}

// Usage in an endpoint
app.get("/api/documents/:id", authenticate, async (req, res) => {
  const canRead = await checkPermission(
    "document", req.params.id,
    "can_read",
    "user", req.user.id,
  );

  if (!canRead) {
    return res.status(403).json({ error: "Access denied" });
  }

  const document = await db.getDocument(req.params.id);
  res.json(document);
});
```

---

### 5. ACL -- Access Control Lists

ACLs attach permission lists directly to resources. Each resource has a list specifying which subjects can perform which actions. ACLs are straightforward for small systems but become difficult to manage at scale.

```
ACL Structure:

  Resource: /reports/q4-financial.pdf
  ┌──────────────────────────────────────────────┐
  │ ACL Entry         │ Subject    │ Permissions  │
  ├───────────────────┼────────────┼──────────────┤
  │ owner             │ alice      │ read, write, │
  │                   │            │ delete, share│
  ├───────────────────┼────────────┼──────────────┤
  │ group: finance    │ finance    │ read, write  │
  ├───────────────────┼────────────┼──────────────┤
  │ group: engineering│ engineering│ read         │
  ├───────────────────┼────────────┼──────────────┤
  │ default (other)   │ *          │ (none)       │
  └───────────────────┴────────────┴──────────────┘
```

**TypeScript -- Application-level ACL:**

```typescript
interface ACLEntry {
  subjectType: "user" | "group" | "role";
  subjectId: string;
  permissions: Set<string>;
}

interface ResourceACL {
  resourceId: string;
  entries: ACLEntry[];
}

class ACLService {
  async checkAccess(
    resourceId: string,
    subjectId: string,
    subjectGroups: string[],
    requiredPermission: string,
  ): Promise<boolean> {
    const acl = await this.aclStore.getACL(resourceId);
    if (!acl) return false; // No ACL = no access (fail closed)

    for (const entry of acl.entries) {
      const matchesSubject =
        (entry.subjectType === "user" && entry.subjectId === subjectId) ||
        (entry.subjectType === "group" && subjectGroups.includes(entry.subjectId));

      if (matchesSubject && entry.permissions.has(requiredPermission)) {
        return true;
      }
    }

    return false; // No matching entry = deny
  }
}
```

**Network ACL -- AWS VPC example:**

```hcl
# Terraform -- AWS Network ACL (stateless, evaluated in order)
resource "aws_network_acl" "database_tier" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = [aws_subnet.database.id]

  # Allow inbound PostgreSQL from application subnet only
  ingress {
    rule_no    = 100
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "10.0.1.0/24"  # App subnet only
    from_port  = 5432
    to_port    = 5432
  }

  # Deny all other inbound traffic
  ingress {
    rule_no    = 200
    protocol   = "-1"
    action     = "deny"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  # Allow outbound responses to application subnet
  egress {
    rule_no    = 100
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "10.0.1.0/24"
    from_port  = 1024
    to_port    = 65535
  }

  # Deny all other outbound
  egress {
    rule_no    = 200
    protocol   = "-1"
    action     = "deny"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }
}
```

---

### 6. MAC vs DAC -- Mandatory vs Discretionary Access Control

**DAC (Discretionary Access Control):** Resource owners decide who can access their resources. Standard file permissions (chmod, NTFS ACLs) are DAC. The risk: a user can share access inappropriately.

**MAC (Mandatory Access Control):** A central authority defines access rules that cannot be overridden by users. SELinux and AppArmor enforce MAC policies. Used in high-security environments where users must not be able to weaken access controls.

```
DAC vs MAC:

  DAC (Discretionary)                    MAC (Mandatory)
  ─────────────────────                  ─────────────────────
  Owner controls access                  Central policy controls access
  User can chmod, share                  User CANNOT override policy
  Flexible, user-friendly                Strict, system-enforced
  Risk: accidental oversharing           Protection: prevents data leakage

  Example: Linux file permissions        Example: SELinux, AppArmor
  alice$ chmod 644 secret.txt            Even root cannot bypass SELinux
  # Now everyone can read it             # if the policy denies access
```

**SELinux policy -- confine a web server:**

```bash
# SELinux: The httpd process can ONLY read files labeled httpd_sys_content_t
# Even if a vulnerability gives code execution, the attacker cannot read /etc/shadow

# View the SELinux context of web content
# ls -Z /var/www/html/
# -rw-r--r--. root root system_u:object_r:httpd_sys_content_t:s0 index.html

# The httpd process runs as httpd_t
# ps -eZ | grep httpd
# system_u:system_r:httpd_t:s0    1234 ?  00:00:01 httpd

# SELinux policy rule (simplified):
# allow httpd_t httpd_sys_content_t:file { read getattr open };
# Result: httpd can read web content files, NOTHING else

# Even if an attacker exploits the web server and tries:
# cat /etc/shadow  -> Denied by SELinux (httpd_t cannot read shadow_t)
# ls /home/        -> Denied by SELinux (httpd_t cannot read user_home_t)
```

**AppArmor profile -- confine an application:**

```
# /etc/apparmor.d/usr.sbin.myapp
#include <tunables/global>

/usr/sbin/myapp {
  #include <abstractions/base>
  #include <abstractions/nameservice>

  # Allow reading its own config
  /etc/myapp/config.yaml r,

  # Allow reading and writing to its data directory ONLY
  /var/lib/myapp/ r,
  /var/lib/myapp/** rwk,

  # Allow network access on specific port only
  network inet stream,
  network inet6 stream,

  # Deny everything else implicitly
  # No access to /home, /etc/shadow, /tmp, etc.
  # Even if the application is compromised, the attacker is confined
}
```

---

## IDOR Prevention -- Insecure Direct Object Reference (CWE-639)

IDOR occurs when an application exposes internal object identifiers (database IDs, file paths) in URLs or request parameters without verifying that the authenticated user is authorized to access the referenced object.

**WRONG -- Vulnerable to IDOR:**

```typescript
// INSECURE: No ownership check -- any user can access any invoice
app.get("/api/invoices/:id", authenticate, async (req, res) => {
  // The user simply changes the ID in the URL:
  // GET /api/invoices/1001 -> GET /api/invoices/1002 (another user's invoice)
  const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.id]);
  res.json(invoice); // Exposes another user's financial data
});

// INSECURE: Sequential integer IDs make enumeration trivial
// GET /api/invoices/1
// GET /api/invoices/2
// GET /api/invoices/3
// ... attacker iterates through ALL invoices
```

**RIGHT -- Secure against IDOR:**

```typescript
// SECURE: Authorization check on every resource access
app.get("/api/invoices/:id", authenticate, async (req, res) => {
  const invoice = await db.query(
    // Include the user_id in the WHERE clause -- cannot access other users' data
    "SELECT * FROM invoices WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.id],
  );

  if (!invoice) {
    // Return 404, NOT 403 -- do not confirm the resource exists
    return res.status(404).json({ error: "Invoice not found" });
  }

  res.json(invoice);
});

// ADDITIONAL DEFENSE: Use UUIDs instead of sequential integers
// UUIDs are not guessable: 550e8400-e29b-41d4-a716-446655440000
// Sequential IDs are trivially enumerable: 1, 2, 3, 4...
```

**Go -- IDOR prevention with ownership check:**

```go
func getInvoiceHandler(w http.ResponseWriter, r *http.Request) {
    user := UserFromContext(r.Context())
    invoiceID := r.PathValue("id")

    // Validate UUID format before querying
    if _, err := uuid.Parse(invoiceID); err != nil {
        http.Error(w, `{"error":"invalid invoice ID"}`, http.StatusBadRequest)
        return
    }

    // Query scoped to the authenticated user -- IDOR prevention
    invoice, err := db.QueryRow(r.Context(),
        `SELECT id, amount, status, created_at
         FROM invoices
         WHERE id = $1 AND user_id = $2`,
        invoiceID, user.ID,
    )

    if err != nil {
        // Do not distinguish "does not exist" from "not authorized"
        // Both return 404 to prevent information leakage
        http.Error(w, `{"error":"invoice not found"}`, http.StatusNotFound)
        return
    }

    json.NewEncoder(w).Encode(invoice)
}
```

**Python -- IDOR prevention at the ORM level:**

```python
# SECURE: Scope all queries to the current user by default
class InvoiceService:
    def get_invoice(self, invoice_id: str, current_user: User) -> Invoice:
        """Always scope queries to the authenticated user."""
        invoice = (
            Invoice.query
            .filter_by(id=invoice_id, user_id=current_user.id)
            .first()
        )

        if not invoice:
            # Do not distinguish "not found" from "not authorized"
            raise NotFoundError("Invoice not found")

        return invoice

    def list_invoices(self, current_user: User) -> list[Invoice]:
        """Users only see their own invoices."""
        return (
            Invoice.query
            .filter_by(user_id=current_user.id)
            .order_by(Invoice.created_at.desc())
            .all()
        )

# ADDITIONAL DEFENSE: Database Row-Level Security (PostgreSQL)
# Even if application code has a bug, the database enforces isolation
#
# CREATE POLICY invoice_isolation ON invoices
#   USING (user_id = current_setting('app.current_user_id')::uuid);
#
# ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
```

---

## Horizontal Privilege Escalation

Horizontal privilege escalation occurs when User A accesses resources belonging to User B at the same privilege level. This is the most common access control vulnerability in web applications.

```
Horizontal Escalation:

  User A (role: customer)         User B (role: customer)
  ┌────────────────────┐         ┌────────────────────┐
  │ Can see own orders │         │ Can see own orders │
  │ Order #1001        │  IDOR   │ Order #1002        │
  │ Order #1003        │ ──────> │ Order #1004        │
  │                    │ Attacker│                    │
  │ Profile: Alice     │ accesses│ Profile: Bob       │
  │ Card: **** 4242    │ Bob's   │ Card: **** 1234    │
  └────────────────────┘  data   └────────────────────┘
```

**Prevention pattern -- ownership enforcement at every layer:**

```typescript
// SECURE: Centralized ownership check middleware
function requireOwnership(resourceFetcher: (id: string) => Promise<{ userId: string } | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resource = await resourceFetcher(req.params.id);

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Ownership check: the authenticated user must own the resource
    // OR have an admin role that explicitly grants cross-user access
    if (resource.userId !== req.user.id && !req.user.hasRole("admin")) {
      audit.log("horizontal_escalation_attempt", {
        actor: req.user.id,
        targetOwner: resource.userId,
        resource: req.params.id,
        path: req.originalUrl,
        ip: req.ip,
      });
      return res.status(404).json({ error: "Resource not found" }); // 404, not 403
    }

    req.resource = resource;
    next();
  };
}

// Apply ownership enforcement to all user-scoped routes
app.get("/api/orders/:id", authenticate, requireOwnership(db.getOrder), getOrderHandler);
app.put("/api/orders/:id", authenticate, requireOwnership(db.getOrder), updateOrderHandler);
app.get("/api/profiles/:id", authenticate, requireOwnership(db.getProfile), getProfileHandler);
```

---

## Vertical Privilege Escalation

Vertical privilege escalation occurs when a regular user accesses functionality reserved for a higher-privilege role (e.g., admin functions). This happens when role checks are missing, client-side only, or bypassable.

```
Vertical Escalation:

  Regular User (role: customer)      Admin (role: admin)
  ┌────────────────────┐             ┌────────────────────┐
  │ Browse products    │             │ Manage users       │
  │ Place orders       │  Bypasses   │ View all orders    │
  │ View own profile   │ ─────────> │ Modify prices      │
  │                    │  role check │ Export all data     │
  │ GET /api/admin/    │             │ DELETE /api/users/  │
  │ users (should fail)│             │                    │
  └────────────────────┘             └────────────────────┘
```

**WRONG -- Client-side role check only:**

```typescript
// INSECURE: Role check only in the frontend -- easily bypassed
// React component
function AdminPanel() {
  const { user } = useAuth();

  // Attacker simply calls the API directly, bypassing this check
  if (user.role !== "admin") {
    return <p>Access denied</p>;
  }

  return <AdminDashboard />;
}

// API endpoint has NO role check -- anyone who calls it gets admin data
app.get("/api/admin/users", authenticate, async (req, res) => {
  const users = await db.query("SELECT * FROM users");
  res.json(users); // Any authenticated user gets ALL user data
});
```

**RIGHT -- Server-side role enforcement on every admin endpoint:**

```typescript
// SECURE: Role enforced on the server -- the ONLY layer that matters

function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const hasRequiredRole = req.user.roles.some((r: string) => allowedRoles.includes(r));
    if (!hasRequiredRole) {
      audit.log("vertical_escalation_attempt", {
        actor: req.user.id,
        actualRoles: req.user.roles,
        requiredRoles: allowedRoles,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({ error: "Insufficient privileges" });
    }

    next();
  };
}

// ALL admin routes require the admin role -- no exceptions
const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(requireRole("admin"));

adminRouter.get("/users", listAllUsersHandler);
adminRouter.delete("/users/:id", deleteUserHandler);
adminRouter.put("/users/:id/role", changeUserRoleHandler);
adminRouter.get("/audit-log", viewAuditLogHandler);

app.use("/api/admin", adminRouter);
```

**Python -- decorator-based role enforcement:**

```python
def require_role(*allowed_roles: str):
    """Decorator that enforces role-based access on endpoints."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not g.current_user:
                return jsonify({"error": "Authentication required"}), 401

            if not any(role in allowed_roles for role in g.current_user.roles):
                audit_log.record(
                    action="vertical_escalation_attempt",
                    actor=g.current_user.id,
                    actual_roles=g.current_user.roles,
                    required_roles=list(allowed_roles),
                    path=request.path,
                    ip=request.remote_addr,
                )
                return jsonify({"error": "Insufficient privileges"}), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/api/admin/users", methods=["GET"])
@authenticate
@require_role("admin", "super_admin")
def admin_list_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])
```

---

## Broken Access Control Patterns (OWASP A01:2021)

### Path Traversal

```typescript
// WRONG: User-controlled file path -- allows directory traversal
app.get("/api/files/:filename", authenticate, (req, res) => {
  const filePath = `/uploads/${req.params.filename}`;
  // Attacker sends: GET /api/files/../../etc/passwd
  // Resolved path: /etc/passwd
  res.sendFile(filePath);
});

// RIGHT: Validate and normalize the path
import path from "path";

app.get("/api/files/:filename", authenticate, (req, res) => {
  const UPLOAD_DIR = "/uploads";
  const requestedPath = path.resolve(UPLOAD_DIR, req.params.filename);

  // Verify the resolved path is still within the allowed directory
  if (!requestedPath.startsWith(UPLOAD_DIR + path.sep)) {
    audit.log("path_traversal_attempt", {
      actor: req.user.id,
      requestedFile: req.params.filename,
      resolvedPath: requestedPath,
    });
    return res.status(400).json({ error: "Invalid file path" });
  }

  res.sendFile(requestedPath);
});
```

### Force Browsing

```typescript
// WRONG: Admin pages exist without authorization checks
// Attacker guesses: /admin, /admin/dashboard, /api/internal/config
app.get("/admin/dashboard", (req, res) => {
  // No auth check -- anyone who finds the URL has access
  res.render("admin-dashboard", { config: getSystemConfig() });
});

// RIGHT: Every route requires authentication and authorization
app.get("/admin/dashboard", authenticate, requireRole("admin"), (req, res) => {
  res.render("admin-dashboard", { config: getSystemConfig() });
});
```

### CORS Misconfiguration

```typescript
// WRONG: Reflects any origin -- allows any website to make cross-origin requests
app.use(cors({
  origin: (origin, callback) => {
    callback(null, origin); // Reflects the requesting origin -- defeats CORS entirely
  },
  credentials: true,
}));

// WRONG: Wildcard with credentials
app.use(cors({ origin: "*", credentials: true })); // Browser rejects this, but still bad practice

// RIGHT: Explicit allowlist of trusted origins
const ALLOWED_ORIGINS = new Set([
  "https://app.example.com",
  "https://admin.example.com",
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      callback(null, origin);
    } else {
      callback(new Error("CORS violation"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));
```

### JWT Tampering

```typescript
// WRONG: Accepting the "none" algorithm -- attacker removes the signature
const payload = jwt.verify(token, SECRET); // Does not restrict algorithm
// Attacker forges a token with "alg": "none" and no signature

// WRONG: Algorithm confusion -- allowing both HS256 and RS256
// Attacker uses the PUBLIC key as the HS256 secret to forge tokens
const payload = jwt.verify(token, PUBLIC_KEY, { algorithms: ["RS256", "HS256"] });

// RIGHT: Explicitly specify the ONLY allowed algorithm
const payload = jwt.verify(token, PUBLIC_KEY, {
  algorithms: ["RS256"],  // ONLY RS256 -- no "none", no HS256
  issuer: "auth.example.com",
  audience: "api.example.com",
  clockTolerance: 30, // 30-second tolerance for clock skew
});
```

### Metadata Manipulation

```typescript
// WRONG: Trust user-provided role from the client
app.post("/api/register", async (req, res) => {
  const user = await db.createUser({
    email: req.body.email,
    password: await bcrypt.hash(req.body.password, 12),
    role: req.body.role, // Attacker sends: { "role": "admin" }
  });
  res.json(user);
});

// RIGHT: Never accept security-critical fields from client input
app.post("/api/register", async (req, res) => {
  const user = await db.createUser({
    email: req.body.email,
    password: await bcrypt.hash(req.body.password, 12),
    role: "viewer", // ALWAYS set by the server -- never from client input
  });
  res.json(user);
});
```

---

## Centralized Authorization

Never scatter authorization checks across individual handlers. Implement a centralized authorization layer using the PDP/PEP pattern.

```
Centralized Authorization Architecture:

  ┌─────────────────────────────────────────────────────────┐
  │                    API Gateway / Proxy                    │
  │  ┌─────────────────────────────────────────────────────┐ │
  │  │  PEP (Policy Enforcement Point)                     │ │
  │  │  Intercepts every request, calls PDP, enforces      │ │
  │  └───────────────────┬─────────────────────────────────┘ │
  └──────────────────────┼───────────────────────────────────┘
                         │ "Can user X do action Y on resource Z?"
                         ▼
  ┌─────────────────────────────────────────────────────────┐
  │  PDP (Policy Decision Point)                             │
  │  Evaluates policies, returns ALLOW / DENY                │
  │  Implemented by: OPA, Casbin, Cedar, SpiceDB, custom     │
  ├─────────────────────────────────────────────────────────┤
  │  Policy Store        │  User/Role Store                  │
  │  (Rego, Cedar, etc.) │  (Database, LDAP, IdP)            │
  └─────────────────────────────────────────────────────────┘
```

**TypeScript -- Centralized authorization service:**

```typescript
// Authorization service -- single point for all access decisions
class AuthorizationService {
  constructor(
    private policyEngine: PolicyEngine,
    private roleStore: RoleStore,
    private auditLog: AuditLogger,
  ) {}

  async authorize(request: AuthzRequest): Promise<AuthzDecision> {
    const startTime = Date.now();

    try {
      // Fetch user's roles and attributes
      const userContext = await this.roleStore.getUserContext(request.subjectId);

      // Evaluate all policies
      const decision = await this.policyEngine.evaluate({
        subject: userContext,
        action: request.action,
        resource: request.resource,
        environment: request.environment,
      });

      // Audit every decision
      await this.auditLog.record({
        action: "authorization_decision",
        subjectId: request.subjectId,
        resource: request.resource,
        requestedAction: request.action,
        decision: decision.allowed ? "allow" : "deny",
        reasons: decision.reasons,
        durationMs: Date.now() - startTime,
      });

      return decision;
    } catch (error) {
      // Fail closed: errors result in denial
      await this.auditLog.record({
        action: "authorization_error",
        subjectId: request.subjectId,
        resource: request.resource,
        error: String(error),
      });

      return { allowed: false, reasons: ["Authorization service error"] };
    }
  }
}

// Express middleware that calls the centralized authorization service
function authzMiddleware(authzService: AuthorizationService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const decision = await authzService.authorize({
      subjectId: req.user.id,
      action: mapHttpMethodToAction(req.method),
      resource: { type: extractResourceType(req.path), id: req.params.id },
      environment: { ip: req.ip, userAgent: req.headers["user-agent"] },
    });

    if (!decision.allowed) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };
}

function mapHttpMethodToAction(method: string): string {
  const mapping: Record<string, string> = {
    GET: "read",
    POST: "create",
    PUT: "update",
    PATCH: "update",
    DELETE: "delete",
  };
  return mapping[method] || "unknown";
}
```

**Go -- gRPC interceptor for centralized authorization:**

```go
// UnaryAuthzInterceptor applies authorization to every gRPC call
func UnaryAuthzInterceptor(authz *AuthorizationService) grpc.UnaryServerInterceptor {
    return func(
        ctx context.Context,
        req interface{},
        info *grpc.UnaryServerInfo,
        handler grpc.UnaryHandler,
    ) (interface{}, error) {
        user := UserFromContext(ctx)
        if user == nil {
            return nil, status.Error(codes.Unauthenticated, "authentication required")
        }

        decision, err := authz.Authorize(ctx, AuthzRequest{
            SubjectID: user.ID,
            Action:    info.FullMethod,
            Resource:  extractResourceFromRequest(req),
        })

        if err != nil {
            slog.Error("authorization check failed", "error", err, "method", info.FullMethod)
            return nil, status.Error(codes.PermissionDenied, "access denied")
        }

        if !decision.Allowed {
            return nil, status.Error(codes.PermissionDenied, "access denied")
        }

        return handler(ctx, req)
    }
}

// Register the interceptor on the gRPC server
server := grpc.NewServer(
    grpc.UnaryInterceptor(UnaryAuthzInterceptor(authzService)),
)
```

---

## Multi-Tenancy Authorization

Multi-tenant systems must enforce absolute isolation between tenants. A bug that lets Tenant A see Tenant B's data is a catastrophic security and compliance failure.

```
Multi-Tenant Isolation:

  ┌────────────────────────┐    ┌────────────────────────┐
  │  Tenant: Acme Corp     │    │  Tenant: Globex Inc    │
  │  tenant_id: acme       │    │  tenant_id: globex     │
  ├────────────────────────┤    ├────────────────────────┤
  │  Users: alice, bob     │    │  Users: carol, dave    │
  │  Data: orders, invoices│    │  Data: orders, invoices│
  │  Config: settings      │    │  Config: settings      │
  └────────────────────────┘    └────────────────────────┘
           │                              │
           │  ABSOLUTE WALL -- no cross-  │
           │  tenant access permitted     │
           └──────────────────────────────┘

  Every query MUST include tenant_id in the WHERE clause.
  Every middleware MUST extract and validate tenant context.
  The database MUST enforce isolation via RLS or separate schemas.
```

**TypeScript -- Tenant isolation middleware:**

```typescript
// Extract and validate tenant context on every request
function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // Tenant ID comes from the authenticated user's JWT -- NOT from request params
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: "No tenant context" });
  }

  // Set tenant context for all downstream operations
  req.tenantContext = { tenantId };
  next();
}

// Tenant-scoped repository -- ALL queries include tenant_id
class TenantScopedRepository<T> {
  constructor(
    private db: Database,
    private tableName: string,
    private tenantId: string,
  ) {}

  async findById(id: string): Promise<T | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    );
    return result.rows[0] || null;
  }

  async findAll(filters: Record<string, unknown> = {}): Promise<T[]> {
    // tenant_id is ALWAYS included -- cannot be omitted
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`,
      [this.tenantId],
    );
    return result.rows;
  }

  async create(data: Partial<T>): Promise<T> {
    // Inject tenant_id -- cannot be overridden by caller
    const tenantData = { ...data, tenant_id: this.tenantId };
    return this.db.insert(this.tableName, tenantData);
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    // Scoped to tenant -- cannot update another tenant's data
    return this.db.query(
      `UPDATE ${this.tableName} SET ... WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, this.tenantId],
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    );
    return result.rowCount > 0;
  }
}

// Usage in a handler
app.get("/api/orders", authenticate, tenantMiddleware, async (req, res) => {
  const orderRepo = new TenantScopedRepository<Order>(
    db, "orders", req.tenantContext.tenantId,
  );
  const orders = await orderRepo.findAll();
  res.json(orders);
});
```

**PostgreSQL -- Row-Level Security for tenant isolation:**

```sql
-- Database-level tenant isolation -- defense in depth
-- Even if application code has a bug, the database enforces isolation

-- Enable RLS on all tenant-scoped tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: rows visible only to the current tenant
CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_invoices ON invoices
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_customers ON customers
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- The application sets the tenant context on each connection
-- SET app.current_tenant_id = '<tenant-uuid>';
-- After this, all SELECT/INSERT/UPDATE/DELETE automatically filter by tenant
```

**Go -- Tenant context propagation:**

```go
type tenantContextKey struct{}

// TenantMiddleware extracts tenant from the JWT and sets it in context
func TenantMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        user := UserFromContext(r.Context())
        if user == nil || user.TenantID == "" {
            http.Error(w, `{"error":"no tenant context"}`, http.StatusForbidden)
            return
        }

        ctx := context.WithValue(r.Context(), tenantContextKey{}, user.TenantID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func TenantIDFromContext(ctx context.Context) string {
    id, _ := ctx.Value(tenantContextKey{}).(string)
    return id
}

// Tenant-scoped database queries
func (r *OrderRepository) GetByID(ctx context.Context, orderID string) (*Order, error) {
    tenantID := TenantIDFromContext(ctx)
    if tenantID == "" {
        return nil, fmt.Errorf("missing tenant context")
    }

    var order Order
    err := r.db.QueryRowContext(ctx,
        `SELECT id, amount, status FROM orders WHERE id = $1 AND tenant_id = $2`,
        orderID, tenantID,
    ).Scan(&order.ID, &order.Amount, &order.Status)

    if err == sql.ErrNoRows {
        return nil, ErrNotFound
    }
    return &order, err
}
```

---

## API Authorization

### Endpoint-Level Authorization

Protect every API endpoint with authentication and role/permission checks.

```typescript
// Endpoint-level: who can call this endpoint?
const router = express.Router();
router.use(authenticate);

router.get("/api/reports",        requirePermission("reports:read"),   listReports);
router.post("/api/reports",       requirePermission("reports:create"), createReport);
router.get("/api/reports/:id",    requirePermission("reports:read"),   getReport);
router.delete("/api/reports/:id", requirePermission("reports:delete"), deleteReport);
```

### Resource-Level Authorization

Even if a user can access the endpoint, verify they can access the specific resource.

```typescript
// Resource-level: can this user access THIS specific resource?
async function getReport(req: Request, res: Response) {
  const report = await reportService.findById(req.params.id);
  if (!report) return res.status(404).json({ error: "Not found" });

  // Resource-level check: ownership or explicit share
  const canAccess =
    report.ownerId === req.user.id ||
    report.sharedWith.includes(req.user.id) ||
    req.user.hasRole("admin");

  if (!canAccess) {
    return res.status(404).json({ error: "Not found" }); // 404 not 403
  }

  res.json(report);
}
```

### Field-Level Authorization

Some fields within a resource may require higher privileges to view or modify.

```typescript
// Field-level: which fields can this user see?
async function getUser(req: Request, res: Response) {
  const user = await userService.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });

  // Base fields -- visible to the user themselves and admins
  const response: Record<string, unknown> = {
    id: user.id,
    name: user.name,
    email: user.email,
  };

  // Sensitive fields -- only visible to admins
  if (req.user.hasRole("admin")) {
    response.ssn = user.ssn;
    response.salary = user.salary;
    response.internalNotes = user.internalNotes;
  }

  // Financial fields -- only visible to billing admins
  if (req.user.hasRole("billing_admin") || req.user.hasRole("admin")) {
    response.paymentMethod = user.paymentMethod;
    response.billingAddress = user.billingAddress;
  }

  res.json(response);
}
```

### GraphQL Field-Level Authorization

GraphQL requires particular attention because clients choose which fields to query. Authorization must be enforced at the resolver level.

```typescript
// GraphQL -- field-level authorization in resolvers
const typeDefs = `
  type User {
    id: ID!
    name: String!
    email: String!
    ssn: String          # Sensitive -- admin only
    salary: Float        # Sensitive -- admin and HR only
    department: String
  }
`;

const resolvers = {
  User: {
    // Public fields -- no additional auth needed beyond query-level auth
    id: (parent: User) => parent.id,
    name: (parent: User) => parent.name,
    email: (parent: User) => parent.email,

    // Sensitive field -- requires admin role
    ssn: (parent: User, _args: unknown, context: GraphQLContext) => {
      if (!context.user.hasRole("admin")) {
        throw new ForbiddenError("Insufficient permissions to view SSN");
      }
      return parent.ssn;
    },

    // Sensitive field -- requires admin or HR role
    salary: (parent: User, _args: unknown, context: GraphQLContext) => {
      if (!context.user.hasRole("admin") && !context.user.hasRole("hr")) {
        throw new ForbiddenError("Insufficient permissions to view salary");
      }
      return parent.salary;
    },
  },

  Query: {
    // Query-level auth -- must be authenticated to query users at all
    user: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      if (!context.user) {
        throw new AuthenticationError("Authentication required");
      }
      return context.dataSources.users.findById(args.id);
    },
  },
};

// GraphQL directive for declarative field-level auth
// schema: directive @auth(requires: Role!) on FIELD_DEFINITION
// type User {
//   id: ID!
//   name: String!
//   ssn: String @auth(requires: ADMIN)
//   salary: Float @auth(requires: HR)
// }
```

**Python -- GraphQL field-level auth with Strawberry:**

```python
import strawberry
from strawberry.permission import BasePermission
from strawberry.types import Info

class IsAdmin(BasePermission):
    message = "Admin access required"

    def has_permission(self, source, info: Info, **kwargs) -> bool:
        return info.context.user and "admin" in info.context.user.roles

class IsHR(BasePermission):
    message = "HR access required"

    def has_permission(self, source, info: Info, **kwargs) -> bool:
        return info.context.user and (
            "hr" in info.context.user.roles or "admin" in info.context.user.roles
        )

@strawberry.type
class User:
    id: strawberry.ID
    name: str
    email: str

    @strawberry.field(permission_classes=[IsAdmin])
    def ssn(self) -> str:
        return self._ssn

    @strawberry.field(permission_classes=[IsHR])
    def salary(self) -> float:
        return self._salary
```

---

## Best Practices -- 10 Rules

### 1. Default Deny -- Explicit Allow

Every authorization system must deny by default. Access is never implicit. If no policy explicitly grants access, the answer is "deny."

### 2. Server-Side Enforcement Is the ONLY Enforcement

Client-side checks are for user experience only. The server must enforce every permission check independently. Assume every client-side check will be bypassed.

### 3. Verify Authorization on Every Request

Do not cache authorization decisions across HTTP requests. A user's permissions, roles, or tenant membership can change between requests. Check on every request.

### 4. Use 404 Instead of 403 for Resource-Scoped Denials

When a user is denied access to a specific resource (not an endpoint), return 404 "Not Found" instead of 403 "Forbidden." Returning 403 confirms that the resource exists, which leaks information to attackers.

### 5. Scope Every Query to the Authenticated User or Tenant

Every database query that accesses user-specific or tenant-specific data must include the user ID or tenant ID in the WHERE clause. Never rely solely on application-layer checks -- add database-level enforcement (RLS) as defense in depth.

### 6. Use UUIDs for External Resource Identifiers

Expose UUIDs, not sequential integers, in URLs and API responses. Sequential IDs enable trivial enumeration. UUIDs are not guessable.

### 7. Centralize Authorization Logic

Do not scatter permission checks across individual route handlers. Implement authorization in middleware, interceptors, or a dedicated policy engine. One change to the policy propagates everywhere.

### 8. Audit Every Access Decision

Log every authorization decision -- both grants and denials -- with the subject, action, resource, decision, and timestamp. These logs are essential for incident investigation and compliance.

### 9. Separate Authentication from Authorization

Authentication middleware verifies identity and produces a user context. Authorization middleware consumes the user context and checks permissions. These are distinct concerns -- do not combine them in a single middleware.

### 10. Test Authorization Exhaustively

Write tests that verify: (a) authorized users can access resources, (b) unauthorized users are denied, (c) cross-tenant access is blocked, (d) role escalation is blocked, (e) IDOR is prevented. Authorization bugs are silent -- they do not cause errors, they cause data breaches.

---

## Anti-Patterns -- 8 Common Mistakes

### 1. Missing Authorization Checks

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Endpoint has authentication but no authorization check | Any logged-in user can access any resource | Add authorization middleware to every endpoint |

### 2. Client-Side Authorization Only

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Permission checks in frontend JavaScript only | Attacker calls API directly, bypassing all checks | Enforce all authorization on the server |

### 3. IDOR -- Trusting Client-Provided IDs

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using user-supplied IDs without ownership verification | User A accesses User B's data by changing the ID | Include user_id/tenant_id in every query WHERE clause |

### 4. Fail-Open on Authorization Errors

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Authorization returns "allow" when the policy engine is unreachable | Service outage in authz system = everyone is admin | Default to deny on all errors, timeouts, and unexpected states |

### 5. Role Stored in Client-Controlled Token Without Verification

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Role claim in JWT is trusted without server-side verification against the database | Attacker modifies JWT role claim (if signing is weak or key is leaked) | Always verify roles against the authoritative source (database/IdP) for sensitive operations |

### 6. Overprivileged Default Roles

| Problem | Consequence | Fix |
|---------|-------------|-----|
| New users are assigned broad permissions by default | Users have access to resources they should not see | New users get the minimum viable role. Elevated access requires explicit grant |

### 7. No Tenant Isolation in Queries

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Database queries do not include tenant_id filter | Tenant A can see Tenant B's data | Include tenant_id in every query. Use PostgreSQL RLS as defense in depth |

### 8. Authorization Logic Scattered Across Codebase

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Permission checks duplicated in 50 different handler functions | Inconsistent enforcement -- some handlers check, some do not | Centralize authorization in middleware or a policy engine |

---

## Enforcement Checklist

### Authentication and Authorization Separation
- [ ] Authentication middleware only verifies identity and produces a user context
- [ ] Authorization middleware is a separate layer that checks permissions
- [ ] 401 is returned for authentication failures; 403 for authorization failures
- [ ] Both layers run on every request -- neither is optional

### RBAC / ABAC / Policy Implementation
- [ ] Roles and permissions are defined in a single source of truth
- [ ] Permission-role mapping is server-side, not in client code
- [ ] Role assignment changes take effect immediately (not cached indefinitely)
- [ ] Super-admin/god-mode accounts are disabled in production or require MFA + audit

### IDOR Prevention
- [ ] Every resource access includes ownership or tenant check in the query
- [ ] External identifiers use UUIDs, not sequential integers
- [ ] Unauthorized resource access returns 404, not 403
- [ ] Automated tests verify cross-user access is denied

### Horizontal Privilege Escalation Prevention
- [ ] Every query for user-specific data includes the authenticated user's ID
- [ ] Bulk operations are scoped to the user's own resources
- [ ] API responses do not include other users' IDs or metadata

### Vertical Privilege Escalation Prevention
- [ ] Admin endpoints require admin role verification server-side
- [ ] Role changes require a user with higher privilege to approve
- [ ] Self-elevation (changing your own role) is explicitly blocked
- [ ] Client-side role checks are NOT relied upon for security

### Multi-Tenancy
- [ ] Tenant ID is extracted from the server-validated JWT, never from query params
- [ ] Every database query includes tenant_id in the WHERE clause
- [ ] PostgreSQL RLS (or equivalent) enforces tenant isolation at the database level
- [ ] Cross-tenant API calls are blocked by middleware
- [ ] Tenant isolation is tested with automated cross-tenant access tests

### API Authorization
- [ ] Every endpoint has explicit authentication and authorization middleware
- [ ] Resource-level authorization checks ownership or sharing permissions
- [ ] Field-level authorization restricts sensitive fields based on role
- [ ] GraphQL resolvers enforce authorization per field, not just per query

### Broken Access Control Prevention
- [ ] Path traversal is prevented by validating resolved paths against allowed directories
- [ ] Force browsing is prevented by requiring auth on all routes, including admin routes
- [ ] CORS origins are explicitly allowlisted, not reflected or wildcarded
- [ ] JWT validation specifies a single allowed algorithm (no "none", no algorithm confusion)
- [ ] Security-critical fields (role, tenant_id) are never accepted from client input

### Centralized Authorization
- [ ] Authorization logic lives in middleware or a policy engine, not in individual handlers
- [ ] Policy changes propagate to all endpoints automatically
- [ ] Authorization decisions are audited with subject, action, resource, and outcome
- [ ] The authorization service fails closed on errors

### Audit and Monitoring
- [ ] Every authorization decision (allow and deny) is logged
- [ ] Audit logs include: who, what action, which resource, outcome, timestamp, IP
- [ ] Logs are stored in append-only, externally accessible storage
- [ ] Alerts fire on repeated authorization failures (brute force detection)
- [ ] Access reviews are conducted periodically -- unused permissions are revoked
