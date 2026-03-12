# CI/CD Test Integration

| Attribute      | Value                                                                |
|----------------|----------------------------------------------------------------------|
| **Domain**     | Testing > Test Automation                                            |
| **Importance** | Critical                                                             |
| **Last Updated** | 2026-03-10                                                         |
| **Cross-ref**  | `07-database/migrations.md`, `08-security/application-security/sast.md`, `09-performance/load-testing.md` |

---

## Core Concepts

### Pipeline Stages

Structure every CI/CD pipeline around these ordered gate stages.

```
pre-commit -> commit -> integration -> acceptance -> performance -> security -> release
```

| Stage          | Scope                        | Trigger             | Typical Duration |
|----------------|------------------------------|----------------------|------------------|
| Pre-commit     | Linting, formatting, types   | `git commit`         | < 30 s           |
| Commit         | Unit tests, build            | Push / PR open       | 1-5 min          |
| Integration    | Service + DB tests           | PR update            | 5-15 min         |
| Acceptance     | E2E, contract tests          | PR ready for review  | 10-30 min        |
| Performance    | Load, benchmark regressions  | Merge to main        | 15-60 min        |
| Security       | SAST, DAST, dependency scan  | Merge to main        | 5-20 min         |
| Release        | Smoke tests in staging       | Release candidate    | 5-10 min         |

### Test Parallelization

- **Sharding**: split a test suite into N chunks, run each on a separate runner.
- **Worker parallelism**: run tests concurrently within a single runner.
- **Smart sharding**: use historical timing data to balance shard durations.

### Selective Test Execution

Run only tests affected by the current changeset (50-90 % cost reduction).

- **Nx**: `nx affected --target=test --base=main`
- **Turborepo**: `turbo run test --filter=...[origin/main]`
- **Jest**: `jest --changedSince=main`
- **Go**: build tags or directory-scoped `go test ./changed/...`

### Test Reporting

- **JUnit XML**: universal format consumed by GitHub Actions, GitLab, Jenkins.
- **Allure**: rich HTML reports with history and trend charts.
- **Custom reporters**: structured JSON for observability platforms.

### Cost Optimization

| Tier     | When to Run        | Examples                          |
|----------|--------------------|-----------------------------------|
| Critical | Every push         | Unit tests, lint, type check      |
| Standard | PR update          | Integration, contract tests       |
| Extended | Merge to main      | E2E, performance, security scans  |
| Nightly  | Scheduled (cron)   | Full matrix, soak tests, fuzzing  |

---

## Code Examples

### GitHub Actions Workflow with Test Matrix and Parallel Jobs (YAML)

```yaml
# .github/workflows/test.yml
name: Test Pipeline
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
concurrency:
  group: test-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx jest --shard=${{ matrix.shard }}/4 --ci --reporters=default --reporters=jest-junit
        env:
          JEST_JUNIT_OUTPUT_DIR: ./reports
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: junit-unit-${{ matrix.shard }}
          path: ./reports/*.xml

  integration-tests:
    needs: [lint-and-typecheck]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: testdb, POSTGRES_USER: test, POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
        options: --health-cmd="pg_isready" --health-interval=10s --health-timeout=5s --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run test:integration -- --ci
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb

  e2e-tests:
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --shard=${{ matrix.shard }}/3
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
```

### GitLab CI with Test Stages and Artifacts (YAML)

```yaml
# .gitlab-ci.yml
stages: [commit, integration, acceptance, performance]
variables:
  POSTGRES_DB: testdb
  POSTGRES_USER: test
  POSTGRES_PASSWORD: test

.go-cache: &go-cache
  cache:
    key: go-mod-${CI_COMMIT_REF_SLUG}
    paths: [.go/pkg/mod/]

unit-tests:
  stage: commit
  image: golang:1.22
  <<: *go-cache
  script:
    - go test -race -count=1 -coverprofile=coverage.out ./...
    - go tool cover -func=coverage.out
  artifacts:
    reports:
      junit: report.xml
      coverage_report: { coverage_format: cobertura, path: coverage.xml }
    expire_in: 7 days
  parallel: 4

integration-tests:
  stage: integration
  image: golang:1.22
  services: [postgres:16]
  script:
    - go test -tags=integration -race -count=1 ./...
  artifacts:
    reports: { junit: report.xml }
    expire_in: 7 days

e2e-tests:
  stage: acceptance
  image: mcr.microsoft.com/playwright:v1.42.0-jammy
  script: [npm ci, npx playwright test]
  artifacts:
    when: always
    paths: [playwright-report/]
    expire_in: 14 days
  rules:
    - if: $CI_MERGE_REQUEST_ID
    - if: $CI_COMMIT_BRANCH == "main"

performance-tests:
  stage: performance
  script: [k6 run --out json=results.json load-test.js]
  artifacts: { paths: [results.json], expire_in: 30 days }
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

### Test Reporter Integration (TypeScript)

```typescript
// reporters/junit-reporter.ts
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { create } from "xmlbuilder2";

interface TestResult {
  name: string;
  suiteName: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  errorMessage?: string;
  errorStack?: string;
}

export function generateJUnitXML(results: TestResult[], outputDir: string): string {
  const suites = groupBy(results, (r) => r.suiteName);
  const root = create({ version: "1.0", encoding: "UTF-8" });
  const testsuites = root.ele("testsuites", {
    tests: results.length,
    failures: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    time: results.reduce((sum, r) => sum + r.duration, 0) / 1000,
  });

  for (const [suiteName, suiteResults] of Object.entries(suites)) {
    const suite = testsuites.ele("testsuite", {
      name: suiteName,
      tests: suiteResults.length,
      failures: suiteResults.filter((r) => r.status === "failed").length,
      time: suiteResults.reduce((sum, r) => sum + r.duration, 0) / 1000,
    });
    for (const result of suiteResults) {
      const testcase = suite.ele("testcase", {
        name: result.name,
        classname: suiteName,
        time: result.duration / 1000,
      });
      if (result.status === "failed") {
        testcase.ele("failure", {
          message: result.errorMessage ?? "Test failed",
        }).txt(result.errorStack ?? "");
      }
      if (result.status === "skipped") {
        testcase.ele("skipped");
      }
    }
  }

  const xml = root.end({ prettyPrint: true });
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, "junit-results.xml");
  writeFileSync(outputPath, xml);
  return outputPath;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}
```

### CI Test Script with Race Detection and Coverage (Go)

```go
package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

type CITestConfig struct {
	Packages       []string
	CoverThreshold float64
	EnableRace     bool
	Timeout        time.Duration
	OutputDir      string
}

func runCITests(cfg CITestConfig) error {
	args := []string{"test"}
	if cfg.EnableRace {
		args = append(args, "-race")
	}
	args = append(args, "-count=1", "-timeout", cfg.Timeout.String(),
		"-coverprofile="+cfg.OutputDir+"/coverage.out", "-covermode=atomic", "-v")
	args = append(args, cfg.Packages...)

	cmd := exec.Command("go", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(), "CGO_ENABLED=1", "GOFLAGS=-mod=readonly")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("tests failed: %w", err)
	}

	coverage, err := parseCoverageProfile(cfg.OutputDir + "/coverage.out")
	if err != nil {
		return fmt.Errorf("parse coverage: %w", err)
	}
	fmt.Printf("Total coverage: %.1f%%\n", coverage)
	if coverage < cfg.CoverThreshold {
		return fmt.Errorf("coverage %.1f%% below threshold %.1f%%", coverage, cfg.CoverThreshold)
	}
	return nil
}

func parseCoverageProfile(path string) (float64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	var total, covered int
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "mode:") || line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) >= 3 {
			var stmts, count int
			fmt.Sscanf(parts[1], "%d", &stmts)
			fmt.Sscanf(parts[2], "%d", &count)
			total += stmts
			if count > 0 {
				covered += stmts
			}
		}
	}
	if total == 0 {
		return 0, nil
	}
	return float64(covered) / float64(total) * 100, nil
}

func main() {
	cfg := CITestConfig{
		Packages: []string{"./..."}, CoverThreshold: 80.0,
		EnableRace: true, Timeout: 10 * time.Minute,
		OutputDir: os.Getenv("CI_OUTPUT_DIR"),
	}
	if cfg.OutputDir == "" {
		cfg.OutputDir = "./test-results"
	}
	os.MkdirAll(cfg.OutputDir, 0o755)
	if err := runCITests(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "CI test failure: %v\n", err)
		os.Exit(1)
	}
}
```

---

## 10 Best Practices

1. **Fail fast**: place lint, type check, and unit tests first so failures surface in under 5 min.
2. **Parallelize aggressively**: shard across machines and use worker parallelism. Target < 15 min wall time.
3. **Use selective test execution** in monorepos. Run only affected packages on PRs; full suite on main.
4. **Pin exact versions** of CI images, tools, and browser binaries to prevent upstream-induced failures.
5. **Produce machine-readable reports** (JUnit XML) in every test job for dashboard aggregation.
6. **Set hard timeouts** on every CI job. Hanging tests must not block the pipeline indefinitely.
7. **Cache dependencies aggressively**: `node_modules`, Go module cache, and build artifacts.
8. **Enforce branch protection**: require all critical CI jobs to pass before merge.
9. **Tier the suite by cost**: critical on every push, extended on merge, nightly for full matrix.
10. **Monitor CI metrics**: track p50/p95 pipeline duration, flaky rate, and cost per pipeline.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Running the full test suite on every commit | Slow feedback, wasted compute | Implement selective execution and tiered scheduling |
| No timeout on CI jobs | Hung tests block pipeline for hours | Set explicit `timeout-minutes` on every job |
| Using `latest` tags for CI images | Non-deterministic failures from upstream changes | Pin to digest or exact version tag |
| Ignoring flaky tests instead of quarantining | Developers stop trusting CI, merge broken code | Quarantine immediately, track and fix within SLA |
| Single-threaded test execution | Duration grows linearly with test count | Shard across machines, enable parallel workers |
| No artifact retention for failed tests | Debugging requires re-running the pipeline | Upload logs, screenshots, and reports on failure |
| Allowing merge with failing optional checks | Broken code enters main | Make all quality checks required |
| Duplicating pipeline config across repos | Drift and maintenance burden | Extract shared CI templates or reusable workflows |

---

## Enforcement Checklist

- [ ] Pipeline stages are ordered: pre-commit, commit, integration, acceptance, performance, security, release
- [ ] Every CI job has an explicit timeout configured
- [ ] Test suites are sharded across at least 2 runners for suites > 5 min
- [ ] Selective test execution is configured for monorepo workspaces
- [ ] All test jobs produce JUnit XML or equivalent machine-readable reports
- [ ] Branch protection requires all critical CI jobs to pass before merge
- [ ] CI runner images are pinned to exact versions, not `latest`
- [ ] Dependency and build caches are configured and verified working
- [ ] Pipeline duration p95 is monitored with alerts on regression
- [ ] Cost-tiered scheduling is implemented (per-push vs. nightly vs. weekly)
- [ ] Flaky test quarantine process is documented and enforced
- [ ] CI secrets are stored in the platform secret manager, never in YAML
