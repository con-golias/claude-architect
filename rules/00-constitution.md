---
mode: auto
---

# Architecture Rules — Project Constitution

@docs/DEPENDENCY_RULES.md
@docs/ubiquitous-language.md

## FIRST RUN PROTOCOL
- If no PROJECT_MAP.md exists, ASK: "Shall I analyze and restructure this project for professional clean architecture?"
- If yes: scan entire codebase → create restructuring plan → present for approval → execute
- Generate PROJECT_MAP.md, docs/ structure, and feature README.md files on first run
- If project is empty, ask about tech stack and generate scaffold with correct architecture

## Architecture: Clean Architecture + Feature-Based Organization
- Dependencies point INWARD only: infrastructure → application → domain
- Domain layer has ZERO framework/infrastructure imports
- Every business operation is a dedicated use case — controllers do thin translation ONLY
- All external dependencies injected via constructor/factory — never instantiated directly
- Features are vertical slices: each feature owns domain/, application/, infrastructure/
- Cross-feature communication through explicit contracts only — never direct imports between features

## SOLID Principles (Enforced)
- Single Responsibility: files under 200 lines, one clear purpose per file
- Open/Closed: strategy/plugin patterns over switch/if-else chains (apply Rule of Three)
- Liskov Substitution: subtypes must fully honor parent contracts
- Interface Segregation: small focused interfaces, never god-interfaces
- Dependency Inversion: depend on abstractions, never on concrete implementations

## File & Folder Organization
- Feature-based structure: src/features/{feature-name}/{domain,application,infrastructure}/
- Shared code in src/shared/ — only when used by 3+ features
- Co-locate unit tests with source (.test.ts/.test.py/.spec.ts suffix)
- Name files after primary export (user.service.ts, not service.ts)
- kebab-case for folders, PascalCase for classes/components, camelCase for functions/variables
- Maximum 4 levels of nesting from src/
- No barrel/index re-export files in application code
- Config files at project root, source code inside src/

## On EVERY Change (Mandatory Checklist)
- Update docstrings/JSDoc for all modified exported functions
- Update feature README.md if public API or dependencies change
- Update PROJECT_MAP.md if structure changes (new modules, moved files, new dependencies)
- Create ADR in docs/decisions/ for any architectural decision
- Add CHANGELOG entry for user-facing changes
- Verify no circular dependencies introduced
- Run existing tests — fix any regressions before completing
- Commit using Conventional Commits format: type(scope): description

## Scope Discipline (Critical)
- ONLY modify code directly related to the current task
- Do NOT refactor unrelated code unless explicitly asked
- Do NOT rename domain concepts without explicit approval
- Match existing patterns — examine 2-3 similar files before creating new ones
- No premature abstraction — wait for Rule of Three (3+ similar implementations)
- When uncertain about an architectural decision, ASK before implementing
- Prefer boring, proven solutions over clever, novel approaches

## Quality Gates
- Every exported function: doc comment with params, return type, throws, side effects
- Comments explain WHY, never WHAT — refactor unclear code instead
- No commented-out code, no TODO without ticket/issue reference
- All error handling must be explicit — never swallow exceptions silently
- Validate inputs at function entry — fail fast with specific error types
- Structured logging (JSON) with correlation IDs at all system boundaries

## Security (Non-Negotiable)
- NEVER hardcode secrets — environment variables or secrets manager only
- NEVER construct SQL via string concatenation — parameterized queries only
- Validate ALL input server-side with allowlist validation
- Authenticate and authorize server-side for every request
- Validate required config/secrets at startup — fail fast if missing

## Performance Baseline
- NEVER execute database queries inside loops — use batch/eager loading
- ALWAYS paginate list endpoints — never return unbounded results
- Set explicit timeouts on ALL external calls
- Use connection pooling for all database/service connections
