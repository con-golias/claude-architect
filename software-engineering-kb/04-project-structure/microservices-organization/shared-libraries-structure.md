# Shared Libraries for Microservices

> **AI Plugin Directive:** When organizing shared code across microservices, ALWAYS use this guide. Apply proper package boundaries, versioning strategies, and dependency management for internal libraries. This guide covers how to structure, publish, and consume shared code without creating coupling.

**Core Rule: Shared libraries MUST be small, focused, and independently versioned. They provide UTILITIES (logging, auth, config), NOT business logic. NEVER put domain-specific code in shared libraries -- that creates a distributed monolith. Each shared library is a separate package with its own version and changelog.**

---

## 1. Shared Library Categories

```
What to share:                              What NOT to share:

  Cross-cutting concerns:                     Domain logic:
   - Structured logging                        - Order processing rules
   - Authentication middleware                  - User validation
   - Error handling                            - Payment calculations
   - Configuration loading
   - Health check endpoints                    Database models:
                                               - User entity
  Infrastructure abstractions:                 - Order entity
   - Message broker client
   - HTTP client with retry                    Service-specific DTOs:
   - Database connection helpers               - CreateOrderRequest
   - Cache client wrapper                      - UserProfileResponse

  Contract types:                              Business rules that change
   - Event schemas                             per service
   - Shared API types
   - Error codes

LITMUS TEST:
  "Would ALL services need this?" --> Shared library
  "Would only 2-3 services need this?" --> Consider sharing, but think twice
  "Would only 1 service need this?" --> NEVER share, keep in service
```

---

## 2. Library Structure (Monorepo)

```
packages/
├── @platform/logger/
│   ├── src/
│   │   ├── index.ts
│   │   ├── logger.ts                      # Structured logger (pino/winston)
│   │   ├── middleware.ts                   # Express/Fastify request logging
│   │   ├── redact.ts                      # PII redaction
│   │   ├── formatters.ts                  # Log formatters (JSON, text)
│   │   └── types.ts
│   ├── tests/
│   │   ├── logger.test.ts
│   │   ├── redact.test.ts
│   │   └── middleware.test.ts
│   ├── package.json                       # version: "1.2.0"
│   ├── tsup.config.ts
│   ├── CHANGELOG.md
│   └── README.md
│
├── @platform/auth/
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware.ts                   # JWT/OAuth verification middleware
│   │   ├── token.ts                       # Token parsing and validation
│   │   ├── types.ts                       # AuthUser, TokenPayload
│   │   └── errors.ts                      # AuthenticationError, ForbiddenError
│   ├── tests/
│   ├── package.json
│   └── CHANGELOG.md
│
├── @platform/events/
│   ├── src/
│   │   ├── index.ts
│   │   ├── publisher.ts                   # Event publishing abstraction
│   │   ├── consumer.ts                    # Event consuming abstraction
│   │   ├── schemas/                       # Event type definitions (Zod)
│   │   │   ├── user-events.ts
│   │   │   ├── order-events.ts
│   │   │   ├── payment-events.ts
│   │   │   └── index.ts
│   │   ├── serialization.ts              # Event serialization (JSON, Avro, Protobuf)
│   │   ├── dead-letter.ts                # Dead letter queue handling
│   │   └── types.ts                      # BaseEvent, EventMetadata
│   ├── tests/
│   ├── package.json
│   └── CHANGELOG.md
│
├── @platform/http-client/
│   ├── src/
│   │   ├── index.ts
│   │   ├── client.ts                      # Configured HTTP client (axios/got/undici)
│   │   ├── retry.ts                       # Retry with exponential backoff
│   │   ├── circuit-breaker.ts             # Circuit breaker pattern
│   │   ├── timeout.ts                     # Request timeout handling
│   │   ├── interceptors.ts               # Request/response interceptors
│   │   └── types.ts
│   ├── package.json
│   └── CHANGELOG.md
│
├── @platform/config/
│   ├── src/
│   │   ├── index.ts
│   │   ├── loader.ts                      # Load from env, files, secrets manager
│   │   ├── validator.ts                   # Zod schema validation
│   │   ├── secrets.ts                     # AWS Secrets Manager / Vault integration
│   │   └── types.ts
│   ├── package.json
│   └── CHANGELOG.md
│
├── @platform/health/
│   ├── src/
│   │   ├── index.ts
│   │   ├── health-check.ts               # /health and /ready endpoints
│   │   ├── checks/
│   │   │   ├── database.ts               # PostgreSQL / MySQL health check
│   │   │   ├── redis.ts                  # Redis health check
│   │   │   ├── rabbitmq.ts              # RabbitMQ health check
│   │   │   ├── kafka.ts                 # Kafka health check
│   │   │   └── custom.ts               # Custom health check interface
│   │   └── types.ts
│   ├── package.json
│   └── CHANGELOG.md
│
├── @platform/errors/
│   ├── src/
│   │   ├── index.ts
│   │   ├── base-error.ts                  # AppError base class
│   │   ├── http-errors.ts                 # NotFound, BadRequest, Unauthorized, etc.
│   │   ├── handler.ts                     # Global error handler middleware
│   │   ├── serializer.ts                 # Error -> JSON response
│   │   └── types.ts
│   ├── package.json
│   └── CHANGELOG.md
│
├── @platform/tracing/
│   ├── src/
│   │   ├── index.ts
│   │   ├── tracer.ts                      # OpenTelemetry tracer setup
│   │   ├── middleware.ts                  # HTTP request tracing middleware
│   │   ├── propagation.ts                # Context propagation helpers
│   │   └── types.ts
│   ├── package.json
│   └── CHANGELOG.md
│
├── @platform/metrics/
│   ├── src/
│   │   ├── index.ts
│   │   ├── registry.ts                    # Prometheus metrics registry
│   │   ├── middleware.ts                  # HTTP metrics middleware
│   │   ├── business-metrics.ts            # Custom business metric helpers
│   │   └── types.ts
│   ├── package.json
│   └── CHANGELOG.md
│
└── @platform/testing/
    ├── src/
    │   ├── index.ts
    │   ├── factories.ts                   # Test data factories
    │   ├── mocks/
    │   │   ├── logger.ts                  # Mock logger
    │   │   ├── event-bus.ts              # Mock event bus
    │   │   ├── http-client.ts            # Mock HTTP client
    │   │   └── database.ts              # Mock database
    │   ├── helpers.ts                     # Test utilities
    │   └── fixtures.ts                   # Common test fixtures
    ├── package.json
    └── CHANGELOG.md
```

---

## 3. Library Design Rules

```
SIZE: Each library should be SMALL
  5-15 source files
  Single responsibility
  Installs in < 1 second
  50+ files = too big, split it

DEPENDENCIES: MINIMIZE
  Zero or very few external deps
  Use peerDependencies for framework-specific libs
  Library with 20+ dependencies = WRONG

API SURFACE: SMALL
  Export only what services need
  Stable public API
  Internal helpers are private (not exported)

VERSIONING: SEMANTIC
  Independent version per library
  Changesets for tracking changes
  Breaking changes = major version bump
  Additive changes only where possible

BACKWARD COMPATIBILITY:
  Adding a new optional parameter = OK (patch/minor)
  Changing a required parameter = BREAKING (major)
  Adding a new export = OK (minor)
  Removing an export = BREAKING (major)
  Changing return type = BREAKING (major)
  Adding optional field to return type = OK (minor)

DEPRECATION STRATEGY:
  1. Add @deprecated JSDoc tag + console.warn
  2. Document migration path in CHANGELOG
  3. Keep deprecated API for >= 1 major version
  4. Remove in next major version
  5. Never surprise consumers with removals
```

---

## 4. Proto/Contract Sharing

```
PROTOBUF SHARING STRATEGY:

Option A: Contracts in monorepo (RECOMMENDED for monorepo)
platform/
├── contracts/
│   └── proto/
│       ├── buf.yaml
│       ├── buf.gen.yaml
│       ├── user/v1/user.proto
│       └── order/v1/order.proto
├── packages/
│   └── @platform/proto-types/     # Generated TS types
│       ├── src/
│       │   └── generated/         # buf generate output
│       └── package.json
└── apps/
    └── user-service/
        └── package.json           # depends on @platform/proto-types

Option B: Separate contract repo (RECOMMENDED for polyrepo)
github.com/myorg/
├── api-contracts/                 # Standalone repo
│   ├── proto/
│   │   ├── buf.yaml
│   │   ├── user/v1/user.proto
│   │   └── order/v1/order.proto
│   ├── openapi/
│   │   └── user-service/v1/openapi.yaml
│   └── asyncapi/
│       └── user-events.yaml
├── user-service/
│   └── package.json               # depends on @myorg/api-contracts
└── order-service/

PROTO VERSIONING:
  proto/user/v1/user.proto          # v1 API
  proto/user/v2/user.proto          # v2 API (breaking changes)

  Within a version:
  - Adding fields = OK (wire-compatible)
  - Removing fields = NEVER (mark as reserved)
  - Renaming fields = NEVER (wire uses field numbers)
  - Changing field types = NEVER

BUF CONFIGURATION:
```

```yaml
# buf.yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - DEFAULT
  except:
    - PACKAGE_VERSION_SUFFIX
breaking:
  use:
    - FILE
```

```yaml
# buf.gen.yaml
version: v2
plugins:
  - remote: buf.build/connectrpc/es
    out: ../packages/proto-types/src/generated
    opt:
      - target=ts
  - remote: buf.build/protocolbuffers/python
    out: ../generated/python
```

```
BUF CLI COMMANDS:
  buf lint                          # Lint proto files
  buf breaking --against ".git#branch=main"  # Check backward compat
  buf generate                      # Generate code from protos
  buf push                          # Push to BSR (Buf Schema Registry)
  buf dep update                    # Update dependencies
```

---

## 5. Schema Registry

```
SCHEMA REGISTRY PATTERNS:

Purpose: Central store for event schemas with version compatibility enforcement.

Option A: Confluent Schema Registry (Kafka ecosystems)
  - Avro, Protobuf, JSON Schema support
  - Compatibility modes: BACKWARD, FORWARD, FULL, NONE
  - REST API for schema management
  - Integrated with Kafka producers/consumers

Option B: Buf Schema Registry (BSR) (Protobuf)
  - Hosted registry for .proto files
  - Breaking change detection
  - Code generation as a service
  - Dependency management for proto packages

Option C: Custom schema validation (Events library)
  - Zod schemas in @platform/events package
  - Validated at publish and consume time
  - Versioned alongside code

COMPATIBILITY MODES (Confluent):
  BACKWARD:  New schema can read old data (add optional fields, remove with default)
  FORWARD:   Old schema can read new data (add with default, remove optional fields)
  FULL:      Both backward and forward compatible
  NONE:      No compatibility checking

RECOMMENDATION:
  Kafka + Avro  --> Confluent Schema Registry
  gRPC + Proto  --> Buf Schema Registry (BSR)
  REST + JSON   --> Zod schemas in shared package
  Small team    --> Zod schemas (simplest)
```

---

## 6. Shared DTOs and API Client Generation

```
SHARED DTO PATTERN:

ANTI-PATTERN: Shared DTO package with service-specific types
  @platform/shared-types/
  ├── CreateOrderRequest.ts      # ORDER SERVICE SPECIFIC
  ├── UserProfileResponse.ts     # USER SERVICE SPECIFIC
  └── PaymentIntent.ts           # PAYMENT SERVICE SPECIFIC

  Problem: Every service depends on every other service's types.
  This IS a distributed monolith.

CORRECT PATTERN: Contract-first with generated clients

1. Define contract (OpenAPI/gRPC)
2. Generate typed client per service
3. Each consuming service gets a typed client

Example workflow:
  contracts/openapi/user-service/v1/openapi.yaml
    |
    v  (code generation)
  packages/@platform/user-service-client/
  ├── src/
  │   ├── client.ts             # Generated HTTP client
  │   ├── types.ts              # Generated request/response types
  │   └── index.ts              # Re-exports
  └── package.json

Services consume generated clients:
  // order-service/src/clients/user.client.ts
  import { UserServiceClient } from "@platform/user-service-client";

GENERATION TOOLS:
  OpenAPI --> openapi-typescript (types) + openapi-fetch (client)
  gRPC   --> buf generate (TypeScript, Python, Go clients)
  GraphQL --> graphql-codegen
  tRPC   --> Types shared via TypeScript (no generation needed)

WHAT TO SHARE vs GENERATE:

Share (in @platform packages):
  - Cross-cutting: logging, auth, config, errors
  - Event schemas: user.created, order.placed
  - Common types: Pagination, ErrorResponse, Money

Generate (from contracts):
  - Service-specific clients: UserServiceClient
  - Service-specific DTOs: CreateUserRequest
  - Service-specific responses: UserListResponse
```

---

## 7. Version Compatibility Matrix

```
VERSION COMPATIBILITY TRACKING:

Track which versions of shared libraries each service uses.

COMPATIBILITY MATRIX:

Library              | user-svc | order-svc | payment-svc | notification-svc
---------------------|----------|-----------|-------------|------------------
@platform/logger     | 1.3.0    | 1.3.0     | 1.2.1       | 1.3.0
@platform/auth       | 2.1.0    | 2.1.0     | 2.0.0       | 2.1.0
@platform/events     | 1.5.0    | 1.5.0     | 1.5.0       | 1.4.0
@platform/errors     | 1.0.0    | 1.0.0     | 1.0.0       | 1.0.0
@platform/config     | 1.1.0    | 1.1.0     | 1.0.0       | 1.1.0
@platform/health     | 1.0.0    | 1.0.0     | 1.0.0       | 1.0.0

RULES:
  - All services MUST be within 1 major version of each library
  - All services SHOULD be within 2 minor versions
  - Critical security patches: ALL services update within 1 week
  - Use Renovate/Dependabot for automated PRs

AUTOMATION:
  # renovate.json (in each service repo)
  {
    "extends": ["config:base"],
    "packageRules": [
      {
        "matchPackagePatterns": ["@platform/*"],
        "groupName": "platform packages",
        "automerge": true,
        "automergeType": "pr",
        "schedule": ["every weekday"],
        "rangeStrategy": "bump"
      }
    ]
  }

  # For monorepo with workspace protocol:
  {
    "packageRules": [
      {
        "matchPackagePatterns": ["@platform/*"],
        "matchDepTypes": ["dependencies"],
        "enabled": false
      }
    ]
  }
```

---

## 8. Backward Compatibility Rules

```
BACKWARD COMPATIBILITY CONTRACT:

SAFE CHANGES (patch/minor):
  + Add new optional parameter to function
  + Add new exported function/class
  + Add new optional field to return type
  + Add new event type to events package
  + Widen parameter type (string -> string | number)
  + Add new enum value (if consumers use switch with default)

BREAKING CHANGES (major version required):
  - Remove exported function/class
  - Remove required parameter
  - Change parameter type (narrow: string | number -> string)
  - Change return type
  - Remove field from return type
  - Rename exported symbol
  - Change default behavior
  - Remove enum value

DEPRECATION TIMELINE:
  v1.5.0: Add new API, deprecate old API
           @deprecated JSDoc + runtime warning
  v1.6.0-v1.x.x: Both APIs available
  v2.0.0: Remove deprecated API

MIGRATION GUIDE TEMPLATE:
  # Migrating from @platform/auth v1 to v2

  ## Breaking changes
  1. `verifyToken()` now returns `Promise<AuthResult>` instead of `Promise<User>`
  2. `AuthMiddleware` options renamed: `secret` -> `signingKey`

  ## Migration steps
  1. Update import: ...
  2. Change usage: ...
  3. Test: ...

  ## Timeline
  - v2.0.0 released: 2024-06-01
  - v1.x support ends: 2024-12-01
```

---

## 9. Diamond Dependency Problem

```
DIAMOND DEPENDENCY PROBLEM:

               @platform/errors@1.0
               /                    \
    @platform/auth@2.0        @platform/http-client@1.0
               \                    /
              user-service

If @platform/auth depends on @platform/errors@1.x
AND @platform/http-client depends on @platform/errors@2.x
THEN user-service has a diamond dependency conflict.

PREVENTION:
1. Minimize inter-library dependencies
   Libraries should depend on as few other libraries as possible.
   Prefer zero deps between platform packages.

2. Use peer dependencies for shared foundation
   // @platform/auth/package.json
   {
     "peerDependencies": {
       "@platform/errors": "^1.0.0"
     }
   }
   Consumer (service) installs the concrete version.

3. Flat dependency structure
   BAD: auth -> errors -> types -> utils (4 levels)
   GOOD: auth, errors, types, utils (all independent)
   MAX: 1-2 levels of library dependencies

4. Version ranges (not pins)
   "@platform/errors": "^1.0.0"   // Accept any 1.x
   NOT: "@platform/errors": "1.0.0" // Exact pin

5. Monorepo workspace protocol
   In monorepo, workspace:* resolves at build time.
   No diamond problem because there's only ONE copy.

DETECTING DIAMOND DEPS:
  npm ls @platform/errors       # Show dependency tree
  pnpm why @platform/errors     # Show why package is installed
  npm explain @platform/errors  # Explain resolution
```

---

## 10. Event Schema Sharing

```typescript
// @platform/events/src/schemas/user-events.ts

import { z } from "zod";

// Base event envelope (shared across all events)
const BaseEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.string(),
  metadata: z.object({
    correlationId: z.string().uuid(),
    causationId: z.string().uuid().optional(),
    source: z.string(),
    userId: z.string().optional(),
  }),
});

// User events
export const UserCreatedEventV1 = BaseEventSchema.extend({
  type: z.literal("user.created"),
  version: z.literal("1.0"),
  data: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    plan: z.enum(["free", "pro", "enterprise"]),
  }),
});

export type UserCreatedEventV1 = z.infer<typeof UserCreatedEventV1>;

export const UserUpdatedEventV1 = BaseEventSchema.extend({
  type: z.literal("user.updated"),
  version: z.literal("1.0"),
  data: z.object({
    userId: z.string().uuid(),
    changes: z.record(z.unknown()),
    previousValues: z.record(z.unknown()).optional(),
  }),
});

export type UserUpdatedEventV1 = z.infer<typeof UserUpdatedEventV1>;

// Event union type
export const UserEvent = z.discriminatedUnion("type", [
  UserCreatedEventV1,
  UserUpdatedEventV1,
]);

export type UserEvent = z.infer<typeof UserEvent>;
```

```
EVENT SCHEMA RULES:
  - Version every event schema (version field in payload)
  - Use Zod for runtime validation at publish AND consume
  - Export TypeScript types for compile-time safety
  - Add new versions, NEVER modify existing version
  - Consumers validate events on receipt
  - Include metadata: correlationId, source, timestamp, causationId
  - Use discriminated union for event type routing
  - Dead letter queue for invalid events
  - Schema evolution: only additive changes within a version
```

---

## 11. Consuming Shared Libraries

```json
// Monorepo -- workspace protocol
{
  "dependencies": {
    "@platform/logger": "workspace:*",
    "@platform/auth": "workspace:*",
    "@platform/events": "workspace:*"
  }
}

// Polyrepo -- published versions
{
  "dependencies": {
    "@platform/logger": "^1.2.0",
    "@platform/auth": "^2.0.0",
    "@platform/events": "^1.5.0"
  }
}
```

```
MONOREPO:
  - workspace:* always uses latest local version
  - Changes are available immediately after build
  - Breaking changes caught at build time across all services
  - Use turborepo/nx for affected-only builds
  - No publishing step needed

POLYREPO:
  - Published to private npm registry
  - Services pin to specific version ranges (^major)
  - Breaking changes require version bump + migration
  - Dependabot/Renovate for automated update PRs
  - Publishing pipeline: changeset version + changeset publish

PRIVATE REGISTRY OPTIONS:
  GitHub Packages   -- Free for GitHub orgs, npm + Docker
  npm org           -- Paid ($7/user/month), private packages
  Verdaccio         -- Self-hosted, free, lightweight
  Artifactory       -- Enterprise, multi-format (npm, PyPI, Maven, Docker)
  GitLab Packages   -- Built into GitLab, free

RECOMMENDATION:
  GitHub org         --> GitHub Packages (simplest)
  Enterprise/multi   --> Artifactory
  Self-hosted/budget --> Verdaccio
```

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| Business logic in shared lib | Changes in lib break multiple services | Distributed monolith, coordinated deploys | Domain logic stays in individual services |
| Monolith shared lib | One package with logging + auth + events + everything | 100+ transitive deps, slow installs | Split into focused packages (5-15 files each) |
| Shared database models | ORM entities in shared package | Coupling through data layer, migration hell | Each service owns its models |
| No versioning | Breaking changes break all services immediately | Cascading failures across services | Semantic versioning per package with Changesets |
| Deep dependency chains | Lib A -> Lib B -> Lib C -> Lib D | Diamond deps, version conflicts | Max 1-2 levels of library dependencies |
| Shared lib changes require all-service deploy | Tight coupling through shared state | Cannot deploy services independently | Independent versions, backward compatibility |
| No testing of shared libs | Bugs propagate to all consuming services | Widespread failures from single bug | Unit + integration tests in every shared package |
| Private registry not set up | Teams copy-paste code between services | Code drift, inconsistency, maintenance burden | Set up GitHub Packages or Verdaccio |
| Service-specific DTOs in shared package | CreateOrderRequest in shared-types | Every service depends on every other service's types | Generate clients from contracts per service |
| No deprecation process | Exports removed without warning | Consumer services break on update | Deprecation warnings, migration guides, major version |
| Synchronized versioning | All @platform/* at same version | One change bumps everything, forced updates | Independent versioning (Changesets) |

---

## 13. Real-World Examples

```
COMPANY PATTERNS:

Uber:
  - Monorepo with shared Go libraries
  - Proto-based service contracts
  - Custom schema registry for events
  - Shared observability libraries (Jaeger tracing)

Netflix:
  - Polyrepo with published internal packages
  - Spring Cloud Netflix OSS libraries
  - Custom service mesh (Zuul, Eureka)
  - Shared chaos engineering libraries

Shopify:
  - Ruby monorepo (components architecture)
  - Shared Rails engines for cross-cutting concerns
  - Event-driven with shared event schemas
  - Packwerk for enforcing boundaries

Stripe:
  - Monorepo with shared Ruby/Java libraries
  - Protocol buffers for service contracts
  - Shared observability and auth libraries
  - Strong backward compatibility culture

Airbnb:
  - Monorepo with shared TypeScript packages
  - GraphQL schema as shared contract
  - Shared design system components
  - Custom code generation for API clients
```

---

## 14. Enforcement Checklist

- [ ] Libraries contain ONLY cross-cutting concerns -- NO business logic
- [ ] Each library is a separate package -- own version, changelog, tests
- [ ] Small and focused -- 5-15 source files per library
- [ ] Minimal dependencies -- zero or very few external deps
- [ ] Independent versioning -- Changesets (monorepo) or semantic-release (polyrepo)
- [ ] Event schemas shared via typed package -- versioned, Zod-validated
- [ ] Private registry configured -- GitHub Packages, Verdaccio, or Artifactory
- [ ] Backward compatibility -- additive changes, deprecate before removing
- [ ] README per library -- installation, usage, API documentation
- [ ] Tests in every library -- unit + integration, coverage thresholds
- [ ] Mocks/testing utilities -- @platform/testing for test helpers
- [ ] CODEOWNERS -- each library has designated maintainers
- [ ] API clients generated from contracts -- never hand-written
- [ ] Diamond dependency prevention -- flat dependency structure, peer deps
- [ ] Renovate/Dependabot configured -- automated updates for consuming services
- [ ] Version compatibility matrix -- track library versions across services
- [ ] Deprecation process documented -- warnings, migration guides, timeline
