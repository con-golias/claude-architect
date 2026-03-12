# Unit Testing — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to unit test components?", "Vitest vs Jest?", "testing React hooks", "mock API calls in tests", "test coverage thresholds", "Testing Library queries", "snapshot testing", "test utilities", "frontend unit testing strategy", or any unit testing question, ALWAYS consult this directive. Unit tests verify individual functions, components, and hooks in isolation. ALWAYS use Testing Library for component tests — it enforces user-centric testing. ALWAYS prefer Vitest over Jest for new projects — native ESM, faster execution, Vite-compatible. NEVER test implementation details — test behavior the user sees.

**Core Rule: Unit tests MUST test behavior, NOT implementation. Use Testing Library queries that reflect how users interact with the UI (getByRole, getByLabelText, getByText) — NEVER query by test ID unless no semantic alternative exists. Mock at boundaries (network, timers, modules) — NEVER mock the thing you are testing. Aim for 80%+ branch coverage on business logic, but NEVER chase 100% coverage as a goal — coverage measures lines executed, NOT correctness.**

---

## 1. Testing Framework Comparison

```
  FRONTEND UNIT TESTING STACK — 2024+

  ┌─────────────────────────────────────────────────────┐
  │                   TEST RUNNER                        │
  │                                                     │
  │   ┌──────────────────┐   ┌───────────────────────┐  │
  │   │     VITEST       │   │       JEST             │  │
  │   │                  │   │                        │  │
  │   │  • Native ESM    │   │  • CJS-first           │  │
  │   │  • Vite pipeline │   │  • Custom transforms   │  │
  │   │  • Watch mode    │   │  • Mature ecosystem    │  │
  │   │  • In-source     │   │  • --experimental-vm   │  │
  │   │    testing       │   │    for ESM             │  │
  │   │  • HMR for tests │   │  • Slower cold start   │  │
  │   └──────────────────┘   └───────────────────────┘  │
  │                                                     │
  │               COMPONENT TESTING                     │
  │                                                     │
  │   ┌──────────────────────────────────────────────┐  │
  │   │           TESTING LIBRARY                     │  │
  │   │                                              │  │
  │   │  @testing-library/react    (React)           │  │
  │   │  @testing-library/vue      (Vue)             │  │
  │   │  @testing-library/svelte   (Svelte)          │  │
  │   │  @testing-library/angular  (Angular)         │  │
  │   │                                              │  │
  │   │  Philosophy: Test like a user interacts      │  │
  │   │  Queries:    getByRole > getByText > ...     │  │
  │   └──────────────────────────────────────────────┘  │
  │                                                     │
  │                 API MOCKING                         │
  │                                                     │
  │   ┌──────────────────────────────────────────────┐  │
  │   │              MSW (Mock Service Worker)        │  │
  │   │                                              │  │
  │   │  Intercepts at network level (not module)    │  │
  │   │  Same handlers for dev, test, Storybook      │  │
  │   │  REST + GraphQL support                      │  │
  │   └──────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────┘
```

### 1.1 Vitest vs Jest Comparison

| Feature | Vitest | Jest |
|---|---|---|
| **ESM Support** | Native — zero config | Experimental, requires `--experimental-vm-modules` |
| **TypeScript** | Via Vite (esbuild/SWC) — no extra config | Requires ts-jest or @swc/jest |
| **Speed (cold start)** | Fast — reuses Vite transform cache | Slower — transforms from scratch |
| **Speed (watch mode)** | HMR-based — only re-runs affected tests | File-watcher — re-runs entire file |
| **Config** | `vitest.config.ts` or inline in `vite.config.ts` | `jest.config.ts` — separate config |
| **Snapshot testing** | Built-in (Jest-compatible format) | Built-in (original) |
| **Coverage** | v8 (default) or istanbul | istanbul (default) or v8 |
| **UI** | `vitest --ui` — browser-based | None built-in (use Majestic) |
| **Compatibility** | Jest-compatible API (vi.mock = jest.mock) | N/A (original) |
| **In-source testing** | Supported — tests next to code, tree-shaken in prod | Not supported |
| **Concurrent tests** | File-level and test-level parallelism | File-level only (--workers) |
| **Ecosystem maturity** | Growing fast, some gaps | Largest, most integrations |

**VERDICT:** Use Vitest for new projects. Use Jest only when locked into a non-Vite build system (CRA, older Next.js).

### 1.2 Vitest Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,                    // describe, it, expect without imports
    environment: 'jsdom',             // or 'happy-dom' (faster, less complete)
    setupFiles: ['./src/test/setup.ts'],
    css: true,                        // process CSS imports
    coverage: {
      provider: 'v8',                 // faster than istanbul
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    // Performance
    pool: 'forks',                    // 'forks' (isolation) or 'threads' (speed)
    poolOptions: {
      forks: { isolate: false },      // share context for speed
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { server } from './mocks/server';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// MSW setup
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 1.3 Jest Setup (When Required)

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterSetup: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],     // faster than ts-jest
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
```

---

## 2. Testing Library — Core Philosophy

```
  TESTING LIBRARY QUERY PRIORITY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  PREFERRED (accessible to everyone):                 │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. getByRole('button', { name: 'Submit' })   │  │
  │  │  2. getByLabelText('Email')                   │  │
  │  │  3. getByPlaceholderText('Search...')          │  │
  │  │  4. getByText('Welcome back')                 │  │
  │  │  5. getByDisplayValue('john@example.com')     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SEMANTIC (accessible to screen readers):            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  6. getByAltText('Profile photo')             │  │
  │  │  7. getByTitle('Close')                       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  LAST RESORT (not accessible):                       │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  8. getByTestId('submit-btn')                 │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  NEVER USE:                                          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✗ container.querySelector('.btn')             │  │
  │  │  ✗ wrapper.find('Button')                     │  │
  │  │  ✗ getByClassName (does not exist)            │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 2.1 Query Variants

| Variant | 0 Matches | 1 Match | 1+ Matches | Async? |
|---|---|---|---|---|
| `getBy` | throws | returns | throws | No |
| `queryBy` | null | returns | throws | No |
| `findBy` | throws | returns | throws | Yes (waits) |
| `getAllBy` | throws | array | array | No |
| `queryAllBy` | [] | array | array | No |
| `findAllBy` | throws | array | array | Yes (waits) |

**Rules:**
- Use `getBy` for elements that MUST exist
- Use `queryBy` for asserting elements do NOT exist
- Use `findBy` for elements that appear asynchronously
- NEVER use `findBy` as a lazy substitute for `getBy`

### 2.2 Testing Component Rendering

```tsx
// UserProfile.tsx
interface UserProfileProps {
  user: { name: string; email: string; role: 'admin' | 'user' };
  onEdit: () => void;
}

export function UserProfile({ user, onEdit }: UserProfileProps) {
  return (
    <article aria-label="User profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {user.role === 'admin' && (
        <span className="badge">Admin</span>
      )}
      <button onClick={onEdit}>Edit Profile</button>
    </article>
  );
}
```

```tsx
// UserProfile.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserProfile } from './UserProfile';

// Test factory — create default props, override as needed
function createUser(overrides: Partial<UserProfileProps['user']> = {}) {
  return {
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'user' as const,
    ...overrides,
  };
}

describe('UserProfile', () => {
  it('renders user information', () => {
    const user = createUser();
    render(<UserProfile user={user} onEdit={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('shows admin badge for admin users', () => {
    const user = createUser({ role: 'admin' });
    render(<UserProfile user={user} onEdit={vi.fn()} />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('does NOT show admin badge for regular users', () => {
    const user = createUser({ role: 'user' });
    render(<UserProfile user={user} onEdit={vi.fn()} />);

    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    const user = createUser();
    render(<UserProfile user={user} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
```

---

## 3. Testing React Hooks

### 3.1 renderHook Pattern

```typescript
// useCounter.ts
import { useState, useCallback } from 'react';

export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  const reset = useCallback(() => setCount(initial), [initial]);

  return { count, increment, decrement, reset };
}
```

```typescript
// useCounter.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('starts with initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    expect(result.current.count).toBe(10);
  });

  it('defaults to 0', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('increments', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('resets to initial value', () => {
    const { result } = renderHook(() => useCounter(5));

    act(() => {
      result.current.increment();
      result.current.increment();
      result.current.reset();
    });

    expect(result.current.count).toBe(5);
  });
});
```

### 3.2 Testing Hooks with Context

```tsx
// useAuth.test.tsx
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth-context';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('useAuth', () => {
  it('starts as unauthenticated', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logs in and exposes user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('admin', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe('admin');
  });
});
```

### 3.3 Testing Hooks with TanStack Query

```tsx
// useUsers.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { useUsers } from './useUsers';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,             // IMPORTANT: disable retry in tests
        gcTime: 0,                // garbage collect immediately
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useUsers', () => {
  it('fetches and returns users', async () => {
    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].name).toBe('Alice');
  });

  it('handles server error', async () => {
    // Override handler for this test
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json(
          { message: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('500');
  });
});
```

---

## 4. Mocking Strategies

```
  MOCKING HIERARCHY — MOCK AT BOUNDARIES

  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  PREFERRED: Mock the network boundary              │
  │  ┌──────────────────────────────────────────────┐  │
  │  │  MSW (Mock Service Worker)                   │  │
  │  │  • Intercepts at fetch/XHR level             │  │
  │  │  • Same handlers in tests + Storybook + dev  │  │
  │  │  • Tests real HTTP client code               │  │
  │  └──────────────────────────────────────────────┘  │
  │                                                    │
  │  ACCEPTABLE: Mock module imports                   │
  │  ┌──────────────────────────────────────────────┐  │
  │  │  vi.mock / jest.mock                         │  │
  │  │  • Third-party modules with side effects     │  │
  │  │  • Browser APIs not available in jsdom       │  │
  │  │  • Expensive computations (crypto, canvas)   │  │
  │  └──────────────────────────────────────────────┘  │
  │                                                    │
  │  AVOID: Mock internal implementation               │
  │  ┌──────────────────────────────────────────────┐  │
  │  │  ✗ Mocking child components                  │  │
  │  │  ✗ Mocking hooks used by the component       │  │
  │  │  ✗ Spying on state setter calls              │  │
  │  └──────────────────────────────────────────────┘  │
  └────────────────────────────────────────────────────┘
```

### 4.1 MSW — Mock Service Worker

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // GET with typed response
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ]);
  }),

  // POST with request body
  http.post('/api/users', async ({ request }) => {
    const body = await request.json() as { name: string; email: string };
    return HttpResponse.json(
      { id: 4, ...body },
      { status: 201 }
    );
  }),

  // Dynamic params
  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id: Number(id),
      name: `User ${id}`,
      email: `user${id}@example.com`,
    });
  }),

  // Error response
  http.delete('/api/users/:id', () => {
    return HttpResponse.json(
      { message: 'Forbidden' },
      { status: 403 }
    );
  }),
];
```

```typescript
// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// Per-test handler override
it('handles network error', async () => {
  server.use(
    http.get('/api/users', () => {
      return HttpResponse.error();    // simulate network failure
    })
  );

  render(<UserList />);

  await waitFor(() => {
    expect(screen.getByText('Failed to load users')).toBeInTheDocument();
  });
});
```

### 4.2 Module Mocking

```typescript
// Mocking a module
vi.mock('./analytics', () => ({
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

import { trackEvent } from './analytics';

it('tracks form submission', async () => {
  render(<ContactForm />);

  await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

  expect(trackEvent).toHaveBeenCalledWith('form_submit', {
    form: 'contact',
    email: 'test@test.com',
  });
});
```

```typescript
// Mocking browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mocking IntersectionObserver
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

window.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
}));
```

### 4.3 Timer Mocking

```typescript
describe('Debounced search', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces search input by 300ms', async () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} debounceMs={300} />);

    // Use userEvent with advanceTimers option for fake timers
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.type(screen.getByRole('searchbox'), 'react');

    // Not called yet — still within debounce window
    expect(onSearch).not.toHaveBeenCalled();

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith('react');
    expect(onSearch).toHaveBeenCalledOnce();
  });
});
```

---

## 5. Testing Async Code

### 5.1 waitFor Pattern

```tsx
it('loads and displays data after fetch', async () => {
  render(<UserList />);

  // Assert loading state
  expect(screen.getByText('Loading...')).toBeInTheDocument();

  // Wait for data to appear
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  // Loading indicator gone
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();

  // All users rendered
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});
```

### 5.2 findBy vs waitFor

```tsx
// PREFER findBy when waiting for a single element
const heading = await screen.findByRole('heading', { name: 'Dashboard' });
expect(heading).toBeInTheDocument();

// Use waitFor when asserting on state changes or multiple conditions
await waitFor(() => {
  expect(screen.getByText('3 results')).toBeInTheDocument();
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});

// NEVER nest waitFor
// BAD:
await waitFor(async () => {
  await waitFor(() => { /* ... */ });   // NEVER
});

// GOOD:
await waitFor(() => {
  expect(screen.getByText('Done')).toBeInTheDocument();
});
```

### 5.3 act() — When You Need It

```
  act() DECISION TREE

  START
    │
    ├── Using Testing Library render/userEvent/waitFor/findBy?
    │   └── YES → act() is called INTERNALLY — do NOT wrap again
    │
    ├── Calling renderHook result.current methods?
    │   └── YES → Wrap in act()
    │
    ├── Triggering state update outside Testing Library?
    │   └── YES → Wrap in act()
    │
    └── Getting "act() warning"?
        └── Usually means an async update finished after test ended
            → Add await waitFor() or await findBy to wait for it
```

```typescript
// act() is ALREADY handled by Testing Library
await userEvent.click(button);            // act() inside
const el = await screen.findByText('X');  // act() inside
await waitFor(() => { /* ... */ });       // act() inside

// act() IS needed for direct state/hook updates
act(() => {
  result.current.increment();
});

// act() IS needed for manual timer advancement
act(() => {
  vi.advanceTimersByTime(1000);
});
```

---

## 6. Testing Utilities and Pure Functions

```typescript
// formatCurrency.ts
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
```

```typescript
// formatCurrency.test.ts
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('formats USD by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats EUR', () => {
    expect(formatCurrency(1234.56, 'EUR', 'de-DE')).toBe('1.234,56 €');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles negative amounts', () => {
    expect(formatCurrency(-42.5)).toBe('-$42.50');
  });

  // Table-driven tests for multiple cases
  it.each([
    [100, 'USD', 'en-US', '$100.00'],
    [100, 'GBP', 'en-GB', '£100.00'],
    [100, 'JPY', 'ja-JP', '￥100'],
  ])('formats %d %s for %s as %s', (amount, currency, locale, expected) => {
    expect(formatCurrency(amount, currency, locale)).toBe(expected);
  });
});
```

### 6.1 Testing Validators

```typescript
// validateEmail.test.ts
import { validateEmail } from './validateEmail';

describe('validateEmail', () => {
  // Valid emails
  it.each([
    'user@example.com',
    'user+tag@example.com',
    'user.name@sub.example.com',
    'user@123.123.123.123',
  ])('accepts valid email: %s', (email) => {
    expect(validateEmail(email)).toEqual({ valid: true });
  });

  // Invalid emails
  it.each([
    ['', 'Email is required'],
    ['notanemail', 'Invalid email format'],
    ['@example.com', 'Invalid email format'],
    ['user@', 'Invalid email format'],
    ['user @example.com', 'Email cannot contain spaces'],
  ])('rejects invalid email: %s with message: %s', (email, message) => {
    expect(validateEmail(email)).toEqual({ valid: false, error: message });
  });
});
```

---

## 7. Testing Store / State Management

### 7.1 Zustand Store Testing

```typescript
// useCartStore.ts
import { create } from 'zustand';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  total: () => number;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
    }),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  total: () =>
    get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

  clearCart: () => set({ items: [] }),
}));
```

```typescript
// useCartStore.test.ts
import { useCartStore } from './useCartStore';

// IMPORTANT: Reset store between tests
beforeEach(() => {
  useCartStore.setState({ items: [] });
});

describe('useCartStore', () => {
  it('adds item to cart', () => {
    const { addItem } = useCartStore.getState();

    addItem({ id: '1', name: 'Widget', price: 9.99 });

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: '1',
      name: 'Widget',
      price: 9.99,
      quantity: 1,
    });
  });

  it('increments quantity for duplicate item', () => {
    const { addItem } = useCartStore.getState();

    addItem({ id: '1', name: 'Widget', price: 9.99 });
    addItem({ id: '1', name: 'Widget', price: 9.99 });

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('calculates total', () => {
    const store = useCartStore.getState();

    store.addItem({ id: '1', name: 'Widget', price: 10 });
    store.addItem({ id: '2', name: 'Gadget', price: 20 });
    store.addItem({ id: '1', name: 'Widget', price: 10 }); // qty: 2

    expect(useCartStore.getState().total()).toBe(40); // 10*2 + 20*1
  });

  it('removes item', () => {
    const store = useCartStore.getState();
    store.addItem({ id: '1', name: 'Widget', price: 10 });
    store.addItem({ id: '2', name: 'Gadget', price: 20 });

    useCartStore.getState().removeItem('1');

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].id).toBe('2');
  });
});
```

### 7.2 Redux Store Testing

```typescript
// counterSlice.test.ts
import { counterSlice, increment, decrement, incrementByAmount } from './counterSlice';

const { reducer } = counterSlice;

describe('counterSlice', () => {
  it('returns initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({ value: 0 });
  });

  it('increments', () => {
    expect(reducer({ value: 3 }, increment())).toEqual({ value: 4 });
  });

  it('decrements', () => {
    expect(reducer({ value: 3 }, decrement())).toEqual({ value: 2 });
  });

  it('increments by amount', () => {
    expect(reducer({ value: 3 }, incrementByAmount(5))).toEqual({ value: 8 });
  });
});
```

---

## 8. Snapshot Testing

```
  SNAPSHOT TESTING DECISION TREE

  START
    │
    ├── Testing pure output (serialized data, CLI output)?
    │   └── YES → Snapshots are GOOD here
    │
    ├── Testing UI component rendering?
    │   └── Is the snapshot small and focused?
    │       ├── YES → Inline snapshot MAY be OK
    │       └── NO → Use explicit assertions instead
    │
    ├── Snapshot file > 50 lines?
    │   └── YES → Too big — break into focused assertions
    │
    └── Are you updating snapshots without reading the diff?
        └── YES → Snapshots are providing FALSE confidence
            → REMOVE them and write explicit assertions
```

### 8.1 When Snapshots Help

```typescript
// Good: small, focused inline snapshot
it('generates correct SQL', () => {
  const query = buildQuery({ table: 'users', where: { active: true } });

  expect(query).toMatchInlineSnapshot(`
    "SELECT * FROM users WHERE active = true"
  `);
});

// Good: serialized data structure
it('transforms API response', () => {
  const result = transformUser(apiResponse);

  expect(result).toMatchInlineSnapshot(`
    {
      "id": 1,
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "role": "admin",
    }
  `);
});
```

### 8.2 When Snapshots Hurt

```typescript
// BAD: Full component tree snapshot — brittle, nobody reads the diff
it('renders correctly', () => {
  const { container } = render(<ComplexDashboard />);
  expect(container).toMatchSnapshot();  // 500+ line snapshot nobody reviews
});

// GOOD: Explicit behavioral assertions instead
it('renders dashboard with user data', () => {
  render(<ComplexDashboard />);

  expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  expect(screen.getByText('Welcome, Jane')).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(5);
});
```

---

## 9. Code Coverage

### 9.1 Coverage Metrics

| Metric | What It Measures | Value |
|---|---|---|
| **Line coverage** | Lines executed during tests | Coarse — misses branches |
| **Branch coverage** | Decision paths (if/else, ternary, ??) | Most useful metric |
| **Function coverage** | Functions called during tests | Catches dead code |
| **Statement coverage** | Individual statements executed | Similar to line coverage |

### 9.2 Coverage Strategy

```
  COVERAGE TARGET STRATEGY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  BUSINESS LOGIC (utils, hooks, stores):              │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Target: 90%+ branch coverage                 │  │
  │  │  These are testable pure functions — cover     │  │
  │  │  edge cases, error paths, boundary values      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  UI COMPONENTS:                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Target: 70-80% branch coverage               │  │
  │  │  Test user interactions, conditional rendering │  │
  │  │  Skip: layout, styling, animation              │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  GENERATED / BOILERPLATE:                            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Target: Exclude from coverage                │  │
  │  │  Config files, type definitions, barrel files  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  GLOBAL MINIMUM:                                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  80% branches — enforced in CI                │  │
  │  │  Prevents merging PRs that drop coverage      │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 9.3 CI Coverage Enforcement

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npx vitest run --coverage

      - name: Check coverage thresholds
        run: npx vitest run --coverage --coverage.thresholds.100=false
        # Fails if below configured thresholds in vitest.config.ts

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
```

---

## 10. Framework-Specific Testing Patterns

### 10.1 Vue Test Utils + Testing Library

```typescript
// Counter.test.ts (Vue)
import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import Counter from './Counter.vue';

describe('Counter', () => {
  it('increments count on button click', async () => {
    render(Counter, {
      props: { initial: 5 },
    });

    expect(screen.getByText('Count: 5')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Increment' }));

    expect(screen.getByText('Count: 6')).toBeInTheDocument();
  });

  // Testing with Pinia store
  it('uses Pinia store', async () => {
    render(Counter, {
      global: {
        plugins: [createTestingPinia({
          initialState: {
            counter: { count: 10 },
          },
        })],
      },
    });

    expect(screen.getByText('Count: 10')).toBeInTheDocument();
  });
});
```

### 10.2 Angular Testing (TestBed)

```typescript
// user-profile.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { UserProfileComponent } from './user-profile.component';
import { UserService } from '../services/user.service';

// Modern approach: @testing-library/angular
describe('UserProfileComponent (Testing Library)', () => {
  it('renders user name', async () => {
    await render(UserProfileComponent, {
      componentInputs: {
        user: { name: 'Jane', email: 'jane@test.com' },
      },
    });

    expect(screen.getByText('Jane')).toBeInTheDocument();
  });
});

// Classic approach: TestBed (when Testing Library is not available)
describe('UserProfileComponent (TestBed)', () => {
  let fixture: ComponentFixture<UserProfileComponent>;
  let component: UserProfileComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [
        {
          provide: UserService,
          useValue: { getUser: () => of({ name: 'Jane' }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('displays user name', () => {
    expect(fixture.nativeElement.textContent).toContain('Jane');
  });
});
```

### 10.3 Svelte Testing Library

```typescript
// Counter.test.ts (Svelte)
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Counter from './Counter.svelte';

describe('Counter', () => {
  it('increments on click', async () => {
    render(Counter, { props: { count: 0 } });

    const button = screen.getByRole('button', { name: 'Increment' });
    await userEvent.click(button);

    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });
});
```

---

## 11. Test Organization Patterns

### 11.1 File Structure

```
  TEST FILE ORGANIZATION

  src/
  ├── components/
  │   ├── UserProfile/
  │   │   ├── UserProfile.tsx
  │   │   ├── UserProfile.test.tsx          ← co-located
  │   │   └── UserProfile.stories.tsx
  │   └── ...
  ├── hooks/
  │   ├── useAuth.ts
  │   └── useAuth.test.ts                   ← co-located
  ├── utils/
  │   ├── formatters.ts
  │   └── formatters.test.ts                ← co-located
  └── test/                                  ← shared test infrastructure
      ├── setup.ts                           ← global setup
      ├── mocks/
      │   ├── handlers.ts                    ← MSW handlers
      │   └── server.ts                      ← MSW server
      ├── factories/                         ← test data factories
      │   ├── user.ts
      │   └── product.ts
      └── helpers/
          ├── render.tsx                     ← custom render with providers
          └── test-utils.ts
```

### 11.2 Custom Render with Providers

```tsx
// src/test/helpers/render.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../contexts/theme';
import { AuthProvider } from '../contexts/auth';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  user?: { id: string; name: string };
}

function createAllProviders(options: CustomRenderOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function AllProviders({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={options.user}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  return render(ui, {
    wrapper: createAllProviders(options),
    ...options,
  });
}

// Re-export everything
export * from '@testing-library/react';
export { renderWithProviders as render };
```

### 11.3 Test Data Factories

```typescript
// src/test/factories/user.ts
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: Date;
}

let nextId = 1;

export function createUser(overrides: Partial<User> = {}): User {
  const id = String(nextId++);
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    role: 'viewer',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createAdmin(overrides: Partial<User> = {}): User {
  return createUser({ role: 'admin', ...overrides });
}

// Usage in tests
const user = createUser({ name: 'Alice', role: 'editor' });
const admin = createAdmin({ name: 'Bob' });
```

### 11.4 AAA Pattern (Arrange-Act-Assert)

```typescript
describe('UserList', () => {
  it('filters users by search term', async () => {
    // ARRANGE — set up the test scenario
    const users = [
      createUser({ name: 'Alice Johnson' }),
      createUser({ name: 'Bob Smith' }),
      createUser({ name: 'Alice Williams' }),
    ];
    server.use(
      http.get('/api/users', () => HttpResponse.json(users))
    );
    render(<UserList />);
    await screen.findByText('Alice Johnson'); // wait for load

    // ACT — perform the action under test
    await userEvent.type(screen.getByRole('searchbox'), 'Alice');

    // ASSERT — verify expected outcome
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Alice Williams')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
  });
});
```

---

## 12. Common Testing Mistakes

### 12.1 The act() Warning Problem

```typescript
// PROBLEM: "An update was not wrapped in act()"
// This happens when state updates after the test ends

// BAD — test ends before async update completes
it('loads data', () => {
  render(<AsyncComponent />);
  // Test ends here, but component is still fetching
});

// GOOD — wait for the async update
it('loads data', async () => {
  render(<AsyncComponent />);
  await screen.findByText('Loaded');          // waits for async render
});

// GOOD — if no visible change, waitFor with assertion
it('loads data', async () => {
  render(<AsyncComponent />);
  await waitFor(() => {
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });
});
```

### 12.2 Testing Implementation Details

```tsx
// BAD — testing internal state
it('sets isOpen to true', () => {
  const { result } = renderHook(() => useModal());
  act(() => result.current.open());
  expect(result.current.isOpen).toBe(true);  // testing internal state
});

// GOOD — testing behavior
it('opens modal on button click', async () => {
  render(<ModalTrigger />);

  await userEvent.click(screen.getByRole('button', { name: 'Open' }));

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
});
```

### 12.3 Over-Mocking

```tsx
// BAD — mocking the component you're testing
vi.mock('./UserProfile', () => ({
  UserProfile: ({ name }: any) => <div>{name}</div>,
}));

// BAD — mocking internal hooks
vi.mock('./useUserData', () => ({
  useUserData: () => ({ data: mockUser, isLoading: false }),
}));

// GOOD — mock at the boundary (network)
server.use(
  http.get('/api/user/1', () => HttpResponse.json(mockUser))
);
render(<UserProfile userId="1" />);
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Testing implementation details** | Tests break on refactor even when behavior is unchanged | Test user-visible behavior: rendered output, events fired, accessibility state |
| **Snapshot abuse** | 500+ line snapshot files nobody reviews; `--updateSnapshot` run blindly | Replace with explicit assertions; use inline snapshots only for small outputs |
| **Over-mocking** | Mocking hooks/child components/internal state — tests pass but bugs escape | Mock at boundaries (network with MSW); let real code run |
| **querySelector in tests** | `container.querySelector('.btn-primary')` — coupled to CSS class names | Use `getByRole('button', { name: 'Submit' })` — user-centric query |
| **Not cleaning up** | Tests pass alone, fail when run together (shared state pollution) | Reset stores, call `cleanup()`, use `beforeEach` for fresh state |
| **Testing Library with act() wrapper** | Wrapping `userEvent.click()` in `act()` — double wrapping | Testing Library methods already call `act()` internally |
| **Ignoring async updates** | "An update was not wrapped in act()" warnings | Use `await findBy`, `await waitFor`, or `await userEvent.click()` |
| **Copy-paste test setup** | 20 lines of identical setup in every test | Create custom render, test factories, and shared fixtures |
| **Testing third-party code** | Writing tests for Material UI button rendering or React Router | Trust library tests; test YOUR integration with the library |
| **Boolean-only assertions** | `expect(result).toBe(true)` — no info on failure | Use specific matchers: `toHaveLength`, `toContain`, `toMatchObject` |
| **Slow test suite** | Unit tests taking > 30 seconds | Use `happy-dom` over `jsdom`, use `pool: 'threads'`, mock heavy imports |
| **No coverage in CI** | Coverage silently drops as features are added | Set thresholds in vitest config; fail CI on regression |

---

## 14. Enforcement Checklist

### Test Framework Setup
- [ ] Vitest configured with `jsdom` or `happy-dom` environment
- [ ] Testing Library installed for the correct framework
- [ ] MSW configured for API mocking (setup file starts/resets/stops server)
- [ ] `@testing-library/jest-dom` matchers registered in setup file
- [ ] `cleanup()` called after each test
- [ ] Coverage thresholds configured (80%+ branches)
- [ ] Coverage report generated in CI and uploaded to Codecov/Coveralls

### Test Quality
- [ ] Every test follows AAA pattern (Arrange-Act-Assert)
- [ ] Queries use Testing Library priority: `getByRole` > `getByLabelText` > `getByText`
- [ ] `getByTestId` used ONLY as last resort with comment explaining why
- [ ] Async code uses `findBy` or `waitFor` — never bare `setTimeout`
- [ ] No `act()` wrapping around Testing Library methods
- [ ] No snapshot tests for full component trees
- [ ] Test names describe behavior, not implementation ("filters users by name" not "sets filteredUsers state")

### Mocking
- [ ] API calls mocked with MSW, not `vi.mock` on fetch/axios
- [ ] Module mocks used ONLY for browser APIs and third-party side effects
- [ ] No mocking of components or hooks under test
- [ ] Mock data created via factories, not inline literals repeated across tests
- [ ] MSW handlers reset between tests (`server.resetHandlers()`)

### CI/CD
- [ ] Tests run on every PR (`vitest run`)
- [ ] Coverage thresholds enforced — PR blocked if coverage drops
- [ ] Test results reported in PR checks (GitHub Actions / GitLab CI)
- [ ] Slow tests identified and optimized (< 30s for unit suite)
- [ ] Flaky test detection enabled (re-run on failure to distinguish flaky from broken)
