# Application Metrics

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Observability > Metrics                                                |
| **Importance**     | Critical                                                                        |
| **Scope**          | Metric types, instrumentation, RED/USE methods, cardinality, exemplars          |
| **Audience**       | Backend Engineers, SREs, DevOps Engineers, Platform Engineers                    |
| **Key Insight**    | Instrument every service with RED metrics (Rate, Errors, Duration) and every resource with USE metrics (Utilization, Saturation, Errors) to cover 80% of debugging scenarios |
| **Cross-ref**      | [Prometheus & Grafana](prometheus-grafana.md), [Alerting](alerting.md), [Three Pillars](../three-pillars.md), [SLI/SLO/SLA](../../../09-performance/performance-culture/sli-slo-sla.md) |

> **Scope Distinction:** This file covers **metric types, instrumentation patterns, and collection models**. For Prometheus/Grafana setup and PromQL, see [prometheus-grafana.md](prometheus-grafana.md). For APM platforms (Datadog, New Relic), see [09-performance/profiling-tools/apm-tools.md](../../../09-performance/profiling-tools/apm-tools.md).

---

## Core Concepts

### Metric Types

Every metrics system supports four fundamental metric types. Choose the correct type for each measurement.

| Type          | Description                                          | Use When                              | Example                               |
|---------------|------------------------------------------------------|---------------------------------------|---------------------------------------|
| **Counter**   | Monotonically increasing value (resets on restart)   | Counting events over time             | `http_requests_total`                 |
| **Gauge**     | Value that goes up and down                          | Measuring current state               | `temperature_celsius`                 |
| **Histogram** | Samples observations into configurable buckets       | Measuring distributions (latencies)   | `http_request_duration_seconds`       |
| **Summary**   | Client-side quantile calculation                     | Pre-calculated percentiles            | `rpc_duration_seconds{quantile="0.99"}` |

**Histogram vs Summary:**

```text
Histogram                              Summary
─────────────────────────────          ─────────────────────────────
+ Server-side quantile calc            + Accurate per-instance quantiles
+ Aggregatable across instances        - NOT aggregatable across instances
+ Configurable after collection        - Quantiles fixed at instrumentation
- Bucket boundaries chosen upfront     - Expensive on high-cardinality
- Approximation (bucket resolution)    + No bucket configuration needed

RECOMMENDATION: Prefer histograms in almost all cases.
                Use summary only for pre-computed quantiles on single instances.
```

### Metric Naming Conventions

Follow a consistent naming scheme across all services. The Prometheus/OpenMetrics convention is the de facto standard.

```text
Format: <namespace>_<subsystem>_<name>_<unit>_<suffix>

Examples:
  http_server_request_duration_seconds        (histogram)
  http_server_requests_total                  (counter - use _total suffix)
  process_resident_memory_bytes               (gauge - use base unit)
  db_pool_connections_active                  (gauge)
  payment_transactions_total                  (counter)
  payment_transaction_amount_usd_total        (counter)

Rules:
  1. Use snake_case
  2. Use base units (seconds not milliseconds, bytes not kilobytes)
  3. Suffix counters with _total
  4. Suffix histograms/summaries with the unit (_seconds, _bytes)
  5. Prefix with namespace/subsystem for disambiguation
  6. Avoid verbs -- use nouns describing the measured thing
  7. Never include label names in the metric name
```

### Dimensional Metrics (Labels / Tags)

Labels (Prometheus) or tags (Datadog/StatsD) add dimensions to metrics. They turn a single metric into a multi-dimensional time series.

```text
http_requests_total{method="GET", path="/api/users", status="200"}  → time series 1
http_requests_total{method="POST", path="/api/users", status="201"} → time series 2
http_requests_total{method="GET", path="/api/orders", status="500"} → time series 3

Each unique combination of label values = one time series.
Total time series = metric × cardinality(label_1) × cardinality(label_2) × ...
```

**Label best practices:**

- Keep label cardinality low (< 100 unique values per label)
- Never use user IDs, email addresses, or UUIDs as label values
- Use bounded categories: HTTP methods, status code classes (2xx/4xx/5xx), service names
- Add labels at query time (via `group_left`/`group_right`) rather than at collection time

### The RED Method

Apply the RED method to every service in your architecture. Coined by Tom Wilkie (Grafana Labs).

```text
RED -- for Request-Driven Services:

  Rate     → requests per second (counter)
  Errors   → failed requests per second (counter)
  Duration → distribution of request latencies (histogram)

Maps directly to user experience:
  Rate     → "Is the system being used?"
  Errors   → "Is the system working correctly?"
  Duration → "Is the system fast enough?"
```

**TypeScript -- Express middleware implementing RED metrics:**

```typescript
// metrics/red-middleware.ts
import { Counter, Histogram } from "prom-client";

const httpRequestsTotal = new Counter({
  name: "http_server_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
});

const httpRequestDurationSeconds = new Histogram({
  name: "http_server_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export function metricsMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const end = httpRequestDurationSeconds.startTimer();
  const route = req.route?.path || req.path;

  res.on("finish", () => {
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
}
```

**Python -- FastAPI middleware implementing RED metrics:**

```python
# metrics/red_middleware.py
import time
from prometheus_client import Counter, Histogram
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

http_requests_total = Counter(
    "http_server_requests_total",
    "Total HTTP requests",
    ["method", "route", "status_code"],
)

http_request_duration_seconds = Histogram(
    "http_server_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "route", "status_code"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)


class REDMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start

        route = request.url.path
        labels = {
            "method": request.method,
            "route": route,
            "status_code": str(response.status_code),
        }
        http_requests_total.labels(**labels).inc()
        http_request_duration_seconds.labels(**labels).observe(duration)
        return response
```

**Go -- HTTP handler metrics:**

```go
// metrics/red.go
package metrics

import (
    "net/http"
    "strconv"
    "time"

    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "http_server_requests_total",
        Help: "Total HTTP requests",
    }, []string{"method", "route", "status_code"})

    httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "http_server_request_duration_seconds",
        Help:    "HTTP request duration in seconds",
        Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
    }, []string{"method", "route", "status_code"})
)

func InstrumentHandler(route string, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

        next.ServeHTTP(rw, r)

        duration := time.Since(start).Seconds()
        labels := prometheus.Labels{
            "method":      r.Method,
            "route":       route,
            "status_code": strconv.Itoa(rw.statusCode),
        }
        httpRequestsTotal.With(labels).Inc()
        httpRequestDuration.With(labels).Observe(duration)
    })
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

### The USE Method

Apply the USE method to every resource (CPU, memory, disk, network, thread pools, connection pools). Coined by Brendan Gregg.

```text
USE -- for Resources:

  Utilization → percentage of time the resource is busy (gauge, 0-100%)
  Saturation  → amount of work the resource cannot service (queue depth)
  Errors      → count of error events (counter)

Resource        Utilization              Saturation               Errors
─────────────   ─────────────────────    ─────────────────────    ────────────────
CPU             cpu_usage_percent        load_average / runqueue  machine_check_exceptions
Memory          memory_used_bytes        swap_usage_bytes         OOM kill count
Disk I/O        disk_io_utilization      disk_queue_length        disk_errors_total
Network         network_bandwidth_usage  tcp_retransmits          network_errors_total
DB Pool         pool_active / pool_max   pool_pending_requests    pool_errors_total
Thread Pool     active / max             queue_size               rejected_total
```

### Custom Business Metrics

Instrument business-critical events beyond infrastructure. These metrics drive product and business decisions.

```typescript
// metrics/business.ts
import { Counter, Gauge, Histogram } from "prom-client";

// Revenue tracking
const revenueTotal = new Counter({
  name: "business_revenue_cents_total",
  help: "Total revenue in cents",
  labelNames: ["currency", "product_tier", "payment_method"] as const,
});

// User signups
const signupsTotal = new Counter({
  name: "business_signups_total",
  help: "Total user signups",
  labelNames: ["plan", "source", "region"] as const,
});

// Feature usage
const featureUsageTotal = new Counter({
  name: "business_feature_usage_total",
  help: "Feature usage events",
  labelNames: ["feature_name", "plan"] as const,
});

// Active users (gauge -- snapshot at scrape time)
const activeUsersGauge = new Gauge({
  name: "business_active_users",
  help: "Currently active users",
  labelNames: ["plan"] as const,
});

// Checkout funnel duration
const checkoutDuration = new Histogram({
  name: "business_checkout_duration_seconds",
  help: "Time from cart to payment completion",
  labelNames: ["payment_method"] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300],
});
```

### OpenTelemetry Metrics API

OpenTelemetry provides a vendor-neutral instrumentation API. Use it to avoid lock-in to a specific metrics backend.

**TypeScript -- OTel Metrics:**

```typescript
// otel-metrics.ts
import { metrics } from "@opentelemetry/api";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

// Setup
const exporter = new OTLPMetricExporter({
  url: "http://otel-collector:4318/v1/metrics",
});
const meterProvider = new MeterProvider({
  readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 15000 })],
});
metrics.setGlobalMeterProvider(meterProvider);

// Instrumentation
const meter = metrics.getMeter("my-service", "1.0.0");

const requestCounter = meter.createCounter("http.server.requests", {
  description: "Total HTTP requests",
  unit: "1",
});

const requestDuration = meter.createHistogram("http.server.request.duration", {
  description: "HTTP request duration",
  unit: "s",
});

const activeConnections = meter.createUpDownCounter("http.server.active_connections", {
  description: "Active HTTP connections",
  unit: "1",
});

// Usage
requestCounter.add(1, { "http.method": "GET", "http.route": "/api/users" });
const start = performance.now();
// ... handle request ...
requestDuration.record((performance.now() - start) / 1000, {
  "http.method": "GET",
  "http.route": "/api/users",
});
```

**Python -- OTel Metrics:**

```python
# otel_metrics.py
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

exporter = OTLPMetricExporter(endpoint="otel-collector:4317")
reader = PeriodicExportingMetricReader(exporter, export_interval_millis=15000)
provider = MeterProvider(metric_readers=[reader])
metrics.set_meter_provider(provider)

meter = metrics.get_meter("my-service", "1.0.0")

request_counter = meter.create_counter(
    "http.server.requests",
    description="Total HTTP requests",
    unit="1",
)

request_duration = meter.create_histogram(
    "http.server.request.duration",
    description="HTTP request duration",
    unit="s",
)

# Usage
request_counter.add(1, {"http.method": "GET", "http.route": "/api/users"})
request_duration.record(0.042, {"http.method": "GET", "http.route": "/api/users"})
```

**Go -- OTel Metrics:**

```go
// otel_metrics.go
package main

import (
    "context"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/metric"
    sdkmetric "go.opentelemetry.io/otel/sdk/metric"
    "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
)

func initMetrics(ctx context.Context) (*sdkmetric.MeterProvider, error) {
    exporter, err := otlpmetricgrpc.New(ctx,
        otlpmetricgrpc.WithEndpoint("otel-collector:4317"),
        otlpmetricgrpc.WithInsecure(),
    )
    if err != nil {
        return nil, err
    }
    mp := sdkmetric.NewMeterProvider(
        sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter)),
    )
    otel.SetMeterProvider(mp)
    return mp, nil
}

func instrumentHTTP() {
    meter := otel.Meter("my-service")
    requestCounter, _ := meter.Int64Counter("http.server.requests",
        metric.WithDescription("Total HTTP requests"),
        metric.WithUnit("1"),
    )
    requestDuration, _ := meter.Float64Histogram("http.server.request.duration",
        metric.WithDescription("HTTP request duration"),
        metric.WithUnit("s"),
    )
    // Usage
    requestCounter.Add(context.Background(), 1,
        metric.WithAttributes(attribute.String("http.method", "GET")))
    requestDuration.Record(context.Background(), 0.042,
        metric.WithAttributes(attribute.String("http.method", "GET")))
}
```

### Metric Cardinality

Cardinality is the number of unique time series a metric produces. High cardinality is the primary cause of metrics system instability and cost overruns.

```text
Cardinality Explosion Example:

  http_requests_total{method, path, status, user_id, request_id}

  method:     ~5 values
  path:       ~50 routes
  status:     ~20 codes
  user_id:    ~1,000,000 users     ← DANGER
  request_id: ~infinite            ← CATASTROPHE

  Total: 5 × 50 × 20 × 1,000,000 = 5,000,000,000 time series

Fix: Remove user_id and request_id from labels.
     Track per-user metrics in logs/traces, not metrics.
```

**Cardinality control strategies:**

1. **Allowlist labels** -- only permit known label values
2. **Bucket high-cardinality values** -- group paths by route template (`/users/:id` not `/users/12345`)
3. **Drop labels at collection** -- use relabeling to strip dangerous labels
4. **Set per-metric limits** -- Prometheus `sample_limit` per scrape target
5. **Monitor cardinality** -- alert on `prometheus_tsdb_head_series` growth

```yaml
# Prometheus relabel config to drop high-cardinality labels
metric_relabel_configs:
  - source_labels: [__name__]
    regex: "http_requests_total"
    action: labeldrop
    regex: "request_id|trace_id"
  - source_labels: [user_id]
    action: drop  # Drop any series that has user_id label
```

### Exemplars

Exemplars link metrics to specific trace IDs, bridging the gap between aggregate metrics and individual traces.

```text
Metric:   http_request_duration_seconds_bucket{le="0.5"} = 9842
Exemplar: {trace_id="abc123def456"} 0.48 @ 1700000000

Use case: You see p99 latency spike in Grafana → click the exemplar →
          jump directly to the offending trace in Tempo/Jaeger.
```

```typescript
// Enabling exemplars with Prometheus client (TypeScript)
import { Histogram } from "prom-client";

const duration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Request duration",
  labelNames: ["method", "route"] as const,
  enableExemplars: true,
});

// Record with exemplar
duration.observe(
  { method: "GET", route: "/api/users" },
  0.142,
  { traceID: span.spanContext().traceId },  // exemplar labels
);
```

### Push vs Pull Model

```text
PULL Model (Prometheus)                  PUSH Model (StatsD, OTLP, Datadog Agent)
─────────────────────────────            ─────────────────────────────────────────
Server scrapes targets at interval       Client pushes metrics to gateway/agent

+ Service discovery driven               + Works behind NAT/firewall
+ Health implicit (no scrape = down)      + Works for short-lived jobs (batch, lambda)
+ Server controls scrape rate             + Client controls send frequency
+ No client-side buffering needed         + No inbound port exposure needed
- Requires network path to target         - No implicit health signal
- Short-lived jobs may be missed          - Risk of overwhelming the receiver
- Target must expose HTTP endpoint        - Client-side buffering complexity

Prometheus pull is the standard for long-running services.
Use Pushgateway or OTLP push for batch jobs, serverless, and edge functions.

Modern approach: OpenTelemetry Collector accepts both push (OTLP) and
                 pull (Prometheus scrape) — then exports to any backend.
```

### Auto-Instrumentation vs Manual Instrumentation

```text
Auto-Instrumentation                    Manual Instrumentation
─────────────────────────────           ─────────────────────────────
Agent/library hooks into frameworks     Developer adds metric calls in code

+ Zero-code for standard frameworks     + Full control over what is measured
+ Captures HTTP, DB, gRPC, messaging    + Business metrics (revenue, signups)
+ Fast onboarding                        + Custom dimensions and naming
- Generic metric names                   - Requires developer discipline
- May miss business logic metrics        - Maintenance burden
- Overhead from capturing everything     + Precise overhead control

Best practice: Use auto-instrumentation as baseline, then add targeted
               manual instrumentation for business metrics and critical paths.
```

---

## Best Practices

1. **Instrument RED metrics on every service** -- implement Rate, Errors, and Duration histograms for every service boundary (HTTP, gRPC, message consumer) from day one.

2. **Instrument USE metrics on every resource** -- track Utilization, Saturation, and Errors for CPU, memory, disk, network, connection pools, and thread pools.

3. **Use histograms over summaries** -- prefer histograms for latency measurement because they aggregate correctly across instances and allow flexible quantile calculation at query time.

4. **Follow naming conventions strictly** -- adopt `<namespace>_<name>_<unit>_<suffix>` naming with snake_case, base units (seconds, bytes), and `_total` suffix for counters across all services.

5. **Control label cardinality ruthlessly** -- never use unbounded values (user IDs, request IDs, email addresses) as metric labels; keep each label under 100 unique values.

6. **Use OpenTelemetry as the instrumentation layer** -- instrument with the OTel Metrics API for vendor neutrality, then export to Prometheus, Datadog, or any OTLP-compatible backend.

7. **Enable exemplars on latency histograms** -- link histogram observations to trace IDs so engineers can jump from a latency spike directly to the offending trace.

8. **Track business metrics alongside technical metrics** -- instrument revenue, signups, feature usage, and funnel conversions as first-class Prometheus/OTel metrics for unified dashboarding.

9. **Choose the right collection model** -- use Prometheus pull for long-running services, push (OTLP or Pushgateway) for batch jobs, serverless functions, and short-lived processes.

10. **Combine auto-instrumentation with targeted manual instrumentation** -- deploy auto-instrumentation libraries for baseline coverage, then add manual metrics for business logic and critical code paths.

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                                      | Fix                                                          |
|----|---------------------------------------|--------------------------------------------------------------|--------------------------------------------------------------|
| 1  | Unbounded label values                | Cardinality explosion crashes metrics backend                | Use bounded categories; move high-cardinality data to logs   |
| 2  | Using summary instead of histogram    | Cannot aggregate percentiles across instances                | Switch to histograms with appropriate bucket boundaries      |
| 3  | Metric name includes label values     | `get_users_requests_total` duplicates method dimension       | Use generic name `http_requests_total{method="GET"}`         |
| 4  | Using milliseconds as unit            | Inconsistent with Prometheus conventions, confuses PromQL    | Always use base units: seconds, bytes                        |
| 5  | No metrics on internal dependencies   | Blind to database, cache, and queue performance              | Instrument client libraries for every external call          |
| 6  | Collecting metrics but never alerting | Metrics exist but nobody notices when they go wrong          | Define alerts for every SLI; see [alerting.md](alerting.md)  |
| 7  | Over-instrumenting with too many metrics | High cardinality, storage cost, scrape timeouts           | Audit metrics quarterly; drop unused metrics via relabeling  |
| 8  | Using gauges for event counts         | Gauge resets lose data; rate calculations become meaningless | Use counters for events; compute rate() in PromQL            |

---

## Enforcement Checklist

```text
APPLICATION METRICS ENFORCEMENT CHECKLIST
==========================================

Instrumentation:
  [ ] Every HTTP/gRPC service exposes RED metrics (requests_total, duration histogram)
  [ ] Every resource (DB pool, thread pool, cache) exposes USE metrics
  [ ] Business metrics (revenue, signups, feature usage) are instrumented
  [ ] Metric names follow <namespace>_<name>_<unit>_<suffix> convention
  [ ] All counters use _total suffix
  [ ] All durations use _seconds unit (base unit, not milliseconds)

Cardinality:
  [ ] No metric label uses unbounded values (user ID, request ID, email)
  [ ] Each label has fewer than 100 unique values
  [ ] prometheus_tsdb_head_series is monitored and alerted on
  [ ] Relabeling rules drop dangerous labels before ingestion

Collection:
  [ ] Long-running services use pull model (Prometheus scrape)
  [ ] Short-lived jobs use push model (Pushgateway or OTLP)
  [ ] Scrape interval is appropriate (15s-60s for most workloads)
  [ ] /metrics endpoint is not publicly accessible (network-restricted)

OTel / Library Setup:
  [ ] OpenTelemetry SDK is initialized at application startup
  [ ] Auto-instrumentation is enabled for HTTP, DB, and messaging frameworks
  [ ] Manual instrumentation covers business-critical code paths
  [ ] Exemplars are enabled on latency histograms
  [ ] Metrics are exported to the collector (OTLP) or scraped (Prometheus)

Review:
  [ ] Quarterly audit of metric cardinality and usage
  [ ] Unused metrics are identified and removed
  [ ] New services go through metrics instrumentation review before production
```
