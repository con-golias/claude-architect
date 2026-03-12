# Application Metrics

> **AI Plugin Directive — Metric Types, Collection & Dashboard Design**
> You are an AI coding assistant. When generating, reviewing, or refactoring metrics code,
> follow EVERY rule in this document. Without metrics, you cannot detect problems, measure
> performance, or alert on anomalies. Treat each section as non-negotiable.

**Core Rule: ALWAYS track the RED metrics (Rate, Errors, Duration) for every service. ALWAYS track the USE metrics (Utilization, Saturation, Errors) for every resource. ALWAYS use Prometheus-compatible metric names and labels. NEVER use high-cardinality labels (user IDs, request IDs).**

---

## 1. Metrics Framework

```
┌──────────────────────────────────────────────────────────────┐
│              Metrics Types                                     │
│                                                               │
│  COUNTER — monotonically increasing                          │
│  ├── http_requests_total                                    │
│  ├── errors_total                                           │
│  └── jobs_processed_total                                   │
│                                                               │
│  GAUGE — current value (can go up/down)                     │
│  ├── active_connections                                     │
│  ├── queue_depth                                            │
│  └── memory_usage_bytes                                     │
│                                                               │
│  HISTOGRAM — distribution of values                          │
│  ├── http_request_duration_seconds                          │
│  ├── db_query_duration_seconds                              │
│  └── response_size_bytes                                    │
│                                                               │
│  SUMMARY — similar to histogram, pre-calculated quantiles   │
│  └── Use histogram instead (more flexible)                  │
│                                                               │
│  Rule: Counter for events, Gauge for state,                 │
│        Histogram for latency/size distributions              │
└──────────────────────────────────────────────────────────────┘
```

| Methodology | Metrics | Scope |
|------------|---------|-------|
| **RED** | Rate, Errors, Duration | Request-driven services |
| **USE** | Utilization, Saturation, Errors | Resources (CPU, memory, disk) |
| **Four Golden Signals** | Latency, Traffic, Errors, Saturation | SRE standard |

---

## 2. TypeScript Implementation (prom-client)

```typescript
import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from "prom-client";

const registry = new Registry();
collectDefaultMetrics({ register: registry }); // Node.js runtime metrics

// RED metrics
const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [registry],
});

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "path", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const activeConnections = new Gauge({
  name: "active_connections",
  help: "Current active connections",
  registers: [registry],
});

// Business metrics
const ordersProcessed = new Counter({
  name: "orders_processed_total",
  help: "Orders processed",
  labelNames: ["status"] as const, // success, failed, pending
  registers: [registry],
});

// Middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  activeConnections.inc();

  res.on("finish", () => {
    const normalizedPath = normalizePath(req.route?.path ?? req.path);
    const labels = {
      method: req.method,
      path: normalizedPath,
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    end(labels);
    activeConnections.dec();
  });

  next();
});

// Metrics endpoint (for Prometheus scraping)
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

// Normalize paths to prevent high-cardinality
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f-]{36}/g, "/:uuid")
    .replace(/\/\d+/g, "/:id");
}
```

---

## 3. Go Implementation (prometheus/client_golang)

```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    httpRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total HTTP requests",
        },
        []string{"method", "path", "status"},
    )

    httpRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request latency",
            Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
        },
        []string{"method", "path", "status"},
    )

    activeConnections = prometheus.NewGauge(prometheus.GaugeOpts{
        Name: "active_connections",
        Help: "Current active connections",
    })
)

func init() {
    prometheus.MustRegister(httpRequestsTotal, httpRequestDuration, activeConnections)
}

func MetricsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        activeConnections.Inc()
        ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

        next.ServeHTTP(ww, r)

        activeConnections.Dec()
        duration := time.Since(start).Seconds()
        labels := prometheus.Labels{
            "method": r.Method,
            "path":   normalizePath(r.URL.Path),
            "status": strconv.Itoa(ww.Status()),
        }
        httpRequestsTotal.With(labels).Inc()
        httpRequestDuration.With(labels).Observe(duration)
    })
}

// Metrics endpoint
mux.Handle("/metrics", promhttp.Handler())
```

---

## 4. Python Implementation

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import time

http_requests_total = Counter(
    "http_requests_total", "Total HTTP requests",
    ["method", "path", "status"],
)
http_request_duration = Histogram(
    "http_request_duration_seconds", "Request latency",
    ["method", "path", "status"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
)
active_connections = Gauge("active_connections", "Active connections")

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.monotonic()
    active_connections.inc()

    response = await call_next(request)

    active_connections.dec()
    duration = time.monotonic() - start
    path = normalize_path(request.url.path)
    labels = {"method": request.method, "path": path, "status": str(response.status_code)}
    http_requests_total.labels(**labels).inc()
    http_request_duration.labels(**labels).observe(duration)

    return response

@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

---

## 5. Essential Dashboards

| Dashboard | Metrics | Alerts |
|-----------|---------|--------|
| **Service overview** | Request rate, error rate, P50/P95/P99 latency | Error rate > 1% |
| **Resource utilization** | CPU, memory, disk, connections | CPU > 80%, memory > 85% |
| **Database** | Query rate, slow queries, connection pool | Slow queries > 5/min |
| **Cache** | Hit rate, miss rate, evictions | Hit rate < 80% |
| **Queue** | Depth, processing rate, consumer lag | Depth > 1000 |
| **Business** | Orders/min, revenue, signups | Revenue drop > 20% |

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| High-cardinality labels | Metric explosion, OOM | Normalize paths, limit label values |
| No latency distribution | Only know average, not P99 | Use histogram with buckets |
| Business metrics missing | Cannot measure impact | Track orders, revenue, signups |
| No RED metrics | Cannot assess service health | Rate + Errors + Duration |
| Metric per user | Unbounded cardinality | Aggregate, use logs for per-user |
| No default runtime metrics | Blind to memory/GC issues | `collectDefaultMetrics()` |

---

## 7. Enforcement Checklist

- [ ] RED metrics tracked for every HTTP endpoint
- [ ] Histogram used for latency (not average/gauge)
- [ ] Prometheus-compatible naming (snake_case, _total suffix for counters)
- [ ] Labels normalized to prevent high-cardinality
- [ ] Runtime metrics collected (memory, GC, event loop)
- [ ] /metrics endpoint exposed for Prometheus scraping
- [ ] Business metrics tracked alongside technical metrics
- [ ] Alerting rules configured for error rate + latency spikes
