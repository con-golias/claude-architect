# T3 Stack Project Structure

> **AI Plugin Directive:** When generating a T3 Stack project (Next.js + tRPC + Prisma + NextAuth + Tailwind), ALWAYS use this structure. Apply end-to-end type safety from database to UI using tRPC routers, Prisma schemas, and Zod validation. This guide covers create-t3-app output with App Router.

**Core Rule: The T3 Stack prioritizes end-to-end type safety. tRPC routers define your API, Prisma defines your data layer, and Zod validates input. NEVER use REST endpoints or untyped API calls within the T3 stack.**

---

## 1. Project Structure

```
my-app/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── layout.tsx                 # Root layout with TRPCProvider
│   │   ├── page.tsx                   # Landing page
│   │   │
│   │   ├── (auth)/                    # Auth pages
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (dashboard)/              # Authenticated pages
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── users/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── settings/page.tsx
│   │   │
│   │   └── api/                       # API routes
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── trpc/[trpc]/route.ts   # tRPC HTTP handler
│   │
│   ├── server/                        # Server-only code
│   │   ├── api/
│   │   │   ├── root.ts               # Root tRPC router (merges all)
│   │   │   ├── trpc.ts               # tRPC context + procedures
│   │   │   └── routers/              # Feature routers
│   │   │       ├── user.ts
│   │   │       ├── post.ts
│   │   │       └── order.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── config.ts             # NextAuth configuration
│   │   │   └── index.ts              # Auth helper (getServerSession)
│   │   │
│   │   └── db/
│   │       └── index.ts              # Prisma client singleton
│   │
│   ├── trpc/                          # tRPC client setup
│   │   ├── react.tsx                  # React Query + tRPC provider
│   │   ├── server.ts                  # Server-side tRPC caller
│   │   └── query-client.ts           # TanStack Query client
│   │
│   ├── features/                      # Feature-specific UI
│   │   ├── users/
│   │   │   ├── components/
│   │   │   │   ├── user-table.tsx
│   │   │   │   ├── user-form.tsx
│   │   │   │   └── user-card.tsx
│   │   │   └── hooks/
│   │   │       └── use-users.ts       # tRPC query hooks wrapper
│   │   │
│   │   ├── posts/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   │
│   │   └── orders/
│   │       ├── components/
│   │       └── hooks/
│   │
│   ├── components/                    # Shared UI
│   │   ├── ui/                        # shadcn/ui components
│   │   └── layout/
│   │
│   ├── lib/                           # Utilities
│   │   ├── utils.ts
│   │   └── validations/              # Shared Zod schemas
│   │       ├── user.ts
│   │       ├── post.ts
│   │       └── common.ts
│   │
│   ├── styles/
│   │   └── globals.css
│   │
│   ├── types/
│   │   └── next-auth.d.ts
│   │
│   ├── env.ts                         # t3-env environment validation
│   └── middleware.ts                  # Auth middleware
│
├── prisma/
│   ├── schema.prisma                  # Database schema
│   ├── migrations/
│   └── seed.ts
│
├── public/
├── .env
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 2. tRPC Router Pattern

```typescript
// src/server/api/trpc.ts — Context + Procedure Builders
import { initTRPC, TRPCError } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "~/server/db";
import { getServerAuthSession } from "~/server/auth";

export const createTRPCContext = async (opts: FetchCreateContextFnOptions) => {
  const session = await getServerAuthSession();
  return { db, session };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError
          ? error.cause.flatten()
          : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// Public procedure — no auth required
export const publicProcedure = t.procedure;

// Protected procedure — requires authenticated session
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: { ...ctx.session, user: ctx.session.user } },
  });
});

// Admin procedure — requires admin role
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});
```

```typescript
// src/server/api/routers/user.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const userRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search } = input;
      const skip = (page - 1) * limit;

      const where = search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};

      const [items, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: { id: true, email: true, fullName: true, role: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
        }),
        ctx.db.user.count({ where }),
      ]);

      return { items, total, page, limit };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { id: true, email: true, fullName: true, role: true, createdAt: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      return user;
    }),

  create: adminProcedure
    .input(z.object({
      email: z.string().email(),
      fullName: z.string().min(1).max(100),
      role: z.enum(["USER", "ADMIN"]).default("USER"),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
      }
      return ctx.db.user.create({ data: input });
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      email: z.string().email().optional(),
      fullName: z.string().min(1).max(100).optional(),
      role: z.enum(["USER", "ADMIN"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.delete({ where: { id: input.id } });
    }),
});
```

```typescript
// src/server/api/root.ts — Merge ALL routers
import { createTRPCRouter, createCallerFactory } from "./trpc";
import { userRouter } from "./routers/user";
import { postRouter } from "./routers/post";
import { orderRouter } from "./routers/order";

export const appRouter = createTRPCRouter({
  user: userRouter,
  post: postRouter,
  order: orderRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
```

---

## 3. Client-Side Usage

```typescript
// src/trpc/react.tsx — tRPC React provider
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import { type AppRouter } from "~/server/api/root";
import { getQueryClient } from "./query-client";

export const api = createTRPCReact<AppRouter>();

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const trpcClient = api.createClient({
    links: [
      loggerLink({ enabled: (op) =>
        process.env.NODE_ENV === "development" ||
        (op.direction === "down" && op.result instanceof Error),
      }),
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  });

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  );
}
```

```tsx
// src/features/users/components/user-table.tsx
"use client";

import { api } from "~/trpc/react";
import { useState } from "react";

export function UserTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Fully typed — input and output inferred from tRPC router
  const { data, isLoading, error } = api.user.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
  });

  const utils = api.useUtils();
  const deleteMutation = api.user.delete.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
      utils.user.list.invalidate();
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users..."
      />
      <table>
        <thead>
          <tr><th>Email</th><th>Name</th><th>Role</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {data?.items.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.fullName}</td>
              <td>{user.role}</td>
              <td>
                <button onClick={() => deleteMutation.mutate({ id: user.id })}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 4. Server-Side tRPC Caller (RSC)

```typescript
// src/trpc/server.ts
import "server-only";
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { headers } from "next/headers";
import { cache } from "react";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ req: { headers: heads } as any, resHeaders: new Headers() });
});

export const api = createCaller(createContext);


// Usage in Server Component:
// src/app/(dashboard)/users/page.tsx
import { api } from "~/trpc/server";

export default async function UsersPage() {
  const { items } = await api.user.list({ page: 1, limit: 20 });
  // items is fully typed from the tRPC router
  return <UserTable initialUsers={items} />;
}
```

---

## 5. Environment Validation (t3-env)

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.preprocess(
      (str) => process.env.VERCEL_URL ?? str,
      process.env.VERCEL ? z.string() : z.string().url(),
    ),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

---

## 6. The T3 Axioms

| Axiom | Rule |
|-------|------|
| Typesafety is not optional | tRPC provides end-to-end types — if a router changes, the client breaks at compile time |
| Bleed responsibly | Keep type inference flowing — NEVER manually type tRPC responses |
| Use Prisma | Prisma types flow into tRPC, which flow into React Query hooks |
| Validate with Zod | tRPC `.input()` uses Zod — validation errors are typed |
| t3-env for environment | Build fails if env vars are missing or wrong type |

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| REST API routes alongside tRPC | `/api/users/` AND `user.list` tRPC | Use tRPC for everything except webhooks |
| Manual type definitions | `type User = { id: string, ... }` duplicating Prisma | Use `Prisma.UserGetPayload<>` or infer from tRPC |
| No input validation | `protectedProcedure.mutation(async ({ input }) => ...)` | ALWAYS use `.input(z.object(...))` |
| Client-side data fetching for SSR data | `useEffect` + `fetch` for initial page data | Use server-side tRPC caller in RSC |
| Fat routers | 500+ line tRPC router file | Split into feature routers, merge in root.ts |
| No procedure middleware | Auth checks in every procedure handler | Use `protectedProcedure` and `adminProcedure` |
| Skipping t3-env | `process.env.X!` with non-null assertion | Use `env.DATABASE_URL` — validated at build time |

---

## 8. Enforcement Checklist

- [ ] tRPC router per feature — merged in `root.ts`
- [ ] ALL inputs validated with Zod via `.input()`
- [ ] `protectedProcedure` for authenticated routes — NEVER check auth in handler
- [ ] Server-side tRPC caller for Server Components — client hooks for interactivity
- [ ] Prisma as single source of truth for types — NEVER duplicate type definitions
- [ ] t3-env validates ALL environment variables at build time
- [ ] `superjson` transformer for Date, Map, Set serialization
- [ ] React Query cache invalidation after mutations via `utils.*.invalidate()`
- [ ] Feature folders group components and hooks per domain
- [ ] NO REST API routes except webhooks and external integrations
