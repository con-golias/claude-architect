# Log Architecture & Standards

> **AI Plugin Directive — Structured Logging Architecture & Standards**
> You are an AI coding assistant. When generating, reviewing, or refactoring logging code,
> follow EVERY rule in this document. Unstructured logging makes debugging impossible,
> wastes storage, and hides critical issues. Treat each section as non-negotiable.

**Core Rule: ALWAYS use structured JSON logging — NEVER `console.log` or unstructured text. ALWAYS include requestId, userId, and operation in every log entry. ALWAYS use appropriate log levels. NEVER log sensitive data (passwords, tokens, PII). ALWAYS use a centralized logging pipeline.**

---

## 1. Logging Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Logging Pipeline                                  │
│                                                               │
│  Application                                                 │
│  ├── Structured JSON logger (pino/slog/structlog)           │
│  ├── Log levels: DEBUG < INFO < WARN < ERROR < FATAL        │
│  └── Context: requestId, userId, traceId, spanId            │
│                                                               │
│  Collection                                                  │
│  ├── stdout → container runtime collects                    │
│  ├── Fluentd/Fluent Bit → parse + enrich                   │
│  └── Vector/Logstash → transform + route                   │
│                                                               │
│  Storage & Query                                             │
│  ├── Elasticsearch + Kibana (ELK)                           │
│  ├── Loki + Grafana                                         │
│  ├── Datadog Logs                                           │
│  └── CloudWatch Logs / Cloud Logging                        │
│                                                               │
│  Rule: ALWAYS log to stdout (12-Factor)                     │
│  Rule: NEVER write log files from application               │
│  Rule: Let infrastructure handle collection + rotation      │
└──────────────────────────────────────────────────────────────┘
```

| Level | When to Use | Example |
|-------|------------|---------|
| **DEBUG** | Development details, verbose data | Query parameters, cache keys |
| **INFO** | Normal operations, milestones | Request handled, job completed |
| **WARN** | Recoverable issues, degradation | Retry triggered, cache miss fallback |
| **ERROR** | Failures requiring attention | Unhandled exception, dependency down |
| **FATAL** | Process must exit | Corrupt state, unrecoverable |

---

## 2. TypeScript Implementation (Pino)

```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level: (label) => ({ level: label }), // "info" not 30
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["password", "token", "authorization", "cookie", "*.password", "*.token"],
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,      // Stack trace serialization
    req: pino.stdSerializers.req,      // Request serialization
    res: pino.stdSerializers.res,
  },
});

// Request-scoped logger with context
function createRequestLogger(req: Request): pino.Logger {
  return logger.child({
    requestId: req.id,
    userId: req.user?.id,
    method: req.method,
    path: req.path,
    traceId: req.headers["x-trace-id"],
  });
}

// Middleware: attach logger to request
app.use((req, res, next) => {
  req.log = createRequestLogger(req);
  const start = Date.now();

  res.on("finish", () => {
    req.log.info({
      statusCode: res.statusCode,
      duration: Date.now() - start,
      contentLength: res.get("content-length"),
    }, "request completed");
  });

  next();
});

// Usage in handlers
async function getUser(req: Request, res: Response) {
  req.log.info({ userId: req.params.id }, "fetching user");

  const user = await userService.getById(req.params.id);
  if (!user) {
    req.log.warn({ userId: req.params.id }, "user not found");
    throw new NotFoundError("User", req.params.id);
  }

  req.log.info({ userId: user.id }, "user fetched");
  res.json(user);
}
```

---

## 3. Go Implementation (slog)

```go
import "log/slog"

func SetupLogger(env string) *slog.Logger {
    var handler slog.Handler
    if env == "production" {
        handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
            Level: slog.LevelInfo,
        })
    } else {
        handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
            Level: slog.LevelDebug,
        })
    }
    return slog.New(handler)
}

// Request-scoped logger via context
func RequestLogger(ctx context.Context) *slog.Logger {
    return slog.Default().With(
        "requestId", middleware.GetRequestID(ctx),
        "userId", auth.GetUserID(ctx),
        "traceId", trace.SpanFromContext(ctx).SpanContext().TraceID().String(),
    )
}

// Middleware
func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

        next.ServeHTTP(ww, r)

        slog.Info("request completed",
            "method", r.Method,
            "path", r.URL.Path,
            "status", ww.Status(),
            "duration", time.Since(start).Milliseconds(),
            "bytes", ww.BytesWritten(),
            "requestId", r.Header.Get("X-Request-ID"),
        )
    })
}

// Usage
func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    log := RequestLogger(ctx)
    log.Info("fetching user", "userId", id)

    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        log.Error("failed to fetch user", "userId", id, "error", err)
        return nil, err
    }
    return user, nil
}
```

---

## 4. Python Implementation (structlog)

```python
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

# Request middleware — bind context
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request.headers.get("x-request-id", str(uuid4())),
        method=request.method,
        path=request.url.path,
    )

    start = time.monotonic()
    response = await call_next(request)
    duration = (time.monotonic() - start) * 1000

    logger.info("request completed",
        status_code=response.status_code,
        duration_ms=round(duration, 1),
    )
    return response

# Usage
async def get_user(user_id: str):
    logger.info("fetching user", user_id=user_id)
    user = await user_repo.find_by_id(user_id)
    if not user:
        logger.warning("user not found", user_id=user_id)
        raise NotFoundError("User", user_id)
    return user
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `console.log(data)` | Unstructured, unsearchable | Structured JSON logger |
| Logging PII/secrets | GDPR violation, credential leak | Redact sensitive fields |
| No requestId | Cannot correlate logs | Attach requestId to every log |
| Logging everything at INFO | Noise, high storage cost | Appropriate levels |
| Writing to files | Rotation issues, lost on crash | stdout + infrastructure collection |
| String concatenation in logs | Performance hit even when disabled | Structured fields |

---

## 6. Enforcement Checklist

- [ ] Structured JSON logger used (pino/slog/structlog)
- [ ] Logs written to stdout (12-Factor)
- [ ] requestId included in every log entry
- [ ] Log levels used correctly (DEBUG/INFO/WARN/ERROR)
- [ ] Sensitive data redacted (passwords, tokens, PII)
- [ ] Request logging middleware records method, path, status, duration
- [ ] Child/scoped loggers carry request context
- [ ] Log sampling configured for high-volume paths
