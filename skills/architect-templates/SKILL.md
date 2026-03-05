---
name: architect-templates
description: List and retrieve architecture document templates. Use when user asks "what templates are available", "get ADR template", "create architecture document", or "show me the project map template".
---

# Architect Templates

Retrieve and use architecture document templates.

## Available Templates

| Template | Purpose |
|----------|---------|
| ADR-TEMPLATE | Architecture Decision Record |
| CHANGELOG-TEMPLATE | Project changelog |
| DEPENDENCY_RULES-TEMPLATE | Dependency direction rules |
| MODULE-README-TEMPLATE | Feature/module README |
| PROJECT_MAP-TEMPLATE | Project structure map |
| UBIQUITOUS-LANGUAGE-TEMPLATE | Domain language glossary |
| PRIVACY-IMPACT-TEMPLATE | GDPR/privacy impact assessment |
| API-DESIGN-TEMPLATE | API design specification |
| EVENT-SCHEMA-TEMPLATE | Event-driven schema definition |

## Workflow

### Step 1: List Available Templates
```
architect_get_templates()
```

### Step 2: Get Specific Template
```
architect_get_templates(name: "ADR-TEMPLATE")
```

### Step 3: Apply Template
1. Retrieve the template content
2. Replace placeholder markers with project-specific values
3. Create the file in the appropriate location:
   - ADR → `docs/decisions/NNNN-title.md`
   - PROJECT_MAP → `PROJECT_MAP.md` (project root)
   - CHANGELOG → `CHANGELOG.md` (project root)
   - MODULE-README → `src/features/{feature}/README.md`
   - DEPENDENCY_RULES → `docs/DEPENDENCY_RULES.md`
   - UBIQUITOUS-LANGUAGE → `docs/ubiquitous-language.md`
   - PRIVACY-IMPACT → `docs/privacy-impact.md`
   - API-DESIGN → `docs/api/{api-name}.md`
   - EVENT-SCHEMA → `docs/events/{event-name}.md`

## Output
After creating a document from a template:
1. Show the created file path
2. Highlight any TODO markers that need filling in
3. Offer to log an architectural decision about the document creation
