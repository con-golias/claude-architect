# Design Patterns Overview

> **Domain:** Fundamentals > Design Patterns
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

Design patterns are **reusable solutions to commonly occurring problems** in software design. They are not finished code, but templates describing how to solve problems that appear in many different contexts. The seminal work is *Design Patterns: Elements of Reusable Object-Oriented Software* (1994) by Erich Gamma, Richard Helm, Ralph Johnson, and John Vlissides — known as the **Gang of Four (GoF)**.

## Why It Matters

- **Common vocabulary** — "use a Strategy here" communicates a complex idea in two words.
- **Proven solutions** — decades of real-world usage have validated these patterns.
- **Maintainability** — patterns promote loose coupling, high cohesion, and SOLID principles.
- **Framework understanding** — modern frameworks (Spring, React, Angular, .NET) use patterns extensively.

## The 23 GoF Patterns

### Creational Patterns (5)

Control **how objects are created**, hiding creation logic and decoupling code from specific classes.

| Pattern | Intent | When to Use |
|---------|--------|-------------|
| **Singleton** | Ensure only one instance exists | Config, logging, connection pools |
| **Factory Method** | Delegate instantiation to subclasses | When the exact type varies at runtime |
| **Abstract Factory** | Create families of related objects | UI toolkits, cross-platform code |
| **Builder** | Construct complex objects step by step | Objects with many optional parameters |
| **Prototype** | Clone existing objects | When creation is expensive |

### Structural Patterns (7)

Deal with **how classes and objects are composed** to form larger structures.

| Pattern | Intent | When to Use |
|---------|--------|-------------|
| **Adapter** | Convert one interface to another | Integrating legacy or third-party code |
| **Bridge** | Separate abstraction from implementation | Multiple dimensions of variation |
| **Composite** | Treat individual and composite objects uniformly | Tree structures (UI, file systems) |
| **Decorator** | Add behavior dynamically | Extending functionality without subclassing |
| **Facade** | Simplify a complex subsystem | Providing a clean API over messy internals |
| **Flyweight** | Share common state to save memory | Large numbers of similar objects |
| **Proxy** | Control access to an object | Lazy loading, access control, logging |

### Behavioral Patterns (11)

Concerned with **communication between objects** and distribution of responsibility.

| Pattern | Intent | When to Use |
|---------|--------|-------------|
| **Chain of Responsibility** | Pass request along a chain of handlers | Middleware, event handling |
| **Command** | Encapsulate a request as an object | Undo/redo, task queues |
| **Interpreter** | Define a grammar and interpret sentences | DSLs, expression evaluation |
| **Iterator** | Traverse a collection without exposing internals | Custom collection traversal |
| **Mediator** | Centralize complex communications | Chat rooms, air traffic control |
| **Memento** | Capture and restore object state | Undo, snapshots, checkpoints |
| **Observer** | Notify dependents of state changes | Event systems, data binding |
| **State** | Change behavior based on internal state | Workflow engines, UI state machines |
| **Strategy** | Swap algorithms at runtime | Payment methods, sorting strategies |
| **Template Method** | Define algorithm skeleton, let subclasses fill in steps | Frameworks with hooks |
| **Visitor** | Add operations to objects without modifying them | Compilers, document processing |

## Pattern Relationships

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │ uses
         ┌─────────────────┼─────────────────┐
         ↓                 ↓                 ↓
    ┌─────────┐      ┌──────────┐      ┌──────────┐
    │Creational│      │Structural│      │Behavioral│
    │ How to   │      │ How to   │      │ How to   │
    │ create   │      │ compose  │      │communicate│
    └─────────┘      └──────────┘      └──────────┘

Common combinations:
- Factory + Singleton (factory as a singleton)
- Strategy + Factory (factory selects strategy)
- Observer + Mediator (mediator coordinates observers)
- Decorator + Composite (decorators form a chain)
- Command + Memento (command stores undo state)
```

## How to Choose a Pattern

1. **Identify the problem** — what is varying? What changes frequently?
2. **Find the matching intent** — each pattern solves a specific type of problem.
3. **Consider alternatives** — multiple patterns may apply; choose the simplest.
4. **Don't force it** — if the code is simple, a pattern may add unnecessary complexity.

## Best Practices

1. **Learn the intent, not just the structure** — understanding WHY is more important than the class diagram.
2. **Start with the simplest solution** — only introduce a pattern when complexity justifies it.
3. **Combine patterns** — real-world solutions often use multiple patterns together.
4. **Prefer composition over inheritance** — most modern patterns favor composition.
5. **Know your language idioms** — in Python or TypeScript, some patterns simplify to a few lines.

## Anti-patterns / Common Mistakes

- **Pattern overuse** — applying patterns where simple code would suffice (the "pattern hammer").
- **Premature abstraction** — adding patterns before the need is clear.
- **Ignoring language features** — many GoF patterns exist because Java/C++ lacked features that modern languages have (closures, first-class functions, decorators).
- **Cargo cult patterns** — copying pattern structure without understanding the underlying problem.

## Sources

- Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
- Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly.
- [Refactoring.Guru — Design Patterns](https://refactoring.guru/design-patterns)
- [DigitalOcean — GoF Design Patterns](https://www.digitalocean.com/community/tutorials/gangs-of-four-gof-design-patterns)
- [Spring Framework Guru — GoF Patterns](https://springframework.guru/gang-of-four-design-patterns/)
