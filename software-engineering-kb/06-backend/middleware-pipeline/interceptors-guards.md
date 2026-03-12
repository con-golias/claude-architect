# Interceptors & Guards

> **AI Plugin Directive — Route Guards, Interceptors & Decorator Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring interceptor and
> guard code, follow EVERY rule in this document. Interceptors and guards provide clean
> separation of cross-cutting concerns from business logic. Treat each section as non-negotiable.

**Core Rule: ALWAYS use guards for access control decisions (authentication, authorization, roles). ALWAYS use interceptors for request/response transformation. ALWAYS keep guards simple — return boolean or throw. NEVER mix access control with business logic in handlers.**

---

## 1. Guard vs Interceptor

```
┌──────────────────────────────────────────────────────────────┐
│              Guards vs Interceptors                           │
│                                                               │
│  GUARD: "Should this request be allowed?"                   │
│  ├── AuthGuard: Is the user authenticated?                  │
│  ├── RoleGuard: Does the user have the required role?       │
│  ├── OwnerGuard: Does the user own this resource?          │
│  └── Returns: boolean (allow/deny)                          │
│                                                               │
│  INTERCEPTOR: "Transform request or response"               │
│  ├── LoggingInterceptor: log request + response            │
│  ├── CacheInterceptor: return cached response if available  │
│  ├── TransformInterceptor: modify response shape           │
│  └── TimeoutInterceptor: enforce per-route timeout         │
│                                                               │
│  Order: Guard (allow?) → Interceptor (transform) → Handler │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation

```typescript
// Guard: composable access control
type Guard = (req: Request) => Promise<boolean>;

function requireAuth: Guard = async (req) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return false;
  try {
    req.user = await verifyToken(token);
    return true;
  } catch {
    return false;
  }
};

function requireRole(...roles: string[]): Guard {
  return async (req) => {
    if (!req.user) return false;
    return roles.some((role) => req.user.roles.includes(role));
  };
}

function requireOwner(getResourceUserId: (req: Request) => Promise<string>): Guard {
  return async (req) => {
    if (!req.user) return false;
    const ownerId = await getResourceUserId(req);
    return req.user.id === ownerId || req.user.roles.includes("admin");
  };
}

// Guard middleware factory
function guard(...guards: Guard[]): RequestHandler {
  return async (req, res, next) => {
    for (const g of guards) {
      if (!await g(req)) {
        throw new ForbiddenError("Access denied");
      }
    }
    next();
  };
}

// Usage
router.delete("/api/posts/:id",
  guard(requireAuth, requireOwner(async (req) => {
    const post = await postRepo.findById(req.params.id);
    return post?.userId ?? "";
  })),
  deletePostHandler,
);
```

```typescript
// Interceptor: wrap handler with pre/post processing
type Interceptor = (req: Request, res: Response, next: NextFunction) => void;

function cacheInterceptor(ttl: number): Interceptor {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();

    const key = `cache:${req.originalUrl}`;
    const cached = await redis.get(key);
    if (cached) {
      res.set("X-Cache", "HIT");
      return res.json(JSON.parse(cached));
    }

    // Capture response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      redis.set(key, JSON.stringify(body), "EX", ttl);
      res.set("X-Cache", "MISS");
      return originalJson(body);
    };

    next();
  };
}

function timeoutInterceptor(ms: number): Interceptor {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ error: { type: "GATEWAY_TIMEOUT" } });
      }
    }, ms);
    res.on("finish", () => clearTimeout(timer));
    next();
  };
}

router.get("/api/products",
  cacheInterceptor(300),        // Cache for 5 minutes
  timeoutInterceptor(10_000),   // 10s timeout
  listProductsHandler,
);
```

---

## 3. Go Implementation

```go
// Guard: middleware that blocks or allows
func RequireAuth(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
        if token == "" {
            writeError(w, 401, "Authentication required")
            return
        }

        user, err := verifyToken(token)
        if err != nil {
            writeError(w, 401, "Invalid token")
            return
        }

        ctx := context.WithValue(r.Context(), userKey, user)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user := GetUser(r.Context())
            if user == nil {
                writeError(w, 401, "Not authenticated")
                return
            }
            for _, role := range roles {
                if slices.Contains(user.Roles, role) {
                    next.ServeHTTP(w, r)
                    return
                }
            }
            writeError(w, 403, "Insufficient permissions")
        })
    }
}

// Usage
r.Group(func(r chi.Router) {
    r.Use(RequireAuth)
    r.Use(RequireRole("admin"))
    r.Get("/admin/users", adminHandler.ListUsers)
})
```

---

## 4. Python Implementation

```python
from functools import wraps

# Guard as dependency
async def require_auth(request: Request) -> User:
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    if not token:
        raise UnauthorizedError()
    return await verify_token(token)

def require_role(*roles: str):
    async def guard(user: User = Depends(require_auth)) -> User:
        if not any(r in user.roles for r in roles):
            raise ForbiddenError()
        return user
    return guard

# Interceptor as decorator
def cache_response(ttl: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"cache:{func.__name__}:{hash(str(kwargs))}"
            cached = await redis_client.get(key)
            if cached:
                return json.loads(cached)
            result = await func(*args, **kwargs)
            await redis_client.set(key, json.dumps(result), ex=ttl)
            return result
        return wrapper
    return decorator

@app.get("/api/products")
@cache_response(ttl=300)
async def list_products(user: User = Depends(require_auth)):
    return await product_service.list()

@app.get("/api/admin/users")
async def admin_users(user: User = Depends(require_role("admin"))):
    return await user_service.list_all()
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Auth check in every handler | Duplication, easy to forget | Guard middleware |
| Guard with business logic | Tightly coupled | Guard = access control only |
| Interceptor modifies business data | Hidden side effects | Transform only request/response shape |
| No composable guards | Cannot combine auth + role + owner | Chain guards |
| Cache interceptor for mutations | Stale data served | Cache GET only |
| Guard returns 500 instead of 401/403 | Bad client experience | Specific error codes |

---

## 6. Enforcement Checklist

- [ ] Guards used for all access control (auth, roles, ownership)
- [ ] Interceptors used for cross-cutting transformations (cache, timeout, logging)
- [ ] Guards are composable and chainable
- [ ] Guards return proper HTTP status (401/403)
- [ ] Cache interceptors only on GET requests
- [ ] Timeout interceptors configured per route as needed
- [ ] Guards are testable in isolation (no HTTP dependency)
