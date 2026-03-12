# Render Props, HOCs, and Headless Components — Complete Specification

> **AI Plugin Directive:** When a developer asks "should I use a render prop or a hook?", "are HOCs still relevant?", "what is a headless component?", "should I use Radix UI or Headless UI?", "how do I migrate from HOC to hooks?", or "when are render props still useful?", use this directive. The evolution is: HOC (legacy) → Render Prop (niche) → Custom Hook (default) → Headless Component (design systems). ALWAYS prefer custom hooks for logic reuse. Use render props ONLY for headless UI patterns. Use HOCs ONLY for cross-cutting concerns that wrap entire component trees (auth guards, error boundaries, theme injection). NEVER write new HOCs for logic that a hook can handle.

---

## 1. The Core Rule

**Custom hooks are the DEFAULT for logic reuse in React. Render props are ONLY justified for headless UI components that need to control rendering. HOCs are ONLY justified for cross-cutting concerns that modify the component tree (auth guards, error boundaries, feature flags). NEVER use HOCs or render props when a custom hook suffices.**

```
THE EVOLUTION — Know where we are:

  2016-2018            2018-2019              2019-2022              2022+
  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐    ┌────────────────┐
  │   HOC    │    │ Render Props │    │  Custom Hooks    │    │   Headless     │
  │          │───>│              │───>│                  │───>│   Components   │
  │withAuth()│    │<Mouse render │    │useAuth()         │    │Radix, Headless │
  │withTheme│    │  ={({x,y})=>}│    │useMouse()        │    │UI, React Aria  │
  └──────────┘    └──────────────┘    └──────────────────┘    └────────────────┘
   LEGACY           NICHE USE           THE DEFAULT            DESIGN SYSTEMS

  RULE: Start from the RIGHT. Move LEFT only when forced to.
```

---

## 2. Decision Tree — Which Pattern to Use

```
START: You need to reuse logic across components.
  │
  ├─ Is it PURE LOGIC (no rendering)?
  │   YES → Custom Hook (useAuth, useFetch, useDebounce)
  │   NO ↓
  │
  ├─ Does it need to CONTROL RENDERING of children?
  │   │
  │   ├─ Is it a reusable UI PRIMITIVE (dropdown, popover, tooltip)?
  │   │   YES → Headless Component Library (Radix UI, Headless UI, React Aria)
  │   │   NO ↓
  │   │
  │   ├─ Does consumer need FULL CONTROL of what renders?
  │   │   YES → Render Prop / Headless Component
  │   │   NO ↓
  │   │
  │   └─ Is it a one-off rendering variation?
  │       YES → Regular component with children/slots
  │
  ├─ Does it wrap the ENTIRE component (guard, boundary, provider)?
  │   YES → HOC (withAuth, withErrorBoundary, withFeatureFlag)
  │   NO → Custom Hook
  │
  └─ STILL UNSURE?
      → Custom Hook. You are almost certainly overthinking this.
```

---

## 3. Custom Hooks — THE DEFAULT (2019+)

**Custom hooks are the modern standard for ALL logic reuse. They compose naturally, have full TypeScript support, and are testable in isolation. ALWAYS start here.**

```typescript
// ─── Example: useAuth hook ──────────────────────────────────
// Previously: withAuth() HOC or <AuthConsumer render={...} />
// Now: useAuth() hook

import { useContext, useCallback, useMemo } from 'react';
import { AuthContext, type AuthState, type User } from '@/features/auth/context';

export interface UseAuthReturn {
  /** Currently authenticated user, or null */
  user: User | null;
  /** Whether authentication is still loading */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Sign in with credentials */
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign out the current user */
  signOut: () => Promise<void>;
  /** Check if user has a specific role */
  hasRole: (role: string) => boolean;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
}

export function useAuth(): UseAuthReturn {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }

  const { state, dispatch } = context;

  const signIn = useCallback(
    async (email: string, password: string) => {
      dispatch({ type: 'AUTH_START' });
      try {
        const user = await authApi.signIn(email, password);
        dispatch({ type: 'AUTH_SUCCESS', payload: user });
      } catch (error) {
        dispatch({ type: 'AUTH_FAILURE', payload: error });
        throw error;
      }
    },
    [dispatch]
  );

  const signOut = useCallback(async () => {
    await authApi.signOut();
    dispatch({ type: 'AUTH_LOGOUT' });
  }, [dispatch]);

  const hasRole = useCallback(
    (role: string) => state.user?.roles.includes(role) ?? false,
    [state.user]
  );

  const hasPermission = useCallback(
    (permission: string) => state.user?.permissions.includes(permission) ?? false,
    [state.user]
  );

  return useMemo(
    () => ({
      user: state.user,
      isLoading: state.isLoading,
      isAuthenticated: !!state.user,
      signIn,
      signOut,
      hasRole,
      hasPermission,
    }),
    [state.user, state.isLoading, signIn, signOut, hasRole, hasPermission]
  );
}
```

```typescript
// ─── Example: useDebounce hook ──────────────────────────────
// Previously: <Debounce delay={300} render={...} />
// Now: useDebounce(value, 300)

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

```typescript
// ─── Example: useMouse hook ─────────────────────────────────
// Previously: <Mouse render={({ x, y }) => ...} />
// Now: const { x, y } = useMouse()

import { useState, useEffect } from 'react';

export interface MousePosition {
  x: number;
  y: number;
}

export function useMouse(): MousePosition {
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return position;
}
```

---

## 4. HOCs That Survive — Cross-Cutting Concerns Only

**HOCs are ONLY justified for patterns that WRAP the entire component tree: authentication guards, error boundaries, feature flags, and analytics wrappers. These are cases where you need to PREVENT rendering or WRAP with a provider.**

### HOC Pattern: withAuth (Route Guard)

```typescript
// src/hocs/withAuth.tsx
import { type ComponentType } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Spinner } from '@/components/atoms/Spinner';

export interface WithAuthOptions {
  /** Required role to access this route */
  requiredRole?: string;
  /** Required permission to access this route */
  requiredPermission?: string;
  /** Redirect path when unauthorized */
  redirectTo?: string;
  /** Component to show while checking auth */
  fallback?: ComponentType;
}

/**
 * withAuth HOC — guards a route component behind authentication.
 *
 * WHY HOC (not hook): This PREVENTS rendering entirely. A hook cannot
 * prevent the component from rendering — it can only return data.
 * The HOC intercepts and redirects BEFORE the wrapped component mounts.
 *
 * RULE: This is one of the FEW justified HOC use cases.
 */
export function withAuth<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const {
    requiredRole,
    requiredPermission,
    redirectTo = '/login',
    fallback: FallbackComponent,
  } = options;

  function AuthGuard(props: P) {
    const { user, isLoading, isAuthenticated, hasRole, hasPermission } = useAuth();
    const location = useLocation();

    // Still checking authentication
    if (isLoading) {
      return FallbackComponent ? (
        <FallbackComponent />
      ) : (
        <div className="flex h-screen items-center justify-center">
          <Spinner size="lg" />
        </div>
      );
    }

    // Not authenticated
    if (!isAuthenticated) {
      return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // Check role
    if (requiredRole && !hasRole(requiredRole)) {
      return <Navigate to="/unauthorized" replace />;
    }

    // Check permission
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return <Navigate to="/unauthorized" replace />;
    }

    // Authorized — render the component
    return <WrappedComponent {...props} />;
  }

  // ALWAYS preserve displayName for DevTools debugging
  AuthGuard.displayName = `withAuth(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return AuthGuard;
}

// ─── Usage ──────────────────────────────────────────────────

// Basic auth guard
const ProtectedDashboard = withAuth(DashboardPage);

// With role requirement
const AdminPanel = withAuth(AdminPage, { requiredRole: 'admin' });

// With permission requirement
const BillingPage = withAuth(BillingDashboard, {
  requiredPermission: 'billing:read',
  redirectTo: '/upgrade',
});

// In route config:
// <Route path="/dashboard" element={<ProtectedDashboard />} />
// <Route path="/admin" element={<AdminPanel />} />
```

### HOC Pattern: withErrorBoundary

```typescript
// src/hocs/withErrorBoundary.tsx
import { Component, type ComponentType, type ReactNode, type ErrorInfo } from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export interface WithErrorBoundaryOptions {
  /** Component to render when error occurs */
  FallbackComponent: ComponentType<ErrorFallbackProps>;
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Called when error boundary resets */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * withErrorBoundary HOC — wraps a component with error boundary.
 *
 * WHY HOC (not hook): Error boundaries REQUIRE class components.
 * There is no hook equivalent for componentDidCatch. This is
 * the canonical justified HOC pattern.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithErrorBoundaryOptions
) {
  const { FallbackComponent, onError, onReset } = options;

  class ErrorBoundary extends Component<P, ErrorBoundaryState> {
    static displayName = `withErrorBoundary(${
      WrappedComponent.displayName || WrappedComponent.name || 'Component'
    })`;

    state: ErrorBoundaryState = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
      onError?.(error, errorInfo);
    }

    resetErrorBoundary = () => {
      onReset?.();
      this.setState({ hasError: false, error: null });
    };

    render() {
      if (this.state.hasError && this.state.error) {
        return (
          <FallbackComponent
            error={this.state.error}
            resetErrorBoundary={this.resetErrorBoundary}
          />
        );
      }

      return <WrappedComponent {...this.props} />;
    }
  }

  return ErrorBoundary;
}

// ─── Usage ──────────────────────────────────────────────────

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div role="alert" className="p-4 border border-destructive rounded-md">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button onClick={resetErrorBoundary} className="mt-2">
        Try again
      </button>
    </div>
  );
}

const SafeDashboard = withErrorBoundary(DashboardPage, {
  FallbackComponent: ErrorFallback,
  onError: (error, info) => {
    errorReportingService.captureException(error, { extra: info });
  },
});
```

### HOC Pattern: withFeatureFlag

```typescript
// src/hocs/withFeatureFlag.tsx
import { type ComponentType } from 'react';
import { useFeatureFlags } from '@/features/flags/hooks/useFeatureFlags';

export interface WithFeatureFlagOptions {
  /** Feature flag key */
  flag: string;
  /** Component to render when flag is off */
  fallback?: ComponentType;
}

/**
 * withFeatureFlag HOC — conditionally renders based on feature flag.
 *
 * WHY HOC: Prevents rendering entirely when flag is off.
 * Cleaner than `if (!flag) return null` in every component.
 */
export function withFeatureFlag<P extends object>(
  WrappedComponent: ComponentType<P>,
  { flag, fallback: FallbackComponent }: WithFeatureFlagOptions
) {
  function FeatureGated(props: P) {
    const { isEnabled } = useFeatureFlags();

    if (!isEnabled(flag)) {
      return FallbackComponent ? <FallbackComponent /> : null;
    }

    return <WrappedComponent {...props} />;
  }

  FeatureGated.displayName = `withFeatureFlag(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  }, ${flag})`;

  return FeatureGated;
}

// ─── Usage ──────────────────────────────────────────────────

const NewDashboard = withFeatureFlag(DashboardV2, {
  flag: 'new-dashboard',
  fallback: DashboardV1,
});
```

---

## 5. Render Props — When They Are Still Useful

**Render props are justified ONLY when the consumer needs full control over what renders, while the component controls behavior/state. This is the "headless component" pattern.**

### Justified: Headless Autocomplete

```typescript
// src/components/headless/Autocomplete/Autocomplete.tsx
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useId,
  type KeyboardEvent,
} from 'react';

export interface AutocompleteOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface AutocompleteRenderProps {
  // Input props — spread onto the <input>
  inputProps: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
    role: 'combobox';
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-activedescendant': string | undefined;
    'aria-autocomplete': 'list';
    id: string;
  };
  // Listbox props — spread onto the list container
  listboxProps: {
    role: 'listbox';
    id: string;
  };
  // Option props generator — call for each option
  getOptionProps: (option: AutocompleteOption, index: number) => {
    role: 'option';
    id: string;
    'aria-selected': boolean;
    'aria-disabled': boolean;
    onClick: () => void;
    onMouseEnter: () => void;
  };
  // State
  isOpen: boolean;
  filteredOptions: AutocompleteOption[];
  highlightedIndex: number;
  selectedOption: AutocompleteOption | null;
  inputValue: string;
}

export interface AutocompleteProps {
  /** All available options */
  options: AutocompleteOption[];
  /** Currently selected value */
  value?: string;
  /** Called when value changes */
  onValueChange?: (value: string) => void;
  /** Custom filter function */
  filterFn?: (option: AutocompleteOption, query: string) => boolean;
  /** Render prop — receives all state and prop getters */
  children: (props: AutocompleteRenderProps) => React.ReactNode;
}

/**
 * Headless Autocomplete — provides all behavior, consumer provides all UI.
 *
 * WHY RENDER PROP: The consumer MUST control the visual rendering while
 * this component controls keyboard navigation, filtering, ARIA attributes,
 * and state management.
 */
export function Autocomplete({
  options,
  value,
  onValueChange,
  filterFn = defaultFilter,
  children,
}: AutocompleteProps) {
  const id = useId();
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const selectedOption = options.find((o) => o.value === value) ?? null;

  const filteredOptions = inputValue
    ? options.filter((o) => filterFn(o, inputValue))
    : options;

  const handleSelect = useCallback(
    (option: AutocompleteOption) => {
      if (option.disabled) return;
      onValueChange?.(option.value);
      setInputValue(option.label);
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onValueChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setHighlightedIndex(0);
          } else {
            setHighlightedIndex((prev) =>
              prev < filteredOptions.length - 1 ? prev + 1 : 0
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, highlightedIndex, filteredOptions, handleSelect]
  );

  const listboxId = `${id}-listbox`;

  const renderProps: AutocompleteRenderProps = {
    inputProps: {
      value: inputValue,
      onChange: (e) => {
        setInputValue(e.target.value);
        setIsOpen(true);
        setHighlightedIndex(-1);
      },
      onKeyDown: handleKeyDown,
      onFocus: () => setIsOpen(true),
      onBlur: () => setTimeout(() => setIsOpen(false), 150),
      role: 'combobox',
      'aria-expanded': isOpen,
      'aria-controls': listboxId,
      'aria-activedescendant':
        highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined,
      'aria-autocomplete': 'list',
      id: `${id}-input`,
    },
    listboxProps: {
      role: 'listbox',
      id: listboxId,
    },
    getOptionProps: (option, index) => ({
      role: 'option',
      id: `${id}-option-${index}`,
      'aria-selected': option.value === value,
      'aria-disabled': option.disabled ?? false,
      onClick: () => handleSelect(option),
      onMouseEnter: () => setHighlightedIndex(index),
    }),
    isOpen,
    filteredOptions,
    highlightedIndex,
    selectedOption,
    inputValue,
  };

  return <>{children(renderProps)}</>;
}

function defaultFilter(option: AutocompleteOption, query: string): boolean {
  return option.label.toLowerCase().includes(query.toLowerCase());
}
```

### Render Prop Autocomplete Usage — Consumer Controls All Rendering

```tsx
<Autocomplete
  options={countries}
  value={selectedCountry}
  onValueChange={setSelectedCountry}
>
  {({
    inputProps,
    listboxProps,
    getOptionProps,
    isOpen,
    filteredOptions,
    highlightedIndex,
  }) => (
    <div className="relative">
      {/* Consumer controls the input styling */}
      <Input {...inputProps} placeholder="Search countries..." />

      {/* Consumer controls the dropdown rendering */}
      {isOpen && filteredOptions.length > 0 && (
        <ul {...listboxProps} className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {filteredOptions.map((option, index) => (
            <li
              key={option.value}
              {...getOptionProps(option, index)}
              className={cn(
                'px-3 py-2 cursor-pointer text-sm',
                highlightedIndex === index && 'bg-accent',
                option.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {/* Consumer adds custom rendering per item */}
              <span className="flex items-center gap-2">
                <FlagIcon code={option.value} />
                {option.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )}
</Autocomplete>
```

---

## 6. The Full Evolution: HOC → Render Prop → Hook → Headless Component

**Showing the same feature (mouse tracking) across all four patterns:**

### 2016: HOC Pattern (LEGACY)

```typescript
// LEGACY — DO NOT write new code like this

function withMouse<P extends { mouse: { x: number; y: number } }>(
  WrappedComponent: ComponentType<P>
) {
  return class MouseTracker extends Component<Omit<P, 'mouse'>> {
    state = { x: 0, y: 0 };

    handleMouseMove = (e: MouseEvent) => {
      this.setState({ x: e.clientX, y: e.clientY });
    };

    componentDidMount() {
      window.addEventListener('mousemove', this.handleMouseMove);
    }

    componentWillUnmount() {
      window.removeEventListener('mousemove', this.handleMouseMove);
    }

    render() {
      return (
        <WrappedComponent
          {...(this.props as P)}
          mouse={{ x: this.state.x, y: this.state.y }}
        />
      );
    }
  };
}

// Usage: const Enhanced = withMouse(MyComponent);
// Problem: Wrapper hell, lost types, unclear where 'mouse' prop comes from
```

### 2018: Render Prop Pattern (NICHE)

```typescript
// NICHE — use only for headless UI patterns

interface MouseRenderProps {
  x: number;
  y: number;
}

function Mouse({ render }: { render: (props: MouseRenderProps) => ReactNode }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return <>{render(position)}</>;
}

// Usage: <Mouse render={({ x, y }) => <Cursor x={x} y={y} />} />
// Problem: Nesting hell with multiple render props ("callback pyramid")
```

### 2019: Custom Hook Pattern (THE DEFAULT)

```typescript
// THE DEFAULT — use this for all logic reuse

function useMouse(): { x: number; y: number } {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return position;
}

// Usage: const { x, y } = useMouse();
// Composes naturally: combine with useDebounce, useThrottle, etc.
```

### 2022: Headless Component Pattern (DESIGN SYSTEMS)

```typescript
// DESIGN SYSTEMS — when you need standardized behavior + custom rendering

// The hook provides the logic
function useTooltip(options: { delay?: number } = {}) {
  const { delay = 300 } = options;
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const open = useCallback(() => {
    timeoutRef.current = setTimeout(() => setIsOpen(true), delay);
  }, [delay]);

  const close = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setIsOpen(false);
  }, []);

  // Return prop getters (headless pattern)
  return {
    triggerProps: {
      ref: triggerRef,
      onMouseEnter: open,
      onMouseLeave: close,
      onFocus: open,
      onBlur: close,
      'aria-describedby': isOpen ? id : undefined,
    },
    contentProps: {
      ref: contentRef,
      id,
      role: 'tooltip' as const,
    },
    isOpen,
  };
}

// The component provides the structure
function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const { triggerProps, contentProps, isOpen } = useTooltip();

  return (
    <>
      <span {...triggerProps}>{children}</span>
      {isOpen && (
        <div {...contentProps} className="rounded bg-gray-900 px-2 py-1 text-sm text-white">
          {content}
        </div>
      )}
    </>
  );
}

// Headless version — consumer controls everything
function HeadlessTooltip({
  children,
}: {
  children: (props: ReturnType<typeof useTooltip>) => ReactNode;
}) {
  const tooltip = useTooltip();
  return <>{children(tooltip)}</>;
}
```

---

## 7. Headless UI Libraries — Comparison

```
HEADLESS LIBRARY LANDSCAPE

  ┌────────────────────┬────────────────────┬────────────────────┐
  │    Radix UI         │   Headless UI      │    React Aria      │
  │    (Radix)          │   (Tailwind Labs)  │    (Adobe)         │
  ├────────────────────┼────────────────────┼────────────────────┤
  │ Framework: React   │ Framework: React,  │ Framework: React   │
  │                    │ Vue                │                    │
  │ Style: Unstyled    │ Style: Unstyled    │ Style: Unstyled    │
  │ (bring your own)   │ (bring your own)   │ (bring your own)   │
  │                    │                    │                    │
  │ Focus: Complete    │ Focus: Common      │ Focus: a11y first  │
  │ component set      │ components         │ hooks + components │
  │                    │                    │                    │
  │ Pattern: Compound  │ Pattern: Compound  │ Pattern: Hooks     │
  │ components         │ + render props     │ (prop getters)     │
  │                    │                    │                    │
  │ Used by: shadcn/ui │ Used by: Catalyst  │ Used by: Adobe     │
  │                    │ UI                 │ Spectrum            │
  ├────────────────────┼────────────────────┼────────────────────┤
  │     Ark UI          │     Melt UI        │  Bits UI           │
  │  (Chakra team)      │  (Svelte)          │  (Svelte)          │
  ├────────────────────┼────────────────────┼────────────────────┤
  │ Framework: React,  │ Framework: Svelte  │ Framework: Svelte  │
  │ Vue, Solid         │ ONLY               │ ONLY               │
  │                    │                    │                    │
  │ Style: Unstyled    │ Style: Unstyled    │ Style: Unstyled    │
  │                    │                    │                    │
  │ Focus: Multi-      │ Focus: Builder     │ Focus: Compound    │
  │ framework parity   │ pattern (hooks     │ component pattern  │
  │                    │ return actions)    │ for Svelte         │
  │                    │                    │                    │
  │ Pattern: State     │ Pattern: Svelte    │ Pattern: Svelte    │
  │ machines (Zag.js)  │ stores + actions   │ component API      │
  └────────────────────┴────────────────────┴────────────────────┘
```

### Decision Matrix

| Need | Use |
|---|---|
| React + Maximum component coverage | **Radix UI** |
| React + shadcn/ui foundation | **Radix UI** (shadcn is built on it) |
| React + Vue support needed | **Headless UI** or **Ark UI** |
| Maximum accessibility compliance | **React Aria** |
| React + Solid + Vue support | **Ark UI** |
| Svelte project | **Melt UI** or **Bits UI** |
| Hook-based (no component wrappers) | **React Aria** |
| State machine driven | **Ark UI** (Zag.js) |

### Radix UI Example (Select)

```tsx
import * as Select from '@radix-ui/react-select';

function CountrySelect() {
  return (
    <Select.Root value={country} onValueChange={setCountry}>
      <Select.Trigger className="flex h-10 items-center justify-between rounded-md border px-3">
        <Select.Value placeholder="Select country..." />
        <Select.Icon>
          <ChevronDownIcon />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className="rounded-md border bg-white shadow-lg">
          <Select.ScrollUpButton />
          <Select.Viewport className="p-1">
            <Select.Group>
              <Select.Label className="px-2 py-1 text-xs text-gray-500">
                North America
              </Select.Label>
              <Select.Item value="us" className="rounded px-2 py-1 data-[highlighted]:bg-blue-100">
                <Select.ItemText>United States</Select.ItemText>
                <Select.ItemIndicator>
                  <CheckIcon />
                </Select.ItemIndicator>
              </Select.Item>
              <Select.Item value="ca" className="rounded px-2 py-1 data-[highlighted]:bg-blue-100">
                <Select.ItemText>Canada</Select.ItemText>
                <Select.ItemIndicator>
                  <CheckIcon />
                </Select.ItemIndicator>
              </Select.Item>
            </Select.Group>
          </Select.Viewport>
          <Select.ScrollDownButton />
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
```

### React Aria Example (Hooks Pattern)

```tsx
import { useSelect, useListBox, useOption } from 'react-aria';
import { useSelectState } from 'react-stately';
import type { AriaSelectProps } from '@react-types/select';

function Select<T extends object>(props: AriaSelectProps<T>) {
  const state = useSelectState(props);
  const ref = useRef<HTMLButtonElement>(null);
  const { triggerProps, valueProps, menuProps } = useSelect(props, state, ref);

  return (
    <div className="relative inline-block">
      {/* Trigger */}
      <button {...triggerProps} ref={ref} className="flex h-10 items-center border rounded px-3">
        <span {...valueProps}>
          {state.selectedItem ? state.selectedItem.rendered : 'Select...'}
        </span>
      </button>

      {/* Dropdown */}
      {state.isOpen && (
        <ListBox {...menuProps} state={state} className="absolute mt-1 border rounded shadow-lg" />
      )}
    </div>
  );
}

function ListBox(props: any) {
  const ref = useRef<HTMLUListElement>(null);
  const { listBoxProps } = useListBox(props, props.state, ref);

  return (
    <ul {...listBoxProps} ref={ref} className={props.className}>
      {[...props.state.collection].map((item) => (
        <Option key={item.key} item={item} state={props.state} />
      ))}
    </ul>
  );
}

function Option({ item, state }: any) {
  const ref = useRef<HTMLLIElement>(null);
  const { optionProps, isSelected, isFocused } = useOption({ key: item.key }, state, ref);

  return (
    <li
      {...optionProps}
      ref={ref}
      className={cn(
        'px-3 py-2 cursor-pointer',
        isFocused && 'bg-blue-100',
        isSelected && 'font-bold'
      )}
    >
      {item.rendered}
    </li>
  );
}
```

---

## 8. Migration Guide: HOC/Render Props → Hooks

### Migration Step 1: Extract Logic into Hook

```typescript
// BEFORE: HOC with logic embedded
function withWindowSize(WrappedComponent: ComponentType<any>) {
  return class extends Component {
    state = { width: window.innerWidth, height: window.innerHeight };
    handleResize = () => {
      this.setState({ width: window.innerWidth, height: window.innerHeight });
    };
    componentDidMount() {
      window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
      window.removeEventListener('resize', this.handleResize);
    }
    render() {
      return <WrappedComponent {...this.props} windowSize={this.state} />;
    }
  };
}

// AFTER: Custom hook
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handler = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return size;
}
```

### Migration Step 2: Update Consumers

```typescript
// BEFORE: HOC consumer
function Dashboard({ windowSize }: { windowSize: { width: number; height: number } }) {
  return <div>{windowSize.width > 768 ? <DesktopView /> : <MobileView />}</div>;
}
const EnhancedDashboard = withWindowSize(Dashboard);

// AFTER: Hook consumer
function Dashboard() {
  const { width } = useWindowSize();
  return <div>{width > 768 ? <DesktopView /> : <MobileView />}</div>;
}
// No wrapper needed — use Dashboard directly
```

### Migration Step 3: Remove HOC Wrappers from Exports

```typescript
// BEFORE: Multiple HOC wrappers (wrapper hell)
export default withAuth(
  withTheme(
    withErrorBoundary(
      withRouter(Dashboard)
    )
  )
);

// AFTER: Most become hooks, only justified HOCs remain
function Dashboard() {
  const { user } = useAuth();       // was: withAuth
  const { theme } = useTheme();     // was: withTheme
  const router = useRouter();       // was: withRouter
  // ...
}

// Only withErrorBoundary remains as HOC (requires class component)
export default withErrorBoundary(Dashboard, {
  FallbackComponent: ErrorFallback,
});
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **HOC for logic reuse** | `withFetch(Component)` wrapping for data fetching | Use `useFetch()` hook — HOCs cannot conditionally run |
| **Render prop for simple logic** | `<Toggle render={({ on, toggle }) => ...} />` | Use `useToggle()` hook — no rendering control needed |
| **Multiple HOC wrappers** | `withA(withB(withC(Component)))` — wrapper hell | Migrate to hooks; keep only withErrorBoundary, withAuth |
| **Render prop callback pyramid** | Nested render props 3+ levels deep | Extract hooks: each render prop becomes a `useSomething()` |
| **Missing displayName on HOC** | DevTools shows `<Unknown>` or `<_class>` | ALWAYS set `Wrapped.displayName = \`withX(${name})\`` |
| **HOC swallowing props** | HOC consumes a prop and does not forward it | ALWAYS spread `{...props}` onto the wrapped component |
| **HOC with incorrect generics** | TypeScript shows `any` on wrapped component | Use `<P extends RequiredProps>` generic and `Omit<P, 'injected'>` |
| **Using Radix/Headless UI AND custom compound** | Duplicate behavior — library + hand-rolled | Choose ONE: use the library OR build from scratch. NEVER both. |
| **Render prop without memoization** | Inline render function causes re-renders every render | Extract render function to component or memoize with `useCallback` |
| **Hook that returns JSX** | `useTable()` returning `<table>...</table>` | Hooks return DATA + prop getters, NEVER JSX |

---

## 10. Enforcement Checklist

```
PRE-COMMIT / CODE REVIEW CHECKLIST:

[ ] NEW logic reuse uses custom hooks (NOT HOCs or render props)
[ ] HOCs are used ONLY for: auth guards, error boundaries, feature flags
[ ] Render props are used ONLY for headless UI patterns
[ ] HOCs set displayName on the returned component
[ ] HOCs spread remaining props onto wrapped component
[ ] HOCs use correct TypeScript generics (no `any` leakage)
[ ] Custom hooks follow the naming convention: use[Feature]()
[ ] Custom hooks do NOT return JSX — only data + handlers
[ ] Headless components return prop getters (inputProps, listboxProps, etc.)
[ ] Headless components include ALL required ARIA attributes in prop getters
[ ] No render prop callback pyramids (max 1 level deep)
[ ] No more than 2 HOC wrappers on any single component
[ ] Migration: new code does NOT add HOC wrappers to existing HOC chains
[ ] Headless library components (Radix/Headless UI) are used when available
[ ] Render prop inline functions are extracted or memoized
```
