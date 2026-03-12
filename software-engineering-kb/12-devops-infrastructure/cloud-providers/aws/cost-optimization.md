# AWS Cost Optimization

| Attribute    | Value                                                                              |
|--------------|------------------------------------------------------------------------------------|
| Domain       | DevOps > Cloud > AWS                                                               |
| Importance   | High                                                                               |
| Last Updated | 2026-03-10                                                                         |
| Cross-ref    | [Core Services](core-services.md), [Architecture Patterns](architecture-patterns.md)|

> **Scope note:** 10-scalability/capacity-planning/cost-optimization.md covers general FinOps
> principles. This file focuses specifically on AWS billing mechanics, pricing tools, and
> service-level cost optimization techniques.

---

## Core Concepts

### AWS Pricing Models

#### Compute Pricing Overview

| Model             | Discount | Commitment | Flexibility               | Best For                           |
|-------------------|----------|------------|---------------------------|------------------------------------|
| **On-Demand**     | 0%       | None       | Full                      | Short-term, spiky, unpredictable   |
| **Savings Plans** | Up to 72%| 1 or 3 year| Instance family/region     | Steady baseline across services    |
| **Reserved Instances** | Up to 72% | 1 or 3 year | Specific instance type | Known, fixed workloads          |
| **Spot**          | Up to 90%| None       | Can be interrupted (2-min)| Fault-tolerant, batch, CI/CD       |

**Savings Plans vs Reserved Instances:**

| Feature               | Savings Plans                  | Reserved Instances              |
|-----------------------|--------------------------------|---------------------------------|
| Scope                 | Compute, EC2, SageMaker        | EC2 only (or RDS/ElastiCache)   |
| Flexibility           | Any instance family in region  | Locked to instance type         |
| Applies to Fargate    | Yes (Compute SP)               | No                              |
| Applies to Lambda     | Yes (Compute SP)               | No                              |
| Recommendation        | Preferred for most workloads   | Use only when SP does not apply |

> Always prefer Savings Plans over Reserved Instances for EC2. Savings Plans automatically
> apply to Fargate and Lambda as well, maximizing coverage.

```bash
# Check current Savings Plans coverage and recommendations
aws ce get-savings-plans-coverage \
  --time-period Start=2026-02-01,End=2026-03-01 \
  --granularity MONTHLY

aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --lookback-period-in-days SIXTY_DAYS
```

---

### EC2 Right-Sizing

#### Using CloudWatch Metrics

Identify over-provisioned instances by analyzing CPU, memory, network, and disk utilization.
An instance consistently below 40% CPU utilization is a right-sizing candidate.

```bash
# Query average CPU for all instances over 14 days
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0abc123def456 \
  --start-time 2026-02-24T00:00:00Z \
  --end-time 2026-03-10T00:00:00Z \
  --period 86400 \
  --statistics Average Maximum \
  --output table
```

#### AWS Compute Optimizer

Compute Optimizer analyzes 14 days of CloudWatch metrics and recommends right-sized
instance types. Enable it organization-wide.

```bash
# Enable Compute Optimizer for the entire organization
aws compute-optimizer update-enrollment-status \
  --status Active \
  --include-member-accounts

# Get recommendations for EC2
aws compute-optimizer get-ec2-instance-recommendations \
  --filters name=Finding,values=OVER_PROVISIONED \
  --output json | jq '.instanceRecommendations[] | {
    instanceId: .instanceArn,
    current: .currentInstanceType,
    recommended: .recommendationOptions[0].instanceType,
    savings: .recommendationOptions[0].estimatedMonthlySavings.value
  }'
```

**Compute Optimizer also covers:** EBS volumes, Lambda functions, ECS services on Fargate,
Auto Scaling groups, and RDS instances.

#### Graviton Migration

Graviton (ARM64) instances provide 20-40% better price-performance than equivalent x86
instances. The `g` suffix denotes Graviton: m7g, c7g, r7g, t4g.

| Migration Path          | Effort    | Savings |
|-------------------------|-----------|---------|
| Linux containers (ECS)  | Rebuild image for ARM64 | 20-30% |
| Lambda (Node.js/Python) | Change architecture flag | 20%    |
| RDS / Aurora            | Modify instance class    | 15-20% |
| ElastiCache             | Modify node type         | 15-20% |
| Custom C/C++ binaries   | Recompile for ARM64      | 20-40% |
| .NET on Windows         | Not supported            | N/A    |

```typescript
// AWS CDK -- Graviton across multiple services
// Lambda
const fn = new lambda.Function(this, "Fn", {
  architecture: lambda.Architecture.ARM_64,  // 20% cheaper
  runtime: lambda.Runtime.NODEJS_22_X,
  // ...
});

// Fargate
const taskDef = new ecs.FargateTaskDefinition(this, "Task", {
  runtimePlatform: {
    cpuArchitecture: ecs.CpuArchitecture.ARM64,
    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
  },
  cpu: 1024,
  memoryLimitMiB: 2048,
});

// RDS
const db = new rds.DatabaseInstance(this, "DB", {
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.R7G, ec2.InstanceSize.XLARGE),
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_4 }),
  // ...
});
```

---

### S3 Cost Optimization

#### Storage Class Strategy

| Strategy                                  | Monthly Cost per TB | Use Case                        |
|-------------------------------------------|---------------------|---------------------------------|
| S3 Standard                               | ~$23                | Frequently accessed data        |
| S3 Intelligent-Tiering                    | ~$23 + monitoring   | Unknown access patterns         |
| S3 Standard-IA                            | ~$12.50             | Accessed < once per month       |
| S3 Glacier Instant Retrieval              | ~$4                 | Archival, instant access needed |
| S3 Glacier Deep Archive                   | ~$0.99              | Compliance, rare retrieval      |

> S3 request costs matter at scale. PUT costs 10x more than GET. Batch small objects
> into larger ones when possible (e.g., aggregate log files before archiving).

#### Lifecycle Policies

```hcl
# Terraform -- Comprehensive S3 lifecycle
resource "aws_s3_bucket_lifecycle_configuration" "optimized" {
  bucket = aws_s3_bucket.main.id

  rule {
    id     = "intelligent-tiering-default"
    status = "Enabled"
    filter {}   # Apply to all objects

    transition {
      days          = 0
      storage_class = "INTELLIGENT_TIERING"
    }
  }

  rule {
    id     = "archive-logs"
    status = "Enabled"
    filter { prefix = "logs/" }

    transition { days = 30;  storage_class = "STANDARD_IA" }
    transition { days = 90;  storage_class = "GLACIER_IR" }
    transition { days = 365; storage_class = "DEEP_ARCHIVE" }
    expiration { days = 2555 }  # 7-year retention
  }

  rule {
    id     = "abort-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }

  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    noncurrent_version_expiration { noncurrent_days = 90 }
  }
}
```

> Always add the `abort-incomplete-multipart-upload` rule. Incomplete multipart uploads
> incur storage charges silently and are a common source of unexpected S3 costs.

#### S3 Storage Lens

Enable S3 Storage Lens at the organization level for visibility into storage usage,
activity metrics, and cost optimization recommendations across all accounts and buckets.

---

### RDS / Aurora Cost Optimization

| Strategy                       | Savings        | Implementation                            |
|--------------------------------|----------------|-------------------------------------------|
| Aurora Serverless v2           | 30-60% (dev)   | Scale to 0.5 ACU during idle periods      |
| Graviton instances (r7g)       | 15-20%         | Modify instance class                     |
| Reserved Instances (1yr/3yr)   | 30-60%         | Commit for stable production workloads    |
| Right-size instance class      | 20-50%         | Use Compute Optimizer recommendations     |
| Stop dev/staging instances     | Up to 100%     | Schedule stop during non-business hours   |
| Aurora I/O-Optimized          | Variable       | Switch if I/O > 25% of Aurora bill        |

```bash
# Schedule RDS stop for dev instances (EventBridge + Lambda)
# Or use AWS Instance Scheduler solution
aws rds stop-db-cluster --db-cluster-identifier dev-cluster
# Auto-restarts after 7 days -- automate re-stop with EventBridge

# Check if Aurora I/O-Optimized would save money
aws rds describe-db-clusters --db-cluster-identifier prod-cluster \
  --query 'DBClusters[0].StorageType'
```

**Aurora I/O-Optimized:** Eliminates I/O charges in exchange for a ~30% higher instance
price. Enable when I/O costs exceed 25% of total Aurora bill. Check via Cost Explorer
with `UsageType` filter for `Aurora:StorageIOUsage`.

---

### Lambda Cost Optimization

#### Memory-Duration Tradeoff

Lambda pricing = requests + (memory * duration). More memory = more CPU = faster execution.
Find the sweet spot where total cost (memory * time) is minimized.

```bash
# Use AWS Lambda Power Tuning (Step Functions-based tool)
# Deploy from: https://github.com/alexcasalboni/aws-lambda-power-tuning
# It tests your function at multiple memory sizes and reports cost/duration

# Example output:
# 128 MB:  820ms, $0.0000135
# 256 MB:  420ms, $0.0000140
# 512 MB:  210ms, $0.0000140  ← same cost, 4x faster
# 1024 MB: 105ms, $0.0000140
# 1769 MB:  62ms, $0.0000143  ← 1 full vCPU, minimal improvement
```

> At 1,769 MB, Lambda allocates 1 full vCPU. CPU-bound functions show the most
> improvement up to this point. Beyond 1,769 MB, benefits come only from additional memory.

#### Graviton for Lambda

ARM64 Lambda functions cost 20% less per GB-second with equivalent or better performance.

```yaml
# CloudFormation -- Lambda with ARM64
ProcessorFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: data-processor
    Runtime: nodejs22.x
    Architectures:
      - arm64                    # 20% cheaper than x86_64
    Handler: index.handler
    MemorySize: 512
    Timeout: 30
    Code:
      S3Bucket: !Ref DeployBucket
      S3Key: processor.zip
```

#### Provisioned Concurrency Cost

Provisioned concurrency eliminates cold starts but charges continuously. Use only for
latency-sensitive endpoints. Combine with auto-scaling to match traffic patterns.

| Configuration         | Cold Starts | Idle Cost | Best For                    |
|-----------------------|-------------|-----------|------------------------------|
| No provisioned        | Yes         | $0        | Async, batch, tolerant APIs  |
| Fixed provisioned     | No          | High      | Steady-traffic APIs          |
| Auto-scaled provisioned| Minimal    | Moderate  | Variable but latency-critical|

---

### Data Transfer Costs

Data transfer is the most commonly overlooked AWS cost. Egress to the internet is the
most expensive; intra-region is cheapest.

| Transfer Path                        | Cost per GB (approx)  |
|--------------------------------------|-----------------------|
| Intra-AZ (same AZ)                   | Free                  |
| Inter-AZ (same region)               | $0.01 (each direction)|
| Inter-region                          | $0.02                 |
| Internet egress (first 10 TB/month)  | $0.09                 |
| Internet egress (next 40 TB)         | $0.085                |
| Internet egress (>150 TB)            | $0.05                 |
| CloudFront egress (vs direct)        | $0.085 (often cheaper)|
| S3 to CloudFront (same region)       | Free                  |
| VPC endpoint (Gateway: S3/DynamoDB)  | Free                  |
| VPC endpoint (Interface)             | $0.01/GB + hourly     |
| NAT Gateway processing               | $0.045/GB             |

**Cost reduction strategies:**

```
  ┌─────────────────────────────────────────────────────────┐
  │                   DATA TRANSFER SAVINGS                  │
  ├─────────────────────────────────────────────────────────┤
  │ 1. Use VPC Gateway Endpoints for S3 and DynamoDB (FREE) │
  │ 2. Use CloudFront for internet egress (cheaper + cache)  │
  │ 3. Keep compute and storage in same AZ where possible    │
  │ 4. Compress data before transfer (gzip/zstd)             │
  │ 5. Use S3 Transfer Acceleration only when needed ($0.04) │
  │ 6. NAT Gateway: minimize traffic via VPC endpoints       │
  └─────────────────────────────────────────────────────────┘
```

```hcl
# Terraform -- VPC Gateway Endpoints (free S3/DynamoDB access from private subnets)
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = module.vpc.vpc_id
  service_name = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = module.vpc.private_route_table_ids
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = module.vpc.vpc_id
  service_name = "com.amazonaws.${var.region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = module.vpc.private_route_table_ids
}
```

> NAT Gateway charges $0.045/GB processed. A single service pulling container images,
> packages, or API data through NAT can cost hundreds per month. Use VPC endpoints
> for AWS services and ECR pull-through cache to reduce NAT costs.

---

### AWS Cost Management Tools

#### Cost Explorer

Visualize and analyze spending with filtering by service, account, tag, region, and usage type.
Enable hourly granularity for production accounts to detect anomalies quickly.

```bash
# Get monthly cost breakdown by service
aws ce get-cost-and-usage \
  --time-period Start=2026-02-01,End=2026-03-01 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output table

# Get daily cost for a specific tag
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-10 \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter '{"Tags":{"Key":"Project","Values":["my-app"]}}' \
  --output json
```

#### AWS Budgets

Set spending thresholds with alerts. Create budgets per account, service, or tag.

```hcl
# Terraform -- Budget with alert
resource "aws_budgets_budget" "monthly" {
  name         = "monthly-total"
  budget_type  = "COST"
  limit_amount = "5000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$production"]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_email_addresses = ["cloud-team@company.com"]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = ["cloud-team@company.com", "engineering-lead@company.com"]
  }
}
```

#### Cost Allocation Tags

Define tags that appear as columns in Cost Explorer and billing reports.

| Tag Key        | Purpose                      | Example Values            |
|----------------|------------------------------|---------------------------|
| `Environment`  | Env separation               | production, staging, dev  |
| `Project`      | Project attribution          | payments-api, data-lake   |
| `Team`         | Team cost ownership          | platform, backend, data   |
| `CostCenter`   | Finance allocation           | CC-1001, CC-2050          |
| `ManagedBy`    | IaC tool tracking            | terraform, cdk, manual    |

> Activate cost allocation tags in the Billing console. Tags must be activated before
> they appear in cost reports. Retroactive activation is not possible.

---

### Spot Instances

Spot instances offer up to 90% savings but can be reclaimed with 2-minute notice.

#### Interruption Handling

```typescript
// Node.js -- Check for spot interruption notice
async function checkSpotInterruption(): Promise<boolean> {
  try {
    const res = await fetch(
      "http://169.254.169.254/latest/meta-data/spot/instance-action",
      { signal: AbortSignal.timeout(1000) }
    );
    if (res.ok) {
      const data = await res.json();
      console.log(`Spot interruption: action=${data.action}, time=${data.time}`);
      return true; // Initiate graceful shutdown
    }
    return false;
  } catch {
    return false; // No interruption pending
  }
}
```

#### Spot Diversification

```hcl
# Terraform -- EC2 Auto Scaling with Spot diversification
resource "aws_autoscaling_group" "workers" {
  desired_capacity = 10
  min_size         = 5
  max_size         = 20

  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 2   # 2 on-demand minimum
      on_demand_percentage_above_base_capacity = 0   # rest is spot
      spot_allocation_strategy                 = "price-capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.worker.id
        version            = "$Latest"
      }

      # Diversify across 6+ instance types for Spot availability
      override { instance_type = "m7g.xlarge"  }
      override { instance_type = "m6g.xlarge"  }
      override { instance_type = "m7i.xlarge"  }
      override { instance_type = "m6i.xlarge"  }
      override { instance_type = "c7g.xlarge"  }
      override { instance_type = "c6g.xlarge"  }
      override { instance_type = "r7g.xlarge"  }
    }
  }

  tag {
    key                 = "PurchaseModel"
    value               = "spot-diversified"
    propagate_at_launch = true
  }
}
```

**Spot best practices:**
- Use `price-capacity-optimized` allocation strategy (AWS recommends since 2023)
- Diversify across 6+ instance types and multiple AZs
- Set on-demand base capacity for minimum availability
- Design workloads to be stateless and checkpoint-capable
- Use Spot Fleet or ASG mixed instances -- never single Spot requests

---

### Commitment Strategies

#### Decision Framework

```
  ┌──────────────────────────────────────────────────────────┐
  │                  COMMITMENT DECISION TREE                 │
  ├──────────────────────────────────────────────────────────┤
  │                                                          │
  │  Is the workload stable for 1+ year?                     │
  │    ├─ No  → Stay on On-Demand (or Spot if tolerant)      │
  │    └─ Yes → What services?                               │
  │              ├─ EC2 + Fargate + Lambda                    │
  │              │   → Compute Savings Plan (most flexible)   │
  │              ├─ EC2 only (known instance type)            │
  │              │   → EC2 Instance Savings Plan (deeper)     │
  │              ├─ RDS / ElastiCache / Redshift              │
  │              │   → Reserved Instances (only option)       │
  │              └─ DynamoDB                                  │
  │                  → Reserved Capacity (provisioned mode)   │
  │                                                          │
  │  Payment option impact (3-year term):                    │
  │    All Upfront:     ~maximum discount                     │
  │    Partial Upfront: ~moderate discount                    │
  │    No Upfront:      ~minimum discount (but no capex)      │
  └──────────────────────────────────────────────────────────┘
```

> Start with No Upfront 1-year Compute Savings Plans to cover 70-80% of steady-state
> usage. Add 3-year commitments only after 6+ months of stable usage data.

#### Monitoring Commitment Utilization

```bash
# Check Savings Plan utilization
aws ce get-savings-plans-utilization \
  --time-period Start=2026-02-01,End=2026-03-01 \
  --granularity MONTHLY

# Check Reserved Instance utilization
aws ce get-reservation-utilization \
  --time-period Start=2026-02-01,End=2026-03-01 \
  --granularity MONTHLY \
  --group-by Type=DIMENSION,Key=SUBSCRIPTION_ID
```

Target: 95%+ utilization on all commitments. Underutilized commitments are sunk cost.
Use the RI/SP utilization report in Cost Explorer and set Budget alerts at 90% threshold.

---

### Trusted Advisor

Trusted Advisor provides automated checks across cost, performance, security, fault tolerance,
and service limits. Business and Enterprise Support plans unlock all checks.

**Key cost optimization checks:**
- Low-utilization EC2 instances
- Idle RDS instances
- Underutilized EBS volumes
- Unassociated Elastic IP addresses
- Idle load balancers
- Savings Plan and RI optimization

```bash
# List all Trusted Advisor checks
aws support describe-trusted-advisor-checks --language en \
  --query 'checks[?category==`cost_optimizing`].{id:id, name:name}' \
  --output table

# Get results for a specific check
aws support describe-trusted-advisor-check-result \
  --check-id "Qch7DwouX1" \
  --output json
```

---

## Best Practices

1. **Enable Cost Explorer and activate cost allocation tags on day one.** Retroactive tag
   activation is impossible. Define a mandatory tagging policy enforced via SCP and IaC.

2. **Start with Compute Savings Plans before Reserved Instances.** Compute SPs apply to EC2,
   Fargate, and Lambda across any region and instance family. Buy No Upfront 1-year first.

3. **Right-size before committing.** Use Compute Optimizer for 14+ days, then commit.
   Committing to oversized instances locks in waste for 1-3 years.

4. **Use Graviton everywhere possible.** Switch Lambda to ARM64 (one-line change, 20% savings).
   Migrate ECS tasks, RDS, and ElastiCache to Graviton instance families.

5. **Set up VPC Gateway Endpoints for S3 and DynamoDB immediately.** Free data transfer for
   private subnet traffic. Interface endpoints for other services when NAT costs exceed endpoint costs.

6. **Create AWS Budgets with forecasted and actual alerts.** Set at 80% forecasted and 100%
   actual. Alert both the engineering team and finance. Automate shutdown of dev environments.

7. **Implement S3 lifecycle policies on every bucket.** At minimum: abort incomplete multipart
   uploads after 7 days. Add Intelligent-Tiering or transition rules for data older than 30 days.

8. **Diversify Spot across 6+ instance types.** Use `price-capacity-optimized` strategy.
   Never rely on a single Spot instance type -- it defeats the purpose of Spot pricing.

9. **Monitor data transfer costs weekly.** Enable Cost Explorer with hourly granularity.
   Filter by usage type `DataTransfer` to identify cross-AZ and egress hotspots.

10. **Schedule non-production resources to stop.** Use AWS Instance Scheduler or EventBridge
    rules to stop dev/staging RDS, EC2, and ECS outside business hours (save 65%+ on dev).

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| **Buying RIs without right-sizing first** | Locked into oversized instances for 1-3 years | Use Compute Optimizer for 14+ days, right-size, then commit |
| **Ignoring data transfer line items** | Cross-AZ and NAT Gateway costs grow silently | VPC endpoints, same-AZ affinity, weekly transfer cost review |
| **No S3 lifecycle policies** | Old data stays in Standard tier indefinitely | Lifecycle rules to IA then Glacier then Deep Archive then expire |
| **Single Spot instance type** | High interruption rate when pool depletes | Diversify across 6+ types, use price-capacity-optimized |
| **Running dev 24/7** | Paying for idle resources 128 hrs/week | Schedule stop outside business hours (save 65%+) |
| **No cost allocation tags** | Cannot attribute costs to teams or projects | Mandatory tags enforced via SCP + IaC validation |
| **Over-provisioned Lambda memory** | Paying for unused memory every invocation | Run Lambda Power Tuning to find optimal memory setting |
| **3-year All Upfront commitment too early** | Usage patterns unknown, locked-in capital | Start with 1-year No Upfront, extend after 6+ months data |

---

## Enforcement Checklist

- [ ] Cost Explorer enabled with hourly granularity for production accounts
- [ ] Cost allocation tags defined and activated (Environment, Project, Team, CostCenter)
- [ ] AWS Budgets configured with forecasted (80%) and actual (100%) alerts
- [ ] Compute Optimizer enabled organization-wide
- [ ] Graviton instances used for Lambda, Fargate, RDS, and ElastiCache
- [ ] VPC Gateway Endpoints deployed for S3 and DynamoDB in all VPCs
- [ ] S3 lifecycle policies configured on every bucket (including multipart abort)
- [ ] Savings Plans purchased to cover 70-80% of steady-state compute
- [ ] Spot instances used for fault-tolerant workloads with 6+ type diversification
- [ ] Non-production environments scheduled to stop outside business hours
- [ ] Data transfer costs reviewed weekly in Cost Explorer
- [ ] Trusted Advisor cost optimization checks reviewed monthly
