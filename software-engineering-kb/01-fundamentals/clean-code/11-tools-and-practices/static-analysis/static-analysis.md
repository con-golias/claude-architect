# Static Analysis

> **Domain:** Fundamentals > Clean Code > Tools and Practices
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Static analysis is the automated examination of source code **without executing it**. It catches bugs, security vulnerabilities, code smells, and style violations at compile/build time — before they reach production.

### Types of Static Analysis

| Type | What It Catches | Tools |
|------|----------------|-------|
| **Type Checking** | Type errors, null references | TypeScript, mypy, Java compiler |
| **Linting** | Style, best practices, suspicious patterns | ESLint, Ruff, clippy |
| **Bug Detection** | Null dereference, resource leaks, race conditions | SonarQube, SpotBugs, Infer |
| **Security (SAST)** | SQL injection, XSS, hardcoded secrets | Semgrep, Bandit, Snyk Code |
| **Dependency Scanning** | Vulnerable dependencies | npm audit, Dependabot, Snyk |

## Why It Matters

Teams implementing static analysis tools experience a **25% reduction in production bugs**. Static analysis catches categories of bugs that are hard to find through testing — null pointer exceptions, resource leaks, security vulnerabilities, and concurrency issues.

## How It Works

### SonarQube

SonarQube is the industry-standard platform for continuous code quality inspection. It supports 30+ languages and provides:
- Code smells and bug detection
- Security vulnerability scanning
- Technical debt estimation
- Quality gates (pass/fail criteria for CI)

### Quality Gates in CI

```yaml
# GitHub Actions example
- name: SonarQube Analysis
  run: sonar-scanner
- name: Quality Gate
  run: |
    # Fail if: coverage < 80%, duplications > 3%,
    # no new bugs, no new vulnerabilities
    sonar-quality-gate --fail-on-red
```

### Type Systems as Static Analysis

TypeScript, mypy, and Java generics are the most widely-used static analysis tools — they catch entire categories of errors at compile time:

```typescript
// TypeScript catches this at compile time — no runtime needed
function greet(name: string): string {
  return name.toUpperCase();
}

greet(42);  // ERROR: Argument of type 'number' is not assignable to 'string'
```

## Best Practices

1. **Run static analysis in CI** — fail builds on new issues.
2. **Start with recommended rule sets** and customize over time.
3. **Fix warnings, don't suppress them.** Suppressed warnings accumulate.
4. **Use SAST tools** for security-critical applications.
5. **Integrate dependency scanning** — outdated packages are a security risk.

## Sources

- [SonarQube Documentation](https://docs.sonarqube.org/)
- [Semgrep](https://semgrep.dev/)
- [Static Code Analysis (usefulfunctions.co.uk)](https://www.usefulfunctions.co.uk/2025/11/05/static-analysis-with-eslint-sonarqube-codeclimate/)
