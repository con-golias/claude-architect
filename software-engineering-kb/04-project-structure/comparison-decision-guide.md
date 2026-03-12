# Project Structure — Master Comparison & Decision Guide — Complete Specification

> **AI Plugin Directive:** When deciding how to structure ANY new project, ALWAYS start here. This guide routes you to the correct specific guide based on project type, scale, team, and technology stack. Consult this BEFORE creating any project structure. This is the single entry point for all project structure decisions.

**Core Rule: Project structure depends on THREE factors: project type (web/mobile/desktop/data), scale (solo to enterprise), and team (skills, size, existing tech). Start with the simplest structure that works, add complexity only when pain points emerge. NEVER over-architect a solo project. NEVER under-structure a team project.**

---

## 1. Master Decision Tree

```
What are you building?
│
├── Web Application
│   ├── Frontend only (SPA)
│   │   ├── React → web-applications/frontend/react-spa-structure.md
│   │   ├── Angular → web-applications/frontend/angular-structure.md
│   │   ├── Vue → web-applications/frontend/vue-nuxt-structure.md
│   │   ├── Svelte → web-applications/frontend/svelte-sveltekit-structure.md
│   │   └── Unsure → web-applications/frontend/frontend-comparison-guide.md
│   │
│   ├── Backend API only
│   │   ├── Node.js/TypeScript
│   │   │   ├── Express → web-applications/backend/express-node-structure.md
│   │   │   └── NestJS → web-applications/backend/nestjs-structure.md
│   │   ├── Python
│   │   │   ├── FastAPI → web-applications/backend/fastapi-structure.md
│   │   │   ├── Django → web-applications/backend/django-structure.md
│   │   │   └── Flask → web-applications/backend/flask-structure.md
│   │   ├── Ruby → web-applications/backend/rails-structure.md
│   │   ├── Java → web-applications/backend/spring-boot-structure.md
│   │   ├── C# → web-applications/backend/dotnet-api-structure.md
│   │   ├── Go → web-applications/backend/go-api-structure.md
│   │   └── Unsure → web-applications/backend/backend-comparison-guide.md
│   │
│   ├── Full-stack (frontend + backend together)
│   │   ├── Next.js → web-applications/fullstack/nextjs-fullstack-structure.md
│   │   ├── Nuxt → web-applications/fullstack/nuxt-fullstack-structure.md
│   │   ├── Remix → web-applications/fullstack/remix-fullstack-structure.md
│   │   ├── T3 Stack → web-applications/fullstack/t3-stack-structure.md
│   │   └── Unsure → web-applications/fullstack/fullstack-comparison-guide.md
│   │
│   └── Static / Content site
│       └── Astro → web-applications/frontend/astro-structure.md
│
├── Mobile Application
│   ├── Flutter → mobile-applications/flutter-structure.md
│   ├── React Native → mobile-applications/react-native-structure.md
│   ├── iOS (Swift) → mobile-applications/ios-swift-structure.md
│   ├── Android (Kotlin) → mobile-applications/android-kotlin-structure.md
│   ├── Kotlin Multiplatform → mobile-applications/kotlin-multiplatform-structure.md
│   ├── Native vs Cross-platform? → mobile-applications/cross-platform-decisions.md
│   └── Unsure → mobile-applications/mobile-comparison-guide.md
│
├── Desktop Application
│   ├── Electron → desktop-applications/electron-structure.md
│   ├── Tauri → desktop-applications/tauri-structure.md
│   ├── .NET (WPF/WinUI/MAUI) → desktop-applications/dotnet-desktop-structure.md
│   ├── Qt/C++ or SwiftUI Mac → desktop-applications/native-desktop-structure.md
│   └── Unsure → desktop-applications/desktop-comparison-guide.md
│
├── Library / Package
│   ├── npm (TypeScript/JS) → libraries-and-packages/npm-package-structure.md
│   ├── PyPI (Python) → libraries-and-packages/python-package-structure.md
│   ├── Go module → libraries-and-packages/go-module-structure.md
│   ├── Design System → libraries-and-packages/design-system-structure.md
│   ├── SDK (API client) → libraries-and-packages/sdk-structure.md
│   └── Open Source → libraries-and-packages/open-source-project-structure.md
│
├── Data / ML
│   ├── Data pipeline (ETL/ELT) → data-and-ml/data-pipeline-structure.md
│   ├── Machine learning → data-and-ml/ml-project-structure.md
│   ├── Analytics / BI → data-and-ml/analytics-project-structure.md
│   └── Unsure → data-and-ml/data-comparison-guide.md
│
├── Microservices / Multi-Service
│   ├── Service layout → microservices-organization/multi-service-layout.md
│   ├── Shared libraries → microservices-organization/shared-libraries-structure.md
│   ├── API contracts → microservices-organization/api-contract-organization.md
│   └── Service template → microservices-organization/service-template-structure.md
│
├── Monorepo
│   ├── Overview → monorepo/overview.md
│   ├── Mono vs Poly → monorepo/monorepo-vs-polyrepo.md
│   ├── Tool selection → monorepo/tools-comparison.md
│   ├── Organization → monorepo/workspace-organization.md
│   ├── Dependencies → monorepo/package-management.md
│   ├── CI/CD → monorepo/ci-cd-for-monorepos.md
│   └── At scale → monorepo/monorepo-at-scale.md
│
└── Infrastructure / DevOps
    ├── Docker → devops-infrastructure/docker-project-structure.md
    ├── Kubernetes → devops-infrastructure/kubernetes-manifests-structure.md
    ├── Terraform/IaC → devops-infrastructure/terraform-iac-structure.md
    ├── CI/CD Pipelines → devops-infrastructure/ci-cd-pipeline-structure.md
    ├── GitOps → devops-infrastructure/gitops-structure.md
    └── Unsure → devops-infrastructure/infrastructure-comparison-guide.md
```

---

## 2. Scoring System: Framework Selection

Use this scoring matrix to objectively compare framework options. Rate each dimension 1-5 for your project's specific context.

### Scoring Dimensions

```
┌──────────────────────────┬─────────────────────────────────────────────────────────┐
│ Dimension                │ How to Score (1 = low priority, 5 = critical)           │
├──────────────────────────┼─────────────────────────────────────────────────────────┤
│ Team Expertise           │ Does the team already know this technology?              │
│                          │ 1 = nobody knows it, 5 = entire team is expert          │
│                          │                                                         │
│ Hiring Pool              │ Can we hire developers for this technology?              │
│                          │ 1 = very few available, 5 = abundant talent             │
│                          │                                                         │
│ Ecosystem Maturity       │ Are libraries, tools, and integrations available?        │
│                          │ 1 = minimal ecosystem, 5 = everything exists            │
│                          │                                                         │
│ Performance Fit          │ Does the technology meet performance requirements?       │
│                          │ 1 = too slow/heavy, 5 = exceeds requirements            │
│                          │                                                         │
│ Development Speed        │ How fast can the team ship features?                    │
│                          │ 1 = very slow, 5 = extremely productive                │
│                          │                                                         │
│ Scalability              │ Will this technology scale with the project?             │
│                          │ 1 = won't scale, 5 = proven at massive scale           │
│                          │                                                         │
│ Maintenance Burden       │ How easy is the technology to maintain long-term?       │
│                          │ 1 = high maintenance, 5 = low maintenance              │
│                          │                                                         │
│ Community & Support      │ Is there good documentation and community support?      │
│                          │ 1 = minimal, 5 = excellent docs + active community     │
│                          │                                                         │
│ Cost                     │ What is the total cost (hosting, licenses, training)?   │
│                          │ 1 = very expensive, 5 = free/cheap                     │
│                          │                                                         │
│ Time to Market           │ How fast can we go from zero to production?             │
│                          │ 1 = months, 5 = days/weeks                              │
└──────────────────────────┴─────────────────────────────────────────────────────────┘
```

### Example Scoring: SaaS Dashboard

```
Scenario: 5-person startup building a B2B SaaS dashboard

┌──────────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Dimension (Weight)       │ Next.js  │ Vite+React│ Angular │ Nuxt 3   │
├──────────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Team Expertise (x2)      │ 4 (8)    │ 5 (10)   │ 2 (4)   │ 3 (6)    │
│ Hiring Pool (x1.5)       │ 5 (7.5)  │ 5 (7.5)  │ 4 (6)   │ 3 (4.5)  │
│ Ecosystem (x1.5)         │ 5 (7.5)  │ 5 (7.5)  │ 4 (6)   │ 4 (6)    │
│ Performance (x1)         │ 4 (4)    │ 3 (3)    │ 3 (3)   │ 4 (4)    │
│ Dev Speed (x2)           │ 4 (8)    │ 4 (8)    │ 2 (4)   │ 4 (8)    │
│ Scalability (x1)         │ 5 (5)    │ 3 (3)    │ 5 (5)   │ 4 (4)    │
│ Maintenance (x1)         │ 3 (3)    │ 4 (4)    │ 3 (3)   │ 4 (4)    │
│ Community (x1)           │ 5 (5)    │ 5 (5)    │ 4 (4)   │ 4 (4)    │
│ Cost (x1)                │ 4 (4)    │ 5 (5)    │ 5 (5)   │ 5 (5)    │
│ Time to Market (x2)      │ 4 (8)    │ 5 (10)   │ 2 (4)   │ 4 (8)    │
├──────────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ WEIGHTED TOTAL           │ 60.0     │ 63.0     │ 44.0    │ 53.5     │
└──────────────────────────┴──────────┴──────────┴──────────┴──────────┘

RESULT: Vite+React wins for internal SaaS dashboard (no SSR needed)
        Next.js close second (if SSR/SEO needed later)
        Angular loses for startup (learning curve, slower dev speed)
```

---

## 3. Quick Decision Flowcharts

### Frontend Framework Flowchart

```
Is SEO important for this project?
│
├── YES → Is it primarily content (blog, docs, marketing)?
│   ├── YES → Astro (zero JS by default, fastest Lighthouse)
│   └── NO → Is the team experienced with React?
│       ├── YES → Next.js (App Router, RSC, ISR)
│       ├── NO, Vue → Nuxt 3 (auto-imports, great DX)
│       └── NO, Svelte → SvelteKit (smallest bundles)
│
└── NO → Is it behind authentication?
    ├── YES → Team size?
    │   ├── 1-10 → Vite + React SPA (simplest)
    │   ├── 10-50 → Angular (enterprise structure) or React SPA
    │   └── 50+ → Angular with Nx (enforced module boundaries)
    └── NO → What's the primary use case?
        ├── Forms-heavy → Remix (best progressive enhancement)
        ├── Real-time → Vite React SPA + WebSocket backend
        └── General → Next.js (most flexible)
```

### Backend Framework Flowchart

```
What language does the team know?
│
├── Python → What type of API?
│   ├── Modern async API → FastAPI
│   ├── Full-featured with admin → Django + DRF
│   └── Simple / script-as-API → Flask
│
├── TypeScript/JavaScript → What scale?
│   ├── Enterprise / large team → NestJS
│   └── Small / flexible → Express
│
├── Java/Kotlin → Spring Boot (no real alternative)
│
├── C# → .NET Web API (no real alternative)
│
├── Go → Standard library + Chi/Echo
│
├── Ruby → Rails
│
└── No preference → What matters most?
    ├── Speed to market → Django or Rails (generators, admin)
    ├── Performance → Go or .NET
    ├── Type safety → NestJS, Spring Boot, or Go
    └── ML integration → FastAPI or Django
```

### Full-Stack vs Separate Decision

```
Who consumes the API?
│
├── Only this web app → Full-stack framework
│   ├── Need end-to-end types → T3 Stack (tRPC)
│   ├── React team → Next.js full-stack
│   ├── Vue team → Nuxt 3 full-stack
│   └── Want smallest bundles → SvelteKit full-stack
│
├── Web + Mobile → Separate backend
│   ├── TypeScript everywhere → NestJS backend + Next.js frontend
│   ├── Performance critical → Go/.NET backend + any frontend
│   └── Python ecosystem → FastAPI backend + any frontend
│
└── Public API / Multiple consumers → ALWAYS separate backend
    └── REST (universal) or GraphQL (flexible) with OpenAPI docs
```

### Infrastructure Decision

```
How many services?
│
├── 1 → PaaS (Railway, Fly.io, Render)
│
├── 2-5 → Docker Compose (dev) + Cloud Run/ECS (prod)
│
├── 5-20 → Managed Kubernetes (EKS/GKE) OR Cloud Run/ECS
│   ├── Simple networking → Cloud Run/ECS
│   └── Complex networking → Kubernetes
│
└── 20+ → Kubernetes + GitOps (ArgoCD) + service mesh
```

---

## 4. Real-World Case Study Archetypes

### Archetype 1: SaaS Startup (1-5 developers, MVP phase)

```
RECOMMENDED STACK:
  Frontend + Backend: T3 Stack (Next.js + tRPC + Prisma + Auth.js)
  Database: PostgreSQL (Supabase or Neon for managed)
  Hosting: Vercel (frontend + API) + managed database
  CI/CD: GitHub Actions
  IaC: Not needed yet (Vercel handles infra)
  Monitoring: Vercel Analytics + Sentry

WHY:
  - Maximum type safety with minimum setup
  - Single repository, single deployment
  - tRPC eliminates API layer boilerplate
  - Prisma handles migrations and type generation
  - Vercel deploys on git push (zero DevOps)
  - Can scale to 100K+ users before needing to extract services

WHEN TO EVOLVE:
  - Extract backend when mobile app needed (tRPC → standalone)
  - Add Redis when need caching / rate limiting
  - Move to Docker + ECS when Vercel costs exceed $500/month
  - Add Terraform when managing cloud resources beyond Vercel

COST: ~$0-50/month (development), ~$50-500/month (production)
```

### Archetype 2: E-Commerce Platform (5-15 developers)

```
RECOMMENDED STACK:
  Frontend: Next.js (App Router, ISR for product pages)
  Backend: NestJS or Django (REST API for product catalog, orders)
  Database: PostgreSQL + Redis (caching, sessions)
  Search: Elasticsearch or Meilisearch
  Payments: Stripe SDK
  Hosting: Docker + ECS Fargate (or Cloud Run)
  CI/CD: GitHub Actions
  IaC: Terraform
  Monitoring: Datadog or Grafana Cloud

WHY:
  - Next.js ISR for product pages (static speed + fresh prices)
  - Separate backend for mobile app + third-party integrations
  - NestJS for TypeScript consistency OR Django for admin panel
  - Redis for cart sessions + caching
  - Terraform for reproducible infrastructure

WHEN TO EVOLVE:
  - Add Kubernetes when > 15 services
  - Add message queue (RabbitMQ/Kafka) for order processing
  - Add CDN for static assets (CloudFront/Cloudflare)
  - Consider microservices: catalog, orders, payments, shipping

COST: ~$200-1000/month (staging + production)
```

### Archetype 3: Enterprise Platform (30+ developers)

```
RECOMMENDED STACK:
  Frontend: Next.js or Angular (depends on team background)
  Backend: Spring Boot or .NET (enterprise tooling + governance)
  OR multiple microservices: Go (performance) + NestJS (CRUD)
  Database: PostgreSQL (primary) + Redis + Elasticsearch
  Messaging: Kafka or RabbitMQ
  Container: Kubernetes (EKS/GKE managed)
  CI/CD: GitLab CI or Jenkins + GitHub Actions
  IaC: Terraform Enterprise + modules
  GitOps: ArgoCD with ApplicationSets
  Observability: Prometheus + Grafana + Jaeger/Tempo (or Datadog)
  Service Mesh: Istio or Linkerd (if > 20 services)

WHY:
  - Separate services for team autonomy (Conway's Law)
  - Kubernetes for orchestration at scale
  - ArgoCD for declarative deployment + audit trail
  - Terraform modules for standardized infrastructure
  - Service mesh for mTLS, traffic management, observability

STRUCTURE:
  Monorepo (Nx/Turborepo) or Polyrepo (service template + shared libs)
  API Gateway: Kong, AWS API Gateway, or Kubernetes Ingress
  Auth: Keycloak (self-hosted) or Okta/Auth0 (managed)
  Feature flags: LaunchDarkly, Unleash, or Flagsmith

COST: ~$5,000-50,000/month (depends on scale)
```

### Archetype 4: Content Site / Documentation

```
RECOMMENDED STACK:
  Framework: Astro (Starlight for docs, standard Astro for marketing)
  CMS: MDX files in Git (simple) or headless CMS (Contentful, Sanity)
  Hosting: Cloudflare Pages or Netlify or Vercel
  CI/CD: GitHub Actions (auto-deploy on push)
  IaC: Not needed (CDN handles everything)

WHY:
  - Astro ships zero JavaScript by default (fastest possible site)
  - Content collections for type-safe content management
  - Starlight is the best documentation framework (better than Docusaurus)
  - Static hosting = free or nearly free
  - MDX for rich content with components

COST: ~$0-20/month
```

### Archetype 5: Mobile-First App with Web Dashboard

```
RECOMMENDED STACK:
  Mobile: React Native (Expo) or Flutter
  Backend: FastAPI or NestJS (REST/GraphQL API)
  Web Dashboard: Next.js or Vite React SPA
  Database: PostgreSQL + Redis
  Push Notifications: Firebase Cloud Messaging
  Hosting: Docker + Cloud Run (backend) + Vercel (web)
  CI/CD: GitHub Actions + EAS Build (Expo) or Codemagic (Flutter)

WHY:
  - Separate backend serves both mobile and web clients
  - React Native + Next.js: shared TypeScript knowledge
  - Flutter: if need pixel-perfect cross-platform UI
  - FastAPI: if team is Python (ML integration easy)
  - NestJS: if team is TypeScript (shared language with frontend)

COST: ~$100-500/month
```

### Archetype 6: Desktop Application

```
RECOMMENDED STACK:
  Framework: Tauri v2 (Rust backend + web frontend)
  Frontend: React (Vite) or Svelte (SvelteKit)
  Backend logic: Rust (Tauri commands)
  Database: SQLite (local) via rusqlite or sea-orm
  Auto-updater: Tauri updater plugin
  CI/CD: GitHub Actions (cross-platform builds)
  Distribution: GitHub Releases or custom update server

WHY:
  - Tauri produces 5-10 MB binaries (vs Electron's 100+ MB)
  - OS-native WebView (no bundled Chromium)
  - Rust for security-critical operations (file system, crypto)
  - Tauri v2 also supports mobile (iOS/Android)
  - Capability-based security model

WHEN TO USE ELECTRON INSTEAD:
  - Team has zero Rust experience and can't invest in learning
  - Need full Node.js ecosystem access
  - Need Chrome-specific APIs (e.g., Chrome DevTools Protocol)
  - VS Code / Slack / Discord use Electron — proven at scale

COST: ~$0 (open source, no runtime costs)
```

---

## 5. Cross-Cutting Guides (Apply to ALL Projects)

```
Regardless of project type, ALWAYS consult:

File Organization → general/file-organization-patterns.md
  Feature-first vs layer-first vs domain-first

Folder Naming → general/folder-naming-conventions.md
  kebab-case, PascalCase, per-language rules

Configuration → general/config-management.md
  .env, config files, secrets, feature flags

Environments → general/environment-management.md
  Dev/staging/prod, environment parity

Testing → general/testing-directory-structure.md
  Test placement, fixtures, mocks, e2e vs unit

Documentation → general/documentation-structure.md
  README patterns, /docs, ADRs, changelogs

Build Output → general/build-output-structure.md
  dist/, build/, artifacts, source maps

Dependencies → general/dependency-organization.md
  Lockfiles, versioning, internal deps

Shared Code → general/shared-code-organization.md
  Shared utilities, common modules, internal packages
```

---

## 6. Decision by Project Scale

```
┌─────────────────┬──────────┬─────────────────────────────────────────────────────────┐
│ Scale           │ Team     │ Structure Approach                                      │
├─────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ Solo project    │ 1 dev    │ Simple flat structure, minimal config, single repo      │
│                 │          │ Framework: Whatever you know best                       │
│                 │          │ Infra: PaaS (Railway/Vercel), no Docker needed          │
│                 │          │ CI: GitHub Actions (lint + test on PR)                  │
│                 │          │ DO: Ship fast. DON'T: Over-architect.                   │
│                 │          │                                                         │
│ Small team      │ 2-5 devs │ Feature-first, shared conventions, single repo          │
│                 │          │ Framework: Choose by team expertise                     │
│                 │          │ Infra: Docker Compose (dev) + PaaS/Cloud Run (prod)     │
│                 │          │ CI: GitHub Actions, automated deploys                   │
│                 │          │ DO: Document conventions. DON'T: Microservices.          │
│                 │          │                                                         │
│ Medium team     │ 5-20 devs│ Domain-driven modules, clear boundaries, monorepo       │
│                 │          │ Framework: Nx/Turborepo monorepo for shared code        │
│                 │          │ Infra: Docker + ECS/GKE, Terraform for IaC             │
│                 │          │ CI: GitHub Actions/GitLab CI, path-filtered builds     │
│                 │          │ DO: Module boundaries. DON'T: Ignore test coverage.    │
│                 │          │                                                         │
│ Large team      │ 20-50    │ Monorepo with strict boundaries OR polyrepo             │
│                 │ devs     │ Framework: Per-team decisions within guardrails          │
│                 │          │ Infra: Kubernetes + ArgoCD + Terraform modules          │
│                 │          │ CI: GitLab CI or Jenkins, build caching critical        │
│                 │          │ DO: Platform team. DON'T: YOLO deployments.             │
│                 │          │                                                         │
│ Enterprise      │ 50+ devs │ Polyrepo with golden path templates + inner source      │
│                 │          │ Framework: Service template + tech radar                │
│                 │          │ Infra: K8s + service mesh + GitOps + policy engine      │
│                 │          │ CI: Enterprise CI (Jenkins/GitLab) + build farm         │
│                 │          │ DO: Governance without bottleneck. DON'T: Lock down     │
│                 │          │ innovation. Use internal developer platform (IDP).      │
└─────────────────┴──────────┴─────────────────────────────────────────────────────────┘
```

---

## 7. Quick Start by Scenario

```
"I'm building a SaaS product"
  → T3 Stack (Next.js + tRPC + Prisma + Auth.js) for type-safe full-stack
  → See: web-applications/fullstack/t3-stack-structure.md
  → If team knows Vue: Nuxt 3 full-stack
  → If team needs REST API for mobile: NestJS backend + Next.js frontend

"I'm building a REST API"
  → TypeScript team: NestJS (enterprise) or Express (simple)
  → Python team: FastAPI (modern) or Django DRF (batteries-included)
  → Performance-critical: Go (fastest cold start, smallest binary)
  → See: web-applications/backend/backend-comparison-guide.md

"I'm building a mobile app"
  → Cross-platform (code sharing): Flutter (Dart) or React Native (Expo)
  → iOS-only: SwiftUI + TCA or MVVM
  → Android-only: Jetpack Compose + MVVM
  → See: mobile-applications/mobile-comparison-guide.md

"I'm building a desktop app"
  → Small binary + security: Tauri v2 (Rust + Web)
  → Full JS ecosystem: Electron
  → Windows-only: .NET WinUI 3 / MAUI
  → See: desktop-applications/desktop-comparison-guide.md

"I'm building a component library"
  → See: libraries-and-packages/design-system-structure.md
  → Monorepo with packages: libraries-and-packages/npm-package-structure.md

"I have multiple services"
  → 2-5 services: Monorepo (Turborepo or Nx)
  → 5-20 services: Monorepo with Nx OR polyrepo with template
  → 20+: Polyrepo or domain-based monorepos
  → See: microservices-organization/multi-service-layout.md

"I need to set up CI/CD"
  → See: devops-infrastructure/ci-cd-pipeline-structure.md
  → GitHub → GitHub Actions, GitLab → GitLab CI

"I need to deploy to Kubernetes"
  → See: devops-infrastructure/kubernetes-manifests-structure.md
  → GitOps: devops-infrastructure/gitops-structure.md
  → ALWAYS use managed K8s (EKS/GKE/AKS)

"I'm building a documentation site"
  → Astro + Starlight (best documentation framework)
  → See: web-applications/frontend/astro-structure.md

"I'm building a data pipeline"
  → See: data-and-ml/data-pipeline-structure.md

"I need to choose between monorepo and polyrepo"
  → See: monorepo/monorepo-vs-polyrepo.md
```

---

## 8. Technology Radar (Adoption Recommendations)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    TECHNOLOGY RADAR (2025)                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ADOPT (safe for production, recommended):                               │
│    Frontend: Next.js 15, Vite + React, Angular 18, Nuxt 3, Astro 5     │
│    Backend:  NestJS, FastAPI, Spring Boot 3.3, .NET 8, Go 1.22+        │
│    Database: PostgreSQL, Redis, SQLite                                   │
│    ORM:      Prisma, Drizzle, EF Core, Django ORM                       │
│    Infra:    Docker, Kubernetes (managed), Terraform, GitHub Actions    │
│    GitOps:   ArgoCD, Flux                                                │
│    Cloud:    AWS, GCP, Azure, Cloudflare                                 │
│                                                                          │
│  TRIAL (promising, evaluate for your context):                           │
│    Frontend: SvelteKit 2, Remix/RR7, Solid.js                           │
│    Backend:  Hono, Elysia (Bun), Axum (Rust)                            │
│    Database: Turso (edge SQLite), Neon (serverless PG), DynamoDB        │
│    ORM:      SQLModel, sqlc, Drizzle (growing fast)                     │
│    Infra:    OpenTofu, Pulumi, Podman, Buildkite                        │
│    Runtime:  Bun, Deno 2                                                 │
│    Desktop:  Tauri v2                                                    │
│                                                                          │
│  ASSESS (interesting, watch but don't adopt yet):                        │
│    Frontend: Qwik, Angular Wiz (Google internal), React Compiler        │
│    Backend:  Effect-TS, Nitro standalone, Encore (Go cloud framework)   │
│    Database: SurrealDB, EdgeDB, CockroachDB                             │
│    AI:       Vercel AI SDK, LangChain, semantic kernel                  │
│    Infra:    Dagger (CI/CD as code), Crossplane                         │
│                                                                          │
│  HOLD (avoid for new projects):                                          │
│    Frontend: Create React App (dead), Gatsby (declining), AngularJS     │
│    Backend:  Express without structure, Flask for large apps             │
│    Database: MongoDB for relational data, Firebase for complex queries  │
│    Infra:    Docker Swarm (declining), self-hosted K8s                   │
│    CI/CD:    Travis CI (declining), CircleCI (reduced free tier)        │
│    State:    Redux (prefer Zustand), MobX, Vuex (prefer Pinia)          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Universal Rules (Apply to EVERY Project)

```
Rules that apply to EVERY project:

1. Feature-first organization by default
   Group files by feature/domain, NOT by type
   ✅ features/auth/LoginView.tsx
   ❌ components/LoginView.tsx, services/authService.ts

2. Configuration in environment variables
   12-factor app, .env files for local development
   NEVER commit .env files with secrets

3. Tests alongside source (or mirrored test directory)
   Colocated: src/features/auth/__tests__/login.test.ts
   Mirrored:  tests/features/auth/login_test.go

4. README at the root
   What it is, how to install, how to run, how to contribute

5. Lockfile committed
   ALWAYS commit package-lock.json, pnpm-lock.yaml, go.sum, Cargo.lock
   NEVER commit yarn.lock AND package-lock.json (pick one package manager)

6. .gitignore from day one
   NEVER commit: node_modules, .env, dist/, __pycache__, .DS_Store, *.pyc

7. CI pipeline from first commit
   Lint + test + build on every PR (even for solo projects)
   Catches issues before they compound

8. Start simple, add structure as needed
   Don't create 50 empty folders on day one
   Add structure when you feel pain, not before

9. One way to do things
   Pick ONE state manager, ONE testing framework, ONE CSS approach
   Document the choice in an ADR (Architecture Decision Record)

10. Type safety whenever possible
    TypeScript > JavaScript, Pydantic > dict, Go > dynamically typed
    Types are documentation that never goes stale
```

---

## 10. Anti-Patterns (Cross-Cutting)

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Over-engineering day one** | Kubernetes for a 3-page website, microservices for 1 developer | Start with PaaS, monolith, simple tools. Scale when needed |
| **Under-structuring at scale** | 50 developers in one flat folder, no conventions | Enforce module boundaries, linting rules, ADRs |
| **Technology zoo** | React + Vue + Angular in same org, 5 different CI tools | Standardize on a tech stack, create a tech radar |
| **Cargo cult architecture** | "Netflix uses microservices so we should too" | Match architecture to YOUR constraints, not FAANG's |
| **No ADRs** | Nobody knows why decisions were made, repeated debates | Write Architecture Decision Records for every major choice |
| **Premature abstraction** | Creating frameworks/platforms before building the product | Build the product first, extract patterns later |
| **Not invented here** | Building custom auth, custom ORM, custom everything | Use battle-tested libraries; build only what's unique to your business |
| **Resume-driven development** | Choosing Rust for a CRUD API because it's "cool" | Choose boring technology that the team knows and can maintain |
| **Ignoring Conway's Law** | Architecture doesn't match team structure | Align service boundaries with team boundaries |
| **No environment parity** | "Works on my machine" / prod different from staging | Docker for dev parity, Terraform for infra parity |
| **Secrets in code** | API keys in .env committed to Git | .env in .gitignore, use secrets manager for production |
| **No rollback plan** | "We'll fix forward" with broken production | Always have a one-click rollback mechanism |

---

## 11. Enforcement Checklist (Master)

### Before Starting ANY Project
- [ ] **Project type identified** — web, mobile, desktop, data, library, infra
- [ ] **Decision tree followed** — consulted the master decision tree above
- [ ] **Framework scoring completed** — objective comparison using scoring matrix
- [ ] **Team skills assessed** — technology matches existing expertise
- [ ] **Scale requirements estimated** — solo, team, enterprise structure chosen
- [ ] **ADR written** — Architecture Decision Record for framework/stack choice

### Project Setup
- [ ] **README created** — what, why, how to install, how to run, how to contribute
- [ ] **.gitignore configured** — language-specific, no secrets, no build output
- [ ] **Lockfile committed** — package manager lockfile in version control
- [ ] **CI pipeline configured** — lint + test + build on every PR
- [ ] **Environment variables** — .env.example committed, .env in .gitignore
- [ ] **Linter + formatter** — ESLint/Prettier, Ruff, golangci-lint, etc.

### Structure
- [ ] **Feature-first organization** — files grouped by feature, not by type
- [ ] **Cross-cutting guide consulted** — file organization, naming, config, testing
- [ ] **Framework-specific guide followed** — detailed structure from specific guide

### Operations
- [ ] **Deployment automated** — CI/CD deploys to all environments
- [ ] **Monitoring configured** — error tracking (Sentry), metrics, logging
- [ ] **Staging environment exists** — at least dev + staging + production
- [ ] **Rollback mechanism documented** — how to roll back a bad deploy

---

## 12. Comparison Guide Cross-Reference

| Comparison Topic | Guide Location |
|-----------------|----------------|
| Frontend frameworks | `web-applications/frontend/frontend-comparison-guide.md` |
| Backend frameworks | `web-applications/backend/backend-comparison-guide.md` |
| Full-stack frameworks | `web-applications/fullstack/fullstack-comparison-guide.md` |
| Infrastructure/DevOps | `devops-infrastructure/infrastructure-comparison-guide.md` |
| Mobile platforms | `mobile-applications/mobile-comparison-guide.md` |
| Desktop platforms | `desktop-applications/desktop-comparison-guide.md` |
| Data/ML tools | `data-and-ml/data-comparison-guide.md` |
| Monorepo tools | `monorepo/tools-comparison.md` |
| Monorepo vs polyrepo | `monorepo/monorepo-vs-polyrepo.md` |
| Cross-platform mobile | `mobile-applications/cross-platform-decisions.md` |
