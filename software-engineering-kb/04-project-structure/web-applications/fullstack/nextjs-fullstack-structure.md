# Next.js Full-Stack Project Structure — Complete Specification

> **AI Plugin Directive:** When generating a full-stack Next.js application (both frontend UI and backend API in one project), ALWAYS use this structure. Apply App Router with Server Components, Server Actions, Route Handlers, and database access via Prisma or Drizzle. This guide covers Next.js 14/15 as a complete full-stack monolith.

**Core Rule: Use Next.js as a full-stack framework ONLY when the API is consumed primarily by the Next.js frontend itself. For public APIs serving multiple clients, separate the backend. NEVER expose internal Server Actions as a public API. Server Components handle reads, Server Actions handle writes.**

---

## 1. Enterprise Full-Stack Structure

```
my-app/
├── src/
│   ├── app/                           # App Router — pages + API
│   │   ├── layout.tsx                 # Root layout with providers
│   │   ├── page.tsx                   # Landing page
│   │   ├── loading.tsx                # Root loading state
│   │   ├── error.tsx                  # Root error boundary
│   │   ├── not-found.tsx              # 404 page
│   │   ├── global-error.tsx           # Root-level error boundary (catches layout errors)
│   │   │
│   │   ├── (marketing)/              # Route group: public pages
│   │   │   ├── layout.tsx             # Marketing layout (full-width, no sidebar)
│   │   │   ├── page.tsx               # Home
│   │   │   ├── about/page.tsx
│   │   │   ├── pricing/
│   │   │   │   ├── page.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx           # Blog index (ISR)
│   │   │   │   └── [slug]/page.tsx    # Blog post (ISR)
│   │   │   └── changelog/page.tsx
│   │   │
│   │   ├── (auth)/                    # Route group: auth pages
│   │   │   ├── layout.tsx             # Centered card layout
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── verify-email/page.tsx
│   │   │
│   │   ├── (dashboard)/              # Route group: authenticated app
│   │   │   ├── layout.tsx             # Sidebar + header + auth check
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx           # Dashboard overview (RSC)
│   │   │   │   └── loading.tsx
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx           # General settings
│   │   │   │   ├── profile/page.tsx
│   │   │   │   ├── billing/page.tsx
│   │   │   │   ├── team/page.tsx
│   │   │   │   └── layout.tsx         # Settings sidebar nav
│   │   │   ├── users/
│   │   │   │   ├── page.tsx           # User list (RSC with search/pagination)
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx       # User detail
│   │   │   │   │   └── edit/page.tsx  # Edit user form
│   │   │   │   ├── new/page.tsx       # Create user form
│   │   │   │   └── loading.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── loading.tsx
│   │   │   └── analytics/
│   │   │       └── page.tsx           # Analytics dashboard (RSC)
│   │   │
│   │   └── api/                       # Route Handlers (REST endpoints)
│   │       ├── auth/
│   │       │   └── [...nextauth]/route.ts  # NextAuth.js / Auth.js
│   │       ├── webhooks/
│   │       │   ├── stripe/route.ts    # Stripe webhook handler
│   │       │   └── clerk/route.ts     # Clerk webhook handler
│   │       ├── upload/route.ts        # File uploads (presigned URLs)
│   │       ├── cron/
│   │       │   ├── cleanup/route.ts   # Scheduled cleanup
│   │       │   └── reports/route.ts   # Scheduled reports
│   │       └── health/route.ts        # Health check for monitoring
│   │
│   ├── features/                      # Feature modules (business logic)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── login-form.tsx     # Client component (form + useActionState)
│   │   │   │   ├── register-form.tsx
│   │   │   │   ├── auth-provider.tsx  # Session provider wrapper
│   │   │   │   └── user-menu.tsx      # Avatar + dropdown
│   │   │   ├── actions/
│   │   │   │   ├── login.ts           # Server Action
│   │   │   │   ├── register.ts
│   │   │   │   ├── logout.ts
│   │   │   │   └── update-password.ts
│   │   │   ├── queries/
│   │   │   │   ├── get-session.ts     # Data fetching (cached)
│   │   │   │   └── get-user-by-email.ts
│   │   │   └── lib/
│   │   │       ├── auth-options.ts    # NextAuth config
│   │   │       └── validations.ts     # Zod schemas for auth
│   │   │
│   │   ├── users/
│   │   │   ├── components/
│   │   │   │   ├── user-table.tsx     # Client component (DataTable)
│   │   │   │   ├── user-form.tsx      # Create/edit form
│   │   │   │   ├── user-card.tsx      # User profile card
│   │   │   │   ├── user-filters.tsx   # Search + filter controls
│   │   │   │   └── delete-user-dialog.tsx
│   │   │   ├── actions/
│   │   │   │   ├── create-user.ts     # Server Action with Zod validation
│   │   │   │   ├── update-user.ts
│   │   │   │   └── delete-user.ts
│   │   │   ├── queries/
│   │   │   │   ├── get-users.ts       # Paginated, searchable, cached
│   │   │   │   └── get-user.ts        # Single user by ID
│   │   │   └── lib/
│   │   │       ├── validations.ts     # Zod schemas
│   │   │       └── constants.ts       # Role enums, limits
│   │   │
│   │   ├── orders/
│   │   │   ├── components/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   └── lib/
│   │   │
│   │   └── billing/
│   │       ├── components/
│   │       │   ├── pricing-table.tsx
│   │       │   ├── checkout-button.tsx
│   │       │   └── subscription-status.tsx
│   │       ├── actions/
│   │       │   ├── create-checkout.ts
│   │       │   └── cancel-subscription.ts
│   │       ├── queries/
│   │       │   └── get-subscription.ts
│   │       └── lib/
│   │           └── stripe.ts          # Stripe client singleton
│   │
│   ├── components/                    # Shared UI components
│   │   ├── ui/                        # Primitives (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── data-table.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   └── skeleton.tsx
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── breadcrumbs.tsx
│   │   │   └── mobile-nav.tsx
│   │   └── shared/
│   │       ├── pagination.tsx
│   │       ├── loading-spinner.tsx
│   │       ├── empty-state.tsx
│   │       ├── error-boundary.tsx
│   │       └── submit-button.tsx      # Button with useFormStatus pending
│   │
│   ├── lib/                           # Core utilities
│   │   ├── db.ts                      # Prisma/Drizzle client singleton
│   │   ├── auth.ts                    # Auth helper (getSession, requireAuth)
│   │   ├── utils.ts                   # cn(), formatDate, formatCurrency
│   │   ├── safe-action.ts            # next-safe-action client setup
│   │   ├── email.ts                   # Email sending (Resend/Postmark)
│   │   ├── rate-limit.ts             # Rate limiting for Server Actions
│   │   └── constants.ts              # App-wide constants
│   │
│   ├── db/                            # Database layer
│   │   ├── schema.ts                  # Drizzle schema definitions
│   │   ├── relations.ts               # Drizzle relations (if separate)
│   │   ├── migrations/                # Generated migrations
│   │   ├── seed.ts                    # Database seeding script
│   │   └── index.ts                   # DB client re-export
│   │
│   ├── types/                         # TypeScript types
│   │   ├── index.ts                   # Shared types
│   │   └── next-auth.d.ts            # Module augmentation for session
│   │
│   └── middleware.ts                  # Auth + routing middleware
│
├── prisma/                            # If using Prisma (alternative to db/)
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── public/                            # Static assets
│   ├── images/
│   ├── fonts/
│   └── favicon.ico
│
├── tests/                             # End-to-end tests
│   ├── e2e/
│   │   ├── auth.spec.ts
│   │   ├── users.spec.ts
│   │   └── orders.spec.ts
│   └── fixtures/
│       └── test-data.ts
│
├── .env.local                         # Local env vars (git-ignored)
├── .env.example                       # Template for env vars (committed)
├── next.config.ts                     # Next.js config
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── drizzle.config.ts                  # If using Drizzle
├── playwright.config.ts              # E2E test config
├── vitest.config.ts                  # Unit test config
├── components.json                    # shadcn/ui config
└── Dockerfile                         # Production container
```

---

## 2. Database Layer (Drizzle ORM)

```typescript
// src/db/schema.ts
import {
  pgTable, text, timestamp, varchar, boolean,
  integer, pgEnum, uuid, index, uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin", "superadmin"]);
export const statusEnum = pgEnum("status", ["active", "inactive", "suspended"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  hashedPassword: text("hashed_password"),
  role: roleEnum("role").default("user").notNull(),
  status: statusEnum("status").default("active").notNull(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
  index("users_role_idx").on(table.role),
  index("users_created_at_idx").on(table.createdAt),
]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  totalCents: integer("total_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("orders_user_id_idx").on(table.userId),
  index("orders_status_idx").on(table.status),
]);


// src/lib/db.ts — Singleton database client
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as { pool: Pool | undefined };

const pool = globalForDb.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 20,
  idleTimeoutMillis: 30000,
});

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type Database = typeof db;


// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

---

## 3. Server Actions Pattern (Type-Safe Mutations)

```typescript
// src/lib/safe-action.ts — next-safe-action setup
import { createSafeActionClient } from "next-safe-action";
import { getSession } from "@/lib/auth";

// Base client — no auth required
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof Error) {
      return e.message;
    }
    return "An unexpected error occurred";
  },
});

// Authenticated client — requires session
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return next({ ctx: { user: session.user } });
});

// Admin client — requires admin role
export const adminActionClient = authActionClient.use(async ({ next, ctx }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new Error("Forbidden: admin access required");
  }
  return next({ ctx });
});


// src/features/users/actions/create-user.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { adminActionClient } from "@/lib/safe-action";

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(1, "Name is required").max(100),
  role: z.enum(["user", "admin"]).default("user"),
});

export const createUser = adminActionClient
  .schema(createUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    // Check for existing user
    const existing = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, parsedInput.email),
    });

    if (existing) {
      throw new Error("A user with this email already exists");
    }

    const [user] = await db
      .insert(users)
      .values({
        email: parsedInput.email,
        fullName: parsedInput.fullName,
        role: parsedInput.role,
      })
      .returning();

    revalidatePath("/dashboard/users");
    return { user };
  });


// src/features/users/actions/delete-user.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { adminActionClient } from "@/lib/safe-action";

export const deleteUser = adminActionClient
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    // Prevent self-deletion
    if (parsedInput.id === ctx.user.id) {
      throw new Error("Cannot delete your own account");
    }

    await db.delete(users).where(eq(users.id, parsedInput.id));
    revalidatePath("/dashboard/users");
    return { success: true };
  });
```

---

## 4. Data Queries Pattern (Cached Server-Side Fetching)

```typescript
// src/features/users/queries/get-users.ts
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { desc, count, ilike, or, and, eq, SQL } from "drizzle-orm";
import { cache } from "react";

interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}

export const getUsers = cache(async (params: GetUsersParams) => {
  const { page = 1, limit = 20, search, role, status } = params;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        ilike(users.fullName, `%${search}%`),
        ilike(users.email, `%${search}%`),
      )!,
    );
  }

  if (role) {
    conditions.push(eq(users.role, role as "user" | "admin" | "superadmin"));
  }

  if (status) {
    conditions.push(eq(users.status, status as "active" | "inactive" | "suspended"));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(users).where(where),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
});


// Usage in Server Component (RSC):
// src/app/(dashboard)/users/page.tsx
import { getUsers } from "@/features/users/queries/get-users";
import { UserTable } from "@/features/users/components/user-table";
import { UserFilters } from "@/features/users/components/user-filters";
import { requireAuth } from "@/lib/auth";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    role?: string;
    status?: string;
  }>;
}) {
  await requireAuth("admin");
  const params = await searchParams;

  const data = await getUsers({
    page: Number(params.page) || 1,
    search: params.search,
    role: params.role,
    status: params.status,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>
      <UserFilters />
      <UserTable
        users={data.items}
        total={data.total}
        page={data.page}
        totalPages={data.totalPages}
      />
    </div>
  );
}
```

---

## 5. Route Handlers (When to Use)

```typescript
// Use Route Handlers ONLY for:
// 1. Webhooks from external services (Stripe, Clerk, GitHub)
// 2. File uploads (presigned URLs, multipart)
// 3. Third-party API consumption (not your frontend)
// 4. Cron jobs triggered by external schedulers (Vercel Cron)
// 5. Health check endpoints
// NEVER use Route Handlers for frontend data fetching — use Server Components

// src/app/api/webhooks/stripe/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await db
        .update(orders)
        .set({ status: "paid", stripePaymentIntentId: session.payment_intent as string })
        .where(eq(orders.id, session.metadata!.orderId));
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await db
        .update(orders)
        .set({ status: "refunded" })
        .where(eq(orders.stripePaymentIntentId, charge.payment_intent as string));
      break;
    }
  }

  return NextResponse.json({ received: true });
}


// src/app/api/health/route.ts — Health check for monitoring
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
  });
}


// src/app/api/upload/route.ts — Presigned URL for S3 uploads
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "@/lib/auth";

const s3 = new S3Client({ region: process.env.AWS_REGION! });

export async function POST(request: Request) {
  await requireAuth();

  const { filename, contentType } = await request.json();
  const key = `uploads/${Date.now()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return NextResponse.json({ url, key });
}
```

---

## 6. Authentication & Middleware

```typescript
// src/lib/auth.ts — Auth utility functions
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authOptions } from "@/features/auth/lib/auth-options";

// Cached session getter (deduplicated per request)
export const getSession = cache(async () => {
  return getServerSession(authOptions);
});

// Require auth — redirects to login if not authenticated
export async function requireAuth(role?: string) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (role && session.user.role !== role && session.user.role !== "superadmin") {
    redirect("/dashboard?error=forbidden");
  }

  return session;
}


// src/middleware.ts — Edge middleware for auth + routing
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/about",
  "/pricing",
  "/blog",
  "/changelog",
]);

function isPublicPath(pathname: string): boolean {
  if (publicPaths.has(pathname)) return true;
  // Allow blog post pages
  if (pathname.startsWith("/blog/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API routes, static files, and public paths
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.includes(".") ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  // Check authentication for dashboard routes
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 7. Client Components with Server Actions

```typescript
// src/features/users/components/user-form.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { createUser } from "../actions/create-user";
import { updateUser } from "../actions/update-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { InferSelectModel } from "drizzle-orm";
import type { users } from "@/db/schema";

type User = InferSelectModel<typeof users>;

interface UserFormProps {
  user?: User;     // If provided, edit mode
}

export function UserForm({ user }: UserFormProps) {
  const router = useRouter();
  const isEditing = !!user;

  const { execute, isPending } = useAction(
    isEditing ? updateUser : createUser,
    {
      onSuccess: () => {
        toast.success(isEditing ? "User updated" : "User created");
        router.push("/dashboard/users");
      },
      onError: ({ error }) => {
        toast.error(error.serverError || "Something went wrong");
      },
    },
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        execute({
          ...(isEditing && { id: user.id }),
          email: formData.get("email") as string,
          fullName: formData.get("fullName") as string,
          role: formData.get("role") as "user" | "admin",
        });
      }}
      className="space-y-4 max-w-md"
    >
      <Input
        name="email"
        type="email"
        placeholder="Email"
        defaultValue={user?.email}
        required
      />
      <Input
        name="fullName"
        placeholder="Full Name"
        defaultValue={user?.fullName}
        required
      />
      <select name="role" defaultValue={user?.role || "user"}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : isEditing ? "Update User" : "Create User"}
      </Button>
    </form>
  );
}


// src/components/shared/submit-button.tsx — Reusable submit with pending state
"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

interface SubmitButtonProps extends ButtonProps {
  pendingText?: string;
}

export function SubmitButton({
  children,
  pendingText = "Saving...",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
```

---

## 8. Environment Variables & Configuration

```typescript
// src/lib/env.ts — Type-safe environment variable validation
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),

  // Email
  RESEND_API_KEY: z.string().optional(),

  // S3
  AWS_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),

  // App
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_VERSION: z.string().default("0.0.0"),
});

export const env = envSchema.parse(process.env);
```

```
# .env.example — Committed to git, documents ALL variables
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp

# Auth (generate: openssl rand -base64 32)
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email (Resend)
RESEND_API_KEY=re_...

# S3 (file uploads)
AWS_REGION=us-east-1
S3_BUCKET=myapp-uploads

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_VERSION=0.0.0
```

---

## 9. Loading & Error States

```typescript
// src/app/(dashboard)/users/loading.tsx — Streaming skeleton
import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full" /> {/* Search bar */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}


// src/app/(dashboard)/users/error.tsx — Error boundary
"use client";

import { Button } from "@/components/ui/button";

export default function UsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">
        {error.message || "Failed to load users"}
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}


// src/app/global-error.tsx — Root-level error boundary
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Application Error</h1>
            <p className="mt-2 text-gray-600">{error.message}</p>
            <button
              onClick={reset}
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

---

## 10. Production Deployment

```dockerfile
# Dockerfile — Multi-stage build for Next.js
FROM node:20-alpine AS base
RUN corepack enable pnpm

# ── Dependencies ──
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Build ──
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (if using Prisma)
# RUN pnpm prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# ── Production ──
FROM base AS production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

```typescript
// next.config.ts — Production-optimized configuration
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",         // Required for Docker deployment
  poweredByHeader: false,       // Security: remove X-Powered-By
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.amazonaws.com",  // S3 images
      },
    ],
  },

  experimental: {
    typedRoutes: true,          // Type-safe Link href
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 11. Architecture Decision: Full-Stack vs Separate

```
FULL-STACK NEXT.JS ARCHITECTURE:

┌──────────────────────────────────────────────────────────────────┐
│                       Next.js Application                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Browser (Client)                                            ││
│  │                                                             ││
│  │  Client Components ← useAction() → Server Actions           ││
│  │  (forms, interactivity)             (mutations)             ││
│  │                                                             ││
│  │  Server Components ← RSC payload → Node.js Server           ││
│  │  (data display, HTML)               (queries, rendering)    ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    │ Data Layer         │                        │
│                    │ Drizzle/Prisma     │                        │
│                    │                    │                        │
│                    │ Server Actions     │                        │
│                    │ = RPC (not REST)   │                        │
│                    │ = Mutations only   │                        │
│                    │                    │                        │
│                    │ Route Handlers     │                        │
│                    │ = Webhooks only    │                        │
│                    │ = External clients │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   PostgreSQL        │
                    │   Redis (optional)  │
                    │   S3 (uploads)      │
                    └─────────────────────┘

DATA FLOW:
  READ:   Server Component → query function → Drizzle → DB → RSC HTML
  WRITE:  Client Component → Server Action → Drizzle → DB → revalidate
  WEBHOOK: External service → Route Handler → DB → return 200
```

### When to Use Full-Stack Next.js vs Separate Backend

```
┌───────────────────────────────────┬──────────────────┬──────────────────┐
│ Scenario                          │ Full-Stack Next  │ Separate Backend │
├───────────────────────────────────┼──────────────────┼──────────────────┤
│ SaaS product with dashboard       │ ✅ RECOMMENDED   │                  │
│ Internal admin tool               │ ✅ RECOMMENDED   │                  │
│ Content/marketing site + admin    │ ✅ RECOMMENDED   │                  │
│ Single developer / small team     │ ✅ RECOMMENDED   │                  │
│ E-commerce storefront             │ ✅ OK            │ ✅ OK            │
│ Public REST/GraphQL API           │                  │ ✅ RECOMMENDED   │
│ Mobile app needs same API         │                  │ ✅ RECOMMENDED   │
│ Microservices architecture        │                  │ ✅ RECOMMENDED   │
│ Team has dedicated backend devs   │                  │ ✅ RECOMMENDED   │
│ Real-time WebSocket heavy         │                  │ ✅ RECOMMENDED   │
│ Heavy background processing       │                  │ ✅ RECOMMENDED   │
│ Need API versioning (v1, v2)      │                  │ ✅ RECOMMENDED   │
│ Multiple frontend clients         │                  │ ✅ RECOMMENDED   │
│ CPU-intensive computation         │                  │ ✅ RECOMMENDED   │
└───────────────────────────────────┴──────────────────┴──────────────────┘

RULE: If ONLY your Next.js frontend consumes the API → full-stack.
      If ANY other client needs the API → separate backend.
```

---

## 12. Testing Strategy

```typescript
// vitest.config.ts — Unit + integration tests
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/features/**", "src/lib/**"],
    },
  },
});


// src/features/users/queries/__tests__/get-users.test.ts
import { describe, it, expect, vi } from "vitest";
import { getUsers } from "../get-users";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([
                { id: "1", email: "test@example.com", fullName: "Test User" },
              ]),
            }),
          }),
        }),
      }),
    }),
  },
}));

describe("getUsers", () => {
  it("returns paginated results", async () => {
    const result = await getUsers({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(1);
  });
});


// playwright.config.ts — E2E tests
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **API routes for own frontend** | `/api/users` called from `useEffect()` | Use Server Components for reads, Server Actions for writes |
| **No feature folders** | All actions in one `actions/` folder | Group by feature: `features/users/actions/` |
| **Client components everywhere** | `"use client"` on every file | Default to RSC, `"use client"` only for interactivity |
| **Direct DB in page components** | `prisma.user.findMany()` in page.tsx | Extract to `features/*/queries/` for reusability |
| **No input validation** | Server Actions without Zod | ALWAYS validate with Zod + next-safe-action |
| **Fat middleware** | Business logic in middleware.ts | Middleware for auth/redirects only, logic in actions |
| **Exposing internal API** | Server Actions used as public API | Server Actions are RPC — use Route Handlers for public API |
| **No loading states** | Pages load without skeleton | Add loading.tsx co-located with every page |
| **No error boundaries** | Errors crash entire app | Add error.tsx co-located with pages |
| **Env vars not validated** | Runtime crashes from missing env | Validate with Zod at build/startup time |
| **useEffect for data fetching** | Client-side waterfall, loading spinners | Fetch in Server Components, stream with Suspense |
| **No auth check in actions** | Server Actions callable by anyone | Use authActionClient / adminActionClient wrappers |
| **Single DB query style** | Raw SQL mixed with ORM calls | Standardize on Drizzle OR Prisma, not both |
| **No revalidation after mutation** | Stale data after create/update/delete | ALWAYS call revalidatePath() or revalidateTag() |
| **Massive root layout** | All providers, fonts, scripts in root layout | Split into route group layouts |

---

## 14. Enforcement Checklist

### Architecture
- [ ] **Server Components by default** — `"use client"` ONLY for interactivity (forms, state, effects)
- [ ] **Server Actions for mutations** — NOT Route Handlers (unless webhook/external)
- [ ] **Route Handlers for external only** — webhooks, cron, file uploads, third-party clients
- [ ] **Feature folders enforced** — `features/{name}/actions/`, `queries/`, `components/`, `lib/`
- [ ] **No `useEffect` for data fetching** — use Server Components with `cache()`

### Data & Validation
- [ ] **Zod validation on ALL Server Actions** — via next-safe-action
- [ ] **Database client singleton** — in `lib/db.ts` with globalThis pattern
- [ ] **Queries use `cache()`** — React cache for request deduplication
- [ ] **`revalidatePath()`/`revalidateTag()` after mutations** — no stale data
- [ ] **Environment variables validated** — Zod schema at build time

### Auth & Security
- [ ] **Middleware handles auth redirects ONLY** — no business logic
- [ ] **Auth check in every Server Action** — authActionClient or adminActionClient
- [ ] **Security headers configured** — CSP, X-Frame-Options, nosniff in next.config
- [ ] **Webhook signature verification** — ALWAYS verify Stripe/Clerk signatures

### UX
- [ ] **Loading states co-located** — loading.tsx next to every page.tsx
- [ ] **Error boundaries co-located** — error.tsx next to every page.tsx
- [ ] **Route groups for layout separation** — `(marketing)`, `(auth)`, `(dashboard)`
- [ ] **Optimistic updates where appropriate** — `useOptimistic` for instant feedback

### Deployment
- [ ] **`output: "standalone"` in next.config** — required for Docker deployment
- [ ] **Multi-stage Dockerfile** — deps → build → production (non-root user)
- [ ] **.env.example committed** — documents ALL environment variables
- [ ] **`global-error.tsx` exists** — catches root-level errors including layout
