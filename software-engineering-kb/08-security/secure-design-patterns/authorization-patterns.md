# Authorization Design Patterns Guide

## Overview

Category: Secure Design Patterns
Scope: Authorization architecture, policy engines, and access control models
Audience: Backend engineers, security engineers, platform architects
Last Updated: 2025-06

## Purpose

Authorization determines what an authenticated user is allowed to do. This
guide covers the major authorization models -- RBAC, ABAC, ReBAC -- and the
policy engines that implement them. Correct authorization prevents privilege
escalation, unauthorized data access, and lateral movement within systems.

---

## Pattern 1: Role-Based Access Control (RBAC)

### Theory

RBAC assigns permissions to roles, then assigns roles to users. Users inherit
all permissions from their assigned roles. This model works well for systems
with clear organizational hierarchies and a moderate number of permission
combinations.

Key concepts:
- **Role**: A named collection of permissions (e.g., "admin", "editor", "viewer")
- **Permission**: A specific action on a specific resource (e.g., "document:write")
- **Role hierarchy**: Roles can inherit from other roles (admin inherits editor)
- **Separation of duties**: Critical operations require multiple roles

### TypeScript -- RBAC Implementation

```typescript
// Role and permission definitions
interface Permission {
  resource: string;
  action: string;
}

interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];  // Role hierarchy
}

const ROLES: Record<string, Role> = {
  viewer: {
    name: 'viewer',
    permissions: [
      { resource: 'document', action: 'read' },
      { resource: 'document', action: 'list' },
    ],
  },
  editor: {
    name: 'editor',
    permissions: [
      { resource: 'document', action: 'write' },
      { resource: 'document', action: 'update' },
    ],
    inherits: ['viewer'],  // Editor can also read and list
  },
  admin: {
    name: 'admin',
    permissions: [
      { resource: 'document', action: 'delete' },
      { resource: 'user', action: 'read' },
      { resource: 'user', action: 'write' },
      { resource: 'user', action: 'delete' },
      { resource: 'settings', action: 'update' },
    ],
    inherits: ['editor'],  // Admin inherits all editor + viewer permissions
  },
};

// Resolve all permissions for a role, including inherited
function resolvePermissions(roleName: string, visited = new Set<string>()): Permission[] {
  if (visited.has(roleName)) return [];  // Prevent cycles
  visited.add(roleName);

  const role = ROLES[roleName];
  if (!role) return [];

  let permissions = [...role.permissions];

  if (role.inherits) {
    for (const parentRole of role.inherits) {
      permissions = permissions.concat(resolvePermissions(parentRole, visited));
    }
  }

  return permissions;
}

// Check if a user has a specific permission
function hasPermission(
  user: { roles: string[] },
  resource: string,
  action: string
): boolean {
  for (const roleName of user.roles) {
    const permissions = resolvePermissions(roleName);
    if (permissions.some(p => p.resource === resource && p.action === action)) {
      return true;
    }
  }
  return false;
}

// Middleware implementation
function requirePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasPermission(req.user, resource, action)) {
      // Log the authorization failure for audit
      auditLog.warn('Authorization denied', {
        userId: req.user.id,
        roles: req.user.roles,
        resource,
        action,
        path: req.path,
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Usage
app.get('/api/documents', requirePermission('document', 'list'), listDocuments);
app.post('/api/documents', requirePermission('document', 'write'), createDocument);
app.delete('/api/documents/:id', requirePermission('document', 'delete'), deleteDocument);
```

### Go -- RBAC Middleware

```go
package rbac

import (
    "context"
    "net/http"
)

type Permission struct {
    Resource string
    Action   string
}

type Role struct {
    Name        string
    Permissions []Permission
    Inherits    []string
}

type RBACEngine struct {
    roles map[string]*Role
}

func NewRBACEngine() *RBACEngine {
    engine := &RBACEngine{roles: make(map[string]*Role)}

    engine.AddRole(&Role{
        Name: "viewer",
        Permissions: []Permission{
            {Resource: "document", Action: "read"},
            {Resource: "document", Action: "list"},
        },
    })

    engine.AddRole(&Role{
        Name: "editor",
        Permissions: []Permission{
            {Resource: "document", Action: "write"},
            {Resource: "document", Action: "update"},
        },
        Inherits: []string{"viewer"},
    })

    engine.AddRole(&Role{
        Name: "admin",
        Permissions: []Permission{
            {Resource: "document", Action: "delete"},
            {Resource: "user", Action: "manage"},
        },
        Inherits: []string{"editor"},
    })

    return engine
}

func (e *RBACEngine) AddRole(role *Role) {
    e.roles[role.Name] = role
}

func (e *RBACEngine) resolvePermissions(roleName string, visited map[string]bool) []Permission {
    if visited[roleName] {
        return nil
    }
    visited[roleName] = true

    role, ok := e.roles[roleName]
    if !ok {
        return nil
    }

    perms := make([]Permission, len(role.Permissions))
    copy(perms, role.Permissions)

    for _, parent := range role.Inherits {
        perms = append(perms, e.resolvePermissions(parent, visited)...)
    }

    return perms
}

func (e *RBACEngine) HasPermission(roles []string, resource, action string) bool {
    for _, roleName := range roles {
        visited := make(map[string]bool)
        perms := e.resolvePermissions(roleName, visited)
        for _, p := range perms {
            if p.Resource == resource && p.Action == action {
                return true
            }
        }
    }
    return false
}

func (e *RBACEngine) RequirePermission(resource, action string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user := getUserFromContext(r.Context())
            if user == nil {
                http.Error(w, `{"error":"Authentication required"}`, http.StatusUnauthorized)
                return
            }

            if !e.HasPermission(user.Roles, resource, action) {
                http.Error(w, `{"error":"Insufficient permissions"}`, http.StatusForbidden)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

### Python -- RBAC with Decorators

```python
from functools import wraps
from flask import request, jsonify, g

class RBACEngine:
    def __init__(self):
        self.roles: dict[str, dict] = {}

    def add_role(self, name: str, permissions: list[tuple[str, str]],
                 inherits: list[str] | None = None):
        self.roles[name] = {
            'permissions': set(permissions),
            'inherits': inherits or [],
        }

    def resolve_permissions(self, role_name: str,
                            visited: set | None = None) -> set[tuple[str, str]]:
        if visited is None:
            visited = set()
        if role_name in visited:
            return set()
        visited.add(role_name)

        role = self.roles.get(role_name)
        if not role:
            return set()

        perms = set(role['permissions'])
        for parent in role['inherits']:
            perms |= self.resolve_permissions(parent, visited)
        return perms

    def has_permission(self, user_roles: list[str],
                       resource: str, action: str) -> bool:
        for role_name in user_roles:
            perms = self.resolve_permissions(role_name)
            if (resource, action) in perms:
                return True
        return False

rbac = RBACEngine()
rbac.add_role('viewer', [('document', 'read'), ('document', 'list')])
rbac.add_role('editor', [('document', 'write'), ('document', 'update')],
              inherits=['viewer'])
rbac.add_role('admin', [('document', 'delete'), ('user', 'manage')],
              inherits=['editor'])

def require_permission(resource: str, action: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = g.get('current_user')
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            if not rbac.has_permission(user.roles, resource, action):
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route('/api/documents', methods=['POST'])
@require_permission('document', 'write')
def create_document():
    # Only editors and admins reach here
    pass
```

---

## Pattern 2: Attribute-Based Access Control (ABAC)

### Theory

ABAC makes access decisions based on attributes of the subject (user),
resource, action, and environment (time, location, device). ABAC is more
flexible than RBAC and can express complex policies like "allow access to
documents in the user's department during business hours."

Key concepts:
- **Subject attributes**: User role, department, clearance level, IP address
- **Resource attributes**: Owner, classification, department, creation date
- **Action attributes**: Read, write, delete, approve
- **Environment attributes**: Time of day, network location, device type

### TypeScript -- ABAC Policy Engine

```typescript
interface PolicyContext {
  subject: Record<string, any>;
  resource: Record<string, any>;
  action: string;
  environment: Record<string, any>;
}

interface Policy {
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  condition: (ctx: PolicyContext) => boolean;
  priority: number;  // Higher priority evaluated first
}

class ABACEngine {
  private policies: Policy[] = [];

  addPolicy(policy: Policy): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.priority - a.priority);
  }

  evaluate(ctx: PolicyContext): { allowed: boolean; matchedPolicy: string | null } {
    for (const policy of this.policies) {
      try {
        if (policy.condition(ctx)) {
          return {
            allowed: policy.effect === 'allow',
            matchedPolicy: policy.name,
          };
        }
      } catch (err) {
        // Policy evaluation error -- default deny
        console.error(`Policy "${policy.name}" evaluation error:`, err);
      }
    }

    // No matching policy -- default deny
    return { allowed: false, matchedPolicy: null };
  }
}

// Define policies
const engine = new ABACEngine();

// Deny policy: block access outside business hours for non-admins
engine.addPolicy({
  name: 'business-hours-only',
  description: 'Non-admins can only access during business hours',
  effect: 'deny',
  priority: 100,  // Evaluated first
  condition: (ctx) => {
    const hour = new Date().getHours();
    const isBusinessHours = hour >= 9 && hour < 17;
    const isAdmin = ctx.subject.role === 'admin';
    return !isBusinessHours && !isAdmin;
  },
});

// Allow policy: users can read documents in their department
engine.addPolicy({
  name: 'department-read',
  description: 'Users can read documents in their own department',
  effect: 'allow',
  priority: 50,
  condition: (ctx) => {
    return (
      ctx.action === 'read' &&
      ctx.resource.type === 'document' &&
      ctx.subject.department === ctx.resource.department
    );
  },
});

// Allow policy: document owner has full access
engine.addPolicy({
  name: 'owner-full-access',
  description: 'Document owners have full access',
  effect: 'allow',
  priority: 50,
  condition: (ctx) => {
    return (
      ctx.resource.type === 'document' &&
      ctx.resource.ownerId === ctx.subject.id
    );
  },
});

// Usage in middleware
function abacMiddleware(resourceLoader: (req: Request) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resource = await resourceLoader(req);
    const result = engine.evaluate({
      subject: {
        id: req.user.id,
        role: req.user.role,
        department: req.user.department,
      },
      resource: {
        type: resource.type,
        ownerId: resource.ownerId,
        department: resource.department,
        classification: resource.classification,
      },
      action: req.method === 'GET' ? 'read' : 'write',
      environment: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
      },
    });

    if (!result.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
}
```

---

## Pattern 3: Policy Engines

### OPA (Open Policy Agent) with Rego

OPA is a general-purpose policy engine that decouples policy from application
code. Policies are written in the Rego language.

```rego
# policy.rego -- OPA policy definition

package authz

import future.keywords.if
import future.keywords.in

# Default deny
default allow := false

# Allow admins to do anything
allow if {
    input.user.role == "admin"
}

# Allow users to read their own documents
allow if {
    input.action == "read"
    input.resource.type == "document"
    input.resource.owner_id == input.user.id
}

# Allow users to read documents in their department
allow if {
    input.action == "read"
    input.resource.type == "document"
    input.resource.department == input.user.department
}

# Allow editors to write documents in their department
allow if {
    input.action == "write"
    input.resource.type == "document"
    input.user.role == "editor"
    input.resource.department == input.user.department
}

# Deny access to classified documents unless user has clearance
deny if {
    input.resource.classification == "top_secret"
    input.user.clearance_level < 5
}

# Final decision: allow unless explicitly denied
result := {"allowed": allow, "denied": deny}
```

```go
// Go -- OPA integration
package authz

import (
    "context"
    "encoding/json"
    "fmt"

    "github.com/open-policy-agent/opa/rego"
)

type OPAClient struct {
    query rego.PreparedEvalQuery
}

func NewOPAClient(policyPath string) (*OPAClient, error) {
    ctx := context.Background()

    query, err := rego.New(
        rego.Query("data.authz.allow"),
        rego.Load([]string{policyPath}, nil),
    ).PrepareForEval(ctx)

    if err != nil {
        return nil, fmt.Errorf("failed to prepare OPA query: %w", err)
    }

    return &OPAClient{query: query}, nil
}

type AuthzInput struct {
    User     map[string]interface{} `json:"user"`
    Action   string                 `json:"action"`
    Resource map[string]interface{} `json:"resource"`
}

func (c *OPAClient) IsAllowed(ctx context.Context, input AuthzInput) (bool, error) {
    results, err := c.query.Eval(ctx, rego.EvalInput(input))
    if err != nil {
        return false, fmt.Errorf("OPA evaluation failed: %w", err)
    }

    if len(results) == 0 {
        return false, nil // Default deny
    }

    allowed, ok := results[0].Value.(bool)
    if !ok {
        return false, nil
    }

    return allowed, nil
}
```

### Casbin -- Model and Policy Definition

```ini
# model.conf -- Casbin model definition
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act, eft

[role_definition]
g = _, _
g2 = _, _

[policy_effect]
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))

[matchers]
m = g(r.sub, p.sub) && g2(r.obj, p.obj) && r.act == p.act
```

```csv
# policy.csv -- Casbin policy definition
p, admin, /api/*, *, allow
p, editor, /api/documents, GET, allow
p, editor, /api/documents, POST, allow
p, editor, /api/documents/*, PUT, allow
p, viewer, /api/documents, GET, allow
p, viewer, /api/documents/*, GET, allow

# Deny rules take precedence
p, viewer, /api/admin/*, *, deny

# Role assignments
g, alice, admin
g, bob, editor
g, charlie, viewer
```

```go
// Go -- Casbin integration
package authz

import (
    "net/http"

    "github.com/casbin/casbin/v2"
)

func CasbinMiddleware(enforcer *casbin.Enforcer) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user := getUserFromContext(r.Context())
            if user == nil {
                http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
                return
            }

            allowed, err := enforcer.Enforce(user.ID, r.URL.Path, r.Method)
            if err != nil {
                http.Error(w, `{"error":"Authorization error"}`, http.StatusInternalServerError)
                return
            }

            if !allowed {
                http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

### Cedar (AWS) -- Entity-Based Policies

```cedar
// Cedar policy language (used by AWS Verified Permissions)

// Allow any user to read public documents
permit (
    principal,
    action == Action::"ReadDocument",
    resource
)
when {
    resource.visibility == "public"
};

// Allow document owners full access
permit (
    principal,
    action in [Action::"ReadDocument", Action::"UpdateDocument", Action::"DeleteDocument"],
    resource
)
when {
    principal == resource.owner
};

// Allow editors to update documents in their group
permit (
    principal is User,
    action == Action::"UpdateDocument",
    resource is Document
)
when {
    principal.role == "editor" &&
    principal.group == resource.group
};

// Deny access to archived documents (overrides allows)
forbid (
    principal,
    action,
    resource is Document
)
when {
    resource.status == "archived"
};
```

---

## Pattern 4: Google Zanzibar Model (ReBAC)

### Theory

Google Zanzibar is a relationship-based access control (ReBAC) system. Access
decisions are based on relationships between entities stored as tuples.
A tuple has the form: `(user, relation, object)`.

For example: `(user:alice, viewer, document:readme)` means Alice is a viewer
of document "readme."

Key concepts:
- **Relationship tuples**: The fundamental data structure
- **Check API**: "Does user X have relation Y to object Z?"
- **Expand API**: "Who has relation Y to object Z?"
- **Namespace configuration**: Defines valid relations and how they compose

### Relationship Tuple Examples

```
# Direct relationships
user:alice#viewer@document:readme
user:bob#editor@document:readme
user:carol#owner@document:readme

# Group membership
user:alice#member@group:engineering
user:bob#member@group:engineering

# Group-based access (engineering group can view document)
group:engineering#member@document:readme#viewer

# Hierarchical: folder contains document
document:readme#parent@folder:projects

# Inherited: viewers of folder are viewers of contained documents
```

### TypeScript -- Zanzibar-Style Implementation

```typescript
interface RelationTuple {
  user: string;       // "user:alice" or "group:engineering#member"
  relation: string;   // "viewer", "editor", "owner"
  object: string;     // "document:readme"
}

interface NamespaceConfig {
  relations: Record<string, RelationConfig>;
}

interface RelationConfig {
  // Union: user has this relation if they have ANY of the listed relations
  union?: string[];
  // Intersection: user has this relation if they have ALL of the listed relations
  intersection?: string[];
  // Computed userset: derive from another relation on a related object
  computedUserset?: { relation: string };
  // Tuple-to-userset: follow a relation to another object
  tupleToUserset?: { tuplesetRelation: string; computedRelation: string };
}

class ZanzibarEngine {
  private tuples: RelationTuple[] = [];
  private namespaces: Record<string, NamespaceConfig> = {};

  addTuple(tuple: RelationTuple): void {
    this.tuples.push(tuple);
  }

  removeTuple(tuple: RelationTuple): void {
    this.tuples = this.tuples.filter(
      t => !(t.user === tuple.user &&
             t.relation === tuple.relation &&
             t.object === tuple.object)
    );
  }

  // Check API: Does user have relation to object?
  check(user: string, relation: string, object: string): boolean {
    // Direct check
    const directMatch = this.tuples.some(
      t => t.user === user && t.relation === relation && t.object === object
    );
    if (directMatch) return true;

    // Check via groups
    const userGroups = this.tuples
      .filter(t => t.user === user && t.relation === 'member')
      .map(t => t.object);

    for (const group of userGroups) {
      const groupAccess = this.tuples.some(
        t => t.user === `${group}#member` &&
             t.relation === relation &&
             t.object === object
      );
      if (groupAccess) return true;
    }

    // Check hierarchical (parent relation)
    const parents = this.tuples
      .filter(t => t.object === object && t.relation === 'parent')
      .map(t => t.user);

    for (const parent of parents) {
      if (this.check(user, relation, parent)) return true;
    }

    return false;
  }

  // Expand API: Who has this relation to this object?
  expand(relation: string, object: string): string[] {
    const users: Set<string> = new Set();

    // Direct users
    this.tuples
      .filter(t => t.relation === relation && t.object === object)
      .forEach(t => {
        if (t.user.includes('#member')) {
          // Expand group membership
          const group = t.user.split('#')[0];
          this.tuples
            .filter(gt => gt.object === group && gt.relation === 'member')
            .forEach(gt => users.add(gt.user));
        } else {
          users.add(t.user);
        }
      });

    return Array.from(users);
  }
}

// Usage
const engine = new ZanzibarEngine();

// Set up relationships
engine.addTuple({ user: 'user:alice', relation: 'owner', object: 'document:readme' });
engine.addTuple({ user: 'user:bob', relation: 'editor', object: 'document:readme' });
engine.addTuple({ user: 'user:alice', relation: 'member', object: 'group:engineering' });
engine.addTuple({ user: 'group:engineering#member', relation: 'viewer', object: 'folder:projects' });

// Check access
console.log(engine.check('user:alice', 'owner', 'document:readme'));   // true
console.log(engine.check('user:bob', 'owner', 'document:readme'));     // false
console.log(engine.check('user:bob', 'editor', 'document:readme'));    // true

// Expand: who can view the project folder?
console.log(engine.expand('viewer', 'folder:projects'));  // ['user:alice']
```

### SpiceDB / Authzed Integration

```go
// Go -- SpiceDB client integration
package authz

import (
    "context"
    "fmt"

    v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
    "github.com/authzed/authzed-go/v1"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
)

type SpiceDBClient struct {
    client *authzed.Client
}

func NewSpiceDBClient(endpoint, token string) (*SpiceDBClient, error) {
    client, err := authzed.NewClient(
        endpoint,
        grpc.WithTransportCredentials(insecure.NewCredentials()),
        authzed.WithInsecureBearerToken(token),
    )
    if err != nil {
        return nil, err
    }
    return &SpiceDBClient{client: client}, nil
}

// WriteRelationship stores a relationship tuple
func (s *SpiceDBClient) WriteRelationship(ctx context.Context,
    resourceType, resourceID, relation, subjectType, subjectID string) error {

    _, err := s.client.WriteRelationships(ctx, &v1.WriteRelationshipsRequest{
        Updates: []*v1.RelationshipUpdate{
            {
                Operation: v1.RelationshipUpdate_OPERATION_TOUCH,
                Relationship: &v1.Relationship{
                    Resource: &v1.ObjectReference{
                        ObjectType: resourceType,
                        ObjectId:   resourceID,
                    },
                    Relation: relation,
                    Subject: &v1.SubjectReference{
                        Object: &v1.ObjectReference{
                            ObjectType: subjectType,
                            ObjectId:   subjectID,
                        },
                    },
                },
            },
        },
    })
    return err
}

// CheckPermission verifies if subject has permission on resource
func (s *SpiceDBClient) CheckPermission(ctx context.Context,
    resourceType, resourceID, permission, subjectType, subjectID string) (bool, error) {

    resp, err := s.client.CheckPermission(ctx, &v1.CheckPermissionRequest{
        Resource: &v1.ObjectReference{
            ObjectType: resourceType,
            ObjectId:   resourceID,
        },
        Permission: permission,
        Subject: &v1.SubjectReference{
            Object: &v1.ObjectReference{
                ObjectType: subjectType,
                ObjectId:   subjectID,
            },
        },
        Consistency: &v1.Consistency{
            Requirement: &v1.Consistency_FullyConsistent{FullyConsistent: true},
        },
    })
    if err != nil {
        return false, err
    }

    return resp.Permissionship == v1.CheckPermissionResponse_PERMISSIONSHIP_HAS_PERMISSION, nil
}
```

```yaml
# SpiceDB schema definition
schema: |
  definition user {}

  definition group {
    relation member: user
  }

  definition folder {
    relation viewer: user | group#member
    relation editor: user | group#member
    relation owner: user

    permission view = viewer + editor + owner
    permission edit = editor + owner
    permission delete = owner
  }

  definition document {
    relation parent: folder
    relation viewer: user | group#member
    relation editor: user | group#member
    relation owner: user

    // Inherit permissions from parent folder
    permission view = viewer + editor + owner + parent->view
    permission edit = editor + owner + parent->edit
    permission delete = owner
  }
```

---

## Pattern 5: Centralized vs Distributed Authorization

### Centralized Authorization (API Gateway)

```typescript
// API Gateway authorization -- single enforcement point
// All requests pass through the gateway before reaching services

class APIGatewayAuthorizer {
  private policyEngine: ABACEngine;

  async authorize(req: GatewayRequest): Promise<AuthzDecision> {
    const user = await this.resolveUser(req.token);
    const route = this.matchRoute(req.path, req.method);

    if (!route) {
      return { allowed: false, reason: 'Unknown route' };
    }

    const decision = this.policyEngine.evaluate({
      subject: user,
      resource: { type: route.resourceType, ...route.attributes },
      action: route.action,
      environment: { ip: req.ip, timestamp: new Date() },
    });

    // Cache decision for short period
    await this.cacheDecision(user.id, route.key, decision, 60);

    return decision;
  }
}
```

### Distributed Authorization (Service-Level)

```typescript
// Each service enforces its own authorization
// Use when services need resource-specific authorization logic

class DocumentService {
  private authzClient: OPAClient;

  async getDocument(userId: string, documentId: string): Promise<Document> {
    const document = await this.repository.findById(documentId);

    // Service knows the resource attributes
    const allowed = await this.authzClient.check({
      user: { id: userId },
      action: 'read',
      resource: {
        type: 'document',
        id: document.id,
        ownerId: document.ownerId,
        department: document.department,
        classification: document.classification,
      },
    });

    if (!allowed) {
      throw new ForbiddenError('Access denied');
    }

    return document;
  }
}
```

### Sidecar Authorization (OPA Sidecar)

```yaml
# Kubernetes deployment with OPA sidecar
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  template:
    spec:
      containers:
        - name: api-server
          image: api-server:latest
          ports:
            - containerPort: 8080
        - name: opa-sidecar
          image: openpolicyagent/opa:latest
          args:
            - "run"
            - "--server"
            - "--addr=localhost:8181"
            - "--set=decision_logs.console=true"
            - "/policies"
          ports:
            - containerPort: 8181
          volumeMounts:
            - name: policy-volume
              mountPath: /policies
      volumes:
        - name: policy-volume
          configMap:
            name: opa-policies
```

---

## Pattern 6: Permission Checking Patterns

### Query-Level Filtering

```typescript
// Filter database queries based on user permissions
// Do not load all records and filter in application code

class DocumentRepository {
  async findAccessible(user: User, filters: QueryFilters): Promise<Document[]> {
    const query = this.db('documents')
      .select('documents.*')
      .where(filters);

    if (user.role === 'admin') {
      // Admins see everything -- no additional filter
      return query;
    }

    // Apply permission-based filtering at the query level
    query.where(function () {
      this
        // User owns the document
        .where('documents.owner_id', user.id)
        // User's department matches
        .orWhere('documents.department', user.department)
        // Document is public
        .orWhere('documents.visibility', 'public')
        // User has explicit access via document_permissions table
        .orWhereExists(function () {
          this.select('1')
            .from('document_permissions')
            .whereRaw('document_permissions.document_id = documents.id')
            .where('document_permissions.user_id', user.id);
        });
    });

    return query;
  }
}
```

### Field-Level Authorization

```typescript
// Control which fields a user can see or modify

interface FieldPolicy {
  field: string;
  readRoles: string[];
  writeRoles: string[];
}

const userFieldPolicies: FieldPolicy[] = [
  { field: 'id', readRoles: ['*'], writeRoles: [] },
  { field: 'name', readRoles: ['*'], writeRoles: ['self', 'admin'] },
  { field: 'email', readRoles: ['self', 'admin'], writeRoles: ['self', 'admin'] },
  { field: 'role', readRoles: ['admin'], writeRoles: ['admin'] },
  { field: 'salary', readRoles: ['admin', 'hr'], writeRoles: ['admin'] },
  { field: 'ssn', readRoles: ['hr'], writeRoles: [] },
];

function filterFields<T extends Record<string, any>>(
  data: T,
  policies: FieldPolicy[],
  userRole: string,
  isSelf: boolean,
): Partial<T> {
  const filtered: Partial<T> = {};

  for (const policy of policies) {
    const roles = [...policy.readRoles];
    if (isSelf && policy.readRoles.includes('self')) {
      roles.push(userRole);
    }

    if (roles.includes('*') || roles.includes(userRole)) {
      (filtered as any)[policy.field] = data[policy.field];
    }
  }

  return filtered;
}
```

---

## Pattern 7: Multi-Tenancy Authorization

```typescript
// Every query must be scoped to the user's tenant
// This is the most critical authorization rule in multi-tenant systems

class TenantScopedRepository<T> {
  constructor(
    private db: Database,
    private tableName: string,
  ) {}

  // Every method requires tenantId -- never optional
  async findById(tenantId: string, id: string): Promise<T | null> {
    return this.db(this.tableName)
      .where({ id, tenant_id: tenantId })
      .first();
  }

  async findAll(tenantId: string, filters: Record<string, any> = {}): Promise<T[]> {
    return this.db(this.tableName)
      .where({ ...filters, tenant_id: tenantId });
  }

  async create(tenantId: string, data: Partial<T>): Promise<T> {
    return this.db(this.tableName)
      .insert({ ...data, tenant_id: tenantId })
      .returning('*');
  }

  async update(tenantId: string, id: string, data: Partial<T>): Promise<T> {
    const result = await this.db(this.tableName)
      .where({ id, tenant_id: tenantId })  // ALWAYS scope by tenant
      .update(data)
      .returning('*');

    if (result.length === 0) {
      throw new NotFoundError('Resource not found');  // Could be wrong tenant
    }
    return result[0];
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const deleted = await this.db(this.tableName)
      .where({ id, tenant_id: tenantId })  // ALWAYS scope by tenant
      .delete();

    if (deleted === 0) {
      throw new NotFoundError('Resource not found');
    }
  }
}

// Middleware injects tenant context
function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'No tenant context' });
  }
  req.tenantId = tenantId;
  next();
}
```

---

## Pattern 8: Caching Authorization Decisions

```typescript
// Cache authorization decisions to avoid repeated policy evaluation
// Be careful with cache TTL -- stale cache = stale permissions

class CachedAuthorizer {
  constructor(
    private authorizer: Authorizer,
    private cache: Redis,
    private defaultTTL: number = 60,  // 60 seconds
  ) {}

  async check(userId: string, resource: string, action: string): Promise<boolean> {
    const cacheKey = `authz:${userId}:${resource}:${action}`;

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    // Evaluate policy
    const allowed = await this.authorizer.check(userId, resource, action);

    // Cache the decision with short TTL
    await this.cache.setex(cacheKey, this.defaultTTL, allowed.toString());

    return allowed;
  }

  // Invalidate cache when permissions change
  async invalidateUser(userId: string): Promise<void> {
    const keys = await this.cache.keys(`authz:${userId}:*`);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }

  // Invalidate all cached decisions for a resource
  async invalidateResource(resource: string): Promise<void> {
    const keys = await this.cache.keys(`authz:*:${resource}:*`);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }
}
```

---

## Pattern 9: Audit Logging Authorization Decisions

```typescript
interface AuthzAuditLog {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  decision: 'allow' | 'deny';
  reason: string;
  matchedPolicy: string | null;
  ip: string;
  userAgent: string;
  correlationId: string;
}

class AuditableAuthorizer {
  constructor(
    private authorizer: Authorizer,
    private auditLogger: AuditLogger,
  ) {}

  async check(ctx: RequestContext, resource: string, action: string): Promise<boolean> {
    const startTime = Date.now();
    const decision = await this.authorizer.check(ctx.userId, resource, action);
    const duration = Date.now() - startTime;

    const auditEntry: AuthzAuditLog = {
      timestamp: new Date().toISOString(),
      userId: ctx.userId,
      action,
      resource,
      resourceId: ctx.resourceId,
      decision: decision ? 'allow' : 'deny',
      reason: decision ? 'Policy matched' : 'No matching allow policy',
      matchedPolicy: null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    };

    // Always log denials, optionally log allows
    if (!decision) {
      this.auditLogger.warn('Authorization denied', auditEntry);
    } else {
      this.auditLogger.info('Authorization allowed', auditEntry);
    }

    // Track metrics
    metrics.histogram('authz.check.duration', duration);
    metrics.increment(`authz.decision.${decision ? 'allow' : 'deny'}`);

    return decision;
  }
}
```

---

## Best Practices

1. **Default to deny**: Every authorization system must deny access when no
   explicit rule matches. Never default to allow.

2. **Enforce at every layer**: Apply authorization at the API gateway, service
   layer, and database query layer. Do not rely on a single enforcement point.

3. **Use query-level filtering**: Filter data in database queries, not in
   application code. Loading all records and filtering in memory is wasteful
   and error-prone.

4. **Scope all queries by tenant**: In multi-tenant systems, every database
   query must include the tenant identifier. Use repository patterns that
   make tenant omission impossible.

5. **Audit every decision**: Log all authorization decisions (both allow and
   deny) with sufficient context for forensic investigation.

6. **Cache with short TTL**: Cache authorization decisions for performance,
   but use short TTLs (60 seconds or less) and invalidate on permission changes.

7. **Separate authentication from authorization**: Authentication verifies
   identity. Authorization verifies permissions. Do not conflate them.

8. **Use policy engines for complex rules**: When authorization logic exceeds
   simple role checks, use a dedicated policy engine (OPA, Casbin, Cedar)
   rather than embedding logic in application code.

9. **Test authorization exhaustively**: Write unit tests for every permission
   combination. Test both positive (access granted) and negative (access denied)
   cases. Test boundary conditions and role transitions.

10. **Review authorization changes carefully**: Changes to authorization policies
    have the widest blast radius. Require security review for any changes to
    role definitions, policy rules, or permission mappings.

---

## Anti-Patterns

1. **Client-side authorization**: Hiding UI elements without server-side
   enforcement. The server must always verify permissions regardless of what
   the client displays.

2. **Role explosion**: Creating a new role for every permission combination
   instead of using ABAC or permission groups. This leads to hundreds of
   roles that are impossible to manage.

3. **Hardcoded roles in business logic**: Embedding role names like
   `if (user.role === 'admin')` throughout application code. Use permission
   checks instead: `if (hasPermission(user, 'document', 'delete'))`.

4. **Implicit permissions**: Assuming that because a user can read a resource,
   they can also write to it. Every action must have an explicit permission
   check.

5. **IDOR (Insecure Direct Object Reference)**: Accessing resources by ID
   without verifying that the requesting user has permission to access that
   specific resource instance.

6. **Missing tenant isolation**: Allowing users to access resources belonging
   to other tenants by manipulating request parameters. Always enforce tenant
   scoping.

7. **Stale permission cache**: Caching authorization decisions for too long.
   When permissions are revoked, cached decisions continue to allow access
   until the cache expires.

8. **All-or-nothing authorization**: Only checking "is the user logged in?"
   without granular permission checks. Every endpoint needs specific
   permission validation.

---

## Enforcement Checklist

### Design
- [ ] Authorization model is documented (RBAC, ABAC, ReBAC, or hybrid)
- [ ] Default deny is implemented -- no access without explicit grant
- [ ] Role hierarchy is defined and documented
- [ ] Multi-tenancy isolation is enforced at every layer

### Implementation
- [ ] Authorization is enforced server-side (not just client-side)
- [ ] Every API endpoint has explicit permission checks
- [ ] Database queries are scoped by tenant and user permissions
- [ ] Field-level authorization is implemented for sensitive fields
- [ ] IDOR prevention is in place for all resource access

### Policy Engine
- [ ] Policy definitions are version-controlled
- [ ] Policy changes require security review
- [ ] Policy evaluation errors result in deny
- [ ] Policy engine is tested with comprehensive test cases

### Operational
- [ ] All authorization decisions are audit logged
- [ ] Authorization metrics are tracked (allow/deny rates, latency)
- [ ] Cache invalidation is triggered on permission changes
- [ ] Regular access reviews are scheduled
- [ ] Privilege escalation paths are documented and monitored

### Testing
- [ ] Positive authorization tests (access granted when it should be)
- [ ] Negative authorization tests (access denied when it should be)
- [ ] Boundary tests (role transitions, tenant boundaries)
- [ ] Performance tests (authorization latency under load)
- [ ] Integration tests with policy engine
