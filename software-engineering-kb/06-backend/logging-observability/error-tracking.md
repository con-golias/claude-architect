# Error Tracking

> **AI Plugin Directive — Error Tracking, Aggregation & Incident Detection**
> You are an AI coding assistant. When generating, reviewing, or refactoring error tracking
> code, follow EVERY rule in this document. Without proper error tracking, bugs go undetected,
> regressions are missed, and incidents are discovered by users. Treat each section as non-negotiable.

**Core Rule: ALWAYS use a dedicated error tracking tool (Sentry, Datadog, Bugsnag). ALWAYS filter operational errors — only track programmer errors (bugs). ALWAYS attach context (user, request, environment). ALWAYS scrub sensitive data before sending to error tracker.**

---

## 1. Error Tracking Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Error Tracking Pipeline                          │
│                                                               │
│  Application error occurs                                    │
│  ├── Is it operational? (404, 400, 401, 429)               │
│  │   └── YES → Log locally, DO NOT send to tracker         │
│  │                                                           │
│  ├── Is it a programmer error? (500, unhandled)             │
│  │   └── YES → Send to error tracker                       │
│  │       ├── Attach context (user, request, env)           │
│  │       ├── Scrub PII and secrets                         │
│  │       ├── Group by stack trace (deduplication)          │
│  │       └── Alert if new or regression                    │
│  │                                                           │
│  Error Tracker (Sentry/Datadog)                             │
│  ├── Group similar errors (fingerprinting)                  │
│  ├── Track frequency, affected users                        │
│  ├── Detect regressions (resolved → reoccurred)            │
│  ├── Link to source code (source maps/debug symbols)       │
│  └── Alert team via Slack/PagerDuty                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation (Sentry)

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  tracesSampleRate: 0.1,
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
    "NotFoundError",
    "ValidationError",
    "UnauthorizedError",
    "RateLimitError",
  ],
});

// In global error handler
function handleError(err: Error, req: Request): void {
  // Skip operational errors
  if (err instanceof AppError && err.isOperational) return;

  Sentry.withScope((scope) => {
    scope.setUser({ id: req.user?.id, email: req.user?.email });
    scope.setTag("requestId", req.id);
    scope.setTag("path", req.path);
    scope.setContext("request", {
      method: req.method,
      url: req.url,
      query: req.query,
    });
    Sentry.captureException(err);
  });
}
```

---

## 3. Go Implementation

```go
import "github.com/getsentry/sentry-go"

func InitSentry() error {
    return sentry.Init(sentry.ClientOptions{
        Dsn:              os.Getenv("SENTRY_DSN"),
        Environment:      os.Getenv("APP_ENV"),
        Release:          os.Getenv("APP_VERSION"),
        TracesSampleRate: 0.1,
        BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
            if event.Request != nil {
                delete(event.Request.Headers, "Authorization")
                delete(event.Request.Headers, "Cookie")
            }
            return event
        },
    })
}

func CaptureError(ctx context.Context, err error) {
    var appErr *AppError
    if errors.As(err, &appErr) && appErr.Operational {
        return // Skip operational errors
    }

    hub := sentry.GetHubFromContext(ctx)
    if hub == nil {
        hub = sentry.CurrentHub().Clone()
    }
    hub.WithScope(func(scope *sentry.Scope) {
        scope.SetUser(sentry.User{ID: auth.GetUserID(ctx)})
        scope.SetTag("requestId", middleware.GetRequestID(ctx))
        hub.CaptureException(err)
    })
}
```

---

## 4. Python Implementation

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.APP_ENV,
    release=settings.APP_VERSION,
    traces_sample_rate=0.1,
    before_send=scrub_event,
    ignore_errors=[NotFoundError, ValidationError, UnauthorizedError],
    integrations=[FastApiIntegration()],
)

def scrub_event(event, hint):
    if "request" in event and "headers" in event["request"]:
        event["request"]["headers"] = {
            k: v for k, v in event["request"]["headers"].items()
            if k.lower() not in ("authorization", "cookie")
        }
    return event

# Manual capture
def capture_error(exc: Exception, request: Request | None = None):
    if isinstance(exc, AppError) and exc.operational:
        return

    with sentry_sdk.push_scope() as scope:
        if request:
            scope.set_user({"id": getattr(request.state, "user_id", None)})
            scope.set_tag("request_id", request.headers.get("x-request-id"))
        sentry_sdk.capture_exception(exc)
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Send all errors to tracker | Noise, quota burned | Filter operational errors |
| No PII scrubbing | Privacy violation in tracker | beforeSend scrub function |
| No source maps | Stack traces unreadable | Upload source maps on deploy |
| No release tracking | Cannot detect regressions | Set release version |
| No user context | Cannot assess impact | Attach userId |
| No alert on new errors | Bugs discovered late | Alert on first occurrence |

---

## 6. Enforcement Checklist

- [ ] Error tracking tool configured (Sentry/Datadog/Bugsnag)
- [ ] Only programmer errors sent (operational errors filtered)
- [ ] PII and secrets scrubbed in `beforeSend`
- [ ] User context attached (userId)
- [ ] Release version set for regression detection
- [ ] Source maps uploaded for readable stack traces
- [ ] Alert configured for new error types
- [ ] Error grouping reviewed (no duplicate issues)
