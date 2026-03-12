# Code Coverage and Quality Metrics

| Attribute      | Value                                                                |
|----------------|----------------------------------------------------------------------|
| **Domain**     | Testing > Test Automation                                            |
| **Importance** | High                                                                 |
| **Last Updated** | 2026-03-10                                                         |
| **Cross-ref**  | `11-testing/advanced-testing/mutation-testing.md`, `11-testing/test-automation/ci-integration.md` |

---

## Core Concepts

### Coverage Types

| Type          | What It Measures                                   | Blind Spots                           |
|---------------|----------------------------------------------------|---------------------------------------|
| **Line**      | Whether each executable line was reached           | Misses untested branches on same line |
| **Branch**    | Whether each branch (if/else, switch) was taken    | Misses compound condition paths       |
| **Function**  | Whether each function was invoked at least once    | Says nothing about argument edge cases|
| **Statement** | Whether each statement was executed                | Similar to line, slightly more granular|
| **Path**      | Whether each unique execution path was traversed   | Combinatorial explosion in complex code|
| **Condition** | Whether each boolean sub-expression was true/false | Most thorough, rarely measured        |

**Branch coverage** is the recommended default. It catches more logic errors than
line coverage without the impracticality of full path coverage.

### Coverage Tools

| Language    | Tool                     | Command                                  |
|-------------|--------------------------|------------------------------------------|
| TypeScript  | c8 / istanbul via Vitest | `vitest run --coverage`                  |
| Python      | coverage.py / pytest-cov | `pytest --cov=src --cov-branch`          |
| Go          | built-in                 | `go test -cover -coverprofile=cover.out` |
| Java        | JaCoCo                   | Gradle: `jacocoTestReport`               |

### Coverage Is Necessary but Not Sufficient

100 % line coverage does not guarantee correctness. Coverage tells you what code
was *executed*, not whether *assertions validated the behavior*. Combine with:

- **Mutation testing**: verify tests detect injected faults.
- **Assertion density**: ratio of assertions to lines of test code.
- **Diff coverage**: ensure new and changed code is tested.

### Ratcheting Strategy

Never allow coverage to decrease:

1. Record the current coverage percentage as the threshold.
2. Fail CI if coverage drops below that threshold.
3. When coverage increases, update the threshold automatically.
4. Automate via a post-merge script or coverage tool config.

### Diff Coverage

Measure coverage of only the lines changed in the current PR.

- **diff-cover** (Python): `diff-cover coverage.xml --compare-branch=main`
- **Codecov**: automatic diff coverage comments on PRs.
- **SonarQube**: "New Code" metrics scoped to the changeset.

Set a diff coverage threshold of 80-90 %.

---

## Code Examples

### Vitest Coverage Configuration with c8 and Thresholds (TypeScript)

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      enabled: true,
      reporter: ["text", "json", "html", "lcov", "cobertura"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
      watermarks: {
        lines: [70, 85],
        branches: [65, 80],
        functions: [70, 85],
        statements: [70, 85],
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/index.ts",
        "src/**/*.d.ts",
        "src/test-utils/**",
        "src/generated/**",
      ],
    },
  },
});
```

```typescript
// scripts/coverage-ratchet.ts
import { readFileSync, writeFileSync } from "fs";

interface CoverageSummary {
  total: {
    lines: { pct: number };
    branches: { pct: number };
    functions: { pct: number };
    statements: { pct: number };
  };
}

interface Thresholds {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

/** Update thresholds if coverage increased. Run after merge to main. */
function ratchetCoverage(coveragePath: string, configPath: string): void {
  const summary: CoverageSummary = JSON.parse(readFileSync(coveragePath, "utf-8"));
  const current = loadThresholds(configPath);
  const updated: Thresholds = {
    lines: Math.max(current.lines, Math.floor(summary.total.lines.pct)),
    branches: Math.max(current.branches, Math.floor(summary.total.branches.pct)),
    functions: Math.max(current.functions, Math.floor(summary.total.functions.pct)),
    statements: Math.max(current.statements, Math.floor(summary.total.statements.pct)),
  };

  if ((Object.keys(updated) as (keyof Thresholds)[]).some((k) => updated[k] > current[k])) {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    raw.thresholds = updated;
    writeFileSync(configPath, JSON.stringify(raw, null, 2) + "\n");
    console.log("Coverage thresholds ratcheted up:", updated);
  } else {
    console.log("No threshold increase needed.");
  }
}

function loadThresholds(configPath: string): Thresholds {
  return JSON.parse(readFileSync(configPath, "utf-8")).thresholds;
}
```

### pytest-cov with Branch Coverage and HTML Reports (Python)

```python
# pyproject.toml configuration (shown inline for reference):
# [tool.pytest.ini_options]
# addopts = "--cov=src --cov-branch --cov-report=term-missing --cov-report=html --cov-report=xml"
# [tool.coverage.run]
# branch = true
# source = ["src"]
# omit = ["src/generated/*", "src/migrations/*"]
# [tool.coverage.report]
# fail_under = 80
# show_missing = true
# exclude_lines = ["pragma: no cover", "if TYPE_CHECKING:", "raise NotImplementedError"]

# scripts/coverage_gate.py
"""Enforce coverage thresholds and diff coverage in CI."""
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class CoverageResult:
    total_lines: int
    covered_lines: int
    total_branches: int
    covered_branches: int

    @property
    def line_rate(self) -> float:
        return (self.covered_lines / self.total_lines * 100) if self.total_lines else 100.0

    @property
    def branch_rate(self) -> float:
        return (self.covered_branches / self.total_branches * 100) if self.total_branches else 100.0


def parse_coverage_json(path: Path) -> CoverageResult:
    totals = json.loads(path.read_text())["totals"]
    return CoverageResult(
        total_lines=totals["num_statements"],
        covered_lines=totals["covered_lines"],
        total_branches=totals["num_branches"],
        covered_branches=totals["covered_branches"],
    )


def run_diff_coverage(coverage_xml: Path, compare_branch: str = "origin/main", threshold: float = 85.0) -> bool:
    result = subprocess.run(
        ["diff-cover", str(coverage_xml), f"--compare-branch={compare_branch}",
         f"--fail-under={threshold}", "--html-report=diff-coverage.html"],
        capture_output=True, text=True,
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"Diff coverage below {threshold}%", file=sys.stderr)
        return False
    return True


def enforce_coverage_gate(path: Path, line_min: float = 80.0, branch_min: float = 75.0) -> bool:
    r = parse_coverage_json(path)
    print(f"Line coverage:   {r.line_rate:.1f}% (threshold: {line_min}%)")
    print(f"Branch coverage: {r.branch_rate:.1f}% (threshold: {branch_min}%)")
    ok = True
    if r.line_rate < line_min:
        print(f"FAIL: line {r.line_rate:.1f}% < {line_min}%", file=sys.stderr)
        ok = False
    if r.branch_rate < branch_min:
        print(f"FAIL: branch {r.branch_rate:.1f}% < {branch_min}%", file=sys.stderr)
        ok = False
    return ok


if __name__ == "__main__":
    ok = enforce_coverage_gate(Path("coverage.json"))
    ok = run_diff_coverage(Path("coverage.xml")) and ok
    sys.exit(0 if ok else 1)
```

### go test -coverprofile with Visualization (Go)

```go
package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

type CoverageProfile struct {
	TotalStmts   int
	CoveredStmts int
	ByPackage    map[string]float64
}

func (c CoverageProfile) Rate() float64 {
	if c.TotalStmts == 0 {
		return 0
	}
	return float64(c.CoveredStmts) / float64(c.TotalStmts) * 100
}

func RunCoverageCheck(packages []string, threshold float64) error {
	profilePath := "coverage.out"
	args := append([]string{"test", "-race", "-count=1", "-covermode=atomic",
		"-coverprofile=" + profilePath}, packages...)

	cmd := exec.Command("go", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("go test failed: %w", err)
	}

	profile, err := ParseProfile(profilePath)
	if err != nil {
		return fmt.Errorf("parse profile: %w", err)
	}

	fmt.Println("\n--- Coverage by Package ---")
	for pkg, rate := range profile.ByPackage {
		status := "OK"
		if rate < threshold {
			status = "BELOW THRESHOLD"
		}
		fmt.Printf("  %-55s %5.1f%%  %s\n", pkg, rate, status)
	}
	fmt.Printf("\nTotal: %.1f%% (threshold: %.1f%%)\n", profile.Rate(), threshold)

	if profile.Rate() < threshold {
		return fmt.Errorf("coverage %.1f%% below threshold %.1f%%", profile.Rate(), threshold)
	}

	exec.Command("go", "tool", "cover", "-html="+profilePath, "-o=coverage.html").Run()
	return nil
}

func ParseProfile(path string) (CoverageProfile, error) {
	f, err := os.Open(path)
	if err != nil {
		return CoverageProfile{}, err
	}
	defer f.Close()

	p := CoverageProfile{ByPackage: make(map[string]float64)}
	pkgS := make(map[string]int)
	pkgC := make(map[string]int)

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "mode:") || line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}
		pkg := parts[0][:strings.LastIndex(parts[0][:strings.Index(parts[0], ":")], "/")]
		stmts, _ := strconv.Atoi(parts[1])
		count, _ := strconv.Atoi(parts[2])
		p.TotalStmts += stmts
		pkgS[pkg] += stmts
		if count > 0 {
			p.CoveredStmts += stmts
			pkgC[pkg] += stmts
		}
	}
	for pkg, total := range pkgS {
		if total > 0 {
			p.ByPackage[pkg] = float64(pkgC[pkg]) / float64(total) * 100
		}
	}
	return p, nil
}

func main() {
	threshold := 80.0
	if v := os.Getenv("COVERAGE_THRESHOLD"); v != "" {
		if t, err := strconv.ParseFloat(v, 64); err == nil {
			threshold = t
		}
	}
	if err := RunCoverageCheck([]string{"./..."}, threshold); err != nil {
		fmt.Fprintf(os.Stderr, "Coverage check failed: %v\n", err)
		os.Exit(1)
	}
}
```

---

## 10 Best Practices

1. **Measure branch coverage, not just line coverage.** Branch coverage exposes untested conditional paths that line coverage silently misses.
2. **Implement a ratchet**: never let coverage decrease. Automate threshold updates after each merge to main.
3. **Enforce diff coverage on PRs**: require 80-90 % coverage on changed lines. More actionable than total coverage.
4. **Exclude generated code, type definitions, and barrel files** from coverage metrics to reduce noise.
5. **Combine coverage with mutation testing** to verify tests detect faults, not just execute paths.
6. **Treat coverage as a team metric, not an individual metric.** Focus on trend direction, not blame.
7. **Visualize coverage in CI comments and dashboards.** Make uncovered lines visible in the PR diff.
8. **Do not set 100 % as the target.** Diminishing returns begin around 85-90 %. Invest the rest in integration and mutation tests.
9. **Review uncovered lines manually.** Uncovered error handlers may indicate missing edge-case tests.
10. **Track assertion density** alongside coverage. High coverage with low assertions means code is exercised but not verified.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Chasing 100 % coverage as mandatory target | Brittle, low-value tests written only to satisfy the metric | Set pragmatic thresholds (80-85 %) and invest in mutation testing |
| Writing tests without assertions to boost coverage | Zero bugs caught; false confidence | Enforce minimum assertion counts; use mutation testing |
| Excluding difficult-to-test code to inflate numbers | Critical error paths remain untested | Review exclusion lists quarterly; justify every exclusion |
| Measuring only total coverage, ignoring diff coverage | New code ships untested while legacy props up the number | Enforce diff coverage thresholds on every PR |
| Using coverage as a performance review metric | Developers game the metric with meaningless tests | Use coverage as a team health indicator only |
| Failing builds without ratchet automation | Manual thresholds lag, causing false failures | Automate ratchet updates on merge |
| Ignoring branch coverage, measuring only lines | Compound conditionals appear covered when only one path tested | Configure tools for branch coverage explicitly |
| Collecting coverage but never reviewing uncovered lines | Reports exist but nobody acts on gaps | Add coverage reports to PR review workflow |

---

## Enforcement Checklist

- [ ] Branch coverage is the primary metric, configured in the test runner
- [ ] Coverage thresholds are enforced in CI and block merges on regression
- [ ] A ratchet mechanism prevents coverage from ever decreasing
- [ ] Diff coverage is measured on every PR with a threshold of at least 80 %
- [ ] Generated code, type stubs, and barrel files are excluded from metrics
- [ ] Coverage reports (HTML and XML) are published as CI artifacts
- [ ] Coverage trends are visible on a team dashboard
- [ ] Mutation testing supplements coverage for critical business logic
- [ ] `pragma: no cover` annotations require a justifying comment
- [ ] Quarterly review of exclusion lists is scheduled and tracked
