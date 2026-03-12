# Next.js Project Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I structure a Next.js project?", "App Router vs Pages Router structure?", "where do Server Components go?", "how do I organize API routes in Next.js?", "Next.js folder structure for enterprise?", or "how do I structure a large Next.js app?", use this directive. Next.js is the dominant React meta-framework. Its structure changed fundamentally with the App Router (Next.js 13+). You MUST default to App Router for all new projects. Pages Router guidance is included ONLY for migration context. Structure decisions in Next.js directly affect performance (RSC vs client components), SEO (metadata API), and developer experience (file-based routing).

---

## 1. The Core Rule

**Next.js projects MUST use the App Router (`app/` directory) for all new projects. Structure follows file-system routing with co-located components, loading states, and error boundaries. Server Components are the DEFAULT — use `'use client'` only when the component needs browser APIs, event handlers, or client-side state. Features are organized by route segments with shared code in `src/lib/` or `src/shared/`. API routes use Route Handlers (`app/api/`) for backend logic.**

```
❌ WRONG: Pages Router for new project, flat file structure
pages/
├── index.tsx
├── about.tsx
├── users.tsx
├── users/[id].tsx
├── api/users.ts
components/
├── Header.tsx          ← Disconnected from routes
├── UserCard.tsx
├── UserList.tsx
lib/
├── api.ts
├── utils.ts            ← God file

✅ CORRECT: App Router with co-located feature structure
src/
├── app/
│   ├── layout.tsx              ← Root layout (Server Component)
│   ├── page.tsx                ← Home page
│   ├── loading.tsx             ← Global loading UI
│   ├── error.tsx               ← Global error boundary
│   ├── not-found.tsx           ← 404 page
│   ├── (marketing)/            ← Route group (no URL segment)
│   │   ├── about/page.tsx
│   │   └── pricing/page.tsx
│   ├── (app)/                  ← Route group for authenticated area
│   │   ├── layout.tsx          ← Shared layout with sidebar
│   │   ├── dashboard/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       └── users/route.ts
├── features/                   ← Feature modules
├── shared/                     ← Shared utilities
└── lib/                        ← Infrastructure code
```

---

## 2. App Router — Enterprise Structure

### Small-to-Medium Project (1-5 developers)

```
my-nextjs-app/
├── public/
│   ├── favicon.ico
│   ├── robots.txt
│   └── images/
│       └── og-default.png
├── src/
│   ├── app/
│   │   ├── layout.tsx                 ← Root layout (html, body, providers)
│   │   ├── page.tsx                   ← / (home page)
│   │   ├── loading.tsx                ← Root loading skeleton
│   │   ├── error.tsx                  ← Root error boundary ('use client')
│   │   ├── not-found.tsx              ← 404 page
│   │   ├── global-error.tsx           ← Error boundary for root layout
│   │   ├── globals.css                ← Global styles (Tailwind directives)
│   │   │
│   │   ├── (auth)/                    ← Route group: auth pages
│   │   │   ├── layout.tsx             ← Centered card layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── forgot-password/
│   │   │       └── page.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── layout.tsx             ← Dashboard layout (sidebar + header)
│   │   │   ├── page.tsx               ← /dashboard
│   │   │   ├── loading.tsx            ← Dashboard loading skeleton
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx           ← /dashboard/analytics
│   │   │   └── settings/
│   │   │       ├── page.tsx           ← /dashboard/settings
│   │   │       └── layout.tsx         ← Settings sub-layout (tabs)
│   │   │
│   │   ├── users/
│   │   │   ├── page.tsx               ← /users (list)
│   │   │   ├── loading.tsx            ← Users list skeleton
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx           ← /users/:id (detail)
│   │   │   │   ├── loading.tsx
│   │   │   │   └── not-found.tsx      ← User not found
│   │   │   └── new/
│   │   │       └── page.tsx           ← /users/new (create form)
│   │   │
│   │   └── api/
│   │       ├── users/
│   │       │   ├── route.ts           ← GET/POST /api/users
│   │       │   └── [id]/
│   │       │       └── route.ts       ← GET/PUT/DELETE /api/users/:id
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   └── [...nextauth]/route.ts  ← NextAuth catch-all
│   │       └── webhooks/
│   │           └── stripe/route.ts
│   │
│   ├── components/                    ← Shared UI components
│   │   ├── ui/                        ← Design system primitives
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── data-table.tsx
│   │   │   └── index.ts
│   │   ├── layout/                    ← Layout components
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── footer.tsx
│   │   │   └── breadcrumbs.tsx
│   │   └── providers/                 ← Client-side providers
│   │       ├── theme-provider.tsx     ← 'use client'
│   │       ├── query-provider.tsx     ← 'use client'
│   │       └── providers.tsx          ← Combines all providers
│   │
│   ├── lib/                           ← Infrastructure / integrations
│   │   ├── db.ts                      ← Prisma/Drizzle client
│   │   ├── auth.ts                    ← NextAuth config
│   │   ├── stripe.ts                  ← Stripe client
│   │   ├── email.ts                   ← Email client (Resend, etc.)
│   │   ├── validations/               ← Zod schemas
│   │   │   ├── user.ts
│   │   │   └── auth.ts
│   │   └── utils.ts                   ← Pure utility functions (cn, formatDate)
│   │
│   ├── hooks/                         ← Client-side React hooks
│   │   ├── use-debounce.ts
│   │   ├── use-media-query.ts
│   │   └── use-local-storage.ts
│   │
│   ├── types/                         ← Global TypeScript types
│   │   ├── index.ts
│   │   └── next-auth.d.ts            ← Module augmentation
│   │
│   └── config/                        ← App configuration
│       ├── site.ts                    ← Site metadata, navigation
│       └── dashboard.ts               ← Dashboard navigation config
│
├── prisma/                            ← Database schema + migrations
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── .env.local                         ← Local env (gitignored)
├── .env.example                       ← Env template (committed)
├── next.config.ts                     ← Next.js configuration
├── tailwind.config.ts
├── tsconfig.json
├── middleware.ts                       ← Edge middleware (at src root or project root)
└── package.json
```

### Large Enterprise Project (10+ developers, multiple teams)

```
src/
├── app/                               ← ONLY routing and page composition
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── pricing/page.tsx
│   │   └── blog/
│   │       ├── page.tsx
│   │       └── [slug]/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   └── _components/           ← Route-specific components (co-located)
│   │   │       ├── stats-card.tsx
│   │   │       └── recent-activity.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── _components/
│   │   │       ├── order-table.tsx
│   │   │       └── order-filters.tsx
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   ├── [id]/edit/page.tsx
│   │   │   └── _components/
│   │   │       ├── product-form.tsx
│   │   │       └── product-card.tsx
│   │   └── settings/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── billing/page.tsx
│   │       └── team/page.tsx
│   └── api/
│       ├── trpc/[trpc]/route.ts       ← tRPC handler (if using tRPC)
│       ├── webhooks/
│       │   ├── stripe/route.ts
│       │   └── clerk/route.ts
│       └── cron/
│           └── daily-report/route.ts
│
├── features/                          ← Feature modules (business logic)
│   ├── auth/
│   │   ├── components/
│   │   │   ├── login-form.tsx         ← 'use client'
│   │   │   ├── register-form.tsx
│   │   │   └── social-login-buttons.tsx
│   │   ├── actions/                   ← Server Actions
│   │   │   ├── login.ts              ← 'use server'
│   │   │   └── register.ts
│   │   ├── queries/                   ← Data fetching functions
│   │   │   └── get-current-user.ts
│   │   ├── lib/
│   │   │   ├── auth-config.ts
│   │   │   └── password.ts
│   │   └── types.ts
│   │
│   ├── orders/
│   │   ├── components/
│   │   │   ├── order-list.tsx
│   │   │   ├── order-detail.tsx
│   │   │   └── create-order-form.tsx
│   │   ├── actions/
│   │   │   ├── create-order.ts
│   │   │   ├── update-order-status.ts
│   │   │   └── cancel-order.ts
│   │   ├── queries/
│   │   │   ├── get-orders.ts
│   │   │   └── get-order-by-id.ts
│   │   ├── lib/
│   │   │   ├── order-calculations.ts
│   │   │   └── order-validators.ts
│   │   └── types.ts
│   │
│   ├── products/
│   │   ├── components/
│   │   ├── actions/
│   │   ├── queries/
│   │   ├── lib/
│   │   └── types.ts
│   │
│   └── billing/
│       ├── components/
│       ├── actions/
│       ├── queries/
│       ├── lib/
│       └── types.ts
│
├── shared/                            ← Cross-feature shared code
│   ├── components/
│   │   ├── ui/                        ← shadcn/ui or design system
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── app-header.tsx
│   │   │   ├── app-sidebar.tsx
│   │   │   └── page-header.tsx
│   │   ├── data-display/
│   │   │   ├── data-table.tsx
│   │   │   ├── empty-state.tsx
│   │   │   └── stats-card.tsx
│   │   └── feedback/
│   │       ├── loading-spinner.tsx
│   │       ├── error-message.tsx
│   │       └── toast.tsx
│   ├── hooks/
│   │   ├── use-debounce.ts
│   │   └── use-pagination.ts
│   ├── lib/
│   │   ├── utils.ts                   ← cn() helper, formatters
│   │   ├── constants.ts
│   │   └── schemas.ts                 ← Shared Zod schemas
│   └── types/
│       ├── api.ts                     ← API response types
│       └── pagination.ts
│
├── lib/                               ← Infrastructure / third-party
│   ├── db/
│   │   ├── client.ts                  ← Prisma/Drizzle singleton
│   │   ├── schema.ts                  ← Drizzle schema (if using Drizzle)
│   │   └── migrations/
│   ├── auth/
│   │   ├── config.ts                  ← NextAuth/Clerk config
│   │   └── session.ts                 ← getServerSession helper
│   ├── stripe/
│   │   ├── client.ts
│   │   └── webhooks.ts
│   ├── email/
│   │   ├── client.ts
│   │   └── templates/
│   │       ├── welcome.tsx            ← React Email template
│   │       └── order-confirmation.tsx
│   └── cache/
│       └── redis.ts
│
├── config/
│   ├── site.ts                        ← Site name, description, URLs
│   ├── navigation.ts                  ← Nav items configuration
│   └── features.ts                    ← Feature flags
│
├── middleware.ts                       ← Edge middleware
└── instrumentation.ts                 ← OpenTelemetry setup (Next.js 15+)
```

---

## 3. File Conventions (App Router)

### Required and Special Files

```
┌──────────────────────────┬──────────────────────────────────────────────────┐
│ File                     │ Purpose                                           │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ layout.tsx               │ Shared UI for a segment. Persists across nav.     │
│ page.tsx                 │ Unique UI for a route. Makes route accessible.    │
│ loading.tsx              │ Loading UI (Suspense boundary). Shows instantly.  │
│ error.tsx                │ Error UI (Error boundary). Must be 'use client'.  │
│ not-found.tsx            │ 404 UI. Triggered by notFound() function.         │
│ template.tsx             │ Like layout but re-mounts on navigation.          │
│ default.tsx              │ Fallback for parallel routes.                      │
│ route.ts                 │ API endpoint (Route Handler). No UI.              │
│ global-error.tsx         │ Error boundary for root layout. Must be client.   │
│ middleware.ts            │ Edge middleware. Runs before every request.        │
│ instrumentation.ts       │ OpenTelemetry / monitoring setup.                 │
│ opengraph-image.tsx      │ Auto-generated OG image for the route.            │
│ sitemap.ts               │ Dynamic sitemap generation.                       │
│ robots.ts                │ Dynamic robots.txt generation.                    │
│ manifest.ts              │ Web app manifest generation.                      │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

### Route Group Patterns

```
app/
├── (marketing)/               ← No URL prefix, groups marketing pages
│   ├── layout.tsx             ← Marketing layout (hero header, footer)
│   ├── page.tsx               ← / (home)
│   ├── about/page.tsx         ← /about
│   └── pricing/page.tsx       ← /pricing
│
├── (app)/                     ← No URL prefix, groups authenticated pages
│   ├── layout.tsx             ← App layout (sidebar, auth check)
│   ├── dashboard/page.tsx     ← /dashboard
│   └── settings/page.tsx      ← /settings
│
├── (admin)/                   ← Admin area with separate layout
│   ├── layout.tsx             ← Admin layout
│   └── admin/
│       ├── page.tsx           ← /admin
│       └── users/page.tsx     ← /admin/users
│
└── layout.tsx                 ← Root layout (shared across ALL groups)

RULE: Route groups are for LAYOUT organization, not URL organization.
RULE: Use (groupName) with parentheses — these do NOT affect the URL.
RULE: Each route group can have its own layout.tsx, loading.tsx, error.tsx.
```

### Parallel Routes and Intercepting Routes

```
app/
├── @modal/                    ← Parallel route slot
│   ├── default.tsx            ← Fallback when no modal
│   └── (.)photo/[id]/
│       └── page.tsx           ← Intercepted: shows photo in modal
├── photo/[id]/
│   └── page.tsx               ← Full page: shows photo full-screen
└── layout.tsx                 ← Renders {children} + {modal} slots

RULE: @ prefix = parallel route (named slot in layout).
RULE: (.) = intercept same level, (..) = one level up, (...) = from root.
RULE: Parallel routes enable conditional rendering of multiple pages simultaneously.
```

---

## 4. Server Components vs Client Components

### Decision Tree

```
START: Building a new component. Server or Client?

Step 1: Does it need browser APIs? (window, document, localStorage)
├── YES → 'use client'
└── NO ↓

Step 2: Does it need event handlers? (onClick, onChange, onSubmit)
├── YES → 'use client'
└── NO ↓

Step 3: Does it use React hooks? (useState, useEffect, useRef, useContext)
├── YES → 'use client'
└── NO ↓

Step 4: Does it fetch data on the server? (database, API, file system)
├── YES → Server Component (DEFAULT, no directive needed)
└── NO → Server Component (DEFAULT)

CRITICAL RULES:
  - Server Components are the DEFAULT. You do NOT need 'use server' for components.
  - 'use client' marks the CLIENT BOUNDARY. Everything imported by a client
    component also becomes a client component.
  - You CAN import Server Components INTO Client Components as {children}.
  - You CANNOT import Client Components INTO Server Components without 'use client'.
  - Data fetching belongs in Server Components. Pass data DOWN as props.
  - Keep 'use client' boundary as LOW as possible in the component tree.
```

### Component Boundary Pattern

```typescript
// app/users/page.tsx — SERVER Component (fetches data)
import { getUsers } from '@/features/users/queries/get-users';
import { UserTable } from '@/features/users/components/user-table';

export default async function UsersPage() {
  const users = await getUsers(); // Direct database access

  return (
    <div>
      <h1>Users</h1>
      {/* UserTable is 'use client' — receives SERVER data as props */}
      <UserTable users={users} />
    </div>
  );
}

// features/users/components/user-table.tsx — CLIENT Component (interactive)
'use client';

import { useState } from 'react';
import { type User } from '@/features/users/types';

export function UserTable({ users }: { users: User[] }) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [search, setSearch] = useState('');

  const filtered = users
    .filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a[sortBy].localeCompare(b[sortBy]));

  return (
    <>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      <table>{/* render filtered users */}</table>
    </>
  );
}
```

---

## 5. Server Actions

### Organization Pattern

```
features/
├── orders/
│   ├── actions/                       ← Server Actions (mutations)
│   │   ├── create-order.ts            ← 'use server' at top of file
│   │   ├── update-order-status.ts
│   │   └── cancel-order.ts
│   ├── queries/                       ← Data fetching (read-only)
│   │   ├── get-orders.ts             ← Called from Server Components
│   │   └── get-order-by-id.ts
│   └── ...

RULE: Server Actions go in actions/ directory with 'use server' directive.
RULE: Queries go in queries/ directory. No directive needed (server by default).
RULE: NEVER put database queries in page.tsx — extract to queries/.
RULE: Server Actions handle mutations. Queries handle reads. Separate them.
```

### Server Action Implementation

```typescript
// features/orders/actions/create-order.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/features/auth/queries/get-current-user';

const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1),
  })).min(1),
  shippingAddressId: z.string(),
});

export async function createOrder(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const parsed = CreateOrderSchema.safeParse({
    items: JSON.parse(formData.get('items') as string),
    shippingAddressId: formData.get('shippingAddressId'),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  const order = await db.order.create({
    data: {
      userId: user.id,
      items: { create: parsed.data.items },
      shippingAddressId: parsed.data.shippingAddressId,
    },
  });

  revalidatePath('/orders');
  redirect(`/orders/${order.id}`);
}
```

### Query Implementation

```typescript
// features/orders/queries/get-orders.ts
import { cache } from 'react';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/features/auth/queries/get-current-user';

// React cache() deduplicates calls within a single render
export const getOrders = cache(async (page = 1, limit = 20) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { items: { include: { product: true } } },
    }),
    db.order.count({ where: { userId: user.id } }),
  ]);

  return { orders, total, totalPages: Math.ceil(total / limit) };
});
```

---

## 6. Route Handlers (API Routes)

### Organization

```
app/api/
├── auth/
│   ├── login/route.ts                 ← POST /api/auth/login
│   ├── register/route.ts             ← POST /api/auth/register
│   └── [...nextauth]/route.ts        ← NextAuth catch-all
├── users/
│   ├── route.ts                       ← GET, POST /api/users
│   └── [id]/
│       └── route.ts                   ← GET, PUT, DELETE /api/users/:id
├── webhooks/
│   ├── stripe/route.ts               ← Stripe webhook handler
│   └── clerk/route.ts                ← Clerk webhook handler
├── upload/
│   └── route.ts                       ← File upload endpoint
└── cron/
    └── cleanup/route.ts              ← Cron job endpoint (Vercel Cron)
```

### Route Handler Implementation

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const users = await db.user.findMany({
    skip: (page - 1) * limit,
    take: limit,
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  // validate and create...
}
```

```
RULE: Use Route Handlers for external API consumption (mobile apps, webhooks).
RULE: Use Server Actions for form mutations within the Next.js app.
RULE: Route Handlers support: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
RULE: Each route.ts file exports named functions matching HTTP methods.
RULE: Route Handlers and page.tsx CANNOT coexist in the same route segment.
```

---

## 7. Middleware

### Middleware Placement and Pattern

```
src/
├── middleware.ts               ← MUST be at src root (or project root without src/)
└── app/
    └── ...

// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth check
  const token = request.cookies.get('session-token');
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isProtectedRoute = pathname.startsWith('/dashboard') ||
                           pathname.startsWith('/settings') ||
                           pathname.startsWith('/admin');

  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and API
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
```

```
RULE: middleware.ts MUST be at the project root or src/ root. Not inside app/.
RULE: Middleware runs on the EDGE runtime — no Node.js APIs (fs, crypto).
RULE: Use middleware for: auth redirects, i18n, A/B testing, header injection.
RULE: DO NOT use middleware for: data fetching, heavy computation, database queries.
RULE: Matcher config is REQUIRED — otherwise middleware runs on EVERY request including static files.
```

---

## 8. Data Fetching Patterns

### Fetch in Server Components (Default)

```typescript
// app/products/page.tsx — Server Component
import { Suspense } from 'react';
import { ProductList } from '@/features/products/components/product-list';
import { ProductListSkeleton } from '@/features/products/components/product-list-skeleton';

export default function ProductsPage() {
  return (
    <div>
      <h1>Products</h1>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList />
      </Suspense>
    </div>
  );
}

// features/products/components/product-list.tsx — Server Component
import { getProducts } from '@/features/products/queries/get-products';

export async function ProductList() {
  const products = await getProducts();
  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name} — ${p.price}</li>
      ))}
    </ul>
  );
}
```

### Client-Side Fetching (When Needed)

```typescript
// features/search/components/search-results.tsx
'use client';

import useSWR from 'swr';
// or: import { useQuery } from '@tanstack/react-query';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function SearchResults({ query }: { query: string }) {
  const { data, error, isLoading } = useSWR(
    query ? `/api/search?q=${encodeURIComponent(query)}` : null,
    fetcher
  );

  if (isLoading) return <p>Searching...</p>;
  if (error) return <p>Error searching</p>;
  return <ul>{data?.results.map(/* ... */)}</ul>;
}
```

```
Data Fetching Decision Tree:

START: Where should this data be fetched?

Is the data needed on initial page load (SEO, LCP)?
├── YES → Fetch in Server Component (default)
│   ├── Static data → fetch() with no cache option (default: force-cache in Next.js 14)
│   ├── Dynamic data → fetch() with { cache: 'no-store' } or { next: { revalidate: 60 } }
│   └── Database → Direct Prisma/Drizzle query in Server Component
│
└── NO → Is it user-triggered? (search, filters, infinite scroll)
    ├── YES → Client-side: SWR, TanStack Query, or fetch in 'use client'
    └── NO → Server Component with Suspense boundary
```

---

## 9. Metadata and SEO

```typescript
// app/layout.tsx — Root metadata
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'My App',
    template: '%s | My App',    // Pages override: "Users | My App"
  },
  description: 'My application description',
  metadataBase: new URL('https://myapp.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'My App',
  },
};

// app/users/[id]/page.tsx — Dynamic metadata
import type { Metadata } from 'next';
import { getUserById } from '@/features/users/queries/get-user-by-id';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getUserById(id);
  return {
    title: user.name,
    description: `Profile of ${user.name}`,
    openGraph: { images: [user.avatarUrl] },
  };
}

export default async function UserPage({ params }: Props) {
  const { id } = await params;
  const user = await getUserById(id); // Deduped by React cache()
  return <UserProfile user={user} />;
}
```

```
RULE: Define metadata in layout.tsx for shared metadata, page.tsx for page-specific.
RULE: Use generateMetadata() for dynamic metadata (needs async data).
RULE: Use title.template in root layout for consistent page titles.
RULE: Set metadataBase in root layout — all relative OG image URLs resolve against it.
RULE: generateMetadata runs on the server. It can access database directly.
```

---

## 10. Project Configuration

### next.config.ts

```typescript
// next.config.ts (Next.js 15+ uses .ts by default)
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Strict mode for React (double-render in dev)
  reactStrictMode: true,

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },

  // Redirects
  async redirects() {
    return [
      { source: '/old-path', destination: '/new-path', permanent: true },
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
    typedRoutes: true,            // Type-safe Links
    serverActions: { bodySizeLimit: '2mb' },
  },
};

export default nextConfig;
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 11. Co-location Patterns

### Private Folders (Underscore Convention)

```
app/
├── dashboard/
│   ├── page.tsx
│   ├── _components/               ← Private folder — NOT a route
│   │   ├── stats-overview.tsx     ← Only used by dashboard/page.tsx
│   │   ├── recent-orders.tsx
│   │   └── quick-actions.tsx
│   ├── _lib/                      ← Private folder — route-specific logic
│   │   └── dashboard-utils.ts
│   └── _hooks/
│       └── use-dashboard-data.ts

RULE: _ prefix makes folders private — Next.js will NOT create routes for them.
RULE: Use _components/ for route-specific components that don't belong in features/.
RULE: Use _lib/ for route-specific utilities.
RULE: If a component is used by 2+ routes, move it to features/ or shared/.
```

### When to Co-locate vs Feature Module

```
Component used by only THIS page?
├── YES → Co-locate in _components/ next to page.tsx
└── NO → Is it used by 2-3 pages in the same route segment?
    ├── YES → Co-locate in parent segment's _components/
    └── NO → Move to features/{feature}/components/
        Is it truly generic (Button, Modal, DataTable)?
        └── YES → Move to shared/components/ui/
```

---

## 12. Providers Pattern

```typescript
// shared/components/providers/providers.tsx
'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '@/shared/components/ui/toaster';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, retry: 1 },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// app/layout.tsx — Root layout wraps with Providers
import { Providers } from '@/shared/components/providers/providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```
RULE: All 'use client' providers MUST be in a single Providers wrapper component.
RULE: Root layout.tsx is a Server Component — it wraps {children} with Providers.
RULE: This is the ONLY acceptable pattern for client-side context in Next.js App Router.
RULE: NEVER add 'use client' to layout.tsx itself — only to the Providers component.
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **'use client' at root layout** | Entire app becomes client-rendered, losing RSC benefits | Keep layout.tsx as Server Component. Use Providers wrapper |
| **Fetching in Client Components** | Unnecessary loading spinners, no SSR benefit, poor SEO | Fetch in Server Components, pass data as props |
| **Business logic in page.tsx** | 200+ line page files, tight coupling to routes | Extract to features/{name}/queries/ and actions/ |
| **God utils.ts** | Single file with 50+ unrelated utility functions | Split by domain: lib/date.ts, lib/format.ts, lib/validation.ts |
| **Nested client boundaries** | Multiple 'use client' directives in a component tree | Push 'use client' boundary as LOW as possible |
| **No loading.tsx** | White screen during server-side data fetching | Add loading.tsx at each route segment with data fetching |
| **No error.tsx** | Unhandled errors crash the entire page | Add error.tsx at each route segment. Must be 'use client' |
| **Mixing Route Handlers and Server Actions** | Confusion about when to use each | Route Handlers for external APIs, Server Actions for form mutations |
| **Pages Router in new project** | Missing out on RSC, streaming, server actions | Always use App Router for new Next.js projects |
| **Hardcoded metadata** | Duplicate metadata, missing OG tags | Use Metadata API in layout.tsx and generateMetadata() in pages |
| **Everything in app/ directory** | Components, hooks, utils all inside route segments | app/ for routing ONLY. Business logic in features/ |
| **Importing server code in client** | Build errors, leaked secrets, runtime crashes | Strict server/client boundary. Use server-only package |
| **No middleware matcher** | Middleware runs on static file requests, slowing everything | Always define matcher pattern in middleware config |
| **Direct DB calls in page.tsx** | Scattered queries, no reuse, hard to test | Extract to queries/ functions, use React cache() for deduplication |

---

## 14. Caching and Revalidation

```typescript
// Caching strategies in Server Components

// 1. Static (default in production) — cached at build time
const data = await fetch('https://api.example.com/posts');

// 2. Revalidate every 60 seconds (ISR - Incremental Static Regeneration)
const data = await fetch('https://api.example.com/posts', {
  next: { revalidate: 60 },
});

// 3. No cache — always fresh (dynamic rendering)
const data = await fetch('https://api.example.com/posts', {
  cache: 'no-store',
});

// 4. Tag-based revalidation
const data = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] },
});

// In Server Action after mutation:
import { revalidateTag, revalidatePath } from 'next/cache';
revalidateTag('posts');           // Revalidate all fetches with 'posts' tag
revalidatePath('/posts');         // Revalidate the /posts page
```

```
RULE: In Next.js 15, fetch() defaults to cache: 'no-store' (changed from 14).
RULE: Use revalidateTag() for fine-grained cache invalidation after mutations.
RULE: Use revalidatePath() to revalidate an entire page after mutations.
RULE: Use React cache() to deduplicate identical requests within a single render.
RULE: unstable_cache() wraps non-fetch data sources (DB queries) with caching.
```

---

## 15. Enforcement Checklist

- [ ] **App Router used** — app/ directory, NOT pages/
- [ ] **Server Components by default** — 'use client' only when needed
- [ ] **Route groups for layouts** — (marketing), (app), (admin) for separate layouts
- [ ] **loading.tsx at every data-fetching segment** — no white screens during SSR
- [ ] **error.tsx at every segment** — graceful error handling per route
- [ ] **Features directory** — business logic NOT in app/ directory
- [ ] **Server Actions in actions/** — 'use server' files in features/{name}/actions/
- [ ] **Queries in queries/** — data fetching functions extracted from page.tsx
- [ ] **Providers wrapper** — single 'use client' Providers component
- [ ] **Metadata API used** — title template, generateMetadata for dynamic pages
- [ ] **Middleware with matcher** — not running on static files
- [ ] **Path aliases configured** — @/* pointing to src/*
- [ ] **Private folders** — _components/ for route-specific components
- [ ] **No business logic in page.tsx** — pages compose features, don't implement them
- [ ] **Caching strategy defined** — revalidation tags on data-fetching, invalidation in actions
- [ ] **Type-safe routes** — experimental.typedRoutes enabled

---

## 16. Real-World Examples and References

### Open Source Reference Projects

| Repository | Description | Key Pattern |
|-----------|-------------|-------------|
| `shadcn-ui/taxonomy` | Next.js 14 App Router + shadcn/ui | Feature-based with shadcn/ui |
| `sadmann7/skateshop` | E-commerce with App Router, Drizzle | Full-stack App Router patterns |
| `calcom/cal.com` | Scheduling SaaS (enterprise scale) | Turborepo monorepo + Next.js |
| `steven-tey/dub` | Link management platform | App Router + Server Actions |
| `midday-ai/midday` | Financial management SaaS | Enterprise App Router + Supabase |
| `documenso/documenso` | Open source document signing | Enterprise Next.js patterns |
| `t3-oss/create-t3-app` | Full-stack Next.js starter | tRPC + Prisma + NextAuth |
| `vercel/platforms` | Multi-tenant platform template | Advanced routing, middleware |
| `leerob/leerob.io` | Lee Robinson's personal site | Minimal but idiomatic App Router |

### Vercel's Official Recommendations (Lee Robinson)

1. **Use the `src/` directory** — keeps root clean
2. **Route groups for layout boundaries** — `(marketing)`, `(app)`, `(auth)`
3. **Co-locate when it makes sense** — page-specific components in `_components/`
4. **Server Components by default** — only opt into client when needed
5. **Server Actions for mutations** — replace most API routes
6. **Parallel routes for modals** — `@modal` slot pattern
7. **Metadata API** — use `generateMetadata` for dynamic SEO
8. **Streaming with loading.tsx** — immediate shell, stream content

### shadcn/ui Configuration

```json
// components.json — Generated by `npx shadcn@latest init`
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}

RULE: shadcn/ui generates components into src/components/ui/ (kebab-case).
RULE: NEVER modify generated shadcn/ui files for feature logic — create wrappers.
RULE: Theme via CSS variables in globals.css, not by editing component files.
```

---

## 17. Comparison: Small vs Enterprise Structure

```
┌──────────────────────┬──────────────────────────────────┬────────────────────────────────────┐
│ Concern              │ Small (1-4 devs, <30 routes)     │ Enterprise (5+ devs, 50+ routes)   │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Route organization   │ Flat routes in app/              │ Route groups: (marketing), (app),   │
│                      │                                  │ (auth), (admin) with own layouts    │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Business logic       │ features/ with simple structure  │ features/ with actions/, queries/,   │
│                      │                                  │ validations/, types/, barrel exports │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Shared components    │ components/ui/ (shadcn) +        │ components/ui/ + components/shared/  │
│                      │ components/layouts/               │ + components/providers/ + layouts/   │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Data fetching        │ Server Components + queries/     │ Server Components + cached queries    │
│                      │                                  │ + TanStack Query for real-time        │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ API routes           │ api/webhooks/ only               │ api/webhooks/ + api/cron/ + api/trpc │
│                      │                                  │ + api/upload/                         │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Database             │ Prisma/Drizzle with direct       │ Drizzle with migrations, seed,        │
│                      │ queries in Server Components     │ cached queries, connection pooling    │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Auth                 │ NextAuth / Clerk                 │ Custom auth with middleware +          │
│                      │                                  │ RBAC + session management             │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Testing              │ Vitest unit tests                │ Vitest + Playwright E2E + integration │
│                      │                                  │ tests + visual regression              │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ CI/CD                │ Vercel auto-deploy               │ Preview deploys + staging + prod +     │
│                      │                                  │ DB migrations in CI                    │
└──────────────────────┴──────────────────────────────────┴────────────────────────────────────┘
```
