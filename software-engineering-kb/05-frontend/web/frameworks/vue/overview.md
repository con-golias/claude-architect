# Vue.js — Complete Specification

> **AI Plugin Directive:** When a developer asks "how does Vue work?", "should I use Vue?", "what is Vue's reactivity system?", "explain Vue 3 features", "Vue vs React?", "how to set up a Vue project?", or any foundational Vue question, ALWAYS consult this directive. Apply Vue 3's Composition API with `<script setup>`, Proxy-based reactivity, and Single File Components. NEVER recommend Options API for new projects. Default to Vue 3.5+ with Nuxt 3 for SSR/SSG.

**Core Rule: Vue is a progressive framework built on a Proxy-based reactivity system. Use `<script setup>` with the Composition API EXCLUSIVELY for new code. Vue's reactivity is AUTOMATIC — when you mutate a reactive value, the DOM updates. Use `ref()` for primitives, `reactive()` for objects, `computed()` for derived values. NEVER use Options API in new projects. NEVER mutate props — emit events to the parent. Use Pinia for state management, Nuxt 3 for SSR/SSG, and VueUse for utility composables.**

---

## 1. Vue's Mental Model

```
                    VUE REACTIVITY MODEL

  ┌───────────────────────────────────────────────────┐
  │                                                   │
  │   Reactive State  ──→  Template  ──→  DOM         │
  │        │                                          │
  │        │  (Proxy intercepts get/set)               │
  │        │                                          │
  │        └──→  Dependencies tracked automatically   │
  │              When state mutates → DOM updates     │
  │                                                   │
  └───────────────────────────────────────────────────┘

  COMPARISON WITH REACT:
  ┌──────────────────────┬──────────────────────────────┐
  │ React                │ Vue                          │
  ├──────────────────────┼──────────────────────────────┤
  │ setState(newValue)   │ ref.value = newValue         │
  │ Immutable updates    │ Mutable updates (Proxy)      │
  │ Re-runs entire       │ Tracks exact dependencies    │
  │ component function   │ Updates only what changed    │
  │ Manual memo needed   │ Auto fine-grained reactivity │
  │ JSX (JS-first)       │ Templates (HTML-first)       │
  │ One-way data flow    │ Two-way binding (v-model)    │
  └──────────────────────┴──────────────────────────────┘

  KEY INSIGHT:
  Vue's Proxy-based reactivity automatically tracks which
  template expressions depend on which reactive values.
  When a value changes, ONLY the dependent DOM parts update.
  No virtual DOM diffing of the entire subtree needed.
```

---

## 2. Single File Components

```vue
<!-- UserProfile.vue — Single File Component (SFC) -->
<script setup lang="ts">
// <script setup> is the STANDARD for Vue 3
// All top-level bindings are automatically available in template

import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import type { User } from '@/types'

// PROPS — defineProps is a compiler macro (no import needed)
const props = defineProps<{
  userId: string
  showAvatar?: boolean
}>()

// Default values for props
withDefaults(defineProps<{
  userId: string
  showAvatar?: boolean
}>(), {
  showAvatar: true,
})

// EMITS — defineEmits is a compiler macro
const emit = defineEmits<{
  edit: [userId: string]
  delete: [userId: string]
}>()

// REACTIVE STATE
const isEditing = ref(false)
const user = ref<User | null>(null)
const loading = ref(true)

// COMPUTED — auto-tracked, cached
const displayName = computed(() => {
  if (!user.value) return 'Unknown'
  return `${user.value.firstName} ${user.value.lastName}`
})

// LIFECYCLE
onMounted(async () => {
  try {
    user.value = await fetchUser(props.userId)
  } finally {
    loading.value = false
  }
})

// METHODS — plain functions
function handleEdit() {
  emit('edit', props.userId)
}
</script>

<template>
  <div v-if="loading" class="skeleton" />

  <article v-else-if="user" class="user-profile">
    <img
      v-if="showAvatar"
      :src="user.avatarUrl"
      :alt="displayName"
      class="avatar"
    />
    <h2>{{ displayName }}</h2>
    <p>{{ user.bio }}</p>
    <button @click="handleEdit">Edit Profile</button>
  </article>

  <div v-else class="not-found">User not found</div>
</template>

<style scoped>
/* Scoped styles — only apply to this component */
.user-profile {
  padding: 1rem;
  border-radius: 8px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}
</style>
```

### 2.1 SFC Structure Rules

```
SINGLE FILE COMPONENT RULES:

ORDER:
  1. <script setup lang="ts">  ← Logic first
  2. <template>                ← Template second
  3. <style scoped>            ← Styles last

SCRIPT SETUP RULES:
  - ALWAYS use <script setup> (not <script> with setup())
  - ALWAYS use lang="ts" for TypeScript
  - All top-level variables/functions are auto-exposed to template
  - No explicit return statement needed
  - Compiler macros: defineProps, defineEmits, defineExpose, defineModel, defineSlots

STYLE RULES:
  - ALWAYS use scoped or CSS Modules
  - Scoped styles use attribute selector: .class[data-v-xxx]
  - :deep(.child-class) to style child component elements
  - :slotted(.slot-class) to style slotted content
  - :global(.class) for global styles within scoped block
  - v-bind() in CSS to use reactive values

NAMING:
  - PascalCase for component files: UserProfile.vue
  - PascalCase for component usage in templates: <UserProfile />
  - kebab-case also works in templates: <user-profile /> (auto-resolved)
```

---

## 3. Reactivity System

### 3.1 ref() vs reactive()

```typescript
import { ref, reactive, shallowRef, shallowReactive, toRef, toRefs } from 'vue'

// ref() — RECOMMENDED for most cases
// Wraps value in { value: T } — must use .value in script
const count = ref(0)
const name = ref('Alice')
const user = ref<User | null>(null)

count.value++             // Access with .value in script
// In template: {{ count }} — auto-unwrapped, no .value needed

// reactive() — For objects when you don't want .value
// Uses Proxy directly on the object
const state = reactive({
  count: 0,
  name: 'Alice',
  items: [] as string[],
})

state.count++             // Direct mutation — no .value
state.items.push('new')   // Array methods work directly

// WHEN TO USE WHICH:
// ref()      → Primitives (string, number, boolean)
// ref()      → Values you may reassign entirely (user = newUser)
// reactive() → Objects you mutate in place (form state)
// RULE: When in doubt, use ref() — it's more flexible

// ❌ PITFALL: reactive() loses reactivity on reassignment
const state = reactive({ count: 0 })
state = reactive({ count: 1 }) // ❌ BREAKS reactivity! Variable reassigned

// ❌ PITFALL: Destructuring reactive() loses reactivity
const { count } = reactive({ count: 0 })
// count is now a plain number — NOT reactive!

// ✅ FIX: Use toRefs()
const state = reactive({ count: 0, name: 'Alice' })
const { count, name } = toRefs(state) // Each is a ref linked to original

// shallowRef() — Only tracks .value reassignment, not deep changes
const items = shallowRef<Item[]>([])
items.value.push(newItem)           // ❌ NOT tracked (deep mutation)
items.value = [...items.value, newItem] // ✅ Tracked (.value reassigned)

// shallowReactive() — Only tracks top-level property changes
const obj = shallowReactive({ nested: { count: 0 } })
obj.nested.count++                  // ❌ NOT tracked
obj.nested = { count: 1 }          // ✅ Tracked
```

### 3.2 computed()

```typescript
import { ref, computed } from 'vue'

const items = ref<Item[]>([])
const filter = ref<'all' | 'active' | 'completed'>('all')

// READ-ONLY computed
const filteredItems = computed(() => {
  switch (filter.value) {
    case 'active': return items.value.filter(i => !i.completed)
    case 'completed': return items.value.filter(i => i.completed)
    default: return items.value
  }
})
// filteredItems.value is cached — only recalculates when items or filter change

// WRITABLE computed (rare — use for v-model transforms)
const firstName = ref('John')
const lastName = ref('Doe')

const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (newValue: string) => {
    const [first, ...rest] = newValue.split(' ')
    firstName.value = first
    lastName.value = rest.join(' ')
  },
})

// RULES:
// - Computed values are CACHED — only recalculate when dependencies change
// - NEVER put side effects in computed (use watch/watchEffect instead)
// - ALWAYS use computed for derived values (not ref + watch)
// - Computed returns a readonly ref (access with .value)
```

### 3.3 Watchers

```typescript
import { ref, watch, watchEffect, watchPostEffect } from 'vue'

const userId = ref('123')
const searchQuery = ref('')

// watch() — Explicit source, lazy by default
watch(userId, async (newId, oldId) => {
  console.log(`Changed from ${oldId} to ${newId}`)
  const user = await fetchUser(newId)
  userData.value = user
})

// Watch multiple sources
watch([firstName, lastName], ([newFirst, newLast], [oldFirst, oldLast]) => {
  console.log(`Name changed to ${newFirst} ${newLast}`)
})

// Watch with options
watch(searchQuery, async (query) => {
  if (query.length < 2) return
  results.value = await search(query)
}, {
  immediate: true,    // Run immediately (not just on change)
  deep: true,         // Deep watch objects (expensive — avoid if possible)
  flush: 'post',      // Run after DOM update
})

// watchEffect() — Auto-tracks dependencies (like React useEffect)
watchEffect(async () => {
  // Automatically tracks userId.value — re-runs when it changes
  const user = await fetchUser(userId.value)
  userData.value = user
})

// Cleanup (like React useEffect cleanup)
watchEffect((onCleanup) => {
  const controller = new AbortController()

  fetch(`/api/users/${userId.value}`, { signal: controller.signal })
    .then(r => r.json())
    .then(data => { userData.value = data })

  onCleanup(() => controller.abort()) // Cancel on re-run or unmount
})

// watchPostEffect — Runs after DOM update
watchPostEffect(() => {
  // DOM is updated — safe to read DOM measurements
  const height = element.value?.offsetHeight
})

// DECISION: watch vs watchEffect
// watch()        → When you need old/new values, explicit dependencies
// watchEffect()  → When you want auto-tracking (simpler for side effects)
// watchPostEffect() → When you need DOM to be updated first
```

---

## 4. Template Syntax

### 4.1 Directives

```vue
<template>
  <!-- v-if / v-else-if / v-else — Conditional rendering (unmounts) -->
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>{{ data }}</div>

  <!-- v-show — Toggle visibility (CSS display: none) -->
  <!-- Use v-show for frequent toggles, v-if for rare changes -->
  <div v-show="isVisible">Toggled with CSS</div>

  <!-- v-for — List rendering (ALWAYS use :key) -->
  <ul>
    <li v-for="item in items" :key="item.id">
      {{ item.name }}
    </li>
  </ul>

  <!-- ❌ NEVER: v-if and v-for on same element -->
  <li v-for="item in items" v-if="item.active" :key="item.id">
    <!-- v-if has higher priority — crashes because 'item' doesn't exist -->
  </li>

  <!-- ✅ FIX: Use computed or template wrapper -->
  <li v-for="item in activeItems" :key="item.id">
    {{ item.name }}
  </li>

  <!-- v-model — Two-way binding -->
  <input v-model="name" />            <!-- Equivalent to :value + @input -->
  <input v-model.trim="name" />       <!-- Auto-trim whitespace -->
  <input v-model.number="age" />      <!-- Auto-cast to number -->
  <input v-model.lazy="name" />       <!-- Sync on change, not input -->

  <!-- v-bind shorthand (:) — Attribute binding -->
  <img :src="imageUrl" :alt="imageAlt" />
  <!-- Vue 3.4+: Same-name shorthand -->
  <img :src :alt />  <!-- Equivalent to :src="src" :alt="alt" -->

  <!-- v-on shorthand (@) — Event binding -->
  <button @click="handleClick">Click</button>
  <input @keyup.enter="submit" />      <!-- Key modifier -->
  <form @submit.prevent="handleSubmit"> <!-- Event modifier -->

  <!-- v-slot shorthand (#) — Named slots -->
  <MyComponent>
    <template #header>Header Content</template>
    <template #default>Main Content</template>
    <template #footer>Footer Content</template>
  </MyComponent>

  <!-- Scoped slots — Pass data from child to parent template -->
  <DataTable :items="users">
    <template #cell-name="{ item }">
      <strong>{{ item.name }}</strong>
    </template>
    <template #cell-actions="{ item }">
      <button @click="edit(item)">Edit</button>
    </template>
  </DataTable>
</template>
```

### 4.2 v-model on Components

```vue
<!-- Vue 3.4+: defineModel — simplest two-way binding -->
<!-- SearchInput.vue -->
<script setup lang="ts">
const modelValue = defineModel<string>({ required: true })
// modelValue is a ref — read/write automatically syncs with parent
</script>

<template>
  <input :value="modelValue" @input="modelValue = ($event.target as HTMLInputElement).value" />
  <!-- OR simply: -->
  <input v-model="modelValue" />
</template>

<!-- Parent usage -->
<SearchInput v-model="searchQuery" />

<!-- Multiple v-model bindings -->
<!-- UserForm.vue -->
<script setup lang="ts">
const firstName = defineModel<string>('firstName')
const lastName = defineModel<string>('lastName')
</script>

<!-- Parent -->
<UserForm v-model:firstName="first" v-model:lastName="last" />
```

---

## 5. Composables (Custom Hooks)

```typescript
// Composables are Vue's equivalent of React custom hooks
// Convention: use* prefix, in composables/ directory

// composables/useMousePosition.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useMousePosition() {
  const x = ref(0)
  const y = ref(0)

  function handleMove(event: MouseEvent) {
    x.value = event.clientX
    y.value = event.clientY
  }

  onMounted(() => window.addEventListener('mousemove', handleMove))
  onUnmounted(() => window.removeEventListener('mousemove', handleMove))

  return { x, y }
}

// composables/useFetch.ts
import { ref, watchEffect, type Ref } from 'vue'

export function useFetch<T>(url: Ref<string> | string) {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(true)

  watchEffect(async (onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    loading.value = true
    error.value = null

    try {
      const urlValue = typeof url === 'string' ? url : url.value
      const response = await fetch(urlValue, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      data.value = await response.json()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      error.value = err as Error
    } finally {
      loading.value = false
    }
  })

  return { data, error, loading }
}

// composables/useLocalStorage.ts
import { ref, watch, type Ref } from 'vue'

export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  const stored = localStorage.getItem(key)
  const data = ref<T>(stored ? JSON.parse(stored) : defaultValue) as Ref<T>

  watch(data, (newValue) => {
    localStorage.setItem(key, JSON.stringify(newValue))
  }, { deep: true })

  return data
}

// USAGE
const { x, y } = useMousePosition()
const { data: users, loading } = useFetch<User[]>('/api/users')
const theme = useLocalStorage('theme', 'light')

// VueUse — RECOMMENDED utility composable library (200+ composables)
// import { useMouse, useLocalStorage, useDark, useMediaQuery } from '@vueuse/core'
```

---

## 6. Component Patterns

### 6.1 Props and Events

```typescript
// PROPS — One-way data flow (parent → child)
// defineProps with TypeScript generics
const props = defineProps<{
  title: string
  count?: number
  items: Item[]
  variant: 'primary' | 'secondary'
}>()

// With defaults
const props = withDefaults(defineProps<{
  title: string
  count?: number
  variant?: 'primary' | 'secondary'
}>(), {
  count: 0,
  variant: 'primary',
})

// EVENTS — Child → parent communication
const emit = defineEmits<{
  update: [value: string]
  delete: [id: string]
  'item-selected': [item: Item, index: number]
}>()

// Emit events
emit('update', newValue)
emit('delete', itemId)
emit('item-selected', selectedItem, selectedIndex)

// RULES:
// - Props are READONLY — NEVER mutate them
// - Use emit() to communicate up to parent
// - Use v-model (defineModel) for two-way binding
// - Prop names: camelCase in script, kebab-case in templates
```

### 6.2 Slots

```vue
<!-- Card.vue — Slot-based composition -->
<template>
  <div class="card">
    <header v-if="$slots.header" class="card-header">
      <slot name="header" />
    </header>

    <div class="card-body">
      <slot />  <!-- Default slot -->
    </div>

    <footer v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<!-- Usage -->
<Card>
  <template #header>
    <h2>Card Title</h2>
  </template>

  <p>Main content goes in the default slot</p>

  <template #footer>
    <button>Action</button>
  </template>
</Card>

<!-- Scoped Slots — passing data back to parent -->
<!-- DataList.vue -->
<script setup lang="ts" generic="T">
defineProps<{
  items: T[]
}>()
</script>

<template>
  <ul>
    <li v-for="(item, index) in items" :key="index">
      <slot :item="item" :index="index" />
    </li>
  </ul>
</template>

<!-- Usage — parent controls rendering -->
<DataList :items="users">
  <template #default="{ item: user, index }">
    <span>{{ index + 1 }}. {{ user.name }}</span>
  </template>
</DataList>
```

### 6.3 Provide/Inject

```typescript
// PROVIDE — Ancestor provides values
// layouts/AppLayout.vue
import { provide, ref, readonly } from 'vue'

const theme = ref<'light' | 'dark'>('light')
const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

// Provide readonly ref to prevent child mutation
provide('theme', readonly(theme))
provide('toggleTheme', toggleTheme)

// INJECT — Descendant consumes values
// components/ThemeToggle.vue
import { inject } from 'vue'

const theme = inject<Ref<'light' | 'dark'>>('theme', ref('light'))
const toggleTheme = inject<() => void>('toggleTheme', () => {})

// TYPE-SAFE provide/inject with InjectionKey
import { type InjectionKey } from 'vue'

interface ThemeContext {
  theme: Readonly<Ref<'light' | 'dark'>>
  toggleTheme: () => void
}

export const ThemeKey: InjectionKey<ThemeContext> = Symbol('theme')

// Provider
provide(ThemeKey, { theme: readonly(theme), toggleTheme })

// Consumer
const themeContext = inject(ThemeKey)
if (!themeContext) throw new Error('ThemeKey not provided')
```

---

## 7. Nuxt 3 — Meta-Framework

```
NUXT 3 ARCHITECTURE:

  nuxt-app/
  ├── app.vue                  ← Root component
  ├── nuxt.config.ts           ← Nuxt configuration
  │
  ├── pages/                   ← File-based routing (auto-imported)
  │   ├── index.vue            ← /
  │   ├── about.vue            ← /about
  │   ├── users/
  │   │   ├── index.vue        ← /users
  │   │   └── [id].vue         ← /users/:id
  │   └── [...slug].vue        ← Catch-all route
  │
  ├── components/              ← Auto-imported components
  │   ├── AppHeader.vue
  │   └── ui/
  │       └── Button.vue       ← <UiButton /> auto-resolved
  │
  ├── composables/             ← Auto-imported composables
  │   └── useAuth.ts           ← useAuth() available globally
  │
  ├── layouts/                 ← Layout components
  │   ├── default.vue
  │   └── dashboard.vue
  │
  ├── server/                  ← Nitro server (API routes)
  │   ├── api/
  │   │   ├── users.get.ts     ← GET /api/users
  │   │   └── users.post.ts    ← POST /api/users
  │   └── middleware/
  │       └── auth.ts          ← Server middleware
  │
  ├── middleware/               ← Route middleware (client/universal)
  │   └── auth.ts
  │
  └── plugins/                 ← Nuxt plugins
      └── analytics.ts

KEY FEATURES:
  - Auto-imports: components, composables, utils — no import statements
  - File-based routing: pages/ directory = routes
  - Universal rendering: SSR, SSG, SPA, ISR, hybrid per-route
  - Nitro server: API routes, server middleware, edge deployment
  - useFetch/useAsyncData: SSR-aware data fetching with caching
```

```typescript
// Nuxt data fetching — SSR-aware
// pages/users/[id].vue
<script setup lang="ts">
const route = useRoute()

// useFetch — SSR-aware, cached, auto-refreshed
const { data: user, pending, error } = await useFetch(
  `/api/users/${route.params.id}`,
  {
    // Only fetch on server (SSR) — cached on client navigation
    lazy: false,
    // Transform response
    transform: (data) => data.user,
  }
)

// useAsyncData — for non-fetch data sources
const { data: stats } = await useAsyncData(
  `user-stats-${route.params.id}`,
  () => getUserStats(route.params.id as string)
)
</script>
```

---

## 8. Pinia — State Management

```typescript
// Pinia is Vue's official state management (replaced Vuex)

import { defineStore } from 'pinia'

// OPTION 1: Setup store syntax (RECOMMENDED — like Composition API)
export const useCartStore = defineStore('cart', () => {
  // State
  const items = ref<CartItem[]>([])

  // Getters (computed)
  const totalItems = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )
  const totalPrice = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  // Actions (functions)
  function addItem(product: Product, quantity = 1) {
    const existing = items.value.find(i => i.productId === product.id)
    if (existing) {
      existing.quantity += quantity
    } else {
      items.value.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
      })
    }
  }

  function removeItem(productId: string) {
    items.value = items.value.filter(i => i.productId !== productId)
  }

  function clearCart() {
    items.value = []
  }

  return { items, totalItems, totalPrice, addItem, removeItem, clearCart }
})

// Usage in component
const cart = useCartStore()
cart.addItem(product)
console.log(cart.totalPrice) // Reactive — auto-updates in template

// Pinia plugins: persistence
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// In store definition:
export const useCartStore = defineStore('cart', () => { ... }, {
  persist: true, // Auto-persist to localStorage
})
```

---

## 9. Vue vs React Decision Matrix

```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│ Factor               │ Vue                  │ React                │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Learning curve       │ Gentle — templates   │ Moderate — JSX       │
│                      │ feel like HTML       │ is JS-first          │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Reactivity           │ Automatic (Proxy)    │ Manual (setState)    │
│                      │ Fine-grained updates │ Full subtree re-render│
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Two-way binding      │ Built-in (v-model)   │ Manual (controlled)  │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Styling              │ Scoped CSS built-in  │ External solution    │
│                      │                      │ (Tailwind, CSS-in-JS)│
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Meta-framework       │ Nuxt 3               │ Next.js              │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ State management     │ Pinia (official)     │ Many options          │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Ecosystem size       │ Large                │ Largest              │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Job market           │ Strong (especially   │ Largest              │
│                      │ Asia, Europe)        │                      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Mobile               │ Capacitor, NativeScript│ React Native       │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ TypeScript           │ Excellent (3.3+)     │ Excellent            │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ SSR/SSG              │ Nuxt 3 (excellent)   │ Next.js (excellent)  │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Bundle size          │ ~33KB (core+compiler)│ ~42KB (react+dom)    │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Best for             │ Progressive adoption,│ Complex SPAs, large  │
│                      │ simpler DX, rapid dev│ teams, mobile        │
└──────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Using Options API in new code** | Verbose, poor TypeScript support, harder to compose logic | Use `<script setup>` with Composition API exclusively |
| **Mutating props** | Vue warns, parent state desynced, unpredictable behavior | Emit events to parent, use defineModel for two-way binding |
| **v-if + v-for on same element** | Unexpected behavior, v-if evaluated before v-for | Use computed to filter list, or wrap v-for in `<template>` |
| **Using index as :key in v-for** | Items re-render incorrectly on insert/delete/reorder | Use unique ID from data: `:key="item.id"` |
| **Destructuring reactive()** | Variables lose reactivity, DOM doesn't update | Use `toRefs()` for destructuring, or use `ref()` instead |
| **Reassigning reactive()** | Entire proxy replaced, old references broken | Use `ref()` if you need to reassign the whole object |
| **Side effects in computed** | Unexpected behavior, timing issues, inconsistent state | Use `watch` or `watchEffect` for side effects |
| **watch instead of computed** | Over-complex watchers for derived values, extra state | Use `computed()` for derived values — it's cached and automatic |
| **Not using composables** | Duplicated logic across components, hard to test | Extract shared logic into composables (use* functions) |
| **Vuex in new projects** | Vuex is legacy, verbose boilerplate, poor TypeScript | Use Pinia — official Vue 3 state management |
| **Deep watchers on large objects** | Performance degradation, watching tracks all nested changes | Use `shallowRef` + manual trigger, or watch specific paths |
| **Not scoping styles** | Styles leak across components, unpredictable appearance | ALWAYS use `<style scoped>` or CSS Modules |
| **Direct DOM manipulation** | Breaks Vue's reactivity, conflicts with virtual DOM | Use template refs and reactive state, not `document.querySelector` |

---

## 11. Enforcement Checklist

### Project Setup
- [ ] Vue 3.5+ used for all new projects
- [ ] TypeScript enabled (`lang="ts"` in all `<script setup>`)
- [ ] Vite used as build tool (default with create-vue)
- [ ] ESLint with eslint-plugin-vue (vue/vue3-recommended ruleset)
- [ ] Nuxt 3 used when SSR/SSG is needed

### Component Standards
- [ ] ALL components use `<script setup>` with Composition API
- [ ] Props typed with `defineProps<{}>()` (TypeScript generics)
- [ ] Events typed with `defineEmits<{}>()` (TypeScript generics)
- [ ] Two-way binding uses `defineModel()` (Vue 3.4+)
- [ ] Components follow SFC order: script → template → style
- [ ] Styles are scoped or use CSS Modules

### Reactivity
- [ ] `ref()` used for primitives and reassignable values
- [ ] `reactive()` used only for objects mutated in place
- [ ] `computed()` used for ALL derived values (not watch + ref)
- [ ] Watchers have cleanup functions for async operations
- [ ] No `reactive()` destructuring without `toRefs()`

### State Management
- [ ] Pinia used for shared state (NOT Vuex)
- [ ] Setup store syntax used (Composition API style)
- [ ] Stores split by domain (auth, cart, UI)
- [ ] State persisted where needed (pinia-plugin-persistedstate)

### Data Fetching
- [ ] `useFetch` / `useAsyncData` used in Nuxt (SSR-aware)
- [ ] Loading and error states handled for all async data
- [ ] VueUse composables used for common utilities
