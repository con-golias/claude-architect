# Request Lifecycle

> **AI Plugin Directive — HTTP Request Lifecycle, Context & Cleanup**
> You are an AI coding assistant. When generating, reviewing, or refactoring request lifecycle
> code, follow EVERY rule in this document. Mismanaged request lifecycle causes resource leaks,
> broken tracing, and inconsistent state. Treat each section as non-negotiable.

**Core Rule: ALWAYS create request-scoped context at the start of each request. ALWAYS clean up resources when the request ends. ALWAYS propagate context through the entire call chain. NEVER store request state in global/module-level variables.**

---

## 1. Request Lifecycle Phases

```
┌──────────────────────────────────────────────────────────────┐
│              HTTP Request Lifecycle                            │
│                                                               │
│  1. RECEIVE                                                  │
│     ├── TCP connection accepted                              │
│     ├── HTTP headers parsed                                  │
│     └── Request object created                               │
│                                                               │
│  2. INITIALIZE CONTEXT                                       │
│     ├── Generate/extract request ID                         │
│     ├── Start trace span                                    │
│     ├── Start request timer                                 │
│     └── Create request-scoped logger                        │
│                                                               │
│  3. PRE-PROCESSING                                           │
│     ├── Parse body (JSON, multipart)                        │
│     ├── Authenticate (verify token)                         │
│     ├── Authorize (check permissions)                       │
│     └── Validate input (schema)                             │
│                                                               │
│  4. HANDLER                                                  │
│     ├── Business logic execution                            │
│     ├── Database queries                                    │
│     └── External service calls                              │
│                                                               │
│  5. POST-PROCESSING                                          │
│     ├── Serialize response                                  │
│     ├── Set response headers                                │
│     └── Transform/filter output                             │
│                                                               │
│  6. CLEANUP (ALWAYS runs, even on error)                    │
│     ├── End trace span                                      │
│     ├── Record metrics (duration, status)                   │
│     ├── Log request completion                              │
│     ├── Release database connections                        │
│     └── Flush response to client                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript — Request Context

```typescript
import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  requestId: string;
  userId?: string;
  traceId: string;
  startTime: number;
  logger: Logger;
  abortController: AbortController;
}

const als = new AsyncLocalStorage<RequestContext>();

// Initialize context at request start
app.use((req, res, next) => {
  const context: RequestContext = {
    requestId: req.headers["x-request-id"] as string ?? randomUUID(),
    traceId: req.headers["traceparent"]?.split("-")[1] ?? randomUUID(),
    startTime: Date.now(),
    logger: baseLogger.child({ requestId: req.id }),
    abortController: new AbortController(),
  };

  // Cleanup on request end
  res.on("close", () => {
    context.abortController.abort(); // Cancel any in-flight operations
  });

  als.run(context, () => next());
});

// Access context anywhere in the call chain
function getContext(): RequestContext {
  const ctx = als.getStore();
  if (!ctx) throw new Error("No request context");
  return ctx;
}

// Usage in service layer — no need to pass request objects
async function processOrder(orderId: string): Promise<Order> {
  const ctx = getContext();
  ctx.logger.info("Processing order", { orderId });

  const order = await orderRepo.findById(orderId, { signal: ctx.abortController.signal });
  return order;
}
```

---

## 3. Go — Context Propagation

```go
// Go: context.Context IS the request context
func (h *OrderHandler) Process(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Context carries: deadline, cancellation, request-scoped values
    // Cancellation propagates: if client disconnects, ctx is cancelled

    order, err := h.service.ProcessOrder(ctx, chi.URLParam(r, "id"))
    if err != nil {
        if errors.Is(err, context.Canceled) {
            // Client disconnected — stop processing
            slog.Info("client disconnected", "path", r.URL.Path)
            return
        }
        HandleError(w, r, err)
        return
    }

    writeJSON(w, 200, order)
}

// Service respects context cancellation
func (s *OrderService) ProcessOrder(ctx context.Context, id string) (*Order, error) {
    // Database query respects context deadline
    order, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("find order: %w", err)
    }

    // HTTP call respects context cancellation
    payment, err := s.paymentClient.Charge(ctx, order)
    if err != nil {
        return nil, fmt.Errorf("charge: %w", err)
    }

    return order, nil
}
```

---

## 4. Python — Request State

```python
# FastAPI: request.state for request-scoped data

@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = request.headers.get("x-request-id", str(uuid4()))
    request.state.start_time = time.monotonic()

    try:
        response = await call_next(request)
        return response
    finally:
        # Cleanup ALWAYS runs
        duration = (time.monotonic() - request.state.start_time) * 1000
        logger.info("request completed", extra={
            "request_id": request.state.request_id,
            "duration_ms": round(duration, 1),
        })

# contextvars for implicit propagation
import contextvars
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id")

# Set in middleware, access anywhere
structlog.contextvars.bind_contextvars(request_id=request.state.request_id)
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Global mutable state | Race conditions between requests | Request-scoped context |
| No cleanup on error | Resource leaks | finally/defer blocks |
| Ignoring client disconnect | Wasted work | Check context cancellation |
| Passing `req` to service layer | Coupling to HTTP framework | Use context/ALS |
| No request timeout | Requests hang indefinitely | Set per-request deadline |
| Missing request ID | Cannot trace requests | Generate at entry point |

---

## 6. Enforcement Checklist

- [ ] Request context created at start with requestId, traceId, timer
- [ ] Context propagated through entire call chain (ALS/context.Context)
- [ ] Resources cleaned up in finally/defer (connections, timers)
- [ ] Client disconnection detected and operations cancelled
- [ ] Request-scoped logger carries context automatically
- [ ] No global mutable state used for request data
- [ ] Request completion logged with duration and status
