# Documentation Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "where should documentation live?", "how do I organize my docs?", "should I use a docs/ folder?", or "how to structure ADRs?", use this directive. Documentation structure determines whether docs get written, found, read, and maintained. The WRONG structure means docs rot and become lies. The RIGHT structure makes docs a natural part of development. Documentation lives AS CLOSE to the code it describes as possible. Centralized docs/ is for cross-cutting guides only.

---

## 1. The Core Rule

**Documentation MUST be co-located with what it documents. API docs next to API code. Component docs next to components. Architecture Decision Records in a dedicated `docs/adr/` directory. A root README.md is MANDATORY for every project and every package in a monorepo. Documentation that is far from the code it describes WILL rot.**

```
❌ WRONG: All docs in one monolithic folder
docs/
├── api.md                    ← Describes code in src/api/ — will drift
├── auth.md                   ← Describes code in src/auth/ — will drift
├── database.md               ← Describes code in src/db/ — will drift
├── deployment.md             ← Cross-cutting — this is OK here
└── architecture.md           ← Cross-cutting — this is OK here

✅ CORRECT: Co-located + centralized cross-cutting docs
src/
├── features/auth/
│   └── README.md             ← Auth-specific documentation
├── features/orders/
│   └── README.md             ← Orders-specific documentation
docs/
├── adr/                      ← Architecture Decision Records
├── architecture.md           ← System architecture overview
├── deployment.md             ← How to deploy
└── onboarding.md             ← How to get started
README.md                     ← Project root documentation
```

---

## 2. The Documentation Hierarchy

```
project/
├── README.md                              ← Project overview (MANDATORY)
├── CONTRIBUTING.md                        ← How to contribute
├── CHANGELOG.md                           ← Version history
├── LICENSE                                ← License file
├── CODE_OF_CONDUCT.md                     ← Community standards (open source)
├── SECURITY.md                            ← Security policy and disclosure
├── docs/                                  ← Cross-cutting documentation
│   ├── architecture/
│   │   ├── overview.md                    ← System architecture diagram
│   │   ├── data-model.md                  ← Database schema docs
│   │   └── api-design.md                  ← API design principles
│   ├── adr/                               ← Architecture Decision Records
│   │   ├── 0001-use-postgresql.md
│   │   ├── 0002-choose-nestjs.md
│   │   ├── 0003-event-driven-orders.md
│   │   └── template.md                    ← ADR template
│   ├── guides/
│   │   ├── onboarding.md                  ← New developer setup
│   │   ├── deployment.md                  ← Deployment procedures
│   │   ├── debugging.md                   ← Common debugging steps
│   │   └── testing.md                     ← Testing strategy and how-to
│   ├── api/
│   │   ├── openapi.yaml                   ← OpenAPI specification
│   │   └── postman-collection.json        ← Postman/Insomnia collection
│   └── runbooks/                          ← Operational runbooks
│       ├── incident-response.md
│       ├── database-migration.md
│       └── scaling.md
├── src/
│   ├── features/auth/
│   │   └── README.md                      ← Feature-specific docs
│   └── features/orders/
│       └── README.md                      ← Feature-specific docs
└── packages/                              ← Monorepo packages
    ├── ui/
    │   └── README.md                      ← Package-specific docs
    └── shared/
        └── README.md                      ← Package-specific docs
```

---

## 3. README.md Structure

### Root README.md (MANDATORY)

```markdown
# Project Name

One-line description of what this project does.

## Quick Start

\`\`\`bash
# Prerequisites
node >= 20, pnpm >= 8, Docker

# Setup
git clone https://github.com/org/repo.git
cd repo
cp .env.example .env.local
docker compose up -d
pnpm install
pnpm dev
\`\`\`

## Architecture

Brief description of the architecture. Link to `docs/architecture/overview.md`
for full details.

## Project Structure

\`\`\`
src/
├── features/     # Business features (auth, orders, etc.)
├── shared/       # Shared utilities and components
├── config/       # Application configuration
└── app.ts        # Application entry point
\`\`\`

## Scripts

| Command          | Description                    |
|------------------|--------------------------------|
| `pnpm dev`       | Start development server       |
| `pnpm build`     | Build for production           |
| `pnpm test`      | Run unit tests                 |
| `pnpm test:e2e`  | Run end-to-end tests           |
| `pnpm lint`      | Run linting                    |
| `pnpm db:migrate`| Run database migrations        |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
```

### Feature README.md

```markdown
# Auth Feature

Handles user authentication, authorization, and session management.

## API Endpoints

| Method | Path              | Description          |
|--------|-------------------|----------------------|
| POST   | /api/auth/login   | User login           |
| POST   | /api/auth/register| User registration    |
| POST   | /api/auth/refresh | Refresh access token |
| DELETE  | /api/auth/logout  | User logout          |

## Key Files

- `auth.service.ts` — Core authentication logic
- `auth.guard.ts` — Route protection guard
- `strategies/jwt.strategy.ts` — JWT validation strategy

## Decisions

- Using JWT with refresh tokens (see ADR-0005)
- Passwords hashed with bcrypt, cost factor 12
```

---

## 4. Architecture Decision Records (ADRs)

### ADR Directory Structure

```
docs/adr/
├── 0001-use-postgresql-for-primary-database.md
├── 0002-choose-nestjs-framework.md
├── 0003-adopt-event-driven-architecture-for-orders.md
├── 0004-use-redis-for-session-storage.md
├── 0005-jwt-with-refresh-tokens-for-auth.md
├── 0006-monorepo-with-turborepo.md
└── template.md
```

### ADR Template

```markdown
# ADR-NNNN: Title

## Status

Accepted | Superseded by ADR-XXXX | Deprecated

## Date

YYYY-MM-DD

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing or have agreed to implement?

## Consequences

What becomes easier or more difficult because of this change?

### Positive
- ...

### Negative
- ...

### Neutral
- ...
```

### ADR Naming Rules

```
RULE: ADRs are numbered sequentially. NEVER reuse or skip numbers.
RULE: File name is: NNNN-short-description-with-dashes.md
RULE: ADRs are IMMUTABLE once accepted. To change a decision,
      create a NEW ADR that supersedes the old one.
RULE: Even rejected decisions get an ADR — it documents WHY you said no.
```

---

## 5. CHANGELOG Format

### Keep a Changelog Standard

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- New feature X

### Changed
- Updated Y behavior

## [1.2.0] - 2025-03-15

### Added
- User profile avatar upload
- Dark mode support

### Fixed
- Login redirect loop on expired sessions
- Memory leak in WebSocket connection handler

### Security
- Updated dependency `lodash` to fix prototype pollution (CVE-2024-XXXX)

## [1.1.0] - 2025-02-01

### Added
- Order history page
- Email notifications for order status changes

### Deprecated
- Legacy `/api/v1/orders` endpoint (use `/api/v2/orders`)
```

### Changelog Categories

```
Added       — New features
Changed     — Changes in existing functionality
Deprecated  — Soon-to-be removed features
Removed     — Removed features
Fixed       — Bug fixes
Security    — Vulnerability fixes

RULE: NEVER use "Updated dependencies" without specifying WHY.
RULE: Link CVEs when fixing security vulnerabilities.
RULE: Each entry must be understandable without reading the code.
```

---

## 6. API Documentation

### OpenAPI Specification Placement

```
project/
├── docs/
│   └── api/
│       ├── openapi.yaml              ← Main OpenAPI spec
│       ├── schemas/                  ← Shared schema components
│       │   ├── user.yaml
│       │   ├── order.yaml
│       │   └── error.yaml
│       └── paths/                    ← Path definitions by resource
│           ├── auth.yaml
│           ├── orders.yaml
│           └── users.yaml
```

### Auto-Generated API Docs

```typescript
// NestJS: Swagger auto-generation from decorators
// The code IS the documentation
@Controller('orders')
@ApiTags('Orders')
export class OrderController {
  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    // ...
  }
}

// FastAPI: Auto-generated from type hints
@app.post("/orders", response_model=OrderResponse, status_code=201)
async def create_order(order: CreateOrderRequest):
    """Create a new order. Validates items and calculates total."""
    # Documentation IS the code
```

```
RULE: Prefer auto-generated API docs from code annotations over
      manually maintained OpenAPI files.
RULE: If using manual OpenAPI, validate it in CI against actual API.
```

---

## 7. Docs-as-Code (Docusaurus, VitePress)

### When to Use a Documentation Site

```
Use docs-as-code site when:
  ✅ Public-facing API documentation
  ✅ Open-source project documentation
  ✅ Internal platform/SDK documentation consumed by other teams
  ✅ Documentation needs versioning per release
  ✅ Multiple contributors need to write docs

DO NOT use docs-as-code site when:
  ❌ Small internal project with <10 developers
  ❌ Documentation is only for the development team
  ❌ A good README.md + docs/ folder is sufficient
```

### Documentation Site Structure

```
docs-site/                         ← Docusaurus/VitePress project
├── docs/
│   ├── getting-started/
│   │   ├── installation.md
│   │   ├── quick-start.md
│   │   └── configuration.md
│   ├── guides/
│   │   ├── authentication.md
│   │   ├── webhooks.md
│   │   └── error-handling.md
│   ├── api-reference/
│   │   ├── rest-api.md
│   │   └── websocket-api.md
│   ├── architecture/
│   │   └── overview.md
│   └── contributing.md
├── blog/                          ← Release announcements, tutorials
│   └── 2025-03-01-v2-release.md
├── static/
│   └── img/
│       └── architecture-diagram.png
├── docusaurus.config.js           ← or vitepress config
├── sidebars.js                    ← Navigation structure
└── package.json
```

---

## 8. Documentation per Platform

```
┌──────────────────┬──────────────────────────────────────────────┐
│ Platform         │ Documentation Pattern                        │
├──────────────────┼──────────────────────────────────────────────┤
│ Node.js/TS       │ JSDoc/TSDoc in code + README.md per package  │
│ Python           │ Docstrings (Google/NumPy style) + Sphinx     │
│ Go               │ godoc comments + README.md per package       │
│ C# / .NET        │ XML docs (///) + README.md per project      │
│ Java             │ Javadoc + README.md per module               │
│ Rust             │ /// doc comments + cargo doc                 │
│ React            │ Storybook for components + README.md         │
└──────────────────┴──────────────────────────────────────────────┘
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No README** | New devs can't set up the project for days | README.md is MANDATORY with Quick Start section |
| **Rotting docs** | Docs describe removed features or old APIs | Co-locate docs with code; update docs in same PR as code |
| **Wiki instead of code** | Docs in Confluence/Notion, disconnected from code | Documentation in the repo, reviewed in PRs |
| **No ADRs** | Nobody remembers WHY decisions were made | Start ADR habit; even 3-sentence ADRs have value |
| **Monolithic docs/** | Single 5000-line architecture.md | Split by topic: architecture, deployment, onboarding |
| **No API docs** | Developers reverse-engineer API from code | OpenAPI spec or auto-generated Swagger docs |
| **No CHANGELOG** | Users don't know what changed between versions | Maintain CHANGELOG.md following Keep a Changelog |
| **Docs not in PR review** | Code changes without doc updates | PR template includes "Documentation updated?" checkbox |
| **No runbooks** | On-call engineer scrambles during incidents | Create runbooks for common operational procedures |
| **Over-documentation** | Every function has a paragraph of docs | Only document non-obvious behavior; code should be self-documenting |

---

## 10. Enforcement Checklist

- [ ] **Root README.md** — exists with Quick Start, Architecture, Project Structure, Scripts
- [ ] **Feature READMEs** — each major feature/module has its own README.md
- [ ] **docs/adr/ directory** — ADRs for all significant architectural decisions
- [ ] **CONTRIBUTING.md** — exists with setup instructions, PR guidelines, coding standards
- [ ] **CHANGELOG.md** — maintained following Keep a Changelog format
- [ ] **API documentation** — OpenAPI spec or auto-generated from code annotations
- [ ] **Co-located docs** — module-specific docs live next to the module code
- [ ] **Cross-cutting in docs/** — architecture, deployment, onboarding in docs/ directory
- [ ] **PR template** — includes documentation checklist
- [ ] **No wiki-only docs** — all critical docs live in the repository, not external wikis
- [ ] **Runbooks exist** — operational procedures for incidents, migrations, scaling
- [ ] **LICENSE file** — exists at project root
