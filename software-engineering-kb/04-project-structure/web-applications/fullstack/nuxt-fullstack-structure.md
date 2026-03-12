# Nuxt 3 Full-Stack Project Structure

> **AI Plugin Directive:** When generating a full-stack Nuxt 3 application with both frontend (Vue 3) and backend (Nitro server), ALWAYS use this structure. Apply auto-imports, composables, and Nitro server routes for a unified full-stack experience. This guide covers Nuxt 3.10+ with Nitro, Pinia, and modern patterns.

**Core Rule: Leverage Nuxt's auto-import system and Nitro server engine. NEVER manually import from `#imports`. Use the `server/` directory for ALL backend logic with Nitro's file-based routing.**

---

## 1. Enterprise Full-Stack Structure

```
my-app/
├── app/                               # App directory (Nuxt 4 convention)
│   ├── app.vue                        # Root component
│   ├── error.vue                      # Global error page
│   │
│   ├── pages/                         # File-based routing
│   │   ├── index.vue                  # /
│   │   ├── login.vue                  # /login
│   │   ├── register.vue               # /register
│   │   ├── dashboard/
│   │   │   ├── index.vue              # /dashboard
│   │   │   └── settings.vue           # /dashboard/settings
│   │   ├── users/
│   │   │   ├── index.vue              # /users (list)
│   │   │   └── [id].vue              # /users/:id (detail)
│   │   └── orders/
│   │       ├── index.vue
│   │       └── [id].vue
│   │
│   ├── layouts/                       # Layout components
│   │   ├── default.vue                # Public layout
│   │   ├── auth.vue                   # Login/register layout
│   │   └── dashboard.vue              # Dashboard with sidebar
│   │
│   ├── components/                    # Auto-imported components
│   │   ├── ui/                        # Primitives
│   │   │   ├── UiButton.vue
│   │   │   ├── UiInput.vue
│   │   │   ├── UiDialog.vue
│   │   │   └── UiDataTable.vue
│   │   ├── layout/
│   │   │   ├── LayoutHeader.vue
│   │   │   ├── LayoutSidebar.vue
│   │   │   └── LayoutFooter.vue
│   │   ├── users/
│   │   │   ├── UserTable.vue
│   │   │   ├── UserForm.vue
│   │   │   └── UserCard.vue
│   │   └── orders/
│   │       ├── OrderList.vue
│   │       └── OrderDetail.vue
│   │
│   ├── composables/                   # Auto-imported composables
│   │   ├── useAuth.ts                 # Authentication state
│   │   ├── usePagination.ts           # Pagination logic
│   │   └── useNotification.ts         # Toast notifications
│   │
│   ├── stores/                        # Pinia stores
│   │   ├── auth.ts                    # Auth store
│   │   └── ui.ts                      # UI state (sidebar, theme)
│   │
│   └── middleware/                     # Route middleware
│       ├── auth.ts                    # Require authentication
│       └── admin.ts                   # Require admin role
│
├── server/                            # Nitro server (backend)
│   ├── api/                           # API routes (/api/*)
│   │   ├── auth/
│   │   │   ├── login.post.ts          # POST /api/auth/login
│   │   │   ├── register.post.ts       # POST /api/auth/register
│   │   │   ├── logout.post.ts         # POST /api/auth/logout
│   │   │   └── me.get.ts             # GET /api/auth/me
│   │   ├── users/
│   │   │   ├── index.get.ts           # GET /api/users
│   │   │   ├── index.post.ts          # POST /api/users
│   │   │   ├── [id].get.ts            # GET /api/users/:id
│   │   │   ├── [id].put.ts            # PUT /api/users/:id
│   │   │   └── [id].delete.ts         # DELETE /api/users/:id
│   │   └── orders/
│   │       ├── index.get.ts
│   │       ├── index.post.ts
│   │       └── [id].get.ts
│   │
│   ├── middleware/                     # Server middleware
│   │   ├── auth.ts                    # JWT validation
│   │   └── logging.ts                 # Request logging
│   │
│   ├── plugins/                       # Nitro plugins (lifecycle)
│   │   └── database.ts                # DB connection on startup
│   │
│   ├── services/                      # Business logic
│   │   ├── user.service.ts
│   │   ├── order.service.ts
│   │   └── auth.service.ts
│   │
│   ├── repositories/                  # Database queries
│   │   ├── user.repository.ts
│   │   └── order.repository.ts
│   │
│   ├── models/                        # Database models / Drizzle schema
│   │   ├── user.ts
│   │   ├── order.ts
│   │   └── index.ts
│   │
│   ├── utils/                         # Server-only utilities
│   │   ├── db.ts                      # Database client
│   │   ├── jwt.ts                     # JWT helpers
│   │   ├── password.ts                # Hashing
│   │   └── validation.ts              # Zod schemas
│   │
│   └── tsconfig.json                  # Server-specific TS config
│
├── shared/                            # Shared between client + server
│   ├── types/
│   │   ├── user.ts                    # User types
│   │   └── order.ts                   # Order types
│   └── utils/
│       ├── format.ts                  # Date/number formatting
│       └── constants.ts               # Shared constants
│
├── public/                            # Static assets
├── .env
├── .env.example
├── nuxt.config.ts                     # Nuxt configuration
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── drizzle.config.ts                  # Drizzle ORM config
└── Dockerfile
```

---

## 2. Server API Route Pattern

```typescript
// server/api/users/index.get.ts
import { userRepository } from "~~/server/repositories/user.repository";

export default defineEventHandler(async (event) => {
  // Auth check (server middleware sets event.context.user)
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const query = getQuery(event);
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { items, total } = await userRepository.findAll({
    page,
    limit,
    search: query.search as string | undefined,
  });

  return { items, total, page, limit };
});


// server/api/users/index.post.ts
import { z } from "zod";
import { userService } from "~~/server/services/user.service";

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
  role: z.enum(["user", "admin"]).default("user"),
});

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const body = await readValidatedBody(event, createUserSchema.parse);
  const newUser = await userService.createUser(body);

  setResponseStatus(event, 201);
  return newUser;
});


// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "User ID required" });
  }

  const user = await userRepository.findById(Number(id));
  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  return user;
});
```

---

## 3. Server Services and Repositories

```typescript
// server/services/user.service.ts
import { userRepository } from "~~/server/repositories/user.repository";
import { hashPassword } from "~~/server/utils/password";

export const userService = {
  async createUser(data: {
    email: string;
    fullName: string;
    password: string;
    role: string;
  }) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw createError({ statusCode: 409, message: "Email already exists" });
    }

    const hashedPassword = await hashPassword(data.password);

    return userRepository.create({
      email: data.email,
      fullName: data.fullName,
      passwordHash: hashedPassword,
      role: data.role,
    });
  },

  async updateUser(id: number, data: Partial<{ email: string; fullName: string }>) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw createError({ statusCode: 404, message: "User not found" });
    }
    return userRepository.update(id, data);
  },
};


// server/repositories/user.repository.ts
import { db } from "~~/server/utils/db";
import { users } from "~~/server/models";
import { eq, ilike, or, count, desc } from "drizzle-orm";

export const userRepository = {
  async findAll(params: { page: number; limit: number; search?: string }) {
    const offset = (params.page - 1) * params.limit;
    const where = params.search
      ? or(
          ilike(users.fullName, `%${params.search}%`),
          ilike(users.email, `%${params.search}%`),
        )
      : undefined;

    const [items, [{ total }]] = await Promise.all([
      db.select().from(users).where(where)
        .orderBy(desc(users.createdAt))
        .limit(params.limit).offset(offset),
      db.select({ total: count() }).from(users).where(where),
    ]);

    return { items, total };
  },

  async findById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  },

  async findByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user ?? null;
  },

  async create(data: typeof users.$inferInsert) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  async update(id: number, data: Partial<typeof users.$inferInsert>) {
    const [user] = await db.update(users).set(data)
      .where(eq(users.id, id)).returning();
    return user;
  },

  async delete(id: number) {
    await db.delete(users).where(eq(users.id, id));
  },
};
```

---

## 4. Client-Side Data Fetching

```vue
<!-- app/pages/users/index.vue -->
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: ["auth"],
});

const route = useRoute();
const page = computed(() => Number(route.query.page) || 1);
const search = ref(route.query.search as string || "");

const { data, pending, error, refresh } = await useFetch("/api/users", {
  query: { page, search, limit: 20 },
  watch: [page, search],
});

async function deleteUser(id: number) {
  await $fetch(`/api/users/${id}`, { method: "DELETE" });
  refresh();
}
</script>

<template>
  <div>
    <h1>Users</h1>
    <UiInput v-model="search" placeholder="Search users..." />

    <div v-if="pending">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <template v-else>
      <UserTable
        :users="data!.items"
        @delete="deleteUser"
      />
      <UiPagination
        :total="data!.total"
        :page="data!.page"
        :limit="data!.limit"
      />
    </template>
  </div>
</template>
```

---

## 5. Authentication Flow

```typescript
// server/middleware/auth.ts
import { verifyToken } from "~~/server/utils/jwt";

export default defineEventHandler(async (event) => {
  // Skip auth for public routes
  const publicPaths = ["/api/auth/login", "/api/auth/register"];
  if (publicPaths.some((p) => event.path?.startsWith(p))) return;
  if (!event.path?.startsWith("/api/")) return;

  const authorization = getHeader(event, "authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, message: "Missing token" });
  }

  const token = authorization.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    throw createError({ statusCode: 401, message: "Invalid token" });
  }

  event.context.user = payload;
});


// app/composables/useAuth.ts
export function useAuth() {
  const user = useState<AuthUser | null>("auth-user", () => null);
  const token = useCookie("auth-token");

  async function login(email: string, password: string) {
    const data = await $fetch("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    token.value = data.token;
    user.value = data.user;
    navigateTo("/dashboard");
  }

  async function logout() {
    token.value = null;
    user.value = null;
    navigateTo("/login");
  }

  async function fetchUser() {
    if (!token.value) return;
    try {
      user.value = await $fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token.value}` },
      });
    } catch {
      token.value = null;
      user.value = null;
    }
  }

  return { user, token, login, logout, fetchUser };
}
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Business logic in API routes | Fat route handlers with 50+ lines | Extract to `server/services/` |
| Direct DB access in routes | `db.select()` in every route file | Use `server/repositories/` layer |
| No validation | `readBody(event)` without parsing | Use `readValidatedBody()` with Zod |
| Client-side auth only | Auth state only in Pinia/composable | Validate JWT in server middleware |
| Manual imports | `import { ref } from 'vue'` everywhere | Nuxt auto-imports Vue + Nuxt utilities |
| No shared types | Types duplicated in client and server | Use `shared/types/` directory |
| Fat pages | 300+ line components in pages/ | Extract to `components/` and `composables/` |

---

## 7. Enforcement Checklist

- [ ] `server/api/` uses HTTP method suffixes (`.get.ts`, `.post.ts`)
- [ ] Server middleware validates JWT for ALL `/api/` routes
- [ ] Business logic in `server/services/` — route handlers are thin
- [ ] Database queries in `server/repositories/` — services NEVER import ORM
- [ ] `readValidatedBody()` with Zod on ALL POST/PUT endpoints
- [ ] `useFetch()` or `$fetch()` for client data fetching — NEVER raw `fetch()`
- [ ] Shared types in `shared/types/` — NO duplication between client/server
- [ ] Auto-imports leveraged — NEVER manual import of Vue/Nuxt utilities
- [ ] Layouts defined per section — `default`, `auth`, `dashboard`
- [ ] Route middleware for auth checks — `definePageMeta({ middleware: ["auth"] })`
