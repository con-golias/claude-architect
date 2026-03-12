# Language & Runtime Selection Framework

> **Domain:** Languages & Runtimes
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03

## Purpose

This framework provides a **structured decision process** for choosing programming languages and runtimes. Instead of defaulting to personal preference or hype, use these criteria to make informed, defensible technology choices.

## The Selection Process

```
1. DEFINE the project requirements
   ↓
2. IDENTIFY the domain (web, mobile, systems, data, etc.)
   ↓
3. EVALUATE candidates against weighted criteria
   ↓
4. CHECK constraints (team skills, ecosystem, hiring)
   ↓
5. VALIDATE with proof-of-concept if uncertain
   ↓
6. DOCUMENT the decision (ADR)
```

## Step 1: Define Requirements

### Technical Requirements Checklist

| Category | Questions to Answer |
|----------|-------------------|
| **Performance** | What latency/throughput targets? P99 requirements? |
| **Scale** | Expected load? Growth trajectory? Concurrent users? |
| **Platform** | Where does it run? (Server, mobile, embedded, browser, serverless) |
| **Deployment** | Container, serverless, bare metal, edge? |
| **Integration** | What systems/APIs does it need to talk to? |
| **Data** | Database types? Data volume? Real-time requirements? |
| **Safety** | Regulatory compliance? Financial? Medical? |
| **Availability** | Uptime requirements? (99.9%, 99.99%, 99.999%) |

### Team & Organization Checklist

| Category | Questions to Answer |
|----------|-------------------|
| **Team skills** | What do your developers know? What can they learn? |
| **Hiring** | Can you hire for this language in your market? |
| **Timeline** | How fast do you need to deliver? |
| **Maintenance** | Who maintains this in 5 years? |
| **Existing stack** | What languages/tools are already in use? |
| **Organization size** | Startup (move fast) vs enterprise (stability)? |

## Step 2: Domain Decision Matrix

### Quick Decision Guide

| Domain | Primary Choice | Strong Alternative | Avoid |
|--------|---------------|-------------------|-------|
| **Web Backend (API)** | Go, Java/Kotlin, C# | Python (FastAPI), Node.js | Rust (unless performance-critical), Dart |
| **Web Frontend** | TypeScript (React/Vue/Angular) | — | Java, Go, Rust, Python |
| **Mobile (cross-platform)** | Flutter (Dart), React Native (TS) | KMP (Kotlin) | Go, Rust, Python |
| **Mobile (iOS native)** | Swift | — | Everything else |
| **Mobile (Android native)** | Kotlin | Java (legacy) | Everything else |
| **Systems programming** | Rust | C, C++ | Python, JS, Dart |
| **CLI tools** | Go | Rust | Java (startup time), Python (distribution) |
| **Data science / ML** | Python | Julia (HPC) | Go, Rust, Java |
| **DevOps / Infrastructure** | Go | Python, Rust | Java, C# |
| **Game development** | C# (Unity) | C++ (Unreal) | Python, Go, Rust |
| **Embedded / IoT** | C, Rust | C++, MicroPython | Java, Go, Dart |
| **Serverless** | Go, Node.js (TS) | Python, C# (Native AOT) | Java (cold starts) |
| **Enterprise backend** | Java/Kotlin, C# | Go | Rust (ecosystem), Dart |
| **Real-time / Low-latency** | Rust, C++ | Go, C# | Python, JS |
| **Scripting / Automation** | Python | Bash, JavaScript | Go, Rust, Java |
| **Blockchain / Web3** | Rust, Solidity | Go | Python, Java |

## Step 3: Weighted Evaluation Criteria

### Criteria Definitions

| Criterion | Weight (typical) | What to Evaluate |
|-----------|-----------------|-----------------|
| **Performance** | 15-30% | Throughput, latency, memory, startup time |
| **Ecosystem** | 15-25% | Libraries, frameworks, tools availability |
| **Developer productivity** | 15-25% | Time to build features, learning curve |
| **Team expertise** | 10-20% | Current skills, ramp-up time |
| **Hiring market** | 5-15% | Availability of developers in your market |
| **Long-term viability** | 5-15% | Language momentum, corporate backing, community |
| **Safety** | 5-15% | Type safety, memory safety, null safety |
| **Deployment** | 5-10% | Binary size, startup time, containerization |

### Scoring Example

```
Project: New microservice for payment processing
Requirements: Low latency, high reliability, team knows Java and Go

Criteria (weighted):
                        Go      Java/Kotlin   Rust    Node.js
Performance (25%)       9/10    7/10          10/10   5/10
Ecosystem (20%)         7/10    10/10         6/10    8/10
Productivity (20%)      8/10    7/10          5/10    8/10
Team expertise (15%)    8/10    9/10          2/10    6/10
Hiring (10%)            7/10    9/10          4/10    8/10
Safety (10%)            7/10    7/10          10/10   5/10

Weighted score:         7.85    8.00          5.95    6.65

Decision: Java/Kotlin (Spring Boot) — highest weighted score
Rationale: Team expertise + ecosystem offset Go's performance edge
```

## Step 4: Constraint Checks

### Hard Constraints (Eliminators)

| Constraint | Eliminates | Reason |
|-----------|-----------|--------|
| Must run on iOS | Everything except Swift, Dart (Flutter), JS (RN), Kotlin (KMP) | Platform requirement |
| Must run in browser | Everything except JavaScript/TypeScript, Dart (Flutter Web), Rust (WASM) | Browser environment |
| Must be <10ms startup | Java (without AOT), Python | JVM warmup, interpreter startup |
| Must have <10MB binary | Java, C# (self-contained) | Binary size |
| No GC pauses allowed | Java, Go, Python, Dart, JS, C# | GC-based runtimes |
| Must integrate with ML models | Eliminates Go, Rust (limited ecosystem) | Python dominates ML |
| Team of 1-2 developers | Eliminates languages team doesn't know (ramp-up risk) | Practical constraint |
| Regulatory (MISRA, DO-178C) | Eliminates most languages except C, C++, Ada, Rust (emerging) | Certification requirements |

### Soft Constraints (Trade-offs)

| Constraint | Impact | Mitigation |
|-----------|--------|-----------|
| Team doesn't know language | 2-4 month ramp-up | Training, hiring, pair programming |
| Small ecosystem for domain | More custom code needed | Evaluate before committing |
| Language is niche | Harder hiring | Consider remote, invest in training |
| Breaking changes expected | Migration cost | Use LTS versions, stay updated |

## Step 5: Proof-of-Concept Validation

### When to Build a PoC

Build a PoC before committing when:
- Team has no experience with the candidate language
- Performance requirements are critical and unproven
- Integration with existing systems is complex
- The project will run for 3+ years

### PoC Checklist

```
□ Implement a representative API endpoint
□ Connect to the real database
□ Run load tests matching expected production traffic
□ Measure: latency (P50, P99), throughput, memory usage
□ Evaluate: development speed, code readability, debugging
□ Test: deployment pipeline (Docker, CI/CD)
□ Assess: library availability for key requirements
□ Time: complete PoC in 1-2 weeks maximum
```

## Step 6: Document the Decision (ADR)

### Architecture Decision Record Template

```markdown
# ADR-001: Language Selection for [Service Name]

## Status: Accepted

## Context
[Why is this decision needed? What are the requirements?]

## Decision
We will use [Language] with [Framework] for [Service Name].

## Alternatives Considered
1. [Alternative 1] — rejected because [reason]
2. [Alternative 2] — rejected because [reason]

## Consequences
### Positive
- [benefit 1]
- [benefit 2]

### Negative
- [trade-off 1]
- [trade-off 2]

### Risks
- [risk 1 + mitigation]
```

## Common Decision Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Approach |
|-------------|-------------|----------------|
| **Resume-Driven Development** | Choosing for personal growth, not project fit | Evaluate against project requirements |
| **Hype-Driven Development** | "X is trending on HN/Twitter" | Check maturity, ecosystem, hiring market |
| **Familiarity Bias** | "We've always used Java" | Evaluate alternatives fairly |
| **One Language for Everything** | Forcing square peg into round hole | Polyglot where it makes sense |
| **Performance Without Measurement** | "Rust is faster" (for a CRUD API) | Measure; most apps are I/O-bound |
| **Ignoring Team Skills** | "Rust is best" (team knows only Python) | Factor in ramp-up time and risk |
| **Decision Paralysis** | Endless evaluation, no commitment | Timebox decision, accept "good enough" |
| **Premature Polyglot** | 5 languages for a 3-person team | Keep stack manageable |

## Language Quick Reference Card

### Performance Tiers

```
Tier 1 (Fastest):
  Rust ≈ C ≈ C++ > Swift > Go ≈ Java (warmed) ≈ C# > Dart

Tier 2 (Fast enough for most):
  Go ≈ Java ≈ C# ≈ Dart (AOT) > Node.js > Python + NumPy

Tier 3 (Acceptable for I/O-bound):
  Node.js > Python (async) > Ruby

Note: For most web services, all Tier 1-2 languages are
"fast enough" — the database is the bottleneck, not the language.
```

### Startup Time Tiers

```
Instant (<20ms):   Go, Rust, C, C++, Swift (native)
Fast (<100ms):     C# (Native AOT), Dart (AOT), Node.js
Moderate (<500ms): Python, C# (JIT), Dart (JIT)
Slow (>500ms):     Java (JIT), Scala
```

### Ecosystem Size

```
Massive (1M+ packages):  JavaScript/TypeScript (npm), Python (PyPI)
Large (300K+):            Java (Maven Central), C# (NuGet)
Medium (100K+):           Go (modules), Rust (crates.io), Ruby (gems)
Focused (30-100K):        Swift (SPM), Dart (pub.dev), Kotlin (Maven)
```

### Learning Curve

```
Easiest:    Python > JavaScript > Dart > Go
Medium:     TypeScript > Kotlin > Swift > C# > Java
Hardest:    Rust > C++ > Haskell > C (systems-level)
```

## Multi-Language Architecture Patterns

### The "Best Tool for the Job" Pattern

```
Typical Modern Stack:
├── Frontend: TypeScript (React/Vue/Angular)
├── Backend API: Go or Java/Kotlin or C#
├── Data pipeline: Python
├── Infrastructure/CLI: Go
├── Mobile: Swift (iOS) + Kotlin (Android) or Flutter (Dart)
├── ML/AI: Python
└── Performance-critical: Rust or C++
```

### Language Selection by Company Stage

| Stage | Strategy | Typical Stack |
|-------|----------|--------------|
| **Solo/Prototype** | One language, maximum speed | Python or TypeScript (full-stack) |
| **Startup (2-10 devs)** | 1-2 languages, move fast | TypeScript + Python or Go |
| **Scale-up (10-50 devs)** | Add specialized languages | + Java/C# for enterprise, Rust for perf |
| **Enterprise (50+ devs)** | Polyglot, team autonomy | Language per domain, shared standards |

## Sources

- [ThoughtWorks Technology Radar](https://www.thoughtworks.com/radar)
- [Stack Overflow Developer Survey](https://survey.stackoverflow.co/)
- [GitHub Octoverse](https://github.blog/news-insights/octoverse/)
- [TIOBE Index](https://www.tiobe.com/tiobe-index/)
- [JetBrains State of Developer Ecosystem](https://www.jetbrains.com/lp/devecosystem/)
- [InfoQ Architecture & Design Trends](https://www.infoq.com/)
