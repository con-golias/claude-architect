# OpenTelemetry — The Observability Standard

| Attribute     | Value                                                                                          |
|---------------|------------------------------------------------------------------------------------------------|
| Domain        | DevOps > Observability > Tracing                                                               |
| Importance    | Critical                                                                                       |
| Last Updated  | 2026-03                                                                                        |
| Cross-ref     | [Distributed Tracing](distributed-tracing.md), [Jaeger & Zipkin](jaeger-zipkin.md), [Three Pillars](../three-pillars.md) |

> **Directive:** Adopt OpenTelemetry as the single instrumentation standard for all observability signals (traces, metrics, logs). Use auto-instrumentation where available, manual instrumentation for business-critical spans, and the OTel Collector as the central telemetry pipeline. Never vendor-lock instrumentation code.

---

## 1. OpenTelemetry Architecture

```
SIGNALS:
  Traces   — distributed request tracking (spans, context propagation)
  Metrics  — numerical measurements (counters, histograms, gauges)
  Logs     — structured event records (correlated via trace context)
  Baggage  — cross-cutting key-value pairs propagated with context

ARCHITECTURE LAYERS:
  ┌─────────────────────────────────────────────────────────┐
  │  Application Code                                       │
  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
  │  │ OTel API │  │ OTel SDK │  │ Auto-Instrumentation │  │
  │  │ (stable) │  │(config,  │  │ (zero-code agents)   │  │
  │  │          │  │ sampling,│  │                       │  │
  │  │          │  │ export)  │  │                       │  │
  │  └──────────┘  └────┬─────┘  └───────────────────────┘  │
  └──────────────────────┼──────────────────────────────────┘
                         │ OTLP (gRPC/HTTP)
                         ▼
  ┌──────────────────────────────────────────────────────────┐
  │  OTel Collector                                          │
  │  ┌───────────┐  ┌────────────┐  ┌──────────────────┐    │
  │  │ Receivers │→ │ Processors │→ │ Exporters        │    │
  │  │ (OTLP,   │  │ (batch,   │  │ (Jaeger, Tempo,  │    │
  │  │  Jaeger, │  │  filter,  │  │  Prometheus,     │    │
  │  │  Zipkin) │  │  sampling)│  │  OTLP, Datadog)  │    │
  │  └───────────┘  └────────────┘  └──────────────────┘    │
  └──────────────────────────────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────────┐
  │  Backends: Jaeger, Grafana Tempo, Datadog, New Relic,    │
  │  Honeycomb, Prometheus, Elasticsearch, etc.              │
  └──────────────────────────────────────────────────────────┘

KEY PRINCIPLE:
  API = interface (vendor-neutral, safe to depend on)
  SDK = implementation (configurable, replaceable)
  Collector = pipeline (process, route, export telemetry)
```

---

## 2. OTel Collector Deployment Patterns

### Agent / Sidecar Pattern

```
┌─────────────────────────────┐
│ Pod / Host                  │
│ ┌─────────┐ ┌────────────┐ │      ┌────────────────┐
│ │ App     │→│ Collector  │─┼─────▶│ Backend        │
│ │         │ │ (sidecar)  │ │      │ (Jaeger/Tempo) │
│ └─────────┘ └────────────┘ │      └────────────────┘
└─────────────────────────────┘

ADVANTAGES: low-latency local export, per-pod resource control, isolation
USE WHEN: Kubernetes environments, need per-service processing
```

### Gateway Pattern

```
┌──────────┐
│ Service A│──┐
└──────────┘  │     ┌────────────────────┐      ┌──────────┐
┌──────────┐  ├────▶│ Collector Gateway  │─────▶│ Backend  │
│ Service B│──┤     │ (centralized)      │      └──────────┘
└──────────┘  │     └────────────────────┘
┌──────────┐  │
│ Service C│──┘
└──────────┘

ADVANTAGES: centralized config, tail-based sampling possible, fewer connections to backend
USE WHEN: need tail-based sampling, want single export point, cost control
```

### Recommended: Agent + Gateway (Two-Tier)

```
┌──────────────────────┐
│ Pod                   │
│ ┌───────┐ ┌────────┐ │     ┌───────────────────┐     ┌─────────┐
│ │ App   │→│ Agent  │─┼────▶│ Gateway Collector │────▶│ Backend │
│ └───────┘ └────────┘ │     │ (tail sampling,   │     └─────────┘
└──────────────────────┘     │  routing, export)  │
                              └───────────────────┘

Agent: lightweight, batch + resource detection only
Gateway: tail-based sampling, attribute processing, multi-backend export
```

### Full Collector Configuration

```yaml
# otel-collector-config.yaml — production gateway configuration
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  # Batch spans for efficient export
  batch:
    timeout: 5s
    send_batch_size: 8192
    send_batch_max_size: 16384

  # Add/modify resource attributes
  resource:
    attributes:
      - key: environment
        value: production
        action: upsert

  # Remove sensitive attributes
  attributes:
    actions:
      - key: http.request.header.authorization
        action: delete
      - key: db.query.text
        action: hash    # hash instead of delete to preserve uniqueness

  # Memory limiter to prevent OOM
  memory_limiter:
    check_interval: 5s
    limit_mib: 4096
    spike_limit_mib: 1024

  # Tail-based sampling (gateway only)
  tail_sampling:
    decision_wait: 30s
    num_traces: 200000
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 2000 }
      - name: default
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

exporters:
  otlp/tempo:
    endpoint: tempo-distributor:4317
    tls:
      insecure: false
      ca_file: /etc/tls/ca.crt

  otlp/jaeger:
    endpoint: jaeger-collector:4317
    tls:
      insecure: true    # internal network only

  debug:
    verbosity: basic    # for troubleshooting; disable in production

extensions:
  health_check:
    endpoint: 0.0.0.0:13133
  zpages:
    endpoint: 0.0.0.0:55679

service:
  extensions: [health_check, zpages]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes, tail_sampling]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [otlp/tempo]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [otlp/tempo]
```

---

## 3. Auto-Instrumentation (Zero-Code)

### Node.js

```bash
npm install @opentelemetry/auto-instrumentations-node @opentelemetry/sdk-node

# Environment variable approach (truly zero-code)
export OTEL_SERVICE_NAME=order-service
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
export OTEL_TRACES_SAMPLER=parentbased_traceidratio
export OTEL_TRACES_SAMPLER_ARG=0.1
export NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"
node app.js
```

### Python

```bash
# Install auto-instrumentation
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install  # auto-detects and installs instrumentations

# Run with auto-instrumentation
export OTEL_SERVICE_NAME=user-service
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
opentelemetry-instrument python app.py
```

### Java

```bash
# Download agent, then run with -javaagent flag
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.service.name=payment-service \
     -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
     -jar app.jar
```

---

## 4. Manual Instrumentation

### TypeScript

```typescript
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service', '1.0.0');

async function createOrder(userId: string, items: OrderItem[]): Promise<Order> {
  // Create a span for the business operation
  return tracer.startActiveSpan(
    'createOrder',
    { kind: SpanKind.INTERNAL },
    async (span) => {
      try {
        span.setAttributes({
          'user.id': userId,
          'order.item_count': items.length,
          'order.total': calculateTotal(items),
        });

        // Child span for database operation
        const order = await tracer.startActiveSpan('db.insert_order', async (dbSpan) => {
          dbSpan.setAttributes({
            'db.system': 'postgresql',
            'db.operation.name': 'INSERT',
            'db.namespace': 'orders',
          });
          try {
            const result = await db.orders.create({ userId, items });
            dbSpan.end();
            return result;
          } catch (err) {
            dbSpan.recordException(err as Error);
            dbSpan.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
            dbSpan.end();
            throw err;
          }
        });

        // Add event (timestamped annotation)
        span.addEvent('order.created', { 'order.id': order.id });

        span.setStatus({ code: SpanStatusCode.OK });
        return order;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
```

### Python

```python
from opentelemetry import trace

tracer = trace.get_tracer("payment-service", "1.0.0")

def process_payment(order_id: str, amount: float, currency: str) -> PaymentResult:
    with tracer.start_as_current_span(
        "process_payment",
        kind=trace.SpanKind.INTERNAL,
        attributes={
            "payment.order_id": order_id,
            "payment.amount": amount,
            "payment.currency": currency,
        },
    ) as span:
        try:
            # Child span for external API call
            with tracer.start_as_current_span(
                "stripe.charge",
                kind=trace.SpanKind.CLIENT,
                attributes={"rpc.system": "http", "server.address": "api.stripe.com"},
            ) as stripe_span:
                result = stripe_client.charges.create(amount=amount, currency=currency)
                stripe_span.set_attribute("payment.provider_id", result.id)

            span.add_event("payment.succeeded", {"payment.id": result.id})
            span.set_status(trace.StatusCode.OK)
            return PaymentResult(success=True, id=result.id)

        except StripeError as e:
            span.record_exception(e)
            span.set_status(trace.StatusCode.ERROR, str(e))
            span.add_event("payment.failed", {"error.type": type(e).__name__})
            raise
```

### Go

```go
package main

import (
    "context"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/codes"
    "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("inventory-service")

func CheckInventory(ctx context.Context, productID string, qty int) (bool, error) {
    ctx, span := tracer.Start(ctx, "CheckInventory",
        trace.WithSpanKind(trace.SpanKindInternal),
        trace.WithAttributes(
            attribute.String("product.id", productID),
            attribute.Int("product.quantity_requested", qty),
        ),
    )
    defer span.End()

    // Child span for database query
    available, err := queryStock(ctx, productID)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        return false, err
    }

    inStock := available >= qty
    span.SetAttributes(
        attribute.Int("product.quantity_available", available),
        attribute.Bool("product.in_stock", inStock),
    )

    if !inStock {
        span.AddEvent("inventory.insufficient", trace.WithAttributes(
            attribute.Int("product.shortage", qty-available),
        ))
    }

    span.SetStatus(codes.Ok, "")
    return inStock, nil
}

// queryStock follows the same pattern: Start span → defer End → RecordError on failure
```

---

## 5. SDK Configuration

### Resource Attributes

```yaml
# Set via environment variables (recommended for containers)
OTEL_SERVICE_NAME: order-service
OTEL_RESOURCE_ATTRIBUTES: >
  service.version=1.4.2,
  deployment.environment.name=production,
  service.namespace=ecommerce,
  cloud.provider=aws,
  cloud.region=us-east-1

# Resource detectors auto-populate cloud/container/host attributes
# Enable in SDK configuration:
OTEL_NODE_RESOURCE_DETECTORS: "env,host,os,container,aws"  # Node.js
```

### Exporter and Batch Configuration

```yaml
# OTLP exporter (gRPC is preferred over HTTP for throughput)
OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL: grpc
OTEL_EXPORTER_OTLP_COMPRESSION: gzip

# Batch span processor tuning
OTEL_BSP_MAX_QUEUE_SIZE: "8192"          # max spans queued before drop
OTEL_BSP_MAX_EXPORT_BATCH_SIZE: "512"    # max spans per export batch
OTEL_BSP_SCHEDULE_DELAY: "5000"          # export interval (ms)
OTEL_BSP_EXPORT_TIMEOUT: "30000"         # export timeout (ms)
```

---

## 6. Semantic Conventions

```
PURPOSE:
  Standardized attribute names ensure consistent data across all services
  and languages. Backends can build features (service maps, DB dashboards)
  only because attribute names are predictable.

STATUS (2025-2026):
  HTTP semantic conventions — STABLE (v1.27+)
  Database semantic conventions — STABLE
  Messaging semantic conventions — STABLE
  RPC semantic conventions — STABLE
  Cloud resource conventions — STABLE

MIGRATION:
  Old: http.method, http.status_code, http.url
  New: http.request.method, http.response.status_code, url.full
  Use the Collector's transform processor to migrate old → new format.
```

---

## 7. Context Propagation API

```typescript
// Manual context propagation — see distributed-tracing.md for full patterns
import { context, propagation, trace, SpanKind } from '@opentelemetry/api';

// INJECT into outgoing carrier (headers, message attributes)
function injectContext(headers: Record<string, string>): void {
  propagation.inject(context.active(), headers);
}

// EXTRACT from incoming carrier and run within that context
function handleIncomingMessage(headers: Record<string, string>, body: string) {
  const parentCtx = propagation.extract(context.active(), headers);
  const tracer = trace.getTracer('consumer');

  tracer.startActiveSpan('process_message', { kind: SpanKind.CONSUMER }, parentCtx, (span) => {
    processMessage(body);
    span.end();
  });
}
```

---

## 8. OTel in Kubernetes

### OTel Operator

```yaml
# Install the OpenTelemetry Operator (manages Collector + auto-instrumentation)
# kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml

# Define a Collector instance via CRD
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-gateway
  namespace: observability
spec:
  mode: deployment        # deployment | daemonset | sidecar | statefulset
  replicas: 3
  image: otel/opentelemetry-collector-contrib:0.115.0
  resources:
    limits:
      memory: 4Gi
      cpu: "2"
    requests:
      memory: 2Gi
      cpu: "1"
  config:
    receivers:
      otlp:
        protocols:
          grpc: { endpoint: 0.0.0.0:4317 }
          http: { endpoint: 0.0.0.0:4318 }
    processors:
      batch: { timeout: 5s }
      memory_limiter:
        check_interval: 5s
        limit_mib: 3072
    exporters:
      otlp:
        endpoint: tempo-distributor.observability:4317
        tls: { insecure: true }
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [otlp]
```

### Auto-Injection via Instrumentation CRD

```yaml
# Auto-instrument all pods in a namespace without code changes
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: auto-instrumentation
  namespace: ecommerce
spec:
  exporter:
    endpoint: http://otel-gateway.observability:4317
  propagators:
    - tracecontext
    - baggage
  sampler:
    type: parentbased_traceidratio
    argument: "0.1"
  nodejs:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-nodejs:latest
  python:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-python:latest
  java:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-java:latest
  dotnet:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-dotnet:latest
---
# Annotate pods to opt in to auto-instrumentation
# Add to Deployment spec.template.metadata.annotations:
#   instrumentation.opentelemetry.io/inject-nodejs: "true"
#   instrumentation.opentelemetry.io/inject-python: "true"
#   instrumentation.opentelemetry.io/inject-java: "true"
```

---

## 9. OTel for Frontend (Browser)

```typescript
// Browser SDK setup — capture user-facing performance and errors
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

const provider = new WebTracerProvider({
  resource: new Resource({
    'service.name': 'web-frontend',
    'service.version': '2.1.0',
  }),
  spanProcessors: [
    new BatchSpanProcessor(new OTLPTraceExporter({
      url: 'https://otel-collector.example.com/v1/traces',
    })),
  ],
});
provider.register({ contextManager: new ZoneContextManager() });

registerInstrumentations({
  instrumentations: [getWebAutoInstrumentations({
    '@opentelemetry/instrumentation-fetch': {
      propagateTraceHeaderCorsUrls: [/api\.example\.com/],
    },
    '@opentelemetry/instrumentation-document-load': {},
  })],
});
```

---

## Best Practices

| #  | Practice                                     | Description                                                                                       |
|----|----------------------------------------------|---------------------------------------------------------------------------------------------------|
| 1  | Use OTLP as the export protocol              | OTLP (gRPC or HTTP) is the native OTel protocol. Avoid legacy formats (Jaeger Thrift, Zipkin JSON) in new deployments. |
| 2  | Deploy Collector in two-tier topology         | Agent/sidecar for local batching, gateway for sampling and routing. Keeps SDKs simple.             |
| 3  | Enable auto-instrumentation first             | Get baseline coverage with zero-code instrumentation, then add manual spans for business logic.    |
| 4  | Configure memory_limiter in every Collector   | Prevent OOM kills. Set `limit_mib` to 80% of container memory limit.                              |
| 5  | Use environment variables for SDK config      | `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_SAMPLER` — no code changes for config. |
| 6  | Set resource attributes at deployment time    | `service.name`, `service.version`, `deployment.environment.name` must be set on every service.     |
| 7  | Redact sensitive data in the Collector        | Use the `attributes` processor to delete/hash headers, tokens, query parameters before export.     |
| 8  | Pin Collector and SDK versions                | OTel releases frequently. Pin versions in CI and test before upgrading. Use `-contrib` for extra receivers/exporters. |
| 9  | Use the OTel Operator in Kubernetes           | Manages Collector lifecycle, auto-instrumentation injection, and upgrades via CRDs.                |
| 10 | Monitor the Collector itself                  | Export Collector internal metrics (`otelcol_exporter_sent_spans`, queue depth, dropped spans) to Prometheus. |

---

## Anti-Patterns

| #  | Anti-Pattern                              | Problem                                                      | Fix                                                           |
|----|-------------------------------------------|--------------------------------------------------------------|---------------------------------------------------------------|
| 1  | Vendor-specific SDK instrumentation       | Lock-in to one backend; expensive migration                  | Use OTel API/SDK; export to any backend via Collector          |
| 2  | No Collector (SDK exports directly)       | Every app needs backend credentials; no central processing   | Deploy Collector as intermediary; SDKs export to Collector     |
| 3  | Unbounded batch processor queue           | Memory grows until OOM under load                            | Set `memory_limiter` processor; configure `max_queue_size`     |
| 4  | Auto-instrumentation without resource     | Spans arrive without `service.name`; data is unattributable  | Always set `OTEL_SERVICE_NAME` before starting the application |
| 5  | Mixing propagation formats                | B3 headers on some services, W3C on others — broken traces   | Standardize on W3C Trace Context; use composite propagator for migration |
| 6  | Exporting 100% of spans with no sampling  | Storage costs explode; backend performance degrades          | Configure sampling (head + tail) appropriate to traffic volume |
| 7  | Ignoring Collector health                 | Collector drops spans silently when overloaded               | Monitor Collector queue depth, export errors, and memory usage |
| 8  | Deploying one global Collector            | Single point of failure; blast radius for all services       | Use per-namespace or per-team Collectors with a shared gateway |

---

## Enforcement Checklist

```
SDK SETUP:
  [ ] OTEL_SERVICE_NAME set on every service
  [ ] OTEL_EXPORTER_OTLP_ENDPOINT points to Collector (not directly to backend)
  [ ] OTEL_TRACES_SAMPLER configured (parentbased_traceidratio recommended)
  [ ] Resource attributes include service.version and deployment.environment.name
  [ ] Auto-instrumentation enabled for HTTP, database, and messaging libraries

COLLECTOR:
  [ ] Collector deployed with memory_limiter processor
  [ ] Batch processor configured with appropriate timeout and batch size
  [ ] Sensitive attributes redacted (authorization headers, query text)
  [ ] Health check extension enabled and monitored
  [ ] Collector internal metrics exported to monitoring system

KUBERNETES:
  [ ] OTel Operator installed and Collector managed via CRD
  [ ] Instrumentation CRD configured for auto-injection
  [ ] Pod annotations set for language-specific auto-instrumentation
  [ ] Collector resource limits match container memory limits

OPERATIONS:
  [ ] Collector version pinned and upgrade process documented
  [ ] Tail-based sampling configured on gateway Collector
  [ ] Multi-backend export tested (e.g., Tempo + Datadog)
  [ ] Runbook exists for Collector troubleshooting (dropped spans, OOM)
  [ ] Dashboard shows Collector pipeline health metrics
```
