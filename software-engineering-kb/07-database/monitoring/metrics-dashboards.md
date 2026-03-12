# Database Metrics & Dashboards

> **Domain:** Database > Monitoring > Metrics & Dashboards
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

A database without monitoring is a ticking time bomb. Connection exhaustion, slow queries, replication lag, disk space depletion, and lock contention are invisible until they cause an outage. Database monitoring provides real-time visibility into performance, capacity, and health — enabling teams to detect problems before users are impacted. Every production database MUST have metrics collection, dashboards, and alerting. The cost of monitoring is trivial compared to the cost of a database outage.

---

## How It Works

### Key Database Metrics

```
Critical Database Metrics (Monitor ALL of These):
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  CONNECTION METRICS                                       │
│  ├── Active connections / max_connections ratio            │
│  ├── Idle connections (possible pool leak)                │
│  ├── Idle-in-transaction connections (blocking)           │
│  ├── Waiting connections (pool exhaustion)                │
│  └── Connection rate (connections/sec)                    │
│                                                            │
│  QUERY PERFORMANCE METRICS                                │
│  ├── Query throughput (queries/sec by type)               │
│  ├── Average query latency (p50, p95, p99)               │
│  ├── Slow query count (> threshold)                      │
│  ├── Lock wait time                                      │
│  ├── Deadlocks per minute                                │
│  └── Rows read / rows returned ratio (index efficiency)  │
│                                                            │
│  CACHE & I/O METRICS                                      │
│  ├── Buffer cache hit ratio (target: > 99%)              │
│  ├── Disk read rate (pages/sec)                          │
│  ├── WAL write rate                                      │
│  ├── Temp file usage (queries spilling to disk)          │
│  └── IOPS (read/write I/O operations)                    │
│                                                            │
│  REPLICATION METRICS                                      │
│  ├── Replication lag (bytes and time)                     │
│  ├── WAL send/receive/replay positions                   │
│  ├── Replication slot lag                                 │
│  └── Replica count and health                            │
│                                                            │
│  STORAGE METRICS                                          │
│  ├── Database size and growth rate                       │
│  ├── Table size (data + indexes + toast)                 │
│  ├── Index size and bloat                                │
│  ├── WAL directory size                                  │
│  ├── Disk space remaining                                │
│  └── Table bloat percentage                              │
│                                                            │
│  MAINTENANCE METRICS                                      │
│  ├── Autovacuum runs (per table, per minute)             │
│  ├── Dead tuple count (needs vacuum)                     │
│  ├── Transaction ID age (wraparound risk)                │
│  ├── Last vacuum / last analyze timestamps               │
│  └── Checkpoint frequency and duration                   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### PostgreSQL Monitoring Queries

```sql
-- 1. Connection overview
SELECT
    state,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / current_setting('max_connections')::int, 1) AS pct
FROM pg_stat_activity
WHERE backend_type = 'client backend'
GROUP BY state
ORDER BY count DESC;

-- 2. Buffer cache hit ratio (should be > 99%)
SELECT
    ROUND(
        100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0),
        2
    ) AS cache_hit_ratio
FROM pg_stat_database;

-- 3. Top slow queries (requires pg_stat_statements)
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms,
    ROUND(total_exec_time::numeric / 1000, 2) AS total_sec,
    rows,
    ROUND(shared_blks_hit * 100.0 /
        NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS hit_pct
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 4. Table sizes with bloat estimate
SELECT
    schemaname || '.' || relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS data_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
    last_vacuum,
    last_autovacuum,
    last_analyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- 5. Index usage statistics
SELECT
    schemaname || '.' || relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    CASE WHEN idx_scan = 0 THEN 'UNUSED' ELSE 'ACTIVE' END AS status
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- 6. Lock contention
SELECT
    blocked.pid AS blocked_pid,
    blocked.query AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.query AS blocking_query,
    now() - blocked.query_start AS blocked_duration
FROM pg_stat_activity blocked
JOIN pg_locks bl ON blocked.pid = bl.pid AND NOT bl.granted
JOIN pg_locks gl ON bl.locktype = gl.locktype
    AND bl.database IS NOT DISTINCT FROM gl.database
    AND bl.relation IS NOT DISTINCT FROM gl.relation
    AND bl.page IS NOT DISTINCT FROM gl.page
    AND bl.tuple IS NOT DISTINCT FROM gl.tuple
    AND bl.pid != gl.pid AND gl.granted
JOIN pg_stat_activity blocking ON gl.pid = blocking.pid
ORDER BY blocked_duration DESC;

-- 7. Replication lag
SELECT
    client_addr,
    state,
    pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS replay_lag,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn)) AS send_lag,
    now() - reply_time AS time_lag
FROM pg_stat_replication;

-- 8. Transaction ID age (wraparound prevention)
SELECT
    datname,
    age(datfrozenxid) AS xid_age,
    ROUND(age(datfrozenxid) * 100.0 / 2147483647, 2) AS pct_to_wraparound
FROM pg_database
ORDER BY age(datfrozenxid) DESC;
-- Alert if pct_to_wraparound > 50%

-- 9. Checkpoint statistics
SELECT
    checkpoints_timed,
    checkpoints_req,
    ROUND(checkpoint_write_time / 1000, 1) AS write_sec,
    ROUND(checkpoint_sync_time / 1000, 1) AS sync_sec,
    buffers_checkpoint,
    buffers_backend
FROM pg_stat_bgwriter;

-- 10. Temp file usage (queries spilling to disk)
SELECT
    datname,
    temp_files,
    pg_size_pretty(temp_bytes) AS temp_size
FROM pg_stat_database
WHERE temp_files > 0
ORDER BY temp_bytes DESC;
```

### Prometheus + Grafana Setup

```yaml
# docker-compose.yml — Database monitoring stack
version: '3.8'

services:
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    environment:
      DATA_SOURCE_NAME: "postgresql://monitor:password@postgres:5432/myapp?sslmode=require"
    ports:
      - "9187:9187"

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - ./grafana/dashboards:/var/lib/grafana/dashboards
      - ./grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3000:3000"
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 10s

  - job_name: 'pgbouncer'
    static_configs:
      - targets: ['pgbouncer-exporter:9127']
```

```sql
-- Create monitoring user with minimal privileges
CREATE USER monitor WITH PASSWORD 'secure_password';
GRANT pg_monitor TO monitor;  -- PostgreSQL 10+ built-in monitoring role
GRANT SELECT ON pg_stat_statements TO monitor;
```

### Alerting Rules

```yaml
# Prometheus alerting rules for PostgreSQL
groups:
  - name: postgresql-alerts
    rules:
      - alert: PostgreSQLConnectionsHigh
        expr: pg_stat_activity_count / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL connections at {{ $value | humanizePercentage }}"

      - alert: PostgreSQLConnectionsExhausted
        expr: pg_stat_activity_count / pg_settings_max_connections > 0.95
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL connections nearly exhausted"

      - alert: PostgreSQLCacheHitRatioLow
        expr: pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read) < 0.95
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL cache hit ratio {{ $value | humanizePercentage }}"

      - alert: PostgreSQLReplicationLag
        expr: pg_replication_lag_seconds > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Replication lag is {{ $value }}s"

      - alert: PostgreSQLReplicationLagCritical
        expr: pg_replication_lag_seconds > 300
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Replication lag is {{ $value }}s — data loss risk"

      - alert: PostgreSQLDeadlocks
        expr: rate(pg_stat_database_deadlocks[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Deadlocks detected: {{ $value }}/sec"

      - alert: PostgreSQLDiskSpaceLow
        expr: pg_database_size_bytes / node_filesystem_size_bytes > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Database using {{ $value | humanizePercentage }} of disk"

      - alert: PostgreSQLIdleInTransaction
        expr: pg_stat_activity_count{state="idle in transaction"} > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $value }} idle-in-transaction connections"

      - alert: PostgreSQLSlowQueries
        expr: pg_stat_statements_mean_exec_time_seconds{} > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Query averaging {{ $value }}s execution time"

      - alert: PostgreSQLXIDWraparound
        expr: pg_database_xid_age / 2147483647 > 0.5
        for: 30m
        labels:
          severity: critical
        annotations:
          summary: "XID wraparound risk at {{ $value | humanizePercentage }}"
```

### Monitoring Tools Comparison

```
Database Monitoring Tools:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  OPEN-SOURCE                                               │
│  ├── postgres_exporter + Prometheus + Grafana             │
│  │   Best for: Custom dashboards, existing Prometheus     │
│  │   Setup: Medium complexity                             │
│  │                                                        │
│  ├── pgwatch2 (PostgreSQL-specific)                       │
│  │   Best for: PostgreSQL-only shops                     │
│  │   Setup: Low complexity, batteries included           │
│  │                                                        │
│  ├── Percona Monitoring and Management (PMM)             │
│  │   Best for: PostgreSQL + MySQL + MongoDB              │
│  │   Setup: Medium complexity, comprehensive             │
│  │                                                        │
│  └── PgHero (Ruby gem / standalone)                      │
│      Best for: Quick insights, developer-friendly        │
│      Setup: Very low, instant value                      │
│                                                            │
│  MANAGED / COMMERCIAL                                     │
│  ├── Datadog Database Monitoring                          │
│  │   Best for: Existing Datadog users                    │
│  │                                                        │
│  ├── pganalyze                                            │
│  │   Best for: Deep PostgreSQL query analysis            │
│  │                                                        │
│  ├── AWS RDS Performance Insights                         │
│  │   Best for: RDS/Aurora users                          │
│  │                                                        │
│  └── Cloud-native monitoring (CloudWatch, Cloud Monitor) │
│      Best for: Managed database services                 │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS enable pg_stat_statements** — essential for query performance tracking
2. **ALWAYS monitor connection count** vs max_connections — alert at 80%
3. **ALWAYS monitor cache hit ratio** — alert if below 95%
4. **ALWAYS monitor replication lag** — alert at 30s, critical at 5m
5. **ALWAYS monitor disk space** — databases stop accepting writes when disk is full
6. **ALWAYS monitor dead tuple count** — high count indicates vacuum problems
7. **ALWAYS monitor XID age** — prevent transaction ID wraparound (catastrophic)
8. **ALWAYS set up automated alerting** — dashboards without alerts are not enough
9. **NEVER ignore idle-in-transaction connections** — they hold locks and bloat tables
10. **NEVER run production without monitoring** — the first outage will justify the setup cost

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No database monitoring | Outages detected by users | Deploy Prometheus + postgres_exporter |
| Monitoring without alerting | Dashboard exists, nobody watches | Configure Prometheus/PagerDuty alerts |
| No pg_stat_statements | Cannot identify slow queries | Enable extension, monitor top queries |
| Ignoring cache hit ratio | Queries slower than expected | Monitor, increase shared_buffers |
| No disk space monitoring | Database crashes, data loss | Alert at 85% disk usage |
| No replication lag monitoring | Stale reads, failover data loss | Alert on lag > 30s |
| No XID wraparound monitoring | Database enters read-only mode | Alert when XID age > 50% |
| Not monitoring autovacuum | Table bloat, slow queries | Track dead tuples, vacuum frequency |

---

## Enforcement Checklist

- [ ] pg_stat_statements enabled and monitored
- [ ] Prometheus + postgres_exporter deployed
- [ ] Grafana dashboard with all critical metrics
- [ ] Connection count alerting (> 80% of max)
- [ ] Cache hit ratio alerting (< 95%)
- [ ] Replication lag alerting (> 30s warning, > 5m critical)
- [ ] Disk space alerting (> 85% usage)
- [ ] Dead tuple count monitored per table
- [ ] XID wraparound age monitored
- [ ] Slow query tracking (p95, p99 latency)
- [ ] Lock contention monitoring
- [ ] Checkpoint frequency and duration tracked
