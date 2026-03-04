---
name: architect-plan
description: Create an architecture-aware implementation plan. Ensures clean architecture compliance at every phase. Use when user wants to plan a feature, refactor, or multi-step implementation.
---

# Architect Plan

Create an LLM-friendly implementation plan that enforces clean architecture at every phase.

## How This Differs from Regular Planning

This skill adds architecture awareness:
- Each phase specifies which **layers** it touches (domain/application/infrastructure)
- **Dependency direction** is validated in the verification checklist
- **Architecture rules** are referenced in each phase
- A final **compliance check** phase is always included
- Feature scaffolding is used for new features

## Workflow

### Phase 0: Architecture Discovery (ALWAYS FIRST)
Deploy subagents to:
1. Run `architect_check` — get current compliance score and violations
2. Run `architect_get_status` — get project health and recent decisions
3. Search for related architectural decisions: `architect_search`
4. Read relevant rule files for the planned work

### Each Implementation Phase Must Include

1. **What to implement** — Clear scope with file paths
2. **Architectural layer mapping:**
   - Domain: entities, value objects, ports, domain services
   - Application: use cases, DTOs, mappers
   - Infrastructure: controllers, repositories, adapters
3. **Architecture rules** — Cite specific rules from .claude/rules/
4. **Dependency direction check** — Verify no violations introduced
5. **Verification checklist** — Tests + architecture compliance

### Final Phase: Architecture Verification
1. Run `architect_check` — must not decrease compliance score
2. Log any architectural decisions made: `architect_log_decision`
3. Update PROJECT_MAP.md if structure changed
4. Update feature README.md for affected features

## Key Principles
- Domain entities are created FIRST (Phase 1 is always domain layer)
- Use cases orchestrate domain objects (Phase 2)
- Infrastructure implements ports defined in domain (Phase 3)
- Controllers are thin translation layers (Phase 4)
- Tests at every phase boundary
