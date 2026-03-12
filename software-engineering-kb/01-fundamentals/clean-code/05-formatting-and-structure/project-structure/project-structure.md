# Project Structure

> **Domain:** Fundamentals > Clean Code > Formatting and Structure
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Project structure is the top-level organization of a software project — its directory hierarchy, module boundaries, and architectural layout. Robert C. Martin coined the term **"Screaming Architecture"**:

> "Your architecture should scream the intent of the system. When you look at the top-level directory structure, it should tell you what the system IS, not what framework it uses."

A healthcare app's folder structure should scream "Patients, Appointments, Prescriptions" — not "Controllers, Services, Repositories."

## Why It Matters

Project structure is the first thing a developer sees. It determines navigation speed, enforces architectural boundaries, enables team independence, and affects build/deployment pipelines.

## How It Works

### Common Architectural Patterns

**Clean Architecture (Uncle Bob):**
```
src/
├── domain/           # Entities, value objects, domain services
│   ├── entities/
│   └── interfaces/   # Ports (repository interfaces, etc.)
├── application/      # Use cases, DTOs, application services
│   └── use-cases/
├── infrastructure/   # Frameworks, DB, external APIs
│   ├── database/
│   ├── http/
│   └── messaging/
└── presentation/     # Controllers, views, API endpoints
    ├── rest/
    └── graphql/
```

**Vertical Slice Architecture:**
```
src/
├── features/
│   ├── create-order/
│   │   ├── create-order.handler.ts
│   │   ├── create-order.command.ts
│   │   ├── create-order.validator.ts
│   │   └── create-order.test.ts
│   ├── get-order/
│   │   ├── get-order.handler.ts
│   │   └── get-order.query.ts
│   └── cancel-order/
│       └── ...
└── shared/
    ├── database/
    └── middleware/
```

**Framework-Specific Conventions:**

- **Next.js (App Router):** `app/` directory with file-based routing
- **Django:** `project/app/models.py`, `views.py`, `urls.py`
- **Spring Boot:** `com.example.project.domain`, `.application`, `.infrastructure`
- **ASP.NET:** Feature folders or Clean Architecture layers

### Monorepo vs. Multi-repo

| Aspect | Monorepo | Multi-repo |
|--------|----------|------------|
| Code sharing | Easy | Requires packages/publishing |
| Refactoring | Atomic across projects | Coordinated releases needed |
| CI/CD | Complex (affected builds) | Simple per-repo |
| Used by | Google, Meta, Microsoft | Many startups, microservices |

Tools: Nx, Turborepo, Lerna (monorepo); standard Git repos (multi-repo).

## Best Practices

1. **Structure by domain, not by technical role.** Feature-based > layer-based for most projects.
2. **Make architecture visible** in the folder structure (Screaming Architecture).
3. **Start simple, evolve as needed.** A simple monolith with clear boundaries can easily split later.
4. **Co-locate tests with source code.** `user.service.ts` next to `user.service.test.ts`.
5. **Enforce boundaries.** Use ESLint import rules, ArchUnit (Java), or NX module boundaries to prevent unauthorized cross-module imports.

## Anti-patterns / Common Mistakes

- **Framework-centric structure:** Folders named after technical patterns instead of business domains.
- **Premature microservices:** Splitting into services before understanding domain boundaries.
- **Flat structure at scale:** All files in one directory works for 10 files, not 1000.

## Sources

- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall.
- [Vertical Slice vs Clean Architecture (nadirbad.dev)](https://nadirbad.dev/vertical-slice-vs-clean-architecture)
- [Clean Architecture Is Not About Folders (Medium)](https://medium.com/@vinodjagwani/clean-architecture-is-not-about-folders-feature-based-design-works-better-d349e920dcf1)
- [Software Engineering at Google (Titus Winters)](https://abseil.io/resources/swe-book/html/ch08.html)
