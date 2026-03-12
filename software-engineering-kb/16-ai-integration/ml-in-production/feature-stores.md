# Feature Stores & Feature Engineering

| Attribute | Value |
|-----------|-------|
| Domain | AI Integration > ML in Production |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [MLOps](mlops.md) |

---

## Feature Engineering Fundamentals

### From Raw Data to Features

Feature engineering transforms raw data into numerical representations that models can learn from. It is the single highest-leverage activity in most ML projects.

```
Raw Data Sources          Feature Engineering          Model-Ready Features
─────────────────         ───────────────────         ────────────────────
User table          -->   age_bucket, days_since       Numerical vectors
Transaction logs    -->   txn_count_7d, avg_amount     Aggregated statistics
Product catalog     -->   category_encoding            One-hot / embeddings
Text reviews        -->   sentiment_score, embedding   Dense vectors
Timestamps          -->   hour_of_day, is_weekend      Cyclical encodings
```

### Feature Types

| Type | Example | Engineering Technique |
|------|---------|----------------------|
| Numerical | Age, amount, count | Normalization, binning, log transform |
| Categorical | Country, product type | One-hot, target encoding, embeddings |
| Temporal | Timestamps, durations | Cyclical encoding, time-since features |
| Text | Reviews, descriptions | TF-IDF, embeddings (BERT, sentence-transformers) |
| Embedding | User/item vectors | Pre-trained or learned embeddings |
| Aggregated | Rolling averages, counts | Window functions over time periods |

```python
# Common feature engineering patterns
import pandas as pd
import numpy as np

def engineer_user_features(users_df: pd.DataFrame, txns_df: pd.DataFrame) -> pd.DataFrame:
    """Create user-level features from transaction history."""
    now = pd.Timestamp.now()

    # Recency features
    last_txn = txns_df.groupby("user_id")["timestamp"].max()
    users_df["days_since_last_txn"] = (now - last_txn).dt.days

    # Frequency features (multiple windows)
    for days in [7, 30, 90]:
        cutoff = now - pd.Timedelta(days=days)
        recent = txns_df[txns_df["timestamp"] > cutoff]
        users_df[f"txn_count_{days}d"] = recent.groupby("user_id").size()

    # Monetary features
    users_df["avg_txn_amount"] = txns_df.groupby("user_id")["amount"].mean()
    users_df["std_txn_amount"] = txns_df.groupby("user_id")["amount"].std()

    # Ratio features
    users_df["txn_velocity_trend"] = (
        users_df["txn_count_7d"] / users_df["txn_count_30d"].clip(1)
    )
    return users_df
```

---

## Feature Store Architecture

### Core Components

```
                    Feature Definitions (Registry)
                              |
           ┌──────────────────┼──────────────────┐
           v                  v                   v
    Feature Pipelines    Offline Store        Online Store
    (Batch / Stream)     (Data Lake)          (Redis/DynamoDB)
           |                  |                   |
           v                  v                   v
    Compute features    Training data         Serving data
    on schedule         (point-in-time)       (low-latency)
```

| Component | Purpose | Technology |
|-----------|---------|------------|
| Feature Registry | Define, discover, and document features | Metadata catalog |
| Offline Store | Store historical feature values for training | S3/GCS + Parquet, BigQuery, Redshift |
| Online Store | Serve latest feature values at low latency | Redis, DynamoDB, Bigtable |
| Feature Pipelines | Compute and materialize feature values | Spark, Flink, dbt, SQL |
| Feature Server | HTTP/gRPC API for real-time feature retrieval | Built into Feast, Tecton |

### Why a Feature Store?

| Problem Without Feature Store | Solution |
|-------------------------------|----------|
| Training-serving skew | Same feature definitions used for both |
| Duplicated feature logic | Shared feature definitions across teams |
| Point-in-time correctness bugs | Automated timestamp-aware joins |
| Slow feature discovery | Searchable feature catalog |
| Inconsistent transformations | Single source of truth per feature |

---

## Feature Store Platforms

| Platform | Type | Online Store | Offline Store | Key Strength |
|----------|------|-------------|---------------|-------------|
| Feast | Open-source | Redis, DynamoDB | S3/GCS + Parquet | Flexible, cloud-agnostic |
| Tecton | Commercial | DynamoDB | Spark/Snowflake | Real-time features, enterprise scale |
| Hopsworks | Open-source + SaaS | RonDB | Hive/S3 | Feature pipelines included |
| SageMaker FS | AWS managed | In-memory | S3 | AWS ecosystem integration |
| Vertex AI FS | GCP managed | Bigtable | BigQuery | GCP ecosystem integration |
| Databricks FS | Databricks-native | Online tables | Delta Lake | Unity Catalog integration |

---

## Key Concepts

### Point-in-Time Correctness

The most critical concept in feature stores. When creating training data, use only feature values that were available at prediction time -- never leak future data.

```python
# WRONG: Feature leakage -- uses latest feature values for historical events
train_df = events_df.merge(features_df, on="user_id")

# CORRECT: Point-in-time join -- uses feature values as of event timestamp
def point_in_time_join(
    events: pd.DataFrame,      # columns: entity_id, event_timestamp, label
    features: pd.DataFrame,    # columns: entity_id, feature_timestamp, feature_values...
) -> pd.DataFrame:
    """Join features using only values available at event time."""
    merged = pd.merge_asof(
        events.sort_values("event_timestamp"),
        features.sort_values("feature_timestamp"),
        left_on="event_timestamp",
        right_on="feature_timestamp",
        by="entity_id",
        direction="backward",   # Only use features from BEFORE the event
    )
    return merged
```

### Feature Freshness

Define how recent the online feature values need to be.

| Freshness Requirement | Computation | Example |
|----------------------|-------------|---------|
| Real-time (< 1s) | Streaming (Flink/Kafka) | Current session features |
| Near-real-time (< 1h) | Micro-batch | Transaction count last hour |
| Daily | Batch (Spark, dbt) | 30-day rolling averages |
| Static | One-time computation | User demographics, embeddings |

### Entity-Centric Design

Organize features around business entities (users, products, transactions) rather than data sources. Each entity has a primary key used for feature retrieval.

---

## Online/Offline Consistency

### Training-Serving Skew

The most common ML production bug. Training features are computed differently from serving features, causing silent accuracy loss.

```
Training Pipeline                  Serving Pipeline
─────────────────                  ────────────────
SQL query in notebook    !=        Python function in API
Python 3.10 pandas       !=        Python 3.12 pandas (different defaults)
"amount > 0" filter      !=        No filter applied
UTC timezone             !=        Local timezone
```

**Solution:** Define features once, use the same definitions for both training and serving.

```python
# Feature definition used for BOTH training and serving
from feast import Entity, FeatureView, Field
from feast.types import Float32, Int64
from feast.infra.offline_stores.contrib.spark_offline_store.spark_source import SparkSource

user = Entity(name="user", join_keys=["user_id"])

user_features = FeatureView(
    name="user_transaction_features",
    entities=[user],
    schema=[
        Field(name="txn_count_7d", dtype=Int64),
        Field(name="avg_amount_30d", dtype=Float32),
        Field(name="days_since_last_txn", dtype=Int64),
    ],
    source=SparkSource(
        table="user_features_table",
        timestamp_field="feature_timestamp",
    ),
    online=True,   # Materialize to online store
    ttl=timedelta(days=1),
)
```

---

## Feature Pipelines

### Batch Features (Daily/Hourly)

```python
# dbt + Feast batch pipeline
# dbt model: models/features/user_transaction_features.sql
"""
SELECT
    user_id,
    COUNT(*) FILTER (WHERE ts > CURRENT_DATE - INTERVAL '7 days') AS txn_count_7d,
    AVG(amount) FILTER (WHERE ts > CURRENT_DATE - INTERVAL '30 days') AS avg_amount_30d,
    EXTRACT(DAY FROM CURRENT_DATE - MAX(ts)) AS days_since_last_txn,
    CURRENT_TIMESTAMP AS feature_timestamp
FROM transactions
GROUP BY user_id
"""
```

### Streaming Features (Real-Time)

Use Kafka/Flink consumers to compute features in real-time (e.g., tumbling window aggregations) and push to the online store. Reserve for features requiring sub-minute freshness.

### On-Demand Features

Computed at request time from the raw input. Not stored in any store.

```python
# On-demand feature transformation in Feast
from feast import on_demand_feature_view, Field
from feast.types import Float32

@on_demand_feature_view(
    sources=[user_features],
    schema=[Field(name="amount_zscore", dtype=Float32)],
)
def user_amount_zscore(inputs: pd.DataFrame) -> pd.DataFrame:
    df = pd.DataFrame()
    df["amount_zscore"] = (
        (inputs["current_amount"] - inputs["avg_amount_30d"])
        / inputs["std_amount_30d"].clip(0.01)
    )
    return df
```

---

## Feature Discovery and Reuse

### Feature Catalog

A searchable registry of all available features with metadata.

| Metadata Field | Purpose |
|---------------|---------|
| Name & description | What the feature represents |
| Owner / team | Who maintains it |
| Entity | Which business object it belongs to |
| Freshness | How often it is updated |
| Data source | Where raw data comes from |
| Lineage | Upstream dependencies |
| Usage stats | Which models consume it |
| Data quality | Null rate, value distribution |

### Promoting Feature Reuse

- Publish a feature catalog accessible to all data scientists
- Track feature usage across models to identify high-value features
- Review new feature requests against existing catalog before creating duplicates
- Enforce naming conventions: `{entity}_{metric}_{window}` (e.g., `user_txn_count_7d`)

---

## Implementation: Feast Setup

```python
# feature_store.yaml -- Feast project configuration
"""
project: fraud_detection
registry: s3://feast-registry/registry.db
provider: aws
online_store:
  type: redis
  connection_string: redis://feast-redis:6379
offline_store:
  type: spark
  spark_conf:
    spark.master: "local[*]"
entity_key_serialization_version: 2
"""

# Apply feature definitions
# $ feast apply

# Materialize features to online store
# $ feast materialize 2026-01-01T00:00:00 2026-03-10T00:00:00

# Retrieve training data (offline)
from feast import FeatureStore

store = FeatureStore(repo_path=".")

training_df = store.get_historical_features(
    entity_df=events_df,       # Must have entity keys + event_timestamp
    features=[
        "user_transaction_features:txn_count_7d",
        "user_transaction_features:avg_amount_30d",
        "user_transaction_features:days_since_last_txn",
    ],
).to_df()

# Retrieve serving data (online -- low latency)
online_features = store.get_online_features(
    features=[
        "user_transaction_features:txn_count_7d",
        "user_transaction_features:avg_amount_30d",
    ],
    entity_rows=[{"user_id": "user_12345"}],
).to_dict()
```

---

## When NOT to Use a Feature Store

| Situation | Why Not | Alternative |
|-----------|---------|-------------|
| Small team (< 3 ML engineers) | Overhead exceeds benefit | Shared SQL views + config |
| Few features (< 20) | Simple enough to manage in code | Feature functions in codebase |
| Batch-only models | No online serving need | dbt + data warehouse |
| Prototyping / exploration | Slows down experimentation | Notebooks with inline features |
| No training-serving skew risk | Model input = raw data directly | Direct database queries |

**Start with a feature store when:**
- Multiple teams reuse the same features
- Training-serving skew is causing production bugs
- Feature computation is expensive and should be shared
- You need point-in-time correctness guarantees

---

## 10 Best Practices

1. **Define features once, use everywhere.** The same feature definition must produce identical values for training and serving. This is the core value proposition.
2. **Enforce point-in-time correctness.** Never allow future data leakage in training datasets. Use timestamp-aware joins exclusively.
3. **Name features with a consistent convention.** Use `{entity}_{metric}_{window}` format: `user_txn_count_7d`, `product_avg_rating_90d`.
4. **Set TTL on online features.** Stale features are worse than missing features. Define time-to-live based on business logic.
5. **Monitor feature freshness.** Alert when materialization pipelines are late. Stale online features cause silent accuracy degradation.
6. **Start with batch features, add streaming only when needed.** Streaming adds operational complexity. Most features do not need sub-minute freshness.
7. **Document every feature with owner, description, and lineage.** Feature catalogs only work when metadata is maintained.
8. **Version feature definitions.** Breaking changes to feature computation require model retraining. Track schema changes explicitly.
9. **Test feature pipelines like production code.** Unit test transformations, integration test materialization, validate output distributions.
10. **Track feature importance across models.** Identify which features drive the most value. Retire unused features to reduce operational cost.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Copy-paste feature logic between training and serving | Training-serving skew, silent accuracy loss | Use feature store or shared feature library |
| No point-in-time awareness | Data leakage inflates training metrics | Use timestamp-aware joins (merge_asof) |
| Feature store for 5 features | Operational overhead without benefit | Use simple feature functions until complexity grows |
| All features in real-time | Unnecessary infrastructure cost | Classify features by required freshness |
| No feature monitoring | Stale or broken features go unnoticed | Monitor freshness, null rates, and distributions |
| God feature view | Single view with 200+ features is unmanageable | Group features by entity and domain |
| Ignoring feature lineage | Cannot trace data quality issues to root cause | Track upstream data source dependencies |
| No TTL on online store | Serving stale features indefinitely | Set TTL based on feature freshness requirements |

---

## Enforcement Checklist

- [ ] Feature definitions are shared between training and serving pipelines
- [ ] Point-in-time correctness is enforced for all training data generation
- [ ] Feature naming follows a consistent convention across teams
- [ ] Online store features have TTL configured
- [ ] Feature freshness is monitored with alerts for late materialization
- [ ] Feature catalog is maintained with descriptions, owners, and lineage
- [ ] Feature pipelines have automated tests (unit + integration)
- [ ] Unused features are periodically identified and retired
- [ ] Streaming features are justified by latency requirements
- [ ] Feature schema changes trigger model retraining evaluation
