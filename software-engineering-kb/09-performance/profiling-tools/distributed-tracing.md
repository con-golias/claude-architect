# Distributed Tracing — End-to-End Request Tracking

> **Domain:** Profiling Tools > Distributed Tracing
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/profiling-tools/apm-tools.md, 09-performance/profiling-tools/backend-profilers.md

> **Directive:** Implement distributed tracing as the primary debugging and performance analysis tool for microservice architectures. Standardize on OpenTelemetry with W3C Trace Context propagation. Use tracing to detect latency regressions, map service dependencies, and correlate with logs and metrics. Every production request must be traceable.

---

## 1. Core Concepts

```
TRACE ANATOMY:
  Trace (unique trace_id) contains Spans in parent-child tree:
    Span A: API Gateway (root)  ──┬── Span B: Order Service
       trace_id: abc123           │     ├── Span C: DB Query
       span_id: span-1           │     └── Span D: Cache Lookup
                                  └── Span E: Payment Service

SPAN FIELDS:
  trace_id:    128-bit globally unique     span_id:   64-bit unique within trace
  parent_id:   span_id of parent           name:      operation ("GET /orders")
  kind:        CLIENT|SERVER|PRODUCER|CONSUMER|INTERNAL
  start/end:   microsecond timestamps      status:    OK|ERROR|UNSET
  attributes:  key-value metadata          events:    timestamped annotations
  links:       references to other traces (batch jobs)
```

## 2. W3C Trace Context Propagation

```
HTTP HEADER FORMAT (W3C standard):
  traceparent: 00-<trace_id>-<parent_span_id>-<trace_flags>
  tracestate:  vendor=value,vendor2=value2

EXAMPLE:
  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
                ││                                  │                  │
                ││                                  │                  └─ sampled
                ││                                  └─ parent span id (16 hex)
                │└─ trace id (32 hex chars)
                └─ version

PROPAGATION ACROSS BOUNDARIES:
  HTTP:    traceparent / tracestate headers
  gRPC:    grpc-trace-bin binary header (or W3C text)
  Kafka:   message headers (traceparent in header map)
  SQS/SNS: message attributes
  RabbitMQ: message headers
```

```python
# Manual context propagation (when auto-instrumentation misses a boundary)
from opentelemetry import context
from opentelemetry.trace.propagation import TraceContextTextMapPropagator

propagator = TraceContextTextMapPropagator()

def inject_context(headers: dict):   # Inject into outgoing request
    propagator.inject(headers)
    return headers

def extract_context(headers: dict):  # Extract from incoming request
    ctx = propagator.extract(carrier=headers)
    return context.attach(ctx)        # detach when done: context.detach(token)
```

```go
// Go — propagation setup + injection into outgoing HTTP
import "go.opentelemetry.io/otel/propagation"

func init() {
    otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
        propagation.TraceContext{}, propagation.Baggage{},
    ))
}

func callDownstream(ctx context.Context, url string) {
    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))
    http.DefaultClient.Do(req)
}
```

## 3. Sampling Strategies

```
HEAD-BASED SAMPLING:
  Decision made at trace START (root span)
  ├── Consistent: same trace_id always sampled or not
  ├── Low overhead: no need to buffer spans
  └── Downside: may miss rare errors/slow requests

  TraceIdRatio sampler:
    10% sampling → keeps 1 in 10 traces
    Always sample: ratio = 1.0
    Never sample:  ratio = 0.0

TAIL-BASED SAMPLING:
  Decision made AFTER trace completes (at collector)
  ├── Sees full trace before deciding
  ├── Keep 100% of errors, slow requests, specific attributes
  ├── Sample normal requests at lower rate
  └── Downside: requires buffering all spans temporarily

ADAPTIVE/DYNAMIC SAMPLING:
  Adjusts rate based on traffic volume and conditions
  ├── High traffic → lower sample rate
  ├── Low traffic → higher sample rate (maintain minimum)
  └── Always keep: errors, new endpoints, high-latency
```

```yaml
# OTel Collector — tail-based sampling config
processors:
  tail_sampling:
    decision_wait: 10s          # buffer window before deciding
    num_traces: 100000          # max traces in buffer
    expected_new_traces_per_sec: 1000
    policies:
      # Always keep errors
      - name: errors-policy
        type: status_code
        status_code:
          status_codes: [ERROR]
      # Always keep slow requests (> 2s)
      - name: latency-policy
        type: latency
        latency:
          threshold_ms: 2000
      # Keep traces with specific attributes
      - name: high-value-policy
        type: string_attribute
        string_attribute:
          key: customer.tier
          values: [enterprise, premium]
      # Sample everything else at 5%
      - name: default-policy
        type: probabilistic
        probabilistic:
          sampling_percentage: 5
```

```python
# Python — head-based sampling: 10% of root spans, follow parent decision
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased, ParentBased
from opentelemetry.sdk.trace import TracerProvider

sampler = ParentBased(root=TraceIdRatioBased(0.1))
tp = TracerProvider(sampler=sampler)
```

## 4. Backend Platforms

### Jaeger

```yaml
# docker-compose.yml — Jaeger all-in-one
services:
  jaeger:
    image: jaegertracing/all-in-one:1.55
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
      - "14268:14268"  # Jaeger HTTP collector

# Production: use jaeger-collector + Elasticsearch/Cassandra backend
# jaeger-query connects to same storage for UI
```

### Grafana Tempo

```yaml
# tempo.yaml — Tempo with S3 backend (production)
server:
  http_listen_port: 3200
distributor:
  receivers:
    otlp:
      protocols:
        grpc: { endpoint: "0.0.0.0:4317" }
storage:
  trace:
    backend: s3
    s3: { bucket: tempo-traces, endpoint: s3.amazonaws.com, region: us-east-1 }
    wal: { path: /var/tempo/wal }
metrics_generator:
  storage:
    path: /var/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
```

### Zipkin

```bash
docker run -d -p 9411:9411 openzipkin/zipkin
# OTel export: exporters.zipkin.endpoint = "http://zipkin:9411/api/v2/spans"
```

## 5. Trace-Log-Metric Correlation

```python
# Python — inject trace context into structured logs
import logging
import json
from opentelemetry import trace

class TraceContextFilter(logging.Filter):
    def filter(self, record):
        span = trace.get_current_span()
        ctx = span.get_span_context()
        record.trace_id = format(ctx.trace_id, '032x') if ctx.trace_id else ""
        record.span_id = format(ctx.span_id, '016x') if ctx.span_id else ""
        record.service_name = "order-service"
        return True

logger = logging.getLogger(__name__)
logger.addFilter(TraceContextFilter())

# JSON formatter for log aggregation
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '{"time":"%(asctime)s","level":"%(levelname)s","message":"%(message)s",'
    '"trace_id":"%(trace_id)s","span_id":"%(span_id)s","service":"%(service_name)s"}'
))
logger.addHandler(handler)
```

```go
// Go — structured logging with trace context (slog)
import (
    "log/slog"
    "go.opentelemetry.io/otel/trace"
)

func LogWithTrace(ctx context.Context, msg string, attrs ...slog.Attr) {
    span := trace.SpanFromContext(ctx)
    sc := span.SpanContext()
    attrs = append(attrs,
        slog.String("trace_id", sc.TraceID().String()),
        slog.String("span_id", sc.SpanID().String()),
    )
    slog.LogAttrs(ctx, slog.LevelInfo, msg, attrs...)
}
```

## 6. Trace-Based Testing

```python
# Validate trace structure in integration tests
import requests

def test_order_creates_expected_spans():
    """Verify distributed trace spans are created correctly."""
    resp = requests.post("http://localhost:8080/orders", json={"item": "widget"})
    trace_id = resp.headers.get("x-trace-id")

    # Query Jaeger/Tempo API for the trace
    import time; time.sleep(2)  # allow flush
    trace_resp = requests.get(
        f"http://jaeger:16686/api/traces/{trace_id}"
    )
    spans = trace_resp.json()["data"][0]["spans"]

    span_names = {s["operationName"] for s in spans}
    assert "POST /orders" in span_names
    assert "INSERT orders" in span_names
    assert "publish order.created" in span_names

    # Verify parent-child relationships
    root = next(s for s in spans if s["operationName"] == "POST /orders")
    db_span = next(s for s in spans if s["operationName"] == "INSERT orders")
    assert db_span["references"][0]["spanID"] == root["spanID"]
```

## 7. Performance Regression Detection from Traces

```python
# Compare p95 latency per span across deployments
from collections import defaultdict
import numpy as np

def detect_regression(baseline_traces, canary_traces, threshold_pct=20):
    """Flag spans where canary is >20% slower than baseline."""
    baseline = _aggregate(baseline_traces)
    canary = _aggregate(canary_traces)
    return [
        {"span": name, "baseline_p95": baseline[name], "canary_p95": p95,
         "delta_pct": ((p95 - baseline[name]) / baseline[name]) * 100}
        for name, p95 in canary.items()
        if name in baseline and p95 > baseline[name] * (1 + threshold_pct / 100)
    ]

def _aggregate(traces):
    spans = defaultdict(list)
    for t in traces:
        for s in t["spans"]:
            spans[s["name"]].append((s["end_time"] - s["start_time"]) / 1000)
    return {n: np.percentile(d, 95) for n, d in spans.items()}
```

```yaml
# Grafana alert rule — regression detection from Tempo metrics
# Uses metrics_generator to derive RED metrics from traces
groups:
  - name: trace-regression
    rules:
      - alert: SpanLatencyRegression
        expr: |
          histogram_quantile(0.95,
            sum(rate(traces_spanmetrics_latency_bucket{service="order-service"}[5m]))
            by (le, span_name)
          ) > 1.2 * histogram_quantile(0.95,
            sum(rate(traces_spanmetrics_latency_bucket{service="order-service"}[5m] offset 1d))
            by (le, span_name)
          )
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Span {{ $labels.span_name }} p95 latency increased >20% vs yesterday"
```

## 8. Span Attributes Best Practices

```
SEMANTIC CONVENTIONS (OpenTelemetry standard):
  HTTP:
    http.request.method = "POST"
    url.path = "/api/orders"
    http.response.status_code = 200
    server.address = "api.example.com"
  DATABASE:
    db.system = "postgresql"
    db.statement = "SELECT * FROM orders WHERE id = ?"
    db.operation.name = "SELECT"
    db.collection.name = "orders"
  MESSAGING:
    messaging.system = "kafka"
    messaging.destination.name = "order-events"
    messaging.operation.type = "publish"
  RPC:
    rpc.system = "grpc"
    rpc.service = "OrderService"
    rpc.method = "CreateOrder"
    rpc.grpc.status_code = 0

CUSTOM BUSINESS ATTRIBUTES:
    order.id = "ord-12345"
    order.total_cents = 4999
    customer.tier = "premium"
    feature_flag.checkout_v2 = true
```

---

## 10 Best Practices

1. **Use OpenTelemetry as the instrumentation standard** -- vendor-neutral, widely supported, future-proof
2. **Propagate W3C Trace Context across all boundaries** -- HTTP, gRPC, message queues, async jobs
3. **Implement tail-based sampling** -- keep 100% of errors and slow traces, sample normal traffic
4. **Add business-relevant span attributes** -- order IDs, customer tier, feature flags enable debugging
5. **Correlate traces with logs via trace_id** -- inject trace context into every log record
6. **Name spans by operation, not by URL parameters** -- "GET /users/:id" not "GET /users/12345"
7. **Set span status to ERROR on failures** -- enables sampling policies and error-rate dashboards
8. **Test trace structure in integration tests** -- verify expected spans and parent-child relationships
9. **Use metrics_generator to derive RED metrics from traces** -- single instrumentation, dual signal
10. **Monitor sampling rates** -- ensure error and slow-request retention is truly 100%

## 8 Anti-Patterns

1. **No context propagation across async boundaries** -- traces break at message queues, losing end-to-end visibility
2. **High-cardinality span names** -- "GET /users/12345" creates millions of unique span names, breaking aggregation
3. **Logging full request/response bodies as span attributes** -- bloats trace storage, may leak PII
4. **Head-based sampling only** -- misses rare but critical error traces
5. **No span status on errors** -- errors appear as successful spans, invisible to alerting
6. **Instrumenting only HTTP edges** -- missing database, cache, and internal function spans hides true bottlenecks
7. **Ignoring clock skew in cross-service spans** -- NTP drift causes parent spans appearing shorter than children
8. **No trace-based regression detection** -- deploying without comparing span latencies to baseline

## Enforcement Checklist

- [ ] OpenTelemetry SDK integrated in all services with W3C Trace Context propagation
- [ ] Auto-instrumentation enabled for HTTP, database, gRPC, and messaging
- [ ] Custom spans added for critical business operations with semantic attributes
- [ ] Tail-based sampling configured: 100% errors, 100% slow requests, N% normal
- [ ] Trace-log correlation active: trace_id injected into all structured logs
- [ ] Trace backend deployed (Jaeger, Tempo, or vendor) with adequate retention
- [ ] Regression detection alerts based on span-level p95 latency comparisons
- [ ] Integration tests validate trace structure for critical request paths
