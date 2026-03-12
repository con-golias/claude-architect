# Tracing Backends — Jaeger, Zipkin, and Grafana Tempo

| Attribute     | Value                                                                  |
|---------------|------------------------------------------------------------------------|
| Domain        | DevOps > Observability > Tracing                                       |
| Importance    | High                                                                   |
| Last Updated  | 2026-03                                                                |
| Cross-ref     | [Distributed Tracing](distributed-tracing.md), [OpenTelemetry](opentelemetry.md) |

> **Directive:** Select a tracing backend based on operational requirements: scale, cost, query capabilities, and existing infrastructure. Prefer Grafana Tempo for new deployments at scale (object storage, no indexing). Use Jaeger for established Elasticsearch/Cassandra environments. Use Zipkin only for legacy compatibility. Always ingest via OpenTelemetry Collector for backend portability.

---

## 1. Jaeger

### Architecture

```
JAEGER COMPONENTS:
  ┌──────────┐     ┌───────────────┐     ┌─────────────┐     ┌───────────┐
  │ App +    │────▶│ Jaeger        │────▶│ Jaeger      │────▶│ Storage   │
  │ OTel SDK │     │ Collector     │     │ Ingester    │     │ Backend   │
  └──────────┘     │ (receives     │     │ (Kafka→     │     │ (ES/Cass/ │
                   │  OTLP/Thrift) │     │  storage)   │     │  CkHouse) │
                   └───────────────┘     └─────────────┘     └─────┬─────┘
                                                                    │
                                                            ┌──────▼──────┐
                                                            │ Jaeger      │
                                                            │ Query + UI  │
                                                            └─────────────┘

JAEGER v2 (2025+):
  Built on OTel Collector. The Jaeger binary IS an OTel Collector with
  Jaeger-specific extensions (storage, UI). Single binary replaces
  agent + collector + ingester + query.
```

### Deployment: All-in-One (Development)

```yaml
# docker-compose.yml — Jaeger all-in-one with in-memory storage
services:
  jaeger:
    image: jaegertracing/jaeger:2.4
    ports:
      - "16686:16686"   # UI
      - "4317:4317"     # OTLP gRPC
      - "4318:4318"     # OTLP HTTP
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
```

### Deployment: Production with Elasticsearch

```yaml
# Jaeger v2 production config (otel-collector based)
# jaeger-config.yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }

exporters:
  jaeger_storage_exporter:
    trace_storage: es-store

extensions:
  jaeger_storage:
    backends:
      es-store:
        elasticsearch:
          server_urls: ["https://elasticsearch:9200"]
          index_prefix: jaeger
          username: jaeger
          password: "${JAEGER_ES_PASSWORD}"
          tls:
            ca_file: /etc/tls/ca.crt
          index_rollover:
            enabled: true
            max_age: 7d
  jaeger_query:
    storage:
      traces: es-store
    ui:
      base_path: /jaeger

service:
  extensions: [jaeger_storage, jaeger_query]
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [jaeger_storage_exporter]
```

### Jaeger on Kubernetes (Operator)

```yaml
# Jaeger Operator CRD — production deployment
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: jaeger-production
  namespace: observability
spec:
  strategy: production    # allInOne | production | streaming
  collector:
    replicas: 3
    resources:
      limits:
        memory: 2Gi
        cpu: "1"
    options:
      collector:
        num-workers: 100
        queue-size: 10000
  query:
    replicas: 2
    options:
      query:
        base-path: /jaeger
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: https://elasticsearch:9200
        index-prefix: jaeger
        num-shards: 5
        num-replicas: 1
    esIndexCleaner:
      enabled: true
      numberOfDays: 14
      schedule: "55 23 * * *"
```

### Jaeger UI Features

```
TRACE SEARCH:
  - Filter by service, operation, tags, duration, time range
  - Tag-based search: http.status_code=500, customer.tier=enterprise

TRACE VIEW:
  - Waterfall timeline showing all spans with durations
  - Span detail panel with attributes, events, logs
  - Critical path highlighting

TRACE COMPARISON:
  - Side-by-side diff of two traces
  - Highlights structural differences (extra spans, timing changes)

DEPENDENCY DAG:
  - Auto-generated service dependency graph from trace data
  - Shows call direction, request rate per edge
  - Useful for architecture discovery

MONITOR TAB (SPM — Service Performance Monitoring):
  - RED metrics derived from traces: Rate, Error, Duration
  - Per-service and per-operation dashboards
```

---

## 2. Zipkin

### Architecture

```
ZIPKIN COMPONENTS (simpler than Jaeger):
  ┌──────────┐     ┌───────────────┐     ┌───────────┐     ┌──────────┐
  │ App +    │────▶│ Zipkin        │────▶│ Storage   │◀────│ Zipkin   │
  │ Reporter │     │ Collector     │     │ (MySQL/   │     │ Query +  │
  └──────────┘     │ (HTTP/Kafka)  │     │  ES/Cass) │     │ UI       │
                   └───────────────┘     └───────────┘     └──────────┘

NOTE: Zipkin is a single Java application containing collector, storage,
query, and UI. Simpler to deploy but fewer features than Jaeger.
```

### Deployment

```yaml
# docker-compose.yml — Zipkin with Elasticsearch storage
services:
  zipkin:
    image: openzipkin/zipkin:3
    ports:
      - "9411:9411"
    environment:
      STORAGE_TYPE: elasticsearch
      ES_HOSTS: http://elasticsearch:9200
      ES_INDEX: zipkin
      ES_INDEX_REPLICAS: 1
      ES_INDEX_SHARDS: 3

  # Zipkin accepts OTLP via the zipkin receiver in OTel Collector
  # or natively via Zipkin JSON/Thrift format on port 9411
```

### When to Use Zipkin

```
PREFER ZIPKIN WHEN:
  - Already embedded in Spring Cloud ecosystem (Spring Cloud Sleuth)
  - Need simplest possible single-binary deployment
  - Team familiar with Zipkin API (many libraries support it natively)

PREFER JAEGER/TEMPO OVER ZIPKIN WHEN:
  - Need trace comparison, advanced search, or SPM
  - Operating at scale (> 10K spans/sec)
  - Want native OTLP ingestion without a proxy
```

---

## 3. Grafana Tempo

### Architecture

```
TEMPO COMPONENTS:
  ┌───────────┐     ┌─────────────┐     ┌────────────┐     ┌─────────────┐
  │ OTel      │────▶│ Distributor │────▶│ Ingester   │────▶│ Object      │
  │ Collector │     │ (validates, │     │ (batches,  │     │ Storage     │
  └───────────┘     │  routes)    │     │  writes    │     │ (S3/GCS/    │
                    └─────────────┘     │  WAL)      │     │  Azure Blob)│
                                        └────────────┘     └──────┬──────┘
                                                                  │
                    ┌─────────────┐     ┌────────────┐            │
                    │ Query       │◀────│ Compactor  │◀───────────┘
                    │ Frontend    │     │ (merges    │
                    │ + Querier   │     │  blocks)   │
                    └─────────────┘     └────────────┘

KEY DIFFERENCE FROM JAEGER:
  Tempo stores traces in object storage (S3/GCS) without indexing.
  ├── No Elasticsearch/Cassandra dependency
  ├── Dramatically lower storage cost (object storage pricing)
  ├── Trade-off: no tag-based search without Grafana correlation
  └── TraceQL provides powerful query language for trace analysis
```

### TraceQL Query Language

```
# Find traces with errors in the checkout service
{ resource.service.name = "checkout-service" && status = error }

# Find slow database spans
{ span.db.system = "postgresql" && duration > 500ms }

# Find traces where a specific user experienced errors
{ resource.service.name = "api-gateway" && span.user.id = "user-123" && status = error }

# Structural queries — find traces where service A called service B
{ resource.service.name = "order-service" } >> { resource.service.name = "payment-service" }

# Aggregate — p95 duration by service
{ } | rate() by (resource.service.name)

# Pipeline — filter then aggregate
{ status = error } | count() by (resource.service.name, span.http.route)
```

### Tempo Deployment: Helm Chart

```yaml
# values.yaml — Grafana Tempo Helm chart (microservices mode)
tempo:
  storage:
    trace:
      backend: s3
      s3:
        bucket: tempo-traces
        endpoint: s3.us-east-1.amazonaws.com
        region: us-east-1
        access_key: ${AWS_ACCESS_KEY_ID}
        secret_key: ${AWS_SECRET_ACCESS_KEY}
      wal:
        path: /var/tempo/wal
      block:
        version: vParquet4   # latest columnar format

  receivers:
    otlp:
      protocols:
        grpc: { endpoint: 0.0.0.0:4317 }
        http: { endpoint: 0.0.0.0:4318 }

  metricsGenerator:
    enabled: true
    remoteWriteUrl: http://prometheus:9090/api/v1/write
    processor:
      service_graphs:
        enabled: true
      span_metrics:
        enabled: true

  compactor:
    compaction:
      block_retention: 336h  # 14 days

ingester:
  replicas: 3
  resources:
    limits:
      memory: 4Gi

distributor:
  replicas: 2

querier:
  replicas: 2

queryFrontend:
  replicas: 2
```

### Tempo Monolithic Mode (Small Deployments)

```yaml
# docker-compose.yml — Tempo monolithic with local storage
services:
  tempo:
    image: grafana/tempo:2.7
    command: ["-config.file=/etc/tempo/tempo.yaml"]
    ports:
      - "3200:3200"    # Tempo HTTP API
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    volumes:
      - ./tempo.yaml:/etc/tempo/tempo.yaml
      - tempo-data:/var/tempo

# tempo.yaml
server:
  http_listen_port: 3200
distributor:
  receivers:
    otlp:
      protocols:
        grpc: { endpoint: 0.0.0.0:4317 }
        http: { endpoint: 0.0.0.0:4318 }
storage:
  trace:
    backend: local
    local:
      path: /var/tempo/blocks
    wal:
      path: /var/tempo/wal
metrics_generator:
  storage:
    path: /var/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
```

---

## 4. Backend Comparison

| Feature                  | Jaeger                      | Zipkin                 | Grafana Tempo            | Datadog APM             | AWS X-Ray                |
|--------------------------|-----------------------------|------------------------|--------------------------|-------------------------|--------------------------|
| License                  | Apache 2.0                  | Apache 2.0             | AGPLv3                   | Commercial              | Commercial (AWS)         |
| Storage                  | ES, Cassandra, ClickHouse   | ES, MySQL, Cassandra   | S3, GCS, Azure Blob      | SaaS                    | SaaS (DynamoDB)          |
| Query language           | Tag search                  | Tag search             | TraceQL                  | Proprietary search      | Filter expressions       |
| Trace search             | Yes (indexed)               | Yes (indexed)          | TraceQL + exemplars       | Yes                     | Yes                      |
| Service map              | Yes (dependency DAG)        | Yes                    | Yes (via metrics gen)     | Yes                     | Yes                      |
| Cost at scale            | Medium (ES/Cass infra)      | Medium                 | Low (object storage)     | High (per-host pricing) | Medium (per-trace)       |
| OTLP native              | Yes (v2)                    | Via Collector           | Yes                      | Yes                     | Via Collector             |
| Trace comparison         | Yes                         | No                     | Via Grafana              | Yes                     | No                       |
| Metrics from traces      | SPM (built-in)              | No                     | Metrics generator         | Yes                     | No                       |
| K8s Operator             | Yes                         | No                     | Via Helm/Jsonnet          | Yes (Agent)             | No                       |

## 5. Storage Backend Comparison

| Storage         | Best For            | Scaling             | Cost         | Query Speed       | Maintenance        |
|-----------------|---------------------|---------------------|--------------|-------------------|--------------------|
| Elasticsearch   | Full-text search    | Horizontal (shards) | High (SSD)   | Fast (indexed)    | High (tuning, JVM) |
| Cassandra       | Write-heavy         | Linear horizontal   | Medium       | Fast (by trace ID)| Medium             |
| ClickHouse      | Analytical queries  | Horizontal          | Medium-Low   | Fast (columnar)   | Medium             |
| S3/GCS (Tempo)  | Cost optimization   | Infinite            | Very Low     | Medium (no index) | Low                |
| PostgreSQL      | Small deployments   | Vertical only       | Low          | Slow at scale     | Low                |

---

## 6. Retention and Cost Management

```
RETENTION STRATEGIES:
  1. TIME-BASED: Delete traces older than N days (most common)
     - Hot storage (ES/Cass): 7-14 days
     - Object storage (Tempo): 30-90 days (cheap enough to keep longer)

  2. TIERED STORAGE:
     - Hot (0-7 days):  fast SSD storage for active debugging
     - Warm (7-30 days): cheaper storage, slower queries
     - Cold (30-90 days): object storage archive, query on demand

  3. SAMPLING + RETENTION:
     - Tail-based sampling keeps 100% errors, 10% of normal → stored for 14 days
     - At 10K req/s with 10% sampling = ~86M traces/day → ~300GB/day (compressed)
     - With Tempo on S3: ~$7/day for 300GB at standard S3 rates

COST ESTIMATION (approximate):
  ┌────────────────────────────────┬──────────┬──────────────┬──────────┐
  │ Backend                        │ 1K t/s   │ 10K t/s      │ 100K t/s │
  ├────────────────────────────────┼──────────┼──────────────┼──────────┤
  │ Elasticsearch (14-day)         │ $200/mo  │ $2,000/mo    │ $20K/mo  │
  │ Cassandra (14-day)             │ $150/mo  │ $1,500/mo    │ $15K/mo  │
  │ Tempo + S3 (30-day)            │ $30/mo   │ $300/mo      │ $3K/mo   │
  │ Datadog APM                    │ $400/mo  │ $4,000/mo    │ $40K/mo  │
  └────────────────────────────────┴──────────┴──────────────┴──────────┘
  * t/s = sampled traces per second stored. Costs are rough estimates.
```

```yaml
# Jaeger — index cleaner CronJob for Elasticsearch
apiVersion: batch/v1
kind: CronJob
metadata:
  name: jaeger-es-index-cleaner
  namespace: observability
spec:
  schedule: "55 23 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleaner
              image: jaegertracing/jaeger-es-index-cleaner:2.4
              args: ["14", "https://elasticsearch:9200"]  # 14 days retention
              env:
                - name: ES_USERNAME
                  valueFrom:
                    secretKeyRef:
                      name: jaeger-es-secret
                      key: username
          restartPolicy: OnFailure
```

---

## Best Practices

| #  | Practice                                          | Description                                                                                     |
|----|---------------------------------------------------|-------------------------------------------------------------------------------------------------|
| 1  | Ingest via OTel Collector, not directly            | Decouple applications from backend choice. Switch backends without code changes.                 |
| 2  | Use Tempo for new deployments at scale             | Object storage is 10x cheaper than Elasticsearch. TraceQL provides powerful querying.            |
| 3  | Enable metrics generation from traces              | Tempo and Jaeger can derive RED metrics from traces, reducing duplicate instrumentation.          |
| 4  | Configure index/block retention policies           | Unbounded retention grows costs linearly. Set time-based retention and review monthly.            |
| 5  | Deploy Jaeger v2 for Jaeger environments           | Jaeger v2 is built on OTel Collector, unifying the pipeline and reducing operational complexity.  |
| 6  | Use the Jaeger Operator on Kubernetes              | Manages lifecycle, scaling, storage cleanup, and upgrades declaratively via CRDs.                |
| 7  | Size storage for peak, not average                 | Spikes during incidents generate 10x normal trace volume. Size Elasticsearch/Cassandra accordingly.|
| 8  | Connect tracing backend to Grafana                 | Unified dashboard for traces, metrics, and logs. Use Grafana data sources for all three.         |
| 9  | Monitor backend health metrics                     | Track ingestion rate, query latency, storage usage, and dropped spans.                           |
| 10 | Test backend failover and recovery                 | Simulate storage outage. Verify traces buffer in Collector and replay when storage recovers.     |

---

## Anti-Patterns

| #  | Anti-Pattern                            | Problem                                                       | Fix                                                           |
|----|-----------------------------------------|---------------------------------------------------------------|---------------------------------------------------------------|
| 1  | Running all-in-one Jaeger in production | In-memory storage loses all traces on restart                 | Deploy production strategy with persistent storage backend     |
| 2  | Elasticsearch without index lifecycle   | Indices grow until disk full; cluster becomes unstable        | Configure ILM/ISM policies or Jaeger index cleaner CronJob     |
| 3  | Storing 100% of traces indefinitely     | Storage costs grow unbounded; queries slow down               | Apply sampling and time-based retention (7-30 days)            |
| 4  | Direct SDK-to-backend export            | Tight coupling; credential sprawl; no sampling pipeline       | Route all telemetry through OTel Collector                     |
| 5  | Undersized Elasticsearch cluster        | Ingestion falls behind during traffic spikes; traces dropped  | Size for 2x peak load; use dedicated hot/warm node tiers       |
| 6  | No backup or disaster recovery plan     | Storage failure means total trace data loss                   | For Tempo: S3 versioning + cross-region replication. For ES: snapshots. |
| 7  | Ignoring Tempo compactor health         | Uncompacted blocks degrade query performance over time        | Monitor compactor lag; ensure sufficient CPU and IOPS           |
| 8  | Using Zipkin for new greenfield projects| Zipkin lacks advanced features (TraceQL, comparison, SPM)     | Use Tempo or Jaeger v2 for new deployments                     |

---

## Enforcement Checklist

```
BACKEND SELECTION:
  [ ] Backend chosen based on scale, cost, and query requirements
  [ ] Ingestion via OTel Collector (OTLP protocol) — not direct SDK export
  [ ] Storage backend sized for 2x peak ingestion rate
  [ ] Retention policy defined and automated (index cleaner or compactor)

JAEGER:
  [ ] Production strategy deployed (not all-in-one)
  [ ] Elasticsearch index cleaner or ILM configured
  [ ] Jaeger Operator managing lifecycle on Kubernetes
  [ ] SPM (Service Performance Monitoring) enabled if needed

TEMPO:
  [ ] Object storage bucket created with appropriate IAM permissions
  [ ] Compactor running and lag monitored
  [ ] Metrics generator enabled for service graph and span metrics
  [ ] TraceQL queries tested for common debugging scenarios

OPERATIONS:
  [ ] Backend health dashboard in Grafana (ingestion rate, storage, errors)
  [ ] Alerting on ingestion failures and storage approaching capacity
  [ ] Disaster recovery plan documented (backups, cross-region)
  [ ] Grafana data source configured for trace → log → metric correlation
  [ ] Cost reviewed monthly against trace volume and retention policy
```
