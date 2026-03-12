# Frontend Framework Comparison & Decision Guide — Complete Specification

> **AI Plugin Directive:** When a developer asks "which frontend framework should I use?", "React vs Next.js vs Vue vs Angular?", "should I use SvelteKit or Remix?", "best framework for my project?", "frontend framework comparison?", or "how do I choose a frontend framework?", use this directive. Choosing the wrong framework wastes months of development time and creates technical debt that compounds. This guide provides a data-driven decision matrix based on project requirements, team expertise, and scale. There is NO universally "best" framework — only the best framework for YOUR specific context.

---

## 1. The Core Rule

**Choose a frontend framework based on three factors: (1) project requirements (content site vs SPA vs full-stack), (2) team expertise (existing skills and hiring pool), and (3) ecosystem maturity (libraries, tooling, community). Default to Next.js for React projects that need SSR/SEO. Default to Vite React SPA for internal tools and dashboards. Default to Astro for content sites. NEVER choose a framework based on hype — choose based on constraints.**

---

## 2. Framework Decision Tree

```
START: What type of web application are you building?

Step 1: Is it primarily a CONTENT site? (blog, docs, marketing, e-commerce storefront)
├── YES → Does it need heavy interactivity? (dashboards, real-time, complex forms)
│   ├── YES → Next.js (App Router) or Nuxt 3
│   └── NO → Astro (zero JS by default, island architecture)
│
└── NO → Is it a SPA (Single Page Application)?
    │
    ├── YES → Is it an internal tool/dashboard? (behind auth, no SEO needed)
    │   ├── YES → Vite React SPA or Angular (enterprise teams)
    │   └── NO → Does it need SSR for SEO or performance?
    │       ├── YES → Next.js, Nuxt 3, or SvelteKit
    │       └── NO → Vite React SPA (simplest option)
    │
    └── NO → Is it a full-stack application? (server + client in one project)
        ├── YES → What is the team's primary language?
        │   ├── React → Next.js (App Router) or Remix
        │   ├── Vue → Nuxt 3
        │   ├── Svelte → SvelteKit
        │   └── No preference → Next.js (largest ecosystem)
        └── NO → It's probably a widget/component library
            └── React + Vite library mode, or framework-agnostic with Lit/Stencil
```

### Extended Decision Tree: Rendering Strategy

```
What rendering strategy do you need?

Step 1: Does SEO matter?
├── YES → Must pages be indexed by search engines?
│   ├── YES, all pages → SSR or SSG (Next.js, Nuxt, SvelteKit, Astro)
│   │   ├── Content changes rarely → SSG (Static Site Generation)
│   │   │   ├── < 10,000 pages → Build-time SSG (Astro, Next.js export)
│   │   │   └── > 10,000 pages → ISR / On-demand revalidation (Next.js ISR)
│   │   ├── Content changes frequently → SSR (Server-Side Rendering)
│   │   │   ├── Can tolerate TTFB latency → Traditional SSR (Next.js, Nuxt)
│   │   │   └── Need fast TTFB everywhere → Edge SSR (Next.js Edge, SvelteKit)
│   │   └── Mix of static + dynamic → ISR (Next.js) or Hybrid (Astro, Nuxt)
│   └── YES, some pages → Hybrid rendering
│       └── Marketing pages SSG + Dashboard pages CSR
│           → Next.js (per-route rendering), Nuxt (route rules), Astro (hybrid)
│
└── NO → Client-Side Rendering (CSR)
    ├── Simple SPA → Vite React / Vite Vue / Vite Svelte
    ├── Complex SPA with offline → Angular (PWA support)
    └── Micro-frontend → Module Federation (Webpack 5 / Vite)

Step 2: Do you need streaming?
├── YES → React Server Components + Streaming (Next.js App Router)
│         OR Remix (streaming loaders with defer/Await)
└── NO  → Any framework works

Step 3: Do you need edge runtime?
├── YES → Next.js Edge Runtime, SvelteKit (Cloudflare adapter), Nuxt (Nitro)
└── NO  → Any Node.js runtime works
```

---

## 3. Comparison Matrix

### By Project Type

```
┌─────────────────────────────┬─────────┬──────────┬─────────┬────────────┬──────────┬─────────┬───────┐
│ Project Type                │ Next.js │ Vite+React│ Angular │ Nuxt 3     │ SvelteKit│ Remix   │ Astro │
├─────────────────────────────┼─────────┼──────────┼─────────┼────────────┼──────────┼─────────┼───────┤
│ Marketing/Landing Pages     │  OK     │ WRONG    │ WRONG   │  OK        │  OK      │ MAYBE   │ BEST  │
│ Blog/Documentation          │  OK     │ WRONG    │ WRONG   │  OK        │  OK      │ MAYBE   │ BEST  │
│ E-commerce Storefront       │ BEST    │ MAYBE    │ MAYBE   │  OK        │  OK      │  OK     │  OK   │
│ SaaS Dashboard              │  OK     │ BEST     │ BEST    │  OK        │  OK      │  OK     │ WRONG │
│ Internal Admin Tool         │ MAYBE   │ BEST     │ BEST    │  OK        │  OK      │  OK     │ WRONG │
│ Social Platform             │ BEST    │  OK      │ MAYBE   │  OK        │ MAYBE    │  OK     │ WRONG │
│ Real-time Collaboration     │  OK     │ BEST     │  OK     │  OK        │  OK      │ MAYBE   │ WRONG │
│ Mobile-first PWA            │  OK     │  OK      │ BEST    │  OK        │  OK      │  OK     │ WRONG │
│ Enterprise Portal           │  OK     │  OK      │ BEST    │ MAYBE      │ MAYBE    │ MAYBE   │ WRONG │
│ Multi-tenant Platform       │ BEST    │  OK      │  OK     │  OK        │ MAYBE    │  OK     │ WRONG │
│ Static Site Generator       │  OK     │ WRONG    │ WRONG   │  OK        │  OK      │ WRONG   │ BEST  │
│ Design System Docs          │ MAYBE   │ MAYBE    │ MAYBE   │ MAYBE      │ MAYBE    │ MAYBE   │ BEST  │
│ Micro-frontends             │  OK     │ BEST     │ BEST    │  OK        │ MAYBE    │ MAYBE   │ MAYBE │
│ Progressive Web App         │  OK     │  OK      │ BEST    │  OK        │  OK      │ BEST    │ WRONG │
└─────────────────────────────┴─────────┴──────────┴─────────┴────────────┴──────────┴─────────┴───────┘
BEST = Best choice  OK = Good choice  MAYBE = Possible but not ideal  WRONG = Wrong tool
```

### By Technical Requirement

```
┌─────────────────────────────┬─────────┬──────────┬─────────┬────────────┬──────────┬─────────┬───────┐
│ Requirement                 │ Next.js │ Vite+React│ Angular │ Nuxt 3     │ SvelteKit│ Remix   │ Astro │
├─────────────────────────────┼─────────┼──────────┼─────────┼────────────┼──────────┼─────────┼───────┤
│ Server-Side Rendering       │ BEST    │ WRONG    │  OK     │ BEST       │ BEST     │ BEST    │  OK   │
│ Static Generation (SSG)     │  OK     │ WRONG    │ MAYBE   │  OK        │  OK      │ MAYBE   │ BEST  │
│ API Routes / BFF            │ BEST    │ WRONG    │ WRONG   │ BEST       │ BEST     │ BEST    │  OK   │
│ File-based Routing          │ BEST    │ WRONG    │ WRONG   │ BEST       │ BEST     │ BEST    │ BEST  │
│ Server Components           │ BEST    │ WRONG    │ WRONG   │ WRONG      │ WRONG    │ WRONG   │ MAYBE │
│ Edge Runtime                │ BEST    │ WRONG    │ WRONG   │  OK        │  OK      │  OK     │  OK   │
│ Zero-JS by Default          │ WRONG   │ WRONG    │ WRONG   │ WRONG      │ WRONG    │ WRONG   │ BEST  │
│ Multi-framework Support     │ WRONG   │ WRONG    │ WRONG   │ WRONG      │ WRONG    │ WRONG   │ BEST  │
│ TypeScript First-class      │ BEST    │ BEST     │ BEST    │ BEST       │  OK      │ BEST    │  OK   │
│ Streaming SSR               │ BEST    │ WRONG    │ MAYBE   │  OK        │  OK      │ BEST    │ MAYBE │
│ Incremental Static Regen    │ BEST    │ WRONG    │ WRONG   │ MAYBE      │ MAYBE    │ WRONG   │ MAYBE │
│ Progressive Enhancement     │ MAYBE   │ WRONG    │ WRONG   │ MAYBE      │  OK      │ BEST    │  OK   │
│ Built-in Auth Ecosystem     │  OK     │ WRONG    │ WRONG   │ MAYBE      │ MAYBE    │  OK     │ WRONG │
│ Content Collections         │ WRONG   │ WRONG    │ WRONG   │  OK        │ WRONG    │ WRONG   │ BEST  │
│ Middleware (Edge)           │ BEST    │ WRONG    │ WRONG   │  OK        │  OK      │ MAYBE   │  OK   │
│ View Transitions API        │ MAYBE   │ MAYBE    │ BEST    │  OK        │  OK      │  OK     │ BEST  │
│ Partial Prerendering        │ BEST    │ WRONG    │ WRONG   │ WRONG      │ WRONG    │ WRONG   │ WRONG │
│ Built-in Image Optimization │ BEST    │ WRONG    │ BEST    │  OK        │ MAYBE    │ WRONG   │  OK   │
│ Internationalization (i18n) │  OK     │ MAYBE    │ BEST    │ BEST       │  OK      │ MAYBE   │  OK   │
└─────────────────────────────┴─────────┴──────────┴─────────┴────────────┴──────────┴─────────┴───────┘
```

---

## 4. Bundle Size & Performance Benchmarks

### Framework Runtime Size (Minified + Gzipped)

```
┌─────────────────────────────┬──────────────┬──────────────────────────────────────────┐
│ Framework                   │ Runtime Size │ Visual                                   │
├─────────────────────────────┼──────────────┼──────────────────────────────────────────┤
│ Svelte (compiled)           │  1.6 KB      │ █                                        │
│ Solid.js                    │  2.5 KB      │ █                                        │
│ Astro (zero-JS page)        │  0   KB      │ (no runtime)                             │
│ Preact                      │  4   KB      │ ██                                       │
│ Vue 3                       │ 16   KB      │ ████████                                 │
│ React 18 + ReactDOM         │ 42   KB      │ █████████████████████                    │
│ Angular 17+                 │ 65   KB      │ █████████████████████████████████         │
│ Angular (with RxJS)         │ 90   KB      │ █████████████████████████████████████████ │
└─────────────────────────────┴──────────────┴──────────────────────────────────────────┘

NOTE: These are RUNTIME sizes only. Application code adds to total bundle.
React + Next.js includes React runtime + Next.js client runtime (~70 KB baseline).
Angular includes Zone.js (~35 KB). Angular 18+ with Zoneless reduces this.
Svelte compiles away — no runtime shipped. Each component adds ~2-4 KB compiled.
```

### Real-World Application Bundle Comparison (Typical SaaS Dashboard)

```
┌──────────────┬────────────┬────────────┬────────────┬───────────┬────────────┐
│ Metric       │ React+Vite │ Next.js    │ Angular    │ Nuxt 3    │ SvelteKit  │
├──────────────┼────────────┼────────────┼────────────┼───────────┼────────────┤
│ Initial JS   │ 85-120 KB  │ 70-100 KB  │ 130-180 KB │ 60-90 KB  │ 35-60 KB   │
│ Total JS*    │ 200-400 KB │ 180-350 KB │ 300-600 KB │ 150-300 KB│ 100-200 KB │
│ CSS          │ 15-40 KB   │ 15-40 KB   │ 20-50 KB   │ 15-40 KB  │ 10-30 KB   │
│ First Load   │ 100-160 KB │ 85-140 KB  │ 150-230 KB │ 75-130 KB │ 45-90 KB   │
│ Code Split   │ Manual     │ Auto(route)│ Auto(lazy) │ Auto(route│ Auto(route)│
│ Tree Shaking │ Vite(good) │ Webpack/TP │ CLI(good)  │ Vite(good)│ Vite(good) │
└──────────────┴────────────┴────────────┴────────────┴───────────┴────────────┘
* Total JS = all lazy chunks combined. Loaded on demand.
TP = Turbopack (Next.js 15+)
```

### Lighthouse Scores (Typical Well-Optimized App)

```
┌─────────────────────┬────────────┬────────────┬────────────┬────────────┐
│ Framework           │Performance │ FCP (sec)  │ LCP (sec)  │ TBT (ms)   │
├─────────────────────┼────────────┼────────────┼────────────┼────────────┤
│ Astro (static)      │ 95-100     │ 0.5-0.8    │ 0.8-1.2    │ 0-50       │
│ SvelteKit (SSR)     │ 90-100     │ 0.7-1.0    │ 1.0-1.5    │ 50-150     │
│ Next.js (RSC)       │ 85-98      │ 0.8-1.2    │ 1.2-2.0    │ 100-250    │
│ Nuxt 3 (SSR)        │ 85-98      │ 0.8-1.2    │ 1.2-2.0    │ 100-250    │
│ Remix (SSR)         │ 85-95      │ 0.8-1.2    │ 1.2-2.0    │ 100-300    │
│ React SPA (CSR)     │ 60-85      │ 1.5-2.5    │ 2.0-3.5    │ 200-500    │
│ Angular (CSR)       │ 55-85      │ 1.5-3.0    │ 2.0-4.0    │ 300-800    │
└─────────────────────┴────────────┴────────────┴────────────┴────────────┘
FCP = First Contentful Paint    LCP = Largest Contentful Paint
TBT = Total Blocking Time      All metrics on 4G throttled mobile
```

---

## 5. Rendering Strategy Deep Comparison

```
┌───────────┬───────────────────────────────────────────────────────────────────────────┐
│ Strategy  │ Description + Framework Support                                           │
├───────────┼───────────────────────────────────────────────────────────────────────────┤
│ CSR       │ Client-Side Rendering. Browser downloads JS, renders in browser.          │
│ (Client)  │ All frameworks: React SPA, Angular, Vue SPA, Svelte SPA                  │
│           │ Pros: Simple deployment (CDN), no server cost, rich interactivity         │
│           │ Cons: Blank page until JS loads, poor SEO, slow FCP                       │
│           │                                                                           │
│ SSR       │ Server-Side Rendering. Server renders HTML on every request.              │
│ (Server)  │ Next.js, Nuxt, SvelteKit, Remix, Angular Universal                       │
│           │ Pros: Fast FCP, SEO-friendly, dynamic content                             │
│           │ Cons: Server cost, TTFB depends on server speed, hydration cost           │
│           │                                                                           │
│ SSG       │ Static Site Generation. HTML generated at build time.                     │
│ (Static)  │ Next.js (export), Astro, Nuxt (generate), SvelteKit (prerender)          │
│           │ Pros: Fastest possible TTFB (CDN), zero server cost, maximum caching      │
│           │ Cons: Rebuild for content changes, build time scales with pages            │
│           │                                                                           │
│ ISR       │ Incremental Static Regeneration. SSG + background revalidation.           │
│ (Hybrid)  │ Next.js (native), Nuxt (routeRules), Astro (hybrid+revalidate)           │
│           │ Pros: SSG speed + fresh content, no full rebuild                          │
│           │ Cons: Vercel-optimized (Next.js), stale content window                    │
│           │                                                                           │
│ Streaming │ Progressive HTML streaming. Server sends HTML in chunks.                  │
│           │ Next.js (RSC + Suspense), Remix (defer), SvelteKit (streaming)            │
│           │ Pros: Instant shell, progressive loading, better UX                       │
│           │ Cons: Complex error handling, limited platform support                    │
│           │                                                                           │
│ PPR       │ Partial Prerendering. Static shell + dynamic holes.                       │
│ (Partial) │ Next.js 15+ (experimental → stable in Next.js 15)                        │
│           │ Pros: Static speed + dynamic content, best of SSG+SSR                     │
│           │ Cons: Next.js only, requires Suspense boundaries                          │
│           │                                                                           │
│ Islands   │ Static HTML + interactive "islands" that hydrate independently.            │
│           │ Astro (native), Fresh (Deno)                                              │
│           │ Pros: Minimal JS, per-component hydration, multi-framework                │
│           │ Cons: Limited interactivity, island-to-island communication complex        │
│           │                                                                           │
│ RSC       │ React Server Components. Components that run ONLY on the server.          │
│           │ Next.js App Router (native), Remix (planned)                              │
│           │ Pros: Zero client JS for server components, direct DB access              │
│           │ Cons: React-only, new mental model, ecosystem adapting                    │
└───────────┴───────────────────────────────────────────────────────────────────────────┘
```

### Rendering Strategy Decision Matrix

```
IF content rarely changes AND < 10,000 pages → SSG
IF content rarely changes AND > 10,000 pages → ISR or On-demand SSG
IF content changes per-request (personalized) → SSR
IF content is mix of static + dynamic → PPR (Next.js) or Hybrid (Astro/Nuxt)
IF page is behind authentication → CSR (no SEO needed)
IF page needs instant loading with progressive data → Streaming SSR
IF page is mostly static with few interactive widgets → Islands (Astro)
IF page needs zero JavaScript → SSG + Astro (zero-JS default)
```

---

## 6. State Management Ecosystem Per Framework

```
┌─────────────────────┬──────────────────────────────────────────────────────────────────┐
│ Framework           │ State Management Options (ranked by recommendation)              │
├─────────────────────┼──────────────────────────────────────────────────────────────────┤
│                     │ SERVER STATE:                                                    │
│ Next.js             │  1. React Server Components (direct DB/API access)              │
│                     │  2. TanStack Query (client-side server state cache)              │
│                     │  3. SWR (Vercel's lighter alternative)                          │
│                     │ CLIENT STATE:                                                    │
│                     │  1. Zustand (simple, minimal boilerplate)                        │
│                     │  2. Jotai (atomic, bottom-up state)                              │
│                     │  3. Redux Toolkit (complex, large apps)                          │
│                     │ URL STATE: nuqs (type-safe URL search params)                   │
│                     │ FORM STATE: React Hook Form + Zod                               │
│                     │                                                                  │
│ Vite React SPA      │ SERVER STATE:                                                    │
│                     │  1. TanStack Query (de facto standard)                           │
│                     │ CLIENT STATE:                                                    │
│                     │  1. Zustand (small-medium apps)                                  │
│                     │  2. Redux Toolkit (large enterprise apps)                        │
│                     │  3. Jotai or Recoil (atomic state)                               │
│                     │ FORM STATE: React Hook Form + Zod                               │
│                     │                                                                  │
│ Angular             │ SERVER STATE:                                                    │
│                     │  1. HttpClient + RxJS (built-in)                                 │
│                     │  2. TanStack Query Angular                                       │
│                     │ CLIENT STATE:                                                    │
│                     │  1. Angular Signals (built-in, v16+)                             │
│                     │  2. NgRx SignalStore (complex state)                             │
│                     │  3. NgRx Store (Redux-like, legacy large apps)                   │
│                     │ FORM STATE: Reactive Forms (built-in)                            │
│                     │                                                                  │
│ Nuxt 3 (Vue 3)      │ SERVER STATE:                                                    │
│                     │  1. useFetch / useAsyncData (built-in SSR-aware)                 │
│                     │ CLIENT STATE:                                                    │
│                     │  1. Pinia (official, replaces Vuex)                               │
│                     │  2. Vue Composables (simple local state)                         │
│                     │ FORM STATE: VeeValidate + Zod or FormKit                        │
│                     │ UTILITIES: VueUse (200+ composables)                             │
│                     │                                                                  │
│ SvelteKit           │ SERVER STATE:                                                    │
│                     │  1. +page.server.ts load functions (built-in)                    │
│                     │ CLIENT STATE:                                                    │
│                     │  1. Svelte 5 runes ($state, $derived, $effect)                   │
│                     │  2. Svelte stores (writable, readable, derived)                  │
│                     │ FORM STATE: Superforms + Zod                                     │
│                     │                                                                  │
│ Remix               │ SERVER STATE:                                                    │
│                     │  1. loader() + action() (built-in, URL-driven)                   │
│                     │  2. useFetcher() for non-navigation mutations                   │
│                     │ CLIENT STATE:                                                    │
│                     │  1. URL search params (primary state mechanism)                  │
│                     │  2. Zustand (only for truly client-only state)                   │
│                     │ FORM STATE: Conform + Zod (Remix-native validation)             │
│                     │                                                                  │
│ Astro               │ SERVER STATE:                                                    │
│                     │  1. Frontmatter fetch (runs at build/request time)               │
│                     │ CLIENT STATE:                                                    │
│                     │  1. Nano Stores (cross-framework, recommended)                   │
│                     │  2. Framework-specific (React/Vue/Svelte stores in islands)      │
│                     │ FORM STATE: Astro Actions (v4.15+) + Zod                        │
└─────────────────────┴──────────────────────────────────────────────────────────────────┘
```

---

## 7. Framework Profiles

### Next.js (React)
```
Best for:        Full-stack React applications with SSR/SSG needs
Version:         Next.js 15+ (App Router stable, Turbopack stable)
Structure:       App Router (file-based routing), Server Components default
Rendering:       CSR, SSR, SSG, ISR, Streaming, PPR (Partial Prerendering)
State:           TanStack Query + Zustand (client), RSC (server)
Deployment:      Vercel (optimized), any Node.js host, Docker, self-hosted
Team size:       2-100+ developers
Learning curve:  Medium (React knowledge + Next.js conventions + RSC model)
Ecosystem:       Largest (shadcn/ui, Auth.js, Prisma, tRPC, Drizzle)
Key strength:    Server Components, streaming, ISR, PPR, Vercel integration
Key weakness:    Vercel-centric features, complexity for simple apps, RSC learning curve
TypeScript:      Excellent (first-class, strict mode recommended)
Testing:         Jest/Vitest, React Testing Library, Playwright, Cypress
Routing:         File-based (app/), nested layouts, parallel routes, intercepting routes
Build tool:      Turbopack (dev), Webpack 5 (prod) → Turbopack transitioning to prod
Use when:        You need React + SSR + API routes in one project
Avoid when:      Simple static site (use Astro), internal SPA (use Vite React)
```

### Vite + React SPA
```
Best for:        Internal dashboards, admin tools, behind-auth apps
Version:         Vite 6+, React 19+
Structure:       Feature-first (Bulletproof React pattern), client-only
Rendering:       CSR only (no server rendering)
State:           TanStack Query + Zustand
Deployment:      Any static hosting (S3, Cloudflare Pages, Netlify, Vercel)
Team size:       1-30 developers
Learning curve:  Low (just React + Vite)
Ecosystem:       Full React ecosystem (nothing framework-specific)
Key strength:    Simplest setup, fastest dev server, no SSR complexity, smallest abstraction
Key weakness:    No SSR (bad for SEO), no API routes (need separate backend)
TypeScript:      Excellent (Vite has first-class TS support)
Testing:         Vitest, React Testing Library, Playwright
Routing:         TanStack Router (type-safe) or React Router 7
Build tool:      Vite + Rollup (production), esbuild (dev)
Use when:        Internal tool, dashboard, or any app that doesn't need SEO
Avoid when:      Public-facing pages need SEO, need server-side data fetching
```

### Angular
```
Best for:        Large enterprise applications, complex business logic
Version:         Angular 18+ (Signals stable, Zoneless experimental, SSR improved)
Structure:       Feature modules (standalone components default), Nx for monorepo
Rendering:       CSR default, SSR via Angular Universal / @angular/ssr
State:           Angular Signals (built-in), NgRx Signal Store, RxJS
Deployment:      Any static/Node.js hosting, SSR via Express
Team size:       10-200+ developers (enterprise teams)
Learning curve:  High (TypeScript, RxJS, DI, decorators, Angular CLI, Signals)
Ecosystem:       Angular Material, PrimeNG, Nx, CDK
Key strength:    Opinionated (consistency), DI system, enterprise tooling, CLI generators
Key weakness:    Steep learning curve, verbose, smaller hiring pool than React, large bundles
TypeScript:      Best (Angular IS TypeScript — no JS option)
Testing:         Jasmine/Karma (legacy), Jest (recommended), Cypress, Playwright
Routing:         Module-based routing, lazy loading, guards, resolvers
Build tool:      Angular CLI (esbuild-based since v17), Nx
Use when:        Enterprise with Java/.NET teams, complex forms-heavy apps, large teams
Avoid when:      Startup (too heavy), content site, small team, need fast time-to-market
```

### Nuxt 3 (Vue 3)
```
Best for:        Full-stack Vue applications with SSR/SSG
Version:         Nuxt 3.x (stable, Nitro server engine)
Structure:       Convention-based (auto-imports, file-based routing, layers)
Rendering:       CSR, SSR, SSG, ISR, Hybrid (per-route rendering rules)
State:           Pinia (official), useFetch/useAsyncData (built-in)
Deployment:      Vercel, Netlify, Cloudflare Workers, Node.js, Docker, Deno
Team size:       2-50 developers
Learning curve:  Low-Medium (Vue is approachable, Nuxt adds conventions)
Ecosystem:       Nuxt Modules (200+), Nuxt UI, VueUse, UnJS ecosystem
Key strength:    Auto-imports, DX, Nitro server engine, Nuxt Layers, universal deployment
Key weakness:    Smaller ecosystem than React, fewer enterprise references
TypeScript:      Excellent (auto-generated types, strict mode)
Testing:         Vitest, @nuxt/test-utils, Playwright
Routing:         File-based (pages/), layouts, middleware, nested routes
Build tool:      Vite + Nitro (universal server engine)
Use when:        Vue team, full-stack with great DX, SEO-critical app
Avoid when:      Large enterprise (consider Angular), React-heavy team, need RSC
```

### SvelteKit (Svelte 5)
```
Best for:        Full-stack applications with minimal JavaScript
Version:         SvelteKit 2.x, Svelte 5 (runes)
Structure:       File-based routing, $lib for business logic, +page/+server conventions
Rendering:       CSR, SSR, SSG (prerender), Streaming
State:           Svelte 5 runes ($state, $derived, $effect), Svelte stores
Deployment:      Vercel, Netlify, Cloudflare, Node.js, Docker, Deno, Bun
Team size:       1-30 developers
Learning curve:  Low (simplest framework to learn, closest to vanilla HTML/CSS/JS)
Ecosystem:       Growing but smallest of all major frameworks
Key strength:    Smallest bundle sizes, simplest mental model, no virtual DOM, compiled
Key weakness:    Smallest ecosystem, fewer libraries, smallest hiring pool, Svelte 5 churn
TypeScript:      Good (built-in support, but not TypeScript-first like Angular)
Testing:         Vitest, Playwright, @testing-library/svelte
Routing:         File-based (routes/), +page.svelte, +page.server.ts, +layout.svelte
Build tool:      Vite + Svelte compiler
Use when:        Performance-critical, small-medium team, greenfield project
Avoid when:      Large enterprise (limited tooling), team needs extensive UI libraries
```

### Remix / React Router v7
```
Best for:        Full-stack React with web standards focus
Version:         Remix v2 / React Router v7 (merged — same framework)
Structure:       Flat routes, loader/action pattern, .server.ts convention
Rendering:       SSR (default), streaming (defer/Await), SPA mode (optional)
State:           URL state (searchParams), minimal client state, loader/action data
Deployment:      Any Node.js host, Cloudflare Workers, Deno, Netlify, Vercel
Team size:       2-30 developers
Learning curve:  Medium (web standards knowledge required, mental model shift)
Ecosystem:       React ecosystem + Epic Stack (Kent C. Dodds' reference architecture)
Key strength:    Progressive enhancement, nested routing, web standards, form handling
Key weakness:    Merged into React Router (transition confusion), no RSC, smaller community
TypeScript:      Excellent (full type inference from loaders to components)
Testing:         Vitest, Playwright, MSW (Mock Service Worker)
Routing:         File-based (routes/), flat by default, nested via dot notation
Build tool:      Vite (Remix v2+)
Use when:        Forms-heavy apps, progressive enhancement required, web standards focus
Avoid when:      Static site (use Astro), SPA dashboard (use Vite React), need RSC
```

### Astro
```
Best for:        Content sites, blogs, documentation, marketing pages
Version:         Astro 5.x (Content Layer, Server Islands, Actions)
Structure:       Pages, layouts, content collections, islands architecture
Rendering:       SSG (default), SSR (on-demand), Hybrid, Server Islands
State:           Framework-agnostic (React/Vue/Svelte islands), Nano Stores
Deployment:      Any static hosting, Vercel, Netlify, Cloudflare, Node.js
Team size:       1-20 developers
Learning curve:  Low (HTML-first, minimal JS, .astro components are like HTML)
Ecosystem:       Astro integrations (150+), Starlight (docs), content collections
Key strength:    Zero JS by default, multi-framework islands, content collections, Starlight
Key weakness:    Not for app-heavy SPAs, limited interactivity, islands communication
TypeScript:      Good (built-in, content collections type-safe)
Testing:         Vitest, Playwright (limited component testing story)
Routing:         File-based (pages/), content collections, dynamic routes
Build tool:      Vite + Astro compiler
Use when:        Content-first website, documentation, marketing, multi-framework teams
Avoid when:      Interactive dashboard, SPA, real-time app, complex forms, app-heavy
```

---

## 8. Routing Approach Comparison

```
Feature               Next.js              SvelteKit            Remix               Astro              Angular
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Home page             app/page.tsx         routes/+page.svelte  routes/_index.tsx   pages/index.astro  app.routes.ts (path:'')
Dynamic route         app/[id]/page.tsx    routes/[id]/+page    routes/$id.tsx      pages/[id].astro   :id in route config
Catch-all             app/[...slug]/page   routes/[...path]/+p  routes/$.tsx        pages/[...slug]    ** wildcard
Layout                app/layout.tsx       routes/+layout       routes/_app.tsx     layouts/Base.astro  router-outlet nesting
API endpoint          app/api/route.ts     routes/api/+server   routes/api.ts       pages/api/route.ts Separate backend
Error page            app/error.tsx        routes/+error        ErrorBoundary       404.astro          ErrorHandler
Loading               app/loading.tsx      (Suspense)           (useNavigation)     (N/A)              Resolvers
Middleware            middleware.ts        hooks.server.ts      (loaders)           middleware/index.ts Route guards
Server data           Server Component     +page.server.ts      loader function     frontmatter        HttpClient + RxJS
Mutation              Server Action        form action          action function     Astro Action       HttpClient.post()
Route group           (group)/             (group)/             _prefix             (N/A)              loadChildren
Parallel routes       @slot notation       N/A                  N/A                 N/A                Named outlets
Intercepting routes   (.)/(..)/(...) prefix N/A                 N/A                 N/A                N/A
Type-safe routing     next-safe-nav        $lib/types           typed loaders       Content types      RouterLink typed
```

---

## 9. TypeScript Support Quality Comparison

```
┌─────────────────────┬────────┬────────────────────────────────────────────────────────┐
│ Framework           │ Rating │ Details                                                │
├─────────────────────┼────────┼────────────────────────────────────────────────────────┤
│ Angular             │ 10/10  │ Written IN TypeScript. No JS option. Decorators, DI,  │
│                     │        │ forms — all fully typed. Best IDE support.             │
│                     │        │                                                        │
│ Next.js 15+         │ 9/10   │ Excellent TS support. Server/client type boundaries.  │
│                     │        │ Config typed. Route params typed (next-safe-nav).      │
│                     │        │ Server Actions have type inference.                    │
│                     │        │                                                        │
│ Remix/RR7           │ 9/10   │ Loaders/actions have full type inference to component.│
│                     │        │ useLoaderData<typeof loader>() auto-types data.        │
│                     │        │                                                        │
│ Nuxt 3              │ 9/10   │ Auto-generated types. useFetch has typed responses.   │
│                     │        │ Auto-imports are typed. Nitro API routes typed.        │
│                     │        │                                                        │
│ Vite + React        │ 8/10   │ As good as React's TS support. Vite config typed.     │
│                     │        │ No framework magic — standard TS.                      │
│                     │        │                                                        │
│ SvelteKit           │ 7/10   │ Good but not TypeScript-first. .svelte files have     │
│                     │        │ lang="ts" in script. Load functions well-typed.        │
│                     │        │ Svelte 5 runes improved type inference.                │
│                     │        │                                                        │
│ Astro               │ 7/10   │ Frontmatter is TypeScript. Content collections typed. │
│                     │        │ Component props typed. Islands use framework TS.       │
└─────────────────────┴────────┴────────────────────────────────────────────────────────┘
```

---

## 10. Testing Ecosystem Comparison

```
┌─────────────────┬──────────────────┬──────────────────┬───────────────────┬─────────────┐
│ Framework       │ Unit / Component │ Integration      │ E2E               │ Visual Reg. │
├─────────────────┼──────────────────┼──────────────────┼───────────────────┼─────────────┤
│ Next.js         │ Vitest + RTL     │ next/jest or     │ Playwright,       │ Chromatic   │
│                 │                  │ @testing-library │ Cypress            │ Percy       │
│                 │                  │                  │                   │             │
│ Vite React      │ Vitest + RTL     │ Vitest           │ Playwright,       │ Chromatic   │
│                 │                  │                  │ Cypress            │             │
│                 │                  │                  │                   │             │
│ Angular         │ Jest + TestBed   │ TestBed + HTTP   │ Playwright,       │ Chromatic   │
│                 │ (or Jasmine)     │ mocking          │ Cypress            │             │
│                 │                  │                  │                   │             │
│ Nuxt 3          │ Vitest +         │ @nuxt/test-utils │ Playwright         │ Percy       │
│                 │ @vue/test-utils  │ (mountSuspended) │                   │             │
│                 │                  │                  │                   │             │
│ SvelteKit       │ Vitest +         │ Vitest           │ Playwright         │ Percy       │
│                 │ @testing-library │                  │                   │             │
│                 │ /svelte          │                  │                   │             │
│                 │                  │                  │                   │             │
│ Remix           │ Vitest + RTL     │ createRemixStub  │ Playwright,       │ Percy       │
│                 │                  │                  │ Cypress            │             │
│                 │                  │                  │                   │             │
│ Astro           │ Vitest (limited) │ Container API    │ Playwright         │ Percy       │
│                 │                  │ (@astrojs/test)  │                   │             │
└─────────────────┴──────────────────┴──────────────────┴───────────────────┴─────────────┘
RTL = React Testing Library

Testing Maturity Ranking:
1. Angular (built-in testing from day one, TestBed, comprehensive)
2. Next.js / React SPA (React Testing Library is gold standard)
3. Nuxt 3 (@nuxt/test-utils maturing rapidly)
4. Remix (createRemixStub for loader/action testing)
5. SvelteKit (growing but smaller testing ecosystem)
6. Astro (limited component testing, relies on E2E)
```

---

## 11. Learning Curve Assessment

```
┌─────────────────┬────────────┬────────────────────────────────────────────────────────┐
│ Framework       │ Difficulty │ What You Need to Learn                                 │
├─────────────────┼────────────┼────────────────────────────────────────────────────────┤
│ Astro           │ EASY       │ HTML, CSS, basic JS. Astro components = enhanced HTML. │
│                 │ (1-2 weeks)│ Islands if you need interactivity. Content collections. │
│                 │            │                                                        │
│ SvelteKit       │ EASY       │ Svelte syntax (close to HTML), runes ($state),         │
│                 │ (2-3 weeks)│ file-based routing, +page/+server conventions.         │
│                 │            │                                                        │
│ Vite React SPA  │ MEDIUM     │ React fundamentals (hooks, JSX, state), Vite config,  │
│                 │ (3-4 weeks)│ React Router, state management (Zustand/TanStack).     │
│                 │            │                                                        │
│ Nuxt 3          │ MEDIUM     │ Vue 3 (Composition API, reactivity), Nuxt conventions, │
│                 │ (3-4 weeks)│ auto-imports, Nitro server, Pinia.                     │
│                 │            │                                                        │
│ Next.js         │ MEDIUM-HIGH│ React, RSC model (server vs client), App Router,       │
│                 │ (4-6 weeks)│ Server Actions, caching/revalidation, middleware.      │
│                 │            │                                                        │
│ Remix           │ MEDIUM-HIGH│ React, web standards (Request/Response, FormData),     │
│                 │ (4-6 weeks)│ loader/action pattern, progressive enhancement.        │
│                 │            │                                                        │
│ Angular         │ HIGH       │ TypeScript (advanced), RxJS, DI, decorators, modules,  │
│                 │ (6-12 weeks│ Signals, forms (reactive/template), CLI, routing,       │
│                 │  for prod) │ change detection, lifecycle hooks, NgRx.               │
└─────────────────┴────────────┴────────────────────────────────────────────────────────┘
```

---

## 12. Job Market & Community (2025 Data)

```
┌─────────────────────┬──────────────────┬─────────────────┬──────────────────────────────────┐
│ Framework           │ Job Market Size  │ GitHub Stars    │ Hiring Pool Assessment            │
├─────────────────────┼──────────────────┼─────────────────┼──────────────────────────────────┤
│ React (any)         │ MASSIVE          │ 230k+           │ Largest pool globally. Easy hire. │
│ Next.js             │ VERY LARGE       │ 130k+           │ Most React devs know Next.js.    │
│ Angular             │ LARGE            │ 96k+            │ Strong in enterprise/consulting.  │
│ Vue / Nuxt          │ LARGE            │ 208k+ / 55k+   │ Popular in EU/Asia, growing US.  │
│ Svelte / SvelteKit  │ SMALL            │ 80k+ / 19k+    │ Small but passionate community.   │
│ Remix               │ SMALL            │ 30k+            │ Niche, merged into React Router. │
│ Astro               │ SMALL-MEDIUM     │ 48k+            │ Growing, content-focused niche.   │
└─────────────────────┴──────────────────┴─────────────────┴──────────────────────────────────┘

Weekly npm downloads (approximate, 2025):
  React:       28M+
  Next.js:      6M+
  Angular:      3.5M+
  Vue:          5M+
  Nuxt:         800K+
  Svelte:       700K+
  SvelteKit:    350K+
  Remix:        300K+
  Astro:        500K+

RULE: For startups — choose React/Next.js (largest hiring pool).
RULE: For enterprise — Angular or Next.js (enterprise tooling and support).
RULE: For small teams — SvelteKit (simplest) or Astro (content sites).
RULE: NEVER choose a framework that only 1 team member knows deeply.
```

---

## 13. Server/Client Boundary Enforcement

```
┌─────────────────────┬──────────────────────────────────────────────────────────────┐
│ Framework           │ How Server-Only Code is Enforced                              │
├─────────────────────┼──────────────────────────────────────────────────────────────┤
│ Next.js             │ 'use client' / 'use server' directives, server-only pkg      │
│                     │ Default: ALL components are Server Components in App Router   │
│                     │ Secret leak prevention: server-only package throws at build   │
│                     │                                                              │
│ Vite React SPA      │ N/A (everything is client-side)                              │
│                     │ API keys MUST be in backend, never in frontend .env           │
│                     │                                                              │
│ Angular             │ N/A (separate backend required for server logic)              │
│                     │ Angular Universal for SSR but no server/client boundary       │
│                     │                                                              │
│ Nuxt 3              │ server/ directory isolation — code here never reaches client  │
│                     │ Auto-import separation between client and server composables  │
│                     │ useRequestHeaders() only available in SSR context             │
│                     │                                                              │
│ SvelteKit           │ $lib/server/ enforced at build — importing from client fails  │
│                     │ .server.ts suffix excluded from client bundle automatically   │
│                     │ +page.server.ts runs only on server (never sent to client)    │
│                     │                                                              │
│ Remix               │ .server.ts suffix excludes from client bundle                 │
│                     │ loader() and action() run only on server                      │
│                     │ serverOnly$ API for additional server isolation               │
│                     │                                                              │
│ Astro               │ Server-only by default — ALL .astro frontmatter is server     │
│                     │ client:* directives opt-in to client hydration                │
│                     │ Server Islands (Astro 5) for per-component SSR               │
└─────────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 14. Migration Paths

```
Common migration scenarios:

CRA (Create React App) dying?
  └── Migrate to: Vite React SPA (simplest, 1:1 migration)
      OR Next.js (if SSR needed — larger migration)
      Migration effort: Vite (1-2 days), Next.js (1-2 weeks)

Pages Router → App Router (Next.js):
  └── Incremental: coexist pages/ and app/, migrate route by route
  └── Key changes: getServerSideProps → async Server Components,
      getStaticProps → generateStaticParams + fetch,
      API routes → Route Handlers (app/api/route.ts)
  └── Migration effort: 2-8 weeks depending on app size

Vue 2 → Vue 3:
  └── Use Composition API migration build, then consider Nuxt 3
  └── Options API still works in Vue 3 — incremental migration
  └── Migration effort: 2-6 weeks

Angular NgModules → Standalone:
  └── Incremental: standalone components work alongside modules
  └── Angular CLI schematics available for automated migration
  └── Migration effort: 1-4 weeks

Remix → React Router v7:
  └── Almost 1:1: rename imports from @remix-run/* to react-router
  └── Vite plugin changes. Most code is identical.
  └── Migration effort: 1-3 days

WordPress → Modern framework:
  └── Astro (content-first) or Next.js (WordPress as headless CMS via WPGraphQL)
  └── Migration effort: 2-8 weeks depending on content complexity

Gatsby → Modern SSG:
  └── Astro (content) or Next.js (app-like)
  └── Content layer migration is the main work
  └── Migration effort: 1-4 weeks

Express + React → Full-stack framework:
  └── Next.js or Remix (consolidate server + client)
  └── Express API routes → Next.js Route Handlers or Remix loaders
  └── Migration effort: 2-6 weeks

ANY framework → ANY framework:
  └── Business logic in hooks/composables is often portable
  └── UI components must be rewritten (framework-specific)
  └── Data fetching layer is most framework-coupled
  └── CSS/Tailwind classes are 100% portable
```

---

## 15. Configuration Examples

### Next.js (next.config.ts)
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Turbopack (stable in Next.js 15+)
  // No config needed — `next dev --turbopack`

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.example.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Redirect and rewrite rules
  async redirects() {
    return [
      { source: '/old-page', destination: '/new-page', permanent: true },
    ];
  },

  // Headers (security)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  // Experimental features
  experimental: {
    ppr: true,            // Partial Prerendering
    typedRoutes: true,    // Type-safe routes
  },
};

export default nextConfig;
```

### Vite + React (vite.config.ts)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: { port: 3000 },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

### Angular (angular.json excerpt)
```json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/my-app",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": [],
            "tsConfig": "tsconfig.app.json",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.scss"],
            "budgets": [
              { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
              { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
            ]
          }
        }
      }
    }
  }
}
```

### Astro (astro.config.mjs)
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://example.com',
  output: 'hybrid',         // Static by default, SSR opt-in
  adapter: vercel(),
  integrations: [
    react(),                 // React islands
    tailwind(),
    mdx(),
    sitemap(),
  ],
  markdown: {
    shikiConfig: { theme: 'github-dark' },
  },
  vite: {
    build: { assetsInlineLimit: 4096 },
  },
});
```

---

## 16. Anti-Patterns in Framework Selection

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Hype-driven selection** | Choosing framework because it's trending on Twitter/X | Evaluate against project requirements, not popularity |
| **Resume-driven development** | Team wants to learn new framework on production project | Use proven frameworks for production, experiment on side projects |
| **Overengineering** | Next.js App Router with RSC for a simple internal dashboard with 3 pages | Use Vite React SPA — no SSR overhead needed |
| **Underengineering** | Vite React SPA for SEO-critical e-commerce site | Use Next.js or Nuxt 3 — SSR is essential for SEO |
| **Framework lock-in fear** | Avoiding all frameworks, building from scratch with vanilla JS | Framework lock-in is a feature — consistency and ecosystem access |
| **Multiple frameworks in one project** | React + Vue + Angular in the same repo (except Astro) | Pick ONE framework. Astro is the only valid multi-framework choice |
| **Ignoring team expertise** | Vue team forced to learn React because "React is bigger" | Leverage existing team skills unless there's a compelling technical reason |
| **Static site with full SSR** | Running a Node.js server for a blog with 50 static pages | Use Astro or Next.js static export — no server needed |
| **SPA for content site** | React SPA for a blog — no SEO, slow initial load | Use Astro (content-first) or Next.js with SSR |
| **Mixing framework versions** | Pages Router AND App Router with no migration plan | Commit to App Router for new routes, plan migration for old |
| **Premature optimization** | Choosing Svelte "for performance" when app has 10 users | Bundle size doesn't matter at 10 users. Pick for DX and ecosystem |
| **Wrong rendering strategy** | SSR for a dashboard behind auth — server cost for no SEO benefit | CSR (SPA) for auth-gated apps. SSR only when SEO/performance requires it |
| **Ignoring deployment target** | Next.js with ISR on a platform that doesn't support it | Match framework features to deployment platform capabilities |
| **Framework as architecture** | "We use React" as the entire architecture decision | Framework is UI layer. Still need data, state, routing, testing strategies |

---

## 17. Enforcement Checklist

### Framework Selection
- [ ] **Requirements documented** — project type, SEO needs, interactivity level defined
- [ ] **Team skills assessed** — existing expertise in React/Vue/Angular/Svelte evaluated
- [ ] **Decision tree followed** — framework choice justified by project requirements, not preference
- [ ] **Rendering strategy chosen** — CSR/SSR/SSG/ISR/Streaming selected based on content type
- [ ] **Performance budget set** — initial load time, bundle size, LCP, FCP targets defined

### Ecosystem Evaluation
- [ ] **State management chosen** — server state and client state solutions selected
- [ ] **UI component library selected** — shadcn/ui, Radix, Material, PrimeNG, etc.
- [ ] **Form library selected** — React Hook Form, Conform, VeeValidate, Superforms
- [ ] **Testing strategy defined** — unit, integration, E2E tools selected
- [ ] **Authentication approach** — Auth.js, Clerk, Lucia, custom JWT, etc.

### Team & Long-term
- [ ] **Hiring pool considered** — team can hire developers for chosen framework
- [ ] **Migration path exists** — if migrating, incremental strategy documented
- [ ] **POC validated** — proof-of-concept confirms framework meets requirements
- [ ] **ADR written** — Architecture Decision Record documents the choice and rationale
- [ ] **No hype-driven choice** — decision based on constraints, not trends
- [ ] **Deployment platform compatible** — framework features work on chosen host
- [ ] **Build time acceptable** — SSG build time for page count is within budget
- [ ] **Developer experience tested** — dev server speed, HMR, error messages evaluated
