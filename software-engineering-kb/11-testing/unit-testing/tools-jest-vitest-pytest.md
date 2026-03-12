# Testing Tools: Jest, Vitest, pytest, Go testing

| Attribute      | Value                                        |
|----------------|----------------------------------------------|
| Domain         | Testing > Unit Testing                       |
| Importance     | High                                         |
| Last Updated   | 2026-03-10                                   |
| Cross-ref      | [Fundamentals](fundamentals.md), [Mocking Strategies](mocking-strategies.md), [Test Patterns](test-patterns.md) |

---

## Tool Comparison

| Capability              | Jest              | Vitest            | pytest              | Go `testing`       | JUnit 5           |
|-------------------------|-------------------|-------------------|---------------------|--------------------|-------------------|
| Language                | JS / TS           | JS / TS           | Python              | Go                 | Java / Kotlin     |
| Watch mode              | Built-in          | Built-in (Vite HMR) | `pytest-watch`   | `gotest.tools`     | Gradle continuous |
| Parallel execution      | Workers           | Threads / Workers | `pytest-xdist`      | `t.Parallel()`     | `@Execution`      |
| Snapshot testing        | Native            | Native            | `pytest-snapshot`   | Manual (golden)    | Manual            |
| Code coverage           | Istanbul / v8     | c8 / Istanbul     | `pytest-cov` (coverage.py) | `-cover` flag | JaCoCo          |
| Mocking                 | `jest.fn/mock`    | `vi.fn/mock`      | `unittest.mock`     | Interfaces + stubs | Mockito           |
| ESM support             | Experimental      | Native            | N/A                 | N/A                | N/A               |
| Config format           | `jest.config.ts`  | `vitest.config.ts`| `pyproject.toml`    | None (flags)       | `build.gradle`    |
| Avg cold-start (medium) | ~3 s              | ~1 s              | ~0.5 s              | ~0.3 s             | ~2 s              |

---

## Vitest

### Why Vitest

- Shares the Vite pipeline: no duplicate transform configuration.
- Native ESM -- no CJS/ESM interop issues that plague Jest.
- Compatible with most of the Jest API (`describe`, `it`, `expect`, `vi`).
- Faster cold-start and watch-mode re-runs due to Vite's module graph.

### Configuration with Coverage Thresholds

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,                    // inject describe/it/expect globally
    environment: "node",              // or "jsdom" for browser-like tests
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",                // or "istanbul"
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    // Performance
    pool: "threads",                  // "threads" | "forks" | "vmThreads"
    poolOptions: {
      threads: { maxThreads: 4, minThreads: 1 },
    },
  },
});
```

### Running Vitest

```bash
# Run all tests
npx vitest run

# Watch mode (re-runs on file change)
npx vitest

# Single file
npx vitest run src/services/__tests__/pricing.service.test.ts

# With coverage
npx vitest run --coverage
```

---

## Jest

### Strengths

- Mature ecosystem with thousands of community matchers and plugins.
- Snapshot testing is battle-tested for UI component output.
- `moduleNameMapper` and `transform` handle complex monorepo setups.

### Key Configuration

```javascript
// jest.config.ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  coverageThreshold: {
    global: { statements: 80, branches: 75, functions: 80, lines: 80 },
  },
  // Clear mocks automatically between tests
  clearMocks: true,
};
export default config;
```

### Snapshot Testing (Jest / Vitest)

```typescript
it("should serialize the user profile correctly", () => {
  const profile = renderProfile(userFactory.build());
  expect(profile).toMatchSnapshot();
});
// Update snapshots: npx jest --updateSnapshot
```

Use snapshots for serializable output (rendered components, API responses).
Avoid snapshots for large objects -- they become unreadable and get rubber-stamped in reviews.

---

## pytest

### Strengths

- Zero-boilerplate test discovery (`test_*.py` files, `test_` prefixed functions).
- Fixture system is the most flexible in the industry (scoping, parametrize, autouse).
- Plugin ecosystem: `pytest-cov`, `pytest-xdist`, `pytest-mock`, `pytest-asyncio`, `pytest-randomly`.

### Configuration (`pyproject.toml`)

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = [
    "--strict-markers",
    "--strict-config",
    "-ra",                  # show summary of all non-passing tests
    "--tb=short",           # shorter tracebacks
]
markers = [
    "slow: marks tests as slow (deselect with '-m not slow')",
    "integration: marks integration tests",
]

[tool.coverage.run]
source = ["src"]
branch = true

[tool.coverage.report]
fail_under = 80
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
```

### Running pytest

```bash
# Run all tests
pytest

# Verbose with coverage
pytest -v --cov=src --cov-report=term-missing

# Run in parallel (requires pytest-xdist)
pytest -n auto

# Filter by marker
pytest -m "not slow"

# Filter by keyword expression
pytest -k "test_cancel and not shipped"
```

### Essential Plugins

| Plugin            | Purpose                                       |
|-------------------|-----------------------------------------------|
| `pytest-cov`      | Coverage reporting integrated into pytest.     |
| `pytest-xdist`    | Parallel and distributed test execution.       |
| `pytest-mock`     | Thin wrapper around `unittest.mock` as a fixture. |
| `pytest-asyncio`  | Support for `async def` test functions.        |
| `pytest-randomly` | Randomize test order to surface hidden deps.   |
| `pytest-timeout`  | Fail tests that exceed a time limit.           |

---

## Go `testing` Package

### Strengths

- Built into the language -- no third-party test runner needed.
- First-class benchmarking (`b.N` loop) and race detection (`-race`).
- Subtests (`t.Run`) provide structure equivalent to `describe/it`.
- Coverage is a first-class flag, not a plugin.

### Running Go Tests

```bash
# Run all tests in the module
go test ./...

# Verbose output
go test -v ./...

# With race detector (always enable in CI)
go test -race ./...

# With coverage
go test -cover ./...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Run benchmarks
go test -bench=. -benchmem ./pricing/...

# Shuffle test order (Go 1.17+)
go test -shuffle=on ./...

# Timeout per test binary
go test -timeout 30s ./...
```

### Benchmark Example

```go
func BenchmarkCalculateDiscount(b *testing.B) {
	for i := 0; i < b.N; i++ {
		CalculateDiscount(10_000, "gold")
	}
}
```

### Race Detector

Always run `-race` in CI. It detects data races at runtime with roughly 5-10x slowdown.
A race-free test suite is non-negotiable for concurrent Go code.

### Coverage Enforcement

```bash
# Fail CI if coverage drops below threshold
go test -coverprofile=coverage.out ./...
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | tr -d '%')
if (( $(echo "$COVERAGE < 80" | bc -l) )); then
  echo "Coverage $COVERAGE% is below 80% threshold"
  exit 1
fi
```

---

## Migration Guide: Jest to Vitest

### Step 1 -- Install Vitest

```bash
npm install -D vitest @vitest/coverage-v8
```

### Step 2 -- Replace Config

Remove `jest.config.ts`. Create `vitest.config.ts` (see configuration section above).
Map Jest-specific config keys:

| Jest key             | Vitest equivalent               |
|----------------------|---------------------------------|
| `moduleNameMapper`   | `resolve.alias` in Vite config  |
| `transform`          | Vite plugins                    |
| `testEnvironment`    | `test.environment`              |
| `setupFilesAfterSetup` | `test.setupFiles`            |
| `clearMocks`         | `test.clearMocks`               |

### Step 3 -- Update Imports

```typescript
// Before (Jest)
import { jest } from "@jest/globals";
const spy = jest.fn();
jest.mock("../module");

// After (Vitest)
import { vi } from "vitest";
const spy = vi.fn();
vi.mock("../module");
```

### Step 4 -- Swap Global APIs

If `globals: true` is set in Vitest config, `describe`, `it`, and `expect` are available without
import. Otherwise, import them from `"vitest"`.

### Step 5 -- Update Snapshot Files

Vitest uses `.snap` files with the same format. Re-generate snapshots:

```bash
npx vitest run --update
```

### Step 6 -- CI Pipeline

Replace `npx jest --ci --coverage` with `npx vitest run --coverage`.

---

## Best Practices

1. **Pin tool versions in CI.** Use lockfiles and exact versions to prevent surprise breakages.
2. **Enable coverage thresholds as CI gates.** Do not allow merges that drop below the threshold.
3. **Run the race detector (Go) in every CI build.** The 5-10x overhead is acceptable for correctness.
4. **Use `--watch` during development, `--run` in CI.** Watch mode in CI wastes resources and hangs.
5. **Randomize test order.** Use `--shuffle` (Go), `pytest-randomly`, or Vitest's `sequence.shuffle`.
6. **Parallelize test execution.** Use `pytest-xdist -n auto`, Vitest `pool: "threads"`, or `t.Parallel()`.
7. **Generate machine-readable reports.** Output JUnit XML and LCOV for CI dashboards and PR annotations.
8. **Keep snapshot files small.** Large snapshots get rubber-stamped; limit them to focused output.
9. **Review and update tool configuration quarterly.** Remove obsolete flags; adopt new performance features.
10. **Standardize tooling across the organization.** One test runner per language reduces onboarding friction.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Running tests without coverage in CI** | Coverage silently degrades with every merge. | Enable `--coverage` with enforced thresholds in the CI job. |
| **Disabling the race detector to save time** | Data races ship to production undetected. | Always run `-race` in CI; optimize test speed elsewhere. |
| **Inconsistent config across microservices** | Each repo has different coverage rules and test patterns. | Share a base config via a preset package or org template. |
| **Watch mode in CI** | Pipeline hangs indefinitely waiting for file changes. | Use `--run` (Vitest) or `--ci` (Jest) in CI scripts. |
| **Ignoring flaky-test output** | Engineers stop trusting CI; skip failing checks. | Quarantine flaky tests; track and fix within a sprint. |
| **Snapshot abuse** (snapshotting entire API responses) | Tests pass trivially; real regressions hide in noise. | Snapshot only stable, focused output; assert fields explicitly otherwise. |
| **No parallel execution** | Suite takes 10+ minutes; developers skip local runs. | Enable `pytest-xdist`, Vitest threads, or `t.Parallel()`. |
| **Mixing test runner versions across branches** | Merge conflicts in lockfiles; inconsistent behavior. | Pin the runner version in `package.json` / `pyproject.toml`; update atomically. |

---

## Enforcement Checklist

- [ ] A single test runner is standardized per language across the organization.
- [ ] Coverage thresholds are defined in config and enforced as CI gates.
- [ ] CI runs tests with `--race` (Go) or equivalent safety flags.
- [ ] Test reports are exported in JUnit XML and LCOV for dashboard consumption.
- [ ] Watch mode is disabled in CI pipelines.
- [ ] Tests run in randomized order in CI to detect hidden dependencies.
- [ ] Parallel execution is enabled (`-n auto`, `pool: "threads"`, `t.Parallel()`).
- [ ] Snapshot files are reviewed in PRs with the same rigor as production code.
- [ ] Tool versions are pinned and updated on a documented schedule.
- [ ] Migration from legacy runners (e.g., Jest to Vitest) has a tracked plan with a deadline.
