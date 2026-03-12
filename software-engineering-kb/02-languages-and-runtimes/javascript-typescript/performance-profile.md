# JavaScript/TypeScript: Performance Profile

> **Domain:** Languages > JavaScript/TypeScript
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## V8 Engine Internals

### JIT Compilation Pipeline

V8 uses a multi-tier compilation strategy for progressive optimization:

| Tier | Component | Purpose | Speed vs Quality |
|------|-----------|---------|-----------------|
| 0 | **Ignition** | Bytecode interpreter | Fast startup, collects type feedback |
| 1 | **Sparkplug** | Non-optimizing baseline compiler | 5-10x faster than Ignition, minimal compile time |
| 2 | **Maglev** | Mid-tier optimizing compiler | SSA-based, speculative, 2-5x faster than Sparkplug |
| 3 | **TurboFan** | Top-tier optimizing compiler | Sea-of-nodes IR, aggressive optimization |

### Hidden Classes (Shapes/Maps)

V8 assigns internal "hidden classes" (Maps) to objects based on property order:

```javascript
// GOOD: Same hidden class — V8 optimizes access
function Point(x, y) { this.x = x; this.y = y; }
const p1 = new Point(1, 2); // HiddenClass: {x, y}
const p2 = new Point(3, 4); // Same HiddenClass — fast!

// BAD: Different hidden classes — deoptimization
const a = {}; a.x = 1; a.y = 2; // HC1: {} → HC2: {x} → HC3: {x,y}
const b = {}; b.y = 2; b.x = 1; // HC1: {} → HC4: {y} → HC5: {y,x} ← DIFFERENT!
```

**Rules for V8 optimization:**
1. Always initialize properties in the same order
2. Don't add properties after construction
3. Don't delete properties (use `undefined` instead)
4. Keep function arguments monomorphic (same types)

### Inline Caching (ICs)

```javascript
// Monomorphic (1 type) — fastest
function getX(obj) { return obj.x; }
getX({ x: 1 }); // Learns: offset of x in this hidden class
getX({ x: 2 }); // Cache hit!

// Polymorphic (2-4 types) — slower, but cached
getX({ x: 1, y: 2 }); // Different hidden class, adds to cache

// Megamorphic (5+ types) — slowest, generic lookup
// Avoid by keeping types consistent
```

## Memory Model

### Heap Structure

```
V8 Heap
├── New Space (Young Generation) — 1-8 MB
│   ├── Semi-space 1 (active)
│   └── Semi-space 2 (inactive, for copying)
│   └── Minor GC: Scavenger (stop-the-world, ~1-5ms)
├── Old Space — Up to available memory
│   ├── Old Pointer Space (objects with references)
│   └── Old Data Space (objects without references)
│   └── Major GC: Mark-Sweep-Compact (concurrent/incremental)
├── Large Object Space — Objects > 512KB
├── Code Space — JIT-compiled machine code
└── Map Space — Hidden classes (Shapes)
```

### Garbage Collection

| GC Type | Algorithm | Pause Time | Frequency | Scope |
|---------|-----------|-----------|-----------|-------|
| **Scavenge** (Minor) | Cheney's semi-space copying | 1-5ms | Very frequent | Young generation |
| **Mark-Sweep** (Major) | Tri-color marking | 5-50ms | Less frequent | Entire heap |
| **Mark-Compact** | Mark + compact | 10-100ms | Rare | Reduce fragmentation |
| **Incremental** | Interleaved with JS | Minimal | Ongoing | Avoids long pauses |
| **Concurrent** | Background threads | Near-zero | Ongoing | Marking on background |

**Optimizing for GC:**
```javascript
// 1. Reduce allocations in hot paths
// BAD: Allocates new array every call
function process(items) { return items.map(transform).filter(valid); }

// GOOD: Reuse buffer
const buffer = [];
function process(items) {
  buffer.length = 0;
  for (const item of items) {
    const t = transform(item);
    if (valid(t)) buffer.push(t);
  }
  return buffer;
}

// 2. Object pooling for frequent alloc/dealloc
class ObjectPool<T> {
  private pool: T[] = [];
  acquire(): T { return this.pool.pop() ?? this.create(); }
  release(obj: T) { this.reset(obj); this.pool.push(obj); }
}

// 3. WeakRef for caches (GC can collect)
const cache = new Map<string, WeakRef<object>>();
```

## Event Loop Performance

### Microtasks vs Macrotasks

| Queue | Examples | Execution |
|-------|----------|-----------|
| **Microtasks** | Promise.then, queueMicrotask, MutationObserver | Drain completely after each macrotask |
| **Macrotasks** | setTimeout, setInterval, setImmediate, I/O callbacks | One per event loop tick |
| **Animation** | requestAnimationFrame | Before next paint (~16.6ms interval at 60fps) |
| **Idle** | requestIdleCallback | When browser is idle |

**Warning**: Microtask flooding blocks the event loop:
```javascript
// BAD: Infinite microtask loop — freezes the process
function bad() { Promise.resolve().then(bad); }

// GOOD: Use macrotask to yield to event loop
function good() { setTimeout(good, 0); }

// BEST: Use scheduler API (browsers)
scheduler.postTask(() => work(), { priority: 'background' });
```

## Runtime Performance Benchmarks

### TechEmpower Framework Benchmarks (Round 22)

| Runtime/Framework | JSON (req/s) | Database (req/s) | Fortunes (req/s) |
|-------------------|-------------|-------------------|-------------------|
| **Bun (Elysia)** | ~600K | ~180K | ~140K |
| **Bun (Hono)** | ~550K | ~160K | ~120K |
| **Node.js (Fastify)** | ~280K | ~90K | ~70K |
| **Node.js (Express)** | ~45K | ~15K | ~12K |
| **Deno (Hono)** | ~350K | ~100K | ~80K |
| Go (net/http) | ~500K | ~200K | ~160K |
| Rust (actix) | ~700K | ~400K | ~320K |
| Java (Vert.x) | ~650K | ~350K | ~280K |

### Node.js vs Deno vs Bun

| Benchmark | Node.js 22 | Deno 2 | Bun 1.1 |
|-----------|-----------|--------|---------|
| HTTP Hello World (req/s) | ~50K | ~80K | ~150K |
| File read (1MB, ops/s) | ~12K | ~15K | ~20K |
| SQLite queries/s | ~30K | ~35K | ~80K |
| WebSocket messages/s | ~100K | ~120K | ~200K |
| Startup time (hello world) | ~30ms | ~25ms | ~7ms |
| `npm install` (large project) | ~30s (npm) | ~10s | ~3s |
| TypeScript execution | Via tsx (~100ms overhead) | Native | Native |
| Memory (idle HTTP server) | ~30MB | ~25MB | ~20MB |

### Computer Language Benchmarks Game (CLBG)

| Benchmark | Node.js | Python 3 | Go | Rust | Java |
|-----------|---------|----------|----|------|------|
| binary-trees | 4.2s | 24.5s | 3.8s | 0.8s | 1.2s |
| fannkuch-redux | 6.8s | 133s | 6.2s | 2.1s | 4.5s |
| fasta | 1.4s | 20.3s | 1.1s | 0.5s | 0.8s |
| mandelbrot | 3.6s | 103s | 4.1s | 1.1s | 2.8s |
| n-body | 6.1s | 128s | 5.8s | 2.3s | 5.2s |
| **Geometric mean** | **~3x C** | **~75x C** | **~2.5x C** | **~1.0x C** | **~1.8x C** |

JavaScript (Node.js) is typically **2-5x slower** than compiled languages, but **10-50x faster** than Python for CPU-bound work.

## Bundle Size Optimization

### Techniques Comparison

| Technique | Impact | Complexity |
|-----------|--------|-----------|
| **Tree-shaking** | Remove unused exports | Low (automatic with ESM) |
| **Code splitting** | Load only what's needed | Medium (dynamic import()) |
| **Lazy loading** | Defer non-critical code | Medium |
| **Compression** (Brotli/gzip) | 60-80% size reduction | Low (server config) |
| **Minification** | 30-50% size reduction | Low (automatic in production) |
| **Image optimization** | Huge impact | Medium |
| **Dead code elimination** | Varies | Low (compiler) |
| **Module replacement** | Replace heavy with light libs | Medium |

### Heavy Package Alternatives

| Heavy Package | Size | Lightweight Alternative | Size | Savings |
|--------------|------|----------------------|------|---------|
| moment.js | 72KB | dayjs | 2KB | 97% |
| lodash | 72KB | lodash-es (tree-shake) | ~5KB | 93% |
| uuid | 14KB | crypto.randomUUID() | 0KB | 100% |
| axios | 13KB | fetch (native) | 0KB | 100% |
| classnames | 1.5KB | clsx | 0.5KB | 67% |
| chalk | 15KB | picocolors | 1KB | 93% |
| dotenv | 6KB | process.env (Node 21+) | 0KB | 100% |

## Server-Side Performance

### Node.js Clustering and Worker Threads

```javascript
// Cluster mode — one process per CPU core
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

if (cluster.isPrimary) {
  const numCPUs = availableParallelism();
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  cluster.on('exit', (worker) => cluster.fork()); // Auto-restart
} else {
  createServer().listen(3000);
}

// Worker threads — shared memory for CPU-intensive tasks
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

if (isMainThread) {
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { data: largeArray },
  });
  worker.on('message', (result) => console.log(result));
} else {
  const result = heavyComputation(workerData.data);
  parentPort!.postMessage(result);
}
```

### Streams for Memory Efficiency

```javascript
// BAD: Loads entire file into memory
const data = await fs.readFile('huge-file.csv', 'utf8');
const rows = data.split('\n').map(parseLine);

// GOOD: Streams — constant memory usage regardless of file size
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const rl = createInterface({ input: createReadStream('huge-file.csv') });
for await (const line of rl) {
  const row = parseLine(line);
  await processRow(row);
}
```

## Serverless Cold Starts

| Runtime | Cold Start (AWS Lambda) | Warm Invocation | Memory |
|---------|----------------------|-----------------|--------|
| Node.js 22 | 120-300ms | 5-20ms | ~120MB |
| Node.js + esbuild bundle | 80-150ms | 3-10ms | ~80MB |
| Bun (custom runtime) | 30-80ms | 3-8ms | ~60MB |
| Python 3.12 | 150-400ms | 10-30ms | ~100MB |
| Go | 8-15ms | 1-3ms | ~30MB |
| Rust | 8-15ms | 1-2ms | ~20MB |
| Java 21 | 800-3000ms | 2-5ms | ~200MB |
| Java 21 + SnapStart | 100-200ms | 2-5ms | ~200MB |

**Node.js cold start optimization:**
- Bundle with esbuild/tsx (fewer files to load)
- Minimize dependencies
- Use ESM (faster parsing)
- Lazy-load heavy modules: `const heavy = await import('./heavy')` inside handler
- Provisioned concurrency for critical paths

## Real-World Performance Stories

### PayPal: Java → Node.js Migration
- **Before**: Java (Spring), 5 developers, 2 months
- **After**: Node.js, 2 developers, 2 months (built in parallel)
- **Results**: 2x requests/second, 35% decrease in response time, 33% fewer lines of code

### Netflix: Node.js for UI Layer
- Reduced startup time from 40+ minutes (Java) to under 1 minute
- Node.js serves the entire Netflix UI (not the streaming)
- Uses React SSR for initial page load, client-side for subsequent navigation

### LinkedIn: Ruby → Node.js
- Went from 30 servers to 3 (running Node.js)
- Response times went from 2-3 seconds to under 200ms
- Unified frontend and backend JavaScript

### Walmart: Node.js for Black Friday
- Handled 500 million page views on Black Friday
- No downtime, 1% CPU utilization on servers
- Entire mobile site runs on Node.js

## Profiling Tools

| Tool | Type | Platform | Best For |
|------|------|----------|---------|
| Chrome DevTools | CPU/Memory/Network | Browser | Frontend profiling |
| `node --inspect` | CPU/Memory | Node.js | Backend profiling |
| `node --prof` | CPU (V8 log) | Node.js | Low-level V8 analysis |
| clinic.js | Doctor/Flame/Bubbleprof | Node.js | Node.js diagnostics |
| 0x | Flamegraph | Node.js | CPU profiling visualization |
| Lighthouse | Web Vitals | Browser | Performance auditing |
| `perf_hooks` | Timing/Measurement | Node.js | Custom measurements |

## Sources

- [V8 Blog](https://v8.dev/blog) — Engine internals
- [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/) — Framework comparison
- [Computer Language Benchmarks Game](https://benchmarksgame-team.pages.debian.net/)
- [Bundlephobia](https://bundlephobia.com) — Package size analysis
- [web.dev](https://web.dev) — Web performance guides
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
