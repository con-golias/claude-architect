# Rust: Performance Profile

> **Domain:** Languages > Rust
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## Zero-Cost Abstractions

Rust's core performance principle: **high-level abstractions compile to the same machine code as hand-written low-level code**.

```rust
// Iterator chain — compiles to the SAME assembly as a manual loop
let sum: i32 = data.iter()
    .filter(|x| **x > 0)
    .map(|x| x * 2)
    .sum();

// Equivalent manual loop (same assembly output):
let mut sum = 0i32;
for x in &data {
    if *x > 0 {
        sum += x * 2;
    }
}
```

**Monomorphization**: Generic functions generate specialized machine code for each concrete type — no runtime dispatch overhead.

## Memory Layout

### No Runtime Overhead

| Feature | Rust | Go | Java | Python |
|---------|------|-----|------|--------|
| Runtime | None (no GC) | ~10MB (GC + scheduler) | ~30MB (JVM) | ~20MB (interpreter) |
| Integer (i32) | 4 bytes | 4 bytes | 16+ bytes (boxed) | 28 bytes |
| Struct `{x: i32, y: i32}` | 8 bytes | 8 bytes | 16+ bytes (object header) | ~120 bytes |
| Array of 1000 i32 | 4 KB (contiguous) | 4 KB | 4-16 KB | ~28 KB |
| String "hello" | 5 bytes data + 24 bytes String | 5 bytes + 16 bytes header | 5 bytes + ~40 bytes | 54 bytes |

### Stack vs Heap

```rust
// Stack allocation (default, fast ~1ns)
let x = 42;                // Stack
let point = Point { x: 1.0, y: 2.0 }; // Stack
let arr = [0u8; 1024];     // Stack

// Heap allocation (explicit, ~25ns)
let boxed = Box::new(42);  // Heap
let vec = vec![1, 2, 3];   // Heap (data), stack (pointer, len, cap)
let string = String::from("hello"); // Heap (data), stack (pointer, len, cap)
```

## Benchmarks

### TechEmpower Framework Benchmarks (Round 22)

| Framework | JSON (req/s) | DB Single | Fortunes | Multiple Queries |
|-----------|-------------|-----------|----------|------------------|
| **Actix** | ~700K | ~400K | ~320K | ~70K |
| **Axum** | ~600K | ~350K | ~280K | ~60K |
| **Warp** | ~580K | ~320K | ~260K | ~55K |
| Go (Fiber) | ~400K | ~150K | ~120K | ~30K |
| Java (Vert.x) | ~650K | ~350K | ~280K | ~60K |
| C++ (drogon) | ~700K | ~420K | ~340K | ~75K |

### Computer Language Benchmarks Game

| Benchmark | Rust | C | Go | Java | Python |
|-----------|------|---|-----|------|--------|
| binary-trees | 0.8s | 1.5s | 3.8s | 1.2s | 24.5s |
| fannkuch-redux | 2.1s | 2.0s | 6.2s | 4.5s | 133s |
| mandelbrot | 1.1s | 1.1s | 4.1s | 2.8s | 103s |
| n-body | 2.3s | 2.2s | 5.8s | 5.2s | 128s |
| **Geometric mean vs C** | **~1.0x** | **1.0x** | **~2.5x** | **~1.8x** | **~75x** |

**Rust matches C within 3%** on most benchmarks, sometimes faster due to better bounds-check elimination and LLVM optimizations.

### 1 Billion Row Challenge (1BRC)

| Language | Time | Notes |
|----------|------|-------|
| Rust (optimized) | ~1.5s | Custom hash, SIMD, mmap |
| C (optimized) | ~1.6s | Similar techniques |
| Java (optimized) | ~1.9s | Unsafe + custom parsing |
| Go | ~4.5s | GC overhead on large heap |

## Energy Efficiency

From Pereira et al. research (2017/2021):

| Language | Energy (normalized) | Time (normalized) | Memory (normalized) |
|----------|--------------------|--------------------|---------------------|
| **C** | 1.00x | 1.00x | 1.00x |
| **Rust** | 1.03x | 1.04x | 1.54x |
| C++ | 1.34x | 1.56x | 1.34x |
| Java | 1.98x | 1.89x | 6.01x |
| Go | 3.23x | 2.83x | 1.05x |
| JavaScript | 4.45x | 6.52x | 4.59x |
| Python | 75.88x | 71.90x | 2.80x |

## Compilation Time

Rust's main performance weakness is **compile time**:

| Project Size | Debug Build | Release Build | Incremental (small change) |
|-------------|------------|--------------|---------------------------|
| Small (1K lines) | ~2s | ~5s | <1s |
| Medium (50K lines) | ~30s | ~2min | ~5s |
| Large (500K lines) | ~5min | ~15min | ~30s |
| Very large (1M+ lines) | ~10-20min | ~30min+ | ~1-2min |

### Improving Compile Times

| Technique | Impact | How |
|-----------|--------|-----|
| `cargo check` | Skip codegen | Type checking only, 2-5x faster |
| `sccache` | Shared cache | Cache across projects |
| `mold` linker (Linux) | 5-10x faster linking | `RUSTFLAGS="-C linker=clang -C link-arg=-fuse-ld=mold"` |
| `lld` linker (cross-platform) | 2-5x faster linking | Bundled with LLVM |
| Split crates | Better parallelism | Smaller compilation units |
| `cargo-nextest` | Parallel test runner | Faster than `cargo test` |
| Reduce proc macros | Less codegen | Minimize derive macros in hot paths |

## Binary Size

| Configuration | Hello World | Web Server (Axum) |
|--------------|------------|-------------------|
| Debug | ~4 MB | ~40 MB |
| Release | ~500 KB | ~10 MB |
| Release + strip | ~300 KB | ~6 MB |
| Release + strip + LTO | ~250 KB | ~5 MB |
| Release + opt-size (opt-level="z") | ~200 KB | ~4 MB |

```toml
# Cargo.toml — optimize for size
[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link-Time Optimization
codegen-units = 1   # Better optimization (slower compile)
panic = "abort"     # Don't include unwinding code
strip = true        # Strip debug info
```

## Profiling Tools

| Tool | Type | Platform | Best For |
|------|------|----------|---------|
| `perf` | CPU sampling | Linux | Overall CPU profiling |
| `cargo flamegraph` | Flame graphs | Linux/macOS | Visual CPU hotspots |
| `criterion` | Benchmarking | All | Statistical benchmarks with CI |
| `dhat` | Heap profiling | All | Allocation analysis |
| `heaptrack` | Heap profiling | Linux | Memory leak detection |
| **Miri** | UB detection | All | Find undefined behavior in unsafe code |
| `cargo-instruments` | Instruments | macOS | Xcode Instruments integration |
| `tracy` | Frame profiler | All | Real-time profiling (games) |

## Real-World Performance Stories

### Discord: Go → Rust
- Migrated Read States service from Go to Rust
- Problem: Go's GC paused every 2 minutes (~100ms), causing tail latency spikes
- Result: Rust — no GC pauses, consistent latency, less memory
- "Rust's performance is consistent. We don't have to worry about GC pauses."

### Cloudflare
- Rust for Pingora (replacing nginx), firewall rules, Workers runtime
- Handles millions of requests per second
- "Rust gives us the confidence that our code is memory-safe"

### AWS (Firecracker)
- Firecracker microVM: ~5ms boot time, 5MB memory overhead
- Written in Rust for security and performance
- Powers AWS Lambda and Fargate

### Figma
- Multiplayer engine rewritten from TypeScript (WASM) to Rust (WASM)
- 3x improvement in frame rate
- Memory usage significantly reduced

### Dropbox
- Sync engine rewritten from Python to Rust
- Better memory safety, performance, and predictability

## WebAssembly Performance

| Metric | Rust→WASM | C→WASM | AssemblyScript→WASM | JavaScript |
|--------|-----------|--------|--------------------|----|
| Execution speed | ~1.2-2x native | ~1.2-2x native | ~2-3x native | ~5-20x native |
| Bundle size (min) | ~20 KB | ~15 KB | ~10 KB | N/A |
| Load time | Fast | Fast | Fast | Depends |
| Tooling | wasm-pack, trunk | emscripten | asc | N/A |

## Sources

- [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/)
- [Computer Language Benchmarks Game](https://benchmarksgame-team.pages.debian.net/)
- [Pereira et al. — Energy Efficiency](https://greenlab.di.uminho.pt/wp-content/uploads/2017/10/sleFinal.pdf)
- [Rust Performance Book](https://nnethercote.github.io/perf-book/)
- [Discord Blog — Rust Rewrite](https://discord.com/blog/why-discord-is-switching-from-go-to-rust)
