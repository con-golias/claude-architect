# Svelte & SvelteKit Project Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I structure a SvelteKit project?", "SvelteKit folder structure?", "SvelteKit routing?", "where do server-side files go in SvelteKit?", "SvelteKit vs standalone Svelte?", or "SvelteKit enterprise structure?", use this directive. SvelteKit is the official meta-framework for Svelte. It provides file-based routing, server-side rendering, API endpoints, and a clear server/client boundary. SvelteKit is to Svelte what Next.js is to React. ALL new Svelte projects MUST use SvelteKit — standalone Svelte (without SvelteKit) is for widget-only use cases.

---

## 1. The Core Rule

**All Svelte projects MUST use SvelteKit as the application framework. SvelteKit uses convention-based file naming (`+page.svelte`, `+layout.svelte`, `+server.ts`) that MUST be followed exactly. The `src/routes/` directory defines the URL structure through the file system. Server-side code (`+page.server.ts`, `+server.ts`) runs ONLY on the server — NEVER import server files in client code. Business logic lives in `src/lib/` which is aliased as `$lib`. Feature organization goes inside `$lib/` with clear server/client separation.**

```
❌ WRONG: Random file structure, no conventions
src/
├── pages/
│   ├── Home.svelte             ← Not SvelteKit convention
│   ├── About.svelte
│   └── UserProfile.svelte
├── components/
│   └── Header.svelte
├── api/
│   └── users.ts                ← Not in routes
└── utils.ts

✅ CORRECT: SvelteKit convention-based structure
src/
├── routes/                     ← File-based routing
│   ├── +page.svelte            ← / (home page)
│   ├── +layout.svelte          ← Root layout
│   ├── about/
│   │   └── +page.svelte        ← /about
│   ├── users/
│   │   ├── +page.svelte        ← /users
│   │   ├── +page.server.ts     ← Server-side load function
│   │   └── [id]/
│   │       ├── +page.svelte    ← /users/:id
│   │       └── +page.server.ts
│   └── api/
│       └── users/
│           └── +server.ts      ← API endpoint /api/users
├── lib/                        ← $lib alias — business logic
│   ├── components/
│   ├── server/                 ← $lib/server — server-only code
│   └── utils/
└── app.html                    ← HTML template
```

---

## 2. Enterprise Structure

### Complete SvelteKit Project

```
my-sveltekit-app/
├── src/
│   ├── routes/                            ← File-based routing (URL structure)
│   │   ├── +page.svelte                   ← / (home)
│   │   ├── +page.server.ts               ← Home page server load
│   │   ├── +layout.svelte                 ← Root layout (nav, footer)
│   │   ├── +layout.server.ts             ← Root layout server load (auth check)
│   │   ├── +error.svelte                  ← Root error page
│   │   │
│   │   ├── (marketing)/                   ← Route group (no URL segment)
│   │   │   ├── +layout.svelte             ← Marketing layout (hero header)
│   │   │   ├── about/
│   │   │   │   └── +page.svelte           ← /about
│   │   │   ├── pricing/
│   │   │   │   └── +page.svelte           ← /pricing
│   │   │   └── blog/
│   │   │       ├── +page.svelte           ← /blog (list)
│   │   │       ├── +page.server.ts        ← Load blog posts
│   │   │       └── [slug]/
│   │   │           ├── +page.svelte       ← /blog/:slug
│   │   │           └── +page.server.ts
│   │   │
│   │   ├── (auth)/                        ← Auth route group
│   │   │   ├── +layout.svelte             ← Centered card layout
│   │   │   ├── login/
│   │   │   │   ├── +page.svelte           ← /login
│   │   │   │   └── +page.server.ts        ← Login form action
│   │   │   ├── register/
│   │   │   │   ├── +page.svelte           ← /register
│   │   │   │   └── +page.server.ts
│   │   │   └── forgot-password/
│   │   │       ├── +page.svelte
│   │   │       └── +page.server.ts
│   │   │
│   │   ├── (app)/                         ← Protected app route group
│   │   │   ├── +layout.svelte             ← App shell (sidebar + header)
│   │   │   ├── +layout.server.ts          ← Auth guard (redirect if not logged in)
│   │   │   ├── dashboard/
│   │   │   │   ├── +page.svelte           ← /dashboard
│   │   │   │   └── +page.server.ts
│   │   │   ├── users/
│   │   │   │   ├── +page.svelte           ← /users
│   │   │   │   ├── +page.server.ts
│   │   │   │   ├── new/
│   │   │   │   │   ├── +page.svelte       ← /users/new
│   │   │   │   │   └── +page.server.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── +page.svelte       ← /users/:id
│   │   │   │       ├── +page.server.ts
│   │   │   │       └── edit/
│   │   │   │           ├── +page.svelte   ← /users/:id/edit
│   │   │   │           └── +page.server.ts
│   │   │   ├── orders/
│   │   │   │   ├── +page.svelte
│   │   │   │   ├── +page.server.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── +page.svelte
│   │   │   │       └── +page.server.ts
│   │   │   └── settings/
│   │   │       ├── +page.svelte
│   │   │       ├── +layout.svelte         ← Settings tabs layout
│   │   │       ├── profile/
│   │   │       │   └── +page.svelte
│   │   │       ├── billing/
│   │   │       │   └── +page.svelte
│   │   │       └── team/
│   │   │           └── +page.svelte
│   │   │
│   │   └── api/                           ← API endpoints (REST)
│   │       ├── users/
│   │       │   ├── +server.ts             ← GET/POST /api/users
│   │       │   └── [id]/
│   │       │       └── +server.ts         ← GET/PUT/DELETE /api/users/:id
│   │       ├── auth/
│   │       │   ├── login/+server.ts       ← POST /api/auth/login
│   │       │   └── logout/+server.ts      ← POST /api/auth/logout
│   │       └── webhooks/
│   │           └── stripe/+server.ts
│   │
│   ├── lib/                               ← $lib alias — ALL business logic
│   │   ├── components/                    ← Shared UI components
│   │   │   ├── ui/                        ← Design system primitives
│   │   │   │   ├── Button.svelte
│   │   │   │   ├── Input.svelte
│   │   │   │   ├── Modal.svelte
│   │   │   │   ├── DataTable.svelte
│   │   │   │   ├── Badge.svelte
│   │   │   │   └── index.ts              ← Barrel export
│   │   │   ├── layout/
│   │   │   │   ├── Header.svelte
│   │   │   │   ├── Sidebar.svelte
│   │   │   │   ├── Footer.svelte
│   │   │   │   └── PageHeader.svelte
│   │   │   └── feedback/
│   │   │       ├── Toast.svelte
│   │   │       ├── Spinner.svelte
│   │   │       └── ErrorMessage.svelte
│   │   │
│   │   ├── features/                      ← Feature-specific code
│   │   │   ├── auth/
│   │   │   │   ├── components/
│   │   │   │   │   ├── LoginForm.svelte
│   │   │   │   │   └── RegisterForm.svelte
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.types.ts
│   │   │   ├── users/
│   │   │   │   ├── components/
│   │   │   │   │   ├── UserCard.svelte
│   │   │   │   │   ├── UserTable.svelte
│   │   │   │   │   └── UserForm.svelte
│   │   │   │   ├── user.service.ts
│   │   │   │   └── user.types.ts
│   │   │   └── orders/
│   │   │       ├── components/
│   │   │       ├── order.service.ts
│   │   │       └── order.types.ts
│   │   │
│   │   ├── server/                        ← $lib/server — server-ONLY code
│   │   │   ├── db/
│   │   │   │   ├── client.ts             ← Prisma/Drizzle client
│   │   │   │   └── schema.ts
│   │   │   ├── auth/
│   │   │   │   ├── session.ts            ← Session management
│   │   │   │   └── password.ts           ← Bcrypt hashing
│   │   │   ├── email/
│   │   │   │   └── send-email.ts
│   │   │   └── stripe/
│   │   │       └── client.ts
│   │   │
│   │   ├── stores/                        ← Svelte stores (client state)
│   │   │   ├── auth.store.ts
│   │   │   ├── ui.store.ts               ← Sidebar open, theme, etc.
│   │   │   ├── toast.store.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/                         ← Pure utility functions
│   │   │   ├── format-date.ts
│   │   │   ├── format-currency.ts
│   │   │   ├── cn.ts                     ← Class name utility (clsx)
│   │   │   └── validators.ts
│   │   │
│   │   ├── types/                         ← Shared TypeScript types
│   │   │   ├── api.ts
│   │   │   ├── pagination.ts
│   │   │   └── index.ts
│   │   │
│   │   └── config/
│   │       ├── site.ts                    ← Site metadata
│   │       └── navigation.ts             ← Navigation items
│   │
│   ├── params/                            ← Parameter matchers
│   │   ├── integer.ts                     ← /users/[id=integer]
│   │   └── slug.ts                        ← /blog/[slug=slug]
│   │
│   ├── hooks.server.ts                    ← Server hooks (middleware)
│   ├── hooks.client.ts                    ← Client hooks (error handling)
│   ├── app.html                           ← HTML template (%sveltekit.head%, %sveltekit.body%)
│   ├── app.css                            ← Global styles
│   └── app.d.ts                           ← Type declarations (Locals, PageData)
│
├── static/                                ← Static assets (served as-is)
│   ├── favicon.png
│   ├── robots.txt
│   └── images/
│       └── og-image.png
│
├── tests/                                 ← E2E tests (Playwright)
│   ├── auth.test.ts
│   ├── users.test.ts
│   └── helpers/
│       └── test-utils.ts
│
├── .env                                   ← Environment variables
├── .env.example
├── svelte.config.js                       ← SvelteKit configuration
├── vite.config.ts                         ← Vite configuration
├── tsconfig.json
├── package.json
├── tailwind.config.ts
└── postcss.config.js
```

---

## 3. SvelteKit File Conventions

### Route File Types

```
┌───────────────────────────┬──────────────────────────────────────────────────┐
│ File                      │ Purpose                                           │
├───────────────────────────┼──────────────────────────────────────────────────┤
│ +page.svelte              │ Page component (UI). Receives data from load().   │
│ +page.ts                  │ Universal load function (runs server + client).   │
│ +page.server.ts           │ Server-only load function + form actions.         │
│ +layout.svelte            │ Layout component. Wraps child pages.              │
│ +layout.ts                │ Universal layout load function.                   │
│ +layout.server.ts         │ Server-only layout load function.                 │
│ +error.svelte             │ Error page. Shown when load() throws.             │
│ +server.ts                │ API endpoint. Exports GET/POST/PUT/DELETE/etc.    │
└───────────────────────────┴──────────────────────────────────────────────────┘

RULE: + prefix is MANDATORY — files without + are NOT processed by SvelteKit.
RULE: .server.ts files NEVER run in the browser. SvelteKit enforces this.
RULE: +page.ts runs on BOTH server and client (universal). Use for public API calls.
RULE: +page.server.ts runs ONLY on server. Use for DB queries and secrets.
```

### Route Group and Dynamic Routes

```
routes/
├── (marketing)/                   ← Route group — no URL impact
│   └── about/+page.svelte        ← /about (NOT /marketing/about)
├── blog/
│   ├── +page.svelte              ← /blog
│   └── [slug]/                   ← Dynamic parameter
│       └── +page.svelte          ← /blog/:slug
├── users/
│   └── [id=integer]/             ← Validated parameter (param matcher)
│       └── +page.svelte          ← /users/:id (only integers)
├── docs/
│   └── [...path]/                ← Rest parameter (catch-all)
│       └── +page.svelte          ← /docs/any/nested/path
└── [[lang]]/                     ← Optional parameter
    └── +page.svelte              ← / or /en or /fr
```

---

## 4. Load Functions and Form Actions

### Server Load Function

```typescript
// routes/(app)/users/+page.server.ts
import { db } from '$lib/server/db/client';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    redirect(302, '/login');
  }

  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 20;

  const [users, total] = await Promise.all([
    db.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    db.user.count(),
  ]);

  return {
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) {
      error(401, 'Unauthorized');
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;

    // Validation
    if (!name || !email) {
      return { success: false, errors: { name: !name ? 'Required' : '', email: !email ? 'Required' : '' } };
    }

    const user = await db.user.create({ data: { name, email } });
    redirect(303, `/users/${user.id}`);
  },

  delete: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    await db.user.delete({ where: { id } });
    return { success: true };
  },
};
```

### Page Component Using Load Data

```svelte
<!-- routes/(app)/users/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import UserTable from '$lib/features/users/components/UserTable.svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import Pagination from '$lib/components/ui/Pagination.svelte';

  export let data: PageData;
</script>

<PageHeader title="Users" description="Manage your team members">
  <a href="/users/new" class="btn btn-primary">Add User</a>
</PageHeader>

<UserTable users={data.users} />

<Pagination {...data.pagination} />
```

---

## 5. Hooks (Middleware)

```typescript
// src/hooks.server.ts — Server middleware
import { db } from '$lib/server/db/client';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const authHandle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get('session');

  if (sessionId) {
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (session && session.expiresAt > new Date()) {
      event.locals.user = session.user;
    }
  }

  return resolve(event);
};

const loggingHandle: Handle = async ({ event, resolve }) => {
  const start = performance.now();
  const response = await resolve(event);
  const duration = performance.now() - start;

  console.log(`${event.request.method} ${event.url.pathname} — ${response.status} (${duration.toFixed(0)}ms)`);
  return response;
};

export const handle = sequence(authHandle, loggingHandle);
```

```typescript
// src/app.d.ts — Type declarations for locals
declare global {
  namespace App {
    interface Locals {
      user: import('$lib/types').User | null;
    }
    interface PageData {
      // Shared page data
    }
    interface Error {
      message: string;
      code?: string;
    }
  }
}
export {};
```

```
RULE: hooks.server.ts is the ONLY server middleware entry point.
RULE: Use sequence() to chain multiple middleware handles.
RULE: Set event.locals for data accessible in all load functions and actions.
RULE: hooks.client.ts handles client-side errors (handleError hook).
RULE: App.Locals type is declared in app.d.ts for type safety.
```

---

## 6. API Endpoints (+server.ts)

```typescript
// routes/api/users/+server.ts
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    error(401, 'Unauthorized');
  }

  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const users = await db.user.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });

  return json({ data: users });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    error(403, 'Forbidden');
  }

  const body = await request.json();

  const user = await db.user.create({
    data: { name: body.name, email: body.email },
  });

  return json({ data: user }, { status: 201 });
};
```

```
RULE: +server.ts exports HTTP method handlers: GET, POST, PUT, PATCH, DELETE, OPTIONS.
RULE: Use json() helper for JSON responses.
RULE: Use error() helper to throw HTTP errors.
RULE: +server.ts and +page.svelte CANNOT coexist in the same directory.
RULE: API endpoints in routes/api/ are for external consumers (mobile apps, webhooks).
RULE: For internal data loading, prefer +page.server.ts load functions over API calls.
```

---

## 7. $lib Structure and Aliasing

```
src/lib/                       ← Aliased as $lib (configured in svelte.config.js)
├── components/                ← Shared UI — importable via $lib/components/...
├── features/                  ← Feature modules — $lib/features/users/...
├── server/                    ← Server-only — $lib/server/... (ENFORCED)
├── stores/                    ← Svelte stores — $lib/stores/...
├── utils/                     ← Utilities — $lib/utils/...
├── types/                     ← Types — $lib/types/...
└── config/                    ← Config — $lib/config/...

CRITICAL RULES:
  - $lib/server/ is ENFORCED by SvelteKit — client code CANNOT import from it.
  - This prevents accidental exposure of database clients, secrets, etc.
  - Put ALL sensitive server code in $lib/server/.
  - $lib (everything else) is available on BOTH server and client.
  - NEVER put database clients, API keys, or secrets outside $lib/server/.
```

---

## 8. Svelte 5 Runes (Latest)

```svelte
<!-- Svelte 5 uses runes for reactivity instead of let/$ syntax -->
<script lang="ts">
  // State
  let count = $state(0);
  let users = $state<User[]>([]);
  let search = $state('');

  // Derived (replaces $: reactive declarations)
  let filteredUsers = $derived(
    users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
  );

  let doubleCount = $derived(count * 2);

  // Effects (replaces $: side effects)
  $effect(() => {
    console.log('Count changed:', count);
    // Cleanup returned function
    return () => console.log('Cleaning up');
  });

  // Props (replaces export let)
  let { title, onSubmit }: { title: string; onSubmit: (data: FormData) => void } = $props();
</script>

<h1>{title}</h1>
<input bind:value={search} placeholder="Search users..." />
<p>Showing {filteredUsers.length} of {users.length} users</p>
```

```
RULE: Svelte 5 projects MUST use runes ($state, $derived, $effect, $props).
RULE: $state() replaces let for reactive variables.
RULE: $derived() replaces $: for computed values.
RULE: $effect() replaces $: for side effects.
RULE: $props() replaces export let for component props.
RULE: Svelte 4 syntax (let, $:, export let) still works but is LEGACY.
```

---

## 9. Stores (Svelte 5 Approach)

```typescript
// lib/stores/auth.store.ts — Using Svelte 5 runes in .svelte.ts files
import { getContext, setContext } from 'svelte';

class AuthState {
  user = $state<User | null>(null);
  isAuthenticated = $derived(!!this.user);
  isAdmin = $derived(this.user?.role === 'admin');

  login(userData: User) {
    this.user = userData;
  }

  logout() {
    this.user = null;
  }
}

const AUTH_KEY = Symbol('auth');

export function setAuthState() {
  return setContext(AUTH_KEY, new AuthState());
}

export function getAuthState() {
  return getContext<AuthState>(AUTH_KEY);
}
```

```typescript
// lib/stores/toast.store.ts — Traditional writable store
import { writable } from 'svelte/store';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,
    add(message: string, type: Toast['type'] = 'info') {
      const id = crypto.randomUUID();
      update(toasts => [...toasts, { id, message, type }]);
      setTimeout(() => this.remove(id), 5000);
    },
    remove(id: string) {
      update(toasts => toasts.filter(t => t.id !== id));
    },
  };
}

export const toasts = createToastStore();
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Not using SvelteKit** | Standalone Svelte with manual routing, SSR setup | Use SvelteKit for ALL application projects |
| **Business logic in routes/** | 200-line +page.svelte with API calls and state | Extract to $lib/features/{name}/ |
| **Importing from $lib/server in client** | Build error or secret exposure | SvelteKit enforces this — keep secrets in $lib/server/ |
| **Using +page.ts instead of +page.server.ts** | Universal load exposes query logic to client bundle | Use .server.ts for DB queries, secrets, server-only code |
| **Calling own API routes internally** | fetch('/api/users') inside +page.server.ts | Use direct DB queries in load functions. API routes are for external clients |
| **No route groups** | Flat routes/ with messy shared layouts | Use (marketing)/, (app)/, (auth)/ groups |
| **No parameter matchers** | /users/abc accepted when only integers valid | Create params/integer.ts and use [id=integer] |
| **Fat +layout.svelte** | Root layout with 100+ lines, complex logic | Extract to components in $lib/components/layout/ |
| **No hooks.server.ts** | Auth check duplicated in every +page.server.ts | Centralize auth in hooks.server.ts, set locals.user |
| **Svelte 4 syntax in Svelte 5** | `export let`, `$:` instead of runes | Use $state(), $derived(), $props() |
| **Global writable stores for server data** | writable() store loaded from server, state mismatch | Use load functions to pass data. Stores for client-only state |
| **No type declarations in app.d.ts** | Untyped locals, untyped page data | Define App.Locals, App.PageData in app.d.ts |

---

## 11. Enforcement Checklist

- [ ] **SvelteKit used** — not standalone Svelte for applications
- [ ] **Convention files** — +page.svelte, +layout.svelte, +server.ts naming
- [ ] **Server code in $lib/server/** — DB clients, secrets, server-only logic
- [ ] **Route groups used** — (marketing), (app), (auth) for layout separation
- [ ] **Load functions for data** — +page.server.ts for server data, not API self-calls
- [ ] **Form actions for mutations** — actions in +page.server.ts, enhance in forms
- [ ] **hooks.server.ts for middleware** — auth, logging, CORS centralized
- [ ] **app.d.ts configured** — App.Locals, App.PageData typed
- [ ] **Parameter matchers** — validated dynamic route params
- [ ] **Feature code in $lib/** — business logic NOT in routes/
- [ ] **Svelte 5 runes** — $state, $derived, $effect, $props (not legacy syntax)
- [ ] **Barrel exports** — index.ts in $lib subdirectories
- [ ] **Static assets in static/** — not src/
- [ ] **E2E tests** — Playwright tests in tests/ directory
