# JavaScript/TypeScript: Best Practices

> **Domain:** Languages > JavaScript/TypeScript
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## TypeScript Strict Mode Configuration

Always enable maximum strictness. Every option below catches real bugs:

```jsonc
{
  "compilerOptions": {
    "strict": true,                    // Enables all 7 strict flags below:
    // "strictNullChecks": true,       //   null/undefined are distinct types
    // "strictFunctionTypes": true,    //   Contravariant parameter checking
    // "strictBindCallApply": true,    //   Type-check bind, call, apply
    // "strictPropertyInitialization": true, // Class properties must be initialized
    // "noImplicitAny": true,          //   No implicit any types
    // "noImplicitThis": true,         //   No implicit any for this
    // "alwaysStrict": true,           //   Emit "use strict"

    // Additional strictness (NOT included in "strict")
    "noUncheckedIndexedAccess": true,  // arr[0] is T | undefined
    "exactOptionalPropertyTypes": true, // { x?: string } ≠ { x: string | undefined }
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,        // Require override keyword
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,      // Enforce import type { X }
    "isolatedDeclarations": true,      // TS 5.5+ faster .d.ts generation
  }
}
```

## Type Safety Patterns

### 1. Branded Types (Nominal Typing in a Structural System)

```typescript
// Problem: IDs of different entities are all strings
declare function getUser(id: string): User;
declare function getOrder(id: string): Order;
const orderId = getOrderId();
getUser(orderId); // No error! But wrong!

// Solution: Branded types
type UserId = string & { readonly __brand: unique symbol };
type OrderId = string & { readonly __brand: unique symbol };

function UserId(id: string): UserId { return id as UserId; }
function OrderId(id: string): OrderId { return id as OrderId; }

declare function getUser(id: UserId): User;
declare function getOrder(id: OrderId): Order;

const orderId = OrderId('ord_123');
// getUser(orderId); // Error! Type 'OrderId' is not assignable to 'UserId'
getUser(UserId('usr_456')); // OK
```

### 2. Const Assertions & Literal Types

```typescript
// Without const: type is string[]
const methods = ['GET', 'POST', 'PUT'];
type Method = typeof methods[number]; // string (too wide!)

// With const: type is readonly tuple of literals
const methods = ['GET', 'POST', 'PUT'] as const;
type Method = typeof methods[number]; // 'GET' | 'POST' | 'PUT'

// Object const assertion
const config = {
  api: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
} as const;
// config.api is 'https://api.example.com' (not string)
// config.timeout is 5000 (not number)
```

### 3. Exhaustive Pattern Matching with never

```typescript
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'triangle'; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
    case 'triangle':
      return 0.5 * shape.base * shape.height;
    default: {
      const _exhaustive: never = shape;
      throw new Error(`Unhandled shape: ${_exhaustive}`);
    }
  }
}
```

### 4. Template Literal Types for Type-Safe APIs

```typescript
type EventName = 'click' | 'focus' | 'blur';
type EventHandler = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'

type CSSUnit = 'px' | 'rem' | 'em' | '%' | 'vh' | 'vw';
type CSSValue = `${number}${CSSUnit}`;
const width: CSSValue = '100px'; // OK

// Type-safe route params
type Routes = '/users' | '/users/:id' | '/posts/:postId/comments/:commentId';
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type CommentParams = ExtractParams<'/posts/:postId/comments/:commentId'>;
// 'postId' | 'commentId'
```

### 5. Satisfies Operator (TS 4.9+)

```typescript
type Color = { r: number; g: number; b: number } | string;
type Theme = Record<string, Color>;

// With satisfies: validates AND preserves narrow types
const theme = {
  primary: { r: 0, g: 100, b: 255 },
  secondary: '#ff6600',
} satisfies Theme;

theme.primary.r;              // OK! Type is { r: number; g: number; b: number }
theme.secondary.toUpperCase(); // OK! Type is string
```

## Error Handling Patterns

### Result Pattern (Rust-inspired)

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function fetchUser(id: string): Promise<Result<User, 'NOT_FOUND' | 'NETWORK_ERROR'>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (response.status === 404) return { success: false, error: 'NOT_FOUND' };
    const data = await response.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR' };
  }
}

const result = await fetchUser('123');
if (result.success) {
  console.log(result.data.name); // Type-narrowed to User
} else {
  console.error(result.error);   // Type-narrowed to 'NOT_FOUND' | 'NETWORK_ERROR'
}
```

### Typed Error Classes

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class ValidationError extends AppError {
  constructor(public readonly fields: Record<string, string[]>) {
    super('Validation failed', 'VALIDATION_ERROR', 400);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, 'NOT_FOUND', 404);
  }
}
```

## Async Patterns

### Promise Combinators

```typescript
// Promise.all — fail-fast on FIRST rejection
const [users, posts] = await Promise.all([fetchUsers(), fetchPosts()]);

// Promise.allSettled — never rejects, returns each status
const results = await Promise.allSettled([fetchUsers(), fetchPosts()]);
const succeeded = results.filter(r => r.status === 'fulfilled');

// Promise.race — first settled wins
const data = await Promise.race([fetchData(), timeout(5000)]);

// Promise.any — first fulfilled wins (ignores rejections)
const fastest = await Promise.any([cdn1(), cdn2(), cdn3()]);
```

### AbortController for Cancellation

```typescript
async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// React: Cancel on unmount
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/users/${id}`, { signal: controller.signal })
    .then(r => r.json())
    .then(setUser)
    .catch(e => { if (e.name !== 'AbortError') throw e; });
  return () => controller.abort();
}, [id]);
```

### Async Iterators for Streaming

```typescript
async function* streamEvents(url: string): AsyncGenerator<ServerEvent> {
  const response = await fetch(url);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith('data: ')) yield JSON.parse(line.slice(6));
    }
  }
}

for await (const event of streamEvents('/api/stream')) {
  console.log(event);
}
```

## Immutability Patterns

```typescript
// 1. readonly keyword and DeepReadonly
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// 2. structuredClone for deep copy (ES2022)
const cloned = structuredClone(original);

// 3. using keyword (Explicit Resource Management, TS 5.2+)
async function processFile(path: string) {
  using handle = await openFile(path);
  const content = await handle.read();
  return content;
} // handle[Symbol.dispose]() called automatically
```

## Project Structure (Feature-Based)

```
src/
├── features/
│   ├── auth/
│   │   ├── components/LoginForm.tsx
│   │   ├── hooks/useAuth.ts
│   │   ├── api/auth.api.ts
│   │   ├── types/auth.types.ts
│   │   └── index.ts          # Public API only
│   └── users/
├── shared/
│   ├── components/           # Reusable UI
│   ├── hooks/                # Shared hooks
│   ├── utils/                # Pure utilities
│   └── lib/                  # Third-party wrappers
├── app/                      # Shell, routing, providers
└── main.tsx
```

## Security Best Practices

```typescript
// 1. Validate at boundaries with Zod
const UserInput = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  age: z.number().int().min(0).max(150),
});

// 2. XSS prevention — never dangerouslySetInnerHTML with user data
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userHTML);

// 3. SQL injection — always parameterized queries
db.query('SELECT * FROM users WHERE id = $1', [id]);

// 4. Prototype pollution — use Object.create(null) or Map
const safeObj = Object.create(null);
```

## Testing Best Practices

```typescript
// Arrange-Act-Assert pattern with Vitest
test('creates user with hashed password', async () => {
  // Arrange
  const service = new UserService({ hash: mockHash, db: mockDb });
  // Act
  const user = await service.create({ email: 'a@b.com', password: 'pass' });
  // Assert
  expect(user.password).not.toBe('pass');
});

// Testing Library: test behavior, not implementation
test('submits form', async () => {
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com' });
});

// MSW for API mocking
const server = setupServer(
  http.get('/api/users/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, name: 'John' })
  ),
);
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| `any` type | Disables type checking | `unknown` + type guard |
| `@ts-ignore` | Suppresses all errors | `@ts-expect-error` (fails if error resolves) |
| `as` type assertions | Runtime type mismatch | Type guards, satisfies, generics |
| Nested ternaries | Unreadable | Early returns, switch, or function extraction |
| `enum` (numeric) | Tree-shaking issues | `as const` objects or union types |
| `export default` | Renaming confusion, refactoring difficulty | Named exports |
| `index.ts` re-exporting everything | Bundle bloat | Selective barrel exports |
| Mutable global state | Race conditions, testing difficulty | Module-scoped singletons, DI |
| `console.log` debugging | No structure, noise | Structured logging (pino, winston) |
| `.then()` chains | Callback-like nesting | async/await |

## Sources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Total TypeScript](https://totaltypescript.com) — Matt Pocock
- [Type Challenges](https://github.com/type-challenges/type-challenges)
- [Testing Library Docs](https://testing-library.com/docs/)
- [Zod](https://zod.dev) — Schema validation
- [JavaScript Info](https://javascript.info)
