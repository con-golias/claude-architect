# React Performance — Complete Specification

> **AI Plugin Directive:** When a developer asks "why is my React app slow?", "how to optimize React rendering?", "when should I use React.memo?", "how to profile React?", "how to reduce re-renders?", "what causes unnecessary re-renders?", or any React performance question, ALWAYS consult this directive. Apply these optimization strategies in order: measure first, then split components, then memoize as last resort. NEVER optimize without measuring. The React Compiler eliminates most manual memoization needs.

**Core Rule: React is FAST by default — most performance problems come from architecture, not React itself. ALWAYS measure before optimizing. The correct optimization order is: 1) Fix architecture (component splitting, state colocation), 2) Reduce work (virtualization, pagination), 3) Memoize as last resort. NEVER sprinkle React.memo/useMemo/useCallback everywhere — the React Compiler handles this automatically. Focus on eliminating unnecessary work, not preventing re-renders.**

---

## 1. Understanding React Re-renders

```
            WHEN DOES A COMPONENT RE-RENDER?

  ┌──────────────────────────────────────────────────────┐
  │ Trigger                        │ Re-renders?         │
  ├────────────────────────────────┼─────────────────────┤
  │ Its own state changes          │ ✅ YES (always)     │
  │ Parent re-renders              │ ✅ YES (by default) │
  │ Context value changes          │ ✅ YES              │
  │ Props change                   │ ✅ YES              │
  │ Props SAME but parent renders  │ ✅ YES (still!)     │
  │ Sibling re-renders             │ ❌ NO               │
  │ Ref changes                    │ ❌ NO               │
  │ Store selector returns same    │ ❌ NO (Zustand/etc) │
  └────────────────────────────────┴─────────────────────┘

  KEY INSIGHT:
  When a parent re-renders, ALL its children re-render too,
  even if their props haven't changed. This is by design —
  React assumes re-rendering is cheap (and it usually is).

  RE-RENDER ≠ DOM UPDATE:
  React re-renders (runs your component function) but only
  updates the DOM if the output actually changed.
  Re-rendering is the RECONCILIATION step, not the DOM step.
```

### 1.1 Re-render Cascade

```
STATE CHANGE IN PARENT:

  App                    ← Does NOT re-render (above the state)
  └── Dashboard          ← STATE CHANGES HERE → re-renders
      ├── Header         ← Re-renders (child of Dashboard)
      │   ├── Logo       ← Re-renders (child of Header)
      │   └── Nav        ← Re-renders (child of Header)
      ├── Sidebar        ← Re-renders (child of Dashboard)
      │   └── MenuItems  ← Re-renders (child of Sidebar)
      └── Content        ← Re-renders (child of Dashboard)
          ├── Chart      ← Re-renders (child of Content)
          └── Table      ← Re-renders (child of Content)
              └── 100 rows ← ALL re-render

  PROBLEM: Only Content needed the state update,
  but Header, Sidebar, and their children all re-render too.
```

---

## 2. Architecture-First Optimization

### 2.1 Move State Down

```typescript
// ❌ PROBLEM: State too high — entire Dashboard re-renders
function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div>
      <Header />                           {/* Re-renders unnecessarily */}
      <Sidebar />                          {/* Re-renders unnecessarily */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
      />
      <SearchResults query={searchQuery} />
    </div>
  );
}

// ✅ FIX: Move state down to where it's needed
function Dashboard() {
  return (
    <div>
      <Header />                           {/* Does NOT re-render */}
      <Sidebar />                          {/* Does NOT re-render */}
      <SearchSection />                    {/* Only this re-renders */}
    </div>
  );
}

function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <>
      <SearchInput value={searchQuery} onChange={setSearchQuery} />
      <SearchResults query={searchQuery} />
    </>
  );
}
```

### 2.2 Children as Props Pattern

```typescript
// ❌ PROBLEM: Animated wrapper re-renders children on every frame
function AnimatedContainer() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY }); // Updates 60 fps
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      <ExpensiveTree />   {/* Re-renders 60 times per second! */}
    </div>
  );
}

// ✅ FIX: Pass expensive content as children
function AnimatedContainer({ children }: { children: ReactNode }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      {children}   {/* Does NOT re-render — same React element reference */}
    </div>
  );
}

// Usage:
function App() {
  return (
    <AnimatedContainer>
      <ExpensiveTree />  {/* Created in App, passed as prop — stable reference */}
    </AnimatedContainer>
  );
}
```

### 2.3 Component Composition to Isolate Updates

```typescript
// ❌ PROBLEM: Theme toggle re-renders entire page
function Page() {
  const [isDark, setIsDark] = useState(false);

  return (
    <div className={isDark ? 'dark' : 'light'}>
      <button onClick={() => setIsDark(d => !d)}>Toggle</button>
      <Header />             {/* Unnecessary re-render */}
      <HeavyContent />       {/* Unnecessary re-render */}
      <Footer />             {/* Unnecessary re-render */}
    </div>
  );
}

// ✅ FIX: Extract the stateful part
function ThemeWrapper({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  return (
    <div className={isDark ? 'dark' : 'light'}>
      <button onClick={() => setIsDark(d => !d)}>Toggle</button>
      {children}   {/* Children don't re-render */}
    </div>
  );
}

function Page() {
  return (
    <ThemeWrapper>
      <Header />             {/* Stable — no re-render */}
      <HeavyContent />       {/* Stable — no re-render */}
      <Footer />             {/* Stable — no re-render */}
    </ThemeWrapper>
  );
}
```

---

## 3. React.memo

```typescript
// React.memo prevents re-renders when props haven't changed
// Use ONLY when: component is expensive AND receives same props frequently

// ✅ CORRECT USE: Expensive component with stable parent
const ExpensiveChart = memo(function ExpensiveChart({ data }: { data: number[] }) {
  // Complex SVG rendering, thousands of data points
  return <svg>{/* expensive render */}</svg>;
});

// ✅ CORRECT USE: List items (many instances, parent changes frequently)
const TodoItem = memo(function TodoItem({ todo, onToggle }: TodoItemProps) {
  return (
    <li>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
      />
      {todo.text}
    </li>
  );
});

// ❌ WRONG USE: Simple/cheap component
const Label = memo(function Label({ text }: { text: string }) {
  return <span>{text}</span>; // Cheaper to re-render than to memoize
});

// ❌ WRONG USE: Props change every render (defeats memo)
const Item = memo(function Item({ style }: { style: CSSProperties }) {
  return <div style={style}>...</div>;
});
// Parent: <Item style={{ color: 'red' }} /> ← New object every render!

// ⚠️ CUSTOM COMPARISON (rare — only for complex props)
const DataGrid = memo(
  function DataGrid({ rows, columns }: DataGridProps) { /* ... */ },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return (
      prevProps.rows.length === nextProps.rows.length &&
      prevProps.columns === nextProps.columns
    );
  }
);
```

### 3.1 React.memo Decision Tree

```
SHOULD I USE React.memo?

Q1: Is the React Compiler (React Forget) enabled?
├── YES → Don't use React.memo — compiler handles it automatically
└── NO ↓

Q2: Is this component expensive to render? (>1ms render time)
├── NO → Don't use React.memo (re-render is cheaper than comparison)
└── YES ↓

Q3: Does the component re-render often with the SAME props?
├── NO → Don't use React.memo (props change anyway, memo is wasted)
└── YES ↓

Q4: Can you fix it with architecture? (move state down, children pattern)
├── YES → Fix architecture FIRST (better long-term solution)
└── NO → Use React.memo ✅

REMEMBER: React.memo has a COST:
  - Props comparison on every render
  - Memory for memoized result
  - Code complexity
  - Only helps if props are frequently the same
```

---

## 4. List Performance

### 4.1 Virtualization

```typescript
// RULE: Virtualize lists with 100+ items — render only visible items

// ✅ OPTION 1: TanStack Virtual (framework-agnostic, flexible)
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated row height in px
    overscan: 5, // Extra items rendered above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ItemRow item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ✅ OPTION 2: react-window (simpler API, fixed/variable sizes)
import { FixedSizeList } from 'react-window';

function SimpleVirtualList({ items }: { items: Item[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <ItemRow item={items[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}

// DECISION:
// < 50 items   → No virtualization needed
// 50-500 items → Consider virtualization if items are complex
// 500+ items   → ALWAYS virtualize
// 10,000+ items → Virtualize + pagination/infinite scroll
```

### 4.2 Key Performance

```typescript
// KEYS affect reconciliation performance

// ❌ NEVER: Index as key for dynamic lists
{items.map((item, index) => (
  <ListItem key={index} item={item} />  // Reorder/insert breaks everything
))}

// ❌ NEVER: Random keys
{items.map(item => (
  <ListItem key={Math.random()} item={item} />  // Recreates ALL items every render
))}

// ✅ ALWAYS: Stable unique ID from data
{items.map(item => (
  <ListItem key={item.id} item={item} />  // Efficient diffing
))}

// ✅ Exception: Static lists that never reorder (index is fine)
{['Home', 'About', 'Contact'].map((label, i) => (
  <NavLink key={i}>{label}</NavLink>  // OK — static, never changes
))}
```

---

## 5. Code Splitting

```typescript
// RULE: Split at ROUTE boundaries and for heavy components

// ✅ Route-level splitting with React.lazy
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />  {/* Inline — always loaded */}
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <Dashboard />
          </Suspense>
        }
      />
      <Route
        path="/settings"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <Settings />
          </Suspense>
        }
      />
    </Routes>
  );
}

// ✅ Component-level splitting for heavy UI
const HeavyEditor = lazy(() => import('./components/CodeEditor'));
const HeavyChart = lazy(() => import('./components/Chart'));

function EditorPanel({ showEditor }: { showEditor: boolean }) {
  if (!showEditor) return <Placeholder />;

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <HeavyEditor />  {/* Only loads when shown */}
    </Suspense>
  );
}

// ✅ Named export with lazy
const LazyChart = lazy(() =>
  import('./components/Charts').then(module => ({
    default: module.BarChart,
  }))
);

// ✅ Preloading on hover/focus (anticipate navigation)
function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const preload = () => {
    // Webpack magic comment for preloading
    if (to === '/dashboard') import('./pages/Dashboard');
    if (to === '/settings') import('./pages/Settings');
  };

  return (
    <Link to={to} onMouseEnter={preload} onFocus={preload}>
      {children}
    </Link>
  );
}
```

---

## 6. Context Performance

```typescript
// PROBLEM: Context re-renders ALL consumers when ANY value changes

// ❌ MONOLITH CONTEXT (everything re-renders on any change)
const AppContext = createContext({
  theme: 'light',
  user: null,
  notifications: [],
  locale: 'en',
  setTheme: () => {},
  setLocale: () => {},
});
// Changing theme re-renders notification consumers!

// ✅ FIX 1: Split contexts by update frequency
const ThemeContext = createContext<{ theme: string; setTheme: (t: string) => void }>();
const UserContext = createContext<User | null>(null);
const NotificationContext = createContext<Notification[]>([]);

// ✅ FIX 2: Separate state from dispatch
const TodoStateContext = createContext<Todo[]>([]);
const TodoDispatchContext = createContext<Dispatch<TodoAction>>(() => {});

function TodoProvider({ children }: { children: ReactNode }) {
  const [todos, dispatch] = useReducer(todoReducer, []);

  return (
    <TodoStateContext value={todos}>
      <TodoDispatchContext value={dispatch}>
        {children}
      </TodoDispatchContext>
    </TodoStateContext>
  );
}

// Components that only ADD todos don't re-render when list changes
function AddTodo() {
  const dispatch = useContext(TodoDispatchContext); // Stable reference
  // Only re-renders if dispatch changes (it doesn't)
}

// ✅ FIX 3: Use Zustand/Jotai instead of Context for frequent updates
// Context is for DEPENDENCY INJECTION, not state management
import { create } from 'zustand';

const useStore = create<StoreState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

// Only re-renders when selected value changes
function Counter() {
  const count = useStore((s) => s.count); // Selector — fine-grained
}
```

---

## 7. Measuring Performance

### 7.1 React DevTools Profiler

```
PROFILER WORKFLOW:

1. Open React DevTools → Profiler tab
2. Click ⚙️ → Enable "Record why each component rendered"
3. Click Record (⏺️)
4. Perform the slow interaction
5. Click Stop (⏹️)
6. Analyze:

  FLAME CHART:
  ┌──────────────────────────────────────────────────┐
  │ App (0.2ms)                                      │
  │ ├── Header (0.1ms)                               │  ← Grey = didn't render
  │ ├── Dashboard (15.2ms)                           │  ← Yellow = slow
  │ │   ├── MetricsGrid (12.1ms)                     │  ← RED = very slow
  │ │   │   ├── MetricCard (0.3ms) × 20              │
  │ │   │   └── Chart (8.5ms)                        │  ← Target for optimization
  │ │   └── ActivityFeed (2.8ms)                     │
  │ └── Footer (0.1ms)                               │  ← Grey = didn't render
  └──────────────────────────────────────────────────┘

  WHY DID THIS RENDER?
  • Props changed: data
  • Parent re-rendered
  • State changed: isExpanded
  • Context changed: ThemeContext

  TARGET: Components > 16ms (one frame at 60fps)
```

### 7.2 Performance Measurement API

```typescript
// Measure render time programmatically
import { Profiler, ProfilerOnRenderCallback } from 'react';

const onRender: ProfilerOnRenderCallback = (
  id,           // Component tree being profiled
  phase,        // "mount" | "update" | "nested-update"
  actualDuration, // Time spent rendering
  baseDuration,   // Time without memoization
  startTime,
  commitTime
) => {
  if (actualDuration > 16) {
    console.warn(`Slow render: ${id} took ${actualDuration.toFixed(2)}ms`);
  }

  // Send to analytics
  analytics.timing('react.render', actualDuration, { component: id, phase });
};

function App() {
  return (
    <Profiler id="Dashboard" onRender={onRender}>
      <Dashboard />
    </Profiler>
  );
}

// Web Vitals measurement
import { onLCP, onFID, onCLS, onINP, onTTFB } from 'web-vitals';

onLCP(metric => sendToAnalytics('LCP', metric));
onINP(metric => sendToAnalytics('INP', metric));
onCLS(metric => sendToAnalytics('CLS', metric));
onFID(metric => sendToAnalytics('FID', metric));
onTTFB(metric => sendToAnalytics('TTFB', metric));
```

---

## 8. Bundle Size Optimization

```
BUNDLE SIZE REDUCTION STRATEGIES:

1. ANALYZE first:
   npx webpack-bundle-analyzer stats.json
   npx source-map-explorer build/static/js/*.js
   npx vite-bundle-visualizer

2. COMMON CULPRITS:
   ┌─────────────────────────┬──────────┬────────────────────────┐
   │ Library                 │ Size     │ Lightweight Alternative │
   ├─────────────────────────┼──────────┼────────────────────────┤
   │ moment.js               │ 300KB    │ date-fns (tree-shake)  │
   │ lodash (full)           │ 70KB     │ lodash-es (tree-shake) │
   │ @mui/material (full)    │ 300KB+   │ Import specific files  │
   │ chart.js                │ 200KB    │ Lightweight: recharts  │
   │ aws-sdk v2              │ 500KB+   │ @aws-sdk/client-*      │
   │ i18next (full)          │ 40KB     │ Lazy-load translations │
   │ react-icons (all)       │ 3MB+     │ Import specific icon   │
   └─────────────────────────┴──────────┴────────────────────────┘

3. TREE SHAKING:
   // ❌ Imports entire library
   import { debounce } from 'lodash';

   // ✅ Imports only the function
   import debounce from 'lodash/debounce';

   // ❌ Barrel file re-exports everything
   import { Button } from '@/components'; // May pull in ALL components

   // ✅ Direct import
   import { Button } from '@/components/ui/Button';

4. DYNAMIC IMPORTS for heavy features:
   const PDF = lazy(() => import('./pdf-viewer'));
   const Editor = lazy(() => import('./rich-text-editor'));
```

---

## 9. Image and Asset Performance

```typescript
// ✅ Next.js Image component (automatic optimization)
import Image from 'next/image';

function ProductImage({ product }: { product: Product }) {
  return (
    <Image
      src={product.imageUrl}
      alt={product.name}
      width={800}
      height={600}
      priority={false}         // Set true for above-the-fold LCP images
      placeholder="blur"       // Show blur while loading
      blurDataURL={product.blurHash}
      sizes="(max-width: 768px) 100vw, 50vw" // Responsive sizes
    />
  );
}

// ✅ Native lazy loading (no framework)
<img
  src="/photo.jpg"
  alt="Description"
  loading="lazy"          // Browser-native lazy loading
  decoding="async"        // Non-blocking image decoding
  width="800"
  height="600"            // ALWAYS set dimensions to prevent CLS
/>

// ✅ Responsive images with srcset
<img
  srcSet="
    /photo-400w.webp 400w,
    /photo-800w.webp 800w,
    /photo-1200w.webp 1200w
  "
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  src="/photo-800w.webp"  // Fallback
  alt="Description"
  loading="lazy"
  width="800"
  height="600"
/>

// RULES:
// - ALWAYS set width and height on images (prevents CLS)
// - Use WebP/AVIF formats (30-50% smaller than JPEG)
// - Lazy load below-the-fold images
// - Set priority on LCP image (hero image, above-the-fold)
// - Use responsive sizes to avoid serving oversized images
```

---

## 10. State Management Performance

```typescript
// ZUSTAND: Fine-grained selectors (re-render only on selected change)
import { create } from 'zustand';

interface Store {
  user: User | null;
  notifications: Notification[];
  theme: 'light' | 'dark';
  setUser: (user: User) => void;
  addNotification: (n: Notification) => void;
  toggleTheme: () => void;
}

const useStore = create<Store>((set) => ({
  user: null,
  notifications: [],
  theme: 'light',
  setUser: (user) => set({ user }),
  addNotification: (n) => set((s) => ({
    notifications: [...s.notifications, n],
  })),
  toggleTheme: () => set((s) => ({
    theme: s.theme === 'light' ? 'dark' : 'light',
  })),
}));

// ✅ CORRECT: Select specific values (re-renders only when theme changes)
function ThemeToggle() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  // Notification changes do NOT re-render this component
}

// ❌ WRONG: Select entire store (re-renders on ANY change)
function ThemeToggle() {
  const store = useStore(); // Re-renders when notifications change!
}

// ✅ CORRECT: Shallow comparison for objects
import { useShallow } from 'zustand/react/shallow';

function UserInfo() {
  const { name, email } = useStore(
    useShallow((s) => ({ name: s.user?.name, email: s.user?.email }))
  );
}

// JOTAI: Atomic state (even finer-grained)
import { atom, useAtom, useAtomValue } from 'jotai';

const countAtom = atom(0);
const doubledAtom = atom((get) => get(countAtom) * 2); // Derived — auto-updates

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  // Only re-renders when countAtom changes
}

function Display() {
  const doubled = useAtomValue(doubledAtom);
  // Only re-renders when countAtom changes (derived)
}
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Premature optimization** | useMemo/useCallback everywhere, code hard to read, no measured benefit | Measure first with React Profiler, optimize only bottlenecks |
| **Not using React Compiler** | Manual memoization boilerplate, forgotten memos, wasted effort | Enable React Compiler — eliminates need for most manual memoization |
| **State too high in tree** | Entire subtree re-renders for localized state change | Move state down to the component that uses it |
| **New objects/arrays in JSX** | `style={{color:'red'}}` or `data={[1,2,3]}` causes child re-render even with memo | Extract to constant, useMemo, or CSS classes |
| **Unvirtualized long lists** | Rendering 1000+ items, slow scroll, high memory, jank | Use TanStack Virtual, react-window, or react-virtuoso |
| **No code splitting** | Single 2MB bundle, slow initial load, everything loaded upfront | React.lazy + Suspense at route boundaries, dynamic imports |
| **Barrel file imports** | `import { Button } from '@/components'` pulls entire component library | Import directly: `import { Button } from '@/components/ui/Button'` |
| **Monolith context** | Single context with 10+ values, all consumers re-render on any change | Split into focused contexts, or use Zustand/Jotai |
| **Selecting entire store** | `const store = useStore()` re-renders on every store mutation | Use selectors: `const count = useStore(s => s.count)` |
| **Unoptimized images** | Large image files, no lazy loading, CLS from missing dimensions | Use next/image, set dimensions, lazy load, serve WebP/AVIF |
| **Console.log in render** | Console overhead in production, cluttered output | Remove all console.log in production (use eslint-plugin-no-console) |
| **Anonymous functions in lists** | `items.map(() => <Item onClick={() => handle(id)} />)` — new function per item | Extract to named component with memo, or accept minor cost if list is small |
| **Measuring with React DevTools Profiler in production build** | Profiler stripped in prod, no data available | Profile in development mode or use profiling production build |

---

## 12. Performance Budget

```
PERFORMANCE BUDGETS:

┌──────────────────────────┬──────────────┬──────────────┐
│ Metric                   │ Target       │ Red Flag     │
├──────────────────────────┼──────────────┼──────────────┤
│ Initial JS bundle        │ < 100KB gz   │ > 200KB gz   │
│ Per-route JS chunk       │ < 50KB gz    │ > 100KB gz   │
│ LCP                      │ < 2.5s       │ > 4.0s       │
│ INP (Interaction)        │ < 200ms      │ > 500ms      │
│ CLS                      │ < 0.1        │ > 0.25       │
│ TTFB                     │ < 800ms      │ > 1800ms     │
│ Total page weight        │ < 1MB        │ > 3MB        │
│ Component render time    │ < 16ms       │ > 50ms       │
│ Largest render cascade   │ < 50 comps   │ > 200 comps  │
│ Time to Interactive      │ < 3.8s       │ > 7.3s       │
└──────────────────────────┴──────────────┴──────────────┘

ENFORCEMENT:
  - Add Lighthouse CI to CI/CD pipeline
  - Set bundle size limits in webpack/vite config
  - Monitor Web Vitals in production (real user monitoring)
  - Review bundle size diff in PRs
```

---

## 13. Enforcement Checklist

### Measurement
- [ ] React DevTools Profiler used to identify slow renders
- [ ] Bundle size analyzed with webpack-bundle-analyzer or vite-bundle-visualizer
- [ ] Web Vitals monitored in production (LCP, INP, CLS, TTFB)
- [ ] Lighthouse CI runs on every PR with performance budgets
- [ ] No optimization applied without measured evidence of a problem

### Architecture
- [ ] State colocated as close to usage as possible
- [ ] Children-as-props pattern used to prevent unnecessary re-renders
- [ ] Context split into focused providers (state vs dispatch, by domain)
- [ ] Heavy components wrapped in React.lazy with Suspense

### Lists
- [ ] Lists with 100+ items use virtualization
- [ ] All dynamic lists use stable unique keys from data
- [ ] No index-as-key for lists that can reorder/insert/delete

### Bundle
- [ ] Route-level code splitting with React.lazy
- [ ] Tree-shakeable imports (direct imports, not barrel files)
- [ ] Heavy libraries dynamically imported (PDF, charts, editors)
- [ ] No full lodash/moment — use date-fns, lodash-es, or native
- [ ] Production build has no development-only code

### Images
- [ ] All images have explicit width and height attributes
- [ ] Below-fold images use lazy loading
- [ ] LCP image marked as priority
- [ ] Images served in WebP/AVIF format
- [ ] Responsive images use srcset and sizes

### Runtime
- [ ] No forced synchronous layout (read then write DOM)
- [ ] Animations use transform/opacity only (compositor thread)
- [ ] Heavy computations offloaded to Web Workers
- [ ] Debounced/throttled input handlers for search, resize, scroll
