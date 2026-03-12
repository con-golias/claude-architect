# Redux Toolkit vs Zustand vs Jotai — Complete Specification

> **AI Plugin Directive:** When a developer asks "Redux or Zustand?", "should I use Jotai?", "how do I set up Redux Toolkit?", "how do I create a Zustand store?", "what are Jotai atoms?", "how do I migrate from Redux to Zustand?", "RTK Query vs TanStack Query?", "how do I persist state?", "Zustand middleware?", "Jotai derived atoms?", or any comparison between these three libraries, use this directive. These are the THREE dominant React state management libraries. Redux Toolkit is the enterprise standard with maximum structure. Zustand is the pragmatic choice with minimal boilerplate. Jotai is the atomic choice for fine-grained reactivity. NEVER recommend raw Redux (without Toolkit) — it is deprecated in practice.

---

## 1. The Core Rule

**Choose based on your project's ACTUAL needs, not hype. Redux Toolkit for large teams needing strict conventions and time-travel debugging. Zustand for most projects — it has the best simplicity-to-power ratio. Jotai for fine-grained reactivity where each piece of state is independent. ALL THREE are production-ready. The wrong choice is using none and building a custom solution.**

```
LIBRARY SELECTION DECISION TREE
==================================

  Team size?
  │
  ├── Large (10+ devs, enterprise) ─────► Redux Toolkit
  │   WHY: Enforced patterns, strict conventions, best DevTools,
  │         extensive middleware ecosystem, entity adapters,
  │         RTK Query for server state
  │
  ├── Medium (3-10 devs, product) ──────► Zustand
  │   WHY: Minimal boilerplate, easy to learn, TypeScript-first,
  │         great middleware (persist, devtools, immer),
  │         no Provider needed, works outside React
  │
  └── Small (1-3 devs, startup) ────────► Jotai or Zustand
      │
      ├── State is mostly independent pieces? ──► Jotai
      │   (atoms for each piece, compose with derived atoms)
      │
      └── State is centralized / structured? ──► Zustand
          (single store with slices, selectors)
```

---

## 2. Architecture Comparison

```
REDUX TOOLKIT ARCHITECTURE
============================

  Component ──dispatch(action)──► Middleware ──► Reducer ──► Store
      ▲                           (thunk,       (Immer     (single
      │                            logger)       inside)    source)
      │                                                       │
      └──── useSelector(selector) ◄── subscription ───────────┘

  • Single store, multiple slices
  • Actions are serializable objects
  • Reducers are pure functions (Immer for "mutable" syntax)
  • Middleware intercepts actions (async, logging, analytics)
  • Selectors derive data from store (memoized with createSelector)


ZUSTAND ARCHITECTURE
=====================

  Component ──useStore(selector)──► Store (closure)
      ▲                              │
      │                              │ set() / get()
      │                              │
      └──── subscription (auto) ◄────┘

  • Store is a closure (hook-based API)
  • No actions/dispatch — just functions that call set()
  • No middleware required — but supports devtools, persist, immer
  • No Provider needed — store is a module-level singleton
  • Selectors are inline functions in useStore()


JOTAI ARCHITECTURE
===================

  Component ──useAtom(atom)──► Provider (atom store)
      ▲                          │
      │                          │ atom values
      │                          │
      └──── subscription ◄──────┘

  Component ──useAtomValue(derivedAtom)──► Recompute from base atoms

  • No single store — atoms are independent reactive units
  • Provider-based (optional, default provider exists)
  • Derived atoms compose base atoms (like computed properties)
  • Async atoms integrate with React Suspense
  • Write-only atoms act as "actions"
```

---

## 3. Equivalent Implementations — Todo App

### 3a. Redux Toolkit

```typescript
// ============================================================
// REDUX TOOLKIT: Complete Todo Store
// ============================================================

// src/features/todos/store/todosSlice.ts
import {
  createSlice,
  createAsyncThunk,
  createSelector,
  createEntityAdapter,
  PayloadAction,
  EntityState,
} from '@reduxjs/toolkit';

// --- Types ---
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

type Filter = 'all' | 'active' | 'completed';
type SortBy = 'createdAt' | 'priority' | 'title';

interface TodosState extends EntityState<Todo, string> {
  filter: Filter;
  sortBy: SortBy;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

// --- Entity Adapter (normalized state) ---
const todosAdapter = createEntityAdapter<Todo>({
  selectId: (todo) => todo.id,
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

// --- Async Thunks ---
export const fetchTodos = createAsyncThunk(
  'todos/fetchTodos',
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/todos');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Todo[];
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : 'Failed to fetch todos'
      );
    }
  }
);

export const createTodo = createAsyncThunk(
  'todos/createTodo',
  async (input: { title: string; priority: Todo['priority'] }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Todo;
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : 'Failed to create todo'
      );
    }
  }
);

export const deleteTodo = createAsyncThunk(
  'todos/deleteTodo',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return id;
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : 'Failed to delete todo'
      );
    }
  }
);

// --- Slice ---
const todosSlice = createSlice({
  name: 'todos',
  initialState: todosAdapter.getInitialState<Omit<TodosState, keyof EntityState<Todo, string>>>({
    filter: 'all',
    sortBy: 'createdAt',
    status: 'idle',
    error: null,
  }),
  reducers: {
    toggleTodo(state, action: PayloadAction<string>) {
      const todo = state.entities[action.payload];
      if (todo) todo.completed = !todo.completed;
    },
    setFilter(state, action: PayloadAction<Filter>) {
      state.filter = action.payload;
    },
    setSortBy(state, action: PayloadAction<SortBy>) {
      state.sortBy = action.payload;
    },
    updateTodoTitle(state, action: PayloadAction<{ id: string; title: string }>) {
      const todo = state.entities[action.payload.id];
      if (todo) todo.title = action.payload.title;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchTodos.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        state.status = 'succeeded';
        todosAdapter.setAll(state, action.payload);
      })
      .addCase(fetchTodos.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Create
      .addCase(createTodo.fulfilled, (state, action) => {
        todosAdapter.addOne(state, action.payload);
      })
      // Delete
      .addCase(deleteTodo.fulfilled, (state, action) => {
        todosAdapter.removeOne(state, action.payload);
      });
  },
});

export const { toggleTodo, setFilter, setSortBy, updateTodoTitle } = todosSlice.actions;
export default todosSlice.reducer;

// --- Selectors (MEMOIZED) ---
const todosSelectors = todosAdapter.getSelectors(
  (state: RootState) => state.todos
);

export const selectAllTodos = todosSelectors.selectAll;
export const selectTodoById = todosSelectors.selectById;

export const selectFilter = (state: RootState) => state.todos.filter;
export const selectSortBy = (state: RootState) => state.todos.sortBy;
export const selectStatus = (state: RootState) => state.todos.status;
export const selectError = (state: RootState) => state.todos.error;

export const selectFilteredTodos = createSelector(
  [selectAllTodos, selectFilter],
  (todos, filter): Todo[] => {
    switch (filter) {
      case 'active':    return todos.filter((t) => !t.completed);
      case 'completed': return todos.filter((t) => t.completed);
      default:          return todos;
    }
  }
);

export const selectSortedFilteredTodos = createSelector(
  [selectFilteredTodos, selectSortBy],
  (todos, sortBy): Todo[] => {
    return [...todos].sort((a, b) => {
      switch (sortBy) {
        case 'title':    return a.title.localeCompare(b.title);
        case 'priority': {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        }
        default: return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }
);

export const selectTodoStats = createSelector([selectAllTodos], (todos) => {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  return { total, completed, active: total - completed };
});

// --- Store Configuration ---
// src/app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import todosReducer from '../features/todos/store/todosSlice';

export const store = configureStore({
  reducer: {
    todos: todosReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore date strings in actions if needed
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// --- Typed Hooks ---
// src/app/hooks.ts
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// --- Component Usage ---
function TodoListPage() {
  const dispatch = useAppDispatch();
  const todos = useAppSelector(selectSortedFilteredTodos);
  const stats = useAppSelector(selectTodoStats);
  const status = useAppSelector(selectStatus);
  const error = useAppSelector(selectError);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchTodos());
  }, [status, dispatch]);

  return (
    <div>
      <h1>Todos ({stats.active} active)</h1>
      {status === 'loading' && <Spinner />}
      {error && <ErrorBanner message={error} />}
      <TodoFilter onFilter={(f) => dispatch(setFilter(f))} />
      <TodoSort onSort={(s) => dispatch(setSortBy(s))} />
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={() => dispatch(toggleTodo(todo.id))}
          onDelete={() => dispatch(deleteTodo(todo.id))}
        />
      ))}
      <AddTodoForm onAdd={(title, priority) => dispatch(createTodo({ title, priority }))} />
    </div>
  );
}
```

### 3b. Zustand

```typescript
// ============================================================
// ZUSTAND: Complete Todo Store (equivalent functionality)
// ============================================================

// src/features/todos/store/todosStore.ts
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// --- Types ---
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

type Filter = 'all' | 'active' | 'completed';
type SortBy = 'createdAt' | 'priority' | 'title';

interface TodosState {
  // State
  todos: Todo[];
  filter: Filter;
  sortBy: SortBy;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;

  // Actions
  fetchTodos: () => Promise<void>;
  createTodo: (title: string, priority: Todo['priority']) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleTodo: (id: string) => void;
  updateTodoTitle: (id: string, title: string) => void;
  setFilter: (filter: Filter) => void;
  setSortBy: (sortBy: SortBy) => void;
}

// --- Store (all-in-one: state + actions) ---
export const useTodosStore = create<TodosState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        todos: [],
        filter: 'all',
        sortBy: 'createdAt',
        status: 'idle',
        error: null,

        // Async actions
        fetchTodos: async () => {
          set((state) => {
            state.status = 'loading';
            state.error = null;
          });
          try {
            const res = await fetch('/api/todos');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const todos = (await res.json()) as Todo[];
            set((state) => {
              state.todos = todos;
              state.status = 'succeeded';
            });
          } catch (err) {
            set((state) => {
              state.status = 'failed';
              state.error = err instanceof Error ? err.message : 'Failed to fetch';
            });
          }
        },

        createTodo: async (title, priority) => {
          try {
            const res = await fetch('/api/todos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, priority }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const todo = (await res.json()) as Todo;
            set((state) => {
              state.todos.push(todo);  // Immer allows direct push
            });
          } catch (err) {
            set((state) => {
              state.error = err instanceof Error ? err.message : 'Failed to create';
            });
          }
        },

        deleteTodo: async (id) => {
          // Optimistic update
          const previousTodos = get().todos;
          set((state) => {
            state.todos = state.todos.filter((t) => t.id !== id);
          });
          try {
            const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          } catch {
            // Rollback on failure
            set((state) => {
              state.todos = previousTodos;
            });
          }
        },

        // Sync actions
        toggleTodo: (id) =>
          set((state) => {
            const todo = state.todos.find((t) => t.id === id);
            if (todo) todo.completed = !todo.completed;
          }),

        updateTodoTitle: (id, title) =>
          set((state) => {
            const todo = state.todos.find((t) => t.id === id);
            if (todo) todo.title = title;
          }),

        setFilter: (filter) => set({ filter }),
        setSortBy: (sortBy) => set({ sortBy }),
      })),
      {
        name: 'todos-storage',
        partialize: (state) => ({
          todos: state.todos,
          filter: state.filter,
          sortBy: state.sortBy,
        }),
      }
    ),
    { name: 'TodosStore' }  // DevTools name
  )
);

// --- Selectors (defined OUTSIDE the store for reuse and memoization) ---
export const selectFilteredTodos = (state: TodosState): Todo[] => {
  switch (state.filter) {
    case 'active':    return state.todos.filter((t) => !t.completed);
    case 'completed': return state.todos.filter((t) => t.completed);
    default:          return state.todos;
  }
};

export const selectSortedFilteredTodos = (state: TodosState): Todo[] => {
  const filtered = selectFilteredTodos(state);
  return [...filtered].sort((a, b) => {
    switch (state.sortBy) {
      case 'title':    return a.title.localeCompare(b.title);
      case 'priority': {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      default: return b.createdAt.localeCompare(a.createdAt);
    }
  });
};

export const selectTodoStats = (state: TodosState) => {
  const total = state.todos.length;
  const completed = state.todos.filter((t) => t.completed).length;
  return { total, completed, active: total - completed };
};

// --- Component Usage (NO Provider needed!) ---
function TodoListPage() {
  // Selectors — component ONLY re-renders when selected data changes
  const todos = useTodosStore(selectSortedFilteredTodos);
  const stats = useTodosStore(selectTodoStats);
  const status = useTodosStore((s) => s.status);
  const error = useTodosStore((s) => s.error);

  // Actions — stable references, never cause re-renders
  const fetchTodos = useTodosStore((s) => s.fetchTodos);
  const toggleTodo = useTodosStore((s) => s.toggleTodo);
  const deleteTodo = useTodosStore((s) => s.deleteTodo);
  const createTodo = useTodosStore((s) => s.createTodo);
  const setFilter = useTodosStore((s) => s.setFilter);
  const setSortBy = useTodosStore((s) => s.setSortBy);

  useEffect(() => {
    if (status === 'idle') fetchTodos();
  }, [status, fetchTodos]);

  return (
    <div>
      <h1>Todos ({stats.active} active)</h1>
      {status === 'loading' && <Spinner />}
      {error && <ErrorBanner message={error} />}
      <TodoFilter onFilter={setFilter} />
      <TodoSort onSort={setSortBy} />
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={() => toggleTodo(todo.id)}
          onDelete={() => deleteTodo(todo.id)}
        />
      ))}
      <AddTodoForm onAdd={createTodo} />
    </div>
  );
}

// --- Using store OUTSIDE React (e.g., in API interceptors) ---
// Zustand stores are vanilla JS — no React dependency for reads/writes
const currentTodos = useTodosStore.getState().todos;
useTodosStore.getState().toggleTodo('some-id');

// Subscribe to changes outside React
const unsubscribe = useTodosStore.subscribe(
  (state) => state.status,
  (status) => {
    if (status === 'failed') {
      analytics.track('todo_fetch_failed');
    }
  }
);
```

### 3c. Jotai

```typescript
// ============================================================
// JOTAI: Complete Todo Store (equivalent functionality)
// ============================================================

// src/features/todos/store/todoAtoms.ts
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { atomWithQuery, atomWithMutation } from 'jotai-tanstack-query';

// --- Types ---
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

type Filter = 'all' | 'active' | 'completed';
type SortBy = 'createdAt' | 'priority' | 'title';

// --- Primitive Atoms ---
const todosAtom = atom<Todo[]>([]);
const filterAtom = atomWithStorage<Filter>('todos-filter', 'all');
const sortByAtom = atomWithStorage<SortBy>('todos-sortBy', 'createdAt');
const statusAtom = atom<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
const errorAtom = atom<string | null>(null);

// --- Derived Atoms (read-only, auto-recompute) ---
const filteredTodosAtom = atom((get) => {
  const todos = get(todosAtom);
  const filter = get(filterAtom);
  switch (filter) {
    case 'active':    return todos.filter((t) => !t.completed);
    case 'completed': return todos.filter((t) => t.completed);
    default:          return todos;
  }
});

const sortedFilteredTodosAtom = atom((get) => {
  const todos = get(filteredTodosAtom);
  const sortBy = get(sortByAtom);
  return [...todos].sort((a, b) => {
    switch (sortBy) {
      case 'title':    return a.title.localeCompare(b.title);
      case 'priority': {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      default: return b.createdAt.localeCompare(a.createdAt);
    }
  });
});

const todoStatsAtom = atom((get) => {
  const todos = get(todosAtom);
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  return { total, completed, active: total - completed };
});

// --- Action Atoms (write-only) ---
const fetchTodosAtom = atom(null, async (get, set) => {
  set(statusAtom, 'loading');
  set(errorAtom, null);
  try {
    const res = await fetch('/api/todos');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const todos = (await res.json()) as Todo[];
    set(todosAtom, todos);
    set(statusAtom, 'succeeded');
  } catch (err) {
    set(statusAtom, 'failed');
    set(errorAtom, err instanceof Error ? err.message : 'Failed to fetch');
  }
});

const createTodoAtom = atom(
  null,
  async (get, set, input: { title: string; priority: Todo['priority'] }) => {
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const todo = (await res.json()) as Todo;
      set(todosAtom, (prev) => [...prev, todo]);
    } catch (err) {
      set(errorAtom, err instanceof Error ? err.message : 'Failed to create');
    }
  }
);

const deleteTodoAtom = atom(null, async (get, set, id: string) => {
  const previousTodos = get(todosAtom);
  // Optimistic update
  set(todosAtom, (prev) => prev.filter((t) => t.id !== id));
  try {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    // Rollback
    set(todosAtom, previousTodos);
  }
});

const toggleTodoAtom = atom(null, (get, set, id: string) => {
  set(todosAtom, (prev) =>
    prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
  );
});

const updateTodoTitleAtom = atom(
  null,
  (get, set, params: { id: string; title: string }) => {
    set(todosAtom, (prev) =>
      prev.map((t) =>
        t.id === params.id ? { ...t, title: params.title } : t
      )
    );
  }
);

// --- Component Usage ---
function TodoListPage() {
  const todos = useAtomValue(sortedFilteredTodosAtom);
  const stats = useAtomValue(todoStatsAtom);
  const status = useAtomValue(statusAtom);
  const error = useAtomValue(errorAtom);

  // Write-only — component does NOT subscribe to these atoms
  const fetchTodos = useSetAtom(fetchTodosAtom);
  const toggleTodo = useSetAtom(toggleTodoAtom);
  const deleteTodo = useSetAtom(deleteTodoAtom);
  const createTodo = useSetAtom(createTodoAtom);
  const setFilter = useSetAtom(filterAtom);
  const setSortBy = useSetAtom(sortByAtom);

  useEffect(() => {
    if (status === 'idle') fetchTodos();
  }, [status, fetchTodos]);

  return (
    <div>
      <h1>Todos ({stats.active} active)</h1>
      {status === 'loading' && <Spinner />}
      {error && <ErrorBanner message={error} />}
      <TodoFilter onFilter={setFilter} />
      <TodoSort onSort={setSortBy} />
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={() => toggleTodo(todo.id)}
          onDelete={() => deleteTodo(todo.id)}
        />
      ))}
      <AddTodoForm onAdd={(title, priority) => createTodo({ title, priority })} />
    </div>
  );
}

// --- Jotai + TanStack Query integration ---
// Best of both worlds: Jotai atoms + TanStack Query caching
const todosQueryAtom = atomWithQuery(() => ({
  queryKey: ['todos'],
  queryFn: async () => {
    const res = await fetch('/api/todos');
    return (await res.json()) as Todo[];
  },
  staleTime: 5 * 60 * 1000,
}));

function TodoListWithQuery() {
  const { data: todos, isLoading, isError } = useAtomValue(todosQueryAtom);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorBanner message="Failed to load" />;

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

---

## 4. Feature Comparison Table

```
┌─────────────────────────┬──────────────────┬──────────────────┬──────────────────┐
│  Feature                │  Redux Toolkit   │  Zustand         │  Jotai           │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Bundle size            │  ~11kB + react-  │  ~1.2kB          │  ~2.4kB          │
│                         │  redux ~5kB      │                  │                  │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Provider required      │  YES (mandatory) │  NO              │  Optional        │
│                         │                  │                  │  (default exists)│
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Boilerplate            │  Medium (slices  │  Minimal         │  Minimal         │
│                         │  + typed hooks)  │  (one file)      │  (atoms only)    │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  State shape            │  Centralized     │  Centralized     │  Decentralized   │
│                         │  (single store)  │  (per store)     │  (per atom)      │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Update mechanism       │  dispatch(action)│  set(partial)    │  set(value)      │
│                         │  → reducer       │  or set(fn)      │  or useSetAtom   │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Immutable updates      │  Immer (built-in)│  Immer (opt-in)  │  Manual spread   │
│                         │                  │                  │  or Immer (addon)│
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Async handling         │  createAsyncThunk│  async in actions │  Async atoms /   │
│                         │  (pending/ful/   │  (just use       │  atomWithQuery   │
│                         │   rejected)      │   async/await)   │  (Suspense)      │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Selectors              │  createSelector  │  Inline in       │  Derived atoms   │
│                         │  (reselect)      │  useStore(fn)    │  atom((get) =>)  │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Middleware              │  Rich ecosystem  │  devtools,       │  Limited         │
│                         │  (thunk, saga,   │  persist, immer, │  (utils pkg)     │
│                         │   logger, etc.)  │  subscribeWith-  │                  │
│                         │                  │  Selector        │                  │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  DevTools               │  Redux DevTools  │  Redux DevTools  │  jotai-devtools  │
│                         │  (time-travel,   │  (via middleware) │  (atom inspector)│
│                         │   action log)    │                  │                  │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Persistence            │  redux-persist   │  persist         │  atomWithStorage │
│                         │  (separate pkg)  │  middleware      │  (built-in util) │
│                         │                  │  (built-in)      │                  │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Server state           │  RTK Query       │  Use TanStack    │  atomWithQuery   │
│                         │  (built-in)      │  Query           │  (jotai-tanstack)│
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Use outside React      │  store.dispatch()│  getState() /    │  Requires store  │
│                         │  store.getState()│  setState()      │  reference       │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Re-render optimization │  Selectors +     │  Selector fn in  │  Automatic       │
│                         │  React.memo      │  useStore()      │  (per-atom)      │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  TypeScript             │  Good (some      │  Excellent       │  Excellent       │
│                         │  type ceremony)  │  (inferred)      │  (inferred)      │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Learning curve         │  Medium-High     │  Low             │  Low             │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Testing                │  Reducers are    │  getState /      │  Use custom      │
│                         │  pure functions  │  setState in     │  Provider per    │
│                         │  (easy to test)  │  tests           │  test            │
├─────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Code splitting         │  Inject reducers │  Stores are lazy │  Atoms are       │
│                         │  dynamically     │  by default      │  lazy by default │
│                         │  (complex)       │                  │                  │
└─────────────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

---

## 5. Store Design Patterns

### Zustand: Slice Pattern (Splitting Large Stores)

```typescript
// ============================================================
// ZUSTAND: Slice pattern for large applications
// ============================================================

// Each "slice" is a function that takes set/get and returns partial state

// --- Auth Slice ---
interface AuthSlice {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  logout: () => void;
}

const createAuthSlice: StateCreator<
  AppStore,     // Full store type
  [],           // Middleware types
  [],           // Middleware types
  AuthSlice     // This slice's type
> = (set) => ({
  user: null,
  isAuthenticated: false,
  login: async (credentials) => {
    const user = await api.login(credentials);
    set({ user, isAuthenticated: true });
  },
  logout: () => set({ user: null, isAuthenticated: false }),
});

// --- UI Slice ---
interface UISlice {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  sidebarOpen: true,
  theme: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
});

// --- Notification Slice ---
interface NotificationSlice {
  notifications: Notification[];
  addNotification: (msg: string, type: 'success' | 'error') => void;
  removeNotification: (id: string) => void;
}

const createNotificationSlice: StateCreator<AppStore, [], [], NotificationSlice> =
  (set) => ({
    notifications: [],
    addNotification: (message, type) =>
      set((s) => ({
        notifications: [
          ...s.notifications,
          { id: crypto.randomUUID(), message, type, createdAt: Date.now() },
        ],
      })),
    removeNotification: (id) =>
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
      })),
  });

// --- Combine Slices ---
type AppStore = AuthSlice & UISlice & NotificationSlice;

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (...a) => ({
        ...createAuthSlice(...a),
        ...createUISlice(...a),
        ...createNotificationSlice(...a),
      }),
      {
        name: 'app-storage',
        partialize: (state) => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
          // NEVER persist auth tokens in localStorage without encryption
        }),
      }
    )
  )
);
```

### Jotai: Atom Families (Dynamic Atom Creation)

```typescript
// ============================================================
// JOTAI: Atom families for dynamic/parameterized atoms
// ============================================================

import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

// Atom family creates a new atom for each unique parameter
// Perfect for entity state where each item has its own atom

const todoAtomFamily = atomFamily((id: string) =>
  atom<Todo | null>(null)
);

const todoCompletedAtomFamily = atomFamily((id: string) =>
  atom(
    (get) => get(todoAtomFamily(id))?.completed ?? false,
    (get, set, completed: boolean) => {
      const todo = get(todoAtomFamily(id));
      if (todo) {
        set(todoAtomFamily(id), { ...todo, completed });
      }
    }
  )
);

// Usage: Each TodoItem subscribes to its OWN atom
// Toggling todo #5 does NOT re-render todo #1, #2, #3, #4
function TodoItem({ id }: { id: string }) {
  const todo = useAtomValue(todoAtomFamily(id));
  const [completed, setCompleted] = useAtom(todoCompletedAtomFamily(id));

  if (!todo) return null;

  return (
    <div>
      <input
        type="checkbox"
        checked={completed}
        onChange={(e) => setCompleted(e.target.checked)}
      />
      <span>{todo.title}</span>
    </div>
  );
}
```

---

## 6. Testing Stores

```typescript
// ============================================================
// TESTING: All three libraries
// ============================================================

// --- Redux Toolkit: Test reducers as pure functions ---
import todosReducer, { addTodo, toggleTodo, selectFilteredTodos } from './todosSlice';

describe('todosSlice', () => {
  it('should add a todo', () => {
    const initial = todosReducer(undefined, { type: 'init' });
    const state = todosReducer(initial, addTodo({ title: 'Test' }));
    expect(state.entities).toHaveLength(1);
    expect(Object.values(state.entities)[0]?.title).toBe('Test');
  });

  it('should toggle a todo', () => {
    // Test reducer as a pure function — no store needed
    let state = todosReducer(undefined, { type: 'init' });
    state = todosReducer(state, addTodo({ title: 'Test' }));
    const id = Object.keys(state.entities)[0];
    state = todosReducer(state, toggleTodo(id));
    expect(state.entities[id]?.completed).toBe(true);
  });

  it('should filter todos', () => {
    const state: RootState = {
      todos: {
        ids: ['1', '2'],
        entities: {
          '1': { id: '1', title: 'A', completed: false, priority: 'low', createdAt: '' },
          '2': { id: '2', title: 'B', completed: true, priority: 'low', createdAt: '' },
        },
        filter: 'active',
        sortBy: 'createdAt',
        status: 'succeeded',
        error: null,
      },
    };
    expect(selectFilteredTodos(state)).toHaveLength(1);
    expect(selectFilteredTodos(state)[0].title).toBe('A');
  });
});

// --- Zustand: Test via getState/setState ---
import { useTodosStore } from './todosStore';

describe('todosStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useTodosStore.setState({
      todos: [],
      filter: 'all',
      sortBy: 'createdAt',
      status: 'idle',
      error: null,
    });
  });

  it('should toggle a todo', () => {
    useTodosStore.setState({
      todos: [
        { id: '1', title: 'Test', completed: false, priority: 'low', createdAt: '' },
      ],
    });

    useTodosStore.getState().toggleTodo('1');

    expect(useTodosStore.getState().todos[0].completed).toBe(true);
  });

  it('should filter todos', () => {
    useTodosStore.setState({
      todos: [
        { id: '1', title: 'A', completed: false, priority: 'low', createdAt: '' },
        { id: '2', title: 'B', completed: true, priority: 'low', createdAt: '' },
      ],
      filter: 'active',
    });

    const filtered = selectFilteredTodos(useTodosStore.getState());
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('A');
  });
});

// --- Jotai: Test with custom Provider ---
import { Provider, createStore } from 'jotai';
import { render, screen, act } from '@testing-library/react';

describe('todoAtoms', () => {
  it('should compute filtered todos', () => {
    const store = createStore();
    store.set(todosAtom, [
      { id: '1', title: 'A', completed: false, priority: 'low', createdAt: '' },
      { id: '2', title: 'B', completed: true, priority: 'low', createdAt: '' },
    ]);
    store.set(filterAtom, 'active');

    // Read derived atom
    const filtered = store.get(filteredTodosAtom);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('A');
  });

  it('should render filtered todos', () => {
    const store = createStore();
    store.set(todosAtom, [
      { id: '1', title: 'Buy milk', completed: false, priority: 'low', createdAt: '' },
    ]);

    function TestComponent() {
      const todos = useAtomValue(filteredTodosAtom);
      return <ul>{todos.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
    }

    render(
      <Provider store={store}>
        <TestComponent />
      </Provider>
    );

    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });
});
```

---

## 7. Migration Guides

### Redux Toolkit to Zustand

```typescript
// ============================================================
// MIGRATION: Redux Toolkit → Zustand
// ============================================================

// STEP 1: Convert slice to Zustand store
// Redux:  createSlice({ reducers: { ... } })
// Zustand: create((set) => ({ ... }))

// STEP 2: Convert selectors
// Redux:  useSelector(selectTodos)
// Zustand: useTodosStore((s) => s.todos)

// STEP 3: Convert dispatch
// Redux:  dispatch(addTodo({ title }))
// Zustand: useTodosStore.getState().addTodo(title)

// STEP 4: Remove Provider
// Redux:  <Provider store={store}><App /></Provider>
// Zustand: <App />  (no provider needed)

// STEP 5: Convert async thunks
// Redux:  createAsyncThunk('todos/fetch', async () => { ... })
// Zustand: fetchTodos: async () => { set({ status: 'loading' }); ... }

// STEP 6: Convert entity adapters
// Redux:  createEntityAdapter + normalized state
// Zustand: Plain array + find/filter (or Map for large datasets)

// STEP 7: Convert middleware
// Redux:  configureStore({ middleware: [...] })
// Zustand: create(devtools(persist(immer((set) => ({ ... })))))
```

### Zustand to Jotai

```typescript
// ============================================================
// MIGRATION: Zustand → Jotai
// ============================================================

// STEP 1: Identify independent state pieces in Zustand store
// Zustand: { todos: [], filter: 'all', theme: 'light' }
// Jotai:   todosAtom, filterAtom, themeAtom (each independent)

// STEP 2: Convert state to atoms
// Zustand: create((set) => ({ count: 0 }))
// Jotai:   const countAtom = atom(0)

// STEP 3: Convert selectors to derived atoms
// Zustand: selectFilteredTodos = (state) => { ... }
// Jotai:   filteredTodosAtom = atom((get) => { ... })

// STEP 4: Convert actions to write atoms
// Zustand: addTodo: (title) => set((s) => ({ todos: [...s.todos, ...] }))
// Jotai:   addTodoAtom = atom(null, (get, set, title: string) => { ... })

// STEP 5: Convert persistence
// Zustand: persist middleware
// Jotai:   atomWithStorage('key', defaultValue)

// STEP 6: Update component hooks
// Zustand: const todos = useTodosStore((s) => s.todos)
// Jotai:   const todos = useAtomValue(todosAtom)
```

---

## 8. Anti-Patterns Table

```
┌───────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────────┐
│  Anti-Pattern                     │  Symptom                         │  Fix                                 │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Zustand: No selectors            │  useStore() with no selector     │  ALWAYS pass a selector:             │
│  (subscribing to entire store)    │  re-renders on EVERY change.     │  useStore((s) => s.count)            │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Redux: Raw Redux (no Toolkit)    │  Switch statements, action type  │  ALWAYS use createSlice from         │
│                                   │  constants, manual immutability. │  @reduxjs/toolkit. NEVER raw Redux.  │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Jotai: Giant atoms               │  One atom holds entire app state.│  Split into primitive atoms.         │
│  (treating Jotai as Redux)        │  Every component re-renders.     │  Compose with derived atoms.         │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Redux: Server data in store      │  Manual loading/error booleans,  │  Use RTK Query or TanStack Query.    │
│  (manual fetching in thunks)      │  stale cache, no background      │  Server state != client state.       │
│                                   │  refetch.                        │                                      │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Zustand: Async in selectors      │  Selectors should be pure.       │  Async logic goes in ACTIONS         │
│                                   │  Side effects in selectors       │  (set, get functions), never in      │
│                                   │  cause infinite loops.           │  the selector function.              │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Jotai: Missing Provider in tests │  Tests share state across test   │  Wrap each test in a fresh           │
│                                   │  cases. Flaky tests.             │  <Provider store={createStore()}>    │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  All: Object selector creates     │  useStore((s) => ({ a: s.a,     │  Select primitives individually      │
│  new reference every render       │  b: s.b })) — new object every  │  or use Zustand's shallow compare:   │
│                                   │  render = infinite re-renders.   │  useStore(s => s.a, shallow)         │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Redux: Too many slices / over-   │  15 slices for a simple app.     │  Start with 2-3 slices. Add when     │
│  normalization                    │  Entity adapters everywhere.     │  complexity demands it.              │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Zustand: God store               │  Single store with 50+ fields.   │  Split into multiple focused stores: │
│  (everything in one store)        │  Impossible to reason about.     │  useAuthStore, useUIStore, etc.      │
├───────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  All: Not resetting store in      │  Tests pass individually but     │  Reset state in beforeEach.          │
│  tests                            │  fail when run together.         │  Zustand: setState(initialState).    │
│                                   │  State leaks between tests.      │  Jotai: fresh Provider + createStore.│
└───────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────────┘
```

---

## 9. Enforcement Checklist

```
STATE LIBRARY REVIEW CHECKLIST
=================================

GENERAL (all three):
[ ] ONE library chosen per project — no mixing Redux + Zustand + Jotai
[ ] Server state handled by TanStack Query / SWR / RTK Query — NOT manual fetch in store
[ ] Selectors used for EVERY store subscription — no full-store subscriptions
[ ] Stores reset in test beforeEach — no state leaks between tests
[ ] DevTools configured for development mode
[ ] Persistence uses the library's built-in mechanism (not manual localStorage)
[ ] Store logic is testable without rendering React components
[ ] TypeScript types are complete — no `any` in store types

REDUX TOOLKIT SPECIFIC:
[ ] ALWAYS use createSlice, NEVER manual action types + reducer switches
[ ] createAsyncThunk for all async operations (or RTK Query)
[ ] createSelector for any derived/computed data (NOT inline in useSelector)
[ ] Typed hooks (useAppDispatch, useAppSelector) — NEVER raw useDispatch/useSelector
[ ] Entity adapter for normalized collections
[ ] Middleware array explicitly configured

ZUSTAND SPECIFIC:
[ ] Selectors in useStore() are NARROW — select only what component needs
[ ] Shallow comparison used when selecting objects: useStore(fn, shallow)
[ ] Immer middleware used for complex nested updates
[ ] Store split into slices for apps with 10+ state fields
[ ] Actions are part of the store, not separate functions
[ ] getState() used for accessing state outside React (API interceptors, etc.)

JOTAI SPECIFIC:
[ ] State split into smallest meaningful atoms — NOT one giant atom
[ ] Derived atoms used instead of useEffect + setState synchronization
[ ] useAtomValue for read-only subscriptions (NOT useAtom when you only read)
[ ] useSetAtom for write-only access (NOT useAtom when you only write)
[ ] atomWithStorage for persistent state — NOT manual localStorage
[ ] Action atoms (write-only) used to encapsulate complex state updates
[ ] Fresh Provider + createStore in each test
```
