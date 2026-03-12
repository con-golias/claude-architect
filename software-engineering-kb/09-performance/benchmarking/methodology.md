# Benchmarking Methodology

> **Domain:** Performance > Benchmarking > Methodology
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Why It Matters

A benchmark without methodology is noise. Performance measurements without statistical rigor produce false confidence, missed regressions, and wasted optimization effort. Every production incident traced to "we tested it and it was fine" stems from flawed methodology: wrong environment, insufficient samples, ignored variance, or missing warm-up. Rigorous benchmarking requires controlled environments, statistical significance, correct percentile reporting, and reproducible procedures.

---

## Baseline Establishment

Establish a baseline before optimizing. A baseline is a reproducible measurement of current performance under defined conditions.

```typescript
// Baseline measurement structure
interface Benchmark {
  name: string;
  timestamp: string;
  environment: { cpu: string; memory: string; os: string; runtime: string };
  config: { warmupIterations: number; measuredIterations: number; concurrency: number };
  results: {
    p50: number; p95: number; p99: number; p999: number;
    mean: number; stddev: number; min: number; max: number;
    throughput: number; errorRate: number;
    sampleSize: number; confidenceInterval95: [number, number];
  };
}
```

```python
# Python baseline capture with statistical analysis
import time, statistics, math

def benchmark(fn, *, warmup=100, iterations=1000):
    """Run fn with warmup, collect latency samples, compute stats."""
    for _ in range(warmup):
        fn()  # JIT/cache warming

    latencies = []
    for _ in range(iterations):
        start = time.perf_counter_ns()
        fn()
        latencies.append((time.perf_counter_ns() - start) / 1e6)  # ms

    latencies.sort()
    n = len(latencies)
    mean = statistics.mean(latencies)
    stddev = statistics.stdev(latencies)
    sem = stddev / math.sqrt(n)  # standard error of the mean
    ci95 = (mean - 1.96 * sem, mean + 1.96 * sem)

    return {
        "p50": latencies[int(n * 0.50)],
        "p95": latencies[int(n * 0.95)],
        "p99": latencies[int(n * 0.99)],
        "p999": latencies[int(n * 0.999)] if n >= 1000 else None,
        "mean": round(mean, 3),
        "stddev": round(stddev, 3),
        "ci95": (round(ci95[0], 3), round(ci95[1], 3)),
        "samples": n,
    }
```

## Statistical Significance

Never compare two benchmarks by mean alone. Use confidence intervals and hypothesis testing.

```go
// Go: Compute whether two benchmark runs differ significantly
package bench

import "math"

type Stats struct {
    Mean, Stddev float64
    N            int
}

// WelchTTest returns t-statistic and approximate degrees of freedom.
// |t| > 2.0 with df > 30 indicates significance at p < 0.05.
func WelchTTest(a, b Stats) (t float64, df float64) {
    sA := a.Stddev * a.Stddev / float64(a.N)
    sB := b.Stddev * b.Stddev / float64(b.N)
    t = (a.Mean - b.Mean) / math.Sqrt(sA+sB)
    num := (sA + sB) * (sA + sB)
    den := (sA*sA)/float64(a.N-1) + (sB*sB)/float64(b.N-1)
    df = num / den
    return t, df
}
```

**Rule of thumb:** If 95% confidence intervals of two measurements overlap, the difference is likely not significant. Run at least 30 samples for the Central Limit Theorem to apply.

## Percentile Reporting

Mean hides tail latency. Always report p50, p95, p99, and p99.9.

| Percentile | Meaning | Why It Matters |
|------------|---------|----------------|
| p50 (median) | Half of requests are faster | Typical user experience |
| p95 | 1 in 20 requests is slower | SLO boundary for most services |
| p99 | 1 in 100 requests is slower | Reveals GC pauses, lock contention |
| p99.9 | 1 in 1000 requests is slower | Reveals worst-case resource exhaustion |

```javascript
// k6: Percentile thresholds
export const options = {
  thresholds: {
    http_req_duration: [
      'p(50)<200',   // median under 200ms
      'p(95)<500',   // 95th percentile under 500ms
      'p(99)<1000',  // 99th percentile under 1s
      'p(99.9)<2000' // 99.9th percentile under 2s
    ],
  },
};
```

## Warm-Up Periods

JIT compilers (JVM, V8, .NET) optimize hot paths after repeated execution. Caches (CPU L1/L2/L3, OS page cache, DB buffer pool) need filling. Benchmarks without warm-up measure cold-start, not steady-state.

```typescript
// Node.js: V8 JIT warm-up before measurement
function warmUp(fn: () => void, iterations: number = 5000): void {
  for (let i = 0; i < iterations; i++) fn();
  // Force V8 optimization: function is now "hot"
  // %OptimizeFunctionOnNextCall(fn); // --allow-natives-syntax only
}
```

```go
// Go: Benchmark with built-in warm-up via testing.B
func BenchmarkParsing(b *testing.B) {
    input := loadFixture()
    b.ResetTimer() // Exclude setup from measurement
    for i := 0; i < b.N; i++ {
        Parse(input) // b.N increases until timing stabilizes
    }
}
```

## Environment Isolation

Noisy neighbors invalidate results. Isolate benchmarks from background processes, thermal throttling, and resource contention.

**Rules:**
1. Pin CPU frequency: disable turbo boost and frequency scaling
2. Pin to specific CPU cores: `taskset -c 0-3 ./benchmark`
3. Disable swap: memory pressure causes unpredictable latency spikes
4. Close all other applications; disable cron jobs
5. Run bare-metal or dedicated VMs -- never shared cloud instances for microbenchmarks
6. Run multiple iterations and discard outliers beyond 3 standard deviations

```bash
# Linux: Isolate benchmark environment
sudo cpupower frequency-set -g performance      # Fixed CPU frequency
sudo swapoff -a                                  # Disable swap
taskset -c 0-3 ./benchmark                      # Pin to cores 0-3
echo 1 > /proc/sys/vm/drop_caches               # Clear page cache (before run)
```

## Microbenchmarking Pitfalls

1. **Dead code elimination:** Compiler removes computation whose result is unused. Always consume the result.
2. **Constant folding:** Compiler precomputes expressions with known inputs. Use runtime-variable inputs.
3. **Loop hoisting:** Compiler moves invariant code outside the loop. Vary inputs per iteration.
4. **Measurement overhead:** `Date.now()` has ~1ms resolution. Use `performance.now()` or `process.hrtime.bigint()`.
5. **GC interference:** Force GC between runs, or measure enough iterations that GC is amortized.

```go
// Go: Prevent dead code elimination with compiler sink
var result int // package-level to prevent optimization

func BenchmarkCompute(b *testing.B) {
    for i := 0; i < b.N; i++ {
        result = compute(i) // result escapes -- compiler cannot eliminate
    }
}
```

## Amdahl's Law

Speedup is limited by the sequential fraction. If 10% of work is sequential, maximum speedup with infinite parallelism is 10x.

```
Speedup(s, p) = 1 / (s + (1-s)/p)
  s = sequential fraction (0.0 to 1.0)
  p = number of processors

Example: s=0.05 (5% sequential), p=32 cores
  Speedup = 1 / (0.05 + 0.95/32) = 1 / 0.0797 = 12.55x (not 32x)
```

**Implication:** Profile first. Find the sequential bottleneck. Parallelizing already-parallel code yields diminishing returns.

## Little's Law

`L = lambda * W` -- the average number of items in a system (L) equals the arrival rate (lambda) times the average wait time (W).

```
If average response time = 200ms and throughput = 500 req/s:
  L = 500 * 0.2 = 100 concurrent requests in the system

To handle 2000 req/s at 200ms response time:
  L = 2000 * 0.2 = 400 concurrent connections needed
```

Use Little's Law to size connection pools, thread pools, and worker counts.

## Regression Detection in CI/CD

```yaml
# GitHub Actions: Benchmark regression check
- name: Run benchmarks
  run: go test -bench=. -benchmem -count=5 ./... | tee new.txt
- name: Compare with baseline
  uses: bencherdev/bencher@main
  with:
    command: |
      benchstat baseline.txt new.txt
      # Fail if any benchmark regresses by more than 5%
```

```python
# Regression detection logic
def detect_regression(baseline: dict, current: dict, threshold: float = 0.05):
    """Flag if current p99 exceeds baseline p99 by more than threshold."""
    for endpoint, base in baseline.items():
        curr = current.get(endpoint)
        if not curr:
            continue
        change = (curr["p99"] - base["p99"]) / base["p99"]
        if change > threshold:
            raise RegressionError(
                f"{endpoint}: p99 regressed {change:.1%} "
                f"({base['p99']:.1f}ms -> {curr['p99']:.1f}ms)"
            )
```

## Comparative Benchmarking (Before/After)

Always compare against the same baseline under identical conditions. Run A then B then A then B (interleaved) to cancel drift.

```bash
# benchstat: Go's standard tool for benchmark comparison
# Run before and after, 5 iterations each
go test -bench=BenchmarkServe -count=5 ./... > before.txt
# Apply optimization
go test -bench=BenchmarkServe -count=5 ./... > after.txt
benchstat before.txt after.txt
# Output shows delta with confidence interval and p-value
```

---

## Best Practices

1. **Collect at least 30 samples per benchmark.** Central Limit Theorem requires n>=30 for the sampling distribution to approximate normal. Below 30, confidence intervals are unreliable.
2. **Report p50, p95, p99, p99.9 -- never mean alone.** Mean masks bimodal distributions and tail latency. A service with 10ms mean but 5s p99 is broken.
3. **Warm up before measuring.** Run 1000+ warm-up iterations for JIT-compiled languages. Verify by checking that iteration-over-iteration variance has stabilized.
4. **Isolate the benchmark environment.** Pin CPU frequency, disable swap, pin to cores, close background processes. Shared cloud VMs add 10-30% variance.
5. **Use monotonic clocks.** `performance.now()` (JS), `time.perf_counter_ns()` (Python), `time.Now()` (Go), `System.nanoTime()` (Java). Never `Date.now()` or wall-clock time.
6. **Prevent compiler optimizations from eliminating measured code.** Assign results to package-level variables (Go), use `benchmark::black_box()` (Rust), read volatile (Java).
7. **Automate regression detection in CI.** Store baselines in version control. Fail the build on statistically significant regressions exceeding the threshold (typically 5%).
8. **Interleave A/B measurements.** Run old-new-old-new to cancel environmental drift, thermal throttling, and GC scheduling differences.
9. **Apply Amdahl's Law before parallelizing.** Profile sequential fraction first. If 20% is sequential, maximum speedup is 5x regardless of core count.
10. **Use Little's Law for capacity math.** L = lambda * W sizes connection pools, thread pools, and queue depths from throughput and latency targets.

---

## Anti-Patterns

1. **Benchmarking on a developer laptop with Slack, Chrome, and Spotify running.** Background processes steal CPU and cause context switches. Results vary 20-50% between runs. Use dedicated hardware or isolated containers.
2. **Comparing means without confidence intervals.** "Before: 45ms, After: 43ms -- 4.4% improvement!" -- this difference is likely noise. Without CI and p-values, the measurement is meaningless.
3. **Skipping warm-up on JVM/V8/.NET.** First 1000 requests hit the interpreter, not JIT-compiled code. Measuring cold-start as steady-state overstates latency by 2-10x.
4. **Running benchmarks once.** A single run captures one sample of a noisy distribution. Run 30+ iterations minimum.
5. **Measuring wall-clock time with Date.now().** Resolution is 1ms (or worse with timer coarsening). `performance.now()` provides sub-millisecond resolution.
6. **Ignoring GC pauses in latency.** GC pauses appear as p99/p99.9 spikes. If you exclude them, your benchmark does not reflect production behavior.
7. **Optimizing the wrong thing.** Without profiling, developers optimize code that represents 2% of total execution time. Amdahl's Law says this yields negligible improvement.
8. **Treating cloud VM benchmarks as absolute numbers.** Cloud VMs share physical hardware. Performance varies by time of day and neighbor load. Use relative comparisons (before/after on same VM) not absolute numbers.

---

## Enforcement Checklist

- [ ] Every benchmark records: environment spec, runtime version, warm-up config, sample count
- [ ] Statistical analysis includes stddev, confidence intervals, and sample size
- [ ] Percentile reporting covers p50, p95, p99, p99.9
- [ ] Warm-up period is documented and sufficient (1000+ iterations for JIT runtimes)
- [ ] Environment isolation verified: fixed CPU frequency, no swap, pinned cores
- [ ] Regression detection runs in CI with defined threshold (e.g., 5% p99 increase)
- [ ] Baselines are version-controlled and updated on intentional changes
- [ ] Comparative benchmarks use interleaved runs (A-B-A-B pattern)
- [ ] Microbenchmarks prevent dead code elimination and constant folding
- [ ] Results include raw data files for independent verification
