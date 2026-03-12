# Programming Paradigms Overview

> **Domain:** Fundamentals > Programming Paradigms
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A programming paradigm is a **fundamental style or approach to programming** that provides a framework for structuring and organizing code. Paradigms define how programmers think about computation, data, and control flow. Most modern languages support multiple paradigms, and expert developers choose the right paradigm for each problem.

## Paradigm Taxonomy

```
Programming Paradigms
├── Imperative (HOW to do it — step by step)
│   ├── Procedural .............. C, Pascal, Fortran, COBOL
│   ├── Structured .............. Dijkstra's theorem — no goto
│   └── Object-Oriented ........ Java, C#, Python, Ruby
│       ├── Class-based ......... Java, C++, C#, Python
│       └── Prototype-based ..... JavaScript, Lua, Self
│
├── Declarative (WHAT to compute — not how)
│   ├── Functional .............. Haskell, Erlang, Clojure, F#
│   ├── Logic ................... Prolog, Datalog, Mercury
│   ├── Constraint .............. MiniZinc, ECLiPSe
│   └── DSLs .................... SQL, HTML, CSS, Regex, GraphQL
│
├── Concurrent & Parallel
│   ├── Shared Memory / Threads . Java, C++, Python (GIL)
│   ├── Actor Model ............. Erlang/OTP, Akka, Elixir
│   ├── CSP / Channels .......... Go, Clojure core.async
│   └── Async / Coroutines ...... JS, Python asyncio, Rust tokio
│
├── Reactive .................... RxJS, RxJava, Reactor, Signals
├── Metaprogramming ............. Lisp macros, Rust macros, reflection
├── Generic / Type-level ........ Haskell, Rust, TypeScript, C++
└── Aspect-Oriented ............. Spring AOP, AspectJ
```

## Language–Paradigm Matrix

| Language     | Procedural | OOP | Functional | Concurrent | Reactive | Meta | Generic |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| C            | **P** | - | - | threads | - | macros | - |
| Java         | - | **P** | partial | threads | RxJava | reflection | generics |
| Python       | yes | yes | partial | GIL | RxPY | decorators | typing |
| JavaScript   | yes | prototype | yes | event loop | RxJS | Proxy | - |
| TypeScript   | yes | yes | yes | async | RxJS | decorators | **P** |
| Go           | yes | interfaces | partial | **P** (goroutines) | - | reflect | generics |
| Rust         | yes | traits | **P** | async + channels | - | macros | **P** |
| Haskell      | - | typeclasses | **P** | STM | - | Template | **P** |
| Erlang       | - | - | **P** | **P** (actors) | - | macros | - |
| Scala        | - | yes | **P** | Akka | Reactor | macros | **P** |
| Kotlin       | - | yes | yes | coroutines | Flow | - | generics |
| C++          | yes | yes | partial | threads | - | templates | **P** |
| C#           | - | **P** | partial | async/Task | Rx.NET | reflection | generics |
| Prolog       | - | - | - | - | - | - | - |
| SQL          | - | - | declarative | - | - | - | - |

**P** = Primary paradigm of the language

## Timeline of Paradigm Evolution

```
1950s  Procedural .............. Fortran (1957), COBOL (1959)
1958   Functional .............. Lisp (1958) — lambda calculus
1960s  Object-Oriented ......... Simula (1967) — first OOP language
1968   Structured .............. Dijkstra "Go To Considered Harmful"
1970s  Logic ................... Prolog (1972)
1973   Actor Model ............. Carl Hewitt (1973)
1978   CSP ..................... Tony Hoare (1978)
1980s  OOP dominance ........... Smalltalk-80, C++ (1983)
1990   Functional revival ...... Haskell (1990), Erlang (1986 → production)
1995   Multi-paradigm era ...... Java (1995), JavaScript (1995), Python (1991)
2000s  Reactive ................ Rx (2009), Reactive Manifesto (2013)
2005   Concurrent focus ........ Go (2009), Erlang/OTP growth
2010s  Type-safe FP ............ TypeScript (2012), Rust (2015), Kotlin (2016)
2020s  Multi-paradigm default .. Every major language supports multiple paradigms
```

## Choosing a Paradigm

```
Problem Domain                    Best Paradigm
──────────────────────────────────────────────────
Data transformation pipelines     Functional (map/filter/reduce)
Business domain modeling          OOP (encapsulation, inheritance)
UI state management               Reactive (streams, signals)
System programming                Procedural + low-level control
High concurrency / distributed    Actor model or CSP
Database queries                  Declarative (SQL)
AI / knowledge reasoning          Logic (Prolog)
Cross-cutting concerns            Aspect-Oriented
Compiler / interpreter            Functional + Visitor pattern
Build automation / config         DSLs (Gradle, Terraform, YAML)
```

## Sources

- Van Roy, P. & Haridi, S. (2004). *Concepts, Techniques, and Models of Computer Programming*. MIT Press.
- Van Roy, P. (2009). [Programming Paradigms for Dummies](https://webperso.info.ucl.ac.be/~pvr/VanRoyChapter.pdf).
- [Wikipedia — Programming Paradigm](https://en.wikipedia.org/wiki/Programming_paradigm)
- [LMU — Programming Paradigms](https://cs.lmu.edu/~ray/notes/paradigms/)
