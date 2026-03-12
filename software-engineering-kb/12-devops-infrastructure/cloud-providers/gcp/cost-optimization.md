# GCP: Cost Optimization

| Attribute     | Value                                                        |
|--------------|--------------------------------------------------------------|
| Domain       | DevOps > Cloud > GCP                                         |
| Importance   | High                                                         |
| Last Updated | 2026-03-10                                                   |
| Cross-ref    | [Core Services](core-services.md)                            |

---

## Core Concepts

### GCP Pricing Models

#### On-Demand Pricing

Default pricing with per-second billing (minimum 1-minute) for Compute Engine.
Cloud Run bills per request and per vCPU-second/GiB-second.

#### Sustained Use Discounts (SUDs)

Automatic discounts for VMs running more than 25% of a month. No commitment required.
Applies to Compute Engine N1, N2, N2D machine types. Discount reaches up to 30%
for full-month usage.

**Note:** SUDs do NOT apply to E2, C2, C3, M2, A2 machine types or Autopilot pods.

#### Committed Use Discounts (CUDs)

1-year or 3-year commitments for predictable workloads.

| Resource | 1-Year Discount | 3-Year Discount |
|----------|----------------|----------------|
| vCPU     | Up to 37%      | Up to 55%      |
| Memory   | Up to 37%      | Up to 55%      |
| GPU      | Up to 37%      | Up to 55%      |

```bash
# Purchase a committed use discount
gcloud compute commitments create my-commitment \
  --region=us-central1 \
  --plan=twelve-month \
  --resources=vcpu=100,memory=400GB

# List active commitments
gcloud compute commitments list --region=us-central1
```

**CUD strategies:**
- Analyze 3+ months of usage before committing
- Start with 1-year CUDs, move to 3-year for stable workloads
- Use spend-based CUDs for Cloud SQL and GKE Autopilot
- Combine CUDs with SUDs (CUDs apply first, SUDs cover the remainder)

#### Spot VMs (formerly Preemptible VMs)

Up to 60-91% discount. GCP can reclaim with 30-second notice.
Use for fault-tolerant batch processing, CI/CD, data analysis.

```hcl
# Terraform — Spot VM instance template
resource "google_compute_instance_template" "batch" {
  name_prefix  = "batch-spot-"
  machine_type = "n2-standard-8"

  scheduling {
    preemptible                 = true
    provisioning_model          = "SPOT"
    instance_termination_action = "STOP"
    automatic_restart           = false
  }

  disk {
    source_image = "debian-cloud/debian-12"
    auto_delete  = true
    boot         = true
  }

  network_interface {
    network    = google_compute_network.main.id
    subnetwork = google_compute_subnetwork.batch.id
  }
}
```

### Cloud Billing and Budgets

```hcl
# Terraform — Budget alerts with Pub/Sub notification
resource "google_billing_budget" "production" {
  billing_account = var.billing_account_id
  display_name    = "Production Monthly Budget"

  budget_filter {
    projects = ["projects/${var.project_number}"]
    labels = {
      environment = ["production"]
    }
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "5000"
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.2
    spend_basis       = "FORECASTED_SPEND"
  }

  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.budget_alerts.id
    schema_version                   = "1.0"
    monitoring_notification_channels = [
      google_monitoring_notification_channel.email.name
    ]
  }
}

# Cloud Function to act on budget alerts
resource "google_pubsub_topic" "budget_alerts" {
  name = "budget-alerts"
}
```

```typescript
// Cloud Function — Auto-respond to budget alerts
import { CloudEvent } from "@google-cloud/functions-framework";

interface BudgetAlert {
  budgetDisplayName: string;
  costAmount: number;
  budgetAmount: number;
  alertThresholdExceeded: number;
}

export const handleBudgetAlert = async (
  event: CloudEvent<{ message: { data: string } }>
) => {
  const data: BudgetAlert = JSON.parse(
    Buffer.from(event.data!.message.data, "base64").toString()
  );

  const percentUsed = (data.costAmount / data.budgetAmount) * 100;
  console.log(
    `Budget ${data.budgetDisplayName}: ${percentUsed.toFixed(1)}% used`
  );

  if (data.alertThresholdExceeded >= 1.0) {
    // Notify ops team for over-budget situations
    await notifyOpsTeam(data);
    // Optionally: scale down non-critical services
  }
};
```

### Cost Allocation with Labels

Apply labels consistently across all resources for billing breakdown.

```bash
# Required labels for all resources
gcloud compute instances update web-server-1 \
  --update-labels=environment=production,team=platform,\
service=web-api,cost-center=eng-123

# Enable billing export to BigQuery
# Console: Billing > Billing export > BigQuery export
```

```sql
-- BigQuery — Monthly cost by service and team
SELECT
  invoice.month AS billing_month,
  labels.value AS team,
  service.description AS service_name,
  SUM(cost) + SUM(IFNULL(credits.amount, 0)) AS net_cost
FROM
  `my-project.billing_export.gcp_billing_export_v1_*`
LEFT JOIN
  UNNEST(labels) AS labels ON labels.key = 'team'
LEFT JOIN
  UNNEST(credits) AS credits
WHERE
  invoice.month = '202603'
GROUP BY
  billing_month, team, service_name
ORDER BY
  net_cost DESC;
```

### Recommender API and Active Assist

Google Cloud Recommender provides machine learning-based suggestions for
right-sizing, idle resources, and commitment purchases.

```bash
# List VM right-sizing recommendations
gcloud recommender recommendations list \
  --project=my-project \
  --location=us-central1-a \
  --recommender=google.compute.instance.MachineTypeRecommender \
  --format="table(name, primaryImpact.costProjection.cost.units, \
    content.overview.recommendedMachineType.name)"

# List idle resource recommendations
gcloud recommender recommendations list \
  --project=my-project \
  --location=us-central1-a \
  --recommender=google.compute.instance.IdleResourceRecommender

# Apply a recommendation
gcloud recommender recommendations mark-claimed RECOMMENDATION_ID \
  --project=my-project \
  --location=us-central1-a \
  --recommender=google.compute.instance.MachineTypeRecommender \
  --etag=ETAG
```

### BigQuery Cost Optimization

BigQuery offers two pricing models:

| Model | Pricing | Best For |
|-------|---------|----------|
| On-demand | $6.25/TB scanned | Ad-hoc queries, variable workloads |
| Editions (Standard/Enterprise/Enterprise Plus) | Slot-based ($0.04-$0.06/slot-hour) | Predictable, high-volume analytics |

```sql
-- Estimate query cost before running (dry run)
-- In bq CLI: bq query --dry_run 'SELECT ...'
-- This returns bytes processed without executing

-- Reduce scan with partitioning and clustering
CREATE TABLE my_dataset.events
PARTITION BY DATE(timestamp)
CLUSTER BY user_id, event_type
AS SELECT * FROM my_dataset.raw_events;

-- Use columnar filtering to reduce scan
SELECT user_id, event_type, COUNT(*) AS cnt
FROM my_dataset.events
WHERE DATE(timestamp) BETWEEN '2026-03-01' AND '2026-03-10'
  AND event_type = 'purchase'
GROUP BY user_id, event_type;
-- Scans only relevant partition + cluster = minimal bytes
```

**BigQuery cost reduction tactics:**
- Partition tables by date/timestamp (reduces scan by 10-100x)
- Cluster tables by high-cardinality filter columns
- Use `--dry_run` to estimate cost before executing expensive queries
- Set per-user and per-project query quotas (maximum bytes billed)
- Avoid `SELECT *`; specify only needed columns
- Use materialized views for repeated aggregation queries
- Schedule queries during off-peak hours with BigQuery scheduled queries

### Cloud Run Cost Optimization

```hcl
# Terraform — Cost-optimized Cloud Run configuration
resource "google_cloud_run_v2_service" "api" {
  name     = "api"
  location = "us-central1"

  template {
    scaling {
      min_instance_count = 0   # Scale to zero for dev/staging
      max_instance_count = 20
    }

    containers {
      image = var.api_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true   # Throttle CPU when idle (~75% savings)
        startup_cpu_boost = true   # Temporary CPU boost on cold start
      }
    }

    max_instance_request_concurrency = 80  # More requests per instance
    timeout = "30s"
  }
}
```

**Cloud Run cost levers:**
- `cpu_idle = true`: Reduces CPU cost by ~75% when not processing requests
- `startup_cpu_boost`: Avoids paying for always-on CPU while reducing cold starts
- `min_instance_count = 0`: Scale to zero for non-production environments
- Higher concurrency (80-250): Handle more requests per instance
- Use 2nd gen execution environment for lower cold start latency

### Database Cost Comparison

| Database | Use Case | Min Monthly Cost | Scaling Model |
|----------|----------|-----------------|---------------|
| Cloud SQL (PostgreSQL) | General RDBMS | ~$50 (db-f1-micro) | Vertical + read replicas |
| AlloyDB | High-perf PostgreSQL | ~$400 (2 vCPU) | Vertical + read pools |
| Cloud Spanner | Global relational | ~$650 (100 PU) | Horizontal (processing units) |
| Firestore | Document NoSQL | Free tier generous | Automatic, pay per op |
| Bigtable | Wide-column NoSQL | ~$480 (1 node) | Horizontal (nodes) |
| Memorystore Redis | Caching | ~$35 (M1, 1GB) | Vertical (instance size) |

**Database cost guidance:**
- Start with Cloud SQL for most relational workloads
- Move to AlloyDB only when Cloud SQL performance becomes insufficient
- Use Spanner only when global strong consistency is required
- Firestore is cheapest for low-to-moderate document workloads
- Bigtable is cost-effective only at scale (>1TB, >10K QPS)

### Network Egress Costs

Network egress is a hidden cost driver on GCP.

| Traffic Path | Cost |
|-------------|------|
| Within same zone | Free |
| Between zones (same region) | $0.01/GB |
| Between regions (same continent) | $0.01/GB |
| Between continents | $0.02-$0.08/GB |
| Internet egress (first 1TB) | $0.12/GB |
| Internet egress (1-10TB) | $0.11/GB |
| Internet egress (>10TB) | $0.08/GB |
| Cloud CDN egress | $0.02-$0.08/GB |

**Egress cost reduction:**
- Use Cloud CDN to cache static content at the edge
- Keep services communicating within the same region/zone
- Use Private Google Access to avoid internet egress to Google APIs
- Consider Premium vs Standard network tier (Standard is cheaper)

### GKE Cost Optimization

```hcl
# Terraform — GKE Standard cluster with Spot node pools
resource "google_container_node_pool" "spot" {
  name     = "spot-pool"
  cluster  = google_container_cluster.main.name
  location = "us-central1"

  autoscaling {
    min_node_count = 0
    max_node_count = 20
  }

  node_config {
    preemptible  = true
    machine_type = "n2-standard-4"
    spot         = true

    labels = {
      "workload-type" = "batch"
    }

    taint {
      key    = "spot"
      value  = "true"
      effect = "NO_SCHEDULE"
    }
  }
}
```

**GKE cost tactics:**
- **Autopilot vs Standard**: Autopilot charges per pod; Standard per node.
  Autopilot is cheaper when utilization is inconsistent
- **Spot node pools**: Use for fault-tolerant workloads (batch, CI/CD)
- **Cluster autoscaler**: Scale nodes to match pod demand
- **Vertical Pod Autoscaler**: Right-size pod resource requests
- **GKE cost allocation**: Enable per-namespace cost tracking

### Free Tier Utilization

GCP provides an Always Free tier (not time-limited):

| Service | Free Tier Allowance |
|---------|-------------------|
| Compute Engine | 1 e2-micro instance (select US regions) |
| Cloud Storage | 5 GB Standard storage |
| BigQuery | 10 GB storage, 1 TB queries/month |
| Cloud Functions | 2M invocations/month |
| Cloud Run | 2M requests/month, 360K GiB-seconds |
| Firestore | 1 GiB storage, 50K reads/day, 20K writes/day |
| Pub/Sub | 10 GB/month |
| Cloud Build | 120 build-minutes/day |
| Artifact Registry | 0.5 GB storage |
| Secret Manager | 6 active secret versions |

Use free tier strategically for development, prototyping, and small-scale services.

### Automated Cost Monitoring

```typescript
// Cloud Function — Weekly cost report via Slack
import { BigQuery } from "@google-cloud/bigquery";

const bigquery = new BigQuery();

interface CostRow {
  service: string;
  cost: number;
  previous_cost: number;
}

export async function generateWeeklyCostReport(): Promise<string> {
  const [rows] = await bigquery.query({
    query: `
      WITH current_week AS (
        SELECT
          service.description AS service,
          SUM(cost) + SUM(IFNULL(
            (SELECT SUM(c.amount) FROM UNNEST(credits) c), 0
          )) AS cost
        FROM \`billing_export.gcp_billing_export_v1_*\`
        WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        GROUP BY service
      ),
      previous_week AS (
        SELECT
          service.description AS service,
          SUM(cost) + SUM(IFNULL(
            (SELECT SUM(c.amount) FROM UNNEST(credits) c), 0
          )) AS cost
        FROM \`billing_export.gcp_billing_export_v1_*\`
        WHERE DATE(usage_start_time)
          BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
          AND DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        GROUP BY service
      )
      SELECT
        c.service,
        c.cost,
        IFNULL(p.cost, 0) AS previous_cost
      FROM current_week c
      LEFT JOIN previous_week p USING (service)
      ORDER BY c.cost DESC
      LIMIT 10
    `,
  });

  const typedRows = rows as CostRow[];
  return typedRows
    .map((row) => {
      const change = row.previous_cost > 0
        ? ((row.cost - row.previous_cost) / row.previous_cost * 100).toFixed(1)
        : "NEW";
      return `${row.service}: $${row.cost.toFixed(2)} (${change}% WoW)`;
    })
    .join("\n");
}
```

### Non-Production Resource Scheduling

```hcl
# Terraform — Cloud Scheduler to stop dev VMs on evenings/weekends
resource "google_cloud_scheduler_job" "stop_dev_vms" {
  name        = "stop-dev-vms"
  description = "Stop development VMs at 7 PM on weekdays"
  schedule    = "0 19 * * 1-5"
  time_zone   = "America/New_York"

  pubsub_target {
    topic_name = google_pubsub_topic.vm_scheduler.id
    data       = base64encode(jsonencode({
      action = "stop"
      filter = "labels.environment=development"
      zone   = "us-central1-a"
    }))
  }
}

resource "google_cloud_scheduler_job" "start_dev_vms" {
  name        = "start-dev-vms"
  description = "Start development VMs at 8 AM on weekdays"
  schedule    = "0 8 * * 1-5"
  time_zone   = "America/New_York"

  pubsub_target {
    topic_name = google_pubsub_topic.vm_scheduler.id
    data       = base64encode(jsonencode({
      action = "start"
      filter = "labels.environment=development"
      zone   = "us-central1-a"
    }))
  }
}
```

### Cloud Storage Cost Optimization

```bash
# Analyze bucket storage class distribution
gsutil du -s -c gs://my-bucket/

# Move infrequently accessed data to Nearline
gsutil -m rewrite -s nearline gs://my-bucket/archive/**

# Enable Object Lifecycle Management via CLI
gsutil lifecycle set lifecycle-config.json gs://my-bucket/

# Set up Storage Transfer Service for cross-bucket optimization
gcloud transfer jobs create \
  gs://source-bucket gs://optimized-bucket \
  --include-prefixes=logs/ \
  --schedule-starts=2026-03-10T00:00:00Z \
  --schedule-repeats-every=P1D
```

**Storage cost tactics:**
- Enable Autoclass on buckets with unpredictable access patterns
- Use Object Lifecycle Management to auto-transition storage classes
- Compress objects before upload (gzip for text, Brotli for web assets)
- Delete old object versions if versioning is not required for compliance
- Use Requester Pays for shared public datasets

### Cost Optimization Dashboard (BigQuery SQL)

```sql
-- Daily cost trend with 7-day moving average
SELECT
  DATE(usage_start_time) AS date,
  SUM(cost) AS daily_cost,
  AVG(SUM(cost)) OVER (
    ORDER BY DATE(usage_start_time)
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS moving_avg_7d
FROM `billing_export.gcp_billing_export_v1_*`
WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY date
ORDER BY date;

-- Top cost anomalies (services with >20% WoW increase)
WITH weekly AS (
  SELECT
    service.description AS service,
    DATE_TRUNC(DATE(usage_start_time), WEEK) AS week,
    SUM(cost) AS cost
  FROM `billing_export.gcp_billing_export_v1_*`
  WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
  GROUP BY service, week
)
SELECT
  curr.service,
  curr.cost AS current_cost,
  prev.cost AS previous_cost,
  ROUND((curr.cost - prev.cost) / prev.cost * 100, 1) AS pct_change
FROM weekly curr
JOIN weekly prev ON curr.service = prev.service AND curr.week > prev.week
WHERE prev.cost > 10
  AND (curr.cost - prev.cost) / prev.cost > 0.2
ORDER BY pct_change DESC;
```

---

## 10 Best Practices

1. **Enable billing export to BigQuery from day one.** Historical billing data cannot
   be backfilled; start exporting before you need cost analysis.
2. **Set budget alerts at 50%, 80%, and 100% of monthly target.** Include a 120%
   forecasted spend alert for early warning.
3. **Apply labels to every resource at creation time.** Enforce via organization policy
   or Terraform validation rules. Minimum: environment, team, service, cost-center.
4. **Review Recommender suggestions weekly.** Automate right-sizing recommendations
   for non-production environments; require approval for production changes.
5. **Use CUDs for stable workloads after 3 months of baseline data.** Start with 1-year
   commitments; graduate to 3-year for workloads unchanged for 12+ months.
6. **Configure Cloud Run with cpu_idle=true for all services.** This single setting
   reduces CPU cost by approximately 75% for request-based workloads.
7. **Partition and cluster all BigQuery tables.** Unpartitioned tables scan full datasets
   on every query, causing runaway costs at scale.
8. **Use Spot VMs for all fault-tolerant batch workloads.** Savings of 60-91% with
   minimal code changes using managed instance groups with Spot.
9. **Minimize cross-region data transfer.** Co-locate dependent services in the same
   region and use Cloud CDN for internet-facing static content.
10. **Schedule non-production resource shutdown.** Use Cloud Scheduler + Cloud Functions
    to stop dev/staging VMs and scale down GKE during off-hours.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| No billing export enabled | Cannot analyze historical cost trends | Enable BigQuery billing export immediately |
| Committed use discounts before baseline | Over-commitment, paying for unused capacity | Analyze 3+ months of usage data first |
| SELECT * on BigQuery tables | Full table scan per query, 10-100x overcost | Select specific columns, use partitions |
| Cloud Run with min-instances for all envs | Paying for idle capacity in dev/staging | Set min-instances=0 for non-production |
| Default machine types without right-sizing | 40-60% average waste on VM resources | Use Recommender API, right-size quarterly |
| No labels on resources | Cannot attribute costs to teams/services | Enforce labels via organization policy |
| Ignoring network egress costs | Surprise bills from cross-region traffic | Co-locate services, use CDN, monitor egress |
| Bigtable/Spanner for small-scale workloads | Minimum cost too high for actual usage | Use Cloud SQL or Firestore until scale justifies |

---

## Enforcement Checklist

- [ ] Billing export to BigQuery enabled and dashboards created
- [ ] Budget alerts configured at 50%, 80%, 100%, and 120% forecast
- [ ] Label policy enforced via organization constraints or Terraform
- [ ] CUD portfolio reviewed quarterly against actual usage
- [ ] Recommender API suggestions reviewed weekly (automated for non-prod)
- [ ] Cloud Run services use cpu_idle=true and appropriate min-instances
- [ ] BigQuery tables partitioned and clustered; per-user query quotas set
- [ ] Spot VMs used for all fault-tolerant batch/CI workloads
- [ ] Non-production resources scheduled for off-hours shutdown
- [ ] Network egress costs monitored with alerts for anomalies
- [ ] Monthly cost review meeting with engineering and finance stakeholders
- [ ] Free tier services used for development and prototyping
