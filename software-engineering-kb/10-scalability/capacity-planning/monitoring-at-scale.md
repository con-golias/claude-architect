# Monitoring at Scale

## Metadata

| Attribute    | Value                                |
|------------- |--------------------------------------|
| Domain       | Scalability > Capacity Planning      |
| Importance   | Critical                             |
| Applies To   | Platform, SRE, Backend               |
| Cross-ref    | `09-performance/profiling-tools/apm-tools.md`, `09-performance/profiling-tools/distributed-tracing.md` |
| Updated      | 2026-03-10                           |

---

## Core Concepts

### Observability Pillars at Scale

Scale each pillar independently with purpose-built strategies:

| Pillar   | Purpose                        | Scale Challenge                         | Solution Pattern                     |
|--------- |------------------------------- |---------------------------------------- |------------------------------------- |
| Metrics  | Numeric time-series data       | Cardinality explosion, storage cost     | Pre-aggregation, federation, tiering |
| Logs     | Discrete event records         | Volume (TB/day), search latency         | Structured logging, sampling, tiering|
| Traces   | Request-scoped causal chains   | Storage cost, sampling bias             | Head-based + tail-based sampling     |

### Metrics Aggregation at Scale

Adopt a hierarchical collection architecture:

- **Prometheus Federation** -- Each cluster runs a local Prometheus; a global federator scrapes aggregated recording rules.
- **Thanos / Cortex** -- Add long-term storage (object store), global query, and deduplication across replicas.
- **Recording rules** -- Pre-compute expensive queries at the source; expose only rolled-up series to the global tier.

### Alert Fatigue and SLO-Based Alerting

Replace threshold-based alerts with SLO-driven burn-rate alerts:

- Define an **error budget** (e.g., 99.9% availability = 43.2 minutes/month of allowed downtime).
- Alert when the **burn rate** exceeds a sustainable pace (e.g., 14.4x burn rate over 1 hour = page).
- Use **multi-window, multi-burn-rate** alerting to reduce false positives while catching real incidents quickly.

### Cardinality Management

Uncontrolled label values are the primary cause of monitoring system failure at scale:

- **Cap label cardinality** -- Never use user IDs, request IDs, or unbounded values as metric labels.
- **Audit regularly** -- Query `topk(10, count by (__name__)({__name__=~".+"}))` to find high-cardinality series.
- **Use histograms** -- Replace per-endpoint latency gauges with histogram buckets.
- **Relabeling** -- Drop or aggregate high-cardinality labels at ingestion time.

### Log Aggregation at High Volume

Select the right stack based on volume and query patterns:

| Stack          | Best For                         | Retention Strategy               |
|--------------- |--------------------------------- |--------------------------------- |
| ELK (Elastic)  | Full-text search, complex queries| Hot/warm/cold index lifecycle    |
| Grafana Loki   | Label-indexed, cost-efficient    | Object store backend with TTL   |
| Datadog Logs   | Managed, integrated APM          | Online archives, rehydration    |

### Dashboard Design: RED Method

Structure every service dashboard around three signals:

- **Rate** -- Requests per second (throughput).
- **Errors** -- Error count and error rate (percentage of failed requests).
- **Duration** -- Latency distribution (P50, P90, P99).

Add a fourth panel for **saturation** (CPU, memory, connection pool usage) to complete the picture.

---

## Code Examples

### YAML: Prometheus Federation Config for Multi-Cluster Monitoring

```yaml
# Global federator prometheus.yml
# Scrape recording rules from each cluster's local Prometheus.

global:
  scrape_interval: 30s
  evaluation_interval: 30s
  external_labels:
    monitor: "global-federator"

scrape_configs:
  # Federate pre-aggregated metrics from cluster-level Prometheus instances.
  - job_name: "federate-clusters"
    honor_labels: true
    metrics_path: "/federate"
    params:
      "match[]":
        # Scrape only recording rules (pre-aggregated series).
        - '{__name__=~"job:.*"}'
        - '{__name__=~"cluster:.*"}'
        # Scrape SLO-related metrics.
        - '{__name__=~"slo:.*"}'
    static_configs:
      - targets:
          - "prometheus-cluster-us-east.internal:9090"
          - "prometheus-cluster-us-west.internal:9090"
          - "prometheus-cluster-eu-west.internal:9090"
        labels:
          federation_source: "cluster"

  # Scrape the federator's own health metrics.
  - job_name: "self"
    static_configs:
      - targets: ["localhost:9090"]

# Recording rules for cross-cluster aggregations.
rule_files:
  - "rules/global-aggregations.yml"
  - "rules/slo-burn-rate.yml"

# Alertmanager configuration for SLO-based alerts.
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - "alertmanager.internal:9093"

---
# rules/slo-burn-rate.yml
groups:
  - name: slo-burn-rate
    interval: 30s
    rules:
      # 1-hour burn rate for API availability SLO (99.9%).
      - record: slo:api_error_burn_rate:1h
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            /
            sum(rate(http_requests_total[1h]))
          ) / (1 - 0.999)

      # Alert when burning error budget 14.4x faster than sustainable.
      - alert: SLOBurnRateHigh
        expr: slo:api_error_burn_rate:1h > 14.4
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API error budget burning at {{ $value }}x sustainable rate"
          description: "At current rate, the monthly error budget will exhaust in {{ printf \"%.1f\" (30.0 / $value) }} days."
```

### Go: Custom Metrics Exporter with Dimensional Metrics

```go
// Package metrics provides a custom Prometheus exporter that tracks
// business and infrastructure metrics with controlled cardinality.
package metrics

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Exporter holds all application metrics with bounded label sets.
type Exporter struct {
	requestDuration *prometheus.HistogramVec
	requestTotal    *prometheus.CounterVec
	activeConns     prometheus.Gauge
	errorBudget     *prometheus.GaugeVec
}

// NewExporter creates and registers all metrics.
// Keep label cardinality bounded: method (6), endpoint_group (< 20), status_class (5).
func NewExporter(reg prometheus.Registerer) *Exporter {
	e := &Exporter{
		requestDuration: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "Latency histogram by endpoint group and method.",
				Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
			},
			[]string{"method", "endpoint_group", "status_class"},
		),
		requestTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total requests by endpoint group, method, and status class.",
			},
			[]string{"method", "endpoint_group", "status_class"},
		),
		activeConns: promauto.With(reg).NewGauge(
			prometheus.GaugeOpts{
				Name: "active_connections",
				Help: "Current number of active connections.",
			},
		),
		errorBudget: promauto.With(reg).NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "slo_error_budget_remaining_ratio",
				Help: "Remaining error budget as a ratio (1.0 = full budget).",
			},
			[]string{"slo_name"},
		),
	}
	return e
}

// statusClass maps HTTP status codes to bounded cardinality classes.
func statusClass(code int) string {
	switch {
	case code < 200:
		return "1xx"
	case code < 300:
		return "2xx"
	case code < 400:
		return "3xx"
	case code < 500:
		return "4xx"
	default:
		return "5xx"
	}
}

// RecordRequest logs a completed HTTP request.
func (e *Exporter) RecordRequest(method, endpointGroup string, statusCode int, duration time.Duration) {
	sc := statusClass(statusCode)
	e.requestDuration.WithLabelValues(method, endpointGroup, sc).Observe(duration.Seconds())
	e.requestTotal.WithLabelValues(method, endpointGroup, sc).Inc()
}

// SetActiveConnections updates the active connection gauge.
func (e *Exporter) SetActiveConnections(n int) {
	e.activeConns.Set(float64(n))
}

// SetErrorBudget updates the remaining error budget for an SLO.
func (e *Exporter) SetErrorBudget(sloName string, remaining float64) {
	e.errorBudget.WithLabelValues(sloName).Set(remaining)
}

// Handler returns the HTTP handler for the /metrics endpoint.
func Handler() http.Handler {
	return promhttp.Handler()
}
```

### TypeScript: Structured Logging with Correlation IDs

```typescript
/**
 * Structured logger that propagates correlation IDs across distributed
 * service calls for end-to-end request tracing.
 */

import { randomUUID } from "node:crypto";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId: string;
  spanId: string;
  service: string;
  [key: string]: unknown;
}

interface LoggerOptions {
  service: string;
  minLevel?: LogLevel;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class StructuredLogger {
  private readonly service: string;
  private readonly minLevel: number;
  private correlationId: string;
  private spanId: string;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.minLevel = LEVEL_ORDER[options.minLevel ?? "info"];
    this.correlationId = randomUUID();
    this.spanId = randomUUID().slice(0, 8);
  }

  /** Create a child logger inheriting correlation ID with a new span ID. */
  child(spanContext?: { correlationId: string }): StructuredLogger {
    const child = new StructuredLogger({ service: this.service });
    child.correlationId = spanContext?.correlationId ?? this.correlationId;
    child.spanId = randomUUID().slice(0, 8);
    return child;
  }

  /** Extract correlation context for HTTP header propagation. */
  getContext(): { correlationId: string; spanId: string } {
    return { correlationId: this.correlationId, spanId: this.spanId };
  }

  debug(msg: string, fields?: Record<string, unknown>): void { this.emit("debug", msg, fields); }
  info(msg: string, fields?: Record<string, unknown>): void { this.emit("info", msg, fields); }
  warn(msg: string, fields?: Record<string, unknown>): void { this.emit("warn", msg, fields); }
  error(msg: string, fields?: Record<string, unknown>): void { this.emit("error", msg, fields); }

  private emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(), level, message,
      correlationId: this.correlationId, spanId: this.spanId,
      service: this.service, ...fields,
    };
    const out = JSON.stringify(entry) + "\n";
    (level === "error" ? process.stderr : process.stdout).write(out);
  }
}

/** Express middleware: injects correlation-aware logger into request context. */
function correlationMiddleware(serviceName: string) {
  return (req: any, _res: any, next: () => void) => {
    const incoming = req.headers["x-correlation-id"] as string | undefined;
    const logger = new StructuredLogger({ service: serviceName });
    req.logger = incoming ? logger.child({ correlationId: incoming }) : logger;
    req.logger.info("request_started", { method: req.method, path: req.path });
    next();
  };
}

export { StructuredLogger, correlationMiddleware };
```

---

## 10 Best Practices

1. **Federate metrics hierarchically** -- Run local Prometheus per cluster; federate only pre-aggregated recording rules to the global tier.
2. **Control cardinality at ingestion** -- Drop or relabel unbounded label values before they reach long-term storage.
3. **Use SLO-based alerting** -- Replace static threshold alerts with multi-window burn-rate alerts tied to error budgets.
4. **Propagate correlation IDs** -- Ensure every service injects and forwards a correlation ID in request headers.
5. **Structure all logs as JSON** -- Emit machine-parseable log entries with consistent field names across all services.
6. **Sample traces intelligently** -- Use tail-based sampling to capture 100% of error and slow traces while sampling normal traffic.
7. **Design dashboards around RED** -- Every service dashboard must show Rate, Errors, and Duration as the primary panels.
8. **Tier log retention** -- Keep hot logs for 7 days, warm for 30 days, cold for 90+ days; archive to object storage.
9. **Alert on symptoms, not causes** -- Page on user-facing impact (error rate, latency); investigate causes after triage.
10. **Monitor the monitoring system** -- Track Prometheus ingestion rate, storage usage, and query latency; alert on degradation.

---

## 8 Anti-Patterns

| #  | Anti-Pattern                          | Problem                                                     | Correct Approach                                          |
|----|---------------------------------------|-------------------------------------------------------------|-----------------------------------------------------------|
| 1  | Unbounded metric labels               | Cardinality explosion crashes Prometheus or inflates cost    | Use bounded label sets; never use IDs as label values     |
| 2  | Alerting on every metric              | Alert fatigue causes real incidents to be ignored            | Alert only on SLO burn rates and user-facing symptoms     |
| 3  | Unstructured log messages             | Free-text logs are unsearchable and expensive to parse      | Emit structured JSON logs with consistent schemas         |
| 4  | No correlation between pillars        | Cannot trace a request across metrics, logs, and traces     | Propagate correlation IDs; link traces to logs            |
| 5  | Single Prometheus for all clusters    | Single point of failure; cannot scale beyond one cluster    | Use federation or Thanos for multi-cluster aggregation    |
| 6  | Logging everything at DEBUG           | Log volume explodes; storage costs spike; signal drowns     | Default to INFO in production; enable DEBUG per-service   |
| 7  | Dashboard sprawl                      | Hundreds of dashboards with no ownership or consistency     | Standardize on RED dashboards; assign owners to each      |
| 8  | No retention or lifecycle policy      | Metrics and logs grow unbounded; queries slow to a crawl    | Define TTLs per tier; auto-delete or archive expired data |

---

## Enforcement Checklist

- [ ] Prometheus federation or Thanos is deployed for cross-cluster metric aggregation.
- [ ] All metric labels have documented, bounded cardinality (< 100 unique values per label).
- [ ] SLO-based burn-rate alerts are configured for every critical service.
- [ ] Correlation IDs are propagated in all inter-service HTTP and gRPC calls.
- [ ] All services emit structured JSON logs with a consistent schema.
- [ ] Trace sampling strategy is documented and tuned (target: 100% for errors, 1-5% for normal).
- [ ] Every service has a RED dashboard (Rate, Errors, Duration) in the central Grafana instance.
- [ ] Log retention policies are enforced: hot (7d), warm (30d), cold (90d+).
- [ ] Cardinality audits run weekly; alerts fire when any metric exceeds 10,000 series.
- [ ] Monitoring system health (ingestion rate, storage, query latency) is itself monitored and alerted on.
