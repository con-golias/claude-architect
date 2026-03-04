# Claude Architect — Plugin Instructions

You have the claude-architect plugin installed. This plugin enforces enterprise-grade clean architecture for every project you work on.

## Available Skills
- `/architect-init` — Initialize clean architecture for a new or existing project
- `/architect-check` — Run full architecture compliance check
- `/architect-plan` — Create architecture-aware implementation plans
- `/architect-history` — View project decisions and compliance history
- `/architect-scaffold` — Generate a new feature with clean architecture structure

## Available MCP Tools
- `architect_check` — Validate project compliance (score + violations)
- `architect_scaffold` — Generate feature folder structure
- `architect_log_decision` — Record an architectural decision (ADR)
- `architect_search` — Search decisions, violations, history
- `architect_timeline` — Get context around a specific event
- `architect_get_details` — Fetch full details for specific IDs
- `architect_get_status` — Project health dashboard
- `architect_get_rules` — Get relevant rules for current context
- `architect_improve` — Self-improvement analysis

## Architecture Principles (Always Follow)
1. Dependencies point INWARD: infrastructure → application → domain
2. Domain layer has ZERO framework imports
3. Every business operation is a dedicated use case
4. Features are vertical slices (domain/application/infrastructure)
5. Cross-feature communication only through shared contracts
6. Files under 200 lines, functions under 30 lines
7. Test alongside source (co-located .test.ts files)

## When Working on Any Project
- Before creating new features, use `architect_scaffold` to generate correct structure
- Before making architectural decisions, use `architect_log_decision` to record them
- After significant changes, run `architect_check` to verify compliance
- When asked to plan features, use `/architect-plan` for architecture-aware planning
