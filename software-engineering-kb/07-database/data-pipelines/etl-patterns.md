# ETL & Data Pipeline Patterns

> **Domain:** Database > Data Pipelines > ETL Patterns
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Production databases serve applications, but business intelligence, analytics, machine learning, and compliance all require data in different formats and locations. ETL (Extract, Transform, Load) and ELT (Extract, Load, Transform) pipelines move data between operational databases and analytical systems. Without proper data pipelines, teams resort to running analytics queries directly against production databases — causing performance degradation and limiting analytical capability. Every organization with data-driven decisions MUST have data pipeline infrastructure separating OLTP from OLAP workloads.

---

## How It Works

### ETL vs ELT

```
ETL vs ELT Comparison:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  ETL (Extract → Transform → Load)                        │
│  ┌────────┐    ┌───────────┐    ┌──────────────┐        │
│  │ Source  │───>│ Transform │───>│ Destination   │        │
│  │ DB      │    │ (pipeline)│    │ (warehouse)   │        │
│  └────────┘    └───────────┘    └──────────────┘        │
│  Transform happens BEFORE loading                        │
│  ✅ Only clean data reaches destination                  │
│  ✅ Less storage in destination                          │
│  ❌ Transformation logic in pipeline (hard to debug)    │
│  ❌ Schema changes require pipeline updates              │
│                                                            │
│  ELT (Extract → Load → Transform)                        │
│  ┌────────┐    ┌──────────────┐    ┌───────────┐        │
│  │ Source  │───>│ Destination   │───>│ Transform │        │
│  │ DB      │    │ (warehouse)   │    │ (in DWH)  │        │
│  └────────┘    └──────────────┘    └───────────┘        │
│  Transform happens AFTER loading (in destination)        │
│  ✅ Raw data preserved (reprocess anytime)               │
│  ✅ Transform uses DWH compute power (scalable)          │
│  ✅ Schema changes don't break pipeline                  │
│  ❌ More storage needed (raw + transformed)              │
│  Tool: dbt for transformations in warehouse              │
│                                                            │
│  Modern Recommendation: ELT with dbt                     │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Extraction Patterns

```
Data Extraction Methods:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  1. Full Extract (Simple but Expensive)                   │
│     SELECT * FROM orders;                                 │
│     ✅ Simple, guaranteed complete                       │
│     ❌ Wasteful for large tables                         │
│     Use: Small tables, infrequent syncs                  │
│                                                            │
│  2. Incremental Extract — Timestamp Based                │
│     SELECT * FROM orders                                  │
│     WHERE updated_at > :last_extract_time;               │
│     ✅ Efficient for append-mostly tables                │
│     ❌ Misses deletes                                    │
│     ❌ Requires reliable updated_at column               │
│     Use: Tables with updated_at, no hard deletes         │
│                                                            │
│  3. Incremental Extract — CDC Based                      │
│     Read changes from WAL/binlog via Debezium            │
│     ✅ Captures all changes including deletes            │
│     ✅ Minimal lag (near real-time)                      │
│     ✅ No impact on source database                      │
│     ❌ More complex setup                                │
│     Use: Real-time analytics, large tables               │
│                                                            │
│  4. Incremental Extract — Log Table Based                │
│     Application writes change log to separate table      │
│     ✅ Full control over change format                   │
│     ❌ Requires application changes                      │
│     Use: Custom audit requirements                       │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### dbt (Data Build Tool)

```sql
-- dbt model: transform raw orders into analytics-ready table
-- models/marts/orders_summary.sql

{{ config(
    materialized='incremental',
    unique_key='order_date',
    schema='analytics'
) }}

WITH daily_orders AS (
    SELECT
        DATE_TRUNC('day', created_at) AS order_date,
        COUNT(*) AS total_orders,
        COUNT(DISTINCT user_id) AS unique_customers,
        SUM(total) AS revenue,
        AVG(total) AS avg_order_value,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
    FROM {{ ref('stg_orders') }}

    {% if is_incremental() %}
    WHERE created_at > (SELECT MAX(order_date) FROM {{ this }})
    {% endif %}

    GROUP BY 1
)

SELECT
    order_date,
    total_orders,
    unique_customers,
    revenue,
    avg_order_value,
    delivered,
    cancelled,
    ROUND(delivered * 100.0 / NULLIF(total_orders, 0), 1) AS delivery_rate,
    ROUND(cancelled * 100.0 / NULLIF(total_orders, 0), 1) AS cancellation_rate
FROM daily_orders
```

```yaml
# dbt_project.yml
name: 'myapp_analytics'
version: '1.0.0'

profile: 'myapp'

model-paths: ["models"]
test-paths: ["tests"]
seed-paths: ["seeds"]

models:
  myapp_analytics:
    staging:
      +materialized: view
      +schema: staging
    marts:
      +materialized: table
      +schema: analytics
```

```yaml
# dbt source definition — models/staging/sources.yml
version: 2

sources:
  - name: myapp
    database: raw_data
    schema: public
    tables:
      - name: users
        loaded_at_field: updated_at
        freshness:
          warn_after: {count: 12, period: hour}
          error_after: {count: 24, period: hour}
      - name: orders
        loaded_at_field: created_at
        freshness:
          warn_after: {count: 1, period: hour}
          error_after: {count: 6, period: hour}
```

```bash
# dbt commands
dbt run                    # Run all models
dbt run --select orders_summary  # Run specific model
dbt test                   # Run data tests
dbt source freshness       # Check source data freshness
dbt docs generate          # Generate documentation
dbt docs serve             # Serve documentation locally
```

### Pipeline Architecture

```
Production Data Pipeline Architecture:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  SOURCES                INGESTION           WAREHOUSE      │
│  ┌──────────┐          ┌──────────┐       ┌──────────┐   │
│  │PostgreSQL │──CDC───>│          │       │          │   │
│  └──────────┘          │  Airbyte │──────>│BigQuery/ │   │
│  ┌──────────┐          │  or      │       │Snowflake/│   │
│  │  MySQL    │──CDC───>│  Fivetran│       │Redshift  │   │
│  └──────────┘          │          │       │          │   │
│  ┌──────────┐          │          │       │  Raw     │   │
│  │  API      │──REST──>│          │       │  Layer   │   │
│  └──────────┘          └──────────┘       └────┬─────┘   │
│                                                  │         │
│                         TRANSFORM               │         │
│                        ┌──────────┐             │         │
│                        │   dbt    │<────────────┘         │
│                        │          │                        │
│                        │ Staging  │                        │
│                        │ → Marts  │                        │
│                        └────┬─────┘                        │
│                              │                              │
│                    CONSUMPTION                              │
│                   ┌──────────┐                              │
│                   │Dashboard │  Looker, Metabase,           │
│                   │BI Tools  │  Grafana, Tableau            │
│                   └──────────┘                              │
│                                                            │
│  ORCHESTRATION                                             │
│  ┌────────────────────────────────────────┐               │
│  │  Airflow / Dagster / Prefect           │               │
│  │  Schedule: Extract daily/hourly        │               │
│  │  Dependencies: extract → load → dbt    │               │
│  │  Alerting: pipeline failures           │               │
│  └────────────────────────────────────────┘               │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Data Quality in Pipelines

```sql
-- dbt tests — data quality assertions
-- tests/assert_orders_positive_total.sql
SELECT *
FROM {{ ref('stg_orders') }}
WHERE total <= 0

-- Schema tests (in YAML)
-- models/staging/schema.yml
version: 2
models:
  - name: stg_orders
    columns:
      - name: id
        tests:
          - unique
          - not_null
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('stg_users')
              field: id
      - name: total
        tests:
          - not_null
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
```

---

## Best Practices

1. **ALWAYS separate OLTP from OLAP** — never run analytics on production database
2. **ALWAYS use ELT over ETL** for modern data stacks — transform in the warehouse
3. **ALWAYS use incremental extraction** for large tables — full extracts waste resources
4. **ALWAYS use CDC** for real-time pipelines — lowest latency, captures deletes
5. **ALWAYS implement data quality tests** — catch bad data before it reaches dashboards
6. **ALWAYS version control pipeline code** — dbt models, DAGs, and configs in git
7. **ALWAYS monitor pipeline freshness** — stale data leads to wrong decisions
8. **NEVER query production databases for analytics** — use replicas or data warehouse
9. **NEVER build custom ETL** when tools exist — Airbyte, Fivetran, dbt are battle-tested
10. **NEVER skip data quality checks** — garbage in, garbage out

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Analytics on production DB | Slow API responses during reports | Use data warehouse |
| Full extract of large tables | Slow pipelines, wasted resources | Use incremental or CDC |
| Custom ETL scripts | Fragile, unmaintainable | Use Airbyte/Fivetran + dbt |
| No data quality tests | Bad data in dashboards | dbt tests, Great Expectations |
| No pipeline monitoring | Stale data, silent failures | Alerting on freshness + failures |
| Transform during extraction | Pipeline bottleneck | ELT: load raw, transform in DWH |
| No idempotent pipelines | Duplicate data on re-runs | Design pipelines for safe re-execution |
| No freshness tracking | Decisions on stale data | Monitor source freshness in dbt |

---

## Enforcement Checklist

- [ ] OLTP and OLAP workloads separated
- [ ] Data warehouse selected and deployed
- [ ] Extraction method chosen (incremental/CDC)
- [ ] dbt used for transformations in warehouse
- [ ] Data quality tests implemented
- [ ] Pipeline orchestration configured (Airflow/Dagster)
- [ ] Pipeline monitoring and alerting active
- [ ] Source freshness tracked
- [ ] Pipeline code version-controlled
