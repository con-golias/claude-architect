# Mutation Testing

| Attribute      | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Domain         | Testing > Advanced Testing                                         |
| Importance     | High                                                               |
| Last Updated   | 2026-03-10                                                         |
| Cross-ref      | `11-testing/unit-testing/`, `11-testing/testing-philosophy/`       |

---

## Core Concepts

### What Mutation Testing Is

Mutation testing evaluates the **quality of your test suite** by injecting small, artificial bugs (called *mutants*) into production code and verifying that tests detect them. If a test fails after a mutation, the mutant is **killed** (good). If all tests pass, the mutant **survived** (bad -- your tests have a blind spot).

### Mutation Score vs Code Coverage

| Metric | What It Measures | Weakness |
| ------ | --------------- | -------- |
| Code Coverage | Which lines were executed during tests | A line can be executed without its result being asserted |
| Mutation Score | Whether tests detect when code behavior changes | Computationally expensive; slow on large codebases |

**Mutation score is strictly more informative than code coverage.** A function can have 100 % line coverage with a 20 % mutation score if tests exercise the code but never assert meaningful outcomes.

```
Mutation Score = (Killed Mutants / Total Mutants) x 100
```

Target a mutation score of **80 %+** for critical business logic. Achieving 100 % is rarely cost-effective.

### Mutation Operators

| Operator | Original | Mutant | What It Tests |
| --- | --- | --- | --- |
| Arithmetic | `a + b` | `a - b` | Are arithmetic results asserted? |
| Conditional boundary | `a >= b` | `a > b` | Are boundary conditions tested? |
| Negate conditional | `a === b` | `a !== b` | Is the branch decision verified? |
| Return value | `return x` | `return 0` / `return null` | Is the return value used by callers? |
| Statement deletion | `validateInput(x);` | (removed) | Are side effects tested? |
| Boolean substitution | `true` | `false` | Are boolean flags verified? |
| Increment/Decrement | `i++` | `i--` | Are loop iterations validated? |
| String mutation | `"error"` | `""` | Are string values checked? |

### How Mutation Testing Works

1. **Parse** the source code into an AST.
2. **Generate mutants** by applying mutation operators to the AST.
3. **Run the test suite** against each mutant (one at a time).
4. **Classify** each mutant as killed (test failed), survived (all tests passed), or timed out (likely infinite loop).
5. **Report** the mutation score and list surviving mutants with their locations.

### Tools

| Tool | Language | Mutation Operators | Incremental | CI Integration |
| --- | --- | --- | --- | --- |
| Stryker | JS/TS, C# | 30+ operators | Yes (diff-based) | GitHub, Azure DevOps |
| PIT (pitest) | Java/Kotlin | 15+ operators | Yes (history) | Maven, Gradle, Jenkins |
| mutmut | Python | 20+ operators | Yes (cache) | Any CI (CLI-based) |
| go-mutesting | Go | 10+ operators | No | Any CI (CLI-based) |
| cosmic-ray | Python | 15+ operators | Yes | Any CI |
| infection | PHP | 25+ operators | Yes | GitHub Actions |

---

## Code Examples

### TypeScript -- Stryker Configuration and Workflow

```jsonc
// stryker.config.json -- Stryker Mutator configuration
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker/master/packages/core/schema/stryker-core.schema.json",
  "mutate": [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/**/index.ts"
  ],
  "testRunner": "jest",
  "jest": {
    "configFile": "jest.config.ts"
  },
  "reporters": ["html", "clear-text", "progress", "json"],
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  },
  "concurrency": 4,
  "timeoutMS": 10000,
  "incremental": true,
  "incrementalFile": ".stryker-incremental.json",
  "ignorePatterns": [
    "node_modules",
    "dist",
    "coverage",
    ".stryker-tmp"
  ]
}
```

```typescript
// Example: code under test -- src/pricing.ts
export function calculateDiscount(
  price: number,
  quantity: number,
  isMember: boolean,
): number {
  if (price <= 0 || quantity <= 0) {
    return 0;
  }

  let discount = 0;

  if (quantity >= 10) {
    discount += 0.1; // 10% bulk discount
  }

  if (isMember) {
    discount += 0.05; // 5% member discount
  }

  const total = price * quantity;
  return Math.round(total * discount * 100) / 100;
}

// Example: tests that mutation testing would evaluate
// src/pricing.test.ts
import { calculateDiscount } from './pricing';

describe('calculateDiscount', () => {
  it('returns 0 for non-positive price', () => {
    expect(calculateDiscount(0, 5, false)).toBe(0);
    expect(calculateDiscount(-10, 5, false)).toBe(0);
  });

  it('returns 0 for non-positive quantity', () => {
    expect(calculateDiscount(100, 0, false)).toBe(0);
    expect(calculateDiscount(100, -1, false)).toBe(0);
  });

  it('applies bulk discount for quantity >= 10', () => {
    // Kills mutant: quantity >= 10 -> quantity > 10
    expect(calculateDiscount(100, 10, false)).toBe(100);
    expect(calculateDiscount(100, 9, false)).toBe(0);
  });

  it('applies member discount', () => {
    expect(calculateDiscount(100, 1, true)).toBe(5);
    expect(calculateDiscount(100, 1, false)).toBe(0);
  });

  it('stacks bulk and member discounts', () => {
    // 15% of (100 * 10) = 150.00
    expect(calculateDiscount(100, 10, true)).toBe(150);
  });
});
```

```yaml
# CI integration -- .github/workflows/mutation.yaml
name: Mutation Testing
on:
  pull_request:
    branches: [main]
    paths:
      - 'src/**/*.ts'
      - 'tests/**/*.ts'

jobs:
  mutation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for incremental mode
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Run Stryker (incremental)
        run: npx stryker run --incremental
      - name: Upload mutation report
        uses: actions/upload-artifact@v4
        with:
          name: mutation-report
          path: reports/mutation/
      - name: Check mutation score threshold
        run: |
          SCORE=$(jq '.schemaVersion' reports/mutation/mutation.json && \
                  jq '.files | to_entries | map(.value.mutants | length) as $total |
                  map(.value.mutants | map(select(.status == "Killed")) | length) as $killed |
                  ($killed[0] / $total[0] * 100)' reports/mutation/mutation.json)
          echo "Mutation score: $SCORE%"
```

### Python -- mutmut Setup and Workflow

```ini
# setup.cfg -- mutmut configuration
[mutmut]
paths_to_mutate=src/
backup=False
runner=python -m pytest -x --tb=short
tests_dir=tests/
dict_synonyms=Struct,NamedStruct
```

```python
# src/pricing.py -- Code under test
def calculate_discount(price: float, quantity: int, is_member: bool) -> float:
    """Calculate discount amount based on quantity and membership."""
    if price <= 0 or quantity <= 0:
        return 0.0

    discount = 0.0

    if quantity >= 10:
        discount += 0.10  # 10% bulk discount

    if is_member:
        discount += 0.05  # 5% member discount

    total = price * quantity
    return round(total * discount, 2)


# tests/test_pricing.py -- Tests designed to kill mutants
import pytest
from src.pricing import calculate_discount


class TestCalculateDiscount:
    """Tests written to achieve high mutation score."""

    def test_zero_price_returns_zero(self):
        assert calculate_discount(0, 5, False) == 0.0

    def test_negative_price_returns_zero(self):
        assert calculate_discount(-10, 5, False) == 0.0

    def test_zero_quantity_returns_zero(self):
        assert calculate_discount(100, 0, False) == 0.0

    def test_no_discount_below_threshold(self):
        # Kills: quantity >= 10 -> quantity > 10
        # Kills: quantity >= 10 -> quantity >= 11
        assert calculate_discount(100, 9, False) == 0.0

    def test_bulk_discount_at_boundary(self):
        # quantity = 10 exactly -> 10% of (100 * 10) = 100.00
        assert calculate_discount(100, 10, False) == 100.0

    def test_member_discount_only(self):
        assert calculate_discount(100, 1, True) == 5.0

    def test_no_member_discount(self):
        assert calculate_discount(100, 1, False) == 0.0

    def test_combined_discounts(self):
        # 15% of (100 * 10) = 150.00
        assert calculate_discount(100, 10, True) == 150.0

    def test_discount_arithmetic_precision(self):
        # Kills: 0.10 -> 0.11, 0.05 -> 0.06, etc.
        assert calculate_discount(33.33, 10, True) == 49.99
```

```bash
# Running mutmut
# Full run:
#   mutmut run
#
# Show results:
#   mutmut results
#
# Show a specific surviving mutant:
#   mutmut show 42
#
# Incremental run (only changed files):
#   mutmut run --paths-to-mutate=src/pricing.py
#
# Generate HTML report:
#   mutmut html
```

---

## Incremental Mutation Testing

Full mutation testing is expensive. Incremental strategies make it practical:

1. **Diff-based** -- Mutate only files changed in the PR. Stryker supports this with `--incremental`.
2. **History-based** -- Cache which mutants were killed by which tests. Re-run only when relevant tests or source change.
3. **Targeted** -- Mutate only high-risk modules (payment, authentication, data transformation).
4. **Sampling** -- Randomly select a percentage of mutants per run (e.g., 30 %) for fast feedback.

### Cost Management Strategy

| Environment | Strategy | Frequency |
| --- | --- | --- |
| Local development | Targeted: mutate only changed files | On demand |
| PR CI | Incremental: diff-based mutation | Every PR |
| Nightly CI | Full mutation on critical modules | Nightly |
| Release | Full mutation on entire codebase | Per release |

---

## Interpreting Results

### Surviving Mutants -- Triage

Not all surviving mutants indicate test gaps:

| Category | Action |
| --- | --- |
| **Missing assertion** -- test executes the code but does not check the output | Add an assertion; this is the most common and most valuable finding |
| **Equivalent mutant** -- mutation produces semantically identical code | Mark as ignored; e.g., `x * 1` mutated to `x * -1` where x is always 0 |
| **Trivial mutant** -- mutation in logging, comments, or non-functional code | Exclude from mutation scope via configuration |
| **Timeout mutant** -- mutation causes infinite loop, caught by timeout | Usually counts as killed; verify timeout configuration is reasonable |

---

## 10 Best Practices

1. **Run mutation testing on critical business logic first** -- prioritize payment, authorization, and data transformation modules.
2. **Use incremental mode in CI** -- full mutation testing on every PR is impractical; mutate only changed code.
3. **Set a minimum mutation score threshold** -- enforce 70-80 % as a build gate; increase over time.
4. **Analyze surviving mutants before writing new tests** -- each survivor tells you exactly which assertion is missing.
5. **Exclude generated code and boilerplate** -- DTOs, migration files, and auto-generated types add noise without value.
6. **Combine with code coverage** -- use coverage to find untested code, mutation testing to verify test quality.
7. **Time-box mutation testing** -- set a timeout per mutant (5-10 seconds) and a total budget per CI run.
8. **Review mutation reports in PRs** -- treat surviving mutants like code review comments requiring action.
9. **Track mutation score trends** -- a declining score indicates that new code is being added without adequate tests.
10. **Educate the team** -- mutation testing is unfamiliar to many engineers; run a workshop showing real surviving mutants.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
| --- | --- | --- |
| Running full mutation on every commit | CI takes hours; developers ignore results | Use incremental mode; run full mutation nightly or per release |
| Targeting 100% mutation score | Enormous effort for diminishing returns; equivalent mutants cannot be killed | Target 80% for critical code; accept equivalent mutants as noise |
| Mutating test files | Tests mutate tests, producing meaningless results | Configure `mutate` patterns to exclude `*.test.*` and `*.spec.*` |
| Ignoring surviving mutants | Test quality degrades over time; false confidence in coverage | Triage every surviving mutant: add assertion, mark as equivalent, or exclude |
| No timeout per mutant | Infinite loop mutants block CI indefinitely | Set `timeoutMS` (Stryker) or `--timeout` flag; 5-10 seconds per mutant |
| Mutating the entire monorepo at once | Overwhelming noise; impossible to triage hundreds of survivors | Scope mutation to the module being changed in the PR |
| Using mutation testing without unit tests | No tests to run against mutants; 100% survival rate provides no insight | Establish a baseline of unit tests first; then use mutation testing to improve them |
| Not tracking score over time | Cannot detect quality regression across releases | Store mutation score in CI metrics; alert on decline > 5% per sprint |

---

## Enforcement Checklist

- [ ] Mutation testing tool is configured and integrated into CI (Stryker, mutmut, or equivalent)
- [ ] Incremental mode is enabled for PR-level runs to keep feedback under 10 minutes
- [ ] Minimum mutation score threshold is defined as a build gate (recommend 70-80%)
- [ ] Critical modules (payment, auth, data transformation) are always in mutation scope
- [ ] Generated code, migrations, and boilerplate are excluded from mutation
- [ ] Surviving mutants are triaged in every PR: assertion added, equivalent marked, or scope excluded
- [ ] Mutation score trend is tracked in dashboards and reviewed in sprint retrospectives
- [ ] Full mutation run executes nightly or per release on the complete codebase
- [ ] Timeout per mutant is configured to prevent CI hangs (5-10 seconds)
- [ ] Team has completed a mutation testing workshop and understands how to interpret reports
