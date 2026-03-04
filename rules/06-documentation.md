## Documentation Standards

### Code Documentation
- Every exported function/method: doc comment with @param, @returns, @throws, @example
- Complexity annotations for O(n²) or worse algorithms
- Inline comments explain WHY (business reason, workaround), never WHAT (what code does)
- No commented-out code — use version control instead
- No TODO without issue/ticket reference: // TODO(JIRA-123): description

### Architecture Decision Records (ADRs)
Create ADR in docs/decisions/ when:
- Choosing a technology or library
- Adopting an architectural pattern
- Adding a significant dependency
- Making a cross-cutting design decision
- Changing an existing architectural pattern
Format: MADR (Markdown ADR) with numbered files: 0001-title.md
Template: docs/templates/ADR-TEMPLATE.md

### Module README.md (Required for every feature)
Every src/features/{name}/ MUST contain README.md with:
- Purpose: what business problem this feature solves
- Public API: exported functions/classes and their contracts
- Dependencies: what this module depends on (internal and external)
- Forbidden dependencies: what this module must NEVER import
- Data flow: how data moves through the module
- Testing: how to run tests, key test scenarios
Template: docs/templates/MODULE-README-TEMPLATE.md

### PROJECT_MAP.md (Living Document — Root Level)
Must be updated on EVERY structural change:
- Project overview (1-2 sentences)
- Architecture pattern name
- Directory structure tree (only 2-3 levels deep)
- Module table: Name | Purpose | Dependencies | Status
- Technology stack with versions
- API surface overview
- Environment requirements
Template: docs/templates/PROJECT_MAP-TEMPLATE.md

### CHANGELOG.md
- Follow Keep a Changelog format (keepachangelog.com)
- Categories: Added, Changed, Deprecated, Removed, Fixed, Security
- Every user-facing change gets an entry
- Include date and version number
- Link to relevant issues/PRs

### Domain Glossary (docs/ubiquitous-language.md)
- Define every domain-specific term used in code
- NEVER rename domain concepts without updating glossary and getting approval
- Map business terms to code names when they differ
- Include example usage for ambiguous terms
