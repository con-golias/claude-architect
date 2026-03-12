# Measuring Technical Debt

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | Code Quality > Technical Debt                                        |
| Importance     | High                                                                 |
| Audience       | Tech leads, engineering managers, all developers                     |
| Prerequisites  | CI pipeline, code analysis tools, version control history            |
| Cross-ref      | [Managing](managing.md), [Prevention](prevention.md), [Complexity Metrics](../code-metrics/complexity-metrics.md) |

---

## Core Concepts

### The Technical Debt Metaphor

Ward Cunningham's original metaphor (1992): shipping imperfect code is like taking on financial debt. The "interest" is the extra effort required for every future change. The key insight: debt is not inherently bad -- deliberate, managed debt accelerates delivery. Unmeasured, invisible debt is what kills projects.

**Modern usage extends beyond Cunningham's intent.** Today "technical debt" covers code quality, architecture, dependencies, infrastructure, tests, and documentation. Measuring each category requires different tools.

### SQALE Methodology

Software Quality Assessment based on Lifecycle Expectations. Maps code issues to remediation effort using a quality model.

```
SQALE Quality Model (simplified):
├── Reliability    → Bugs, error handling gaps
├── Security       → Vulnerabilities, unsafe patterns
├── Maintainability → Code smells, complexity
├── Efficiency     → Performance anti-patterns
├── Changeability  → Coupling, cohesion issues
├── Testability    → Untestable code structures
└── Portability    → Platform-specific code
```

**SQALE Rating:** Maps debt ratio to letter grades (A-E). Debt ratio = remediation cost / development cost.

| Rating | Debt Ratio  | Meaning                    |
|--------|-------------|----------------------------|
| A      | 0-5%        | Excellent, minimal debt    |
| B      | 5-10%       | Good, manageable debt      |
| C      | 10-20%      | Fair, needs attention       |
| D      | 20-50%      | Poor, significant burden   |
| E      | > 50%       | Critical, urgent action    |

### SonarQube Technical Debt Calculation

SonarQube calculates debt as estimated remediation effort in time units.

```
Debt = Σ (issue_remediation_time)

Example calculation for a TypeScript project:
- 12 code smells × 15 min avg = 180 min (3 hours)
- 4 bugs × 30 min avg = 120 min (2 hours)
- 2 vulnerabilities × 45 min avg = 90 min (1.5 hours)
Total debt: 6.5 hours

Debt ratio = remediation_cost / development_cost
           = 6.5 hours / 500 hours = 1.3% → Rating: A
```

```bash
# Retrieve SonarQube debt metrics via API
curl -s "https://sonar.example.com/api/measures/component?component=my-project\
&metricKeys=sqale_index,sqale_debt_ratio,sqale_rating" | jq '.component.measures'
```

### CodeScene: Behavioral Code Analysis

CodeScene analyzes version control history to find hotspots -- files that change frequently AND have high complexity. These are the highest-risk debt targets.

```
Hotspot Score = Change Frequency × Complexity

High frequency + High complexity = CRITICAL HOTSPOT (refactor first)
High frequency + Low complexity  = Active but healthy
Low frequency  + High complexity = Sleeping risk
Low frequency  + Low complexity  = Stable, leave alone
```

**Temporal coupling:** Files that always change together indicate hidden dependencies. If `billing.ts` and `invoice.ts` change in 80% of the same commits, they are temporally coupled -- a sign of architectural debt.

### Code Churn Metrics

Track files that change most frequently -- they carry the highest maintenance cost.

```bash
# Git: Find files with most commits in last 6 months
git log --since="6 months ago" --name-only --pretty=format: \
  | sort | uniq -c | sort -rn | head -20

# Git: Find files with most lines changed (churn)
git log --since="6 months ago" --numstat --pretty=format: \
  | awk '{adds[$3]+=($1+0); dels[$3]+=($2+0)} END {for(f in adds) print adds[f]+dels[f], f}' \
  | sort -rn | head -20
```

```python
# Python: Analyze code churn programmatically
import subprocess
import json
from collections import Counter

def get_churn_report(since: str = "6 months ago") -> list[dict]:
    result = subprocess.run(
        ["git", "log", f"--since={since}", "--name-only", "--pretty=format:"],
        capture_output=True, text=True,
    )
    files = [f for f in result.stdout.strip().split("\n") if f]
    counts = Counter(files)
    return [{"file": f, "changes": c} for f, c in counts.most_common(20)]
```

### Code Age and Freshness

| Category        | Description                        | Risk Level | Action                        |
|-----------------|------------------------------------|------------|-------------------------------|
| Ancient + stable| Old code, rarely touched           | Low        | Leave alone unless blocking   |
| Ancient + active| Old code, frequently modified      | HIGH       | Priority refactoring target   |
| Fresh + stable  | Recently written, rarely changed   | Low        | Healthy code                  |
| Fresh + active  | Recently written, still evolving   | Medium     | Normal development, monitor   |

### Dependency Health

```bash
# npm: Check outdated dependencies
npm outdated --long

# npm: Audit for vulnerabilities
npm audit --json | jq '{total: .metadata.totalDependencies,
  vulnerabilities: .metadata.vulnerabilities}'

# Python: Check outdated
pip list --outdated --format=json

# Go: Check for updates
go list -m -u all
```

**Dependency debt score:**
```
Score = (outdated_deps × 1) + (major_behind × 5) + (vulnerabilities × 10) + (deprecated × 15)
```

### Test Debt

Measure gaps in test coverage that increase risk.

```typescript
// Script to identify test debt hotspots
interface TestDebtItem {
  file: string;
  coverage: number;
  changeFrequency: number;
  risk: number; // coverage_gap × change_frequency
}

function calculateTestDebt(
  coverageReport: Record<string, number>,
  churnReport: Record<string, number>,
): TestDebtItem[] {
  return Object.entries(coverageReport)
    .map(([file, coverage]) => ({
      file,
      coverage,
      changeFrequency: churnReport[file] ?? 0,
      risk: (100 - coverage) * (churnReport[file] ?? 0),
    }))
    .sort((a, b) => b.risk - a.risk);
}
// Files with LOW coverage + HIGH churn = highest test debt
```

### Architecture Debt

Detect structural problems that compound over time.

```typescript
// Circular dependency detection (conceptual)
// Tools: madge (JS/TS), deptry (Python), go vet (Go)

// Using madge for JavaScript/TypeScript
// npx madge --circular --extensions ts src/

// Layer violation detection
// Define allowed dependencies:
// presentation → application → domain → infrastructure
// presentation must NOT import infrastructure directly
```

```bash
# Detect circular dependencies
npx madge --circular --extensions ts,tsx src/

# Visualize dependency graph
npx madge --image graph.svg --extensions ts src/
```

### Measuring Tools Comparison

| Tool         | Debt Calc | Hotspots | History | Languages         | Pricing         |
|--------------|-----------|----------|---------|-------------------|-----------------|
| SonarQube    | Yes       | No       | No      | 30+               | Free (CE) / Paid|
| CodeScene    | Yes       | Yes      | Yes     | 30+               | Paid            |
| CodeClimate  | Yes       | No       | Limited | 10+               | Free (OSS) / Paid|
| Codacy       | Yes       | No       | Limited | 40+               | Free tier / Paid|
| SonarCloud   | Yes       | No       | No      | 30+               | Free (OSS)      |

### Creating a Tech Debt Register

Track debt items systematically, not just in developers' heads.

```yaml
# tech-debt-register.yml
items:
  - id: TD-001
    title: "Billing module lacks test coverage"
    category: test-debt
    description: "billing/ has 23% coverage, changed 47 times in 6 months"
    impact: high         # How much it slows the team
    effort: medium       # Estimated remediation effort (S/M/L/XL)
    priority: 1          # Calculated from impact and effort
    owner: billing-team
    created: "2025-01-15"
    target_date: "2025-Q2"
    status: planned

  - id: TD-002
    title: "Circular dependency between orders and inventory"
    category: architecture-debt
    description: "Bidirectional coupling prevents independent deployment"
    impact: high
    effort: large
    priority: 2
    owner: platform-team
    created: "2025-02-01"
    target_date: "2025-Q3"
    status: in-progress
```

### Debt Scoring Model

Prioritize debt items using a scoring formula.

```
Priority Score = (Impact × Probability) / Effort

Impact (1-5):      How much this debt slows the team or risks incidents
Probability (1-5): How likely this debt will cause problems soon
Effort (1-5):      How much work to remediate (inverse: 1 = large, 5 = trivial)

Example:
  Billing test debt:   (5 × 4) / 3 = 6.7  → HIGH priority
  Old unused service:  (2 × 1) / 2 = 1.0  → LOW priority
  Vulnerable dep:      (5 × 5) / 5 = 5.0  → MEDIUM-HIGH priority
```

### Trend Tracking

Track debt over time to see if it is growing or shrinking.

```typescript
// Weekly debt snapshot for trend dashboard
interface DebtSnapshot {
  date: string;
  sonarDebtHours: number;
  sonarDebtRatio: number;
  outdatedDeps: number;
  coveragePercent: number;
  circularDeps: number;
  avgCyclomaticComplexity: number;
}

// Store weekly snapshots, visualize trends
// Alert if debt ratio increases > 2% in a single sprint
// Celebrate if debt ratio decreases for 3 consecutive sprints
```

```bash
# Automated weekly debt snapshot in CI
sonar-scanner && \
curl -s "$SONAR_URL/api/measures/component?component=$PROJECT\
&metricKeys=sqale_index,sqale_debt_ratio,coverage,duplicated_lines_density" \
  | jq '{date: now|todate, metrics: .component.measures}' >> debt-history.jsonl
```

---

## Best Practices

1. **Measure debt at multiple levels: code, architecture, dependencies, tests, and documentation.** A single metric like SonarQube debt ratio misses architectural and dependency debt entirely.

2. **Combine static analysis with behavioral analysis.** SonarQube finds code issues; CodeScene-style hotspot analysis reveals which issues actually matter based on change frequency.

3. **Track debt trends weekly, not just point-in-time snapshots.** A debt ratio of 8% is fine if it was 15% last quarter. The same 8% is alarming if it was 3%.

4. **Focus remediation on hotspots: high churn + high complexity files.** These deliver the highest ROI because every future change benefits from the cleanup.

5. **Maintain a formal tech debt register, not just JIRA tickets.** A register provides visibility into total debt load, categories, and trends that individual tickets cannot show.

6. **Automate debt measurement in CI and publish dashboards.** Manual debt assessment is infrequent and inconsistent. Automated weekly snapshots build the trend data needed for decisions.

7. **Use the debt ratio (remediation cost / development cost) to communicate with stakeholders.** "We have 340 hours of debt" means nothing to a VP. "Our debt ratio is 15%, meaning we spend 15% extra effort on every change" resonates.

8. **Score and prioritize debt items using impact, probability, and effort.** Not all debt is equal. A high-impact, low-effort item should be fixed before a low-impact, high-effort one.

9. **Include dependency health in debt measurement.** Outdated dependencies accumulate silently and become exponentially harder to update over time. Track major version drift.

10. **Review the debt register quarterly with engineering leadership.** Debt measurement is only useful if it informs decisions. Quarterly reviews connect measurement to planning.

---

## Anti-Patterns

| Anti-Pattern                      | Problem                                            | Better Approach                         |
|-----------------------------------|----------------------------------------------------|-----------------------------------------|
| Measuring only SonarQube debt     | Misses architecture, deps, tests, docs             | Multi-dimensional measurement           |
| Point-in-time measurement only    | No trend data, cannot show progress                | Weekly automated snapshots              |
| Counting issues without weighting | 100 minor smells ranked above 1 critical bug       | Score by impact × probability / effort  |
| Measuring but never acting        | Dashboard exists but debt keeps growing             | Tie measurement to sprint planning      |
| Per-line metrics without context  | High complexity in test helpers is not real debt    | Focus on production code hotspots       |
| Manual debt tracking              | Incomplete, inconsistent, quickly outdated          | Automated CI-based measurement          |
| Ignoring dependency debt          | Major version drift compounds silently              | Track outdated deps as debt metric      |
| Using debt metrics as blame tool  | Erodes trust, developers game the metrics           | Team-level metrics, blameless culture   |

---

## Enforcement Checklist

- [ ] SonarQube (or equivalent) configured with quality gate including debt ratio threshold
- [ ] Weekly automated debt snapshots stored and visualized as trend dashboard
- [ ] Hotspot analysis (churn x complexity) run at least monthly
- [ ] Tech debt register maintained with all items categorized, scored, and assigned
- [ ] Dependency health check (outdated, vulnerable, deprecated) run in CI
- [ ] Test debt analysis (low coverage + high churn files) reviewed monthly
- [ ] Circular dependency check runs in CI and blocks new cycles
- [ ] Debt ratio communicated to stakeholders in business-impact language
- [ ] Quarterly debt review meeting scheduled with engineering leadership
- [ ] Debt trend alerts configured: notify when ratio increases above threshold
