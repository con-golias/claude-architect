# Redux / Zustand / Jotai — Complete Specification

> **AI Plugin Directive:** When implementing global state management with Redux Toolkit, Zustand, or Jotai, ALWAYS consult this guide. Apply the correct library patterns for store design, selectors, middleware, persistence, and DevTools integration. This guide covers Redux Toolkit (RTK), Zustand, and Jotai with production-ready patterns, performance optimization, and migration strategies.

**Core Rule: For NEW React projects, use Zustand for simple-to-medium global state and Jotai for fine-grained atomic state. Use Redux Toolkit ONLY when you need middleware ecosystem, time-travel debugging, or are working with an existing Redux codebase. NEVER use plain Redux (without Toolkit) — RTK is the official recommended approach. ALWAYS use selectors for reading state — NEVER subscribe to the entire store.**

---

## 1. Library Comparison

```
                    LIBRARY COMPARISON

  ┌────────────────┬──────────────────┬──────────────────┐
  │  Redux Toolkit │    Zustand       │    Jotai         │
  ├────────────────┼──────────────────┼──────────────────┤
  │ Architecture:  │ Architecture:    │ Architecture:    │
  │ Single store   │ Multiple stores  │ Atom-based       │
  │ Reducers       │ Direct mutations │ Bottom-up        │
  │ Actions        │ (via Immer)      │ React primitives │
  │ Middleware     │ Minimal API      │                  │
  │                │                  │                  │
  │ Bundle: ~11KB  │ Bundle: ~1.1KB   │ Bundle: ~3.3KB   │
  │                │                  │                  │
  │ Boilerplate:   │ Boilerplate:     │ Boilerplate:     │
  │ ████████░░     │ ███░░░░░░░       │ ██░░░░░░░░       │
  │                │                  │                  │
  │ Learning:      │ Learning:        │ Learning:        │
  │ ████████░░     │ ███░░░░░░░       │ █████░░░░░       │
  │                │                  │                  │
  │ DevTools:      │ DevTools:        │ DevTools:        │
  │ ██████████     │ ████████░░       │ ██████░░░░       │
  └────────────────┴──────────────────┴──────────────────┘
```

---

## 2. Zustand — Recommended Default

### 2.1 Basic Store

```typescript
// store/auth-store.ts
import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const user = await authApi.login(email, password);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    authApi.logout();
    set({ user: null, isAuthenticated: false });
  },

  updateProfile: (updates) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...updates } });
  },
}));
```

### 2.2 Selectors — CRITICAL for Performance

```typescript
// ❌ BAD: Subscribes to entire store — re-renders on ANY change
function UserName() {
  const store = useAuthStore();
  return <span>{store.user?.name}</span>;
  // Re-renders when isLoading, isAuthenticated, etc. change
}

// ✅ GOOD: Selector — re-renders ONLY when selected value changes
function UserName() {
  const name = useAuthStore((state) => state.user?.name);
  return <span>{name}</span>;
  // Only re-renders when user.name changes
}

// ✅ GOOD: Action selector — NEVER re-renders (functions are stable)
function LogoutButton() {
  const logout = useAuthStore((state) => state.logout);
  return <button onClick={logout}>Logout</button>;
}

// ✅ GOOD: Multiple values — use shallow comparison
import { useShallow } from 'zustand/react/shallow';

function UserBadge() {
  const { name, role } = useAuthStore(
    useShallow((state) => ({ name: state.user?.name, role: state.user?.role }))
  );
  return <Badge>{name} ({role})</Badge>;
}
```

### 2.3 Zustand with Slices (Large Stores)

```typescript
// store/slices/cart-slice.ts
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartSlice {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const createCartSlice = (set: any, get: any): CartSlice => ({
  items: [],

  addItem: (item) => set((state: { items: CartItem[] }) => {
    const existing = state.items.find(i => i.productId === item.productId);
    if (existing) {
      return {
        items: state.items.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      };
    }
    return { items: [...state.items, { ...item, quantity: 1 }] };
  }),

  removeItem: (productId) => set((state: { items: CartItem[] }) => ({
    items: state.items.filter(i => i.productId !== productId),
  })),

  updateQuantity: (productId, quantity) => set((state: { items: CartItem[] }) => ({
    items: quantity <= 0
      ? state.items.filter(i => i.productId !== productId)
      : state.items.map(i =>
          i.productId === productId ? { ...i, quantity } : i
        ),
  })),

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum: number, i: CartItem) => sum + i.quantity, 0),

  totalPrice: () => get().items.reduce((sum: number, i: CartItem) => sum + i.price * i.quantity, 0),
});

// store/index.ts — Combine slices
import { create } from 'zustand';
import { createCartSlice, CartSlice } from './slices/cart-slice';
import { createUISlice, UISlice } from './slices/ui-slice';

type Store = CartSlice & UISlice;

export const useStore = create<Store>()((...args) => ({
  ...createCartSlice(...args),
  ...createUISlice(...args),
}));
```

### 2.4 Zustand Middleware

```typescript
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface AppStore {
  count: number;
  increment: () => void;
  nested: { deep: { value: number } };
  updateDeep: (value: number) => void;
}

export const useAppStore = create<AppStore>()(
  devtools(                      // Redux DevTools integration
    persist(                     // localStorage persistence
      immer(                     // Immer for immutable updates
        subscribeWithSelector(   // Subscribe to specific state changes
          (set) => ({
            count: 0,
            increment: () => set((state) => {
              state.count++;      // Direct mutation — Immer handles immutability
            }),
            nested: { deep: { value: 0 } },
            updateDeep: (value) => set((state) => {
              state.nested.deep.value = value; // Deep mutation — Immer makes safe
            }),
          })
        )
      ),
      {
        name: 'app-store',       // localStorage key
        partialize: (state) => ({ count: state.count }), // Persist only count
      }
    ),
    { name: 'AppStore' }         // DevTools label
  )
);

// Subscribe to specific changes outside React
useAppStore.subscribe(
  (state) => state.count,
  (count, prevCount) => {
    console.log(`Count changed: ${prevCount} → ${count}`);
  }
);
```

---

## 3. Jotai — Atomic State

### 3.1 Primitive Atoms

```typescript
// atoms/cart.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// ─── Primitive atoms ───
export const cartItemsAtom = atomWithStorage<CartItem[]>('cart-items', []);

// ─── Derived atoms (read-only) ───
export const cartTotalAtom = atom((get) => {
  const items = get(cartItemsAtom);
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
});

export const cartCountAtom = atom((get) => {
  const items = get(cartItemsAtom);
  return items.reduce((sum, item) => sum + item.quantity, 0);
});

export const cartIsEmptyAtom = atom((get) => get(cartCountAtom) === 0);

// ─── Write atoms (actions) ───
export const addToCartAtom = atom(
  null,
  (get, set, product: { id: string; name: string; price: number }) => {
    const items = get(cartItemsAtom);
    const existing = items.find(i => i.productId === product.id);

    if (existing) {
      set(cartItemsAtom, items.map(i =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      set(cartItemsAtom, [...items, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      }]);
    }
  }
);

export const removeFromCartAtom = atom(
  null,
  (get, set, productId: string) => {
    const items = get(cartItemsAtom);
    set(cartItemsAtom, items.filter(i => i.productId !== productId));
  }
);

export const clearCartAtom = atom(null, (_get, set) => {
  set(cartItemsAtom, []);
});
```

### 3.2 Async Atoms

```typescript
// atoms/user.ts — Async data atoms
import { atom } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';

// ─── Async atom (suspense-compatible) ───
export const userAtom = atom(async () => {
  const response = await fetch('/api/user');
  return response.json() as Promise<User>;
});

// ─── Atom with TanStack Query integration ───
export const productsAtom = atomWithQuery(() => ({
  queryKey: ['products'],
  queryFn: async () => {
    const response = await fetch('/api/products');
    return response.json() as Promise<Product[]>;
  },
}));

// ─── Atom family (parameterized atoms) ───
import { atomFamily } from 'jotai/utils';

export const productByIdAtom = atomFamily((id: string) =>
  atom(async () => {
    const response = await fetch(`/api/products/${id}`);
    return response.json() as Promise<Product>;
  })
);

// Usage
function ProductDetail({ id }: { id: string }) {
  const product = useAtomValue(productByIdAtom(id));
  return <div>{product.name}</div>;
}
```

### 3.3 Jotai with Immer

```typescript
import { atomWithImmer } from 'jotai-immer';

interface AppState {
  users: Record<string, User>;
  settings: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
}

const appStateAtom = atomWithImmer<AppState>({
  users: {},
  settings: {
    theme: 'light',
    notifications: true,
    language: 'en',
  },
});

// Direct mutations with Immer
function SettingsPage() {
  const [state, setState] = useAtom(appStateAtom);

  const toggleTheme = () => {
    setState((draft) => {
      draft.settings.theme = draft.settings.theme === 'light' ? 'dark' : 'light';
    });
  };

  return /* ... */;
}
```

---

## 4. Redux Toolkit (RTK)

### 4.1 Store Setup

```typescript
// store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { cartSlice } from './slices/cart-slice';
import { authSlice } from './slices/auth-slice';
import { apiSlice } from './slices/api-slice';

export const store = configureStore({
  reducer: {
    cart: cartSlice.reducer,
    auth: authSlice.reducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(apiSlice.middleware), // RTK Query middleware
});

// Typed hooks — ALWAYS use these, not raw useSelector/useDispatch
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppDispatch = () => useDispatch<AppDispatch>();
```

### 4.2 Slice Definition

```typescript
// store/slices/cart-slice.ts
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  discount: number;
}

const initialState: CartState = {
  items: [],
  couponCode: null,
  discount: 0,
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<Omit<CartItem, 'quantity'>>) => {
      // Immer allows direct mutations inside createSlice
      const existing = state.items.find(i => i.productId === action.payload.productId);
      if (existing) {
        existing.quantity += 1;
      } else {
        state.items.push({ ...action.payload, quantity: 1 });
      }
    },

    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.productId !== action.payload);
    },

    updateQuantity: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      const item = state.items.find(i => i.productId === action.payload.productId);
      if (item) {
        item.quantity = Math.max(0, action.payload.quantity);
        if (item.quantity === 0) {
          state.items = state.items.filter(i => i.productId !== action.payload.productId);
        }
      }
    },

    applyCoupon: (state, action: PayloadAction<{ code: string; discount: number }>) => {
      state.couponCode = action.payload.code;
      state.discount = action.payload.discount;
    },

    clearCart: () => initialState,
  },
});

export const { addItem, removeItem, updateQuantity, applyCoupon, clearCart } = cartSlice.actions;

// ─── Memoized Selectors ───
const selectCartItems = (state: RootState) => state.cart.items;
const selectDiscount = (state: RootState) => state.cart.discount;

export const selectCartTotal = createSelector(
  [selectCartItems, selectDiscount],
  (items, discount) => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return subtotal * (1 - discount / 100);
  }
);

export const selectCartItemCount = createSelector(
  [selectCartItems],
  (items) => items.reduce((sum, item) => sum + item.quantity, 0)
);

export const selectCartItemById = (productId: string) =>
  createSelector(
    [selectCartItems],
    (items) => items.find(item => item.productId === productId)
  );
```

### 4.3 RTK Query (Data Fetching)

```typescript
// store/slices/api-slice.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Product', 'User', 'Order'],
  endpoints: (builder) => ({
    getProducts: builder.query<Product[], { category?: string }>({
      query: ({ category }) => category ? `/products?category=${category}` : '/products',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Product' as const, id })), 'Product']
          : ['Product'],
    }),

    getProduct: builder.query<Product, string>({
      query: (id) => `/products/${id}`,
      providesTags: (result, error, id) => [{ type: 'Product', id }],
    }),

    createProduct: builder.mutation<Product, CreateProductDTO>({
      query: (body) => ({ url: '/products', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),

    updateProduct: builder.mutation<Product, { id: string; updates: Partial<Product> }>({
      query: ({ id, updates }) => ({ url: `/products/${id}`, method: 'PATCH', body: updates }),
      // Optimistic update
      async onQueryStarted({ id, updates }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          apiSlice.util.updateQueryData('getProduct', id, (draft) => {
            Object.assign(draft, updates);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo(); // Rollback on failure
        }
      },
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
} = apiSlice;
```

---

## 5. Library Decision Matrix

| Criterion | Redux Toolkit | Zustand | Jotai |
|-----------|--------------|---------|-------|
| Bundle size | ~11 KB | ~1.1 KB | ~3.3 KB |
| Store model | Single centralized | Multiple stores | Bottom-up atoms |
| Updates | Actions → Reducers | Direct set | Atom set |
| Boilerplate | Medium (slices reduce it) | Minimal | Minimal |
| DevTools | ✅ Excellent (time travel) | ✅ Good (Redux DevTools) | ✅ Jotai DevTools |
| Middleware | ✅ Rich ecosystem | ✅ Built-in (persist, immer) | ⚠️ Limited |
| Data fetching | ✅ RTK Query (built-in) | ❌ Use TanStack Query | ✅ jotai-tanstack-query |
| TypeScript | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| SSR | ✅ | ✅ | ✅ |
| React Suspense | ❌ | ❌ | ✅ Native |
| Learning curve | Medium-High | Low | Low-Medium |
| Best for | Large apps, complex state, big teams | Simple-medium global state | Fine-grained, atomic state |
| Avoid when | Simple app, few global states | Need time-travel/middleware | Need centralized store |

---

## 6. Migration Patterns

### 6.1 Redux → Zustand

```typescript
// Redux slice:
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] },
  reducers: {
    addItem: (state, action) => { state.items.push(action.payload); },
    removeItem: (state, action) => {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
  },
});

// Zustand equivalent:
const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id),
  })),
}));

// Migration path:
// 1. Create Zustand store with same shape
// 2. Replace useSelector() with useCartStore(selector)
// 3. Replace dispatch(action()) with store.action()
// 4. Remove Redux provider and store setup
```

### 6.2 Redux → Jotai

```typescript
// Redux:
const selectCartTotal = createSelector(
  [(state) => state.cart.items],
  (items) => items.reduce((sum, i) => sum + i.price * i.quantity, 0)
);

// Jotai equivalent:
const cartItemsAtom = atom<CartItem[]>([]);
const cartTotalAtom = atom((get) => {
  const items = get(cartItemsAtom);
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
});

// Migration path:
// 1. Create atoms for each piece of Redux state
// 2. Create derived atoms for selectors
// 3. Create write atoms for actions
// 4. Replace useSelector(selector) with useAtomValue(atom)
// 5. Replace dispatch(action()) with useSetAtom(writeAtom)
```

---

## 7. Performance Optimization

### 7.1 Zustand Performance

```typescript
// ─── Selector granularity ───
// ❌ BAD: Object selector — new reference every render
const { name, email } = useUserStore((state) => ({
  name: state.user?.name,
  email: state.user?.email,
}));
// This creates a new object every time → always re-renders

// ✅ GOOD: useShallow for object selectors
import { useShallow } from 'zustand/react/shallow';
const { name, email } = useUserStore(
  useShallow((state) => ({ name: state.user?.name, email: state.user?.email }))
);

// ✅ BEST: Individual selectors when possible
const name = useUserStore((state) => state.user?.name);
const email = useUserStore((state) => state.user?.email);

// ─── Transient updates (no re-render) ───
const useAnimationStore = create((set, get) => ({
  position: { x: 0, y: 0 },
  // Access state without subscribing (no re-render)
  getPosition: () => get().position,
}));

// Outside React — no re-render
const currentPosition = useAnimationStore.getState().position;
```

### 7.2 Jotai Performance

```typescript
// ─── Atom granularity ───
// ❌ BAD: One large atom
const appStateAtom = atom({
  user: null,
  theme: 'light',
  notifications: [],
  cart: [],
  // ANY change re-renders ALL consumers
});

// ✅ GOOD: Granular atoms
const userAtom = atom<User | null>(null);
const themeAtom = atom<'light' | 'dark'>('light');
const notificationsAtom = atom<Notification[]>([]);
const cartAtom = atom<CartItem[]>([]);

// ─── selectAtom for sub-state ───
import { selectAtom } from 'jotai/utils';

const userNameAtom = selectAtom(userAtom, (user) => user?.name);
// Only re-renders when user.name changes, not other user fields

// ─── splitAtom for list items ───
import { splitAtom } from 'jotai/utils';

const todosAtom = atom<Todo[]>([]);
const todoAtomsAtom = splitAtom(todosAtom);
// Each list item gets its own atom — updating one doesn't re-render others

function TodoList() {
  const [todoAtoms] = useAtom(todoAtomsAtom);
  return todoAtoms.map((todoAtom) => <TodoItem key={`${todoAtom}`} atom={todoAtom} />);
}

function TodoItem({ atom: todoAtom }: { atom: PrimitiveAtom<Todo> }) {
  const [todo, setTodo] = useAtom(todoAtom);
  // Only THIS item re-renders when its data changes
  return <div>{todo.text}</div>;
}
```

### 7.3 Redux Performance

```typescript
// ─── createSelector for memoized derived data ───
import { createSelector } from '@reduxjs/toolkit';

// ❌ BAD: New array created on every call
const selectExpensiveItems = (state: RootState) =>
  state.cart.items.filter(i => i.price > 100);
// filter() creates new array → consumers re-render every time

// ✅ GOOD: Memoized selector
const selectExpensiveItems = createSelector(
  [(state: RootState) => state.cart.items],
  (items) => items.filter(i => i.price > 100)
);
// Same input → same output reference → no re-render

// ─── Parameterized selectors ───
const selectItemsByCategory = createSelector(
  [(state: RootState) => state.products.items, (_: RootState, category: string) => category],
  (items, category) => items.filter(i => i.category === category)
);

// Usage
const electronics = useAppSelector((state) => selectItemsByCategory(state, 'electronics'));
```

---

## 8. Testing

### 8.1 Testing Zustand Stores

```typescript
// __tests__/cart-store.test.ts
import { useCartStore } from '../store/cart-store';

// Reset store between tests
beforeEach(() => {
  useCartStore.setState({ items: [], coupon: null });
});

describe('CartStore', () => {
  it('adds item to cart', () => {
    const { addItem } = useCartStore.getState();
    addItem({ productId: '1', name: 'Widget', price: 9.99 });

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      productId: '1', name: 'Widget', price: 9.99, quantity: 1,
    });
  });

  it('increments quantity for existing item', () => {
    const { addItem } = useCartStore.getState();
    addItem({ productId: '1', name: 'Widget', price: 9.99 });
    addItem({ productId: '1', name: 'Widget', price: 9.99 });

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });
});
```

### 8.2 Testing Jotai Atoms

```typescript
// __tests__/cart-atoms.test.ts
import { createStore } from 'jotai';
import { cartItemsAtom, cartTotalAtom, addToCartAtom } from '../atoms/cart';

describe('Cart Atoms', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it('calculates cart total', () => {
    store.set(cartItemsAtom, [
      { productId: '1', name: 'A', price: 10, quantity: 2 },
      { productId: '2', name: 'B', price: 20, quantity: 1 },
    ]);

    expect(store.get(cartTotalAtom)).toBe(40);
  });

  it('adds item via write atom', () => {
    store.set(addToCartAtom, { id: '1', name: 'Widget', price: 9.99 });
    const items = store.get(cartItemsAtom);
    expect(items).toHaveLength(1);
  });
});
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Subscribing to entire Zustand store | Every state change re-renders component | Use granular selectors: `useStore(state => state.value)` |
| One giant Jotai atom | All consumers re-render on any change | Split into granular atoms, use `selectAtom` |
| Redux without RTK | Massive boilerplate, manual action types | Migrate to Redux Toolkit (createSlice, createAsyncThunk) |
| Not using `createSelector` (Redux) | Derived data recomputed on every render | Use memoized selectors from Reselect |
| Putting server data in Redux | Stale data, manual cache management | Use RTK Query or TanStack Query |
| Zustand store in component scope | New store on every render | Define stores at module level |
| Jotai atoms in component scope | New atom on every render, state reset | Define atoms at module level or use atomFamily |
| Not resetting store in tests | Tests affect each other | Reset store state in beforeEach |
| Object selectors without shallow | New object reference every render | Use `useShallow()` (Zustand) or individual selectors |
| Storing derived data | Must sync manually, bugs | Compute from source (createSelector, derived atom) |
| Too many global stores | State scattered, hard to trace | Consolidate related state, keep most state local |
| No DevTools setup | Can't debug state changes | Connect Redux/Zustand DevTools in development |

---

## 10. Enforcement Checklist

- [ ] Library choice matches project complexity (Zustand for simple, Redux for complex)
- [ ] Selectors are granular — components subscribe only to needed state
- [ ] Object selectors use shallow comparison (useShallow in Zustand)
- [ ] Derived data uses memoized selectors (createSelector in Redux, derived atoms in Jotai)
- [ ] Server data uses dedicated data-fetching library (RTK Query, TanStack Query)
- [ ] Stores/atoms defined at module level (not inside components)
- [ ] DevTools connected for development debugging
- [ ] Store state reset between tests (beforeEach)
- [ ] Zustand middleware applied appropriately (devtools, persist, immer)
- [ ] Jotai atoms are granular (not one giant state atom)
- [ ] Redux uses RTK (createSlice, not raw Redux)
- [ ] Actions are tested independently from components
- [ ] TypeScript types are complete for store state and actions
- [ ] Persistence middleware applied where needed (cart, preferences)
- [ ] No sensitive data stored in persisted state (tokens, passwords)
