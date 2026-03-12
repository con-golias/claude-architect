# Distributed Tracing — Operational Deployment and Configuration

| Attribute     | Value                                                                                          |
|---------------|------------------------------------------------------------------------------------------------|
| Domain        | DevOps > Observability > Tracing                                                               |
| Importance    | Critical                                                                                       |
| Last Updated  | 2026-03                                                                                        |
| Cross-ref     | [OpenTelemetry](opentelemetry.md), [Jaeger & Zipkin](jaeger-zipkin.md), [09-performance distributed tracing](../../../09-performance/profiling-tools/distributed-tracing.md) |

> **Directive:** Deploy distributed tracing as a foundational observability signal across all production services. Standardize on W3C Trace Context propagation, enforce trace context forwarding at every service boundary, and configure sampling strategies that balance cost with debuggability. This guide focuses on operational deployment and configuration; see 09-performance for performance debugging with traces.

---

## 1. Core Concepts

### Traces, Spans, and Span Context

```
TRACE:
  A directed acyclic graph (DAG) of spans representing a single request's
  journey through a distributed system. Identified by a 128-bit trace_id.

SPAN:
  A unit of work within a trace. Contains:
  ├── trace_id       128-bit identifier shared by all spans in the trace
  ├── span_id        64-bit identifier unique to this span
  ├── parent_span_id 64-bit identifier of the parent span (empty for root)
  ├── name           Human-readable operation name ("GET /api/orders")
  ├── kind           CLIENT | SERVER | PRODUCER | CONSUMER | INTERNAL
  ├── start_time     Microsecond-precision timestamp
  ├── end_time       Microsecond-precision timestamp
  ├── status         OK | ERROR | UNSET
  ├── attributes     Key-value pairs (http.method, db.system, etc.)
  ├── events         Timestamped annotations within the span
  ├── links          References to spans in other traces
  └── resource       Describes the entity producing the span (service.name)

SPAN CONTEXT:
  The immutable, serializable portion of a span that propagates across
  process boundaries: trace_id + span_id + trace_flags + tracestate.
  This is what crosses HTTP headers, gRPC metadata, and message headers.

BAGGAGE:
  User-defined key-value pairs that propagate with the trace context.
  Use for cross-cutting concerns (tenant_id, feature_flags, region).
  WARNING: Baggage is sent on EVERY outgoing request — keep it small.
```

### Span Kinds

```
SPAN KIND         DESCRIPTION                              EXAMPLE
─────────────────────────────────────────────────────────────────────────
CLIENT            Outgoing synchronous request             HTTP client call
SERVER            Incoming synchronous request              HTTP handler
PRODUCER          Message sent asynchronously               Kafka publish
CONSUMER          Message received asynchronously           Kafka consumer
INTERNAL          Internal operation (no remote call)       Business logic
```

Span kind determines how tracing backends render the relationship:
- CLIENT + SERVER spans form a synchronous call edge.
- PRODUCER + CONSUMER spans form an asynchronous edge (potentially delayed).
- INTERNAL spans are children within a service — no cross-boundary semantics.

---

## 2. W3C Trace Context Standard

### traceparent Header

```
FORMAT:
  traceparent: {version}-{trace-id}-{parent-id}-{trace-flags}

EXAMPLE:
  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
                ││                                  │                  │
                ││                                  │                  └─ 01 = sampled
                ││                                  └─ parent-id (16 hex = 8 bytes)
                │└─ trace-id (32 hex = 16 bytes)
                └─ version (00 = current)

TRACE FLAGS:
  0x00 = not sampled (record but do not export)
  0x01 = sampled (record and export to backend)
```

### tracestate Header

```
PURPOSE:
  Vendor-specific trace information. Each vendor gets a key=value entry.
  Entries are comma-separated, ordered by last-modified-first.

EXAMPLE:
  tracestate: dd=s:1;o:rum,rojo=00f067aa0ba902b7

RULES:
  - Maximum 32 entries
  - Keys: lowercase alpha + optional vendor prefix (vendor@key)
  - Values: printable ASCII, no commas or equals
  - Services MUST propagate tracestate even if they don't understand it
```

---

## 3. Trace Propagation Across Service Boundaries

### HTTP Propagation

```typescript
// Express middleware — extract incoming context, create server span
import { trace, context, propagation, SpanKind } from '@opentelemetry/api';

function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract trace context from incoming headers
  const parentContext = propagation.extract(context.active(), req.headers);

  const tracer = trace.getTracer('http-server');
  const span = tracer.startSpan(
    `${req.method} ${req.route?.path || req.path}`,
    {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'net.peer.ip': req.ip,
      },
    },
    parentContext,
  );

  // Run the rest of the request within this span's context
  context.with(trace.setSpan(parentContext, span), () => {
    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      if (res.statusCode >= 500) span.setStatus({ code: 2, message: 'Error' });
      span.end();
    });
    next();
  });
}
```

### gRPC Propagation

```go
// Go — gRPC interceptors propagate trace context automatically
import (
    "go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
    "google.golang.org/grpc"
)

// Server: extract incoming context
server := grpc.NewServer(
    grpc.StatsHandler(otelgrpc.NewServerHandler()),
)

// Client: inject outgoing context
conn, _ := grpc.NewClient(
    "order-service:50051",
    grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
)
```

### Message Queue Propagation

```python
# Python — inject trace context into Kafka message headers
from opentelemetry import context, trace, propagation
from confluent_kafka import Producer

tracer = trace.get_tracer("order-service")
producer = Producer({"bootstrap.servers": "kafka:9092"})

def publish_order_event(order: dict):
    with tracer.start_as_current_span("publish_order", kind=trace.SpanKind.PRODUCER) as span:
        span.set_attribute("messaging.system", "kafka")
        span.set_attribute("messaging.destination.name", "orders")

        # Inject trace context into message headers
        headers: dict[str, str] = {}
        propagation.inject(headers)

        kafka_headers = [(k, v.encode()) for k, v in headers.items()]
        producer.produce(
            "orders",
            value=json.dumps(order).encode(),
            headers=kafka_headers,
        )
        producer.flush()

# Consumer — extract trace context from message headers
def consume_order_event(msg):
    headers = {k: v.decode() for k, v in (msg.headers() or [])}
    parent_ctx = propagation.extract(headers)

    with tracer.start_as_current_span(
        "process_order",
        context=parent_ctx,
        kind=trace.SpanKind.CONSUMER,
        attributes={"messaging.system": "kafka", "messaging.destination.name": "orders"},
    ):
        process(msg.value())
```

---

## 4. Span Attributes and Semantic Conventions

### Standard Semantic Conventions (OpenTelemetry)

```
NAMESPACE          KEY ATTRIBUTES                    EXAMPLE VALUES
───────────────────────────────────────────────────────────────────────────
http               http.request.method               GET, POST
                   http.response.status_code         200, 500
                   url.full                          https://api.example.com/v1/orders
                   server.address                    api.example.com

db                 db.system                         postgresql, redis, mongodb
                   db.namespace                      orders_db
                   db.operation.name                 SELECT, INSERT
                   db.query.text                     SELECT * FROM orders WHERE id=$1

rpc                rpc.system                        grpc
                   rpc.service                       OrderService
                   rpc.method                        GetOrder
                   rpc.grpc.status_code              0 (OK), 2 (UNKNOWN)

messaging          messaging.system                  kafka, rabbitmq, sqs
                   messaging.destination.name        orders-topic
                   messaging.operation.type          publish, receive, process

cloud              cloud.provider                    aws, gcp, azure
                   cloud.region                      us-east-1

service            service.name                      order-service
                   service.version                   1.4.2
                   deployment.environment.name       production
```

### Custom Attributes

```typescript
// Add business-relevant attributes to spans
span.setAttributes({
  'order.id': orderId,
  'order.total': total,
  'customer.tier': 'enterprise',
  'feature.flag.new_checkout': true,
});

// NEVER put PII in span attributes:
// span.setAttribute('user.email', email);    // BAD
// span.setAttribute('user.ssn', ssn);        // BAD
span.setAttribute('user.id', hashedUserId);    // OK — pseudonymized
```

---

## 5. Trace Sampling Strategies

### Head-Based Sampling

```
DECISION AT TRACE START — root service decides, all downstream services honor it.

PROBABILISTIC:
  Keep N% of all traces. Simple, predictable cost.
  10% sampling at 10K req/s = 1K traces/s stored.

RATE-LIMITING:
  Keep at most N traces per second regardless of traffic.
  Useful for cost control during traffic spikes.

PARENT-BASED (recommended default):
  If parent span is sampled → sample child.
  If parent span is not sampled → do not sample child.
  If no parent (root) → delegate to inner sampler (e.g., TraceIdRatio).
  Ensures entire traces are either fully sampled or fully dropped.
```

```yaml
# OTel SDK configuration — parent-based with 10% root sampling
# environment variables approach (language-agnostic)
OTEL_TRACES_SAMPLER: parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG: "0.1"
```

### Tail-Based Sampling

```yaml
# OTel Collector tail_sampling processor
# Decision made AFTER the complete trace is buffered
processors:
  tail_sampling:
    decision_wait: 30s
    num_traces: 200000
    expected_new_traces_per_sec: 5000
    policies:
      # Keep ALL error traces
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }

      # Keep ALL traces slower than 2 seconds
      - name: slow-requests
        type: latency
        latency: { threshold_ms: 2000 }

      # Keep traces from critical services
      - name: critical-services
        type: string_attribute
        string_attribute:
          key: service.name
          values: [payment-service, auth-service]

      # Keep traces with specific HTTP error codes
      - name: http-errors
        type: numeric_attribute
        numeric_attribute:
          key: http.response.status_code
          min_value: 500
          max_value: 599

      # Composite: combine multiple conditions
      - name: composite
        type: composite
        composite:
          max_total_spans_per_second: 1000
          policy_order: [errors, slow-requests, critical-services, default]
          rate_allocation:
            - policy: errors
              percent: 40
            - policy: slow-requests
              percent: 30
            - policy: critical-services
              percent: 20
            - policy: default
              percent: 10

      # Sample remaining traces at 5%
      - name: default
        type: probabilistic
        probabilistic: { sampling_percentage: 5 }
```

### Sampling Decision Flow

```
REQUEST ARRIVES
    │
    ├── Has parent context?
    │     ├── YES: parent sampled? → follow parent decision
    │     └── NO (root span):
    │           ├── HEAD-BASED: decide now (probabilistic / rate-limit)
    │           └── Propagate decision downstream via trace-flags
    │
    ├── All spans sent to Collector (even if "not sampled" in some configs)
    │
    └── TAIL-BASED (at Collector):
          ├── Buffer spans for decision_wait seconds
          ├── Evaluate policies against complete trace
          └── Export sampled traces / drop unsampled
```

---

## 6. Trace Context in Async Workflows

### Event-Driven Architecture

```
CHALLENGE:
  In async systems, the consumer may process a message minutes or hours
  after the producer sent it. The trace context must survive this gap.

SOLUTION:
  1. PRODUCER injects trace context into message headers/attributes.
  2. CONSUMER extracts context and creates a CONSUMER span linked to the
     original trace. This preserves end-to-end visibility.
  3. For batch processing, use SPAN LINKS to connect a batch span to
     multiple originating traces.
```

```go
// Go — span links for batch processing
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/trace"
)

func processBatch(ctx context.Context, messages []Message) {
    tracer := otel.Tracer("batch-processor")

    // Create links to each originating trace
    var links []trace.Link
    for _, msg := range messages {
        parentCtx := extractContext(msg.Headers)
        sc := trace.SpanContextFromContext(parentCtx)
        if sc.IsValid() {
            links = append(links, trace.Link{SpanContext: sc})
        }
    }

    ctx, span := tracer.Start(ctx, "process_batch",
        trace.WithSpanKind(trace.SpanKindConsumer),
        trace.WithLinks(links...),
    )
    defer span.End()

    span.SetAttributes(
        attribute.Int("batch.size", len(messages)),
    )

    for _, msg := range messages {
        processMessage(ctx, msg)
    }
}
```

---

## 7. Trace Visualization and Analysis

### Service Maps and Dependency Graphs

```
SERVICE MAP (auto-generated from trace data):
  ┌──────────┐     ┌──────────────┐     ┌────────────┐
  │ Frontend │────▶│ API Gateway  │────▶│ Order Svc  │
  └──────────┘     └──────────────┘     └─────┬──────┘
                                              │
                          ┌───────────────────┼──────────────┐
                          ▼                   ▼              ▼
                   ┌────────────┐    ┌──────────────┐  ┌──────────┐
                   │ Payment Svc│    │ Inventory Svc│  │ PostgreSQL│
                   └─────┬──────┘    └──────────────┘  └──────────┘
                         ▼
                   ┌────────────┐
                   │ Stripe API │
                   └────────────┘

  Each edge shows: request rate, error rate, p50/p95/p99 latency.
  Service maps help answer: "what calls what?" and "where are errors?"
```

### Analysis Patterns

```
LATENCY DEBUGGING:
  1. Search for traces with high latency (p99 > SLO)
  2. Open waterfall view — identify longest span
  3. Check: is it a single slow span or cumulative?
  4. Drill into slow span attributes (db.query.text, http.url)
  5. Compare with normal-latency traces for same operation

ERROR CORRELATION:
  1. Filter traces by status = ERROR
  2. Group by service.name + error type
  3. Check if errors correlate with a specific deploy (service.version)
  4. Use trace → log correlation (trace_id in log records)

DEPENDENCY ANALYSIS:
  1. Query service map for fan-out patterns
  2. Identify services with high fan-out (single request → many downstream)
  3. Check for synchronous chains that could be parallelized
  4. Detect circular dependencies

TRACE COMPARISON:
  1. Compare slow trace vs fast trace side-by-side
  2. Diff span counts, durations, attribute values
  3. Identify which service or operation diverges
```

---

## 8. Operational Deployment Considerations

### Trace ID in All Signals

```yaml
# Correlate traces with logs and metrics
# Inject trace_id into structured logs
# (most OTel SDK log bridges do this automatically)

# Exemplars: attach trace_id to metric data points
# Prometheus exemplar format:
http_request_duration_seconds_bucket{le="0.5"} 1000 # {trace_id="abc123"}
```

```typescript
// Ensure trace_id appears in every log line
import { trace } from '@opentelemetry/api';
import { Logger } from 'winston';

function logWithTrace(logger: Logger, message: string, data?: object) {
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId;
  const spanId = span?.spanContext().spanId;

  logger.info(message, {
    ...data,
    trace_id: traceId,
    span_id: spanId,
  });
}
```

### Resource Attributes

```yaml
# Every service MUST set resource attributes for trace data to be useful
OTEL_RESOURCE_ATTRIBUTES: >
  service.name=order-service,
  service.version=1.4.2,
  deployment.environment.name=production,
  service.namespace=ecommerce,
  cloud.provider=aws,
  cloud.region=us-east-1,
  k8s.namespace.name=production,
  k8s.deployment.name=order-service
```

---

## Best Practices

| #  | Practice                                   | Description                                                                                           |
|----|--------------------------------------------|-------------------------------------------------------------------------------------------------------|
| 1  | Use W3C Trace Context everywhere           | Standardize on `traceparent`/`tracestate` headers. Avoid vendor-specific formats (B3, Jaeger) unless required for legacy. |
| 2  | Enforce parent-based sampling              | Use `parentbased_traceidratio` as default sampler. Ensures traces are fully sampled or fully dropped.  |
| 3  | Set `service.name` on every service        | Without `service.name`, trace data is unattributable. Make it a deployment requirement.                |
| 4  | Propagate context through ALL boundaries   | HTTP, gRPC, message queues, cron jobs, batch processors — every handoff must carry trace context.      |
| 5  | Add business attributes to spans           | Include order_id, customer_tier, feature_flag values. These enable powerful filtering and debugging.    |
| 6  | Use tail-based sampling for critical paths | Always keep error traces and slow traces. Use probabilistic sampling only for the remainder.           |
| 7  | Keep span names low-cardinality            | Use `GET /api/orders/{id}` not `GET /api/orders/12345`. High-cardinality names break aggregation.      |
| 8  | Correlate traces with logs and metrics     | Include `trace_id` in log records. Use exemplars to link metrics to traces.                            |
| 9  | Record errors properly on spans            | Call `span.recordException(err)` AND `span.setStatus(ERROR)`. Both are needed for full visibility.     |
| 10 | Avoid PII in span attributes               | Never store emails, SSNs, or tokens in trace data. Use pseudonymized user IDs.                        |

---

## Anti-Patterns

| #  | Anti-Pattern                              | Problem                                                    | Fix                                                         |
|----|-------------------------------------------|------------------------------------------------------------|--------------------------------------------------------------|
| 1  | No sampling strategy                      | 100% sampling at scale causes storage explosion and cost    | Configure head-based + tail-based sampling with clear policies |
| 2  | High-cardinality span names               | `GET /users/12345` creates millions of unique span names    | Use route templates: `GET /users/{userId}`                    |
| 3  | Missing context propagation               | Traces break at service boundaries, showing disconnected spans | Instrument every HTTP client, gRPC client, and message producer |
| 4  | PII in span attributes                    | Trace data stored with personal data creates compliance risk | Redact or hash PII; use the OTel Collector's attributes processor |
| 5  | Ignoring async boundaries                 | Message queue consumers start new traces instead of continuing | Extract parent context from message headers in every consumer  |
| 6  | Recording only errors                     | Healthy traces are needed for baseline comparison           | Sample a percentage of successful traces for normal behavior   |
| 7  | Inconsistent resource attributes          | Different services use different naming for the same attribute | Enforce semantic conventions via OTel Collector's resource processor |
| 8  | Trace data without log/metric correlation | Traces exist in isolation; debugging requires manual joining | Inject trace_id into logs; use exemplars in metrics            |

---

## Enforcement Checklist

```
DEPLOYMENT:
  [ ] W3C Trace Context propagation enabled on all services
  [ ] service.name and service.version set via OTEL_RESOURCE_ATTRIBUTES
  [ ] deployment.environment.name set (production, staging, development)
  [ ] OTel Collector deployed with tail-based sampling policies
  [ ] Head-based sampler set to parentbased_traceidratio on all SDKs

INSTRUMENTATION:
  [ ] Auto-instrumentation enabled for HTTP, gRPC, database clients
  [ ] Manual spans added for significant business operations
  [ ] Span names use low-cardinality route templates
  [ ] Error spans call both recordException() and setStatus(ERROR)
  [ ] Message producers inject and consumers extract trace context

DATA QUALITY:
  [ ] No PII in span attributes (verified by Collector redaction rules)
  [ ] Semantic conventions followed for all standard attributes
  [ ] Business attributes (order_id, tenant_id) added where relevant
  [ ] Baggage used sparingly (< 5 key-value pairs)

OPERATIONS:
  [ ] Tail-based sampling keeps 100% of error and high-latency traces
  [ ] Trace retention configured (7-30 days based on cost/need)
  [ ] Service map reviewed weekly for unexpected dependencies
  [ ] Trace-to-log correlation verified (trace_id in log records)
  [ ] Alerting configured on trace error rate and latency percentiles
```
