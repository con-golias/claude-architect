# C#/.NET: Performance Profile

> **Domain:** Languages > C#/.NET
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## .NET Performance Revolution

.NET has undergone a **dramatic performance transformation** since .NET Core. Each release brings 10-30% improvements in throughput, memory, and startup. .NET 8/9 are competitive with Go and approaching Rust in many benchmarks.

## RyuJIT & Tiered Compilation

### Compilation Pipeline

| Tier | What | Speed | Optimization Level |
|------|------|-------|-------------------|
| **Tier 0** | Quick JIT, minimal optimization | Instant | None (get running fast) |
| **Tier 1** | Full optimization with profiling data | Fast | High |
| **Dynamic PGO** | Profile-guided re-compilation | Background | Best |
| **On-Stack Replacement** | Upgrade running method to Tier 1 | Seamless | High |

```
IL Code → Tier 0 (quick JIT) → Run → Profile → Tier 1 (optimized) → Run
                                                     ↓
                                              Dynamic PGO
                                         (profile-guided optimization)
```

**Dynamic PGO** (.NET 7+, default .NET 8+): The JIT collects runtime type profiles and recompiles hot methods with speculative devirtualization, guarded type checks, and branch prediction — similar to JVM C2 but with faster warmup.

### Key JIT Optimizations

```
RyuJIT Optimization Pipeline
├── Inlining — inline small/hot methods
├── Devirtualization — remove virtual dispatch
├── Loop optimizations — unrolling, hoisting, cloning
├── Bounds check elimination — remove array bounds checks
├── SIMD vectorization — auto-vectorize loops
├── Escape analysis — stack-allocate non-escaping objects
├── Dead code elimination
├── Constant folding/propagation
└── Hardware intrinsics — AVX2, AVX-512, ARM NEON
```

## Garbage Collector

### GC Modes

| Mode | When Used | Throughput | Latency |
|------|----------|------------|---------|
| **Workstation GC** | Desktop/client apps | Lower | Better responsiveness |
| **Server GC** | Web servers | Higher | May pause longer |
| **Concurrent** | Default (both modes) | Good | Non-blocking Gen 2 |
| **Regions-based** | .NET 8+ Server GC | Best | More efficient compaction |

### Generational Collection

| Generation | Contains | Collection Frequency | Typical Size |
|-----------|----------|---------------------|-------------|
| **Gen 0** | New allocations | Very frequent (~ms) | ~256KB-4MB |
| **Gen 1** | Survived Gen 0 | Frequent | ~512KB-4MB |
| **Gen 2** | Long-lived objects | Rare | Unlimited |
| **LOH/POH** | Large objects (>85KB) | With Gen 2 | Unlimited |

### GC Pause Times (.NET 8/9)

| Configuration | P50 Pause | P99 Pause | Max Pause |
|--------------|-----------|-----------|-----------|
| Server GC (regions) | 1-5ms | 10-30ms | 50ms |
| Workstation GC | 1-3ms | 5-15ms | 30ms |
| DATAS (.NET 9) | <1ms | 2-5ms | 10ms |
| Native AOT | Similar | Similar | Similar |

**DATAS** (Dynamic Adaptation To Application Sizes): .NET 9's new GC mode that dynamically adjusts heap size and collection behavior.

## TechEmpower Benchmarks (Round 22)

| Framework | JSON (req/s) | DB Single | Fortunes | Multiple Queries |
|-----------|-------------|-----------|----------|-----------------|
| **ASP.NET Core (Platform)** | ~650K | ~350K | ~280K | ~60K |
| **ASP.NET Core (Minimal)** | ~500K | ~250K | ~200K | ~45K |
| Go (net/http) | ~300K | ~200K | ~160K | ~30K |
| Java (Vert.x) | ~650K | ~350K | ~280K | ~60K |
| Node.js (fastify) | ~250K | ~100K | ~80K | ~15K |
| Rust (actix) | ~700K | ~400K | ~320K | ~70K |

**Key insight**: ASP.NET Core is **one of the fastest web frameworks in any language** — consistently top-5 in TechEmpower across all categories.

## Startup Time & Memory

### Startup Time Comparison

| Configuration | Cold Start | Memory (Idle) |
|--------------|-----------|---------------|
| .NET 8 (JIT) | ~100-200ms | ~50-80MB |
| .NET 8 (R2R) | ~60-100ms | ~40-60MB |
| **Native AOT** | **~10-30ms** | **~15-30MB** |
| Java 21 (JIT) | 500ms-3s | ~200MB |
| Go | ~5-10ms | ~10-20MB |
| Node.js | ~50-100ms | ~40-60MB |

### Native AOT Performance

| Metric | JIT (.NET 8) | Native AOT |
|--------|-------------|------------|
| Startup | ~150ms | **~15ms** |
| Memory (idle) | ~60MB | **~20MB** |
| Peak throughput | Best | 90-95% of JIT |
| Binary size | ~5MB (framework-dependent) | ~10-30MB (self-contained) |
| Build time | Seconds | 30s-2min |
| Reflection | Full | Limited (trimmed) |
| Dynamic code | Full | Not supported |

```bash
# Publish as Native AOT
dotnet publish -c Release -r linux-x64 --self-contained \
  /p:PublishAot=true /p:StripSymbols=true

# Result: single native binary, ~15ms startup, ~20MB memory
```

## Value Types & Memory Efficiency

### struct vs class Performance

```csharp
// Reference type (class) — heap allocated, GC pressure
public class PointClass { public double X, Y; }

// Value type (struct) — stack allocated, zero GC
public readonly struct PointStruct(double X, double Y);

// Performance difference:
// Creating 10M PointClass: ~200ms, ~160MB heap, triggers GC
// Creating 10M PointStruct: ~10ms, ~0MB heap, no GC
```

### Span<T> for Zero-Allocation Processing

```csharp
// Traditional string parsing (allocates substrings)
string[] parts = input.Split(',');  // allocates array + strings

// Zero-allocation parsing with Span
public static bool TryParseCoordinate(ReadOnlySpan<char> input,
    out double lat, out double lng)
{
    var comma = input.IndexOf(',');
    if (comma < 0) { lat = lng = 0; return false; }

    return double.TryParse(input[..comma], out lat)
        && double.TryParse(input[(comma + 1)..], out lng);
    // Zero allocations!
}
```

## .NET Performance Features

### Object Pooling

```csharp
// ObjectPool for expensive objects
var pool = new DefaultObjectPool<StringBuilder>(
    new StringBuilderPooledObjectPolicy { MaximumRetainedCapacity = 4096 });

var sb = pool.Get();
try
{
    sb.Append("Hello");
    return sb.ToString();
}
finally
{
    pool.Return(sb);
}

// ArrayPool for temporary buffers
var buffer = ArrayPool<byte>.Shared.Rent(8192);
try { /* use buffer */ }
finally { ArrayPool<byte>.Shared.Return(buffer); }
```

### Frozen Collections (.NET 8)

```csharp
// FrozenDictionary — optimized for read-heavy, create-once collections
// 2-5x faster lookups than Dictionary
private static readonly FrozenDictionary<string, Handler> Routes =
    new Dictionary<string, Handler>
    {
        ["/api/users"] = new UserHandler(),
        ["/api/orders"] = new OrderHandler(),
    }.ToFrozenDictionary();

// FrozenSet
private static readonly FrozenSet<string> ValidCountries =
    new[] { "US", "CA", "UK", "DE", "FR" }.ToFrozenSet();
```

### SIMD & Hardware Intrinsics

```csharp
// .NET auto-vectorizes many operations
// Manual SIMD for maximum performance
public static int SumVectorized(ReadOnlySpan<int> values)
{
    var sum = Vector<int>.Zero;
    int i = 0;

    // Process Vector<int>.Count elements at a time (8 on AVX2)
    for (; i <= values.Length - Vector<int>.Count; i += Vector<int>.Count)
    {
        sum += new Vector<int>(values[i..]);
    }

    int total = Vector.Dot(sum, Vector<int>.One);
    for (; i < values.Length; i++) total += values[i];
    return total;
}
// ~4-8x faster than scalar loop
```

## Serverless Cold Starts

| Configuration | Cold Start | Memory |
|--------------|-----------|--------|
| .NET 8 (Lambda, JIT) | 800ms-2s | ~120MB |
| .NET 8 (Lambda, R2R) | 400-800ms | ~100MB |
| .NET 8 (Lambda, Native AOT) | **~100-200ms** | **~50MB** |
| .NET 8 (Azure Functions) | 500ms-1.5s | ~100MB |
| Go (Lambda) | 8-15ms | ~30MB |
| Node.js (Lambda) | 100-300ms | ~80MB |

**Native AOT + Lambda** makes .NET competitive with Node.js for serverless cold starts while maintaining type safety and performance.

## Profiling & Diagnostic Tools

| Tool | Type | Key Feature |
|------|------|-------------|
| **dotnet-counters** | Metrics | Live performance counters |
| **dotnet-trace** | Tracing | Collect ETW/EventPipe traces |
| **dotnet-dump** | Memory | Analyze heap dumps |
| **dotnet-gcdump** | GC analysis | GC heap snapshots |
| **BenchmarkDotNet** | Microbenchmarks | Statistical benchmarking (industry standard) |
| **PerfView** | Full profiler | Microsoft's performance tool |
| **JetBrains dotTrace** | CPU profiler | Commercial, timeline analysis |
| **JetBrains dotMemory** | Memory profiler | Commercial, allocation analysis |
| **Visual Studio Profiler** | Integrated | CPU, memory, database, async |

```csharp
// BenchmarkDotNet — the gold standard for .NET microbenchmarks
[MemoryDiagnoser]
[SimpleJob(RuntimeMoniker.Net80)]
public class ParsingBenchmarks
{
    [Benchmark(Baseline = true)]
    public void StringSplit() => "hello,world".Split(',');

    [Benchmark]
    public void SpanParse()
    {
        var span = "hello,world".AsSpan();
        var comma = span.IndexOf(',');
        _ = span[..comma];
        _ = span[(comma + 1)..];
    }
}
// SpanParse: 0 allocations, ~5x faster
```

## Performance History (.NET Core → .NET 9)

| Benchmark | .NET Core 3.1 | .NET 6 | .NET 8 | .NET 9 |
|-----------|--------------|--------|--------|--------|
| JSON serialization | 1.0x | 1.5x | **2.5x** | **3.0x** |
| TechEmpower JSON | ~300K | ~450K | ~600K | ~650K |
| LINQ performance | 1.0x | 1.3x | **2.0x** | **2.5x** |
| Regex | 1.0x | **3x** (source gen) | **5x** | **6x** |
| Startup time | 200ms | 150ms | 100ms | 80ms |

The .NET team publishes detailed performance reports with every release, tracking thousands of benchmarks.

## Real-World Performance Stories

### Stack Overflow
- Entire site runs on .NET
- ~50M page views/day on **9 web servers**
- Response times: 10-20ms average
- One of the most efficient websites per server

### Bing
- Microsoft's search engine runs on .NET
- Billions of queries processed
- Sub-100ms response times

### Unity
- C# as scripting language for ~50% of all games
- IL2CPP (AOT compiler) for mobile game performance
- Burst Compiler for SIMD-heavy game logic

### Microsoft Teams
- Backend services on .NET
- Millions of concurrent users
- Migrated from Node.js to .NET for performance

## Sources

- [.NET Performance Blog](https://devblogs.microsoft.com/dotnet/category/performance/)
- [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/)
- [BenchmarkDotNet](https://benchmarkdotnet.org/)
- [.NET Performance Reports](https://github.com/dotnet/performance)
- [Adam Sitnik's Blog](https://adamsitnik.com/) — .NET performance
