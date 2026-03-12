# Backend Profilers — Language-Specific Profiling Tools

> **Domain:** Profiling Tools > Backend Performance Analysis
> **Importance:** CRITICAL
> **Cross-ref:** 09-performance/profiling-tools/apm-tools.md, 09-performance/profiling-tools/distributed-tracing.md

> **Directive:** Use language-native profilers for CPU, memory, and concurrency analysis. Generate flame graphs for every performance investigation. Profile in production with low-overhead tools (py-spy, async-profiler, pprof). Never guess at bottlenecks -- measure first.

---

## 1. Flame Graphs (Brendan Gregg)

```
FLAME GRAPH ANATOMY:
┌──────────────────────────────────────────────────────┐
│                    main()                             │ ← Root
│    ┌─────────────────────┐  ┌────────────────────┐   │
│    │   handleRequest()   │  │   processQueue()   │   │
│    │  ┌───────┐ ┌──────┐ │  │  ┌──────────────┐  │   │
│    │  │parseJSON│queryDB│ │  │  │ compressData │  │   │
│    │  └───────┘ └──────┘ │  │  └──────────────┘  │   │
│    └─────────────────────┘  └────────────────────┘   │
└──────────────────────────────────────────────────────┘

READING RULES:
  - X-axis = proportion of total samples (NOT time sequence)
  - Y-axis = stack depth (bottom = root, top = leaf)
  - Wide boxes = functions consuming most CPU
  - Plateau (flat top) = function doing work itself
  - Look for wide + tall = hot call paths

TYPES:
  CPU flame graph:    On-CPU time (where CPU cycles go)
  Off-CPU flame graph: Blocked/waiting time (I/O, locks, sleep)
  Memory flame graph:  Allocation call sites
  Diff flame graph:    Red/blue comparison between two profiles
```

```bash
# Generate flame graph from perf (Linux)
perf record -g -F 99 -p $PID -- sleep 30
perf script | stackcollapse-perf.pl | flamegraph.pl > cpu.svg

# Generate from DTrace (macOS)
dtrace -x ustackframes=100 -n 'profile-99 /pid == $PID/ { @[ustack()] = count(); }' \
  -o out.stacks
stackcollapse.pl out.stacks | flamegraph.pl > cpu.svg
```

## 2. Go — pprof

```go
// Enable pprof HTTP server
import (
    "net/http"
    _ "net/http/pprof"
)

func main() {
    go func() {
        // Expose at :6060/debug/pprof/
        http.ListenAndServe("localhost:6060", nil)
    }()
    // ... application code ...
}
```

```bash
# CPU profile (30-second sample)
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Memory (heap) profile
go tool pprof http://localhost:6060/debug/pprof/heap

# Goroutine dump (detect goroutine leaks)
go tool pprof http://localhost:6060/debug/pprof/goroutine

# Block profile (contention on channels/mutexes)
go tool pprof http://localhost:6060/debug/pprof/block

# Mutex contention profile
go tool pprof http://localhost:6060/debug/pprof/mutex

# Interactive commands inside pprof
(pprof) top 20          # top 20 functions by CPU/memory
(pprof) list funcName   # annotated source code
(pprof) web             # open flame graph in browser
(pprof) png > out.png   # export call graph

# Compare two profiles (diff)
go tool pprof -diff_base=before.prof after.prof
```

```go
// Programmatic profiling in benchmarks
import "runtime/pprof"

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

## 3. Java Profiling

### async-profiler (Production-Safe)

```bash
# Attach to running JVM (low overhead: 1-3%)
./asprof -d 30 -f cpu.html $PID           # 30s CPU flame graph
./asprof -e alloc -d 30 -f alloc.html $PID # Allocation profiling
./asprof -e lock -d 30 -f lock.html $PID   # Lock contention
./asprof -e wall -d 30 -f wall.html $PID   # Wall clock (includes I/O waits)

# Continuous profiling with output rotation
./asprof start -f /tmp/profile-%t.jfr --loop 60s $PID
```

### JDK Flight Recorder (JFR)

```bash
# Start JFR recording (built into JDK 11+)
jcmd $PID JFR.start name=perf duration=60s filename=recording.jfr \
  settings=profile

# Continuous recording with max size
java -XX:StartFlightRecording=maxsize=500m,disk=true,dumponexit=true,\
filename=/tmp/app.jfr -jar app.jar

# Analyze with JDK Mission Control (jmc) or programmatically:
jfr print --events jdk.ExecutionSample recording.jfr | head -100
jfr summary recording.jfr
```

### VisualVM Quick Reference

```
USAGE: Launch visualvm, attach to local/remote JVM
TABS:
  Monitor:   CPU usage, heap size, thread count (live)
  Threads:   Thread states, deadlock detection
  Sampler:   CPU sampling (low overhead) or Memory sampling
  Profiler:  Instrumented profiling (higher overhead, more detail)

REMOTE: jstatd or JMX connection
  java -Dcom.sun.management.jmxremote.port=9010 \
       -Dcom.sun.management.jmxremote.authenticate=false \
       -Dcom.sun.management.jmxremote.ssl=false -jar app.jar
```

## 4. Python Profiling

### cProfile (Built-in)

```bash
# Profile entire script
python -m cProfile -s cumtime app.py

# Save for analysis
python -m cProfile -o profile.prof app.py
python -c "import pstats; p=pstats.Stats('profile.prof'); p.sort_stats('cumulative'); p.print_stats(20)"
```

### py-spy (Production-Safe Sampling Profiler)

```bash
# Install
pip install py-spy

# Attach to running process (no restart needed)
py-spy record -o profile.svg --pid $PID        # Flame graph SVG
py-spy record -o profile.json --pid $PID --format speedscope
py-spy top --pid $PID                           # Live top-like view

# Profile a command
py-spy record -o profile.svg -- python app.py

# Subprocesses + native extensions
py-spy record --subprocesses --native -o profile.svg --pid $PID
```

### Scalene (CPU + Memory + GPU)

```bash
pip install scalene
scalene --cpu --memory --gpu app.py

# Output: per-line CPU time, memory allocation, copy volume
# Shows: Python time vs C time (native extensions)
# Identifies: memory leaks per line of code
```

### memray (Memory Profiler)

```bash
pip install memray
memray run app.py                  # Record allocations
memray flamegraph memray-out.bin   # Generate flame graph
memray tree memray-out.bin         # Allocation call tree
memray stats memray-out.bin        # Summary statistics
memray live app.py                 # Real-time TUI view

# Attach to running process
memray attach $PID
```

## 5. Node.js Profiling

### Built-in Inspector

```bash
# Start with inspector
node --inspect app.js              # Default port 9229
node --inspect-brk app.js          # Break on first line

# CPU profile via CLI
node --prof app.js                 # Generates isolate-*.log
node --prof-process isolate-*.log  # Human-readable output

# Heap snapshot from CLI
node -e "require('v8').writeHeapSnapshot()"
kill -USR2 $PID                    # Signal-triggered heap snapshot
```

### clinic.js Suite

```bash
npm install -g clinic

# Doctor: detect event loop delays, I/O issues, GC pressure
clinic doctor -- node app.js
# Outputs HTML report with automated recommendations

# Flame: CPU flame graph
clinic flame -- node app.js
# Wraps 0x under the hood

# Bubbleprof: async operation visualization
clinic bubbleprof -- node app.js
# Shows async call patterns and delays

# HeapProfiler: memory allocation tracking
clinic heapprofiler -- node app.js
```

### 0x (Flame Graph Generator)

```bash
npm install -g 0x
0x app.js                          # Generates interactive flame graph
0x --open app.js                   # Auto-open in browser
0x -D /tmp/profile -- node app.js  # Custom output directory
```

## 6. .NET Profiling

```bash
# dotnet-trace: cross-platform tracing
dotnet tool install -g dotnet-trace
dotnet-trace collect -p $PID --duration 00:00:30
dotnet-trace convert trace.nettrace --format Speedscope

# dotnet-counters: live metrics
dotnet-counters monitor -p $PID --counters \
  System.Runtime,Microsoft.AspNetCore.Hosting

# dotnet-dump: memory analysis
dotnet-dump collect -p $PID
dotnet-dump analyze core_dump
> dumpheap -stat              # heap statistics
> gcroot <address>            # find GC roots holding object
> dumpobj <address>           # inspect object

# dotnet-gcdump: GC heap snapshot
dotnet-gcdump collect -p $PID
# Open .gcdump in PerfView or Visual Studio
```

### PerfView (Windows)

```
USAGE:
  PerfView.exe /GCCollectOnly collect    # GC analysis
  PerfView.exe collect                   # Full ETW trace
  PerfView.exe /ThreadTime collect       # Thread-level CPU

ANALYSIS:
  Open .etl file → CPU Stacks → select process
  → "By Name" tab for hotspot functions
  → "Flame Graph" tab for visual analysis
  → "Caller/Callee" for call chain navigation
```

## 7. Rust Profiling

```bash
# perf (Linux) — zero-overhead sampling
perf record -g --call-graph=dwarf -F 99 ./target/release/app
perf report                              # Interactive TUI
perf script | stackcollapse-perf.pl | flamegraph.pl > flame.svg

# cargo-flamegraph (wraps perf/dtrace)
cargo install flamegraph
cargo flamegraph --bin myapp             # Flame graph in one command
cargo flamegraph --bench my_benchmark    # Profile benchmarks

# Heap profiling with DHAT (valgrind)
valgrind --tool=dhat ./target/release/app
# Opens dh_view.html for interactive analysis

# Memory profiling with heaptrack
heaptrack ./target/release/app
heaptrack_gui heaptrack.app.$PID.gz

# Criterion benchmarks with profiling
# In Cargo.toml:
# [profile.bench]
# debug = true   # Enable debug symbols for profiling
cargo bench -- --profile-time 10
```

## 8. Cross-Language Profiling Comparison

```
┌──────────┬─────────────────┬───────────┬──────────────────┐
│ Language │ CPU Profiler     │ Overhead  │ Prod-Safe?       │
├──────────┼─────────────────┼───────────┼──────────────────┤
│ Go       │ pprof            │ 1-5%     │ YES              │
│ Java     │ async-profiler   │ 1-3%     │ YES              │
│ Java     │ JFR              │ 1-2%     │ YES              │
│ Python   │ py-spy           │ < 1%     │ YES (no modify)  │
│ Python   │ cProfile         │ 30-50%   │ NO               │
│ Node.js  │ --inspect        │ 5-10%    │ USE WITH CAUTION │
│ Node.js  │ 0x/clinic        │ 10-20%   │ DEV/STAGING ONLY │
│ .NET     │ dotnet-trace     │ 2-5%     │ YES              │
│ Rust     │ perf             │ < 1%     │ YES              │
└──────────┴─────────────────┴───────────┴──────────────────┘
```

---

## 10 Best Practices

1. **Always generate flame graphs** -- visual analysis reveals hotspots faster than tabular output
2. **Profile in production with low-overhead tools** -- py-spy, async-profiler, pprof are designed for this
3. **Compare before/after profiles** -- diff flame graphs prove optimization impact
4. **Profile under realistic load** -- profiling idle systems reveals nothing useful
5. **Enable debug symbols in release builds** -- without symbols, flame graphs show hex addresses
6. **Sample for 30-60 seconds minimum** -- short samples miss intermittent hotspots
7. **Profile both CPU and memory** -- CPU-optimal code can still OOM from allocation pressure
8. **Use wall-clock profiling for I/O-bound services** -- CPU profiling misses time spent waiting
9. **Automate profiling in CI benchmarks** -- catch regressions with tracked profiles per commit
10. **Profile concurrency issues separately** -- use block/mutex profilers (Go), lock profilers (Java)

## 8 Anti-Patterns

1. **Profiling in dev instead of production** -- dev workloads differ from real traffic patterns
2. **Using high-overhead profilers in production** -- cProfile (50% overhead) in prod degrades service
3. **Reading flame graphs left-to-right** -- x-axis is not a time axis; it is alphabetical/proportional
4. **Ignoring off-CPU time** -- I/O waits, lock contention, and sleep calls dominate latency in many services
5. **Profiling without load** -- an idle process profile shows startup/GC, not runtime behavior
6. **Stripping debug symbols from profiled binaries** -- makes flame graphs unreadable
7. **One-time profiling without trending** -- performance regresses continuously; profile regularly
8. **Optimizing hot functions without checking call frequency** -- a fast function called 10M times matters more than a slow function called once

## Enforcement Checklist

- [ ] Production-safe profiler deployed for primary language (py-spy, async-profiler, pprof)
- [ ] Flame graph generation automated and accessible to all engineers
- [ ] CPU and memory profiles captured during load tests
- [ ] Debug symbols included in production builds for profiling
- [ ] Profile diffs generated for performance-critical PRs
- [ ] Continuous profiling solution evaluated (Pyroscope, Parca, Datadog Continuous Profiler)
- [ ] Off-CPU/wall-clock profiling used for I/O-bound services
- [ ] Benchmark suite runs with profiling enabled in CI
