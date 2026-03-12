# Render Props & Higher-Order Components — Complete Specification

> **AI Plugin Directive:** When evaluating legacy React patterns, deciding between code sharing strategies, or migrating older codebases, ALWAYS consult this guide. Understand when render props and HOCs are still useful, when they should be replaced with hooks, and how to migrate safely. This guide covers the render prop pattern, HOC pattern, their problems, modern alternatives, and migration strategies.

**Core Rule: PREFER custom hooks over render props and HOCs for new code. Hooks solve the same problems (logic reuse, cross-cutting concerns) without wrapper hell, prop conflicts, or indirection. Use render props ONLY for render delegation (passing UI rendering control to consumers). Use HOCs ONLY when wrapping at the module level (not inside render) and when no hook alternative exists. NEVER nest more than 2 HOCs — compose them with a utility instead.**

---

## 1. Pattern Comparison Overview

```
                    CODE REUSE PATTERNS EVOLUTION

  2015-2018              2018-2020              2020+
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │  Mixins  │    ──▶   │  HOCs    │    ──▶   │  Hooks   │
  │  (dead)  │          │  Render  │          │          │
  │          │          │  Props   │          │          │
  └──────────┘          └──────────┘          └──────────┘

  Problems:              Problems:              Benefits:
  - Name collision       - Wrapper hell         - No wrapper nesting
  - Implicit deps        - Prop conflicts       - Explicit data flow
  - Hard to remove       - Indirection          - Composable
                         - DevTools noise       - Type-safe
                         - Static typing hard   - Easy to test

  VERDICT:
  ┌──────────────────────────────────────────────────────┐
  │ Hooks:        ✅ DEFAULT for all new code             │
  │ Render Props: ✅ STILL USEFUL for render delegation   │
  │ HOCs:         ⚠️  LEGACY — use only when necessary    │
  │ Mixins:       ❌ DEAD — never use                     │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Render Props Pattern

### 2.1 What It Is

```
  RENDER PROP: A component that takes a function as a prop
  and calls that function to determine what to render.

  ┌──────────────────────────────────────────────┐
  │  <DataProvider                                │
  │    render={(data) => <DisplayComponent />}    │
  │  />                                           │
  │                                               │
  │  OR (using children as render prop):          │
  │                                               │
  │  <DataProvider>                                │
  │    {(data) => <DisplayComponent />}           │
  │  </DataProvider>                               │
  └──────────────────────────────────────────────┘

  The COMPONENT provides logic/state.
  The CONSUMER provides the rendering.
```

### 2.2 Classic Render Prop Implementation

```typescript
// MouseTracker — Classic render prop example
interface MousePosition {
  x: number;
  y: number;
}

interface MouseTrackerProps {
  render: (position: MousePosition) => ReactNode;
  // OR: children: (position: MousePosition) => ReactNode;
}

function MouseTracker({ render }: MouseTrackerProps) {
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return <>{render(position)}</>;
}

// Usage
<MouseTracker
  render={({ x, y }) => (
    <div>Mouse is at ({x}, {y})</div>
  )}
/>
```

### 2.3 Children-as-Function Variant

```typescript
// Preferred render prop syntax — cleaner JSX
interface ToggleRenderProps {
  isOn: boolean;
  toggle: () => void;
  setOn: () => void;
  setOff: () => void;
}

interface ToggleProps {
  initialValue?: boolean;
  children: (props: ToggleRenderProps) => ReactNode;
}

function Toggle({ initialValue = false, children }: ToggleProps) {
  const [isOn, setIsOn] = useState(initialValue);

  const renderProps: ToggleRenderProps = {
    isOn,
    toggle: () => setIsOn(prev => !prev),
    setOn: () => setIsOn(true),
    setOff: () => setIsOn(false),
  };

  return <>{children(renderProps)}</>;
}

// Usage — children as function
<Toggle initialValue={false}>
  {({ isOn, toggle }) => (
    <button onClick={toggle}>
      {isOn ? 'ON' : 'OFF'}
    </button>
  )}
</Toggle>
```

---

## 3. When Render Props Are Still Useful

### 3.1 Render Delegation (Primary Modern Use Case)

```typescript
// Render props STILL make sense when the CONSUMER controls rendering
// This is different from logic reuse (which hooks handle better)

// ─── Virtualized List — Consumer decides how to render each item ───
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => ReactNode;
  overscan?: number;
}

function VirtualList<T>({
  items, itemHeight, containerHeight, renderItem, overscan = 5,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, i) => {
          const index = startIndex + i;
          const style: React.CSSProperties = {
            position: 'absolute',
            top: index * itemHeight,
            height: itemHeight,
            width: '100%',
          };
          return renderItem(item, index, style);
        })}
      </div>
    </div>
  );
}

// Usage — consumer controls rendering
<VirtualList
  items={products}
  itemHeight={80}
  containerHeight={600}
  renderItem={(product, index, style) => (
    <div key={product.id} style={style} className="flex items-center px-4 border-b">
      <img src={product.image} alt={product.name} className="w-12 h-12" />
      <div className="ml-3">
        <p className="font-medium">{product.name}</p>
        <p className="text-sm text-gray-500">${product.price}</p>
      </div>
    </div>
  )}
/>
```

### 3.2 Headless Components (Modern Render Props)

```typescript
// Headless component: ALL logic, ZERO UI — consumer provides all rendering
// This is the modern, valid use of render props

interface UseDropdownReturn {
  isOpen: boolean;
  highlightedIndex: number;
  selectedItem: string | null;
  getToggleProps: () => Record<string, unknown>;
  getMenuProps: () => Record<string, unknown>;
  getItemProps: (options: { item: string; index: number }) => Record<string, unknown>;
}

function Downshift({
  items,
  onSelect,
  children,
}: {
  items: string[];
  onSelect: (item: string) => void;
  children: (props: UseDropdownReturn) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const getToggleProps = () => ({
    onClick: () => setIsOpen(prev => !prev),
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox' as const,
  });

  const getMenuProps = () => ({
    role: 'listbox' as const,
    'aria-hidden': !isOpen,
  });

  const getItemProps = ({ item, index }: { item: string; index: number }) => ({
    role: 'option' as const,
    'aria-selected': selectedItem === item,
    onClick: () => {
      setSelectedItem(item);
      onSelect(item);
      setIsOpen(false);
    },
    onMouseEnter: () => setHighlightedIndex(index),
    'data-highlighted': highlightedIndex === index,
  });

  return (
    <>
      {children({
        isOpen,
        highlightedIndex,
        selectedItem,
        getToggleProps,
        getMenuProps,
        getItemProps,
      })}
    </>
  );
}

// Usage — FULL control over rendering, component provides behavior
<Downshift items={['React', 'Vue', 'Svelte']} onSelect={console.log}>
  {({ isOpen, getToggleProps, getMenuProps, getItemProps, selectedItem }) => (
    <div className="relative">
      <button {...getToggleProps()} className="border px-4 py-2 rounded">
        {selectedItem || 'Select framework...'}
      </button>
      {isOpen && (
        <ul {...getMenuProps()} className="absolute border rounded mt-1 w-full bg-white shadow">
          {['React', 'Vue', 'Svelte'].map((item, index) => (
            <li key={item} {...getItemProps({ item, index })} className="px-4 py-2 cursor-pointer hover:bg-gray-100">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )}
</Downshift>
```

---

## 4. Higher-Order Components (HOCs)

### 4.1 What It Is

```
  HOC: A function that takes a component and returns a NEW component
  with additional props/behavior.

  ┌──────────────────────────────────────────────────┐
  │  const EnhancedComponent = withFeature(BaseComp) │
  │                                                  │
  │  function withFeature(WrappedComponent) {        │
  │    return function Enhanced(props) {              │
  │      // Add behavior                             │
  │      return <WrappedComponent {...props}          │
  │               extraProp={value} />;              │
  │    };                                            │
  │  }                                               │
  └──────────────────────────────────────────────────┘

  HOC wraps a component at the MODULE level (not inside render).
  It adds props, injects data, or modifies behavior.
```

### 4.2 HOC Implementation

```typescript
// withAuth — Classic HOC for authentication gating
import { type ComponentType } from 'react';

interface WithAuthProps {
  user: User;
}

function withAuth<P extends WithAuthProps>(
  WrappedComponent: ComponentType<P>
): ComponentType<Omit<P, keyof WithAuthProps>> {
  function AuthenticatedComponent(props: Omit<P, keyof WithAuthProps>) {
    const { user, isLoading } = useAuth();

    if (isLoading) return <LoadingSpinner />;
    if (!user) return <Navigate to="/login" />;

    return <WrappedComponent {...(props as P)} user={user} />;
  }

  // Preserve display name for DevTools
  AuthenticatedComponent.displayName =
    `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return AuthenticatedComponent;
}

// Usage
function DashboardPage({ user }: WithAuthProps & DashboardProps) {
  return <div>Welcome, {user.name}</div>;
}

export default withAuth(DashboardPage);
```

```typescript
// withErrorBoundary — HOC for error handling
function withErrorBoundary<P>(
  WrappedComponent: ComponentType<P>,
  fallback: ReactNode | ((error: Error) => ReactNode)
): ComponentType<P> {
  class ErrorBoundaryHOC extends React.Component<P, { error: Error | null }> {
    static displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
      return { error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      reportError(error, errorInfo);
    }

    render() {
      if (this.state.error) {
        return typeof fallback === 'function'
          ? fallback(this.state.error)
          : fallback;
      }
      return <WrappedComponent {...this.props} />;
    }
  }

  return ErrorBoundaryHOC as ComponentType<P>;
}

// Usage
const SafeDashboard = withErrorBoundary(Dashboard, (error) => (
  <ErrorFallback error={error} onRetry={() => window.location.reload()} />
));
```

### 4.3 HOC Composition

```typescript
// ❌ BAD: Deep nesting
export default withAuth(withTheme(withLogger(withErrorBoundary(Dashboard))));

// ✅ BETTER: compose utility (if you MUST use multiple HOCs)
function compose<P>(...hocs: Array<(component: ComponentType<any>) => ComponentType<any>>) {
  return (component: ComponentType<P>) =>
    hocs.reduceRight((acc, hoc) => hoc(acc), component);
}

const enhance = compose(
  withAuth,
  withTheme,
  withLogger,
  withErrorBoundary
);

export default enhance(Dashboard);

// ✅ BEST: Replace with hooks (no HOCs needed)
function Dashboard() {
  const { user } = useAuth();       // Instead of withAuth
  const { theme } = useTheme();     // Instead of withTheme
  useLogger('Dashboard');            // Instead of withLogger

  if (!user) return <Navigate to="/login" />;

  return <div>...</div>;
}
```

---

## 5. Problems with HOCs

```
  HOC PROBLEMS:

  1. WRAPPER HELL
     ┌─────────────────────────────────────────┐
     │  <WithAuth>                              │
     │    <WithTheme>                           │
     │      <WithRouter>                        │
     │        <WithIntl>                        │
     │          <WithErrorBoundary>             │
     │            <ActualComponent />           │
     │          </WithErrorBoundary>            │
     │        </WithIntl>                       │
     │      </WithRouter>                       │
     │    </WithTheme>                          │
     │  </WithAuth>                             │
     └─────────────────────────────────────────┘
     DevTools shows 5 wrapper layers. Hard to debug.

  2. PROP COLLISION
     withAuth injects { user }
     withData injects { user }  ← COLLISION! Which user?
     No compile-time error, silent bugs.

  3. INDIRECTION
     Where does this.props.theme come from?
     Which HOC injected it?
     Have to trace through all wrappers.

  4. STATIC TYPING PAIN
     TypeScript generics for HOCs are complex.
     Omit<P, keyof InjectedProps> gets messy fast.

  5. CANNOT BE USED CONDITIONALLY
     // ❌ IMPOSSIBLE:
     if (condition) {
       return withAuth(Component);
     }
     // HOCs apply at module level, not runtime
```

---

## 6. Problems with Render Props

```
  RENDER PROP PROBLEMS:

  1. CALLBACK HELL (Nesting)
     <Toggle>
       {({ isOn }) => (
         <MouseTracker>
           {({ x, y }) => (
             <WindowSize>
               {({ width }) => (
                 // Deeply nested — hard to read
                 <div>{isOn} {x} {y} {width}</div>
               )}
             </WindowSize>
           )}
         </MouseTracker>
       )}
     </Toggle>

  2. PERFORMANCE: New function on every render
     Unless memoized, the render function creates
     a new closure on every render cycle.

  3. NOT COMPOSABLE
     Can't easily combine multiple render prop
     components without nesting.

  4. DEVTOOLS: Shows anonymous functions
     Hard to identify in React DevTools.
```

---

## 7. Modern Alternatives: Custom Hooks

### 7.1 Migration: Render Props → Hooks

```typescript
// ─── BEFORE: Render Prop ───
function MouseTracker({ render }: { render: (pos: MousePosition) => ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return <>{render(pos)}</>;
}

// Usage: <MouseTracker render={({ x, y }) => <div>{x}, {y}</div>} />

// ─── AFTER: Custom Hook ───
function useMousePosition(): MousePosition {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return pos;
}

// Usage: const { x, y } = useMousePosition();
//        return <div>{x}, {y}</div>;
```

### 7.2 Migration: HOC → Hooks

```typescript
// ─── BEFORE: HOC ───
function withWindowSize<P>(Component: ComponentType<P & { windowSize: Size }>) {
  return function WithWindowSize(props: P) {
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
      const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener('resize', handler);
      return () => window.removeEventListener('resize', handler);
    }, []);

    return <Component {...props} windowSize={size} />;
  };
}

// Usage: export default withWindowSize(MyComponent);

// ─── AFTER: Custom Hook ───
function useWindowSize(): Size {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return size;
}

// Usage: const { width, height } = useWindowSize();
```

### 7.3 Hooks Solve the Nesting Problem

```typescript
// ─── BEFORE: Nested Render Props ───
<Toggle>
  {({ isOn, toggle }) => (
    <MouseTracker>
      {({ x, y }) => (
        <WindowSize>
          {({ width }) => (
            <div>
              {isOn && `Mouse: ${x}, ${y}, Window: ${width}`}
              <button onClick={toggle}>Toggle</button>
            </div>
          )}
        </WindowSize>
      )}
    </MouseTracker>
  )}
</Toggle>

// ─── AFTER: Flat Hooks ───
function MyComponent() {
  const { isOn, toggle } = useToggle(false);
  const { x, y } = useMousePosition();
  const { width } = useWindowSize();

  return (
    <div>
      {isOn && `Mouse: ${x}, ${y}, Window: ${width}`}
      <button onClick={toggle}>Toggle</button>
    </div>
  );
}
```

---

## 8. Decision Matrix: When to Use What

| Criterion | Custom Hook | Render Prop | HOC |
|-----------|-------------|-------------|-----|
| Logic reuse | ✅ PRIMARY | ⚠️ Legacy | ⚠️ Legacy |
| Render delegation | ❌ | ✅ PRIMARY | ❌ |
| Module-level wrapping | ❌ | ❌ | ✅ (e.g., `React.memo`, error boundary) |
| Type safety | ✅ Easy | ✅ Easy | ⚠️ Complex generics |
| Composability | ✅ Flat calls | ❌ Nesting | ⚠️ `compose()` needed |
| Conditional usage | ✅ (follows rules of hooks) | ✅ | ❌ Module-level only |
| DevTools clarity | ✅ | ⚠️ Anonymous | ⚠️ Wrapper layers |
| SSR compatibility | ✅ | ✅ | ✅ |
| New code? | ✅ ALWAYS | ✅ For render delegation | ❌ Avoid |

### 8.1 Decision Tree

```
  Need to share logic between components?
       │
       ├── Is it about WHAT to render (UI delegation)?
       │       │
       │       ├── YES → Render Prop (or compound component)
       │       │         Examples: VirtualList, Downshift, Slot pattern
       │       │
       │       └── NO → Custom Hook
       │                Examples: useAuth, useForm, useMediaQuery
       │
       ├── Need module-level wrapping?
       │       │
       │       ├── Error boundaries → HOC (class components required)
       │       │
       │       ├── React.memo optimization → React.memo() (built-in HOC)
       │       │
       │       └── Other → PREFER hook + wrapper component over HOC
       │
       └── Working with legacy code?
               │
               ├── Keep existing HOCs/render props if stable
               │
               └── Migrate to hooks when touching the code
                   Use the codemod patterns in Section 7
```

---

## 9. Framework Comparison

### 9.1 Vue — Equivalent Patterns

```vue
<!-- Vue uses scoped slots instead of render props -->
<script setup lang="ts">
// Composables = Vue equivalent of custom hooks
import { useMousePosition } from '@/composables/useMousePosition';
const { x, y } = useMousePosition();
</script>

<!-- Vue scoped slot = Render prop equivalent -->
<template>
  <MouseTracker v-slot="{ x, y }">
    <div>Mouse is at {{ x }}, {{ y }}</div>
  </MouseTracker>
</template>
```

```typescript
// Vue composable = Custom hook
// composables/useToggle.ts
import { ref } from 'vue';

export function useToggle(initial = false) {
  const isOn = ref(initial);
  const toggle = () => { isOn.value = !isOn.value; };
  const setOn = () => { isOn.value = true; };
  const setOff = () => { isOn.value = false; };
  return { isOn, toggle, setOn, setOff };
}
```

### 9.2 Angular — Equivalent Patterns

```typescript
// Angular uses Directives + DI instead of HOCs/render props

// Directive = HOC equivalent
@Directive({
  selector: '[appAuth]',
  standalone: true,
})
export class AuthDirective implements OnInit {
  constructor(
    private templateRef: TemplateRef<unknown>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService
  ) {}

  ngOnInit() {
    if (this.authService.isAuthenticated()) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}

// Service + DI = Custom hook equivalent
@Injectable({ providedIn: 'root' })
export class MouseService {
  position$ = fromEvent<MouseEvent>(document, 'mousemove').pipe(
    map(e => ({ x: e.clientX, y: e.clientY })),
    shareReplay(1)
  );
}

// Template directive = Render prop equivalent
// <ng-template let-item let-index="index">
//   <div>{{ item.name }}</div>
// </ng-template>
```

---

## 10. Migration Strategy

### 10.1 Gradual Migration Plan

```
  MIGRATION: HOC/Render Props → Hooks

  Step 1: IDENTIFY
  ─────────────────────────
  Find all HOCs:         grep -r "function with[A-Z]" src/
  Find all render props: grep -r "render={(" src/
                        grep -r "children={(" src/

  Step 2: PRIORITIZE
  ─────────────────────────
  High priority:  Frequently used HOCs (touched often)
  Medium priority: Render props used for logic (not render delegation)
  Low priority:   Stable HOCs/render props rarely modified

  Step 3: MIGRATE (per component)
  ─────────────────────────
  a) Extract logic into custom hook
  b) Keep HOC as thin wrapper calling the hook (backward compat)
  c) Update consumers one by one to use hook directly
  d) Remove HOC when no consumers remain

  Step 4: KEEP
  ─────────────────────────
  Keep render props used for genuine render delegation
  Keep ErrorBoundary HOCs (class components required)
```

### 10.2 Backward-Compatible Migration

```typescript
// Step 1: Extract hook from HOC
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService.getCurrentUser().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading, isAuthenticated: !!user };
}

// Step 2: Keep HOC as thin wrapper (for existing consumers)
function withAuth<P extends { user: User }>(
  Component: ComponentType<P>
): ComponentType<Omit<P, 'user'>> {
  return function WithAuth(props: Omit<P, 'user'>) {
    const { user, loading } = useAuth(); // Now uses the hook internally
    if (loading) return <Spinner />;
    if (!user) return <Navigate to="/login" />;
    return <Component {...(props as P)} user={user} />;
  };
}

// Step 3: New consumers use hook directly
function NewDashboard() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  return <div>Welcome, {user.name}</div>;
}

// Step 4: Old consumers continue working until migrated
const OldDashboard = withAuth(OldDashboardComponent); // Still works
```

---

## 11. Remaining Valid Use Cases

### 11.1 Error Boundaries (HOC Required)

```typescript
// Error boundaries MUST be class components (no hook equivalent)
// HOC wrapper is the cleanest approach

class ErrorBoundary extends React.Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// HOC wrapper
function withErrorBoundary<P>(
  Component: ComponentType<P>,
  fallback: ReactNode
): ComponentType<P> {
  function Wrapped(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  }
  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return Wrapped;
}
```

### 11.2 React.memo (Built-in HOC)

```typescript
// React.memo IS a HOC — and it's perfectly fine to use

const ExpensiveList = React.memo(function ExpensiveList({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});

// With custom comparator
const OptimizedChart = React.memo(
  function Chart({ data, options }: ChartProps) {
    return <canvas ref={renderChart} />;
  },
  (prevProps, nextProps) => {
    return (
      prevProps.data === nextProps.data &&
      prevProps.options.type === nextProps.options.type
    );
  }
);
```

### 11.3 forwardRef (Built-in HOC)

```typescript
// forwardRef IS a HOC — required for ref forwarding

const FancyInput = forwardRef<HTMLInputElement, InputProps>(
  function FancyInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn('fancy-input', className)}
        {...props}
      />
    );
  }
);

// Usage
const inputRef = useRef<HTMLInputElement>(null);
<FancyInput ref={inputRef} placeholder="Type here..." />
```

### 11.4 Render Props for Render Delegation

```typescript
// Render props ARE still valid for genuine render delegation

// Table with customizable cell rendering
interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  renderEmpty?: () => ReactNode;
  renderRow?: (row: T, defaultRow: ReactNode) => ReactNode;
}

function DataTable<T extends { id: string }>({
  data, columns, renderEmpty, renderRow,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return renderEmpty?.() || <p>No data</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={String(col.key)} style={{ width: col.width }}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map(row => {
          const defaultRow = (
            <tr key={row.id}>
              {columns.map(col => (
                <td key={String(col.key)}>
                  {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                </td>
              ))}
            </tr>
          );
          return renderRow ? renderRow(row, defaultRow) : defaultRow;
        })}
      </tbody>
    </table>
  );
}
```

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Using HOC for logic reuse in new code | Wrapper hell, prop conflicts | Use custom hooks instead |
| Applying HOC inside render | New component instance on every render, state loss | Apply HOCs at module level only (`export default withX(Comp)`) |
| Nesting 3+ render props | "Callback pyramid of doom" | Extract to custom hooks, flatten |
| HOC modifying wrapped component's prototype | Mutation side effects, hard to debug | Return NEW component, never mutate original |
| Missing `displayName` on HOC | DevTools show `<Unknown>` or `<Anonymous>` | Set `EnhancedComponent.displayName = \`withX(...)\`` |
| Prop name collision between HOCs | Silent overwrite, wrong data | Use namespaced props or switch to hooks |
| Using render props for logic-only sharing | Unnecessary wrapper when hook would work | Extract logic to custom hook |
| Not forwarding refs through HOC | `ref` prop doesn't reach underlying DOM element | Use `React.forwardRef` in HOC |
| Not hoisting statics in HOC | Static methods lost on wrapped component | Use `hoist-non-react-statics` or manual copy |
| Creating new functions in render prop parent | Unnecessary re-renders of children | Memoize the render function or use `useCallback` |

---

## 13. Enforcement Checklist

- [ ] All NEW logic sharing uses custom hooks (not HOCs or render props)
- [ ] Render props are used ONLY for render delegation (consumer controls UI)
- [ ] HOCs are applied at module level ONLY (never inside render/component body)
- [ ] No more than 2 HOCs composed on a single component
- [ ] HOCs have `displayName` set for DevTools
- [ ] HOCs forward refs using `React.forwardRef`
- [ ] HOCs hoist static methods from wrapped component
- [ ] HOCs do NOT mutate the wrapped component's prototype
- [ ] Render prop functions are NOT recreated on every render (memoized if needed)
- [ ] Legacy HOCs have been migrated to hooks internally (thin HOC wrapper remains for backward compat)
- [ ] Error boundaries are the ONLY new code using class components/HOCs
- [ ] `React.memo` and `forwardRef` are used where appropriate (built-in HOCs)
- [ ] Migration plan exists for remaining legacy HOCs and render props
- [ ] No "callback pyramid" from nested render props (max 1 level deep)
