# JavaScript/TypeScript: Overview

> **Domain:** Languages > JavaScript/TypeScript
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## History & Evolution

### JavaScript Timeline

| Year | Version | Key Features |
|------|---------|-------------|
| 1995 | Mocha/LiveScript | Created by Brendan Eich at Netscape in 10 days |
| 1997 | ES1 | First ECMAScript standard |
| 1999 | ES3 | Regular expressions, try/catch, better string handling |
| 2009 | ES5 | strict mode, JSON, Array methods (forEach, map, filter, reduce) |
| 2015 | ES6/ES2015 | Classes, arrow functions, let/const, Promises, modules, template literals, destructuring, generators, Symbol, Map/Set, Proxy |
| 2016 | ES2016 | Array.includes, exponentiation operator (**) |
| 2017 | ES2017 | async/await, Object.entries/values, SharedArrayBuffer, Atomics |
| 2018 | ES2018 | Rest/Spread properties, async iterators, Promise.finally |
| 2019 | ES2019 | Array.flat/flatMap, Object.fromEntries, optional catch binding |
| 2020 | ES2020 | Optional chaining (?.), nullish coalescing (??), BigInt, Promise.allSettled, globalThis |
| 2021 | ES2021 | String.replaceAll, Promise.any, logical assignment (&&=, ||=, ??=), WeakRef |
| 2022 | ES2022 | Top-level await, .at(), Object.hasOwn, Error.cause, class fields (public/private) |
| 2023 | ES2023 | Array findLast/findLastIndex, Hashbang, Symbols as WeakMap keys, change Array by copy |
| 2024 | ES2024 | Object.groupBy, Promise.withResolvers, Atomics.waitAsync, well-formed Unicode strings |
| 2025 | ES2025 | Iterator helpers, Set methods, RegExp modifiers, Import attributes |

### TypeScript Timeline

| Year | Version | Key Features |
|------|---------|-------------|
| 2012 | TS 0.8 | Anders Hejlsberg announces TypeScript at Microsoft |
| 2014 | TS 1.0 | First stable release |
| 2016 | TS 2.0 | Non-nullable types, control flow analysis, tagged unions |
| 2017 | TS 2.1-2.6 | keyof, mapped types, conditional types, object rest/spread |
| 2018 | TS 3.0 | Project references, unknown type, tuple improvements |
| 2020 | TS 4.0 | Variadic tuple types, labeled tuples, short-circuit assignment |
| 2021 | TS 4.5 | Awaited type, type-only imports, tail-call elimination for conditional types |
| 2022 | TS 4.7-4.9 | ESM support, satisfies operator, accessor keyword |
| 2023 | TS 5.0-5.3 | Decorators (stage 3), const type parameters, bundler module resolution |
| 2024 | TS 5.4-5.6 | NoInfer utility, isolated declarations, --erasableSyntaxOnly |
| 2025 | TS 5.7+ | Native TypeScript execution (--experimental-strip-types in Node.js), Deno/Bun native TS |

## Design Philosophy

JavaScript was designed as a **multi-paradigm** language combining:

1. **Functional programming**: first-class functions, closures, higher-order functions
2. **Prototype-based OOP**: prototype chain, `Object.create`, ES6 classes (syntactic sugar)
3. **Event-driven**: callback model, event loop, asynchronous by nature
4. **Dynamic typing**: duck typing, type coercion, runtime flexibility

TypeScript adds:
- **Structural type system**: compatibility based on shape, not declaration
- **Gradual typing**: mix typed and untyped code, `any` as escape hatch
- **Type inference**: minimal annotations needed with maximal type safety
- **Design-time safety**: all types erased at runtime (zero runtime cost)

### The Zen of JavaScript/TypeScript
```
Flexibility over rigidity
Convention over configuration
Ecosystem over stdlib
Async by default
Ship fast, iterate faster
```

## Runtime Model

### Event Loop Architecture

```
   ┌───────────────────────────────┐
   │         Call Stack             │
   │  (Single-threaded execution)  │
   └──────────────┬────────────────┘
                  │
   ┌──────────────▼────────────────┐
   │         Event Loop             │
   │                                │
   │  1. Microtasks (Promise.then,  │
   │     queueMicrotask, MutO)     │
   │  2. Macrotasks (setTimeout,    │
   │     setInterval, I/O, UI)     │
   │  3. requestAnimationFrame     │
   │  4. requestIdleCallback       │
   └──────────────┬────────────────┘
                  │
   ┌──────────────▼────────────────┐
   │      Task Queues               │
   │  ┌─────────┐ ┌──────────────┐ │
   │  │ Micro Q │ │   Macro Q    │ │
   │  └─────────┘ └──────────────┘ │
   └────────────────────────────────┘
```

**Key rule**: Microtasks always drain completely before the next macrotask.

```javascript
console.log('1');                    // Sync
setTimeout(() => console.log('2')); // Macrotask
Promise.resolve().then(() => console.log('3')); // Microtask
queueMicrotask(() => console.log('4'));         // Microtask
console.log('5');                    // Sync
// Output: 1, 5, 3, 4, 2
```

### JavaScript Engines

| Engine | Browser/Runtime | Compiler Pipeline | Key Innovation |
|--------|----------------|-------------------|----------------|
| **V8** | Chrome, Node.js, Deno, Bun | Ignition (interpreter) → Sparkplug (baseline) → Maglev (mid-tier) → TurboFan (optimizing) | Hidden classes, inline caching, speculative optimization |
| **SpiderMonkey** | Firefox | Warp (baseline) → Ion (optimizing) | First JS engine, tracing JIT pioneer |
| **JavaScriptCore** (Nitro) | Safari, Bun | LLInt → Baseline → DFG → FTL (B3/Air) | 4-tier compilation, WebKit integration |
| **Hermes** | React Native | Bytecode-first, AOT compilation | Optimized for mobile: fast startup, low memory |
| **QuickJS** | Embedded | Interpreter only | Tiny footprint (~210 KB), full ES2023, used in embedded/WASM |

### V8 Optimization Pipeline (Detail)

```
Source Code
    │
    ▼
  Parser (PEG) → AST
    │
    ▼
  Ignition (Bytecode Interpreter)
    │ collects type feedback (ICs)
    ▼
  Sparkplug (Non-optimizing Baseline Compiler)
    │ fast compilation, modest speedup
    ▼
  Maglev (Mid-tier Optimizing Compiler)
    │ graph-based, SSA, speculative optimizations
    ▼
  TurboFan (Top-tier Optimizing Compiler)
    │ sea-of-nodes, aggressive inlining, escape analysis
    ▼
  Machine Code
```

**Deoptimization**: When type assumptions are violated, V8 "deoptimizes" back to Ignition and recompiles with new type information. This is why monomorphic (single-type) function calls are faster than polymorphic ones.

## Module Systems

### CommonJS vs ESM Comparison

| Feature | CommonJS (CJS) | ES Modules (ESM) |
|---------|---------------|-------------------|
| Syntax | `require()` / `module.exports` | `import` / `export` |
| Loading | Synchronous | Asynchronous |
| Evaluation | Eager (on require) | Lazy (on import) |
| Tree-shaking | Not possible | Possible (static analysis) |
| Top-level await | Not supported | Supported |
| File extension | `.js` or `.cjs` | `.mjs` or `.js` (with `"type": "module"`) |
| Browser support | Requires bundler | Native (via `<script type="module">`) |
| Circular deps | Partial exports at time of require | Live bindings (always current) |
| Default in Node | Yes (legacy) | Preferred (modern) |
| `this` at top level | `module.exports` | `undefined` |

### Bundlers Comparison

| Bundler | Language | Speed | HMR | Tree-shaking | Code Splitting | Config |
|---------|----------|-------|-----|-------------|----------------|--------|
| **Vite** | Go (esbuild) + Rust (Rolldown) | Very Fast | Excellent | Yes | Yes | Minimal |
| **webpack** | JavaScript | Slow | Good | Yes | Yes | Complex |
| **esbuild** | Go | Fastest | Basic | Yes | Yes | Minimal |
| **Rollup** | JavaScript | Medium | Plugin | Best | Yes | Medium |
| **Turbopack** | Rust | Very Fast | Excellent | Yes | Yes | Next.js only |
| **Parcel** | Rust | Fast | Excellent | Yes | Yes | Zero config |
| **tsup** | Go (esbuild) | Very Fast | N/A | Yes | Yes | Minimal (library) |
| **SWC** | Rust | Very Fast | N/A | Yes | N/A | Minimal (transpiler) |

## TypeScript Type System Deep Dive

### Structural Typing

```typescript
// TypeScript uses STRUCTURAL typing, not nominal
interface Point {
  x: number;
  y: number;
}

function printPoint(p: Point) {
  console.log(`(${p.x}, ${p.y})`);
}

// This works — no `implements Point` needed
const obj = { x: 10, y: 20, z: 30 };
printPoint(obj); // OK: has x and y
```

### Key Type System Features

```typescript
// 1. Discriminated Unions (Tagged Unions)
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rectangle'; width: number; height: number }
  | { kind: 'triangle'; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2;
    case 'rectangle': return shape.width * shape.height;
    case 'triangle': return 0.5 * shape.base * shape.height;
  }
}

// 2. Template Literal Types
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type APIRoute = `/api/${string}`;
type Endpoint = `${HTTPMethod} ${APIRoute}`;
// "GET /api/users" ✓   "PATCH /api/users" ✗

// 3. Conditional Types
type IsString<T> = T extends string ? true : false;
type A = IsString<string>;  // true
type B = IsString<number>;  // false

// 4. Mapped Types
type Readonly<T> = { readonly [K in keyof T]: T[K] };
type Partial<T> = { [K in keyof T]?: T[K] };
type Record<K extends string, V> = { [P in K]: V };

// 5. Infer keyword
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type UnpackPromise<T> = T extends Promise<infer U> ? U : T;

// 6. Satisfies operator (TS 4.9+)
const palette = {
  red: [255, 0, 0],
  green: '#00ff00',
} satisfies Record<string, string | number[]>;
// palette.red is number[] (not string | number[])
// palette.green is string (not string | number[])

// 7. Branded Types (nominal-like typing)
type USD = number & { __brand: 'USD' };
type EUR = number & { __brand: 'EUR' };
function addUSD(a: USD, b: USD): USD {
  return (a + b) as USD;
}
const price = 10 as USD;
const euros = 10 as EUR;
addUSD(price, price); // OK
// addUSD(price, euros); // Error!

// 8. Const assertions
const routes = ['/', '/about', '/contact'] as const;
type Route = typeof routes[number]; // '/' | '/about' | '/contact'
```

## Runtimes Comparison

| Feature | Node.js | Deno | Bun |
|---------|---------|------|-----|
| **Created by** | Ryan Dahl (2009) | Ryan Dahl (2018) | Jarred Sumner (2022) |
| **Engine** | V8 | V8 | JavaScriptCore |
| **Language** | C++ | Rust | Zig + C++ |
| **Package manager** | npm/yarn/pnpm | deno add (JSR+npm) | bun install |
| **TypeScript** | Via tsx/ts-node, native --strip-types (v22+) | Native | Native |
| **Module system** | CJS + ESM | ESM only | CJS + ESM |
| **Security** | Full access by default | Permission-based (--allow-read, etc.) | Full access by default |
| **Built-in test runner** | node --test (v18+) | deno test | bun test |
| **Built-in linter** | No (ESLint) | deno lint | No |
| **Built-in formatter** | No (Prettier) | deno fmt | No |
| **JSX** | Via bundler | Native | Native |
| **HTTP server speed** | ~50K req/s | ~80K req/s | ~150K req/s |
| **Install speed** | npm: ~30s, pnpm: ~10s | ~5s | ~2s |
| **Startup time** | ~30ms | ~25ms | ~7ms |
| **Web APIs** | Partial (fetch v18+) | Full (Web standard) | Full |
| **npm compatibility** | 100% | ~95% (via npm: specifiers) | ~98% |
| **Windows support** | Excellent | Good | Improving |
| **Production readiness** | Battle-tested | Maturing | Early production |
| **Funding** | OpenJS Foundation | Deno Inc. | Oven Inc. |

## Key Language Features Table

| Feature | JS (ES2025) | TypeScript 5.7+ |
|---------|------------|-----------------|
| Static typing | No | Yes (structural) |
| Type inference | N/A | Yes (bidirectional) |
| Generics | N/A | Yes (with constraints) |
| Enums | No | Yes (numeric + string) |
| Interfaces | No | Yes |
| Decorators | Stage 3 / ES2025 | Yes (experimental + TC39) |
| Pattern matching | Proposal (Stage 1) | Narrowing via control flow |
| Null safety | No (optional chaining ?.) | strict null checks |
| Module system | ESM native | ESM + CJS |
| Async/Await | Yes (ES2017) | Yes |
| Generators | Yes (ES2015) | Yes |
| Proxy/Reflect | Yes (ES2015) | Yes (typed) |
| Private fields | Yes (#field, ES2022) | Yes (private keyword + #field) |
| Top-level await | Yes (ES2022) | Yes |
| using/Symbol.dispose | ES2025 (Explicit Resource Mgmt) | Yes (TS 5.2+) |

## Compilation & Transpilation

### TypeScript Compilation Modes

```
TypeScript Source (.ts/.tsx)
         │
    ┌────┴────────────────────────────┐
    │                                  │
    ▼                                  ▼
  tsc (TypeScript Compiler)     Modern Transpilers
    │                              │
    ├── Type checking ✓            ├── SWC (Rust) — fastest
    ├── .js output                 ├── esbuild (Go) — very fast
    ├── .d.ts declarations         ├── Babel — most plugins
    └── Source maps                └── Type stripping only (no checking)
                                        │
                                   Use tsc --noEmit for type checking
                                   + SWC/esbuild for transpilation
```

### tsconfig.json Key Options

```jsonc
{
  "compilerOptions": {
    // Strictness (always enable all)
    "strict": true,                    // Enables all strict checks
    "noUncheckedIndexedAccess": true,  // T | undefined for index access
    "exactOptionalPropertyTypes": true, // Distinguishes missing vs undefined

    // Module resolution
    "module": "ESNext",                // or "NodeNext" for Node.js
    "moduleResolution": "bundler",     // or "nodenext"
    "verbatimModuleSyntax": true,      // Enforce import type

    // Output
    "target": "ES2022",               // Minimum target
    "lib": ["ES2023", "DOM"],          // Available APIs
    "outDir": "./dist",
    "declaration": true,               // Generate .d.ts
    "sourceMap": true,

    // Project references
    "composite": true,                 // For monorepos
    "incremental": true,               // Faster rebuilds
    "isolatedDeclarations": true,      // TS 5.5+ for faster .d.ts
  }
}
```

## Sources

- [MDN Web Docs](https://developer.mozilla.org) — Definitive JavaScript reference
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) — Official TypeScript guide
- [TC39 Proposals](https://github.com/tc39/proposals) — ECMAScript feature pipeline
- [V8 Blog](https://v8.dev/blog) — Engine internals and optimizations
- [Node.js Docs](https://nodejs.org/docs/) — Runtime documentation
- [Deno Manual](https://deno.land/manual) — Deno runtime guide
- [Bun Docs](https://bun.sh/docs) — Bun runtime documentation
- [State of JS Survey](https://stateofjs.com) — Annual ecosystem survey
- [Can I Use](https://caniuse.com) — Browser compatibility tables
