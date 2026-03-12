# Stress Testing

> **Domain:** Performance > Benchmarking > Stress Testing
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Why It Matters

Load testing confirms behavior under expected traffic. Stress testing finds where the system breaks. Every system has a failure threshold -- the point where latency spikes, errors cascade, or resources exhaust. Stress testing discovers that threshold before production traffic does. It answers: "What happens when things go wrong?" -- sudden traffic surges, sustained overload, memory leaks over days, massive data volumes, and infrastructure failures.

---

## Stress Test Types

| Type | Goal | Duration | Load Pattern |
|------|------|----------|-------------|
| Breakpoint | Find exact failure threshold | 30-60 min | Stepwise increase until failure |
| Spike | Verify sudden traffic surge handling | 15-30 min | Instant jump to 5-10x normal |
| Soak/Endurance | Detect memory leaks, connection leaks | 4-24 hours | Sustained moderate load |
| Scalability | Measure linear vs non-linear scaling | 1-2 hours | Increase load, measure throughput curve |
| Volume | Test with extreme data sizes | 1-4 hours | Normal load, massive data |

## Breakpoint Testing

Increase load in steps until the system fails. Record the exact threshold.

```javascript
// k6: Breakpoint test -- stepwise ramp until failure
export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 2000,
      stages: [
        { duration: '2m', target: 50 },    // Baseline
        { duration: '2m', target: 100 },   // Step 1
        { duration: '2m', target: 200 },   // Step 2
        { duration: '2m', target: 400 },   // Step 3
        { duration: '2m', target: 800 },   // Step 4
        { duration: '2m', target: 1200 },  // Step 5
        { duration: '2m', target: 1600 },  // Step 6 -- likely breaks here
        { duration: '2m', target: 2000 },  // Step 7
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // Track degradation
    http_req_failed: ['rate<0.05'],     // 5% error rate = breaking point
  },
};

export default function () {
  const res = http.get('https://api.example.com/products');
  check(res, {
    'status 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
}
```

```python
# Analyze breakpoint: find where p99 exceeds SLO or error rate spikes
def find_breakpoint(step_results: list[dict]) -> dict:
    """Identify the load step where SLO is first violated."""
    for i, step in enumerate(step_results):
        if step["p99_ms"] > 2000 or step["error_rate"] > 0.05:
            prev = step_results[i - 1] if i > 0 else None
            return {
                "breakpoint_rps": step["rps"],
                "last_healthy_rps": prev["rps"] if prev else 0,
                "failure_mode": "latency" if step["p99_ms"] > 2000 else "errors",
                "p99_at_break": step["p99_ms"],
                "error_rate_at_break": step["error_rate"],
            }
    return {"breakpoint_rps": "not reached", "system_held": True}
```

## Spike Testing

Simulate a sudden traffic surge -- flash sale, viral post, DDoS burst.

```javascript
// k6: Spike test -- instant jump to 10x load
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },    // Normal load
        { duration: '5m', target: 50 },    // Sustain normal
        { duration: '10s', target: 500 },  // SPIKE: 10x in 10 seconds
        { duration: '3m', target: 500 },   // Hold spike
        { duration: '10s', target: 50 },   // Drop back to normal
        { duration: '5m', target: 50 },    // Recovery period -- does it recover?
        { duration: '1m', target: 0 },     // Ramp down
      ],
    },
  },
};

export default function () {
  const res = http.get('https://api.example.com/products');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'no server errors': (r) => r.status < 500,
  });
  sleep(1);
}
// Key metric: Recovery time -- how long until p95 returns to pre-spike levels?
```

```yaml
# Artillery: Spike test
config:
  target: "https://api.example.com"
  phases:
    - duration: 120
      arrivalRate: 10
      name: "Normal load"
    - duration: 10
      arrivalRate: 200
      name: "Spike"
    - duration: 180
      arrivalRate: 200
      name: "Sustained spike"
    - duration: 10
      arrivalRate: 10
      name: "Return to normal"
    - duration: 300
      arrivalRate: 10
      name: "Recovery observation"

scenarios:
  - flow:
      - get:
          url: "/products"
```

## Soak / Endurance Testing

Run moderate load for hours to detect slow resource leaks.

```javascript
// k6: 8-hour soak test at 70% capacity
export const options = {
  scenarios: {
    soak: {
      executor: 'constant-arrival-rate',
      rate: 200,            // 200 RPS (70% of 285 RPS breakpoint)
      timeUnit: '1s',
      duration: '8h',
      preAllocatedVUs: 100,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};
```

**What to watch during soak tests:**

```python
# Monitor for memory leaks: RSS should stabilize, not grow linearly
def detect_memory_leak(memory_samples: list[dict]) -> dict:
    """Detect if memory usage grows linearly over time."""
    import numpy as np
    times = np.array([s["timestamp"] for s in memory_samples])
    mem = np.array([s["rss_mb"] for s in memory_samples])

    # Linear regression: slope > 0.1 MB/min = probable leak
    coeffs = np.polyfit(times, mem, 1)
    slope_mb_per_min = coeffs[0] * 60
    hours_to_oom = (max_memory_mb - mem[-1]) / (slope_mb_per_min * 60) if slope_mb_per_min > 0 else float('inf')

    return {
        "leak_detected": slope_mb_per_min > 0.1,
        "growth_rate_mb_per_min": round(slope_mb_per_min, 3),
        "hours_to_oom": round(hours_to_oom, 1),
        "start_rss_mb": round(mem[0], 1),
        "end_rss_mb": round(mem[-1], 1),
    }
```

**Common soak test findings:**
- Memory leaks: RSS grows linearly, OOM kill after hours
- Connection pool leaks: connections never returned, pool exhausted
- File descriptor leaks: open files grow, "too many open files" error
- Thread leaks: thread count grows, context switching degrades CPU
- Log file growth: disk fills, writes fail
- Certificate/token expiry: credentials expire mid-test

## Scalability Testing

Measure if throughput scales linearly with added resources.

```python
# Scalability analysis: linear vs sub-linear vs degraded scaling
def analyze_scalability(results: list[dict]) -> dict:
    """
    results: [{"instances": 1, "rps": 500}, {"instances": 2, "rps": 950}, ...]
    Perfect linear: 2 instances = 2x throughput
    """
    base = results[0]
    analysis = []
    for r in results:
        expected_linear = base["rps"] * (r["instances"] / base["instances"])
        efficiency = r["rps"] / expected_linear * 100
        analysis.append({
            "instances": r["instances"],
            "actual_rps": r["rps"],
            "expected_linear_rps": round(expected_linear),
            "scaling_efficiency": f"{efficiency:.1f}%",
        })
    return {
        "results": analysis,
        "bottleneck_at": next(
            (a["instances"] for a in analysis if float(a["scaling_efficiency"].rstrip('%')) < 70),
            "not reached"
        ),
    }

# Example output:
# instances: 1, actual: 500, expected: 500, efficiency: 100%
# instances: 2, actual: 950, expected: 1000, efficiency: 95%
# instances: 4, actual: 1700, expected: 2000, efficiency: 85%
# instances: 8, actual: 2800, expected: 4000, efficiency: 70% <-- bottleneck
```

**Common scalability bottlenecks:**
- Single database instance (vertical scaling limit)
- Shared lock / mutex contention
- Single-threaded components (Node.js event loop, Python GIL)
- Network bandwidth saturation
- Unsharded state (sessions stored on single node)

## Volume Testing

Test with extreme data sizes to find size-dependent failures.

```javascript
// k6: Volume test -- operations on large datasets
import http from 'k6/http';

export default function () {
  // Upload large payload
  const largePayload = JSON.stringify({
    items: Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `Product ${i}`,
      attributes: Array.from({ length: 50 }, (_, j) => ({
        key: `attr_${j}`,
        value: 'x'.repeat(100),
      })),
    })),
  });

  const res = http.post('https://api.example.com/bulk-import', largePayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '60s',
  });

  check(res, {
    'bulk import succeeds': (r) => r.status === 200,
    'completes within 30s': (r) => r.timings.duration < 30000,
  });
}
```

## Chaos Engineering Basics

Inject faults to verify resilience under failure conditions.

```yaml
# Kubernetes: Chaos Mesh -- kill a pod during load test
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-kill-during-stress
spec:
  action: pod-kill
  mode: one                      # Kill one pod
  selector:
    namespaces: ["production"]
    labelSelectors:
      app: "api-server"
  scheduler:
    cron: "@every 5m"            # Kill one pod every 5 minutes
  duration: "1s"
```

```typescript
// Application-level fault injection: circuit breaker verification
class FaultInjector {
  constructor(private failureRate: number = 0.0) {}
  setFailureRate(rate: number): void { this.failureRate = rate; }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (Math.random() < this.failureRate) throw new Error('Injected fault');
    return fn();
  }
}

// Stress test sequence:
// 1. injector.setFailureRate(0.0)  -> baseline (clean)
// 2. injector.setFailureRate(0.3)  -> 30% failures, verify circuit breaker opens
// 3. injector.setFailureRate(0.0)  -> recover, verify breaker closes within 30s
```

## Resilience Verification Matrix

| Failure Scenario | Expected Behavior | Verification |
|-----------------|-------------------|-------------|
| Database primary down | Failover to replica < 30s | p99 < 5s during failover |
| Cache (Redis) down | Fallback to DB, degraded latency | No 500 errors, p95 < 2s |
| Pod killed | Replacement pod within 30s | Zero dropped requests (via retry) |
| Network partition | Circuit breaker opens in 10s | Fallback responses served |
| Disk full | Graceful degradation, alert fires | No data corruption, 503 returned |
| DNS failure | Cached resolution used | No immediate impact for TTL duration |
| Memory pressure | OOM killer targets lowest priority | Critical services survive |
| CPU saturation (100%) | Request queuing, no crashes | Error rate < 5%, recovery in 60s |

## Stress Test Report Template

Every stress test must produce a report containing: test type, date, environment, duration, findings (breakpoint RPS, recovery time, memory leak status, scaling efficiency), identified bottlenecks, prioritized recommendations, and SLO violations with the load level at which each violation occurred.

```typescript
interface StressTestReport {
  testType: 'breakpoint' | 'spike' | 'soak' | 'scalability' | 'volume' | 'chaos';
  date: string;
  environment: string;
  findings: { breakpointRPS?: number; recoveryTimeSec?: number; memoryLeakDetected?: boolean };
  bottlenecks: string[];
  recommendations: string[];
  sloViolations: Array<{ metric: string; threshold: string; actual: string; atLoad: string }>;
}
```

---

## Best Practices

1. **Run breakpoint tests before capacity planning.** You cannot plan capacity without knowing the per-instance breaking point. Run stepwise load increases until p95 exceeds SLO or error rate exceeds 5%.
2. **Test spike recovery, not just spike survival.** A system that handles a 10x spike but takes 30 minutes to recover is effectively down. Measure time-to-recovery as a primary metric.
3. **Run soak tests for at least 8 hours.** Memory leaks that grow at 1MB/hour take hours to manifest. Connection pool leaks may take hundreds of requests to exhaust. 30-minute tests miss these.
4. **Inject one fault at a time during chaos tests.** Multiple simultaneous faults make root cause analysis impossible. Test each failure mode independently, then combine for advanced scenarios.
5. **Define pass/fail criteria before running the test.** "The system should handle 1000 RPS at p95 < 500ms with < 1% errors." Without predefined criteria, stress tests produce data but no decisions.
6. **Test auto-scaling before relying on it.** Verify that your auto-scaler triggers at the right threshold, scales fast enough, and that new instances become healthy before the old ones are overwhelmed.
7. **Monitor resource metrics alongside application metrics.** CPU at 95% explains why p99 spiked. Without infrastructure metrics, stress test results are symptoms without diagnosis.
8. **Run stress tests on the same infrastructure configuration as production.** Different instance types, network configs, or database sizes produce different breaking points.
9. **Test graceful degradation explicitly.** Verify that circuit breakers open, fallbacks activate, rate limiters engage, and health checks fail appropriately under stress.
10. **Document every stress test result.** Record environment, load profile, findings, bottlenecks, and recommendations. Historical results show whether system resilience improves or degrades over time.

---

## Anti-Patterns

1. **Stopping the test at the first error.** Stress tests are supposed to produce errors -- that is how you find the breaking point. Let the test run through the failure to characterize recovery behavior.
2. **Running soak tests at peak load.** Soak tests run at 60-70% capacity to detect slow leaks. Running at 100% capacity causes immediate failures that mask gradual degradation.
3. **Stress testing only the happy path.** Real failures cascade: database slows, which queues requests, which exhausts connections, which triggers retries, which amplifies load 3x. Test the cascade.
4. **Treating stress test results as permanent.** Code changes, dependency updates, and data growth change breaking points. Re-run stress tests quarterly and after major releases.
5. **Injecting chaos in production without a kill switch.** Every chaos experiment needs an immediate abort mechanism. One-click rollback. Blast radius containment. Runbook for reversal.
6. **Ignoring the cost of stress test infrastructure.** An 8-hour soak test on 20 large cloud instances costs real money. Budget for it. Do not skip stress testing because of cost.
7. **Testing scalability without identifying the bottleneck.** Adding instances does not help if the bottleneck is a single database. Profile to find the constraint before scaling horizontally.
8. **Assuming auto-recovery means resilience.** A system that OOM-kills and restarts every 4 hours is not resilient -- it has a memory leak. Auto-restart masks the underlying defect.

---

## Enforcement Checklist

- [ ] Breakpoint test identifies per-instance capacity with documented RPS threshold
- [ ] Spike test verifies recovery to pre-spike latency within defined SLO (e.g., 60 seconds)
- [ ] Soak test runs 8+ hours; memory, connections, and file descriptors tracked for growth
- [ ] Scalability test measures efficiency percentage at 2x, 4x, 8x instance count
- [ ] Volume test confirms system handles 2x current data size without SLO violation
- [ ] Chaos experiments cover: pod kill, network delay, dependency failure, disk full
- [ ] Circuit breakers verified: open under fault, serve fallback, close after recovery
- [ ] Auto-scaling verified: triggers at correct threshold, scales within SLO
- [ ] Stress test report documents: findings, bottlenecks, recommendations, SLO violations
- [ ] All stress tests have predefined pass/fail criteria established before execution
