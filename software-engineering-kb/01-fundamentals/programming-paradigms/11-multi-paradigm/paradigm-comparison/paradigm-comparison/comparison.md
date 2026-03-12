# Paradigm Comparison

> **Domain:** Fundamentals > Programming Paradigms > Multi-Paradigm
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

This guide compares all major programming paradigms across key dimensions, helping developers choose the right approach for each problem. No paradigm is universally superior — each excels in different contexts.

## Comprehensive Comparison Table

```
Paradigm         State Mgmt      Control Flow       Data Model        Testing
──────────────────────────────────────────────────────────────────────────────
Procedural       Mutable shared   Sequential         Structs/arrays    Moderate
OOP              Encapsulated     Message passing    Objects/classes   Good (with DI)
Functional       Immutable        Expression eval    Values/functions  Excellent
Logic            Facts/rules      Backtracking       Relations         Moderate
Declarative      Desired state    Engine decides     Specifications    Framework-dep
Concurrent       Per-thread/actor Interleaved/parallel  Shared/private  Difficult
Reactive         Streams          Push-based         Observables       Moderate
Event-Driven     Event state      Event dispatch     Events/handlers   Moderate
```

```
Paradigm         Scalability     Learning Curve  Debugging       Concurrency
──────────────────────────────────────────────────────────────────────────────
Procedural       Limited          Low             Easy            Hard (shared state)
OOP              Good             Medium          Good            Medium
Functional       Excellent        High            Medium          Excellent (no state)
Logic            Problem-specific High            Hard            N/A
Declarative      Depends on engine Low-Medium     Hard (opaque)   Engine handles
Concurrent       Excellent        High            Very hard       Native
Reactive         Excellent        High            Hard (async)    Built-in
Event-Driven     Good             Medium          Medium          Natural (async)
```

## Same Problem — Five Paradigms

**Task:** Filter even numbers from a list, square them, sum the results.

```python
# PROCEDURAL
result = 0
for n in numbers:
    if n % 2 == 0:
        result += n * n

# OBJECT-ORIENTED
class NumberProcessor:
    def __init__(self, numbers):
        self.numbers = numbers
    def process(self):
        return sum(n * n for n in self.numbers if n % 2 == 0)

# FUNCTIONAL
from functools import reduce
result = reduce(
    lambda acc, x: acc + x,
    map(lambda x: x * x, filter(lambda x: x % 2 == 0, numbers))
)

# DECLARATIVE (SQL)
# SELECT SUM(n * n) FROM numbers WHERE n % 2 = 0;

# REACTIVE (RxPY)
from rx import of
of(*numbers).pipe(
    filter(lambda x: x % 2 == 0),
    map(lambda x: x * x),
    reduce(lambda acc, x: acc + x),
).subscribe(print)
```

```haskell
-- FUNCTIONAL (Haskell — idiomatic)
result = sum . map (^2) . filter even $ numbers
```

```go
// CSP / CONCURRENT (Go)
func sumEvenSquares(numbers []int) int {
    ch := make(chan int)
    go func() {
        sum := 0
        for _, n := range numbers {
            if n%2 == 0 {
                sum += n * n
            }
        }
        ch <- sum
    }()
    return <-ch
}
```

## Decision Matrix

```
"I need to..."                          Use...
──────────────────────────────────────────────────────────────
Transform data through a pipeline       → Functional
Model a complex business domain         → OOP
Write a quick script or utility         → Procedural
Build a responsive UI                   → Reactive + Event-Driven
Handle high-concurrency I/O             → Async / Event-Driven
Distribute work across machines         → Actor Model
Coordinate parallel workflows           → CSP / Channels
Search a solution space                 → Logic / Constraint
Define infrastructure or config         → Declarative / DSL
Add cross-cutting behavior              → AOP / Decorators
Build type-safe reusable libraries      → Generic / Type-Level
Eliminate boilerplate code              → Metaprogramming / Macros
```

## Paradigm Synergies

```
Paradigms that work well together:
─────────────────────────────────
OOP + Functional          → TypeScript, Kotlin, Scala (best of both)
Functional + Concurrent   → Erlang, Elixir (no shared state = safe concurrency)
OOP + Reactive            → Angular, Spring WebFlux (components + streams)
Declarative + Functional  → React (JSX + pure functions)
Procedural + Functional   → Go, Python (simple + composable)
Generic + Functional      → Rust, Haskell (type-safe abstractions)

Paradigms that conflict:
─────────────────────────
Shared mutable state + Concurrency  → Race conditions
Deep inheritance + Composition      → Confusion about structure
Implicit AOP + Explicit control     → Hard to debug flow
```

## The Modern Reality

```
Most production code uses 2-4 paradigms in the same codebase:

React App:
  - Functional:     Components as pure functions, hooks
  - Reactive:       State management (signals, stores)
  - Event-Driven:   User interaction handlers
  - Declarative:    JSX templates

Spring Boot API:
  - OOP:            Controllers, services, repositories
  - AOP:            @Transactional, @Cacheable, logging
  - Declarative:    SQL queries, annotation configuration
  - Functional:     Stream API for data processing

Go Microservice:
  - Procedural:     Main logic flow
  - Concurrent:     Goroutines + channels
  - Functional:     Closures, first-class functions
  - Declarative:    SQL, config files
```

## Sources

- Van Roy, P. & Haridi, S. (2004). *Concepts, Techniques, and Models of Computer Programming*. MIT Press.
- Bruce, K.B. (2002). *Foundations of Object-Oriented Languages: Types and Semantics*. MIT Press.
- Tate, B. (2010). *Seven Languages in Seven Weeks*. Pragmatic Bookshelf.
