# Dependency Rules

## Layer Dependencies (Inward Only)
```
infrastructure → application → domain
     ↓                ↓
  (can import)    (can import)
  application      domain
  domain           nothing external
```

## Allowed Imports by Layer

### Domain Layer (src/features/*/domain/)
✅ Other domain code within same feature
✅ Shared types (src/shared/types/)
❌ Application layer
❌ Infrastructure layer
❌ Any framework/library (express, fastify, django, etc.)
❌ Any database library (prisma, typeorm, sqlalchemy, etc.)
❌ Other features' code

### Application Layer (src/features/*/application/)
✅ Domain layer of same feature
✅ Shared types and utilities
✅ Port interfaces from domain layer
❌ Infrastructure layer
❌ Framework-specific code
❌ Direct database access
❌ Other features' internal code

### Infrastructure Layer (src/features/*/infrastructure/)
✅ Application layer of same feature
✅ Domain layer of same feature
✅ Framework libraries
✅ Database libraries
✅ External service SDKs
❌ Other features' infrastructure directly

### Shared (src/shared/)
✅ External libraries
✅ Standard library
❌ Any feature code (features depend on shared, never reverse)

## Cross-Feature Communication
- Via shared contracts in src/shared/contracts/
- Via event bus (domain events)
- Via dependency injection of port interfaces
- NEVER via direct import of another feature's internals
