---
mode: auto
---

## Clean Architecture — Layer Rules

### Layer Definitions & Allowed Dependencies
- DOMAIN (innermost): entities, value objects, aggregate roots, domain events, repository interfaces, domain services
  - Imports: NOTHING external. Zero framework imports. Only other domain code.
- APPLICATION: use cases, DTOs, input/output ports, application services, command/query handlers
  - Imports: domain layer only
- INFRASTRUCTURE (outermost): controllers, repository implementations, API clients, database adapters, framework config, middleware
  - Imports: application and domain layers

### Dependency Rule Enforcement
- If a domain file imports from application/ or infrastructure/ → VIOLATION — refactor immediately
- If an application file imports from infrastructure/ → VIOLATION — create a port interface instead
- When domain needs external data: define a PORT (interface) in domain, implement ADAPTER in infrastructure

### Feature Structure Template
When creating a new feature, always create this structure:
```
src/features/{feature-name}/
├── domain/
│   ├── entities/          # Business objects with behavior
│   ├── value-objects/     # Immutable values (email, money, etc.)
│   ├── ports/             # Interface definitions (repository ports, service ports)
│   ├── events/            # Domain events
│   └── services/          # Domain services (logic spanning multiple entities)
├── application/
│   ├── use-cases/         # One file per business operation
│   ├── dtos/              # Data Transfer Objects (input/output)
│   └── mappers/           # Entity ↔ DTO transformations
├── infrastructure/
│   ├── controllers/       # HTTP/GraphQL/CLI handlers (thin translation only)
│   ├── repositories/      # Database implementations of domain ports
│   ├── adapters/          # External service integrations
│   └── config/            # Feature-specific configuration
├── __tests__/
│   ├── integration/       # Tests crossing boundaries
│   └── e2e/               # End-to-end for this feature
└── README.md              # Module manifest (use docs/templates/MODULE-README-TEMPLATE.md)
```

### Use Case Pattern (Enforced)
Every business operation MUST be a dedicated use case class/function:
- Single execute/handle method
- Receives a command/query DTO as input
- Returns a result DTO as output
- Orchestrates domain objects — contains NO business rules itself
- Controllers call use cases — never domain objects directly

### Cross-Feature Communication
- Features NEVER import directly from each other's internals
- Use shared contracts in src/shared/contracts/
- For async communication: domain events published and consumed via event bus
- For sync communication: shared interfaces with explicit dependency injection
