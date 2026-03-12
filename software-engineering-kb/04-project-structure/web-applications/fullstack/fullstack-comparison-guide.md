# Full-Stack Framework Comparison & Decision Guide — Complete Specification

> **AI Plugin Directive:** When the user needs to choose a full-stack meta-framework or is deciding between monolith vs separate frontend/backend, ALWAYS consult this guide. Use the decision matrix to recommend the right approach based on project constraints.

**Core Rule: Choose full-stack only when the frontend IS the primary API consumer. If multiple clients (mobile, third-party) need the same API, use a separate backend. Full-stack frameworks optimize for single-team, single-client delivery.**

---

## 1. Decision Tree: Full-Stack vs Separate

```
START: Who consumes the API?
│
├── Only this web frontend?
│   ├── Team is 1-5 developers? ──→ Full-Stack (monolith)
│   │   ├── Need end-to-end type safety? ──→ T3 Stack
│   │   ├── Need React + RSC? ──→ Next.js Full-Stack
│   │   ├── Need Vue ecosystem? ──→ Nuxt 3 Full-Stack
│   │   ├── Need forms + progressive enhancement? ──→ Remix Full-Stack
│   │   ├── Need smallest bundles? ──→ SvelteKit Full-Stack
│   │   └── Need content + some interactivity? ──→ Astro with server endpoints
│   │
│   ├── Team is 5-15 developers? ──→ Full-Stack OR separate (depends on skill mix)
│   │   ├── All TypeScript team? ──→ Full-Stack (Next.js or T3)
│   │   ├── Frontend + Backend specialists? ──→ Separate repos
│   │   └── Mix of skills? ──→ Full-Stack with clear server/ boundaries
│   │
│   └── Team is 15+ developers? ──→ Separate frontend + backend
│       └── Full-stack becomes coordination bottleneck at this scale
│
├── Web + Mobile app?
│   ├── Mobile uses same data? ──→ Separate backend (REST/GraphQL)
│   │   ├── TypeScript everywhere? ──→ Backend: NestJS + tRPC, Frontend: Next.js
│   │   └── Performance critical? ──→ Backend: Go/.NET, Frontend: any framework
│   └── Mobile has different needs? ──→ Full-stack web + BFF for mobile
│
├── Public API for third parties?
│   └── ──→ ALWAYS separate backend (versioned REST/GraphQL, OpenAPI docs)
│
└── Multiple internal services consume it?
    └── ──→ Separate backend (microservice architecture)

EXCEPTIONS:
- tRPC server can be extracted as standalone (T3 → standalone API)
- Next.js Route Handlers can serve as API for mobile (with trade-offs)
- Nuxt Nitro server can deploy independently from frontend
```

### Decision Tree: Edge Runtime

```
Do you need edge deployment?
│
├── YES → What runs at the edge?
│   ├── Entire app at edge? ──→ SvelteKit + Cloudflare, Nuxt + Cloudflare
│   ├── Middleware at edge, SSR at origin? ──→ Next.js (default behavior)
│   ├── Static + dynamic islands at edge? ──→ Astro + Cloudflare
│   └── API routes at edge? ──→ Any framework with edge adapter
│
└── NO → Deploy to any Node.js runtime
    ├── Vercel/Netlify → Next.js, Nuxt, SvelteKit, Remix, Astro (all supported)
    ├── Docker/K8s → Any framework (Node.js container)
    └── Traditional hosting → Any framework with node adapter
```

---

## 2. Framework Comparison Matrix

### Comprehensive Feature Matrix

```
┌─────────────────────────┬─────────────┬─────────────┬─────────────┬──────────┬─────────────┬──────────┬──────────┐
│ Feature                 │ Next.js     │ Nuxt 3      │ Remix/RR7   │ T3 Stack │ SvelteKit   │ Astro    │ Blitz.js │
│                         │ Full-Stack  │ Full-Stack  │ Full-Stack  │          │ Full-Stack  │          │          │
├─────────────────────────┼─────────────┼─────────────┼─────────────┼──────────┼─────────────┼──────────┼──────────┤
│ UI Framework            │ React 19    │ Vue 3       │ React 19    │ React 19 │ Svelte 5    │ Multi*   │ React    │
│ Server Engine           │ Node/Edge   │ Nitro       │ Node/CF/Deno│ Node     │ Node/CF/Deno│ Node/CF  │ Node     │
│ Data Fetching (server)  │ RSC + fetch │ useFetch    │ loader()    │ tRPC     │ load()      │ frontmat.│ RPC      │
│ Mutations               │ Server Acts.│ $fetch/API  │ action()    │ tRPC     │ form actions│ Actions  │ mutations│
│ Type Safety             │ Good        │ Good        │ Good        │ BEST     │ Good        │ Good     │ BEST     │
│ Auth Built-in           │ Auth.js     │ nuxt-auth   │ Session     │ Auth.js  │ Lucia*      │ None     │ Built-in │
│ ORM Integration         │ Prisma/Driz │ Prisma/Driz │ Prisma/Driz │ Prisma   │ Prisma/Driz │ Prisma   │ Prisma   │
│ Edge Runtime            │ YES (native)│ YES (Nitro) │ YES (adapt.)│ NO       │ YES(adapt.) │ YES      │ NO       │
│ Streaming SSR           │ YES (RSC)   │ YES         │ YES (defer) │ YES      │ YES         │ Partial  │ YES      │
│ Static Export           │ YES         │ YES         │ SPA mode    │ YES      │ YES         │ YES(dflt)│ NO       │
│ File-based Routing      │ YES         │ YES         │ YES         │ YES      │ YES         │ YES      │ YES      │
│ API Routes              │ Route Hndlr │ Nitro API   │ Resource Rt │ tRPC     │ +server.ts  │ Endpoints│ RPC      │
│ Middleware              │ Edge MW     │ Route MW    │ (loaders)   │ Next MW  │ hooks.server│ MW       │ MW       │
│ Form Handling           │ Server Acts.│ FormKit     │ Native forms│ RHF+tRPC │ Superforms  │ Actions  │ mutations│
│ Image Optimization      │ next/image  │ nuxt-image  │ Manual      │ next/img │ Manual      │ Built-in │ Manual   │
│ SEO                     │ next/head   │ useHead     │ meta funct. │ next/head│ svelte:head │ Built-in │ next/head│
│ Deployment Targets      │ 10+         │ 15+         │ 8+          │ 5+       │ 10+         │ 10+      │ 3+       │
│ Community Size          │ MASSIVE     │ LARGE       │ MEDIUM      │ MEDIUM   │ MEDIUM      │ LARGE    │ SMALL    │
│ Production-Ready        │ YES         │ YES         │ YES         │ YES      │ YES         │ YES      │ BETA     │
│ Active Development      │ Vercel      │ UnJS team   │ Shopify     │ Community│ Svelte team │ Astro    │ Slowing  │
└─────────────────────────┴─────────────┴─────────────┴─────────────┴──────────┴─────────────┴──────────┴──────────┘

* Astro Multi = React, Vue, Svelte, Solid, Preact, Lit all supported
* Lucia auth is community-maintained, not official SvelteKit
```

---

## 3. Framework Profiles

### Next.js Full-Stack
```
CORE PATTERN: React Server Components + Server Actions + Route Handlers

USE WHEN:
- Building a SaaS product with React
- Team already knows React/Next.js
- Need SSR + ISR + static generation flexibility
- Deploying to Vercel (optimized) or self-hosted
- Using Server Components for streaming + performance
- Need Partial Prerendering (PPR) for best of SSG+SSR

AVOID WHEN:
- Need a public REST API for non-web clients (Route Handlers work but aren't optimized for this)
- Team prefers Vue/Svelte
- Need real-time WebSocket-heavy features (better: separate backend)
- Simple content site (use Astro instead)

DATA FLOW:
  Server Component → direct DB call → renders HTML (no API layer needed)
  Client Component → Server Action → DB mutation → revalidate → UI update
  External Client → Route Handler (app/api/) → DB → JSON response

STRENGTHS:
  - RSC reduces client-side JavaScript significantly
  - Server Actions eliminate manual API endpoint creation for mutations
  - PPR: static shell + dynamic holes = best TTFB + fresh content
  - Largest ecosystem (shadcn/ui, Auth.js, Prisma, tRPC)
  - Turbopack for fast dev server

WEAKNESSES:
  - Caching complexity (was confusing in Next.js 14, improved in 15)
  - Vercel-optimized features (ISR works best on Vercel)
  - RSC learning curve (server vs client boundary)
  - Server Actions can be abused (not a replacement for proper API layer)
```

### Nuxt 3 Full-Stack
```
CORE PATTERN: Vue 3 Composition API + Nitro Server Engine + Auto-imports

USE WHEN:
- Team prefers Vue 3 ecosystem
- Want auto-imports and convention-based structure (zero manual imports)
- Need Nitro's universal deployment (Node, Cloudflare Workers, Deno, Bun, etc.)
- Building content-heavy sites with Vue
- Want Nuxt Layers for code sharing across projects

AVOID WHEN:
- Need React ecosystem libraries (shadcn/ui, etc.)
- Team doesn't know Vue
- Need React Server Components (Vue has no equivalent)
- Need largest possible ecosystem

DATA FLOW:
  Page (SSR) → useFetch('/api/users') → Nitro API Route → DB → JSON → Vue component
  Page (CSR) → $fetch('/api/users') → Nitro API Route → DB → JSON → reactive update
  Nitro API → Service Layer → Repository → Database

STRENGTHS:
  - Auto-imports (no import statements for Vue APIs, composables, components)
  - Nitro server engine deploys ANYWHERE (15+ platforms, including edge)
  - Nuxt Layers for modular architecture and code sharing
  - Route rules: per-route rendering strategy (SSR, SSG, ISR, SPA per route)
  - Nuxt DevTools (best DX tools of any framework)
  - UnJS ecosystem (h3, ofetch, unstorage — all framework-agnostic)

WEAKNESSES:
  - No React Server Components equivalent (all components hydrate)
  - Smaller ecosystem than React/Next.js
  - Fewer enterprise case studies
  - Vue 3 Composition API + Nuxt conventions = two things to learn
```

### Remix Full-Stack (React Router v7 Framework Mode)
```
CORE PATTERN: loader/action + Form + progressive enhancement

USE WHEN:
- Building form-heavy applications (CRUD, multi-step forms, wizards)
- Progressive enhancement is critical (must work without JS)
- Want Web Standards (Request/Response, FormData, native <form>)
- Nested routing is core to UX (sidebar + content + detail panes)
- Want fine-grained loading states per route segment
- Using React Router already (Remix IS React Router v7)

AVOID WHEN:
- Building highly interactive SPAs (complex client state like dashboards)
- Need Server Components (Remix uses traditional SSR)
- Need ISR / static generation at scale (Remix is SSR-first)
- Team expects SWR/TanStack Query patterns (Remix has its own data model)

DATA FLOW:
  GET request → loader() → server-side data fetch → SSR HTML → hydrate
  Form submit → action() → server-side mutation → redirect → loader() → updated UI
  useFetcher() → loader/action without navigation (inline mutations)

STRENGTHS:
  - Best progressive enhancement (forms work without JavaScript)
  - Loader/action pattern eliminates loading/error state boilerplate
  - Nested routes with parallel data loading (waterfalls eliminated)
  - Web standards: FormData, Request, Response, Headers
  - Automatic revalidation after mutations
  - Epic Stack (Kent C. Dodds' production reference architecture)

WEAKNESSES:
  - Merged into React Router v7 (naming/brand confusion)
  - No RSC support (traditional SSR + hydration)
  - Smaller community than Next.js
  - No ISR (always SSR or SPA mode, no static optimization)
  - Mental model requires "unlearning" SPA patterns
```

### T3 Stack
```
CORE PATTERN: Next.js + tRPC + Prisma + NextAuth.js + Tailwind CSS

USE WHEN:
- Type safety from database to UI is non-negotiable
- Building with the "TypeScript maximalist" philosophy
- Want the fastest type-safe API layer (tRPC — zero overhead, no schema definition)
- Team is comfortable with TypeScript advanced patterns (generics, inference)
- Small-to-medium team building a SaaS product
- Want opinionated stack with proven integration

AVOID WHEN:
- Need REST API (tRPC is RPC, not REST — no OpenAPI, no curl testing)
- Multiple non-TypeScript clients consume the API (tRPC requires TS client)
- Team is not comfortable with advanced TypeScript (generics, inference)
- Need mobile app consuming the API (unless using tRPC-openapi adapter)
- Project is simple enough that tRPC adds complexity

DATA FLOW:
  RSC → server caller → tRPC router → Prisma → Database (server-side, no HTTP)
  Client Component → React Query (auto) → tRPC HTTP → tRPC router → Prisma → DB
  Types flow: Prisma schema → tRPC router → React Query hooks (ZERO manual typing)

STRENGTHS:
  - End-to-end type safety (change DB schema → TypeScript errors everywhere)
  - tRPC: type-safe API without schema definition, just TypeScript functions
  - React Query integration: automatic caching, optimistic updates, refetching
  - Create-t3-app CLI: scaffolds entire stack in minutes
  - Strong community conventions ("T3 axioms": type safety, modularity)

WEAKNESSES:
  - tRPC is NOT REST (no OpenAPI, no Postman testing, TypeScript-only clients)
  - Coupled to Next.js (tRPC server can be extracted but adds complexity)
  - Advanced TypeScript can intimidate junior developers
  - Prisma ORM has performance limitations at very high scale
  - Auth.js (NextAuth) has rough edges (session handling, edge runtime)

T3 AXIOMS (philosophy):
  1. Solve problems — don't add libraries you don't need
  2. Type safety is not optional — if it's not typed, it's not T3
  3. Bleed responsibly — stable core, experimental edges
```

### SvelteKit Full-Stack
```
CORE PATTERN: +page.svelte + +page.server.ts (load) + form actions

USE WHEN:
- Want the smallest client-side JavaScript bundles
- Team values simplicity and minimal abstraction
- Greenfield project with no framework baggage
- Performance-critical applications
- Want close-to-the-platform code (no virtual DOM, compiled output)

AVOID WHEN:
- Need large component library ecosystem (React has 10x more)
- Large enterprise with hiring needs (small talent pool)
- Need React-specific libraries (no alternatives in Svelte ecosystem)
- Team has strong React/Vue experience (switching has a cost)
- Svelte 5 runes migration is still stabilizing

DATA FLOW:
  GET → +page.server.ts load() → DB query → data prop → +page.svelte renders
  POST → +page.server.ts actions.default → DB mutation → return → page re-renders
  API → +server.ts (GET/POST/PUT/DELETE handlers) → JSON response

STRENGTHS:
  - Smallest bundle sizes of any framework (compiler removes framework overhead)
  - Svelte 5 runes ($state, $derived, $effect) — simplest reactivity model
  - +page.server.ts guarantees server-only execution (no accidental leaks)
  - Form actions with progressive enhancement (like Remix)
  - Adapters for every platform (Node, Cloudflare, Vercel, Deno, Bun, static)

WEAKNESSES:
  - Smallest ecosystem (fewer component libraries, tools, tutorials)
  - Smallest hiring pool (finding Svelte developers is harder)
  - Svelte 5 runes are a paradigm shift (migration from Svelte 4 stores)
  - Limited enterprise adoption (fewer case studies)
  - Testing story is less mature than React/Vue
```

### Astro Full-Stack
```
CORE PATTERN: .astro components + content collections + islands + server endpoints

USE WHEN:
- Content-first site that needs some dynamic features
- Documentation site (Starlight is best-in-class)
- Marketing site with interactive widgets (React/Vue islands)
- Multi-framework team (use React, Vue, Svelte in same project)
- Want zero JavaScript by default (only ship JS for interactive islands)

AVOID WHEN:
- Building a full SPA (dashboard, complex state)
- Real-time features (chat, collaboration)
- Complex forms and mutations (use Remix or Next.js)
- Need heavy client-side interactivity on every page

DATA FLOW:
  Static page → build-time data fetch → HTML (no JS shipped)
  Dynamic page → request-time frontmatter → HTML (opt-in SSR)
  Island → client:load/visible/idle → framework component hydrates independently
  Action → Astro.actions.formSubmit() → server handler → return data

STRENGTHS:
  - Zero JS by default (best Lighthouse scores possible)
  - Content collections with type-safe schemas (Zod)
  - Starlight: best documentation framework available
  - Server Islands (Astro 5): per-component SSR with caching
  - Multi-framework: React, Vue, Svelte, Solid, Preact, Lit — mix and match

WEAKNESSES:
  - NOT for app-heavy SPAs (islands don't share state easily)
  - Limited interactivity between islands
  - Form handling less mature than Remix/Next.js
  - Not a "full-stack" framework in the traditional sense
  - Client-side routing is opt-in (full page loads by default, View Transitions API mitigates)
```

### Blitz.js
```
CORE PATTERN: Next.js + zero-API layer (RPC inspired by Ruby on Rails)

USE WHEN:
- Want Rails-like productivity with TypeScript/React
- Like the T3 philosophy but want built-in auth/routing/db setup
- Small team building a monolithic SaaS product

AVOID WHEN:
- Need production stability (Blitz development has slowed significantly)
- Need large community support
- Building anything larger than a small SaaS

STATUS: Development has slowed. Consider T3 Stack or Next.js full-stack instead.
The toolkit (blitz-auth, blitz-rpc) can be used with any Next.js app.
```

---

## 4. Data Fetching Patterns Deep Dive

### Server-Side Data Fetching

```typescript
// ─── Next.js (App Router) ─── React Server Component ───
// app/users/page.tsx — NO "use client", runs on server ONLY
import { db } from '@/lib/db';

export default async function UsersPage() {
  const users = await db.user.findMany(); // Direct DB access, no API
  return (
    <ul>
      {users.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}

// ─── Nuxt 3 ─── useFetch composable (SSR-aware) ───
// pages/users.vue
<script setup lang="ts">
const { data: users, pending, error } = await useFetch('/api/users');
// useFetch is SSR-aware: fetches on server, deduplicates on client
</script>

// ─── Remix ─── loader function ───
// routes/users.tsx
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { db } from '~/lib/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const users = await db.user.findMany();
  return { users }; // Automatically typed in component
}

export default function Users() {
  const { users } = useLoaderData<typeof loader>();
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// ─── SvelteKit ─── +page.server.ts load function ───
// routes/users/+page.server.ts
import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const users = await db.user.findMany();
  return { users }; // Type-safe, available as data prop
};
// routes/users/+page.svelte
<script lang="ts">
  let { data } = $props(); // Svelte 5 — typed from load function
</script>

// ─── T3 Stack ─── tRPC server caller (RSC) ───
// app/users/page.tsx (Server Component)
import { api } from '~/trpc/server';

export default async function UsersPage() {
  const users = await api.user.getAll(); // Type-safe, no HTTP
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### Mutation Patterns

```typescript
// ─── Next.js ─── Server Action ───
// app/users/actions.ts
'use server';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

export async function createUser(formData: FormData) {
  const parsed = CreateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });
  if (!parsed.success) return { error: parsed.error.flatten() };
  await db.user.create({ data: parsed.data });
  revalidatePath('/users');
}

// ─── Remix ─── action function ───
// routes/users.tsx
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const name = formData.get('name');
  const email = formData.get('email');
  await db.user.create({ data: { name, email } });
  return redirect('/users'); // Automatic revalidation
}
// In component: <Form method="post"> (works without JS!)

// ─── SvelteKit ─── form action ───
// routes/users/+page.server.ts
export const actions = {
  create: async ({ request }) => {
    const data = await request.formData();
    await db.user.create({
      data: { name: data.get('name'), email: data.get('email') }
    });
    // Page automatically re-renders with fresh data
  }
};
// In +page.svelte: <form method="POST" action="?/create">

// ─── T3 Stack ─── tRPC mutation ───
// server/api/routers/user.ts
export const userRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.create({ data: input });
    }),
});
// In component: const createUser = api.user.create.useMutation();
```

---

## 5. Form Handling Comparison

```
┌──────────────────┬──────────────────────────────────────────────────────────────┐
│ Framework        │ Form Handling Approach                                       │
├──────────────────┼──────────────────────────────────────────────────────────────┤
│ Next.js          │ Server Actions + useActionState hook                         │
│                  │ - Works with React Hook Form for client validation           │
│                  │ - Progressive enhancement: form works without JS             │
│                  │ - Optimistic updates with useOptimistic hook                 │
│                  │ - Validate with Zod on server, conform for progressive       │
│                  │                                                              │
│ Nuxt 3           │ FormKit (official recommendation) or VeeValidate + Zod       │
│                  │ - $fetch() to Nitro API endpoints for submission              │
│                  │ - useFetch() with watch for dependent data                   │
│                  │ - No native "form actions" like Remix/SvelteKit              │
│                  │                                                              │
│ Remix/RR7        │ BEST form handling of any framework                          │
│                  │ - <Form method="post"> submits to action() function          │
│                  │ - Progressive enhancement by default (works without JS)      │
│                  │ - useActionData() for server validation errors                │
│                  │ - useFetcher() for inline mutations (no navigation)          │
│                  │ - useNavigation() for pending/submitting states              │
│                  │ - Conform library for progressive validation                 │
│                  │                                                              │
│ T3 Stack         │ React Hook Form + Zod + tRPC mutation                        │
│                  │ - Client validates with Zod schema                           │
│                  │ - Same Zod schema validates on server (tRPC input)          │
│                  │ - Type-safe from form to database                            │
│                  │ - No progressive enhancement (requires JS)                  │
│                  │                                                              │
│ SvelteKit        │ Superforms (recommended) + Zod                               │
│                  │ - Form actions with progressive enhancement                  │
│                  │ - use:enhance for client-side enhancement                   │
│                  │ - $form store for reactive form state                        │
│                  │ - Server + client validation with same schema               │
│                  │                                                              │
│ Astro            │ Astro Actions (v4.15+) + Zod                                 │
│                  │ - actions.formSubmit() for form handling                     │
│                  │ - Works with any UI framework in islands                    │
│                  │ - Server validation with Zod schemas                        │
└──────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 6. Authentication Comparison

```
┌──────────────────┬────────────────────────────────────────────────────────────────┐
│ Framework        │ Authentication Options                                         │
├──────────────────┼────────────────────────────────────────────────────────────────┤
│ Next.js          │ 1. Auth.js / NextAuth.js v5 (most popular, OSS, many providers│
│                  │ 2. Clerk (commercial, best DX, hosted UI components)           │
│                  │ 3. Lucia Auth (lightweight, self-hosted, DB-backed sessions)   │
│                  │ 4. Supabase Auth (if using Supabase as backend)               │
│                  │ 5. Custom JWT + middleware                                     │
│                  │ RECOMMENDED: Clerk (commercial) or Auth.js (open source)       │
│                  │                                                                │
│ Nuxt 3           │ 1. nuxt-auth-utils (official Nuxt module, session-based)      │
│                  │ 2. Sidebase Nuxt Auth (community, wraps Auth.js)              │
│                  │ 3. Custom composable with useCookie + server middleware        │
│                  │ 4. Supabase Auth via @nuxtjs/supabase                         │
│                  │ RECOMMENDED: nuxt-auth-utils (simplest) or Clerk Nuxt         │
│                  │                                                                │
│ Remix/RR7        │ 1. Session-based auth (built-in createCookieSessionStorage)   │
│                  │ 2. remix-auth (Passport.js-like strategies)                   │
│                  │ 3. Custom loader-based auth (check session in every loader)    │
│                  │ RECOMMENDED: Built-in session + remix-auth strategies          │
│                  │                                                                │
│ T3 Stack         │ 1. Auth.js / NextAuth.js (included in create-t3-app)          │
│                  │ 2. Clerk (growing in T3 community)                            │
│                  │ 3. Lucia Auth (lightweight alternative)                       │
│                  │ RECOMMENDED: Auth.js (default T3) or Clerk (better DX)        │
│                  │                                                                │
│ SvelteKit        │ 1. Lucia Auth (most popular in Svelte ecosystem)              │
│                  │ 2. Auth.js @auth/sveltekit (adapter available)                │
│                  │ 3. Custom hooks.server.ts auth (event.locals.user pattern)    │
│                  │ 4. Clerk (SvelteKit adapter available)                        │
│                  │ RECOMMENDED: Lucia (most SvelteKit-native)                    │
│                  │                                                                │
│ Astro            │ 1. Lucia Auth (community adapter)                             │
│                  │ 2. Auth.js @auth/astro (community)                            │
│                  │ 3. Custom middleware auth                                     │
│                  │ RECOMMENDED: External auth service (Clerk, Supabase)           │
└──────────────────┴────────────────────────────────────────────────────────────────┘
```

---

## 7. Deployment Targets Comparison

```
┌───────────────────┬───────────┬───────────┬───────────┬──────────┬───────────┬──────────┐
│ Platform          │ Next.js   │ Nuxt 3    │ Remix/RR7 │ T3 Stack │ SvelteKit │ Astro    │
├───────────────────┼───────────┼───────────┼───────────┼──────────┼───────────┼──────────┤
│ Vercel            │ BEST      │ YES       │ YES       │ BEST     │ YES       │ YES      │
│ Netlify           │ YES       │ YES       │ YES       │ YES      │ YES       │ YES      │
│ Cloudflare Pages  │ YES*      │ YES       │ YES       │ NO       │ YES       │ YES      │
│ Cloudflare Workers│ Edge MW   │ YES(Nitro)│ YES       │ NO       │ YES       │ YES      │
│ AWS Lambda        │ YES       │ YES       │ YES       │ YES      │ YES       │ YES      │
│ Docker/Node.js    │ YES       │ YES       │ YES       │ YES      │ YES       │ YES      │
│ Deno Deploy       │ NO        │ YES       │ YES       │ NO       │ YES       │ YES      │
│ Bun               │ Partial   │ YES       │ Partial   │ Partial  │ YES       │ YES      │
│ Fly.io            │ YES       │ YES       │ YES       │ YES      │ YES       │ YES      │
│ Railway           │ YES       │ YES       │ YES       │ YES      │ YES       │ YES      │
│ Static CDN        │ Export    │ Generate  │ SPA mode  │ Export   │ Prerender │ Default  │
│ Edge Runtime      │ Partial   │ YES       │ YES       │ NO       │ YES       │ YES      │
└───────────────────┴───────────┴───────────┴───────────┴──────────┴───────────┴──────────┘

* Next.js on Cloudflare: via @opennextjs/cloudflare adapter (community, not official)

DEPLOYMENT FLEXIBILITY RANKING:
1. Nuxt 3 (Nitro deploys to 15+ targets natively)
2. SvelteKit (adapters for all major platforms)
3. Astro (adapters for all major platforms)
4. Remix (adapters for most platforms)
5. Next.js (best on Vercel, good on others, some features Vercel-only)
6. T3 Stack (wherever Next.js deploys, but no edge)
```

---

## 8. Project Size Recommendations

```
┌──────────────────────────────┬──────────────────────┬─────────────────────────────────────┐
│ Project Size                 │ Recommended          │ Why                                 │
├──────────────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ Solo dev / hackathon         │ T3 Stack or SvelteKit│ Fastest to productive with safety   │
│ Small startup (1-3 devs)    │ Next.js or Nuxt 3    │ Flexible, great docs, easy deploy   │
│ Medium product (3-8 devs)   │ Next.js or Remix     │ Mature patterns, scalable structure │
│ Large team (8+ devs)        │ Separate FE + BE     │ Independent deploy, team autonomy   │
│ Content/blog platform       │ Astro or Nuxt 3      │ Content collections, SSG/ISR        │
│ E-commerce                  │ Next.js or Remix     │ SSR for SEO, form handling           │
│ Internal tool/dashboard     │ T3 Stack or Vite SPA │ Type safety, no SEO needed          │
│ Enterprise SaaS             │ Next.js → separate   │ Start monolith, extract at scale    │
│ Documentation site          │ Astro (Starlight)    │ Best docs framework available       │
│ Portfolio / personal site   │ Astro or SvelteKit   │ Minimal JS, fast loading            │
│ Multi-tenant platform       │ Next.js full-stack   │ Middleware for tenant routing        │
└──────────────────────────────┴──────────────────────┴─────────────────────────────────────┘
```

---

## 9. Migration Paths

```
Full-Stack → Separate Backend (Scaling Out):

1. Next.js Full-Stack → Extract API to NestJS/FastAPI
   - Keep Next.js for UI (SSR/SSG)
   - Move Server Actions → REST/GraphQL calls
   - Route Handlers → REST API in separate service
   - Prisma schema stays in backend project
   - Timeline: 2-6 weeks for medium app

2. Nuxt 3 Full-Stack → Extract Nitro to standalone API
   - Nitro can deploy as standalone server (h3 framework)
   - Keep Nuxt for UI, point useFetch to external API
   - Nitro server/ directory becomes independent project
   - Timeline: 1-4 weeks

3. T3 Stack → Extract tRPC server
   - tRPC server can run standalone (Express/Fastify adapter)
   - Multiple clients via tRPC HTTP adapter
   - OR convert tRPC routers to REST via trpc-openapi package
   - Keep type safety across repos with shared types package
   - Timeline: 1-3 weeks

4. Remix Full-Stack → Remix as BFF + separate API
   - Loaders call external API instead of direct DB
   - Remix becomes a Backend-for-Frontend (BFF)
   - Keep form handling / progressive enhancement benefits
   - Timeline: 2-4 weeks

5. SvelteKit Full-Stack → SvelteKit as BFF + separate API
   - +page.server.ts load functions call external API
   - +server.ts endpoints proxy to backend
   - Timeline: 1-3 weeks

Between Full-Stack Frameworks:
  Next.js ↔ Remix: Business logic portable, UI needs rewrite of data fetching patterns
  Next.js → Nuxt: Complete rewrite (React → Vue)
  SvelteKit → Next.js: Complete rewrite (Svelte → React)
  T3 → plain Next.js: Remove tRPC layer, add Route Handlers (1-2 weeks)

RULE: Start with full-stack monolith. Extract when:
  - Team grows beyond 8 developers
  - Need mobile app consuming same API
  - Need independent frontend/backend deployment
  - Performance requires specialized backend (Go/.NET)
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Full-stack for public API** | Mobile apps hitting Next.js Route Handlers as primary API | Extract to dedicated backend (NestJS, FastAPI, Go) |
| **tRPC for non-TypeScript clients** | Mobile team can't use tRPC endpoints | Use trpc-openapi to expose REST, or switch to REST backend |
| **No server/client boundary** | Secret keys appearing in client bundle | Use 'use server', .server.ts, server/ directory isolation |
| **Fat server actions** | Server Actions with 200 lines of business logic | Extract to service layer, Server Actions should be thin |
| **Fetching in client when server available** | useEffect + fetch in a Next.js app (ignoring RSC) | Use Server Components for initial data, client fetch for interactivity |
| **Over-fetching in full-stack** | Loading entire user object when only name needed | Use GraphQL, tRPC select, or dedicated DTOs |
| **No input validation** | Trusting client-side validation only | Validate on server (Zod schema) + optional client validation |
| **Auth in middleware only** | No auth check in server actions/loaders | Always validate auth at the data access layer, not just route level |
| **No error boundaries** | Unhandled errors crash entire page | Add error.tsx (Next.js), +error.svelte (SvelteKit), ErrorBoundary (Remix) |
| **Mixing rendering strategies** | SSR and CSR fighting in same component | Clear boundaries: RSC for data, Client Component for interactivity |
| **Premature microservices** | Splitting frontend and backend for 2-developer team | Stay full-stack until team/scale demands separation |

---

## 11. Enforcement Checklist

### Framework Selection
- [ ] **API consumer analysis** — who consumes the API determines full-stack vs separate
- [ ] **Team size evaluated** — full-stack for < 8 devs, separate for larger teams
- [ ] **Framework chosen based on decision tree** — not hype or preference
- [ ] **Type safety requirements** — T3/tRPC for maximum, standard for adequate

### Architecture
- [ ] **Server/client boundary clear** — use server directives, .server.ts files
- [ ] **Data fetching pattern defined** — RSC, loaders, useFetch, or tRPC
- [ ] **Mutation pattern defined** — Server Actions, form actions, or tRPC mutations
- [ ] **Auth strategy selected** — Auth.js, Clerk, Lucia, or custom

### Implementation
- [ ] **Input validation on BOTH client and server** — Zod schemas shared
- [ ] **Error boundaries per route segment** — graceful error handling
- [ ] **Loading states per route** — loading.tsx, +page.server.ts return
- [ ] **SEO metadata set** — title, description, OG tags per page
- [ ] **Environment variables separated** — server vs client (NEXT_PUBLIC_, NUXT_PUBLIC_)

### Deployment
- [ ] **Deployment target chosen** — Vercel, Netlify, Docker, Cloudflare
- [ ] **Edge runtime evaluated** — is it needed? What runs at the edge?
- [ ] **Static export considered** — can any routes be statically generated?
- [ ] **Preview deployments configured** — PR previews for team review

### Future Planning
- [ ] **Extraction plan documented** — when/how to split frontend/backend
- [ ] **API versioning strategy** — if serving non-web clients in the future
- [ ] **Mobile strategy** — will mobile need the same API?

---

## 12. Cross-Reference

| Framework | Detailed Structure Guide |
|-----------|--------------------------|
| Next.js Full-Stack | `nextjs-fullstack-structure.md` |
| Nuxt 3 Full-Stack | `nuxt-fullstack-structure.md` |
| Remix Full-Stack | `remix-fullstack-structure.md` |
| T3 Stack | `t3-stack-structure.md` |
| Astro | `../frontend/astro-structure.md` |
| SvelteKit | `../frontend/svelte-sveltekit-structure.md` |
| Frontend comparison | `../frontend/frontend-comparison-guide.md` |
| Backend comparison | `../backend/backend-comparison-guide.md` |
