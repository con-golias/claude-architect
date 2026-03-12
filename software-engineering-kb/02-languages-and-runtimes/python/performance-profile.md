# Python: Performance Profile

> **Domain:** Languages > Python
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## CPython Performance Characteristics

Python is typically **10-100x slower than C** for CPU-bound tasks, but this headline number is misleading because most Python performance comes from C-extension libraries.

### The Two Pythons

| Workload | Actual Speed | Why |
|----------|-------------|-----|
| **NumPy array operations** | ~1-3x C | Operations run in compiled C/Fortran, Python is just the glue |
| **Pandas DataFrame ops** | ~1-5x C | Vectorized C operations under the hood |
| **Pure Python loops** | 50-100x slower than C | Interpreted, dynamic dispatch, GIL |
| **I/O-bound (async)** | Comparable to Node.js/Go | Event loop efficiency, not CPU-limited |
| **String processing** | 10-50x slower than C | Object overhead, no SIMD |

### Faster CPython Progress (3.11-3.14)

| Version | Speedup (vs 3.10) | Key Technique |
|---------|-------------------|---------------|
| 3.11 | 10-60% faster | Specializing adaptive interpreter |
| 3.12 | +5% | Comprehension inlining, per-interpreter GIL |
| 3.13 | +5-10% | Experimental JIT (copy-and-patch), tier 2 optimizer |
| 3.14 | +5-10% | Improved JIT, better tier 2 optimizer |

```python
# 3.11 specialization example:
# LOAD_ATTR for obj.x is replaced with:
# - LOAD_ATTR_INSTANCE_VALUE (known instance attribute)
# - LOAD_ATTR_SLOT (known __slots__ attribute)
# - LOAD_ATTR_MODULE (module attribute)
# These specialized opcodes skip dictionary lookups
```

## GIL Impact Analysis

### CPU-Bound: GIL is a Bottleneck

```python
import time
import threading
import multiprocessing

def cpu_task():
    total = 0
    for i in range(50_000_000):
        total += i

# Single thread
start = time.time()
cpu_task()
print(f"Single thread: {time.time() - start:.2f}s")  # ~3.5s

# Two threads (SLOWER due to GIL contention!)
start = time.time()
t1 = threading.Thread(target=cpu_task)
t2 = threading.Thread(target=cpu_task)
t1.start(); t2.start()
t1.join(); t2.join()
print(f"Two threads: {time.time() - start:.2f}s")  # ~7.0s (!)

# Two processes (true parallelism)
start = time.time()
p1 = multiprocessing.Process(target=cpu_task)
p2 = multiprocessing.Process(target=cpu_task)
p1.start(); p2.start()
p1.join(); p2.join()
print(f"Two processes: {time.time() - start:.2f}s")  # ~3.5s
```

### I/O-Bound: GIL is NOT a Problem

```python
# For I/O, threads work fine because GIL is released during I/O
import asyncio
import aiohttp

async def fetch_all(urls: list[str]) -> list[str]:
    async with aiohttp.ClientSession() as session:
        tasks = [session.get(url) for url in urls]
        responses = await asyncio.gather(*tasks)
        return [await r.text() for r in responses]

# 100 HTTP requests: ~0.5s (vs ~50s sequential)
```

### Free-Threaded Python (3.13+, PEP 703)

```bash
# Install free-threaded build
# python3.13t (experimental, no GIL)

# Benchmark: CPU-bound with threads
# Standard CPython:  2 threads = 2x SLOWER (GIL contention)
# Free-threaded:     2 threads = 2x FASTER (true parallelism)
# BUT: 5-10% single-thread overhead due to more complex reference counting
```

## Memory Analysis

### Object Memory Sizes

```python
import sys

sys.getsizeof(0)           # 28 bytes (int)
sys.getsizeof(1)           # 28 bytes
sys.getsizeof(2**30)       # 32 bytes (larger int)
sys.getsizeof(3.14)        # 24 bytes (float)
sys.getsizeof("")          # 49 bytes (empty str!)
sys.getsizeof("hello")    # 54 bytes
sys.getsizeof([])          # 56 bytes (empty list)
sys.getsizeof({})          # 64 bytes (empty dict)
sys.getsizeof(True)        # 28 bytes (bool is int subclass)
sys.getsizeof(None)        # 16 bytes

# Contrast with C: int = 4 bytes, float = 8 bytes
# Python objects have ~3-7x overhead per value
```

### Memory Optimization Techniques

```python
# 1. __slots__ — eliminates per-instance __dict__
class PointDict:
    def __init__(self, x, y):
        self.x = x; self.y = y
# Each instance: ~152 bytes (with __dict__)

class PointSlots:
    __slots__ = ('x', 'y')
    def __init__(self, x, y):
        self.x = x; self.y = y
# Each instance: ~56 bytes (64% less!)

# 2. Generators instead of lists
# BAD: creates 1M items in memory
squares = [x**2 for x in range(1_000_000)]  # ~8MB

# GOOD: generates one at a time
squares = (x**2 for x in range(1_000_000))  # ~120 bytes!

# 3. array.array for homogeneous numeric data
import array
python_list = [1, 2, 3, 4, 5]          # ~120 bytes
c_array = array.array('i', [1, 2, 3, 4, 5])  # ~84 bytes

# 4. NumPy arrays for large numeric datasets
import numpy as np
py_list = list(range(1_000_000))        # ~28 MB
np_array = np.arange(1_000_000)          # ~4 MB (7x less)
```

### Memory Profiling Tools

| Tool | Type | Best For |
|------|------|---------|
| **memray** | Memory profiler (Allocation tracking) | Finding memory leaks, Bloomberg open source |
| **tracemalloc** | stdlib allocation tracker | Quick memory debugging |
| **memory_profiler** | Line-by-line memory | Detailed per-line usage |
| **objgraph** | Object graph visualization | Reference cycle debugging |
| **pympler** | Object size analysis | Class-level memory analysis |
| **filprofiler** | Data science memory | Peak memory usage |

## PyPy JIT Performance

| Benchmark | CPython 3.12 | PyPy 3.10 | Speedup |
|-----------|-------------|-----------|---------|
| Richards | 1.00x | 10.2x | 10x |
| Chaos | 1.00x | 8.7x | 9x |
| nbody | 1.00x | 7.3x | 7x |
| json_dumps | 1.00x | 4.2x | 4x |
| django_template | 1.00x | 3.8x | 4x |
| sqlalchemy | 1.00x | 2.1x | 2x |
| **Average** | **1.00x** | **~4.8x** | **~5x** |

**PyPy limitations**: Some C extensions don't work (most popular ones do via cpyext), warmup time of 1-5 seconds, higher memory usage.

## Cython / Numba / Mojo

```python
# Cython — compile Python to C extensions
# pure_python.py (slow): ~5 seconds for 100M iterations
def sum_range(n):
    total = 0
    for i in range(n):
        total += i
    return total

# cython_version.pyx (fast): ~0.05 seconds (100x faster)
# cdef declares C types
def sum_range(int n):
    cdef long total = 0
    cdef int i
    for i in range(n):
        total += i
    return total

# Numba — JIT for numerical Python
from numba import njit

@njit  # Compiles to machine code at first call
def sum_range(n):
    total = 0
    for i in range(n):
        total += i
    return total
# First call: ~200ms (compilation), subsequent: ~0.05s (100x faster)

# Mojo — superset of Python (by Modular)
# Claims up to 68,000x speedup over Python for some benchmarks
# Statically typed, MLIR-based compiler, Python-compatible syntax
```

## Web Framework Benchmarks

### TechEmpower Round 22 — Python Frameworks

| Framework | JSON (req/s) | Database (req/s) | Fortunes (req/s) |
|-----------|-------------|-------------------|-------------------|
| **Granian + Starlette** | ~120K | ~40K | ~30K |
| **Blacksheep** | ~100K | ~35K | ~25K |
| **FastAPI** | ~50K | ~20K | ~15K |
| **Django** | ~8K | ~5K | ~4K |
| **Flask** | ~5K | ~3K | ~2K |
| Node.js (Fastify) | ~280K | ~90K | ~70K |
| Go (net/http) | ~500K | ~200K | ~160K |

### Polars vs Pandas Benchmarks

| Operation (10M rows) | Pandas | Polars | Speedup |
|----------------------|--------|--------|---------|
| CSV read | 10.2s | 1.1s | 9x |
| GroupBy + Agg | 2.1s | 0.18s | 12x |
| Filter + Sort | 1.8s | 0.12s | 15x |
| Join (2 tables) | 3.5s | 0.25s | 14x |
| Memory (10M rows × 10 cols) | 800MB | 200MB | 4x less |

## Serverless Cold Starts

| Configuration | Cold Start | Warm Response | Memory |
|--------------|-----------|---------------|--------|
| Python 3.12 (Lambda) | 200-500ms | 10-30ms | ~100MB |
| Python + FastAPI | 500-1000ms | 15-40ms | ~150MB |
| Python + Django | 1000-2000ms | 20-50ms | ~200MB |
| Python + Lambda Powertools | 300-600ms | 10-30ms | ~120MB |

**Optimization strategies:**
- Minimize dependencies (fewer imports = faster cold start)
- Use `lazy_import` for heavy modules
- Provisioned concurrency for critical paths
- Lambda layers for shared dependencies
- Use `python -X importtime` to profile import times

## Real-World Performance Stories

### Instagram (Django at Scale)
- Largest Django deployment in the world
- Serves 2B+ monthly active users
- Python code everywhere (except a few C++ services)
- Key optimizations: Cython for hot paths, custom memory allocator, GC tuning (disabled gen1/gen2)
- "We chose Python for developer productivity; performance comes from architecture, not language"

### Dropbox
- Originally 100% Python
- Migrated some services to Go (API gateway, block storage) for performance
- Core desktop client: Python → Rust (for memory safety + performance)
- Key lesson: Python for business logic, compiled languages for infrastructure

### Netflix
- Python for data science, ML, tooling, automation
- Not used for streaming (that's Java)
- Key uses: Metaflow (ML pipelines), security tools, data pipelines, monitoring

### Spotify
- Python for data pipelines, backend services, ML
- Luigi (Python) for workflow orchestration
- Key optimization: push computation to compiled libraries (NumPy, Spark)

## Profiling Tools

| Tool | Type | Best For | Usage |
|------|------|---------|-------|
| **cProfile** | CPU profiler (stdlib) | Function-level timing | `python -m cProfile script.py` |
| **py-spy** | Sampling profiler | Production profiling (no overhead) | `py-spy top --pid 12345` |
| **scalene** | CPU + Memory + GPU | Comprehensive profiling | `scalene script.py` |
| **line_profiler** | Line-by-line CPU | Hot function analysis | `@profile` decorator |
| **memray** | Memory | Allocation tracking | `memray run script.py` |
| **pyinstrument** | Statistical profiler | Call tree visualization | `pyinstrument script.py` |
| **Austin** | Sampling (no instrumentation) | Production | `austin python script.py` |

```python
# Quick profiling with cProfile
import cProfile

cProfile.run('main()', sort='cumulative')

# Line profiler (requires line_profiler package)
@profile
def slow_function():
    result = []
    for i in range(1000):
        result.append(expensive_computation(i))
    return result
# Run: kernprof -l -v script.py
```

## Sources

- [Faster CPython](https://github.com/faster-cpython/ideas) — Performance roadmap
- [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/)
- [Computer Language Benchmarks Game](https://benchmarksgame-team.pages.debian.net/)
- [PyPy Speed Center](https://speed.pypy.org/)
- [memray](https://github.com/bloomberg/memray) — Memory profiler
- [Python Performance Tips](https://wiki.python.org/moin/PythonSpeed/PerformanceTips)
