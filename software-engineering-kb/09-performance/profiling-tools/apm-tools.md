# APM Tools — Application Performance Monitoring

> **Domain:** Profiling Tools > Application Performance Monitoring
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/profiling-tools/distributed-tracing.md, 09-performance/profiling-tools/backend-profilers.md

> **Directive:** Deploy APM as the foundation of production observability. Use APM for real-time latency tracking, error rate monitoring, throughput analysis, and service dependency mapping. Standardize on OpenTelemetry for instrumentation. Choose APM vendors based on retention, cost, and correlation capabilities.

---

## 1. Core APM Metrics

```
THE FOUR GOLDEN SIGNALS (Google SRE):
┌──────────────┬────────────────────────────────────────────┐
│ Signal       │ What It Measures                           │
├──────────────┼────────────────────────────────────────────┤
│ Latency      │ Time to serve a request (p50/p95/p99)     │
│ Traffic      │ Requests per second (throughput)           │
│ Errors       │ Rate of failed requests (5xx, exceptions) │
│ Saturation   │ Resource utilization (CPU, memory, queue) │
└──────────────┴────────────────────────────────────────────┘

RED METHOD (microservices):
  Rate:     Requests per second
  Errors:   Errors per second
  Duration: Latency histogram (percentiles)

APDEX SCORE (Application Performance Index):
  Apdex = (Satisfied + Tolerating/2) / Total
  Satisfied:  response_time < T (threshold, e.g., 500ms)
  Tolerating: response_time < 4T
  Frustrated: response_time >= 4T
  Target: Apdex >= 0.9
```

## 2. APM Platform Comparison

```
┌──────────────────┬──────────┬───────────┬──────────────────────────┐
│ Platform         │ Pricing  │ OTel      │ Key Differentiator       │
├──────────────────┼──────────┼───────────┼──────────────────────────┤
│ Datadog APM      │ $$$$     │ Full      │ Unified infra+APM+logs   │
│ New Relic        │ $$$      │ Full      │ Generous free tier (100GB)│
│ Dynatrace        │ $$$$     │ Full      │ AI-powered root cause    │
│ Elastic APM      │ $$       │ Full      │ Self-hosted option       │
│ Grafana Cloud    │ $$       │ Native    │ OSS-native (Tempo+Loki)  │
│ Honeycomb        │ $$$      │ Full      │ High-cardinality queries │
│ SigNoz (OSS)     │ Free     │ Native    │ Self-hosted, OTel-native │
│ Uptrace (OSS)    │ Free     │ Native    │ ClickHouse-backed        │
└──────────────────┴──────────┴───────────┴──────────────────────────┘
```

## 3. OpenTelemetry Integration (Standard)

### Auto-Instrumentation

```python
# Python — auto-instrumentation (zero code changes)
# pip install opentelemetry-distro opentelemetry-exporter-otlp
# opentelemetry-bootstrap -a install  # installs all detected instrumentors

# Run with auto-instrumentation
# opentelemetry-instrument \
#   --traces_exporter otlp \
#   --metrics_exporter otlp \
#   --exporter_otlp_endpoint http://otel-collector:4317 \
#   --service_name my-service \
#   python app.py
```

```javascript
// Node.js — auto-instrumentation (tracing.js, loaded first)
// npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { getNodeAutoInstrumentations } = require(
  '@opentelemetry/auto-instrumentations-node'
);

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'order-service',
});
sdk.start();
// Run: node --require ./tracing.js app.js
```

```go
// Go — manual setup with auto-instrumentation libraries
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/sdk/trace"
    "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func initTracer() func() {
    exporter, _ := otlptracegrpc.New(context.Background(),
        otlptracegrpc.WithEndpoint("otel-collector:4317"),
        otlptracegrpc.WithInsecure(),
    )
    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
        trace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName("payment-service"),
        )),
    )
    otel.SetTracerProvider(tp)
    return func() { tp.Shutdown(context.Background()) }
}

// Auto-instrument HTTP handlers
mux := http.NewServeMux()
mux.Handle("/pay", otelhttp.NewHandler(payHandler, "POST /pay"))
```

### Manual Instrumentation

```python
# Python — custom spans for business logic
from opentelemetry import trace

tracer = trace.get_tracer("order-service")

def process_order(order):
    with tracer.start_as_current_span("process_order") as span:
        span.set_attribute("order.id", order.id)
        span.set_attribute("order.total", order.total)
        span.set_attribute("order.items_count", len(order.items))

        with tracer.start_as_current_span("validate_inventory"):
            check_inventory(order.items)

        with tracer.start_as_current_span("charge_payment") as pay_span:
            result = charge(order)
            pay_span.set_attribute("payment.method", result.method)
            pay_span.set_attribute("payment.status", result.status)

        if result.status == "failed":
            span.set_status(trace.StatusCode.ERROR, "Payment failed")
            span.record_exception(PaymentError(result.error))
```

## 4. Datadog APM Setup

```yaml
# docker-compose.yml — Datadog agent + OTel collector
services:
  datadog-agent:
    image: gcr.io/datadoghq/agent:7
    environment:
      - DD_API_KEY=${DD_API_KEY}
      - DD_APM_ENABLED=true
      - DD_APM_NON_LOCAL_TRAFFIC=true
      - DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_GRPC_ENDPOINT=0.0.0.0:4317
      - DD_LOGS_ENABLED=true
      - DD_PROCESS_AGENT_ENABLED=true
    ports:
      - "8126:8126"   # Datadog trace intake
      - "4317:4317"   # OTLP gRPC
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /proc/:/host/proc/:ro
```

```python
# Datadog-native Python instrumentation (alternative to OTel)
# pip install ddtrace
# ddtrace-run python app.py

# Manual spans with ddtrace
from ddtrace import tracer

@tracer.wrap(service="order-service", resource="process_order")
def process_order(order_id):
    span = tracer.current_span()
    span.set_tag("order.id", order_id)
    # ... business logic ...
```

## 5. Grafana Cloud Stack (OSS-Friendly)

```yaml
# docker-compose.yml — Grafana + Tempo + Loki + Prometheus
services:
  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
    ports:
      - "4317:4317"    # OTLP gRPC
      - "3200:3200"    # Tempo API

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
    ports:
      - "3000:3000"
```

```yaml
# tempo.yaml — Trace storage config
server:
  http_listen_port: 3200
distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: "0.0.0.0:4317"
storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces
    pool:
      max_workers: 100
metrics_generator:
  registry:
    external_labels:
      source: tempo
  storage:
    path: /var/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
```

## 6. SigNoz (Open-Source APM)

```bash
# Quick install with Docker Compose
git clone -b main https://github.com/SigNoz/signoz.git
cd signoz/deploy && docker compose -f docker-compose.yaml up -d

# Access: http://localhost:3301
# OTel endpoint: localhost:4317 (gRPC) / localhost:4318 (HTTP)

# Configure app to send traces
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_SERVICE_NAME=my-service
```

## 7. OTel Collector Configuration

```yaml
# otel-collector-config.yaml — Central collection pipeline
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "0.0.0.0:4317"
      http:
        endpoint: "0.0.0.0:4318"

processors:
  batch:
    timeout: 5s
    send_batch_size: 1000
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
  attributes:
    actions:
      - key: environment
        value: production
        action: upsert
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow-requests
        type: latency
        latency: { threshold_ms: 1000 }
      - name: probabilistic
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

exporters:
  otlp/tempo:
    endpoint: "tempo:4317"
    tls:
      insecure: true
  prometheus:
    endpoint: "0.0.0.0:8889"
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes, tail_sampling]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
```

## 8. Key APM Dashboards

```
ESSENTIAL DASHBOARDS:
1. Service Overview:
   - p50/p95/p99 latency (time series)
   - Request rate (throughput)
   - Error rate (%) with breakdown by status code
   - Apdex score trend

2. Service Map:
   - Dependency graph with latency on edges
   - Error rate per service node
   - Throughput flow visualization

3. Database Performance:
   - Slow query list (> p95 threshold)
   - Query count by operation type
   - Connection pool utilization

4. Infrastructure Correlation:
   - CPU/memory aligned with latency spikes
   - GC pause duration correlated with p99
   - Container restart events on latency timeline

ALERTING RULES:
  p99 latency > 2x baseline for 5 minutes → PagerDuty
  Error rate > 1% for 3 minutes → Slack + PagerDuty
  Apdex < 0.85 for 10 minutes → Slack
  Throughput drop > 30% → Slack (possible upstream failure)
```

---

## 10 Best Practices

1. **Standardize on OpenTelemetry** -- vendor-neutral instrumentation; switch backends without code changes
2. **Start with auto-instrumentation** -- covers HTTP, DB, gRPC, messaging out-of-the-box
3. **Add manual spans for business logic** -- auto-instrumentation misses domain-specific operations
4. **Set meaningful service names and versions** -- `service.name` and `service.version` enable deployment correlation
5. **Track p99 latency, not just p50** -- tail latency affects your most engaged users
6. **Alert on rate-of-change, not absolutes** -- "2x baseline" catches regressions regardless of scale
7. **Correlate traces with logs and metrics** -- inject trace_id into log records for end-to-end debugging
8. **Use tail-based sampling in production** -- keep 100% of errors and slow requests, sample the rest
9. **Deploy OTel Collector as a sidecar/agent** -- decouple instrumentation from export destination
10. **Monitor APM costs** -- high-cardinality attributes and 100% sampling can explode vendor bills

## 8 Anti-Patterns

1. **100% trace sampling in production** -- generates massive data volume; use head or tail sampling
2. **Vendor-locked instrumentation** -- Datadog's dd-trace or New Relic agent without OTel makes migration painful
3. **No custom spans beyond auto-instrumentation** -- auto-instrumentation shows HTTP calls, not business logic
4. **Alerting on averages** -- average latency hides p99 spikes that affect real users
5. **Ignoring service maps** -- debugging without dependency visualization misses cascading failures
6. **No log-trace correlation** -- investigating errors without linked traces doubles debugging time
7. **APM in staging only** -- staging traffic patterns differ from production; APM must run in prod
8. **Over-tagging with high-cardinality attributes** -- user_id as a span attribute on every span explodes storage costs

## Enforcement Checklist

- [ ] OpenTelemetry SDK integrated in all services
- [ ] Auto-instrumentation enabled for HTTP, database, and messaging frameworks
- [ ] Manual spans added for critical business operations
- [ ] OTel Collector deployed with tail-based sampling
- [ ] Service names and versions set via resource attributes
- [ ] Trace-log correlation configured (trace_id in structured logs)
- [ ] APM dashboards created for latency, error rate, throughput per service
- [ ] Alerting rules set for p99 latency and error rate thresholds
