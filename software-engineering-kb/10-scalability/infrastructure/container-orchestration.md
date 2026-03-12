# Container Orchestration at Scale

> **Domain:** Scalability > Infrastructure
> **Importance:** Critical
> **Last Updated:** 2026-03-10
> **Cross-references:**
> - `10-scalability/horizontal-scaling/`
> - `10-scalability/database-scaling/`

---

## Core Concepts

### Scaling Primitives in Kubernetes

Container orchestration at scale relies on four complementary scaling mechanisms.

| Primitive | Scope | Trigger | Direction |
|---|---|---|---|
| **HPA** (Horizontal Pod Autoscaler) | Pod replicas | CPU, memory, custom metrics | Horizontal |
| **VPA** (Vertical Pod Autoscaler) | Pod resources | Historical usage | Vertical |
| **Cluster Autoscaler** | Nodes | Pending pods, underutilization | Horizontal |
| **KEDA** (Kubernetes Event-Driven Autoscaler) | Pod replicas | External event sources | Horizontal |

Use HPA as the default scaling mechanism. Layer VPA for right-sizing. Deploy Cluster Autoscaler
for node-level elasticity. Adopt KEDA when workloads are event-driven.

### Pod Topology and Workload Isolation

Distribute pods evenly across failure domains using topology spread constraints. Isolate workloads
by assigning them to dedicated node pools with taints and node affinity rules. This prevents
noisy-neighbor effects and ensures resource guarantees for critical services.

### Multi-Tenant Resource Governance

Enforce resource quotas and limit ranges at the namespace level. Define minimum and maximum CPU
and memory per container. Cap total resource consumption per team or environment.

### Cluster Federation

Federate multiple clusters for geographic distribution, blast-radius containment, and regulatory
compliance. Use a control plane (KubeFed, Admiralty, or Liqo) to synchronize resources across
clusters while maintaining independent failure domains.

---

## Code Examples

### HPA with Custom Metrics (Requests Per Second)

```yaml
# hpa-custom-metrics.yaml
# Scale based on application-level RPS metric from Prometheus
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 50
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 120
  metrics:
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### VPA for Right-Sizing Container Resources

```yaml
# vpa-rightsizing.yaml
# Automatically adjust CPU and memory requests based on observed usage
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: order-service-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  updatePolicy:
    updateMode: "Auto"           # Options: Off, Initial, Recreate, Auto
    minReplicas: 2               # Keep at least 2 pods during restarts
  resourcePolicy:
    containerPolicies:
      - containerName: order-service
        minAllowed:
          cpu: "100m"
          memory: "128Mi"
        maxAllowed:
          cpu: "4"
          memory: "8Gi"
        controlledResources: ["cpu", "memory"]
        controlledValues: RequestsOnly  # Do not modify limits
```

### KEDA ScaledObject for Event-Driven Scaling

```yaml
# keda-scaled-object.yaml
# Scale consumer pods based on Kafka topic lag and SQS queue depth
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: event-processor-scaler
  namespace: production
spec:
  scaleTargetRef:
    name: event-processor
  pollingInterval: 10
  cooldownPeriod: 120
  idleReplicaCount: 0          # Scale to zero when idle
  minReplicaCount: 1
  maxReplicaCount: 100
  fallback:
    failureThreshold: 3
    replicas: 5                 # Fallback replica count on metric failure
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka-broker:9092
        consumerGroup: event-processor-group
        topic: order-events
        lagThreshold: "50"
        offsetResetPolicy: latest
    - type: aws-sqs-queue
      metadata:
        queueURL: https://sqs.us-east-1.amazonaws.com/123456789/dlq-events
        queueLength: "10"
        awsRegion: us-east-1
      authenticationRef:
        name: aws-credentials
```

### Pod Topology Spread Constraints

```yaml
# topology-spread.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: production
spec:
  replicas: 9
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: api-gateway
        - maxSkew: 2
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: api-gateway
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: workload-type
                    operator: In
                    values: ["api"]
```

### Resource Quotas and Limit Ranges

```yaml
# resource-governance.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-alpha-quota
  namespace: team-alpha
spec:
  hard:
    requests.cpu: "40"
    requests.memory: "80Gi"
    limits.cpu: "80"
    limits.memory: "160Gi"
    pods: "200"
    services.loadbalancers: "5"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: container-limits
  namespace: team-alpha
spec:
  limits:
    - type: Container
      default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "100m"
        memory: "128Mi"
      max:
        cpu: "4"
        memory: "8Gi"
      min:
        cpu: "50m"
        memory: "64Mi"
```

### Custom Kubernetes Controller for Application-Aware Scaling

```go
// controller/scaling_controller.go
// Custom controller that scales based on application queue depth and latency.
package controller

import (
	"context"
	"fmt"
	"math"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

type AppScalingController struct {
	client.Client
	MetricsClient MetricsProvider
	MaxReplicas   int32
	MinReplicas   int32
	TargetLatency time.Duration
	CooldownTime  time.Duration
	lastScaleTime time.Time
}

type MetricsProvider interface {
	GetP99Latency(ctx context.Context, svc string) (time.Duration, error)
	GetQueueDepth(ctx context.Context, svc string) (int64, error)
}

func (r *AppScalingController) Reconcile(
	ctx context.Context, req ctrl.Request,
) (ctrl.Result, error) {
	logger := log.FromContext(ctx)

	var deployment appsv1.Deployment
	if err := r.Get(ctx, req.NamespacedName, &deployment); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	svcName := deployment.Labels["app"]
	if svcName == "" {
		return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
	}

	// Enforce cooldown to prevent flapping
	if time.Since(r.lastScaleTime) < r.CooldownTime {
		return ctrl.Result{RequeueAfter: r.CooldownTime}, nil
	}

	latency, err := r.MetricsClient.GetP99Latency(ctx, svcName)
	if err != nil {
		logger.Error(err, "failed to fetch latency metric")
		return ctrl.Result{RequeueAfter: 15 * time.Second}, nil
	}

	queueDepth, err := r.MetricsClient.GetQueueDepth(ctx, svcName)
	if err != nil {
		logger.Error(err, "failed to fetch queue depth metric")
		return ctrl.Result{RequeueAfter: 15 * time.Second}, nil
	}

	currentReplicas := *deployment.Spec.Replicas
	desiredReplicas := r.calculateReplicas(currentReplicas, latency, queueDepth)

	if desiredReplicas != currentReplicas {
		logger.Info("scaling deployment",
			"from", currentReplicas, "to", desiredReplicas,
			"latency", latency, "queueDepth", queueDepth)

		patch := client.MergeFrom(deployment.DeepCopy())
		deployment.Spec.Replicas = &desiredReplicas
		if err := r.Patch(ctx, &deployment, patch); err != nil {
			return ctrl.Result{}, fmt.Errorf("patch replicas: %w", err)
		}
		r.lastScaleTime = time.Now()
	}

	return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
}

func (r *AppScalingController) calculateReplicas(
	current int32, latency time.Duration, queueDepth int64,
) int32 {
	latencyRatio := float64(latency) / float64(r.TargetLatency)
	queueFactor := 1.0 + float64(queueDepth)/1000.0
	factor := math.Max(latencyRatio, queueFactor)
	desired := int32(math.Ceil(float64(current) * factor))

	if desired < r.MinReplicas {
		return r.MinReplicas
	}
	if desired > r.MaxReplicas {
		return r.MaxReplicas
	}
	return desired
}

func (r *AppScalingController) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&appsv1.Deployment{}).
		Named("app-scaling").
		Complete(r)
}
```

---

## 10 Best Practices

1. **Set both requests and limits on every container.** Requests guarantee scheduling; limits prevent runaway resource consumption.
2. **Use HPA scale-down stabilization windows of at least 300 seconds.** Prevent premature scale-down during transient load dips.
3. **Deploy VPA in recommendation mode first.** Observe suggestions for two weeks before enabling automatic updates.
4. **Configure topology spread constraints across zones.** Ensure pods survive an entire availability zone failure.
5. **Separate node pools by workload class.** Isolate CPU-intensive, memory-intensive, and GPU workloads on dedicated node groups.
6. **Define resource quotas per namespace.** Prevent any single team from consuming the entire cluster budget.
7. **Use PodDisruptionBudgets alongside autoscaling.** Guarantee minimum availability during voluntary disruptions like node drains.
8. **Implement KEDA with fallback replica counts.** When the metrics source is unavailable, maintain a safe baseline of replicas.
9. **Run Cluster Autoscaler with expander strategy set to least-waste.** Minimize cost by selecting node types that best fit pending pod requirements.
10. **Monitor scaling events with alerts on HPA capping.** Detect when HPA reaches maxReplicas and cannot scale further.

---

## 8 Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|---|---|---|
| 1 | No resource requests defined | Pods scheduled on overcommitted nodes, causing OOM kills and CPU throttling | Define explicit CPU and memory requests based on profiling data |
| 2 | Setting CPU limits equal to requests | Throttles burst capacity and degrades latency during traffic spikes | Set limits 2-3x above requests or remove CPU limits entirely |
| 3 | Running HPA and VPA on the same resource dimension | Both controllers fight over CPU or memory targets, causing flapping | Use HPA for horizontal scaling on CPU; use VPA for memory only |
| 4 | Single availability zone deployment | One zone outage takes down the entire service | Spread pods across at least 3 zones with topology constraints |
| 5 | Scaling to zero without readiness probes | First request after scale-up hits an unready pod and fails | Configure startup and readiness probes; use KEDA activation delay |
| 6 | Ignoring PodDisruptionBudgets | Cluster Autoscaler drains nodes and drops below minimum replicas | Set PDB minAvailable to at least N-1 for critical services |
| 7 | Hardcoded replica counts in manifests | Autoscaler changes are overwritten on every deployment | Remove static replica counts when HPA or KEDA manages scaling |
| 8 | No namespace-level quotas in shared clusters | One runaway deployment consumes all cluster resources | Enforce ResourceQuota and LimitRange per namespace |

---

## Enforcement Checklist

- [ ] Every Deployment defines CPU and memory requests for all containers
- [ ] HPA is configured with a scale-down stabilization window >= 300s
- [ ] VPA is deployed in recommendation or initial mode before enabling auto
- [ ] Topology spread constraints distribute pods across at least 2 zones
- [ ] PodDisruptionBudgets exist for all production workloads
- [ ] Resource quotas are enforced on every namespace in shared clusters
- [ ] LimitRange defaults are set so no container runs without resource bounds
- [ ] KEDA ScaledObjects include fallback replica counts
- [ ] Cluster Autoscaler is configured with appropriate min/max node counts per pool
- [ ] Alerts fire when HPA reaches maxReplicas for more than 10 minutes
- [ ] Node pools are separated by workload type with appropriate taints
- [ ] Scaling events are logged and visible in the observability platform
