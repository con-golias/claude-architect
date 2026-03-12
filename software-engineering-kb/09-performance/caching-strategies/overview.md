# Caching Performance Engineering Overview

> Domain: Performance Engineering > Caching Strategy
> Importance: CRITICAL
> Complements: 06-backend/caching/ (implementation patterns) — this doc covers performance measurement, hierarchy, and decision frameworks

**Core Rule: EVERY caching decision MUST be driven by measured latency, throughput, and hit ratio data. NEVER cache speculatively — profile first, cache second. ALWAYS define target hit ratios and measure against them.**

---

## 1. Memory Hierarchy and Access Latency

```
┌────────────────────────────────────────────────────────────────┐
│  Memory Hierarchy — Latency Reference (approximate)           │
│                                                                │
│  L1 CPU Cache      ~1 ns       0.5-1 KB line     per-core    │
│  L2 CPU Cache      ~4 ns       64 KB-1 MB        per-core    │
│  L3 CPU Cache      ~12 ns      2-64 MB           shared      │
│  RAM (DRAM)        ~100 ns     GB range           per-server  │
│  In-process cache  ~200 ns     bounded LRU/LFU    per-process │
│  Redis (local)     ~0.5 ms     GB range           shared      │
│  Redis (network)   ~1-5 ms     GB range           distributed │
│  SSD read          ~100 us     TB range           persistent  │
│  Database query    ~1-50 ms    unlimited           persistent  │
│  Network API call  ~10-500 ms  external            remote      │
│  CDN edge hit      ~5-20 ms    TB range           global      │
│  CDN origin fetch  ~50-300 ms  TB range           centralized │
│                                                                │
│  Rule of thumb: each tier is 5-100x slower than the one above │
└────────────────────────────────────────────────────────────────┘
```

## 2. Caching Taxonomy

| Dimension | Options | Performance Impact |
|-----------|---------|-------------------|
| **Location** | Client, CDN edge, reverse proxy, app process, distributed (Redis), DB query cache | Closer to client = lower latency |
| **Scope** | Request-scoped, process-scoped, cluster-scoped, global | Wider scope = more sharing, more invalidation cost |
| **Strategy** | Cache-aside, read-through, write-through, write-behind | Determines read vs write tradeoff |
| **Eviction** | LRU, LFU, TTL, size-based | Determines cache effectiveness under pressure |
| **Consistency** | Strong, eventual, stale-while-revalidate | Stricter = more overhead |

## 3. When to Cache vs Not Cache

```typescript
// Decision framework — implement as a code review checklist
interface CacheDecision {
  shouldCache: boolean;
  reason: string;
  estimatedHitRatio: number;
  ttl: number;
}

function evaluateCacheNeed(access: AccessPattern): CacheDecision {
  // CACHE when ALL conditions met:
  // 1. Read-to-write ratio > 10:1
  // 2. Computation cost > 5ms
  // 3. Data changes infrequently relative to reads
  // 4. Staleness tolerance exists (even 1 second)
  // 5. Working set fits in memory budget

  if (access.readWriteRatio < 10)
    return { shouldCache: false, reason: "Write-heavy: ratio < 10:1", estimatedHitRatio: 0, ttl: 0 };
  if (access.computationCostMs < 5)
    return { shouldCache: false, reason: "Cheap to compute: < 5ms", estimatedHitRatio: 0, ttl: 0 };
  if (access.uniqueKeysPerHour > access.memoryBudgetEntries)
    return { shouldCache: false, reason: "Working set exceeds memory budget", estimatedHitRatio: 0, ttl: 0 };
  if (access.stalenessToleranceMs === 0)
    return { shouldCache: false, reason: "Zero staleness tolerance", estimatedHitRatio: 0, ttl: 0 };

  const estimatedHitRatio = Math.min(0.99,
    access.readWriteRatio / (access.readWriteRatio + 1) *
    (access.memoryBudgetEntries / access.uniqueKeysPerHour));
  const ttl = Math.min(access.stalenessToleranceMs / 1000, 3600);

  return { shouldCache: true, reason: "Meets all criteria", estimatedHitRatio, ttl };
}
```

**DO NOT cache:** write-heavy data, security-sensitive data (tokens, passwords), rapidly-changing unique data (stock ticks per-user), data with zero staleness tolerance, cheap-to-compute results.

```go
// Go — cache decision helper
type AccessPattern struct {
    ReadWriteRatio        float64
    ComputationCostMs     float64
    UniqueKeysPerHour     int
    MemoryBudgetEntries   int
    StalenessTolerance    time.Duration
}

func ShouldCache(ap AccessPattern) (bool, string) {
    if ap.ReadWriteRatio < 10 {
        return false, "write-heavy workload"
    }
    if ap.ComputationCostMs < 5 {
        return false, "cheap to compute"
    }
    if ap.UniqueKeysPerHour > ap.MemoryBudgetEntries {
        return false, "working set exceeds memory"
    }
    if ap.StalenessTolerance == 0 {
        return false, "zero staleness tolerance"
    }
    return true, "all criteria met"
}
```

```python
# Python — cache decision framework
from dataclasses import dataclass

@dataclass
class CacheDecision:
    should_cache: bool
    reason: str
    estimated_hit_ratio: float
    recommended_ttl: int

def evaluate_cache_need(
    read_write_ratio: float,
    computation_cost_ms: float,
    unique_keys_per_hour: int,
    memory_budget_entries: int,
    staleness_tolerance_sec: float,
) -> CacheDecision:
    if read_write_ratio < 10:
        return CacheDecision(False, "Write-heavy: ratio < 10:1", 0.0, 0)
    if computation_cost_ms < 5:
        return CacheDecision(False, "Cheap computation: < 5ms", 0.0, 0)
    if staleness_tolerance_sec == 0:
        return CacheDecision(False, "Zero staleness tolerance", 0.0, 0)

    hit_ratio = min(0.99, read_write_ratio / (read_write_ratio + 1))
    ttl = min(int(staleness_tolerance_sec), 3600)
    return CacheDecision(True, "All criteria met", hit_ratio, ttl)
```

## 4. Cache Hit Ratio Targets and Measurement

```
Target hit ratios by cache tier:
├── Browser cache:      > 85% (static assets should approach 99%)
├── CDN edge cache:     > 90% for static, > 60% for API responses
├── Application cache:  > 80% overall, > 95% for hot paths
├── Database query cache: > 70% (invalidation is expensive)
│
│  Hit ratio < 50% means the cache is consuming resources without benefit.
│  Investigate: wrong data cached, TTL too short, working set too large.
```

```typescript
// Cache performance measurement wrapper
class InstrumentedCache<T> {
  private hits = 0;
  private misses = 0;
  private latencyHistogram: Histogram;

  constructor(private inner: CacheBackend<T>, private name: string) {
    this.latencyHistogram = new Histogram({ name: `cache_${name}_latency_ms`, buckets: [0.1, 0.5, 1, 5, 10, 50] });
    // Emit hit ratio every 60s
    setInterval(() => this.emitMetrics(), 60_000);
  }

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const cached = await this.inner.get(key);

    if (cached !== undefined) {
      this.hits++;
      this.latencyHistogram.observe(performance.now() - start);
      return cached;
    }

    this.misses++;
    const data = await fetcher();
    await this.inner.set(key, data);
    this.latencyHistogram.observe(performance.now() - start);
    return data;
  }

  private emitMetrics(): void {
    const total = this.hits + this.misses;
    if (total === 0) return;
    const hitRatio = this.hits / total;
    metrics.gauge(`cache.${this.name}.hit_ratio`, hitRatio);
    metrics.gauge(`cache.${this.name}.total_ops`, total);
    this.hits = 0;
    this.misses = 0;
  }
}
```

```go
// Go — cache hit ratio tracking
type CacheMetrics struct {
    hits   atomic.Int64
    misses atomic.Int64
    name   string
}

func (m *CacheMetrics) RecordHit()  { m.hits.Add(1) }
func (m *CacheMetrics) RecordMiss() { m.misses.Add(1) }

func (m *CacheMetrics) HitRatio() float64 {
    h, mi := m.hits.Load(), m.misses.Load()
    total := h + mi
    if total == 0 { return 0 }
    return float64(h) / float64(total)
}
```

## 5. Performance Impact Measurement

```
Before adding a cache, measure:
1. Baseline latency (p50, p95, p99) without cache
2. Database/origin load (QPS, CPU, connections)
3. After caching, measure:
   - Latency reduction at each percentile
   - Origin load reduction
   - Cache hit ratio over time
   - Memory consumption
   - Tail latency on cache miss (cold path)

Expected improvements:
├── p50 latency:  2-10x reduction
├── p99 latency:  5-50x reduction (removes DB variance)
├── Origin load:  proportional to hit ratio (90% hit = 90% reduction)
└── Cost:         cache infra cost vs saved DB/compute cost
```

```python
# Python — A/B measurement of cache effectiveness
import time
from dataclasses import dataclass, field

@dataclass
class CacheBenchmark:
    cached_latencies: list[float] = field(default_factory=list)
    uncached_latencies: list[float] = field(default_factory=list)

    def measure_cached(self, cache, key: str, fetcher):
        start = time.perf_counter()
        result = cache.get(key, fetcher)
        self.cached_latencies.append((time.perf_counter() - start) * 1000)
        return result

    def measure_uncached(self, fetcher):
        start = time.perf_counter()
        result = fetcher()
        self.uncached_latencies.append((time.perf_counter() - start) * 1000)
        return result

    def report(self) -> dict:
        import statistics
        return {
            "cached_p50": statistics.median(self.cached_latencies),
            "cached_p99": statistics.quantiles(self.cached_latencies, n=100)[98],
            "uncached_p50": statistics.median(self.uncached_latencies),
            "uncached_p99": statistics.quantiles(self.uncached_latencies, n=100)[98],
            "speedup_p50": statistics.median(self.uncached_latencies) / statistics.median(self.cached_latencies),
        }
```

## 6. Cache Sizing Framework

```
Sizing formula:
  required_memory = active_keys * avg_value_size * overhead_factor
  overhead_factor = 1.5 (Redis), 1.2 (in-process), 2.0 (fragmented workload)

  active_keys = unique_keys_accessed_per_TTL_window
  NOT total keys ever written — only keys accessed within one TTL period

Example:
  50K unique users active per hour, profile = 2KB, TTL = 15min
  active_keys_per_TTL = 50K * (15/60) = 12.5K
  memory = 12,500 * 2KB * 1.5 = ~37.5 MB
  Provision: 64 MB (with headroom for spikes)
```

## 7. Caching Decision Matrix

| Signal | Cache Locally | Cache in Redis | Cache at CDN | Do Not Cache |
|--------|--------------|----------------|-------------|--------------|
| Read:write > 100:1, < 1MB values | If single process | If multi-instance | If public content | -- |
| Read:write 10-100:1 | Hot paths only | General recommendation | Static assets | -- |
| Read:write < 10:1 | -- | Write-through only | -- | Default choice |
| User-specific data | In-process LRU | Redis with user-key | `private` only | Auth tokens |
| Global data | Process LRU | Redis shared | CDN `public` | Realtime prices |
| > 1MB values | Avoid (GC pressure) | Compress first | CDN (designed for it) | -- |

---

## 8. Best Practices

1. **Measure before caching** — profile to confirm the bottleneck is data fetch latency, not computation or network.
2. **Set explicit hit ratio targets** — 80% minimum for application cache, 90% for CDN, 95% for hot-path process cache.
3. **Size caches to working set** — calculate active keys per TTL window, not total dataset size.
4. **Use tiered caching** — L1 (process, microseconds) + L2 (Redis, milliseconds) for latency-critical paths.
5. **Always instrument** — track hit ratio, latency by hit vs miss, eviction rate, and memory utilization.
6. **Cache closest to consumer** — browser > CDN > reverse proxy > app process > distributed cache.
7. **Budget memory explicitly** — assign each cache a memory cap and monitor utilization against it.
8. **Right-size TTLs by data volatility** — 1s for real-time, 5min for profiles, 1yr for hashed assets.
9. **Profile tail latency on miss** — cache miss + populate path is slower than no-cache path; measure it.
10. **Review cache ROI quarterly** — hit ratio < 50% means the cache costs more than it saves.

## 9. Anti-Patterns

1. **Caching without measurement** — adding cache "just in case" with no baseline latency data; wastes memory.
2. **Caching everything** — low hit ratio, memory pressure, eviction storms; cache only the hot 20%.
3. **Single-tier caching** — Redis-only ignoring in-process cache; adds 1-5ms per request unnecessarily.
4. **Ignoring cache miss penalty** — miss path includes cache lookup + origin fetch; slower than direct fetch.
5. **No memory budget** — caches grow unbounded until OOM; always set maxmemory or max entries.
6. **Uniform TTL** — same TTL for all data types regardless of volatility; causes staleness or low hit ratio.
7. **Caching write-heavy data** — read:write ratio < 5:1 means constant invalidation; cache is churning.
8. **No eviction monitoring** — high eviction rate means cache is undersized; data thrashes in and out.

## 10. Enforcement Checklist

- [ ] Baseline latency (p50/p95/p99) measured before adding cache
- [ ] Cache hit ratio target defined and monitored (minimum 80%)
- [ ] Memory budget calculated: active_keys * avg_size * overhead_factor
- [ ] Cache tier selected based on access pattern (process / Redis / CDN)
- [ ] TTL set per data type based on measured volatility
- [ ] Instrumentation emitting: hit_ratio, latency_hit, latency_miss, eviction_rate
- [ ] Cache miss penalty measured (must not exceed 2x uncached latency)
- [ ] Working set analysis performed (unique keys per TTL window)
- [ ] Memory utilization alert at 80% of budget
- [ ] Quarterly ROI review scheduled
