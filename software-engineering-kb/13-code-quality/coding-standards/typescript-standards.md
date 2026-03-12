# TypeScript Coding Standards

| Property     | Value                                                                |
|-------------|----------------------------------------------------------------------|
| Domain      | Code Quality > Standards                                             |
| Importance  | Critical                                                             |
| Languages   | TypeScript 5.x                                                       |
| Cross-ref   | [ESLint](../linting-formatting/eslint.md), [Type Checking](../static-analysis/type-checking.md) |

---

## Core Concepts

### Strict Mode Configuration

Enable ALL strict flags. Never ship production code without full strictness.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,                    // Enables ALL below
    "noUncheckedIndexedAccess": true,  // arr[0] is T | undefined
    "exactOptionalPropertyTypes": true,// undefined !== optional
    "noImplicitOverride": true,        // Require override keyword
    "noPropertyAccessFromIndexSignature": true, // Force bracket notation
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true       // TS 5.x: enforce type imports
  }
}
```

### Type Inference vs Explicit Types

```typescript
// ❌ BAD: Redundant annotations — TypeScript already infers these
const name: string = "Alice";
const count: number = items.length;
const doubled: number[] = nums.map((n: number): number => n * 2);

// ✅ GOOD: Let inference work; annotate only at boundaries
const name = "Alice";
const count = items.length;
const doubled = nums.map(n => n * 2);
```

**Annotate at boundaries — infer everything else:**

```typescript
// ✅ GOOD: Annotate function signatures (public API contract)
function parseUser(raw: unknown): User { /* ... */ }

// ✅ GOOD: Annotate when inference is wrong or unclear
const id: string | number = getIdFromExternalApi();
const ref = useRef<HTMLDivElement>(null);
const map = new Map<string, User>();
```

### Utility Types Mastery

```typescript
// ❌ BAD: Manually redefining subsets of types
interface UserUpdate {
  name?: string;
  email?: string;
}

// ✅ GOOD: Derive types with utility types
type UserUpdate = Partial<Pick<User, "name" | "email">>;
type UserCreate = Required<Omit<User, "id" | "createdAt">>;
type UserLookup = Record<string, User>;

// Advanced composition
type ExtractString<T> = Extract<T, string>;  // Filter union to string members
type NonNullUser = Required<{ [K in keyof User]: NonNullable<User[K]> }>;
type FnReturn = Awaited<ReturnType<typeof fetchUser>>; // Unwrap async return
type FnParams = Parameters<typeof createUser>;         // Tuple of params
```

### Discriminated Unions for State Modeling

```typescript
// ❌ BAD: Boolean flags create impossible states
interface RequestState {
  isLoading: boolean;
  isError: boolean;
  data?: User;
  error?: Error;  // isLoading: true + data: User = impossible but allowed
}

// ✅ GOOD: Discriminated union — each state is explicit
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User }
  | { status: "error"; error: Error };

function render(state: RequestState) {
  switch (state.status) {
    case "idle":    return <Placeholder />;
    case "loading": return <Spinner />;
    case "success": return <Profile user={state.data} />;  // data is narrowed
    case "error":   return <ErrorMsg error={state.error} />;
  }
}
```

### Branded / Nominal Types

```typescript
// ❌ BAD: All IDs are interchangeable strings
function getUser(id: string): User { /* ... */ }
getUser(orderId); // Compiles — type system cannot catch this

// ✅ GOOD: Brand types to prevent misuse
type UserId = string & { readonly __brand: unique symbol };
type OrderId = string & { readonly __brand: unique symbol };

function userId(id: string): UserId { return id as UserId; }
function getUser(id: UserId): User { /* ... */ }

getUser(userId("usr_123")); // OK
getUser(orderId("ord_456")); // TS Error: OrderId is not assignable to UserId
```

### `const` Assertions and `satisfies`

```typescript
// ❌ BAD: Type is widened to string[]
const ROLES = ["admin", "editor", "viewer"]; // string[]

// ✅ GOOD: Narrow to literal tuple
const ROLES = ["admin", "editor", "viewer"] as const; // readonly ["admin", "editor", "viewer"]
type Role = (typeof ROLES)[number]; // "admin" | "editor" | "viewer"

// ❌ BAD: Type annotation loses literal info
const CONFIG: Record<string, string> = { api: "/v1", timeout: "3000" };
CONFIG.api; // string — literal lost

// ✅ GOOD: satisfies validates AND preserves literals
const CONFIG = {
  api: "/v1",
  timeout: "3000",
} satisfies Record<string, string>;
CONFIG.api; // "/v1" — literal preserved, validated against Record
```

### Generic Constraints and Conditional Types

```typescript
// ❌ BAD: Unconstrained generic — anything goes
function getProperty<T>(obj: T, key: string) { return (obj as any)[key]; }

// ✅ GOOD: Constrained generic — type-safe property access
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Conditional types for API flexibility
type ApiResponse<T> = T extends Array<infer U>
  ? { items: U[]; total: number }
  : { data: T };

// Const type parameters (TS 5.0+)
function createConfig<const T extends readonly string[]>(routes: T): T {
  return routes; // Preserves literal tuple type without as const at call site
}
```

### Function Overloads vs Union Parameters

```typescript
// ❌ BAD: Union parameter with unclear return type
function parse(input: string | Buffer): string | Uint8Array { /* ... */ }

// ✅ GOOD: Overloads when return type depends on input type
function parse(input: string): string;
function parse(input: Buffer): Uint8Array;
function parse(input: string | Buffer): string | Uint8Array {
  return typeof input === "string" ? input.trim() : new Uint8Array(input);
}

// ✅ ALSO GOOD: Generic conditional (simpler for 2 cases)
function parse<T extends string | Buffer>(
  input: T
): T extends string ? string : Uint8Array;
```

### Readonly and Immutability Patterns

```typescript
// ❌ BAD: Mutable parameters invite bugs
function processUsers(users: User[]) {
  users.sort((a, b) => a.name.localeCompare(b.name)); // Mutates input!
}

// ✅ GOOD: Readonly parameters enforce immutability
function processUsers(users: readonly User[]) {
  const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

// Deep readonly for complex structures
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

### The `never` Type for Exhaustive Checks

```typescript
// ✅ GOOD: Exhaustive switch with never
function handleEvent(event: AppEvent): void {
  switch (event.type) {
    case "click":   return handleClick(event);
    case "keydown": return handleKeydown(event);
    default: {
      const _exhaustive: never = event; // TS Error if a case is missing
      throw new Error(`Unhandled event: ${(event as any).type}`);
    }
  }
}

// Helper function pattern
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}
```

### Error Handling — Result Pattern

```typescript
// ❌ BAD: Throwing exceptions for expected failures
function parseConfig(raw: string): Config {
  const parsed = JSON.parse(raw); // Throws on invalid JSON
  if (!parsed.port) throw new Error("Missing port");
  return parsed as Config;
}

// ✅ GOOD: Result type for recoverable errors
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function parseConfig(raw: string): Result<Config, "invalid_json" | "missing_field"> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    return { ok: false, error: "invalid_json" };
  }
  if (!isConfig(parsed)) return { ok: false, error: "missing_field" };
  return { ok: true, value: parsed };
}

// Caller is forced to handle both cases
const result = parseConfig(input);
if (!result.ok) return handleError(result.error);
console.log(result.value.port); // Narrowed to Config
```

### Async Patterns

```typescript
// ❌ BAD: Sequential awaits when operations are independent
const user = await fetchUser(id);
const orders = await fetchOrders(id);
const prefs = await fetchPreferences(id);

// ✅ GOOD: Parallel execution with Promise.all
const [user, orders, prefs] = await Promise.all([
  fetchUser(id),
  fetchOrders(id),
  fetchPreferences(id),
]);

// ✅ GOOD: Use allSettled when partial failure is acceptable
const results = await Promise.allSettled([
  sendEmail(user),
  sendSms(user),
  sendPush(user),
]);
const failures = results.filter(r => r.status === "rejected");

// ✅ GOOD: AbortController for cancellation
async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  using controller = new AbortController(); // TS 5.2+ using declaration
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Barrel Exports — When to Use, When to Avoid

```typescript
// ❌ BAD: Barrel re-exports everything — hurts tree-shaking
// src/utils/index.ts
export * from "./string";
export * from "./date";
export * from "./crypto"; // Heavy module pulled into every consumer

// ✅ GOOD: Named exports only for public API surface
// src/utils/index.ts
export { capitalize, slugify } from "./string";
export { formatDate, parseISO } from "./date";
// crypto intentionally NOT re-exported — import directly

// ✅ Rule: Use barrels for library public API. Avoid for internal app modules.
```

### Import Organization

```typescript
// ✅ GOOD: Consistent import order (enforced by eslint-plugin-import)
// 1. Node built-ins
import { readFile } from "node:fs/promises";
// 2. External packages
import express from "express";
// 3. Internal aliases
import { db } from "@/lib/database";
// 4. Relative imports
import { UserService } from "./user.service";
// 5. Type-only imports (TS 5.x verbatimModuleSyntax)
import type { User } from "@/types";
```

### Modern TS 5.x Features

```typescript
// Decorators (Stage 3 — TS 5.0+)
function log(target: any, context: ClassMethodDecoratorContext) {
  return function (...args: any[]) {
    console.log(`${String(context.name)} called`);
    return target.apply(this, args);
  };
}
class Service {
  @log greet(name: string) { return `Hello ${name}`; }
}

// using / Symbol.dispose (TS 5.2+) — deterministic cleanup
class TempFile implements Disposable {
  path: string;
  constructor() { this.path = createTempFile(); }
  [Symbol.dispose]() { unlinkSync(this.path); }
}
function processFile() {
  using file = new TempFile(); // Automatically cleaned up at block exit
  writeSync(file.path, data);
} // file[Symbol.dispose]() called here

// Const type parameters (TS 5.0+)
declare function routes<const T extends readonly string[]>(paths: T): T;
const r = routes(["/api", "/health"]); // readonly ["/api", "/health"]
```

---

## Best Practices

| #  | Practice                                                                 |
|----|--------------------------------------------------------------------------|
| 1  | Enable `strict: true` plus `noUncheckedIndexedAccess` in every project   |
| 2  | Annotate function signatures; let TypeScript infer local variables       |
| 3  | Model state as discriminated unions, never boolean flag combinations     |
| 4  | Use `satisfies` to validate config objects while preserving literal types|
| 5  | Prefer `readonly` arrays/tuples for function parameters                  |
| 6  | Use `Result<T, E>` for expected failures; reserve `throw` for panics    |
| 7  | Parallelize independent awaits with `Promise.all`                        |
| 8  | Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`) |
| 9  | Add exhaustive `never` checks in every switch on union types             |
| 10 | Use branded types for domain identifiers (UserId, OrderId, Email)        |

---

## Anti-Patterns

| #  | Anti-Pattern                  | Problem                                          | Fix                                        |
|----|-------------------------------|--------------------------------------------------|--------------------------------------------|
| 1  | `any` type everywhere         | Defeats the type system entirely                 | Use `unknown` + type narrowing             |
| 2  | Non-null assertion `!`        | Runtime crash when assumption is wrong           | Use optional chaining + nullish coalescing |
| 3  | `as` type assertions          | Silences compiler without runtime safety         | Use type guards or `satisfies`             |
| 4  | `enum` (numeric)              | Unsafe: any number assignable, reverse mapping bloat | Use `as const` objects or string unions |
| 5  | `export default`              | Inconsistent import names, harder refactoring    | Use named exports                          |
| 6  | Nested ternaries for state    | Unreadable, error-prone                          | Use discriminated union + switch           |
| 7  | `Promise` constructor inside `async` | Unnecessary wrapping — already returns Promise | Return value directly from async fn     |
| 8  | Giant barrel `index.ts`       | Kills tree-shaking, circular dep risk            | Export only public API surface             |

---

## Enforcement Checklist

- [ ] `tsconfig.json` has `strict: true` + `noUncheckedIndexedAccess`
- [ ] ESLint `@typescript-eslint` plugin enabled with strict preset
- [ ] `no-explicit-any` rule set to error
- [ ] `consistent-type-imports` rule enforced
- [ ] CI blocks on any type error (`tsc --noEmit` in pipeline)
- [ ] `no-non-null-assertion` rule set to error (or warn with reviewed exceptions)
- [ ] All discriminated unions have exhaustive `never` default case
- [ ] Branded types used for all cross-boundary identifiers
- [ ] `verbatimModuleSyntax` enabled for proper `import type` enforcement
- [ ] Utility types used instead of manual interface duplication
