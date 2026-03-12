# React Hooks Patterns — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do React hooks work?", "which hook should I use?", "how to create custom hooks?", "explain useEffect", "when to use useMemo vs useCallback?", "what are the Rules of Hooks?", or any hook-related question, ALWAYS consult this directive. Apply these hook patterns to write correct, performant React components. NEVER violate the Rules of Hooks. ALWAYS use the simplest hook that solves the problem.

**Core Rule: Hooks are functions that let you "hook into" React's state and lifecycle from function components. ALWAYS call hooks at the top level of your component — NEVER inside conditions, loops, or nested functions. ALWAYS include all reactive values in dependency arrays. Use useState for simple state, useReducer for complex state machines, and TanStack Query for server state — NEVER use useEffect for data fetching in production.**

---

## 1. Hooks Mental Model

```
                    HOOKS EXECUTION MODEL

  Component Function Call
  ┌─────────────────────────────────────┐
  │                                     │
  │  1. useState(init)   → [value, set] │ ← Called EVERY render
  │  2. useRef(init)     → { current }  │ ← Called EVERY render
  │  3. useMemo(fn, [])  → value        │ ← Called EVERY render
  │  4. useCallback(fn,[])→ fn          │ ← Called EVERY render
  │                                     │
  │  5. return <JSX />                  │ ← Render output
  │                                     │
  │  6. useEffect(fn, []) → scheduled  │ ← Runs AFTER paint
  │  7. useLayoutEffect(fn,[])→ sync   │ ← Runs BEFORE paint
  │                                     │
  └─────────────────────────────────────┘

  HOOKS ARE A LINKED LIST:
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Hook #1  │───▶│ Hook #2  │───▶│ Hook #3  │
  │ useState │    │ useRef   │    │ useEffect│
  │ value: 5 │    │ cur: div │    │ fn: ...  │
  └──────────┘    └──────────┘    └──────────┘

  WHY ORDER MATTERS:
  React identifies each hook by its POSITION in the call order.
  If you put a hook inside an if-statement, the order changes
  between renders, and React assigns the wrong state to the wrong hook.
```

---

## 2. useState

```typescript
// BASIC: Simple values
const [count, setCount] = useState(0);
const [name, setName] = useState('');
const [isOpen, setIsOpen] = useState(false);

// OBJECT STATE: Replace entire object (no merging like class setState)
const [user, setUser] = useState<User>({ name: '', age: 0 });
// ❌ WRONG: setUser({ name: 'Alice' }) — loses age
// ✅ CORRECT: setUser(prev => ({ ...prev, name: 'Alice' }))

// LAZY INITIALIZATION: Expensive initial value
// ❌ WRONG: runs EVERY render
const [data, setData] = useState(expensiveComputation());
// ✅ CORRECT: runs ONLY on first render (function form)
const [data, setData] = useState(() => expensiveComputation());

// FUNCTIONAL UPDATES: When new state depends on previous
// ❌ WRONG: Stale closure — count may be outdated
setCount(count + 1);
setCount(count + 1); // Still just +1, not +2
// ✅ CORRECT: Always gets latest value
setCount(c => c + 1);
setCount(c => c + 1); // Actually +2

// RULE: NEVER store derived values in state
// ❌ WRONG:
const [items, setItems] = useState<Item[]>([]);
const [filteredItems, setFilteredItems] = useState<Item[]>([]);
// ✅ CORRECT: Calculate during render
const [items, setItems] = useState<Item[]>([]);
const [filter, setFilter] = useState('');
const filteredItems = items.filter(item => item.name.includes(filter));
```

---

## 3. useReducer

```typescript
// USE WHEN: Multiple related state values, complex state transitions,
// state machine behavior, or when next state depends on previous state

// State + Action types
interface TodoState {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
  editingId: string | null;
}

type TodoAction =
  | { type: 'ADD_TODO'; payload: { text: string } }
  | { type: 'TOGGLE_TODO'; payload: { id: string } }
  | { type: 'DELETE_TODO'; payload: { id: string } }
  | { type: 'SET_FILTER'; payload: { filter: TodoState['filter'] } }
  | { type: 'START_EDITING'; payload: { id: string } }
  | { type: 'STOP_EDITING' };

function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [...state.todos, {
          id: crypto.randomUUID(),
          text: action.payload.text,
          completed: false,
        }],
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
    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter(t => t.id !== action.payload.id),
      };
    case 'SET_FILTER':
      return { ...state, filter: action.payload.filter };
    case 'START_EDITING':
      return { ...state, editingId: action.payload.id };
    case 'STOP_EDITING':
      return { ...state, editingId: null };
    default:
      return state;
  }
}

// Usage
function TodoApp() {
  const [state, dispatch] = useReducer(todoReducer, {
    todos: [],
    filter: 'all',
    editingId: null,
  });

  const visibleTodos = state.todos.filter(todo => {
    if (state.filter === 'active') return !todo.completed;
    if (state.filter === 'completed') return todo.completed;
    return true;
  });

  return (
    <div>
      <AddTodo onAdd={text => dispatch({ type: 'ADD_TODO', payload: { text } })} />
      <TodoList
        todos={visibleTodos}
        onToggle={id => dispatch({ type: 'TOGGLE_TODO', payload: { id } })}
        onDelete={id => dispatch({ type: 'DELETE_TODO', payload: { id } })}
      />
    </div>
  );
}

// DECISION: useState vs useReducer
// useState   → 1-3 independent state values, simple transitions
// useReducer → 3+ related state values, complex transitions, state machines
```

---

## 4. useEffect

```
                    useEffect LIFECYCLE

  Component Render
       │
       ▼
  ┌──────────────┐
  │ Return JSX   │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ Browser      │  ← User sees update
  │ paints DOM   │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ useEffect    │  ← Runs AFTER paint (non-blocking)
  │ callback     │
  └──────┬───────┘
         │
    Next render
         │
         ▼
  ┌──────────────┐
  │ useEffect    │  ← Cleanup from PREVIOUS effect runs first
  │ cleanup      │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ useEffect    │  ← New effect runs
  │ callback     │
  └──────────────┘
```

### 4.1 Effect Categories

```typescript
// CATEGORY 1: Synchronization with external system
// ✅ CORRECT USE of useEffect
useEffect(() => {
  const ws = new WebSocket(`wss://api.example.com/feed/${channelId}`);
  ws.onmessage = (event) => {
    setMessages(prev => [...prev, JSON.parse(event.data)]);
  };
  return () => ws.close(); // ALWAYS cleanup subscriptions
}, [channelId]);

// CATEGORY 2: DOM measurement/mutation
// Use useLayoutEffect instead (see section 5)

// CATEGORY 3: Event listeners
useEffect(() => {
  function handleResize() {
    setWidth(window.innerWidth);
  }
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// CATEGORY 4: Analytics/logging (fire and forget)
useEffect(() => {
  analytics.pageView(pathname);
}, [pathname]);

// ❌ WRONG USES — DO NOT use useEffect for:

// ❌ Data fetching (use TanStack Query instead)
useEffect(() => {
  fetch('/api/users').then(r => r.json()).then(setUsers);
}, []); // No loading state, no error handling, no caching, race conditions

// ❌ Derived state (calculate during render instead)
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]); // Extra render cycle, unnecessary

// ❌ Responding to events (use event handlers instead)
useEffect(() => {
  if (submitted) {
    navigate('/success');
  }
}, [submitted]); // Hard to follow, timing issues

// ❌ Resetting state on prop change (use key instead)
useEffect(() => {
  setComment('');
}, [postId]); // Use <CommentForm key={postId} /> instead
```

### 4.2 Race Condition Prevention

```typescript
// PROBLEM: User types fast, responses come back out of order
// ❌ RACE CONDITION:
useEffect(() => {
  fetch(`/api/search?q=${query}`)
    .then(r => r.json())
    .then(setResults); // May set stale results!
}, [query]);

// ✅ FIX 1: AbortController (recommended)
useEffect(() => {
  const controller = new AbortController();

  async function search() {
    try {
      const res = await fetch(`/api/search?q=${query}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      setResults(data); // Only sets if not aborted
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // Expected — ignore aborted requests
      }
      throw err;
    }
  }

  search();
  return () => controller.abort(); // Cancel on cleanup
}, [query]);

// ✅ FIX 2: Boolean flag (simpler but doesn't cancel network request)
useEffect(() => {
  let cancelled = false;

  async function search() {
    const res = await fetch(`/api/search?q=${query}`);
    const data = await res.json();
    if (!cancelled) setResults(data);
  }

  search();
  return () => { cancelled = true; };
}, [query]);

// ✅ FIX 3: Use TanStack Query (BEST — handles everything automatically)
const { data: results } = useQuery({
  queryKey: ['search', query],
  queryFn: () => fetch(`/api/search?q=${query}`).then(r => r.json()),
  enabled: query.length > 0,
});
```

### 4.3 Dependency Array Rules

```typescript
// EXHAUSTIVE DEPS RULE:
// Every reactive value used inside the effect MUST be in the dependency array

// ❌ Missing dependency — stale closure
useEffect(() => {
  const interval = setInterval(() => {
    setCount(count + 1); // 'count' is stale — always the initial value
  }, 1000);
  return () => clearInterval(interval);
}, []); // ESLint warns: 'count' missing from deps

// ✅ Fix with functional update
useEffect(() => {
  const interval = setInterval(() => {
    setCount(c => c + 1); // No external dependency needed
  }, 1000);
  return () => clearInterval(interval);
}, []); // ✅ No dependencies needed

// DEPENDENCY TYPES:
// Stable (don't need in deps): setState, dispatch, useRef.current, module-level
// Reactive (MUST be in deps): props, state, variables calculated from them

// ⚠️ OBJECT/ARRAY DEPENDENCIES:
// Objects created during render change reference every render
// ❌ INFINITE LOOP:
const options = { method: 'GET', headers: {} }; // New object every render
useEffect(() => {
  fetch(url, options);
}, [options]); // options !== options on every render

// ✅ FIX: Move object inside effect, or useMemo, or extract individual values
useEffect(() => {
  fetch(url, { method: 'GET', headers: {} });
}, [url]); // Only primitive in deps
```

---

## 5. useLayoutEffect vs useEffect vs useInsertionEffect

```
EFFECT TIMING:

  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  Render  │─▶│ DOM       │─▶│ useLayout│─▶│ Browser  │─▶│ useEffect│
  │  Phase   │  │ Mutations │  │ Effect   │  │ Paints   │  │          │
  │ (virtual)│  │ (applied) │  │ (sync)   │  │ (visual) │  │ (async)  │
  └──────────┘  └───────────┘  └──────────┘  └──────────┘  └──────────┘
                                    ↑                            ↑
                      Blocks paint  │                  After paint│

  useInsertionEffect → BEFORE DOM mutations (CSS-in-JS libraries ONLY)
  useLayoutEffect    → AFTER DOM mutations, BEFORE browser paint
  useEffect          → AFTER browser paint (non-blocking)
```

```typescript
// useEffect (DEFAULT — use this 95% of the time)
// Non-blocking, runs after paint
useEffect(() => {
  document.title = `${count} items`;
}, [count]);

// useLayoutEffect (RARE — DOM measurement/mutation before paint)
// Blocks paint — use ONLY when visual flicker would occur
useLayoutEffect(() => {
  // Measure DOM element
  const { height } = ref.current.getBoundingClientRect();
  // Set state based on measurement (no flicker)
  setTooltipPosition(calculatePosition(height));
}, []);

// useInsertionEffect (LIBRARY AUTHORS ONLY)
// Injects <style> tags before any DOM reads
useInsertionEffect(() => {
  const style = document.createElement('style');
  style.textContent = `.dynamic-class { color: red; }`;
  document.head.appendChild(style);
  return () => style.remove();
}, []);

// DECISION TREE:
// Q: Does the effect need to read/modify DOM before user sees it?
//   YES → useLayoutEffect
//   NO  → useEffect (default)
// Q: Are you building a CSS-in-JS library?
//   YES → useInsertionEffect
//   NO  → Never use useInsertionEffect
```

---

## 6. useRef

```typescript
// PURPOSE 1: Reference DOM elements
function TextInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  function focusInput() {
    inputRef.current?.focus();
  }

  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onClick={focusInput}>Focus</button>
    </div>
  );
}

// PURPOSE 2: Persist values across renders WITHOUT triggering re-render
function Timer() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderCountRef = useRef(0);

  renderCountRef.current++; // Tracks renders without causing re-render

  function startTimer() {
    intervalRef.current = setInterval(() => {
      // ...
    }, 1000);
  }

  function stopTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }

  useEffect(() => {
    return () => stopTimer(); // Cleanup on unmount
  }, []);
}

// PURPOSE 3: Store previous value
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

// RULES:
// - NEVER read or write ref.current during render (except initialization)
// - refs are for "escape hatches" — side effects, DOM, mutable values
// - Changing ref.current does NOT trigger re-render
// - ref.current is available after the component mounts (null before)
```

---

## 7. useMemo & useCallback

```typescript
// useMemo: Memoize EXPENSIVE CALCULATIONS
// ✅ CORRECT USE: Genuinely expensive computation
const sortedItems = useMemo(() => {
  return items
    .filter(item => item.status === filter)
    .sort((a, b) => a.name.localeCompare(b.name));
}, [items, filter]);

// ❌ WRONG USE: Cheap computation (overhead of memo > computation cost)
const fullName = useMemo(() => `${first} ${last}`, [first, last]);
// Just do: const fullName = `${first} ${last}`;

// useCallback: Memoize FUNCTION REFERENCES
// ✅ CORRECT USE: Callback passed to memoized child or in deps
const handleDelete = useCallback((id: string) => {
  setItems(prev => prev.filter(item => item.id !== id));
}, []);

// Used with React.memo child:
const MemoizedList = memo(function List({ onDelete }: { onDelete: (id: string) => void }) {
  return items.map(item => <Item key={item.id} onDelete={onDelete} />);
});

// ❌ WRONG USE: Callback not passed to memoized child
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []); // Pointless — Button is not memoized
return <button onClick={handleClick}>+1</button>;
```

### 7.1 When to Memoize Decision Tree

```
SHOULD I USE useMemo/useCallback?

START: Is React Compiler (React Forget) enabled?
├── YES → DON'T manually memoize. Compiler handles it.
└── NO ↓

Q1: Is the computation genuinely expensive? (>1ms, complex sort/filter/transform)
├── YES → useMemo ✅
└── NO ↓

Q2: Is the value passed as a prop to a React.memo() child?
├── YES → useMemo/useCallback ✅ (preserves referential equality)
└── NO ↓

Q3: Is the value in a useEffect/useMemo dependency array?
├── YES → useMemo/useCallback ✅ (prevents effect re-runs)
└── NO → DON'T memoize ❌ (overhead > benefit)

RULE: When in doubt, DON'T memoize. Measure first, optimize second.
      React is fast by default. Premature optimization is harmful.
```

---

## 8. useContext

```typescript
// CREATE context with default value
interface AuthContextValue {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// PROVIDER: Supply value to subtree
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback(async (credentials: Credentials) => {
    const user = await authApi.login(credentials);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  // ✅ Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({ user, login, logout, isLoading }),
    [user, login, logout, isLoading]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
  // React 19: <AuthContext> instead of <AuthContext.Provider>
}

// CONSUMER: Custom hook (ALWAYS wrap useContext in custom hook)
function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// USAGE
function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return <LoginButton />;
  return (
    <div>
      <span>{user.name}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

// RULES:
// - ALWAYS create a custom hook wrapper (never raw useContext in components)
// - ALWAYS check for null and throw descriptive error
// - Context is for DEPENDENCY INJECTION, not state management
// - Appropriate for: theme, locale, auth, router, feature flags
// - NOT appropriate for: frequently changing data, complex state trees
```

### 8.1 Context Splitting to Prevent Re-renders

```typescript
// PROBLEM: Changing one value re-renders ALL consumers
// ❌ Single monolith context
const AppContext = createContext({ theme, user, notifications, settings });
// Changing theme re-renders notification consumers

// ✅ Split into focused contexts
const ThemeContext = createContext<Theme>(defaultTheme);
const UserContext = createContext<User | null>(null);
const NotificationContext = createContext<Notification[]>([]);

// Each consumer only re-renders when ITS context changes
function ThemeToggle() {
  const theme = useContext(ThemeContext); // Only re-renders on theme change
}

// ✅ Split state from dispatch (advanced pattern)
const TodosContext = createContext<Todo[]>([]);
const TodosDispatchContext = createContext<Dispatch<TodoAction>>(() => {});

// Components that only dispatch never re-render on state changes
function AddTodo() {
  const dispatch = useContext(TodosDispatchContext); // Stable — never changes
  // This component does NOT re-render when todos change
}
```

---

## 9. React 19 Hooks

### 9.1 useActionState

```typescript
// Replaces useFormState — manages form action state
import { useActionState } from 'react';

async function updateProfile(prevState: FormState, formData: FormData) {
  'use server';

  const name = formData.get('name') as string;
  if (!name) return { error: 'Name is required', success: false };

  await db.user.update({ where: { id: userId }, data: { name } });
  return { error: null, success: true };
}

function ProfileForm() {
  const [state, action, isPending] = useActionState(updateProfile, {
    error: null,
    success: false,
  });

  return (
    <form action={action}>
      <input name="name" disabled={isPending} />
      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">Updated!</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

### 9.2 useFormStatus

```typescript
// Read parent form's submission status
import { useFormStatus } from 'react-dom';

// MUST be a child of <form> — cannot read its own form
function SubmitButton({ label = 'Submit' }: { label?: string }) {
  const { pending, data, method, action } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : label}
    </button>
  );
}

// Usage — SubmitButton MUST be inside a <form>
function ContactForm() {
  return (
    <form action={submitContact}>
      <input name="email" type="email" />
      <textarea name="message" />
      <SubmitButton label="Send Message" />
    </form>
  );
}
```

### 9.3 useOptimistic

```typescript
// Show optimistic state while async action is pending
import { useOptimistic } from 'react';

function LikeButton({ liked, likeCount, onToggle }: LikeButtonProps) {
  const [optimistic, setOptimistic] = useOptimistic(
    { liked, likeCount },
    (current, newLiked: boolean) => ({
      liked: newLiked,
      likeCount: current.likeCount + (newLiked ? 1 : -1),
    })
  );

  async function handleToggle() {
    setOptimistic(!optimistic.liked); // Immediately update UI
    await onToggle(!optimistic.liked); // Server call — reverts on error
  }

  return (
    <button onClick={handleToggle}>
      {optimistic.liked ? '❤️' : '🤍'} {optimistic.likeCount}
    </button>
  );
}
```

### 9.4 use()

```typescript
// use() can read promises and context — CAN be called conditionally
import { use } from 'react';

// Reading a promise (with Suspense)
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // Suspends until resolved
  return <h1>{user.name}</h1>;
}

// Reading context conditionally
function Panel({ showBorder }: { showBorder: boolean }) {
  if (showBorder) {
    const theme = use(ThemeContext); // ✅ Conditional — unique to use()
    return <div style={{ border: `1px solid ${theme.borderColor}` }}>...</div>;
  }
  return <div>...</div>;
}

// RULES:
// - use(promise) MUST be wrapped in Suspense
// - use(context) replaces useContext — works conditionally
// - Can be called in loops and conditionals (unlike other hooks)
// - Promise MUST be created outside component or in a Server Component
```

---

## 10. Custom Hooks

```typescript
// RULE: Extract reusable logic into custom hooks
// Convention: MUST start with "use" prefix

// ✅ Custom hook: useLocalStorage
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      window.localStorage.setItem(key, JSON.stringify(newValue));
      return newValue;
    });
  }, [key]);

  return [storedValue, setValue] as const;
}

// ✅ Custom hook: useMediaQuery
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    function handleChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

// ✅ Custom hook: useDebounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ✅ Custom hook: useIntersectionObserver
function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options?.threshold, options?.root, options?.rootMargin]);

  return isIntersecting;
}

// COMPOSITION: Custom hooks can use other custom hooks
function useSearchWithDebounce(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchApi(debouncedQuery),
    enabled: debouncedQuery.length > (isMobile ? 1 : 2),
  });

  return { query, setQuery, results: data, isLoading };
}
```

---

## 11. Specialized Hooks

```typescript
// useId — Generate unique IDs for accessibility
function FormField({ label }: { label: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} />
    </div>
  );
}
// RULE: NEVER use for list keys. Only for HTML id/aria attributes.

// useSyncExternalStore — Subscribe to external stores
function useOnlineStatus() {
  return useSyncExternalStore(
    // subscribe
    (callback) => {
      window.addEventListener('online', callback);
      window.addEventListener('offline', callback);
      return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
      };
    },
    // getSnapshot (client)
    () => navigator.onLine,
    // getServerSnapshot (SSR)
    () => true
  );
}

// useDeferredValue — Defer non-urgent updates
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div style={{ opacity: isStale ? 0.7 : 1 }}>
      <SlowList query={deferredQuery} />
    </div>
  );
}

// useTransition — Mark state updates as non-urgent
function TabContainer() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();

  function selectTab(nextTab: string) {
    startTransition(() => {
      setTab(nextTab); // Non-urgent — won't block input
    });
  }

  return (
    <div>
      <TabBar selectedTab={tab} onSelect={selectTab} />
      {isPending && <Spinner />}
      <TabContent tab={tab} />
    </div>
  );
}

// useImperativeHandle — Customize ref exposed to parent (RARE)
function FancyInput({ ref }: { ref: Ref<FancyInputHandle> }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      if (inputRef.current) inputRef.current.value = '';
    },
    getValue: () => inputRef.current?.value ?? '',
  }));

  return <input ref={inputRef} />;
}
```

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **useEffect for data fetching** | Race conditions, no caching, no loading/error states, waterfalls | Use TanStack Query, SWR, or Server Components |
| **useEffect for derived state** | Extra render cycle, stale computed values, unnecessary complexity | Calculate during render: `const total = items.reduce(...)` |
| **Missing cleanup in useEffect** | Memory leaks, stale subscriptions, zombie listeners | ALWAYS return cleanup function for subscriptions/timers |
| **Missing dependencies in dep array** | Stale closures, outdated values, subtle bugs | Include ALL reactive values, use functional updates for setState |
| **Object/array in dependency array** | Infinite re-render loops, effect runs every render | Extract primitives, move creation inside effect, or useMemo |
| **Conditional hooks** | "Rendered more hooks than previous render" crash | ALWAYS call hooks at top level — no conditions, loops, or early returns before hooks |
| **useState for derived values** | State sync bugs, extra re-renders, conflicting state | Delete the derived state, calculate from source of truth |
| **Over-memoizing everything** | Harder to read code, potential memory issues, marginal perf gain | Only memoize expensive computations or referential equality needs |
| **useEffect as event handler** | Timing bugs, extra renders, hard to trace data flow | Move logic to the actual event handler function |
| **useRef for reactive values** | UI doesn't update when value changes, stale display | Use useState if value should trigger re-render |
| **Ignoring ESLint exhaustive-deps** | Stale closures, bugs that only appear intermittently | Fix the warning — restructure if needed, don't suppress |
| **setInterval without cleanup** | Timer runs after unmount, state updates on unmounted component | Clear interval in cleanup, use ref for interval ID |
| **Creating promises in client components for use()** | Infinite render loops, suspense re-triggers | Create promise outside component or receive as prop |

---

## 13. Enforcement Checklist

### Rules of Hooks
- [ ] ALL hooks called at the top level of components/custom hooks
- [ ] NO hooks inside conditions, loops, nested functions, or after early returns
- [ ] ESLint `react-hooks/rules-of-hooks` rule set to ERROR
- [ ] ESLint `react-hooks/exhaustive-deps` rule set to ERROR (never WARN)

### useEffect
- [ ] EVERY useEffect that creates subscriptions has cleanup
- [ ] NO useEffect used for data fetching (use TanStack Query or Server Components)
- [ ] NO useEffect used for derived state (calculate during render)
- [ ] Dependency arrays include ALL reactive values
- [ ] Race conditions handled with AbortController for async effects
- [ ] No objects or arrays created inline in dependency arrays

### State Management
- [ ] useState used for simple local state (1-3 values)
- [ ] useReducer used for complex related state (3+ values, state machines)
- [ ] Derived values calculated during render (NOT stored in state)
- [ ] Functional updates used when new state depends on previous state

### Custom Hooks
- [ ] Reusable logic extracted into custom hooks (prefix: `use`)
- [ ] Custom hooks are testable in isolation
- [ ] Custom hooks have proper TypeScript types
- [ ] Custom hooks follow single responsibility principle

### Performance Hooks
- [ ] useMemo used ONLY for expensive computations (>1ms)
- [ ] useCallback used ONLY when passed to memoized children or in deps
- [ ] React Compiler evaluated before manual memoization
- [ ] useTransition used for non-urgent state updates
- [ ] useDeferredValue used to defer expensive renders

### Context
- [ ] Context wrapped in custom hook with null check
- [ ] Context values memoized with useMemo
- [ ] Context split into focused providers (not monolith)
- [ ] Context used for dependency injection (not state management)
