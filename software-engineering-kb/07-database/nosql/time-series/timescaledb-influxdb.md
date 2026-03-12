# TimescaleDB & InfluxDB

> **Domain:** Database > NoSQL > Time-Series
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Time-series data — metrics, IoT sensor readings, financial ticks, application logs — is the fastest-growing data category. Generic databases struggle with time-series workloads: high-velocity writes (millions of points per second), time-range queries that span months, and rollup aggregations that compress raw data into summaries. Dedicated time-series databases optimize for these patterns with columnar storage, automatic partitioning by time, built-in downsampling, and retention policies. TimescaleDB extends PostgreSQL (use existing SQL skills), while InfluxDB provides a purpose-built engine with its own query language.

---

## How It Works

### TimescaleDB (PostgreSQL Extension)

```
┌────────────────────────────────────────────────────┐
│           TimescaleDB Architecture                  │
│                                                      │
│  ┌─────────────────────────────────────┐            │
│  │      Hypertable (virtual table)     │            │
│  │                                      │            │
│  │  ┌──────────┐ ┌──────────┐ ┌─────┐ │            │
│  │  │ Chunk 1  │ │ Chunk 2  │ │Chunk│ │            │
│  │  │ Jan 2024 │ │ Feb 2024 │ │ ... │ │            │
│  │  │          │ │          │ │     │ │            │
│  │  │PostgreSQL│ │PostgreSQL│ │     │ │            │
│  │  │ table    │ │ table    │ │     │ │            │
│  │  └──────────┘ └──────────┘ └─────┘ │            │
│  └─────────────────────────────────────┘            │
│                                                      │
│  Each chunk = regular PostgreSQL table               │
│  Auto-partitioned by time                            │
│  Full SQL support (JOINs, CTEs, window functions)   │
│  All PostgreSQL extensions work (PostGIS, pgvector) │
└────────────────────────────────────────────────────┘
```

```sql
-- Install TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create hypertable (auto-partitioned by time)
CREATE TABLE metrics (
    time        TIMESTAMPTZ NOT NULL,
    device_id   TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    tags        JSONB DEFAULT '{}'
);

SELECT create_hypertable('metrics', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

-- Create index for common queries
CREATE INDEX idx_metrics_device ON metrics (device_id, time DESC);

-- Insert data (same as regular PostgreSQL)
INSERT INTO metrics (time, device_id, metric_name, value)
VALUES (NOW(), 'sensor-001', 'temperature', 72.5);

-- Time-range query with aggregation
SELECT
    time_bucket('1 hour', time) AS hour,
    device_id,
    AVG(value) AS avg_temp,
    MAX(value) AS max_temp,
    MIN(value) AS min_temp
FROM metrics
WHERE device_id = 'sensor-001'
  AND metric_name = 'temperature'
  AND time > NOW() - INTERVAL '7 days'
GROUP BY hour, device_id
ORDER BY hour DESC;

-- Continuous aggregate (materialized rollup — auto-refreshing)
CREATE MATERIALIZED VIEW hourly_metrics
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    device_id,
    metric_name,
    AVG(value) AS avg_value,
    MAX(value) AS max_value,
    MIN(value) AS min_value,
    COUNT(*) AS sample_count
FROM metrics
GROUP BY hour, device_id, metric_name
WITH NO DATA;

-- Auto-refresh policy
SELECT add_continuous_aggregate_policy('hourly_metrics',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- Retention policy (auto-delete old data)
SELECT add_retention_policy('metrics', INTERVAL '90 days');

-- Compression policy (10x storage reduction)
ALTER TABLE metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id, metric_name',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('metrics', INTERVAL '7 days');
-- Data older than 7 days gets compressed automatically
```

---

### InfluxDB

```
┌────────────────────────────────────────────────────┐
│            InfluxDB Architecture                    │
│                                                      │
│  Concepts:                                           │
│  • Bucket     = database + retention policy          │
│  • Measurement = table                               │
│  • Tag        = indexed metadata (string, low card.) │
│  • Field      = data values (not indexed)            │
│  • Timestamp  = time of measurement                  │
│                                                      │
│  Line Protocol (write format):                       │
│  measurement,tag1=v1,tag2=v2 field1=1.0,field2=2 ts │
│                                                      │
│  Example:                                            │
│  temperature,device=sensor1,room=kitchen value=72.5  │
└────────────────────────────────────────────────────┘
```

```bash
# InfluxDB CLI — write data (line protocol)
influx write --bucket metrics --precision s \
  "temperature,device=sensor1,room=kitchen value=72.5 1719849600"

# Or HTTP API
curl -X POST "http://localhost:8086/api/v2/write?bucket=metrics" \
  -H "Authorization: Token $TOKEN" \
  -d "temperature,device=sensor1 value=72.5"
```

```sql
-- InfluxDB SQL (InfluxDB 3.0 / IOx engine)
SELECT
  DATE_BIN(INTERVAL '1 hour', time, '1970-01-01T00:00:00Z') AS hour,
  device,
  AVG(value) AS avg_temp,
  MAX(value) AS max_temp
FROM temperature
WHERE time >= NOW() - INTERVAL '7 days'
  AND device = 'sensor1'
GROUP BY hour, device
ORDER BY hour DESC;
```

```javascript
// Flux query language (InfluxDB 2.x)
from(bucket: "metrics")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> filter(fn: (r) => r.device == "sensor1")
  |> aggregateWindow(every: 1h, fn: mean)
  |> yield(name: "hourly_avg")
```

---

### TimescaleDB vs InfluxDB

| Feature | TimescaleDB | InfluxDB |
|---------|-------------|----------|
| **Base** | PostgreSQL extension | Purpose-built engine |
| **Query language** | Full SQL | Flux / SQL (3.0) |
| **JOINs** | Full SQL JOINs | Limited |
| **Schema** | Relational (typed columns) | Schema-on-write |
| **Ecosystem** | All PostgreSQL tools/extensions | InfluxDB ecosystem |
| **Compression** | 90-95% | 90-95% |
| **Continuous aggregates** | Built-in (auto-refresh) | Tasks (manual) |
| **Retention policies** | Built-in | Built-in |
| **Cardinality** | Handles high cardinality well | Performance degrades with high cardinality tags |
| **Learning curve** | Low (if you know SQL) | Medium (Flux) / Low (SQL 3.0) |
| **Best for** | SQL teams, hybrid workloads | Pure metrics, Telegraf/Grafana stack |

---

### Common Time-Series Patterns

```sql
-- TimescaleDB: gap filling (fill missing data points)
SELECT
    time_bucket_gapfill('1 hour', time) AS hour,
    device_id,
    locf(AVG(value)) AS value  -- last observation carried forward
FROM metrics
WHERE time BETWEEN '2024-06-01' AND '2024-06-07'
  AND device_id = 'sensor-001'
GROUP BY hour, device_id
ORDER BY hour;

-- Moving average (7-point)
SELECT time, value,
       AVG(value) OVER (ORDER BY time ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7
FROM metrics
WHERE device_id = 'sensor-001'
ORDER BY time;

-- Anomaly detection (values > 3 standard deviations)
WITH stats AS (
    SELECT AVG(value) AS mean, STDDEV(value) AS stddev
    FROM metrics
    WHERE device_id = 'sensor-001' AND time > NOW() - INTERVAL '30 days'
)
SELECT m.time, m.value
FROM metrics m, stats s
WHERE m.device_id = 'sensor-001'
  AND ABS(m.value - s.mean) > 3 * s.stddev
ORDER BY m.time;
```

---

## Best Practices

1. **ALWAYS use TimescaleDB if you already use PostgreSQL** — zero learning curve, full SQL
2. **ALWAYS enable compression** for data older than recent window — 10x storage savings
3. **ALWAYS set retention policies** — time-series data must not grow indefinitely
4. **ALWAYS use continuous aggregates** — pre-compute hourly/daily summaries
5. **ALWAYS use time_bucket() for aggregation** — not date_trunc (TimescaleDB-optimized)
6. **ALWAYS index by device/entity + time** — most queries filter by entity then time range
7. **NEVER store high-cardinality data as InfluxDB tags** — causes memory issues
8. **NEVER query raw data for dashboards** — use continuous aggregates for sub-second dashboards
9. **ALWAYS choose appropriate chunk interval** — match your most common query range

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No compression on old data | Disk usage 10x higher than needed | Enable compression policy |
| No retention policy | Storage grows indefinitely | Set retention (90 days raw, 1 year aggregated) |
| Querying raw data for dashboards | Slow dashboard loads | Use continuous aggregates |
| High-cardinality InfluxDB tags | Memory explosion, slow queries | Use fields for high-cardinality data |
| Wrong chunk interval | Too many small chunks or too few large | Match to common query time range |
| Generic PostgreSQL for time-series | Missing compression, chunking, continuous agg | Use TimescaleDB extension |

---

## Real-world Examples

### TimescaleDB
- Comcast: billions of device metrics with sub-second queries
- Netsuite: financial time-series analysis with full SQL
- Numerous IoT platforms: sensor data with PostgreSQL ecosystem

### InfluxDB
- Tesla: vehicle telemetry data from millions of cars
- eBay: infrastructure monitoring (Telegraf + InfluxDB + Grafana)
- Cisco: network performance metrics across global infrastructure

---

## Enforcement Checklist

- [ ] TimescaleDB or InfluxDB chosen (not generic PostgreSQL for time-series)
- [ ] Compression enabled for data older than recent window
- [ ] Retention policy set (raw data and aggregated data)
- [ ] Continuous aggregates created for dashboard queries
- [ ] Chunk interval tuned for query patterns
- [ ] Index on entity + time created
- [ ] High-cardinality handling considered (especially InfluxDB)
- [ ] Monitoring configured for storage growth
