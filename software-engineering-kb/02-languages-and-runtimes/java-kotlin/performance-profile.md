# Java/Kotlin: Performance Profile

> **Domain:** Languages > Java/Kotlin
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## JVM Warmup & JIT Compilation

### Tiered Compilation Pipeline

| Tier | Compiler | Compilation Speed | Code Quality | When Used |
|------|---------|-------------------|-------------|-----------|
| 0 | Interpreter | Instant | Lowest | First invocation |
| 1 | C1 (Client) | Fast | Basic | Methods called a few times |
| 2 | C1 + profiling | Fast | Basic + counters | Collecting type profiles |
| 3 | C1 + full profiling | Fast | Basic + full profiles | Hot methods profiling |
| 4 | C2 (Server) / Graal | Slow | Best | Hot methods (10K+ invocations) |

**Warmup time**: Java requires **30-120 seconds** to reach peak performance as the JIT progressively optimizes hot paths.

### Profile-Guided Optimization

```
Cold Start → Tier 0 (interpret) → Tier 3 (profile) → Tier 4 (optimize)

Key JIT optimizations:
├── Inlining — inline frequently called methods
├── Escape Analysis — stack-allocate objects that don't escape
├── Loop Unrolling — eliminate loop overhead
├── Dead Code Elimination — remove unreachable code
├── Speculative Devirtualization — inline virtual calls based on profiling
└── Intrinsics — replace known methods with CPU-specific instructions
```

## Garbage Collectors

| GC | Java Version | Pause Target | Throughput | Best For |
|----|-------------|-------------|-----------|---------|
| **Serial** | All | N/A | Low | Single-core, small heaps (<100MB) |
| **Parallel** | All | N/A | Best | Batch processing, throughput-first |
| **G1** (default) | 9+ | ~200ms | Good | General purpose, balanced |
| **ZGC** | 15+ (production) | **<1ms** | Good | Low-latency, large heaps (TBs) |
| **Shenandoah** | 12+ (Red Hat) | **<1ms** | Good | Low-latency, alternative to ZGC |
| **Epsilon** | 11+ | No GC (!) | N/A | Testing, very short-lived processes |

### GC Pause Time Comparison

| GC | P50 Pause | P99 Pause | Max Pause | Heap Support |
|----|-----------|-----------|-----------|-------------|
| G1 | 5-10ms | 20-50ms | 50-200ms | Up to ~32GB |
| ZGC | 0.05ms | 0.5ms | 1ms | Up to **16TB** |
| Shenandoah | 0.1ms | 1ms | 2ms | Up to ~1TB |
| Parallel | 50ms | 200ms | 500ms+ | Any |

## Virtual Threads Performance (Java 21)

| Metric | Platform Threads | Virtual Threads |
|--------|-----------------|-----------------|
| Creation cost | ~1MB stack, OS thread | ~1KB, JVM managed |
| Max practical count | ~10K (OS limit) | **Millions** |
| Context switch | ~1-10μs (OS) | ~200ns (JVM) |
| Blocking I/O | Blocks OS thread | Unmounts from carrier thread |
| CPU-bound performance | Same | Same (still uses carrier threads) |

```java
// Benchmark: 100K concurrent HTTP requests
// Platform threads: 20 seconds (limited to ~200 threads)
// Virtual threads: 2 seconds (100K concurrent tasks)
```

## TechEmpower Benchmarks (Round 22)

| Framework | JSON (req/s) | DB Single | Fortunes | Multiple Queries |
|-----------|-------------|-----------|----------|------------------|
| **Vert.x** (Java) | ~650K | ~350K | ~280K | ~60K |
| **Quarkus** (Java) | ~400K | ~200K | ~160K | ~35K |
| **Micronaut** (Java) | ~380K | ~180K | ~140K | ~30K |
| **Spring WebFlux** | ~250K | ~120K | ~95K | ~20K |
| **Spring MVC** | ~100K | ~50K | ~40K | ~10K |
| **Ktor** (Kotlin) | ~200K | ~100K | ~80K | ~18K |
| Go (net/http) | ~300K | ~200K | ~160K | ~30K |
| Rust (actix) | ~700K | ~400K | ~320K | ~70K |

**Key insight**: Framework choice within Java creates larger performance gaps than language choice. Vert.x is 6x faster than Spring MVC.

## GraalVM Native Image

| Metric | JVM (Java 21) | GraalVM Native |
|--------|--------------|----------------|
| Startup time | 500ms-3s | **10-50ms** |
| Memory (idle Spring Boot) | ~200MB | **~50MB** |
| Peak throughput | Best (after warmup) | 80-90% of JVM |
| Build time | Seconds | 2-10 minutes |
| Reflection | Full | Requires configuration |
| Dynamic classloading | Full | Limited |
| Debug | Full | Limited |

```bash
# GraalVM native image
# Spring Boot 3+ / Quarkus / Micronaut have built-in support
./mvnw -Pnative native:compile
# Result: 10ms startup, 50MB memory, single binary
```

## Kotlin Coroutines vs Java Virtual Threads

| Feature | Kotlin Coroutines | Java Virtual Threads |
|---------|------------------|---------------------|
| Level | Language feature (suspend) | Platform feature (Thread) |
| Structured concurrency | Built-in (coroutineScope) | Preview (StructuredTaskScope) |
| Cancellation | Built-in (Job, cancel) | Via interruption |
| Channels | Built-in (Channel) | Not built-in |
| Flow (reactive streams) | Built-in (Flow) | Not built-in |
| Backpressure | Built-in (buffer, conflate) | Manual |
| API compatibility | Requires suspend functions | Works with existing blocking code |
| Performance overhead | Minimal | Minimal |
| Learning curve | Medium | Low (same Thread API) |

## Serverless Cold Starts

| Configuration | Cold Start | Memory |
|--------------|-----------|--------|
| Java 21 (Lambda) | 2-5 seconds | ~200MB |
| Java 21 + SnapStart | **100-200ms** | ~200MB |
| Java + GraalVM Native | **50-100ms** | ~70MB |
| Quarkus Native | **30-80ms** | ~50MB |
| Spring Boot Native | **50-150ms** | ~70MB |
| Go (comparison) | 8-15ms | ~30MB |
| Node.js (comparison) | 100-300ms | ~100MB |

## Real-World Performance

### Netflix
- Java powers most backend services
- Custom frameworks (Zuul, Eureka, Hystrix) built on JVM
- JVM tuning is a core competency: G1/ZGC tuning, JFR for production profiling

### LinkedIn
- One of the largest Java deployments in the world
- Custom RPC framework (Rest.li) on JVM
- Migrated key services to Java 21 virtual threads

### Twitter/X
- Scala/Java on JVM for core services
- JVM performance tuning at extreme scale

### Amazon
- Java is the primary backend language
- AWS SDK for Java, Lambda SnapStart
- Corretto: Amazon's Java distribution

## Profiling Tools

| Tool | Type | Cost | Best For |
|------|------|------|---------|
| **JFR** (Java Flight Recorder) | Full profiling | Free (built-in) | Production profiling with <1% overhead |
| **async-profiler** | CPU/Allocation | Free | Sampling without safepoint bias |
| **JProfiler** | Full profiler | Commercial | GUI-based profiling |
| **YourKit** | Full profiler | Commercial | Memory analysis |
| **VisualVM** | Basic profiler | Free | Quick analysis |
| **JMH** | Microbenchmarks | Free | Accurate microbenchmarks |
| **jcmd** | Diagnostic | Free (built-in) | GC info, thread dumps |

```java
// JMH — Java Microbenchmark Harness
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
public class MyBenchmark {
    @Benchmark
    public void testMethod(Blackhole bh) {
        bh.consume(computeResult());
    }
}
```

## Sources

- [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/)
- [JVM Performance Engineering](https://inside.java/tag/performance/) — Inside.java
- [GraalVM Documentation](https://www.graalvm.org/docs/)
- [Java Flight Recorder Guide](https://docs.oracle.com/en/java/java-components/jdk-mission-control/)
