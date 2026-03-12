# Vue 3 + Nuxt 3 Project Structure

> **Domain:** Project Structure > Web > Frontend
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2025

---

## Overview

Vue 3 with the Composition API fundamentally changed how Vue projects are organized. Nuxt 3
builds on this with convention-over-configuration, auto-imports, and a file-based routing system
that makes certain folder structures mandatory. This guide covers both standalone Vue 3 projects
and Nuxt 3 projects at enterprise scale.

---

## Why Structure Matters in Vue/Nuxt

- **Auto-imports depend on convention**: Nuxt 3 auto-imports from `composables/`, `utils/`, and
  `components/` -- putting code in the wrong directory means it will not be auto-imported
- **File-based routing**: Pages in `pages/` become routes automatically; misplacing a file creates
  unintended routes or 404s
- **Server/client boundary**: Nuxt 3's `server/` directory runs exclusively on the server -- mixing
  this up leaks secrets or creates hydration errors
- **Composition API encourages extraction**: Without structure, composables sprawl across the project
- **TypeScript-first**: Nuxt 3 generates `.nuxt/` types automatically; structure affects type inference

---

## Standalone Vue 3 Enterprise Structure

For projects using Vue 3 without Nuxt (e.g., with Vite + Vue Router + Pinia):

```
my-vue-app/
├── .vscode/
│   ├── extensions.json                # Recommended extensions (Volar, ESLint)
│   └── settings.json                  # Workspace settings
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── api/                           # API layer
│   │   ├── client.ts                  # Axios/fetch instance, interceptors
│   │   ├── endpoints/
│   │   │   ├── auth.api.ts            # Auth-related API calls
│   │   │   ├── users.api.ts           # User CRUD API calls
│   │   │   ├── products.api.ts
│   │   │   └── index.ts              # Re-exports
│   │   └── types/                     # API request/response types
│   │       ├── auth.types.ts
│   │       └── users.types.ts
│   ├── assets/
│   │   ├── images/
│   │   ├── fonts/
│   │   └── styles/
│   │       ├── _variables.scss
│   │       ├── _mixins.scss
│   │       ├── _reset.scss
│   │       └── main.scss
│   ├── components/
│   │   ├── common/                    # Shared/generic components
│   │   │   ├── AppButton.vue
│   │   │   ├── AppModal.vue
│   │   │   ├── AppToast.vue
│   │   │   ├── AppTable/
│   │   │   │   ├── AppTable.vue
│   │   │   │   ├── AppTableRow.vue
│   │   │   │   ├── AppTableHeader.vue
│   │   │   │   └── index.ts
│   │   │   └── form/
│   │   │       ├── FormInput.vue
│   │   │       ├── FormSelect.vue
│   │   │       ├── FormCheckbox.vue
│   │   │       └── FormDatePicker.vue
│   │   ├── layout/                    # Layout components
│   │   │   ├── TheHeader.vue          # "The" prefix = singleton
│   │   │   ├── TheSidebar.vue
│   │   │   ├── TheFooter.vue
│   │   │   └── TheBreadcrumb.vue
│   │   └── domain/                    # Feature-specific components
│   │       ├── users/
│   │       │   ├── UserCard.vue
│   │       │   ├── UserAvatar.vue
│   │       │   └── UserList.vue
│   │       └── products/
│   │           ├── ProductCard.vue
│   │           ├── ProductGrid.vue
│   │           └── ProductFilters.vue
│   ├── composables/                   # Composition API hooks
│   │   ├── useAuth.ts                 # Authentication state/logic
│   │   ├── useApi.ts                  # Generic API composable
│   │   ├── useForm.ts                 # Form validation logic
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   ├── usePagination.ts
│   │   └── useBreakpoints.ts
│   ├── directives/                    # Custom Vue directives
│   │   ├── vClickOutside.ts
│   │   ├── vTooltip.ts
│   │   └── index.ts
│   ├── layouts/                       # Layout wrappers (if using vue-router layouts)
│   │   ├── DefaultLayout.vue
│   │   ├── AuthLayout.vue
│   │   └── AdminLayout.vue
│   ├── pages/                         # Route-level page components
│   │   ├── HomePage.vue
│   │   ├── auth/
│   │   │   ├── LoginPage.vue
│   │   │   └── RegisterPage.vue
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.vue
│   │   │   └── DashboardSettingsPage.vue
│   │   └── users/
│   │       ├── UsersListPage.vue
│   │       └── UserDetailPage.vue
│   ├── plugins/                       # Vue plugins
│   │   ├── i18n.ts                    # Vue I18n setup
│   │   ├── pinia.ts                   # Pinia setup (if custom)
│   │   └── sentry.ts                  # Error tracking
│   ├── router/
│   │   ├── index.ts                   # Router instance
│   │   ├── guards.ts                  # Navigation guards
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── dashboard.routes.ts
│   │       └── index.ts
│   ├── stores/                        # Pinia stores
│   │   ├── auth.store.ts
│   │   ├── users.store.ts
│   │   ├── ui.store.ts                # UI state (sidebar, theme, modals)
│   │   ├── notifications.store.ts
│   │   └── index.ts
│   ├── types/                         # Shared TypeScript types
│   │   ├── models/
│   │   │   ├── user.model.ts
│   │   │   └── product.model.ts
│   │   ├── enums.ts
│   │   └── global.d.ts
│   ├── utils/                         # Pure utility functions (no Vue dependency)
│   │   ├── formatters.ts              # Date/currency/number formatters
│   │   ├── validators.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── App.vue                        # Root component
│   ├── main.ts                        # Entry point
│   └── env.d.ts                       # Vite env type declarations
├── tests/
│   ├── unit/
│   │   ├── components/
│   │   ├── composables/
│   │   └── stores/
│   ├── e2e/
│   │   ├── specs/
│   │   └── fixtures/
│   └── setup.ts
├── .env
├── .env.development
├── .env.production
├── .eslintrc.cjs
├── .prettierrc
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

### Key Naming Conventions (Vue 3)

| Item | Convention | Example |
|------|-----------|---------|
| Components | PascalCase, multi-word | `UserCard.vue`, `AppButton.vue` |
| Singletons | "The" prefix | `TheHeader.vue`, `TheSidebar.vue` |
| Composables | "use" prefix | `useAuth.ts`, `useForm.ts` |
| Stores (Pinia) | `.store.ts` suffix | `auth.store.ts` |
| API files | `.api.ts` suffix | `users.api.ts` |
| Types | `.types.ts` or `.model.ts` | `user.model.ts` |
| Directives | "v" prefix | `vClickOutside.ts` |

---

## Nuxt 3 Enterprise Structure

Nuxt 3 uses convention-over-configuration with mandatory directory names:

```
my-nuxt-app/
├── .nuxt/                             # GENERATED - never edit, gitignored
│   ├── types/                         # Auto-generated types
│   └── tsconfig.json                  # Extends your tsconfig
├── .output/                           # GENERATED - build output, gitignored
├── app/                               # App entry (Nuxt 3.x new convention)
│   ├── app.vue                        # Root component (replaces layouts for simple apps)
│   ├── app.config.ts                  # Runtime app configuration
│   ├── error.vue                      # Global error page
│   ├── router.options.ts              # Custom router options
│   ├── components/                    # Auto-imported components
│   │   ├── global/                    # Globally registered (no lazy loading)
│   │   │   └── Icon.vue
│   │   ├── common/
│   │   │   ├── AppButton.vue          # <AppButton> auto-available
│   │   │   ├── AppModal.vue
│   │   │   └── form/
│   │   │       ├── FormInput.vue      # <FormInput> auto-available
│   │   │       └── FormSelect.vue
│   │   ├── layout/
│   │   │   ├── TheHeader.vue
│   │   │   ├── TheSidebar.vue
│   │   │   └── TheFooter.vue
│   │   └── domain/
│   │       ├── auth/
│   │       │   ├── AuthLoginForm.vue
│   │       │   └── AuthSocialButtons.vue
│   │       ├── dashboard/
│   │       │   ├── DashboardStats.vue
│   │       │   └── DashboardChart.vue
│   │       └── users/
│   │           ├── UserCard.vue
│   │           └── UserTable.vue
│   ├── composables/                   # Auto-imported composables
│   │   ├── useAuth.ts                 # Auto-imported as useAuth()
│   │   ├── useApi.ts
│   │   ├── usePagination.ts
│   │   ├── useFormValidation.ts
│   │   └── states.ts                  # Shared state via useState()
│   ├── layouts/                       # Layout components
│   │   ├── default.vue                # <NuxtLayout> default
│   │   ├── auth.vue                   # Login/register layout
│   │   ├── admin.vue                  # Admin panel layout
│   │   └── blank.vue                  # No chrome layout
│   ├── middleware/                     # Route middleware
│   │   ├── auth.ts                    # Named: definePageMeta({ middleware: 'auth' })
│   │   ├── admin.ts                   # Admin role check
│   │   └── auth.global.ts            # .global suffix = runs on every route
│   ├── pages/                         # File-based routing
│   │   ├── index.vue                  # -> /
│   │   ├── about.vue                  # -> /about
│   │   ├── auth/
│   │   │   ├── login.vue              # -> /auth/login
│   │   │   ├── register.vue           # -> /auth/register
│   │   │   └── forgot-password.vue    # -> /auth/forgot-password
│   │   ├── dashboard/
│   │   │   ├── index.vue              # -> /dashboard
│   │   │   └── settings.vue           # -> /dashboard/settings
│   │   ├── users/
│   │   │   ├── index.vue              # -> /users
│   │   │   └── [id].vue              # -> /users/:id (dynamic)
│   │   ├── admin/
│   │   │   ├── index.vue              # -> /admin
│   │   │   └── [...slug].vue         # -> /admin/* (catch-all)
│   │   └── [...slug].vue             # -> /* (404 catch-all)
│   ├── plugins/                       # Nuxt plugins
│   │   ├── 01.sentry.client.ts        # .client = client-only, 01. = order
│   │   ├── 02.api.ts                  # Runs on both client & server
│   │   ├── vuetify.ts                 # UI framework plugin
│   │   └── directives.ts             # Register custom directives
│   └── utils/                         # Auto-imported utility functions
│       ├── formatDate.ts              # Auto-imported as formatDate()
│       ├── formatCurrency.ts
│       ├── validators.ts
│       └── constants.ts
├── assets/                            # Processed by bundler
│   ├── css/
│   │   ├── main.css                   # or main.scss
│   │   ├── variables.css
│   │   └── transitions.css
│   ├── fonts/
│   │   └── inter/
│   └── images/
│       └── logo.svg
├── content/                           # Nuxt Content module (optional)
│   ├── blog/
│   │   ├── 1.getting-started.md       # Numbered for ordering
│   │   └── 2.advanced-guide.md
│   └── docs/
│       └── api-reference.md
├── i18n/                              # Internationalization (if using @nuxtjs/i18n)
│   ├── locales/
│   │   ├── en.json
│   │   ├── el.json
│   │   └── de.json
│   └── i18n.config.ts
├── layers/                            # Nuxt Layers (for shared code across projects)
│   └── base/
│       ├── nuxt.config.ts
│       ├── components/
│       └── composables/
├── modules/                           # Custom Nuxt modules
│   └── analytics/
│       ├── index.ts                   # Module definition
│       └── runtime/
│           ├── plugin.ts
│           └── composables/
│               └── useAnalytics.ts
├── public/                            # Static files (served as-is)
│   ├── favicon.ico
│   ├── robots.txt
│   └── og-image.png
├── server/                            # Nitro server (runs ONLY on server)
│   ├── api/                           # API routes -> /api/*
│   │   ├── auth/
│   │   │   ├── login.post.ts          # POST /api/auth/login
│   │   │   ├── logout.post.ts         # POST /api/auth/logout
│   │   │   └── me.get.ts             # GET /api/auth/me
│   │   ├── users/
│   │   │   ├── index.get.ts           # GET /api/users
│   │   │   ├── index.post.ts          # POST /api/users
│   │   │   ├── [id].get.ts           # GET /api/users/:id
│   │   │   ├── [id].put.ts           # PUT /api/users/:id
│   │   │   └── [id].delete.ts        # DELETE /api/users/:id
│   │   └── health.get.ts             # GET /api/health
│   ├── middleware/                     # Server middleware (not route middleware)
│   │   ├── cors.ts
│   │   └── log.ts
│   ├── plugins/                       # Nitro server plugins
│   │   └── database.ts               # DB connection on server start
│   ├── routes/                        # Non-API server routes
│   │   └── sitemap.xml.ts            # /sitemap.xml
│   ├── utils/                         # Server-only utilities (auto-imported in server/)
│   │   ├── database.ts               # DB client
│   │   ├── auth.ts                   # Token verification
│   │   └── email.ts                  # Email sending
│   └── tsconfig.json                 # Server-specific TS config
├── stores/                            # Pinia stores (auto-imported with @pinia/nuxt)
│   ├── auth.ts                        # defineStore('auth', () => { ... })
│   ├── users.ts
│   ├── cart.ts
│   └── ui.ts
├── types/                             # Shared type definitions
│   ├── index.d.ts                     # Global type augmentations
│   ├── api.d.ts                       # API types
│   └── models/
│       ├── user.ts
│       └── product.ts
├── .env                               # Environment variables
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── app.config.ts                      # Runtime config (exposed to client)
├── nuxt.config.ts                     # Nuxt configuration
├── package.json
└── tsconfig.json
```

---

## Nuxt 3 Auto-Imports System

Nuxt 3 auto-imports from specific directories. Understanding this is critical:

### What Gets Auto-Imported

| Directory | Import Behavior | Example |
|-----------|----------------|---------|
| `components/` | All `.vue` files, by directory-prefixed name | `components/domain/UserCard.vue` -> `<DomainUserCard>` |
| `composables/` | Named exports and default exports from `.ts`/`.js` | `composables/useAuth.ts` -> `useAuth()` |
| `utils/` | Named exports and default exports | `utils/formatDate.ts` -> `formatDate()` |
| `server/utils/` | Auto-imported within `server/` context only | `server/utils/db.ts` -> `db` in server handlers |
| `stores/` | With `@pinia/nuxt` module installed | `stores/auth.ts` -> `useAuthStore()` |

### Auto-Import Naming with Nested Directories

```
components/
├── base/
│   └── Button.vue          ->  <BaseButton>
├── domain/
│   └── user/
│       └── Card.vue        ->  <DomainUserCard>
└── TheHeader.vue           ->  <TheHeader>
```

To customize component name resolution in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  components: [
    { path: '~/components/common', prefix: 'App' },
    { path: '~/components/domain', prefix: '' },
    { path: '~/components', pathPrefix: true },   // default behavior
  ]
})
```

### Explicit Imports When Needed

Even with auto-imports, you can use explicit imports for clarity:

```typescript
// This works but is optional in Nuxt 3
import { useAuth } from '~/composables/useAuth'
import { useUserStore } from '~/stores/user'
```

Nuxt generates a `.nuxt/imports.d.ts` file so TypeScript understands auto-imports.

---

## Pinia Store Organization Patterns

### Pattern 1: Setup Stores (Recommended for Composition API)

```typescript
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isAuthenticated = computed(() => !!token.value)

  // Actions
  async function login(credentials: LoginCredentials) {
    const { data } = await useFetch('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
    user.value = data.value.user
    token.value = data.value.token
  }

  function logout() {
    user.value = null
    token.value = null
    navigateTo('/auth/login')
  }

  return { user, token, isAuthenticated, login, logout }
})
```

### Pattern 2: Domain-Grouped Stores for Large Apps

```
stores/
├── modules/
│   ├── auth/
│   │   ├── auth.store.ts
│   │   ├── auth.store.test.ts
│   │   └── types.ts
│   ├── cart/
│   │   ├── cart.store.ts
│   │   ├── cart.store.test.ts
│   │   └── types.ts
│   └── products/
│       ├── products.store.ts
│       └── types.ts
└── index.ts                  # Re-exports all stores
```

### Pattern 3: Store Composition (Stores Using Other Stores)

```typescript
// stores/cart.ts
export const useCartStore = defineStore('cart', () => {
  const authStore = useAuthStore() // Composing stores

  const items = ref<CartItem[]>([])
  const total = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.qty, 0)
  )

  async function checkout() {
    if (!authStore.isAuthenticated) {
      throw new Error('Must be logged in')
    }
    // ...
  }

  return { items, total, checkout }
})
```

---

## Anthony Fu's Patterns (Influential in Vue Ecosystem)

Anthony Fu (core team member of Vue, Nuxt, Vite, and creator of VueUse, UnoCSS, Slidev) advocates:

### 1. Composable-First Architecture

- Extract ALL reactive logic into composables
- A component should be mostly template with minimal `<script setup>` logic
- Use VueUse as a reference for composable design patterns

### 2. Auto-Import Everything

```typescript
// nuxt.config.ts -- Anthony Fu's approach
export default defineNuxtConfig({
  imports: {
    dirs: [
      'composables/**',      // Scan nested directories
      'utils/**',
      'stores/**',
    ]
  }
})
```

### 3. Opinionated Tooling Config

Anthony Fu's `@antfu/eslint-config` is the de facto standard in the Vue ecosystem:

```typescript
// eslint.config.js
import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  unocss: true,
})
```

### 4. Icon-First Design with unplugin-icons

```
// Components are auto-generated from icon sets
<IconMdiHome />       // Material Design Icons
<IconTablerUser />    // Tabler Icons
// No manual SVG management needed
```

### 5. File Naming: kebab-case for Files, PascalCase for Components

Anthony Fu and the Nuxt team prefer `kebab-case` filenames that resolve to PascalCase component names:

```
components/
├── the-header.vue      ->  <TheHeader>
├── user-card.vue       ->  <UserCard>
```

---

## Server Directory Deep Dive

The `server/` directory uses Nitro (H3) and has its own auto-import context:

```
server/
├── api/                    # /api/* routes
│   └── users/
│       ├── index.get.ts    # GET  /api/users
│       ├── index.post.ts   # POST /api/users
│       └── [id].get.ts     # GET  /api/users/:id
├── routes/                 # Non-api routes
│   ├── _sitemap.ts         # /sitemap (underscore = no nesting)
│   └── feed.xml.ts         # /feed.xml
├── middleware/              # Runs before every server request
│   ├── 01.cors.ts
│   └── 02.auth.ts
├── plugins/                # Run on Nitro server startup
│   ├── database.ts         # Initialize DB connection pool
│   └── migrations.ts       # Run migrations on startup
├── utils/                  # Auto-imported in server context
│   ├── db.ts               # Drizzle/Prisma client
│   ├── auth.ts             # JWT verify, session helpers
│   └── validation.ts       # Zod schemas
└── tsconfig.json
```

### Server Handler Example

```typescript
// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = await db.query.users.findFirst({
    where: eq(users.id, Number(id))
  })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }
  return user
})
```

---

## Best Practices

1. **Use the `app/` directory convention** (Nuxt 3.x): Move components, composables, pages, etc.
   under `app/` for clearer separation from server code and configuration
2. **Leverage auto-imports**: Do not fight the system with manual imports everywhere. Use
   `.nuxt/imports.d.ts` for type safety
3. **Server utils stay in server/**: Never import from `server/utils/` in client code
4. **Use Nuxt Layers for shared code**: If multiple projects share components or composables,
   extract into a layer, not a separate npm package (unless widely reusable)
5. **Pinia setup stores over options stores**: Setup stores (using `() => {}` syntax) compose better
   with the Composition API
6. **Plugin ordering**: Prefix plugins with numbers (`01.sentry.client.ts`) for explicit load order
7. **Middleware naming**: Use `.global.ts` suffix sparingly; named middleware is more explicit
8. **Keep pages thin**: Pages should compose components and composables, not contain business logic

---

## Anti-Patterns

### 1. Putting Business Logic in Pages

```vue
<!-- BAD: Fat page component -->
<script setup>
const users = ref([])
const loading = ref(false)
const error = ref(null)
const page = ref(1)
const search = ref('')

async function fetchUsers() {
  loading.value = true
  try {
    const response = await $fetch('/api/users', { params: { page: page.value, search: search.value }})
    users.value = response.data
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}
// ... 200 more lines of logic
</script>
```

```vue
<!-- GOOD: Thin page, logic in composable -->
<script setup>
const { users, loading, error, page, search, fetchUsers } = useUsers()
</script>
```

### 2. Importing Server Utils in Client Code

```typescript
// BAD: This will break or leak server secrets
import { db } from '~/server/utils/db'      // NEVER in client code
import { verifyToken } from '~/server/utils/auth'

// GOOD: Use API routes as the boundary
const { data } = await useFetch('/api/users')
```

### 3. Not Using Auto-Import Directories

```typescript
// BAD: Creating random directories and manually importing
import { useAuth } from '@/lib/hooks/auth'     // Nuxt doesn't know about lib/
import { formatDate } from '@/helpers/date'     // helpers/ is not auto-imported

// GOOD: Use the convention directories
import { useAuth } from '~/composables/useAuth'  // or just useAuth() (auto-imported)
import { formatDate } from '~/utils/formatDate'  // or just formatDate() (auto-imported)
```

### 4. Giant Monolithic Stores

```typescript
// BAD: One store for everything
export const useAppStore = defineStore('app', () => {
  // auth state, user state, cart state, UI state, notifications...
  // 500+ lines
})

// GOOD: Domain-separated stores that compose each other
export const useAuthStore = defineStore('auth', () => { /* ... */ })
export const useCartStore = defineStore('cart', () => { /* ... */ })
export const useUIStore = defineStore('ui', () => { /* ... */ })
```

### 5. Overusing .global Middleware

```typescript
// BAD: Everything is global middleware
// middleware/analytics.global.ts
// middleware/auth.global.ts
// middleware/feature-flags.global.ts
// middleware/logging.global.ts     <-- runs on EVERY navigation

// GOOD: Most middleware should be named and applied per-page
// middleware/auth.ts  -> applied via definePageMeta({ middleware: ['auth'] })
// Only truly universal concerns (analytics) should be .global
```

### 6. Ignoring the Server/Client Split in Plugins

```typescript
// BAD: Heavy client-only library loaded on server
// plugins/chart.ts           <-- runs on both server AND client

// GOOD: Use .client.ts suffix
// plugins/chart.client.ts    <-- only runs in browser
```

---

## Real-World Examples and References

- **Nuxt UI Pro Templates**: Official enterprise templates from NuxtLabs (SaaS dashboards, landing
  pages, docs sites) -- the canonical reference for Nuxt 3 structure
- **Elk (Mastodon client)**: Open-source Nuxt 3 app by the Vue/Nuxt core team
  (https://github.com/elk-zone/elk) -- demonstrates real composable-first architecture
- **Atinux's portfolio**: Daniel Roe's (Nuxt lead) projects showcase idiomatic Nuxt 3 patterns
- **VueUse**: Anthony Fu's collection of composables -- the gold standard for composable design
  (https://github.com/vueuse/vueuse)
- **Vitesse**: Anthony Fu's opinionated Vite + Vue starter
  (https://github.com/antfu-collective/vitesse)

---

## Sources

- Nuxt 3 Official Documentation -- https://nuxt.com/docs/guide/directory-structure
- Vue 3 Style Guide -- https://vuejs.org/style-guide/
- Pinia Documentation -- https://pinia.vuejs.org/
- Anthony Fu's Blog -- https://antfu.me/
- Nitro Documentation -- https://nitro.unjs.io/
