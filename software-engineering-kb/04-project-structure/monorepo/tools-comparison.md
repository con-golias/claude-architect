# Monorepo Tools Comparison

> **AI Plugin Directive:** When the user needs to choose a monorepo tool, ALWAYS use this comparison. Recommend based on ecosystem, project size, team needs, and feature requirements. Provides deep configuration examples for Nx, Turborepo, Bazel, Rush, Lerna, and Pants. ALWAYS recommend Nx (feature-rich) or Turborepo (simple) for JavaScript/TypeScript projects.

**Core Rule: ALWAYS use a monorepo tool. NEVER manage a multi-package repository manually with custom scripts. The tool handles the dependency graph, affected detection, caching, and task orchestration that make monorepos viable. For JS/TS: use Nx (enterprise, code generation, boundaries) or Turborepo (simple, fast, Vercel ecosystem). For multi-language at extreme scale: use Bazel.**

---

## 1. Tool Comparison Matrix

| Feature | Nx | Turborepo | Bazel | Rush | Lerna | Pants |
|---------|-----|-----------|-------|------|-------|-------|
| **Language** | TypeScript | Go | Java/Starlark | TypeScript | TypeScript | Python/Rust |
| **Primary ecosystem** | JS/TS (any lang via plugins) | JS/TS only | Any language | JS/TS only | JS/TS only | Python, Go, Java, Scala |
| **Task runner** | Advanced (topological) | Simple (topological) | Hermetic (sandboxed) | Phased (per policy) | Via npm scripts | Hermetic |
| **Dependency graph** | Automatic + visual | Automatic | Explicit (BUILD files) | Automatic | Basic | Automatic |
| **Affected detection** | Git-based (precise) | Git-based | File-based (precise) | Git-based | Git-based (basic) | File-based (precise) |
| **Local caching** | Yes (hash-based) | Yes (hash-based) | Yes (content-addressable) | Yes | No | Yes (content-addressable) |
| **Remote caching** | Nx Cloud (free tier) | Vercel (free tier) | Custom (S3/GCS) | Azure/S3 | No | Yes (custom) |
| **Distributed execution** | Nx Cloud DTE | No | Remote execution | No | No | Remote execution |
| **Code generation** | Extensive (generators) | Basic (turbo gen) | Rules/macros | No | No | No |
| **Module boundaries** | Yes (ESLint rules) | No | Visibility rules | Approved packages | No | No |
| **Plugin system** | Rich (community plugins) | No | Rules ecosystem | Plugins (limited) | No | Backends |
| **Incremental adoption** | Yes (add to existing) | Yes (add to existing) | Full commitment | Full commitment | Yes | Moderate |
| **Configuration** | `nx.json` + `project.json` | `turbo.json` | `BUILD` files per pkg | `rush.json` | `lerna.json` | `BUILD` files + `pants.toml` |
| **Learning curve** | Medium | Low | High | Medium-High | Low | Medium |
| **Maintenance** | Nrwl (dedicated company) | Vercel | Google | Microsoft | Nrwl (absorbed) | Toolchain Labs |
| **Stability** | Very stable | Stable | Very stable | Stable | Maintenance mode | Stable |
| **Best for** | Enterprise JS/TS | Simple JS/TS, Vercel | Extreme scale, multi-lang | Enterprise JS (Microsoft) | Legacy (migrate away) | Python/Go monorepos |

---

## 2. Decision Tree

```
START: What is your primary stack?
│
├── JavaScript/TypeScript?
│   │
│   ├── Need code generation + module boundaries + plugins?
│   │   └── Nx (RECOMMENDED for enterprise)
│   │
│   ├── Want simplest possible setup + Vercel deployment?
│   │   └── Turborepo
│   │
│   ├── Microsoft ecosystem + strict publishing policies?
│   │   └── Rush
│   │
│   └── Currently using Lerna?
│       └── Migrate to Nx (Lerna v7+ uses Nx under the hood anyway)
│
├── Multi-language (JS + Python + Go + Java)?
│   │
│   ├── >500 developers, Google-scale reproducibility?
│   │   └── Bazel
│   │
│   ├── Python-heavy + some Go/Java?
│   │   └── Pants
│   │
│   └── JS-primary with some other languages?
│       └── Nx (supports any language via plugins/targets)
│
├── Pure Python monorepo?
│   └── Pants (or Nx with @nx/python)
│
├── Pure Go monorepo?
│   └── Go modules with workspace mode (go.work)
│       └── For build orchestration: Pants or Bazel
│
└── Deploying to Vercel?
    └── Turborepo (native integration, zero config)
```

---

## 3. Nx — Deep Configuration

### nx.json
```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": [
      "{workspaceRoot}/tsconfig.base.json",
      "{workspaceRoot}/.eslintrc.json"
    ],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/.eslintrc.json"
    ]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "test": {
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"],
      "cache": true
    },
    "lint": {
      "inputs": ["default", "{workspaceRoot}/.eslintrc.json"],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "dev": {
      "cache": false
    }
  },
  "defaultBase": "main",
  "nxCloudAccessToken": "your-nx-cloud-token",
  "parallel": 3,
  "cacheDirectory": ".nx/cache"
}
```

### project.json (per-package configuration)
```json
{
  "name": "@myorg/ui",
  "sourceRoot": "packages/ui/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:ui"],
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{projectRoot}/dist"],
      "options": {
        "outputPath": "packages/ui/dist",
        "main": "packages/ui/src/index.ts",
        "tsConfig": "packages/ui/tsconfig.lib.json"
      }
    },
    "test": {
      "executor": "@nx/vite:test",
      "outputs": ["{projectRoot}/coverage"],
      "options": {
        "config": "packages/ui/vitest.config.ts"
      }
    },
    "storybook": {
      "executor": "@nx/storybook:storybook",
      "options": {
        "configDir": "packages/ui/.storybook",
        "port": 4400
      }
    }
  }
}
```

### Module Boundary Enforcement
```json
// .eslintrc.json (root)
{
  "root": true,
  "plugins": ["@nx"],
  "overrides": [
    {
      "files": ["*.ts", "*.tsx"],
      "rules": {
        "@nx/enforce-module-boundaries": [
          "error",
          {
            "enforceBuildableLibDependency": true,
            "allow": [],
            "depConstraints": [
              {
                "sourceTag": "type:app",
                "onlyDependOnLibsWithTags": ["type:lib", "type:ui", "type:util"]
              },
              {
                "sourceTag": "type:lib",
                "onlyDependOnLibsWithTags": ["type:lib", "type:util"]
              },
              {
                "sourceTag": "type:ui",
                "onlyDependOnLibsWithTags": ["type:ui", "type:util"]
              },
              {
                "sourceTag": "type:util",
                "onlyDependOnLibsWithTags": ["type:util"]
              },
              {
                "sourceTag": "scope:web",
                "onlyDependOnLibsWithTags": ["scope:web", "scope:shared"]
              },
              {
                "sourceTag": "scope:api",
                "onlyDependOnLibsWithTags": ["scope:api", "scope:shared"]
              },
              {
                "sourceTag": "scope:shared",
                "onlyDependOnLibsWithTags": ["scope:shared"]
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### Nx CLI Commands
```bash
# Create workspace
npx create-nx-workspace@latest my-monorepo --preset=ts

# Generate applications
nx g @nx/next:app web --directory=apps/web
nx g @nx/nest:app api --directory=apps/api
nx g @nx/react-native:app mobile --directory=apps/mobile

# Generate libraries
nx g @nx/js:lib shared-types --directory=packages/shared-types
nx g @nx/react:lib ui --directory=packages/ui --component=false

# Run tasks
nx build web                        # Build single project
nx affected -t build                # Build only affected projects
nx run-many -t build                # Build all projects
nx run-many -t build --parallel=5   # Build all, 5 in parallel

# Visualize
nx graph                            # Interactive dependency graph
nx graph --affected                 # Show only affected
nx graph --file=output.json         # Export as JSON

# Code generation
nx g @nx/react:component Button --project=ui --export
nx g @nx/nest:resource users --project=api

# Migrations (when upgrading Nx)
nx migrate latest
nx migrate --run-migrations
```

---

## 4. Turborepo — Deep Configuration

### turbo.json (v2 syntax)
```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "globalDependencies": [
    "**/.env.*local",
    "tsconfig.base.json"
  ],
  "globalEnv": ["NODE_ENV", "CI"],
  "globalPassThroughEnv": ["AWS_REGION", "VERCEL_URL"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "!**/*.test.*", "!**/*.spec.*"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "env": ["DATABASE_URL", "NEXT_PUBLIC_API_URL"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "!**/*.test.*"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$"],
      "outputs": ["coverage/**"],
      "env": ["DATABASE_URL"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    },
    "db:push": {
      "cache": false,
      "interactive": true
    }
  }
}
```

### Package-specific turbo.json overrides
```json
// apps/web/turbo.json — override for specific app
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": {
      "env": [
        "NEXT_PUBLIC_API_URL",
        "NEXT_PUBLIC_ANALYTICS_ID",
        "NEXT_PUBLIC_STRIPE_KEY"
      ],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    }
  }
}
```

### Turborepo CLI Commands
```bash
# Create workspace
npx create-turbo@latest my-monorepo

# Run tasks
turbo build                          # Build all (with caching)
turbo build --filter=@myorg/web      # Build specific package
turbo build --filter=@myorg/web...   # Build package + its dependencies
turbo build --filter=...[HEAD~1]     # Build affected since last commit
turbo build --dry-run               # Show what would run
turbo build --graph                 # Output dependency graph

# Development
turbo dev --filter=@myorg/web        # Dev server for specific app
turbo dev                            # Dev all apps (parallel)

# Remote caching
npx turbo login                      # Authenticate with Vercel
npx turbo link                       # Link to Vercel project
turbo build --remote-only           # Only use remote cache

# Generators
turbo gen workspace --name new-package --type package
turbo gen run                        # Run custom generators

# Pruning (for Docker)
turbo prune @myorg/web               # Create minimal monorepo for Docker
  # Output: out/
  #   ├── full/     (full source of web + deps)
  #   ├── json/     (package.json files only)
  #   └── pnpm-lock.yaml
```

### Turborepo Docker Integration
```dockerfile
# Dockerfile (using turbo prune)
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @myorg/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@myorg/web

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/apps/web/.next/standalone ./
COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

---

## 5. Bazel — Configuration Overview

### WORKSPACE (root)
```python
# WORKSPACE
workspace(name = "my_monorepo")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

# Node.js rules
http_archive(
    name = "build_bazel_rules_nodejs",
    sha256 = "...",
    urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.8.0/rules_nodejs-5.8.0.tar.gz"],
)

# Python rules
http_archive(
    name = "rules_python",
    sha256 = "...",
    strip_prefix = "rules_python-0.31.0",
    url = "https://github.com/bazelbuild/rules_python/releases/download/0.31.0/rules_python-0.31.0.tar.gz",
)

# Go rules
http_archive(
    name = "io_bazel_rules_go",
    sha256 = "...",
    urls = ["https://github.com/bazelbuild/rules_go/releases/download/v0.46.0/rules_go-v0.46.0.zip"],
)
```

### BUILD file (per package)
```python
# packages/shared-types/BUILD.bazel
load("@build_bazel_rules_nodejs//:index.bzl", "js_library")

js_library(
    name = "shared-types",
    srcs = glob(["src/**/*.ts"]),
    visibility = ["//visibility:public"],
    deps = [
        "@npm//zod",
    ],
)

# packages/ui/BUILD.bazel
load("@build_bazel_rules_nodejs//:index.bzl", "js_library")

js_library(
    name = "ui",
    srcs = glob(["src/**/*.tsx", "src/**/*.ts"]),
    visibility = [
        "//apps/web:__pkg__",       # Only web app can use this
        "//apps/admin:__pkg__",     # And admin app
    ],
    deps = [
        "//packages/shared-types",
        "@npm//react",
        "@npm//react-dom",
    ],
)
```

```
When to use Bazel:
  ✅ 500+ developers
  ✅ Multi-language (JS + Python + Go + Java + C++)
  ✅ Need hermetic/reproducible builds
  ✅ Need remote execution (distribute builds across machines)
  ✅ Google-scale requirements

When NOT to use Bazel:
  ❌ Small team (<50 developers)
  ❌ JS/TS only (Nx/Turborepo is much simpler)
  ❌ Don't have dedicated build infrastructure team
  ❌ Steep learning curve is unacceptable
```

---

## 6. Rush — Configuration Overview

```json
// rush.json
{
  "$schema": "https://developer.microsoft.com/json-schemas/rush/v5/rush.schema.json",
  "rushVersion": "5.120.0",
  "pnpmVersion": "9.15.0",
  "nodeSupportedVersionRange": ">=20.0.0",
  "projectFolderMinDepth": 2,
  "projectFolderMaxDepth": 2,
  "repository": {
    "url": "https://github.com/myorg/monorepo"
  },
  "projects": [
    { "packageName": "@myorg/web", "projectFolder": "apps/web", "reviewCategory": "production" },
    { "packageName": "@myorg/api", "projectFolder": "apps/api", "reviewCategory": "production" },
    { "packageName": "@myorg/ui", "projectFolder": "packages/ui", "reviewCategory": "libraries" },
    { "packageName": "@myorg/utils", "projectFolder": "packages/utils", "reviewCategory": "libraries" }
  ],
  "approvedPackagesPolicy": {
    "reviewCategories": ["production", "libraries"],
    "ignoredNpmScopes": ["@types"]
  }
}
```

```
Rush key features:
  - Approved packages policy (enterprise governance)
  - Phased builds with --to and --from flags
  - rush change (changefile-based versioning)
  - Strict lockfile policies
  - Used by Microsoft (SharePoint, OneDrive, Teams)

When to use Rush:
  ✅ Microsoft ecosystem
  ✅ Need strict package approval policies
  ✅ Enterprise governance requirements
  ✅ Already using Rush

When NOT to use Rush:
  ❌ Small team (overkill)
  ❌ Want code generation (Rush doesn't have it)
  ❌ Want module boundary enforcement (Rush doesn't have it)
  ❌ Prefer simpler tooling (use Turborepo instead)
```

---

## 7. Performance Comparison

```
Benchmark: 50-package monorepo, 5 tasks per package

                        Nx          Turborepo    Bazel       Rush
─────────────────────── ──────────  ──────────   ──────────  ──────────
Cold build (no cache)   45s         42s          55s*        48s
Warm build (local)      2s          2s           1s          3s
Warm build (remote)     5s          4s           3s          6s
Affected (3 pkgs)       8s          7s           4s          9s
Graph visualization     Built-in    CLI output   External    External
Startup time            ~200ms      ~100ms       ~500ms      ~300ms
Memory usage            Moderate    Low          High        Moderate

* Bazel cold builds are slower because of hermetic setup,
  but subsequent builds are faster due to fine-grained caching.

Key insight: For JS/TS monorepos, Nx and Turborepo perform nearly
identically. Choose based on FEATURES, not performance.

Feature advantage Nx has over Turborepo:
  + Code generation (scaffolding)
  + Module boundary enforcement
  + Plugin ecosystem (50+ plugins)
  + Distributed task execution (DTE)
  + Interactive graph visualization
  + Migration generators (nx migrate)

Feature advantage Turborepo has over Nx:
  + Simpler configuration (one turbo.json)
  + Lower learning curve
  + turbo prune (Docker optimization)
  + Vercel native integration
  + No project.json files needed
  + Faster startup (~100ms)
```

---

## 8. Migration Paths

```
Lerna → Nx:
  1. npx nx init (auto-detects Lerna workspace)
  2. Lerna v7+ already uses Nx under the hood
  3. Gradually add nx.json configuration
  4. Remove lerna.json when fully migrated

Lerna → Turborepo:
  1. Add turbo.json with pipeline configuration
  2. Update scripts: "build": "turbo build"
  3. Remove lerna.json
  4. No structural changes needed

Turborepo → Nx:
  1. npx nx init (auto-detects Turbo workspace)
  2. Nx can read turbo.json or use nx.json
  3. Add project.json files for advanced features
  4. Enable module boundaries, code generation

npm/yarn workspaces → Turborepo:
  1. npm install turbo --save-dev
  2. Create turbo.json with task definitions
  3. Replace "npm run build" with "turbo build"
  4. Done (minimal changes)

npm/yarn workspaces → Nx:
  1. npx nx init
  2. Configure nx.json
  3. Add project.json per package (optional)
  4. Enable caching and affected detection

Custom scripts → Any tool:
  1. Identify all tasks (build, test, lint, deploy)
  2. Map dependencies between tasks
  3. Choose tool based on decision tree (Section 2)
  4. Migrate tasks to tool configuration
  5. Remove custom scripts
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No monorepo tool | Custom bash scripts for builds | Adopt Nx or Turborepo immediately |
| Building everything on every PR | 30+ minute CI times | Affected-only builds + remote caching |
| No package boundaries | Any package imports anything | Nx module boundaries or ESLint import rules |
| One giant `package.json` | All deps at root, no per-package deps | Each package has own `package.json` |
| Still using Lerna standalone | No caching, basic affected detection | Migrate to Nx (Lerna uses Nx internally) |
| No CODEOWNERS | Anyone can change any package | CODEOWNERS per package directory |
| Using Bazel for small team | Massive complexity, slow onboarding | Switch to Nx or Turborepo |
| Not using remote caching | Repeated builds across CI runs | Enable Nx Cloud or Vercel Remote Cache |
| Ignoring `turbo prune` for Docker | Massive Docker images with all packages | Use `turbo prune` for minimal Docker context |
| No module boundary enforcement | Spaghetti dependencies between packages | Nx tags + `@nx/enforce-module-boundaries` |
| Wrong tool for wrong scale | Turborepo for 500+ devs, Bazel for 5 devs | Match tool to team size and requirements |

---

## 10. Enforcement Checklist

- [ ] Monorepo tool selected and configured — Nx, Turborepo, Bazel, or Rush
- [ ] Tool matches team size — Turborepo (simple), Nx (enterprise), Bazel (extreme scale)
- [ ] Remote caching enabled — NEVER rebuild unchanged packages across CI runs
- [ ] Affected detection configured — CI only builds/tests changed packages
- [ ] Task pipeline defined — correct `dependsOn` for build order
- [ ] Cache inputs/outputs specified — tasks declare what they read and produce
- [ ] Package boundaries enforced — Nx module boundaries or Bazel visibility
- [ ] CODEOWNERS configured — per package directory
- [ ] Shared configs at root — ESLint, TypeScript, Prettier
- [ ] Docker integration — `turbo prune` or equivalent for optimized images
- [ ] CI pipeline uses tool — `turbo build` or `nx affected`, NOT custom scripts
- [ ] Migration plan documented — if switching tools, phased migration with rollback
