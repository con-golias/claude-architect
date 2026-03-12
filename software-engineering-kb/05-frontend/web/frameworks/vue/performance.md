# Vue Performance — Complete Specification

> **AI Plugin Directive:** When a developer asks "why is my Vue app slow?", "how to optimize Vue rendering?", "when to use shallowRef?", "how to reduce re-renders in Vue?", "Vue performance best practices?", or any Vue performance question, ALWAYS consult this directive. Vue's Proxy-based reactivity is already fine-grained — most performance issues come from unnecessary deep reactivity, large list rendering, or bundle size. Optimize by using shallowRef for large data, virtualizing lists, and lazy loading routes.

**Core Rule: Vue's reactivity system is ALREADY fine-grained — it tracks exact dependencies and updates ONLY what changed. Unlike React, Vue does NOT re-render entire component subtrees on state change. Performance issues in Vue typically come from: 1) Deep reactivity on large objects (use shallowRef), 2) Rendering thousands of list items (use virtual scrolling), 3) Large bundles (use code splitting and lazy loading). ALWAYS measure before optimizing — Vue is fast by default.**

---

## 1. Vue's Rendering Model

```
          VUE vs REACT RENDERING

  REACT:
  ┌──────────────────────────────────────────┐
  │ Parent state changes                     │
  │ → Parent re-renders (runs component fn)  │
  │ → ALL children re-render (by default)    │
  │ → Virtual DOM diff entire subtree        │
  │ → Patch DOM differences                  │
  │                                          │
  │ To prevent: React.memo, useMemo          │
  └──────────────────────────────────────────┘

  VUE:
  ┌──────────────────────────────────────────┐
  │ Reactive value changes                   │
  │ → Vue knows EXACTLY which components     │
  │   depend on this value (dependency track)│
  │ → ONLY those components re-render        │
  │ → Template compiler generates optimized  │
  │   render function (static nodes hoisted) │
  │ → Minimal DOM patches                    │
  │                                          │
  │ No manual memoization needed!            │
  └──────────────────────────────────────────┘

  KEY DIFFERENCE:
  Vue tracks dependencies at the VALUE level.
  React tracks at the COMPONENT level.
  Vue re-renders the component that USES the value.
  React re-renders the component AND all its children.
```

### 1.1 Template Compilation Optimizations

```
VUE TEMPLATE COMPILER OPTIMIZATIONS:

1. STATIC HOISTING:
   Template:  <div><h1>Title</h1><p>{{ message }}</p></div>
   Compiled:  const _hoisted = h('h1', 'Title')  ← Created ONCE
              render() {
                return h('div', [_hoisted, h('p', message.value)])
              }
   Static nodes are created once and reused across re-renders.

2. PATCH FLAGS:
   <div :class="cls" :id="id">{{ text }}</div>
   Compiled with patchFlag: TEXT | CLASS
   Vue knows ONLY text and class can change — skips id comparison.

3. TREE FLATTENING:
   Vue tracks dynamic nodes in a flat array.
   During updates, it only visits dynamic nodes — skips static subtrees.

4. CACHE EVENT HANDLERS:
   @click="handleClick" is cached automatically.
   No useCallback equivalent needed.
```

---

## 2. Reactivity Performance

### 2.1 shallowRef for Large Data

```typescript
import { shallowRef, triggerRef } from 'vue'

// ❌ PROBLEM: ref() makes entire object deeply reactive
const largeDataset = ref<DataRow[]>([]) // 10,000 rows — all deeply reactive!
// Vue wraps EVERY nested object in a Proxy — expensive for large arrays

// ✅ FIX: shallowRef — only tracks .value reassignment
const largeDataset = shallowRef<DataRow[]>([])

// Update by replacing the array (not mutating)
function addRow(row: DataRow) {
  largeDataset.value = [...largeDataset.value, row] // ✅ Tracked
}

// Batch update (efficient — one trigger)
function loadData(rows: DataRow[]) {
  largeDataset.value = rows // ✅ Single update
}

// If you MUST mutate in place (rare):
largeDataset.value.push(row) // ❌ Not tracked by shallowRef
triggerRef(largeDataset)      // ✅ Manually trigger reactivity

// RULE: Use shallowRef when:
// - Array has 1000+ items
// - Objects have deep nesting you don't need to track
// - Data comes from external source (API, WebSocket)
// - Third-party objects (chart data, map features)
```

### 2.2 markRaw for Non-Reactive Data

```typescript
import { reactive, markRaw } from 'vue'

// ❌ PROBLEM: Third-party objects made reactive unnecessarily
const state = reactive({
  map: new google.maps.Map(element, config), // Vue wraps in Proxy!
  chart: new Chart(canvas, chartConfig),     // Proxy breaks Chart.js!
})

// ✅ FIX: markRaw prevents reactivity
const state = reactive({
  map: markRaw(new google.maps.Map(element, config)),
  chart: markRaw(new Chart(canvas, chartConfig)),
})

// Also useful for large static data
const COUNTRIES = markRaw([
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  // ... 200 more
])
```

### 2.3 Computed Caching

```typescript
// computed() values are CACHED — only recalculate when dependencies change

// ✅ EFFICIENT: Computed with heavy filter/sort
const sortedAndFilteredItems = computed(() => {
  // This runs ONLY when items or filter changes
  // Accessing it 100 times returns the cached result
  return items.value
    .filter(item => item.category === filter.value)
    .sort((a, b) => a.name.localeCompare(b.name))
})

// ❌ INEFFICIENT: Function in template (runs EVERY render)
// In template: {{ getFilteredItems() }} ← Calls on every render!
function getFilteredItems() {
  return items.value
    .filter(item => item.category === filter.value)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// RULE: ALWAYS use computed() over methods for derived values in templates
```

---

## 3. List Performance

### 3.1 v-for Optimization

```vue
<template>
  <!-- ✅ ALWAYS use :key with unique ID -->
  <div v-for="item in items" :key="item.id">
    {{ item.name }}
  </div>

  <!-- ❌ NEVER use index as key for dynamic lists -->
  <div v-for="(item, index) in items" :key="index">
    <!-- Breaks on insert/delete/reorder -->
  </div>

  <!-- ✅ Use computed to filter (NOT v-if with v-for) -->
  <div v-for="item in activeItems" :key="item.id">
    {{ item.name }}
  </div>
</template>

<script setup lang="ts">
const activeItems = computed(() =>
  items.value.filter(item => item.isActive)
)
</script>
```

### 3.2 Virtual Scrolling

```vue
<template>
  <!-- Vue Virtual Scroller for large lists -->
  <RecycleScroller
    class="scroller"
    :items="items"
    :item-size="50"
    key-field="id"
    v-slot="{ item }"
  >
    <div class="item">{{ item.name }}</div>
  </RecycleScroller>
</template>

<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

// Alternative: @tanstack/vue-virtual
import { useVirtualizer } from '@tanstack/vue-virtual'

const parentRef = ref<HTMLElement | null>(null)

const virtualizer = useVirtualizer({
  count: items.value.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 50,
  overscan: 5,
})
</script>

<!--
DECISION:
< 100 items    → No virtualization needed
100-1000 items → Consider if items are complex
1000+ items    → ALWAYS virtualize
-->
```

---

## 4. Component-Level Optimization

### 4.1 v-once and v-memo

```vue
<template>
  <!-- v-once: Render ONCE, never update (static content) -->
  <footer v-once>
    <p>© 2024 Company Name. All rights reserved.</p>
    <nav><!-- static links --></nav>
  </footer>

  <!-- v-memo: Skip re-render unless specified values change -->
  <!-- Useful for large lists where most items don't change -->
  <div v-for="item in items" :key="item.id" v-memo="[item.id === selectedId]">
    <!-- Only re-renders when selection state changes for THIS item -->
    <span :class="{ selected: item.id === selectedId }">
      {{ item.name }}
    </span>
  </div>
</template>

<!-- v-memo RULES:
  - Use only when you've measured a performance problem
  - v-memo="[]" = same as v-once (never re-renders)
  - Compare against actual profiling data
  - Most cases don't need v-memo — Vue's reactivity is already optimized
-->
```

### 4.2 KeepAlive

```vue
<template>
  <!-- KeepAlive caches component instances instead of destroying them -->
  <KeepAlive :max="10">
    <component :is="currentView" />
  </KeepAlive>

  <!-- With include/exclude -->
  <KeepAlive :include="['Dashboard', 'Settings']" :exclude="['LoginForm']">
    <router-view />
  </KeepAlive>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated } from 'vue'

// Lifecycle hooks for KeepAlive
onActivated(() => {
  // Component became visible (was cached, now active)
  fetchLatestData()
})

onDeactivated(() => {
  // Component hidden (still in cache, not destroyed)
  pauseTimer()
})

// USE WHEN:
// - Tab-based navigation where tabs should preserve state
// - Form wizard where going back should keep values
// - Dashboard tabs that are expensive to re-render
// - :max limits cache size to prevent memory bloat
</script>
```

### 4.3 Async Components

```typescript
import { defineAsyncComponent } from 'vue'

// LAZY LOAD heavy components
const HeavyChart = defineAsyncComponent(() => import('./HeavyChart.vue'))
const PdfViewer = defineAsyncComponent(() => import('./PdfViewer.vue'))
const RichTextEditor = defineAsyncComponent(() => import('./RichTextEditor.vue'))

// With loading/error handling
const AdminPanel = defineAsyncComponent({
  loader: () => import('./AdminPanel.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorDisplay,
  delay: 200,      // Don't show loading for first 200ms
  timeout: 10000,  // Show error after 10s
})

// ROUTE-LEVEL lazy loading (Vue Router)
const routes = [
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue'), // Lazy loaded
  },
  {
    path: '/settings',
    component: () => import('./views/Settings.vue'),
  },
]
```

---

## 5. Bundle Size

```
BUNDLE SIZE STRATEGIES:

1. ROUTE-LEVEL CODE SPLITTING (automatic with Vue Router lazy routes)
   component: () => import('./views/Page.vue')

2. COMPONENT-LEVEL SPLITTING
   defineAsyncComponent(() => import('./HeavyComponent.vue'))

3. TREE SHAKING
   // ✅ Named imports (tree-shakeable)
   import { format } from 'date-fns'

   // ❌ Default import (may pull everything)
   import _ from 'lodash'
   // ✅ Specific import
   import debounce from 'lodash/debounce'

4. ANALYZE BUNDLE
   # Vite
   npx vite-bundle-visualizer

   # Webpack (vue-cli)
   vue-cli-service build --report

5. VUE-SPECIFIC:
   - Use Composition API (tree-shakeable — unused features not bundled)
   - Options API always bundles everything
   - Vue 3 core: ~33KB gzipped
   - With Composition API, unused lifecycle hooks are tree-shaken
```

---

## 6. SSR Performance (Nuxt)

```typescript
// Nuxt SSR optimization patterns

// 1. PAYLOAD OPTIMIZATION — reduce data sent to client
export default defineEventHandler(async () => {
  const users = await db.user.findMany({
    select: { id: true, name: true, avatar: true }, // Only needed fields
    // ❌ Don't select ALL columns when template only needs 3
  })
  return users
})

// 2. CACHING with Nuxt
const { data } = await useFetch('/api/products', {
  // Cache response for 1 hour
  headers: { 'Cache-Control': 'max-age=3600' },
})

// Route rules for hybrid rendering
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },           // SSG — build time
    '/blog/**': { isr: 3600 },          // ISR — revalidate hourly
    '/dashboard/**': { ssr: false },     // SPA — no SSR
    '/api/**': { cors: true },           // API — CORS enabled
  },
})

// 3. COMPONENT ISLANDS (experimental)
// Heavy interactive component rendered on client only
<ClientOnly>
  <HeavyInteractiveWidget />
  <template #fallback>
    <WidgetSkeleton />
  </template>
</ClientOnly>
```

---

## 7. Profiling Vue Applications

```
VUE DEVTOOLS PROFILING:

1. Install Vue DevTools browser extension
2. Open Components tab → inspect component tree
3. Open Performance tab → record interaction
4. Analyze:
   - Component render times
   - Event timeline
   - Reactive dependency graph

CHROME DEVTOOLS:
1. Performance tab → Record
2. Perform slow interaction
3. Look for:
   - Long tasks (>50ms)
   - Excessive layout/paint
   - JavaScript execution time

PROGRAMMATIC MEASUREMENT:
  // app.config.performance = true (development only)
  // Enables component init, compile, render, and patch timing
  // Visible in Chrome DevTools Performance tab as User Timing marks

VUE-SPECIFIC PROFILING:
  - Check watcher count (excessive watchers = slow)
  - Check reactive object depth (deeply nested = slow)
  - Check template complexity (complex expressions = slow)
  - Use shallowRef/markRaw to reduce tracked objects
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Deep reactivity on large arrays** | Slow mount, sluggish updates with 1000+ items | Use `shallowRef()` + immutable update pattern |
| **v-if + v-for on same element** | Unexpected behavior, performance waste | Use computed to pre-filter, or wrap in `<template v-for>` |
| **Function calls in templates** | Runs every render, not cached, wasteful | Use `computed()` — results are cached |
| **Missing :key in v-for** | Vue warns, incorrect DOM reuse, subtle bugs | ALWAYS provide unique `:key` from data |
| **Index as :key for dynamic lists** | Incorrect DOM reuse on insert/delete/reorder | Use unique ID: `:key="item.id"` |
| **Watching entire reactive object deeply** | Performance hit, unnecessary re-evaluation | Watch specific paths with getter function |
| **Not lazy loading routes** | Entire app in initial bundle, slow first load | Use `() => import()` for route components |
| **Not using KeepAlive for tabs** | Tab components destroyed/recreated, state lost, expensive | Wrap with `<KeepAlive>` for tab navigation |
| **Excessive watchers** | Slow reactivity system, debugging difficulty | Consolidate watchers, use computed where possible |
| **Not analyzing bundle** | Hidden large dependencies, unnecessary code shipped | Run vite-bundle-visualizer regularly |
| **Making third-party objects reactive** | Proxy breaks external APIs (maps, charts, workers) | Use `markRaw()` for non-reactive data |
| **Inline styles/objects in templates** | New object every render (less impactful than React but still wasteful) | Extract to computed or static constants |

---

## 9. Enforcement Checklist

### Reactivity
- [ ] `shallowRef()` used for arrays/objects with 1000+ items
- [ ] `markRaw()` used for third-party objects (maps, charts, heavy data)
- [ ] `computed()` used for ALL derived values in templates (never methods)
- [ ] No unnecessary `deep: true` on watchers
- [ ] Reactive scope understood — no accidental deep tracking

### Lists
- [ ] ALL v-for loops have unique `:key` from data (not index)
- [ ] Lists with 100+ items use virtual scrolling
- [ ] Pre-filtering done in computed (not v-if + v-for together)
- [ ] `v-memo` considered for very large lists with selection state

### Code Splitting
- [ ] All routes lazy loaded: `component: () => import(...)`
- [ ] Heavy components use `defineAsyncComponent()`
- [ ] Bundle analyzed with vite-bundle-visualizer
- [ ] Tree-shakeable imports used (named imports, not default)

### SSR (Nuxt)
- [ ] Route rules configured per page type (SSG, ISR, SPA)
- [ ] `<ClientOnly>` used for browser-only interactive widgets
- [ ] API responses return only needed fields (no over-fetching)
- [ ] `useFetch`/`useAsyncData` used (not raw fetch in components)

### Measurement
- [ ] Vue DevTools Profiler used to identify bottlenecks
- [ ] Performance measured BEFORE and AFTER optimization
- [ ] No premature optimization — Vue is fast by default
- [ ] Web Vitals monitored in production (LCP, CLS, INP)
