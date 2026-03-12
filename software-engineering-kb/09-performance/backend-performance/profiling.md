# Profiling & Performance Analysis

> **Domain:** Performance > Backend Performance > Profiling
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Core Concepts

Profiling is the practice of measuring where a program spends its time, memory, and resources. Never optimize without profiling first. Intuition about bottlenecks is wrong 90% of the time.

```
Profiling Types:
┌──────────────────┬──────────────────────────────────────────┐
│ Type              │ What It Measures                          │
├──────────────────┼──────────────────────────────────────────┤
│ CPU profiling     │ Time spent in each function              │
│ Heap profiling    │ Memory allocations by call site          │
│ Allocation prof.  │ Rate of allocations (GC pressure)        │
│ Block profiling   │ Time goroutines spend blocked (Go)       │
│ Mutex profiling   │ Lock contention duration                 │
│ I/O profiling     │ Time in I/O waits (disk, network)        │
│ Wall-clock prof.  │ Total elapsed time (includes waits)      │
│ Off-CPU profiling │ Time threads spend NOT on CPU            │
└──────────────────┴──────────────────────────────────────────┘
```

---

## CPU Profiling & Flame Graphs

Flame graphs visualize stack traces: x-axis = percentage of samples, y-axis = call stack depth. Wide bars = hot functions.

```
Flame Graph Reading Guide:
┌────────────────────────────────────────────────┐
│           processRequest (100%)                 │
│  ┌──────────────────┐  ┌──────────────────────┐│
│  │ parseJSON (35%)   │  │ queryDB (55%)         ││
│  │ ┌──────────────┐  │  │ ┌────────┐┌────────┐ ││
│  │ │validate (20%)│  │  │ │connect ││execute │ ││
│  │ └──────────────┘  │  │ │ (15%)  ││ (40%)  │ ││
│  └──────────────────┘  │ └────────┘└────────┘ ││
│                         └──────────────────────┘│
└────────────────────────────────────────────────┘
Wide = hot. Optimize queryDB.execute (40%) first.
```

### Go Profiling

```go
// Go: built-in profiling with pprof
import (
    "net/http"
    _ "net/http/pprof" // registers /debug/pprof/* handlers
    "runtime/pprof"
)

// Option 1: HTTP pprof server (production-safe)
func init() {
    go func() {
        // Separate port for pprof — don't expose on public port
        http.ListenAndServe(":6060", nil)
    }()
}
// Collect 30-second CPU profile:
//   go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
// Interactive commands: top, list funcName, web (flame graph SVG)

// Generate flame graph from pprof:
//   go tool pprof -http=:8080 profile.pb.gz
//   → opens browser with flame graph, top functions, source view

// Option 2: programmatic profiling for benchmarks
func BenchmarkHandler(b *testing.B) {
    f, _ := os.Create("cpu.prof")
    pprof.StartCPUProfile(f)
    defer pprof.StopCPUProfile()

    for i := 0; i < b.N; i++ {
        handleRequest(testReq)
    }
}
// Then: go tool pprof -http=:8080 cpu.prof
```

### Node.js Profiling

```typescript
// Node.js: V8 CPU profiler via inspector
import { Session } from 'inspector';
import fs from 'fs';

async function profileCPU(durationMs: number): Promise<void> {
  const session = new Session();
  session.connect();

  session.post('Profiler.enable');
  session.post('Profiler.start');

  await new Promise(r => setTimeout(r, durationMs));

  session.post('Profiler.stop', (err, { profile }) => {
    fs.writeFileSync('cpu-profile.cpuprofile', JSON.stringify(profile));
    // Open in Chrome DevTools → Performance tab → Load profile
  });
}

// Production: use clinic.js for automatic analysis
// npx clinic flame -- node app.js
// → generates flame graph with I/O annotations
// npx clinic doctor -- node app.js
// → detects event loop delays, GC issues, I/O bottlenecks
```

```bash
# Node.js: Linux perf-based flame graph (most accurate)
node --perf-basic-prof app.js &
perf record -F 99 -p $! -g -- sleep 30
perf script | stackcollapse-perf.pl | flamegraph.pl > flamegraph.svg
```

### Python Profiling

```python
# Python: cProfile + snakeviz visualization
import cProfile
import pstats

def profile_function(func, *args, **kwargs):
    profiler = cProfile.Profile()
    profiler.enable()
    result = func(*args, **kwargs)
    profiler.disable()

    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    stats.print_stats(20)  # top 20 functions by cumulative time
    stats.dump_stats('profile.prof')
    return result

# Visualize: python -m snakeviz profile.prof → opens browser

# py-spy: sampling profiler for production (no code changes)
# pip install py-spy
# py-spy record -o profile.svg --pid 12345  → flame graph
# py-spy top --pid 12345                     → live top-like view
```

### Java Profiling

```bash
# Java Flight Recorder (JFR) — production-safe, <2% overhead
java -XX:+FlightRecorder \
     -XX:StartFlightRecording=duration=60s,filename=recording.jfr \
     -jar app.jar

# Continuous recording with dump on demand
java -XX:+FlightRecorder \
     -XX:StartFlightRecording=disk=true,maxsize=500m,maxage=1d \
     -jar app.jar

# Dump from running process
jcmd <pid> JFR.dump filename=dump.jfr

# Analyze with JDK Mission Control (jmc) or async-profiler
```

```bash
# async-profiler: low-overhead flame graphs for JVM
# Supports CPU, allocation, lock, wall-clock profiling
./asprof -d 30 -f flamegraph.html <pid>        # 30s CPU flame graph
./asprof -e alloc -d 30 -f alloc.html <pid>    # allocation profiling
./asprof -e lock -d 30 -f locks.html <pid>     # lock contention
```

---

## Memory Profiling

```go
// Go: heap profiling
// go tool pprof http://localhost:6060/debug/pprof/heap

// allocs profile shows allocation rate (GC pressure)
// go tool pprof http://localhost:6060/debug/pprof/allocs

// Compare two snapshots to find leaks:
// go tool pprof -base heap1.prof heap2.prof
// → shows growth between snapshots
```

```typescript
// Node.js: heap snapshot for memory leak detection
import v8 from 'v8';
v8.writeHeapSnapshot('/tmp/heap.heapsnapshot'); // Load in Chrome DevTools → Memory tab
// Compare two snapshots to find growing object counts = leak
// node --inspect app.js → Chrome DevTools → Memory → Allocation timeline
```

---

## Brendan Gregg's USE Method

```
USE Method — for every RESOURCE, check:
┌──────────────┬──────────────────────────────────────────────┐
│ Metric        │ What to Check                                 │
├──────────────┼──────────────────────────────────────────────┤
│ Utilization   │ % time resource is busy (or % capacity used) │
│ Saturation    │ Queue length / work waiting (extra demand)   │
│ Errors        │ Error count for that resource                │
└──────────────┴──────────────────────────────────────────────┘

Apply to each resource:
┌──────────────┬──────────────────┬──────────────────┬───────────┐
│ Resource      │ Utilization       │ Saturation        │ Errors    │
├──────────────┼──────────────────┼──────────────────┼───────────┤
│ CPU           │ mpstat %usr+%sys │ runqueue length  │ –         │
│ Memory        │ free -m used%    │ swap usage, OOM  │ OOM kills │
│ Disk I/O      │ iostat %util     │ avgqu-sz         │ /dev errors│
│ Network       │ sar rx/tx bytes  │ ifconfig overruns│ ifconfig err│
│ DB Connections│ pool utilization │ pool wait queue  │ conn refused│
│ Thread Pool   │ active/max ratio │ task queue depth │ rejections │
└──────────────┴──────────────────┴──────────────────┴───────────┘
```

---

## RED Method (for services)

```
RED Method — for every SERVICE, monitor:
┌──────────────┬───────────────────────────────────────────┐
│ Metric        │ What to Measure                            │
├──────────────┼───────────────────────────────────────────┤
│ Rate          │ Requests per second                        │
│ Errors        │ Failed requests per second                │
│ Duration      │ Response time distribution (p50/p95/p99)  │
└──────────────┴───────────────────────────────────────────┘
```

```typescript
// Implementing RED metrics with Prometheus
import { Counter, Histogram } from 'prom-client';

const requestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Middleware
app.use((req, res, next) => {
  const end = requestDuration.startTimer({ method: req.method, path: req.route?.path || req.path });
  res.on('finish', () => {
    end();
    requestCounter.inc({ method: req.method, path: req.route?.path || req.path, status: res.statusCode });
  });
  next();
});
```

---

## Continuous Profiling in Production

```
Continuous Profiling: App → Agent → Backend (Pyroscope/Parca) → Flame graph UI
Key capability: diff flame graphs between deploys to catch performance regressions.
Tools: Pyroscope (Grafana), Parca (open source), Polar Signals (managed).
```

```go
// Pyroscope integration for Go — continuous profiling with <1% overhead
import "github.com/grafana/pyroscope-go"

func main() {
    pyroscope.Start(pyroscope.Config{
        ApplicationName: "my-service",
        ServerAddress:   "http://pyroscope:4040",
        ProfileTypes: []pyroscope.ProfileType{
            pyroscope.ProfileCPU, pyroscope.ProfileAllocObjects,
            pyroscope.ProfileAllocSpace, pyroscope.ProfileInuseSpace,
            pyroscope.ProfileGoroutines, pyroscope.ProfileMutexDuration,
            pyroscope.ProfileBlockDuration,
        },
        Tags: map[string]string{"region": "us-east-1", "env": "production"},
    })
}
```

```python
# Python: Pyroscope integration
import pyroscope
pyroscope.configure(application_name="my-service", server_address="http://pyroscope:4040",
    tags={"region": "us-east-1", "env": "production"})
# Tag specific code sections for targeted profiling
with pyroscope.tag_wrapper({"endpoint": "/api/search"}):
    perform_search(query)
```

---

## Lock Contention Analysis

```go
// Go: mutex and block profiling
import "runtime"

func init() {
    runtime.SetMutexProfileFraction(5)  // sample 1/5 mutex events
    runtime.SetBlockProfileRate(1)       // record all blocking events
}
// Then: go tool pprof http://localhost:6060/debug/pprof/mutex
//       go tool pprof http://localhost:6060/debug/pprof/block
```

```java
// Java: JFR lock contention events
// jcmd <pid> JFR.start settings=profile duration=60s filename=locks.jfr
// Events: jdk.JavaMonitorEnter, jdk.JavaMonitorWait
// Analysis: jfr print --events jdk.JavaMonitorEnter locks.jfr

// async-profiler lock profiling
// ./asprof -e lock -d 30 --lock 1ms -f locks.html <pid>
// Shows locks held longer than 1ms
```

---

## I/O Profiling

```bash
# Linux: trace I/O at syscall level
strace -c -p <pid>                    # syscall summary (counts + time)
strace -e trace=read,write -p <pid>   # trace specific syscalls

# BPF-based I/O tracing (low overhead, production-safe)
biolatency-bpfcc 10                   # block I/O latency histogram
ext4slower-bpfcc 1                    # ext4 operations slower than 1ms
tcplife-bpfcc                          # TCP connection lifecycle
```

---

## Best Practices

1. **ALWAYS profile before optimizing** — measure, identify bottleneck, fix, measure again
2. **Use flame graphs** as primary visualization — they show hot paths instantly
3. **Profile in production** with continuous profiling (Pyroscope/Parca) — dev environments miss real patterns
4. **Implement RED metrics** (Rate, Errors, Duration) for every service endpoint
5. **Apply USE method** (Utilization, Saturation, Errors) for every infrastructure resource
6. **Compare profiles across deploys** — diff flame graphs catch regressions that benchmarks miss
7. **Profile all resource types** — CPU, memory, I/O, locks — the bottleneck is often not where you think
8. **Set profiling overhead budget** — <2% CPU overhead in production is acceptable
9. **Automate regression detection** — alert when p99 latency increases >10% between deploys
10. **Profile allocation rate** not just heap size — high allocation rate causes GC pressure even with small live set

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Optimizing without profiling | Wrong function optimized, no improvement | Profile first, optimize the measured bottleneck |
| Only profiling CPU | Bottleneck is I/O or lock contention | Profile CPU, memory, I/O, and locks |
| Only profiling in dev | Miss production data patterns, concurrency | Use continuous profiling in production |
| Averaging latency | p50=5ms hides p99=500ms | Always measure p50, p95, p99, p999 |
| One-time profiling | Regressions creep in undetected | Continuous profiling with deploy comparison |
| Ignoring allocation rate | Frequent GC pauses despite small heap | Profile alloc rate, reduce allocations |
| Profiling with debug builds | Different code paths, inlined functions | Profile release/production builds |
| No baseline established | Can't detect regressions | Record baseline profile for every service |

---

## Enforcement Checklist

- [ ] RED metrics (Rate, Errors, Duration) exported for all services
- [ ] USE method applied to all infrastructure resources
- [ ] Continuous profiling deployed (Pyroscope or Parca)
- [ ] Flame graph comparison enabled across deploys
- [ ] CPU, memory, and allocation profiles collected in production
- [ ] Lock contention profiling enabled for concurrent services
- [ ] p50/p95/p99 latency tracked with alerting thresholds
- [ ] Profiling overhead verified <2% CPU impact
- [ ] Regression detection automated in CI/CD pipeline
- [ ] Baseline performance profile recorded for each service
