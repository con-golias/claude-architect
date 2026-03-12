# CodeQL Semantic Code Analysis

| Attribute       | Value                                                                                          |
|-----------------|------------------------------------------------------------------------------------------------|
| **Domain**      | Code Quality > Static Analysis                                                                 |
| **Importance**  | Medium                                                                                         |
| **Audience**    | Backend, Security, Platform Engineers                                                          |
| **Last Updated**| 2026-03                                                                                        |
| **Cross-ref**   | [SonarQube](sonarqube.md), [Type Checking](type-checking.md), [08-security SAST](../../08-security/security-testing/sast.md) |

---

## Core Concepts

### What CodeQL Does Differently

CodeQL treats code as data. It builds a relational database from source code, then runs queries against that database using a declarative query language. This enables detection of deep semantic bugs that traditional linters cannot find:

| Tool Type          | Finds                                    | Misses                                |
|--------------------|------------------------------------------|---------------------------------------|
| **Linters**        | Style violations, simple patterns         | Cross-function data flow, logic errors|
| **Type checkers**  | Type mismatches, null safety (with strict)| Business logic bugs, resource leaks   |
| **CodeQL**         | Data flow bugs, taint tracking, logic errors, resource leaks, null dereference chains | Style issues (not its purpose) |

> **Note:** For security-focused CodeQL queries (SQL injection, XSS, SSRF), see [08-security SAST](../../08-security/security-testing/sast.md). This file focuses on code quality queries.

### CodeQL Database Creation

```text
Source Code --> CodeQL Extractor (per language) --> CodeQL Database (relational)
                                                        |
                                                  CodeQL Queries --> SARIF Results
```

Each language has a dedicated extractor:
- **TypeScript/JavaScript** -- extracts AST, type information, control flow.
- **Python** -- extracts AST, import resolution, class hierarchy.
- **Go** -- extracts AST, type information, SSA form.

### GitHub Code Scanning Integration

**Default setup (zero-config):**
Enable in repository Settings > Code Security > Code Scanning. GitHub automatically detects languages and runs standard query packs.

**Advanced setup (custom workflow):**

```yaml
# .github/workflows/codeql.yml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6AM

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    strategy:
      matrix:
        language: [javascript-typescript, python, go]
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: +security-and-quality  # Include quality queries
          config-file: .github/codeql/codeql-config.yml

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

**CodeQL configuration file:**

```yaml
# .github/codeql/codeql-config.yml
name: "Custom CodeQL Config"
queries:
  - uses: security-and-quality        # Built-in quality queries
  - uses: ./custom-queries            # Local custom queries
paths:
  - src
paths-ignore:
  - src/generated
  - '**/test/**'
  - '**/vendor/**'
```

### CodeQL Query Language Basics

Every CodeQL query follows the `from-where-select` pattern:

```ql
/**
 * @name Functions with too many parameters
 * @description Functions with more than 5 parameters are hard to use.
 * @kind problem
 * @problem.severity warning
 * @id js/too-many-parameters
 * @tags maintainability
 */

import javascript

from Function f
where f.getNumParameter() > 5
  and not f.inExternsFile()
select f, "Function " + f.getName() + " has " + f.getNumParameter().toString() + " parameters (max 5)."
```

**Key language constructs:**
- **Classes** -- define reusable node types (e.g., `class LongFunction extends Function`).
- **Predicates** -- reusable query fragments (like functions that return sets).
- **Taint tracking** -- follow data from source to sink across function boundaries.

### Custom Queries for Code Quality

**Finding dead code (TypeScript):**

```ql
/**
 * @name Unused exported function
 * @kind problem
 * @problem.severity warning
 * @id js/unused-export
 * @tags maintainability
 */

import javascript

from ExportDeclaration ed, Function f
where ed.getADecl().getInit() = f
  and not exists(ImportDeclaration id |
    id.getAnImport().getImportedModule() = ed.getEnclosingModule())
  and f.getFile().getRelativePath().matches("src/%")
select f, "Exported function '" + f.getName() + "' appears unused across the codebase."
```

**Finding overly complex functions (Python):**

```ql
/**
 * @name High cyclomatic complexity
 * @kind problem
 * @problem.severity warning
 * @id py/high-complexity
 * @tags maintainability
 */

import python
import semmle.python.metrics.Cyclomatic

from Function f, int complexity
where complexity = cyclomaticComplexity(f)
  and complexity > 10
select f, "Function has cyclomatic complexity " + complexity.toString() + " (threshold: 10)."
```

**Finding unchecked errors (Go):**

```ql
/**
 * @name Unchecked error return
 * @kind problem
 * @problem.severity error
 * @id go/unchecked-error
 * @tags reliability
 */

import go

from CallExpr call, FuncDecl callee
where callee = call.getTarget()
  and callee.getResultType(callee.getNumResult() - 1).hasQualifiedName("", "error")
  and not exists(AssignStmt assign | assign.getRhs() = call)
  and not exists(ExprStmt es | es.getExpr() = call)
select call, "Error return value from " + callee.getName() + " is not checked."
```

### CodeQL Packs

| Pack                        | Focus                          | Use Case                  |
|-----------------------------|--------------------------------|---------------------------|
| `codeql/javascript-queries` | Standard JS/TS queries         | Default analysis           |
| `codeql/python-queries`     | Standard Python queries        | Default analysis           |
| `codeql/go-queries`         | Standard Go queries            | Default analysis           |
| `security-extended`         | Additional security queries    | Deeper security scanning   |
| `security-and-quality`      | Security + code quality queries| Comprehensive analysis     |

Install custom packs:

```bash
# Install a published CodeQL pack
codeql pack download my-org/custom-quality-queries

# Create a new pack
codeql pack init my-org/quality-queries
```

### Language-Specific Findings

**TypeScript -- common quality findings:**
- Missing null checks before property access.
- Unhandled promise rejections (missing `.catch()` or `try/catch` around `await`).
- Unnecessary type assertions (`as any`, `as unknown as T`).
- Unused variables and imports across modules.

**Python -- common quality findings:**
- Unused imports cluttering module scope.
- Bare `except:` catching `SystemExit` and `KeyboardInterrupt`.
- Mutable default arguments (`def f(items=[])`).
- Missing `__init__.py` causing import issues.

**Go -- common quality findings:**
- Unchecked error returns (most impactful Go quality issue).
- Goroutine leaks from missing context cancellation.
- `defer` in loops (deferred calls accumulate until function returns).
- Shadowed variables in nested scopes.

### CodeQL CLI for Local Analysis

```bash
# Create database for a TypeScript project
codeql database create ts-db --language=javascript-typescript --source-root=./src

# Run quality queries against the database
codeql database analyze ts-db codeql/javascript-queries:Maintainability \
  --format=sarif-latest --output=results.sarif

# Run a single custom query
codeql query run ./custom-queries/unused-exports.ql --database=ts-db
```

### Interpreting Results (SARIF Format)

CodeQL outputs results in SARIF (Static Analysis Results Interchange Format):

```json
{
  "runs": [{
    "results": [{
      "ruleId": "js/too-many-parameters",
      "level": "warning",
      "message": {
        "text": "Function 'processOrder' has 8 parameters (max 5)."
      },
      "locations": [{
        "physicalLocation": {
          "artifactLocation": { "uri": "src/orders.ts" },
          "region": { "startLine": 42, "startColumn": 1 }
        }
      }]
    }]
  }]
}
```

Upload SARIF to GitHub Code Scanning, SonarQube (via plugin), or any SARIF-compatible viewer.

### CodeQL vs Semgrep Comparison

| Aspect          | CodeQL                                  | Semgrep                                |
|-----------------|-----------------------------------------|----------------------------------------|
| **Analysis**    | Full semantic, builds database          | Pattern matching, AST-based            |
| **Speed**       | Slower (database creation step)         | Faster (no database step)              |
| **Query syntax**| Custom QL language (learning curve)     | YAML patterns (lower barrier)          |
| **Data flow**   | Deep taint tracking, interprocedural    | Intraprocedural (Pro has interprocedural)|
| **Hosting**     | GitHub-native, self-hosted CLI          | Semgrep Cloud, CLI, CI integrations    |
| **Best for**    | Deep semantic bugs, complex data flow   | Quick custom rules, policy enforcement |
| **Cost**        | Free for public repos, GHAS license     | Free (OSS), paid Pro tier              |

Use CodeQL for deep analysis; use Semgrep for fast, custom policy rules. They complement each other.

---

## Best Practices

1. **Enable `security-and-quality` query suite** -- the default setup only runs security queries; explicitly add quality queries for maintainability findings.
2. **Schedule weekly full scans** -- run CodeQL on a schedule in addition to PR triggers to catch issues in code not changed by recent PRs.
3. **Write project-specific queries** -- create custom queries for internal API misuse patterns, deprecated function usage, and domain-specific anti-patterns.
4. **Use CodeQL packs for sharing** -- publish custom queries as CodeQL packs so multiple repositories can reuse them.
5. **Filter results by severity** -- configure GitHub Code Scanning to only fail on error-severity results; treat warnings as informational.
6. **Exclude generated code** -- configure `paths-ignore` in `codeql-config.yml` to skip generated, vendored, and test fixture code.
7. **Review results in PR context** -- use GitHub Code Scanning alerts in PR review rather than a separate dashboard to keep developers in flow.
8. **Combine with linters and type checkers** -- use CodeQL for semantic analysis, ESLint/Ruff for style, TypeScript/mypy for type safety. Each tool has distinct strengths.
9. **Track alert trends over time** -- monitor open alerts count; set a target to reduce alerts each sprint.
10. **Use SARIF upload for third-party integration** -- export SARIF from CodeQL CLI and import into SonarQube or other dashboards for consolidated reporting.

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                               | Correction                                          |
|----|---------------------------------------|-------------------------------------------------------|-----------------------------------------------------|
| 1  | Using CodeQL as sole linter           | CodeQL is slow and misses style issues                | Combine with ESLint/Ruff for style, CodeQL for semantics |
| 2  | Ignoring Code Scanning alerts         | Alerts accumulate, real bugs hidden in noise          | Triage alerts weekly; dismiss false positives with reason |
| 3  | Running only default queries          | Misses quality-specific findings                      | Add `security-and-quality` suite explicitly          |
| 4  | No custom queries for project patterns| Misses project-specific anti-patterns                 | Write custom queries for internal API misuse         |
| 5  | Skipping database recreation          | Stale database produces inaccurate results            | Always create fresh database in CI                   |
| 6  | Blocking PRs on all CodeQL warnings   | Developer frustration, slow iteration                 | Block only on errors; treat warnings as advisory     |
| 7  | Not analyzing all languages           | Polyglot repos have gaps in analysis                  | Configure matrix strategy for each language          |
| 8  | Writing queries without tests         | Queries may produce false positives in production     | Use CodeQL test framework to validate query accuracy |

---

## Enforcement Checklist

- [ ] GitHub Code Scanning enabled with `security-and-quality` query suite.
- [ ] CodeQL workflow configured for all languages in the repository.
- [ ] Custom `codeql-config.yml` excludes generated and vendored code.
- [ ] Weekly scheduled scan configured in addition to PR-triggered scans.
- [ ] Code Scanning alerts set as required status check for protected branches.
- [ ] Custom queries written for project-specific patterns (at least 3).
- [ ] Alert triage process documented; false positives dismissed with reason.
- [ ] SARIF results uploaded to consolidated dashboard if using multi-tool analysis.
- [ ] CodeQL CLI available in developer environment for local query development.
- [ ] Query test suite maintained for all custom queries.
