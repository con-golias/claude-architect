# Data Pipeline Tools & Orchestration

> **Domain:** Database > Data Pipelines > Tools & Orchestration
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Data pipeline tools handle the infrastructure of moving data between systems — connectors, scheduling, retries, monitoring, and dependency management. Choosing the right combination of extraction tool (Airbyte, Fivetran), transformation tool (dbt), and orchestrator (Airflow, Dagster) determines pipeline reliability, development velocity, and operational cost. Building custom solutions for problems these tools solve is a waste of engineering time and produces fragile, unmaintainable pipelines.

---

## How It Works

### Tool Landscape

```
Modern Data Stack:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  EXTRACTION / INGESTION                                   │
│  ├── Airbyte       — Open-source, 300+ connectors        │
│  ├── Fivetran      — Managed, enterprise connectors      │
│  ├── Debezium      — CDC-specific (WAL/binlog)           │
│  ├── Stitch        — Simple managed ETL                  │
│  └── AWS DMS       — AWS database migration/replication  │
│                                                            │
│  TRANSFORMATION                                           │
│  ├── dbt           — SQL-first, version-controlled       │
│  ├── Spark         — Large-scale distributed processing  │
│  └── Custom SQL    — Direct warehouse transformations    │
│                                                            │
│  ORCHESTRATION                                            │
│  ├── Airflow       — Python DAGs, most popular           │
│  ├── Dagster       — Software-defined assets             │
│  ├── Prefect       — Python-native, cloud-first          │
│  ├── Temporal      — Workflow engine (general purpose)   │
│  └── dbt Cloud     — dbt-specific orchestration          │
│                                                            │
│  DATA WAREHOUSE / LAKE                                    │
│  ├── Snowflake     — Cloud-native, separation of compute │
│  ├── BigQuery      — Google, serverless analytics        │
│  ├── Redshift      — AWS, columnar storage               │
│  ├── ClickHouse    — Open-source, real-time analytics    │
│  └── DuckDB        — Embedded analytics (local dev)      │
│                                                            │
│  DATA QUALITY                                              │
│  ├── dbt tests     — Built into dbt models               │
│  ├── Great Expectations — Python data validation         │
│  ├── Soda          — Data quality monitoring             │
│  └── Monte Carlo   — Data observability platform         │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Airbyte (Open-Source Data Integration)

```yaml
# Airbyte — connector configuration
# PostgreSQL source connector
source:
  sourceType: postgres
  config:
    host: postgres-primary.internal
    port: 5432
    database: myapp
    username: airbyte_reader
    password: ${AIRBYTE_PG_PASSWORD}
    ssl_mode: require
    replication_method:
      method: CDC  # Use logical replication
      replication_slot: airbyte_slot
      publication: airbyte_publication
    schemas:
      - public

# BigQuery destination connector
destination:
  destinationType: bigquery
  config:
    project_id: my-gcp-project
    dataset_id: raw_myapp
    credentials_json: ${BIGQUERY_CREDENTIALS}
    loading_method:
      method: GCS Staging
      gcs_bucket_name: my-airbyte-staging
      gcs_bucket_path: staging
    transformation_priority: interactive

# Sync configuration
connection:
  source: postgres-myapp
  destination: bigquery-raw
  sync_catalog:
    streams:
      - name: users
        sync_mode: incremental
        destination_sync_mode: append_dedup
        cursor_field: updated_at
        primary_key: [id]
      - name: orders
        sync_mode: incremental
        destination_sync_mode: append_dedup
        cursor_field: created_at
        primary_key: [id]
  schedule:
    units: 1
    timeUnit: hours
```

### Airflow DAG for Data Pipeline

```python
# Airflow DAG — orchestrate extract → load → transform
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from airflow.providers.airbyte.operators.airbyte import AirbyteTriggerSyncOperator
from airflow.providers.airbyte.sensors.airbyte import AirbyteJobSensor

default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'email_on_failure': True,
    'email': ['data-alerts@company.com'],
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'myapp_data_pipeline',
    default_args=default_args,
    description='Extract from PostgreSQL, transform with dbt',
    schedule_interval='0 */2 * * *',  # Every 2 hours
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['data-pipeline', 'myapp'],
) as dag:

    # Step 1: Trigger Airbyte sync
    extract_load = AirbyteTriggerSyncOperator(
        task_id='extract_load_postgres',
        airbyte_conn_id='airbyte_default',
        connection_id='postgres-to-bigquery-connection-id',
        asynchronous=True,
    )

    # Step 2: Wait for Airbyte sync to complete
    wait_for_sync = AirbyteJobSensor(
        task_id='wait_for_extract',
        airbyte_conn_id='airbyte_default',
        airbyte_job_id="{{ task_instance.xcom_pull(task_ids='extract_load_postgres') }}",
        timeout=3600,
    )

    # Step 3: Run dbt transformations
    dbt_run = BashOperator(
        task_id='dbt_transform',
        bash_command='cd /opt/dbt/myapp && dbt run --profiles-dir /opt/dbt/profiles',
    )

    # Step 4: Run dbt tests
    dbt_test = BashOperator(
        task_id='dbt_test',
        bash_command='cd /opt/dbt/myapp && dbt test --profiles-dir /opt/dbt/profiles',
    )

    # Step 5: Check source freshness
    dbt_freshness = BashOperator(
        task_id='dbt_source_freshness',
        bash_command='cd /opt/dbt/myapp && dbt source freshness --profiles-dir /opt/dbt/profiles',
    )

    # Pipeline: extract → wait → transform → test + freshness
    extract_load >> wait_for_sync >> dbt_run >> [dbt_test, dbt_freshness]
```

### Tool Comparison Matrix

```
┌─────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Feature          │ Airbyte  │ Fivetran │ Debezium │ AWS DMS  │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ License          │ OSS      │ Propriet.│ OSS      │ AWS only │
│ Connectors       │ 300+     │ 400+     │ 10 DBs   │ 20+ DBs  │
│ CDC Support      │ Yes      │ Yes      │ Primary  │ Yes      │
│ Self-hosted      │ Yes      │ No       │ Yes      │ No       │
│ Managed option   │ Airbyte  │ Default  │ Community│ Default  │
│                  │ Cloud    │          │          │          │
│ Real-time        │ Minutes  │ Minutes  │ Seconds  │ Seconds  │
│ Cost             │ Free/Paid│ $$/row   │ Free     │ AWS cost │
│ Schema evolution │ Auto     │ Auto     │ Manual   │ Limited  │
│ Monitoring       │ Built-in │ Built-in │ JMX/Kafka│ CloudWatch│
│ Best for         │ General  │ Enterprise│ CDC only│ AWS DBs  │
└─────────────────┴──────────┴──────────┴──────────┴──────────┘
```

```
Orchestrator Comparison:
┌─────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Feature          │ Airflow  │ Dagster  │ Prefect  │ dbt Cloud│
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Paradigm         │ DAGs     │ Assets   │ Flows    │ Jobs     │
│ Language         │ Python   │ Python   │ Python   │ SQL/YAML │
│ Self-hosted      │ Yes      │ Yes      │ Yes      │ No       │
│ Managed          │ MWAA,    │ Dagster  │ Prefect  │ Default  │
│                  │ Astronomer│ Cloud   │ Cloud    │          │
│ Learning curve   │ Medium   │ Medium   │ Low      │ Low      │
│ Community        │ Largest  │ Growing  │ Growing  │ Large    │
│ dbt integration  │ Plugin   │ Native   │ Plugin   │ Native   │
│ Data lineage     │ Limited  │ Built-in │ Limited  │ Built-in │
│ Best for         │ General  │ Data eng.│ Simple   │ dbt only │
└─────────────────┴──────────┴──────────┴──────────┴──────────┘
```

### Selection Guide

```
Data Pipeline Tool Selection:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Need real-time CDC (< 10s latency)?                     │
│  └── YES → Debezium + Kafka                              │
│                                                            │
│  Need many non-DB connectors (APIs, SaaS)?               │
│  └── YES → Airbyte (open-source) or Fivetran (managed)  │
│                                                            │
│  Need just DB → warehouse sync?                          │
│  └── YES → Airbyte or Fivetran                           │
│                                                            │
│  Need SQL transformations in warehouse?                  │
│  └── YES → dbt (always)                                  │
│                                                            │
│  Need pipeline orchestration?                             │
│  ├── Complex dependencies → Airflow                      │
│  ├── Data asset focused → Dagster                        │
│  ├── Simple scheduling → Prefect                         │
│  └── dbt only → dbt Cloud                               │
│                                                            │
│  Budget?                                                  │
│  ├── Minimal → Airbyte + dbt Core + Airflow (all OSS)   │
│  ├── Moderate → Airbyte Cloud + dbt Cloud                │
│  └── Enterprise → Fivetran + dbt Cloud + Dagster Cloud   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS use dbt** for warehouse transformations — version-controlled, testable SQL
2. **ALWAYS use managed connectors** (Airbyte/Fivetran) over custom scripts — maintained, monitored
3. **ALWAYS use an orchestrator** for multi-step pipelines — dependency management, retries, alerting
4. **ALWAYS implement pipeline monitoring** — track freshness, failures, data quality
5. **ALWAYS version control all pipeline configuration** — DAGs, dbt models, connector configs
6. **ALWAYS use incremental syncs** where possible — reduce extraction cost and time
7. **NEVER build custom connectors** when standard ones exist — maintenance burden is enormous
8. **NEVER run pipelines without retry logic** — transient failures are inevitable
9. **NEVER skip data quality validation** — transform without testing produces unreliable analytics
10. **NEVER couple pipeline scheduling to application deployments** — pipelines and apps evolve independently

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Custom ETL scripts | Fragile, unmaintained connectors | Use Airbyte/Fivetran |
| No orchestrator | Manual triggers, no retries | Use Airflow/Dagster/Prefect |
| No data quality checks | Bad data in reports | dbt tests, Great Expectations |
| Full extracts always | Slow, expensive pipelines | Incremental or CDC extraction |
| Pipeline code not in git | No review, no history | Version control everything |
| No freshness monitoring | Stale data in dashboards | dbt source freshness checks |
| Tight coupling to app deploys | Pipeline breaks on app changes | Independent pipeline lifecycle |
| No retry logic | Transient failures cause data gaps | Orchestrator retry policies |

---

## Enforcement Checklist

- [ ] Extraction tool selected (Airbyte/Fivetran/Debezium)
- [ ] dbt used for warehouse transformations
- [ ] Orchestrator deployed (Airflow/Dagster/Prefect)
- [ ] All pipeline code version-controlled
- [ ] Incremental extraction configured where possible
- [ ] Data quality tests in dbt models
- [ ] Pipeline monitoring and alerting active
- [ ] Source freshness tracking enabled
- [ ] Retry logic configured for all pipeline stages
- [ ] Documentation generated (dbt docs)
