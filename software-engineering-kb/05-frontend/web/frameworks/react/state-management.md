# React State Management — Complete Specification

> **AI Plugin Directive:** When a developer asks "which state management library should I use?", "when to use Redux vs Zustand?", "how to manage global state in React?", "when to use Context vs Zustand?", "what is server state?", "should I use Jotai or Zustand?", or any React state management question, ALWAYS consult this directive. Apply the correct state category: server state (TanStack Query), client state (Zustand/Jotai), local state (useState/useReducer), URL state (searchParams). NEVER use a single solution for all state types.

**Core Rule: State management in React is NOT one-size-fits-all. Categorize EVERY piece of state: Server state (TanStack Query — ALWAYS), local component state (useState/useReducer), global client state (Zustand or Jotai), URL state (useSearchParams). NEVER store server data in Redux/Zustand — TanStack Query handles caching, deduplication, background refetch, and stale-while-revalidate automatically. NEVER use Context API as a state manager for frequently changing data.**

---

## 1. State Categories

```
                    STATE TAXONOMY

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  SERVER STATE (owned by the server)                      │
  │  ┌────────────────────────────────────────────────────┐ │
  │  │ • API responses, database records                  │ │
  │  │ • Cached remotely, synchronized                    │ │
  │  │ • Shared across users                              │ │
  │  │ • Tool: TanStack Query / SWR / RTK Query           │ │
  │  │ • NEVER store in Redux/Zustand/useState            │ │
  │  └────────────────────────────────────────────────────┘ │
  │                                                          │
  │  CLIENT STATE (owned by the browser)                     │
  │  ┌──────────────────────┐  ┌───────────────────────────┐│
  │  │ LOCAL                │  │ GLOBAL                    ││
  │  │ • Form inputs        │  │ • Auth/session            ││
  │  │ • Toggle visibility  │  │ • Theme/preferences       ││
  │  │ • Accordion state    │  │ • Shopping cart            ││
  │  │ • Component-specific │  │ • Shared across routes    ││
  │  │                      │  │                           ││
  │  │ Tool: useState       │  │ Tool: Zustand / Jotai    ││
  │  │       useReducer     │  │       Redux Toolkit       ││
  │  └──────────────────────┘  └───────────────────────────┘│
  │                                                          │
  │  URL STATE (owned by the URL)                            │
  │  ┌────────────────────────────────────────────────────┐ │
  │  │ • Search filters, pagination, sort order           │ │
  │  │ • Tab selection, modal open state                  │ │
  │  │ • Anything that should be shareable/bookmarkable   │ │
  │  │ • Tool: useSearchParams / nuqs                     │ │
  │  └────────────────────────────────────────────────────┘ │
  │                                                          │
  │  FORM STATE (owned by the form)                          │
  │  ┌────────────────────────────────────────────────────┐ │
  │  │ • Input values, validation errors, dirty/touched  │ │
  │  │ • Tool: React Hook Form / Conform                  │ │
  │  │ • For complex forms only — simple forms use useState│ │
  │  └────────────────────────────────────────────────────┘ │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

---

## 2. Decision Tree

```
WHICH STATE SOLUTION?

START: What kind of data is this?
│
├── From an API/database? (fetched from server)
│   └── TanStack Query (ALWAYS) ✅
│       ├── Automatic caching + deduplication
│       ├── Background refetch + stale-while-revalidate
│       ├── Optimistic updates
│       └── NEVER put API data in Redux/Zustand
│
├── Only used by ONE component?
│   └── useState / useReducer ✅
│       └── Colocate state with the component that uses it
│
├── Used by 2-3 nearby components?
│   └── Lift state to nearest common parent ✅
│       └── Pass via props (NOT context, NOT global store)
│
├── Used across many components / routes?
│   ├── Simple key-value (theme, locale, auth)?
│   │   ├── Changes rarely → Context API ✅
│   │   └── Changes often → Zustand/Jotai ✅
│   │
│   ├── Few stores, action-based?
│   │   └── Zustand ✅ (simplest global state)
│   │
│   ├── Many independent atoms?
│   │   └── Jotai ✅ (fine-grained reactivity)
│   │
│   └── Large team, strict patterns, time-travel?
│       └── Redux Toolkit ✅ (mature, opinionated)
│
├── Should persist in URL? (shareable, bookmarkable)
│   └── useSearchParams / nuqs ✅
│       └── Filters, pagination, sort, tab selection
│
└── Complex form with validation?
    └── React Hook Form / Conform ✅
```

---

## 3. TanStack Query (Server State)

```typescript
// SETUP
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes — data is fresh for 5 min
      gcTime: 1000 * 60 * 30,   // 30 minutes — cache garbage collected
      retry: 3,
      refetchOnWindowFocus: true, // Refetch when tab gains focus
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

// QUERIES — Reading data
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],     // Cache key — determines cache identity
    queryFn: () => api.getUser(userId), // Fetch function
    staleTime: 1000 * 60 * 10,     // Fresh for 10 minutes
    enabled: !!userId,              // Don't fetch if no userId
  });

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;

  return <Profile user={user} />;
}

// PARALLEL QUERIES
function Dashboard() {
  const userQuery = useQuery({ queryKey: ['user'], queryFn: api.getUser });
  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: api.getStats });
  const notifQuery = useQuery({ queryKey: ['notifications'], queryFn: api.getNotifications });

  // All three queries fire simultaneously
  if (userQuery.isLoading || statsQuery.isLoading) return <Loading />;

  return <DashboardView user={userQuery.data} stats={statsQuery.data} />;
}

// MUTATIONS — Writing data
function CreatePost() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (newPost: NewPost) => api.createPost(newPost),
    onSuccess: () => {
      // Invalidate and refetch posts list
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    // Optimistic update
    onMutate: async (newPost) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const previous = queryClient.getQueryData(['posts']);

      queryClient.setQueryData(['posts'], (old: Post[]) => [
        { id: 'temp', ...newPost },
        ...old,
      ]);

      return { previous }; // Rollback context
    },
    onError: (_err, _newPost, context) => {
      queryClient.setQueryData(['posts'], context?.previous); // Rollback
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] }); // Refetch
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      createMutation.mutate({ title: 'New Post', body: '...' });
    }}>
      <button disabled={createMutation.isPending}>
        {createMutation.isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}

// QUERY KEY PATTERNS
// ALWAYS structure keys from general to specific:
['users']                    // All users
['users', userId]            // Specific user
['users', userId, 'posts']   // User's posts
['posts', { status: 'published', page: 1 }] // Filtered posts

// Invalidation cascades:
queryClient.invalidateQueries({ queryKey: ['users'] });
// Invalidates: ['users'], ['users', '123'], ['users', '123', 'posts']
```

---

## 4. Zustand (Global Client State)

```typescript
// ZUSTAND: Simple, flexible, minimal boilerplate

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// BASIC STORE
interface CartStore {
  items: CartItem[];
  addItem: (item: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

const useCartStore = create<CartStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        items: [],

        addItem: (product, quantity) => set((state) => {
          const existing = state.items.find(i => i.productId === product.id);
          if (existing) {
            existing.quantity += quantity;
          } else {
            state.items.push({
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity,
            });
          }
        }),

        removeItem: (productId) => set((state) => {
          state.items = state.items.filter(i => i.productId !== productId);
        }),

        updateQuantity: (productId, quantity) => set((state) => {
          const item = state.items.find(i => i.productId === productId);
          if (item) item.quantity = Math.max(0, quantity);
        }),

        clearCart: () => set({ items: [] }),

        totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
        totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      })),
      { name: 'cart-storage' } // localStorage key
    ),
    { name: 'CartStore' } // DevTools label
  )
);

// USAGE — Fine-grained selectors
function CartIcon() {
  const totalItems = useCartStore((s) => s.totalItems());
  return <span className="badge">{totalItems}</span>;
  // Only re-renders when total items count changes
}

function CartTotal() {
  const totalPrice = useCartStore((s) => s.totalPrice());
  return <span>${totalPrice.toFixed(2)}</span>;
  // Only re-renders when total price changes
}

// SLICES PATTERN (for large stores)
interface UserSlice {
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
}

interface UISlice {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const createUserSlice: StateCreator<UserSlice & UISlice, [], [], UserSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
});

const createUISlice: StateCreator<UserSlice & UISlice, [], [], UISlice> = (set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
});

const useAppStore = create<UserSlice & UISlice>()((...args) => ({
  ...createUserSlice(...args),
  ...createUISlice(...args),
}));
```

---

## 5. Jotai (Atomic State)

```typescript
// JOTAI: Bottom-up atomic state — fine-grained reactivity

import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

// PRIMITIVE ATOMS
const countAtom = atom(0);
const nameAtom = atom('');
const darkModeAtom = atom(false);

// DERIVED ATOMS (read-only — like computed properties)
const doubleCountAtom = atom((get) => get(countAtom) * 2);
const greetingAtom = atom((get) => `Hello, ${get(nameAtom) || 'stranger'}`);

// WRITABLE DERIVED ATOMS (read + write)
const uppercaseNameAtom = atom(
  (get) => get(nameAtom).toUpperCase(),            // read
  (_get, set, newName: string) => set(nameAtom, newName) // write
);

// ASYNC ATOMS
const userAtom = atom(async () => {
  const response = await fetch('/api/user');
  return response.json();
});

// ATOM WITH STORAGE (persistence)
import { atomWithStorage } from 'jotai/utils';

const themeAtom = atomWithStorage<'light' | 'dark'>('theme', 'light');

// USAGE
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

function Display() {
  const doubled = useAtomValue(doubleCountAtom); // Read-only — no setter
  return <span>Double: {doubled}</span>;
}

function ResetButton() {
  const setCount = useSetAtom(countAtom); // Write-only — no re-render on read
  return <button onClick={() => setCount(0)}>Reset</button>;
}

// WHEN JOTAI OVER ZUSTAND:
// - Many independent pieces of state (atoms compose naturally)
// - Need derived/computed state (atoms derive from atoms)
// - Bottom-up state design (vs top-down with Zustand)
// - Fine-grained reactivity (each atom = independent subscription)
```

---

## 6. Redux Toolkit

```typescript
// REDUX TOOLKIT: When you need strict patterns, time-travel, large team

import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// SLICE
const todosSlice = createSlice({
  name: 'todos',
  initialState: {
    items: [] as Todo[],
    filter: 'all' as 'all' | 'active' | 'completed',
    status: 'idle' as 'idle' | 'loading' | 'failed',
  },
  reducers: {
    addTodo: (state, action: PayloadAction<string>) => {
      state.items.push({
        id: crypto.randomUUID(),
        text: action.payload,
        completed: false,
      });
    },
    toggleTodo: (state, action: PayloadAction<string>) => {
      const todo = state.items.find(t => t.id === action.payload);
      if (todo) todo.completed = !todo.completed;
    },
    setFilter: (state, action: PayloadAction<typeof state.filter>) => {
      state.filter = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        state.status = 'idle';
        state.items = action.payload;
      })
      .addCase(fetchTodos.rejected, (state) => {
        state.status = 'failed';
      });
  },
});

const fetchTodos = createAsyncThunk('todos/fetch', async () => {
  const response = await api.getTodos();
  return response.data;
});

// STORE
const store = configureStore({
  reducer: {
    todos: todosSlice.reducer,
  },
});

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

// TYPED HOOKS
const useAppDispatch = useDispatch.withTypes<AppDispatch>();
const useAppSelector = useSelector.withTypes<RootState>();

// USAGE
function TodoList() {
  const todos = useAppSelector((state) => state.todos.items);
  const dispatch = useAppDispatch();

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id} onClick={() => dispatch(todosSlice.actions.toggleTodo(todo.id))}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}

// WHEN REDUX TOOLKIT:
// - Large team needing strict architectural patterns
// - Complex state with many reducers and middleware
// - Need time-travel debugging
// - Already using Redux — migrate to RTK
// - NOT for new projects where Zustand/Jotai suffice
```

---

## 7. URL State

```typescript
// URL STATE: Filters, pagination, sort — shareable and bookmarkable

// REACT ROUTER
import { useSearchParams } from 'react-router-dom';

function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const sort = searchParams.get('sort') || 'newest';
  const category = searchParams.get('category') || 'all';

  const { data } = useQuery({
    queryKey: ['products', { page, sort, category }],
    queryFn: () => api.getProducts({ page, sort, category }),
  });

  function setPage(newPage: number) {
    setSearchParams(prev => {
      prev.set('page', String(newPage));
      return prev;
    });
  }

  function setSort(newSort: string) {
    setSearchParams(prev => {
      prev.set('sort', newSort);
      prev.set('page', '1'); // Reset page on sort change
      return prev;
    });
  }

  return (
    <div>
      <SortDropdown value={sort} onChange={setSort} />
      <ProductGrid products={data?.items} />
      <Pagination page={page} total={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}

// nuqs: Type-safe URL state management (Next.js)
import { useQueryState, parseAsInteger, parseAsStringEnum } from 'nuqs';

function ProductList() {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [sort, setSort] = useQueryState('sort',
    parseAsStringEnum(['newest', 'price-asc', 'price-desc']).withDefault('newest')
  );
  // URL: /products?page=2&sort=price-asc
  // Type-safe, validated, synced with URL
}

// RULE: Use URL state for anything the user should be able to:
// - Bookmark
// - Share via link
// - Navigate back/forward through
// - Examples: search query, filters, pagination, tab selection, modal open state
```

---

## 8. State Management Comparison

```
┌───────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│                   │ Zustand      │ Jotai        │ Redux TK     │ Context API  │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Bundle size       │ ~1.1 KB      │ ~3.4 KB      │ ~11 KB       │ 0 KB (built  │
│                   │              │              │              │ into React)  │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Mental model      │ Single store │ Atomic       │ Single store │ Provider +   │
│                   │ (flux-like)  │ (bottom-up)  │ (flux)       │ Consumer     │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Boilerplate       │ Minimal      │ Minimal      │ Medium       │ Minimal      │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Re-render control │ Selectors    │ Per-atom      │ Selectors    │ All consumers│
│                   │              │ subscriptions│              │ re-render    │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ DevTools          │ Via          │ Jotai        │ Redux        │ React        │
│                   │ middleware   │ DevTools     │ DevTools     │ DevTools     │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Middleware        │ persist,     │ atomWith*    │ Thunk, Saga, │ N/A          │
│                   │ immer,       │ utilities    │ Logger       │              │
│                   │ devtools     │              │              │              │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Persistence       │ persist MW   │ atomWith     │ redux-persist│ Manual       │
│                   │              │ Storage      │              │              │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ TypeScript        │ Excellent    │ Excellent    │ Good         │ Good         │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ SSR support       │ Good         │ Good         │ Good         │ Built-in     │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Best for          │ Most apps,   │ Complex      │ Large teams, │ Rare changes │
│                   │ simple API   │ derived      │ strict       │ (theme, auth,│
│                   │              │ state        │ patterns     │ locale)      │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Team size         │ Any          │ Any          │ Large        │ Any          │
├───────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Learning curve    │ Low          │ Low          │ Medium-High  │ Low          │
└───────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 9. State Colocation Principle

```typescript
// PRINCIPLE: State should live as close to where it's used as possible

// ❌ ANTI-PATTERN: Global state for local concerns
const useStore = create((set) => ({
  isDropdownOpen: false,         // Why is this global?
  tooltipPosition: { x: 0 },    // Why is this global?
  inputValue: '',                // Why is this global?
  toggleDropdown: () => set((s) => ({ isDropdownOpen: !s.isDropdownOpen })),
}));

// ✅ CORRECT: Local state for local concerns
function Dropdown() {
  const [isOpen, setIsOpen] = useState(false); // Component owns its state
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Menu</button>
      {isOpen && <DropdownMenu />}
    </div>
  );
}

// COLOCATION RULES:
// 1. Start with useState in the component
// 2. If sibling needs it → lift to parent
// 3. If distant components need it → use global store
// 4. If it comes from API → use TanStack Query
// 5. If it should be in URL → use searchParams
//
// NEVER jump straight to global state.
// Most state is LOCAL — keep it that way.
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Storing server data in Redux/Zustand** | Stale data, manual cache invalidation, no background refresh | Use TanStack Query for ALL server data |
| **Using Context for frequent updates** | All consumers re-render on every change, poor performance | Use Zustand/Jotai for frequently changing shared state |
| **Global state for local concerns** | Over-engineering, tight coupling, unnecessary re-renders | Use useState for local state, lift only when needed |
| **One monolithic store** | Tightly coupled features, everything re-renders together | Split into domain stores (cartStore, authStore, uiStore) |
| **No selectors in Zustand** | `useStore()` re-renders on ANY store change | Use selectors: `useStore(s => s.count)` |
| **Derived state in store** | State out of sync, manual syncing code, race conditions | Calculate derived values at render time or use derived atoms |
| **Ignoring URL state** | Filters lost on refresh, unshareable views, broken back button | Put filters/pagination/sort in URL searchParams |
| **useEffect for state sync** | Extra render cycles, timing bugs, infinite loops | Derive state during render or use event handlers |
| **Redux for small apps** | Excessive boilerplate, action types, reducers for simple state | Use Zustand or Jotai — Redux is for large teams/complex needs |
| **Multiple sources of truth** | Same data in Redux AND TanStack Query AND local state | Single source of truth: TanStack Query for server, one store for client |
| **Not using immer with Zustand** | Verbose spread operators for nested updates, error-prone | Add immer middleware for mutable-style updates |
| **Prop drilling instead of state management** | 5+ levels of passing unused props, brittle component chain | Use Zustand/Jotai for shared state, or composition patterns |

---

## 11. Enforcement Checklist

### State Categorization
- [ ] Server data managed by TanStack Query (NOT stored in Redux/Zustand/useState)
- [ ] Local component state uses useState/useReducer
- [ ] Global client state uses Zustand or Jotai (NOT Context for frequent updates)
- [ ] URL state (filters, pagination, sort) stored in searchParams
- [ ] Form state managed by React Hook Form for complex forms

### TanStack Query
- [ ] Query keys structured general-to-specific: `['entity', id, 'relation']`
- [ ] staleTime configured per query type (not relying on default 0)
- [ ] Mutations invalidate relevant queries on success
- [ ] Optimistic updates implemented for user-facing mutations
- [ ] Error and loading states handled for every query

### Zustand/Jotai
- [ ] Stores split by domain (cart, auth, UI — not monolith)
- [ ] Selectors used for fine-grained subscriptions (never full store)
- [ ] Derived values computed at render time (not stored in store)
- [ ] Persistence configured for state that survives refresh
- [ ] DevTools middleware enabled for debugging

### State Colocation
- [ ] State starts local (useState) and lifts only when needed
- [ ] No prop drilling beyond 2-3 levels
- [ ] No global state for component-local concerns
- [ ] Context used ONLY for dependency injection (theme, auth, locale)
- [ ] Context values memoized to prevent unnecessary re-renders
