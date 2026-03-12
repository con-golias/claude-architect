# 04 — Project Structure

> **AI Plugin Directive:** This section contains 79 comprehensive guides for structuring ANY software project. Start with `comparison-decision-guide.md` to route to the correct guide based on project type, scale, and technology stack.

---

## Navigation

### Start Here
- **[comparison-decision-guide.md](comparison-decision-guide.md)** — Master decision tree: routes you to the right guide

---

### General (Cross-Cutting)
Applies to ALL project types regardless of framework or language.

| Guide | Description |
|-------|-------------|
| [file-organization-patterns.md](general/file-organization-patterns.md) | Feature-first vs layer-first vs domain-first vs hybrid |
| [folder-naming-conventions.md](general/folder-naming-conventions.md) | kebab-case, PascalCase, per-language/framework rules |
| [config-management.md](general/config-management.md) | .env, config files, secrets, feature flags |
| [environment-management.md](general/environment-management.md) | Dev/staging/prod, environment parity |
| [testing-directory-structure.md](general/testing-directory-structure.md) | Test placement, fixtures, mocks, e2e vs unit |
| [documentation-structure.md](general/documentation-structure.md) | README patterns, /docs, ADRs, changelogs |
| [build-output-structure.md](general/build-output-structure.md) | dist/, build/, artifacts, source maps |
| [dependency-organization.md](general/dependency-organization.md) | Lockfiles, versioning, internal deps, workspaces |
| [shared-code-organization.md](general/shared-code-organization.md) | Shared utilities, common modules, internal packages |

---

### Web Applications — Frontend
Single-page applications and server-rendered frameworks.

| Guide | Description |
|-------|-------------|
| [react-spa-structure.md](web-applications/frontend/react-spa-structure.md) | Vite React, Bulletproof React pattern |
| [nextjs-structure.md](web-applications/frontend/nextjs-structure.md) | App Router, Pages Router, RSC, API routes |
| [angular-structure.md](web-applications/frontend/angular-structure.md) | Angular CLI, modules/standalone, signals |
| [vue-nuxt-structure.md](web-applications/frontend/vue-nuxt-structure.md) | Vue 3 Composition API, Nuxt 3, auto-imports |
| [svelte-sveltekit-structure.md](web-applications/frontend/svelte-sveltekit-structure.md) | SvelteKit routes, server/client split |
| [remix-structure.md](web-applications/frontend/remix-structure.md) | Nested routing, loaders/actions, flat routes |
| [astro-structure.md](web-applications/frontend/astro-structure.md) | Content collections, islands, integrations |
| [atomic-design-component-architecture.md](web-applications/frontend/atomic-design-component-architecture.md) | Atomic Design: Atoms → Molecules → Organisms → Templates → Pages |
| [compound-components.md](web-applications/frontend/compound-components.md) | Compound components: Select, Tabs, Accordion, Menu (React/Vue/Angular) |
| [render-props-hoc-headless.md](web-applications/frontend/render-props-hoc-headless.md) | Render Props, HOCs, Headless Components (Radix UI, React Aria) |
| [accessibility-a11y.md](web-applications/frontend/accessibility-a11y.md) | WCAG 2.2, ARIA, keyboard navigation, focus management, a11y testing |
| [frontend-comparison-guide.md](web-applications/frontend/frontend-comparison-guide.md) | Decision matrix: which framework → which structure |

---

### Web Applications — Backend
API frameworks and server-side applications.

| Guide | Description |
|-------|-------------|
| [express-node-structure.md](web-applications/backend/express-node-structure.md) | Express.js, layered architecture, middleware |
| [nestjs-structure.md](web-applications/backend/nestjs-structure.md) | Modules, providers, guards, interceptors |
| [django-structure.md](web-applications/backend/django-structure.md) | Django apps, models, views, DRF |
| [fastapi-structure.md](web-applications/backend/fastapi-structure.md) | Routers, dependencies, schemas, async |
| [flask-structure.md](web-applications/backend/flask-structure.md) | Blueprints, factory pattern, extensions |
| [rails-structure.md](web-applications/backend/rails-structure.md) | Convention over config, generators, concerns |
| [spring-boot-structure.md](web-applications/backend/spring-boot-structure.md) | Packages, beans, configuration, profiles |
| [dotnet-api-structure.md](web-applications/backend/dotnet-api-structure.md) | .NET Web API, minimal API, Clean Architecture |
| [go-api-structure.md](web-applications/backend/go-api-structure.md) | Standard layout, cmd/internal/pkg, handlers |
| [backend-comparison-guide.md](web-applications/backend/backend-comparison-guide.md) | Decision matrix: which backend → which structure |

---

### Web Applications — Fullstack
Meta-frameworks that combine frontend and backend.

| Guide | Description |
|-------|-------------|
| [nextjs-fullstack-structure.md](web-applications/fullstack/nextjs-fullstack-structure.md) | Full-stack Next.js with Server Actions |
| [nuxt-fullstack-structure.md](web-applications/fullstack/nuxt-fullstack-structure.md) | Nitro server + Vue frontend |
| [remix-fullstack-structure.md](web-applications/fullstack/remix-fullstack-structure.md) | Remix as full-stack framework |
| [t3-stack-structure.md](web-applications/fullstack/t3-stack-structure.md) | tRPC + Prisma + NextAuth + Tailwind |
| [fullstack-comparison-guide.md](web-applications/fullstack/fullstack-comparison-guide.md) | Decision guide: fullstack approaches |

---

### Mobile Applications

| Guide | Description |
|-------|-------------|
| [flutter-structure.md](mobile-applications/flutter-structure.md) | Feature-first, BLoC/Riverpod, platform channels |
| [react-native-structure.md](mobile-applications/react-native-structure.md) | Expo vs bare, navigation, native modules |
| [ios-swift-structure.md](mobile-applications/ios-swift-structure.md) | SwiftUI/UIKit, TCA, SPM |
| [android-kotlin-structure.md](mobile-applications/android-kotlin-structure.md) | Jetpack Compose, MVVM, Gradle modules |
| [kotlin-multiplatform-structure.md](mobile-applications/kotlin-multiplatform-structure.md) | KMP shared/platform split, expect/actual |
| [cross-platform-decisions.md](mobile-applications/cross-platform-decisions.md) | When native vs cross-platform, trade-offs |
| [mobile-comparison-guide.md](mobile-applications/mobile-comparison-guide.md) | Decision matrix: mobile frameworks |

---

### Desktop Applications

| Guide | Description |
|-------|-------------|
| [electron-structure.md](desktop-applications/electron-structure.md) | Main/renderer/preload, IPC, packaging |
| [tauri-structure.md](desktop-applications/tauri-structure.md) | Rust backend + web frontend, commands |
| [dotnet-desktop-structure.md](desktop-applications/dotnet-desktop-structure.md) | WPF/WinUI/MAUI, MVVM, XAML organization |
| [native-desktop-structure.md](desktop-applications/native-desktop-structure.md) | Qt/C++, SwiftUI macOS |
| [desktop-comparison-guide.md](desktop-applications/desktop-comparison-guide.md) | Decision guide: desktop frameworks |

---

### Monorepo

| Guide | Description |
|-------|-------------|
| [overview.md](monorepo/overview.md) | Core concepts, benefits, trade-offs |
| [monorepo-vs-polyrepo.md](monorepo/monorepo-vs-polyrepo.md) | Decision framework, hybrid approaches |
| [tools-comparison.md](monorepo/tools-comparison.md) | Nx vs Turborepo vs Lerna vs Bazel vs Rush |
| [workspace-organization.md](monorepo/workspace-organization.md) | apps/ vs packages/, naming, boundaries |
| [package-management.md](monorepo/package-management.md) | pnpm workspaces, hoisting, phantom deps |
| [ci-cd-for-monorepos.md](monorepo/ci-cd-for-monorepos.md) | Affected builds, caching, parallel execution |
| [monorepo-at-scale.md](monorepo/monorepo-at-scale.md) | CODEOWNERS, remote caching, 100+ packages |

---

### Libraries & Packages

| Guide | Description |
|-------|-------------|
| [npm-package-structure.md](libraries-and-packages/npm-package-structure.md) | Dual ESM/CJS, exports field, tsup |
| [python-package-structure.md](libraries-and-packages/python-package-structure.md) | src layout, pyproject.toml, Hatch/Poetry |
| [go-module-structure.md](libraries-and-packages/go-module-structure.md) | go.mod, internal/, semantic import versioning |
| [open-source-project-structure.md](libraries-and-packages/open-source-project-structure.md) | Contributing guides, CI, releases, governance |
| [design-system-structure.md](libraries-and-packages/design-system-structure.md) | Component libraries, Storybook, tokens, themes |
| [sdk-structure.md](libraries-and-packages/sdk-structure.md) | Multi-language SDKs, codegen, versioning |

---

### DevOps & Infrastructure

| Guide | Description |
|-------|-------------|
| [docker-project-structure.md](devops-infrastructure/docker-project-structure.md) | Multi-stage builds, .dockerignore, security |
| [kubernetes-manifests-structure.md](devops-infrastructure/kubernetes-manifests-structure.md) | Kustomize vs Helm, overlays, secrets |
| [terraform-iac-structure.md](devops-infrastructure/terraform-iac-structure.md) | Modules, environments, state, remote backends |
| [ci-cd-pipeline-structure.md](devops-infrastructure/ci-cd-pipeline-structure.md) | GitHub Actions, GitLab CI, caching, deployments |
| [gitops-structure.md](devops-infrastructure/gitops-structure.md) | ArgoCD, Flux, environment promotion |
| [infrastructure-comparison-guide.md](devops-infrastructure/infrastructure-comparison-guide.md) | Decision guide: IaC/DevOps tools |

---

### Data & ML

| Guide | Description |
|-------|-------------|
| [data-pipeline-structure.md](data-and-ml/data-pipeline-structure.md) | Airflow, dbt, staging→intermediate→marts |
| [ml-project-structure.md](data-and-ml/ml-project-structure.md) | MLflow, experiments, models, serving |
| [analytics-project-structure.md](data-and-ml/analytics-project-structure.md) | Dashboards, metrics, ad-hoc analyses |
| [data-comparison-guide.md](data-and-ml/data-comparison-guide.md) | Decision guide: data/ML structures |

---

### Microservices Organization

| Guide | Description |
|-------|-------------|
| [multi-service-layout.md](microservices-organization/multi-service-layout.md) | Mono vs polyrepo, service internals, docker-compose |
| [shared-libraries-structure.md](microservices-organization/shared-libraries-structure.md) | Internal packages, versioning, contracts |
| [api-contract-organization.md](microservices-organization/api-contract-organization.md) | OpenAPI, gRPC protos, AsyncAPI, schema registry |
| [service-template-structure.md](microservices-organization/service-template-structure.md) | Service scaffold, generators, templates |

---

## How This Section Connects

```
03-architecture/          → HOW to architect (patterns, principles)
04-project-structure/     → WHERE to put files (directories, conventions)  ← YOU ARE HERE
05-design-patterns/       → WHAT patterns to use (code-level)
06-testing/               → HOW to test (strategies, placement)
```

Architecture decisions from `03-architecture/` determine which project structure to use here. For example:
- Microservices architecture → `microservices-organization/`
- Monolithic architecture → `web-applications/backend/` or `web-applications/fullstack/`
- Event-driven architecture → `microservices-organization/api-contract-organization.md` (AsyncAPI)
