# Dependency Organization — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I organize dependencies?", "what's the difference between dependencies and devDependencies?", "should I use a lockfile?", "how do I manage internal packages?", or "how do I handle path aliases?", use this directive. Dependency organization determines your build reliability, bundle size, security posture, and team velocity. Mismanaged dependencies cause phantom dependencies, version conflicts, supply chain vulnerabilities, and non-reproducible builds. Every dependency MUST be explicitly declared, locked, and categorized.

---

## 1. The Core Rule

**Every dependency MUST be explicitly declared in the manifest file (package.json, pyproject.toml, go.mod, *.csproj). Lockfiles MUST be committed to version control and MUST be used in CI with `--frozen-lockfile`. Dependencies MUST be categorized correctly (runtime vs dev vs peer). Internal shared packages use workspace protocols, NEVER relative file paths in production.**

```
❌ WRONG: No lockfile, implicit dependencies, mixed categories
package.json
{
  "dependencies": {
    "jest": "^29.0.0",           ← jest is a devDependency!
    "lodash": "^4.17.21",       ← ^ allows minor version drift
    "typescript": "^5.0.0"      ← typescript is a devDependency!
  }
}
// No package-lock.json committed

✅ CORRECT: Proper categorization, lockfile committed
package.json
{
  "dependencies": {
    "lodash": "^4.17.21"        ← Runtime dependency only
  },
  "devDependencies": {
    "jest": "^29.7.0",          ← Test runner — dev only
    "typescript": "~5.3.3"      ← Compiler — dev only
  }
}
// package-lock.json committed and used with --frozen-lockfile in CI
```

---

## 2. Dependency Categories

### Node.js / TypeScript

```
┌──────────────────────┬──────────────────────────────────────────────┐
│ Category             │ What Goes Here                                │
├──────────────────────┼──────────────────────────────────────────────┤
│ dependencies         │ Runtime packages needed in production.        │
│                      │ Examples: express, prisma, zod, bcrypt        │
│                      │ Included in: production bundle/deploy         │
├──────────────────────┼──────────────────────────────────────────────┤
│ devDependencies      │ Build, test, lint, formatting tools.          │
│                      │ Examples: typescript, jest, eslint, prettier  │
│                      │ NOT included in: production bundle/deploy     │
├──────────────────────┼──────────────────────────────────────────────┤
│ peerDependencies     │ Packages that the HOST project must provide. │
│                      │ Used by: libraries and plugins                │
│                      │ Examples: react (for a React component lib)   │
│                      │ NOT installed automatically (npm 7+ installs) │
├──────────────────────┼──────────────────────────────────────────────┤
│ optionalDependencies │ Packages that enhance but aren't required.    │
│                      │ Examples: fsevents (macOS only), sharp        │
│                      │ Install failure doesn't block npm install     │
└──────────────────────┴──────────────────────────────────────────────┘
```

### Classification Decision Tree

```
Should this package be in dependencies or devDependencies?

START: Does the production runtime code import this package?
│
├── YES → Is it a type-only import? (import type { X })
│   ├── YES → devDependencies (types are erased at compile time)
│   └── NO → dependencies (runtime code needs it)
│
└── NO → Is it used for building, testing, linting, or formatting?
    ├── YES → devDependencies
    └── NO → It shouldn't be a dependency at all. Remove it.

COMMON MISTAKES:
  ❌ typescript in dependencies       → devDependencies (compiler, not runtime)
  ❌ @types/* in dependencies         → devDependencies (types erased at build)
  ❌ jest/vitest in dependencies      → devDependencies (test runner)
  ❌ eslint/prettier in dependencies  → devDependencies (lint/format tools)
  ❌ webpack/vite in dependencies     → devDependencies (build tools)
  ✅ @prisma/client in dependencies   → dependencies (runtime ORM client)
  ✅ express in dependencies          → dependencies (runtime server)
```

### Python

```toml
# pyproject.toml — dependency groups
[project]
name = "my-app"
version = "1.0.0"
dependencies = [
    "fastapi>=0.100.0",
    "sqlalchemy>=2.0.0",
    "pydantic>=2.0.0",
    "httpx>=0.24.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-cov>=4.0.0",
    "mypy>=1.0.0",
    "ruff>=0.1.0",
    "black>=23.0.0",
]
```

### Go

```go
// go.mod — Go modules
module github.com/myorg/myapp

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1          // Runtime dependency
    github.com/jackc/pgx/v5 v5.5.1           // Runtime dependency
    github.com/stretchr/testify v1.8.4        // Test dependency (but Go includes all)
)

// NOTE: Go does not distinguish dev vs prod dependencies.
// All dependencies are included in go.mod.
// The Go build tool only compiles what's imported.
// Test dependencies are only used when running `go test`.
```

---

## 3. Lockfiles

### Lockfile Comparison

```
┌────────────────────────┬─────────────────────┬──────────────────────────┐
│ Package Manager        │ Lockfile             │ Install Command (frozen)  │
├────────────────────────┼─────────────────────┼──────────────────────────┤
│ npm                    │ package-lock.json    │ npm ci                    │
│ yarn (classic)         │ yarn.lock            │ yarn install --frozen     │
│ yarn (berry/modern)    │ yarn.lock            │ yarn install --immutable  │
│ pnpm                   │ pnpm-lock.yaml       │ pnpm install --frozen     │
│ bun                    │ bun.lockb            │ bun install --frozen      │
│ pip                    │ requirements.txt     │ pip install -r req.txt    │
│ Poetry                 │ poetry.lock          │ poetry install --no-update│
│ Pipenv                 │ Pipfile.lock         │ pipenv sync               │
│ uv                     │ uv.lock              │ uv sync --frozen          │
│ Go                     │ go.sum               │ go mod download           │
│ Cargo (Rust)           │ Cargo.lock           │ cargo build --locked      │
│ Bundler (Ruby)         │ Gemfile.lock         │ bundle install --frozen   │
│ Composer (PHP)         │ composer.lock        │ composer install --no-dev │
│ NuGet (.NET)           │ packages.lock.json   │ dotnet restore --locked   │
│ Gradle (Java)          │ gradle.lockfile      │ --write-locks             │
└────────────────────────┴─────────────────────┴──────────────────────────┘
```

### Lockfile Rules

```
RULE: ALWAYS commit lockfiles to version control.
RULE: ALWAYS use frozen install in CI/CD (--frozen-lockfile, npm ci, etc.).
RULE: NEVER manually edit lockfiles — use package manager commands.
RULE: When lockfile conflicts occur in PRs, delete lockfile and regenerate
      (npm install, pnpm install) from the merged package.json.

WHY LOCKFILES MATTER:
  Without lockfile: npm install lodash@^4.17.0
    → Dev A gets 4.17.20 (Tuesday)
    → Dev B gets 4.17.21 (Wednesday, lodash released patch)
    → CI gets 4.17.21 (Thursday)
    → "Works on my machine" bug

  With lockfile: npm ci
    → Everyone gets EXACTLY 4.17.20 (locked version)
    → Reproducible builds across all machines and CI
```

---

## 4. Workspace / Monorepo Dependencies

### pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// packages/ui/package.json
{
  "name": "@myorg/ui",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0"
  }
}

// apps/web/package.json
{
  "name": "@myorg/web",
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/shared": "workspace:^1.0.0"
  }
}
```

```
RULE: Use workspace: protocol for internal packages.
  "workspace:*"      → Any version (always uses local)
  "workspace:^1.0.0" → Semver range (still uses local, published version must match)

RULE: NEVER use file: protocol for internal packages.
  ❌ "@myorg/ui": "file:../../packages/ui"  ← Breaks on publish
  ✅ "@myorg/ui": "workspace:*"             ← Works locally AND on publish
```

### npm Workspaces

```json
// Root package.json
{
  "name": "my-monorepo",
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### yarn Workspaces

```json
// Root package.json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

---

## 5. Path Aliases

### TypeScript Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@config/*": ["src/config/*"],
      "@tests/*": ["tests/*"]
    }
  }
}
```

```typescript
// Usage — clean imports
import { OrderService } from '@/features/orders/orders.service';
import { config } from '@/config';
import { createOrder } from '@tests/factories/order.factory';

// Instead of relative path hell:
import { OrderService } from '../../../features/orders/orders.service';
```

### Vite Path Aliases

```typescript
// vite.config.ts
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
});
```

### Python Import Paths

```python
# Python doesn't have path aliases in the same way.
# Use src layout + editable install instead:

# pyproject.toml
[project]
name = "myapp"

[tool.setuptools.packages.find]
where = ["src"]

# Install in editable mode:
# pip install -e .

# Now you can import:
from myapp.features.orders import OrderService
# Instead of:
from src.features.orders import OrderService
```

---

## 6. Dependency Security

### Vulnerability Scanning

```bash
# npm audit
npm audit                            # Report vulnerabilities
npm audit fix                        # Auto-fix where possible
npm audit --production               # Only check production deps

# pnpm audit
pnpm audit

# Python
pip-audit                            # pip-audit package
safety check                         # safety package

# Go
govulncheck ./...                    # Official Go vulnerability checker

# .NET
dotnet list package --vulnerable

# Rust
cargo audit
```

### Automated Dependency Updates

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      production-dependencies:
        dependency-type: "production"
      development-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
    open-pull-requests-limit: 10
```

```json
// renovate.json (alternative to Dependabot)
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":automergeMinor",
    ":automergeDigest",
    "group:allNonMajor"
  ],
  "packageRules": [
    {
      "matchDepTypes": ["devDependencies"],
      "automerge": true
    }
  ]
}
```

---

## 7. Vendor Directory Patterns

### Go Vendoring

```
project/
├── vendor/                         ← Committed copy of all dependencies
│   ├── github.com/
│   │   └── gin-gonic/gin/
│   └── modules.txt                 ← Vendor metadata
├── go.mod
├── go.sum
└── main.go

# Commands:
go mod vendor                       # Copy deps to vendor/
go build -mod=vendor ./...          # Build using vendor/

# WHEN to vendor:
# ✅ Compliance requirements (must have all source available)
# ✅ Air-gapped environments (no internet access in CI)
# ✅ Critical services (zero dependency on external registries)
# ❌ Most projects — use go.sum + go mod download instead
```

### Node.js — No Vendoring (Use Lockfiles)

```
RULE: NEVER commit node_modules/ to git.
RULE: Use lockfiles (package-lock.json, pnpm-lock.yaml) instead.
RULE: In CI, use npm ci or pnpm install --frozen-lockfile.
RULE: For offline/air-gapped builds, use npm pack or pnpm fetch.
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No lockfile** | "Works on my machine" — different versions per dev | Commit lockfile, use `--frozen-lockfile` in CI |
| **Wrong dependency category** | typescript/jest in `dependencies`, bloating prod bundle | Audit categories: build/test tools go in `devDependencies` |
| **Relative path deps** | `"@myorg/ui": "file:../../packages/ui"` breaks on publish | Use `workspace:*` protocol for internal packages |
| **No vulnerability scanning** | Known CVEs in production dependencies | Run `npm audit`, `pip-audit`, `cargo audit` in CI |
| **node_modules committed** | 500MB+ repo, slow clone, merge conflicts | Add `node_modules/` to .gitignore, use lockfiles |
| **Phantom dependencies** | Code imports package not in package.json (hoisted from elsewhere) | Use pnpm (strict) or check with `depcheck` |
| **Star versions** | `"lodash": "*"` — any version, completely unpinned | Use caret `^` or tilde `~`, never `*` |
| **No Dependabot/Renovate** | Dependencies 2+ years out of date, accumulating vulnerabilities | Set up automated dependency update PRs |
| **Mixed package managers** | package-lock.json AND yarn.lock in same project | Pick ONE package manager, add `engines` field |
| **Deep relative imports** | `import from '../../../../shared/utils'` | Configure path aliases (`@/`, `@shared/`) in tsconfig |

---

## 9. Enforcement Checklist

- [ ] **Lockfile committed** — package-lock.json, pnpm-lock.yaml, yarn.lock in git
- [ ] **Frozen install in CI** — `npm ci`, `pnpm install --frozen-lockfile`
- [ ] **Correct categories** — runtime in `dependencies`, tools in `devDependencies`
- [ ] **Path aliases configured** — `@/` prefix instead of deep relative imports
- [ ] **Vulnerability scanning** — `npm audit` or equivalent runs in CI
- [ ] **Dependabot or Renovate** — automated dependency update PRs configured
- [ ] **Single package manager** — only one lockfile format in the project
- [ ] **Workspace protocol** — internal packages use `workspace:*`, not `file:`
- [ ] **No phantom deps** — every import has a corresponding package.json entry
- [ ] **engines field set** — minimum Node/npm/pnpm version specified in package.json
- [ ] **No committed node_modules** — node_modules/ in .gitignore
- [ ] **.npmrc configured** — strict peer dependencies, registry settings
