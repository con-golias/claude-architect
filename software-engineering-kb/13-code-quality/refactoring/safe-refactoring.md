# Safe Refactoring

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | Code Quality > Refactoring                                           |
| Importance     | High                                                                 |
| Audience       | All developers                                                       |
| Prerequisites  | Version control, testing fundamentals, CI pipeline                   |
| Cross-ref      | [Automated Refactoring](automated-refactoring.md), [01-fundamentals refactoring](../../01-fundamentals/clean-code/10-refactoring/) |

---

## Core Concepts

### Safety Nets for Refactoring

Establish safety nets before touching production code. Never refactor without at least one layer of automated verification.

**Test coverage as prerequisite.** Verify coverage for the code to be changed before starting. Use coverage tools to identify gaps.

```bash
# Check coverage for specific file/module before refactoring
npx jest --coverage --collectCoverageFrom='src/billing/**/*.ts' src/billing/
pytest --cov=billing --cov-report=term-missing tests/billing/
go test -cover ./billing/...
```

**Characterization tests for untested code.** When refactoring legacy code that lacks tests, write characterization tests that capture current behavior -- even if that behavior is wrong.

```typescript
// Characterization test: capture existing behavior before refactoring
describe("LegacyPricingEngine", () => {
  it("returns 0 for negative quantities (current behavior)", () => {
    const result = calculatePrice(-1, 10.0);
    // This may be a bug, but capture it now, fix after refactoring
    expect(result).toBe(0);
  });

  it("applies discount after tax (current order)", () => {
    const result = calculatePrice(10, 100, { discount: 0.1, tax: 0.2 });
    expect(result).toBe(1080); // Document actual output
  });
});
```

**Static type checking.** Enable strict mode in TypeScript or use mypy/pyright for Python.

```jsonc
// tsconfig.json -- enable strict before refactoring
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

### The Refactoring Workflow

Follow this five-step cycle for every atomic change:

```
1. Ensure all tests pass (green)
2. Make ONE structural change (no behavior change)
3. Run all tests
4. Commit with descriptive message
5. Repeat
```

```typescript
// Step-by-step example: Extract function

// BEFORE -- monolithic handler
async function processOrder(order: Order): Promise<Result> {
  // 50 lines of validation...
  // 30 lines of pricing...
  // 20 lines of notification...
}

// Step 1: Tests pass. Step 2: Extract validation.
async function validateOrder(order: Order): ValidationResult {
  // Moved 50 lines here -- no logic changes
}

async function processOrder(order: Order): Promise<Result> {
  const validation = validateOrder(order);
  // 30 lines of pricing...
  // 20 lines of notification...
}
// Step 3: Run tests. Step 4: Commit "refactor: extract validateOrder"
// Step 5: Repeat for pricing, notification
```

### IDE-Assisted Refactoring

Use IDE refactoring tools -- they perform AST-level transformations, not text search-replace.

| Refactoring          | VS Code Shortcut      | JetBrains Shortcut     |
|----------------------|-----------------------|------------------------|
| Rename symbol        | F2                    | Shift+F6               |
| Extract function     | Ctrl+Shift+R          | Ctrl+Alt+M             |
| Extract variable     | Ctrl+Shift+R          | Ctrl+Alt+V             |
| Extract constant     | Ctrl+Shift+R          | Ctrl+Alt+C             |
| Inline variable      | Ctrl+Shift+R          | Ctrl+Alt+N             |
| Move to file         | Refactor menu         | F6                     |
| Change signature     | Refactor menu         | Ctrl+F6                |

```typescript
// IDE rename: updates all references including imports, types, tests
// Before: IDE rename "userId" → "accountId"
interface Query { userId: string; }
function findUser(userId: string) { /* ... */ }

// After: all references updated atomically
interface Query { accountId: string; }
function findUser(accountId: string) { /* ... */ }
```

### Refactoring with Feature Flags

Use feature flags for large refactoring that spans multiple PRs.

```typescript
// Wrap refactored code behind a flag
async function calculateShipping(order: Order): Promise<number> {
  if (featureFlags.isEnabled("new-shipping-engine", order.userId)) {
    return newShippingEngine.calculate(order);  // Refactored path
  }
  return legacyShippingEngine.calculate(order);  // Original path
}
```

**Rollout strategy:**
1. Deploy new code behind flag (0% traffic)
2. Enable for internal users, verify in production
3. Ramp to 1%, 5%, 25%, 50%, 100%
4. Remove flag and old code after stable period

### Parallel Implementation (Scientist Pattern)

Run old and new code simultaneously, compare outputs, but serve old results.

```python
from scientist import Experiment

def calculate_tax(order):
    experiment = Experiment("tax-calculation-v2")
    experiment.use(lambda: legacy_tax_calc(order))       # Control
    experiment.try_(lambda: refactored_tax_calc(order))   # Candidate

    # Runs both, logs mismatches, returns control result
    return experiment.run()
```

```typescript
// TypeScript equivalent using custom implementation
async function withExperiment<T>(
  name: string,
  control: () => Promise<T>,
  candidate: () => Promise<T>,
  compare: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b)
): Promise<T> {
  const controlResult = await control();
  // Run candidate async, never block
  candidate().then(candidateResult => {
    if (!compare(controlResult, candidateResult)) {
      logger.warn(`Experiment ${name} mismatch`, {
        control: controlResult,
        candidate: candidateResult,
      });
    }
  }).catch(err => logger.error(`Experiment ${name} candidate error`, err));
  return controlResult;
}
```

### Database Refactoring: Expand-Contract Pattern

Never make breaking schema changes in one step. Use expand-contract (also called parallel change).

```
Phase 1 — EXPAND: Add new column/table alongside old
Phase 2 — MIGRATE: Dual-write to both, backfill old data
Phase 3 — CONTRACT: Remove old column/table after all readers updated

Timeline: days to weeks per phase depending on data volume
```

```sql
-- Phase 1: Add new column (non-breaking)
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- Phase 2: Dual-write (application code writes both)
-- Backfill: UPDATE users SET full_name = first_name || ' ' || last_name;

-- Phase 3: Drop old columns after all services read from full_name
ALTER TABLE users DROP COLUMN first_name, DROP COLUMN last_name;
```

### API Refactoring: Versioning and Deprecation

```typescript
// Add deprecation headers to old endpoints
app.get("/api/v1/users/:id", (req, res) => {
  res.set("Deprecation", "true");
  res.set("Sunset", "Sat, 01 Mar 2025 00:00:00 GMT");
  res.set("Link", '</api/v2/users/:id>; rel="successor-version"');
  // ... serve response
});

// New version available simultaneously
app.get("/api/v2/users/:id", (req, res) => {
  // Refactored implementation
});
```

**Sunset timeline:** Announce deprecation (3 months) -> Warning logs and headers (2 months) -> Error responses for stragglers (2 weeks) -> Remove.

### Incremental Refactoring Strategies

| Strategy                  | When to Use                          | Cadence          |
|---------------------------|--------------------------------------|------------------|
| Boy Scout Rule            | Small improvements spotted in context| Every PR         |
| Opportunistic refactoring | Refactor code you're already changing| During feature work|
| Dedicated refactoring PR  | Isolated improvements, clear scope   | Weekly           |
| Refactoring sprint        | Large structural changes             | Quarterly        |

### Measuring Refactoring Success

Track before and after metrics to justify refactoring investment.

```yaml
# Metrics to capture before/after refactoring
complexity:
  cyclomatic: "Reduced from 45 to 12"
  cognitive: "Reduced from 38 to 9"
quality:
  test_coverage: "Increased from 23% to 87%"
  duplication: "Reduced from 18% to 3%"
velocity:
  time_to_change: "Reduced from 3 days to 4 hours"
  deployment_frequency: "Increased from weekly to daily"
  bug_rate: "Reduced by 60% in refactored module"
```

### Refactoring Checklist by Change Type

| Change Type          | Prerequisites                    | Verification                          |
|----------------------|----------------------------------|---------------------------------------|
| Rename               | Find all references via IDE      | Tests pass, no string-based lookups   |
| Extract function     | Identify pure vs side-effectful  | Same behavior, tests pass             |
| Move to module       | Check circular dependency risk   | Import graph clean, tests pass        |
| Replace algorithm    | Characterization tests written   | Parallel run matches, perf acceptable |
| Change data structure| Expand-contract if persisted     | Migration tested, rollback plan ready |
| Inline               | Only one call site or trivial    | Tests pass, readability improved      |
| Change signature     | All callers identified           | Compile clean, tests pass             |

---

## Best Practices

1. **Write characterization tests before refactoring untested code.** Capture current behavior as the baseline, even if that behavior contains bugs. Fix bugs in a separate step.

2. **Make one change per commit.** Each commit should contain exactly one refactoring operation (rename, extract, move). This makes bisecting trivial and reverts safe.

3. **Never mix refactoring and behavior changes in the same commit.** Reviewers cannot verify correctness when structural changes and logic changes are interleaved.

4. **Use IDE refactoring tools instead of manual find-replace.** IDE tools operate on the AST and update all references including types, imports, and string literals in test assertions.

5. **Run the full test suite after every atomic change.** Do not batch multiple refactorings before running tests -- you will not know which change broke behavior.

6. **Use feature flags for refactoring that spans more than 3 PRs.** Merge incomplete refactoring behind flags to avoid long-lived branches and painful merges.

7. **Apply the expand-contract pattern for all persistent data changes.** Database columns, API fields, message schemas, and configuration keys all require backward-compatible migration.

8. **Set a timebox for refactoring work.** Without a timebox, refactoring scope creeps. Allocate a fixed duration, commit progress, and continue later if needed.

9. **Track metrics before and after.** Capture complexity, coverage, duplication, and change-fail rate to demonstrate ROI to stakeholders.

10. **Pair or mob on large refactoring.** Two sets of eyes catch broken assumptions. The navigator watches for scope creep while the driver focuses on the current transformation.

---

## Anti-Patterns

| Anti-Pattern                  | Problem                                         | Better Approach                        |
|-------------------------------|--------------------------------------------------|----------------------------------------|
| Big-bang rewrite              | Months of work with no incremental value         | Strangler fig pattern, incremental     |
| Refactoring without tests     | No safety net, silent behavior changes           | Write characterization tests first     |
| Mixing refactoring + features | Impossible to review, risky to revert            | Separate commits and PRs               |
| Refactoring everything at once| Scope creep, never finishes                      | Timebox, prioritize hotspots           |
| Manual rename across files    | Misses references, breaks at runtime             | Use IDE rename (F2 / Shift+F6)         |
| Long-lived refactoring branch | Merge conflicts accumulate exponentially          | Feature flags, trunk-based development |
| No rollback plan              | Breaking change discovered in production          | Expand-contract, feature flags         |
| Refactoring for aesthetics    | No measurable improvement, wastes team time       | Refactor based on metrics and pain     |

---

## Enforcement Checklist

- [ ] Test coverage for target code exceeds 80% before refactoring begins
- [ ] Characterization tests written for all untested code paths being changed
- [ ] CI pipeline runs full test suite on every commit (not just changed files)
- [ ] Feature flags configured for refactoring spanning multiple deployments
- [ ] Expand-contract migration plan documented for any schema changes
- [ ] API deprecation headers and sunset dates set before removing old endpoints
- [ ] Each refactoring commit contains exactly one structural change
- [ ] Before/after complexity and coverage metrics captured in PR description
- [ ] Rollback plan documented and tested for database and API refactoring
- [ ] Team aligned on refactoring scope and timebox before starting work
