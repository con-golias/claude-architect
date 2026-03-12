# Capacity Planning

## Metadata

| Attribute    | Value                                |
|------------- |--------------------------------------|
| Domain       | Scalability > Capacity Planning      |
| Importance   | Critical                             |
| Applies To   | Backend, Infrastructure, Platform    |
| Updated      | 2026-03-10                           |

---

## Core Concepts

### Capacity Planning Methodology

Follow a continuous cycle of four phases:

1. **Measure** -- Collect baseline metrics from production systems (CPU, memory, network, disk, RPS).
2. **Model** -- Build mathematical models that map workload to resource consumption.
3. **Predict** -- Forecast future demand using growth rates, seasonal patterns, and business projections.
4. **Provision** -- Allocate resources ahead of predicted demand with appropriate headroom.

### Traffic Modeling

Identify and quantify traffic patterns at every temporal resolution:

- **Daily patterns** -- Peak hours vs off-peak; typical ratio is 3:1 to 5:1.
- **Weekly patterns** -- Weekday vs weekend variance; B2B products often see 80% drop on weekends.
- **Seasonal patterns** -- Holiday spikes, end-of-quarter surges, product launch windows.
- **Growth rate** -- Month-over-month organic growth; separate from one-time events.

### Resource Mapping

Map every unit of work (request, transaction, job) to the resources it consumes:

| Resource  | Metric                  | Typical Bottleneck          |
|---------- |------------------------ |---------------------------- |
| CPU       | Cores per 1K RPS        | Serialization, encryption   |
| Memory    | MB per connection       | Session state, caching      |
| Network   | Mbps per 1K RPS         | Payload size, chattiness    |
| Storage   | IOPS per 1K TPS         | Write-heavy workloads       |
| Disk      | GB growth per day       | Logs, media, event streams  |

### Headroom Planning

Target **60-70% utilization at peak** for production systems. This leaves room for:

- Unexpected traffic spikes (marketing campaigns, viral events).
- Graceful degradation during partial failures.
- Deployment rollouts that temporarily reduce fleet capacity.

### Component-Specific Planning

Plan capacity separately for each tier:

- **Databases** -- Connection pool limits, IOPS ceiling, storage growth, replication lag budget.
- **Caches** -- Memory per key, eviction rate, hit-ratio targets (aim for > 95%).
- **Queues** -- Consumer throughput, backlog drain time, partition count.
- **CDN/Edge** -- Bandwidth ceiling, cache-fill ratio, origin shield capacity.

---

## Code Examples

### Python: Capacity Model with Linear Regression Forecasting

```python
"""Capacity forecasting model using linear regression on historical metrics."""

from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np
from numpy.polynomial import polynomial as P


@dataclass
class CapacityDataPoint:
    timestamp: datetime
    rps: float
    cpu_percent: float
    memory_mb: float
    latency_p99_ms: float


@dataclass
class CapacityForecast:
    target_date: datetime
    predicted_rps: float
    predicted_cpu: float
    predicted_memory_mb: float
    headroom_exhaustion_date: datetime | None


class CapacityModel:
    """Build and query a linear capacity model from historical data."""

    def __init__(self, headroom_target: float = 0.70) -> None:
        self._headroom_target = headroom_target
        self._data: list[CapacityDataPoint] = []
        self._rps_coeffs: np.ndarray | None = None
        self._cpu_per_rps: float = 0.0
        self._mem_per_rps: float = 0.0

    def ingest(self, points: list[CapacityDataPoint]) -> None:
        self._data.extend(points)
        self._data.sort(key=lambda p: p.timestamp)

    def train(self) -> None:
        """Fit linear models for RPS growth and resource-per-RPS ratios."""
        if len(self._data) < 7:
            raise ValueError("Need at least 7 data points to train.")
        base = self._data[0].timestamp
        days = np.array([(p.timestamp - base).total_seconds() / 86400 for p in self._data])
        rps = np.array([p.rps for p in self._data])
        cpu = np.array([p.cpu_percent for p in self._data])
        mem = np.array([p.memory_mb for p in self._data])
        self._rps_coeffs = P.polyfit(days, rps, deg=1)
        self._cpu_per_rps = float(np.median(cpu / np.maximum(rps, 1)))
        self._mem_per_rps = float(np.median(mem / np.maximum(rps, 1)))

    def forecast(self, target_date: datetime, max_cpu: float = 100.0) -> CapacityForecast:
        """Predict resource needs at target_date and when headroom runs out."""
        if self._rps_coeffs is None:
            raise RuntimeError("Call train() before forecast().")
        base = self._data[0].timestamp
        target_day = (target_date - base).total_seconds() / 86400
        predicted_rps = float(P.polyval(target_day, self._rps_coeffs))
        predicted_cpu = predicted_rps * self._cpu_per_rps
        predicted_mem = predicted_rps * self._mem_per_rps
        # Find when CPU headroom is exhausted
        ceiling = max_cpu * self._headroom_target
        ceiling_rps = ceiling / self._cpu_per_rps if self._cpu_per_rps > 0 else float("inf")
        if self._rps_coeffs[1] > 0:
            exhaust_day = (ceiling_rps - self._rps_coeffs[0]) / self._rps_coeffs[1]
            exhaust_date = base + timedelta(days=float(exhaust_day))
        else:
            exhaust_date = None
        return CapacityForecast(
            target_date=target_date, predicted_rps=round(predicted_rps, 1),
            predicted_cpu=round(predicted_cpu, 2),
            predicted_memory_mb=round(predicted_mem, 1),
            headroom_exhaustion_date=exhaust_date,
        )
```

### TypeScript: Traffic Simulator for Capacity Estimation

```typescript
/**
 * Simulate realistic traffic patterns for capacity estimation.
 * Model daily curves, weekly variance, and growth trends.
 */

interface TrafficProfile {
  baseRps: number;
  peakMultiplier: number;       // peak-to-average ratio
  weekendDropPercent: number;   // e.g., 60 means weekend is 40% of weekday
  monthlyGrowthPercent: number;
}

interface SimulationResult {
  hourOfDay: number;
  dayOfWeek: number;
  weekNumber: number;
  estimatedRps: number;
  requiredCpuCores: number;
  requiredMemoryGb: number;
}

const RPS_PER_CORE = 500;
const MEMORY_GB_PER_1K_RPS = 2.5;

function dailyCurve(hour: number): number {
  // Bell curve peaking at hour 14 (2 PM UTC)
  const peak = 14;
  const sigma = 4;
  const exponent = -0.5 * ((hour - peak) / sigma) ** 2;
  return 0.3 + 0.7 * Math.exp(exponent);
}

function simulateTraffic(
  profile: TrafficProfile,
  weeks: number,
): SimulationResult[] {
  const results: SimulationResult[] = [];

  for (let week = 0; week < weeks; week++) {
    const growthFactor = (1 + profile.monthlyGrowthPercent / 100) ** (week / 4.33);

    for (let day = 0; day < 7; day++) {
      const isWeekend = day >= 5;
      const weekendFactor = isWeekend
        ? 1 - profile.weekendDropPercent / 100
        : 1.0;

      for (let hour = 0; hour < 24; hour++) {
        const hourFactor = dailyCurve(hour);
        const estimatedRps =
          profile.baseRps *
          profile.peakMultiplier *
          hourFactor *
          weekendFactor *
          growthFactor;

        results.push({
          hourOfDay: hour,
          dayOfWeek: day,
          weekNumber: week,
          estimatedRps: Math.round(estimatedRps),
          requiredCpuCores: Math.ceil(estimatedRps / RPS_PER_CORE),
          requiredMemoryGb: Math.ceil((estimatedRps / 1000) * MEMORY_GB_PER_1K_RPS),
        });
      }
    }
  }

  return results;
}

function findPeakRequirements(results: SimulationResult[]) {
  const peakRps = Math.max(...results.map((r) => r.estimatedRps));
  const peakCores = Math.ceil(peakRps / RPS_PER_CORE);
  const peakMemGb = Math.ceil((peakRps / 1000) * MEMORY_GB_PER_1K_RPS);
  return {
    peakRps, peakCores, peakMemoryGb: peakMemGb,
    provisionedCores: Math.ceil(peakCores / 0.7),       // 70% headroom target
    provisionedMemoryGb: Math.ceil(peakMemGb / 0.7),
  };
}
```

### Go: Load Test Harness with Percentile Tracking

```go
// Package loadtest provides a minimal load testing harness that tracks
// latency percentiles and throughput for capacity planning.
package loadtest

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// Config defines load test parameters.
type Config struct {
	TargetURL   string
	RPS         int
	Duration    time.Duration
	Concurrency int
}

// Result holds aggregated load test metrics.
type Result struct {
	TotalRequests int64
	Successes     int64
	Failures      int64
	P50Ms         float64
	P90Ms         float64
	P95Ms         float64
	P99Ms         float64
	MaxMs         float64
	ActualRPS     float64
}

// Run executes the load test and returns percentile-tracked results.
func Run(cfg Config) (*Result, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	var (
		total, success, failures int64
		mu                       sync.Mutex
		latencies                []float64
	)
	sem := make(chan struct{}, cfg.Concurrency)
	ticker := time.NewTicker(time.Second / time.Duration(cfg.RPS))
	defer ticker.Stop()
	deadline := time.After(cfg.Duration)
	start := time.Now()
loop:
	for {
		select {
		case <-deadline:
			break loop
		case <-ticker.C:
			sem <- struct{}{}
			go func() {
				defer func() { <-sem }()
				reqStart := time.Now()
				resp, err := client.Get(cfg.TargetURL)
				elapsed := time.Since(reqStart).Seconds() * 1000
				atomic.AddInt64(&total, 1)
				mu.Lock()
				latencies = append(latencies, elapsed)
				mu.Unlock()
				if err != nil || resp.StatusCode >= 500 {
					atomic.AddInt64(&failures, 1)
					return
				}
				resp.Body.Close()
				atomic.AddInt64(&success, 1)
			}()
		}
	}
	for i := 0; i < cfg.Concurrency; i++ { sem <- struct{}{} }
	elapsed := time.Since(start).Seconds()
	sort.Float64s(latencies)
	return &Result{
		TotalRequests: total, Successes: success, Failures: failures,
		P50Ms: percentile(latencies, 50), P90Ms: percentile(latencies, 90),
		P95Ms: percentile(latencies, 95), P99Ms: percentile(latencies, 99),
		MaxMs: percentile(latencies, 100), ActualRPS: float64(total) / elapsed,
	}, nil
}

func percentile(sorted []float64, pct float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(math.Ceil(pct/100*float64(len(sorted)))) - 1
	if idx < 0 {
		idx = 0
	}
	return sorted[idx]
}

// PrintReport outputs a human-readable capacity report.
func PrintReport(r *Result) {
	fmt.Printf("--- Capacity Load Test Report ---\n")
	fmt.Printf("Requests: %d (ok=%d fail=%d) | RPS: %.1f\n",
		r.TotalRequests, r.Successes, r.Failures, r.ActualRPS)
	fmt.Printf("Latency P50=%.2fms P90=%.2fms P95=%.2fms P99=%.2fms Max=%.2fms\n",
		r.P50Ms, r.P90Ms, r.P95Ms, r.P99Ms, r.MaxMs)
}
```

### Game Day Exercises

Validate capacity assumptions through controlled failure injection:

1. **Synthetic traffic spikes** -- Replay 2x peak traffic against staging; confirm auto-scaling triggers within SLA.
2. **Zone/region failure** -- Kill one availability zone; verify remaining capacity absorbs the load.
3. **Dependency failure** -- Block a downstream service; confirm circuit breakers activate before resources exhaust.
4. **Storage saturation** -- Fill disks to 90%; verify alerts fire and cleanup automation activates.

---

## 10 Best Practices

1. **Measure before modeling** -- Never estimate capacity from architecture diagrams alone; use production telemetry.
2. **Track cost-per-request** -- Tie every infrastructure cost to a business-level unit (request, transaction, user).
3. **Plan per component** -- Build separate capacity models for compute, database, cache, and queue tiers.
4. **Maintain a capacity register** -- Document current limits, utilization, and forecasted exhaustion dates for every service.
5. **Automate data collection** -- Feed metrics into the capacity model automatically; never rely on manual spreadsheets.
6. **Use percentiles, not averages** -- Base capacity on P99 latency and peak RPS, not mean values.
7. **Include failure scenarios** -- Size for N-1 redundancy so one node failure does not breach headroom targets.
8. **Re-validate quarterly** -- Traffic patterns and code efficiency change; retrain models every quarter.
9. **Run game days** -- Simulate capacity exhaustion in staging at least twice per year.
10. **Communicate forecasts to leadership** -- Share capacity runway with engineering and finance stakeholders monthly.

---

## 8 Anti-Patterns

| #  | Anti-Pattern                        | Problem                                                    | Correct Approach                                        |
|----|-------------------------------------|------------------------------------------------------------|---------------------------------------------------------|
| 1  | Gut-feel provisioning               | Resources are guessed, leading to waste or outages         | Use data-driven models built from production metrics    |
| 2  | Planning only for average load      | System collapses under peak traffic                        | Always plan for peak with 30-40% headroom               |
| 3  | Ignoring seasonal variation         | Holiday or campaign traffic overwhelms infrastructure      | Model seasonal patterns and pre-scale before events     |
| 4  | Single-tier capacity model          | Database saturates while compute has ample headroom        | Build independent models per tier                       |
| 5  | Set-and-forget provisioning         | Growth erodes headroom silently                            | Continuously monitor utilization against forecasts      |
| 6  | Scaling only vertically             | Hitting single-machine ceiling with no horizontal fallback | Design for horizontal scaling from day one              |
| 7  | Ignoring data growth                | Storage and backup costs spiral; queries slow down         | Project data volume growth and plan retention policies  |
| 8  | No load testing in CI               | Capacity regressions ship to production undetected         | Run lightweight performance benchmarks on every merge   |

---

## Enforcement Checklist

- [ ] Every service has a documented capacity model with current and projected utilization.
- [ ] Peak utilization stays below 70% on all tiers (compute, database, cache, queue).
- [ ] Traffic forecasts are updated monthly and shared with stakeholders.
- [ ] Game day exercises are conducted at least twice per year.
- [ ] Auto-scaling policies are validated against real traffic replay.
- [ ] Capacity dashboards are accessible to all on-call engineers.
- [ ] Alerts fire when any resource exceeds 80% utilization for more than 5 minutes.
- [ ] Load tests run in CI to catch throughput regressions before deployment.
- [ ] Data retention and archival policies are enforced to control storage growth.
- [ ] Capacity planning artifacts are version-controlled alongside infrastructure code.
