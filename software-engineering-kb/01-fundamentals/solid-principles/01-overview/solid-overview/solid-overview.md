# SOLID Principles — Overview

| **Domain**       | Fundamentals > SOLID Principles > Overview |
|------------------|--------------------------------------------|
| **Difficulty**   | Intermediate                               |
| **Last Updated** | 2026-03-07                                 |

---

## What It Is

**SOLID** is an acronym representing five foundational principles of object-oriented design. The principles themselves were identified and articulated by **Robert C. Martin** (widely known as "Uncle Bob") across a series of papers and articles throughout the 1990s. The mnemonic acronym **SOLID** was later coined by **Michael Feathers** in the early 2000s to make the set of principles easier to remember and teach.

Martin first consolidated these ideas in his 2000 paper *"Design Principles and Design Patterns,"* where he laid out the core design principles that distinguish well-structured object-oriented systems from fragile, rigid ones. He then refined and expanded on them in his landmark book *"Agile Software Development: Principles, Patterns, and Practices"* (Prentice Hall, 2002), which remains the definitive reference for these principles.

The five principles are:

1. **S** — Single Responsibility Principle (SRP)
2. **O** — Open/Closed Principle (OCP)
3. **L** — Liskov Substitution Principle (LSP)
4. **I** — Interface Segregation Principle (ISP)
5. **D** — Dependency Inversion Principle (DIP)

Together, they provide a framework for designing software that is **maintainable**, **extensible**, **testable**, and **resilient to change**. While originally formulated for object-oriented programming, the underlying ideas apply broadly to functional programming, modular design, and system architecture.

---

## The Five Principles

| Letter | Principle                        | One-Line Description                                                                 | Key Benefit                        |
|--------|----------------------------------|--------------------------------------------------------------------------------------|------------------------------------|
| **S**  | Single Responsibility Principle  | A module should be responsible to one, and only one, actor.                          | Reduces coupling, fewer merge conflicts |
| **O**  | Open/Closed Principle            | Software entities should be open for extension but closed for modification.          | Stability of tested code           |
| **L**  | Liskov Substitution Principle    | Subtypes must be substitutable for their base types without altering correctness.    | Reliable polymorphism              |
| **I**  | Interface Segregation Principle  | No client should be forced to depend on methods it does not use.                     | Lean, focused interfaces           |
| **D**  | Dependency Inversion Principle   | High-level modules should not depend on low-level modules; both should depend on abstractions. | Decoupled, flexible architecture   |

---

## Historical Context

The SOLID principles did not emerge all at once. They represent a convergence of ideas from multiple researchers over more than a decade:

| Year | Event | Contributor |
|------|-------|-------------|
| **1987** | Liskov delivers her keynote *"Data Abstraction and Hierarchy"* at OOPSLA, introducing the substitutability principle that would later become LSP. | **Barbara Liskov** |
| **1988** | Bertrand Meyer publishes *Object-Oriented Software Construction*, articulating the Open/Closed Principle in terms of implementation inheritance. | **Bertrand Meyer** |
| **1994** | Martin publishes *"The Interface Segregation Principle"* based on consulting work at Xerox, where a polluted `Job` interface caused cascading recompilations. | **Robert C. Martin** |
| **1996** | Martin publishes *"The Open-Closed Principle"* in *The C++ Report*, reinterpreting Meyer's OCP in terms of abstract interfaces and polymorphism rather than implementation inheritance. | **Robert C. Martin** |
| **1996** | Martin publishes *"The Dependency Inversion Principle"* in *The C++ Report*, inverting the traditional dependency structure of procedural systems. | **Robert C. Martin** |
| **2000** | Martin consolidates the five principles in *"Design Principles and Design Patterns,"* a paper that lays out the symptoms of rotting software (rigidity, fragility, immobility, viscosity). | **Robert C. Martin** |
| **~2000-2002** | Michael Feathers rearranges the five principle names to form the SOLID mnemonic, giving the set its memorable name. | **Michael Feathers** |
| **2002** | Martin publishes *Agile Software Development: Principles, Patterns, and Practices* (Prentice Hall), the definitive reference for SOLID in the context of agile development. | **Robert C. Martin** |
| **2008** | Martin publishes *Clean Code: A Handbook of Agile Software Craftsmanship*, which references SOLID in the broader context of writing clean, professional code. | **Robert C. Martin** |
| **2017** | Martin publishes *Clean Architecture: A Craftsman's Guide to Software Structure and Design*, elevating SOLID from class-level to component and architectural-level principles. | **Robert C. Martin** |

---

## Why SOLID Matters

### The Cost of Maintenance

Industry research consistently shows that **maintenance accounts for 60-80% of total software lifecycle costs** (Boehm, 1981; Glass, 2002). The majority of a developer's time is spent reading, understanding, and modifying existing code rather than writing new code. SOLID directly addresses this by producing code structures that are easier to understand, modify, and extend.

> *"The only way to go fast, is to go well."*
> — Robert C. Martin

### Concrete Benefits

| Benefit | How SOLID Helps |
|---------|-----------------|
| **Maintainability** | SRP ensures each module has a focused purpose. Changes are localized rather than scattered across the codebase. |
| **Testability** | DIP and ISP produce small, focused interfaces that are easy to mock and test in isolation. SRP ensures each unit of code has a clear, testable responsibility. |
| **Flexibility** | OCP and DIP allow new behaviors to be added through extension rather than modification, making the system adaptable to changing requirements. |
| **Reduced Coupling** | DIP inverts dependencies so that high-level policy is not coupled to low-level detail. ISP prevents clients from depending on interfaces they do not use. |
| **Team Collaboration** | SRP aligns code boundaries with team boundaries. When each module serves a single actor, different teams can work on different modules with minimal merge conflicts. |
| **Reduced Regression Risk** | OCP means that adding new features does not require modifying existing, tested code, reducing the chance of introducing regressions. |

### Industry Adoption

SOLID is a standard part of the software engineering curriculum at most universities and bootcamps. It appears in technical interview expectations at companies like Google, Microsoft, Amazon, and Meta. Frameworks such as Spring (Java), ASP.NET Core (C#), Angular (TypeScript), and Django (Python) are designed with SOLID principles in mind, particularly DIP through dependency injection containers.

---

## How the Principles Relate

The five principles are not independent rules to be applied in isolation. They form an interconnected system where each principle reinforces the others:

```
                    ┌─────────────────────────────┐
                    │        COHESION AXIS         │
                    │                              │
                    │   SRP ◄──────────────► ISP   │
                    │   (one reason to change)     │
                    │   (focused interfaces)       │
                    └──────────┬──────────┬────────┘
                               │          │
                    ┌──────────▼──────────▼────────┐
                    │      ABSTRACTION AXIS         │
                    │                              │
                    │   OCP ◄──────────────► DIP   │
                    │   (extend, don't modify)     │
                    │   (depend on abstractions)   │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │     SUBSTITUTABILITY AXIS     │
                    │                              │
                    │          LSP                  │
                    │   (correct subtyping)         │
                    │   (enables OCP + DIP)         │
                    └──────────────────────────────┘
```

### Principle Relationships Table

| Principle Pair | Relationship |
|----------------|-------------|
| **SRP + ISP** | Both address **cohesion**. SRP keeps classes focused on one actor; ISP keeps interfaces focused on one client. ISP is, in a sense, SRP applied to interfaces. |
| **OCP + DIP** | Both address **abstraction**. OCP says to extend via abstraction rather than modification; DIP says to depend on those abstractions. You cannot truly achieve OCP without DIP. |
| **LSP + OCP** | LSP is a **prerequisite for OCP**. If subtypes cannot be substituted for their base types, polymorphic extension (the mechanism behind OCP) breaks down. |
| **LSP + DIP** | DIP relies on polymorphism to invert dependencies. If subtypes violate LSP, the abstractions that DIP depends on become unreliable. |
| **SRP + OCP** | SRP **enables** OCP. Smaller, focused classes are easier to extend without modification. A class with many responsibilities is harder to close against all axes of change. |
| **ISP + DIP** | ISP produces **fine-grained abstractions** that DIP can invert against. Fat interfaces make DIP harder because clients are forced to depend on methods they do not need. |

---

## SOLID in Different Paradigms

While SOLID was formulated for object-oriented programming, the underlying ideas transcend any single paradigm:

| Principle | OOP Application | Functional Application | Procedural / Modular Application |
|-----------|----------------|----------------------|----------------------------------|
| **SRP** | One class, one actor | One function/module, one purpose | One module/source file per concern |
| **OCP** | Polymorphism via interfaces and inheritance | Higher-order functions, function composition, pattern matching with exhaustive cases | Function pointers, callback tables, plugin modules |
| **LSP** | Subtype substitutability in class hierarchies | Behavioral equivalence of functions sharing a signature/contract | Interchangeable modules that honor the same API contract |
| **ISP** | Small, client-specific interfaces instead of one fat interface | Small, focused function signatures; trait-based composition (Rust, Haskell typeclasses) | Minimal header/module exports; exposing only what clients need |
| **DIP** | Depend on abstract interfaces, inject implementations | Depend on function signatures (callbacks, higher-order functions); parameterize behavior | Depend on abstract module interfaces; link against abstractions |

### Example: SRP in Functional vs OOP

```typescript
// OOP: SRP via separate classes
class UserValidator { validate(user: User): ValidationResult { /* ... */ } }
class UserRepository { save(user: User): Promise<void> { /* ... */ } }

// Functional: SRP via separate functions/modules
// validation.ts
export const validateUser = (user: User): ValidationResult => { /* ... */ };
// repository.ts
export const saveUser = (user: User): Promise<void> => { /* ... */ };
```

```python
# Functional Python: SRP via separate modules
# validation.py
def validate_user(user: dict) -> list[str]:
    """Returns list of validation errors."""
    ...

# repository.py
def save_user(user: dict) -> None:
    """Persists user to database."""
    ...
```

---

## Quick Reference Decision Guide

When you encounter a specific code smell or problem, the following guide helps you identify which SOLID principle to apply:

| When You See This Problem... | Apply This Principle |
|-----------------------------|---------------------|
| A class that changes for many different reasons (different stakeholders) | **SRP** — Split into classes, each serving one actor |
| Adding a new feature requires modifying existing, tested code | **OCP** — Introduce an abstraction so new features are added by extension |
| A long `if/else` or `switch` chain on a type discriminator | **OCP** — Replace conditional with polymorphism (Strategy or similar pattern) |
| A subclass that overrides a method to throw `NotImplementedError` or do nothing | **LSP** — Redesign the hierarchy; the subclass is not a true subtype |
| A subclass that violates preconditions/postconditions of its base class | **LSP** — Strengthen the contract or restructure the inheritance |
| A class forced to implement interface methods it does not need | **ISP** — Split the fat interface into smaller, role-specific interfaces |
| Mock objects in tests are overly complex because of fat interfaces | **ISP** — Smaller interfaces mean simpler mocks |
| High-level business logic imports low-level infrastructure code directly | **DIP** — Introduce an abstraction; make infrastructure implement it |
| Changing a database driver or external API requires modifying business logic | **DIP** — Business logic depends on an interface, not the concrete driver |
| Unit tests require standing up real databases, network services, or file systems | **DIP** — Inject abstract dependencies so tests can substitute fakes |
| Merge conflicts are frequent because many features touch the same file | **SRP** — The file has too many responsibilities; split it |

---

## SOLID as a Compass, Not a Destination

It is important to understand that SOLID principles are **heuristics**, not rigid laws. Robert Martin himself has emphasized that they should guide design decisions without being applied dogmatically:

> *"These principles are not a checklist. They are a compass. They point you in the right direction, but they don't tell you exactly where to go."*
> — Robert C. Martin, paraphrased from various talks

**When to be strict about SOLID:**
- Core domain logic in long-lived enterprise systems
- Libraries and frameworks consumed by many teams
- Code that changes frequently or is expected to grow

**When to relax SOLID:**
- Throwaway scripts and prototypes
- Simple CRUD applications with stable requirements
- Performance-critical inner loops where abstraction adds overhead
- Very early stages of a project where the axes of change are not yet clear (premature abstraction is as harmful as no abstraction)

---

## The Four Symptoms of Rotting Software

In his 2000 paper *"Design Principles and Design Patterns,"* Robert Martin identified four symptoms that indicate software design is degrading. SOLID principles are the antidote to these symptoms:

| Symptom | Description | SOLID Antidote |
|---------|-------------|---------------|
| **Rigidity** | The system is hard to change because every change forces many other changes in dependent modules. A single change cascades through the codebase. | **SRP** reduces the blast radius of changes. **DIP** decouples high-level modules from low-level details. |
| **Fragility** | Changes in one part of the system cause unexpected breakages in seemingly unrelated parts. The system is like a house of cards. | **LSP** ensures that subtypes behave correctly. **SRP** keeps unrelated concerns in separate modules so they cannot break each other. |
| **Immobility** | Useful modules are entangled with their context and cannot be extracted for reuse in other systems. The software cannot be decomposed into reusable components. | **DIP** ensures modules depend on abstractions, making them portable. **ISP** keeps interfaces focused and reusable. |
| **Viscosity** | Doing things the "right way" is harder than doing things the "wrong way." Developers take shortcuts because the design makes good practices difficult. | **OCP** provides clear extension points so that the right way to add features (extension) is easier than the wrong way (modification). |

When you observe these symptoms in a codebase, it is a signal that one or more SOLID principles are being violated. The specific symptom often points to the specific principle that needs attention.

---

## Applying SOLID Incrementally

SOLID does not need to be applied all at once. A practical approach for teams adopting SOLID in an existing codebase:

1. **Start with SRP.** Identify the largest, most frequently changed files. Split classes that serve multiple actors. This immediately reduces merge conflicts and improves readability.
2. **Apply DIP at architectural boundaries.** Introduce interfaces between your domain logic and infrastructure (database, HTTP, file system). This makes testing dramatically easier.
3. **Enforce LSP in class hierarchies.** Audit existing inheritance to ensure subtypes are genuinely substitutable. Replace broken hierarchies with composition.
4. **Apply OCP when extending features.** The next time you need to add a variation (new payment type, new export format), refactor to an abstraction instead of adding another `if/else` branch.
5. **Refine with ISP.** As interfaces grow, split fat interfaces into smaller, client-specific ones. This is often a natural consequence of applying SRP and DIP well.

---

## Key Terminology

| Term | Definition |
|------|-----------|
| **Actor** | A stakeholder or group of stakeholders who request changes to a module (Martin's refined SRP definition). |
| **Abstraction** | An interface, abstract class, or function signature that defines a contract without specifying implementation. |
| **Cohesion** | The degree to which elements within a module belong together and serve a single purpose. |
| **Coupling** | The degree to which one module depends on the internal details of another. |
| **Extension** | Adding new behavior to a system, typically through new classes, functions, or modules. |
| **Modification** | Changing existing code within an already-written and tested module. |
| **Substitutability** | The ability to use a subtype anywhere its base type is expected without altering program correctness. |

---

## Sources

1. **Martin, R.C.** (2000). *"Design Principles and Design Patterns."* objectmentor.com. — The original paper consolidating all five principles and identifying the four symptoms of rotting software.
2. **Martin, R.C.** (2002). *Agile Software Development: Principles, Patterns, and Practices.* Prentice Hall. — The definitive reference for SOLID in the context of agile software development.
3. **Martin, R.C.** (2008). *Clean Code: A Handbook of Agile Software Craftsmanship.* Prentice Hall. — Practical guidance on writing clean code, with references to SOLID throughout.
4. **Martin, R.C.** (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design.* Prentice Hall. — Elevates SOLID from class-level to component and architectural-level principles.
5. **Meyer, B.** (1988). *Object-Oriented Software Construction.* Prentice Hall. — Original formulation of the Open/Closed Principle.
6. **Liskov, B. & Wing, J.** (1994). *"A Behavioral Notion of Subtyping."* ACM Transactions on Programming Languages and Systems, 16(6). — Formal treatment of the Liskov Substitution Principle.
7. **Liskov, B.** (1987). *"Data Abstraction and Hierarchy."* Keynote at OOPSLA. — The original articulation of the substitutability concept.
8. **Fowler, M.** *"Refactoring: Improving the Design of Existing Code"* (1999, 2018 2nd ed.). Addison-Wesley. — Provides refactoring techniques that align with SOLID principles.
9. **Boehm, B.W.** (1981). *Software Engineering Economics.* Prentice Hall. — Foundational research on software lifecycle costs.
10. **Glass, R.L.** (2002). *Facts and Fallacies of Software Engineering.* Addison-Wesley. — Empirical data on maintenance costs and software engineering practices.
11. **Wikipedia.** *"SOLID."* https://en.wikipedia.org/wiki/SOLID — Community-maintained overview with links to original sources.
12. **Martin, R.C.** *The Principles of OOD.* http://butunclebob.com/ArticleS.UncleBob.PrinciplesOfOod — Uncle Bob's original articles on each principle.
