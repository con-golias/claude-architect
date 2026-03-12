# Languages & Runtimes

Programming languages, runtimes, and ecosystems — comprehensive reference for selecting, learning, and mastering modern languages.

## Contents

### Language Deep Dives

Each language folder contains 6 files covering the complete picture:

| File | Purpose |
|------|---------|
| `overview.md` | History, type system, runtime architecture, core features |
| `ecosystem.md` | Frameworks, libraries, tools, package management |
| `best-practices.md` | Idiomatic code, patterns, modern style, testing |
| `performance-profile.md` | Benchmarks, profiling, optimization, real-world data |
| `strengths-weaknesses.md` | When to choose/avoid, trade-offs, industry adoption |
| `notable-sources.md` | Books, people, blogs, conferences, learning paths |

### Languages Covered

| Language | Folder | Primary Domain |
|----------|--------|---------------|
| **JavaScript/TypeScript** | `javascript-typescript/` | Web (frontend + backend), full-stack |
| **Python** | `python/` | Data science, ML/AI, scripting, web backend |
| **Java/Kotlin** | `java-kotlin/` | Enterprise backend, Android, JVM ecosystem |
| **Go** | `go/` | Cloud infrastructure, CLI tools, microservices |
| **Rust** | `rust/` | Systems programming, performance-critical, WebAssembly |
| **C#/.NET** | `csharp-dotnet/` | Enterprise, Windows, game dev (Unity), Azure |
| **Dart** | `dart/` | Cross-platform mobile/desktop (Flutter) |
| **Swift** | `swift/` | Apple platforms (iOS, macOS, watchOS, visionOS) |

### Comparison Matrices

Cross-language comparisons organized by domain:

| File | What It Compares |
|------|-----------------|
| `comparison-matrices/web-backend-comparison.md` | Languages and frameworks for web backend development |
| `comparison-matrices/mobile-comparison.md` | Cross-platform and native mobile frameworks |
| `comparison-matrices/systems-programming-comparison.md` | C, C++, Rust, Go, Zig for systems work |
| `comparison-matrices/performance-benchmarks.md` | TechEmpower, CLBG, energy efficiency, startup benchmarks |
| `comparison-matrices/concurrency-models-comparison.md` | Threads, goroutines, coroutines, actors, async/await |
| `comparison-matrices/type-systems-comparison.md` | Static vs dynamic, null safety, generics, type inference |

### Selection Guide

| File | Purpose |
|------|---------|
| `selection-framework.md` | Structured decision process for choosing languages |

## How This Section Connects

```
02-languages-and-runtimes
├── Provides language-specific guidance for:
│   ├── 03-architecture → implementation patterns per language
│   ├── 04-web-technologies → frontend (JS/TS) and backend frameworks
│   ├── 05-databases → ORMs and data access per language
│   ├── 06-devops-and-infrastructure → Go/Rust CLI tools, Python scripting
│   ├── 07-testing → testing frameworks per language
│   └── 13-mobile-development → Swift, Kotlin, Dart/Flutter
├── Builds on:
│   └── 01-fundamentals → data structures, algorithms, design patterns
└── Referenced by:
    ├── 08-system-design → language selection for system components
    └── 16-career → learning paths, job market analysis
```

## Quick Navigation

**"I need to build a..."**

| Need | Start Here |
|------|-----------|
| Web API / Backend | `selection-framework.md` → `comparison-matrices/web-backend-comparison.md` |
| Mobile app | `comparison-matrices/mobile-comparison.md` → `dart/` or `swift/` or `java-kotlin/` |
| CLI tool | `go/overview.md` or `rust/overview.md` |
| Data pipeline | `python/overview.md` |
| Enterprise system | `java-kotlin/overview.md` or `csharp-dotnet/overview.md` |
| Game | `csharp-dotnet/ecosystem.md` (Unity section) |
| High-performance service | `rust/overview.md` or `go/overview.md` |
| Full-stack web app | `javascript-typescript/overview.md` |

## Sources

- [Stack Overflow Developer Survey](https://survey.stackoverflow.co/)
- [GitHub Octoverse](https://github.blog/news-insights/octoverse/)
- [TIOBE Index](https://www.tiobe.com/tiobe-index/)
- [JetBrains State of Developer Ecosystem](https://www.jetbrains.com/lp/devecosystem/)
- [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/)
