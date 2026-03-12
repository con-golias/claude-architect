# State Management Patterns — Complete Specification

> **AI Plugin Directive:** When a developer asks "what state management patterns exist?", "should I use Flux or atomic state?", "what are signals?", "how does MobX work?", "what is event-driven state?", "should I use XState?", "what is proxy-based state?", "Flux vs signals vs atoms?", or "which state management architecture should I use?", use this directive. Each pattern has specific strengths and weaknesses. NEVER recommend a pattern without understanding the problem shape. Flux is for complex coordinated state. Atomic is for fine-grained reactivity. Proxy is for mutable-feeling immutable state. Signals are for surgical DOM updates. FSMs are for state with strict transitions.

---

## 1. The Core Rule

**EVERY state management pattern is a specific solution to a specific problem. There is NO universal best pattern. Choose based on: (1) state shape complexity, (2) number of state transitions, (3) how many components consume each piece of state, (4) team familiarity, (5) framework constraints. ALWAYS match pattern to problem — NEVER force a problem into your favorite pattern.**

```
STATE MANAGEMENT PATTERN MAP
==============================

  ┌──────────────────────────────────────────────────────────────────┐
  │                     PATTERN SELECTION GUIDE                      │
  ├────────────────────┬────────────────┬────────────────────────────┤
  │  Problem Shape     │  Pattern       │  Libraries                 │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │  Centralized state │  Flux          │  Redux Toolkit, Zustand    │
  │  with many actions │                │                            │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │  Mutable-feeling   │  Proxy-based   │  Valtio, MobX              │
  │  reactive state    │                │                            │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │  Fine-grained,     │  Atomic        │  Jotai, Recoil,            │
  │  independent pieces│                │  Nanostores                │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │  Surgical DOM      │  Signal-based  │  Preact Signals, SolidJS,  │
  │  updates, perf     │                │  Angular Signals, Vue ref  │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │  Decoupled modules │  Event-driven  │  EventEmitter, mitt, RxJS  │
  │  communicating     │  (pub/sub)     │                            │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │  Complex workflows │  Finite State  │  XState, Robot, Stately    │
  │  with strict       │  Machine (FSM) │                            │
  │  transitions       │                │                            │
  └────────────────────┴────────────────┴────────────────────────────┘
```

---

## 2. Flux Pattern (Actions -> Dispatcher -> Store -> View)

### Architecture

```
FLUX ARCHITECTURE
==================

  ┌─────────┐     dispatch()     ┌────────────┐     notify     ┌──────────┐
  │  Action  │ ────────────────► │   Store     │ ────────────► │  View    │
  │ Creator  │                   │  (Reducer)  │               │(Component│
  └─────────┘                   └────────────┘               └──────────┘
       ▲                              │                           │
       │                              │ state                     │
       │                              ▼                           │
       │                        ┌────────────┐                    │
       └────────────────────────│  Selector   │◄───── subscribe ──┘
              user event        └────────────┘

  KEY PROPERTIES:
  • Unidirectional data flow — state changes are PREDICTABLE
  • Actions are plain objects — serializable, loggable, replayable
  • Single source of truth — one store (Redux) or focused stores (Zustand)
  • Immutable updates — NEVER mutate state directly (Immer abstracts this)
  • Time-travel debugging — every action creates a state snapshot
```

### Redux Toolkit (Modern Flux)

```typescript
// ============================================================
// FLUX PATTERN: Redux Toolkit implementation
// ============================================================

import { createSlice, configureStore, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// 1. DEFINE TYPES
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface TodosState {
  items: Todo[];
  filter: 'all' | 'active' | 'completed';
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

// 2. ASYNC THUNK (action creator that handles async)
const fetchTodos = createAsyncThunk(
  'todos/fetchTodos',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/todos');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()) as Todo[];
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Unknown error');
    }
  }
);

// 3. SLICE (combines reducer + action creators)
const todosSlice = createSlice({
  name: 'todos',
  initialState: {
    items: [],
    filter: 'all',
    status: 'idle',
    error: null,
  } as TodosState,
  reducers: {
    // Immer allows "mutable" syntax — it produces immutable updates
    addTodo(state, action: PayloadAction<{ title: string }>) {
      state.items.push({
        id: crypto.randomUUID(),
        title: action.payload.title,
        completed: false,
        createdAt: new Date().toISOString(),
      });
    },
    toggleTodo(state, action: PayloadAction<string>) {
      const todo = state.items.find((t) => t.id === action.payload);
      if (todo) todo.completed = !todo.completed;
    },
    removeTodo(state, action: PayloadAction<string>) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
    setFilter(state, action: PayloadAction<TodosState['filter']>) {
      state.filter = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchTodos.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

// 4. SELECTORS (derived state, memoized)
const selectFilteredTodos = (state: RootState): Todo[] => {
  const { items, filter } = state.todos;
  switch (filter) {
    case 'active':    return items.filter((t) => !t.completed);
    case 'completed': return items.filter((t) => t.completed);
    default:          return items;
  }
};

const selectTodoStats = (state: RootState) => {
  const total = state.todos.items.length;
  const completed = state.todos.items.filter((t) => t.completed).length;
  return { total, completed, active: total - completed };
};

// 5. STORE
const store = configureStore({
  reducer: { todos: todosSlice.reducer },
});
type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

// 6. COMPONENT (View in Flux)
function TodoList() {
  const dispatch = useDispatch<AppDispatch>();
  const filteredTodos = useSelector(selectFilteredTodos);
  const { status, error } = useSelector((s: RootState) => s.todos);
  const stats = useSelector(selectTodoStats);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchTodos());
  }, [status, dispatch]);

  return (
    <div>
      <h2>Todos ({stats.active} active / {stats.total} total)</h2>
      <FilterButtons
        onFilter={(f) => dispatch(todosSlice.actions.setFilter(f))}
      />
      {status === 'loading' && <Spinner />}
      {error && <ErrorMessage message={error} />}
      {filteredTodos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={() => dispatch(todosSlice.actions.toggleTodo(todo.id))}
          onRemove={() => dispatch(todosSlice.actions.removeTodo(todo.id))}
        />
      ))}
    </div>
  );
}
```

---

## 3. Proxy-Based Pattern (Valtio, MobX)

### Architecture

```
PROXY-BASED ARCHITECTURE
==========================

  ┌────────────────────────────────────────────────────────────┐
  │  JavaScript Proxy wraps state object                       │
  │                                                            │
  │  ┌──────────┐   mutate directly    ┌──────────────────┐   │
  │  │ Component │ ──────────────────► │  Proxy State     │   │
  │  │ (writes)  │                     │  state.count++   │   │
  │  └──────────┘                     │  state.name = x  │   │
  │                                    └────────┬─────────┘   │
  │                                             │              │
  │                    Proxy intercepts mutation │              │
  │                    and tracks which props    │              │
  │                    each component reads      │              │
  │                                             ▼              │
  │  ┌──────────┐   auto re-render     ┌──────────────────┐   │
  │  │ Component │ ◄────────────────── │  Change Detection│   │
  │  │ (reads)   │   only if THIS      │  (Proxy handler) │   │
  │  └──────────┘   component reads    └──────────────────┘   │
  │                  the changed prop                          │
  └────────────────────────────────────────────────────────────┘

  KEY PROPERTIES:
  • Mutable API — write state.count++ instead of setState(prev => ...)
  • Automatic tracking — proxy knows which components read which props
  • Surgical re-renders — only components reading changed props re-render
  • No selectors needed — access tracking replaces manual selectors
  • Mental model: "just mutate the object, the framework handles the rest"
```

### Valtio Implementation

```typescript
// ============================================================
// PROXY PATTERN: Valtio implementation
// ============================================================

import { proxy, useSnapshot, subscribe, derive } from 'valtio';

// 1. CREATE PROXY STATE — just a plain object wrapped in proxy()
interface AppState {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
  user: { name: string; email: string } | null;
}

const state = proxy<AppState>({
  todos: [],
  filter: 'all',
  user: null,
});

// 2. ACTIONS — just functions that mutate the proxy directly
const actions = {
  addTodo(title: string) {
    // Direct mutation — Valtio tracks this via Proxy
    state.todos.push({
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  },

  toggleTodo(id: string) {
    const todo = state.todos.find((t) => t.id === id);
    if (todo) todo.completed = !todo.completed;  // Direct mutation!
  },

  removeTodo(id: string) {
    const index = state.todos.findIndex((t) => t.id === id);
    if (index !== -1) state.todos.splice(index, 1);  // Direct mutation!
  },

  setFilter(filter: AppState['filter']) {
    state.filter = filter;  // Direct mutation!
  },

  async loadTodos() {
    const response = await fetch('/api/todos');
    state.todos = await response.json();  // Replace entire array
  },

  login(user: AppState['user']) {
    state.user = user;
  },
};

// 3. DERIVED STATE — computed values that auto-update
const derived = derive({
  filteredTodos: (get) => {
    const snap = get(state);
    switch (snap.filter) {
      case 'active':    return snap.todos.filter((t) => !t.completed);
      case 'completed': return snap.todos.filter((t) => t.completed);
      default:          return snap.todos;
    }
  },
  stats: (get) => {
    const snap = get(state);
    const total = snap.todos.length;
    const completed = snap.todos.filter((t) => t.completed).length;
    return { total, completed, active: total - completed };
  },
});

// 4. SUBSCRIBE to changes outside React
subscribe(state, () => {
  localStorage.setItem('todos', JSON.stringify(state.todos));
});

// 5. COMPONENT — useSnapshot() creates a read-only snapshot
function TodoList() {
  // useSnapshot tracks which properties this component reads
  // Re-renders ONLY when those specific properties change
  const snap = useSnapshot(state);
  const derivedSnap = useSnapshot(derived);

  return (
    <div>
      <h2>Todos ({derivedSnap.stats.active} active)</h2>
      <FilterBar
        current={snap.filter}
        onChange={actions.setFilter}
      />
      {derivedSnap.filteredTodos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={() => actions.toggleTodo(todo.id)}
          onRemove={() => actions.removeTodo(todo.id)}
        />
      ))}
      <AddTodoForm onAdd={actions.addTodo} />
    </div>
  );
}

// This component ONLY re-renders when user changes — NOT when todos change
function UserBadge() {
  const snap = useSnapshot(state);
  if (!snap.user) return null;
  return <span>{snap.user.name}</span>;
}
```

---

## 4. Atomic Pattern (Jotai, Recoil, Nanostores)

### Architecture

```
ATOMIC STATE ARCHITECTURE
===========================

  ┌──────────────────────────────────────────────────────────────────┐
  │  State is split into independent ATOMS (smallest possible units) │
  │                                                                  │
  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
  │  │ Atom:    │   │ Atom:    │   │ Atom:    │   │ Atom:    │     │
  │  │ theme    │   │ count    │   │ user     │   │ filter   │     │
  │  │ "dark"   │   │ 42       │   │ {name:}  │   │ "active" │     │
  │  └─────┬────┘   └─────┬────┘   └─────┬────┘   └─────┬────┘     │
  │        │              │              │              │           │
  │        │         ┌────┴────────┐     │              │           │
  │        │         │ Derived     │     │              │           │
  │        │         │ Atom:       │◄────┘              │           │
  │        │         │ filteredList│◄────────────────────┘           │
  │        │         └──────┬─────┘                                 │
  │        │                │                                       │
  │   ┌────┴──┐     ┌──────┴──────┐                                │
  │   │Comp A │     │  Comp B     │  ◄── Only subscribes to       │
  │   │reads  │     │  reads      │      filteredList atom         │
  │   │theme  │     │  filteredLst│      Re-renders ONLY when     │
  │   └───────┘     └─────────────┘      that atom changes        │
  └──────────────────────────────────────────────────────────────────┘

  KEY PROPERTIES:
  • Bottom-up — define atoms individually, compose into derived atoms
  • No single store — atoms are independent reactive units
  • Surgical re-renders — component subscribes to specific atoms only
  • Composable — derived atoms combine multiple atoms automatically
  • Code-splitting friendly — atoms can be defined in any module
  • React Suspense integration — async atoms trigger Suspense boundaries
```

### Jotai Implementation

```typescript
// ============================================================
// ATOMIC PATTERN: Jotai implementation
// ============================================================

import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// 1. PRIMITIVE ATOMS — smallest units of state
const todosAtom = atom<Todo[]>([]);
const filterAtom = atom<'all' | 'active' | 'completed'>('all');

// Persistent atom — survives page refresh (localStorage)
const themeAtom = atomWithStorage<'light' | 'dark'>('theme', 'light');

// 2. DERIVED ATOMS (read-only) — computed from other atoms
const filteredTodosAtom = atom((get) => {
  const todos = get(todosAtom);
  const filter = get(filterAtom);
  switch (filter) {
    case 'active':    return todos.filter((t) => !t.completed);
    case 'completed': return todos.filter((t) => t.completed);
    default:          return todos;
  }
});

const todoStatsAtom = atom((get) => {
  const todos = get(todosAtom);
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  return { total, completed, active: total - completed };
});

// 3. WRITE-ONLY ATOMS (actions) — encapsulate state updates
const addTodoAtom = atom(null, (get, set, title: string) => {
  const newTodo: Todo = {
    id: crypto.randomUUID(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  set(todosAtom, [...get(todosAtom), newTodo]);
});

const toggleTodoAtom = atom(null, (get, set, id: string) => {
  set(
    todosAtom,
    get(todosAtom).map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    )
  );
});

const removeTodoAtom = atom(null, (get, set, id: string) => {
  set(
    todosAtom,
    get(todosAtom).filter((t) => t.id !== id)
  );
});

// 4. ASYNC ATOMS — Suspense-compatible data fetching
const fetchTodosAtom = atom(async () => {
  const response = await fetch('/api/todos');
  if (!response.ok) throw new Error('Failed to fetch todos');
  return (await response.json()) as Todo[];
});

// 5. COMPONENTS — subscribe to specific atoms
function TodoList() {
  const filteredTodos = useAtomValue(filteredTodosAtom);  // Read-only
  const stats = useAtomValue(todoStatsAtom);              // Read-only
  const toggleTodo = useSetAtom(toggleTodoAtom);          // Write-only
  const removeTodo = useSetAtom(removeTodoAtom);          // Write-only

  return (
    <div>
      <h2>Todos ({stats.active} active / {stats.total} total)</h2>
      {filteredTodos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={() => toggleTodo(todo.id)}
          onRemove={() => removeTodo(todo.id)}
        />
      ))}
    </div>
  );
}

// This component ONLY re-renders when filter changes
function FilterBar() {
  const [filter, setFilter] = useAtom(filterAtom);

  return (
    <div role="radiogroup">
      {(['all', 'active', 'completed'] as const).map((f) => (
        <Button
          key={f}
          variant={filter === f ? 'default' : 'outline'}
          onClick={() => setFilter(f)}
        >
          {f}
        </Button>
      ))}
    </div>
  );
}

// This component ONLY re-renders when theme changes
function ThemeToggle() {
  const [theme, setTheme] = useAtom(themeAtom);
  return (
    <Button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
    </Button>
  );
}
```

---

## 5. Signal-Based Pattern (Preact Signals, SolidJS, Angular Signals, Vue ref)

### Architecture

```
SIGNAL-BASED ARCHITECTURE
===========================

  ┌──────────────────────────────────────────────────────────────────┐
  │  Signals are reactive primitives with AUTOMATIC dependency      │
  │  tracking. They update the DOM DIRECTLY — no Virtual DOM diff.  │
  │                                                                  │
  │  ┌─────────────────┐         ┌──────────────────┐               │
  │  │  Signal          │         │  Computed          │             │
  │  │  count = signal(0)│────────►│  doubled = computed│             │
  │  │                   │         │  (() => count * 2) │             │
  │  └────────┬──────────┘         └────────┬───────────┘             │
  │           │                             │                        │
  │           │  .value changed             │  auto-recomputed       │
  │           │                             │                        │
  │           ▼                             ▼                        │
  │  ┌────────────────────────────────────────────────────┐          │
  │  │         DOM Update (SURGICAL — no VDOM diff)        │          │
  │  │         Only the TEXT NODE containing the signal     │          │
  │  │         value is updated, not the entire component   │          │
  │  └────────────────────────────────────────────────────┘          │
  └──────────────────────────────────────────────────────────────────┘

  KEY PROPERTIES:
  • No Virtual DOM — signals update DOM nodes directly
  • Zero re-renders — component function runs ONCE, signals handle updates
  • Automatic dependency graph — computed() auto-tracks which signals it reads
  • Synchronous updates — no batching needed, immediate consistency
  • Framework-agnostic core — same concept across Preact, Solid, Angular, Vue
```

### Preact Signals in React

```typescript
// ============================================================
// SIGNAL PATTERN: @preact/signals-react implementation
// ============================================================

import { signal, computed, effect, batch } from '@preact/signals-react';

// 1. SIGNALS — reactive values
const count = signal(0);
const name = signal('World');
const todos = signal<Todo[]>([]);
const filter = signal<'all' | 'active' | 'completed'>('all');

// 2. COMPUTED — derived signals, auto-tracked dependencies
const doubleCount = computed(() => count.value * 2);

const filteredTodos = computed(() => {
  switch (filter.value) {
    case 'active':    return todos.value.filter((t) => !t.completed);
    case 'completed': return todos.value.filter((t) => t.completed);
    default:          return todos.value;
  }
});

const todoStats = computed(() => {
  const items = todos.value;
  const total = items.length;
  const completed = items.filter((t) => t.completed).length;
  return { total, completed, active: total - completed };
});

// 3. EFFECTS — side effects that run when dependencies change
effect(() => {
  document.title = `Todos (${todoStats.value.active} active)`;
});

effect(() => {
  localStorage.setItem('todos', JSON.stringify(todos.value));
});

// 4. ACTIONS — modify signal values
function addTodo(title: string) {
  // batch() groups multiple signal updates into one
  batch(() => {
    todos.value = [
      ...todos.value,
      {
        id: crypto.randomUUID(),
        title,
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];
  });
}

function toggleTodo(id: string) {
  todos.value = todos.value.map((t) =>
    t.id === id ? { ...t, completed: !t.completed } : t
  );
}

// 5. COMPONENT — signals in JSX update DOM directly
//    The component function runs ONCE. Signal changes update
//    only the specific DOM text nodes.
function Counter() {
  return (
    <div>
      {/* count.value in JSX — this text node updates automatically */}
      <p>Count: {count}</p>
      <p>Double: {doubleCount}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}

function TodoList() {
  return (
    <div>
      <h2>Todos ({todoStats.value.active} active)</h2>
      {filteredTodos.value.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={() => toggleTodo(todo.id)}
        />
      ))}
    </div>
  );
}
```

### Vue Composition API (ref/reactive — Vue's Signal Implementation)

```typescript
// ============================================================
// SIGNAL PATTERN: Vue 3 Composition API (ref/reactive)
// ============================================================

// Vue's ref() and reactive() ARE signals — same concept, different name
import { ref, reactive, computed, watch, watchEffect } from 'vue';

// setup() — runs once, returns reactive references
export default {
  setup() {
    // ref() = signal for primitives
    const count = ref(0);
    const filter = ref<'all' | 'active' | 'completed'>('all');

    // reactive() = signal for objects (deep reactivity via Proxy)
    const todos = reactive<Todo[]>([]);

    // computed() = derived signal
    const filteredTodos = computed(() => {
      switch (filter.value) {
        case 'active':    return todos.filter((t) => !t.completed);
        case 'completed': return todos.filter((t) => t.completed);
        default:          return [...todos];
      }
    });

    // watch = effect with explicit dependencies
    watch(todos, (newTodos) => {
      localStorage.setItem('todos', JSON.stringify(newTodos));
    }, { deep: true });

    // watchEffect = effect with auto-tracked dependencies
    watchEffect(() => {
      document.title = `Count: ${count.value}`;
    });

    function addTodo(title: string) {
      todos.push({
        id: crypto.randomUUID(),
        title,
        completed: false,
        createdAt: new Date().toISOString(),
      });
    }

    return { count, filter, filteredTodos, addTodo };
  },
};
```

---

## 6. Event-Driven Pattern (Pub/Sub, Event Bus)

### Architecture

```
EVENT-DRIVEN ARCHITECTURE
===========================

  ┌───────────┐                      ┌───────────┐
  │ Module A   │                      │ Module B   │
  │ (Publisher) │──── emit('event') ──►│(Subscriber)│
  └───────────┘         │            └───────────┘
                        │
                        │            ┌───────────┐
                        └───────────►│ Module C   │
                                     │(Subscriber)│
                                     └───────────┘

  • Modules are DECOUPLED — publisher doesn't know who listens
  • Loose coupling — modules communicate via events, not imports
  • One-to-many — one event can trigger multiple handlers
  • DANGER: Hard to debug, no type safety without wrappers, memory leaks
```

### Type-Safe Event Bus

```typescript
// ============================================================
// EVENT-DRIVEN PATTERN: Type-safe event bus
// ============================================================

// 1. DEFINE EVENT MAP — all events and their payloads
interface EventMap {
  'auth:login': { user: User; token: string };
  'auth:logout': undefined;
  'cart:add': { productId: string; quantity: number };
  'cart:remove': { productId: string };
  'cart:clear': undefined;
  'notification:show': { message: string; type: 'success' | 'error' | 'info' };
  'notification:dismiss': { id: string };
  'theme:change': { theme: 'light' | 'dark' };
}

// 2. TYPE-SAFE EVENT BUS
type EventHandler<T> = (payload: T) => void;

class TypedEventBus<TMap extends Record<string, unknown>> {
  private handlers = new Map<keyof TMap, Set<EventHandler<unknown>>>();

  on<K extends keyof TMap>(event: K, handler: EventHandler<TMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
    };
  }

  emit<K extends keyof TMap>(
    event: K,
    ...args: TMap[K] extends undefined ? [] : [TMap[K]]
  ): void {
    this.handlers.get(event)?.forEach((handler) => {
      handler(args[0]);
    });
  }

  off<K extends keyof TMap>(event: K): void {
    this.handlers.delete(event);
  }
}

// 3. SINGLETON INSTANCE
const eventBus = new TypedEventBus<EventMap>();

// 4. REACT HOOK — auto-cleanup on unmount
function useEventBus<K extends keyof EventMap>(
  event: K,
  handler: EventHandler<EventMap[K]>
): void {
  useEffect(() => {
    const unsubscribe = eventBus.on(event, handler);
    return unsubscribe;  // Cleanup on unmount — prevents memory leaks
  }, [event, handler]);
}

// 5. USAGE IN COMPONENTS

// Publisher — emits events
function AddToCartButton({ product }: { product: Product }) {
  function handleClick() {
    eventBus.emit('cart:add', { productId: product.id, quantity: 1 });
    eventBus.emit('notification:show', {
      message: `${product.name} added to cart`,
      type: 'success',
    });
  }
  return <Button onClick={handleClick}>Add to Cart</Button>;
}

// Subscriber — listens for events
function CartBadge() {
  const [count, setCount] = useState(0);

  useEventBus('cart:add', useCallback(({ quantity }) => {
    setCount((prev) => prev + quantity);
  }, []));

  useEventBus('cart:remove', useCallback(() => {
    setCount((prev) => Math.max(0, prev - 1));
  }, []));

  useEventBus('cart:clear', useCallback(() => {
    setCount(0);
  }, []));

  return <Badge>{count}</Badge>;
}

// Notification system — subscriber
function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEventBus('notification:show', useCallback(({ message, type }) => {
    const id = crypto.randomUUID();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []));

  return (
    <>
      {children}
      <NotificationStack notifications={notifications} />
    </>
  );
}
```

---

## 7. Finite State Machine Pattern (XState)

### Architecture

```
FINITE STATE MACHINE ARCHITECTURE
====================================

  ┌──────────┐  FETCH  ┌──────────┐  RESOLVE  ┌──────────┐
  │          │────────►│          │──────────►│          │
  │   idle   │         │ loading  │           │ success  │
  │          │◄────────│          │           │          │
  └──────────┘  RESET  └─────┬────┘           └──────────┘
                             │
                             │ REJECT
                             ▼
                       ┌──────────┐
                       │          │
                       │  error   │──── RETRY ────► loading
                       │          │
                       └──────────┘

  KEY PROPERTIES:
  • EXPLICIT states — "idle", "loading", "success", "error" — NOT booleans
  • IMPOSSIBLE states are impossible — can't be loading AND error simultaneously
  • Transitions are DEFINED — you specify EXACTLY which events cause which changes
  • Guards — conditions that must be true for a transition to occur
  • Actions — side effects triggered on transitions (fire API call, show toast)
  • Hierarchical — states can have sub-states (nested machines)
  • Visualizable — state charts can be rendered as diagrams (stately.ai)
```

### XState v5 Implementation

```typescript
// ============================================================
// FSM PATTERN: XState v5 implementation
// ============================================================

import { setup, assign, fromPromise } from 'xstate';
import { useMachine } from '@xstate/react';

// 1. DEFINE THE MACHINE
interface AuthContext {
  user: User | null;
  error: string | null;
  retryCount: number;
}

type AuthEvent =
  | { type: 'LOGIN'; email: string; password: string }
  | { type: 'LOGOUT' }
  | { type: 'RETRY' }
  | { type: 'TOKEN_EXPIRED' };

const authMachine = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvent,
  },
  actors: {
    loginUser: fromPromise(
      async ({ input }: { input: { email: string; password: string } }) => {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!response.ok) throw new Error('Invalid credentials');
        return (await response.json()) as User;
      }
    ),
    refreshToken: fromPromise(async () => {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!response.ok) throw new Error('Refresh failed');
      return (await response.json()) as User;
    }),
  },
  guards: {
    canRetry: ({ context }) => context.retryCount < 3,
  },
}).createMachine({
  id: 'auth',
  initial: 'unauthenticated',
  context: {
    user: null,
    error: null,
    retryCount: 0,
  },
  states: {
    unauthenticated: {
      on: {
        LOGIN: { target: 'authenticating' },
      },
    },
    authenticating: {
      invoke: {
        src: 'loginUser',
        input: ({ event }) => {
          if (event.type !== 'LOGIN') throw new Error('Invalid event');
          return { email: event.email, password: event.password };
        },
        onDone: {
          target: 'authenticated',
          actions: assign({
            user: ({ event }) => event.output,
            error: null,
            retryCount: 0,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error ? event.error.message : 'Login failed',
            retryCount: ({ context }) => context.retryCount + 1,
          }),
        },
      },
    },
    authenticated: {
      on: {
        LOGOUT: {
          target: 'unauthenticated',
          actions: assign({ user: null, error: null, retryCount: 0 }),
        },
        TOKEN_EXPIRED: { target: 'refreshing' },
      },
    },
    refreshing: {
      invoke: {
        src: 'refreshToken',
        onDone: {
          target: 'authenticated',
          actions: assign({ user: ({ event }) => event.output }),
        },
        onError: {
          target: 'unauthenticated',
          actions: assign({ user: null, error: 'Session expired' }),
        },
      },
    },
    error: {
      on: {
        RETRY: {
          target: 'authenticating',
          guard: 'canRetry',
        },
        LOGIN: { target: 'authenticating' },
      },
    },
  },
});

// 2. USE IN COMPONENT
function LoginPage() {
  const [state, send] = useMachine(authMachine);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // State machine makes UI states EXPLICIT — no boolean juggling
  return (
    <div>
      {state.matches('unauthenticated') && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send({ type: 'LOGIN', email, password });
          }}
        >
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit">Log In</Button>
        </form>
      )}

      {state.matches('authenticating') && <Spinner>Logging in...</Spinner>}

      {state.matches('error') && (
        <div>
          <ErrorMessage message={state.context.error!} />
          {state.context.retryCount < 3 ? (
            <Button onClick={() => send({ type: 'RETRY' })}>
              Retry ({3 - state.context.retryCount} attempts left)
            </Button>
          ) : (
            <p>Too many attempts. Please try again later.</p>
          )}
        </div>
      )}

      {state.matches('authenticated') && (
        <div>
          <p>Welcome, {state.context.user!.name}!</p>
          <Button onClick={() => send({ type: 'LOGOUT' })}>Log Out</Button>
        </div>
      )}
    </div>
  );
}
```

---

## 8. Pattern Comparison Table

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬────────────────┐
│              │  Flux        │  Proxy       │  Atomic      │  Signal      │  FSM           │
│              │  (Redux/     │  (Valtio/    │  (Jotai/     │  (Preact/    │  (XState)      │
│              │   Zustand)   │   MobX)      │   Recoil)    │   Solid/Vue) │                │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  Mental      │  Dispatch    │  Mutate      │  Set atom    │  Set signal  │  Send event    │
│  model       │  action      │  object      │  value       │  .value      │  to machine    │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  Data flow   │  Uni-        │  Reactive    │  Bottom-up   │  Reactive    │  Transitions   │
│              │  directional │  graph       │  composition │  graph       │  (explicit)    │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  Update      │  Immutable   │  Mutable     │  Immutable   │  Mutable     │  Immutable     │
│  style       │  (Immer opt) │  (Proxy)     │  (set())     │  (.value=)   │  (assign)      │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  Re-render   │  Selectors   │  Auto-track  │  Per-atom    │  Surgical    │  Per-machine   │
│  granularity │  (manual)    │  (Proxy)     │  (subscribe) │  (no VDOM)   │  state change  │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  DevTools    │  Excellent   │  Good        │  Good        │  Limited     │  Stately       │
│              │  (time-      │  (proxy-     │  (jotai-     │  (varies)    │  Inspector     │
│              │   travel)    │   devtools)  │   devtools)  │              │  (visual FSM)  │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  Bundle size │  Medium      │  Small       │  Small       │  Smallest    │  Large         │
│  (core)      │  (~10-30kB)  │  (~3kB)      │  (~3kB)      │  (~1-2kB)    │  (~30-50kB)    │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  Learning    │  Medium-High │  Low         │  Low         │  Low-Medium  │  High          │
│  curve       │  (concepts)  │  (intuitive) │  (minimal)   │  (new model) │  (FSM theory)  │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  Best for    │  Large teams,│  OOP devs,   │  Fine-grained│  Perf-       │  Complex       │
│              │  complex     │  existing    │  independent │  critical    │  workflows,    │
│              │  coordinated │  mutable     │  state       │  apps, no    │  strict state  │
│              │  state       │  codebases   │  pieces      │  VDOM needed │  transitions   │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│  Avoid when  │  Simple apps │  Large teams │  Complex     │  React (no   │  Simple CRUD,  │
│              │  (overkill)  │  (implicit   │  coordinated │  native      │  few states    │
│              │              │  magic)      │  transitions │  support)    │                │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴────────────────┘
```

---

## 9. Pattern Selection Decision Tree

```
"Which state management pattern should I use?"

  How complex are the state transitions?
  │
  ├── Simple (CRUD, toggles, form fields)
  │   │
  │   ├── How many components share state?
  │   │   │
  │   │   ├── 1-3 components ──────► useState / useReducer (NO LIBRARY)
  │   │   │
  │   │   ├── Many independent pieces ─► Atomic (Jotai / Nanostores)
  │   │   │
  │   │   └── Centralized store needed ─► Zustand (simplest Flux)
  │   │
  │   └── Is performance critical?
  │       │
  │       ├── YES ──► Signals (Preact/SolidJS) or Valtio (Proxy)
  │       └── NO ───► Zustand or Jotai
  │
  ├── Moderate (async flows, dependent updates)
  │   │
  │   ├── Team prefers OOP / mutable style? ──► MobX / Valtio
  │   │
  │   ├── Team prefers functional / immutable? ─► Redux Toolkit / Zustand
  │   │
  │   └── Need code-splitting / lazy atoms? ──► Jotai / Recoil
  │
  └── Complex (strict workflows, many valid/invalid states)
      │
      ├── Auth flows, checkout wizards, multi-step processes
      │   └──► XState (Finite State Machine)
      │
      └── Real-time collaboration, CRDT, event sourcing
          └──► Event-driven (custom event bus + state machine)
```

---

## 10. Anti-Patterns Table

```
┌───────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────────┐
│  Anti-Pattern                     │  Symptom                         │  Fix                                 │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  "Redux for everything"          │  200-line reducers for a toggle. │  Use useState for local UI. Use      │
│                                   │  Boilerplate exceeds business    │  TanStack Query for server data.     │
│                                   │  logic 5:1.                      │  Redux only for complex client state.│
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Boolean state machines           │  isLoading && isError &&         │  Use union types or XState.          │
│  (multiple booleans)              │  isSuccess — impossible states   │  type Status = 'idle' | 'loading'   │
│                                   │  are possible.                   │  | 'success' | 'error'              │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Event bus without cleanup        │  Memory leaks. Handlers fire     │  ALWAYS return unsubscribe from      │
│                                   │  after component unmount.        │  useEffect. useEventBus hook.        │
│                                   │  Ghost updates to unmounted      │                                      │
│                                   │  components.                     │                                      │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Mixing patterns randomly         │  Some state in Redux, some in   │  Choose ONE primary pattern per      │
│                                   │  Context, some in Zustand, some │  app. Server state = TanStack Query. │
│                                   │  in Jotai. Nobody knows where   │  Client state = ONE library.         │
│                                   │  to find state.                  │                                      │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Proxy state passed to            │  Proxy objects fail in child     │  useSnapshot() in Valtio. Clone      │
│  non-reactive code                │  components or third-party libs. │  before passing to non-reactive code.│
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Signals in React without        │  @preact/signals-react uses      │  Prefer Jotai or Zustand in React.   │
│  understanding limitations       │  internal React hacks. Breaking  │  Signals are native in Preact,       │
│                                   │  changes across React versions.  │  SolidJS, Vue — use those instead.   │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  XState for simple CRUD           │  50-line state machine for a     │  XState is for COMPLEX workflows.    │
│                                   │  toggle button. Massive          │  Simple state = useState/Zustand.    │
│                                   │  overengineering.                │                                      │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  No selectors in Flux stores      │  Entire app re-renders when      │  ALWAYS use selectors. Zustand:      │
│                                   │  any state changes. Performance  │  useStore(s => s.count). Redux:      │
│                                   │  degrades with app growth.       │  createSelector.                     │
└───────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────────┘
```

---

## 11. Enforcement Checklist

```
STATE MANAGEMENT PATTERN REVIEW CHECKLIST
============================================

[ ] ONE primary state management library chosen for the project
[ ] Server state handled by TanStack Query / SWR — NOT the state library
[ ] Pattern matches the problem complexity (no XState for toggles, no useState for auth flows)
[ ] All store subscriptions use selectors for minimal re-renders
[ ] Event listeners / subscriptions cleaned up in useEffect return
[ ] No boolean state machines — use union types or XState for multi-state
[ ] Proxy-based state (Valtio/MobX) uses snapshots in React components
[ ] Atomic state (Jotai) uses derived atoms instead of useEffect sync
[ ] State machines (XState) have exhaustive state/event type definitions
[ ] DevTools configured for the chosen library (Redux DevTools, Jotai DevTools, etc.)
[ ] State updates are batched where the library requires it (signals: batch())
[ ] No circular dependencies between stores/atoms/signals
[ ] State library choice is documented in ADR (Architecture Decision Record)
[ ] Team has agreed on naming conventions: actions, selectors, atoms, signals
```
