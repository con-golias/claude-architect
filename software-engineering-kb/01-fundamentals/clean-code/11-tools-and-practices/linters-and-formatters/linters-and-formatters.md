# Linters and Code Formatters

> **Domain:** Fundamentals > Clean Code > Tools and Practices
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

**Linters** analyze source code for errors, bugs, stylistic issues, and suspicious constructs (static analysis). **Formatters** automatically rewrite code to enforce a consistent visual style. Together, they automate code quality enforcement.

> "The best code review comment is the one that never needs to be written because the linter caught it." — Common engineering wisdom

### Key Tools by Language

| Language | Linter | Formatter | Combined |
|----------|--------|-----------|----------|
| JavaScript/TypeScript | ESLint | Prettier | Biome |
| Python | Ruff, Pylint, Flake8 | Black, Ruff | Ruff (2024+) |
| Go | go vet | gofmt | Built-in |
| Rust | clippy | rustfmt | Built-in |
| Java | Checkstyle, PMD, SpotBugs | google-java-format | — |
| C# | Roslyn Analyzers | dotnet format | — |
| CSS | Stylelint | Prettier | — |

## Why It Matters

Teams using automated linting and formatting report:
- **25% reduction in production bugs** (SonarQube data)
- **30% faster code reviews** (no formatting discussions)
- **Zero formatting-related merge conflicts**
- **Faster onboarding** — new developers automatically follow the team's style

## How It Works

### ESLint + Prettier (JavaScript/TypeScript)

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "complexity": ["error", 10],
    "no-unused-vars": "error",
    "no-console": "warn"
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "all"
}
```

### Python: Ruff (2024+ Standard)

```toml
# pyproject.toml
[tool.ruff]
line-length = 88
select = ["E", "F", "W", "I", "N", "UP", "B", "SIM"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

### Pre-commit Hooks (Husky + lint-staged)

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

## Best Practices

1. **Use opinionated formatters** (Prettier, Black, gofmt). Eliminate all style debates.
2. **Format on save** in every developer's IDE.
3. **Lint in CI** — fail the build on lint errors.
4. **Use pre-commit hooks** to catch issues before they reach the repository.
5. **Start strict, loosen selectively.** It's easier to disable rules than to enable them retroactively.
6. **Run formatter first** when adopting — one large "format all" commit, then enforce going forward.

## Sources

- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [JavaScript Static Analysis 2025 (in-com.com)](https://www.in-com.com/blog/javascript-static-analysis-in-2025-from-smart-ts-xl-to-eslint/)
