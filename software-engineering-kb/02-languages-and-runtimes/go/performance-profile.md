# Go: Performance Profile

> **Domain:** Languages > Go
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## Compilation Speed

Go compiles **extremely fast** — this was a primary design goal:

| Metric | Go | C++ | Rust | Java |
|--------|-----|-----|------|------|
| Full stdlib compilation | ~5s | Minutes | Minutes | ~30s |
| Incremental build (small change) | <1s | 10-60s | 5-30s | 2-10s |
| Cross-compilation | Built-in (GOOS/GOARCH) | Very complex | Via target triples | JVM handles it |

**Why Go compiles fast:**
1. No header files — dependencies parsed once
2. No circular imports allowed — DAG dependency graph
3. Unused imports are compile errors — no wasted parsing
4. Simple type system — no template instantiation
5. Single-pass compilation design

## Runtime Performance

Go is typically **0.5-2x the speed of C** for network and server workloads:

### TechEmpower Framework Benchmarks (Round 22)

| Framework | JSON (req/s) | DB Single Query | Fortunes | Multiple Queries |
|-----------|-------------|-----------------|----------|------------------|
| **gnet** | ~600K | — | — | — |
| **Fiber** | ~400K | ~150K | ~120K | ~30K |
| **Gin** | ~350K | ~130K | ~100K | ~25K |
| **net/http** (stdlib) | ~300K | ~120K | ~90K | ~22K |
| **Echo** | ~320K | ~125K | ~95K | ~23K |
| Node.js (Fastify) | ~280K | ~90K | ~70K | ~15K |
| Python (FastAPI) | ~50K | ~20K | ~15K | ~5K |
| Java (Vert.x) | ~650K | ~350K | ~280K | ~60K |
| Rust (actix) | ~700K | ~400K | ~320K | ~70K |

### Computer Language Benchmarks Game

| Benchmark | Go | C | Rust | Java | Node.js |
|-----------|-----|---|------|------|---------|
| binary-trees | 3.8s | 1.5s | 0.8s | 1.2s | 4.2s |
| fannkuch-redux | 6.2s | 2.0s | 2.1s | 4.5s | 6.8s |
| mandelbrot | 4.1s | 1.1s | 1.1s | 2.8s | 3.6s |
| n-body | 5.8s | 2.2s | 2.3s | 5.2s | 6.1s |
| **Typical ratio vs C** | **~2-3x** | **1x** | **~1x** | **~1.5-2x** | **~3-4x** |

## Garbage Collector

### GC Architecture

```
Go GC: Concurrent, Tri-Color Mark-and-Sweep
Non-generational (unlike JVM)

Phase 1: Mark Setup (STW) — ~10-30μs
  └── Enable write barrier

Phase 2: Concurrent Marking — runs alongside application
  └── Trace reachable objects using tri-color marking
  └── White (unreachable) → Grey (to scan) → Black (scanned)

Phase 3: Mark Termination (STW) — ~10-30μs
  └── Finish marking, disable write barrier

Phase 4: Concurrent Sweep — runs alongside application
  └── Reclaim white (unreachable) objects
```

### GC Tuning

```go
// GOGC — target heap growth before next GC (default: 100 = 2x)
// GOGC=50  → more frequent GC, less memory, more CPU
// GOGC=200 → less frequent GC, more memory, less CPU
// GOGC=off → disable GC (dangerous, for benchmarks only)

// GOMEMLIMIT (Go 1.19+) — soft memory limit
// More effective than GOGC for containerized workloads
// GOMEMLIMIT=1GiB → GC becomes aggressive as heap approaches 1GB

// Runtime API
debug.SetGCPercent(50)            // Same as GOGC=50
debug.SetMemoryLimit(1 << 30)     // Same as GOMEMLIMIT=1GiB
```

### GC Pause Times

| Metric | Go (typical) | Java G1 | Java ZGC |
|--------|-------------|---------|----------|
| P50 pause | <100μs | 5-10ms | <1ms |
| P99 pause | <500μs | 20-50ms | <2ms |
| Max pause | ~1ms | 50-200ms | <10ms |
| Throughput overhead | 5-15% | 5-10% | 10-15% |

## Goroutine Performance

| Metric | Goroutine | OS Thread | Java Virtual Thread |
|--------|-----------|-----------|-------------------|
| Creation cost | ~2μs | ~10μs | ~1μs |
| Memory overhead | 2-8 KB | 1-8 MB | ~1 KB |
| Context switch | ~200ns | 1-10μs | ~200ns |
| Max practical count | Millions | Thousands | Millions |
| Stack growth | Dynamic (2KB → 1GB) | Fixed | Dynamic |

```go
// Benchmark: spawn 1 million goroutines
func BenchmarkGoroutineCreation(b *testing.B) {
    for b.Loop() {
        var wg sync.WaitGroup
        for i := 0; i < 1_000_000; i++ {
            wg.Add(1)
            go func() { defer wg.Done() }()
        }
        wg.Wait()
    }
}
// Result: ~1-2 seconds for 1M goroutines, ~2GB memory
```

## Memory Allocation

### Escape Analysis

```go
// Stack allocation (fast, ~1ns)
func stackAlloc() int {
    x := 42     // Stays on stack — no GC needed
    return x
}

// Heap allocation (slower, ~25ns + GC pressure)
func heapAlloc() *int {
    x := 42
    return &x   // Escapes to heap — pointer outlives function
}

// Check escape analysis:
// go build -gcflags='-m' ./...
```

### sync.Pool for Object Reuse

```go
var bufPool = sync.Pool{
    New: func() any {
        return new(bytes.Buffer)
    },
}

func processRequest(data []byte) {
    buf := bufPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufPool.Put(buf)
    }()

    buf.Write(data)
    // Process buf...
}
// Reduces GC pressure by reusing objects
```

## Binary Size

| Configuration | Size (Hello World) | Size (Web Server) |
|--------------|-------------------|-------------------|
| Default | ~2 MB | ~10-15 MB |
| `-ldflags="-s -w"` (strip) | ~1.5 MB | ~8-12 MB |
| + UPX compression | ~500 KB | ~3-5 MB |
| Go vs Rust (comparable) | ~2 MB | ~5-10 MB |
| Go vs C (comparable) | ~2 MB vs ~20 KB | — |

Binary size is larger than C because Go includes runtime, GC, and goroutine scheduler.

## Startup Time

| Runtime | Hello World Startup | Web Server Startup |
|---------|-------------------|--------------------|
| **Go** | ~1ms | ~5-10ms |
| Rust | ~1ms | ~3-5ms |
| Node.js | ~30ms | ~100-200ms |
| Java (JVM) | ~100ms | ~500ms-3s |
| Python | ~30ms | ~200-500ms |

Go's near-instant startup makes it **ideal for CLI tools, serverless, and containers**.

## Profiling Tools (pprof)

```go
import (
    "net/http"
    _ "net/http/pprof" // Register pprof handlers
)

func main() {
    go func() {
        http.ListenAndServe("localhost:6060", nil)
    }()
    // Application code...
}
```

```bash
# CPU profile
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Memory profile
go tool pprof http://localhost:6060/debug/pprof/heap

# Goroutine profile (find leaks)
go tool pprof http://localhost:6060/debug/pprof/goroutine

# Block profile (contention)
go tool pprof http://localhost:6060/debug/pprof/block

# Mutex contention
go tool pprof http://localhost:6060/debug/pprof/mutex

# Execution trace
curl -o trace.out http://localhost:6060/debug/pprof/trace?seconds=5
go tool trace trace.out
```

## Profile-Guided Optimization (PGO, Go 1.20+)

```bash
# 1. Build and run, collect CPU profile
go test -cpuprofile=default.pgo -bench=.

# 2. Rebuild with PGO (place default.pgo in main package dir)
go build -pgo=auto

# Typical improvement: 2-7% throughput increase
```

## Real-World Performance Stories

### Uber
- Migrated many Python services to Go
- Go services handle highest QPS at Uber
- Key reason: goroutines for concurrent request handling

### Dropbox
- Migrated performance-critical services from Python to Go
- "Magic Pocket" storage system in Go
- 4x throughput improvement over Python

### Cloudflare
- Go used for edge computing, DNS, DDoS mitigation
- Handles millions of requests per second

### Twitch
- Go for chat, video processing, internal tools
- IRC-compatible chat server serves millions of concurrent users

### SendGrid
- Migrated from multiple languages to Go
- Handles 40B+ emails per month

### CrowdStrike
- Security platform processing billions of events
- Go for its concurrency model and performance

## Sources

- [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/)
- [Go GC Guide](https://tip.golang.org/doc/gc-guide) — Official GC documentation
- [Go Diagnostics](https://go.dev/doc/diagnostics) — Profiling guide
- [PGO Documentation](https://go.dev/doc/pgo) — Profile-guided optimization
- [Computer Language Benchmarks Game](https://benchmarksgame-team.pages.debian.net/)
