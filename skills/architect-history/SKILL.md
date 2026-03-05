---
name: architect-history
description: View project architectural history — decisions, structural changes, compliance trends, violation patterns. Use when user asks "what decisions did we make", "project history", "show ADRs", or "compliance trend".
---

# Architect History

View the architectural history of a project.

## Workflow

### Step 1: Get Project Status
Call `architect_get_status` with the current project path to get overview.

### Step 2: Display History
Based on what the user wants, use the 3-layer search workflow:

#### Recent Decisions
```
architect_search(project_path: "...", type: "decisions", limit: 10)
```
Then display as a timeline with status badges.

#### Compliance Trend
```
architect_get_status(project_path: "...")
```
Show the compliance score history as an ASCII chart.

#### Violation History
```
architect_search(project_path: "...", type: "violations", limit: 20)
```
Show resolved vs open violations over time.

### Step 3: Deep Dive (if requested)
If user asks about a specific decision or event:
```
architect_get_details(ids: [123, 456], type: "decisions")
```

#### Available Templates
Use `architect_get_templates()` to list all architecture document templates.
Use `architect_get_templates(name)` to retrieve a specific template for creating consistent documentation:
- ADR, MODULE-README, PROJECT_MAP, CHANGELOG, DEPENDENCY_RULES
- UBIQUITOUS-LANGUAGE, PRIVACY-IMPACT, API-DESIGN, EVENT-SCHEMA

## Display Format

### Decisions Timeline
```
2025-03-04 [accepted] Use PostgreSQL for primary database
2025-03-03 [accepted] Adopt JWT for API authentication
2025-03-01 [deprecated] Use session-based auth (superseded by JWT decision)
```

### Compliance Trend (ASCII)
```
Score  100 |         ●
        90 |     ●       ●
        80 | ●       ●
        70 |
           +--+--+--+--+--
             S1  S2  S3  S4  S5
```

### Most Violated Rules
```
| Rule | Violations | Resolved | Ignored |
|------|-----------|----------|---------|
| 01-architecture | 15 | 12 | 3 |
| 02-security | 8 | 8 | 0 |
| 15-code-style | 22 | 18 | 4 |
```
