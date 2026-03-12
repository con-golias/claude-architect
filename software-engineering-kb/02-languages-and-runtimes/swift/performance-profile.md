# Swift: Performance Profile

> **Domain:** Languages > Swift
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## Swift Performance Overview

Swift is designed to be **as fast as C** while being safe. It compiles to native code via LLVM, uses ARC instead of GC, and has first-class value types — all contributing to predictable, high performance.

## Compilation & Optimization

### LLVM Optimization Pipeline

| Optimization Level | Flag | Speed | Use Case |
|-------------------|------|-------|----------|
| None | `-Onone` | Debug speed, full debug info | Development |
| Optimize for speed | `-O` | ~2-10x faster than -Onone | Release builds |
| Optimize for size | `-Osize` | Slightly slower than -O | Size-constrained |
| Whole Module Optimization | `-wmo` | Best (cross-file optimization) | Release (default) |

### Key Compiler Optimizations

```
Swift Optimizer Pipeline
├── SIL-level (Swift-specific)
│   ├── ARC optimization — remove redundant retain/release
│   ├── Generic specialization — monomorphize hot generics
│   ├── Devirtualization — inline protocol witness calls
│   ├── Copy-on-Write optimization — avoid unnecessary copies
│   └── Existential specialization — remove protocol box overhead
├── LLVM-level (shared with C/C++)
│   ├── Inlining
│   ├── Loop vectorization (SIMD)
│   ├── Dead code elimination
│   ├── Constant propagation
│   └── Tail call optimization
└── Whole Module Optimization
    ├── Cross-file inlining
    ├── Global dead code elimination
    └── Cross-module specialization
```

## Memory Model — ARC

### ARC vs GC Performance

| Metric | ARC (Swift) | GC (Java/Go) | Manual (C/Rust) |
|--------|-------------|--------------|-----------------|
| Latency spikes | **None** | GC pauses (1-200ms) | None |
| Throughput overhead | ~5-10% (retain/release) | ~5-15% (GC thread) | 0% |
| Memory overhead | Low (8 bytes/object) | Higher (GC metadata) | None |
| Predictability | **Deterministic** | Non-deterministic | Deterministic |
| Cycle handling | Manual (weak/unowned) | Automatic | N/A (ownership) |
| Deallocation | **Immediate** | Delayed (GC batch) | Immediate |

### Value Types Performance

```swift
// Value types avoid heap allocation entirely
struct Point {
    var x: Double  // 8 bytes
    var y: Double  // 8 bytes
}
// Total: 16 bytes on stack, zero ARC overhead, zero heap allocation

// vs reference type
class PointClass {
    var x: Double
    var y: Double
    // Metadata: 16 bytes (isa + refcount) + 16 bytes payload = 32 bytes on heap
    // Plus: ARC retain/release calls, potential cache misses
}

// Performance difference for 1M iterations:
// struct Point: ~2ms (stack, inline, contiguous memory)
// class PointClass: ~15ms (heap alloc, ARC, cache misses)
```

### Copy-on-Write (CoW)

```swift
// Swift collections use CoW — copies are free until mutation
var array1 = [1, 2, 3, 4, 5]
var array2 = array1  // NO copy — shared buffer

array2.append(6)     // NOW copy happens (mutating shared data)
// array1 is unchanged

// Custom CoW for your own types
struct MyData {
    private var storage: Storage

    private class Storage {
        var items: [Int]
        init(items: [Int]) { self.items = items }
    }

    mutating func append(_ item: Int) {
        if !isKnownUniquelyReferenced(&storage) {
            storage = Storage(items: storage.items)  // Copy on write
        }
        storage.items.append(item)
    }
}
```

## Benchmarks

### Computer Language Benchmarks Game (CLBG)

| Benchmark | Swift | C | Rust | Go | Java |
|-----------|-------|---|------|-----|------|
| n-body | 1.1x | 1.0x | 1.0x | 1.1x | 0.9x |
| binary-trees | 1.3x | 1.0x | 1.1x | 1.2x | 0.9x |
| spectral-norm | 1.0x | 1.0x | 1.0x | 1.1x | 0.9x |
| mandelbrot | 1.0x | 1.0x | 1.0x | 1.2x | 1.0x |
| fasta | 1.2x | 1.0x | 1.0x | 1.3x | 1.1x |
| regex-redux | 1.5x | 1.2x | 1.0x | 1.3x | 1.1x |

*Values relative to C (1.0x). Lower is better.*

**Key insight**: Swift is **within 10-30% of C** for most computational benchmarks. It's significantly faster than Go, Java, and Dart for CPU-bound tasks.

### Server-Side Benchmarks

| Framework | JSON (req/s) | DB Single | Plaintext |
|-----------|-------------|-----------|-----------|
| **Vapor** (Swift) | ~150K | ~80K | ~300K |
| **Hummingbird** (Swift) | ~200K | ~100K | ~400K |
| Express (Node.js) | ~80K | ~30K | ~150K |
| Gin (Go) | ~200K | ~100K | ~350K |
| Actix (Rust) | ~500K | ~300K | ~700K |
| ASP.NET Core | ~400K | ~250K | ~600K |

**Note**: Swift server frameworks are competitive with Go but haven't reached the optimization level of Rust/.NET. The ecosystem is smaller, so these numbers may improve.

## iOS App Performance

### App Launch Time

| Phase | Budget | What Happens |
|-------|--------|-------------|
| Pre-main | <400ms | dyld loading, ObjC/Swift runtime setup |
| Post-main | <200ms | App initialization, first view render |
| **Total target** | **<600ms** | Apple's guideline for cold launch |

### Launch Optimization

| Technique | Impact |
|-----------|--------|
| Reduce dynamic frameworks | -50-200ms (fewer dyld loads) |
| Lazy initialization | Defer work until needed |
| Avoid +load / static initializers | Move work out of pre-main |
| Use Swift (not ObjC) | Less runtime overhead |
| Asset catalogs | Optimized asset loading |
| Merge frameworks (Xcode 15+) | Reduces framework count |

### App Size

| Component | Typical Size |
|-----------|-------------|
| Swift runtime (included in iOS 12.2+) | 0 bytes (shipped with OS) |
| App binary (thin, one architecture) | 5-20MB |
| Assets | Varies |
| Typical total (App Store) | 15-50MB |

### Memory Performance

| Metric | Swift | Objective-C |
|--------|-------|-------------|
| struct (value type) | Stack (0 heap alloc) | N/A (no value types) |
| Small string | Inline (no heap alloc) | Always heap |
| Array<Int> | Contiguous buffer | NSArray (boxed objects) |
| ARC overhead | Optimized by compiler | Same ARC, less optimization |

## Profiling Tools

| Tool | Type | Key Feature |
|------|------|-------------|
| **Instruments** (Xcode) | Full profiler | Time Profiler, Allocations, Leaks, Energy |
| **Xcode Organizer** | Production metrics | Crash reports, performance data from users |
| **MetricKit** | Runtime metrics | Launch time, hang rate, memory (from users) |
| **os_signpost** | Custom instrumentation | Mark regions in Instruments timeline |
| **XCTest Metrics** | Performance testing | Measure in tests with baselines |
| **Memory Graph Debugger** | Memory leaks | Visual retain cycle detection |

```swift
// os_signpost for custom instrumentation
import os

let logger = Logger(subsystem: "com.app", category: "networking")
let signposter = OSSignposter(logger: logger)

func fetchData() async throws -> Data {
    let state = signposter.beginInterval("fetchData")
    defer { signposter.endInterval("fetchData", state) }

    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}
// Shows up as named interval in Instruments
```

### Performance Testing

```swift
// XCTest performance measurement
func testSortingPerformance() throws {
    let data = (0..<10_000).map { _ in Int.random(in: 0...1_000_000) }

    measure(metrics: [
        XCTClockMetric(),
        XCTMemoryMetric(),
        XCTCPUMetric()
    ]) {
        _ = data.sorted()
    }
}
```

## Swift 6 Performance Improvements

### Embedded Swift

```swift
// Embedded Swift — subset of Swift for constrained environments
// No runtime, no heap, no ARC — runs on microcontrollers
// Target: ARM Cortex-M, RISC-V

@main
struct LEDBlink {
    static func main() {
        let led = DigitalOut(pin: .D13)
        while true {
            led.toggle()
            sleep(milliseconds: 500)
        }
    }
}
// Compiles to ~10KB binary for bare-metal ARM
```

### Non-Copyable Types

```swift
// ~Copyable — move-only types (like Rust's ownership)
struct FileHandle: ~Copyable {
    private let fd: Int32

    init(path: String) { fd = open(path) }

    consuming func close() {
        // Takes ownership, prevents double-close
        systemClose(fd)
    }

    deinit {
        systemClose(fd)
    }
}

var file = FileHandle(path: "/tmp/data.txt")
file.close()
// file.close()  // Compile error — already consumed
```

## Real-World Performance

### Apple Apps
- All Apple apps built with Swift/SwiftUI (iOS 17+)
- Mail, Notes, Health, Maps — Swift-native
- 60fps UI rendering is mandatory for App Store

### Uber
- iOS app primarily in Swift
- Performance-critical ride matching UI
- Migrated from Objective-C for safety + performance

### Airbnb
- Large-scale iOS app in Swift
- Custom design system, complex animations
- Detailed performance profiling pipeline

### LinkedIn
- iOS app with millions of daily users
- Heavy list scrolling optimization
- Swift + UIKit performance tuning

## Sources

- [Swift Performance Best Practices](https://github.com/apple/swift/blob/main/docs/OptimizationTips.rst)
- [WWDC Performance Sessions](https://developer.apple.com/videos/all-videos/?q=performance)
- [Computer Language Benchmarks Game](https://benchmarksgame-team.pages.debian.net/benchmarksgame/)
- [Instruments User Guide](https://developer.apple.com/documentation/instruments)
