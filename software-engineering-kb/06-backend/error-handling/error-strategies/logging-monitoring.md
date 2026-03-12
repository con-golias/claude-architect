# Error Logging & Monitoring

> **AI Plugin Directive — Error Logging, Alerting & Incident Detection**
> You are an AI coding assistant. When generating, reviewing, or refactoring error logging
> and monitoring code, follow EVERY rule in this document. Poor error logging means undetected
> failures, impossible debugging, and slow incident response. Treat each section as non-negotiable.

**Core Rule: ALWAYS log errors with structured context (requestId, userId, operation, error chain). ALWAYS track error rates as metrics. ALWAYS alert on error rate anomalies. NEVER log sensitive data (passwords, tokens, PII) in error messages.**

---

## 1. Structured Error Logging

```typescript
// ALWAYS include context in error logs
function logError(error: Error, context: Record<string, unknown>): void {
  const isOperational = error instanceof AppError && error.isOperational;

  logger[isOperational ? "warn" : "error"]({
    // Error details
    error: {
      name: error.name,
      message: error.message,
      code: error instanceof AppError ? error.code : undefined,
      stack: error.stack,
      cause: error.cause ? String(error.cause) : undefined,
    },
    // Request context
    requestId: context.requestId,
    userId: context.userId,
    path: context.path,
    method: context.method,
    // Operation context
    operation: context.operation,
    duration: context.duration,
    // Classification
    severity: isOperational ? "warn" : "error",
    operational: isOperational,
  });
}

// Usage in error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logError(err, {
    requestId: req.id,
    userId: req.user?.id,
    path: req.path,
    method: req.method,
    operation: "http_request",
  });
  // ... send response
});
```

```go
func logError(err error, ctx context.Context, attrs ...slog.Attr) {
    requestID := middleware.GetRequestID(ctx)
    userID := auth.GetUserID(ctx)

    var appErr *AppError
    isOperational := errors.As(err, &appErr) && appErr.Operational

    level := slog.LevelError
    if isOperational {
        level = slog.LevelWarn
    }

    slog.LogAttrs(ctx, level, err.Error(),
        slog.String("requestId", requestID),
        slog.String("userId", userID),
        slog.Bool("operational", isOperational),
        slog.String("stack", string(debug.Stack())),
    )
}
```

---

## 2. Error Rate Metrics

```typescript
// Track error metrics for alerting
function trackErrorMetrics(err: Error, req: Request): void {
  const labels = {
    status: err instanceof AppError ? String(err.statusCode) : "500",
    code: err instanceof AppError ? err.code : "UNHANDLED",
    path: normalizePathForMetrics(req.path), // /users/:id, not /users/123
    method: req.method,
  };

  metrics.increment("http.errors.total", labels);

  if (!(err instanceof AppError) || !err.isOperational) {
    metrics.increment("http.errors.unhandled", labels);
  }
}

// Normalize paths to prevent high-cardinality metrics
function normalizePathForMetrics(path: string): string {
  return path
    .replace(/\/[0-9a-f-]{36}/g, "/:uuid")  // UUID params
    .replace(/\/\d+/g, "/:id");               // Numeric params
}
```

| Metric | Alert Condition | Action |
|--------|----------------|--------|
| `http.errors.total` rate | > 5% of requests | Investigate |
| `http.errors.unhandled` rate | > 0.1% of requests | Page on-call |
| Error rate spike | 3x normal in 5 min | Automatic alert |
| 5xx error rate | > 1% sustained | Page on-call |
| Single error code spike | 10x normal | Investigate specific error |

---

## 3. Error Tracking Integration

```typescript
// Sentry integration for error tracking
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,          // 10% of transactions
  beforeSend(event) {
    // Scrub sensitive data
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    if (event.request?.data) {
      event.request.data = scrubSensitiveFields(event.request.data);
    }
    return event;
  },
  ignoreErrors: [
    "NotFoundError",       // Don't send 404s to Sentry
    "ValidationError",     // Don't send validation errors
    "UnauthorizedError",   // Don't send auth failures
  ],
});

// In error handler: capture unhandled errors
if (!(err instanceof AppError) || !err.isOperational) {
  Sentry.withScope((scope) => {
    scope.setUser({ id: req.user?.id });
    scope.setTag("requestId", req.id);
    scope.setContext("request", {
      path: req.path,
      method: req.method,
      query: req.query,
    });
    Sentry.captureException(err);
  });
}
```

```go
import "github.com/getsentry/sentry-go"

sentry.Init(sentry.ClientOptions{
    Dsn:              os.Getenv("SENTRY_DSN"),
    Environment:      os.Getenv("APP_ENV"),
    TracesSampleRate: 0.1,
    BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
        // Scrub sensitive headers
        if event.Request != nil {
            delete(event.Request.Headers, "Authorization")
            delete(event.Request.Headers, "Cookie")
        }
        return event
    },
})
```

---

## 4. Log Sanitization

```typescript
// NEVER log these fields
const SENSITIVE_FIELDS = new Set([
  "password", "passwordHash", "secret", "token",
  "apiKey", "authorization", "cookie", "ssn",
  "creditCard", "cardNumber", "cvv",
]);

function scrubSensitiveFields(data: any): any {
  if (!data || typeof data !== "object") return data;

  const scrubbed: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      scrubbed[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      scrubbed[key] = scrubSensitiveFields(value);
    } else {
      scrubbed[key] = value;
    }
  }
  return scrubbed;
}
```

- NEVER log passwords, tokens, API keys, credit card numbers
- ALWAYS scrub sensitive fields before logging error context
- ALWAYS scrub request bodies in error tracking tools (Sentry, Datadog)
- ALWAYS redact Authorization and Cookie headers from error reports

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `console.log(error)` | No structure, missing context | Structured logger with context |
| Logging PII in errors | GDPR violation, data leak | Scrub sensitive fields |
| No error rate metrics | Cannot detect anomalies | Track error rate, alert on spikes |
| Sending all errors to Sentry | Noise, quota exhausted | Filter operational errors |
| No requestId in logs | Cannot correlate request → error | Include requestId in every log |
| High-cardinality metric labels | Metric explosion | Normalize paths, limit label values |
| No error classification | All errors treated equally | Operational vs programmer distinction |

---

## 6. Enforcement Checklist

- [ ] All errors logged with structured context (requestId, userId, path)
- [ ] Sensitive data scrubbed from error logs (passwords, tokens, PII)
- [ ] Error rate tracked as metric with alerting
- [ ] Unhandled error rate alerted separately (page on-call)
- [ ] Error tracking tool (Sentry/Datadog) captures unhandled errors only
- [ ] Operational errors filtered from error tracking (404, 400, 401)
- [ ] Error logs include full error chain (cause, stack trace)
- [ ] Metric labels normalized to prevent high-cardinality explosion
