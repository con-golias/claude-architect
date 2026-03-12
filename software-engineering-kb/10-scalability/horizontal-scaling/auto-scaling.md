# Auto-Scaling

> **Domain:** Scalability > Horizontal Scaling
> **Importance:** Critical
> **Last Updated:** 2025

## Scaling Strategies

### Reactive Scaling (Threshold-Based)

Scale based on real-time metrics exceeding thresholds.

```
Metric > Threshold → Scale Out → Cooldown → Re-evaluate
Metric < Threshold → Scale In  → Cooldown → Re-evaluate
```

**Common triggers:** CPU >70%, Memory >80%, Request latency p95 >500ms, Queue depth >1000.

### Predictive Scaling

Use historical patterns to pre-provision capacity before demand spikes.

```python
# Predictive scaling with time-series forecast
from datetime import datetime, timedelta

def predict_capacity(historical_data: list[dict], forecast_hours: int = 4) -> int:
    """Simple seasonal prediction based on same time last week."""
    target_time = datetime.now() + timedelta(hours=forecast_hours)
    same_time_last_week = [
        d["instances"] for d in historical_data
        if abs((d["timestamp"].hour - target_time.hour)) < 1
        and d["timestamp"].weekday() == target_time.weekday()
    ]
    if not same_time_last_week:
        return max(d["instances"] for d in historical_data)
    return int(max(same_time_last_week) * 1.2)  # 20% headroom
```

### Scheduled Scaling

Pre-set capacity for known traffic patterns:

```yaml
# AWS ASG Scheduled Action
Resources:
  MorningScaleUp:
    Type: AWS::AutoScaling::ScheduledAction
    Properties:
      AutoScalingGroupName: !Ref ASG
      DesiredCapacity: 10
      Recurrence: "0 8 * * MON-FRI"  # 8 AM weekdays

  EveningScaleDown:
    Type: AWS::AutoScaling::ScheduledAction
    Properties:
      AutoScalingGroupName: !Ref ASG
      DesiredCapacity: 3
      Recurrence: "0 22 * * *"  # 10 PM daily
```

## Kubernetes HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 50
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100        # Double pods
          periodSeconds: 60
        - type: Pods
          value: 5          # Or add 5 pods
      selectPolicy: Max     # Use whichever adds more
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min before scaling down
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
```

## KEDA (Event-Driven Autoscaling)

Scale based on external event sources — queue depth, Kafka lag, Prometheus metrics.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-processor
spec:
  scaleTargetRef:
    name: order-processor
  minReplicaCount: 0    # Scale to zero
  maxReplicaCount: 100
  cooldownPeriod: 300
  pollingInterval: 15
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        consumerGroup: order-group
        topic: orders
        lagThreshold: "50"    # Scale up when lag > 50
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: http_requests_total
        threshold: "100"
        query: sum(rate(http_requests_total[2m]))
```

## AWS Auto Scaling Group

```hcl
resource "aws_autoscaling_group" "api" {
  name                = "api-asg"
  min_size            = 3
  max_size            = 50
  desired_capacity    = 5
  vpc_zone_identifier = var.private_subnet_ids

  launch_template {
    id      = aws_launch_template.api.id
    version = "$Latest"
  }

  # Mixed instances for cost optimization
  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 3    # Minimum on-demand
      on_demand_percentage_above_base_capacity = 25   # 25% on-demand, 75% spot
      spot_allocation_strategy                 = "capacity-optimized"
    }
    launch_template {
      override {
        instance_type = "c6i.xlarge"
      }
      override {
        instance_type = "c6a.xlarge"
      }
      override {
        instance_type = "c5.xlarge"
      }
    }
  }

  # Target tracking scaling
  tag {
    key                 = "Name"
    value               = "api-instance"
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_policy" "cpu_target" {
  name                   = "cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value     = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
```

## Cooldown and Scaling Velocity

| Parameter | Scale Out | Scale In |
|-----------|-----------|----------|
| Cooldown | 60s (react fast) | 300s (scale down slow) |
| Step size | Aggressive (double) | Conservative (10-20%) |
| Stabilization | 0-60s | 300-600s |

**Rule:** Scale out fast, scale in slow. Prevents oscillation and premature scale-down.

## Scaling Metrics Selection

| Metric | Best For | Caution |
|--------|----------|---------|
| CPU utilization | CPU-bound workloads | Misleading for I/O-bound |
| Memory utilization | Memory-intensive apps | Slow to reflect load changes |
| Request rate (RPS) | Web APIs | Doesn't account for request complexity |
| Request latency (p95) | User-facing services | Lagging indicator |
| Queue depth | Worker processing | Direct signal of work backlog |
| Custom business metric | Domain-specific | Requires instrumentation |
| Concurrent connections | WebSocket/long-poll | Direct capacity indicator |

## Scale-to-Zero

For event-driven workloads with idle periods:

```yaml
# KEDA: scale to 0 when no messages
spec:
  minReplicaCount: 0
  triggers:
    - type: aws-sqs-queue
      metadata:
        queueURL: https://sqs.region.amazonaws.com/account/queue
        queueLength: "5"
        activationQueueLength: "0"  # Activate from 0 when messages arrive
```

**Cold start trade-off:** 0 pods → first pod takes 5-30s to be ready.

## Best Practices

1. **Scale out fast, scale in slow** — 60s cooldown for out, 300s+ for in
2. **Use multiple metrics** — CPU + custom metric prevents single-signal blind spots
3. **Set min replicas for HA** — minimum 3 pods across availability zones
4. **Use target tracking over step scaling** — simpler, self-adjusting
5. **Enable predictive scaling for known patterns** — pre-warm before daily peaks
6. **Test scaling behavior under load** — verify scaling speed matches traffic ramp
7. **Set max limits with budget alarms** — prevent runaway scaling costs
8. **Use mixed instance types** — spot + on-demand for cost optimization
9. **Monitor scaling events** — alert on frequent scaling (oscillation indicator)
10. **Right-size before auto-scaling** — optimize per-instance capacity first

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Equal cooldown for scale up/down | Oscillation | Asymmetric: fast out, slow in |
| Single metric (CPU only) | Misses I/O bottlenecks | Multiple metrics |
| No max limit | Unlimited cost | Set max instances with budget alerts |
| Scaling on lagging indicators | Too slow response | Use leading metrics (queue depth, RPS) |
| Min replicas = 1 | No high availability | Min 3 across AZs |
| No load testing of scaling | Unknown scaling speed | Regularly test scaling behavior |
| Scaling stateful services | Data loss risk | Externalize state first |
| Ignoring cold start time | Degraded performance | Pre-warm or keep minimum warm pool |

## Enforcement Checklist

- [ ] Auto-scaling configured with appropriate min/max/desired
- [ ] Scale-out cooldown < scale-in cooldown (asymmetric)
- [ ] Multiple scaling metrics configured
- [ ] Budget alarms set for maximum scaling cost
- [ ] Scaling behavior validated with load tests
- [ ] Monitoring dashboard shows scaling events and metrics
- [ ] Mixed instance strategy for cost optimization
- [ ] Predictive or scheduled scaling for known traffic patterns
