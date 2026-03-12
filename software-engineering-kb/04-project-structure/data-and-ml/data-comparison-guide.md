# Data & ML Comparison Guide

> **AI Plugin Directive:** When deciding on data pipeline architecture, ML tooling, or analytics platform structure, ALWAYS consult this guide first. Use the decision trees to select the right patterns for the project's data volume, team, and use case.

**Core Rule: Choose data tools based on data volume, team skills, and use case. NEVER over-engineer -- a dbt project with a simple scheduler is enough for most analytics teams. Add ML infrastructure only when you have proven model value with notebooks first.**

---

## 1. Decision Tree: Project Type

```
What is the primary goal?
|
+-- Business analytics / reporting
|   +-- SQL-based            --> dbt + BI tool (Metabase, Looker, Superset)
|   +-- Light Python analysis --> Jupyter + pandas
|   +-- See: analytics-project-structure.md
|
+-- Data pipeline / ETL
|   +-- Batch processing     --> Airflow/Dagster + dbt
|   +-- Real-time streaming  --> Kafka + Flink/Spark Streaming
|   +-- Simple ELT           --> Fivetran/Airbyte + dbt
|   +-- See: data-pipeline-structure.md
|
+-- Machine learning
|   +-- Classical ML         --> scikit-learn + MLflow
|   +-- Deep learning        --> PyTorch + W&B
|   +-- LLM application      --> LangChain/LlamaIndex + prompt management
|   +-- See: ml-project-structure.md
|
+-- Data science exploration
    +-- Start with notebooks
    +-- Prove value first
    +-- Productionize when validated
```

---

## 2. Tool Comparison: Orchestration

### 2.1 Airflow vs Dagster vs Prefect vs Mage

| Feature | Airflow | Dagster | Prefect | Mage |
|---------|---------|---------|---------|------|
| Best for | Established pipelines | Modern data platform | Simple workflows | Quick prototyping |
| Language | Python | Python | Python | Python |
| Architecture | Task-based DAGs | Asset-based lineage | Task-based flows | Block-based pipelines |
| UI | Web UI (heavy) | Asset catalog + Launchpad | Cloud dashboard | Notebook-like UI |
| Data awareness | Task-based (no data) | Asset-based (data first) | Task-based | Block-based |
| Testing | Moderate (mock operators) | Excellent (first-class) | Good | Basic |
| Learning curve | Medium-High | Medium | Low | Low |
| Community | Largest (Apache) | Growing fast | Medium | Growing |
| Scheduling | Built-in (cron) | Built-in (cron) | Built-in + events | Built-in |
| Cloud managed | MWAA, Astronomer, GCC | Dagster Cloud | Prefect Cloud | Mage Pro |
| Deployment | K8s, Docker, Celery | K8s, Docker, serverless | K8s, Docker, serverless | Docker, K8s |
| Software-defined assets | No (retrofitted) | Yes (native) | No | Partial |
| Partition support | Limited (catchup) | Native (first-class) | No | No |
| Dynamic pipelines | TaskFlow API (2.x) | Dynamic graphs | Dynamic tasks | Limited |
| I/O management | Custom XCom | Built-in IOManager | Artifacts | Blocks |
| Backfills | Catchup mechanism | Native partitioned backfill | Manual | Manual |
| Alerting | Email, Slack, PagerDuty | Built-in + custom | Built-in + automations | Built-in |
| Open source | Yes (Apache 2.0) | Yes (Apache 2.0) | Yes (Apache 2.0) | Yes (Apache 2.0) |
| Recommendation | Standard choice | **Modern projects** | Simple needs | Prototyping |

```
DECISION:
  Industry standard, large team, mature org        --> Airflow
  Modern data platform, asset-first thinking       --> Dagster (RECOMMENDED)
  Simple workflows, quick setup, small team        --> Prefect
  Rapid prototyping, data team wants notebook UX   --> Mage
  Non-data workflow orchestration                  --> Temporal

WHY DAGSTER IS RECOMMENDED FOR NEW PROJECTS:
  1. Asset-based model matches how data teams think
  2. First-class testing and type safety
  3. Native partitioning and backfill support
  4. Better local development experience
  5. Software-defined assets prevent orphaned jobs
  6. Built-in data quality checks
```

### 2.2 Orchestrator Configuration Examples

```python
# DAGSTER: assets.py
from dagster import asset, AssetIn, DailyPartitionsDefinition, MetadataValue
import pandas as pd

daily_partitions = DailyPartitionsDefinition(start_date="2024-01-01")

@asset(
    partitions_def=daily_partitions,
    group_name="staging",
    description="Raw orders cleaned and deduplicated",
)
def stg_orders(context) -> pd.DataFrame:
    partition_date = context.partition_key
    df = pd.read_sql(f"""
        SELECT * FROM raw.orders
        WHERE order_date = '{partition_date}'
    """, conn)

    df = df.drop_duplicates(subset=["order_id"])
    context.add_output_metadata({
        "row_count": MetadataValue.int(len(df)),
        "partition": MetadataValue.text(partition_date),
    })
    return df


@asset(
    ins={"stg_orders": AssetIn()},
    group_name="marts",
    description="Daily revenue aggregation",
)
def fct_daily_revenue(stg_orders: pd.DataFrame) -> pd.DataFrame:
    return stg_orders.groupby("order_date").agg(
        total_revenue=("amount", "sum"),
        order_count=("order_id", "count"),
        avg_order_value=("amount", "mean"),
    ).reset_index()
```

```python
# AIRFLOW: dags/etl_orders.py
from airflow import DAG
from airflow.decorators import task
from datetime import datetime, timedelta

default_args = {
    "owner": "data-team",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["data-team@company.com"],
}

with DAG(
    dag_id="etl_orders",
    default_args=default_args,
    description="Daily orders ETL pipeline",
    schedule="0 6 * * *",   # 6 AM daily
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["etl", "orders"],
) as dag:

    @task
    def extract_orders(**context):
        execution_date = context["ds"]
        # Extract logic
        return {"row_count": 1000}

    @task
    def transform_orders(extract_result):
        # Transform logic
        return {"processed": extract_result["row_count"]}

    @task
    def load_to_warehouse(transform_result):
        # Load logic
        pass

    extract = extract_orders()
    transform = transform_orders(extract)
    load_to_warehouse(transform)
```

```python
# PREFECT: flows/etl_orders.py
from prefect import flow, task
from prefect.tasks import task_input_hash
from datetime import timedelta

@task(retries=3, retry_delay_seconds=60, cache_key_fn=task_input_hash, cache_expiration=timedelta(hours=1))
def extract_orders(date: str) -> dict:
    # Extract logic
    return {"data": [], "row_count": 1000}

@task
def transform_orders(raw_data: dict) -> dict:
    # Transform logic
    return {"processed": raw_data["row_count"]}

@task
def load_to_warehouse(data: dict) -> None:
    # Load logic
    pass

@flow(name="etl-orders", log_prints=True)
def etl_orders_flow(date: str = "2024-01-01"):
    raw = extract_orders(date)
    transformed = transform_orders(raw)
    load_to_warehouse(transformed)
```

---

## 3. Tool Comparison: Experiment Tracking

### 3.1 MLflow vs Weights & Biases vs Neptune vs ClearML

| Feature | MLflow | Weights & Biases | Neptune | ClearML |
|---------|--------|-------------------|---------|---------|
| **Pricing** | Free (OSS) | Free tier, paid teams | Paid (free individual) | Free (OSS), paid cloud |
| **Self-hosted** | Yes | Enterprise only | No (SaaS only) | Yes |
| **Model registry** | Built-in | Artifacts + Registry | Model store | Model serving |
| **Experiment UI** | Basic but functional | Excellent (best-in-class) | Good | Good |
| **Collaboration** | Basic | Excellent (reports, teams) | Good | Good |
| **GPU monitoring** | No | Built-in (real-time) | No | Built-in |
| **Hyperparameter sweep** | No (use Optuna) | Built-in Sweeps | Built-in | Built-in HPO |
| **Artifact tracking** | MLflow Artifacts | W&B Artifacts | Built-in | Built-in |
| **Dataset versioning** | No | W&B Datasets | Built-in | ClearML Data |
| **Pipeline support** | MLflow Pipelines | Launch (jobs) | No | ClearML Pipelines |
| **Model serving** | MLflow Serving | No | No | ClearML Serving |
| **LLM support** | MLflow Tracing | Weave (W&B) | No | No |
| **Framework support** | All major | All major | All major | All major |
| **API complexity** | Simple | Simple | Moderate | Moderate |
| **Data lineage** | Basic | Good | Good | Good |
| **Integrations** | Databricks, Spark | HuggingFace, PyTorch | Limited | AWS, GCP |
| **Compliance/audit** | Enterprise | Enterprise | Enterprise | Enterprise |
| **Best for** | Standard / self-hosted | Research teams | Enterprise SaaS | Full MLOps pipeline |

```
DECISION TREE:

Need self-hosted, on-prem, or air-gapped?
  --> MLflow (default) or ClearML

Research team / academia / best experiment UI?
  --> Weights & Biases

Full MLOps platform (training + serving + data)?
  --> ClearML (OSS) or Vertex AI / SageMaker (cloud)

Simple logging, already on Databricks?
  --> MLflow (native integration)

LLM application tracking?
  --> MLflow Tracing or W&B Weave

ENTERPRISE RECOMMENDATION:
  Default choice     --> MLflow (widest adoption, most portable)
  If budget allows   --> W&B for experiment tracking + MLflow for registry
  Databricks users   --> MLflow (native, managed)
  AWS-heavy          --> SageMaker + MLflow
  GCP-heavy          --> Vertex AI + MLflow
```

### 3.2 Usage Examples

```python
# MLflow
import mlflow
import mlflow.sklearn

mlflow.set_tracking_uri("http://mlflow.internal:5000")
mlflow.set_experiment("customer-churn")

with mlflow.start_run(run_name="rf-baseline"):
    mlflow.log_params({
        "n_estimators": 100,
        "max_depth": 10,
        "min_samples_split": 5,
    })

    model = RandomForestClassifier(n_estimators=100, max_depth=10)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    mlflow.log_metrics({
        "accuracy": accuracy_score(y_test, predictions),
        "precision": precision_score(y_test, predictions),
        "recall": recall_score(y_test, predictions),
        "f1": f1_score(y_test, predictions),
        "auc_roc": roc_auc_score(y_test, model.predict_proba(X_test)[:, 1]),
    })

    mlflow.sklearn.log_model(
        model,
        "model",
        registered_model_name="customer-churn-model",
        input_example=X_test[:5],
        signature=mlflow.models.infer_signature(X_train, predictions),
    )

    mlflow.log_artifact("feature_importance.png")
```

```python
# Weights & Biases
import wandb

wandb.init(
    project="customer-churn",
    name="rf-baseline",
    config={
        "n_estimators": 100,
        "max_depth": 10,
        "min_samples_split": 5,
        "dataset_version": "v2.1",
    },
    tags=["baseline", "random-forest"],
)

model = RandomForestClassifier(**wandb.config)
model.fit(X_train, y_train)

wandb.log({
    "accuracy": accuracy_score(y_test, predictions),
    "precision": precision_score(y_test, predictions),
    "recall": recall_score(y_test, predictions),
    "confusion_matrix": wandb.plot.confusion_matrix(
        y_true=y_test, preds=predictions, class_names=["retain", "churn"]
    ),
    "roc_curve": wandb.plot.roc_curve(y_test, model.predict_proba(X_test)),
    "feature_importance": wandb.Table(
        data=list(zip(feature_names, model.feature_importances_)),
        columns=["feature", "importance"],
    ),
})

wandb.finish()
```

---

## 4. Tool Comparison: SQL Transformation

### 4.1 dbt vs Dataform vs SQLMesh

| Feature | dbt | Dataform | SQLMesh |
|---------|-----|----------|---------|
| **Owner** | dbt Labs | Google (BigQuery) | Tobiko Data |
| **Language** | SQL + Jinja | SQL + JavaScript | SQL + Python |
| **Open source** | Yes (dbt-core) | Partial | Yes |
| **Cloud offering** | dbt Cloud | Part of BigQuery | SQLMesh Cloud |
| **Warehouse support** | All major (Snowflake, BQ, Redshift, Databricks, Postgres, etc.) | BigQuery only | All major |
| **Testing** | Built-in (generic + singular) | Built-in assertions | Built-in (audits) |
| **Lineage/docs** | Built-in DAG | Built-in | Built-in |
| **Incremental models** | Yes (merge, insert_overwrite) | Yes | Yes (native) |
| **Version control** | Git-native | Git (Dataform repos) | Git-native |
| **Semantic layer** | MetricFlow | No | No |
| **Snapshot (SCD)** | Built-in | No | Built-in |
| **Macros/reuse** | Jinja macros, packages | JavaScript functions | Python macros |
| **CI/CD** | dbt Cloud CI, GitHub Actions | Dataform CI | Built-in |
| **IDE** | dbt Cloud IDE, VS Code | Dataform web IDE | VS Code |
| **Column-level lineage** | dbt Cloud (paid) | No | Yes (free) |
| **Virtual environments** | No | No | Yes (plan changes safely) |
| **Change management** | Manual (blue/green) | No | Built-in (virtual envs) |
| **Community** | Very large | Small (Google users) | Growing |
| **Learning curve** | Low (SQL + Jinja) | Low (SQL + JS) | Medium (SQL + Python) |
| **Best for** | Most teams | BigQuery-only teams | Advanced data eng |

```
DECISION:

Default choice for any team:
  --> dbt (largest community, most resources, most adapters)

BigQuery-only, Google ecosystem:
  --> Dataform (free, integrated with BigQuery)

Need advanced change management, Python integration:
  --> SQLMesh (virtual environments, column-level lineage)

ENTERPRISE PATTERNS:
  dbt + Airflow/Dagster (orchestration)
  dbt + Snowflake/BigQuery (warehouse)
  dbt + dbt Cloud or GitHub Actions (CI/CD)
  dbt + Lightdash/Looker/Metabase (BI)
```

### 4.2 dbt Project Configuration

```yaml
# dbt_project.yml
name: "analytics"
version: "1.0.0"
config-version: 2

profile: "analytics"

model-paths: ["models"]
analysis-paths: ["analyses"]
test-paths: ["tests"]
seed-paths: ["seeds"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]

clean-targets: ["target", "dbt_packages"]

models:
  analytics:
    staging:
      +materialized: view
      +schema: staging
      +tags: ["staging"]
    intermediate:
      +materialized: ephemeral
      +tags: ["intermediate"]
    marts:
      +materialized: table
      +schema: marts
      +tags: ["marts"]
      core:
        +materialized: table
      finance:
        +materialized: table
      marketing:
        +materialized: incremental

seeds:
  analytics:
    +schema: seeds

snapshots:
  analytics:
    +schema: snapshots

vars:
  start_date: "2020-01-01"
  currency: "USD"
```

---

## 5. Tool Comparison: Notebook Environments

### 5.1 Jupyter vs Marimo vs Hex

| Feature | Jupyter (Lab/Notebook) | Marimo | Hex |
|---------|------------------------|--------|-----|
| **Type** | Open source | Open source | Commercial SaaS |
| **Reactivity** | None (manual re-run) | Reactive (automatic) | Reactive |
| **Reproducibility** | Poor (hidden state) | Excellent (DAG-based) | Good |
| **Format** | .ipynb (JSON) | .py (pure Python) | Proprietary |
| **Version control** | Difficult (JSON diffs) | Easy (Python files) | Built-in |
| **Collaboration** | JupyterHub | Share .py files | Built-in (real-time) |
| **SQL support** | Via libraries | Built-in | Native SQL cells |
| **Visualization** | matplotlib, plotly | Built-in widgets | Built-in charts |
| **App deployment** | Voila, Panel | Built-in (marimo run) | Published apps |
| **Data exploration** | Manual | Built-in DataFrame viewer | Built-in |
| **Parameterization** | papermill | Built-in (UI widgets) | Input parameters |
| **Production use** | Via papermill/nbconvert | As Python scripts | Scheduled jobs |
| **Git-friendly** | No (JSON) | Yes (Python) | N/A |
| **Community** | Massive | Growing fast | Enterprise |
| **Best for** | Standard choice | Modern alternative | Business teams |

```
DECISION:

Default, widest compatibility:
  --> Jupyter Lab (most libraries, largest ecosystem)

Reproducible notebooks, git-friendly, solo developer:
  --> Marimo (recommended for new projects)

Business teams, collaborative analytics:
  --> Hex (paid, best collaboration)

Jupyter in production:
  --> papermill (parameterized execution)
  --> nbconvert (convert to scripts)
  --> Ploomber (pipeline from notebooks)
```

---

## 6. Architecture Patterns

### 6.1 Data Lakehouse vs Warehouse vs Lake

| Aspect | Data Warehouse | Data Lake | Data Lakehouse |
|--------|----------------|-----------|----------------|
| **Storage** | Structured (columnar) | Raw (any format) | Structured + raw |
| **Format** | Proprietary (Snowflake, BQ) | Parquet, JSON, CSV, etc. | Open table formats |
| **Schema** | Schema-on-write | Schema-on-read | Schema-on-write + evolution |
| **ACID** | Yes | No (without table format) | Yes (Delta/Iceberg/Hudi) |
| **Cost** | High (compute + storage) | Low (object storage) | Low-Medium |
| **Query speed** | Very fast | Slow (without optimization) | Fast (with optimization) |
| **ML support** | Limited | Good (raw data access) | Excellent |
| **Time travel** | Limited | No | Yes (built-in) |
| **Governance** | Built-in | Manual | Unity Catalog / Polaris |
| **Examples** | Snowflake, BigQuery, Redshift | S3 + Athena, ADLS | Databricks, Iceberg on S3 |
| **Best for** | BI/analytics | Data science, raw storage | Modern unified platform |

```
OPEN TABLE FORMATS:

Delta Lake (Databricks):
  - Strongest Spark integration
  - Liquid clustering, ZORDER optimization
  - Unity Catalog for governance
  - Best on: Databricks

Apache Iceberg (Community):
  - Vendor-neutral (widest adoption trend)
  - Partition evolution (no rewrite needed)
  - Hidden partitioning
  - Best on: AWS (Athena, Glue), Snowflake, Trino

Apache Hudi (Uber):
  - Optimized for CDC and streaming
  - Record-level updates
  - Best on: AWS EMR, streaming pipelines

RECOMMENDATION (2025):
  Databricks users         --> Delta Lake
  Multi-vendor / new build --> Apache Iceberg (converging standard)
  Heavy CDC / streaming    --> Apache Hudi
```

### 6.2 Medallion Architecture

```
MEDALLION (BRONZE / SILVER / GOLD):

Bronze Layer (Raw):
  - Raw data, exactly as ingested
  - Append-only, never modified
  - Retain for compliance and reprocessing
  - Format: Parquet / Delta / Iceberg
  - Schema: matches source systems

Silver Layer (Cleaned):
  - Deduplicated, validated, typed
  - Business entities joined
  - Conformed dimensions
  - NULL handling, data quality rules applied
  - 1:1 mapping to bronze tables (usually)

Gold Layer (Business):
  - Aggregated, business-ready
  - Star schema / wide tables
  - Optimized for BI queries
  - KPIs, metrics, dashboards
  - Domain-specific (finance, marketing, product)

MEDALLION ARCHITECTURE DIAGRAM:

  Sources          Bronze           Silver           Gold
  +--------+      +--------+      +--------+      +--------+
  | App DB |----->| raw_   |----->| stg_   |----->| fct_   |
  +--------+      | orders |      | orders |      | revenue|
                  +--------+      +--------+      +--------+
  +--------+      +--------+      +--------+      +--------+
  | S3 CSV |----->| raw_   |----->| stg_   |----->| dim_   |
  +--------+      | users  |      | users  |      | users  |
                  +--------+      +--------+      +--------+
  +--------+      +--------+      +--------+      +--------+
  | API    |----->| raw_   |----->| stg_   |----->| fct_   |
  +--------+      | events |      | events |      | funnel |
                  +--------+      +--------+      +--------+

dbt LAYER MAPPING:
  Bronze = sources (defined in schema.yml, not created by dbt)
  Silver = staging models (stg_*)
  Gold   = marts models (dim_*, fct_*)

NAMING CONVENTIONS:
  Bronze:  raw_{source}_{table}     e.g., raw_stripe_charges
  Silver:  stg_{source}_{entity}    e.g., stg_stripe_charges
  Gold:    dim_{entity}             e.g., dim_customers
           fct_{event/metric}       e.g., fct_orders
           agg_{entity}_{grain}     e.g., agg_revenue_daily
```

### 6.3 Feature Stores

```
FEATURE STORE COMPARISON:

| Feature | Feast | Tecton | Databricks FS | SageMaker FS | Hopsworks |
|---------|-------|--------|---------------|--------------|-----------|
| OSS     | Yes   | No     | No            | No           | Yes       |
| Real-time | Yes | Yes    | Yes           | Yes          | Yes       |
| Offline   | Yes | Yes    | Yes           | Yes          | Yes       |
| Online store | Redis, DynamoDB | Custom | Unity Catalog | DynamoDB | MySQL/RonDB |
| Offline store | BigQuery, Snowflake, Redshift | S3/warehouse | Delta Lake | S3 | Hive |
| Streaming | Limited | Native | Native | Limited | Native |
| Feature transform | Python SDK | Tecton SDK | Spark/SQL | SageMaker | Spark/Flink |
| Point-in-time join | Yes | Yes | Yes | Yes | Yes |
| Governance | Basic | Enterprise | Unity Catalog | Built-in | Built-in |
| Best for | OSS default | Enterprise real-time | Databricks users | AWS users | On-prem |

WHAT IS A FEATURE STORE:
  Centralized repository for ML features.
  Ensures training and serving use the SAME feature values.
  Prevents training-serving skew.
  Provides point-in-time correctness for historical features.

WHEN YOU NEED A FEATURE STORE:
  - Multiple models share the same features
  - Real-time serving requires precomputed features
  - Need point-in-time correctness (avoid data leakage)
  - Team > 3 ML engineers sharing feature pipelines

WHEN YOU DON'T:
  - Single model, batch predictions only
  - Small team, features computed in training script
  - No real-time serving requirements
```

---

## 7. Architecture by Scale

| Scale | Data Volume | Team | Stack |
|-------|-------------|------|-------|
| **Startup** | < 1 GB/day | 1-2 analysts | PostgreSQL + dbt + Metabase |
| **Growing** | 1-100 GB/day | 3-10 | Snowflake/BigQuery + dbt + Dagster + Looker |
| **Scale-up** | 100 GB - 1 TB/day | 10-30 | Lakehouse + Spark + dbt + Dagster + custom BI |
| **Enterprise** | 1+ TB/day | 30+ | Lakehouse + Kafka + Spark + Dagster + ML platform |

```
PROGRESSIVE ARCHITECTURE:

Phase 1: PostgreSQL + dbt + simple BI
  Cost: ~$0/month (free tier)
  Handles: Up to ~10M rows, simple analytics
  Team: 1 analyst who knows SQL

Phase 2: + Cloud warehouse (Snowflake/BigQuery)
  Cost: ~$500-5K/month
  Handles: Billions of rows, complex analytics
  Team: 2-5 analysts + 1 data engineer

Phase 3: + Orchestration (Dagster/Airflow)
  Cost: ~$2K-10K/month
  Handles: Multiple data sources, scheduled pipelines
  Team: 5-10 including data engineers

Phase 4: + Streaming (Kafka) + CDC
  Cost: ~$10K-50K/month
  Handles: Real-time data, event-driven architecture
  Team: 10-20 data + platform engineers

Phase 5: + ML platform (MLflow + feature store)
  Cost: ~$50K-200K/month
  Handles: Production ML, model serving, experiments
  Team: 20+ including ML engineers

NEVER start at Phase 5. Every premature Phase 5 I've seen has:
  - 10x the cost with 0.1x the value
  - ML models that nobody uses
  - Infrastructure that nobody can maintain
  - Features stores with 3 features in them
```

---

## 8. Ingestion Tool Comparison

| Feature | Fivetran | Airbyte | Meltano | Custom (Python) |
|---------|----------|---------|---------|-----------------|
| **Type** | SaaS (managed) | Open source + cloud | Open source | Custom code |
| **Connectors** | 300+ (maintained) | 350+ (community) | Singer taps | Unlimited |
| **Pricing** | Per MAR ($$$) | Free (self) / cloud ($) | Free | Engineering time |
| **Setup time** | Minutes | Hours-days | Hours | Days-weeks |
| **Maintenance** | Zero | Medium | Medium | High |
| **CDC** | Yes (many sources) | Limited | No | Manual |
| **Schema evolution** | Automatic | Automatic | Manual | Manual |
| **Reliability** | Very high | Medium | Medium | Depends |
| **Best for** | Well-funded teams | Budget-conscious | Singer ecosystem | Custom sources |

```
DECISION:
  Budget + need reliability    --> Fivetran
  Budget-conscious + OSS       --> Airbyte
  Custom sources, full control --> Custom Python scripts
  Singer/Meltano ecosystem     --> Meltano

COMMON PATTERNS:
  Fivetran/Airbyte --> Cloud warehouse (bronze)
  dbt              --> Transform (silver, gold)
  Dagster/Airflow  --> Orchestrate everything
  Looker/Metabase  --> Serve (dashboards)
```

---

## 9. BI Tool Comparison

| Feature | Metabase | Looker | Superset | Lightdash | Tableau | Power BI |
|---------|----------|--------|----------|-----------|---------|----------|
| **OSS** | Yes | No | Yes | Yes | No | No |
| **Self-hosted** | Yes | No (Google Cloud) | Yes | Yes | Server | On-prem |
| **dbt integration** | Basic | LookML | No | Native | No | No |
| **Semantic layer** | No | LookML | No | dbt metrics | No | DAX |
| **SQL mode** | Yes | Yes | Yes | No (dbt only) | Yes | DAX |
| **Learning curve** | Low | High (LookML) | Medium | Low | Medium | Medium |
| **Self-service** | Excellent | Good | Good | Good | Excellent | Excellent |
| **Cost** | Free (OSS) | $$$ | Free (OSS) | Free (OSS) | $$$ | $$ |
| **Embedding** | Yes | Yes | Yes | Yes | Yes | Yes |
| **Best for** | Startups, SMBs | Enterprise | Technical teams | dbt teams | Enterprise | Microsoft shops |

```
DECISION:
  Startup, budget-conscious        --> Metabase (free, easy setup)
  dbt-native, modern data stack    --> Lightdash
  Enterprise, advanced governance  --> Looker or Tableau
  Microsoft ecosystem              --> Power BI
  Technical team, full control     --> Apache Superset
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| Starting at Phase 5 | ML platform with 3 users | 10x cost, 0.1x value | Start with dbt + BI, prove value first |
| Spark for small data | < 10GB processed with Spark | Massive overhead, slow development | Use pandas, Polars, or DuckDB |
| No orchestrator | Cron jobs and manual runs | Silent failures, no retry, no lineage | Add Dagster or Airflow |
| Dashboard on raw tables | Slow queries, inconsistent metrics | Users don't trust data | Materialized marts layer with dbt |
| Notebook in production | .ipynb scheduled with cron | No testing, no versioning, hidden state | Extract to Python modules or dbt |
| Custom everything | Custom ingestion, custom transform, custom BI | Massive maintenance burden | Use standard tools (Airbyte, dbt, Metabase) |
| No testing of data | Bad data reaches dashboards | Wrong business decisions | dbt tests, Great Expectations, Soda |
| Treating warehouse like app DB | Direct app reads from warehouse | Performance issues, coupling | API layer or materialized views |
| No data quality checks | Dashboards show wrong numbers | Eroded trust in data team | dbt tests + data contracts + alerting |
| Feature store with 3 features | Over-engineered for the team size | Wasted engineering effort | Simple Python feature computation until 10+ shared features |

---

## 11. CLI Commands Reference

```bash
# dbt
dbt init my_project             # Initialize new project
dbt run                         # Run all models
dbt run --select staging        # Run staging models only
dbt run --select +fct_orders    # Run fct_orders and all upstream
dbt test                        # Run all tests
dbt test --select fct_orders    # Run tests for specific model
dbt build                       # Run + test in dependency order
dbt docs generate               # Generate documentation
dbt docs serve                  # Serve docs locally
dbt seed                        # Load seed data
dbt snapshot                    # Run snapshots (SCD Type 2)
dbt source freshness            # Check source freshness
dbt compile                     # Compile SQL without running
dbt debug                       # Test connection
dbt deps                        # Install packages
dbt parse                       # Parse project (validate)

# Dagster
dagster dev                     # Start local dev server (UI + daemon)
dagster asset materialize       # Materialize assets
dagster job execute             # Execute a job
dagster asset list              # List all assets

# Airflow
airflow db init                 # Initialize database
airflow webserver               # Start web UI
airflow scheduler               # Start scheduler
airflow dags list               # List all DAGs
airflow dags trigger <dag_id>   # Trigger a DAG run
airflow tasks test <dag> <task> <date>  # Test a single task

# MLflow
mlflow ui                       # Start MLflow UI
mlflow run .                    # Run MLflow project
mlflow models serve -m runs:/<run_id>/model -p 5001  # Serve model
mlflow models build-docker      # Build Docker image for model

# Prefect
prefect server start            # Start local Prefect server
prefect deploy                  # Deploy flow to server
prefect flow-run create         # Create a flow run
```

---

## 12. Cross-Reference Guide

```
For detailed implementation guides:

Data Pipelines (ETL/ELT, Airflow, dbt):
  --> data-pipeline-structure.md

Machine Learning (experiments, training, serving):
  --> ml-project-structure.md

Analytics & BI (dashboards, metrics, reporting):
  --> analytics-project-structure.md
```

---

## 13. Decision Checklist

- [ ] Project type identified -- analytics, pipeline, ML, or exploration
- [ ] Scale assessed -- data volume determines tool choices
- [ ] Team skills matched -- SQL team -> dbt, Python team -> custom
- [ ] Start simple -- PostgreSQL + dbt before Spark + Kafka
- [ ] Orchestration selected -- Dagster (modern), Airflow (standard)
- [ ] Transformation tool -- dbt (SQL, default), SQLMesh (advanced)
- [ ] Experiment tracking -- MLflow (default), W&B (research)
- [ ] BI tool -- Metabase (startup), Looker/Tableau (enterprise)
- [ ] Ingestion -- Fivetran (managed), Airbyte (OSS)
- [ ] Notebook environment -- Jupyter (standard), Marimo (modern)
- [ ] Architecture pattern -- medallion (bronze/silver/gold) for lakehouse
- [ ] Table format -- Iceberg (vendor-neutral), Delta (Databricks)
- [ ] Feature store -- only when 10+ shared features across models
- [ ] Prove value with notebooks first -- productionize after validation
