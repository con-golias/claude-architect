# Error Response Format & Global Handlers

> **AI Plugin Directive — API Error Responses & Centralized Error Handling**
> You are an AI coding assistant. When generating, reviewing, or refactoring error response
> code, follow EVERY rule in this document. Inconsistent error responses break client integrations
> and expose security vulnerabilities. Treat each section as non-negotiable.

**Core Rule: ALWAYS use a single, consistent error response format across the entire API. ALWAYS implement a global error handler that catches ALL unhandled errors. NEVER return stack traces, SQL queries, or internal paths in production error responses.**

---

## 1. Standard Error Response Format

```
┌──────────────────────────────────────────────────────────────┐
│              Error Response Envelope                           │
│                                                               │
│  {                                                           │
│    "error": {                                                │
│      "type": "NOT_FOUND",          // Machine-readable code  │
│      "message": "User not found",  // Human-readable         │
│      "details": {                  // Context (optional)     │
│        "resource": "User",                                   │
│        "id": "usr_123"                                       │
│      },                                                      │
│      "requestId": "req_abc...",    // For support/debugging  │
│      "timestamp": "2026-03-09..." // When error occurred     │
│    }                                                         │
│  }                                                           │
│                                                               │
│  Production rules:                                           │
│  ├── NEVER include stack traces                              │
│  ├── NEVER include SQL queries or internal paths             │
│  ├── ALWAYS include requestId for correlation                │
│  └── ALWAYS include machine-readable type code               │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Global Error Handler

```typescript
// Express global error handler — MUST be last middleware
function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers["x-request-id"] as string ?? randomUUID();

  // Operational error (expected)
  if (err instanceof AppError && err.isOperational) {
    logger.warn("Operational error", {
      requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      error: {
        type: err.code,
        message: err.message,
        details: err.details,
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Programmer error (bug) — log full details, return generic response
  logger.error("Unhandled error", {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: sanitizeBody(req.body),
  });

  metrics.increment("errors.unhandled");

  // NEVER expose internal details to client
  res.status(500).json({
    error: {
      type: "INTERNAL_ERROR",
      message: "An internal error occurred. Please try again.",
      requestId, // Include so user can reference in support ticket
      timestamp: new Date().toISOString(),
    },
  });
}

// Register AFTER all routes
app.use(globalErrorHandler);

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason: Error) => {
  logger.error("Unhandled promise rejection", {
    error: reason.message,
    stack: reason.stack,
  });
  metrics.increment("errors.unhandled_rejection");
  // In production: graceful shutdown → restart via process manager
});

// Catch uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception — shutting down", {
    error: error.message,
    stack: error.stack,
  });
  // MUST exit — state may be corrupt
  process.exit(1);
});
```

---

## 3. Go Global Error Handler

```go
// Middleware: recover from panics
func RecoverMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if rec := recover(); rec != nil {
                requestID := r.Header.Get("X-Request-ID")
                slog.Error("panic recovered",
                    "requestId", requestID,
                    "panic", rec,
                    "stack", string(debug.Stack()),
                    "path", r.URL.Path,
                )
                metrics.Increment("errors.panic")

                writeJSON(w, http.StatusInternalServerError, map[string]any{
                    "error": map[string]any{
                        "type":      "INTERNAL_ERROR",
                        "message":   "An internal error occurred",
                        "requestId": requestID,
                    },
                })
            }
        }()
        next.ServeHTTP(w, r)
    })
}

// Error response helper
func HandleError(w http.ResponseWriter, r *http.Request, err error) {
    requestID := r.Header.Get("X-Request-ID")

    var appErr *AppError
    if errors.As(err, &appErr) && appErr.Operational {
        slog.Warn("operational error",
            "requestId", requestID,
            "code", appErr.Code,
            "status", appErr.StatusCode,
        )
        writeJSON(w, appErr.StatusCode, map[string]any{
            "error": map[string]any{
                "type":      appErr.Code,
                "message":   appErr.Message,
                "details":   appErr.Details,
                "requestId": requestID,
            },
        })
        return
    }

    // Unhandled error
    slog.Error("unhandled error",
        "requestId", requestID,
        "error", err,
        "path", r.URL.Path,
    )
    metrics.Increment("errors.unhandled")

    writeJSON(w, http.StatusInternalServerError, map[string]any{
        "error": map[string]any{
            "type":      "INTERNAL_ERROR",
            "message":   "An internal error occurred",
            "requestId": requestID,
        },
    })
}
```

---

## 4. Python Global Error Handler

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import traceback

app = FastAPI()

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    request_id = request.headers.get("x-request-id", str(uuid4()))

    if exc.operational:
        logger.warning("Operational error",
            extra={"request_id": request_id, "code": exc.code})
    else:
        logger.error("Programmer error",
            extra={"request_id": request_id, "traceback": traceback.format_exc()})

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {
            "type": exc.code,
            "message": exc.message,
            "details": exc.details,
            "requestId": request_id,
        }},
    )

@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    logger.error("Unhandled error",
        extra={"request_id": request_id, "error": str(exc),
               "traceback": traceback.format_exc()})

    return JSONResponse(
        status_code=500,
        content={"error": {
            "type": "INTERNAL_ERROR",
            "message": "An internal error occurred",
            "requestId": request_id,
        }},
    )
```

---

## 5. HTTP Status Code Mapping

| Error Type | Status | Response Type |
|-----------|--------|---------------|
| Validation failed | 400 | VALIDATION_ERROR |
| Malformed JSON | 400 | INVALID_REQUEST |
| Authentication failed | 401 | UNAUTHORIZED |
| Insufficient permissions | 403 | FORBIDDEN |
| Resource not found | 404 | NOT_FOUND |
| Method not allowed | 405 | METHOD_NOT_ALLOWED |
| Conflict (duplicate) | 409 | CONFLICT |
| Payload too large | 413 | PAYLOAD_TOO_LARGE |
| Rate limited | 429 | RATE_LIMITED |
| Internal error | 500 | INTERNAL_ERROR |
| Dependency failure | 502 | BAD_GATEWAY |
| Service unavailable | 503 | SERVICE_UNAVAILABLE |
| Upstream timeout | 504 | GATEWAY_TIMEOUT |

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Stack trace in prod response | Security vulnerability | Strip in global handler |
| Different error format per endpoint | Clients cannot parse reliably | Single error envelope |
| No requestId in errors | Cannot correlate with logs | Include requestId in every error |
| `catch (err) { }` (swallowed) | Silent failures | Always log or re-throw |
| 200 with error body | Clients miss errors | Correct HTTP status codes |
| Generic 500 for everything | No useful info for client | Specific status codes + error types |
| No unhandledRejection handler | Process crashes silently | Global handlers for uncaught errors |

---

## 7. Enforcement Checklist

- [ ] Single error response format used across entire API
- [ ] Global error handler catches ALL unhandled errors
- [ ] Operational errors return specific HTTP status + error code
- [ ] Programmer errors return 500 with generic message
- [ ] No stack traces, SQL, or internal paths in production responses
- [ ] requestId included in every error response
- [ ] `unhandledRejection` and `uncaughtException` handlers registered
- [ ] Panic recovery middleware in Go
- [ ] All errors logged with requestId, path, method
- [ ] Unhandled error count tracked as metric
