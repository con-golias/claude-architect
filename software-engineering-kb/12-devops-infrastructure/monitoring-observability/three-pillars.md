# Three Pillars of Observability

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Observability                                                          |
| **Importance**     | Critical                                                                        |
| **Scope**          | Observability foundations, signal types, correlation, and tooling ecosystem      |
| **Audience**       | SREs, DevOps Engineers, Platform Engineers, Backend Developers                  |
| **Key Insight**    | 67% of organizations use Prometheus in production; OpenTelemetry is the standard with 41% in production and 38% investigating adoption |
| **Cross-ref**      | [Structured Logging](logging/structured-logging.md), [Log Aggregation](logging/log-aggregation.md), [ELK Stack](logging/elk-stack.md), [Dashboards](dashboards.md) |

> **Scope Distinction:** This file covers **observability foundations and signal correlation**. For performance-specific APM and profiling, see [09-performance/profiling-tools/](../../09-performance/profiling-tools/). For scaling monitoring infrastructure (Prometheus federation, Thanos), see [10-scalability/capacity-planning/monitoring-at-scale.md](../../10-scalability/capacity-planning/monitoring-at-scale.md).

---

## Core Concepts

### Observability vs Monitoring

Distinguish these two complementary disciplines clearly.

**Monitoring** answers predefined questions: "Is the service up?", "What is the error rate?" Configure alerts for known failure modes and track expected metrics.

**Observability** answers novel questions: "Why are requests from region X failing for users with feature flag Y enabled?" Explore arbitrary dimensions of system behavior without deploying new instrumentation.

```text
Monitoring (Known-Unknowns)          Observability (Unknown-Unknowns)
┌─────────────────────────┐          ┌─────────────────────────────┐
│ Predefined dashboards   │          │ Ad-hoc exploration          │
│ Threshold-based alerts  │          │ High-cardinality queries    │
│ "Is it broken?"         │          │ "Why is it broken?"         │
│ Fixed questions          │          │ Arbitrary questions         │
│ Reactive                │          │ Proactive + Reactive        │
└─────────────────────────┘          └─────────────────────────────┘
```

### The Three Pillars

#### 1. Metrics (Aggregated Numerical Data)

Metrics are time-series numerical measurements sampled at regular intervals. They are cheap to store, fast to query, and ideal for alerting and trend analysis.

```text
Types:
  Counter   ─ Monotonically increasing (requests_total, errors_total)
  Gauge     ─ Point-in-time value (temperature, queue_depth, active_connections)
  Histogram ─ Distribution of values in buckets (request_duration_seconds)
  Summary   ─ Pre-calculated quantiles (p50, p95, p99)
```

```promql
# Request rate over 5 minutes
rate(http_requests_total{service="api"}[5m])

# Error percentage
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m])) * 100

# 99th percentile latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

#### 2. Logs (Discrete Event Records)

Logs capture individual events with context. They provide the richest detail but are the most expensive to store and query at scale.

```json
{
  "timestamp": "2026-03-10T14:23:01.234Z",
  "level": "error",
  "service": "payment-service",
  "version": "2.4.1",
  "trace_id": "abc123def456",
  "span_id": "span789",
  "message": "Payment processing failed",
  "error": "gateway_timeout",
  "user_id": "usr_42",
  "amount_cents": 9999,
  "currency": "USD"
}
```

#### 3. Traces (Request Lifecycle)

Traces follow a single request through distributed services, showing timing, dependencies, and error propagation.

```text
Trace: abc123def456
├── [api-gateway] POST /checkout  ──────────────── 245ms
│   ├── [auth-service] validate_token  ─────────── 12ms
│   ├── [cart-service] get_cart  ────────────────── 34ms
│   │   └── [redis] GET cart:usr_42  ───────────── 2ms
│   ├── [payment-service] charge  ──────────────── 180ms ← SLOW
│   │   ├── [fraud-service] check  ─────────────── 45ms
│   │   └── [stripe-api] create_charge  ────────── 130ms ← TIMEOUT
│   └── [notification-service] send_email  ─────── 15ms
```

### How Pillars Connect

Build correlation between all three signals. This is what transforms separate data streams into true observability.

```text
┌──────────┐    exemplars     ┌──────────┐    trace context   ┌──────────┐
│  METRICS │ ───────────────► │  TRACES  │ ◄──────────────── │   LOGS   │
│          │                  │          │                    │          │
│ rate()   │                  │ spans    │                    │ events   │
│ histogram│  ◄── exemplar ── │ parent → │ ── trace_id ────► │ trace_id │
│ counter  │     links to     │   child  │    embedded in     │ span_id  │
└──────────┘     trace_id     └──────────┘    log records     └──────────┘
```

**Trace-to-Log Correlation:** Embed `trace_id` and `span_id` in every structured log entry. Query logs filtered by trace ID to see all events for a single request.

**Metric-to-Trace via Exemplars:** Prometheus exemplars attach a `trace_id` to individual metric observations, allowing drill-down from a latency spike directly to the trace that caused it.

```yaml
# Prometheus exemplar on a histogram observation
http_request_duration_seconds_bucket{le="0.5"} 24054
  # {trace_id="abc123def456"} 0.480 1709654400.000
```

### Signal Types Summary

| Signal   | Nature              | Cost      | Cardinality | Query Speed | Best For            |
|----------|---------------------|-----------|-------------|-------------|---------------------|
| Metrics  | Aggregated numbers  | Low       | Bounded     | Fast        | Alerting, trends    |
| Logs     | Discrete events     | High      | Unbounded   | Slow        | Debugging, audit    |
| Traces   | Request lifecycle   | Medium    | Per-request  | Medium      | Latency analysis    |

### Observability Maturity Model

| Level | Name          | Characteristics                                                              |
|-------|---------------|------------------------------------------------------------------------------|
| 0     | Reactive      | No centralized logging/monitoring; SSH into servers to check logs            |
| 1     | Basic         | Centralized logs, basic uptime checks, Prometheus with default dashboards    |
| 2     | Structured    | Structured logging, custom metrics, basic tracing, SLO-based alerting       |
| 3     | Correlated    | Trace-log-metric correlation, exemplars, high-cardinality exploration        |
| 4     | Predictive    | AIOps anomaly detection, automated remediation, chaos engineering feedback   |

### OpenTelemetry as the Unifying Standard

OpenTelemetry (OTel) is the CNCF standard for generating, collecting, and exporting telemetry data. Use OTel as the single instrumentation layer across all services.

```text
OTel Architecture:

  Application (SDK + Auto-Instrumentation)
       │
       ▼
  ┌─────────────────────────────────────────┐
  │         OTel Collector                  │
  │                                         │
  │  Receivers ─► Processors ─► Exporters   │
  │  (OTLP,       (batch,       (Prometheus,│
  │   Jaeger,      filter,       Jaeger,    │
  │   Zipkin)      sampling)     Loki,      │
  │                              Tempo)     │
  └─────────────────────────────────────────┘
       │              │              │
       ▼              ▼              ▼
   Prometheus      Jaeger/Tempo    Loki
   (metrics)       (traces)        (logs)
```

```yaml
# otel-collector-config.yaml
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
    send_batch_size: 1024
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
  attributes:
    actions:
      - key: environment
        value: production
        action: upsert

exporters:
  prometheusremotewrite:
    endpoint: "http://prometheus:9090/api/v1/write"
  otlp/tempo:
    endpoint: "tempo:4317"
    tls:
      insecure: true
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"

service:
  pipelines:
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, attributes, batch]
      exporters: [loki]
```

#### Auto-Instrumentation

Use OTel auto-instrumentation to generate traces and metrics without code changes for common frameworks.

```typescript
// Node.js auto-instrumentation setup (tracing.ts)
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

const sdk = new NodeSDK({
  serviceName: "payment-service",
  traceExporter: new OTLPTraceExporter({
    url: "http://otel-collector:4317",
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: "http://otel-collector:4317",
    }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

```python
# Python auto-instrumentation -- install and run:
# pip install opentelemetry-distro opentelemetry-exporter-otlp
# opentelemetry-bootstrap -a install
# opentelemetry-instrument \
#   --service_name=payment-service \
#   --exporter_otlp_endpoint=http://otel-collector:4317 \
#   python app.py
```

### Observability Stack Comparison

| Feature            | Grafana LGTM Stack         | Datadog             | New Relic           | Elastic (ELK)       |
|--------------------|----------------------------|---------------------|---------------------|----------------------|
| **Metrics**        | Prometheus/Mimir           | Datadog Metrics     | NRDB                | Elasticsearch        |
| **Logs**           | Loki                       | Log Management      | Logs                | Elasticsearch        |
| **Traces**         | Tempo                      | APM                 | Distributed Tracing | Elastic APM          |
| **Cost Model**     | Open source + infra        | Per host + volume   | Per GB ingested     | Open source + infra  |
| **OTel Support**   | Native                     | Full                | Full                | Full                 |
| **Lock-in Risk**   | Low (OSS)                  | High (proprietary)  | High (proprietary)  | Medium (OSS core)    |
| **Managed Option** | Grafana Cloud              | SaaS only           | SaaS only           | Elastic Cloud        |
| **Best For**       | Cost-conscious, K8s-native | Enterprise, all-in-one | Startup-friendly  | Log-heavy workloads  |

### Cardinality Management

High cardinality (many unique label combinations) is the primary cost and performance risk in observability systems.

```text
Cardinality = product of all unique label values

Labels:  method(4) x status(5) x endpoint(50)  = 1,000 series    ← OK
Labels:  method(4) x status(5) x user_id(1M)   = 20,000,000      ← EXPLOSION
```

**Rules for cardinality control:**
- Never use unbounded values as metric labels (user IDs, request IDs, email addresses)
- Use traces and logs for high-cardinality debugging, not metrics
- Apply recording rules to pre-aggregate high-cardinality metrics
- Monitor cardinality with `prometheus_tsdb_head_series` or Mimir tenant metrics
- Set cardinality limits per tenant in multi-tenant setups

```promql
# Monitor total active series count
prometheus_tsdb_head_series

# Find labels with highest cardinality
topk(10, count by (__name__)({__name__=~".+"}))
```

### Cost of Observability

| Cost Driver       | Typical Impact                                              | Mitigation                                    |
|-------------------|-------------------------------------------------------------|-----------------------------------------------|
| Log volume        | 40-70% of observability spend                               | Sampling, aggregation, tiered retention       |
| Metric cardinality| Exponential storage growth                                  | Label discipline, recording rules             |
| Trace storage     | 10-30% of spend, grows with traffic                         | Head-based and tail-based sampling            |
| Query costs       | Expensive for ad-hoc high-cardinality queries               | Pre-computed dashboards, query caching        |
| Egress fees       | Cloud cross-region/cross-AZ data transfer                   | Co-locate collectors with backends            |

### Observability-Driven Development

Integrate observability into the development lifecycle, not as an afterthought.

1. Define SLIs/SLOs before writing code
2. Add instrumentation in the same PR as the feature
3. Include dashboard updates in the definition of done
4. Review observability coverage in code reviews
5. Run game days to validate alert effectiveness

---

## Best Practices

1. **Adopt OpenTelemetry as the instrumentation standard** -- avoid vendor-specific SDKs to maintain portability and reduce lock-in across all signal types.

2. **Correlate all three pillars via trace context** -- embed trace_id and span_id in every structured log entry and use exemplars to link metrics to traces.

3. **Use metrics for alerting, traces for diagnosis, logs for detail** -- match the signal type to the use case; do not alert on log patterns when a metric counter is more reliable.

4. **Control metric cardinality ruthlessly** -- never use unbounded values (user IDs, IPs, request IDs) as metric labels; use traces for high-cardinality analysis.

5. **Implement the OTel Collector as a telemetry gateway** -- decouple applications from backends, enabling routing, filtering, and sampling in a central pipeline.

6. **Sample traces intelligently** -- use tail-based sampling in the OTel Collector to keep 100% of error and slow traces while sampling routine traffic.

7. **Define observability requirements alongside feature requirements** -- add instrumentation in the same PR as the feature code, not as a follow-up.

8. **Budget for observability costs from day one** -- monitor data volumes per signal type and set retention policies before costs become unmanageable.

9. **Standardize telemetry schemas across all services** -- use OTel semantic conventions for resource attributes, HTTP spans, database spans, and log fields.

10. **Validate observability with game days** -- regularly simulate incidents to confirm that dashboards, alerts, and runbooks actually lead to resolution.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| **Metrics-only observability** | Cannot diagnose novel issues without traces or logs | Implement all three pillars with correlation |
| **User ID as metric label** | Cardinality explosion crashing Prometheus | Use traces/logs for per-user analysis; keep metric labels bounded |
| **Vendor-locked instrumentation** | Switching backends requires re-instrumenting every service | Use OpenTelemetry SDKs with vendor-neutral OTLP export |
| **Sampling 0% of traces** | Trace storage costs explode, backends overwhelmed | Apply head-based and tail-based sampling; keep 100% of errors |
| **No trace-log correlation** | Cannot jump from a trace span to its log entries | Inject trace_id/span_id into every structured log record |
| **Alerting on raw logs** | Fragile regex-based alerts miss edge cases, produce noise | Derive a metric counter from log events, alert on the metric |
| **Observability as afterthought** | Features ship without dashboards or alerts, blind spots grow | Include observability in definition of done for every feature |
| **Single retention tier** | All data kept at hot-tier cost, budget exceeded in months | Implement hot/warm/cold tiers with automatic ILM policies |

---

## Enforcement Checklist

- [ ] OpenTelemetry SDK initialized in every service with auto-instrumentation enabled
- [ ] OTel Collector deployed as a gateway with batch processing and memory limiting
- [ ] All structured logs include `trace_id`, `span_id`, `service.name`, and `service.version`
- [ ] Metric label cardinality audited; no unbounded labels in production metrics
- [ ] Exemplars enabled on histograms linking metrics to trace IDs
- [ ] Tail-based sampling configured in OTel Collector to retain 100% of error/slow traces
- [ ] Observability stack cost monitored with monthly budget alerts
- [ ] Telemetry schemas follow OTel semantic conventions across all services
- [ ] Game day exercises run quarterly to validate alert-to-resolution path
- [ ] Retention policies configured per signal type with hot/warm/cold tiers
