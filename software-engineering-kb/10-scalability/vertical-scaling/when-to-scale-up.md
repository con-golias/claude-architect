# When to Scale Up

> **Domain:** Scalability > Vertical Scaling
> **Importance:** High
> **Last Updated:** 2025

## Vertical vs Horizontal: Decision Framework

```
                        Vertical (Scale Up)                Horizontal (Scale Out)
Cost curve:             Linear → Exponential               Linear (commodity hardware)
Ceiling:                Hard limit (largest instance)       Soft limit (add more nodes)
Complexity:             Low (single machine)                High (distributed systems)
Downtime:               Usually required for resize         Zero-downtime add/remove
Data consistency:       Simple (single node)                Complex (distributed state)
Best for:               Small-medium scale                  Large scale
```

### Decision Tree

```
Is your workload distributed/stateless?
├── YES → Scale horizontally (add instances behind LB)
└── NO → Can it be made stateless?
    ├── YES (reasonable effort) → Refactor, then scale horizontally
    └── NO (fundamental constraint) → Scale vertically
        └── Hitting vertical ceiling?
            ├── NO → Scale up (bigger instance)
            └── YES → Must re-architect for horizontal scaling
```

## Workloads That Benefit from Vertical Scaling

### Single-Threaded Applications

```
Redis (single-threaded command processing):
  - Scale up: Bigger CPU = faster operations
  - Horizontal alternative: Redis Cluster (complexity cost)

PostgreSQL (single query = single core):
  - Complex queries benefit from faster CPU
  - More RAM = larger buffer pool = fewer disk reads
```

### In-Memory Databases

```
Workload: 500 GB dataset must fit in memory
Options:
  A) Vertical: r7i.16xlarge (512 GB RAM) — Simple, single node
  B) Horizontal: 8x r7i.2xlarge (64 GB each) — Complex sharding

Decision: Vertical wins when dataset < largest instance RAM
```

### Latency-Sensitive Workloads

```python
# Single-threaded hot path: vertical scaling reduces latency
# Going from 2.5 GHz → 3.5 GHz = 40% faster per-request
# Horizontal scaling doesn't help: each request still hits one core

# Example: Real-time trading system
class OrderMatcher:
    def match(self, order: Order) -> list[Trade]:
        # This runs on ONE core, must be fast
        # Faster CPU = lower matching latency
        matches = self.order_book.find_matches(order)
        return self.execute_trades(matches)
```

### Legacy Applications

Cannot be easily distributed. Scale up until migration is feasible.

## Cost Comparison

```python
# Cost comparison model
def cost_analysis(workload_rps: int):
    """Compare vertical vs horizontal cost for given throughput."""
    # Vertical: bigger instance
    vertical_options = [
        {"type": "m7i.xlarge",   "rps": 500,   "cost_hr": 0.20},
        {"type": "m7i.2xlarge",  "rps": 1100,  "cost_hr": 0.40},
        {"type": "m7i.4xlarge",  "rps": 2400,  "cost_hr": 0.81},
        {"type": "m7i.8xlarge",  "rps": 4500,  "cost_hr": 1.61},
        {"type": "m7i.16xlarge", "rps": 8000,  "cost_hr": 3.22},
    ]

    # Horizontal: multiple small instances + LB
    horizontal = {
        "instance": "m7i.xlarge",
        "rps_per": 500,
        "cost_per_hr": 0.20,
        "lb_cost_hr": 0.025,
        "instances_needed": (workload_rps // 500) + 1,
    }

    # Find cheapest vertical option
    vertical_match = next(
        (v for v in vertical_options if v["rps"] >= workload_rps), None
    )

    h_cost = (horizontal["instances_needed"] * horizontal["cost_per_hr"]
              + horizontal["lb_cost_hr"])
    v_cost = vertical_match["cost_hr"] if vertical_match else float('inf')

    return {
        "vertical_cost": v_cost,
        "horizontal_cost": h_cost,
        "recommendation": "vertical" if v_cost < h_cost else "horizontal",
    }

# Crossover point: vertical cheaper below ~2000 RPS for this instance type
```

**General rule:** Vertical is cheaper at small scale, horizontal becomes cheaper as you grow beyond mid-range instances.

## Vertical Ceiling Limits (Cloud Providers)

| Provider | Largest General | vCPUs | RAM | Network |
|----------|----------------|-------|-----|---------|
| AWS | u-24tb1.112xlarge | 448 | 24 TB | 100 Gbps |
| GCP | m3-megamem-128 | 128 | 1.9 TB | 100 Gbps |
| Azure | M416ms_v2 | 416 | 11.4 TB | 50 Gbps |

**Practical ceiling:** Most applications hit diminishing returns well before the largest instance.

## Diagonal Scaling Strategy

**Scale up first, then out.** Get maximum value from each instance before adding complexity.

```
Phase 1: Start with small instance (m7i.large, 2 vCPU, 8 GB)
Phase 2: Scale UP to medium (m7i.2xlarge, 8 vCPU, 32 GB) — No code changes
Phase 3: Scale UP to large (m7i.4xlarge, 16 vCPU, 64 GB) — Still no code changes
Phase 4: Scale OUT to 3x medium instances — Add LB, externalize state
Phase 5: Scale BOTH as needed — Optimal instance size × N instances
```

```go
// Diagonal scaling: optimize per-instance before adding more
// Step 1: Profile and optimize on current instance
// Step 2: Scale up the instance (zero code changes)
// Step 3: When vertical ceiling hit OR cost inefficient, add instances

func scalingDecision(currentUtilization float64, currentInstanceSize string) string {
    switch {
    case currentUtilization < 0.5:
        return "right-size DOWN — over-provisioned"
    case currentUtilization < 0.7:
        return "optimal — monitor"
    case currentUtilization < 0.85:
        return "scale UP to next instance size"
    default:
        return "scale OUT — add instances behind load balancer"
    }
}
```

## Database Vertical Scaling

Always try vertical scaling before sharding:

```
Scaling ladder for databases:
1. Query optimization (free)
2. Add indexes (free)
3. Connection pooling (PgBouncer)
4. Read replicas (moderate complexity)
5. Scale UP — bigger instance, more RAM (zero code changes)
6. Partitioning (moderate complexity)
7. Sharding (high complexity — LAST RESORT)
```

```sql
-- Check if database needs vertical scaling
-- PostgreSQL: check buffer hit ratio
SELECT
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio
FROM pg_statio_user_tables;
-- If < 0.99, consider more RAM for shared_buffers

-- Check I/O pressure
SELECT * FROM pg_stat_bgwriter;
-- High buffers_checkpoint suggests I/O bottleneck
```

## Right-Sizing Methodology

```typescript
// Collect metrics over 2+ weeks, find optimal size
interface UtilizationMetrics {
  cpuP95: number;      // Target: 60-70%
  memoryP95: number;   // Target: 70-80%
  networkP95: number;  // Target: <50%
  diskIopsP95: number; // Target: <70% of provisioned
}

function rightSizeRecommendation(metrics: UtilizationMetrics): string {
  if (metrics.cpuP95 < 0.3 && metrics.memoryP95 < 0.3) {
    return 'DOWNSIZE: Over-provisioned by 2x+';
  }
  if (metrics.cpuP95 > 0.85 || metrics.memoryP95 > 0.9) {
    return 'UPSIZE: Resource pressure detected';
  }
  return 'RIGHT-SIZED: Current instance optimal';
}
```

## Best Practices

1. **Profile before scaling** — find the actual bottleneck (CPU, memory, I/O)
2. **Try optimization before scaling** — query tuning, caching, connection pooling
3. **Use diagonal scaling** — scale up first (simpler), then scale out when needed
4. **Right-size quarterly** — analyze P95 utilization over 2+ weeks
5. **Scale databases vertically before sharding** — sharding adds massive complexity
6. **Use reserved instances for steady-state** — 30-70% savings for known capacity
7. **Monitor diminishing returns** — 2x cost should yield >1.5x performance
8. **Plan for vertical ceiling** — know when you must switch to horizontal
9. **Test scaling with realistic data** — benchmark at current and 2x data volume
10. **Document scaling decisions** — record what was tried, measured, decided

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Sharding before optimizing | Massive complexity too early | Optimize → scale up → then shard |
| Scaling up without profiling | Wrong resource scaled | Profile CPU/mem/IO first |
| Largest instance by default | 5-10x unnecessary cost | Start small, scale up as needed |
| Never reviewing instance size | Permanent over-provisioning | Quarterly right-sizing review |
| Vertical only strategy | Hits hard ceiling eventually | Plan horizontal transition point |
| Ignoring application optimization | Throwing money at bad code | Optimize code before hardware |
| Same instance type for all services | Suboptimal price/performance | Match family to workload |
| No benchmark before/after | Cannot prove scaling value | Measure before and after every change |

## Enforcement Checklist

- [ ] Application profiled to identify resource bottleneck
- [ ] Optimization attempts documented before scaling
- [ ] Instance family matches workload type
- [ ] P95 utilization monitored and reviewed quarterly
- [ ] Vertical ceiling identified for current workload
- [ ] Horizontal scaling plan prepared for when ceiling is reached
- [ ] Cost comparison documented (vertical vs horizontal)
- [ ] Reserved instances purchased for stable baseline capacity
