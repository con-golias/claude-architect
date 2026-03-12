# Code Formatting and Style

> **Domain:** Fundamentals > Clean Code > Formatting and Structure
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

Code formatting refers to the visual layout of source code: indentation, line length, spacing, blank lines, alignment, and brace placement. Robert C. Martin dedicates Chapter 5 of *Clean Code* to formatting, using the **newspaper metaphor**:

> "Think of a well-written newspaper article. You read it vertically. At the top you expect a headline, followed by a synopsis, then the details increase as you read downward."

Code should read the same way — high-level concepts at the top, details below.

## Why It Matters

Formatting affects readability more than almost anything else. Inconsistent formatting causes cognitive friction, slows code reviews, and leads to unnecessary merge conflicts. Teams that enforce consistent formatting through automated tools report **30% faster code reviews**.

## How It Works

### Vertical Formatting

**File size:** Most files should be 200-500 lines. Files over 1000 lines are almost always too large.

**Vertical openness:** Use blank lines to separate concepts (like paragraph breaks in prose).

**Vertical density:** Related lines should be close together. Don't separate related declarations with blank lines.

**Vertical distance:** Variables should be declared close to their usage. Related functions should be near each other.

### Horizontal Formatting

**Line length:** 80-120 characters. Google uses 80 for C++ and 100 for Java. Most modern guides use 80-100.

**Indentation:** 2 spaces (Google, Airbnb JS), 4 spaces (Python PEP 8, Java), or tabs (Go, Linux kernel).

### Language-Specific Tools

| Language | Formatter | Linter |
|----------|-----------|--------|
| JavaScript/TypeScript | Prettier | ESLint |
| Python | Black, Ruff | Ruff, Flake8 |
| Go | gofmt | go vet |
| Rust | rustfmt | clippy |
| Java | google-java-format | Checkstyle |
| C# | dotnet format | StyleCop |

### `.editorconfig` Example

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.py]
indent_size = 4

[*.go]
indent_style = tab
```

## Best Practices

1. **Use automated formatters.** Prettier, Black, gofmt — let tools handle formatting so humans focus on logic.
2. **Format on save** in your IDE. Eliminate manual formatting effort entirely.
3. **Enforce in CI.** Fail builds if code isn't formatted. No debates in code reviews.
4. **Agree on a style once** and never discuss it again. Opinionated formatters (Prettier, Black) eliminate bikeshedding.
5. **Use `.editorconfig`** for cross-IDE consistency.

## Anti-patterns / Common Mistakes

- **Inconsistent team styles** — different developers formatting differently.
- **Manual formatting debates** in code reviews — automate it instead.
- **Ignoring formatter configuration** — use the team's settings, not personal preferences.

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapter 5: Formatting.
- [Google Style Guides](https://google.github.io/styleguide/)
- [Prettier Documentation](https://prettier.io/docs/en/)
