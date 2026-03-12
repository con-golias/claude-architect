# Monorepo Workspace Organization

> **AI Plugin Directive:** When organizing packages within a monorepo, ALWAYS use this guide. Apply `apps/` vs `packages/` separation with clear naming, boundaries, dependency rules, and package configuration. This guide covers workspace structure from simple (5 packages) to enterprise (100+ packages) with full configuration examples for pnpm workspaces, Turborepo, and Nx.

**Core Rule: Separate applications (deployable) from libraries (shared code). Applications live in `apps/`, libraries in `packages/` (or `libs/`). NEVER let applications import from other applications — only from shared packages. Every package has its own `package.json`, barrel export (`index.ts`), and explicit dependencies. The workspace root is for orchestration only — no application code lives at root.**

---

## 1. Standard Workspace Layout

### 1.1 Small/Medium (5-20 packages)
```
my-monorepo/
├── apps/                                  # Deployable applications
│   ├── web/                               # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/                       # App Router pages
│   │   │   ├── components/                # App-specific components
│   │   │   └── lib/                       # App-specific utilities
│   │   ├── public/
│   │   ├── package.json                   # "name": "@myorg/web"
│   │   ├── next.config.ts
│   │   └── tsconfig.json                  # extends ../../tsconfig.base.json
│   │
│   ├── api/                               # NestJS/Express backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   ├── package.json                   # "name": "@myorg/api"
│   │   └── tsconfig.json
│   │
│   ├── admin/                             # Admin dashboard
│   │   ├── src/
│   │   ├── package.json                   # "name": "@myorg/admin"
│   │   └── tsconfig.json
│   │
│   └── docs/                              # Documentation site (Nextra/Docusaurus)
│       ├── pages/
│       ├── package.json                   # "name": "@myorg/docs"
│       └── tsconfig.json
│
├── packages/                              # Shared libraries
│   ├── ui/                                # React component library
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── button/
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── button.test.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── input/
│   │   │   │   └── index.ts               # Re-exports all components
│   │   │   ├── hooks/
│   │   │   │   ├── use-disclosure.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts                   # PUBLIC API (barrel export)
│   │   ├── package.json                   # "name": "@myorg/ui"
│   │   ├── tsup.config.ts                 # Build config
│   │   └── tsconfig.json
│   │
│   ├── shared-types/                      # TypeScript interfaces/types
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── order.ts
│   │   │   ├── api-responses.ts
│   │   │   └── index.ts
│   │   ├── package.json                   # "name": "@myorg/shared-types"
│   │   └── tsconfig.json
│   │
│   ├── utils/                             # Pure utility functions
│   │   ├── src/
│   │   │   ├── date.ts
│   │   │   ├── string.ts
│   │   │   ├── validation.ts
│   │   │   └── index.ts
│   │   ├── package.json                   # "name": "@myorg/utils"
│   │   └── tsconfig.json
│   │
│   ├── database/                          # Prisma schema + client
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── client.ts                  # PrismaClient singleton
│   │   │   └── index.ts
│   │   ├── package.json                   # "name": "@myorg/database"
│   │   └── tsconfig.json
│   │
│   ├── auth/                              # Authentication logic
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   ├── session.ts
│   │   │   └── index.ts
│   │   ├── package.json                   # "name": "@myorg/auth"
│   │   └── tsconfig.json
│   │
│   └── api-client/                        # Generated API client (from OpenAPI)
│       ├── src/
│       │   └── generated/
│       ├── package.json                   # "name": "@myorg/api-client"
│       └── tsconfig.json
│
├── config/                                # Shared configuration packages
│   ├── eslint-config/                     # Shared ESLint rules
│   │   ├── base.js                        # Base rules for all packages
│   │   ├── next.js                        # Next.js specific rules
│   │   ├── react-library.js               # React library rules
│   │   ├── node.js                        # Node.js backend rules
│   │   ├── package.json                   # "name": "@myorg/eslint-config"
│   │   └── index.js
│   │
│   ├── tsconfig/                          # Shared TypeScript configs
│   │   ├── base.json                      # Base config
│   │   ├── nextjs.json                    # Next.js extends base
│   │   ├── react-library.json             # React lib extends base
│   │   ├── node.json                      # Node.js extends base
│   │   └── package.json                   # "name": "@myorg/tsconfig"
│   │
│   └── prettier-config/                   # Shared Prettier config
│       ├── index.js
│       └── package.json                   # "name": "@myorg/prettier-config"
│
├── tooling/                               # Internal build/dev tooling
│   ├── scripts/
│   │   ├── check-versions.ts
│   │   └── generate-api-client.ts
│   └── generators/                        # Custom code generators
│       └── new-package/
│
├── package.json                           # Root workspace config
├── pnpm-workspace.yaml                    # Workspace definition
├── turbo.json                             # Task orchestration
├── tsconfig.base.json                     # Root TypeScript config
├── .eslintrc.js                           # Root ESLint config
├── .prettierrc                            # Root Prettier config
├── .npmrc                                 # pnpm configuration
├── .nvmrc                                 # Node version
├── .gitignore
└── .github/
    ├── CODEOWNERS
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

### 1.2 Enterprise (100+ packages)
```
my-monorepo/
├── apps/
│   ├── customer/                          # Customer-facing apps
│   │   ├── web/
│   │   ├── mobile/
│   │   └── checkout/
│   ├── merchant/                          # Merchant-facing apps
│   │   ├── dashboard/
│   │   ├── analytics/
│   │   └── api/
│   ├── internal/                          # Internal tools
│   │   ├── backoffice/
│   │   ├── monitoring/
│   │   └── admin/
│   └── marketing/                         # Marketing sites
│       ├── website/
│       ├── blog/
│       └── landing-pages/
│
├── packages/
│   ├── @ui/                               # UI namespace
│   │   ├── core/                          # Base components
│   │   ├── forms/                         # Form components
│   │   ├── data-display/                  # Tables, charts
│   │   ├── navigation/                    # Nav, sidebar, tabs
│   │   ├── overlays/                      # Modal, drawer, tooltip
│   │   ├── icons/                         # Icon library
│   │   └── theme/                         # Design tokens, themes
│   │
│   ├── @data/                             # Data access namespace
│   │   ├── database/                      # Prisma client
│   │   ├── cache/                         # Redis client
│   │   ├── search/                        # Elasticsearch client
│   │   ├── queue/                         # Message queue client
│   │   └── api-client/                    # Generated API client
│   │
│   ├── @domain/                           # Domain logic namespace
│   │   ├── users/                         # User domain types + logic
│   │   ├── orders/                        # Order domain
│   │   ├── payments/                      # Payment domain
│   │   ├── products/                      # Product domain
│   │   └── notifications/                 # Notification domain
│   │
│   ├── @platform/                         # Platform namespace
│   │   ├── logger/                        # Structured logging
│   │   ├── auth/                          # Authentication
│   │   ├── config/                        # Configuration loader
│   │   ├── errors/                        # Error classes
│   │   ├── testing/                       # Test utilities
│   │   ├── analytics/                     # Analytics tracking
│   │   └── feature-flags/                 # Feature flag client
│   │
│   └── @shared/                           # Shared utilities namespace
│       ├── types/                         # TypeScript types
│       ├── utils/                         # Pure utility functions
│       ├── constants/                     # App-wide constants
│       ├── validators/                    # Zod schemas
│       └── i18n/                          # Internationalization
│
├── config/
│   ├── eslint-config/
│   ├── tsconfig/
│   └── prettier-config/
│
├── infrastructure/                        # IaC (optional in monorepo)
│   ├── terraform/
│   ├── kubernetes/
│   └── docker/
│
├── package.json
├── pnpm-workspace.yaml
└── nx.json
```

---

## 2. Naming Conventions

| Category | Convention | Examples |
|----------|-----------|---------|
| **Organization scope** | `@orgname/` prefix on ALL packages | `@myorg/ui`, `@myorg/utils` |
| **App names** | Descriptive, short, no scope needed internally | `web`, `api`, `admin`, `mobile` |
| **Library names** | Descriptive noun, kebab-case | `ui`, `shared-types`, `api-client` |
| **Config packages** | `{tool}-config` pattern | `eslint-config`, `tsconfig`, `prettier-config` |
| **Namespaced packages** | `@category/name` for 100+ packages | `@ui/core`, `@data/database`, `@platform/logger` |
| **Internal tools** | `tooling/` or `tools/` directory | `tooling/scripts`, `tooling/generators` |
| **Folder names** | kebab-case everywhere | `shared-types/`, `api-client/`, `data-display/` |

### Package Naming in package.json

```json
// apps/web/package.json
{ "name": "@myorg/web", "private": true }

// packages/ui/package.json
{ "name": "@myorg/ui", "private": true }

// packages/shared-types/package.json
{ "name": "@myorg/shared-types", "private": true }

// config/eslint-config/package.json
{ "name": "@myorg/eslint-config", "private": true }
```

```
Rules:
  ✅ ALWAYS use @scope/ prefix for organization
  ✅ ALWAYS set "private": true for monorepo-internal packages
  ✅ NEVER publish internal packages to npm (use workspace: protocol)
  ✅ Only set "private": false for packages you INTEND to publish
  ✅ Package name matches directory name: packages/ui → @myorg/ui
```

---

## 3. Dependency Rules

### 3.1 Allowed Dependencies
```
ALLOWED (arrows = "depends on"):

  apps/* ──────→ packages/*        Apps import shared libraries
  packages/* ──→ packages/*        Libraries import other libraries
  apps/* ──────→ config/*          Apps use shared configs
  packages/* ──→ config/*          Libraries use shared configs

  Dependency flows DOWNWARD:
    apps (top) → packages (middle) → config (bottom)
```

### 3.2 Forbidden Dependencies
```
FORBIDDEN:

  apps/* ──✕──→ apps/*             Apps NEVER import other apps
  packages/* ─✕→ apps/*            Libraries NEVER import apps
  config/* ──✕──→ packages/*       Configs NEVER import packages
  config/* ──✕──→ apps/*           Configs NEVER import apps
  A ──→ B ──→ A                    Circular dependencies NEVER

  If apps/web needs code from apps/api:
    ❌ import { something } from "@myorg/api"
    ✅ Extract shared code to packages/shared-something
    ✅ Both apps import from packages/shared-something
```

### 3.3 Dependency Graph Visualization

```
Valid dependency graph:

  ┌──────────────────────── APPS LAYER (deployable) ──────────────────────┐
  │                                                                       │
  │  apps/web ────────┐     apps/api ────────┐     apps/admin ──────┐   │
  │    │               │       │               │       │             │   │
  └────┼───────────────┼───────┼───────────────┼───────┼─────────────┼───┘
       │               │       │               │       │             │
  ┌────▼───────────────▼───────▼───────────────▼───────▼─────────────▼───┐
  │                                                                       │
  │  ┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────────┐  │
  │  │ packages/ui │ │ packages/   │ │ packages/│ │ packages/        │  │
  │  │             │ │ database    │ │ auth     │ │ api-client       │  │
  │  └──────┬──────┘ └──────┬──────┘ └────┬─────┘ └────────┬─────────┘  │
  │         │               │              │                │            │
  │  PACKAGES LAYER (shared libraries)                                   │
  └─────────┼───────────────┼──────────────┼────────────────┼────────────┘
            │               │              │                │
  ┌─────────▼───────────────▼──────────────▼────────────────▼────────────┐
  │                                                                       │
  │  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
  │  │ packages/        │  │ packages/    │  │ packages/            │   │
  │  │ shared-types     │  │ utils        │  │ validators           │   │
  │  └──────────────────┘  └──────────────┘  └──────────────────────┘   │
  │                                                                       │
  │  LEAF PACKAGES (no internal dependencies — build first)              │
  └───────────────────────────────────────────────────────────────────────┘
```

---

## 4. Package Configuration

### 4.1 Internal Library (packages/ui)
```json
{
  "name": "@myorg/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./components": {
      "types": "./src/components/index.ts",
      "default": "./src/components/index.ts"
    },
    "./hooks": {
      "types": "./src/hooks/index.ts",
      "default": "./src/hooks/index.ts"
    },
    "./styles.css": "./src/styles.css"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@myorg/shared-types": "workspace:*",
    "@myorg/utils": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@myorg/eslint-config": "workspace:*",
    "@myorg/tsconfig": "workspace:*",
    "@testing-library/react": "^16.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.0.0"
  }
}
```

### 4.2 Internal Library — tsup.config.ts
```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  splitting: true,
  treeshake: true,
});
```

### 4.3 Application (apps/web)
```json
{
  "name": "@myorg/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/shared-types": "workspace:*",
    "@myorg/utils": "workspace:*",
    "@myorg/database": "workspace:*",
    "@myorg/auth": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@myorg/eslint-config": "workspace:*",
    "@myorg/tsconfig": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

### 4.4 Configuration Package (config/eslint-config)
```javascript
// config/eslint-config/base.js
/** @type {import("eslint").Linter.Config} */
module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports" },
    ],
    "import/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling"],
          "index",
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc" },
      },
    ],
    "import/no-duplicates": "error",
  },
  settings: {
    "import/resolver": {
      typescript: { project: ["tsconfig.json"] },
    },
  },
};

// config/eslint-config/next.js
/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    "./base.js",
    "next/core-web-vitals",
    "next/typescript",
  ],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
  },
};

// config/eslint-config/package.json
{
  "name": "@myorg/eslint-config",
  "version": "0.0.0",
  "private": true,
  "files": ["*.js"],
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-import": "^2.29.0"
  }
}
```

### 4.5 TypeScript Config Package
```json
// config/tsconfig/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", "build", ".next", ".turbo"]
}

// config/tsconfig/nextjs.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// config/tsconfig/react-library.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx"
  }
}

// config/tsconfig/node.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

---

## 5. Barrel Exports (Public API)

```typescript
// packages/ui/src/index.ts — PUBLIC API
// This file defines WHAT consumers can import from @myorg/ui
// ONLY export what is part of the public API

// Components
export { Button } from "./components/button";
export type { ButtonProps } from "./components/button";

export { Input } from "./components/input";
export type { InputProps } from "./components/input";

export { Select } from "./components/select";
export type { SelectProps } from "./components/select";

// Hooks
export { useDisclosure } from "./hooks/use-disclosure";
export { useMediaQuery } from "./hooks/use-media-query";

// Theme
export { ThemeProvider } from "./theme/provider";
export { useTheme } from "./theme/use-theme";
```

```
Barrel export rules:
  ✅ Every package has ONE index.ts defining its public API
  ✅ Consumers import ONLY from the package, never from internal paths
  ✅ Use explicit named exports (not export *)
  ✅ Export types separately with "export type { ... }"

  // Consumer code:
  ✅ import { Button, Input } from "@myorg/ui";
  ❌ import { Button } from "@myorg/ui/src/components/button/button";

  If you need subpath exports:
  ✅ import { Button } from "@myorg/ui/components";  // via exports field
  Configure in package.json "exports" field (see Section 4.1)
```

---

## 6. Workspace Configuration

### pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "apps/**/*"           # For nested apps (apps/customer/web)
  - "packages/*"
  - "packages/**/*"       # For namespaced packages (@ui/core)
  - "config/*"
  - "tooling/*"
```

### Root .gitignore
```gitignore
# Dependencies
node_modules/

# Build outputs
dist/
build/
.next/
out/

# Cache
.turbo/
.nx/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/settings.json
*.swp

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Prisma
packages/database/prisma/*.db
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| App-to-app imports | `apps/web` imports from `apps/api` | Extract shared code to `packages/` |
| Circular dependencies | Package A depends on B depends on A | Extract shared logic to new leaf package |
| No barrel exports | Internal files imported directly via deep paths | `index.ts` defines public API per package |
| All deps at root | Root `package.json` has app dependencies | Per-package deps, root only has workspace tools |
| Flat packages at scale | 50+ packages in one directory | Namespace with `@ui/`, `@data/`, `@platform/` |
| Missing `private: true` | Accidental publish to npm | ALL internal packages MUST be `private: true` |
| No `workspace:*` protocol | Using `^1.0.0` for internal packages | Use `workspace:*` for ALL internal references |
| Config duplication | Each package has own ESLint/TS config from scratch | Shared config packages in `config/` |
| No package.json per package | Relying on root package.json for everything | Every package needs its own package.json |
| Mixed build/no-build packages | Unclear which packages need building | Convention: `build` script exists = needs building |
| Deep nesting without namespace | `packages/frontend/ui/core/` → confusing | Use `@namespace/` prefix, max 1 level deep |

---

## 8. Enforcement Checklist

- [ ] `apps/` for deployables, `packages/` for shared libraries — clear separation
- [ ] Scoped package names — `@myorg/package-name` on ALL packages
- [ ] `workspace:*` for internal references — NEVER version numbers for internal packages
- [ ] `"private": true` on ALL internal packages — prevent accidental npm publish
- [ ] Barrel exports (`index.ts`) — every package defines its public API
- [ ] Per-package `package.json` — own dependencies, scripts, and configuration
- [ ] Dependency rules enforced — no app-to-app, no circular, downward flow only
- [ ] Shared configs in `config/` — ESLint, TypeScript, Prettier as packages
- [ ] CODEOWNERS per package directory — explicit ownership for code review
- [ ] Consistent naming — kebab-case dirs, `@scope/name` packages
- [ ] No deep nesting — max 2 levels (e.g., `packages/@ui/core/`)
- [ ] Root is orchestration only — no application code at workspace root
- [ ] pnpm-workspace.yaml includes all package directories
- [ ] .gitignore covers all build outputs and caches
