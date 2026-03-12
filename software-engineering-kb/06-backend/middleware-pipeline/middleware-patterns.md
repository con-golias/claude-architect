# Middleware Patterns

> **AI Plugin Directive — Middleware Architecture, Chaining & Common Middleware**
> You are an AI coding assistant. When generating, reviewing, or refactoring middleware code,
> follow EVERY rule in this document. Middleware order determines security, performance, and
> correctness of the request pipeline. Treat each section as non-negotiable.

**Core Rule: ALWAYS order middleware correctly — security before business logic, logging before everything. ALWAYS keep middleware single-responsibility. ALWAYS make middleware composable and reusable. NEVER put business logic in middleware — middleware handles cross-cutting concerns only.**

---

## 1. Middleware Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Middleware Pipeline Order                         │
│                                                               │
│  Request → [Middleware Chain] → Handler → [Reverse Chain] → Response
│                                                               │
│  MUST be in this order:                                      │
│  1. Request ID generation                                    │
│  2. Logging (request start)                                  │
│  3. Metrics (timing start)                                   │
│  4. CORS headers                                             │
│  5. Security headers (Helmet)                                │
│  6. Rate limiting                                            │
│  7. Body parsing (JSON/form)                                 │
│  8. Authentication (verify token)                            │
│  9. Authorization (check permissions)                        │
│  10. Validation (request schema)                             │
│  11. → Route Handler (business logic)                       │
│  12. Error handler (global catch-all)                        │
│  13. Logging (request end + duration)                        │
│  14. Metrics (timing end)                                    │
│                                                               │
│  Rule: Security middleware ALWAYS runs before handlers       │
│  Rule: Error handler ALWAYS registered last                  │
│  Rule: Logging wraps everything (first in, last out)        │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation (Express)

```typescript
import express from "express";
import helmet from "helmet";
import cors from "cors";

const app = express();

// 1. Request ID
app.use((req, _res, next) => {
  req.id = req.headers["x-request-id"] as string ?? randomUUID();
  next();
});

// 2. Logging
app.use(requestLogger());

// 3. Metrics
app.use(metricsMiddleware());

// 4. CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(","),
  credentials: true,
  maxAge: 86400,
}));

// 5. Security headers
app.use(helmet());

// 6. Rate limiting
app.use(rateLimiter({ windowMs: 60_000, max: 100 }));

// 7. Body parsing
app.use(express.json({ limit: "1mb" }));

// 8-11. Routes (auth + validation inside route-specific middleware)
app.use("/api", apiRouter);

// 12. Error handler (MUST be last)
app.use(globalErrorHandler);

// Composable middleware factory
function requireAuth(...roles: string[]): RequestHandler[] {
  return [
    authenticateToken,      // Verify JWT
    ...(roles.length > 0 ? [authorize(roles)] : []),
  ];
}

// Route with composed middleware
router.get("/admin/users",
  ...requireAuth("admin"),
  validateQuery(listUsersSchema),
  listUsersHandler,
);
```

---

## 3. Go Implementation (Chi/stdlib)

```go
func SetupRouter(deps *Dependencies) http.Handler {
    r := chi.NewRouter()

    // Middleware in order
    r.Use(middleware.RequestID)         // 1. Request ID
    r.Use(LoggingMiddleware)           // 2. Logging
    r.Use(MetricsMiddleware)           // 3. Metrics
    r.Use(CORSMiddleware)             // 4. CORS
    r.Use(SecurityHeadersMiddleware)   // 5. Security
    r.Use(RateLimitMiddleware(100))    // 6. Rate limit
    r.Use(middleware.Recoverer)        // Panic recovery

    // Public routes (no auth)
    r.Post("/auth/login", deps.AuthHandler.Login)
    r.Get("/health/live", deps.HealthHandler.Liveness)

    // Protected routes
    r.Group(func(r chi.Router) {
        r.Use(AuthMiddleware)          // 8. Authentication
        r.Get("/api/users/{id}", deps.UserHandler.Get)

        // Admin-only
        r.Group(func(r chi.Router) {
            r.Use(RequireRole("admin")) // 9. Authorization
            r.Get("/api/admin/users", deps.AdminHandler.ListUsers)
        })
    })

    return r
}

// Middleware signature in Go
type Middleware func(http.Handler) http.Handler

func SecurityHeadersMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-XSS-Protection", "0")
        w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        w.Header().Set("Content-Security-Policy", "default-src 'self'")
        next.ServeHTTP(w, r)
    })
}
```

---

## 4. Python Implementation (FastAPI)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()

# Middleware added in reverse order (last added = first executed)
app.add_middleware(CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request.state.request_id = request.headers.get("x-request-id", str(uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration = (time.monotonic() - start) * 1000
    logger.info("request", extra={
        "method": request.method, "path": request.url.path,
        "status": response.status_code, "duration_ms": round(duration, 1),
    })
    return response

# Dependency injection for auth (route-level middleware)
async def require_auth(request: Request) -> User:
    token = request.headers.get("authorization", "").replace("Bearer ", "")
    if not token:
        raise UnauthorizedError()
    return await verify_token(token)

@app.get("/api/users/me")
async def get_me(user: User = Depends(require_auth)):
    return user
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Auth after body parsing | Unauthenticated users consume resources | Auth before heavy middleware |
| Business logic in middleware | Hard to test, tightly coupled | Middleware = cross-cutting only |
| Wrong middleware order | Security bypass, broken logging | Follow defined order |
| Middleware modifies request body | Side effects, hard to debug | Use context/locals, not body mutation |
| No error handler middleware | Unhandled errors crash server | Global error handler last |
| Monolithic middleware | Does too many things | Single-responsibility per middleware |

---

## 6. Enforcement Checklist

- [ ] Middleware ordered: request ID → logging → security → auth → handler → error
- [ ] Security headers middleware applied globally
- [ ] CORS configured with explicit origins (not `*` in production)
- [ ] Rate limiting applied before authentication
- [ ] Body parsing has size limits configured
- [ ] Error handler registered as last middleware
- [ ] Auth middleware only on protected routes
- [ ] Middleware is single-responsibility and composable
