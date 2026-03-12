# Remix Full-Stack Project Structure

> **AI Plugin Directive:** When generating a full-stack Remix (React Router v7 framework mode) application, ALWAYS use this structure. Apply loader/action pattern for server-side data fetching and mutations with progressive enhancement. This guide covers Remix v2 / React Router v7 with flat routes, server-side data handling, and deployment adapters.

**Core Rule: Use Remix's loader/action pattern for ALL data operations. Data flows through loaders (GET) and actions (POST/PUT/DELETE). NEVER use client-side fetching libraries (react-query, SWR) for data that can be loaded server-side.**

---

## 1. Enterprise Full-Stack Structure

```
my-app/
├── app/
│   ├── entry.client.tsx               # Client hydration entry
│   ├── entry.server.tsx               # Server rendering entry
│   ├── root.tsx                       # Root layout + error boundary
│   │
│   ├── routes/                        # Flat file routing (v2 convention)
│   │   ├── _index.tsx                 # / (landing page)
│   │   ├── _auth.tsx                  # Auth layout (pathless)
│   │   ├── _auth.login.tsx            # /login
│   │   ├── _auth.register.tsx         # /register
│   │   ├── _dashboard.tsx             # Dashboard layout (pathless)
│   │   ├── _dashboard.dashboard.tsx   # /dashboard
│   │   ├── _dashboard.users.tsx       # /users (list)
│   │   ├── _dashboard.users.$id.tsx   # /users/:id (detail)
│   │   ├── _dashboard.users.new.tsx   # /users/new (create)
│   │   ├── _dashboard.orders.tsx      # /orders
│   │   ├── _dashboard.orders.$id.tsx  # /orders/:id
│   │   ├── _dashboard.settings.tsx    # /settings
│   │   ├── api.webhooks.stripe.ts     # /api/webhooks/stripe (resource route)
│   │   └── api.healthcheck.ts         # /api/healthcheck
│   │
│   ├── features/                      # Feature modules
│   │   ├── auth/
│   │   │   ├── auth.server.ts         # Server-only auth logic
│   │   │   ├── session.server.ts      # Session management
│   │   │   ├── components/
│   │   │   │   ├── login-form.tsx
│   │   │   │   └── register-form.tsx
│   │   │   └── validations.ts         # Zod schemas
│   │   │
│   │   ├── users/
│   │   │   ├── user.server.ts         # Server-only: queries + mutations
│   │   │   ├── components/
│   │   │   │   ├── user-table.tsx
│   │   │   │   ├── user-form.tsx
│   │   │   │   └── delete-user-button.tsx
│   │   │   ├── validations.ts
│   │   │   └── types.ts
│   │   │
│   │   └── orders/
│   │       ├── order.server.ts
│   │       ├── components/
│   │       └── validations.ts
│   │
│   ├── components/                    # Shared UI components
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── data-table.tsx
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── footer.tsx
│   │   └── shared/
│   │       ├── error-boundary.tsx
│   │       └── pagination.tsx
│   │
│   ├── lib/                           # Core utilities
│   │   ├── db.server.ts               # Database client (server-only)
│   │   ├── email.server.ts            # Email service
│   │   ├── utils.ts                   # Shared utilities
│   │   └── constants.ts
│   │
│   └── styles/                        # CSS
│       └── tailwind.css
│
├── prisma/                            # Prisma ORM
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── public/                            # Static assets
├── .env
├── remix.config.ts                    # (or vite.config.ts for Vite)
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── Dockerfile
```

---

## 2. Route File Naming Convention (Flat Routes v2)

| File | URL | Purpose |
|------|-----|---------|
| `_index.tsx` | `/` | Root index |
| `_auth.tsx` | (layout) | Auth layout wrapper |
| `_auth.login.tsx` | `/login` | Login page |
| `_dashboard.tsx` | (layout) | Dashboard layout |
| `_dashboard.users.tsx` | `/users` | Users list |
| `_dashboard.users.$id.tsx` | `/users/:id` | User detail |
| `_dashboard.users.new.tsx` | `/users/new` | Create user |
| `api.webhooks.stripe.ts` | `/api/webhooks/stripe` | Resource route |

**Rules:**
- `_prefix` = pathless layout route (wraps children without adding URL segment)
- `.` separates URL segments (replaces `/` in file path)
- `$param` = dynamic segment
- `.ts` (no X) = resource route (no UI, data only)

---

## 3. Loader Pattern (Data Fetching)

```typescript
// app/routes/_dashboard.users.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { requireUser } from "~/features/auth/auth.server";
import { getUsers } from "~/features/users/user.server";
import { UserTable } from "~/features/users/components/user-table";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;
  const search = url.searchParams.get("search") || undefined;

  const { users, total } = await getUsers({ page, limit: 20, search });

  return json({ users, total, page, currentUser: user });
}

export default function UsersPage() {
  const { users, total, page } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <div>
      <h1>Users</h1>
      <input
        type="search"
        defaultValue={searchParams.get("search") || ""}
        onChange={(e) => setSearchParams({ search: e.target.value, page: "1" })}
      />
      <UserTable users={users} total={total} page={page} />
    </div>
  );
}
```

---

## 4. Action Pattern (Mutations)

```typescript
// app/routes/_dashboard.users.new.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, Form } from "@remix-run/react";
import { requireAdmin } from "~/features/auth/auth.server";
import { createUser } from "~/features/users/user.server";
import { createUserSchema } from "~/features/users/validations";

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const raw = Object.fromEntries(formData);

  const result = createUserSchema.safeParse(raw);
  if (!result.success) {
    return json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    await createUser(result.data);
    return redirect("/users");
  } catch (error) {
    if (error instanceof Error && error.message === "Email exists") {
      return json(
        { errors: { email: ["Email already registered"] } },
        { status: 409 },
      );
    }
    throw error;
  }
}

export default function NewUserPage() {
  const actionData = useActionData<typeof action>();

  return (
    <Form method="post">
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        {actionData?.errors?.email && (
          <p className="text-red-500">{actionData.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="fullName">Full Name</label>
        <input id="fullName" name="fullName" required />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />
      </div>

      <button type="submit">Create User</button>
    </Form>
  );
}
```

---

## 5. Server-Only Modules (`.server.ts`)

```typescript
// app/features/users/user.server.ts
// This file NEVER ships to the client browser
import { db } from "~/lib/db.server";
import { hashPassword } from "~/lib/crypto.server";

export async function getUsers(params: {
  page: number;
  limit: number;
  search?: string;
}) {
  const skip = (params.page - 1) * params.limit;
  const where = params.search
    ? {
        OR: [
          { email: { contains: params.search, mode: "insensitive" as const } },
          { fullName: { contains: params.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip,
    }),
    db.user.count({ where }),
  ]);

  return { users, total };
}

export async function createUser(data: {
  email: string;
  fullName: string;
  password: string;
  role?: string;
}) {
  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("Email exists");

  return db.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      passwordHash: await hashPassword(data.password),
      role: data.role ?? "USER",
    },
  });
}

export async function updateUser(id: string, data: Partial<{
  email: string;
  fullName: string;
}>) {
  return db.user.update({ where: { id }, data });
}

export async function deleteUser(id: string) {
  return db.user.delete({ where: { id } });
}
```

---

## 6. Session Management

```typescript
// app/features/auth/session.server.ts
import { createCookieSessionStorage, redirect } from "@remix-run/node";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request);
  return session.get("userId") ?? null;
}

export async function requireUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) throw redirect("/login");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw redirect("/login");

  return user;
}

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function destroySession(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
```

---

## 7. Resource Routes (API-Only)

```typescript
// app/routes/api.webhooks.stripe.ts
// No default export = no UI = resource route
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  const event = stripe.webhooks.constructEvent(
    payload, sig, process.env.STRIPE_WEBHOOK_SECRET!,
  );

  switch (event.type) {
    case "checkout.session.completed":
      // handle payment
      break;
  }

  return json({ received: true });
}

// Resource routes can also have loaders for GET endpoints:
// export async function loader() { return json({ status: "ok" }); }
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Client-side data fetching | `useEffect` + `fetch()` for initial data | Use `loader` for server data, `useLoaderData()` on client |
| API routes for own UI | Creating REST endpoints consumed by same app | Use `loader`/`action` in route files directly |
| No `.server.ts` suffix | DB imports leaking to client bundle | ALL server-only code in `.server.ts` files |
| No progressive enhancement | Forms break without JavaScript | Use `<Form>` from Remix — works without JS |
| Fat route files | 300+ lines mixing loader/action/UI/validation | Extract server logic to `features/*/`.server.ts` |
| No error boundaries | Unhandled errors crash the page | Export `ErrorBoundary` in every route |
| Client state for server data | React Query/Zustand for API data | Remix loaders handle all server state, use `useFetcher` for optimistic UI |

---

## 9. Enforcement Checklist

- [ ] Flat routes v2 convention — dot-separated, `$` for params, `_` for pathless
- [ ] `loader` for GET data, `action` for mutations — NO client-side fetching
- [ ] `<Form method="post">` for mutations — progressive enhancement by default
- [ ] ALL server-only code in `.server.ts` files — NEVER import db on client
- [ ] Session-based auth via `createCookieSessionStorage`
- [ ] Zod validation in actions — return field errors via `json()`
- [ ] Error boundaries exported from route modules
- [ ] Feature modules in `features/` with `.server.ts` for data layer
- [ ] Resource routes (no default export) for webhooks and external APIs
- [ ] `useFetcher()` for non-navigation mutations (inline delete, toggle)
