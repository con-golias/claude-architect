# Remix Project Structure

> **Domain:** Project Structure > Web > Frontend
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2025

---

## Overview

Remix is a full-stack React framework focused on web standards (Request, Response, FormData,
headers, cookies). It has evolved significantly: Remix v2 introduced flat routes by default,
and in 2024-2025 Remix merged with React Router (v7+), making React Router the framework and
Remix the brand. This guide covers Remix v2 conventions and the React Router v7 "framework mode"
which inherits them.

Key philosophy: Remix pushes developers toward web fundamentals -- progressive enhancement,
HTTP caching, form submissions, and server-rendered UI. The loader/action pattern replaces
traditional API routes and client-side data fetching.

---

## Why Structure Matters in Remix

- **File-based routing is the architecture**: Route files define not just URLs but also data loading,
  mutations, error handling, and meta tags -- all in one file
- **Flat routes vs nested routes**: Remix v2 defaults to flat routes with dot-delimited naming;
  understanding this is essential to avoid routing bugs
- **Loader/action colocation**: Each route file is a self-contained unit of data + UI + mutations;
  splitting this incorrectly breaks the model
- **Server/client modules**: Using `.server.ts` suffix prevents code from leaking to the client
  bundle
- **Route nesting = layout nesting**: URL segments map to layout nesting via `<Outlet />`;
  misunderstanding this creates layout bugs

---

## Remix v2 / React Router v7 Enterprise Structure

```
my-remix-app/
├── .cache/                              # GENERATED - Remix compiler cache
├── build/                               # GENERATED - production build output
│   ├── client/                          # Client bundle
│   └── server/                          # Server bundle
├── app/                                 # Application source (THE core directory)
│   ├── entry.client.tsx                 # Client entry (hydration)
│   ├── entry.server.tsx                 # Server entry (SSR rendering)
│   ├── root.tsx                         # Root route (html, head, body, scripts)
│   ├── routes/                          # File-based routing (flat by default in v2)
│   │   │
│   │   │── _index.tsx                   # -> / (home page)
│   │   │
│   │   │  # --- Auth routes (grouped under auth layout) ---
│   │   ├── _auth.tsx                    # Auth layout (no URL segment, _ prefix)
│   │   ├── _auth.login.tsx              # -> /login
│   │   ├── _auth.register.tsx           # -> /register
│   │   ├── _auth.forgot-password.tsx    # -> /forgot-password
│   │   │
│   │   │  # --- Dashboard routes ---
│   │   ├── dashboard.tsx                # -> /dashboard layout (with <Outlet />)
│   │   ├── dashboard._index.tsx         # -> /dashboard (index)
│   │   ├── dashboard.analytics.tsx      # -> /dashboard/analytics
│   │   ├── dashboard.settings.tsx       # -> /dashboard/settings
│   │   │
│   │   │  # --- User routes ---
│   │   ├── users.tsx                    # -> /users layout
│   │   ├── users._index.tsx             # -> /users (list)
│   │   ├── users.$userId.tsx            # -> /users/:userId (detail)
│   │   ├── users.$userId.edit.tsx       # -> /users/:userId/edit
│   │   ├── users.new.tsx                # -> /users/new
│   │   │
│   │   │  # --- Blog with MDX ---
│   │   ├── blog.tsx                     # -> /blog layout
│   │   ├── blog._index.tsx              # -> /blog (list)
│   │   ├── blog.$slug.tsx               # -> /blog/:slug (article)
│   │   │
│   │   │  # --- Admin (pathless layout for admin guard) ---
│   │   ├── _admin.tsx                   # Admin layout + auth guard (pathless)
│   │   ├── _admin.admin.tsx             # -> /admin (note: _admin is pathless)
│   │   ├── _admin.admin.users.tsx       # -> /admin/users
│   │   ├── _admin.admin.settings.tsx    # -> /admin/settings
│   │   │
│   │   │  # --- API/Resource routes ---
│   │   ├── api.health.tsx               # -> /api/health (resource route)
│   │   ├── api.webhooks.stripe.tsx      # -> /api/webhooks/stripe
│   │   ├── api.upload.tsx               # -> /api/upload
│   │   │
│   │   │  # --- Utility routes ---
│   │   ├── $.tsx                        # -> /* (catch-all / 404)
│   │   ├── healthcheck.tsx              # -> /healthcheck
│   │   └── manifest[.]webmanifest.tsx   # -> /manifest.webmanifest (escaped dot)
│   │
│   ├── components/                      # Shared React components
│   │   ├── ui/                          # Design system primitives
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── data-table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   └── index.ts                # Barrel exports
│   │   ├── layout/                      # Layout components
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   └── navigation.tsx
│   │   ├── forms/                       # Reusable form components
│   │   │   ├── form-field.tsx
│   │   │   ├── form-error.tsx
│   │   │   ├── submit-button.tsx        # With useNavigation() pending state
│   │   │   └── file-upload.tsx
│   │   └── domain/                      # Feature-specific components
│   │       ├── users/
│   │       │   ├── user-card.tsx
│   │       │   ├── user-table.tsx
│   │       │   └── user-avatar.tsx
│   │       ├── dashboard/
│   │       │   ├── stats-card.tsx
│   │       │   └── activity-feed.tsx
│   │       └── blog/
│   │           ├── blog-card.tsx
│   │           └── blog-list.tsx
│   ├── models/                          # Data access layer (server-only)
│   │   ├── user.server.ts               # .server.ts = never in client bundle
│   │   ├── post.server.ts
│   │   ├── session.server.ts
│   │   └── note.server.ts
│   ├── services/                        # Business logic layer (server-only)
│   │   ├── auth.server.ts               # Authentication logic
│   │   ├── email.server.ts              # Email sending
│   │   ├── stripe.server.ts             # Payment processing
│   │   ├── storage.server.ts            # File storage (S3, etc.)
│   │   └── permissions.server.ts        # RBAC logic
│   ├── utils/                           # Shared utilities
│   │   ├── misc.ts                      # General helpers
│   │   ├── misc.server.ts              # Server-only helpers
│   │   ├── env.server.ts               # Environment variable validation
│   │   ├── db.server.ts                # Database client (Prisma/Drizzle)
│   │   ├── session.server.ts           # Cookie session storage
│   │   ├── csrf.server.ts             # CSRF protection
│   │   ├── toast.server.ts            # Flash messages via cookies
│   │   ├── honeypot.server.ts         # Spam protection
│   │   ├── cache.server.ts            # Cache utilities
│   │   ├── formatters.ts              # Date/currency (shared)
│   │   ├── validators.ts             # Zod schemas (shared)
│   │   ├── constants.ts
│   │   └── singleton.server.ts        # Singleton pattern for dev HMR
│   ├── hooks/                          # React hooks (client-safe)
│   │   ├── use-debounce.ts
│   │   ├── use-double-check.ts
│   │   ├── use-form-validation.ts
│   │   └── use-theme.ts
│   ├── types/                          # Shared TypeScript types
│   │   ├── models.ts
│   │   ├── forms.ts
│   │   └── index.ts
│   └── styles/                         # CSS
│       ├── tailwind.css                # or global.css
│       ├── fonts.css
│       └── animations.css
├── prisma/                              # Prisma ORM (common choice with Remix)
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/                              # Static assets
│   ├── favicon.ico
│   ├── fonts/
│   └── images/
├── tests/
│   ├── setup/
│   │   ├── setup-test-env.ts
│   │   ├── db-setup.ts
│   │   └── mocks/
│   │       └── index.ts
│   ├── integration/
│   │   ├── routes/
│   │   │   ├── login.test.ts
│   │   │   └── dashboard.test.ts
│   │   └── models/
│   │       └── user.test.ts
│   ├── e2e/
│   │   ├── auth.spec.ts
│   │   └── onboarding.spec.ts
│   └── fixtures/
│       ├── users.ts
│       └── posts.ts
├── other/                               # Non-app files
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── scripts/
│       ├── deploy.sh
│       └── seed.ts
├── .env
├── .env.example
├── .eslintrc.cjs
├── remix.config.js                      # or vite.config.ts (Remix + Vite)
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Flat Routes Convention (Remix v2 Default)

Remix v2 uses flat routes by default. The dot (`.`) in filenames creates URL segments:

### Naming Rules

| File Name | URL | Explanation |
|-----------|-----|-------------|
| `_index.tsx` | `/` | Index route |
| `about.tsx` | `/about` | Simple route |
| `users.tsx` | `/users` (layout) | Parent layout with `<Outlet />` |
| `users._index.tsx` | `/users` | Index child of users layout |
| `users.$userId.tsx` | `/users/:userId` | Dynamic segment |
| `users.$userId.edit.tsx` | `/users/:userId/edit` | Nested under dynamic |
| `_auth.tsx` | (pathless) | Layout-only route (no URL segment) |
| `_auth.login.tsx` | `/login` | Child of pathless layout |
| `blog_.tsx` | `/blog` | Trailing underscore = no layout nesting |
| `$.tsx` | `/*` (splat/catch-all) | Catches all unmatched URLs |
| `sitemap[.]xml.tsx` | `/sitemap.xml` | Escaped dot in URL |
| `api.users.tsx` | `/api/users` | Can be used as resource route |

### The Underscore Prefix: Pathless Layouts

```
_auth.tsx              <- This is a LAYOUT (renders <Outlet />)
                          It does NOT add to the URL path
_auth.login.tsx        <- URL is /login (not /auth/login)
_auth.register.tsx     <- URL is /register
```

```tsx
// app/routes/_auth.tsx
export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <Outlet />  {/* login.tsx or register.tsx renders here */}
      </div>
    </div>
  );
}
```

### The Trailing Underscore: Opting Out of Layout

```
dashboard.tsx           <- Layout for /dashboard/*
dashboard._index.tsx    <- /dashboard (inside layout)
dashboard.settings.tsx  <- /dashboard/settings (inside layout)
dashboard_.analytics.tsx <- /dashboard/analytics (OUTSIDE layout, trailing _)
```

---

## Folder-Based Routes (Alternative)

Remix v2 also supports folder-based routes alongside flat routes:

```
app/routes/
├── _index/
│   └── route.tsx                    # -> /
├── dashboard/
│   ├── route.tsx                    # -> /dashboard (layout)
│   ├── _index/
│   │   └── route.tsx               # -> /dashboard (index)
│   └── settings/
│       └── route.tsx               # -> /dashboard/settings
├── users.$userId/
│   ├── route.tsx                    # -> /users/:userId
│   ├── avatar.tsx                   # Co-located component (NOT a route)
│   └── user-form.tsx               # Co-located component (NOT a route)
```

When using folder routes, only `route.tsx` is treated as a route file. All other files
in the folder are co-located modules available for import but NOT registered as routes.

---

## The Loader/Action Pattern

This is the core architectural pattern of Remix:

### Loader (Data Loading -- GET Requests)

```tsx
// app/routes/users.$userId.tsx
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireUser } from '~/services/auth.server';
import { getUserById } from '~/models/user.server';

// SERVER ONLY: runs on the server for every GET request
export async function loader({ params, request }: LoaderFunctionArgs) {
  const currentUser = await requireUser(request); // Redirects if not authed
  const user = await getUserById(params.userId!);

  if (!user) {
    throw new Response('Not Found', { status: 404 });
  }

  return json(
    { user, canEdit: currentUser.role === 'admin' },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  );
}

// CLIENT: receives data from loader
export default function UserPage() {
  const { user, canEdit } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{user.name}</h1>
      {canEdit && <Link to="edit">Edit</Link>}
    </div>
  );
}

// Error boundary for this route
export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <div>{error.status}: {error.data}</div>;
  }
  return <div>Something went wrong</div>;
}
```

### Action (Mutations -- POST/PUT/DELETE Requests)

```tsx
// app/routes/users.$userId.edit.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { z } from 'zod';

const UpdateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
});

export async function loader({ params }: LoaderFunctionArgs) {
  const user = await getUserById(params.userId!);
  if (!user) throw new Response('Not Found', { status: 404 });
  return json({ user });
}

// SERVER ONLY: runs on POST/PUT/PATCH/DELETE
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // Handle different form intents in one action
  switch (intent) {
    case 'update': {
      const result = UpdateUserSchema.safeParse(Object.fromEntries(formData));
      if (!result.success) {
        return json(
          { errors: result.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      await updateUser(params.userId!, result.data);
      return redirect(`/users/${params.userId}`);
    }
    case 'delete': {
      await deleteUser(params.userId!);
      return redirect('/users');
    }
    default:
      throw new Response('Invalid intent', { status: 400 });
  }
}

export default function EditUserPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="update" />
      <input name="name" defaultValue={user.name} />
      {actionData?.errors?.name && <p>{actionData.errors.name}</p>}

      <input name="email" defaultValue={user.email} />
      {actionData?.errors?.email && <p>{actionData.errors.email}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </Form>
  );
}
```

---

## Resource Routes (API Endpoints)

Routes that export a `loader` and/or `action` but NO `default` component export
become resource routes (pure API endpoints):

```tsx
// app/routes/api.users.tsx (Resource route -- no default export)
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

// GET /api/users
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') || '1');
  const users = await getUsers({ page });
  return json(users);
}

// POST /api/users
export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const user = await createUser(body);
  return json(user, { status: 201 });
}
// NOTE: No "export default function" = resource route
```

```tsx
// app/routes/api.webhooks.stripe.tsx
export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.text();
  const sig = request.headers.get('stripe-signature')!;
  const event = stripe.webhooks.constructEvent(payload, sig, WEBHOOK_SECRET);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object);
      break;
    // ...
  }

  return json({ received: true });
}
```

---

## Kent C. Dodds' Patterns (Epic Stack)

Kent C. Dodds is the most influential voice in the Remix ecosystem. His open-source
**Epic Stack** (https://github.com/epicweb-dev/epic-stack) is the gold standard for
enterprise Remix applications. Key patterns:

### 1. The .server.ts Convention

Everything that touches the database, environment variables, or secrets gets `.server.ts`:

```
app/
├── utils/
│   ├── db.server.ts          # Prisma client
│   ├── env.server.ts         # Validated environment variables
│   ├── session.server.ts     # Cookie session creation
│   ├── auth.server.ts        # requireUser(), getUser()
│   ├── toast.server.ts       # Flash messages via session cookies
│   ├── honeypot.server.ts    # Spam protection
│   ├── csrf.server.ts        # CSRF tokens
│   ├── timing.server.ts      # Server timing headers
│   └── monitoring.server.ts  # Error reporting (Sentry)
```

### 2. The Models Directory (Data Access Layer)

```typescript
// app/models/user.server.ts
import { prisma } from '~/utils/db.server';

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(data: CreateUserData) {
  return prisma.user.create({ data });
}

export async function updateUser(id: string, data: UpdateUserData) {
  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
```

### 3. Singleton Pattern for Development

```typescript
// app/utils/singleton.server.ts
// Prevents multiple instances during HMR in development
export function singleton<Value>(name: string, value: () => Value): Value {
  const g = global as any;
  g.__singletons ??= {};
  g.__singletons[name] ??= value();
  return g.__singletons[name];
}

// Usage:
// app/utils/db.server.ts
import { singleton } from './singleton.server';
import { PrismaClient } from '@prisma/client';

export const prisma = singleton('prisma', () => new PrismaClient());
```

### 4. Epic Stack Route Organization

The Epic Stack uses a specific convention for "resource owner" patterns:

```
app/routes/
├── _auth+/                    # Route folder with + suffix
│   ├── login.tsx
│   ├── register.tsx
│   ├── forgot-password.tsx
│   ├── verify.tsx
│   └── logout.tsx
├── users+/
│   ├── $username.tsx          # /users/:username
│   └── $username_+/           # Pathless folder for username-scoped routes
│       ├── notes.tsx           # /users/:username/notes
│       └── notes.$noteId.tsx   # /users/:username/notes/:noteId
├── settings+/
│   ├── profile.tsx
│   └── change-email.tsx
└── resources+/                 # Resource routes (no UI)
    ├── user-images.$imageId.tsx
    ├── note-images.$imageId.tsx
    └── healthcheck.tsx
```

### 5. The "Conform" Pattern for Forms

Kent strongly advocates for the `conform` library with Zod for type-safe forms:

```tsx
import { useForm, getFormProps, getInputProps } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== 'success') {
    return json(submission.reply(), { status: 400 });
  }

  // ... handle valid data
}
```

### 6. Error Monitoring with Request Context

```typescript
// app/entry.server.tsx
import { captureRemixErrorBoundaryError } from '@sentry/remix';

export function handleError(error: unknown, { request }: DataFunctionArgs) {
  if (error instanceof Error) {
    void captureRemixErrorBoundaryError(error);
  }
  console.error(error);
}
```

---

## React Router v7 Framework Mode

Since Remix merged into React Router v7, the file conventions are essentially the same but
the configuration and package names change:

```typescript
// react-router.config.ts (replaces remix.config.js)
import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: 'app',
  ssr: true,
} satisfies Config;
```

```typescript
// vite.config.ts
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter()],
});
```

The route file conventions (`loader`, `action`, `default` component, `ErrorBoundary`) remain
identical. Import paths change from `@remix-run/*` to `react-router`:

```typescript
// Remix v2
import { json, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

// React Router v7 framework mode
import { data, redirect } from 'react-router';
import { useLoaderData } from 'react-router';
```

---

## Best Practices

1. **Keep route files focused**: Each route file should contain its loader, action, component,
   error boundary, meta, headers, and links -- this is the Remix model
2. **Use `.server.ts` religiously**: Any file touching DB, env vars, or secrets MUST have the
   `.server.ts` suffix to prevent client bundle leakage
3. **Models as data access, Services as business logic**: `models/` handles DB queries;
   `services/` handles orchestration (email, payments, complex workflows)
4. **Use resource routes for non-UI endpoints**: Webhooks, image serving, file downloads,
   API endpoints -- all should be resource routes (no default export)
5. **Prefer `<Form>` over `fetch()`**: Remix's `<Form>` component provides progressive enhancement,
   automatic revalidation, and proper pending states
6. **Use the `intent` pattern**: Multiple actions in one route via hidden `intent` field rather
   than separate API endpoints
7. **Error boundaries at every level**: Route-level `ErrorBoundary` exports prevent a single
   route's error from crashing the entire page

---

## Anti-Patterns

### 1. Client-Side Data Fetching Instead of Loaders

```tsx
// BAD: Using useEffect + fetch in Remix
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  return <UserList users={users} />;
}

// GOOD: Use loader -- data is ready before component renders
export async function loader() {
  const users = await getUsers();
  return json({ users });
}

export default function UsersPage() {
  const { users } = useLoaderData<typeof loader>();
  return <UserList users={users} />;
}
```

### 2. Not Using .server.ts for Server Code

```typescript
// BAD: Database client without .server.ts
// app/utils/db.ts  <-- THIS WILL BE IN THE CLIENT BUNDLE
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();

// GOOD: Use .server.ts
// app/utils/db.server.ts  <-- removed from client bundle
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

### 3. Creating Separate API Routes for Form Mutations

```tsx
// BAD: Separate API route + client fetch for a form
// app/routes/api.users.create.tsx
export async function action({ request }) {
  const data = await request.json();
  return json(await createUser(data));
}

// app/routes/users.new.tsx
export default function NewUser() {
  async function handleSubmit(data) {
    await fetch('/api/users/create', { method: 'POST', body: JSON.stringify(data) });
  }
  return <form onSubmit={handleSubmit}>...</form>;
}

// GOOD: Colocated action with the form
// app/routes/users.new.tsx
export async function action({ request }) {
  const formData = await request.formData();
  const user = await createUser(Object.fromEntries(formData));
  return redirect(`/users/${user.id}`);
}

export default function NewUser() {
  return (
    <Form method="post">
      <input name="name" />
      <input name="email" />
      <button type="submit">Create</button>
    </Form>
  );
}
```

### 4. Putting All Routes in Nested Folders (Fighting Flat Routes)

```
// BAD: Trying to use deep folder nesting with flat routes enabled
app/routes/
├── dashboard/
│   ├── index.tsx           # This won't work as expected
│   ├── analytics/
│   │   └── index.tsx       # Nor will this
│   └── settings/
│       └── index.tsx

// GOOD: Use flat route convention
app/routes/
├── dashboard.tsx
├── dashboard._index.tsx
├── dashboard.analytics.tsx
└── dashboard.settings.tsx
```

### 5. Fat Route Files (Kitchen Sink Routes)

```tsx
// BAD: 500+ line route file with everything inline
export async function loader() { /* 50 lines of DB queries */ }
export async function action() { /* 100 lines of form handling */ }
export default function Page() { /* 300 lines of JSX with inline styles */ }

// GOOD: Extract, keep route files as orchestrators
import { getPageData } from '~/models/page.server';
import { handlePageAction } from '~/services/page.server';
import { PageView } from '~/components/domain/page/page-view';

export async function loader({ params }: LoaderFunctionArgs) {
  return json(await getPageData(params.id!));
}

export async function action({ request }: ActionFunctionArgs) {
  return handlePageAction(request);
}

export default function Page() {
  const data = useLoaderData<typeof loader>();
  return <PageView data={data} />;
}
```

### 6. Misunderstanding Layout Nesting

```tsx
// MISUNDERSTANDING: "Why does /users/new show the users list layout?"

// app/routes/users.tsx            <- This is a LAYOUT for all /users/* routes
// app/routes/users._index.tsx     <- /users (rendered inside users.tsx Outlet)
// app/routes/users.new.tsx        <- /users/new (ALSO rendered inside users.tsx Outlet)

// If you DON'T want users.new to be nested inside users.tsx layout:
// app/routes/users_.new.tsx       <- Trailing underscore opts out of users layout
```

---

## Real-World Examples and References

- **Epic Stack** (Kent C. Dodds): The definitive enterprise Remix starter
  (https://github.com/epicweb-dev/epic-stack) -- production-grade authentication,
  permissions, monitoring, testing, deployment
- **Remix Indie Stack / Blues Stack**: Official Remix starters with varying complexity
  (https://github.com/remix-run/indie-stack)
- **remix-flat-routes**: The package that originated the flat routes convention
  (https://github.com/kiliman/remix-flat-routes)
- **Kent C. Dodds Blog**: kentcdodds.com -- built with Remix, open source
  (https://github.com/kentcdodds/kentcdodds.com)
- **Shopify Hydrogen**: Remix-based e-commerce framework by Shopify

---

## Sources

- Remix Official Documentation -- https://remix.run/docs
- React Router v7 Documentation -- https://reactrouter.com
- Remix File Conventions -- https://remix.run/docs/en/main/file-conventions
- Epic Stack Repository -- https://github.com/epicweb-dev/epic-stack
- Remix Flat Routes -- https://github.com/kiliman/remix-flat-routes
