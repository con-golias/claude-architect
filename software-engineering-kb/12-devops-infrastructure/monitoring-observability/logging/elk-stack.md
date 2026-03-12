# ELK Stack and Grafana Loki

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Observability > Logging                                                |
| **Importance**     | High                                                                            |
| **Scope**          | ELK/Elastic Stack architecture, Grafana Loki as alternative, comparison and selection |
| **Audience**       | DevOps Engineers, SREs, Platform Engineers                                       |
| **Key Insight**    | Grafana Loki indexes only labels (not full text), reducing storage costs 10x compared to Elasticsearch while integrating natively with the Grafana LGTM stack |
| **Cross-ref**      | [Structured Logging](structured-logging.md), [Log Aggregation](log-aggregation.md), [Dashboards](../dashboards.md) |

---

## Core Concepts

### ELK/Elastic Stack Architecture

```text
ELK Stack Components:

  ┌──────────┐    ┌───────────┐    ┌───────────────┐    ┌──────────┐
  │  Beats   │───►│ Logstash  │───►│ Elasticsearch │◄──►│  Kibana  │
  │(Filebeat)│    │(transform)│    │   (storage)   │    │  (UI)    │
  └──────────┘    └───────────┘    └───────────────┘    └──────────┘

  Beats:          Lightweight shippers (Filebeat, Metricbeat, Heartbeat)
  Logstash:       Data processing pipeline (parse, transform, enrich)
  Elasticsearch:  Distributed search and analytics engine (Lucene-based)
  Kibana:         Visualization and exploration UI
```

### Elasticsearch Fundamentals

#### Indices, Shards, and Replicas

```text
Index Structure:

  Index: logs-2026.03.10
  ├── Primary Shard 0 ──► Replica Shard 0 (different node)
  ├── Primary Shard 1 ──► Replica Shard 1 (different node)
  └── Primary Shard 2 ──► Replica Shard 2 (different node)

Sizing Guidelines:
  - Target 30-50 GB per shard
  - Shard count = expected_daily_volume / 30GB
  - 1 replica minimum for production
  - Do not exceed 20 shards per GB of heap memory
```

#### Index Lifecycle Management (ILM)

Automate index transitions through hot, warm, cold, and delete phases.

```json
// ILM Policy: logs-lifecycle
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_size": "30gb",
            "max_age": "1d",
            "max_primary_shard_size": "30gb"
          },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "3d",
        "actions": {
          "allocate": {
            "number_of_replicas": 1,
            "require": { "data": "warm" }
          },
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "allocate": {
            "require": { "data": "cold" }
          },
          "freeze": {},
          "set_priority": { "priority": 0 }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

#### Index Template

```json
// Index template for structured logs
{
  "index_patterns": ["logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1,
      "index.lifecycle.name": "logs-lifecycle",
      "index.lifecycle.rollover_alias": "logs",
      "index.mapping.total_fields.limit": 2000,
      "index.refresh_interval": "5s"
    },
    "mappings": {
      "properties": {
        "timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "service": { "type": "keyword" },
        "version": { "type": "keyword" },
        "environment": { "type": "keyword" },
        "message": { "type": "text" },
        "trace_id": { "type": "keyword" },
        "span_id": { "type": "keyword" },
        "request_id": { "type": "keyword" },
        "user_id": { "type": "keyword" },
        "duration_ms": { "type": "float" },
        "status": { "type": "integer" },
        "kubernetes": {
          "properties": {
            "namespace": { "type": "keyword" },
            "pod_name": { "type": "keyword" },
            "container_name": { "type": "keyword" },
            "node_name": { "type": "keyword" }
          }
        }
      }
    }
  }
}
```

### Logstash Pipeline

```ruby
# logstash.conf
input {
  beats {
    port => 5044
    ssl_enabled => true
    ssl_certificate => "/etc/logstash/certs/logstash.crt"
    ssl_key => "/etc/logstash/certs/logstash.key"
  }
}

filter {
  # Parse JSON log body
  if [message] =~ /^\{/ {
    json {
      source => "message"
      target => "parsed"
    }
    mutate {
      rename => {
        "[parsed][level]" => "level"
        "[parsed][service]" => "service"
        "[parsed][trace_id]" => "trace_id"
        "[parsed][message]" => "log_message"
        "[parsed][duration_ms]" => "duration_ms"
      }
    }
  }

  # Parse timestamps
  date {
    match => ["[parsed][timestamp]", "ISO8601"]
    target => "@timestamp"
  }

  # Enrich with GeoIP for access logs
  if [client_ip] {
    geoip {
      source => "client_ip"
      target => "geo"
    }
  }

  # Redact sensitive fields
  mutate {
    remove_field => ["[parsed][password]", "[parsed][token]",
                     "[parsed][authorization]", "[parsed][ssn]"]
  }

  # Add environment tag
  mutate {
    add_field => { "environment" => "%{[@metadata][env]}" }
  }
}

output {
  elasticsearch {
    hosts => ["https://elasticsearch:9200"]
    index => "logs-%{+YYYY.MM.dd}"
    user => "${ES_USER}"
    password => "${ES_PASSWORD}"
    ssl_enabled => true
    ssl_certificate_authorities => ["/etc/logstash/certs/ca.crt"]
  }
}
```

### Kibana Features

| Feature          | Description                                                    |
|------------------|----------------------------------------------------------------|
| **Discover**     | Search and filter logs in real-time; explore raw log records   |
| **Dashboards**   | Build visualizations from log data (bar charts, tables, maps)  |
| **Lens**         | Drag-and-drop visualization builder with intelligent suggestions|
| **Alerting**     | Rule-based alerts on log patterns, counts, and aggregations    |
| **Canvas**       | Pixel-perfect presentations and live dashboards for displays   |
| **Maps**         | Geographic visualization of log data (GeoIP enriched)          |

---

### Grafana Loki

Grafana Loki is a log aggregation system designed for cost-efficiency. Unlike Elasticsearch, Loki indexes only metadata labels, not the full log content.

#### Architecture

```text
Loki Architecture:

  ┌─────────────────────────────────────────────────────┐
  │                    Loki                              │
  │                                                     │
  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
  │  │Distributor│─►│ Ingester │─►│  Object Storage  │  │
  │  │          │  │          │  │  (S3/GCS/Azure)  │  │
  │  └──────────┘  └──────────┘  └──────────────────┘  │
  │       ▲                              │              │
  │       │                              ▼              │
  │  ┌──────────┐              ┌──────────────────┐    │
  │  │  Gateway  │◄─────────── │    Querier       │    │
  │  │  (nginx) │              │                  │    │
  │  └──────────┘              └──────────────────┘    │
  │       ▲                              │              │
  │       │                              ▼              │
  └───────┼──────────────────────────────┼──────────────┘
          │                              │
      Push API                     Query API
    (POST /loki/api/v1/push)    (GET /loki/api/v1/query)
          ▲                              │
          │                              ▼
    ┌──────────┐                  ┌──────────┐
    │Fluent Bit│                  │ Grafana  │
    │ /Vector  │                  │          │
    └──────────┘                  └──────────┘
```

**Key design decisions:**
- Index only labels (service, namespace, level) -- not full log content
- Store compressed log chunks in object storage (S3, GCS, Azure Blob)
- Query by label first, then grep within matching streams
- Result: 10x lower storage cost than Elasticsearch for equivalent data

#### Loki Deployment Modes

| Mode             | Description                              | Use Case                  |
|------------------|------------------------------------------|---------------------------|
| **Monolithic**   | All components in a single binary        | Dev, small production     |
| **Simple Scalable** | Read path and write path separated   | Medium production (recommended) |
| **Microservices** | Each component deployed separately      | Large-scale production    |

```yaml
# Loki Helm values (simple scalable mode)
# helm install loki grafana/loki -f values.yaml
loki:
  auth_enabled: true
  commonConfig:
    replication_factor: 3
  storage:
    type: s3
    bucketNames:
      chunks: company-loki-chunks
      ruler: company-loki-ruler
    s3:
      endpoint: s3.us-east-1.amazonaws.com
      region: us-east-1
      accessKeyId: ${AWS_ACCESS_KEY_ID}
      secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
  schemaConfig:
    configs:
      - from: "2026-01-01"
        store: tsdb
        object_store: s3
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
  limits_config:
    retention_period: 30d
    max_query_series: 5000
    max_entries_limit_per_query: 10000
    ingestion_rate_mb: 10
    ingestion_burst_size_mb: 20
  compactor:
    retention_enabled: true
    working_directory: /loki/compactor

write:
  replicas: 3
  resources:
    requests:
      cpu: 500m
      memory: 1Gi

read:
  replicas: 3
  resources:
    requests:
      cpu: 500m
      memory: 1Gi

gateway:
  replicas: 2
```

#### LogQL Query Examples

```logql
# Basic label matching -- find all error logs from payment-service
{service="payment-service", level="error"}

# Line filter -- grep for specific text within matching streams
{service="payment-service"} |= "timeout"

# Regex line filter
{service="payment-service"} |~ "status=(500|502|503)"

# JSON parsing and field filtering
{service="payment-service"} | json | duration_ms > 1000

# Log line formatting (extract and display specific fields)
{service="payment-service"} | json | line_format "{{.level}} {{.message}} [{{.duration_ms}}ms]"

# Aggregation: error rate per service over 5 minutes
sum(rate({level="error"}[5m])) by (service)

# Top 5 services by error volume
topk(5, sum(rate({level="error"}[1h])) by (service))

# Quantile: p99 duration from parsed JSON logs
quantile_over_time(0.99, {service="api-gateway"} | json | unwrap duration_ms [5m]) by (service)

# Count unique users hitting errors
count(distinct_over_time({level="error"} | json | keep user_id [1h]))

# Pattern-based log aggregation (group similar log lines)
{service="payment-service"} | pattern "<_> <level> <_> <message>"
  | level="error"
  | line_format "{{.message}}"
```

### ELK vs Loki Comparison

| Aspect               | ELK (Elasticsearch)               | Grafana Loki                        |
|----------------------|-------------------------------------|-------------------------------------|
| **Indexing**         | Full-text index (inverted index)    | Label index only (no full-text)     |
| **Storage Cost**     | High (indexed storage)              | Low (compressed chunks in S3)       |
| **Query Capability** | Full-text search, aggregations, SQL | Label filtering + line grep (LogQL) |
| **Query Speed**      | Fast for indexed fields             | Fast for label queries; slower for content grep |
| **Scalability**      | Complex (shard management)          | Simple (object storage scales)      |
| **Operations**       | High (JVM tuning, shard rebalancing)| Low (stateless reads, object storage)|
| **Resource Usage**   | Memory-intensive (JVM heap)         | Low (no indexing overhead)          |
| **Multi-tenancy**    | Index-per-tenant or RBAC            | Native tenant isolation (org ID)    |
| **Visualization**    | Kibana (powerful, self-contained)   | Grafana (unified with metrics/traces)|
| **Full-Text Search** | Excellent (Lucene-powered)          | Basic (line-level grep)             |
| **Alerting**         | Kibana Alerting / ElastAlert        | Loki Ruler + Grafana Alerting       |
| **License**          | Elastic License 2.0 / AGPL (OpenSearch) | AGPL 3.0                      |
| **Managed Options**  | Elastic Cloud, AWS OpenSearch       | Grafana Cloud                       |
| **Typical Cost/GB**  | $0.50-2.00/GB/month                 | $0.05-0.20/GB/month                 |

### When to Choose ELK vs Loki

```text
Choose ELK (Elasticsearch) When:
  ✓ Full-text search across log content is a primary use case
  ✓ Complex aggregations and analytics on log data are needed
  ✓ Compliance requires full-text indexing for fast forensic search
  ✓ Team has Elasticsearch expertise and existing investment
  ✓ Log data needs to feed into SIEM or security analytics
  ✓ < 100 GB/day log volume (manageable operational cost)

Choose Grafana Loki When:
  ✓ Already using Grafana for metrics (Prometheus) and traces (Tempo)
  ✓ Cost is a primary concern (10x cheaper storage)
  ✓ Log volume exceeds 500 GB/day (object storage scales easily)
  ✓ Primary query pattern is: filter by service → grep for text
  ✓ Multi-tenant isolation is required (native org ID support)
  ✓ Operational simplicity is valued over query power

Choose Both (Hybrid) When:
  ✓ Security/audit logs → Elasticsearch (full-text search, SIEM integration)
  ✓ Application logs → Loki (cost-effective, Grafana integration)
  ✓ Route at the collector layer (Fluent Bit / Vector)
```

### Grafana Cloud Logs

Grafana Cloud provides a managed Loki service with additional features.

```text
Grafana Cloud Logs:
  - Fully managed Loki backend (no infrastructure to maintain)
  - Integrated with Grafana Cloud Metrics (Mimir) and Traces (Tempo)
  - Adaptive Logs: ML-based log volume reduction (deduplication, aggregation)
  - Pricing: per GB ingested (pay for what you send)
  - Free tier: 50 GB/month logs, 14-day retention

When to Use:
  - Teams without dedicated platform engineering capacity
  - Startups needing observability without infrastructure overhead
  - Hybrid: Grafana Cloud for dev/staging, self-hosted for production compliance
```

### Log Search Optimization

#### Elasticsearch

```text
Optimization Techniques:
  1. Use keyword fields for exact-match queries (service, level, trace_id)
  2. Use text fields only for full-text search content (message)
  3. Disable _source for high-volume indices if raw document not needed
  4. Use index sorting for common query patterns (timestamp DESC)
  5. Apply index.codec: best_compression for warm/cold tiers
  6. Use data streams instead of manual index rollover
```

```json
// Optimized field mappings
{
  "mappings": {
    "properties": {
      "service": { "type": "keyword" },
      "level": { "type": "keyword" },
      "trace_id": { "type": "keyword" },
      "message": {
        "type": "text",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "timestamp": {
        "type": "date",
        "format": "strict_date_optional_time"
      }
    },
    "dynamic_templates": [
      {
        "strings_as_keywords": {
          "match_mapping_type": "string",
          "mapping": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      }
    ]
  }
}
```

#### Loki

```text
Loki Query Optimization:
  1. Always start with label matchers (narrow the stream set)
  2. Use exact label matches (=) over regex (=~) when possible
  3. Apply line filters (|= or |~) before JSON parsing (| json)
  4. Limit query time range (narrower = faster)
  5. Use bloom filters (Loki 3.0+) for high-cardinality field search
  6. Avoid {job=~".*"} -- never query all streams
```

```logql
# BAD: scans all streams, then filters
{namespace=~".+"} | json | service="payment-service" | level="error"

# GOOD: narrow by labels first, then filter content
{namespace="production", service="payment-service", level="error"}
  |= "timeout"
  | json
  | duration_ms > 1000
```

---

## Best Practices

1. **Choose Loki for Grafana-native environments** -- if already using Prometheus and Grafana, Loki provides unified observability at 10x lower storage cost than Elasticsearch.

2. **Implement ILM policies on day one for Elasticsearch** -- configure hot/warm/cold/delete phases before indices grow unmanageably; retroactive policy application is painful.

3. **Use keyword type for structured fields in Elasticsearch** -- map service, level, trace_id, and user_id as keyword type; reserve text type only for fields requiring full-text search.

4. **Start LogQL queries with label matchers** -- always narrow the stream set with labels before applying line filters or JSON parsing to avoid scanning all log streams.

5. **Deploy Loki in simple scalable mode** -- separate read and write paths for independent scaling; avoid monolithic mode in production environments.

6. **Use object storage for Loki chunk storage** -- store chunks in S3/GCS/Azure Blob for unlimited, cost-effective scaling; never use local filesystem in production.

7. **Configure Elasticsearch shard sizing correctly** -- target 30-50 GB per shard; too many small shards waste cluster resources, too few large shards slow queries.

8. **Set ingestion rate limits in Loki** -- configure `ingestion_rate_mb` and `ingestion_burst_size_mb` per tenant to prevent a single noisy service from overwhelming the cluster.

9. **Monitor cluster health continuously** -- track Elasticsearch cluster status (green/yellow/red) and Loki ingester memory usage; alert on degradation before it impacts queries.

10. **Consider hybrid routing** -- send security/audit logs to Elasticsearch for full-text search and SIEM integration, and send application logs to Loki for cost-effective storage.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| **No ILM policy on Elasticsearch** | Indices grow indefinitely, disk fills, cluster crashes | Configure ILM with hot/warm/cold/delete phases from day one |
| **Full-text indexing everything** | Storage costs 10x higher than necessary; most fields never searched as text | Use keyword type for structured fields; text only for message content |
| **Querying all Loki streams** | `{job=~".*"}` scans every stream; query times out or overwhelms queriers | Always start with specific label matchers to narrow stream selection |
| **Single-shard indices in Elasticsearch** | Cannot parallelize queries; hot shard bottleneck | Size shards at 30-50 GB; use index templates with appropriate shard count |
| **Loki monolithic mode in production** | Cannot scale read/write independently; single point of failure | Deploy in simple scalable or microservices mode with replication |
| **No retention policy** | Logs accumulate forever; storage costs grow linearly with time | Set retention per tier: hot (7-14d), warm (30-90d), cold (1yr), delete |
| **Using Elasticsearch as primary metrics store** | Expensive and slow compared to Prometheus/Mimir for time-series data | Use purpose-built tools: Prometheus for metrics, ES for logs |
| **Ignoring Loki label cardinality** | Too many unique label values degrade ingestion and query performance | Limit labels to low-cardinality values (service, namespace, level) |

---

## Enforcement Checklist

- [ ] Log backend selected based on requirements (ELK for full-text search, Loki for cost-effective label-based querying)
- [ ] Elasticsearch ILM policy configured with hot/warm/cold/delete phases and appropriate retention periods
- [ ] Elasticsearch index template applied with keyword mappings for structured fields and proper shard sizing
- [ ] Loki deployed in simple scalable or microservices mode with object storage backend
- [ ] LogQL queries validated: all queries start with label matchers, no unbounded stream scanning
- [ ] Loki ingestion rate limits configured per tenant to prevent noisy-neighbor issues
- [ ] Retention policies aligned with compliance requirements (GDPR, HIPAA, SOX)
- [ ] Cluster health monitoring enabled with alerts on Elasticsearch status (yellow/red) and Loki ingester memory
- [ ] Log search performance validated: p99 query latency under 10 seconds for common queries
- [ ] Hybrid routing evaluated: security logs to Elasticsearch, application logs to Loki where appropriate
