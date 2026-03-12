# Memory Management & GC Tuning

> **Domain:** Performance > Backend Performance > Memory Management
> **Importance:** Critical
> **Last Updated:** 2026-03-10

## Core Concepts

Memory performance determines application latency, throughput, and stability. GC pauses, memory leaks, and allocation pressure are the top causes of production performance degradation.

```
Memory Hierarchy & Access Latency:
┌─────────────────────────────────────────┐
│ L1 Cache     │  ~1 ns    │  64 KB       │
│ L2 Cache     │  ~4 ns    │  256 KB      │
│ L3 Cache     │  ~12 ns   │  8-32 MB     │
│ Main Memory  │  ~100 ns  │  16-256 GB   │
│ SSD          │  ~100 us  │  TB          │
│ Network      │  ~1-100ms │  unlimited   │
└─────────────────────────────────────────┘
Rule: Keep hot data in cache-friendly structures. Sequential > random access.
```

---

## Garbage Collector Tuning

### JVM: G1 vs ZGC

```
G1GC (default Java 9+):
- Divides heap into regions (~2048 regions)
- Mixed collections: young + selected old regions
- Target pause time: -XX:MaxGCPauseMillis=200 (default)
- Good for: heaps 4-32GB, balanced latency/throughput

ZGC (Java 15+ production-ready):
- Concurrent, region-based, colored pointers
- Sub-millisecond pauses regardless of heap size
- Handles multi-TB heaps
- Good for: latency-sensitive apps, large heaps

Shenandoah:
- Concurrent compaction
- Similar goals to ZGC, different implementation
- Available in OpenJDK (not Oracle JDK)
```

```bash
# JVM G1GC tuning for web services
java -Xms4g -Xmx4g \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=100 \
  -XX:G1HeapRegionSize=16m \
  -XX:InitiatingHeapOccupancyPercent=45 \
  -XX:G1ReservePercent=15 \
  -XX:+ParallelRefProcEnabled \
  -Xlog:gc*:file=gc.log:time,uptime:filecount=5,filesize=100m \
  -jar app.jar

# JVM ZGC for low-latency services
java -Xms8g -Xmx8g \
  -XX:+UseZGC \
  -XX:+ZGenerational \
  -XX:SoftMaxHeapSize=6g \
  -Xlog:gc*:file=gc.log:time,uptime:filecount=5,filesize=100m \
  -jar app.jar
```

### Go GC Tuning

```go
// Go GC is concurrent mark-sweep with configurable GOGC
// GOGC=100 (default): GC runs when heap doubles since last collection
// GOGC=200: GC runs when heap triples — less frequent, more memory
// GOGC=50: GC runs at 1.5x — more frequent, less memory

// Set via environment variable
// GOGC=200 ./myapp           (less GC, more memory)
// GOMEMLIMIT=4GiB ./myapp    (hard memory limit, Go 1.19+)

import "runtime/debug"

func init() {
    // Soft memory limit — GC becomes more aggressive near limit
    debug.SetMemoryLimit(4 << 30) // 4 GiB

    // Or tune GC target percentage
    debug.SetGCPercent(150) // trigger GC at 2.5x live heap
}

// Monitor GC stats
func logGCStats() {
    var stats debug.GCStats
    debug.ReadGCStats(&stats)
    log.Printf("GC: count=%d, pause_total=%v, last_pause=%v",
        stats.NumGC, stats.PauseTotal, stats.Pause[0])
}
```

### V8 (Node.js) Memory Tuning

```bash
# Node.js V8 memory flags
node --max-old-space-size=4096 \   # Old generation limit (MB)
     --max-semi-space-size=64 \    # Young generation semi-space (MB)
     --expose-gc \                  # Allow manual GC (testing only)
     app.js

# Production: track heap usage
node --track-heap-objects app.js   # Enables heap snapshot allocation tracking
```

```typescript
// Monitor V8 heap in production
import v8 from 'v8';

function getHeapStats() {
  const heap = v8.getHeapStatistics();
  return {
    heapUsedMB: Math.round(heap.used_heap_size / 1048576),
    heapTotalMB: Math.round(heap.total_heap_size / 1048576),
    heapLimitMB: Math.round(heap.heap_size_limit / 1048576),
    externalMB: Math.round(heap.external_memory / 1048576),
    usagePercent: Math.round((heap.used_heap_size / heap.heap_size_limit) * 100),
  };
}

// Alert when heap usage exceeds 85%
setInterval(() => {
  const stats = getHeapStats();
  if (stats.usagePercent > 85) {
    console.error(`HEAP WARNING: ${stats.usagePercent}% used (${stats.heapUsedMB}MB / ${stats.heapLimitMB}MB)`);
  }
}, 10000);
```

---

## Memory Leak Detection

```typescript
// Node.js: heap snapshot comparison for leak detection
import v8 from 'v8';
import fs from 'fs';

function takeHeapSnapshot(filename: string): void {
  const snapshotStream = v8.writeHeapSnapshot(filename);
  console.log(`Heap snapshot written to: ${snapshotStream}`);
}
// Take snapshots at intervals, compare in Chrome DevTools:
// 1. Load baseline snapshot
// 2. Load after-load snapshot
// 3. Compare → "Objects allocated between snapshots"
// Growing object counts = leak

// Common Node.js leak patterns
// LEAK: event listeners accumulating
emitter.on('data', handler);     // added every request, never removed
// FIX: remove listener or use once()
emitter.once('data', handler);

// LEAK: closures capturing large scope
function createHandler(hugeData: Buffer) {
  return () => { /* hugeData captured, never freed */ };
}
// FIX: extract only needed fields
function createHandler(id: string) {
  return () => { /* only id captured */ };
}

// LEAK: unbounded caches
const cache = new Map<string, object>(); // grows forever
// FIX: use LRU cache with max size
import { LRUCache } from 'lru-cache';
const cache = new LRUCache<string, object>({ max: 10000 });
```

```go
// Go: pprof for memory profiling
import (
    "net/http"
    _ "net/http/pprof"  // Register pprof handlers
)

func init() {
    go func() {
        http.ListenAndServe(":6060", nil) // pprof server
    }()
}
// Then: go tool pprof http://localhost:6060/debug/pprof/heap
// Commands: top, list funcName, web (generates SVG flamegraph)
```

---

## Object Pooling

```go
// Go sync.Pool — reuse expensive objects, reduce GC pressure
var bufPool = sync.Pool{
    New: func() any { return new(bytes.Buffer) },
}

func ProcessRequest(data []byte) string {
    buf := bufPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufPool.Put(buf) // return to pool
    }()
    buf.Write(data)
    // process...
    return buf.String()
}
```

```typescript
// TypeScript: generic object pool
class ObjectPool<T> {
  private available: T[] = [];
  constructor(private factory: () => T, private reset: (obj: T) => void, private max = 100) {}
  acquire(): T { return this.available.pop() ?? this.factory(); }
  release(obj: T): void {
    this.reset(obj);
    if (this.available.length < this.max) this.available.push(obj);
  }
}
const bufferPool = new ObjectPool(() => Buffer.alloc(65536), (b) => b.fill(0), 50);
```

---

## Stack vs Heap Allocation

```go
// Go escape analysis determines stack vs heap allocation
// Stack: freed automatically when function returns (free), no GC
// Heap: requires garbage collection (expensive)

// Stack-allocated (does NOT escape)
func sumLocal() int {
    x := 42       // stays on stack
    return x + 1
}

// Heap-allocated (escapes to heap)
func newUser() *User {
    u := User{Name: "test"}  // escapes because pointer returned
    return &u                  // allocated on heap
}

// Check escape analysis: go build -gcflags="-m" ./...
// Output: "moved to heap: u"

// Optimization: accept pointer, avoid returning pointer when possible
func fillUser(u *User) { // caller owns allocation
    u.Name = "test"
}
```

---

## Zero-Copy Techniques

```go
// Go: io.Copy uses sendfile(2) syscall — zero-copy file serving
func serveFile(w http.ResponseWriter, filepath string) error {
    f, err := os.Open(filepath)
    if err != nil { return err }
    defer f.Close()
    _, err = io.Copy(w, f) // kernel transfers data directly, no user-space copy
    return err
}

// Memory-mapped files — access file as memory, OS handles paging
func readMapped(path string) ([]byte, error) {
    f, err := os.Open(path)
    if err != nil { return nil, err }
    defer f.Close()
    stat, _ := f.Stat()
    data, err := syscall.Mmap(int(f.Fd()), 0, int(stat.Size()),
        syscall.PROT_READ, syscall.MAP_SHARED)
    return data, err // data backed by file, no heap copy
}
```

```java
// Java NIO: memory-mapped file — OS pages data in/out as needed, no heap copy
MappedByteBuffer buf = FileChannel.open(Path.of("large.dat"))
    .map(FileChannel.MapMode.READ_ONLY, 0, channel.size());
// Off-heap memory: ByteBuffer.allocateDirect(1MB) — avoids GC, use for I/O buffers
```

---

## Weak/Soft References

```java
// Java: SoftReference — collected only under memory pressure (ideal for caches)
SoftReference<byte[]> cached = new SoftReference<>(loadLargeData());
byte[] data = cached.get();
if (data == null) {
    data = loadLargeData(); // re-load after GC collected under memory pressure
    cached = new SoftReference<>(data);
}
// WeakHashMap: keys collected on any GC. SoftReference: values collected under pressure.
```

```typescript
// JavaScript WeakRef + FinalizationRegistry (ES2021)
const cache = new Map<string, WeakRef<object>>();
const registry = new FinalizationRegistry((key: string) => cache.delete(key));

function cacheObject(key: string, obj: object): void {
  cache.set(key, new WeakRef(obj));
  registry.register(obj, key);
}
function getCached(key: string): object | undefined {
  return cache.get(key)?.deref(); // undefined if GC'd
}
```

---

## Memory Profiling Tools

```
Language-Specific Tools:
┌──────────┬──────────────────────────────────────────────────┐
│ Language │ Tools                                             │
├──────────┼──────────────────────────────────────────────────┤
│ Node.js  │ --inspect + Chrome DevTools, clinic.js heapprof  │
│ Go       │ pprof (heap, allocs), GODEBUG=gctrace=1          │
│ Java     │ JFR, VisualVM, jmap -dump, Eclipse MAT           │
│ Python   │ tracemalloc, objgraph, memray, memory_profiler   │
│ Rust     │ valgrind (massif), DHAT, heaptrack                │
│ C#       │ dotMemory, PerfView, dotnet-dump                  │
└──────────┴──────────────────────────────────────────────────┘
```

```python
# Python: tracemalloc for memory tracking and leak detection
import tracemalloc
tracemalloc.start(25)
# Compare snapshots to find leaks:
snap1 = tracemalloc.take_snapshot()
# ... run workload ...
snap2 = tracemalloc.take_snapshot()
for stat in snap2.compare_to(snap1, 'lineno')[:10]:
    print(stat)  # shows allocation growth between snapshots
```

---

## Best Practices

1. **ALWAYS set explicit memory limits** — `-Xmx` (JVM), `--max-old-space-size` (Node.js), `GOMEMLIMIT` (Go)
2. **ALWAYS monitor heap usage and GC metrics** in production — alert at 80% heap utilization
3. **ALWAYS use object pooling** for frequently allocated expensive objects (buffers, connections)
4. **ALWAYS prefer stack allocation** over heap — pass values, avoid unnecessary pointer returns
5. **Use ZGC or Shenandoah** for latency-sensitive JVM services — sub-ms pauses at any heap size
6. **Use bounded caches** (LRU/LFU) instead of unbounded Maps — unbounded maps leak by design
7. **Take heap snapshots under load** and compare — growing object counts indicate leaks
8. **Use zero-copy I/O** (sendfile, mmap) for large file serving — eliminates user-space copies
9. **Profile allocation rate, not just heap size** — high allocation rate causes frequent GC even with small live set
10. **Pre-allocate slices/arrays** when size is known — `make([]T, 0, expectedSize)` avoids repeated growing

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| No memory limit set | OOM kills in production | Set explicit heap limits per runtime |
| Unbounded in-memory cache | Heap grows until OOM | Use LRU cache with max entries |
| String concatenation in loops | O(n^2) allocations, GC pressure | Use StringBuilder/Buffer/strings.Builder |
| Holding references in closures | Objects never GC'd | Capture only primitive values needed |
| Large object allocation in hot path | Frequent GC pauses, high alloc rate | Object pooling (sync.Pool, custom pool) |
| Ignoring GC logs | Undetected long pauses | Enable GC logging, alert on pause >50ms |
| Returning pointers from hot functions (Go) | Heap escapes, GC pressure | Accept pointer parameter instead |
| Not profiling before optimizing | Wrong optimization target | Profile first: pprof, heapprof, JFR |

---

## Enforcement Checklist

- [ ] Memory limits configured for all services (JVM, Node.js, Go)
- [ ] GC logging enabled in production (gc.log, GODEBUG=gctrace=1)
- [ ] Heap usage monitored with alerting at 80% threshold
- [ ] GC pause times tracked — alert if p99 > 50ms
- [ ] Memory leak detection process in CI (heap snapshot comparison)
- [ ] Object pools used for hot-path allocations
- [ ] Caches bounded with eviction policy (LRU/TTL)
- [ ] Allocation profiling run quarterly on critical services
- [ ] Zero-copy I/O used for file serving and large transfers
- [ ] Escape analysis reviewed for performance-critical Go functions
