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

### Step 3: Load Architecture Rules
Use the `architect_get_rules(project_path)` MCP tool to retrieve all active architecture rules.
- Rules are served dynamically via the Worker API — they are NOT copied to the user project
- 26 automatic rules are always active
- 5 manual rules can be enabled per project based on its architecture

Use `architect_get_templates()` to list available document templates (ADR, MODULE-README, PROJECT_MAP, CHANGELOG, DEPENDENCY_RULES, UBIQUITOUS-LANGUAGE, PRIVACY-IMPACT, API-DESIGN, EVENT-SCHEMA), then retrieve specific templates with `architect_get_templates(name)` to create initial documentation.

### Step 3.5: Configure Manual Rules
Use `architect_configure_rules(project_path, list_available: true)` to check if any manual rules should be enabled:
- **21-microservices**: Enable for distributed/microservice architectures
- **23-internationalization**: Enable for multi-locale applications
- **24-event-driven**: Enable for CQRS/event sourcing architectures
- **25-infrastructure-as-code**: Enable if project has Terraform/K8s/Docker
- **27-state-management**: Enable for frontend apps with complex state

Enable relevant rules: `architect_configure_rules(project_path, enable: ["21-microservices"])`

### Step 4: Create Initial Documentation
1. Create initial documentation:
   - `PROJECT_MAP.md` from template (filled with detected tech stack)
   - `CHANGELOG.md` from template
   - `docs/ubiquitous-language.md` from template
   - `docs/DEPENDENCY_RULES.md` from template
   - `docs/decisions/` directory for ADRs
2. Create a `CLAUDE.md` at project root using `architect_get_rules(category: "constitution")`

### Step 4.5: Register Project
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
- Active rules count (31 total: 26 automatic + 5 manual if enabled)
- Initial compliance score
- Any critical violations found
- Next steps for the user
