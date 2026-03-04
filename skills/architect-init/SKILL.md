---
name: architect-init
description: Initialize clean architecture for a new or existing project. Analyzes current structure, proposes restructuring, installs rules and templates. Use when user says "set up architecture", "init project", or "restructure code".
---

# Architect Init

Initialize a project with enterprise-grade clean architecture enforcement.

## Workflow

### Step 1: Analyze Current Project
Deploy an Explore subagent to:
1. Scan the project directory structure
2. Detect tech stack (package.json, requirements.txt, go.mod, etc.)
3. Identify existing patterns and structure
4. Count files, features, and current organization

### Step 2: Determine Project State
- **Empty project**: Ask about tech stack, then generate scaffold
- **Existing project with no structure**: Propose restructuring plan
- **Already has src/features/**: Update rules and templates only

### Step 3: Install Architecture Rules
Use the `architect_check` MCP tool to get baseline compliance, then:

1. Copy rules from the plugin to `.claude/rules/`:
   - All 16 rule files (architecture, security, testing, API, database, etc.)
2. Copy templates to `docs/templates/`:
   - ADR, MODULE-README, PROJECT_MAP, CHANGELOG, DEPENDENCY_RULES, UBIQUITOUS-LANGUAGE
3. Create initial documentation:
   - `PROJECT_MAP.md` from template (filled with detected tech stack)
   - `CHANGELOG.md` from template
   - `docs/ubiquitous-language.md` from template
   - `docs/DEPENDENCY_RULES.md` from template
   - `docs/decisions/` directory for ADRs
4. Create a `CLAUDE.md` at project root with the constitution

### Step 4: Register Project
Use `architect_log_decision` to record:
- Decision: "Initialize clean architecture for {project-name}"
- Context: Current state of the project
- Tags: ["architecture", "initialization"]

### Step 5: Baseline Compliance
Run `architect_check` to get initial compliance score and report to user.

## For Existing Projects
When restructuring an existing project:
1. **NEVER** move or rename files without explicit user approval
2. Present a restructuring plan first
3. Show what will move where
4. Execute only after approval
5. Update all imports after moving files

## Output
After completion, display:
- Installed rules count
- Initial compliance score
- Any critical violations found
- Next steps for the user
