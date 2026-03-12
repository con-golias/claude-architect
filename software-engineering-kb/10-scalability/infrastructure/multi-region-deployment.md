# Multi-Region Deployment

> **Domain:** Scalability > Infrastructure
> **Importance:** High
> **Last Updated:** 2026-03-10
> **Cross-references:**
> - `07-database/distributed-databases/multi-region.md`
> - `10-scalability/horizontal-scaling/`
> - `08-security/compliance/`

---

## Core Concepts

### Deployment Topologies

| Topology | Description | RTO | RPO | Cost |
|---|---|---|---|---|
| **Active-Active** | All regions serve traffic simultaneously | ~0 | ~0 | Highest |
| **Active-Passive** | Primary serves traffic; standby takes over on failure | Minutes | Seconds-minutes | Medium |
| **Follow-the-Sun** | Active region shifts by time of day and user geography | ~0 during handoff | Near-zero | Medium-high |

Select topology based on the application's availability SLA, data consistency requirements,
and budget. Active-active demands conflict resolution at the data layer.

### Data Replication Strategies

| Strategy | Consistency | Latency Impact | Conflict Risk |
|---|---|---|---|
| **Synchronous** | Strong | High (cross-region RTT per write) | None |
| **Asynchronous** | Eventual | None on write path | Requires resolution |
| **Semi-synchronous** | Bounded staleness | Moderate | Low |

Default to asynchronous replication with conflict resolution for most workloads.
Reserve synchronous replication for strict consistency paths (financial transactions).

### Conflict Resolution Approaches

- **Last-writer-wins (LWW)**: Simplest; risk of silent data loss.
- **Vector clocks**: Track causal ordering; complex to implement.
- **CRDTs**: Mathematically guarantee convergence; limited data type support.
- **Application-level merge**: Custom logic per entity type; most flexible.

### Regional Rollout Strategy

Deploy changes region by region. Start with a low-traffic canary region, validate metrics
for a bake period, then proceed. Halt the rollout if error rate or latency exceeds thresholds.

---

## Code Examples

### Terraform: Multi-Region AWS Infrastructure with Route53 Failover

```hcl
# infra/multi-region/main.tf
locals {
  primary_region   = "us-east-1"
  secondary_region = "eu-west-1"
  domain_name      = "api.example.com"
}

provider "aws" { alias = "primary";   region = local.primary_region }
provider "aws" { alias = "secondary"; region = local.secondary_region }

module "primary_app" {
  source            = "../modules/app-cluster"
  providers         = { aws = aws.primary }
  vpc_id            = module.primary_vpc.vpc_id
  subnet_ids        = module.primary_vpc.private_subnet_ids
  min_instances     = var.primary_min_instances
  max_instances     = var.primary_max_instances
  instance_type     = var.instance_type
  health_check_path = "/health"
  tags              = { Region = "primary" }
}

module "secondary_app" {
  source            = "../modules/app-cluster"
  providers         = { aws = aws.secondary }
  vpc_id            = module.secondary_vpc.vpc_id
  subnet_ids        = module.secondary_vpc.private_subnet_ids
  min_instances     = var.secondary_min_instances
  max_instances     = var.secondary_max_instances
  instance_type     = var.instance_type
  health_check_path = "/health"
  tags              = { Region = "secondary" }
}

resource "aws_route53_health_check" "primary" {
  fqdn              = module.primary_app.alb_dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 10
  tags              = { Name = "primary-health-check" }
}

resource "aws_route53_record" "primary" {
  zone_id = var.hosted_zone_id
  name    = local.domain_name
  type    = "A"
  alias {
    name                   = module.primary_app.alb_dns_name
    zone_id                = module.primary_app.alb_zone_id
    evaluate_target_health = true
  }
  failover_routing_policy { type = "PRIMARY" }
  set_identifier  = "primary"
  health_check_id = aws_route53_health_check.primary.id
}

resource "aws_route53_record" "secondary" {
  zone_id = var.hosted_zone_id
  name    = local.domain_name
  type    = "A"
  alias {
    name                   = module.secondary_app.alb_dns_name
    zone_id                = module.secondary_app.alb_zone_id
    evaluate_target_health = true
  }
  failover_routing_policy { type = "SECONDARY" }
  set_identifier  = "secondary"
  health_check_id = aws_route53_health_check.secondary.id
}
```

### Kubernetes Multi-Cluster with Istio Service Mesh Federation

```yaml
# istio/mesh-federation.yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: primary-cluster
spec:
  meshConfig:
    defaultConfig:
      proxyMetadata:
        ISTIO_META_DNS_CAPTURE: "true"
        ISTIO_META_DNS_AUTO_ALLOCATE: "true"
    enableAutoMtls: true
  values:
    global:
      meshID: global-mesh
      multiCluster:
        clusterName: us-east-1
      network: network-us-east
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: order-service-locality
  namespace: production
spec:
  host: order-service.production.svc.cluster.local
  trafficPolicy:
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    loadBalancer:
      localityLbSetting:
        enabled: true
        failover:
          - from: us-east-1
            to: eu-west-1
        distribute:
          - from: us-east-1/*
            to:
              "us-east-1/*": 90
              "eu-west-1/*": 10
```

### Health Check Service with Cross-Region Failover Logic (Go)

```go
// cmd/healthcheck/main.go
package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

type RegionConfig struct {
	Name      string `json:"name"`
	HealthURL string `json:"healthUrl"`
	Weight    int    `json:"weight"`
}

type RegionStatus struct {
	Region          string    `json:"region"`
	Healthy         bool      `json:"healthy"`
	Latency         int64     `json:"latencyMs"`
	ConsecutiveFail int       `json:"consecutiveFailures"`
	LastCheck       time.Time `json:"lastCheck"`
}

type HealthChecker struct {
	regions           []RegionConfig
	status            map[string]*RegionStatus
	mu                sync.RWMutex
	failoverThreshold int
	httpClient        *http.Client
	onFailover        func(failed, target string)
}

func NewHealthChecker(regions []RegionConfig, threshold int,
	onFailover func(string, string)) *HealthChecker {
	status := make(map[string]*RegionStatus, len(regions))
	for _, r := range regions {
		status[r.Name] = &RegionStatus{Region: r.Name, Healthy: true}
	}
	return &HealthChecker{
		regions: regions, status: status, failoverThreshold: threshold,
		httpClient: &http.Client{Timeout: 5 * time.Second},
		onFailover: onFailover,
	}
}

func (hc *HealthChecker) Start(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			hc.checkAllRegions(ctx)
		}
	}
}

func (hc *HealthChecker) checkAllRegions(ctx context.Context) {
	var wg sync.WaitGroup
	for _, region := range hc.regions {
		wg.Add(1)
		go func(r RegionConfig) {
			defer wg.Done()
			hc.checkRegion(ctx, r)
		}(region)
	}
	wg.Wait()
}

func (hc *HealthChecker) checkRegion(ctx context.Context, region RegionConfig) {
	start := time.Now()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, region.HealthURL, nil)
	resp, err := hc.httpClient.Do(req)
	latency := time.Since(start)

	hc.mu.Lock()
	defer hc.mu.Unlock()
	s := hc.status[region.Name]
	s.LastCheck = time.Now()
	s.Latency = latency.Milliseconds()

	if err != nil || resp.StatusCode != http.StatusOK {
		s.ConsecutiveFail++
		if s.ConsecutiveFail >= hc.failoverThreshold && s.Healthy {
			s.Healthy = false
			if target := hc.findHealthyRegion(region.Name); target != "" {
				slog.Error("triggering failover", "from", region.Name, "to", target)
				go hc.onFailover(region.Name, target)
			}
		}
	} else {
		resp.Body.Close()
		s.ConsecutiveFail = 0
		s.Healthy = true
	}
}

func (hc *HealthChecker) findHealthyRegion(exclude string) string {
	for _, r := range hc.regions {
		if r.Name != exclude {
			if s := hc.status[r.Name]; s.Healthy {
				return r.Name
			}
		}
	}
	return ""
}

func (hc *HealthChecker) StatusHandler(w http.ResponseWriter, _ *http.Request) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	statuses := make([]*RegionStatus, 0, len(hc.status))
	for _, s := range hc.status {
		statuses = append(statuses, s)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statuses)
}

func main() {
	regions := []RegionConfig{
		{Name: "us-east-1", HealthURL: "https://us-east-1.api.example.com/health", Weight: 60},
		{Name: "eu-west-1", HealthURL: "https://eu-west-1.api.example.com/health", Weight: 30},
		{Name: "ap-southeast-1", HealthURL: "https://ap-se-1.api.example.com/health", Weight: 10},
	}
	checker := NewHealthChecker(regions, 3, func(failed, target string) {
		slog.Info("failover executed", "from", failed, "to", target)
		// Integrate with Route53 or global load balancer API to shift traffic.
	})
	ctx := context.Background()
	go checker.Start(ctx, 10*time.Second)
	http.HandleFunc("/status", checker.StatusHandler)
	slog.Info("health checker started", "port", 8080)
	http.ListenAndServe(":8080", nil)
}
```

---

## 10 Best Practices

1. **Start with active-passive before attempting active-active.** Active-passive is simpler and covers most availability requirements.
2. **Use asynchronous replication with conflict resolution as the default.** Synchronous cross-region replication adds unacceptable latency for most workloads.
3. **Deploy infrastructure-as-code identically across regions.** Use the same Terraform modules with region-specific variable files to prevent drift.
4. **Implement health checks at multiple layers.** Check DNS, load balancer, application, and database health independently.
5. **Roll out deployments region by region with bake periods.** Deploy to a canary region first, validate for at least 15 minutes, then continue.
6. **Route traffic based on geographic proximity.** Use latency-based or geolocation DNS routing to minimize round-trip time.
7. **Test failover regularly with game days.** Simulate region failures quarterly to validate automated failover.
8. **Maintain reserved capacity in every active region.** Ensure each region can absorb traffic from a failed region.
9. **Centralize observability across regions.** Aggregate logs, metrics, and traces into a single pane.
10. **Document and automate the failback procedure.** Failback is often more error-prone than failover; rehearse it.

---

## 8 Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|---|---|---|
| 1 | Synchronous cross-region writes on every request | Adds 50-200ms latency per write; throughput collapses | Use async replication; reserve sync for critical paths only |
| 2 | No automated failover mechanism | Manual failover takes 30-60 min; violates SLA | Automate with health checks and DNS switching |
| 3 | Different infrastructure code per region | Configuration drift causes region-specific bugs | Use identical IaC modules with region-specific variables |
| 4 | Single-region database with multi-region compute | Database is single point of failure and latency bottleneck | Deploy read replicas or multi-master databases per region |
| 5 | No failover testing | First real failover reveals untested assumptions and fails | Conduct quarterly game days simulating region failure |
| 6 | Global deploy-all-at-once strategy | Bad deployment takes down all regions simultaneously | Roll out region by region with automated rollback gates |
| 7 | Ignoring data sovereignty requirements | Replicating data to unauthorized regions violates GDPR | Map data residency rules per region; restrict replication |
| 8 | No capacity headroom in secondary regions | Failover traffic overwhelms secondary and cascades | Maintain at least 50% headroom per region for failover |

---

## Enforcement Checklist

- [ ] Deployment topology (active-active or active-passive) is documented and approved
- [ ] Terraform modules are identical across all regions with region-specific tfvars
- [ ] Route53 or global load balancer health checks are configured with 10s intervals
- [ ] Automated failover triggers on 3+ consecutive health check failures
- [ ] Asynchronous replication lag is monitored with alerts at defined thresholds
- [ ] Conflict resolution strategy is implemented and tested for active-active setups
- [ ] Regional rollout pipeline deploys to canary region first with automated gates
- [ ] Each region maintains enough capacity to absorb traffic from one failed region
- [ ] Failover and failback procedures are tested quarterly in game day exercises
- [ ] Observability spans all regions with a centralized dashboard
- [ ] Data residency and sovereignty requirements are mapped per region
- [ ] Cost allocation tags differentiate spend by region for monthly review
