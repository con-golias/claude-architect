# Monorepo Package Management

> **AI Plugin Directive:** When managing dependencies in a monorepo, ALWAYS use this guide. Apply workspace protocol for internal dependencies, centralized lockfile, strict dependency resolution, and hoisting strategies specific to the package manager. Covers pnpm (RECOMMENDED), npm, yarn, and Bun workspaces with full configuration examples.

**Core Rule: Use pnpm workspaces (RECOMMENDED) for all monorepos. ALWAYS use `workspace:*` protocol for internal package references. NEVER publish internal packages to a registry for monorepo-internal consumption. ONE lockfile at root, committed to git. Each package declares its OWN dependencies in its own `package.json`. Root `package.json` contains ONLY workspace orchestration tools.**

---

## 1. Package Manager Comparison

| Feature | pnpm | npm | Yarn (Berry/v4) | Bun |
|---------|------|-----|-----------------|-----|
| **Workspace support** | Excellent | Good (v7+) | Excellent | Good |
| **Disk efficiency** | Excellent (content-addressable store) | Poor (copies to each node_modules) | Good (PnP) or Good (node_modules) | Good |
| **Install speed** | Fast | Moderate | Fast (PnP), moderate (node_modules) | Fastest |
| **Strictness** | Strict by default (no phantom deps) | Loose (hoists everything) | Strict with PnP, moderate otherwise | Loose |
| **Lockfile** | `pnpm-lock.yaml` | `package-lock.json` | `yarn.lock` | `bun.lockb` (binary) |
| **Lockfile readability** | Good (YAML) | Good (JSON) | Good (custom format) | Poor (binary) |
| **Hoisting control** | Fine-grained (`.npmrc`) | Basic | PnP eliminates hoisting | Basic |
| **Monorepo maturity** | Excellent | Good | Excellent | Growing |
| **Phantom dep protection** | Yes (default) | No | Yes (with PnP) | No |
| **Content-addressable** | Yes (global store) | No | Yes (with PnP) | No |
| **Filter by package** | `--filter @myorg/web` | `-w @myorg/web` | `yarn workspace @myorg/web` | `--filter @myorg/web` |
| **Peer dep auto-install** | Configurable | Yes (v7+) | Configurable | Yes |
| **Recommendation** | **Primary choice for monorepos** | Acceptable for small monorepos | Use if already adopted | Not yet recommended for monorepos |

---

## 2. pnpm Workspace Setup (RECOMMENDED)

### 2.1 Configuration Files

```yaml
# pnpm-workspace.yaml — defines workspace packages
packages:
  - "apps/*"
  - "apps/**/*"
  - "packages/*"
  - "packages/**/*"
  - "config/*"
  - "tooling/*"
```

```ini
# .npmrc — pnpm configuration (CRITICAL for monorepos)

# Strict mode: each package can ONLY import declared dependencies
# This is pnpm's DEFAULT and biggest advantage over npm/yarn
shamefully-hoist=false

# Hoist specific packages that need to be at root (rare exceptions)
# Only use for packages that MUST be at root (e.g., some Babel plugins)
# public-hoist-pattern[]=@babel/*

# Auto-install peer dependencies
auto-install-peers=true

# Don't fail on missing peer deps (some packages have overly strict peers)
strict-peer-dependencies=false

# Link workspace packages to each other
link-workspace-packages=true

# Save exact versions (no ^ or ~ prefix)
save-exact=true

# Use lockfile for reproducible installs
frozen-lockfile=true

# Registry configuration (for private packages)
# @myorg:registry=https://npm.pkg.github.com
```

```json
// Root package.json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\"",
    "clean": "turbo clean && rm -rf node_modules",
    "prepare": "husky",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "turbo build --filter=./packages/* && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.2.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml}": ["prettier --write"]
  }
}
```

### 2.2 pnpm CLI Commands for Monorepos

```bash
# ──────────────────────────────────────────────────────
# INSTALLATION
# ──────────────────────────────────────────────────────

# Install all dependencies in all workspaces
pnpm install

# Install with frozen lockfile (CI — ALWAYS use this in CI)
pnpm install --frozen-lockfile

# ──────────────────────────────────────────────────────
# ADDING DEPENDENCIES
# ──────────────────────────────────────────────────────

# Add dependency to specific package
pnpm add react --filter @myorg/web

# Add dev dependency to specific package
pnpm add -D vitest --filter @myorg/ui

# Add workspace dependency (internal package)
pnpm add @myorg/shared-types --filter @myorg/web --workspace
# Result in package.json: "@myorg/shared-types": "workspace:*"

# Add dev dependency to workspace root
pnpm add -Dw turbo

# Add dependency to ALL packages matching a pattern
pnpm add typescript -D --filter "./packages/*"

# ──────────────────────────────────────────────────────
# REMOVING DEPENDENCIES
# ──────────────────────────────────────────────────────

# Remove from specific package
pnpm remove lodash --filter @myorg/web

# ──────────────────────────────────────────────────────
# RUNNING SCRIPTS
# ──────────────────────────────────────────────────────

# Run script in specific package
pnpm --filter @myorg/web dev

# Run script in ALL packages that have it
pnpm -r build
pnpm -r test
pnpm -r lint

# Run script in ALL packages in parallel
pnpm -r --parallel dev

# Run script in packages matching a glob
pnpm --filter "./packages/*" build
pnpm --filter "./apps/*" test

# Run in package and all its dependencies
pnpm --filter @myorg/web... build

# Run in package's dependencies only (not the package itself)
pnpm --filter "...@myorg/web" build

# ──────────────────────────────────────────────────────
# WORKSPACE INFORMATION
# ──────────────────────────────────────────────────────

# List all workspace packages
pnpm -r ls --depth -1

# List packages with their dependencies
pnpm why react --filter @myorg/web

# Check for outdated dependencies
pnpm -r outdated

# Update dependencies interactively
pnpm -r update --interactive --latest
```

---

## 3. Internal Dependency Protocol

### 3.1 workspace: Protocol

```json
// packages/ui/package.json
{
  "dependencies": {
    "@myorg/shared-types": "workspace:*",
    "@myorg/utils": "workspace:*"
  }
}
```

```
workspace:* Protocol Explained:

  "workspace:*"   → Uses the current workspace version (RECOMMENDED)
  "workspace:^"   → Uses compatible workspace version (^x.y.z when published)
  "workspace:~"   → Uses approximate workspace version (~x.y.z when published)
  "workspace:1.0.0" → Pins to specific workspace version

  ALWAYS use workspace:* for monorepo-internal packages.

  What happens when publishing:
    "workspace:*" in monorepo → "@myorg/utils": "1.3.0" when published
    The workspace: protocol is automatically resolved to real version numbers.

  What happens at install time:
    pnpm creates symlinks from packages/ui/node_modules/@myorg/shared-types
    → ../../shared-types/
    No npm publish/install cycle needed.
```

### 3.2 Internal Package Resolution

```
How pnpm resolves workspace packages:

  1. packages/ui declares: "@myorg/shared-types": "workspace:*"
  2. pnpm finds @myorg/shared-types in workspace (packages/shared-types)
  3. pnpm creates symlink:
     packages/ui/node_modules/@myorg/shared-types → ../../shared-types
  4. When packages/ui imports "@myorg/shared-types":
     - Resolves to packages/shared-types/src/index.ts (via main field)
     - No build step needed if "main": "./src/index.ts"
     - Build step needed if "main": "./dist/index.js"

  "Just-in-time" packages (no build step):
    Set "main": "./src/index.ts" in package.json
    → Consumers transpile the source directly (Next.js, Vite do this)
    → Fastest development experience (no build:watch needed)
    → RECOMMENDED for monorepo-internal packages

  Pre-built packages:
    Set "main": "./dist/index.js" in package.json
    → Must run build before consumers can use
    → turbo.json: "build": { "dependsOn": ["^build"] } handles this
    → Required for packages published to npm
```

---

## 4. Phantom Dependencies

```
PROBLEM: Phantom dependencies

  Scenario (npm/yarn classic hoisting):
    packages/ui depends on: react, @myorg/shared-types
    packages/api depends on: lodash, @myorg/shared-types

    npm hoists ALL to root node_modules:
      node_modules/
      ├── react/
      ├── lodash/          ← available to ALL packages
      └── @myorg/shared-types/

    packages/ui can now do:
      import lodash from "lodash";  // WORKS! But ui doesn't declare lodash

    This is a PHANTOM DEPENDENCY.
    It works locally but BREAKS:
      - When lodash is removed from packages/api
      - In Docker (where only ui's declared deps are installed)
      - In any strict environment

SOLUTION: pnpm's strict isolation

  pnpm creates per-package node_modules with symlinks:
    packages/ui/node_modules/
    ├── react → ../../../.pnpm/react@18.0.0/node_modules/react
    └── @myorg/shared-types → ../../shared-types

    packages/ui CANNOT import lodash — it's not in its node_modules.
    import lodash from "lodash"; // ERROR: Module not found

  This catches phantom dependencies at development time,
  not in production when it's too late.
```

### Handling Phantom Dependencies When Migrating

```bash
# When migrating from npm/yarn to pnpm, you may have phantom deps.
# Find them:

pnpm install
# Build will fail with "Module not found" for phantom deps

# Fix: Add missing dependencies explicitly
pnpm add lodash --filter @myorg/ui  # If ui actually uses lodash

# Or use shamefully-hoist temporarily (NOT recommended long-term)
# .npmrc
shamefully-hoist=true  # Only during migration, remove ASAP
```

---

## 5. npm Workspaces

```json
// package.json (npm workspaces)
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "config/*"
  ],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev"
  }
}
```

```bash
# npm workspace commands
npm install                                    # Install all workspaces
npm run build -w @myorg/web                    # Run in specific workspace
npm run build --workspaces                     # Run in all workspaces
npm run build --workspaces --if-present        # Skip if script doesn't exist
npm install react -w @myorg/web                # Add dep to specific workspace
npm ls --all --workspaces                      # List all deps

# npm limitations vs pnpm:
# ❌ No strict phantom dep protection
# ❌ No content-addressable store (copies deps)
# ❌ No fine-grained hoisting control
# ❌ Slower install times
# ✅ Works out of the box (no extra install)
# ✅ Simpler mental model for small teams
```

---

## 6. Yarn (Berry/v4) Workspaces

```json
// package.json (yarn workspaces)
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "yarn@4.5.0",
  "workspaces": [
    "apps/*",
    "packages/*",
    "config/*"
  ]
}
```

```yaml
# .yarnrc.yml
nodeLinker: node-modules           # or "pnp" for Plug'n'Play

# PnP mode (zero-installs):
# nodeLinker: pnp
# Stores deps in .yarn/cache as zip files
# No node_modules at all
# Fastest installs, smallest disk footprint
# BUT: requires IDE plugins, some packages incompatible

enableGlobalCache: true

# Workspace protocol
# Yarn uses "workspace:*" protocol (same as pnpm)
```

```bash
# Yarn workspace commands
yarn install                                   # Install all workspaces
yarn workspace @myorg/web build               # Run in specific workspace
yarn workspaces foreach -A run build          # Run in all workspaces
yarn workspace @myorg/web add react           # Add dep to workspace
yarn add turbo -DW                            # Add to root (dev)

# Yarn v4 advantages:
# ✅ PnP mode eliminates node_modules entirely
# ✅ Zero-installs (commit .yarn/cache to git)
# ✅ Strict mode catches phantom deps
# ❌ PnP requires IDE configuration
# ❌ Some packages incompatible with PnP
# ❌ Binary lockfile harder to review
```

---

## 7. Dependency Version Management

### 7.1 Keeping Dependencies in Sync

```bash
# Problem: Different packages use different versions of React
# packages/ui: react@18.2.0
# apps/web: react@18.3.0
# apps/admin: react@19.0.0

# Solution 1: pnpm catalog (pnpm v9+)
# pnpm-workspace.yaml
catalog:
  react: "^19.0.0"
  react-dom: "^19.0.0"
  typescript: "^5.7.0"
  vitest: "^2.0.0"

# In any package.json:
{
  "dependencies": {
    "react": "catalog:",           # Resolves to ^19.0.0
    "react-dom": "catalog:"       # Resolves to ^19.0.0
  }
}

# Solution 2: Syncpack (any package manager)
npx syncpack list-mismatches       # Find version mismatches
npx syncpack fix-mismatches        # Auto-fix to highest version

# syncpack.config.ts
export default {
  versionGroups: [
    {
      label: "Use workspace protocol for internal packages",
      dependencies: ["@myorg/*"],
      dependencyTypes: ["prod", "dev"],
      pinVersion: "workspace:*",
    },
    {
      label: "Pin React to same version everywhere",
      dependencies: ["react", "react-dom"],
      policy: "same",
    },
  ],
};

# Solution 3: Renovate/Dependabot with group updates
# .github/renovate.json
{
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "groupName": "React",
      "matchPackageNames": ["react", "react-dom", "@types/react", "@types/react-dom"],
      "matchUpdateTypes": ["minor", "patch"]
    }
  ]
}
```

### 7.2 Overrides and Resolutions

```json
// Root package.json — force specific versions
{
  "pnpm": {
    "overrides": {
      "braces": ">=3.0.3",          // Security fix for all packages
      "semver": ">=7.5.2",          // Security fix
      "lodash": ">=4.17.21"         // Security fix
    },
    "peerDependencyRules": {
      "ignoreMissing": [
        "@babel/*"                   // Ignore missing Babel peer deps
      ],
      "allowedVersions": {
        "react": "19"               // Allow React 19 even if peer says 18
      }
    }
  }
}

// npm overrides
{
  "overrides": {
    "braces": ">=3.0.3"
  }
}

// yarn resolutions
{
  "resolutions": {
    "braces": ">=3.0.3"
  }
}
```

---

## 8. Publishing Packages from Monorepo

```
For packages that ARE published to npm (open source, shared across orgs):

1. Use Changesets for versioning:

# .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@myorg/web", "@myorg/api"]      // Don't version apps
}

# Workflow:
pnpm changeset                    # Create changeset (what changed, semver)
pnpm changeset version            # Apply version bumps
pnpm changeset publish            # Publish to npm

# CI automation:
# .github/workflows/release.yml uses @changesets/action

2. For packages NOT published (monorepo-internal only):
   - Set "private": true in package.json
   - Use "version": "0.0.0" (version doesn't matter)
   - Use workspace:* protocol (no versioning needed)
   - NEVER set up publishing
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Phantom dependencies | Import works locally, fails in CI/Docker | Use pnpm strict mode (default) |
| No lockfile committed | "Works on my machine" syndrome | ALWAYS commit lockfile, use `--frozen-lockfile` in CI |
| Mixed package managers | npm + yarn + pnpm in same repo | Standardize on ONE, use `packageManager` field |
| Publishing internal packages | Internal lib on npm registry | Use `workspace:*` protocol |
| All deps at root | Root package.json has application deps | Per-package dependencies only |
| No `private: true` on root | Accidental publish of root workspace | Root + all internal packages MUST be `"private": true` |
| Using `^` for internal packages | `"@myorg/ui": "^1.0.0"` instead of workspace | Use `"workspace:*"` for ALL internal references |
| `shamefully-hoist=true` as permanent | Defeats purpose of pnpm strict isolation | Only during migration, remove ASAP |
| No `packageManager` field | Different pnpm versions across team | Add `"packageManager": "pnpm@9.15.0"` to root |
| Inconsistent dependency versions | React 18 in one package, React 19 in another | pnpm catalog or syncpack to enforce consistency |
| `npm install` in CI (not frozen) | Non-reproducible builds, lockfile changes | ALWAYS `pnpm install --frozen-lockfile` in CI |
| Root devDependencies bloat | ESLint plugins in root used by no workspace | Move to config packages or per-package deps |

---

## 10. Enforcement Checklist

- [ ] Single package manager chosen — pnpm RECOMMENDED for monorepos
- [ ] `pnpm-workspace.yaml` defines all workspace package locations
- [ ] `workspace:*` protocol for ALL internal package references
- [ ] Root `package.json` has `"private": true` and `"packageManager"` field
- [ ] All internal packages have `"private": true`
- [ ] Lockfile committed — NEVER in `.gitignore`
- [ ] CI uses `--frozen-lockfile` — prevent unexpected dependency changes
- [ ] `.npmrc` configured — `shamefully-hoist=false`, strict resolution
- [ ] Per-package `package.json` — own dependencies and scripts
- [ ] `engines` field set — enforce Node.js and pnpm versions
- [ ] Dependency versions synchronized — pnpm catalog or syncpack
- [ ] Overrides for security fixes — audit regularly
- [ ] Changesets configured — for published packages only
- [ ] No phantom dependencies — pnpm strict mode catches these
- [ ] Root has only orchestration deps — turbo, husky, prettier, changesets
