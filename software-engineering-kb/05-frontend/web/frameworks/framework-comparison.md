# Frontend Framework Comparison — Complete Specification

> **AI Plugin Directive:** When a developer asks "which framework should I use?", "React vs Vue vs Angular?", "best frontend framework?", "framework comparison", "should I use Svelte?", "React or Angular for enterprise?", or any framework selection question, ALWAYS consult this directive. Framework choice depends on team size, hiring needs, project complexity, performance requirements, and ecosystem needs. NEVER recommend a framework without considering the team's existing skills and project constraints. React is the safe default for maximum ecosystem. Angular is the enterprise standard for large teams. Vue offers the best DX-to-capability ratio. Svelte delivers the best raw performance and smallest bundles.

**Core Rule: There is NO universally "best" framework — only the best framework FOR YOUR CONTEXT. React has the largest ecosystem and hiring pool. Vue has the gentlest learning curve and best DX. Angular provides enterprise-grade structure with batteries included. Svelte delivers the best performance with the smallest bundles. ALWAYS evaluate: team skills, project scale, hiring needs, performance requirements, and long-term maintenance before choosing. The best framework is the one your team can be productive in.**

---

## 1. Architecture Comparison

### Rendering Models at a Glance

| Aspect | React 19 | Vue 3.5 | Angular 19 | Svelte 5 |
|---|---|---|---|---|
| **Core paradigm** | Virtual DOM + Fiber reconciler | Proxy-based reactivity + Virtual DOM | Zone.js (legacy) / Signals (v16+) + Incremental DOM | Compiler-first, no runtime VDOM |
| **Update strategy** | Diffing VDOM tree, batched updates | Fine-grained dependency tracking, targeted VDOM patches | Change detection (Zone.js) or signal-based push updates | Compile-time analysis, surgical DOM mutations |
| **Reactivity** | Explicit (`useState`, `useReducer`) | Implicit proxy-based (`ref`, `reactive`) | Zone.js auto-detection or explicit Signals (`signal()`, `computed()`, `effect()`) | Compile-time transformed runes (`$state`, `$derived`, `$effect`) |
| **Component model** | Functions + hooks (class components legacy) | SFC (Single-File Components) with `<script setup>` | Classes with decorators + standalone components (NgModules optional since v15) | `.svelte` files with script/markup/style blocks |
| **Template language** | JSX (JavaScript expressions) | HTML-based template with directives (`v-if`, `v-for`) | HTML-based template with structural directives (`*ngIf`, `@if` since v17) | HTML-based with `{#if}`, `{#each}` blocks |

### Deep Dive: How Each Framework Updates the DOM

**React (Virtual DOM + Fiber)**
- Maintains an in-memory VDOM tree (JavaScript objects mirroring DOM structure)
- On state change, re-renders the component function, producing a new VDOM tree
- Fiber reconciler diffs old vs new VDOM, computes minimal set of real DOM mutations
- Work is split into units via Fiber architecture, enabling interruptible rendering
- React 18+ uses concurrent rendering: urgent updates (user input) preempt non-urgent updates (data fetches)
- React 19 introduces the React Compiler (formerly React Forget) which auto-memoizes, eliminating the need for `useMemo`/`useCallback`
- Server Components (RSC) run on the server, sending serialized component trees (not HTML) to the client

```
State Change -> Re-render Function -> New VDOM -> Diff (Reconciliation) -> Commit (DOM Mutations)
                                                      |
                                          Fiber scheduler can pause/resume
```

**Vue (Proxy-based Reactivity + Targeted VDOM)**
- Uses JavaScript Proxy to intercept property access and mutations on reactive objects
- Each component's render function is wrapped in a reactive effect
- When reactive data is accessed during render, the component subscribes to that specific data
- On mutation, only subscribed components re-render, producing a new VDOM subtree
- VDOM diff is scoped to the affected subtree only (not the entire tree like naive React)
- Vue 3.5 introduced Vapor Mode (experimental): compiles templates to direct DOM operations, bypassing VDOM entirely
- Template compiler performs static analysis, hoisting static nodes out of the diff

```
Proxy Mutation -> Notify Subscribed Effects -> Re-render Affected Component -> Scoped VDOM Diff -> DOM Patch
                                                                                    |
                                                                     Static nodes pre-hoisted (skipped in diff)
```

**Angular (Zone.js / Signals + Incremental DOM)**
- **Zone.js (legacy):** Monkey-patches all async APIs (setTimeout, Promise, addEventListener). After any async operation, Angular runs change detection top-down through the entire component tree. Components marked `OnPush` only check when inputs change or events fire within them.
- **Signals (v16+, preferred):** Explicit reactive primitives (`signal()`, `computed()`, `effect()`). Push-based: only re-renders components that read changed signals. No Zone.js needed with `provideExperimentalZonelessChangeDetection()` (stable since Angular 18).
- Uses Incremental DOM: template instructions mutate the DOM in-place during traversal rather than creating a separate VDOM tree. Memory advantage: no VDOM allocation.
- Ahead-of-Time (AOT) compilation transforms templates to optimized JavaScript at build time.

```
// Zone.js path:
Async Event -> Zone.js intercepts -> Trigger change detection -> Top-down tree walk -> Update bindings

// Signals path:
Signal.set() -> Notify dependents -> Mark affected views dirty -> Re-render only dirty views
```

**Svelte (Compiler-first)**
- Svelte is a compiler, not a runtime framework. `.svelte` files are compiled to imperative JavaScript at build time.
- Svelte 5 introduces Runes: `$state`, `$derived`, `$effect` -- explicit, fine-grained reactivity replacing Svelte 4's implicit `$:` labels.
- The compiler analyzes which DOM nodes depend on which state variables and generates targeted `update()` functions that surgically mutate only the affected DOM nodes.
- No VDOM, no diffing, no runtime overhead. The compiled output directly calls `element.textContent = value` or `element.setAttribute(...)`.
- Result: minimal runtime (~2 KB), maximum performance for updates.

```
Compile Time: Analyze dependencies -> Generate targeted update functions
Runtime:      $state change -> Run generated update function -> Direct DOM mutation (no diff)
```

---

## 2. Bundle Size Comparison

### Framework Core Sizes (minified + gzipped)

| Package | Version | Min+Gzip | Notes |
|---|---|---|---|
| **react** + **react-dom** | 19.0 | ~42 KB | react ~2.5 KB + react-dom ~39.5 KB |
| **vue** | 3.5 | ~34 KB | Includes compiler for runtime template compilation; ~23 KB without template compiler |
| **@angular/core** (minimal) | 19 | ~90 KB | Core only; real apps need ~130-170 KB with common, router, forms |
| **svelte** | 5.0 | ~6 KB | Runtime only; most work done at compile time |

### Hello World App Sizes (built output, gzipped)

| Framework | Hello World | CLI Used |
|---|---|---|
| React 19 (Vite) | ~45 KB | `npm create vite@latest -- --template react` |
| Vue 3.5 (Vite) | ~35 KB | `npm create vite@latest -- --template vue` |
| Angular 19 (CLI) | ~100 KB | `ng new` with SSR disabled |
| Svelte 5 (SvelteKit) | ~15 KB | `npm create svelte@latest` |
| Solid 1.8 | ~8 KB | (reference: smallest VDOM-less) |

### Medium App (routing + state management + 10-15 routes, gzipped)

| Framework | Typical Size | Stack |
|---|---|---|
| React | ~180-250 KB | React + React Router + Zustand + a few utilities |
| Vue | ~150-200 KB | Vue + Vue Router + Pinia |
| Angular | ~250-350 KB | Angular (batteries included: router, forms, HTTP) |
| Svelte | ~100-160 KB | SvelteKit (routing built-in) + minimal state |

### Tree-Shaking Capabilities

| Framework | Tree-Shaking Quality | Details |
|---|---|---|
| **React** | Moderate | react-dom is largely monolithic. Individual hooks tree-shake. React 19 improves with compiler dead-code elimination. Third-party libs vary. |
| **Vue** | Excellent | Designed from the ground up for tree-shaking. Unused features (Teleport, Suspense, KeepAlive, Transition) are eliminated. Composition API tree-shakes better than Options API. |
| **Angular** | Good (improved) | v12+ significantly improved with Ivy. Standalone components (v15+) tree-shake better than NgModule-based apps. Still carries baseline overhead. |
| **Svelte** | Excellent (by design) | Compiler only includes code for features actually used. No dead runtime code. Tree-shaking happens at compile time, not bundle time. |

---

## 3. Performance Benchmarks

### js-framework-benchmark Results (Chrome 130, 2024)

Reference: [krausest/js-framework-benchmark](https://github.com/krausest/js-framework-benchmark)

Geometric mean of weighted operations (1.0 = vanilla JS baseline, lower is better):

| Operation | React 19 | Vue 3.5 | Angular 19 | Svelte 5 | Solid 1.8 (ref) | Vanilla JS |
|---|---|---|---|---|---|---|
| **Create 1,000 rows** | 1.30 | 1.25 | 1.35 | 1.10 | 1.05 | 1.00 |
| **Replace 1,000 rows** | 1.35 | 1.25 | 1.30 | 1.10 | 1.05 | 1.00 |
| **Partial update (every 10th)** | 1.25 | 1.15 | 1.20 | 1.05 | 1.03 | 1.00 |
| **Select row** | 1.20 | 1.10 | 1.15 | 1.05 | 1.02 | 1.00 |
| **Swap rows** | 1.35 | 1.20 | 1.25 | 1.10 | 1.05 | 1.00 |
| **Remove row** | 1.20 | 1.15 | 1.20 | 1.05 | 1.03 | 1.00 |
| **Create 10,000 rows** | 1.50 | 1.40 | 1.45 | 1.20 | 1.10 | 1.00 |
| **Append 1,000 rows** | 1.30 | 1.25 | 1.30 | 1.10 | 1.05 | 1.00 |
| **Clear rows** | 1.25 | 1.15 | 1.20 | 1.05 | 1.02 | 1.00 |

**Overall geometric mean (approximate):**
- Vanilla JS: 1.00 (baseline)
- Solid: ~1.04
- Svelte 5: ~1.09
- Vue 3.5: ~1.20
- Angular 19: ~1.25
- React 19: ~1.30

### Startup Performance

| Metric | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| **Script boot time** (medium app) | ~180-250 ms | ~150-200 ms | ~250-400 ms | ~80-120 ms |
| **TTI** (Time to Interactive) | ~1.5-2.5 s | ~1.2-2.0 s | ~2.0-3.5 s | ~0.8-1.5 s |
| **Lighthouse score** (typical) | 85-95 | 88-97 | 75-90 | 92-100 |

### Memory Usage (1,000 rows benchmark)

| Framework | Ready Memory | After Create | After Replace |
|---|---|---|---|
| React 19 | ~3.5 MB | ~7.5 MB | ~7.8 MB |
| Vue 3.5 | ~3.0 MB | ~6.5 MB | ~6.8 MB |
| Angular 19 | ~4.5 MB | ~8.5 MB | ~9.0 MB |
| Svelte 5 | ~2.0 MB | ~4.5 MB | ~4.6 MB |

### Performance Summary

```
Raw Runtime Performance:   Svelte 5 > Vue 3.5 > Angular 19 (Signals) > React 19
Startup Performance:       Svelte 5 > Vue 3.5 > React 19 > Angular 19
Memory Efficiency:         Svelte 5 > Vue 3.5 > React 19 > Angular 19
Bundle Size Efficiency:    Svelte 5 > Vue 3.5 > React 19 > Angular 19

Note: React + React Compiler narrows the gap significantly.
Note: Angular with Signals (zoneless) approaches Vue-level performance.
Note: All frameworks are "fast enough" for 95% of applications.
```

---

## 4. Learning Curve

### Time to Productivity

| Framework | First Component | Simple App (CRUD) | Production-Ready | Mastery |
|---|---|---|---|---|
| **React** | 1-2 hours | 1-2 weeks | 2-4 months | 6-12 months |
| **Vue** | 30 min - 1 hour | 3-5 days | 1-3 months | 4-8 months |
| **Angular** | 2-4 hours | 2-4 weeks | 4-6 months | 12-18 months |
| **Svelte** | 30 min - 1 hour | 2-4 days | 1-2 months | 3-6 months |

### Core Concepts to Learn

| Framework | Essential Concepts | Count |
|---|---|---|
| **React** | JSX, Components, Props, State (`useState`), Effects (`useEffect`), Hooks rules, Conditional rendering, Lists/keys, Event handling, Context, Refs, Memo/Callback (pre-compiler), Suspense, Error Boundaries | ~14 |
| **Vue** | Templates, Components, Props, Reactive state (`ref`/`reactive`), Computed, Watch, Directives (v-if/v-for/v-model/v-bind/v-on), Slots, Emits, Provide/Inject, Lifecycle hooks, Composables | ~12 |
| **Angular** | Components, Modules (legacy) / Standalone, Templates, Decorators, Dependency injection, Services, RxJS (Observables, Operators, Subjects), Routing, Pipes, Directives, Guards, Interceptors, Signals, Forms (Reactive/Template), Change detection, Zones | ~18 |
| **Svelte** | Components, Props (`$props`), State (`$state`), Derived (`$derived`), Effects (`$effect`), Template blocks ({#if}, {#each}), Events, Bindings, Slots/Snippets, Stores (legacy), Transitions, Actions | ~12 |

### Documentation Quality (as of early 2025)

| Framework | Rating | Strengths | Weaknesses |
|---|---|---|---|
| **React** | B+ | New react.dev is excellent with interactive examples; good conceptual docs | Ecosystem fragmented; official docs don't cover routing, state management, or meta-frameworks in depth |
| **Vue** | A | Comprehensive, well-organized, includes cookbook and examples; excellent migration guides | Composition API vs Options API can confuse beginners on which to learn |
| **Angular** | A- | Very thorough, covers every built-in feature; excellent tutorial (Tour of Heroes) | Can be overwhelming; docs are dense; RxJS learning largely deferred to external resources |
| **Svelte** | A | Interactive tutorial at learn.svelte.dev is best-in-class; concise and clear | Smaller ecosystem means less third-party documentation; Svelte 5 runes docs still maturing |

### Learning Curve Difficulty Sources

```
React:   Hooks mental model (closures, dependency arrays, stale closures),
         "just JavaScript" means too many choices, useEffect pitfalls,
         understanding re-renders, memoization strategies (pre-compiler)

Vue:     ref vs reactive confusion, understanding Proxy limitations,
         template refs vs reactive refs naming collision,
         Options API vs Composition API choice paralysis

Angular: RxJS is effectively a prerequisite framework-within-a-framework,
         Dependency injection concepts, decorator-heavy syntax,
         NgModules (legacy) complexity, large API surface,
         understanding Zone.js behavior vs Signals

Svelte:  Smallest learning curve overall; main challenges are
         understanding compiler magic, Svelte 5 runes migration,
         fewer established patterns due to smaller ecosystem
```

---

## 5. Ecosystem Comparison

### 5.1 Routing

| Aspect | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| **Primary router** | React Router 7 / TanStack Router | Vue Router 4 | @angular/router (built-in) | SvelteKit (file-based) |
| **File-based routing** | Next.js App Router, TanStack Router | Nuxt 3, Vite Plugin Pages | Analog.js | SvelteKit (native) |
| **Type-safe routes** | TanStack Router (excellent) | unplugin-vue-router | Angular (moderate) | SvelteKit (good, via generated types) |
| **Nested layouts** | React Router (Outlet), Next.js (layout.tsx) | Vue Router (router-view), Nuxt (layouts/) | Angular Router (router-outlet, excellent) | SvelteKit (+layout.svelte, excellent) |
| **Code splitting** | `lazy()` + Suspense | `defineAsyncComponent` + async routes | Built-in lazy loading with `loadChildren` | SvelteKit (automatic per-route) |
| **SSR integration** | Next.js, Remix | Nuxt 3 | Angular Universal / Angular SSR | SvelteKit (native) |

### 5.2 State Management

| Aspect | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| **Built-in** | `useState`, `useReducer`, `useContext` | `ref()`, `reactive()`, `provide/inject` | Signals (`signal()`, `computed()`), Services + DI | `$state`, `$derived`, `$effect` (runes) |
| **Lightweight global** | Zustand (~1 KB), Jotai (~3 KB) | Pinia (~1.5 KB) | Signals + Services | Svelte stores / `$state` in .svelte.ts |
| **Flux/Redux-like** | Redux Toolkit (~11 KB), Zustand | Pinia (official, replaces Vuex) | NgRx (~15 KB) | N/A (rarely needed) |
| **Atomic** | Jotai, Recoil (deprecated) | N/A (ref is already atomic) | Angular Signals | `$state` runes |
| **Server state** | TanStack Query, SWR, Apollo | TanStack Query (Vue), Apollo | TanStack Query (Angular), Apollo | TanStack Query (Svelte), SvelteKit load() |
| **Devtools** | Redux DevTools, React DevTools | Vue DevTools (excellent) | Angular DevTools | Svelte DevTools (basic) |

### 5.3 Meta-Frameworks (Full-Stack)

| Aspect | Next.js (React) | Nuxt 3 (Vue) | Angular SSR / Analog | SvelteKit |
|---|---|---|---|---|
| **SSR** | Yes (App Router) | Yes (Nitro server) | Angular Universal / Built-in SSR (v17+) | Yes (native) |
| **SSG** | Yes (`generateStaticParams`) | Yes (`nuxi generate`) | Prerendering with `@angular/ssr` | Yes (`prerender = true`) |
| **ISR** | Yes (revalidate) | Yes (Nitro caching rules) | Limited | Limited |
| **API Routes** | Yes (Route Handlers) | Yes (server/api/) | Analog.js (API routes) | Yes (+server.ts) |
| **Edge runtime** | Vercel Edge, Cloudflare | Nitro (multi-platform) | Limited | Cloudflare, Vercel, etc. |
| **Deployment** | Vercel-optimized; self-host via Node | Multi-platform via Nitro presets | Node.js, Docker | Adapters: node, vercel, cloudflare, static |
| **Maturity** | Most mature, largest ecosystem | Very mature, excellent DX | Angular SSR mature; Analog.js newer | Production-ready, excellent DX |

### 5.4 Component Libraries

| Category | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| **Material Design** | MUI (Material UI) | Vuetify 3 | Angular Material (official) | Svelte Material UI |
| **Headless/Unstyled** | Radix UI, Headless UI, Ark UI | Radix Vue, Headless UI Vue | Angular CDK | Melt UI, Bits UI |
| **Full-featured** | Ant Design, Chakra UI, Mantine | PrimeVue, Naive UI, Element Plus | PrimeNG, NG-ZORRO | Skeleton UI, Flowbite Svelte |
| **Tailwind-based** | shadcn/ui (most popular) | shadcn-vue | spartan/ui (Angular) | shadcn-svelte |
| **Enterprise/Data Grid** | AG Grid, TanStack Table | AG Grid (Vue), PrimeVue DataTable | AG Grid (Angular), Angular Material Table | AG Grid (Svelte), Svelte Headless Table |
| **Ecosystem size** | Largest (thousands of libs) | Large (hundreds) | Large (hundreds) | Growing (dozens of quality libs) |

### 5.5 Form Handling

| Framework | Solution | Approach |
|---|---|---|
| **React** | React Hook Form (~9 KB), Formik, TanStack Form | External libraries; no built-in form abstraction |
| **Vue** | VeeValidate, FormKit, native v-model | `v-model` for two-way binding; libs for validation |
| **Angular** | Reactive Forms, Template-driven Forms (built-in) | Built-in, extremely powerful; `FormGroup`, `FormControl`, `Validators` |
| **Svelte** | Superforms, Felte, native `bind:value` | `bind:` directive for two-way binding; SvelteKit form actions for server-side |

### 5.6 Testing

| Aspect | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| **Unit / Component** | React Testing Library, Vitest/Jest | Vue Testing Utils, Vue Testing Library, Vitest | TestBed (built-in), Jasmine/Karma (legacy), Jest/Vitest | Svelte Testing Library, Vitest |
| **E2E** | Playwright, Cypress | Playwright, Cypress | Playwright, Cypress, Protractor (deprecated) | Playwright, Cypress |
| **Visual** | Storybook, Chromatic | Storybook, Histoire | Storybook | Storybook |
| **Test DX** | Excellent (largest ecosystem) | Very good | Good (TestBed can be verbose) | Good (simple component model helps) |

### 5.7 Styling Approaches

| Approach | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| **Scoped CSS** | CSS Modules, styled-components | `<style scoped>` (built-in) | Component styles with ViewEncapsulation (built-in) | `<style>` (scoped by default) |
| **CSS-in-JS** | styled-components, Emotion, Panda CSS | Less common; can use any | Less common; can use any | Not needed (scoped by default) |
| **Utility-first** | Tailwind CSS (dominant) | Tailwind CSS (popular) | Tailwind CSS (growing) | Tailwind CSS (popular) |
| **Zero-runtime** | Panda CSS, vanilla-extract | UnoCSS, Tailwind | Tailwind, Angular-specific | Tailwind, UnoCSS |

---

## 6. TypeScript Support

### TypeScript Integration Depth

| Aspect | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| **TS integration** | Bolted-on but excellent | Bolted-on, significantly improved in v3.5 | Native (written in TypeScript) | Bolted-on via `lang="ts"` in `<script>` |
| **Type inference** | Excellent for hooks and props | Excellent with `<script setup>` + `defineProps` | Excellent (native) | Good, improving in Svelte 5 |
| **Template type-checking** | JSX = full TS checking in templates | `vue-tsc` (Volar): full template checking | AOT compiler: full template checking | `svelte-check`: full template checking |
| **Generic components** | `<T,>(props: Props<T>)` syntax | `<script setup lang="ts" generic="T">` (v3.3+) | Native generics (limited in templates) | `generics` attribute in `<script>` |
| **IDE support** | VSCode/WebStorm: excellent | Volar extension: excellent (replaced Vetur) | Angular Language Service: excellent | Svelte extension: very good |
| **Config complexity** | Minimal (`tsconfig.json` + jsx setting) | Moderate (`vue-tsc`, Volar, some config) | Moderate-High (strict mode, decorator metadata) | Minimal (`svelte-check` + tsconfig) |
| **Strict mode quality** | Excellent | Very good | Excellent (strictest by default) | Good |

### Type Safety Comparison

```typescript
// React: Props are naturally typed
interface UserCardProps {
  user: User;
  onSelect: (id: string) => void;
}
const UserCard: React.FC<UserCardProps> = ({ user, onSelect }) => (
  <div onClick={() => onSelect(user.id)}>{user.name}</div>
);

// Vue: defineProps with type-only declaration
// <script setup lang="ts">
const props = defineProps<{
  user: User;
  onSelect: (id: string) => void;
}>();
// Template: {{ props.user.name }} -- fully type-checked by Volar

// Angular: Decorated class properties
@Component({ template: `<div (click)="onSelect(user.id)">{{ user.name }}</div>` })
class UserCardComponent {
  @Input() user!: User;
  @Output() select = new EventEmitter<string>();
  onSelect(id: string) { this.select.emit(id); }
}
// Template type-checked by Angular Language Service + AOT

// Svelte: $props rune
// <script lang="ts">
interface Props { user: User; onSelect: (id: string) => void; }
let { user, onSelect }: Props = $props();
// Template: {user.name} -- type-checked by svelte-check
```

---

## 7. Developer Experience

### HMR (Hot Module Replacement) Speed

| Framework | HMR Speed | Technology | Notes |
|---|---|---|---|
| **React** (Vite) | ~50-150 ms | Vite + React Fast Refresh | Preserves component state; occasional full reload on hook changes |
| **Vue** (Vite) | ~30-100 ms | Vite (created by Vue's creator) | Best-in-class; SFC hot reload preserves state perfectly |
| **Angular** (CLI) | ~200-500 ms | Webpack (legacy) / esbuild (v17+) | v17+ with esbuild dramatically improved; v16 and below was 1-3 seconds |
| **Svelte** (Vite) | ~30-80 ms | Vite + svelte-hmr | Very fast; compiler makes updates efficient |

### Error Messages Quality

| Framework | Quality | Strengths | Weaknesses |
|---|---|---|---|
| **React** | B+ | Good runtime errors with component stacks; error overlays in dev; React 19 improves hydration error messages | Hook rule violations can be cryptic; "too many re-renders" lacks context |
| **Vue** | A- | Clear warnings with component traces; helpful "did you mean...?" suggestions; runtime + compile-time warnings | Proxy-related errors can confuse beginners |
| **Angular** | A | Best compile-time error messages (AOT catches template errors); detailed runtime errors with links to docs | Error messages can be verbose; Zone.js-related errors are confusing |
| **Svelte** | A | Compiler errors are clear and actionable; points to exact line in `.svelte` file; a11y warnings built-in | Fewer runtime errors (most caught at compile time) -- this is a feature, not a weakness |

### DevTools

| Framework | Tool | Features |
|---|---|---|
| **React** | React DevTools (browser extension) | Component tree, props/state inspection, Profiler (flamegraph), component highlight, hooks inspection, timeline (experimental) |
| **Vue** | Vue DevTools (browser extension + standalone) | Component tree, state inspection, Pinia store inspection, router inspection, timeline of events, performance monitoring, edit state in devtools |
| **Angular** | Angular DevTools (browser extension) | Component tree, dependency injection graph, change detection profiling, router tree, directive inspection |
| **Svelte** | Svelte DevTools (browser extension) | Component tree, state inspection; less mature than React/Vue/Angular devtools |

### IDE Support (VSCode)

| Framework | Extension | IntelliSense | Refactoring | Snippets |
|---|---|---|---|---|
| **React** | Built-in (JSX/TSX) | Excellent | Excellent | ES7 React snippets |
| **Vue** | Volar (official) | Excellent | Very good | Volar features |
| **Angular** | Angular Language Service | Excellent | Very good | Angular Snippets |
| **Svelte** | Svelte for VS Code | Very good | Good | Built-in |

---

## 8. Enterprise Adoption

### Major Company Usage

| Framework | Notable Users |
|---|---|
| **React** | Meta/Facebook, Instagram, Netflix, Airbnb, Uber, Twitter/X, Discord, Shopify, Notion, Figma, Stripe, Vercel, Dropbox, Reddit, Salesforce, Microsoft (parts) |
| **Vue** | Alibaba, Xiaomi, Baidu, GitLab, Nintendo (website), Grammarly, Adobe (portfolio), Behance, Trivago, BMW, Louis Vuitton, Apple (some internal tools), Upwork |
| **Angular** | Google (Ads, Cloud Console, Firebase, internal tools), Microsoft (Office Online, Azure), Samsung, Deutsche Bank, Forbes, Upwork, Freelancer, PayPal (parts), Delta Airlines, BMW (apps) |
| **Svelte** | Apple (some internal), The New York Times, Spotify (some internal), Brave, 1Password, Philips, Rakuten, IKEA (parts), Stack Overflow (survey tools), Yelp (parts) |

### NPM Weekly Downloads (approximate, early 2025)

| Package | Weekly Downloads | Trend |
|---|---|---|
| **react** | ~25-28 million | Stable/growing |
| **vue** | ~4.5-5 million | Stable |
| **@angular/core** | ~3-3.5 million | Stable |
| **svelte** | ~600K-800K | Growing fastest (%) |

### Job Market (approximate, LinkedIn/Indeed, 2025)

| Framework | Job Postings (relative) | Average Salary (US, Senior) | Demand Trend |
|---|---|---|---|
| **React** | ~60-65% of frontend jobs | $130-180K | Dominant, stable |
| **Angular** | ~20-25% | $125-170K | Stable, strong in enterprise |
| **Vue** | ~10-15% | $120-165K | Growing, strong in Asia/Europe |
| **Svelte** | ~2-5% | $125-170K | Growing, often listed as "nice to have" |

### Release Cycles and Long-Term Support

| Framework | Major Release Cycle | LTS Policy | Backward Compatibility |
|---|---|---|---|
| **React** | Irregular (2-3 years between majors) | No formal LTS; old versions receive critical fixes for ~2 years | Very good; incremental adoption of new features; codemods provided; class components still work in React 19 |
| **Vue** | ~2-3 years | Vue 2 EOL was Dec 2023; Vue 3 is current LTS | Good; Vue 2->3 was the biggest breaking change; within v3.x, very stable |
| **Angular** | Every 6 months (predictable) | Each major version supported for 18 months (6 active + 12 LTS) | Excellent; `ng update` with automatic migrations; deprecation policy is well-documented; schematics handle breaking changes |
| **Svelte** | Irregular (1-2 years) | No formal LTS; small team, community-driven | Good for minor versions; Svelte 4->5 (runes) is a significant paradigm shift but has migration tooling |

### Governance and Funding

| Framework | Governance | Primary Funding | Bus Factor |
|---|---|---|---|
| **React** | Meta Open Source | Meta (Facebook) | Large team at Meta; community contributors; low risk |
| **Vue** | Independent (Evan You) | Sponsors, Patreon, company contracts | Evan You is benevolent dictator; growing core team (~30); moderate risk |
| **Angular** | Google Open Source | Google | Large team at Google; used heavily internally; low risk |
| **Svelte** | Independent (Rich Harris, Vercel) | Vercel (Rich Harris is employed there) | Rich Harris + small core team; Vercel sponsorship reduces risk |

---

## 9. Decision Matrix

### When to Choose Each Framework

#### Choose React When:

- **Team:** Already knows React; large pool of hirable developers
- **Project:** Complex UI with many interactive elements; need largest ecosystem of third-party components
- **Scale:** Large application with many contributors (established patterns)
- **Requirements:** Need React Native for cross-platform mobile; need Next.js for complex SSR/SSG
- **Ecosystem:** Need maximum third-party library support; specific library only has React bindings
- **AI/ML dashboards:** Many data visualization and AI-specific libraries target React first

```
BEST FIT: Large teams, complex SPAs, cross-platform (web+mobile),
          maximum ecosystem needs, projects where hiring is a priority
```

#### Choose Vue When:

- **Team:** Mix of experience levels; want fastest onboarding; team coming from jQuery/vanilla
- **Project:** Medium complexity; progressive enhancement of existing apps
- **Scale:** Small to large (Vue scales well with Composition API + Pinia)
- **Requirements:** Need excellent DX with lower learning curve; rapid prototyping
- **Ecosystem:** Need solid ecosystem without overwhelming choice paralysis (opinionated defaults)
- **Region:** Team/company in Asia or Europe (Vue has stronger adoption there)

```
BEST FIT: Small-to-medium teams, rapid development, progressive adoption,
          teams with mixed skill levels, projects where DX is prioritized
```

#### Choose Angular When:

- **Team:** Enterprise team with Java/C# background; team values structure and conventions
- **Project:** Large-scale enterprise application with complex requirements
- **Scale:** Large application with 10+ developers; long-lived codebase (5+ years)
- **Requirements:** Need built-in everything (forms, HTTP, routing, DI, i18n); strict coding standards
- **Enterprise:** Need formal LTS, predictable release schedule, corporate backing
- **Compliance:** Government, finance, healthcare -- where standardization and auditability matter

```
BEST FIT: Large enterprise teams, complex business applications,
          Java/C# shops moving to web, long-term maintained applications,
          projects needing built-in solutions for everything
```

#### Choose Svelte When:

- **Team:** Small, experienced team that values simplicity; willing to work with smaller ecosystem
- **Project:** Performance-critical applications; content-heavy sites; embedded widgets
- **Scale:** Small to medium (can scale, but ecosystem is smaller)
- **Requirements:** Smallest possible bundle size; fastest possible performance; excellent SEO (SvelteKit)
- **Constraints:** Limited bandwidth users; embedded/widget scenarios; IoT dashboards
- **DX:** Team values clean, readable code with minimal boilerplate

```
BEST FIT: Small teams, performance-critical apps, content sites,
          embedded widgets, teams that value code simplicity,
          projects where bundle size is critical
```

### Decision Tree

```
START: What is your primary constraint?
|
|-- "Maximum hiring pool / largest ecosystem"
|   --> React
|
|-- "Fastest onboarding / best DX for mixed-skill team"
|   --> Vue
|
|-- "Enterprise standardization / built-in everything"
|   --> Angular
|
|-- "Maximum performance / smallest bundle"
|   --> Svelte
|
If still undecided, ask:
|
|-- "Do you need React Native for mobile?"
|   YES --> React
|   NO  --> continue
|
|-- "Is this a 50+ developer, multi-year enterprise project?"
|   YES --> Angular (structure prevents chaos at scale)
|   NO  --> continue
|
|-- "Does the team have < 6 months frontend experience?"
|   YES --> Vue (gentlest learning curve)
|   NO  --> continue
|
|-- "Is bundle size / performance the #1 priority?"
|   YES --> Svelte
|   NO  --> React (safe default with largest ecosystem)
```

### Scoring Matrix (1-5 scale, 5 = best)

| Criterion | React | Vue | Angular | Svelte | Weight (typical) |
|---|---|---|---|---|---|
| Learning Curve | 3 | 5 | 2 | 5 | Medium |
| Performance | 3 | 4 | 3 | 5 | Medium |
| Bundle Size | 3 | 4 | 2 | 5 | Low-Medium |
| Ecosystem Size | 5 | 4 | 4 | 2 | High |
| Enterprise Readiness | 4 | 3 | 5 | 2 | High (enterprise) |
| TypeScript | 4 | 4 | 5 | 3 | Medium |
| Documentation | 4 | 5 | 4 | 4 | Medium |
| Job Market | 5 | 3 | 4 | 1 | High |
| Long-term Stability | 4 | 4 | 5 | 3 | High (enterprise) |
| DX / Ergonomics | 4 | 5 | 3 | 5 | Medium |
| SEO / SSR | 4 (Next.js) | 4 (Nuxt) | 3 | 5 (SvelteKit) | Medium |
| Mobile (cross-plat) | 5 (RN) | 2 (Capacitor) | 2 (Ionic) | 1 | Varies |

---

## 10. Migration Paths

### React: Class Components -> Hooks -> Server Components

```
React Class Components (2013-2018)
  |
  | React 16.8 (Feb 2019): Hooks introduced
  v
React Hooks (2019-present)
  |   - Incremental: class and function components coexist
  |   - No big-bang migration required
  |   - Community shifted to hooks rapidly (2019-2021)
  |
  | React 18 (Mar 2022): Concurrent features
  v
React 18 Concurrent Mode
  |   - Automatic batching, useTransition, useDeferredValue
  |   - Suspense for data fetching
  |   - Mostly additive; few breaking changes
  |
  | React 19 (Dec 2024): Actions, Server Components stable
  v
React 19 + Server Components
  |   - use() hook, useFormStatus, useOptimistic
  |   - React Compiler (opt-in) eliminates manual memoization
  |   - Server Components require a meta-framework (Next.js)
  |   - Migration: gradual; mark client components with "use client"
  |
  MIGRATION EFFORT: Low per step (each step is incremental)
  TOOLING: react-codemod for automated transforms
```

### Vue 2 -> Vue 3

```
Vue 2 (2016-2023)
  |   - Options API, Vuex, Vue Router 3
  |   - EOL: December 31, 2023
  |
  | Migration path:
  |   1. Install @vue/compat (migration build) -- runs Vue 2 code on Vue 3 runtime
  |   2. Fix deprecation warnings one at a time
  |   3. Migrate from Vuex to Pinia
  |   4. Migrate from Options API to Composition API (optional but recommended)
  |   5. Remove @vue/compat, run on Vue 3 directly
  v
Vue 3 (2020-present)
  |   - Composition API, Pinia, Vue Router 4
  |   - Proxy-based reactivity (breaking: no IE11 support)
  |
  | Key breaking changes (Vue 2 -> 3):
  |   - Global API changes (createApp vs new Vue)
  |   - v-model changes (modelValue prop, multiple v-model)
  |   - $listeners removed (merged into $attrs)
  |   - Filters removed (use computed/methods)
  |   - Event bus ($on/$off/$once removed from instances)
  |   - Functional components simplified
  |   - Render function API changed (h() imported, not arg)
  |
  MIGRATION EFFORT: Moderate (biggest migration in Vue history)
  TOOLING: @vue/compat migration build; gogocode-plugin-vue for automated transforms
```

### Angular Version Migrations

```
Angular follows semver with a major release every 6 months.
Key evolutionary milestones:

AngularJS (1.x) -> Angular 2+ (2016)
  |   COMPLETE REWRITE -- not a migration, a new framework
  |   ngUpgrade allows running AngularJS and Angular side-by-side
  |
Angular 2 -> ... -> Angular 14 (incremental)
  |   `ng update` handles most migrations automatically
  |   Schematics run code transforms
  |
Angular 14 (2022): Standalone components (optional)
  |   - Components without NgModules
  |   - Typed reactive forms
  |
Angular 15 (2022): Standalone APIs stable
  |
Angular 16 (2023): Signals (developer preview)
  |   - signal(), computed(), effect()
  |   - Beginning of Zone.js deprecation path
  |
Angular 17 (2023): New template syntax
  |   - @if, @for, @switch (replacing *ngIf, *ngFor, *ngSwitch)
  |   - Deferrable views (@defer)
  |   - Built-in control flow
  |   - esbuild as default builder (massive build speed improvement)
  |   - Schematics for automatic migration: ng generate @angular/core:control-flow
  |
Angular 18 (2024): Zoneless change detection (experimental)
  |   - Signals-based change detection without Zone.js
  |
Angular 19 (2024): Signals stable, improved SSR
  |   - resource() and rxResource() for async data
  |   - linkedSignal() for derived mutable state
  |   - Incremental hydration
  |
  MIGRATION EFFORT: Low per version (ng update is excellent)
  TOOLING: ng update with automatic schematics; best migration tooling of any framework

Migration command:
  ng update @angular/core @angular/cli
  # Schematics automatically transform code for breaking changes
```

### Svelte 4 -> Svelte 5

```
Svelte 4 (2023)
  |   - $: reactive declarations
  |   - export let for props
  |   - Stores ($store syntax)
  |   - on:event directive
  |
  | Key changes in Svelte 5:
  |   - $: reactive declarations -> $derived, $effect
  |   - export let -> $props()
  |   - Stores -> $state (in .svelte.ts files for shared state)
  |   - on:click -> onclick (standard HTML attributes)
  |   - <slot> -> {@render children()} with Snippets
  |   - createEventDispatcher -> callback props
  |
  v
Svelte 5 (2024)
  |   - Runes: $state, $derived, $effect, $props, $bindable, $inspect
  |   - Snippets (replacing slots)
  |   - Fine-grained reactivity (similar to Solid's approach)
  |   - Universal reactivity (.svelte.ts files can use runes)
  |
  MIGRATION EFFORT: Moderate (paradigm shift from implicit to explicit reactivity)
  TOOLING: npx sv migrate svelte-5 (automated migration script)
  COMPATIBILITY: Svelte 4 syntax still works in Svelte 5 (gradual migration)
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Choosing based on benchmarks alone** | Picking Svelte for a 10ms edge when API calls take 200ms | ALL frameworks are fast enough for 95% of apps; choose based on team and ecosystem fit |
| **Ignoring team's existing skills** | Productivity crash during framework switch, poor code quality | A team fluent in Angular will outperform the same team learning "a better framework" |
| **Angular for a small project** | Boilerplate-heavy 3-page marketing site, slow development | Use Vue or Svelte for small projects; Angular's structure pays off at scale (10+ devs) |
| **Svelte for huge enterprise projects** | Fewer hires, fewer component libraries, smaller Stack Overflow knowledge base | Consider React or Angular for 50+ developer teams with high hiring needs |
| **React just because it's popular** | Decision fatigue (which state manager? which router? which meta-framework?) | Evaluate actual project needs; React's ecosystem fragmentation is a real cost |
| **Underestimating Angular's modernization** | Dismissing Angular based on pre-v14 experience (NgModules, verbose syntax) | Modern Angular (v17+) has standalone components, signals, @if/@for, @defer — significantly better DX |
| **Expecting to "migrate later"** | Stuck with poor choice for 3-5 years; migration costs 10x initial setup | Choose thoughtfully upfront; framework migrations are expensive and risky |
| **Not considering meta-framework** | Building custom SSR, routing, code splitting from scratch | Use Next.js (React), Nuxt (Vue), or SvelteKit (Svelte) — they solve 80% of production concerns |
| **Choosing by GitHub stars** | Picking the "hottest" framework without evaluating stability | Stars don't equal production readiness; evaluate LTS, corporate backing, and migration tooling |

---

## Quick Reference: Framework DNA

```
React:   "A JavaScript library for building user interfaces"
         DNA: Minimal core + massive ecosystem. You assemble your stack.
         Philosophy: "Learn once, write anywhere." Functional, composition-based.
         Mantra: "Just JavaScript"

Vue:     "The Progressive JavaScript Framework"
         DNA: Approachable, versatile, performant. Batteries available but optional.
         Philosophy: Progressive adoption. Start simple, scale up.
         Mantra: "The best of both worlds" (between React and Angular)

Angular: "The web development framework for building the future"
         DNA: Opinionated, comprehensive, enterprise-grade. Batteries included.
         Philosophy: Convention over configuration. One way to do things.
         Mantra: "Everything you need, built in"

Svelte:  "Cybernetically enhanced web apps"
         DNA: Compiler-first. Write less code. No virtual DOM.
         Philosophy: Shift work from runtime to compile time.
         Mantra: "Write less, do more, ship less JavaScript"
```

---

## 13. Enforcement Checklist

### Framework Selection Process
- [ ] Team skills and experience inventoried before framework choice
- [ ] Project scale and complexity evaluated (small/medium/large/enterprise)
- [ ] Hiring pool availability checked for target framework
- [ ] Ecosystem requirements identified (component libraries, testing, tooling)
- [ ] Performance requirements quantified (bundle size budget, Core Web Vitals targets)
- [ ] Long-term maintenance plan considered (3-5 year horizon)

### Architecture Decisions
- [ ] Meta-framework chosen for SSR/SSG needs (Next.js, Nuxt, SvelteKit, Angular SSR)
- [ ] State management strategy defined (server state vs client state)
- [ ] Routing approach selected (file-based vs config-based)
- [ ] TypeScript enabled and strictness level configured
- [ ] Component library selected or headless UI approach decided

### Migration Planning (if switching)
- [ ] Migration cost estimated (developer-months, not just "we'll figure it out")
- [ ] Incremental migration strategy defined (not big-bang rewrite)
- [ ] Automated codemods identified and tested
- [ ] Both old and new framework codebases can coexist during transition
- [ ] Rollback plan exists if migration stalls

### Ongoing Evaluation
- [ ] Bundle size monitored against budget
- [ ] Core Web Vitals tracked in production
- [ ] Framework version kept up to date (within 1 major version)
- [ ] Team satisfaction surveyed periodically
- [ ] Ecosystem health monitored (library maintenance, community activity)
