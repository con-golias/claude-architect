# Unit Testing Fundamentals

| Attribute      | Value                                        |
|----------------|----------------------------------------------|
| Domain         | Testing > Unit Testing                       |
| Importance     | Critical                                     |
| Last Updated   | 2026-03-10                                   |
| Cross-ref      | [Mocking Strategies](mocking-strategies.md), [Test Patterns](test-patterns.md), [Tools](tools-jest-vitest-pytest.md) |

---

## Core Concepts

### Definition

A unit test verifies a single unit of behavior in isolation from the rest of the system.
Define "unit" as a single logical concept or behavior, not necessarily a single function or class.

### FIRST Principles

| Principle          | Description                                                        |
|--------------------|--------------------------------------------------------------------|
| **Fast**           | Execute in milliseconds. A slow suite erodes developer discipline. |
| **Isolated**       | No shared state between tests. No reliance on execution order.     |
| **Repeatable**     | Same result on any machine, any time, any order.                   |
| **Self-validating**| Binary pass/fail. No manual inspection of output.                  |
| **Timely**         | Write tests close to the time the production code is written.      |

### AAA Pattern (Arrange-Act-Assert)

Structure every test into three distinct phases:

1. **Arrange** -- Set up the preconditions and inputs.
2. **Act** -- Execute the unit under test.
3. **Assert** -- Verify the expected outcome.

Keep each phase visually separated. One `Act` per test. Multiple `Assert` statements are acceptable
only when they verify facets of a single logical outcome.

### Test Naming Conventions

Adopt a naming pattern that reads as a specification. Choose one and enforce it project-wide.

| Pattern                        | Example                                          |
|--------------------------------|--------------------------------------------------|
| `should_<outcome>_when_<condition>` | `should_return_zero_when_cart_is_empty`       |
| `given_<state>_when_<action>_then_<result>` | `given_expired_token_when_validate_then_throw` |
| `<method>_<scenario>_<expected>` | `calculateTotal_emptyCart_returnsZero`          |

### One Logical Concept per Test

Never verify two unrelated behaviors in a single test. When a test fails, the name and single assertion
must immediately communicate *what* broke.

### Boundary Value Analysis

Test at the edges of equivalence classes:

- Minimum, minimum - 1, minimum + 1
- Maximum, maximum - 1, maximum + 1
- Empty collections, single-element collections
- Zero, negative, positive for numerics
- Null/undefined/None where the type system allows

### Equivalence Partitioning

Partition inputs into classes that the system treats identically. Write at least one test per partition.
Prioritize invalid partitions -- they reveal defensive-coding gaps.

---

## Code Examples

### TypeScript -- Jest / Vitest (Service Class)

```typescript
// src/services/pricing.service.ts
export class PricingService {
  calculateDiscount(totalCents: number, customerTier: "standard" | "gold" | "platinum"): number {
    if (totalCents < 0) throw new RangeError("totalCents must be non-negative");
    if (totalCents === 0) return 0;

    const rates: Record<string, number> = { standard: 0, gold: 0.1, platinum: 0.2 };
    return Math.round(totalCents * rates[customerTier]);
  }
}

// src/services/__tests__/pricing.service.test.ts
import { describe, it, expect } from "vitest";          // swap "vitest" for "@jest/globals" if using Jest
import { PricingService } from "../pricing.service";

describe("PricingService", () => {
  const sut = new PricingService();                       // sut = system under test

  describe("calculateDiscount", () => {
    // --- Happy path ---
    it("should return 0 discount for standard tier", () => {
      // Arrange
      const total = 10_000;
      // Act
      const discount = sut.calculateDiscount(total, "standard");
      // Assert
      expect(discount).toBe(0);
    });

    it("should return 10% discount for gold tier", () => {
      expect(sut.calculateDiscount(10_000, "gold")).toBe(1_000);
    });

    it("should return 20% discount for platinum tier", () => {
      expect(sut.calculateDiscount(10_000, "platinum")).toBe(2_000);
    });

    // --- Boundary ---
    it("should return 0 when totalCents is 0 regardless of tier", () => {
      expect(sut.calculateDiscount(0, "platinum")).toBe(0);
    });

    it("should round discount to nearest cent", () => {
      expect(sut.calculateDiscount(1_001, "gold")).toBe(100); // 100.1 rounds to 100
    });

    // --- Error path ---
    it("should throw RangeError when totalCents is negative", () => {
      expect(() => sut.calculateDiscount(-1, "gold")).toThrow(RangeError);
    });
  });
});
```

### Go -- Table-Driven Tests with Subtests

```go
// pricing/pricing.go
package pricing

import (
	"errors"
	"math"
)

var ErrNegativeTotal = errors.New("total must be non-negative")

func CalculateDiscount(totalCents int, tier string) (int, error) {
	if totalCents < 0 {
		return 0, ErrNegativeTotal
	}
	rates := map[string]float64{"standard": 0, "gold": 0.1, "platinum": 0.2}
	rate, ok := rates[tier]
	if !ok {
		return 0, errors.New("unknown tier")
	}
	return int(math.Round(float64(totalCents) * rate)), nil
}

// pricing/pricing_test.go
package pricing_test

import (
	"testing"

	"example.com/pricing"
)

func TestCalculateDiscount(t *testing.T) {
	tests := []struct {
		name      string
		total     int
		tier      string
		want      int
		wantErr   error
	}{
		{name: "standard tier no discount", total: 10000, tier: "standard", want: 0},
		{name: "gold tier 10 pct", total: 10000, tier: "gold", want: 1000},
		{name: "platinum tier 20 pct", total: 10000, tier: "platinum", want: 2000},
		{name: "zero total returns zero", total: 0, tier: "platinum", want: 0},
		{name: "negative total errors", total: -1, tier: "gold", wantErr: pricing.ErrNegativeTotal},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := pricing.CalculateDiscount(tt.total, tt.tier)
			if tt.wantErr != nil {
				if err == nil || err.Error() != tt.wantErr.Error() {
					t.Fatalf("expected error %v, got %v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("CalculateDiscount(%d, %q) = %d; want %d", tt.total, tt.tier, got, tt.want)
			}
		})
	}
}
```

### Python -- pytest parametrize and Fixtures

```python
# pricing/service.py
class PricingService:
    _rates = {"standard": 0.0, "gold": 0.1, "platinum": 0.2}

    def calculate_discount(self, total_cents: int, tier: str) -> int:
        if total_cents < 0:
            raise ValueError("total_cents must be non-negative")
        if tier not in self._rates:
            raise ValueError(f"unknown tier: {tier}")
        return round(total_cents * self._rates[tier])

# tests/test_pricing.py
import pytest
from pricing.service import PricingService

@pytest.fixture
def sut() -> PricingService:
    return PricingService()

class TestCalculateDiscount:
    @pytest.mark.parametrize(
        "total, tier, expected",
        [
            (10_000, "standard", 0),
            (10_000, "gold", 1_000),
            (10_000, "platinum", 2_000),
            (0, "platinum", 0),
            (1_001, "gold", 100),
        ],
        ids=["standard-no-discount", "gold-10pct", "platinum-20pct", "zero-total", "rounding"],
    )
    def test_happy_paths(self, sut: PricingService, total: int, tier: str, expected: int):
        assert sut.calculate_discount(total, tier) == expected

    def test_negative_total_raises(self, sut: PricingService):
        with pytest.raises(ValueError, match="non-negative"):
            sut.calculate_discount(-1, "gold")

    def test_unknown_tier_raises(self, sut: PricingService):
        with pytest.raises(ValueError, match="unknown tier"):
            sut.calculate_discount(100, "bronze")
```

---

## Test Organization

### Describe / It Blocks (TypeScript)

Nest `describe` blocks to group by class, then by method. Use `it` (or `test`) for individual cases.
Keep nesting depth at most three levels.

### Test Suites (Go)

Group related tests in the same `_test.go` file. Use `t.Run` for subtests. Prefix helpers with `t.Helper()`
so failure locations point to the caller, not the helper.

### Module Layout (Python)

Mirror the source tree under a `tests/` directory. Name files `test_<module>.py`. Use classes to group
related tests (`TestCalculateDiscount`). Share fixtures through `conftest.py` at the appropriate scope.

---

## Best Practices

1. **Keep tests under 20 lines.** If a test needs more, extract helpers or rethink the unit boundary.
2. **Name tests as specifications.** A passing suite should read like a requirements document.
3. **Isolate every test.** Never rely on execution order or shared mutable state.
4. **Assert one logical concept per test.** Multiple `expect` calls are fine if they describe one outcome.
5. **Prefer explicit setup over implicit.** Minimize "magic" from base classes or global hooks.
6. **Use parameterized tests for combinatorial inputs.** Reduce duplication without sacrificing clarity.
7. **Test behavior, not implementation.** Assert on outputs and side effects, not internal method calls.
8. **Maintain test code to production standards.** Apply the same review, naming, and refactoring rigor.
9. **Run the full suite before every push.** Integrate unit tests into pre-push hooks and CI.
10. **Delete dead tests.** A skipped or commented-out test is a lie in the codebase. Remove or fix it.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Logic in tests** (conditionals, loops) | Introduces bugs inside the test itself; masks failures. | Use parameterized tests; keep test logic linear. |
| **Shared mutable state** | Tests pass or fail depending on execution order. | Create fresh state in each test's Arrange phase. |
| **Testing private methods** | Couples tests to implementation; breaks on refactor. | Test through the public API; redesign if needed. |
| **Multiple Acts per test** | Unclear which act caused the failure. | Split into separate tests, one act each. |
| **Magic numbers without context** | Unreadable assertions; hard to understand intent. | Use named constants or inline comments. |
| **Ignoring flaky tests** | Erodes trust in the entire suite; hides real regressions. | Quarantine, diagnose root cause, fix or delete. |
| **Copy-paste test setup** | Massive duplication; single change requires N edits. | Extract fixtures, factories, or helper functions. |
| **No assertion at all** | Test always passes; provides false confidence. | Enforce at least one assertion per test via lint rules. |

---

## Enforcement Checklist

- [ ] Every public module has a corresponding test file.
- [ ] Test names follow the agreed naming convention.
- [ ] Each test has exactly one Act phase.
- [ ] No test depends on the execution order of another test.
- [ ] Parameterized tests cover boundary values and equivalence partitions.
- [ ] CI fails the build on any test failure.
- [ ] Code coverage thresholds are configured and enforced (statements, branches, functions).
- [ ] Flaky tests are tracked in a dedicated issue tracker label.
- [ ] Test execution time is monitored; any test over 200 ms is flagged for review.
- [ ] Pre-commit or pre-push hooks run the unit test suite.
