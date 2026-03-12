# Data Pipeline Structure

> **AI Plugin Directive:** When structuring a data pipeline project (ETL/ELT, batch processing, streaming), ALWAYS use this guide. Apply DAG organization for Airflow, dbt project conventions for transformations, and proper separation of ingestion, transformation, and serving layers. This guide covers modern data engineering project structures.

**Core Rule: Organize data pipelines by DOMAIN, not by technical layer. Use dbt for SQL transformations with the staging → intermediate → marts pattern. Use Airflow/Dagster for orchestration with one DAG file per pipeline. NEVER put business logic in orchestration code — orchestrators TRIGGER work, they don't DO work.**

---

## 1. Data Platform Structure

```
data-platform/
├── orchestration/                         # Airflow / Dagster
│   ├── dags/                              # DAG definitions
│   │   ├── ingestion/
│   │   │   ├── ingest_salesforce.py
│   │   │   ├── ingest_stripe.py
│   │   │   └── ingest_postgres_cdc.py
│   │   ├── transformation/
│   │   │   └── run_dbt.py                 # Triggers dbt runs
│   │   ├── ml/
│   │   │   ├── train_churn_model.py
│   │   │   └── generate_recommendations.py
│   │   └── exports/
│   │       ├── export_to_bigquery.py
│   │       └── sync_to_crm.py
│   ├── plugins/                           # Custom Airflow operators/hooks
│   │   ├── operators/
│   │   │   └── custom_s3_operator.py
│   │   └── hooks/
│   │       └── salesforce_hook.py
│   ├── tests/
│   │   └── dags/
│   │       └── test_dag_integrity.py
│   ├── airflow.cfg
│   └── Dockerfile
│
├── dbt/                                   # dbt transformations
│   ├── models/
│   │   ├── staging/                       # 1:1 source mapping, clean + rename
│   │   │   ├── salesforce/
│   │   │   │   ├── _salesforce__sources.yml
│   │   │   │   ├── _salesforce__models.yml
│   │   │   │   ├── stg_salesforce__accounts.sql
│   │   │   │   └── stg_salesforce__opportunities.sql
│   │   │   └── stripe/
│   │   │       ├── _stripe__sources.yml
│   │   │       ├── stg_stripe__charges.sql
│   │   │       └── stg_stripe__subscriptions.sql
│   │   ├── intermediate/                  # Business logic joins
│   │   │   ├── finance/
│   │   │   │   ├── _finance__models.yml
│   │   │   │   └── int_revenue_by_customer.sql
│   │   │   └── marketing/
│   │   │       └── int_campaign_attribution.sql
│   │   └── marts/                         # Final business entities
│   │       ├── finance/
│   │       │   ├── _finance__models.yml
│   │       │   ├── fct_revenue.sql
│   │       │   └── dim_customers.sql
│   │       └── marketing/
│   │           ├── fct_campaign_performance.sql
│   │           └── dim_campaigns.sql
│   ├── seeds/                             # Static reference data (CSV)
│   │   ├── country_codes.csv
│   │   └── product_categories.csv
│   ├── macros/                            # Reusable SQL macros
│   │   ├── generate_schema_name.sql
│   │   ├── cents_to_dollars.sql
│   │   └── date_spine.sql
│   ├── snapshots/                         # SCD Type 2 snapshots
│   │   └── snap_customers.sql
│   ├── tests/                             # Custom data tests
│   │   └── assert_positive_revenue.sql
│   ├── analyses/                          # Ad-hoc SQL (not materialized)
│   │   └── quarterly_review.sql
│   ├── dbt_project.yml
│   ├── packages.yml                       # dbt packages (dbt-utils, etc.)
│   └── profiles.yml                       # Connection profiles (NOT committed)
│
├── ingestion/                             # Custom ingestion scripts
│   ├── extractors/
│   │   ├── salesforce_extractor.py
│   │   ├── stripe_extractor.py
│   │   └── base_extractor.py
│   ├── loaders/
│   │   ├── s3_loader.py
│   │   └── snowflake_loader.py
│   └── configs/
│       └── sources.yaml
│
├── streaming/                             # Real-time processing
│   ├── consumers/
│   │   ├── event_processor.py
│   │   └── clickstream_consumer.py
│   ├── producers/
│   │   └── cdc_producer.py
│   └── schemas/
│       └── avro/
│           ├── user_event.avsc
│           └── order_event.avsc
│
├── quality/                               # Data quality checks
│   ├── great_expectations/
│   │   ├── expectations/
│   │   ├── checkpoints/
│   │   └── great_expectations.yml
│   └── soda/
│       └── checks/
│
├── infrastructure/                        # IaC for data platform
│   ├── terraform/
│   └── docker-compose.yml
│
├── docs/                                  # Data documentation
│   ├── data-dictionary.md
│   ├── pipeline-runbook.md
│   └── diagrams/
│
├── pyproject.toml
├── README.md
└── Makefile
```

---

## 2. dbt Model Layers

```
Source → Staging → Intermediate → Marts

┌─────────┐    ┌──────────┐    ┌──────────────┐    ┌─────────┐
│ Raw Data │ →  │ Staging  │ →  │ Intermediate │ →  │ Marts   │
│ (source) │    │ stg_*    │    │ int_*        │    │ fct_*   │
│          │    │          │    │              │    │ dim_*   │
└─────────┘    └──────────┘    └──────────────┘    └─────────┘

Staging (stg_):
  - 1:1 mapping to source tables
  - Rename columns to consistent convention
  - Cast data types
  - Basic cleaning (trim, lowercase)
  - NO business logic, NO joins
  - Materialized as: view

Intermediate (int_):
  - Business logic and joins
  - Reusable building blocks
  - Referenced by marts, not directly queried
  - Materialized as: ephemeral or view

Marts (fct_, dim_):
  - Final business entities
  - Consumed by BI tools and analysts
  - fct_ = facts (events, transactions)
  - dim_ = dimensions (entities, attributes)
  - Materialized as: table or incremental
```

---

## 3. dbt Model Example

```sql
-- models/staging/stripe/stg_stripe__charges.sql

with source as (
    select * from {{ source('stripe', 'charges') }}
),

renamed as (
    select
        id as charge_id,
        customer as customer_id,
        amount as amount_cents,
        {{ cents_to_dollars('amount') }} as amount_dollars,
        currency,
        status,
        created as created_at,
        metadata,
        _fivetran_synced as synced_at
    from source
    where status != 'failed'
)

select * from renamed
```

```sql
-- models/marts/finance/fct_revenue.sql

with charges as (
    select * from {{ ref('stg_stripe__charges') }}
    where status = 'succeeded'
),

customers as (
    select * from {{ ref('dim_customers') }}
),

final as (
    select
        charges.charge_id,
        charges.customer_id,
        customers.customer_name,
        customers.segment,
        charges.amount_dollars,
        charges.currency,
        charges.created_at,
        date_trunc('month', charges.created_at) as revenue_month
    from charges
    left join customers on charges.customer_id = customers.customer_id
)

select * from final
```

---

## 4. dbt Configuration

```yaml
# dbt_project.yml
name: my_data_platform
version: "1.0.0"
config-version: 2

profile: my_data_platform

model-paths: ["models"]
seed-paths: ["seeds"]
test-paths: ["tests"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]
analysis-paths: ["analyses"]

models:
  my_data_platform:
    staging:
      +materialized: view
      +schema: staging
    intermediate:
      +materialized: ephemeral
    marts:
      +materialized: table
      +schema: marts
      finance:
        +schema: finance
        +tags: ["finance", "daily"]
      marketing:
        +schema: marketing
        +tags: ["marketing", "daily"]
```

```yaml
# packages.yml
packages:
  - package: dbt-labs/dbt_utils
    version: ">=1.0.0"
  - package: dbt-labs/codegen
    version: ">=0.12.0"
  - package: calogica/dbt_date
    version: ">=0.10.0"
```

---

## 5. Airflow DAG Pattern

```python
# orchestration/dags/transformation/run_dbt.py

from datetime import datetime
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.sensors.external_task import ExternalTaskSensor

default_args = {
    "owner": "data-engineering",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["data-alerts@company.com"],
}

with DAG(
    dag_id="dbt_daily_transformation",
    default_args=default_args,
    schedule="0 6 * * *",                  # Daily at 6 AM UTC
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["dbt", "transformation", "daily"],
    doc_md="""
    ## Daily dbt Transformation
    Runs staging → intermediate → marts models.
    Depends on ingestion DAGs completing first.
    """,
) as dag:

    wait_for_ingestion = ExternalTaskSensor(
        task_id="wait_for_ingestion",
        external_dag_id="ingest_all_sources",
        external_task_id="done",
        timeout=3600,
    )

    dbt_deps = BashOperator(
        task_id="dbt_deps",
        bash_command="cd /opt/dbt && dbt deps",
    )

    dbt_run_staging = BashOperator(
        task_id="dbt_run_staging",
        bash_command="cd /opt/dbt && dbt run --select staging",
    )

    dbt_run_marts = BashOperator(
        task_id="dbt_run_marts",
        bash_command="cd /opt/dbt && dbt run --select marts",
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command="cd /opt/dbt && dbt test",
    )

    wait_for_ingestion >> dbt_deps >> dbt_run_staging >> dbt_run_marts >> dbt_test
```

---

## 6. Data Quality

```yaml
# dbt model tests (in _models.yml)
models:
  - name: fct_revenue
    description: Revenue fact table
    columns:
      - name: charge_id
        tests:
          - unique
          - not_null
      - name: amount_dollars
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id
```

```
Data quality layers:

1. dbt tests (in-transform)
   - unique, not_null, relationships, accepted_values
   - Run after every dbt run
   - Block downstream if critical tests fail

2. Great Expectations / Soda (pre/post pipeline)
   - Schema validation
   - Row count expectations
   - Statistical distribution checks
   - Data freshness checks

3. Monitoring (continuous)
   - Data freshness alerts
   - Row count anomaly detection
   - Schema change detection
   - Pipeline SLA monitoring
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Business logic in DAGs | Complex Python in Airflow tasks | Move logic to dbt or separate services |
| No staging layer | Raw source data used directly | Staging models clean + rename |
| God DAG (one DAG does everything) | Long runtime, hard to debug | Split by domain/source |
| No data tests | Bad data reaches dashboards | dbt tests + data quality checks |
| Hardcoded SQL in orchestrator | Unmaintainable transformations | Use dbt for all SQL transforms |
| No documentation | Nobody understands the data | dbt docs generate + data dictionary |
| No idempotency | Re-runs create duplicates | Incremental models with merge logic |
| Monolithic dbt project | 1000+ models, slow runs | Split by domain, use dbt packages |
| No lineage tracking | Can't trace data provenance | dbt lineage + data catalog |

---

## 8. Enforcement Checklist

- [ ] dbt for SQL transformations — staging → intermediate → marts
- [ ] One DAG per pipeline — NOT one monolith DAG
- [ ] Orchestrator triggers, doesn't compute — no business logic in DAGs
- [ ] Data tests on every model — unique, not_null, relationships
- [ ] Sources documented — `_sources.yml` for every source
- [ ] Models documented — `_models.yml` with descriptions and tests
- [ ] Incremental models — for large fact tables
- [ ] Seeds for reference data — country codes, categories
- [ ] Macros for reusable SQL — DRY transformations
- [ ] Data quality monitoring — freshness, row counts, distributions
- [ ] Lineage visible — dbt docs or data catalog
- [ ] Profiles.yml NOT committed — connection config is per-environment
