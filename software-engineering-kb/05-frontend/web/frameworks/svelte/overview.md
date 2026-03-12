# Svelte 5 — Complete Specification

> **AI Plugin Directive:** When a developer asks "how does Svelte work?", "should I use Svelte?", "what are runes?", "explain Svelte 5 features", "how does Svelte compare to React/Vue?", "what is SvelteKit?", or any foundational Svelte question, ALWAYS consult this directive. Apply Svelte's compiler-first, no-virtual-DOM model with runes-based reactivity and SvelteKit for full-stack applications. NEVER recommend Svelte 4 reactive declarations (`$:`) or `createEventDispatcher` for new Svelte 5 code. Default to Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) and snippet-based composition.

**Core Rule: Svelte is a COMPILER, not a runtime framework. Components are compiled to efficient imperative JavaScript that surgically updates the DOM. In Svelte 5, runes (`$state`, `$derived`, `$effect`, `$props`) replace ALL legacy reactivity (`$:`, stores auto-subscription, `createEventDispatcher`). Use runes EXCLUSIVELY for new code. Svelte produces the smallest bundles with zero virtual DOM overhead. SvelteKit is the official full-stack framework providing SSR, SSG, SPA modes, file-based routing, and server-side data loading.**

---

## 1. Svelte's Mental Model

```
                    SVELTE CORE MENTAL MODEL

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │   Compiler-as-Framework                                 │
  │                                                         │
  │   Your .svelte files are compiled at BUILD TIME         │
  │   into optimized vanilla JavaScript.                    │
  │   There is NO virtual DOM. There is NO diffing.         │
  │   The compiler generates surgical DOM update            │
  │   instructions for each piece of reactive state.        │
  │                                                         │
  └─────────────────────────────────────────────────────────┘

  .svelte file ──→ Svelte Compiler ──→ Vanilla JS + CSS
                                            │
                                            ▼
                                   Direct DOM mutations
                                   (no runtime diffing)

  REACT MODEL:                    SVELTE MODEL:
  State → VDOM → Diff → DOM      State → Compiled Update → DOM
  (runtime work every render)     (update code generated at compile)

  KEY INSIGHT:
  - Svelte shifts work from RUNTIME to BUILD TIME
  - The compiler knows at compile time which DOM nodes
    depend on which state, so it generates targeted updates
  - No framework runtime shipped to the browser (minimal ~2KB runtime)
  - Result: faster startup, less memory, smaller bundles
```

### 1.1 Compiler vs Runtime Frameworks

```
          FRAMEWORK ARCHITECTURE COMPARISON

  ┌───────────────────────────────────────────────────────┐
  │ REACT / VUE (Runtime frameworks)                      │
  │                                                       │
  │  App Code + Framework Runtime ──→ Browser             │
  │       │                               │               │
  │       ▼                               ▼               │
  │  JSX/Template → Virtual DOM → Diff → DOM Updates      │
  │  (framework does work AT RUNTIME every state change)  │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │ SVELTE (Compiler framework)                           │
  │                                                       │
  │  .svelte files ──→ Compiler ──→ Optimized JS + CSS    │
  │       │                               │               │
  │       ▼                               ▼               │
  │  Template analyzed → Update code generated → Browser  │
  │  (compiler generates specific DOM update instructions) │
  │  (minimal runtime, no diffing algorithm shipped)      │
  └───────────────────────────────────────────────────────┘

  What the compiler generates for a simple counter:
  ─────────────────────────────────────────────────
  Input (.svelte):          Output (JS):
  <button on:click={inc}>   // create: append button
    {count}                 // update: if count changed,
  </button>                 //   button.textContent = count
                            // (NO virtual DOM, NO diff)
```

### 1.2 The .svelte File Structure

Every `.svelte` file has up to three sections — all optional:

```svelte
<!-- 1. SCRIPT — Component logic (JavaScript/TypeScript) -->
<script lang="ts">
  // Imports, state, derived values, effects, props
  let count = $state(0);

  function increment() {
    count++;
  }
</script>

<!-- 2. MARKUP — Template (HTML + Svelte syntax) -->
<button onclick={increment}>
  Count: {count}
</button>

<!-- 3. STYLE — Scoped CSS (automatically scoped to this component) -->
<style>
  button {
    background: #ff3e00;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```

**Key structural rules:**
- `<script>` can appear once (component-instance logic) and optionally once with `context="module"` for module-level code
- `<script context="module">` runs once when module loads, shared across all instances
- `<style>` is automatically scoped — selectors only affect elements in this component
- Markup is plain HTML enhanced with Svelte template syntax (`{}`, `{#if}`, `{#each}`, etc.)
- TypeScript is supported via `<script lang="ts">`

```svelte
<!-- Module script: runs once, shared across instances -->
<script context="module" lang="ts">
  // Can export constants, types, or functions
  export const WIDGET_VERSION = '2.0.0';

  // This code runs once when module is first imported
  console.log('Module loaded');
</script>

<!-- Instance script: runs per component instance -->
<script lang="ts">
  // This runs for each instance of the component
  let count = $state(0);
</script>
```

---

## 2. Svelte 5 Runes — The New Reactivity System

```
              SVELTE 5 RUNES OVERVIEW

  ┌──────────────┬────────────────────────────────────┐
  │ Rune         │ Purpose                            │
  ├──────────────┼────────────────────────────────────┤
  │ $state       │ Declare reactive state             │
  │ $state.raw   │ Non-deep-reactive state (shallow)  │
  │ $derived     │ Computed values from state          │
  │ $derived.by  │ Computed values (complex logic)     │
  │ $effect      │ Side effects when state changes     │
  │ $effect.pre  │ Effects that run before DOM update  │
  │ $effect.root │ Manual lifecycle control            │
  │ $props       │ Declare component props             │
  │ $bindable    │ Props that support bind:            │
  │ $inspect     │ Debug reactive values (dev only)    │
  │ $host        │ Access custom element host node     │
  └──────────────┴────────────────────────────────────┘

  SVELTE 4 → SVELTE 5 MIGRATION MAP:
  ─────────────────────────────────────
  let count = 0;              →  let count = $state(0);
  $: doubled = count * 2;    →  let doubled = $derived(count * 2);
  $: console.log(count);     →  $effect(() => { console.log(count); });
  export let name;            →  let { name } = $props();
  $: { complex logic }       →  let val = $derived.by(() => { ... });
```

### 2.1 `$state` — Reactive State

`$state` creates deeply reactive state. When you mutate the value (or nested properties of objects/arrays), the UI updates automatically.

```svelte
<script lang="ts">
  // Primitive state
  let count = $state(0);
  let name = $state('World');
  let isOpen = $state(false);

  // Object state — DEEPLY reactive
  // Mutating nested properties triggers updates
  let user = $state({
    name: 'Alice',
    address: {
      city: 'Portland',
      zip: '97201'
    },
    hobbies: ['reading', 'coding']
  });

  function updateCity() {
    // This WORKS — deep reactivity tracks nested mutations
    user.address.city = 'Seattle';
  }

  function addHobby() {
    // Array mutations also tracked
    user.hobbies.push('hiking');
  }

  // Array state — deeply reactive, mutations tracked
  let todos = $state([
    { id: 1, text: 'Learn Svelte', done: false },
    { id: 2, text: 'Build app', done: false }
  ]);

  function toggleTodo(id: number) {
    const todo = todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done; // Direct mutation works!
  }

  function addTodo(text: string) {
    todos.push({ id: Date.now(), text, done: false }); // push works!
  }
</script>

<p>Hello {name}! Count: {count}</p>
<p>City: {user.address.city}</p>

{#each todos as todo}
  <label>
    <input type="checkbox" checked={todo.done} onchange={() => toggleTodo(todo.id)} />
    {todo.text}
  </label>
{/each}
```

**How `$state` works under the hood:**
- Primitives become signal-like values tracked by the compiler
- Objects and arrays are wrapped in `Proxy` for deep reactivity
- The compiler statically analyzes which template expressions read which state
- Only the specific DOM nodes that depend on changed state are updated

### 2.2 `$state.raw` — Shallow (Non-Deep) Reactivity

For large datasets or immutable data patterns where you do NOT want Proxy-based deep tracking:

```svelte
<script lang="ts">
  // $state.raw: NOT deeply reactive
  // Only reassignment triggers updates, NOT nested mutations
  let items = $state.raw([
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ]);

  function updateItem() {
    // ❌ This will NOT trigger an update (no deep proxy)
    items[0].name = 'Updated';

    // ✅ Must reassign the entire value
    items = items.map(item =>
      item.id === 1 ? { ...item, name: 'Updated' } : item
    );
  }

  // Good for: large datasets, immutable data, class instances,
  // data from external libraries that shouldn't be proxied
  let config = $state.raw({
    apiUrl: 'https://api.example.com',
    timeout: 5000
  });
</script>
```

**When to use `$state.raw` vs `$state`:**
- Use `$state` (default) for most UI state — forms, toggles, user data
- Use `$state.raw` for large lists (1000+ items), immutable data patterns, class instances, external library objects, or when you explicitly want React-like immutable update semantics

### 2.3 `$derived` — Computed Values

`$derived` creates values that automatically recalculate when their dependencies change. It replaces Svelte 4's `$: derived = ...` reactive declarations.

```svelte
<script lang="ts">
  let count = $state(0);
  let items = $state([1, 2, 3, 4, 5]);
  let searchQuery = $state('');
  let users = $state([
    { name: 'Alice', age: 30, active: true },
    { name: 'Bob', age: 25, active: false },
    { name: 'Charlie', age: 35, active: true }
  ]);

  // Simple derived values — expression form
  let doubled = $derived(count * 2);
  let isPositive = $derived(count > 0);
  let total = $derived(items.reduce((sum, n) => sum + n, 0));

  // Complex derived values — use $derived.by() for multi-line logic
  let filteredUsers = $derived.by(() => {
    const query = searchQuery.toLowerCase();
    return users
      .filter(u => u.active)
      .filter(u => u.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // Derived from derived — creates a dependency chain
  let activeCount = $derived(filteredUsers.length);
  let summary = $derived(`Showing ${activeCount} of ${users.length} users`);
</script>

<p>Count: {count}, Doubled: {doubled}</p>
<p>{summary}</p>

{#each filteredUsers as user}
  <p>{user.name} (age {user.age})</p>
{/each}
```

**Key properties of `$derived`:**
- Lazily evaluated — only recalculates when read AND a dependency changed
- Cached — returns same value if dependencies haven't changed
- Automatically tracked — the compiler determines dependencies from what you read
- Pure — should NOT have side effects (use `$effect` for side effects)

### 2.4 `$effect` — Side Effects

`$effect` runs code when reactive dependencies change. It replaces Svelte 4's `$: { side effects }`.

```svelte
<script lang="ts">
  let count = $state(0);
  let query = $state('');
  let theme = $state<'light' | 'dark'>('light');

  // Basic effect — runs when count changes
  $effect(() => {
    console.log('Count changed to:', count);
  });

  // Effect with cleanup — return a function to clean up
  $effect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') count = 0;
    };
    document.addEventListener('keydown', handler);

    // Cleanup: called before re-running and on unmount
    return () => {
      document.removeEventListener('keydown', handler);
    };
  });

  // Effect with DOM access (runs after DOM update)
  $effect(() => {
    document.title = `Count: ${count}`;
  });

  // Debounced search effect
  $effect(() => {
    // Reading 'query' registers it as a dependency
    const currentQuery = query;

    const timeout = setTimeout(async () => {
      if (currentQuery.length > 2) {
        const response = await fetch(`/api/search?q=${currentQuery}`);
        // ... handle response
      }
    }, 300);

    return () => clearTimeout(timeout);
  });

  // Theme effect — sync with system
  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  });
</script>
```

### 2.5 `$effect.pre` — Before DOM Update

```svelte
<script lang="ts">
  let messages = $state<string[]>([]);
  let container: HTMLDivElement;

  // $effect.pre runs BEFORE the DOM is updated
  // Useful for measuring DOM before changes, scroll position preservation
  $effect.pre(() => {
    // Check scroll position before new messages are rendered
    if (container) {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

      // After DOM updates, scroll to bottom if user was at bottom
      if (isAtBottom) {
        // Use tick or microtask to run after DOM update
        queueMicrotask(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }

    // This accesses messages to track them as a dependency
    messages;
  });
</script>

<div bind:this={container} class="chat">
  {#each messages as message}
    <p>{message}</p>
  {/each}
</div>
```

### 2.6 `$effect.root` — Manual Lifecycle Control

```typescript
// $effect.root creates an effect scope that is NOT automatically cleaned up
// You must call the returned cleanup function manually
// Useful for effects outside of components (e.g., in .ts files)

const cleanup = $effect.root(() => {
  $effect(() => {
    console.log('This effect lives until cleanup() is called');
  });

  // Can nest multiple effects
  $effect(() => {
    // ...another effect
  });
});

// Later, when you want to stop all effects:
cleanup();
```

### 2.7 `$effect.tracking` — Check If Inside Tracking Context

```svelte
<script lang="ts">
  $effect(() => {
    console.log($effect.tracking()); // true — inside a tracking context
  });

  // Outside any effect or derived:
  console.log($effect.tracking()); // false
</script>
```

### 2.8 `untrack` — Opt Out of Dependency Tracking

```svelte
<script lang="ts">
  import { untrack } from 'svelte';

  let count = $state(0);
  let logCount = $state(0);

  $effect(() => {
    // 'count' IS tracked — effect reruns when count changes
    console.log('count:', count);

    // 'logCount' is NOT tracked — reading it won't cause re-run
    console.log('log count (untracked):', untrack(() => logCount));
  });
</script>
```

### 2.9 `$props` — Component Props

`$props` replaces Svelte 4's `export let` for declaring component props.

```svelte
<!-- Button.svelte -->
<script lang="ts">
  // Destructure props with defaults
  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    onclick,        // Event handlers are just callback props in Svelte 5
    children,       // The default slot content (snippet)
    class: className = '',  // Rename reserved words
    ...restProps    // Spread remaining props (for HTML attributes)
  }: {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: import('svelte').Snippet;
    class?: string;
    [key: string]: unknown;  // Allow rest props
  } = $props();
</script>

<button
  class="btn btn-{variant} btn-{size} {className}"
  {disabled}
  {onclick}
  {...restProps}
>
  {@render children?.()}
</button>

<style>
  .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
  .btn-primary { background: #ff3e00; color: white; }
  .btn-secondary { background: #676778; color: white; }
  .btn-ghost { background: transparent; border: 1px solid #ccc; }
  .btn-sm { padding: 4px 8px; font-size: 0.875rem; }
  .btn-lg { padding: 12px 24px; font-size: 1.125rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

Usage:
```svelte
<script lang="ts">
  import Button from './Button.svelte';
</script>

<Button variant="primary" onclick={() => alert('clicked!')} aria-label="Submit">
  Click me
</Button>

<Button variant="ghost" size="sm" disabled>
  Disabled
</Button>
```

### 2.10 `$bindable` — Two-Way Binding Props

```svelte
<!-- TextInput.svelte -->
<script lang="ts">
  let {
    value = $bindable(''),  // This prop supports bind:
    placeholder = '',
    oninput
  }: {
    value?: string;
    placeholder?: string;
    oninput?: (e: Event) => void;
  } = $props();
</script>

<input
  bind:value
  {placeholder}
  {oninput}
/>
```

Usage:
```svelte
<script lang="ts">
  import TextInput from './TextInput.svelte';
  let name = $state('');
</script>

<!-- Two-way binding: parent's 'name' stays in sync with input's 'value' -->
<TextInput bind:value={name} placeholder="Enter your name" />
<p>Hello, {name}!</p>
```

### 2.11 `$inspect` — Debug Tool (Dev Only)

```svelte
<script lang="ts">
  let count = $state(0);
  let user = $state({ name: 'Alice', score: 100 });

  // Logs to console whenever count or user changes (development only)
  // Automatically stripped in production builds
  $inspect(count);
  $inspect(user);

  // With custom handler:
  $inspect(count).with((type, value) => {
    // type is 'init' on first run, 'update' on changes
    if (type === 'update') {
      debugger; // Break in debugger on change
    }
  });
</script>
```

---

## 3. Component Model

### 3.1 Events — Callback Props (Svelte 5)

Svelte 5 replaces `createEventDispatcher` with simple callback props:

```svelte
<!-- Svelte 4 (LEGACY — do not use in new code) -->
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  function handleClick() {
    dispatch('message', { text: 'Hello!' });
  }
</script>
<button on:click={handleClick}>Send</button>

<!-- Svelte 5 (CURRENT — use this) -->
<script lang="ts">
  let { onmessage }: {
    onmessage?: (data: { text: string }) => void;
  } = $props();

  function handleClick() {
    onmessage?.({ text: 'Hello!' });
  }
</script>
<button onclick={handleClick}>Send</button>
```

**Event handler syntax change in Svelte 5:**
```svelte
<!-- Svelte 4: on:event directive -->
<button on:click={handler}>Click</button>
<button on:click|preventDefault={handler}>Click</button>
<input on:input={handler} />

<!-- Svelte 5: standard HTML attributes (lowercase) -->
<button onclick={handler}>Click</button>
<button onclick={(e) => { e.preventDefault(); handler(e); }}>Click</button>
<input oninput={handler} />
```

### 3.2 Snippets (Svelte 5) — Replacing Slots

Snippets are Svelte 5's replacement for slots. They are reusable chunks of markup that can be passed to components or used locally.

```svelte
<!-- Card.svelte — Component that accepts snippets -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    header,
    children,  // Default snippet (replaces default slot)
    footer
  }: {
    header?: Snippet;
    children: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<div class="card">
  {#if header}
    <div class="card-header">
      {@render header()}
    </div>
  {/if}

  <div class="card-body">
    {@render children()}
  </div>

  {#if footer}
    <div class="card-footer">
      {@render footer()}
    </div>
  {/if}
</div>
```

Usage:
```svelte
<script lang="ts">
  import Card from './Card.svelte';
</script>

<Card>
  {#snippet header()}
    <h2>Card Title</h2>
  {/snippet}

  <!-- Default content becomes the 'children' snippet -->
  <p>This is the card body content.</p>

  {#snippet footer()}
    <button>Action</button>
  {/snippet}
</Card>
```

**Snippets with parameters (replaces slot props):**

```svelte
<!-- DataList.svelte -->
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  let {
    items,
    row,        // Snippet that receives each item
    empty
  }: {
    items: T[];
    row: Snippet<[T, number]>;  // Receives item and index
    empty?: Snippet;
  } = $props();
</script>

{#if items.length === 0}
  {#if empty}
    {@render empty()}
  {:else}
    <p>No items.</p>
  {/if}
{:else}
  <ul>
    {#each items as item, i}
      <li>{@render row(item, i)}</li>
    {/each}
  </ul>
{/if}
```

Usage:
```svelte
<script lang="ts">
  import DataList from './DataList.svelte';

  let users = $state([
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' }
  ]);
</script>

<DataList items={users}>
  {#snippet row(user, index)}
    <span>{index + 1}. {user.name} — {user.email}</span>
  {/snippet}

  {#snippet empty()}
    <p>No users found. Try a different search.</p>
  {/snippet}
</DataList>
```

**Local snippets for reusable markup within a component:**

```svelte
<script lang="ts">
  let users = $state([
    { name: 'Alice', role: 'admin', avatar: '/alice.jpg' },
    { name: 'Bob', role: 'user', avatar: '/bob.jpg' }
  ]);
</script>

<!-- Define a local reusable snippet -->
{#snippet userBadge(user)}
  <div class="badge">
    <img src={user.avatar} alt={user.name} />
    <span>{user.name}</span>
    <span class="role">{user.role}</span>
  </div>
{/snippet}

<!-- Use it multiple times -->
<div class="sidebar">
  {#each users.filter(u => u.role === 'admin') as user}
    {@render userBadge(user)}
  {/each}
</div>

<div class="main">
  {#each users as user}
    {@render userBadge(user)}
  {/each}
</div>
```

### 3.3 Template Logic Blocks

```svelte
<script lang="ts">
  let count = $state(0);
  let items = $state(['Apple', 'Banana', 'Cherry']);
  let promise = $state(fetch('/api/data').then(r => r.json()));
  let condition = $state<'a' | 'b' | 'c'>('a');
</script>

<!-- IF / ELSE IF / ELSE -->
{#if count > 10}
  <p>Count is big!</p>
{:else if count > 5}
  <p>Count is medium</p>
{:else}
  <p>Count is small ({count})</p>
{/if}

<!-- EACH with index and key -->
{#each items as item, index (item)}
  <p>{index}: {item}</p>
{:else}
  <p>No items.</p>
{/each}

<!-- EACH with destructuring -->
{#each todos as { id, text, done } (id)}
  <label>
    <input type="checkbox" checked={done} />
    {text}
  </label>
{/each}

<!-- AWAIT for promises -->
{#await promise}
  <p>Loading...</p>
{:then data}
  <p>Data: {JSON.stringify(data)}</p>
{:catch error}
  <p>Error: {error.message}</p>
{/await}

<!-- Short form: no loading state -->
{#await promise then data}
  <p>{data}</p>
{/await}

<!-- KEY block: destroys and recreates content when value changes -->
{#key condition}
  <ComponentThatNeedsReset value={condition} />
{/key}
```

### 3.4 Component Composition Patterns

```svelte
<!-- Forwarding all props (spread) -->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let { children, class: className = '', ...rest }: HTMLButtonAttributes & {
    children: import('svelte').Snippet;
  } = $props();
</script>

<button class="custom-btn {className}" {...rest}>
  {@render children?.()}
</button>
```

```svelte
<!-- Generic component with TypeScript generics -->
<script lang="ts" generics="T extends { id: string | number }">
  import type { Snippet } from 'svelte';

  let {
    items,
    selected = $bindable<T | null>(null),
    renderItem
  }: {
    items: T[];
    selected?: T | null;
    renderItem: Snippet<[T]>;
  } = $props();
</script>

<ul>
  {#each items as item (item.id)}
    <li
      class:selected={selected?.id === item.id}
      onclick={() => selected = item}
    >
      {@render renderItem(item)}
    </li>
  {/each}
</ul>
```

---

## 4. Svelte 5 Reactivity Deep Dive

```
          SVELTE 5 REACTIVITY MODEL (Signal-based)

  ┌──────────────────────────────────────────────────────┐
  │                    COMPILE TIME                       │
  │                                                      │
  │  The compiler transforms runes into signals:         │
  │                                                      │
  │  let count = $state(0)                               │
  │       ↓ compiles to ↓                                │
  │  let count = source(0)   // internal signal          │
  │                                                      │
  │  let doubled = $derived(count * 2)                   │
  │       ↓ compiles to ↓                                │
  │  let doubled = derived(() => get(count) * 2)         │
  │                                                      │
  └──────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │                    RUNTIME                            │
  │                                                      │
  │  Signal Graph:                                       │
  │                                                      │
  │  $state(count) ──→ $derived(doubled) ──→ DOM text    │
  │       │                                              │
  │       └──→ $effect(log) ──→ console.log              │
  │       │                                              │
  │       └──→ $derived(isPositive) ──→ DOM class        │
  │                                                      │
  │  When count changes:                                 │
  │  1. Signal notifies dependents                       │
  │  2. Derived values recompute (lazily, if read)       │
  │  3. Effects are scheduled                            │
  │  4. DOM updates applied (batched, microtask)         │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### 4.1 Deep Reactivity with Proxies

```svelte
<script lang="ts">
  // $state wraps objects/arrays in Proxy for deep tracking
  let form = $state({
    user: {
      name: '',
      email: '',
      preferences: {
        theme: 'light',
        notifications: true
      }
    },
    errors: {} as Record<string, string>
  });

  // All of these trigger reactive updates:
  function examples() {
    form.user.name = 'Alice';                         // nested property
    form.user.preferences.theme = 'dark';             // deeply nested
    form.errors = { name: 'Required' };               // replace object
    form.errors.email = 'Invalid email';              // add property
    delete form.errors.name;                          // delete property
  }

  // Arrays — all mutation methods are tracked:
  let list = $state([1, 2, 3]);

  list.push(4);        // tracked
  list.pop();          // tracked
  list.splice(1, 1);   // tracked
  list[0] = 99;        // tracked
  list.sort();          // tracked
  list.reverse();       // tracked
  list.length = 0;      // tracked (clears array)
</script>
```

### 4.2 Class-Based State with `$state`

```typescript
// counter.svelte.ts — Note the .svelte.ts extension!
// This allows runes to be used outside .svelte files

export class Counter {
  count = $state(0);                          // reactive property
  doubled = $derived(this.count * 2);         // derived property

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }

  reset() {
    this.count = 0;
  }
}

// TodoStore.svelte.ts — More complex example
export class TodoStore {
  todos = $state<Array<{ id: number; text: string; done: boolean }>>([]);
  filter = $state<'all' | 'active' | 'completed'>('all');

  filtered = $derived.by(() => {
    switch (this.filter) {
      case 'active': return this.todos.filter(t => !t.done);
      case 'completed': return this.todos.filter(t => t.done);
      default: return this.todos;
    }
  });

  remaining = $derived(this.todos.filter(t => !t.done).length);

  add(text: string) {
    this.todos.push({ id: Date.now(), text, done: false });
  }

  toggle(id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
  }

  remove(id: number) {
    const index = this.todos.findIndex(t => t.id === id);
    if (index !== -1) this.todos.splice(index, 1);
  }

  clearCompleted() {
    // Filter returns a new array; reassign to trigger update
    this.todos = this.todos.filter(t => !t.done);
  }
}
```

Usage in a component:
```svelte
<script lang="ts">
  import { TodoStore } from './TodoStore.svelte.ts';

  const store = new TodoStore();
  let newTodo = $state('');
</script>

<input bind:value={newTodo}
  onkeydown={(e) => {
    if (e.key === 'Enter' && newTodo.trim()) {
      store.add(newTodo.trim());
      newTodo = '';
    }
  }}
/>

<p>{store.remaining} remaining</p>

<select bind:value={store.filter}>
  <option value="all">All</option>
  <option value="active">Active</option>
  <option value="completed">Completed</option>
</select>

{#each store.filtered as todo (todo.id)}
  <label>
    <input type="checkbox" checked={todo.done} onchange={() => store.toggle(todo.id)} />
    <span class:done={todo.done}>{todo.text}</span>
    <button onclick={() => store.remove(todo.id)}>x</button>
  </label>
{/each}
```

### 4.3 Shared / Global State Patterns

```typescript
// shared-state.svelte.ts
// Module-level state: created once, shared across all importers

// Simple shared counter
export const appState = $state({
  user: null as { name: string; role: string } | null,
  theme: 'light' as 'light' | 'dark',
  sidebarOpen: true
});

// Function-based (factory pattern for testing)
export function createAuthStore() {
  let user = $state<{ id: string; name: string } | null>(null);
  let loading = $state(false);

  const isAuthenticated = $derived(user !== null);

  async function login(email: string, password: string) {
    loading = true;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      user = await res.json();
    } finally {
      loading = false;
    }
  }

  function logout() {
    user = null;
  }

  return {
    get user() { return user; },
    get loading() { return loading; },
    get isAuthenticated() { return isAuthenticated; },
    login,
    logout
  };
}

// Singleton instance
export const auth = createAuthStore();
```

---

## 5. Stores (Legacy — Still Supported)

Svelte stores predate runes and remain fully supported. They implement a simple contract: any object with a `subscribe` method that returns an unsubscribe function.

```typescript
// Svelte store contract:
interface Store<T> {
  subscribe(callback: (value: T) => void): () => void;
}

// Writable stores also have set and update:
interface Writable<T> extends Store<T> {
  set(value: T): void;
  update(fn: (value: T) => T): void;
}
```

### 5.1 Built-in Stores

```typescript
import { writable, readable, derived, get } from 'svelte/store';

// WRITABLE — read/write reactive value
const count = writable(0);
count.set(5);
count.update(n => n + 1);

// READABLE — read-only from outside, value set internally
const time = readable(new Date(), (set) => {
  const interval = setInterval(() => set(new Date()), 1000);
  return () => clearInterval(interval); // cleanup
});

// DERIVED — computed from other stores
const doubled = derived(count, $count => $count * 2);

// Derived from multiple stores
const combined = derived(
  [count, time],
  ([$count, $time]) => `Count: ${$count} at ${$time.toLocaleTimeString()}`
);

// GET — read store value synchronously (outside components)
const currentCount = get(count); // 6
```

### 5.2 Auto-Subscription with $ Prefix

```svelte
<script>
  import { count } from './stores.js';

  // $count auto-subscribes and auto-unsubscribes
  // This is syntactic sugar — the compiler generates subscribe/unsubscribe
</script>

<p>Count: {$count}</p>
<button on:click={() => $count++}>Increment</button>
<!-- $count++ is equivalent to count.update(n => n + 1) -->
```

### 5.3 Custom Stores

```typescript
// Custom store: writable with domain logic
import { writable, derived } from 'svelte/store';

function createTodoStore() {
  const { subscribe, set, update } = writable<Todo[]>([]);

  return {
    subscribe, // Required — makes it a valid store
    add: (text: string) => update(todos => [
      ...todos,
      { id: Date.now(), text, done: false }
    ]),
    toggle: (id: number) => update(todos =>
      todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
    ),
    remove: (id: number) => update(todos =>
      todos.filter(t => t.id !== id)
    ),
    reset: () => set([])
  };
}

export const todos = createTodoStore();
```

**Stores vs Runes — When to Use Which:**
- **New Svelte 5 projects:** Use runes (`$state`, `$derived`) exclusively
- **Migrating Svelte 4 code:** Stores continue working; migrate incrementally
- **Third-party libraries:** Many still expose stores; use them as needed
- **Outside components:** Runes work in `.svelte.ts` files; stores work in any `.ts` file

---

## 6. SvelteKit — Full-Stack Framework

```
            SVELTEKIT ARCHITECTURE

  ┌──────────────────────────────────────────────┐
  │                  CLIENT                       │
  │                                              │
  │  ┌─────────────┐  ┌─────────────────────┐   │
  │  │ +page.svelte │  │ +layout.svelte      │   │
  │  │ (page UI)    │  │ (shared layout)     │   │
  │  └──────┬───────┘  └──────┬──────────────┘   │
  │         │                 │                   │
  │  ┌──────▼─────────────────▼──────────────┐   │
  │  │   Client-side Router                   │   │
  │  │   (file-system based, SPA navigation)  │   │
  │  └───────────────────────────────────────┘   │
  └──────────────────┬───────────────────────────┘
                     │ HTTP / fetch
  ┌──────────────────▼───────────────────────────┐
  │                  SERVER                       │
  │                                              │
  │  ┌──────────────────┐  ┌─────────────────┐   │
  │  │ +page.server.ts  │  │ +server.ts      │   │
  │  │ (load, actions)  │  │ (API endpoints) │   │
  │  └──────────────────┘  └─────────────────┘   │
  │                                              │
  │  ┌──────────────────────────────────────┐    │
  │  │ hooks.server.ts                       │    │
  │  │ (handle, handleError, handleFetch)    │    │
  │  └──────────────────────────────────────┘    │
  │                                              │
  │  ┌──────────────────────────────────────┐    │
  │  │ Adapter (node, vercel, cloudflare...) │    │
  │  └──────────────────────────────────────┘    │
  └──────────────────────────────────────────────┘
```

### 6.1 File-Based Routing

```
src/routes/
├── +page.svelte              → /
├── +page.server.ts           → / (server load + actions)
├── +layout.svelte            → Root layout (wraps all pages)
├── +layout.server.ts         → Root layout server load
├── +error.svelte             → Root error page
├── about/
│   └── +page.svelte          → /about
├── blog/
│   ├── +page.svelte          → /blog
│   ├── +page.server.ts       → /blog (server data)
│   └── [slug]/
│       ├── +page.svelte      → /blog/:slug
│       └── +page.server.ts   → /blog/:slug (server data)
├── api/
│   └── users/
│       └── +server.ts        → /api/users (REST endpoint)
├── (marketing)/              → Route group (no URL segment)
│   ├── +layout.svelte        → Shared layout for marketing pages
│   ├── pricing/
│   │   └── +page.svelte      → /pricing
│   └── features/
│       └── +page.svelte      → /features
└── [[lang]]/                 → Optional parameter
    └── docs/
        └── [...path]/        → Rest parameter (catch-all)
            └── +page.svelte  → /docs/*, /en/docs/*
```

**Route file conventions:**
| File | Purpose | Runs on |
|---|---|---|
| `+page.svelte` | Page component (UI) | Client + SSR |
| `+page.ts` | Universal load function | Client + Server |
| `+page.server.ts` | Server-only load + form actions | Server only |
| `+layout.svelte` | Layout component (wraps children) | Client + SSR |
| `+layout.ts` | Universal layout load | Client + Server |
| `+layout.server.ts` | Server-only layout load | Server only |
| `+server.ts` | API endpoint (GET, POST, etc.) | Server only |
| `+error.svelte` | Error boundary page | Client + SSR |

### 6.2 Load Functions

```typescript
// +page.server.ts — Server-only load function
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/database';

export const load: PageServerLoad = async ({ params, locals, url, fetch, cookies }) => {
  // Access route parameters
  const { slug } = params;

  // Check authentication (from hooks)
  if (!locals.user) {
    redirect(303, '/login');
  }

  // Query database (server-only — this code never reaches the client)
  const post = await db.post.findUnique({ where: { slug } });

  if (!post) {
    error(404, { message: 'Post not found' });
  }

  // Access query parameters
  const page = Number(url.searchParams.get('page') ?? '1');

  // Use SvelteKit's fetch (handles relative URLs, cookies forwarding)
  const comments = await fetch(`/api/posts/${post.id}/comments?page=${page}`);

  // Access/set cookies
  cookies.set('last-viewed', slug, { path: '/', maxAge: 60 * 60 * 24 });

  // Return data to the page component
  return {
    post,
    comments: await comments.json(),
    page
  };
};
```

```typescript
// +page.ts — Universal load function (runs on server AND client)
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, data, url }) => {
  // 'data' contains what +page.server.ts returned (if it exists)

  // fetch() works on both server and client
  const res = await fetch(`/api/posts/${params.slug}`);
  const post = await res.json();

  return { post };
};
```

```svelte
<!-- +page.svelte — Access load data -->
<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  // In Svelte 4 this was: export let data: PageData;
</script>

<h1>{data.post.title}</h1>
<div>{@html data.post.content}</div>

{#each data.comments as comment}
  <div class="comment">
    <strong>{comment.author}</strong>
    <p>{comment.text}</p>
  </div>
{/each}
```

### 6.3 Form Actions

```typescript
// +page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/database';

export const load: PageServerLoad = async ({ locals }) => {
  return {
    todos: await db.todo.findMany({ where: { userId: locals.user.id } })
  };
};

export const actions: Actions = {
  // Named action: called with ?/create
  create: async ({ request, locals }) => {
    const formData = await request.formData();
    const text = formData.get('text')?.toString();

    if (!text || text.length < 1) {
      return fail(400, { text, error: 'Text is required' });
    }

    if (text.length > 200) {
      return fail(400, { text, error: 'Text too long (max 200 chars)' });
    }

    await db.todo.create({
      data: { text, userId: locals.user.id }
    });

    // No explicit return = success
  },

  // Named action: called with ?/delete
  delete: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id')?.toString();

    if (!id) return fail(400, { error: 'Missing ID' });

    await db.todo.delete({
      where: { id, userId: locals.user.id }
    });
  },

  // Named action: called with ?/toggle
  toggle: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id')?.toString();

    const todo = await db.todo.findUnique({ where: { id } });
    if (!todo) return fail(404, { error: 'Not found' });

    await db.todo.update({
      where: { id },
      data: { done: !todo.done }
    });
  }
};
```

```svelte
<!-- +page.svelte — Using form actions with progressive enhancement -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<!-- use:enhance gives progressive enhancement (works without JS, enhanced with JS) -->
<form method="POST" action="?/create" use:enhance>
  <input name="text" value={form?.text ?? ''} placeholder="New todo..." />
  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
  <button type="submit">Add</button>
</form>

{#each data.todos as todo}
  <div class="todo">
    <form method="POST" action="?/toggle" use:enhance>
      <input type="hidden" name="id" value={todo.id} />
      <button type="submit" class:done={todo.done}>
        {todo.text}
      </button>
    </form>

    <form method="POST" action="?/delete" use:enhance>
      <input type="hidden" name="id" value={todo.id} />
      <button type="submit" aria-label="Delete">x</button>
    </form>
  </div>
{/each}
```

### 6.4 API Endpoints (+server.ts)

```typescript
// src/routes/api/users/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/database';

export const GET: RequestHandler = async ({ url, locals }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '20');

  const users = await db.user.findMany({
    skip: (page - 1) * limit,
    take: limit,
    select: { id: true, name: true, email: true }
  });

  return json({ users, page, limit });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    error(403, 'Forbidden');
  }

  const body = await request.json();
  const user = await db.user.create({ data: body });
  return json(user, { status: 201 });
};

// Also supports: PUT, PATCH, DELETE, HEAD, OPTIONS
export const DELETE: RequestHandler = async ({ params }) => {
  await db.user.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
};
```

### 6.5 Hooks

```typescript
// src/hooks.server.ts
import type { Handle, HandleServerError, HandleFetch } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { db } from '$lib/server/database';

// HANDLE — runs on every request, like Express middleware
const auth: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get('session');

  if (sessionId) {
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });
    if (session) {
      event.locals.user = session.user;
    }
  }

  const response = await resolve(event);
  return response;
};

const logger: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const response = await resolve(event);
  const duration = Date.now() - start;
  console.log(`${event.request.method} ${event.url.pathname} - ${response.status} (${duration}ms)`);
  return response;
};

const security: Handle = async ({ event, resolve }) => {
  const response = await resolve(event, {
    // Transform HTML to inject security headers, nonces, etc.
    transformPageChunk: ({ html }) => html.replace(
      '%sveltekit.nonce%',
      crypto.randomUUID()
    )
  });

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
};

// Compose multiple hooks with sequence()
export const handle = sequence(logger, auth, security);

// HANDLE SERVER ERROR — global error handler
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const errorId = crypto.randomUUID();
  console.error(`Error ${errorId}:`, error);

  // Report to error tracking service
  // await sentry.captureException(error, { extra: { errorId, path: event.url.pathname } });

  return {
    message: 'An unexpected error occurred',
    errorId
  };
};

// HANDLE FETCH — intercept internal fetch calls
export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  // Rewrite internal API calls to bypass network
  if (request.url.startsWith('https://api.internal.example.com/')) {
    request = new Request(
      request.url.replace('https://api.internal.example.com/', 'http://localhost:3001/'),
      request
    );
  }

  return fetch(request);
};
```

```typescript
// src/hooks.client.ts — Client-side hooks
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
  const errorId = crypto.randomUUID();
  console.error('Client error:', error);

  // Report to analytics
  // analytics.track('client_error', { errorId, path: event.url.pathname });

  return {
    message: 'Something went wrong',
    errorId
  };
};
```

### 6.6 SSR / SSG / SPA Modes

```typescript
// +page.ts or +page.server.ts — Page-level rendering config
export const prerender = true;   // SSG: pre-render at build time
export const ssr = true;         // SSR: server-render on request (default)
export const csr = true;         // CSR: hydrate + client-side navigation (default)

// Common combinations:
// ssr: true,  csr: true   → Full SSR with hydration (default)
// ssr: true,  csr: false  → SSR only, no JS on client
// ssr: false, csr: true   → SPA mode (no server rendering)
// prerender: true          → Static generation at build time

// +layout.ts — Apply to entire section
export const prerender = true; // All pages under this layout are pre-rendered
```

```typescript
// svelte.config.js — Adapter system
import adapter from '@sveltejs/adapter-auto';    // Auto-detect platform
// import adapter from '@sveltejs/adapter-node';    // Node.js server
// import adapter from '@sveltejs/adapter-vercel';  // Vercel
// import adapter from '@sveltejs/adapter-cloudflare'; // Cloudflare Pages
// import adapter from '@sveltejs/adapter-static';  // Static site

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    // Other options:
    alias: {
      '$components': 'src/lib/components',
      '$utils': 'src/lib/utils'
    },
    csrf: {
      checkOrigin: true // Enabled by default — CSRF protection
    },
    prerender: {
      handleMissingId: 'warn',
      handleHttpError: 'warn'
    }
  }
};

export default config;
```

### 6.7 SvelteKit Navigation & App Modules

```svelte
<script lang="ts">
  import { goto, invalidate, invalidateAll, beforeNavigate, afterNavigate } from '$app/navigation';
  import { page, navigating, updated } from '$app/stores';
  // In Svelte 5 with runes, use:
  // import { page } from '$app/state';

  // Programmatic navigation
  function goToProfile() {
    goto('/profile', { replaceState: true });
  }

  // Re-run load functions
  async function refresh() {
    await invalidate('app:todos');   // Invalidate specific dependency
    await invalidateAll();           // Re-run ALL load functions
  }

  // Navigation guards
  beforeNavigate(({ cancel, to, from, type }) => {
    if (hasUnsavedChanges && !confirm('Discard changes?')) {
      cancel();
    }
  });

  afterNavigate(({ from, to, type }) => {
    // Analytics, scroll restoration, etc.
    analytics.pageView(to?.url.pathname);
  });
</script>

<!-- $page store has current route info -->
<p>Current path: {$page.url.pathname}</p>
<p>Route params: {JSON.stringify($page.params)}</p>

<!-- Show loading indicator during navigation -->
{#if $navigating}
  <LoadingBar />
{/if}

<!-- Prompt user to reload if app was updated -->
{#if $updated}
  <button onclick={() => location.reload()}>
    App updated — click to reload
  </button>
{/if}
```

---

## 7. Transitions and Animations

### 7.1 Built-in Transitions

```svelte
<script lang="ts">
  import { fade, fly, slide, scale, blur, draw, crossfade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { quintOut, elasticOut } from 'svelte/easing';

  let visible = $state(true);
  let items = $state([1, 2, 3, 4, 5]);
</script>

<!-- FADE -->
{#if visible}
  <div transition:fade={{ duration: 300 }}>
    Fades in and out
  </div>
{/if}

<!-- FLY — slide from offset -->
{#if visible}
  <div transition:fly={{ y: 200, duration: 500, easing: quintOut }}>
    Flies up from below
  </div>
{/if}

<!-- Separate IN and OUT transitions -->
{#if visible}
  <div
    in:fly={{ x: -200, duration: 400 }}
    out:fade={{ duration: 200 }}
  >
    Flies in from left, fades out
  </div>
{/if}

<!-- SLIDE — accordion-like -->
{#if visible}
  <div transition:slide={{ duration: 300 }}>
    Slides open/closed
  </div>
{/if}

<!-- SCALE -->
{#if visible}
  <div transition:scale={{ start: 0.5, opacity: 0.5, duration: 300 }}>
    Scales up
  </div>
{/if}

<!-- BLUR -->
{#if visible}
  <div transition:blur={{ amount: 10, duration: 400 }}>
    Blurs in/out
  </div>
{/if}

<!-- DRAW — for SVG paths -->
<svg viewBox="0 0 100 100">
  {#if visible}
    <path
      transition:draw={{ duration: 1000, easing: quintOut }}
      d="M10 80 Q 52.5 10, 95 80 T 180 80"
      fill="none"
      stroke="black"
    />
  {/if}
</svg>
```

### 7.2 FLIP Animation (list reordering)

```svelte
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';

  let items = $state([
    { id: 1, name: 'Apple' },
    { id: 2, name: 'Banana' },
    { id: 3, name: 'Cherry' }
  ]);

  function shuffle() {
    items = items.sort(() => Math.random() - 0.5);
  }
</script>

<button onclick={shuffle}>Shuffle</button>

{#each items as item (item.id)}
  <div
    animate:flip={{ duration: 300 }}
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 200 }}
  >
    {item.name}
  </div>
{/each}
```

### 7.3 Crossfade (Paired Transitions)

```svelte
<script lang="ts">
  import { crossfade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  const [send, receive] = crossfade({
    duration: 400,
    easing: quintOut,
    fallback: (node) => fade(node, { duration: 300 })
  });

  let todos = $state([
    { id: 1, text: 'Learn Svelte', done: false },
    { id: 2, text: 'Build app', done: false },
    { id: 3, text: 'Deploy', done: true }
  ]);

  let active = $derived(todos.filter(t => !t.done));
  let completed = $derived(todos.filter(t => t.done));

  function toggle(id: number) {
    const todo = todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
  }
</script>

<div class="columns">
  <div>
    <h2>Active</h2>
    {#each active as todo (todo.id)}
      <div
        in:receive={{ key: todo.id }}
        out:send={{ key: todo.id }}
      >
        <button onclick={() => toggle(todo.id)}>{todo.text}</button>
      </div>
    {/each}
  </div>

  <div>
    <h2>Completed</h2>
    {#each completed as todo (todo.id)}
      <div
        in:receive={{ key: todo.id }}
        out:send={{ key: todo.id }}
      >
        <button onclick={() => toggle(todo.id)}>{todo.text}</button>
      </div>
    {/each}
  </div>
</div>
```

### 7.4 Custom Transitions

```typescript
// Custom transition function
function typewriter(node: HTMLElement, { speed = 1 }: { speed?: number } = {}) {
  const text = node.textContent ?? '';
  const duration = text.length / (speed * 0.01);

  return {
    duration,
    tick: (t: number) => {
      const i = Math.trunc(text.length * t);
      node.textContent = text.slice(0, i);
    }
  };
}

// CSS-based custom transition
function whoosh(node: HTMLElement, { duration = 400 }: { duration?: number } = {}) {
  const existingTransform = getComputedStyle(node).transform.replace('none', '');

  return {
    duration,
    css: (t: number, u: number) => `
      transform: ${existingTransform} scale(${t}) rotate(${u * 360}deg);
      opacity: ${t};
    `
  };
}
```

---

## 8. Styling

### 8.1 Scoped Styles

```svelte
<p class="message">This is styled</p>

<style>
  /* Scoped: only applies to THIS component's .message elements */
  .message {
    color: #ff3e00;
    font-weight: bold;
  }

  /* :global() escapes scoping */
  :global(body) {
    margin: 0;
    font-family: system-ui;
  }

  /* :global() within a scoped selector */
  .wrapper :global(a) {
    color: blue;  /* All <a> tags inside this component's .wrapper */
  }

  /* Nesting is supported (native CSS nesting) */
  .card {
    padding: 1rem;

    & .title {
      font-size: 1.5rem;
    }

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }
</style>
```

### 8.2 Class Directive Shorthand

```svelte
<script lang="ts">
  let active = $state(false);
  let disabled = $state(false);
  let status = $state<'success' | 'error' | 'pending'>('pending');
</script>

<!-- Class directive: class:name={condition} -->
<div class:active class:disabled>
  <!-- Shorthand: class:active is equivalent to class:active={active} -->
</div>

<!-- Multiple classes -->
<div
  class="btn"
  class:active={status === 'success'}
  class:error={status === 'error'}
  class:pending={status === 'pending'}
>
  Button
</div>

<!-- Dynamic class string -->
<div class="card {active ? 'card-active' : ''} {disabled ? 'card-disabled' : ''}">
  Content
</div>
```

### 8.3 CSS Custom Properties as Component Props

```svelte
<!-- Gauge.svelte -->
<div class="gauge">
  <div class="bar"></div>
</div>

<style>
  .gauge {
    width: 100%;
    height: 20px;
    background: #eee;
    border-radius: 10px;
  }
  .bar {
    height: 100%;
    width: var(--progress, 0%);
    background: var(--color, #ff3e00);
    border-radius: 10px;
    transition: width 0.3s ease;
  }
</style>
```

Usage:
```svelte
<!-- Pass CSS custom properties as component props with --name syntax -->
<Gauge --progress="75%" --color="green" />
<Gauge --progress="30%" --color="orange" />
<Gauge --progress="90%" --color="#3498db" />
```

---

## 9. Svelte 4 to Svelte 5 Migration Guide

```
          MIGRATION CHEAT SHEET: SVELTE 4 → SVELTE 5

  ┌─────────────────────────────────┬─────────────────────────────────┐
  │ SVELTE 4                        │ SVELTE 5                        │
  ├─────────────────────────────────┼─────────────────────────────────┤
  │ let count = 0;                  │ let count = $state(0);          │
  │ $: doubled = count * 2;         │ let doubled = $derived(count*2);│
  │ $: { console.log(count); }      │ $effect(() => { ... });         │
  │ export let name;                │ let { name } = $props();        │
  │ export let value; (bindable)    │ let { value = $bindable() }     │
  │                                 │   = $props();                   │
  │ <slot />                        │ {@render children()}            │
  │ <slot name="header" />          │ {@render header?.()}            │
  │ <slot name="row" {item} />      │ {@render row(item)}             │
  │ let:item (slot props)           │ {#snippet row(item)}...         │
  │ on:click={handler}              │ onclick={handler}               │
  │ on:click|preventDefault         │ onclick={(e) => {               │
  │                                 │   e.preventDefault(); ...       │
  │                                 │ }}                              │
  │ createEventDispatcher()         │ Callback props: onmessage?.()  │
  │ on:message={handler}            │ onmessage={handler}             │
  │ $$props                         │ ...rest from $props()           │
  │ $$restProps                     │ ...rest from $props()           │
  │ afterUpdate()                   │ $effect()                       │
  │ beforeUpdate()                  │ $effect.pre()                   │
  │ onMount()                       │ $effect() (mostly)              │
  │ onDestroy()                     │ $effect() return cleanup        │
  │ tick()                          │ import { tick } from 'svelte';  │
  │ <svelte:component this={C} />   │ <C /> (direct dynamic)          │
  └─────────────────────────────────┴─────────────────────────────────┘
```

### 9.1 Migration Examples

```svelte
<!-- SVELTE 4 Component -->
<script>
  import { createEventDispatcher, onMount, onDestroy, afterUpdate } from 'svelte';

  export let items = [];
  export let selected;

  const dispatch = createEventDispatcher();

  $: filtered = items.filter(i => i.active);
  $: count = filtered.length;
  $: {
    console.log('selection changed:', selected);
  }

  let interval;
  onMount(() => {
    interval = setInterval(() => { /* ... */ }, 1000);
  });
  onDestroy(() => clearInterval(interval));

  function select(item) {
    selected = item;
    dispatch('select', { item });
  }
</script>

<slot name="header" {count} />

{#each filtered as item}
  <div on:click={() => select(item)}>
    <slot name="row" {item}>
      {item.name}
    </slot>
  </div>
{/each}

<slot />

<!-- SVELTE 5 Equivalent -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    items = [],
    selected = $bindable(null),
    onselect,
    header,
    row,
    children
  }: {
    items?: Array<{ name: string; active: boolean }>;
    selected?: any;
    onselect?: (data: { item: any }) => void;
    header?: Snippet<[number]>;
    row?: Snippet<[any]>;
    children?: Snippet;
  } = $props();

  let filtered = $derived(items.filter(i => i.active));
  let count = $derived(filtered.length);

  $effect(() => {
    console.log('selection changed:', selected);
  });

  $effect(() => {
    const interval = setInterval(() => { /* ... */ }, 1000);
    return () => clearInterval(interval);
  });

  function select(item: any) {
    selected = item;
    onselect?.({ item });
  }
</script>

{@render header?.(count)}

{#each filtered as item}
  <div onclick={() => select(item)}>
    {#if row}
      {@render row(item)}
    {:else}
      {item.name}
    {/if}
  </div>
{/each}

{@render children?.()}
```

---

## 10. Best Practices

### 10.1 State Management Patterns

```svelte
<script lang="ts">
  // ✅ DO: Use $state for component-local state
  let count = $state(0);

  // ✅ DO: Use $derived for computed values (NOT $effect for deriving state)
  let doubled = $derived(count * 2);

  // ❌ DON'T: Use $effect to synchronize derived state
  // let doubled = $state(0);
  // $effect(() => { doubled = count * 2; }); // ANTI-PATTERN!

  // ✅ DO: Use $state.raw for large, immutable data
  let largeList = $state.raw(fetchedData);

  // ✅ DO: Keep effects small and focused
  $effect(() => {
    document.title = `Count: ${count}`;
  });

  // ❌ DON'T: Put unrelated concerns in one effect
  // $effect(() => {
  //   document.title = `Count: ${count}`;
  //   localStorage.setItem('theme', theme); // unrelated!
  //   analytics.track('count', count);      // unrelated!
  // });
</script>
```

### 10.2 Component Design Patterns

```svelte
<!-- ✅ DO: Type your props -->
<script lang="ts">
  interface Props {
    title: string;
    description?: string;
    variant?: 'primary' | 'secondary';
    children: import('svelte').Snippet;
  }

  let { title, description = '', variant = 'primary', children }: Props = $props();
</script>

<!-- ✅ DO: Forward rest props for flexibility -->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary';
    children: import('svelte').Snippet;
  }

  let { variant = 'primary', children, ...rest }: Props = $props();
</script>

<button class="btn-{variant}" {...rest}>
  {@render children()}
</button>
```

### 10.3 SvelteKit Data Loading Patterns

```typescript
// ✅ DO: Use +page.server.ts for sensitive data
// (database queries, API keys, private data)

// ✅ DO: Use +page.ts for data that can run on both server and client
// (public API calls, data transformations)

// ✅ DO: Use depends() for custom invalidation
export const load: PageServerLoad = async ({ depends, locals }) => {
  depends('app:todos'); // Register custom dependency
  return { todos: await db.todo.findMany({ where: { userId: locals.user.id } }) };
};
// Then: invalidate('app:todos') to re-run this load function

// ✅ DO: Return serializable data from server load functions
// ❌ DON'T: Return class instances, functions, or Dates from server loads
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **$effect for derived state** | `$effect(() => { doubled = count * 2; })` — extra renders, stale values | Use `$derived(count * 2)` — cached, synchronous, no extra render |
| **Infinite effect loops** | Two effects that read and write each other's state | Restructure to use `$derived` or single source of truth |
| **Mutating $state.raw deeply** | `items[0].name = 'b'` silently does nothing with raw state | Reassign entire value: `items = items.map(...)` |
| **Missing keys in {#each}** | `{#each items as item}` — animation glitches, incorrect DOM reuse | ALWAYS key: `{#each items as item (item.id)}` |
| **Svelte 4 event syntax in Svelte 5** | `on:click={handler}` instead of `onclick={handler}` | Use standard HTML attributes: `onclick`, `oninput`, etc. |
| **Svelte 4 reactivity in Svelte 5** | `$:`, `export let`, `createEventDispatcher` in runes mode | Migrate to `$state`, `$derived`, `$props`, callback props |
| **$effect without cleanup** | Memory leaks from event listeners, timers, subscriptions | Return cleanup function: `$effect(() => { ... return () => cleanup(); })` |
| **Global state in plain .ts files** | `$state` not reactive in non-Svelte modules | Use `.svelte.ts` extension for module-level reactive state |
| **Not using SvelteKit for production** | Manual SSR, no code splitting, no routing, no form actions | ALWAYS use SvelteKit for production applications |
| **Deep $state for large datasets** | Slow updates with 10,000+ items (deep Proxy tracking) | Use `$state.raw()` with immutable update patterns |
| **Fetching data in components** | Race conditions, no SSR, loading waterfalls | Use SvelteKit load functions (`+page.server.ts`, `+page.ts`) |
| **Missing `use:enhance` on forms** | Full page reload on every form submission | Add `use:enhance` for progressive enhancement |

---

## 12. When to Choose Svelte

### Strengths
- **Performance:** Fastest initial load and smallest bundles of any major framework
- **Developer Experience:** Minimal boilerplate, intuitive reactivity, less code to write
- **Compilation:** No runtime overhead, tree-shakeable, generates optimized vanilla JS
- **Built-in features:** Transitions, animations, scoped CSS, accessibility warnings
- **SvelteKit:** Excellent full-stack framework with SSR, SSG, SPA, form actions
- **Learning curve:** Closest to vanilla HTML/CSS/JS; easier for newcomers
- **TypeScript:** First-class TypeScript support with strong type inference

### Weaknesses
- **Ecosystem:** Smaller than React; fewer component libraries, less third-party tooling
- **Job market:** Significantly fewer job postings compared to React, Vue, or Angular
- **Enterprise adoption:** Less enterprise presence; fewer large-company case studies
- **Community size:** Smaller community means fewer Stack Overflow answers, tutorials
- **AI training data:** Less Svelte code in LLM training sets = less reliable AI assistance
- **Breaking changes:** Svelte 5 runes are a significant paradigm shift from Svelte 4

### Ideal Use Cases
- Performance-critical applications (e-commerce, dashboards, data visualization)
- Small teams that value developer productivity
- Content-heavy sites (blogs, docs, marketing) with SvelteKit's SSG
- Embedded widgets where bundle size matters
- Projects where developer happiness is prioritized
- Internal tools and prototypes (fast development cycle)

### Avoid When
- You need a massive ecosystem of pre-built components (choose React)
- Hiring is a primary concern (choose React or TypeScript + Angular)
- Enterprise compliance requires well-established, corporate-backed frameworks
- You need React Native / mobile story (Svelte has no official mobile solution)
- Your team has deep React/Angular expertise with no time to retrain

---

## 13. Enforcement Checklist

### Svelte 5 Runes
- [ ] ALL new code uses runes (`$state`, `$derived`, `$effect`, `$props`)
- [ ] NO Svelte 4 syntax (`$:`, `export let`, `createEventDispatcher`, `on:event`) in new files
- [ ] `$state.raw()` used for arrays/objects with 1000+ items
- [ ] `$derived` used for ALL computed values (never `$effect` for derived state)
- [ ] `$effect` cleanup functions returned for subscriptions, timers, event listeners
- [ ] `$inspect` used only in development (auto-stripped in prod)

### Component Design
- [ ] Snippets used instead of slots for content projection
- [ ] `{#each}` blocks have unique keys from data (not index)
- [ ] Generic components use `generics="T"` in script tag
- [ ] Props typed via interface or inline type annotation
- [ ] Callback props used for child-to-parent communication (not dispatch)
- [ ] Rest props spread for HTML attribute forwarding

### SvelteKit
- [ ] ALL routes use load functions for data (not fetch in components)
- [ ] Sensitive data loaded in `+page.server.ts` (not `+page.ts`)
- [ ] Forms use `method="POST"` with `use:enhance` for progressive enhancement
- [ ] `hooks.server.ts` handles authentication and security headers
- [ ] Page options configured per route (`ssr`, `csr`, `prerender`)
- [ ] Adapter configured for deployment target

### Styling
- [ ] Component styles scoped by default (no accidental global leakage)
- [ ] `:global()` used sparingly and only when necessary
- [ ] CSS custom properties used for component theming
- [ ] Class directives used for conditional classes (`class:active`)

### Performance
- [ ] Bundle analyzed and tree-shaking verified
- [ ] Large datasets use `$state.raw()` for shallow reactivity
- [ ] Transitions used for meaningful UI feedback (not decoration)
- [ ] Heavy components loaded with dynamic import
- [ ] SvelteKit prerender enabled for static content
