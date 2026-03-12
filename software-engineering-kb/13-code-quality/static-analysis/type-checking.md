# Type Checking as Quality Enforcement

| Attribute       | Value                                                                                          |
|-----------------|------------------------------------------------------------------------------------------------|
| **Domain**      | Code Quality > Static Analysis                                                                 |
| **Importance**  | Critical                                                                                       |
| **Audience**    | All Engineers                                                                                  |
| **Last Updated**| 2026-03                                                                                        |
| **Cross-ref**   | [TypeScript Standards](../coding-standards/typescript-standards.md), [SonarQube](sonarqube.md) |

---

## Core Concepts

### Why Type Systems Enforce Quality

Type checkers catch entire categories of bugs at compile time rather than at runtime:

| Bug Category              | Runtime Cost         | Type Checker Catches It? |
|---------------------------|----------------------|--------------------------|
| Null/undefined access     | Production crash     | Yes (strictNullChecks)   |
| Wrong argument types      | Silent data corruption| Yes                     |
| Missing property access   | `undefined` propagation| Yes (noUncheckedIndexedAccess) |
| Incorrect return types    | Downstream failures  | Yes                      |
| API contract violations   | Integration bugs     | Yes (interface enforcement)|

Every type annotation is a machine-verified assertion about code behavior. Invest in types to reduce testing burden.

### TypeScript Strict Mode Deep-Dive

**Progressive strictness from lenient to strict:**

```jsonc
// Level 1: Minimal (legacy projects starting migration)
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": true
  }
}
```

```jsonc
// Level 2: Moderate (active projects)
{
  "compilerOptions": {
    "strict": true
    // strict enables: strictNullChecks, strictFunctionTypes,
    // strictBindCallApply, strictPropertyInitialization,
    // noImplicitAny, noImplicitThis, alwaysStrict
  }
}
```

```jsonc
// Level 3: Maximum safety (new projects, recommended)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Key strict flags explained:**

| Flag                            | What It Catches                                   | Impact    |
|---------------------------------|---------------------------------------------------|-----------|
| `strictNullChecks`              | `null`/`undefined` not assignable to other types  | Critical  |
| `strictFunctionTypes`           | Contravariant parameter checking                  | High      |
| `noUncheckedIndexedAccess`      | Array/object index access returns `T \| undefined`| High      |
| `exactOptionalPropertyTypes`    | `undefined` not assignable to optional properties | Medium    |
| `noImplicitOverride`            | Require `override` keyword on overridden methods  | Medium    |
| `verbatimModuleSyntax`          | Enforce explicit `type` imports for type-only     | Medium    |

**`noUncheckedIndexedAccess` in action:**

```typescript
const items: string[] = ["a", "b", "c"];

// WITHOUT noUncheckedIndexedAccess:
const first: string = items[0];  // OK (but dangerous if array is empty)

// WITH noUncheckedIndexedAccess:
const first: string | undefined = items[0];  // Must handle undefined
if (first !== undefined) {
  console.log(first.toUpperCase());  // Safe
}
```

### Recommended tsconfig.json

```jsonc
// tsconfig.json -- maximum safety configuration
{
  "compilerOptions": {
    // Type safety
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,

    // Module system
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,

    // Output
    "target": "ES2022",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Quality
    "skipLibCheck": false,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,

    // Paths
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

### Python Type Checking: mypy

**mypy strict configuration:**

```ini
# mypy.ini or [mypy] section in setup.cfg
[mypy]
python_version = 3.12
strict = true
warn_return_any = true
warn_unused_configs = true
warn_unreachable = true
show_error_codes = true
enable_error_code = ignore-without-code,redundant-cast,truthy-bool

# Per-module overrides for third-party libraries
[mypy-third_party_lib.*]
ignore_missing_imports = true

# Strict mode for new code, lenient for legacy
[mypy-legacy_module.*]
disallow_untyped_defs = false
```

**mypy strict flag expands to:**
- `disallow_untyped_defs` -- all functions must have type annotations.
- `disallow_any_generics` -- generic types must be parameterized.
- `disallow_untyped_calls` -- cannot call untyped functions from typed code.
- `check_untyped_defs` -- type-check bodies of untyped functions.
- `strict_equality` -- disallow equality with incompatible types.

**mypy daemon for speed:**

```bash
# Start daemon (persistent process, incremental analysis)
dmypy start
dmypy check src/
dmypy status
dmypy stop
```

### Python Type Checking: pyright

**pyright configuration (pyrightconfig.json):** Set `"typeCheckingMode": "strict"`, `"pythonVersion": "3.12"`, configure `reportMissingImports`, `reportUnusedImport`, `reportMissingTypeArgument` as `"error"`, and `reportMissingTypeStubs`, `reportPrivateUsage` as `"warning"`.

**mypy vs pyright comparison:**

| Aspect         | mypy                              | pyright                            |
|----------------|-----------------------------------|------------------------------------|
| **Speed**      | Slower (use dmypy for incremental)| Much faster (written in TypeScript)|
| **IDE**        | Plugin for various IDEs           | Native in VS Code (Pylance)        |
| **Strictness** | `--strict` flag                   | `typeCheckingMode: strict`         |
| **Plugins**    | Django, SQLAlchemy, Pydantic      | Fewer plugins                      |
| **Standard**   | Reference implementation          | Growing adoption                   |

Recommendation: Use pyright for IDE integration (via Pylance), mypy in CI for authoritative checking.

### Python Typing Patterns

```python
from typing import TypeVar, TypeGuard, ParamSpec, Literal, overload, Protocol
from collections.abc import Callable

# TypeGuard -- narrow types in conditional checks
def is_string_list(val: list[object]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in val)

# ParamSpec -- preserve function signatures in decorators
P = ParamSpec("P"); T = TypeVar("T")
def retry(func: Callable[P, T]) -> Callable[P, T]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        for i in range(3):
            try: return func(*args, **kwargs)
            except Exception:
                if i == 2: raise
        raise RuntimeError("unreachable")
    return wrapper

# Protocol -- structural typing (duck typing with type safety)
class Readable(Protocol):
    def read(self, n: int = -1) -> bytes: ...

# Literal types -- restrict to specific values
def set_log_level(level: Literal["DEBUG", "INFO", "WARNING", "ERROR"]) -> None: ...

# Overload -- different return types based on input
@overload
def fetch(url: str, raw: Literal[True]) -> bytes: ...
@overload
def fetch(url: str, raw: Literal[False] = ...) -> str: ...
def fetch(url: str, raw: bool = False) -> bytes | str:
    data = _download(url)
    return data if raw else data.decode()
```

### Go Type System

Go provides compile-time type safety through interfaces, type assertions, and generics:

```go
// Interface satisfaction -- implicit, no "implements" keyword
type Reader interface {
    Read(p []byte) (n int, err error)
}

// Prefer type switch over sequential type assertions
func process(v any) string {
    switch val := v.(type) {
    case string:  return val
    case int:     return strconv.Itoa(val)
    default:      return fmt.Sprintf("%v", v)
    }
}

// Generics with constraints
type Number interface { ~int | ~int64 | ~float64 }

func Sum[T Number](values []T) T {
    var total T
    for _, v := range values { total += v }
    return total
}
```

Run `go vet ./...` for built-in static analysis (printf format mismatches, unreachable code, struct tag issues, mutex copy, unused results).

### Gradual Typing Strategy

Adopt type checking incrementally in existing codebases:

1. **Start with typed boundaries** -- add types to public API functions, module interfaces, and data models first.
2. **Enforce strict for new files** -- configure per-module strictness (mypy) or use `// @ts-strict` comments.
3. **Increase coverage incrementally** -- set a type coverage floor (e.g., 70%) and ratchet it up each quarter.
4. **Prioritize high-risk modules** -- type business logic and data processing code before utility scripts.

### Type Coverage Measurement

**TypeScript coverage:**

```bash
# Using type-coverage
npx type-coverage --detail --strict --at-least 95
```

**Python coverage (mypy):**

```bash
# Generate HTML coverage report
mypy src/ --html-report mypy-report/

# Shows typed vs untyped lines per file
# Target: increase percentage each sprint
```

### Integrating Type Checking in CI

```yaml
# .github/workflows/typecheck.yml
name: Type Checking
on: [push, pull_request]
jobs:
  typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx type-coverage --at-least 95
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install mypy pyright
      - run: mypy src/ --strict && pyright src/
  go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: "1.22" }
      - run: go vet ./... && go build ./...
```

### Type-Safe Error Handling

```typescript
// TypeScript -- Result pattern (type-safe error handling)
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function parseJSON<T>(input: string): Result<T> {
  try {
    return { success: true, data: JSON.parse(input) as T };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

const result = parseJSON<{ name: string }>(raw);
if (result.success) {
  console.log(result.data.name);  // Narrowed to { name: string }
} else {
  console.error(result.error.message);  // Narrowed to Error
}
```

Apply the same pattern in Python using `dataclass` generics (`Ok[T] | Err[E]`) with `match` statements for exhaustive type narrowing. In Go, use the idiomatic `(value, error)` tuple return -- the compiler enforces handling when `err` is assigned.

---

## Best Practices

1. **Enable maximum strictness for new projects** -- start with TypeScript `strict: true` + `noUncheckedIndexedAccess`, mypy `--strict`, pyright `strict` mode from day one.
2. **Run type checking in CI as a blocking check** -- treat type errors as seriously as test failures; never merge code that fails type checking.
3. **Use `noEmit` for type checking** -- run `tsc --noEmit` in CI to type-check without producing output files; separate type checking from build.
4. **Add types to public APIs first** -- when adopting types gradually, prioritize module boundaries, public functions, and data transfer objects.
5. **Prefer interfaces and protocols over `any`** -- every `any` is a hole in type safety; use `unknown` with type guards instead.
6. **Measure and ratchet type coverage** -- track type coverage percentage; set a floor and increase it each quarter.
7. **Configure per-module strictness for gradual adoption** -- use mypy per-module overrides and TypeScript project references to apply different strictness levels.
8. **Use type-safe error handling patterns** -- adopt Result/Either types over thrown exceptions to make error handling explicit in type signatures.
9. **Keep `skipLibCheck: false` for library authors** -- validate declaration files to catch issues early; application projects may set `true` for speed.
10. **Integrate type checking in IDE** -- ensure every developer has real-time type feedback (Pylance for Python, TypeScript language server, gopls for Go).

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                               | Correction                                          |
|----|---------------------------------------|-------------------------------------------------------|-----------------------------------------------------|
| 1  | Using `any` to silence errors         | Defeats type safety, bugs propagate silently          | Use `unknown` with type guards or proper typing     |
| 2  | `// @ts-ignore` without explanation   | Hides real type errors                                | Use `// @ts-expect-error` with documented reason    |
| 3  | `type: ignore` across entire files    | Entire modules lose type checking                     | Apply per-line ignores with error codes             |
| 4  | Non-strict mode on new projects       | Allows null errors and implicit any from the start    | Enable strict from project creation                 |
| 5  | Skipping type check in CI             | Type errors merge into main branch                    | Add type check as required CI status check          |
| 6  | Type assertions instead of type guards| Runtime behavior not validated, just cast              | Write type guard functions that validate at runtime |
| 7  | Ignoring type coverage metrics        | Type adoption stalls without measurement              | Track coverage, set ratchet thresholds              |
| 8  | Mixing mypy and pyright configs       | Inconsistent results between tools                    | Pick one as authoritative CI check; other for IDE   |

---

## Enforcement Checklist

- [ ] TypeScript `strict: true` with `noUncheckedIndexedAccess` enabled in `tsconfig.json`.
- [ ] Python mypy `--strict` or pyright `strict` mode configured and passing.
- [ ] Go `go vet ./...` runs without warnings.
- [ ] Type checking runs as required CI status check on every PR.
- [ ] `any` usage tracked and minimized (lint rule or coverage metric).
- [ ] Type coverage measured and reported (target: >= 90% for established projects).
- [ ] Per-module strictness configured for gradual migration projects.
- [ ] IDE type checking configured for all team members (Pylance, TypeScript LSP, gopls).
- [ ] Type-safe error handling patterns documented in coding standards.
- [ ] `@ts-ignore` and `type: ignore` comments audited quarterly; each must have a reason.
