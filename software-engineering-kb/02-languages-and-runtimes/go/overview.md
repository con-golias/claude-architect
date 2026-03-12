# Go: Overview

> **Domain:** Languages > Go
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03

## History & Evolution

Go was created at Google by **Rob Pike**, **Ken Thompson** (co-creator of Unix and C), and **Robert Griesemer** in 2007, publicly announced in 2009, and reached 1.0 in 2012.

### Motivation
Go was designed to solve Google's problems: slow builds (C++ builds taking 45+ minutes), complex dependency management, difficulty writing concurrent code, and the need for a productive systems language.

### Version History

| Version | Year | Key Features |
|---------|------|-------------|
| 1.0 | 2012 | Stable release, compatibility promise |
| 1.5 | 2015 | Concurrent GC, self-hosted compiler (no more C) |
| 1.7 | 2016 | context package, subtests |
| 1.8 | 2017 | sort.Slice, plugins |
| 1.11 | 2018 | Go Modules (replacing GOPATH) |
| 1.13 | 2019 | Error wrapping (fmt.Errorf %w), errors.Is/As |
| 1.14 | 2020 | Async preemptible goroutines, testing.Cleanup |
| 1.16 | 2021 | embed directive, io/fs package, modules by default |
| 1.18 | 2022 | **Generics** (type parameters), fuzzing, workspace mode |
| 1.19 | 2022 | Revised memory model, soft memory limit (GOMEMLIMIT) |
| 1.20 | 2023 | PGO (profile-guided optimization), wrapping multiple errors |
| 1.21 | 2023 | slog (structured logging), slices/maps packages, range over int |
| 1.22 | 2024 | Range over functions (iterators), math/rand/v2, enhanced routing |
| 1.23 | 2024 | Range over func (stabilized), unique package, timer/ticker changes |
| 1.24 | 2025 | Generic type aliases, Swiss Tables map implementation |

### Go 1 Compatibility Promise
Go guarantees backward compatibility: **code written for Go 1.0 will still compile and run with Go 1.24+**. This is one of Go's strongest features for production use.

## Design Philosophy

### Core Principles

1. **Simplicity**: Intentionally small language (~25 keywords). Less is more.
2. **Readability**: Code is read far more than written. `gofmt` enforces one style.
3. **Fast compilation**: The entire Go standard library compiles in seconds.
4. **Built-in concurrency**: Goroutines and channels are first-class citizens.
5. **Composition over inheritance**: No classes, no inheritance — interfaces + embedding.
6. **Explicit over implicit**: No exceptions, no implicit type conversions, explicit error handling.

### Go Proverbs (Rob Pike)

```
Don't communicate by sharing memory; share memory by communicating.
Concurrency is not parallelism.
Channels orchestrate; mutexes serialize.
The bigger the interface, the weaker the abstraction.
Make the zero value useful.
interface{} says nothing.
Gofmt's style is no one's favorite, yet gofmt is everyone's favorite.
A little copying is better than a little dependency.
Clear is better than clever.
Errors are values.
Don't just check errors, handle them gracefully.
```

## Type System

Go has a **static type system with structural typing** for interfaces:

```go
// Structural typing — no "implements" keyword needed
type Writer interface {
    Write(p []byte) (n int, err error)
}

// os.File satisfies Writer implicitly (has Write method)
var w Writer = os.Stdout // OK — os.File has Write([]byte)(int,error)

// Generics (Go 1.18+)
func Map[T, U any](s []T, f func(T) U) []U {
    result := make([]U, len(s))
    for i, v := range s {
        result[i] = f(v)
    }
    return result
}

// Type constraints
type Number interface {
    ~int | ~int32 | ~int64 | ~float32 | ~float64
}

func Sum[T Number](numbers []T) T {
    var total T
    for _, n := range numbers {
        total += n
    }
    return total
}
```

### Key Type Features

| Feature | Go | Notes |
|---------|-----|-------|
| Static typing | Yes | Compile-time type checking |
| Type inference | Yes | `:=` short declaration |
| Generics | Yes (1.18+) | Type parameters with constraints |
| Interfaces | Structural (implicit) | No `implements` keyword |
| Enums | No (use iota constants) | Proposed but not added |
| Sum types / unions | No | Interfaces used instead |
| Null safety | No (nil exists) | Zero values help |
| Tuples | No (multiple return values) | Return `(value, error)` pattern |
| Pattern matching | No | Switch statements |
| Immutability | No keyword | Convention only |

## Concurrency Model (CSP)

Go implements **Communicating Sequential Processes (CSP)** by Tony Hoare:

```go
// Goroutines — lightweight threads (~2-8 KB initial stack)
go func() {
    fmt.Println("running concurrently")
}()

// Channels — typed conduits for communication
ch := make(chan string)    // Unbuffered channel
ch := make(chan string, 10) // Buffered (10 items)

// Send and receive
go func() { ch <- "hello" }()
msg := <-ch // Blocks until message available

// Select — multiplexing channels
select {
case msg := <-ch1:
    fmt.Println("from ch1:", msg)
case msg := <-ch2:
    fmt.Println("from ch2:", msg)
case <-time.After(5 * time.Second):
    fmt.Println("timeout")
}
```

### GMP Scheduler Model

```
G (Goroutine)    — the concurrent unit of work
M (Machine)      — OS thread
P (Processor)    — logical processor (GOMAXPROCS)

┌──────────────────────────────────────────┐
│ Go Runtime Scheduler                      │
│                                           │
│  P0: [G1, G2, G3] ──── M0 (OS Thread)  │
│  P1: [G4, G5]     ──── M1 (OS Thread)  │
│  P2: [G6, G7, G8] ──── M2 (OS Thread)  │
│                                           │
│  Global Queue: [G9, G10, ...]            │
│  Work stealing: idle P steals from busy P│
└──────────────────────────────────────────┘
```

- **Goroutine cost**: ~2 KB initial stack (grows dynamically up to 1 GB)
- **Context switch**: ~200ns (vs ~1-10μs for OS threads)
- **You can run millions of goroutines** on a single machine

## Memory Model & GC

### Garbage Collector Evolution

| Version | GC Type | Max Pause |
|---------|---------|-----------|
| Go 1.0 | Stop-the-world | 100ms+ |
| Go 1.5 | Concurrent tri-color mark-and-sweep | 10ms |
| Go 1.8 | Improved concurrent GC | 1ms |
| Go 1.12+ | Non-generational, concurrent | <500μs typical |
| Go 1.19+ | Soft memory limit (GOMEMLIMIT) | <500μs |

**Go GC design priorities**: Low latency over maximum throughput. This is the opposite of JVM's G1/ZGC which can optimize for throughput.

## Built-in Tooling

| Tool | Command | Purpose |
|------|---------|---------|
| Format | `go fmt` | Canonical formatting (no debates) |
| Vet | `go vet` | Static analysis for common bugs |
| Test | `go test` | Built-in test runner with coverage |
| Bench | `go test -bench` | Built-in benchmarking |
| Prof | `go tool pprof` | CPU/memory/goroutine profiling |
| Build | `go build` | Compile to static binary |
| Run | `go run` | Compile and run |
| Generate | `go generate` | Code generation |
| Doc | `go doc` | Documentation viewer |
| Mod | `go mod` | Dependency management |
| Work | `go work` | Multi-module workspaces |

**No external tools needed** — Go ships with formatter, linter, tester, profiler, and documentation generator built into the standard toolchain.

## Module System

```go
// go.mod — dependency management
module github.com/myorg/myapp

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/lib/pq v1.10.9
)

// Commands:
// go mod init github.com/myorg/myapp  — create module
// go mod tidy                          — add/remove deps
// go get github.com/some/pkg@v1.2.3   — add dependency
// go mod vendor                        — vendor dependencies
```

### Module Proxy (GOPROXY)
Go uses a proxy system for module downloads:
- Default: `https://proxy.golang.org` (Google-hosted, immutable)
- Checksum database: `https://sum.golang.org` (tamper-proof)
- This means Go dependencies are **immutable and verifiable** by default

## Sources

- [Go Specification](https://go.dev/ref/spec) — Language specification
- [Effective Go](https://go.dev/doc/effective_go) — Idiomatic Go guide
- [Go Blog](https://go.dev/blog/) — Official blog
- [Go Proverbs](https://go-proverbs.github.io/) — Rob Pike's wisdom
- [Go Wiki](https://go.dev/wiki/) — Community resources
