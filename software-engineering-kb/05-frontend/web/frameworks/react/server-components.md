# React Server Components — Complete Specification

> **AI Plugin Directive:** When a developer asks "what are Server Components?", "how do RSC work?", "when to use 'use client'?", "what are Server Actions?", "how to fetch data in Next.js App Router?", "what can cross the server-client boundary?", or any question about the React server-first paradigm, ALWAYS consult this directive. Apply the server-first mental model: components run on the server by default, only opt into the client when interactivity is needed. NEVER add "use client" without a specific reason.

**Core Rule: In React Server Components architecture, ALL components are Server Components by default — they run ONLY on the server, have ZERO client-side JavaScript, and can directly access databases, file systems, and APIs. Add "use client" ONLY when you need interactivity (hooks, event handlers, browser APIs). NEVER add "use client" to data-fetching components. NEVER pass non-serializable values (functions, classes, Symbols) across the server-client boundary. Use Server Actions ("use server") for all mutations.**

---

## 1. The Server-First Mental Model

```
          REACT SERVER COMPONENTS ARCHITECTURE

  ┌─────────────────────── SERVER ──────────────────────┐
  │                                                     │
  │  Server Components (default)                        │
  │  ┌─────────────────────────────────────────────┐   │
  │  │ • Run ONLY on the server                    │   │
  │  │ • Zero JavaScript sent to client            │   │
  │  │ • Can use: async/await, fs, db, env vars    │   │
  │  │ • CANNOT use: useState, useEffect, onClick  │   │
  │  │ • Output: RSC Payload (serialized React)    │   │
  │  └─────────────────────────────────────────────┘   │
  │                                                     │
  │  Server Actions ("use server")                      │
  │  ┌─────────────────────────────────────────────┐   │
  │  │ • Functions that run on the server           │   │
  │  │ • Called from client via RPC                 │   │
  │  │ • Used for: mutations, form submissions     │   │
  │  │ • Progressive enhancement (work without JS) │   │
  │  └─────────────────────────────────────────────┘   │
  │                                                     │
  └─────────────────────────────────────────────────────┘
                          │
                    RSC Payload
                    (NOT HTML)
                          │
                          ▼
  ┌──────────────────── CLIENT ─────────────────────────┐
  │                                                     │
  │  Client Components ("use client")                   │
  │  ┌─────────────────────────────────────────────┐   │
  │  │ • Traditional React components              │   │
  │  │ • JavaScript sent to client bundle          │   │
  │  │ • CAN use: hooks, event handlers, browser   │   │
  │  │ • Hydrated on the client                    │   │
  │  │ • Used for: interactivity, forms, animation │   │
  │  └─────────────────────────────────────────────┘   │
  │                                                     │
  └─────────────────────────────────────────────────────┘

  KEY INSIGHT: RSC payload is NOT HTML — it's a serialized
  React tree that the client reconciles into the DOM.
  This enables client-side navigation without full page reloads.
```

---

## 2. Server vs Client Components

### 2.1 Capability Matrix

```
┌──────────────────────────┬──────────────┬──────────────┐
│ Capability               │ Server       │ Client       │
│                          │ Component    │ Component    │
├──────────────────────────┼──────────────┼──────────────┤
│ async/await in component │ ✅ YES       │ ❌ NO        │
│ Direct DB/API access     │ ✅ YES       │ ❌ NO        │
│ Access file system       │ ✅ YES       │ ❌ NO        │
│ Read environment vars    │ ✅ YES       │ ❌ NO (sec)  │
│ Import server-only pkgs  │ ✅ YES       │ ❌ NO        │
│ Render other SC          │ ✅ YES       │ ❌ NO*       │
│ Zero client JS           │ ✅ YES       │ ❌ NO        │
├──────────────────────────┼──────────────┼──────────────┤
│ useState                 │ ❌ NO        │ ✅ YES       │
│ useEffect                │ ❌ NO        │ ✅ YES       │
│ useRef                   │ ❌ NO        │ ✅ YES       │
│ Event handlers (onClick) │ ❌ NO        │ ✅ YES       │
│ Browser APIs (window)    │ ❌ NO        │ ✅ YES       │
│ Class components         │ ❌ NO        │ ✅ YES       │
│ Custom hooks with state  │ ❌ NO        │ ✅ YES       │
├──────────────────────────┼──────────────┼──────────────┤
│ Shared components        │ ✅ YES       │ ✅ YES       │
│ (no hooks, no async)     │              │              │
└──────────────────────────┴──────────────┴──────────────┘

* Client components CAN render Server Components passed as children/props
```

### 2.2 The "use client" Directive

```typescript
// "use client" marks the BOUNDARY — this file and everything
// it imports becomes part of the client bundle

'use client'; // MUST be at the top of the file, before imports

import { useState } from 'react';

// This component and all components it IMPORTS are client components
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}

// RULES:
// 1. "use client" creates a BOUNDARY — everything imported below is client
// 2. You DON'T need "use client" in every file — just the boundary entry points
// 3. Place "use client" as DEEP as possible in the component tree
// 4. Components without "use client" in a Server Component context = Server Component
// 5. Components without "use client" imported by a Client Component = Client Component
```

### 2.3 Deciding Server vs Client

```
DECISION TREE: Server or Client Component?

START: Does this component need...
│
├── State (useState, useReducer)?
│   └── YES → "use client" ✅
│
├── Effects (useEffect, useLayoutEffect)?
│   └── YES → "use client" ✅
│
├── Event handlers (onClick, onChange, onSubmit)?
│   └── YES → "use client" ✅
│
├── Browser APIs (window, document, navigator, localStorage)?
│   └── YES → "use client" ✅
│
├── Custom hooks that use state or effects?
│   └── YES → "use client" ✅
│
├── Third-party library that uses hooks internally?
│   └── YES → "use client" ✅ (check library RSC support)
│
├── Direct database/API access or file system?
│   └── YES → Server Component (default) ✅
│
├── Only renders JSX from props/data?
│   └── Server Component (default) ✅
│
└── Fetches data then renders?
    └── Server Component with async/await ✅

RULE: Default to Server Component. Only add "use client" when
you have a SPECIFIC reason from the list above.
```

---

## 3. Data Fetching in Server Components

```typescript
// ✅ Server Components can be async — fetch data directly
// app/users/page.tsx (Next.js App Router)
import { db } from '@/lib/db';

// NO "use client" — this is a Server Component
export default async function UsersPage() {
  // Direct database access — runs on the server
  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <main>
      <h1>Users</h1>
      <UserList users={users} />
    </main>
  );
}

// ✅ Parallel data fetching — ALWAYS parallelize independent fetches
async function DashboardPage() {
  // ❌ SEQUENTIAL (waterfall — each waits for the previous)
  const user = await getUser();
  const posts = await getPosts(user.id);
  const analytics = await getAnalytics();

  // ✅ PARALLEL (all fetch simultaneously)
  const [user, posts, analytics] = await Promise.all([
    getUser(),
    getPosts(),
    getAnalytics(),
  ]);

  return <Dashboard user={user} posts={posts} analytics={analytics} />;
}

// ✅ Streaming with Suspense — don't block on slow data
import { Suspense } from 'react';

async function ProductPage({ params }: { params: { id: string } }) {
  // Fast data — load immediately
  const product = await getProduct(params.id);

  return (
    <main>
      <h1>{product.name}</h1>
      <p>{product.description}</p>

      {/* Slow data — stream when ready */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={params.id} />
      </Suspense>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations category={product.category} />
      </Suspense>
    </main>
  );
}

// Reviews loads independently — doesn't block the page
async function Reviews({ productId }: { productId: string }) {
  const reviews = await getReviews(productId); // May take 2-3 seconds
  return <ReviewList reviews={reviews} />;
}
```

### 3.1 Caching and Revalidation (Next.js)

```typescript
// Next.js extends fetch with caching options

// STATIC: Cached indefinitely (like SSG)
const data = await fetch('https://api.example.com/posts', {
  cache: 'force-cache', // Default in Next.js
});

// DYNAMIC: Fresh data every request (like SSR)
const data = await fetch('https://api.example.com/posts', {
  cache: 'no-store',
});

// ISR: Revalidate after N seconds
const data = await fetch('https://api.example.com/posts', {
  next: { revalidate: 3600 }, // Revalidate every hour
});

// TAG-BASED: Revalidate by tag (on-demand)
const data = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] },
});
// In a Server Action:
import { revalidateTag } from 'next/cache';
revalidateTag('posts'); // Invalidate all fetches tagged 'posts'

// For non-fetch data sources (database queries):
import { unstable_cache } from 'next/cache';

const getCachedUser = unstable_cache(
  async (userId: string) => db.user.findUnique({ where: { id: userId } }),
  ['user'],
  { revalidate: 3600, tags: ['user'] }
);
```

---

## 4. Server Actions

```typescript
// Server Actions are async functions that run on the server
// Defined with "use server" at the top of the function or file

// PATTERN 1: Inline server action (in Server Component)
async function TodoPage() {
  const todos = await getTodos();

  async function addTodo(formData: FormData) {
    'use server';
    const text = formData.get('text') as string;
    await db.todo.create({ data: { text } });
    revalidatePath('/todos');
  }

  return (
    <form action={addTodo}>
      <input name="text" required />
      <button type="submit">Add</button>
    </form>
  );
}

// PATTERN 2: Separate actions file (for use in Client Components)
// app/actions/todo-actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const CreateTodoSchema = z.object({
  text: z.string().min(1).max(500),
});

export async function createTodo(prevState: ActionState, formData: FormData) {
  // ALWAYS validate on server — client can be bypassed
  const parsed = CreateTodoSchema.safeParse({
    text: formData.get('text'),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors, success: false };
  }

  try {
    await db.todo.create({ data: { text: parsed.data.text } });
    revalidatePath('/todos');
    return { error: null, success: true };
  } catch (err) {
    return { error: { _form: ['Failed to create todo'] }, success: false };
  }
}

export async function deleteTodo(id: string) {
  await db.todo.delete({ where: { id } });
  revalidatePath('/todos');
}

// PATTERN 3: Client Component consuming Server Actions
// components/todo-form.tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createTodo } from '@/actions/todo-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Adding...' : 'Add Todo'}
    </button>
  );
}

export function TodoForm() {
  const [state, action] = useActionState(createTodo, {
    error: null,
    success: false,
  });

  return (
    <form action={action}>
      <input name="text" required />
      {state.error?.text && <p className="error">{state.error.text}</p>}
      <SubmitButton />
    </form>
  );
}
```

### 4.1 Server Action Security

```typescript
// CRITICAL SECURITY RULES FOR SERVER ACTIONS:

// 1. ALWAYS validate input — Server Actions are public HTTP endpoints
'use server';

export async function updateUser(formData: FormData) {
  // ❌ NEVER trust client input
  const userId = formData.get('userId') as string;
  await db.user.update({ where: { id: userId }, data: { ... } });
  // Anyone can change userId — they can update any user!

  // ✅ ALWAYS authenticate and authorize
  const session = await getSession();
  if (!session?.user) throw new Error('Unauthorized');

  // Update ONLY the authenticated user's data
  await db.user.update({
    where: { id: session.user.id },
    data: { name: formData.get('name') as string },
  });
}

// 2. ALWAYS validate with schema (Zod)
const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
});

// 3. Server Actions generate CSRF tokens automatically (Next.js)
// No manual CSRF handling needed

// 4. Rate limiting — add at middleware level
// Server Actions can be called programmatically, not just from forms
```

---

## 5. The Server-Client Boundary

```
SERIALIZATION BOUNDARY:

  Server Component                Client Component
  ┌──────────────────┐           ┌──────────────────┐
  │                  │   props   │                  │
  │  async function  │──────────▶│  'use client'    │
  │  ProductPage()   │           │  ProductCard()   │
  │                  │           │                  │
  └──────────────────┘           └──────────────────┘

  WHAT CAN CROSS THE BOUNDARY (serializable):
  ✅ Strings, numbers, booleans, null, undefined
  ✅ Arrays and plain objects (containing serializable values)
  ✅ Date objects (serialized as ISO strings)
  ✅ FormData
  ✅ Server Action references (functions with "use server")
  ✅ React elements (JSX) — including Server Components rendered as children
  ✅ Promises (with use() hook)

  WHAT CANNOT CROSS (non-serializable):
  ❌ Functions (event handlers, callbacks)
  ❌ Class instances
  ❌ Symbols
  ❌ DOM nodes / refs
  ❌ Closures
  ❌ Streams
  ❌ Map, Set, WeakMap, WeakSet
```

### 5.1 Composition Patterns

```typescript
// PATTERN 1: Server Component renders Client Component
// ✅ CORRECT — pass data as props, interactivity in client
// page.tsx (Server Component)
import { InteractiveChart } from './chart';

export default async function AnalyticsPage() {
  const data = await getAnalyticsData(); // Server-side fetch

  return (
    <main>
      <h1>Analytics</h1>
      {/* Pass serializable data to client component */}
      <InteractiveChart data={data} />
    </main>
  );
}

// chart.tsx (Client Component)
'use client';

import { useState } from 'react';

export function InteractiveChart({ data }: { data: DataPoint[] }) {
  const [zoom, setZoom] = useState(1);
  // Interactive chart with hooks — needs "use client"
  return <canvas onClick={() => setZoom(z => z * 1.1)} />;
}

// PATTERN 2: Server Component as children of Client Component
// ✅ CORRECT — children slot passes through without re-rendering
// layout.tsx (Server Component)
import { Sidebar } from './sidebar'; // Client Component
import { Navigation } from './navigation'; // Server Component

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Sidebar>
      {/* Navigation is a Server Component passed as children */}
      {/* It does NOT become a client component */}
      <Navigation />
      {children}
    </Sidebar>
  );
}

// sidebar.tsx (Client Component)
'use client';

export function Sidebar({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <aside className={isOpen ? 'open' : 'closed'}>
      <button onClick={() => setIsOpen(o => !o)}>Toggle</button>
      {children} {/* Server Component renders here — still server-rendered! */}
    </aside>
  );
}

// PATTERN 3: Passing Server Actions to Client Components
// ✅ Server Actions can cross the boundary (they're serializable references)
// page.tsx (Server Component)
import { LikeButton } from './like-button';
import { toggleLike } from './actions';

export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      <LikeButton
        isLiked={post.isLiked}
        onToggle={toggleLike.bind(null, params.id)} // Bind server action
      />
    </article>
  );
}

// ❌ WRONG: Passing a regular function across boundary
export default async function Page() {
  function handleClick() { // Not serializable!
    console.log('clicked');
  }
  return <ClientComponent onClick={handleClick} />; // ERROR
}
```

### 5.2 Common Boundary Mistakes

```typescript
// ❌ MISTAKE 1: "use client" at the top of every file
// This defeats the purpose — everything becomes client code
'use client'; // DON'T do this unless the component needs interactivity

// ❌ MISTAKE 2: Using hooks in Server Components
export default async function Page() {
  const [count, setCount] = useState(0); // ERROR: hooks not allowed in SC
}

// ❌ MISTAKE 3: Importing Server Component directly in Client Component
'use client';
import { ServerThing } from './server-thing'; // This makes it a client component!
// FIX: Pass as children or props from a parent Server Component

// ❌ MISTAKE 4: Passing non-serializable props
export default async function Page() {
  const ref = useRef(null); // Can't even use ref in SC
  return <ClientComp ref={ref} />; // Can't pass ref across boundary
  // FIX: Use ref inside the client component itself
}

// ❌ MISTAKE 5: Fetching data in client components when server is possible
'use client';
export function UserList() {
  // Don't do this if the data doesn't need to be fetched client-side
  const { data } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  // BETTER: Fetch in a Server Component and pass as props
}
```

---

## 6. Performance Impact

```
BUNDLE SIZE COMPARISON:

  Traditional React (CSR):
  ┌─────────────────────────────────────────────────┐
  │ Client Bundle: ALL components + ALL dependencies │
  │ ███████████████████████████████████████████████  │
  │ ~200-500KB (typical SPA)                        │
  └─────────────────────────────────────────────────┘

  With Server Components:
  ┌─────────────────────────────────────────────────┐
  │ Server-only: 0 KB client JS                     │
  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
  │                                                 │
  │ Client Bundle: ONLY interactive components      │
  │ ████████████████                                │
  │ ~50-150KB (only what needs interactivity)       │
  └─────────────────────────────────────────────────┘

  SAVINGS:
  - Heavy markdown renderer (remark/rehype): 0 KB client (server only)
  - Data tables with static data: 0 KB client
  - Syntax highlighting: 0 KB client
  - Date formatting libraries: 0 KB client
  - Database ORMs: 0 KB client
  - Authentication logic: 0 KB client (server only)
```

```typescript
// EXAMPLE: Markdown rendering — ZERO client JS
// This component runs entirely on the server
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import rehypePrismPlus from 'rehype-prism-plus';

// These dependencies are NEVER sent to the client
// unified + remark + rehype + prism = ~500KB — all stays on server

async function MarkdownContent({ source }: { source: string }) {
  const html = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypePrismPlus)
    .use(rehypeStringify)
    .process(source);

  return <div dangerouslySetInnerHTML={{ __html: String(html) }} />;
}
```

---

## 7. Streaming and Suspense

```
STREAMING SSR WITH RSC:

  Server                                          Client
  ──────                                          ──────

  1. Start rendering Server Components
     │
     ├── <Header />     ──→ HTML chunk 1 ─────────▶ Display header
     ├── <Sidebar />    ──→ HTML chunk 2 ─────────▶ Display sidebar
     │
     ├── <Suspense fallback={<Skeleton />}>
     │   └── <SlowData />  → Skeleton ────────────▶ Display skeleton
     │
     ├── (SlowData resolves after 2 seconds)
     │   └── <SlowData />  → HTML chunk 3 ────────▶ Replace skeleton
     │
     └── <Footer />     ──→ HTML chunk 4 ─────────▶ Display footer

  TIMELINE:
  ├───────┼────────┼────────────────┼──────────┤
  0ms     200ms    400ms           2400ms      Done
  Header  Sidebar  Skeleton        SlowData    Footer
  renders renders  shows           resolves    renders
```

```typescript
// Nested Suspense boundaries for independent streaming
export default async function ProductPage({ params }: { params: { id: string } }) {
  // Critical data — blocks the page
  const product = await getProduct(params.id);

  return (
    <main>
      {/* Renders immediately */}
      <ProductHeader product={product} />
      <ProductImages images={product.images} />

      {/* Streams independently — each resolves on its own */}
      <Suspense fallback={<PriceSkeleton />}>
        <DynamicPrice productId={params.id} />
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={params.id} />
      </Suspense>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations category={product.category} />
      </Suspense>
    </main>
  );
}

// RULE: Each Suspense boundary streams independently
// If Reviews takes 3s and Recommendations takes 1s,
// Recommendations appears after 1s — doesn't wait for Reviews
```

---

## 8. Framework Implementation

### 8.1 Next.js App Router (Primary RSC Implementation)

```
NEXT.JS APP ROUTER FILE CONVENTIONS:

app/
├── layout.tsx          ← Root Server Component (wraps all pages)
├── page.tsx            ← Server Component (route: /)
├── loading.tsx         ← Suspense fallback (auto-wrapped)
├── error.tsx           ← Error boundary ("use client" required)
├── not-found.tsx       ← 404 page
├── template.tsx        ← Like layout but re-mounts on navigation
│
├── dashboard/
│   ├── layout.tsx      ← Nested layout (Server Component)
│   ├── page.tsx        ← Server Component (route: /dashboard)
│   └── loading.tsx     ← /dashboard loading state
│
├── api/
│   └── route.ts        ← API Route (Route Handler, not RSC)
│
└── (auth)/             ← Route group (no URL segment)
    ├── login/
    │   └── page.tsx
    └── register/
        └── page.tsx

RULES:
- page.tsx = Server Component by default
- layout.tsx = Server Component by default
- error.tsx = MUST be "use client" (Error Boundaries need state)
- loading.tsx = Auto-creates <Suspense> around page
- Components in app/ without "use client" = Server Components
```

```typescript
// app/layout.tsx — Root Layout (Server Component)
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'My App',
  description: 'Built with Next.js App Router',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <Providers> {/* Client Component for theme/auth providers */}
          <Header />   {/* Can be Server or Client */}
          <main>{children}</main>
          <Footer />   {/* Server Component — no interactivity */}
        </Providers>
      </body>
    </html>
  );
}

// app/dashboard/page.tsx — Dashboard Page (Server Component)
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardMetrics } from '@/components/dashboard-metrics';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const metrics = await getMetrics(session.user.id);

  return (
    <div>
      <h1>Dashboard</h1>
      <DashboardMetrics data={metrics} /> {/* Could be Server or Client */}
    </div>
  );
}
```

---

## 9. Migration Strategy

```
MIGRATING TO SERVER COMPONENTS:

Phase 1: Identify Component Types
  └── Audit every component:
      ├── Uses hooks/events? → Client Component
      ├── Fetches data? → Server Component candidate
      ├── Pure render from props? → Shared Component
      └── Uses browser APIs? → Client Component

Phase 2: Push "use client" Down
  └── Move interactivity to leaf components
      ├── Page-level → keep as Server Component
      ├── Data fetching → keep as Server Component
      ├── Interactive widgets → "use client"
      └── Forms → "use client" with Server Actions

Phase 3: Move Data Fetching to Server
  └── Replace client-side fetching with server fetching:
      ├── useEffect + fetch → async Server Component
      ├── TanStack Query → async Server Component (when possible)
      └── Keep client fetching for: real-time data, user interactions

Phase 4: Adopt Server Actions
  └── Replace API routes for mutations:
      ├── POST /api/create → Server Action
      ├── PUT /api/update → Server Action
      ├── DELETE /api/delete → Server Action
      └── Keep API routes for: webhooks, third-party integrations
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **"use client" on everything** | Large bundles, no RSC benefits, all JS shipped to client | Only add "use client" to components that need interactivity |
| **Using hooks in Server Components** | Build error: "useState/useEffect not available in Server Components" | Move hooks to Client Components, pass data as props |
| **Passing functions across boundary** | Serialization error: "Functions cannot be passed to Client Components" | Use Server Actions ("use server") or move function to client |
| **Fetching data client-side when server is possible** | Unnecessary client JS, waterfall loading, no streaming | Fetch in Server Component with async/await |
| **Not using Suspense boundaries** | Entire page blocks on slowest data source | Wrap independent data sections in Suspense |
| **Sequential server fetches** | Waterfall loading: TTFB = sum of all fetches | Use Promise.all() for independent fetches |
| **Importing Server Component in Client Component** | Component becomes client code, loses server benefits | Pass as children or render props from parent Server Component |
| **No loading/error states** | Blank screen during server render, unhandled errors | Use loading.tsx, error.tsx, or manual Suspense/ErrorBoundary |
| **Over-fetching in Server Components** | Slow TTFB, unnecessary data transfer, database load | Fetch only needed fields, paginate, use database projections |
| **Not validating Server Action input** | Security vulnerability: anyone can call Server Actions with any data | ALWAYS validate with Zod/schema, authenticate, authorize |
| **Using Server Actions for reads** | Server Actions are for mutations, not data fetching | Use Server Components for reads, Server Actions for writes |
| **Forgetting revalidation** | Stale data after mutation, UI doesn't reflect changes | Call revalidatePath/revalidateTag after mutations |

---

## 11. Enforcement Checklist

### Component Classification
- [ ] Components are Server Components by DEFAULT (no directive)
- [ ] "use client" added ONLY when hooks, events, or browser APIs are needed
- [ ] "use client" placed as DEEP as possible in the component tree
- [ ] No hooks (useState, useEffect, etc.) used in Server Components

### Data Fetching
- [ ] Data fetched in Server Components with async/await
- [ ] Independent fetches parallelized with Promise.all()
- [ ] Slow data sections wrapped in Suspense boundaries
- [ ] Caching strategy defined for each fetch (static, revalidate, no-store)
- [ ] Cache tags used for granular revalidation

### Server Actions
- [ ] ALL mutations use Server Actions (not API routes)
- [ ] Server Actions validate ALL input with Zod/schema
- [ ] Server Actions authenticate and authorize the user
- [ ] revalidatePath/revalidateTag called after data mutations
- [ ] useActionState used for form state management
- [ ] useFormStatus used for loading indicators

### Boundary Management
- [ ] Only serializable values cross the server-client boundary
- [ ] Server Components passed as children (not imported by Client Components)
- [ ] Server Actions used for server-callable functions from client
- [ ] No functions, classes, or Symbols passed as props to Client Components

### Performance
- [ ] Heavy dependencies kept server-side only (markdown, syntax highlight, ORM)
- [ ] Bundle size verified — client bundle contains only interactive components
- [ ] loading.tsx / Suspense used for all async pages
- [ ] error.tsx used for all route segments with error handling

### Security
- [ ] Server Actions protected with authentication checks
- [ ] No sensitive environment variables exposed to client
- [ ] Input validation on ALL Server Actions (Zod schemas)
- [ ] server-only package used for server-exclusive modules
- [ ] No database credentials or API keys in client components
