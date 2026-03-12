# Analytics Project Structure

> **AI Plugin Directive:** When structuring an analytics or business intelligence project (dashboards, reports, ad-hoc analysis), ALWAYS use this guide. Apply proper notebook organization, SQL model conventions, and dashboard-as-code patterns. This guide covers analytics engineering from SQL to visualization.

**Core Rule: Analytics projects MUST separate raw exploration from curated, tested, documented data models. Use dbt for SQL transformations, version-control dashboard definitions, and document every metric's business definition. NEVER let analysts query raw production tables directly.**

---

## 1. Analytics Project Structure (Complete)

```
analytics/
├── models/                                # dbt SQL models
│   ├── staging/                           # 1:1 source mappings (clean raw data)
│   │   ├── stripe/
│   │   │   ├── _stripe__sources.yml       # Source definitions
│   │   │   ├── _stripe__models.yml        # Model docs + tests
│   │   │   ├── stg_stripe__charges.sql
│   │   │   ├── stg_stripe__customers.sql
│   │   │   └── stg_stripe__refunds.sql
│   │   ├── shopify/
│   │   │   ├── _shopify__sources.yml
│   │   │   ├── _shopify__models.yml
│   │   │   ├── stg_shopify__orders.sql
│   │   │   └── stg_shopify__products.sql
│   │   ├── hubspot/
│   │   │   ├── _hubspot__sources.yml
│   │   │   ├── _hubspot__models.yml
│   │   │   ├── stg_hubspot__contacts.sql
│   │   │   └── stg_hubspot__deals.sql
│   │   └── internal/
│   │       ├── _internal__sources.yml
│   │       ├── _internal__models.yml
│   │       ├── stg_internal__users.sql
│   │       └── stg_internal__events.sql
│   │
│   ├── intermediate/                      # Business logic joins + transforms
│   │   ├── finance/
│   │   │   ├── _int_finance__models.yml
│   │   │   ├── int_charges_with_refunds.sql
│   │   │   └── int_subscription_periods.sql
│   │   ├── marketing/
│   │   │   ├── _int_marketing__models.yml
│   │   │   └── int_attribution_touchpoints.sql
│   │   └── product/
│   │       ├── _int_product__models.yml
│   │       └── int_user_sessions.sql
│   │
│   └── marts/                             # Final metrics + dimensions (star schema)
│       ├── core/                          # Shared dimensions and facts
│       │   ├── _core__models.yml
│       │   ├── dim_customers.sql          # Customer dimension
│       │   ├── dim_products.sql           # Product dimension
│       │   ├── dim_dates.sql              # Date dimension (calendar)
│       │   ├── fct_orders.sql             # Order facts
│       │   └── fct_events.sql             # Event facts
│       ├── finance/
│       │   ├── _finance__models.yml
│       │   ├── fct_revenue.sql            # Revenue fact table
│       │   ├── fct_mrr.sql                # Monthly recurring revenue
│       │   ├── fct_arr.sql                # Annual recurring revenue
│       │   ├── fct_refunds.sql            # Refund fact table
│       │   └── agg_revenue_daily.sql      # Daily revenue aggregate
│       ├── marketing/
│       │   ├── _marketing__models.yml
│       │   ├── fct_funnel.sql             # Conversion funnel
│       │   ├── fct_campaigns.sql          # Campaign performance
│       │   ├── fct_attribution.sql        # Attribution model
│       │   └── dim_channels.sql           # Marketing channels
│       ├── product/
│       │   ├── _product__models.yml
│       │   ├── fct_active_users.sql       # DAU/WAU/MAU
│       │   ├── fct_feature_adoption.sql   # Feature usage
│       │   └── fct_retention_cohorts.sql  # Retention cohorts
│       └── sales/
│           ├── _sales__models.yml
│           ├── fct_pipeline.sql           # Sales pipeline
│           ├── fct_deals.sql              # Deal facts
│           └── dim_sales_reps.sql         # Sales rep dimension
│
├── metrics/                               # Metric definitions (MetricFlow / Semantic Layer)
│   ├── revenue.yml                        # Revenue metrics
│   ├── churn_rate.yml                     # Churn metrics
│   ├── conversion_rate.yml                # Conversion metrics
│   ├── active_users.yml                   # Engagement metrics
│   └── _metric_groups.yml                 # Metric group config
│
├── dashboards/                            # Dashboard definitions (dashboard-as-code)
│   ├── executive/
│   │   ├── kpi_overview.yml               # KPI dashboard definition
│   │   └── screenshots/                   # Dashboard screenshots for PRs
│   │       └── kpi_overview.png
│   ├── finance/
│   │   ├── monthly_report.yml
│   │   └── revenue_dashboard.yml
│   ├── product/
│   │   ├── funnel_analysis.yml
│   │   └── retention_dashboard.yml
│   ├── marketing/
│   │   └── campaign_performance.yml
│   └── _dashboard_standards.md            # Dashboard style guide
│
├── analyses/                              # Ad-hoc analyses (versioned)
│   ├── 2024-Q1-churn-investigation/
│   │   ├── README.md                      # Question, methodology, findings
│   │   ├── analysis.sql
│   │   ├── analysis.ipynb
│   │   └── findings.md
│   └── 2024-03-pricing-impact/
│       ├── README.md
│       ├── analysis.sql
│       └── findings.md
│
├── notebooks/                             # Exploration notebooks (NOT production)
│   ├── exploration/
│   │   ├── churn_patterns.ipynb
│   │   └── revenue_forecast.ipynb
│   └── templates/
│       ├── analysis_template.ipynb
│       └── exploration_template.ipynb
│
├── streamlit_app/                         # Streamlit dashboards (optional)
│   ├── app.py                             # Main Streamlit app
│   ├── pages/
│   │   ├── 01_revenue.py
│   │   ├── 02_funnel.py
│   │   └── 03_retention.py
│   ├── components/
│   │   ├── charts.py
│   │   ├── filters.py
│   │   └── kpi_cards.py
│   ├── utils/
│   │   ├── data.py                        # Data loading functions
│   │   └── formatting.py
│   ├── .streamlit/
│   │   └── config.toml
│   └── requirements.txt
│
├── seeds/                                 # Reference data (CSV, versioned)
│   ├── country_mapping.csv
│   ├── product_categories.csv
│   ├── exchange_rates.csv
│   └── _seeds.yml                         # Seed documentation
│
├── snapshots/                             # SCD Type 2 snapshots
│   └── scd_customers.sql                  # Track customer changes over time
│
├── macros/                                # Reusable SQL macros
│   ├── generate_schema_name.sql           # Custom schema naming
│   ├── cents_to_dollars.sql               # Currency conversion
│   ├── date_spine.sql                     # Date spine generator
│   └── incremental_helpers.sql            # Incremental model helpers
│
├── tests/                                 # Custom data quality tests
│   ├── assert_revenue_positive.sql
│   ├── assert_no_future_orders.sql
│   ├── assert_mrr_consistency.sql
│   └── assert_no_duplicate_events.sql
│
├── docs/                                  # Data documentation
│   ├── data-dictionary.md                 # Column definitions
│   ├── metric-definitions.md              # Business metric definitions
│   ├── data-lineage.md                    # Source -> mart flow
│   ├── onboarding.md                      # New analyst guide
│   └── sql-style-guide.md                # SQL conventions
│
├── dbt_project.yml                        # dbt project config
├── profiles.yml                           # NOT committed (gitignored)
├── packages.yml                           # dbt package dependencies
├── .sqlfluff                              # SQL linting config
├── .gitignore
└── README.md
```

---

## 2. dbt Project Configuration

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
      +tags: ["staging", "daily"]
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
        +materialized: incremental
        +on_schema_change: append_new_columns
      marketing:
        +materialized: table
      product:
        +materialized: incremental

seeds:
  analytics:
    +schema: seeds
    country_mapping:
      +column_types:
        country_code: varchar(2)

snapshots:
  analytics:
    +schema: snapshots
    +strategy: timestamp
    +unique_key: id
    +updated_at: updated_at

vars:
  start_date: "2020-01-01"
  currency: "USD"
  timezone: "America/New_York"
```

```yaml
# packages.yml
packages:
  - package: dbt-labs/dbt_utils
    version: "1.3.0"
  - package: dbt-labs/codegen
    version: "0.12.0"
  - package: calogica/dbt_expectations
    version: "0.10.0"
  - package: dbt-labs/audit_helper
    version: "0.12.0"
  - package: dbt-labs/metrics
    version: "0.4.0"
```

---

## 3. dbt Model Examples

### 3.1 Staging Model

```sql
-- models/staging/stripe/stg_stripe__charges.sql
-- Staging model: 1:1 mapping from source, with cleaning

with source as (
    select * from {{ source('stripe', 'charges') }}
),

renamed as (
    select
        -- Primary key
        id as charge_id,

        -- Foreign keys
        customer_id,
        invoice_id,

        -- Attributes
        amount / 100.0 as amount_dollars,  -- Stripe stores in cents
        currency,
        status,
        description,
        failure_code,
        failure_message,

        -- Booleans
        paid as is_paid,
        refunded as is_refunded,
        captured as is_captured,

        -- Timestamps
        created as created_at,
        {{ dbt_utils.safe_cast('metadata__subscription_id', 'varchar') }} as subscription_id

    from source
    where _fivetran_deleted = false  -- Exclude soft deletes
)

select * from renamed
```

### 3.2 Intermediate Model

```sql
-- models/intermediate/finance/int_charges_with_refunds.sql
-- Intermediate: join charges with their refunds

with charges as (
    select * from {{ ref('stg_stripe__charges') }}
),

refunds as (
    select * from {{ ref('stg_stripe__refunds') }}
),

charges_with_refunds as (
    select
        c.charge_id,
        c.customer_id,
        c.amount_dollars as gross_amount,
        coalesce(sum(r.amount_dollars), 0) as refund_amount,
        c.amount_dollars - coalesce(sum(r.amount_dollars), 0) as net_amount,
        c.is_refunded,
        c.created_at,

        count(r.refund_id) as refund_count

    from charges as c
    left join refunds as r
        on c.charge_id = r.charge_id
    group by 1, 2, 3, 5, 6, 7
)

select * from charges_with_refunds
```

### 3.3 Mart Model (Star Schema)

```sql
-- models/marts/finance/fct_revenue.sql
-- Fact table: daily revenue by customer

{{
  config(
    materialized='incremental',
    unique_key='revenue_id',
    on_schema_change='append_new_columns',
    cluster_by=['order_date'],
    partition_by={
      "field": "order_date",
      "data_type": "date",
      "granularity": "month"
    }
  )
}}

with orders as (
    select * from {{ ref('fct_orders') }}
    {% if is_incremental() %}
    where order_date > (select max(order_date) from {{ this }})
    {% endif %}
),

charges as (
    select * from {{ ref('int_charges_with_refunds') }}
),

customers as (
    select * from {{ ref('dim_customers') }}
),

revenue as (
    select
        {{ dbt_utils.generate_surrogate_key(['o.order_id', 'o.order_date']) }} as revenue_id,
        o.order_id,
        o.order_date,
        o.customer_id,
        c.customer_segment,
        c.customer_region,
        ch.gross_amount,
        ch.refund_amount,
        ch.net_amount,
        o.discount_amount,
        ch.net_amount - coalesce(o.discount_amount, 0) as final_revenue,
        o.currency,
        current_timestamp() as loaded_at

    from orders as o
    inner join charges as ch
        on o.charge_id = ch.charge_id
    left join customers as c
        on o.customer_id = c.customer_id
)

select * from revenue
```

### 3.4 Model YAML (Tests + Docs)

```yaml
# models/marts/finance/_finance__models.yml
version: 2

models:
  - name: fct_revenue
    description: |
      Daily revenue fact table. Each row represents a revenue-generating
      transaction. Includes gross, refund, and net amounts. Used by
      finance dashboards and MRR calculations.

      **Owner:** @finance-team
      **SLA:** Updated daily by 6 AM EST
      **Grain:** One row per order per day
    config:
      tags: ["finance", "daily", "critical"]

    columns:
      - name: revenue_id
        description: Surrogate key (order_id + order_date)
        data_tests:
          - unique
          - not_null

      - name: order_id
        description: Foreign key to fct_orders
        data_tests:
          - not_null
          - relationships:
              to: ref('fct_orders')
              field: order_id

      - name: customer_id
        description: Foreign key to dim_customers
        data_tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: net_amount
        description: "Revenue after refunds (gross - refunds)"
        data_tests:
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: -10000  # Allow negative for edge cases
              max_value: 1000000

      - name: final_revenue
        description: "Final revenue after refunds and discounts"
        data_tests:
          - not_null

      - name: order_date
        description: Date of the order
        data_tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: "2020-01-01"
              max_value: "{{ modules.datetime.datetime.now().strftime('%Y-%m-%d') }}"

  - name: fct_mrr
    description: |
      Monthly recurring revenue by customer and month.
      Includes new, expansion, contraction, churn, and reactivation MRR.
    columns:
      - name: mrr_id
        data_tests:
          - unique
          - not_null
      - name: mrr_amount
        data_tests:
          - not_null
```

---

## 4. Metric Definitions (Semantic Layer)

```yaml
# metrics/revenue.yml (dbt Semantic Layer / MetricFlow)
semantic_models:
  - name: orders
    defaults:
      agg_time_dimension: order_date
    model: ref('fct_orders')
    entities:
      - name: order_id
        type: primary
      - name: customer_id
        type: foreign
    dimensions:
      - name: order_date
        type: time
        type_params:
          time_granularity: day
      - name: channel
        type: categorical
      - name: region
        type: categorical
    measures:
      - name: order_total
        agg: sum
        expr: order_amount_dollars
      - name: order_count
        agg: count

metrics:
  - name: revenue
    description: "Total revenue from completed orders (after refunds)"
    type: simple
    label: Revenue
    type_params:
      measure: order_total
    filter: |
      {{ Dimension('order__status') }} = 'completed'

  - name: average_order_value
    description: "Average value per order"
    type: derived
    label: AOV
    type_params:
      expr: revenue / order_count
      metrics:
        - name: revenue
        - name: order_count

  - name: monthly_recurring_revenue
    description: "MRR from active subscriptions"
    type: simple
    label: MRR
    type_params:
      measure: subscription_amount
    filter: |
      {{ Dimension('subscription__status') }} = 'active'
```

```
METRIC DEFINITION RULES:
  - EVERY business metric has a YAML definition
  - One source of truth -- dashboards reference metrics, not raw SQL
  - Include: name, description, calculation, owner, data source
  - Review metric definitions in PRs like code
  - Track metric changes in CHANGELOG
  - Metrics have SLAs (when they should be updated)
```

---

## 5. SQL Style Guide

```sql
-- SQL STYLE GUIDE (enforced with SQLFluff)

-- RULE 1: Lowercase keywords
select                    -- NOT: SELECT
from                      -- NOT: FROM
where                     -- NOT: WHERE

-- RULE 2: Leading commas
select
    order_id,
    customer_id,          -- Trailing comma (dbt allows)
    order_date

-- RULE 3: CTEs over subqueries
with orders as (
    select * from {{ ref('stg_shopify__orders') }}
),

customers as (
    select * from {{ ref('stg_internal__users') }}
)

select
    o.order_id,
    c.customer_name
from orders as o
left join customers as c
    on o.customer_id = c.customer_id

-- RULE 4: Explicit column selection (never SELECT *)
-- EXCEPTION: First CTE from ref() can use SELECT *

-- RULE 5: Table aliases
from orders as o           -- NOT: from orders o
left join customers as c   -- NOT: left join customers c

-- RULE 6: One join condition per line
left join customers as c
    on o.customer_id = c.customer_id
    and o.tenant_id = c.tenant_id

-- RULE 7: Use coalesce for NULLs, not IFNULL/NVL
coalesce(discount_amount, 0) as discount_amount

-- RULE 8: Use dbt_utils for common patterns
{{ dbt_utils.generate_surrogate_key(['order_id', 'line_item_id']) }}
{{ dbt_utils.pivot('status', ['active', 'churned', 'paused']) }}
{{ dbt_utils.star(from=ref('stg_orders'), except=['_fivetran_deleted']) }}

-- RULE 9: Comment business logic
-- Revenue = gross charges minus refunds and disputes
-- Excludes test transactions (identified by test_ prefix)
```

```ini
# .sqlfluff (SQLFluff config)
[sqlfluff]
dialect = bigquery
templater = dbt
max_line_length = 120
large_file_skip_byte_limit = 40000

[sqlfluff:indentation]
indent_unit = space
tab_space_size = 4

[sqlfluff:rules:capitalisation.keywords]
capitalisation_policy = lower

[sqlfluff:rules:capitalisation.identifiers]
capitalisation_policy = lower

[sqlfluff:rules:capitalisation.functions]
capitalisation_policy = lower

[sqlfluff:rules:aliasing.table]
aliasing = explicit

[sqlfluff:rules:aliasing.column]
aliasing = explicit

[sqlfluff:rules:aliasing.expression]
allow_scalar = false
```

---

## 6. Dashboard-as-Code

### 6.1 Streamlit App Structure

```python
# streamlit_app/app.py
import streamlit as st

st.set_page_config(
    page_title="Analytics Dashboard",
    page_icon="",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("Analytics Dashboard")
st.markdown("---")

# Sidebar navigation is handled by pages/ directory
# Streamlit automatically creates navigation from files in pages/
```

```python
# streamlit_app/pages/01_revenue.py
import streamlit as st
import plotly.express as px
from utils.data import load_revenue_data
from components.kpi_cards import render_kpi_row
from components.filters import date_range_filter, segment_filter

st.header("Revenue Dashboard")

# Filters
col1, col2 = st.columns(2)
with col1:
    date_range = date_range_filter()
with col2:
    segments = segment_filter()

# KPI row
df = load_revenue_data(date_range, segments)
render_kpi_row(df, metrics=["revenue", "orders", "aov", "mrr"])

# Charts
col1, col2 = st.columns(2)
with col1:
    fig = px.line(df, x="date", y="revenue", title="Daily Revenue")
    st.plotly_chart(fig, use_container_width=True)
with col2:
    fig = px.bar(df, x="segment", y="revenue", title="Revenue by Segment")
    st.plotly_chart(fig, use_container_width=True)
```

```python
# streamlit_app/components/kpi_cards.py
import streamlit as st
import pandas as pd

def render_kpi_row(df: pd.DataFrame, metrics: list[str]) -> None:
    """Render a row of KPI metric cards."""
    cols = st.columns(len(metrics))
    for col, metric in zip(cols, metrics):
        with col:
            current = df[metric].sum()
            previous = df[f"{metric}_prev"].sum() if f"{metric}_prev" in df.columns else None
            delta = ((current - previous) / previous * 100) if previous else None
            st.metric(
                label=metric.replace("_", " ").title(),
                value=f"${current:,.0f}" if "revenue" in metric else f"{current:,.0f}",
                delta=f"{delta:+.1f}%" if delta else None,
            )
```

### 6.2 Dash App Structure

```
dash_app/
├── app.py                     # Main Dash app
├── layouts/
│   ├── __init__.py
│   ├── revenue.py             # Revenue page layout
│   ├── funnel.py              # Funnel page layout
│   └── retention.py           # Retention page layout
├── callbacks/
│   ├── __init__.py
│   ├── revenue_callbacks.py   # Revenue page callbacks
│   ├── funnel_callbacks.py
│   └── shared_callbacks.py    # Cross-page callbacks
├── components/
│   ├── __init__.py
│   ├── kpi_card.py
│   ├── date_picker.py
│   └── segment_filter.py
├── data/
│   ├── __init__.py
│   └── queries.py             # SQL queries / data loading
├── assets/
│   └── styles.css
└── requirements.txt
```

### 6.3 Evidence.dev (Dashboard-as-Code)

```
evidence_app/
├── pages/
│   ├── index.md               # Home page (Markdown + SQL)
│   ├── revenue.md             # Revenue dashboard
│   └── funnel.md              # Funnel analysis
├── sources/
│   └── analytics/
│       └── connection.yaml    # Database connection
├── partials/
│   ├── _kpi_row.md            # Reusable KPI component
│   └── _date_filter.md
├── evidence.plugins.yaml
└── package.json
```

```markdown
<!-- evidence_app/pages/revenue.md -->
# Revenue Dashboard

```sql revenue_daily
select
    order_date,
    sum(net_amount) as revenue,
    count(distinct customer_id) as customers,
    count(*) as orders
from analytics.fct_revenue
where order_date >= '${inputs.start_date}'
group by 1
order by 1
```

<BigValue
    data={revenue_daily}
    value=revenue
    fmt=usd
    comparison=customers
    comparisonTitle="Customers"
/>

<LineChart
    data={revenue_daily}
    x=order_date
    y=revenue
    title="Daily Revenue Trend"
/>
```

---

## 7. Data Warehouse Schema Organization

### 7.1 Star Schema

```
STAR SCHEMA:

Central fact table surrounded by dimension tables.
Optimized for analytical queries.

                    dim_dates
                        |
                        |
    dim_products --- fct_orders --- dim_customers
                        |
                        |
                   dim_channels

FACT TABLE (fct_orders):
  order_id (PK)
  date_key (FK -> dim_dates)
  customer_key (FK -> dim_customers)
  product_key (FK -> dim_products)
  channel_key (FK -> dim_channels)
  quantity
  unit_price
  discount_amount
  total_amount
  tax_amount

DIMENSION TABLE (dim_customers):
  customer_key (PK, surrogate)
  customer_id (natural key)
  name
  email
  segment
  region
  created_at
  is_active

BEST FOR: Simple, fast queries, BI tools
TRADE-OFF: Some data redundancy in dimensions
```

### 7.2 Snowflake Schema

```
SNOWFLAKE SCHEMA:

Dimensions are normalized (split into sub-dimensions).
Less redundancy, more joins.

    dim_cities --- dim_regions --- dim_countries
                       |
                       |
    dim_products --- fct_orders --- dim_customers
                       |
                       |
                  dim_dates --- dim_fiscal_periods

BEST FOR: Minimizing storage, complex hierarchies
TRADE-OFF: More joins = slower queries
NOT RECOMMENDED for most analytics (star schema is better)
```

### 7.3 Wide Table (One Big Table / OBT)

```
WIDE TABLE / OBT:

Single denormalized table with all dimensions pre-joined.
No joins needed for queries.

obt_orders:
  order_id
  order_date
  customer_name, customer_email, customer_segment, customer_region
  product_name, product_category, product_sku
  channel_name, channel_type
  quantity, unit_price, total_amount, tax_amount
  is_first_order, days_since_last_order
  campaign_name, campaign_source

BEST FOR: Columnar warehouses (BigQuery, Snowflake), simple BI
TRADE-OFF: Large table, dimension updates require full rebuild
MODERN TREND: Increasingly popular with cheap columnar storage
```

### 7.4 Schema Recommendation by Use Case

```
DECISION:

Simple analytics, < 50 dimensions:
  --> Star schema (recommended default)

Complex hierarchies, strict normalization needs:
  --> Snowflake schema (rare in modern analytics)

Performance-critical BI, columnar warehouse:
  --> Wide tables / OBT (one big table)

Most modern data teams use:
  Star schema for core dimensions
  + Wide tables for specific high-traffic dashboards
```

---

## 8. Jupyter Notebook Organization

```
NOTEBOOK ORGANIZATION RULES:

1. Notebooks are for EXPLORATION, not production
   Production code goes in dbt models or Python modules.

2. Name with date and topic
   2024-03-15_churn_cohort_analysis.ipynb
   2024-Q1_revenue_forecast_exploration.ipynb

3. Structure every notebook:
   Cell 1: Markdown header (title, author, date, question)
   Cell 2: Imports
   Cell 3: Configuration / data loading
   Cells N: Analysis
   Last cell: Summary / key findings

4. Template for reproducibility:
   notebooks/templates/analysis_template.ipynb

5. NEVER commit outputs
   Use nbstripout to strip outputs before commit:
   $ pip install nbstripout
   $ nbstripout --install  # Adds git filter

6. For production analysis:
   --> Extract SQL to dbt models
   --> Extract Python to modules
   --> Keep notebook as documentation only
```

```
NOTEBOOK DIRECTORY STRUCTURE:

notebooks/
├── exploration/               # Free-form exploration
│   ├── 2024-03/
│   │   ├── churn_patterns.ipynb
│   │   └── feature_correlations.ipynb
│   └── 2024-04/
│       └── pricing_analysis.ipynb
│
├── reports/                   # Finalized analysis reports
│   ├── 2024-Q1-business-review.ipynb
│   └── 2024-Q2-churn-deep-dive.ipynb
│
├── templates/                 # Reusable templates
│   ├── exploration_template.ipynb
│   ├── ab_test_template.ipynb
│   ├── cohort_analysis_template.ipynb
│   └── data_quality_check_template.ipynb
│
└── shared/                    # Shared utility notebooks
    ├── common_queries.ipynb
    └── visualization_examples.ipynb
```

---

## 9. Looker / LookML Project Organization

```
looker/
├── models/
│   └── analytics.model.lkml       # Main model file
│
├── views/
│   ├── core/
│   │   ├── dim_customers.view.lkml
│   │   ├── dim_products.view.lkml
│   │   └── fct_orders.view.lkml
│   ├── finance/
│   │   ├── fct_revenue.view.lkml
│   │   └── fct_mrr.view.lkml
│   └── derived/
│       ├── customer_lifetime_value.view.lkml
│       └── revenue_by_cohort.view.lkml
│
├── explores/
│   ├── orders.explore.lkml
│   ├── revenue.explore.lkml
│   └── customers.explore.lkml
│
├── dashboards/
│   ├── executive_overview.dashboard.lookml
│   ├── finance_monthly.dashboard.lookml
│   └── product_engagement.dashboard.lookml
│
├── tests/
│   └── data_tests.lkml
│
└── manifest.lkml
```

```
LOOKER / METABASE ORGANIZATION PRINCIPLES:

1. Mirror dbt model structure in BI tool
   dbt marts -> Looker views / Metabase questions

2. One explore per business domain
   orders explore, customers explore, revenue explore

3. Dashboard hierarchy:
   L1: Executive (KPIs)
   L2: Department (detailed metrics)
   L3: Operational (real-time monitoring)
   L4: Self-service (ad-hoc exploration)

4. Naming conventions:
   Explores: snake_case (order_analysis)
   Dashboards: Title Case (Revenue Overview)
   Measures: snake_case with suffix (total_revenue, avg_order_value)
   Dimensions: snake_case (customer_segment, order_date)
```

---

## 10. Dashboard Hierarchy

```
DASHBOARD HIERARCHY:

Executive (L1):
  - KPI Overview: revenue, growth, churn, NPS
  - Updated: daily
  - Audience: C-suite
  - Refresh: automated, 6 AM

Departmental (L2):
  - Finance: MRR, ARR, cohort retention, cash flow
  - Product: funnel, feature adoption, engagement, NPS
  - Marketing: CAC, LTV, campaign ROI, attribution
  - Sales: pipeline, conversion rates, quota attainment
  - Updated: daily
  - Audience: Department heads

Operational (L3):
  - Support: queue depth, SLA adherence, CSAT
  - Infrastructure: uptime, error rates, latency
  - Updated: real-time or hourly
  - Audience: Team leads, on-call

Self-service (L4):
  - Explore tools for ad-hoc queries
  - Curated datasets in semantic layer
  - Saved questions / looks
  - Audience: Individual analysts

BUILD ORDER: ALWAYS L1 -> L2 -> L3 -> L4.
NEVER build L3/L4 dashboards without L1/L2 first.

DASHBOARD REVIEW PROCESS:
  1. Define metrics in YAML (semantic layer)
  2. Build dashboard referencing metrics
  3. Screenshot in PR for visual review
  4. QA against known data
  5. Deploy to production
  6. Set refresh schedule
  7. Add to dashboard catalog
```

---

## 11. Data Access Layers

```
                    +----------------+
                    |  Dashboards    |
                    |  & Reports     |
                    +--------+-------+
                             | Reads from
                    +--------v-------+
                    |    Marts       | <-- Analysts query HERE
                    |  (dbt)         |
                    +--------+-------+
                             | Transforms
                    +--------v-------+
                    |   Staging      | <-- 1:1 source mapping
                    |   (dbt)        |
                    +--------+-------+
                             | Reads from
                    +--------v-------+
                    |  Raw / Lake    | <-- Ingested by pipelines
                    |  (sources)     |
                    +----------------+

ACCESS RULES:
  Dashboards   --> Read marts ONLY
  Analysts     --> Read marts + intermediate (read-only)
  dbt          --> Read raw, write staging/intermediate/marts
  Data eng     --> Read/write all layers

WAREHOUSE SCHEMA LAYOUT:
  raw_stripe       -- Bronze: raw Stripe data
  raw_shopify      -- Bronze: raw Shopify data
  raw_internal     -- Bronze: internal app database
  staging          -- Silver: cleaned staging models
  intermediate     -- Silver: business logic transforms
  marts            -- Gold: final analytics models
  seeds            -- Reference data
  snapshots        -- SCD Type 2 history

ROLE-BASED ACCESS:
  analyst_role     --> SELECT on marts.*, intermediate.*
  engineer_role    --> ALL on all schemas
  bi_service_role  --> SELECT on marts.* only
  dbt_role         --> ALL on staging.*, intermediate.*, marts.*; SELECT on raw_*
```

---

## 12. Ad-Hoc Analysis Pattern

```
STRUCTURE AD-HOC ANALYSES AS TIMESTAMPED DIRECTORIES:

analyses/
├── 2024-Q1-churn-analysis/
│   ├── README.md          <-- Question, methodology, key findings
│   ├── analysis.sql       <-- Reproducible SQL queries
│   ├── analysis.ipynb     <-- Notebook with visualizations
│   ├── findings.md        <-- Business findings and recommendations
│   └── data/              <-- Exported results (gitignored if large)

README.md template:
  ## Question
  Why did churn increase 15% in Q1 2024?

  ## Data Sources
  - fct_subscriptions (marts.core)
  - dim_customers (marts.core)

  ## Methodology
  Cohort analysis comparing Q1 vs Q4 customers...

  ## Key Findings
  1. Finding one...
  2. Finding two...

  ## Recommendations
  - Action item one...

  ## Stakeholders
  @cfo, @vp-product

  ## Author
  @analyst-name, March 2024

  ## Status
  [x] Analysis complete
  [x] Reviewed by @data-lead
  [x] Presented to stakeholders
  [ ] Follow-up actions tracked in JIRA
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| Dashboards on raw tables | Slow queries, inconsistent metrics | Users don't trust data | Materialized marts layer with dbt |
| No metric definitions | "Revenue" means different things | Wrong decisions | Semantic layer or metric YAML |
| Throwaway analyses | Can't reproduce past findings | Wasted analyst time | Version in analyses/ with README |
| No data documentation | New analysts can't self-serve | Constant questions to data team | Data dictionary + onboarding guide |
| Copy-paste SQL across dashboards | Metric drift, inconsistency | Different dashboards show different numbers | Single metric definition in semantic layer |
| No testing | Bad data reaches dashboards | Wrong business decisions | dbt tests on every model |
| Everyone queries production DB | Performance impact, security risk | Slow app, data exposure | Read replicas + curated marts |
| Notebooks as deliverables | Fragile, non-reproducible, hidden state | Analysis can't be re-run | Extract SQL to dbt, document findings in markdown |
| No SQL style guide | Inconsistent SQL across models | Hard to review, hard to maintain | SQLFluff config + team conventions |
| Star schema in staging | Over-normalized raw data | Brittle to source changes | Staging = 1:1 source, marts = star schema |
| SELECT * in marts | Column changes break dashboards | Unexpected failures | Explicit column selection |
| No incremental models | Full table rebuilds every run | Slow builds, high warehouse cost | Incremental for large tables |
| Metrics defined in BI tool only | No version control, no review | Metric definitions change silently | Define in code (dbt metrics, LookML) |

---

## 14. Enforcement Checklist

- [ ] Marts layer -- all dashboards query marts, NOT raw tables
- [ ] Metric definitions -- YAML or semantic layer, single source of truth
- [ ] dbt project structure -- staging / intermediate / marts layers
- [ ] Staging models -- 1:1 source mapping, renaming, type casting only
- [ ] Model YAML -- every model documented with description, tests, column docs
- [ ] dbt tests -- unique, not_null, relationships, accepted_values on all marts
- [ ] SQL style guide -- enforced with SQLFluff in CI
- [ ] Ad-hoc analyses versioned -- timestamped directories with README
- [ ] Dashboard hierarchy -- L1 executive -> L4 self-service
- [ ] Data dictionary -- every column documented
- [ ] Access controls -- analysts read marts only, role-based access
- [ ] Seeds for reference data -- versioned, documented CSV files
- [ ] Snapshots for SCD -- track dimension changes over time
- [ ] Onboarding guide -- new analyst can self-serve within 1 day
- [ ] CHANGELOG for metrics -- track definition changes
- [ ] Notebook organization -- templates, date-prefixed, stripped outputs
- [ ] Dashboard-as-code -- Evidence.dev, Lightdash YAML, or Streamlit
- [ ] Schema naming convention -- raw_, staging, intermediate, marts
