# Vue Composition API — Complete Specification

> **AI Plugin Directive:** When a developer asks "how does Composition API work?", "explain ref vs reactive", "how to use watch vs computed", "how to create composables?", "what are Vue lifecycle hooks?", "how to use provide/inject?", or any Composition API pattern question, ALWAYS consult this directive. Apply `<script setup>` with typed defineProps/defineEmits, use `ref()` for primitives, `computed()` for derived values, and composables for shared logic. NEVER use the Options API for new code.

**Core Rule: The Composition API organizes code by LOGICAL CONCERN, not by option type. Group related state, computed values, watchers, and functions together. Use `ref()` for reactive primitives, `computed()` for derived values, `watch()`/`watchEffect()` for side effects. Extract reusable logic into composables. NEVER mix Options API and Composition API in the same component. ALWAYS use `<script setup>` — it is the standard syntax.**

---

## 1. Composition API vs Options API

```
OPTIONS API (LEGACY):                COMPOSITION API (STANDARD):
┌─────────────────────────┐          ┌─────────────────────────┐
│ export default {        │          │ <script setup>          │
│   data() {              │          │                         │
│     return {            │          │ // Feature A            │
│       countA: 0,        │          │ const countA = ref(0)   │
│       countB: 0,        │          │ const doubleA = computed│
│       query: ''         │ ──────▶  │ function incrementA()   │
│     }                   │          │                         │
│   },                    │          │ // Feature B            │
│   computed: {           │          │ const countB = ref(0)   │
│     doubleA() {...},    │          │ function incrementB()   │
│     results() {...}     │          │                         │
│   },                    │          │ // Feature C            │
│   methods: {            │          │ const query = ref('')   │
│     incrementA() {...}, │          │ const results = computed│
│     incrementB() {...}, │          │ watchEffect(() => ...)  │
│     search() {...}      │          │                         │
│   },                    │          └─────────────────────────┘
│   watch: {...}          │
│ }                       │          Code grouped by FEATURE
│                         │          not by option type
│ Code split across       │
│ data/computed/methods   │
└─────────────────────────┘
```

---

## 2. Reactivity Primitives Deep Dive

### 2.1 ref() — The Universal Reactive Container

```typescript
import { ref, isRef, unref, toRef, toRefs, toValue, triggerRef } from 'vue'

// PRIMITIVE VALUES
const count = ref(0)
const name = ref('Alice')
const isActive = ref(true)

// Access: .value in script, auto-unwrapped in template
count.value++
console.log(count.value) // 1

// OBJECT VALUES (deep reactivity by default)
const user = ref<User>({
  name: 'Alice',
  address: {
    city: 'Athens',
    zip: '10431',
  },
})

// Deep mutation is tracked
user.value.address.city = 'Thessaloniki' // ✅ Tracked — DOM updates

// Reassignment is tracked
user.value = { name: 'Bob', address: { city: 'London', zip: 'SW1' } } // ✅ Tracked

// TYPE ANNOTATIONS
const items = ref<Item[]>([])
const selected = ref<Item | null>(null)
const count = ref<number>(0)

// UTILITIES
isRef(count)        // true — type guard
unref(count)        // 0 — unwrap if ref, return as-is if not
toValue(count)      // 0 — same as unref but also handles getter functions

// toRef — Create a ref linked to a reactive object's property
const state = reactive({ count: 0 })
const countRef = toRef(state, 'count')
// countRef.value stays in sync with state.count

// toRefs — Convert all properties to refs
const { count, name } = toRefs(reactive({ count: 0, name: 'Alice' }))
// Each is a ref linked to the original

// triggerRef — Force trigger update on shallowRef
const shallow = shallowRef({ items: [] })
shallow.value.items.push('new') // NOT tracked with shallowRef
triggerRef(shallow) // Force update notification
```

### 2.2 reactive() — Proxy-Based Reactivity

```typescript
import { reactive, isReactive, markRaw, toRaw } from 'vue'

// BASIC USAGE
const form = reactive({
  username: '',
  email: '',
  password: '',
  errors: {} as Record<string, string>,
})

// Direct mutation — tracked by Proxy
form.username = 'alice'
form.errors.username = 'Required'

// ARRAY REACTIVITY
const state = reactive({
  items: ['a', 'b', 'c'],
})

// All array methods are tracked
state.items.push('d')       // ✅ Tracked
state.items.splice(0, 1)    // ✅ Tracked
state.items[0] = 'z'        // ✅ Tracked (Vue 3 — not possible in Vue 2)

// MAP and SET reactivity
const state = reactive({
  map: new Map<string, User>(),
  set: new Set<string>(),
})
state.map.set('key', user)  // ✅ Tracked
state.set.add('value')      // ✅ Tracked

// markRaw — Exclude from reactivity (performance optimization)
const heavyObj = markRaw(createVeryLargeObject())
const state = reactive({ heavy: heavyObj })
// heavyObj will NOT be made reactive — no Proxy overhead

// toRaw — Get the original object from a reactive proxy
const raw = toRaw(state) // Original object, bypassing Proxy

// LIMITATIONS:
// ❌ Cannot reassign the entire reactive object
let state = reactive({ count: 0 })
state = reactive({ count: 1 }) // BREAKS — variable reassigned, old proxy lost

// ❌ Cannot destructure without losing reactivity
const { count } = reactive({ count: 0 }) // count is plain number now

// ❌ Cannot use with primitives
const count = reactive(0) // ERROR — reactive() requires object/array/Map/Set
```

### 2.3 shallowRef() and shallowReactive()

```typescript
import { shallowRef, shallowReactive, triggerRef } from 'vue'

// shallowRef — Only tracks .value reassignment
const items = shallowRef<Item[]>([])

items.value.push(newItem)                    // ❌ NOT tracked (deep mutation)
items.value = [...items.value, newItem]      // ✅ Tracked (.value reassigned)

// USE WHEN:
// - Large arrays/objects where deep tracking is expensive
// - Third-party objects you don't want to make reactive
// - Performance-critical code where you control updates

// Force trigger after deep mutation
items.value.push(newItem)
triggerRef(items) // Manually trigger reactivity update

// shallowReactive — Only tracks top-level properties
const state = shallowReactive({
  count: 0,
  nested: { deep: true },
})

state.count++               // ✅ Tracked (top-level)
state.nested.deep = false   // ❌ NOT tracked (nested)
state.nested = { deep: false } // ✅ Tracked (top-level reassignment)
```

---

## 3. Computed Properties Deep Dive

```typescript
import { ref, computed } from 'vue'

const items = ref<Todo[]>([
  { id: '1', text: 'Learn Vue', completed: true },
  { id: '2', text: 'Build app', completed: false },
])
const filter = ref<'all' | 'active' | 'completed'>('all')
const searchQuery = ref('')

// CHAINED COMPUTED — each depends on the previous
const filteredByStatus = computed(() => {
  switch (filter.value) {
    case 'active': return items.value.filter(i => !i.completed)
    case 'completed': return items.value.filter(i => i.completed)
    default: return items.value
  }
})

const filteredBySearch = computed(() => {
  if (!searchQuery.value) return filteredByStatus.value
  const query = searchQuery.value.toLowerCase()
  return filteredByStatus.value.filter(i =>
    i.text.toLowerCase().includes(query)
  )
})

const stats = computed(() => ({
  total: items.value.length,
  completed: items.value.filter(i => i.completed).length,
  active: items.value.filter(i => !i.completed).length,
  showing: filteredBySearch.value.length,
}))

// CACHING BEHAVIOR:
// computed values are CACHED — they only re-evaluate when dependencies change
// Accessing filteredBySearch.value 100 times runs the filter function ONCE
// (unless items or searchQuery changed since last access)

// WRITABLE COMPUTED (rare use case)
const firstName = ref('John')
const lastName = ref('Doe')

const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (newValue: string) => {
    const parts = newValue.split(' ')
    firstName.value = parts[0]
    lastName.value = parts.slice(1).join(' ')
  },
})

fullName.value = 'Jane Smith' // Sets firstName='Jane', lastName='Smith'

// RULES:
// ✅ computed for ANY derived value — it's cached and dependency-tracked
// ❌ NEVER put side effects in computed (API calls, DOM manipulation, console.log)
// ❌ NEVER use watch + ref for derived values — use computed instead
// ✅ Computed getters should be pure functions (no mutations)
```

---

## 4. Watchers Deep Dive

```typescript
import { ref, watch, watchEffect, watchPostEffect, watchSyncEffect } from 'vue'

// ── watch() — Explicit sources ──

// Watch a single ref
const userId = ref('123')
watch(userId, (newId, oldId) => {
  console.log(`Changed: ${oldId} → ${newId}`)
  // Fetch new user data
})

// Watch a getter function
watch(
  () => props.modelValue,
  (newVal) => { /* ... */ }
)

// Watch multiple sources
watch(
  [firstName, lastName],
  ([newFirst, newLast], [oldFirst, oldLast]) => {
    // Both values available
  }
)

// Watch with options
watch(source, callback, {
  immediate: true,   // Run callback immediately with current value
  deep: true,        // Watch nested object changes (performance cost!)
  once: true,        // Run callback only once, then stop (Vue 3.4+)
  flush: 'post',     // Run after DOM update (default: 'pre')
})

// Watch deep reactive object (specific property)
const state = reactive({ user: { name: 'Alice', age: 30 } })

// ✅ Watch specific property with getter
watch(
  () => state.user.name,
  (newName) => { console.log(`Name: ${newName}`) }
)

// ❌ AVOID: deep: true on large objects
watch(state, () => { /* ... */ }, { deep: true }) // Expensive!

// ── watchEffect() — Auto-tracking ──

// Automatically tracks ALL reactive dependencies accessed inside
watchEffect(() => {
  // Tracks userId.value AND filter.value automatically
  console.log(`User ${userId.value}, filter: ${filter.value}`)
})

// With cleanup
watchEffect((onCleanup) => {
  const controller = new AbortController()

  fetchData(userId.value, { signal: controller.signal })
    .then(data => { result.value = data })

  onCleanup(() => {
    controller.abort() // Cancel if userId changes or component unmounts
  })
})

// ── Flush timing ──

// 'pre' (default) — runs before DOM update
watch(source, callback) // Same as flush: 'pre'

// 'post' — runs after DOM update
watch(source, callback, { flush: 'post' })
watchPostEffect(() => {
  // DOM is updated — safe to read DOM measurements
})

// 'sync' — runs synchronously (AVOID unless necessary)
watchSyncEffect(() => {
  // Runs immediately when dependency changes — can cause performance issues
})

// ── Stopping watchers ──

// Watchers created in setup() are auto-stopped on component unmount
// For manual control:
const stop = watchEffect(() => { /* ... */ })
stop() // Manually stop watching

// DECISION TREE:
// Need old + new value?              → watch()
// Need explicit dependency list?     → watch()
// Need immediate with old value?     → watch() + immediate
// Simple side effect on change?      → watchEffect()
// Need DOM to be updated first?      → watchPostEffect() or flush: 'post'
// Derived value (no side effects)?   → computed() (NOT watch)
```

---

## 5. Lifecycle Hooks

```
VUE COMPONENT LIFECYCLE:

  ┌─────────────────┐
  │   Component      │
  │   Created        │
  │   (setup runs)   │ ← <script setup> executes HERE
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ onBeforeMount   │ ← Before first DOM insertion
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ onMounted       │ ← DOM is available, safe to access refs
  └────────┬────────┘
           │
      ┌────▼────┐
      │  Loop:  │
      │ ┌───────────────┐
      │ │onBeforeUpdate │ ← Before reactive change re-renders
      │ └───────┬───────┘
      │ ┌───────▼───────┐
      │ │ onUpdated     │ ← After DOM re-render
      │ └───────────────┘
      └─────────┘
           │
  ┌────────▼────────┐
  │ onBeforeUnmount │ ← Before removal from DOM
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ onUnmounted     │ ← Component removed, cleanup done
  └─────────────────┘

  ADDITIONAL:
  onActivated   ← Component activated (inside <KeepAlive>)
  onDeactivated ← Component deactivated (inside <KeepAlive>)
  onErrorCaptured ← Error from descendant component
```

```typescript
import {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onErrorCaptured,
} from 'vue'

// onMounted — MOST COMMON: DOM is available
onMounted(() => {
  // Safe to access template refs
  console.log(containerRef.value?.offsetHeight)

  // Initialize third-party libraries
  chart = new Chart(canvasRef.value!, config)

  // Add event listeners
  window.addEventListener('resize', handleResize)
})

// onUnmounted — CLEANUP (like React useEffect cleanup)
onUnmounted(() => {
  chart?.destroy()
  window.removeEventListener('resize', handleResize)
})

// onErrorCaptured — Error boundary equivalent
onErrorCaptured((error, instance, info) => {
  reportError(error, info)
  return false // Prevent error from propagating further
})

// RULES:
// - onMounted: Access DOM, initialize libs, add listeners
// - onUnmounted: Cleanup libs, remove listeners, cancel timers
// - PREFER watchEffect cleanup over lifecycle hooks for reactive cleanup
// - setup() runs BEFORE onBeforeMount — most setup code goes here
// - AVOID onBeforeUpdate/onUpdated — use watch/watchEffect instead
```

---

## 6. Template Refs

```typescript
import { ref, useTemplateRef, onMounted } from 'vue'

// Vue 3.5+: useTemplateRef (RECOMMENDED)
const inputEl = useTemplateRef<HTMLInputElement>('input')
// <input ref="input" />

onMounted(() => {
  inputEl.value?.focus()
})

// Vue 3.0-3.4: ref with same name as template ref
const inputEl = ref<HTMLInputElement | null>(null)
// <input ref="inputEl" />  ← name must match variable name

// Component refs
const childRef = useTemplateRef<InstanceType<typeof ChildComponent>>('child')

// In ChildComponent.vue:
defineExpose({
  focus: () => inputRef.value?.focus(),
  getValue: () => inputRef.value?.value,
})

// Parent can call:
childRef.value?.focus()

// Dynamic ref in v-for
const itemRefs = ref<HTMLElement[]>([])
// <div v-for="item in items" :ref="el => { if (el) itemRefs.push(el as HTMLElement) }">

// RULES:
// - Template refs are null until onMounted
// - Use useTemplateRef() in Vue 3.5+ (type-safe, explicit)
// - defineExpose() to control what parent can access
// - AVOID using template refs for things reactivity can handle
```

---

## 7. Advanced Composable Patterns

```typescript
// PATTERN 1: Composable with options
interface UseCounterOptions {
  min?: number
  max?: number
  step?: number
}

function useCounter(initial = 0, options: UseCounterOptions = {}) {
  const { min = -Infinity, max = Infinity, step = 1 } = options
  const count = ref(initial)

  const increment = () => {
    count.value = Math.min(count.value + step, max)
  }
  const decrement = () => {
    count.value = Math.max(count.value - step, min)
  }
  const reset = () => { count.value = initial }

  const isAtMin = computed(() => count.value <= min)
  const isAtMax = computed(() => count.value >= max)

  return { count, increment, decrement, reset, isAtMin, isAtMax }
}

// PATTERN 2: Composable accepting ref OR value (MaybeRefOrGetter)
import { toValue, type MaybeRefOrGetter } from 'vue'

function useTitle(title: MaybeRefOrGetter<string>) {
  watchEffect(() => {
    document.title = toValue(title) // Works with ref, getter, or plain string
  })
}

// All of these work:
useTitle('Static Title')
useTitle(ref('Reactive Title'))
useTitle(() => `Page ${page.value}`)

// PATTERN 3: Composable with lifecycle
function useEventListener<K extends keyof WindowEventMap>(
  target: Window | HTMLElement,
  event: K,
  handler: (e: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions
) {
  onMounted(() => {
    target.addEventListener(event, handler as EventListener, options)
  })
  onUnmounted(() => {
    target.removeEventListener(event, handler as EventListener, options)
  })
}

// PATTERN 4: Async composable with SSR awareness
function useAsyncState<T>(
  promise: () => Promise<T>,
  initialState: T,
  options: { immediate?: boolean } = {}
) {
  const state = ref<T>(initialState) as Ref<T>
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  async function execute() {
    isLoading.value = true
    error.value = null
    try {
      state.value = await promise()
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  if (options.immediate !== false) {
    execute()
  }

  return { state, isLoading, error, execute }
}

// COMPOSABLE RULES:
// 1. Name with use* prefix (useCounter, useFetch, useAuth)
// 2. Accept MaybeRefOrGetter for flexible input
// 3. Return refs and functions (not reactive objects)
// 4. Handle cleanup with onUnmounted or watchEffect cleanup
// 5. Keep composables focused (single responsibility)
// 6. Composables can use other composables
// 7. Place in composables/ directory
// 8. Use VueUse for standard utilities — don't reinvent
```

---

## 8. Async Components and Suspense

```vue
<!-- Async Component Definition -->
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const HeavyChart = defineAsyncComponent({
  loader: () => import('./HeavyChart.vue'),
  loadingComponent: ChartSkeleton,
  errorComponent: ChartError,
  delay: 200,     // Show loading after 200ms (avoids flash)
  timeout: 10000, // Error after 10 seconds
})
</script>

<!-- Suspense — Vue's built-in async boundary -->
<template>
  <Suspense>
    <template #default>
      <AsyncDashboard />  <!-- Component with async setup -->
    </template>
    <template #fallback>
      <DashboardSkeleton />
    </template>
  </Suspense>
</template>

<!-- Async Setup (component with top-level await) -->
<!-- AsyncDashboard.vue -->
<script setup lang="ts">
// Top-level await makes component async — needs Suspense
const data = await fetchDashboardData()
const stats = await fetchStats()
</script>

<template>
  <div>
    <MetricsGrid :data="data" />
    <StatsChart :stats="stats" />
  </div>
</template>

<!-- Suspense Events -->
<Suspense @pending="onPending" @resolve="onResolve" @fallback="onFallback">
  <AsyncContent />
</Suspense>
```

---

## 9. Custom Directives

```typescript
// Custom directives — for low-level DOM manipulation

// Directive definition
const vFocus: Directive = {
  mounted(el: HTMLElement) {
    el.focus()
  },
}

// Shorthand: function form (runs on mounted + updated)
const vHighlight: Directive<HTMLElement, string> = (el, binding) => {
  el.style.backgroundColor = binding.value || 'yellow'
}

// Usage in template:
// <input v-focus />
// <p v-highlight="'lightblue'">Highlighted</p>

// Directive with modifiers and arguments
const vTooltip: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    // binding.value = tooltip text
    // binding.arg = position (v-tooltip:top="text")
    // binding.modifiers = { dark: true } (v-tooltip.dark="text")

    const position = binding.arg || 'top'
    const isDark = binding.modifiers.dark

    createTooltip(el, {
      text: binding.value,
      position,
      theme: isDark ? 'dark' : 'light',
    })
  },
  unmounted(el) {
    destroyTooltip(el)
  },
}
// <button v-tooltip:bottom.dark="'Click to save'">Save</button>

// RULES:
// - Use directives ONLY for low-level DOM manipulation
// - PREFER composables for logic (directives are harder to debug)
// - Register globally in app.directive() or locally in <script setup>
// - ALWAYS clean up in unmounted hook
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Options API in new code** | Verbose, poor TypeScript, logic scattered by option type | Use `<script setup>` with Composition API |
| **watch for derived state** | Extra state, sync bugs, complex watch chains | Use `computed()` — it's cached and auto-tracked |
| **Destructuring reactive()** | Variables lose reactivity, DOM doesn't update | Use `toRefs()` or switch to `ref()` |
| **Deep watching large objects** | Performance degradation, unnecessary re-computation | Watch specific paths with getter, use `shallowRef` |
| **Side effects in computed** | Unpredictable timing, broken caching, hard to debug | Move side effects to `watch()` or `watchEffect()` |
| **Not cleaning up effects** | Memory leaks, stale subscriptions, zombie listeners | Use `watchEffect` cleanup or `onUnmounted` |
| **Reactive for primitives** | `reactive(0)` doesn't work, confusion about API | Use `ref()` for primitives — reactive requires objects |
| **Not using composables** | Duplicated logic, untestable, God components | Extract reusable logic into composables |
| **Direct DOM manipulation** | Breaks Vue reactivity, conflicts with rendering | Use template refs and reactive state |
| **Reassigning reactive variables** | Lost reactivity, proxy replaced, old references broken | Use `ref()` if you need to reassign the whole object |
| **Missing watchEffect cleanup** | Race conditions, memory leaks in async operations | ALWAYS return cleanup function for async/subscriptions |
| **Not using defineModel** | Verbose v-model implementation with prop + emit | Use `defineModel()` for clean two-way binding (Vue 3.4+) |

---

## 11. Enforcement Checklist

### Composition API Standards
- [ ] ALL components use `<script setup lang="ts">`
- [ ] NO Options API used in new components
- [ ] Props defined with `defineProps<{}>()` (TypeScript generics)
- [ ] Emits defined with `defineEmits<{}>()` (TypeScript generics)
- [ ] Two-way binding uses `defineModel()` (Vue 3.4+)

### Reactivity
- [ ] `ref()` used for primitives and reassignable values
- [ ] `reactive()` used only for objects mutated in place (form state)
- [ ] `computed()` used for ALL derived values
- [ ] No side effects in computed getters
- [ ] `shallowRef()` used for large objects/arrays where deep tracking is unnecessary

### Watchers
- [ ] `watch()` used when old/new values are needed
- [ ] `watchEffect()` used for simple auto-tracked side effects
- [ ] ALL async watchers have cleanup functions (AbortController)
- [ ] No `watch` used where `computed` would suffice
- [ ] `deep: true` avoided on large objects — use getter for specific paths

### Composables
- [ ] Shared logic extracted into composables (use* naming)
- [ ] Composables accept `MaybeRefOrGetter` for flexibility
- [ ] Composables return refs and functions (not reactive objects)
- [ ] VueUse consulted before writing custom composables
- [ ] Composables handle cleanup (onUnmounted, watchEffect cleanup)

### Component Patterns
- [ ] Props are never mutated (emit events instead)
- [ ] `defineExpose()` used to control exposed component API
- [ ] Template refs accessed only after `onMounted`
- [ ] Async components use `defineAsyncComponent` or `Suspense`
- [ ] Provide/inject uses typed `InjectionKey` for type safety
