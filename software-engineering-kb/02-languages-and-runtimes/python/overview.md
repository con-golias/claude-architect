# Python: Overview

> **Domain:** Languages > Python
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## History & Evolution

| Year | Version | Key Features |
|------|---------|-------------|
| 1991 | Python 0.9 | Guido van Rossum releases first version at CWI (Netherlands) |
| 2000 | Python 2.0 | List comprehensions, GC with cycle detection, unicode support |
| 2008 | Python 3.0 | Breaking release: print(), unicode strings by default, division changes |
| 2014 | Python 3.4 | asyncio (PEP 3156), pip bundled, enum, pathlib |
| 2015 | Python 3.5 | async/await syntax (PEP 492), type hints (PEP 484), matrix multiply (@) |
| 2016 | Python 3.6 | f-strings, variable annotations, async generators, __init_subclass__ |
| 2017 | Python 3.6.2 | PEP 526 variable annotations |
| 2018 | Python 3.7 | dataclasses, breakpoint(), postponed evaluation of annotations |
| 2019 | Python 3.8 | Walrus operator (:=), positional-only params (/), TypedDict |
| 2020 | Python 3.9 | Dictionary union (|), type hinting generics (list[int] not List[int]), PEG parser |
| 2021 | Python 3.10 | Structural pattern matching (match/case), ParamSpec, TypeAlias |
| 2022 | Python 3.11 | 10-60% faster (Faster CPython), ExceptionGroup, TaskGroup, tomllib |
| 2023 | Python 3.12 | Type parameter syntax (PEP 695), f-string improvements, per-interpreter GIL |
| 2024 | Python 3.13 | Experimental JIT compiler (PEP 744), free-threaded mode (PEP 703, no GIL) |
| 2025 | Python 3.14 | Template strings (PEP 750), deferred evaluation of annotations (PEP 649) |

### Python 2 → 3 Migration
The Python 2 → 3 transition (2008-2020) is one of the most studied language migrations in history:
- Python 2 EOL: January 1, 2020 (12-year transition period)
- Key breaking changes: `print()` function, `str` is unicode, integer division, `range()` returns iterator
- Lesson learned: language breaking changes need excellent tooling (`2to3`, `six`, `python-future`)

## Design Philosophy

### The Zen of Python (PEP 20)

```python
import this
```

Key principles:
```
Beautiful is better than ugly.
Explicit is better than implicit.
Simple is better than complex.
Complex is better than complicated.
Flat is better than nested.
Readability counts.
There should be one—and preferably only one—obvious way to do it.
If the implementation is hard to explain, it's a bad idea.
```

### Core Design Decisions
1. **Significant whitespace**: Indentation IS syntax — forces readable code
2. **Batteries included**: Rich standard library (http, json, sqlite, csv, re, unittest, etc.)
3. **Duck typing**: "If it walks like a duck..." — structural behavior over declared types
4. **Multiple paradigms**: OOP, functional, procedural — use what fits
5. **Readability over speed**: Optimized for developer time, not CPU time

## Type System

### Dynamic Typing with Optional Type Hints

```python
# Python is dynamically typed at runtime
x = 42          # x is int
x = "hello"     # now x is str — no error

# Type hints (PEP 484) — checked by tools, not runtime
def greet(name: str) -> str:
    return f"Hello, {name}"

# Modern type hints (Python 3.10+)
def process(data: list[int] | None = None) -> dict[str, int]:
    ...

# Python 3.12+ — Type parameter syntax (PEP 695)
type Point = tuple[float, float]
type Matrix[T] = list[list[T]]

def first[T](items: list[T]) -> T:
    return items[0]
```

### Type Checking Ecosystem

| Tool | Creator | Speed | Strictness | Special Features |
|------|---------|-------|-----------|-----------------|
| **mypy** | Dropbox (Guido van Rossum) | Medium | Configurable | Original type checker, most mature |
| **pyright** | Microsoft | Very fast | Strict by default | Used in Pylance (VS Code), best for strict mode |
| **pytype** | Google | Slow | Lenient | Infers types from runtime behavior |
| **pyre** | Meta | Fast | Strict | Built for large codebases, security-focused |

### Key Type Features

```python
from typing import Protocol, TypeVar, ParamSpec, Annotated, overload, TypeGuard

# Protocol — structural subtyping (PEP 544)
class Drawable(Protocol):
    def draw(self) -> None: ...

# Anything with draw() satisfies Drawable — no inheritance needed

# TypeVar — generics
T = TypeVar('T')
def first(items: list[T]) -> T: return items[0]

# ParamSpec — preserve function signatures in decorators (PEP 612)
P = ParamSpec('P')
R = TypeVar('R')
def decorator(func: Callable[P, R]) -> Callable[P, R]: ...

# Annotated — metadata on types (PEP 593)
Age = Annotated[int, Field(ge=0, le=150)]

# TypeGuard — type narrowing (PEP 647)
def is_str_list(val: list[object]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in val)

# @overload — multiple signatures
@overload
def process(x: int) -> str: ...
@overload
def process(x: str) -> int: ...
def process(x: int | str) -> str | int:
    if isinstance(x, int): return str(x)
    return int(x)
```

## CPython Internals

### Compilation & Execution Model

```
Source Code (.py)
    │
    ▼
  Lexer/Parser (PEG parser, 3.9+)
    │
    ▼
  AST (Abstract Syntax Tree)
    │
    ▼
  Compiler → Bytecode (.pyc files in __pycache__/)
    │
    ▼
  CPython VM (Stack-based bytecode interpreter)
    │ (3.11+) Specializing Adaptive Interpreter
    │ (3.13+) Experimental copy-and-patch JIT
    ▼
  Execution
```

### Key Internals

| Component | Description |
|-----------|-------------|
| **GIL** (Global Interpreter Lock) | Mutex preventing multiple threads from executing Python bytecode simultaneously. Protects CPython's memory management but limits CPU parallelism |
| **Reference counting** | Primary memory management — every object has a reference count, deallocated when count hits zero |
| **Cyclic GC** | Secondary GC for reference cycles (generational: gen0, gen1, gen2) |
| **Small object allocator** | Custom memory allocator for objects ≤ 512 bytes (pymalloc) |
| **Interning** | Small integers (-5 to 256) and short strings are cached/shared |
| **Specializing adaptive interpreter** (3.11+) | Bytecodes specialize based on observed types for ~25% speedup |

### GIL: The Elephant in the Room

```python
# GIL impact on CPU-bound work:
import threading, time

def count():
    n = 0
    for _ in range(100_000_000):
        n += 1

# Single thread: ~5 seconds
# Two threads: ~10 seconds (SLOWER due to GIL contention!)

# Solutions:
# 1. multiprocessing — separate processes, separate GILs
from multiprocessing import Pool
with Pool(4) as p:
    results = p.map(cpu_bound_func, data)

# 2. Free-threaded CPython (3.13+, experimental)
# python3.13t (compiled with --disable-gil)

# 3. C extensions release GIL (NumPy, pandas operations)

# Note: GIL does NOT affect I/O-bound work
# asyncio and threading both work well for I/O
```

## Alternative Implementations

| Implementation | Technology | Speed vs CPython | Use Case |
|---------------|-----------|-----------------|----------|
| **CPython** | C | Baseline (1x) | Default, reference implementation |
| **PyPy** | RPython (JIT) | 4-10x faster (long-running) | CPU-bound applications |
| **Cython** | C extension compiler | 10-100x (numeric code) | Performance-critical code, C interop |
| **Mojo** | LLVM/MLIR | Up to 68,000x (claimed) | AI/ML, systems-level performance |
| **GraalPy** | GraalVM (JIT) | 3-5x | JVM interoperability |
| **Jython** | JVM | 1-2x | Java integration (Python 2.7 only) |
| **IronPython** | .NET CLR | 1-2x | .NET integration (Python 3.4) |
| **MicroPython** | Custom VM | Slower | Microcontrollers, IoT |
| **RustPython** | Rust | Slower | WebAssembly, embedding |

## Key PEPs (Python Enhancement Proposals)

| PEP | Title | Impact |
|-----|-------|--------|
| PEP 8 | Style Guide for Python Code | Universal coding standard |
| PEP 20 | The Zen of Python | Design philosophy |
| PEP 484 | Type Hints | Introduced type annotations |
| PEP 492 | Coroutines with async/await | Modern async programming |
| PEP 557 | Data Classes | @dataclass decorator |
| PEP 572 | Assignment Expressions (walrus :=) | Inline variable assignment |
| PEP 604 | Union types with X \| Y | Simpler type syntax |
| PEP 612 | ParamSpec | Typed decorators |
| PEP 621 | pyproject.toml metadata | Modern packaging |
| PEP 634 | Structural Pattern Matching | match/case statements |
| PEP 695 | Type Parameter Syntax | `def func[T](x: T)` |
| PEP 703 | Making the GIL Optional | Free-threaded Python |
| PEP 744 | JIT Compilation | Experimental JIT in 3.13 |
| PEP 750 | Template Strings | t-strings in 3.14 |

## Faster CPython Project (Shannon Plan)

The "Faster CPython" initiative (led by Mark Shannon, funded by Microsoft):

| Version | Improvement | Key Techniques |
|---------|------------|----------------|
| 3.11 | 10-60% faster | Specializing adaptive interpreter, lazy frame creation, inlined function calls |
| 3.12 | 5% additional | Comprehension inlining, per-interpreter GIL foundation |
| 3.13 | Moderate | Experimental JIT (copy-and-patch), free-threaded build |
| 3.14+ | Ongoing | Better JIT, improved tier 2 optimizer |

**Goal**: Make CPython ~5x faster over several releases (inspired by JavaScript V8's evolution).

## Sources

- [Python Documentation](https://docs.python.org/3/) — Official reference
- [PEP Index](https://peps.python.org/) — Enhancement proposals
- [CPython Developer Guide](https://devguide.python.org/) — Internals
- [What's New in Python](https://docs.python.org/3/whatsnew/) — Per-version changes
- [Faster CPython](https://github.com/faster-cpython/ideas) — Performance initiative
- [Python Insider Blog](https://blog.python.org/) — Official blog
