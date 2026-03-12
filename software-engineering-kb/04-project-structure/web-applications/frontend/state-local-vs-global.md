# Local vs Global State — Complete Specification

> **AI Plugin Directive:** When a developer asks "should this be local or global state?", "where should I put this state?", "how do I avoid prop drilling?", "what is state colocation?", "should I use Context or Zustand?", "when do I lift state up?", "is this server state or client state?", or "should I store this in the URL?", use this directive. State placement is the SINGLE MOST IMPACTFUL architectural decision in a React app. Misplaced state causes cascading re-renders, prop drilling hell, stale data bugs, and unmaintainable code. ALWAYS colocate state as close to where it is used as possible. NEVER put everything in global state — that is the #1 anti-pattern in React.

---

## 1. The Core Rule

**State MUST live as close to where it is consumed as possible. Start with local state (useState). Only lift or globalize when PROVEN necessary. The default is local. Global state is the EXCEPTION, not the rule. If state is only used by one component, it MUST be local. If state is used by siblings, lift to the nearest common parent. If state is used across distant branches, THEN consider global.**

```
STATE PLACEMENT DECISION TREE
==============================

  Is this data from the server?
  │
  ├── YES ──► Use TanStack Query / SWR (SERVER STATE)
  │           NEVER store server data in Redux/Zustand
  │
  └── NO ──► Is this data in the URL? (filters, page, search, tab)
             │
             ├── YES ──► Use URL searchParams (URL STATE)
             │           useSearchParams() / nuqs / next-usequerystate
             │
             └── NO ──► Is this form input data?
                        │
                        ├── YES ──► Use React Hook Form / local useState (FORM STATE)
                        │           NEVER store form fields in global state
                        │
                        └── NO ──► How many components need this?
                                   │
                                   ├── 1 component ──► useState / useReducer (LOCAL)
                                   │
                                   ├── Parent + children ──► useState in parent, pass via props
                                   │
                                   ├── Siblings ──► Lift state to nearest common parent
                                   │
                                   ├── 2-3 levels deep ──► Composition pattern (extracting children)
                                   │                       OR Context (if truly needed)
                                   │
                                   └── App-wide / distant branches ──► Global store
                                       (Zustand / Jotai / Redux Toolkit)
                                       Examples: auth, theme, feature flags, user preferences
```

---

## 2. The Five Categories of State

```
┌──────────────────────────────────────────────────────────────────────┐
│                        STATE TAXONOMY                                │
├─────────────────┬────────────────────┬───────────────────────────────┤
│  Category       │  Examples          │  Tool                         │
├─────────────────┼────────────────────┼───────────────────────────────┤
│  UI State       │  modals, tooltips, │  useState / useReducer        │
│  (local)        │  accordion open,   │  Component-level              │
│                 │  hover, focus      │                               │
├─────────────────┼────────────────────┼───────────────────────────────┤
│  UI State       │  theme, sidebar    │  Zustand / Jotai / Context    │
│  (global)       │  collapsed, locale │  App-level                    │
├─────────────────┼────────────────────┼───────────────────────────────┤
│  Server State   │  user data, orders,│  TanStack Query / SWR         │
│                 │  products, API data│  NEVER Redux/Zustand          │
├─────────────────┼────────────────────┼───────────────────────────────┤
│  URL State      │  search query,     │  useSearchParams / nuqs       │
│                 │  filters, page,    │  URL is the source of truth   │
│                 │  sort, active tab  │                               │
├─────────────────┼────────────────────┼───────────────────────────────┤
│  Form State     │  input values,     │  React Hook Form / useState   │
│                 │  validation errors,│  NEVER global store           │
│                 │  dirty/touched     │                               │
└─────────────────┴────────────────────┴───────────────────────────────┘
```

---

## 3. State Colocation Principle (Kent C. Dodds)

**RULE: Place state as close to where it is relevant as possible. If only ComponentA reads and writes `isOpen`, that state MUST live inside ComponentA. NEVER hoist state to a parent, context, or global store "just in case" something else might need it later.**

### The Colocation Ladder

```
COLOCATION LADDER — GO UP ONLY WHEN NECESSARY
================================================

  Level 5: Global Store (Zustand/Jotai/Redux)
     ^     Use for: auth, theme, feature flags
     |     Re-renders: ALL subscribers
     |
  Level 4: React Context
     ^     Use for: dependency injection, theme, locale
     |     DANGER: Re-renders ALL consumers on ANY change
     |
  Level 3: Nearest Common Parent (lift state up)
     ^     Use for: sibling components that share state
     |     Pass state + setter via props
     |
  Level 2: Parent Component (composition)
     ^     Use for: parent needs to control child behavior
     |     Pass as props to direct children only
     |
  Level 1: Local Component State  ◄── START HERE ALWAYS
           useState / useReducer
           Use for: everything that one component owns
```

### Example: Colocation in Practice

```typescript
// ============================================================
// ANTI-PATTERN: State hoisted unnecessarily to global store
// ============================================================
// store.ts — DON'T DO THIS
import { create } from 'zustand';

interface AppStore {
  isModalOpen: boolean;           // Only used by ONE component!
  tooltipText: string;            // Only used by ONE component!
  accordionIndex: number;         // Only used by ONE component!
  searchQuery: string;            // Should be URL state!
  userData: User | null;          // Should be server state!
  setIsModalOpen: (v: boolean) => void;
  setTooltipText: (v: string) => void;
  setAccordionIndex: (v: number) => void;
  setSearchQuery: (v: string) => void;
  setUserData: (u: User | null) => void;
}

// This store has become a dumping ground for ALL state.
// Every change re-renders every subscriber. Performance disaster.

// ============================================================
// CORRECT: State colocated where it belongs
// ============================================================

// 1. Modal state — LOCAL (only DeleteDialog uses it)
function DeleteDialog() {
  const [isOpen, setIsOpen] = useState(false);   // LOCAL
  const [isConfirming, setIsConfirming] = useState(false);  // LOCAL

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Delete</Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <p>Are you sure?</p>
          <Button
            disabled={isConfirming}
            onClick={async () => {
              setIsConfirming(true);
              await deleteItem();
              setIsOpen(false);
              setIsConfirming(false);
            }}
          >
            Confirm
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

// 2. Search query — URL STATE (shareable, bookmarkable)
function ProductSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  return (
    <Input
      value={query}
      onChange={(e) => {
        setSearchParams({ q: e.target.value }, { replace: true });
      }}
      placeholder="Search products..."
    />
  );
}

// 3. User data — SERVER STATE (TanStack Query)
function UserProfile() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => api.get<User>('/users/me'),
  });

  if (isLoading) return <Skeleton />;
  return <ProfileCard user={user!} />;
}

// 4. Theme — GLOBAL STATE (used across entire app)
// This is a legitimate global state use case
const useThemeStore = create<ThemeStore>()((set) => ({
  theme: 'light' as 'light' | 'dark',
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
}));
```

---

## 4. Lifting State Up vs Composition

### Lifting State Up — When Siblings Share State

```typescript
// ============================================================
// PATTERN: Lift state to nearest common parent
// ============================================================

// Temperature converter — two inputs that must stay in sync
interface TemperatureInputProps {
  scale: 'c' | 'f';
  temperature: string;
  onTemperatureChange: (temp: string) => void;
}

function TemperatureInput({ scale, temperature, onTemperatureChange }: TemperatureInputProps) {
  const scaleNames = { c: 'Celsius', f: 'Fahrenheit' };
  return (
    <fieldset>
      <legend>Enter temperature in {scaleNames[scale]}:</legend>
      <input
        value={temperature}
        onChange={(e) => onTemperatureChange(e.target.value)}
      />
    </fieldset>
  );
}

// State lifted to parent because BOTH children need it
function Calculator() {
  const [temperature, setTemperature] = useState('');
  const [scale, setScale] = useState<'c' | 'f'>('c');

  // DERIVED STATE — compute, don't store
  const celsius = scale === 'f' ? tryConvert(temperature, toCelsius) : temperature;
  const fahrenheit = scale === 'c' ? tryConvert(temperature, toFahrenheit) : temperature;

  function handleCelsiusChange(temp: string) {
    setScale('c');
    setTemperature(temp);
  }

  function handleFahrenheitChange(temp: string) {
    setScale('f');
    setTemperature(temp);
  }

  return (
    <div>
      <TemperatureInput
        scale="c"
        temperature={celsius}
        onTemperatureChange={handleCelsiusChange}
      />
      <TemperatureInput
        scale="f"
        temperature={fahrenheit}
        onTemperatureChange={handleFahrenheitChange}
      />
      <BoilingVerdict celsius={parseFloat(celsius)} />
    </div>
  );
}
```

### Composition Pattern — Avoiding Prop Drilling Without Context

```typescript
// ============================================================
// ANTI-PATTERN: Prop drilling through intermediate components
// ============================================================

// ❌ BAD — UserAvatar needs user, but Header/Navbar don't care
function App() {
  const user = useAuth();
  return <Header user={user} />;          // drills user
}
function Header({ user }: { user: User }) {
  return <Navbar user={user} />;          // drills user
}
function Navbar({ user }: { user: User }) {
  return <UserAvatar user={user} />;      // finally uses user
}

// ============================================================
// CORRECT: Composition pattern — pass the COMPONENT, not data
// ============================================================

// ✅ GOOD — App owns the user, composes the avatar directly
function App() {
  const user = useAuth();
  return (
    <Header
      avatar={<UserAvatar user={user} />}   // Pass composed element
    />
  );
}
function Header({ avatar }: { avatar: React.ReactNode }) {
  return <Navbar avatar={avatar} />;       // Just passes a slot
}
function Navbar({ avatar }: { avatar: React.ReactNode }) {
  return <nav>{avatar}</nav>;              // Renders the slot
}

// ============================================================
// ALSO CORRECT: children as composition
// ============================================================

function App() {
  const user = useAuth();
  return (
    <Layout>
      <Sidebar>
        <UserAvatar user={user} />        {/* Composed directly */}
        <Navigation />
      </Sidebar>
      <Main>
        <Dashboard userId={user.id} />
      </Main>
    </Layout>
  );
}
```

---

## 5. Derived State — Compute, Don't Store

**RULE: If a value can be computed from existing state or props, it MUST NOT have its own state variable. Compute it during render. Storing derived values creates synchronization bugs where the derived value becomes stale.**

```typescript
// ============================================================
// ANTI-PATTERN: Storing derived state
// ============================================================

function ShoppingCart({ items }: { items: CartItem[] }) {
  const [total, setTotal] = useState(0);          // ❌ NEVER
  const [itemCount, setItemCount] = useState(0);  // ❌ NEVER
  const [hasItems, setHasItems] = useState(false); // ❌ NEVER

  // Now you must sync these on every items change:
  useEffect(() => {
    setTotal(items.reduce((sum, i) => sum + i.price * i.qty, 0));
    setItemCount(items.reduce((sum, i) => sum + i.qty, 0));
    setHasItems(items.length > 0);
  }, [items]);
  // BUG: There is a render frame where items changed but total is stale

  // ...
}

// ============================================================
// CORRECT: Compute during render
// ============================================================

function ShoppingCart({ items }: { items: CartItem[] }) {
  // ✅ Derived — computed on every render, ALWAYS in sync
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const hasItems = items.length > 0;

  // ✅ Use useMemo ONLY if computation is expensive (measure first!)
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.price - a.price),
    [items]
  );

  return (
    <div>
      <p>Items: {itemCount} | Total: ${total.toFixed(2)}</p>
      {hasItems && sortedItems.map((item) => (
        <CartItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}
```

---

## 6. URL State — searchParams as State

**RULE: Any state that affects what the user SEES and should be SHAREABLE via link MUST live in the URL. This includes: search queries, filter selections, sort order, pagination page, active tabs, selected items in lists. URL state is free persistence, free sharing, and free browser history.**

```typescript
// ============================================================
// COMPLETE URL STATE EXAMPLE — Product list with filters
// ============================================================

import { useSearchParams } from 'react-router-dom';

// Type-safe URL state parser
interface ProductFilters {
  search: string;
  category: string;
  sortBy: 'price' | 'name' | 'rating';
  sortDir: 'asc' | 'desc';
  page: number;
  minPrice: number | null;
  maxPrice: number | null;
}

function parseFilters(params: URLSearchParams): ProductFilters {
  return {
    search: params.get('q') ?? '',
    category: params.get('category') ?? 'all',
    sortBy: (params.get('sort') as ProductFilters['sortBy']) ?? 'name',
    sortDir: (params.get('dir') as ProductFilters['sortDir']) ?? 'asc',
    page: Math.max(1, parseInt(params.get('page') ?? '1', 10)),
    minPrice: params.has('min') ? Number(params.get('min')) : null,
    maxPrice: params.has('max') ? Number(params.get('max')) : null,
  };
}

function serializeFilters(filters: Partial<ProductFilters>): Record<string, string> {
  const result: Record<string, string> = {};
  if (filters.search) result.q = filters.search;
  if (filters.category && filters.category !== 'all') result.category = filters.category;
  if (filters.sortBy && filters.sortBy !== 'name') result.sort = filters.sortBy;
  if (filters.sortDir && filters.sortDir !== 'asc') result.dir = filters.sortDir;
  if (filters.page && filters.page > 1) result.page = String(filters.page);
  if (filters.minPrice != null) result.min = String(filters.minPrice);
  if (filters.maxPrice != null) result.max = String(filters.maxPrice);
  return result;
}

function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);

  // TanStack Query uses URL state as query key — automatic refetch on URL change
  const { data, isLoading } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => fetchProducts(filters),
  });

  function updateFilter<K extends keyof ProductFilters>(
    key: K,
    value: ProductFilters[K]
  ) {
    const newFilters = { ...filters, [key]: value };
    // Reset page when filters change
    if (key !== 'page') newFilters.page = 1;
    setSearchParams(serializeFilters(newFilters), { replace: true });
  }

  return (
    <div>
      <SearchInput
        value={filters.search}
        onChange={(v) => updateFilter('search', v)}
      />
      <CategorySelect
        value={filters.category}
        onChange={(v) => updateFilter('category', v)}
      />
      <SortControl
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        onSort={(by, dir) => {
          setSearchParams(
            serializeFilters({ ...filters, sortBy: by, sortDir: dir }),
            { replace: true }
          );
        }}
      />
      <ProductGrid products={data?.items ?? []} isLoading={isLoading} />
      <Pagination
        page={filters.page}
        totalPages={data?.totalPages ?? 1}
        onChange={(p) => updateFilter('page', p)}
      />
    </div>
  );
}
```

---

## 7. Context — When and When NOT to Use

```
CONTEXT DECISION TREE
======================

  Do many distant components need this value?
  │
  ├── NO ──► DO NOT use Context. Use props or composition.
  │
  └── YES ──► Does the value change frequently? (> 1x per second)
              │
              ├── YES ──► DO NOT use Context. Use Zustand/Jotai.
              │           Context re-renders ALL consumers on ANY change.
              │           Example: cursor position, animation frame, live data
              │
              └── NO ──► Does the value change sometimes? (user actions)
                         │
                         ├── YES ──► Use Context WITH split contexts
                         │           (separate value context from dispatch context)
                         │           Or just use Zustand/Jotai — simpler API
                         │
                         └── NO (rarely/never changes) ──► Context is PERFECT
                             Examples: theme, locale, auth user, feature flags,
                                       dependency injection
```

### Split Context Pattern (When You Must Use Context for Changing Data)

```typescript
// ============================================================
// ANTI-PATTERN: Single context for everything
// ============================================================

// ❌ BAD — Every consumer re-renders when ANY value changes
const AppContext = createContext<{
  user: User;
  theme: Theme;
  locale: string;
  sidebar: boolean;
  setSidebar: (v: boolean) => void;
  setTheme: (t: Theme) => void;
} | null>(null);
// If sidebar toggles, EVERY component reading theme or user re-renders!

// ============================================================
// CORRECT: Split contexts by change frequency and domain
// ============================================================

// Auth context — changes rarely (login/logout)
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
}
const AuthContext = createContext<AuthContextType | null>(null);

// Theme context — changes rarely (user preference)
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | null>(null);

// Type-safe hooks with mandatory provider check
function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

// Providers — each manages its own state
function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
  });

  // useMemo prevents unnecessary re-renders of consumers
  const value = useMemo<AuthContextType>(
    () => ({ user: user ?? null, isAuthenticated: !!user }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// App composition
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

---

## 8. useReducer — When Local State Gets Complex

**RULE: Switch from useState to useReducer when: (a) multiple state variables change together, (b) next state depends on previous state in complex ways, (c) state transitions follow specific business rules, (d) you want to centralize state update logic for testing.**

```typescript
// ============================================================
// COMPLEX LOCAL STATE: Multi-step form with useReducer
// ============================================================

interface FormState {
  step: 'personal' | 'address' | 'payment' | 'review';
  data: {
    name: string;
    email: string;
    address: string;
    city: string;
    cardNumber: string;
  };
  errors: Record<string, string>;
  isSubmitting: boolean;
  submitError: string | null;
}

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormState['data']; value: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: FormState['step'] }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET' };

const STEP_ORDER: FormState['step'][] = ['personal', 'address', 'payment', 'review'];

const initialState: FormState = {
  step: 'personal',
  data: { name: '', email: '', address: '', city: '', cardNumber: '' },
  errors: {},
  isSubmitting: false,
  submitError: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        data: { ...state.data, [action.field]: action.value },
        // Clear error for this field when user types
        errors: { ...state.errors, [action.field]: '' },
      };

    case 'NEXT_STEP': {
      const idx = STEP_ORDER.indexOf(state.step);
      if (idx < STEP_ORDER.length - 1) {
        return { ...state, step: STEP_ORDER[idx + 1], errors: {} };
      }
      return state;
    }

    case 'PREV_STEP': {
      const idx = STEP_ORDER.indexOf(state.step);
      if (idx > 0) {
        return { ...state, step: STEP_ORDER[idx - 1], errors: {} };
      }
      return state;
    }

    case 'GO_TO_STEP':
      return { ...state, step: action.step, errors: {} };

    case 'SET_ERRORS':
      return { ...state, errors: action.errors };

    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submitError: null };

    case 'SUBMIT_SUCCESS':
      return initialState; // Reset form

    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submitError: action.error };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

function MultiStepForm() {
  const [state, dispatch] = useReducer(formReducer, initialState);

  // Derived state
  const currentStepIndex = STEP_ORDER.indexOf(state.step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;
  const progress = ((currentStepIndex + 1) / STEP_ORDER.length) * 100;

  async function handleSubmit() {
    dispatch({ type: 'SUBMIT_START' });
    try {
      await api.post('/orders', state.data);
      dispatch({ type: 'SUBMIT_SUCCESS' });
    } catch (err) {
      dispatch({
        type: 'SUBMIT_ERROR',
        error: err instanceof Error ? err.message : 'Submission failed',
      });
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <ProgressBar value={progress} />
      <StepIndicator steps={STEP_ORDER} current={state.step} />

      {state.step === 'personal' && (
        <PersonalStep data={state.data} errors={state.errors} dispatch={dispatch} />
      )}
      {state.step === 'address' && (
        <AddressStep data={state.data} errors={state.errors} dispatch={dispatch} />
      )}
      {state.step === 'payment' && (
        <PaymentStep data={state.data} errors={state.errors} dispatch={dispatch} />
      )}
      {state.step === 'review' && (
        <ReviewStep data={state.data} />
      )}

      {state.submitError && <ErrorBanner message={state.submitError} />}

      <div className="flex gap-4">
        {!isFirstStep && (
          <Button type="button" onClick={() => dispatch({ type: 'PREV_STEP' })}>
            Back
          </Button>
        )}
        {isLastStep ? (
          <Button type="submit" disabled={state.isSubmitting}>
            {state.isSubmitting ? 'Submitting...' : 'Submit Order'}
          </Button>
        ) : (
          <Button type="button" onClick={() => dispatch({ type: 'NEXT_STEP' })}>
            Next
          </Button>
        )}
      </div>
    </form>
  );
}
```

---

## 9. Prop Drilling Solutions Comparison

```
┌──────────────────┬──────────────────┬───────────────┬──────────────────────────┐
│  Solution        │  When to Use     │  Complexity   │  Re-render Behavior      │
├──────────────────┼──────────────────┼───────────────┼──────────────────────────┤
│  Props           │  1-2 levels deep │  Lowest       │  Parent + children       │
│                  │  Direct parent   │               │                          │
├──────────────────┼──────────────────┼───────────────┼──────────────────────────┤
│  Composition     │  2-3 levels      │  Low          │  Only the composed       │
│  (children/slots)│  Intermediate    │               │  component               │
│                  │  components don't│               │                          │
│                  │  use the data    │               │                          │
├──────────────────┼──────────────────┼───────────────┼──────────────────────────┤
│  Context         │  Rarely-changing │  Medium       │  ALL consumers on        │
│                  │  app-wide values │               │  ANY context change      │
│                  │  (theme, auth)   │               │  (no selector support)   │
├──────────────────┼──────────────────┼───────────────┼──────────────────────────┤
│  Zustand         │  Any shared      │  Low          │  Only components using   │
│                  │  client state    │               │  the changed slice       │
│                  │                  │               │  (selector-based)        │
├──────────────────┼──────────────────┼───────────────┼──────────────────────────┤
│  Jotai           │  Fine-grained    │  Low          │  Only atoms that changed │
│                  │  shared state    │               │  (atomic updates)        │
│                  │  Bottom-up       │               │                          │
├──────────────────┼──────────────────┼───────────────┼──────────────────────────┤
│  Redux Toolkit   │  Complex state   │  High         │  Selector-based          │
│                  │  with many       │               │  (use createSelector     │
│                  │  actions/reducers│               │   for memoization)       │
└──────────────────┴──────────────────┴───────────────┴──────────────────────────┘
```

---

## 10. Anti-Patterns Table

```
┌───────────────────────────────────┬─────────────────────────────────┬──────────────────────────────────────┐
│  Anti-Pattern                     │  Symptom                        │  Fix                                 │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  Global state for everything      │  Every click re-renders the     │  Colocate state. Use local           │
│                                   │  entire app. 500ms lag on       │  useState for UI state.              │
│                                   │  simple interactions.           │                                      │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  Server data in Redux/Zustand     │  Stale data, manual cache       │  Use TanStack Query / SWR.           │
│                                   │  invalidation, loading state    │  Server state is NOT client state.   │
│                                   │  booleans everywhere.           │                                      │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  Storing derived state            │  useEffect to sync derived      │  Compute during render. Use          │
│  (useEffect + setState)           │  values. One render frame of    │  useMemo only if measurably slow.    │
│                                   │  stale data. Extra re-renders.  │                                      │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  Form state in global store       │  Form input lag. Entire app     │  React Hook Form or local            │
│                                   │  re-renders on every keystroke. │  useState. Forms are LOCAL.          │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  Filter/search state in useState  │  Filters lost on refresh. Can't │  URL searchParams. Shareable,        │
│                                   │  share filtered views via link. │  bookmarkable, free persistence.     │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  Single Context for everything    │  Sidebar toggle re-renders      │  Split contexts by domain            │
│                                   │  every component reading        │  and change frequency. Or use        │
│                                   │  theme/auth from same context.  │  Zustand instead.                    │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  Prop drilling 5+ levels          │  Intermediate components have   │  Composition pattern (pass           │
│                                   │  props they don't use. Changes  │  components, not data). Or           │
│                                   │  cascade through many files.    │  Zustand/Jotai for distant access.   │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  useState for complex state       │  Multiple setState calls in     │  useReducer. Centralize logic.       │
│  machines                         │  handlers. Impossible states    │  Or XState for true FSMs.            │
│                                   │  (isLoading && isError).        │                                      │
├───────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┤
│  Context without useMemo          │  Provider re-renders children   │  Wrap context value in useMemo.      │
│  on value                         │  on every parent render, even   │  Split state and dispatch contexts.  │
│                                   │  if context value hasn't changed│                                      │
└───────────────────────────────────┴─────────────────────────────────┴──────────────────────────────────────┘
```

---

## 11. Enforcement Checklist

```
STATE PLACEMENT REVIEW CHECKLIST
==================================

[ ] Every useState call is in the LOWEST possible component
[ ] No server data stored in Redux/Zustand/Jotai — all in TanStack Query / SWR
[ ] No derived state stored — computed during render or with useMemo
[ ] URL-affecting state (filters, search, sort, page, tabs) uses searchParams
[ ] Form state uses React Hook Form or local useState — NEVER global store
[ ] Context is ONLY used for rarely-changing values (theme, locale, auth)
[ ] Context values are wrapped in useMemo to prevent unnecessary re-renders
[ ] No prop drilling beyond 2 levels — use composition or state library
[ ] useReducer used when 3+ related state variables change together
[ ] Global store (Zustand/Jotai) used ONLY for true app-wide client state:
    auth status, theme, feature flags, user preferences, sidebar state
[ ] No "God store" — state is split into focused, domain-specific stores
[ ] Components that only need dispatch/actions don't subscribe to state values
[ ] Selectors are used with global stores to minimize re-renders
[ ] No useEffect chains that sync state → state → state (waterfall updates)
```

---

## 12. Quick Reference — State Type Decision

```
"Where does this state belong?"

  ┌─ Data from API? ──────────────────────► TanStack Query / SWR
  │
  ├─ In the URL? (filters/search/page) ──► useSearchParams / URL
  │
  ├─ Form input values? ─────────────────► React Hook Form / useState
  │
  ├─ Used by ONE component? ─────────────► useState / useReducer
  │
  ├─ Used by parent + children? ─────────► Props (lift to parent)
  │
  ├─ Used by siblings? ──────────────────► Lift to common parent
  │
  ├─ Used 2-3 levels deep? ─────────────► Composition pattern
  │
  ├─ Rarely changes, app-wide? ─────────► Context (theme, auth)
  │
  └─ Changes often, used across app? ───► Zustand / Jotai
     (shopping cart, notifications,
      sidebar, user preferences)
```
