# Flaky Tests

| Attribute      | Value                                                                |
|----------------|----------------------------------------------------------------------|
| **Domain**     | Testing > Test Automation                                            |
| **Importance** | Critical                                                             |
| **Last Updated** | 2026-03-10                                                         |
| **Cross-ref**  | `11-testing/test-automation/ci-integration.md`, `11-testing/test-automation/test-data-management.md` |

---

## Core Concepts

### Definition

A flaky test produces both passing and failing results against the same code
without any source change. The non-determinism lives in the test, its
environment, or the system under test.

### Root Causes

| Cause                    | Description                                              | Frequency |
|--------------------------|----------------------------------------------------------|-----------|
| **Race conditions**      | Tests depend on timing of concurrent operations          | Very High |
| **Shared mutable state** | Tests read/write global state, DB rows, or files         | High      |
| **External dependencies**| Network calls, third-party APIs, DNS resolution          | High      |
| **Timing assumptions**   | `sleep()`, hardcoded timeouts, animation delays          | High      |
| **Test order dependency**| Test A sets up state that test B implicitly depends on   | Medium    |
| **Resource exhaustion**  | Port conflicts, file descriptor leaks, memory pressure   | Medium    |
| **Non-deterministic data** | Random values, timestamps, UUIDs in assertions         | Medium    |
| **Platform differences** | OS behavior, locale, timezone, floating-point            | Low       |

### Impact on Engineering

- **Eroded CI trust**: developers re-run until green.
- **"Approve and merge anyway" culture**: teams bypass CI gates.
- **Wasted time**: 15-45 min per flaky failure investigation.
- **Slower delivery**: flaky failures block deployments.

A flaky rate above 1-2 % causes most developers to stop trusting CI entirely.

### Detection Strategies

1. **Repeated execution**: `--repeat-each=5` (Playwright), `go test -count=10`.
2. **Historical analysis**: track pass/fail per test across CI runs.
3. **CI-native detection**: flag tests that failed then passed on retry.
4. **Randomized ordering**: `pytest-randomly`, `jest --randomize`.

### Quarantine Strategy

```
Detect -> Flag -> Isolate -> Track -> Fix -> Restore
```

1. **Detect**: CI flags repeated failures.
2. **Flag**: annotate with `@flaky` and a tracking issue.
3. **Isolate**: move to a quarantine suite that does not block merges.
4. **Track**: owning team has 5-business-day SLA.
5. **Fix**: address root cause, not just add retries.
6. **Restore**: move back and verify stability.

### Metrics

- **Flaky test rate**: `flaky_failures / total_test_runs` (target: < 0.5 %)
- **Mean time to fix**: average days in quarantine
- **Quarantine size**: target < 1 % of suite
- **CI retry rate**: percentage of pipelines requiring retry

---

## Code Examples

### Playwright Retry Configuration and Flaky Test Reporter (TypeScript)

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["./reporters/flaky-reporter.ts"],
  ],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

```typescript
// reporters/flaky-reporter.ts
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

interface FlakyTestRecord {
  title: string;
  file: string;
  attempts: number;
}

class FlakyReporter implements Reporter {
  private flakyTests: FlakyTestRecord[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === "passed" && result.retry > 0) {
      this.flakyTests.push({
        title: test.title,
        file: test.location.file,
        attempts: result.retry + 1,
      });
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.flakyTests.length === 0) return;

    console.log(`\n--- ${this.flakyTests.length} Flaky Test(s) Detected ---\n`);
    for (const t of this.flakyTests) {
      console.log(`  [FLAKY] ${t.title} (${t.file}, ${t.attempts} attempts)`);
    }

    const { writeFileSync, mkdirSync } = await import("fs");
    mkdirSync("test-results", { recursive: true });
    writeFileSync("test-results/flaky-tests.json", JSON.stringify(this.flakyTests, null, 2));
  }
}

export default FlakyReporter;
```

### t.Parallel() Race Conditions and Fixes (Go)

```go
package user_test

import (
	"context"
	"testing"
	"time"
)

// ANTI-PATTERN: shared mutable state across parallel tests
var sharedCounter int

func TestFlaky_SharedState(t *testing.T) {
	t.Parallel()
	sharedCounter++ // Race condition
	if sharedCounter != 1 {
		t.Errorf("expected 1, got %d", sharedCounter)
	}
}

// FIX: each test owns its state
func TestFixed_OwnedState(t *testing.T) {
	t.Parallel()
	counter := 0
	counter++
	if counter != 1 {
		t.Errorf("expected 1, got %d", counter)
	}
}

// ANTI-PATTERN: loop variable capture in parallel subtests
func TestFlaky_LoopCapture(t *testing.T) {
	cases := []struct{ name string; input, want int }{
		{"one", 1, 2}, {"two", 2, 3}, {"three", 3, 4},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := tc.input + 1 // BUG: tc captured by reference
			if got != tc.want {
				t.Errorf("got %d, want %d", got, tc.want)
			}
		})
	}
}

// FIX: shadow the loop variable
func TestFixed_LoopCapture(t *testing.T) {
	cases := []struct{ name string; input, want int }{
		{"one", 1, 2}, {"two", 2, 3}, {"three", 3, 4},
	}
	for _, tc := range cases {
		tc := tc // Shadow — each goroutine gets its own copy
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := tc.input + 1
			if got != tc.want {
				t.Errorf("got %d, want %d", got, tc.want)
			}
		})
	}
}

// ANTI-PATTERN: timing-dependent assertion
func TestFlaky_TimingDependent(t *testing.T) {
	t.Parallel()
	ch := make(chan string, 1)
	go func() {
		time.Sleep(50 * time.Millisecond)
		ch <- "done"
	}()
	time.Sleep(60 * time.Millisecond) // May not be enough under CI load
	select {
	case v := <-ch:
		if v != "done" { t.Fatal("unexpected") }
	default:
		t.Fatal("channel empty") // Flaky
	}
}

// FIX: context timeout instead of sleep
func TestFixed_ContextTimeout(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	ch := make(chan string, 1)
	go func() {
		time.Sleep(50 * time.Millisecond)
		ch <- "done"
	}()
	select {
	case v := <-ch:
		if v != "done" { t.Fatal("unexpected") }
	case <-ctx.Done():
		t.Fatal("timed out")
	}
}
```

### pytest-randomly for Detecting Order-Dependent Tests (Python)

```python
# conftest.py
import json
import time
from pathlib import Path

import pytest


# --- Quarantine marker ---
# Usage: @pytest.mark.quarantine(reason="Race condition, JIRA-1234")

def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "quarantine(reason): Mark test as flaky and quarantined")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    run_quarantine = config.getoption("--run-quarantine", default=False)
    for item in items:
        if item.get_closest_marker("quarantine") and not run_quarantine:
            item.add_marker(pytest.mark.skip(reason="Quarantined flaky test"))


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption("--run-quarantine", action="store_true", default=False,
                     help="Run quarantined flaky tests instead of skipping them")


@pytest.fixture(autouse=True)
def _isolate_environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Isolated temp directory and clean env for every test."""
    monkeypatch.chdir(tmp_path)
    for var in ("RANDOM_SEED", "TZ"):
        monkeypatch.delenv(var, raising=False)


@pytest.fixture
def frozen_time(monkeypatch: pytest.MonkeyPatch):
    """Deterministic time.time() replacement."""
    class FrozenTime:
        current = 1700000000.0
        @classmethod
        def time(cls) -> float: return cls.current
        @classmethod
        def advance(cls, seconds: float) -> None: cls.current += seconds
    monkeypatch.setattr(time, "time", FrozenTime.time)
    return FrozenTime


@pytest.fixture
def deterministic_uuid(monkeypatch: pytest.MonkeyPatch):
    """Deterministic uuid4() replacement."""
    import uuid
    counter = 0
    def fake_uuid4() -> uuid.UUID:
        nonlocal counter
        counter += 1
        return uuid.UUID(f"00000000-0000-4000-8000-{counter:012d}")
    monkeypatch.setattr(uuid, "uuid4", fake_uuid4)
```

```python
# tests/test_order_independent.py
"""Demonstrate proper test isolation to prevent order-dependent flakiness."""
import pytest

class TestUserService:
    @pytest.fixture
    def user_store(self) -> dict:
        return {}  # Fresh per test

    def test_create_user(self, user_store: dict) -> None:
        user_store["alice"] = {"name": "Alice", "active": True}
        assert "alice" in user_store

    def test_list_empty(self, user_store: dict) -> None:
        assert len(user_store) == 0  # Does NOT depend on test_create_user

    def test_delete_nonexistent(self, user_store: dict) -> None:
        assert user_store.pop("bob", None) is None
```

---

## 10 Best Practices

1. **Treat flaky tests as P1 bugs.** An unfixed flaky test harms the entire team's productivity.
2. **Quarantine within 24 hours.** Never let flaky tests block the main pipeline during investigation.
3. **Set a fix SLA of 5 business days** from quarantine to resolution. Track compliance on a dashboard.
4. **Never use `sleep()` for synchronization.** Use auto-wait (Playwright), `select` with context (Go), or `asyncio.wait_for` (Python).
5. **Isolate all mutable state.** Each test creates and tears down its own data. Never depend on test order.
6. **Run tests in random order** at least once per pipeline to catch order-dependent flakiness early.
7. **Shadow loop variables in Go parallel subtests** (`tc := tc`) to prevent captured-variable races.
8. **Capture trace artifacts on first retry** (screenshots, videos, logs) so failures are debuggable.
9. **Monitor flaky test rate weekly.** Alert if it exceeds 0.5 %. Present in sprint retrospectives.
10. **Reproduce locally before fixing** with `--repeat-each`, `-count=N`, or `pytest --count=50`.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Adding retries without investigating root cause | Masks bugs, increases CI duration | Fix root cause first; retries are a temporary safety net |
| Using `sleep()` / fixed delays for synchronization | Fails under load, wastes time when excessive | Use explicit wait conditions or event-driven sync |
| Sharing database state between parallel tests | Random failures from cross-test interference | Per-test transactions or schemas; truncate after each test |
| Leaving quarantined tests indefinitely | Quarantine grows unbounded; tests are abandoned | Enforce fix SLA; auto-delete after 30 days |
| Ignoring flaky test metrics | No visibility, no incentive to fix | Dashboard the flaky rate in sprint health metrics |
| Depending on external APIs in unit tests | Network issues cause non-deterministic failures | Mock externals; use contract tests separately |
| Using real clocks and random values in assertions | Breaks across timezones, DST, unlucky seeds | Inject deterministic clocks and seeded RNGs |
| Disabling flaky tests instead of quarantining | Test is forgotten; validated behavior unprotected | Quarantine with tracking issue and SLA |

---

## Enforcement Checklist

- [ ] Flaky test detection is automated in CI (retry tracking, historical analysis)
- [ ] A quarantine marker or suite exists and is integrated into the test runner
- [ ] Quarantined tests do not block the main CI pipeline
- [ ] A fix SLA of 5 business days is documented and tracked
- [ ] Flaky test rate is measured weekly and visible on a team dashboard
- [ ] Tests run in randomized order at least once per pipeline
- [ ] No `sleep()`-based synchronization exists in the test suite
- [ ] All parallel tests use proper state isolation (no shared mutables)
- [ ] Trace artifacts (screenshots, videos, logs) are captured on retries
- [ ] Quarantine size is reviewed in sprint retrospectives
- [ ] Tests quarantined beyond 30 days are escalated or removed
- [ ] External service calls in unit tests are mocked or stubbed
