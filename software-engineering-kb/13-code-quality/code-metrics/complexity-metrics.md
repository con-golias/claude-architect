# Complexity Metrics

| Attribute       | Value                                                                                          |
|-----------------|------------------------------------------------------------------------------------------------|
| **Domain**      | Code Quality > Metrics                                                                         |
| **Importance**  | High                                                                                           |
| **Audience**    | All Engineers, Tech Leads, Architects                                                          |
| **Last Updated**| 2026-03                                                                                        |
| **Cross-ref**   | [Quality Gates](quality-gates.md), [SonarQube](../static-analysis/sonarqube.md), [Technical Debt Measuring](../technical-debt/measuring.md) |

---

## Core Concepts

### Why Measure Complexity

Complexity metrics serve three purposes:

1. **Bug prediction** -- complex code has more defects per line. Studies show cyclomatic complexity > 10 correlates with 2-4x higher defect density.
2. **Maintenance cost** -- a function with complexity 25 takes 5-10x longer to understand and modify than one with complexity 5.
3. **Review difficulty** -- code reviewers miss more bugs in complex functions, making reviews less effective.

Measure complexity to identify hotspots, enforce thresholds in CI, and guide refactoring priorities.

### Cyclomatic Complexity (McCabe)

Count the number of independent execution paths through a function:

```text
Cyclomatic Complexity = Number of decision points + 1

Decision points: if, else if, for, while, case, catch, &&, ||, ternary ?:
```

**Threshold recommendations:**

| Complexity | Risk Level  | Action                          |
|------------|-------------|---------------------------------|
| 1-10       | Low         | Acceptable                      |
| 11-20      | Moderate    | Consider refactoring            |
| 21-50      | High        | Must refactor                   |
| 50+        | Very High   | Untestable, rewrite required    |

**High complexity example (TypeScript):**

```typescript
// Cyclomatic complexity: 12 -- TOO HIGH
function processOrder(order: Order): Result {
  if (!order.items) return { status: "error" };           // +1
  if (order.items.length === 0) return { status: "empty" }; // +1
  let total = 0;
  for (const item of order.items) {                       // +1
    if (item.type === "physical") {                       // +1
      if (item.weight > 50) {                             // +1
        total += item.price + heavyShipping(item);
      } else if (item.weight > 10) {                      // +1
        total += item.price + standardShipping(item);
      } else {                                            // +1
        total += item.price + lightShipping(item);
      }
    } else if (item.type === "digital") {                 // +1
      total += item.price;
    } else if (item.type === "subscription") {            // +1
      total += item.price * (item.months || 1);           // +1 (||)
    }
  }
  if (order.coupon && validateCoupon(order.coupon)) {     // +1, +1 (&&)
    total *= 0.9;
  }
  return { status: "ok", total };
}
```

**Refactored to low complexity:**

```typescript
// Each function has complexity 1-3
function calculateItemPrice(item: OrderItem): number {
  const shippingCalculators: Record<string, (item: OrderItem) => number> = {
    physical: calculatePhysicalPrice,
    digital: (i) => i.price,
    subscription: (i) => i.price * (i.months ?? 1),
  };
  const calculator = shippingCalculators[item.type];
  return calculator ? calculator(item) : 0;
}

function applyCoupon(total: number, coupon?: string): number {
  if (coupon && validateCoupon(coupon)) {
    return total * 0.9;
  }
  return total;
}

function processOrder(order: Order): Result {
  if (!order.items?.length) return { status: "empty" };
  const total = order.items.reduce((sum, item) => sum + calculateItemPrice(item), 0);
  return { status: "ok", total: applyCoupon(total, order.coupon) };
}
```

### Cognitive Complexity (SonarSource)

Cognitive complexity measures how hard code is for a human to understand. Unlike cyclomatic complexity, it penalizes nesting:

```text
Rules:
1. +1 for each break in linear flow (if, for, while, catch, switch, ||, &&, ternary)
2. +1 NESTING PENALTY for each level of nesting (key difference from cyclomatic)
3. No increment for: else, elif (follows existing flow), switch cases
```

**Comparison:**

```typescript
// Cyclomatic: 4, Cognitive: 7 (nesting penalty)
function example(a: boolean, b: boolean, items: number[]) {
  if (a) {                    // +1
    for (const x of items) {  // +1, nesting +1
      if (b) {                // +1, nesting +2
        process(x);
      }
    }
  }
}

// Cyclomatic: 4, Cognitive: 4 (flat structure)
function exampleFlat(a: boolean, b: boolean, items: number[]) {
  if (!a) return;              // +1
  if (!b) return;              // +1
  for (const x of items) {    // +1
    process(x);
  }
}
```

Cognitive complexity is more human-aligned -- it correctly rates flat, early-return code as simpler than deeply nested equivalent code. SonarQube uses cognitive complexity as its primary metric. Recommended threshold: <= 15 per function.

### Halstead Metrics (Brief Overview)

Halstead metrics quantify code by counting operators and operands:

| Metric        | Formula                     | Meaning                    |
|---------------|-----------------------------|----------------------------|
| Vocabulary    | n = n1 + n2                 | Distinct operators + operands |
| Length        | N = N1 + N2                 | Total operators + operands |
| Volume        | V = N * log2(n)             | Information content        |
| Difficulty    | D = (n1/2) * (N2/n2)       | Error-proneness            |
| Effort        | E = D * V                   | Time to understand         |

Halstead metrics are primarily academic. Use cyclomatic/cognitive complexity for daily engineering decisions. Halstead can be useful for estimating porting effort.

### Maintainability Index

A composite metric combining complexity, lines of code, and Halstead volume:

```text
MI = 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)

Where: HV = Halstead Volume, CC = Cyclomatic Complexity, LOC = Lines of Code
Scaled to 0-100: MI_scaled = max(0, MI * 100 / 171)
```

| MI Score | Rating         | Color (Visual Studio) |
|----------|----------------|-----------------------|
| 20-100   | Maintainable   | Green                 |
| 10-19    | Moderate        | Yellow                |
| 0-9      | Unmaintainable | Red                   |

### Coupling Metrics

**Afferent coupling (Ca):** Number of modules that depend on this module.
**Efferent coupling (Ce):** Number of modules this module depends on.

```text
Instability = Ce / (Ca + Ce)
  0.0 = maximally stable (many dependents, hard to change)
  1.0 = maximally unstable (no dependents, easy to change)
```

**Abstractness = abstract classes / total classes**

```text
Main Sequence: Abstractness + Instability = 1
Distance from Main Sequence = |A + I - 1|
  Near 0 = balanced
  Near 1 = zone of pain (concrete + stable) or zone of uselessness (abstract + unstable)
```

### Cohesion (LCOM)

**Lack of Cohesion of Methods (LCOM):** Measures how related the methods in a class are.

- LCOM = 0 -- perfectly cohesive (all methods use all instance variables).
- LCOM high -- class does too many things; split it.

```python
# Low cohesion (LCOM high) -- class handles unrelated concerns
class UserManager:
    def create_user(self, name: str) -> User: ...
    def send_email(self, to: str, body: str) -> None: ...    # Unrelated
    def generate_report(self, fmt: str) -> bytes: ...        # Unrelated
    def resize_image(self, path: str) -> None: ...           # Completely unrelated

# High cohesion (LCOM low) -- class has single responsibility
class UserRepository:
    def create(self, name: str) -> User: ...
    def find_by_id(self, id: int) -> User | None: ...
    def update(self, user: User) -> None: ...
    def delete(self, id: int) -> None: ...
```

### Code Churn as Risk Indicator

```text
Risk Score = Change Frequency x Complexity

High frequency + High complexity = HIGHEST RISK (refactor first)
High frequency + Low complexity  = Normal (frequently changed, manageable)
Low frequency  + High complexity = Moderate risk (complex but stable)
Low frequency  + Low complexity  = Lowest risk (leave alone)
```

Use git log analysis to identify churn hotspots:

```bash
# Find most frequently changed files (last 6 months)
git log --since="6 months ago" --name-only --pretty=format: | \
  sort | uniq -c | sort -rn | head -20

# Combine with complexity data to calculate risk scores
```

### Lines of Code Limitations

LOC is a misleading metric when used alone:
- 100 lines of well-structured code may be better than 50 lines of dense, unreadable code.
- Languages differ (Go is verbose, Python is terse).
- Generated code inflates counts.

Use LOC only as a supporting metric alongside complexity. Set file/function length guidelines:

| Metric            | Recommendation | Hard Limit |
|-------------------|----------------|------------|
| Function length   | <= 30 lines    | 50 lines   |
| File length       | <= 300 lines   | 500 lines  |
| Class methods     | <= 10 methods  | 20 methods |
| Parameters        | <= 4 params    | 6 params   |

### Measuring in Practice

**SonarQube dashboard:** Provides all metrics out of the box (complexity, cognitive complexity, duplications, coverage, debt ratio).

**Python (radon):**

```bash
# Install
pip install radon

# Cyclomatic complexity (A=simple to F=very complex)
radon cc src/ -a -s -n C      # Show functions rated C or worse

# Maintainability index
radon mi src/ -s -n B          # Show files rated B or worse

# Halstead metrics
radon hal src/
```

**Go (gocyclo, gocognit):**

```bash
# Cyclomatic complexity
go install github.com/fzipp/gocyclo/cmd/gocyclo@latest
gocyclo -over 10 ./...        # Show functions with complexity > 10

# Cognitive complexity
go install github.com/uudashr/gocognit/cmd/gocognit@latest
gocognit -over 15 ./...       # Show functions with cognitive > 15
```

**TypeScript/JavaScript (ESLint):**

```json
// .eslintrc.json -- complexity enforcement rules
{
  "rules": {
    "complexity": ["error", { "max": 10 }],
    "max-depth": ["error", { "max": 3 }],
    "max-lines-per-function": ["warn", { "max": 50 }],
    "max-params": ["warn", { "max": 4 }]
  }
}
```

### Visualization

- **Hotspot maps** -- overlay complexity on code churn to identify high-risk areas (CodeScene, SonarQube).
- **Dependency graphs** -- visualize module coupling (Madge for JS, pydeps for Python, go-callvis for Go).
- **Treemaps** -- show code volume proportionally, colored by metric (CodeClimate, SonarQube).

```bash
# Generate dependency graph for TypeScript
npx madge --image dependency-graph.svg --ts-config tsconfig.json src/

# Generate dependency graph for Python
pip install pydeps
pydeps src/mypackage --max-bacon=3 --cluster
```

---

## Best Practices

1. **Enforce cyclomatic complexity <= 10 per function** -- configure as ESLint `complexity` rule, radon threshold, or gocyclo limit in CI.
2. **Use cognitive complexity as primary metric** -- it aligns better with human understanding than cyclomatic complexity; enforce <= 15 per function.
3. **Combine churn with complexity for prioritization** -- refactor high-churn, high-complexity files first; low-churn complexity is lower priority.
4. **Set function length limits** -- enforce <= 50 lines per function in linter; 30 lines is the ideal target.
5. **Measure coupling at module level** -- track instability and distance from main sequence; refactor modules in the "zone of pain."
6. **Review LCOM in code review** -- split classes with low cohesion (high LCOM) into focused, single-responsibility classes.
7. **Visualize metrics in dashboards** -- display complexity trends, hotspot maps, and dependency graphs in team-accessible dashboards.
8. **Do not use LOC as a productivity metric** -- use LOC only for sizing and as supporting data alongside complexity.
9. **Automate measurement in CI** -- run complexity tools in every PR to catch regressions before merge.
10. **Track trends, not absolute values** -- focus on whether complexity is increasing or decreasing sprint-over-sprint rather than obsessing over individual scores.

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                               | Correction                                          |
|----|---------------------------------------|-------------------------------------------------------|-----------------------------------------------------|
| 1  | Measuring LOC as productivity         | Incentivizes verbose code, penalizes refactoring      | Use LOC for sizing only; track delivery outcomes    |
| 2  | Ignoring nesting depth                | Cyclomatic complexity alone misses readability impact  | Use cognitive complexity which penalizes nesting    |
| 3  | Setting complexity threshold too high | Threshold of 20+ allows unmaintainable functions       | Set threshold at 10 (cyclomatic) or 15 (cognitive)  |
| 4  | Measuring only at file level          | File-level metrics hide function-level hotspots        | Measure at function level for actionable insights   |
| 5  | Complexity tools without enforcement  | Metrics collected but never acted upon                 | Enforce thresholds as CI gate failures              |
| 6  | Refactoring by metric alone           | Refactoring low-churn complex code wastes effort       | Prioritize by churn x complexity risk score         |
| 7  | Ignoring coupling metrics             | Tightly coupled modules resist change                  | Track Ca/Ce, enforce dependency rules               |
| 8  | One-time measurement without trends   | Snapshot metrics do not reveal direction               | Track metrics over time; alert on regression        |

---

## Enforcement Checklist

- [ ] Cyclomatic complexity threshold (<=10) enforced in linter/CI for all languages.
- [ ] Cognitive complexity threshold (<=15) configured in SonarQube quality profile.
- [ ] Function length limit (<=50 lines) enforced via ESLint `max-lines-per-function`, pylint, or custom check.
- [ ] File length limit (<=500 lines) enforced in linter configuration.
- [ ] Parameter count limit (<=6) enforced via `max-params` rule.
- [ ] Complexity measurement tools installed: radon (Python), gocyclo/gocognit (Go), ESLint complexity (TS/JS).
- [ ] Churn analysis runs monthly to identify high-risk hotspots.
- [ ] Dependency graphs generated and reviewed quarterly.
- [ ] Complexity trends tracked in dashboard (SonarQube, CodeClimate, or custom).
- [ ] Quality gate includes complexity conditions for new code (see [Quality Gates](quality-gates.md)).
