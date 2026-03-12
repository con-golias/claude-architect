# State Management Patterns — Complete Specification

> **AI Plugin Directive:** When choosing a state management architecture, evaluating patterns like Flux vs Proxy vs Atomic vs Signals, or designing data flow in a frontend application, ALWAYS consult this guide. Apply the correct state management pattern based on application complexity, team size, and update frequency. This guide covers Flux/Redux pattern, Proxy pattern, Atomic pattern, Signals, Pub/Sub, and when to use each.

**Core Rule: Choose the SIMPLEST state management pattern that handles your complexity. For most applications, local state + server cache + URL state covers 90% of needs. Add a global store ONLY for the remaining 10% (auth, theme, cart). NEVER start with Redux for a new project — start with useState/useReducer and add complexity only when pain points emerge. Signals are the future direction — prefer them when available in your framework.**

---

## 1. State Management Patterns Overview

```
                    PATTERN EVOLUTION

  2014              2016            2019           2022+
  ┌──────┐        ┌──────┐       ┌──────┐       ┌──────┐
  │ Flux │   ──▶  │Redux │  ──▶  │Atomic│  ──▶  │Signal│
  │      │        │MobX  │       │Recoil│       │      │
  └──────┘        │      │       │Jotai │       └──────┘
                  └──────┘       │Zustand│
                                 └──────┘

  Complexity:  ████████░░     ██████░░░░     ████░░░░░░     ███░░░░░░░
  Boilerplate: ████████░░     ██████░░░░     ███░░░░░░░     ██░░░░░░░░
  Performance: ██████░░░░     ████████░░     ████████░░     ██████████
```

---

## 2. Flux / Redux Pattern

```
                    FLUX / REDUX ARCHITECTURE

  ┌──────┐     dispatch      ┌────────────┐     ┌───────────┐
  │ View │  ──────────────▶  │   Action    │────▶│  Reducer  │
  │      │                   │ {type, data}│     │ (pure fn) │
  └──┬───┘                   └────────────┘     └─────┬─────┘
     │                                                 │
     │  subscribe                                      │  returns
     │                                                 │  new state
     │                    ┌──────────┐                 │
     └────────────────────│  Store   │◀────────────────┘
                          │ (single) │
                          └──────────┘

  RULES:
  1. Single source of truth (one store)
  2. State is read-only (immutable updates)
  3. Changes via pure reducer functions
  4. Unidirectional data flow: View → Action → Reducer → Store → View
```

### 2.1 Redux Pattern Implementation

```typescript
// ─── Action Types ───
type TodoAction =
  | { type: 'ADD_TODO'; payload: { id: string; text: string } }
  | { type: 'TOGGLE_TODO'; payload: { id: string } }
  | { type: 'REMOVE_TODO'; payload: { id: string } }
  | { type: 'SET_FILTER'; payload: { filter: 'all' | 'active' | 'completed' } };

// ─── Reducer (Pure Function) ───
interface TodoState {
  todos: Array<{ id: string; text: string; completed: boolean }>;
  filter: 'all' | 'active' | 'completed';
}

const initialState: TodoState = { todos: [], filter: 'all' };

function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [...state.todos, { ...action.payload, completed: false }],
      };
    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.payload.id
            ? { ...todo, completed: !todo.completed }
            : todo
        ),
      };
    case 'REMOVE_TODO':
      return {
        ...state,
        todos: state.todos.filter(todo => todo.id !== action.payload.id),
      };
    case 'SET_FILTER':
      return { ...state, filter: action.payload.filter };
    default:
      return state;
  }
}

// ─── Usage with useReducer ───
function TodoApp() {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  const filteredTodos = useMemo(() => {
    switch (state.filter) {
      case 'active': return state.todos.filter(t => !t.completed);
      case 'completed': return state.todos.filter(t => t.completed);
      default: return state.todos;
    }
  }, [state.todos, state.filter]);

  return /* ... */;
}
```

### 2.2 When to Use Flux/Redux

```
  USE FLUX/REDUX WHEN:
  ├── Complex state transitions with many action types
  ├── State changes need to be auditable/debuggable (DevTools)
  ├── Time-travel debugging is valuable
  ├── Team needs strict patterns (reducer-only updates)
  ├── Large app with many developers needing predictability
  └── Undo/redo functionality required

  DO NOT USE WHEN:
  ├── Simple CRUD app (overkill)
  ├── Most state is server data (use TanStack Query)
  ├── Small team that can handle less structure
  └── Prototyping or MVP stage
```

---

## 3. Proxy Pattern (MobX, Valtio)

```
                    PROXY PATTERN

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  const state = proxy({                          │
  │    count: 0,                                    │
  │    todos: [],                                   │
  │  });                                            │
  │                                                  │
  │  // Direct mutation — proxy intercepts it        │
  │  state.count++;                                 │
  │  state.todos.push({ text: 'New todo' });        │
  │                                                  │
  │  ┌──────────┐    intercepts    ┌──────────────┐ │
  │  │ Mutation  │────────────────▶│  Proxy Layer │ │
  │  │ (direct) │                  │  - Tracks    │ │
  │  └──────────┘                  │  - Notifies  │ │
  │                                │  - Batches   │ │
  │                                └──────┬───────┘ │
  │                                       │         │
  │                                       ▼         │
  │                               ┌──────────────┐  │
  │                               │  Re-render   │  │
  │                               │  ONLY        │  │
  │                               │  subscribers │  │
  │                               │  that read   │  │
  │                               │  changed key │  │
  │                               └──────────────┘  │
  └──────────────────────────────────────────────────┘
```

### 3.1 Proxy Pattern Implementation (Valtio)

```typescript
import { proxy, useSnapshot } from 'valtio';

// ─── Store: mutable proxy object ───
const store = proxy({
  count: 0,
  todos: [] as Array<{ id: string; text: string; completed: boolean }>,
  filter: 'all' as 'all' | 'active' | 'completed',
});

// ─── Actions: direct mutations (proxy intercepts them) ───
const actions = {
  increment() {
    store.count++;  // Direct mutation! Proxy handles reactivity
  },

  addTodo(text: string) {
    store.todos.push({
      id: crypto.randomUUID(),
      text,
      completed: false,
    });
  },

  toggleTodo(id: string) {
    const todo = store.todos.find(t => t.id === id);
    if (todo) todo.completed = !todo.completed;  // Direct mutation
  },

  removeTodo(id: string) {
    const index = store.todos.findIndex(t => t.id === id);
    if (index !== -1) store.todos.splice(index, 1);
  },
};

// ─── Component: useSnapshot for reactive reads ───
function TodoList() {
  const snap = useSnapshot(store);
  // snap is an immutable snapshot — reads are tracked
  // Component re-renders ONLY when accessed properties change

  return (
    <ul>
      {snap.todos.map(todo => (
        <li key={todo.id} onClick={() => actions.toggleTodo(todo.id)}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}

function Counter() {
  const snap = useSnapshot(store);
  // Only re-renders when count changes — NOT when todos change
  return <span>{snap.count}</span>;
}
```

### 3.2 When to Use Proxy Pattern

```
  USE PROXY PATTERN WHEN:
  ├── Team prefers mutable-style API
  ├── Fine-grained reactivity needed (no selector boilerplate)
  ├── Complex nested state (proxy handles deep mutations)
  ├── Migrating from MobX
  └── Want minimal boilerplate

  DO NOT USE WHEN:
  ├── Need strict immutability guarantees
  ├── Team prefers explicit state transitions (Redux mindset)
  ├── Need time-travel debugging (harder with mutations)
  └── SSR-heavy apps (proxy serialization can be tricky)
```

---

## 4. Atomic Pattern (Jotai, Recoil)

```
                    ATOMIC STATE PATTERN

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Atoms = Individual pieces of state              │
  │  Each atom is independent                        │
  │  Components subscribe to specific atoms           │
  │                                                  │
  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │
  │  │ atom │  │ atom │  │ atom │  │ atom │        │
  │  │count │  │theme │  │user  │  │todos │        │
  │  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘        │
  │     │         │         │         │              │
  │     │    ┌────┘    ┌────┘         │              │
  │     │    │         │              │              │
  │     ▼    ▼         ▼              ▼              │
  │  ┌────┐ ┌────┐  ┌────┐        ┌────┐           │
  │  │Comp│ │Comp│  │Comp│        │Comp│           │
  │  │ A  │ │ B  │  │ C  │        │ D  │           │
  │  └────┘ └────┘  └────┘        └────┘           │
  │                                                  │
  │  Comp A subscribes to count → only re-renders    │
  │  when count changes                              │
  │                                                  │
  │  Derived atoms: computed from other atoms         │
  │  ┌──────────────────┐                            │
  │  │ derived atom     │                            │
  │  │ = fn(count, user)│ ← auto-updates when        │
  │  └──────────────────┘   dependencies change      │
  └──────────────────────────────────────────────────┘
```

### 4.1 Atomic Pattern Implementation (Jotai)

```typescript
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

// ─── Primitive Atoms ───
const countAtom = atom(0);
const filterAtom = atom<'all' | 'active' | 'completed'>('all');
const todosAtom = atom<Array<{ id: string; text: string; completed: boolean }>>([]);

// ─── Derived Atom (read-only, computed) ───
const filteredTodosAtom = atom((get) => {
  const todos = get(todosAtom);
  const filter = get(filterAtom);

  switch (filter) {
    case 'active': return todos.filter(t => !t.completed);
    case 'completed': return todos.filter(t => t.completed);
    default: return todos;
  }
});

// ─── Write-only Atom (action) ───
const addTodoAtom = atom(null, (get, set, text: string) => {
  const todos = get(todosAtom);
  set(todosAtom, [...todos, {
    id: crypto.randomUUID(),
    text,
    completed: false,
  }]);
});

const toggleTodoAtom = atom(null, (get, set, id: string) => {
  const todos = get(todosAtom);
  set(todosAtom, todos.map(todo =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  ));
});

// ─── Component Usage ───
function TodoList() {
  const filteredTodos = useAtomValue(filteredTodosAtom);
  // Re-renders ONLY when filteredTodos result changes
  return <ul>{filteredTodos.map(/* ... */)}</ul>;
}

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  // Re-renders ONLY when count changes
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

function AddTodo() {
  const addTodo = useSetAtom(addTodoAtom);
  // NEVER re-renders — only dispatches
  return <button onClick={() => addTodo('New item')}>Add</button>;
}
```

### 4.2 When to Use Atomic Pattern

```
  USE ATOMIC PATTERN WHEN:
  ├── Many independent pieces of state
  ├── Fine-grained re-render control needed
  ├── State has complex dependency graph
  ├── Bottom-up state composition (atoms compose into larger state)
  ├── Code splitting — atoms defined where used, not centrally
  └── React Suspense integration needed (Jotai supports it)

  DO NOT USE WHEN:
  ├── State is a single large object (use Zustand or Redux)
  ├── Team prefers centralized store pattern
  ├── Need middleware (logging, persistence) — less ecosystem than Redux
  └── Simple app with few pieces of global state
```

---

## 5. Signals Pattern

```
                    SIGNALS PATTERN

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  signal = reactive primitive that notifies       │
  │  when its value changes                          │
  │                                                  │
  │  ┌────────────┐                                  │
  │  │  signal(0)  │ ← Holds value                   │
  │  └──────┬─────┘                                  │
  │         │                                        │
  │         │  reads value                           │
  │         ▼                                        │
  │  ┌────────────────┐                              │
  │  │  computed()     │ ← Derived, auto-tracks       │
  │  │  = signal * 2   │   dependencies               │
  │  └──────┬─────────┘                              │
  │         │                                        │
  │         │  notifies                              │
  │         ▼                                        │
  │  ┌────────────────┐                              │
  │  │  effect()       │ ← Side effects              │
  │  │  log(computed)  │   Run when dependencies     │
  │  └────────────────┘   change                     │
  │                                                  │
  │  KEY DIFFERENCE FROM REACT STATE:                │
  │  Signals update the DOM DIRECTLY without         │
  │  re-rendering the entire component tree.         │
  │  No virtual DOM diffing needed.                  │
  └──────────────────────────────────────────────────┘
```

### 5.1 Signals in Different Frameworks

```typescript
// ─── Angular Signals (Angular 16+) ───
import { signal, computed, effect } from '@angular/core';

@Component({
  template: `
    <p>Count: {{ count() }}</p>
    <p>Double: {{ double() }}</p>
    <button (click)="increment()">+1</button>
  `,
})
export class CounterComponent {
  count = signal(0);
  double = computed(() => this.count() * 2);

  constructor() {
    effect(() => {
      console.log(`Count changed to: ${this.count()}`);
    });
  }

  increment() {
    this.count.update(c => c + 1);
    // OR: this.count.set(this.count() + 1);
  }
}

// ─── Svelte 5 Runes ($state/$derived/$effect) ───
<script>
  let count = $state(0);
  let double = $derived(count * 2);

  $effect(() => {
    console.log(`Count changed to: ${count}`);
  });

  function increment() {
    count++;  // Direct mutation — compiled to fine-grained update
  }
</script>

<p>Count: {count}</p>
<p>Double: {double}</p>
<button onclick={increment}>+1</button>

// ─── Vue 3 Reactivity (Signal-like) ───
import { ref, computed, watch } from 'vue';

const count = ref(0);                        // Like signal()
const double = computed(() => count.value * 2); // Like computed()

watch(count, (newVal) => {                   // Like effect()
  console.log(`Count changed to: ${newVal}`);
});

function increment() {
  count.value++;
}

// ─── Solid.js Signals ───
import { createSignal, createMemo, createEffect } from 'solid-js';

const [count, setCount] = createSignal(0);
const double = createMemo(() => count() * 2);

createEffect(() => {
  console.log(`Count changed to: ${count()}`);
});

function increment() {
  setCount(c => c + 1);
}

// ─── Preact Signals (works with React too via @preact/signals-react) ───
import { signal, computed, effect } from '@preact/signals';

const count = signal(0);
const double = computed(() => count.value * 2);

effect(() => {
  console.log(`Count changed to: ${count.value}`);
});

count.value++;  // Direct update
```

### 5.2 When to Use Signals

```
  USE SIGNALS WHEN:
  ├── Your framework supports them natively (Angular, Svelte, Vue, Solid)
  ├── Performance is critical (no virtual DOM overhead)
  ├── Fine-grained reactivity needed (update specific DOM nodes)
  ├── Complex derived state chains
  └── Starting a new project (signals are the future direction)

  DO NOT USE WHEN:
  ├── Using React without signal library (React model is different)
  ├── Team unfamiliar with reactive programming
  ├── Need ecosystem compatibility (Redux DevTools, middleware)
  └── Already invested in another pattern with no pain points
```

---

## 6. Pub/Sub (Event Emitter) Pattern

```
                    PUB/SUB PATTERN

  ┌──────────┐         ┌──────────────┐         ┌──────────┐
  │Publisher A│ ──emit──▶│  Event Bus   │──notify─▶│Subscriber│
  └──────────┘         │              │         │   X      │
                       │ topic: users │         └──────────┘
  ┌──────────┐         │ topic: cart  │         ┌──────────┐
  │Publisher B│ ──emit──▶│ topic: theme │──notify─▶│Subscriber│
  └──────────┘         └──────────────┘         │   Y      │
                                                └──────────┘

  Decoupled communication — publishers don't know about subscribers.
  Use for cross-cutting events, NOT for primary state management.
```

### 6.1 Type-Safe Event Bus

```typescript
// event-bus.ts — Type-safe pub/sub
type EventMap = {
  'user:login': { userId: string; email: string };
  'user:logout': undefined;
  'cart:add': { productId: string; quantity: number };
  'cart:remove': { productId: string };
  'theme:change': { theme: 'light' | 'dark' };
  'notification:show': { message: string; type: 'success' | 'error' | 'info' };
};

type EventHandler<T> = (data: T) => void;

class TypedEventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K] extends undefined ? [] : [EventMap[K]]): void {
    this.handlers.get(event)?.forEach(handler => handler(args[0]));
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }
}

export const eventBus = new TypedEventBus();

// Usage
const unsubscribe = eventBus.on('user:login', ({ userId, email }) => {
  console.log(`User logged in: ${email}`);
});

eventBus.emit('user:login', { userId: '123', email: 'test@example.com' });

// React hook wrapper
function useEvent<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>) {
  useEffect(() => {
    const unsubscribe = eventBus.on(event, handler);
    return unsubscribe;
  }, [event, handler]);
}
```

---

## 7. Pattern Comparison Matrix

| Criterion | Flux/Redux | Proxy (MobX/Valtio) | Atomic (Jotai/Recoil) | Signals | Pub/Sub |
|-----------|-----------|---------------------|----------------------|---------|---------|
| Learning curve | High | Low | Medium | Low | Low |
| Boilerplate | High | Low | Low | Minimal | Low |
| DevTools | ✅ Excellent | ✅ Good | ⚠️ Basic | ⚠️ Framework-specific | ❌ None |
| Time travel | ✅ | ❌ | ❌ | ❌ | ❌ |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bundle size | Medium | Small | Small | Tiny | Tiny |
| Re-render control | Selectors | Auto-tracking | Per-atom | Per-signal | Manual |
| Middleware | ✅ Ecosystem | Plugin-based | ⚠️ Limited | ❌ | ❌ |
| SSR support | ✅ | ⚠️ | ✅ | ✅ | N/A |
| Best for | Large teams, complex state | Mutable-style, nested state | Fine-grained React state | Framework-native reactivity | Cross-cutting events |

---

## 8. Decision Tree: Choosing a Pattern

```
  CHOOSING A STATE MANAGEMENT PATTERN:

  What kind of state?
       │
       ├── Server data (API responses)?
       │       └── TanStack Query / SWR — NOT a state management library
       │
       ├── URL state (search, filters)?
       │       └── Router/URLSearchParams — ALWAYS use URL
       │
       ├── Simple local UI state?
       │       └── useState / useReducer — NO library needed
       │
       └── Shared global state?
                │
                ├── How complex is the state?
                │       │
                │       ├── Simple (theme, auth, 3-5 values)?
                │       │       └── React Context OR Zustand (minimal setup)
                │       │
                │       ├── Medium (cart, notifications, feature flags)?
                │       │       └── Zustand (simple) or Jotai (atomic)
                │       │
                │       └── Complex (many actions, middleware, time-travel)?
                │               └── Redux Toolkit (full ecosystem)
                │
                ├── What framework?
                │       │
                │       ├── React → Zustand, Jotai, Redux Toolkit
                │       ├── Vue → Pinia (official, signal-based)
                │       ├── Angular → Signals + Services (built-in)
                │       ├── Svelte → $state runes (built-in)
                │       └── Solid → createSignal (built-in)
                │
                └── Team preference?
                        │
                        ├── Explicit updates → Flux/Redux (actions + reducers)
                        ├── Direct mutations → Proxy (Valtio, MobX)
                        ├── Bottom-up atoms → Atomic (Jotai, Recoil)
                        └── Framework native → Signals (Angular, Svelte, Vue)
```

---

## 9. Combining Patterns in Real Applications

```typescript
// Real apps use MULTIPLE patterns together

// 1. Server State → TanStack Query
const { data: products } = useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
});

// 2. URL State → useSearchParams
const [searchParams, setSearchParams] = useSearchParams();
const filter = searchParams.get('filter') || 'all';

// 3. Global UI State → Zustand
const theme = useThemeStore(state => state.theme);
const user = useAuthStore(state => state.user);

// 4. Local UI State → useState
const [isModalOpen, setIsModalOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');

// 5. Derived State → computed inline
const filteredProducts = useMemo(
  () => products?.filter(p => p.category === filter) ?? [],
  [products, filter]
);

// 6. Cross-cutting Events → Pub/Sub
useEvent('notification:show', showToast);
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Choosing pattern before understanding needs | Over-engineered from day one | Start with useState, add complexity when needed |
| Redux for everything | Massive boilerplate for simple state | Use Zustand/Jotai for simple cases, Redux only for complex |
| Mixing server + client state | Stale data, manual cache management | Server data in TanStack Query, client in store |
| Single god store | All state in one object, hard to reason about | Split by domain/feature |
| No derived state | Storing filtered/sorted copies manually | Compute from source data (useMemo, selectors) |
| Pub/Sub as primary state | No single source of truth, event spaghetti | Use Pub/Sub only for side effects, not state |
| Framework-agnostic choice | Fighting the framework's reactivity model | Use framework's native pattern (Pinia, Signals, Runes) |
| Redux middleware for everything | Actions go through 5 middleware layers | Keep middleware minimal, move logic to thunks/sagas |
| Not evaluating trade-offs | Picking based on popularity, not fit | Evaluate complexity, team, performance needs |

---

## 11. Enforcement Checklist

- [ ] State management pattern matches application complexity
- [ ] Server data uses a dedicated caching library (TanStack Query, SWR)
- [ ] URL-worthy state is stored in URL (not in client state)
- [ ] Local UI state uses `useState`/`useReducer` (not global store)
- [ ] Global state is reserved for truly shared, cross-cutting concerns
- [ ] Derived state is computed, not stored separately
- [ ] State updates are predictable (no silent mutations in Flux/Redux/Atomic)
- [ ] Framework-native patterns are preferred (Pinia for Vue, Signals for Angular)
- [ ] State management choice is documented in project architecture docs
- [ ] Team is trained on the chosen pattern's conventions
- [ ] DevTools integration is set up (Redux DevTools, Jotai DevTools)
- [ ] Pub/Sub is used only for side-effect events, not primary state
- [ ] No more than 2 state management libraries in one project
