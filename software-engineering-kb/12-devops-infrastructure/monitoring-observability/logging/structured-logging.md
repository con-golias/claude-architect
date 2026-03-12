# Structured Logging

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Observability > Logging                                                |
| **Importance**     | Critical                                                                        |
| **Scope**          | Structured log formats, log levels, correlation IDs, libraries, OTel integration|
| **Audience**       | Backend Developers, SREs, DevOps Engineers                                      |
| **Key Insight**    | Structured JSON logs with embedded trace context transform logs from text files into queryable, correlated observability data |
| **Cross-ref**      | [Log Aggregation](log-aggregation.md), [ELK Stack](elk-stack.md), [Distributed Tracing](../tracing/distributed-tracing.md), [Three Pillars](../three-pillars.md) |

---

## Core Concepts

### Structured vs Unstructured Logging

```text
UNSTRUCTURED (plain text):
  2026-03-10 14:23:01 ERROR PaymentService - Payment failed for user 42, amount $99.99

STRUCTURED (JSON):
  {
    "timestamp": "2026-03-10T14:23:01.234Z",
    "level": "error",
    "logger": "PaymentService",
    "message": "Payment failed",
    "user_id": "usr_42",
    "amount_cents": 9999,
    "currency": "USD",
    "trace_id": "abc123def456",
    "span_id": "span789",
    "service": "payment-service",
    "version": "2.4.1"
  }
```

| Aspect            | Unstructured                    | Structured                          |
|-------------------|---------------------------------|-------------------------------------|
| Parsing           | Regex-based, fragile            | Native JSON parsing, reliable       |
| Querying          | Full-text search only           | Field-level filtering and aggregation|
| Correlation       | Manual text matching            | Query by trace_id, user_id, etc.    |
| Alerting          | Regex pattern matching          | Field-based conditions              |
| Cost              | Higher (index all text)         | Lower (index selected fields)       |

### JSON Log Format Standard

Define a standard log schema across all services. Every log record must include these fields.

```json
{
  "timestamp": "2026-03-10T14:23:01.234Z",
  "level": "info",
  "message": "Request completed",
  "service": {
    "name": "payment-service",
    "version": "2.4.1",
    "environment": "production",
    "instance_id": "pod-abc123"
  },
  "trace": {
    "trace_id": "abc123def456789012345678",
    "span_id": "span789012345678",
    "parent_span_id": "parent456789012"
  },
  "request": {
    "method": "POST",
    "path": "/v1/payments",
    "status": 201,
    "duration_ms": 245,
    "request_id": "req_uuid_here"
  },
  "context": {
    "user_id": "usr_42",
    "tenant_id": "tenant_acme"
  }
}
```

### Log Levels

Use log levels consistently across all services. Define clear criteria for each level.

| Level     | When to Use                                                        | Examples                                          |
|-----------|--------------------------------------------------------------------|---------------------------------------------------|
| **FATAL** | Process cannot continue; immediate shutdown                        | Database connection pool exhausted, OOM            |
| **ERROR** | Operation failed; requires attention but process continues         | Payment gateway timeout, unhandled exception       |
| **WARN**  | Unexpected condition; operation succeeded but something is off     | Retry succeeded, deprecated API called, high latency|
| **INFO**  | Normal operations worth recording                                  | Request completed, job started/finished, config loaded|
| **DEBUG** | Detailed diagnostic information for development                    | SQL queries, cache hits/misses, intermediate state |

```text
Production Level Guidelines:
  - Default production level: INFO
  - Enable DEBUG per-service via config/env var (never globally)
  - WARN and above should be investigated within 24 hours
  - ERROR triggers alert notification
  - FATAL triggers page (PagerDuty/Opsgenie)
```

### Structured Logging Libraries

#### TypeScript: Pino

```typescript
// logger.ts -- Pino with trace context
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  base: {
    service: process.env.SERVICE_NAME || "unknown",
    version: process.env.SERVICE_VERSION || "0.0.0",
    environment: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["req.headers.authorization", "context.email", "context.ssn"],
    censor: "[REDACTED]",
  },
});

export default logger;

// Usage in request handler
import { trace, context } from "@opentelemetry/api";

function getTraceContext() {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const spanContext = span.spanContext();
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
  };
}

// Express middleware for request logging
import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const traceCtx = getTraceContext();

  // Attach child logger to request
  req.log = logger.child({
    request_id: requestId,
    ...traceCtx,
  });

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - startTime) / 1_000_000;
    req.log.info(
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Math.round(durationMs * 100) / 100,
        user_id: req.user?.id,
      },
      "Request completed"
    );
  });

  next();
}
```

#### Python: structlog

```python
# logger.py -- structlog with trace context
import structlog
import logging
import os
from opentelemetry import trace

def add_trace_context(
    logger: logging.Logger, method_name: str, event_dict: dict
) -> dict:
    """Add OpenTelemetry trace context to every log record."""
    span = trace.get_current_span()
    if span and span.is_recording():
        ctx = span.get_span_context()
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
    return event_dict


def add_service_context(
    logger: logging.Logger, method_name: str, event_dict: dict
) -> dict:
    """Add service metadata to every log record."""
    event_dict["service"] = os.getenv("SERVICE_NAME", "unknown")
    event_dict["version"] = os.getenv("SERVICE_VERSION", "0.0.0")
    event_dict["environment"] = os.getenv("ENVIRONMENT", "development")
    return event_dict


def redact_sensitive_fields(
    logger: logging.Logger, method_name: str, event_dict: dict
) -> dict:
    """Mask PII and sensitive data in log output."""
    sensitive_keys = {"password", "token", "ssn", "credit_card", "authorization"}
    for key in sensitive_keys:
        if key in event_dict:
            event_dict[key] = "[REDACTED]"
    return event_dict


structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        add_service_context,
        add_trace_context,
        redact_sensitive_fields,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


# Usage in FastAPI
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
import time
import uuid

app = FastAPI()

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "Request completed",
            status=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response

app.add_middleware(LoggingMiddleware)
```

#### Go: slog (Standard Library, Go 1.21+)

```go
// logger.go -- slog with trace context
package logging

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/trace"
)

func NewLogger() *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})

	return slog.New(&TraceHandler{
		Handler: handler,
		service: os.Getenv("SERVICE_NAME"),
		version: os.Getenv("SERVICE_VERSION"),
	})
}

// TraceHandler wraps slog.Handler to inject trace context and service info.
type TraceHandler struct {
	slog.Handler
	service string
	version string
}

func (h *TraceHandler) Handle(ctx context.Context, r slog.Record) error {
	r.AddAttrs(
		slog.String("service", h.service),
		slog.String("version", h.version),
	)

	span := trace.SpanFromContext(ctx)
	if span.SpanContext().IsValid() {
		r.AddAttrs(
			slog.String("trace_id", span.SpanContext().TraceID().String()),
			slog.String("span_id", span.SpanContext().SpanID().String()),
		)
	}
	return h.Handler.Handle(ctx, r)
}

// RequestLoggingMiddleware logs every HTTP request with trace context.
func RequestLoggingMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = uuid.New().String()
			}

			// Wrap response writer to capture status code
			rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
			next.ServeHTTP(rw, r)

			logger.InfoContext(r.Context(), "Request completed",
				slog.String("request_id", requestID),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rw.statusCode),
				slog.Float64("duration_ms", float64(time.Since(start).Microseconds())/1000),
			)
		})
	}
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
```

### Correlation IDs

Propagate correlation IDs through the entire request lifecycle using HTTP headers and middleware.

```text
Correlation Flow:

  Client ──► API Gateway ──► Service A ──► Service B ──► Database
     │           │                │             │
     │    X-Request-ID: uuid     │             │
     │    traceparent: 00-tid... │             │
     │           │                │             │
     └───────────┴────────────────┴─────────────┘
                 All logs share: request_id, trace_id
```

```text
Standard Headers:
  X-Request-ID     ── Application-level request correlation
  traceparent      ── W3C Trace Context (OTel standard)
  tracestate       ── Vendor-specific trace data
  X-Correlation-ID ── Legacy; prefer X-Request-ID + traceparent
```

### Sensitive Data Redaction

Never log PII, credentials, or security tokens. Implement redaction at the logger level.

```typescript
// Pino redaction configuration
const logger = pino({
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "body.password",
      "body.credit_card",
      "body.ssn",
      "context.email",
      "*.token",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
});

// Custom redaction for complex patterns
function redactPII(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...obj };
  for (const [key, value] of Object.entries(redacted)) {
    if (typeof value === "string") {
      // Redact email addresses
      if (/\S+@\S+\.\S+/.test(value)) {
        redacted[key] = "[EMAIL_REDACTED]";
      }
      // Redact credit card numbers
      if (/\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/.test(value)) {
        redacted[key] = "[CC_REDACTED]";
      }
    }
  }
  return redacted;
}
```

### Log Sampling Strategies

For high-volume services, log sampling prevents storage cost explosion without losing critical events.

```typescript
// Sampling strategy: always log errors, sample info/debug
import pino from "pino";

const logger = pino({
  level: "info",
  hooks: {
    logMethod(inputArgs, method, level) {
      // Always log WARN and above
      if (level >= 40) {
        method.apply(this, inputArgs);
        return;
      }
      // Sample INFO logs at 10% for high-volume endpoints
      if (Math.random() < 0.1) {
        method.apply(this, inputArgs);
      }
    },
  },
});
```

```python
# Python: structlog sampling processor
import random

def sampling_processor(logger, method_name, event_dict):
    """Sample INFO/DEBUG logs at configurable rate."""
    level = event_dict.get("level", "info")
    if level in ("warning", "error", "critical"):
        return event_dict  # Always keep

    sample_rate = float(os.getenv("LOG_SAMPLE_RATE", "0.1"))
    if random.random() > sample_rate:
        raise structlog.DropEvent  # Drop this log entry

    event_dict["_sampled"] = True
    event_dict["_sample_rate"] = sample_rate
    return event_dict
```

### Performance Impact of Logging

```text
Logging Performance Guidelines:
  1. Use asynchronous log writing (pino uses worker threads by default)
  2. Avoid string concatenation in log messages; use structured fields
  3. Guard expensive computations behind level checks
  4. Buffer log output; flush on intervals, not per-record
  5. Measure: logging should add < 1ms per request at INFO level
```

```go
// Go: guard expensive debug logging
if logger.Enabled(ctx, slog.LevelDebug) {
    // Only compute expensive debug info when DEBUG is enabled
    debugData := computeExpensiveDebugInfo(request)
    logger.DebugContext(ctx, "Request debug info",
        slog.Any("debug_data", debugData),
    )
}
```

### OpenTelemetry Logs Bridge

Connect structured logs to the OTel pipeline for unified collection, processing, and export.

```typescript
// OTel Logs Bridge for Node.js
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";

const loggerProvider = new LoggerProvider();
loggerProvider.addLogRecordProcessor(
  new SimpleLogRecordProcessor(
    new OTLPLogExporter({ url: "http://otel-collector:4317" })
  )
);

logs.setGlobalLoggerProvider(loggerProvider);
const otelLogger = logs.getLogger("payment-service");

// Emit a log record via OTel
otelLogger.emit({
  severityNumber: SeverityNumber.ERROR,
  severityText: "ERROR",
  body: "Payment processing failed",
  attributes: {
    "user.id": "usr_42",
    "payment.amount": 9999,
    "error.type": "gateway_timeout",
  },
});
```

```python
# Python OTel Logs Bridge
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
import logging

logger_provider = LoggerProvider()
logger_provider.add_log_record_processor(
    BatchLogRecordProcessor(OTLPLogExporter(endpoint="http://otel-collector:4317"))
)
set_logger_provider(logger_provider)

# Bridge standard logging to OTel
handler = LoggingHandler(
    level=logging.INFO,
    logger_provider=logger_provider,
)
logging.getLogger().addHandler(handler)

# Now standard logging calls emit OTel log records
logging.info("Payment processed", extra={"user_id": "usr_42", "amount": 9999})
```

---

## Best Practices

1. **Use structured JSON logging exclusively** -- never use unstructured text logs in production; structured fields enable field-level querying and automated processing.

2. **Embed trace_id and span_id in every log record** -- use middleware or logger processors to inject OpenTelemetry trace context automatically, not manually per log call.

3. **Standardize log schema across all services** -- define a common schema (timestamp, level, service, version, trace context, message) and enforce via shared logger configuration.

4. **Apply log levels consistently with clear criteria** -- document when to use each level; default to INFO in production and enable DEBUG per-service via environment variable.

5. **Redact sensitive data at the logger level** -- configure PII masking (emails, tokens, credit cards) in the logger pipeline so no developer can accidentally log secrets.

6. **Use child loggers for request-scoped context** -- create a child logger per request with request_id, user_id, and trace context; pass it through the request lifecycle.

7. **Implement log sampling for high-volume services** -- always log errors and warnings; sample INFO/DEBUG at a configurable rate to control storage costs.

8. **Avoid string interpolation in log messages** -- use structured fields (`logger.info("Payment failed", { amount, userId })`) instead of template strings.

9. **Guard expensive debug logging behind level checks** -- do not compute debug data if the logger is set to INFO or higher; this eliminates wasted CPU cycles.

10. **Connect logs to OTel pipeline via Logs Bridge** -- use the OpenTelemetry Logs Bridge to unify log collection with metrics and traces in a single pipeline.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| **Unstructured text logs** | Cannot query by field, unreliable regex parsing, high indexing cost | Use JSON structured logging with defined schema |
| **Missing trace context** | Cannot correlate logs with traces; debugging requires manual timeline assembly | Inject trace_id/span_id automatically via middleware |
| **Logging PII in plain text** | GDPR/HIPAA violations, security liability | Implement redaction rules in the logger pipeline |
| **Console.log in production** | No level filtering, no structure, no context, cannot route or alert | Use a structured logging library (pino, structlog, slog) |
| **Log level INFO for everything** | Cannot distinguish routine events from warnings; no signal-to-noise control | Use WARN for unexpected conditions, ERROR for failures, INFO for normal operations |
| **String concatenation in messages** | Performance overhead, cannot query individual fields | Use structured fields: `logger.info("msg", { key: value })` |
| **No request-scoped context** | Logs from concurrent requests are interleaved with no way to isolate | Use child loggers or context variables bound per request |
| **Logging full request/response bodies** | Storage cost explosion, potential PII exposure, performance degradation | Log only relevant fields; redact bodies or limit to error responses |

---

## Enforcement Checklist

- [ ] All services use a structured JSON logging library (pino, structlog, slog) -- no raw console output
- [ ] Standard log schema defined and enforced: timestamp, level, service, version, trace_id, span_id, message
- [ ] Middleware injects trace context (trace_id, span_id, request_id) into every log record automatically
- [ ] PII redaction configured at the logger level for authorization headers, emails, SSNs, credit cards
- [ ] Log levels documented with clear criteria; production default is INFO
- [ ] High-volume services implement log sampling (configurable rate, 100% retention for ERROR+)
- [ ] Child loggers or context variables used for request-scoped logging (no interleaved context)
- [ ] Debug logging guarded behind level checks to avoid computing expensive debug data
- [ ] OpenTelemetry Logs Bridge configured to connect logs with the unified telemetry pipeline
- [ ] Log output performance validated: < 1ms overhead per request at INFO level
