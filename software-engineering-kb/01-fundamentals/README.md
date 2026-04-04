# Fundamentals

The foundations of software engineering: paradigms, patterns, SOLID, clean code, data structures, algorithms. This section covers **language-agnostic** knowledge — applicable regardless of language, framework, or platform.

> **185 files** across 6 sections

---

## Contents

| # | Section | Files | Description |
|---|---------|-------|-------------|
| 1 | [Clean Code](clean-code/) | 51 | Clean code principles, naming, functions, classes, error handling, testing, refactoring |
| 2 | [Data Structures](data-structures/) | 32 | Arrays, stacks, queues, hash tables, trees, graphs, advanced structures |
| 3 | [Design Patterns](design-patterns/) | 34 | All GoF patterns (creational, structural, behavioral) + architectural + modern |
| 4 | [SOLID Principles](solid-principles/) | 10 | In-depth SOLID coverage: each principle, enterprise applications, violations, critique |
| 5 | [Programming Paradigms](programming-paradigms/) | 37 | Imperative, OOP, functional, declarative, concurrent, reactive, metaprogramming |
| 6 | [Algorithms](algorithms/) | 21 | Sorting, searching, graphs, DP, greedy, backtracking, string, bit manipulation |

---

## Detailed Structure

### 1. Clean Code (`clean-code/`) — 51 files

How to write code that is readable, maintainable, and extensible.

| Category | Topics |
|----------|--------|
| **01-principles/** | SRP, OCP, LSP, ISP, DIP, DRY, KISS, YAGNI, Separation of Concerns, Law of Demeter, Composition over Inheritance, Encapsulation, Abstraction, Boy Scout Rule |
| **02-naming/** | Naming conventions |
| **03-functions/** | Functions and methods |
| **04-classes-and-objects/** | Class design, coupling, cohesion |
| **05-formatting-and-structure/** | Code formatting, file organization, project structure |
| **06-comments-and-docs/** | Comments & documentation, self-documenting code, API documentation |
| **07-error-handling/** | Exceptions, defensive programming, logging |
| **08-code-smells/** | Common smells, complexity metrics, technical debt |
| **09-testing/** | Unit testing, TDD, test patterns, test quality |
| **10-refactoring/** | Refactoring techniques, refactoring patterns, when to refactor |
| **11-tools-and-practices/** | Linters & formatters, code reviews, static analysis, CI/CD |
| **12-advanced/** | Concurrency, immutability, boundaries & abstractions, dependency injection, performance vs readability |
| **13-industry-standards/** | Google style guides, Microsoft standards, Meta practices, open source conventions |

### 2. Data Structures (`data-structures/`) — 32 files

How to organize data in memory and which structure fits each problem.

| Category | Topics |
|----------|--------|
| **01-arrays-and-lists/** | Static arrays, dynamic arrays, linked lists (singly, doubly, circular) |
| **02-stacks-and-queues/** | Stacks, queues, deques, priority queues, circular buffer |
| **03-hash-based/** | Hash tables, hash functions, collision resolution, hash sets |
| **04-trees/** | Binary trees, BSTs, AVL trees, red-black trees, heaps, tries, B-trees |
| **05-graphs/** | Graph fundamentals, representations, traversal, weighted graphs |
| **06-advanced/** | Bloom filters, skip lists, disjoint sets, segment trees, Fenwick trees |
| **07-complexity-and-selection/** | Big-O cheatsheet, when to use what |

### 3. Design Patterns (`design-patterns/`) — 34 files

Reusable solutions to common design problems.

| Category | Topics |
|----------|--------|
| **01-overview/** | Design patterns overview |
| **02-creational/** | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| **03-structural/** | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| **04-behavioral/** | Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor |
| **05-architectural/** | MVC, MVVM, Repository, Dependency Injection, CQRS & Event Sourcing |
| **06-modern/** | Middleware, Pub-Sub, Module, Null Object |
| **07-anti-patterns/** | Common anti-patterns |

### 4. SOLID Principles (`solid-principles/`) — 10 files

In-depth analysis of SOLID principles, beyond the Clean Code basics.

| Category | Topics |
|----------|--------|
| **01-overview/** | SOLID overview |
| **02-single-responsibility/** | SRP fundamentals |
| **03-open-closed/** | OCP fundamentals |
| **04-liskov-substitution/** | LSP fundamentals |
| **05-interface-segregation/** | ISP fundamentals |
| **06-dependency-inversion/** | DIP fundamentals |
| **07-solid-in-practice/** | Enterprise applications (Spring Boot, microservices) |
| **08-solid-beyond-oop/** | Functional & modern (Haskell, Rust, TypeScript) |
| **09-violations-and-anti-patterns/** | Common violations |
| **10-criticism-and-pragmatism/** | Pragmatic SOLID — when NOT to apply |

### 5. Programming Paradigms (`programming-paradigms/`) — 37 files

The fundamental thinking styles in programming.

| Category | Topics |
|----------|--------|
| **01-overview/** | Paradigms overview |
| **02-imperative/** | Procedural, structured programming |
| **03-object-oriented/** | OOP fundamentals, encapsulation, inheritance, polymorphism, composition vs inheritance, SOLID |
| **04-functional/** | Functional fundamentals, pure functions, immutability, higher-order functions, closures & currying, monads & functors |
| **05-declarative/** | Declarative fundamentals, logic programming, constraint programming, DSLs |
| **06-concurrent-and-parallel/** | Concurrency fundamentals, threads & locks, actor model, CSP & channels, async programming |
| **07-reactive/** | Reactive fundamentals, observables & streams, event-driven |
| **08-metaprogramming/** | Metaprogramming fundamentals, reflection, macros & code generation, decorators & annotations |
| **09-generic-and-type-level/** | Generic programming, type systems, algebraic data types |
| **10-aspect-oriented/** | AOP fundamentals |
| **11-multi-paradigm/** | Multi-paradigm languages, paradigm comparison |

### 6. Algorithms (`algorithms/`) — 21 files

Algorithmic thinking, from basic sorting to real-world distributed algorithms.

| Category | Topics |
|----------|--------|
| **01-overview/** | Algorithms overview |
| **02-complexity-analysis/** | Complexity & Big-O |
| **03-recursion/** | Recursion fundamentals |
| **04-sorting/** | Comparison sorting (quicksort, mergesort, heapsort, timsort), non-comparison sorting (counting, radix, bucket) |
| **05-searching/** | Searching fundamentals (binary, interpolation, jump), two pointers & sliding window |
| **06-graph-algorithms/** | Graph traversal (BFS/DFS), shortest path (Dijkstra, Bellman-Ford, Floyd-Warshall, A*), minimum spanning tree (Kruskal, Prim) |
| **07-dynamic-programming/** | DP fundamentals (memoization, tabulation) |
| **08-greedy/** | Greedy algorithms |
| **09-divide-and-conquer/** | Divide and conquer |
| **10-backtracking/** | Backtracking |
| **11-string-algorithms/** | String matching (KMP, Rabin-Karp, Boyer-Moore, Aho-Corasick) |
| **12-tree-algorithms/** | Tree traversal & BST, advanced trees (AVL rotations, segment trees, LCA) |
| **13-hashing/** | Hashing algorithms |
| **14-bit-manipulation/** | Bit manipulation |
| **15-mathematical/** | Mathematical algorithms (number theory, combinatorics) |
| **16-practical-algorithms/** | Real-world algorithms (consensus, consistent hashing) |

---

## How it connects to the rest

This section is the **foundation** on which all other sections build:

```
01-fundamentals (you are here)
├──> 02-languages-and-runtimes   — applying paradigms to specific languages
├──> 03-architecture             — design patterns + SOLID at system-level design
├──> 04-project-structure        — clean code principles in folder structure
├──> 05-frontend / 06-backend    — patterns + data structures in practice
├──> 07-database                 — data structures behind indexes, B-trees, hashing
├──> 09-performance              — Big-O, algorithm selection, complexity analysis
├──> 11-testing                  — testing principles from clean code in depth
└──> 13-code-quality             — refactoring + code smells in production
```

### Recommended study order

1. **Clean Code > 01-principles** — start with SOLID, DRY, KISS
2. **Programming Paradigms** — understand OOP vs Functional vs the rest
3. **Data Structures** — arrays through graphs
4. **Algorithms** — sorting, searching, graph algorithms
5. **Design Patterns** — GoF + modern patterns
6. **SOLID Principles** — in-depth after the basics
