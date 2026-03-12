# Log Correlation & Context Propagation

> **AI Plugin Directive — Request Correlation, Distributed Context & Log Aggregation**
> You are an AI coding assistant. When generating, reviewing, or refactoring log correlation
> code, follow EVERY rule in this document. Without correlation IDs, debugging distributed
> systems is impossible — logs become disconnected noise. Treat each section as non-negotiable.

**Core Rule: ALWAYS generate a unique requestId at the edge and propagate it through all services. ALWAYS include traceId and spanId for distributed tracing correlation. ALWAYS use context propagation (AsyncLocalStorage/context.Context/contextvars) for implicit log context.**

---

## 1. Correlation Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Correlation ID Propagation                       │
│                                                               │
│  Client request                                              │
│  └── API Gateway generates: X-Request-ID, X-Trace-ID       │
│      └── Service A (logs with requestId, traceId)           │
│          ├── → Service B (propagates X-Request-ID)          │
│          │   └── → Database (query tagged with requestId)   │
│          └── → Service C (propagates X-Request-ID)          │
│              └── → Redis (operation tagged with requestId)  │
│                                                               │
│  Result: Every log entry across all services shares the     │
│  same requestId — one search finds the entire request flow  │
│                                                               │
│  Headers propagated:                                         │
│  ├── X-Request-ID: unique per request                       │
│  ├── traceparent: W3C Trace Context (traceId-spanId)       │
│  └── X-Correlation-ID: business correlation (optional)     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript — AsyncLocalStorage

```typescript
import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  requestId: string;
  traceId: string;
  userId?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// Middleware: set context for entire request lifecycle
app.use((req, res, next) => {
  const context: RequestContext = {
    requestId: req.headers["x-request-id"] as string ?? randomUUID(),
    traceId: req.headers["traceparent"]?.split("-")[1] ?? randomUUID(),
    userId: req.user?.id,
    startTime: Date.now(),
  };

  // Propagate on outgoing requests
  res.setHeader("X-Request-ID", context.requestId);

  asyncLocalStorage.run(context, () => next());
});

// Logger automatically includes context
function getContextLogger(): pino.Logger {
  const ctx = asyncLocalStorage.getStore();
  if (!ctx) return logger;
  return logger.child({
    requestId: ctx.requestId,
    traceId: ctx.traceId,
    userId: ctx.userId,
  });
}

// HTTP client: propagate headers
async function callService(url: string, body: unknown): Promise<Response> {
  const ctx = asyncLocalStorage.getStore();
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": ctx?.requestId ?? "",
      "X-Trace-ID": ctx?.traceId ?? "",
    },
    body: JSON.stringify(body),
  });
}
```

---

## 3. Go — context.Context

```go
type contextKey string
const requestIDKey contextKey = "requestID"

// Middleware: extract or generate request ID
func RequestIDMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        requestID := r.Header.Get("X-Request-ID")
        if requestID == "" {
            requestID = uuid.New().String()
        }

        ctx := context.WithValue(r.Context(), requestIDKey, requestID)
        w.Header().Set("X-Request-ID", requestID)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func GetRequestID(ctx context.Context) string {
    id, _ := ctx.Value(requestIDKey).(string)
    return id
}

// Propagate to outgoing HTTP calls
func PropagateContext(ctx context.Context, req *http.Request) {
    if id := GetRequestID(ctx); id != "" {
        req.Header.Set("X-Request-ID", id)
    }
    // W3C Trace Context propagation
    if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
        req.Header.Set("traceparent", fmt.Sprintf("00-%s-%s-01",
            span.SpanContext().TraceID(), span.SpanContext().SpanID()))
    }
}
```

---

## 4. Python — contextvars

```python
import contextvars
from uuid import uuid4

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")
trace_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("trace_id", default="")

@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    trace_id = request.headers.get("x-trace-id", str(uuid4()))

    request_id_var.set(request_id)
    trace_id_var.set(trace_id)

    # structlog auto-merges contextvars
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        trace_id=trace_id,
    )

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# Propagate to outgoing calls
async def call_service(url: str, data: dict):
    async with httpx.AsyncClient() as client:
        return await client.post(url, json=data, headers={
            "X-Request-ID": request_id_var.get(),
            "X-Trace-ID": trace_id_var.get(),
        })
```

---

## 5. Log Aggregation Queries

```
# Find all logs for a specific request across services
# Elasticsearch/Kibana:
requestId: "req_abc123"

# Loki/Grafana:
{app=~".+"} |= "req_abc123"

# Datadog:
@requestId:req_abc123

# CloudWatch Logs Insights:
fields @timestamp, @message
| filter requestId = "req_abc123"
| sort @timestamp asc
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No correlation ID | Cannot trace request across services | Generate + propagate requestId |
| Generate new ID per service | IDs don't match | Propagate from edge, don't regenerate |
| requestId in some logs | Gaps in correlation | Use context propagation (ALS/context.Context) |
| No traceId for tracing | Cannot link logs to traces | Propagate W3C traceparent |
| Manual passing of context | Easy to forget, inconsistent | AsyncLocalStorage / contextvars |

---

## 7. Enforcement Checklist

- [ ] requestId generated at API gateway/edge
- [ ] requestId propagated via X-Request-ID header to all downstream services
- [ ] traceId propagated via W3C traceparent header
- [ ] Context propagation uses AsyncLocalStorage / context.Context / contextvars
- [ ] Every log entry includes requestId automatically
- [ ] Outgoing HTTP calls include correlation headers
- [ ] requestId returned in error responses for support correlation
- [ ] Log aggregation tool supports searching by requestId
