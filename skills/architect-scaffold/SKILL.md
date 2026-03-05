---
name: architect-scaffold
description: Generate a new feature with clean architecture folder structure (domain/application/infrastructure layers). Use when user wants to "create new feature", "add a module", or "scaffold".
---

# Architect Scaffold

Generate a complete feature structure following clean architecture.

## Workflow

### Step 1: Gather Information
Ask the user (if not provided):
1. Feature name (will be converted to kebab-case)
2. Brief description of what the feature does

### Step 2: Generate Structure
Call `architect_scaffold` MCP tool:
```
architect_scaffold(
  project_path: "/path/to/project",
  feature_name: "user-management",
  description: "User registration, authentication, and profile management",
  with_tests: true
)
```

### Step 3: Generated Structure
The following files and directories are created:

```
src/features/{feature-name}/
├── domain/
│   ├── entities/
│   │   └── {Feature}.ts           # Main entity with business logic
│   ├── value-objects/
│   │   └── .gitkeep
│   ├── ports/
│   │   └── {Feature}Repository.ts # Repository interface (port)
│   ├── events/
│   │   └── .gitkeep
│   └── services/
│       └── .gitkeep
├── application/
│   ├── use-cases/
│   │   └── Create{Feature}UseCase.ts
│   ├── dtos/
│   │   └── {Feature}Dto.ts
│   └── mappers/
│       └── {Feature}Mapper.ts
├── infrastructure/
│   ├── controllers/
│   │   └── {Feature}Controller.ts
│   ├── repositories/
│   │   └── {Feature}RepositoryImpl.ts
│   ├── adapters/
│   │   └── .gitkeep
│   └── config/
│       └── .gitkeep
├── __tests__/
│   ├── integration/
│   │   └── .gitkeep
│   └── e2e/
│       └── .gitkeep
└── README.md                       # Module manifest from template
```

The generated README follows the MODULE-README template format. Use `architect_get_templates(name: "MODULE-README-TEMPLATE")` if customization is needed.

### Step 4: Update Project Documentation
1. Use `architect_get_templates(name: "PROJECT_MAP-TEMPLATE")` to get the project map template
2. Add the new feature to PROJECT_MAP.md using the template's module registry format
3. Log structural change via `architect_log_decision`

### Step 5: Show Next Steps
Tell the user:
1. Define entities in domain/entities/
2. Define repository ports in domain/ports/
3. Create use cases in application/use-cases/
4. Implement repository in infrastructure/repositories/
5. Wire up controller in infrastructure/controllers/
6. Write tests alongside each file
