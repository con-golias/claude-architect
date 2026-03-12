# Local vs Global State — Complete Specification

> **AI Plugin Directive:** When deciding where to place state, evaluating prop drilling versus global state, or designing component state architecture, ALWAYS consult this guide. Apply these state placement rules to keep components maintainable, avoid unnecessary re-renders, and create clear data ownership. This guide covers state colocation, lifting state, prop drilling thresholds, and the state placement decision framework.

**Core Rule: ALWAYS colocate state with the component that uses it. Start with local state (useState) and lift UP only when siblings need to share it. Reach for global state ONLY when state is needed by components far apart in the tree with no common close ancestor. The vast majority of state (80%+) should be LOCAL. NEVER put form input values, UI toggles, or ephemeral state in global stores.**

---

## 1. State Categories

```
                    STATE TAXONOMY

  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │  UI STATE (Local)           SERVER STATE (External)    │
  │  ├── Form input values      ├── API response data      │
  │  ├── Modal open/closed      ├── Cached entities         │
  │  ├── Accordion expanded     ├── Loading/error states   │
  │  ├── Tab selection          ├── Pagination cursors     │
  │  ├── Hover/focus state      └── Real-time updates      │
  │  ├── Animation state                                   │
  │  ├── Scroll position        NAVIGATION STATE (URL)     │
  │  └── Tooltip visibility     ├── Route parameters       │
  │                              ├── Query strings          │
  │  SHARED UI STATE (Global)   ├── Hash fragments         │
  │  ├── Theme (dark/light)     └── History state          │
  │  ├── Auth/user session                                 │
  │  ├── Toast notifications    DERIVED STATE (Computed)   │
  │  ├── Sidebar collapsed      ├── Filtered lists         │
  │  ├── Language/locale        ├── Totals/aggregations    │
  │  └── Feature flags          ├── Formatted values       │
  │                              └── Validation results     │
  │                                                        │
  └────────────────────────────────────────────────────────┘

  RULE: Each category has an OPTIMAL location.
  Putting state in the wrong place causes bugs and performance issues.
```

---

## 2. State Placement Decision Tree

```
  WHERE SHOULD THIS STATE LIVE?

  Is it derived from other state or props?
       │
       ├── YES → Compute it inline (useMemo or direct calculation)
       │         DO NOT store derived state separately
       │
       └── NO → Does it come from a server/API?
                    │
                    ├── YES → Server state library (TanStack Query, SWR)
                    │         NOT in useState/Redux
                    │
                    └── NO → Is it tied to the URL?
                                 │
                                 ├── YES → URL state (useSearchParams, router)
                                 │
                                 └── NO → Does only ONE component use it?
                                              │
                                              ├── YES → Local state (useState)
                                              │         COLOCATE with that component
                                              │
                                              └── NO → Do siblings share it?
                                                           │
                                                           ├── YES → Lift to nearest common parent
                                                           │
                                                           └── NO → Are consumers far apart?
                                                                        │
                                                                        ├── YES → Global store
                                                                        │         (Zustand, Context, Redux)
                                                                        │
                                                                        └── NO → Lift to common parent
```

---

## 3. Local State (Colocation)

### 3.1 The Colocation Principle

```
  COLOCATION: State should live as CLOSE as possible to where it's used.

  ❌ BAD: Form state in global store
  ┌────────────────────────────────┐
  │  Global Store                  │
  │  ├── formValues: { email, ... }│  ← Every keystroke updates global
  │  ├── formErrors: { email, ... }│  ← Entire tree re-renders
  │  └── formTouched: { ... }      │  ← Massive overhead
  └────────────────────────────────┘

  ✅ GOOD: Form state colocated with form
  ┌────────────────────────────────┐
  │  <LoginForm>                   │
  │  └── useState({ email, pass })│  ← Only form re-renders on keystroke
  │      useState({ errors })      │  ← Contained, predictable
  │      useState({ touched })     │  ← No global side effects
  └────────────────────────────────┘
```

### 3.2 Local State Examples

```typescript
// ─── Form State: ALWAYS local ───
function LoginForm({ onSubmit }: { onSubmit: (creds: Credentials) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state is ephemeral — it dies when the form unmounts
  // There is ZERO reason to put this in a global store
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // ...
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

// ─── UI Toggle State: ALWAYS local ───
function Accordion({ items }: { items: AccordionItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Which accordion item is open is only relevant to THIS component
  return /* ... */;
}

// ─── Animation State: ALWAYS local ───
function AnimatedCard({ children }: { children: ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);
  // Hover state is purely local UI state
  return /* ... */;
}
```

### 3.3 When Local State is Correct

| State Type | Why Local | Example |
|------------|----------|---------|
| Form input values | Ephemeral, component-scoped | Email, password, search query |
| Modal/dialog open | Only parent needs to know | `isModalOpen` |
| Accordion expanded | Only accordion needs this | `expandedItemId` |
| Tab selection | Only tab group needs this | `activeTabIndex` |
| Hover/focus | CSS-like, instant, local | `isHovered`, `isFocused` |
| Loading spinners | Tied to specific action | `isSubmitting` |
| Form validation | Derived from form values | `errors`, `touched` |
| Tooltip visibility | Only tooltip needs this | `isTooltipVisible` |
| Pagination (local) | Tied to a specific list | `currentPage`, `pageSize` |

---

## 4. Lifting State Up

### 4.1 When to Lift

```
  LIFT STATE when siblings need to share it.

  BEFORE LIFTING (state in child A, but child B needs it too):
  ┌──────────────┐
  │    Parent     │
  │               │
  │  ┌────┐ ┌────┐
  │  │ A  │ │ B  │
  │  │has │ │ ??│  ← B needs state from A, can't access it
  │  │state│ │   │
  │  └────┘ └────┘
  └──────────────┘

  AFTER LIFTING (state in parent, passed down to both):
  ┌──────────────┐
  │    Parent     │
  │  has state    │  ← State lives in nearest common ancestor
  │  ┌────┐ ┌────┐
  │  │ A  │ │ B  │
  │  │prop│ │prop│  ← Both receive state as props
  │  └────┘ └────┘
  └──────────────┘
```

### 4.2 Lifting Implementation

```typescript
// BEFORE: State trapped in child
function TemperatureInput() {
  const [temp, setTemp] = useState('');
  return <input value={temp} onChange={(e) => setTemp(e.target.value)} />;
}

function TemperatureDisplay() {
  // ❌ Can't access temp from TemperatureInput!
  return <p>Temperature is: ???</p>;
}

// AFTER: State lifted to parent
function TemperatureCalculator() {
  // State lifted to nearest common ancestor
  const [celsius, setCelsius] = useState('');

  return (
    <div>
      <TemperatureInput
        value={celsius}
        onChange={setCelsius}
        label="Celsius"
      />
      <TemperatureDisplay value={celsius} unit="C" />
      <TemperatureDisplay value={toFahrenheit(celsius)} unit="F" />
    </div>
  );
}

// Child is now a "controlled component" — parent owns the state
function TemperatureInput({ value, onChange, label }: Props) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
```

---

## 5. Prop Drilling — When It Becomes a Problem

### 5.1 Prop Drilling Threshold

```
  PROP DRILLING DEPTH:

  1-2 levels deep: ✅ FINE — just pass props
  3 levels deep:   ⚠️ EVALUATE — consider Context or composition
  4+ levels deep:  ❌ TOO DEEP — use Context, composition, or global state

  ┌──────────────────────────────────────────────────┐
  │  App                                              │
  │  └── Layout                                       │
  │      └── Sidebar                                  │
  │          └── UserMenu                             │
  │              └── Avatar ← needs user.avatarUrl    │
  │                                                   │
  │  Passing user through 4 levels is PROP DRILLING   │
  │  Most intermediate components don't use `user`    │
  └──────────────────────────────────────────────────┘
```

### 5.2 Solutions to Prop Drilling

```typescript
// Solution 1: Component Composition (BEST for UI structure)
// Instead of passing props deep, pass COMPONENTS

// ❌ BAD: Props drilled through Layout, Sidebar, UserMenu
function App({ user }: { user: User }) {
  return <Layout user={user} />;  // Layout doesn't use user
}
function Layout({ user }: { user: User }) {
  return <Sidebar user={user} />;  // Sidebar doesn't use user
}
function Sidebar({ user }: { user: User }) {
  return <UserMenu user={user} />;
}

// ✅ GOOD: Composition — pass the ready-made component
function App({ user }: { user: User }) {
  return (
    <Layout
      sidebar={
        <Sidebar
          userMenu={<UserMenu user={user} />}
        />
      }
    />
  );
}
// Layout and Sidebar don't know about User at all!

// Solution 2: React Context (for cross-cutting state)
const UserContext = createContext<User | null>(null);

function App() {
  const user = useAuth();
  return (
    <UserContext.Provider value={user}>
      <Layout />
    </UserContext.Provider>
  );
}

function Avatar() {
  const user = useContext(UserContext);
  // Accesses user directly — no prop drilling
  return <img src={user?.avatarUrl} alt={user?.name} />;
}

// Solution 3: Global Store (for frequently-accessed shared state)
// See Redux/Zustand/Jotai guide
const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

function Avatar() {
  const user = useUserStore((state) => state.user);
  return <img src={user?.avatarUrl} alt={user?.name} />;
}
```

---

## 6. Context for Shared State

### 6.1 Context Rules

```
  REACT CONTEXT RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ USE Context for:                                         │
  │ ├── Theme (dark/light mode)                              │
  │ ├── Locale/language                                      │
  │ ├── Auth session (user object)                           │
  │ ├── Feature flags                                        │
  │ └── Values that change INFREQUENTLY                      │
  │                                                          │
  │ DO NOT use Context for:                                  │
  │ ├── High-frequency updates (every keystroke)             │
  │ ├── Large objects (causes re-renders of all consumers)   │
  │ ├── State that only 1-2 components use (use props)       │
  │ └── Server data (use TanStack Query / SWR)               │
  │                                                          │
  │ CRITICAL PERFORMANCE RULE:                               │
  │ When context value changes, ALL consumers re-render.     │
  │ Split context by update frequency to avoid this.         │
  └──────────────────────────────────────────────────────────┘
```

### 6.2 Context Performance Optimization

```typescript
// ❌ BAD: One large context — ALL consumers re-render on ANY change
const AppContext = createContext({
  user: null,
  theme: 'light',
  notifications: [],
  sidebarOpen: false,
  locale: 'en',
});
// When sidebarOpen changes, components reading theme also re-render!

// ✅ GOOD: Split contexts by update frequency
const AuthContext = createContext<AuthState>(null!);      // Changes: on login/logout
const ThemeContext = createContext<ThemeState>(null!);     // Changes: on theme toggle
const UIContext = createContext<UIState>(null!);           // Changes: frequently
const LocaleContext = createContext<LocaleState>(null!);   // Changes: rarely

// ✅ GOOD: Separate state and dispatch contexts
const TodoStateContext = createContext<TodoState>(null!);
const TodoDispatchContext = createContext<TodoDispatch>(null!);

function TodoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  // Memoize dispatch context — it NEVER changes
  const dispatchValue = useMemo(() => dispatch, [dispatch]);

  return (
    <TodoStateContext.Provider value={state}>
      <TodoDispatchContext.Provider value={dispatchValue}>
        {children}
      </TodoDispatchContext.Provider>
    </TodoStateContext.Provider>
  );
}

// Components that only dispatch actions NEVER re-render on state changes
function AddTodoButton() {
  const dispatch = useContext(TodoDispatchContext); // Only dispatch, no state
  return <button onClick={() => dispatch({ type: 'ADD_TODO' })}>Add</button>;
}
```

---

## 7. URL as State

### 7.1 What Belongs in the URL

```
  URL STATE RULES:

  PUT IN THE URL:
  ├── Search queries          ?q=react+hooks
  ├── Filter selections       ?category=electronics&sort=price
  ├── Pagination              ?page=3&limit=20
  ├── View mode               ?view=grid
  ├── Tab selection            ?tab=settings
  ├── Modal/drawer ID         ?product=abc-123
  ├── Sort order               ?sort=name&order=desc
  └── Date ranges              ?from=2025-01-01&to=2025-03-01

  REASON: URL state is shareable, bookmarkable, and survives refresh.

  DO NOT PUT IN THE URL:
  ├── Form input values (ephemeral, mid-typing)
  ├── Animation state
  ├── Hover/focus state
  ├── Auth tokens
  └── Large/sensitive data
```

### 7.2 URL State Implementation

```typescript
// nuqs — Type-safe URL state for Next.js
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';

function ProductList() {
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('newest'));

  // URL: /products?q=headphones&page=2&sort=price
  // State is in the URL — shareable, bookmarkable, survives refresh

  return (
    <>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      <select value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="newest">Newest</option>
        <option value="price">Price</option>
      </select>
      <ProductGrid query={search} page={page} sort={sort} />
      <Pagination page={page} onChange={setPage} />
    </>
  );
}
```

---

## 8. Derived State — NEVER Store What You Can Compute

### 8.1 The Derived State Rule

```typescript
// ❌ BAD: Storing derived state
function FilteredList({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState('');
  const [filteredItems, setFilteredItems] = useState(items);

  // BUG-PRONE: Must manually sync filteredItems when items OR filter change
  useEffect(() => {
    setFilteredItems(items.filter(item => item.name.includes(filter)));
  }, [items, filter]);

  return /* ... */;
}

// ✅ GOOD: Compute during render
function FilteredList({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState('');

  // Derived — computed inline, always in sync
  const filteredItems = items.filter(item => item.name.includes(filter));

  return /* ... */;
}

// ✅ GOOD: Memoize expensive computations
function FilteredList({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState('');

  const filteredItems = useMemo(
    () => items.filter(item => item.name.includes(filter)),
    [items, filter]
  );

  return /* ... */;
}
```

### 8.2 Common Derived State Mistakes

```typescript
// ❌ BAD: Storing the count separately
const [items, setItems] = useState<Item[]>([]);
const [itemCount, setItemCount] = useState(0);

// Must update itemCount every time items changes — easy to forget!
useEffect(() => setItemCount(items.length), [items]);

// ✅ GOOD: Derive it
const [items, setItems] = useState<Item[]>([]);
const itemCount = items.length; // Always correct, zero maintenance

// ❌ BAD: Storing selectedItem separately from selectedId
const [items, setItems] = useState<Item[]>([]);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [selectedItem, setSelectedItem] = useState<Item | null>(null);

// Must sync selectedItem when items change — what if item updated?
useEffect(() => {
  setSelectedItem(items.find(i => i.id === selectedId) || null);
}, [items, selectedId]);

// ✅ GOOD: Derive selectedItem from selectedId + items
const [items, setItems] = useState<Item[]>([]);
const [selectedId, setSelectedId] = useState<string | null>(null);
const selectedItem = items.find(i => i.id === selectedId) ?? null;
```

---

## 9. State Ownership Patterns

### 9.1 Controlled vs Uncontrolled Components

```typescript
// CONTROLLED: Parent owns the state, child is "dumb"
function Parent() {
  const [value, setValue] = useState('');
  return <Input value={value} onChange={setValue} />;
}

// UNCONTROLLED: Child owns the state, parent reads via ref
function Parent() {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleSubmit = () => {
    const value = inputRef.current?.value;
  };
  return <input ref={inputRef} defaultValue="" />;
}

// HYBRID: Support both modes
function Dropdown({ value, defaultValue, onChange, children }: DropdownProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = value !== undefined;

  const currentValue = isControlled ? value : internalValue;
  const handleChange = (newValue: string) => {
    if (!isControlled) setInternalValue(newValue);
    onChange?.(newValue);
  };

  return /* ... */;
}
```

---

## 10. State Placement by Application Layer

```
  STATE PLACEMENT BY LAYER:

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  ROUTE/PAGE LEVEL                                       │
  │  ├── URL parameters (react-router, Next.js params)      │
  │  ├── Page-level data queries (TanStack Query)           │
  │  └── Page-specific state (selectedTab, activeFilter)    │
  │                                                          │
  │  FEATURE/ORGANISM LEVEL                                  │
  │  ├── Form state (react-hook-form or useState)           │
  │  ├── Feature-specific UI state (accordion, modals)      │
  │  └── Component-scoped data (local queries)              │
  │                                                          │
  │  SHARED/GLOBAL LEVEL                                     │
  │  ├── Auth/session (Context or Zustand)                  │
  │  ├── Theme/locale (Context)                             │
  │  ├── Toast notifications (Zustand or Context)           │
  │  ├── Feature flags (Context)                            │
  │  └── Shopping cart (Zustand + persistence)              │
  │                                                          │
  │  SERVER/CACHE LEVEL                                      │
  │  ├── API response data (TanStack Query / SWR)           │
  │  ├── Optimistic updates (TanStack Query mutations)      │
  │  └── Real-time data (WebSocket + query invalidation)    │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

---

## 11. Performance Impact of State Placement

```typescript
// ─── PROBLEM: State too high → unnecessary re-renders ───
function App() {
  const [searchQuery, setSearchQuery] = useState('');
  // When searchQuery changes, ENTIRE app re-renders
  return (
    <div>
      <Header />              {/* Re-renders unnecessarily */}
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <MainContent />          {/* Re-renders unnecessarily */}
      <Footer />              {/* Re-renders unnecessarily */}
    </div>
  );
}

// ─── SOLUTION: Colocate state with the component using it ───
function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('');
  // Only SearchSection and children re-render
  return (
    <div>
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <SearchResults query={searchQuery} />
    </div>
  );
}

function App() {
  return (
    <div>
      <Header />              {/* Never re-renders from search */}
      <SearchSection />        {/* Only this re-renders */}
      <MainContent />          {/* Never re-renders from search */}
      <Footer />              {/* Never re-renders from search */}
    </div>
  );
}
```

---

## 12. State Location Comparison Matrix

| State Type | Location | Persistence | Scope | Re-render Impact |
|------------|----------|-------------|-------|-----------------|
| Form input | `useState` (local) | Unmount = lost | Component | Minimal |
| UI toggle | `useState` (local) | Unmount = lost | Component | Minimal |
| Theme | Context | Session/localStorage | App | All consumers |
| Auth user | Context/Store | Session/cookie | App | All consumers |
| API data | TanStack Query | Cache TTL | Shared cache | Query consumers |
| URL params | Router/URLSearchParams | URL bar | Shareable | Route components |
| Cart items | Zustand + persist | localStorage | App | Store subscribers |
| Notifications | Zustand/Context | Session | App | Toast consumers |
| Feature flags | Context | Remote config | App | Flag consumers |
| WebSocket data | Store + subscription | Connection | App | Subscribers |

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Form state in Redux/global store | Every keystroke updates global state, massive re-renders | Use local `useState` or `react-hook-form` |
| Derived state in useState + useEffect | State out of sync, stale data bugs | Compute during render or use `useMemo` |
| All state in a single Context | Every consumer re-renders on any change | Split Context by update frequency |
| Prop drilling 4+ levels deep | Intermediate components pass unused props | Use composition, Context, or global store |
| URL state in useState | Not shareable, lost on refresh, no back button | Use `useSearchParams` or `nuqs` |
| Server data in useState | No caching, stale data, no deduplication | Use TanStack Query or SWR |
| State lifted too high | Parent re-renders children that don't need update | Colocate state closer to where it's used |
| Duplicating state across components | State diverges, inconsistent UI | Single source of truth — lift or globalize |
| Storing ID + full object | Must sync when object updates | Store only ID, derive object from source |
| Not splitting controlled/uncontrolled | Component only works one way | Support both modes with fallback |
| Context for high-frequency updates | All consumers re-render on every update | Use Zustand/Jotai for granular subscriptions |
| Using Redux for simple apps | Massive boilerplate for 3 pieces of state | Use `useState` + Context, or Zustand |

---

## 14. Enforcement Checklist

- [ ] State is colocated with the component that uses it (not lifted prematurely)
- [ ] No form input values stored in global state
- [ ] No derived state stored in useState (computed during render instead)
- [ ] Prop drilling does not exceed 3 levels deep
- [ ] Context is split by update frequency (auth, theme, UI as separate contexts)
- [ ] Context state+dispatch are separated (dispatch context never causes re-renders)
- [ ] URL-worthy state is stored in the URL (search, filters, pagination, tabs)
- [ ] Server data uses a caching library (TanStack Query, SWR) not useState
- [ ] Components support both controlled and uncontrolled patterns where appropriate
- [ ] State is never duplicated — single source of truth exists for every piece of data
- [ ] Global state is reserved for truly cross-cutting concerns (auth, theme, notifications)
- [ ] State placement is reviewed during code review (check for unnecessary lifting)
- [ ] Component composition is used before Context to solve prop drilling
- [ ] `useMemo` is applied to expensive derived computations (not all derivations)
