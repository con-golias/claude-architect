# React — Complete Specification

> **AI Plugin Directive:** When a developer asks "how does React work?", "should I use React?", "what is React's rendering model?", "explain React 19 features", "what are React's core concepts?", or any foundational React question, ALWAYS consult this directive. Apply React's declarative, component-based model with function components, hooks, and the modern concurrent rendering paradigm. NEVER recommend class components for new code. Default to React 19+ patterns with Server Components awareness.

**Core Rule: React is a LIBRARY for building user interfaces using the mental model UI = f(state). Components are pure functions of their props and state. Use function components with hooks EXCLUSIVELY for new code. Leverage React 19's concurrent features (transitions, Suspense, streaming) and the React Compiler for automatic optimization. NEVER mutate state directly — ALWAYS use setState or dispatch. NEVER use class components, mixins, or legacy lifecycle methods in new projects.**

---

## 1. React's Mental Model

```
                    REACT CORE MENTAL MODEL

  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │   UI = f(state)                                     │
  │                                                     │
  │   The ENTIRE UI is a pure function of state.        │
  │   When state changes, React re-computes the UI.     │
  │   React figures out WHAT changed and updates        │
  │   the DOM efficiently (reconciliation).             │
  │                                                     │
  └─────────────────────────────────────────────────────┘

  State A ──→ render() ──→ Virtual DOM A ──┐
                                           ├──→ Diff ──→ DOM Patches
  State B ──→ render() ──→ Virtual DOM B ──┘

  KEY INSIGHT:
  - You describe WHAT the UI should look like
  - React figures out HOW to update the DOM
  - You NEVER touch the DOM directly
```

### 1.1 Declarative vs Imperative

```typescript
// ❌ IMPERATIVE (jQuery-style) — describes HOW
const button = document.createElement('button');
button.textContent = 'Count: 0';
button.addEventListener('click', () => {
  count++;
  button.textContent = `Count: ${count}`;
});
document.body.appendChild(button);

// ✅ DECLARATIVE (React) — describes WHAT
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
// React handles ALL DOM updates automatically
```

---

## 2. React Architecture — Fiber Reconciler

```
              REACT RENDERING PIPELINE (Fiber Architecture)

  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │   TRIGGER     │    │   RENDER      │    │   COMMIT     │
  │              │    │   (Reconcile)  │    │              │
  │ • setState() │───▶│ • Build Fiber │───▶│ • Apply DOM  │
  │ • forceUpdate│    │   tree diff   │    │   mutations  │
  │ • Parent     │    │ • Determine   │    │ • Run layout │
  │   re-render  │    │   changes     │    │   effects    │
  │ • Context    │    │ • INTERRUPTIBLE│    │ • SYNCHRONOUS│
  │   change     │    │   (concurrent)│    │ • (blocking) │
  └──────────────┘    └──────────────┘    └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Fiber Node   │
                      │ ┌──────────┐ │
                      │ │ type     │ │ ← Component function/string
                      │ │ props    │ │ ← Current props
                      │ │ state    │ │ ← Hooks linked list
                      │ │ child    │ │ ← First child fiber
                      │ │ sibling  │ │ ← Next sibling fiber
                      │ │ return   │ │ ← Parent fiber
                      │ │ alternate│ │ ← Work-in-progress copy
                      │ │ flags    │ │ ← Side effects to apply
                      │ └──────────┘ │
                      └──────────────┘

  FIBER KEY CONCEPTS:
  1. Each component instance = one Fiber node
  2. Fiber tree = linked list (child → sibling → return)
  3. Double buffering: "current" tree + "work-in-progress" tree
  4. Render phase is INTERRUPTIBLE (can pause for higher priority work)
  5. Commit phase is SYNCHRONOUS (DOM must update atomically)
```

### 2.1 Reconciliation Algorithm

```
RECONCILIATION RULES:

1. DIFFERENT element types → tear down old tree, build new tree
   <div> → <span>  =  destroy div + children, create span

2. SAME element type → update attributes only
   <div className="a"> → <div className="b">  =  update className

3. SAME component type → reuse instance, update props
   <UserCard user={A} /> → <UserCard user={B} />  =  same instance, new props

4. Lists REQUIRE stable keys for efficient diffing
   ✅ key={item.id}     → React matches by key, minimal DOM ops
   ❌ key={index}       → React re-renders ALL items on insert/delete
   ❌ key={Math.random()} → React destroys/recreates EVERY render

KEY RULE:
  - NEVER use array index as key for dynamic lists
  - NEVER generate keys during render (Math.random, Date.now)
  - ALWAYS use stable, unique identifiers from data
```

---

## 3. Component Model

### 3.1 Function Components (ONLY Standard)

```typescript
// ✅ Function component with TypeScript
interface UserProfileProps {
  userId: string;
  showAvatar?: boolean;
  onEdit: (userId: string) => void;
}

function UserProfile({ userId, showAvatar = true, onEdit }: UserProfileProps) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <ProfileSkeleton />;
  if (!user) return <NotFound />;

  return (
    <article className="user-profile">
      {showAvatar && <Avatar src={user.avatarUrl} alt={user.name} />}
      <h2>{user.name}</h2>
      <p>{user.bio}</p>
      <button onClick={() => onEdit(userId)}>Edit Profile</button>
    </article>
  );
}

// RULES:
// - ALWAYS type props with interface (not type alias for public APIs)
// - ALWAYS destructure props in parameter
// - ALWAYS provide default values for optional props
// - NEVER use React.FC — it adds implicit children prop and obscures return type
// - NEVER use defaultProps — use parameter defaults instead
```

### 3.2 Component Naming and Export Conventions

```typescript
// ✅ CORRECT: Named export + PascalCase
export function UserProfile() { ... }

// ✅ CORRECT: Default export for route pages (Next.js, Remix)
export default function ProfilePage() { ... }

// ❌ WRONG: Arrow function for components (no name in DevTools without explicit name)
export const UserProfile = () => { ... }
// Exception: Arrow is fine if you have a display name or it's a small inline component

// ❌ WRONG: React.FC / React.FunctionComponent
const UserProfile: React.FC<Props> = () => { ... }
// Problems:
// 1. Adds implicit `children` prop (React 17, removed in 18+)
// 2. Doesn't support generics well
// 3. Return type is too broad (allows undefined)

// ✅ CORRECT: Generic components
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}
```

---

## 4. JSX Transformation

```
JSX COMPILATION PIPELINE:

  Source Code (JSX)              Compiled Output (JS)
  ─────────────────              ────────────────────

  <div className="card">         jsx("div", {
    <h2>{title}</h2>               className: "card",
    <p>{body}</p>                  children: [
  </div>                             jsx("h2", { children: title }),
                                     jsx("p", { children: body }),
                                   ]
                                 })

  OLD TRANSFORM (React 16):     React.createElement("div", ...)
  NEW TRANSFORM (React 17+):    _jsx("div", ...)  ← automatic runtime
                                 No "import React" needed!

RULES:
  - React 17+ uses automatic JSX transform — DO NOT import React for JSX
  - STILL import React for hooks: import { useState, useEffect } from 'react'
  - Fragments: <></> compiles to jsx(Fragment, ...)
  - JSX expressions MUST return a single root element (or Fragment)
  - Conditional rendering: use && or ternary, NEVER if/else inside JSX
```

### 4.1 Conditional Rendering Patterns

```typescript
// ✅ PATTERN 1: Short-circuit (simple show/hide)
{isLoggedIn && <UserMenu />}

// ⚠️ DANGER: Falsy values render "0" or "NaN"
{count && <Badge count={count} />}     // ❌ Renders "0" when count is 0
{count > 0 && <Badge count={count} />} // ✅ Explicit boolean

// ✅ PATTERN 2: Ternary (either/or)
{isLoggedIn ? <UserMenu /> : <LoginButton />}

// ✅ PATTERN 3: Early return (complex conditions)
function Dashboard({ user }: { user: User | null }) {
  if (!user) return <LoginPrompt />;
  if (user.isBanned) return <BannedMessage />;
  if (!user.hasVerifiedEmail) return <VerifyEmail />;

  return <DashboardContent user={user} />;
}

// ✅ PATTERN 4: Map for lists (ALWAYS provide key)
{items.map(item => (
  <ListItem key={item.id} item={item} />
))}

// ❌ NEVER: Switch/if-else inside JSX
// ❌ NEVER: Complex logic inside JSX — extract to variables or functions
```

---

## 5. React 19 Features

### 5.1 Feature Overview

```
REACT 19 NEW FEATURES:

┌──────────────────────────┬──────────────────────────────────────────┐
│ Feature                  │ What It Does                             │
├──────────────────────────┼──────────────────────────────────────────┤
│ React Compiler           │ Auto-memoizes — useMemo/useCallback      │
│ (React Forget)           │ are now OPTIONAL, compiler handles it     │
├──────────────────────────┼──────────────────────────────────────────┤
│ use() hook               │ Read promises and context in render       │
│                          │ (works with Suspense, replaces useEffect  │
│                          │ for data fetching in many cases)          │
├──────────────────────────┼──────────────────────────────────────────┤
│ Server Components        │ Components that run ONLY on the server    │
│                          │ — zero client JS, direct DB/API access    │
├──────────────────────────┼──────────────────────────────────────────┤
│ Server Actions           │ "use server" functions called from client │
│                          │ — progressive enhancement, form handling  │
├──────────────────────────┼──────────────────────────────────────────┤
│ useActionState           │ Manages form action state (pending,       │
│                          │ result, error) — replaces useFormState    │
├──────────────────────────┼──────────────────────────────────────────┤
│ useFormStatus             │ Read parent <form> submission status      │
│                          │ (pending state for submit buttons)        │
├──────────────────────────┼──────────────────────────────────────────┤
│ useOptimistic            │ Optimistic UI updates during async ops    │
│                          │ — reverts automatically on failure        │
├──────────────────────────┼──────────────────────────────────────────┤
│ ref as prop              │ Refs can be passed as regular props       │
│                          │ — forwardRef() is NO LONGER NEEDED        │
├──────────────────────────┼──────────────────────────────────────────┤
│ Context as Provider      │ <Context> instead of <Context.Provider>  │
│                          │ — simpler syntax                          │
├──────────────────────────┼──────────────────────────────────────────┤
│ Document Metadata        │ <title>, <meta>, <link> anywhere in       │
│                          │ component tree — hoisted to <head>        │
├──────────────────────────┼──────────────────────────────────────────┤
│ Stylesheet Support       │ <link rel="stylesheet" precedence="..."> │
│                          │ — React manages loading order             │
├──────────────────────────┼──────────────────────────────────────────┤
│ Async Script Support     │ <script async> deduplication and ordering │
└──────────────────────────┴──────────────────────────────────────────┘
```

### 5.2 use() Hook

```typescript
// use() reads a promise during render — works with Suspense
import { use, Suspense } from 'react';

// The promise is created OUTSIDE the component (or in a Server Component)
// NEVER create promises inside client components — causes infinite loops
const userPromise = fetchUser(userId);

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  // use() suspends until promise resolves
  const user = use(userPromise);

  return <h1>{user.name}</h1>;
}

// Parent wraps in Suspense
function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={fetchUser('123')} />
    </Suspense>
  );
}

// use() also replaces useContext — conditional context reading
function Button({ showTheme }: { showTheme: boolean }) {
  if (showTheme) {
    const theme = use(ThemeContext); // ✅ Conditional — not possible with useContext
    return <button style={{ color: theme.primary }}>Themed</button>;
  }
  return <button>Default</button>;
}
```

### 5.3 Server Actions

```typescript
// actions.ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  // Runs on the SERVER — direct DB access
  const title = formData.get('title') as string;
  const body = formData.get('body') as string;

  // ALWAYS validate on server — client can be bypassed
  if (!title || title.length < 3) {
    return { error: 'Title must be at least 3 characters' };
  }

  await db.post.create({ data: { title, body } });
  revalidatePath('/posts');
  redirect('/posts');
}

// component.tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPost } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating...' : 'Create Post'}
    </button>
  );
}

function CreatePostForm() {
  const [state, action] = useActionState(createPost, null);

  return (
    <form action={action}>
      <input name="title" required />
      <textarea name="body" required />
      {state?.error && <p className="error">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

### 5.4 useOptimistic

```typescript
'use client';

import { useOptimistic } from 'react';

function MessageList({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimistic] = useOptimistic(
    messages,
    (currentMessages, newMessage: string) => [
      ...currentMessages,
      { id: 'temp-' + Date.now(), text: newMessage, sending: true },
    ]
  );

  async function sendMessage(formData: FormData) {
    const text = formData.get('text') as string;
    addOptimistic(text); // Immediately show in UI
    await submitMessage(text); // Server call — reverts on failure
  }

  return (
    <div>
      {optimisticMessages.map(msg => (
        <div key={msg.id} style={{ opacity: msg.sending ? 0.6 : 1 }}>
          {msg.text}
        </div>
      ))}
      <form action={sendMessage}>
        <input name="text" />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### 5.5 ref as Prop (No More forwardRef)

```typescript
// React 19: ref is a regular prop
// ❌ OLD (React 18): forwardRef required
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});

// ✅ NEW (React 19): ref as regular prop
function Input({ ref, ...props }: InputProps & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}

// Usage is the same
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);
  return <Input ref={inputRef} placeholder="Name" />;
}
```

---

## 6. Concurrent Rendering

```
CONCURRENT RENDERING MODEL:

  Traditional (Synchronous):
  ┌────────────────────────────────────────────┐
  │ Render Component Tree (BLOCKING)           │
  │ ██████████████████████████████████████████ │
  │ ← Cannot interrupt — main thread blocked → │
  └────────────────────────────────────────────┘

  Concurrent (React 18+):
  ┌──────────────────────────────────────────────────────┐
  │ Urgent Update (user input)                           │
  │ ████████                                             │
  │          ← Interrupts transition render              │
  │                                                      │
  │ Transition (non-urgent)                              │
  │ ████░░░░████░░░░████████████████████                 │
  │     ↑ pause ↑ resume                                 │
  │     (yield to urgent work)                           │
  └──────────────────────────────────────────────────────┘
```

### 6.1 Transitions

```typescript
import { useState, useTransition, useDeferredValue } from 'react';

// PATTERN 1: useTransition — mark state update as non-urgent
function SearchPage() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value); // ← URGENT: update input immediately

    startTransition(() => {
      // NON-URGENT: can be interrupted by typing
      setSearchResults(filterLargeDataset(value));
    });
  }

  return (
    <div>
      <input value={query} onChange={handleSearch} />
      {isPending ? <Spinner /> : <Results />}
    </div>
  );
}

// PATTERN 2: useDeferredValue — defer a value
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  // Heavy computation uses the DEFERRED value
  const results = useMemo(() =>
    filterLargeDataset(deferredQuery),
    [deferredQuery]
  );

  return (
    <div style={{ opacity: isStale ? 0.6 : 1 }}>
      {results.map(r => <ResultItem key={r.id} item={r} />)}
    </div>
  );
}

// DECISION: useTransition vs useDeferredValue
// useTransition  → You control WHEN the state update happens
// useDeferredValue → You defer a VALUE you receive as prop
```

### 6.2 Automatic Batching

```typescript
// React 18+: ALL state updates are batched (even in async/setTimeout)

// ✅ React 18+: These are ALL batched — single re-render
function handleClick() {
  setCount(c => c + 1);     // Batched
  setFlag(f => !f);          // Batched
  setName('Alice');          // Batched — ONE re-render total
}

async function handleSubmit() {
  const data = await fetchData();
  setData(data);             // Batched
  setLoading(false);         // Batched — ONE re-render total
}

setTimeout(() => {
  setCount(c => c + 1);     // Batched
  setFlag(f => !f);          // Batched — ONE re-render total
}, 1000);

// To opt OUT of batching (rare — almost never needed):
import { flushSync } from 'react-dom';

function handleClick() {
  flushSync(() => {
    setCount(c => c + 1);   // Immediate re-render
  });
  // DOM is updated here
  flushSync(() => {
    setFlag(f => !f);        // Another immediate re-render
  });
}
```

---

## 7. StrictMode

```typescript
// StrictMode INTENTIONALLY double-renders in development
// to help find impure components and side effects

// In development:
//   - Components render TWICE (to detect impure renders)
//   - Effects run, cleanup, and run again (to detect missing cleanup)
//   - Deprecated API usage logs warnings

// In production:
//   - NO double-rendering, NO extra effect cycles
//   - ZERO performance impact

// ✅ ALWAYS wrap your app root in StrictMode
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// COMMON MISTAKE: "My effect runs twice!"
// This is INTENTIONAL in dev. Your effect should work correctly
// even if it runs twice. If it doesn't, you have a bug:

// ❌ BUG: No cleanup — creates duplicate subscriptions
useEffect(() => {
  const ws = new WebSocket(url);
  ws.onmessage = handleMessage;
  // Missing cleanup!
}, [url]);

// ✅ CORRECT: Cleanup — handles double-run correctly
useEffect(() => {
  const ws = new WebSocket(url);
  ws.onmessage = handleMessage;
  return () => ws.close(); // Cleanup on unmount/re-run
}, [url]);
```

---

## 8. React Compiler (React Forget)

```
REACT COMPILER — AUTOMATIC MEMOIZATION:

  Before Compiler:
  ┌──────────────────────────────────────────┐
  │ const memoized = useMemo(() => {         │
  │   return expensiveCalculation(data);     │
  │ }, [data]);                              │
  │                                          │
  │ const callback = useCallback(() => {     │
  │   handleClick(id);                       │
  │ }, [id]);                                │
  │                                          │
  │ const MemoChild = React.memo(Child);     │
  └──────────────────────────────────────────┘

  After Compiler:
  ┌──────────────────────────────────────────┐
  │ // Just write normal code                │
  │ const result = expensiveCalculation(data);│
  │ const handleClick = () => onClick(id);   │
  │ return <Child onClick={handleClick} />;  │
  │                                          │
  │ // Compiler automatically memoizes       │
  │ // the right things at compile time      │
  └──────────────────────────────────────────┘

RULES FOR REACT COMPILER:
  1. Components MUST be pure (same props → same output)
  2. Follow the Rules of React (no mutation during render)
  3. useMemo/useCallback still work — compiler skips them
  4. NOT a replacement for understanding performance
  5. Enable incrementally: per-file or per-component
```

```typescript
// Enable React Compiler in Next.js
// next.config.ts
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
};

// Enable per-file with directive
'use memo'; // Opt-in a single file

// Disable for a specific component
function ComponentThatBreaksRules() {
  'use no memo'; // Opt-out
  // ...
}
```

---

## 9. React Ecosystem Decision Tree

```
CHOOSING YOUR REACT STACK:

START: What are you building?
│
├── Marketing/Content Site
│   └── Next.js (App Router) + SSG/ISR + Tailwind
│
├── SaaS / Dashboard (authenticated)
│   ├── Need SSR/SEO? → Next.js App Router
│   └── Pure SPA? → Vite + React Router + TanStack Query
│
├── E-commerce
│   └── Next.js (App Router) + ISR + Server Components
│
├── Mobile App
│   └── React Native (Expo) [see mobile/ section]
│
├── Desktop App
│   └── Electron or Tauri + React [see desktop/ section]
│
└── Internal Tool
    └── Vite SPA + React Router + TanStack Query + Zustand

STATE MANAGEMENT DECISION:
│
├── Server data (API responses)?
│   └── TanStack Query (ALWAYS — replaces useEffect+useState for fetching)
│
├── Simple local state?
│   └── useState / useReducer
│
├── Complex client state (shared across many components)?
│   ├── Few stores, simple → Zustand
│   ├── Fine-grained reactivity → Jotai
│   └── Large team, strict patterns → Redux Toolkit
│
└── URL state (filters, pagination)?
    └── useSearchParams (React Router / Next.js)

STYLING DECISION:
│
├── Utility-first → Tailwind CSS (RECOMMENDED for most projects)
├── CSS Modules → Good for component libraries
├── CSS-in-JS → styled-components / Emotion (declining — RSC incompatible)
└── Zero-runtime CSS-in-JS → Vanilla Extract, Panda CSS (RSC compatible)
```

---

## 10. Component Composition Patterns

```typescript
// PATTERN 1: Children composition (preferred for layout)
function Card({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>;
}

function App() {
  return (
    <Card>
      <h2>Title</h2>
      <p>Content</p>
    </Card>
  );
}

// PATTERN 2: Named slots via props
function Layout({
  header,
  sidebar,
  children,
}: {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="layout">
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  );
}

// PATTERN 3: Render props (for headless behavior)
function Toggle({
  children,
}: {
  children: (props: { isOn: boolean; toggle: () => void }) => ReactNode;
}) {
  const [isOn, setIsOn] = useState(false);
  return <>{children({ isOn, toggle: () => setIsOn(v => !v) })}</>;
}

// PATTERN 4: Compound components (see component-design/compound-components.md)
<Select>
  <Select.Trigger>Choose...</Select.Trigger>
  <Select.Options>
    <Select.Option value="a">Option A</Select.Option>
    <Select.Option value="b">Option B</Select.Option>
  </Select.Options>
</Select>
```

---

## 11. Error Handling

```typescript
// Error Boundaries catch rendering errors
// MUST be class components (no hook equivalent yet)

import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to error reporting service
    reportError(error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback(this.state.error, this.reset);
      }
      return fallback;
    }
    return this.props.children;
  }
}

// ✅ Usage: Wrap feature boundaries
function App() {
  return (
    <ErrorBoundary fallback={(error, reset) => (
      <div>
        <h2>Something went wrong</h2>
        <pre>{error.message}</pre>
        <button onClick={reset}>Try again</button>
      </div>
    )}>
      <Dashboard />
    </ErrorBoundary>
  );
}

// RULES:
// - Place error boundaries at FEATURE boundaries (not per-component)
// - Error boundaries do NOT catch: event handlers, async code, SSR, errors in the boundary itself
// - For event handler errors: use try/catch + state
// - For async errors: use TanStack Query error handling or try/catch
```

---

## 12. React DevTools & Debugging

```
REACT DEVTOOLS ESSENTIALS:

Components Tab:
  - Inspect component tree hierarchy
  - Edit props and state in real-time
  - Search components by name
  - Filter by type (DOM, Fragment, etc.)

Profiler Tab:
  - Record rendering sessions
  - Identify unnecessary re-renders (grey = did not render)
  - Flame chart: render duration per component
  - Ranked chart: components sorted by render time
  - "Why did this render?" shows the trigger

DEBUGGING WORKFLOW:
  1. Open Profiler → Start recording
  2. Perform the slow interaction
  3. Stop recording
  4. Look for:
     - Components rendering when they shouldn't
     - Long render times (>16ms = frame drop)
     - Cascading re-renders from context changes
  5. Fix with: component splitting, memo (if compiler not available), state colocation
```

---

## 13. When to Use React vs Alternatives

```
┌───────────────┬────────────────────────────────────────────────────┐
│ Choose React  │ Reason                                             │
│ WHEN          │                                                    │
├───────────────┼────────────────────────────────────────────────────┤
│ Large team    │ Largest talent pool, most resources, mature tooling│
│ Complex SPA   │ Component model scales well, rich ecosystem        │
│ Need SSR/SSG  │ Next.js is best-in-class meta-framework           │
│ React Native  │ Share code between web and mobile                  │
│ Existing RN   │ Already invested in React ecosystem                │
│ Ecosystem     │ Most third-party components and libraries          │
├───────────────┼────────────────────────────────────────────────────┤
│ Consider Vue  │ Simpler mental model, better DX for smaller teams │
│ Consider      │ Smaller bundles, better perf, simpler reactivity  │
│ Svelte        │                                                    │
│ Consider      │ Signals-based, enterprise-friendly, opinionated   │
│ Angular       │                                                    │
│ Consider      │ Multi-page apps, content-heavy, minimal JS needed │
│ Astro/HTMX    │                                                    │
└───────────────┴────────────────────────────────────────────────────┘
```

---

## 14. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Using class components for new code** | Verbose lifecycle methods, no hooks access, harder to share logic | Use function components with hooks exclusively |
| **Mutating state directly** | `state.items.push(item)` — UI does not update, stale data | ALWAYS create new objects/arrays: `setItems([...items, item])` |
| **Using index as key for dynamic lists** | Items re-render incorrectly on reorder/insert/delete, input state jumps | Use stable unique ID from data (`key={item.id}`) |
| **Creating components inside components** | New component instance every render, state resets, DOM thrashes | Define components at module level, pass data via props |
| **useEffect for derived state** | Extra render cycle, stale data, complex dependency chains | Calculate derived values during render: `const total = items.reduce(...)` |
| **Over-memoizing** | useMemo/useCallback everywhere, code harder to read, minimal benefit | Only memoize expensive calculations or referential equality needs |
| **Prop drilling 5+ levels deep** | Brittle component chain, every intermediate component takes unused props | Use composition, context, or state management library |
| **God components (500+ lines)** | Untestable, unmaintainable, slow rendering | Extract subcomponents, custom hooks, utility functions |
| **useEffect as "onMount"** | Missing cleanup, stale closures, race conditions | Use TanStack Query for fetching, proper cleanup for subscriptions |
| **Not using Suspense** | Manual loading states everywhere, waterfall loading, inconsistent UX | Wrap async boundaries in Suspense with fallback |
| **Calling setState in render** | Infinite re-render loop, "Too many re-renders" error | Move state updates to event handlers or effects |
| **Using React.FC** | Implicit children prop, poor generic support, wider return type | Use plain function declaration with typed props parameter |
| **Missing ErrorBoundary** | Entire app crashes on single component error | Wrap feature boundaries in ErrorBoundary |
| **Not using StrictMode** | Impure components and missing cleanup go undetected in dev | ALWAYS enable StrictMode in development |

---

## 15. Enforcement Checklist

### Project Setup
- [ ] React 19+ used for all new projects
- [ ] StrictMode enabled at application root
- [ ] TypeScript enabled with strict mode
- [ ] React Compiler enabled (or useMemo/useCallback used intentionally)
- [ ] ESLint with `eslint-plugin-react-hooks` (exhaustive-deps rule set to error)

### Component Standards
- [ ] ALL components are function components (class components only for ErrorBoundary)
- [ ] Props typed with interface (not type alias for public APIs)
- [ ] Props destructured in parameter list with default values
- [ ] React.FC / React.FunctionComponent is NOT used
- [ ] Generic components use function declaration (not arrow)
- [ ] Components defined at module level (NEVER inside other components)
- [ ] Components under 200 lines (extract hooks and subcomponents if larger)

### State & Data
- [ ] Server state managed by TanStack Query or equivalent (NOT useEffect + useState)
- [ ] Client state uses Zustand/Jotai for global, useState for local
- [ ] Derived values calculated during render (NOT stored in state)
- [ ] State colocated as close to usage as possible
- [ ] URL state (search params) used for shareable/bookmarkable UI state

### Rendering
- [ ] Lists use stable unique keys from data (NEVER index, NEVER random)
- [ ] Conditional rendering uses && with explicit booleans or ternary
- [ ] Error boundaries wrap feature boundaries
- [ ] Suspense boundaries wrap async content
- [ ] React.lazy used for route-level code splitting

### Performance
- [ ] React DevTools Profiler used to verify render performance
- [ ] No unnecessary re-renders (verify with Profiler "Why did this render?")
- [ ] Large lists use virtualization (react-window, TanStack Virtual)
- [ ] Images use lazy loading and proper sizing

### React 19
- [ ] Server Components used for data fetching (in Next.js/framework that supports RSC)
- [ ] Server Actions used for mutations with proper validation
- [ ] forwardRef replaced with ref-as-prop pattern
- [ ] Context uses `<Context>` instead of `<Context.Provider>`
