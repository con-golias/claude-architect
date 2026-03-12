# Distributed Tracing

> **AI Plugin Directive — OpenTelemetry Distributed Tracing & Span Management**
> You are an AI coding assistant. When generating, reviewing, or refactoring tracing code,
> follow EVERY rule in this document. Without distributed tracing, debugging latency issues
> and failures across microservices is impossible. Treat each section as non-negotiable.

**Core Rule: ALWAYS use OpenTelemetry as the tracing standard. ALWAYS propagate trace context (W3C traceparent) across service boundaries. ALWAYS create spans for external calls (HTTP, DB, cache, queue). ALWAYS set appropriate span attributes and status. NEVER create spans for trivial in-process operations.**

---

## 1. Tracing Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Distributed Trace                                │
│                                                               │
│  Trace: entire request journey (single traceId)             │
│  ├── Span A: API Gateway (root span)                        │
│  │   ├── Span B: Auth middleware                            │
│  │   ├── Span C: Service A handler                          │
│  │   │   ├── Span D: Database query                        │
│  │   │   ├── Span E: Redis cache lookup                    │
│  │   │   └── Span F: HTTP call to Service B                │
│  │   │       ├── Span G: Service B handler                 │
│  │   │       │   └── Span H: Database query                │
│  │   │       └── Span I: Response processing               │
│  │   └── Span J: Response serialization                    │
│  │                                                           │
│  Each span records:                                          │
│  ├── Operation name                                         │
│  ├── Start/end time → duration                             │
│  ├── Status (OK, ERROR)                                     │
│  ├── Attributes (key-value metadata)                       │
│  ├── Events (timestamped annotations)                      │
│  └── Parent span ID (for tree structure)                    │
│                                                               │
│  Backends: Jaeger, Zipkin, Tempo, Datadog, Honeycomb       │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation (OpenTelemetry)

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { trace, SpanStatusCode, context } from "@opentelemetry/api";

// SDK setup — ALWAYS initialize before app starts
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317",
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-http": { enabled: true },
      "@opentelemetry/instrumentation-express": { enabled: true },
      "@opentelemetry/instrumentation-pg": { enabled: true },
      "@opentelemetry/instrumentation-redis": { enabled: true },
    }),
  ],
  serviceName: process.env.SERVICE_NAME ?? "api-service",
});
sdk.start();

// Manual span creation for business operations
const tracer = trace.getTracer("api-service");

async function processOrder(orderId: string): Promise<Order> {
  return tracer.startActiveSpan("processOrder", async (span) => {
    try {
      span.setAttribute("order.id", orderId);

      const order = await tracer.startActiveSpan("fetchOrder", async (fetchSpan) => {
        const result = await orderRepo.findById(orderId);
        fetchSpan.setAttribute("db.operation", "SELECT");
        fetchSpan.end();
        return result;
      });

      await tracer.startActiveSpan("chargePayment", async (paySpan) => {
        paySpan.setAttribute("payment.amount", order.total);
        await paymentService.charge(order);
        paySpan.end();
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return order;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

---

## 3. Go Implementation

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/codes"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func InitTracer(ctx context.Context, serviceName string) (*sdktrace.TracerProvider, error) {
    exporter, err := otlptracegrpc.New(ctx)
    if err != nil {
        return nil, fmt.Errorf("create exporter: %w", err)
    }

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
        )),
        sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(0.1))),
    )
    otel.SetTracerProvider(tp)
    return tp, nil
}

var tracer = otel.Tracer("api-service")

func (s *OrderService) ProcessOrder(ctx context.Context, orderID string) error {
    ctx, span := tracer.Start(ctx, "ProcessOrder")
    defer span.End()

    span.SetAttributes(attribute.String("order.id", orderID))

    order, err := s.fetchOrder(ctx, orderID)
    if err != nil {
        span.SetStatus(codes.Error, err.Error())
        span.RecordError(err)
        return err
    }

    if err := s.chargePayment(ctx, order); err != nil {
        span.SetStatus(codes.Error, err.Error())
        span.RecordError(err)
        return err
    }

    span.SetStatus(codes.Ok, "")
    return nil
}

func (s *OrderService) fetchOrder(ctx context.Context, id string) (*Order, error) {
    ctx, span := tracer.Start(ctx, "fetchOrder")
    defer span.End()

    span.SetAttributes(attribute.String("db.operation", "SELECT"))
    return s.repo.FindByID(ctx, id)
}
```

---

## 4. Python Implementation

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

# Setup
provider = TracerProvider(resource=Resource.create({"service.name": "api-service"}))
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
trace.set_tracer_provider(provider)

# Auto-instrument frameworks
FastAPIInstrumentor.instrument_app(app)
HTTPXClientInstrumentor().instrument()
SQLAlchemyInstrumentor().instrument(engine=engine)

tracer = trace.get_tracer("api-service")

async def process_order(order_id: str):
    with tracer.start_as_current_span("processOrder") as span:
        span.set_attribute("order.id", order_id)

        try:
            with tracer.start_as_current_span("fetchOrder"):
                order = await order_repo.find_by_id(order_id)

            with tracer.start_as_current_span("chargePayment") as pay_span:
                pay_span.set_attribute("payment.amount", order.total)
                await payment_service.charge(order)

            span.set_status(trace.StatusCode.OK)
        except Exception as e:
            span.set_status(trace.StatusCode.ERROR, str(e))
            span.record_exception(e)
            raise
```

---

## 5. Sampling Strategies

| Strategy | Rate | Use Case |
|----------|------|----------|
| **Always on** | 100% | Development, staging |
| **Probabilistic** | 10% | Production (cost management) |
| **Rate limiting** | 10/sec | High-traffic services |
| **Parent-based** | Inherit | Follow parent's sampling decision |
| **Tail-based** | Dynamic | Keep errors + slow traces, sample normal |

```typescript
// Production: sample 10% + always sample errors
const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1),
});
```

- ALWAYS use parent-based sampling in production
- ALWAYS keep 100% of error traces
- ALWAYS sample slow traces (> p95 latency)

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No tracing in production | Cannot debug latency issues | Enable with sampling |
| 100% sampling in production | High cost, storage overflow | 10% probabilistic sampling |
| No span attributes | Traces lack context | Set key business attributes |
| Span per function call | Trace too large, noisy | Spans for I/O operations only |
| No error recording | Errors invisible in traces | `recordException` + `setStatus(ERROR)` |
| Missing context propagation | Broken trace tree | Propagate W3C traceparent |

---

## 7. Enforcement Checklist

- [ ] OpenTelemetry SDK initialized before app starts
- [ ] Auto-instrumentation enabled for HTTP, DB, cache, queue
- [ ] Manual spans for business-critical operations
- [ ] Span attributes set (operation, resource IDs)
- [ ] Errors recorded with `recordException` and `setStatus(ERROR)`
- [ ] W3C traceparent propagated on all outgoing HTTP calls
- [ ] Sampling configured for production (10% + errors)
- [ ] Trace backend configured (Jaeger/Tempo/Datadog)
- [ ] Service name set via OTEL_SERVICE_NAME or resource
