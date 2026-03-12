# Cost Optimization (FinOps)

## Metadata

| Attribute    | Value                                |
|------------- |--------------------------------------|
| Domain       | Scalability > Capacity Planning      |
| Importance   | High                                 |
| Applies To   | Cloud Infrastructure, Platform, SRE  |
| Updated      | 2026-03-10                           |

---

## Core Concepts

### FinOps Principles

Adopt the three-phase FinOps lifecycle:

1. **Inform** -- Provide real-time cost visibility to every team; allocate spending to services, teams, and features.
2. **Optimize** -- Continuously right-size resources, purchase commitments, and eliminate waste.
3. **Operate** -- Embed cost awareness into engineering culture through budgets, alerts, and architectural reviews.

### Cloud Cost Drivers

Understand and monitor the five primary cost categories:

| Category       | Typical Share | Key Levers                                 |
|--------------- |-------------- |------------------------------------------- |
| Compute        | 40-60%        | Instance type, spot/reserved, auto-scaling |
| Storage        | 15-25%        | Tier selection, lifecycle policies, dedup  |
| Network        | 5-15%         | Cross-AZ traffic, NAT gateway, CDN        |
| Data Transfer  | 5-15%         | Egress fees, region placement, compression |
| Managed Services | 10-20%     | Database tier, cache size, queue pricing   |

### Reserved vs On-Demand vs Spot: Decision Framework

Apply this decision tree for every workload:

- **Steady-state baseline** -- Purchase 1-year or 3-year reserved instances (savings: 30-60%).
- **Variable but predictable** -- Use on-demand with auto-scaling; consider savings plans for the predictable floor.
- **Fault-tolerant batch jobs** -- Use spot instances (savings: 60-90%); design for interruption.
- **Short-lived experiments** -- Use on-demand; never commit reservations to uncertain workloads.

### Right-Sizing

Identify over-provisioned resources by analyzing utilization over a 14-day window:

- **CPU < 20% sustained** -- Downsize by one instance class.
- **Memory < 30% sustained** -- Switch to a compute-optimized family.
- **IOPS < 10% of provisioned** -- Move to a lower storage tier or burstable volume.
- **Network < 5% of bandwidth** -- Evaluate smaller instance types.

### Cost per Transaction

Track infrastructure cost normalized to business output:

```
cost_per_transaction = monthly_infra_cost / monthly_transaction_count
```

Use this metric to detect efficiency regressions after deployments and to compare architectural alternatives objectively.

### Architecture Decisions That Reduce Cost

- **Caching** -- A 95% cache hit rate can reduce database costs by 10-20x.
- **Compression** -- Gzip/Brotli on API responses cuts egress costs by 60-80%.
- **CDN** -- Serve static assets from edge; reduces origin compute and egress.
- **Asynchronous processing** -- Shift work to off-peak hours using queues; use spot instances for workers.
- **Data tiering** -- Move cold data to glacier/archive storage automatically.

---

## Code Examples

### Python: AWS Cost Explorer Analysis with Anomaly Detection

```python
"""Query AWS Cost Explorer and detect daily spending anomalies."""

from dataclasses import dataclass
from datetime import datetime, timedelta
import statistics

import boto3


@dataclass
class DailyCost:
    date: str
    amount: float
    service: str


@dataclass
class CostAnomaly:
    date: str
    service: str
    actual: float
    expected: float
    deviation_percent: float


class CostAnalyzer:
    """Analyze AWS costs and flag anomalies beyond a Z-score threshold."""

    def __init__(self, z_threshold: float = 2.0) -> None:
        self._client = boto3.client("ce", region_name="us-east-1")
        self._z_threshold = z_threshold

    def fetch_daily_costs(self, days: int = 30) -> list[DailyCost]:
        """Retrieve daily costs grouped by service for the last N days."""
        end = datetime.utcnow().strftime("%Y-%m-%d")
        start = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

        response = self._client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="DAILY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

        results: list[DailyCost] = []
        for period in response["ResultsByTime"]:
            date = period["TimePeriod"]["Start"]
            for group in period["Groups"]:
                service = group["Keys"][0]
                amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
                results.append(DailyCost(date=date, amount=amount, service=service))
        return results

    def detect_anomalies(self, costs: list[DailyCost]) -> list[CostAnomaly]:
        """Flag days where spending deviates beyond the Z-score threshold."""
        # Group by service
        by_service: dict[str, list[DailyCost]] = {}
        for c in costs:
            by_service.setdefault(c.service, []).append(c)

        anomalies: list[CostAnomaly] = []
        for service, entries in by_service.items():
            amounts = [e.amount for e in entries]
            if len(amounts) < 7:
                continue
            mean = statistics.mean(amounts)
            stdev = statistics.stdev(amounts)
            if stdev == 0:
                continue

            for entry in entries:
                z_score = (entry.amount - mean) / stdev
                if abs(z_score) >= self._z_threshold:
                    deviation = ((entry.amount - mean) / mean) * 100
                    anomalies.append(CostAnomaly(
                        date=entry.date,
                        service=service,
                        actual=round(entry.amount, 2),
                        expected=round(mean, 2),
                        deviation_percent=round(deviation, 1),
                    ))
        return anomalies

    def summarize_top_services(
        self, costs: list[DailyCost], top_n: int = 10,
    ) -> list[tuple[str, float]]:
        """Return the top N services by total spend."""
        totals: dict[str, float] = {}
        for c in costs:
            totals[c.service] = totals.get(c.service, 0.0) + c.amount
        ranked = sorted(totals.items(), key=lambda x: x[1], reverse=True)
        return [(svc, round(amt, 2)) for svc, amt in ranked[:top_n]]
```

### TypeScript: Resource Tagging Enforcement and Cost Allocation

```typescript
/**
 * Enforce mandatory cost-allocation tags on all AWS resources.
 * Report untagged resources and estimate unattributed spend.
 */

interface TagPolicy {
  requiredTags: string[];
  environment: "production" | "staging" | "development";
}

interface UntaggedResource {
  resourceArn: string;
  resourceType: string;
  missingTags: string[];
  estimatedMonthlyCost: number;
}

interface TagComplianceReport {
  totalResources: number;
  compliantResources: number;
  compliancePercent: number;
  untaggedResources: UntaggedResource[];
  unattributedMonthlyCost: number;
}

interface ResourceRecord {
  arn: string;
  type: string;
  tags: Record<string, string>;
  monthlyCost: number;
}

function checkTagCompliance(
  resources: ResourceRecord[],
  policy: TagPolicy,
): TagComplianceReport {
  const untagged: UntaggedResource[] = [];

  for (const resource of resources) {
    const missing = policy.requiredTags.filter(
      (tag) => !(tag in resource.tags) || resource.tags[tag].trim() === "",
    );

    if (missing.length > 0) {
      untagged.push({
        resourceArn: resource.arn,
        resourceType: resource.type,
        missingTags: missing,
        estimatedMonthlyCost: resource.monthlyCost,
      });
    }
  }

  const unattributedCost = untagged.reduce(
    (sum, r) => sum + r.estimatedMonthlyCost,
    0,
  );

  const compliant = resources.length - untagged.length;

  return {
    totalResources: resources.length,
    compliantResources: compliant,
    compliancePercent:
      resources.length > 0
        ? Math.round((compliant / resources.length) * 100)
        : 100,
    untaggedResources: untagged,
    unattributedMonthlyCost: Math.round(unattributedCost * 100) / 100,
  };
}

function generateAllocationReport(
  resources: ResourceRecord[],
  groupByTag: string,
): Map<string, number> {
  const allocation = new Map<string, number>();

  for (const resource of resources) {
    const key = resource.tags[groupByTag] ?? "unattributed";
    allocation.set(key, (allocation.get(key) ?? 0) + resource.monthlyCost);
  }

  return allocation;
}
```

### Terraform: Spot Instances with Fallback to On-Demand

```hcl
# Auto Scaling Group using mixed instances policy.
# Prioritize spot instances; fall back to on-demand for availability.

resource "aws_launch_template" "app" {
  name_prefix   = "app-"
  image_id      = var.ami_id
  instance_type = "c6i.xlarge"

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "app-worker"
      Team        = var.team_name
      Environment = var.environment
      CostCenter  = var.cost_center
    }
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "app-asg"
  min_size            = var.min_instances
  max_size            = var.max_instances
  desired_capacity    = var.desired_instances
  vpc_zone_identifier = var.subnet_ids

  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = var.on_demand_base    # guaranteed minimum
      on_demand_percentage_above_base_capacity = 20                   # 80% spot above base
      spot_allocation_strategy                 = "capacity-optimized"
      spot_max_price                           = ""                   # use on-demand price cap
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.app.id
        version            = "$Latest"
      }

      override {
        instance_type     = "c6i.xlarge"
        weighted_capacity = "1"
      }
      override {
        instance_type     = "c6a.xlarge"
        weighted_capacity = "1"
      }
      override {
        instance_type     = "c5.xlarge"
        weighted_capacity = "1"
      }
    }
  }

  tag {
    key                 = "ManagedBy"
    value               = "terraform"
    propagate_at_launch = true
  }
}

# Spot interruption handler -- drain and replace gracefully.
resource "aws_autoscaling_lifecycle_hook" "spot_drain" {
  name                   = "spot-drain-hook"
  autoscaling_group_name = aws_autoscaling_group.app.name
  lifecycle_transition   = "autoscaling:EC2_INSTANCE_TERMINATING"
  heartbeat_timeout      = 120
  default_result         = "CONTINUE"
}
```

---

## 10 Best Practices

1. **Tag every resource** -- Enforce mandatory tags (team, service, environment, cost-center) via policy-as-code.
2. **Set per-team budgets** -- Create monthly budgets with automated alerts at 80% and 100% thresholds.
3. **Review costs weekly** -- Hold a 15-minute cost review with engineering leads every week.
4. **Right-size continuously** -- Audit instance utilization monthly; automate downsizing recommendations.
5. **Use spot for stateless workloads** -- Run batch jobs, CI runners, and stateless workers on spot instances.
6. **Purchase commitments for baseline** -- Cover the predictable floor with reserved instances or savings plans.
7. **Eliminate idle resources** -- Automatically shut down non-production environments outside business hours.
8. **Compress and cache aggressively** -- Reduce egress and compute costs through CDN, caching, and compression.
9. **Track cost-per-transaction** -- Alert when this metric degrades by more than 15% after a deployment.
10. **Architect for cost from day one** -- Evaluate cost impact during design reviews, not as an afterthought.

---

## 8 Anti-Patterns

| #  | Anti-Pattern                        | Problem                                                     | Correct Approach                                         |
|----|-------------------------------------|-------------------------------------------------------------|----------------------------------------------------------|
| 1  | No cost visibility                  | Teams spend freely with no accountability                   | Provide per-team dashboards with real-time cost data     |
| 2  | Untagged resources                  | Cannot attribute costs to teams or services                 | Enforce tagging policy; block untagged deployments       |
| 3  | Over-provisioning "just in case"    | 70%+ of resources sit idle, burning budget                  | Right-size using utilization data; auto-scale instead    |
| 4  | Ignoring data transfer costs        | Cross-region and cross-AZ traffic silently inflates bills   | Co-locate services; use VPC endpoints; compress payloads |
| 5  | Using on-demand for everything      | Missing 30-60% savings from commitments                     | Analyze usage and purchase reserved capacity for baseline|
| 6  | No shutdown policy for non-prod     | Dev/staging environments run 24/7 at full scale             | Auto-stop non-prod outside business hours                |
| 7  | Treating cost review as one-time    | Savings erode as services grow and change                   | Schedule weekly reviews and quarterly deep-dives         |
| 8  | Optimizing cost without SLO context | Aggressive cost cuts degrade performance and reliability    | Always validate cost changes against SLO compliance      |

---

## Enforcement Checklist

- [ ] All cloud resources carry mandatory tags (team, service, environment, cost-center).
- [ ] Per-team monthly budgets are configured with alerts at 80% and 100%.
- [ ] Untagged resource reports are generated daily and sent to team leads.
- [ ] Right-sizing recommendations are reviewed and acted on monthly.
- [ ] Spot instances are used for all fault-tolerant, stateless workloads.
- [ ] Savings plans or reserved instances cover at least 60% of baseline compute.
- [ ] Non-production environments auto-stop outside business hours.
- [ ] Cost-per-transaction is tracked on the engineering dashboard.
- [ ] Data transfer costs are reviewed quarterly with architecture adjustments as needed.
- [ ] Every architecture design review includes a cost impact analysis.
