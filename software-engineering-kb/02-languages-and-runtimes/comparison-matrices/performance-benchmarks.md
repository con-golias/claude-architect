# Programming Language Performance Benchmarks

> **Domain:** Languages & Runtimes > Comparison Matrices
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03-07

---

## What It Is

A comprehensive collection and analysis of cross-language performance benchmark data. This document covers raw throughput, memory consumption, startup times, energy efficiency, and concurrency scaling across 15+ languages, drawing from the most authoritative benchmark sources in the industry.

**Critical disclaimer**: No single benchmark tells the whole story. This document teaches you how to **read benchmarks correctly** and provides data from multiple sources to paint an accurate picture.

---

## Why It Matters

Performance benchmarks inform three critical decisions:
1. **Language selection** for new projects based on performance requirements
2. **Runtime selection** within a language (Node.js vs Bun vs Deno, CPython vs PyPy)
3. **Architecture decisions** — when to use a faster language for specific services in a polyglot architecture

However, benchmarks are **frequently misused**. A language being 10x faster in a microbenchmark rarely translates to 10x faster real-world applications. This document provides both the data and the methodology to interpret it correctly.

---

## Benchmark Methodology: How to Read Benchmarks Correctly

### Common Pitfalls

1. **Microbenchmarks vs Real-World**: A tight loop sorting integers tells you about CPU instruction efficiency. It tells you nothing about how fast your web app will be, where I/O, database queries, and serialization dominate.

2. **JIT Warmup**: JVM and .NET languages (Java, Kotlin, C#) are slow for the first few seconds as the JIT compiler optimizes hot paths. Benchmarks that measure only the first second unfairly penalize them. Production servers run for months.

3. **GC Pressure**: Benchmarks with minimal allocation make GC languages look better than they are. Real applications allocate heavily, causing GC pauses that don't show in synthetic tests.

4. **Library Quality vs Language Speed**: A "slow" language with a highly optimized C library (e.g., Python + NumPy) can outperform a "fast" language with a naive implementation.

5. **Compiler Optimization**: Compilers can optimize away dead code in benchmarks. If the result isn't used, the computation may be eliminated entirely, making the benchmark meaningless.

6. **Hardware Specifics**: Benchmark numbers are hardware-dependent. Relative rankings are more meaningful than absolute numbers.

### What to Look For

- **Relative rankings** between languages, not absolute numbers
- **Multiple benchmark types** (CPU, I/O, memory, concurrency)
- **Real-world workloads** (web servers, database queries) over synthetic tests
- **p50/p95/p99 latency**, not just throughput — tail latency matters in production
- **Memory under load**, not just peak throughput — lower memory means more instances per server

---

## TechEmpower Framework Benchmarks (Round 22, October 2023)

The industry-standard web framework benchmark. Tests run on dedicated physical hardware with a PostgreSQL database.

### Fortunes Test (Most Realistic — DB reads + HTML templating + encoding)

This test queries a database, sorts results, adds a row, and renders HTML. It's the closest to a real web application.

| Rank | Framework | Language | Requests/sec |
|---|---|---|---|
| 1-5 | drogon | C++ | ~750,000 |
| 1-5 | may-minihttp | Rust | ~700,000+ |
| 1-5 | actix-web | Rust | ~680,000 |
| 1-5 | ntex | Rust | ~650,000 |
| 6-10 | axum | Rust | ~550,000-620,000 |
| 6-10 | ASP.NET Core | C# | ~450,000-550,000 |
| 11-15 | Vert.x | Java | ~400,000+ |
| 11-15 | Fiber | Go | ~400,000 |
| 16-20 | Gin | Go | ~300,000-350,000 |
| 16-20 | Echo | Go | ~320,000 |
| 20-30 | Spring WebFlux | Java | ~250,000-350,000 |
| 20-30 | Spring Boot (virtual threads) | Java | ~200,000-280,000 |
| 30-50 | Fastify | Node.js | ~120,000-180,000 |
| 30-50 | Phoenix | Elixir | ~100,000-180,000 |
| 50-80 | Serverpod | Dart | ~50,000-80,000 (est.) |
| 50-80 | Express | Node.js | ~40,000-60,000 |
| 80+ | FastAPI | Python | ~15,000-25,000 |
| 80+ | Rails | Ruby | ~10,000-20,000 |
| 80+ | Laravel | PHP | ~10,000-20,000 |
| 80+ | Django | Python | ~8,000-15,000 |
| 80+ | Flask | Python | ~5,000-10,000 |

### JSON Serialization Test (Pure Compute)

| Framework | Language | Requests/sec |
|---|---|---|
| actix-web | Rust | ~1,200,000+ |
| axum | Rust | ~1,000,000+ |
| ASP.NET Core | C# | ~900,000+ |
| Fiber | Go | ~800,000+ |
| Spring WebFlux | Java | ~500,000-700,000 |
| Fastify | Node.js | ~300,000-400,000 |
| Phoenix | Elixir | ~200,000-350,000 |
| FastAPI | Python | ~30,000-50,000 |

### Plaintext Test (Raw HTTP Throughput)

| Tier | Languages | Requests/sec |
|---|---|---|
| Top | Rust, C++ | >7,000,000 |
| High | C#/.NET, Java (Vert.x) | 4,000,000-7,000,000 |
| High | Go | 3,000,000-5,000,000 |
| Mid | Node.js (Fastify) | 800,000-1,000,000 |
| Mid | Elixir (Phoenix) | 400,000-600,000 |
| Low | Python, Ruby, PHP | <200,000 |

### Database Tests (Single Query, Multiple Queries, Updates)

| Test | Top Language | Notes |
|---|---|---|
| **Single query** | Rust, C++ | ~800K+ req/sec |
| **20 queries** | Rust, C#, Java | Drops to ~30K-80K; DB becomes bottleneck |
| **Updates** | Java (Vert.x), Rust, C# | Write-heavy; connection pooling matters more than language speed |

**Key Insight**: As tests become more realistic (more DB interaction), the gap between languages **narrows dramatically**. In the updates test, framework/connection pool quality matters more than language speed.

---

## Computer Language Benchmarks Game (Debian)

CPU-intensive algorithmic benchmarks on a single core. No I/O, no concurrency — pure computational speed.

**Source**: benchmarksgame-team.pages.debian.net

### Summary Results (Relative to C = 1.0x)

| Language | Relative Speed | Relative Memory | Notes |
|---|---|---|---|
| **C** | 1.0x (baseline) | 1.0x | Manually optimized |
| **C++** | 0.9-1.1x | 1.0-1.5x | Similar to C with abstractions |
| **Rust** | 0.95-1.1x | 0.9-1.2x | Matches C/C++; sometimes faster due to optimizations |
| **Zig** | 0.95-1.1x | 0.9-1.0x | Similar to C; no hidden allocations |
| **Go** | 1.5-3.0x slower | 2-5x | GC overhead; not optimized for single-core compute |
| **Java** | 1.2-2.5x slower | 5-20x | After JIT warmup; memory overhead from JVM |
| **C#** | 1.2-2.5x slower | 5-15x | Similar to Java after JIT |
| **Swift** | 1.1-2.0x slower | 1.5-5x | ARC overhead; generally good |
| **Dart** | 1.5-3.0x slower | 3-8x | Decent for a GC language |
| **Kotlin/JVM** | 1.2-2.5x slower | 5-20x | Same as Java (runs on JVM) |
| **Node.js** | 2-5x slower | 5-15x | V8 JIT good but not system-level |
| **PHP 8** | 3-10x slower | 3-8x | Dramatically improved with JIT (PHP 8.0+) |
| **Ruby** | 10-50x slower | 3-10x | YJIT (3.1+) improved by 30-50% |
| **Python (CPython)** | 20-100x slower | 3-10x | Interpreted; GIL limits |
| **Python (PyPy)** | 3-10x slower | 5-15x | JIT makes a massive difference |

### Specific Benchmark Results

#### n-body (Gravitational Simulation)
| Language | Time (sec) | Memory (KB) |
|---|---|---|
| C | 6.9 | 1,068 |
| Rust | 6.9 | 1,164 |
| C++ | 7.0 | 1,508 |
| Java | 10.1 | 35,396 |
| Go | 13.2 | 3,420 |
| Node.js | 16.5 | 42,004 |
| Python (PyPy) | 21.7 | 66,916 |
| Ruby | 183.0 | 14,060 |
| Python (CPython) | 567.0 | 8,920 |

#### binary-trees (GC Stress Test)
This benchmark specifically stresses garbage collection by allocating and deallocating millions of tree nodes.

| Language | Time (sec) | Memory (KB) |
|---|---|---|
| C++ | 1.6 | 135,404 |
| Rust | 2.1 | 169,652 |
| Java | 2.3 | 1,979,148 |
| Go | 5.7 | 417,960 |
| C# | 3.4 | 719,436 |
| Node.js | 6.4 | 565,624 |
| Python (CPython) | 28.5 | 410,728 |

**Key insight**: Java's throughput is excellent (fast allocation + generational GC), but it uses **20x more memory** than C++/Rust.

---

## Energy Efficiency (Pereira et al., 2017 + Updates)

"Energy Efficiency across Programming Languages" study measured energy consumption, execution time, and peak memory for 10 benchmark programs across 27 languages.

### Energy Consumption Ranking (Relative to C = 1.0x)

| Tier | Languages | Energy Ratio |
|---|---|---|
| **Best (1-2x)** | C, Rust, C++ | 1.0x - 1.34x |
| **Good (2-5x)** | Java, Go, C#, Swift, Ada | 1.98x - 3.14x |
| **Moderate (5-15x)** | Dart, Kotlin/JVM, Node.js, PHP | ~5x - 12x |
| **Poor (15-50x)** | Python, Ruby, Perl | 27x - 75x |

### Key Findings
- **C is the most energy-efficient** language (baseline)
- **Rust** is within 1.03x of C — essentially identical energy consumption
- **Java** uses ~1.98x the energy of C but is fast; its memory usage is the problem
- **Python** uses ~75x the energy of C — the worst among measured languages
- **Go** uses ~3.23x — good for a GC language
- **Fastest != most energy efficient**: Java can be faster than Go but uses more energy due to memory

### Implications for Cloud/Sustainability
If you run 1,000 servers:
- Switching from Python to Rust could reduce energy by **75x** for CPU-bound workloads
- Switching from Node.js to Go could reduce energy by **~3x**
- At cloud scale (AWS/GCP/Azure), this translates directly to cost and carbon footprint

---

## Runtime Variant Comparisons

### Node.js vs Bun vs Deno

| Metric | Node.js (V8) | Bun (JSCore) | Deno (V8) |
|---|---|---|---|
| **JS Engine** | Google V8 | Apple JavaScriptCore | Google V8 |
| **HTTP Server (req/sec)** | ~80K-120K (built-in) | ~150K-250K | ~80K-130K |
| **Cold Start** | ~50-100 ms | ~10-30 ms | ~50-100 ms |
| **TS Support** | Via tsx/ts-node (transpile) | Native (built-in) | Native (built-in) |
| **Package Manager** | npm/yarn/pnpm | bun install (~10-20x faster than npm) | npm compatible |
| **Bundler** | External (webpack/vite/esbuild) | Built-in (fast) | None built-in |
| **Test Runner** | External (Jest/Vitest) | Built-in (bun test) | Built-in (Deno.test) |
| **npm Compatibility** | 100% (it's npm) | ~95%+ | ~90%+ (node compat layer) |
| **Maturity** | Very mature (2009) | Young (2022) | Mature (2018) |
| **Production Use** | Ubiquitous | Growing, some concerns about stability | Moderate |

**Key insight**: Bun is significantly faster for startup and HTTP but less proven in production. Node.js remains the safe choice. Deno offers security-first with good compatibility.

### CPython vs PyPy vs Cython vs Mojo

| Metric | CPython | PyPy | Cython | Mojo |
|---|---|---|---|---|
| **Speed (relative)** | 1x (baseline) | 3-10x faster | 10-100x faster (compiled) | Claims up to 68,000x (marketing) |
| **Compatibility** | 100% (reference impl) | ~95% (C extensions limited) | Python superset + C types | Python superset + systems features |
| **C Extension Support** | Full | Limited (emulation layer) | Full (compiles to C) | Different approach |
| **Memory** | Baseline | 2-3x more (JIT metadata) | Similar to C | Similar to C |
| **Use Case** | General purpose | Long-running CPU-bound | Numerical/scientific code | AI/ML systems (emerging) |
| **Maturity** | Very mature | Mature | Mature | Very early (2023+) |

**GIL removal**: Python 3.13+ introduces experimental free-threading (PEP 703). When fully stable, this will fundamentally change Python's concurrency story, enabling true multi-threaded parallelism for the first time.

### JVM: HotSpot vs GraalVM vs OpenJ9

| Metric | HotSpot (default) | GraalVM CE | GraalVM Native Image | OpenJ9 |
|---|---|---|---|---|
| **Peak Throughput** | Excellent | 10-20% better (some workloads) | 80-95% of HotSpot | 90-95% of HotSpot |
| **Startup Time** | 2-8 sec (Spring) | Similar to HotSpot | ~50-200 ms (native binary) | 30-40% faster than HotSpot |
| **Memory (idle)** | ~150-300 MB | Similar | ~30-80 MB | ~40-60% less than HotSpot |
| **Polyglot** | Java/Kotlin only | Java, JS, Python, Ruby, R, LLVM | Java/Kotlin compiled to native | Java/Kotlin only |
| **Best For** | Long-running servers | Polyglot or peak performance | Serverless/containers/CLI | Container workloads |

**GraalVM Native Image** transforms Java's biggest weakness (startup + memory) into a strength. Quarkus + GraalVM: ~10-50 ms startup, ~30 MB memory. This makes Java competitive with Go for serverless.

### .NET: CLR vs NativeAOT

| Metric | .NET CLR (default) | .NET NativeAOT |
|---|---|---|
| **Startup** | ~200-500 ms | ~30-80 ms |
| **Memory** | ~50-200 MB | ~20-60 MB |
| **Binary Size** | Requires .NET runtime | Self-contained: ~10-30 MB |
| **Peak Performance** | Excellent (JIT optimizes hot paths) | Good (no JIT, but profile-guided optimization) |
| **Reflection** | Full support | Limited (trimming removes unused code) |
| **Best For** | Long-running servers | Serverless, CLI tools, containers |

### Go Standard vs TinyGo

| Metric | Go (standard) | TinyGo |
|---|---|---|
| **Binary Size** | ~5-15 MB | ~100 KB - 2 MB |
| **Target** | Servers, CLI, general | Embedded, WASM, microcontrollers |
| **Concurrency** | Full goroutines | Limited goroutine support |
| **Stdlib** | Full | Partial |
| **Speed** | Full optimization | Slower (less optimization) |
| **WASM** | Yes (large output) | Yes (much smaller output) |

---

## Serverless Cold Start Comparison

Cold start time is critical for serverless functions where containers are created on demand.

### AWS Lambda Cold Start

| Runtime | Cold Start (basic function) | Cold Start (with framework) |
|---|---|---|
| **Rust (custom runtime)** | ~10-30 ms | ~20-50 ms |
| **Go** | ~20-50 ms | ~30-80 ms |
| **Node.js 20** | ~80-150 ms | ~150-400 ms |
| **Python 3.12** | ~100-200 ms | ~200-500 ms (FastAPI) |
| **C# (.NET 8)** | ~200-400 ms | ~300-700 ms |
| **C# (NativeAOT)** | ~50-100 ms | ~80-200 ms |
| **Java 21** | ~1-5 sec | ~3-10 sec (Spring) |
| **Java (GraalVM native)** | ~50-200 ms | ~100-300 ms |
| **Ruby** | ~200-400 ms | ~500-2000 ms (Rails) |

### Cloudflare Workers (V8 Isolates)

| Runtime | Cold Start | Notes |
|---|---|---|
| **JavaScript/TypeScript** | ~0-5 ms | V8 isolates, not containers; near-zero cold start |
| **Rust (WASM)** | ~0-5 ms | Compiled to WebAssembly; fastest possible |
| **Python (beta)** | ~5-50 ms | Pyodide/Javy; still emerging |

### Container Startup (Docker)

| Language | Image Pull + Start (minimal) | Notes |
|---|---|---|
| **Rust** | ~1-2 sec | 5-15 MB scratch image |
| **Go** | ~1-2 sec | 5-15 MB scratch image |
| **Elixir** | ~2-4 sec | 20-40 MB release |
| **Node.js** | ~3-5 sec | 50-80 MB Alpine |
| **C#** | ~3-5 sec (NativeAOT) / ~5-10 sec (CLR) | 30-80 MB / 100-200 MB |
| **Python** | ~3-6 sec | 40-80 MB Alpine |
| **Java** | ~5-15 sec (JRE) / ~2-4 sec (GraalVM native) | 200-400 MB / 50-100 MB |
| **Ruby** | ~5-10 sec | 80-150 MB |

---

## Concurrency Scaling

How languages handle increasing concurrent connections/requests.

### Connections vs Throughput (Typical REST API, Single Server)

| Concurrent Connections | Rust (Axum) | Go (Gin) | Java (Spring) | Node.js (Fastify) | Python (FastAPI) |
|---|---|---|---|---|---|
| **1** | ~50K rps | ~40K rps | ~30K rps | ~25K rps | ~5K rps |
| **10** | ~200K rps | ~150K rps | ~120K rps | ~80K rps | ~12K rps |
| **100** | ~400K rps | ~300K rps | ~250K rps | ~120K rps | ~18K rps |
| **1,000** | ~500K rps | ~350K rps | ~280K rps | ~130K rps | ~20K rps |
| **10,000** | ~480K rps | ~320K rps | ~250K rps | ~110K rps | ~15K rps |
| **100,000** | ~400K rps | ~250K rps | ~180K rps | ~80K rps | crashes/OOM |

**Key observations:**
- Rust and Go scale most gracefully — near-linear until CPU saturation
- Java scales well but memory grows significantly with connection count
- Node.js peaks around 1K connections then slowly degrades
- Python struggles beyond a few hundred connections per worker

### Memory per Concurrent Connection

| Language | Memory per Connection | 10K Connections |
|---|---|---|
| **Rust** | ~1-5 KB (future/task) | ~10-50 MB |
| **Go** | ~2-8 KB (goroutine) | ~20-80 MB |
| **Elixir** | ~2-3 KB (BEAM process) | ~20-30 MB |
| **Java (virtual threads)** | ~1-5 KB | ~10-50 MB |
| **Java (platform threads)** | ~1 MB (thread stack) | ~10 GB (not feasible) |
| **Node.js** | ~10-30 KB (connection buffer) | ~100-300 MB |
| **C#** | ~5-15 KB (task + buffer) | ~50-150 MB |
| **Python** | ~20-50 KB (coroutine + overhead) | ~200-500 MB |

---

## Compilation Time Comparison

For a medium-sized project (~50K lines of code):

| Language | Clean Build | Incremental Build | Notes |
|---|---|---|---|
| **Go** | 5-15 sec | 1-3 sec | Fastest compiled language |
| **C#** | 5-20 sec | 2-5 sec | Fast incremental; Roslyn is quick |
| **Dart** | 10-30 sec | 2-5 sec (hot reload instead) | Hot reload eliminates most recompiles |
| **Java/Kotlin** | 15-60 sec | 5-15 sec | Gradle overhead; Kotlin slower than Java |
| **TypeScript** | 10-30 sec | 2-5 sec (tsc watch) | Type checking, not full compilation |
| **Swift** | 30-120 sec | 5-30 sec | Notoriously slow; improving |
| **C++** | 60-300+ sec | 10-60 sec | Header parsing, templates, linking |
| **Rust** | 60-300+ sec | 10-60 sec | Monomorphization, borrow checking, LLVM |

**Rust's compile time** is its biggest DX weakness. A clean build of a medium Actix-web project can take 2-5 minutes. Incremental builds are 10-60 seconds. This is a frequently cited reason developers choose Go over Rust.

---

## Binary / Artifact Size

Minimal "Hello World" HTTP server:

| Language | Stripped Binary | With Dependencies | Docker Image |
|---|---|---|---|
| **Rust** | ~1-3 MB (static musl) | ~3-8 MB | ~5-15 MB (scratch) |
| **Go** | ~3-6 MB (static) | ~5-12 MB | ~5-15 MB (scratch) |
| **Zig** | ~100-500 KB | ~500 KB - 2 MB | ~1-5 MB (scratch) |
| **C** | ~50-200 KB | ~200 KB - 1 MB | ~1-5 MB |
| **Dart (AOT)** | ~5-10 MB | ~10-20 MB | ~20-50 MB |
| **Elixir (release)** | ~20-30 MB (BEAM + release) | ~30-50 MB | ~20-40 MB (Alpine) |
| **C#/.NET** | ~10-30 MB (NativeAOT) | ~20-50 MB | ~30-80 MB |
| **Node.js** | N/A (runtime needed) | ~5-20 MB (node_modules) | ~50-80 MB (Alpine) |
| **Python** | N/A (runtime needed) | ~5-30 MB (venv) | ~40-80 MB (Alpine) |
| **Java** | ~50-100 MB (GraalVM native) | ~100-200 MB | ~200-400 MB (JRE) |
| **Ruby** | N/A (runtime needed) | ~20-50 MB (gems) | ~80-150 MB (Alpine) |

---

## The "1 Billion Row Challenge" Results (2024)

Processing 1 billion rows of temperature data — a real-world benchmark testing I/O, parsing, and aggregation:

| Language | Time | Notes |
|---|---|---|
| **Java** | ~1.5 sec | Highly optimized; won the original challenge |
| **C** | ~1.5-2.0 sec | Manual optimization |
| **Rust** | ~1.5-2.0 sec | Competitive with C/Java |
| **Go** | ~3-5 sec | Good but not top tier |
| **C#** | ~2-4 sec | Competitive |
| **Node.js** | ~15-30 sec | V8 not optimized for this workload |
| **Python** | ~5 min+ (CPython) | Needs native extensions to be competitive |
| **Python (Polars)** | ~3-5 sec | Rust-backed library eliminates Python overhead |

**Key insight**: Java's JIT compiler can match C/Rust for well-understood workloads. The JVM is extraordinarily good at optimizing tight loops after warmup.

---

## GC Pause Times

Garbage collection pauses can cause latency spikes that don't show in throughput benchmarks but devastate p99 latency.

| Language/Runtime | Typical GC Pause | Max GC Pause | Notes |
|---|---|---|---|
| **Rust** | 0 ms (no GC) | 0 ms | Deterministic; ownership system |
| **C/C++** | 0 ms (manual) | 0 ms | But memory leaks and use-after-free |
| **Go 1.19+** | <0.5 ms | ~1-2 ms | Concurrent GC; dramatically improved |
| **Go (pre-1.19)** | 1-10 ms | ~50 ms | Still good but noticeable |
| **Java (ZGC)** | <1 ms | ~1-2 ms | Sub-millisecond pause target; production-ready since JDK 15 |
| **Java (G1GC)** | 5-50 ms | ~200 ms | Default GC; tunable |
| **Java (Shenandoah)** | <1 ms | ~1-5 ms | Red Hat's low-latency GC |
| **C# (.NET 8)** | 1-10 ms | ~50 ms | DATAS (Dynamic Adaptation To Application Sizes) improved |
| **Elixir/BEAM** | <1 ms per process | ~1-2 ms | Per-process GC — only small heaps collected |
| **Node.js (V8)** | 1-10 ms | ~50-100 ms | Generational GC; can spike with large heaps |
| **Swift (ARC)** | 0 ms (no tracing GC) | 0 ms (but retain/release overhead) | Reference counting; no pauses but CPU overhead |
| **Python** | 10-100 ms | ~500 ms | Reference counting + cycle collector |
| **Ruby** | 10-100 ms | ~200 ms | Compacting GC (Ruby 3.2+) improved |

**The Discord story revisited**: Discord's Go service had p99 latency spikes every ~2 minutes due to Go's GC. Their Rust rewrite eliminated these entirely. Go's GC has improved significantly since (1.19+), but this remains a valid concern for ultra-low-latency requirements.

---

## Real-World Performance: What Actually Matters

### Throughput in Practice

For a typical REST API with authentication, validation, business logic, and database queries:

| Language | Realistic req/sec (single instance) | Why |
|---|---|---|
| **Rust** | ~20,000-50,000 | Overhead from auth, validation, serialization |
| **Go** | ~15,000-40,000 | Slightly higher framework overhead |
| **C#** | ~10,000-30,000 | .NET overhead; still very fast |
| **Java** | ~8,000-25,000 | JVM overhead; Spring context |
| **Node.js** | ~5,000-15,000 | Single-threaded; V8 overhead |
| **Elixir** | ~3,000-10,000 | BEAM overhead; but excellent p99 |
| **PHP** | ~1,000-5,000 | Per-request model; shared-nothing |
| **Python** | ~500-3,000 | GIL; interpreter overhead |
| **Ruby** | ~500-2,000 | GVL; interpreter overhead |

**The 99% rule**: 99% of applications will never need more than 5,000 req/sec per instance. At that level, **every language is fast enough**. The choice should be based on developer productivity, ecosystem, and hiring — not raw performance.

### When Performance Actually Matters

1. **Scale**: >100K requests/sec total → Go, Rust, C#, or Java reduce server count
2. **Latency**: p99 <10ms requirement → Rust (no GC), Go (low GC), Java (ZGC)
3. **Cost**: At 1000+ servers, language efficiency = cloud cost savings of 40-80%
4. **Edge/Serverless**: Cold start matters → Rust, Go
5. **Embedded/IoT**: Memory constraints → Rust, C, Zig

---

## Summary: Performance Tier List

### Tier 1: Systems-Level Performance
**C, C++, Rust, Zig**
- Near-optimal CPU and memory usage
- No GC pauses
- Suitable for: OS, databases, game engines, embedded

### Tier 2: High Performance with Managed Runtime
**Go, Java (tuned), C#, Kotlin/JVM, Swift**
- Excellent throughput; manageable GC
- Good for: Web servers, microservices, mobile, enterprise

### Tier 3: Productive with Adequate Performance
**Node.js/TypeScript, Dart, Elixir**
- Sufficient for most web applications
- Good for: APIs, real-time apps, mobile backends

### Tier 4: Productivity-First
**Python, Ruby, PHP**
- Slow in benchmarks but fast to develop
- Good for: MVPs, scripts, data science, rapid prototyping
- Can be "fast enough" with proper architecture (caching, CDNs, async tasks)

---

## Sources

1. **TechEmpower Framework Benchmarks Round 22** (October 2023) — techempower.com/benchmarks
2. **Computer Language Benchmarks Game** — benchmarksgame-team.pages.debian.net
3. **Pereira et al.** "Energy Efficiency across Programming Languages" (2017, SLE)
4. **Discord Engineering:** "Why Discord is Switching from Go to Rust" (2020)
5. **1 Billion Row Challenge** — github.com/gunnarmorling/1brc (2024)
6. **Anton Putra** — YouTube/GitHub real-world benchmarks
7. **Kostya Benchmarks** — github.com/kostya/benchmarks
8. **GraalVM documentation** — graalvm.org
9. **Go GC improvements** — tip.golang.org/doc/gc-guide
10. **Java ZGC** — wiki.openjdk.org/display/zgc
11. **Bun benchmarks** — bun.sh/docs
12. **Python 3.13 free-threading** — PEP 703
